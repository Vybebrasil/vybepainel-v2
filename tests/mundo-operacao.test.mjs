// SAFE: dados, DOM, rede e câmera simulados; não abre dispositivos nem acessa produção.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const mundo = readFileSync('vybe-mundo.js', 'utf8');
const metricas = vm.createContext({ window: {} }); vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), metricas);
const D = metricas.window.VybeDono;
const calcular = entrada => JSON.parse(JSON.stringify(D.calcular(entrada)));
const hoje = '2026-11-07';
const clientes = [{ nome: 'Copirecê', ativo: true }, { nome: 'Beta', ativo: true }];
function p(id, o = {}) { return { id, nome: 'Demanda '+id, cliente: 'Copirecê', status: 'Pode Fazer', prazo_iso: '', veiculacao_iso: '', ...o }; }
function fonte(nome) { const ini = mundo.search(new RegExp(`(?:async )?function ${nome}\\(`)); assert.ok(ini >= 0, nome); const fim = mundo.indexOf('\n  }', ini); return mundo.slice(ini, fim + 4); }
test('gráfico seleciona prazo ou veiculação sem substituir data ausente nem alterar o hoje real', () => {
  const demandas = [p('1', { prazo_iso: '2026-11-05', veiculacao_iso: '2026-11-12' }), p('2', { prazo_iso: '2026-11-05' }), p('3', { status: 'Finalizado', prazo_iso: '2026-11-04', veiculacao_iso: '2026-11-06', status_updated_at: '2026-11-03T12:00:00Z' })];
  const entrada = { demandas, clientes, hoje };
  const veic = calcular(entrada), prazo = calcular({ ...entrada, graficoSemana: { campo: 'prazo' } });
  assert.equal(veic.graficoSemana.porDia.reduce((n,d) => n+d.previstas,0), 1);
  assert.equal(prazo.graficoSemana.porDia.reduce((n,d) => n+d.previstas,0), 3);
  assert.deepEqual(prazo.hoje, veic.hoje); assert.deepEqual(prazo.cobertura, veic.cobertura);
  assert.deepEqual(prazo.graficoSemana.porDia.map(d=>d.entregues), veic.graficoSemana.porDia.map(d=>d.entregues));
  const proxima = calcular({ ...entrada, graficoSemana: { referencia: '2026-11-14' } });
  assert.equal(proxima.graficoSemana.inicio, '2026-11-09'); assert.equal(proxima.graficoSemana.porDia[3].previstas, 1);
  assert.deepEqual(proxima.hoje, veic.hoje); assert.deepEqual(proxima.semana, veic.semana);
});
test('semana histórica cruza ano e mantém deduplicação e filtro de clientes ativos', () => {
  const item = p('1', { veiculacao_iso: '2026-01-01' });
  const r = calcular({ hoje, clientes, demandas: [item, item, p('2', { cliente: 'Inativo', veiculacao_iso: '2026-01-01' })], graficoSemana: { referencia: '2026-01-01' } }).graficoSemana;
  assert.equal(r.inicio, '2025-12-29'); assert.equal(r.fim, '2026-01-04'); assert.equal(r.porDia[3].previstas, 1);
});
test('atenção lista somente pendências do cliente e mantém responsáveis, datas e motivos', () => {
  const demandas = [p('1', { clientes: ['Beta','Copirecê'], status: 'Em andamento', prazo_iso: '2026-11-05', veiculacao_iso: '2026-11-06', responsavel_ids: ['10','20'] }), p('2', { prazo_iso: '2026-11-06', veiculacao_iso: '2026-11-12' }), p('3', { veiculacao_iso: '2026-12-20' }), p('4', { prazo_iso: '2026-11-08' }), p('5', { veiculacao_iso: '2026-09-01' }), p('6', { status: 'Finalizado', veiculacao_iso: '2026-11-05' })];
  const r = calcular({ demandas, clientes, hoje, pessoas: {10:'Bia',20:'Jady'} });
  const c = r.clientes.find(c=>c.cliente==='Copirecê');
  assert.deepEqual(c.pendencias.map(p=>p.id).sort(), ['1','2','4','5']);
  const compartilhada = c.pendencias.find(p=>p.id==='1');
  assert.equal(compartilhada.cliente, 'Copirecê'); assert.equal(compartilhada.responsavel, 'Bia, Jady');
  assert.deepEqual(compartilhada.motivos, ['Veiculação vencida','Prazo interno vencido']);
  assert.equal(compartilhada.prazo_iso, '2026-11-05'); assert.equal(compartilhada.veiculacao_iso, '2026-11-06');
  for (const g of r.gargalos) { assert.equal(g.lista.length,g.qtd); assert.ok(g.lista.every(p=>!['3','5','6'].includes(p.id))); }
});
test('navegação mantém campo selecionado, avança/volta sete dias e retorna à semana atual', () => {
  const s = { campo:'veiculacao',referencia:'2026-01-01' }, cache={chave:'anterior'}; let pinturas=0;
  const c=vm.createContext({ semanaAgencia:s, cacheDono:cache, window:{VybeDono:D}, hojeIso:()=>hoje, somar:D.util.somarDias, pintarHoje:()=>pinturas++, pintarGestao(){} });
  vm.runInContext(fonte('selecionarSemana'),c);
  c.selecionarSemana({dataset:{semanaCampo:'prazo'}}); assert.equal(s.campo,'prazo');
  c.selecionarSemana({dataset:{semanaPasso:'1'}}); assert.equal(s.referencia,'2026-01-05');
  c.selecionarSemana({dataset:{semanaPasso:'-1'}}); assert.equal(s.referencia,'2025-12-29');
  c.selecionarSemana({dataset:{semanaPasso:'0'}}); assert.equal(s.referencia,''); assert.equal(s.campo,'prazo'); assert.equal(cache.chave,'');
  assert.equal(c.selecionarSemana({dataset:{semanaPasso:'99'}}),false); assert.equal(pinturas,4);
});
const esc = v => String(v ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
test('HUD usa lista inteira do gargalo, cor do painel e mostra campos distintos com conteúdo escapado', () => {
  const lista = Array.from({length:65},(_,i)=>({id:String(i),nome:i===0?'<img src=x>':'Peça '+i,status:'Pode Fazer',cliente:'Copirecê',responsavel:'Bia',prazo_iso:'2026-11-05',veiculacao_iso:'2026-11-12'}));
  const dados=lista.map(d=>({...d,status_color:'#00AABB'})), el={hidden:true,innerHTML:''};
  const N={clientes:[],gargalos:[{status:'Pode Fazer',qtd:65,idadeMedianaDias:1,lista}]};
  const c=vm.createContext({DADOS_ALL:dados,managerCalendarStatusColor:(d,f)=>d?.status_color||f,numerosDoDono:()=>N,gestao:{hidden:true},placa:()=>el,ic:{fechar:'×'},esc,ajustarAreaLivre(){}});
  c.corStatus=(d)=>d?.status_color||'#9AA3A8'; c.situacaoDaPeca=()=>'fazer'; c.STATUS_CORES={}; c.chaveStatus=(s)=>String(s||'').toLowerCase();
  vm.runInContext('const dataCompleta = iso => iso ? iso.slice(8)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : "Não definido";'+fonte('corDaPendencia')+fonte('mostrarPendencias'),c);
  c.mostrarPendencias('','Pode Fazer');
  assert.equal(el.hidden,false); assert.equal((el.innerHTML.match(/class="vv-pendencia"/g)||[]).length,65);
  assert.match(el.innerHTML,/#00AABB/); assert.match(el.innerHTML,/05\/11\/2026/); assert.match(el.innerHTML,/12\/11\/2026/); assert.match(el.innerHTML,/Responsável/); assert.match(el.innerHTML,/Bia/);
  assert.doesNotMatch(el.innerHTML,/<img src=x>/); assert.match(el.innerHTML,/&lt;img src=x&gt;/);
});
test('Minha sala depende do vínculo da conta, sem inferir propriedade pelo nome', () => {
  const e={base:{eu:20,salas:[{id:'sala-a',pessoa_id:10},{id:'sala-b',pessoa_id:'20'}]}};
  const c=vm.createContext({escritorio:e}); vm.runInContext(fonte('minhaSalaDaConta'),c);
  assert.equal(c.minhaSalaDaConta(),'sala-b'); e.base.eu=99; assert.equal(c.minhaSalaDaConta(),'');
});
test('câmera abre o andar e foca apenas a sala efetivamente alcançada', async () => {
  const e={zona:'sala-a'}, abriu=[],focou=[];
  const c=vm.createContext({escritorio:e,mundo:{zonasDoPredio:{'sala-a':{andar:'criacao'},'sala-b':{andar:'gestao'}}},focoSala:0,body:{classList:{contains:()=>false}},abrirAndarVoxel:async a=>abriu.push(a),andarAberto:{focarSala:z=>focou.push(z)},fn:()=>()=>{},console});
  c.zonas3d=()=>c.mundo.zonasDoPredio; vm.runInContext(fonte('focarSalaDaChamada'),c);
  await c.focarSalaDaChamada('sala-b'); assert.deepEqual(abriu,[]);
  await c.focarSalaDaChamada('sala-a'); assert.deepEqual(abriu,['criacao']); assert.deepEqual(focou,['sala-a']);
});
test('entrada tardia de andar não refaz o foco depois de trocar de sala', async () => {
  const e={zona:'a'}, pendentes=[], focou=[];
  const c=vm.createContext({escritorio:e,mundo:{zonasDoPredio:{a:{andar:'um'},b:{andar:'dois'}}},focoSala:0,body:{classList:{contains:()=>false}},abrirAndarVoxel:a=>new Promise(r=>pendentes.push(r)),andarAberto:{focarSala:z=>focou.push(z)},fn:()=>()=>{},console});
  c.zonas3d=()=>c.mundo.zonasDoPredio; vm.runInContext(fonte('focarSalaDaChamada'),c);
  const a=c.focarSalaDaChamada('a'); e.zona='b'; const b=c.focarSalaDaChamada('b'); pendentes[1](); await b; pendentes[0](); await a;
  assert.deepEqual(focou,['b']);
});
const cenaSrc=readFileSync('mundo/mundo-3d.mjs','utf8');
function cena(construir) {
  let motores=0,descartes=0,baixou=0;
  const c=vm.createContext({fetch:async()=>{baixou++;throw new Error('não deveria baixar')},AbortSignal,LOCAIS:{},criarMotor:()=>{motores++;return{destruir:()=>descartes++}},construirCentro:construir,construirPredio:()=>{throw new Error('Falha simulada no prédio')}});
  vm.runInContext(cenaSrc.slice(cenaSrc.indexOf('export async function iniciarMundo')).replace('export async','async'),c);
  return {c,motores:()=>motores,descartes:()=>descartes,baixou:()=>baixou};
}
// Centro comercial (08/11/2026): o 3D não baixa mais o mapa de Irecê nem a base de empresas.
test('o Centro abre sem baixar dados (nem irece.json nem crm-irece.json)', () => {
  assert.doesNotMatch(cenaSrc,/fetch\(/); assert.doesNotMatch(cenaSrc,/irece\.json|crm-irece|carregarEmpresas/);
});
test('construção com falha descarta o motor antes de permitir nova tentativa', async () => {
  for(const construir of [()=>{throw new Error('Falha simulada na construção')},()=>({alturaEm:()=>0})]) {
    const s=cena(construir); await assert.rejects(s.c.iniciarMundo({}, {}),/Falha simulada/);
    assert.equal(s.motores(),1); assert.equal(s.descartes(),1); assert.equal(s.baixou(),0);
  }
});
test('falha de abertura não dispara tentativas automáticas e oferece repetição explícita', async () => {
  let chamadas=0,descartes=0;
  const aviso={hidden:false,textContent:'',innerHTML:''};
  const c=vm.createContext({mundo:null,carregando:null,erroCarga:false,tentativasCarga:0,fonteAgentes:null,ultimaAssinatura:'',raiz:{querySelector:()=>aviso},body:{dataset:{}},matchMedia:()=>({matches:false}),MUNDO_JS:'simulado',MUNDO_DADOS:'dados',MUNDO_CRM:'crm',clientesDoMundo:()=>[],criarFonte:(m)=>m.criarFonteAgentes({}),console:{error(){}},importar:async()=>{chamadas++;return{iniciarMundo:async()=>({criarFonteAgentes(){throw new Error('Erro após iniciar')},destruir(){descartes++}})}}});
  vm.runInContext(fonte('carregar').replace(/import\(/g,'importar('),c);
  await c.carregar(); await c.carregar(); assert.equal(chamadas,1); assert.equal(descartes,1); assert.equal(c.mundo,null); assert.equal(c.erroCarga,true); assert.match(aviso.innerHTML,/data-mundo-repetir/);
  c.erroCarga=false;c.tentativasCarga++;await c.carregar();assert.equal(chamadas,2);assert.equal(descartes,2);
});
test('modo Irecity oculta o legado desde o início do body; porta legado=1 é preservada', () => {
  const html=readFileSync('index.html','utf8');const body=html.slice(html.indexOf('<body'));
  const script=body.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const [search,esperado] of [['',true],['?legado=1',false]]) {
    let mundo=false;vm.runInNewContext(script,{URLSearchParams,location:{search},document:{body:{classList:{add:()=>{mundo=true}}}}});assert.equal(mundo,esperado);
  }
  assert.ok(body.indexOf('<script>')<body.indexOf('id="loading"'));
});
test('clique na pessoa da barra enquadra sua sala; Minha sala usa o vínculo da conta', () => {
  let handler; const focos=[],idas=[];
  const c=vm.createContext({barra:{addEventListener:(n,f)=>{handler=f}},escritorio:{zona:'sala-a',online:[{id:'2',zona:'sala-a'}]},pessoaAberta:null,chamarAberto:false,pintarChamada(){},focarSalaDaChamada:z=>focos.push(z),minhaSalaDaConta:()=> 'minha-vinculada',irParaSala:z=>idas.push(z)});
  const ini=mundo.indexOf("  barra.addEventListener?.('click'");const fim=mundo.indexOf("  if (typeof setInterval",ini);
  vm.runInContext(mundo.slice(ini,fim),c);
  const clicar=dataset=>handler({target:{closest:()=>({dataset,disabled:false})}});
  clicar({pessoa:'2'}); assert.deepEqual(focos,['sala-a']); clicar({pessoa:'2'}); assert.equal(focos.length,1);
  clicar({chamada:'minha-sala'}); assert.deepEqual(idas,['minha-vinculada']);
});
