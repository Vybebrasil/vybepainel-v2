import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function carregar() {
  const store = new Map();
  const c = vm.createContext({
    console,
    window: {},
    document: { getElementById: () => null },
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
    },
    CLIENT_MASTER_HEADS: [
      { name: 'Brussolo Ristorante', status: 'Ativo', head: 'Vinícius' },
      { name: 'Serra Grande Bebidas', status: 'Ativo', head: 'Taynara' },
    ],
    CLIENT_MASTER_ACESSOS: [],
    DADOS_ALL: [],
    DADOS: [],
    DADOS_DEMANDAS: [],
    clientesDoItem: (i) => i.clientes,
    isRequestItem: (i) => i.quadro === 'demandas',
  });
  for (const arquivo of ['vybe-config.js', 'vybe-clientes.js', 'vybe-clientes-cerebro.js']) {
    vm.runInContext(fs.readFileSync(arquivo, 'utf8'), c);
  }
  return c;
}

test('construirGrafoCerebro monta clientes e sinapses de identidade visual e linha Instagram', () => {
  const c = carregar();
  const grafo = c.construirGrafoCerebro('todos');
  assert.ok(grafo.nodes.length > 100, 'deve conter nós de clientes e sinapses');
  assert.ok(grafo.links.length > 100, 'deve conter conexões sinápticas entre clientes e atributos');
  const brussolo = grafo.nodes.find((n) => n.grupo === 'cliente' && /Brussolo/i.test(n.label));
  assert.ok(brussolo, 'deve existir o nó do cliente Brussolo Ristorante');
  assert.ok(Array.isArray(brussolo.dados.paleta) && brussolo.dados.paleta.length >= 3, 'cliente deve ter paleta hex definida');
});

test('construirGrafoCerebro filtra por cliente específico mantendo suas sinapses completas', () => {
  const c = carregar();
  const grafo = c.construirGrafoCerebro('Serra Grande Bebidas');
  const clientesNoGrafo = grafo.nodes.filter((n) => n.grupo === 'cliente');
  assert.equal(clientesNoGrafo.length, 1);
  assert.match(clientesNoGrafo[0].label, /Serra Grande/i);
  const grupos = new Set(grafo.nodes.map((n) => n.grupo));
  assert.ok(grupos.has('identidade'));
  assert.ok(grupos.has('instagram'));
  assert.ok(grupos.has('regras'));
  assert.ok(grupos.has('aprendizados'));
});

test('renderCerebroVybesHtml e cerebroDoClienteCardHtml geram marcação do canvas e ficha de identidade visual', () => {
  const c = carregar();
  vm.runInContext("CEREBRO_STATE.abaInterna = 'mapa'", c);
  const htmlCanvas = c.renderCerebroVybesHtml();
  assert.match(htmlCanvas, /vybes-cerebro-canvas/);
  assert.match(htmlCanvas, /CÉREBRO DO VYBES/);
  const htmlCard = c.cerebroDoClienteCardHtml('Brussolo Ristorante');
  assert.match(htmlCard, /O que o VYBES sabe de Brussolo Ristorante/);
  assert.match(htmlCard, /Abrir o mapa<\/button>/);
});

test('visaoDeClientes aceita tabela, fichas e sinapses preservando compatibilidade', () => {
  const c = carregar();
  assert.equal(c.visaoDeClientes(), 'tabela');
  c.localStorage.setItem('vybe_clientes_visao', 'fichas');
  assert.equal(c.visaoDeClientes(), 'fichas');
  c.localStorage.setItem('vybe_clientes_visao', 'sinapses');
  assert.equal(c.visaoDeClientes(), 'sinapses');
});

test('atividade real distingue fonte indisponível, vazio e aprendizado com prova; escapa textos', () => {
  const c = carregar();
  assert.match(c.renderCerebroVybesHtml(), /Forma de ver o cérebro/);
  assert.match(c.renderAtividadeCerebroHtml(), /Aguardando consulta/);
  vm.runInContext(`CEREBRO_ATIVIDADE.erro = 'Central indisponível'`, c);
  assert.match(c.renderAtividadeCerebroHtml(), /role="alert">Central indisponível/);
  vm.runInContext(`CEREBRO_ATIVIDADE.dados = {lidoEm:1,geradoEm:null,clientes:[]}`, c);
  assert.match(c.renderAtividadeCerebroHtml(), /sem estudo vigente/);
  assert.match(c.renderAtividadeCerebroHtml(), /não significa ausência de conhecimento/);
  vm.runInContext(`CEREBRO_ATIVIDADE.dados = {lidoEm:1,geradoEm:1,clientes:[{cliente:'Brussolo Ristorante',ficha:true,aprendizados:[{texto:'<script>erro</script>',prova:'Uma fala',salvo:false},{texto:'Orientação revisada',prova:'Outra fala',salvo:true}]}]}`, c);
  const html = c.renderAtividadeCerebroHtml();
  assert.match(html, /Candidato a aprendizado/);
  assert.match(html, /Já consta na ficha/);
  assert.match(html, /Trecho de origem: Uma fala/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>erro/);
});

 test('cliente fora do estudo recebe caminhos para a atividade real; aliases usam a base existente', () => {
  const c = carregar();
  vm.runInContext(`CEREBRO_STATE.clienteFoco = 'ACE'; CEREBRO_ATIVIDADE.dados = {lidoEm:1,geradoEm:1,clientes:[{cliente:'Brussolo Ristorante',ideias:[{titulo:'Ideia real'}],aprendizados:[]}]}`, c);
  const html = c.renderAtividadeCerebroHtml();
  assert.match(html, /A consulta funcionou/);
  assert.match(html, /Ver toda a atividade/);
  assert.match(html, /Brussolo Ristorante · 1 sugestões/);
  assert.equal(c.chaveClienteAtividadeCerebro('Academia Lions'),c.chaveClienteAtividadeCerebro('Academia Lions Top'));
 });

 test('atividade da ACE usa os aliases do cadastro e não se confunde com DiaCenter', () => {
  const c = carregar();
  assert.equal(c.chaveClienteAtividadeCerebro('Ace - Associação Comercial'), c.chaveClienteAtividadeCerebro('ACE - Associação Comercial de Irecê (ACE)'));
  assert.notEqual(c.chaveClienteAtividadeCerebro('ACE - Associação Comercial de Irecê (ACE)'), c.chaveClienteAtividadeCerebro('DiaCenter'));
  vm.runInContext(`CEREBRO_STATE.clienteFoco='ACE - Associação Comercial de Irecê (ACE)'; CEREBRO_ATIVIDADE.dados={lidoEm:1,clientes:[{cliente:'Ace - Associação Comercial',ideias:[{titulo:'Comércio local',formato:'Card'}]}]}`,c);
  assert.match(c.renderAtividadeCerebroHtml(),/Comércio local/);
  assert.doesNotMatch(c.renderAtividadeCerebroHtml(),/Este cliente não aparece/);
 });

test('mapa revela só os nós principais; clique ou zoom expande uma região sem reabrir o resto', () => {
  const c=carregar();
  vm.runInContext(`CEREBRO_STATE.clienteFoco='Academia Lions Top'; CEREBRO_STATE.abaInterna='mapa'; CEREBRO_STATE.grupoExpandido=null; CEREBRO_STATE.zoom=1`,c);
  const grafo=c.construirGrafoCerebro('Academia Lions Top');
  const folhas=grafo.nodes.filter(n=>n.nivel===2);
  assert.ok(folhas.length>10);
  assert.equal(folhas.filter(n=>c.noVisivelCerebro(n)).length,0);
  assert.equal(grafo.nodes.filter(n=>c.noVisivelCerebro(n)).length,10);
  vm.runInContext(`CEREBRO_STATE.grupoExpandido='identidade'`,c);
  assert.ok(folhas.some(n=>c.noVisivelCerebro(n)));
  assert.ok(folhas.filter(n=>c.noVisivelCerebro(n)).every(n=>n.grupo==='identidade'));
  vm.runInContext(`CEREBRO_STATE.grupoExpandido=null; CEREBRO_STATE.zoom=1.7; CEREBRO_STATE.grupoZoom='instagram'`,c);
  assert.ok(folhas.filter(n=>c.noVisivelCerebro(n)).every(n=>n.grupo==='instagram'));
  vm.runInContext(`CEREBRO_STATE.gruposAtivos.delete('instagram')`,c);
  assert.equal(folhas.filter(n=>c.noVisivelCerebro(n)).length,0);
  const html=c.renderCerebroVybesHtml();
  assert.match(html,/Explorar áreas/);
  assert.match(html,/Aproximar mapa/);
  assert.doesNotMatch(html,/Categorias do cérebro/);
  assert.match(html,/Fechar detalhes/);
});

test('visão geral mantém somente clientes; categorias ficam no mapa individual',()=>{
  const c=carregar();
  const grafo=c.construirGrafoCerebro('todos');
  const visiveis=grafo.nodes.filter(n=>c.noVisivelCerebro(n));
  assert.ok(visiveis.length>10);
  assert.ok(visiveis.every(n=>n.grupo==='cliente'));
});

test('motor suspende o fluxo com aba oculta, respeita movimento reduzido e limpa o temporizador',()=>{
  const c=carregar(), quadros=[],temporizadores=new Map();let n=0;
  const contexto=new Proxy({measureText:t=>({width:t.length*6}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const canvas={isConnected:true,clientWidth:800,clientHeight:600,style:{},parentElement:{getBoundingClientRect:()=>({width:800,height:600})},getContext:()=>contexto};
  c.document={body:{dataset:{motion:'full'}},hidden:false,getElementById:id=>id==='vybes-cerebro-canvas'?canvas:null,addEventListener(){},removeEventListener(){}};
  c.window={devicePixelRatio:1,matchMedia:()=>({matches:false})};
  c.getComputedStyle=()=>({getPropertyValue:()=>''});
  c.performance={now:()=>1000};
  c.requestAnimationFrame=fn=>quadros.push(fn);
  c.setTimeout=fn=>{temporizadores.set(++n,fn);return n;};
  c.clearTimeout=id=>temporizadores.delete(id);
  vm.runInContext(`CEREBRO_STATE.clienteFoco='Academia Lions Top'; const g=construirGrafoCerebro('Academia Lions Top'); CEREBRO_STATE.nodes=g.nodes;CEREBRO_STATE.links=g.links`,c);
  c.iniciarMotorCanvasCerebro();quadros.shift()();
  assert.equal(temporizadores.size,1);
  c.document.hidden=true;
  [...temporizadores.values()][0]();quadros.shift()();
  assert.equal(temporizadores.size,0,'aba oculta não agenda fluxo');
  c.document.hidden=false;c.document.body.dataset.motion='reduce';
  c.iniciarMotorCanvasCerebro();quadros.shift()();
  assert.equal(temporizadores.size,0,'preferência do painel desliga movimento');
  c.document.body.dataset.motion='full';c.iniciarMotorCanvasCerebro();quadros.shift()();
  assert.equal(temporizadores.size,1);
  vm.runInContext('CEREBRO_STATE.pararMotor()',c);
  assert.equal(temporizadores.size,0);
});
