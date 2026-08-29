// api/monday.js — fala direto com a API do Monday.
//
// Este arquivo já repassou tudo para o painel v1, que era o único lugar onde o
// token existia — o que mantinha um segundo deployment no caminho crítico. Depois
// passou a falar direto, com o v1 como ponte de emergência.
//
// A ponte saiu junto com o desligamento do v1: um caminho de emergência que aponta
// para um projeto pausado não é rede, é armadilha — falharia devagar e com erro
// confuso em vez de dizer o que aconteceu.
//
// Sem token, o painel não para: ele lê do banco da Vybe e grava lá primeiro. O que
// deixa de funcionar é a réplica no Monday, que fica para trás e reconcilia.

import { bloqueou } from '../vybe_acesso.js';

const MONDAY_GRAPHQL = 'https://api.monday.com/v2';
const MONDAY_ARQUIVOS = 'https://api.monday.com/v2/file';
const VERSAO_API = '2024-01';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (bloqueou(req, res)) return;

  const token = process.env.MONDAY_TOKEN;
  const corpo = req.body || {};

  if (!token) {
    return res.status(503).json({
      error: 'MONDAY_TOKEN não configurado. O painel segue funcionando pelo banco da Vybe; '
           + 'só a réplica no Monday está fora.',
    });
  }

  try {
    const direto =
      corpo.action === 'upload_file_to_column'
        ? await anexarArquivo(corpo, token)
        : await consultarGraphQL(corpo, token);
    return responder(res, 'direto', direto);
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}

function responder(res, rota, { status, dados }) {
  res.setHeader('X-Vybe-Monday-Rota', rota);
  return res.status(status).json(dados);
}

async function consultarGraphQL({ query, variables }, token) {
  if (!query) return { local: true, status: 400, dados: { error: 'Nenhuma consulta foi enviada.' } };
  const resposta = await fetch(MONDAY_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': VERSAO_API,
    },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  return { status: resposta.status, dados: await resposta.json() };
}

// O Monday recebe arquivo por multipart, não por JSON — por isso o caminho separado.
async function anexarArquivo({ itemId, columnId, fileName, mimeType, fileBase64 }, token) {
  if (!itemId || !columnId || !fileBase64) {
    return { local: true, status: 400, dados: { error: 'Faltam item, coluna ou conteúdo do arquivo.' } };
  }

  const mutation =
    'mutation ($item: ID!, $column: String!, $file: File!) ' +
    '{ add_file_to_column(item_id: $item, column_id: $column, file: $file) { id } }';

  const form = new FormData();
  form.append('query', mutation);
  form.append('variables[item]', String(itemId));
  form.append('variables[column]', String(columnId));
  form.append('map', JSON.stringify({ arquivo: 'variables.file' }));
  form.append(
    'arquivo',
    new Blob([Buffer.from(fileBase64, 'base64')], { type: mimeType || 'application/octet-stream' }),
    fileName || 'arquivo'
  );

  const resposta = await fetch(MONDAY_ARQUIVOS, {
    method: 'POST',
    headers: { Authorization: token, 'API-Version': VERSAO_API },
    body: form,
  });
  return { status: resposta.status, dados: await resposta.json() };
}
