// SAFE: sistema fluido (27/11/2026) — a troca de tela passa por um ponto só (vbTrocarTela em vybe-core.js): com View
// Transitions o que foi clicado vira a tela seguinte; sem suporte ou com "menos movimento", troca na hora, igual antes.
// A pré-busca não repete pedido, o intervalo dorme com a aba escondida, e o kicker com botão é marcado pelo JS (a regra
// :has que fazia o navegador recalcular o body inteiro a cada botão novo saiu). Só lê arquivos e roda funções com um
// DOM de mentira; não abre navegador, não chama o servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const core = ler('vybe-core.js');
const bloco = core.slice(core.indexOf('// ── SISTEMA FLUIDO'));
const folhas = ['vybe-mundo.css', 'vybe-mundo-padrao-v2.css'].map(ler).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

function ambiente({ vt = true, menosMovimento = false, escondida = false } = {}) {
  const chamadas = { vt: 0, timers: new Map(), proximo: 1 };
  const document = {
    hidden: escondida,
    documentElement: { dataset: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  if (vt) document.startViewTransition = (f) => {
    chamadas.vt++;
    const feito = Promise.resolve().then(f);
    return { updateCallbackDone: feito, finished: feito.then(() => {}) };
  };
  const c = vm.createContext({
    document, URL, Promise, Date, JSON, Math, Set, Map, MouseEvent: class {},
    matchMedia: (q) => ({ matches: menosMovimento && /reduce/.test(q) }),
    setTimeout: (f) => { f(); return 0; },
    setInterval: (f, ms) => { const id = chamadas.proximo++; chamadas.timers.set(id, { f, ms }); return id; },
    clearInterval: (id) => { chamadas.timers.delete(id); },
  });
  vm.runInContext(`let vbVoando = false;\n${bloco}`, c);
  return { c, document, chamadas };
}
const clique = (alvo) => {
  const e = { isTrusted: true, button: 0, target: alvo, defaultPrevented: false, parou: false };
  e.preventDefault = () => { e.defaultPrevented = true; };
  e.stopImmediatePropagation = () => { e.parou = true; };
  return e;
};
const itemDoTrilho = (dataset) => ({ dataset, matches: () => false, closest: (s) => (s.includes('[data-trilho]') ? itemDoTrilho.atual : null) });

test('sem suporte a View Transitions: a troca acontece na hora e o clique segue para quem trata dele', async () => {
  const { c, chamadas } = ambiente({ vt: false });
  let trocou = 0;
  const r = c.vbTrocarTela(() => { trocou++; }, { tipo: 'tela' });
  assert.equal(trocou, 1, 'trocou sem esperar nada');
  assert.equal(await r, false);
  assert.equal(chamadas.vt, 0);
  const el = itemDoTrilho({ trilho: 'clientes' }); itemDoTrilho.atual = el;
  const e = clique(el); c.vbInterceptarClique(e);
  assert.ok(!e.defaultPrevented && !e.parou, 'o clique não foi segurado');
});

test('com "menos movimento" (prefers-reduced-motion) não há transição; com suporte, há uma só por troca', async () => {
  const quieto = ambiente({ menosMovimento: true });
  let n = 0; await quieto.c.vbTrocarTela(() => { n++; });
  assert.equal(n, 1); assert.equal(quieto.chamadas.vt, 0);
  const el = itemDoTrilho({ trilho: 'clientes' }); itemDoTrilho.atual = el;
  const e = clique(el); quieto.c.vbInterceptarClique(e);
  assert.ok(!e.defaultPrevented, 'com menos movimento o clique segue direto');

  const vivo = ambiente();
  let m = 0; const r = vivo.c.vbTrocarTela(() => { m++; }, { tipo: 'tela' });
  assert.equal(vivo.document.documentElement.dataset.vbVoo, 'tela', 'a folha sabe que tipo de troca é');
  assert.equal(await r, true); assert.equal(m, 1); assert.equal(vivo.chamadas.vt, 1);
  await new Promise((ok) => setImmediate(ok));
  assert.equal(vivo.document.documentElement.dataset.vbVoo, undefined, 'a marca sai quando a troca termina');
  // Com a aba escondida também não anima.
  const atras = ambiente({ escondida: true });
  let k = 0; await atras.c.vbTrocarTela(() => { k++; }); assert.equal(k, 1); assert.equal(atras.chamadas.vt, 0);
});

test('o clique feito pelo código (.click() de atalho ou voz) não é segurado; o de gente é repassado dentro da troca', () => {
  const { c } = ambiente();
  const el = itemDoTrilho({ trilho: 'midia' }); itemDoTrilho.atual = el;
  const doCodigo = clique(el); doCodigo.isTrusted = false; c.vbInterceptarClique(doCodigo);
  assert.ok(!doCodigo.defaultPrevented);
  let repassado = 0; el.dispatchEvent = () => { repassado++; };
  const deGente = clique(el); c.vbInterceptarClique(deGente);
  assert.ok(deGente.defaultPrevented && deGente.parou, 'segurou para repassar dentro da transição');
  return new Promise((ok) => setImmediate(() => { assert.equal(repassado, 1, 'o mesmo clique chegou uma vez'); ok(); }));
});

test('a pré-busca não duplica chamada: pedido igual no ar vira um, e o guardado é usado uma vez', async () => {
  const { c } = ambiente();
  const pedidos = [];
  const resposta = () => ({ ok: true, clone() { return this; } });
  const original = (url) => { pedidos.push(String(url)); return new Promise((ok) => setTimeout(() => ok(resposta()))); };
  const buscar = c.vbEmbrulharFetch(original);
  assert.equal(c.vbPreBuscar('/api/painel?area=clientes', buscar), true);
  assert.equal(c.vbPreBuscar('/api/painel?area=clientes', buscar), false, 'segunda pré-busca igual não pede de novo');
  await buscar('/api/painel?area=clientes', { credentials: 'same-origin', cache: 'no-store' });
  assert.equal(pedidos.length, 1, 'o módulo abriu com o que a pré-busca trouxe');
  await buscar('/api/painel?area=clientes');
  assert.equal(pedidos.length, 2, 'o guardado vale uma vez; depois pede de novo');
  // Dois pedidos iguais ao mesmo tempo viram um.
  let solta; const lento = (url) => { pedidos.push(String(url)); return new Promise((ok) => { solta = () => ok(resposta()); }); };
  const b2 = c.vbEmbrulharFetch(lento);
  const a = b2('/api/painel?area=midia&acao=carteira'), b = b2('/api/painel?area=midia&acao=carteira');
  solta(); await Promise.all([a, b]);
  assert.equal(pedidos.filter((u) => u.includes('midia')).length, 1);
  // Gravar (POST) joga fora o guardado da área; outra origem e outra rota passam direto.
  c.vbPreBuscar('/api/painel?area=financeiro', buscar);
  await buscar('/api/painel?area=financeiro', { method: 'POST', body: '{}' });
  const antes = pedidos.length; await buscar('/api/painel?area=financeiro');
  assert.equal(pedidos.length, antes + 1, 'depois de gravar, o GET vai ao servidor');
  assert.equal(c.vbChaveDoPedido('https://outro.site/api/painel?area=clientes'), '');
  assert.equal(c.vbChaveDoPedido('/api/outra?area=x'), '');
});

test('o intervalo dorme com a aba escondida e com a tela dele fora de vista', () => {
  const { c, document, chamadas } = ambiente();
  let rodou = 0, aVista = true;
  const t = c.vbIntervalo(() => { rodou++; }, 1500, { quando: () => aVista });
  assert.equal(chamadas.timers.size, 1);
  chamadas.timers.values().next().value.f(); assert.equal(rodou, 1);
  aVista = false; chamadas.timers.values().next().value.f(); assert.equal(rodou, 1, 'tela fora de vista: não roda');
  document.hidden = true; c.vbAcordarIntervalos();
  assert.equal(chamadas.timers.size, 0, 'aba escondida: o relógio para de bater');
  document.hidden = false; c.vbAcordarIntervalos(); aVista = true;
  assert.equal(chamadas.timers.size, 1, 'voltou: liga de novo');
  t.parar(); c.vbAcordarIntervalos(); assert.equal(chamadas.timers.size, 0, 'parado não volta');
  const mundo = ler('vybe-mundo.js');
  assert.ok(mundo.includes('(globalThis.vbIntervalo || setInterval)(pintarChamada, 1500)'));
  assert.ok(mundo.includes('if (timer?.parar) timer.parar(); else clearInterval(timer); timer = null;'));
});

test('o kicker com botão é marcado pelo JS e a regra :has que recalculava o body inteiro saiu', () => {
  assert.ok(!/:has\(button,a,input,select\) > :not\(button,a,input,select\)/.test(folhas), 'a regra antiga saiu');
  const lista = folhas.match(/html body\.mundo :is\(([^)]*)\):where\(\.vb-kicker-ctl\):not\(vb-x\) > :not\(/)[1];
  const js = core.match(/const VB_KICKERS = '([^']*)'/)[1];
  assert.equal(lista, js, 'a folha e o JS usam a mesma lista de kickers');
  const ini = core.indexOf('const VB_KICKERS'), fim = core.indexOf("if (typeof document !== 'undefined' && document.documentElement && typeof MutationObserver");
  const c = vm.createContext({});
  vm.runInContext(core.slice(ini, fim), c);
  const k = (temBotao) => { const s = new Set(); return { nodeType: 1, isConnected: true, s, temBotao, classList: { contains: (x) => s.has(x), toggle: (x, v) => (v ? s.add(x) : s.delete(x)) }, querySelector: () => (k.botao.get(s) ? {} : null), matches: () => true, querySelectorAll: () => [] }; };
  k.botao = new Map();
  const a = k(); k.botao.set(a.s, true);
  c.vbMarcarKickers([{ target: { nodeType: 3 }, addedNodes: [a] }]);
  assert.ok(a.s.has('vb-kicker-ctl'), 'com botão dentro: marcado');
  k.botao.set(a.s, false);
  c.vbMarcarKickers([{ target: { nodeType: 1, closest: () => a }, addedNodes: [] }]);
  assert.ok(!a.s.has('vb-kicker-ctl'), 'o botão saiu: a marca sai');
});

test('um padrão de movimento: tokens --d3-mov-* e --d3-curva na gaveta, no menu e na troca de tela', () => {
  const v2 = ler('vybe-mundo-padrao-v2.css');
  assert.ok(v2.includes('--d3-mov-rapido:.16s; --d3-mov-medio:.28s; --d3-mov-lento:.42s; --d3-curva:cubic-bezier(.32,.72,0,1);'));
  assert.ok(v2.includes('animation:gv2-entra var(--d3-mov-medio) var(--d3-curva) both'));
  assert.ok(v2.includes('animation:vb-menu var(--d3-mov-rapido) var(--d3-curva) both'));
  assert.ok(v2.includes('html[data-vb-voo="tela"]::view-transition-new(root){animation:vb-tela-entra var(--d3-mov-medio) var(--d3-curva) both}'));
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{::view-transition-group\(\*\),::view-transition-old\(\*\),::view-transition-new\(\*\)\{animation:none\}\}/.test(v2));
  for (const f of ['padrao-v2/movimentos.css', 'padrao-v2/0-d3-base.css']) { const s = ler(f); assert.ok(!s.includes('!important') || f !== 'padrao-v2/movimentos.css'); assert.ok(!/:has\(/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), f); }
});
