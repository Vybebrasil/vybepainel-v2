// Construção como jogo (26/10/2026): pisos, paredes e blocos grátis, modos na
// barra de baixo e a peça de piso conferida sem esperar a arte.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { MOVEIS_ESSENCIAIS, MOVEIS_DE_CONSTRUCAO, ehDeConstrucao, precoMovel, vitrineDaSemana } from '../server/escritorio-economia.js';
import { QUARTOS } from '../server/escritorio-quartos.js';

const catalogo = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8'));

test('pisos, acabamentos, blocos e revestimentos de parede são grátis; decoração continua paga', () => {
  for (const categoria of ['Pisos do acervo', 'Acabamentos', 'Blocos e materiais'])
    for (const m of catalogo.filter((x) => x.categoria === categoria)) {
      assert.ok(MOVEIS_ESSENCIAIS.includes(m.classe), `${categoria}: ${m.classe}`);
      assert.equal(precoMovel(m.classe), 0);
    }
  assert.ok(ehDeConstrucao({ classe: 'country_forestwall', nome: 'Forest Wall', categoria: 'Na parede' }));
  // Anúncio, luminária e quadro não são revestimento.
  assert.ok(!ehDeConstrucao({ classe: 'ads_dave_wall', nome: 'ads_dave_wall', categoria: 'Na parede' }));
  assert.ok(!ehDeConstrucao({ classe: 'boutique_lampwall', nome: 'Light Wall', categoria: 'Na parede' }));
  assert.ok(!ehDeConstrucao({ classe: 'bling_sofa_mu', nome: 'Sofá', categoria: 'Cadeiras e sofás' }));
  const sofa = catalogo.find((m) => m.categoria === 'Cadeiras e sofás' && !MOVEIS_ESSENCIAIS.includes(m.classe));
  assert.ok(precoMovel(sofa.classe) > 0);
  // Os essenciais de antes continuam lá, e o navegador recebe a lista de construção.
  for (const c of JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json', import.meta.url), 'utf8')).essenciais) assert.ok(QUARTOS.essenciais.includes(c));
  assert.deepEqual(QUARTOS.construcao, MOVEIS_DE_CONSTRUCAO);
});

test('peça de construção que estava na tabela da loja não volta para a vitrine', () => {
  const piso = catalogo.find((m) => m.categoria === 'Pisos do acervo').classe;
  // carregarLoja tira os essenciais antes de montar a vitrine; aqui a regra de fora.
  const itens = [{ classe: piso, raridade: 'raro', restante: null, marco: null }, { classe: 'outro', raridade: 'raro', restante: null, marco: null }]
    .filter((i) => !MOVEIS_ESSENCIAIS.includes(i.classe));
  assert.deepEqual(vitrineDaSemana({ semana: '2026-10-26', raridades: [{ chave: 'raro', vitrine: 3 }], itens }), ['outro']);
});

function contexto() {
  const avisos = [];
  const c = vm.createContext({ avisos, console, safeText: String, window: {}, document: { querySelector: () => null, getElementById: () => null } });
  vm.runInContext(`var escritorio={base:{eu:'1',quartos:{essenciais:['piso_a','bloco_a','cadeira_a','vybe_bloco_invisivel'],construcao:['piso_a','bloco_a','parede_a']},economia:{inventario:[]}},edicao:{camada:'sala-0',itens:[],passos:['x'],futuro:[]},catalogoCategoria:'',pincel:null,mapa:{previa(){},pincel(){}}};
  var ESCRITORIO_PISOS_SALA=[['','Padrão'],['verde','Verde']],ESCRITORIO_ESTILOS_PAREDE=[['c','Tijolo']],ESCRITORIO_FORMAS_PLANTA=[['p','Chão','']];
  function escritorioPincel(){return escritorio.pincel ||= {ferramenta:'piso',piso:'verde',estilo:'c',cor:'',altura:'2'}}
  function escritorioMinhaMesa(){return {ambiente:{id:'sala-0'}}}
  function escritorioIcone(){return '<svg></svg>'}function escritorioNomeDaClasse(c){return c}
  function renderEscritorio(){}function escritorioAviso(t){avisos.push(t)}`, c);
  vm.runInContext(readFileSync('vybe-escritorio-construcao.js', 'utf8'), c);
  return (s) => vm.runInContext(s, c);
}

test('modos mudam a Oficina e o pincel; fora do próprio quarto só Móveis e Extras', () => {
  const r = contexto();
  r(`escritorioIrModoConstrucao('piso')`);
  assert.equal(r('escritorioModoConstrucao()'), 'piso');
  assert.equal(r('escritorio.catalogoCategoria'), 'Sala');
  r(`escritorioIrModoConstrucao('parede')`);
  assert.equal(r('escritorioPincel().ferramenta'), 'parede');
  r(`escritorioIrModoConstrucao('luz')`);
  assert.equal(r('escritorioModoConstrucao()'), 'luz');
  r(`escritorio.edicao.novo='cadeira_a';escritorioIrModoConstrucao('moveis')`);
  assert.equal(r('escritorioModoConstrucao()'), 'moveis');
  assert.equal(r('escritorio.edicao.novo'), null, 'trocar de modo larga o que está na mão');
  r(`escritorio.edicao.camada='cafe';escritorioIrModoConstrucao('piso')`);
  assert.equal(r('escritorioModoConstrucao()'), 'moveis', 'piso só no próprio quarto');
  assert.deepEqual(JSON.parse(r('JSON.stringify(escritorioModosDisponiveis().map(m=>m[0]))')), ['moveis', 'extras']);
});

test('a barra de baixo mostra os seis modos, ver piso e o histórico', () => {
  const r = contexto();
  const html = r('escritorioHotbarHtml(escritorio.edicao)');
  assert.equal((html.match(/class="ofc-hot-modo"/g) || []).length, 6);
  assert.match(html, /Ver piso/);
  assert.match(html, /desfazerEditorEscritorio\(\)" disabled/);
  r(`escritorioIrModoConstrucao('piso')`);
  assert.match(r('escritorioSubbarHtml()'), /Quarto todo/);
});

test('peças técnicas e blocos ficam fora da lista padrão de móveis', () => {
  const r = contexto();
  assert.ok(r(`escritorioMovelTecnico({classe:'vybe_bloco_invisivel',categoria:'Blocos e materiais'})`));
  assert.ok(r(`escritorioMovelTecnico({classe:'wf_trg_click',categoria:'Gatilhos'})`));
  assert.ok(!r(`escritorioMovelTecnico({classe:'cadeira_a',categoria:'Cadeiras e sofás'})`));
  assert.ok(r(`escritorioClassesDeConstrucao().has('parede_a')`));
});

test('peça de piso cabe pelo tamanho da ficha, dentro do quarto, no mesmo nível e fora da escada', () => {
  const c = vm.createContext({});
  const fonte = readFileSync('vybe-escritorio-ficha.js', 'utf8');
  vm.runInContext(fonte.slice(fonte.indexOf('function escritorioPisoCabe('), fonte.indexOf('async function escritorioAplicarAreaPiso(')), c);
  vm.runInContext(`function escritorioDimQuarto(){return {w:6,h:6}}function escritorioModeloPlanta(){return {escada:[[5,0]]}}
  function escritorioNivelQuarto(a,x,y){return x===0&&y===5?-1:x>=4&&y>=4?1:0}`, c);
  const cabe = (x, y, w = 2, h = 2) => vm.runInContext(`escritorioPisoCabe({},${x},${y},{x:${w},y:${h}})`, c);
  assert.ok(cabe(0, 0));
  assert.ok(!cabe(5, 2), 'passa da borda');
  assert.ok(!cabe(3, 3), 'pega dois níveis');
  assert.ok(!cabe(4, 0), 'em cima da escada');
  assert.ok(!cabe(0, 4), 'sem piso');
});

test('a contagem da área só aparece no retângulo, na linha e no balde', () => {
  const fonte = readFileSync('vybe-escritorio-ficha.js', 'utf8');
  const avisos = [];
  const c = vm.createContext({ avisos });
  vm.runInContext(`var escritorio={mapa:{pincel(){}}},area='pincel';function escritorioMinhaMesa(){return {ambiente:{x0:0,y0:0}}}function escritorioAviso(t){avisos.push(t)}
  function escritorioPincel(){return {area}}function escritorioAreaDoGesto(){return area==='pincel'?[[1,1]]:area==='vazio'?[]:[[1,1],[2,1],[3,1]]}`, c);
  vm.runInContext(fonte.slice(fonte.indexOf('function escritorioPreviaArea('), fonte.indexOf('// A peça de piso cabe com o canto')), c);
  vm.runInContext(`escritorioPreviaArea({});area='retangulo';escritorioPreviaArea({});area='vazio';escritorioPreviaArea({})`, c);
  assert.deepEqual(avisos, ['', '3 ladrilhos · solte para aplicar', '']);
});

test('a checagem de visibilidade do mapa é guardada por meio segundo (não varre a página a cada quadro)', () => {
  let consultas = 0;
  const c = vm.createContext({ document: { hidden: false, querySelector: () => { consultas++; return null; } } });
  vm.runInContext(readFileSync('vybe-escritorio-mapa.js', 'utf8').replace(/\r\n/g, '\n').match(/function mapaForaDeVista[\s\S]*?\n}\n/)[0], c);
  c.m = { isConnected: true, offsetParent: {}, closest: () => null };
  for (let i = 0; i < 24; i++) assert.equal(vm.runInContext('mapaForaDeVista(m)', c), false);
  assert.equal(consultas, 1);
  c.m.isConnected = false;
  assert.equal(vm.runInContext('mapaForaDeVista(m)', c), true, 'fora do documento responde na hora');
});

test('economia de energia: sem mexer, o sistema entra em ócio; mexer acorda', () => {
  const ouvintes = {}, classes = new Set(), timers = [];
  const c = vm.createContext({
    window: { addEventListener: (t, f) => { ouvintes[t] = f; } },
    document: { hidden: false, addEventListener: () => {}, documentElement: { classList: { contains: (k) => classes.has(k), add: (k) => classes.add(k), remove: (k) => classes.delete(k) } } },
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: () => {}, Date,
  });
  vm.runInContext(readFileSync('vybe-energia.js', 'utf8'), c);
  timers.at(-1)();
  assert.ok(classes.has('vb-ocioso'));
  ouvintes.pointermove();
  assert.ok(!classes.has('vb-ocioso'));
  const css = readFileSync('vybe-styles.css', 'utf8');
  assert.match(css, /html\.vb-ocioso \*[^{]*\{animation-play-state:paused!important\}/);
});

test('revestimento de parede: o perfil guarda só revestimentos grátis em trechos do quarto', async () => {
  const { perfilEscritorio } = await import('../server/escritorio.js');
  const { REVESTIMENTOS_DE_PAREDE } = await import('../server/escritorio-economia.js');
  assert.ok(REVESTIMENTOS_DE_PAREDE.has('country_forestwall'));
  const p = perfilEscritorio({ sala_paredes_texturas: '3:country_forestwall,1:stone_wall,999:stone_wall,2:bling_sofa_mu,x:sb_wall,3:sb_wall' });
  assert.equal(p.sala_paredes_texturas, '1:stone_wall,3:sb_wall', 'só trechos válidos, só revestimentos, o último vale');
  assert.equal(perfilEscritorio({}).sala_paredes_texturas, '');
});
