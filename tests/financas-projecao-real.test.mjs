// fin3 (26/11/2026): a projeção com os dados reais de produção ainda dava alarme falso depois do #784 (entradas de
// R$ 28,7 mil/mês, saídas de R$ 35,9 mil/mês, −R$ 76 mil em 12 meses e caixa negativo em 05/12). Duas causas:
//   1. julho, com só 2 lançamentos (o extrato começa no fim do mês), contava como mês fechado e diluía as médias;
//   2. os salários combinados somavam por cima de um variável que já tinha os salários dentro (o pagamento sai como
//      "outra saída" ou pró-labore sem pessoa ligada).
// Aqui, o mesmo caso com nomes e valores fictícios: extrato de 29/07 (2 lançamentos lançados à mão, sem saldo) e do
// banco a partir de 17/08 até 26/11; setembro e outubro cheios (entradas de R$ 45,7 mil e R$ 28,7 mil; saídas de
// R$ 30,0 mil e R$ 29,5 mil, com R$ 15,5 mil de Pix para o time pelo nome e pró-labore sem pessoa); 6 combinados que
// somam R$ 15.500 sem pessoa_id nos lançamentos; 1 contrato de R$ 1.200; saldo de hoje R$ 10 mil (o −R$ 76 mil em 12
// meses com −R$ 7,2 mil/mês dá um saldo de partida perto disso).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import A from '../shared/financeiro-analises.js';
import { montarAnalise, mesesDaBase } from '../server/financeiro-analise.js';

let seq = 0, saldo = 20000;
const lanc = (data, valor, categoria, { historico = categoria, comSaldo = true, ...real } = {}) => {
  if (comSaldo) saldo = Math.round((saldo + valor) * 100) / 100;
  return { id: `r${++seq}`, banco: { data, valor, historico, saldo: comSaldo ? saldo : null }, real: { categoria, status: 'ok', conferido: true, ...real } };
};

const HOJE = '2026-11-26';
// O time (fictício): 6 combinados, R$ 15.500 no total.
const TIME = [['p1', 'Ana Exemplo Lima', 3000], ['p2', 'Bruno Teste Costa', 2800], ['p3', 'Carla Modelo Dias', 2700], ['p4', 'Diego Amostra Reis', 2500],
  ['p5', 'Elisa Ficticia Rocha', 2500], ['p6', 'Fabio Simulado Nunes', 2000]];
const SALARIOS = Object.fromEntries(TIME.map(([id, , v]) => [id, { valor: v, desde: '2026-07' }]));
const PESSOAS = TIME.map(([id, nome]) => ({ id, nome }));
const ATIVOS = Array.from({ length: 10 }, (_, i) => ({ cliente_id: String(i + 1), cliente_nome: `Cliente ${i + 1}` }));
const CONTRATOS = [{ cliente_id: '1', cliente_nome: 'Cliente 1', valor_mensal: 1200, dia_vencimento: 10, inicio: '2026-11-01', fim: '', ativo: true }];
const FIXOS = [{ id: 'f1', nome: 'Aluguel', categoria: 'estrutura', valor: 1500, dia: 5, forma: 'pix', contem: 'aluguel', ativo: true }];

// Um mês cheio: entradas (o contrato, 4 clientes ligados e o resto como Pix de cliente sem dizer de quem) e saídas.
function mesCheio(m, { entradas, proLabore }) {
  const l = [];
  l.push(lanc(`${m}-01`, 12, 'rendimento', { historico: 'Rendimento aplicacao' }));
  l.push(lanc(`${m}-10`, 1200, 'receita_cliente', { historico: 'Pix Recebido Cliente Um', cliente_id: '1', cliente_nome: 'Cliente 1' }));
  for (const [id, v, d] of [['2', 3800, '05'], ['3', 3000, '08'], ['4', 2500, '12'], ['5', 2000, '15']]) l.push(lanc(`${m}-${d}`, v, 'receita_cliente', { historico: `Pix Recebido Cliente ${id}`, cliente_id: id, cliente_nome: `Cliente ${id}` }));
  const resto = Math.round((entradas - 12 - 1200 - 3800 - 3000 - 2500 - 2000) * 100) / 100;
  const parte = Math.floor(resto / 6 * 100) / 100;
  for (let k = 0; k < 6; k++) l.push(lanc(`${m}-${String(3 + k * 4).padStart(2, '0')}`, k < 5 ? parte : Math.round((resto - parte * 5) * 100) / 100, 'a_classificar', { historico: 'Pix Recebido Empresa Qualquer' }));
  // Saídas: o time pelo nome (outra saída, sem pessoa), pró-labore sem pessoa, o aluguel e o resto.
  for (const [, nome, v] of TIME) l.push(lanc(`${m}-05`, -v, 'outra_saida', { historico: `Pix Enviado ${nome}` }));
  l.push(lanc(`${m}-06`, -proLabore, 'pro_labore', { historico: 'Pix Enviado Socio Fulano' }));
  l.push(lanc(`${m}-05`, -1500, 'estrutura', { historico: 'Pagamento aluguel sala' }));
  for (const [d, v, c, h] of [['28', -4000, 'cartao_agencia', 'Pagamento fatura cartao'], ['20', -2500, 'impostos', 'DAS Simples'], ['12', -1200, 'ferramentas', 'Pix automatico enviado assinatura'],
    ['22', -800, 'combustivel', 'Posto']]) l.push(lanc(`${m}-${d}`, v, c, { historico: h }));
  return l;
}
function extratoComoProducao() {
  seq = 0; saldo = 20000;
  const l = [];
  // Julho: 2 lançamentos lançados à mão (sem saldo do banco), no fim do mês.
  l.push(lanc('2026-07-29', 3800, 'receita_cliente', { historico: 'Pix Recebido Cliente 2', cliente_id: '2', cliente_nome: 'Cliente 2', comSaldo: false }));
  l.push(lanc('2026-07-30', -350, 'ferramentas', { historico: 'Assinatura', comSaldo: false }));
  // Agosto: o extrato do banco começa em 17/08.
  l.push(lanc('2026-08-17', 3800, 'receita_cliente', { historico: 'Pix Recebido Cliente 2', cliente_id: '2', cliente_nome: 'Cliente 2' }));
  l.push(lanc('2026-08-20', 9000, 'a_classificar', { historico: 'Pix Recebido Empresa Qualquer' }));
  for (const [, nome, v] of TIME) l.push(lanc('2026-08-25', -v, 'outra_saida', { historico: `Pix Enviado ${nome}` }));
  l.push(lanc('2026-08-28', -2500, 'impostos', { historico: 'DAS Simples' }));
  l.push(...mesCheio('2026-09', { entradas: 45700, proLabore: 4500 }));
  l.push(...mesCheio('2026-10', { entradas: 28700, proLabore: 4000 }));
  // Novembro (o mês corrente) até 26/11.
  l.push(lanc('2026-11-05', 3800, 'receita_cliente', { historico: 'Pix Recebido Cliente 2', cliente_id: '2', cliente_nome: 'Cliente 2' }));
  l.push(lanc('2026-11-10', 1200, 'receita_cliente', { historico: 'Pix Recebido Cliente Um', cliente_id: '1', cliente_nome: 'Cliente 1' }));
  l.push(lanc('2026-11-14', 12000, 'a_classificar', { historico: 'Pix Recebido Empresa Qualquer' }));
  for (const [, nome, v] of TIME) l.push(lanc('2026-11-05', -v, 'outra_saida', { historico: `Pix Enviado ${nome}` }));
  l.push(lanc('2026-11-20', -4000, 'cartao_agencia', { historico: 'Pagamento fatura cartao' }));
  l.push(lanc('2026-11-26', -200, 'combustivel', { historico: 'Posto' }));
  return l.sort((a, b) => a.banco.data.localeCompare(b.banco.data));
}
const somaMes = (l, m, sinal) => Math.round(l.filter((t) => t.banco.data.startsWith(m) && Math.sign(t.banco.valor) === sinal).reduce((s, t) => s + t.banco.valor, 0) * 100) / 100;

test('fin3: a fixture é igual à produção (entradas e saídas reais de setembro e outubro)', () => {
  const l = extratoComoProducao();
  assert.equal(somaMes(l, '2026-09', 1), 45700);
  assert.equal(somaMes(l, '2026-10', 1), 28700);
  assert.equal(somaMes(l, '2026-09', -1), -30000);
  assert.equal(somaMes(l, '2026-10', -1), -29500);
  assert.equal(l.filter((t) => t.banco.data.startsWith('2026-07')).length, 2);
  assert.ok(!l.some((t) => t.real.pessoa_id), 'nenhum pagamento ligado à pessoa');
});

test('fin3: meses da base — julho (2 lançamentos) e agosto (desde 17/08) ficam fora; setembro e outubro entram', () => {
  const r = mesesDaBase(extratoComoProducao(), HOJE);
  assert.deepEqual(r.meses, ['2026-09', '2026-10']);
  assert.deepEqual(r.parciais, ['2026-07', '2026-08']);
  // Extrato que começa no dia 3 e vem colado de um mês para o outro: todos fechados, menos o corrente.
  const cheio = ['2026-08-03', '2026-08-28', '2026-09-02', '2026-09-29', '2026-10-04', '2026-10-30', '2026-11-03'].map((d, i) => ({ id: 'x' + i, banco: { data: d, valor: -1, saldo: 1 }, real: {} }));
  assert.deepEqual(mesesDaBase(cheio, HOJE).meses, ['2026-08', '2026-09', '2026-10']);
  // Buraco no meio do extrato (15/09 → 10/10): setembro e outubro não fecham.
  const buraco = ['2026-08-02', '2026-08-30', '2026-09-03', '2026-09-15', '2026-10-10', '2026-10-30', '2026-11-02'].map((d, i) => ({ id: 'y' + i, banco: { data: d, valor: -1, saldo: 1 }, real: {} }));
  assert.deepEqual(mesesDaBase(buraco, HOJE).meses, ['2026-08']);
});

function analise(base = {}) {
  const b = { extrato: { transacoes: extratoComoProducao() }, fixos: FIXOS, salarios: SALARIOS, cartao: [], orcamento: {}, fechamentos: {}, metas: {}, ...base };
  return montarAnalise(b, { contratos: CONTRATOS, pecas: [], risco: [], pipeline: [], avisos: null }, { hoje: HOJE, saldo_hoje: 10000, serie: [], clientes_ativos: ATIVOS, pessoas: PESSOAS });
}

for (const [rot, pessoas] of [['com os nomes das pessoas (pagamento identificado no Pix)', PESSOAS], ['sem os nomes (combinado considerado embutido)', []]]) {
  test(`fin3: caso igual à produção, ${rot} — saídas na média real, entradas na média, base positivo em dezembro`, () => {
    const b = { extrato: { transacoes: extratoComoProducao() }, fixos: FIXOS, salarios: SALARIOS, cartao: [], orcamento: {}, fechamentos: {}, metas: {} };
    const an = montarAnalise(b, { contratos: CONTRATOS, pecas: [], risco: [], pipeline: [], avisos: null }, { hoje: HOJE, saldo_hoje: 10000, serie: [], clientes_ativos: ATIVOS, pessoas });
    const pj = an.projecao, pr = pj.premissas;
    assert.deepEqual(an.meses_base, ['2026-09', '2026-10']);
    assert.deepEqual(pr.meses_base, ['2026-09', '2026-10']);
    assert.equal(pr.saidas_historicas_media, 29750, 'média real das saídas de setembro e outubro, com o cartão');
    assert.equal(pr.combinados, 15500);
    for (const m of pj.base.meses.slice(1)) assert.ok(m.saidas >= 27000 && m.saidas <= 33000, `saídas do base em ${m.mes}: ${m.saidas}`);
    assert.ok(Math.abs(pr.saidas_diferenca_pct) <= 10, `base ${pr.saidas_projetadas_base} × real ${pr.saidas_historicas_media}`);
    assert.equal(pr.variaveis_base, 12750, 'variável sem o aluguel e sem os R$ 15,5 mil do time');
    const mediaEntradas = (45700 + 28700) / 2;
    assert.ok(Math.abs(pr.receita.media_recente - mediaEntradas) < 1, `média recente ${pr.receita.media_recente}`);
    for (const m of pj.base.meses.slice(1, 4)) assert.ok(Math.abs(m.entradas - mediaEntradas) / mediaEntradas <= 0.12, `entradas do base em ${m.mes}: ${m.entradas}`);
    const dez = pj.base.meses.find((m) => m.mes === '2026-12');
    assert.ok(dez.menor_saldo >= 0, `dezembro: ${JSON.stringify(dez)}`);
    assert.ok(!pj.base.primeiro_dia_negativo || pj.base.primeiro_dia_negativo > '2026-12-31', pj.base.primeiro_dia_negativo);
    assert.ok(pj.base.saldo_final > 0, `saldo em 12 meses: ${pj.base.saldo_final}`);
    assert.equal(pj.confianca.nivel, 'baixa');
    assert.match(pj.confianca.texto, /base em 2 meses: confiança baixa · a projeção usa a média do extrato para 9 clientes sem contrato/);
    // O pessimista é pior que o base por uma margem explicada (média + 15% com 2 meses), sem os combinados duas vezes.
    assert.equal(pr.variaveis_alto, Math.round(12750 * 1.15 * 100) / 100);
    assert.match(pr.variaveis_alto_regra, /média \+ 15%/);
    const pm = pj.pessimista.meses[1];
    assert.ok(pm.saidas <= 29750 * 1.1, `pessimista ${pm.saidas}`);
    assert.ok(pj.pessimista.saldo_final <= pj.base.saldo_final && pj.base.saldo_final <= pj.otimista.saldo_final);
    // O equilíbrio usa o mesmo variável (sem soma dupla).
    assert.equal(an.equilibrio.custo_total, 1500 + 15500 + 12750);
    const cb = pr.combinados_detalhe;
    if (pessoas.length) {
      assert.deepEqual([cb.identificados, cb.embutidos, cb.novos], [6, 0, 0]);
      assert.ok(!an.achados.some((a) => a.id === 'salarios_sem_pessoa'));
    } else {
      assert.deepEqual([cb.identificados, cb.embutidos, cb.novos], [0, 6, 0]);
      assert.equal(cb.embutido_media, 15500);
      const ach = an.achados.find((a) => a.id === 'salarios_sem_pessoa');
      assert.ok(ach, JSON.stringify(an.achados.map((a) => a.id)));
      assert.match(ach.fazer, /Ligue os pagamentos de salário às pessoas para a projeção separar fixo e variável/);
    }
  });
}

test('fin3: combinado novo (desde depois da base) soma por cima; o resto não', () => {
  const sal = { ...SALARIOS, p7: { valor: 2200, desde: '2026-12' } };
  const an = analise({ salarios: sal });
  const pr = an.projecao.premissas;
  assert.equal(pr.combinados_detalhe.novos, 1);
  assert.equal(pr.combinados_detalhe.valor_novos, 2200);
  const dez = an.projecao.base.meses.find((m) => m.mes === '2026-12');
  assert.ok(Math.abs(dez.saidas - (29750 + 2200)) <= 1, `dezembro com o custo novo: ${dez.saidas}`);
});

test('fin3: CPF mascarado no histórico do Pix identifica o pagamento', () => {
  const l = [{ id: 'c1', banco: { data: '2026-10-05', valor: -3000, historico: 'Pix Enviado ***.456.789-** ', saldo: 1 }, real: { categoria: 'outra_saida', status: 'ok', conferido: true } },
    { id: 'c2', banco: { data: '2026-10-10', valor: -1000, historico: 'Posto', saldo: 1 }, real: { categoria: 'combustivel', status: 'ok', conferido: true } }];
  const d = A.variaveisDetalhe(l, ['2026-10'], { salarios: { p1: { valor: 3000 } }, pessoas: [{ id: 'p1', nome: 'Pessoa Sem Nome No Pix', cpf: '123.456.789-00' }] });
  assert.equal(d.combinados[0].situacao, 'identificado');
  assert.deepEqual([d.total[0], d.saidas[0]], [1000, 4000]);
});

test('fin3: a tela e o PDF mostram a conferência das saídas e os combinados', () => {
  const an = analise();
  const ctx = vm.createContext({ console }); ctx.globalThis = ctx;
  vm.runInContext(readFileSync('vybe-relatorio-financas.js', 'utf8'), ctx);
  const rel = ctx.VybeRelatorioFinancas.montar({ hoje: HOJE, analise: an }, {});
  const proj = rel.secoes.find((s) => /Projeção/.test(s.titulo));
  assert.match(proj.texto, /Saídas do base: R\$ 29\.750,00 por mês, contra R\$ 29\.750,00 de média real/);
  assert.match(proj.texto, /6 com o pagamento identificado no extrato, 0 considerado\(s\) já embutido\(s\)/);
  const num = (r) => rel.numeros.find((n) => n.rotulo === r);
  assert.ok(!num('Saldo em 12 meses (base)').valor.startsWith('−'), num('Saldo em 12 meses (base)').valor);
  assert.equal(num('Fôlego').valor, '12+ meses');
  const tela = readFileSync('vybe-mundo-financeiro.js', 'utf8');
  assert.match(tela, /Saídas do base:/);
  assert.match(tela, /considerados embutidos/);
  assert.match(tela, /pessoas: d\.pessoas \|\| \[\]/, 'o "E se" da tela também acha o pagamento pelo nome');
});
