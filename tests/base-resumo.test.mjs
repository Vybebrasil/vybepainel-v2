import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { garantirObservabilidade, gravarSnapshotOperacional, obterBaseResumo, referenciaSnapshot } from '../vybe_observabilidade.js';

test('base da manhã preserva IDs e lista original após atualizações do snapshot',async()=>{
  const {db,sql}=conexao();
  try {
    await garantirObservabilidade(sql);
    const item={id:7,atividade_id:'vybe:7',board_id:'7829537690',veiculacao_iso:'2026-10-15',cliente:'A',clientes:['A','B']};
    await gravarSnapshotOperacional(sql,{itens:[item]},'cron',new Date('2026-10-15T08:59:00Z'));
    assert.equal(await obterBaseResumo(sql,'2026-10-15'),null);
    await gravarSnapshotOperacional(sql,{itens:[item,{...item,id:8,board_id:'8385559107'}]},'resumo_manha',new Date('2026-10-15T09:00:00Z'));
    const original=await obterBaseResumo(sql,'2026-10-15');
    assert.equal(original.itens.length,1);
    assert.equal(original.itens[0].id,'vybe:7');
    assert.deepEqual(original.itens[0].clientes,['A','B']);
    await gravarSnapshotOperacional(sql,{itens:[]},'manual',new Date('2026-10-15T10:00:00Z'));
    await gravarSnapshotOperacional(sql,{itens:[]},'cron',new Date('2026-10-15T18:00:00Z'));
    assert.deepEqual(await obterBaseResumo(sql,'2026-10-15'),original);
    await assert.rejects(obterBaseResumo(sql,'2026-02-30'),/inválida/);
  } finally {await db.close();}
});

test('janela da manhã e virada do dia usam horário da Bahia',()=>{
  assert.deepEqual(referenciaSnapshot(new Date('2027-01-01T01:00:00Z')),{dia:'2026-12-31',manha:false});
  assert.equal(referenciaSnapshot(new Date('2026-10-15T14:59:00Z')).manha,true);
  assert.equal(referenciaSnapshot(new Date('2026-10-15T15:00:00Z')).manha,false);
});
