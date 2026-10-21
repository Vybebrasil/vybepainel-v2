import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import operacao from '../scripts/cenas/operacao.mjs';

// Centro de Operação em duas alas pela carteira (Paulo, 20/10/2026).
test('Centro de Operação tem a ala do Vinícius e a do Ewerton, sem erro do motor',()=>{
 const r=operacao();
 assert.deepEqual(r.erros,[]);
 const alas={};
 for(const f of r.figurantes.filter(f=>f.posto!==undefined)) alas[f.ala]=(alas[f.ala]||0)+1;
 assert.deepEqual(alas,{vinicius:10,ewerton:6});
 const pisos=new Set(r.moveis.map(m=>m[0]));
 assert.ok(pisos.has('ducket_c25_warmfloor')&&pisos.has('darkmodern_c20_floor'));
});

// Regressão (20/10/2026): o desenho da peça de parede vem do cache e era o
// mesmo canvas para todas as peças iguais; só a última ficava na parede (o
// Café mostrava 4 de 14 papéis de parede).
test('cada peça de parede leva a própria cópia do desenho',()=>{
 const feitos=[];
 const document={createElement:()=>{const c={width:0,height:0,desenhou:null,getContext:()=>({drawImage:(o)=>{c.desenhou=o;}})};feitos.push(c);return c;}};
 const c=vm.createContext({document});
 vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 c.orig={width:64,height:96};
 const a=vm.runInContext('mapaCopiarCanvas(orig)',c), b=vm.runInContext('mapaCopiarCanvas(orig)',c);
 assert.notEqual(a,b); assert.notEqual(a,c.orig);
 assert.equal(a.width,64); assert.equal(a.height,96); assert.equal(a.desenhou,c.orig);
});
