import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function contexto() {
 const avisos=[], eventos={}, classes=[];
 const c=vm.createContext({avisos,eventos,classes,console,window:{addEventListener(k,f){eventos[k]=f;}},document:{addEventListener(k,f){eventos[k]=f;},getElementById(){return {classList:{toggle:(...a)=>classes.push(a)}}}},safeText:String,localStorage:{getItem:()=>null},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},requestAnimationFrame(){},cancelAnimationFrame(){}});
 vm.runInContext(`var escritorio={base:{eu:'1',quartos:{essenciais:['gratis']},economia:{inventario:[{classe:'limitado',quantidade:1}]}},edicao:{camada:'sala-0',sel:0,novo:null,itens:[['limitado',1,1,2]]},mapa:{medidas:async()=>({x:1,y:1,z:1,dir:2}),moveisEm:()=>[],previa(){},destacar(){},grade(a){this.ultimaGrade=a;}}};
 var ESCRITORIO_PLANTA={W:8,H:8,ambientes:[{id:'sala-0',x0:0,y0:0,x1:8,y1:8}]},MAPA_ASSENTOS=new Set();
 function escritorioPerfilDecoracao(){return escritorio.edicao?.decoracao || {}}function escritorioImagemDe(){return null}function escritorioAviso(x){avisos.push(x)}function escritorioAmbienteDoQuarto(){return null}function escritorioModeloPlanta(){return null}function escritorioNivelQuarto(){return 0}
 function escritorioPosicao(){return {x:-9,y:-9}}function escritorioOcupado(){return false}function escritorioPortaQuarto(){return null}function mapaFisica(){return {poe:true}}function mapaTopoMovel(m){return (m.altura||0)+1}`,c);
 vm.runInContext(readFileSync('vybe-escritorio-editor.js','utf8'),c);
 vm.runInContext(`renderBarraEditorEscritorio=()=>{};escritorioEditorMudou=()=>{};escritorioLembrarMovel=()=>{};escritorioEhParede=()=>false`,c);
 return {c,avisos,eventos,r:s=>vm.runInContext(s,c)};
}
test('duplicar e colar não criam unidades além do inventário; essenciais continuam livres',async()=>{
 const {r,avisos}=contexto();
 await r('duplicarSelecionadoEscritorio()');assert.equal(r('escritorio.edicao.itens.length'),1);assert.match(avisos.at(-1),/Faltam .* VybeCoins/);
 r(`escritorio.edicao.colar=[['limitado',0,0,2,0,0]]`);await r('soltarColarEscritorio(3,3)');assert.equal(r('escritorio.edicao.itens.length'),1);
 r(`escritorio.edicao.colar=[['gratis',0,0,2,0,0],['gratis',1,0,2,0,0]]`);await r('soltarColarEscritorio(3,3)');assert.equal(r('escritorio.edicao.itens.length'),3);
});
test('ajuste fino é validado na posição final, inclusive na borda do quarto',async()=>{
 const {r}=contexto();
 r(`escritorio.edicao.novo='gratis';escritorio.edicao.sel=null;escritorio.edicao.novoAjuste={dx:.75,dy:0}`);
 await r('cliqueEditorEscritorio(7.5,3.5)');assert.equal(r('escritorio.edicao.itens.length'),1);
 await r('cliqueEditorEscritorio(5.5,3.5)');assert.equal(r('escritorio.edicao.itens.at(-1)[1]'),5.75);
});
test('câmera não seleciona nem move móveis; espaço solto e blur devolvem a seleção',async()=>{
 const {r,eventos}=contexto();
 r(`ferramentaEditorEscritorio('camera')`);assert.equal(r('pegarNoEditorEscritorio(1,1,1,1)'),false);await r('cliqueEditorEscritorio(4,4)');assert.equal(r('escritorio.edicao.itens[0][1]'),1);
 r(`ferramentaEditorEscritorio('selecionar');teclaEditorEscritorio({key:' ',target:{closest:()=>false}})`);assert.equal(r('escritorioCameraEditor()'),true);
 eventos.keyup({key:' '});assert.equal(r('escritorioCameraEditor()'),false);
 r('escritorio.espacoEditor=true');eventos.blur();assert.equal(r('escritorioCameraEditor()'),false);
});
test('grade alterna sem mudar decoração e escada não aceita colocação',async()=>{
 const {r}=contexto();r('gradeEditorEscritorio(true)');assert.equal(r('escritorio.mapa.ultimaGrade'),null);r('gradeEditorEscritorio(true)');assert.equal(r('escritorio.mapa.ultimaGrade.x1'),8);
 r(`escritorioAmbienteDoQuarto=()=>({});escritorioModeloPlanta=()=>({escada:[[3,3]]})`);
 assert.equal(await r(`escritorioCabe('gratis',3,3,2)`),false);assert.equal(await r(`escritorioCabe('gratis',4,3,2)`),true);
});
test('cancelar colocação enquanto o modelo carrega não insere móvel atrasado',async()=>{
 const {c,r}=contexto();let liberar;c.pendente=new Promise(ok=>liberar=ok);r(`escritorio.mapa.medidas=()=>pendente;escritorio.edicao.novo='gratis';escritorio.edicao.sel=null`);
 const acao=r('cliqueEditorEscritorio(3,3)');r('escritorio.edicao.novo=null');liberar({x:1,y:1,z:1,dir:2});await acao;assert.equal(r('escritorio.edicao.itens.length'),1);
});
test('interrupção do arrasto limpa a prévia e não muda a posição dos móveis',()=>{
 const {r}=contexto();r(`escritorio.edicao.arrasto={i:0};escritorio.edicao.arrastoGrupo={dx:3,dy:3};cancelarArrastoEditorEscritorio()`);
 assert.equal(r('escritorio.edicao.arrasto'),null);assert.equal(r('escritorio.edicao.arrastoGrupo'),null);assert.equal(r('escritorio.edicao.itens[0][1]'),1);
});
// Como no Habbo: pousa onde se clicou, no topo do que está embaixo; a prévia
// mostra a mesma posição e altura da colocação.
test('prévia sobre a mesa usa a mesma posição e altura da colocação',async()=>{
 const {c,r}=contexto();c.previa=[];r(`escritorio.edicao.novo='gratis';escritorio.edicao.sel=null;escritorio.mapa.previa=(...p)=>previa.push(p);escritorio.mapa.moveisEm=(x,y)=>x===3&&y===2?[{classe:'mesa',altura:0.25,dim:{x:1,y:1},x:3,y:2}]:[]`);
 await r('previaEditorEscritorio(3,2)');assert.deepEqual(Array.from(c.previa.at(-1)),['gratis',3,2,2,true,1.25]);
 await r('cliqueEditorEscritorio(3,2)');assert.deepEqual(Array.from(r('escritorio.edicao.itens.at(-1)')),['gratis',3,2,2,0,1.25]);
});
test('não empilha em cima do que não aceita peça nem põe móvel sólido em cima de alguém',async()=>{
 const {r,avisos}=contexto();r(`escritorio.edicao.novo='gratis';escritorio.edicao.sel=null;mapaFisica=(k)=>({poe:k!=='cadeira'});escritorio.mapa.moveisEm=(x,y)=>x===3&&y===2?[{classe:'cadeira',altura:0,dim:{x:1,y:1},x:3,y:2}]:[]`);
 await r('cliqueEditorEscritorio(3,2)');assert.equal(r('escritorio.edicao.itens.length'),1);assert.match(avisos.at(-1),/não aceita nada em cima/);
 r(`escritorio.edicao.novo='gratis';escritorioOcupado=(x,y)=>x===5&&y===5`);
 await r('cliqueEditorEscritorio(5,5)');assert.equal(r('escritorio.edicao.itens.length'),1);assert.match(avisos.at(-1),/Tem alguém/);
});

test('escolher móvel volta da câmera para a colocação',()=>{
 const {r}=contexto();r(`escritorio.edicao.ferramenta='camera';escolherMovelEscritorio('gratis')`);
 assert.equal(r('escritorioCameraEditor()'),false);assert.equal(r('escritorio.edicao.novo'),'gratis');
});

test('conferência atrasada não aplica resultado a uma edição alterada',async()=>{
 const {c,r,avisos}=contexto();let liberar;c.resposta=new Promise(ok=>liberar=ok);
 r(`escritorioApi=()=>resposta;escritorio.edicao.celdas=undefined;`);
 const chamada=r('conferirConstrucaoEditorEscritorio()');
 r(`escritorio.edicao.itens.push(['gratis',2,2,2])`);
 liberar({problemas:[],avisos:[]});
 assert.equal(await chamada,null);assert.equal(r('escritorio.edicao.conferencia'),undefined);
 assert.match(avisos.at(-1),/mudou durante/);
});
test('falha da API de conferência permanece erro e libera nova tentativa',async()=>{
 const {r,avisos}=contexto();r(`escritorioApi=async()=>{throw new Error('Indisponível')}`);
 assert.equal(await r('conferirConstrucaoEditorEscritorio()'),null);
 assert.equal(r('escritorio.edicao.conferindo'),false);assert.match(avisos.at(-1),/Não foi possível conferir: Indisponível/);
});

test('clique no piso não move a seleção por acidente; mover pelo clique é explícito',async()=>{
 const {r}=contexto();
 await r('cliqueEditorEscritorio(4,4)');assert.equal(r('escritorio.edicao.itens[0][1]'),1);assert.equal(r('escritorio.edicao.sel'),null);
 r('escritorio.edicao.sel=0;escritorio.edicao.moverClique=true');await r('cliqueEditorEscritorio(4,4)');assert.equal(r('escritorio.edicao.itens[0][1]'),4);
});
test('rascunho é isolado por pessoa/sala e não guarda a carteira',()=>{
 const {c,r}=contexto();let salvo;c.localStorage={setItem(k,v){salvo={k,v};},getItem(){return null;}};
 r(`escritorio.edicao.decoracao={sala_piso:'madeira'};escritorioPerfilDecoracao=()=>escritorio.edicao.decoracao;escritorio.edicao.versao=3;escritorio.edicao.mudou=true;escritorioGuardarRascunho()`);
 assert.equal(salvo.k,'vybe-construcao:1:sala-0');assert.ok(!salvo.v.includes('inventario'));assert.equal(JSON.parse(salvo.v).versao,3);
});

test('acabamento no editor não grava perfil; desfazer e cancelar preservam o perfil salvo',async()=>{
 const {c,r}=contexto();c.structuredClone=structuredClone;c.confirm=()=>true;
 const fonte=readFileSync('vybe-escritorio.js','utf8');
 vm.runInContext(fonte.slice(fonte.indexOf('function escritorioRaizQuarto('),fonte.indexOf('function escritorioAmbienteDoQuarto(')),c);
 vm.runInContext(readFileSync('vybe-escritorio-ficha.js','utf8'),c);
 r(`escritorio.perfil={sala_piso:'madeira',sala_luz:'',sala_pisos:'',sala_paredes:''};escritorio.quarto='sala-0';escritorio.base.salas=[{id:'sala-0',pessoa_id:'1'}];escritorio.base.equipe=[];escritorio.edicao.decoracao=structuredClone(escritorio.perfil);escritorio.edicao.passos=[escritorioFotoEdicao(escritorio.edicao)];escritorio.edicao.inicial=escritorio.edicao.passos[0];escritorio.edicao.futuro=[];
 escritorioAplicarSalas=()=>{};escritorioRedesenharMapa=()=>{};renderEscritorio=()=>{};escritorioApi=()=>{throw Error('Não deve gravar o perfil durante a edição')};
 escritorioEditorMudou=function(semPasso){const e=escritorio.edicao;if(!semPasso)e.passos.push(escritorioFotoEdicao(e));e.mudou=escritorioFotoEdicao(e)!==e.inicial;};`);
 await r(`estiloSalaEscritorio('sala_piso','clara')`);
 assert.equal(r('escritorio.perfil.sala_piso'),'madeira');assert.equal(r('escritorioPerfilDecoracao().sala_piso'),'clara');
 r('desfazerEditorEscritorio()');assert.equal(r('escritorioPerfilDecoracao().sala_piso'),'madeira');
 await r(`estiloSalaEscritorio('sala_luz','quente')`);r(`escritorio.mapa.definirMoveis=()=>{};escritorioMoveisAtuais=()=>[];sairEditorEscritorio()`);
 assert.equal(r('escritorio.perfil.sala_luz'),'');assert.equal(r('escritorio.edicao'),null);
});
