import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { BOARD_PRODUCAO, BOARD_DEMANDAS } from '../server/grupos.js';
import { redistribuicoes } from '../server/redistribuicoes.js';

test('redistribuições: trocas de responsável da Produção com quem trocou, sem demanda apagada nem Solicitações', async () => {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,monday_item_id bigint,titulo text,formato text,prazo date,veiculacao date,removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT NOW());
    INSERT INTO vybe_clientes VALUES (10,'DiaCenter');
    INSERT INTO vybe_pessoas VALUES (1,'Tainara Lima','80146924'),(2,'Ademir Dourado','78158742');
    INSERT INTO vybe_conteudos VALUES
     (1,${BOARD_PRODUCAO},NULL,'Reels - A','Reels','2026-11-10','2026-11-12',NULL),
     (2,${BOARD_PRODUCAO},NULL,'Card - B','Card','2026-11-10','2026-11-12',NOW()),
     (3,${BOARD_DEMANDAS},NULL,'Solicitação','Impresso','2026-11-10','2026-11-12',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (1,10);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id,texto,em) VALUES
     (1,'responsavel','sem responsável','Ademir Dourado',1,NULL,NOW() - interval '2 days'),
     (1,'responsavel','Ademir Dourado','Reriston Silva, Ademir Dourado',NULL,'automacao',NOW() - interval '1 day'),
     (1,'status','A Fazer','Pode Fazer',1,NULL,NOW()),
     (1,'responsavel','Reriston Silva','Jady Amynne',2,NULL,NOW() - interval '40 days'),
     (2,'responsavel','sem responsável','Jady Amynne',1,NULL,NOW()),
     (3,'responsavel','sem responsável','Jady Amynne',1,NULL,NOW());`);
  const r = await redistribuicoes(sql, { dias: 30 });
  assert.equal(r.dias, 30);
  assert.deepEqual(r.eventos.map((e) => [e.ref, e.cliente, e.de, e.para, e.autor]), [
    ['vybe:1', 'DiaCenter', [], ['Ademir Dourado'], 'Tainara Lima'],
    ['vybe:1', 'DiaCenter', ['Ademir Dourado'], ['Reriston Silva', 'Ademir Dourado'], 'automação'],
  ]);
  assert.equal(r.eventos[0].autor_monday_id, '80146924');
  assert.equal((await redistribuicoes(sql, { dias: 999 })).dias, 60, 'no máximo 60 dias');
});
