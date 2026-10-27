import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { memoriaDoCliente } from '../server/assistente-memoria.js';
import { calendarioClientes } from '../server/assistente-rotinas.js';

const PROD = 7829537690;
async function banco() {
  const { db, sql } = conexao();
  const ontem = new Date(Date.now() - 864e5).toISOString();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,veiculacao date,removido_em timestamptz,status_chave text,monday_item_id bigint);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_updates(id bigint,conteudo_id bigint,corpo text,autor text,criado_em timestamptz,editado_em timestamptz);
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,de text,para text);
    CREATE TABLE vybe_planejamentos(id bigint,cliente_id bigint,mes date,estado text);
    INSERT INTO vybe_clientes VALUES (10,'Gonzalez',true),(11,'Hebravet',true),(12,'Copirecê',true);
    INSERT INTO vybe_status VALUES (${PROD},'s1','Em produção',false),(${PROD},'s2','Agendado',true);
    INSERT INTO vybe_conteudos VALUES (100,${PROD},'Reels - Agenda Musical','2026-11-05',NULL,'s1',555),(101,${PROD},'Card - Rodízio','2026-11-12',NULL,'s2',NULL),(102,${PROD},'Card - Outro cliente','2026-11-03',NULL,'s1',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,10),(102,11);
    INSERT INTO vybe_planejamentos VALUES (1,11,'2026-11-01','enviado');
    INSERT INTO vybe_conteudo_updates VALUES (1,100,'<p>Cliente pediu para trocar a cor do fundo para vinho</p>','Jady','${ontem}',NULL),
      (2,101,'<p>Aprovado sem ressalvas</p>','Tainara','${ontem}',NULL),(3,102,'<p>Trocar logo</p>','Bia','${ontem}',NULL);
    INSERT INTO vybe_conteudo_eventos VALUES (100,'status','${ontem}','Em produção','Alteração');`);
  return sql;
}

test('memória do cliente: pedidos de mudança primeiro, alterações contadas, só do cliente', async () => {
  const sql = await banco();
  const r = await memoriaDoCliente(sql, { cliente_id: 10 });
  assert.match(r.texto, /Memória · Gonzalez/);
  assert.match(r.texto, /Voltaram para alteração: 1 vez/);
  assert.ok(r.texto.indexOf('trocar a cor') < r.texto.indexOf('Aprovado sem'));
  assert.doesNotMatch(r.texto, /Trocar logo/);
  assert.match(r.texto, /atividade=555/);
  const cor = await memoriaDoCliente(sql, { cliente_id: 10, busca: 'cor do fundo' });
  assert.match(cor.texto, /trocar a cor/); assert.doesNotMatch(cor.texto, /Aprovado sem/);
  await assert.rejects(memoriaDoCliente(sql, { cliente_id: 99 }), /Cliente inválido/);
});

test('calendário do mês no banco: sem nada, só planejamento e com peças', async () => {
  const sql = await banco();
  const r = await calendarioClientes(sql, '2026-11-10');
  assert.match(r.texto, /Sem nada cadastrado \(1\)\*\n- Copirecê/);
  assert.match(r.texto, /- Gonzalez · 2 peça\(s\), 1 finalizada\(s\) · sem planejamento/);
  assert.match(r.texto, /- Hebravet · 1 peça\(s\), 0 finalizada\(s\) · planejamento com o cliente/);
});

test('legendas aprovadas: só de planejamento aprovado ou cadastrado, filtrando formato', async () => {
  const { legendasAprovadas } = await import('../server/assistente-memoria.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean);
    CREATE TABLE vybe_planejamentos(id bigint,cliente_id bigint,mes date,estado text,conteudo jsonb);
    INSERT INTO vybe_clientes VALUES (10,'Gonzalez',true);
    INSERT INTO vybe_planejamentos VALUES
     (1,10,'2026-10-01','aprovado','{"pecas":[{"data":"2026-10-05","formato":"Reels","tema":"Rodízio","legenda":"Quarta é dia de rodízio no Gonzalez: massa fina, forno quente e música ao vivo."},{"data":"2026-10-06","formato":"Card","tema":"Executivo","legenda":"Almoço executivo servido com calma, do jeito que um bom almoço merece ser."}]}'),
     (2,10,'2026-11-01','revisar','{"pecas":[{"data":"2026-11-05","formato":"Reels","tema":"Rascunho","legenda":"Legenda ainda em revisão e que não pode servir de exemplo para ninguém."}]}');`);
  const r = await legendasAprovadas(sql, { cliente_id: 10, formato: 'reels' });
  assert.equal(r.cliente, 'Gonzalez');
  assert.deepEqual(r.itens.map((x) => x.tema), ['Rodízio']);
  assert.equal((await legendasAprovadas(sql, { cliente_id: 10 })).itens.length, 2);
});
