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

// O drive da agência já tem as pastas de cliente, com nomes que nem sempre são
// os do Monday. Criar por nome exato encheria o drive de pastas duplicadas ao
// lado das que já existem.
function semSinais(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Onde o nome no Monday e o nome no Drive divergem de verdade — não é diferença
// de acento ou espaço, é outro nome para o mesmo cliente.
const ALIAS_CLIENTE = {
  'serragrandebebidas': 'Grupo Serra Grande',
  'hellenrocha': 'Hellen Rocha - Advogada',
  'academialions': 'Academia LionsTop',
};

// Cria a pasta se não existir. O caminho é a estrutura que a Vybe já usa:
// Cliente / Social Media / ano / mês / dia.
const pastaCache = new Map();

async function pasta(nome, paiId) {
  const chave = `${paiId}/${semSinais(nome)}`;
  if (pastaCache.has(chave)) return pastaCache.get(chave);

  // Lista e compara ignorando acento, espaço e maiúscula: 'DiaCenter' no Monday
  // é a pasta 'Dia Center' no Drive, e busca por nome exato não acharia.
  const q = encodeURIComponent(
    `'${paiId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const filhas = await drive(
    `files?q=${q}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  const alvo = semSinais(nome);
  let id = (filhas.files || []).find((f) => semSinais(f.name) === alvo)?.id;

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

// Um caminho qualquer dentro do drive, criando o que faltar. Foto de equipe não
// tem cliente nem data, então não cabe na estrutura de conteúdo.
export async function pastaSimples(caminho = []) {
  const raiz = process.env.DRIVE_PASTA_RAIZ;
  if (!raiz) throw new Error('DRIVE_PASTA_RAIZ não configurada.');
  let id = raiz;
  for (const parte of caminho) id = await pasta(String(parte), id);
  return id;
}

export async function pastaDoConteudo({ cliente, data }) {
  const raiz = process.env.DRIVE_PASTA_RAIZ;
  if (!raiz) throw new Error('DRIVE_PASTA_RAIZ não configurada.');
  // O banco devolve DATE como objeto de data, não como texto: String() nele dá
  // "Fri Aug 29 2026 ..." e o slice(0,10) virava lixo. Aceita os dois.
  const iso = data instanceof Date
    ? data.toISOString().slice(0, 10)
    : String(data || '').slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida para montar a pasta: ${data}`);
  const nomeCliente = ALIAS_CLIENTE[semSinais(cliente)] || cliente || 'Sem cliente';
  let id = await pasta(nomeCliente, raiz);
  id = await pasta('Social Media', id);
  id = await pasta(String(d.getUTCFullYear()), id);
  id = await pasta(`${String(d.getUTCMonth() + 1).padStart(2, '0')} · ${MESES[d.getUTCMonth()]}`, id);
  return pasta(String(d.getUTCDate()).padStart(2, '0'), id);
}

// Copia um arquivo da URL assinada do Monday direto para o Drive.
// Abre uma sessão de envio direto no Drive e devolve o endereço dela.
//
// O caminho normal manda o arquivo em base64 dentro do JSON para a nossa função,
// que repassa ao Drive. Isso funciona para arquivo pequeno e esbarra num teto que
// não é do Drive nem nosso: a função serverless aceita cerca de 4,5 MB por
// chamada, e base64 engorda o arquivo em um terço. Dava três megas de teto para
// um destino que aceita gigabytes.
//
// Com a sessão, o navegador envia os bytes DIRETO para o Google. A credencial
// continua só aqui no servidor — o que vai para a tela é um endereço de sessão,
// que serve para um envio só e caduca sozinho.
export async function iniciarUploadNoDrive({ nome, mime, pastaId }) {
  const r = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink',
    { method: 'POST',
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime || 'application/octet-stream',
      },
      body: JSON.stringify({ name: nome, parents: [pastaId] }) }
  );
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`Drive recusou abrir o envio: ${d?.error?.message || r.status}`);
  }
  const sessao = r.headers.get('location');
  if (!sessao) throw new Error('Drive não devolveu o endereço da sessão de envio.');
  return sessao;
}

// Um pedaco do arquivo dentro de uma sessao ja aberta.
//
// O navegador nao consegue falar direto com o endereco da sessao: ela e criada
// aqui, sem cabecalho de origem, e o Google entao recusa o envio vindo de outra
// origem — "Failed to fetch" na tela. Entao os bytes voltam a passar por nos, so
// que fatiados: cada pedaco cabe folgado no limite da funcao, e o arquivo
// inteiro deixa de ter teto.
//
// O Content-Range diz ao Google onde aquele pedaco entra. Ele responde 308
// enquanto falta coisa e 200 quando o arquivo fecha — so no fim vem o id.
export async function enviarParteNoDrive({ sessao, conteudo, inicio, total }) {
  const bytes = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(String(conteudo), 'base64');
  const fim = inicio + bytes.length - 1;
  const r = await fetch(sessao, {
    method: 'PUT',
    headers: { 'Content-Length': String(bytes.length), 'Content-Range': `bytes ${inicio}-${fim}/${total}` },
    body: bytes,
  });
  if (r.status === 308) return { concluido: false, recebido: fim + 1 };
  if (!r.ok) {
    const d = await r.text().catch(() => '');
    throw new Error(`Drive recusou o pedaço (${r.status}) ${String(d).slice(0, 120)}`);
  }
  const d = await r.json().catch(() => ({}));
  return { concluido: true, id: d.id, link: d.webViewLink, bytes: total };
}

export async function enviarParaDrive({ url, conteudo, nome, mime, pastaId }) {
  // Ou copia de uma URL (migração do Monday) ou recebe o arquivo direto (upload
  // pelo painel). O resto do caminho é o mesmo.
  let bytes;
  if (conteudo) {
    bytes = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(String(conteudo), 'base64');
  } else {
    const origem = await fetch(url);
    if (!origem.ok) throw new Error(`Não foi possível ler o arquivo de origem (${origem.status}).`);
    bytes = Buffer.from(await origem.arrayBuffer());
  }

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

// Deixa o arquivo legível por quem tiver o link. Serve para foto de perfil: o
// navegador de quem abre o painel não está logado no Drive, e sem isso o Google
// devolve uma página de permissão no lugar da imagem.
//
// As fotos de hoje já são públicas — moram em files.monday.com e abrem sem login.
// Isso não amplia exposição, só troca de casa.
export async function tornarPublico(fileId) {
  await drive(`files/${fileId}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  return true;
}

// Move para a lixeira do Drive, em vez de apagar definitivamente. A remoção do
// painel fica reversível e não depende da coluna de arquivos do Monday.
export async function arquivarNoDrive(fileId) {
  if (!fileId) throw new Error('Arquivo do Drive não informado.');
  await drive(`files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  return true;
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
