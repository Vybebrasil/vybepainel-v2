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

test('tabela de clientes: saem Dashboard, Última reunião, NPS e Manus; entram saúde, em aberto e cadastro', () => {
  const { ctx } = carregar();
  const nomes = vm.runInContext('clientMasterRecords().map((r) => r.name)', ctx);
  assert.ok(nomes.includes('Academia Lions') && nomes.includes('Alpha1'));
  const html = ctx.tabelaDeClientesHtml(nomes);
  const cabecalho = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
  for (const sai of ['Dashboard', 'Última reunião', 'NPS', 'Manus']) assert.doesNotMatch(cabecalho, new RegExp(`>${sai}<`), sai);
  for (const entra of ['Saúde', 'Em aberto', 'Cadastro', 'Head', 'Segmento']) assert.match(cabecalho, new RegExp(`>${entra}<`), entra);
  // Quadro 05: Status, Drive e Documento saem da frente; ficam no menu Colunas e na ficha.
  for (const sai of ['Status', 'Drive', 'Documento']) assert.doesNotMatch(cabecalho, new RegExp(`>${sai}<`), sai);
  const linha = html.slice(html.indexOf('data-cliente="Academia Lions"'), html.indexOf('</tr>', html.indexOf('data-cliente="Academia Lions"')));
  assert.match(linha, /class="cli-saude ok"[^>]*><i aria-hidden="true"><\/i><b>88<\/b>/);
  assert.match(linha, /<b>1<\/b> conteúdo<\/span>/, 'o finalizado não conta como em aberto');
  assert.match(linha, /<b>1<\/b> pedido<\/span>/);
  assert.match(linha, /aria-valuenow="3"[^>]*aria-label="Cadastro"/);
  assert.match(linha, /3 de 3/);
  assert.match(linha, /class="cli-head"[\s\S]*habbo-imaging[\s\S]*cli-head-nome">Vinícius</, 'head com retrato e nome');
  const outra = html.slice(html.indexOf('data-cliente="Alpha1"'));
  assert.match(outra, /class="cli-saude ruim"[^>]*title="Nota 42 de 100, risco alto: 3 peças atrasadas"/);
  assert.match(outra, /1 de 3/);
  assert.match(outra, /figure=padrao/, 'sem personagem: o boneco padrão, nunca o círculo cinza');
});

test('filtros da lista: head, segmento e busca recortam; os chips mostram o escolhido', () => {
  const { ctx, pegar } = carregar();
  const filtra = () => vm.runInContext("clientMasterRecords().map((r) => r.name).filter((n) => passaNosFiltrosDeClientes(n))", ctx);
  assert.deepEqual([...filtra()].sort(), ['Academia Lions', 'Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.head = 'ewerton'", ctx);
  assert.deepEqual([...filtra()], ['Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.head = ''; FILTRO_CLIENTES.segmento = 'academia'", ctx);
  assert.deepEqual([...filtra()], ['Academia Lions']);
  vm.runInContext("FILTRO_CLIENTES.segmento = ''; FILTRO_CLIENTES.busca = 'alp'", ctx);
  assert.deepEqual([...filtra()], ['Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.busca = ''; FILTRO_CLIENTES.head = 'vinicius'", ctx);
  ctx.pintarFiltrosDeClientes([{ label: 'Sem contato', value: 0, acao: "focarClientes('sem-contato')", tom: 'alerta', dica: 'x', aceso: false }]);
  const chips = pegar('clientes-filtros').innerHTML;
  assert.match(chips, /aria-pressed="true"[^>]*>Head: Vinícius/);
  assert.doesNotMatch(chips, /Sem contato <b>0<\/b>/, 'quadro 05: o zero sai da frente (vai na frase do cabeçalho)');
  assert.match(chips, /Limpar filtros/);
  const opcoes = vm.runInContext("opcoesDeFiltroDeClientes('head').map((o) => o.rotulo)", ctx);
  assert.deepEqual([...opcoes], ['Todos os heads', 'Ewerton (1)', 'Vinícius (1)']);
  ctx.selosDeVisaoDeClientes();
  assert.match(pegar('clientes-visao').innerHTML, /role="tab" aria-selected="true"[^>]*>Tabela</);
  assert.doesNotMatch(pegar('clientes-visao').innerHTML, /\+ Cliente/, 'Novo cliente mora no cabeçalho');
});

test('cabeçalho da lista: os números viram uma frase e Novo cliente é a ação principal', () => {
  const { ctx, pegar } = carregar();
  ctx.podeAdministrar = () => true;
  ctx.renderClientesBoard();
  assert.equal(pegar('clientes-frase').textContent, '2 ativos · NPS médio 9,0 (1 nota) · ninguém sem contato · nenhum detrator · nenhum painel a atualizar.');
  assert.match(pegar('clientes-acoes').innerHTML, /class="vb-botao principal"[^>]*>[\s\S]*Novo cliente/);
  assert.equal(pegar('kpi-grid-clientes').innerHTML, '');
});

test('ficha: cabeçalho com o cliente na cor dele, três números e Dados e acessos num cartão', () => {
  const { ctx, pegar } = carregar();
  ctx.podeAdministrar = () => true;
  ctx.renderClientMasterDetail('Academia Lions');
  const cabeca = pegar('cliente-detalhe-cabeca').innerHTML;
  assert.match(cabeca, /class="clf-nome"><span class="cliente-carteira">Academia Lions<\/span><button[^>]*cli-situacao ativo/);
  assert.match(cabeca, /Academia[\s\S]*Plus[\s\S]*head[\s\S]*Vinícius/);
  assert.match(cabeca, /Editar cadastro[\s\S]*class="vb-botao principal" onclick="openCadastrosGoverned\(\{ client: 'Academia Lions' \}\)"/);
  const corpo = pegar('client-master-detail').innerHTML;
  assert.match(corpo, /<b>1<\/b><small>conteúdo em aberto<\/small><span class="clf-hist">2 no histórico/);
  assert.match(corpo, /<b>1<\/b><small>pedido em aberto<\/small>/);
  assert.match(corpo, /<b>—<\/b><small>próxima reunião<\/small><button[^>]*>Marcar reunião/);
  assert.match(corpo, /<h3 class="clf-titulo">Dados e acessos<\/h3>/);
  assert.match(corpo, /<summary class="vb-botao">Ver acessos<\/summary>/);
  assert.match(corpo, /Painel do cliente[\s\S]*Atualizado/, 'o estado do painel continua na ficha');
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
