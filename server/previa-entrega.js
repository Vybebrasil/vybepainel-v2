// A prévia de uma peça que não tem arquivo anexado, tirada do LINK DE ENTREGA (Paulo, 24/11/2026: "ao inves da previa
// preta, se o video nao tiver capa não deveria aparecer uma tumb do primeiro frame?"). O Reels editado quase sempre
// entra como link de entrega do Drive (passa do limite do upload), e o baralho das aprovações mostrava um quadro preto
// com "sem arquivo". O link sai da mesma nota que a gaveta e o aviso do WhatsApp já leem ("[Vybe OS · Link de entrega]",
// "Link final", "Entrega final"); o material bruto nunca entra (é outra nota, e a pasta da captação não é a peça).
//
// Pasta → o que ela tem de imagem e vídeo (até dois níveis de subpasta), escolhido como o detalhe da peça escolhe
// (vybe-mundo-conteudo.js, previaDoDetalhe): 2 ou mais imagens é carrossel "1/N"; senão o vídeo; senão a imagem. Numa
// pasta do dia com vários clientes, vale a subpasta do arquivo que mais combina com a peça (notaDoVideo). Arquivo → ele
// mesmo. A miniatura sai pelo proxy autenticado area=miniatura (de um vídeo, o Drive dá um quadro dele); como o arquivo
// não está em vybe_conteudo_arquivos, a URL leva uma assinatura do servidor que só ele emite, para quem já pode abrir a
// peça. Só leitura: nada muda de compartilhamento no Drive.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { textoDoHistorico } from './texto-historico.js';
import { notaDoVideo } from './drive-videos.js';
import { faixaPedida } from './conteudo-aprovacao-pagina.js';

const ID = /^[\w-]{10,200}$/;
const PASTA = 'application/vnd.google-apps.folder';
const MARCA = /Link de entrega|Link final|Entrega final/i;
const VIDEO_DIRETO = /\.(mp4|mov|m4v|webm)(?:$|[?#])/i;
const IMAGEM_DIRETA = /\.(png|jpe?g|gif|webp|avif)(?:$|[?#])/i;

// O link da nota de entrega mais nova (as notas vêm da mais nova para a mais antiga).
export function linkDeEntrega(notas = []) {
  for (const n of notas) {
    const texto = textoDoHistorico(n?.corpo);
    if (!MARCA.test(texto)) continue;
    const url = (texto.match(/https?:\/\/[^\s<>"']+/i)?.[0] || '').replace(/[),.;]+$/, '');
    if (url) return url;
  }
  return '';
}
export function idsDoLink(url) {
  const u = String(url || '');
  return {
    arquivo: (u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/i) || [])[1] || '',
    pasta: (u.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/i) || [])[1] || '',
  };
}

// A assinatura da miniatura: o segredo da sessão do painel (o mesmo de server/upload-contexto.js). Sem segredo
// configurado não há assinatura, e a prévia vem sem miniatura (o quadro com ▶ e o nome) em vez de abrir o proxy.
function segredo() { return process.env.SESSAO_SECRET || process.env.MIRROR_ADMIN_KEY || ''; }
const assinar = (proposito, id) => {
  const s = segredo();
  return s && ID.test(String(id || '')) ? createHmac('sha256', s).update(proposito + id).digest('base64url').slice(0, 32) : '';
};
const confere = (esperada, assinatura) => { const dada = String(assinatura || '');
  return Boolean(esperada) && dada.length === esperada.length && timingSafeEqual(Buffer.from(dada), Buffer.from(esperada)); };
export function assinarMiniatura(id) { return assinar('vybe-previa-entrega:v1:', id); }
export function miniaturaAssinada(id, assinatura) { return confere(assinarMiniatura(id), assinatura); }
// O vídeo da entrega tem assinatura própria: a da miniatura (que só abre a imagem) não abre o arquivo.
export function assinarVideo(id) { return assinar('vybe-previa-entrega:video:v1:', id); }
export function videoAssinado(id, assinatura) { return confere(assinarVideo(id), assinatura); }
export function videoDaEntrega(id) {
  const e = assinarVideo(id);
  return e ? `/api/painel?area=video_entrega&id=${encodeURIComponent(id)}&e=${e}` : null;
}
export function miniaturaDaEntrega(id, sz = 480) {
  const e = assinarMiniatura(id);
  return e ? `/api/painel?area=miniatura&id=${encodeURIComponent(id)}&sz=${Number(sz) || 480}&e=${e}` : null;
}

const tipoDoMime = (m) => (String(m || '').startsWith('video/') ? 'video' : String(m || '').startsWith('image/') ? 'imagem' : '');
const pelaOrdem = (x, y) => String(x.nome || '').localeCompare(String(y.nome || ''), 'pt-BR', { numeric: true }) || String(x.criado || '').localeCompare(String(y.criado || ''));

// O que a pasta tem de imagem e vídeo, com o caminho da subpasta (como server/drive-videos.js lista os vídeos).
export async function midiasDaPasta(pastaId, { listar, niveis = 2, maxPastas = 30, maxArquivos = 120 } = {}) {
  if (!ID.test(String(pastaId || ''))) return [];
  const achados = [];
  let fila = [{ id: pastaId, caminho: [] }], vistas = 0;
  for (let nivel = 0; nivel <= niveis && fila.length && achados.length < maxArquivos; nivel++) {
    const proxima = [];
    for (const p of fila) {
      if (vistas++ >= maxPastas) break;
      for (const f of await listar(p.id)) {
        if (f.mimeType === PASTA) { proxima.push({ id: f.id, caminho: [...p.caminho, f.name] }); continue; }
        const tipo = tipoDoMime(f.mimeType);
        if (tipo && achados.length < maxArquivos)
          achados.push({ id: f.id, nome: f.name || '', tipo, caminho: p.caminho.join(' / '), miniatura: f.hasThumbnail !== false, criado: f.createdTime || '' });
      }
    }
    fila = proxima;
  }
  return achados;
}

// Qual arquivo da pasta é a prévia. Na pasta do dia (várias subpastas, vários clientes) vale a subpasta do arquivo que
// mais combina com a peça; sem nenhum que combine, os arquivos da própria pasta (ou todos, se ela só tem subpastas).
export function escolherDaPasta(arquivos = [], peca = {}) {
  if (!arquivos.length) return null;
  const notas = arquivos.map((a, i) => ({ a, i, nota: notaDoVideo(a, peca) })).sort((x, y) => y.nota - x.nota || x.i - y.i);
  const raiz = arquivos.filter((a) => !a.caminho);
  const grupo = notas[0].nota > 0 ? arquivos.filter((a) => a.caminho === notas[0].a.caminho) : raiz.length ? raiz : arquivos;
  const imagens = grupo.filter((a) => a.tipo === 'imagem').sort(pelaOrdem);
  const videos = grupo.filter((a) => a.tipo === 'video').map((a, i) => ({ a, i, nota: notaDoVideo(a, peca) })).sort((x, y) => y.nota - x.nota || x.i - y.i).map((x) => x.a);
  const escolha = imagens.length > 1 || (!videos.length && imagens.length) ? imagens[0] : videos[0];
  // Frente s-z (25/11/2026, "um botão pra ir pro próximo ou voltar"): o grupo inteiro vai junto (as imagens pela ordem do
  // número no nome, 01, 02…, e os vídeos depois), para a conferência passar entre todos os arquivos da peça em vez de
  // mostrar só o primeiro com "1 de N na pasta". A escolha da capa (o baralho) não muda.
  const grupoTodo = [...imagens, ...videos].slice(0, ITENS_DA_PASTA_MAX);
  return escolha ? { ...escolha, n: imagens.length > 1 ? imagens.length : 0, ...(grupoTodo.length > 1 ? { grupo: grupoTodo } : {}) } : null;
}
export const ITENS_DA_PASTA_MAX = 30;

// Um arquivo da pasta como a conferência mostra: a miniatura pequena (a fita embaixo do palco), a grande (o palco) e o
// vídeo pelo quadro assinado. A assinatura não leva o tamanho, então a grande é a mesma URL com outro sz.
const itemDaPasta = (a) => ({
  id: a.id, tipo: a.tipo, nome: String(a.nome || ''), abrir: `https://drive.google.com/file/d/${a.id}/view`,
  thumb: a.miniatura ? miniaturaDaEntrega(a.id) : null, grande: a.miniatura ? miniaturaDaEntrega(a.id, 1600) : null,
  ...(a.tipo === 'video' ? { quadro: videoDaEntrega(a.id) } : {}),
});
const previaDoArquivo = (a, url) => ({
  tipo: a.tipo, thumb: a.miniatura ? miniaturaDaEntrega(a.id) : null, abrir: `https://drive.google.com/file/d/${a.id}/view`,
  nome: String(a.nome || ''), n: a.n || 0, fonte: 'entrega', link: url,
  // Vídeo: o endereço do quadro de ~1 s (area=video_entrega), que a carta usa quando a miniatura do Drive vem preta.
  ...(a.tipo === 'video' ? { quadro: videoDaEntrega(a.id) } : {}),
  ...(Array.isArray(a.grupo) && a.grupo.length > 1 ? { itens: a.grupo.map(itemDaPasta) } : {}),
});
// Quando não dá para ler o Drive (sem acesso, fora do Drive): a prévia diz que há link de entrega, com ▶ quando é vídeo.
const soOLink = (url, video) => ({ tipo: video ? 'video' : 'link', thumb: null, abrir: url, nome: video ? 'Vídeo · link de entrega' : 'Link de entrega', n: 0, fonte: 'entrega', link: url });

export async function previaDaEntrega(url, peca = {}, { listar, arquivo } = {}) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  const formatoDeVideo = /reels|v[ií]deo|audiovisual|motion/i.test(String(peca.formato || ''));
  const { arquivo: idArquivo, pasta } = idsDoLink(u);
  if (pasta) {
    try {
      const escolha = escolherDaPasta(await midiasDaPasta(pasta, { listar }), peca);
      return escolha ? previaDoArquivo(escolha, u) : soOLink(u, formatoDeVideo);
    } catch { return soOLink(u, formatoDeVideo); }
  }
  if (idArquivo) {
    try {
      const f = await arquivo(idArquivo);
      const tipo = tipoDoMime(f?.mimeType) || (formatoDeVideo ? 'video' : 'arquivo');
      return previaDoArquivo({ id: idArquivo, nome: f?.name || '', tipo, miniatura: f?.hasThumbnail !== false }, u);
    } catch { return { ...soOLink(u, formatoDeVideo), abrir: `https://drive.google.com/file/d/${idArquivo}/view` }; }
  }
  // Fora do Drive: um .mp4 direto o navegador carrega (o primeiro quadro sai no próprio <video>); uma imagem direta é
  // a própria miniatura; o resto é só o link.
  if (VIDEO_DIRETO.test(u)) return { tipo: 'video', thumb: null, video: u, abrir: u, nome: decodeURIComponent(u.split(/[?#]/)[0].split('/').pop() || '') || 'Vídeo · link de entrega', n: 0, fonte: 'entrega', link: u };
  if (IMAGEM_DIRETA.test(u)) return { tipo: 'imagem', thumb: u, abrir: u, nome: 'Link de entrega', n: 0, fonte: 'entrega', link: u };
  return soOLink(u, formatoDeVideo);
}

// Guardada por peça e link por 10 minutos: o baralho pede a mesma peça a cada passada, e cada leitura de pasta são
// algumas chamadas ao Drive.
const GUARDADAS = new Map(), VALIDADE = 10 * 60e3, TETO = 300;
export function esquecerPreviasDaEntrega() { GUARDADAS.clear(); }

// GET area=previa_entrega&item=<id do Monday | vybe:id>. Quem abre: quem tem sessão no painel, como area=peca.
export async function areaPreviaEntrega(req, res, quem, { db, listar, arquivo, agora = Date.now } = {}) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!quem) return res.status(401).json({ error: 'Entre no painel.' });
  const item = String(req.query?.item || '');
  if (!item) return res.status(400).json({ error: 'Informe o item.' });
  const local = /^vybe:\d+$/.test(item) ? Number(item.slice(5)) : null;
  const [c] = await db`SELECT c.id, c.titulo, c.formato,
        (SELECT STRING_AGG(cl.nome, ', ') FROM vybe_conteudo_clientes vc JOIN vybe_clientes cl ON cl.id = vc.cliente_id WHERE vc.conteudo_id = c.id) AS cliente,
        EXISTS(SELECT 1 FROM vybe_conteudo_arquivos a WHERE a.conteudo_id = c.id AND a.ausente_em IS NULL) AS tem_arquivo
      FROM vybe_conteudos c WHERE (c.monday_item_id = ${item} OR c.id = ${local}) AND c.removido_em IS NULL`;
  if (!c) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });
  // Com arquivo anexado a prévia é a do arquivo (area=arquivos / area=peca); o link de entrega só entra sem nenhum. A
  // conferência (frente s-z) pede com todos=1: ela junta os anexos com a pasta de entrega, porque o "01" anexado costuma
  // ter o "02" e o "03" só na pasta.
  const todos = String(req.query?.todos || '') === '1';
  if (c.tem_arquivo && !todos) return res.status(200).json({ ok: true, previa: null, motivo: 'tem_arquivo' });
  const notas = await db`SELECT corpo FROM vybe_conteudo_updates WHERE conteudo_id = ${c.id}
      AND corpo ~* 'Link de entrega|Link final|Entrega final' ORDER BY criado_em DESC NULLS LAST, id DESC LIMIT 5`;
  const url = linkDeEntrega(notas);
  if (!url) return res.status(200).json({ ok: true, previa: null, motivo: 'sem_link' });
  const chave = `${c.id}|${url}`, guardada = GUARDADAS.get(chave);
  let previa;
  if (guardada && agora() - guardada.em < VALIDADE) previa = guardada.previa;
  else {
    previa = await previaDaEntrega(url, { cliente: c.cliente || '', nome: c.titulo || '', formato: c.formato || c.titulo || '' }, { listar, arquivo });
    if (GUARDADAS.size >= TETO) GUARDADAS.delete(GUARDADAS.keys().next().value);
    GUARDADAS.set(chave, { em: agora(), previa });
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ ok: true, previa });
}

// O quadro de ~1 s do vídeo da entrega (Paulo, 24/11/2026, "Sim, faz"): o Reels que abre com fade do preto ganha do
// Drive uma miniatura toda preta, e a carta mede isso no navegador e pede o quadro a este endereço. Transmite o arquivo
// do Drive por partes (Range), para o <video preload=metadata> só baixar o começo (e o índice, se ele estiver no fim).
// Abre só com sessão (como area=miniatura) e só o arquivo que a prévia da entrega assinou (videoDaEntrega, emitida
// para um vídeo da pasta do link de entrega daquele item); o arquivo continua privado no Drive.
export const VIDEO_TRECHO_MAX = 2 * 1024 * 1024;
const FICHAS = new Map(), FICHA_VALIDADE = 10 * 60e3, FICHA_TETO = 200;
export function esquecerFichasDoVideo() { FICHAS.clear(); }
export async function areaVideoEntrega(req, res, quem, { arquivo, trecho, agora = Date.now } = {}) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!quem) return res.status(401).json({ error: 'Entre no painel.' });
  const id = String(req.query?.id || '');
  if (!ID.test(id)) return res.status(400).json({ error: 'Informe o arquivo.' });
  if (!videoAssinado(id, req.query?.e)) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  // O tamanho e o tipo do arquivo, guardados por 10 minutos: o player pede várias partes do mesmo vídeo.
  let ficha = FICHAS.get(id);
  if (!ficha || agora() - ficha.em >= FICHA_VALIDADE) {
    let f;
    try { f = await arquivo(id); } catch (erro) { console.error('area=video_entrega', erro?.message || erro); return res.status(502).json({ error: 'Vídeo indisponível agora.' }); }
    ficha = { em: agora(), tipo: String(f?.mimeType || ''), total: Number(f?.size || 0) };
    if (FICHAS.size >= FICHA_TETO) FICHAS.delete(FICHAS.keys().next().value);
    FICHAS.set(id, ficha);
  }
  if (!/^video\//.test(ficha.tipo) || !(ficha.total > 0)) return res.status(404).json({ error: 'Este arquivo não é um vídeo.' });
  const { total } = ficha;
  res.setHeader('Accept-Ranges', 'bytes');
  // Sem Range (ou um Range que não se entende) vale o começo do arquivo: nunca o arquivo inteiro de uma vez.
  const parte = req.headers?.range ? faixaPedida(req.headers.range, total) || faixaPedida('bytes=0-', total) : faixaPedida('bytes=0-', total);
  if (parte.invalida) { res.setHeader('Content-Range', `bytes */${total}`); return res.status(416).end(); }
  const fim = Math.min(parte.fim, parte.ini + VIDEO_TRECHO_MAX - 1);
  let bytes;
  try { bytes = await trecho(id, parte.ini, fim); } catch (erro) { console.error('area=video_entrega', erro?.message || erro); return res.status(502).json({ error: 'Vídeo indisponível agora.' }); }
  res.setHeader('Content-Type', ficha.tipo);
  res.setHeader('Content-Range', `bytes ${parte.ini}-${parte.ini + bytes.length - 1}/${total}`);
  res.setHeader('Content-Length', String(bytes.length));
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(206).end(bytes);
}
