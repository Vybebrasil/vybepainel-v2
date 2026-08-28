// api/monday.js — fala direto com a API do Monday, com ponte para o painel v1.
//
// Antes este arquivo só repassava o corpo para vybepainel.vercel.app/api/monday (o
// painel v1), que era o único lugar onde o token existia. Isso mantinha um segundo
// deployment no caminho crítico: v1 fora do ar derrubava o v2 junto.
//
// Agora tentamos o Monday direto. Se o token estiver ausente OU inválido, caímos na
// ponte para o v1 em vez de devolver erro — assim a migração não pode causar queda.
// O header X-Vybe-Monday-Rota diz qual caminho atendeu, para dar para diagnosticar
// sem abrir o código:
//
//   direto    → MONDAY_TOKEN válido, o v1 já não é necessário
//   ponte-v1  → token ausente ou recusado; ainda dependemos do v1
//
// Quando a rota for "direto" de forma estável, o v1 pode ser desligado.

import { bloqueou } from '../vybe_acesso.js';

const MONDAY_GRAPHQL = 'https://api.monday.com/v2';
const MONDAY_ARQUIVOS = 'https://api.monday.com/v2/file';
const RELAY_V1 = 'https://vybepainel.vercel.app/api/monday';
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

  try {
    if (token) {
      const direto =
        corpo.action === 'upload_file_to_column'
          ? await anexarArquivo(corpo, token)
          : await consultarGraphQL(corpo, token);

      // 400 nosso (corpo malformado) não é problema de token: devolve como está.
      if (direto.local) return responder(res, 'direto', direto);
      if (!recusouToken(direto)) return responder(res, 'direto', direto);
    }

    return responder(res, 'ponte-v1', await repassarParaV1(corpo));
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}

function responder(res, rota, { status, dados }) {
  res.setHeader('X-Vybe-Monday-Rota', rota);
  return res.status(status).json(dados);
}

// O Monday devolve 401 com {"errors":["Not Authenticated"]} quando o token não presta.
function recusouToken({ status, dados }) {
  if (status === 401 || status === 403) return true;
  const erros = Array.isArray(dados?.errors) ? dados.errors : [];
  return erros.some((e) => /not authenticated|unauthorized/i.test(typeof e === 'string' ? e : e?.message || ''));
}

async function repassarParaV1(corpo) {
  const resposta = await fetch(RELAY_V1, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: resposta.status, dados: await resposta.json() };
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
