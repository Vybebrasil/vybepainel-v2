import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {database} from './postgres.mjs';
import {comentar} from '../api/conteudo.js';
const painel=fs.readFileSync('api/painel.js','utf8');
test('entrega e bastão sobrevivem a mais de 12 notas; falha de histórico reverte comentário',async()=>{
 const {db,sql}=await database();try{
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN titulo text;
 CREATE TABLE vybe_conteudo_updates(id serial primary key,conteudo_id int,corpo text,autor text,autor_id int,criado_em timestamptz,monday_update_id text);
 ALTER TABLE vybe_conteudo_eventos ADD COLUMN texto text;
 ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK(tipo <> 'comentario');`);
 await assert.rejects(comentar(sql,null,{item:'900',texto:'[Vybe OS · Link de entrega] https://example.test/final'}));
 assert.equal((await sql`SELECT * FROM vybe_conteudo_updates`).length,0);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT falha');
 for(const texto of ['[Vybe OS · Link de entrega] https://example.test/antigo','[Vybe OS · Link de entrega] https://example.test/final','[Vybe OS · Passagem de bastão]\nConcluído: arte\nPróximo passo: agendar'])await comentar(sql,null,{item:'900',texto});
 for(let i=0;i<15;i++)await comentar(sql,null,{item:'900',texto:'Nota '+i});
 const c=vm.createContext({BOARD_DEMANDAS:8385559107,COLUNA_ARQUIVOS:'files',garantirColunaDePrevia:async()=>{},garantirMaterialBruto:async()=>{},garantirColunasDeUpdate:async()=>{},
 sql:()=>async(parts,...params)=>{const q=parts.join('');if(q.includes('SELECT c.id, c.titulo'))return [{id:1}];if(q.includes('FROM vybe_conteudo_updates u'))return await sql(parts,...params);return [];}});
 vm.runInContext(painel.slice(painel.indexOf('async function areaPeca'),painel.indexOf('async function removerArquivoDaPeca')),c);
 let result;await c.areaPeca({method:'GET',query:{item:'900'}},{status(){return this;},json(d){result=d;}},{tipo:'servico'});
 assert.equal(result.updates.length,14);
 assert.ok(result.updates.some(u=>u.body.endsWith('https://example.test/final')));
 assert.ok(result.updates.some(u=>u.body.includes('Próximo passo: agendar')));
 assert.ok(!result.updates.some(u=>u.body.endsWith('https://example.test/antigo')));
 }finally{await db.close();}
});
test('anexo e histórico revertem juntos; registro continua disponível sem liberação de prévia',async()=>{
 const {db,sql}=await database();try{
 await db.exec(`CREATE TABLE vybe_conteudo_arquivos(id serial primary key,conteudo_id int,nome text,extensao text,tamanho_bytes bigint,url_drive text,drive_file_id text,criado_em timestamptz,migrado_em timestamptz,previa_liberada_em timestamptz,ausente_em timestamptz);
 ALTER TABLE vybe_conteudo_eventos ADD COLUMN em timestamptz; ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK(tipo <> 'anexo');`);
 const c=vm.createContext({sql:()=>sql,console:{warn(){}},garantirColunaDePrevia:async()=>{},tornarPublico:async()=>{throw Error('offline');}});
 vm.runInContext(painel.slice(painel.indexOf('async function registrarArquivoDaPeca'),painel.indexOf('async function anexarNaPeca')),c);
 const gravar=()=>c.registrarArquivoDaPeca({id:1},{tipo:'servico'},{nome:'arte.png',driveId:'arquivo-isolado',bytes:10});
 await assert.rejects(gravar());assert.equal((await sql`SELECT * FROM vybe_conteudo_arquivos`).length,0);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT falha');await gravar();
 const [a]=await sql`SELECT * FROM vybe_conteudo_arquivos`;assert.equal(a.drive_file_id,'arquivo-isolado');assert.equal(a.previa_liberada_em,null);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 }finally{await db.close();}
});
function handoff(){
 const elements={'handoff-done':{value:'Arte pronta'},'handoff-next':{value:'Agendar'},'handoff-link':{value:''},'workspace-drawer':{}};
 const avisos=[],calls=[];const c=vm.createContext({document:{getElementById:id=>elements[id],querySelector:()=>({})},pendingWorkflowChange:{item:{id:'1'},manual:true},
 showToast:(...a)=>avisos.push(a),tentarEscritaDupla:async()=>true,closeWorkflowModal:()=>calls.push('fechou'),atualizarGavetaPreservandoRascunhos:async()=>calls.push('gaveta'),commitStatusChange:async()=>calls.push('status')});
 const s=fs.readFileSync('vybe-status.js','utf8');vm.runInContext(s.slice(s.indexOf('let handoffEnviando'),s.indexOf('\n}',s.indexOf('let handoffEnviando'))+2),c);return {c,avisos,calls};
}
test('bastão recusado mantém formulário e não anuncia sucesso nem altera status',async()=>{
 const {c,avisos,calls}=handoff();c.tentarEscritaDupla=async()=>false;await c.submitHandoff();assert.deepEqual(calls,[]);assert.equal(avisos.at(-1)[1],'err');
});
test('bastão impede envio duplicado e distingue falha de releitura',async()=>{
 const {c,avisos}=handoff();let liberar,n=0;c.tentarEscritaDupla=async()=>{n++;await new Promise(r=>liberar=r);return true;};
 c.atualizarGavetaPreservandoRascunhos=async()=>{throw Error('offline');};const p=c.submitHandoff();await c.submitHandoff();liberar();await p;
 assert.equal(n,1);assert.equal(avisos.at(-1)[1],'info');assert.match(avisos.at(-1)[0],/Passagem salva/);
});
test('upload confirmado não vira falha por releitura e utiliza a gaveta capturada',async()=>{
 const drawer={},avisos=[];let recebido;
 const c=vm.createContext({activeWorkspaceItemId:'1',document:{getElementById:()=>drawer},findOperationalItem:id=>({id}),showToast:(...a)=>avisos.push(a),enviarArquivoDaPeca:async()=>({ok:true}),renderOutboundItemPatch(){},
 atualizarGavetaPreservandoRascunhos:async(i,d)=>{recebido=d;throw Error('offline');}});
 const s=fs.readFileSync('vybe-arquivos.js','utf8');vm.runInContext(s.slice(s.indexOf('async function uploadWorkspaceFile')),c);
 const input={files:[{name:'arte.png',size:10}],value:'arquivo'};await c.uploadWorkspaceFile(input);
 assert.equal(recebido,drawer);assert.match(avisos.at(-1)[0],/Arquivos anexados/);assert.equal(avisos.at(-1)[1],'info');assert.equal(input.value,'');
});
