import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conexao } from './postgres.mjs';
import { salvarHeadsCliente } from '../server/clientes-heads.js';

test('heads e carteira persistem juntos, com identidade, ordem e rollback', async () => {
  const { db, sql } = conexao();
  try {
    await db.exec(`CREATE TABLE vybe_clientes(id int primary key,responsavel text);
      CREATE TABLE vybe_pessoas(id int primary key,monday_user_id text,ativo boolean);
      CREATE TABLE vybe_cliente_pessoas(cliente_id int references vybe_clientes(id),pessoa_id int references vybe_pessoas(id),ordem int);
      INSERT INTO vybe_clientes VALUES(1,'Vinícius');
      INSERT INTO vybe_pessoas VALUES(1,'68036687',true),(2,'68035653',true),(3,'outro-ewerton',true),(4,'inativo',false);`);
    assert.equal((await salvarHeadsCliente(sql,1,[1,1])).responsavel,'Ewerton');
    assert.equal((await salvarHeadsCliente(sql,1,[2])).responsavel,'Vinícius');
    assert.equal((await salvarHeadsCliente(sql,1,[1,2])).responsavel,'Vinícius');
    assert.equal((await salvarHeadsCliente(sql,1,[3])).responsavel,'Vinícius');
    assert.equal((await salvarHeadsCliente(sql,1,[])).responsavel,'Vinícius');
    await salvarHeadsCliente(sql,1,[2,1]);
    for (const ids of [[1,999],[4],[1.5],[true]]) await assert.rejects(salvarHeadsCliente(sql,1,ids));
    await assert.rejects(salvarHeadsCliente(sql,999,[1]),/Cliente não encontrado/);
    assert.deepEqual((await sql`SELECT pessoa_id FROM vybe_cliente_pessoas ORDER BY ordem`).map(p=>p.pessoa_id),[2,1]);
    // Falha depois de trocar os vínculos também precisa reverter toda a gravação.
    await db.exec(`ALTER TABLE vybe_clientes ADD CONSTRAINT sem_azul CHECK(responsavel <> 'Ewerton')`);
    await assert.rejects(salvarHeadsCliente(sql,1,[1]));
    assert.deepEqual((await sql`SELECT pessoa_id FROM vybe_cliente_pessoas ORDER BY ordem`).map(p=>p.pessoa_id),[2,1]);
    await db.exec('ALTER TABLE vybe_clientes DROP CONSTRAINT sem_azul');
    await db.exec(`INSERT INTO vybe_clientes VALUES(2,'Vinícius'),(3,'Ewerton');
      INSERT INTO vybe_cliente_pessoas VALUES(2,1,0),(3,3,0)`);
    const migracao=fs.readFileSync('migrations/2026-10-14-carteira-head.sql','utf8');
    await db.exec(migracao);
    await db.exec(migracao);
    assert.deepEqual((await sql`SELECT responsavel FROM vybe_clientes ORDER BY id`).map(c=>c.responsavel),['Vinícius','Ewerton','Ewerton']);
  } finally { await db.close(); }
});
