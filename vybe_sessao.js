// vybe_sessao.js — login por senha e sessão assinada.
//
// Sem serviço de e-mail: quem redefine senha é o administrador, manualmente.
// Foi decisão da Vybe, e para uma equipe de sete pessoas funciona.
//
// A senha nunca é guardada. Guardamos scrypt(senha, sal) — se o banco vazar, as
// senhas não vazam junto. A comparação é feita em tempo constante para não
// entregar informação pelo tempo de resposta.
//
// A sessão é um cookie assinado (HMAC), sem tabela de sessões: o próprio cookie
// carrega quem é e até quando vale, e a assinatura impede adulteração.

import { neon } from '@neondatabase/serverless';
import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const DIAS_DE_SESSAO = 30;
const TENTATIVAS_MAX = 8;
const JANELA_BLOQUEIO_MIN = 15;

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

// Chave de assinatura da sessão. Se SESSAO_SECRET não existir, cai na chave
// administrativa: não amplia risco (quem tem a chave admin já tem o banco
// inteiro) e evita mais uma variável para configurar antes de funcionar.
function segredoDeSessao() {
  const s = process.env.SESSAO_SECRET || process.env.MIRROR_ADMIN_KEY;
  if (!s) throw new Error('Defina SESSAO_SECRET para assinar as sessões.');
  return s;
}

export async function garantirSchemaSessao() {
  const sql = database();
  await sql`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS senha_hash TEXT`;
  await sql`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS senha_sal TEXT`;
  await sql`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS tentativas INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMPTZ`;
}

async function derivar(senha, salHex) {
  return Buffer.from(await scryptAsync(String(senha), Buffer.from(salHex, 'hex'), 64));
}

export async function definirSenha(email, senha, { admin = null } = {}) {
  if (!senha || String(senha).length < 8) {
    throw new Error('A senha precisa de pelo menos 8 caracteres.');
  }
  await garantirSchemaSessao();
  const sql = database();
  const sal = randomBytes(16).toString('hex');
  const hash = (await derivar(senha, sal)).toString('hex');
  const linhas = await sql`UPDATE vybe_pessoas
    SET senha_hash = ${hash}, senha_sal = ${sal}, pode_entrar = TRUE,
        tentativas = 0, bloqueado_ate = NULL,
        admin = COALESCE(${admin}::boolean, admin)
    WHERE LOWER(email) = LOWER(${String(email)})
    RETURNING id, nome, email, admin, pode_entrar`;
  if (!linhas.length) throw new Error(`Ninguém cadastrado com o e-mail ${email}.`);
  return linhas[0];
}

export async function autenticar(email, senha) {
  await garantirSchemaSessao();
  const sql = database();
  const linhas = await sql`SELECT id, nome, email, admin, pode_entrar, senha_hash, senha_sal,
      tentativas, bloqueado_ate
    FROM vybe_pessoas WHERE LOWER(email) = LOWER(${String(email || '')})`;
  const pessoa = linhas[0];

  // Mensagem única para e-mail inexistente e senha errada: dizer qual dos dois
  // falhou entrega a quem tenta adivinhar quais e-mails existem.
  const recusa = new Error('E-mail ou senha incorretos.');

  if (!pessoa || !pessoa.senha_hash || !pessoa.pode_entrar) throw recusa;
  if (pessoa.bloqueado_ate && new Date(pessoa.bloqueado_ate) > new Date()) {
    throw new Error('Muitas tentativas. Tente de novo em alguns minutos.');
  }

  const esperado = Buffer.from(pessoa.senha_hash, 'hex');
  const recebido = await derivar(senha || '', pessoa.senha_sal);
  const confere = esperado.length === recebido.length && timingSafeEqual(esperado, recebido);

  if (!confere) {
    const n = Number(pessoa.tentativas || 0) + 1;
    await sql`UPDATE vybe_pessoas SET tentativas = ${n},
        bloqueado_ate = CASE WHEN ${n} >= ${TENTATIVAS_MAX}
          THEN NOW() + (${JANELA_BLOQUEIO_MIN} || ' minutes')::interval ELSE bloqueado_ate END
      WHERE id = ${pessoa.id}`;
    throw recusa;
  }

  await sql`UPDATE vybe_pessoas SET tentativas = 0, bloqueado_ate = NULL, ultimo_acesso = NOW()
    WHERE id = ${pessoa.id}`;
  return { id: Number(pessoa.id), nome: pessoa.nome, email: pessoa.email, admin: Boolean(pessoa.admin) };
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const deB64 = (s) => Buffer.from(String(s), 'base64url').toString();

export function assinarSessao(pessoa) {
  const corpo = b64(JSON.stringify({
    id: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
    admin: pessoa.admin,
    exp: Date.now() + DIAS_DE_SESSAO * 24 * 60 * 60 * 1000,
  }));
  const assinatura = createHmac('sha256', segredoDeSessao()).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

export function lerSessao(token) {
  if (!token || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = createHmac('sha256', segredoDeSessao()).update(corpo).digest('base64url');
  const a = Buffer.from(assinatura || '');
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(deB64(corpo));
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

export function sessaoDoPedido(req) {
  const cookie = String(req.headers?.cookie || '');
  const achado = cookie.split(';').map((p) => p.trim()).find((p) => p.startsWith('vybe_sessao='));
  return achado ? lerSessao(decodeURIComponent(achado.slice('vybe_sessao='.length))) : null;
}

export function cabecalhoDeCookie(token) {
  const base = [`vybe_sessao=${encodeURIComponent(token || '')}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  base.push(token ? `Max-Age=${DIAS_DE_SESSAO * 24 * 60 * 60}` : 'Max-Age=0');
  return base.join('; ');
}

export async function listarPessoas() {
  await garantirSchemaSessao();
  const sql = database();
  return sql`SELECT nome, email, admin, pode_entrar,
      (senha_hash IS NOT NULL) AS tem_senha, ultimo_acesso
    FROM vybe_pessoas WHERE email IS NOT NULL
    ORDER BY pode_entrar DESC, admin DESC, nome`;
}
