// Link público de aprovação de peças (módulo Conteúdo, 07/11/2026).
//
// O head do cliente (ou quem administra) gera um link com validade. Quem abre o link, sem login, vê
// só as peças DAQUELE cliente que estão em "Ag. Aprovação Cliente" e pode Aprovar ou Pedir ajuste com
// um comentário. A resposta troca o status pelo mesmo caminho do painel (trocarStatus, com as
// automações): aprovar → "Para agendar"; ajuste → "Alteração". Quem/quando ficam em
// vybe_aprovacao_respostas e num comentário da peça.
//
// Segurança: o token (24 bytes aleatórios, base64url) sai uma vez só; no banco fica o sha256. O link
// não dá acesso a nada além das peças em aprovação do cliente dele, só leitura + aprovar/ajustar; não
// mostra briefing, equipe, responsáveis nem outros clientes. Diferente do /aprovar/<token> dos
// planejamentos (server/planejamentos-api.js), que aprova o planejamento do mês antes da produção.
import { createHash, randomBytes } from 'node:crypto';
import { podeEditarCliente } from './planejamentos.js';
import { AVISO_MIGRACAO } from './conteudo-objetivo.js';

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
export const STATUS_EM_APROVACAO = 'ag_aprovacao_cliente';
export const DESTINO = Object.freeze({ aprovar: 'para_agendar', ajuste: 'alteracao' });
export const LIMITE_COMENTARIO = 1000;
export const LIMITE_NOME = 80;
export const DIAS_PADRAO = 14;
export const DIAS_MAXIMO = 30;
export const hashDoToken = (token) => createHash('sha256').update(String(token)).digest('hex');
export const tokenComFormato = (token) => /^[A-Za-z0-9_-]{32}$/.test(String(token || ''));
const EXT_IMAGEM = /^\.?(jpe?g|png|webp|gif|avif)$/i;

export async function aprovacaoPronta(sql) {
  const [r] = await sql`SELECT (to_regclass('vybe_aprovacao_links') IS NOT NULL AND to_regclass('vybe_aprovacao_respostas') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
const exigirTabelas = async (sql) => { if (!await aprovacaoPronta(sql)) throw erro(AVISO_MIGRACAO, 503); };
const idValido = (v) => (/^\d{1,18}$/.test(String(v ?? '')) ? String(v) : null);

// ── Painel (sessão) ─────────────────────────────────────────────────────────────
// Clientes em que a pessoa pode gerar link (head ou admin), com quantas peças esperam o cliente e os
// links ainda válidos (sem o token: ele só aparece na hora de gerar).
export async function painelDeAprovacao(sql, pessoa) {
  if (!pessoa?.id) throw erro('Entre com a sua conta.', 403);
  const pronto = await aprovacaoPronta(sql);
  const clientes = pessoa.admin
    ? await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE ativo IS NOT FALSE ORDER BY nome`
    : await sql`SELECT c.id::text AS id, c.nome FROM vybe_clientes c JOIN vybe_cliente_pessoas h ON h.cliente_id = c.id
        WHERE h.pessoa_id = ${pessoa.id} AND c.ativo IS NOT FALSE ORDER BY c.nome`;
  const ids = clientes.map((c) => c.id);
  const pendentes = new Map((ids.length ? await sql`SELECT cc.cliente_id::text AS id, COUNT(DISTINCT c.id)::int AS n
      FROM vybe_conteudos c JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = c.id
      WHERE c.status_chave = ${STATUS_EM_APROVACAO} AND c.removido_em IS NULL AND cc.cliente_id::text = ANY(${ids})
      GROUP BY cc.cliente_id` : []).map((l) => [l.id, l.n]));
  const links = new Map();
  if (pronto && ids.length) {
    for (const l of await sql`SELECT l.id::text AS id, l.cliente_id::text AS cliente_id, l.criado_em, l.expira_em, l.ultimo_acesso_em,
        p.nome AS criado_por, (SELECT COUNT(*)::int FROM vybe_aprovacao_respostas r WHERE r.link_id = l.id) AS respostas
      FROM vybe_aprovacao_links l LEFT JOIN vybe_pessoas p ON p.id = l.criado_por
      WHERE l.revogado_em IS NULL AND l.expira_em > NOW() AND l.cliente_id::text = ANY(${ids})
      ORDER BY l.criado_em DESC`) {
      if (!links.has(l.cliente_id)) links.set(l.cliente_id, []);
      links.get(l.cliente_id).push(l);
    }
  }
  return { pronto, ...(pronto ? {} : { aviso: AVISO_MIGRACAO }),
    clientes: clientes.map((c) => ({ ...c, pendentes: pendentes.get(c.id) || 0, links: links.get(c.id) || [] })) };
}

export async function gerarLink(sql, pessoa, { cliente_id, dias = DIAS_PADRAO } = {}) {
  const clienteId = idValido(cliente_id);
  if (!clienteId) throw erro('Escolha o cliente.');
  const n = Number(dias);
  if (!Number.isInteger(n) || n < 1 || n > DIAS_MAXIMO) throw erro(`A validade vai de 1 a ${DIAS_MAXIMO} dias.`);
  await exigirTabelas(sql);
  const [c] = await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE id = ${clienteId}`;
  if (!c) throw erro('Cliente não encontrado.', 404);
  if (!await podeEditarCliente(sql, pessoa, clienteId)) throw erro('Só o head do cliente e quem administra geram o link de aprovação.', 403);
  const token = randomBytes(24).toString('base64url');
  const [l] = await sql`INSERT INTO vybe_aprovacao_links (cliente_id, token_hash, criado_por, expira_em)
    VALUES (${clienteId}, ${hashDoToken(token)}, ${pessoa.id}, NOW() + ${n + ' days'}::interval) RETURNING id::text AS id, expira_em`;
  return { id: l.id, token, expira_em: l.expira_em, cliente: c.nome, cliente_id: c.id };
}

export async function revogarLink(sql, pessoa, { id } = {}) {
  const linkId = idValido(id);
  if (!linkId) throw erro('Link inválido.');
  await exigirTabelas(sql);
  const [l] = await sql`SELECT id, cliente_id FROM vybe_aprovacao_links WHERE id = ${linkId}`;
  if (!l) throw erro('Link não encontrado.', 404);
  if (!await podeEditarCliente(sql, pessoa, l.cliente_id)) throw erro('Só o head do cliente e quem administra desligam o link.', 403);
  await sql`UPDATE vybe_aprovacao_links SET revogado_em = COALESCE(revogado_em, NOW()), revogado_por = ${pessoa.id} WHERE id = ${linkId}`;
  return { id: linkId, revogado: true };
}

// ── Página pública (o token é o segredo) ───────────────────────────────────────────
export async function abrirLink(sql, token, { registrarAcesso = false } = {}) {
  if (!tokenComFormato(token)) throw erro('Este link não existe. Confira o endereço ou peça um novo à Vybe.', 404);
  await exigirTabelas(sql);
  const [l] = await sql`SELECT l.id, l.cliente_id, l.expira_em, l.revogado_em, c.nome AS cliente
    FROM vybe_aprovacao_links l JOIN vybe_clientes c ON c.id = l.cliente_id WHERE l.token_hash = ${hashDoToken(token)}`;
  if (!l || l.revogado_em) throw erro('Este link não vale mais. Peça um novo à Vybe.', 404);
  if (new Date(l.expira_em) <= new Date()) throw erro('Este link expirou. Peça um novo à Vybe.', 410);
  if (registrarAcesso) await sql`UPDATE vybe_aprovacao_links SET ultimo_acesso_em = NOW() WHERE id = ${l.id}`;
  return l;
}

async function arquivosProntos(sql) {
  const [r] = await sql`SELECT to_regclass('vybe_conteudo_arquivos') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}

// Só o que o cliente precisa para decidir: título, formato, data de veiculação e os arquivos.
export async function pecasDoLink(sql, token) {
  const l = await abrirLink(sql, token, { registrarAcesso: true });
  const pecas = await sql`SELECT c.id::text AS id, c.titulo, c.formato, TO_CHAR(c.veiculacao, 'YYYY-MM-DD') AS veiculacao
    FROM vybe_conteudos c
    WHERE c.removido_em IS NULL AND c.status_chave = ${STATUS_EM_APROVACAO}
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${l.cliente_id})
    ORDER BY c.veiculacao NULLS LAST, c.id`;
  const arquivos = new Map();
  if (pecas.length && await arquivosProntos(sql)) {
    for (const a of await sql`SELECT id::text AS id, conteudo_id::text AS conteudo_id, nome, extensao
        FROM vybe_conteudo_arquivos WHERE conteudo_id::text = ANY(${pecas.map((p) => p.id)}) AND ausente_em IS NULL
          AND drive_file_id IS NOT NULL ORDER BY criado_em DESC NULLS LAST, id DESC`) {
      if (!arquivos.has(a.conteudo_id)) arquivos.set(a.conteudo_id, []);
      const lista = arquivos.get(a.conteudo_id);
      if (lista.length < 12) lista.push({ id: a.id, nome: a.nome || 'Arquivo', imagem: EXT_IMAGEM.test(String(a.extensao || a.nome?.match(/\.\w+$/)?.[0] || '')) });
    }
  }
  const respondidas = await sql`SELECT c.titulo, r.acao, r.nome, r.comentario, r.em
    FROM vybe_aprovacao_respostas r JOIN vybe_conteudos c ON c.id = r.conteudo_id
    WHERE r.link_id = ${l.id} ORDER BY r.em DESC LIMIT 50`;
  return { cliente: l.cliente, expira_em: l.expira_em,
    pecas: pecas.map((p) => ({ ...p, formato: p.formato || '', arquivos: arquivos.get(p.id) || [] })), respondidas };
}

// Arquivo de uma peça do link: só se a peça é do cliente do link e ainda está em aprovação.
export async function arquivoDoLink(sql, token, arquivoId) {
  const id = idValido(arquivoId);
  if (!id) throw erro('Arquivo não encontrado.', 404);
  const l = await abrirLink(sql, token);
  if (!await arquivosProntos(sql)) throw erro('Arquivo não encontrado.', 404);
  const [a] = await sql`SELECT a.nome, a.extensao, a.drive_file_id, a.tamanho_bytes FROM vybe_conteudo_arquivos a
    JOIN vybe_conteudos c ON c.id = a.conteudo_id
    WHERE a.id = ${id} AND a.ausente_em IS NULL AND a.drive_file_id IS NOT NULL
      AND c.removido_em IS NULL AND c.status_chave = ${STATUS_EM_APROVACAO}
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${l.cliente_id})`;
  if (!a) throw erro('Arquivo não encontrado.', 404);
  return a;
}

export function lerResposta(corpo = {}) {
  const acao = String(corpo.acao || '');
  if (!DESTINO[acao]) throw erro('Escolha Aprovar ou Pedir ajuste.');
  const conteudoId = idValido(corpo.conteudo_id);
  if (!conteudoId) throw erro('Peça inválida.');
  const nome = String(corpo.nome ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) throw erro('Diga seu nome, para a Vybe saber quem respondeu.');
  if (nome.length > LIMITE_NOME) throw erro(`O nome pode ter até ${LIMITE_NOME} letras.`);
  const comentario = String(corpo.comentario ?? '').replace(/\r\n?/g, '\n').trim();
  if (comentario.length > LIMITE_COMENTARIO) throw erro(`O comentário pode ter até ${LIMITE_COMENTARIO} caracteres.`);
  if (acao === 'ajuste' && !comentario) throw erro('Escreva o que precisa ajustar nesta peça.');
  return { acao, conteudoId, nome, comentario };
}

const quandoNaBahia = (d = new Date()) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'short', timeStyle: 'short' }).format(d); } catch { return d.toISOString(); } };

// A resposta do cliente. `fazer` traz trocarStatus e comentar de api/conteudo.js (o mesmo caminho do
// painel); entra por parâmetro para os testes e para não carregar o módulo de escrita sem precisar.
export async function responderPeca(sql, token, corpo, fazer) {
  const r = lerResposta(corpo);
  const l = await abrirLink(sql, token);
  const [c] = await sql`SELECT c.id, c.titulo, c.status_chave FROM vybe_conteudos c
    WHERE c.id = ${r.conteudoId} AND c.removido_em IS NULL
      AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${l.cliente_id})`;
  if (!c) throw erro('Peça não encontrada neste link.', 404);
  if (c.status_chave !== STATUS_EM_APROVACAO) throw erro('Esta peça já foi respondida ou não está mais esperando sua aprovação.', 409);
  const quem = { tipo: 'link_cliente', pessoa: { nome: `${r.nome} (cliente · link de aprovação)` } };
  const mudou = await fazer.trocarStatus(sql, quem, { item: `vybe:${c.id}`, para: DESTINO[r.acao] });
  await sql`INSERT INTO vybe_aprovacao_respostas (link_id, conteudo_id, acao, nome, comentario, status_de, status_para)
    VALUES (${l.id}, ${c.id}, ${r.acao}, ${r.nome}, ${r.comentario}, ${mudou?.de || null}, ${mudou?.para || null})`;
  const texto = r.acao === 'aprovar'
    ? `✅ Aprovado pelo cliente (${r.nome}) pelo link de aprovação em ${quandoNaBahia()}.${r.comentario ? `\nComentário: ${r.comentario}` : ''}`
    : `🔧 Ajuste pedido pelo cliente (${r.nome}) pelo link de aprovação em ${quandoNaBahia()}:\n${r.comentario}`;
  let aviso = null;
  try { await fazer.comentar(sql, quem, { item: `vybe:${c.id}`, texto }); }
  catch { aviso = 'Resposta registrada; o comentário na peça não pôde ser gravado.'; }
  return { conteudo_id: String(c.id), titulo: c.titulo, acao: r.acao, status: mudou?.para || null, ...(aviso ? { aviso } : {}) };
}
