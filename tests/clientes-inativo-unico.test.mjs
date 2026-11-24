// Inativo e "não é cliente" viraram a mesma coisa (Paulo, 23/11/2026): "inativo e não é cliente vira a mesma coisa..vira
// inativo (ai pode ter um botao no cliente de apagar ele 100% que vai pedir confirmacao se quer apagar mesmo)".
// Carrega vybe-clientes.js de verdade, com o mínimo do navegador, e confere: o lote Desativar/Reativar no lugar de
// "Não é cliente"/"Voltar a ser cliente", a marca antiga caindo em Inativos, a barra sem o chip "Não são clientes" e o
// bloco Situação da ficha com o "Apagar para sempre" que abre a janela do ciclo de vida (vybe-ciclo.js).
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
  const posts = [], perguntas = [], respostas = [], janelas = [];
  const ctx = {
    console: { ...console, warn() {} }, Intl, URL, Map, Set, Promise, setTimeout, Math, Number, String, JSON, Date,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: pegar, querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      createElement: () => elemento(''), body: elemento('body') },
    jsArg: JS_ARG, safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    showToast() {}, podeAdministrar: () => admin, TEAM_USERS: [], DADOS: [], DADOS_DEMANDAS: [],
    clientesDoItem: (item) => [item.cliente], isRequestItem: () => false,
    atualizarCoresDasCarteiras() {}, filtroCarteira: 'all', HOJE_ISO: '2026-11-23',
    CLIENT_MASTER_ERROR: '', CLIENT_MASTER_LOADING: false, CLIENT_MASTER_LOADED: true,
    fetch: async (url, opcoes) => { posts.push({ url, corpo: JSON.parse(opcoes.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
    abrirApagarNoCiclo: (...args) => janelas.push(args),
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('vybe-clientes.js', 'utf8'), ctx);
  vm.runInContext(`
    CADASTRO_CLIENTES = [
      { id: 1, nome: 'Academia Lions', status: 'Ativo', ativo: true },
      { id: 2, nome: 'Vybe', status: 'Ativo', ativo: true, nao_e_cliente: true },
      { id: 3, nome: 'Padaria', status: 'Inativo', ativo: false },
    ];
    CLIENT_MASTER_HEADS = CADASTRO_CLIENTES.map((r) => ({ id: String(r.id), name: r.nome, people: '', status: r.status }));
    CLIENT_MASTER_ACESSOS = []; DADOS_ALL = [];
  `, ctx);
  // A janela de pergunta e a recarga da lista são do navegador: aqui respondem o que o teste mandar.
  ctx.perguntarNoPainel = async (o) => { perguntas.push(o); return respostas.length ? respostas.shift() : true; };
  ctx.ensureClientMasterSources = async () => {};
  ctx.renderClientesBoard = () => {};
  return { ctx, posts, perguntas, respostas, janelas };
}

test('a marca antiga de "não é cliente" cai em Inativos e conta como inativo', () => {
  const { ctx } = carregar();
  assert.equal(ctx.situacaoDaLinhaDeCliente('Vybe'), 'inativos');
  const conta = ctx.contagemDeClientes(['Academia Lions', 'Vybe', 'Padaria']);
  assert.deepEqual([conta.ativos, conta.inativos, conta.sem, conta.ignorados], [1, 2, 0, undefined]);
});

test('a barra tem só Ativos e Inativos: o chip "Não são clientes" saiu', () => {
  const { ctx } = carregar();
  const barra = ctx.document.getElementById('clientes-filtros');
  ctx.pintarFiltrosDeClientes([]);
  assert.match(barra.innerHTML, /alternarSituacaoDeClientes\('inativos'\)">Inativos <span>2<\/span>/);
  assert.doesNotMatch(barra.innerHTML, /ignorados|Não são clientes/);
});

test('lote: "Não é cliente" virou Desativar, com a pergunta de sempre, e só para quem está ativo', async () => {
  const { ctx, posts, perguntas } = carregar();
  vm.runInContext("CLIENTES_MARCADOS.add('Academia Lions'); CLIENTES_MARCADOS.add('Padaria')", ctx);
  await ctx.loteDesativarClientes();
  assert.equal(perguntas.length, 1);
  assert.equal(perguntas[0].titulo, 'Desativar em 1 cliente?');
  assert.equal(perguntas[0].confirmar, 'Desativar');
  assert.equal(perguntas[0].perigo, true);
  assert.match(perguntas[0].texto, /Vão para Inativos/);
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'desativar', id: '1' }]);
  assert.ok(posts.every((p) => p.url === '/api/painel?area=clientes'));
});

test('cancelar o Desativar do lote não grava nada', async () => {
  const { ctx, posts, respostas } = carregar();
  respostas.push(false);
  vm.runInContext("CLIENTES_MARCADOS.add('Academia Lions')", ctx);
  await ctx.loteDesativarClientes();
  assert.equal(posts.length, 0);
});

test('lote: "Voltar a ser cliente" virou Reativar; a marca antiga volta por reconhecer, que também a limpa', async () => {
  const { ctx, posts, perguntas } = carregar();
  vm.runInContext("CLIENTES_MARCADOS.add('Vybe'); CLIENTES_MARCADOS.add('Padaria'); CLIENTES_MARCADOS.add('Academia Lions')", ctx);
  await ctx.loteReativarClientes();
  assert.equal(perguntas[0].titulo, 'Reativar em 2 clientes?');
  assert.deepEqual(posts.map((p) => p.corpo), [{ acao: 'reconhecer', id: '2' }, { acao: 'reativar', id: '3' }]);
  assert.equal(vm.runInContext('CLIENTES_MARCADOS.size', ctx), 0);
});

test('a ficha: inativo ganha "Apagar para sempre" que abre a janela do ciclo; ativo vê o botão apagado e a nota', () => {
  const { ctx, janelas } = carregar();
  const inativo = ctx.situacaoDoCicloNaFichaHtml('Padaria', { id: '3', estado: 'inativos', podeMexer: true, aspas: 'Padaria' });
  assert.match(inativo, /<b>Situação<\/b><span>Inativo<\/span>/);
  assert.match(inativo, /trocarSituacaoDoCliente\('Padaria', true\)"><span><b>Reativar<\/b>/);
  assert.match(inativo, /class="d3m-vlin fv2-apagar"[^>]*onclick="apagarClienteDaFicha\('3', 'Padaria'\)"><span><b>Apagar para sempre<\/b>/);
  assert.doesNotMatch(inativo, /disabled/);

  const ativo = ctx.situacaoDoCicloNaFichaHtml('Academia Lions', { id: '1', estado: 'ativos', podeMexer: true, aspas: 'Academia Lions' });
  assert.match(ativo, /trocarSituacaoDoCliente\('Academia Lions', false\)"><span><b>Desativar<\/b>/);
  assert.match(ativo, /class="d3m-vlin fv2-apagar" disabled aria-disabled="true"/);
  assert.match(ativo, />Desative antes de apagar\.<\/p>/);
  assert.doesNotMatch(ativo, /apagarClienteDaFicha/);

  assert.equal(ctx.situacaoDoCicloNaFichaHtml('Padaria', { id: '3', estado: 'inativos', podeMexer: false, aspas: 'Padaria' }), '', 'quem só lê não vê');
  assert.equal(ctx.situacaoDoCicloNaFichaHtml('Freela', { id: '', estado: 'sem', podeMexer: true, aspas: 'Freela' }), '', 'sem ficha, nada');

  ctx.apagarClienteDaFicha('3', 'Padaria');
  assert.equal(janelas.length, 1);
  assert.deepEqual(janelas[0].slice(0, 3), ['cliente', '3', 'Padaria']);
  assert.equal(typeof janelas[0][3].depois, 'function');
});

test('nenhum texto de tela diz "não é cliente"; o servidor trata ignorar/reconhecer pelo ciclo de vida', () => {
  const js = fs.readFileSync('vybe-clientes.js', 'utf8');
  // Só os comentários falam da marca antiga.
  const semComentarios = js.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(semComentarios, /n[ãa]o [ée] cliente|N[ãa]o s[ãa]o clientes|Voltar a ser cliente|voltarASerCliente|loteNaoEhCliente/i);
  const api = fs.readFileSync('api/painel.js', 'utf8');
  assert.match(api, /\['criar', 'ativar', 'reativar', 'desativar', 'apagar', 'ignorar', 'reconhecer'\]\.includes\(acao\)/);
  assert.doesNotMatch(api, /SET nao_e_cliente=\$\{/);
});
