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

test('módulo resumo: só os campos do resumo de tráfego passam pela ponte', async () => {
 const r = await metricasDoHub(sql,{...args,modulo:'resumo'},{config,buscar:async()=>new Response(JSON.stringify({result:{data:{json:{
  slug:'cliente-ficticio-ai',cliente_nome:'Cliente Ficticio AI',de:args.de,ate:args.ate,modulo:'resumo',
  linhas:[{tipo:'total',investido:300,ctr:1.2,resultados:50,tipoResultado:'Conversas iniciadas',custoResultado:6,thumbnail:'https://segredo'}],origem_dados:'meta',
 }}}}))});
 assert.equal(r.modulo,'resumo');
 assert.deepEqual(r.itens,[{tipo:'total',investido:300,ctr:1.2,resultados:50,tipoResultado:'Conversas iniciadas',custoResultado:6}]);
});

test('resumos da semana: um texto por cliente com BI; os demais vão para "sem dados"', async () => {
 const { resumosDaSemana } = await import('../server/assistente-hub.js');
 const r = await resumosDaSemana(async (partes, ...v) => {
  const q = partes.join('?');
  if (q.includes('ORDER BY nome')) return [{ id: '1', nome: 'Cliente Ficticio AI' }, { id: '2', nome: 'Sem BI' }];
  return v[0] === 1 ? [{ id: '1', nome: 'Cliente Ficticio AI' }] : [{ id: '2', nome: 'Sem BI' }];
 }, '2026-10-27', { config, buscar: async (url) => {
  const input = JSON.parse(decodeURIComponent(url.split('input=')[1])).json;
  if (input.cliente_nome !== 'Cliente Ficticio AI') return new Response('{}', { status: 503 });
  assert.equal(input.modulo, 'semana'); assert.equal(input.until, '2026-10-27');
  return new Response(JSON.stringify({ result: { data: { json: { slug: input.slug, cliente_nome: input.cliente_nome, de: input.since, ate: input.until, modulo: 'semana', deslocamento: 0,
   linhas: [{ texto: '📊 *Resumo da semana · Cliente Ficticio AI*' }], origem_dados: 'homologacao_fixture' } } } }));
 } });
 assert.deepEqual(r.resumos.map((x) => x.cliente), ['Cliente Ficticio AI']);
 assert.match(r.resumos[0].texto, /Resumo da semana/);
 assert.deepEqual(r.sem_dados, ['Sem BI']);
});

test('link do relatório: convite do Hub vira URL absoluta só do Hub autorizado', async () => {
 const { linkDoRelatorio } = await import('../server/assistente-hub.js');
 const r = await linkDoRelatorio(sql, { cliente_id: '1', mes: '2026-10-15' }, { config, buscar: async (url, init) => {
  assert.equal(new URL(url).pathname, '/api/trpc/portal.conviteRelatorio'); assert.equal(init.headers.Authorization, 'Bearer ' + ponte);
  const input = JSON.parse(decodeURIComponent(url.split('input=')[1])).json; assert.equal(input.mes, '2026-10');
  return new Response(JSON.stringify({ result: { data: { json: { caminho: '/relatorio-ai/cliente-ficticio-ai?mes=2026-10&c=' + 'a'.repeat(30) + '.' + 'b'.repeat(43) } } } }));
 } });
 assert.equal(r.url, origin + '/relatorio-ai/cliente-ficticio-ai?mes=2026-10&c=' + 'a'.repeat(30) + '.' + 'b'.repeat(43));
 await assert.rejects(linkDoRelatorio(sql, { cliente_id: '1', mes: '2026-10-15' }, { config, buscar: async () => new Response(JSON.stringify({ result: { data: { json: { caminho: 'https://outro.site/x' } } } })) }), /inválida/);
});
