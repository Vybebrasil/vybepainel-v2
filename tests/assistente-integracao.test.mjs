import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
import {atenderBotAssistente} from '../server/assistente-servico.js';
import {emitirCodigo} from '../server/assistente-vinculacao-fluxo.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';
const config={VYBE_AI_BOT_TOKEN:'A'.repeat(64),VYBE_AI_LINK_SECRET:'segredo-ficticio-isolado-para-integracao-123456'};
const jid='99999999999999999999@lid';
async function chamar(sql,body={},op={}) {
 const req={method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{jid,consulta:'minhas_demandas',...body},...op};
 const res={status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}};
 await atenderBotAssistente(req,res,()=>sql,config);return res;
}
test('integração bot, migração e códigos em PostgreSQL isolado',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 // Tipos confirmados por information_schema no banco real, sem copiar pessoas/dados.
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,senha_hash text);
 INSERT INTO vybe_pessoas VALUES(1,true,true,'ficticia'),(2,false,true,'ficticia'),(3,true,false,'ficticia'),(4,true,true,NULL),(5,true,true,'ficticia');`);
 await t.test('autenticação falha antes de tocar no banco',async()=>{
  const naoChamar=()=>{throw Error('não consultar')};
  for(const headers of [{},{authorization:'Bearer '+'B'.repeat(64)}]) assert.equal((await chamar(naoChamar,{}, {headers})).codigo,401);
  assert.equal((await chamar(naoChamar,{}, {method:'GET'})).codigo,405);
 });
 await t.test('sem schema de vínculos nega acesso; não mascara indisponibilidade do banco',async()=>{
  const r=await chamar(sql);assert.equal(r.codigo,403);assert.deepEqual(r.corpo,{error:'Conta WhatsApp não vinculada.'});
  const r2=await chamar(()=>{throw Object.assign(Error('detalhe privado'),{code:'08006'})});
  assert.equal(r2.codigo,503);assert.ok(!JSON.stringify(r2.corpo).includes('privado'));
 });
 const migracao=readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8');
 await db.exec(migracao);await db.exec(migracao);
 await t.test('migração idempotente, FK compatível e restrição de expiração',async()=>{
  await assert.rejects(()=>db.query(`INSERT INTO vybe_ai_desafios(pessoa_id,codigo_hash,expira_em) VALUES(999,$1,now()+interval '1 minute')`,['a'.repeat(64)]),/foreign key/);
  await assert.rejects(()=>db.query(`INSERT INTO vybe_ai_desafios(pessoa_id,codigo_hash,expira_em) VALUES(1,$1,now()-interval '1 minute')`,['a'.repeat(64)]),/check constraint/);
 });
 await t.test('desconhecido, grupo e parâmetros inválidos não recebem dados',async()=>{
  assert.equal((await chamar(sql,{pessoa_id:1,admin:true})).codigo,403);
  assert.equal((await chamar(sql,{jid:'123456789@g.us'})).codigo,400);
  assert.equal((await chamar(sql,{consulta:'sql',sql:'SELECT *'})).codigo,400);
 });
 await t.test('emissão só para pessoa ativa, liberada e com senha',async()=>{
  for(const id of [2,3,4,999]) assert.equal(await emitirCodigo(sql,id,config.VYBE_AI_LINK_SECRET),null);
 });
 const desafio=await emitirCodigo(sql,1,config.VYBE_AI_LINK_SECRET);
 await t.test('código não persiste em texto e expira em dez minutos',async()=>{
  const [d]=await sql`SELECT codigo_hash,expira_em FROM vybe_ai_desafios WHERE pessoa_id=1`;
  assert.notEqual(d.codigo_hash,desafio.codigo);assert.equal(d.codigo_hash.length,64);
  assert.ok(Math.abs(Date.parse(desafio.expiraEm)-Date.now()-600000)<5000);
 });
 await t.test('consumo é único, inclusive chamadas concorrentes',async()=>{
  const r=await Promise.all([chamar(sql,{consulta:'vinculacao_confirmar',codigo:desafio.codigo}),chamar(sql,{consulta:'vinculacao_confirmar',codigo:desafio.codigo})]);
  assert.deepEqual(r.map(x=>x.codigo).sort(),[200,403]);
  assert.equal(Number((await sql`SELECT count(*) AS n FROM vybe_ai_vinculos`)[0].n),1);
 });
 await db.exec(`CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,titulo text,prazo date,veiculacao date,atualizado_em timestamptz,board_id bigint,status_chave text,removido_em timestamptz);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
 INSERT INTO vybe_conteudos VALUES(1,'Minha peça','2026-10-23','2026-10-24',now(),8385559107,'agendado',NULL),(2,'Outra pessoa',NULL,NULL,now(),8385559107,NULL,NULL),(3,'Removida',NULL,NULL,now(),8385559107,NULL,now());
 INSERT INTO vybe_status VALUES(8385559107,'agendado','Agendado');
 INSERT INTO vybe_conteudo_responsaveis VALUES(1,1),(2,5),(3,1);
 INSERT INTO vybe_clientes VALUES(1,'A'),(2,'B');INSERT INTO vybe_conteudo_clientes VALUES(1,1),(1,2);`);
 await t.test('consulta real respeita responsável, remoção, status e clientes múltiplos sem duplicar',async()=>{
  const r=await chamar(sql,{pessoa_id:5,admin:true});assert.equal(r.codigo,200);
  assert.equal(r.corpo.itens.length,1);assert.equal(r.corpo.itens[0].titulo,'Minha peça');
  assert.equal(r.corpo.itens[0].status,'Agendado');assert.equal(r.corpo.itens[0].clientes.length,2);
 });
 await t.test('bloqueio e revogação valem já na próxima consulta',async()=>{
  await db.exec('UPDATE vybe_pessoas SET pode_entrar=false WHERE id=1');assert.equal((await chamar(sql)).codigo,403);
  await db.exec('UPDATE vybe_pessoas SET pode_entrar=true,ativo=false WHERE id=1');assert.equal((await chamar(sql)).codigo,403);
  await db.exec('UPDATE vybe_pessoas SET ativo=true WHERE id=1;UPDATE vybe_ai_vinculos SET revogado_em=now()');assert.equal((await chamar(sql)).codigo,403);
 });
 await t.test('expirado ou pessoa bloqueada não consome código',async()=>{
  const d=await emitirCodigo(sql,5,config.VYBE_AI_LINK_SECRET);
  await db.exec(`UPDATE vybe_ai_desafios SET criado_em=now()-interval '1 hour',expira_em=now()-interval '1 minute' WHERE pessoa_id=5`);
  assert.equal((await chamar(sql,{consulta:'vinculacao_confirmar',codigo:d.codigo})).codigo,403);
  const d2=await emitirCodigo(sql,5,config.VYBE_AI_LINK_SECRET);
  await db.exec('UPDATE vybe_pessoas SET ativo=false WHERE id=5');
  assert.equal((await chamar(sql,{consulta:'vinculacao_confirmar',codigo:d2.codigo})).codigo,403);
 });
 await t.test('JID protegido diferencia lid e c.us',()=>assert.notEqual(identificadorProtegido(jid,config.VYBE_AI_LINK_SECRET),identificadorProtegido(jid.replace('@lid','@c.us'),config.VYBE_AI_LINK_SECRET)));
});

test('emissão HTTP exige sessão pessoal e mesma origem; ignora pessoa enviada no corpo',async t=>{
 const {areaAssistente}=await import('../api/painel.js');
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,senha_hash text);
 INSERT INTO vybe_pessoas VALUES(1,true,true,'ficticia'),(5,true,true,'ficticia');`);
 await db.exec(readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8'));
 const anterior=process.env.VYBE_AI_LINK_SECRET;process.env.VYBE_AI_LINK_SECRET=config.VYBE_AI_LINK_SECRET;
 t.after(()=>{if(anterior===undefined)delete process.env.VYBE_AI_LINK_SECRET;else process.env.VYBE_AI_LINK_SECRET=anterior});
 const req={method:'POST',query:{consulta:'vinculacao_iniciar'},headers:{origin:'https://teste.example',host:'teste.example'},body:{pessoa_id:5}};
 const res=()=>({status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
 let r=res();await areaAssistente(req,r,{tipo:'servico',pessoa:{id:1,admin:true}},()=>{throw Error('não chamar')});assert.equal(r.codigo,403);
 r=res();await areaAssistente({...req,headers:{origin:'https://outro.example',host:'teste.example'}},r,{tipo:'sessao',pessoa:{id:1}},()=>sql);assert.equal(r.codigo,403);
 r=res();await areaAssistente(req,r,{tipo:'sessao',pessoa:{id:1}},()=>sql);assert.equal(r.codigo,200);
 assert.equal(Number((await sql`SELECT pessoa_id FROM vybe_ai_desafios`)[0].pessoa_id),1);
 await emitirCodigo(sql,1,config.VYBE_AI_LINK_SECRET);await emitirCodigo(sql,1,config.VYBE_AI_LINK_SECRET);
 assert.equal(await emitirCodigo(sql,1,config.VYBE_AI_LINK_SECRET),null);
});
