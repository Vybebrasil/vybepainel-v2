import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const status=fs.readFileSync('vybe-status.js','utf8');
const agenda=fs.readFileSync('vybe-agenda.js','utf8');
function contexto(ids=['1','2']) {
  const gravados=[],avisos=[],items=[{id:'1',status:'A Fazer'},{id:'2',status:'A Fazer'},{id:'3',status:'A Fazer'}];
  const c=vm.createContext({SELECIONADAS:new Set(ids),STATUS_OPTIONS:[{label:'Pode Fazer',color:'#abc'}],
    closeStatusEditor(){},findOperationalItem:id=>items.find(i=>i.id===String(id)),
    operationalStatusOptions:()=>[],showToast:(m)=>avisos.push(m),
    abrirMenuDeLote:(_e,titulo,opcoes)=>{c.menu={titulo,opcoes};},
    tentarEscritaDupla:async(item)=>{gravados.push(item.id);return true;},
    chaveDeStatus:s=>s,applyOutboundItemPatch:(id,patch)=>Object.assign(items.find(i=>i.id===id),patch),
    perguntarNoPainel:async()=>true,saveProductionCache(){},renderOutboundItemPatch(){},console});
  vm.runInContext(status.slice(status.indexOf('function openStatusEditor('),status.indexOf('function updateLocalStatus(')),c);
  vm.runInContext(agenda.slice(agenda.indexOf('async function aplicarEmLote('),agenda.indexOf('// Classificar 300')),c);
  const evento=(tabela=true)=>({preventDefault(){},stopPropagation(){},currentTarget:{closest:()=>tabela?{}:null}});
  return {c,items,gravados,avisos,evento};
}
test('status na linha marcada usa lote e grava todas as selecionadas, sem tocar as demais',async()=>{
  const {c,items,gravados,evento}=contexto();
  c.openStatusEditor(evento(),'1');
  assert.equal(c.menu.titulo,'Status para 2 atividades');
  await c.aplicarEmLote('status',c.menu.opcoes[0].aplicar);
  assert.deepEqual(gravados,['1','2']);
  assert.deepEqual(items.map(i=>i.status),['Pode Fazer','Pode Fazer','A Fazer']);
});
test('linha não marcada, detalhe e seleção única mantêm o caminho individual',()=>{
  for(const [ids,id,tabela] of [[['1','2'],'3',true],[['1','2'],'1',false],[['1'],'1',true]]) {
    const {c,avisos,evento}=contexto(ids);
    c.openStatusEditor(evento(tabela),id);
    assert.equal(c.menu,undefined);
    assert.match(avisos[0],/opções de status/);
  }
});
test('cancelamento não grava e falha parcial não vira sucesso total',async()=>{
  const {c,gravados,avisos,evento}=contexto();
  c.openStatusEditor(evento(),'1');
  c.perguntarNoPainel=async()=>false;
  await c.aplicarEmLote('status',c.menu.opcoes[0].aplicar);
  assert.equal(gravados.length,0);
  c.perguntarNoPainel=async()=>true;
  c.tentarEscritaDupla=async(item)=>{if(item.id==='1') return false;gravados.push(item.id);return true;};
  await c.aplicarEmLote('status',c.menu.opcoes[0].aplicar);
  assert.deepEqual(gravados,['2']);
  assert.match(avisos.at(-1),/1 atualizada.*1 falhou/);
});
