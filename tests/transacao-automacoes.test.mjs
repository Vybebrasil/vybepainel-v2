import test from 'node:test';
import assert from 'node:assert/strict';
import {executarTransacaoDeAutomacao} from '../server/transacao-automacoes.js';
function poolFalso(falhar='') {
 const chamadas=[];
 return {chamadas,async connect(){if(falhar==='connect')throw Error('conexão');return {
  async query(texto,params){chamadas.push([texto,params]);if(texto===falhar)throw Error('recusado');return {rows:[{ok:true}]};},release(){chamadas.push(['release']);}};},async end(){chamadas.push(['end']);}};
}
test('transação mantém parâmetros e fecha conexão após commit',async()=>{
 const pool=poolFalso();const r=await executarTransacaoDeAutomacao(pool,async sql=>sql`SELECT ${"texto ' ;"}`);
 assert.equal(r[0].ok,true);assert.deepEqual(pool.chamadas.find(c=>c[0]==='SELECT $1'),['SELECT $1',["texto ' ;"]]);
 assert.deepEqual(pool.chamadas.slice(-3).map(c=>c[0]),['COMMIT','release','end']);
});
test('falha faz rollback e sempre libera conexão; falha de conexão fecha pool',async()=>{
 const pool=poolFalso('SELECT $1');await assert.rejects(executarTransacaoDeAutomacao(pool,sql=>sql`SELECT ${1}`),/recusado/);
 assert.deepEqual(pool.chamadas.slice(-3).map(c=>c[0]),['ROLLBACK','release','end']);assert.ok(!pool.chamadas.some(c=>c[0]==='COMMIT'));
 const semConexao=poolFalso('connect');await assert.rejects(executarTransacaoDeAutomacao(semConexao,()=>{}),/conexão/);assert.deepEqual(semConexao.chamadas,[['end']]);
});

import fs from 'node:fs';
import vm from 'node:vm';
test('retomada na tela bloqueia duplo envio, preserva outro modal e distingue falha de releitura',async()=>{
 const item={id:'1'},avisos=[],effects=[],elements={'workflow-modal':{},'workspace-drawer':{}};
 let liberar,chamadas=0;
 const c=vm.createContext({statusEmGravacao:new Set(),document:{getElementById:id=>elements[id]},findOperationalItem:()=>item,
 tentarEscritaDupla:async()=>{chamadas++;await new Promise(r=>{liberar=r;});return {automacoes:[{}],depois:{status:'Agendado'}};},
 updateLocalStatus:()=>effects.push('status'),aplicarEfeitoDaAutomacao:()=>effects.push('dono'),renderOutboundItemPatch(){},closeWorkflowModal:()=>effects.push('fechou'),
 showToast:(...a)=>avisos.push(a),atualizarGavetaPreservandoRascunhos:async()=>{throw Error('leitura');}});
 const fonte=fs.readFileSync('vybe-automacoes-ui.js','utf8');vm.runInContext(fonte.slice(fonte.indexOf('async function retomarEncaminhamentoDaPeca')),c);
 const botao={};const p=c.retomarEncaminhamentoDaPeca('1','20',botao);await c.retomarEncaminhamentoDaPeca('1','20',botao);
 assert.equal(chamadas,1);elements['workflow-modal']={};liberar();await p;
 assert.deepEqual(effects,['status','dono']);assert.equal(botao.disabled,false);assert.equal(avisos.at(-1)[1],'info');assert.match(avisos.at(-1)[0],/confirmado/);
 c.tentarEscritaDupla=async()=>{throw Error('recusado');};effects.length=0;await c.retomarEncaminhamentoDaPeca('1','20',botao);
 assert.deepEqual(effects,[]);assert.equal(avisos.at(-1)[1],'err');assert.equal(botao.disabled,false);
});
