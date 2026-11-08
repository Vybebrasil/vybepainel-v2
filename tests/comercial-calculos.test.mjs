// Contas do Comercial (shared/comercial-calculos.js): funções puras, as mesmas do servidor e da tela. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import calc from '../shared/comercial-calculos.js';

test('no navegador fica em window.VybeComercialCalculos (sem module)', () => {
  const ctx = vm.createContext({}); vm.runInContext(readFileSync('shared/comercial-calculos.js', 'utf8'), ctx);
  assert.equal(typeof ctx.VybeComercialCalculos.resumoFunil, 'function');
});

test('pacote: custo = horas × custo/hora + captações × custo; margem e zona crítica', () => {
  const p = calc.pacoteComMargem({ preco: 2000, horas: 20, custo_hora: 50, captacoes: 2, custo_captacao: 150 });
  assert.equal(p.custo, 1300); assert.equal(p.margem, 700); assert.equal(p.margem_percentual, 35); assert.equal(p.zona_critica, false);
  assert.equal(calc.pacoteComMargem({ preco: 1000, horas: 17, custo_hora: 50 }).zona_critica, true); // 15%
  assert.equal(calc.pacoteComMargem({ preco: 1000, horas: 16, custo_hora: 50 }).zona_critica, false); // 20% exatos não é crítico
  assert.equal(calc.pacoteComMargem({ preco: 0 }).margem_percentual, null);
  assert.equal(calc.custoPacote({ horas: 3, custo_hora: 0.1 }), 0.3); // sem erro de ponto flutuante
});

test('finanças por cliente: sem pacote não inventa custo; resumo conta zona crítica e pagamento', () => {
  assert.deepEqual(calc.financasCliente({ valor_mensal: 1500 }).sem_pacote, true);
  const f = calc.financasCliente({ valor_mensal: 2000, pacote: { horas: 30, custo_hora: 55 } });
  assert.equal(f.custo, 1650); assert.equal(f.margem_percentual, 17.5); assert.equal(f.zona_critica, true);
  const r = calc.resumoFinancas([{ valor_mensal: 2000, pacote: { horas: 30, custo_hora: 55 }, status_pagamento: 'atrasado' }, { valor_mensal: 1000, pacote: { horas: 2, custo_hora: 50 }, status_pagamento: 'em_dia' }]);
  assert.equal(r.receita, 3000); assert.equal(r.custo, 1750); assert.equal(r.criticas, 1); assert.deepEqual(r.pagamento, { em_dia: 1, atrasado: 1, inadimplente: 0 });
});

test('motivo de perda: lista fechada e "outro" exige texto', () => {
  assert.throws(() => calc.validarMotivoPerda('', ''), /motivo/);
  assert.throws(() => calc.validarMotivoPerda('outro', '  '), /Outro/);
  assert.equal(calc.validarMotivoPerda('sem_verba').motivo_nome, 'Sem verba');
});

test('funil: fases, conversão, valor em negociação, motivos e etapas configuradas', () => {
  const ops = [
    { etapa: 'empresa' }, { etapa: 'contato_feito', valor_mensal: 1000 }, { etapa: 'proposta_comercial', valor_mensal: 2000, valor_avulso: 500 },
    { etapa: 'ganho', valor_mensal: 1500, pacote_id: 1 }, { etapa: 'perdido', etapa_antes_perda: 'reuniao', motivo_perda: 'preco' },
    { etapa: 'perdido', etapa_antes_perda: null },
  ];
  const r = calc.resumoFunil(ops);
  const f = Object.fromEntries(r.fases.map((x) => [x.id, x]));
  assert.equal(f.novo.alcancaram, 6); assert.equal(f.primeiro_contato.alcancaram, 4); assert.equal(f.apresentacao.alcancaram, 3);
  assert.equal(f.proposta.alcancaram, 2); assert.equal(f.ganho.alcancaram, 1);
  assert.equal(f.novo.conversao, 66.7); assert.equal(f.apresentacao.conversao, 66.7); assert.equal(f.ganho.conversao, null);
  assert.deepEqual(r.em_negociacao, { quantidade: 3, mensal: 3000, avulso: 500 });
  assert.equal(r.taxa_ganho, 33.3);
  assert.equal(r.motivos_perda.find((m) => m.id === 'preco').percentual, 50);
  assert.equal(r.motivos_perda.find((m) => m.id === 'sem_registro').quantidade, 1);
  const fases = calc.montarFases([{ id: 'empresa' }, { id: 'reuniao', nome: 'Reunião' }, { id: 'x_visita', nome: 'Visita', extra: true }, { id: 'contato_feito' }, { id: 'ganho' }, { id: 'perdido' }]);
  assert.deepEqual(fases.map((x) => x.nome), ['Novo', 'Apresentação', 'Visita', 'Primeiro contato', 'Ganho', 'Perdido']);
  const r2 = calc.resumoFunil([{ etapa: 'x_visita' }, { etapa: 'ganho' }], fases);
  assert.equal(r2.fases.find((x) => x.id === 'x_visita').alcancaram, 2); assert.equal(r2.em_negociacao.quantidade, 1);
});

test('produto campeão e ticket médio a partir dos ganhos', () => {
  const p = calc.produtoCampeao([
    { etapa: 'ganho', pacote_id: 1, valor_mensal: 1000 }, { etapa: 'ganho', pacote_id: 2, valor_mensal: 3000, valor_avulso: 800 },
    { etapa: 'ganho', pacote_id: 1, valor_mensal: 2000 }, { etapa: 'perdido', pacote_id: 2 },
  ], [{ id: 1, nome: 'Social' }, { id: 2, nome: 'Premium' }]);
  assert.equal(p.campeao.nome, 'Social'); assert.equal(p.campeao.ganhos, 2); assert.equal(p.ticket_medio_mensal, 2000); assert.equal(p.ticket_medio_avulso, 800);
  assert.equal(calc.produtoCampeao([], []).campeao, null);
});

test('orçamento: subtotal por tipo, desconto nos dois e limites', () => {
  const t = calc.totalOrcamento({ itens: [{ tipo: 'recorrente', preco: 2000, quantidade: 1 }, { tipo: 'avulso', preco: 800, quantidade: 2 }], desconto_percentual: 10 });
  assert.deepEqual([t.subtotal_recorrente, t.subtotal_avulso, t.desconto, t.total_recorrente, t.total_avulso, t.total], [2000, 1600, 360, 1800, 1440, 3240]);
  assert.equal(calc.totalOrcamento({ itens: [{ tipo: 'avulso', preco: 100, quantidade: 1 }], desconto_percentual: 150 }).total, 0);
});

test('creators: filtro por nicho e cidade sem acento, @ opcional, mais seguidores primeiro', () => {
  const l = [{ nome: 'Ana', arroba: 'ana', seguidores: 100, nicho: 'Moda', cidade: 'Irecê' }, { nome: 'Bruno', arroba: 'bru', seguidores: 900, nicho: 'moda', cidade: 'Lapão' },
    { nome: 'Caio', arroba: 'caio', seguidores: 50, nicho: 'Comida', cidade: 'Irece' }];
  assert.deepEqual(calc.filtrarCreators(l, { nicho: 'MODA' }).map((x) => x.nome), ['Bruno', 'Ana']);
  assert.deepEqual(calc.filtrarCreators(l, { cidade: 'irecê' }).map((x) => x.nome), ['Ana', 'Caio']);
  assert.deepEqual(calc.filtrarCreators(l, { busca: '@bru' }).map((x) => x.nome), ['Bruno']);
  assert.deepEqual(calc.opcoesCreators(l).nichos.length, 2);
});

test('período, status do recebível, totais com "vs anterior" e virada de ano', () => {
  const p = calc.periodo('2026-01');
  assert.deepEqual([p.inicio, p.fim, p.anterior.inicio, p.anterior.fim], ['2026-01-01', '2026-01-31', '2025-12-01', '2025-12-31']);
  assert.equal(calc.periodo('2026-03', 'anual').anterior.inicio, '2025-01-01');
  assert.throws(() => calc.periodo('2026-13'), /Mês inválido/);
  assert.equal(calc.proximoVencimento('2026-01-31', 'mensal'), '2026-02-28');
  assert.equal(calc.proximoVencimento('2026-11-10', 'trimestral'), '2027-02-10');
  const hoje = '2026-01-20';
  assert.equal(calc.statusRecebivel({ valor: 100, valor_recebido: 100, vencimento: '2025-01-01' }, hoje).status, 'recebido');
  assert.equal(calc.statusRecebivel({ valor: 100, valor_recebido: 30, vencimento: '2026-01-25' }, hoje).status, 'parcial');
  assert.equal(calc.statusRecebivel({ valor: 100, vencimento: '2026-01-20' }, hoje).status, 'pendente');
  assert.equal(calc.statusRecebivel({ valor: 100, vencimento: '2025-12-21' }, hoje).status, 'atrasado'); // 30 dias
  assert.equal(calc.statusRecebivel({ valor: 100, vencimento: '2025-12-20' }, hoje).status, 'inadimplente'); // 31 dias
  const r = calc.resumoRecebimentos([
    { valor: 1000, valor_recebido: 1000, vencimento: '2026-01-05' }, { valor: 500, vencimento: '2026-01-30' }, { valor: 200, vencimento: '2026-01-10', cancelado: true },
    { valor: 800, vencimento: '2025-12-01' }, { valor: 400, valor_recebido: 400, vencimento: '2025-12-15' },
  ], p, hoje);
  assert.deepEqual(r.atual, { a_receber: 1500, recebido: 1000, pendente: 500, inadimplente: 0, quantidade: 2 });
  assert.deepEqual(r.anterior, { a_receber: 1200, recebido: 400, pendente: 0, inadimplente: 800, quantidade: 2 });
  assert.equal(r.variacao.a_receber, 25); assert.equal(r.variacao.inadimplente, -100);
});

test('contas a pagar: grupos com % do faturamento, 7 dias, vencidas, fixo × variável', () => {
  const p = calc.periodo('2026-11'), hoje = '2026-11-07';
  const contas = [
    { grupo: 'fixa', valor: 1000, vencimento: '2026-11-10' }, { grupo: 'folha', valor: 3000, vencimento: '2026-11-05', pago_em: '2026-11-05' },
    { grupo: 'variavel', valor: 500, vencimento: '2026-11-14' }, { grupo: 'imposto', valor: 500, vencimento: '2026-11-15' },
    { grupo: 'investimento', valor: 1000, vencimento: '2026-11-03' }, { grupo: 'fixa', valor: 999, vencimento: '2026-11-08', cancelada: true },
    { grupo: 'fixa', valor: 800, vencimento: '2026-10-10' },
  ];
  const r = calc.resumoContas(contas, p, hoje, 10000, 5000);
  const g = Object.fromEntries(r.grupos.map((x) => [x.id, x]));
  assert.equal(r.total, 6000); assert.equal(g.folha.percentual_faturamento, 30); assert.equal(g.fixa.variacao, 25);
  assert.equal(r.fixo, 4000); assert.equal(r.variavel, 2000); assert.equal(r.fixo_percentual, 66.7);
  assert.deepEqual([r.sete_dias.quantidade, r.sete_dias.total], [2, 1500]); // 10/11 e 14/11; o de 15/11 passa de 7 dias
  assert.deepEqual([r.vencidas.quantidade, r.vencidas.total], [2, 1800]);
  assert.equal(r.pago, 3000); assert.equal(r.resultado, 4000);
});

test('inadimplência: por cliente, atraso mais antigo e severidade pela escala de urgência', () => {
  const hoje = '2026-11-07';
  const r = calc.inadimplencia([
    { cliente_id: 1, cliente_nome: 'Hebravet', valor: 1000, vencimento: '2026-09-30' }, { cliente_id: 1, cliente_nome: 'Hebravet', valor: 1000, valor_recebido: 400, vencimento: '2026-10-30' },
    { cliente_id: 2, cliente_nome: 'DiaLab', valor: 300, vencimento: '2026-11-03' }, { cliente_id: 3, valor: 300, vencimento: '2026-11-07' },
    { cliente_id: 4, valor: 300, vencimento: '2026-10-01', cancelado: true },
  ], hoje);
  assert.deepEqual(r.clientes.map((c) => [c.cliente_nome, c.valor, c.atraso_mais_antigo, c.severidade.nivel]), [['Hebravet', 1600, 38, 'u1'], ['DiaLab', 300, 4, 'u3']]);
  assert.equal(r.faturas.length, 3); assert.equal(r.total, 1900); assert.equal(r.criticos, 1);
  assert.equal(calc.severidade(10).nivel, 'u2');
});

test('fornecedores: filtro por categoria e busca', () => {
  const l = [{ nome: 'Gráfica Irecê', categoria: 'grafica' }, { nome: 'Áudio Sertão', categoria: 'audiovisual', contato: 'zé' }];
  assert.deepEqual(calc.filtrarFornecedores(l, { categoria: 'grafica' }).map((f) => f.nome), ['Gráfica Irecê']);
  assert.deepEqual(calc.filtrarFornecedores(l, { busca: 'audio' }).map((f) => f.nome), ['Áudio Sertão']);
  assert.equal(calc.CATEGORIAS_FORNECEDOR.length, 11);
});

test('previsão de caixa: recorrentes projetados, fixas e folha, mês estimado e alerta de churn acima de 15%', () => {
  const r = calc.previsaoCaixa({
    hoje: '2026-11-07',
    recebiveis: [
      { tipo: 'recorrente', cliente_id: '1', ciclo: 'mensal', valor: 3000, vencimento: '2026-11-10' },
      { tipo: 'recorrente', cliente_id: '2', ciclo: 'trimestral', valor: 1200, vencimento: '2026-10-05' },
      { tipo: 'recorrente', cliente_id: '3', ciclo: 'mensal', valor: 500, vencimento: '2026-11-01', cliente_nome: 'Padaria Sol' },
      { tipo: 'pontual', valor: 9999, vencimento: '2026-11-20' }, { tipo: 'recorrente', cliente_id: '9', ciclo: 'mensal', valor: 7777, vencimento: '2026-11-02', cancelado: true },
    ],
    contas: [{ grupo: 'fixa', valor: 1000, vencimento: '2026-11-05' }, { grupo: 'folha', valor: 1500, vencimento: '2026-11-30' }, { grupo: 'folha', valor: 1600, vencimento: '2026-12-30' }],
    churn: [{ cliente_id: '1', risco: 'alto' }, { nome: 'Padaria Sol', risco: 'Alto' }, { cliente_id: '2', risco: 'baixo' }],
  });
  assert.deepEqual(r.meses.map((m) => [m.mes, m.entradas, m.saidas, m.saldo, m.saidas_estimadas]), [
    ['2026-11', 3500, 2500, 1000, false], ['2026-12', 3500, 1600, 1900, false], ['2027-01', 4700, 2500, 2200, true], ['2027-02', 3500, 2500, 1000, true]]);
  assert.deepEqual(r.alertas.map((a) => [a.cliente_id ?? a.cliente_nome, a.percentual]), [['1', 85.7]]); // a Padaria é 14,3%: abaixo do limite
});

test('capacidade × vendas: cabe, aperta e estoura pelas cores de urgência', () => {
  const pessoas = [{ id: '1', monday_user_id: '100', cargo: 'criacao' }, { id: '2', cargo: 'producao' }, { id: '3' }];
  const demandas = [{ responsavel_ids: ['100'] }, { responsavel_ids: ['100', '2'] }, { responsavel_id: '1', aberta: false }, { responsavel_ids: ['3'] }, { responsavel_ids: ['100', '100'] }];
  const base = { capacidades: { criacao: 10, producao: 2 }, pessoas, demandas };
  let r = calc.capacidadeTime(base);
  assert.equal(r.cargos.find((c) => c.cargo === 'criacao').carga_atual, 3); assert.equal(r.sem_cargo, 1); assert.equal(r.estado, 'cabe');
  r = calc.capacidadeTime({ ...base, acrescimo: calc.cargaDosItens([{ carga: { criacao: 3 }, quantidade: 2 }]) });
  assert.equal(r.cargos.find((c) => c.cargo === 'criacao').uso, 90); assert.deepEqual([r.estado, r.urgencia, r.rotulo], ['aperta', 'u2', 'Aperta']);
  r = calc.capacidadeTime({ ...base, acrescimo: { criacao: 8 } }); assert.deepEqual([r.estado, r.urgencia], ['estoura', 'u1']);
  r = calc.capacidadeTime({ ...base, acrescimo: { gestao: 1 } }); assert.equal(r.estado, 'estoura'); // sem capacidade configurada
  r = calc.capacidadeTime({ ...base, acrescimo: { producao: 0, criacao: 1 } }); assert.deepEqual([r.estado, r.urgencia], ['cabe', 'u6']);
});

test('ROI do orçamento: lucro por venda, vendas para pagar a Vybe e retorno', () => {
  const r = calc.roiCampanha({ investimento: '2.500', ticket: '180', margem: '35', vendas: '60' });
  assert.equal(r.lucroPorVenda, 63);
  assert.equal(r.empate, 40); // 2500 / 63 = 39,7 → 40 vendas
  assert.equal(r.faturamento, 10800); assert.equal(r.lucro, 3780);
  assert.equal(r.roi, 51.2);
  assert.equal(calc.roiCampanha({ investimento: 2500, ticket: 180, margem: 35 }).roi, null); // sem estimativa de vendas: só o empate
  assert.equal(calc.roiCampanha({ investimento: 2500, ticket: 180, margem: 0 }).empate, null);
  for (const ruim of [{}, { investimento: 0, ticket: 10, margem: 10 }, { investimento: 100, ticket: 10, margem: 120 }, { investimento: 'abc', ticket: 10, margem: 10 }]) assert.equal(calc.roiCampanha(ruim), null);
});
