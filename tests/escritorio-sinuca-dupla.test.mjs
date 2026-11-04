// Sinuca em dupla (Paulo, 04/11/2026: "como tá funcionando pra jogar de dupla?
// ... no par ou ímpar, jogar alternado"): A1 (quem chama) e A2 (o parceiro)
// contra B1 e B2; a vez roda A1 → B1 → A2 → B2; o grupo é da dupla.
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarSinuca, jogarSinuca, motorSinuca, RODIZIO_DUPLA, timeDe } from '../server/escritorio-sinuca.js';

const dupla = () => motorSinuca.iniciar(RODIZIO_DUPLA);
// Mesa arrumada para uma tacada certa: branca em (30,25) e a bola n reta em (50,25).
function armar(m, lado, n) {
 m.vez = lado; m.bolaNaMao = false; m.tacadas = 4;
 m.bolas = m.bolas.map(() => null);
 m.bolas[0] = [30, 25]; m.bolas[n] = [94, 25]; m.bolas[1] = [3, 25];
 for (const [k, p] of [[2, [60, 8]], [3, [70, 42]], [4, [40, 44]], [5, [85, 6]], [6, [20, 6]], [7, [55, 44]]]) if (k !== n) m.bolas[k] = p;
 return m;
}

test('dupla: começa com os 4 no rodízio, times A e B e a mesa aberta para todos', () => {
 const m = dupla();
 assert.deepEqual(m.rodizio, ['desafiante', 'desafiado', 'jogador3', 'jogador4']);
 assert.deepEqual(timeDe(m, 'desafiante'), ['desafiante', 'jogador3']);
 assert.deepEqual(timeDe(m, 'jogador4'), ['desafiado', 'jogador4']);
 assert.deepEqual(Object.values(m.grupos), [null, null, null, null]);
 assert.equal(motorSinuca.grupo, 4);
});

test('dupla: errou passa para o próximo da outra dupla, na ordem A1 → B1 → A2 → B2 → A1', () => {
 let m = dupla();
 const vezes = [];
 for (const lado of ['desafiante', 'desafiado', 'jogador3', 'jogador4']) {
  m = armar(m, lado, 6); m.grupos = { desafiante: 'pares', jogador3: 'pares', desafiado: 'impares', jogador4: 'impares' };
  // Tacada para o lado de lá, sem acertar nada: cegou (falta) e a vez passa.
  const r = jogarSinuca(m, lado, { tipo: 'tacar', angulo: Math.PI, forca: 0.05 });
  m = r.mesa; vezes.push(m.vez);
 }
 assert.deepEqual(vezes, ['desafiado', 'jogador3', 'jogador4', 'desafiante']);
});

test('dupla: quem encaçapa primeiro dá o grupo para a dupla inteira; acertou a certa, continua', () => {
 // B1 mata a 3 (ímpar) na caçapa do meio, com a mesa aberta.
 const m = dupla(); m.vez = 'desafiado'; m.bolaNaMao = false; m.tacadas = 4; m.bolas = m.bolas.map(() => null);
 m.bolas[0] = [50, 30]; m.bolas[3] = [50, 42]; m.bolas[1] = [3, 25];
 for (const [k, p] of [[2, [80, 8]], [4, [20, 8]], [5, [85, 40]], [6, [15, 40]], [7, [70, 20]]]) m.bolas[k] = p;
 const r = jogarSinuca(m, 'desafiado', { tipo: 'tacar', angulo: Math.PI / 2, forca: 0.35, efeito: -0.4 });
 assert.deepEqual(r.mesa.ultimo.caiu, [3], 'a 3 caiu na caçapa do meio');
 assert.equal(r.mesa.grupos.desafiado, 'impares');
 assert.equal(r.mesa.grupos.jogador4, 'impares', 'o parceiro fica com o mesmo grupo');
 assert.equal(r.mesa.grupos.desafiante, 'pares');
 assert.equal(r.mesa.grupos.jogador3, 'pares');
 assert.equal(r.mesa.vez, 'desafiado', 'matou a certa: continua quem tacou');
});

test('dupla: desistir ou estourar o tempo entrega a partida para a outra dupla', () => {
 const m = dupla(); m.vez = 'jogador3';
 assert.equal(motorSinuca.sair(m, 'jogador3', 'desistencia').fim.resultado, 'jogador4');
 assert.ok(timeDe(m, motorSinuca.sair(m, 'desafiante', 'tempo').fim.resultado).includes('desafiado'));
 assert.equal(motorSinuca.lider(m), 'jogador4');
});

test('1×1 continua igual: sem rodízio, a vez passa para o outro', () => {
 const m = iniciarSinuca('desafiante');
 assert.equal(m.rodizio, undefined);
 assert.deepEqual(timeDe(m, 'desafiado'), ['desafiado']);
});

// Do convite ao fim, com o banco: 4 na mesa, todos aceitam, a dupla que ganha
// divide o pote; quem desiste entrega a partida para a outra dupla.
test('mesa de sinuca em dupla: convite para 4, os quatro aceitam, desistência e pote dividido', async (t) => {
 const { readFileSync } = await import('node:fs');
 const { bancoEscritorio } = await import('./escritorio-esquema.mjs');
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql', '2026-10-28-escritorio-poker-clientes.sql', '2026-11-04-escritorio-sinuca-dupla.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE IF NOT EXISTS vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,100),(3,100),(7,100),(5,100)`;
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Ewerton' }, { id: 5, nome: 'Deivid' }]);
 const MESA = { jogo: 'sinuca', camada: 'jogos', movel: 'bling15_pooltable@4,4' };
 const saldo = async (p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0].saldo);
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7'], ...MESA, chave: 'dupla-0000' }), /com 4/);
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], ...MESA, casa: { modo: 'bolavez' }, chave: 'dupla-0001' }), /par ou ímpar/);
 // Paulo chama: Vinícius (1º adversário), Ewerton (parceiro) e Deivid (2º adversário).
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], ...MESA, moedas: 20, casa: { modo: 'parimpar', multa: 1, doOutro: 'falta' }, chave: 'dupla-0002' });
 await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' });
 await assert.rejects(x.responderMesa(sql, { id: 1 }, salas, { id: d.id, acao: 'comecar' }), /quatro precisam aceitar/);
 await x.responderMesa(sql, { id: 7 }, salas, { id: d.id, acao: 'aceitar' });
 const r = await x.responderMesa(sql, { id: 5 }, salas, { id: d.id, acao: 'aceitar' });
 assert.equal(r.jogo.estado, 'jogando');
 assert.deepEqual(r.jogo.jogadores.map((p) => [p.lado, p.id]), [['desafiante', '1'], ['desafiado', '3'], ['jogador3', '7'], ['jogador4', '5']]);
 assert.deepEqual(r.jogo.mesa.rodizio, ['desafiante', 'desafiado', 'jogador3', 'jogador4']);
 assert.equal(r.jogo.mesa.times.jogador3, r.jogo.mesa.times.desafiante, 'Ewerton é parceiro de Paulo');
 assert.deepEqual([await saldo(1), await saldo(3), await saldo(7), await saldo(5)], [80, 80, 80, 80], 'cada um pôs 20');
 // Ewerton desiste: a partida vai para a dupla Vinícius e Deivid, que dividem as 80.
 const fim = await x.acaoMesa(sql, { id: 7 }, { id: d.id, acao: 'desistir' });
 assert.equal(fim.jogo.estado, 'fim');
 assert.ok(['desafiado', 'jogador4'].includes(fim.jogo.resultado));
 assert.deepEqual([await saldo(1), await saldo(3), await saldo(7), await saldo(5)], [80, 120, 80, 120], 'Vinícius e Deivid levam 40 cada');
 // A dupla não entra no ranking da sinuca (ele conta vitória por pessoa).
 assert.equal((await x.rankingGeral(sql, 'sinuca')).total, 0);
});

test('mesa de sinuca em dupla: quem recusa cancela o convite (sem os 4 não tem partida)', async (t) => {
 const { readFileSync } = await import('node:fs');
 const { bancoEscritorio } = await import('./escritorio-esquema.mjs');
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql', '2026-10-28-escritorio-poker-clientes.sql', '2026-11-04-escritorio-sinuca-dupla.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE IF NOT EXISTS vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Ewerton' }, { id: 5, nome: 'Deivid' }]);
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], jogo: 'sinuca', camada: 'jogos', movel: 'bling15_pooltable@4,4', chave: 'dupla-1000' });
 await x.responderMesa(sql, { id: 5 }, salas, { id: d.id, acao: 'recusar' });
 const [linha] = await sql`SELECT estado FROM vybe_escritorio_partidas WHERE id=${d.id}`;
 assert.notEqual(linha.estado, 'convite', 'o convite da dupla saiu');
});

test('mesa de sinuca em dupla: sem a migração do banco, o convite avisa com clareza (e o 1×1 segue)', async (t) => {
 const { readFileSync } = await import('node:fs');
 const { bancoEscritorio } = await import('./escritorio-esquema.mjs');
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql', '2026-10-28-escritorio-poker-clientes.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE IF NOT EXISTS vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Ewerton' }, { id: 5, nome: 'Deivid' }]);
 const MESA = { jogo: 'sinuca', camada: 'jogos', movel: 'bling15_pooltable@4,4' };
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], ...MESA, chave: 'dupla-2000' }), /aguarda a atualização do banco/);
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', ...MESA, chave: 'dupla-2001' });
 assert.ok(d.id, 'o 1×1 continua funcionando');
});
