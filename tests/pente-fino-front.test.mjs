// SAFE: pente fino no front-end (27/11/2026). Cada teste prova uma correção da varredura: o segundo clique dado no meio
// de uma troca de tela não se perde; os !important do legado que venciam o padrão v2 saíram. Só lê arquivos e roda funções com um DOM de mentira; não abre navegador, não chama o
// servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const core = ler('vybe-core.js');
const bloco = core.slice(core.indexOf('// ── SISTEMA FLUIDO'));

// Um navegador de mentira em que a transição fica parada até o teste mandar seguir (como no processador lento, em que a
// foto da tela e a troca levam quase um segundo).
function ambiente() {
  const vts = [];
  const html = { dataset: {} };
  const document = { hidden: false, documentElement: html, querySelector: () => null, querySelectorAll: () => [] };
  document.startViewTransition = (f) => {
    let rodar; const pronto = new Promise((r) => { rodar = r; });
    const feito = pronto.then(() => f());
    const t = { pulos: 0, seguir: () => rodar(), skipTransition() { t.pulos++; rodar(); }, updateCallbackDone: feito, finished: feito.then(() => {}) };
    vts.push(t); return t;
  };
  const c = vm.createContext({
    document, URL, Promise, Date, JSON, Math, Set, Map,
    MouseEvent: class { constructor(tipo, ini) { this.type = tipo; Object.assign(this, ini); } },
    matchMedia: () => ({ matches: false }),
    setTimeout: (f) => { f(); return 0; }, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (f) => f(),
  });
  vm.runInContext(`let vbVoando = false;\n${bloco}`, c);
  return { c, document, html, vts };
}
const clique = (alvo, xy = [10, 20]) => {
  const e = { isTrusted: true, button: 0, target: alvo, defaultPrevented: false, parou: false, clientX: xy[0], clientY: xy[1] };
  e.preventDefault = () => { e.defaultPrevented = true; };
  e.stopImmediatePropagation = () => { e.parou = true; };
  return e;
};
const item = (id) => { const el = { dataset: { submodulo: id }, recebidos: 0, matches: () => false }; el.closest = (s) => (s.includes('[data-submodulo]') ? el : null); el.dispatchEvent = () => { el.recebidos++; }; return el; };
const solto = () => new Promise((ok) => setImmediate(ok));

test('menu: o segundo clique no meio da troca pula a troca de antes e a tela fica na última escolha', async () => {
  const { c, vts } = ambiente();
  const a = item('carteira'), b = item('onboarding');
  const ea = clique(a); c.vbInterceptarClique(ea);
  assert.ok(ea.defaultPrevented, 'o primeiro clique entra na transição');
  assert.equal(vts.length, 1);
  const eb = clique(b); c.vbInterceptarClique(eb);
  assert.ok(!eb.defaultPrevented && !eb.parou, 'o segundo clique segue direto para quem trata dele');
  assert.equal(vts[0].pulos, 1, 'a troca de antes foi pulada');
  await solto(); await solto();
  assert.equal(a.recebidos, 0, 'a troca pulada não repassa mais o primeiro clique depois do segundo');
});

test('clique que cai na foto da transição (no <html>) chega, quando a foto sai, ao que está debaixo do ponteiro', async () => {
  const { c, document, html, vts } = ambiente();
  const a = item('reunioes'), b = item('clientes');
  const pontos = []; document.elementFromPoint = (x, y) => { pontos.push([x, y]); return b; };
  c.vbInterceptarClique(clique(a));
  const naFoto = clique(html, [120, 340]); c.vbInterceptarClique(naFoto);
  assert.ok(naFoto.defaultPrevented && naFoto.parou, 'o clique no <html> não vaza para quem fecha coisas "ao clicar fora"');
  assert.equal(vts[0].pulos, 1);
  await solto(); await solto(); await solto();
  assert.deepEqual(pontos, [[120, 340]], 'procura o elemento no mesmo ponto do clique');
  assert.equal(b.recebidos, 1, 'o item debaixo do ponteiro recebeu o clique uma vez');
  assert.equal(a.recebidos, 0, 'a primeira escolha não volta por cima');
});

test('sem troca em andamento, clique no <html> e clique no menu seguem como antes', async () => {
  const { c, html, vts } = ambiente();
  const e = clique(html); c.vbInterceptarClique(e);
  assert.ok(!e.defaultPrevented, 'clique solto no <html> não é segurado');
  const a = item('midia'); const ea = clique(a); c.vbInterceptarClique(ea);
  assert.ok(ea.defaultPrevented); vts[0].seguir(); await solto(); await solto();
  assert.equal(a.recebidos, 1, 'a troca normal repassa o clique uma vez');
});

const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const mundo = semComentario(ler('vybe-mundo.css'));
const v2 = semComentario(ler('vybe-mundo-padrao-v2.css'));

test('rótulos do menu largo (Operação, Negócio, Time, Vybe): o cinza antigo não vence mais a cor do tema', () => {
  // Antes: color:#6B665E!important pintava os rótulos de cinza escuro sobre o menu fumê e escuro (contraste ~3:1).
  assert.ok(mundo.includes('body.trilho-largo .vv-trilho-grupo{color:#6B665E}'), 'a regra antiga continua, sem !important');
  assert.doesNotMatch(mundo, /\.vv-trilho-grupo\{[^}]*color:[^;}]*!important/, 'nenhuma cor com !important no rótulo');
  assert.match(v2, /body\.mundo\.trilho-largo #mundo-hud \.vv-trilho \.vv-trilho-grupo\{[^}]*color:var\(--d3-fume-apagado\)/, 'a cor do tema vem do padrão v2');
});

test('Gestão de clientes: o nome do cliente não some na lista estreita (menu largo em 1366)', () => {
  // Antes: as colunas fixas somavam ~730 px; numa lista de 704 px o nome (flex 1 1 0) ficava com 0 px.
  const base = (re) => Number(v2.match(re)?.[1]);
  const col = {
    grupo: base(/#painel-clientes \.cv2-grupo\{flex:0 0 (\d+)px/), foto: base(/#painel-clientes \.cv2-th-foto\{flex:0 0 (\d+)px/),
    hd: base(/:is\(\.cv2-hd,\.cv2-h-head\)\{flex:0 0 (\d+)px/), sa: base(/:is\(\.cv2-tr > \.cv2-sa,\.cv2-h-saude\)\{flex:0 0 (\d+)px/),
    ab: base(/:is\(\.cv2-ab,\.cv2-h-abertos\)\{flex:0 0 (\d+)px/), re: base(/:is\(\.cv2-re,\.cv2-h-reuniao\)\{flex:0 0 (\d+)px/),
    cd: base(/:is\(\.cv2-cd,\.cv2-h-cadastro\)\{flex:0 0 (\d+)px/), vai: 14,
  };
  for (const [k, n] of Object.entries(col)) assert.ok(n > 0, `largura da coluna ${k} encontrada`);
  const gap = 10, lados = 32;
  const nome = (largura, fora) => { const c = Object.entries(col).filter(([k]) => !fora.includes(k)); return largura - lados - c.reduce((s, [, n]) => s + n, 0) - gap * c.length; };
  assert.ok(nome(704, []) <= 0, 'sem a regra nova o nome não cabia em 704 px (é o bug)');
  assert.match(v2, /#painel-clientes \.cv2-tabela\{container:cv2lista \/ inline-size\}/);
  assert.match(v2, /@container cv2lista \(max-width:900px\)\{\s*#painel-clientes :is\(\.cv2-re,\.cv2-h-reuniao,\.cv2-extra\)\{display:none\}/);
  assert.match(v2, /@container cv2lista \(max-width:780px\)\{\s*#painel-clientes :is\(\.cv2-tr > \.cv2-cd,\.cv2-h-cadastro\)\{display:none\}/);
  assert.ok(nome(704, ['re', 'cd']) >= 140, 'em 704 px, sem Reunião e Cadastro, o nome tem pelo menos 140 px');
  assert.ok(nome(781, ['re']) >= 120, 'logo acima de 780 px, só sem a Reunião, o nome tem pelo menos 120 px');
  assert.ok(nome(901, []) >= 160, 'acima de 900 px todas as colunas voltam e o nome continua com espaço');
});

test('tempo do topo com o serviço fora: uma consulta só, e não uma a cada volta ao Hoje', async () => {
  const topo = ler('vybe-topo.js');
  const trecho = topo.slice(topo.indexOf('const TOPO_TEMPO_FALHOU'), topo.indexOf('async function pintarTempoDoTopo'));
  let consultas = 0, agora = 1_000_000, resposta = { ok: false, status: 429 };
  const c = vm.createContext({ JSON, Math, Number, Map, Error, Promise, Date: { now: () => agora },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => { consultas++; return { ...resposta, json: async () => ({ current: { temperature_2m: 31.4, weather_code: 1 } }) }; } });
  vm.runInContext(trecho, c);
  const lugar = { lat: -11.3042, lon: -41.8558 };
  for (let i = 0; i < 4; i++) await assert.rejects(c.buscarTempoDoTopo(lugar));
  assert.equal(consultas, 1, 'falhou uma vez e esperou, em vez de consultar de novo a cada abertura do portão');
  agora += 11 * 60 * 1000; resposta = { ok: true, status: 200 };
  const t = await c.buscarTempoDoTopo(lugar);
  assert.equal(consultas, 2, 'passados 10 minutos, tenta de novo');
  assert.equal(t.grau, 31);
});
