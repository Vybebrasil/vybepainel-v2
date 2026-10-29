// Força como a mão de quem taca (Paulo, 29/10/2026: "17% quase não anda...
// de 0,1% tocar devagarzinho até 100% a pancada") e o efeito que não morre.
import test from 'node:test';
import assert from 'node:assert/strict';
import {simular,RAIO,METROS_POR_UNIDADE as M,fatorEfeito} from '../server/escritorio-sinuca.js';
const anda=(f)=>{const b=Array(16).fill(null);b[0]=[20,25];const r=simular(b,0,f,0,RAIO,0,{pano:'bar'});let d=0;
 for(let i=1;i<r.quadros.length;i++)d+=Math.hypot(r.quadros[i][0]-r.quadros[i-1][0],r.quadros[i][1]-r.quadros[i-1][1])/10;return d*M;};
test('força humana: toque, meio metro, a mesa inteira, várias tabelas',()=>{
 assert.ok(anda(0.001)<0.01,'0,1% só encosta');
 const f10=anda(0.1),f17=anda(0.17),f30=anda(0.3),f50=anda(0.5),f100=anda(1);
 assert.ok(f10>0.1&&f10<0.35,`10% anda ${f10.toFixed(2)} m`);
 assert.ok(f17>0.35&&f17<0.8,`17% anda ${f17.toFixed(2)} m`);
 assert.ok(f30>1.2&&f30<2.4,`30% anda ${f30.toFixed(2)} m`);
 assert.ok(f50>3&&f50<f100,`50% anda ${f50.toFixed(2)} m`);
});
test('efeito: bater na beirada tira no máximo 13% da velocidade',()=>{
 assert.equal(fatorEfeito(0,0),1);
 assert.ok(Math.abs(fatorEfeito(1,0)-0.87)<0.01);assert.equal(fatorEfeito(1,0),fatorEfeito(0,1));
});
