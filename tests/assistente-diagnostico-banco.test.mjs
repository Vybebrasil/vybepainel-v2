import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {diagnosticoBancoAssistente, identificadorBanco} from '../server/assistente-diagnostico-banco.js';
import {assinarSessao} from '../vybe_sessao.js';
import handler from '../api/painel.js';
import {conexao} from './postgres.mjs';

const segredoAnterior = process.env.SESSAO_SECRET;
before(() => {process.env.SESSAO_SECRET='segredo-ficticio-somente-para-testar-sessoes';});
after(() => {if(segredoAnterior === undefined) delete process.env.SESSAO_SECRET; else process.env.SESSAO_SECRET=segredoAnterior;});
const url='postgresql://usuario:senha-ficticia@ep-exemplo-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const config={VERCEL_ENV:'preview',VYBE_HOMOLOGACAO:'1',VERCEL_GIT_COMMIT_REF:'feature/vybe-ai-readonly-integration',DATABASE_URL:url};
const pessoa={id:1,nome:'Fictícia',email:'ficticia@example.invalid',admin:true,ativo:true,pode_entrar:true,senha_hash:true,sessao_versao:2};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.codigo=n;return this},json(c){this.corpo=c;return this}});
function pedido(p=pessoa) {
  return {method:'GET',query:{area:'assistente',consulta:'diagnostico_banco'},
    headers:{cookie:'vybe_sessao='+assinarSessao({...p,versao:2})}};
}
function bancoFalso(p=pessoa, database='neondb') {
  const queries=[];
  const sql=(partes,...params)=>({text:partes.join('?'),params});
  sql.transaction=async (qs,opcoes)=>{
    assert.equal(opcoes.readOnly,true);
    return qs.map(q=>{
      queries.push(q);
      assert.match(q.text,/^SELECT\s/);
      if(q.text.includes('FROM vybe_pessoas')) {
        assert.deepEqual(q.params,[1]);
        assert.match(q.text,/\(senha_hash IS NOT NULL AND senha_hash <> ''\) AS senha_hash/);
        assert.doesNotMatch(q.text,/\bnome\b|\bemail\b|senha_sal/);
        return p?[p]:[];
      }
      assert.equal(q.text,'SELECT current_database() AS banco');
      return [{banco:database,segredo:'campo extra nunca exposto'}];
    });
  };
  return {sql,queries};
}
async function chamar({req=pedido(),db=bancoFalso(),ambiente=config}={}) {
  const resposta=res();await diagnosticoBancoAssistente(req,resposta,()=>db.sql,ambiente);
  return {resposta,db};
}
const naoAbrir=()=>assert.fail('Banco não pode ser aberto');

test('diagnóstico indisponível fora de Preview, sem flag ou em outra branch, antes de abrir conexão',async()=>{
  for(const ambiente of [{...config,VERCEL_ENV:'production'},{...config,VERCEL_ENV:'development'},
    {...config,VERCEL_ENV:undefined},{...config,VYBE_HOMOLOGACAO:'0'},
    {...config,VERCEL_GIT_COMMIT_REF:'main'},{...config,VERCEL_GIT_COMMIT_REF:undefined}]) {
    const r=res();await diagnosticoBancoAssistente(pedido(),r,naoAbrir,ambiente);
    assert.equal(r.codigo,404);assert.equal(r.headers['Cache-Control'],'no-store');
  }
});

test('somente GET; canal do bot não concede acesso com token ou mesmo cookie administrativo',async()=>{
  for(const method of ['POST','PUT','DELETE','OPTIONS','HEAD']) {
    const r=res();await diagnosticoBancoAssistente({...pedido(),method},r,naoAbrir,config);
    assert.equal(r.codigo,405);assert.equal(r.headers.Allow,'GET');
  }
  const r=res();await diagnosticoBancoAssistente({...pedido(),query:{canal:'bot'}},r,naoAbrir,config);
  assert.equal(r.codigo,403);
});

test('anônimo, cookie adulterado e tokens de serviço/bot/manutenção não substituem sessão pessoal',async()=>{
  for(const headers of [{},{authorization:'Bearer '+'A'.repeat(64)},
    {cookie:'vybe_sessao=adulterada'},{cookie:pedido().headers.cookie+'adulterado'}]) {
    const r=res();await diagnosticoBancoAssistente({...pedido(),headers},r,naoAbrir,config);
    assert.equal(r.codigo,401);
  }
});

test('permissão administrativa é a atual do banco; sessão revogada ou conta bloqueada não passa',async()=>{
  for(const [p,status] of [[{...pessoa,admin:false},403],[null,401],
    [{...pessoa,ativo:false},401],[{...pessoa,pode_entrar:false},401],
    [{...pessoa,senha_hash:false},401],[{...pessoa,sessao_versao:3},401]]) {
    const {resposta,db}=await chamar({db:bancoFalso(p)});
    assert.equal(resposta.codigo,status);assert.equal(db.queries.length,1);
    assert.ok(!db.queries[0].text.includes('current_database'));
  }
});

test('administrador recebe apenas metadados da conexão real, sem dados pessoais ou parâmetros do cliente',async()=>{
  let aberturas=0;const db=bancoFalso(),r=res();
  await diagnosticoBancoAssistente({...pedido(),body:{admin:true,DATABASE_URL:'nao-usar'},
    query:{...pedido().query,banco:'nao-usar'}},r,()=>{aberturas++;return db.sql},config);
  assert.equal(aberturas,1);assert.equal(r.codigo,200);assert.equal(db.queries.length,2);
  assert.deepEqual(r.corpo,{ok:true,banco:'neondb',identificador_banco:identificadorBanco(url,'neondb')});
  assert.equal(r.headers['Cache-Control'],'no-store');
  const texto=JSON.stringify(r.corpo);
  for(const privado of [url,'ep-exemplo','usuario','senha-ficticia',pessoa.nome,pessoa.email,'campo extra']) assert.ok(!texto.includes(privado));
});

test('identificador estável normaliza pooler e independe de usuário, senha e opções; banco diferente não coincide',()=>{
  const esperado='sha256:'+createHash('sha256').update(JSON.stringify(['vybe-ai-banco-v1','ep-exemplo.c-2.sa-east-1.aws.neon.tech','neondb'])).digest('hex');
  assert.equal(identificadorBanco(url,'neondb'),esperado);
  assert.equal(identificadorBanco(url.replace('.tech/','.tech:5432/'),'neondb'),esperado);
  assert.equal(identificadorBanco(url.replace('usuario:senha-ficticia','outro:outra').replace('-pooler.','.').replace('?sslmode=require','?application_name=outro'),'neondb'),esperado);
  assert.notEqual(identificadorBanco(url.replace('ep-exemplo','ep-outro'),'neondb'),esperado);
  assert.notEqual(identificadorBanco(url.replace('/neondb','/outro'),'outro'),esperado);
});

test('erros de autenticação, conexão e metadados não expõem detalhes do driver ou da configuração',async()=>{
  for(const db of [{sql:()=>{throw Error(url)}},bancoFalso(pessoa,'banco-divergente')]) {
    if(!db.sql.transaction) db.sql.transaction=()=>{throw Error('detalhe privado '+url)};
    const {resposta}=await chamar({db});
    assert.equal(resposta.codigo,503);
    assert.deepEqual(resposta.corpo,{error:'Não foi possível verificar o banco.'});
  }
  for(const valor of ['', 'invalido',url.replace('postgresql:','https:'),url.replace('.neon.tech','.example')]) {
    const {resposta}=await chamar({ambiente:{...config,DATABASE_URL:valor}});
    assert.equal(resposta.codigo,503);assert.ok(!JSON.stringify(resposta.corpo).includes(valor)||valor==='');
  }
});

test('roteador real retorna 404 em produção antes de autenticação, OPTIONS ou qualquer caminho público',async()=>{
  const anterior=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
  try {
    for(const canal of [undefined,'bot']) for(const method of ['GET','OPTIONS']) {
      const r=res();await handler({...pedido(),method,query:{...pedido().query,canal}},r);
      assert.equal(r.codigo,404);
    }
  } finally {if(anterior===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=anterior;}
});

test('PostgreSQL isolado confirma validação da sessão sem inicialização de schema ou gravações',async t=>{
  const {db,sql}=conexao();t.after(()=>db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,ativo boolean,pode_entrar boolean,admin boolean,senha_hash text,sessao_versao int);
    INSERT INTO vybe_pessoas VALUES(1,true,true,true,'hash-ficticio',2);`);
  const [antes]=await sql`SELECT * FROM vybe_pessoas`;
  const [[dados]]=await sql.transaction([sql`SELECT current_database() AS banco`]);
  // PGlite possui nome de banco próprio. A conexão sintética aponta ao mesmo
  // nome para validar a consulta e o contrato, sem conexão Neon real.
  const ambiente={...config,DATABASE_URL:url.replace('/neondb','/'+dados.banco)};
  const r=res();await diagnosticoBancoAssistente(pedido(),r,()=>sql,ambiente);
  assert.equal(r.codigo,200);assert.equal(r.corpo.banco,dados.banco);
  assert.deepEqual((await sql`SELECT * FROM vybe_pessoas`)[0],antes);
  const cols=await sql`SELECT column_name FROM information_schema.columns WHERE table_name='vybe_pessoas'`;
  assert.equal(cols.length,6);
  await sql`UPDATE vybe_pessoas SET senha_hash='' WHERE id=1`;
  const bloqueada=res();await diagnosticoBancoAssistente(pedido(),bloqueada,()=>sql,ambiente);
  assert.equal(bloqueada.codigo,401);
});
