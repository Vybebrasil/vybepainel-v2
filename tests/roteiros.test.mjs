// Biblioteca de roteiros da Produção (Paulo, 21/10/2026): o doc do Google com
// o cliente e as peças, os conteúdos que saíram dele, a importação dos roteiros
// antigos e a busca de novos no Drive sem duplicar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { listarRoteiros, candidatos, ligar, incluirRoteiro, editarRoteiro, sincronizarDoDrive, roteirosDosConteudos, pecasDoTexto, docDoLink } from '../server/roteiros.js';

const DOC = '1C2g21ELYVUO5AkA6WbBDsw1B85rtNLDPYCdBw9Y0_gg';
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text);
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, titulo text, formato text, prazo date, veiculacao date,
      status_chave text, board_id bigint, criado_em timestamptz DEFAULT now(), removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_pessoas VALUES (1, 'Paulo Martins');
    INSERT INTO vybe_clientes VALUES (8, 'Hellen Rocha'), (32, 'Brussolo Ristorante');
    INSERT INTO vybe_status VALUES (1, 'finalizado', 'Finalizado', '#00c875');
    INSERT INTO vybe_conteudos (id, titulo, formato, veiculacao, status_chave, board_id) VALUES
      (1188, 'Trend "E Quando Menos Esperar... Clareou"', 'Reels', '2026-06-15', 'finalizado', 1),
      (1189, 'Card dia dos namorados', 'Card', '2026-06-12', 'finalizado', 1),
      (1223, 'Reels - Video 01', 'Reels', '2026-06-22', 'finalizado', 1),
      (900, 'Reels antigo', 'Reels', '2025-01-10', 'finalizado', 1),
      (500, 'Foto do prato', 'Fotografia', '2026-06-20', 'finalizado', 1);
    INSERT INTO vybe_conteudo_clientes VALUES (1188, 8), (1189, 8), (1223, 8), (900, 8), (500, 32);`);
  await db.exec(readFileSync('migrations/2026-10-21-producao-roteiros.sql', 'utf8'));
  return { db, sql };
}
const quem = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins' } };

test('a importação traz os roteiros antigos com cliente e peças e só liga o que existe', async (t) => {
  const { db, sql } = await banco(t);
  const importacao = readFileSync('migrations/2026-10-21-producao-roteiros-importacao.sql', 'utf8');
  await db.exec(importacao);
  await db.exec(importacao); // de novo, sem duplicar
  const lista = await listarRoteiros(sql);
  assert.equal(lista.length, 21);
  const hellen = lista.find((r) => r.doc_id === DOC);
  assert.equal(hellen.cliente, 'Hellen Rocha');
  assert.equal(hellen.pecas.length, 7);
  assert.deepEqual(hellen.conteudos.map((c) => [c.id, c.status]), [['1188', 'Finalizado']]);
  assert.equal(hellen.link, `https://docs.google.com/document/d/${DOC}/edit`);
  // Cliente que não existe neste banco entra sem cliente, e o mais novo vem primeiro.
  assert.equal(lista[0].cliente, 'Brussolo Ristorante');
  assert.equal(lista.find((r) => r.titulo === 'Roteiro Tráfego Avila Rocha').cliente_id, null);
  assert.ok(lista.every((r, i) => !i || lista[i - 1].criado_em >= r.criado_em));
});

test('sugere os conteúdos do cliente perto do roteiro e liga e desliga', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(readFileSync('migrations/2026-10-21-producao-roteiros-importacao.sql', 'utf8'));
  const r = (await listarRoteiros(sql)).find((x) => x.doc_id === DOC);
  const { candidatos: lista } = await candidatos(sql, { roteiro_id: r.id });
  assert.deepEqual(lista.map((c) => c.id), ['1188', '1223', '1189']); // ligado primeiro; o de 2025 e o de outro cliente ficam de fora
  assert.equal(lista[0].ligado, true);
  assert.equal(lista.find((c) => c.id === '1223').ligado, false);
  await ligar(sql, quem, { roteiro_id: r.id, conteudo_id: '1223' });
  await ligar(sql, quem, { roteiro_id: r.id, conteudo_id: '1223' }); // de novo, sem duplicar
  assert.deepEqual((await listarRoteiros(sql)).find((x) => x.id === r.id).conteudos.map((c) => c.id), ['1188', '1223']);
  const mapa = await roteirosDosConteudos(sql, ['1223', '500']);
  assert.equal(mapa.get('1223').titulo, 'Roteiros Hellen Rocha 12/06/2026');
  assert.equal(mapa.has('500'), false);
  await ligar(sql, quem, { roteiro_id: r.id, conteudo_id: '1223', desfazer: true });
  assert.deepEqual((await listarRoteiros(sql)).find((x) => x.id === r.id).conteudos.map((c) => c.id), ['1188']);
  // Busca pelo nome acha fora da janela de datas; conteúdo inexistente é recusado.
  assert.deepEqual((await candidatos(sql, { roteiro_id: r.id, busca: 'antigo' })).candidatos.map((c) => c.id), ['900']);
  await assert.rejects(ligar(sql, quem, { roteiro_id: r.id, conteudo_id: '77' }), /não encontrado/);
  await assert.rejects(ligar(sql, quem, { roteiro_id: r.id, conteudo_id: '1; DROP' }), /inválido/);
});

test('colar o link inclui o roteiro com as peças lidas do doc; sem acesso fica o aviso', async (t) => {
  const { sql } = await banco(t);
  const link = 'https://docs.google.com/document/d/1aUzIl15OyQQCJU1D9tNCW7XRxk326k0r0cYApqfCHyQ/edit?tab=t.0';
  const ler = async () => 'Roteiro de captação\nREELS 1 – O chef na cozinha\nfala do chef\nReels 2: Montagem do prato\nReels 1 – repetido';
  const r = await incluirRoteiro(sql, quem, { link, titulo: '  Chef   Miguel ', cliente_id: '32' }, { ler });
  assert.deepEqual(r.avisos, []);
  const [salvo] = await listarRoteiros(sql);
  assert.deepEqual([salvo.titulo, salvo.cliente, salvo.origem, salvo.pecas], ['Chef Miguel', 'Brussolo Ristorante', 'painel', ['Reels 1: O chef na cozinha', 'Reels 2: Montagem do prato']]);
  await assert.rejects(incluirRoteiro(sql, quem, { link, titulo: 'De novo', cliente_id: '32' }, { ler }), /já está/);
  const semAcesso = await incluirRoteiro(sql, quem, { link: '1SX7AS513Q1KBFBjzJOoE2lFKLsTStte6aLY8FBUNWeI', titulo: 'Francis' }, { ler: async () => { throw new Error('403'); } });
  assert.match(semAcesso.avisos[0], /não enxerga/);
  await assert.rejects(incluirRoteiro(sql, quem, { link: 'https://exemplo.com', titulo: 'x' }, { ler }), /link do Google Docs/);
  await assert.rejects(incluirRoteiro(sql, quem, { link, titulo: 'x', cliente_id: '999' }, { ler }), /Cliente não encontrado/);
  // Corrigir o cliente e tirar da biblioteca.
  await editarRoteiro(sql, quem, { id: semAcesso.id, cliente_id: '32' });
  assert.equal((await listarRoteiros(sql)).find((x) => x.id === semAcesso.id).cliente, 'Brussolo Ristorante');
  await editarRoteiro(sql, quem, { id: semAcesso.id, remover: true });
  assert.equal((await listarRoteiros(sql)).length, 1);
});

test('buscar no Drive inclui só os docs novos, com o cliente pelo nome do doc', async (t) => {
  const { sql } = await banco(t);
  const docs = [
    { id: 'A'.repeat(30), nome: 'Roteiros Hellen Dia 17 Agosto', criado: '2026-08-17' },
    { id: 'B'.repeat(30), nome: 'Roteiro sem cliente conhecido', criado: '' },
  ];
  const um = await sincronizarDoDrive(sql, quem, { buscar: async () => docs, ler: async () => 'Reels 1: Salário-maternidade' });
  assert.deepEqual(um.novos.map((n) => n.cliente), ['Hellen Rocha', '']);
  const dois = await sincronizarDoDrive(sql, quem, { buscar: async () => docs, ler: async () => '' });
  assert.equal(dois.novos.length, 0);
  const lista = await listarRoteiros(sql);
  assert.deepEqual(lista.find((r) => r.doc_id === docs[0].id).pecas, ['Reels 1: Salário-maternidade']);
});

test('lê o id do link do Docs e as peças do texto', () => {
  assert.equal(docDoLink('https://docs.google.com/document/u/0/d/1O2c5zBkQ9rcIsm86Zm3n5ehSQevyYdCtetMd0LSWe6Y/edit'), '1O2c5zBkQ9rcIsm86Zm3n5ehSQevyYdCtetMd0LSWe6Y');
  assert.equal(docDoLink('https://drive.google.com/file/d/xyz'), '');
  assert.deepEqual(pecasDoTexto('## Roteiro 1 - "O fim do não pode"\ntexto\nVídeo nº 2. A rede de apoio\nRoteiro de captação'), ['Roteiro 1: O fim do não pode', 'Vídeo 2: A rede de apoio']);
});
