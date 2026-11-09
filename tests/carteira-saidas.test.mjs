import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { lerCarteira } from '../server/carteira.js';

// Auditoria de 09/11: Churn mostrava 0 saídas em 12 meses com 34 inativos (desativados antes de existir desativado_em).
// A saída de cada inativo vem do registro, da desativação, do histórico ou, por último, da última peça que já passou.
test('saída do cliente inativo: registro > desativação > histórico > última peça; ativo não tem saída', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean DEFAULT true);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, status text, nao_e_cliente boolean DEFAULT false,
      valor numeric, criado_no_monday date, desativado_em timestamptz, apagado_em timestamptz);
    CREATE TABLE vybe_cliente_eventos (id bigserial PRIMARY KEY, cliente_id bigint, tipo text, de text, para text, motivo text, autor text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, prazo date, veiculacao date, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_clientes (id, nome, ativo, status, desativado_em) VALUES
      (1,'Ativo',true,'Ativo',NULL),(2,'Desativado',false,'Inativo','2026-05-02T12:00:00Z'),(3,'SoHistorico',false,'Inativo',NULL),
      (4,'SoPecas',false,'Inativo',NULL),(5,'SemPista',false,'Inativo',NULL);
    INSERT INTO vybe_cliente_eventos (cliente_id, tipo, para, em) VALUES (3,'status','Inativo','2026-03-10T12:00:00Z'),(2,'status','Inativo','2026-01-01T12:00:00Z');
    INSERT INTO vybe_conteudos VALUES (10,'2026-02-01',NULL,NULL),(11,NULL,'2026-02-20',NULL),(12,'2026-12-30',NULL,NULL),(13,'2026-04-01',NULL,now()),(14,'2026-01-05',NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (10,4),(11,4),(12,4),(13,4),(14,1);`);
  const r = await lerCarteira(sql, { tipo: 'servico' }, '2026-11-09');
  const por = Object.fromEntries(r.clientes.map((c) => [c.nome, [c.saida, c.saida_fonte]]));
  assert.deepEqual(por, {
    Ativo: [null, null], Desativado: ['2026-05-02', 'desativacao'], SoHistorico: ['2026-03-10', 'historico'],
    SoPecas: ['2026-02-20', 'ultima_peca'], SemPista: [null, null],
  }, 'peça futura e peça removida não contam');
});
