// Ficha do bar da sinuca (Paulo, 04/11/2026: "ver os troféus que o outro cara
// tem... os tacos... ter o perfil do cara no bar"): números, tacos e troféus
// saem só das partidas terminadas.
import test from 'node:test';
// As partidas destes testes terminam agora: a sinuca zerada vale desde sempre aqui.
process.env.VYBE_SINUCA_ZERADA_EM = '2000-01-01T00:00:00Z';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { fichaSinuca } from '../server/escritorio-sinuca-conquistas.js';

const ler = (f) => readFileSync('migrations/' + f, 'utf8');

test('ficha do bar: sequência, bots derrubados, tacos ganhos e troféus', () => {
  const p = (desafiante, desafiado, resultado, extra = {}) => ({ desafiante, desafiado, resultado, bot: null, moedas: 0, ...extra });
  const partidas = [p(1, 3, 'desafiante'), p(3, 1, 'desafiado', { moedas: 50 }), p(1, 3, 'desafiante'), p(1, 3, 'desafiado'), p(1, 3, 'empate'),
    p(1, null, 'desafiante', { bot: 'sinuca:medio' }), p(1, null, 'desafiado', { bot: 'sinuca:lendario' })];
  const f = fichaSinuca(1, partidas, 2);
  assert.equal(f.vitorias, 3); assert.equal(f.derrotas, 1); assert.equal(f.maior_sequencia, 3); assert.equal(f.sequencia, 0);
  assert.deepEqual(f.bots, { facil: 0, medio: 1, lendario: 0 }, 'partida contra bot não entra nas vitórias da equipe');
  assert.deepEqual(f.tacos, ['casa', 'bronze', 'prata'], '2º no ranking: bronze e prata');
  assert.equal(f.taco, 'prata');
  const tem = Object.fromEntries(f.trofeus.map((t) => [t.chave, t.tem]));
  assert.ok(tem.primeira && tem.tio && tem.embalado && tem.valendo);
  assert.ok(!tem.baianinho && !tem.dono && !tem.imparavel);
  // Derrubar o Baianinho dá o taco Lenda; sem vitória na equipe não há posição.
  const lenda = fichaSinuca(5, [p(5, null, 'desafiante', { bot: 'sinuca:lendario' })], 1);
  assert.equal(lenda.posicao, null); assert.equal(lenda.taco, 'lenda'); assert.deepEqual(lenda.tacos, ['casa', 'lenda']);
  assert.equal(fichaSinuca(9, [], null).taco, 'casa');
});

test('ficha do bar: o salão e a partida levam a ficha de cada um', async (t) => {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(ler(f));
  await db.exec(`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,camada,movel,estado,resultado,terminado_em) VALUES
    ('sinuca','f-00000001',1,3,'jogos','m@1,1','fim','desafiante',now()-interval '3 hours'),('sinuca','f-00000002',3,1,'jogos','m@1,1','fim','desafiado',now()-interval '2 hours'),
    ('sinuca','f-00000003',3,7,'jogos','m@1,1','fim','desafiante',now()-interval '1 hours'),('domino','f-00000004',3,1,'jogos','m@1,1','fim','desafiante',now())`);
  const x = await import('../server/escritorio-mesas.js');
  const fichas = await x.fichasDoBar(sql, 'sinuca', ['1', '3', '7', 'x']);
  assert.deepEqual(Object.keys(fichas).sort(), ['1', '3', '7']);
  assert.equal(fichas['1'].posicao, 1); assert.equal(fichas['1'].taco, 'ouro'); assert.equal(fichas['1'].maior_sequencia, 2);
  assert.equal(fichas['3'].vitorias, 1, 'o dominó não conta'); assert.equal(fichas['7'].taco, 'casa');
  assert.deepEqual(await x.fichasDoBar(sql, 'domino', ['1']), {});
});

test('jornada dos bares: o Bar do Tio só abre depois de vencer o Zé', async (t) => {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(ler(f));
  const x = await import('../server/escritorio-mesas.js');
  await assert.rejects(x.desafiarBot(sql, { id: 1 }, { jogo: 'sinuca', nivel: 'medio', chave: 'jor-00000001' }), /Bar do Tio ainda está fechado/);
  let b = await x.botsDoJogo(sql, { id: 1 }, 'sinuca');
  assert.deepEqual(b.bares.map((p) => [p.nivel, p.aberto, p.vencido]), [['facil', true, false], ['medio', false, false], ['lendario', false, false]]);
  await db.exec(`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,bot,camada,movel,estado,resultado,terminado_em) VALUES ('sinuca','jor-venceu1',1,NULL,'sinuca:facil','jogos','m@1,1','fim','desafiante',now())`);
  b = await x.botsDoJogo(sql, { id: 1 }, 'sinuca');
  assert.deepEqual(b.bares.map((p) => p.aberto), [true, true, false]);
  const r = await x.desafiarBot(sql, { id: 1 }, { jogo: 'sinuca', nivel: 'medio', chave: 'jor-00000002' });
  assert.ok(r.id, 'entrou no Bar do Tio');
});
