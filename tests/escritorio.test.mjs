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
    clearInterval() {},
    clearTimeout() {},
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

test("celular, preferência pelo painel ou escritório sem configuração seguem no painel", async () => {
  for (const caso of [
    { celular: true, entrada: baseConfigurada() },
    { preferencia: "painel", entrada: baseConfigurada() },
    { entrada: Promise.resolve({ eu: "1", worker: null, aviso: "Sem configuração", equipe: [] }) },
    { entrada: Promise.reject(new Error("falhou")) },
  ]) {
    const { c, trocas } = inicioDoEscritorio(caso);
    await c.iniciarNoEscritorio();
    assert.deepEqual(trocas, [], JSON.stringify(caso));
  }
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
