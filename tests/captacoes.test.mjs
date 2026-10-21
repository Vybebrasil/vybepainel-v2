// Captações da Produção (Paulo, 21/10/2026): junta as peças em "Agendar
// Captação" de um cliente num dia, marca cada uma pelo caminho do painel, cria o
// evento na agenda, marca "Gravado" peça a peça e cancela devolvendo as peças.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { pecasParaCaptar, listarCaptacoes, montarCaptacao, marcarGravado, cancelarCaptacao, eventoDaCaptacao, CAPTACAO } from '../server/captacoes.js';

const PRODUCAO = 7829537690;
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text);
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, titulo text, formato text, prazo date, veiculacao date, briefing text,
      status_chave text, captacao_chave text, board_id bigint, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_pessoas VALUES (1, 'Paulo Martins'), (28, 'Ademir Dourado Santana');
    INSERT INTO vybe_clientes VALUES (1, 'Brussolo'), (2, 'DiaCenter');
    INSERT INTO vybe_status VALUES (${PRODUCAO}, 'aguardo', 'Aguardo', '#ff8a35');
    INSERT INTO vybe_conteudos VALUES
      (10, 'Reels - Prato do dia', 'Reels', '2026-11-03', '2026-11-05', 'Roteiro: abrir na cozinha', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (11, 'Foto - Sobremesa', 'Fotografia', '2026-11-04', '2026-11-06', '', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (12, 'Reels - Exame', 'Reels', NULL, NULL, '', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (13, 'Card - Promo', 'Card', NULL, NULL, '', 'pode_fazer', NULL, ${PRODUCAO}, NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (10, 1), (11, 1), (12, 2), (13, 1);`);
  await db.exec(readFileSync('migrations/2026-10-21-producao-captacoes.sql', 'utf8'));
  // O trocarEscolha do painel, reduzido ao que importa aqui: a chave muda.
  const trocas = [];
  const trocar = async (s, quem, { item, campo, para }) => { trocas.push([item, campo, para]); await s`UPDATE vybe_conteudos SET captacao_chave = ${para} WHERE id = ${item}`; };
  const eventos = [];
  const agenda = async (acao, k) => { eventos.push([acao, k.evento_google || k.cliente]); if (acao === 'criar') return 'ev-1'; return null; };
  return { sql, trocar, trocas, agenda, eventos };
}
const quem = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins' } };

test('monta a captação com as peças do cliente, marca cada uma e cria o evento', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['10', '11', '12']);
  const r = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', inicio: '09:00', fim: '11:00', local: 'Restaurante', pecas: ['10', '11'] }, { trocar, agenda });
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.agendada], ['11', 'captacao', CAPTACAO.agendada]]);
  assert.deepEqual(eventos, [['criar', 'Brussolo']]);
  // Saem da fila e aparecem na agenda de captações, com o roteiro.
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['12']);
  const { captacoes } = await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' });
  assert.equal(captacoes.length, 1);
  assert.equal(captacoes[0].cliente, 'Brussolo');
  assert.equal(captacoes[0].na_agenda, true);
  assert.equal(captacoes[0].pecas[0].briefing, 'Roteiro: abrir na cozinha');
});

test('recusa peça de outro cliente, fora da fila ou já marcada; nada fica pela metade', async (t) => {
  const { sql, trocar, trocas, agenda } = await banco(t);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10', '12'] }, { trocar, agenda }), /Reels - Exame/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['13'] }, { trocar, agenda }), /Card - Promo/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '28/10', pecas: ['10'] }, { trocar, agenda }), /dia/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', inicio: '11:00', fim: '09:00', pecas: ['10'] }, { trocar, agenda }), /fim/);
  assert.equal(trocas.length, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_captacoes`)[0].n, 0);
  await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10'] }, { trocar, agenda });
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-29', pecas: ['10'] }, { trocar, agenda }), /Prato do dia/);
});

test('falha do Google vira aviso guardado e a captação continua', async (t) => {
  const { sql, trocar } = await banco(t);
  const agenda = async () => { throw new Error('a conta do painel não pode mudar a agenda'); };
  const r = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10'] }, { trocar, agenda });
  assert.match(r.avisos[0], /Google Agenda/);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.equal(k.na_agenda, false);
  assert.match(k.aviso, /não pode mudar a agenda/);
});

test('gravado peça a peça fecha a captação; cancelar devolve só as não gravadas', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10', '11'] }, { trocar, agenda });
  assert.deepEqual(await marcarGravado(sql, quem, { captacao_id: id, conteudo_id: '10' }, { trocar }), { estado: 'agendada', faltam: 1 });
  assert.equal(trocas.at(-1)[2], CAPTACAO.feita);
  await assert.rejects(marcarGravado(sql, quem, { captacao_id: id, conteudo_id: '12' }, { trocar }), /não é desta captação/);
  await cancelarCaptacao(sql, quem, { id }, { trocar, agenda });
  assert.deepEqual(trocas.at(-1), ['11', 'captacao', CAPTACAO.pronta]);
  assert.deepEqual(eventos.at(-1), ['apagar', 'ev-1']);
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['11', '12']);
  assert.equal((await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes.length, 0);
});

test('o evento da agenda leva cliente, peças, local e horário de Irecê', () => {
  const e = eventoDaCaptacao({ cliente: 'Brussolo', dia: '2026-10-28', inicio: '09:00', fim: null, local: 'Restaurante', observacao: 'Levar luz',
    pecas: [{ titulo: 'Reels - Prato do dia', formato: 'Reels' }, { titulo: 'Foto - Sobremesa', formato: 'Fotografia' }] }, 'https://painel');
  assert.equal(e.summary, 'Captação · Brussolo · 2 peças');
  assert.equal(e.start.dateTime, '2026-10-28T09:00:00-03:00');
  assert.equal(new Date(e.end.dateTime).toISOString(), '2026-10-28T14:00:00.000Z');
  assert.match(e.description, /1\. Reels - Prato do dia \(Reels\)/);
  assert.match(e.description, /Levar luz/);
  const diaTodo = eventoDaCaptacao({ cliente: 'X', dia: '2026-12-31', inicio: null, fim: null, local: '', observacao: '', pecas: [] });
  assert.deepEqual([diaTodo.start.date, diaTodo.end.date], ['2026-12-31', '2027-01-01']);
});
