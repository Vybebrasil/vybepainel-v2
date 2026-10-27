// A fileira do dominó em cobra (Paulo, 27/10/2026: no jeito dos dominós
// online): as peças correm deitadas, viram na borda com peças em pé e voltam.
// Nenhuma peça pode cair em cima de outra nem sair da mesa, com ou sem
// carroça na curva, e cada peça encosta na anterior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../vybe-escritorio-domino.js', import.meta.url), 'utf8');
const dominoCobra = new Function(fonte.slice(fonte.indexOf('const DOMINO_LARGURA'), fonte.indexOf('function dominoLinhaHtml')) + '; return dominoCobra;')();
const LARGURA = 26;

// Corrente válida: cada peça começa com o número em que a anterior termina.
function corrente(pares) {
 const linha = [];
 let ponta = pares[0][0];
 for (const [a, b] of pares) { const p = a === ponta ? [a, b] : [b, a]; linha.push(p); ponta = p[1]; }
 return linha;
}
const encosta = (p, q) => {
 const tocaX = Math.abs(p.x + p.w - q.x) < 0.01 || Math.abs(q.x + q.w - p.x) < 0.01, cruzaY = p.y < q.y + q.h && q.y < p.y + p.h;
 const tocaY = Math.abs(p.y + p.h - q.y) < 0.01 || Math.abs(q.y + q.h - p.y) < 0.01, cruzaX = p.x < q.x + q.w && q.x < p.x + p.w;
 return (tocaX && cruzaY) || (tocaY && cruzaX);
};

test('dominó: a cobra não sobrepõe, não sai da mesa e cada peça encosta na anterior', () => {
 const casos = [
  corrente([[6, 1], [1, 4], [4, 6], [6, 6], [6, 2], [2, 3], [3, 3], [3, 5], [5, 4], [4, 2], [2, 2], [2, 0], [0, 5], [5, 5], [5, 1], [1, 1], [1, 0], [0, 0], [0, 4], [4, 4], [4, 3], [3, 1], [1, 5], [5, 6], [6, 0], [0, 2], [2, 4], [4, 5], [5, 2], [2, 1], [1, 3], [3, 0], [0, 1]]),
  // Sem carroça nenhuma: a curva é de duas peças em pé.
  corrente([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 1], [1, 3], [3, 5], [5, 0], [0, 2], [2, 4], [4, 6], [6, 1], [1, 4], [4, 0], [0, 3], [3, 6], [6, 2], [2, 5]]),
 ];
 for (const linha of casos) {
  const pos = dominoCobra(linha);
  assert.equal(pos.length, linha.length);
  for (let a = 0; a < pos.length; a++) {
   const p = pos[a];
   assert.ok(p.x >= 0 && p.x + p.w <= LARGURA, `peça ${a} dentro da mesa`);
   for (let b = a + 1; b < pos.length; b++) {
    const q = pos[b];
    assert.ok(!(p.x < q.x + q.w - 0.01 && q.x < p.x + p.w - 0.01 && p.y < q.y + q.h - 0.01 && q.y < p.y + p.h - 0.01), `peças ${a} e ${b} não se sobrepõem`);
   }
   if (a) assert.ok(encosta(pos[a - 1], p), `peça ${a} encosta na anterior`);
  }
  assert.ok(Math.max(...pos.map((p) => p.y)) > 2, 'a fileira dobrou para baixo');
 }
});
