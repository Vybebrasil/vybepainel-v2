import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Motor do Escritório mais leve em todas as salas (Paulo, 27/10/2026: "melhoria
// de desempenho precisa ser no motor todo").
const mapa = readFileSync('vybe-escritorio-mapa.js', 'utf8');
const css = readFileSync('vybe-styles.css', 'utf8');

test('móvel fora do enquadramento não troca de quadro e o fogo fora da tela não tremula', () => {
  assert.match(mapa, /if \(quadro % 12 === 0\) conferirNaTela\(\);/);
  assert.match(mapa, /if \(\(leve \|\| item\.foraDaTela\) && !item\.transicao\) continue;/);
  assert.match(mapa, /for \(const item of animados\) item\.foraDaTela = fora\(item\.no\);/);
  assert.match(css, /\.mapa-luz\.fogo\.fora-da-tela \{animation-play-state:paused\}/);
});
test('cada grupo de camadas tem o próprio recorte, guardado só pelas artes dele', () => {
  assert.match(mapa, /function mapaDesenharMovel\([^)]*justo = false\)/);
  assert.match(mapa, /\.filter\(\(c\) => c && \(!justo \|\| !filtro \|\| filtro\(c\)\)\)/);
  assert.match(mapa, /const chave = g\.chave \+ "\|" \+ d\.caixas\.filter/);
  assert.match(mapa, /dx: pronto\.ox - d\.ox, dy: pronto\.oy - d\.oy/);
  assert.match(mapa, /if \(cv\.style\.left !== esq\) cv\.style\.left = esq;/);
});
