import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('cartões abrem a ficha; inventário mostra o que é seu, loja mostra preço e estoque',()=>{
 const c=vm.createContext({window:{},document:{},safeText:String,localStorage:{getItem:()=>null}});
 vm.runInContext(`var escritorio={base:{eu:'1',quartos:{essenciais:['exe_table']},economia:{disponivel:true,saldo:700,inventario:[{classe:'raro_teste',quantidade:2}],loja:{raridades:[{chave:'raro',nome:'Raro',preco:120,vitrine:false}],itens:[{classe:'raro_teste',raridade:'raro',preco:120,restante:1}],vitrine:[]}}},edicao:{camada:'sala-0',itens:[['raro_teste',1,1,2]]},abaQuarto:'meus'};function escritorioMinhaMesa(){return {ambiente:{id:'sala-0'}}}function escritorioImagemDe(){return null}`,c);
 vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 vm.runInContext(readFileSync('vybe-escritorio-editor.js','utf8'),c);
 let card=vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c);
 assert.match(card,/2 seus/);assert.match(card,/abrirPreviaMovelEscritorio\('raro_teste'\)/,'o clique abre a ficha, colocar é nela');
 // Inventário da janela: o cartão diz quantos são seus e onde estão.
 assert.match(vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste'},{inventario:{total:2,noQuarto:1,guardados:1}})`,c),/2 seus · 1 no quarto/);
 assert.match(vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste'},{inventario:{total:2,noQuarto:0,guardados:2}})`,c),/2 guardados/);
 vm.runInContext(`escritorio.abaQuarto='loja'`,c);
 card=vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c);
 assert.match(card,/Raro · 120 moedas/,'a faixa vem escrita, não só na cor');assert.match(card,/abrirPreviaMovelEscritorio\('raro_teste'\)/,'na loja o clique abre a prévia; comprar é nela');assert.match(card,/ofc-movel compacto r-raro/,'borda na cor da faixa');assert.match(card,/resta 1/);
 vm.runInContext(`escritorio.base.economia.loja.mapa.get('raro_teste').restante=0`,c);
 assert.match(vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c),/Esgotado/);
});

test('curadoria tem arte local completa, dimensões válidas e não concede móveis nos modelos gratuitos',()=>{
 const catalogo=JSON.parse(readFileSync('assets/escritorio/habbo/catalogo.json'));
 const quartos=JSON.parse(readFileSync('assets/escritorio/habbo/quartos.json'));
 assert.equal(new Set(catalogo.map(m=>m.classe)).size,catalogo.length);
 const novos=catalogo.filter(m=>m.curadoria==='construcao-2026-10');assert.equal(novos.length,53);
 for(const m of novos) {
  const d=JSON.parse(readFileSync('assets/escritorio/habbo/'+m.classe+'.json'));
  const png=readFileSync('assets/escritorio/habbo/'+m.classe+'.png');assert.equal(png.readUInt32BE(0),0x89504e47);
  const v=d.visualizations.find(v=>v.size===64);assert.ok(v && d.logic.model.dimensions.x<=6 && d.logic.model.dimensions.y<=6,m.classe);
  for(const dir of Object.keys(v.directions)) assert.ok(Array.from({length:v.layerCount},(_,i)=>`${d.name}_64_${String.fromCharCode(97+i)}_${dir}_0`).some(key=>{const a=d.assets[key];return a && d.spritesheet.frames[`${d.name}_${a.source || key}`];}),m.classe+'/'+dir);
 }
 for(const m of quartos.modelos) for(const [c] of m.itens) assert.ok(quartos.essenciais.includes(c),m.id+'/'+c);
});

test('categorias em árvore e caixa agrupada, sem as faixas de raridade misturadas',()=>{
 const c=vm.createContext({window:{},document:{},safeText:String,localStorage:{getItem:()=>null}});
 vm.runInContext(`var escritorio={base:{eu:'1',quartos:{essenciais:[]},economia:{disponivel:true,saldo:0,inventario:[],loja:{raridades:[{chave:'raro',nome:'Raro',preco:120}],itens:[{classe:'cad_raro',raridade:'raro',preco:120,restante:null}],vitrine:[]}}},edicao:null};function escritorioMinhaMesa(){return null}function escritorioImagemDe(){return null}`,c);
 vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 vm.runInContext(readFileSync('vybe-escritorio-editor.js','utf8'),c);
 vm.runInContext(`escritorioCatalogo=[{classe:'cad_raro',nome:'Shelf',categoria:'Estantes'},{classe:'mesa_x',nome:'Table',categoria:'Mesas'}]`,c);
 const arvore=vm.runInContext(`escritorioArvoreCategoriasHtml('Mesas',"ir('%')")`,c);
 assert.match(arvore,/<details class="ofc-catj-secao" open><summary>Móveis<\/summary>/,'a seção da categoria escolhida fica aberta');
 assert.match(arvore,/aria-pressed="true" onclick="ir\('Mesas'\)"><span>Mesas<\/span><small>1<\/small>/,'a categoria aparece com a contagem');
 assert.doesNotMatch(arvore,/Incomuns|Raros|Épicos|Lendários/,'raridade é filtro, não categoria');
 const caixa=vm.runInContext(`escritorioSelectCategoriasHtml('Mesas',"ir('%')")`,c);
 assert.match(caixa,/<optgroup label="Móveis">/);assert.match(caixa,/value="Mesas" selected/);assert.match(caixa,/onchange="ir\(this.value\)"/);
 const moveis=vm.runInContext(`escritorioListaCatalogo('secao:Móveis').map(m=>m.classe)`,c);
 assert.ok(moveis.includes('cad_raro') && moveis.includes('mesa_x'),'a seção junta as categorias dela');
 assert.equal(new Set(moveis).size,moveis.length,'sem repetir o móvel que está em duas categorias');
 assert.match(vm.runInContext(`escritorioSelectRaridadeHtml('raro','x()')`,c),/value="raro" selected>Raro/);
});
