// Revisão da arte pela Vybe AI (Paulo, 27/10/2026): quando a peça vai para aprovação, a Vybe AI olha a arte com o
// critério de um diretor de marketing e criação e deixa a opinião como comentário. Nunca muda status.
// A imagem sai do Drive da peça; a leitura (visão) acontece no PC do bot, com o modelo local.
import { tokenGoogle, baixarDoDrive } from '../vybe_drive.js';
import { linkDaAtividade } from './assistente-rotinas.js';
import { BOARD_DEMANDAS, BOARD_PRODUCAO } from './grupos.js';
import { MARCAS_BRIEFING } from './briefing.js';
import { textoDoHistorico } from './texto-historico.js';
import { regrasDaPeca } from './assistente-regras.js';

const IMAGEM = /^(png|jpe?g|webp)$/i;
const MAX_DIRETO = 2.5 * 1024 * 1024; // A resposta da função cabe em ~4 MB; acima disso vai a miniatura do Drive.
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
async function miniatura(fileId, buscar = fetch, pegarToken = tokenGoogle) {
  const token = await pegarToken();
  const meta = await buscar(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  const link = meta.ok ? (await meta.json()).thumbnailLink : null;
  if (!link) return null;
  const r = await buscar(String(link).replace(/=s\d+$/, '=s1600'), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return { data: Buffer.from(await r.arrayBuffer()).toString('base64'), mimetype: r.headers.get('content-type') || 'image/jpeg', miniatura: true };
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
export async function previaDaPeca(sql, ref, { buscar = fetch, pegarToken = tokenGoogle } = {}) {
  const c = await pecaDaReferencia(sql, ref);
  const arquivos = await sql`SELECT id::text, nome, extensao, drive_file_id, criado_em FROM vybe_conteudo_arquivos
    WHERE conteudo_id = ${c.id} AND ausente_em IS NULL AND drive_file_id IS NOT NULL ORDER BY criado_em DESC NULLS LAST, id DESC LIMIT 30`;
  const ultimo = arquivos[0] ? new Date(arquivos[0].criado_em || 0).getTime() : 0;
  const entrega = arquivos.filter((a) => ultimo - new Date(a.criado_em || 0).getTime() <= 15 * 60e3).slice(0, 10).reverse();
  const midias = [];
  for (const a of entrega) {
    const m = await miniatura(String(a.drive_file_id), buscar, pegarToken).catch(() => null);
    if (m) midias.push({ ...m, nome: a.nome, video: /^(mp4|mov|m4v|webm|avi)$/i.test(a.extensao || '') });
  }
  return { peca: { ref: referencia(c), titulo: c.titulo, formato: c.formato }, midias, total: entrega.length };
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
