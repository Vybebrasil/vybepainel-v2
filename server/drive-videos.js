// Vídeos de uma pasta do Drive para o olho da prévia (Paulo, 27/10/2026: "não
// dá pra ver o vídeo direto aqui?"). O link de entrega de um Reels costuma ser
// a PASTA do dia ("DIA 26 - CLIENTES"), não o arquivo; pasta não tem player.
// Aqui a pasta vira a lista dos vídeos dentro dela (e de até dois níveis de
// subpastas), e a prévia escolhe o que bate com a peça e toca no player do
// Drive. Só leitura: nada muda de compartilhamento — o player abre para quem
// está logado com uma conta que vê a pasta (o Gmail da agência).
import { listarNoDrive } from '../vybe_drive.js';

const ID = /^[\w-]{10,200}$/;
const PASTA = 'application/vnd.google-apps.folder';

export async function videosDaPasta(pastaId, { listar = listarNoDrive, niveis = 2, maxPastas = 30, maxVideos = 80 } = {}) {
  if (!ID.test(String(pastaId || ''))) throw Object.assign(new Error('Pasta do Drive inválida.'), { status: 400 });
  const videos = [];
  let fila = [{ id: pastaId, caminho: [] }], vistas = 0;
  for (let nivel = 0; nivel <= niveis && fila.length && videos.length < maxVideos; nivel++) {
    const proxima = [];
    for (const p of fila) {
      if (vistas++ >= maxPastas) break;
      for (const f of await listar(p.id)) {
        if (f.mimeType === PASTA) proxima.push({ id: f.id, caminho: [...p.caminho, f.name] });
        else if (String(f.mimeType || '').startsWith('video/') && videos.length < maxVideos)
          videos.push({ id: f.id, nome: f.name, caminho: p.caminho.join(' / '), duracao: Math.round(Number(f.videoMediaMetadata?.durationMillis || 0) / 1000) || null, criado: f.createdTime || null });
      }
    }
    fila = proxima;
  }
  return videos;
}

export async function areaDriveVideos(req, res, quem, { buscar = videosDaPasta } = {}) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  if (!quem) return res.status(401).json({ error: 'Entre no painel.' });
  try {
    return res.status(200).json({ ok: true, videos: await buscar(String(req.query?.pasta || '')) });
  } catch (erro) {
    return res.status(erro.status || 502).json({ error: erro.message || 'Não foi possível ler a pasta do Drive.' });
  }
}
