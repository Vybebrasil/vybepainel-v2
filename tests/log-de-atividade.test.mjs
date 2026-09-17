// O Log de atividade da peça: a leitura no banco e a frase de cada evento.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { conexao } from './postgres.mjs';
import { logDaPeca } from '../server/log-de-atividade.js';

async function banco({ semAutomacoes = false } = {}) {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_pessoas (id int primary key, nome text);
    CREATE TABLE vybe_conteudo_eventos (id serial primary key, conteudo_id int, tipo text, de text, para text,
      autor_id int, texto text, em timestamptz NOT NULL DEFAULT NOW(), monday_log_id text);
    CREATE TABLE vybe_conteudo_updates (id serial primary key, conteudo_id int, corpo text, autor text,
      criado_em timestamptz, monday_update_id text);
    ${semAutomacoes ? '' : `CREATE TABLE vybe_automacoes (id int primary key, nome text);
    CREATE TABLE vybe_automacao_execucoes (id serial primary key, automacao_id int, conteudo_id int,
      resultado jsonb, em timestamptz NOT NULL DEFAULT NOW());`}
    INSERT INTO vybe_pessoas VALUES (1, 'Deivid'), (2, 'Jady');
    INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id, texto, em, monday_log_id) VALUES
      (7, 'criacao', NULL, 'Card', 2, NULL, '2026-09-10T12:00:00Z', NULL),
      (7, 'status', 'Pode Fazer', 'Em andamento', 1, NULL, '2026-09-12T13:00:00Z', NULL),
      (7, 'status', NULL, 'Pode Fazer', NULL, NULL, '2026-09-01T09:00:00Z', 'log-1'),
      (7, 'comentario', NULL, NULL, 1, 'feito no painel', '2026-09-13T10:00:00Z', NULL),
      (8, 'status', 'A', 'B', 1, NULL, '2026-09-12T13:00:00Z', NULL);
    INSERT INTO vybe_conteudo_updates (conteudo_id, corpo, autor, criado_em, monday_update_id) VALUES
      (7, 'veio do Monday', 'Reriston', '2026-08-30T15:00:00Z', 'm-1'),
      (7, 'feito no painel', 'Deivid', '2026-09-13T10:00:00Z', NULL);
  `);
  if (!semAutomacoes) await db.exec(`
    INSERT INTO vybe_automacoes VALUES (5, 'Aprovado vai para Agendamento');
    INSERT INTO vybe_automacao_execucoes (automacao_id, conteudo_id, resultado, em)
      VALUES (5, 7, '{"feitas":["grupo → Agendamento","notificação"]}', '2026-09-12T13:00:01Z');`);
  return sql;
}

test('o log junta eventos, automações e comentários do Monday, do mais recente ao mais antigo', async () => {
  const itens = await logDaPeca(await banco(), 7);
  assert.deepEqual(itens.map((i) => [i.tipo, i.autor]), [
    ['comentario', 'Deivid'],
    ['automacao', ''],
    ['status', 'Deivid'],
    ['criacao', 'Jady'],
    ['status', ''],
    ['comentario', 'Reriston'],
  ]);
  // O comentário feito no painel entra uma vez só: pelo evento, não pelo update.
  assert.equal(itens.filter((i) => i.texto === 'feito no painel').length, 1);
  assert.equal(itens[1].para, 'grupo → Agendamento, notificação');
  assert.equal(itens[4].do_monday, true);
  assert.ok(!itens.some((i) => i.de === 'A'), 'evento de outra peça não entra');
});

test('sem a tabela de automações, o log sai com o resto', async () => {
  const itens = await logDaPeca(await banco({ semAutomacoes: true }), 7);
  assert.equal(itens.length, 5);
});

function tela() {
  const c = vm.createContext({ console, document: { addEventListener() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`) });
  vm.runInContext(fs.readFileSync('vybe-log.js', 'utf8'), c);
  return (ev, opcoes) => JSON.parse(vm.runInContext(`JSON.stringify({...fraseDoLog(${JSON.stringify(ev)}, ${JSON.stringify(opcoes || {})}), autor: autorDoLog(${JSON.stringify(ev)})})`, c));
}

test('cada tipo de evento vira uma frase, com o filtro certo', () => {
  const f = tela();
  assert.deepEqual(f({ tipo: 'status', de: 'Pode Fazer', para: 'Em andamento', autor: 'Deivid' }),
    { categoria: 'status', frase: 'mudou o status de <b>Pode Fazer</b> para <b>Em andamento</b>', autor: 'Deivid' });
  assert.equal(f({ tipo: 'prazo', de: '2026-09-11', para: '2026-09-15' }).frase,
    'mudou o prazo de <b>11/09/2026</b> para <b>15/09/2026</b>');
  // Em Solicitações a data de veiculação se chama conclusão.
  assert.match(f({ tipo: 'veiculacao', para: '2026-09-20' }, { demanda: true }).frase, /definiu a conclusão como/);
  assert.equal(f({ tipo: 'responsavel', de: 'Jady', para: 'Deivid' }).categoria, 'pessoas');
  assert.equal(f({ tipo: 'anexo', para: 'card.png' }).categoria, 'arquivos');
  assert.equal(f({ tipo: 'prioridade', de: 'Média', para: 'Alta' }).frase, 'mudou a prioridade de <b>Média</b> para <b>Alta</b>');
  assert.equal(f({ tipo: 'automacao', texto: 'Regra X', para: 'grupo → Y' }).autor, 'Automação');
  assert.equal(f({ tipo: 'status', para: 'Pode Fazer', do_monday: true }).autor, 'Monday');
  assert.equal(f({ tipo: 'criacao', texto: 'Integração' }).autor, 'Integração');
});

test('o texto das pessoas não vira HTML', () => {
  const f = tela();
  assert.ok(!f({ tipo: 'comentario', texto: '<img src=x onerror=alert(1)>' }).frase.includes('<img'));
  assert.ok(!f({ tipo: 'titulo', de: '<b>x</b>', para: 'y' }).frase.includes('<b>x</b>'));
});
