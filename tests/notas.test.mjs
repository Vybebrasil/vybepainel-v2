// As Notas: o caderno de cada pessoa.
//
// Duas coisas precisam de teste: a escrita simples que vira HTML (e não deixa
// texto de gente virar código) e a gravação, que não pode deixar uma pessoa ler
// ou apagar nota de outra.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { conexao } from './postgres.mjs';
import { listarNotas, salvarNota, apagarNota, notasProntas } from '../server/notas.js';

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_pessoas (id int primary key, nome text);
    CREATE TABLE vybe_notas (
      id serial primary key, pessoa_id int NOT NULL, item_ref text, titulo text,
      corpo text NOT NULL DEFAULT '', criado_em timestamptz NOT NULL DEFAULT NOW(),
      atualizado_em timestamptz NOT NULL DEFAULT NOW());
    INSERT INTO vybe_pessoas VALUES (1,'Paulo'),(2,'Jady');
  `);
  return sql;
}

test('a nota é de quem escreveu: a outra pessoa não lê, não edita e não apaga', async () => {
  const sql = await banco();
  const minha = await salvarNota(sql, 1, { titulo: 'Do dia', corpo: 'combinar com o cliente' });
  await salvarNota(sql, 2, { titulo: 'Da Jady', corpo: 'outra coisa' });
  assert.deepEqual((await listarNotas(sql, 1)).map((n) => n.titulo), ['Do dia']);
  await assert.rejects(() => salvarNota(sql, 2, { id: minha.id, corpo: 'invadindo' }), /não encontrada/i);
  await assert.rejects(() => apagarNota(sql, 2, minha.id), /não encontrada/i);
  assert.equal((await listarNotas(sql, 1))[0].corpo, 'combinar com o cliente');
  assert.equal(await apagarNota(sql, 1, minha.id), minha.id);
  assert.equal((await listarNotas(sql, 1)).length, 0);
});

test('editar mantém o id, liga a peça e a busca acha por palavra do corpo', async () => {
  const sql = await banco();
  const nota = await salvarNota(sql, 1, { titulo: 'Card da VOA', corpo: 'primeira versão' });
  const editada = await salvarNota(sql, 1, { id: nota.id, titulo: 'Card da VOA', corpo: 'versão revisada', item_ref: 'vybe:10659' });
  assert.equal(editada.id, nota.id);
  assert.equal(editada.item_ref, 'vybe:10659');
  assert.deepEqual((await listarNotas(sql, 1, { busca: 'revisada' })).map((n) => n.id), [nota.id]);
  assert.deepEqual(await listarNotas(sql, 1, { busca: 'inexistente' }), []);
});

test('nota vazia não é criada, e a leitura diz quando a estrutura não existe', async () => {
  const sql = await banco();
  await assert.rejects(() => salvarNota(sql, 1, { titulo: '  ', corpo: '\n' }), /Escreva algo/i);
  assert.equal(await notasProntas(sql), true);
  const { sql: vazio } = conexao();
  assert.equal(await notasProntas(vazio), false);
});

function tela() {
  const c = vm.createContext({ console, document: { addEventListener() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`) });
  vm.runInContext(fs.readFileSync('vybe-notas.js', 'utf8'), c);
  return (texto) => { c.t = texto; return vm.runInContext('notasMarkdownHtml(t)', c); };
}

test('a escrita simples vira lista, caixinha, negrito e título', () => {
  const md = tela();
  assert.equal(md('- primeiro\n- segundo'), '<ul><li>primeiro</li><li>segundo</li></ul>');
  const checks = md('[] fazer\n[x] feito');
  assert.match(checks, /nota-check "><input type="checkbox" ><span>fazer<\/span>|nota-check ">/);
  assert.ok(checks.includes('checked'), 'a marcada vem marcada');
  assert.ok(checks.includes('onchange="marcarNaNota(1)"'), 'cada caixinha sabe a linha dela');
  assert.equal(md('# Prioridades'), '<h3>Prioridades</h3>');
  assert.equal(md('olha o **prazo**'), '<p>olha o <b>prazo</b></p>');
});

test('o que a pessoa escreve não vira código', () => {
  const md = tela();
  const html = md('<img src=x onerror=alert(1)>\n- <b>negrito falso</b>');
  assert.ok(!html.includes('<img'), 'a tag não passa');
  assert.ok(!html.includes('<b>negrito falso</b>'), 'a tag escrita não vira tag');
});
