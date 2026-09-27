import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { trocarStatus } from '../api/conteudo.js';
const fonte=fs.readFileSync('vybe-status.js','utf8');
function contexto(){
 const item={id:'vybe:1',status:'Antes',clientes:['A','B']},avisos=[],renders=[];
 const elements={'workspace-drawer':{},'workspace-comment-input':{value:'rascunho'},'workspace-link-input':{value:'https://exemplo.test'}};
 const c=vm.createContext({Date,Set,document:{getElementById:id=>elements[id]},activeWorkspaceItemId:item.id,activeBoard:'demandas',DADOS_DEMANDAS:[item],
 showToast:(...a)=>avisos.push(a),armOutboundMutationGuard(){},chaveDeStatus:s=>s,tentarEscritaDupla:async()=>({}),
 updateLocalStatus:(_id,o)=>{item.status=o.label;},aplicarEfeitoDaAutomacao:()=>'',isRequestItem:()=>true,
 renderIntegratedOperationalViews(){},renderDemandas(){},closeStatusEditor(){},renderFocusUserPicker(){},
 fetchWorkspaceItem:async()=>({}),findOperationalItem:()=>item,recadoDeStatusRecusado:e=>e.message,
 renderWorkspaceDrawer:()=>{renders.push(item.id);elements['workspace-comment-input']={value:''};elements['workspace-link-input']={value:''};}});
 vm.runInContext(fonte.slice(fonte.indexOf('const statusEmGravacao'),fonte.indexOf('// O servidor recusa')),c);
 return {c,item,avisos,elements,renders};
}
test('releitura falha depois de salvar não transforma a confirmação em erro de gravação',async()=>{
 const {c,item,avisos}=contexto();c.fetchWorkspaceItem=async()=>{throw Error('offline');};
 await c.commitStatusChange(item,{label:'Depois'});
 assert.equal(item.status,'Depois');assert.match(avisos.at(-1)[0],/Status salvo/);assert.equal(avisos.some(a=>a[1]==='err'),false);
});
test('falha de escrita mantém status e rascunhos',async()=>{
 const {c,item,avisos,elements}=contexto();c.tentarEscritaDupla=async()=>{throw Error('recusado');};
 await c.commitStatusChange(item,{label:'Depois'});
 assert.equal(item.status,'Antes');assert.equal(elements['workspace-comment-input'].value,'rascunho');assert.equal(avisos.at(-1)[1],'err');
});
test('redesenho preserva comentários e links ainda não enviados e usa status final da automação',async()=>{
 const {c,item,elements}=contexto();c.tentarEscritaDupla=async()=>({depois:{status:'Final',status_color:'#abc',status_index:null}});
 await c.commitStatusChange(item,{label:'Intermediário'});
 assert.equal(item.status,'Final');assert.equal(item.status_color,'#abc');assert.deepEqual(item.clientes,['A','B']);
 assert.equal(elements['workspace-comment-input'].value,'rascunho');assert.equal(elements['workspace-link-input'].value,'https://exemplo.test');
});
test('resposta atrasada não redesenha a atividade aberta depois e envio repetido não grava duas vezes',async()=>{
 const {c,item,elements,renders}=contexto();let liberar, chamadas=0;
 c.tentarEscritaDupla=async()=>{chamadas++;await new Promise(r=>{liberar=r;});return {};};
 const p=c.commitStatusChange(item,{label:'Depois'});await c.commitStatusChange(item,{label:'Outro'});
 elements['workspace-drawer']={};c.activeWorkspaceItemId='vybe:2';liberar();await p;
 assert.equal(chamadas,1);assert.deepEqual(renders,[]);
});
async function banco(){
 const {db,sql}=conexao();await db.exec(`
 CREATE TABLE vybe_conteudos(id int primary key,monday_item_id text,board_id bigint,titulo text,status_chave text,status_em timestamptz,atualizado_em timestamptz,grupo_id text,etapa text,formato_chaves text[],captacao_chave text);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,cor text,borda text);
 CREATE TABLE vybe_conteudo_eventos(conteudo_id int,tipo text,de text,para text,autor_id int,texto text);
 CREATE TABLE vybe_clientes(id int,nome text);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id int,cliente_id int);
 CREATE TABLE vybe_pessoas(id int,monday_user_id text,nome text);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id int,pessoa_id int,ordem int);
 CREATE TABLE vybe_automacoes(id int,nome text,ativa boolean,ordem int,gatilho jsonb,condicao jsonb,acoes jsonb);
 CREATE TABLE vybe_automacao_execucoes(automacao_id int,conteudo_id int,resultado jsonb,em timestamptz DEFAULT NOW());
 INSERT INTO vybe_conteudos VALUES(1,NULL,7829537690,'Peça','antes',NOW(),NOW(),'grupo','Grupo',NULL,NULL);
 INSERT INTO vybe_status VALUES(7829537690,'antes','Antes',0,'#aaa','#aaa'),(7829537690,'depois','Depois',1,'#bbb','#bbb'),(7829537690,'final','Final',NULL,'#ccc','#ddd');
 INSERT INTO vybe_clientes VALUES(1,'A'),(2,'B');INSERT INTO vybe_conteudo_clientes VALUES(1,1),(1,2);
 INSERT INTO vybe_pessoas VALUES(1,'100','Pessoa');INSERT INTO vybe_conteudo_responsaveis VALUES(1,1,0);`);
 return {db,sql};
}
test('status e histórico são atômicos e preservam vínculos',async()=>{
 const {db,sql}=await banco();try{
 await db.exec("ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT recusa CHECK(para <> 'Depois')");
 await assert.rejects(trocarStatus(sql,null,{item:'vybe:1',para:'depois'}));
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'antes');
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,0);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT recusa');
 await trocarStatus(sql,null,{item:'vybe:1',para:'depois'});
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'depois');
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_responsaveis`).length,1);
 }finally{await db.close();}
});
test('automação devolve status final e metadados do próprio quadro',async()=>{
 const {db,sql}=await banco();try{
 await db.exec(`INSERT INTO vybe_automacoes VALUES(1,'Concluir',true,1,'{"tipo":"status","para":"depois"}',NULL,'[{"tipo":"status","para":"final"}]');`);
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'depois'});
 assert.equal(r.depois.status,'Final');assert.equal(r.depois.status_color,'#ccc');assert.equal(r.depois.status_index,null);
 assert.deepEqual(r.depois.responsavel_ids,['100']);assert.equal(r.automacoes.length,1);
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'final');
 }finally{await db.close();}
});
