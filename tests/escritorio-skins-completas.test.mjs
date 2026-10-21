// Raridade das roupas pelo desenho, skins completas e personagens recriados
// (Paulo, 21/10/2026): o diferente e o animado custam mais, roupa não esgota,
// a skin cobra só o que falta no corpo de quem compra e o reinício é uma vez só.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio as banco } from './escritorio-esquema.mjs';
import { comprarKit, carregarLoja, infoMovel } from '../server/escritorio-economia.js';
import { roupasDaPessoa } from '../server/escritorio-roupas.js';

const AGORA = new Date();
const creditar = (sql, p, n) => sql`SELECT vybe_lancar_pontos(${p},${'teste:' + crypto.randomUUID()},NULL,NULL,${n},0)`;
async function comTudo(t) {
  const b = await banco(t);
  for (const f of ['2026-10-20-escritorio-kits.sql', '2026-10-20-escritorio-economia.sql', '2026-10-21-escritorio-skins.sql'])
    await b.db.exec(readFileSync('migrations/' + f, 'utf8'));
  return b;
}
const migracao = readFileSync('migrations/2026-10-21-escritorio-roupas-raridade.sql', 'utf8');

test('o diferente e o animado sobem de faixa, a cabeça especial deixa de ser grátis e roupa não esgota', async (t) => {
  const { db, sql } = await comTudo(t);
  await db.exec(migracao);
  const faixa = async (c) => (await sql`SELECT raridade, preco FROM vybe_escritorio_catalogo WHERE classe=${c}`)[0];
  // Darkaura animada: Lendário; cabeça de robô (rosto livre antes): Épico paga.
  assert.equal((await faixa('roupa:mc-6562'))?.raridade, 'lendario');
  assert.deepEqual(await faixa('roupa:hd-3704'), { raridade: 'epico', preco: null });
  // Rosto comum continua grátis.
  assert.equal((await faixa('roupa:hd-180'))?.preco, 0);
  // Peça Rara de roupa não tem estoque nem vitrine, mesmo com a faixa limitada.
  const loja = await carregarLoja(sql, AGORA);
  const info = infoMovel(loja, 'roupa:hd-3704');
  assert.equal(info.restante, null);
  assert.equal(info.naVitrine, true);
  assert.ok(info.preco >= 900);
});

test('skin completa: visual dos dois corpos, paga só o que falta no corpo de quem compra', async (t) => {
  const { db, sql } = await comTudo(t);
  await db.exec(migracao);
  const r = await roupasDaPessoa(sql, 1);
  const chef = r.kits.find((k) => k.chave === 'visual-chef');
  assert.ok(chef.visual.M.includes('ch-3931') && chef.visual.F.includes('ch-3932'));
  assert.ok(!r.kits.some((k) => k.chave === 'skin-lobo'), 'os kits de duas peças saem da vitrine');
  assert.ok(chef.corpos.M.preco > 0 && chef.corpos.M.faltam < chef.classes.length);
  await creditar(sql, 1, 50000);
  await comprarKit(sql, 1, { kit: 'visual-chef', chave: crypto.randomUUID(), corpo: 'M' }, AGORA);
  const meus = (await roupasDaPessoa(sql, 1)).meus;
  assert.ok(meus.includes('roupa:ch-3931'));
  assert.ok(!meus.includes('roupa:ch-3932'), 'a camisa do outro corpo não entra');
  await assert.rejects(comprarKit(sql, 1, { kit: 'visual-chef', chave: crypto.randomUUID(), corpo: 'M' }, AGORA), /já tem todas/);
});

test('personagens recriados uma vez: guarda o visual, limpa visual, looks e abertura; quarto fica', async (t) => {
  const { db, sql } = await comTudo(t);
  await sql`INSERT INTO vybe_escritorio_perfis(pessoa_id, preferencias) VALUES (1, ${JSON.stringify({ figura: 'hd-3704-1.ch-5229-1', looks: [{ figura: 'hd-180-1' }], abertura: 'x', quarto_configurado: true, sala_planta: 'q' })}::jsonb)`;
  await db.exec(migracao);
  const [p] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=1`;
  assert.equal(p.preferencias.figura, undefined);
  assert.equal(p.preferencias.abertura, undefined);
  assert.equal(p.preferencias.quarto_configurado, true);
  const [g] = await sql`SELECT perfis FROM vybe_escritorio_personagens_reinicio WHERE chave='personagens-2026-10-21'`;
  assert.equal(g.perfis[0].figura, 'hd-3704-1.ch-5229-1');
  // Rodar de novo não apaga o visual feito depois.
  await sql`UPDATE vybe_escritorio_perfis SET preferencias = preferencias || '{"figura":"hd-180-1"}'::jsonb WHERE pessoa_id=1`;
  await db.exec(migracao);
  assert.equal((await sql`SELECT preferencias->>'figura' AS f FROM vybe_escritorio_perfis WHERE pessoa_id=1`)[0].f, 'hd-180-1');
});
