// Padrão v2, grupo "peça" (moodboard de 12/11/2026): a gaveta da peça, o cadastro em três etapas e o formulário em
// etapas do portão de passagem de bastão. O que vai para o servidor e o que é conferido antes de gravar não mudou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const gaveta = ler('vybe-gaveta.js'), cad = ler('cadastros_governed_v2.js'), portoes = ler('vybe-portoes.js'), css = ler('padrao-v2/peca.css');
const trecho = (fonte, de, ate) => fonte.slice(fonte.indexOf(de), fonte.indexOf(ate));

function gavetaNoVm({ item, opcoes }) {
  const c = vm.createContext({ console, setTimeout: () => 0, document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    safeText: (t) => String(t ?? ''), findOperationalItem: () => item, operationalStatusOptions: () => opcoes,
    mesmoStatus: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(), showToast() {} });
  vm.runInContext(gaveta, c);
  return c;
}

test('gaveta: a ordem do quadro (topo, título, bloco, abas, corpo, pé) e as quatro abas', () => {
  const desenho = trecho(gaveta, '  function renderWorkspaceDrawer(detail, item) {', 'async function openItemWorkspace(itemId) {');
  const ordem = ['class="gv2-topo"', 'class="gv2-cab"', 'class="gv2-bloco"', 'class="gv2-seg"', 'class="gv2-corpo"', 'class="gv2-pe"'].map((p) => desenho.indexOf(p));
  assert.ok(ordem.every((n) => n > 0), 'todas as partes existem');
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, 'na ordem do quadro');
  assert.match(gaveta, /const GAVETA_ABAS = \['resumo', 'arquivos', 'conversa', 'historico'\];/);
  for (const rotulo of ["aba('resumo', 'Resumo')", "aba('arquivos', 'Arquivos', assets.length)", "aba('conversa', 'Conversa', updates.length)", "aba('historico', 'Histórico')"]) assert.ok(desenho.includes(rotulo), rotulo);
  assert.ok(desenho.includes('Prazo interno') && desenho.includes("ehPedido ? 'Conclusão' : 'Veiculação'") && desenho.includes('<small>Responsável</small>'));
  assert.ok(desenho.includes('placeholder="Atualização rápida para a equipe"') && desenho.includes('>Comentar</button>') && desenho.includes('>Passar bastão</button>'));
});

test('gaveta: nada do que existia saiu; cada função continua numa aba ou no menu', () => {
  const desenho = trecho(gaveta, '  function renderWorkspaceDrawer(detail, item) {', 'async function openItemWorkspace(itemId) {');
  for (const f of ['faixaDeMaterialBrutoHtml(detail, item)', 'subitensHtml(detail, item)', 'workspaceFichaHtml(detail, item.id)', 'workspaceDeliveryDock(detail, item)',
    'workspaceRegistrosPendentesHtml()', 'workspaceExecutiveHistoryHtml(updates)', 'updates.map(workspaceTimelineEvent)', 'workspaceHistoryHtml(detail, item)', 'botaoDoLogHtml(item.id)',
    'saveWorkspaceComment()', 'saveWorkspaceLink()', 'openManualHandoff(', 'openPlanningEditor(', 'openStatusEditor(event,', 'renomearPeca(', 'copiarId(', 'uploadWorkspaceFile(this)', 'handleWorkspaceDrop(event)',
    'abrirBriefing(', 'editarBriefing(', 'menuDeAcoesDaPecaHtml(item, { linkELog: true })']) assert.ok((desenho + gaveta.slice(gaveta.indexOf('function gavetaLinkHtml'), gaveta.indexOf('  function renderWorkspaceDrawer'))).includes(f), f);
  const menu = trecho(gaveta, 'function menuDeAcoesDaPecaHtml', 'function fecharMenusDaGaveta');
  assert.match(menu, /<button type="button" role="menuitem" onclick="fecharMenusDaGaveta\(\);abrirLogDaPeca\('\$\{id\}'\)">Log de atividade<\/button>/, 'o log mora no menu, no computador e no celular');
  assert.ok(menu.includes("removerPeca('${id}')") && menu.includes('moverPecaDeBoard('), 'arquivar e mover continuam no menu');
});

test('gaveta: o próximo passo é o status seguinte na ordem do quadro e grava pelo caminho de sempre', () => {
  const opcoes = [{ label: 'A Fazer' }, { label: 'Em Andamento' }, { label: 'Desligado', ativa: false }, { label: 'Para aprovação' }, { label: 'Finalizado' }];
  const c = gavetaNoVm({ item: {}, opcoes });
  assert.equal(c.proximoStatusDaPeca({ status: 'em andamento' }).label, 'Para aprovação', 'pula o status desligado');
  assert.equal(c.proximoStatusDaPeca({ status: 'Finalizado' }), null, 'no último status não há seguinte');
  assert.equal(c.proximoStatusDaPeca({ status: 'Fora do catálogo' }), null);
  assert.match(gaveta, /try \{ await updateFocusStatus\(String\(itemId\), proximo\.label\); \}/, 'com os portões de sempre');
  assert.match(gaveta, /: `<button type="button" class="gv2-avancar principal" onclick="openStatusEditor\(event,'\$\{id\}'\)"><span class="gv2-avancar-texto">Trocar status<\/span><\/button>`/, 'sem seguinte, abre o seletor');
  assert.match(gaveta, /\/\^para\\s\/i\.test\(proximo\.label\)/, '"Para aprovação" vira "Enviar para aprovação"');
});

test('gaveta: a pílula de status usa a cor do quadro e o carregando tem a forma da gaveta', () => {
  const c = gavetaNoVm({ item: {}, opcoes: [] });
  assert.equal(c.gavetaPilulaHtml('Em Andamento', '#fdab3d'), '<span class="gv2-st" style="--c:#fdab3d">Em Andamento</span>');
  assert.match(c.gavetaPilulaHtml('X', 'javascript:alert(1)'), /--c:#8A847A/, 'cor fora do formato não entra no estilo');
  assert.match(c.gavetaEsqueletoHtml('Carregando a peça'), /class="gv2 gv2-carregando" aria-busy="true"/);
  assert.match(gaveta, /drawer\.className = 'gv2-gaveta gv2-folha'; drawer\.innerHTML = gavetaEsqueletoHtml\('Carregando a peça'\);/);
});

test('cadastro: três etapas na tela e as mesmas conferências antes de criar', () => {
  assert.match(cad, /const FC_ETAPAS = \['O quê', 'Para quem', 'Quando'\];/);
  assert.match(cad, /const FC_PASSOS = \['board', 'client', 'format', 'itens', 'destino'\];/);
  assert.match(cad, /if \(p === 'itens'\)  return state\.itens\.length > 0 && state\.itens\.every\(\s*\(i\) => String\(i\.titulo \|\| ''\)\.trim\(\) && i\.veic && i\.prazo && String\(i\.brief \|\| ''\)\.trim\(\)\);/, 'título, data, prazo e briefing continuam obrigatórios');
  const c = vm.createContext({ state: { format: '', client: '', itens: [{ titulo: '', veic: '', prazo: '' }] } });
  vm.runInContext(trecho(cad, '  const fcTemTexto', '  function fcRespondido(p) {'), c);
  assert.deepEqual([0, 1, 2].map((n) => c.fcEtapaFeita(n)), [false, false, false]);
  Object.assign(c.state, { format: 'Card', client: 'Cliente A', itens: [{ titulo: 'Promoção', veic: '2026-11-14', prazo: '2026-11-07' }] });
  assert.deepEqual([0, 1, 2].map((n) => c.fcEtapaFeita(n)), [false, true, true], 'sem briefing o O quê não fecha');
  assert.equal(c.fcEtapaDoPasso('itens'), 0, 'o briefing que falta mora no O quê');
  c.state.itens[0].brief = 'Foto do produto com o preço';
  assert.deepEqual([0, 1, 2].map((n) => c.fcEtapaFeita(n)), [true, true, true]);
  assert.deepEqual(['board', 'format', 'client', 'itens', 'destino'].map((p) => c.fcEtapaDoPasso(p)), [0, 0, 1, 2, 2]);
  c.state.itens[0].titulo = ' ';
  assert.equal(c.fcEtapaDoPasso('itens'), 0, 'sem título, a resposta que falta mora na primeira etapa');
});

test('cadastro: o que vai para o servidor é o de antes, campo por campo', () => {
  const envio = trecho(cad, "        const pelaEscritaDupla = await tentarEscritaDupla({ id: '' }, {", '        if (pelaEscritaDupla?.item_id)');
  for (const campo of ["acao: 'criar', board: fcQuadro().id,", 'titulo: normalized, cliente: state.clienteNoBanco || state.client, clientes: state.clientesNoBanco, formato: state.format,',
    'prazo: item.prazo, veiculacao: item.veic, status: chaveDeStatus(finalStatus),', 'grupo_id: finalGroup, briefing: item.brief,', "tipo_conteudo: state.board === 'demandas' ? null : 3,",
    "captacao: state.board === 'demandas' ? null : (finalCap || null),", "prioridade: state.board === 'demandas' ? (state.prioridade || null) : null,", 'material_bruto: state.materialBruto || null,',
    "objetivo: state.board === 'demandas' ? null : (state.objetivo || null),", 'responsaveis: fcEquipeFinal(dest),', '_devolve: true,']) assert.ok(envio.includes(campo), campo);
});

test('cadastro: o briefing obrigatório fica à vista no O quê; Mais campos guarda objetivo, arquivo, grupo e status', () => {
  const mais = trecho(cad, '  function fcMaisCamposHtml(n, it) {', '  window.fcEscolherFormato =');
  for (const p of ['fcObjetivoHtml()', 'fcArquivosHtml(n, it)', 'id="fc-auto-group-container"', "fcHandleInput('briefReady', this.checked)", "fcHandleInput('materialReady', this.checked)",
    'fcAdicionarItem()', 'fcAbrirEscala()', 'fcColarTitulos()', 'fcEscalonarDatas()', 'fcTirarItem(']) assert.ok(mais.includes(p), p);
  assert.ok(!mais.includes('data-campo="brief"'), 'o briefing saiu de Mais campos');
  const oQue = trecho(cad, '  function fcCartaoOQueHtml(n, it) {', '  function fcCartaoParaQuemHtml() {');
  assert.ok(oQue.includes('data-campo="brief"') && oQue.includes('obrigatório'), 'o briefing está no O quê, marcado obrigatório');
  assert.match(cad, /if \(fcTemTexto\(it\.titulo\) && !fcTemTexto\(it\.brief\)\) focar = 'brief';/, 'faltando o briefing, a tela vai ao campo');
  assert.match(cad, /if \(n === 0\) return Boolean\(state\.format\) && state\.itens\.every\(\(i\) => fcTemTexto\(i\.titulo\) && fcTemTexto\(i\.brief\)\);/, 'sem briefing a primeira etapa não fecha');
  for (const id of ['fc-erro-formato', 'fc-erro-titulo', 'fc-erro-cliente', 'fc-erro-data', 'fc-erro-brief']) assert.ok(cad.includes(`fcErroHtml('${id}'`), id);
  assert.match(cad, /role="alert" hidden>/);
  // Cada campo do conteúdo aparece uma vez só na tela: a leitura da tela (fcSincronizarDaTela) não pode achar dois.
  for (const campo of ['titulo', 'veic', 'prazo', 'brief']) assert.equal(cad.split('data-item="${n}" data-campo="' + campo + '"').length - 1, 1, campo);
});

test('cadastro: escolhido é ficha preta, sem os estados que o tema antigo pinta de laranja', () => {
  const cartoes = trecho(cad, '  function fcCartaoOQueHtml(n, it) {', '  function fcMaisCamposHtml(n, it) {');
  assert.doesNotMatch(cartoes, /aria-pressed|aria-selected/);
  assert.match(cartoes, /role="radio" aria-checked="\$\{state\.format === f\}" class="nd-chip\$\{state\.format === f \? ' on' : ''\}"/);
  assert.match(css, /body\.mundo #fc-overlay \.nd \.nd-chip\.on\{background:#1F1D1A;color:#FFFFFF;box-shadow:none\}/);
  assert.match(css, /body\.mundo #fc-overlay \.nd-etapa\.agora\{box-shadow:inset 0 0 0 2px #1F1D1A/);
  assert.match(css, /body\.mundo #fc-overlay \.nd-num\.ok\{background:#1F1D1A;color:#FFFFFF\}/);
});

test('portão de bastão: etapas em pílula, "N de 3" e os mesmos campos que a gravação lê', () => {
  assert.match(portoes, /<div class="pt-etp bastao-passos" aria-hidden="true"><span data-bastao-passo="0" class="atual">1 Entregou<\/span><i><\/i><span data-bastao-passo="1">2 Próximo<\/span><i><\/i><span data-bastao-passo="2">3 Confirmar<\/span><\/div>/);
  for (const id of ['id="handoff-done"', 'id="handoff-link"', 'id="handoff-next"', 'id="bastao-revisao"', 'id="bastao-voltar"', 'id="bastao-seguir"']) assert.ok(portoes.includes(id), id);
  assert.match(portoes, /if \(ir >= secoes\.length\) return submitHandoff\(\);/);
  assert.match(css, /body\.mundo #workflow-modal \.pt-etp > span\.atual\{padding:0 10px;border-radius:999px;background:#1F1D1A;color:#FFFFFF\}/);
});

test('folha do grupo: medidas do quadro, sem forçar nada', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(css, /body\.mundo #workspace-drawer\.gv2-gaveta\{[^}]*width:520px;[^}]*border-radius:24px/);
  assert.match(css, /\.gv2-avancar\{[^}]*height:44px;[^}]*background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /\.gv2-bloco\{[^}]*grid-template-columns:1fr 1fr 1\.3fr;[^}]*border-radius:14px;background:#F9F8F5\}/);
  assert.match(css, /body\.mundo #fc-overlay \.nd\{[^}]*border-radius:28px;background:#F9F8F5/);
  assert.match(css, /body\.mundo #fc-overlay \.nd-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});
