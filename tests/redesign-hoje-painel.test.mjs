// Redesign do Hoje (Minhas tarefas, quadro 31) e do Painel de trabalho (quadro 01) do moodboard, 10/11/2026.
// Confere o que as telas prometem: o item do dock e a aba levam ao mesmo Hoje; sem a fila pelo usuário, a pergunta
// "De quem é este dia?" (guardada na mesma lista do "Ver o dia de"), o guia no lugar dos atalhos e o dia (agenda e
// agentes); no Painel, um cabeçalho só, os números com o link da ação e uma barra só, sem perder nenhum filtro.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const fonte = (arq) => readFileSync(arq, 'utf8').replace(/\r\n/g, '\n');
// O corpo de uma função de nível de arquivo (ou de bloco), pelas chaves.
function funcao(src, nome) {
  const i = src.indexOf(`function ${nome}(`);
  assert.ok(i >= 0, `achei ${nome}`);
  let j = src.indexOf('{', src.indexOf(')', i)), n = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') n++; else if (src[k] === '}' && --n === 0) return src.slice(i, k + 1); }
  throw new Error('chaves de ' + nome);
}

test('Minhas tarefas: o item do dock abre o Hoje na aba Minhas tarefas, não o Modo Foco antigo', () => {
  const src = fonte('vybe-mundo.js');
  const usar = funcao(src, 'usarTrilho');
  const ramo = usar.match(/if \(id === 'tarefas'\) \{[^\n]*/)?.[0] || '';
  assert.match(ramo, /visaoHoje = 'tarefas'/);
  assert.match(ramo, /usarTrilho\('hoje'/);
  assert.doesNotMatch(usar, /chooseFocusUser|openFocusPicker/, 'o dock não abre mais o Modo Foco nem o seletor antigo');
  assert.match(usar, /usarTrilho\.tarefas \? 'tarefas'/, 'o dock fica marcado em Minhas tarefas');
});

test('Hoje sem fila: pergunta de quem é o dia, guia do VYBES, agenda de hoje e o que os agentes viram, com Criar', () => {
  const src = fonte('vybe-mundo.js');
  const pintar = funcao(src, 'desenharHoje');
  const semFila = pintar.slice(pintar.indexOf('if (!fila) {'), pintar.indexOf('const abertas = fila.itens'));
  assert.match(semFila, /De quem é este dia\?/);
  assert.match(semFila, /data-pessoa-dia=/);
  // Quadro "VYBES e Criar" (13/11/2026): o guia virou a conversa do VYBES, na mesma ordem da fila (passosDoGuia, em conversaHtml).
  assert.match(semFila, /conversaHtml\(\)/, 'a conversa do VYBES no lugar do guia');
  assert.match(funcao(src, 'conversaHtml'), /passosDoGuia\(/, 'a mesma ordem da fila');
  assert.match(funcao(src, 'conversaHtml'), /\['Agora', 'Depois', 'Em seguida'\]/, 'os mesmos passos Agora / Depois / Em seguida');
  assert.match(semFila, /agendaDeHojeHtml\(\)/);
  assert.match(semFila, /agentesViramHtml\(\)/);
  assert.match(semFila, /criarHtml/);
  for (const atalho of ['data-hoje-acao="pedido_rh"', 'data-hoje-acao="radar"', 'Não achei sua fila pelo seu usuário. Escolha de quem']) assert.ok(!semFila.includes(atalho), `saiu ${atalho}`);
  // Com a fila, o lado continua com os atalhos e ganha a agenda (quando não há compromissos) e os agentes.
  assert.match(pintar, /compromissosHtml\(\) \|\| agendaDeHojeHtml\(\)/);
  // Quadro B2 do moodboard (12/11/2026): a tela com a fila não tem mais a fileira de atalhos; a ação continua existindo.
  assert.match(src, /if \(acao === 'pedido_rh'\)/, 'a solicitação ao RH continua atendida (abre pelo módulo de RH)');
  assert.match(pintar, /botaoDeBriefingHtml\(x\.d\)/, 'as peças seguem com briefing, material, entrega e roteiro na linha aberta');
});

test('a escolha fica na lista guardada do "Ver o dia de" e vale para quem não tem a fila pelo usuário', () => {
  const src = fonte('vybe-mundo.js');
  const fila = funcao(src, 'minhaFila');
  assert.match(fila, /pessoasHoje\.length && \(souDono\(\) \|\| !eu\)/);
  assert.match(fila, /escolhidos\.slice\(0, 1\)/, 'quem não é dono acompanha uma pessoa só');
  assert.match(src, /if \(b\.dataset\.pessoaDia\) \{ definirPessoasHoje\(\[b\.dataset\.pessoaDia\]\); return; \}/);
  assert.match(src, /data-pessoas-atalho="trocar"/, 'quem escolheu pode trocar');
});

test('Agenda de hoje distingue carregando, erro e vazio, pela agenda única', () => {
  const src = fonte('vybe-mundo.js');
  const ag = funcao(src, 'agendaDeHojeHtml');
  assert.match(ag, /tipo: 'erro'/);
  assert.match(ag, /tipo: 'carregando'/);
  assert.match(ag, /tipo: 'vazio'/);
  assert.match(ag, /e\.dia === hoje/);
  assert.match(funcao(src, 'carregarAgenda'), /area=captacoes/, 'a mesma agenda das Captações');
  assert.match(funcao(src, 'carregarAgenda'), /agendaErro = e\.message/);
});

function carregarAgentes(podeVer) {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setInterval() {}, setTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    CustomEvent: class { constructor(t) { this.type = t; } },
    document: { hidden: false, addEventListener() {}, dispatchEvent() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => true;
  if (podeVer !== undefined) ctx.VybeBoletim = { podeVer: () => podeVer };
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-agentes.js', 'utf8'), ctx);
  return ctx.VybeAgentes;
}

test('Os agentes viram: só para quem vê o boletim; sem a planta ainda, lendo; a peça abre só de achado com peça', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(carregarAgentes(false).resumoParaHoje())), { pode: false, itens: [], total: 0 });
  assert.equal(carregarAgentes().resumoParaHoje().pode, false, 'sem o boletim carregado, nada');
  const r = carregarAgentes(true).resumoParaHoje();
  assert.equal(r.pode, true);
  assert.equal(r.lendo, true);
  assert.equal(r.itens.length, 0);
  assert.equal(carregarAgentes(true).abrirPeca('design', ''), false);
  assert.equal(carregarAgentes(true).abrirPeca('design', 'nao-existe'), false);
});

test('Painel de trabalho: cabeçalho único, sem o "Operação · Gestor" nem o select do Responsável geral', () => {
  const html = fonte('index.html');
  const cab = html.slice(html.indexOf('<div class="workspace-heading">'), html.indexOf('<!-- Barra de resumo compacta -->'));
  assert.ok(!cab.includes('Operação · Gestor'));
  assert.ok(!cab.includes('pv-ic'));
  assert.ok(!cab.includes('<select'), 'o Responsável geral saiu do cabeçalho');
  assert.match(cab, /class="ops-modos"/);
  assert.match(cab, /Novo conteúdo/);
  assert.ok(cab.indexOf('ops-modos') < cab.indexOf('ops-novo-conteudo'), 'Modos e Novo conteúdo à direita, nessa ordem');
});

test('Painel de trabalho: uma barra só, com todos os filtros e os mesmos ids das funções', () => {
  const html = fonte('index.html');
  const ini = html.indexOf('<div class="ops-command-bar');
  const barra = html.slice(ini, html.indexOf('<div id="ops-action-panel"'));
  const ids = ['ops-semana-btn', 'ops-grupos-btn', 'ops-agenda-btn', 'ops-arquivo-btn', 'ops-equipe-btn', 'ops-action-btn', 'ops-today-btn',
    'agenda-filtros', 'status-legend', 'person-filter-bar', 'btn-pending-only', 'filter-bar', 'date-mode-bar', 'btn-mode-veiculacao',
    'btn-mode-prazo', 'day-select', 'sort-critico-btn', 'ops-clear-btn', 'agenda-filtro-status', 'agenda-filtro-equipe'];
  for (const id of ids) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} uma vez só`);
    assert.ok(barra.includes(`id="${id}"`), `${id} na barra`);
  }
  assert.equal(html.split('id="agenda-filtros"').length - 1, 1, 'sem a segunda barra de filtros');
  assert.match(barra, /data-filtro-carteira/, 'o Responsável geral entrou na barra como o chip Pessoa');
  for (const v of ['all', 'vinicius', 'ewerton']) assert.match(barra, new RegExp(`definirFiltroCarteira\\('${v}'\\)`));
  assert.ok(!/<select[^>]*data-filtro-carteira/.test(barra), 'sem select nativo na Pessoa');
  assert.match(barra, />Semana</); assert.match(barra, />Mês </); assert.match(barra, />Vence hoje </);
  assert.match(barra, /Mais filtros/);
  // As funções chamadas pelos botões continuam as mesmas.
  for (const f of ['mostrarAgendaDaSemana()', 'toggleVisaoDeGrupos()', 'toggleAgendaMensal()', 'alternarArquivo()', 'mostrarEquipeDaSemana(this)',
    'toggleActionQueue()', 'toggleTodayQueue()', 'togglePendingOnly(this)', "setDateMode('veiculacao',this)", 'filterByDay(this)', 'toggleSortCritico(this)', 'clearAllFilters()']) {
    assert.ok(barra.includes(f), f);
  }
  // A busca do meio continua só para o tema antigo; no mundo a do topo (⌘K) procura em tudo.
  assert.match(fonte('vybe-mundo.css'), /body\.mundo \.ops-command-bar \.global-search-wrap\{display:none\}/);
});

test('o chip Pessoa mostra a carteira escolhida e marca a opção do menu', () => {
  const src = fonte('vybe-core.js');
  const opcoes = ['all', 'vinicius', 'ewerton'].map((v) => ({ dataset: { carteiraOpcao: v }, attrs: {}, setAttribute(k, x) { this.attrs[k] = x; } }));
  const classes = new Set();
  const rotulo = { textContent: '', parentElement: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } } };
  const chip = { dataset: {}, querySelector: () => rotulo, querySelectorAll: () => opcoes };
  const select = { value: '', dataset: {}, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = { filtroCarteira: 'vinicius', document: { querySelectorAll: () => [chip, select] } };
  vm.createContext(ctx);
  vm.runInContext(`${src.match(/const ROTULO_CARTEIRA = [^\n]*/)[0]}\n${funcao(src, 'pintarFiltroCarteira')}\npintarFiltroCarteira();`, ctx);
  assert.equal(rotulo.textContent, 'Vinícius');
  assert.ok(classes.has('tem-escolha'));
  assert.deepEqual(opcoes.map((o) => o.attrs['aria-pressed']), ['false', 'true', 'false']);
  assert.equal(chip.dataset.carteira, 'vinicius');
  assert.equal(select.value, 'vinicius', 'o select das Demandas continua recebendo o valor');
  assert.equal(chip.value, undefined, 'o chip não ganha um value solto');
});

test('os números dizem o que fazer: cada cartão com ação tem o link, e o "Na semana" vira cartão e linha', () => {
  const src = fonte('vybe-gestor.js');
  const el = { innerHTML: '' };
  const hoje = '2026-11-10';
  const DADOS = [
    { id: 1, status: 'A Fazer', veiculacao_iso: hoje, cliente: 'A' },
    { id: 2, status: 'Pode Fazer', veiculacao_iso: '2026-11-11', cliente: 'A' },
    { id: 3, status: 'Aguardo', veiculacao_iso: '2026-11-12', cliente: 'B' },
  ];
  const ctx = { DADOS, HOJE_ISO: hoje, META: { weeks: [1] }, itemNaCarteira: () => true, clientesDoItem: (d) => [d.cliente], pintarFiltroCarteira() {},
    getItemsBySemana: () => DADOS, groupByCliente: (l) => l.reduce((m, d) => ((m[d.cliente] ||= []).push(d), m), {}),
    document: { getElementById: () => el } };
  vm.createContext(ctx);
  vm.runInContext(`${funcao(src, 'renderCompactSummary')}\nrenderCompactSummary();`, ctx);
  const h = el.innerHTML;
  assert.match(h, /Resolver <i aria-hidden="true">→<\/i>/, 'publica hoje sem estar pronto: Resolver');
  assert.match(h, /abrirDoResumo\('hoje'\)/);
  assert.match(h, /abrirDoResumo\('acao'\)/, 'pendentes: Ver, na fila Requer ação');
  assert.match(h, /Ver quais/, 'clientes com menos de 3 posts: Ver quais');
  assert.match(h, /verClientesComPoucosPosts\(\)/);
  assert.ok(!h.includes('pv-kpi-semana-mini'), 'saiu o bloco "Na semana" espremido');
  assert.match(h, /class="pv-kpi-linha"/);
  assert.match(h, /<b>2<\/b> clientes/);
  assert.match(h, /filtrarStatusDoResumo\('Pode Fazer'\)"><b>1<\/b> pode fazer/);
  assert.match(h, /filtrarStatusDoResumo\('Aguardo'\)"><b>1<\/b> em captação/);
  for (const f of ['abrirDoResumo', 'verClientesComPoucosPosts', 'filtrarStatusDoResumo']) assert.match(src, new RegExp(`function ${f}\\(`));
});

test('sem !important novo nem html body.mundo nas regras do redesign', () => {
  const css = fonte('vybe-mundo.css');
  const bloco = css.slice(css.indexOf('/* Hoje · Minhas tarefas (quadro 31'));
  assert.ok(bloco.length > 100);
  assert.ok(!bloco.includes('!important'));
  assert.ok(!bloco.includes('html body.mundo'));
});

test('Agenda da semana (quadro 02): seletor ‹ semana › pelas mesmas pílulas, abas da semana com contagem, cartão com cores', () => {
  const html = fonte('index.html'), src = fonte('vybe-gestor.js');
  const tabs = html.slice(html.indexOf('id="week-tabs-container"'), html.indexOf('id="btn-view-day"'));
  for (const f of ['passarSemana(-1)', 'passarSemana(1)', 'semanaDeHoje()', 'id="semana-seletor-rotulo"']) assert.ok(tabs.includes(f), f);
  for (let n = 1; n <= 6; n++) assert.ok(tabs.includes(`id="tab-s${n}-label"`), `a pílula ${n} continua (tema antigo e navegação)`);
  const dia = funcao(src, 'renderByDay');
  assert.match(dia, /abasPorDia=panelMode==='gestor'&&!document\.body\.classList\.contains\('mundo'\)/, 'no mundo as abas de cada dia saem');
  assert.match(dia, /pintarAbaDaSemana\(grid,sem,\{social:naSemana\.social\.size/, 'a contagem vai para o alternador da semana');
  assert.match(dia, /clientesDoItem\(d\)\.map\(nome=>cliCor\(nome\)\)/, 'cliente com a cor da carteira');
  assert.match(dia, /day-menu-ic/, 'o menu do dia vira ícone, com o nome acessível');
  assert.match(funcao(src, 'managerStatusControl'), /item\.status_color \|\| \(typeof corDeStatus === 'function' \? corDeStatus\(item\.status\)\?\.cor : ''\)/);
  // O rótulo do seletor e os limites, com a mesma lista de pílulas.
  const pilula = (n, txt, extra = '') => ({ id: `tab-s${n}-label`, textContent: txt, style: { display: '' }, classList: { contains: (c) => extra === c }, clicado: 0, click() { this.clicado++; } });
  const pilulas = [pilula(1, '01 · 26/10–01/11'), pilula(2, '02 · 02/11–08/11'), pilula(3, '03 · 09/11–15/11', 'e-hoje')];
  const attrs = {};
  const botao = (k) => ({ toggleAttribute: (a, v) => { attrs[k] = v; }, setAttribute: (a, v) => { attrs[k] = v; } });
  const rotulo = { textContent: '', closest: () => ({ querySelector: (sel) => botao(sel) }) };
  const ctx = { currentWeek: 3, document: { getElementById: (id) => (id === 'semana-seletor-rotulo' ? rotulo : pilulas.find((p) => p.id === id)), querySelectorAll: () => pilulas } };
  vm.createContext(ctx);
  vm.runInContext(`${funcao(src, 'pilulasDeSemana')}\n${funcao(src, 'pintarSeletorDeSemana')}\n${funcao(src, 'passarSemana')}\npintarSeletorDeSemana();`, ctx);
  assert.equal(rotulo.textContent, 'Semana 09/11–15/11');
  assert.equal(attrs['[data-semana-passo="1"]'], true, 'sem semana depois da última');
  assert.equal(attrs['.semana-hoje'], 'true');
  vm.runInContext('passarSemana(-1)', ctx);
  assert.equal(pilulas[1].clicado, 1, 'a semana anterior abre pela própria pílula (showWeek)');
});

test('Demandas (quadro 03): Responsável geral como chip, filtros acesos com a escolha e Colunas no fim da barra', () => {
  const html = fonte('index.html');
  const painel = html.slice(html.indexOf('<div id="painel-demandas"'), html.indexOf('<!-- Quanto esta sendo mostrado'));
  assert.ok(!/<select[^>]*data-filtro-carteira/.test(painel), 'sem select nativo');
  assert.match(painel, /<details class="dem-filtro agenda-pessoa" name="filtros-demandas" data-filtro-carteira/);
  for (const c of ['status', 'tipo', 'cliente', 'responsavel']) assert.match(painel, new RegExp(`data-dem-chip="${c}"`));
  assert.ok(painel.indexOf('class="dem-colunas"') > painel.indexOf('id="demandas-agenda-btn"'), 'Colunas como menu no fim');
  for (const id of ['dem-coluna-id', 'dem-coluna-cadastro', 'demanda-status-legend', 'demanda-tipo-legend', 'demanda-cliente-legend', 'person-filter-bar-demandas', 'date-mode-bar-demandas', 'day-select-demandas', 'busca-cliente-demandas'])
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} continua`);
  const src = fonte('vybe-demandas.js');
  const chips = {};
  const chip = (k) => (chips[k] = { classes: new Set(), escolha: { textContent: '' }, classList: { toggle(c, on) { on ? chips[k].classes.add(c) : chips[k].classes.delete(c); } }, querySelector() { return chips[k].escolha; } });
  const ctx = { currentDemandaStatusFilter: 'Pode Fazer', currentDemandaTipoFilter: '__sem__', clienteDemandasExato: '', currentDemandaPersonFilter: '7', TEAM_USERS: [{ id: 7, name: 'Beatriz Lima' }],
    document: { querySelector: (sel) => chip(sel.match(/data-dem-chip="(\w+)"/)[1]) } };
  vm.createContext(ctx);
  vm.runInContext(`${funcao(src, 'pintarChipsDeDemandas')}\npintarChipsDeDemandas();`, ctx);
  assert.equal(chips.status.escolha.textContent, 'Pode Fazer'); assert.ok(chips.status.classes.has('tem-escolha'));
  assert.equal(chips.tipo.escolha.textContent, 'Sem tipo');
  assert.equal(chips.cliente.escolha.textContent, ''); assert.ok(!chips.cliente.classes.has('tem-escolha'));
  assert.equal(chips.responsavel.escolha.textContent, 'Beatriz');
  // Grupo com a cor só no traço: o fundo tingido sai no mundo.
  const css = fonte('vybe-mundo.css');
  assert.match(css, /body\.mundo \.grupo-bloco \.grupo-cabecalho\{background:none/);
  assert.ok(!css.includes('.grupo-cabeca .grupo-titulo b{filter:brightness(.68)'), 'o nome do grupo fica neutro');
});
