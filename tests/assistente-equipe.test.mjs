import test from 'node:test';
import assert from 'node:assert/strict';
import {atenderBotAssistente} from '../server/assistente-servico.js';
import {escopoEquipe} from '../server/assistente-ativacao.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';
import {emitirCodigo} from '../server/assistente-vinculacao-fluxo.js';
import {conexao} from './postgres.mjs';

// Escopo equipe: qualquer pessoa ativa e vinculada; em grupo aprovado basta quem pergunta estar vinculado.
const admin='1111111111@lid',bia='2222222222@c.us',joao='3333333333@lid',estranho='9999999999@c.us';
const grupo='123456789-123@g.us',outroGrupo='987654321-987@g.us',segredo='s'.repeat(40);
const base={VYBE_AI_ATIVA:'1',VYBE_AI_BOT_TOKEN:'A'.repeat(64),VYBE_AI_LINK_SECRET:segredo,VYBE_AI_GRUPOS_IDS:grupo,
 VYBE_AI_ADMIN_JID_HASH:identificadorProtegido(admin,segredo),VYBE_AI_ADMIN_PESSOA_ID:'42'};
const equipe={...base,VYBE_AI_ESCOPO:'equipe'};
const privado=jid=>({tipo:'privado',participantes:[jid],grupos_remetente:[grupo],observado_em:Date.now()});
const emGrupo=participantes=>({tipo:'grupo',grupo_id:grupo,participantes,grupos_remetente:[grupo],observado_em:Date.now()});
async function chamar(body,cfg,sql){
 const res={status(n){this.codigo=n;return this;},json(d){this.dados=d;return this;}};
 await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+base.VYBE_AI_BOT_TOKEN},body},res,()=>sql,cfg);return res;
}
async function banco(){
 const {db,sql}=conexao();
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,senha_hash text,admin boolean);
  INSERT INTO vybe_pessoas VALUES(42,true,true,'x',true),(7,true,true,'x',false),(8,true,true,'x',false),(9,false,true,'x',false),(10,true,false,'x',false);
  CREATE TABLE vybe_ai_vinculos(id bigserial PRIMARY KEY,pessoa_id bigint NOT NULL,jid_hash char(64) NOT NULL UNIQUE,criado_em timestamptz NOT NULL DEFAULT NOW(),revogado_em timestamptz);
  CREATE TABLE vybe_ai_desafios(id bigserial PRIMARY KEY,pessoa_id bigint NOT NULL,codigo_hash char(64) NOT NULL UNIQUE,expira_em timestamptz NOT NULL,criado_em timestamptz NOT NULL DEFAULT NOW(),usado_em timestamptz);`);
 const vincular=(jid,pessoa)=>sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES(${pessoa},${identificadorProtegido(jid,segredo)})`;
 await vincular(admin,42);await vincular(bia,7);await vincular(joao,8);
 return {db,sql,vincular};
}

test('escopo equipe só com valor explícito',()=>{
 assert.equal(escopoEquipe({}),false);assert.equal(escopoEquipe({VYBE_AI_ESCOPO:'EQUIPE'}),false);assert.equal(escopoEquipe({VYBE_AI_ESCOPO:'equipe'}),true);
});
test('sem o escopo, pessoa vinculada que não é administradora continua bloqueada',async()=>{
 const {db,sql}=await banco();try{
  assert.equal((await chamar({jid:bia,contexto:privado(bia),consulta:'autorizar_contexto'},base,sql)).codigo,403);
  const r=await chamar({jid:admin,contexto:privado(admin),consulta:'autorizar_contexto'},base,sql);
  assert.equal(r.codigo,200);assert.equal(r.dados.pessoa_id,42);
 }finally{await db.close();}
});
test('equipe: pessoa ativa e vinculada consulta no privado com a própria identidade',async()=>{
 const {db,sql}=await banco();try{
  const r=await chamar({jid:bia,contexto:privado(bia),consulta:'autorizar_contexto'},equipe,sql);
  assert.equal(r.codigo,200);assert.equal(r.dados.pessoa_id,7);assert.ok(Array.isArray(r.dados.ferramentas));
  assert.equal((await chamar({jid:admin,contexto:privado(admin),consulta:'autorizar_contexto'},equipe,sql)).dados.pessoa_id,42);
 }finally{await db.close();}
});
test('equipe: sem vínculo, inativo, sem acesso ao painel ou vínculo revogado não consultam',async()=>{
 const {db,sql,vincular}=await banco();try{
  const r=await chamar({jid:estranho,contexto:privado(estranho),consulta:'autorizar_contexto'},equipe,sql);
  assert.equal(r.codigo,403);assert.equal(r.dados.error,'Conta WhatsApp não vinculada.');
  await vincular('4444444444@c.us',9);await vincular('5555555555@c.us',10);
  for(const jid of ['4444444444@c.us','5555555555@c.us'])assert.equal((await chamar({jid,contexto:privado(jid),consulta:'autorizar_contexto'},equipe,sql)).codigo,403);
  await sql`UPDATE vybe_ai_vinculos SET revogado_em=NOW() WHERE pessoa_id=7`;
  assert.equal((await chamar({jid:bia,contexto:privado(bia),consulta:'autorizar_contexto'},equipe,sql)).codigo,403);
 }finally{await db.close();}
});
test('equipe: no grupo aprovado basta quem pergunta estar vinculado',async()=>{
 const {db,sql}=await banco();try{
  const ok=await chamar({jid:joao,contexto:emGrupo([admin,bia,joao]),consulta:'autorizar_contexto'},equipe,sql);
  assert.equal(ok.codigo,200);assert.equal(ok.dados.pessoa_id,8);
  const comEstranho=await chamar({jid:joao,contexto:emGrupo([admin,bia,joao,estranho]),consulta:'autorizar_contexto'},equipe,sql);
  assert.equal(comEstranho.codigo,200);assert.equal(comEstranho.dados.pessoa_id,8);
  assert.equal((await chamar({jid:joao,contexto:{...emGrupo([bia,joao]),grupo_id:outroGrupo,grupos_remetente:[outroGrupo]},consulta:'autorizar_contexto'},equipe,sql)).codigo,403);
  // Quem pergunta sem vínculo, ou fora da lista de participantes, continua recusado.
  const semVinculo=await chamar({jid:estranho,contexto:emGrupo([bia,joao,estranho]),consulta:'autorizar_contexto'},equipe,sql);
  assert.equal(semVinculo.codigo,403);assert.equal(semVinculo.dados.error,'Conta WhatsApp não vinculada.');
  assert.equal((await chamar({jid:estranho,contexto:emGrupo([bia,joao]),consulta:'autorizar_contexto'},equipe,sql)).codigo,403);
 }finally{await db.close();}
});
test('equipe: código gerado pela própria pessoa vincula o WhatsApp dela, só no privado',async()=>{
 const {db,sql}=await banco();try{
  const novo='6666666666@lid';
  const emitido=await emitirCodigo(sql,7,segredo); // segundo número da mesma pessoa
  assert.ok(emitido?.codigo);
  assert.equal((await chamar({jid:novo,contexto:emGrupo([novo,bia]),consulta:'vinculacao_confirmar',codigo:emitido.codigo},equipe,sql)).codigo,403);
  const r=await chamar({jid:novo,contexto:privado(novo),consulta:'vinculacao_confirmar',codigo:emitido.codigo},equipe,sql);
  assert.equal(r.codigo,200);assert.equal(r.dados.ok,true);
  assert.equal((await chamar({jid:novo,contexto:privado(novo),consulta:'autorizar_contexto'},equipe,sql)).dados.pessoa_id,7);
  // Código reutilizado não vincula outro número.
  assert.equal((await chamar({jid:'7777777777@lid',contexto:privado('7777777777@lid'),consulta:'vinculacao_confirmar',codigo:emitido.codigo},equipe,sql)).codigo,403);
 }finally{await db.close();}
});
test('sem o escopo, código de quem não é administrador não vincula',async()=>{
 const {db,sql}=await banco();try{
  const emitido=await emitirCodigo(sql,8,segredo);
  const r=await chamar({jid:admin,contexto:privado(admin),consulta:'vinculacao_confirmar',codigo:emitido.codigo},base,sql);
  assert.equal(r.codigo,403);
 }finally{await db.close();}
});
