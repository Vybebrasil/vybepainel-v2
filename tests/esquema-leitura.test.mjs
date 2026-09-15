import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { migrarEsquemaDeLeitura, garantirRecorte, garantirMaterialBruto } from '../vybe_dominio_store.js';
import { validaDesde } from '../api/conteudos.js';

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_conteudos (id int primary key, board_id bigint, prazo date,
      veiculacao date, removido_em timestamptz, atualizado_em timestamptz);
    CREATE TABLE vybe_clientes (id int primary key, ativo boolean);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id int, cliente_id int);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id int, pessoa_id int);
    CREATE TABLE vybe_conteudo_editores (conteudo_id int, pessoa_id int);
    CREATE TABLE vybe_conteudo_updates (conteudo_id int, corpo text);
    CREATE TABLE vybe_subitens (pai_id int, titulo text);
    CREATE TABLE vybe_status (chave text);
    CREATE TABLE vybe_opcoes (indice int);
    CREATE TABLE vybe_captacao (monday_index int);
    INSERT INTO vybe_conteudos VALUES (1, 7829537690, CURRENT_DATE, NULL, NULL, '2000-01-01');
  `);
  return { db, sql };
}
const novaConexao = (sql) => Object.assign((...a) => sql(...a), { query: sql.query });

test('falha na migração reverte também as colunas criadas antes do erro', async () => {
  const { db, sql } = await banco();
  try {
    await sql.query('DROP TABLE vybe_status');
    await assert.rejects(migrarEsquemaDeLeitura(sql));
    const [r] = await sql`SELECT COUNT(*)::int AS total FROM information_schema.columns
      WHERE table_name='vybe_conteudos' AND column_name='material_bruto'`;
    assert.equal(r.total, 0);
    await sql.query('CREATE TABLE vybe_status (chave text)');
    await migrarEsquemaDeLeitura(sql);
    await garantirRecorte(sql);
  } finally { await db.close(); }
});

test('leitura incompleta falha sem criar estrutura; migração explícita é repetível', async () => {
  const { db, sql } = await banco();
  try {
    await assert.rejects(garantirRecorte(sql), /db:migrate/);
    const [r] = await sql`SELECT to_regclass('public.vybe_conteudos_recorte') AS visao`;
    assert.equal(r.visao, null);
    await assert.rejects(garantirMaterialBruto(sql), /db:migrate/);
    await migrarEsquemaDeLeitura(sql);
    await migrarEsquemaDeLeitura(sql);
    await garantirRecorte(novaConexao(sql));
    await sql`INSERT INTO vybe_conteudo_responsaveis VALUES (1, 10)`;
    const [peca] = await sql`SELECT atualizado_em > '2000-01-01' AS atualizada FROM vybe_conteudos WHERE id=1`;
    assert.equal(peca.atualizada, true);
  } finally { await db.close(); }
});

test('um gatilho ausente, desativado ou ligado à função errada não passa na conferência', async () => {
  const { db, sql } = await banco();
  try {
    await migrarEsquemaDeLeitura(sql);
    await sql.query('DROP TRIGGER carimbo_de_mudanca ON vybe_subitens');
    const conferir = novaConexao(sql);
    await assert.rejects(garantirRecorte(conferir), /incompleto/);
    // A falha não preenche cache: a mesma conexão passa após o reparo.
    await migrarEsquemaDeLeitura(sql);
    await garantirRecorte(conferir);
    await sql.query('ALTER TABLE vybe_clientes DISABLE TRIGGER carimbo_de_mudanca');
    await assert.rejects(garantirRecorte(novaConexao(sql)), /incompleto/);
    await migrarEsquemaDeLeitura(sql);
    await sql.query('DROP TRIGGER carimbo_de_mudanca ON vybe_subitens');
    await sql.query(`CREATE TRIGGER carimbo_de_mudanca AFTER INSERT OR UPDATE OR DELETE
      ON vybe_subitens FOR EACH ROW EXECUTE FUNCTION vybe_carimba_pela_conteudo_id()`);
    await assert.rejects(garantirRecorte(novaConexao(sql)), /incompleto/);
  } finally { await db.close(); }
});

test('cache de prontidão de um banco não autoriza outro banco incompleto', async () => {
  const a = await banco(), b = await banco();
  try {
    await migrarEsquemaDeLeitura(a.sql);
    await garantirRecorte(a.sql);
    await assert.rejects(garantirRecorte(b.sql), /incompleto/);
    await assert.rejects(garantirMaterialBruto(b.sql), /ausentes/);
  } finally { await a.db.close(); await b.db.close(); }
});

test('cursor aceita ISO UTC válido e rejeita futuro, datas impossíveis e texto ambíguo', () => {
  const agora = Date.parse('2026-09-15T12:00:00.000Z');
  assert.equal(validaDesde('', agora), null);
  assert.equal(validaDesde('2026-09-15T12:00:00Z', agora), '2026-09-15T12:00:00.000Z');
  assert.equal(validaDesde('2026-09-15T11:59:59.12Z', agora), '2026-09-15T11:59:59.120Z');
  for (const valor of ['2026-09-15T12:00:00.001Z', '2026-02-30T12:00:00Z',
    '15/09/2026', '2026-09-15', 'amanhã', '2026-09-15T25:00:00Z']) {
    assert.equal(validaDesde(valor, agora), false, valor);
  }
});
