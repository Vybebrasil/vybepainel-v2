import test from 'node:test';
import assert from 'node:assert/strict';
import {assistenteAtivo,pessoaLiberadaAssistente} from '../server/assistente-ativacao.js';
import {atenderBotAssistente} from '../server/assistente-servico.js';
test('ativação exige conta ativa no banco e ignora a lista manual antiga',async()=>{
 assert.equal(assistenteAtivo({}),false);
 const naoConsultar=()=>{throw Error('não consultar')};
 for(const config of [{},{VYBE_AI_ATIVA:'0',VYBE_AI_PESSOAS_LIBERADAS:'1'}])assert.equal(await pessoaLiberadaAssistente(naoConsultar,1,config),false);
 assert.equal(await pessoaLiberadaAssistente(naoConsultar,0,{VYBE_AI_ATIVA:'1'}),false);
 const sql=async(strings,...valores)=>{assert.match(strings.join('?'),/ativo IS TRUE AND pode_entrar IS TRUE AND senha_hash IS NOT NULL/);return valores[0]===1?[{id:1}]:[];};
 for(const valor of [undefined,'','2','*,admin']){
  const config={VYBE_AI_ATIVA:'1',VYBE_AI_PESSOAS_LIBERADAS:valor};
  assert.equal(await pessoaLiberadaAssistente(sql,1,config),true);
  assert.equal(await pessoaLiberadaAssistente(sql,2,config),false);
 }
});
test('bot desligado recusa antes de acessar banco',async()=>{
 const res={status(n){this.codigo=n;return this},json(x){this.corpo=x;return this}};
 await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+'A'.repeat(64)},body:{consulta:'minhas_demandas'}},res,()=>{throw Error('banco não deve ser aberto')},{VYBE_AI_BOT_TOKEN:'A'.repeat(64)});
 assert.equal(res.codigo,503);
});
