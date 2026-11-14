// Redesign das telas de Clientes (quadros 50, 51 e 52 do moodboard, 10/11/2026).
// Carrega vybe-clientes.js e vybe-clientes-ficha.js de verdade, com o mínimo do navegador, e confere o que
// a tela promete: colunas novas da tabela, filtros em chips, a ficha com os três números e o Ecossistema.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function elemento(id) {
  return { id, innerHTML: '', textContent: '', className: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, remove() {}, querySelector: () => null,
    querySelectorAll: () => [], insertAdjacentHTML(_, html) { this.innerHTML = html + this.innerHTML; } };
}

function carregar() {
  const els = new Map();
  const pegar = (id) => { if (!els.has(id)) els.set(id, elemento(id)); return els.get(id); };
  const ctx = {
    console, Intl, URL, Map, Set, Promise, setTimeout, Math, Number, String, JSON, Date,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: pegar, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    showToast() {}, DADOS_DEMANDAS: [{}], TEAM_USERS: [{ name: 'Vinícius', photo: 'https://www.habbo.com/habbo-imaging/avatarimage?figure=hd-180-1&headonly=1' }],
    ownerAvatarHtml: (u) => (u.photo ? `<img src="${u.photo}" alt="${u.name}">` : `<span class="owner-avatar-fallback">${u.name}</span>`),
    firstName: (n) => String(n).split(/\s+/)[0],
    tagClienteHtml: (n) => `<span class="cliente-carteira">${n}</span>`, cliCor: (n) => `<span class="cliente-carteira">${n}</span>`,
    mapaCabecaUrl: () => 'https://www.habbo.com/habbo-imaging/avatarimage?figure=padrao&headonly=1',
    clienteAtivo: (c) => c.ativo !== false, descricaoCarteiraCliente: () => '',
    atualizarCoresDasCarteiras() {}, filtroCarteira: 'all', HOJE_ISO: '2026-11-10',
    openWorkflowModal() {}, closeWorkflowModal() {}, ancorarPopover() {},
    // A operação: quem é cliente da peça e se ela é pedido (vybe-core.js e vybe-agenda.js no painel).
    clientesDoItem: (item) => [item.cliente], isRequestItem: (item) => item.pedido === true, DADOS: [],
    CLIENT_MASTER_ERROR: '', CLIENT_MASTER_LOADING: false, CLIENT_MASTER_LOADED: true,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('vybe-clientes.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('vybe-clientes-ficha.js', 'utf8'), ctx);
  // Um cadastro de dois clientes, com a definição do cadastro (12 essenciais no servidor; aqui 3) e a operação.
  vm.runInContext(`
    CADASTRO_DEF = { secoes: [{ id: 'empresa', titulo: 'Empresa' }], campos: [
      { chave: 'cnpj', rotulo: 'CNPJ', secao: 'empresa', coluna: 'cnpj', obrigatorio: true },
      { chave: 'segmento', rotulo: 'Segmento', secao: 'empresa', coluna: 'segmento', obrigatorio: true },
      { chave: 'cidade', rotulo: 'Cidade', secao: 'empresa', obrigatorio: true },
      { chave: 'site', rotulo: 'Site', secao: 'empresa' } ] };
    CADASTRO_CLIENTES = [
      { id: 1, nome: 'Academia Lions', status: 'Ativo', ativo: true, heads: 'Vinícius', segmento: 'Academia', cnpj: '1', plano: 'Plus', dashboard: 'Atualizado', nps: 9, ultima_reuniao: '2026-11-01', cadastro: { cidade: 'Irecê' } },
      { id: 2, nome: 'Alpha1', status: 'Ativo', ativo: true, heads: 'Ewerton', segmento: 'Solução empresarial', cadastro: {} },
    ];
    CLIENT_MASTER_HEADS = CADASTRO_CLIENTES.map((r) => ({ id: String(r.id), name: r.nome, people: r.heads, status: r.status, segment: r.segmento, plan: r.plano || '' }));
    CLIENT_MASTER_ACESSOS = [];
    DADOS_ALL = [
      { id: 'a', cliente: 'Academia Lions', status: 'A Fazer' }, { id: 'b', cliente: 'Academia Lions', status: 'Finalizado' },
      { id: 'c', cliente: 'Alpha1', status: 'A Fazer' } ];
    DADOS_DEMANDAS = [{ id: 'd', cliente: 'Academia Lions', status: 'Em andamento', pedido: true }];
  `, ctx);
  ctx.window.VybeCarteira = { dados: () => [
    { cliente: 'Academia Lions', clienteId: 1, score: 88, risco: 'baixo', motivos: [] },
    { cliente: 'Alpha1', clienteId: 2, score: 42, risco: 'alto', motivos: ['3 peças atrasadas'] } ] };
  return { ctx, pegar };
}

test('tabela de clientes (quadro Clientes do padrão v2): Cliente, Head, Saúde, Em aberto e Cadastro; a linha abre no lugar', () => {
  const { ctx } = carregar();
  const nomes = vm.runInContext('clientMasterRecords().map((r) => r.name)', ctx);
  assert.ok(nomes.includes('Academia Lions') && nomes.includes('Alpha1'));
  const html = ctx.tabelaDeClientesHtml(nomes);
  const cabecalho = html.slice(html.indexOf('class="v2f-th"'), html.indexOf('data-cliente='));
  for (const sai of ['Dashboard', 'Última reunião', 'NPS', 'Manus', 'Status', 'Drive', 'Documento', 'Segmento', 'Plano']) assert.doesNotMatch(cabecalho, new RegExp(`>${sai}<`), sai);
  for (const entra of ['Cliente', 'Head', 'Saúde', 'Em aberto', 'Cadastro']) assert.match(cabecalho, new RegExp(`>${entra}<`), entra);
  // A pior nota no alto: quem precisa de você primeiro.
  assert.ok(html.indexOf('data-cliente="Alpha1"') < html.indexOf('data-cliente="Academia Lions"'));
  const linha = html.slice(html.indexOf('data-cliente="Academia Lions"'));
  assert.match(linha, /<b style="color:#11613A">88<\/b><div class="v2-barra"><i style="--v:88%;--c:#11613A">/);
  assert.match(linha, /1 conteúdo<\/span>/, 'o finalizado não conta como em aberto');
  assert.match(linha, /class="v2f-pill g">completo</);
  assert.match(linha, /class="v2f-seg2">· Academia · Plus</);
  assert.match(linha, /<b>Em aberto<\/b> · 1 conteúdo · 1 pedido/, 'o pedido vai para o detalhe que abre');
  assert.match(linha, /class="v2f-btn s k" onclick="abrirClienteDetalhe\('Academia Lions'\)">Abrir a ficha/);
  const outra = html.slice(html.indexOf('data-cliente="Alpha1"'), html.indexOf('data-cliente="Academia Lions"'));
  assert.match(outra, /<b style="color:#B42318">42<\/b>/);
  assert.match(outra, /faltam 2 de 3/);
  assert.match(outra, /<b>Saúde 42<\/b> · 3 peças atrasadas/);
  // Direção 3: o pé sem frase explicativa; a ordem segue no título de cada coluna e o resto em Colunas.
  assert.doesNotMatch(html, /o título da coluna muda a ordem/);
  assert.match(html, /class="v2f-pe d3f-pe">/);
});

test('filtros da lista: head, segmento e busca recortam; a barra é Ativos, Inativos, Carteira, Head, Filtros e Colunas', () => {
  const { ctx, pegar } = carregar();
  vm.runInContext("FILTRO_CLIENTES.situacao = ''", ctx);
  const filtra = () => vm.runInContext("clientMasterRecords().map((r) => r.name).filter((n) => passaNosFiltrosDeClientes(n))", ctx);
  assert.deepEqual([...filtra()].sort(), ['Academia Lions', 'Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.head = 'ewerton'", ctx);
  assert.deepEqual([...filtra()], ['Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.head = ''; FILTRO_CLIENTES.segmento = 'academia'", ctx);
  assert.deepEqual([...filtra()], ['Academia Lions']);
  vm.runInContext("FILTRO_CLIENTES.segmento = ''; FILTRO_CLIENTES.busca = 'alp'", ctx);
  assert.deepEqual([...filtra()], ['Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.busca = ''; FILTRO_CLIENTES.head = 'vinicius'", ctx);
  ctx.pintarFiltrosDeClientes([{ label: 'Sem contato', foco: 'sem-contato', value: 0, aceso: false }]);
  const chips = pegar('clientes-filtros').innerHTML;
  assert.match(chips, /aria-pressed="true"[^>]*>Head: Vinícius/);
  assert.doesNotMatch(chips, /Sem contato/, 'os recortes ficam em Filtros');
  assert.match(chips, /abrirFiltrosDeClientes\(this\)">Filtros</);
  assert.match(chips, /escolherColunasDeClientes\(this\)">Colunas</);
  const opcoes = vm.runInContext("opcoesDeFiltroDeClientes('head').map((o) => o.rotulo)", ctx);
  assert.deepEqual([...opcoes], ['Todos os heads', 'Ewerton (1)', 'Vinícius (1)']);
  ctx.selosDeVisaoDeClientes();
  assert.match(pegar('clientes-visao-topo').innerHTML, /role="tab" aria-selected="true"[^>]*>Tabela</, 'Tabela, Fichas e Cérebro sobem para o cabeçalho');
  assert.equal(pegar('clientes-visao').innerHTML, '');
});

test('cabeçalho da lista: a fala do Mateus, três números e Novo cliente como a ação da tela', () => {
  const { ctx, pegar } = carregar();
  ctx.podeAdministrar = () => true;
  ctx.renderClientesBoard();
  assert.equal(pegar('clientes-frase').textContent, '');
  assert.match(pegar('clientes-acoes').innerHTML, /class="v2f-btn" onclick="openCadastrosStation\(\)">Cadastros<\/button><button type="button" class="v2f-btn p d3f-novo" onclick="novoClienteNoPainel\(\)">Novo cliente/);
  // Direção 3: quatro números, com o "de quantos" e a barra em "Sem reunião registrada".
  const kpis = pegar('kpi-grid-clientes').innerHTML;
  assert.match(kpis, /<small class="d3-num-rot">Ativos<\/small><b class="d3-num-v">2<\/b><small class="d3c-sub">1 em dia · 1 em risco alto<\/small>/);
  assert.match(kpis, /<small class="d3-num-rot">Sem reunião registrada<\/small><b class="d3-num-v" style="animation-delay:.12s">1<small> \/ 2<\/small><\/b><span class="d3-barra r" style="--v:50%">/);
  assert.match(kpis, /<small class="d3-num-rot">Com NPS<\/small><b class="d3-num-v" style="animation-delay:.24s">1<small> \/ 2<\/small><\/b><small class="d3c-sub">média 9,0 · 0 detratores · 0 sem contato/);
  assert.match(kpis, /<small class="d3-num-rot">Só na operação<\/small>/);
  const fala = pegar('clientes-aviso').innerHTML;
  assert.match(fala, /Mateus · Atendimento ao cliente/);
  assert.match(fala, /Um cliente está em dia e 1 em risco alto\./);
  assert.match(fala, /onclick="focarClientes\('sem-registro'\)">Completar cadastros</);
});

test('ficha (quadro Ficha do cliente): uma linha no alto, a nota com o porquê, a fala, Pede ação, entregas e Dados e acessos', () => {
  const { ctx, pegar } = carregar();
  ctx.podeAdministrar = () => true;
  ctx.renderClientMasterDetail('Academia Lions');
  const cabeca = pegar('cliente-detalhe-cabeca').innerHTML;
  assert.match(cabeca, /clf-voltar" onclick="voltarClientesLista\(\)">/);
  assert.match(cabeca, /class="clf-nome v2f-nome"[^>]*>Academia Lions<\/h2><button[^>]*cli-situacao ativo/);
  assert.match(cabeca, /Academia[\s\S]*Plus[\s\S]*head[\s\S]*Vinícius/);
  assert.match(cabeca, /Editar cadastro[\s\S]*class="v2f-btn p" onclick="openCadastrosGoverned\(\{ client: 'Academia Lions' \}\)">Nova demanda/);
  const corpo = pegar('client-master-detail').innerHTML;
  assert.match(corpo, /class="v2f-nota" style="color:#11613A"><span class="v2-num">88</);
  assert.match(corpo, /reunião há 9 dias/);
  assert.match(corpo, /onclick="trocarAbaDaFicha\('cadastro'\)">cadastro 3 de 3</);
  assert.match(corpo, /Mateus · Atendimento ao cliente/);
  assert.match(corpo, /<h3>Pede ação<\/h3>[\s\S]*Próxima reunião<\/b> ainda não marcada[\s\S]*>Marcar reunião</);
  assert.match(corpo, /<h3>Próximas entregas<\/h3><span class="v2f-sub">1 conteúdo em aberto · 1 pedido/);
  assert.match(corpo, /<h3>Última reunião<\/h3>/);
  assert.match(corpo, /<h3>Dados e acessos<\/h3>[\s\S]*Drive<\/b> do cliente[\s\S]*Documento de acessos[\s\S]*>Ver acessos<[\s\S]*Link do projeto/);
  assert.match(corpo, /Painel do cliente[\s\S]*Atualizado/, 'o estado do painel continua na ficha, em Ver acessos');
  assert.match(corpo, /class="ficha-abas v2f-seg"[\s\S]*>Resumo<[\s\S]*>Demandas<b class="v2f-q">1<\/b>[\s\S]*>Conteúdo<b class="v2f-q">1<\/b>[\s\S]*>Reuniões</);
  assert.match(corpo, /class="v2f-chip"[^>]*>Ecossistema<[\s\S]*>Cérebro</);
  assert.doesNotMatch(corpo, /class="cli-mais"/, 'sem os "+" soltos');
});

test('ecossistema: selo com texto à esquerda, barra "n de 6" e laranja só no que falta', () => {
  const { ctx } = carregar();
  ctx.podeAdministrar = () => true;
  const html = ctx.ecossistemaHtml({ dados: { cliente: { id: 2, nome: 'Alpha1' }, sistemas: [
    { nome: 'Vybe OS', estado: 'ok', detalhe: 'Ativo.', acao: 'cadastro' },
    { nome: 'Bots e WhatsApp', estado: 'falta', detalhe: 'Falta o grupo.', acao: 'grupo' },
    { nome: 'Vybe Hub', estado: 'conferir', detalhe: 'O portal.', link: 'https://hub.exemplo' },
  ] } }, 'Alpha1');
  assert.match(html, /<b>1 de 3<\/b> sistemas com tudo certo/);
  assert.match(html, /class="eco-progresso" role="progressbar"[^>]*aria-valuemax="3" aria-valuenow="1"[\s\S]*width:33%/);
  const itens = html.split('<li ').slice(1);
  assert.equal(itens.length, 3, 'mesma informação, mesma ordem');
  assert.match(itens[0], /eco-ok"><span class="eco-estado"><i aria-hidden="true"><\/i>Ligado<\/span>[\s\S]*class="vb-botao" onclick[^>]*>Completar cadastro/);
  assert.match(itens[1], /Falta<\/span>[\s\S]*class="vb-botao principal"[^>]*>Informar o grupo/);
  assert.match(itens[2], /Conferir<\/span>[\s\S]*<a class="vb-botao" href="https:\/\/hub.exemplo"/);
  assert.doesNotMatch(fs.readFileSync('vybe-mundo-clientes-ficha.css', 'utf8'), /.eco-item{[^}]*inset|--eco-barra/, 'sem a faixa colorida na borda');
});
