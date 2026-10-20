import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Consultas automáticas só com alguém olhando (Paulo, 19/10/2026): cada aba
// aberta perguntava ao servidor a cada 15–60 s e o banco nunca dormia.
test('consultas param com a aba escondida ou ninguém mexendo, e voltam ao mexer', () => {
  const eventos = {}, disparados = [];
  const doc = { hidden: false, addEventListener: (n, f) => { eventos['doc:' + n] = f; }, getElementById: () => null };
  const c = vm.createContext({
    document: doc, localStorage: { getItem: () => null, setItem() {} }, setInterval: () => 0, setTimeout: () => 0, clearTimeout() {},
    addEventListener: (n, f) => { eventos[n] = f; }, window: { dispatchEvent: (e) => disparados.push(e.type) }, Event: class { constructor(t) { this.type = t; } }, Date,
  });
  vm.runInContext(readFileSync('vybe-sync.js', 'utf8'), c);
  const agora = Date.now();
  assert.equal(vm.runInContext(`painelDeveConsultar(${agora})`, c), true, 'aba aberta e alguém mexendo: consulta');
  assert.equal(vm.runInContext(`painelDeveConsultar(${agora + 21 * 60e3})`, c), false, '20 minutos sem mexer: para');
  doc.hidden = true; eventos['doc:visibilitychange']();
  assert.equal(vm.runInContext(`painelDeveConsultar(${agora + 2 * 60e3})`, c), true, 'escondida há pouco: ainda consulta');
  assert.equal(vm.runInContext(`painelDeveConsultar(${agora + 4 * 60e3})`, c), false, 'escondida há mais de 3 min: para');
  // Voltou a olhar depois da pausa: pede tudo de novo na hora.
  vm.runInContext(`PAINEL_ESCONDIDO_DESDE = ${agora - 10 * 60e3}`, c);
  doc.hidden = false; eventos['doc:visibilitychange']();
  assert.deepEqual(disparados, ['vybe-retomou']);
  assert.equal(vm.runInContext('painelDeveConsultar()', c), true);
});
