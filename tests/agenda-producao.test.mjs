import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { gravacoesDaAgenda,listarAgendaProducao } from '../server/agenda-producao.js';
const evento=(o={})=>({id:'1',summary:'Gravação Hellen',status:'confirmed',start:{dateTime:'2026-10-15T12:00:00-07:00'},end:{dateTime:'2026-10-15T13:00:00-07:00'},...o});
test('gravações reais convertem para Bahia e excluem privado e cancelado, sinalizando eventos ambíguos',()=>{
  const lista=gravacoesDaAgenda([evento(),evento(),evento({id:'2',summary:'Reunião'}),evento({id:'3',visibility:'private'}),evento({id:'4',status:'cancelled'}),evento({id:'5',summary:'Mizinho - freela',start:{date:'2026-10-16'},end:{date:'2026-10-17'}})]);
  assert.equal(lista.length,3);
  assert.equal(lista[0].horario,'16:00 às 17:00');
  assert.equal(lista[0].dia,'2026-10-15');
  assert.match(lista[2].horario,/Dia inteiro/);
  assert.equal(lista[1].ambiguo,true);
  const ctx=vm.createContext({eventos:lista});
  vm.runInContext(fs.readFileSync('vybe-resumo.js','utf8'),ctx);
  const texto=vm.runInContext("resumoProducaoAgenda(eventos,'2026-10-15')",ctx);
  assert.match(texto,/Mizinho/); assert.match(texto,/16:00 às 17:00: Gravação Hellen/);
  assert.doesNotMatch(texto,/prazo|veiculação/);
});
test('API Google consulta o dia e os próximos cinco dias com escopo só de leitura, recorrências e todas as páginas',async()=>{
  const chamadas=[]; let scope;
  const resultado=await listarAgendaProducao('2026-12-31',{
    obterToken:async s=>(scope=s,'token-ficticio'),buscar:async(url,op)=>{
      chamadas.push({url:new URL(url),op});
      return {ok:true,json:async()=> chamadas.length===1 ? {items:[],nextPageToken:'segunda'} : {items:[evento()]}};
    },
  });
  assert.match(scope,/calendar.events.readonly$/);
  assert.equal(chamadas.length,2);
  assert.equal(chamadas[0].url.searchParams.get('singleEvents'),'true');
  assert.equal(chamadas[0].url.searchParams.get('timeMin'),'2026-12-31T00:00:00-03:00');
  assert.equal(chamadas[0].url.searchParams.get('timeMax'),'2027-01-06T00:00:00-03:00');
  assert.equal(chamadas[1].url.searchParams.get('pageToken'),'segunda');
  assert.equal(resultado.eventos.length,1);
});
test('agenda vazia é distinta de erro e datas inválidas não chamam a integração',async()=>{
  let chamadas=0;
  const options={obterToken:async()=>{chamadas++;return 'teste';},buscar:async()=>({ok:true,json:async()=>({items:[]})})};
  for(const data of ['2026-02-30','invalida','2026-13-01']) await assert.rejects(listarAgendaProducao(data,options),/data válida/);
  assert.equal(chamadas,0);
  assert.deepEqual((await listarAgendaProducao('2026-10-15',options)).eventos,[]);
  await assert.rejects(listarAgendaProducao('2026-10-15',{...options,buscar:async()=>({ok:false,status:403})}),/não tem acesso/);
  await assert.rejects(listarAgendaProducao('2026-10-15',{...options,buscar:async()=>({ok:true,json:async()=>({})})}),/inválida/);
});

test('falha da agenda bloqueia cópia e resposta de outro dia não sobrescreve o resumo atual',async()=>{
  const fonte=fs.readFileSync('vybe-gestor.js','utf8');
  const trecho=fonte.slice(fonte.indexOf('async function loadDailySummaryAgenda()'),fonte.indexOf('async function openDailySummary'));
  const area={value:''},botao={disabled:false};
  const documento={getElementById:id=>id==='daily-summary-copy'?botao:area};
  const ctx=vm.createContext({dailySummaryMessages:[{id:'producao',pronta:false}],dailySummarySelected:'producao',dailySummaryDate:'2026-10-15',document:documento,AbortSignal,
    fetch:async()=>({ok:false,json:async()=>({error:'Acesso recusado'})}),resumoProducaoAgenda:()=> 'não deveria gerar'});
  vm.runInContext(trecho,ctx);
  await ctx.loadDailySummaryAgenda();
  assert.equal(botao.disabled,true); assert.match(area.value,/Acesso recusado/);
  let resolver;
  ctx.fetch=()=>new Promise(resolve=>{resolver=resolve;});
  const antiga=ctx.loadDailySummaryAgenda();
  ctx.dailySummaryMessages=[{id:'producao',texto:'Outro dia'}];
  ctx.dailySummaryDate='2026-10-16'; area.value='Outro dia';
  resolver({ok:true,json:async()=>({ok:true,eventos:[]})});
  await antiga;
  assert.equal(area.value,'Outro dia');
});

test('credencial ausente produz diagnóstico seguro antes de consultar o Google',async()=>{
  const anterior=process.env.GOOGLE_SERVICE_ACCOUNT;
  delete process.env.GOOGLE_SERVICE_ACCOUNT;
  try {
    await assert.rejects(listarAgendaProducao('2026-10-15'),e=>e.status===503&&e.publica===true&&/GOOGLE_SERVICE_ACCOUNT/.test(e.message));
  } finally {
    if(anterior===undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT;
    else process.env.GOOGLE_SERVICE_ACCOUNT=anterior;
  }
});
