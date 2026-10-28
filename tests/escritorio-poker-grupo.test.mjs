// Pôquer de até 4 na mesma mesa (pedido do Paulo, 27/10/2026): blinds e vez
// com três, pote paralelo do all-in, quem quebra sai da mesa, quem desiste sai
// e os outros seguem; na mesa, convite para três, quem recusa sai da lista, a
// partida começa quando todos aceitam, a aposta é de todos e a conquista conta
// uma vitória sobre cada um da mesa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { iniciarPoker, jogarPoker, vistaPoker, sairPoker } from '../server/escritorio-poker.js';

// Baralho arrumado: as cartas saem na ordem de `seq` (o servidor tira do fim).
function arrumado(seq) {
 const todas = []; for (const r of '23456789TJQKA') for (const n of 'shdc') todas.push(r + n);
 return [...todas.filter((c) => !seq.includes(c)), ...[...seq].reverse()];
}
const j = (m, l, tipo, valor) => jogarPoker(m, l, { tipo, valor });
const TRES = ['desafiante', 'desafiado', 'jogador3'];

test('pôquer com três: blinds à esquerda do botão e quem fala primeiro', () => {
 const m = iniciarPoker('desafiante', undefined, TRES);
 assert.deepEqual(m.fichas, { desafiante: 1000, desafiado: 990, jogador3: 980 }, 'small e big blind são os dois depois do botão');
 assert.equal(m.vez, 'desafiante', 'antes do flop fala quem vem depois do big blind');
 let r = j(m, 'desafiante', 'pagar');
 assert.equal(r.mesa.vez, 'desafiado');
 r = j(r.mesa, 'desafiado', 'pagar');
 assert.equal(r.mesa.vez, 'jogador3', 'o big blind ainda fala');
 r = j(r.mesa, 'jogador3', 'mesa');
 assert.equal(r.mesa.fase, 'flop');
 assert.equal(r.mesa.vez, 'desafiado', 'depois do flop fala o primeiro à esquerda do botão');
 // Um larga e a mão segue com os outros dois.
 r = j(r.mesa, 'desafiado', 'largar');
 assert.equal(r.mesa.fase, 'flop'); assert.equal(r.mesa.vez, 'jogador3');
 assert.deepEqual(vistaPoker(r.mesa, null, false).fora, ['desafiado']);
 r = j(r.mesa, 'jogador3', 'aumentar', 40);
 r = j(r.mesa, 'desafiante', 'largar');
 assert.equal(r.mesa.anterior.vencedor, 'jogador3', 'todos largaram: o último leva');
 assert.equal(r.mesa.anterior.pote, 100);
 assert.equal(r.mesa.mao, 2); assert.equal(r.mesa.botao, 'desafiado', 'o botão anda um lugar');
});

test('pôquer com três: all-in curto abre pote paralelo e quem quebra sai', () => {
 // Botão: desafiante (K♣K♦); desafiado (7♣2♦); jogador3 (A♠A♥), que só tem 50.
 let m = iniciarPoker('desafiante', arrumado(['Kc', 'Kd', '7c', '2d', 'As', 'Ah', '9s', '4h', '3c', 'Jc', 'Qd']), TRES);
 m.fichas.jogador3 = 30; // big blind de 20 já posto: 50 no total
 m = j(m, 'desafiante', 'aumentar', 200).mesa;
 m = j(m, 'desafiado', 'pagar').mesa;
 m = j(m, 'jogador3', 'pagar').mesa;
 assert.equal(m.ultimo.acao, 'all-in');
 assert.equal(m.fase, 'flop'); assert.equal(m.vez, 'desafiado', 'quem está all-in não fala mais');
 for (let i = 0; i < 3; i++) { m = j(m, 'desafiado', 'mesa').mesa; m = j(m, 'desafiante', 'mesa').mesa; }
 const a = m.anterior;
 assert.equal(a.vencedor, 'jogador3', 'o par de ases leva o pote principal');
 assert.deepEqual(a.ganhos, { desafiante: 300, jogador3: 150 }, 'principal 3×50 para os ases; o paralelo 2×150 para os reis');
 assert.equal(a.pote, 450);
 assert.equal(Object.keys(a.maos).length, 3, 'no showdown todo mundo que ficou mostra');
 const total = (x) => Object.values(x.fichas).reduce((s, v) => s + v, 0) + Object.values(x.posto).reduce((s, v) => s + v, 0);
 assert.equal(total(m), 2050, 'nenhuma ficha some');
 // Quem quebra sai da mão seguinte, e a dois volta a regra do botão no small blind.
 m = iniciarPoker('desafiante', arrumado(['Kc', 'Kd', '7c', '2d', 'As', 'Ah', '9s', '4h', '3c', 'Jc', 'Qd']), TRES);
 m.fichas.desafiado = 0; m.posto.desafiado = 10; m.rodada.desafiado = 10; // all-in no small blind
 m = j(m, 'desafiante', 'pagar').mesa;
 m = j(m, 'jogador3', 'mesa').mesa;
 for (let i = 0; i < 3; i++) { m = j(m, 'jogador3', 'mesa').mesa; m = j(m, 'desafiante', 'mesa').mesa; }
 assert.equal(m.fichas.desafiado, 0);
 assert.deepEqual(m.naMao, ['desafiante', 'jogador3'], 'quem ficou sem fichas não recebe carta');
 assert.equal(m.posto[m.botao], 10, 'a dois, o botão paga o small blind');
});

test('pôquer com três: quem desiste sai e a partida acaba quando sobra um', () => {
 let m = iniciarPoker('desafiante', undefined, TRES);
 let r = sairPoker(m, 'desafiante', 'desistencia');
 assert.equal(r.fim, null, 'os outros dois seguem jogando');
 assert.equal(r.mesa.vez, 'desafiado');
 assert.deepEqual(vistaPoker(r.mesa, null, false).saiu, ['desafiante']);
 r = sairPoker(r.mesa, 'desafiado', 'tempo');
 assert.deepEqual(r.fim, { resultado: 'jogador3', motivo: 'tempo' });
});

test('mesa de pôquer em grupo: convite, recusa, aceite de todos, aposta e conquista', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-19-escritorio-gestao-pontos.sql', '2026-10-20-escritorio-complexidade.sql', '2026-10-20-escritorio-bolo-por-peca.sql',
  '2026-10-20-escritorio-conquistas-niveis.sql', '2026-10-20-escritorio-conquistas-producao.sql', '2026-10-21-escritorio-conquistas-dificeis.sql',
  '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,100),(3,100),(7,100),(5,100)`;
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Bia' }, { id: 5, nome: 'Tainara' }]);
 const MESA = { jogo: 'poker', camada: 'jogos', movel: 'wildwest_table@16,2' };
 const saldo = async (p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0].saldo);
 // Regras do convite em grupo.
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5', '2', '4', '6', '24', '28'], ...MESA, chave: 'grupo-0000' }), /até 8 pessoas/);
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { jogo: 'domino', camada: 'jogos', movel: 'hobbies_c26_gamingtable@15,8', para: '3', mais: ['7'], chave: 'grupo-dom1' }), /de dois/);
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7'], ...MESA, chave: 'grupo-0001', oferece: [['bench', 1]] }), /só em VybeCoins/);
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], ...MESA, moedas: 20, chave: 'grupo-0002' });
 assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_notificacoes`)[0].n, 3, 'os três chamados recebem o aviso');
 assert.equal((await x.listarMesa(sql, { id: 7 }, MESA)).convites.length, 1);
 // Vinícius (o primeiro chamado) recusa: Bia toma o lugar dele.
 await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'recusar' });
 let [linha] = await sql`SELECT desafiado, mais, estado FROM vybe_escritorio_partidas WHERE id=${d.id}`;
 assert.equal(String(linha.desafiado), '7'); assert.deepEqual(linha.mais.map(String), ['5']); assert.equal(linha.estado, 'convite');
 // Bia aceita e espera; Tainara aceita e a partida começa com os três.
 const r1 = await x.responderMesa(sql, { id: 7 }, salas, { id: d.id, acao: 'aceitar' });
 assert.equal(r1.aguardando, true); assert.equal(r1.jogo.estado, 'convite');
 assert.equal((await x.listarMesa(sql, { id: 7 }, MESA)).aguardando.length, 1);
 const r2 = await x.responderMesa(sql, { id: 5 }, salas, { id: d.id, acao: 'aceitar' });
 assert.equal(r2.jogo.estado, 'jogando');
 assert.deepEqual(r2.jogo.jogadores.map((p) => [p.lado, p.id]), [['desafiante', '1'], ['desafiado', '7'], ['jogador3', '5']]);
 assert.equal(r2.jogo.eu, 'jogador3'); assert.equal(r2.jogo.mesa.minhas.length, 2);
 assert.deepEqual([await saldo(1), await saldo(7), await saldo(5), await saldo(3)], [80, 80, 80, 100], 'cada um dos três pôs 20');
 const resumo = await x.resumoDosJogos(sql, { id: 3 }, 'jogos');
 assert.deepEqual(resumo.ativas[0].nomes, ['Paulo Martins', 'Beatriz Rocha Cardoso', 'Tainara Sodré']);
 // Em grupo não tem empate combinado; quem desiste sai e os outros seguem.
 await assert.rejects(x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'empate' }), /empate combinado/);
 let r = await x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'desistir' });
 assert.equal(r.jogo.estado, 'jogando'); assert.deepEqual(r.jogo.mesa.saiu, ['desafiante']);
 await assert.rejects(x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'desistir' }), /já saiu/);
 r = await x.acaoMesa(sql, { id: 7 }, { id: d.id, acao: 'desistir' });
 assert.equal(r.jogo.estado, 'fim'); assert.equal(r.jogo.resultado, 'jogador3');
 assert.equal(await saldo(5), 140, 'Tainara leva as 60 da mesa');
 // A conquista conta uma vitória sobre cada um da mesa.
 await db.exec(readFileSync('migrations/2026-10-27-escritorio-conquista-jogos.sql', 'utf8'));
 const { conferirMarcos } = await import('../server/escritorio-marcos.js');
 assert.equal((await conferirMarcos(sql, 5)).find((m) => m.id === 'jogos').valor, 2, 'venceu Paulo e Bia');
 assert.equal((await conferirMarcos(sql, 7)).find((m) => m.id === 'jogos').valor, 0);
});

test('mesa de pôquer em grupo: quem chamou começa só com quem já aceitou', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Bia' }, { id: 5, nome: 'Tainara' }]);
 const MESA = { jogo: 'poker', camada: 'jogos', movel: 'wildwest_table@19,2' };
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', mais: ['7', '5'], ...MESA, chave: 'grupo-1000' });
 await assert.rejects(x.responderMesa(sql, { id: 1 }, salas, { id: d.id, acao: 'comecar' }), /Ninguém aceitou/);
 await assert.rejects(x.responderMesa(sql, { id: 7 }, salas, { id: d.id, acao: 'comecar' }), /só quem chamou/);
 // Bia aceita; Vinícius e Tainara não respondem. Paulo começa com Bia.
 await x.responderMesa(sql, { id: 7 }, salas, { id: d.id, acao: 'aceitar' });
 const r = await x.responderMesa(sql, { id: 1 }, salas, { id: d.id, acao: 'comecar' });
 assert.equal(r.jogo.estado, 'jogando');
 assert.deepEqual(r.jogo.jogadores.map((p) => p.id), ['1', '7'], 'só quem aceitou senta');
 assert.equal(r.jogo.grupo, false, 'dois na mesa: pôquer mano a mano');
 assert.equal((await x.listarMesa(sql, { id: 3 }, MESA)).convites.length, 0, 'o convite saiu da lista de quem não respondeu');
});

test('tempo da vez: estourou, o jogo faz a jogada mínima; três estouros seguidos perdem', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }]);
 const MESA = { jogo: 'poker', camada: 'jogos', movel: 'wildwest_table@16,2' };
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', ...MESA, chave: 'tempo-0001' });
 let j = (await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' })).jogo;
 assert.ok(j.prazo_vez, 'a vista diz até quando vai a vez');
 const atrasar = (s) => sql`UPDATE vybe_escritorio_partidas SET ultimo_lance_em = now() - ${s + ' seconds'}::interval WHERE id=${d.id}`;
 // Ainda no tempo: nada acontece.
 await atrasar(10);
 assert.equal((await x.verMesa(sql, { id: 1 }, d.id)).n, j.n);
 // Estourou: quem tinha a vez larga (no pré-flop tem aposta para pagar) e a mão segue.
 const vez = j.vez;
 await atrasar(40);
 j = await x.verMesa(sql, { id: 1 }, d.id);
 assert.equal(j.n, 1);
 assert.equal(j.mesa.anterior.vencedor, vez === 'desafiante' ? 'desafiado' : 'desafiante', 'quem estourou largou');
 // Três estouros seguidos do mesmo lado: perde a partida.
 for (let k = 0; k < 6 && j.estado === 'jogando'; k++) { await atrasar(40); j = await x.verMesa(sql, { id: 1 }, d.id); }
 assert.equal(j.estado, 'fim'); assert.equal(j.motivo, 'tempo');
});
