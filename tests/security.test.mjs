import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assinarSessao, sessaoDoPedido, lerSessao } from '../vybe_sessao.js';
import { webhookAutorizado } from '../server/webhook-auth.js';
import signal from '../api/operational-signal.js';
import webhook from '../api/webhook-status.js';
process.env.SESSAO_SECRET='segredo-exclusivo-dos-testes';
const pessoa={id:1,nome:'Teste',email:'teste@example.test',admin:true,ativo:true,pode_entrar:true,senha_hash:'hash',sessao_versao:2};
const req={headers:{cookie:`vybe_sessao=${assinarSessao({...pessoa,versao:2})}`}};
const verificar=(p)=>sessaoDoPedido(req,{buscarPessoa:async()=>p});
test('sessão consulta acesso vigente e rejeita pessoa bloqueada, inativa ou excluída',async()=>{
  assert.equal((await verificar(pessoa)).admin,true);
  for(const p of [null,{...pessoa,ativo:false},{...pessoa,pode_entrar:false}])assert.equal(await verificar(p),null);
});
test('retirada do papel e mudança da versão não preservam privilégio do cookie',async()=>{
  assert.equal((await verificar({...pessoa,admin:false})).admin,false);
  assert.equal(await verificar({...pessoa,sessao_versao:3}),null);
});
test('cookie malformado ou adulterado falha sem consultar banco',async()=>{
  const buscarPessoa=async()=>assert.fail('Não deve consultar banco');
  assert.equal(await sessaoDoPedido({headers:{cookie:'vybe_sessao=%E0%A4%A'}},{buscarPessoa}),null);
  assert.equal(lerSessao('falso.assinatura'),null);
});
test('falha de banco nunca concede acesso',async()=>{
  await assert.rejects(sessaoDoPedido(req,{buscarPessoa:async()=>{throw new Error('offline');}}),/offline/);
});
test('webhook exige segredo; chave incorreta e segredo ausente são recusados',()=>{
  process.env.MIRROR_WEBHOOK_SECRET='segredo-webhook-teste';
  assert.equal(webhookAutorizado({headers:{authorization:'Bearer segredo-webhook-teste'}}),true);
  assert.equal(webhookAutorizado({query:{key:'segredo-webhook-teste'}}),true);
  assert.equal(webhookAutorizado({headers:{authorization:'Bearer errado'}}),false);
  delete process.env.MIRROR_WEBHOOK_SECRET;
  assert.equal(webhookAutorizado({}),false);
});
function resposta(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(v){this.body=v;return this;},end(){}};}
test('indicadores e webhook negam acesso antes de consultar ou gravar banco',async()=>{
  const a=resposta();await signal({method:'GET',headers:{}},a);assert.equal(a.code,401);assert.equal(a.headers['Cache-Control'],'no-store');
  const b=resposta();await webhook({method:'POST',headers:{},body:{event:{type:'update_column_value',columnId:'status'}}},b);assert.equal(b.code,410);
  const c=resposta();await webhook({method:'POST',body:{challenge:'teste'}},c);assert.equal(c.code,410);
});
test('HTML não publica tarefa capturada, indicador falso ou toolbar antiga',async()=>{
  const html=await readFile('index.html','utf8');
  assert.doesNotMatch(html,/12782778232|workspace-update-body|ops-today-line|Espelho central confirmado às|vercel\.live/);
  assert.match(html,/auth-pending/);
});
test('diagnóstico de automação é leitura de todo mundo; alterar regra continua de administrador',async()=>{
  // O simulador não grava nada e responde "por que não rodou?". Ele chega por
  // POST só porque carrega o evento no corpo — e POST, naquele arquivo, é a
  // porta trancada. Este teste existe porque a trava é uma linha: movê-la para
  // cima devolve o diagnóstico a uma pessoa só, sem nenhum erro aparecer.
  const fonte=await readFile(new URL('../api/painel.js',import.meta.url),'utf8');
  const trava=fonte.indexOf("return res.status(403).json({ error: 'Só quem administra altera automações.' })");
  const diagnostico=fonte.indexOf("acao: 'simular'");
  assert.ok(trava>0&&diagnostico>0);
  assert.ok(diagnostico<trava,'o diagnóstico precisa ser respondido antes da trava de administrador');
  // E o que escreve continua depois dela.
  for(const acao of ["acao === 'semear'","acao === 'ensaio'","acao === 'prioridades'","acao === 'agenda'"]){
    assert.ok(fonte.indexOf(acao)>trava,`${acao} não pode sair de trás da trava`);
  }
});
