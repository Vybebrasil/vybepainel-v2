import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const c=vm.createContext({console,window:{},document:{},localStorage:{getItem:()=>null},safeText:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
vm.runInContext(fs.readFileSync('vybe-config.js','utf8'),c);
const core=fs.readFileSync('vybe-core.js','utf8');
vm.runInContext(core.slice(0,core.indexOf('// QUANDO FOI')),c);
test('carteiras seguem a divisão aprovada inclusive aliases e Serra Grande',()=>{
 for(const n of ['VOA','Voa Sportswear','Alpha1','Mangaba AI','Restaurante Brussolo','Academia Lions Top','ConectaSim','Copirecê','DiaCenter','DiaLab','Serra Grande Bebidas']) assert.equal(c.carteiraDoCliente(n),'vinicius',n);
 for(const n of ['Gonzalez','Antonov','Hellen Rocha','Experimente','Hebravet','Escola Viva']) assert.equal(c.carteiraDoCliente(n),'ewerton',n);
 assert.equal(c.carteiraDoCliente('Conta nova'),'');
 assert.equal(c.carteiraDoCliente('Antonov Site Novo'),'');
});
test('cada cliente recebe sua cor e descrição sem alterar responsáveis da atividade',()=>{
 const item={clientes:['VOA','Antonov'],responsavel:'Deivid'};
 const tags=c.clientesDoItem(item).map(n=>c.tagClienteHtml(n)).join('');
 assert.match(tags,/data-carteira="vinicius"/);assert.match(tags,/data-carteira="ewerton"/);
 assert.match(tags,/Responsável geral: Vinícius · Site: Ewerton/);
 assert.equal(item.responsavel,'Deivid');
 assert.match(c.tagClienteHtml('<teste>'),/&lt;teste>/);
 assert.doesNotMatch(c.tagClienteHtml('VOA',{dentroDeBotao:true}),/tabindex/);
});
