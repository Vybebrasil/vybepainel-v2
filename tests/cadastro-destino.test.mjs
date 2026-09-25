import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Reproduz o redesenho do último passo: a escolha manual deve aparecer de novo,
// mesmo que o seletor tenha acabado de ser criado com o texto padrão.
function desenhar(state) {
  const fonte=fs.readFileSync('cadastros_governed_v2.js','utf8');
  const trecho=fonte.slice(fonte.indexOf('  function updateDestinyUI()'),fonte.indexOf('  window.fcHandleInput ='));
  const elementos=new Map(); const seletores={};
  const contexto={state,document:{getElementById(id){if(!elementos.has(id))elementos.set(id,{});return elementos.get(id);}},
    cadastrosDestiny:()=>({group:'entrada',status:'A Fazer',capture:false}),
    fcQuadro:()=>({grupos:[{val:'entrada',label:'Entrada'},{val:'execucao',label:'Em Execução'}]}),
    fcGrupoDoQuadro:g=>g,fcSelectDropdown:(key,value,label)=>{seletores[key]={value,label};},
    fcEquipeFinal:()=>[],esc:String};
  vm.runInNewContext(trecho+'\nupdateDestinyUI();',contexto);
  return {seletores,elementos};
}

test('revisão mostra grupo, status e captação manuais sem substituir pelo automático',()=>{
  const state={board:'demandas',manualGroup:'execucao',manualStatus:'Em Execução',manualCap:'Captação Feita',itens:[],veic:'2026-10-02'};
  const {seletores,elementos}=desenhar(state);
  assert.deepEqual(seletores.manualGroup,{value:'execucao',label:'Em Execução'});
  assert.equal(seletores.manualStatus.value,'Em Execução');
  assert.equal(seletores.manualCap.value,'Captação Feita');
  assert.equal(state.manualGroup,'execucao');
  assert.equal(elementos.get('fc-prev-dates').innerHTML,'Conclusão: 02/10/2026');
});

test('sem escolha manual, revisão continua seguindo o destino automático',()=>{
  const {seletores}=desenhar({board:'producao',itens:[]});
  assert.equal(seletores.manualGroup.value,'entrada');
  assert.equal(seletores.manualStatus.value,'A Fazer');
});
