import test from 'node:test';
import assert from 'node:assert/strict';
import calc from '../shared/financas-calculos.js';
import comercial from '../shared/comercial-calculos.js';
import { lancamentosDoFinancas } from '../server/vybe-financas-api.js';

// Auditoria de 09/11: Recebimentos, Contas, Inadimplência e Por cliente liam só as tabelas do Vybe OS (vazias) e
// contradiziam a Visão geral, que lê o Vybe Finanças. Agora os lançamentos do Finanças entram nessas abas.
const T = [
  { id: 1, type: 'INCOME', amount: 2500, status: 'PAID', date: '2026-11-03', paid_date: '2026-11-04', client_id: 'f1', description: 'Mensalidade - Antonov' },
  { id: 2, type: 'INCOME', amount: 1800, status: 'PENDING', date: '2026-09-10', client_id: 'f2', description: 'Mensalidade - Brussolo' },
  { id: 3, type: 'INCOME', amount: 0, status: 'PENDING', date: '2026-10-01', client_id: 'f3', description: 'Mensalidade - DiaCenter' },
  { id: 4, type: 'INCOME', amount: 900, status: 'PENDING', date: '2026-11-20', client_id: 'f9', description: 'Site' },
  { id: 5, type: 'EXPENSE', amount: 3000, status: 'PENDING', date: '2026-11-05', employee_id: 'e1', category: 'Salários', description: 'Salário Bia' },
  { id: 6, type: 'EXPENSE', amount: 400, status: 'PAID', date: '2026-11-02', paid_date: '2026-11-02', category: 'DAS', description: 'Simples' },
  { id: 7, type: 'EXPENSE', amount: 150, status: 'PAID', date: '2026-11-02', category: 'Internet', description: 'Fibra' },
  { id: 8, type: 'TRANSFER', amount: 999, status: 'PAID', date: '2026-11-02' },
];
const por = { f1: { vybe_id: '10', vybe_nome: 'Antonov' }, f2: { vybe_id: '11', vybe_nome: 'Brussolo Ristorante' } };

test('receitas do Finanças viram recebíveis: pago = recebido, valor zero fica fora, cliente pelo Vybe OS', () => {
  const r = calc.recebiveisDoFinancas(T, por, { f9: 'Cliente Antigo' });
  assert.deepEqual(r.map((x) => x.id), ['fin:1', 'fin:2', 'fin:4']);
  assert.equal(r[0].valor_recebido, 2500); assert.equal(r[0].recebido_em, '2026-11-04'); assert.equal(r[0].tipo, 'recorrente'); assert.equal(r[0].cliente_id, '10');
  assert.equal(r[1].valor_recebido, 0); assert.equal(r[1].cliente_nome, 'Brussolo Ristorante');
  assert.equal(r[2].cliente_id, null); assert.equal(r[2].cliente_nome, 'Cliente Antigo');
  const inad = comercial.inadimplencia(r, '2026-11-09');
  assert.deepEqual(inad.clientes.map((c) => [c.cliente_nome, c.valor]), [['Brussolo Ristorante', 1800]]); // sem "DiaCenter R$ 0,00 crítico"
  assert.equal(comercial.resumoRecebimentos(r, comercial.periodo('2026-11'), '2026-11-09').atual.a_receber, 3400);
});

test('despesas do Finanças viram contas a pagar no grupo certo (folha, imposto, fixa)', () => {
  const c = calc.contasDoFinancas(T);
  assert.deepEqual(c.map((x) => [x.id, x.grupo, x.pago_em]), [['fin:5', 'folha', null], ['fin:6', 'imposto', '2026-11-02'], ['fin:7', 'fixa', '2026-11-02']]);
});

test('lancamentosDoFinancas: desligado devolve null; ligado liga clientes e mensalidade por cliente do Vybe OS', async () => {
  const sql = async () => [{ id: '10', nome: 'Antonov', cnpj: '' }, { id: '11', nome: 'Brussolo Ristorante', cnpj: '' }];
  assert.equal(await lancamentosDoFinancas(sql, { conector: { configurado: () => false } }), null);
  const conector = { configurado: () => true, lerBase: async ({ desde }) => { assert.equal(desde, '2025-01-01');
    return { clientes: [{ id: 'f1', name: 'Antonov', monthly_fee: 2500, contract_status: 'Ativo' }, { id: 'f2', name: 'Brussolo', monthly_fee: 1800 }], transacoes: T }; } };
  const r = await lancamentosDoFinancas(sql, { conector, hoje: '2026-11-09' });
  assert.equal(r.recebiveis.length, 3); assert.equal(r.contas.length, 3);
  assert.deepEqual(r.porVybe['11'], { valor_mensal: 1800, status: '' });
});

test('resumo do mês separa a folha lançada como despesa das outras despesas', () => {
  const r = calc.resumoMes(T, [], '2026-11');
  assert.equal(r.despesas_folha, 3000);
  assert.equal(r.despesas_sem_folha, 550);
  assert.equal(Number(r.despesas_pagas) + Number(r.despesas_pendentes), 3550);
});

test('salário sem funcionário ligado conta como folha; mensalidade sem cliente liga pelo nome da descrição', () => {
  const sal = { id: 9, type: 'EXPENSE', amount: 2600, status: 'PENDING', date: '2026-11-05', category: 'Salário/Prolabore', description: 'Salário - Jady' };
  assert.equal(calc.grupoDaDespesa(sal), 'folha');
  assert.equal(calc.resumoMes([sal], [], '2026-11').despesas_sem_folha, 0);
  const vybe = [{ id: '30', nome: 'Ace - Associação Comercial' }, { id: '31', nome: 'Antonov' }];
  const r = calc.recebiveisDoFinancas([
    { id: 20, type: 'INCOME', amount: 1000, status: 'PENDING', date: '2026-10-01', description: 'Mensalidade - ACE - Associação Comercial' },
    { id: 21, type: 'INCOME', amount: 800, status: 'PENDING', date: '2026-10-01', description: 'Mensalidade - Irecê Modas' },
  ], {}, {}, vybe);
  assert.deepEqual(r.map((x) => [x.cliente_id, x.cliente_nome]), [['30', 'Ace - Associação Comercial'], [null, 'Irecê Modas']]);
});

test('mensalidade de cliente apagado no Finanças também liga pelo nome da descrição', () => {
  const vybe = [{ id: '30', nome: 'Ace - Associação Comercial' }];
  const r = calc.recebiveisDoFinancas([{ id: 22, type: 'INCOME', amount: 1000, status: 'PENDING', date: '2026-10-01', client_id: 'apagado', description: 'Mensalidade - ACE - Associação comercial e empresarial de irecê' },
    { id: 23, type: 'INCOME', amount: 500, status: 'PENDING', date: '2026-10-01', client_id: 'apagado2', description: 'Mensalidade - João Bacelar' }], {}, {}, vybe);
  assert.deepEqual(r.map((x) => [x.cliente_id, x.cliente_nome]), [['30', 'Ace - Associação Comercial'], [null, 'João Bacelar']]);
});
