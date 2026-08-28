// api/conteudo.js — escrita dupla: banco da Vybe primeiro, Monday depois.
//
// Hoje o painel grava só no Monday e o banco copia por webhook. Isso mantém o
// Monday como fonte da verdade: se ele sai do ar, ninguém trabalha.
//
// Aqui a ordem se inverte. A gravação vai para o banco, que passa a mandar, e
// em seguida para o Monday, que vira réplica. Enquanto os dois recebem, desligar
// o Monday é decisão sem risco — e é justamente para durar algumas semanas assim.
//
// O Monday falhar NÃO desfaz a gravação no banco: a réplica pode ficar para trás
// e ser reconciliada depois. O contrário — perder a escrita local porque o Monday
// recusou — seria voltar a depender dele.
//
// Cada operação registra quem fez em vybe_conteudo_eventos. Até existir sessão,
// a operação de vocês não tinha rastro de autoria nenhum.

import { neon } from '@neondatabase/serverless';
import { quemChama } from '../vybe_acesso.js';

const MONDAY = process.env.MONDAY_RELAY_URL || 'https://vybepainel-v2.vercel.app/api/monday';
const BOARD_PRODUCAO = 7829537690;

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

async function mondayQuery(query, variables) {
  const resposta = await fetch(MONDAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.MIRROR_ADMIN_KEY ? { Authorization: `Bearer ${process.env.MIRROR_ADMIN_KEY}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const corpo = await resposta.json();
  if (!resposta.ok || corpo?.errors?.length) {
    throw new Error(corpo?.errors?.[0]?.message || corpo?.error || `Monday recusou (${resposta.status})`);
  }
  return corpo.data;
}

async function registrarEvento(sql, conteudoId, { tipo, de, para, autorId, texto }) {
  await sql`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id, texto)
    VALUES (${conteudoId}, ${tipo}, ${de || null}, ${para || null}, ${autorId || null}, ${texto || null})`;
}

async function pessoaDaSessao(sql, quem) {
  if (quem?.tipo !== 'sessao' || !quem.pessoa?.email) return null;
  const linhas = await sql`SELECT id FROM vybe_pessoas WHERE LOWER(email)=LOWER(${quem.pessoa.email})`;
  return linhas[0] ? Number(linhas[0].id) : null;
}

// ── status ────────────────────────────────────────────────────────────────────
async function trocarStatus(sql, quem, { item, para }) {
  const linhas = await sql`SELECT c.id, c.status_chave, c.titulo, s.rotulo AS de
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.chave = c.status_chave
    WHERE c.monday_item_id = ${String(item)}`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const conteudo = linhas[0];

  const alvo = (await sql`SELECT chave, rotulo, monday_index FROM vybe_status WHERE chave=${String(para)}`)[0];
  if (!alvo) throw new Error(`Status desconhecido: ${para}`);

  await sql`UPDATE vybe_conteudos SET status_chave=${alvo.chave}, status_em=NOW(), atualizado_em=NOW()
    WHERE id=${conteudo.id}`;
  await registrarEvento(sql, conteudo.id, {
    tipo: 'status', de: conteudo.de, para: alvo.rotulo,
    autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  try {
    await mondayQuery(
      `mutation ($board: ID!, $item: ID!, $value: JSON!) {
         change_column_value(board_id: $board, item_id: $item, column_id: "status", value: $value) { id } }`,
      { board: String(BOARD_PRODUCAO), item: String(item), value: JSON.stringify({ index: Number(alvo.monday_index) }) }
    );
  } catch (erro) {
    replica = `falhou: ${erro.message}`;
  }
  return { conteudo_id: conteudo.id, titulo: conteudo.titulo, de: conteudo.de, para: alvo.rotulo, replica_monday: replica };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const quem = quemChama(req);
  if (!quem) return res.status(401).json({ error: 'Entre no painel para alterar dados.' });

  const { acao, item, para } = req.body || {};
  if (!acao || !item) return res.status(400).json({ error: 'Informe a ação e o item.' });

  try {
    const sql = database();
    if (acao === 'status') {
      if (!para) return res.status(400).json({ error: 'Informe o status de destino.' });
      return res.status(200).json({ ok: true, acao, ...(await trocarStatus(sql, quem, { item, para })) });
    }
    return res.status(400).json({ error: `Ação ainda não implementada: ${acao}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
