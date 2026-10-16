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
    safeText: (v) =>
      String(v).replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  });
  vm.runInContext(readFileSync("vybe-escritorio.js", "utf8"), c);
  const html = c.escritorioAvatar({ roupa: '" onload="alert(1)' }, "<script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("onload="));
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
  c.entrada = entrada;
  vm.runInContext("escritorioApi=()=>entrada;renderEscritorio=()=>{};", c);
  return { c, painel };
}

test("abrir o escritório carrega a base e não estoura erro", async () => {
  const { c, painel } = telaDoEscritorio(Promise.resolve({
    eu: "1", equipe: [{ id: "1", nome: "Paulo Martins", perfil: { sala: "criacao" } }],
  }));
  await c.abrirEscritorio();
  assert.ok(!/not defined/.test(painel.innerHTML), painel.innerHTML);
  assert.equal(vm.runInContext("escritorio.base.eu", c), "1");
  // Chega sentado na própria sala, que fica na área escolhida (criação).
  assert.equal(vm.runInContext("escritorio.sala", c), "criacao");
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.sala", c), "criacao");
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
const baseConfigurada = () => Promise.resolve({ eu: "1", worker: "https://w.test", equipe: [{ id: "1", nome: "Bia Santos", perfil: { sala: "foco" } }] });

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

test("salas individuais: cada dono na sua, pelo primeiro nome sem acento; livres ficam livres", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  c.equipe = [
    { id: "1", nome: "Paulo Martins" }, { id: "2", nome: "Vinicius Souza" }, { id: "3", nome: "Ewerton L." },
    { id: "4", nome: "Fulano Externo" }, { id: "5", nome: "Beatriz Souza" }, { id: "6", nome: "Tainara Lima" },
  ];
  const r = Object.fromEntries(vm.runInContext("[...escritorioSalasPessoais(equipe)].map(([id, a]) => [id, a.nome])", c));
  assert.deepEqual(r, { 1: "Sala de Paulo", 2: "Sala de Vinícius", 3: "Sala de Ewerton", 5: "Sala de Bia", 6: "Sala de Taynara" });
  const salas = vm.runInContext("ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal).map((a) => [a.x1 - a.x0, a.y1 - a.y0, a.nome])", c);
  assert.equal(salas.length, 12);
  assert.ok(salas.every(([w, h]) => w === 10 && h === 10));
  assert.equal(salas.filter((s) => s[2] === "Sala livre").length, 3);
});

test("figura do boneco: escolhas do perfil viram figura válida; figura colada só se bem formada", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  assert.match(vm.runInContext('mapaFigura({ pele: "escura", roupa: "azul", cabelo: "longo" })', c), /^hd-600-14\.ch-665-82/);
  assert.equal(vm.runInContext('mapaFigura({ figura: "hd-180-1.hr-828-61" })', c), "hd-180-1.hr-828-61");
  assert.doesNotMatch(vm.runInContext('mapaFigura({ figura: "x\\"><script>" })', c), /script/);
});
