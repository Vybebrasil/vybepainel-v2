// Padrão v2 (moodboard aprovado em 12/11/2026): Diário de produção pelo quadro "depois".
// SAFE: vm com DOM de mentira e fetch dublê; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const fonte = ler('vybe-relatorios.js');
const trecho = (de, ate) => { const a = fonte.indexOf(de), b = fonte.indexOf(ate, a); assert.ok(a >= 0 && b > a, `trecho ${de}`); return fonte.slice(a, b); };

const dia = (d, h) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); x.setHours(h); return x; };
const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const ontem = iso(dia(-1, 12)), antes = iso(dia(-5, 12));
const peca = (id, status, ref = ontem, cliente = 'Cliente A') => ({ id, status, veiculacao_iso: ref, prazo_iso: ref, clientes: [cliente], cliente });
const registros = () => [
  { id: 2, origem: 'manual_painel', atualizado_em: dia(0, 14).toISOString(), payload: { conteudos: { ativos: 4, sem_data: 0, prazo_passado: 2 } } },
  { id: 1, origem: 'cron', atualizado_em: dia(0, 9).toISOString(), payload: { conteudos: { ativos: 4, sem_data: 0, prazo_passado: 1 } } },
];
const itens = {
  1: [peca('a', 'Em Andamento'), peca('b', 'A Fazer', iso(dia(3, 12))), peca('c', 'Pode Fazer', antes), peca('d', 'Em Andamento', iso(dia(0, 12)))],
  2: [peca('a', 'Finalizado'), peca('b', 'Alteração', iso(dia(3, 12)), 'Cliente B'), peca('c', 'Pode Fazer', antes), peca('d', 'Em Andamento', iso(dia(0, 12)))],
};

function montar({ lista = registros(), post } = {}) {
  const els = {}, el = (id) => (els[id] ||= { id, innerHTML: '', style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
  const botao = { dataset: {}, innerHTML: 'Registrar agora', classList: { add() {}, remove() {} } };
  const pedidos = [];
  const ctx = { console, Date, Math, JSON, Number, String, Array, Set, Map, Object, Promise, Error, Boolean, encodeURIComponent, setTimeout: () => 0,
    localStorage: { getItem: () => null }, showToast() {}, STATUS_OPTIONS: [{ label: 'A Fazer' }, { label: 'Pode Fazer' }, { label: 'Em Andamento' }, { label: 'Alteração' }],
    document: { getElementById: el, querySelector: (s) => (s.includes('salvarSnapshot') ? botao : null), querySelectorAll: () => [] },
    fetch: async (url, op = {}) => {
      pedidos.push(`${op.method || 'GET'} ${url}`);
      if (op.method === 'POST') return post ? post() : { ok: true, json: async () => ({ ok: true }) };
      const id = Number(new URL(url, 'http://x').searchParams.get('id') || 0);
      if (id) { const r = lista.find((s) => s.id === id); return { ok: true, json: async () => ({ snapshot: { ...r, payload: { ...r.payload, itens: itens[id] } } }) }; }
      return { ok: true, json: async () => ({ snapshots: lista }) };
    } };
  vm.createContext(ctx);
  vm.runInContext(trecho('const DIARIO_KEY', 'async function abrirSnapshot'), ctx);
  return { ctx, el, botao, pedidos };
}

test('Diário: sem registro, uma frase só e o pé que explica; o botão fica só no topo', async () => {
  const { ctx, el } = montar({ lista: [] });
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /class="v2d-card v2d-vazio" role="status"><p>Nenhum registro salvo ainda\.<\/p>/);
  assert.match(html, /class="v2d-sub">Um registro guarda como os conteúdos estão naquele momento/);
  assert.doesNotMatch(html, /salvarSnapshot|v2d-tres|v2d-registros/);
});

test('Diário: a fala do Heitor, três números e "O que mudou" contam as peças dos dois registros', async () => {
  const { ctx, el, pedidos } = montar();
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.ok(pedidos.includes('GET /api/painel?area=diario&id=1') && pedidos.includes('GET /api/painel?area=diario&id=2'), 'abre as peças dos registros à vista');
  assert.match(html, /Heitor · Coordenação de produção<\/span>Do registro das 09:00 para o das 14:00, <b>1 peça ficou pronta<\/b> e <b>nenhuma passou da data de veiculação<\/b>/);
  assert.equal((html.match(/class="v2d-card v2d-kpi/g) || []).length, 3);
  assert.match(html, /Prontas da semana<\/small><b><span class="v2-num">1<\/span><\/b><small>eram 0 no registro das 09:00/);
  assert.match(html, /v2d-kpi ruim"><small>Atrasadas<\/small><b><span class="v2-num" style="animation-delay:.12s">1<\/span>/);
  assert.match(html, /v2d-kpi atencao"><small>Em alteração<\/small><b><span class="v2-num" style="animation-delay:.24s">1<\/span>/);
  assert.match(html, /<h3>Registros<\/h3><small>2 guardados · o mais novo em cima<\/small>/);
  assert.match(html, /<p class="v2d-dl">Hoje · /);
  assert.match(html, /class="v2-abre v2d-reg" data-registro="2" aria-expanded="true"/, 'a linha do registro comparado vem aberta no lugar');
  assert.match(html, /1 ficou pronta: <span class="v2d-cli" style="--c:#6B665E">Cliente A<\/span> 1/);
  assert.match(html, /1 voltou para Alteração/);
  assert.match(html, /<span class="v2d-pill g">\+1 pronta<\/span><button type="button" class="v2d-btn" onclick="diarioComparar\(2\)">Comparar<\/button>/);
  assert.match(html, /onclick="abrirSnapshot\(2\)">Ver as peças<\/button>/, 'as peças do registro continuam a um clique');
  assert.match(html, /onclick="excluirSnapshot\(2\)">Apagar registro<\/button>/);
  assert.match(html, /<h3>O que mudou<\/h3><small>hoje, 09:00 → 14:00<\/small>/);
  assert.match(html, /v2d-pill a" title="Alteração">Alteração<\/span><\/span><div class="v2-barra"><i style="--v:100%;--c:#9A5B00"><\/i><\/div><b>1<\/b><span class="v2d-dt a">\+1<\/span>/);
  assert.match(html, /v2d-pill g" title="Prontas">Prontas<\/span>[\s\S]*?<span class="v2d-dt g">\+1<\/span>/);
  assert.match(html, /class="v2d-sub">Um registro guarda/);
  assert.doesNotMatch(html, /!important|—/);
});

test('Diário: Veiculação ou Prazo troca a data que conta', async () => {
  const { ctx, el } = montar();
  await ctx.renderDiarioLista(true);
  ctx.setDiarioDateMode('prazo');
  assert.match(el('diario-snapshots-list').innerHTML, /nenhuma passou do prazo/);
});

test('Diário: o botão do topo gira, fica "Registrado" e não grava duas vezes', async () => {
  let solta; const espera = new Promise((r) => { solta = r; });
  const { ctx, botao, pedidos } = montar({ post: async () => { await espera; return { ok: true, json: async () => ({ ok: true }) }; } });
  const indo = ctx.salvarSnapshot();
  assert.equal(botao.dataset.estado, 'indo');
  await ctx.salvarSnapshot();
  assert.equal(pedidos.filter((p) => p.startsWith('POST')).length, 1);
  solta(); await indo;
  assert.equal(botao.dataset.estado, 'feito');
  assert.match(botao.innerHTML, /Registrado$/);
});

test('Diário: o CSS do quadro fica no fragmento, sem forçar regra antiga', () => {
  const css = ler('padrao-v2/diario.css');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(css, /#painel-diario \.v2d-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /#painel-diario \.v2d-acao\{[^}]*height:38px[^}]*border-radius:999px;background:#C2490C/);
  assert.match(css, /#painel-diario \.v2d-seg > button\[aria-checked="true"\]\{background:#FFFFFF;color:#1F1D1A/);
  assert.match(css, /#painel-diario \.v2d-kpi > b\{[^}]*font:700 34px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
