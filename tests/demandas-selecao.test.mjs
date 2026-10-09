import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const agenda=fs.readFileSync('vybe-agenda.js','utf8');
const risco=fs.readFileSync('vybe-risco.js','utf8');
test('Shift usa ordem visível da tabela de demandas, inclusive ordenação invertida',()=>{
 const c=vm.createContext({SELECIONADAS:new Set(),ULTIMA_MARCADA:null,repintarOndeHaSelecao(){},showToast(){}});
 vm.runInContext(agenda.slice(agenda.indexOf('function alternarSelecao('),agenda.indexOf('// Marcar uma linha')),c);
 const evento=shiftKey=>({shiftKey,currentTarget:{closest:()=>({querySelectorAll:()=>['d3','d2','d1'].map(itemId=>({dataset:{itemId}}))})}});
 c.alternarSelecao('d3',true,evento(false));c.alternarSelecao('d1',true,evento(true));
 assert.deepEqual([...c.SELECIONADAS],['d3','d2','d1']);
 c.alternarSelecao('d3',false,evento(true));assert.equal(c.SELECIONADAS.size,0);
});
test('selecionar grupo usa fonte de Demandas e todas as linhas filtradas, inclusive além da primeira página',()=>{
 const c=vm.createContext({activeBoard:'demandas',SELECIONADAS:new Set(),gruposExpandidos:new Set(),LINHAS_POR_GRUPO:2,
 VISAO_DE_GRUPOS:{demandas:{fonte:()=>['d1','d2','d3'],ordem:()=>['g']}},
 itensPorGrupo:(itens)=>[{id:'g',itens:itens.map(id=>({id}))}],repintarOndeHaSelecao(){}});
 vm.runInContext(agenda.slice(agenda.indexOf('function selecionarGrupo('),agenda.indexOf('function limparSelecao(')),c);
 c.selecionarGrupo('g',true);assert.deepEqual([...c.SELECIONADAS],['d1','d2','d3']);
 c.selecionarGrupo('g',false);assert.equal(c.SELECIONADAS.size,0);
});
test('patch de automação atualiza fonte de demandas, grupo e responsáveis vazios',()=>{
 const request={id:'d1',group_id:'antigo',responsavel_ids:['1'],responsavel_id:'1',responsavel:'Pessoa'};
 const c=vm.createContext({DADOS:[],DADOS_ALL:[],DADOS_DEMANDAS:[request],TEAM_USERS:[],
 outboundPatchFields:p=>Object.entries(p),recalcularAtrasoDoItem(){},getOperationalRisk(){},saveProductionCache(){},renderOutboundItemPatch(){},queueOutboundItemReconciliation(){}});
 vm.runInContext(risco.slice(risco.indexOf('function applyOutboundItemPatch('),risco.indexOf('function renderOutboundItemPatch(')),c);
 c.applyOutboundItemPatch('d1',{grupo_id:'concluidas',grupo:'Concluídas',responsavel_ids:[],status:'Feito'});
 assert.equal(request.group_id,'concluidas');assert.equal(request.status,'Feito');
 assert.equal(request.responsavel_ids.length,0);assert.equal(request.responsavel_id,'');assert.equal(request.responsavel,'—');
});
