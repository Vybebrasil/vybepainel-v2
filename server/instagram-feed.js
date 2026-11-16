// Feed público do Instagram de cada cliente, sem conectar conta nenhuma (Paulo, 15/11/2026: "consegui fazer isso no
// sistema do E aí Primos sem conectar nada"). A página pública de incorporação do perfil
// (instagram.com/<usuario>/embed/) traz o perfil e os posts mais recentes (6, em geral) com imagem, data, tipo e código.
// O servidor lê essa página, guarda por uma hora e devolve só o que a tela usa. Perfil privado, inexistente ou
// fora do ar volta com `erro` e a tela segue com o que o Vybe OS sabe.
//
//   GET /api/painel?area=feed_instagram&usuarios=a,b,c   (até 40 por vez; qualquer sessão da equipe)

import { capturasGuardadas, gravarCaptura, servirImagemCapturada, podeGravarCaptura } from './instagram-captura.js';

const VALIDADE_MS = 60 * 60 * 1000;
const ESPERA_MS = 7000;
const MAX_POR_VEZ = 40;
const AO_MESMO_TEMPO = 4;
const CACHE = new Map(); // usuario -> { quando, dados }

// "@Fulano", "https://instagram.com/fulano/", "instagram.com/fulano?igsh=..." viram "fulano".
export function usuarioDoInstagram(valor) {
  let s = String(valor ?? '').trim();
  if (!s) return '';
  const url = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) && !/^(p|reel|reels|explore|stories)$/.test(s) ? s : '';
}

// Objeto JSON que começa em txt[ini] === '{', respeitando strings (a página tem JSON dentro de JS).
function objetoEm(txt, ini) {
  let d = 0, dentro = false, esc = false;
  for (let i = ini; i < txt.length; i++) {
    const c = txt[i];
    if (dentro) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') dentro = false; continue; }
    if (c === '"') dentro = true; else if (c === '{') d++; else if (c === '}') { d--; if (!d) return txt.slice(ini, i + 1); }
  }
  return null;
}
function acharChave(o, chave, fundo = 0) {
  if (!o || typeof o !== 'object' || fundo > 40) return undefined;
  if (Object.prototype.hasOwnProperty.call(o, chave)) return o[chave];
  for (const v of Object.values(o)) { const r = acharChave(v, chave, fundo + 1); if (r !== undefined) return r; }
  return undefined;
}

const TIPOS = { GraphImage: 'foto', GraphSidecar: 'carrossel', GraphVideo: 'video' };

// Lê o HTML da página de incorporação e devolve { usuario, nome, seguidores, posts: [...] } ou null.
export function lerPaginaDoPerfil(html) {
  const txt = String(html || '');
  let ctx = null;
  for (let k = txt.indexOf('s.handle('); k >= 0 && !ctx; k = txt.indexOf('s.handle(', k + 1)) {
    const bruto = objetoEm(txt, k + 9);
    if (!bruto || !bruto.includes('contextJSON')) continue;
    try { const v = acharChave(JSON.parse(bruto), 'contextJSON'); if (typeof v === 'string') ctx = JSON.parse(v); } catch { /* segue procurando */ }
  }
  if (!ctx) return null;
  const perfil = ctx.context || ctx;
  const vistos = new Set(), posts = [];
  (function andar(o, fundo) {
    if (!o || typeof o !== 'object' || fundo > 40) return;
    if (o.shortcode && o.display_url && !vistos.has(o.shortcode)) {
      vistos.add(o.shortcode);
      const quando = Number(o.taken_at_timestamp) || 0;
      posts.push({
        codigo: String(o.shortcode),
        tipo: TIPOS[o.__typename] || (o.is_video ? 'video' : 'foto'),
        data: quando ? new Date(quando * 1000).toISOString() : null,
        imagem: String(o.display_url),
        link: `https://www.instagram.com/p/${encodeURIComponent(o.shortcode)}/`,
        fixado: Array.isArray(o.pinned_for_users) && o.pinned_for_users.length > 0,
      });
      return;
    }
    for (const v of Object.values(o)) andar(v, fundo + 1);
  })(ctx, 0);
  const seguidores = Number(perfil.followers_count ?? acharChave(ctx, 'edge_followed_by')?.count);
  const total = Number(perfil.posts_count ?? acharChave(ctx, 'edge_owner_to_timeline_media')?.count);
  return {
    usuario: String(perfil.username || ''),
    nome: String(perfil.full_name || ''),
    // O cabeçalho do perfil (Paulo, 15/11/2026: "é pra ficar tipo o feed mesmo do Insta... tudo certinho"): foto, selo e
    // número de posts. A bio e o "seguindo" não vêm na página pública; a bio sai do cadastro do cliente.
    foto: typeof perfil.profile_pic_url === 'string' ? perfil.profile_pic_url : null,
    verificado: Boolean(perfil.is_verified || perfil.verified),
    total_posts: Number.isFinite(total) ? total : null,
    seguidores: Number.isFinite(seguidores) ? seguidores : null,
    // A grade do Instagram vem do mais novo para o mais antigo; fixado fica no topo lá, mas aqui conta pela data.
    posts: posts.sort((a, b) => String(b.data).localeCompare(String(a.data))),
  };
}

// API oficial da Meta pela conta da Vybe (Paulo, 15/11/2026: "sim, pela Meta"). O Business Discovery devolve, de
// qualquer perfil comercial ou de criador, a bio, o site, seguidores, seguindo, posts, a foto e os posts com imagem
// (vídeo pela capa), data e link. Liga com duas variáveis na Vercel (docs/instagram-meta.md):
//   META_IG_TOKEN   token de acesso da conta da Vybe (de preferência de usuário do sistema, que não vence)
//   META_IG_USER_ID id da conta profissional do Instagram da Vybe
// Sem elas, ou se a Meta recusar o perfil (pessoal, privado), vale a página pública de incorporação, como antes.
const META_VERSAO = 'v23.0';
const META_CAMPOS = 'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,'
  + 'media.limit(12){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}}';
export function metaConfigurada(env = process.env) { return Boolean(String(env.META_IG_TOKEN || '').trim() && /^\d+$/.test(String(env.META_IG_USER_ID || '').trim())); }
export function lerPerfilDaMeta(json, usuario) {
  const b = json?.business_discovery;
  if (!b || typeof b !== 'object') return null;
  const tipo = (m) => (m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : m.media_type === 'VIDEO' ? 'video' : 'foto');
  const imagem = (m) => {
    if (m.media_type === 'VIDEO') return m.thumbnail_url || null;
    if (m.media_url) return m.media_url;
    const f = (m.children?.data || [])[0]; return f ? (f.media_type === 'VIDEO' ? f.thumbnail_url : f.media_url) || null : null;
  };
  const posts = (b.media?.data || []).map((m) => ({
    codigo: String(m.id), tipo: tipo(m), data: m.timestamp ? new Date(m.timestamp).toISOString() : null, imagem: imagem(m),
    link: typeof m.permalink === 'string' ? m.permalink : `https://www.instagram.com/${encodeURIComponent(usuario)}/`, fixado: false,
    legenda: typeof m.caption === 'string' ? m.caption.slice(0, 300) : '',
  })).filter((p) => p.imagem);
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    usuario: String(b.username || usuario), nome: String(b.name || ''), foto: b.profile_picture_url || null, verificado: false,
    bio: typeof b.biography === 'string' ? b.biography : '', site: typeof b.website === 'string' ? b.website : '',
    total_posts: n(b.media_count), seguidores: n(b.followers_count), seguindo: n(b.follows_count),
    posts: posts.sort((a, z) => String(z.data).localeCompare(String(a.data))), fonte: 'meta',
  };
}
async function buscarNaMeta(usuario, { buscar, env }) {
  const token = String(env.META_IG_TOKEN || '').trim(), conta = String(env.META_IG_USER_ID || '').trim();
  const url = `https://graph.facebook.com/${META_VERSAO}/${conta}?fields=${encodeURIComponent(`business_discovery.username(${usuario}){${META_CAMPOS}}`)}`;
  try {
    // O token vai no cabeçalho, não na URL: assim não aparece em log de erro nem em rastreio de rede.
    const r = await buscar(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MS) });
    const json = await r.json().catch(() => null);
    if (!r.ok) {
      // Perfil pessoal ou inexistente vem como erro da Meta (código 110/100); o resto (token vencido, limite) vai ao log.
      const e = json?.error || {};
      if (![100, 110].includes(Number(e.code))) console.warn('[feed_instagram] meta', usuario, r.status, e.code || '', e.error_subcode || '', String(e.message || '').slice(0, 160));
      return null;
    }
    return lerPerfilDaMeta(json, usuario);
  } catch (erro) {
    console.warn('[feed_instagram] meta', usuario, erro?.name || '', String(erro?.message || '').slice(0, 120));
    return null;
  }
}

async function buscarPerfil(usuario, { buscar = fetch, agora = Date.now(), env = process.env, captura = null } = {}) {
  const guardado = CACHE.get(usuario);
  // A captura gravada (server/instagram-captura.js) vale mais que a página pública guardada; só a Meta passa na frente.
  if (guardado && agora - guardado.quando < VALIDADE_MS && (!captura || guardado.dados.fonte === 'meta')) return guardado.dados;
  let dados = metaConfigurada(env) ? await buscarNaMeta(usuario, { buscar, env }) : null;
  if (dados) { CACHE.set(usuario, { quando: agora, dados }); return dados; }
  if (captura) return captura;
  try {
    const r = await buscar(`https://www.instagram.com/${encodeURIComponent(usuario)}/embed/`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'pt-BR,pt;q=0.9' },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!r.ok) dados = { usuario, erro: r.status === 404 ? 'Perfil não encontrado.' : 'O Instagram não respondeu agora.' };
    else {
      const lido = lerPaginaDoPerfil(await r.text());
      dados = lido ? { ...lido, usuario: lido.usuario || usuario } : { usuario, erro: 'Perfil privado ou sem posts públicos.' };
    }
  } catch (erro) {
    console.warn('[feed_instagram]', usuario, erro?.message || erro);
    dados = { usuario, erro: 'O Instagram não respondeu agora.' };
  }
  // Falha fica guardada por pouco tempo (5 min), para não martelar o Instagram nem travar a tela.
  CACHE.set(usuario, { quando: dados.erro ? agora - VALIDADE_MS + 5 * 60 * 1000 : agora, dados });
  return dados;
}

export async function feedsDoInstagram(lista, opcoes = {}) {
  const usuarios = [...new Set((lista || []).map(usuarioDoInstagram).filter(Boolean))].slice(0, MAX_POR_VEZ);
  const saida = {};
  let capturas = {};
  if (opcoes.db) {
    try { capturas = await capturasGuardadas(opcoes.db, usuarios); } catch (erro) { console.warn('[feed_instagram] captura', erro?.message || erro); }
  }
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(AO_MESMO_TEMPO, usuarios.length) }, async () => {
    while (i < usuarios.length) { const u = usuarios[i++]; saida[u] = await buscarPerfil(u, { ...opcoes, captura: capturas[u] || null }); }
  }));
  return saida;
}

export async function areaFeedInstagram(req, res, quem, opcoes = {}) {
  if (!quem || (quem.tipo !== 'servico' && !quem.pessoa)) return res.status(401).json({ error: 'Entre no painel para acessar.' });
  const db = opcoes.db || null;
  if (req.method === 'POST') {
    // Gravar a captura do feed (só os donos): o perfil público lido no navegador da Vybe, uma vez.
    if (!podeGravarCaptura(quem)) return res.status(403).json({ error: 'Só os donos gravam a captura do feed.' });
    if (!db) return res.status(503).json({ error: 'Banco indisponível agora.' });
    const b = req.body || {};
    if (b.acao !== 'captura') return res.status(400).json({ error: 'Ação inválida.' });
    try {
      const r = await gravarCaptura(db, b.perfil, { pessoaId: quem.pessoa?.id ?? null });
      CACHE.delete(r.usuario);
      return res.status(200).json({ ok: true, ...r });
    } catch (erro) {
      if (erro?.publica) return res.status(400).json({ error: erro.message });
      console.warn('[feed_instagram] gravar captura', erro?.message || erro);
      return res.status(500).json({ error: 'Não deu para gravar a captura agora.' });
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (req.query?.captura) {
    if (!db) return res.status(503).json({ error: 'Banco indisponível agora.' });
    return servirImagemCapturada(db, String(req.query.captura), String(req.query.img || ''), res);
  }
  if (req.query?.foto) return repassarFoto(String(req.query.foto), res, opcoes);
  if (req.query?.avatar) return fotoDoPerfil(String(req.query.avatar), res, { ...opcoes, db });
  const lista = String(req.query?.usuarios || '').split(',');
  const perfis = await feedsDoInstagram(lista, { ...opcoes, db });
  res.setHeader?.('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ ok: true, perfis });
}

// A imagem do post e a foto do perfil passam pelo servidor (o endereço do CDN do Instagram é assinado e, aberto direto
// no navegador da equipe, nem sempre carrega: Paulo, 15/11/2026, "o que é do insta não carregou os previews").
// Só o CDN do Instagram, só imagem, até 6 MB.
export const FOTO_DO_INSTAGRAM = /^https:\/\/[a-z0-9.-]+\.(cdninstagram\.com|fbcdn\.net)\//i;
const FOTO_MAX = 6 * 1024 * 1024;
async function repassarFoto(url, res, { buscar = fetch } = {}) {
  if (!FOTO_DO_INSTAGRAM.test(url)) return res.status(400).json({ error: 'Imagem inválida.' });
  try {
    const r = await buscar(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(ESPERA_MS) });
    const tipo = String(r.headers?.get?.('content-type') || '');
    if (!r.ok || !/^image\//i.test(tipo)) return res.status(404).json({ error: 'Imagem indisponível.' });
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > FOTO_MAX) return res.status(413).json({ error: 'Imagem grande demais.' });
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).end(bytes);
  } catch (erro) {
    console.warn('[feed_instagram] foto', erro?.message || erro);
    return res.status(502).json({ error: 'Imagem indisponível agora.' });
  }
}

// Só a foto do perfil, como imagem (vybe-logo-cliente.js: a logo do cliente em todas as telas, sem a tela precisar abrir o
// Feed antes). Lê o perfil pelo mesmo caminho do Feed (cache de 1 h, captura gravada, Meta) e não grava nada.
//   GET /api/painel?area=feed_instagram&avatar=<usuario>
async function fotoDoPerfil(valor, res, opcoes = {}) {
  const usuario = usuarioDoInstagram(valor);
  const nada = () => { res.setHeader('Cache-Control', 'private, max-age=600'); return res.status(404).json({ error: 'Sem foto do perfil.' }); };
  if (!usuario) return nada();
  const perfil = (await feedsDoInstagram([usuario], opcoes))[usuario];
  const foto = perfil && !perfil.erro ? String(perfil.foto || '') : '';
  if (!foto) return nada();
  // A captura guardada já é servida pelo Vybe OS: só aponta para ela.
  if (foto.startsWith('/api/painel?area=feed_instagram&captura=')) { res.setHeader('Cache-Control', 'private, max-age=3600'); res.setHeader('Location', foto); return res.status(302).end(); }
  return repassarFoto(foto, res, opcoes);
}

export function limparCacheDoFeed() { CACHE.clear(); }
