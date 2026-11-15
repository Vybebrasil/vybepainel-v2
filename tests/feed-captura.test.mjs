// Captura do feed atual do cliente (Paulo, 15/11/2026: "só precisa fazer isso 1 vez... depois o que for saindo o
// sistema vai atualizando"): o cabeçalho do perfil vira os campos do Feed, as imagens ficam no banco e a tela junta o
// que a Vybe publicou depois. Contra um Postgres de verdade (PGlite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { lerCabecalho, numeroDoInstagram, validarCaptura, gravarCaptura, capturasGuardadas, cortar } from '../server/instagram-captura.js';
import { areaFeedInstagram, limparCacheDoFeed } from '../server/instagram-feed.js';

const AGORA = Date.parse('2026-11-15T18:00:00Z');
// JPEG mínimo que passa na marca (FF D8 FF) e no tamanho mínimo.
const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString('base64');
const CABECALHO = [
  'loja.exemplo', 'Loja Exemplo | Irecê', '1180 publicações', '13,3 mil seguidores', 'A seguir 5127',
  'Loja de roupas', '✨ Moda que acompanha você', '📍 Av. Central, 10, Irecê', 'loja.exemplo.com.br e mais 1',
  'Seguidores: fulano, beltrano + 10 outras pessoas', 'Seguir', 'Enviar mensagem', 'Destaque 1', 'Destaque 2',
].join('\n');
const captura = (extra = {}) => ({
  usuario: 'loja.exemplo', capturado_em: '2026-11-15T17:00:00Z', cabecalho: CABECALHO, foto: JPEG,
  posts: [
    { codigo: 'ABCDE1', tipo: 'imagem', fixado: true, legenda: 'Post fixado', imagem: JPEG },
    { codigo: 'ABCDE2', tipo: 'reel', imagem: JPEG },
    { codigo: 'ABCDE3', tipo: 'carrossel', imagem: JPEG },
    { codigo: 'ruim/../x', tipo: 'imagem', imagem: JPEG },
    { codigo: 'ABCDE4', tipo: 'imagem', imagem: 'data:image/png;base64,AAAA' },
  ],
  ...extra,
});

function resposta() {
  const r = { code: 0, body: null, headers: {}, bytes: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = (b) => { r.bytes = b; return r; };
  return r;
}

test('números do Instagram em português viram números', () => {
  assert.equal(numeroDoInstagram('13,3 mil'), 13300);
  assert.equal(numeroDoInstagram('1180'), 1180);
  assert.equal(numeroDoInstagram('1.180'), 1180);
  assert.equal(numeroDoInstagram('1,2 mi'), 1200000);
  assert.equal(numeroDoInstagram('abc'), null);
});

test('o cabeçalho vira nome, bio, site e números, sem quem segue a conta que capturou', () => {
  const c = lerCabecalho(CABECALHO, 'loja.exemplo');
  assert.equal(c.nome, 'Loja Exemplo | Irecê');
  assert.equal(c.total_posts, 1180);
  assert.equal(c.seguidores, 13300);
  assert.equal(c.seguindo, 5127);
  assert.equal(c.site, 'loja.exemplo.com.br');
  assert.equal(c.bio, 'Loja de roupas\n✨ Moda que acompanha você\n📍 Av. Central, 10, Irecê');
  assert.ok(!JSON.stringify(c).includes('fulano'));
  assert.ok(!JSON.stringify(c).includes('Destaque'));
});

test('só entram JPEG e códigos de post válidos; reel vira vídeo com link de reel', () => {
  const c = validarCaptura(captura(), { agora: AGORA });
  assert.deepEqual(c.perfil.posts.map((p) => [p.codigo, p.tipo, p.fixado]), [['ABCDE1', 'foto', true], ['ABCDE2', 'video', false], ['ABCDE3', 'carrossel', false]]);
  assert.equal(c.perfil.posts[1].link, 'https://www.instagram.com/reel/ABCDE2/');
  assert.deepEqual([...c.imagens.keys()], ['foto', 'ABCDE1', 'ABCDE2', 'ABCDE3']);
  assert.throws(() => validarCaptura(captura({ usuario: 'A B' }), { agora: AGORA }), /Perfil inválido/);
  assert.throws(() => validarCaptura(captura({ capturado_em: '2026-12-30T00:00:00Z' }), { agora: AGORA }), /Data/);
  assert.throws(() => validarCaptura(captura({ foto: '', posts: [] }), { agora: AGORA }), /sem imagens/);
});

test('grava, regrava por cima e devolve no formato do Feed, com as imagens servidas pelo Vybe OS', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await gravarCaptura(sql, captura(), { pessoaId: 1, agora: AGORA });
  await gravarCaptura(sql, captura({ posts: captura().posts.slice(1, 2) }), { pessoaId: 1, agora: AGORA });
  const g = await capturasGuardadas(sql, ['loja.exemplo', 'outra']);
  assert.deepEqual(Object.keys(g), ['loja.exemplo']);
  const p = g['loja.exemplo'];
  assert.equal(p.fonte, 'captura');
  assert.equal(p.capturado_em, '2026-11-15T17:00:00.000Z');
  assert.equal(p.seguidores, 13300);
  assert.equal(p.posts.length, 1);
  assert.match(p.posts[0].imagem, /^\/api\/painel\?area=feed_instagram&captura=loja\.exemplo&img=ABCDE2&v=\d+$/);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM vybe_feed_captura_imagem WHERE usuario = 'loja.exemplo'`;
  assert.equal(n, 2, 'a regravação apaga as imagens antigas');
});

test('na rota: só dono grava, a lista usa a captura no lugar da página pública e a imagem sai como JPEG', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  limparCacheDoFeed();
  const dono = { pessoa: { id: 5, monday_user_id: '68035537' } }, equipe = { pessoa: { id: 9 } };
  const post = (quem, body) => { const r = resposta(); return areaFeedInstagram({ method: 'POST', query: {}, body }, r, quem, { db: sql }).then(() => r); };
  assert.equal((await post(equipe, { acao: 'captura', perfil: captura() })).code, 403);
  const ok = await post(dono, { acao: 'captura', perfil: { ...captura(), capturado_em: new Date().toISOString() } });
  assert.equal(ok.code, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.posts, 3);

  let pediuInstagram = 0;
  const buscar = async () => { pediuInstagram += 1; return { ok: false, status: 500 }; };
  const r = resposta();
  await areaFeedInstagram({ method: 'GET', query: { usuarios: 'loja.exemplo' } }, r, equipe, { db: sql, buscar, env: {} });
  assert.equal(r.code, 200);
  assert.equal(r.body.perfis['loja.exemplo'].fonte, 'captura');
  assert.equal(pediuInstagram, 0, 'com captura gravada não precisa ir ao Instagram');

  const img = resposta();
  await areaFeedInstagram({ method: 'GET', query: { captura: 'loja.exemplo', img: 'ABCDE1' } }, img, equipe, { db: sql });
  assert.equal(img.code, 200);
  assert.equal(img.headers['content-type'], 'image/jpeg');
  assert.equal(img.bytes[0], 0xff);
  const fora = resposta();
  await areaFeedInstagram({ method: 'GET', query: { captura: 'loja.exemplo', img: '../x' } }, fora, equipe, { db: sql });
  assert.equal(fora.code, 400);
});

test('legenda cortada no meio de um emoji grava sem a metade solta (ConectaSim, 15/11/2026)', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  const metade = 'Promoção 🚀'.slice(0, -1); // termina na primeira metade do emoji
  const c = captura({ posts: [{ codigo: 'EMOJI1', tipo: 'imagem', legenda: metade, imagem: JPEG }] });
  const r = await gravarCaptura(sql, c, { agora: AGORA });
  assert.equal(r.posts, 1);
  const g = await capturasGuardadas(sql, ['loja.exemplo']);
  assert.equal(g['loja.exemplo'].posts[0].legenda, 'Promoção ');
  assert.equal(cortar('ab🚀cd', 3), 'ab🚀');
});

test('a tela junta, na frente da captura, o que a Vybe publicou depois dela', () => {
  const src = readFileSync(new URL('../vybe-feed.js', import.meta.url), 'utf8');
  assert.match(src, /perfil\?\.fonte === 'captura' \? String\(perfil\.capturado_em/);
  assert.match(src, /publicadas\.filter\(\(x\) => x\.iso > desde\)/);
  assert.match(src, /u\.startsWith\('\/api\/painel\?area=feed_instagram&captura='\)/);
});

test('o + do "sem post" abre o cadastro do calendário com o cliente e o dia (Paulo, 15/11/2026)', () => {
  const src = readFileSync(new URL('../vybe-feed.js', import.meta.url), 'utf8');
  assert.match(src, /class="vfd-x-criar"[^>]*onclick="feedCriarNoDia\('\$\{jsArg\(cli\.nome\)\}','\$\{jsArg\(t\.iso\)\}'\)"/);
  assert.ok(src.includes("openCadastrosGoverned({ board: 'producao', client: cliente, ...(iso ? { veic: iso } : {})"));
  const css = readFileSync(new URL('../padrao-v2/feed.css', import.meta.url), 'utf8');
  assert.match(css, /\.vfd-x-criar\{position:absolute;inset:0/);
});

test('regra do feed por cliente: posts por semana, dias e seguir o calendário (Paulo, 15/11/2026)', async () => {
  const { limparCampo, CAMPOS_CADASTRO } = await import('../server/clientes-cadastro.js');
  const campo = (k) => CAMPOS_CADASTRO.find((c) => c.chave === k);
  assert.equal(limparCampo(campo('feed_dias'), 'Sex, segunda e Quarta'), 'seg,qua,sex');
  assert.equal(limparCampo(campo('feed_dias'), 'sábado,dom'), 'sab,dom');
  assert.throws(() => limparCampo(campo('feed_dias'), 'todo dia'), /use seg/);
  assert.equal(limparCampo(campo('feed_por_semana'), '6'), '6');
  assert.equal(limparCampo(campo('feed_por_semana'), 'Seguir o calendário'), 'Seguir o calendário');
  assert.throws(() => limparCampo(campo('feed_por_semana'), '9'), /escolha/);
  const src = readFileSync(new URL('../vybe-feed.js', import.meta.url), 'utf8');
  assert.match(src, /for \(let s = 0; s < FEED_SEMANAS && !regra\.soCalendario; s \+= 1\)/);
  assert.match(src, /let falta = regra\.porSemana - n;/);
  assert.match(src, /body: JSON\.stringify\(\{ acao: 'cadastro', id: cli\.id, campos \}\)/);
  assert.match(src, /onclick="feedAjustar\('\$\{jsArg\(cli\.nome\)\}'\)">Ajustar feed<\/button>/);
});
