import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// O subsolo é easter egg: quem está fora não vê quem está lá dentro, e a sala
// não entra em lista nenhuma (Paulo, 27/10/2026).
function contexto(zona) {
  const fonte = readFileSync('vybe-escritorio.js', 'utf8').replace(/\r\n/g, '\n');
  const i = fonte.indexOf('function escritorioPresencaVisivel');
  const corpo = fonte.slice(i, fonte.indexOf('\n}\n', i) + 3);
  const c = vm.createContext({ escritorio: { zona, base: { eu: '1' } },
    ESCRITORIO_PLANTA: { ambientes: [{ id: 'operacao' }, { id: 'subsolo', oculta: true }] } });
  vm.runInContext(corpo, c);
  return c;
}
const online = [{ id: '1', zona: 'operacao' }, { id: '2', zona: 'subsolo' }, { id: '3', zona: 'operacao' }];

test('quem está fora do subsolo não vê quem está lá dentro', () => {
  assert.deepEqual(contexto('operacao').escritorioPresencaVisivel(online).map((p) => p.id), ['1', '3']);
});
test('quem está dentro do subsolo vê todo mundo', () => {
  assert.deepEqual(contexto('subsolo').escritorioPresencaVisivel(online).map((p) => p.id), ['1', '2', '3']);
});
test('o subsolo é sala escondida na planta e não aparece na lista lateral', () => {
  const fonte = readFileSync('vybe-escritorio-planta.js', 'utf8');
  assert.match(fonte, /subsolo: \{[^\n]*oculta: true/);
  const tela = readFileSync('vybe-escritorio.js', 'utf8');
  assert.match(tela, /a\.id !== "operacao" && !a\.oculta\)/);
  // S\xc3\xb3 pela porta secreta, mas a porta \xc3\xa9 de todos (n\xc3\xa3o s\xc3\xb3 de quem administra).
  assert.match(tela, /a\.oculta && !escritorio\.pelaPortaSecreta\) return/);
});

test('a estante secreta abre a passagem para todos; o livro de registros só para quem administra', () => {
  const fonte = readFileSync('vybe-escritorio-subsolo.js', 'utf8');
  const corpo = fonte.slice(fonte.indexOf('function escritorioAcaoDoSubsolo'), fonte.indexOf('const escritorioEhPecaDoSubsolo'));
  assert.ok(corpo.indexOf('ESCRITORIO_ESTANTE_SECRETA') < corpo.indexOf('escritorio.base?.admin'));
  assert.ok(corpo.indexOf('escritorio.base?.admin') < corpo.indexOf('ESCRITORIO_LIVRO_DE_REGISTROS'));
  assert.doesNotMatch(fonte, /function descerAoSubsoloEscritorio\(\) \{\s*if \(!escritorio\.base\?\.admin\)/);
});
