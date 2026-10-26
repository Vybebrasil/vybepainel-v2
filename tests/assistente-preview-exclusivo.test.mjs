import test from 'node:test';
import assert from 'node:assert/strict';
import {atenderBotAssistente} from '../server/assistente-servico.js';
import {autorizarConversa} from '../server/assistente-politica.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';
const admin='1111111111@lid',outro='2222222222@c.us',grupo='123456789-123@g.us',segredo='s'.repeat(40);
const config={VYBE_AI_ATIVA:'1',VYBE_AI_BOT_TOKEN:'A'.repeat(64),VYBE_AI_LINK_SECRET:segredo,VYBE_AI_GRUPOS_IDS:grupo,VYBE_AI_ADMIN_JID_HASH:identificadorProtegido(admin,segredo),VYBE_AI_ADMIN_PESSOA_ID:'42'};
const ctx=()=>({tipo:'privado',participantes:[admin],grupos_remetente:[grupo],observado_em:Date.now()});
async function handler(body,cfg=config,banco=()=>{throw Error('Banco não esperado');}){
 const res={status(n){this.codigo=n;return this;},json(d){this.dados=d;return this;}};
 await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body},res,banco,cfg);return res;
}
test('servidor: bloqueios em todas as entradas antes de banco, Hub ou rede',async()=>{
 let bancos=0,rede=0;const fetchAnterior=globalThis.fetch;globalThis.fetch=()=>{rede++;throw Error('Rede proibida');};
 try{
 const casos=[{jid:outro},{jid:'9999999999@lid'},{jid:undefined},{jid:[admin]},{jid:admin+' '},{contexto:{...ctx(),tipo:'grupo',grupo_id:grupo}},{contexto:{...ctx(),participantes:[admin,outro]}},{contexto:{...ctx(),grupo_id:grupo}},{contexto:{...ctx(),participantes:[]}},{contexto:undefined},{jid:outro,admin:true,pessoa_id:42,texto:admin}];
 const configs=[{...config,VYBE_AI_ADMIN_JID_HASH:undefined},{...config,VYBE_AI_ADMIN_JID_HASH:'inválido'},{...config,VYBE_AI_ADMIN_PESSOA_ID:undefined},{...config,VYBE_AI_ADMIN_PESSOA_ID:'42x'}];
 for(const consulta of ['autorizar_contexto','operacional','minhas_demandas','vinculacao_confirmar']){
 for(const caso of casos){const r=await handler({jid:admin,contexto:ctx(),consulta,ferramenta:'consultar_metricas_trafego',...caso},config,()=>{bancos++;throw Error('Proibido');});assert.equal(r.codigo,403);assert.doesNotMatch(JSON.stringify(r.dados),/111111|222222|token|senha/);}
 for(const cfg of configs)assert.equal((await handler({jid:admin,contexto:ctx(),consulta},cfg,()=>{bancos++;})).codigo,403);
 }
 assert.equal(bancos,0);assert.equal(rede,0);
 }finally{globalThis.fetch=fetchAnterior;}
});
test('servidor: admin vinculado no privado recebe catálogo, mantém grupo, token e conta obrigatórios',async()=>{
 const sql=async(strings)=>strings.join('').includes('to_regclass')?[{pronta:true}]:[{hash:config.VYBE_AI_ADMIN_JID_HASH,id:42}];
 const body={jid:admin,contexto:ctx(),consulta:'autorizar_contexto'};
 assert.equal((await handler(body,config,()=>sql)).codigo,200);
 assert.equal((await handler({...body,contexto:{...ctx(),grupos_remetente:[]}},config,()=>sql)).codigo,403);
 assert.equal((await handler(body,config,()=>async()=>[])).codigo,403);
 const errado=async(strings)=>strings.join('').includes('to_regclass')?[{pronta:true}]:[{hash:config.VYBE_AI_ADMIN_JID_HASH,id:43}];
 assert.equal((await handler(body,config,()=>errado)).codigo,403);
 const r={status(n){this.codigo=n;return this;},json(){return this;}};
 await atenderBotAssistente({method:'POST',headers:{},body},r,()=>{throw Error('Não abrir');},config);assert.equal(r.codigo,401);
 await assert.rejects(()=>autorizarConversa(()=>{throw Error('Não consultar');},outro,ctx(),segredo,config),{status:403});
});
import {conexao} from './postgres.mjs';
test('Preview: retirar admin revoga consulta sem alterar vínculo',async()=>{const {db,sql}=conexao();try{await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,senha_hash text,admin boolean);INSERT INTO vybe_pessoas VALUES(42,true,true,'fixture',true);CREATE TABLE vybe_ai_vinculos(jid_hash text,pessoa_id bigint,revogado_em timestamptz);`);await sql`INSERT INTO vybe_ai_vinculos VALUES(${config.VYBE_AI_ADMIN_JID_HASH},42,NULL)`;const body={jid:admin,contexto:ctx(),consulta:'autorizar_contexto'};assert.equal((await handler(body,config,()=>sql)).codigo,200);await sql`UPDATE vybe_pessoas SET admin=false WHERE id=42`;assert.equal((await handler(body,config,()=>sql)).codigo,403);}finally{await db.close();}});
