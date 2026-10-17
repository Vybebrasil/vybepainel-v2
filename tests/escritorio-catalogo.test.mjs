import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('abas preservam preço e estoque da loja; inventário só coloca, vitrine compra',()=>{
 const c=vm.createContext({window:{},document:{},safeText:String,localStorage:{getItem:()=>null}});
 vm.runInContext(`var escritorio={base:{eu:'1',quartos:{essenciais:['exe_table']},economia:{disponivel:true,saldo:700,inventario:[{classe:'raro_teste',quantidade:2}],loja:{raridades:[{chave:'raro',nome:'Raro',preco:120,vitrine:false}],itens:[{classe:'raro_teste',raridade:'raro',preco:120,restante:1}],vitrine:[]}}},edicao:{camada:'sala-0',itens:[['raro_teste',1,1,2]]},abaQuarto:'meus'};function escritorioMinhaMesa(){return {ambiente:{id:'sala-0'}}}function escritorioImagemDe(){return null}`,c);
 vm.runInContext(readFileSync('vybe-escritorio-editor.js','utf8'),c);
 let card=vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c);
 assert.match(card,/1 de 2 para colocar/);assert.match(card,/escritorioAcaoMovel\('raro_teste', false\)/);
 vm.runInContext(`escritorio.abaQuarto='loja'`,c);
 card=vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c);
 assert.match(card,/Comprar por 120/);assert.match(card,/escritorioAcaoMovel\('raro_teste', true\)/);assert.match(card,/resta 1/);
 vm.runInContext(`escritorio.base.economia.loja.mapa.get('raro_teste').restante=0`,c);
 assert.match(vm.runInContext(`escritorioCartaoMovel({classe:'raro_teste',nome:'Raro teste',giros:4})`,c),/Esgotado/);
});
