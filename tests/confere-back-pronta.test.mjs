// Confere do back (14/11/2026), A2 e item 3 da liga: "pronta" é só Finalizado em tudo (Paulo, 13/11/2026). O espelho marca
// vybe_status.final=true também em Para agendar e Agendado; o servidor e as contas das telas passam a usar um predicado só
// (Finalizado, Feito, Concluído). SAFE: PGlite em memória e as contas do painel num vm.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import statusFinal from '../shared/status-finalizado.js';
import { alertasDosClientes } from '../server/alertas-clientes.js';

const dono = () => { const ctx = vm.createContext({ window: {} }); vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), ctx); return ctx.VybeDono || ctx.window.VybeDono; };
const PRONTOS = ['Finalizado', 'Feito', 'Concluído', 'concluido', 'Concluídas', 'finalizado'];
const ABERTOS = ['Agendado', 'Para agendar', 'Aprovado', 'Publicado', 'Postado', 'Para aprovação', 'Ag. Aprovação Cliente', 'Em andamento', ''];

test('predicado único: só Finalizado/Feito/Concluído; o servidor e VybeDono.util.finalizado dizem o mesmo', () => {
  const D = dono();
  assert.equal(typeof D.util.finalizado, 'function', 'exportado para o front usar');
  for (const s of PRONTOS) { assert.equal(statusFinal.statusFinalizado(s), true, s); assert.equal(D.util.finalizado(s), true, s); }
  for (const s of ABERTOS) { assert.equal(statusFinal.statusFinalizado(s), false, s); assert.equal(D.util.finalizado(s), false, s); }
  // A lista do SQL cobre as formas com acento (lower() do Postgres).
  for (const s of ['finalizado', 'feito', 'concluído', 'concluida']) assert.ok(statusFinal.STATUS_FINALIZADO_SQL.includes(s), s);
});

test('contas das telas: Aprovado/Publicado não são entregues; status_final do banco não fecha a peça', () => {
  const D = dono();
  const hoje = '2026-11-14';
  const base = { cliente: 'Alfa', clientes: ['Alfa'], responsavel: 'Jady', responsavel_ids: ['900'], origem: 'producao_conteudo', prazo_iso: '2026-11-05', veiculacao_iso: '2026-11-10' };
  const demandas = ['Finalizado', 'Aprovado', 'Publicado', 'Postado'].map((s, i) => ({ ...base, id: String(100 + i), nome: s, status: s }));
  const r = JSON.parse(JSON.stringify(D.calcular({ demandas, clientes: [{ id: '1', nome: 'Alfa', ativo: true }], pessoas: { 900: 'Jady' }, hoje })));
  assert.equal(r.hoje.atrasadas, 3, 'antes: 0 (Aprovado, Publicado e Postado contavam como entregues)');
  assert.equal(D.util.situacaoDaPeca({ ...base, status: 'Aprovado', status_final: true }, { hoje }).entregue, false);
  assert.equal(D.util.situacaoDaPeca({ ...base, status: 'Finalizado' }, { hoje }).entregue, true);
});

test('servidor (alertas dos clientes): peça Agendada com final=true no espelho segue aberta e atrasada', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, monday_item_id text, board_id bigint, titulo text, status_chave text, prazo date, briefing text, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint);
    INSERT INTO vybe_status VALUES (7829537690,'agendado','Agendado',true),(7829537690,'finalizado','Finalizado',true),(7829537690,'feito','Feito',true);
    INSERT INTO vybe_conteudos VALUES (1,'501',7829537690,'Agendada antiga','agendado','2026-01-05','x',NULL),
      (2,'502',7829537690,'Finalizada','finalizado','2026-01-05','x',NULL),(3,'503',7829537690,'Feita','feito','2026-01-05','x',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (1,10),(2,10),(3,10);
    INSERT INTO vybe_conteudo_responsaveis VALUES (1,1),(2,1),(3,1);`);
  const por = await alertasDosClientes(sql, { agora: new Date('2026-02-01T12:00:00Z') });
  const a = por.get('10');
  assert.ok(a, 'antes: o cliente nem aparecia (as três contavam como prontas)');
  assert.deepEqual(a.atrasadas.map((x) => x.titulo), ['Agendada antiga']);
});

test('servidor: nenhuma consulta de "pronta" usa mais vybe_status.final (pessoas, alertas, pontos do Escritório)', () => {
  for (const f of ['server/pessoas.js', 'server/alertas-clientes.js', 'server/escritorio-pontos.js']) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /COALESCE\(s\.final/, f);
    assert.match(s, /STATUS_FINALIZADO_SQL/, f);
  }
});
