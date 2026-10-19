import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({});
vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
test('cursor visita os quatro ladrilhos de um piso 2×2 sem saltar à origem da peça',()=>{
 for(const plano of [true,false]) for(let x=4;x<6;x++) for(let y=8;y<10;y++) {
  c.t={x:x+.4,y:y+.6};c.item={classe:'val12_marble1',x:4,y:8,plano};
  assert.equal(JSON.stringify(vm.runInContext('mapaAlvoCursor(t,item)',c)),JSON.stringify({x,y}));
 }
});
test('chão sem móvel segue mouse e alvo de móvel interativo permanece na origem',()=>{
 assert.equal(JSON.stringify(vm.runInContext('mapaAlvoCursor({x:3.2,y:5.8},null)',c)),JSON.stringify({x:3,y:5}));
 assert.equal(JSON.stringify(vm.runInContext("mapaAlvoCursor({x:3.2,y:5.8},{classe:'cadeira',x:2,y:4,plano:false})",c)),JSON.stringify({x:2,y:4}));
});
