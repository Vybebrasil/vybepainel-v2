// Conquistas mais difíceis (Paulo, 21/10/2026): metas maiores, prêmio por
// nível na tabela, escadas novas e títulos. A revisão tira só os níveis que a
// meta nova não alcança ("não zera todos"), com o troféu, inclusive do quarto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { conferirMarcos, revisarNiveisEscritorio, titulosDaPessoa, tituloDe } from '../server/escritorio-marcos.js';

const ler = (f) => readFileSync('migrations/' + f, 'utf8');
const inventario = async (sql, p, classe) => Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${classe}`)[0]?.quantidade || 0);
async function banco(t) {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-19-escritorio-gestao-pontos.sql', '2026-10-20-escritorio-complexidade.sql', '2026-10-20-escritorio-bolo-por-peca.sql', '2026-10-20-escritorio-conquistas-niveis.sql', '2026-10-20-escritorio-conquistas-producao.sql']) await db.exec(ler(f));
  return { db, sql };
}
const cards = (db, pessoa, de, ate) => db.exec(`INSERT INTO vybe_conteudos(id,board_id,formato) SELECT n,7829537690,'Card' FROM generate_series(${de},${ate}) n;
  INSERT INTO vybe_escritorio_entregas(pessoa_id,origem,regra,conteudo_id,dia) SELECT ${pessoa},'peca:'||n||':criacao','peca_criacao',n,current_date FROM generate_series(${de},${ate}) n;`);

test('metas sobem uma vez só, prêmio por nível na tabela e escadas novas', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(ler('2026-10-21-escritorio-conquistas-dificeis.sql'));
  await db.exec(ler('2026-10-21-escritorio-conquistas-dificeis.sql'));
  const metas = (await sql`SELECT nivel, meta, moedas, pontos FROM vybe_escritorio_trofeus WHERE marco='cards' ORDER BY nivel`).map((r) => [r.meta, r.moedas, r.pontos]);
  assert.deepEqual(metas.map((m) => m[0]), [40, 180, 600, 1500], 'Prata ×1,5, Ouro ×2, Diamante ×2,5, rodando a migração duas vezes');
  assert.deepEqual(metas.map((m) => m[1]), [10, 20, 40, 100]);
  assert.deepEqual((await sql`SELECT DISTINCT marco FROM vybe_escritorio_trofeus WHERE marco IN ('impressos','meta_turbo','podio','painel') ORDER BY 1`).map((r) => r.marco), ['impressos', 'meta_turbo', 'painel', 'podio']);
  // Bronze de Cards paga o valor da tabela e libera o título.
  await cards(db, 3, 1, 40);
  const lista = await conferirMarcos(sql, 3, new Date());
  const c = lista.find((m) => m.id === 'cards');
  assert.equal(c.nivel, 1);
  assert.equal(c.titulo, 'Aprendiz de Cards');
  assert.equal(c.degraus[2].titulo, 'Máquina de Cards');
  assert.deepEqual((await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE origem='conquista:cards:1'`).map((r) => [r.quantidade, r.pontos]), [[10, 25]]);
  assert.deepEqual((await titulosDaPessoa(sql, 3)).map((x) => x.texto), ['Aprendiz de Cards']);
  assert.equal(tituloDe('impressos', 3), 'Rei do Impresso');
});

test('revisão tira só o nível perdido, com o troféu do quarto, e não repete', async (t) => {
  const { db, sql } = await banco(t);
  // 130 cards: pela regra antiga, Bronze (40) e Prata (120).
  await cards(db, 3, 1, 130);
  await conferirMarcos(sql, 3, new Date());
  assert.equal(await inventario(sql, 3, 'trophy_viraldancer_silver'), 1);
  // A Prata está exposta no quarto da pessoa.
  await db.exec(`INSERT INTO vybe_escritorio_mapa(camada,itens,atualizado_por) VALUES('sala-3','[["trophy_viraldancer_silver",2,2,0,2],["trophy_viraldancer_bronze",3,2,0,2]]'::jsonb,3)`);
  const [antes] = await sql`SELECT saldo, xp FROM vybe_escritorio_carteiras WHERE pessoa_id=3`;
  const [pago] = await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE origem='conquista:cards:2'`;
  await db.exec(ler('2026-10-21-escritorio-conquistas-dificeis.sql'));
  const r = await revisarNiveisEscritorio(sql, 'teste-dificeis', { tirarDoQuarto: true });
  assert.equal(r.tirados, 1, 'só a Prata: 130 não chega a 180');
  assert.deepEqual((await sql`SELECT marco FROM vybe_escritorio_marcos WHERE pessoa_id=3 ORDER BY 1`).map((x) => x.marco), ['cards:1']);
  assert.equal(await inventario(sql, 3, 'trophy_viraldancer_silver'), 0);
  assert.equal(await inventario(sql, 3, 'trophy_viraldancer_bronze'), 1, 'o Bronze fica');
  const [mapa] = await sql`SELECT itens FROM vybe_escritorio_mapa WHERE camada='sala-3'`;
  assert.deepEqual(mapa.itens.map((i) => i[0]), ['trophy_viraldancer_bronze'], 'a Prata sai do quarto');
  const [depois] = await sql`SELECT saldo, xp FROM vybe_escritorio_carteiras WHERE pessoa_id=3`;
  assert.deepEqual([Number(depois.saldo), Number(depois.xp)], [Math.max(0, antes.saldo - pago.quantidade), Math.max(0, antes.xp - pago.pontos)]);
  assert.equal((await revisarNiveisEscritorio(sql, 'teste-dificeis', { tirarDoQuarto: true })).repetida, true);
});
