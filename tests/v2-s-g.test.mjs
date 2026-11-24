import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Rodada S, frente g (Paulo, 19/11/2026): "olhando pra semana, exemplo sexta dia 20, tá 1 de 17, mas tem 6 para agendar;
// não devia contar como um pronto na contagem e no gráfico?". Nos contadores e gráficos da SEMANA, pronta é a produção
// pronta (Finalizado, Para agendar e Agendado), com o Finalizado à parte. Atraso, furo, risco e o resto seguem só com
// Finalizado.
const ctx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), ctx);
const D = ctx.window.VybeDono;
const calcular = (entrada) => JSON.parse(JSON.stringify(D.calcular(entrada)));
const em = (iso, h = 10) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };

const HOJE = '2026-11-19'; // quinta; semana de 16/11 a 22/11
const SEXTA = '2026-11-20';
const CLIENTES = [{ id: 1, nome: 'Alfa', ativo: true, status: 'Ativo' }];
let seq = 0;
const peca = (o = {}) => ({ id: `g${++seq}`, nome: `Peça ${seq}`, clientes: ['Alfa'], status: 'Em andamento', veiculacao_iso: '', prazo_iso: '', responsavel_ids: ['10'], status_updated_at: em('2026-11-18'), ...o });
// A sexta do Paulo: 17 peças, 1 Finalizado, 6 Para agendar, 10 ainda em produção. Mais: um Agendado na quarta, um Para
// agendar que passou da data (segunda) e um Finalizado de outra semana (não entra).
const sexta = [
  peca({ status: 'Finalizado', veiculacao_iso: SEXTA }),
  ...Array.from({ length: 6 }, () => peca({ status: 'Para agendar', veiculacao_iso: SEXTA })),
  ...Array.from({ length: 10 }, (_, i) => peca({ status: ['Em andamento', 'Alteração', 'A Fazer', 'Pode Fazer', 'Para aprovação'][i % 5], veiculacao_iso: SEXTA })),
];
const resto = [
  peca({ status: 'Agendado', veiculacao_iso: '2026-11-18' }),
  peca({ nome: 'Pronta sem postar', status: 'Para agendar', veiculacao_iso: '2026-11-16', status_updated_at: em('2026-11-14') }),
  peca({ status: 'Finalizado', veiculacao_iso: '2026-11-25' }),
];
const N = calcular({ demandas: [...sexta, ...resto], clientes: CLIENTES, hoje: HOJE });

test('faseDaPronta: Finalizado, Para agendar e Agendado são a produção pronta; o resto não', () => {
  const U = D.util;
  assert.equal(U.faseDaPronta('Finalizado'), 'finalizado');
  assert.equal(U.faseDaPronta('Feito'), 'finalizado');
  assert.equal(U.faseDaPronta('Concluída'), 'finalizado');
  assert.equal(U.faseDaPronta('Para agendar'), 'paraAgendar');
  assert.equal(U.faseDaPronta({ status: 'Agendado' }), 'agendado');
  for (const st of ['Em andamento', 'Para aprovação', 'Aprovado', 'Publicado', 'Alteração', 'Segurar Post', '']) assert.equal(U.prontaDaProducao(st), false, st);
  assert.deepEqual(JSON.parse(JSON.stringify(U.contarProntas(['Finalizado', 'Para agendar', 'Para agendar', 'Agendado', 'A Fazer']))), { total: 5, prontas: 4, finalizadas: 1, paraAgendar: 2, agendadas: 1 });
  // "pronta" do resto do sistema continua só Finalizado
  assert.equal(U.finalizado('Para agendar'), false);
  assert.equal(U.finalizado('Agendado'), false);
  assert.equal(U.finalizado('Finalizado'), true);
});

test('semana: a contagem inclui Para agendar e Agendado; previstasEntregues (o "finalizadas") segue só Finalizado', () => {
  const S = N.semana;
  assert.equal(S.previstas, 19);
  assert.equal(S.previstasEntregues, 1, 'só o Finalizado da sexta');
  assert.equal(S.previstasProntas, 9, '1 Finalizado + 7 Para agendar + 1 Agendado');
  assert.equal(S.previstasParaAgendar, 7);
  assert.equal(S.previstasAgendadas, 1);
  const PS = D.util.prontasDaSemana(S);
  assert.deepEqual(JSON.parse(JSON.stringify(PS)), { prontas: 9, finalizadas: 1, paraAgendar: 7, agendadas: 1, previstas: 19 });
  assert.equal(D.util.resumoProntas(PS), '1 finalizada · 7 para agendar · 1 agendada');
  assert.equal(D.util.resumoProntas(PS, { curto: true }), '1 finalizada · 8 a postar');
  // dado antigo, sem os campos novos: cai nas entregues (só Finalizado)
  assert.equal(D.util.prontasDaSemana({ previstas: 10, previstasEntregues: 3 }).prontas, 3);
});

test('o dia da semana: sexta 20 fica 7 de 17 (1 finalizada, 6 para agendar), no porDia e no gráfico da semana', () => {
  const dia = N.semana.porDia.find((x) => x.dia === SEXTA);
  assert.equal(dia.previstas, 17);
  assert.equal(dia.prontas, 7);
  assert.equal(dia.finalizadas, 1);
  assert.equal(dia.paraAgendar, 6);
  assert.equal(dia.agendadas, 0);
  assert.equal(D.util.resumoProntas(dia), '1 finalizada · 6 para agendar');
  const g = N.graficoSemana.porDia.find((x) => x.dia === SEXTA);
  assert.equal(g.prontas, 7);
  assert.equal(g.finalizadas, 1);
  const qua = N.semana.porDia.find((x) => x.dia === '2026-11-18');
  assert.equal(qua.agendadas, 1);
  assert.equal(qua.prontas, 1);
});

test('atraso continua só com Finalizado: o Para agendar vencido é furo (a conferir se saiu) e não é entregue', () => {
  const H = N.hoje;
  assert.equal(H.semPostar, 2, 'o Para agendar de segunda e o Agendado de quarta passaram da data sem Finalizado');
  assert.ok(H.lista.atrasadas.some((x) => x.status === 'Para agendar'), 'segue na lista de atrasadas');
  assert.equal(H.furosProducao, 0, 'o alerta "furando a data" é só da produção');
  const sit = D.util.situacaoDaPeca({ status: 'Para agendar', veiculacao_iso: '2026-11-16' }, { hoje: HOJE });
  assert.equal(sit.entregue, false);
  assert.equal(sit.atrasada, true);
  assert.equal(D.util.situacaoDaPeca({ status: 'Agendado', veiculacao_iso: SEXTA }, { hoje: HOJE }).entregue, false);
  // o histórico de entregas e o "entregues" da semana seguem pelo Finalizado
  assert.equal(N.semana.entregues, 2);
});

test('as telas da semana usam a regra única (sem copiar a lista de status)', () => {
  const setor = readFileSync('vybe-mundo-setor.js', 'utf8');
  const mundo = readFileSync('vybe-mundo.js', 'utf8');
  const gestor = readFileSync('vybe-gestor.js', 'utf8');
  // Visão do setor: "Prontas por dia" empilhado e "Prontas da semana" pelas prontas da produção
  const dias = setor.slice(setor.indexOf('function vstDias'), setor.indexOf('// O pé dos módulos'));
  assert.match(dias, /U\.faseDaPronta/);
  assert.match(dias, /vsg-pilha/);
  assert.match(dias, /vsg-clara/);
  assert.match(setor, /prontasSem\(S\)/);
  assert.doesNotMatch(setor, /pronta é só Finalizado' : 'nada previsto'/);
  // Hoje (Agência), a Semana do pé e a Gestão
  assert.match(mundo, /const PSD3 = prontasSemD3\(S\), prontasSemana = PSD3\.prontas/);
  assert.match(mundo, /utilDono\(\)\.faseDaPronta/);
  const semFallback = mundo.split(/\r?\n/).filter((l) => !/prontas: Number\(S\.previstasEntregues/.test(l)).join('\n'); // a volta para o dado antigo
  assert.equal((semFallback.match(/S\.previstasEntregues \?\? S\.entregues/g) || []).length, 0, 'nenhum contador da semana lê só o Finalizado');
  // Painel de trabalho: a régua da semana
  const regua = gestor.slice(gestor.indexOf('function pv2PintarSemana'), gestor.indexOf('// No celular, Redes/Demandas/Pendências'));
  // 24/11/2026: a conta do dia é a prévia única (previaDaSemanaGestor → VybeDono.util.previaDaSemana, com faseDaPronta).
  assert.match(regua, /previaDaSemanaGestor\(/);
  assert.match(gestor, /util\.faseDaPronta\(d\)/);
  assert.match(regua, /d3m-dia-b vsg-pilha/);
  // o "concluída" do resto do Painel segue só Finalizado
  assert.match(gestor, /function atividadeDoDiaConcluida\(item\) \{\s*return isRequestItem\(item\) \? DEMANDA_CONCLUIDA\.includes\(item\.status\)\s*: item\.status === 'Finalizado';/);
});

test('s-g.css: só tokens, sem !important, sem :has e sem html body.mundo', () => {
  const css = readFileSync('padrao-v2/s-g.css', 'utf8');
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important/);
  assert.doesNotMatch(regras, /:has\(/);
  assert.doesNotMatch(regras, /html\s+body\.mundo/);
  assert.doesNotMatch(regras, /:\s*#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(regras, /rgba?\(/);
  for (const v of regras.match(/var\(--[\w-]+/g) || []) assert.match(v, /var\(--(d3-|vsg-|v$|c$)/, v); // --v e --c: a largura que vem do style da barra
  const junto = readFileSync('vybe-mundo-padrao-v2.css', 'utf8');
  assert.match(junto, /padrao-v2\/s-g\.css/);
});
