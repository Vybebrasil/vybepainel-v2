// Economia pelo volume (Paulo, 21/10/2026): fatias mais equilibradas, quem
// posta ganha a fatia do agendamento, penalidade tira moeda e XP (XP nunca
// abaixo de zero), ação no painel dá moeda até o teto do dia e preço em demandas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';

const ler = (f) => readFileSync('migrations/' + f, 'utf8');
async function banco(t) {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-19-escritorio-gestao-pontos.sql', '2026-10-20-escritorio-complexidade.sql', '2026-10-20-escritorio-bolo-por-peca.sql', '2026-10-20-escritorio-bolo-producao.sql']) await db.exec(ler(f));
  await db.exec(`CREATE TABLE IF NOT EXISTS vybe_escritorio_raridades (chave text PRIMARY KEY, ordem int, preco int);
    UPDATE vybe_escritorio_raridades SET preco=40;
    CREATE TABLE IF NOT EXISTS vybe_escritorio_kits (chave text PRIMARY KEY, desconto numeric);
    INSERT INTO vybe_escritorio_kits(chave,desconto) VALUES ('visual-chef',.15),('cozinha',.10) ON CONFLICT DO NOTHING;`);
  await db.exec(ler('2026-10-21-escritorio-volume.sql'));
  return { db, sql };
}
const ganho = async (sql, p, origem) => { const [m] = await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem=${origem}`; return m ? [Number(m.quantidade), Number(m.pontos)] : null; };

test('fatias fecham o bolo, Criação continua com a maior e os heads ficam acima da Produção', async (t) => {
  const { sql } = await banco(t);
  for (const tipo of ['normal', 'foto', 'video']) {
    const l = await sql`SELECT papel, fatia::float AS f FROM vybe_escritorio_fatias WHERE tipo=${tipo} AND papel <> 'direcao_arte' ORDER BY fatia DESC`;
    assert.equal(Math.round(l.reduce((s, x) => s + x.f, 0) * 100), 100, tipo);
    assert.equal(l[0].papel, 'criacao');
    const de = (p) => l.find((x) => x.papel === p)?.f || 0;
    assert.ok(de('atendimento') > de('producao'), tipo);
  }
  const precos = Object.fromEntries((await sql`SELECT chave, preco FROM vybe_escritorio_raridades`).map((r) => [r.chave, r.preco]));
  for (const [faixa, preco] of Object.entries({ comum: 15, incomum: 35, raro: 85, epico: 175, lendario: 350 })) if (faixa in precos) assert.equal(precos[faixa], preco, faixa);
  assert.equal(precos.comum, 15);
  assert.deepEqual((await sql`SELECT desconto::float AS d FROM vybe_escritorio_kits ORDER BY chave`).map((k) => k.d), [0.1, 0.2]);
});

test('quem posta recebe a fatia do agendamento, mesmo sem ser do Agendamento', async (t) => {
  const { db, sql } = await banco(t);
  // Card da Bia (7), cliente do Vinícius; a própria Bia agenda.
  await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(300,7829537690,'agendado','Card');
    INSERT INTO vybe_conteudo_responsaveis VALUES(300,7,0); INSERT INTO vybe_conteudo_clientes VALUES(300,1);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES
      (300,'status','Em andamento','Para aprovação',7),(300,'status','Para aprovação','Para agendar',4),(300,'status','Para agendar','Agendado',7);`);
  assert.deepEqual(await ganho(sql, 7, 'peca:300:agendamento'), [2, 3]);   // 15% de 10 (card, peso 1)
  assert.deepEqual(await ganho(sql, 3, 'peca:300:atendimento'), [3, 5]);   // 26%
  assert.deepEqual(await ganho(sql, 1, 'peca:300:gestao'), [1, 2]);        // 11%
});

test('alteração tira moeda e XP sem deixar o XP negativo; ação no painel paga até 10 por dia', async (t) => {
  const { db, sql } = await banco(t);
  await sql`SELECT vybe_lancar_pontos(6,'teste:inicio',NULL,NULL,10,3)`;
  await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(301,7829537690,'alteracao','Card');
    INSERT INTO vybe_conteudo_responsaveis VALUES(301,6,0);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(301,'status','Para aprovação','Alteração',4);`);
  const [alt] = await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE pessoa_id=6 AND regra='criacao_alteracao'`;
  assert.deepEqual([alt.quantidade, alt.pontos], [-2, -3]); // só tinha 3 de XP
  const [c] = await sql`SELECT saldo, xp FROM vybe_escritorio_carteiras WHERE pessoa_id=6`;
  assert.deepEqual([c.saldo, c.xp], [8, 0]);
  // 12 ações do Deivid (4) no mesmo dia: só 10 pagam (a alteração acima já foi uma).
  for (let i = 0; i < 11; i++) await sql`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(301,'campo','a','b',4)`;
  const [{ n, m }] = await sql`SELECT count(*)::int n, sum(quantidade)::int m FROM vybe_escritorio_moedas WHERE pessoa_id=4 AND regra='acao_painel'`;
  assert.deepEqual([n, m], [10, 10]);
  // Sem autor (automação) não paga.
  await sql`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(301,'campo','a','b',NULL)`;
  assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE regra='acao_painel'`)[0].n, 10);
});
