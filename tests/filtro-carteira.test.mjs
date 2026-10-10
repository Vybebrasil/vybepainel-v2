import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const fonte=p=>fs.readFileSync(p,'utf8');
function contexto(){
 const c=vm.createContext({console,window:{},localStorage:{getItem:()=>null},document:{querySelectorAll:()=>[],getElementById:()=>null},CADASTRO_CLIENTES:[],
  clientMasterResolveName:n=>n,selectedPersonIds:new Set(),itemMatchesSelectedPeople:()=>true,
  managerCalendarSourceFilter:'all',managerCalendarClientFilter:'all',MOSTRAR_FORA_DO_FEED:true,
  solicitacaoVaiProFeed:()=>true,FORA_DO_FEED_NO_MES:0,ordenarItens:x=>x,ORDEM_DOS_GRUPOS:['g'],TITULO_DOS_GRUPOS:{g:'Grupo'},GROUP_MAP:{},
  dateMode:'veiculacao',getDateIso:d=>d.veiculacao_iso});
 vm.runInContext(fonte('vybe-config.js'),c);
 vm.runInContext(fonte('vybe-core.js').split('// QUANDO FOI')[0],c);
 vm.runInContext(fonte('vybe-demandas.js'),c);
 const agenda=fonte('vybe-agenda.js');
 for(const [ini,fim] of [['function managerCalendarItems(', '// Todo cliente da base'],['function itensPorGrupo(', '// ── ordenação por coluna']])vm.runInContext(agenda.slice(agenda.indexOf(ini),agenda.indexOf(fim,agenda.indexOf(ini))),c);
 c.itens=[{id:'v',clientes:['VOA'],status:'Pode Fazer'}, {id:'e',clientes:['Hellen Rocha'],status:'Pode Fazer'}, {id:'ambas',clientes:['VOA','Antonov','VOA'],status:'Pode Fazer'}, {id:'sem',cliente:'Cliente novo',status:'Pode Fazer'}, {id:'final',cliente:'VOA',status:'Feito'}].map(i=>({...i,group_id:'g',semana:1,veiculacao_iso:'2026-10-08',conclusao_iso:'2026-10-08'}));
 vm.runInContext('DADOS_ALL=itens; DADOS=itens; DADOS_DEMANDAS=itens;',c);
 return c;
}
const ids=lista=>Array.from(lista,i=>i.id);
test('carteira respeita qualquer vínculo, aliases e cadastro sem duplicar atividade',()=>{
 const c=contexto();vm.runInContext("filtroCarteira='vinicius'",c);
 assert.deepEqual(ids(c.itens.filter(c.itemNaCarteira)),['v','ambas','final']);
 vm.runInContext("filtroCarteira='ewerton'",c);assert.deepEqual(ids(c.itens.filter(c.itemNaCarteira)),['e','ambas']);
 c.CADASTRO_CLIENTES=[{nome:'VOA',responsavel:'Ewerton'}];assert.deepEqual(ids(c.itens.filter(c.itemNaCarteira)),['v','e','ambas','final']);
 vm.runInContext("filtroCarteira='all'",c);assert.equal(c.itens.filter(c.itemNaCarteira).length,5);
});
test('demanda, contagem por cliente e calendário respeitam carteira combinada com status',()=>{
 const c=contexto();vm.runInContext("filtroCarteira='vinicius'; currentDemandaStatusFilter='Pode Fazer'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['v','ambas']);
 assert.deepEqual(ids(c.managerCalendarItems({apenas:'request'})),['v','ambas']);
 vm.runInContext("clienteDemandasExato='Antonov'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['ambas']);
 assert.deepEqual(ids(c.filtrarDemandasBase({semCliente:true})),['v','ambas']);
});
test('grupos e calendário de conteúdos usam a mesma carteira; Todos inclui sem definição',()=>{
 const c=contexto();vm.runInContext("filtroCarteira='ewerton'",c);
 assert.deepEqual(ids(c.itensPorGrupo()[0].itens),['e','ambas']);
 assert.deepEqual(ids(c.managerCalendarItems({apenas:'content'})),['e','ambas']);
 vm.runInContext("filtroCarteira='all'",c);assert.equal(c.itensPorGrupo()[0].itens.length,5);
});
test('seletor recusa valor desconhecido e sincroniza controles sem alterar dados',()=>{
 const c=contexto();const controles=[{dataset:{}},{dataset:{}}];c.document.querySelectorAll=()=>controles;
 c.atualizarVisoesDaCarteira=()=>c.pintarFiltroCarteira();c.ensureClientMasterSources=()=>Promise.resolve();
 c.definirFiltroCarteira('ewerton');assert.ok(controles.every(x=>x.value==='ewerton'));
 c.definirFiltroCarteira('outro');assert.equal(vm.runInContext('filtroCarteira',c),'ewerton');
 c.definirFiltroCarteira('all');assert.ok(controles.every(x=>x.value==='all'));assert.equal(c.itens.length,5);
});
test('busca de demandas encontra título ou cliente e mantém seleção exata',()=>{
 const c=contexto();c.itens[0].nome='Briefing de lançamento';
 vm.runInContext("buscaClienteDemandas='briefing'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['v']);
 vm.runInContext("buscaClienteDemandas='Antonov'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['ambas']);
 vm.runInContext("clienteDemandasExato='Briefing'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),[]);
});

test('visões de demandas separam concluídas e combinam dono, carteira e cliente',()=>{
 const c=contexto(); c.pessoaLogada=()=>({id:'7'});
 c.itens[0].responsavel_ids=['7'];c.itens[1].responsavel_id=8;
 vm.runInContext("visaoRapidaDemandas='abertas'",c);
 assert.equal(c.filtrarDemandasBase().length,4);
 vm.runInContext("visaoRapidaDemandas='minha'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['v']);
 vm.runInContext("visaoRapidaDemandas='sem'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['ambas','sem']);
 vm.runInContext("visaoRapidaDemandas='concluidas';clienteDemandasExato='VOA'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),['final']);
 c.pessoaLogada=()=>null;vm.runInContext("visaoRapidaDemandas='minha'",c);
 assert.deepEqual(ids(c.filtrarDemandasBase()),[]);
});

test('preferências por usuário recuperam filtros e ignoram JSON inválido',()=>{
 const c=contexto(), salvos=new Map(); c.pessoaLogada=()=>({id:'7'});
 c.localStorage={getItem:k=>salvos.get(k),setItem:(k,v)=>salvos.set(k,v)};
 c.CAMPOS_ORDENAVEIS={nome:{}};c.ORDEM={campo:'nome',desc:true};
 c.gruposDeDemandasAberto=true;c.agendaDeDemandasAberta=false;
 c.restaurarPreferenciasDemandas();
 assert.equal(vm.runInContext('visaoRapidaDemandas',c),'abertas');
 vm.runInContext("buscaClienteDemandas='Teste';visaoRapidaDemandas='sem'",c);
 c.guardarPreferenciasDemandas();
 assert.equal(JSON.parse(salvos.get('vybe_demandas_preferencias:7')).busca,'Teste');
 vm.runInContext("preferenciasDemandasUsuario=null;buscaClienteDemandas=''",c);
 c.restaurarPreferenciasDemandas();assert.equal(vm.runInContext('buscaClienteDemandas',c),'Teste');
 c.pessoaLogada=()=>({id:'8'});salvos.set('vybe_demandas_preferencias:8','{ruim');
 c.restaurarPreferenciasDemandas();assert.equal(vm.runInContext('buscaClienteDemandas',c),'');
});
