import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const agenda = fs.readFileSync('vybe-agenda.js','utf8');
function contexto() {
  const elementos = new Map();
  const novo = () => ({innerHTML:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},remove(){}});
  const c = vm.createContext({console,window:{addEventListener(){},removeEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},
    document:{getElementById:id=>{if(!elementos.has(id))elementos.set(id,novo());return elementos.get(id);},
      querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:novo,
      body:{classList:{contains:()=>false},append:(_f,menu)=>elementos.set(menu.id,menu)}},
    clientesDoItem:d=>d.clientes || [d.cliente],clientMasterResolveName:n=>n,
    selectedPersonIds:new Set(['gestor']),itemMatchesSelectedPeople:()=>false,
    dateMode:'prazo',managerCalendarSourceFilter:'content',managerCalendarClientFilter:'Outro',
    MOSTRAR_FORA_DO_FEED:false,FORA_DO_FEED_NO_MES:17,solicitacaoVaiProFeed:()=>false,
    managerCalendarMonthMeta:()=>({cells:[{iso:'2026-09-26',date:new Date(2026,8,26),inMonth:true}]}),
    managerCalendarLabel:()=> 'Setembro de 2026',safeText:String,planningDateBr:String,ancorarPopover(){},
    managerCalendarEventHtml:i=>`<article data-id="${i.id}">${i.nome}</article>`,agendaDeDemandasAberta:true,
  });
  for(const f of ['vybe-config.js','vybe-demandas.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
  for(const [ini,fim] of [
    ['function managerCalendarItems(', '// Todo cliente da base'],
    ['function fecharDiaDoCalendario()', 'function managerCalendarEventHtml('],
    ['function renderAgendaDeDemandas()', '// ── o arquivo']
  ]) vm.runInContext(agenda.slice(agenda.indexOf(ini),agenda.indexOf(fim,agenda.indexOf(ini))),c);
  c.itens = [
    ...Array.from({length:6},(_,n)=>({id:`d${n}`,nome:`Demanda ${n}`,cliente:'Principal',clientes:['Principal','Parceiro'],
      status:'Pode Fazer',responsavel_id:'operador',responsavel_ids:['operador'],
      conclusao_iso:'2026-09-26',prazo_iso:'2026-09-25'})),
    {id:'excluida',nome:'Outro status',cliente:'Parceiro',status:'Feito',conclusao_iso:'2026-09-26'},
    {id:'outro-mes',nome:'Outubro',cliente:'Parceiro',status:'Pode Fazer',conclusao_iso:'2026-10-20'},
    {id:'sem-data',nome:'Sem data',cliente:'Parceiro',status:'Pode Fazer'}
  ];
  vm.runInContext("DADOS_DEMANDAS=itens; clienteDemandasExato='Parceiro'; currentDemandaStatusFilter='Pode Fazer';",c);
  return {c,elementos};
}

test('calendário usa filtros de Demandas e inclui cliente secundário uma única vez, sem herdar filtros do Gestor',()=>{
  const {c}=contexto();
  const resultado=c.managerCalendarItems({apenas:'request'});
  assert.deepEqual(Array.from(resultado,i=>i.id),['d0','d1','d2','d3','d4','d5','outro-mes']);
  assert.equal(resultado[0].calendarDateIso,'2026-09-26');
  assert.equal(c.FORA_DO_FEED_NO_MES,17);
  vm.runInContext("currentDemandaPersonFilter='operador'; currentDemandaDayFilter='2026-09-25'; currentDemandaDateMode='prazo'",c);
  const porPrazo=c.managerCalendarItems({apenas:'request'});
  assert.equal(porPrazo.length,6);
  assert.ok(porPrazo.every(i=>i.calendarDateIso==='2026-09-25'));
});

test('contador e cabeçalho contam somente as solicitações do período exibido',()=>{
  const {c,elementos}=contexto();
  c.renderAgendaDeDemandas();
  assert.equal(elementos.get('demandas-agenda-count').textContent,6);
  const html=elementos.get('agenda-board-demandas').innerHTML;
  assert.match(html,/6 solicitações com data/);
  assert.doesNotMatch(html,/Outubro|Outro status|Sem data/);
  assert.match(html,/abrirDiaDoCalendario\(event,'2026-09-26','demandas'\)/);
});

test('mais neste dia mantém origem, data e filtros da lista de Demandas',()=>{
  const {c,elementos}=contexto();
  c.abrirDiaDoCalendario({preventDefault(){},stopPropagation(){},currentTarget:{getBoundingClientRect:()=>({})}},'2026-09-26','demandas');
  const html=elementos.get('dia-do-calendario').innerHTML;
  assert.equal((html.match(/data-id=/g)||[]).length,6);
  assert.match(html,/data-id="d5"/);
  assert.doesNotMatch(html,/excluida|outro-mes|sem-data/);
  assert.match(html,/6 solicitações/);
});
