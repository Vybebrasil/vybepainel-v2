import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Com a chamada ligada, o Escritório se redesenha por trás do painel. Se o
// redesenho travar a rolagem sem conferir se ele está na tela, a página do
// painel para de rolar (Deivid, 20/10/2026).
test('o redesenho do Escritório só trava a rolagem com ele na tela', () => {
  const fonte = readFileSync(new URL('../vybe-escritorio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /classList\.add\(["']no-escritorio["']\)/);
  assert.match(fonte, /classList\.toggle\("no-escritorio", painel\.style\.display === "block"\)/);
});
