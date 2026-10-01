import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import {database} from './postgres.mjs';
const fonte=fs.readFileSync('vybe-arquivos.js','utf8');
function navegador(storage=new Map()) {
 const chamadas=[],avisos=[];let confirmar=false,pessoa=2;
 const c=vm.createContext({Map,Set,JSON,Number,String,Array,Error,crypto:webcrypto,Uint8Array,
 sessaoAtual:()=>({id:pessoa}),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:()=>null},activeWorkspaceItemId:'vybe:1',showToast:(...a)=>avisos.push(a),safeText:String,
 findOperationalItem:id=>({id}),atualizarGavetaPreservandoRascunhos:async()=>{},
 FileReader:class{readAsDataURL(){this.result='data:image/png;base64,YQ==';this.onload();}},
 fetch:async(url,op)=>{const b=JSON.parse(op.body);chamadas.push(b);const d=b.etapa==='abrir'?{contexto:'contexto-teste'}:b.etapa==='consultar'?{concluido:false,recebido:0}:b.etapa==='parte'?{concluido:true,id:'drive-teste'}:confirmar?{ok:true,arquivo_id:8}:{error:'Banco indisponível'};return {ok:b.etapa!=='registrar'||confirmar,status:503,json:async()=>d};}});
 vm.runInContext(fonte,c);const file={name:'arte.png',type:'image/png',size:4*1024*1024,lastModified:42,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer,slice:()=>({size:2*1024*1024})};
 return {c,file,storage,chamadas,avisos,confirmar:()=>confirmar=true,trocar:id=>pessoa=id};
}
test('registro pendente sobrevive a recarregar e retoma sem abrir sessão ou enviar bytes',async()=>{
 const a=navegador();await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/Arquivo no Drive; registro pendente/);
 assert.equal(a.c.registrosDeArquivoPendentes().length,1);
 const b=navegador(a.storage);b.confirmar();await b.c.retomarRegistroDeArquivo('drive-teste');
 assert.deepEqual(b.chamadas.map(x=>x.etapa),['registrar']);assert.equal(b.c.registrosDeArquivoPendentes().length,0);
 assert.ok(b.avisos.some(x=>x[1]==='ok'));
});
test('selecionar o mesmo arquivo repete somente o registro; outra conta não recebe pendências',async()=>{
 const a=navegador();await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file));
 a.chamadas.length=0;await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/já no Drive/);
 assert.deepEqual(a.chamadas.map(x=>x.etapa),['registrar']);
 a.trocar(3);assert.equal(a.c.registrosDeArquivoPendentes().length,0);
 a.trocar(2);a.confirmar();await a.c.enviarArquivoDaPeca('vybe:1',a.file);assert.equal(a.c.registrosDeArquivoPendentes().length,0);
});
test('resposta perdida mantém pendência; repetição de clique não dispara dois registros',async()=>{
 const a=navegador();await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file));
 let liberar,n=0;a.c.fetch=async()=>{n++;await new Promise(r=>liberar=r);throw Error('resposta perdida');};
 const p=a.c.retomarRegistroDeArquivo('drive-teste');await a.c.retomarRegistroDeArquivo('drive-teste');liberar();await p;
 assert.equal(n,1);assert.equal(a.c.registrosDeArquivoPendentes().length,1);
});
test('storage bloqueado avisa que pendência só está na aba e não perde a recuperação em memória',async()=>{
 const a=navegador();a.c.localStorage.setItem=()=>{throw Error('quota');};
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file));
 assert.equal(a.c.registrosDeArquivoPendentes().length,1);assert.ok(a.avisos.some(x=>x[0].includes('Não feche')));
});
test('registro repetido e concorrente mantém um anexo e um evento; não restaura removido',async()=>{
 const {db,sql}=await database();try {
 await db.exec(`CREATE TABLE vybe_conteudo_arquivos(id serial primary key,conteudo_id int,nome text,extensao text,tamanho_bytes bigint,url_drive text,drive_file_id text,criado_em timestamptz,migrado_em timestamptz,previa_liberada_em timestamptz,ausente_em timestamptz);
 ALTER TABLE vybe_conteudo_eventos ADD COLUMN em timestamptz;`);
 const c=vm.createContext({sql:()=>sql,garantirColunaDePrevia:async()=>{},tornarPublico:async()=>{}});
 const s=fs.readFileSync('api/painel.js','utf8');vm.runInContext(s.slice(s.indexOf('async function registrarArquivoDaPeca'),s.indexOf('async function anexarNaPeca')),c);
 const gravar=()=>c.registrarArquivoDaPeca({id:1},{tipo:'sessao',pessoa:{id:2}},{nome:'arte.png',driveId:'drive-teste',bytes:42});
 const resultados=await Promise.all([gravar(),gravar()]);assert.equal(resultados[0].arquivo_id,resultados[1].arquivo_id);
 await gravar();assert.equal((await sql`SELECT * FROM vybe_conteudo_arquivos`).length,1);assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 await sql`UPDATE vybe_conteudo_arquivos SET ausente_em=NOW()`;await assert.rejects(gravar(),/já foi removido/);
 } finally {await db.close();}
});

test('recarga consulta o Drive e retoma do offset confirmado sem abrir outra sessão',async()=>{
 const a=navegador();const base=a.c.fetch;
 a.c.fetch=async(u,o)=>JSON.parse(o.body).etapa==='parte'?Promise.reject(Error('offline')):base(u,o);
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/offline/);
 const b=navegador(a.storage);b.confirmar();const fetch=b.c.fetch;
 b.c.fetch=async(u,o)=>JSON.parse(o.body).etapa==='consultar'?{ok:true,json:async()=>({concluido:false,recebido:1048576})}:fetch(u,o);
 await b.c.enviarArquivoDaPeca('vybe:1',b.file);
 assert.equal(b.chamadas.find(x=>x.etapa==='parte').inicio,1048576);
 assert.equal(b.chamadas.some(x=>x.etapa==='abrir'),false);
 assert.equal(b.c.registrosDeArquivoPendentes().length,0);
});
test('última resposta perdida é recuperada pelo botão sem arquivo local ou reenvio',async()=>{
 const a=navegador();const base=a.c.fetch;
 a.c.fetch=async(u,o)=>JSON.parse(o.body).etapa==='parte'?Promise.reject(Error('resposta perdida')):base(u,o);
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file));
 const b=navegador(a.storage);b.confirmar();const fetch=b.c.fetch;const etapas=[];
 b.c.fetch=async(u,o)=>{const etapa=JSON.parse(o.body).etapa;etapas.push(etapa);return etapa==='consultar'?{ok:true,json:async()=>({concluido:true,id:'drive-teste'})}:fetch(u,o);};
 await b.c.retomarRegistroDeArquivo('contexto-teste');
 assert.deepEqual(etapas,['consultar','registrar']);assert.equal(b.c.registrosDeArquivoPendentes().length,0);
});
test('arquivo alterado com mesmos metadados não mistura bytes; progresso parado não cria loop',async()=>{
 const a=navegador();const base=a.c.fetch;
 a.c.fetch=async(u,o)=>JSON.parse(o.body).etapa==='parte'?{ok:true,json:async()=>({recebido:0})}:base(u,o);
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/avanço/);
 a.file.arrayBuffer=async()=>new Uint8Array([9]).buffer;
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/alterado/);
});
test('retomar incompleto oferece seleção por clique; expirado exige confirmação para descartar',async()=>{
 const a=navegador();const base=a.c.fetch;
 a.c.fetch=async(u,o)=>JSON.parse(o.body).etapa==='parte'?Promise.reject(Error('offline')):base(u,o);
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file));
 let cliques=0;a.c.document.getElementById=id=>id==='workspace-file-input'?{click:()=>cliques++}:null;
 await a.c.retomarRegistroDeArquivo('contexto-teste');assert.equal(cliques,0);
 assert.match(a.c.pendenciasDeArquivoHtml('vybe:1'),/Selecionar arquivo original/);
 await a.c.retomarRegistroDeArquivo('contexto-teste');assert.equal(cliques,1);
 a.c.fetch=async()=>({ok:false,json:async()=>({expirado:true})});
 await assert.rejects(a.c.enviarArquivoDaPeca('vybe:1',a.file),/expirou/);
 assert.match(a.c.pendenciasDeArquivoHtml('vybe:1'),/Descartar pendência/);
 a.c.perguntarNoPainel=async()=>false;await a.c.retomarRegistroDeArquivo('contexto-teste');assert.equal(a.c.registrosDeArquivoPendentes().length,1);
 a.c.perguntarNoPainel=async()=>true;await a.c.retomarRegistroDeArquivo('contexto-teste');assert.equal(a.c.registrosDeArquivoPendentes().length,0);
});
