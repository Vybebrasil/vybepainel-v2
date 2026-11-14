// Padrão v2 (moodboard aprovado em 12/11/2026): Diário de produção pelo quadro "depois".
// SAFE: vm com DOM de mentira e fetch dublê; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const fonte = ler('vybe-relatorios.js');
const trecho = (de, ate) => { const a = fonte.indexOf(de), b = fonte.indexOf(ate, a); assert.ok(a >= 0 && b > a, `trecho ${de}`); return fonte.slice(a, b); };

// O relógio fica parado numa sexta (13/11/2026, 15h): a conta "da semana" depende do dia, e o teste não pode virar no sábado.
const AGORA = new Date(2026, 10, 13, 15, 0, 0).getTime();
class Relogio extends Date { constructor(...a) { super(...(a.length ? a : [AGORA])); } static now() { return AGORA; } }
const dia = (d, h) => { const x = new Relogio(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); x.setHours(h); return x; };
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
  const ctx = { console, Date: Relogio, Math, JSON, Number, String, Array, Set, Map, Object, Promise, Error, Boolean, encodeURIComponent, setTimeout: () => 0,
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

test('Diário: sem registro, uma frase só (Direção 3: sem o pé que explicava); o botão fica só no topo', async () => {
  const { ctx, el } = montar({ lista: [] });
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /class="v2d-card v2d-vazio" role="status"><p>Nenhum registro salvo ainda\.<\/p>/);
  assert.doesNotMatch(html, /v2d-sub|salvarSnapshot|d3d-nums|v2d-registros/);
});

// Direção 3 (moodboard 3, 13/11/2026; quadro D3-Diario): o bloco de ação laranja do Heitor, quatro números, "Registros" em
// grade e "O que mudou" com a pílula de status. Pronta continua sendo só Finalizado.
test('Diário: o bloco do Heitor, quatro números e "O que mudou" contam as peças dos dois registros', async () => {
  const { ctx, el, pedidos } = montar();
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.ok(pedidos.includes('GET /api/painel?area=diario&id=1') && pedidos.includes('GET /api/painel?area=diario&id=2'), 'abre as peças dos registros à vista');
  assert.match(html, /<section class="d3-acao"[^>]*><span class="d3-acao-av" aria-hidden="true">H<\/span><span class="d3-acao-frase"><small class="d3d-quem">Heitor · Coordenação · 09:00 → 14:00<\/small><span class="d3d-frase">1 virou Finalizado; nenhuma passou da data de veiculação\.<\/span>/);
  assert.equal((html.match(/class="d3-num[ "]/g) || []).length, 4);
  assert.match(html, /Finalizadas na semana<\/span><b class="d3-num-v">1<\/b><span class="d3-barra" style="--v:50%"><i><\/i><\/span><small class="d3d-num-sub g">de 2 da semana<\/small>/);
  assert.match(html, /class="d3-num r"><span class="d3-num-rot">Atrasadas<\/span><b class="d3-num-v">1<\/b>[\s\S]*?eram 2 às 09:00/);
  assert.match(html, /class="d3-num a"><span class="d3-num-rot">Em alteração<\/span><b class="d3-num-v">1<\/b>/);
  assert.match(html, /Registros<\/span><b class="d3-num-v">2<\/b>/);
  assert.match(html, /<h3>Registros<\/h3><small>2<\/small>/);
  assert.match(html, /<p class="v2d-dl">Hoje · /);
  assert.match(html, /class="v2-abre v2d-reg d3d-reg on" data-registro="2" aria-expanded="true"/, 'a linha do registro comparado vem aberta no lugar');
  assert.match(html, /<span class="d3d-c g"><b>1<\/b> Finalizado<\/span>/);
  assert.match(html, /1 virou Finalizado: <span class="v2d-cli" style="--c:#6B665E">Cliente A<\/span> 1/);
  assert.match(html, /1 voltou para Alteração/);
  assert.match(html, /<span class="v2d-pill g">\+1 Finalizado<\/span>/);
  assert.match(html, /onclick="diarioComparar\(2\)">Comparar<\/button>/, 'comparar continua, dentro da linha que abre');
  assert.match(html, /onclick="abrirSnapshot\(2\)">Ver as peças<\/button>/);
  assert.match(html, /onclick="excluirSnapshot\(2\)">Apagar registro<\/button>/);
  assert.match(html, /<h3>O que mudou<\/h3><small>09:00 → 14:00<\/small>/);
  assert.match(html, /<span class="d3d-st a" title="Alteração">Alteração<\/span><span class="d3-barra" style="--v:100%"><i><\/i><\/span><b>1<\/b><span class="v2d-dt a">\+1<\/span>/);
  assert.match(html, /<span class="d3d-st g" title="Finalizado">Finalizado<\/span>[\s\S]*?<span class="v2d-dt g">\+1<\/span>/);
  assert.match(html, /<span class="d3d-st" style="--c:#FFCB00" title="Pode Fazer">Pode Fazer<\/span>/);
  assert.match(html, /Finalizado na semana<\/h3>[\s\S]*class="d3-graf"/, 'a semana em linha');
  assert.doesNotMatch(html, /!important|—|v2d-sub/);
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
  // Direção 3: fundo areia, o botão do topo preto (o laranja é só o bloco de ação), a escolhida preta e o número de 36.
  assert.match(css, /#painel-diario:has\(\.d3d\)\{background:var\(--d3-areia\)\}/);
  assert.match(css, /#painel-diario \.v2d-acao\{[^}]*height:40px[^}]*border-radius:999px;background:#1F1D1A/);
  assert.match(css, /#painel-diario \.v2d-seg > button\[aria-checked="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /#painel-diario \.d3d \.d3-num > \.d3-num-v\{font-size:36px\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
