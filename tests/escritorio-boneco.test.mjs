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
