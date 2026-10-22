import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({console,escritorio:{base:{quartos:JSON.parse(readFileSync('assets/escritorio/habbo/quartos.json'))}}});
vm.runInContext(readFileSync('vybe-escritorio-planta.js','utf8'),c);
const rodar=(js)=>JSON.parse(JSON.stringify(vm.runInContext(js,c)));

// Regressão (20/10/2026): piso do acervo de 4×4 ia inteiro em cada ladrilho
// clicado, um por cima do outro ("pinta vários em vários lugares").
test('piso do acervo encaixa na grade do próprio tamanho, dentro do quarto',()=>{
 assert.deepEqual(rodar('escritorioEncaixePiso(1,1,{x:4,y:4},10,10)'),{x:0,y:0});
 assert.deepEqual(rodar('escritorioEncaixePiso(2,3,{x:4,y:4},10,10)'),{x:0,y:0});
 assert.deepEqual(rodar('escritorioEncaixePiso(5,1,{x:4,y:4},10,10)'),{x:4,y:0});
 // Na borda, a peça não sai do quarto.
 assert.deepEqual(rodar('escritorioEncaixePiso(9,9,{x:4,y:4},10,10)'),{x:6,y:6});
 assert.deepEqual(rodar('escritorioEncaixePiso(3,5,{x:1,y:1},10,10)'),{x:3,y:5});
});

// Regressão (22/10/2026): numa faixa ímpar ou na borda do mezanino a peça de
// 2 × 2 ficava metade em cima e metade embaixo (atravessando o guarda-corpo).
test('piso do acervo fica inteiro num andar só onde a grade não fecha',()=>{
 // Mezanino nas 3 primeiras linhas (altura 2), chão no resto, quarto 8 × 8.
 c.nivelTeste=(x,y)=>x<0||y<0||x>=8||y>=8?-1:y<3?2:0;
 // Na linha 2 (última do mezanino) a grade mandaria para y=2 (2 e 3: atravessa).
 assert.deepEqual(rodar('escritorioEncaixePiso(4,2,{x:2,y:2},8,8,nivelTeste)'),{x:4,y:1});
 // Na linha 3 (primeira do chão), também não atravessa: desce para y=3.
 assert.deepEqual(rodar('escritorioEncaixePiso(4,3,{x:2,y:2},8,8,nivelTeste)'),{x:4,y:3});
 // Onde a grade fecha, nada muda.
 assert.deepEqual(rodar('escritorioEncaixePiso(5,5,{x:2,y:2},8,8,nivelTeste)'),{x:4,y:4});
});

// Regressão (20/10/2026): clicar na própria parede não pintava; era preciso
// clicar no piso encostado nela.
test('clique na parede do fundo e da esquerda acha o trecho certo',()=>{
 // Fundo: ponto 2 blocos acima da coluna 3 (na projeção, x e y caem juntos).
 assert.deepEqual(rodar('escritorioTrechoDaParede(3.5-2,-2,10,10)'),[0,3]);
 // Esquerda: ponto 1,5 bloco acima da linha 6.
 assert.deepEqual(rodar('escritorioTrechoDaParede(-1.5,6.5-1.5,10,10)'),[1,6]);
 // Fora do quarto (além da última coluna) não pinta nada.
 assert.equal(rodar('escritorioTrechoDaParede(12-1,-1,10,10)'),null);
});
