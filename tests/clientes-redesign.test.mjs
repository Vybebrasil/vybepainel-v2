// Redesign das telas de Clientes (quadros 50, 51 e 52 do moodboard, 10/11/2026).
// Carrega vybe-clientes.js e vybe-clientes-ficha.js de verdade, com o mínimo do navegador, e confere o que
// a tela promete: colunas novas da tabela, filtros em chips, a ficha com os três números e o Ecossistema.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { jsArg as JS_ARG } from './apoio-js-arg.mjs';

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
    jsArg: JS_ARG, safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
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

test('lista de clientes (prancha V2-M-Clientes): Cliente, Head, Saúde, Em aberto, Reunião e Cadastro; a pior nota primeiro; a linha abre no lugar', () => {
  const { ctx } = carregar();
  const nomes = vm.runInContext('clientMasterRecords().map((r) => r.name)', ctx);
  assert.ok(nomes.includes('Academia Lions') && nomes.includes('Alpha1'));
  const html = ctx.tabelaDeClientesHtml(nomes);
  const cabecalho = html.slice(html.indexOf('class="cv2-th"'), html.indexOf('data-cliente='));
  for (const sai of ['Dashboard', 'Última reunião', 'NPS', 'Manus', 'Status', 'Drive', 'Documento', 'Segmento', 'Plano']) assert.doesNotMatch(cabecalho, new RegExp(`>${sai}<`), sai);
  for (const entra of ['Cliente', 'Head', 'Saúde', 'Em aberto', 'Reunião', 'Cadastro']) assert.match(cabecalho, new RegExp(`>${entra}<`), entra);
  // A pior nota no alto: quem precisa de você primeiro, com "Agora" e "Depois" na margem.
  assert.ok(html.indexOf('data-cliente="Alpha1"') < html.indexOf('data-cliente="Academia Lions"'));
  const linha = html.slice(html.indexOf('data-cliente="Academia Lions"'));
  assert.match(linha, /<span class="cv2-grupo">Depois<\/span>/);
  assert.match(linha, /<span class="cv2-sa g" title="Nota 88 de 100"><b>88<\/b><span class="cv2-barra"><i style="--v:88%">/);
  assert.match(linha, /<span class="cv2-ab">1 peça<\/span>/, 'o finalizado não conta como em aberto');
  assert.match(linha, /class="cv2-cd cheio" title="Cadastro completo">/);
  assert.match(linha, /<b>Academia Lions<\/b> <span>· Academia<\/span>/);
  assert.match(linha, /<b>Em aberto<\/b> · 1 peça · 1 pedido · plano Plus/, 'o pedido e o plano vão para o detalhe que abre');
  assert.match(linha, /class="d3v-btn s cv2-abrir-ficha" onclick="abrirClienteDetalhe\('Academia Lions'\)">Abrir a ficha/);
  const outra = html.slice(html.indexOf('data-cliente="Alpha1"'), html.indexOf('data-cliente="Academia Lions"'));
  assert.match(outra, /<span class="cv2-grupo r">Agora<\/span>/);
  assert.match(outra, /<span class="cv2-sa r" title="Nota 42 de 100"><b>42<\/b>/);
  assert.match(outra, /class="cv2-cd" title="Faltam: [^"]*">[\s\S]*?1\/3<\/span>/, 'o cadastro é o anel com o que já está feito');
  assert.match(outra, /class="cv2-re[^"]* sem"[^>]*>sem data</, 'sem próxima reunião marcada');
  assert.match(outra, /<b>Saúde 42<\/b> · 3 peças atrasadas/);
  // A lista inteira fica na folha, que rola por dentro: sem o corte "+N clientes".
  assert.doesNotMatch(html, /d3f-mais|\+\d+ clientes/);
  // As fichas (prancha V2-M-Clientes-Fichas): o cartão abre a ficha e não leva mais Drive, documento, CNPJ e endereço.
  const fichas = ctx.fichasDeClientesHtml(nomes);
  assert.match(fichas, /class="cv2-ficha" data-cliente="Alpha1" onclick="abrirClienteDetalhe\('Alpha1'\)"/);
  assert.ok(fichas.indexOf('data-cliente="Alpha1"') < fichas.indexOf('data-cliente="Academia Lions"'), 'pior nota primeiro também nas fichas');
  assert.doesNotMatch(fichas, /CNPJ|Drive|Documento/);
});

test('filtros da lista: head, segmento e busca recortam; a folha traz Ativos, Inativos, Carteira, Head e Colunas, e os recortes ficam em Mais', () => {
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
  assert.match(chips, /data-ligado="true"[^>]*>Head: Vinícius/);
  assert.doesNotMatch(chips, /Sem contato/, 'os recortes ficam em Mais > Filtros');
  assert.doesNotMatch(chips, /abrirFiltrosDeClientes/, 'sem recorte ligado, a folha não mostra o botão de filtros');
  assert.match(chips, /escolherColunasDeClientes\(this\)">Colunas</);
  assert.equal(typeof ctx.abrirMaisDeClientes, 'function');
  assert.equal(typeof ctx.abrirFiltrosDeClientes, 'function');
  // Com um recorte ligado, a folha diz qual é e o clique abre os filtros.
  ctx.pintarFiltrosDeClientes([{ label: 'Sem contato', foco: 'sem-contato', value: 0, aceso: true }]);
  vm.runInContext("FOCO_DE_CLIENTES = 'sem-contato'", ctx);
  ctx.pintarFiltrosDeClientes([{ label: 'Sem contato', foco: 'sem-contato', value: 0, aceso: true }]);
  assert.match(pegar('clientes-filtros').innerHTML, /data-v2f-filtros[^>]*onclick="abrirFiltrosDeClientes\(this\)">Sem contato</);
  vm.runInContext("FOCO_DE_CLIENTES = 'todos'", ctx);
  const opcoes = vm.runInContext("opcoesDeFiltroDeClientes('head').map((o) => o.rotulo)", ctx);
  assert.deepEqual([...opcoes], ['Todos os heads', 'Ewerton (1)', 'Vinícius (1)']);
  ctx.selosDeVisaoDeClientes();
  assert.match(pegar('clientes-visao-topo').innerHTML, /role="radio" aria-checked="true"[^>]*>Lista</, 'Lista, Fichas e Cérebro ficam no alto');
  assert.equal(pegar('clientes-visao').innerHTML, '');
});

test('alto e coluna de consulta: a frase da carteira, o cartão laranja de quem precisa de você, Abrir como e o pé "De olho"', () => {
  const { ctx, pegar } = carregar();
  ctx.podeAdministrar = () => true;
  ctx.renderClientesBoard();
  assert.equal(pegar('clientes-frase').textContent, '2 ativos · nota média 65 de 100');
  assert.match(pegar('clientes-acoes').innerHTML, /id="clientes-mais"[^>]*onclick="abrirMaisDeClientes\(this\)"/);
  assert.match(pegar('clientes-acoes').innerHTML, /class="cv2-novo d3f-novo" onclick="novoClienteNoPainel\(\)">[\s\S]*Novo cliente/);
  // Os quatro cartões de número saíram: viraram a frase do alto e o pé.
  assert.equal(pegar('kpi-grid-clientes').hidden, true);
  assert.equal(pegar('kpi-grid-clientes').innerHTML, '');
  const fala = pegar('clientes-aviso').innerHTML;
  assert.match(fala, /class="d3-acao d3m-laranja cv2-laranja"/);
  assert.match(fala, /Mateus · quem precisa de você/);
  assert.match(fala, /<b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">cliente com nota abaixo de 52<\/span>/);
  assert.match(fala, /A pior nota é de Alpha1: 42\./);
  assert.match(fala, /onclick="abrirClienteDetalhe\('Alpha1'\)"><span>Abrir Alpha1</);
  const consulta = pegar('clientes-consulta').innerHTML;
  for (const r of ['A carteira', 'Por head', 'Abrir como', 'Fichas', 'Cérebro', 'Cadastros']) assert.ok(consulta.includes(r), r);
  assert.match(consulta, /onclick="trocarVisaoDeClientes\('fichas'\)"/);
  assert.match(consulta, /onclick="filtrarClientesPorHead\('ewerton'\)"/);
  const pe = pegar('clientes-pe').innerHTML;
  assert.match(pe, /De olho/);
  assert.match(pe, /<b>1<\/b><small>sem próxima reunião<\/small>|<b>2<\/b><small>sem próxima reunião<\/small>/);
  assert.match(pe, /onclick="focarClientes\('cadastro-incompleto'\)"><b>1<\/b><small>com cadastro incompleto/);
  assert.match(pe, /onclick="focarClientes\('com-nps'\)"><b>1<\/b><small>com NPS/);
  // Sem ninguém abaixo da nota de alerta, o laranja pede o registro de reunião (o mesmo recorte de antes).
  ctx.window.VybeCarteira = { dados: () => [] };
  ctx.renderClientesBoard();
  assert.match(pegar('clientes-aviso').innerHTML, /onclick="focarClientes\('sem-registro'\)">Completar cadastros</);
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
