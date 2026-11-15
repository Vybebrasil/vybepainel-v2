// Feed do cliente (Paulo, 15/11/2026): o feed público do Instagram sem conectar conta e a vista Feed do Painel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { usuarioDoInstagram, lerPaginaDoPerfil, feedsDoInstagram, areaFeedInstagram, limparCacheDoFeed } from '../server/instagram-feed.js';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Página de incorporação mínima, no formato real: o contexto vai como JSON dentro de uma string dentro do s.handle.
function pagina({ usuario = 'cliente', posts = [] } = {}) {
  const ctx = { context: { username: usuario, full_name: 'Cliente', followers_count: 1234, graphql_media: posts.map((p) => ({ shortcode_media: p })) } };
  const handle = { require: [['Embed', 'init', [], [{ isProfileEmbed: true, contextJSON: JSON.stringify(ctx) }]]] };
  return `<html><body><script>requireLazy(["ServerJS"],function(S){var s=(new S());s.handle(${JSON.stringify(handle)});});</script></body></html>`;
}
const post = (codigo, dias, tipo = 'GraphImage') => ({ __typename: tipo, shortcode: codigo, display_url: `https://scontent.cdninstagram.com/${codigo}.jpg`, taken_at_timestamp: Math.floor(Date.UTC(2026, 10, dias) / 1000), is_video: tipo === 'GraphVideo' });

test('o @ vem de qualquer jeito que esteja no cadastro e nada além de um nome de perfil passa', () => {
  assert.equal(usuarioDoInstagram('@Brussolo.Ristorante'), 'brussolo.ristorante');
  assert.equal(usuarioDoInstagram('https://www.instagram.com/vybe_br/?igsh=abc'), 'vybe_br');
  assert.equal(usuarioDoInstagram('instagram.com/p/ABC123/'), '');
  assert.equal(usuarioDoInstagram('a b'), '');
  assert.equal(usuarioDoInstagram('../../etc'), '');
  assert.equal(usuarioDoInstagram(''), '');
});

test('lê o perfil e os posts da página pública, do mais novo para o mais antigo', () => {
  const r = lerPaginaDoPerfil(pagina({ usuario: 'academialions', posts: [post('A1', 10), post('A2', 12, 'GraphSidecar'), post('A3', 11, 'GraphVideo')] }));
  assert.equal(r.usuario, 'academialions');
  assert.equal(r.seguidores, 1234);
  assert.deepEqual(r.posts.map((p) => [p.codigo, p.tipo]), [['A2', 'carrossel'], ['A3', 'video'], ['A1', 'foto']]);
  assert.equal(r.posts[0].link, 'https://www.instagram.com/p/A2/');
  assert.equal(lerPaginaDoPerfil('<html>sem contexto</html>'), null);
});

test('busca no máximo 40 perfis, guarda por uma hora e perfil fora do ar volta com erro sem derrubar os outros', async () => {
  limparCacheDoFeed();
  const pedidos = [];
  const buscar = async (url) => {
    pedidos.push(url);
    if (url.includes('/sumiu/')) return { ok: false, status: 404, text: async () => '' };
    if (url.includes('/caiu/')) throw new Error('rede');
    return { ok: true, status: 200, text: async () => pagina({ usuario: url.split('/')[3], posts: [post('X', 1)] }) };
  };
  const r = await feedsDoInstagram(['@um', 'sumiu', 'caiu', 'um', 'p'], { buscar });
  assert.equal(r.um.posts.length, 1);
  assert.match(r.sumiu.erro, /não encontrado/);
  assert.match(r.caiu.erro, /não respondeu/);
  assert.equal(pedidos.filter((u) => u.includes('/um/')).length, 1, 'o mesmo perfil uma vez só');
  await feedsDoInstagram(['um'], { buscar });
  assert.equal(pedidos.filter((u) => u.includes('/um/')).length, 1, 'a segunda leitura vem da memória');
  const muitos = await feedsDoInstagram(Array.from({ length: 60 }, (_, i) => `perfil${i}`), { buscar });
  assert.equal(Object.keys(muitos).length, 40);
});

test('a rota exige sessão, só aceita GET e devolve os perfis', async () => {
  limparCacheDoFeed();
  const res = () => { const r = { codigo: 0, corpo: null, status(c) { r.codigo = c; return r; }, json(b) { r.corpo = b; return r; }, setHeader() {} }; return r; };
  const buscar = async () => ({ ok: true, status: 200, text: async () => pagina({ usuario: 'um', posts: [post('X', 1)] }) });
  let r = res(); await areaFeedInstagram({ method: 'GET', query: { usuarios: 'um' } }, r, null, { buscar }); assert.equal(r.codigo, 401);
  r = res(); await areaFeedInstagram({ method: 'POST', query: {} }, r, { tipo: 'sessao', pessoa: { id: 1 } }, { buscar }); assert.equal(r.codigo, 405);
  r = res(); await areaFeedInstagram({ method: 'GET', query: { usuarios: 'um' } }, r, { tipo: 'sessao', pessoa: { id: 1 } }, { buscar });
  assert.equal(r.codigo, 200); assert.equal(r.corpo.perfis.um.posts[0].codigo, 'X');
  assert.match(ler('api/painel.js'), /const AREAS = \{ feed_instagram: areaFeedInstagram,/);
});

test('a vista Feed entra no Painel como as outras: botão entre Mês e Grupos, painel da barra e seção própria', () => {
  const gestor = ler('vybe-gestor.js'), index = ler('index.html');
  assert.match(gestor, /data-vista="mes"[^\n]*\n\s*<button type="button" role="radio" data-vista="feed" onclick="toggleFeedDoCliente\(\)"/);
  assert.match(gestor, /feed: \{\s*grupo: 'visao', botao: 'ops-feed-btn', lembra: \(\) => FEED_LEMBRA, alvo: 'feed-board',/);
  assert.match(gestor, /P\.calendario\.aberto\(\) \? 'mes' : P\.feed\.aberto\(\) \? 'feed'/);
  assert.match(index, /<section id="feed-board" class="feed-board focus-hidden" aria-label="Feed dos clientes"><\/section>/);
  assert.match(index, /<script src="\/vybe-agenda\.js"><\/script>\s*<script src="\/vybe-feed\.js"><\/script>/);
  const css = ler('padrao-v2/feed.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /:[^;{}]*#[0-9a-fA-F]{3,8}\b/, 'só tokens --d3-*');
});

// A grade de um cliente, montada com a data fixa: peças de feed do futuro, X onde a semana não chega a 3, story fora.
function ambiente(itens, hoje = '2026-11-16') {
  const c = vm.createContext({ console, Intl, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${hoje}T15:00:00Z`])); } static now() { return Date.parse(`${hoje}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ nome: 'Lions', ativo: true, cadastro: { instagram: '@lions' }, heads: 'Ana' }, { nome: 'Voa', ativo: true, heads: 'Bia' }], carteiraDoCliente: (n) => (n === 'Lions' ? 'vinicius' : 'ewerton') });
  vm.runInContext(ler('vybe-feed.js'), c);
  return c;
}

test('grade do feed: futuro em cima com X vermelho até 3 por semana, story fora, e o que já foi ao ar embaixo', () => {
  const c = ambiente([
    { id: '1', cliente: 'Lions', formato: 'Reels', veiculacao_iso: '2026-11-17', status: 'A Fazer' },
    { id: '2', cliente: 'Lions', formato: 'Carrossel', veiculacao_iso: '2026-11-19', status: 'A Fazer' },
    { id: '3', cliente: 'Lions', formato: 'Story', veiculacao_iso: '2026-11-18', status: 'A Fazer' },
    { id: '4', cliente: 'Lions', formato: 'Card', veiculacao_iso: '2026-11-10', status: 'Finalizado' },
    { id: '5', cliente: 'Lions', formato: 'Card', veiculacao_iso: '2026-11-20', status: 'Cancelado' },
  ]);
  const g = vm.runInContext("feedMontar({ nome: 'Lions', usuario: '' })", c);
  assert.deepEqual([...g.futuras].map((x) => x.item.id).sort(), ['1', '2'], 'story e cancelada não entram');
  // Semana de 16/11: 2 peças, falta 1 (segunda já passou? não: hoje é segunda, entra 16/11). As outras 3 semanas: 3 cada.
  assert.equal(g.buracos.length, 1 + 3 * 3);
  assert.equal(g.buracos[0].iso, '2026-11-16');
  assert.ok(g.futuro.every((t, i, l) => i === 0 || l[i - 1].iso >= t.iso), 'mais novo em cima');
  assert.deepEqual([...g.noAr].map((x) => x.item.id), ['4'], 'sem o perfil, o que o Vybe OS já veiculou');
});

test('filtros do feed: carteira, head e cliente, como o calendário', () => {
  const c = ambiente([]);
  const nomes = (cmd) => vm.runInContext(`${cmd}; feedFiltrados().map((x) => x.nome)`, c);
  assert.deepEqual([...nomes("FEED.carteira = 'all'")], ['Lions', 'Voa']);
  assert.deepEqual([...nomes("FEED.carteira = 'ewerton'")], ['Voa']);
  assert.deepEqual([...nomes("FEED.carteira = 'all'; FEED.head = 'Ana'")], ['Lions']);
  assert.deepEqual([...nomes("FEED.head = 'all'; FEED.cliente = 'Voa'")], ['Voa']);
  assert.equal(vm.runInContext("feedClientes().find((x) => x.nome === 'Lions').usuario", c), 'lions');
});
