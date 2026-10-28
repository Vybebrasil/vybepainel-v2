// Pôquer de até 8 com os clientes da Vybe como bots (pedido do Paulo,
// 28/10/2026: "podia ser os clientes, cada um com sua carteira… e no meio da
// partida eles soltam piadas sobre as demandas"; "a mesa pode ser até de 8").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { iniciarPoker, jogarPoker, vistaPoker } from '../server/escritorio-poker.js';
import { jogadaDoBot } from '../server/escritorio-bots.js';
import { falaDoCliente, marcaDoCliente, nivelDoCliente } from '../server/escritorio-clientes-poker.js';

const OITO = ['desafiante', 'desafiado', 'jogador3', 'jogador4', 'jogador5', 'jogador6', 'jogador7', 'jogador8'];

test('pôquer a 8: a partida anda até alguém ficar com todas as fichas e as fichas não somem', () => {
 let m = iniciarPoker('jogador5', undefined, OITO), fim = null;
 assert.equal(Object.keys(m.cartas).length, 8);
 for (let i = 0; i < 4000 && !fim; i++) {
  const l = m.vez, r = jogarPoker(m, l, jogadaDoBot('poker', 'medio', m, l, vistaPoker(m, l, false)));
  const total = OITO.reduce((s, x) => s + r.mesa.fichas[x] + r.mesa.posto[x], 0);
  if (!r.fim) assert.equal(total, 8000, 'as fichas da mesa se conservam');
  m = r.mesa; fim = r.fim;
 }
 assert.ok(fim, 'a partida termina');
 assert.ok(OITO.includes(fim.resultado));
});

test('falas dos clientes: usam as demandas quando tem, e o avatar tem iniciais', () => {
 const info = { nome: 'Conectasim', atrasadas: 3, aprovar: 2, sem_info: 1, t_atrasada: 'Carrossel de Black Friday', t_aprovar: 'Reels do lançamento', t_sem_info: 'Post do Natal' };
 assert.match(falaDoCliente(info, 'ganhou', 0.4), /Reels do lançamento/);
 assert.match(falaDoCliente(info, 'all-in', 0.1), /Post do Natal/);
 assert.match(falaDoCliente(info, 'aumentou', 0.01), /Carrossel de Black Friday/);
 assert.equal(falaDoCliente(info, 'mesa', 0.99), null, 'nem sempre fala');
 assert.equal(typeof falaDoCliente({ nome: 'X', atrasadas: 0, aprovar: 0, sem_info: 0 }, 'ganhou', 0.2), 'string');
 assert.deepEqual(marcaDoCliente(1, 'Cliente laranja').iniciais, 'CL');
 assert.ok(['facil', 'medio', 'lendario'].includes(nivelDoCliente(7)));
});

test('mesa com clientes: começa na hora, cada um paga pela carteira, eles jogam e falam, e o pote vai para quem ganha', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql',
  '2026-10-27-escritorio-bots-temporadas.sql', '2026-10-28-escritorio-poker-clientes.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 await db.exec(`CREATE TABLE vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,100),(3,100)`;
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }]);
 const MESA = { jogo: 'poker', camada: 'jogos', movel: 'wildwest_table@16,2' };
 const carteira = async (c) => Number((await sql`SELECT saldo FROM vybe_escritorio_clientes_carteira WHERE cliente_id=${c}`)[0].saldo);
 // O lobby do pôquer lista os clientes com a carteira (500 para começar).
 const lobby = await x.botsDoJogo(sql, { id: 1 }, 'poker');
 assert.deepEqual(lobby.clientes.map((c) => [c.nome, c.saldo]), [['Cliente azul', 500], ['Cliente laranja', 500], ['Sem carteira', 500]]);
 // Só clientes em outro jogo, não.
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { ...MESA, jogo: 'sinuca', clientes: ['1'], chave: 'cli-sinuca1' }), /Só o pôquer/);
 // Cliente com pouco saldo não senta.
 await sql`UPDATE vybe_escritorio_clientes_carteira SET saldo=10 WHERE cliente_id=3`;
 await assert.rejects(x.desafiarMesa(sql, { id: 1 }, salas, { ...MESA, clientes: ['3'], moedas: 20, chave: 'cli-pobre01' }), /Sem carteira está sem VybeCoins/);
 // Uma peça atrasada do Cliente laranja: vira assunto das piadas dele.
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN titulo text, ADD COLUMN monday_item_id text;
  INSERT INTO vybe_conteudos(id,board_id,status_chave,prazo,briefing,titulo) VALUES(900,7829537690,'pode_fazer','2026-01-05','briefing','Carrossel da Black Friday');
  INSERT INTO vybe_conteudo_clientes VALUES(900,1);`);
 // Eu e dois clientes, valendo 20: começa na hora.
 const r = await x.desafiarMesa(sql, { id: 1 }, salas, { ...MESA, clientes: ['1', '2'], moedas: 20, chave: 'cli-mesa001' });
 assert.equal(r.jogo.estado, 'jogando');
 assert.deepEqual(r.jogo.jogadores.map((p) => [p.lado, p.id, p.nome]), [['desafiante', '1', 'Paulo Martins'], ['desafiado', 'c1', 'Cliente laranja'], ['jogador3', 'c2', 'Cliente azul']]);
 assert.equal(r.jogo.jogadores[1].cliente, true); assert.ok(r.jogo.jogadores[1].iniciais);
 assert.equal(r.jogo.grupo, true);
 assert.deepEqual([await carteira(1), await carteira(2)], [480, 480], 'cada cliente pôs 20');
 const [{ mesa: guardada }] = await sql`SELECT mesa FROM vybe_escritorio_partidas WHERE id=${r.jogo.id}`;
 assert.equal(guardada.clientesInfo.desafiado.atrasadas, 1);
 assert.equal(guardada.clientesInfo.desafiado.t_atrasada, 'Carrossel da Black Friday');
 assert.equal(guardada.clientesInfo.jogador3.atrasadas, 0);
 assert.equal(Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=1`)[0].saldo), 80);
 // Os clientes jogam na vez deles (a tela pede; o servidor também joga sozinho).
 let j = r.jogo;
 for (let i = 0; i < 20 && j.estado === 'jogando' && j.vez !== 'desafiante'; i++) j = (await x.vezDoBot(sql, { id: 1 }, { id: j.id, n: j.n })).jogo;
 assert.ok(j.vez === 'desafiante' || j.estado === 'fim');
 // Quem não está na mesa não pede a vez do cliente.
 await assert.rejects(x.vezDoBot(sql, { id: 3 }, { id: j.id, n: j.n }), /não encontrada/);
 // Eu desisto: só sobram clientes, a partida acaba e o pote (60) vai para o cliente com mais fichas.
 if (j.estado === 'jogando') {
  const fim = await x.acaoMesa(sql, { id: 1 }, { id: j.id, acao: 'desistir' });
  assert.equal(fim.jogo.estado, 'fim');
  assert.ok(['desafiado', 'jogador3'].includes(fim.jogo.resultado));
  const ganhou = fim.jogo.resultado === 'desafiado' ? 1 : 2, perdeu = 3 - ganhou;
  assert.deepEqual([await carteira(ganhou), await carteira(perdeu)], [540, 480]);
  const razao = await sql`SELECT origem, quantidade FROM vybe_escritorio_clientes_moedas WHERE cliente_id=${ganhou} ORDER BY id`;
  assert.deepEqual(razao.map((l) => l.quantidade), [-20, 60]);
 }
 // Convite com pessoa e clientes: a mesa abre quando a pessoa aceita, com os clientes depois dela.
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { ...MESA, para: '3', clientes: ['1'], moedas: 10, chave: 'cli-mesa002' });
 const aceito = await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' });
 assert.equal(aceito.jogo.estado, 'jogando');
 assert.deepEqual(aceito.jogo.jogadores.map((p) => p.id), ['1', '3', 'c1']);
 // Cada lance dos clientes pode render fala; a vista leva as falas com o lado.
 assert.ok(Array.isArray(aceito.jogo.falas));
});
