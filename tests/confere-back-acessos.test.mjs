// Confere do back (14/11/2026): C1 (senha/acesso/saneamento só de dono), M4 (tentativas atômicas, limite por IP no login,
// sair encerra a sessão) e B2 (segredos comparados em tempo constante). SAFE: PGlite em memória, sessão assinada com um
// segredo fictício; nada vai ao Neon.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { usarBancoDaSessao, assinarSessao, sessaoDoPedido, autenticar, definirSenha } from '../vybe_sessao.js';
import { iguais, quemChama } from '../vybe_acesso.js';
import dominio from '../api/dominio.js';
import sessao, { LOGIN_POR_IP } from '../api/sessao.js';
import reconcile from '../api/mirror-reconcile.js';

const ENV = ['SESSAO_SECRET', 'MIRROR_ADMIN_KEY', 'CUTOVER_MIGRATION_KEY', 'VYBE_DONOS_IDS', 'VYBE_AI_ADMIN_PESSOA_ID', 'CRON_SECRET'];
const salvo = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
before(() => {
  for (const k of ENV) delete process.env[k];
  process.env.SESSAO_SECRET = 'segredo-ficticio-do-confere-back';
  process.env.MIRROR_ADMIN_KEY = 'chave-de-servico-ficticia';
  process.env.CRON_SECRET = 'cron-ficticio';
});
after(() => { for (const k of ENV) { if (salvo[k] === undefined) delete process.env[k]; else process.env[k] = salvo[k]; } usarBancoDaSessao(null); });

const resposta = () => ({ codigo: 0, body: null, cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, status(n) { this.codigo = n; return this; },
  json(d) { this.body = d; return this; }, end() { return this; } });
// Paulo (dono, Monday 68035537), Beatriz (coordenação, 71130408) e Jady (equipe).
async function banco(t) {
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, email text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true,
      monday_user_id text, foto_url text, ultimo_acesso timestamptz);
    INSERT INTO vybe_pessoas (id, nome, email, monday_user_id) VALUES (1,'Paulo','paulo@vybe.invalid','68035537'),
      (2,'Beatriz','bia@vybe.invalid','71130408'), (3,'Jady','jady@vybe.invalid',NULL);`);
  usarBancoDaSessao(sql);
  for (const e of ['paulo@vybe.invalid', 'bia@vybe.invalid', 'jady@vybe.invalid']) await definirSenha(e, 'senha-antiga-123');
  return { db, sql };
}
const cookieDe = async (sql, id) => {
  const [p] = await sql`SELECT id, nome, email, sessao_versao FROM vybe_pessoas WHERE id=${id}`;
  return `vybe_sessao=${encodeURIComponent(assinarSessao({ id: Number(p.id), nome: p.nome, email: p.email, versao: p.sessao_versao }))}`;
};
const pedir = async (handler, { metodo = 'POST', cookie = '', query = {}, body = {}, headers = {} } = {}) => {
  const r = resposta();
  await handler({ method: metodo, headers: { cookie, ...headers }, query, body, socket: { remoteAddress: '10.0.0.1' } }, r);
  return r;
};

test('C1: a coordenação não troca a senha nem bloqueia um dono por api/dominio; o dono troca', async (t) => {
  const { sql } = await banco(t);
  const bia = await cookieDe(sql, 2), paulo = await cookieDe(sql, 1);
  let r = await pedir(dominio, { cookie: bia, query: { action: 'senha' }, body: { email: 'paulo@vybe.invalid', senha: 'tomada-pela-coord' } });
  assert.equal(r.codigo, 403, JSON.stringify(r.body));
  await assert.doesNotReject(autenticar('paulo@vybe.invalid', 'senha-antiga-123'), 'a senha do dono continua a mesma');
  r = await pedir(dominio, { cookie: bia, query: { action: 'acesso' }, body: { email: 'paulo@vybe.invalid', pode: 'false' } });
  assert.equal(r.codigo, 403);
  r = await pedir(dominio, { cookie: bia, query: { action: 'sanear' } });
  assert.equal(r.codigo, 403);
  // A equipe nem administra: 401.
  assert.equal((await pedir(dominio, { cookie: await cookieDe(sql, 3), query: { action: 'senha' }, body: { email: 'paulo@vybe.invalid', senha: 'x'.repeat(10) } })).codigo, 401);
  // O dono troca a senha da coordenação e mexe no acesso.
  r = await pedir(dominio, { cookie: paulo, query: { action: 'senha' }, body: { email: 'bia@vybe.invalid', senha: 'nova-senha-da-bia' } });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  await assert.doesNotReject(autenticar('bia@vybe.invalid', 'nova-senha-da-bia'));
  r = await pedir(dominio, { cookie: await cookieDe(sql, 1), query: { action: 'acesso' }, body: { email: 'jady@vybe.invalid', pode: 'false' } });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.equal((await sql`SELECT pode_entrar FROM vybe_pessoas WHERE id=3`)[0].pode_entrar, false);
});

test('C1: chave e senha só no corpo/header; na query não valem', async (t) => {
  const { sql } = await banco(t);
  // Chave na query: não autoriza mais.
  let r = await pedir(dominio, { query: { action: 'senha', key: 'chave-de-servico-ficticia' }, body: { email: 'jady@vybe.invalid', senha: 'outra-senha-123' } });
  assert.equal(r.codigo, 401);
  // Chave no header, senha na query: ignorada (400), senha no corpo: troca.
  const auth = { authorization: 'Bearer chave-de-servico-ficticia' };
  r = await pedir(dominio, { headers: auth, query: { action: 'senha', email: 'jady@vybe.invalid', senha: 'outra-senha-123' } });
  assert.equal(r.codigo, 400);
  r = await pedir(dominio, { headers: auth, query: { action: 'senha' }, body: { email: 'jady@vybe.invalid', senha: 'outra-senha-123' } });
  assert.equal(r.codigo, 200);
  // Erro de regra volta com a mensagem; o resto, genérico.
  r = await pedir(dominio, { headers: auth, query: { action: 'senha' }, body: { email: 'ninguem@vybe.invalid', senha: 'outra-senha-123' } });
  assert.equal(r.codigo, 400); assert.match(r.body.error, /Ninguém cadastrado/);
  await sql`ALTER TABLE vybe_pessoas RENAME TO pessoas_fora`;
  usarBancoDaSessao(sql);
  r = await pedir(dominio, { headers: auth, query: { action: 'pessoas' } });
  assert.equal(r.codigo, 500); assert.doesNotMatch(r.body.error, /vybe_pessoas|relation|does not exist/i, 'a mensagem do banco não sai');
});

test('M4: tentativas erradas ao mesmo tempo somam todas e bloqueiam (UPDATE atômico)', async (t) => {
  const { sql } = await banco(t);
  const tentativas = await Promise.allSettled(Array.from({ length: 8 }, () => autenticar('jady@vybe.invalid', 'errada-errada')));
  assert.ok(tentativas.every((x) => x.status === 'rejected'));
  const [p] = await sql`SELECT tentativas, bloqueado_ate FROM vybe_pessoas WHERE id=3`;
  assert.equal(p.tentativas, 8, 'antes, cada tentativa sobrescrevia a outra com o mesmo número');
  assert.ok(p.bloqueado_ate && new Date(p.bloqueado_ate) > new Date());
  await assert.rejects(autenticar('jady@vybe.invalid', 'senha-antiga-123'), /Muitas tentativas/);
});

test('M4: limite por IP no login (429) e sair encerra a sessão (a versão sobe; o cookie antigo não vale)', async (t) => {
  const { sql } = await banco(t);
  const ip = { 'x-real-ip': '203.0.113.77' };
  for (let i = 0; i < LOGIN_POR_IP.max; i++) {
    const r = await pedir(sessao, { headers: ip, body: { email: `alguem${i}@vybe.invalid`, senha: 'qualquer-coisa' } });
    assert.equal(r.codigo, 401);
  }
  const bloqueado = await pedir(sessao, { headers: ip, body: { email: 'paulo@vybe.invalid', senha: 'senha-antiga-123' } });
  assert.equal(bloqueado.codigo, 429);
  // De outro IP entra normalmente.
  const ok = await pedir(sessao, { headers: { 'x-real-ip': '198.51.100.9' }, body: { email: 'paulo@vybe.invalid', senha: 'senha-antiga-123' } });
  assert.equal(ok.codigo, 200);
  const cookie = await cookieDe(sql, 1);
  assert.ok(await sessaoDoPedido({ headers: { cookie } }));
  const saiu = await pedir(sessao, { metodo: 'DELETE', cookie });
  assert.equal(saiu.codigo, 200);
  assert.equal(await sessaoDoPedido({ headers: { cookie } }), null, 'o mesmo cookie, guardado, não entra mais');
});

test('B2: chave de serviço e do cron comparadas em tempo constante, sem aceitar vazia nem prefixo', async () => {
  assert.equal(iguais('abc', 'abc'), true);
  assert.equal(iguais('abc', 'abcd'), false);
  assert.equal(iguais('', ''), false);
  assert.deepEqual(await quemChama({ headers: { authorization: 'Bearer chave-de-servico-ficticia' } }), { tipo: 'servico' });
  assert.equal(await quemChama({ headers: { authorization: 'Bearer chave-de-servico' } }), null);
  const r = resposta();
  await reconcile({ method: 'GET', headers: { authorization: 'Bearer cron-ficticio-errado' } }, r);
  assert.equal(r.codigo, 401);
});
