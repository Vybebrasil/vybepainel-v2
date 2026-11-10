// Quem joga vai até a sala da mesa e a voz vai junto (Paulo, 10/11/2026: "quando vai pra sala do sinuca não devia ser
// a sala de voz do sinuca?"). Quem aceitava de outra sala jogava sem ouvir o outro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync(new URL('../vybe-escritorio-mesas.js', import.meta.url), 'utf8');
const corpo = fonte.match(/function mesaIrAteAMesa\(j\) \{[\s\S]*?\n\}\r?\n/)[0];

function montar(escritorio, salas = ['jogos', 'sala-3']) {
  const idas = [];
  const ctx = { escritorio, window: {}, escritorioAmbienteDoQuarto: (id) => (salas.includes(id) ? { id } : null), escritorioIrParaAmbiente: (id) => idas.push(id) };
  vm.createContext(ctx);
  vm.runInContext(corpo + '\nthis.ir = mesaIrAteAMesa;', ctx);
  return { ir: ctx.ir, idas };
}
const base = () => ({ conectado: true, mapa: {}, quarto: 'sala-3', base: {} });

test('quem aceita o desafio vai até a sala da mesa (e a voz da sala vem junto)', () => {
  const { ir, idas } = montar(base());
  assert.equal(ir({ eu: 'desafiado', camada: 'jogos' }), true);
  assert.deepEqual(idas, ['jogos']);
});

test('já na sala da mesa, quem só assiste, demo, convidado ou sala que não existe: fica onde está', () => {
  for (const [esc, j] of [
    [{ ...base(), quarto: 'jogos' }, { eu: 'desafiante', camada: 'jogos' }],
    [base(), { eu: null, camada: 'jogos' }],
    [{ ...base(), base: { demo: true } }, { eu: 'desafiado', camada: 'jogos' }],
    [{ ...base(), base: { convidado: {} } }, { eu: 'desafiado', camada: 'jogos' }],
    [{ ...base(), conectado: false }, { eu: 'desafiado', camada: 'jogos' }],
    [base(), { eu: 'desafiado', camada: 'sala-99' }],
    [{ ...base(), quarto: null }, { eu: 'desafiado', camada: 'praca' }],
  ]) {
    const { ir, idas } = montar(esc);
    assert.equal(ir(j), false, JSON.stringify(j));
    assert.deepEqual(idas, []);
  }
});

test('no mundo usa o desvio de vybe-mundo.js (move e religa a voz), e as duas telas de partida chamam a ida', () => {
  const esc = base(), idas = [];
  const ctx = { escritorio: esc, window: { escritorioIrParaAmbiente: (id) => idas.push('mundo:' + id) }, escritorioAmbienteDoQuarto: () => ({}), escritorioIrParaAmbiente: () => idas.push('antigo') };
  vm.createContext(ctx); vm.runInContext(corpo + '\nthis.ir = mesaIrAteAMesa;', ctx);
  ctx.ir({ eu: 'desafiado', camada: 'jogos' });
  assert.deepEqual(idas, ['mundo:jogos']);
  assert.match(fonte, /function abrirJogoMesa\(chave, j\) \{\r?\n  const s = escritorioMesa\(chave\);\r?\n  mesaIrAteAMesa\(j\);/);
  assert.match(readFileSync(new URL('../vybe-escritorio-xadrez.js', import.meta.url), 'utf8'), /function abrirJogoXadrez\(j\) \{[\s\S]{0,120}mesaIrAteAMesa\(j\);/);
});
