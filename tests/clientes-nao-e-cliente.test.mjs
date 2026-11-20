// "Não é cliente" com caminho de volta (frente s-l, 20/11/2026): a Vybe foi marcada e sumiu de todas as listas, sem
// tela que chamasse a ação 'reconhecer'. Carrega vybe-clientes.js de verdade, com o mínimo do navegador, e confere a
// pergunta antes de marcar, a volta (sozinha e com o "reativar junto" de quem também está Inativo), a etiqueta da
// linha, o chip da barra e a conta do título.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { jsArg as JS_ARG } from './apoio-js-arg.mjs';

function elemento(id) {
  return { id, innerHTML: '', textContent: '', className: '', hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, remove() {}, querySelector: () => null,
    querySelectorAll: () => [], insertAdjacentHTML() {}, appendChild() {} };
}

function carregar({ admin = true } = {}) {
  const els = new Map();
  const pegar = (id) => { if (!els.has(id)) els.set(id, elemento(id)); return els.get(id); };
  const posts = [], perguntas = [], respostas = [];
  const ctx = {
    console: { ...console, warn() {} }, Intl, URL, Map, Set, Promise, setTimeout, Math, Number, String, JSON, Date,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: pegar, querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      createElement: () => elemento(''), body: elemento('body') },
    jsArg: JS_ARG, safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    showToast() {}, podeAdministrar: () => admin, TEAM_USERS: [], DADOS: [], DADOS_DEMANDAS: [],
    clientesDoItem: (item) => [item.cliente], isRequestItem: () => false,
    atualizarCoresDasCarteiras() {}, filtroCarteira: 'all', HOJE_ISO: '2026-11-20',
    CLIENT_MASTER_ERROR: '', CLIENT_MASTER_LOADING: false, CLIENT_MASTER_LOADED: true,
    fetch: async (url, opcoes) => { posts.push({ url, corpo: JSON.parse(opcoes.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('vybe-clientes.js', 'utf8'), ctx);
  vm.runInContext(`
    CADASTRO_CLIENTES = [
      { id: 1, nome: 'Academia Lions', status: 'Ativo', ativo: true },
      { id: 2, nome: 'Vybe', status: 'Ativo', ativo: true, nao_e_cliente: true },
      { id: 3, nome: 'Padaria', status: 'Inativo', ativo: false, nao_e_cliente: true },
    ];
    CLIENT_MASTER_HEADS = CADASTRO_CLIENTES.map((r) => ({ id: String(r.id), name: r.nome, people: '', status: r.status }));
    CLIENT_MASTER_ACESSOS = []; DADOS_ALL = [];
  `, ctx);
  // A janela de pergunta e a recarga da lista são do navegador: aqui respondem o que o teste mandar.
  ctx.perguntarNoPainel = async (o) => { perguntas.push(o); return respostas.length ? respostas.shift() : true; };
  ctx.ensureClientMasterSources = async () => {};
  ctx.renderClientesBoard = () => {};
  return { ctx, posts, perguntas, respostas };
}

test('marcar "não é cliente" pergunta antes e diz o que acontece e onde desfazer', async () => {
  const { ctx, posts, perguntas } = carregar();
  vm.runInContext("CLIENTES_MARCADOS.add('Academia Lions'); CLIENTES_MARCADOS.add('Vybe')", ctx);
  await ctx.loteNaoEhCliente();
  assert.equal(perguntas.length, 1);
  assert.match(perguntas[0].titulo, /não é cliente.*em 1 cliente\?/, 'quem já não era cliente sai do lote');
  assert.equal(perguntas[0].texto, 'Some de todas as listas, metas e da saúde da carteira; dá para desfazer em Não são clientes.');
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'ignorar', id: '1' }]);
});

test('cancelar a pergunta de "não é cliente" não grava nada', async () => {
  const { ctx, posts, respostas } = carregar();
  respostas.push(false);
  vm.runInContext("CLIENTES_MARCADOS.add('Academia Lions')", ctx);
  await ctx.loteNaoEhCliente();
  assert.equal(posts.length, 0);
});

test('voltar a ser cliente chama reconhecer; quem está ativo não ganha a pergunta de reativar', async () => {
  const { ctx, posts, perguntas } = carregar();
  await ctx.voltarASerCliente('Vybe');
  assert.equal(perguntas.length, 1);
  assert.equal(perguntas[0].confirmar, 'Voltar a ser cliente');
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'reconhecer', id: '2' }]);
  assert.ok(posts.every((p) => p.url === '/api/painel?area=clientes'));
});

test('quem também está Inativo: oferece reativar junto, com motivo; cancelar deixa Inativo', async () => {
  let { ctx, posts, perguntas, respostas } = carregar();
  respostas.push(true, 'Fechou contrato de novo');
  await ctx.voltarASerCliente('Padaria');
  assert.equal(perguntas.length, 2);
  assert.match(perguntas[1].titulo, /"Padaria" também está Inativo\. Reativar junto\?/);
  assert.equal(perguntas[1].campo.rotulo, 'Motivo');
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'reconhecer', id: '3' }, { acao: 'reativar', id: '3', motivo: 'Fechou contrato de novo' }]);

  ({ ctx, posts, respostas } = carregar());
  respostas.push(true, null);
  await ctx.voltarASerCliente('Padaria');
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'reconhecer', id: '3' }]);
});

test('em lote: volta só quem não é cliente e reativa só os inativos', async () => {
  const { ctx, posts, perguntas, respostas } = carregar();
  respostas.push(true, '');
  vm.runInContext("CLIENTES_MARCADOS.add('Vybe'); CLIENTES_MARCADOS.add('Padaria'); CLIENTES_MARCADOS.add('Academia Lions')", ctx);
  await ctx.loteVoltarASerCliente();
  assert.match(perguntas[0].titulo, /2 nomes voltam a ser clientes\?/);
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'reconhecer', id: '2' }, { acao: 'reconhecer', id: '3' },
    { acao: 'reativar', id: '3', motivo: 'Voltou a ser cliente' }], 'motivo vazio vira o padrão');
  assert.equal(vm.runInContext('CLIENTES_MARCADOS.size', ctx), 0);
});

test('a linha de quem não é cliente: botão de volta para quem administra, etiqueta para quem só lê', () => {
  const { ctx } = carregar();
  assert.match(ctx.situacaoDoClienteHtml('Vybe', 'ignorados'), /class="cli-voltar"[^>]*\n?[^>]*onclick="event\.stopPropagation\(\);voltarASerCliente\('Vybe'\)">Voltar a ser cliente<\/button>/);
  const leitor = carregar({ admin: false }).ctx;
  assert.equal(leitor.situacaoDoClienteHtml('Vybe', 'ignorados'), '<span class="cli-situacao ignorado">Não é cliente</span>');
  // Na lista "Não são clientes", a coluna Saúde vira Situação e leva o botão.
  vm.runInContext("FILTRO_CLIENTES.situacao = 'ignorados'", ctx);
  const html = ctx.tabelaDeClientesHtml(['Vybe', 'Padaria']);
  assert.match(html, /so-nao-clientes/);
  assert.match(html, /<span class="cv2-th-b cv2-h-saude">Situação<\/span>/);
  assert.equal((html.match(/class="cli-voltar"/g) || []).length, 2);
});

test('o chip "Não são clientes" aparece na barra quando há alguém; o título não conta quem não é cliente como ativo', () => {
  const { ctx } = carregar();
  const barra = ctx.document.getElementById('clientes-filtros');
  ctx.pintarFiltrosDeClientes([]);
  assert.match(barra.innerHTML, /alternarSituacaoDeClientes\('ignorados'\)">Não são clientes <span>2<\/span>/);
  const conta = ctx.contagemDeClientes(['Academia Lions', 'Vybe', 'Padaria']);
  assert.equal(conta.ativos, 1);
  assert.equal(conta.inativos, 0);
  assert.equal(conta.ignorados, 2);
});
