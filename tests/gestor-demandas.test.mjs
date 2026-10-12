import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function contexto(){
 const c=vm.createContext({Date,Set,console,panelMode:'gestor',BOARD_ID:1,dateMode:'veiculacao',
  selectedPersonIds:new Set(),
  DADOS:[{id:'c1',semana:1,veiculacao_iso:'2026-09-09'}],
  DADOS_DEMANDAS:[{id:'d1',tipo:'Reunião',conclusao_iso:'2026-09-09',prazo_iso:'2026-09-08'},
    {id:'d2',tipo:'Identidade visual',prazo_iso:'2026-09-09'},
    {id:'d3',prazo_iso:'2026-10-01'},{id:'d4'}],
  DEMANDA_CONCLUIDA:['Feito','Aprovado','Concluído','Finalizado'],
  isRequestItem:d=>d.origem==='solicitacao',
  normalizeRequestForOperational:d=>({...d,origem:'solicitacao',board_id:2,veiculacao_iso:d.conclusao_iso||d.prazo_iso||''}),
  getDateIso:d=>c.dateMode==='prazo'?d.prazo_iso:d.veiculacao_iso});
 vm.runInContext(fs.readFileSync('vybe-core.js','utf8').split('// QUANDO FOI')[0],c);
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

test('pendências atravessam meses, excluem concluídas e o próprio dia e preservam datas',()=>{
 const c=contexto();
 c.DADOS_DEMANDAS=[{id:'antiga',prazo_iso:'2025-12-31'}, {id:'sem'},
 {id:'hoje',prazo_iso:'2026-01-02'}, {id:'futura',prazo_iso:'2026-01-03'},
 {id:'feita',prazo_iso:'2025-12-30',status:'Feito'}, {id:'antiga',prazo_iso:'2025-12-31'}];
 const antes=JSON.stringify(c.DADOS_DEMANDAS);
 assert.deepEqual(Array.from(c.pendenciasSolicitacoesDoDia('2026-01-02',''),d=>d.id),['antiga','sem']);
 assert.equal(JSON.stringify(c.DADOS_DEMANDAS),antes);
});
test('pendências respeitam o modo de data, carteira, pessoas e status',()=>{
 const c=contexto();
 c.DADOS_DEMANDAS=[{id:'a',prazo_iso:'2026-09-01',conclusao_iso:'2026-09-15',status:'A Fazer'},
 {id:'b',prazo_iso:'2026-09-01',status:'Em execução'}, {id:'c',prazo_iso:'2026-09-01',status:'A Fazer'}];
 vm.runInContext("itemNaCarteira=d=>d.id!=='c';itemMatchesSelectedPeople=d=>d.id==='a'",c);
 c.selectedPersonIds.add('p');
 assert.equal(c.pendenciasSolicitacoesDoDia('2026-09-09','').length,0);
 c.dateMode='prazo';
 assert.deepEqual(Array.from(c.pendenciasSolicitacoesDoDia('2026-09-09','status:A Fazer'),d=>d.id),['a']);
 assert.equal(c.pendenciasSolicitacoesDoDia('2026-09-09','status:Em execução').length,0);
});
