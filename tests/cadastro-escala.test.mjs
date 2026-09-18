// Criar em escala no cadastro: as datas nascem no ritmo pedido e os títulos
// entram colados de uma vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function cadastro() {
  // Só as funções de fora do fechamento: o resto do arquivo monta a tela.
  const fonte = fs.readFileSync('cadastros_governed_v2.js', 'utf8').split('\n(function() {')[0];
  const c = vm.createContext({ console });
  vm.runInContext(fonte, c);
  return (chamada, ...args) => { c.a = args; return JSON.parse(vm.runInContext(`JSON.stringify(${chamada})`, c)); };
}

test('dez fotografias a cada três dias: veiculação no ritmo e prazo sete dias antes', () => {
  const chamar = cadastro();
  const datas = chamar('cadastroDatasEmEscala(a[0], a[1], a[2])', '2026-09-23', 10, 3);
  assert.equal(datas.length, 10);
  assert.deepEqual(datas[0], { veic: '2026-09-23', prazo: '2026-09-16' });
  assert.deepEqual(datas[1], { veic: '2026-09-26', prazo: '2026-09-19' });
  // Atravessa o mês sem escorregar de dia.
  assert.deepEqual(datas[9], { veic: '2026-10-20', prazo: '2026-10-13' });
});

test('fim de semana não é pulado: a data é a que a conta dá', () => {
  const chamar = cadastro();
  // 26/09/2026 é sábado; 27, domingo.
  const datas = chamar('cadastroDatasEmEscala(a[0], a[1], a[2])', '2026-09-25', 3, 1);
  assert.deepEqual(datas.map((d) => d.veic), ['2026-09-25', '2026-09-26', '2026-09-27']);
});

test('limites: até 60 por vez, intervalo de 1 a 365 e primeira data obrigatória', () => {
  const chamar = cadastro();
  assert.equal(chamar('cadastroDatasEmEscala(a[0], a[1], a[2])', '2026-09-23', 60, 1).length, 60);
  const erro = (args) => { try { chamar('cadastroDatasEmEscala(a[0], a[1], a[2])', ...args); return ''; } catch (e) { return e.message; } };
  assert.match(erro(['2026-09-23', 61, 1]), /60/);
  assert.match(erro(['2026-09-23', 10, 0]), /intervalo/i);
  assert.match(erro(['', 10, 3]), /primeira/i);
  assert.match(erro(['2026-09-23', 0, 3]), /quantos/i);
});

test('títulos colados: um por linha, sem numeração nem marcador, sem linha vazia', () => {
  const chamar = cadastro();
  assert.deepEqual(chamar('cadastroTitulosColados(a[0])', '1. Mesa posta\n2) Treino funcional\n\n- Recepção\n• Fachada\nSem marca'),
    ['Mesa posta', 'Treino funcional', 'Recepção', 'Fachada', 'Sem marca']);
});
