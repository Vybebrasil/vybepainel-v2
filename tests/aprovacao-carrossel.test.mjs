// Link de aprovação de peças em "uma por vez" (15/11/2026): a legenda vem do planejamento aprovado do cliente e a
// página monta o palco com a doca só quando há duas ou mais peças. As regras de aprovação não mudam (os outros testes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { legendasDasPecas } from '../server/planejamentos.js';
import { paginaHtml } from '../server/conteudo-aprovacao-pagina.js';

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_planejamentos(id bigserial PRIMARY KEY,cliente_id bigint,mes date,estado text,conteudo jsonb);
  CREATE TABLE vybe_planejamento_eventos(id bigserial PRIMARY KEY);`);
  return sql;
}

test('legenda: só de planejamento aprovado/cadastrado do próprio cliente, ligada por conteudo_id, o mais recente vence', async (t) => {
  const sql = await banco(t);
  const plano = (pecas) => JSON.stringify({ pecas });
  await sql`INSERT INTO vybe_planejamentos(cliente_id,mes,estado,conteudo) VALUES
    (10,'2026-10-01','cadastrado',${plano([{ conteudo_id: 100, legenda: 'Antiga' }, { conteudo_id: 101, legenda: 'Só em outubro' }])}::jsonb),
    (10,'2026-11-01','aprovado',${plano([{ conteudo_id: 100, legenda: '  Nova\r\nlinha  ' }, { conteudo_id: 102, legenda: '' }])}::jsonb),
    (10,'2026-12-01','rascunho',${plano([{ conteudo_id: 103, legenda: 'Rascunho não sai' }])}::jsonb),
    (11,'2026-11-01','aprovado',${plano([{ conteudo_id: 104, legenda: 'De outro cliente' }])}::jsonb)`;
  const m = await legendasDasPecas(sql, 10, ['100', '101', '102', '103', '104']);
  assert.deepEqual(Object.fromEntries(m), { 100: 'Nova\nlinha', 101: 'Só em outubro' });
  assert.equal((await legendasDasPecas(sql, 10, [])).size, 0);
});

test('legenda: sem a tabela de planejamentos, volta vazio sem quebrar', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  assert.equal((await legendasDasPecas(sql, 10, ['100'])).size, 0);
});

const peca = (id, extra = {}) => ({ id, titulo: `Peça ${id}`, formato: 'Feed', veiculacao: '2026-11-20', vista: false, legenda: '', arquivos: [{ id: `a${id}`, nome: 'arte.png', imagem: true }], ...extra });
const dados = (pecas) => ({ cliente: 'Alfa Café', expira_em: '2026-11-30T23:59:00-03:00', pecas, respondidas: [], vistas: true });

test('página: com 2+ peças tem palco, doca com o total e a troca para lista; o script continua válido', () => {
  const html = paginaHtml(dados([peca('1', { legenda: 'Texto <b>da</b> legenda' }), peca('2'), peca('3', { arquivos: [] })]), { nonce: 'n', base: '/x' });
  assert.match(html, /<div class="palco" data-palco><div class="trilho">/);
  assert.match(html, /data-doca-n>01<\/b> <span>\/ 03<\/span>/);
  assert.match(html, /data-alternar hidden>Ver todas em lista/);
  assert.match(html, /<details class="legenda" open><summary>Legenda<\/summary><p>Texto &lt;b&gt;da&lt;\/b&gt; legenda<\/p><\/details>/);
  assert.equal((html.match(/class="legenda"/g) || []).length, 1, 'peça sem legenda não mostra o bloco');
  // A peça sem arte também mostra a legenda (antes do aviso), sem botões.
  const sem = paginaHtml(dados([peca('1'), peca('2', { arquivos: [], legenda: 'Sem arte ainda' })]), { nonce: 'n', base: '/x' });
  assert.match(sem, /<details class="legenda" open><summary>Legenda<\/summary><p>Sem arte ainda<\/p><\/details><p class="sem-arte">/);
  const script = html.match(/<script nonce="n">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /daFrente\(el\)/, 'só a peça da frente conta como vista');
});

test('página: com uma peça só, nada de palco em carrossel nem doca', () => {
  const html = paginaHtml(dados([peca('1')]), { nonce: 'n', base: '/x' });
  assert.doesNotMatch(html, /class="doca"/);
  assert.doesNotMatch(html, /class="alternar"/);
  assert.match(html, /data-palco/);
});
