// Produção › Grupos, ajustes do Paulo (20/11/2026): "o status de captação tem que aparecer da cor do status; não tá
// deixando eu selecionar vários com shift... quando tá selecionado e aperto ESC é pra tirar a seleção e não sair do
// menu.. só sairia se eu apertasse esc dnv.. quando eu seleciono uma atividade ele meio que volta a rolagem pro topo..;
// se tem o formato do conteúdo antes do nome sempre, não precisa da tabela de formato".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const gestor = readFileSync('vybe-gestor.js', 'utf8');
const agenda = readFileSync('vybe-agenda.js', 'utf8');
const mundo = readFileSync('vybe-mundo.js', 'utf8');
const css = readFileSync('padrao-v2/s-j.css', 'utf8');
const fatia = (src, ini) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const m = /\r?\n\}\r?\n/.exec(src.slice(i)); return src.slice(i, i + m.index + m[0].length); };
const entre = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, a); return src.slice(i, j); };
const js = (v) => JSON.parse(JSON.stringify(v));

function selecao() {
  const ctx = vm.createContext({ SELECIONADAS: new Set(), toasts: [], repintou: 0, gruposExpandidos: new Set(), LINHAS_POR_GRUPO: 50, itensPorGrupo: () => [] });
  ctx.repintarOndeHaSelecao = () => { ctx.repintou += 1; };
  ctx.showToast = (t) => ctx.toasts.push(t);
  vm.runInContext([entre(agenda, 'let ULTIMA_MARCADA = null;', '// O SHIFT PRECISA'), fatia(agenda, 'function alternarSelecao(')].join('\n')
    + '\nthis.clicar = (id, marcada, ev, ordem) => alternarSelecao(id, marcada, ev, ordem); this.intervalo = intervaloDaSelecao;', ctx);
  return ctx;
}

test('Shift: o intervalo entre a última caixa e a clicada, nas duas direções, só na ordem que está na tela', () => {
  const { intervalo } = selecao();
  const ordem = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(js(intervalo(ordem, 'b', 'e')), ['b', 'c', 'd', 'e']);
  assert.deepEqual(js(intervalo(ordem, 'e', 'b')), ['b', 'c', 'd', 'e'], 'de baixo para cima também');
  assert.equal(intervalo(ordem, 'x', 'b'), null, 'âncora fora da tela: sem intervalo');
  assert.equal(intervalo(ordem, 'b', 'b'), null);
  // Filtro e ordem: vale a lista visível, não a do grupo.
  assert.deepEqual(js(intervalo(['f', 'd', 'b'], 'f', 'b')), ['f', 'd', 'b']);
});

test('Shift marca o trecho, shift numa marcada desmarca o trecho, sem shift (ou com Ctrl) alterna só uma', () => {
  const ctx = selecao(), ordem = ['a', 'b', 'c', 'd', 'e', 'f'];
  ctx.clicar('b', true, {}, ordem);
  assert.deepEqual([...ctx.SELECIONADAS], ['b']);
  ctx.clicar('e', true, { shiftKey: true }, ordem);
  assert.deepEqual([...ctx.SELECIONADAS].sort(), ['b', 'c', 'd', 'e']);
  assert.match(ctx.toasts.at(-1), /Marcadas 4 peças/);
  ctx.clicar('c', false, { shiftKey: true }, ordem);
  assert.deepEqual([...ctx.SELECIONADAS], ['b'], 'desmarca de c até e (a última clicada)');
  ctx.clicar('f', true, { ctrlKey: true }, ordem);
  assert.deepEqual([...ctx.SELECIONADAS].sort(), ['b', 'f'], 'Ctrl alterna só a clicada');
  ctx.clicar('a', true, { shiftKey: true }, ['a', 'b', 'c']);
  assert.deepEqual([...ctx.SELECIONADAS].sort(), ['a', 'b', 'f'], 'com a âncora fora da lista visível, o shift vale só para a clicada');
  // A célula inteira da caixa também marca, com o shift do clique.
  const linha = fatia(gestor, 'function pv2GrupoLinha(');
  assert.ok(linha.includes('onmousedown="if(event.shiftKey)event.preventDefault()" onclick="${parar};if(event.target===this)alternarSelecao(\'${id}\',${!marcada},event)"'));
  assert.ok(linha.includes("alternarSelecao('${id}',this.checked,event)"), 'a caixa continua a mesma');
});

function esc({ marcadas = 3, menu = false, deck = true } = {}) {
  let ouvinte = null;
  const visivel = { getClientRects: () => [1] };
  const els = { '.status-editor': menu ? visivel : null, '#lote-deck': deck ? visivel : { getClientRects: () => [] } };
  const ctx = vm.createContext({ SELECIONADAS: new Set(Array.from({ length: marcadas }, (_, i) => `vybe:${i}`)), limpou: 0, toasts: [] });
  ctx.document = { addEventListener: (tipo, f) => { if (tipo === 'keydown') ouvinte = f; }, querySelector: (s) => els[s] || null, getElementById: (id) => els[`#${id}`] || null };
  ctx.limparSelecao = () => { ctx.SELECIONADAS.clear(); ctx.limpou += 1; };
  ctx.showToast = (t) => ctx.toasts.push(t);
  vm.runInContext(entre(agenda, 'const NA_FRENTE_DA_SELECAO = [', 'async function salvarDataNaLinha('), ctx);
  const apertar = (target = { tagName: 'BODY' }) => { const ev = { key: 'Escape', target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; ouvinte(ev); return ev; };
  return { ctx, apertar, els };
}

test('Esc: com menu aberto fecha só o menu; com seleção à vista o 1º Esc desmarca e segura o do módulo; o 2º fecha', () => {
  // Menu (status, captação, filtro) aberto: a seleção fica e o Esc segue para quem fecha o menu.
  let { ctx, apertar, els } = esc({ menu: true });
  let ev = apertar();
  assert.equal(ctx.limpou, 0); assert.equal(ev.defaultPrevented, false); assert.equal(ctx.SELECIONADAS.size, 3);
  // Menu fechado: o 1º Esc limpa e marca o evento, e o Esc do mundo (que confere defaultPrevented) não fecha o módulo.
  els['.status-editor'] = null;
  ev = apertar();
  assert.equal(ctx.limpou, 1); assert.equal(ev.defaultPrevented, true); assert.equal(ctx.SELECIONADAS.size, 0);
  assert.match(ctx.toasts.at(-1), /Seleção limpa · 3 peças desmarcadas/);
  // 2º Esc, sem seleção: passa adiante e o módulo fecha.
  ev = apertar();
  assert.equal(ctx.limpou, 1); assert.equal(ev.defaultPrevented, false);
  // Foco na caixa de marcar não é campo de digitar; na busca, o Esc é do campo.
  ({ ctx, apertar } = esc());
  apertar({ tagName: 'INPUT', type: 'search' }); assert.equal(ctx.limpou, 0);
  ev = apertar({ tagName: 'INPUT', type: 'checkbox' }); assert.equal(ctx.limpou, 1); assert.equal(ev.defaultPrevented, true);
  // Seleção que não está à vista (sem a barra "N marcadas"): limpa como antes, sem segurar o Esc.
  ({ ctx, apertar } = esc({ deck: false }));
  ev = apertar(); assert.equal(ctx.limpou, 1); assert.equal(ev.defaultPrevented, false);
  // O Esc do mundo respeita: confere defaultPrevented e não trata a caixa de marcar como campo.
  assert.ok(mundo.includes(`const campo = e.target?.closest?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]');`));
  assert.ok(mundo.includes("if (e.key !== 'Escape' || e.defaultPrevented) return;"));
});

test('Rolagem: redesenhar a folha devolve a rolagem e o foco da caixa no mesmo grupo', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fatia(agenda, 'function guardarRolagemDaFolha(') + fatia(agenda, 'function devolverRolagemDaFolha('), ctx);
  let focou = null;
  const montar = (grupo, topo = 0) => {
    const rola = { scrollTop: topo, scrollLeft: 0 }; const caixa = { dataset: { itemId: 'vybe:7' }, focus: (o) => { focou = o; } };
    return { rola, wrap: { contains: () => true, querySelector: (s) => (s === '[data-grupo]' ? { dataset: { grupo } } : s === '.d3m-a-g-rola' ? rola : null), querySelectorAll: () => [caixa] } };
  };
  ctx.document = { activeElement: { dataset: { itemId: 'vybe:7' } } };
  const antes = montar('g1', 700);
  const guardado = ctx.guardarRolagemDaFolha(antes.wrap);
  assert.deepEqual(js(guardado), { grupo: 'g1', topo: 700, lado: 0, foco: 'vybe:7' });
  const depois = montar('g1', 0);
  ctx.devolverRolagemDaFolha(depois.wrap, guardado);
  assert.equal(depois.rola.scrollTop, 700, 'a tabela fica onde estava');
  assert.deepEqual(js(focou), { preventScroll: true });
  const outro = montar('g2', 0);
  ctx.devolverRolagemDaFolha(outro.wrap, guardado);
  assert.equal(outro.rola.scrollTop, 0, 'outro grupo abre do topo');
  assert.match(agenda, /const antes = guardarRolagemDaFolha\(wrap\);\r?\n\s+wrap\.innerHTML = pv2GruposHtml\(.*\);\r?\n\s+devolverRolagemDaFolha\(wrap, antes\);/);
});

test('Formato: fora da tabela por padrão, volta por "Colunas" e fica guardado; o filtro Formato continua', () => {
  assert.match(gestor, /let pv2GruposComId = false, pv2GruposComFormato = false;/);
  assert.ok(gestor.includes('pv2GruposComFormato = salvo.comFormato === true;'));
  assert.ok(gestor.includes('...(pv2GruposComFormato ? { comFormato: true } : {})'));
  assert.ok(gestor.includes("op('formato', 'Formato', pv2GruposComFormato)"), 'opção no menu Colunas');
  assert.ok(gestor.includes("if (qual === 'formato') { pv2GruposComFormato = !pv2GruposComFormato; pv2GruposGuardar(); }"));
  const html = fatia(gestor, 'function pv2GruposHtml(');
  assert.ok(html.includes("(comFormato ? th('formato', 'Formato') : '')"));
  assert.ok(html.includes(".concat(comFormato ? [] : ['formato'])"), 'o rodapé conta a coluna escondida');
  assert.ok(html.includes("filtroBt('formato', 'Formato'"), 'o filtro Formato fica');
  const ctx = vm.createContext({ SELECIONADAS: new Set(), safeText: (v) => String(v ?? ''), jsArg: (v) => String(v), pillEditavel: (i, c) => `<b data-campo="${c}"></b>`, pv2StatusBotao: () => '', pv2Av: () => '', pv2Foto: () => '',
    botaoClientesDoItem: () => '', botaoDePreviaNaLinha: () => '', clientesDoItem: () => ['Cliente'], cadastroDaPeca: () => ({ quem: '', quando: '' }), pv2GrupoVencida: () => false, PV2_GRUPOS_EXTRAS: [] });
  vm.runInContext(fatia(gestor, 'function pv2GrupoLinha('), ctx);
  const item = { id: 'vybe:1', nome: 'Reels - Black Friday', formato: 'Reels' };
  assert.doesNotMatch(ctx.pv2GrupoLinha(item, { lote: true, hoje: '2026-11-20' }), /s-f-td-formato/);
  assert.match(ctx.pv2GrupoLinha(item, { lote: true, hoje: '2026-11-20', comFormato: true }), /<td class="s-f-td-formato"[^>]*><b data-campo="formato">/);
  assert.match(ctx.pv2GrupoLinha(item, { lote: true, hoje: '2026-11-20' }), /<b>Reels<\/b> · Black Friday/, 'o tipo segue antes do nome');
});

test('Captação na cor do status dela: bolinha e fundo tingido da cor do catálogo, texto na tinta do tema', () => {
  assert.match(css, /td\.s-f-cap \.grupo-pill-btn > \.pill\.vv-st-ponto > i\{display:inline-block;[^}]*background:var\(--st/);
  assert.match(css, /td\.s-f-cap \.grupo-pill-btn > \.pill\.vv-st-ponto\{[^}]*background:color-mix\(in srgb,var\(--st[^}]*color:var\(--d3-tinta\)/);
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\(/);
  // A cor vem do catálogo de captação (o mesmo do menu de status), pela pílula de sempre.
  assert.match(fatia(agenda, 'function catalogoDoCampo('), /CATALOGO_CAPTACAO/);
  assert.ok(fatia(agenda, 'function pillEditavel(').includes("pillHtml(valor, escolha?.cor || '', escolha?.borda || '')"));
});
