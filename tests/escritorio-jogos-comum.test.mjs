// O que os jogos de mesa têm em comum (Paulo, 27/10/2026): placar entre os
// dois, placas das mesas ocupadas e convites pendentes no resumo da sala,
// aviso do convite no sino do painel e a escada de conquistas "Mesas de jogo"
// (uma vitória por jogo, adversário e dia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';

const ler = (f) => readFileSync('migrations/' + f, 'utf8');
async function banco(t) {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN formato text, ADD COLUMN titulo text, ADD COLUMN clientes_texto text, ADD COLUMN monday_item_id text, ADD COLUMN etapa text;`);
  for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-19-escritorio-gestao-pontos.sql', '2026-10-20-escritorio-complexidade.sql', '2026-10-20-escritorio-bolo-por-peca.sql',
    '2026-10-20-escritorio-conquistas-niveis.sql', '2026-10-20-escritorio-conquistas-producao.sql', '2026-10-21-escritorio-conquistas-dificeis.sql',
    '2026-10-27-escritorio-xadrez.sql', '2026-10-27-escritorio-mesas.sql']) await db.exec(ler(f));
  await db.exec(`CREATE TABLE vybe_notificacoes(id serial PRIMARY KEY, pessoa_id bigint, conteudo_id bigint, texto text, lida_em timestamptz, criada_em timestamptz DEFAULT now())`);
  return { db, sql };
}
const MESA = { jogo: 'domino', camada: 'jogos', movel: 'hobbies_c26_gamingtable@5,6' };

test('placar, resumo da sala e aviso do convite no sino', async (t) => {
  const { sql } = await banco(t);
  const x = await import('../server/escritorio-mesas.js');
  const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
  const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }, { id: 7, nome: 'Bia' }]);
  const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', ...MESA, moedas: 0, chave: 'resumo-0001' });
  const [aviso] = await sql`SELECT pessoa_id, texto FROM vybe_notificacoes`;
  assert.equal(String(aviso.pessoa_id), '3');
  assert.match(aviso.texto, /^Paulo te chamou para o dominó\. .*na Sala de Jogos/);
  await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', ...MESA, chave: 'resumo-0001' });
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_notificacoes`)[0].n, 1, 'pedido repetido não avisa de novo');
  let r = await x.resumoDosJogos(sql, { id: 3 }, 'jogos');
  assert.deepEqual(r.convites, [{ jogo: 'domino', id: d.id, de: 'Paulo Martins' }]);
  assert.deepEqual(r.ativas, []);
  await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' });
  r = await x.resumoDosJogos(sql, { id: 7 }, 'jogos');
  assert.deepEqual(r.ativas, [{ jogo: 'domino', movel: MESA.movel, nomes: ['Paulo Martins', 'Vinícius Damascena'] }]);
  assert.deepEqual((await x.resumoDosJogos(sql, { id: 7 }, 'praca')).ativas, [], 'só as mesas desta cena');
  // Desistência de Paulo: Vinícius 1 × 0 no placar dos dois.
  const fim = await x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'desistir' });
  assert.deepEqual(fim.jogo.placar, { 1: 0, 3: 1, empates: 0 });
});

test('escada Mesas de jogo: uma vitória por jogo, adversário e dia', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(ler('2026-10-27-escritorio-conquista-jogos.sql'));
  await db.exec(ler('2026-10-27-escritorio-conquista-jogos.sql'));
  assert.deepEqual((await sql`SELECT nivel, meta FROM vybe_escritorio_trofeus WHERE marco='jogos' ORDER BY nivel`).map((r) => [r.nivel, r.meta]), [[1, 1], [2, 10], [3, 30], [4, 100]]);
  assert.equal((await sql`SELECT marco FROM vybe_escritorio_catalogo WHERE classe='royal_chair'`)[0].marco, 'trofeu', 'o troféu não se compra');
  const { conferirMarcos } = await import('../server/escritorio-marcos.js');
  // Três vitórias de Paulo sobre Vinícius no mesmo dia e jogo contam uma; outro jogo e outro adversário contam mais.
  await db.exec(`INSERT INTO vybe_escritorio_partidas(jogo,chave,desafiante,desafiado,camada,movel,estado,resultado,terminado_em) VALUES
    ('domino','v-00000001',1,3,'jogos','m@1,1','fim','desafiante',now()),('domino','v-00000002',3,1,'jogos','m@1,1','fim','desafiado',now()),
    ('domino','v-00000003',1,3,'jogos','m@1,1','fim','desafiante',now()),('poker','v-00000004',1,3,'jogos','m@1,1','fim','desafiante',now()),
    ('sinuca','v-00000005',7,1,'jogos','m@1,1','fim','desafiado',now()),('domino','v-00000006',1,3,'jogos','m@1,1','fim','empate',now())`);
  await db.exec(`INSERT INTO vybe_escritorio_xadrez(chave,desafiante,desafiado,brancas,pretas,camada,movel,estado,resultado,terminado_em) VALUES
    ('x-00000001',1,3,1,3,'jogos','CF_250_goldenchessboard@1,1','fim','brancas',now()),('x-00000002',3,1,3,1,'jogos','CF_250_goldenchessboard@1,1','fim','brancas',now())`);
  const lista = await conferirMarcos(sql, 1);
  const jogos = lista.find((m) => m.id === 'jogos');
  assert.equal(jogos.valor, 4, 'dominó, pôquer e xadrez contra Vinícius e sinuca contra Bia');
  assert.equal(jogos.nivel, 1);
  assert.equal(jogos.titulo, 'Jogador de Mesa');
  assert.equal((await sql`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=1 AND classe='trophy_fball_c26_wingedbronze'`)[0]?.quantidade, 1);
  assert.equal((await conferirMarcos(sql, 3)).find((m) => m.id === 'jogos').valor, 1, 'Vinícius ganhou um xadrez de Paulo');
});
