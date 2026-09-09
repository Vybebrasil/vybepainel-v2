import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {agruparHistorico} from '../server/historico.js';
import monday from '../api/monday.js';
import events from '../api/monday-events.js';
import webhook from '../api/webhook-status.js';
import mirror from '../api/operational-mirror.js';
import {mondayQuery} from '../operational_mirror_store.js';

test('integração encerrada não consulta rede nem aceita eventos, mesmo com token configurado',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('Rede proibida');};
 try{
  for(const handler of [monday,events,webhook,mirror]){
   const res={setHeader(){},status(n){this.code=n;return this;},json(d){this.body=d;return this;}};
   await handler({method:'POST',headers:{authorization:'Bearer antigo'},body:{challenge:'x',event:{type:'update_column_value'}}},res);
   assert.equal(res.code,410);
  }
  await assert.rejects(()=>mondayQuery('mutation { create_item }'),/encerrada/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=oldFetch;}
});
test('preferências antigas nunca restauram leitura ou escrita no Monday',()=>{
 const ctx=vm.createContext({localStorage:{getItem:k=>k.includes('source')?'espelho':'monday'}});
 vm.runInContext(fs.readFileSync('vybe-dominio.js','utf8'),ctx);
 assert.equal(vm.runInContext('fonteDeLeitura()',ctx),'dominio');
 assert.equal(vm.runInContext('escritaDupla()',ctx),true);
});
test('histórico local preserva transições, ordenação e identidade dos grupos',()=>{
 const logs=agruparHistorico([
  {item_id:'vybe:7',tipo:'status',em:'2026-09-09T10:00:00Z',de:'A Fazer',para:'Feito'},
  {item_id:'vybe:7',tipo:'status',em:'2026-09-08T10:00:00Z',de:'Novo',para:'A Fazer'},
  {item_id:'vybe:7',tipo:'grupo',em:'2026-09-09T10:00:00Z',de:'Criação',para:'Finalizados'},
 ],{'Criação':'g1','Finalizados':'g2'});
 assert.equal(logs.statusEvents['vybe:7'][0].status,'A Fazer');
 assert.equal(logs.moveEvents['vybe:7'][0].destGroupId,'g2');
});
