import test from 'node:test';
import assert from 'node:assert/strict';
import { protegerUpload, abrirContextoUpload } from '../server/upload-contexto.js';
import { enviarParteNoDrive, consultarUploadNoDrive } from '../vybe_drive.js';
const sessao='https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=teste';
test('contexto oculta URL e recusa pessoa, peça, expiração e adulteração',()=>{
 const antes=process.env.SESSAO_SECRET;process.env.SESSAO_SECRET='segredo-isolado-teste';
 try {
 const quem={tipo:'sessao',pessoa:{id:2}};const dados={sessao,total:10,item:'vybe:1'};
 const token=protegerUpload(dados,quem);
 assert.equal(token.includes('googleapis'),false);
 assert.equal(abrirContextoUpload(token,quem,'vybe:1').sessao,sessao);
 assert.throws(()=>abrirContextoUpload(token,{tipo:'sessao',pessoa:{id:3}},'vybe:1'));
 assert.throws(()=>abrirContextoUpload(token,quem,'vybe:2'));
 assert.throws(()=>abrirContextoUpload('xxx'+token.slice(3),quem,'vybe:1'));
 const agora=Date.now;try {Date.now=()=>agora()+8*86400000;assert.throws(()=>abrirContextoUpload(token,quem,'vybe:1'));}finally{Date.now=agora;}
 }finally{if(antes===undefined)delete process.env.SESSAO_SECRET;else process.env.SESSAO_SECRET=antes;}
});
test('Drive usa Range real, consulta vazia, conclusão e expiração; bloqueia endereço externo',async()=>{
 const original=global.fetch;let status=308,range='bytes=0-1',op,vezes=0;
 global.fetch=async(u,o)=>{vezes++;op=o;return {status,ok:status===200,headers:new Headers(range?{Range:range}:{}),json:async()=>({id:'arquivo'})};};
 try {
 assert.equal((await enviarParteNoDrive({sessao,total:10,inicio:0,conteudo:Buffer.from('abc')})).recebido,2);
 assert.equal(op.redirect,'manual');range=null;
 assert.equal((await consultarUploadNoDrive({sessao,total:10})).recebido,0);
 assert.equal(op.headers['Content-Range'],'bytes */10');assert.equal(op.body.length,0);
 status=200;assert.equal((await consultarUploadNoDrive({sessao,total:10})).id,'arquivo');
 status=404;assert.equal((await consultarUploadNoDrive({sessao,total:10})).expirado,true);
 const antes=vezes;await assert.rejects(consultarUploadNoDrive({sessao:'https://evil.example',total:10}));assert.equal(vezes,antes);
 await assert.rejects(enviarParteNoDrive({sessao,total:10,inicio:9,conteudo:Buffer.from('abc')}));
 }finally{global.fetch=original;}
});
test('API vincula consulta e trecho à sessão e usa o total protegido',async()=>{
 const {default:fs}=await import('node:fs');const {default:vm}=await import('node:vm');
 const antes=process.env.SESSAO_SECRET;process.env.SESSAO_SECRET='teste-api-isolada';
 try {
 const fonte=fs.readFileSync('api/painel.js','utf8');let enviada;
 const c=vm.createContext({abrirContextoUpload,consultarUploadNoDrive:async d=>{enviada=d;return {recebido:2};},enviarParteNoDrive:async d=>{enviada=d;return {recebido:4};}});
 vm.runInContext(fonte.slice(fonte.indexOf('async function anexarNaPeca'),fonte.indexOf('// ── clientes')),c);
 const quem={tipo:'sessao',pessoa:{id:2}};
 const contexto=protegerUpload({sessao,total:10,item:'vybe:1'},quem);
 const res={status(n){this.codigo=n;return this;},json(d){this.dados=d;return this;}};
 await c.anexarNaPeca({body:{item:'vybe:1',nome:'arte.png',etapa:'consultar',contexto}},res,quem);
 assert.equal(res.codigo,200);assert.equal(enviada.total,10);
 await c.anexarNaPeca({body:{item:'vybe:1',nome:'arte.png',etapa:'parte',contexto,total:999,inicio:2,conteudo:'YQ=='}},res,quem);
 assert.equal(enviada.total,10);assert.equal(enviada.inicio,2);
 enviada=null;await c.anexarNaPeca({body:{item:'vybe:2',nome:'arte.png',etapa:'consultar',contexto}},res,quem);
 assert.equal(res.codigo,400);assert.equal(enviada,null);
 }finally{if(antes===undefined)delete process.env.SESSAO_SECRET;else process.env.SESSAO_SECRET=antes;}
});
