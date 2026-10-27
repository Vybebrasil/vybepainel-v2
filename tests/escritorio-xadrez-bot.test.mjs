// Bot do xadrez dos Desafios (Paulo, 27/10/2026): o motor só joga lances que
// valem e enxerga o mate; na mesa, a partida contra o bot começa na hora com
// as cores sorteadas, o bot joga na vez dele, desistir dá a vitória ao bot e o
// mate da pessoa paga o prêmio do nível (dentro do teto do dia); a temporada e a
// escada de conquistas não contam partida contra bot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { lanceDoBotXadrez } from '../server/escritorio-xadrez-bot.js';
import { PREMIOS, botInfo } from '../server/escritorio-bots.js';

test('bot do xadrez: lances que valem, mate em 1 e não entrega a dama', () => {
 const legal = (lances, l) => { const c = new Chess(); for (const s of lances) c.move(s); return Boolean(c.move({ from: l.de, to: l.para, promotion: l.promocao })); };
 for (const nivel of ['facil', 'medio']) {
  const c = new Chess();
  for (let i = 0; i < 12 && !c.isGameOver(); i++) {
   const l = lanceDoBotXadrez(nivel, c.history());
   assert.ok(legal(c.history(), l), `${nivel} joga lance que vale`);
   c.move({ from: l.de, to: l.para, promotion: l.promocao });
  }
 }
 // Mate do pastor: o lendário vê (o médio às vezes joga ao acaso, de propósito).
 assert.deepEqual(lanceDoBotXadrez('lendario', ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']), { de: 'h5', para: 'f7' });
 // Dama atacada pelo peão: o lendário tira a dama dali.
 const l = lanceDoBotXadrez('lendario', ['e4', 'e5', 'Qh5', 'g6']);
 assert.equal(l.de, 'h5', 'a dama sai do ataque');
 assert.equal(botInfo('xadrez:lendario').nome, 'Mequinho');
});

test('xadrez contra bot: começa na hora, o bot joga, desistir, mate com prêmio, fora da temporada', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-xadrez.sql', '2026-10-27-escritorio-xadrez-relogio.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 const x = await import('../server/escritorio-xadrez.js');
 // Sem a migração do bot, a lista vem vazia e o desafio explica.
 assert.deepEqual((await x.botsDoXadrez(sql, { id: 1 })).bots, []);
 await assert.rejects(x.desafiarBotXadrez(sql, { id: 1 }, { nivel: 'facil', chave: 'xbot-00000001' }), /migração/);
 await db.exec(readFileSync('migrations/2026-10-28-escritorio-xadrez-bot.sql', 'utf8'));
 assert.equal((await x.botsDoXadrez(sql, { id: 1 })).bots.length, 3);
 await assert.rejects(x.desafiarBotXadrez(sql, { id: 1 }, { nivel: 'impossivel', chave: 'xbot-00000001' }), /não existe/);
 const saldo = async () => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=1`)[0]?.saldo || 0);

 // Começa na hora; se o bot ficou com as brancas, a tela pede o primeiro lance dele.
 let r = await x.desafiarBotXadrez(sql, { id: 1 }, { nivel: 'facil', camada: 'jogos', movel: 'CF_250_goldenchessboard@3,4', chave: 'xbot-00000001' });
 let j = r.jogo;
 assert.equal(j.estado, 'jogando'); assert.equal(j.bot.nome, 'Peão de Praça');
 assert.ok(j.eu, 'Paulo tem uma cor'); assert.equal(j[j.eu === 'brancas' ? 'pretas' : 'brancas'].id, 'bot');
 assert.ok(j.relogio, 'tem relógio');
 await assert.rejects(x.desafiarBotXadrez(sql, { id: 1 }, { nivel: 'medio', chave: 'xbot-00000002' }), /Termine/);
 if (j.vez !== j.eu) {
  j = (await x.vezDoBotXadrez(sql, { id: 1 }, { id: j.id, n: 0 })).jogo;
  assert.equal(j.lances.length, 1, 'o bot abriu');
  assert.equal((await x.vezDoBotXadrez(sql, { id: 1 }, { id: j.id, n: 0 })).jogo.lances.length, 1, 'pedido repetido não joga de novo');
 }
 assert.equal(j.vez, j.eu);
 // Contra o bot não tem empate; desistir dá a vitória a ele, sem prêmio.
 await assert.rejects(x.acaoXadrez(sql, { id: 1 }, { id: j.id, acao: 'empate' }), /não tem empate/);
 j = (await x.acaoXadrez(sql, { id: 1 }, { id: j.id, acao: 'desistir' })).jogo;
 assert.equal(j.estado, 'fim'); assert.notEqual(j.resultado, j.eu); assert.equal(await saldo(), 0);

 // Vitória: posição armada para Paulo dar mate em 1 com a cor que tirou.
 const ganhar = async (nivel, chave) => {
  const d = await x.desafiarBotXadrez(sql, { id: 1 }, { nivel, chave });
  const brancas = d.jogo.eu === 'brancas';
  const lances = brancas ? ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'] : ['f3', 'e5', 'g4'];
  await sql`UPDATE vybe_escritorio_xadrez SET lances=${JSON.stringify(lances)}::jsonb WHERE id=${d.id}`;
  return (await x.lanceXadrez(sql, { id: 1 }, brancas ? { id: d.id, de: 'h5', para: 'f7', n: 6 } : { id: d.id, de: 'd8', para: 'h4', n: 3 })).jogo;
 };
 j = await ganhar('lendario', 'xbot-00000003');
 assert.equal(j.estado, 'fim'); assert.equal(j.resultado, j.eu); assert.equal(j.motivo, 'mate');
 assert.deepEqual(j.premio_bot, { moedas: PREMIOS.lendario.moedas, xp: PREMIOS.lendario.xp, teto: false });
 assert.equal(await saldo(), PREMIOS.lendario.moedas);
 const b = await x.botsDoXadrez(sql, { id: 1 });
 assert.equal(b.bots.find((l) => l.nivel === 'lendario').vitorias, 1);
 assert.equal(b.resta_hoje, 80 - PREMIOS.lendario.moedas);

 // Temporada: vitória sobre o bot não conta.
 const { rankingDaTemporada, temporadaDe } = await import('../server/escritorio-temporadas.js');
 assert.deepEqual(await rankingDaTemporada(sql, 'xadrez', temporadaDe()), []);
});
