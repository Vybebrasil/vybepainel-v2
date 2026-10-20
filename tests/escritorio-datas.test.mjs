import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// No Escritório, toda data de demanda diz se é prazo ou veiculação (Paulo, 19/10/2026).
test('missões e cobranças dizem se a data é prazo ou veiculação', () => {
  const c = vm.createContext({ window: {}, document: {}, safeText: String, localStorage: { getItem: () => null }, escritorio: {} });
  vm.runInContext(readFileSync('vybe-escritorio-missoes.js', 'utf8'), c);
  const prazo = (m) => vm.runInContext(`missaoPrazoHtml(${JSON.stringify(m)})`, c);
  assert.match(prazo({ prazo: '2026-10-08', tipo_data: 'prazo', atrasada: true }), /Prazo vencido · 08\/10/);
  assert.match(prazo({ prazo: '2026-10-08', tipo_data: 'veiculacao', atrasada: true }), /Veiculação vencida · 08\/10/);
  assert.match(prazo({ prazo: '2026-10-20', tipo_data: 'veiculacao' }), /Veiculação 20\/10/);
  assert.match(prazo({ prazo: '2026-10-19', tipo_data: 'prazo', hoje: true }), /Prazo hoje/);
  const rotulo = (x) => vm.runInContext(`cobrancaRotulo(${JSON.stringify(x)})`, c);
  assert.match(rotulo({ tipo: 'atrasada', dias: 2, data: '2026-10-17' }), /^Prazo vencido há 2 dias \(17\/10\)$/);
  assert.match(rotulo({ tipo: 'vence', dias: -1, data: '2026-10-20' }), /^Prazo amanhã/);
  assert.match(rotulo({ tipo: 'agendar', dias: 1, data: '2026-10-18' }), /^Veiculação atrasada há 1 dia/);
  assert.match(rotulo({ tipo: 'lembrar_cliente', dias: 0, data: '2026-10-19' }), /prazo \(19\/10\)/);
  // Aguardo é marcar a gravação, não o cliente mandar algo (Paulo, 20/10/2026).
  assert.match(rotulo({ tipo: 'marcar_gravacao', dias: 0, data: '2026-10-19' }), /^Marcar a gravação · prazo \(19\/10\)$/);
  assert.match(rotulo({ tipo: 'lembrar_cliente', status_chave: 'ag_aprovacao_cliente', dias: 0, data: '2026-10-19' }), /^Esperando aprovação do cliente/);
  const falas = (x) => vm.runInContext(`falasDaCobranca(${JSON.stringify(x)}, 'Vinícius')`, c).join(' ');
  assert.match(falas({ tipo: 'marcar_gravacao', titulo: 'Fotografia - Diário de campo', dias: 0 }), /marcar a gravação/);
  assert.doesNotMatch(falas({ tipo: 'marcar_gravacao', titulo: 'Fotografia - Diário de campo', dias: 0 }), /devendo|mandar/);
});
