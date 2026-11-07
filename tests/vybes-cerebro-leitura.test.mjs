import test from 'node:test';
import assert from 'node:assert/strict';
import { lerCerebroDaCentral, areaVybes } from '../server/vybes.js';

test('ponte consulta só o estudo via GET, sem encaminhar crachá ao retorno', async () => {
  const d = await lerCerebroDaCentral('https://teste.trycloudflare.com/entrar?t=cracha-teste', {
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://teste.trycloudflare.com/api/cosmos/ideias');
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Cookie, 'vybes_quem=cracha-teste');
      return new Response(JSON.stringify({ok:true,geradoEm:1,clientes:[{cliente:'Cliente fictício',ideias:[]}]}));
    }
  });
  assert.equal(d.fonte, 'central-vybes');
  assert.equal(d.clientes.length, 1);
  assert.doesNotMatch(JSON.stringify(d), /cracha-teste/);
});

test('ponte rejeita destino externo, resposta inválida e indisponibilidade sem sucesso aparente', async () => {
  await assert.rejects(lerCerebroDaCentral('https://example.com/entrar?t=x', {fetchImpl:()=>assert.fail('não deve chamar')}), /inválida/);
  const url='https://teste.trycloudflare.com/entrar?t=x';
  await assert.rejects(lerCerebroDaCentral(url,{fetchImpl:async()=>new Response('{}')}), /inválida/);
  await assert.rejects(lerCerebroDaCentral(url,{fetchImpl:async()=>new Response('',{status:403})}), e=>e.status===403);
  await assert.rejects(lerCerebroDaCentral(url,{fetchImpl:async()=>{throw new Error('segredo');}}), e=>e.status===504&&!e.message.includes('segredo'));
});

test('área do cérebro exige sessão antes de consultar banco ou central e não aceita escrita', async () => {
  const resposta = () => ({ codigo:0, corpo:null, status(n){this.codigo=n;return this;}, json(d){this.corpo=d;return this;} });
  const sql = () => assert.fail('não deve consultar banco');
  const anonimo=resposta();
  await areaVybes({method:'GET',query:{etapa:'cerebro'}},anonimo,null,sql);
  assert.equal(anonimo.codigo,401);
  const escrita=resposta();
  await areaVybes({method:'POST',body:{etapa:'cerebro'}},escrita,null,sql);
  assert.equal(escrita.codigo,405);
});
