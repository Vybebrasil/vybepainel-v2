// Acabamento do back (15/11/2026): itens 39 a 42 da auditoria premium. Erro do banco não vaza para a tela (notas, grupos,
// conteúdo); a DDL do Diário roda uma vez por banco; o POST do Diário sem ação é de dono, de quem administra ou do
// serviço; área desconhecida não lista as áreas; o mapa etapa → grupo do histórico fica em memória por 60 s.
// SAFE: PGlite em memória e sessão assinada com segredo fictício; nada vai ao Neon nem ao WhatsApp.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { usarBancoDaSessao, assinarSessao, definirSenha } from '../vybe_sessao.js';
import handler, { usarBancoDoPainel } from '../api/painel.js';
import { garantirObservabilidade } from '../vybe_observabilidade.js';
import { falhaDeRegra } from '../server/falha-interna.js';

const ENV = ['SESSAO_SECRET', 'MIRROR_ADMIN_KEY', 'CUTOVER_MIGRATION_KEY', 'VYBE_DONOS_IDS'];
const salvo = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
before(() => {
  for (const k of ENV) delete process.env[k];
  process.env.SESSAO_SECRET = 'segredo-ficticio-do-acabamento';
  process.env.MIRROR_ADMIN_KEY = 'chave-de-servico-do-acabamento';
});
after(() => { for (const k of ENV) { if (salvo[k] === undefined) delete process.env[k]; else process.env[k] = salvo[k]; } usarBancoDaSessao(null); usarBancoDoPainel(null); });

const servico = { authorization: 'Bearer chave-de-servico-do-acabamento' };
const resposta = () => ({ codigo: 0, body: null, cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, status(n) { this.codigo = n; return this; },
  json(d) { this.body = d; return this; }, end() { return this; } });
const pedir = async ({ metodo = 'GET', cookie = '', headers = {}, query = {}, body = {} } = {}) => {
  const r = resposta();
  await handler({ method: metodo, headers: { cookie, ...headers }, query, body, socket: { remoteAddress: '10.0.0.9' } }, r);
  return r;
};

// Paulo (dono, Monday 68035537) e Jady (equipe, sem admin).
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, email text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true,
      monday_user_id text, foto_url text, ultimo_acesso timestamptz);
    INSERT INTO vybe_pessoas (id, nome, email, monday_user_id) VALUES (1,'Paulo','paulo@vybe.invalid','68035537'), (3,'Jady','jady@vybe.invalid',NULL);`);
  usarBancoDaSessao(sql); usarBancoDoPainel(() => sql);
  for (const e of ['paulo@vybe.invalid', 'jady@vybe.invalid']) await definirSenha(e, 'senha-ficticia-123');
  const cookieDe = async (id) => {
    const [p] = await sql`SELECT id, nome, email, sessao_versao FROM vybe_pessoas WHERE id=${id}`;
    return `vybe_sessao=${encodeURIComponent(assinarSessao({ id: Number(p.id), nome: p.nome, email: p.email, versao: p.sessao_versao }))}`;
  };
  return { db, sql, cookieDe };
}

test('42: área desconhecida responde "Área inválida." sem listar as áreas do servidor', async (t) => {
  await banco(t);
  const r = await pedir({ headers: servico, query: { area: 'nao-existe' } });
  assert.equal(r.codigo, 400);
  assert.deepEqual(r.body, { error: 'Área inválida.' });
});

test('41: registrar o Diário (POST sem ação) é de dono, de quem administra ou do serviço; a equipe recebe 403', async (t) => {
  const { cookieDe } = await banco(t);
  const jady = await pedir({ metodo: 'POST', cookie: await cookieDe(3), query: { area: 'diario' } });
  assert.equal(jady.codigo, 403);
  assert.match(jady.body.error, /donos e quem administra/);
  // O dono passa da porta (o retrato em si depende das tabelas da operação, que este banco não tem).
  const paulo = await pedir({ metodo: 'POST', cookie: await cookieDe(1), query: { area: 'diario' } });
  assert.notEqual(paulo.codigo, 403);
  const robo = await pedir({ metodo: 'POST', headers: servico, query: { area: 'diario' } });
  assert.notEqual(robo.codigo, 403);
  // Falha do banco não sai crua (antes ia a mensagem do Postgres no 500).
  assert.doesNotMatch(JSON.stringify([paulo.body, robo.body]), /relation|does not exist|vybe_/);
});

test('41: base_resumo que falha no banco sai 500 genérico (antes era 400 para qualquer falha)', async (t) => {
  await banco(t);
  usarBancoDoPainel(() => { const s = () => Promise.reject(Object.assign(new Error('relation "vybe_operational_snapshots" does not exist'), { code: '42P01' })); s.query = s; return s; });
  const r = await pedir({ headers: servico, query: { area: 'diario', base_resumo: '2026-11-14' } });
  assert.equal(r.codigo, 500);
  assert.doesNotMatch(r.body.error, /relation|vybe_/);
});

test('40: as tabelas do Diário são conferidas uma vez por banco; se a conferência falha, a próxima tenta de novo', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  let ddl = 0, quebrar = true;
  const contado = (parts, ...params) => { if (/CREATE (TABLE|INDEX)/.test(parts.join(''))) { ddl++; if (quebrar) { quebrar = false; return Promise.reject(new Error('banco fora')); } } return sql(parts, ...params); };
  await assert.rejects(garantirObservabilidade(contado), /banco fora/);
  await garantirObservabilidade(contado);
  const depois = ddl;
  await garantirObservabilidade(contado); await garantirObservabilidade(contado);
  assert.equal(ddl, depois, 'a terceira e a quarta chamada não repetem o CREATE');
  const [{ existe }] = await sql`SELECT to_regclass('public.vybe_operational_snapshots') IS NOT NULL AS existe`;
  assert.equal(existe, true);
});

test('42: o mapa etapa → grupo do histórico é lido uma vez em 60 s (os eventos continuam frescos)', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(`CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, monday_item_id text, etapa text, grupo_id text);
    CREATE TABLE vybe_conteudo_eventos (id serial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, em timestamptz DEFAULT now());
    INSERT INTO vybe_conteudos VALUES (100, NULL, 'Em produção', 'g1');
    INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para) VALUES (100, 'status', 'A', 'B');`);
  let distintos = 0;
  const contado = (parts, ...params) => { if (/SELECT DISTINCT etapa/.test(parts.join(''))) distintos++; return sql(parts, ...params); };
  contado.query = sql.query;
  usarBancoDoPainel(() => contado);
  const a = await pedir({ headers: servico, query: { area: 'historico' } });
  await db.exec(`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para) VALUES (100, 'status', 'B', 'C');`);
  const b = await pedir({ headers: servico, query: { area: 'historico' } });
  assert.equal(a.codigo, 200, JSON.stringify(a.body)); assert.equal(b.codigo, 200);
  assert.equal(distintos, 1, 'a segunda chamada usa o mapa guardado');
  assert.equal(a.body.logs.statusEvents['vybe:100'].length, 1);
  assert.equal(b.body.logs.statusEvents['vybe:100'].length, 2, 'o evento novo aparece na hora');
});

test('39: notas e grupos — regra mantém a frase (4xx); erro do banco vira 500 genérico; sem tabela, frase curta', async (t) => {
  const { db, cookieDe } = await banco(t);
  const paulo = await cookieDe(1);
  // Sem a tabela das notas: frase curta, sem "Conferir estrutura do banco".
  let r = await pedir({ cookie: paulo, query: { area: 'notas' } });
  assert.equal(r.codigo, 409); assert.equal(r.body.error, 'Esta parte ainda está sendo ligada.');
  await db.exec(`CREATE TABLE vybe_notas (id serial PRIMARY KEY, pessoa_id bigint, titulo text, corpo text, item_ref text, caderno text,
    criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());`);
  r = await pedir({ metodo: 'POST', cookie: paulo, query: { area: 'notas' }, body: { titulo: '', corpo: '' } });
  assert.equal(r.codigo, 400); assert.equal(r.body.error, 'Escreva algo antes de salvar a nota.');
  await db.exec('ALTER TABLE vybe_notas DROP COLUMN caderno');
  r = await pedir({ metodo: 'POST', cookie: paulo, query: { area: 'notas' }, body: { titulo: 'Oi', corpo: 'x' } });
  assert.equal(r.codigo, 500); assert.doesNotMatch(r.body.error, /caderno|column|vybe_/);
  // Grupos: sem a tabela, a criação recusa com a frase curta (409); a ação desconhecida continua 400.
  r = await pedir({ metodo: 'POST', headers: servico, query: { area: 'grupos' }, body: { acao: 'criar', board: 8385559107, titulo: 'Orçamento' } });
  assert.equal(r.codigo, 409); assert.equal(r.body.error, 'Esta parte ainda está sendo ligada.');
});

test('39: falhaDeRegra — regra sem status vira 400; 503 de "sendo ligada" fica; erro do banco sai genérico', () => {
  let r = resposta(); falhaDeRegra(r, 'teste', new Error('Escreva algo antes de salvar.'));
  assert.deepEqual([r.codigo, r.body.error], [400, 'Escreva algo antes de salvar.']);
  r = resposta(); falhaDeRegra(r, 'teste', Object.assign(new Error('Esta parte ainda está sendo ligada.'), { status: 503 }));
  assert.deepEqual([r.codigo, r.body.error], [503, 'Esta parte ainda está sendo ligada.']);
  r = resposta(); falhaDeRegra(r, 'teste', Object.assign(new Error('column "x" does not exist'), { code: '42703' }));
  assert.equal(r.codigo, 500); assert.doesNotMatch(r.body.error, /column/);
  r = resposta(); falhaDeRegra(r, 'teste', new TypeError('fetch failed'));
  assert.equal(r.codigo, 500);
});
