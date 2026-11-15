// Captura do feed atual de cada cliente, feita uma vez pelo navegador logado da Vybe (Paulo, 15/11/2026: "pq não
// olha logado no Insta de cada cliente aqui e cria a prévia lá? Só precisa fazer isso 1 vez... depois o que for
// saindo o sistema vai atualizando"). Do perfil público vêm o cabeçalho (nome, bio, site, posts, seguidores,
// seguindo) e os 12 primeiros quadros da grade, já reduzidos a 360 px. As imagens ficam no banco, porque o endereço do
// CDN do Instagram é assinado e vence. A tela junta, na frente, o que a Vybe publicou depois da captura.
//
// Ordem no Feed (server/instagram-feed.js): API da Meta, se ligada > esta captura > página pública de incorporação.
//
//   POST /api/painel?area=feed_instagram  { acao: 'captura', perfil }   só os donos (ou o serviço)
//   GET  /api/painel?area=feed_instagram&captura=<usuario>&img=<foto|codigo>   a imagem guardada
import { umaVez } from './uma-vez.js';
import { ehDonoPessoa } from './donos.js';

export const CAPTURA_MAX_POSTS = 12;
const IMG_MAX = 200 * 1024; // por imagem, já em JPEG
const CODIGO = /^[A-Za-z0-9_-]{5,40}$/;
const USUARIO = /^[a-z0-9._]{1,30}$/;

export function garantirTabelasCaptura(db) { return umaVez('feed_captura', db, criarTabelasCaptura); }
async function criarTabelasCaptura(db) {
  await db`CREATE TABLE IF NOT EXISTS vybe_feed_captura (
    usuario TEXT PRIMARY KEY,
    capturado_em TIMESTAMPTZ NOT NULL,
    perfil JSONB NOT NULL,
    gravado_por BIGINT,
    gravado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS vybe_feed_captura_imagem (
    usuario TEXT NOT NULL,
    chave TEXT NOT NULL,
    dados TEXT NOT NULL,
    PRIMARY KEY (usuario, chave)
  )`;
}

// "13,3 mil" → 13300; "1,2 mi" → 1200000; "1.180" / "1180" → 1180.
export function numeroDoInstagram(txt) {
  const m = String(txt || '').trim().match(/^([\d.,]+)\s*(mil|mi|milhões|milhão|k|m)?$/i);
  if (!m) return null;
  const mult = { mil: 1e3, k: 1e3, mi: 1e6, 'milhões': 1e6, 'milhão': 1e6, m: 1e6 }[String(m[2] || '').toLowerCase()] || 1;
  const base = mult > 1 ? Number(m[1].replace(/\./g, '').replace(',', '.')) : Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(base) ? Math.round(base * mult) : null;
}

// O texto do cabeçalho do perfil, como o Instagram mostra (pt-BR ou pt-PT), vira os campos do Feed. Fica de fora o
// que é da conta que capturou ("Seguidores: fulano, beltrano...", botões e destaques).
export function lerCabecalho(texto, usuario = '') {
  const linhas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const achar = (re) => linhas.findIndex((l) => re.test(l));
  const iPosts = achar(/^[\d.,]+\s*(mil|mi)?\s+(publicaç|posts?\b)/i);
  const iSeg = achar(/^[\d.,]+\s*(mil|mi)?\s+seguidor/i);
  const iSeguindo = achar(/^(A seguir|Seguindo)\s+[\d.,]+|^[\d.,]+\s*(mil|mi)?\s+seguindo/i);
  const num = (i, re) => (i < 0 ? null : numeroDoInstagram(linhas[i].replace(re, '').trim()));
  const fimNums = Math.max(iPosts, iSeg, iSeguindo);
  const nome = linhas.slice(0, Math.max(0, iPosts)).find((l) => l.toLowerCase() !== usuario) || '';
  const parada = linhas.findIndex((l, i) => i > fimNums && /^(Seguidores:|Seguido por|Seguir\b|A seguir$|Seguindo$|Enviar mensagem|Mensagem$)/i.test(l));
  let corpo = linhas.slice(fimNums + 1, parada < 0 ? undefined : parada).filter((l) => l.toLowerCase() !== usuario);
  let site = '';
  const iSite = corpo.findIndex((l) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?(\s+e mais \d+)?$/i.test(l));
  if (iSite >= 0) { site = corpo[iSite].replace(/\s+e mais \d+$/i, ''); corpo = corpo.filter((_, i) => i !== iSite); }
  return {
    nome: nome.slice(0, 150),
    bio: corpo.join('\n').slice(0, 300),
    site: site.slice(0, 200),
    total_posts: num(iPosts, /\s*(publicações|publicação|posts?)$/i),
    seguidores: num(iSeg, /\s*seguidor(es)?$/i),
    seguindo: iSeguindo < 0 ? null : numeroDoInstagram(linhas[iSeguindo].replace(/^(A seguir|Seguindo)\s+/i, '').replace(/\s*seguindo$/i, '')),
  };
}

function jpegDoDataUrl(v) {
  const m = String(v || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bytes = Buffer.from(m[1], 'base64');
  // Começa com a marca do JPEG (FF D8 FF) e cabe no limite: nada além de imagem entra no banco.
  if (bytes.length < 200 || bytes.length > IMG_MAX || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  return bytes.toString('base64');
}

const erroDeUso = (msg) => Object.assign(new Error(msg), { publica: true });

// O que a aba do Instagram mandou → { usuario, capturado_em, perfil, imagens: Map(chave → base64) }.
export function validarCaptura(bruto = {}, { agora = Date.now() } = {}) {
  const usuario = String(bruto.usuario || '').toLowerCase();
  if (!USUARIO.test(usuario)) throw erroDeUso('Perfil inválido.');
  const quando = Date.parse(bruto.capturado_em);
  if (!Number.isFinite(quando) || quando > agora + 60_000 || quando < agora - 30 * 864e5) throw erroDeUso('Data da captura inválida.');
  const cab = lerCabecalho(bruto.cabecalho, usuario);
  const imagens = new Map();
  const foto = jpegDoDataUrl(bruto.foto);
  if (foto) imagens.set('foto', foto);
  const posts = [];
  for (const p of (Array.isArray(bruto.posts) ? bruto.posts : []).slice(0, CAPTURA_MAX_POSTS)) {
    const codigo = String(p?.codigo || '');
    const img = jpegDoDataUrl(p?.imagem);
    if (!CODIGO.test(codigo) || !img || imagens.has(codigo)) continue;
    imagens.set(codigo, img);
    const tipo = p.tipo === 'reel' || p.tipo === 'video' ? 'video' : p.tipo === 'carrossel' ? 'carrossel' : 'foto';
    posts.push({ codigo, tipo, fixado: Boolean(p.fixado), legenda: String(p.legenda || '').slice(0, 300), link: `https://www.instagram.com/${tipo === 'video' ? 'reel' : 'p'}/${codigo}/` });
  }
  if (!posts.length && !foto) throw erroDeUso('A captura veio sem imagens.');
  return { usuario, capturado_em: new Date(quando).toISOString(), perfil: { ...cab, posts }, imagens };
}

export async function gravarCaptura(db, bruto, { pessoaId = null, agora = Date.now() } = {}) {
  const c = validarCaptura(bruto, { agora });
  await garantirTabelasCaptura(db);
  await db`INSERT INTO vybe_feed_captura (usuario, capturado_em, perfil, gravado_por, gravado_em)
    VALUES (${c.usuario}, ${c.capturado_em}, ${JSON.stringify(c.perfil)}::jsonb, ${pessoaId}, NOW())
    ON CONFLICT (usuario) DO UPDATE SET capturado_em = EXCLUDED.capturado_em, perfil = EXCLUDED.perfil, gravado_por = EXCLUDED.gravado_por, gravado_em = NOW()`;
  await db`DELETE FROM vybe_feed_captura_imagem WHERE usuario = ${c.usuario}`;
  for (const [chave, dados] of c.imagens) {
    await db`INSERT INTO vybe_feed_captura_imagem (usuario, chave, dados) VALUES (${c.usuario}, ${chave}, ${dados})`;
  }
  return { usuario: c.usuario, posts: c.perfil.posts.length, foto: c.imagens.has('foto') };
}

const versao = (iso) => String(Date.parse(iso) || 0).slice(0, -3);
const enderecoImg = (usuario, chave, iso) => `/api/painel?area=feed_instagram&captura=${encodeURIComponent(usuario)}&img=${encodeURIComponent(chave)}&v=${versao(iso)}`;

// As capturas gravadas, no mesmo formato do perfil que a tela já usa (fonte 'captura').
export async function capturasGuardadas(db, usuarios) {
  const lista = [...new Set((usuarios || []).filter((u) => USUARIO.test(u)))];
  if (!db || !lista.length) return {};
  await garantirTabelasCaptura(db);
  const linhas = await db`SELECT usuario, capturado_em, perfil FROM vybe_feed_captura WHERE usuario = ANY(${lista})`;
  const saida = {};
  for (const l of linhas) {
    const iso = new Date(l.capturado_em).toISOString(), p = l.perfil || {};
    saida[l.usuario] = {
      usuario: l.usuario, nome: p.nome || '', bio: p.bio || '', site: p.site || '', verificado: false,
      total_posts: p.total_posts ?? null, seguidores: p.seguidores ?? null, seguindo: p.seguindo ?? null,
      foto: enderecoImg(l.usuario, 'foto', iso),
      posts: (p.posts || []).map((x) => ({ ...x, data: null, imagem: enderecoImg(l.usuario, x.codigo, iso) })),
      fonte: 'captura', capturado_em: iso,
    };
  }
  return saida;
}

export async function servirImagemCapturada(db, usuario, chave, res) {
  if (!USUARIO.test(usuario) || !(chave === 'foto' || CODIGO.test(chave))) return res.status(400).json({ error: 'Imagem inválida.' });
  await garantirTabelasCaptura(db);
  const [l] = await db`SELECT dados FROM vybe_feed_captura_imagem WHERE usuario = ${usuario} AND chave = ${chave}`;
  if (!l) return res.status(404).json({ error: 'Imagem indisponível.' });
  const bytes = Buffer.from(l.dados, 'base64');
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // O endereço muda a cada captura (&v=), então pode ficar guardado no navegador.
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
  return res.status(200).end(bytes);
}

export function podeGravarCaptura(quem, env = process.env) {
  return Boolean(quem && (quem.tipo === 'servico' || (quem.pessoa && ehDonoPessoa(quem.pessoa, env))));
}
