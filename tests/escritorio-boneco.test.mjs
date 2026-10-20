import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// O imager do Habbo só troca o passo com "frame"; com "frame_num" devolvia
// sempre o mesmo quadro e o boneco deslizava (Paulo, 19/10/2026).
test('caminhada pede os 4 quadros do passo com o parâmetro que o Habbo entende',()=>{
 const c=vm.createContext({window:{},document:{},URLSearchParams});
 vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 const urls=[0,1,2,3].map(i=>new URL(vm.runInContext(`mapaAvatarUrl('hd-180-1',2,'wlk','',${i})`,c)));
 assert.deepEqual(urls.map(u=>u.searchParams.get('frame')),['0','1','2','3']);
 assert.ok(urls.every(u=>!u.searchParams.has('frame_num')));
 assert.equal(new URL(vm.runInContext(`mapaAvatarUrl('hd-180-1',2,'std','',0)`,c)).searchParams.has('frame'),false,'parado não pede quadro');
});

// A chave do quadro de um móvel animado é o desenho que aparece (id da arte),
// não a posição na sequência: o telão do Centro de Operação repete os mesmos
// quadros numa sequência de 212 passos, e com a posição o cache de desenho
// nunca acertava e a sala redesenhava a arte do zero a cada quadro (Paulo,
// 19/10/2026: "a sala do centro de operações tá travando").
test('quadros iguais da arte dão a mesma chave de desenho',()=>{
 const c=vm.createContext({window:{},document:{},URLSearchParams});
 vm.runInContext(readFileSync('vybe-escritorio-mapa.js','utf8'),c);
 const dados=JSON.parse(readFileSync('assets/escritorio/habbo/army15_largescreen.json','utf8'));
 c.dados=dados;
 const chaves=new Set(Array.from({length:424},(_,q)=>vm.runInContext(`mapaChaveQuadro(dados,0,${q},0)`,c)));
 // 96 é o tamanho do cache de desenho de cada peça; pela posição eram 226.
 assert.ok(chaves.size<=96,`${chaves.size} chaves num ciclo do telão não cabem no cache`);
 assert.equal(vm.runInContext('mapaChaveQuadro(dados,0,0,0)',c),vm.runInContext('mapaChaveQuadro(dados,0,0,0)',c));
});
