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
  for (const f of ['faixaDeMaterialBrutoHtml(detail, item, { compacta: true })', 'gavetaChecklistHtml(detail, item)','gavetaFichaResumoHtml(detail, item)', 'workspaceDeliveryDock(detail, item)',
    'workspaceRegistrosPendentesHtml()', 'workspaceExecutiveHistoryHtml(updates)', 'updates.map(workspaceTimelineEvent)', 'workspaceHistoryHtml(detail, item)', 'botaoDoLogHtml(item.id)',
    'saveWorkspaceComment()', 'saveWorkspaceLink()', 'openManualHandoff(', 'openPlanningEditor(', 'openStatusEditor(event,', 'renomearPeca(', 'copiarId(', 'uploadWorkspaceFile(this)', 'handleWorkspaceDrop(event)',
    'abrirBriefing(', 'editarBriefing(', 'menuDeAcoesDaPecaHtml(item, { linkELog: true })']) assert.ok((desenho + gaveta.slice(gaveta.indexOf('function gavetaLinkHtml'), gaveta.indexOf('  function renderWorkspaceDrawer'))).includes(f), f);
  // Quadro D3-Gaveta: as subdemandas aparecem como "Checklist", pelo mesmo bloco de vybe-subitens.js.
  const checklist = trecho(gaveta, 'function gavetaChecklistHtml', 'function gavetaFichaResumoHtml');
  assert.ok(checklist.includes('subitensHtml(detail, item)') && checklist.includes('>Checklist'), 'o checklist é o bloco das subdemandas');
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

test('cadastro em etapas: quatro etapas, uma por vez, e as mesmas conferências antes de criar', () => {
  // Paulo (20/11/2026): "não gosto que apareça tudo de vez.. gosto de etapa a etapa pra não ficar confuso".
  assert.match(cad, /const FC_ETAPAS = \['Cliente e formato', 'O que é', 'Datas e responsável', 'Confere'\];/);
  assert.match(cad, /const FC_PASSOS = \['board', 'client', 'format', 'itens', 'destino'\];/);
  assert.match(cad, /if \(p === 'itens'\)  return state\.itens\.length > 0 && state\.itens\.every\(\s*\(i\) => String\(i\.titulo \|\| ''\)\.trim\(\) && i\.veic && i\.prazo && String\(i\.brief \|\| ''\)\.trim\(\)\);/, 'título, data, prazo e briefing continuam obrigatórios');
  const c = vm.createContext({ state: { format: '', client: '', itens: [{ titulo: '', veic: '', prazo: '' }] } });
  vm.runInContext(`${trecho(cad, '  const FC_PASSOS = ', '  let fcPasso = 0;')}${trecho(cad, '  const fcTemTexto', '  // Objetivo da peça')}
    function fcItemAtivo() { return state.itemAtivo || 0; }`, c);
  assert.deepEqual([0, 1, 2].map((n) => c.fcEtapaFeita(n)), [false, false, false]);
  Object.assign(c.state, { format: 'Card', client: 'Cliente A', itens: [{ titulo: 'Promoção', veic: '2026-11-14', prazo: '2026-11-07' }] });
  assert.deepEqual([0, 1, 2].map((n) => c.fcEtapaFeita(n)), [true, false, true], 'sem briefing o O que é não fecha');
  assert.equal(c.fcEtapaFeita(3), false, 'o Confere só fecha com tudo respondido');
  assert.equal(c.fcEtapaDoPasso('itens'), 1, 'o briefing que falta mora no O que é');
  c.state.itens[0].brief = 'Foto do produto com o preço';
  assert.deepEqual([0, 1, 2, 3].map((n) => c.fcEtapaFeita(n)), [true, true, true, true]);
  assert.deepEqual(['board', 'format', 'client', 'itens', 'destino'].map((p) => c.fcEtapaDoPasso(p)), [0, 0, 0, 3, 3]);
  c.state.itens[0].veic = '';
  assert.equal(c.fcEtapaDoPasso('itens'), 2, 'sem data, a resposta mora nas Datas');
  c.state.itens[0].titulo = ' ';
  assert.equal(c.fcEtapaDoPasso('itens'), 1, 'sem título, a resposta mora no O que é');
  // No lote, cada etapa deixa seguir pelo conteúdo aberto; o visto do trilho e o Confere olham todos.
  Object.assign(c.state, { itemAtivo: 1, itens: [{ titulo: '', brief: '', veic: '2026-11-14', prazo: '2026-11-07' }, { titulo: 'B', brief: 'b', veic: '2026-11-21', prazo: '2026-11-14' }] });
  assert.equal(c.fcEtapaFeitaNoAberto(1), true);
  assert.equal(c.fcEtapaFeita(1), false);
});

test('cadastro: o que vai para o servidor é o de antes, campo por campo', () => {
  const envio = trecho(cad, "        const pelaEscritaDupla = await tentarEscritaDupla({ id: '' }, {", '        if (pelaEscritaDupla?.item_id)');
  for (const campo of ["acao: 'criar', board: fcQuadro().id,", 'titulo: normalized, cliente: state.clienteNoBanco || state.client, clientes: state.clientesNoBanco, formato: state.format,',
    'prazo: item.prazo, veiculacao: item.veic, status: chaveDeStatus(finalStatus),', 'grupo_id: finalGroup, briefing: item.brief,', "tipo_conteudo: state.board === 'demandas' ? null : 3,",
    "captacao: state.board === 'demandas' ? null : (finalCap || null),", "prioridade: state.board === 'demandas' ? (state.prioridade || null) : null,", 'material_bruto: state.materialBruto || null,',
    "objetivo: state.board === 'demandas' ? null : (state.objetivo || null),", 'responsaveis: fcEquipeFinal(dest),', '_devolve: true,']) assert.ok(envio.includes(campo), campo);
});

test('cadastro em etapas: título, briefing, objetivo e referências no O que é; Mais campos (no Confere) guarda grupo, status e lote', () => {
  const mais = trecho(cad, '  function fcMaisCamposHtml(n, it) {', '  window.fcEscolherFormato =');
  assert.ok(!mais.includes('fcObjetivoHtml()') && !mais.includes('fcArquivosHtml(n, it)'), 'objetivo e referências saíram de Mais campos');
  const corpo = trecho(cad, '    const passo = (i, corpo, depois', '    renderPersons();');
  assert.match(corpo, /passo\(1, `\$\{fcTituloBriefHtml\(n, it\)\}\$\{state\.board === 'demandas' \? '' : fcObjetivoHtml\(\)\}\$\{fcReferenciasHtml\(n, it\)\}`\)/, 'O que é: título, briefing, objetivo (só conteúdo) e referências');
  assert.ok(trecho(cad, '  function fcReferenciasHtml(n, it) {', '  // Etapa 1 (clientes)').includes('fcArquivosHtml(n, it)'));
  for (const p of ['id="fc-auto-group-container"', "fcHandleInput('briefReady', this.checked)", "fcHandleInput('materialReady', this.checked)",
    'fcAdicionarItem()', 'fcAbrirEscala()', 'fcColarTitulos()', 'fcEscalonarDatas()', 'fcTirarItem(']) assert.ok(mais.includes(p), p);
  assert.ok(!mais.includes('data-campo="brief"'), 'o briefing saiu de Mais campos');
  const oQue = trecho(cad, '  function fcTituloBriefHtml(n, it) {', '  // Etapa 2 · as referências');
  assert.ok(oQue.includes('data-campo="brief"') && oQue.includes('obrigatório'), 'o briefing está no O que é, marcado obrigatório');
  assert.match(cad, /if \(fcTemTexto\(it\.titulo\) && !fcTemTexto\(it\.brief\)\) focar = 'brief';/, 'faltando o briefing, a tela vai ao campo');
  assert.match(cad, /if \(n === 1\) return itens\.every\(\(i\) => fcTemTexto\(i\?\.titulo\) && fcTemTexto\(i\?\.brief\)\);/, 'sem briefing o O que é não fecha');
  for (const id of ['fc-erro-formato', 'fc-erro-titulo', 'fc-erro-cliente', 'fc-erro-data', 'fc-erro-brief']) assert.ok(cad.includes(`fcErroHtml('${id}'`), id);
  assert.match(cad, /role="alert" hidden>/);
  // Cada campo do conteúdo aparece uma vez só na tela: a leitura da tela (fcSincronizarDaTela) não pode achar dois.
  for (const campo of ['titulo', 'veic', 'prazo', 'brief']) assert.equal(cad.split('data-item="${n}" data-campo="' + campo + '"').length - 1, 1, campo);
});

test('cadastro: escolhido é ficha preta, sem os estados que o tema antigo pinta de laranja', () => {
  const cartoes = trecho(cad, '  function fcQuadroFormatoHtml() {', '  function fcMaisCamposHtml(n, it) {');
  assert.doesNotMatch(cartoes, /aria-pressed|aria-selected/);
  assert.match(cartoes, /role="radio" aria-checked="\$\{state\.format === f\}" class="nd-chip\$\{state\.format === f \? ' on' : ''\}"/);
  assert.match(css, /body\.mundo #fc-overlay \.nd \.nd-chip\.on\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\));color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\));box-shadow:none\}/);
  assert.match(css, /body\.mundo #fc-overlay \.nd-etapa\.agora\{background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\));box-shadow:inset 0 0 0 2px (?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\))/, 'Direção 3: cartão da etapa atual branco com borda preta sobre a janela branca');
  assert.match(css, /body\.mundo #fc-overlay \.nd-num\.ok\{background:var\(--d3-pronto,(?:#11613A|var\(--d3-(?:pronto)(?:,[^)]*\))?\))\);color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))\}/);
});

test('portão de bastão: etapas com nome, "N de 3" e os mesmos campos que a gravação lê', () => {
  // Rodada S (frente e): as etapas com nome na casca V2 (vbb-etapas), como os portões da rodada R.
  assert.ok(portoes.includes('<div class="vbb-etapas" aria-hidden="true">${BASTAO_ETAPAS.map('), 'etapas com nome');
  assert.ok(portoes.includes("const BASTAO_ETAPAS = ['Entregou', 'Próximo', 'Confirmar'];"), 'Entregou → Próximo → Confirmar');
  for (const id of ['id="handoff-done"', 'id="handoff-link"', 'id="handoff-next"', 'id="bastao-revisao"', 'id="bastao-voltar"', 'id="bastao-seguir"']) assert.ok(portoes.includes(id), id);
  assert.match(portoes, /if \(ir >= secoes\.length\) return submitHandoff\(\);/);
  assert.match(css, /body\.mundo #workflow-modal \.pt-etp > span\.atual\{padding:0 10px;border-radius:999px;background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\));color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))\}/);
});

test('folha do grupo: medidas do quadro, sem forçar nada', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(css, /body\.mundo #workspace-drawer\.gv2-gaveta\{[^}]*width:700px;[^}]*border-radius:var\(--d3-r-janela,28px\)/, 'Direção 3: gaveta de 700 com o Resumo em duas colunas');
  assert.match(css, /\.gv2-avancar\{[^}]*height:46px;[^}]*background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\));color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /\.gv2-bloco\{[^}]*grid-template-columns:1fr 1fr 1\.3fr;[^}]*border-radius:16px;background:(?:#F9F8F5|var\(--d3-(?:folha-leve)(?:,[^)]*\))?\))\}/);
  assert.match(css, /body\.mundo #fc-overlay \.nd\{[^}]*border-radius:28px;background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /body\.mundo #fc-overlay \.nd-card\{[^}]*border-radius:20px;background:(?:#F9F8F5|var\(--d3-(?:folha-leve)(?:,[^)]*\))?\))/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});
