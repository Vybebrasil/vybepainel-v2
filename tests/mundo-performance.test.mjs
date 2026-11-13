// Performance da Gestão (vybe-mundo-performance.js, Paulo 09/11/2026) e o cadeado/"ver como" do dock (vybe-mundo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar() {
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Map, Set, Promise, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-performance.js', 'utf8'), ctx);
  return ctx;
}

const HOJE = '2026-11-09';
const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'Cliente A', clientes: ['Cliente A'], grupo: 'Criação', formato: 'Reels', responsavel: 'Bia', ...o });

test('entregas no período, no prazo do cliente e tempo de entrega', () => {
  const { VybePerformance: P } = carregar();
  const r = P.calcular({ hoje: HOJE, dias: 30, demandas: [
    peca(1, { status: 'Finalizado', veiculacao_iso: '2026-11-08', criado_em: '2026-11-01T10:00:00Z', status_updated_at: '2026-11-07T15:00:00Z' }),
    peca(2, { status: 'Finalizado', veiculacao_iso: '2026-11-03', criado_em: '2026-10-30T10:00:00Z', status_updated_at: '2026-11-05T15:00:00Z' }),
    peca(3, { status: 'Finalizado', veiculacao_iso: '2026-08-01', criado_em: '2026-07-01T10:00:00Z', status_updated_at: '2026-08-01T15:00:00Z' }),
    // Pronta é só Finalizado (Paulo, 13/11/2026): Agendado com a data passada não é entrega, é atraso.
    peca(4, { status: 'Agendado', veiculacao_iso: '2026-11-03', criado_em: '2026-10-30T10:00:00Z', status_updated_at: '2026-11-05T15:00:00Z' }),
    peca(5, { status: 'Para agendar', veiculacao_iso: '2026-11-12', criado_em: '2026-10-30T10:00:00Z', status_updated_at: '2026-11-08T15:00:00Z' }),
  ] });
  assert.equal(r.total.entregues, 2, 'a entrega de agosto fica fora dos 30 dias');
  assert.deepEqual([...r.total.ids.entregues].map(String).sort(), ['1', '2']);
  assert.equal(r.total.abertas, 2, 'Agendado e Para agendar seguem abertas');
  assert.deepEqual([...r.total.ids.atrasadas].map(String), ['4'], 'só o Agendado que passou da data atrasa');
  assert.equal(r.total.noPrazo, 1); assert.equal(r.total.atrasadasEnt, 1); assert.equal(r.total.noPrazoPct, 50);
  assert.equal(r.total.tempoMediano, 6, 'mediana de 6 e 6 dias do cadastro à entrega');
  assert.equal(r.grupos[0].nome, 'Criação'); assert.equal(r.formatos[0].entregues, 2);
});

test('fila por etapa, atrasadas, alteração e processos; pausada e esquecida fora do atraso', () => {
  const { VybePerformance: P } = carregar();
  const r = P.calcular({ hoje: HOJE, dias: 30, demandas: [
    peca(1, { status: 'Alteração', veiculacao_iso: '2026-11-07', status_updated_at: '2026-11-02T10:00:00Z' }),
    peca(2, { status: 'A Fazer', veiculacao_iso: '2026-11-20', tem_briefing: false, responsavel: '' }),
    peca(3, { status: 'Segurar Post', veiculacao_iso: '2026-11-01' }),
    peca(4, { status: 'A Fazer', veiculacao_iso: '2026-08-01' }),
    peca(5, { status: 'Em andamento', captacao: 'Agendar Captação', veiculacao_iso: '2026-11-15' }),
  ], solicitacoes: [{ id: 's1', status: 'A Fazer', conclusao_iso: '2026-11-05' }, { id: 's2', status: 'Finalizado' }] });
  assert.equal(r.total.abertas, 3); assert.equal(r.total.atrasadas, 1); assert.equal(r.total.alteracao, 1);
  assert.deepEqual([...r.processos.pausadas], ['3']); assert.deepEqual([...r.processos.esquecidas], ['4']);
  assert.deepEqual([...r.processos.semBriefing], ['2']); assert.deepEqual([...r.processos.semResponsavel], ['2']);
  assert.deepEqual([...r.processos.captacaoAgendar], ['5']);
  assert.deepEqual([...r.processos.solicitacoesAbertas], ['s1']); assert.deepEqual([...r.processos.solicitacoesVencidas], ['s1']);
  assert.ok(r.etapas.some((e) => e.status === 'Alteração' && e.atrasadas === 1));
});

test('peça de duas pessoas conta para as duas, sem dobrar o total', () => {
  const { VybePerformance: P } = carregar();
  const r = P.calcular({ hoje: HOJE, dias: 7, pessoas: { 1: 'Bia', 2: 'Jady' }, demandas: [
    peca(1, { status: 'A Fazer', veiculacao_iso: '2026-11-12', responsavel_ids: ['1', '2'] })] });
  assert.equal(r.total.abertas, 1);
  assert.deepEqual([...r.pessoas.map((p) => p.nome)].sort(), ['Bia', 'Jady']);
});

const js = readFileSync('vybe-mundo.js', 'utf8').replace(/\r\n/g, '\n');
test('Performance é aba da Gestão e o item do dock abre direto nela', () => {
  assert.match(js, /\['performance', 'Performance'\]/);
  assert.match(js, /if \(id === 'gestao' \|\| id === 'performance'\) \{ abrirGestao\(id === 'performance' \? 'performance' : 'agencia'\)/);
  assert.doesNotMatch(js, /id: 'performance'[^}]*board: 'performance'/, 'não abre mais o quadro antigo');
});
test('Negócio e Time com cadeado para quem não é dono; ver como só muda a tela', () => {
  for (const id of ['setor:comercial', 'setor:financas', 'setor:gestao', 'agentes', 'recrutamento', 'documentos']) assert.ok(js.includes(`'${id}'`) && /const TRANCADOS = new Set\(/.test(js), id);
  // Paulo, 13/11/2026: a guarda é trancadoPara — Negócio para dono/coordenação, o dinheiro (SO_DINHEIRO) só para dono.
  assert.match(js, /const trancadoPara = \(id\) => \(TRANCADOS\.has\(id\) && !souDono\(\)\) \|\| \(SO_DINHEIRO\.has\(id\) && !souDonoDoDinheiro\(\)\);/);
  assert.match(js, /if \(trancadoPara\(id\)\) \{/, 'atalhos também respeitam o cadeado');
  assert.match(js, /if \(!verComo \|\| !dono\) return dono;/, 'sem ser dono de verdade, ver como não dá nada');
  assert.match(js, /const podeVerComo = \(\) => souDonoDeVerdade\(\) \|\| /);
});
test('Contratos e Churn no Comercial', () => {
  const ini = js.indexOf("{ id: 'setor:comercial'"), fim = js.indexOf("{ id: 'setor:financas'");
  const com = js.slice(ini, fim), cli = js.slice(js.indexOf("{ id: 'setor:clientes'"), ini);
  assert.match(com, /id: 'contratos'/); assert.match(com, /id: 'churn'/);
  assert.doesNotMatch(cli, /id: 'contratos'|id: 'churn'/);
});
