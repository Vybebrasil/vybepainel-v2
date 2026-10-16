import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { conexao } from "./postgres.mjs";
import {
  perfilEscritorio,
  assinarEntradaEscritorio,
  carregarEscritorio,
  salvarPerfilEscritorio,
  enviarMensagemEscritorio,
  mensagensEscritorio,
  enviarRecadoEscritorio,
  conversaRecadosEscritorio,
  resumoRecadosEscritorio,
  lerRecadosEscritorio,
  areaEscritorio,
} from "../server/escritorio.js";
import {
  verificarEntrada,
  EscritorioRoom,
} from "../services/escritorio/worker.js";
const segredo = "segredo-exclusivo-de-teste-isolado-123456789";
async function banco() {
  const { db, sql } = conexao();
  await db.exec(
    "CREATE TABLE vybe_pessoas(id int primary key,nome text,ativo boolean,pode_entrar boolean); INSERT INTO vybe_pessoas VALUES(1,'Paulo',true,true),(2,'Jady',true,true),(3,'Bloqueado',true,false);",
  );
  await db.exec(readFileSync("migrations/2026-10-15-escritorio.sql", "utf8"));
  return { db, sql };
}
test("entrada assinada não permite falsificar pessoa, renovar validade ou usar outro público", async () => {
  const now = Date.now();
  const token = assinarEntradaEscritorio(
    { id: 1, nome: "Paulo", admin: false },
    {},
    segredo,
    now,
  );
  assert.equal((await verificarEntrada(token, segredo, now)).sub, "1");
  assert.equal(await verificarEntrada(token, segredo, now + 300001), null);
  assert.equal(
    await verificarEntrada(token, "outro-segredo-igualmente-longo-12345", now),
    null,
  );
  assert.equal(await verificarEntrada(token + "x", segredo, now), null);
  const [b, s] = token.split(".");
  const claims = JSON.parse(Buffer.from(b, "base64url"));
  claims.sub = "2";
  assert.equal(
    await verificarEntrada(
      Buffer.from(JSON.stringify(claims)).toString("base64url") + "." + s,
      segredo,
      now,
    ),
    null,
  );
  assert.throws(() => assinarEntradaEscritorio({ id: 1 }, {}, "curto"), /32/);
});
test("perfil é persistido por pessoa e descarta HTML, sala e cores arbitrárias", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  const perfil = await salvarPerfilEscritorio(sql, 2, {
    roupa: "azul",
    mesa: "roxo",
    cabelo: "longo",
    sala: "criacao",
    x: 400,
    y: -10,
    pessoa_id: 1,
    admin: true,
    objeto: "<script>",
  });
  assert.equal(perfil.x, 94);
  assert.equal(perfil.y, 6);
  assert.equal(perfil.objeto, "planta");
  assert.equal(perfil.admin, undefined);
  const base = await carregarEscritorio(sql, { id: 1 });
  assert.equal(base.equipe.length, 2);
  assert.equal(base.equipe.find((p) => p.id === "2").perfil.roupa, "azul");
  assert.equal(base.equipe.find((p) => p.id === "1").perfil.roupa, "laranja");
});
test("chat mantém autoria, sala, idempotência e rejeita conteúdo inválido", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  const mensagem = {
    sala: "criacao",
    texto: "Vamos alinhar",
    chave: crypto.randomUUID(),
  };
  const id = await enviarMensagemEscritorio(sql, 2, mensagem);
  assert.equal(await enviarMensagemEscritorio(sql, 2, mensagem), id);
  const rows = await mensagensEscritorio(sql, "criacao");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nome, "Jady");
  assert.equal((await mensagensEscritorio(sql, "foco")).length, 0);
  await assert.rejects(
    () =>
      enviarMensagemEscritorio(sql, 1, { ...mensagem, sala: "inexistente" }),
    /Sala/,
  );
  await assert.rejects(
    () =>
      enviarMensagemEscritorio(sql, 1, {
        ...mensagem,
        texto: "x".repeat(2001),
      }),
    /2.000/,
  );
});
test("API recusa serviço e identidade de corpo não substitui a sessão", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  let status, body;
  const res = {
    status(n) {
      status = n;
      return this;
    },
    json(d) {
      body = d;
      return d;
    },
  };
  await areaEscritorio({ method: "GET" }, res, { tipo: "servico" }, sql);
  assert.equal(status, 403);
  await areaEscritorio(
    {
      method: "POST",
      body: { acao: "perfil", pessoa_id: 2, perfil: { roupa: "verde" } },
    },
    res,
    { tipo: "sessao", pessoa: { id: 1 } },
    sql,
  );
  assert.equal(status, 200);
  assert.equal(body.perfil.roupa, "verde");
  const base = await carregarEscritorio(sql, { id: 1 });
  assert.equal(base.equipe.find((p) => p.id === "2").perfil.roupa, "laranja");
});
test("Worker exige assinatura e ignora identidade enviada junto com a entrada", async () => {
  const sockets = [];
  const ctx = {
    getWebSockets: () => sockets,
    storage: { setAlarm: async () => {} },
  };
  const room = new EscritorioRoom(ctx, { ESCRITORIO_SESSION_SECRET: segredo });
  const s = {
    a: {},
    messages: [],
    deserializeAttachment() {
      return this.a;
    },
    serializeAttachment(a) {
      this.a = a;
    },
    send(x) {
      this.messages.push(JSON.parse(x));
    },
    close() {
      this.closed = true;
    },
  };
  sockets.push(s);
  await room.webSocketMessage(
    s,
    JSON.stringify({
      type: "presence:move",
      payload: { sala: "criacao", x: 30, y: 40 },
    }),
  );
  assert.equal(s.closed, true);
  s.closed = false;
  const token = assinarEntradaEscritorio({ id: 2, nome: "Jady" }, {}, segredo);
  await room.webSocketMessage(
    s,
    JSON.stringify({
      type: "presence:join",
      payload: { token, userId: "1", name: "Paulo", admin: true },
    }),
  );
  assert.equal(s.a.sub, "2");
  assert.equal(s.a.nome, "Jady");
  assert.equal(s.a.admin, false);
  await room.webSocketMessage(
    s,
    JSON.stringify({
      type: "presence:move",
      payload: { sala: "criacao", x: 999, y: -5 },
    }),
  );
  assert.equal(s.a.x, 94);
  assert.equal(s.a.y, 6);
});
test("avatar escapa nome e não interpola cores arbitrárias como HTML", () => {
  const c = vm.createContext({
    window: { addEventListener() {} },
    URLSearchParams,
    safeText: (v) =>
      String(v).replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  });
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  const html = c.escritorioAvatar({ roupa: '" onload="alert(1)', figura: '"><img src=x onerror=alert(1)>' }, "<script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("onload="));
  assert.ok(!html.includes("onerror"));
  assert.ok(html.includes("&lt;script>"));
});

test("convites exigem proximidade, mesma sala e pessoa disponível", async () => {
  const sockets = [];
  const room = new EscritorioRoom(
    { getWebSockets: () => sockets },
    { ESCRITORIO_SESSION_SECRET: segredo },
  );
  const socket = (id, sala, x, status = "disponivel") => ({
    a: {
      sub: id,
      nome: "Pessoa " + id,
      sala,
      x,
      y: 50,
      status,
      exp: Date.now() / 1000 + 300,
      last: 0,
    },
    messages: [],
    deserializeAttachment() {
      return this.a;
    },
    serializeAttachment(a) {
      this.a = a;
    },
    send(raw) {
      this.messages.push(JSON.parse(raw));
    },
  });
  const a = socket("1", "criacao", 30),
    b = socket("2", "criacao", 40);
  sockets.push(a, b);
  const invite = () =>
    room.webSocketMessage(
      a,
      JSON.stringify({
        type: "conversation:invite",
        payload: { id: "2", nome: "Impostor" },
      }),
    );
  await invite();
  assert.equal(b.messages[0].payload.nome, "Pessoa 1");
  b.messages = [];
  a.a.last = 0;
  b.a.status = "foco";
  await invite();
  assert.equal(b.messages.length, 0);
  a.a.last = 0;
  b.a.status = "disponivel";
  b.a.x = 90;
  await invite();
  assert.equal(b.messages.length, 0);
  a.a.last = 0;
  b.a.x = 40;
  b.a.sala = "reuniao";
  await invite();
  assert.equal(b.messages.length, 0);
});

test("resposta atrasada de entrada não abre WebSocket depois de desconectar", async () => {
  let resolver,
    websockets = 0;
  const c = vm.createContext({
    window: { addEventListener() {} },
    document: { getElementById: () => null },
    setInterval() { return 0; },
    clearInterval() {},
    clearTimeout() {},
    URL,
    WebSocket: class {
      constructor() {
        websockets++;
      }
    },
  });
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  c.entrada = new Promise((r) => {
    resolver = r;
  });
  vm.runInContext(
    "escritorioApi=()=>entrada;atualizarPessoasEscritorio=()=>{};renderEscritorio=()=>{};atualizarDockEscritorio=()=>{}",
    c,
  );
  const promessa = c.conectarEscritorio();
  c.desconectarEscritorio();
  resolver({ worker: "https://example.com", token: "nunca-usar" });
  await promessa;
  assert.equal(websockets, 0);
});

test("cancelar escritório durante preparação de chamada não entra no SDK", async () => {
  let resolver,
    entradas = 0;
  const c = vm.createContext({
    window: {
      addEventListener() {},
      RealtimeKitClient: {
        init() {
          entradas++;
        },
      },
    },
    document: { getElementById: () => null },
    clearInterval() {},
    clearTimeout() {},
  });
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  c.resultado = new Promise((r) => {
    resolver = r;
  });
  vm.runInContext(
    "escritorio.conectado=true;escritorioApi=()=>resultado;renderEscritorio=()=>{};atualizarDockEscritorio=()=>{};",
    c,
  );
  const promessa = c.entrarChamadaEscritorio();
  c.desconectarEscritorio();
  resolver({ authToken: "teste" });
  await promessa;
  assert.equal(entradas, 0);
});

// abrirEscritorio usava uma variável `geracao` que não existia nela: o escritório
// mostrava "geracao is not defined" e nunca abria. Nenhum teste chamava a
// abertura — estes dois chamam.
function telaDoEscritorio(entrada) {
  const painel = { innerHTML: "" };
  const c = vm.createContext({
    window: { addEventListener() {} },
    document: { getElementById: (id) => (id === "painel-escritorio" ? painel : null) },
    safeText: (v) => String(v),
    clearInterval() {},
    clearTimeout() {},
  });
  vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8"), c);
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  vm.runInContext(readFileSync("vybe-escritorio-abertura.js", "utf8"), c);
  c.entrada = entrada;
  vm.runInContext("escritorioApi=()=>entrada;renderEscritorio=()=>{};abrirAberturaEscritorio=()=>{abertura=(globalThis.abertura||0)+1};", c);
  return { c, painel };
}

test("abrir o escritório carrega a base e não estoura erro", async () => {
  const { c, painel } = telaDoEscritorio(Promise.resolve({
    eu: "1", equipe: [{ id: "1", nome: "Paulo Martins", perfil: { sala: "criacao" } }], salas: [{ id: "sala-0", dono: "Paulo", pessoa_id: "1" }],
  }));
  await c.abrirEscritorio();
  assert.ok(!/not defined/.test(painel.innerHTML), painel.innerHTML);
  assert.equal(vm.runInContext("escritorio.base.eu", c), "1");
  // Chega sentado na própria sala, que fica na área escolhida (criação).
  assert.equal(vm.runInContext("escritorio.sala", c), "criacao");
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.sala", c), "criacao");
  // Quem ainda não viu a abertura desta versão vê a cena ao entrar.
  assert.equal(vm.runInContext("globalThis.abertura", c), 1);
});

test("resposta atrasada não reabre o escritório depois de sair", async () => {
  let resolver;
  const { c } = telaDoEscritorio(new Promise((r) => { resolver = r; }));
  const promessa = c.abrirEscritorio();
  c.desconectarEscritorio();
  resolver({ eu: "1", equipe: [] });
  await promessa;
  assert.equal(vm.runInContext("escritorio.base", c), null);
});

// Escritório como tela inicial: só no computador, só se estiver configurado e
// só para quem não preferiu abrir no painel.
function inicioDoEscritorio({ celular = false, preferencia = null, entrada }) {
  const trocas = [];
  const c = vm.createContext({
    window: { addEventListener() {}, matchMedia: () => ({ matches: celular }) },
    document: { getElementById: () => null },
    location: { search: "" },
    URLSearchParams,
    localStorage: { getItem: () => preferencia, setItem() {} },
    safeText: (v) => String(v),
    clearInterval() {},
    clearTimeout() {},
  });
  vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8"), c);
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  c.entrada = entrada;
  c.trocas = trocas;
  vm.runInContext("var activeBoard='producao';escritorioApi=()=>entrada;voltarAoEscritorio=()=>trocas.push('escritorio');", c);
  return { c, trocas };
}
const baseConfigurada = () => Promise.resolve({ eu: "1", worker: "https://w.test", equipe: [{ id: "1", nome: "Bia Santos", perfil: { sala: "foco" } }], salas: [{ id: "sala-4", dono: "Bia", pessoa_id: "1" }] });

test("computador abre no escritório configurado", async () => {
  const { c, trocas } = inicioDoEscritorio({ entrada: baseConfigurada() });
  await c.iniciarNoEscritorio();
  assert.deepEqual(trocas, ["escritorio"]);
  // Chega sentada na própria sala (Sala de Bia) e a conversa é a dela.
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.nome", c), "Sala de Bia");
  assert.equal(vm.runInContext("escritorio.sala", c), vm.runInContext("escritorioMinhaMesa().ambiente.sala", c));
});

test("celular ou escritório sem configuração seguem no painel", async () => {
  for (const caso of [
    { celular: true, entrada: baseConfigurada() },
    { entrada: Promise.resolve({ eu: "1", worker: null, aviso: "Sem configuração", equipe: [] }) },
    { entrada: Promise.reject(new Error("falhou")) },
  ]) {
    const { c, trocas } = inicioDoEscritorio(caso);
    await c.iniciarNoEscritorio();
    assert.deepEqual(trocas, [], JSON.stringify(caso));
  }
});

test("a antiga preferência de abrir no painel não tira mais ninguém do escritório", async () => {
  const { c, trocas } = inicioDoEscritorio({ preferencia: "painel", entrada: baseConfigurada() });
  await c.iniciarNoEscritorio();
  assert.deepEqual(trocas, ["escritorio"]);
});

test("clique no mapa volta para o mesmo ladrilho e a presença ida e volta", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  for (const [x, y] of [[1, 1], [20.5, 13.25], [67, 46]]) {
    const r = vm.runInContext(`(() => { const o = { x: 100, y: 200 }; const t = mapaTela(${x}, ${y}, o); return mapaLadrilho(t.x, t.y, o); })()`, c);
    assert.ok(Math.abs(r.x - x) < 1e-9 && Math.abs(r.y - y) < 1e-9);
    const v = vm.runInContext(`(() => { const p = escritorioParaPorcentagem(${x}, ${y}); return escritorioParaMapa(p.x, p.y); })()`, c);
    assert.ok(Math.abs(v.x - x) < 1e-9 && Math.abs(v.y - y) < 1e-9);
  }
});

test("cada ambiente do mapa leva à sala de conversa certa", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  assert.equal(vm.runInContext("escritorioSalaEm(2, 2)", c), "reuniao"); // auditório
  assert.equal(vm.runInContext("escritorioSalaEm(64, 16)", c), "foco");
  assert.equal(vm.runInContext("escritorioSalaEm(20, 23)", c), "convivencia"); // corredor
  assert.equal(vm.runInContext("escritorioSalaEm(40, 51)", c), "convivencia"); // piscina
});

test("salas individuais: 12 iguais de 10×10 e o dono vem do servidor", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  const salas = vm.runInContext("ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal).map((a) => [a.x1 - a.x0, a.y1 - a.y0])", c);
  assert.equal(salas.length, 12);
  assert.ok(salas.every(([w, h]) => w === 10 && h === 10));
  vm.runInContext('escritorio.base = { eu: "1", equipe: [], salas: [{ id: "sala-3", dono: "Deivid", pessoa_id: "1" }] }; escritorioAplicarSalas();', c);
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.id", c), "sala-3");
  assert.equal(vm.runInContext('ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "sala-3").nome', c), "Sala de Deivid");
  assert.equal(vm.runInContext('ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "sala-4").nome', c), "Sala livre");
});

test("figura do boneco: escolhas do perfil viram figura válida; figura colada só se bem formada", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  assert.match(vm.runInContext('mapaFigura({ pele: "escura", roupa: "azul", cabelo: "longo" })', c), /^hd-600-14\.ch-665-82/);
  assert.equal(vm.runInContext('mapaFigura({ figura: "hd-180-1.hr-828-61" })', c), "hd-180-1.hr-828-61");
  assert.doesNotMatch(vm.runInContext('mapaFigura({ figura: "x\\"><script>" })', c), /script/);
});

test("perfil guarda só figura bem formada e data de abertura válida", () => {
  const ok = perfilEscritorio({ figura: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110", abertura: "2026-10-16" });
  assert.equal(ok.figura, "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110");
  assert.equal(ok.abertura, "2026-10-16");
  const ruim = perfilEscritorio({ figura: 'hd-180-1"><script>', abertura: "amanhã" });
  assert.equal(ruim.figura, "");
  assert.equal(ruim.abertura, "");
});

// Mecânica do Habbo: paredes e móveis bloqueiam, assento só como destino.
function gradeDeTeste(moveis = [], divisorias = []) {
  const c = vm.createContext({ window: {}, document: {} });
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  c.P = { W: 8, H: 6, divisorias, piscina: null };
  c.moveis = moveis;
  vm.runInContext("g = mapaMontarGrade(P, moveis)", c);
  return (de, para) => { c.de = de; c.para = para; return vm.runInContext("mapaCaminho(g, de, para)", c); };
}

test("caminho desvia da parede pela porta e nunca cruza aresta bloqueada", () => {
  // Parede vertical em x=4 com porta (vão) em y=5.
  const caminho = gradeDeTeste([], [[4, 0, 4, 5]]);
  const passos = caminho({ x: 1, y: 1 }, { x: 6, y: 1 });
  assert.ok(passos && passos.length > 5, "precisa dar a volta");
  let ant = { x: 1, y: 1 };
  for (const p of passos) {
    // atravessar x=3→4 só na linha da porta (y=5)
    if ((ant.x <= 3 && p.x >= 4) || (ant.x >= 4 && p.x <= 3)) assert.equal(Math.max(ant.y, p.y), 5);
    assert.ok(Math.abs(p.x - ant.x) <= 1 && Math.abs(p.y - ant.y) <= 1, "um ladrilho por passo");
    ant = p;
  }
  assert.equal(JSON.stringify(passos.at(-1)), JSON.stringify({ x: 6, y: 1 }));
});

test("móvel bloqueia; destino sobre móvel não tem caminho; parede fechada também não", () => {
  const mesa = { classe: "exe_table", x: 3, y: 0, dim: { x: 2, y: 6 }, dir: 0 };
  assert.equal(gradeDeTeste([mesa])({ x: 1, y: 1 }, { x: 6, y: 1 }), null);
  assert.equal(gradeDeTeste([mesa])({ x: 1, y: 1 }, { x: 3, y: 2 }), null);
  assert.equal(gradeDeTeste([], [[4, 0, 4, 6]])({ x: 1, y: 1 }, { x: 6, y: 1 }), null);
});

test("assento é destino, mas não atalho", () => {
  const sofa = { classe: "hc26_5", x: 3, y: 0, dim: { x: 1, y: 5 }, dir: 2 };
  const caminho = gradeDeTeste([sofa]);
  assert.equal(JSON.stringify(caminho({ x: 1, y: 2 }, { x: 3, y: 2 }).at(-1)), JSON.stringify({ x: 3, y: 2 }));
  const volta = caminho({ x: 1, y: 2 }, { x: 5, y: 2 });
  assert.ok(volta.every((p) => !(p.x === 3 && p.y < 5)), "não pisa no sofá no meio do caminho");
});

test("diagonal não corta quina de parede", () => {
  // Parede horizontal em y=3 de x=0 a 3: de (2,2) para (3,3) não pode ir em diagonal.
  const passos = gradeDeTeste([], [[0, 3, 3, 3]])({ x: 2, y: 2 }, { x: 2, y: 3 });
  assert.ok(passos.length > 1);
  assert.ok(!passos.some((p, i) => i === 0 && p.y === 3 && p.x <= 2));
});

// Mapa editável: só administrador mexe no mapa; cada um na própria sala.
import { salasDoEscritorio, salvarCamadaEscritorio, itensValidos, carregarMapaEscritorio, arteRemotaEscritorio } from "../server/escritorio-mapa.js";

test("salas: dono pelo primeiro nome ou apelido do cadastro; livres sem dono", () => {
  const salas = salasDoEscritorio([
    { id: 1, nome: "Paulo Martins" }, { id: 2, nome: "Beatriz Rocha" }, { id: 3, nome: "Ademir Dourado" }, { id: 4, nome: "Breno Fernandes" },
  ]);
  assert.equal(salas.length, 12);
  assert.equal(salas[0].pessoa_id, "1");
  assert.equal(salas.find((s) => s.dono === "Bia").pessoa_id, "2");
  assert.equal(salas.find((s) => s.dono === "Mizinho").pessoa_id, "3");
  assert.ok(!salas.some((s) => s.pessoa_id === "4"));
  assert.equal(salas.filter((s) => !s.dono).length, 3);
});

test("itens: fora da área, classe estranha ou direção inválida são recusados", () => {
  assert.throws(() => itensValidos("sala-0", [["exe_table", 10, 2, 0]]), /fora/);
  assert.throws(() => itensValidos("geral", [["<script>", 1, 1, 0]]), /inválido/);
  assert.throws(() => itensValidos("geral", [["exe_table", 1, 1, 3]]), /Direção/);
  assert.deepEqual(itensValidos("sala-0", [["exe_table", 4, 1, 0]]), [["exe_table", 4, 1, 0, 0, 0]]);
});

test("permissões e versão ao salvar camadas do mapa", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  const salas = salasDoEscritorio([{ id: 1, nome: "Paulo" }, { id: 2, nome: "Jady" }]);
  // Sem a migração: recusa com aviso, não quebra a entrada.
  await assert.rejects(salvarCamadaEscritorio(sql, { id: 1, admin: true }, salas, { camada: "geral", itens: [], versao: 0 }), /migração/);
  assert.deepEqual(await carregarMapaEscritorio(sql), { editavel: false, camadas: {} });
  await db.exec(readFileSync("migrations/2026-10-16-escritorio-mapa.sql", "utf8"));
  const jady = { id: 2, admin: false }, paulo = { id: 1, admin: true };
  await assert.rejects(salvarCamadaEscritorio(sql, jady, salas, { camada: "geral", itens: [], versao: 0 }), /administra/);
  await assert.rejects(salvarCamadaEscritorio(sql, jady, salas, { camada: "sala-0", itens: [], versao: 0 }), /sua sala/);
  const salaJady = salas.find((s) => s.pessoa_id === "2").id;
  const r1 = await salvarCamadaEscritorio(sql, jady, salas, { camada: salaJady, itens: [["exe_table", 4, 1, 0]], versao: 0 });
  assert.equal(r1.versao, 1);
  // Alguém salvou antes: a versão antiga não sobrescreve.
  await assert.rejects(salvarCamadaEscritorio(sql, jady, salas, { camada: salaJady, itens: [], versao: 0 }), /antes/);
  const r2 = await salvarCamadaEscritorio(sql, paulo, salas, { camada: salaJady, itens: [], versao: 1 });
  assert.equal(r2.versao, 2);
  const r3 = await salvarCamadaEscritorio(sql, paulo, salas, { camada: "geral", itens: [["exe_plant", 70, 50, 2]], versao: 0 });
  assert.equal(r3.versao, 1);
  const mapa = await carregarMapaEscritorio(sql);
  assert.equal(mapa.editavel, true);
  assert.deepEqual(mapa.camadas.geral.itens, [["exe_plant", 70, 50, 2, 0, 0]]);
  assert.deepEqual(mapa.camadas[salaJady].itens, []);
});

test("arte remota só aceita nome de móvel e não chama a rede com nome inválido", async () => {
  let chamadas = 0;
  await assert.rejects(arteRemotaEscritorio("../segredo", "png", () => { chamadas++; }), /inválido/);
  assert.equal(chamadas, 0);
});

test("boneco: guarda a cópia na primeira vez e depois não chama o site", async (t) => {
  const { bonecoEscritorio } = await import("../server/escritorio-mapa.js");
  const { db, sql } = await banco();
  t.after(() => db.close());
  await db.exec(readFileSync("migrations/2026-10-16-escritorio-bonecos.sql", "utf8"));
  let chamadas = 0;
  const site = async () => { chamadas++; return { ok: true, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer }; };
  const a = await bonecoEscritorio(sql, "hd-180-1.hr-828-61", 2, site);
  const b = await bonecoEscritorio(sql, "hd-180-1.hr-828-61", 2, site);
  assert.equal(chamadas, 1);
  assert.deepEqual([...b], [...a]);
  const fora = async () => ({ ok: false });
  assert.deepEqual([...(await bonecoEscritorio(sql, "hd-180-1.hr-828-61", 2, fora))], [137, 80, 78, 71]);
  await assert.rejects(bonecoEscritorio(sql, '"><script>', 2, site), /inválido/);
  await assert.rejects(bonecoEscritorio(sql, "hd-180-1", 9, site), /inválido/);
});

test("Worker aceita só os endereços do painel listados, por igualdade exata", async () => {
  const worker = (await import("../services/escritorio/worker.js")).default;
  const env = { VYBE_ORIGIN: "https://vybepainel-v2.vercel.app,https://vybepainel-v2-vybe-hub.vercel.app", ESCRITORIO: { idFromName: () => "id", get: () => ({ fetch: () => new Response("ok") }) } };
  const pedir = (origem) => worker.fetch(new Request("https://w.test/room/vybe-os", { headers: origem ? { Origin: origem } : {} }), env);
  assert.equal((await pedir("https://vybepainel-v2.vercel.app")).status, 200);
  assert.equal((await pedir("https://vybepainel-v2-vybe-hub.vercel.app")).status, 200);
  assert.equal((await pedir("https://vybepainel-v2.vercel.app.evil.test")).status, 403);
  assert.equal((await pedir("https://evil.test")).status, 403);
  assert.equal((await pedir(null)).status, 403);
});

test("Worker guarda a zona do mapa e descarta zona inventada", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const enviados = [];
  const s = { a: { sub: "1", nome: "Paulo", sala: "criacao", zona: "", x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
    deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { enviados.push(JSON.parse(m)); } };
  sockets.push(s);
  await room.webSocketMessage(s, JSON.stringify({ type: "presence:move", payload: { sala: "criacao", zona: "sala-3", x: 40, y: 40 } }));
  assert.equal(s.a.zona, "sala-3");
  s.a.last = 0; s.a.lastMov = 0;
  await room.webSocketMessage(s, JSON.stringify({ type: "presence:move", payload: { sala: "criacao", zona: "<x>", x: 40, y: 40 } }));
  assert.equal(s.a.zona, "");
  assert.equal(enviados.filter((e) => e.type === "presence:update").at(-1).payload[0].zona, "");
});

test("Worker: trancar sala, bater, deixar entrar, reação e balão", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const sock = (sub, zona, extra = {}) => {
    const s = { a: { sub, nome: "P" + sub, sala: "criacao", zona, x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300, ...extra },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const dona = sock("1", "sala-0", { minhaSala: "sala-0" }), outro = sock("2", "sala-0"), fora = sock("3", "");
  const ev = async (s, type, payload) => { s.a.last = 0; s.a.lastMov = 0; await room.webSocketMessage(s, JSON.stringify({ type, payload })); };
  await ev(outro, "zone:lock", { zona: "sala-0", trancada: true });
  assert.equal(room.trancas.size, 0, "só a dona tranca a sala individual");
  await ev(dona, "zone:lock", { zona: "sala-0", trancada: true });
  assert.deepEqual([...room.trancas.get("sala-0")].sort(), ["1", "2"]);
  await ev(fora, "zone:knock", { zona: "sala-0" });
  assert.ok(dona.msgs.some((m) => m.type === "zone:knock" && m.payload.id === "3"));
  assert.ok(!fora.msgs.some((m) => m.type === "zone:knock"));
  await ev(fora, "zone:admit", { zona: "sala-0", id: "3" });
  assert.ok(!room.trancas.get("sala-0").has("3"), "quem está fora não se deixa entrar");
  await ev(dona, "zone:admit", { zona: "sala-0", id: "3" });
  assert.ok(room.trancas.get("sala-0").has("3"));
  await ev(fora, "reaction", { tipo: "coracao" });
  await ev(fora, "reaction", { tipo: "<x>" });
  assert.equal(dona.msgs.filter((m) => m.type === "reaction").length, 1);
  await ev(fora, "chat:bubble", { texto: "  oi   pessoal  " + "x".repeat(300), id: "1" });
  const b = dona.msgs.find((m) => m.type === "chat:bubble");
  assert.equal(b.payload.id, "3");
  assert.ok(b.payload.texto.startsWith("oi pessoal") && b.payload.texto.length === 140);
  // Todos saem: destranca sozinha.
  dona.a.zona = ""; outro.a.zona = "";
  await ev(dona, "presence:move", { sala: "criacao", zona: "", x: 40, y: 40 });
  assert.equal(room.trancas.size, 0);
});

test("Worker: pose vai para todos; acenar acaba ao andar, café continua na mão", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const s = { a: { sub: "1", nome: "P", sala: "criacao", zona: "", x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
    msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
  sockets.push(s);
  const ev = async (type, payload) => { s.a.last = 0; await room.webSocketMessage(s, JSON.stringify({ type, payload })); };
  await ev("pose", { tipo: "acenar" });
  assert.equal(s.msgs.at(-1).payload[0].pose, "acenar");
  await ev("presence:move", { sala: "criacao", zona: "", x: 40, y: 40 });
  assert.equal(s.a.pose, "");
  await ev("pose", { tipo: "cafe" });
  await ev("presence:move", { sala: "criacao", zona: "", x: 41, y: 40 });
  assert.equal(s.a.pose, "cafe");
  await ev("pose", { tipo: "voar" });
  assert.equal(s.a.pose, "cafe");
});

test("Worker: bebida e esteira continuam ao andar; móvel ligado vale para todos", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const sock = (sub) => {
    const s = { a: { sub, nome: "P" + sub, sala: "criacao", zona: "", x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const um = sock("1"), dois = sock("2");
  const ev = async (s, type, payload) => { s.a.last = 0; s.a.lastMov = 0; await room.webSocketMessage(s, JSON.stringify({ type, payload })); };
  for (const tipo of ["bebida", "lanche", "exercicio"]) {
    await ev(um, "pose", { tipo });
    await ev(um, "presence:move", { sala: "criacao", zona: "", x: 41, y: 40 });
    assert.equal(um.a.pose, tipo);
  }
  await ev(um, "furni:toggle", { chave: "vwave_r21_jukebox@64,33", estado: 0 });
  assert.deepEqual(dois.msgs.filter((m) => m.type === "furni:states").at(-1).payload, [["vwave_r21_jukebox@64,33", 0]]);
  // Chave ou estado fora do formato não entram.
  await ev(um, "furni:toggle", { chave: "<script>@1,1", estado: 1 });
  await ev(um, "furni:toggle", { chave: "x@1,1", estado: 99 });
  assert.equal(room.moveis.size, 1);
});

test("Planta do escritório: sem móvel sobreposto, porta bloqueada, móvel solto ou lugar sem acesso", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["scripts/escritorio-auditar.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("recados: só os dois leem, idempotente por chave, contagem e leitura", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  const chave = "11111111-2222-3333-4444-555555555555";
  // Sem a migração: avisa, não quebra.
  await assert.rejects(resumoRecadosEscritorio(sql, "1"), /migração/);
  await db.exec(readFileSync("migrations/2026-10-16-escritorio-recados.sql", "utf8"));
  const id = await enviarRecadoEscritorio(sql, "1", { para: "2", texto: "  Oi Jady  ", chave });
  assert.equal(await enviarRecadoEscritorio(sql, "1", { para: "2", texto: "Oi Jady", chave }), id);
  await enviarRecadoEscritorio(sql, "2", { para: "1", texto: "Oi Paulo", chave: "22222222-2222-3333-4444-555555555555" });
  await assert.rejects(enviarRecadoEscritorio(sql, "1", { para: "1", texto: "eu", chave: "33333333-2222-3333-4444-555555555555" }), /outra pessoa/);
  await assert.rejects(enviarRecadoEscritorio(sql, "1", { para: "3", texto: "x", chave: "44444444-2222-3333-4444-555555555555" }), /não encontrada/);
  await assert.rejects(enviarRecadoEscritorio(sql, "1", { para: "2", texto: "", chave: "55555555-2222-3333-4444-555555555555" }), /2.000/);
  await assert.rejects(conversaRecadosEscritorio(sql, "1", "2 OR 1=1"), /inválida/);
  const conversa = await conversaRecadosEscritorio(sql, "1", "2");
  assert.deepEqual(conversa.map((r) => [r.de, r.texto]), [["1", "Oi Jady"], ["2", "Oi Paulo"]]);
  // Terceira pessoa não vê a conversa dos dois.
  assert.equal((await conversaRecadosEscritorio(sql, "3", "2")).length, 0);
  assert.deepEqual((await resumoRecadosEscritorio(sql, "2")).map((r) => [r.de, r.nao_lidos]), [["1", 1]]);
  await lerRecadosEscritorio(sql, "2", "1");
  assert.equal((await resumoRecadosEscritorio(sql, "2")).length, 0);
  assert.equal((await resumoRecadosEscritorio(sql, "1")).length, 1, "ler os recados de um não marca os do outro");
});

test("Worker: aviso de recado vai só para quem recebeu, com a autoria da sessão", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const sock = (sub) => {
    const s = { a: { sub, nome: "P" + sub, sala: "criacao", zona: "", x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const um = sock("1"), dois = sock("2"), tres = sock("3");
  um.a.last = 0;
  await room.webSocketMessage(um, JSON.stringify({ type: "recado:novo", payload: { para: "2", de: "3" } }));
  assert.deepEqual(dois.msgs.filter((m) => m.type === "recado:novo").map((m) => m.payload), [{ de: "1", nome: "P1" }]);
  assert.ok(!tres.msgs.some((m) => m.type === "recado:novo"));
});

test("Worker: chamar alguém de longe avisa só a pessoa, com a sala de quem chamou", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const sock = (sub, zona, x) => {
    const s = { a: { sub, nome: "P" + sub, sala: "criacao", zona, x, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const eu = sock("1", "sala-0", 10), longe = sock("2", "cozinha", 90), outro = sock("3", "", 50);
  await room.webSocketMessage(eu, JSON.stringify({ type: "conversation:summon", payload: { id: "2" } }));
  assert.deepEqual(longe.msgs.filter((m) => m.type === "conversation:invite").map((m) => m.payload), [{ nome: "P1", sala: "criacao", zona: "sala-0", chamado: true }]);
  assert.ok(!outro.msgs.some((m) => m.type === "conversation:invite"));
  // Fora de uma sala (corredor) não chama.
  outro.a.last = 0;
  await room.webSocketMessage(outro, JSON.stringify({ type: "conversation:summon", payload: { id: "2" } }));
  assert.equal(longe.msgs.filter((m) => m.type === "conversation:invite").length, 1);
});

test("imagens da equipe: só a própria sala, só imagem de verdade, quadro na parede e apagar tira do mapa", async (t) => {
  const { enviarImagemEscritorio, imagemEscritorio, apagarImagemEscritorio } = await import("../server/escritorio-mapa.js");
  const { db, sql } = await banco();
  t.after(() => db.close());
  const salas = salasDoEscritorio([{ id: 1, nome: "Paulo" }, { id: 2, nome: "Jady" }]);
  const jady = { id: 2, admin: false }, paulo = { id: 1, admin: true };
  const salaJady = salas.find((s) => s.pessoa_id === "2").id;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]).toString("base64");
  await db.exec(readFileSync("migrations/2026-10-16-escritorio-mapa.sql", "utf8"));
  // Sem a migração das imagens: recusa com aviso.
  await assert.rejects(enviarImagemEscritorio(sql, jady, salas, { camada: salaJady, tipo: "quadro", largura: 2, altura: 2, dados: png }), /migração/);
  await db.exec(readFileSync("migrations/2026-10-17-escritorio-imagens.sql", "utf8"));
  await assert.rejects(enviarImagemEscritorio(sql, jady, salas, { camada: "sala-0", tipo: "quadro", largura: 2, altura: 2, dados: png }), /sua sala/);
  await assert.rejects(enviarImagemEscritorio(sql, jady, salas, { camada: salaJady, tipo: "quadro", largura: 2, altura: 2, dados: Buffer.from("<svg onload=x>").toString("base64") }), /PNG, JPG ou WEBP/);
  await assert.rejects(enviarImagemEscritorio(sql, paulo, salas, { camada: "geral", tipo: "quadro", largura: 2, altura: 2, dados: png }), /parede de uma sala/);
  await assert.rejects(enviarImagemEscritorio(sql, jady, salas, { camada: salaJady, tipo: "quadro", largura: 2, altura: 4, dados: png }), /Tamanho/);
  const img = await enviarImagemEscritorio(sql, jady, salas, { camada: salaJady, tipo: "quadro", largura: 3, altura: 2, nome: "Logo", dados: png });
  assert.equal((await imagemEscritorio(sql, img.id)).mime, "image/png");
  const classe = "vybeimg_" + img.id;
  // Quadro fora da parede do fundo é recusado; na parede, salva.
  await assert.rejects(salvarCamadaEscritorio(sql, jady, salas, { camada: salaJady, itens: [[classe, 3, 3, 4]], versao: 0 }), /parede/);
  const salvo = await salvarCamadaEscritorio(sql, jady, salas, { camada: salaJady, itens: [[classe, 3, 0, 4], ["exe_plant", 1, 1, 2]], versao: 0 });
  assert.equal(salvo.versao, 1);
  // Imagem de uma sala não entra em outra.
  await assert.rejects(salvarCamadaEscritorio(sql, paulo, salas, { camada: "sala-0", itens: [[classe, 3, 0, 4]], versao: 0 }), /outra área/);
  assert.equal((await carregarMapaEscritorio(sql)).imagens.length, 1);
  await assert.rejects(apagarImagemEscritorio(sql, { id: 3, admin: false }, salas, { id: img.id }), /sua sala/);
  await apagarImagemEscritorio(sql, jady, salas, { id: img.id });
  const mapa = await carregarMapaEscritorio(sql);
  assert.deepEqual(mapa.camadas[salaJady].itens, [["exe_plant", 1, 1, 2, 0, 0]]);
  assert.equal(mapa.imagens.length, 0);
});

test("Worker: fila de música só no Lounge, link do YouTube validado e o fim avança uma vez", async () => {
  const sockets = [];
  const guardado = new Map();
  const room = new EscritorioRoom({ getWebSockets: () => sockets, storage: { get: async (k) => guardado.get(k), put: async (k, v) => guardado.set(k, v) } }, { ESCRITORIO_SESSION_SECRET: segredo });
  const sock = (sub, zona) => {
    const s = { a: { sub, nome: "P" + sub, sala: "convivencia", zona, x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const um = sock("1", "lounge"), fora = sock("2", "cafe");
  const ev = async (s, type, payload) => { s.a.last = 0; s.a.lastMov = 0; await room.webSocketMessage(s, JSON.stringify({ type, payload })); };
  const estado = () => fora.msgs.filter((m) => m.type === "music:state").at(-1)?.payload;
  // Fora do Lounge não mexe na fila.
  await ev(fora, "music:enqueue", { fonte: { kind: "video", videoId: "dQw4w9WgXcQ" } });
  assert.equal(estado(), undefined);
  await ev(um, "music:enqueue", { fonte: { kind: "video", videoId: "<script>abc" } });
  assert.match(um.msgs.at(-1).payload.message, /YouTube/);
  await ev(um, "music:enqueue", { fonte: { kind: "video", videoId: "dQw4w9WgXcQ" } });
  await ev(um, "music:enqueue", { fonte: { kind: "playlist", playlistId: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" } });
  let m = estado();
  assert.equal(m.fila.length, 2);
  assert.equal(m.fila[0].por, "P1");
  assert.equal(m.tocando, true);
  assert.equal(m.indice, 0);
  // Dois navegadores avisam o fim da mesma música: avança só uma vez.
  const rev = m.revisao;
  await ev(um, "music:ended", { revisao: rev });
  await ev(um, "music:ended", { revisao: rev });
  assert.equal(estado().indice, 1);
  await ev(um, "music:control", { acao: "pausar" });
  assert.equal(estado().tocando, false);
  await ev(um, "music:control", { acao: "remover", id: estado().fila[1].id });
  assert.equal(estado().fila.length, 1);
  // A fila sobrevive à sala do Worker dormir (fica guardada).
  assert.equal(guardado.get("musica").fila.length, 1);
});

test("Worker: passo logo depois de outro evento não é descartado", async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: segredo });
  const s = { a: { sub: "1", nome: "P1", sala: "convivencia", zona: "lounge", x: 50, y: 50, status: "disponivel", last: 0, exp: Math.floor(Date.now() / 1000) + 300 },
    msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
  sockets.push(s);
  await room.webSocketMessage(s, JSON.stringify({ type: "reaction", payload: { tipo: "joinha" } }));
  await room.webSocketMessage(s, JSON.stringify({ type: "presence:move", payload: { sala: "convivencia", zona: "lounge", x: 61, y: 62 } }));
  assert.equal(s.a.x, 61);
});

test("conversa: a própria conexão antiga e entradas repetidas não aparecem nem tocam", () => {
  const c = vm.createContext({ window: { addEventListener() {} }, document: { getElementById: () => null, addEventListener() {} } });
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  vm.runInContext("escritorio.base={eu:'1'}", c);
  const lista = [{ id: "a", customParticipantId: "1:velho" }, { id: "b", customParticipantId: "4:x" }, { id: "c", customParticipantId: "4:y" }, { id: "d", customParticipantId: "7:z" }];
  const outros = c.escritorioOutrosNaChamada({ participants: { joined: { toArray: () => lista } } });
  assert.equal(JSON.stringify(outros.map((p) => p.id)), JSON.stringify(["c", "d"]));
});

test("perfil: piso e parede da sala só com valores conhecidos", () => {
  const p = perfilEscritorio({ sala_piso: "pista", sala_parede: "#5ad1e6" });
  assert.equal(p.sala_piso, "pista");
  assert.equal(p.sala_parede, "#5ad1e6");
  const q = perfilEscritorio({ sala_piso: "url(javascript:x)", sala_parede: "red;background:url(x)" });
  assert.equal(q.sala_piso, "");
  assert.equal(q.sala_parede, "");
});

test("perfil: piso pintado e paredes só no formato certo", () => {
  const ok = perfilEscritorio({ sala_pisos: "0".repeat(99) + "b", sala_paredes: "c02".repeat(39) + "hd0" });
  assert.equal(ok.sala_pisos.length, 100);
  assert.equal(ok.sala_paredes.length, 120);
  const ruim = perfilEscritorio({ sala_pisos: "z".repeat(100), sala_paredes: "c03".repeat(40) });
  assert.equal(ruim.sala_pisos, "");
  assert.equal(ruim.sala_paredes, "");
});

test("chamada: conversa única do escritório e a mesma pessoa reaproveita o participante", async (t) => {
  const { prepararChamadaEscritorio } = await import("../server/escritorio-chamadas.js");
  const { db, sql } = await banco();
  t.after(() => db.close());
  const chamadas = [];
  const fetchAntes = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchAntes; });
  globalThis.fetch = async (url, init) => {
    chamadas.push([String(url).replace(/^.*\/kit\/app/, ""), init.method]);
    const data = /\/token$/.test(url) ? { token: "renovado" } : /\/participants$/.test(url) ? { id: "part-1", token: "novo" } : { id: "reuniao-1" };
    return { ok: true, json: async () => ({ success: true, data }) };
  };
  const env = { CLOUDFLARE_ACCOUNT_ID: "a", REALTIMEKIT_APP_ID: "app", CLOUDFLARE_REALTIME_API_TOKEN: "t" };
  const pessoa = { id: 1, nome: "Paulo" };
  assert.equal((await prepararChamadaEscritorio(sql, pessoa, "escritorio", env)).authToken, "novo");
  // Reconectar: não cria outro participante, só renova o token.
  assert.equal((await prepararChamadaEscritorio(sql, pessoa, "escritorio", env)).authToken, "renovado");
  assert.deepEqual(chamadas.map(([u, m]) => m + " " + u), ["POST /meetings", "POST /meetings/reuniao-1/participants", "POST /meetings/reuniao-1/participants/part-1/token"]);
  await assert.rejects(prepararChamadaEscritorio(sql, pessoa, "<x>", env), /Sala inválida/);
});

test("mapa: cada salvamento guarda a versão anterior e só quem edita vê o histórico", async (t) => {
  const { versoesDaCamada, itensDaVersao } = await import("../server/escritorio-mapa.js");
  const { db, sql } = await banco();
  t.after(() => db.close());
  await db.exec(readFileSync("migrations/2026-10-16-escritorio-mapa.sql", "utf8"));
  const salas = salasDoEscritorio([{ id: 1, nome: "Paulo" }, { id: 2, nome: "Jady" }]);
  const paulo = { id: 1, admin: true }, jady = { id: 2, admin: false };
  // Sem a migração do histórico, salvar continua funcionando.
  await salvarCamadaEscritorio(sql, paulo, salas, { camada: "geral", itens: [["exe_plant", 1, 1, 2]], versao: 0 });
  await assert.rejects(versoesDaCamada(sql, paulo, salas, "geral"), /migração/);
  await db.exec(readFileSync("migrations/2026-10-17-escritorio-mapa-versoes.sql", "utf8"));
  await salvarCamadaEscritorio(sql, paulo, salas, { camada: "geral", itens: [["exe_plant", 2, 2, 2]], versao: 1 });
  await salvarCamadaEscritorio(sql, paulo, salas, { camada: "geral", itens: [], versao: 2 });
  const versoes = await versoesDaCamada(sql, paulo, salas, "geral");
  assert.deepEqual(versoes.map((v) => v.versao), [2, 1]);
  const v1 = await itensDaVersao(sql, paulo, salas, versoes[1].id);
  assert.deepEqual(v1.itens, [["exe_plant", 1, 1, 2, 0, 0]]);
  await assert.rejects(versoesDaCamada(sql, jady, salas, "geral"), /administra/);
  await assert.rejects(itensDaVersao(sql, jady, salas, versoes[0].id), /administra/);
});
