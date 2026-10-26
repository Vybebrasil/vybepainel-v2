import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticoBancoAssistente} from '../server/assistente-diagnostico-banco.js';
import {assinarSessao} from '../vybe_sessao.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';
import {PGlite} from '@electric-sql/pglite';
import handler from '../api/painel.js';
const origem='https://vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app';
const jid='1111111111@c.us',segredo='segredo-exclusivamente-ficticio-123456789';
const config={VERCEL_ENV:'preview',VYBE_HOMOLOGACAO:'1',VERCEL_GIT_COMMIT_REF:'feature/vybe-ai-readonly-integration',VYBE_AI_LINK_SECRET:segredo,DATABASE_URL:'postgresql://fixture:fixture@ep-fragrant-bird-b6me3xz7.c-2.sa-east-1.aws.neon.tech/neondb'};
test('diagnóstico de vínculo: sessão real assinada, READ ONLY, isolamento e resposta mínima',async t=>{
 const anterior=process.env.SESSAO_SECRET;process.env.SESSAO_SECRET='sessao-ficticia-para-teste-sem-rede';
 try {
  const cookie='vybe_sessao='+assinarSessao({id:123,nome:'ignorado',email:'ignorado',admin:true,versao:2});
  async function executar({ambiente={},pedido={},pessoa={},corresponde=true,falhar=false}={}) {
   const consultas=[];let aberturas=0;
   const sql=(strings,...values)=>({texto:strings.join('?'),values});
   sql.transaction=async(q,opts)=>{
    assert.deepEqual(opts,{readOnly:true});consultas.push(...q);
    for(const x of q)assert.match(x.texto,/^SELECT\b/);
    if(falhar)throw Error('segredo JID e credenciais que não podem sair');
    return q.map(x=>{
     if(x.texto.includes('sessao_versao')){
      assert.doesNotMatch(x.texto,/\bnome\b|\bemail\b/);
      return [{id:123,ativo:true,pode_entrar:true,admin:true,senha_hash:true,sessao_versao:2,...pessoa}];
     }
     if(x.texto.startsWith('SELECT nome, email')){
      assert.deepEqual(x.values,[123]);
      return [{nome:'Paulo Teste AI — fictício',email:'fixture@vybe.invalid',...pessoa}];
     }
     return x.texto.includes('current_database')?[{banco:'neondb'}]:[{corresponde}];
    });
   };
   const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.codigo=c;return this;},json(v){this.corpo=v;return this;}};
   await diagnosticoBancoAssistente({method:'POST',query:{consulta:'diagnostico_vinculo'},headers:{cookie,origin:origem},body:{jid},...pedido},r,()=>{aberturas++;return sql;},{...config,...ambiente});
   return {r,consultas,aberturas};
  }
  for(const corresponde of [true,false])await t.test('resultado '+corresponde,async()=>{
   const {r,consultas}=await executar({corresponde});assert.equal(r.codigo,200);assert.deepEqual(r.corpo,{resultado:corresponde?'CORRESPONDE':'NÃO CORRESPONDE'});
   assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(consultas.length,4);
   assert.deepEqual(consultas[3].values,[identificadorProtegido(jid,segredo),123]);
   assert.ok(!JSON.stringify(r.corpo).includes(jid));
  });
  for(const ambiente of [{VERCEL_ENV:'production'},{VYBE_HOMOLOGACAO:'0'},{VERCEL_GIT_COMMIT_REF:'main'},{VYBE_AI_LINK_SECRET:''}])await t.test('ambiente bloqueado '+Object.keys(ambiente)[0],async()=>{
   const x=await executar({ambiente});assert.notEqual(x.r.codigo,200);assert.equal(x.aberturas,0);
  });
  for(const pedido of [{method:'GET'},{headers:{origin:origem}},{headers:{cookie,origin:'https://terceiro.invalid'}},{query:{consulta:'diagnostico_vinculo',canal:'bot'}},{body:{jid,admin:true}},{body:{jid:'123@g.us'}}])await t.test('pedido inválido '+JSON.stringify(Object.keys(pedido)),async()=>{
   const x=await executar({pedido});assert.notEqual(x.r.codigo,200);assert.equal(x.aberturas,0);
  });
  for(const pessoa of [{admin:false},{ativo:false},{pode_entrar:false},{sessao_versao:3},{nome:'Outra pessoa'},{email:'real@example.invalid'}])await t.test('conta recusada '+Object.keys(pessoa)[0],async()=>{
   const x=await executar({pessoa});assert.notEqual(x.r.codigo,200);assert.equal(x.consultas.length,('nome' in pessoa||'email' in pessoa)?2:1);
  });
  await t.test('destino diferente e falha não produzem correspondência',async()=>{
   for(const op of [{ambiente:{DATABASE_URL:config.DATABASE_URL.replace('ep-fragrant-bird','ep-outro')}},{falhar:true},{corresponde:null}]){
    const {r}=await executar(op);assert.equal(r.codigo,503);assert.ok(!JSON.stringify(r.corpo).includes('credenciais'));
   }
  });
  await t.test('SQL real em PostgreSQL local: hash, conta, revogação e permissões',async()=>{
   const db=new PGlite();
   try {
    await db.exec('CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean,pode_entrar boolean,admin boolean,senha_hash text); CREATE TABLE vybe_ai_vinculos(pessoa_id bigint,jid_hash text,revogado_em timestamptz);');
    await db.query('INSERT INTO vybe_pessoas VALUES ($1,$2,$3,true,true,true,$4)',[123,'Paulo Teste AI — fictício','fixture@vybe.invalid','hash-ficticio']);
    await db.query('INSERT INTO vybe_ai_vinculos VALUES ($1,$2,NULL)',[123,identificadorProtegido(jid,segredo)]);
    const {consultas}=await executar();const q=consultas[3];let n=0;const texto=q.texto.replace(/\?/g,()=>'$'+(++n));
    async function confere(values,esperado){const antes=await db.query('SELECT * FROM vybe_ai_vinculos');assert.equal((await db.query(texto,values)).rows[0].corresponde,esperado);assert.deepEqual(await db.query('SELECT * FROM vybe_ai_vinculos'),antes);}
    await confere(q.values,true);
    await confere([identificadorProtegido('2222222222@lid',segredo),123],false);
    await confere([q.values[0],456],false);
    await db.exec('UPDATE vybe_ai_vinculos SET revogado_em=NOW()');await confere(q.values,false);
    await db.exec('UPDATE vybe_ai_vinculos SET revogado_em=NULL; UPDATE vybe_pessoas SET admin=false');await confere(q.values,false);
   }finally{await db.close();}
  });
  await t.test('rota real não cai no canal operacional e bloqueia Production',async()=>{
   const keys=Object.keys(config);const antes=keys.map(k=>process.env[k]);
   try{
    Object.assign(process.env,config,{VERCEL_ENV:'production'});
    const r={setHeader(){},status(c){this.codigo=c;return this;},json(v){this.corpo=v;return this;}};
    await handler({method:'POST',query:{area:'assistente',consulta:'diagnostico_vinculo'},headers:{},body:{jid}},r);
    assert.equal(r.codigo,404);
   }finally{keys.forEach((k,i)=>{if(antes[i]===undefined)delete process.env[k];else process.env[k]=antes[i];});}
  });
 }finally{if(anterior===undefined)delete process.env.SESSAO_SECRET;else process.env.SESSAO_SECRET=anterior;}
});
