// Padrão v2, grupo "ficha" (12/11/2026): Gestão de clientes, Ficha do cliente e Reuniões iguais aos quadros DEPOIS do
// moodboard. Carrega os arquivos de verdade com o mínimo do navegador e confere a estrutura de cada quadro, que o CSS
// fica todo em padrao-v2/ficha.css e que o que vai para o servidor continua igual.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

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
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
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

test('Clientes: título com Tabela/Fichas/Cérebro, Cadastros e Novo cliente; fala, três números, barra e tabela', () => {
  const { ctx, pegar } = carregar();
  ctx.renderClientesBoard();
  const acoes = pegar('clientes-acoes');
  assert.equal(acoes.className, 'v2f-topo-acoes');
  assert.match(acoes.innerHTML, /id="clientes-visao-topo"[\s\S]*>Cadastros<[\s\S]*class="v2f-btn p d3f-novo"[^>]*>Novo cliente</);
  assert.match(pegar('clientes-visao-topo').innerHTML, />Tabela<[\s\S]*>Fichas<[\s\S]*>Cérebro</);
  assert.match(pegar('clientes-aviso').innerHTML, /class="v2f-ag"[\s\S]*Mateus · Atendimento ao cliente/);
  // Direção 3: quatro números (Ativos, Sem reunião registrada, Com NPS, Só na operação).
  assert.equal((pegar('kpi-grid-clientes').innerHTML.match(/class="v2f-card v2f-kpi d3-num/g) || []).length, 4, 'quatro números');
  assert.match(pegar('clientes-filtros').innerHTML, /Ativos <b>2<\/b>[\s\S]*Inativos[\s\S]*Carteira[\s\S]*Head[\s\S]*Filtros[\s\S]*Colunas/);
  const tabela = ctx.tabelaDeClientesHtml(['Academia Lions', 'Alpha1']);
  assert.match(tabela, /class="v2-abre v2f-linha" data-cliente="Academia Lions" aria-expanded="false"/);
  assert.ok(tabela.indexOf('"Academia Lions"') < tabela.indexOf('"Alpha1"'), 'pior nota primeiro');
  assert.match(tabela, /2 conteúdos · <b class="v2f-ruim">1 vencido<\/b>/);
});

test('Ficha: linha do alto, nota com o porquê, fala, abas com contagem, Pede ação, entregas e Dados e acessos', () => {
  const { ctx, pegar } = carregar();
  ctx.renderClientMasterDetail('Academia Lions');
  assert.match(pegar('cliente-detalhe-cabeca').innerHTML, /‹<\/span> Clientes[\s\S]*style="color:#C2490C">Academia Lions<[\s\S]*Editar cadastro[\s\S]*Nova demanda/);
  const corpo = pegar('client-master-detail').innerHTML;
  const ordem = ['v2f-saude', 'v2f-fala', '<h3>Pede ação', '<h3>Próximas entregas', '<h3>Última reunião', '<h3>Dados e acessos'].map((x) => corpo.indexOf(x));
  assert.ok(ordem.every((v, i) => v > -1 && (i === 0 || v > ordem[i - 1])), `ordem do quadro: ${ordem}`);
  // A barra de abas entra logo depois da nota e da fala (insertAdjacentHTML('afterend') no .v2f-alto).
  assert.match(ler('vybe-clientes-ficha.js'), /if \(alto\) alto\.insertAdjacentHTML\('afterend', barra\)/);
  assert.match(corpo, /style="color:#B42318"><span class="v2-num">46</);
  assert.match(corpo, /class="v2f-pill r">1 peça com a veiculação vencida</);
  assert.match(corpo, /reunião há 21 dias/);
  assert.match(corpo, /<b>1 peça passou da veiculação<\/b> e a última reunião foi há 21 dias\. Eu começaria pelas vencidas\./);
  assert.match(corpo, /class="v2-abre v2f-abre" aria-expanded="false"[\s\S]*1 vencida[\s\S]*Card · Dia do cliente, era para 02\/11, com Deivid/);
  assert.match(corpo, /Reels · Novidade do mês<\/b><\/p>[\s\S]*veicula amanhã/);
  assert.match(corpo, />Conteúdo<b class="v2f-q">2<\/b>/);
  assert.doesNotMatch(corpo, /role="tab"[^>]*>Cadastro</, 'Cadastro abre pela nota e por Editar cadastro');
});

test('Ficha: as listas completas viram as abas Conteúdo e Demandas', () => {
  const { ctx } = carregar();
  assert.deepEqual([...vm.runInContext('FICHA_ABAS.map(([id]) => id)', ctx)], ['geral', 'demandas', 'conteudo', 'reunioes', 'onboarding', 'cadastro', 'ecossistema', 'cerebro']);
  assert.match(ler('vybe-clientes-ficha.js'), /if \(conteudos\) conteudos\.hidden = FICHA_ABA !== 'conteudo';/);
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
