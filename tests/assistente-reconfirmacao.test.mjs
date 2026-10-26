import {identificadorProtegido} from '../server/assistente-identidade.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
import {emitirCodigo, consumirCodigo} from '../server/assistente-vinculacao-fluxo.js';
import {atenderBotAssistente} from '../server/assistente-servico.js';

const segredo='segredo-ficticio-de-regressao-com-mais-de-32-caracteres';
const jid='99999999999999999999@lid';
const config={VYBE_AI_ATIVA:'1',VYBE_AI_LINK_SECRET:segredo,VYBE_AI_BOT_TOKEN:'A'.repeat(64),VYBE_AI_GRUPOS_IDS:'123456789-123@g.us'};
config.VYBE_AI_ADMIN_JID_HASH=identificadorProtegido(jid,segredo);config.VYBE_AI_ADMIN_PESSOA_ID='1';
async function confirmar(sql,codigo) {
 const req={method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{consulta:'vinculacao_confirmar',jid,codigo,
  contexto:{tipo:'privado',participantes:[jid],grupos_remetente:[config.VYBE_AI_GRUPOS_IDS],observado_em:Date.now()}}};
 const res={status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}};
 await atenderBotAssistente(req,res,()=>sql,config);return res;
}
async function preparar(t) {
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,senha_hash text);
 INSERT INTO vybe_pessoas VALUES(1,true,true,'ficticia'),(2,true,true,'ficticia'); ALTER TABLE vybe_pessoas ADD COLUMN admin boolean DEFAULT true;`);
 await db.exec(readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8'));
 return {db,sql};
}

test('código novo confirma vínculo da mesma pessoa sem 403; código usado continua proibido',async t=>{
 const {sql}=await preparar(t);
 const primeiro=await emitirCodigo(sql,1,segredo);
 assert.equal((await confirmar(sql,primeiro.codigo)).codigo,200);
 const novo=await emitirCodigo(sql,1,segredo);
 assert.equal((await confirmar(sql,novo.codigo)).codigo,200);
 assert.equal((await confirmar(sql,novo.codigo)).codigo,403);
 assert.equal(Number((await sql`SELECT count(*) AS n FROM vybe_ai_vinculos`)[0].n),1);
});

test('tentativa de transferir WhatsApp não consome o desafio nem troca o titular',async t=>{
 const {sql}=await preparar(t);
 const primeiro=await emitirCodigo(sql,1,segredo);
 assert.equal(await consumirCodigo(sql,jid,primeiro.codigo,segredo),true);
 const outro=await emitirCodigo(sql,2,segredo);
 assert.equal((await confirmar(sql,outro.codigo)).codigo,403);
 const [estado]=await sql`SELECT usado_em FROM vybe_ai_desafios WHERE pessoa_id=2`;
 assert.equal(estado.usado_em,null);
 assert.equal(Number((await sql`SELECT pessoa_id FROM vybe_ai_vinculos`)[0].pessoa_id),1);
 assert.equal(await consumirCodigo(sql,'88888888888888888888@lid',outro.codigo,segredo),true);
});

test('segredo diferente ou outro banco reproduz 403 sem consumir o código original',async t=>{
 const {sql}=await preparar(t);
 const outroBanco=await preparar(t);
 const desafio=await emitirCodigo(sql,1,segredo);
 assert.equal(await consumirCodigo(sql,jid,desafio.codigo,segredo+'diferente'),false);
 assert.equal((await confirmar(outroBanco.sql,desafio.codigo)).codigo,403);
 assert.equal((await sql`SELECT usado_em FROM vybe_ai_desafios`)[0].usado_em,null);
 assert.equal((await confirmar(sql,desafio.codigo)).codigo,200);
});
