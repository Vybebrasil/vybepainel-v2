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
import { aplicar } from '../vybe_automacoes.js';

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
  // As automações rodam depois da gravação, nunca antes: regra que falha não
  // pode impedir a pessoa de mudar o status. Enquanto o Monday existir, as
  // regras dele disparam com a mesma mudança e chegam ao mesmo estado — as duas
  // convergem em vez de brigar. No dia em que ele sair, estas aqui já são as
  // únicas, e a operação não muda de comportamento.
  let automacoes = [];
  try {
    const r = await aplicar(sql, conteudo.id, {
      tipo: 'status', de: conteudo.status_chave, para: alvo.chave,
    });
    automacoes = r.aplicadas;
    await replicarNoMonday(item, r.paraOMonday);
  } catch (erro) {
    console.error('Automações falharam após troca de status:', erro.message);
  }

  return { conteudo_id: conteudo.id, titulo: conteudo.titulo, de: conteudo.de,
           para: alvo.rotulo, replica_monday: replica, automacoes };
}


// O que a automação mudou aqui precisa aparecer lá. Falha na réplica não desfaz
// nada: a gravação local é a verdade, a cópia reconcilia depois.
async function replicarNoMonday(item, para) {
  if (!para) return;
  try {
    if (Object.keys(para.colunas || {}).length) {
      await mondayQuery(
        `mutation($board: ID!, $item: ID!, $values: JSON!) {
           change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
        { board: String(BOARD_PRODUCAO), item: String(item), values: JSON.stringify(para.colunas) }
      );
    }
    if (para.grupo) {
      await mondayQuery(
        `mutation($item: ID!, $grupo: String!) { move_item_to_group(item_id: $item, group_id: $grupo) { id } }`,
        { item: String(item), grupo: String(para.grupo) }
      );
    }
  } catch (erro) {
    console.error('Réplica das automações no Monday falhou:', erro.message);
  }
}

// ── datas ─────────────────────────────────────────────────────────────────────
const COLUNA_DATA = { prazo: 'data', veiculacao: 'data__1' };

// A coluna 'etapa' do nosso banco guarda o título do grupo: é assim em todas as
// 1.853 linhas vindas da migração, e é dela que sai o campo 'grupo' da listagem.
const GRUPO_TITULO = {
  novo_grupo31348__1: 'Finalizados',
  novo_grupo57911__1: 'Produção ( Foto e Vídeo, à Captar )',
  novo_grupo__1: 'Design & Edição',
  group_title: 'Redação',
  novo_grupo22352__1: 'Gestão de publicações',
};

async function trocarData(sql, quem, { item, campo, data }) {
  if (!COLUNA_DATA[campo]) throw new Error(`Campo de data desconhecido: ${campo}`);
  const iso = String(data || '').slice(0, 10);
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Data inválida; use AAAA-MM-DD.');

  const linhas = await sql`SELECT id, titulo,
      TO_CHAR(prazo,'YYYY-MM-DD') AS prazo, TO_CHAR(veiculacao,'YYYY-MM-DD') AS veiculacao
    FROM vybe_conteudos WHERE monday_item_id = ${String(item)}`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  const de = campo === 'prazo' ? c.prazo : c.veiculacao;

  // A mesma regra que o painel aplica: prazo não passa da veiculação.
  const prazo = campo === 'prazo' ? iso : c.prazo;
  const veic = campo === 'veiculacao' ? iso : c.veiculacao;
  if (prazo && veic && prazo > veic) throw new Error('O prazo não pode ficar depois da veiculação.');

  if (campo === 'prazo') await sql`UPDATE vybe_conteudos SET prazo=${iso || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  else await sql`UPDATE vybe_conteudos SET veiculacao=${iso || null}, atualizado_em=NOW() WHERE id=${c.id}`;

  await registrarEvento(sql, c.id, { tipo: campo, de, para: iso, autorId: await pessoaDaSessao(sql, quem) });

  let replica = 'ok';
  try {
    await mondayQuery(
      `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
      { board: String(BOARD_PRODUCAO), item: String(item),
        values: JSON.stringify({ [COLUNA_DATA[campo]]: { date: iso } }) }
    );
  } catch (erro) { replica = `falhou: ${erro.message}`; }
  return { conteudo_id: c.id, titulo: c.titulo, campo, de, para: iso, replica_monday: replica };
}

// ── responsáveis ──────────────────────────────────────────────────────────────
async function trocarResponsaveis(sql, quem, { item, pessoas }) {
  const ids = Array.isArray(pessoas) ? pessoas.map(String) : [];
  const linhas = await sql`SELECT id, titulo FROM vybe_conteudos WHERE monday_item_id = ${String(item)}`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];

  const antes = (await sql`SELECT p.nome FROM vybe_conteudo_responsaveis r
      JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${c.id} ORDER BY p.nome`)
    .map((l) => l.nome).join(', ');

  await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=${c.id}`;
  if (ids.length) {
    await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id)
      SELECT ${c.id}, id FROM vybe_pessoas WHERE monday_user_id = ANY(${ids})
      ON CONFLICT DO NOTHING`;
  }
  const depois = (await sql`SELECT p.nome FROM vybe_conteudo_responsaveis r
      JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${c.id} ORDER BY p.nome`)
    .map((l) => l.nome).join(', ');

  await registrarEvento(sql, c.id, {
    tipo: 'responsavel', de: antes || 'sem responsável', para: depois || 'sem responsável',
    autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  try {
    await mondayQuery(
      `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
      { board: String(BOARD_PRODUCAO), item: String(item),
        values: JSON.stringify({ person: { personsAndTeams: ids.map((id) => ({ id: Number(id), kind: 'person' })) } }) }
    );
  } catch (erro) { replica = `falhou: ${erro.message}`; }
  return { conteudo_id: c.id, titulo: c.titulo, de: antes, para: depois, replica_monday: replica };
}

// ── comentário ────────────────────────────────────────────────────────────────
async function comentar(sql, quem, { item, texto }) {
  if (!String(texto || '').trim()) throw new Error('Escreva algo antes de enviar.');
  const linhas = await sql`SELECT id, titulo FROM vybe_conteudos WHERE monday_item_id = ${String(item)}`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  const autorId = await pessoaDaSessao(sql, quem);
  const autor = quem?.pessoa?.nome || 'Vybe OS';

  await sql`INSERT INTO vybe_conteudo_updates (conteudo_id, corpo, autor, criado_em)
    VALUES (${c.id}, ${String(texto)}, ${autor}, NOW())`;
  await registrarEvento(sql, c.id, { tipo: 'comentario', texto: String(texto).slice(0, 400), autorId });

  let replica = 'ok';
  try {
    await mondayQuery(
      `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
      { item: String(item), body: `<p><b>${autor}</b> · via Vybe Painel</p><p>${String(texto)}</p>` }
    );
  } catch (erro) { replica = `falhou: ${erro.message}`; }
  return { conteudo_id: c.id, titulo: c.titulo, autor, replica_monday: replica };
}

// ── criar conteúdo ────────────────────────────────────────────────────────────
// O id do Monday só existe depois de criar lá. Para o banco continuar mandando,
// gravamos primeiro sem o id e ligamos os dois em seguida.
// Mover de grupo só existia dentro das automações. Nenhuma tela oferecia, então
// um conteúdo no grupo errado não tinha conserto pelo painel.
async function moverGrupo(sql, quem, { item, grupo_id }) {
  const titulo = GRUPO_TITULO[grupo_id];
  if (!titulo) throw new Error(`Grupo desconhecido: ${grupo_id}`);

  const linhas = await sql`SELECT id, titulo, etapa AS de FROM vybe_conteudos
    WHERE monday_item_id = ${String(item)}`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const conteudo = linhas[0];

  await sql`UPDATE vybe_conteudos SET grupo_id=${grupo_id}, etapa=${titulo}, atualizado_em=NOW()
    WHERE id=${conteudo.id}`;
  await registrarEvento(sql, conteudo.id, {
    tipo: 'grupo', de: conteudo.de, para: titulo, autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  try {
    await mondayQuery(
      `mutation ($item: ID!, $grupo: String!) {
         move_item_to_group(item_id: $item, group_id: $grupo) { id } }`,
      { item: String(item), grupo: String(grupo_id) }
    );
  } catch (erro) { replica = `falhou: ${erro.message}`; }
  return { conteudo_id: conteudo.id, titulo: conteudo.titulo, de: conteudo.de, para: titulo, replica_monday: replica };
}

async function criarConteudo(sql, quem, dados) {
  const { titulo, cliente, formato, prazo, veiculacao, status = 'a_fazer', grupo_id, briefing,
          tipo_conteudo = null, captacao = null, responsaveis = [] } = dados;
  // Nossa coluna 'etapa' guarda o TÍTULO do grupo — é dela que a listagem tira o
  // campo 'grupo'. Não é a coluna "Tipo de conteúdo" do Monday, que é outra
  // coisa e é dropdown.
  const etapa = GRUPO_TITULO[grupo_id] || null;
  if (!titulo || !cliente) throw new Error('Informe ao menos título e cliente.');

  const cli = (await sql`SELECT id, nome FROM vybe_clientes WHERE LOWER(nome)=LOWER(${String(cliente)})`)[0];
  if (!cli) throw new Error(`Cliente não cadastrado: ${cliente}`);
  const st = (await sql`SELECT chave, rotulo, monday_index FROM vybe_status WHERE chave=${String(status)}`)[0];
  if (!st) throw new Error(`Status desconhecido: ${status}`);

  const novo = (await sql`INSERT INTO vybe_conteudos
      (titulo, formato, clientes_texto, status_chave, etapa, grupo_id, prazo, veiculacao, briefing, status_em)
    VALUES (${titulo}, ${formato || null}, ${cli.nome}, ${st.chave}, ${etapa}, ${grupo_id || null},
            ${prazo || null}, ${veiculacao || null}, ${briefing || null}, NOW())
    RETURNING id`)[0];
  await sql`INSERT INTO vybe_conteudo_clientes (conteudo_id, cliente_id) VALUES (${novo.id}, ${cli.id})`;
  if (captacao) await sql`UPDATE vybe_conteudos SET captacao=${String(captacao)} WHERE id=${novo.id}`;
  // Conteúdo que nasce sem dono some da fila de todo mundo.
  if (responsaveis.length) {
    await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id)
      SELECT ${novo.id}, id FROM vybe_pessoas WHERE monday_user_id = ANY(${responsaveis.map(String)})
      ON CONFLICT DO NOTHING`;
  }
  await registrarEvento(sql, novo.id, {
    tipo: 'criacao', para: titulo, autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  let mondayId = null;
  try {
    const valores = {
      lista_suspensa_mkmqnjbv: { labels: [cli.nome] },
      status: { index: Number(st.monday_index) },
    };
    if (formato) valores.lista_suspensa0__1 = { labels: [formato] };
    if (prazo) valores.data = { date: prazo };
    if (veiculacao) valores.data__1 = { date: veiculacao };
    // "Tipo de conteúdo" é dropdown: aceita ids ou labels, nunca index. Mandar
    // {index} faz o Monday aceitar a chamada e deixar a coluna vazia.
    if (tipo_conteudo) {
      valores.lista_suspensa__1 = Number.isFinite(Number(tipo_conteudo))
        ? { ids: [Number(tipo_conteudo)] }
        : { labels: [String(tipo_conteudo)] };
    }
    if (captacao) valores.status_1__1 = { label: String(captacao) };
    if (responsaveis.length) {
      valores.person = { personsAndTeams: responsaveis.map((id) => ({ id: Number(id), kind: 'person' })) };
    }
    const r = await mondayQuery(
      `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) {
         create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`,
      { board: String(BOARD_PRODUCAO), group: grupo_id || 'group_title', name: titulo, values: JSON.stringify(valores) }
    );
    mondayId = r?.create_item?.id || null;
    if (mondayId) await sql`UPDATE vybe_conteudos SET monday_item_id=${String(mondayId)} WHERE id=${novo.id}`;
  } catch (erro) { replica = `falhou: ${erro.message}`; }
  return { conteudo_id: novo.id, titulo, cliente: cli.nome, monday_item_id: mondayId, replica_monday: replica };
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

  const corpo = req.body || {};
  const { acao, item } = corpo;
  if (!acao) return res.status(400).json({ error: 'Informe a ação.' });
  if (acao !== 'criar' && !item) return res.status(400).json({ error: 'Informe o item.' });

  try {
    const sql = database();
    if (acao === 'status') {
      if (!corpo.para) return res.status(400).json({ error: 'Informe o status de destino.' });
      return res.status(200).json({ ok: true, acao, ...(await trocarStatus(sql, quem, { item, para: corpo.para })) });
    }
    if (acao === 'prazo' || acao === 'veiculacao') {
      return res.status(200).json({ ok: true, acao,
        ...(await trocarData(sql, quem, { item, campo: acao, data: corpo.data })) });
    }
    if (acao === 'responsaveis') {
      return res.status(200).json({ ok: true, acao,
        ...(await trocarResponsaveis(sql, quem, { item, pessoas: corpo.pessoas })) });
    }
    if (acao === 'comentario') {
      return res.status(200).json({ ok: true, acao, ...(await comentar(sql, quem, { item, texto: corpo.texto })) });
    }
    if (acao === 'grupo') {
      if (!corpo.grupo_id) return res.status(400).json({ error: 'Informe o grupo de destino.' });
      return res.status(200).json({ ok: true, acao,
        ...(await moverGrupo(sql, quem, { item, grupo_id: corpo.grupo_id })) });
    }
    if (acao === 'criar') {
      return res.status(200).json({ ok: true, acao, ...(await criarConteudo(sql, quem, corpo)) });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${acao}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
