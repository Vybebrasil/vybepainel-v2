// Revisão da arte pela Vybe AI (Paulo, 27/10/2026): quando a peça vai para aprovação, a Vybe AI olha a arte com o
// critério de um diretor de marketing e criação e deixa a opinião como comentário. Nunca muda status.
// A imagem sai do Drive da peça; a leitura (visão) acontece no PC do bot, com o modelo local.
import { tokenGoogle, baixarDoDrive, tornarPublico } from '../vybe_drive.js';
import { linkDaAtividade } from './assistente-rotinas.js';
import { BOARD_DEMANDAS, BOARD_PRODUCAO } from './grupos.js';
import { MARCAS_BRIEFING } from './briefing.js';
import { textoDoHistorico } from './texto-historico.js';
import { regrasDaPeca } from './assistente-regras.js';
import { videosDaPasta, notaDoVideo } from './drive-videos.js';

const IMAGEM = /^(png|jpe?g|webp)$/i;
const MAX_DIRETO = 2.5 * 1024 * 1024; // A resposta da função cabe em ~4 MB; acima disso vai a miniatura do Drive.
const MAX_PREVIA = 3.4 * 1024 * 1024; // Soma das lâminas em base64 na prévia, com folga para o resto da resposta.
const referencia = (c) => (c.monday_item_id ? String(c.monday_item_id) : 'vybe:' + c.id);
const idLocal = (ref) => (/^vybe:\d+$/.test(String(ref)) ? Number(String(ref).slice(5)) : -1);

async function pecaDaReferencia(sql, ref) {
  const [c] = await sql`SELECT c.id::text, c.monday_item_id, c.titulo, c.formato, c.briefing, s.rotulo AS status,
      (SELECT string_agg(cl.nome, ' / ') FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id) AS cliente
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE (c.monday_item_id::text = ${String(ref)} OR c.id = ${idLocal(ref)}) AND c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS})`;
  if (!c) throw new TypeError('Peça não encontrada.');
  return c;
}

// Miniatura grande (1600 px) que o próprio Drive gera, para arquivo pesado, vídeo ou PDF.
// Sempre em JPEG ("-rj"): a miniatura de um PNG vinha em PNG, ~2,5 MB por lâmina, e um carrossel de 5 passava do
// limite de resposta da função (4,5 MB) — a prévia inteira voltava vazia (Paulo, 03/11/2026, "Card - Agenda Musical").
// Em JPEG a mesma lâmina tem ~280 KB.
async function miniatura(fileId, buscar = fetch, pegarToken = tokenGoogle) {
  const imagem = async (r) => (r?.ok && /^image\//.test(r.headers.get('content-type') || 'image/jpeg')
    ? { data: Buffer.from(await r.arrayBuffer()).toString('base64'), mimetype: r.headers.get('content-type') || 'image/jpeg', miniatura: true } : null);
  let token = null, link = null;
  try {
    token = await pegarToken();
    const meta = await buscar(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    link = meta.ok ? (await meta.json()).thumbnailLink : null;
  } catch { /* segue para o endereço público */ }
  const pedir = (fim) => (link ? buscar(String(link).replace(/=s\d+$/, fim), { headers: { Authorization: `Bearer ${token}` } }).then(imagem).catch(() => null) : null);
  // Ordem: JPEG pela API → JPEG público (arquivo liberado; a prévia libera antes) → o tamanho original pela API.
  const r = (await pedir('=s1600-rj'))
    || (await imagem(await buscar(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600-rj`).catch(() => null)).catch(() => null))
    || (await pedir('=s1600'));
  if (r) return r;
  // O mesmo endereço que o olho do painel usa (api/painel.js: drive.google.com/thumbnail, liberado ao abrir a peça).
  // Paulo, 03/11/2026: "tem muita coisa sem prévia; não tá usando a lógica do Vybe OS?" — a API do Drive às vezes não
  // devolve miniatura onde o painel mostra a arte.
  return imagem(await buscar(`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`).catch(() => null));
}

export async function arteDaPeca(sql, ref, { baixar = baixarDoDrive, buscar = fetch } = {}) {
  const c = await pecaDaReferencia(sql, ref);
  const [a] = await sql`SELECT id::text, nome, extensao, tamanho_bytes, drive_file_id FROM vybe_conteudo_arquivos
    WHERE conteudo_id = ${c.id} AND ausente_em IS NULL AND drive_file_id IS NOT NULL ORDER BY criado_em DESC NULLS LAST, id DESC LIMIT 1`;
  // Briefing e notas marcadas (legenda do post, copy...), para conferir a arte contra o que foi pedido.
  const notas = await sql`SELECT corpo FROM vybe_conteudo_updates WHERE conteudo_id = ${c.id} AND corpo ~* ${MARCAS_BRIEFING} ORDER BY criado_em DESC NULLS LAST LIMIT 3`;
  const texto = [c.briefing || '', ...notas.map((n) => textoDoHistorico(n.corpo || ''))].map((t) => String(t).trim()).filter(Boolean).join('\n---\n').slice(0, 3000);
  // Regras do cliente decididas pela equipe: a revisão confere se a arte respeita.
  const regras = await regrasDaPeca(sql, c.id);
  const peca = { ref: referencia(c), titulo: c.titulo, formato: c.formato, status: c.status, cliente: c.cliente || '', link: linkDaAtividade(referencia(c)), texto, regras };
  if (!a) return { peca, arte: null, motivo: 'sem_arquivo' };
  let arte = null;
  if (IMAGEM.test(a.extensao || '') && Number(a.tamanho_bytes || 0) <= MAX_DIRETO) {
    const r = await baixar(String(a.drive_file_id));
    const dados = Buffer.from(await r.arrayBuffer());
    if (dados.length <= MAX_DIRETO) arte = { data: dados.toString('base64'), mimetype: 'image/' + String(a.extensao).toLowerCase().replace('jpg', 'jpeg') };
  }
  if (!arte) arte = await miniatura(String(a.drive_file_id), buscar).catch(() => null);
  return { peca, arquivo: { id: a.id, nome: a.nome }, arte, motivo: arte ? null : 'sem_previa' };
}

// Prévia da peça para ir junto do aviso no WhatsApp (Paulo, 27/10/2026: "mandar a demanda junto, seja card,
// carrossel ou vídeo"). A última entrega inteira (arquivos subidos até 15 min antes do mais recente, até 10, como as
// lâminas de um carrossel), sempre pela miniatura do Drive: leve, e vale para imagem, vídeo (capa) e PDF.
// O link de entrega, do mesmo jeito que o olho da prévia do painel acha o vídeo (vybe-material.js: materialDaPeca e
// pastaDaPrevia). Paulo, 03/11/2026: "pode pegar as peças do mesmo jeito que o Vybe OS pega, até pra não duplicar".
// Reels costuma entrar como link do Drive (o vídeo passa do limite do upload): arquivo → ele mesmo; pasta do dia → o
// vídeo que mais combina com a peça (cliente e título). Só leitura; o player abre para quem vê o arquivo no Drive.
const VIDEO_DO_FORMATO = /reels|v[ií]deo|audiovisual|motion/i;
async function videoDaEntrega(sql, c, { buscar, pegarToken, pasta = videosDaPasta } = {}) {
  let notas = [];
  try { notas = await sql`SELECT corpo FROM vybe_conteudo_updates WHERE conteudo_id = ${c.id} ORDER BY criado_em DESC NULLS LAST LIMIT 40`; } catch { return null; }
  const nota = notas.map((n) => textoDoHistorico(n.corpo)).find((t) => /Link de entrega|Link final|Entrega final/i.test(t) && /https?:\/\//.test(t));
  if (!nota) return null;
  const url = (nota.match(/https?:\/\/[^\s<>"']+/i)?.[0] || '').replace(/[),.;]+$/, '');
  const arquivo = (url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/i) || [])[1];
  const pastaId = (url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/i) || [])[1];
  let id = arquivo, nome = 'Vídeo · link de entrega';
  if (!id && pastaId) {
    const videos = await pasta(pastaId).catch(() => []);
    const melhor = videos.map((v, i) => ({ v, i, nota: notaDoVideo(v, { cliente: c.cliente, nome: c.titulo }) })).sort((x, y) => y.nota - x.nota || x.i - y.i)[0];
    if (!melhor) return null;
    id = melhor.v.id; nome = melhor.v.nome;
  }
  if (!id) return null;
  const m = await miniatura(id, buscar, pegarToken).catch(() => null);
  return m ? { ...m, nome, video: Boolean(pastaId) || VIDEO_DO_FORMATO.test(c.formato || ''), drive: id, entrega: true } : null;
}

export async function previaDaPeca(sql, ref, { buscar = fetch, pegarToken = tokenGoogle, pasta, liberar = tornarPublico } = {}) {
  const c = await pecaDaReferencia(sql, ref);
  // Como o painel faz ao abrir a peça (api/painel.js): libera a miniatura dos arquivos que ainda não foram liberados,
  // poucos por vez e uma vez só; falhar aqui não impede a prévia.
  try {
    const presas = await sql`SELECT id, drive_file_id FROM vybe_conteudo_arquivos WHERE conteudo_id = ${c.id} AND ausente_em IS NULL
      AND drive_file_id IS NOT NULL AND previa_liberada_em IS NULL ORDER BY criado_em DESC NULLS LAST LIMIT 8`;
    for (const a of presas) { try { await liberar(String(a.drive_file_id)); await sql`UPDATE vybe_conteudo_arquivos SET previa_liberada_em = NOW() WHERE id = ${a.id}`; } catch { /* tenta na próxima */ } }
  } catch { /* coluna ausente em banco antigo: segue */ }
  const arquivos = await sql`SELECT id::text, nome, extensao, drive_file_id, criado_em FROM vybe_conteudo_arquivos
    WHERE conteudo_id = ${c.id} AND ausente_em IS NULL AND drive_file_id IS NOT NULL ORDER BY criado_em DESC NULLS LAST, id DESC LIMIT 30`;
  const ultimo = arquivos[0] ? new Date(arquivos[0].criado_em || 0).getTime() : 0;
  const entrega = arquivos.filter((a) => ultimo - new Date(a.criado_em || 0).getTime() <= 15 * 60e3).slice(0, 10).reverse();
  const midias = [];
  // Teto da resposta: o que passar disso fica de fora (as primeiras lâminas aparecem, em vez de nenhuma).
  let usado = 0;
  const cabe = (m) => { const n = String(m?.data || '').length; if (!m || (midias.length && usado + n > MAX_PREVIA)) return false; usado += n; return true; };
  for (const a of entrega) {
    const m = await miniatura(String(a.drive_file_id), buscar, pegarToken).catch(() => null);
    if (m && !cabe(m)) break;
    // O id do arquivo no Drive vai junto (Paulo, 02/11/2026: "mostra o vídeo como o Vybe OS mostra, pegando do Drive"):
    // a central do PC toca o vídeo pelo player do próprio Drive, com o acesso de quem está olhando.
    if (m) midias.push({ ...m, nome: a.nome, video: /^(mp4|mov|m4v|webm|avi)$/i.test(a.extensao || ''), drive: String(a.drive_file_id) });
  }
  // O vídeo do link de entrega vem primeiro (como no painel), se ainda não está entre os arquivos.
  const doLink = await videoDaEntrega(sql, c, { buscar, pegarToken, ...(pasta ? { pasta } : {}) });
  if (doLink && !midias.some((m) => m.drive === doLink.drive)) {
    while (midias.length && usado + doLink.data.length > MAX_PREVIA) usado -= midias.pop().data.length;
    midias.unshift(doLink);
  }
  return { peca: { ref: referencia(c), titulo: c.titulo, formato: c.formato }, midias, total: entrega.length + (doLink ? 1 : 0) };
}

// Opinião como comentário da Vybe AI (autor "Vybe IA"), pela mesma função de comentar do painel.
export async function comentarRevisao(sql, ref, texto, { executar } = {}) {
  const c = await pecaDaReferencia(sql, ref);
  const corpo = String(texto || '').trim().slice(0, 3000);
  if (!corpo) throw new TypeError('Revisão vazia.');
  const fazer = executar || await import('../api/conteudo.js');
  await fazer.comentar(sql, { tipo: 'sistema', pessoa: { nome: 'Vybe IA' } }, { item: referencia(c), texto: '🤖 Revisão da Vybe IA (opinião; o status não muda)\n\n' + corpo });
  return { ok: true, link: linkDaAtividade(referencia(c)) };
}
