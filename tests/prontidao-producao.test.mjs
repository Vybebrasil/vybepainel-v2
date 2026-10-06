import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('vybe-material.js','utf8');
const c=vm.createContext({safeText:String,operationalFlowStatus:i=>i.status});
vm.runInContext(source.slice(source.indexOf('const FORMATOS_QUE_PEDEM_BRUTO'),source.indexOf('// Lista e detalhe recebem')),c);
const base={id:'vybe:1',status:'Pode Fazer',formato:'Reels',tem_briefing:true,material_bruto:'https://example.test/pasta'};
test('prontidão requer briefing e bruto apenas para formatos que o utilizam',()=>{
 assert.equal(c.prontidaoDaAtividade(base).pronta,true);
 assert.equal(c.prontidaoDaAtividade({...base,material_bruto:''}).pronta,false);
 assert.equal(c.prontidaoDaAtividade({...base,formato:'Card',material_bruto:''}).pronta,true);
 assert.deepEqual(Array.from(c.prontidaoDaAtividade({...base,tem_briefing:false,material_bruto:' '}).faltas),['briefing','bruto']);
 assert.equal(c.prontidaoDaAtividade({...base,formato:'',tipo:'Vídeo',material_bruto:''}).pronta,false);
 assert.equal(c.prontidaoDaAtividade({...base,formato:'Story',material_bruto:''}).pronta,false);
 assert.equal(base.status,'Pode Fazer');
});
test('dados desconhecidos não viram ausência confirmada ou prontidão',()=>{
 for(const item of [{...base,tem_briefing:null},{...base,material_bruto:null},{...base,formato:'—'}]){
  const estado=c.prontidaoDaAtividade(item);assert.equal(estado.verificar,true);assert.equal(estado.pronta,false);assert.equal(estado.faltas.length,0);
 }
});
test('ações apontam ao fluxo existente e não aparecem em aprovação/finalização',()=>{
 const html=c.prontidaoDaAtividadeHtml({...base,tem_briefing:false,material_bruto:''});
 assert.match(html,/abrirBriefing\('vybe:1'/);assert.match(html,/abrirMaterialBruto\('vybe:1'/);
 assert.match(html,/Falta briefing/);assert.match(html,/Falta material bruto/);
 for(const status of ['Para aprovação','Finalizado','Agendado'])assert.equal(c.prontidaoDaAtividadeHtml({...base,status}),'');
});
