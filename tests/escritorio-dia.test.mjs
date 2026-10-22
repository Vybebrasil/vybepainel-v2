import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Dia de cada pessoa (balão da mesa e Dia da equipe, Paulo 22/10/2026).
function contexto(hoje, demandas) {
 const c=vm.createContext({console,META:{today_iso:hoje},DADOS_DEMANDAS:demandas,DEMANDA_CONCLUIDA:['Feito','Aprovado','Concluído','Concluido','Finalizado'],escritorio:{base:{}}});
 vm.runInContext(readFileSync('vybe-escritorio-ficha.js','utf8'),c);
 return c;
}
const d=(id,status,prazo,conclusao=null,resp='7')=>({id,nome:'Peça '+id,status,prazo_iso:prazo,conclusao_iso:conclusao,responsavel_id:resp,responsavel_ids:[resp]});

test('dia: hoje separa finalizada, fazendo e falta; ontem separa no dia, depois e aberta',()=>{
 const c=contexto('2026-10-22',[
  d(1,'Em andamento','2026-10-22'), d(2,'Finalizado','2026-10-22','2026-10-22'), d(3,'A Fazer','2026-10-22'),
  d(4,'Finalizado','2026-10-25','2026-10-22'), // entregue hoje, antes do prazo: conta em hoje
  d(5,'Finalizado','2026-10-21','2026-10-21'), d(6,'Finalizado','2026-10-21','2026-10-22'), d(7,'Alteração','2026-10-21'),
  d(8,'Para aprovação','2026-10-20'), d(9,'Em andamento','2026-10-22',null,'8'),
 ]);
 const r=vm.runInContext(`escritorioDiaDe({id:'7',nome:'Reriston'})`,c);
 // A de ontem entregue hoje (6) também é entrega de hoje.
 assert.deepEqual({...r.nHoje},{total:5,feitas:3,fazendo:1,faltam:1});
 assert.equal(r.ontem,'2026-10-21');
 assert.deepEqual({...r.nOntem},{total:3,feitas:2,fazendo:0,faltam:1,noDia:1,depois:1});
 // Atrasadas: abertas com prazo antes de hoje (a de ontem e a de anteontem).
 assert.deepEqual(r.atrasadas.map(x=>x.id).sort(),[7,8]);
 // Fazendo vem primeiro na lista de hoje.
 assert.equal(r.paraHoje[0].id,1);
});

test('dia: segunda olha a sexta como ontem; "Para agendar" não vira finalizada',()=>{
 const c=contexto('2026-10-26',[d(1,'Para agendar','2026-10-23'), d(2,'Agendado','2026-10-23'), d(3,'Finalizado','2026-10-23','2026-10-23')]);
 const r=vm.runInContext(`escritorioDiaDe({id:'7',nome:'Bia'})`,c);
 assert.equal(r.ontem,'2026-10-23');
 assert.equal(r.nOntem.total,3);
 assert.equal(r.nOntem.noDia,1);
 assert.equal(r.nOntem.faltam,2,'status do painel como está, sem deduzir publicação');
});
