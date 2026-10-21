// Valor por papel (Paulo, 21/10/2026): cada papel ganha um valor fixo pela
// peça vezes o peso do formato; quem fez fica com o valor inteiro e o DA ganha
// por cima; quem posta leva a parte do agendamento; penalidade tira moeda e
// XP (nunca abaixo de zero); ação no painel paga até 10 por dia; acima de 600
// moedas na semana cada moeda conta metade; preço em cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';

const ler = (f) => readFileSync('migrations/' + f, 'utf8');
async function banco(t) {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-19-escritorio-gestao-pontos.sql', '2026-10-20-escritorio-complexidade.sql', '2026-10-20-escritorio-bolo-por-peca.sql', '2026-10-20-escritorio-bolo-producao.sql']) await db.exec(ler(f));
  await db.exec(`UPDATE vybe_escritorio_raridades SET preco=40;
    CREATE TABLE IF NOT EXISTS vybe_escritorio_kits (chave text PRIMARY KEY, desconto numeric);
    INSERT INTO vybe_escritorio_kits(chave,desconto) VALUES ('visual-chef',.15),('cozinha',.10) ON CONFLICT DO NOTHING;`);
  // Uma peça antiga já paga pela regra de antes, que o histórico refeito troca.
  await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(400,7829537690,'agendado','Card');
    INSERT INTO vybe_conteudo_responsaveis VALUES(400,7,0); INSERT INTO vybe_conteudo_clientes VALUES(400,1);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES
      (400,'status','Em andamento','Para aprovação',7),(400,'status','Para aprovação','Para agendar',4),(400,'status','Para agendar','Agendado',7);`);
  await db.exec(ler('2026-10-21-escritorio-valor-por-papel.sql'));
  return { db, sql };
}
const ganho = async (sql, p, origem) => { const [m] = await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem=${origem}`; return m ? [Number(m.quantidade), Number(m.pontos)] : null; };

test('card: quem fez 10, DA +15%, head 25%, quem postou 15%, geral 5%; o histórico é refeito', async (t) => {
  const { sql } = await banco(t);
  assert.deepEqual(await ganho(sql, 7, 'peca:400:criacao'), [10, 20]);     // quem fez fica com o valor inteiro
  assert.deepEqual(await ganho(sql, 4, 'peca:400:da'), [2, 3]);            // o DA ganha por cima
  assert.deepEqual(await ganho(sql, 3, 'peca:400:atendimento'), [3, 5]);   // head do cliente
  assert.deepEqual(await ganho(sql, 7, 'peca:400:agendamento'), [2, 3]);   // a própria Bia postou
  assert.deepEqual(await ganho(sql, 1, 'peca:400:gestao'), [1, 1]);        // geral
  // As ações do histórico entram (até 10 por dia).
  assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE pessoa_id=7 AND regra='acao_painel'`)[0].n, 2);
  // Saldo e XP batem com o razão.
  const [c] = await sql`SELECT sum(saldo)::int s, sum(xp)::int x FROM vybe_escritorio_carteiras`;
  const [r] = await sql`SELECT sum(quantidade)::int s, sum(pontos)::int x FROM vybe_escritorio_moedas`;
  assert.deepEqual([c.s, c.x], [r.s, r.x]);
});

test('pesos e preços pela régua do Paulo: Jukebox (raro) = 4 cards, 2 carrosséis, 2 vídeos ou 1 impresso', async (t) => {
  const { sql } = await banco(t);
  const peso = Object.fromEntries((await sql`SELECT chave, peso::float AS p FROM vybe_escritorio_complexidade`).map((r) => [r.chave, r.p]));
  const preco = Object.fromEntries((await sql`SELECT chave, preco FROM vybe_escritorio_raridades`).map((r) => [r.chave, r.preco]));
  const cards = (f) => preco.raro / (10 * peso[f]);
  assert.deepEqual([cards('card'), cards('carrossel'), cards('video'), cards('impresso')], [4, 2, 2, 1]);
  assert.ok(cards('fotografia') >= 6 && cards('fotografia') <= 8);
  assert.equal(preco.comum, 10);
  assert.equal(preco.lendario, 250);
  assert.deepEqual((await sql`SELECT desconto::float AS d FROM vybe_escritorio_kits ORDER BY chave`).map((k) => k.d), [0.1, 0.2]);
});

test('alteração tira moeda e XP sem negativo; ação no painel até 10 por dia; teto suave da semana', async (t) => {
  const { db, sql } = await banco(t);
  await sql`UPDATE vybe_escritorio_carteiras SET saldo=10, xp=3 WHERE pessoa_id=6`;
  await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo,xp) SELECT 6,10,3 WHERE NOT EXISTS (SELECT 1 FROM vybe_escritorio_carteiras WHERE pessoa_id=6)`;
  await db.exec(`INSERT INTO vybe_conteudos(id,board_id,status_chave,formato) VALUES(401,7829537690,'alteracao','Card');
    INSERT INTO vybe_conteudo_responsaveis VALUES(401,6,0);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(401,'status','Para aprovação','Alteração',4);`);
  const [alt] = await sql`SELECT quantidade, pontos FROM vybe_escritorio_moedas WHERE pessoa_id=6 AND regra='criacao_alteracao'`;
  assert.deepEqual([alt.quantidade, alt.pontos], [-2, -3]);
  for (let i = 0; i < 12; i++) await sql`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,autor_id) VALUES(401,'campo','a','b',4)`;
  const hoje = (await sql`SELECT vybe_dia_bahia(now())::text d`)[0].d;
  assert.equal((await sql`SELECT count(*)::int n FROM vybe_escritorio_moedas WHERE pessoa_id=4 AND regra='acao_painel' AND origem LIKE ${'acao:' + hoje + ':%'}`)[0].n, 10);
  // Teto suave: com 600 moedas na semana, um ganho de 10 conta 5.
  await sql`SELECT vybe_lancar_pontos(5,'teste:semana','briefing',NULL,600,0)`;
  await sql`SELECT vybe_lancar_pontos(5,'teste:depois','briefing',NULL,10,4)`;
  assert.deepEqual(await ganho(sql, 5, 'teste:depois'), [5, 4]);
});
