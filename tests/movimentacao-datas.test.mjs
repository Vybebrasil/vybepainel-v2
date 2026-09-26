import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { trocarData } from '../api/conteudo.js';
const fonte=fs.readFileSync('vybe-agenda.js','utf8');
function contexto(gravar=async()=>true){
 const item={id:'vybe:123',nome:'Teste',prazo_iso:'2026-12-30',conclusao_iso:'2026-12-31',clientes:['A','B']};
 const avisos=[], chamadas=[];
 const c=vm.createContext({console,Date,Set,DADOS_DEMANDAS:[item],dateMode:'prazo',currentDemandaDateMode:'conclusao',activeBoard:'demandas',
  managerCalendarDragPayload:null,findOperationalItem:()=>item,showToast:(...a)=>avisos.push(a),
  armOutboundMutationGuard(){},tentarEscritaDupla:async(i,b)=>{chamadas.push(b);return gravar(i,b);},
  planningDateBr:s=>s,safeText:String,goldenDeadlineGap:()=>0,PRAZO_OURO_DIAS:7,
  renderIntegratedOperationalViews(){},renderManagerCalendar(){},renderVisaoDeGrupos(){},renderDemandas(){},
  applyOutboundItemPatch:(_id,p)=>Object.assign(item,p),
 });
 vm.runInContext(fonte.slice(fonte.indexOf('async function managerCalendarDrop('),fonte.indexOf('function managerCalendarLoadDemandas(')),c);
 return {c,item,avisos,chamadas};
}
const evento=()=>({preventDefault(){},dataTransfer:{getData:()=> 'request:vybe:123'}});
const celula=()=>({classList:{add(){},remove(){}}});
test('arrasto em Demandas preserva ID nativo e usa Conclusão, apesar do Gestor em Prazo',async()=>{
 const {c,item,chamadas,avisos}=contexto();
 await c.managerCalendarDrop('2027-01-02',evento(),celula(),'demandas');
 assert.equal(chamadas[0].item,'vybe:123');assert.equal(chamadas[0].acao,'veiculacao');
 assert.equal(item.conclusao_iso,'2027-01-02');assert.equal(item.prazo_iso,'2026-12-30');
 assert.deepEqual(item.clientes,['A','B']);assert.match(avisos.at(-1)[0],/Conclusão/);assert.doesNotMatch(avisos.at(-1)[0],/Ouro/);
});
test('falha de escrita mantém data e vínculos e libera nova tentativa',async()=>{
 let falhar=true;const {c,item}=contexto(async()=>{if(falhar)throw new Error('sem rede');return true;});
 await assert.rejects(c.moverDataDoItem(item,'prazo','2027-01-02',{request:true}),/sem rede/);
 assert.equal(item.prazo_iso,'2026-12-30');assert.deepEqual(item.clientes,['A','B']);
 falhar=false;await c.moverDataDoItem(item,'prazo','2027-01-02',{request:true});assert.equal(item.prazo_iso,'2027-01-02');
});
test('segunda alteração simultânea é recusada antes de enviar outra gravação',async()=>{
 let liberar;const espera=new Promise(r=>{liberar=r;});const {c,item,chamadas}=contexto(async()=>{await espera;return true;});
 const primeira=c.moverDataDoItem(item,'prazo','2027-01-02',{request:true});
 await assert.rejects(c.moverDataDoItem(item,'prazo','2027-01-03',{request:true}),/Aguarde/);
 liberar();await primeira;assert.equal(chamadas.length,1);assert.equal(item.prazo_iso,'2027-01-02');
});
test('Produção mantém veiculação separada do prazo',async()=>{
 const {c,item}=contexto();item.veiculacao_iso='2026-12-31';
 await c.moverDataDoItem(item,'veiculacao','2027-01-02');
 assert.equal(item.veiculacao_iso,'2027-01-02');assert.equal(item.prazo_iso,'2026-12-30');
});
for (const board of [7829537690, 8385559107]) test(`banco ${board}: preserva clientes e outra data; evento e alteração revertem juntos em erro`,async()=>{
 const {db,sql}=conexao();try{
 await db.exec(`CREATE TABLE vybe_conteudos(id int primary key,monday_item_id text,board_id bigint,titulo text,prazo date,veiculacao date,atualizado_em timestamptz);
 CREATE TABLE vybe_conteudo_eventos(conteudo_id int,tipo text,de text,para text,autor_id int,texto text);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id int,cliente_id int);
 INSERT INTO vybe_conteudos VALUES(123,NULL,${board},'Teste','2026-12-30','2026-12-31',NOW());
 INSERT INTO vybe_conteudo_clientes VALUES(123,1),(123,2);`);
 await trocarData(sql,null,{item:'vybe:123',campo:'veiculacao',data:'2027-01-02'});
 assert.deepEqual(await sql`SELECT prazo::text,veiculacao::text FROM vybe_conteudos`,[{prazo:'2026-12-30',veiculacao:'2027-01-02'}]);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 await db.exec("ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK(para <> '2027-01-03')");
 await assert.rejects(trocarData(sql,null,{item:'vybe:123',campo:'prazo',data:'2027-01-03'}));
 assert.equal((await sql`SELECT prazo::text FROM vybe_conteudos`)[0].prazo,'2026-12-30');
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 }finally{await db.close();}
});
