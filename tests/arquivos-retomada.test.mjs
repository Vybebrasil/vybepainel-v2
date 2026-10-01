import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {database} from './postgres.mjs';
const fonte=fs.readFileSync('vybe-arquivos.js','utf8');
function navegador(storage=new Map()) {
 const chamadas=[],avisos=[];let confirmar=false,pessoa=2;
 const c=vm.createContext({Map,Set,JSON,Number,String,Array,Error,
 sessaoAtual:()=>({id:pessoa}),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 document:{getElementById:()=>null},activeWorkspaceItemId:'vybe:1',showToast:(...a)=>avisos.push(a),safeText:String,
 findOperationalItem:id=>({id}),atualizarGavetaPreservandoRascunhos:async()=>{},
 FileReader:class{readAsDataURL(){this.result='data:image/png;base64,YQ==';this.onload();}},
 fetch:async(url,op)=>{const b=JSON.parse(op.body);chamadas.push(b);const d=b.etapa==='abrir'?{sessao:'sessao-teste'}:b.etapa==='parte'?{concluido:true,id:'drive-teste'}:confirmar?{ok:true,arquivo_id:8}:{error:'Banco indisponível'};return {ok:b.etapa!=='registrar'||confirmar,status:503,json:async()=>d};}});
 vm.runInContext(fonte,c);const file={name:'arte.png',type:'image/png',size:4*1024*1024,lastModified:42,slice:()=>({size:2*1024*1024})};
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
