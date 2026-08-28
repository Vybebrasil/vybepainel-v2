// api/monday.js — fala direto com a API do Monday.
//
// Antes este arquivo repassava tudo para vybepainel.vercel.app/api/monday (o painel v1),
// que era o único lugar onde o token existia. Isso colocava um segundo deployment no
// caminho crítico: se o v1 caísse, o v2 parava junto.
//
// Agora: se MONDAY_TOKEN estiver definido nas variáveis do projeto, chamamos o Monday
// direto. Se não estiver, continuamos repassando para o v1 — a ponte some sozinha no
// momento em que a variável for criada, sem precisar de deploy novo.

const MONDAY_GRAPHQL = 'https://api.monday.com/v2';
const MONDAY_ARQUIVOS = 'https://api.monday.com/v2/file';
const RELAY_V1 = 'https://vybepainel.vercel.app/api/monday';
const VERSAO_API = '2024-01';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const token = process.env.MONDAY_TOKEN;
  const corpo = req.body || {};

  try {
    if (!token) return await repassarParaV1(corpo, res);
    if (corpo.action === 'upload_file_to_column') return await anexarArquivo(corpo, token, res);
    return await consultarGraphQL(corpo, token, res);
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}

// Ponte temporária: vale só enquanto MONDAY_TOKEN não existir neste projeto.
async function repassarParaV1(corpo, res) {
  const resposta = await fetch(RELAY_V1, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  return res.status(resposta.status).json(dados);
}

async function consultarGraphQL({ query, variables }, token, res) {
  if (!query) return res.status(400).json({ error: 'Nenhuma consulta foi enviada.' });
  const resposta = await fetch(MONDAY_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': VERSAO_API,
    },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const dados = await resposta.json();
  return res.status(resposta.status).json(dados);
}

// O Monday recebe arquivo por multipart, não por JSON — por isso este caminho é separado.
async function anexarArquivo({ itemId, columnId, fileName, mimeType, fileBase64 }, token, res) {
  if (!itemId || !columnId || !fileBase64) {
    return res.status(400).json({ error: 'Faltam item, coluna ou conteúdo do arquivo.' });
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
  const dados = await resposta.json();
  return res.status(resposta.status).json(dados);
}
