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

// A tela roda numa sandbox: o arquivo é o mesmo que o navegador carrega.
function contexto() {
  const c = vm.createContext({ console, document: { addEventListener() {} }, window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`) });
  vm.runInContext(fs.readFileSync('vybe-notas.js', 'utf8'), c);
  return c;
}
// A busca da demanda usa a mesma função do Spotlight; o teste carrega os dois
// arquivos na mesma sandbox, como o navegador faz.
function contextoComSpotlight(itens) {
  const c = vm.createContext({ console, document: { addEventListener() {} }, window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`) });
  vm.runInContext(fs.readFileSync('vybe-spotlight.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('vybe-notas.js', 'utf8'), c);
  c.itensDemo = itens;
  vm.runInContext(`HOJE_ISO = '2026-09-17'; TEAM_USERS = [];
    unifiedOperationalItems = () => itensDemo;
    atividadeDoDiaConcluida = (i) => ['Finalizado','Feito'].includes(i.status);
    isRequestItem = (i) => i.origem === 'solicitacao';`, c);
  return c;
}

const chamar = (c, chamada, ...args) => { c.a = args; return JSON.parse(vm.runInContext(`JSON.stringify(${chamada})`, c)); };
function tela() {
  const c = contexto();
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

test('Enter continua a checklist, e numa linha vazia sai da lista', () => {
  const c = contexto();
  const enter = (...args) => chamar(c, 'notasEnter(a[0],a[1],a[2])', ...args);
  // Era o defeito relatado: Enter numa linha de checklist não abria outra.
  assert.deepEqual(enter(['[] fazer'], 0, 'fazer'),
    { linhas: ['[] fazer', '[] '], foco: 1 });
  assert.deepEqual(enter(['- item'], 0, 'item'), { linhas: ['- item', '- '], foco: 1 });
  // Linha de lista sem texto: o Enter sai da lista em vez de criar outra vazia.
  assert.deepEqual(enter(['[] a', '[] '], 1, ''), { linhas: ['[] a', ''], foco: 1 });
  // Título não continua: depois do título vem texto.
  assert.deepEqual(enter(['# Prioridades'], 0, 'Prioridades'),
    { linhas: ['# Prioridades', ''], foco: 1 });
});

test('Backspace tira a marca e depois junta com a linha de cima', () => {
  const c = contexto();
  const back = (...args) => chamar(c, 'notasBackspace(a[0],a[1],a[2])', ...args);
  assert.deepEqual(back(['[] fazer'], 0, 'fazer'), { linhas: ['fazer'], foco: 0, fim: 0 });
  assert.deepEqual(back(['primeira', 'segunda'], 1, 'segunda'),
    { linhas: ['primeirasegunda'], foco: 0, fim: 8 });
  // A marca da linha de cima é preservada ao juntar.
  assert.deepEqual(back(['[] a', 'b'], 1, 'b'), { linhas: ['[] ab'], foco: 0, fim: 1 });
});

test('a marca da linha se lê, se monta e se troca', () => {
  const c = contexto();
  const ler = (l) => chamar(c, 'notasLerLinha(a[0])', l);
  assert.deepEqual(ler('[x] feito'), { marca: 'check-feito', texto: 'feito' });
  assert.deepEqual(ler('## sub'), { marca: 'titulo2', texto: 'sub' });
  assert.deepEqual(ler('texto solto'), { marca: '', texto: 'texto solto' });
  assert.deepEqual(chamar(c, 'notasTrocarMarca(a[0],a[1],a[2])', ['texto'], 0, 'check'),
    { linhas: ['[] texto'], foco: 0 });
  // Clicar de novo na mesma marca tira.
  assert.deepEqual(chamar(c, 'notasTrocarMarca(a[0],a[1],a[2])', ['[] texto'], 0, 'check'),
    { linhas: ['texto'], foco: 0 });
});

test('ligar a nota a uma demanda usa a busca do ⌘K: "ree" acha "Reels - Raira 1"', () => {
  const itens = [
    { id: '1', nome: 'Reels - Raira 1', cliente: 'ConectaSim', status: 'Em andamento', veiculacao_iso: '2026-09-18' },
    { id: '2', nome: 'Card - Cardápio', cliente: 'Gonzalez', status: 'Pode Fazer', veiculacao_iso: '2026-09-19' },
    { id: '3', nome: 'Reels - Visita Pablo', cliente: 'Copirecê', status: 'Finalizado', veiculacao_iso: '2026-09-10' },
  ];
  const c = contextoComSpotlight(itens);
  const buscar = (texto) => { c.q = texto;
    return JSON.parse(vm.runInContext(`NOTA_BUSCA_PECA = q; JSON.stringify(notasPecasDaBusca().map((d) => d.id))`, c)); };
  // Era o caso do print: "ree" não achava nada na busca antiga.
  assert.deepEqual(buscar('ree'), ['1', '3']);
  // Duas palavras, em campos diferentes: nome e cliente.
  assert.deepEqual(buscar('reels copirecê'), ['3']);
  // Sem acento também acha.
  assert.deepEqual(buscar('copirece'), ['3']);
  // Uma letra só não despeja o painel.
  assert.deepEqual(buscar('r'), []);
});
