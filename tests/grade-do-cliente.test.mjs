// Grade do mês no VybeHub (server/grade-do-cliente.js), contra um Postgres de verdade (PGlite), com o
// trocarStatus/comentar reais de api/conteudo.js — o mesmo caminho do link de aprovação.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import * as G from '../server/grade-do-cliente.js';
import { portalDoCliente } from '../server/planejamentos-api.js';
import { trocarStatus, comentar } from '../api/conteudo.js';

const fazer = { trocarStatus, comentar };
const HOJE = '2026-11-15';
const op = { hoje: HOJE, board: 1 };
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean DEFAULT true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,cadastro jsonb NOT NULL DEFAULT '{}'::jsonb);
  INSERT INTO vybe_clientes VALUES(10,'Alfa Café',true,'{"instagram":"@alfacafe","bio_instagram":"Café da casa"}'),(11,'Beta Moda',true,'{}');
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,board_id bigint,titulo text,formato text,status_chave text,status_em timestamptz,
    veiculacao date,prazo date,briefing text,atualizado_em timestamptz,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,veiculacao,briefing) VALUES
    (100,1,'Card - Café da manhã','Card','ag_aprovacao_cliente','2026-11-20','interno'),
    (101,1,'Reels - Bastidores','Reels','em_andamento','2026-11-18','interno'),
    (102,1,'Carrossel - Cardápio','Carrossel','ag_aprovacao_cliente','2026-11-25',NULL),
    (103,1,'Story - Bom dia','Stories','em_andamento','2026-11-19',NULL),
    (104,1,'Card - Já saiu','Card','publicado','2026-11-03',NULL),
    (105,1,'Card - Dezembro','Card','em_andamento','2026-12-02',NULL),
    (106,1,'Post - Depois da captura','Feed','publicado','2026-10-28',NULL),
    (107,2,'Pedido de arte','Card','em_andamento','2026-11-21',NULL),
    (200,1,'Card - Coleção verão','Card','ag_aprovacao_cliente','2026-11-21',NULL);
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(100,10),(101,10),(102,10),(103,10),(104,10),(105,10),(106,10),(107,10),(200,11);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,PRIMARY KEY(board_id,chave));
  INSERT INTO vybe_status VALUES(1,'ag_aprovacao_cliente','Ag. Aprovação Cliente',NULL),(1,'para_agendar','Para agendar',NULL),(1,'alteracao','Alteração',NULL),(1,'em_andamento','Em Andamento',NULL),(1,'publicado','Publicado',NULL);
  CREATE TABLE vybe_conteudo_eventos(id serial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT now());
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,autor text,autor_id bigint,editado_em timestamptz,criado_em timestamptz);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,nome text,extensao text,drive_file_id text,tamanho_bytes bigint,criado_em timestamptz DEFAULT now(),ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(id,conteudo_id,nome,extensao,drive_file_id,criado_em) VALUES
    (1,100,'cafe.mp4','mp4','drive-video','2026-11-10'),(2,100,'cafe.png','.png','drive-alfa','2026-11-09'),(3,100,'legenda.pdf','pdf','drive-pdf','2026-11-11'),
    (4,200,'verao.png','png','drive-beta','2026-11-09'),(5,106,'saiu.jpg','jpg','drive-saiu','2026-10-20');
  CREATE TABLE vybe_feed_captura(usuario text PRIMARY KEY,capturado_em timestamptz NOT NULL,perfil jsonb NOT NULL,gravado_por bigint,gravado_em timestamptz DEFAULT now());
  CREATE TABLE vybe_feed_captura_imagem(usuario text,chave text,dados text,PRIMARY KEY(usuario,chave));
  INSERT INTO vybe_feed_captura VALUES('alfacafe','2026-10-25T12:00:00Z','{"nome":"Alfa Café","bio":"Café coado na hora","total_posts":120,"seguidores":13300,"seguindo":210,
    "posts":[{"codigo":"AAAAA1","tipo":"video","fixado":true,"legenda":"x"},{"codigo":"BBBBB2","tipo":"foto"},{"codigo":"SEMIMG","tipo":"foto"}]}');
  INSERT INTO vybe_feed_captura_imagem VALUES('alfacafe','foto','Zm90bw=='),('alfacafe','AAAAA1','YWFh'),('alfacafe','BBBBB2','YmJi');`);
  return { db, sql };
}

test('grade do mês: só as peças de feed do cliente, na ordem, com a capa e nada interno', async (t) => {
  const { sql } = await banco(t);
  const g = await G.gradeDoPortal(sql, { cliente: 'alfa cafe', mes: '2026-11' }, op);
  assert.equal(g.cliente, 'Alfa Café'); assert.equal(g.mes, '2026-11');
  assert.deepEqual(g.pecas.map((p) => p.id), ['104', '101', '100', '102']);
  const p100 = g.pecas.find((p) => p.id === '100');
  assert.equal(p100.estado, 'aguardando'); assert.equal(p100.formato, 'Card');
  assert.deepEqual(p100.arte, [{ id: '2', video: false }, { id: '1', video: true }]); // imagem primeiro; PDF fora
  assert.equal(g.pecas.find((p) => p.id === '104').respondivel, false);
  assert.equal(g.pecas.find((p) => p.id === '101').estado, 'producao');
  const texto = JSON.stringify(g);
  for (const proibido of ['interno', 'em_andamento', 'ag_aprovacao_cliente', 'drive-', 'prazo', 'Coleção verão']) assert.ok(!texto.includes(proibido), proibido);
  assert.equal(g.perfil.usuario, 'alfacafe'); assert.equal(g.perfil.seguidores, 13300); assert.equal(g.perfil.bio, 'Café coado na hora'); assert.equal(g.perfil.foto, true);
  // O que a Vybe publicou depois da captura vem antes dos posts capturados; post sem imagem guardada fica de fora.
  assert.deepEqual(g.no_ar.map((x) => x.tipo === 'vybe' ? x.id : x.codigo), ['106', 'AAAAA1', 'BBBBB2']);
  assert.deepEqual(g.resumo, { total: 4, abertas: 3, com_arte: 1, ajustes: 0, aprovado: false });
  await assert.rejects(G.gradeDoPortal(sql, { cliente: 'Alfa Café', mes: '2026-13' }, op), /Mês inválido/);
  await assert.rejects(G.gradeDoPortal(sql, { cliente: 'Gama' }, op), (e) => e.status === 404);
});

test('aprovar o mês e pedir ajuste: status pelo mesmo caminho do link quando a peça espera o cliente', async (t) => {
  const { sql } = await banco(t);
  const r = await G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', mes: '2026-11', nome: 'Marina', respostas: [
    { conteudo_id: '100', acao: 'aprovar' },
    { conteudo_id: '101', acao: 'aprovar' },
    { conteudo_id: '102', acao: 'ajuste', comentario: 'Trocar a foto da capa' },
    { conteudo_id: '104', acao: 'aprovar' },
    { conteudo_id: '200', acao: 'aprovar' },
  ] }, fazer, op);
  assert.deepEqual(r.feitas.map((f) => [f.conteudo_id, f.acao, f.status_mudou]), [['100', 'aprovar', true], ['101', 'aprovar', false], ['102', 'ajuste', true]]);
  assert.deepEqual(r.recusadas.map((x) => x.conteudo_id), ['104', '200']);
  assert.ok(!r.recusadas.find((x) => x.conteudo_id === '200').titulo, 'peça de outro cliente não mostra o título');
  const st = Object.fromEntries((await sql`SELECT id::text AS id, status_chave FROM vybe_conteudos WHERE id IN (100,101,102,200)`).map((l) => [l.id, l.status_chave]));
  assert.deepEqual(st, { 100: 'para_agendar', 101: 'em_andamento', 102: 'alteracao', 200: 'ag_aprovacao_cliente' });
  const com = await sql`SELECT conteudo_id::text AS id, corpo, autor FROM vybe_conteudo_updates ORDER BY id`;
  assert.equal(com.length, 3);
  assert.ok(com.every((c) => c.autor === 'Marina (cliente · VybeHub)'));
  assert.match(com.find((c) => c.id === '102').corpo, /^🔧 Ajuste pedido pelo cliente \(Marina\) no VybeHub.*\nTrocar a foto da capa$/s);
  assert.match(com.find((c) => c.id === '101').corpo, /^✅ Grade do mês aprovada/);
  const ev = await sql`SELECT conteudo_id::text AS id, de, para FROM vybe_conteudo_eventos WHERE tipo='status' ORDER BY id`;
  assert.deepEqual(ev.map((e) => [e.id, e.para]), [['100', 'Para agendar'], ['102', 'Alteração']]);
  // A grade passa a mostrar a resposta de cada peça.
  const g = await G.gradeDoPortal(sql, { cliente: 'Alfa Café', mes: '2026-11' }, op);
  const p102 = g.pecas.find((p) => p.id === '102');
  assert.equal(p102.estado, 'ajuste'); assert.equal(p102.resposta.acao, 'ajuste'); assert.equal(p102.resposta.comentario, 'Trocar a foto da capa'); assert.equal(p102.resposta.nome, 'Marina');
  assert.equal(g.pecas.find((p) => p.id === '101').resposta.acao, 'aprovar');
  assert.equal(g.pecas.find((p) => p.id === '100').estado, 'aprovada');
  assert.equal(g.resumo.ajustes, 1); assert.equal(g.resumo.aprovado, false);
});

test('peça em aprovação sem arte: aprovar a grade não pula a aprovação da arte', async (t) => {
  const { sql } = await banco(t);
  await sql`DELETE FROM vybe_conteudo_arquivos WHERE conteudo_id = 100`;
  const r = await G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', mes: '2026-11', nome: 'Marina', respostas: [{ conteudo_id: '100', acao: 'aprovar' }] }, fazer, op);
  assert.equal(r.feitas[0].status_mudou, false);
  const [c] = await sql`SELECT status_chave FROM vybe_conteudos WHERE id = 100`;
  assert.equal(c.status_chave, 'ag_aprovacao_cliente');
  const [u] = await sql`SELECT corpo FROM vybe_conteudo_updates`;
  assert.match(u.corpo, /a arte ainda precisa da aprovação dele/);
});

test('resposta inválida não grava nada', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', nome: '', respostas: [{ conteudo_id: '100', acao: 'aprovar' }] }, fazer, op), /seu nome/);
  await assert.rejects(G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', nome: 'M', respostas: [{ conteudo_id: '102', acao: 'ajuste' }] }, fazer, op), /o que precisa ajustar/);
  await assert.rejects(G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', nome: 'M', respostas: [{ conteudo_id: '102', acao: 'publicar' }] }, fazer, op), /Aprovar ou Pedir ajuste/);
  await assert.rejects(G.responderGradeDoPortal(sql, { cliente: 'Alfa Café', nome: 'M', respostas: [] }, fazer, op), /Nenhuma peça/);
  const [n] = await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_updates`;
  assert.equal(n.n, 0);
});

test('imagens: só a arte de peça de feed do cliente e a captura do perfil dele', async (t) => {
  const { sql } = await banco(t);
  const pedidos = [];
  const miniatura = async (id, sz) => { pedidos.push([id, sz]); return { bytes: Buffer.from('img'), tipo: 'image/png' }; };
  const a = await G.imagemDaGradeDoPortal(sql, { cliente: 'Alfa Café', arquivo: '2', tamanho: 'grande' }, { miniatura, board: 1 });
  assert.deepEqual(a, { tipo: 'image/png', base64: Buffer.from('img').toString('base64') });
  assert.deepEqual(pedidos, [['drive-alfa', 1080]]);
  await assert.rejects(G.imagemDaGradeDoPortal(sql, { cliente: 'Alfa Café', arquivo: '4' }, { miniatura, board: 1 }), (e) => e.status === 404); // de outro cliente
  const f = await G.imagemDaGradeDoPortal(sql, { cliente: 'Alfa Café', captura: 'foto' }, { board: 1 });
  assert.equal(f.base64, 'Zm90bw==');
  await assert.rejects(G.imagemDaGradeDoPortal(sql, { cliente: 'Beta Moda', captura: 'foto' }, { board: 1 }), (e) => e.status === 404);
  await assert.rejects(G.imagemDaGradeDoPortal(sql, { cliente: 'Alfa Café', captura: '../x' }, { board: 1 }), (e) => e.status === 404);
});

test('area=portal: grade só com a chave do portal', async (t) => {
  const { sql } = await banco(t);
  const antes = process.env.PORTAL_CHAVE; process.env.PORTAL_CHAVE = 'k'.repeat(32); t.after(() => { process.env.PORTAL_CHAVE = antes; });
  const res = () => { const r = { codigo: 0 }; r.status = (c) => { r.codigo = c; return r; }; r.json = (b) => { r.corpo = b; return r; }; return r; };
  const r1 = res();
  await portalDoCliente({ method: 'POST', headers: { authorization: 'Bearer errada' }, body: { rota: 'grade', cliente: 'Alfa Café' } }, r1, sql);
  assert.equal(r1.codigo, 401);
  const r2 = res();
  await portalDoCliente({ method: 'POST', headers: { authorization: `Bearer ${'k'.repeat(32)}` }, body: { rota: 'grade_responder', cliente: 'Alfa Café', nome: 'M', respostas: [{ conteudo_id: '101', acao: 'aprovar' }] } }, r2, sql);
  assert.equal(r2.codigo, 503); // sem o caminho de escrita, não grava
  const r3 = res();
  await portalDoCliente({ method: 'POST', headers: { authorization: `Bearer ${'k'.repeat(32)}` }, body: { rota: 'grade', cliente: 'Alfa Café', mes: '2026-11' } }, r3, sql);
  assert.equal(r3.codigo, 200); assert.equal(r3.corpo.cliente, 'Alfa Café');
});

test('formatos e situações', () => {
  assert.equal(G.formatoDaGrade('Reels').nome, 'Reels'); assert.equal(G.formatoDaGrade('carrossel').nome, 'Carrossel');
  assert.equal(G.formatoDaGrade('').nome, 'Post'); assert.equal(G.formatoDaGrade('Stories'), null); assert.equal(G.formatoDaGrade('Vídeo'), null);
  assert.equal(G.estadoParaCliente('agendado'), 'aprovada'); assert.equal(G.estadoParaCliente('qualquer'), 'producao');
  assert.equal(G.usuarioDoInstagram('https://instagram.com/Alfa.Cafe/'), 'alfa.cafe');
});
