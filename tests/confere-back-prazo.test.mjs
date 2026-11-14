// Confere do back (14/11/2026), item 4 da liga: o Prazo de Ouro tem uma regra só (shared/prazo-interno.js), a do cadastro
// do planejamento: 7 dias antes da veiculação, sexta no fim de semana, hoje se já passou e no máximo 2 dias antes. O
// planejamento e o bot usam a mesma. SAFE: funções puras e o bot com banco de mentira (PGlite).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import prazo from '../shared/prazo-interno.js';
import { prazoDaPeca } from '../server/planejamentos.js';

const HOJE = '2026-11-14'; // sábado
const CASOS = [
  ['2026-11-30', '2026-11-23'], // 7 dias antes, segunda
  ['2026-11-29', '2026-11-20'], // 7 dias antes cai no domingo (22/11) → sexta 20/11
  ['2026-11-18', '2026-11-14'], // o ouro (11/11) passou: hoje, que ainda cabe até 2 dias antes (16/11)
  ['2026-11-15', '2026-11-13'], // a menos de 2 dias: 2 dias antes (13/11, sexta) — nasce atrasada de verdade
];

test('uma regra só: shared/prazo-interno.js e o cadastro do planejamento dão o mesmo prazo', () => {
  for (const [veic, esperado] of CASOS) {
    assert.equal(prazo.prazoInterno(veic, HOJE), esperado, veic);
    assert.equal(prazoDaPeca(veic, HOJE), esperado, `planejamento ${veic}`);
  }
  assert.equal(prazo.prazoInterno('', HOJE), '');
  assert.equal(prazo.PRAZO_OURO_DIAS, 7); assert.equal(prazo.MARGEM_MINIMA_DIAS, 2);
});

test('no navegador fica em window.VybePrazoInterno (para cadastros_governed_v2.js e vybe-sazonal.js)', () => {
  const ctx = vm.createContext({ window: {} }); ctx.globalThis = ctx;
  vm.runInContext(readFileSync('shared/prazo-interno.js', 'utf8'), ctx);
  assert.equal(ctx.VybePrazoInterno.prazoInterno('2026-11-30', HOJE), '2026-11-23');
});

test('o bot cria a peça com o Prazo de Ouro (antes: 2 dias antes da veiculação)', () => {
  const s = readFileSync('server/assistente-acoes.js', 'utf8');
  assert.match(s, /prazoInternoComum\.prazoInterno\(veiculacao, hoje\)/);
  assert.doesNotMatch(s, /const menos2 =/);
});
