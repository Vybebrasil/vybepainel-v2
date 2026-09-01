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
import { replicarOuEnfileirar } from '../vybe_replica_queue.js';

const MONDAY = process.env.MONDAY_RELAY_URL || 'https://vybepainel-v2.vercel.app/api/monday';
const BOARD_PRODUCAO = 7829537690;
const BOARD_DEMANDAS_ID = 8385559107;

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

function referenciaLocal(item) {
  const texto = String(item || '');
  return texto.startsWith('vybe:') ? Number(texto.slice(5)) : null;
}
function referenciaSubitemLocal(item) {
  const texto = String(item || '');
  return texto.startsWith('vybe-subitem:') ? Number(texto.slice(13)) : null;
}
function referenciaReplica(conteudo, recebida) {
  return String(conteudo?.monday_item_id || recebida || `vybe:${conteudo?.id}`);
}
async function replicar(sql, operacao, referencia, query, variables) {
  const r = await replicarOuEnfileirar(sql, mondayQuery, { operacao, referencia, query, variables });
  return r.estado === 'ok' ? 'ok' : `pendente: ${r.operation_key}`;
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
  const linhas = await sql`SELECT c.id, c.board_id, c.monday_item_id, c.status_chave, c.titulo, s.rotulo AS de
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.chave = c.status_chave AND s.board_id = c.board_id
    WHERE (c.monday_item_id = ${String(item)} OR c.id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const conteudo = linhas[0];

  const alvo = (await sql`SELECT chave, rotulo, monday_index FROM vybe_status
    WHERE chave=${String(para)} AND board_id=${conteudo.board_id}`)[0];
  if (!alvo) throw new Error(`Status desconhecido neste board: ${para}`);

  await sql`UPDATE vybe_conteudos SET status_chave=${alvo.chave}, status_em=NOW(), atualizado_em=NOW()
    WHERE id=${conteudo.id}`;
  await registrarEvento(sql, conteudo.id, {
    tipo: 'status', de: conteudo.de, para: alvo.rotulo,
    autorId: await pessoaDaSessao(sql, quem),
  });

  const replica = await replicar(sql, 'status', `conteudo:${conteudo.id}`,
    `mutation ($board: ID!, $item: ID!, $value: JSON!) {
       change_column_value(board_id: $board, item_id: $item, column_id: "status", value: $value) { id } }`,
    { board: String(conteudo.board_id), item: referenciaReplica(conteudo, item),
      value: JSON.stringify({ index: Number(alvo.monday_index) }) });
  // As automações rodam depois da gravação, nunca antes: regra que falha não
  // pode impedir a pessoa de mudar o status. Enquanto o Monday existir, as
  // regras dele disparam com a mesma mudança e chegam ao mesmo estado — as duas
  // convergem em vez de brigar. No dia em que ele sair, estas aqui já são as
  // únicas, e a operação não muda de comportamento.
  // As regras que importamos são de Produção: os grupos e as chaves de status são
  // de lá. Rodá-las numa demanda moveria a peça para um grupo que não existe no
  // board dela.
  let automacoes = [];
  // O que a automação mudou precisa voltar para a tela. A regra "Para agendar"
  // troca o dono da peça e o grupo; sem devolver isso, a pessoa que mudou o
  // status continuava vendo o próprio rosto na linha e concluía que a regra não
  // rodou — foi exatamente a queixa que chegou da mesa de planejamento.
  let depois = null;
  try {
    if (Number(conteudo.board_id) !== BOARD_PRODUCAO) throw { pular: true };
    const r = await aplicar(sql, conteudo.id, {
      tipo: 'status', de: conteudo.status_chave, para: alvo.chave,
    });
    automacoes = r.aplicadas;
    await replicarNoMonday(sql, referenciaReplica(conteudo, item), r.paraOMonday, conteudo.board_id, conteudo.id);
    if (automacoes.length) {
      const [estado] = await sql`SELECT c.grupo_id, c.etapa AS grupo,
          COALESCE(ARRAY(SELECT p.monday_user_id FROM vybe_conteudo_responsaveis r
            JOIN vybe_pessoas p ON p.id = r.pessoa_id
            WHERE r.conteudo_id = c.id ORDER BY r.ordem, p.nome), '{}') AS responsavel_ids
        FROM vybe_conteudos c WHERE c.id = ${conteudo.id}`;
      if (estado) depois = { grupo_id: estado.grupo_id || '', grupo: estado.grupo || '',
                             responsavel_ids: (estado.responsavel_ids || []).map(String) };
    }
  } catch (erro) {
    if (!erro?.pular) console.error('Automações falharam após troca de status:', erro.message);
  }

  return { conteudo_id: conteudo.id, titulo: conteudo.titulo, de: conteudo.de,
           para: alvo.rotulo, replica_monday: replica, automacoes, depois };
}


// O que a automação mudou aqui precisa aparecer lá. Falha na réplica não desfaz
// nada: a gravação local é a verdade, a cópia reconcilia depois.
async function replicarNoMonday(sql, item, para, boardId = BOARD_PRODUCAO, conteudoId = null) {
  if (!para) return [];
  const referencia = conteudoId ? `conteudo:${conteudoId}` : String(item);
  const resultados = [];
  if (Object.keys(para.colunas || {}).length) {
    resultados.push(await replicar(sql, 'automacao_colunas', referencia,
      `mutation($board: ID!, $item: ID!, $values: JSON!) {
         change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
      { board: String(boardId), item: String(item), values: JSON.stringify(para.colunas) }));
  }
  if (para.grupo) {
    resultados.push(await replicar(sql, 'automacao_grupo', referencia,
      `mutation($item: ID!, $grupo: String!) { move_item_to_group(item_id: $item, group_id: $grupo) { id } }`,
      { item: String(item), grupo: String(para.grupo) }));
  }
  return resultados;
}

// ── datas ─────────────────────────────────────────────────────────────────────
// As colunas não têm os mesmos ids nos dois boards: a data de veiculação em
// Produção é 'data__1' e em Demandas é 'data_mkky6jx'. Escrever com o id do
// board errado grava em coluna nenhuma e o Monday aceita calado.
const COLUNAS_POR_BOARD = {
  [BOARD_PRODUCAO]: { prazo: 'data', veiculacao: 'data__1', status: 'status', pessoas: 'person' },
  [BOARD_DEMANDAS_ID]: { prazo: 'data', veiculacao: 'data_mkky6jx', status: 'status', pessoas: 'person' },
};
const colunasDe = (boardId) => COLUNAS_POR_BOARD[Number(boardId)] || COLUNAS_POR_BOARD[BOARD_PRODUCAO];
const COLUNA_DATA = { prazo: 'data', veiculacao: 'data__1' };

// A coluna 'etapa' do nosso banco guarda o título do grupo: é assim em todas as
// 1.853 linhas vindas da migração, e é dela que sai o campo 'grupo' da listagem.
const GRUPO_TITULO = {
  novo_grupo31348__1: 'Finalizados',
  novo_grupo57911__1: 'Produção ( Foto e Vídeo, à Captar )',
  novo_grupo__1: 'Design & Edição',
  group_title: 'Redação',
  novo_grupo22352__1: 'Gestão de publicações',
  // Demandas tem grupos próprios; o cadastro só conhecia os de Produção.
  group_mm187437: 'Novas Demandas/Ideias',
  novo_grupo_mkmkjdqd: 'A Fazer',
  novo_grupo_mkkyfhtw: 'Em Execução',
  novo_grupo_mkkyx8pv: 'Concluídas',
};

// Cada board escreve nas suas colunas. Antes o cadastro só sabia as de Produção
// e mandava tudo para lá, então Solicitações só recebia item criado no Monday.
const CRIACAO_POR_BOARD = {
  [BOARD_PRODUCAO]: {
    grupoPadrao: 'group_title',
    cliente: 'lista_suspensa_mkmqnjbv',
    status: 'status', prazo: 'data', segundaData: 'data__1',
    formato: 'lista_suspensa0__1', tipo: 'lista_suspensa__1',
    captacao: 'status_1__1', pessoas: 'person',
  },
  [BOARD_DEMANDAS_ID]: {
    grupoPadrao: 'group_mm187437',
    cliente: 'lista_suspensa_mkmet5gs',
    status: 'status', prazo: 'data', segundaData: 'data_mkky6jx',
    formato: 'dropdown_mkv8d52z', prioridade: 'color_mkwtgakv',
    pessoas: 'person',
  },
};

async function trocarDatas(sql, quem, { item, prazo, veiculacao }) {
  const normalizar = (valor, campo) => {
    const iso = String(valor || '').slice(0, 10);
    if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`${campo} inválido; use AAAA-MM-DD.`);
    return iso;
  };
  const novoPrazo = normalizar(prazo, 'Prazo');
  const novaVeiculacao = normalizar(veiculacao, 'Veiculação');
  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo,
      TO_CHAR(prazo,'YYYY-MM-DD') AS prazo, TO_CHAR(veiculacao,'YYYY-MM-DD') AS veiculacao
    FROM vybe_conteudos WHERE (monday_item_id=${String(item)} OR id=${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  if (Number(c.board_id) === BOARD_PRODUCAO && novoPrazo && novaVeiculacao && novoPrazo > novaVeiculacao) {
    throw new Error('O prazo não pode ficar depois da veiculação.');
  }
  const mudouPrazo = String(c.prazo || '') !== novoPrazo;
  const mudouVeiculacao = String(c.veiculacao || '') !== novaVeiculacao;
  if (!mudouPrazo && !mudouVeiculacao) {
    return { conteudo_id: c.id, titulo: c.titulo, replica_monday: 'sem mudança' };
  }
  await sql`UPDATE vybe_conteudos SET prazo=${novoPrazo || null}, veiculacao=${novaVeiculacao || null}, atualizado_em=NOW()
    WHERE id=${c.id}`;
  const autorId = await pessoaDaSessao(sql, quem);
  if (mudouPrazo) await registrarEvento(sql, c.id, { tipo: 'prazo', de: c.prazo, para: novoPrazo, autorId });
  if (mudouVeiculacao) await registrarEvento(sql, c.id, { tipo: 'veiculacao', de: c.veiculacao, para: novaVeiculacao, autorId });
  const colunas = colunasDe(c.board_id);
  const values = {};
  if (mudouPrazo) values[colunas.prazo] = { date: novoPrazo || null };
  if (mudouVeiculacao) values[colunas.veiculacao] = { date: novaVeiculacao || null };
  const replica = await replicar(sql, 'datas', `conteudo:${c.id}`,
    `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
    { board: String(c.board_id), item: referenciaReplica(c, item), values: JSON.stringify(values) });
  return { conteudo_id: c.id, titulo: c.titulo, prazo: novoPrazo, veiculacao: novaVeiculacao, replica_monday: replica };
}

async function trocarData(sql, quem, { item, campo, data }) {
  if (!COLUNA_DATA[campo]) throw new Error(`Campo de data desconhecido: ${campo}`);
  const iso = String(data || '').slice(0, 10);
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Data inválida; use AAAA-MM-DD.');

  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo,
      TO_CHAR(prazo,'YYYY-MM-DD') AS prazo, TO_CHAR(veiculacao,'YYYY-MM-DD') AS veiculacao
    FROM vybe_conteudos WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  const de = campo === 'prazo' ? c.prazo : c.veiculacao;

  // A mesma regra que o painel aplica: prazo não passa da veiculação. Vale só em
  // Produção — em Demandas a segunda data é "Data de Conclusão", que por
  // definição vem depois e não é um prazo a proteger.
  if (Number(c.board_id) === BOARD_PRODUCAO) {
    const prazo = campo === 'prazo' ? iso : c.prazo;
    const veic = campo === 'veiculacao' ? iso : c.veiculacao;
    if (prazo && veic && prazo > veic) throw new Error('O prazo não pode ficar depois da veiculação.');
  }

  if (campo === 'prazo') await sql`UPDATE vybe_conteudos SET prazo=${iso || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  else await sql`UPDATE vybe_conteudos SET veiculacao=${iso || null}, atualizado_em=NOW() WHERE id=${c.id}`;

  await registrarEvento(sql, c.id, { tipo: campo, de, para: iso, autorId: await pessoaDaSessao(sql, quem) });

  const replica = await replicar(sql, campo, `conteudo:${c.id}`,
    `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
    { board: String(c.board_id), item: referenciaReplica(c, item),
      values: JSON.stringify({ [colunasDe(c.board_id)[campo]]: { date: iso || null } }) });
  return { conteudo_id: c.id, titulo: c.titulo, campo, de, para: iso, replica_monday: replica };
}

// ── responsáveis ──────────────────────────────────────────────────────────────
async function trocarResponsaveis(sql, quem, { item, pessoas }) {
  const ids = Array.isArray(pessoas) ? pessoas.map(String) : [];
  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];

  const antes = (await sql`SELECT p.nome FROM vybe_conteudo_responsaveis r
      JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${c.id} ORDER BY r.ordem, p.nome`)
    .map((l) => l.nome).join(', ');

  await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=${c.id}`;
  if (ids.length) {
    await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem)
      SELECT ${c.id}, p.id, o.ord - 1
        FROM UNNEST(${ids}::text[]) WITH ORDINALITY AS o(uid, ord)
        JOIN vybe_pessoas p ON p.monday_user_id = o.uid
      ON CONFLICT DO NOTHING`;
  }
  const depois = (await sql`SELECT p.nome FROM vybe_conteudo_responsaveis r
      JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${c.id} ORDER BY r.ordem, p.nome`)
    .map((l) => l.nome).join(', ');

  await registrarEvento(sql, c.id, {
    tipo: 'responsavel', de: antes || 'sem responsável', para: depois || 'sem responsável',
    autorId: await pessoaDaSessao(sql, quem),
  });

  const replica = await replicar(sql, 'responsaveis', `conteudo:${c.id}`,
    `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
    { board: String(c.board_id), item: referenciaReplica(c, item),
      values: JSON.stringify({ [colunasDe(c.board_id).pessoas]: {
        personsAndTeams: ids.map((id) => ({ id: Number(id), kind: 'person' })) } }) });
  return { conteudo_id: c.id, titulo: c.titulo, de: antes, para: depois, replica_monday: replica };
}

// ── comentário ────────────────────────────────────────────────────────────────
async function comentar(sql, quem, { item, texto }) {
  if (!String(texto || '').trim()) throw new Error('Escreva algo antes de enviar.');
  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  const autorId = await pessoaDaSessao(sql, quem);
  const autor = quem?.pessoa?.nome || 'Vybe OS';

  await sql`INSERT INTO vybe_conteudo_updates (conteudo_id, corpo, autor, criado_em)
    VALUES (${c.id}, ${String(texto)}, ${autor}, NOW())`;
  await registrarEvento(sql, c.id, { tipo: 'comentario', texto: String(texto).slice(0, 400), autorId });

  const replica = await replicar(sql, 'comentario', `conteudo:${c.id}`,
    `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
    { item: referenciaReplica(c, item), body: `<p><b>${autor}</b> · via Vybe OS</p><p>${String(texto)}</p>` });
  return { conteudo_id: c.id, titulo: c.titulo, autor, replica_monday: replica };
}

// ── criar conteúdo ────────────────────────────────────────────────────────────
// O id do Monday só existe depois de criar lá. Para o banco continuar mandando,
// gravamos primeiro sem o id e ligamos os dois em seguida.

// Remover a peça. Sai das telas, não sai do banco: o histórico dela — comentários,
// mudanças de status, quem fez o quê — some junto se a linha for apagada, e quem
// remove por engano fica sem volta. No Monday o item vai para a lixeira, que
// também guarda por 30 dias.
async function removerConteudo(sql, quem, { item, motivo }) {
  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo, removido_em FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  if (c.removido_em) return { conteudo_id: c.id, titulo: c.titulo, ja_removido: true };

  const autor = await pessoaDaSessao(sql, quem);
  await sql`UPDATE vybe_conteudos SET removido_em=NOW(), removido_por=${autor}, atualizado_em=NOW()
    WHERE id=${c.id}`;
  await registrarEvento(sql, c.id, {
    tipo: 'remocao', de: c.titulo, para: String(motivo || '').trim() || null, autorId: autor,
  });

  const replica = await replicar(sql, 'remover', `conteudo:${c.id}`,
    `mutation($item: ID!) { delete_item(item_id: $item) { id } }`,
    { item: referenciaReplica(c, item) });

  return { conteudo_id: c.id, titulo: c.titulo, replica_monday: replica };
}

// Devolve uma peça removida. Existe porque remover por engano é o motivo de a
// remoção ser reversível — sem o caminho de volta, a rede não serve para nada.
async function restaurarConteudo(sql, quem, { item }) {
  const linhas = await sql`UPDATE vybe_conteudos SET removido_em=NULL, removido_por=NULL,
      atualizado_em=NOW()
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)}) AND removido_em IS NOT NULL
    RETURNING id, titulo`;
  if (!linhas.length) throw new Error('Esta peça não está removida.');
  await registrarEvento(sql, linhas[0].id, {
    tipo: 'restauracao', para: linhas[0].titulo, autorId: await pessoaDaSessao(sql, quem),
  });
  // O item no Monday está na lixeira dele e precisa ser restaurado por lá: a API
  // não desfaz delete_item. Dito aqui para ninguém achar que voltou nos dois.
  return { conteudo_id: linhas[0].id, titulo: linhas[0].titulo,
           aviso: 'No Monday o item continua na lixeira e precisa ser restaurado por lá.' };
}

// Mover entre Produção e Solicitações. O domínio muda primeiro; a movimentação
// no Monday é apenas uma réplica enfileirada enquanto ele existir como contingência.
async function moverBoard(sql, quem, { item, destino }) {
  const alvo = String(destino) === String(BOARD_DEMANDAS_ID) ? BOARD_DEMANDAS_ID : BOARD_PRODUCAO;
  const grupo = alvo === BOARD_DEMANDAS_ID ? 'group_mm187437' : 'group_title';
  const statusPadrao = alvo === BOARD_DEMANDAS_ID ? 'nova_demanda' : 'a_fazer';
  const c = (await sql`SELECT id, board_id, monday_item_id, titulo FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`)[0];
  if (!c) throw new Error(`Conteúdo ${item} não existe no banco.`);
  if (Number(c.board_id) === alvo) return { conteudo_id: c.id, board_id: alvo, sem_mudanca: true };

  const statusExiste = (await sql`SELECT chave FROM vybe_status WHERE board_id=${alvo} AND chave=${statusPadrao}`)[0];
  if (!statusExiste) throw new Error(`Status inicial ${statusPadrao} não está configurado no destino.`);

  await sql`UPDATE vybe_conteudos SET board_id=${alvo}, grupo_id=${grupo},
      etapa=${GRUPO_TITULO[grupo] || null}, status_chave=${statusPadrao}, status_em=NOW(),
      removido_em=NULL, atualizado_em=NOW() WHERE id=${c.id}`;
  await registrarEvento(sql, c.id, {
    tipo: 'board', de: Number(c.board_id) === BOARD_DEMANDAS_ID ? 'Demandas' : 'Produção',
    para: alvo === BOARD_DEMANDAS_ID ? 'Demandas' : 'Produção',
    autorId: await pessoaDaSessao(sql, quem),
  });

  const replica = await replicar(sql, 'mover_board', `conteudo:${c.id}`,
    `mutation($item: ID!, $board: ID!, $grupo: ID!) {
       move_item_to_board(item_id: $item, board_id: $board, group_id: $grupo) { id board { id name } } }`,
    { item: referenciaReplica(c, item), board: String(alvo), grupo });

  return {
    conteudo_id: c.id,
    para: alvo === BOARD_DEMANDAS_ID ? 'Demandas' : 'Produção',
    board_id: alvo,
    grupo: GRUPO_TITULO[grupo],
    replica_monday: replica,
  };
}

// Renomear a peça. Não existia no painel: dava para criar, nunca para corrigir um
// título. Com o time fora do Monday, um erro de digitação viraria permanente.
async function trocarTitulo(sql, quem, { item, titulo }) {
  const novo = String(titulo || '').trim();
  if (!novo) throw new Error('O título não pode ficar vazio.');
  if (novo.length > 255) throw new Error('Título muito longo.');

  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  if (c.titulo === novo) return { conteudo_id: c.id, de: c.titulo, para: novo, replica_monday: 'sem mudança' };

  await sql`UPDATE vybe_conteudos SET titulo=${novo}, atualizado_em=NOW() WHERE id=${c.id}`;
  await registrarEvento(sql, c.id, {
    tipo: 'titulo', de: c.titulo, para: novo, autorId: await pessoaDaSessao(sql, quem),
  });

  const replica = await replicar(sql, 'titulo', `conteudo:${c.id}`,
    `mutation($board: ID!, $item: ID!, $values: JSON!) {
       change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
    { board: String(c.board_id), item: referenciaReplica(c, item), values: JSON.stringify({ name: novo }) });

  return { conteudo_id: c.id, de: c.titulo, para: novo, replica_monday: replica };
}

// Mover de grupo só existia dentro das automações. Nenhuma tela oferecia, então
// um conteúdo no grupo errado não tinha conserto pelo painel.
async function moverGrupo(sql, quem, { item, grupo_id }) {
  const titulo = GRUPO_TITULO[grupo_id];
  if (!titulo) throw new Error(`Grupo desconhecido: ${grupo_id}`);

  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo, etapa AS de FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const conteudo = linhas[0];

  await sql`UPDATE vybe_conteudos SET grupo_id=${grupo_id}, etapa=${titulo}, atualizado_em=NOW()
    WHERE id=${conteudo.id}`;
  await registrarEvento(sql, conteudo.id, {
    tipo: 'grupo', de: conteudo.de, para: titulo, autorId: await pessoaDaSessao(sql, quem),
  });

  const replica = await replicar(sql, 'grupo', `conteudo:${conteudo.id}`,
    `mutation ($item: ID!, $grupo: String!) {
       move_item_to_group(item_id: $item, group_id: $grupo) { id } }`,
    { item: referenciaReplica(conteudo, item), grupo: String(grupo_id) });
  return { conteudo_id: conteudo.id, titulo: conteudo.titulo, de: conteudo.de, para: titulo, replica_monday: replica };
}

// Troca de campo de escolha: captação, tipo de conteúdo, prioridade, OFF e
// formato. Guarda a chave, manda o índice ou o id para o Monday, e registra quem
// mudou — o Monday não sabia dizer isso, porque tudo ia com o mesmo token.
//
// As cinco consultas estão escritas uma a uma, e não montadas por concatenação:
// o driver não injeta nome de coluna, e SQL montado com texto para poupar linhas
// não vale o risco.
// A coluna nao e a mesma nos dois quadros. Formato em Producao e
// lista_suspensa0__1 e em Demandas e dropdown_mkv8d52z; prioridade e
// color_mm164yv8 num e color_mkwtgakv no outro. Isto aqui tinha um id so por
// campo: mudar a prioridade de uma Solicitacao procurava a opcao na coluna de
// Producao e mandava para la. O banco daqui aceitava — e o Monday recusava a
// replica em silencio, entao os dois iam se afastando a cada edicao.
//
// Captacao, tipo de conteudo e OFF nao existem em Demandas: ali o campo nao e
// oferecido, e se chegar mesmo assim, recusa dizendo qual e o motivo.
const ESCOLHAS = {
  captacao:      { catalogo: 'vybe_captacao', gatilho: 'captacao',
                   colunas: { [BOARD_PRODUCAO]: 'status_1__1' } },
  tipo_conteudo: { catalogo: 'vybe_opcoes', multi: true,
                   colunas: { [BOARD_PRODUCAO]: 'lista_suspensa__1' } },
  off_audio:     { catalogo: 'vybe_opcoes',
                   colunas: { [BOARD_PRODUCAO]: 'color_mkynd7j8' } },
  prioridade:    { catalogo: 'vybe_opcoes',
                   colunas: { [BOARD_PRODUCAO]: 'color_mm164yv8',
                              [BOARD_DEMANDAS_ID]: 'color_mkwtgakv' } },
  formato:       { catalogo: 'vybe_opcoes', multi: true,
                   colunas: { [BOARD_PRODUCAO]: 'lista_suspensa0__1',
                              [BOARD_DEMANDAS_ID]: 'dropdown_mkv8d52z' } },
};

function colunaDaEscolha(cfg, campo, boardId) {
  const coluna = cfg.colunas[String(boardId)] || cfg.colunas[Number(boardId)];
  if (!coluna) throw new Error(`O campo ${campo} não existe no quadro ${boardId}.`);
  return coluna;
}

async function trocarEscolha(sql, quem, { item, campo, para }) {
  const cfg = ESCOLHAS[campo];
  if (!cfg) throw new Error(`Campo desconhecido: ${campo}`);

  const linhas = await sql`SELECT id, board_id, monday_item_id, titulo, captacao_chave, prioridade_chave,
      off_audio_chave, formato_chaves, tipo_conteudo_chaves
    FROM vybe_conteudos WHERE (monday_item_id = ${String(item)} OR id = ${referenciaLocal(item)})`;
  if (!linhas.length) throw new Error(`Conteúdo ${item} não existe no banco.`);
  const c = linhas[0];
  // Só agora se sabe o quadro do item — e é o quadro que decide a coluna.
  const colunaDoCampo = colunaDaEscolha(cfg, campo, c.board_id);

  const chaves = (Array.isArray(para) ? para : [para]).map(String).filter(Boolean);
  const opcoes = cfg.catalogo === 'vybe_captacao'
    ? await sql`SELECT chave, rotulo, monday_index AS indice FROM vybe_captacao WHERE chave = ANY(${chaves})`
    : await sql`SELECT chave, rotulo, indice, so_vybe FROM vybe_opcoes
        WHERE coluna_id = ${colunaDoCampo} AND chave = ANY(${chaves})`;
  if (chaves.length && opcoes.length !== chaves.length) {
    throw new Error(`Opção desconhecida para ${campo}: ${chaves.join(', ')}`);
  }

  let de = null;
  if (campo === 'captacao') {
    de = c.captacao_chave;
    await sql`UPDATE vybe_conteudos SET captacao_chave=${chaves[0] || null},
        captacao=${opcoes[0]?.rotulo || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  } else if (campo === 'prioridade') {
    de = c.prioridade_chave;
    await sql`UPDATE vybe_conteudos SET prioridade_chave=${chaves[0] || null},
        prioridade=${opcoes[0]?.rotulo || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  } else if (campo === 'off_audio') {
    de = c.off_audio_chave;
    await sql`UPDATE vybe_conteudos SET off_audio_chave=${chaves[0] || null},
        off_audio=${opcoes[0]?.rotulo || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  } else if (campo === 'formato') {
    de = (c.formato_chaves || []).join(', ');
    await sql`UPDATE vybe_conteudos SET formato_chaves=${chaves},
        formato=${opcoes.map((o) => o.rotulo).join(', ') || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  } else {
    de = (c.tipo_conteudo_chaves || []).join(', ');
    await sql`UPDATE vybe_conteudos SET tipo_conteudo_chaves=${chaves},
        tipo_conteudo=${opcoes.map((o) => o.rotulo).join(', ') || null}, atualizado_em=NOW() WHERE id=${c.id}`;
  }

  await registrarEvento(sql, c.id, {
    tipo: campo, de, para: opcoes.map((o) => o.rotulo).join(', ') || null,
    autorId: await pessoaDaSessao(sql, quem),
  });

  // Opção criada só aqui não existe no Monday: mandar faria ele recusar com
  // "label doesn't exist". Pular e dizer é melhor que tentar e falhar.
  const soVybe = opcoes.some((o) => o.so_vybe);
  let replica = 'pulada: opção só existe na Vybe';
  if (!soVybe) {
    // Coluna de status vai por índice; dropdown vai por id da opção.
    const valor = cfg.multi
      ? { ids: opcoes.map((o) => Number(o.indice)) }
      : (opcoes[0] ? { index: Number(opcoes[0].indice) } : { index: null });
    replica = await replicar(sql, `escolha_${campo}`, `conteudo:${c.id}`,
      `mutation($board: ID!, $item: ID!, $values: JSON!) {
         change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
      { board: String(c.board_id), item: referenciaReplica(c, item),
        values: JSON.stringify({ [colunaDoCampo]: valor }) });
  }

  // Captação é gatilho de automação, como o status.
  let automacoes = [];
  if (cfg.gatilho) {
    try {
      const r = await aplicar(sql, c.id, { tipo: cfg.gatilho, de, para: chaves[0] || null });
      automacoes = r.aplicadas;
      await replicarNoMonday(sql, referenciaReplica(c, item), r.paraOMonday, c.board_id, c.id);
    } catch (erro) { console.error('Automações falharam após troca de escolha:', erro.message); }
  }

  return { conteudo_id: c.id, titulo: c.titulo, campo, de,
           para: opcoes.map((o) => o.rotulo).join(', ') || null, replica_monday: replica, automacoes };
}

async function criarConteudo(sql, quem, dados) {
  const { titulo, cliente, formato, prazo, veiculacao, status = 'a_fazer', grupo_id, briefing,
          tipo_conteudo = null, captacao = null, prioridade = null, responsaveis = [] } = dados;
  // O destino passa a ser escolhido por quem cadastra. Sem isto, tudo caía em
  // Produção — e Solicitações só recebia item criado dentro do Monday, o que
  // vira um beco sem saída no dia em que o Monday sair.
  const board = Number(dados.board) === BOARD_DEMANDAS_ID ? BOARD_DEMANDAS_ID : BOARD_PRODUCAO;
  const C = CRIACAO_POR_BOARD[board];
  const demanda = board === BOARD_DEMANDAS_ID;

  // Nossa coluna 'etapa' guarda o TÍTULO do grupo — é dela que a listagem tira o
  // campo 'grupo'. Não é a coluna "Tipo de conteúdo" do Monday, que é outra
  // coisa e é dropdown.
  const grupo = grupo_id || C.grupoPadrao;
  const etapa = GRUPO_TITULO[grupo] || null;
  if (!titulo || !cliente) throw new Error('Informe ao menos título e cliente.');

  const cli = (await sql`SELECT id, nome FROM vybe_clientes WHERE LOWER(nome)=LOWER(${String(cliente)})`)[0];
  if (!cli) throw new Error(`Cliente não cadastrado: ${cliente}`);
  // O status é procurado DENTRO do board: a chave é única por board, e 'feito'
  // existe nos dois com índices diferentes no Monday.
  const st = (await sql`SELECT chave, rotulo, monday_index FROM vybe_status
    WHERE chave=${String(status)} AND board_id=${board}`)[0];
  if (!st) throw new Error(`Status "${status}" não existe no board escolhido.`);

  const novo = (await sql`INSERT INTO vybe_conteudos
      (board_id, titulo, formato, clientes_texto, status_chave, etapa, grupo_id,
       prazo, veiculacao, briefing, prioridade, status_em)
    VALUES (${board}, ${titulo}, ${formato || null}, ${cli.nome}, ${st.chave}, ${etapa}, ${grupo},
            ${prazo || null}, ${veiculacao || null}, ${briefing || null}, ${prioridade || null}, NOW())
    RETURNING id`)[0];
  await sql`INSERT INTO vybe_conteudo_clientes (conteudo_id, cliente_id) VALUES (${novo.id}, ${cli.id})`;

  // Formato e tipo passam a viver como chave do catálogo; o rótulo sai dele.
  if (formato) {
    await sql`UPDATE vybe_conteudos c SET formato_chaves = (
        SELECT ARRAY_AGG(o.chave ORDER BY t.ord)
          FROM UNNEST(STRING_TO_ARRAY(${String(formato)}, ',')) WITH ORDINALITY AS t(parte, ord)
          JOIN vybe_opcoes o ON o.coluna_id=${C.formato} AND LOWER(o.rotulo)=LOWER(TRIM(t.parte)))
      WHERE c.id = ${novo.id}`;
  }
  if (prioridade && C.prioridade) {
    await sql`UPDATE vybe_conteudos c SET prioridade_chave = (
        SELECT o.chave FROM vybe_opcoes o
         WHERE o.coluna_id=${C.prioridade} AND LOWER(o.rotulo)=LOWER(${String(prioridade)}) LIMIT 1)
      WHERE c.id = ${novo.id}`;
  }
  if (tipo_conteudo && C.tipo) {
    await sql`UPDATE vybe_conteudos c SET tipo_conteudo_chaves = (
        SELECT ARRAY_AGG(o.chave) FROM vybe_opcoes o
         WHERE o.coluna_id=${C.tipo}
           AND (o.indice::text = ${String(tipo_conteudo)} OR LOWER(o.rotulo)=LOWER(${String(tipo_conteudo)})))
      WHERE c.id = ${novo.id}`;
  }
  if (captacao && C.captacao) await sql`UPDATE vybe_conteudos SET captacao=${String(captacao)} WHERE id=${novo.id}`;
  // Conteúdo que nasce sem dono some da fila de todo mundo.
  if (responsaveis.length) {
    await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem)
      SELECT ${novo.id}, p.id, o.ord - 1
        FROM UNNEST(${responsaveis.map(String)}::text[]) WITH ORDINALITY AS o(uid, ord)
        JOIN vybe_pessoas p ON p.monday_user_id = o.uid
      ON CONFLICT DO NOTHING`;
  }
  await registrarEvento(sql, novo.id, {
    tipo: 'criacao', para: titulo, autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  let mondayId = null;
  {
    const valores = {
      [C.cliente]: { labels: [cli.nome] },
      [C.status]: { index: Number(st.monday_index) },
    };
    if (formato) valores[C.formato] = { labels: String(formato).split(',').map((f) => f.trim()).filter(Boolean) };
    if (prazo) valores[C.prazo] = { date: prazo };
    if (veiculacao) valores[C.segundaData] = { date: veiculacao };
    if (prioridade && C.prioridade) valores[C.prioridade] = { label: String(prioridade) };
    // "Tipo de conteúdo" é dropdown: aceita ids ou labels, nunca index. Mandar
    // {index} faz o Monday aceitar a chamada e deixar a coluna vazia.
    if (tipo_conteudo && C.tipo) {
      valores[C.tipo] = Number.isFinite(Number(tipo_conteudo))
        ? { ids: [Number(tipo_conteudo)] }
        : { labels: [String(tipo_conteudo)] };
    }
    if (captacao && C.captacao) valores[C.captacao] = { label: String(captacao) };
    if (responsaveis.length) {
      valores[C.pessoas] = { personsAndTeams: responsaveis.map((id) => ({ id: Number(id), kind: 'person' })) };
    }
    // create_labels_if_missing porque os dois boards têm listas de cliente
    // diferentes — "Serra Grande" num, "Serra Grande Bebidas" no outro. Sem
    // isto, cadastrar em Demandas falharia a réplica em metade dos clientes.
    const query = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) {
      create_item(board_id: $board, group_id: $group, item_name: $name,
                  column_values: $values, create_labels_if_missing: true) { id } }`;
    const variables = { board: String(board), group: grupo, name: titulo, values: JSON.stringify(valores) };
    const r = await replicarOuEnfileirar(sql, mondayQuery, {
      operacao: 'criar_item', referencia: `conteudo:${novo.id}`, query, variables,
    });
    replica = r.estado === 'ok' ? 'ok' : `pendente: ${r.operation_key}`;
    mondayId = r.resposta?.create_item?.id || null;
    if (mondayId) await sql`UPDATE vybe_conteudos SET monday_item_id=${String(mondayId)} WHERE id=${novo.id}`;
  }
  return {
    conteudo_id: novo.id, titulo, cliente: cli.nome, board,
    destino: demanda ? 'Solicitações de Demandas' : 'Produção de Conteúdo',
    item_id: mondayId || `vybe:${novo.id}`, monday_item_id: mondayId, replica_monday: replica,
  };
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
  if (acao !== 'criar' && acao !== 'subitem' && !item) return res.status(400).json({ error: 'Informe o item.' });

  try {
    const sql = database();
    if (acao === 'status') {
      if (!corpo.para) return res.status(400).json({ error: 'Informe o status de destino.' });
      return res.status(200).json({ ok: true, acao, ...(await trocarStatus(sql, quem, { item, para: corpo.para })) });
    }
    if (acao === 'datas') {
      return res.status(200).json({ ok: true, acao,
        ...(await trocarDatas(sql, quem, { item, prazo: corpo.prazo, veiculacao: corpo.veiculacao })) });
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
    // Remover e mover entre boards são de quem administra: as duas tiram a peça
    // da vista de todo mundo, e por engano não têm desfazer imediato.
    if (acao === 'remover' || acao === 'restaurar' || acao === 'mover_board') {
      if (!(quem.tipo === 'servico' || quem.pessoa?.admin)) {
        return res.status(403).json({ error: 'Só quem administra remove ou move peças entre boards.' });
      }
      if (acao === 'remover') {
        return res.status(200).json({ ok: true, acao,
          ...(await removerConteudo(sql, quem, { item, motivo: corpo.motivo })) });
      }
      if (acao === 'restaurar') {
        return res.status(200).json({ ok: true, acao, ...(await restaurarConteudo(sql, quem, { item })) });
      }
      return res.status(200).json({ ok: true, acao,
        ...(await moverBoard(sql, quem, { item, destino: corpo.destino })) });
    }
    if (acao === 'titulo') {
      return res.status(200).json({ ok: true, acao,
        ...(await trocarTitulo(sql, quem, { item, titulo: corpo.titulo })) });
    }
    if (ESCOLHAS[acao]) {
      return res.status(200).json({ ok: true, acao,
        ...(await trocarEscolha(sql, quem, { item, campo: acao, para: corpo.para })) });
    }
    if (acao === 'grupo') {
      if (!corpo.grupo_id) return res.status(400).json({ error: 'Informe o grupo de destino.' });
      return res.status(200).json({ ok: true, acao,
        ...(await moverGrupo(sql, quem, { item, grupo_id: corpo.grupo_id })) });
    }
    if (acao === 'subitem') {
      return res.status(200).json({ ok: true, acao, ...(await mexerNoSubitem(sql, quem, corpo)) });
    }
    if (acao === 'criar') {
      return res.status(200).json({ ok: true, acao, ...(await criarConteudo(sql, quem, corpo)) });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${acao}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}

// ── subitens da solicitação ──────────────────────────────────────────────────
//
// Tarefas de dentro de uma demanda. Eram só de leitura: dava para ver a lista e
// não para mexer nela, então marcar uma como feita ainda obrigava a abrir o
// Monday — que é justamente o que estamos deixando de fazer.
//
// Grava no nosso banco primeiro e replica no board de subitens. O id do Monday
// só existe depois de criar lá, então a criação liga os dois em seguida.

const BOARD_SUBITENS_ID = 8385841526;
const COL_SUBITEM_STATUS = 'color_mm2ww3xs';

async function mexerNoSubitem(sql, quem, corpo) {
  const { operacao } = corpo;
  if (operacao === 'criar') return criarSubitem(sql, quem, corpo);

  const linhas = await sql`SELECT s.id, s.monday_item_id, s.titulo, s.status_chave, s.pai_id,
      c.monday_item_id AS pai_monday
    FROM vybe_subitens s JOIN vybe_conteudos c ON c.id = s.pai_id
   WHERE s.monday_item_id = ${String(corpo.subitem || '')}
      OR s.id = ${referenciaSubitemLocal(corpo.subitem)}
      OR s.id::text = ${String(corpo.subitem || '')}`;
  if (!linhas.length) throw new Error('Tarefa não encontrada.');
  const s = linhas[0];

  if (operacao === 'status') {
    const st = (await sql`SELECT chave, rotulo, monday_index FROM vybe_status
      WHERE chave=${String(corpo.para || '')} AND board_id=${BOARD_DEMANDAS_ID}`)[0];
    if (!st) throw new Error(`Status "${corpo.para}" não existe nas solicitações.`);
    if (s.status_chave === st.chave) return { subitem_id: s.id, replica_monday: 'sem mudança' };
    await sql`UPDATE vybe_subitens SET status_chave=${st.chave}, atualizado_em=NOW() WHERE id=${s.id}`;
    await registrarEvento(sql, s.pai_id, {
      tipo: 'subitem_status', de: s.status_chave, para: st.chave,
      autorId: await pessoaDaSessao(sql, quem), texto: s.titulo,
    });
    return { subitem_id: s.id, de: s.status_chave, para: st.chave, rotulo: st.rotulo,
      replica_monday: await replicarSubitem(sql, s.id, s.monday_item_id,
        { [COL_SUBITEM_STATUS]: { index: Number(st.monday_index) } }) };
  }

  if (operacao === 'titulo') {
    const novo = String(corpo.titulo || '').trim();
    if (!novo) throw new Error('O nome da tarefa não pode ficar vazio.');
    if (novo.length > 255) throw new Error('Nome muito longo.');
    if (novo === s.titulo) return { subitem_id: s.id, replica_monday: 'sem mudança' };
    await sql`UPDATE vybe_subitens SET titulo=${novo}, atualizado_em=NOW() WHERE id=${s.id}`;
    return { subitem_id: s.id, de: s.titulo, para: novo,
      replica_monday: await replicarSubitem(sql, s.id, s.monday_item_id, { name: novo }) };
  }

  if (operacao === 'remover') {
    await registrarEvento(sql, s.pai_id, {
      tipo: 'subitem_removido', de: s.titulo, autorId: await pessoaDaSessao(sql, quem),
    });
    let replica = 'não necessária: tarefa ainda não existia no Monday';
    if (s.monday_item_id) {
      replica = await replicar(sql, 'remover_subitem', `subitem:${s.id}`,
        `mutation($item: ID!) { delete_item(item_id: $item) { id } }`,
        { item: String(s.monday_item_id) });
    } else {
      await sql`UPDATE vybe_replica_queue SET estado='concluida',
        ultimo_erro='Cancelada: tarefa removida antes da criação da réplica', concluido_em=NOW(), atualizado_em=NOW()
        WHERE referencia=${`subitem:${s.id}`} AND operacao='criar_subitem' AND estado <> 'concluida'`;
    }
    await sql`DELETE FROM vybe_subitens WHERE id=${s.id}`;
    return { subitem_id: s.id, removida: s.titulo, replica_monday: replica };
  }

  throw new Error(`Operação desconhecida na tarefa: ${operacao}`);
}

async function criarSubitem(sql, quem, { item, titulo, status = 'nova_demanda' }) {
  const nome = String(titulo || '').trim();
  if (!nome) throw new Error('Informe o nome da tarefa.');

  const pai = (await sql`SELECT id, board_id, monday_item_id, titulo FROM vybe_conteudos
    WHERE (monday_item_id = ${String(item || '')} OR id = ${referenciaLocal(item)})`)[0];
  if (!pai) throw new Error('Solicitação não encontrada.');
  // Subitem é coisa do board de Demandas. Em Produção não existe onde pendurar.
  if (Number(pai.board_id) !== BOARD_DEMANDAS_ID) {
    throw new Error('Tarefas só existem dentro de uma solicitação de demanda.');
  }
  const st = (await sql`SELECT chave, monday_index FROM vybe_status
    WHERE chave=${String(status)} AND board_id=${BOARD_DEMANDAS_ID}`)[0];

  const ordem = Number((await sql`SELECT COALESCE(MAX(ordem), -1) + 1 AS n
    FROM vybe_subitens WHERE pai_id=${pai.id}`)[0].n);
  const novo = (await sql`INSERT INTO vybe_subitens (pai_id, titulo, status_chave, ordem)
    VALUES (${pai.id}, ${nome}, ${st?.chave || null}, ${ordem}) RETURNING id`)[0];
  await registrarEvento(sql, pai.id, {
    tipo: 'subitem_criado', para: nome, autorId: await pessoaDaSessao(sql, quem),
  });

  let replica = 'ok';
  let mondayId = null;
  {
    const valores = st ? { [COL_SUBITEM_STATUS]: { index: Number(st.monday_index) } } : {};
    const query = `mutation($pai: ID!, $nome: String!, $values: JSON!) {
      create_subitem(parent_item_id: $pai, item_name: $nome, column_values: $values) { id } }`;
    const variables = {
      pai: pai.monday_item_id ? String(pai.monday_item_id) : `vybe:${pai.id}`,
      nome,
      values: JSON.stringify(valores),
    };
    const r = await replicarOuEnfileirar(sql, mondayQuery, {
      operacao: 'criar_subitem', referencia: `subitem:${novo.id}`, query, variables,
    });
    replica = r.estado === 'ok' ? 'ok' : `pendente: ${r.operation_key}`;
    mondayId = r.resposta?.create_subitem?.id || null;
    if (mondayId) await sql`UPDATE vybe_subitens SET monday_item_id=${String(mondayId)} WHERE id=${novo.id}`;
  }
  return { subitem_id: novo.id, item_id: mondayId || `vybe-subitem:${novo.id}`, titulo: nome,
    monday_item_id: mondayId, replica_monday: replica };
}

async function replicarSubitem(sql, subitemId, mondayId, valores) {
  return replicar(sql, 'alterar_subitem', `subitem:${subitemId}`,
    `mutation($board: ID!, $item: ID!, $values: JSON!) {
       change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
    { board: String(BOARD_SUBITENS_ID), item: mondayId ? String(mondayId) : `vybe-subitem:${subitemId}`,
      values: JSON.stringify(valores) });
}
