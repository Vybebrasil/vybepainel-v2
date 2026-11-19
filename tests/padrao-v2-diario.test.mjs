// Padrão v2 (moodboard aprovado em 12/11/2026): Diário de produção pelo quadro "depois".
// Direção V2 (prancha V2-M-Diario, 16/11/2026): o esqueleto novo da tela e a peça de estados (prancha V2-M-Estados).
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

function montar({ lista = registros(), post, dono = true } = {}) {
  const els = {}, el = (id) => (els[id] ||= { id, innerHTML: '', style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
  const botao = { dataset: {}, innerHTML: 'Registrar agora', classList: { add() {}, remove() {} } };
  const pedidos = [];
  const ctx = { console, Date: Relogio, Math, JSON, Number, String, Array, Set, Map, Object, Promise, Error, Boolean, encodeURIComponent, setTimeout: () => 0,
    localStorage: { getItem: () => null }, showToast() {}, DADOS: itens[2], souDonoDaSessao: () => dono, souAdmin: () => false, STATUS_OPTIONS: [{ label: 'A Fazer' }, { label: 'Pode Fazer' }, { label: 'Em Andamento' }, { label: 'Alteração' }],
    document: { getElementById: el, querySelector: (s) => (s.includes('salvarSnapshot') ? botao : null), querySelectorAll: () => [] },
    fetch: async (url, op = {}) => {
      pedidos.push(`${op.method || 'GET'} ${url}`);
      if (op.method === 'POST') return post ? post() : { ok: true, json: async () => ({ ok: true }) };
      const id = Number(new URL(url, 'http://x').searchParams.get('id') || 0);
      if (id) { const r = lista.find((s) => s.id === id); return { ok: true, json: async () => ({ snapshot: { ...r, payload: { ...r.payload, itens: itens[id] } } }) }; }
      return { ok: true, json: async () => ({ snapshots: lista }) };
    } };
  vm.createContext(ctx);
  // As peças do grupo E (estados e topo) moram em vybe-core.js.
  const core = ler('vybe-core.js'), k0 = core.indexOf('const D3ME_IC'), k1 = core.indexOf('// Confirmação (família 5)', k0);
  assert.ok(k0 >= 0 && k1 > k0, 'peças do grupo E em vybe-core.js');
  vm.runInContext(core.slice(k0, k1), ctx);
  vm.runInContext(trecho('const DIARIO_KEY', 'async function abrirSnapshot'), ctx);
  return { ctx, el, botao, pedidos };
}

// Direção V2 (prancha V2-M-Diario, 16/11/2026): o esqueleto novo. Vazio: a folha "A foto de agora" com os números de
// hoje, "Registros salvos" no estado vazio (a peça de estados) e o "Registrar agora" na folha e no cartão laranja; o
// botão do cabeçalho antigo fica guardado.
test('Diário: sem registro, a foto de agora, o estado vazio da lista e "Registrar agora" na folha e no laranja', async () => {
  const { ctx, el, botao } = montar({ lista: [] });
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /<div class="d3m-e-tela d3m-e-diario">/);
  assert.match(html, /<span class="d3m-e-h" role="heading" aria-level="2">Diário<\/span>/);
  assert.match(html, /d3mETroca\(this,'gestao','diario'\)/, 'a seta do título troca de tela dentro da Gestão');
  assert.match(html, /<section class="d3m-e-folha d3m-e-diario-foto" aria-label="A foto de agora">/);
  assert.match(html, /<span class="r"><b>1<\/b><span>atrasadas<\/span><\/span>/, 'atrasada = não pronta com a data antes de hoje');
  assert.match(html, /<span><b>1<\/b><span>publicam hoje<\/span><\/span>/);
  assert.match(html, /<span class="a"><b>1<\/b><span>em alteração<\/span><\/span>/);
  assert.match(html, /Registrar guarda estes números como eram hoje, para comparar depois\.<\/span><button type="button" class="d3v-btn s v2-estado" data-diario-registrar onclick="salvarSnapshot\(\)">Registrar agora<\/button>/);
  assert.match(html, /<section class="d3m-e-folha cresce d3m-e-diario-regs" aria-label="Registros salvos">[\s\S]*<span class="d3m-e-cab-dir">0<\/span>/);
  assert.match(html, /class="d3m-e-estado d3m-e-estado-vazio grande" data-forma="lista" role="status">[\s\S]*<b>Nenhum registro salvo ainda<\/b>/);
  assert.match(html, /<section class="d3m-laranja d3m-e-diario-lar vazio"[\s\S]*Heitor · diário vazio[\s\S]*<span class="d3-acao-frase">Nenhum dia foi registrado ainda<\/span>[\s\S]*<button type="button" class="d3m-btn l v2-estado" data-diario-registrar onclick="salvarSnapshot\(\)">Registrar agora<\/button>/);
  assert.match(html, /<b>Para que serve<\/b>/);
  assert.match(html, /onclick="diarioIr\('performance'\)"[\s\S]*onclick="diarioIr\('gestor'\)"/, 'os atalhos de Abrir');
  assert.doesNotMatch(html, /d3m-e-diario-mudou|d3m-e-reg-lin/);
  assert.equal(botao.hidden, true, 'o botão do cabeçalho antigo fica guardado');
});

// Registrar é só de dono ou de quem administra (o servidor responde 403 aos outros): sem botão nenhum.
test('Diário: quem não é dono nem administra não vê "Registrar agora"', async () => {
  const { ctx, el, botao } = montar({ lista: [], dono: false });
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.doesNotMatch(html, /salvarSnapshot|data-diario-registrar/);
  assert.match(html, /Nenhum registro salvo ainda/);
  assert.match(html, /Quem registra são os donos/);
  assert.equal(botao.hidden, true);
});

// Carregando e erro usam a peça de estados dentro do mesmo esqueleto: o resto da tela continua de pé.
test('Diário: enquanto abre, a lista é o esqueleto; se o servidor falha, o erro com "Tentar de novo"', async () => {
  let solta; const espera = new Promise((r) => { solta = r; });
  const { ctx, el } = montar({ lista: [] });
  const original = ctx.fetch;
  ctx.fetch = async (...a) => { await espera; return original(...a); };
  const indo = ctx.renderDiarioLista(true);
  let html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /<div class="d3m-e-tela d3m-e-diario" aria-busy="true">/);
  assert.match(html, /class="d3m-e-estado-carregando" data-forma="lista" role="status" aria-busy="true" aria-label="Abrindo os registros"/);
  assert.match(html, /aria-label="A foto de agora"/, 'a foto de agora já está na tela enquanto a lista abre');
  solta(); await indo;
  ctx.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'caiu' }) });
  await ctx.renderDiarioLista(true);
  html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /class="d3m-e-estado d3m-e-estado-erro grande" data-forma="lista" role="alert">[\s\S]*<b>Os registros não vieram<\/b>[\s\S]*<button type="button" class="d3m-e-estado-btn sec" onclick="renderDiarioLista\(true\)">Tentar de novo<\/button>/);
  assert.match(html, /aria-label="A foto de agora"/);
});

// Com registros: o laranja do Heitor diz o que mudou, a lista abre no lugar e "O que mudou" e a semana vão para a coluna
// de consulta, no vidro. Pronta continua sendo só Finalizado.
test('Diário: o cartão do Heitor, os registros e "O que mudou" contam as peças dos dois registros', async () => {
  const { ctx, el, pedidos } = montar();
  await ctx.renderDiarioLista(true);
  const html = el('diario-snapshots-list').innerHTML;
  assert.ok(pedidos.includes('GET /api/painel?area=diario&id=1') && pedidos.includes('GET /api/painel?area=diario&id=2'), 'abre as peças dos registros à vista');
  assert.match(html, /<section class="d3m-laranja d3m-e-diario-lar"[^>]*>\s*<div class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">H<\/span><span>Heitor · 09:00 → 14:00<\/span><\/div>\s*<div class="d3m-lar-txt"><span class="d3-acao-frase">1 foi finalizada; nenhuma passou da data de veiculação<\/span><small class="d3m-lar-sub">1 de 2 da semana em Finalizado\.<\/small><div class="d3m-lar-bts"><button type="button" class="d3m-btn l" onclick="abrirSnapshot\(2\)">Ver as peças<\/button>/);
  // A foto de agora leva, embaixo de cada número, como estava no registro escolhido.
  assert.match(html, /<span>prontas até agora<\/span><small class="d3m-e-era">1 de 2 da semana às 14:00<\/small>/);
  assert.match(html, /<span>atrasadas<\/span><small class="d3m-e-era">era 1 às 14:00<\/small>/);
  assert.match(html, /<span>em alteração<\/span><small class="d3m-e-era">era 1 às 14:00<\/small>/);
  assert.match(html, /<b>Registros salvos<\/b><span class="d3m-e-cab-dir">último [^<]* 14:00 · 2<\/span>/);
  assert.match(html, /<p class="d3m-e-reg-dia">Hoje · /);
  assert.match(html, /class="v2-abre d3m-e-reg on" data-registro="2" aria-expanded="true"/, 'a linha do registro comparado vem aberta no lugar');
  assert.match(html, /<button type="button" class="d3m-e-reg-lin" aria-expanded="true" onclick="diarioAbrirLinha\(2\)"><b class="d3m-e-reg-hora">14:00<\/b>/);
  assert.match(html, /<span class="g"><b>1<\/b> Finalizado<\/span><span class="r"><b>1<\/b> atrasada<\/span><span class="a"><b>1<\/b> alteração<\/span>/);
  // A linha aberta: a contagem à esquerda e os clientes à direita.
  assert.match(html, /<div class="d3m-e-reg-grade"><b class="g">1 Finalizado<\/b><span><span class="v2d-cli" style="--c:#6B665E">Cliente A<\/span> 1<\/span>/);
  assert.match(html, /<b class="a">1 voltou<\/b><span><span class="v2d-cli" style="--c:#6B665E">Cliente B<\/span> 1 · para Alteração<\/span>/);
  assert.match(html, /<span class="d3m-e-reg-selo g">\+1 Finalizado<\/span>/);
  assert.match(html, /onclick="diarioComparar\(2\)">Comparar<\/button>/, 'comparar continua, dentro da linha que abre');
  assert.match(html, /onclick="abrirSnapshot\(2\)">Ver as peças<\/button>/);
  assert.match(html, /onclick="excluirSnapshot\(2\)">Apagar registro<\/button>/);
  assert.match(html, /<section class="d3m-cons d3m-e-diario-mudou" aria-label="O que mudou"><div class="d3m-cons-cab"><b>O que mudou<\/b><span>09:00 → 14:00<\/span><\/div>/);
  assert.match(html, /<span class="d3m-e-et-nome a" title="Alteração"><i aria-hidden="true"><\/i>Alteração<\/span><span class="d3m-vbarra" style="--v:100%"><i><\/i><\/span><b class="d3m-vn">1<\/b><span class="d3m-e-et-dif a">\+1<\/span>/);
  assert.match(html, /<span class="d3m-e-et-nome g" title="Finalizado">[\s\S]*?<span class="d3m-e-et-dif g">\+1<\/span>/);
  assert.match(html, /<span class="d3m-e-et-nome" style="--c:#FFCB00" title="Pode Fazer">/);
  assert.match(html, /aria-label="Finalizado na semana"[\s\S]*class="d3-graf"/, 'a semana em linha');
  assert.doesNotMatch(html, /!important|—|Para que serve/);
});

test('Diário: Veiculação ou Prazo troca a data que conta', async () => {
  const { ctx, el } = montar();
  await ctx.renderDiarioLista(true);
  assert.match(el('diario-snapshots-list').innerHTML, /role="radio" aria-checked="true" data-diario-modo="veiculacao" onclick="setDiarioDateMode\('veiculacao'\)">Veiculação<\/button>/);
  ctx.setDiarioDateMode('prazo');
  const html = el('diario-snapshots-list').innerHTML;
  assert.match(html, /nenhuma passou do prazo/);
  assert.match(html, /role="radio" aria-checked="true" data-diario-modo="prazo" onclick="setDiarioDateMode\('prazo'\)">Prazo<\/button>/);
});

test('Diário: o botão gira, fica "Registrado" e não grava duas vezes', async () => {
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

test('Diário: o CSS da prancha V2 fica nos fragmentos do grupo E, só com tokens e sem forçar regra antiga', () => {
  const antigo = ler('padrao-v2/diario.css');
  assert.doesNotMatch(antigo, /!important/);
  assert.doesNotMatch(antigo, /html body\.mundo/);
  for (const f of ['padrao-v2/zm-e-casca.css', 'padrao-v2/zm-e-estados.css', 'padrao-v2/zm-e-diario.css']) {
    const css = ler(f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /!important/, f);
    assert.doesNotMatch(css, /html body\.mundo/, f);
    assert.doesNotMatch(css, /#[0-9A-Fa-f]{3,8}\b/, `${f}: só tokens --d3-*`);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, f);
  }
  const casca = ler('padrao-v2/zm-e-casca.css'), tela = ler('padrao-v2/zm-e-diario.css');
  // A janela de vidro fumê pelo quadro aberto, o quadro preso à janela e só a lista rolando por dentro.
  // A janela fumê é a regra agrupada de z-direcao.css (limpeza de 16/11/2026: as sete cópias viraram uma).
  assert.match(ler('padrao-v2/z-direcao.css'), /body\.mundo\.mundo-modulo:is\([^)]*\[data-quadro="diario"\][^)]*\) #mundo-moldura\{[^}]*background:var\(--d3-fume\)/);
  assert.match(casca, /\.d3m-e-corpo\{[^}]*grid-template-columns:minmax\(0,1fr\) 316px/);
  assert.match(tela, /body\.mundo\.mundo-modulo\[data-quadro="diario"\] #painel-diario\{position:absolute;inset:0/);
  assert.match(tela, /#painel-diario > \.container > \.vb-cabecalho\{display:none\}/);
  assert.match(ler('vybe-demandas.js'), /document\.body\.dataset\.quadro = board/);
});

// Peça de estados (prancha V2-M-Estados): vazio, carregando e erro para lista, quadro, grade e ficha.
test('Estados V2: a peça d3mEEstado monta vazio, erro e o esqueleto de cada forma; o pulso nunca sai de zero', () => {
  const { ctx } = montar({ lista: [] });
  const vazio = ctx.d3mEEstado({ tipo: 'vazio', forma: 'quadro', titulo: 'Nenhuma oportunidade ainda', texto: 'As etapas ficam em zero até o primeiro lead.', acao: ctx.d3mEEstadoBtn('Novo lead', 'data-novo') });
  assert.equal(vazio, '<div class="d3m-e-estado d3m-e-estado-vazio" data-forma="quadro" role="status"><span class="d3m-e-estado-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg></span><b>Nenhuma oportunidade ainda</b><span>As etapas ficam em zero até o primeiro lead.</span><button type="button" class="d3m-e-estado-btn" data-novo>Novo lead</button></div>');
  const erro = ctx.d3mEEstado({ tipo: 'erro', forma: 'ficha', titulo: 'A ficha não abriu', texto: 'Não foi possível falar com o servidor.', acao: ctx.d3mEEstadoBtn('Tentar de novo', '', true) });
  assert.match(erro, /^<div class="d3m-e-estado d3m-e-estado-erro" data-forma="ficha" role="alert">/);
  assert.match(erro, /<button type="button" class="d3m-e-estado-btn sec" >Tentar de novo<\/button><\/div>$/);
  assert.match(ctx.d3mEEstado({ tipo: 'vazio', titulo: '<b>', vidro: true, grande: true }), /class="d3m-e-estado d3m-e-estado-vazio vidro grande"[\s\S]*<b>&lt;b&gt;<\/b>/, 'texto escapado; variações de vidro e de área grande');
  const lista = ctx.d3mEEstado({ tipo: 'carregando', forma: 'lista', linhas: 3 });
  assert.match(lista, /^<div class="d3m-e-estado-carregando" data-forma="lista" role="status" aria-busy="true" aria-label="Carregando">/);
  assert.equal((lista.match(/d3m-e-osso selo/g) || []).length, 3);
  assert.equal((ctx.d3mEEstado({ tipo: 'carregando', forma: 'quadro' }).match(/d3m-e-osso cartao/g) || []).length, 5, 'três colunas com 2, 1 e 2 cartões');
  assert.equal((ctx.d3mEEstado({ tipo: 'carregando', forma: 'grade', linhas: 8 }).match(/d3m-e-osso bloco/g) || []).length, 8);
  assert.match(ctx.d3mEEstado({ tipo: 'carregando', forma: 'ficha' }), /d3m-e-osso foto[\s\S]*d3m-e-osso t[\s\S]*d3m-e-osso b2/);
  const css = ler('padrao-v2/zm-e-estados.css');
  assert.match(css, /@keyframes d3mERespira\{0%,100%\{opacity:\.6\}50%\{opacity:1\}\}/, 'pulso leve, de .6 a 1');
  assert.doesNotMatch(css, /opacity:0[;}]/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.d3m-e-estado-carregando\{animation:none\}\}/);
  for (const forma of ['lista', 'quadro', 'grade', 'ficha']) assert.match(css, new RegExp(`\\.d3m-e-estado-carregando\\[data-forma="${forma}"\\]`), forma);
});
