import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {conexao} from './postgres.mjs';
import {atenderBotAssistente} from '../server/assistente-servico.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';
const require=createRequire(import.meta.url);
const {criarProcessador,RegistroMensagens,SIMULACAO}=require('../conectores/whatsapp/bot.js');
const {ErroVybe}=require('../conectores/whatsapp/vybe-api.js');
const jid='2222222222@lid',owner='1111111111@c.us',grupo='123456789-123@g.us';
const config={VYBE_AI_ATIVA:'1',VYBE_AI_BOT_TOKEN:'A'.repeat(64),VYBE_AI_LINK_SECRET:'s'.repeat(40),VYBE_AI_GRUPOS_IDS:grupo};
config.VYBE_AI_ADMIN_JID_HASH=identificadorProtegido(jid,config.VYBE_AI_LINK_SECRET);
config.VYBE_AI_ADMIN_PESSOA_ID='42';
async function preparar(){
 const {db,sql}=conexao();
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,senha_hash text);
 INSERT INTO vybe_pessoas VALUES(42,'Pessoa fictícia',true,true,'ficticio'),(43,'Outra pessoa fictícia',true,true,'ficticio'); ALTER TABLE vybe_pessoas ADD COLUMN admin boolean DEFAULT true;
 CREATE TABLE vybe_clientes(id bigint,nome text);
 CREATE TABLE vybe_conteudos(id bigint,titulo text,formato text,prazo date,veiculacao date,atualizado_em timestamptz,status_chave text,board_id bigint,removido_em timestamptz);ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS monday_item_id bigint;
 INSERT INTO vybe_conteudos VALUES(1,'Aberta vencida fictícia',NULL,'2020-01-01',NULL,now(),'aberta',8385559107,NULL),(2,'Finalizada fictícia',NULL,'2020-01-01',NULL,now(),'final',8385559107,NULL),(3,'Futura fictícia',NULL,'2099-01-01',NULL,now(),'aberta',8385559107,NULL),(4,'Outra pessoa fictícia',NULL,'2020-01-01',NULL,now(),'aberta',8385559107,NULL),(5,'Sem prazo fictícia',NULL,NULL,NULL,now(),'aberta',8385559107,NULL);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);INSERT INTO vybe_status VALUES(8385559107,'aberta','Em andamento',false),(8385559107,'final','Finalizado',true);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);INSERT INTO vybe_conteudo_responsaveis VALUES(1,42),(2,42),(3,42),(4,43),(5,42);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);`);
 await db.exec(readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8'));
 await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES(42,${identificadorProtegido(jid,config.VYBE_AI_LINK_SECRET)})`;
 return {db,sql};
}
for(const revogar of [false,true])test('fluxo real conector → handler → PostgreSQL isolado: atrasadas pessoais'+(revogar?' com revogação final':''),async()=>{
 const {db,sql}=await preparar(),registro=new RegistroMensagens(':memory:'),previas=[],logs=[];let leituras=0,modelo=0;
 const leitura=async(strings,...values)=>{assert.match(strings.join(''),/^\s*(SELECT|WITH)\b/i);leituras++;return sql(strings,...values);};
 const api=async dados=>{
  const res={status(n){this.codigo=n;return this;},json(d){this.dados=d;return this;}};
  await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:dados},res,()=>leitura,config);
  if(res.codigo!==200)throw new ErroVybe(res.codigo);
  if(revogar&&dados.consulta==='operacional')await db.exec('UPDATE vybe_pessoas SET ativo=false WHERE id=42');
  return res.dados;
 };
 const client={info:{wid:{_serialized:owner}},getChats:async()=>[{isGroup:true,name:'Produção',id:{_serialized:grupo},participants:[{id:{_serialized:jid}}]}]};
 const p=criarProcessador({client,registro,api,qwen:async()=>{modelo++;throw Error('Não chamar');},env:{VYBE_AI_ADMIN_JID:jid,VYBE_API_HABILITADA:'1',VYBE_GRUPOS_IDS:grupo},log:x=>logs.push(x),previaWhatsapp:x=>previas.push(x)});
 try{
  await p.processar({body:'!vybe Quais são as demandas atrasadas que estão sob minha responsabilidade? pessoa_id 43',from:jid,to:owner,fromMe:false,type:'chat',timestamp:Date.now()/1000,id:{_serialized:'mensagem-ficticia'},getChat:async()=>({id:{_serialized:jid},isGroup:false}),reply(){throw Error('Não enviar');}});
  assert.equal(modelo,0);assert.ok(leituras>0);assert.equal(SIMULACAO,true);
  if(revogar){assert.equal(previas.length,0);assert.ok(logs.includes('erro_AUTORIZACAO'));}
  else{assert.equal(previas.length,1);assert.match(previas[0],/Aberta vencida fictícia/);for(const x of ['Finalizada fictícia','Futura fictícia','Outra pessoa fictícia','Sem prazo fictícia'])assert.ok(!previas[0].includes(x));assert.ok(logs.includes('minhas_demandas_sucesso_quantidade_1_limitado_0'));}
  assert.ok(!logs.some(x=>x.includes('fictícia')));
 }finally{registro.close();await db.close();}
});
