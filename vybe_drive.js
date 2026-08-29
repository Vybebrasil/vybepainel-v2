// vybe_drive.js — leva os arquivos de trabalho do Monday para o Drive da Vybe.
//
// Os anexos moram no S3 do Monday e a URL é assinada com uma hora de validade.
// Enquanto for assim, desligar o Monday quebra todo arquivo do painel. Aqui a
// cópia vai direto de lá para o Drive, sem passar pela máquina de ninguém.
//
// Precisa de duas coisas no ambiente:
//   GOOGLE_SERVICE_ACCOUNT  JSON da conta de serviço (client_email + private_key)
//   DRIVE_PASTA_RAIZ        id da pasta (ou do drive compartilhado) de destino
//
// A conta de serviço precisa estar como membro do drive compartilhado. Conta de
// serviço não tem espaço próprio: sem isso o upload é recusado por cota.

import { createSign } from 'node:crypto';

const ESCOPO = 'https://www.googleapis.com/auth/drive';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function credenciais() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!bruto) throw new Error('GOOGLE_SERVICE_ACCOUNT não configurada.');
  const c = JSON.parse(bruto);
  if (!c.client_email || !c.private_key) throw new Error('Credencial sem client_email ou private_key.');
  // Colar JSON no painel da Vercel costuma trocar quebra de linha por \n literal.
  c.private_key = String(c.private_key).replace(/\\n/g, '\n');
  return c;
}

const base64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let tokenCache = { valor: null, expira: 0 };

async function token() {
  if (tokenCache.valor && Date.now() < tokenCache.expira - 60_000) return tokenCache.valor;
  const c = credenciais();
  const agora = Math.floor(Date.now() / 1000);
  const cabeca = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64url(JSON.stringify({
    iss: c.client_email, scope: ESCOPO, aud: TOKEN_URL, iat: agora, exp: agora + 3600,
  }));
  const assinatura = base64url(createSign('RSA-SHA256').update(`${cabeca}.${corpo}`).sign(c.private_key));

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabeca}.${corpo}.${assinatura}`,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Google recusou a credencial: ${d.error_description || d.error || r.status}`);
  tokenCache = { valor: d.access_token, expira: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function drive(caminho, opcoes = {}) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${await token()}`, ...(opcoes.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Drive ${r.status}: ${d?.error?.message || 'falhou'}`);
  return d;
}

// Cria a pasta se não existir. O caminho é a estrutura que a Vybe já usa:
// Cliente / Social Media / ano / mês / dia.
const pastaCache = new Map();

async function pasta(nome, paiId) {
  const chave = `${paiId}/${nome}`;
  if (pastaCache.has(chave)) return pastaCache.get(chave);

  const q = encodeURIComponent(
    `name = '${String(nome).replace(/'/g, "\\'")}' and '${paiId}' in parents ` +
    `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const achado = await drive(`files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  let id = achado.files?.[0]?.id;

  if (!id) {
    const nova = await drive('files?supportsAllDrives=true&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [paiId] }),
    });
    id = nova.id;
  }
  pastaCache.set(chave, id);
  return id;
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

export async function pastaDoConteudo({ cliente, data }) {
  const raiz = process.env.DRIVE_PASTA_RAIZ;
  if (!raiz) throw new Error('DRIVE_PASTA_RAIZ não configurada.');
  const d = data ? new Date(`${String(data).slice(0, 10)}T12:00:00Z`) : new Date();
  let id = await pasta(cliente || 'Sem cliente', raiz);
  id = await pasta('Social Media', id);
  id = await pasta(String(d.getUTCFullYear()), id);
  id = await pasta(`${String(d.getUTCMonth() + 1).padStart(2, '0')} · ${MESES[d.getUTCMonth()]}`, id);
  return pasta(String(d.getUTCDate()).padStart(2, '0'), id);
}

// Copia um arquivo da URL assinada do Monday direto para o Drive.
export async function enviarParaDrive({ url, nome, mime, pastaId }) {
  const origem = await fetch(url);
  if (!origem.ok) throw new Error(`Monday recusou o arquivo (${origem.status}).`);
  const bytes = Buffer.from(await origem.arrayBuffer());

  const limite = '-----vybe' + Date.now();
  const meta = JSON.stringify({ name: nome, parents: [pastaId] });
  const corpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${limite}\r\nContent-Type: ${mime || 'application/octet-stream'}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);

  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,webContentLink',
    { method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': `multipart/related; boundary=${limite}` },
      body: corpo }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Drive recusou o envio: ${d?.error?.message || r.status}`);
  return { id: d.id, link: d.webViewLink, bytes: bytes.length };
}

// Confere a credencial sem enviar nada — para saber se está tudo no lugar antes
// de mexer em arquivo de verdade.
export async function conferirDrive() {
  const c = credenciais();
  const raiz = process.env.DRIVE_PASTA_RAIZ;
  if (!raiz) throw new Error('DRIVE_PASTA_RAIZ não configurada.');

  // O Google responde 404 tanto para "não existe" quanto para "você não pode
  // ver" — então checar só um caminho não diz qual dos dois é. Id começando com
  // 0A é drive compartilhado inteiro, que se consulta por outro endereço.
  const tentativas = [];

  try {
    const info = await drive(`files/${raiz}?fields=id,name,mimeType,driveId&supportsAllDrives=true`);
    return { conta: c.client_email, tipo: 'pasta', nome: info.name, id: info.id, drive_id: info.driveId || null };
  } catch (erro) { tentativas.push(`como pasta: ${erro.message}`); }

  try {
    const d = await drive(`drives/${raiz}?fields=id,name`);
    return { conta: c.client_email, tipo: 'drive compartilhado', nome: d.name, id: d.id, drive_id: d.id };
  } catch (erro) { tentativas.push(`como drive compartilhado: ${erro.message}`); }

  // Se a conta enxerga algum drive, o problema é o id. Se não enxerga nenhum,
  // ela não foi adicionada como membro em lugar nenhum.
  let visiveis = [];
  try {
    const lista = await drive('drives?pageSize=10&fields=drives(id,name)');
    visiveis = (lista.drives || []).map((d) => ({ id: d.id, nome: d.name }));
  } catch { /* sem permissão nem para listar */ }

  const dica = visiveis.length
    ? `A conta enxerga ${visiveis.length} drive(s), então o id está errado. Use um destes.`
    : 'A conta não enxerga nenhum drive: ela ainda não foi adicionada como membro. '
      + 'Abra o drive compartilhado, "Gerenciar membros", e adicione o e-mail como Colaborador/Editor.';

  throw new Error(`${dica} | conta: ${c.client_email} | ${tentativas.join(' | ')} | visíveis: ${JSON.stringify(visiveis)}`);
}
