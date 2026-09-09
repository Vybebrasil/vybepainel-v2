import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './postgres.mjs';
import {substituirResponsaveis} from '../server/responsaveis.js';
import {unificarStatus} from '../server/catalogos.js';
import {prepararVariables,garantirFilaReplica,enfileirarReplica,processarFilaReplica,replicarOuEnfileirar} from '../vybe_replica_queue.js';
let db,sql;
before(async()=>{({db,sql}=await database());await garantirFilaReplica(sql);});
after(async()=>{await db.close();});
test('subitem local resolve o ID remoto antes de replicar',async()=>{
  assert.equal((await prepararVariables(sql,{variables:{item:'vybe-subitem:42'}})).item,'123456');
  await assert.rejects(prepararVariables(sql,{variables:{item:'vybe-subitem:999'}}),/Aguardando/);
});
test('responsáveis e histórico são gravados juntos',async()=>{
  const r=await substituirResponsaveis(sql,{conteudoId:1,pessoas:['200'],autorId:2});
  assert.equal(r.antes,'Antigo');assert.equal(r.depois,'Novo');
  assert.equal((await sql`SELECT pessoa_id FROM vybe_conteudo_responsaveis WHERE conteudo_id=1`)[0].pessoa_id,2);
});
test('falha de inserção reverte exclusão e histórico no PostgreSQL',async()=>{
  await db.exec('ALTER TABLE vybe_conteudo_responsaveis ADD CONSTRAINT falha_teste CHECK(pessoa_id<>1)');
  const antes=(await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_eventos`)[0].n;
  await assert.rejects(substituirResponsaveis(sql,{conteudoId:1,pessoas:['100'],autorId:2}),/falha_teste/);
  assert.equal((await sql`SELECT pessoa_id FROM vybe_conteudo_responsaveis`)[0].pessoa_id,2);
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_eventos`)[0].n,antes);
  await db.exec('ALTER TABLE vybe_conteudo_responsaveis DROP CONSTRAINT falha_teste');
});
test('responsável desconhecido é rejeitado sem apagar vínculos',async()=>{
  await assert.rejects(substituirResponsaveis(sql,{conteudoId:1,pessoas:['999']}),/inexistentes/);
  assert.equal((await sql`SELECT pessoa_id FROM vybe_conteudo_responsaveis`)[0].pessoa_id,2);
});
test('unificação atualiza conteúdo, subitem e catálogo atomicamente',async()=>{
  await db.exec("INSERT INTO vybe_status VALUES(7829537690,'antigo','Antigo'),(7829537690,'duplicado','Duplicado')");
  await unificarStatus(sql,{board:7829537690,origem:'antigo',absorvidas:['duplicado'],destino:'novo',rotulo:'Novo'});
  assert.equal((await sql`SELECT status_chave FROM vybe_subitens`)[0].status_chave,'novo');
  assert.deepEqual(await sql`SELECT chave FROM vybe_status`,[{chave:'novo'}]);
});
test('conflito no catálogo reverte alterações intermediárias',async()=>{
  await db.exec("INSERT INTO vybe_status VALUES(7829537690,'ocupada','Ocupada')");
  await assert.rejects(unificarStatus(sql,{board:7829537690,origem:'novo',destino:'ocupada',rotulo:'Conflito'}));
  assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'novo');
});
test('fila preserva intenção antes da chamada externa e não repete mesma chave',async()=>{
  let chamadas=0;const dados={operacao:'status',referencia:'teste:1',query:'status',variables:{item:'900'},operationKey:'idempotente'};
  const executar=async()=>{chamadas++;assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_replica_queue WHERE operation_key='idempotente'`)[0].n,1);return {};};
  assert.equal((await replicarOuEnfileirar(sql,executar,dados)).estado,'ok');
  await replicarOuEnfileirar(sql,executar,dados);assert.equal(chamadas,1);
});
test('falha transitória volta à fila e respeita espera',async()=>{
  await replicarOuEnfileirar(sql,async()=>{throw new Error('offline');},{operacao:'status',referencia:'teste:2',query:'status',variables:{},operationKey:'falha'});
  assert.equal((await sql`SELECT estado FROM vybe_replica_queue WHERE operation_key='falha'`)[0].estado,'falhou');
});
test('recupera execução interrompida sem duplicar criação incerta',async()=>{
  for(const [operationKey,operacao] of [['interrompida','status'],['criacao-incerta','criar_item']]){
    await enfileirarReplica(sql,{operacao,referencia:operationKey,query:'teste',variables:{},operationKey});
    await sql`UPDATE vybe_replica_queue SET estado='processando',atualizado_em=NOW()-INTERVAL '20 minutes' WHERE operation_key=${operationKey}`;
  }
  const r=await processarFilaReplica(sql,async()=>({}));assert.equal(r.concluidas,1);
  assert.equal((await sql`SELECT estado FROM vybe_replica_queue WHERE operation_key='interrompida'`)[0].estado,'concluida');
  assert.equal((await sql`SELECT proxima_tentativa='infinity'::timestamptz AS manual FROM vybe_replica_queue WHERE operation_key='criacao-incerta'`)[0].manual,true);
});
test('não ultrapassa uma alteração anterior ainda pendente para a mesma peça',async()=>{
  await enfileirarReplica(sql,{operacao:'status',referencia:'mesma-peca',query:'antes',variables:{},operationKey:'antes'});
  let chamada=false;
  const r=await replicarOuEnfileirar(sql,async()=>{chamada=true;return {};},{operacao:'status',referencia:'mesma-peca',query:'depois',variables:{},operationKey:'depois'});
  assert.equal(chamada,false);assert.equal(r.estado,'pendente');
});
