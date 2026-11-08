// Contas puras do setor de Pessoas (shared/pessoas-calculos.js). SAFE: sem banco, sem rede.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import C from '../shared/pessoas-calculos.js';

test('score: média ponderada só dos componentes com dado', () => {
  const f = { entregues: 10, comData: 10, noPrazo: 8, ajustes: 2, atrasadas: 0, meta: 20 };
  const r = C.pontuar(f, C.PESOS_PADRAO);
  // prazo .8, volume .5, ajustes .8, atrasos 1 → (35*.8+30*.5+20*.8+15*1)/100
  assert.equal(r.score, 74);
  assert.equal(C.pontuar({ entregues: 0, atrasadas: 0, meta: 0 }, C.PESOS_PADRAO).score, null, 'sem dado nenhum, sem score');
  // Sem histórico de ajustes: o peso dele sai da conta (não vira zero).
  const semAjuste = C.pontuar({ ...f, ajustes: null }, C.PESOS_PADRAO);
  assert.equal(semAjuste.componentes.ajustes, null);
  assert.equal(semAjuste.score, Math.round((35 * .8 + 30 * .5 + 15) / 80 * 100));
  assert.equal(C.pontuar(f, { prazo: 100, volume: 0, ajustes: 0, atrasos: 0 }).score, 80);
  assert.equal(C.pontuar({ entregues: 30, comData: 0, meta: 20 }, C.PESOS_PADRAO).componentes.volume, 1, 'volume no máximo 1');
  assert.equal(C.pontuar({ entregues: 2, comData: 2, noPrazo: 2, ajustes: 5 }, C.PESOS_PADRAO).componentes.ajustes, 0, 'ajustes no mínimo 0');
});

test('pesos e metas: validação para quem edita, normalização para quem lê', () => {
  assert.equal(C.validarPesos({ prazo: 50, volume: 50, ajustes: 0, atrasos: 0 }), '');
  assert.match(C.validarPesos({ prazo: 0, volume: 0, ajustes: 0, atrasos: 0 }), /maior que zero/);
  assert.match(C.validarPesos({ prazo: 1.5, volume: 0, ajustes: 0, atrasos: 0 }), /inteiro/);
  assert.match(C.validarPesos({ prazo: 101, volume: 0, ajustes: 0, atrasos: 0 }), /0 a 100/);
  assert.deepEqual(C.normalizarPesos({ prazo: 0, volume: 0, ajustes: 0, atrasos: 0 }), C.PESOS_PADRAO);
  assert.equal(C.validarMetas({ ...C.METAS_PADRAO }), '');
  assert.match(C.validarMetas({ ...C.METAS_PADRAO, criacao: -1 }), /Criação/);
});

test('meta proporcional ao mês corrente; mês passado vale inteira', () => {
  assert.equal(C.metaProporcional(30, '2026-11', '2026-11-15'), 15);
  assert.equal(C.metaProporcional(30, '2026-10', '2026-11-15'), 30);
  assert.equal(C.metaProporcional(30, '2026-11', '2026-11-01'), 1);
  assert.equal(C.metaProporcional(0, '2026-11', '2026-11-15'), 0);
});

test('ranking: ordem por score, sem posição para quem não tem dado; conquistas só positivas', () => {
  const lista = C.ranking([
    { id: '1', nome: 'Ana', entregues: 10, comData: 10, noPrazo: 10, ajustes: 0, atrasadas: 0, meta: 10 },
    { id: '2', nome: 'Bia', entregues: 4, comData: 4, noPrazo: 2, ajustes: 1, atrasadas: 2, meta: 10 },
    { id: '3', nome: 'Caio', entregues: 0, comData: 0, noPrazo: 0, ajustes: null, atrasadas: 0, meta: 0 },
  ], C.PESOS_PADRAO);
  assert.deepEqual(lista.map((p) => [p.id, p.posicao]), [['1', 1], ['2', 2], ['3', null]]);
  assert.deepEqual(lista[0].conquistas.map((c) => c.id), ['pontual', 'meta', 'capricho', 'em_dia', 'destaque']);
  assert.deepEqual(lista[1].conquistas, []);
  assert.ok(lista[0].frases.includes('nada atrasado na fila'));
});

test('carga da semana: peças da semana, atrasadas e etapas com esforço; nível pela capacidade', () => {
  const pessoas = [{ id: '1', nome: 'Ana' }, { id: '2', nome: 'Bia' }];
  const pecas = [{ pessoa_id: '1', data: '2026-11-09' }, { pessoa_id: '1', data: '2026-11-05' }, { pessoa_id: '1', data: '2026-11-20' }, { pessoa_id: '9', data: '2026-11-09' }];
  const etapas = [{ responsavel: '1', inicio: '2026-11-01', fim: '2026-11-10', esforco: 3 }, { responsavel: '1', inicio: '2026-11-01', fim: '2026-11-10', feita: true }, { responsavel: '2', inicio: '2026-11-16', fim: '2026-11-20' }];
  const c = C.cargaDaSemana({ pessoas, pecas, etapas, inicio: '2026-11-09', capacidade: 4 });
  assert.deepEqual(c[0], { id: '1', nome: 'Ana', pecas: 1, atrasadas: 1, etapas: 3, total: 5, pct: 125, nivel: 'sobrecarregada' });
  assert.equal(c[1].nivel, 'leve');
});

test('linha do tempo: semanas inteiras, posições em % e etapa atrasada', () => {
  const l = C.linhaDoTempo([{ id: '1', inicio: '2026-11-09', fim: '2026-11-15', etapas: [{ inicio: '2026-11-09', fim: '2026-11-10', feita: false }] }], '2026-11-12');
  assert.equal(l.de, '2026-11-09'); assert.equal(l.ate, '2026-11-15'); assert.equal(l.dias, 7);
  assert.deepEqual(l.projetos[0].pos, { esq: 0, larg: 100 });
  assert.equal(l.projetos[0].etapas[0].atrasada, true);
  assert.deepEqual(C.linhaDoTempo([], null).projetos, []);
});

test('RH: SLA em dias úteis e situação; trimestre', () => {
  assert.equal(C.prazoSla('documento', '2026-11-06'), '2026-11-10', 'sexta + 2 úteis = terça');
  assert.equal(C.prazoSla('desconhecido', '2026-11-09'), '2026-11-12');
  assert.equal(C.situacaoSla({ status: 'aberto', prazo: '2026-11-06' }, '2026-11-07'), 'atrasado');
  assert.equal(C.situacaoSla({ status: 'aberto', prazo: '2026-11-07' }, '2026-11-07'), 'vence_hoje');
  assert.equal(C.situacaoSla({ status: 'resolvido', prazo: '2026-11-01' }, '2026-11-07'), 'encerrado');
  assert.equal(C.trimestreDe('2026-11-07'), '2026-T4'); assert.equal(C.trimestreDe('2026-01-01'), '2026-T1');
});

test('clima: nada sai abaixo de 3 respostas; eNPS e médias quando libera', () => {
  const r = (enps) => ({ enps, lideranca: 4, ambiente: 5, crescimento: 3, processos: 2, beneficios: 1 });
  assert.deepEqual(C.agregarClima([r(10), r(0)]), { respostas: 2, minimo: 3, liberado: false });
  const a = C.agregarClima([r(10), r(9), r(0), r(7)]);
  assert.equal(a.enps, 25); assert.equal(a.promotores, 2); assert.equal(a.detratores, 1);
  assert.deepEqual(a.dimensoes.map((d) => d.media), [4, 5, 3, 2, 1]);
  assert.equal(C.validarResposta({ ...r(5) }), '');
  assert.match(C.validarResposta({ ...r(5), ambiente: 0 }), /Ambiente/);
});

test('visão geral de RH: headcount, admissões, desligamentos e tempo de casa com o anterior', () => {
  const p = C.periodoDe('mensal', '2026-11');
  assert.deepEqual([p.de, p.ate, p.antes.de, p.antes.ate], ['2026-11-01', '2026-11-30', '2026-10-01', '2026-10-31']);
  const r = C.indicadoresRh([
    { id: 1, entrada: '2025-11-01', saida: null }, { id: 2, entrada: '2026-11-03', saida: null },
    { id: 3, entrada: '2024-01-01', saida: '2026-11-10' }, { id: 4, entrada: null, saida: null },
  ], p);
  assert.deepEqual(r.atual, { headcount: 3, admissoes: 1, desligamentos: 1, tempoMedioMeses: r.atual.tempoMedioMeses });
  assert.equal(r.antes.headcount, 3);
  assert.deepEqual(r.vs.admissoes, { delta: 1, pct: null });
  assert.equal(C.periodoDe('anual', '2026-05').antes.de, '2025-01-01');
});

test('recrutamento e documentos', () => {
  assert.equal(C.validarEtapas(['A', 'B']), ''); assert.match(C.validarEtapas(['A', 'a']), /repetidas/); assert.match(C.validarEtapas(['A']), /2 a 10/);
  assert.deepEqual(C.tempoMedioContratacao([{ criado_em: '2026-11-01', contratado_em: '2026-11-11' }, { criado_em: '2026-11-01', contratado_em: '2026-11-21' }, { criado_em: '2026-11-01' }]), { dias: 15, contratacoes: 2 });
  assert.equal(C.situacaoDocumento({ renovacao: '2026-11-20' }, '2026-11-07'), 'renovar');
  assert.equal(C.situacaoDocumento({ renovacao: '2026-11-01' }, '2026-11-07'), 'vencido');
  assert.equal(C.situacaoDocumento({ renovacao: '2027-11-01' }, '2026-11-07'), 'em_dia');
  assert.equal(C.situacaoDocumento({ renovacao: '2026-11-01', status: 'encerrado' }, '2026-11-07'), 'encerrado');
});

test('no navegador o módulo vira window.VybePessoasCalculos', () => {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync('shared/pessoas-calculos.js', 'utf8'), ctx);
  assert.equal(typeof ctx.VybePessoasCalculos.pontuar, 'function');
});
