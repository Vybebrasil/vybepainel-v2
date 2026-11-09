// Link público de aprovação de peças e objetivo da peça (módulo Conteúdo, 07/11/2026):
// server/conteudo-aprovacao.js, server/conteudo-aprovacao-pagina.js e server/conteudo-objetivo.js,
// contra um Postgres de verdade (PGlite), com o trocarStatus/comentar reais de api/conteudo.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import * as A from '../server/conteudo-aprovacao.js';
import { paginaAprovarPecas } from '../server/conteudo-aprovacao-pagina.js';
import { trocarObjetivo, listarObjetivos } from '../server/conteudo-objetivo.js';
import { trocarStatus, comentar } from '../api/conteudo.js';

const fazer = { trocarStatus, comentar };
const MIGRACAO = readFileSync('migrations/2026-11-07-conteudo-objetivo-aprovacao.sql', 'utf8');
async function banco(t, { migrar = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean DEFAULT true);
  INSERT INTO vybe_pessoas VALUES(1,'Paulo','paulo@vybe.invalid',true),(3,'Vinícius','vini@vybe.invalid',true),(24,'Ewerton','ew@vybe.invalid',true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
  INSERT INTO vybe_clientes VALUES(10,'Alfa Café',true),(11,'Beta Moda',true);
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(10,3,0),(11,24,0);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,board_id bigint,titulo text,formato text,status_chave text,status_em timestamptz,
    veiculacao date,atualizado_em timestamptz,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,monday_item_id,board_id,titulo,formato,status_chave,veiculacao) VALUES
    (100,NULL,1,'Card - Café da manhã','Card','ag_aprovacao_cliente','2026-11-20'),
    (101,'555',1,'Reels - Bastidores','Reels','ag_aprovacao_cliente','2026-11-22'),
    (102,NULL,1,'Card - Em produção','Card','em_andamento','2026-11-23'),
    (200,NULL,1,'Card - Coleção verão','Card','ag_aprovacao_cliente','2026-11-21');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(100,10),(101,10),(102,10),(200,11);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,PRIMARY KEY(board_id,chave));
  INSERT INTO vybe_status VALUES(1,'ag_aprovacao_cliente','Ag. Aprovação Cliente',NULL),(1,'para_agendar','Para agendar',NULL),(1,'alteracao','Alteração',NULL),(1,'em_andamento','Em Andamento',NULL);
  CREATE TABLE vybe_conteudo_eventos(id serial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT now());
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,autor text,criado_em timestamptz);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,nome text,extensao text,drive_file_id text,tamanho_bytes bigint,criado_em timestamptz DEFAULT now(),ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id) VALUES(100,'cafe.png','.png','drive-alfa'),(200,'verao.png','.png','drive-beta');`);
  if (migrar) await db.exec(MIGRACAO);
  return { db, sql };
}
const resposta = () => {
  const r = { codigo: 0, cab: {}, corpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.setHeader = (k, v) => { r.cab[k.toLowerCase()] = v; };
  r.send = (b) => { r.corpo = b; return r; }; r.json = (b) => { r.corpo = b; return r; }; r.end = (b) => { r.corpo = b; return r; };
  return r;
};

test('sem a migração: nada quebra, tudo avisa', async (t) => {
  const { sql } = await banco(t, { migrar: false });
  const o = await listarObjetivos(sql);
  assert.equal(o.pronto, false); assert.match(o.aviso, /migração/); assert.deepEqual(o.objetivos, {});
  await assert.rejects(trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: 'vybe:100', objetivo: 'atracao' }), (e) => e.status === 503);
  await assert.rejects(A.gerarLink(sql, { id: 3 }, { cliente_id: 10 }), (e) => e.status === 503);
  const p = await A.painelDeAprovacao(sql, { id: 3 });
  assert.equal(p.pronto, false); assert.equal(p.clientes[0].pendentes, 2);
  const res = resposta();
  await paginaAprovarPecas({ method: 'GET', query: { t: 'x'.repeat(32) } }, res, sql, { fazer });
  assert.equal(res.codigo, 503); assert.match(res.corpo, /Aprovação indisponível/);
});

test('objetivo da peça: grava, limpa, recusa valor inválido e aparece no mapa do painel', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: 'vybe:100', objetivo: 'branding' }), /inválido/);
  await assert.rejects(trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: 'vybe:999', objetivo: 'atracao' }), (e) => e.status === 404);
  assert.equal((await trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: 'vybe:100', objetivo: 'atracao' })).mudou, true);
  await trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: '555', objetivo: 'conversao' });
  assert.deepEqual((await listarObjetivos(sql)).objetivos, { 'vybe:100': 'atracao', 555: 'conversao' });
  await trocarObjetivo(sql, { pessoa: { id: 3 } }, { item: 'vybe:100', objetivo: '' });
  assert.deepEqual((await listarObjetivos(sql)).objetivos, { 555: 'conversao' });
  const ev = await sql`SELECT tipo,de,para,autor_id FROM vybe_conteudo_eventos WHERE conteudo_id=100 ORDER BY id`;
  assert.deepEqual(ev.map((e) => [e.tipo, e.de, e.para, Number(e.autor_id)]), [['objetivo', null, 'Atração', 3], ['objetivo', 'Atração', null, 3]]);
});

test('só o head do cliente (ou admin) gera link; o token não fica no banco', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(A.gerarLink(sql, { id: 24 }, { cliente_id: 10 }), (e) => e.status === 403);
  await assert.rejects(A.gerarLink(sql, { id: 3 }, { cliente_id: 10, dias: 90 }), /1 a 30/);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10, dias: 7 });
  assert.ok(A.tokenComFormato(l.token));
  const [linha] = await sql`SELECT token_hash FROM vybe_aprovacao_links WHERE id=${l.id}`;
  assert.notEqual(linha.token_hash, l.token); assert.equal(linha.token_hash, A.hashDoToken(l.token));
  assert.ok((await A.gerarLink(sql, { id: 1, admin: true }, { cliente_id: 11 })).token);
  const painel = await A.painelDeAprovacao(sql, { id: 3 });
  assert.deepEqual(painel.clientes.map((c) => [c.nome, c.pendentes, c.links.length]), [['Alfa Café', 2, 1]]);
  assert.equal(JSON.stringify(painel).includes(l.token), false);
});

test('token inválido, revogado ou expirado é recusado', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(A.pecasDoLink(sql, 'curto'), (e) => e.status === 404);
  await assert.rejects(A.pecasDoLink(sql, 'A'.repeat(32)), (e) => e.status === 404, 'formato certo, mas não existe');
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await sql`UPDATE vybe_aprovacao_links SET expira_em = now() - interval '1 minute' WHERE id=${l.id}`;
  await assert.rejects(A.pecasDoLink(sql, l.token), (e) => e.status === 410);
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 100, acao: 'aprovar', nome: 'Ana' }, fazer), (e) => e.status === 410);
  const res = resposta();
  await paginaAprovarPecas({ method: 'GET', query: { t: l.token } }, res, sql, { fazer });
  assert.equal(res.codigo, 410); assert.match(res.corpo, /expirou/);
  const l2 = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await assert.rejects(A.revogarLink(sql, { id: 24 }, { id: l2.id }), (e) => e.status === 403);
  await A.revogarLink(sql, { id: 3 }, { id: l2.id });
  await assert.rejects(A.pecasDoLink(sql, l2.token), (e) => e.status === 404);
  const status = await sql`SELECT status_chave FROM vybe_conteudos WHERE id=100`;
  assert.equal(status[0].status_chave, 'ag_aprovacao_cliente', 'nada mudou');
});

test('cliente A não vê nem responde peça do cliente B, nem abre o arquivo dela', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const d = await A.pecasDoLink(sql, l.token);
  assert.equal(d.cliente, 'Alfa Café');
  assert.deepEqual(d.pecas.map((p) => p.id), ['100', '101'], 'só as do cliente, só em aprovação');
  assert.equal(JSON.stringify(d).includes('Coleção verão'), false);
  assert.equal(d.pecas[0].arquivos[0].imagem, true);
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 200, acao: 'aprovar', nome: 'Ana' }, fazer), (e) => e.status === 404);
  const [arqB] = await sql`SELECT id FROM vybe_conteudo_arquivos WHERE conteudo_id=200`;
  await assert.rejects(A.arquivoDoLink(sql, l.token, arqB.id), (e) => e.status === 404);
  const [arqA] = await sql`SELECT id FROM vybe_conteudo_arquivos WHERE conteudo_id=100`;
  assert.equal((await A.arquivoDoLink(sql, l.token, arqA.id)).drive_file_id, 'drive-alfa');
  const [st] = await sql`SELECT status_chave FROM vybe_conteudos WHERE id=200`;
  assert.equal(st.status_chave, 'ag_aprovacao_cliente');
  // A página mostra só o cliente do link e nada da equipe.
  const res = resposta();
  await paginaAprovarPecas({ method: 'GET', query: { t: l.token } }, res, sql, { fazer });
  assert.equal(res.codigo, 200);
  assert.match(res.corpo, /Café da manhã/); assert.doesNotMatch(res.corpo, /Coleção verão|Vinícius|Beta Moda|Em produção/);
  assert.match(res.cab['content-security-policy'], /default-src 'none'/);
  assert.equal(res.cab['referrer-policy'], 'no-referrer');
});

test('aprovar muda para Para agendar e pedir ajuste para Alteração, registrando quem e quando', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 100, acao: 'aprovar', nome: '' }, fazer), /seu nome/);
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 101, acao: 'ajuste', nome: 'Ana' }, fazer), /o que precisa ajustar/);
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 101, acao: 'ajuste', nome: 'Ana', comentario: 'x'.repeat(1001) }, fazer), /até 1000/);
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 102, acao: 'aprovar', nome: 'Ana' }, fazer), (e) => e.status === 409, 'peça fora de aprovação');

  const r = await A.responderPeca(sql, l.token, { conteudo_id: 100, acao: 'aprovar', nome: 'Ana Souza' }, fazer);
  assert.equal(r.status, 'Para agendar');
  // Pela página (JSON), como o navegador do cliente manda.
  const res = resposta();
  await paginaAprovarPecas({ method: 'POST', query: { t: l.token }, body: { conteudo_id: '101', acao: 'ajuste', nome: 'Ana Souza', comentario: 'Trocar a música.' } }, res, sql, { fazer });
  assert.equal(res.codigo, 200); assert.equal(res.corpo.status, 'Alteração');

  const pecas = await sql`SELECT id::int,status_chave FROM vybe_conteudos WHERE id IN (100,101) ORDER BY id`;
  assert.deepEqual(pecas.map((p) => p.status_chave), ['para_agendar', 'alteracao']);
  const resp = await sql`SELECT conteudo_id::int,acao,nome,comentario,status_de,status_para,em FROM vybe_aprovacao_respostas ORDER BY id`;
  assert.deepEqual(resp.map((x) => [x.conteudo_id, x.acao, x.nome, x.status_de, x.status_para]),
    [[100, 'aprovar', 'Ana Souza', 'Ag. Aprovação Cliente', 'Para agendar'], [101, 'ajuste', 'Ana Souza', 'Ag. Aprovação Cliente', 'Alteração']]);
  assert.ok(resp[0].em);
  const ev = await sql`SELECT conteudo_id::int,tipo,para FROM vybe_conteudo_eventos WHERE tipo='status' ORDER BY id`;
  assert.deepEqual(ev.map((e) => [e.conteudo_id, e.para]), [[100, 'Para agendar'], [101, 'Alteração']]);
  const coment = await sql`SELECT corpo,autor FROM vybe_conteudo_updates WHERE conteudo_id=101`;
  assert.match(coment[0].corpo, /Ajuste pedido pelo cliente \(Ana Souza\)[\s\S]*Trocar a música/);
  // Responder de novo não muda: a peça saiu da aprovação.
  await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: 100, acao: 'ajuste', nome: 'Ana', comentario: 'x' }, fazer), (e) => e.status === 409);
  // O painel sabe a última resposta (para o calendário marcar "aprovado pelo cliente").
  const o = await listarObjetivos(sql);
  assert.equal(o.respostas['vybe:100'].acao, 'aprovar'); assert.equal(o.respostas['555'].acao, 'ajuste');
  const vistas = await A.pecasDoLink(sql, l.token);
  assert.equal(vistas.pecas.length, 0); assert.equal(vistas.respondidas.length, 2);
});
