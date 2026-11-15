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
  r = res(); await areaFeedInstagram({ method: 'PUT', query: {} }, r, { tipo: 'sessao', pessoa: { id: 1 } }, { buscar }); assert.equal(r.codigo, 405);
  // Gravar a captura do feed é só dos donos (tests/feed-captura.test.mjs).
  r = res(); await areaFeedInstagram({ method: 'POST', query: {}, body: { acao: 'captura' } }, r, { tipo: 'sessao', pessoa: { id: 1 } }, { buscar }); assert.equal(r.codigo, 403);
  r = res(); await areaFeedInstagram({ method: 'GET', query: { usuarios: 'um' } }, r, { tipo: 'sessao', pessoa: { id: 1 } }, { buscar });
  assert.equal(r.codigo, 200); assert.equal(r.corpo.perfis.um.posts[0].codigo, 'X');
  assert.ok(ler('api/painel.js').includes('const AREAS = { feed_instagram: (req,res,quem) => areaFeedInstagram(req,res,quem,{ db: sql() }),'));
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

test('o feed acha as peças pelo nome do cadastro (como o calendário) e inclui as solicitações de feed pela conclusão', () => {
  const c = ambiente([{ id: '7', cliente: 'Academia Lions', formato: 'Reels', veiculacao_iso: '2026-11-18', status: 'A Fazer' }]);
  vm.runInContext(`clientMasterResolveName = (n) => (n === 'Academia Lions' ? 'Lions' : n);
    DADOS_DEMANDAS = [{ id: 's1', cliente: 'Academia Lions', tipo: 'Carrossel', conclusao_iso: '2026-11-20', status: 'Aberta' },
                      { id: 's2', cliente: 'Academia Lions', tipo: 'Story', conclusao_iso: '2026-11-21', status: 'Aberta' }];
    solicitacaoVaiProFeed = (i) => !/story/i.test(i.tipo);`, c);
  const g = vm.runInContext("feedMontar({ nome: 'Lions', usuario: '' })", c);
  assert.deepEqual([...g.futuras].map((x) => [x.item.id, Boolean(x.request), x.iso]).sort(), [['7', false, '2026-11-18'], ['s1', true, '2026-11-20']]);
  assert.match(ler('vybe-feed.js'), /moverDataDoItem\(x\.it, 'veiculacao', iso, \{ request: x\.request, renderizar: false, avisar: false \}\)/);
});

test('a foto do Instagram passa pelo servidor e só vem do CDN do Instagram', async () => {
  const res = () => { const r = { codigo: 0, h: {}, status(c) { r.codigo = c; return r; }, json(b) { r.corpo = b; return r; }, end(b) { r.bytes = b; return r; }, setHeader(k, v) { r.h[k] = v; } }; return r; };
  const quem = { tipo: 'sessao', pessoa: { id: 1 } };
  const buscar = async () => ({ ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
  let r = res(); await areaFeedInstagram({ method: 'GET', query: { foto: 'https://scontent-gru1-1.cdninstagram.com/v/a.jpg?x=1' } }, r, quem, { buscar });
  assert.equal(r.codigo, 200); assert.equal(r.h['Content-Type'], 'image/jpeg'); assert.equal(r.bytes.length, 3);
  r = res(); await areaFeedInstagram({ method: 'GET', query: { foto: 'https://exemplo.com/a.jpg' } }, r, quem, { buscar }); assert.equal(r.codigo, 400);
  r = res(); await areaFeedInstagram({ method: 'GET', query: { foto: 'https://x.fbcdn.net/a' } }, r, quem, { buscar: async () => ({ ok: true, headers: { get: () => 'text/html' }, arrayBuffer: async () => new ArrayBuffer(1) }) });
  assert.equal(r.codigo, 404, 'só imagem');
  r = res(); await areaFeedInstagram({ method: 'GET', query: { foto: 'https://x.fbcdn.net/a' } }, r, null, { buscar }); assert.equal(r.codigo, 401);
  const lido = lerPaginaDoPerfil(pagina({ usuario: 'um', posts: [post('A', 1)] }));
  assert.equal(lido.total_posts, null); assert.equal(lido.verificado, false);
});

test('capa do feed: o pedido de arquivos com capa=1 prefere imagem, depois vídeo (frame do Drive), e o feed marca o vídeo', () => {
  const painel = ler('api/painel.js'), feed = ler('vybe-feed.js');
  assert.match(painel, /const capa = String\(req\.query\?\.capa \|\| ''\) === '1';/);
  assert.match(painel, /WHEN lower\(coalesce\(a\.extensao,''\)\) IN \('jpg','jpeg','png','webp','gif','heic'\) THEN 0\s*WHEN lower\(coalesce\(a\.extensao,''\)\) IN \('mp4','mov','m4v','webm','avi'\) THEN 1 ELSE 2 END,/);
  assert.match(feed, /area=arquivos&capa=1&itens=/);
  assert.match(feed, /aria-label="Vídeo: frame do Drive"/);
});

test('API da Meta (Business Discovery): bio, site, seguindo e posts; token no cabeçalho; sem ela ou recusada, a página pública', async () => {
  const { metaConfigurada, lerPerfilDaMeta } = await import('../server/instagram-feed.js');
  assert.equal(metaConfigurada({}), false);
  assert.equal(metaConfigurada({ META_IG_TOKEN: 'x', META_IG_USER_ID: 'abc' }), false);
  const env = { META_IG_TOKEN: 'tok-secreto', META_IG_USER_ID: '1789' };
  assert.equal(metaConfigurada(env), true);
  const meta = { business_discovery: { username: 'lions', name: 'Lions Academia', biography: 'Treino\nIrecê', website: 'https://lions.com', profile_picture_url: 'https://x.fbcdn.net/p.jpg',
    followers_count: 1500, follows_count: 300, media_count: 210, media: { data: [
      { id: '1', media_type: 'IMAGE', media_url: 'https://x.cdninstagram.com/1.jpg', permalink: 'https://www.instagram.com/p/1/', timestamp: '2026-11-10T12:00:00+0000' },
      { id: '2', media_type: 'VIDEO', media_url: 'https://x.cdninstagram.com/2.mp4', thumbnail_url: 'https://x.cdninstagram.com/2.jpg', permalink: 'https://www.instagram.com/reel/2/', timestamp: '2026-11-12T12:00:00+0000' },
      { id: '3', media_type: 'CAROUSEL_ALBUM', children: { data: [{ media_type: 'IMAGE', media_url: 'https://x.cdninstagram.com/3a.jpg' }] }, permalink: 'https://www.instagram.com/p/3/', timestamp: '2026-11-11T12:00:00+0000' },
    ] } } };
  const p = lerPerfilDaMeta(meta, 'lions');
  assert.deepEqual([p.bio, p.site, p.seguidores, p.seguindo, p.total_posts, p.fonte], ['Treino\nIrecê', 'https://lions.com', 1500, 300, 210, 'meta']);
  assert.deepEqual(p.posts.map((x) => [x.codigo, x.tipo, x.imagem.split('/').pop()]), [['2', 'video', '2.jpg'], ['3', 'carrossel', '3a.jpg'], ['1', 'foto', '1.jpg']]);

  limparCacheDoFeed();
  const pedidos = [];
  const buscar = async (url, op) => {
    pedidos.push({ url, auth: op?.headers?.authorization });
    if (url.startsWith('https://graph.facebook.com/')) {
      if (url.includes('pessoal')) return { ok: false, status: 400, json: async () => ({ error: { code: 110, message: 'Invalid user id' } }) };
      return { ok: true, status: 200, json: async () => meta };
    }
    return { ok: true, status: 200, text: async () => pagina({ usuario: 'pessoal', posts: [post('E', 1)] }) };
  };
  const r = await feedsDoInstagram(['lions', 'pessoal'], { buscar, env });
  assert.equal(r.lions.fonte, 'meta'); assert.equal(r.lions.bio, 'Treino\nIrecê');
  assert.equal(r.pessoal.fonte, undefined); assert.equal(r.pessoal.posts[0].codigo, 'E', 'perfil recusado pela Meta cai na página pública');
  const daMeta = pedidos.filter((x) => x.url.startsWith('https://graph.facebook.com/v23.0/1789?fields='));
  assert.equal(daMeta.length, 2);
  assert.ok(daMeta.every((x) => x.auth === 'Bearer tok-secreto' && !x.url.includes('tok-secreto')), 'token só no cabeçalho');
  assert.match(decodeURIComponent(daMeta[0].url), /business_discovery\.username\(lions\)\{username,name,biography,website/);
  assert.match(ler('vybe-feed.js'), /const bioTxt = String\(p\?\.bio \|\| cli\.bio \|\| ''\)\.trim\(\);/);
});

test('grade contínua: sem o perfil incorporado, o corte pelo mais longe, o no ar com as peças publicadas e cliente sem repetição', () => {
  const feed = ler('vybe-feed.js');
  assert.doesNotMatch(feed, /<iframe/, 'o perfil incorporado repetia o cabeçalho e quebrava a grade');
  assert.match(feed, /const futuro = g\.futuro\.slice\(-FEED_GRADE_MAX\);/);
  const itens = [];
  for (let d = 0; d < 20; d += 1) itens.push({ id: `f${d}`, cliente: 'Lions', formato: 'Card', veiculacao_iso: `2026-12-${String(1 + d).padStart(2, '0')}`, status: 'A Fazer' });
  for (let d = 1; d <= 12; d += 1) itens.push({ id: `p${d}`, cliente: 'Lions', formato: 'Card', veiculacao_iso: `2026-11-${String(d).padStart(2, '0')}`, status: 'Finalizado' });
  const c = ambiente(itens);
  const g = vm.runInContext("feedMontar({ nome: 'Lions', usuario: '' })", c);
  assert.equal(g.noAr.length, 9, 'as 9 últimas publicadas');
  assert.deepEqual([...g.noAr].slice(0, 2).map((x) => x.item.id), ['p12', 'p11']);
  const html = vm.runInContext("feedClienteHtml({ nome: 'Lions', usuario: '', heads: [], carteira: '', bio: '', site: '' })", c);
  const datas = [...html.matchAll(/data-vfd-alvo="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  assert.equal(datas[datas.length - 1] <= '2026-11-20', true, 'a mais próxima de hoje fica na grade, encostada no que está no ar');
  const repetidos = vm.runInContext(`CADASTRO_CLIENTES = [{ nome: 'Copirecê', ativo: true, cadastro: { instagram: '@copirece' } },
    { nome: 'Copirece', ativo: true, cadastro: { instagram: '@copirece' } }, { nome: 'Copirecê Puro Milho', ativo: true, cadastro: { instagram: 'copirece' } }];
    feedClientes().map((x) => x.nome)`, c);
  assert.equal(repetidos.length, 1, 'um cliente, um perfil');
});
