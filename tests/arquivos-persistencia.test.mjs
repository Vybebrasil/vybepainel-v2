import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {database} from './postgres.mjs';
const fonte=fs.readFileSync('api/painel.js','utf8');
test('operador remove apenas arquivo da atividade; releitura e histórico persistem juntos',async()=>{
 const {db,sql}=await database();const drive=[];
 try {
 await db.exec(`CREATE TABLE vybe_conteudo_arquivos(id int primary key,conteudo_id int,nome text,drive_file_id text,ausente_em timestamptz);
 INSERT INTO vybe_conteudo_arquivos VALUES(8,1,'arte.png','drive-teste',NULL),(9,1,'legado.png',NULL,NULL);
 ALTER TABLE vybe_conteudo_eventos ADD COLUMN texto text, ADD COLUMN em timestamptz;
 ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK(tipo<>'anexo_removido');`);
 const c=vm.createContext({sql:()=>sql,arquivarNoDrive:async id=>drive.push(id)});
 vm.runInContext(fonte.slice(fonte.indexOf('async function removerArquivoDaPeca'),fonte.indexOf('async function pecaDoBanco')),c);
 let status,body;const res={status(n){status=n;return this;},json(v){body=v;}};
 const remover=(item='vybe:1',arquivo_id=8)=>c.removerArquivoDaPeca({body:{item,arquivo_id}},res,{tipo:'sessao',pessoa:{id:2,admin:false}});
 await remover('vybe:2');assert.equal(status,404);assert.equal(drive.length,0);
 await remover('vybe:1',-1);assert.equal(status,400);
 await remover('vybe:1',9);assert.equal(status,409);assert.equal(drive.length,0);
 c.arquivarNoDrive=async()=>{throw Error('Drive indisponível');};await assert.rejects(remover());
 assert.equal((await sql`SELECT ausente_em FROM vybe_conteudo_arquivos WHERE id=8`)[0].ausente_em,null);
 c.arquivarNoDrive=async id=>drive.push(id);await assert.rejects(remover());
 assert.equal((await sql`SELECT ausente_em FROM vybe_conteudo_arquivos WHERE id=8`)[0].ausente_em,null);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,0);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT falha');await remover();
 assert.equal(status,200);assert.equal(body.reversivel,true);
 assert.ok((await sql`SELECT ausente_em FROM vybe_conteudo_arquivos WHERE id=8`)[0].ausente_em);
 assert.equal((await sql`SELECT autor_id FROM vybe_conteudo_eventos`)[0].autor_id,2);
 await remover();assert.equal(status,404);assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 } finally {await db.close();}
});
