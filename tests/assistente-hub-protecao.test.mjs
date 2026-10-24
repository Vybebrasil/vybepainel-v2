import test from 'node:test';
import assert from 'node:assert/strict';
import { metricasDoHub } from '../server/assistente-hub.js';

const origin = 'https://vybehub-ficticio-vybe-hub.vercel.app';
const ponte = 'P'.repeat(64), bypass = 'V'.repeat(32);
const config = {
 VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/vybe-ai-readonly-integration',
 VYBE_AI_HUB_ATIVO: '1', VYBE_AI_HUB_URL: origin,
 VYBE_AI_HUB_CLIENTES: '{"1":"cliente-ficticio-ai"}', VYBE_OS_METRICAS_TOKEN: ponte,
 VYBE_AI_HUB_VERCEL_BYPASS_SECRET: bypass, VYBE_AI_HUB_VERCEL_BYPASS_ORIGIN: origin,
};
const args = { cliente_id: '1', de: '2026-10-24', ate: '2026-10-24' };
const sql = async () => [{ id: '1', nome: 'Cliente Ficticio AI' }];
const resposta = () => new Response(JSON.stringify({result:{data:{json:{
 slug:'cliente-ficticio-ai',cliente_nome:'Cliente Ficticio AI',de:args.de,ate:args.ate,
 linhas:[{amountSpent:25}],origem_dados:'homologacao_fixture',
}}}}));

test('Preview envia duas credenciais independentes apenas em headers para a origem fixada', async () => {
 let calls = 0;
 const r = await metricasDoHub(sql,args,{config,buscar:async(url,init)=>{
  calls++;
  assert.equal(new URL(url).origin,origin);
  assert.equal(init.headers.Authorization,'Bearer '+ponte);
  assert.equal(init.headers['x-vercel-protection-bypass'],bypass);
  assert.equal(init.redirect,'error');
  assert.ok(!url.includes(bypass) && !url.includes(ponte));
  assert.ok(!Object.hasOwn(init.headers,'x-vercel-set-bypass-cookie'));
  return resposta();
 }});
 assert.equal(calls,1);
 assert.equal(r.origem_dados,'homologacao_fixture');
 assert.match(r.observacao,/DADOS FICTÍCIOS DE HOMOLOGAÇÃO/);
});

test('Preview nega configuração ausente, origem divergente e reuso de segredo antes de banco e HTTP', async () => {
 for(const change of [
  {VYBE_AI_HUB_VERCEL_BYPASS_SECRET:undefined},
  {VYBE_AI_HUB_VERCEL_BYPASS_SECRET:'V'.repeat(31)},
  {VYBE_AI_HUB_VERCEL_BYPASS_SECRET:'V'.repeat(64)},
  {VYBE_AI_HUB_VERCEL_BYPASS_SECRET:ponte},
  {VYBE_AI_HUB_VERCEL_BYPASS_SECRET:'invalido\r\n'},
  {VYBE_AI_HUB_VERCEL_BYPASS_ORIGIN:undefined},
  {VYBE_AI_HUB_VERCEL_BYPASS_ORIGIN:'https://outro.invalid'},
 ]){
  let accesses=0;
  await assert.rejects(metricasDoHub(async()=>{accesses++;return [];},args,{
   config:{...config,...change},buscar:async()=>{accesses++;return resposta();},
  }),{status:503});
  assert.equal(accesses,0);
 }
});

test('Production e outras branches preservam chamada original e nunca recebem bypass herdado', async () => {
 for(const scope of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'outra-branch'}, {VERCEL_ENV:'development'}]){
  await metricasDoHub(sql,args,{config:{...config,...scope},buscar:async(url,init)=>{
   assert.deepEqual(init.headers,{Authorization:'Bearer '+ponte});return resposta();
  }});
 }
});

test('falhas HTTP e do transporte não retornam credenciais nem viram sucesso',async()=>{
 for(const buscar of [async()=>new Response('bloqueado',{status:401}),async()=>{throw new Error(ponte+bypass); }]){
  await assert.rejects(metricasDoHub(sql,args,{config,buscar}),e=>{
   assert.equal(e.status,503);assert.ok(!e.message.includes(ponte)&&!e.message.includes(bypass));return true;
  });
 }
});

test('fora da Preview isolada o erro original do transporte permanece inalterado',async()=>{
 const original = new Error('Erro ficticio de transporte');
 await assert.rejects(metricasDoHub(sql,args,{
  config:{...config,VERCEL_ENV:'production'},buscar:async()=>{throw original;},
 }),e=>e===original);
});

test('nomes com acentuação diferente não são aceitos como correspondência exata',async()=>{
 await assert.rejects(metricasDoHub(async()=>[{id:'1',nome:'Cliente Fictício AI'}],args,{
  config,buscar:async()=>resposta(),
 }),/Cliente ou período não conferem/);
});
