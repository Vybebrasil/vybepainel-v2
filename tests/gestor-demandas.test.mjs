import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function contexto(){
 const c=vm.createContext({Date,Set,console,panelMode:'gestor',BOARD_ID:1,dateMode:'veiculacao',
  DADOS:[{id:'c1',semana:1,veiculacao_iso:'2026-09-09'}],
  DADOS_DEMANDAS:[{id:'d1',tipo:'Reunião',conclusao_iso:'2026-09-09',prazo_iso:'2026-09-08'},
    {id:'d2',tipo:'Identidade visual',prazo_iso:'2026-09-09'},
    {id:'d3',prazo_iso:'2026-10-01'},{id:'d4'}],
  DEMANDA_CONCLUIDA:['Feito','Aprovado','Concluído','Finalizado'],
  isRequestItem:d=>d.origem==='solicitacao',
  normalizeRequestForOperational:d=>({...d,origem:'solicitacao',board_id:2,veiculacao_iso:d.conclusao_iso||d.prazo_iso||''}),
  getDateIso:d=>c.dateMode==='prazo'?d.prazo_iso:d.veiculacao_iso});
 vm.runInContext(fs.readFileSync('vybe-gestor.js','utf8'),c);
 vm.runInContext("getDiasSemana=()=>[{iso:'2026-09-09'}]",c);
 return c;
}
test('semana integra solicitações de qualquer tipo, com entrega e fallback de prazo',()=>{
 const c=contexto();assert.deepEqual(Array.from(c.itensDaSemanaGestor(1),d=>d.id),['c1','d1','d2']);
 c.dateMode='prazo';assert.deepEqual(Array.from(c.itensDaSemanaGestor(1),d=>d.id),['d2']);
 c.panelMode='foco';c.dateMode='veiculacao';assert.deepEqual(Array.from(c.itensDaSemanaGestor(1),d=>d.id),['c1']);
});
test('progresso usa os estados finais próprios das solicitações',()=>{
 const c=contexto();assert.equal(c.atividadeDoDiaConcluida({origem:'solicitacao',status:'Feito'}),true);
 assert.equal(c.atividadeDoDiaConcluida({origem:'solicitacao',status:'A Fazer'}),false);
 assert.equal(c.atividadeDoDiaConcluida({status:'Agendado'}),true);
});
