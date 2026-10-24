import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticoBancoBotAssistente,diagnosticoBancoAssistente,identificadorBanco} from '../server/assistente-diagnostico-banco.js';
import {atenderBotAssistente} from '../server/assistente-servico.js';
import handler from '../api/painel.js';
import {conexao} from './postgres.mjs';

const url='postgresql://usuario:senha-ficticia@ep-exemplo-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const token='A'.repeat(64);
const config={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/vybe-ai-readonly-integration',VYBE_HOMOLOGACAO:'1',VYBE_AI_BOT_TOKEN:token,DATABASE_URL:url};
const req=()=>({method:'GET',query:{area:'assistente',consulta:'diagnostico_banco_bot',canal:'bot'},headers:{authorization:'Bearer '+token}});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
const naoAbrir=()=>assert.fail('Não pode abrir conexão nem consultar banco');
function bancoFalso(nome='neondb') {
  const chamadas=[];
  const sql=(partes,...parametros)=>({text:partes.join('?'),parametros});
  sql.transaction=async(consultas,opcoes)=>{
    chamadas.push({consultas,opcoes});assert.deepEqual(opcoes,{readOnly:true});
    assert.equal(consultas.length,1);assert.deepEqual(consultas[0],{text:'SELECT current_database() AS banco',parametros:[]});
    return [[{banco:nome,host:'nao-expor',usuario:'nao-expor',senha:'nao-expor'}]];
  };
  return {sql,chamadas};
}
async function chamar({pedido=req(),ambiente=config,db=bancoFalso()}={}) {
  const r=res();let aberturas=0;
  await diagnosticoBancoBotAssistente(pedido,r,()=>{aberturas++;return db.sql},ambiente);
  return {r,aberturas,db};
}

test('bot: produção, development e qualquer outra branch são negados antes da conexão',async()=>{
  for(const ambiente of [{...config,VERCEL_ENV:'production'},{...config,VERCEL_ENV:'development'},
    {...config,VERCEL_ENV:undefined},{...config,VERCEL_GIT_COMMIT_REF:'main'},
    {...config,VERCEL_GIT_COMMIT_REF:'feature/outra'},{...config,VERCEL_GIT_COMMIT_REF:undefined}]) {
    const r=res();await diagnosticoBancoBotAssistente(req(),r,naoAbrir,ambiente);
    assert.equal(r.codigo,404);assert.equal(r.headers['Cache-Control'],'no-store');
  }
});

test('bot: flag precisa ser exatamente string 1; ausência, booleano e valores aproximados não consultam banco',async()=>{
  for(const flag of [undefined,'','0','true',true,1,' 1','1\n']) {
    const r=res();await diagnosticoBancoBotAssistente(req(),r,naoAbrir,{...config,VYBE_HOMOLOGACAO:flag});
    assert.equal(r.codigo,404);assert.equal(r.headers['Cache-Control'],'no-store');
  }
});

test('bot: token ausente, errado, malformado ou não configurado e cookie administrativo não substituem autenticação',async()=>{
  for(const headers of [{},{authorization:'Bearer '+'B'.repeat(64)},
    {authorization:'Bearer '+token+' extra'},{authorization:'Basic '+token},
    {authorization:'Bearer '+token.toLowerCase()},{cookie:'vybe_sessao=nao-substitui-token'},
    {authorization:['Bearer '+token,'Bearer '+token]}]) {
    const r=res();await diagnosticoBancoBotAssistente({...req(),headers},r,naoAbrir,config);
    assert.equal(r.codigo,401);assert.equal(r.headers['Cache-Control'],'no-store');
  }
  for(const VYBE_AI_BOT_TOKEN of [undefined,'','curto']) {
    const r=res();await diagnosticoBancoBotAssistente(req(),r,naoAbrir,{...config,VYBE_AI_BOT_TOKEN});assert.equal(r.codigo,401);
  }
});

test('bot: somente GET no canal bot; demais métodos ou canais falham sem conexão',async()=>{
  for(const method of ['POST','PATCH','PUT','DELETE','HEAD','OPTIONS']) {
    const r=res();await diagnosticoBancoBotAssistente({...req(),method},r,naoAbrir,config);
    assert.equal(r.codigo,405);assert.equal(r.headers.Allow,'GET');assert.equal(r.headers['Cache-Control'],'no-store');
  }
  for(const canal of [undefined,'servico','manutencao','BOT']) {
    const r=res();await diagnosticoBancoBotAssistente({...req(),query:{...req().query,canal}},r,naoAbrir,config);assert.equal(r.codigo,403);
  }
});

test('bot: resposta somente banco e impressão digital; uma consulta fixa em READ ONLY, sem cache',async()=>{
  const {r,aberturas,db}=await chamar();assert.equal(r.codigo,200);assert.equal(aberturas,1);assert.equal(db.chamadas.length,1);
  assert.deepEqual(r.corpo,{banco:'neondb',identificador_banco:identificadorBanco(url,'neondb')});
  assert.equal(r.headers['Cache-Control'],'no-store');
  for(const privado of [url,'ep-exemplo','usuario','senha-ficticia',token,'nao-expor'])assert.ok(!JSON.stringify(r.corpo).includes(privado));
});

test('bot: corpo, query e headers não escolhem conexão, flag, branch, SQL ou nome do banco',async()=>{
  const pedido={...req(),body:{DATABASE_URL:'nao-usar',sql:'DELETE FROM vybe_pessoas',admin:true},
    query:{...req().query,DATABASE_URL:'nao-usar',banco:'nao-usar',VYBE_HOMOLOGACAO:'1'},
    headers:{...req().headers,'x-vercel-env':'preview','x-vercel-git-commit-ref':config.VERCEL_GIT_COMMIT_REF}};
  const {r}=await chamar({pedido});assert.equal(r.codigo,200);assert.equal(r.corpo.identificador_banco,identificadorBanco(url,'neondb'));
  for(const ambiente of [{...config,VERCEL_ENV:'production'},{...config,VYBE_HOMOLOGACAO:undefined}]) {
    const r=res();await diagnosticoBancoBotAssistente(pedido,r,naoAbrir,ambiente);assert.equal(r.codigo,404);
  }
});

test('bot: endpoint ou banco diferente produz referência diferente; nome divergente da URL não produz sucesso',async()=>{
  const referencia=identificadorBanco(url,'neondb');
  const outroEndpoint=await chamar({ambiente:{...config,DATABASE_URL:url.replace('ep-exemplo','ep-outro')}});
  assert.equal(outroEndpoint.r.codigo,200);assert.notEqual(outroEndpoint.r.corpo.identificador_banco,referencia);
  const outroBanco=await chamar({ambiente:{...config,DATABASE_URL:url.replace('/neondb','/outro')},db:bancoFalso('outro')});
  assert.equal(outroBanco.r.codigo,200);assert.notEqual(outroBanco.r.corpo.identificador_banco,referencia);
  const divergente=await chamar({db:bancoFalso('outro')});assert.equal(divergente.r.codigo,503);
  assert.deepEqual(divergente.r.corpo,{error:'Não foi possível verificar o banco.'});
});

test('bot: falhas não imprimem logs nem devolvem objetos ou detalhes sensíveis do driver',async()=>{
  const log=console.log,error=console.error,warn=console.warn,logs=[];
  console.log=(...v)=>logs.push(v);console.error=(...v)=>logs.push(v);console.warn=(...v)=>logs.push(v);
  try {
    const sql=()=>{throw Error(url+token)};sql.transaction=async()=>{throw Error(url+token)};
    const {r}=await chamar({db:{sql}});assert.equal(r.codigo,503);
    assert.deepEqual(r.corpo,{error:'Não foi possível verificar o banco.'});assert.equal(r.headers['Cache-Control'],'no-store');
    for(const DATABASE_URL of ['', 'invalido',url.replace('postgresql:','https:')]) {
      const {r}=await chamar({ambiente:{...config,DATABASE_URL}});assert.equal(r.codigo,503);
    }
    const falhaFabrica=res();await diagnosticoBancoBotAssistente(req(),falhaFabrica,()=>{throw Error(url)},config);assert.equal(falhaFabrica.codigo,503);
    assert.deepEqual(logs,[]);
  } finally {console.log=log;console.error=error;console.warn=warn;}
});

test('bot: roteador real bloqueia produção antes de OPTIONS e valida token sem sessão em Preview',async()=>{
  const antes=Object.fromEntries(Object.keys(config).map(k=>[k,process.env[k]]));
  try {
    Object.assign(process.env,config,{VERCEL_ENV:'production'});
    for(const method of ['GET','OPTIONS']) {const r=res();await handler({...req(),method},r);assert.equal(r.codigo,404);}
    process.env.VERCEL_ENV='preview';const r=res();await handler({...req(),headers:{}},r);assert.equal(r.codigo,401);
    const admin=res();await diagnosticoBancoAssistente({...req(),query:{consulta:'diagnostico_banco'}},admin,naoAbrir,config);
    assert.equal(admin.codigo,401);
    // O contrato operacional continua exigindo POST, ativação e sua política;
    // a nova consulta não é adicionada às ferramentas nem ao cliente WhatsApp.
    const normal=res();await atenderBotAssistente({...req(),method:'POST',body:{consulta:'diagnostico_banco_bot'}},normal,naoAbrir,
      {...config,VYBE_AI_ATIVA:'1',VYBE_AI_LINK_SECRET:'segredo-ficticio-com-mais-de-trinta-e-dois-caracteres'});
    assert.equal(normal.codigo,400);
  } finally {for(const [k,v] of Object.entries(antes)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});

test('bot: PostgreSQL em memória sem tabela de funcionários; registros e schema permanecem idênticos',async t=>{
  const {db,sql}=conexao();t.after(()=>db.close());
  await db.exec('CREATE TABLE sentinela(id int PRIMARY KEY,valor text); INSERT INTO sentinela VALUES(1,\'preservado\');');
  const antes=await sql`SELECT * FROM sentinela`;
  const colunas=await sql`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`;
  const [meta]=await sql`SELECT current_database() AS banco`;
  const {r}=await chamar({db:{sql},ambiente:{...config,DATABASE_URL:url.replace('/neondb','/'+meta.banco)}});
  assert.equal(r.codigo,200);assert.equal(r.corpo.banco,meta.banco);
  assert.deepEqual(await sql`SELECT * FROM sentinela`,antes);
  assert.deepEqual(await sql`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name`,colunas);
});
