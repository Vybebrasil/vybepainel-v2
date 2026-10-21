import test from 'node:test';
import assert from 'node:assert/strict';
import { perfilEscritorio } from '../server/escritorio.js';

// Looks salvos no criador (Paulo, 20/10/2026): até 5, só no formato do Habbo.
test('looks salvos: até 5, figura no formato do Habbo e objeto na mão conhecido', () => {
  const bom = { figura: 'hd-180-1.hr-828-61.ch-255-1408', mao: 'crr=6' };
  const p = perfilEscritorio({ looks: [bom, { figura: '<script>', mao: '' }, { figura: 'hd-180-1', mao: 'javascript:x' }, bom, bom, bom, bom] });
  assert.equal(p.looks.length, 5);
  assert.deepEqual(p.looks[0], bom);
  assert.deepEqual(p.looks[1], { figura: 'hd-180-1', mao: '' });
  assert.deepEqual(perfilEscritorio({}).looks, []);
  assert.deepEqual(perfilEscritorio({ looks: 'x' }).looks, []);
});
