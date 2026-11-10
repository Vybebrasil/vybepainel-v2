// Aprovações paradas (server/aprovacoes.js): cada head vê a carteira dele, os sócios veem tudo e o diretor de arte vê
// toda peça "Para aprovação"; o atraso conta 24 h na interna e 48 h com o cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { aprovacoesDaPessoa, atrasado } from '../server/aprovacoes.js';

const AGORA = new Date('2026-11-10T12:00:00Z');
const horasAtras = (h) => new Date(AGORA.getTime() - h * 36e5).toISOString();

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_clientes (id bigint primary key, nome text, ativo boolean default true, apagado_em timestamptz);
    CREATE TABLE vybe_pessoas (id bigint primary key, nome text, monday_user_id text);
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int default 0);
    CREATE TABLE vybe_planejamentos (id bigserial primary key, cliente_id bigint, mes date, titulo text, estado text, versao int default 1,
      origem text default 'agente', conteudo jsonb default '{}', atualizado_em timestamptz, enviado_em timestamptz, respondido_em timestamptz);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean default false);
    CREATE TABLE vybe_conteudos (id bigserial primary key, monday_item_id bigint, board_id bigint, titulo text, formato text, status_chave text,
      status_em timestamptz, veiculacao date, prazo date, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_clientes (id, nome) VALUES (1, 'Academia Lions'), (2, 'VOA');
    INSERT INTO vybe_pessoas VALUES (10, 'Vinícius Damascena', '68035653'), (11, 'Ewerton Luis', '68036687'), (12, 'Deivid Souza', '68997024'), (13, 'Jady Oliveira', '999');
    INSERT INTO vybe_cliente_pessoas VALUES (1, 10, 0), (2, 11, 0);
    INSERT INTO vybe_status VALUES (7829537690, 'para_aprovacao', 'Para aprovação'), (7829537690, 'ag_aprovacao_cliente', 'Ag. Aprovação Cliente');`);
  await sql`INSERT INTO vybe_planejamentos (cliente_id, mes, titulo, estado, atualizado_em, conteudo) VALUES
    (1, '2026-12-01', 'Dezembro Lions', 'revisar', ${horasAtras(30)}, '{"pecas":[{},{},{}]}'),
    (2, '2026-12-01', 'Dezembro VOA', 'enviado', ${horasAtras(10)}, '{}')`;
  await sql`UPDATE vybe_planejamentos SET enviado_em = ${horasAtras(60)} WHERE estado = 'enviado'`;
  await sql`INSERT INTO vybe_conteudos (id, board_id, titulo, formato, status_chave, status_em) VALUES
    (100, 7829537690, 'Card - Promo', 'Card', 'para_aprovacao', ${horasAtras(5)}),
    (101, 7829537690, 'Reels - Treino', 'Reels', 'ag_aprovacao_cliente', ${horasAtras(50)})`;
  await sql`INSERT INTO vybe_conteudo_clientes VALUES (100, 2), (101, 1)`;
  return { db, sql };
}

test('head vê só a carteira dele; o planejamento parado 30 h está atrasado', async () => {
  const { db, sql } = await banco();
  try {
    const v = await aprovacoesDaPessoa(sql, { id: 10, monday_user_id: '999' }, { env: {}, agora: AGORA });
    assert.deepEqual(v.planejamentos.map((p) => [p.cliente, p.etapa, p.horas, p.pecas]), [['Academia Lions', 'interna', 30, 3]]);
    assert.deepEqual(v.pecas.map((p) => [p.titulo, p.etapa]), [['Reels - Treino', 'cliente']]);
    assert.ok(atrasado(v.planejamentos[0]));
    assert.ok(atrasado(v.pecas[0]));
    assert.equal(v.planejamentos[0].heads[0].nome, 'Vinícius');
  } finally { await db.close(); }
});

test('sócio vê a agência inteira, com "meu" marcando a carteira dele', async () => {
  const { db, sql } = await banco();
  try {
    const e = await aprovacoesDaPessoa(sql, { id: 11, monday_user_id: '68036687' }, { env: {}, agora: AGORA });
    assert.equal(e.eu.dono, true);
    assert.equal(e.planejamentos.length, 2);
    assert.deepEqual(e.planejamentos.map((p) => [p.cliente, p.meu, p.etapa, p.horas]), [['Academia Lions', false, 'interna', 30], ['VOA', true, 'cliente', 60]]);
    assert.equal(e.pecas.length, 2);
  } finally { await db.close(); }
});

test('diretor de arte vê toda peça "Para aprovação"; quem não é head nem sócio não vê nada', async () => {
  const { db, sql } = await banco();
  try {
    const d = await aprovacoesDaPessoa(sql, { id: 12 }, { env: {}, agora: AGORA });
    assert.equal(d.eu.diretor_arte, true);
    assert.ok(d.pecas.some((p) => p.titulo === 'Card - Promo' && p.etapa === 'interna'));
    const j = await aprovacoesDaPessoa(sql, { id: 13, monday_user_id: '999' }, { env: {}, agora: AGORA });
    assert.deepEqual([j.planejamentos.length, j.pecas.length], [0, 0]);
  } finally { await db.close(); }
});
