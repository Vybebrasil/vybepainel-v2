// Venda à loja pelo valor pago e reembolso da construção que ficou grátis
// (migrations/2026-10-26-escritorio-construcao-livre-e-venda.sql).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio as banco } from './escritorio-esquema.mjs';
import { comprarMovel, venderMovel, carregarEconomia, MOVEIS_DE_CONSTRUCAO } from '../server/escritorio-economia.js';

const MIGRACAO = readFileSync('migrations/2026-10-26-escritorio-construcao-livre-e-venda.sql', 'utf8');
const saldo = async (sql, p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0]?.saldo || 0);
const inventario = async (sql, p, c) => Number((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${c}`)[0]?.quantidade || 0);
const creditar = (sql, p, n) => sql`SELECT vybe_lancar_pontos(${p},${'teste:' + crypto.randomUUID()},NULL,NULL,${n},0)`;
const SALAS = [{ id: 'sala-0', pessoa_id: '1' }];
const PAULO = { id: 1 };

test('vende de volta só o que comprou, guardado, pelo valor pago; repetir não paga de novo', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(MIGRACAO);
  await creditar(sql, 1, 1000);
  await comprarMovel(sql, 1, { classe: 'shelves_norja', chave: crypto.randomUUID(), quantidade: 2 });
  const raro = (await sql`SELECT classe FROM vybe_escritorio_catalogo WHERE raridade='raro' AND marco IS NULL ORDER BY classe LIMIT 1`)[0].classe;
  await comprarMovel(sql, 1, { classe: raro, chave: crypto.randomUUID() });
  assert.equal(await saldo(sql, 1), 1000 - 50 - 120);
  const eco = await carregarEconomia(sql, 1);
  assert.deepEqual(eco.vendiveis.shelves_norja, [[2, 25]], 'a ficha sabe quantas voltam e por quanto');

  const chave = crypto.randomUUID();
  let r = await venderMovel(sql, PAULO, SALAS, { classe: 'shelves_norja', chave, valorEsperado: 25 });
  assert.equal(r.valor, 25);
  assert.equal(await saldo(sql, 1), 855);
  assert.equal(await inventario(sql, 1, 'shelves_norja'), 1);
  r = await venderMovel(sql, PAULO, SALAS, { classe: 'shelves_norja', chave });
  assert.equal(r.repetido, true);
  assert.equal(await saldo(sql, 1), 855, 'a mesma chave não vende duas vezes');
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: raro, chave }), /já utilizado/);

  // Peça limitada volta ao estoque da loja.
  const [antes] = await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;
  await venderMovel(sql, PAULO, SALAS, { classe: raro, chave: crypto.randomUUID() });
  const [depois] = await sql`SELECT vendidos FROM vybe_escritorio_catalogo WHERE classe=${raro}`;
  assert.equal(Number(depois.vendidos), Number(antes.vendidos) - 1);
  assert.equal(await saldo(sql, 1), 975);

  // No quarto não se vende; o que não foi comprado (prêmio) também não.
  await sql`INSERT INTO vybe_escritorio_mapa(camada,itens,versao) VALUES('sala-0',${JSON.stringify([['shelves_norja', 1, 1, 2, 0, 0]])}::jsonb,1)
    ON CONFLICT (camada) DO UPDATE SET itens=EXCLUDED.itens`;
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: 'shelves_norja', chave: crypto.randomUUID() }), /Guarde a unidade/);
  await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,'bling_sofa_mu',1)`;
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: 'bling_sofa_mu', chave: crypto.randomUUID() }), /comprado na loja/);
  // Valor diferente do mostrado na ficha: recusa, sem vender.
  await sql`UPDATE vybe_escritorio_mapa SET itens='[]'::jsonb WHERE camada='sala-0'`;
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: 'shelves_norja', chave: crypto.randomUUID(), valorEsperado: 99 }), /valor mudou/);
  assert.equal(await inventario(sql, 1, 'shelves_norja'), 1);
  // Grátis não se vende.
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: MOVEIS_DE_CONSTRUCAO[0], chave: crypto.randomUUID() }), /não se vende/);
  // Venda não conta como ganho no extrato da semana.
  assert.ok(!(await sql`SELECT 1 FROM vybe_escritorio_moedas WHERE origem LIKE 'venda:%' AND regra IS NOT NULL`).length);
});

test('presente dado conta como unidade que saiu: não se vende o que já foi dado', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(readFileSync('migrations/2026-10-18-escritorio-postits-presentes.sql', 'utf8'));
  await db.exec(MIGRACAO);
  await creditar(sql, 1, 100);
  await comprarMovel(sql, 1, { classe: 'shelves_norja', chave: crypto.randomUUID() });
  // Deu a comprada e ganhou outra de presente: a que sobrou não é comprada.
  await sql`INSERT INTO vybe_escritorio_presentes(chave,de_pessoa,para_pessoa,classe) VALUES('presente-teste-1',1,2,'shelves_norja')`;
  assert.equal((await carregarEconomia(sql, 1)).vendiveis.shelves_norja, undefined);
  await assert.rejects(venderMovel(sql, PAULO, SALAS, { classe: 'shelves_norja', chave: crypto.randomUUID() }), /comprado na loja/);
});

test('reembolso da construção: devolve uma vez por compra, sem tocar no resto, e não repete', async (t) => {
  const { db, sql } = await banco(t);
  await creditar(sql, 1, 500);
  // Compra antiga de um bloco (antes de ficar grátis) e de um móvel comum.
  const bloco = MOVEIS_DE_CONSTRUCAO.find((c) => /^bc_wood/.test(c)) || MOVEIS_DE_CONSTRUCAO[0];
  await sql`UPDATE vybe_escritorio_carteiras SET saldo=saldo-75 WHERE pessoa_id=1`;
  await sql`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(1,${'compra:' + crypto.randomUUID() + '-q3:' + bloco},-75)`;
  await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,${bloco},3)`;
  await comprarMovel(sql, 1, { classe: 'shelves_norja', chave: crypto.randomUUID() });
  assert.equal(await saldo(sql, 1), 400);
  await db.exec(MIGRACAO);
  assert.equal(await saldo(sql, 1), 475, 'os 75 do bloco voltam; o móvel comum não');
  assert.equal(await inventario(sql, 1, bloco), 0, 'o bloco agora é essencial, sem unidades no inventário');
  assert.equal(await inventario(sql, 1, 'shelves_norja'), 1);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_escritorio_moedas WHERE origem LIKE 'reembolso:compra:%'`)[0].n, 1);
  await db.exec(MIGRACAO);
  assert.equal(await saldo(sql, 1), 475, 'rodar de novo não devolve outra vez');
});
