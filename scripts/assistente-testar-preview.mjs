// Teste HTTP ponta a ponta com identidades exclusivamente fictícias.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {verificarBancoHomologacao,verificarUrlPreview} from './assistente-homologacao.mjs';
verificarBancoHomologacao({habilitado:process.env.VYBE_HOMOLOGACAO,producao:process.env.VYBE_AI_PRODUCAO_DATABASE_URL,destino:process.env.VYBE_AI_HOMOLOG_DATABASE_URL});
const base=verificarUrlPreview(process.env.VYBE_AI_HOMOLOG_PREVIEW),senha=process.env.VYBE_AI_HOMOLOG_SENHA,token=process.env.VYBE_AI_BOT_TOKEN,segredo=process.env.VYBE_AI_LINK_SECRET;
if(!senha || !token || !segredo)throw Error('Forneça credenciais de teste por variáveis, nunca em argumentos ou logs.');
const sql=neon(process.env.VYBE_AI_HOMOLOG_DATABASE_URL),jid='99999999999999999999@lid';
const [pessoas]=await sql`SELECT count(*)::int n FROM vybe_pessoas WHERE id IN (900000001,900000002) AND email IN ('ai-homologacao-a@vybe.invalid','ai-homologacao-b@vybe.invalid') AND NOT admin`;
assert.equal(pessoas.n,2,'Prepare as duas contas fictícias antes do teste.');
async function req(path,{cookie,body,bearer,method=body?'POST':'GET'}={}){
 const headers={Origin:base};if(cookie)headers.Cookie=cookie;if(body)headers['Content-Type']='application/json';if(bearer)headers.Authorization='Bearer '+bearer;
 const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(90000)});
 let d;try{d=await r.json();}catch{d={};}
 return{status:r.status,data:d,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const bot=body=>req('/api/painel?area=assistente&canal=bot',{body:{jid,...body},bearer:token});
const pessoa=(cookie,consulta,body)=>req('/api/painel?area=assistente&consulta='+consulta,{cookie,body});
const ok=(r,status,etapa)=>{assert.equal(r.status,status,etapa+': HTTP inesperado');console.log(etapa+': HTTP '+status);return r.data;};
try{
 ok(await req('/api/painel?area=assistente&canal=bot',{body:{jid,consulta:'minhas_demandas'},bearer:'invalido'}),401,'Token inválido');
 const a=await req('/api/sessao',{body:{pessoa_id:900000001,senha}});ok(a,200,'Login fictício A');assert.ok(a.cookie);
 const b=await req('/api/sessao',{body:{pessoa_id:900000002,senha}});ok(b,200,'Login fictício B');assert.ok(b.cookie);
 ok(await pessoa(a.cookie,'vinculacao_revogar',{}),200,'Revogação inicial A');
 ok(await pessoa(b.cookie,'vinculacao_revogar',{}),200,'Revogação inicial B');
 const desconhecido=ok(await bot({consulta:'minhas_demandas'}),403,'WhatsApp não vinculado');assert.equal(desconhecido.error,'Conta WhatsApp não vinculada.');
 const estado=ok(await pessoa(a.cookie,'vinculacao_status'),200,'Estado antes de vincular');assert.equal(estado.vinculado,false);assert.equal(estado.disponivel,true);
 const codigo=ok(await pessoa(a.cookie,'vinculacao_iniciar',{}),200,'Gerar código da conta A');
 assert.match(codigo.codigo,/^[a-f0-9]{20}$/);assert.ok(Date.parse(codigo.expiraEm)>Date.now());
 ok(await bot({consulta:'vinculacao_confirmar',codigo:codigo.codigo}),200,'Confirmar vínculo A');
 ok(await bot({consulta:'vinculacao_confirmar',codigo:codigo.codigo}),403,'Rejeitar código reutilizado');
 assert.equal(ok(await pessoa(a.cookie,'vinculacao_status'),200,'Estado depois de vincular').vinculado,true);
 const demandas=ok(await bot({consulta:'minhas_demandas',pessoa_id:900000002,admin:true}),200,'Consultar com tentativa de trocar pessoa');
 assert.deepEqual(demandas.itens.map(x=>x.id),[900000101]);
 ok(await bot({consulta:'sql',pessoa_id:900000002,sql:'SELECT * FROM vybe_pessoas'}),400,'Rejeitar consulta fora da lista');
 await sql`UPDATE vybe_pessoas SET pode_entrar=false WHERE id=900000001 AND email='ai-homologacao-a@vybe.invalid'`;
 ok(await bot({consulta:'minhas_demandas'}),403,'Bloqueio individual imediato');
 await sql`UPDATE vybe_pessoas SET pode_entrar=true WHERE id=900000001 AND email='ai-homologacao-a@vybe.invalid'`;
 const expirado=ok(await pessoa(a.cookie,'vinculacao_iniciar',{}),200,'Gerar código para testar expiração');
 const hash=createHmac('sha256',segredo).update('codigo:v1:'+expirado.codigo).digest('hex');
 await sql`UPDATE vybe_ai_desafios SET criado_em=NOW()-INTERVAL '20 minutes',expira_em=NOW()-INTERVAL '1 minute' WHERE pessoa_id=900000001 AND codigo_hash=${hash}`;
 ok(await bot({consulta:'vinculacao_confirmar',codigo:expirado.codigo}),403,'Rejeitar código expirado');
 const pendente=ok(await pessoa(a.cookie,'vinculacao_iniciar',{}),200,'Gerar código pendente');
 const alheio=ok(await pessoa(b.cookie,'vinculacao_iniciar',{}),200,'Gerar código da conta B');
 ok(await bot({consulta:'vinculacao_confirmar',codigo:alheio.codigo}),403,'Impedir transferência do WhatsApp para B');
 assert.deepEqual(ok(await bot({consulta:'minhas_demandas'}),200,'Confirmar identidade A preservada').itens.map(x=>x.id),[900000101]);
 ok(await pessoa(a.cookie,'vinculacao_revogar',{pessoa_id:900000002}),200,'Revogar somente titular da sessão');
 ok(await bot({consulta:'minhas_demandas'}),403,'Consulta negada após revogação');
 ok(await bot({consulta:'vinculacao_confirmar',codigo:pendente.codigo}),403,'Código pendente invalidado pela revogação');
 assert.equal(ok(await pessoa(a.cookie,'vinculacao_status'),200,'Estado final da conta A').vinculado,false);
 for(const [acao,rotulo] of [['entrada','Escritório: entrada e personagens'],['mapa','Escritório: mapa'],['economia','Escritório: economia e conquistas'],['ranking','Escritório: ranking'],['lobby','Escritório: lobby']]){
  const r=await req('/api/painel?area=escritorio&acao='+acao,{cookie:a.cookie});ok(r,200,rotulo);
  if(acao==='entrada'){assert.ok(r.data.equipe?.length===2);console.log('Presença/voz externas não fazem parte deste teste isolado.');}
 }
 await req('/api/sessao',{cookie:a.cookie,method:'DELETE'});await req('/api/sessao',{cookie:b.cookie,method:'DELETE'});
 console.log('Fluxo HTTP concluído sem acesso a dados reais.');
}catch(e){console.error('Homologação HTTP não concluída:',String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[conexão oculta]'));process.exitCode=1;}
