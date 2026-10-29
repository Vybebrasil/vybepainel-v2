// Bots dos Desafios (Paulo, 27/10/2026): cada bot joga partidas inteiras só
// com jogadas que valem; o lendário da velha não perde; na mesa, a partida
// contra o bot começa na hora, o bot joga na vez dele, desistir dá a vitória ao
// bot e ganhar paga VybeCoins e XP com teto por dia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { jogadaDoBot, NIVEIS, PREMIOS, TETO_DIA, botInfo } from '../server/escritorio-bots.js';
import { motorVelha } from '../server/escritorio-velha.js';
import { motorDama } from '../server/escritorio-dama.js';
import { motorDomino } from '../server/escritorio-domino.js';
import { motorTruco } from '../server/escritorio-truco.js';
import { motorPoker } from '../server/escritorio-poker.js';
import { motorSinuca } from '../server/escritorio-sinuca.js';

const MOTORES = { velha: motorVelha, dama: motorDama, domino: motorDomino, truco: motorTruco, poker: motorPoker };
function partidaDeBots(jogo, nivelA, nivelB, max = 4000) {
 const motor = MOTORES[jogo];
 let m = motor.iniciar(['desafiante', 'desafiado']);
 for (let i = 0; i < max; i++) {
  const lado = m.vez, nivel = lado === 'desafiante' ? nivelA : nivelB;
  const { mesa, fim } = motor.jogar(m, lado, jogadaDoBot(jogo, nivel, m, lado, motor.vista(m, lado, false)));
  if (fim) return fim;
  m = mesa;
 }
 return null;
}

test('bots: cada um joga uma partida inteira só com jogadas que valem', () => {
 for (const jogo of Object.keys(MOTORES)) for (const nivel of NIVEIS) {
  const fim = partidaDeBots(jogo, nivel, nivel);
  assert.ok(fim?.resultado, `${jogo} ${nivel} chega ao fim`);
 }
});

test('bots: o Invencível da velha não perde de quem marca ao acaso', () => {
 for (let k = 0; k < 15; k++) {
  const fim = partidaDeBots('velha', 'facil', 'lendario');
  assert.notEqual(fim.resultado, 'desafiante', 'o fácil (ao acaso) não ganha do lendário');
 }
});

test('bots: o Baianinho encaçapa pelo menos tanto quanto o Zé nos mesmos cenários', () => {
 // Compara situações idênticas e a mesma sequência de erro da mão. Partidas
 // aleatórias de quatro tacadas confundiam dificuldade com sorte da saída.
 const cenarios=[[[85,35],[95,45],[50,12]],[[15,35],[5,45],[50,12]],[[50,20],[50,5],[75,30]]];
 const original=Math.random;
 try{
  const encacapadas=(nivel)=>cenarios.reduce((total,[branca,alvo,outra],i)=>{
   let seed=12345+i;Math.random=()=>((seed=(seed*16807)%2147483647)-1)/2147483646;
   const m=motorSinuca.iniciar('desafiante');m.bolas=Array(16).fill(null);
   m.bolas[0]=branca;m.bolas[2]=alvo;m.bolas[4]=outra;m.bolas[1]=[1.431,25];
   m.bolaNaMao=false;m.tacadas=5;
   const pedido=jogadaDoBot('sinuca',nivel,m,m.vez,motorSinuca.vista(m,m.vez,false));
   const r=motorSinuca.jogar(m,m.vez,pedido);
   return total+r.mesa.ultimo.caiu.filter(n=>n&&n!==1).length;
  },0);
  const lendario=encacapadas('lendario'),facil=encacapadas('facil');
  assert.equal(botInfo('sinuca:lendario').nome,'Baianinho');
  assert.ok(lendario>0,'o lendário precisa converter oportunidades abertas');
  assert.ok(lendario>=facil,`cenários iguais: lendário ${lendario}, fácil ${facil}`);
 }finally{Math.random=original;}
});

test('mesa contra bot: começa na hora, o bot joga, desistir e vitória com prêmio e teto', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-mesas-jogos-novos.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 const x = await import('../server/escritorio-mesas.js');
 const saldo = async () => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=1`)[0]?.saldo || 0);
 await assert.rejects(x.desafiarBot(sql, { id: 1 }, { jogo: 'velha', nivel: 'impossivel', chave: 'bot-00000000' }), /não existe/);
 // Começa na hora, com o bot de nome e avatar.
 let r = await x.desafiarBot(sql, { id: 1 }, { jogo: 'velha', nivel: 'facil', camada: 'jogos', movel: 'hobbies_c26_gamingtable@15,8', chave: 'bot-00000001' });
 assert.equal(r.jogo.estado, 'jogando'); assert.equal(r.jogo.bot.nome, 'Bebê'); assert.equal(r.jogo.desafiado.nome, 'Bebê');
 await assert.rejects(x.desafiarBot(sql, { id: 1 }, { jogo: 'velha', nivel: 'medio', chave: 'bot-00000002' }), /Termine/);
 // Na vez do bot, a tela pede e ele joga.
 if (r.jogo.vez === 'desafiado') r = await x.vezDoBot(sql, { id: 1 }, { id: r.jogo.id, n: r.jogo.n });
 assert.equal(r.jogo.vez, 'desafiante');
 // Contra bot não tem empate; desistir dá a vitória ao bot e não paga nada.
 await assert.rejects(x.acaoMesa(sql, { id: 1 }, { id: r.jogo.id, acao: 'empate' }), /não tem empate/);
 r = { jogo: (await x.acaoMesa(sql, { id: 1 }, { id: r.jogo.id, acao: 'desistir' })).jogo };
 assert.equal(r.jogo.estado, 'fim'); assert.equal(r.jogo.resultado, 'desafiado'); assert.equal(await saldo(), 0);
 // Vitória: a velha armada para Paulo fechar a linha na última rodada.
 const ganhar = async (nivel, chave) => {
  const d = await x.desafiarBot(sql, { id: 1 }, { jogo: 'velha', nivel, chave });
  const s = (await sql`SELECT mesa FROM vybe_escritorio_partidas WHERE id=${d.id}`)[0].mesa;
  const eu = s.simbolos.desafiante, ele = s.simbolos.desafiado;
  const mesa = { ...s, tab: [eu, eu, null, ele, ele, null, null, null, null], vez: 'desafiante', placar: { desafiante: s.alvo - 1, desafiado: 0 } };
  await sql`UPDATE vybe_escritorio_partidas SET mesa=${JSON.stringify(mesa)}::jsonb WHERE id=${d.id}`;
  return (await x.lanceMesa(sql, { id: 1 }, { id: d.id, n: mesa.n, tipo: 'marcar', casa: 2 })).jogo;
 };
 let j = await ganhar('lendario', 'bot-00000003');
 assert.equal(j.estado, 'fim'); assert.equal(j.resultado, 'desafiante');
 assert.deepEqual(j.premio_bot, { moedas: PREMIOS.lendario.moedas, xp: PREMIOS.lendario.xp, teto: false });
 assert.equal(await saldo(), PREMIOS.lendario.moedas);
 // O teto do dia: a próxima vitória só paga o que falta até ele.
 j = await ganhar('lendario', 'bot-00000004');
 assert.equal(j.premio_bot.moedas, TETO_DIA - PREMIOS.lendario.moedas); assert.equal(j.premio_bot.teto, true);
 j = await ganhar('medio', 'bot-00000005');
 assert.equal(j.premio_bot.moedas, 0, 'teto do dia batido');
 assert.equal(await saldo(), TETO_DIA);
 const b = await x.botsDoJogo(sql, { id: 1 }, 'velha');
 assert.equal(b.resta_hoje, 0); assert.equal(b.bots.find((l) => l.nivel === 'lendario').vitorias, 2);
});

test('temporada: vitórias contra pessoas (3 por colega por dia), sem bots, e o fechamento paga o top 3 uma vez', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-mesas-jogos-novos.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 const { rankingDaTemporada, fecharTemporadas, verTemporada, temporadaDe } = await import('../server/escritorio-temporadas.js');
 const partida = (k, desafiante, desafiado, resultado, quando, bot = null) => db.exec(`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,bot,camada,movel,estado,resultado,terminado_em)
  VALUES('domino','t-${String(k).padStart(8, '0')}',${desafiante},${desafiado ?? 'NULL'},${bot ? `'${bot}'` : 'NULL'},'jogos','m@1,1','fim','${resultado}','${quando}')`);
 // Temporada de 16 a 31/10: Paulo ganha 5 de Vinícius no mesmo dia (contam 3) e 1 de Bia; Bia ganha 2 de Paulo; vitória sobre bot não conta.
 let k = 0;
 for (let i = 0; i < 5; i++) await partida(++k, 1, 3, 'desafiante', '2026-10-20T15:00:00-03:00');
 await partida(++k, 1, 7, 'desafiante', '2026-10-21T15:00:00-03:00');
 await partida(++k, 7, 1, 'desafiante', '2026-10-22T15:00:00-03:00');
 await partida(++k, 1, 7, 'desafiado', '2026-10-23T15:00:00-03:00');
 await partida(++k, 3, null, 'desafiante', '2026-10-23T16:00:00-03:00', 'domino:lendario');
 const r = await rankingDaTemporada(sql, 'domino', { inicio: '2026-10-16', fim: '2026-11-01' });
 assert.deepEqual(r.map((p) => [p.pessoa_id, p.vitorias]), [['1', 4], ['7', 2]], 'Paulo 3+1, Bia 2; Vinícius só ganhou do bot');
 // A virada: a primeira leitura em novembro paga a temporada de outubro, e só uma vez.
 const nov = new Date('2026-11-02T10:00:00-03:00');
 assert.equal(temporadaDe(nov).inicio, '2026-11-01');
 await fecharTemporadas(sql, nov);
 await fecharTemporadas(sql, nov);
 const pagos = await sql`SELECT posicao, pessoa_id FROM vybe_escritorio_temporadas WHERE jogo='domino' ORDER BY posicao`;
 assert.deepEqual(pagos.map((l) => [l.posicao, String(l.pessoa_id)]), [[1, '1'], [2, '7']]);
 const saldo = async (p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0]?.saldo || 0);
 assert.deepEqual([await saldo(1), await saldo(7), await saldo(3)], [150, 80, 0]);
 const v = await verTemporada(sql, { id: 7 }, 'domino', nov);
 assert.equal(v.inicio, '2026-11-01'); assert.deepEqual(v.anterior.campeoes.map((c) => c.nome), ['Paulo Martins', 'Beatriz Rocha Cardoso']);
 assert.equal(v.premios[0].moedas, 150);
});
