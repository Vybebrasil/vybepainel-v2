import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarBancoPreview,correspondeHomologacao} from '../scripts/assistente-consultar-banco-preview.mjs';
const token='A'.repeat(64);
const dados={banco:'neondb',identificador_banco:'sha256:f15a33699c956ed4263414a0fd8be51bdeb3791dbde745afa8c82e4929c2d3b0'};
const json=valor=>new Response(JSON.stringify(valor),{status:200});

test('consulta local: token em memória somente no header, alias fixo, sem redirects e com timeout',async()=>{
  let leituras=0,chamadas=0;
  const resultado=await consultarBancoPreview({lerToken:async()=>{leituras++;return token+'\n'},buscar:async(url,opcoes)=>{
    chamadas++;assert.equal(url,'https://vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app/api/painel?area=assistente&canal=bot&consulta=diagnostico_banco_bot');
    assert.ok(!url.includes(token));assert.equal(opcoes.headers.Authorization,'Bearer '+token);
    assert.equal(opcoes.redirect,'error');assert.equal(opcoes.cache,'no-store');assert.equal(opcoes.method,'GET');
    assert.ok(opcoes.signal instanceof AbortSignal);assert.equal(opcoes.body,undefined);return json(dados);
  }});
  assert.equal(leituras,1);assert.equal(chamadas,1);assert.deepEqual(resultado,dados);
});

test('consulta local: token inválido ou arquivo inacessível impede rede sem expor erros privados',async()=>{
  const buscar=()=>assert.fail('Não deve consultar a Preview');
  for(const lerToken of [async()=>'',async()=>'invalido',async()=>{throw Error('detalhe privado '+token)}]) {
    await assert.rejects(()=>consultarBancoPreview({lerToken,buscar}),e=>!e.message.includes(token)&&!e.message.includes('detalhe privado'));
  }
});

test('consulta local: recusas HTTP, falhas e redirects não imprimem nem devolvem corpo ou headers remotos',async()=>{
  const log=console.log,error=console.error,logs=[];console.log=(...v)=>logs.push(v);console.error=(...v)=>logs.push(v);
  try {
    for(const status of [401,403,404,405,503]) {
      const buscar=async()=>({ok:false,status,body:{getReader:()=>assert.fail('Não ler corpo de erro')}});
      await assert.rejects(()=>consultarBancoPreview({lerToken:async()=>token,buscar}),new RegExp('HTTP '+status));
    }
    await assert.rejects(()=>consultarBancoPreview({lerToken:async()=>token,buscar:async()=>{throw Error('redirect privado '+token)}}),e=>!e.message.includes(token)&&!e.message.includes('redirect privado'));
    assert.deepEqual(logs,[]);
  } finally {console.log=log;console.error=error;}
});

test('consulta local: JSON extra, dados privados, resposta excessiva e formato errado são recusados',async()=>{
  for(const valor of [{...dados,token},{...dados,banco:token.repeat(2)},{banco:'neondb'},[],null,
    {...dados,identificador_banco:'invalido'},{...dados,extra:'x'.repeat(5000)}]) {
    await assert.rejects(()=>consultarBancoPreview({lerToken:async()=>token,buscar:async()=>json(valor)}),e=>!e.message.includes(token)&&!e.message.includes('x'.repeat(50)));
  }
});

test('consulta local: compara banco e fingerprint; nome neondb sozinho não confirma homologação',()=>{
  assert.equal(correspondeHomologacao(dados),true);
  assert.equal(correspondeHomologacao({...dados,banco:'outro'}),false);
  assert.equal(correspondeHomologacao({...dados,identificador_banco:'sha256:'+'0'.repeat(64)}),false);
  assert.equal(correspondeHomologacao(null),false);
});
