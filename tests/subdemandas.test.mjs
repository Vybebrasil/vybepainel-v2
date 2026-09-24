// Subdemandas: tarefa de dentro de uma demanda, com prazo e responsáveis
// próprios. Antes tinham só nome e status — e sem os dois a subdemanda não
// dizia quem faz nem até quando, que é o motivo de ela existir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { mexerNoSubitem } from '../api/conteudo.js';

const DEMANDAS = 8385559107;
const SERVICO = { tipo: 'servico' };

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_pessoas (id int primary key, monday_user_id text, nome text, email text);
    CREATE TABLE vybe_conteudos (id int primary key, monday_item_id text, board_id bigint, titulo text);
    CREATE TABLE vybe_subitens (id serial primary key, monday_item_id text, pai_id int, titulo text,
      status_chave text, prazo date, conclusao date, tipo text, prioridade text, ordem int default 0,
      atualizado_em timestamptz default now());
    CREATE TABLE vybe_subitem_responsaveis (subitem_id int, pessoa_id int, ordem int,
      PRIMARY KEY (subitem_id, pessoa_id));
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, monday_index int);
    CREATE TABLE vybe_conteudo_eventos (id serial primary key, conteudo_id int, tipo text, de text,
      para text, autor_id int, texto text, em timestamptz default now());
    INSERT INTO vybe_pessoas VALUES (1,'68036697','Reriston',NULL),(2,'68997024','Deivid',NULL);
    INSERT INTO vybe_conteudos VALUES (10,'900',${DEMANDAS},'Novo site');
    INSERT INTO vybe_status VALUES (${DEMANDAS},'nova_demanda','Nova Demanda',0),(${DEMANDAS},'feito','Feito',5);`);
  return sql;
}
const criar = (sql, titulo) => mexerNoSubitem(sql, SERVICO, { operacao: 'criar', item: '900', titulo });

test('a subdemanda nasce na demanda e recebe prazo próprio', async () => {
  const sql = await banco();
  const nova = await criar(sql, 'Levantar conteúdo do site');
  await mexerNoSubitem(sql, SERVICO, { operacao: 'prazo', subitem: String(nova.subitem_id), data: '2026-10-02' });
  const [linha] = await sql`SELECT titulo, prazo FROM vybe_subitens WHERE id=${nova.subitem_id}`;
  assert.equal(linha.titulo, 'Levantar conteúdo do site');
  assert.equal(new Date(linha.prazo).toISOString().slice(0, 10), '2026-10-02');
  // Apagar o prazo é uma escolha válida: a subdemanda volta a ficar sem data.
  await mexerNoSubitem(sql, SERVICO, { operacao: 'prazo', subitem: String(nova.subitem_id), data: '' });
  assert.equal((await sql`SELECT prazo FROM vybe_subitens WHERE id=${nova.subitem_id}`)[0].prazo, null);
  await assert.rejects(mexerNoSubitem(sql, SERVICO, { operacao: 'prazo', subitem: String(nova.subitem_id), data: '02/10/2026' }), /Prazo inválido/);
});

test('responsáveis da subdemanda são trocados por inteiro, e a ordem do clique vale', async () => {
  const sql = await banco();
  const nova = await criar(sql, 'Revisar textos');
  const id = String(nova.subitem_id);
  await mexerNoSubitem(sql, SERVICO, { operacao: 'responsaveis', subitem: id, pessoas: ['68997024', '68036697'] });
  const donos = await sql`SELECT pessoa_id, ordem FROM vybe_subitem_responsaveis WHERE subitem_id=${nova.subitem_id} ORDER BY ordem`;
  assert.deepEqual(donos.map((d) => Number(d.pessoa_id)), [2, 1]);
  // Trocar por uma pessoa só não deixa a antiga para trás.
  await mexerNoSubitem(sql, SERVICO, { operacao: 'responsaveis', subitem: id, pessoas: ['68036697'] });
  assert.deepEqual((await sql`SELECT pessoa_id FROM vybe_subitem_responsaveis WHERE subitem_id=${nova.subitem_id}`).map((d) => Number(d.pessoa_id)), [1]);
  // Lista vazia tira todo mundo.
  await mexerNoSubitem(sql, SERVICO, { operacao: 'responsaveis', subitem: id, pessoas: [] });
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_subitem_responsaveis WHERE subitem_id=${nova.subitem_id}`)[0].n, 0);
  await assert.rejects(mexerNoSubitem(sql, SERVICO, { operacao: 'responsaveis', subitem: id, pessoas: ['999999'] }), /não está no cadastro/);
});

test('cada mudança da subdemanda fica no histórico da demanda-mãe', async () => {
  const sql = await banco();
  const nova = await criar(sql, 'Publicar');
  await mexerNoSubitem(sql, SERVICO, { operacao: 'prazo', subitem: String(nova.subitem_id), data: '2026-10-09' });
  await mexerNoSubitem(sql, SERVICO, { operacao: 'responsaveis', subitem: String(nova.subitem_id), pessoas: ['68036697'] });
  const tipos = (await sql`SELECT tipo, para FROM vybe_conteudo_eventos WHERE conteudo_id=10 ORDER BY id`).map((e) => e.tipo);
  assert.deepEqual(tipos, ['subitem_criado', 'subitem_prazo', 'subitem_responsaveis']);
});
