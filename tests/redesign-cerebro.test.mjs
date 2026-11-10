// Frente "cérebro" do redesign (10/11/2026): quadros 05 (Gestão de clientes, fase 2), 53 (Cérebro na ficha),
// 54 (Sinapses) e 55 (Mapa do Cérebro). Carrega os arquivos de verdade com o mínimo do navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8');

function elemento(id) {
  return { id, innerHTML: '', textContent: '', className: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, remove() {}, querySelector: () => null,
    querySelectorAll: () => [] };
}
function carregarClientes() {
  const els = new Map(), store = new Map();
  const pegar = (id) => { if (!els.has(id)) els.set(id, elemento(id)); return els.get(id); };
  const ctx = {
    console, Intl, URL, Map, Set, Promise, setTimeout, Math, Number, String, JSON, Date,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) },
    document: { getElementById: pegar, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    showToast() {}, DADOS_DEMANDAS: [{}], TEAM_USERS: [{ name: 'Vinícius', photo: 'https://x/v.png' }, { name: 'Ewerton', photo: 'https://x/e.png' }],
    ownerAvatarHtml: (u) => `<img src="${u.photo}" alt="${u.name}">`, firstName: (n) => String(n).split(/\s+/)[0],
    tagClienteHtml: (n) => `<span class="cliente-carteira">${n}</span>`, cliCor: (n) => n,
    mapaCabecaUrl: () => 'https://x/padrao.png', clienteAtivo: (c) => c.ativo !== false, descricaoCarteiraCliente: () => '',
    carteiraDoCliente: (n) => ({ 'Academia Lions': 'vinicius', Alpha1: 'ewerton' })[n] || '',
    atualizarCoresDasCarteiras() {}, filtroCarteira: 'all', HOJE_ISO: '2026-11-10',
    openWorkflowModal() {}, closeWorkflowModal() {}, ancorarPopover() {},
    clientesDoItem: (item) => [item.cliente], isRequestItem: (item) => item.pedido === true, DADOS: [],
    CLIENT_MASTER_ERROR: '', CLIENT_MASTER_LOADING: false, CLIENT_MASTER_LOADED: true,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-clientes.js'), ctx);
  vm.runInContext(`
    CADASTRO_CLIENTES = [
      { id: 1, nome: 'Academia Lions', status: 'Ativo', ativo: true, heads: 'Vinícius', segmento: 'Academia', ultima_reuniao: '2026-11-01', cadastro: {} },
      { id: 2, nome: 'Alpha1', status: 'Ativo', ativo: true, heads: 'Ewerton', segmento: 'Solução empresarial', cadastro: {} },
      { id: 3, nome: 'Copirecê', status: 'Inativo', ativo: false, heads: 'Vinícius', cadastro: {} },
    ];
    CLIENT_MASTER_HEADS = CADASTRO_CLIENTES.map((r) => ({ id: String(r.id), name: r.nome, people: r.heads, status: r.status, segment: r.segmento }));
    CLIENT_MASTER_ACESSOS = [];
    DADOS_ALL = [{ id: 'a', cliente: 'Academia Lions', status: 'A Fazer' }, { id: 'z', cliente: 'Loja Nova', status: 'A Fazer' }];
  `, ctx);
  ctx.window.VybeCarteira = { dados: () => [] };
  return { ctx, pegar, store };
}

test('05: aviso "sem registro → Completar", zeros fora dos chips e escritos na frase', () => {
  const { ctx, pegar } = carregarClientes();
  ctx.podeAdministrar = () => true;
  ctx.renderClientesBoard();
  const aviso = pegar('clientes-aviso');
  assert.equal(aviso.hidden, false);
  assert.match(aviso.innerHTML, /<b>1 cliente sem registro de reunião<\/b> · e 1 só na operação, sem ficha/);
  assert.match(aviso.innerHTML, /onclick="focarClientes\('sem-registro'\)">Completar</);
  const chips = pegar('clientes-filtros').innerHTML;
  assert.doesNotMatch(chips, /Sem registro|Detratores|Painel a atualizar|Sem contato/, 'recortes com zero (ou no aviso) saem da frente');
  assert.match(pegar('clientes-frase').textContent, /nenhum detrator · nenhum painel a atualizar\.$/);
});

test('05: Ativos, Inativos e Carteira como chips; carteira e situação recortam a lista', () => {
  const { ctx, pegar } = carregarClientes();
  ctx.renderClientesBoard();
  const chips = pegar('clientes-filtros').innerHTML;
  assert.match(chips, /aria-pressed="false"[^>]*>Ativos <b>2<\/b>/);
  assert.match(chips, />Inativos <b>1<\/b>/);
  assert.match(chips, />Carteira<svg/);
  assert.match(chips, /escolherColunasDeClientes\(this\)">Colunas/);
  const filtra = () => [...vm.runInContext('clientMasterRecords().map((r) => r.name).filter((n) => passaNosFiltrosDeClientes(n))', ctx)].sort();
  vm.runInContext("FILTRO_CLIENTES.carteira = 'ewerton'", ctx);
  assert.deepEqual(filtra(), ['Alpha1']);
  vm.runInContext("FILTRO_CLIENTES.carteira = ''; FILTRO_CLIENTES.situacao = 'inativos'", ctx);
  assert.deepEqual(filtra(), ['Copirecê']);
  vm.runInContext("FILTRO_CLIENTES.situacao = ''; FILTRO_CLIENTES.carteira = 'sem'", ctx);
  assert.ok(filtra().includes('Loja Nova') && !filtra().includes('Alpha1'), 'sem responsável');
});

test('05: seis colunas na frente, Drive/Documento/Status pelo menu Colunas; head na cor da carteira', () => {
  const { ctx, store } = carregarClientes();
  const nomes = vm.runInContext('clientMasterRecords().map((r) => r.name)', ctx);
  let html = ctx.tabelaDeClientesHtml(nomes);
  let cab = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
  for (const sai of ['Status', 'Drive', 'Documento']) assert.doesNotMatch(cab, new RegExp(`>${sai}<`));
  const linha = html.slice(html.indexOf('data-cliente="Alpha1"'));
  assert.match(linha, /class="cli-head" data-carteira="ewerton" title="Ewerton · carteira de Ewerton"/);
  store.set('vybe_clientes_colunas', JSON.stringify({ drive: true, documento: true, status: true }));
  html = ctx.tabelaDeClientesHtml(nomes);
  cab = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
  for (const volta of ['Status', 'Drive', 'Documento']) assert.match(cab, new RegExp(`>${volta}<`));
  assert.match(ler('vybe-mundo-clientes-ficha.css'), /\.cli-head\[data-carteira="vinicius"\]\{--cli-cart:#B4510E\}/);
});

function carregarCerebro() {
  const c = vm.createContext({ console, window: {}, document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} },
    CLIENT_MASTER_HEADS: [{ name: 'Brussolo Ristorante', status: 'Ativo', head: 'Vinícius' }], CLIENT_MASTER_ACESSOS: [],
    DADOS_ALL: [], DADOS: [], DADOS_DEMANDAS: [], clientesDoItem: (i) => i.clientes, isRequestItem: () => false,
    fetch: () => new Promise(() => {}) });
  for (const f of ['vybe-config.js', 'vybe-clientes.js', 'vybe-clientes-cerebro.js']) vm.runInContext(ler(f), c);
  return c;
}

test('53: amostras sem o código ao lado e "o que é o cérebro" como dica, não bloco', () => {
  const c = carregarCerebro();
  const card = c.cerebroDoClienteCardHtml('Brussolo Ristorante');
  const paleta = card.slice(card.indexOf('cb-cartao-paleta'));
  assert.doesNotMatch(paleta.replace(/(title|style)="[^"]*"/g, ''), /#[0-9A-Fa-f]{6}/, 'nenhum hex escrito fora da dica');
  assert.match(card, /class="cb-dica vb-jogo-dica" data-dica="O cérebro é um só/);
  assert.doesNotMatch(ler('vybe-clientes-ficha.js'), /<h3>O que é o cérebro<\/h3>/);
});

test('54: fontes da prova em português, contadores sem borda colorida e o selo do Qwen à vista', () => {
  const c = carregarCerebro();
  assert.equal(c.cerebroProvaHtml('[NOTICIA_SETOR] Feira de demonstração'), '<span class="cb-sin-fonte">Notícia do setor</span> Feira de demonstração');
  assert.equal(c.cerebroProvaTexto('[FICHA] o público gosta'), 'Ficha do cliente: o público gosta');
  assert.equal(c.cerebroRotuloDaFonte('NOVA_FONTE'), 'Nova fonte');
  vm.runInContext(`CEREBRO_SINAPSES.estudos['Alpha1'] = { dados: { ultimo: { em: '2026-11-09T22:00:00Z', fontes: { ficha: true, instagram: true },
    ameacas: [{ texto: 'Feira', prova: '[NOTICIA_SETOR] Feira' }], oportunidades: [{ texto: 'Bastidores', prova: '[FICHA] preparo' }] } } };`, c);
  const html = c.renderEstudoClienteCerebroHtml('Alpha1');
  assert.doesNotMatch(html, /\[FICHA\]|\[NOTICIA_SETOR\]|ficha \.md/);
  assert.match(html, /Estudo de Alpha1/);
  assert.match(html, /com a ficha do cliente e o Instagram · <em class="cb-motor"[^>]*><i aria-hidden="true"><\/i>Qwen<\/em>/);
  const css = ler('vybe-styles.css');
  assert.doesNotMatch(css, /border-top:3px solid var\(--c\)/);
  assert.match(css, /\.cb-motor \{[^}]*background:#FFF;/);
});

test('55: mapa claro, acima do dock, X fecha, frase em português e ajustes recolhidos', () => {
  const g = ler('vybe-cerebro-grafo.js');
  assert.doesNotMatch(g, /nós · \$\{ligs\.length\} ligações/);
  assert.match(g, /class="cg-fechar" data-cg="sair" aria-label="Fechar o mapa \(Esc\)"/);
  assert.match(g, /ajustes: pref\.ajustes \?\? false/);
  assert.match(g, /const FUNDO = '#F4F0EA'/);
  assert.match(g, /class="cg-chip" data-cg-grupo=/);
  const css = ler('vybe-mundo.css');
  assert.match(css, /\.cg\.cg-cheia\{position:fixed;[^}]*bottom:calc\(var\(--vv-m,14px\) \+ var\(--vv-dock-alto,0px\)\)/);
  assert.match(css, /\.cg\{[^}]*background:#F4F0EA/);
});
