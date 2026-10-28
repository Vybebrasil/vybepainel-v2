// Dama, jogo da velha e truco nas mesas do Escritório: as regras de cada um
// e a Mesa de Jogos listando qualquer jogo que esteja rolando nela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { lancesDama, tabuleiroInicial, jogarDama } from '../server/escritorio-dama.js';
import { iniciarVelha, jogarVelha } from '../server/escritorio-velha.js';
import { manilhaDa, vencedorDaMao, iniciarTruco, jogarTruco, vistaTruco } from '../server/escritorio-truco.js';

const sq = (r, c) => r * 8 + c, A = 'desafiante', B = 'desafiado', E = 'empate';

test('dama: lances de saída, captura para trás, lei da maioria, dama voadora e coroação', () => {
  assert.equal(lancesDama(tabuleiroInicial(), 'brancas').length, 7);
  let t = Array(64).fill(null); t[sq(3, 2)] = 'b'; t[sq(4, 3)] = 'p';
  assert.deepEqual(lancesDama(t, 'brancas').map((l) => [l.para, l.capturadas]), [[sq(5, 4), [sq(4, 3)]]], 'a comum captura para trás');
  t = Array(64).fill(null); t[sq(5, 0)] = 'b'; t[sq(4, 1)] = 'p'; t[sq(2, 3)] = 'p'; t[sq(5, 6)] = 'b'; t[sq(4, 7)] = 'p';
  assert.deepEqual(lancesDama(t, 'brancas').map((l) => [l.de, l.capturadas.length]), [[sq(5, 0), 2]], 'só a sequência maior vale');
  t = Array(64).fill(null); t[sq(7, 0)] = 'B'; t[sq(4, 3)] = 'p';
  assert.deepEqual(lancesDama(t, 'brancas').map((l) => l.para), [sq(3, 4), sq(2, 5), sq(1, 6), sq(0, 7)]);
  // Coroa ao terminar na última fileira; o outro sem peça perde.
  t = Array(64).fill(null); t[sq(1, 2)] = 'b'; t[sq(6, 5)] = 'p';
  const m = { tab: t, cores: { [A]: 'brancas', [B]: 'pretas' }, vez: A, semProgresso: 0, n: 0, ultimo: null };
  const r = jogarDama(m, A, { tipo: 'mover', de: sq(1, 2), para: sq(0, 1) });
  assert.equal(r.mesa.tab[sq(0, 1)], 'B');
  assert.throws(() => jogarDama({ ...m, tab: (() => { const x = Array(64).fill(null); x[sq(5, 0)] = 'b'; x[sq(4, 1)] = 'p'; x[sq(5, 6)] = 'b'; return x; })() }, A, { tipo: 'mover', de: sq(5, 6), para: sq(4, 5) }), /Captura é obrigatória/);
  const ultima = jogarDama({ ...m, tab: (() => { const x = Array(64).fill(null); x[sq(5, 0)] = 'b'; x[sq(4, 1)] = 'p'; return x; })() }, A, { tipo: 'mover', de: sq(5, 0), para: sq(3, 2) });
  assert.deepEqual(ultima.fim, { resultado: A, motivo: 'dama-sem-lances' });
});

test('jogo da velha: rodada, velha e melhor de 5', () => {
  let m = iniciarVelha(A);
  assert.throws(() => jogarVelha(m, B, { tipo: 'marcar', casa: 0 }), /vez da outra/);
  for (const [l, c] of [[A, 0], [B, 3], [A, 1], [B, 4]]) m = jogarVelha(m, l, { tipo: 'marcar', casa: c }).mesa;
  assert.throws(() => jogarVelha(m, A, { tipo: 'marcar', casa: 4 }), /já está marcada/);
  let r = jogarVelha(m, A, { tipo: 'marcar', casa: 2 });
  assert.deepEqual(r.mesa.placar, { [A]: 1, [B]: 0 });
  assert.equal(r.mesa.rodada, 2); assert.equal(r.mesa.vez, B, 'a próxima rodada começa com o outro');
  assert.deepEqual(r.mesa.anterior.linha, [0, 1, 2]);
  // Com 2 a 0, a terceira vitória fecha a partida.
  r = jogarVelha({ ...r.mesa, placar: { [A]: 0, [B]: 2 }, tab: [null, 'X', 'X', null, null, null, null, null, null], simbolos: { [B]: 'X', [A]: 'O' } }, B, { tipo: 'marcar', casa: 0 });
  assert.deepEqual(r.fim, { resultado: B, motivo: 'velha-placar' });
});

test('truco: manilha, rodadas, pedidos e quem corre', () => {
  assert.equal(manilhaDa('3o'), '4'); assert.equal(manilhaDa('7p'), 'Q');
  assert.equal(vencedorDaMao([A, A]), A); assert.equal(vencedorDaMao([E, B]), B); assert.equal(vencedorDaMao([A, E]), A);
  assert.equal(vencedorDaMao([A, B]), null); assert.equal(vencedorDaMao([A, B, E]), A); assert.equal(vencedorDaMao([E, E, E]), E);
  // Baralho arrumado: A tem o zap (4p com vira 3), B só cartas baixas.
  const baralho = ['4p', 'Kc', 'Ko', '5o', '6o', '7e', '3e', ...Array(33).fill('Qe')];
  let m = iniciarTruco(A, baralho);
  assert.equal(m.manilha, '4');
  assert.equal(vistaTruco(m, B, false).minhas.length, 3); assert.equal(vistaTruco(m, null, false).minhas, null);
  let r = jogarTruco(m, A, { tipo: 'truco' });
  assert.equal(vistaTruco(r.mesa, B, false).acoes.responder, 3);
  assert.throws(() => jogarTruco(r.mesa, B, { tipo: 'jogar', carta: '5o' }), /Responda o pedido/);
  r = jogarTruco(r.mesa, B, { tipo: 'aceitar' });
  assert.equal(r.mesa.vale, 3); assert.equal(r.mesa.vez, A);
  assert.equal(vistaTruco(r.mesa, A, false).acoes.truco, null, 'quem pediu não pede de novo antes do outro');
  r = jogarTruco(r.mesa, A, { tipo: 'jogar', carta: '4p' });
  r = jogarTruco(r.mesa, B, { tipo: 'jogar', carta: '5o' });
  assert.equal(r.mesa.rodadas[0].vencedor, A, 'o zap ganha');
  r = jogarTruco(r.mesa, A, { tipo: 'jogar', carta: 'Kc' });
  r = jogarTruco(r.mesa, B, { tipo: 'jogar', carta: '6o' });
  assert.equal(r.fim, null);
  assert.deepEqual(r.mesa.pontos, { [A]: 3, [B]: 0 }, 'ganhou duas rodadas: leva os 3 do truco');
  assert.equal(r.mesa.mao, 2); assert.equal(r.mesa.pe, B, 'o pé troca');
  // Correr dá ao outro o que valia antes do pedido.
  r = jogarTruco(r.mesa, B, { tipo: 'truco' });
  r = jogarTruco(r.mesa, A, { tipo: 'correr' });
  assert.deepEqual(r.mesa.pontos, { [A]: 3, [B]: 1 });
  // A chega a 11 ganhando a mão: a seguinte é mão de onze (vale 3, sem truco).
  m = iniciarTruco(A, baralho); m.pontos = { [A]: 10, [B]: 4 };
  for (const [l, c] of [[A, '4p'], [B, '5o'], [A, 'Kc'], [B, '6o']]) m = jogarTruco(m, l, { tipo: 'jogar', carta: c }).mesa;
  assert.deepEqual(m.pontos, { [A]: 11, [B]: 4 });
  assert.equal(m.vale, 3);
  const v = vistaTruco(m, m.vez, false);
  assert.equal(v.mao_de_onze, true); assert.equal(v.acoes.truco, null);
  assert.throws(() => jogarTruco(m, m.vez, { tipo: 'truco' }), /mão de onze/);
});

test('Mesa de Jogos: dama pela mesa genérica e a lista de todos os jogos', async (t) => {
  const { db, sql } = await bancoEscritorio(t);
  for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-mesas-jogos-novos.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
  const x = await import('../server/escritorio-mesas.js');
  const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
  const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Bia' }]);
  const MESA = { camada: 'jogos', movel: 'hobbies_c26_gamingtable@5,6' };
  const d = await x.desafiarMesa(sql, { id: 1 }, salas, { jogo: 'dama', para: '3', ...MESA, chave: 'dama-00001' });
  const r = await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' });
  assert.equal(r.jogo.jogo, 'dama'); assert.equal(Object.values(r.jogo.mesa.pecas).join(), '12,12');
  const todos = await x.listarMesa(sql, { id: 7 }, { jogo: 'todos', ...MESA });
  assert.equal(todos.mesa?.jogo, 'dama', 'quem passa pela Mesa de Jogos vê a dama rolando');
  await assert.rejects(x.desafiarMesa(sql, { id: 7 }, salas, { jogo: 'truco', para: '1', ...MESA, chave: 'truco-0001' }).then((c) => x.responderMesa(sql, { id: 1 }, salas, { id: c.id, acao: 'aceitar' })), /mesa já está com uma partida/);
});

test('a fora: quem assiste pede fora, quem perde sai e o primeiro da fila entra contra quem ganhou', async (t) => {
  const { db, sql } = await bancoEscritorio(t);
  for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-mesas-jogos-novos.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
  const x = await import('../server/escritorio-mesas.js');
  const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
  const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Ewerton' }, { id: 9, nome: 'Bia' }]);
  const MESA = { camada: 'jogos', movel: 'hobbies_c26_gamingtable@5,6' };
  const d = await x.desafiarMesa(sql, { id: 1 }, salas, { jogo: 'velha', para: '3', ...MESA, chave: 'velha-0001' });
  let j = (await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' })).jogo;
  // Quem joga não pede fora; quem assiste pede, na ordem, uma vez só.
  await assert.rejects(x.acaoMesa(sql, { id: 1 }, { id: j.id, acao: 'pedir-fora' }), /está jogando/);
  let v = (await x.acaoMesa(sql, { id: 7 }, { id: j.id, acao: 'pedir-fora' })).jogo;
  assert.equal(v.pode_pedir_fora, false);
  await x.acaoMesa(sql, { id: 7 }, { id: j.id, acao: 'pedir-fora' });
  v = (await x.acaoMesa(sql, { id: 9 }, { id: j.id, acao: 'pedir-fora' })).jogo;
  assert.deepEqual(v.fora.map((p) => p.id), ['7', '9']); assert.ok(v.fora[0].nome, 'a fila mostra o nome de quem espera');
  // A fila não se perde com as jogadas.
  const quem = { desafiante: { id: 1 }, desafiado: { id: 3 } };
  j = (await x.lanceMesa(sql, quem[j.vez], { id: j.id, n: j.n, tipo: 'marcar', casa: 4 })).jogo;
  assert.equal(j.fora.length, 2);
  // Vinícius desiste: Paulo fica, Ewerton entra e a Bia segue na fora da partida nova.
  const fim = (await x.acaoMesa(sql, { id: 3 }, { id: j.id, acao: 'desistir' })).jogo;
  assert.equal(fim.estado, 'fim'); assert.ok(fim.proxima);
  const nova = await x.verMesa(sql, { id: 9 }, fim.proxima);
  assert.equal(nova.estado, 'jogando'); assert.equal(nova.desafiante.id, '1'); assert.equal(nova.desafiado.id, '7');
  assert.deepEqual(nova.fora.map((p) => p.id), ['9']);
  // Sair da fora.
  const sem = (await x.acaoMesa(sql, { id: 9 }, { id: nova.id, acao: 'sair-fora' })).jogo;
  assert.deepEqual(sem.fora, []); assert.equal(sem.pode_pedir_fora, true);
});
