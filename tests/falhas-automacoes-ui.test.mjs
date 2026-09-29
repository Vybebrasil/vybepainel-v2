import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const fonte=fs.readFileSync('vybe-automacoes-ui.js','utf8');
const trecho=fonte.slice(fonte.indexOf('async function carregarFalhasAutomacoes'),fonte.indexOf('// ── histórico'));
function contexto(fetch){
 const caixa={dataset:{},innerHTML:''};
 const c=vm.createContext({AUTOMACOES_API:'/api/painel?area=automacoes',fetch,safeText:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),document:{getElementById:()=>caixa}});
 vm.runInContext(trecho,c);return {c,caixa};
}
test('fila distingue erro de leitura de vazio e permite atualizar',async()=>{
 const {c,caixa}=contexto(async()=>({ok:false,json:async()=>({error:'Sem conexão'})}));
 await c.carregarFalhasAutomacoes();assert.match(caixa.innerHTML,/Não foi possível/);assert.doesNotMatch(caixa.innerHTML,/Nenhuma falha/);
 c.fetch=async()=>({ok:true,json:async()=>({falhas:[]})});await c.carregarFalhasAutomacoes();assert.match(caixa.innerHTML,/Nenhuma falha/);
});
test('resposta antiga não substitui a atualização mais recente',async()=>{
 const pendentes=[];const {c,caixa}=contexto(()=>new Promise(resolve=>pendentes.push(resolve)));
 const antiga=c.carregarFalhasAutomacoes(),nova=c.carregarFalhasAutomacoes();
 pendentes[1]({ok:true,json:async()=>({falhas:[]})});await nova;
 pendentes[0]({ok:false,json:async()=>({error:'Antigo'})});await antiga;
 assert.match(caixa.innerHTML,/Nenhuma falha/);assert.doesNotMatch(caixa.innerHTML,/Antigo/);
});
test('apenas pendentes oferecem retomada e texto não vira HTML',async()=>{
 const base={item:'vybe:1',ocorrencia:'20',titulo:'<img onerror=x>',clientes:'A, B',motivo:'Falha',tentativas:2,ultima_falha_em:'2026-09-29T12:00:00Z'};
 const {c,caixa}=contexto(async()=>({ok:true,json:async()=>({falhas:['pendente','resolvida','superada','removida'].map(estado=>({...base,estado}))})}));
 await c.carregarFalhasAutomacoes();
 assert.equal((caixa.innerHTML.match(/Tentar novamente/g)||[]).length,1);
 assert.equal((caixa.innerHTML.match(/Ver diagnóstico/g)||[]).length,3);
 assert.doesNotMatch(caixa.innerHTML,/<img/);assert.match(caixa.innerHTML,/&lt;img/);
});
