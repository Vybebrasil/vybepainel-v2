// Padrão v2, grupo "ficha" (12/11/2026): Gestão de clientes, Ficha do cliente e Reuniões iguais aos quadros DEPOIS do
// moodboard. Carrega os arquivos de verdade com o mínimo do navegador e confere a estrutura de cada quadro, que o CSS
// fica todo em padrao-v2/ficha.css e que o que vai para o servidor continua igual.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { jsArg as JS_ARG } from './apoio-js-arg.mjs';

const ler = (f) => fs.readFileSync(f, 'utf8');

function elemento(id) {
  return { id, innerHTML: '', textContent: '', className: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, remove() {}, querySelector: () => null,
    querySelectorAll: () => [], insertAdjacentHTML(_, html) { this.innerHTML = html + this.innerHTML; } };
}

function carregar({ reunioes = [] } = {}) {
  const els = new Map(), store = new Map(), postados = [];
  const pegar = (id) => { if (!els.has(id)) els.set(id, elemento(id)); return els.get(id); };
  const ctx = {
    console, Intl, URL, Map, Set, Promise, setTimeout, clearInterval, Math, Number, String, JSON, Date, Object, Array,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    document: { getElementById: pegar, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: { append() {} } },
    addEventListener() {}, requestAnimationFrame: (f) => f(), cancelAnimationFrame() {},
    jsArg: JS_ARG, safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    showToast() {}, DADOS_DEMANDAS: [{}], TEAM_USERS: [], ownerAvatarHtml: () => '', firstName: (n) => String(n).split(/\s+/)[0],
    tagClienteHtml: (n) => n, cliCor: (n) => n, clienteAtivo: (c) => c.ativo !== false, descricaoCarteiraCliente: () => '',
    carteiraDoCliente: (n) => ({ 'Academia Lions': 'vinicius', Alpha1: 'ewerton' })[n] || '',
    HOJE_ISO: '2026-11-12', openWorkflowModal() {}, closeWorkflowModal() {}, ancorarPopover() {},
    clientesDoItem: (item) => [item.cliente], isRequestItem: (item) => item.pedido === true, DADOS: [],
    CLIENT_MASTER_ERROR: '', CLIENT_MASTER_LOADING: false, CLIENT_MASTER_LOADED: true, podeAdministrar: () => true,
    fetch: async (url, op = {}) => {
      if (op.method === 'POST') { postados.push(JSON.parse(op.body)); return { ok: true, json: async () => ({ reuniao: { id: '9', titulo: 'x' } }) }; }
      const id = /cliente=(\d+)/.exec(url)?.[1];
      return { ok: true, json: async () => ({ ok: true, pode: true, tipos: {}, questoes: [], reunioes: reunioes.filter((r) => r.cliente_id === id), pauta: [] }) };
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['vybe-clientes.js', 'vybe-clientes-ficha.js', 'vybe-clientes-reunioes.js']) vm.runInContext(ler(f), ctx);
  vm.runInContext(`
    CADASTRO_DEF = { secoes: [{ id: 'empresa', titulo: 'Empresa' }], campos: [
      { chave: 'cnpj', rotulo: 'CNPJ', secao: 'empresa', coluna: 'cnpj', obrigatorio: true },
      { chave: 'segmento', rotulo: 'Segmento', secao: 'empresa', coluna: 'segmento', obrigatorio: true } ] };
    CADASTRO_CLIENTES = [
      { id: 1, nome: 'Academia Lions', status: 'Ativo', ativo: true, heads: 'Vinícius', segmento: 'Academia', cnpj: '1', ultima_reuniao: '2026-10-22', cadastro: {} },
      { id: 2, nome: 'Alpha1', status: 'Ativo', ativo: true, heads: 'Ewerton', segmento: 'Solução empresarial', cadastro: {} },
    ];
    CLIENT_MASTER_HEADS = CADASTRO_CLIENTES.map((r) => ({ id: String(r.id), name: r.nome, people: r.heads, status: r.status, segment: r.segmento }));
    CLIENT_MASTER_ACESSOS = [];
    DADOS_ALL = [
      { id: 'a', nome: 'Card - Dia do cliente', cliente: 'Academia Lions', status: 'A Fazer', veiculacao_iso: '2026-11-02', responsavel: 'Deivid' },
      { id: 'b', nome: 'Reels - Novidade do mês', cliente: 'Academia Lions', status: 'Em andamento', veiculacao_iso: '2026-11-13', responsavel: 'Reriston' },
      { id: 'c', nome: 'Feed', cliente: 'Alpha1', status: 'A Fazer', veiculacao_iso: '2026-11-20' } ];
  `, ctx);
  ctx.VybeCarteira = { dados: () => [
    { cliente: 'Academia Lions', clienteId: 1, score: 46, risco: 'alto', motivos: ['1 peça com a veiculação vencida'] },
    { cliente: 'Alpha1', clienteId: 2, score: 70, risco: 'baixo', motivos: [] } ] };
  return { ctx, pegar, postados };
}

test('Clientes: Lista/Fichas/Cérebro, Mais e Novo cliente no alto; cartão laranja, folha da lista e pé', () => {
  const { ctx, pegar } = carregar();
  ctx.renderClientesBoard();
  const acoes = pegar('clientes-acoes');
  assert.match(acoes.innerHTML, /id="clientes-visao-topo"[\s\S]*id="clientes-mais"[\s\S]*class="cv2-novo d3f-novo"[^>]*>[\s\S]*Novo cliente</);
  assert.match(pegar('clientes-visao-topo').innerHTML, />Lista<[\s\S]*>Fichas<[\s\S]*>Cérebro</);
  assert.match(pegar('clientes-aviso').innerHTML, /class="d3-acao-av"[^>]*>M<\/span>Mateus · /);
  assert.equal(pegar('kpi-grid-clientes').hidden, true, 'os números viraram a frase do alto e o pé');
  assert.match(pegar('clientes-filtros').innerHTML, /Ativos <span>2<\/span>[\s\S]*Inativos[\s\S]*Carteira[\s\S]*Head[\s\S]*Colunas/);
  const tabela = ctx.tabelaDeClientesHtml(['Academia Lions', 'Alpha1']);
  assert.match(tabela, /class="v2-abre v2f-linha cv2-linha" data-cliente="Academia Lions" aria-expanded="false"/);
  assert.ok(tabela.indexOf('"Academia Lions"') < tabela.indexOf('"Alpha1"'), 'pior nota primeiro');
  assert.match(tabela, /2 peças <b class="cv2-ruim">· 1 vencida<\/b>/);
});

test('Ficha (prancha V2-M-Cliente-Ficha): o alto com as abas, o cartão laranja, As vencidas, Próximas entregas e a consulta', () => {
  const { ctx, pegar } = carregar();
  ctx.renderClientMasterDetail('Academia Lions');
  const cabeca = pegar('cliente-detalhe-cabeca').innerHTML;
  assert.match(cabeca, /clf-voltar" onclick="voltarClientesLista\(\)"[\s\S]*class="clf-nome fv2-nome">Academia Lions<[\s\S]*id="ficha-abas-topo"[\s\S]*Editar cadastro[\s\S]*Nova demanda/);
  const corpo = pegar('client-master-detail').innerHTML;
  const ordem = ['<h3>Próximas entregas', '<h3>Depois das vencidas', 'fv2-laranja', '<h3>As vencidas', '<b>Saúde</b>', '<b>Última reunião</b>', '<b>Dados e acessos</b>'].map((x) => corpo.indexOf(x));
  assert.ok(ordem.every((v, i) => v > -1 && (i === 0 || v > ordem[i - 1])), `ordem da prancha: ${ordem}`);
  // As abas ficam no alto (vybe-clientes-ficha.js as põe em #ficha-abas-topo).
  assert.match(ler('vybe-clientes-ficha.js'), /const topo = document\.getElementById\('ficha-abas-topo'\);\r?\n\s*if \(topo\) topo\.innerHTML = barra;/);
  assert.match(corpo, /class="fv2-nota r"[\s\S]*?<b>46<\/b>/);
  assert.match(corpo, /<b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">peça passou da veiculação<\/span><small>A mais antiga era para 02\/11\.<\/small>/);
  assert.match(corpo, /onclick="trocarAbaDaFicha\('conteudo'\)">Reagendar</);
  assert.match(corpo, /class="fv2-venc"[^>]*><i class="fv2-pt"[^>]*><\/i><span class="fv2-venc-t"><b>Card<\/b> · Dia do cliente<\/span><span class="fv2-venc-q">era 02\/11<\/span><i class="cv2-pes" title="Deivid"/);
  assert.match(corpo, /class="fv2-peca-tipo">Reels · 13\/11<\/span>[\s\S]*?<b>Novidade do mês<\/b>/);
  assert.match(corpo, /<b>Próxima reunião<\/b> · a última foi há 21 dias/);
});

test('Ficha: as listas completas viram as abas Conteúdo e Demandas; Financeiro e Ecossistema entram como abas', () => {
  const { ctx } = carregar();
  assert.deepEqual([...vm.runInContext('FICHA_ABAS.map(([id]) => id)', ctx)], ['geral', 'demandas', 'conteudo', 'reunioes', 'onboarding', 'financeiro', 'ecossistema', 'cerebro', 'cadastro']);
  const fonte = ler('vybe-clientes-ficha.js');
  // Prancha V2-M-Cliente-Conteudo: a aba desenha a lista com os mesmos editores da operação e o mesmo id.
  assert.match(fonte, /else if \(FICHA_ABA === 'conteudo'\) naAba\(conteudoDaFichaHtml\(nome\)\);/);
  assert.match(fonte, /idGrade: 'grid-cliente-producao'/);
  // Prancha V2-M-Cliente-Demandas: os pedidos passam pelo normalizador da operação e pela mesma linha.
  assert.match(fonte, /else if \(FICHA_ABA === 'demandas'\) naAba\(demandasDaFichaHtml\(nome\)\);/);
  assert.match(fonte, /idGrade: 'grid-cliente-demandas'/);
  assert.match(fonte, /normalizeRequestForOperational\(d\)/);
  assert.match(ler('vybe-clientes.js'), /if \(typeof FICHA_ABA === 'string' && \(FICHA_ABA === 'conteudo' \|\| FICHA_ABA === 'demandas'\)\) renderClientMasterDetail\(cli\);/);
  const linhaOp = fonte.slice(fonte.indexOf('function fv2LinhaOpHtml'), fonte.indexOf('function fv2FolhaOpHtml'));
  for (const editor of ['alternarSelecao(', 'pv2StatusBotao(d)', 'salvarDataNaLinha(', 'openItemWorkspace(', 'abrirPreviaDaEntrega(', 'pv2Av(d)']) assert.ok(linhaOp.includes(editor), `a linha da aba mantém ${editor}`);
  for (const lote of ["lotePrazo(event,'veiculacao')", 'loteResponsavel(event)', 'loteStatus(event)', 'fv2MaisDoLote(event)']) assert.ok(fonte.includes(lote), `o pé da lista chama ${lote}`);
  // Financeiro da ficha: só a conta do cliente, só para donos. Quem não é dono não vê a aba nem o valor.
  assert.match(fonte, /\.filter\(\(\[id\]\) => id !== 'financeiro' \|\| fichaEhDono\(\)\)/);
  assert.match(fonte, /if \(FICHA_ABA === 'financeiro' && !fichaEhDono\(\)\) FICHA_ABA = 'geral';/);
  ctx.souDonoDaSessao = () => false;
  assert.equal(ctx.financeiroDaFichaHtml('Academia Lions'), '<p class="d3v-estado"><b>Só os donos veem o financeiro do cliente.</b></p>');
  ctx.trocarAbaDaFicha('financeiro');
  assert.equal(vm.runInContext('FICHA_ABA', ctx), 'geral', 'quem não é dono volta para o Resumo');
});

test('Reuniões: janela própria com fala, três números, Pede ação que abre no lugar, lista e Nova reunião ao lado', async () => {
  const { ctx, postados } = carregar({ reunioes: [
    { id: '7', cliente_id: '2', data: '2026-11-05', tipo: 'rotina', titulo: 'Rotina', participantes: 'Ewerton, Beatriz', ata: '', pauta: '- Calendário',
      gravacao: { id: 'g1' }, transcricao: 'texto', sugestoes: { resumo: 'Resumo pronto', decisoes: ['Gravar depoimentos'], demandas: [{ titulo: 'Card' }, { titulo: 'Reels' }] } },
    { id: '8', cliente_id: '1', data: '2026-11-13', tipo: 'onboarding', titulo: 'Kickoff de entrada', participantes: 'Vinícius', ata: '' } ] });
  const fonte = ler('vybe-clientes-reunioes.js');
  assert.match(fonte, /window\.VybeReunioes = \{ reunioesHtml, onboardingHtml, carregar, temOnboarding, abrir, fechar: fecharTela, aberto: \(\) => Boolean\(tela\.raiz\), dadosDe \}/);
  await ctx.VybeReunioes.carregar('1'); await ctx.VybeReunioes.carregar('2');
  assert.match(fonte, /<h2 id="v2r-titulo">Reuniões<\/h2><span class="d3c-meta">\$\{esc\(diaHoje\)\}<\/span><button type="button" class="v2r-btn p" data-v2r-acao="nova">Nova reunião<\/button>/);
  assert.match(fonte, /kpi\('Esta semana'[\s\S]*kpi\('Sem ata'[\s\S]*kpi\('Demandas sugeridas'[\s\S]*kpi\('No mês'/);
  // Direção 3: Pede ação e a lista em cartões separados; a fala é o bloco de ação laranja.
  assert.match(fonte, /<section class="v2r-card v2r-pede" aria-label="Pede ação"><div data-v2r="pede"><\/div><\/section>/);
  assert.match(fonte, /d3AcaoHtml\(\{ frase: `\$\{quem\}\$\{frase\}`, agente: 'Mateus', botao, attrs \}\)/);
  assert.match(fonte, /class="v2-abre v2r-abre" aria-expanded="false"><div class="v2r-lin"><span class="v2r-pill r">Sem ata<\/span>/);
  assert.match(fonte, />Usar o resumo<\/button>[\s\S]*Pauta<\/b>[\s\S]*Ata<\/b>[\s\S]*Gravação<\/b>/);
  assert.match(fonte, /data-valor="todas" aria-pressed="true">Todas<[\s\S]*>Esta semana<[\s\S]*>Sem ata<[\s\S]*>Filtros</);
  assert.match(fonte, /Nenhuma reunião ainda\.[\s\S]*Marcar a primeira/);
  // O formulário salva pelo mesmo salvarReuniao, com os mesmos campos de antes.
  for (const id of ['reu-cliente', 'reu-tipo', 'reu-data', 'reu-titulo', 'reu-participantes', 'reu-pauta', 'reu-ata']) assert.match(fonte, new RegExp(`id="${id}"`));
  assert.match(fonte, /onclick="salvarReuniao\('', '', true\)">Salvar e gravar<[\s\S]*onclick="salvarReuniao\('', ''\)">Salvar</);
  assert.match(fonte, /postar\(\{ acao: 'salvar', cliente: id, id: reuniaoId \|\| undefined, tipo: v\('tipo'\), data: v\('data'\), titulo: v\('titulo'\), participantes: v\('participantes'\), pauta: v\('pauta'\), ata: v\('ata'\) \}\)/,
    'o corpo enviado ao servidor não mudou');
  assert.equal(postados.length, 0, 'abrir e ler não grava nada');
  assert.equal(ctx.VybeReunioes.dadosDe('2').reunioes.length, 1);
});

test('CSS: tudo em padrao-v2/ficha.css, sem !important nem html body.mundo', () => {
  const css = ler('padrao-v2/ficha.css');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(css, /#painel-clientes \.v2f-tabela/);
  assert.match(css, /\.vc-camada > #vv-reunioes/);
});

test('Abas da ficha nas pranchas V2-M-Cliente-*: o esqueleto novo mantém as funções e o dinheiro só para donos', () => {
  const ficha = ler('vybe-clientes-ficha.js'), reu = ler('vybe-clientes-reunioes.js');
  // Toda aba fora do Resumo e do Cadastro usa o mesmo esqueleto (folhas + consulta no vidro).
  for (const aba of ['conteudo', 'demandas', 'ecossistema', 'cerebro', 'financeiro']) assert.match(ficha, new RegExp(`fv2DuasHtml\\('${aba}'`), `a aba ${aba} está no esqueleto`);
  for (const aba of ['reunioes', 'onboarding']) assert.match(reu, new RegExp(`fv2DuasHtml\\('${aba}'`), `a aba ${aba} está no esqueleto`);
  // Reuniões: gravar, editar a ata, ouvir a gravação e cadastrar as demandas sugeridas seguem pelos mesmos caminhos.
  const abaReu = reu.slice(reu.indexOf('function reunioesHtml'), reu.indexOf('function sugestoesHtml'));
  for (const f of ["gravarReuniao('", "abrirReuniao('", 'sugestoesHtml(r, pode)', 'pararGravacao()', 'https://drive.google.com/file/d/']) assert.ok(abaReu.includes(f), `a aba Reuniões mantém ${f}`);
  assert.match(reu, /data-reu-sug="\$\{esc\(r\.id\)\}"/);
  // Onboarding: preencher junto e o link do cliente são os mesmos.
  const abaOnb = reu.slice(reu.indexOf('function onboardingHtml'), reu.indexOf('window.abrirQuestionario'));
  for (const f of ["abrirQuestionario('", "onboardingLink('"]) assert.ok(abaOnb.includes(f), `a aba Onboarding mantém ${f}`);
  // Ecossistema: os botões que resolvem vêm do mesmo mapa de ações; a janela de depois do cadastro não mudou.
  assert.match(ficha, /const acao = ECO_ACAO\[s\.acao\];/);
  assert.match(ficha, /if \(alvo\) alvo\.innerHTML = ecossistemaHtml\(dados, nome\);/);
  // Cérebro: o cartão guarda o id que o Resumo remove e o mapa abre o mesmo cérebro.
  assert.match(ficha, /id="vybes-cli-cerebro-card"/);
  assert.match(ficha, /abrirModalCerebroCliente\('\$\{n\}', 'mapa'\)/);
  // Financeiro: quem não é dono não desenha número nem pede a leitura de Finanças por cliente ao servidor.
  assert.match(ficha, /function financasDaFicha\(aoChegar\) \{\s*if \(!fichaEhDono\(\)\) return null;/);
  assert.match(ficha, /function financeiroDaFichaHtml\(nome\) \{\s*if \(!fichaEhDono\(\)\) return '<p class="d3v-estado"><b>Só os donos veem o financeiro do cliente\.<\/b><\/p>';/);
  // CSS das abas: só tokens, sem !important, sem html body.mundo, sem :has com [style] e sem animação que nasce invisível.
  const css = ler('padrao-v2/zm-b-ficha2-abas.css');
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\([^)]*\[style|@keyframes/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, 'cor só por token --d3-*');
});
