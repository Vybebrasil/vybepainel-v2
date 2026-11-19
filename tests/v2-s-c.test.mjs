// Rodada S, frente c (pranchas V2-S-Filtros-Demandas, V2-S-Calendario-Demandas, V2-S-Editor-Mes e
// V2-S-Etiquetas-Cliente, aprovadas em 19/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8');
const demandas = ler('vybe-demandas.js'), agenda = ler('vybe-agenda.js'), plj = ler('vybe-planejamentos.js'), clientes = ler('vybe-clientes.js');
const trecho = (src, ini, fim) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const j = src.indexOf(fim, i + ini.length); assert.ok(j > i, fim); return src.slice(i, j); };

function contextoCalendario(extra = {}) {
  const c = vm.createContext({
    safeText: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    planningDateBr: (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''),
    previaDoDiaAttrs: () => '', managerCalendarLabel: () => 'Novembro de 2026', managerCalendarStatusColor: (i, f) => i.status_color || f,
    pv2Foto: (n) => `<i>${String(n).slice(0, 2)}</i>`, clientesDoItem: (d) => [d.cliente], currentDemandaDateMode: 'prazo', Intl, Date,
    ...extra,
  });
  vm.runInContext(trecho(agenda, 'function managerCalendarDateIso(', 'function managerCalendarMonthMeta('), c);
  vm.runInContext(trecho(demandas, 'let pv2dCalDia = ', '// Chamado por renderAgendaDeDemandas'), c);
  return c;
}
const mes = (ano, m) => ({ year: ano, month: m, first: new Date(ano, m, 1, 12), last: new Date(ano, m + 1, 0, 12) });

test('Calendário: o mês começa no domingo e só leva as semanas que ocupa', () => {
  const c = contextoCalendario();
  const nov = c.pv2dCalSemanas(mes(2026, 10));
  assert.equal(nov.length, 35, 'novembro de 2026 cabe em 5 semanas');
  assert.equal(nov[0].iso, '2026-11-01');
  assert.equal(nov[0].date.getDay(), 0, 'domingo primeiro');
  assert.equal(nov.at(-1).iso, '2026-12-05');
  assert.equal(nov.at(-1).inMonth, false);
  assert.equal(c.pv2dCalSemanas(mes(2026, 1)).length, 28, 'fevereiro de 2026 começa no domingo: 4 semanas');
  const ago = c.pv2dCalSemanas(mes(2026, 7));
  assert.equal(ago.length, 42, 'agosto de 2026 começa no sábado: 6 semanas');
  assert.equal(ago[0].iso, '2026-07-26');
});

test('Calendário: a ficha leva o ponto do status, abre no clique e muda de dia no arraste; o dia cheio abre pelo +N', () => {
  const c = contextoCalendario();
  const itens = ['a', 'b', 'c'].map((n) => ({ id: `vybe:${n}`, nome: `Peça ${n}`, cliente: 'Cli', status: 'Pode Fazer', status_color: '#c98a12', calendarDateIso: '2026-11-17' }))
    .concat({ id: 'vybe:d', nome: 'Sozinha', cliente: 'Cli', status: 'A Fazer', calendarDateIso: '2026-11-21' });
  const html = c.pv2dCalendarioHtml(mes(2026, 10), itens, '2026-11-19');
  assert.match(html, /<h3>Novembro de 2026<\/h3><span class="s-cal-nota">prazo · ponto = status<\/span>/);
  assert.match(html, /onclick="managerCalendarGoMonth\(-1\);renderAgendaDeDemandas\(\)"/);
  assert.match(html, /managerCalendarGoToday\(\);renderAgendaDeDemandas\(\)">Hoje<\/button>/);
  assert.match(html, /<span>dom<\/span><span>seg<\/span>/);
  assert.match(html, /ondrop="managerCalendarDrop\('2026-11-21',event,this,'demandas'\)"/, 'o arraste do PR #725 segue');
  assert.match(html, /class="s-cal-peca" data-vt="peca-vybe:d" style="--s-cal-cor:#8A847A"/);
  assert.match(html, /onclick="managerCalendarOpen\('request','vybe:d',event\)" ondragstart="managerCalendarDragStart\('request','vybe:d',event\)" ondragend="managerCalendarDragEnd\(\)"/);
  assert.match(html, /onclick="abrirDiaDoCalendario\(event,'2026-11-17','demandas'\)" title="Ver as 3 deste dia">\+ 2 neste dia<\/button>/);
  assert.equal((html.match(/class="s-cal-peca"/g) || []).length, 2, 'dia cheio: uma ficha e o +2; o outro dia, uma');
  assert.match(html, /class="s-cal-dia hoje escolhido" data-date="2026-11-19"/);
});

test('Calendário: a coluna mostra o dia escolhido, as sem data (que se arrastam para um dia) e a legenda dos status da tela', () => {
  const c = contextoCalendario();
  const comData = [{ id: '1', nome: 'Alinhamento', cliente: 'Academia', status: 'Pode Fazer', status_color: '#c98a12', calendarDateIso: '2026-11-19' }];
  const sem = [{ id: '2', nome: 'Story', cliente: 'Brussolo', status: 'A Fazer' }];
  const html = c.pv2dCalLadoHtml(comData, sem, '2026-11-19');
  assert.match(html, /<b>Quinta, 19\/11<\/b><span>1 demanda<\/span>/);
  assert.match(html, /class="s-cal-item" onclick="managerCalendarOpen\('request','1',event\)"/);
  assert.match(html, /<b>Sem data<\/b><span>1<\/span>/);
  assert.match(html, /class="s-cal-sem" onclick="managerCalendarOpen\('request','2',event\)" ondragstart="managerCalendarDragStart\('request','2',event\)"/);
  assert.match(html, /<b>Legenda<\/b>[\s\S]*Pode Fazer[\s\S]*A Fazer/);
  vm.runInContext("pv2dCalDia = '2026-11-20'", c);
  assert.match(c.pv2dCalLadoHtml(comData, [], '2026-11-19'), /Sexta, 20\/11<\/b><span>0 demandas<\/span>[\s\S]*Nada com data neste dia\.[\s\S]*Toda demanda aberta tem data\./);
});

test('Calendário: renderAgendaDeDemandas desenha o mês da prancha só dentro da tela V2', () => {
  const fn = trecho(agenda, 'function renderAgendaDeDemandas()', '// ── o arquivo');
  assert.match(fn, /if \(typeof pv2dPintarCalendario === 'function' && document\.getElementById\('pv2-demandas'\)\?\.contains\?\.\(wrap\)\) \{\r?\n\s+pv2dPintarCalendario\(wrap, meta, managerCalendarItems\(\{ apenas: 'request' \}\), HOJE_ISO \|\| META\?\.today_iso \|\| ''\);/);
  assert.match(fn, /ondrop="managerCalendarDrop\('\$\{cell\.iso\}',event,this,'demandas'\)"/, 'fora da V2 o mês de antes continua');
});

test('Filtros: o Resumo mostra os três números de sempre e os outros só quando têm número ou estão acesos', () => {
  const c = vm.createContext({ DEMANDA_CONCLUIDA: ['Feito'], visaoRapidaDemandas: 'abertas', currentDemandaAtrasadas: false, currentDemandaStatusFilter: 'all', currentDemandaTipoFilter: 'all',
    demandaAtrasada: (d) => d.atrasada, pertenceVisaoDemanda: (d, v) => Boolean(d[v]), tipoDaDemanda: (d) => d.tipo || '' });
  vm.runInContext(trecho(demandas, 'function pv2dResumoNumeros(', 'function pv2dMontar('), c);
  const todas = [{ status: 'Pode Fazer', tipo: 'Site', atrasada: true }, { status: 'Em execução', tipo: 'Site', sem: true }, { status: 'Feito', tipo: 'Site' }];
  const nums = c.pv2dResumoNumeros(todas);
  assert.equal(JSON.stringify(nums.map((k) => [k.n, k.rot[0]])), JSON.stringify([[1, 'atrasada'], [1, 'em execução'], [1, 'pode fazer'], [1, 'sem responsável']]));
  assert.equal(nums[0].acao, 'focarAtrasadas()');
  assert.equal(nums[3].acao, "escolherVisaoDemanda('sem')");
  vm.runInContext("visaoRapidaDemandas = 'semana'; currentDemandaTipoFilter = '__sem__'", c);
  const acesos = c.pv2dResumoNumeros(todas);
  assert.ok(acesos.some((k) => k.rot[0] === 'vence na semana' && k.aceso && k.acao === "escolherVisaoDemanda('abertas')"), 'o aceso aparece mesmo com zero, para desligar');
  assert.ok(acesos.some((k) => k.rot[0] === 'sem tipo' && k.aceso && k.acao === 'limparTipoDeDemanda()'));
});

test('Filtros: à vista na folha, com "N de M filtrando por", × em cada um, e Ordenar, Colunas e Mostrar também na coluna', () => {
  const montar = trecho(demandas, 'function pv2dMontar()', 'function pv2dAlternarColuna(');
  const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
  naOrdem(montar, ['<h2>Demandas</h2>', 'data-vista="lista"', 'data-vista="calendario"', 'id="pv2d-busca"', 'id="pv2d-colunas"', 'Nova demanda', 'id="pv2d-folha"', 'id="pv2d-tit"', 'id="pv2d-ativos"', 'id="pv2d-filtros"', 'id="pv2d-lista"', 'id="pv2d-pe"', 'id="pv2d-cal"', 'id="pv2d-lado"']);
  assert.match(montar, /controles\.classList\.replace\('dem-controles', 's-dm-controles'\)/);
  assert.match(montar, /'demanda-resumo'/);
  const resumo = trecho(demandas, 'function pintarResumoDeFiltros(', '\n}');
  assert.match(resumo, /aria-label="Tirar o filtro \$\{safeText\(rotulo\)\}"/);
  assert.match(resumo, /<span class="\$\{cNota\}">filtrando por<\/span>/);
  assert.match(resumo, /onclick="clearDemandaFilters\(\)">Limpar tudo<\/button>/);
  const lado = trecho(demandas, 'function pv2dLadoListaHtml(', 'function pv2dPintar(');
  assert.match(lado, /onclick="pv2dOrdenar\('\$\{c\}'\)"/);
  naOrdem(lado.slice(lado.indexOf("return sec('Resumo'")), ['Resumo', 'cada número filtra', 'Ordenar por', "'pv2d-ordenar'", 'Colunas', 'Mostrar ID', 'Mostrar cadastro e criação', 'Mostrar também', 'id="pv2d-visoes"']);
  // Status e status da captação não se juntam: cada um é o seu filtro.
  assert.doesNotMatch(demandas, /status da captação[^\n]*status-filter-demandas/);
});

test('Editor do mês: a janela da prancha só no mundo, com etapas e três botões, o pedido com "Ir para a peça" e o pé na folha', () => {
  const pintar = trecho(plj, 'function pintarPlanejamento(', 'async function pljCarregarPrevia(');
  assert.match(pintar, /const v2 = aba === 'editar' && typeof pv2Ligado === 'function' && pv2Ligado\(\);/);
  assert.match(pintar, /if \(v2\) \{\r?\n\s+m\.innerHTML = pljEdJanelaV2\(p, abas, drive\);/);
  const janela = trecho(plj, 'function pljEdJanelaV2(', '\n}');
  assert.match(janela, /Ver o documento/);
  assert.match(janela, /pljTrocarAba\('\$\{k\}'\)/);
  assert.match(janela, /Ir para a peça \$\{String\(comPedido \+ 1\)\.padStart\(2, '0'\)\}/);
  assert.match(janela, /pljEditorHtml\(true\)/);
  const editor = trecho(plj, 'function pljEditorHtml(', 'const pljPedidoDaPeca');
  // O ⌘S procura #workflow-modal .plj-acoes .workflow-primary; o aviso de alteração é o #plj-ed-sujo de pljAcoesHtml.
  assert.match(editor, /<div class="workflow-actions plj-acoes">\$\{pljAcoesHtml\('editar'\)\}<\/div>/);
  assert.match(editor, /id="plj-ed-detalhe"/);
  assert.match(plj, /document\.querySelector\('#workflow-modal \.plj-acoes \.workflow-primary'\)\?\.click\(\)/);
  // A peça em duas colunas e a legenda longa com "ver tudo".
  const detalhe = trecho(plj, 'function pljEdDetalheHtml(', 'function pljEdSelecionar(');
  assert.match(detalhe, /<div class="plj-ed-colunas"><div class="plj-ed-col">[\s\S]*<\/div><div class="plj-ed-col">[\s\S]*Legenda pronta[\s\S]*'Apoio'/);
  assert.match(detalhe, /> PLJ_LEGENDA_CURTA \? '<button type="button" class="plj-ed-link plj-ed-vertudo"/);
  // O que o editor salva é o mesmo: salvarPlanejamento manda o rascunho inteiro, como antes.
  assert.match(plj, /acao: 'editar', id: PLJ_ABERTO\.id, versao: PLJ_ABERTO\.versao, titulo: PLJ_ABERTO\._titulo \?\? PLJ_ABERTO\.titulo, conteudo: PLJ_RASCUNHO/);
});

test('Editor do mês: "Ir para a peça" vai à primeira peça com pedido; Pedido conta as peças com pedido', () => {
  const c = vm.createContext({});
  vm.runInContext(trecho(plj, 'const pljPedidoDaPeca', '\nfunction pljEdListaHtml(') + ';' + trecho(plj, 'function pljEdPrimeiraComPedido(', '\nfunction pljEdPePecaHtml('), c);
  assert.equal(c.pljEdPrimeiraComPedido([{}, { ajuste_cliente: 'trocar o tema' }, { revisao_cliente: { estado: 'ajuste', nota: 'x' } }]), 1);
  assert.equal(c.pljEdPrimeiraComPedido([{ revisao_cliente: { estado: 'aprovada' }, ajuste_cliente: 'velho' }]), -1);
  assert.match(plj, /\$\{filtro\('pedido', `Pedido <em>\$\{nPedido\}<\/em>`\)\}\$\{filtro\('sem-ok', `Sem OK <em>\$\{nSemOk\}<\/em>`\)\}/);
});

test('Etiquetas do cliente: uma escolha só, renomear e apagar por linha, criar nova e deixar sem segmento', () => {
  const abrir = trecho(clientes, 'function abrirSegmentoDoCliente(', 'const SEG_LAPIS');
  assert.match(abrir, /id="cli-seg-lista" class="seg-lista" role="radiogroup"/);
  assert.match(abrir, /aplicarSegmento\(''\)/);
  assert.match(abrir, /id="cli-seg-nova"/);
  assert.match(abrir, /criarSegmento\(/);
  assert.match(abrir, /classList\.add\('seg-v2', 'd3-tema'\)/);
  const pintar = trecho(clientes, 'function pintarSegmentos(', '\n}');
  assert.match(pintar, /role="radio" aria-checked=/);
  assert.match(pintar, /renomearSegmento\(/);
  assert.match(pintar, /apagarSegmento\(/);
});

test('Filtros V2: cliente e tipo viram linhas do popover com classe própria, e a tela antiga segue com as fichas de antes', () => {
  const src = ler('vybe-demandas.js');
  for (const f of ["document.getElementById('pv2-demandas') ? 's-dm-op' : 'manager-calendar-client';", "const classe = v2 ? 's-dm-op' : 'tipo-chip';",
    'if (v2) return c ? `style="--s-op-cor:${c.cor}"` : \'\';']) assert.ok(src.includes(f), f);
  for (const f of ['onclick="escolherClienteDemandas(this.dataset.cliente)"', 'onclick="filtrarDemandaPorTipo(', 'onclick="limparTipoDeDemanda()"']) assert.ok(src.includes(f), f);
});

test('O fragmento s-c.css segue as regras do padrão V2', () => {
  const css = ler('padrao-v2/s-c.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
  const vars = [...new Set(css.match(/var\(--[a-z0-9-]+/g) || [])].filter((v) => !/^var\(--(d3-|wm-|vv-texto|f$|s-cal-cor|s-op-cor)/.test(v));
  assert.deepEqual(vars, [], 'só tokens --d3-* (e as variáveis da casca e da peça)');
  for (const s of css.match(/[^{}]+(?=\{)/g).map((x) => x.trim()).filter((x) => x && !x.startsWith('@'))) {
    for (const parte of s.split(/,(?![^(]*\))/)) assert.match(parte.trim(), /^(body\.mundo #workflow-modal|#pv2-demandas\.pv2\.d3m-a-dm\.s-dm|html\[data-d3-tema="escuro"\] #pv2-demandas)/, parte.trim().slice(0, 80));
  }
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('V2 · S · FRENTE C'), 'o juntado traz o fragmento');
});
