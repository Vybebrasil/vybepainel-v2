import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const fonte=readFileSync('vybe-escritorio-editor.js','utf8');
const trecho=fonte.slice(fonte.indexOf('function escritorioCatalogoHtml()'),fonte.indexOf('\nfunction ',fonte.indexOf('function escritorioCatalogoHtml()')+10));
function montar(categoria,camada='sala-0'){
 const c=vm.createContext({escritorioCatalogo:[],escritorio:{catalogoCategoria:categoria,abaQuarto:categoria?'decorar':'meus',edicao:{camada},base:{economia:{saldo:123}}},
 escritorioMinhaMesa:()=>({ambiente:{id:'sala-0'}}),escritorioIcone:()=>'<svg></svg>',escritorioFichaIcone:()=>'<svg></svg>',safeText:String,
 escritorioImagensDaCamada:()=>[],escritorioEstiloSalaHtml:()=>'<div>ESTILO</div>',escritorioImagensHtml:()=>'<div>IMAGENS</div>',escritorioConjuntosHtml:()=>'<div>CONJUNTOS</div>',escritorioModelosHtml:()=>'',escritorioMaoHtml:()=>'',
 escritorioGrupoCatalogo:()=>'*',escritorioSelectCategoriasHtml:()=>'',escritorioCamadaComum:()=>true});
 vm.runInContext(trecho,c);return c.escritorioCatalogoHtml();
}
test('oficina mantém acabamento e estrutura sem os atalhos redundantes de extras',()=>{
 for(const categoria of ['Sala','Planta']){
  const html=montar(categoria);
  assert.equal((html.match(/role="tab"/g)||[]).length,4);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
  assert.equal((html.match(/tabindex="0"/g)||[]).length,1);
  assert.ok(html.includes('ESTILO'));
  assert.ok(!html.includes('ofc-cats-topo'));
 }
 assert.ok(montar('Imagens').includes('ofc-cats-topo'));
 assert.ok(montar('Conjuntos').includes('CONJUNTOS'));
});
test('saldo e compra pessoal não são oferecidos no acervo compartilhado',()=>{
 const pessoal=montar('');assert.ok(pessoal.includes('ofc-oficina-carteira'));assert.ok(pessoal.includes('123'));assert.ok(pessoal.includes('office-catalogo-lista'));
 const comum=montar('','cafe');assert.ok(!comum.includes('ofc-oficina-carteira'));assert.ok(comum.includes('decoração compartilhada'));
});
