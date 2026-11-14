// Sem WebGL (app do Mac, às vezes), o Vybe OS fica no padrão novo; só o 3D avisa que não abriu (Paulo, 14/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const m = fs.readFileSync('vybe-mundo.js', 'utf8');

test('falta de WebGL não desliga o mundo (menu, topo, dock e telas novas continuam)', () => {
  assert.doesNotMatch(m, /if \(semWebGL\) ligado = false/);
  assert.doesNotMatch(m, /ligado = !!sim && !semWebGL/);
  assert.match(m, /ligado = !!sim;/);
});

test('o quarto 3D que não monta vira aviso no cartão, não fica em "Montando"', () => {
  assert.match(m, /try \{ andarAberto = m\.abrirQuarto\([^)]*\), \{ quarto \}\); \} catch \(err\)/);
  assert.match(m, /O 3D não abriu neste aparelho agora/);
});

test('Demandas: até 1280 de tela a tabela tira Tipo, Conclusão e Tarefas para o nome não ficar por baixo', () => {
  assert.match(fs.readFileSync('padrao-v2/d3-producao.css', 'utf8'), /@media \(max-width:1280px\)\{\s*#pv2-demandas\.pv2 :is\(\.d3d-cab,\.d3d-lin\)\{grid-template-columns:minmax\(0,1fr\)/);
});
