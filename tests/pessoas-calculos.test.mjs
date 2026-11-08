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

test('RH 08/11: prazos configuráveis em dias úteis, dias úteis entre datas e números da fila', () => {
  // Padrões e o que os donos mudam (valor inválido volta ao padrão).
  assert.equal(C.normalizarPrazos({}).documento, 2);
  assert.equal(C.normalizarPrazos({ documento: 4, reembolso: 0, outro: 1.5 }).documento, 4);
  assert.equal(C.normalizarPrazos({ reembolso: 0 }).reembolso, 3, 'zero não vale');
  assert.equal(C.normalizarPrazos({ outro: 1.5 }).outro, 3, 'fração não vale');
  assert.equal(C.validarPrazos({ ferias: 5, documento: 2, reembolso: 3, equipamento: 3, outro: 3 }), '');
  assert.match(C.validarPrazos({ ferias: 5, documento: 31, reembolso: 3, equipamento: 3, outro: 3 }), /Documento.*1 a 30/);
  assert.match(C.validarPrazos({ ferias: 5, documento: 2, equipamento: 3, outro: 3 }), /Reembolso/);
  assert.deepEqual([...C.TIPOS_PEDIDO], ['ferias', 'documento', 'reembolso', 'equipamento', 'outro']);
  // Prazo com o configurado: sexta + 4 úteis = quinta; sábado + 1 útil = segunda.
  assert.equal(C.prazoSla('documento', '2026-11-06', { documento: 4 }), '2026-11-12');
  assert.equal(C.prazoSla('reembolso', '2026-11-07', { reembolso: 1 }), '2026-11-09');
  assert.equal(C.prazoSla('reembolso', '2026-11-06'), '2026-11-11', 'sem configuração, o padrão (3)');
  // Dias úteis depois de "de" até "ate".
  assert.equal(C.diasUteisEntre('2026-11-06', '2026-11-09'), 1, 'sexta → segunda');
  assert.equal(C.diasUteisEntre('2026-11-09', '2026-11-09'), 0);
  assert.equal(C.diasUteisEntre('2026-11-09', '2026-11-16'), 5);
  assert.equal(C.diasUteisEntre('2026-11-10', '2026-11-09'), 0, 'ao contrário não conta');
  const pedidos = [
    { status: 'aberto', prazo: '2026-11-05', criado_dia: '2026-11-03' },
    { status: 'andamento', prazo: '2026-11-12', criado_dia: '2026-11-09' },
    { status: 'resolvido', prazo: '2026-11-10', criado_dia: '2026-11-06', respondido_dia: '2026-11-09' },
    { status: 'recusado', prazo: '2026-11-04', criado_dia: '2026-11-02', respondido_dia: '2026-11-06' },
    { status: 'cancelado', prazo: '2026-11-01', criado_dia: '2026-10-28', respondido_dia: '2026-10-29' },
  ];
  assert.deepEqual(C.indicadoresPedidos(pedidos, '2026-11-09'), { abertos: 2, foraDoPrazo: 1, respondidos: 2, tempoMedioDias: 2.5, noPrazoPct: 50 });
  assert.deepEqual(C.indicadoresPedidos([], '2026-11-09'), { abertos: 0, foraDoPrazo: 0, respondidos: 0, tempoMedioDias: null, noPrazoPct: null });
});

test('clima 08/11: eNPS, mínimo de respostas, dimensões novas, período e histórico com variação', () => {
  assert.deepEqual(C.calcularEnps([10, 9, 8, 7, 6, 0]), { n: 6, promotores: 2, neutros: 2, detratores: 2, enps: 0 });
  assert.equal(C.calcularEnps([10, 10, 10]).enps, 100);
  assert.equal(C.calcularEnps([0, 6]).enps, -100);
  assert.equal(C.calcularEnps([]).enps, null);
  assert.equal(C.resultadoLiberado(2), false); assert.equal(C.resultadoLiberado(3), true); assert.equal(C.resultadoLiberado(4, 5), false);
  const r = (enps, n = 4) => ({ enps, lideranca: n, comunicacao: 3, reconhecimento: 2, carga: 5, ambiente: 4 });
  assert.equal(C.validarResposta(r(8), C.DIMENSOES_PESQUISA), '');
  assert.match(C.validarResposta({ ...r(8), carga: 6 }, C.DIMENSOES_PESQUISA), /Carga de trabalho/);
  assert.match(C.validarResposta({ enps: 8 }, C.DIMENSOES_PESQUISA), /Liderança/);
  const dois = C.agregarClima([r(10), r(0)], C.MINIMO_CLIMA, C.DIMENSOES_PESQUISA);
  assert.deepEqual(dois, { respostas: 2, minimo: 3, liberado: false }, 'abaixo de 3: só a contagem, nenhum número');
  const tres = C.agregarClima([r(10, 5), r(9, 4), r(3, 3)], C.MINIMO_CLIMA, C.DIMENSOES_PESQUISA);
  assert.equal(tres.enps, 33); assert.deepEqual(tres.dimensoes.map((d) => [d.id, d.media]), [['lideranca', 4], ['comunicacao', 3], ['reconhecimento', 2], ['carga', 5], ['ambiente', 4]]);
  // Período.
  assert.equal(C.situacaoPesquisa({ abre: '2026-11-08', fecha: '2026-11-15' }, '2026-11-08'), 'aberta');
  assert.equal(C.situacaoPesquisa({ abre: '2026-11-10', fecha: '2026-11-15' }, '2026-11-08'), 'agendada');
  assert.equal(C.situacaoPesquisa({ abre: '2026-11-01', fecha: '2026-11-07' }, '2026-11-08'), 'encerrada');
  assert.equal(C.situacaoPesquisa({ abre: '2026-11-01', fecha: '2026-11-30', encerrada_em: '2026-11-05T10:00:00Z' }, '2026-11-08'), 'encerrada');
  assert.equal(C.validarPesquisa({ titulo: 'Clima', abre: '2026-11-08', fecha: '2026-11-15' }, '2026-11-08'), '');
  assert.match(C.validarPesquisa({ titulo: ' ', abre: '2026-11-08', fecha: '2026-11-15' }, '2026-11-08'), /nome/);
  assert.match(C.validarPesquisa({ titulo: 'x', abre: '2026-11-08', fecha: '2026-11-07' }, '2026-11-08'), /depois/);
  assert.match(C.validarPesquisa({ titulo: 'x', abre: '2026-11-01', fecha: '2026-11-07' }, '2026-11-08'), /passado/);
  assert.match(C.validarPesquisa({ titulo: 'x', abre: '2026-11-08', fecha: '2027-02-01' }, '2026-11-08'), /60 dias/);
  // Histórico: do mais novo ao mais antigo; a variação pula a pesquisa que não liberou.
  const h = C.historicoClima([
    { id: '1', abre: '2026-08-01', resultado: { liberado: true, enps: 10, dimensoes: [{ id: 'carga', media: 3 }] } },
    { id: '3', abre: '2026-11-01', resultado: { liberado: true, enps: 40, dimensoes: [{ id: 'carga', media: 3.5 }] } },
    { id: '2', abre: '2026-09-01', resultado: { liberado: false, respostas: 2 } },
  ]);
  assert.deepEqual(h.map((p) => p.id), ['3', '2', '1']);
  assert.equal(h[0].vs.delta, 30, '40 contra 10 (a de setembro não liberou)');
  assert.equal(h[0].vsDimensoes.carga, 0.5);
  assert.equal(h[1].vs.delta, null); assert.equal(h[2].vs.delta, null, 'a primeira não tem com o que comparar');
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
