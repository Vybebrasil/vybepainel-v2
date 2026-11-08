// Equilíbrio de objetivos (Atração, Educação, Conversão) das peças de cada cliente no mês:
// funções puras de vybe-conteudo-equilibrio.js (módulo Conteúdo, 07/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ctx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('vybe-conteudo-equilibrio.js', 'utf8'), ctx);
const E = ctx.window.VybeEquilibrio;
const json = (v) => JSON.parse(JSON.stringify(v));
const peca = (cliente, dia, objetivo, extra = {}) => ({ clientes: [cliente], veiculacao_iso: dia, objetivo, ...extra });
const repetir = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('12 peças com 6/4/2: a frase do resumo aponta que falta conversão', () => {
  const pecas = [...repetir(6, (i) => peca('Alfa', `2026-11-${String(i + 1).padStart(2, '0')}`, 'atracao')),
    ...repetir(4, (i) => peca('Alfa', `2026-11-1${i}`, 'educacao')), ...repetir(2, (i) => peca('Alfa', `2026-11-2${i}`, 'conversao'))];
  const r = json(E.equilibrioDoMes(pecas, { mes: '2026-11' }));
  assert.equal(r.clientes.length, 1);
  const a = r.clientes[0];
  assert.deepEqual([a.total, a.atracao, a.educacao, a.conversao, a.sem], [12, 6, 4, 2, 0]);
  assert.deepEqual(a.falta, ['conversao']);
  assert.equal(a.frase, '12 peças: 6 atração, 4 educação, 2 conversão — falta conversão');
});

test('equilibrado, sem objetivo e objetivo zerado', () => {
  const ok = json(E.equilibrioDoMes([...repetir(3, () => peca('B', '2026-11-03', 'atracao')), ...repetir(3, () => peca('B', '2026-11-04', 'educacao')),
    ...repetir(3, () => peca('B', '2026-11-05', 'conversao')), peca('B', '2026-11-06', null)], { mes: '2026-11' })).clientes[0];
  assert.deepEqual(ok.falta, []);
  assert.equal(ok.frase, '10 peças: 3 atração, 3 educação, 3 conversão — equilibrado · 1 sem objetivo');
  const zerado = json(E.equilibrioDoMes([peca('C', '2026-11-01', 'atracao'), peca('C', '2026-11-02', 'atracao'), peca('C', '2026-11-03', 'educacao')], { mes: '2026-11' })).clientes[0];
  assert.deepEqual(zerado.falta, ['conversao']);
  // Poucas peças classificadas: ainda não dá para dizer o que falta.
  const pouco = json(E.equilibrioDoMes([peca('D', '2026-11-01', 'atracao'), peca('D', '2026-11-02', null)], { mes: '2026-11' })).clientes[0];
  assert.deepEqual(pouco.falta, []);
  assert.equal(pouco.frase, '2 peças: 1 atração, 0 educação, 0 conversão · 1 sem objetivo');
});

test('a data do cliente manda, o mês filtra, peça de dois clientes conta em cada um e uma vez no geral', () => {
  const pecas = [
    { clientes: ['Alfa', 'Beta'], veiculacao_iso: '2026-11-10', prazo_iso: '2026-10-30', objetivo: 'educacao' },
    { cliente: 'Alfa', prazo_iso: '2026-11-02', objetivo: 'atracao' }, // sem veiculação: vale o prazo
    { cliente: 'Alfa', veiculacao_iso: '2026-12-01', prazo_iso: '2026-11-25', objetivo: 'conversao' }, // dezembro
    { cliente: '', veiculacao_iso: '2026-11-05', objetivo: 'atracao' }, // sem cliente: fora
  ];
  const r = json(E.equilibrioDoMes(pecas, { mes: '2026-11' }));
  assert.equal(r.geral.total, 2);
  assert.deepEqual(r.clientes.map((c) => [c.cliente, c.total]), [['Alfa', 2], ['Beta', 1]]);
  // Só os clientes pedidos (ex.: ativos do cadastro), sem caixa nem acento.
  assert.deepEqual(json(E.equilibrioDoMes(pecas, { mes: '2026-11', clientes: ['beta'] })).clientes.map((c) => c.cliente), ['Beta']);
  assert.throws(() => E.equilibrioDoMes(pecas, { mes: 'novembro' }), /AAAA-MM/);
});

test('quem tem falta vem primeiro; objetivo aceita variações e recusa o resto', () => {
  const r = json(E.equilibrioDoMes([...repetir(5, () => peca('Grande', '2026-11-01', 'atracao')).map((p, i) => ({ ...p, objetivo: ['atracao', 'educacao', 'conversao'][i % 3] })),
    ...repetir(3, () => peca('Pequeno', '2026-11-02', 'atracao'))], { mes: '2026-11' }));
  assert.equal(r.clientes[0].cliente, 'Pequeno');
  assert.equal(E.objetivoValido('Atração'), 'atracao');
  assert.equal(E.objetivoValido('CONVERSÃO'), 'conversao');
  assert.equal(E.objetivoValido('educar'), 'educacao');
  assert.equal(E.objetivoValido('branding'), null);
});

test('etapa de aprovação a partir do status do painel e da resposta do cliente', () => {
  assert.equal(E.etapaDeAprovacao('Para aprovação'), 'aprovar_interno');
  assert.equal(E.etapaDeAprovacao('Ag. Interno'), 'aprovar_interno');
  assert.equal(E.etapaDeAprovacao('Alteração'), 'alteracao_interna');
  assert.equal(E.etapaDeAprovacao('Alteração', 'ajuste'), 'alteracao_cliente');
  assert.equal(E.etapaDeAprovacao('Ag. Aprovação Cliente'), 'aprovado_interno');
  assert.equal(E.etapaDeAprovacao('Para agendar'), 'aprovado_interno');
  assert.equal(E.etapaDeAprovacao('Para agendar', 'aprovar'), 'aprovado_cliente');
  assert.equal(E.etapaDeAprovacao('Para aprovação', 'aprovar'), 'aprovar_interno', 'voltou para aprovação interna');
  assert.equal(E.etapaDeAprovacao('Em andamento'), null);
});

test('comparação com o mês anterior e virada de ano', () => {
  assert.equal(E.comparar(12, 9).texto, '+3 vs mês anterior');
  assert.equal(E.comparar(2, 5).texto, '−3 vs mês anterior');
  assert.equal(E.comparar(4, 4).texto, 'igual ao mês anterior');
  assert.equal(E.mesAnterior('2026-01'), '2025-12');
  assert.equal(E.mesAnterior('2026-11'), '2026-10');
});
