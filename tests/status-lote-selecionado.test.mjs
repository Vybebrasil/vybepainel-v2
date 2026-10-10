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
    operationalStatusOptions:()=>[{label:'Pode Fazer',color:'#abc'}],
    updateLocalStatus:(id,o)=>Object.assign(items.find(i=>i.id===id),{status:o.label}),aplicarEfeitoDaAutomacao(){},showToast:(m)=>avisos.push(m),
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
    c.operationalStatusOptions=()=>[];
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

test('lote de demandas usa catálogo próprio e aplica o estado devolvido pelo servidor',async()=>{
 const {c,items,evento}=contexto();
 c.operationalStatusOptions=()=>[{label:'Feito',chave:'feito',color:'#0f0'}];
 const efeitos=[]; c.aplicarEfeitoDaAutomacao=(item,resposta)=>efeitos.push([item.id,resposta.depois]);
 c.tentarEscritaDupla=async(item,corpo)=>{assert.equal(corpo.para,'feito');assert.equal(corpo._devolve,true);return {depois:{status:'Feito',grupo_id:'concluidas',responsavel_ids:[]}};};
 c.openStatusEditor(evento(),'1');
 assert.deepEqual(Array.from(c.menu.opcoes,o=>o.rotulo),['Feito']);
 await c.aplicarEmLote('status',c.menu.opcoes[0].aplicar);
 assert.deepEqual(items.map(i=>i.status),['Feito','Feito','A Fazer']);
 assert.equal(efeitos.length,2);assert.deepEqual(efeitos[0][1].responsavel_ids,[]);
});

test('duplo envio não duplica lote e o resultado identifica todas as falhas',async()=>{
 const {c}=contexto(); let liberar;let n=0;const perguntas=[];
 c.perguntarNoPainel=async p=>{perguntas.push(p);return true;};
 const primeiro=c.aplicarEmLote('status',async()=>{n++; if(n===1)await new Promise(r=>liberar=r);throw Error('recusado');});
 await new Promise(r=>setImmediate(r));
 await c.aplicarEmLote('status',async()=>n++);assert.equal(n,1);
 liberar();await primeiro;assert.equal(n,2);
 assert.match(perguntas.at(-1).texto,/\(1\).*\(2\)/);
 assert.equal(c.aplicarEmLote.emAndamento,false);
});
