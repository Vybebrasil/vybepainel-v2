import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { arteDaPeca, comentarRevisao } from '../server/assistente-revisao-arte.js';

const PROD = 7829537690;
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_clientes VALUES (10,'Copirecê');
    INSERT INTO vybe_status VALUES (${PROD},'a','Para aprovação',false);
    INSERT INTO vybe_conteudos VALUES (100,${PROD},'Card - Creme de milho','Card',NULL,'a',555),(101,${PROD},'Reels - Sem arte','Reels',NULL,'a',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,10);
    INSERT INTO vybe_conteudo_arquivos VALUES (1,100,'v1.png','png',100,'drive-antigo','2026-10-20',NULL),(2,100,'v2.png','png',100,'drive-novo','2026-10-26',NULL);`);
  return sql;
}

test('arte da peça: a versão mais recente do Drive, com cliente, status e link', async () => {
  const sql = await banco(); const pedidos = [];
  const r = await arteDaPeca(sql, '555', { baixar: async (id) => { pedidos.push(id); return new Response(Buffer.from('PNG')); } });
  assert.deepEqual(pedidos, ['drive-novo']);
  assert.equal(r.peca.cliente, 'Copirecê'); assert.equal(r.peca.status, 'Para aprovação');
  assert.match(r.peca.link, /atividade=555/);
  assert.equal(Buffer.from(r.arte.data, 'base64').toString(), 'PNG'); assert.equal(r.arte.mimetype, 'image/png');
  const sem = await arteDaPeca(sql, 'vybe:101', { baixar: async () => { throw Error('não deve baixar'); } });
  assert.equal(sem.arte, null); assert.equal(sem.motivo, 'sem_arquivo');
  await assert.rejects(arteDaPeca(sql, '999'), /Peça não encontrada/);
});

test('revisão vira comentário da Vybe IA pela função do painel; status não é tocado', async () => {
  const sql = await banco(); const feitos = [];
  const r = await comentarRevisao(sql, '555', 'Tudo certo, só o acento de Copirecê.', { executar: { comentar: async (_s, quem, d) => feitos.push({ quem, d }) } });
  assert.equal(feitos[0].quem.pessoa.nome, 'Vybe IA'); assert.equal(feitos[0].d.item, '555');
  assert.match(feitos[0].d.texto, /o status não muda/); assert.match(feitos[0].d.texto, /acento de Copirecê/);
  assert.ok(r.ok);
});

test('prévia da peça: a última entrega inteira (lâminas do carrossel) pela miniatura do Drive', async () => {
  const { previaDaPeca } = await import('../server/assistente-revisao-arte.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_conteudos VALUES (100,7829537690,'Carrossel - Dicas','Carrossel',NULL,NULL,555);
    INSERT INTO vybe_conteudo_arquivos VALUES (1,100,'antiga.png','png',1,'d0','2026-10-20 10:00',NULL),
     (2,100,'lamina1.png','png',1,'d1','2026-10-26 10:00',NULL),(3,100,'lamina2.png','png',1,'d2','2026-10-26 10:01',NULL),(4,100,'video.mp4','mp4',1,'d3','2026-10-26 10:02',NULL);`);
  const pedidas = [];
  const r = await previaDaPeca(sql, '555', { pegarToken: async () => 'token-de-teste', buscar: async (url) => {
    const id = /files\/([^?]+)\?fields/.exec(url)?.[1];
    if (id) { pedidas.push(id); return new Response(JSON.stringify({ thumbnailLink: 'https://lh3/thumb-' + id + '=s220' })); }
    assert.match(url, /=s1600$/); return new Response(Buffer.from('JPG'), { headers: { 'content-type': 'image/jpeg' } });
  } });
  assert.deepEqual(pedidas, ['d1', 'd2', 'd3']);
  assert.equal(r.midias.length, 3); assert.equal(r.midias[2].video, true);
});
