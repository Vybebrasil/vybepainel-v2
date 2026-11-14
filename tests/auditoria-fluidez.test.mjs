// Fluidez (auditoria de 14/11/2026): o 3D parado não mexe no DOM a cada quadro e as telas do Comercial, da Carteira e
// da visão geral do setor não forçam estilo e layout da página inteira dentro do clique que as abre. Leitura da fonte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('prédio: rótulos só recebem hidden quando o valor muda', () => {
  const s = ler('mundo/predio.mjs');
  assert.doesNotMatch(s, /r\.el\.hidden = !r\.centro\.g\.visible;/);
  assert.match(s, /if \(r\.el\.hidden !== h\) r\.el\.hidden = h;/);
  assert.match(s, /if \(!a\.rotulo\.el\.hidden\) a\.rotulo\.el\.hidden = true;/);
  assert.match(s, /if \(ag\.r\.el\.hidden === ver\) ag\.r\.el\.hidden = !ver;/);
});

test('motor: o "+N" dos pinos só é gravado quando o número muda', () => {
  const s = ler('mundo/motor.mjs');
  assert.match(s, /const mudou = mais !== r\.el\.dataset\.mais;/);
  assert.match(s, /if \(r\.junto\) \{ if \(mudou\) \{ r\.el\.dataset\.mais = mais;/);
  assert.match(s, /else if \(mudou\) \{ delete r\.el\.dataset\.mais;/);
});

test('comercial: abrir pinta uma vez e a rolagem só é lida/gravada quando há o que manter', () => {
  const s = ler('vybe-mundo-comercial.js');
  assert.doesNotMatch(s, /pintar\(\); carregar\(\);\s*\n\s*\}\s*\n\s*function fechar\(\)/);
  assert.match(s, /const corpo = estavaAberta \? el\.querySelector\('\.vc-corpo'\) : null/);
  assert.match(s, /const nc = rolagem \? el\.querySelector\('\.vc-corpo'\) : null; if \(nc\) nc\.scrollTop = rolagem;/);
});

test('carteira e visão do setor: sem scrollTop = 0 síncrono ao abrir', () => {
  assert.match(ler('vybe-mundo-carteira.js'), /if \(novoCorpo && rolagem\) novoCorpo\.scrollTop = rolagem;/);
  const setor = ler('vybe-mundo-setor.js');
  assert.doesNotMatch(setor, /el\.hidden = false; el\.scrollTop = 0;/);
  assert.match(setor, /requestAnimationFrame\(\(\) => \{ if \(!el\.hidden\) el\.scrollTop = 0; \}\);/);
});
