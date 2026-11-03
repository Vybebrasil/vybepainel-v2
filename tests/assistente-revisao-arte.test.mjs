import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { arteDaPeca, comentarRevisao } from '../server/assistente-revisao-arte.js';

const PROD = 7829537690;
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text,criado_em timestamptz);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_clientes VALUES (10,'Copirecê');
    INSERT INTO vybe_conteudo_updates VALUES (100,'<p>LEGENDA DO POST: Creme de milho Copirecê, do campo para a sua mesa.</p>','2026-10-26'),(100,'<p>Bom dia</p>','2026-10-26');
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
  assert.match(r.peca.texto, /LEGENDA DO POST: Creme de milho/); assert.doesNotMatch(r.peca.texto, /Bom dia/);
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

test('prévia da peça: as lâminas do olho do painel, na mesma ordem (mais nova primeiro), pela miniatura do Drive', async () => {
  const { previaDaPeca } = await import('../server/assistente-revisao-arte.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
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
    assert.match(url, /=s1600-rj$/, 'miniatura em JPEG'); return new Response(Buffer.from('JPG'), { headers: { 'content-type': 'image/jpeg' } });
  } });
  assert.deepEqual(pedidas, ['d3', 'd2', 'd1', 'd0']);
  assert.equal(r.midias.length, 4); assert.equal(r.midias[0].video, true);
  assert.deepEqual(r.midias.map((m) => m.drive), ['d3', 'd2', 'd1', 'd0']);
});

test('prévia da peça: o vídeo do link de entrega (arquivo ou pasta do dia) vem primeiro, como no olho do painel', async () => {
  const { previaDaPeca } = await import('../server/assistente-revisao-arte.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text,criado_em timestamptz);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_clientes VALUES (27,'VOA');
    INSERT INTO vybe_conteudos VALUES (200,7829537690,'Reels - Cinematic produto 11','Reels',NULL,NULL,NULL),(201,7829537690,'Reels - Bastidores','Reels',NULL,NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (200,27),(201,27);
    INSERT INTO vybe_conteudo_updates VALUES
      (200,'<p>[Vybe OS · Link de entrega] https://drive.google.com/drive/folders/PASTA_DO_DIA_26</p>','2026-11-01'),
      (201,'<p>Link de entrega: https://drive.google.com/file/d/ARQUIVO_FINAL_9/view?usp=sharing</p>','2026-11-01');`);
  const buscar = async (url) => /files\/[^?]+\?fields/.test(url) ? new Response(JSON.stringify({ thumbnailLink: 'https://lh3/t=s220' })) : new Response(Buffer.from('JPG'), { headers: { 'content-type': 'image/jpeg' } });
  const pasta = async (id) => { assert.equal(id, 'PASTA_DO_DIA_26'); return [
    { id: 'VIDEO_OUTRO_CLIENTE', nome: 'gonzalez grelhados.mp4', caminho: 'GONZALEZ' },
    { id: 'VIDEO_DA_VOA_11', nome: 'cinematic produto 11.mp4', caminho: 'VOA' }]; };
  const r = await previaDaPeca(sql, 'vybe:200', { buscar, pegarToken: async () => 't', pasta });
  assert.equal(r.midias[0].drive, 'VIDEO_DA_VOA_11', 'na pasta, o vídeo que combina com cliente e título');
  assert.equal(r.midias[0].video, true);
  const a = await previaDaPeca(sql, 'vybe:201', { buscar, pegarToken: async () => 't', pasta: async () => { throw Error('não é pasta'); } });
  assert.equal(a.midias[0].drive, 'ARQUIVO_FINAL_9'); assert.equal(a.midias[0].video, true);
});

test('prévia da peça: sem miniatura pela API do Drive, usa o endereço público que o painel usa', async () => {
  const { previaDaPeca } = await import('../server/assistente-revisao-arte.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text,criado_em timestamptz);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_conteudos VALUES (300,7829537690,'Card - Agenda Musical','Card',NULL,NULL,NULL);
    INSERT INTO vybe_conteudo_arquivos VALUES (1,300,'agenda.png','png',1,'ARTE_DA_AGENDA','2026-11-02 10:00',NULL);`);
  const pedidas = [];
  const r = await previaDaPeca(sql, 'vybe:300', { pegarToken: async () => 't', buscar: async (url) => {
    pedidas.push(url);
    if (/googleapis/.test(url)) return new Response(JSON.stringify({}), { status: 200 }); // a API não dá miniatura
    if (/drive\.google\.com\/thumbnail\?id=ARTE_DA_AGENDA&sz=w1600/.test(url)) return new Response(Buffer.from('PNG'), { headers: { 'content-type': 'image/png' } });
    return new Response('nada', { status: 404 });
  } });
  assert.equal(r.midias.length, 1); assert.equal(r.midias[0].drive, 'ARTE_DA_AGENDA'); assert.equal(r.midias[0].mimetype, 'image/png');
  assert.ok(pedidas.some((u) => /drive\.google\.com\/thumbnail/.test(u)));
});

test('prévia da peça: carrossel pesado não estoura a resposta — entram as lâminas que cabem, em JPEG', async () => {
  const { previaDaPeca } = await import('../server/assistente-revisao-arte.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text,criado_em timestamptz);
    CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
    INSERT INTO vybe_conteudos VALUES (400,7829537690,'Card - Agenda Musical','Card',NULL,NULL,NULL);
    INSERT INTO vybe_conteudo_arquivos VALUES (1,400,'S1.png','png',1,'L1','2026-10-30 16:20',NULL),(2,400,'QUA.png','png',1,'L2','2026-10-30 16:21',NULL),
      (3,400,'QUI.png','png',1,'L3','2026-10-30 16:22',NULL),(4,400,'SEX.png','png',1,'L4','2026-10-30 16:23',NULL),(5,400,'SAB.png','png',1,'L5','2026-10-30 16:24',NULL);`);
  const pesada = Buffer.alloc(1024 * 1024, 1); // ~1,33 MB em base64 por lâmina
  const r = await previaDaPeca(sql, 'vybe:400', { pegarToken: async () => 't', buscar: async (url) =>
    /googleapis/.test(url) ? new Response(JSON.stringify({ thumbnailLink: 'https://lh3/x=s220' })) : new Response(pesada, { headers: { 'content-type': 'image/jpeg' } }) });
  assert.deepEqual(r.midias.map((m) => m.drive), ['L5', 'L4']);
  assert.ok(r.midias.reduce((t, m) => t + m.data.length, 0) <= 3.4 * 1024 * 1024);
  assert.equal(r.total, 5, 'o total continua dizendo quantas lâminas a peça tem');
});
