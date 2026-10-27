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
