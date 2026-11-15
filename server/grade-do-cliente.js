// Grade do mês para o cliente aprovar no VybeHub (Paulo, 15/11/2026: "isso vai pro VybeHub... pode já levar pra
// lá"). O cliente vê o feed dele como vai ficar no Instagram — o que já está no ar (a captura do perfil, em
// server/instagram-captura.js) e, em cima, as peças de feed do mês na ordem de veiculação, com a arte do Drive ou um
// quadro com o formato — e aprova o mês inteiro ou pede ajuste peça a peça.
//
// Os dados são os do Feed do Painel de trabalho (vybe-feed.js): peças de produção do cliente pela veiculação, só os
// formatos que entram na grade (Reels, Carrossel, Card, Fotografia, Post; story e vídeo solto ficam de fora), a capa
// pela mesma ordem do area=arquivos&capa=1 (imagem, depois vídeo).
//
// A resposta passa pelo mesmo caminho do link de aprovação (server/conteudo-aprovacao.js): trocarStatus e comentar de
// api/conteudo.js, com as automações. Peça em "Ag. Aprovação Cliente" com arte: aprovar → "Para agendar", ajuste →
// "Alteração". Peça que ainda está em produção (ou já aprovada): o status não muda — a resposta entra como comentário
// na peça, para a equipe ver. Sem tabela nova: a última resposta do cliente é lida dos comentários do VybeHub.
//
// O VybeHub chama de servidor para servidor (area=portal, chave PORTAL_CHAVE) com o nome do cliente logado lá. Sai só
// o que o cliente precisa: título, formato, data, a situação em palavras dele e a arte. Nada de responsável, status
// interno, prazo ou dinheiro.
import { clientePorNomeOuId } from './planejamentos.js';
import { STATUS_EM_APROVACAO, DESTINO, LIMITE_COMENTARIO, LIMITE_NOME, dentroDoLote } from './conteudo-aprovacao.js';

export const BOARD_PRODUCAO = 7829537690;
export const LIMITE_RESPOSTAS = 60;
const MAX_ARTES = 10;
const MAX_NO_AR = 12;
const USUARIO = /^[a-z0-9._]{1,30}$/;
const CODIGO = /^[A-Za-z0-9_-]{5,40}$/;
const EXT_IMAGEM = /^(jpe?g|png|webp|gif|heic|avif)$/i;
const EXT_VIDEO = /^(mp4|mov|m4v|webm|avi)$/i;
// Quem responde pelo Hub aparece assim nos comentários e no histórico da peça; é também a marca para ler a resposta.
const MARCA_AUTOR = '(cliente · VybeHub)';

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const idValido = (v) => (/^\d{1,18}$/.test(String(v ?? '')) ? String(v) : null);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// O mesmo critério do feedFormato (vybe-feed.js), no servidor.
export function formatoDaGrade(bruto) {
  const k = norm(bruto);
  if (!k) return { nome: 'Post', chave: 'post' };
  if (k.startsWith('reel')) return { nome: 'Reels', chave: 'reels' };
  if (k.startsWith('carross')) return { nome: 'Carrossel', chave: 'carrossel' };
  if (k.startsWith('card')) return { nome: 'Card', chave: 'card' };
  if (k.startsWith('foto')) return { nome: 'Fotografia', chave: 'foto' };
  if (k.startsWith('feed') || k.startsWith('post')) return { nome: 'Post', chave: 'post' };
  return null;
}

// A situação que o cliente entende, sem o nome do status interno.
export function estadoParaCliente(statusChave) {
  const s = String(statusChave || '');
  if (s === STATUS_EM_APROVACAO) return 'aguardando';
  if (s === 'alteracao') return 'ajuste';
  if (s === 'publicado' || s === 'publicada') return 'publicada';
  if (['para_agendar', 'agendado', 'agendada', 'finalizado', 'finalizada', 'aprovado', 'aprovada'].includes(s)) return 'aprovada';
  return 'producao';
}

export function hojeNaBahia(d = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
export function lerMes(v, hoje = hojeNaBahia()) {
  const s = String(v || '').trim();
  if (!s) return hoje.slice(0, 7);
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw erro('Mês inválido (use AAAA-MM).');
  return s;
}
const fimDoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
const quandoNaBahia = (d = new Date()) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'short', timeStyle: 'short' }).format(d); } catch { return d.toISOString(); } };

export function usuarioDoInstagram(v) {
  let s = String(v || '').trim(); const url = s.match(/instagram\.com\/([^/?#\s]+)/i); if (url) s = url[1];
  s = s.replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  return USUARIO.test(s) ? s : '';
}

async function existe(sql, tabela) {
  const [r] = await sql`SELECT to_regclass(${tabela}) IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}

async function clienteDaGrade(sql, nome) {
  const c = await clientePorNomeOuId(sql, nome);
  const [l] = await sql`SELECT to_jsonb(c)->'cadastro' AS cadastro FROM vybe_clientes c WHERE c.id = ${c.id}`;
  const cad = l?.cadastro && typeof l.cadastro === 'object' ? l.cadastro : {};
  return { id: String(c.id), nome: c.nome, usuario: usuarioDoInstagram(cad.instagram), bio: String(cad.bio_instagram || '').trim(), site: String(cad.site || '').trim() };
}

// Peças de produção do cliente (de feed) entre duas datas, com a arte e a última resposta pelo Hub.
async function pecasDoCliente(sql, clienteId, de, ate, { board = BOARD_PRODUCAO } = {}) {
  const linhas = await sql`SELECT c.id::text AS id, c.titulo, c.formato, c.status_chave, TO_CHAR(c.veiculacao, 'YYYY-MM-DD') AS veiculacao
    FROM vybe_conteudos c
    WHERE c.removido_em IS NULL AND c.board_id = ${board} AND c.veiculacao IS NOT NULL
      AND c.veiculacao >= ${de}::date AND c.veiculacao <= ${ate}::date
      AND COALESCE(c.status_chave, '') NOT ILIKE '%cancel%'
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${clienteId})
    ORDER BY c.veiculacao, c.id`;
  const pecas = linhas.map((p) => ({ ...p, fmt: formatoDaGrade(p.formato) })).filter((p) => p.fmt);
  const ids = pecas.map((p) => p.id);
  const artes = new Map(), respostas = new Map();
  if (ids.length && await existe(sql, 'vybe_conteudo_arquivos')) {
    for (const a of await sql`SELECT id::text AS id, conteudo_id::text AS conteudo_id, nome, extensao FROM vybe_conteudo_arquivos
        WHERE conteudo_id = ANY(${ids}::bigint[]) AND ausente_em IS NULL AND drive_file_id IS NOT NULL
        ORDER BY criado_em DESC NULLS LAST, id DESC`) {
      const ext = String(a.extensao || a.nome?.match(/\.(\w+)$/)?.[1] || '').replace(/^\./, '');
      const tipo = EXT_IMAGEM.test(ext) ? 'imagem' : EXT_VIDEO.test(ext) ? 'video' : null;
      if (!tipo) continue;
      if (!artes.has(a.conteudo_id)) artes.set(a.conteudo_id, []);
      artes.get(a.conteudo_id).push({ id: a.id, video: tipo === 'video' });
    }
    // A capa como no area=arquivos&capa=1: imagem antes de vídeo, a mais recente primeiro.
    for (const [k, l] of artes) artes.set(k, l.sort((x, y) => Number(x.video) - Number(y.video)).slice(0, MAX_ARTES));
  }
  if (ids.length && await existe(sql, 'vybe_conteudo_updates')) {
    for (const u of await sql`SELECT DISTINCT ON (conteudo_id) conteudo_id::text AS id, corpo, autor, criado_em
        FROM vybe_conteudo_updates WHERE conteudo_id = ANY(${ids}::bigint[]) AND autor LIKE ${'%' + MARCA_AUTOR}
        ORDER BY conteudo_id, criado_em DESC NULLS LAST, id DESC`) {
      const corpo = String(u.corpo || '');
      const acao = corpo.startsWith('🔧') ? 'ajuste' : corpo.startsWith('✅') ? 'aprovar' : null;
      if (!acao) continue;
      const comentario = corpo.split('\n').slice(1).join('\n').replace(/^Comentário:\s*/, '').trim();
      respostas.set(u.id, { acao, nome: String(u.autor).slice(0, -MARCA_AUTOR.length).trim(), comentario, em: u.criado_em });
    }
  }
  return pecas.map((p) => ({ id: p.id, titulo: p.titulo || 'Sem título', formato: p.fmt.nome, formato_chave: p.fmt.chave, veiculacao: p.veiculacao,
    estado: estadoParaCliente(p.status_chave), arte: artes.get(p.id) || [], resposta: respostas.get(p.id) || null }));
}

// O cliente só responde o que ainda vai ao ar e não saiu.
export const respondivel = (p, hoje) => p.estado !== 'publicada' && p.veiculacao >= hoje;

async function capturaDoCliente(sql, usuario) {
  if (!usuario || !await existe(sql, 'vybe_feed_captura')) return null;
  const [l] = await sql`SELECT usuario, capturado_em, perfil FROM vybe_feed_captura WHERE usuario = ${usuario}`;
  if (!l) return null;
  const p = l.perfil || {};
  const chaves = new Set((await sql`SELECT chave FROM vybe_feed_captura_imagem WHERE usuario = ${usuario}`).map((i) => i.chave));
  return { usuario, capturado_em: new Date(l.capturado_em).toISOString(), nome: p.nome || '', bio: p.bio || '', site: p.site || '',
    total_posts: p.total_posts ?? null, seguidores: p.seguidores ?? null, seguindo: p.seguindo ?? null, foto: chaves.has('foto'),
    posts: (p.posts || []).filter((x) => CODIGO.test(String(x.codigo || '')) && chaves.has(x.codigo)).slice(0, MAX_NO_AR)
      .map((x) => ({ codigo: x.codigo, tipo: x.tipo === 'video' ? 'video' : x.tipo === 'carrossel' ? 'carrossel' : 'foto', fixado: Boolean(x.fixado) })) };
}

// rota 'grade': { cliente, mes? } → perfil, o que já está no ar e as peças do mês.
export async function gradeDoPortal(sql, { cliente, mes } = {}, { hoje = hojeNaBahia(), board } = {}) {
  const c = await clienteDaGrade(sql, cliente);
  const m = lerMes(mes, hoje);
  const ini = `${m}-01`, fim = fimDoMes(m);
  const captura = await capturaDoCliente(sql, c.usuario);
  const pecas = await pecasDoCliente(sql, c.id, ini, fim, { board });
  // O que a Vybe publicou depois da captura e antes do mês entra na frente dos posts capturados (como no Feed).
  const desde = captura ? captura.capturado_em.slice(0, 10) : null;
  const vespera = new Date(Date.parse(`${ini}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const antes = desde && desde < ini
    ? (await pecasDoCliente(sql, c.id, desde, vespera, { board })).filter((p) => p.veiculacao > desde && p.veiculacao < hoje).reverse()
    : [];
  const noAr = [
    ...antes.map((p) => ({ tipo: 'vybe', id: p.id, formato: p.formato, veiculacao: p.veiculacao, arte: p.arte.slice(0, 1) })),
    ...(captura?.posts || []).map((x) => ({ tipo: 'instagram', ...x })),
  ].slice(0, MAX_NO_AR);
  const abertas = pecas.filter((p) => respondivel(p, hoje));
  const aprovado = abertas.length > 0 && abertas.every((p) => p.resposta?.acao === 'aprovar' || p.estado === 'aprovada');
  return {
    cliente: c.nome, mes: m, hoje,
    perfil: { usuario: c.usuario || null, nome: captura?.nome || c.nome, bio: captura?.bio || c.bio, site: captura?.site || c.site,
      total_posts: captura?.total_posts ?? null, seguidores: captura?.seguidores ?? null, seguindo: captura?.seguindo ?? null,
      foto: Boolean(captura?.foto), capturado_em: captura?.capturado_em || null },
    no_ar: noAr,
    pecas: pecas.map((p) => ({ ...p, respondivel: respondivel(p, hoje) })),
    resumo: { total: pecas.length, abertas: abertas.length, com_arte: pecas.filter((p) => p.arte.length).length,
      ajustes: abertas.filter((p) => p.resposta?.acao === 'ajuste' || p.estado === 'ajuste').length, aprovado },
  };
}

export function lerRespostaDaGrade(corpo = {}) {
  const nome = String(corpo.nome ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) throw erro('Diga seu nome, para a Vybe saber quem respondeu.');
  if (nome.length > LIMITE_NOME) throw erro(`O nome pode ter até ${LIMITE_NOME} letras.`);
  const lista = Array.isArray(corpo.respostas) ? corpo.respostas : [];
  if (!lista.length) throw erro('Nenhuma peça para responder.');
  if (lista.length > LIMITE_RESPOSTAS) throw erro(`Dá para responder até ${LIMITE_RESPOSTAS} peças de uma vez.`);
  const vistos = new Set(), respostas = [];
  for (const r of lista) {
    const id = idValido(r?.conteudo_id);
    if (!id) throw erro('Peça inválida.');
    if (vistos.has(id)) continue; vistos.add(id);
    const acao = String(r?.acao || '');
    if (!DESTINO[acao]) throw erro('Escolha Aprovar ou Pedir ajuste.');
    const comentario = String(r?.comentario ?? '').replace(/\r\n?/g, '\n').trim();
    if (comentario.length > LIMITE_COMENTARIO) throw erro(`O comentário pode ter até ${LIMITE_COMENTARIO} caracteres.`);
    if (acao === 'ajuste' && !comentario) throw erro('Escreva o que precisa ajustar em cada peça com ajuste.');
    respostas.push({ id, acao, comentario });
  }
  return { nome, respostas, mes: corpo.mes };
}

// rota 'grade_responder': { cliente, mes, nome, respostas: [{ conteudo_id, acao: 'aprovar'|'ajuste', comentario }] }.
// Uma transação: ou entra tudo, ou nada (erro). Peça de outro cliente, fora do mês, já publicada ou já no passado
// fica de fora e a resposta diz por quê.
export async function responderGradeDoPortal(sql, corpo = {}, fazer, { hoje = hojeNaBahia(), board = BOARD_PRODUCAO } = {}) {
  if (!fazer?.trocarStatus || !fazer?.comentar) throw erro('Resposta indisponível agora.', 503);
  const r = lerRespostaDaGrade(corpo);
  const c = await clienteDaGrade(sql, corpo.cliente);
  const m = lerMes(r.mes, hoje);
  const ini = `${m}-01`, fim = fimDoMes(m);
  const quem = { tipo: 'portal_cliente', pessoa: { nome: `${r.nome} ${MARCA_AUTOR}` } };
  const quando = quandoNaBahia();
  const comArquivos = await existe(sql, 'vybe_conteudo_arquivos');
  const executar = async (s) => {
    const ids = r.respostas.map((x) => x.id);
    const linhas = await s`SELECT c.id::text AS id, c.titulo, c.formato, c.status_chave, TO_CHAR(c.veiculacao, 'YYYY-MM-DD') AS veiculacao,
        EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${c.id}) AS do_cliente
      FROM vybe_conteudos c WHERE c.id = ANY(${ids}::bigint[]) AND c.removido_em IS NULL AND c.board_id = ${board} FOR UPDATE OF c`;
    const porId = new Map(linhas.map((l) => [l.id, l]));
    const comArte = new Set(comArquivos && ids.length ? (await s`SELECT DISTINCT conteudo_id::text AS id FROM vybe_conteudo_arquivos
      WHERE conteudo_id = ANY(${ids}::bigint[]) AND ausente_em IS NULL AND drive_file_id IS NOT NULL`).map((a) => a.id) : []);
    const feitas = [], recusadas = [];
    for (const x of r.respostas) {
      const p = porId.get(x.id);
      // Peça de outro cliente: nem o título sai daqui.
      if (!p || !p.do_cliente || !formatoDaGrade(p.formato)) { recusadas.push({ conteudo_id: x.id, motivo: 'Peça não encontrada na sua grade.' }); continue; }
      const estado = estadoParaCliente(p.status_chave);
      if (!p.veiculacao || p.veiculacao < ini || p.veiculacao > fim) { recusadas.push({ conteudo_id: x.id, titulo: p.titulo, motivo: 'Esta peça não é deste mês.' }); continue; }
      if (!respondivel({ estado, veiculacao: p.veiculacao }, hoje)) { recusadas.push({ conteudo_id: x.id, titulo: p.titulo, motivo: 'Esta peça já foi ao ar.' }); continue; }
      // Em aprovação e com arte: muda o status como no link (o cliente aprovou o que viu). Sem arte, ou ainda em
      // produção, só o comentário: aprovar a grade não pula a aprovação da arte.
      const trocar = p.status_chave === STATUS_EM_APROVACAO && (x.acao === 'ajuste' || comArte.has(x.id));
      let mudou = null;
      if (trocar) mudou = await fazer.trocarStatus(s, quem, { item: `vybe:${x.id}`, para: DESTINO[x.acao] });
      const texto = x.acao === 'ajuste'
        ? `🔧 Ajuste pedido pelo cliente (${r.nome}) no VybeHub, na grade do mês, em ${quando}:\n${x.comentario}`
        : trocar
          ? `✅ Aprovado pelo cliente (${r.nome}) no VybeHub, na grade do mês, em ${quando}.${x.comentario ? `\nComentário: ${x.comentario}` : ''}`
          : `✅ Grade do mês aprovada pelo cliente (${r.nome}) no VybeHub em ${quando}: a peça segue como está na grade${p.status_chave === STATUS_EM_APROVACAO ? ' (a arte ainda precisa da aprovação dele)' : ''}.${x.comentario ? `\nComentário: ${x.comentario}` : ''}`;
      await fazer.comentar(s, quem, { item: `vybe:${x.id}`, texto });
      feitas.push({ conteudo_id: x.id, titulo: p.titulo, acao: x.acao, status_mudou: Boolean(mudou?.para) });
    }
    return { cliente: c.nome, mes: m, feitas, recusadas };
  };
  if (typeof sql.comTransacao !== 'function') return executar(sql);
  try { return await sql.comTransacao((tx) => executar(dentroDoLote(tx))); }
  catch (e) {
    if (e?.status) throw e;
    throw erro('Nada foi registrado: não foi possível responder agora. Tente de novo.', 500);
  }
}

// rota 'grade_imagem': { cliente, arquivo } (arte de uma peça de feed do cliente) ou { cliente, captura: 'foto'|<código> }
// (a captura do perfil dele). Devolve { tipo, base64 }. Só o que é do cliente que chamou.
export async function imagemDaGradeDoPortal(sql, corpo = {}, { miniatura, board = BOARD_PRODUCAO } = {}) {
  const c = await clienteDaGrade(sql, corpo.cliente);
  if (corpo.captura !== undefined) {
    const chave = String(corpo.captura || '');
    if (!c.usuario || !(chave === 'foto' || CODIGO.test(chave)) || !await existe(sql, 'vybe_feed_captura_imagem')) throw erro('Imagem indisponível.', 404);
    const [l] = await sql`SELECT dados FROM vybe_feed_captura_imagem WHERE usuario = ${c.usuario} AND chave = ${chave}`;
    if (!l) throw erro('Imagem indisponível.', 404);
    return { tipo: 'image/jpeg', base64: l.dados };
  }
  const id = idValido(corpo.arquivo);
  if (!id || !await existe(sql, 'vybe_conteudo_arquivos')) throw erro('Imagem indisponível.', 404);
  const [a] = await sql`SELECT a.drive_file_id, c.formato FROM vybe_conteudo_arquivos a JOIN vybe_conteudos c ON c.id = a.conteudo_id
    WHERE a.id = ${id} AND a.ausente_em IS NULL AND a.drive_file_id IS NOT NULL AND c.removido_em IS NULL AND c.board_id = ${board}
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${c.id})`;
  if (!a || !formatoDaGrade(a.formato) || typeof miniatura !== 'function') throw erro('Imagem indisponível.', 404);
  const tamanho = corpo.tamanho === 'grande' ? 1080 : 480;
  let m;
  try { m = await miniatura(a.drive_file_id, tamanho); }
  catch { throw erro('Prévia indisponível agora.', 502); }
  if (!m?.bytes?.length) throw erro('Este arquivo não tem prévia.', 404);
  return { tipo: m.tipo || 'image/jpeg', base64: Buffer.from(m.bytes).toString('base64') };
}
