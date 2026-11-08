// Nota de saúde, churn, cohort e contratos da Carteira (vybe-carteira-saude.js): funções puras.
// SAFE: roda num vm, sem rede nem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ctx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), ctx);
vm.runInContext(readFileSync('vybe-carteira-saude.js', 'utf8'), ctx);
const C = ctx.window.VybeCarteiraSaude;
const json = (x) => JSON.parse(JSON.stringify(x));
const calcular = (e) => json(C.calcular(e));

const HOJE = '2026-11-04'; // quarta; semana 02/11 a 08/11
const em = (iso, h = 10) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };
const CLIENTES = [
  { id: 1, nome: 'Alfa', ativo: true, status: 'Ativo', heads: 'Vinícius' },
  { id: 2, nome: 'Beta', ativo: true, status: 'Ativo', heads: 'Ewerton L., Vinícius', nps: 4, nps_em: '2026-10-01', ultima_reuniao: '2026-08-01' },
  { id: 3, nome: 'Gama', ativo: true, status: 'Ativo', heads: '', fim_contrato: '2026-11-20', pagamento_atrasado: true },
  { id: 4, nome: 'Inativa', ativo: false, status: 'Inativo', heads: 'Vinícius' },
];
let seq = 0;
const peca = (o = {}) => ({ id: `p${++seq}`, nome: `Peça ${seq}`, clientes: [o.cliente || 'Alfa'], status: 'A Fazer', veiculacao_iso: '', prazo_iso: '', ...o });
// Alfa em dia: 3 posts na semana, entregas no prazo, nada atrasado.
const emDia = (cliente) => [
  peca({ cliente, status: 'Agendado', veiculacao_iso: '2026-11-03', status_updated_at: em('2026-11-01') }),
  peca({ cliente, status: 'Em andamento', veiculacao_iso: '2026-11-06', status_updated_at: em('2026-11-03') }),
  peca({ cliente, status: 'Em andamento', veiculacao_iso: '2026-11-07', status_updated_at: em('2026-11-03') }),
  ...['2026-10-10', '2026-10-15', '2026-10-20', '2026-10-25'].map((v) => peca({ cliente, status: 'Finalizado', veiculacao_iso: v, status_updated_at: em(v) })),
  peca({ cliente, status: 'A Fazer', veiculacao_iso: '2026-11-11', prazo_iso: '2026-11-09', status_updated_at: em('2026-11-03') }),
];

test('cliente em dia fica perto de 100, risco baixo, com o que vai bem nos motivos', () => {
  const r = calcular({ demandas: emDia('Alfa'), clientes: CLIENTES, hoje: HOJE });
  const alfa = r.clientes.find((c) => c.nome === 'Alfa');
  assert.equal(alfa.score, 100);
  assert.equal(alfa.risco, 'baixo');
  assert.equal(alfa.nivel, 'u6');
  assert.deepEqual(alfa.heads, ['Vinícius']);
  assert.ok(alfa.motivos.every((m) => m.tom === 'bom'));
  assert.ok(alfa.motivos.some((m) => m.texto === '100% das entregas no prazo'));
  assert.ok(!r.clientes.some((c) => c.nome === 'Inativa'), 'só clientes ativos');
});

test('cada sinal tira pontos com teto e vira uma frase curta; lista do menor para o maior', () => {
  const demandas = [
    ...emDia('Alfa'),
    // Beta: 2 furos, 1 prazo vencido, aprovação parada 9 dias, 3 em alteração, nada na semana.
    peca({ cliente: 'Beta', status: 'Em andamento', veiculacao_iso: '2026-11-01', status_updated_at: em('2026-10-30') }),
    peca({ cliente: 'Beta', status: 'Em andamento', veiculacao_iso: '2026-11-02', status_updated_at: em('2026-10-30') }),
    peca({ cliente: 'Beta', status: 'Em andamento', prazo_iso: '2026-11-03', veiculacao_iso: '2026-11-20', status_updated_at: em('2026-10-30') }),
    peca({ cliente: 'Beta', status: 'Ag. Aprovação Cliente', veiculacao_iso: '2026-11-25', status_updated_at: em('2026-10-26') }),
    ...[1, 2, 3].map(() => peca({ cliente: 'Beta', status: 'Alteração', veiculacao_iso: '2026-11-28', status_updated_at: em('2026-11-03') })),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, hoje: HOJE });
  assert.deepEqual(r.clientes.map((c) => c.nome), ['Gama', 'Beta', 'Alfa'].sort((a, b) => r.clientes.find((c) => c.nome === a).score - r.clientes.find((c) => c.nome === b).score));
  const beta = r.clientes.find((c) => c.nome === 'Beta');
  const textos = beta.motivos.filter((m) => m.tom === 'ruim').map((m) => m.texto);
  assert.ok(textos.includes('2 peças com a veiculação vencida e 1 peça com o prazo interno vencido'), textos.join(' | '));
  assert.ok(textos.includes('3 peças em alteração agora'));
  assert.ok(textos.some((t) => t.startsWith('aprovação parada há 9 dias')));
  assert.ok(textos.includes('NPS 4 (detrator)'));
  assert.ok(textos.some((t) => t.startsWith('sem reunião há')));
  // 25 (atrasos) + 8 (alteração) + 12 (aprovação) + 4 (1/3 posts: o furo de 02/11 é desta semana) + 15 (NPS) + 6 (reunião) = 70
  assert.equal(beta.score, 30);
  assert.equal(beta.risco, 'alto');
  assert.equal(beta.nivel, 'u1');
  // Motivos ordenados do que mais pesou.
  const pesos = beta.motivos.filter((m) => m.tom === 'ruim').map((m) => m.pontos);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => a - b));
  // Gama: contrato vence em 16 dias e pagamento atrasado (campos opcionais), sem calendário.
  const gama = r.clientes.find((c) => c.nome === 'Gama');
  assert.ok(gama.motivos.some((m) => m.texto === 'contrato vence em 16 dias'));
  assert.ok(gama.motivos.some((m) => m.texto === 'pagamento em atraso'));
  assert.equal(gama.score, 100 - 15 - 20 - 12);
  assert.equal(r.fonte.contrato, true);
  assert.equal(r.fonte.sinais, 'tela');
});

test('sinais do servidor trocam alteração e aprovação; clima do grupo soma ou tira dentro de −20..+10', () => {
  const demandas = emDia('Alfa');
  const sinais = { porCliente: { 1: { ajustes30: 5, aprovacao_dias: 6.5 } } };
  let r = calcular({ demandas, clientes: CLIENTES, sinais, hoje: HOJE });
  let alfa = r.clientes.find((c) => c.nome === 'Alfa');
  assert.ok(alfa.motivos.some((m) => m.texto === '5 voltas para alteração em 30 dias' && m.pontos === -16));
  assert.ok(alfa.motivos.some((m) => m.texto === 'o cliente leva 7 dias para aprovar (mediana)' && m.pontos === -12));
  assert.equal(alfa.numeros.ajustesFonte, 'servidor');
  assert.equal(r.fonte.sinais, 'servidor');
  r = calcular({ demandas, clientes: CLIENTES, clima: { 1: { pontos: -40, motivo: 'cliente irritado no grupo', atualizado_em: em('2026-11-02') } }, hoje: HOJE });
  alfa = r.clientes.find((c) => c.nome === 'Alfa');
  assert.equal(alfa.score, 80, 'corta em −20');
  assert.ok(alfa.motivos.some((m) => m.texto === 'grupo: cliente irritado no grupo'));
  r = calcular({ demandas, clientes: CLIENTES, clima: { 1: { pontos: -10, motivo: 'velho', atualizado_em: em('2026-10-01') } }, hoje: HOJE });
  assert.equal(r.clientes.find((c) => c.nome === 'Alfa').score, 100, 'sinal com mais de 14 dias é ignorado');
  r = calcular({ demandas, clientes: CLIENTES, clima: { 3: { pontos: 10, motivo: 'elogiou a equipe' } }, hoje: HOJE });
  const gama = r.clientes.find((c) => c.nome === 'Gama');
  assert.equal(gama.score, 100 - 47 + 10);
  assert.ok(gama.motivos.some((m) => m.tom === 'bom' && m.texto === 'grupo: elogiou a equipe'));
});

test('média por head: cliente com dois heads conta para os dois; sem head por último', () => {
  const r = calcular({ demandas: emDia('Alfa'), clientes: CLIENTES, hoje: HOJE });
  const porHead = Object.fromEntries(r.heads.map((h) => [h.head, h]));
  const nota = (n) => r.clientes.find((c) => c.nome === n).score;
  assert.equal(porHead['Vinícius'].total, 2);
  assert.equal(porHead['Vinícius'].media, Math.round((nota('Alfa') + nota('Beta')) / 2));
  assert.equal(porHead['Ewerton L.'].total, 1);
  assert.equal(r.heads.at(-1).head, 'Sem head');
  assert.equal(r.resumo.total, 3);
});

test('período mensal e anual e variação contra o anterior', () => {
  const p = C.periodo('mensal', '2026-03');
  assert.equal(p.inicio, '2026-03-01');
  assert.equal(p.fim, '2026-03-31');
  assert.equal(p.anterior.inicio, '2026-02-01');
  assert.equal(p.anterior.fim, '2026-02-28');
  assert.equal(C.periodo('mensal', '2026-01').anterior.inicio, '2025-12-01');
  assert.equal(C.periodo('anual', '2026-07').anterior.fim, '2025-12-31');
  assert.equal(C.util.somarMeses('2026-01-31', 1), '2026-02-28');
  const v = json(C.variacao(4, 6, 'menor'));
  assert.equal(v.direcao, 'desce');
  assert.equal(v.bom, true);
  assert.equal(C.variacao(null, 3), null);
});

const BASE = [
  { id: '1', nome: 'Alfa', ativo: true, entrada: '2026-01-10', saida: null, valor: 2000 },
  { id: '2', nome: 'Beta', ativo: false, entrada: '2026-01-20', saida: '2026-03-05', valor: 1000, motivo_saida: 'achou caro' },
  { id: '3', nome: 'Gama', ativo: false, entrada: '2025-12-01', saida: '2026-03-20', valor: 1500 },
  { id: '4', nome: 'Delta', ativo: true, entrada: '2026-02-15', saida: null, valor: null },
  { id: '5', nome: 'Épsilon', ativo: false, entrada: '2026-02-01', saida: '2026-02-25', valor: 800 },
];

test('churn do mês: taxa, receita perdida, tempo até sair, principal motivo e o mês anterior', () => {
  const registros = [{ id: '9', cliente_id: '2', saiu_em: '2026-03-05', tipo: 'cancelamento', motivo: 'preco', detalhe: '', receita_mensal: 1100 }];
  const r = json(C.churn({ clientes: BASE, registros, tipo: 'mensal', mes: '2026-03' }));
  assert.equal(r.saidas, 2);
  // Ativos na véspera de 01/03: Alfa, Beta, Gama, Delta (Épsilon saiu em 25/02).
  assert.equal(r.ativosNoInicio, 4);
  assert.equal(r.taxa, 50);
  assert.equal(r.receitaPerdida, 1100 + 1500);
  assert.equal(r.principalMotivo.rotulo, 'Preço');
  assert.equal(r.semClassificar, 1);
  assert.equal(r.tempoMedioMeses, Math.round(((44 + 109) / 2 / 30.44) * 10) / 10);
  assert.equal(r.anterior.saidas, 1);
  assert.equal(r.variacao.saidas.direcao, 'sobe');
  assert.equal(r.variacao.saidas.bom, false);
  assert.equal(r.lista.find((s) => s.nome === 'Gama').classificado, false);
  const ano = json(C.churn({ clientes: BASE, registros, tipo: 'anual', mes: '2026-03' }));
  assert.equal(ano.saidas, 3);
  assert.equal(ano.todas.length, 3);
});

test('cohort: % que seguia ativo 1, 2, 3, 6 e 12 meses depois; futuro fica vazio', () => {
  const r = json(C.cohort({ clientes: BASE, hoje: '2026-05-10' }));
  const jan = r.linhas.find((l) => l.mes === '2026-01');
  assert.equal(jan.entraram, 2);
  assert.deepEqual(jan.colunas.map((c) => c.pct), [100, 50, 50, null, null]);
  const fev = r.linhas.find((l) => l.mes === '2026-02');
  // Épsilon (01/02 → 25/02) já tinha saído em 01/03; Delta (15/02) segue.
  assert.deepEqual(fev.colunas.map((c) => c.pct), [50, 50, null, null, null]);
  assert.equal(r.linhas[0].mes, '2026-02', 'mais recente primeiro');
});

test('contratos: renovação em breve, sem contrato e receita mensal ativa contra o mês anterior', () => {
  const contratos = [
    { cliente_id: '1', valor_mensal: 2500, inicio: '2026-01-10', renovacao: '2026-04-20', status: 'ativo' },
    { cliente_id: '4', valor_mensal: 700, inicio: '2026-02-15', renovacao: '2026-03-30', status: 'ativo' },
  ];
  const r = json(C.contratos({ clientes: BASE, contratos, hoje: '2026-04-05', tipo: 'mensal', mes: '2026-04' }));
  assert.deepEqual(r.emBreve.map((l) => l.nome), ['Alfa']);
  assert.deepEqual(r.vencidas.map((l) => l.nome), ['Delta']);
  assert.equal(r.semContrato, 0);
  assert.equal(r.receita, 3200);
  // Fim de março: Alfa e Delta ativos (Beta e Gama saíram em março).
  assert.equal(r.receitaAnterior, 3200);
  const fev = json(C.contratos({ clientes: BASE, contratos, hoje: '2026-04-05', tipo: 'mensal', mes: '2026-03' }));
  assert.equal(fev.receitaAnterior, 2500 + 1000 + 1500 + 700);
  assert.equal(fev.variacao.receita.bom, false);
});

test('histórico mensal: troca o mês corrente pela conta de agora e compara com o anterior', () => {
  const r = json(C.historicoSaude({ meses: [{ mes: '2026-09-01', media: 70, alto: 3 }, { mes: '2026-10-01', media: 74, alto: 2 }, { mes: '2026-11-01', media: 10, alto: 9 }],
    atual: { media: 78, alto: 1, total: 20 }, hoje: '2026-11-04' }));
  assert.deepEqual(r.serie.map((m) => m.media), [70, 74, 78]);
  assert.equal(r.anterior.mes, '2026-10-01');
  assert.equal(r.variacao.media.delta, 4);
  assert.equal(r.variacao.media.bom, true);
});

test('desempenho: 2.000 peças sem travar a tela (folga para máquina carregada: 2 s)', () => {
  const muitas = Array.from({ length: 2000 }, (_, i) => peca({ cliente: ['Alfa', 'Beta', 'Gama'][i % 3], status: i % 5 ? 'Em andamento' : 'Finalizado',
    veiculacao_iso: `2026-${String(9 + (i % 3)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, status_updated_at: em('2026-10-20') }));
  const t0 = performance.now();
  C.calcular({ demandas: muitas, clientes: CLIENTES, hoje: HOJE });
  assert.ok(performance.now() - t0 < 2000);
});
