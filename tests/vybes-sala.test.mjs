import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// O ouvido da sala (vybe-vybes.js) carregado como no navegador, sem rede nem tela.
function sala() {
  const c = vm.createContext({ console, Date, URL, setTimeout, clearTimeout, setInterval: () => 0, addEventListener() {}, removeEventListener() {},
    fetch: async () => ({ ok: false, json: async () => ({}) }), getComputedStyle: () => ({ display: 'none' }),
    document: { addEventListener() {}, getElementById: () => null, hidden: true, visibilityState: 'hidden' }, window: {} });
  vm.runInContext(readFileSync(new URL('../vybe-vybes.js', import.meta.url), 'utf8'), c);
  return (s) => vm.runInContext(s, c);
}

test('sala: o nome como o navegador e o Whisper escrevem, inclusive o que o Reriston falou (04/11/2026)', () => {
  const r = sala();
  for (const f of ['Vybes', 'Vybe', 'Jarvis', 'Vibes', 'Vaibes', 'Bora, Vibs', 'Bora, Bybes', 'Bora, Wibes', 'Bora, Vybis', 'Bora, Vives', 'Bora, Vipes', 'Bora, Vaives', 'bora, vai bis'])
    assert.ok(r(`VYBES_NOME.test(${JSON.stringify(f)})`), f);
  for (const f of ['vibração boa no post', 'vai beber água', 'eu vivo dizendo isso']) assert.ok(!r(`VYBES_NOME.test(${JSON.stringify(f)})`), f);
});

test('sala: chamar, perguntar pelo dia, pedir e mandar calar, com as regras da central', () => {
  const r = sala(), e = (f) => r(`vybesEntender(${JSON.stringify(f)})`);
  for (const f of ['Vybes', 'Bom dia Vybes. Vybes.', 'Bora Vybes, quero trabalhar.', 'Ô Vybes, bora trabalhar!', 'Vybes, quero trabalhar.', 'Bora lá Vybes', 'Bora Vybes desgraça', 'Acorda Vybes porra', 'E aí Vybes', 'Vybes, bora lá'])
    assert.equal(e(f), 'chamado', f);
  for (const f of ['Vybes, como tá meu dia?', 'quais demanda de hoje vybes', 'Vybes, quais as prioridades de hoje?', 'como tá hoje, pai?', 'Vybes, o que tem pra hoje?', 'como que tá meu dia vybes'])
    assert.equal(e(f), 'dia', f);
  for (const f of ['Vybes, como tá a Voa hoje?', 'Vybes, quais as prioridades?', 'Vybes, abre a geral', 'Vybes, quais demandas da Voa hoje?'])
    assert.equal(e(f), 'pedido', f);
  for (const f of ['cala boca vybe', 'cala a boca aí, carai', 'cala a porra da boca aí', 'para de falar', 'faz silêncio', 'Cala a boca, Vybes.', 'psiu'])
    assert.equal(e(f), 'bronca', f);
  for (const f of ['Vybes, para', 'espera', 'pausa', 'chega']) assert.equal(e(f), 'calar', f);
  assert.equal(e('para de falar com o cliente'), 'pedido');
});

test('sala: as falas novas (dia, calado, caladoOk) têm áudio na voz da central', () => {
  const falas = JSON.parse(readFileSync(new URL('../assets/vybes-fala/falas.json', import.meta.url), 'utf8'));
  for (const tipo of ['chamado', 'olhando', 'pedido', 'toque', 'dispensa', 'dia', 'calado', 'caladoOk']) {
    assert.ok(falas[tipo]?.length, tipo);
    for (const f of falas[tipo]) assert.ok(readFileSync(new URL('../assets/vybes-fala/' + f.arquivo, import.meta.url)).length > 1000, f.arquivo);
  }
  assert.ok(falas.calado.every((f) => f.texto.includes('?')));
});
