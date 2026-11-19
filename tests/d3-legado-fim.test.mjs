// Direção 3 nas partes comuns das gavetas (14/11/2026): gaveta da Solicitação no desenho da de Conteúdo, pílula de
// status das solicitações, área de arquivo, histórico, prévia da entrega, editor de responsável e campos das perguntas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const trecho = (fonte, de, ate) => fonte.slice(fonte.indexOf(de), fonte.indexOf(ate));
const gaveta = ler('vybe-gaveta.js');
const peca = ler('padrao-v2/peca.css');

test('pílula da solicitação no mundo: clara com a bolinha; cheia só em Alteração, Atrasada e Finalizado', () => {
  const demandas = ler('vybe-demandas.js'), gestor = ler('vybe-gestor.js');
  const c = vm.createContext({ document: { body: { classList: { contains: (x) => x === 'mundo' } } }, corDeStatus: () => ({ cor: '#579BFC', borda: '#579BFC' }) });
  vm.runInContext(`${trecho(gestor, 'function pv2Ligado()', 'function pv2Pill(')}
    function statusInlineStyle(){ return ' style="background:cheia"'; } function statusDotInlineStyle(){ return ''; }
    ${trecho(demandas, 'const STATUS_CLS_DEMANDAS', '// ─── Renderizar KPIs')}`, c);
  const neutra = c.pillHtmlDemanda('Em andamento');
  assert.match(neutra, /class="pill vv-st-ponto n" style="--st:#579BFC"><i aria-hidden="true"><\/i>Em andamento/);
  assert.doesNotMatch(neutra, /background:/);
  assert.match(c.pillHtmlDemanda('Alteração', '#E2445C'), /vv-st-ponto a/);
  assert.match(c.pillHtmlDemanda('Finalizado'), /vv-st-ponto g/);
  c.document.body.classList.contains = () => false;
  assert.match(c.pillHtmlDemanda('Em andamento'), /background:cheia/, 'fora do mundo, a pílula de antes');
});

test('gaveta da Solicitação: abas Resumo, Arquivos e Histórico; contexto em bloco, sem o parágrafo de sistema', () => {
  const drawer = { innerHTML: '' };
  const c = vm.createContext({ document: { getElementById: () => drawer }, safeText: String, workspaceAssetsForDetail: (d) => d.assets || [],
    activeWorkspaceAssets: [], activeWorkspaceItemId: '', DETALHE_DA_GAVETA: null, ATUALIZACOES_DA_GAVETA: [], META: { today_iso: '2026-11-14' },
    workspaceUploadHtml: () => '<div class="workspace-dropzone"></div>', workspaceAssetCard: () => '<article>arq</article>',
    botaoDoLogHtml: () => '', botaoDeLinkHtml: () => '', pillHtmlDemanda: (s) => `<span class="pill vv-st-ponto">${s}</span>`,
    podeVerMonday: () => false, workspaceTimelineEvent: (u) => `<div class="gv2-ev">${u.body}</div>` });
  vm.runInContext(trecho(gaveta, 'function renderDemandaWorkspace', '// Regra Vybe OS: clique'), c);
  c.renderDemandaWorkspace({ updates: [{ body: 'um' }, { body: 'dois' }], assets: [] },
    { id: 'vybe:7', nome: 'Pedido', cliente: 'Alpha1', status: 'Pode Fazer', tipo: 'Reunião', grupo: 'Solicitações', prioridade: 'Alta', prazo: '10/11', prazo_iso: '2026-11-10', conclusao: '20/11', conclusao_iso: '2026-11-20', criado_em: '2026-11-03T10:00:00', cadastrado_por: 'Paulo', tarefas: 4, tarefas_feitas: 1 });
  const h = drawer.innerHTML;
  for (const aba of ["data-gv-aba=\"resumo\"", "data-gv-aba=\"arquivos\"", "data-gv-aba=\"historico\""]) assert.ok(h.includes(aba), aba);
  assert.match(h, />Histórico · 2</);
  assert.match(h, /Contexto da solicitação<\/h3><\/div><div class="gv2-sol-ctx">/);
  assert.match(h, /<small>Prioridade<\/small><b class="a">Alta<\/b>/);
  assert.match(h, /<small>Aberta<\/small><b class="">03\/11 · Paulo<\/b>/);
  assert.match(h, /<small>Tarefas<\/small><b class="">1 de 4<\/b>/);
  assert.doesNotMatch(h, /pertence à Central de Demandas/);
  // Paulo, 18/11/2026: o atraso diz que é o prazo.
  assert.match(h, /<span class="gv2-atraso r">Prazo venceu há 4 dias<\/span>/, 'prazo vencido em vermelho, conclusão não');
  assert.match(h, /<b class="r">10\/11<\/b>/);
  assert.match(h, /<b class="">20\/11<\/b>/);
  assert.match(h, /\+ adicionar/, 'sem briefing, o link de pôr briefing (como na gaveta de Conteúdo)');
  assert.match(h, /Nenhum arquivo anexado ainda/);
  assert.match(h, /class="workspace-voltar"/);
});

test('histórico: tipo do carimbo, sem emoji de caixa marcada, texto inteiro; fora do mundo, o desenho de antes', () => {
  const at = ler('vybe-atualizacoes.js');
  const c = vm.createContext({ document: { body: { classList: { contains: (x) => x === 'mundo' } } }, safeText: String,
    workspacePlainText: (s) => s, workspaceTimelineType: () => 'Atualização', quandoNaBahia: () => '13/11 às 15:10', pessoaLogada: () => null });
  vm.runInContext(trecho(at, 'function atualizacaoDoSistema', 'async function corrigirAtualizacao'), c);
  const sis = c.workspaceTimelineEvent({ update_id: '1', creator: { name: 'Paulo' }, body: '[Vybe OS · Checklist]\n✅ Pedido aberto no grupo\n☑️ Briefing anexado' });
  assert.match(sis, /class="workspace-timeline-event gv2-ev sis"/);
  assert.match(sis, /<span class="gv2-ev-tipo">Checklist<\/span><b>Paulo<\/b>/);
  assert.match(sis, /<p class="gv2-ev-txt">Pedido aberto no grupo\nBriefing anexado<\/p>/);
  const gente = c.workspaceTimelineEvent({ update_id: '2', creator: { name: 'Jady' }, body: 'Arquivo final no Drive.' });
  assert.match(gente, /class="workspace-timeline-event gv2-ev"/);
  assert.match(gente, /gv2-ev-tipo">Atualização</);
  c.document.body.classList.contains = () => false;
  assert.match(c.workspaceTimelineEvent({ update_id: '3', body: 'x' }), /workspace-update-meta/);
});

test('CSS: área de arquivo, prévia, responsável e portão no padrão; a regra laranja antiga fica fora do mundo', () => {
  assert.match(ler('vybe-padrao.css'), /^:where\(body:not\(\.mundo\)\) #workspace-drawer \.workspace-dropzone\{/m);
  assert.match(peca, /body\.mundo #workspace-drawer \.workspace-dropzone\{[^}]*border:1\.5px dashed #C9C2B6;[^}]*background:#F9F8F5/);
  assert.match(peca, /body\.mundo #workspace-drawer \.gv2-ev-txt\{[^}]*color:var\(--d3-texto2,#4A463F\)/);
  assert.match(peca, /body\.mundo #previa-grande\{--ds-acao:var\(--d3-tinta,#1F1D1A\)/);
  assert.match(peca, /body\.mundo #previa-grande\.com-ficha \.previa-grande-palco\{background:var\(--d3-trilho,#F3F1EC\)\}/);
  assert.match(peca, /body\.mundo #dono-editor\{--ds-acao:var\(--d3-tinta,#1F1D1A\)/);
  assert.match(peca, /body\.mundo #workflow-modal\.status-context-dialog\{--vybe-orange-soft:var\(--d3-tinta,#1F1D1A\)\}/);
  assert.match(ler('padrao-v2/familias.css'), /body\.mundo \.cli-pergunta-caixa :is\(input,textarea\)\{border:0;background:var\(--d3-trilho,#F3F1EC\)/);
  assert.match(gaveta, /function workspaceDropzoneTextoHtml\(\)/);
});
