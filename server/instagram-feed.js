// Feed público do Instagram de cada cliente, sem conectar conta nenhuma (Paulo, 15/11/2026: "consegui fazer isso no
// sistema do E aí Primos sem conectar nada"). A página pública de incorporação do perfil
// (instagram.com/<usuario>/embed/) traz o perfil e os posts mais recentes (6, em geral) com imagem, data, tipo e código.
// O servidor lê essa página, guarda por uma hora e devolve só o que a tela usa. Perfil privado, inexistente ou
// fora do ar volta com `erro` e a tela segue com o que o Vybe OS sabe.
//
//   GET /api/painel?area=feed_instagram&usuarios=a,b,c   (até 40 por vez; qualquer sessão da equipe)

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
  return {
    usuario: String(perfil.username || ''),
    nome: String(perfil.full_name || ''),
    seguidores: Number.isFinite(seguidores) ? seguidores : null,
    // A grade do Instagram vem do mais novo para o mais antigo; fixado fica no topo lá, mas aqui conta pela data.
    posts: posts.sort((a, b) => String(b.data).localeCompare(String(a.data))),
  };
}

async function buscarPerfil(usuario, { buscar = fetch, agora = Date.now() } = {}) {
  const guardado = CACHE.get(usuario);
  if (guardado && agora - guardado.quando < VALIDADE_MS) return guardado.dados;
  let dados;
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
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(AO_MESMO_TEMPO, usuarios.length) }, async () => {
    while (i < usuarios.length) { const u = usuarios[i++]; saida[u] = await buscarPerfil(u, opcoes); }
  }));
  return saida;
}

export async function areaFeedInstagram(req, res, quem, opcoes = {}) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!quem || (quem.tipo !== 'servico' && !quem.pessoa)) return res.status(401).json({ error: 'Entre no painel para acessar.' });
  const lista = String(req.query?.usuarios || '').split(',');
  const perfis = await feedsDoInstagram(lista, opcoes);
  res.setHeader?.('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ ok: true, perfis });
}

export function limparCacheDoFeed() { CACHE.clear(); }
