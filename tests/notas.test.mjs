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
import { listarNotas, salvarNota, apagarNota, notasProntas,
  listarCadernos, renomearCaderno, apagarCaderno } from '../server/notas.js';

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_pessoas (id int primary key, nome text);
    CREATE TABLE vybe_notas (
      id serial primary key, pessoa_id int NOT NULL, item_ref text, titulo text,
      corpo text NOT NULL DEFAULT '', caderno text NOT NULL DEFAULT 'Notas do dia',
      criado_em timestamptz NOT NULL DEFAULT NOW(),
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
  const c = vm.createContext({ console, document: { addEventListener() {} }, window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
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

test('cadernos: lista com a contagem, renomeia todas as notas e apagar move em vez de perder', async () => {
  const sql = await banco();
  await salvarNota(sql, 1, { titulo: 'a', corpo: 'x', caderno: 'Clientes' });
  await salvarNota(sql, 1, { titulo: 'b', corpo: 'y', caderno: 'Clientes' });
  await salvarNota(sql, 1, { titulo: 'c', corpo: 'z' });
  await salvarNota(sql, 2, { titulo: 'da Jady', corpo: 'w', caderno: 'Clientes' });
  assert.deepEqual((await listarCadernos(sql, 1)).map((c) => [c.nome, c.notas]).sort(),
    [['Clientes', 2], ['Notas do dia', 1]]);
  assert.equal((await renomearCaderno(sql, 1, 'Clientes', 'Contas')).notas, 2);
  assert.deepEqual((await listarCadernos(sql, 1)).map((c) => c.nome).sort(), ['Contas', 'Notas do dia']);
  // O caderno da outra pessoa não é tocado.
  assert.deepEqual((await listarCadernos(sql, 2)).map((c) => c.nome), ['Clientes']);
  const r = await apagarCaderno(sql, 1, 'Contas', { mover: 'Notas do dia' });
  assert.deepEqual([r.movidas, r.para], [2, 'Notas do dia']);
  assert.equal((await listarNotas(sql, 1)).length, 3);
  await assert.rejects(() => apagarCaderno(sql, 1, 'Inexistente'), /não encontrado/i);
  const so = await apagarCaderno(sql, 1, 'Notas do dia', { apagarNotas: true });
  assert.equal(so.apagadas, 3);
});

test('a barra de ferramentas escreve a marca no lugar do cursor', () => {
  const c = vm.createContext({ console, document: { addEventListener() {} }, window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} }, safeText: (v) => String(v ?? '') });
  vm.runInContext(fs.readFileSync('vybe-notas.js', 'utf8'), c);
  const chama = (texto, i, f, marca) => { c.a = [texto, i, f, marca];
    return JSON.parse(vm.runInContext('JSON.stringify(notasInserir(a[0],a[1],a[2],a[3]))', c)); };
  // Checklist entra no começo da linha em que está o cursor.
  assert.deepEqual(chama('primeira\nsegunda', 10, 10, { linha: '[] ' }),
    { texto: 'primeira\n[] segunda', cursor: 13 });
  // Clicar de novo tira a marca.
  assert.deepEqual(chama('[] fazer', 4, 4, { linha: '[] ' }), { texto: 'fazer', cursor: 1 });
  // Negrito envolve o que está selecionado e deixa o cursor depois do texto.
  assert.deepEqual(chama('prazo curto', 0, 5, { antes: '**', depois: '**' }),
    { texto: '**prazo** curto', cursor: 9 });
  // Emoji entra onde o cursor está.
  assert.deepEqual(chama('ok ', 3, 3, { antes: '🔥' }), { texto: 'ok 🔥', cursor: 5 });
});
