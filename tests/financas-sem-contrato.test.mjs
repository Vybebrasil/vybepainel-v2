// fin2 (26/11/2026): a projeção e o MRR sem contratos cadastrados. Em produção só 1 de ~15 clientes ativos tinha
// mensalidade cadastrada e a base nova da projeção usava só os contratos como entrada: o PDF saiu com MRR de R$ 1.200,
// saldo de −R$ 184 mil em 12 meses e "caixa negativo em 05/12/2026", com R$ 17,9 mil de receita no mesmo mês. Alarme
// falso. Aqui, o mesmo caso: 15 clientes ativos, 1 contrato de R$ 1.200 e 3 meses de extrato com ~R$ 30 mil de entrada
// e ~R$ 21 mil de saída por mês.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import A from '../shared/financeiro-analises.js';
import { montarAnalise } from '../server/financeiro-analise.js';

let seq = 0;
const lanc = (data, valor, categoria, real = {}) => ({ id: `p${++seq}`, banco: { data, valor, historico: categoria, saldo: null }, real: { categoria, status: 'ok', conferido: true, ...real } });

const HOJE = '2026-11-26';
const MESES = ['2026-08', '2026-09', '2026-10'];
const ATIVOS = Array.from({ length: 15 }, (_, i) => ({ cliente_id: String(i + 1), cliente_nome: i === 0 ? 'Lyo Bottles' : `Cliente ${i + 1}` }));
const CONTRATOS = [{ cliente_id: '1', cliente_nome: 'Lyo Bottles', valor_mensal: 1200, dia_vencimento: 10, inicio: '2026-11-14', fim: '', ativo: true }];
// Entradas: a Lyo (com contrato) ligada a ela; 4 clientes sem contrato ligados; o resto (10 clientes) chega como Pix de
// cliente sem dizer de quem. Total ~R$ 30 mil por mês. Saídas ~R$ 21 mil por mês.
function extratoComoProducao() {
  const l = [];
  for (const m of MESES) {
    l.push(lanc(`${m}-10`, 1200, 'receita_cliente', { cliente_id: '1', cliente_nome: 'Lyo Bottles' }));
    for (const [id, v, d] of [['2', 2500, '07'], ['3', 2300, '11'], ['4', 2100, '13'], ['5', 2000, '16']]) l.push(lanc(`${m}-${d}`, v, 'receita_cliente', { cliente_id: id, cliente_nome: `Cliente ${id}` }));
    for (let k = 0; k < 10; k++) l.push(lanc(`${m}-${String(3 + k * 2).padStart(2, '0')}`, 1990, k % 3 ? 'receita_cliente' : 'a_classificar'));
    for (const [d, v, c] of [['05', -9000, 'salario'], ['15', -3000, 'freela'], ['06', -2500, 'estrutura'], ['20', -1800, 'impostos'], ['28', -700, 'ferramentas'], ['12', -1000, 'combustivel'], ['22', -3000, 'outra_saida']]) l.push(lanc(`${m}-${d}`, v, c));
  }
  l.push(lanc('2026-11-10', 1200, 'receita_cliente', { cliente_id: '1', cliente_nome: 'Lyo Bottles' }));
  return l;
}
const P = () => ({ hoje: HOJE, saldo_hoje: 15000, lista: extratoComoProducao(), meses_base: MESES, contratos: CONTRATOS, clientes_ativos: ATIVOS, fixos: [], salarios: {}, risco: [], pipeline: [], atraso_medio: 10, horizonte: 12 });

test('fin2: caso igual ao da produção — o base não fica negativo no primeiro mês e a confiança vem baixa, com o motivo', () => {
  const r = A.projecao3(P());
  const rc = r.premissas.receita;
  assert.equal(rc.media_recente, 30000, 'média real recente das entradas');
  assert.equal(rc.contratos, 1200);
  assert.equal(rc.estimados, 8900, '4 clientes sem contrato pela média deles no extrato');
  assert.equal(rc.clientes_estimados, 4);
  assert.equal(rc.outras, 19900, 'as entradas sem cliente identificado pela média');
  assert.equal(rc.projetada, 30000, 'a receita projetada fica na média real, não em R$ 1.200');
  assert.ok(r.base.meses[0].menor_saldo >= 0 && r.base.meses[1].menor_saldo >= 0, `base no 1º mês: ${JSON.stringify(r.base.meses.slice(0, 2))}`);
  assert.equal(r.base.primeiro_dia_negativo, null);
  assert.equal(r.base.folego_meses, null);
  assert.ok(r.base.saldo_final > 15000, 'com ~R$ 9 mil de sobra por mês, o saldo cresce');
  assert.ok(r.pessimista.saldo_final <= r.base.saldo_final && r.base.saldo_final <= r.otimista.saldo_final);
  assert.equal(r.confianca.nivel, 'baixa');
  assert.equal(r.confianca.motivo, 'a projeção usa a média do extrato para 14 clientes sem contrato');
  assert.match(r.confianca.texto, /confiança baixa · a projeção usa a média do extrato para 14 clientes sem contrato/);
  assert.deepEqual(r.premissas.cobertura, { ativos: 15, com_contrato: 1, sem_contrato: 14, pct_receita: 4, texto: '1 de 15 clientes ativos com contrato cadastrado' });
  assert.equal(r.premissas.maior_cliente.cliente_nome, 'Cliente 2', '"perder o maior" olha também quem paga sem contrato');
});

test('fin2: a regra antiga (só o contrato + cliente identificado) é que dava o caixa negativo', () => {
  // Sem os clientes ativos nem as entradas sem cliente (o que a base antiga enxergava), a mesma saída de ~R$ 21 mil
  // contra R$ 10,1 mil de entrada afunda o caixa em menos de dois meses.
  const velho = A.projecao3({ ...P(), lista: P().lista.filter((t) => t.banco.valor < 0 || t.real.cliente_id) });
  assert.ok(velho.base.primeiro_dia_negativo && velho.base.primeiro_dia_negativo < '2027-02-01', velho.base.primeiro_dia_negativo);
  const novo = A.projecao3(P());
  assert.ok(novo.base.saldo_final - velho.base.saldo_final > 100000);
});

test('fin2: MRR de contrato continua, o estimado fica ao lado; cliente sem contrato não é perdido nem zero', () => {
  const r = A.projecao3(P());
  const meses = A.mesesEntre('2025-12', '2026-11');
  const fora = A.entradasForaDeContrato(P().lista, MESES, CONTRATOS);
  assert.deepEqual(fora, [28800, 28800, 28800], 'sem contrato = tudo o que entrou menos a Lyo');
  const rec = A.recorrente(CONTRATOS, meses, { hoje: HOJE, estimado: r.receita_base, semContratoPorMes: Object.fromEntries(MESES.map((m, i) => [m, fora[i]])) });
  assert.equal(rec.mrr, 1200, 'o MRR de contrato');
  assert.equal(rec.mrr_estimado, 1200 + 8900 + 19900, 'contrato + recorrentes pelo extrato + Pix de cliente sem dizer de quem');
  assert.equal(rec.ticket_estimado, 2000, 'R$ 30 mil ÷ 15 clientes ativos');
  assert.equal(rec.cobertura.texto, '1 de 15 clientes ativos com contrato cadastrado');
  assert.ok(rec.meses.every((m) => m.perdido === 0), 'ninguém perdido só por não ter contrato');
  assert.equal(rec.meses.find((m) => m.mes === '2026-10').com_extrato, 28800, 'outubro: contrato ainda não vigia; o que entrou sem contrato');
  assert.equal(rec.meses.find((m) => m.mes === '2026-07').recebido_sem_contrato, null, 'fora do extrato não se inventa nada');
});

test('fin2: achado do Vorcaro com a cobertura e o botão para cadastrar; nada de fôlego curto', () => {
  const pj = A.projecao3(P());
  const ach = A.achados({ hoje: HOJE, projecao: pj });
  const c = ach.find((a) => a.id === 'contratos_cobertura');
  assert.ok(c, JSON.stringify(ach));
  assert.equal(c.det, '1 de 15 clientes ativos com contrato cadastrado');
  assert.equal(c.aba, 'fin_clientes');
  assert.match(c.texto, /Só 1 de 15 clientes ativos tem contrato cadastrado. A projeção usa a média do extrato para os outros 14\./);
  assert.ok(!ach.some((a) => a.id === 'folego'));
});

test('fin2: confiança cai com a cobertura de contratos abaixo de 70% da receita', () => {
  assert.equal(A.confianca(12, { cobertura_pct: 80, sem_contrato: 2 }).nivel, 'alta');
  assert.equal(A.confianca(12, { cobertura_pct: 50, sem_contrato: 3 }).nivel, 'media');
  assert.equal(A.confianca(6, { cobertura_pct: 50, sem_contrato: 3 }).nivel, 'baixa');
  assert.equal(A.confianca(12, { cobertura_pct: 20 }).nivel, 'baixa');
  assert.equal(A.confianca(12, { cobertura_pct: 20 }).motivo, 'os contratos cadastrados cobrem só 20% da receita recente');
  assert.equal(A.confianca(3).texto, 'base em 3 meses: confiança baixa', 'sem cobertura informada, como antes');
  assert.equal(A.confianca(0, { cobertura_pct: 0, sem_contrato: 5 }).nivel, 'nenhuma');
});

test('fin2: piso — sem motivo explícito, a receita projetada não fica muito abaixo da média recente', () => {
  // Contrato de R$ 1.000, mas o cliente pagou R$ 5.000 por mês: a média real manda (complemento até 90%).
  const lista = ['2026-09', '2026-10'].map((m) => lanc(`${m}-05`, 5000, 'receita_cliente', { cliente_id: '9' }));
  const p = { hoje: HOJE, saldo_hoje: 0, lista, meses_base: ['2026-09', '2026-10'], contratos: [{ cliente_id: '9', valor_mensal: 1000, dia_vencimento: 5 }], fixos: [], horizonte: 3 };
  const r = A.projecao3(p);
  assert.equal(r.premissas.receita.complemento, 3500);
  assert.equal(r.base.meses[1].entradas, 4500, 'dezembro: contrato + complemento = 90% da média');
  // Motivo explícito: o contrato acaba em dezembro. Janeiro perde o contrato, e o piso desconta essa perda.
  const fim = A.projecao3({ ...p, contratos: [{ ...p.contratos[0], fim: '2026-12-31' }] });
  assert.equal(fim.base.meses[2].entradas, 3500, 'janeiro: sem o contrato que acabou, só o complemento');
});

test('fin2: a receber não inventa vencido; margem não acusa prejuízo de quem não tem entrada ligada', () => {
  const ag = A.aging([{ cliente_id: '1', cliente_nome: 'Lyo', meses: [{ mes: '2026-09', em_aberto: 1200 }, { mes: '2026-10', em_aberto: 1200 }] }],
    CONTRATOS, { hoje: HOJE, semCliente: { '2026-09': 19900 } });
  assert.equal(ag.vencido, 1200, 'outubro sem entrada de cliente sem dono: vencido');
  assert.equal(ag.vencido_incerto, 1200, 'setembro tem Pix de cliente sem dizer de quem: pode já ter entrado');
  assert.equal(ag.itens.find((i) => i.mes === '2026-09').incerto, true);
  assert.deepEqual(A.semClientePorMes(extratoComoProducao())['2026-09'], 19900);
  const m = A.margemClientes([lanc('2026-10-20', -2000, 'salario'), lanc('2026-10-05', 3000, 'receita_cliente', { cliente_id: '2' })],
    { meses: ['2026-10'], pecas: [{ cliente_id: '2', mes: '2026-10', pecas: 1 }, { cliente_id: '7', mes: '2026-10', pecas: 3 }], nomes: { 7: 'Cliente 7' } });
  assert.deepEqual(m.prejuizo.map((x) => x.cliente_id), []);
  assert.deepEqual(m.sem_receita.map((x) => x.cliente_nome), ['Cliente 7']);
});

test('fin2: a tela (montarAnalise) e o PDF seguem as mesmas regras', () => {
  const base = { extrato: { transacoes: extratoComoProducao() }, fixos: [], salarios: {}, cartao: [], orcamento: {}, fechamentos: {}, metas: {} };
  const an = montarAnalise(base, { contratos: CONTRATOS, pecas: [], risco: [], pipeline: [], avisos: null }, { hoje: HOJE, saldo_hoje: 15000, serie: [], clientes_ativos: ATIVOS });
  assert.equal(an.confianca.nivel, 'baixa');
  assert.match(an.confianca.texto, /14 clientes sem contrato/);
  assert.equal(an.recorrente.mrr, 1200);
  assert.equal(an.recorrente.mrr_estimado, 30000);
  assert.equal(an.projecao.base.primeiro_dia_negativo, null);
  assert.equal(an.equilibrio.mrr, 30000, 'o equilíbrio pelo MRR estimado');
  assert.equal(an.equilibrio.mrr_contrato, 1200);
  assert.ok(an.achados.some((a) => a.id === 'contratos_cobertura'));
  assert.ok(!an.achados.some((a) => a.id === 'folego'));
  // O PDF (vybe-relatorio-financas.js, o mesmo de window.VybeFinancas.relatorio()).
  const ctx = vm.createContext({ console }); ctx.globalThis = ctx;
  vm.runInContext(readFileSync('vybe-relatorio-financas.js', 'utf8'), ctx);
  const rel = ctx.VybeRelatorioFinancas.montar({ hoje: HOJE, analise: an }, {});
  const num = (r) => rel.numeros.find((n) => n.rotulo === r);
  assert.equal(num('MRR de contrato').valor, 'R$ 1.200,00');
  assert.equal(num('MRR estimado').valor, 'R$ 30.000,00');
  assert.match(num('MRR de contrato').porque, /1 de 15 clientes ativos com contrato cadastrado/);
  assert.equal(num('Fôlego').valor, '12+ meses');
  assert.ok(!num('Saldo em 12 meses (base)').valor.startsWith('−'), num('Saldo em 12 meses (base)').valor);
  assert.match(num('Saldo em 12 meses (base)').porque, /confiança baixa, porque a projeção usa a média do extrato para 14 clientes sem contrato/);
  assert.match(rel.resumo, /A confiança é baixa porque a projeção usa a média do extrato para 14 clientes sem contrato/);
  const proj = rel.secoes.find((s) => /Projeção/.test(s.titulo));
  assert.match(proj.texto, /estimado pelo extrato/);
  assert.match(rel.resumo, /base em \d+ m[eê]s/, 'o teste antigo do resumo continua valendo');
});
