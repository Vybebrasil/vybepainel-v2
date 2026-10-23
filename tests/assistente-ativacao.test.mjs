import test from 'node:test';
import assert from 'node:assert/strict';
import {assistenteAtivo,pessoaLiberadaAssistente} from '../server/assistente-ativacao.js';
import {atenderBotAssistente} from '../server/assistente-servico.js';
test('ativação nega por padrão e exige pessoa explicitamente liberada',()=>{
 assert.equal(assistenteAtivo({}),false);
 for(const config of [{},{VYBE_AI_ATIVA:'1'},{VYBE_AI_ATIVA:'0',VYBE_AI_PESSOAS_LIBERADAS:'1'},{VYBE_AI_ATIVA:'1',VYBE_AI_PESSOAS_LIBERADAS:'*,admin,01'}])assert.equal(pessoaLiberadaAssistente(1,config),false);
 assert.equal(pessoaLiberadaAssistente(1,{VYBE_AI_ATIVA:'1',VYBE_AI_PESSOAS_LIBERADAS:'1, 5'}),true);
 assert.equal(pessoaLiberadaAssistente(2,{VYBE_AI_ATIVA:'1',VYBE_AI_PESSOAS_LIBERADAS:'1,5'}),false);
});
test('bot desligado recusa antes de acessar banco',async()=>{
 const res={status(n){this.codigo=n;return this},json(x){this.corpo=x;return this}};
 await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+'A'.repeat(64)},body:{consulta:'minhas_demandas'}},res,()=>{throw Error('banco não deve ser aberto')},{VYBE_AI_BOT_TOKEN:'A'.repeat(64)});
 assert.equal(res.codigo,503);
});
