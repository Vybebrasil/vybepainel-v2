import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('base vazia confirmada limpa a tela em vez de recuperar conteúdo antigo',async()=>{
  let aplicado;
  const context=vm.createContext({console,Date,aplicarFotosDoBanco(){},COLUNAS:{producao:{}},
    calcWeeks:()=>({}),processItemsAll:(itens)=>itens,applyCachedProductionDataset:(itens)=>{aplicado=itens;},
    saveProductionCache(){},cacheSyncLabel(){},setSyncHealth(){}});
  vm.runInContext(fs.readFileSync('vybe-dominio.js','utf8'),context);
  vm.runInContext('buscarDominio = async () => ({itens:[],status:[]});',context);
  assert.equal(await vm.runInContext('puxarDominio()',context),true);
  assert.equal(aplicado.length,0);
});
test('atualização periódica consulta Vybe sem depender da réplica Monday',async()=>{
  let leituras=0;
  const context=vm.createContext({console,Date,localStorage:{getItem:()=>null},
    espelhoSomenteObservador:()=>true,puxarDominio:async()=>{leituras++;},
    producaoRefreshRunning:false,setInterval(){},window:{addEventListener(){}},document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('vybe-sync.js','utf8'),context);
  vm.runInContext('mirrorRequest = async () => { throw new Error("Não deve consultar Monday"); };',context);
  assert.equal(await vm.runInContext('pullOperationalMirror({force:true})',context),true);
  assert.equal(leituras,1);
});
