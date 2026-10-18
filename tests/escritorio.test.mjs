import { spawnSync } from "node:child_process";
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
  // No corredor (sem zona), quem convida escolhe a sala do encontro; zona
  // inventada é descartada. Dentro de uma sala com voz, vale a sala.
  b.a.sala = "criacao";
  const convidar = async (zonaDeA, zonaPedida) => {
    a.a.last = 0; a.a.zona = zonaDeA; b.a.zona = zonaDeA; b.messages = [];
    await room.webSocketMessage(a, JSON.stringify({ type: "conversation:invite", payload: { id: "2", zona: zonaPedida } }));
    return b.messages[0]?.payload;
  };
  assert.equal((await convidar("", "recepcao")).zona, "recepcao");
  assert.equal((await convidar("", "recepcao")).id, "1");
  assert.equal((await convidar("", "<x>")).zona, "");
  assert.equal((await convidar("cafe", "recepcao")).zona, "cafe");
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
  // Chega sentado na própria sala (sala-0), na ala de Atendimento: o chat
  // escrito é o da ala, não o da preferência antiga do perfil.
  assert.equal(vm.runInContext("escritorio.sala", c), "atendimento");
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.sala", c), "atendimento");
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

test("recarga aplica planta e acabamento do perfil salvo antes de montar o quarto", async () => {
  const quartos=JSON.parse(readFileSync("assets/escritorio/habbo/quartos.json","utf8"));
  const entrada=Promise.resolve({eu:"1",worker:"https://w.test",quartos,
    equipe:[{id:"1",nome:"Paulo",perfil:{quarto_configurado:true,sala_planta:"compacto",sala_piso:"clara",sala_parede:"#5aa9ff"}}],
    salas:[{id:"sala-0",dono:"Paulo",pessoa_id:"1"}],mapa:{camadas:{"sala-0":{itens:[],em:"2027-01-01T00:00:00Z"}}}});
  const {c}=inicioDoEscritorio({entrada});await c.iniciarNoEscritorio();
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.planta",c),"compacto");
  assert.equal(vm.runInContext("escritorioMinhaMesa().ambiente.cor",c),"#5aa9ff");
  assert.equal(vm.runInContext("escritorioPlantaDaCena().andavel(0,0)",c),false);
});

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

test("cada lugar leva à sala de conversa certa", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  // Espaços comuns são cenas próprias: a zona é o id (que o Worker aceita) e
  // a sala de conversa vem do ambiente. A Convivência usa a zona "recepcao".
  const cena = (id) => vm.runInContext(`escritorioCenaComum("${id}")?.sala`, c);
  assert.equal(cena("recepcao"), "convivencia");
  assert.equal(vm.runInContext('escritorioCenaComum("recepcao").nome', c), "Convivência");
  assert.equal(cena("auditorio"), "reuniao");
  assert.equal(cena("reuniao"), "reuniao");
  assert.equal(cena("foco"), "foco");
  assert.equal(cena("producao"), "producao");
  assert.equal(cena("lounge"), "convivencia");
  // Chat escrito das salas individuais: o da ala em que ficam.
  const salaDe = (id) => vm.runInContext(`ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "${id}").sala`, c);
  assert.equal(salaDe("sala-0"), "atendimento");
  assert.equal(salaDe("sala-3"), "criacao");
  assert.equal(salaDe("sala-6"), "producao");
  // O cabeçalho do chat diz onde a pessoa está e com quem divide o chat.
  vm.runInContext('escritorio.base = { eu: "1", equipe: [], salas: [{ id: "sala-0", dono: "Paulo", pessoa_id: "1" }, { id: "sala-1", dono: "Vinícius", pessoa_id: "2" }] }; escritorioAplicarSalas(); escritorio.quarto = "sala-0"; escritorioDefinirQuarto("sala-0"); escritorio.zona = "sala-0"; escritorio.perfil = escritorioParaPorcentagem(5, 5); escritorio.sala = "atendimento";', c);
  assert.equal(vm.runInContext("escritorioTituloChat()", c), "Conversa · Atendimento");
  assert.match(vm.runInContext("escritorioNotaChat()", c), /^Você está em Sala de Paulo\. Chat escrito dividido com Sala de Vinícius, Sala livre\.$/);
  // Na Praça (cena de abertura) não há ambiente nem zona: sem voz, como o corredor.
  vm.runInContext('escritorio.quarto = null; escritorioDefinirQuarto(null); escritorio.zona = "";', c);
  assert.equal(vm.runInContext("escritorioAmbienteEm(5, 5)", c), null);
  assert.equal(vm.runInContext("escritorioLugarDe(escritorio.perfil).nome", c), "Praça");
});

// Sem mapa geral (decisão do Paulo, 17/10/2026): cada lugar é uma cena; a
// Praça é a de abertura e a porta de cada cena leva a um lugar fixo.
test("planta: a Praça é a cena de abertura, ao ar livre, e cada porta leva a um lugar", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  const P = vm.runInContext("escritorioPlantaGeral()", c);
  assert.equal(P.quarto, "praca");
  assert.equal(P.divisorias.length, 0, "ao ar livre, sem paredes");
  assert.ok(P.texturas.some((t) => t.agua), "lago e piscina não se pisam");
  assert.ok(vm.runInContext("ESCRITORIO_PLANTA.ambientes.every((a) => !a.fachada)", c), "nenhuma fachada");
  const destino = (id) => vm.runInContext(`escritorioDestinoDaPorta(${JSON.stringify(id)}).nome`, c);
  assert.equal(destino("sala-3"), "Convivência");
  assert.equal(destino("cafe"), "Convivência");
  assert.equal(destino("recepcao"), "Praça");
  assert.equal(destino(null), "Convivência");
});

test("planta: o quarto é uma cena própria 8×8 com as duas paredes do fundo altas e a porta para a soleira", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  for (let i = 0; i < 9; i++) {
    const P = vm.runInContext(`escritorioPlantaDoQuarto(ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "sala-${i}"))`, c);
    const a = P.ambientes[0];
    assert.equal(P.quarto, "sala-" + i);
    assert.deepEqual([a.x0, a.y0, a.x1, a.y1], [0, 0, 8, 8]);
    assert.equal(P.W, 9); assert.equal(P.H, 9);
    assert.equal(P.PREDIO, null);
    // Parede do Habbo: 3,6 blocos (115 px) acima do piso mais alto.
    const altas = P.divisorias.filter((d) => d.alt === 115);
    assert.equal(altas.length, 2, "fundo e esquerda altas");
    assert.ok(altas.some((d) => d[1] === 0 && d[3] === 0) && altas.some((d) => d[0] === 0 && d[2] === 0));
    // Só se anda dentro do quarto e na soleira; a soleira fica fora do piso.
    assert.ok(P.andavel(0, 0) && P.andavel(7, 7));
    assert.ok(!P.andavel(8, 8) && !P.andavel(8, 0) && !P.andavel(0, 8));
    assert.ok(P.andavel(P.saida.x, P.saida.y));
    assert.ok(P.saida.x >= 8 || P.saida.y >= 8, "a saída é fora do quarto");
    // Dentro do quarto, a posição local cai nele; fora dele, em nada.
    vm.runInContext(`escritorioDefinirQuarto("sala-${i}")`, c);
    assert.equal(vm.runInContext("escritorioAmbienteEm(3, 3)?.id", c), "sala-" + i);
    assert.equal(vm.runInContext("escritorioAmbienteEm(40, 57)", c), null, "a Recepção não existe dentro do quarto");
    vm.runInContext("escritorioDefinirQuarto(null)", c);
  }
});

// Contexto para a troca de cena sem navegador: sem painel (render sai cedo),
// com um socket falso que guarda o que seria enviado ao Worker.
function cenaDoEscritorio() {
  const enviados = [];
  const c = vm.createContext({
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    document: { getElementById: () => null, querySelector: () => null, body: { classList: { add() {} } } },
    location: { search: "" },
    URLSearchParams,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    safeText: (v) => String(v),
    WebSocket: { OPEN: 1 },
    performance: { now: () => 0 },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  });
  for (const f of ["vybe-escritorio-planta.js", "vybe-escritorio-mapa.js", "vybe-escritorio.js", "vybe-escritorio-editor.js", "vybe-escritorio-ficha.js", "vybe-escritorio-musica.js"]) vm.runInContext(readFileSync(f, "utf8"), c);
  c.enviados = enviados;
  vm.runInContext(`escritorio.base = { eu: "1", admin: false, worker: "https://w.test", equipe: [{ id: "1", nome: "Paulo Martins", perfil: {} }, { id: "2", nome: "Deivid Lima", perfil: { sala_pisos: "5".repeat(144) } }],
    salas: [{ id: "sala-0", dono: "Paulo", pessoa_id: "1" }, { id: "sala-3", dono: "Deivid", pessoa_id: "2" }], mapa: { editavel: true, camadas: { "sala-3": { itens: [["exe_plant", 1, 1, 2, 0, 0]], versao: 2, em: "2027-01-01T00:00:00Z" } } } };
    escritorioChegar(); escritorio.conectado = true; escritorio.socket = { readyState: 1, send: (m) => enviados.push(JSON.parse(m)) };
    // A voz (RealtimeKit) fica fora deste teste: só registra que a troca de cena a chamou.
    vozChamada = 0; escritorioConversaAutomatica = () => { vozChamada++; };
    // O player da música também: só conta quando a troca de cena o aciona.
    musicaSincronizada = 0; sincronizarMusicaEscritorio = () => { musicaSincronizada++; };`, c);
  const r = (codigo) => vm.runInContext(codigo, c);
  return { c, r, enviados };
}

test("quartos: chega dentro do próprio quarto; entrar e sair trocam a cena, a zona e a posição", () => {
  const { r, enviados } = cenaDoEscritorio();
  // Chegada: dentro do próprio quarto (modo foco), logo depois da porta.
  assert.equal(r("escritorio.quarto"), "sala-0");
  assert.equal(r("escritorio.zona"), "sala-0");
  assert.equal(r("escritorio.sala"), "atendimento");
  assert.ok(r("escritorioNoMeuQuarto()"));
  assert.equal(r("escritorioLugarDe(escritorio.perfil).nome"), "Sala de Paulo");
  // Sai pela porta: chega na Convivência, logo depois da porta dela.
  assert.ok(r("escritorioSairDoQuarto()"));
  assert.equal(r("escritorio.quarto"), "recepcao");
  assert.equal(r("escritorio.zona"), "recepcao");
  assert.equal(r("escritorio.sala"), "convivencia");
  const e = r('escritorioEntradaDaSala(escritorioCenaComum("recepcao"))');
  assert.equal(r("[Math.round(escritorioPosicao(escritorio.perfil).x), Math.round(escritorioPosicao(escritorio.perfil).y)].join()"), `${e.x},${e.y}`);
  assert.equal(r("escritorioLugarDe(escritorio.perfil).nome"), "Convivência");
  assert.equal(enviados.filter((m) => m.type === "presence:move").at(-1).payload.zona, "recepcao");
  // Da Convivência a porta leva à Praça (zona vazia) e volta.
  assert.ok(r("escritorioSairDoQuarto()"));
  assert.equal(r("escritorio.quarto"), null);
  assert.equal(r("escritorio.zona"), "");
  assert.equal(enviados.filter((m) => m.type === "presence:move").at(-1).payload.zona, "");
  assert.ok(r("escritorioSairDoQuarto()"));
  assert.equal(r("escritorio.quarto"), "recepcao");
  // Entra no quarto de outra pessoa (pela lista): a cena, a zona e a ala de
  // chat são as dele; a posição é local (logo depois da porta do quarto).
  assert.ok(r('escritorioEntrarNoQuarto("sala-3")'));
  assert.equal(r("escritorio.quarto"), "sala-3");
  assert.equal(r("escritorio.zona"), "sala-3");
  assert.equal(r("escritorio.sala"), "criacao");
  const pos = r("escritorioPosicao(escritorio.perfil)");
  assert.ok(pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8, "posição local dentro do quarto");
  assert.equal(enviados.filter((m) => m.type === "presence:move").at(-1).payload.zona, "sala-3");
  // Entrar numa sala com voz liga a conversa dela na hora.
  assert.ok(r("vozChamada") >= 1);
  assert.ok(!r("escritorioNoMeuQuarto()"));
  assert.equal(r("escritorioLugarDe(escritorio.perfil).nome"), "Sala de Deivid");
  // Entrar no quarto em que já está não faz nada.
  assert.ok(!r('escritorioEntrarNoQuarto("sala-3")'));
});

test("quartos: pisar na soleira sai pela porta; sala trancada não deixa entrar pela lista", () => {
  const { r } = cenaDoEscritorio();
  r("escritorioSairDoQuarto()");
  // Trancada por outra pessoa: não entra (avisa e oferece bater).
  r('escritorio.trancas = new Map([["sala-3", new Set(["2"])]])');
  assert.ok(r('escritorioZonaBloqueada("sala-3")'));
  r('escritorioIrParaAmbiente("sala-3")');
  assert.equal(r("escritorio.quarto"), "recepcao");
  // Deixaram entrar: entra.
  r('escritorio.trancas = new Map([["sala-3", new Set(["2", "1"])]])');
  assert.ok(r('escritorioEntrarNoQuarto("sala-3")'));
  assert.equal(r("escritorio.quarto"), "sala-3");
  // Dentro: andar no piso não faz nada; pisar na soleira sai para a Convivência.
  const P = r('escritorioPlantaDoQuarto(ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "sala-3"))');
  r("movimento.x = 3; movimento.y = 3;");
  assert.equal(r("escritorioConferirPortal()"), false);
  r(`movimento.x = ${P.saida.x}; movimento.y = ${P.saida.y};`);
  assert.equal(r("escritorioConferirPortal()"), true);
  assert.equal(r("escritorio.quarto"), "recepcao");
});

// Espaços comuns como cenas (decisão do Paulo, 17/10/2026): a zona de
// conversa é o id do espaço; a lista leva direto; quem está dentro só aparece lá.
test("espaços comuns: o Café é uma cena própria com zona e móveis locais, e a lista leva direto", () => {
  const { r } = cenaDoEscritorio();
  // A lista só age com a cena desenhada; aqui basta um mapa de mentira.
  const comMapa = () => r("escritorio.mapa = { destruir() {} }");
  comMapa();
  r('escritorioIrParaAmbiente("cafe")');
  assert.equal(r("escritorio.quarto"), "cafe");
  assert.equal(r("escritorio.zona"), "cafe");
  assert.equal(r("escritorioLugarDe(escritorio.perfil).nome"), "Café");
  const moveis = r("escritorioMoveisAtuais()");
  const a = r('escritorioCenaComum("cafe")');
  assert.ok(moveis.length > 20, "o Café vem montado");
  assert.ok(moveis.every((m) => m[1] >= 0 && m[1] < a.x1 && m[2] >= 0 && m[2] < a.y1), "coordenadas da cena");
  // Sem andares nem "Gerenciar meu espaço" (não é sala de ninguém).
  assert.equal(r("escritorioAndaresHtml()"), "");
  // Quem está no Café aparece nele; na Convivência, não.
  r('escritorio.online = [{ id: "2", nome: "Deivid Lima", zona: "cafe", x: 9, y: 12, status: "disponivel" }]');
  assert.equal(r('escritorioNaCena(escritorio.online[0])'), true);
  assert.ok(r("escritorioSairDoQuarto()"));
  assert.equal(r("escritorio.quarto"), "recepcao");
  assert.equal(r('escritorioNaCena(escritorio.online[0])'), false);
  assert.equal(r('escritorioLugarDe(escritorio.online[0]).id'), "cafe");
  // A música toca no Lounge (a cena inteira); fora dele, não.
  assert.equal(r("escritorioNaPista()"), false);
  comMapa();
  r('escritorioIrParaAmbiente("lounge")');
  assert.equal(r("escritorioNaPista()"), true);
  assert.ok(r("musicaSincronizada") >= 1, "entrar no Lounge liga a música na hora");
  // "praca" na lista leva à Praça.
  comMapa();
  r('escritorioIrParaAmbiente("praca")');
  assert.equal(r("escritorio.quarto"), null);
});

// Comandos do boneco (rosto, placa, sentar no chão, "digitando…") vão pelo
// balão com um marcador invisível: quem recebe aplica e não mostra o balão.
test("boneco: comandos do balão viram estado, não texto; o rosto acompanha o que foi escrito", () => {
  const { r, enviados } = cenaDoEscritorio();
  r(`registro = { baloes: [], estados: [] }; escritorio.mapa = { destruir() {}, balao: (id, t) => registro.baloes.push([id, t]), estadoBoneco: (id, e) => registro.estados.push([id, e]), assentoEm: () => undefined };`);
  r('escritorioReceberBalao("2", "\u2063sig=11")');
  r('escritorioReceberBalao("2", "\u2063exp=agr")');
  r('escritorioReceberBalao("2", "\u2063sit=1")');
  r('escritorioReceberBalao("2", "\u2063sig=99")'); // placa que não existe: ignorada
  assert.equal(r("registro.baloes.length"), 0, "comando não vira balão");
  assert.equal(r("JSON.stringify(registro.estados)"), JSON.stringify([["2", { placa: 11 }], ["2", { expressao: "agr" }], ["2", { chao: true }]]));
  // Texto comum vira balão; ":(" deixa o rosto triste, "nossa!!" surpreso.
  r('registro.estados = []; escritorioReceberBalao("2", "poxa :(")');
  r('escritorioReceberBalao("2", "nossa!!")');
  r('escritorioReceberBalao("2", "bom dia")');
  assert.equal(r("registro.baloes.length"), 3);
  assert.equal(r("JSON.stringify(registro.estados)"), JSON.stringify([["2", { expressao: "sad" }], ["2", { expressao: "srp" }]]));
  // Enviar: o próprio boneco já aplica e o comando sai pelo balão.
  r('placaEscritorio("coracao")');
  assert.equal(enviados.filter((m) => m.type === "chat:bubble").at(-1).payload.texto, "\u2063sig=11");
  r("sentarNoChaoEscritorio()");
  assert.equal(r("escritorio.noChao"), true);
  assert.equal(enviados.filter((m) => m.type === "chat:bubble").at(-1).payload.texto, "\u2063sit=1");
});

test("quartos: cada cena mostra só quem está nela; a lista diz o lugar", () => {
  const { r } = cenaDoEscritorio();
  r('escritorio.online = [{ id: "1", nome: "Paulo Martins", zona: "sala-0", x: 9, y: 12, status: "disponivel" }, { id: "2", nome: "Deivid Lima", zona: "sala-3", x: 9, y: 12, status: "disponivel" }, { id: "3", nome: "Bia Rocha", zona: "", x: 50, y: 70, status: "disponivel" }, { id: "4", nome: "Jady Souza", zona: "sala-0", x: 10, y: 10, status: "foco" }]');
  // No meu quarto (sala-0): eu e Jady; Deivid (noutro quarto) e Bia (Praça) não.
  const naCena = (id) => r(`escritorioNaCena(escritorio.online.find((p) => p.id === "${id}"))`);
  assert.deepEqual(["1", "2", "3", "4"].map(naCena), [true, false, false, true]);
  assert.ok(!r("escritorioOcupado(Math.round(escritorioPosicao(escritorio.online[2]).x), Math.round(escritorioPosicao(escritorio.online[2]).y))"), "quem está na Praça não ocupa ladrilho do quarto");
  // Quem está onde: pela zona, não pela posição.
  assert.equal(r('escritorioLugarDe(escritorio.online[1]).nome'), "Sala de Deivid");
  assert.equal(r('escritorioLugarDe(escritorio.online[2]).nome'), "Praça");
  assert.match(r("escritorioOndeHtml()"), /Sala de Paulo[^]*você, Jady S\.[^]*Sala de Deivid[^]*Deivid L\./);
  // Na Praça: só Bia (e eu).
  r("escritorioIrParaPraca()");
  assert.deepEqual(["1", "2", "3", "4"].map(naCena), [true, false, true, false]);
});

test("quartos: a camada de cada cena é a dela, em coordenadas locais; a pintura do dono vale dentro do quarto", () => {
  const { r } = cenaDoEscritorio();
  // No meu quarto: a mobília padrão da sala-0, toda dentro dos 8×8 e só dela.
  const meus = r("escritorioMoveisAtuais()");
  assert.ok(meus.length > 5);
  assert.ok(meus.every((m) => m[6].camada === "sala-0" && m[1] >= 0 && m[1] < 8 && m[2] >= 0 && m[2] < 8));
  // Na Praça: a camada "geral" (de quem administra), em coordenadas da Praça.
  r("escritorioIrParaPraca()");
  const geral = r("escritorioMoveisAtuais()");
  assert.ok(geral.length > 20 && geral.every((m) => m[6].camada === "geral" && m[1] < 22 && m[2] < 18));
  assert.equal(r("escritorioPlantaDaCena().quarto"), "praca");
  assert.deepEqual({ ...r('escritorioCantoCamada("geral")') }, { x: 0, y: 0, w: 22, h: 18 });
  // No quarto do Deivid: a arrumação salva dele (uma planta), em coordenadas locais,
  // e o piso pintado por ele (código 5 em todos os ladrilhos) é lido pela cena.
  r('escritorioEntrarNoQuarto("sala-3")');
  assert.equal(r("JSON.stringify(escritorioMoveisAtuais().map((m) => m.slice(0, 3)))"), JSON.stringify([["exe_plant", 1, 1]]));
  const P = r("escritorioPlantaDaCena()");
  assert.equal(P.quarto, "sala-3");
  assert.equal(P.pisoLadrilho(2, 2), "preto");
  assert.equal(P.pisoLadrilho(12, 12), undefined);
  // O editor da sala trabalha no canto (0, 0) do quarto; os trechos de parede
  // existem no fundo e na esquerda e não no vão da porta.
  assert.deepEqual({ ...r('escritorioCantoCamada("sala-3")') }, { x: 0, y: 0, w: 8, h: 8 });
  assert.ok(r('escritorioTemParede(0, 0, "x") && escritorioTemParede(0, 0, "y")'));
  const a = r('ESCRITORIO_PLANTA.ambientes.find((q) => q.id === "sala-3")');
  assert.ok(r("escritorioTrechoExiste(ESCRITORIO_PLANTA.ambientes.find((q) => q.id === 'sala-3'), 0)"), "fundo");
  assert.ok(!r(`escritorioTrechoExiste(ESCRITORIO_PLANTA.ambientes.find((q) => q.id === 'sala-3'), ${a.porta === "baixo" ? 2 * 20 + 3 : 3 * 20 + 3})`), "o vão da porta não é parede (trechos em grade de 20)");
});

test("planta nova: a Praça salva antes dela não vale; a salva depois vale", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  const padrao = vm.runInContext("escritorioMoveisDaCena(ESCRITORIO_PRACA).length", c);
  vm.runInContext('escritorio.base = { ...(escritorio.base || {}), mapa: { camadas: { geral: { itens: [["exe_plant", 1, 1, 2]], versao: 4, em: "2026-10-10T12:00:00Z" } } } }', c);
  assert.equal(vm.runInContext('escritorioItensDaCamada("geral").length', c), padrao);
  vm.runInContext('escritorio.base.mapa.camadas.geral.em = "2027-01-01T00:00:00Z"', c);
  assert.equal(vm.runInContext('escritorioItensDaCamada("geral").length', c), 1);
});

test("planta nova: arrumação da sala salva antes dela também não vale; a salva depois vale", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  vm.runInContext('escritorio.base = { ...(escritorio.base || {}), mapa: { camadas: { "sala-0": { itens: [["exe_plant", 9, 9, 0]], versao: 2, em: "2026-10-16T12:00:00Z" } } } }', c);
  const padrao = vm.runInContext("escritorioMoveisDaSala(ESCRITORIO_PLANTA.ambientes[0]).length", c);
  assert.equal(vm.runInContext('escritorioItensDaCamada("sala-0").length', c), padrao);
  vm.runInContext('escritorio.base.mapa.camadas["sala-0"].em = "2027-01-01T00:00:00Z"', c);
  assert.equal(vm.runInContext('escritorioItensDaCamada("sala-0").length', c), 1);
});

test("planta nova passa na auditoria (colisões, portas, acessos)", () => {
  const r = spawnSync(process.execPath, ["scripts/escritorio-auditar.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("salas individuais: 9 iguais de 8×8, porta embaixo ou à direita, e o dono vem do servidor", () => {
  const { c } = inicioDoEscritorio({ entrada: baseConfigurada() });
  const salas = vm.runInContext("ESCRITORIO_PLANTA.ambientes.filter((a) => a.pessoal).map((a) => [a.x1 - a.x0, a.y1 - a.y0, a.porta])", c);
  assert.equal(salas.length, 9);
  assert.ok(salas.every(([w, h, porta]) => w === 8 && h === 8 && ["baixo", "direita"].includes(porta)));
  // A entrada de cada sala fica dentro dela, do lado da porta.
  for (let i = 0; i < 9; i++) {
    const r = vm.runInContext(`(() => { const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === "sala-${i}"); const e = escritorioEntradaDaSala(a); return [e.x >= a.x0 && e.x < a.x1 && e.y >= a.y0 && e.y < a.y1, a.porta === "direita" ? e.x === a.x1 - 2 : e.y === a.y1 - 2]; })()`, c);
    assert.deepEqual([...r], [true, true], "sala-" + i); // array da sandbox: compara pelos valores
  }
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
  return (de, para, evitar = null, limite = Infinity) => { c.de = de; c.para = para; c.evitar = evitar; c.limite = limite; return vm.runInContext("mapaCaminho(g, de, para, evitar, limite)", c); };
}

test("caminho do clique desvia de sala trancada e de pessoa parada; busca curta desiste no limite", () => {
  // Corredor de uma linha (y=1) fechado por paredes em y=1|2: só dá para
  // passar reto. Uma pessoa em (3,1) bloqueia; sem ela, passa.
  const caminho = gradeDeTeste([], [[0, 2, 8, 2]]);
  {
    const livre = caminho({ x: 1, y: 1 }, { x: 6, y: 1 });
    assert.ok(livre && livre.length === 5);
    const pessoa = (x, y) => x === 3 && y === 1;
    const desvio = caminho({ x: 1, y: 1 }, { x: 6, y: 1 }, pessoa);
    assert.ok(desvio && desvio.length >= 5, "dá a volta por cima (em diagonal, sem passo a mais)");
    assert.ok(!desvio.some((p) => p.x === 3 && p.y === 1), "não pisa na pessoa");
    // Linha de cima também ocupada: não há caminho.
    assert.equal(caminho({ x: 1, y: 1 }, { x: 6, y: 1 }, (x, y) => x === 3 && y <= 1), null);
    // Destino sobre o obstáculo também não.
    assert.equal(caminho({ x: 1, y: 1 }, { x: 3, y: 1 }, pessoa), null);
    // Limite de custo: 3 passos não chegam a 5 ladrilhos de distância.
    assert.equal(caminho({ x: 1, y: 1 }, { x: 6, y: 1 }, null, 3), null);
    assert.ok(caminho({ x: 1, y: 1 }, { x: 3, y: 1 }, null, 3));
  }
});

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
  assert.equal(salas.length, 9);
  assert.equal(salas[0].pessoa_id, "1");
  assert.equal(salas.find((s) => s.dono === "Bia").pessoa_id, "2");
  assert.equal(salas.find((s) => s.dono === "Mizinho").pessoa_id, "3");
  assert.ok(!salas.some((s) => s.pessoa_id === "4"));
  assert.equal(salas.filter((s) => !s.dono).length, 0);
});

test("itens: fora da área, classe estranha ou direção inválida são recusados", () => {
  assert.throws(() => itensValidos("sala-0", [["exe_table", 20, 2, 0]]), /fora/);
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
  await ev(dona, "zone:admit", { zona: "sala-0", id: "<x>" });
  assert.ok(!room.trancas.get("sala-0").has("<x>"), "só id numérico de pessoa entra na lista");
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
  // Grade de 20 × 20 (o maior quarto): 400 ladrilhos e 80 trechos de parede
  // (20 por lado). As antigas, de 8 × 8 e de 12 × 12, valem ampliadas.
  const ok = perfilEscritorio({ sala_pisos: "0".repeat(399) + "b", sala_paredes: "c02".repeat(79) + "hd0" });
  assert.equal(ok.sala_pisos.length, 400);
  assert.equal(ok.sala_paredes.length, 240);
  const ruim = perfilEscritorio({ sala_pisos: "z".repeat(400), sala_paredes: "c03".repeat(80) });
  const legado=perfilEscritorio({sala_pisos:"1".repeat(8)+"2".repeat(56),sala_paredes:"c02".repeat(8)+"hd0".repeat(24)});
  assert.equal(legado.sala_pisos,"1".repeat(8)+"0".repeat(12)+("2".repeat(8)+"0".repeat(12)).repeat(7)+"0".repeat(240));
  assert.equal(legado.sala_paredes,"c02".repeat(8)+"-00".repeat(12)+("hd0".repeat(8)+"-00".repeat(12)).repeat(3));
  const doze=perfilEscritorio({sala_pisos:"3".repeat(144)});
  assert.equal(doze.sala_pisos,("3".repeat(12)+"0".repeat(8)).repeat(12)+"0".repeat(160));
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
  // Sem RealtimeKit configurado, o erro carrega status e código (a rota
  // responde 503, não 500 genérico).
  await assert.rejects(prepararChamadaEscritorio(sql, pessoa, "escritorio", {}), (e) => e.status === 503 && e.code === "realtimekit_unconfigured");
  // Cloudflare recusou: o status dela vai junto.
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ success: false, errors: [{ message: "Limite" }] }) });
  await assert.rejects(prepararChamadaEscritorio(sql, { id: 2, nome: "Jady" }, "cafe", env), (e) => e.status === 429 && /Limite/.test(e.message));
});

test("API: pedir chamada sem RealtimeKit responde 503 com o código do erro", async (t) => {
  const { db, sql } = await banco();
  t.after(() => db.close());
  let status, body;
  const res = { status(n) { status = n; return this; }, json(d) { body = d; return d; } };
  const antes = { ...process.env };
  delete process.env.CLOUDFLARE_ACCOUNT_ID; delete process.env.REALTIMEKIT_APP_ID; delete process.env.CLOUDFLARE_REALTIME_API_TOKEN;
  t.after(() => { Object.assign(process.env, antes); });
  await areaEscritorio({ method: "POST", body: { acao: "chamada", sala: "escritorio" } }, res, { tipo: "sessao", pessoa: { id: 1, nome: "Paulo" } }, sql);
  assert.equal(status, 503);
  assert.equal(body.code, "realtimekit_unconfigured");
  await areaEscritorio({ method: "POST", body: { acao: "chamada", sala: "<x>" } }, res, { tipo: "sessao", pessoa: { id: 1, nome: "Paulo" } }, sql);
  assert.equal(status, 400);
  assert.match(body.error, /Sala inválida/);
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

// Criação do quarto: a regra "a decoração atual cabe na planta?" do navegador
// é um espelho da do servidor (ao preservar, sem medidas). Divergir deixaria
// a pessoa presa no fim com "há móveis fora da planta".
test("criação do quarto: o aviso de 'cabe' do navegador bate com a regra do servidor e decide se preserva", async () => {
  const { QUARTOS, validarPisoQuarto } = await import("../server/escritorio-quartos.js");
  const c = vm.createContext({
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) }, document: { getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {}, addEventListener() {}, append() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { append() {} } },
    location: { search: "" }, URLSearchParams, localStorage: { getItem: () => null, setItem() {} }, safeText: (v) => String(v),
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  });
  for (const f of ["vybe-escritorio-planta.js", "vybe-escritorio-mapa.js", "vybe-escritorio.js", "vybe-escritorio-ficha.js", "vybe-escritorio-abertura.js"]) vm.runInContext(readFileSync(f, "utf8"), c);
  const layouts = {
    canto: [["exe_plant", 0, 0, 0, 0, 0]], meio: [["exe_table", 4, 4, 0, 0, 0]], escada: [["hc26_10", 3, 3, 0, 0, 0]],
    espalhado: [["exe_table", 2, 2, 0], ["hc26_10", 7, 7, 0], ["books_0", 0, 7, 2, 0, 1]],
  };
  for (const [nome, itens] of Object.entries(layouts)) for (const p of QUARTOS.plantas) {
    c.base = { eu: "1", equipe: [{ id: "1", nome: "Paulo", perfil: {} }], salas: [{ id: "sala-0", dono: "Paulo", pessoa_id: "1" }], quartos: QUARTOS, mapa: { camadas: { "sala-0": { itens, versao: 1, em: "2027-01-01T00:00:00Z" } } } };
    vm.runInContext("escritorio.base = base; escritorio.perfil = {}; escritorioAplicarSalas();", c);
    let servidor = true;
    try { validarPisoQuarto(p.id, itens); } catch { servidor = false; }
    assert.equal(vm.runInContext(`criadorDecoracaoCabe("${p.id}")`, c), servidor, `${nome} em ${p.id}`);
    // Ao abrir o criador, "manter a decoração" só vem marcado quando cabe.
    vm.runInContext(`escritorio.perfil = { sala_planta: "${p.id}" }; criador.etapa = "planta"; criador.planta = "${p.id}"; criador.preservar = criadorDecoracaoAtual().length > 0 && criadorDecoracaoCabe(criador.planta);`, c);
    assert.equal(vm.runInContext("criador.preservar", c), servidor, `preservar: ${nome} em ${p.id}`);
  }
  // Trocar de planta recalcula; escolher um modelo desliga a preservação.
  c.base = { eu: "1", equipe: [{ id: "1", nome: "Paulo", perfil: {} }], salas: [{ id: "sala-0", dono: "Paulo", pessoa_id: "1" }], quartos: QUARTOS, mapa: { camadas: { "sala-0": { itens: layouts.canto, versao: 1, em: "2027-01-01T00:00:00Z" } } } };
  vm.runInContext("escritorio.base = base; escritorio.perfil = {}; escritorioAplicarSalas(); renderAberturaEscritorio = () => {};", c);
  vm.runInContext("criadorQuartoEscolher('planta', 'amplo')", c);
  assert.equal(vm.runInContext("criador.preservar", c), true);
  vm.runInContext("criadorQuartoEscolher('planta', 'compacto')", c);
  assert.equal(vm.runInContext("criador.preservar", c), false, "o canto (0,0) não existe na planta compacta");
  vm.runInContext("criadorQuartoEscolher('planta', 'amplo'); criadorQuartoEscolher('modelo', 'trabalho')", c);
  assert.deepEqual([vm.runInContext("criador.preservar", c), vm.runInContext("criador.modelo", c)], [false, "trabalho"]);
  vm.runInContext("criadorQuartoEscolher('modelo', 'atual')", c);
  assert.equal(vm.runInContext("criador.preservar", c), true);
});

// Camadas como no Nitro: a da frente de quem senta é a de profundidade menor
// que a do boneco sentado (−0,01). Cadeira norja virada para o fundo (0): o
// encosto (z 30) cobre quem senta; virada para a frente (2, z −31), não.
test("camada do móvel na frente de quem senta segue a profundidade do Nitro", () => {
  const c = vm.createContext({ window: {}, document: {} });
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  const prof = (z, i) => vm.runInContext(`mapaProfCamada(${z}, ${i})`, c);
  const sentado = vm.runInContext("MAPA_PROF_SENTADO", c);
  const norja = JSON.parse(readFileSync("assets/escritorio/habbo/chair_norja.json", "utf8")).visualizations.find((v) => v.size === 64);
  assert.ok(prof(norja.directions[0].layers[0].z, 0) < sentado, "de costas: encosto na frente");
  assert.ok(prof(norja.directions[2].layers[0].z, 0) > sentado, "de frente: encosto atrás");
  const exe = JSON.parse(readFileSync("assets/escritorio/habbo/exe_chair.json", "utf8")).visualizations.find((v) => v.size === 64);
  assert.ok(prof(exe.layers[1].z, 1) < sentado && prof(0, 0) > sentado, "poltrona executiva: braços na frente, assento atrás");
});

// Wired do Habbo: a configuração (7º campo) só vale nos móveis de gatilho e
// tem limites conferidos no servidor.
test("gatilho guarda móveis, texto e tempo só nos móveis de gatilho", async () => {
  const { itensValidos } = await import("../server/escritorio-mapa.js");
  const [g] = itensValidos("sala-0", [["wf_trg_walks_on_furni", 1, 1, 0, 0, 0, { m: [[2, 3]], t: " oi ", s: 10, x: "ignorado" }]]);
  assert.deepEqual(g[6], { m: [[2, 3]], t: "oi", s: 10 });
  assert.deepEqual(itensValidos("sala-0", [["wf_act_toggle_state", 1, 1, 0, 0, 0, { m: [[2, 3, "hc_lmp"]] }]])[0][6], { m: [[2, 3, "hc_lmp"]] });
  assert.throws(() => itensValidos("sala-0", [["wf_act_toggle_state", 1, 1, 0, 0, 0, { m: [[2, 3, "<x>"]] }]]), /inválido/);
  assert.equal(itensValidos("sala-0", [["exe_table", 1, 1, 0, 0, 0, { m: [[2, 3]] }]])[0].length, 6, "móvel comum descarta o campo");
  assert.throws(() => itensValidos("sala-0", [["wf_act_toggle_state", 1, 1, 0, 0, 0, { m: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] }]]), /No máximo 5/);
  assert.throws(() => itensValidos("sala-0", [["wf_act_toggle_state", 1, 1, 0, 0, 0, { m: [[25, 0]] }]]), /fora da área/);
  assert.throws(() => itensValidos("sala-0", [["wf_trg_periodically", 1, 1, 0, 0, 0, { s: 0 }]]), /entre 1 e 60/);
  assert.throws(() => itensValidos("sala-0", [["wf_act_show_message", 1, 1, 0, 0, 0, { t: "x".repeat(101) }]]), /100 letras/);
});

// Pilha do Wired: pisar no móvel escolhido alterna o móvel escolhido (a
// luminária, não a mesa do mesmo ladrilho); a
// condição "quem disparou está no móvel" barra quando não está.
test("pilha de gatilho, condição e efeito roda como no Habbo", () => {
  const trocas = [];
  const moveis = [{ classe: "exe_table", x: 5, y: 5, estado: 0, dim: { x: 1, y: 1 } }, { classe: "hc_lmp", x: 5, y: 5, estado: 0, dim: { x: 1, y: 1 } }, { classe: "rug", x: 2, y: 2, dim: { x: 1, y: 1 } }];
  const c = vm.createContext({
    console, Math, Date, String, Number, Boolean, setInterval() {}, setTimeout() {}, document: undefined,
    movimento: { quadro: 0, x: 2, y: 2, rota: [] },
    escritorio: { base: { eu: "1" }, online: [], mapa: { moveisEm: (x, y) => moveis.filter((m) => m.x === x && m.y === y), chaveMovel: (m) => m.classe + "@" + m.x + "," + m.y, estadosMoveis: (l) => trocas.push(...l) } },
    escritorioItensDaCamada: () => itens,
    escritorioPosicao: () => ({ x: 2, y: 2 }), escritorioNaCena: () => true, escritorioEstadosDoMovel: () => [0, 1],
    escritorioEmitir() {}, escritorioAviso() {}, escritorioTocar() {}, escritorioEnviarPosicao() {},
  });
  let itens = [["wf_trg_walks_on_furni", 0, 0, 0, 0, 0, { m: [[2, 2]] }], ["wf_act_toggle_state", 0, 0, 0, 0, 0.65, { m: [[5, 5, "hc_lmp"]] }]];
  vm.runInContext(readFileSync("vybe-escritorio-gatilhos.js", "utf8"), c);
  vm.runInContext("gatilhoPassoEscritorio('1,2', 2, 2)", c);
  assert.equal(JSON.stringify(trocas.filter(([k]) => k.startsWith("hc_lmp"))), JSON.stringify([["hc_lmp@5,5", 1]]));
  trocas.length = 0;
  itens = [...itens, ["wf_cnd_trggrer_on_frn", 0, 0, 0, 0, 1.3, { m: [[9, 9]] }]];
  vm.runInContext("gatilhoPassoEscritorio('1,2', 2, 2)", c);
  assert.equal(trocas.filter(([k]) => k.startsWith("hc_lmp")).length, 0, "condição barra");
});

// Planta de alturas e caminho como no Habbo: alturas 1–35 nos códigos da
// planta, sobe-se até 1,5 (até 2 para um assento), desce-se de qualquer
// altura, e a diagonal passa rente a um móvel (só barra com os dois lados fechados).
test("planta de alturas e caminho seguem o Habbo", () => {
  const c = vm.createContext({ window: {}, document: {} });
  vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8"), c);
  assert.equal(vm.runInContext('[escritorioNivelDoCodigo("p"), escritorioNivelDoCodigo("9"), escritorioNivelDoCodigo("A"), escritorioNivelDoCodigo("Z"), escritorioNivelDoCodigo("v")].join()', c), "0,9,10,35,-1");
  assert.equal(vm.runInContext('escritorioCodigoDoNivel(12)', c), "C");
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  const niveis = [[0, 2, 0], [0, 0, 0], [0, 0, 0]];
  c.g = { W: 3, H: 3, ind: (x, y) => y * 3 + x, bloqueado: new Uint8Array(9), subida: new Float32Array(9), paredes: new Set(), aresta: () => "", assento: new Map(), cama: new Map(), nivelEm: (x, y) => niveis[y][x], alturaEm: (x, y) => niveis[y][x] };
  assert.equal(vm.runInContext("mapaPassa(g, 0, 0, 1, 0)", c), false, "não sobe 2 blocos de uma vez");
  assert.equal(vm.runInContext("mapaPassa(g, 1, 0, -1, 0)", c), true, "desce de qualquer altura");
  vm.runInContext("g.bloqueado[g.ind(1, 1)] = 1", c);
  assert.equal(vm.runInContext("mapaPassa(g, 0, 1, 1, 1)", c), true, "diagonal rente a um móvel");
  vm.runInContext("g.bloqueado[g.ind(0, 2)] = 1", c);
  assert.equal(vm.runInContext("mapaPassa(g, 0, 1, 1, 1)", c), false, "com os dois lados fechados, não");
  vm.runInContext("g.assento.set(g.ind(1, 0), 4)", c);
  assert.equal(vm.runInContext("mapaPassa(g, 0, 0, 1, 0)", c), true, "chega ao assento 2 blocos acima");
});

// Números por camada como no Nitro: relógio de partida em minutos:segundos,
// placar e votos em unidades, dezenas e centenas.
test("dígitos do relógio, do placar e dos votos seguem o Nitro", () => {
  const c = vm.createContext({ window: {}, document: {} });
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  const d = (tag, n) => vm.runInContext(`MAPA_DIGITOS[${JSON.stringify(tag)}](${n})`, c);
  assert.deepEqual([d("ten_minutes_sprite", 125), d("minutes_sprite", 125), d("ten_seconds_sprite", 125), d("seconds_sprite", 125)], [0, 2, 0, 5]);
  assert.deepEqual([d("hundreds_sprite", 437), d("tens_sprite", 437), d("ones_sprite", 437)], [4, 3, 7]);
  const f = JSON.parse(readFileSync("assets/escritorio/habbo/fisica.json", "utf8"));
  assert.equal(f.tent_blue[3], "pisar"); assert.equal(f.fball_counter[3], "relogio"); assert.equal(f.tile_stackmagic[3], "altura");
});

test("manequim guarda um visual válido e o cadeado do amor aceita dedicatória", async () => {
  const { itensValidos } = await import("../server/escritorio-mapa.js");
  const [m] = itensValidos("sala-1", [["boutique_mannequin1", 1, 1, 2, 0, 0, { f: "hd-180-1.hr-100-61", x: 1 }]]);
  assert.deepEqual(m[6], { f: "hd-180-1.hr-100-61" });
  assert.throws(() => itensValidos("sala-1", [["boutique_mannequin1", 1, 1, 2, 0, 0, { f: "<script>" }]]), /manequim/);
  const [c] = itensValidos("sala-1", [["val14_lovelock1", 1, 1, 2, 0, 0, { n: "Ana e Bia", t: "Pra sempre", d: "2026-10-18" }]]);
  assert.equal(c[6].n, "Ana e Bia");
  const [s] = itensValidos("sala-1", [["chair_norja", 1, 1, 2, 0, 0, { f: "hd-180-1" }]]);
  assert.equal(s.length, 6, "cadeira não guarda visual");
});

test("peça de parede vem da ficha do Habbo (wallitemtypes), não da forma da arte", () => {
  const c = vm.createContext({ console });
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8"), c);
  vm.runInContext(`MAPA_FISICA = ${readFileSync("assets/escritorio/habbo/fisica.json", "utf8")};`, c);
  const quadro = JSON.parse(readFileSync("assets/escritorio/habbo/attic15_painting.json", "utf8"));
  const escudo = { visualizations: [{ size: 64, directions: { 2: {}, 4: {} } }], logic: { model: { dimensions: { x: 2, y: 1, z: 1 } } } };
  c.quadro = quadro; c.escudo = escudo;
  assert.equal(vm.runInContext("mapaEhDeParede(quadro, 'attic15_painting')", c), true);
  // Profundidade 1 enganava a regra antiga (só ≤ 0,3 contava como parede).
  assert.equal(vm.runInContext("mapaEhDeParede(escudo, 'vikings_wallshield_r')", c), true);
  assert.equal(vm.runInContext("mapaEhDeParede(escudo, 'chair_norja')", c), false, "na ficha como móvel de chão");
});
