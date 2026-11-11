// Quadro 26 do redesign (11/11/2026): registro de "vista" e "Aprovar todas as vistas" na página do link de
// aprovação de peças (server/conteudo-aprovacao.js e server/conteudo-aprovacao-pagina.js), contra um Postgres
// de verdade (PGlite), com o trocarStatus/comentar reais de api/conteudo.js. Com e sem a migração nova
// (migrations/2026-11-11-aprovacao-vistas.sql), que o Paulo aplica à mão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import * as A from '../server/conteudo-aprovacao.js';
import { paginaHtml, paginaAprovarPecas } from '../server/conteudo-aprovacao-pagina.js';
import { trocarStatus, comentar } from '../api/conteudo.js';

const fazer = { trocarStatus, comentar };
const BASE = readFileSync('migrations/2026-11-07-conteudo-objetivo-aprovacao.sql', 'utf8');
const VISTAS = readFileSync('migrations/2026-11-11-aprovacao-vistas.sql', 'utf8');

async function banco(t, { vistas = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean DEFAULT true);
  INSERT INTO vybe_pessoas VALUES(3,'Vinícius','vini@vybe.invalid',true),(24,'Ewerton','ew@vybe.invalid',true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
  INSERT INTO vybe_clientes VALUES(10,'Alfa Café',true),(11,'Beta Moda',true);
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(10,3,0),(11,24,0);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,board_id bigint,titulo text,formato text,status_chave text,status_em timestamptz,
    veiculacao date,atualizado_em timestamptz,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,veiculacao) VALUES
    (100,1,'Reels - Bastidores','Reels','ag_aprovacao_cliente','2026-11-14'),
    (101,1,'Card - Horário especial','Card','ag_aprovacao_cliente','2026-11-15'),
    (102,1,'Carrossel - Três dúvidas','Carrossel','ag_aprovacao_cliente','2026-11-16'),
    (103,1,'Card - Arte que saiu do Drive','Card','ag_aprovacao_cliente','2026-11-17'),
    (104,1,'Card - Promoção de sexta','Card','ag_aprovacao_cliente','2026-11-18'),
    (105,1,'Card - Já agendado','Card','para_agendar','2026-11-19'),
    (200,1,'Card - Coleção verão','Card','ag_aprovacao_cliente','2026-11-21');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(100,10),(101,10),(102,10),(103,10),(104,10),(105,10),(200,11);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,PRIMARY KEY(board_id,chave));
  INSERT INTO vybe_status VALUES(1,'ag_aprovacao_cliente','Ag. Aprovação Cliente',NULL),(1,'para_agendar','Para agendar',NULL),(1,'alteracao','Alteração',NULL);
  CREATE TABLE vybe_conteudo_eventos(id serial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT now());
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,autor text,criado_em timestamptz);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,nome text,extensao text,drive_file_id text,tamanho_bytes bigint,
    criado_em timestamptz DEFAULT now() - interval '1 hour',ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id,ausente_em) VALUES
    (100,'bastidores.mp4','.mp4','d-video',NULL),
    (102,'tela-1.png','.png','d-1',NULL),(102,'tela-2.png','.png','d-2',NULL),
    (103,'antiga.png','.png','d-x',now()),
    (104,'promo.png','.png','d-p',NULL),(105,'agendado.png','.png','d-a',NULL),(200,'verao.png','.png','d-b',NULL);`);
  await db.exec(BASE);
  if (vistas) await db.exec(VISTAS);
  return { db, sql };
}
const resposta = () => {
  const r = { codigo: 0, cab: {}, corpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.setHeader = (k, v) => { r.cab[k.toLowerCase()] = v; };
  r.send = (b) => { r.corpo = b; return r; }; r.json = (b) => { r.corpo = b; return r; }; r.end = (b) => { r.corpo = b; return r; };
  return r;
};
const statusDe = async (sql, ids) => Object.fromEntries((await sql`SELECT id::text AS id, status_chave FROM vybe_conteudos
  WHERE id::text = ANY(${ids.map(String)})`).map((c) => [c.id, c.status_chave]));

test('a migração nova é idempotente e não mexe no que existe', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(VISTAS); // segunda vez, sem erro
  const [r] = await sql`SELECT to_regclass('vybe_aprovacao_vistas') IS NOT NULL AS ok`;
  assert.equal(r.ok, true);
  assert.match(VISTAS, /CREATE TABLE IF NOT EXISTS vybe_aprovacao_vistas/);
  assert.doesNotMatch(VISTAS, /DROP |ALTER TABLE vybe_conteudos|DELETE /i);
});

test('vista: só peça do cliente do link, em aprovação e com arte; arte nova pede outra vista', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  let d = await A.pecasDoLink(sql, l.token);
  assert.equal(d.vistas, true);
  assert.deepEqual(d.pecas.map((p) => [p.id, p.vista]), [['100', false], ['101', false], ['102', false], ['103', false], ['104', false]]);
  assert.deepEqual(await A.registrarVista(sql, l.token, { conteudo_id: '100' }), { conteudo_id: '100', vista: true });
  await A.registrarVista(sql, l.token, { conteudo_id: '100' }); // de novo: só atualiza a hora
  await assert.rejects(A.registrarVista(sql, l.token, { conteudo_id: '101' }), (e) => e.status === 409, 'sem arte');
  await assert.rejects(A.registrarVista(sql, l.token, { conteudo_id: '103' }), (e) => e.status === 409, 'arte ausente do Drive');
  await assert.rejects(A.registrarVista(sql, l.token, { conteudo_id: '200' }), (e) => e.status === 404, 'peça de outro cliente');
  await assert.rejects(A.registrarVista(sql, l.token, { conteudo_id: '105' }), (e) => e.status === 404, 'fora de aprovação');
  await assert.rejects(A.registrarVista(sql, l.token, { conteudo_id: 'x' }), (e) => e.status === 400);
  await assert.rejects(A.registrarVista(sql, 'A'.repeat(32), { conteudo_id: '100' }), (e) => e.status === 404, 'token que não existe');
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_aprovacao_vistas`)[0].n, 1);
  d = await A.pecasDoLink(sql, l.token);
  assert.equal(d.pecas.find((p) => p.id === '100').vista, true);
  // A arte mudou depois da vista (ajuste e nova versão): a vista antiga não vale.
  await sql`INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id,criado_em) VALUES(100,'v2.mp4','.mp4','d-v2',now() + interval '1 minute')`;
  d = await A.pecasDoLink(sql, l.token);
  assert.equal(d.pecas.find((p) => p.id === '100').vista, false);
  // Vista de um link não vale para outro link do mesmo cliente.
  const l2 = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await A.registrarVista(sql, l.token, { conteudo_id: '104' });
  assert.equal((await A.pecasDoLink(sql, l2.token)).pecas.find((p) => p.id === '104').vista, false);
});

test('lote aprova só o que pode: vista, com arte, em aprovação e do cliente; o resto sai com o motivo', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  for (const id of ['100', '102']) await A.registrarVista(sql, l.token, { conteudo_id: id });
  const r = await A.aprovarVistas(sql, l.token, { nome: 'Ana Souza', conteudo_ids: ['100', '101', '102', '103', '104', '105', '200', '100'] }, fazer);
  assert.deepEqual(r.aprovadas.map((a) => [a.conteudo_id, a.status]), [['100', 'Para agendar'], ['102', 'Para agendar']]);
  assert.deepEqual(r.recusadas.map((x) => [x.conteudo_id, x.motivo]), [
    ['101', A.MOTIVO.semArte], ['103', A.MOTIVO.semArte], ['104', A.MOTIVO.naoVista], ['105', A.MOTIVO.respondida], ['200', A.MOTIVO.fora]]);
  // Peça de outro cliente: nem o título volta.
  assert.equal(JSON.stringify(r).includes('Coleção verão'), false);
  assert.equal(r.vistas, true);
  assert.deepEqual(await statusDe(sql, [100, 101, 102, 103, 104, 105, 200]), { 100: 'para_agendar', 101: 'ag_aprovacao_cliente', 102: 'para_agendar',
    103: 'ag_aprovacao_cliente', 104: 'ag_aprovacao_cliente', 105: 'para_agendar', 200: 'ag_aprovacao_cliente' });
  // O mesmo registro da aprovação de uma peça: resposta do link, evento de status e comentário na peça.
  const resp = await sql`SELECT conteudo_id::int AS id, acao, nome, status_de, status_para FROM vybe_aprovacao_respostas ORDER BY id`;
  assert.deepEqual(resp.map((x) => [x.id, x.acao, x.nome, x.status_de, x.status_para]),
    [[100, 'aprovar', 'Ana Souza', 'Ag. Aprovação Cliente', 'Para agendar'], [102, 'aprovar', 'Ana Souza', 'Ag. Aprovação Cliente', 'Para agendar']]);
  const ev = await sql`SELECT conteudo_id::int AS id, para FROM vybe_conteudo_eventos WHERE tipo='status' ORDER BY id`;
  assert.deepEqual(ev.map((e) => [e.id, e.para]), [[100, 'Para agendar'], [102, 'Para agendar']]);
  const com = await sql`SELECT conteudo_id::int AS id, corpo FROM vybe_conteudo_updates ORDER BY id`;
  assert.deepEqual(com.map((c) => c.id), [100, 102]);
  assert.match(com[0].corpo, /Aprovado pelo cliente \(Ana Souza\) pelo link de aprovação[\s\S]*outra peça em "Aprovar todas as vistas"/);
  // Respondidas saem da página e entram no histórico do link.
  const d = await A.pecasDoLink(sql, l.token);
  assert.deepEqual(d.pecas.map((p) => p.id), ['101', '103', '104']);
  assert.equal(d.respondidas.length, 2);
  // De novo: nada a aprovar, as duas já foram.
  const r2 = await A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: ['100', '102'] }, fazer);
  assert.deepEqual(r2.aprovadas, []); assert.deepEqual(r2.recusadas.map((x) => x.motivo), [A.MOTIVO.respondida, A.MOTIVO.respondida]);
});

test('lote: permissão do link (expirado, revogado, inexistente) e pedido malformado não mudam nada', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await A.registrarVista(sql, l.token, { conteudo_id: '100' });
  await A.registrarVista(sql, l.token, { conteudo_id: '102' });
  const corpo = { nome: 'Ana', conteudo_ids: ['100', '102'] };
  await assert.rejects(A.aprovarVistas(sql, 'curto', corpo, fazer), (e) => e.status === 404);
  await assert.rejects(A.aprovarVistas(sql, 'A'.repeat(32), corpo, fazer), (e) => e.status === 404);
  await assert.rejects(A.aprovarVistas(sql, l.token, { conteudo_ids: ['100'] }, fazer), /seu nome/);
  await assert.rejects(A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: [] }, fazer), /Nenhuma peça/);
  await assert.rejects(A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: ['1; DROP'] }, fazer), /Peça inválida/);
  await assert.rejects(A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: Array.from({ length: 51 }, (_, i) => String(i + 1)) }, fazer), /até 50/);
  // Um link de outro cliente não aprova as peças deste, mesmo sabendo os números.
  const lb = await A.gerarLink(sql, { id: 24 }, { cliente_id: 11 });
  const rb = await A.aprovarVistas(sql, lb.token, corpo, fazer);
  assert.deepEqual(rb.aprovadas, []); assert.deepEqual(rb.recusadas.map((x) => [x.conteudo_id, x.motivo, x.titulo]), [['100', A.MOTIVO.fora, undefined], ['102', A.MOTIVO.fora, undefined]]);
  await sql`UPDATE vybe_aprovacao_links SET expira_em = now() - interval '1 minute' WHERE id=${l.id}`;
  await assert.rejects(A.aprovarVistas(sql, l.token, corpo, fazer), (e) => e.status === 410);
  const l2 = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await A.revogarLink(sql, { id: 3 }, { id: l2.id });
  await assert.rejects(A.aprovarVistas(sql, l2.token, corpo, fazer), (e) => e.status === 404);
  // Pela rota da página: o mesmo 410.
  const res = resposta();
  await paginaAprovarPecas({ method: 'POST', query: { t: l.token }, body: { acao: 'aprovar_vistas', ...corpo } }, res, sql, { fazer });
  assert.equal(res.codigo, 410); assert.match(res.corpo.error, /expirou/);
  assert.deepEqual(await statusDe(sql, [100, 102]), { 100: 'ag_aprovacao_cliente', 102: 'ag_aprovacao_cliente' });
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_aprovacao_respostas`)[0].n, 0);
});

test('lote é uma transação: se uma peça falha no meio, nenhuma fica aprovada', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  for (const id of ['100', '102', '104']) await A.registrarVista(sql, l.token, { conteudo_id: id });
  let vez = 0;
  const quebra = { comentar, trocarStatus: async (s, quem, a) => { if (++vez === 2) await s`SELECT 1/0`; return trocarStatus(s, quem, a); } };
  await assert.rejects(A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: ['100', '102', '104'] }, quebra),
    (e) => e.status === 500 && /Nada foi aprovado/.test(e.message));
  assert.deepEqual(await statusDe(sql, [100, 102, 104]), { 100: 'ag_aprovacao_cliente', 102: 'ag_aprovacao_cliente', 104: 'ag_aprovacao_cliente' });
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_aprovacao_respostas`)[0].n, 0);
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_eventos`)[0].n, 0);
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_updates`)[0].n, 0);
  // Comentário que não grava não desfaz a aprovação (como na peça sozinha): vira aviso.
  const semComentario = { trocarStatus, comentar: async (s) => { await s`SELECT 1/0`; } };
  const r = await A.aprovarVistas(sql, l.token, { nome: 'Ana', conteudo_ids: ['100', '102'] }, semComentario);
  assert.deepEqual(r.aprovadas.map((a) => a.conteudo_id), ['100', '102']);
  assert.match(r.aviso, /comentário não pôde ser gravado em 2 peças/);
  assert.deepEqual(await statusDe(sql, [100, 102]), { 100: 'para_agendar', 102: 'para_agendar' });
});

test('sem a migração nova nada quebra: sem vista, o lote aprova o que está aberto e tem arte', async (t) => {
  const { sql } = await banco(t, { vistas: false });
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const d = await A.pecasDoLink(sql, l.token);
  assert.equal(d.vistas, false);
  assert.ok(d.pecas.every((p) => p.vista === false));
  assert.deepEqual(await A.registrarVista(sql, l.token, { conteudo_id: '100' }), { conteudo_id: '100', vista: false });
  // A página: progresso das respondidas, como antes, e "Aprovar todas" (sem "as vistas").
  const html = paginaHtml(d, { nonce: 'n', base: '/aprovar-pecas/x' });
  assert.match(html, /<b data-feitas>0<\/b> de 5 respondidas/);
  assert.doesNotMatch(html, /data-vistas>/);
  assert.match(html, /data-lote-rot>Aprovar todas<\/span>/);
  assert.match(html, /const VISTAS=false;/);
  // Pela rota da página, como o navegador manda.
  const res = resposta();
  await paginaAprovarPecas({ method: 'POST', query: { t: l.token }, body: { acao: 'aprovar_vistas', nome: 'Ana', conteudo_ids: ['100', '101', '102', '103', '104'] } }, res, sql, { fazer });
  assert.equal(res.codigo, 200); assert.equal(res.corpo.ok, true); assert.equal(res.corpo.vistas, false);
  assert.deepEqual(res.corpo.aprovadas.map((a) => a.conteudo_id), ['100', '102', '104']);
  assert.deepEqual(res.corpo.recusadas.map((x) => [x.conteudo_id, x.motivo]), [['101', A.MOTIVO.semArte], ['103', A.MOTIVO.semArte]]);
  assert.deepEqual(await statusDe(sql, [100, 101, 102, 103, 104]), { 100: 'para_agendar', 101: 'ag_aprovacao_cliente', 102: 'para_agendar',
    103: 'ag_aprovacao_cliente', 104: 'para_agendar' });
  // A aprovação de uma peça segue igual.
  const res2 = resposta();
  await paginaAprovarPecas({ method: 'GET', query: { t: l.token } }, res2, sql, { fazer });
  assert.equal(res2.codigo, 200); assert.match(res2.corpo, /Card - Horário especial/);
});

test('a página com o registro de vista: "1 de 5 vistas", o botão no fim e a vista marcada no cartão', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  await A.registrarVista(sql, l.token, { conteudo_id: '102' });
  // O POST de vista pela rota da página.
  const rv = resposta();
  await paginaAprovarPecas({ method: 'POST', query: { t: l.token }, body: { acao: 'vista', conteudo_id: '104' } }, rv, sql, { fazer });
  assert.equal(rv.codigo, 200); assert.equal(rv.corpo.vista, true);
  const html = paginaHtml(await A.pecasDoLink(sql, l.token), { nonce: 'n', base: '/aprovar-pecas/x' });
  assert.match(html, /<b data-vistas>2<\/b> de 5 <span data-vistas-rot>vistas<\/span> · <b data-feitas>0<\/b>/);
  assert.match(html, /data-peca="102"[^>]*data-vista>/); assert.match(html, /data-peca="104"[^>]*data-vista>/);
  assert.doesNotMatch(html, /data-peca="100"[^>]*data-vista/);
  assert.match(html, /const VISTAS=true;/);
  // O botão vem depois de todas as peças, verde (estado de sim), com ícone desenhado.
  const iLote = html.indexOf('data-lote'), iUltima = html.lastIndexOf('data-peca="');
  assert.ok(iLote > iUltima);
  assert.match(html, /class="btn sim largo" data-acao="lote-abrir"><svg[^>]*aria-hidden="true">[\s\S]*?Aprovar todas as vistas/);
  // O script da página é JavaScript válido.
  const js = html.split('<script nonce="n">')[1].split('</script>')[0];
  assert.doesNotThrow(() => new Function(js));
});

test('vídeo por partes (Range): o player do Safari pede pedaços e recebe 206', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const [arq] = await sql`SELECT id FROM vybe_conteudo_arquivos WHERE conteudo_id=100`;
  const bytes = Buffer.from('0123456789');
  const baixarDoDrive = async () => new Response(bytes, { headers: { 'content-type': 'video/mp4' } });
  const pedir = async (range) => {
    const res = resposta();
    await paginaAprovarPecas({ method: 'GET', headers: range ? { range } : {}, query: { t: l.token, arquivo: String(arq.id) } }, res, sql, { fazer, baixarDoDrive });
    return res;
  };
  let r = await pedir();
  assert.equal(r.codigo, 200); assert.equal(r.cab['accept-ranges'], 'bytes'); assert.equal(String(r.corpo), '0123456789');
  r = await pedir('bytes=0-1');
  assert.equal(r.codigo, 206); assert.equal(r.cab['content-range'], 'bytes 0-1/10'); assert.equal(r.cab['content-length'], '2'); assert.equal(String(r.corpo), '01');
  r = await pedir('bytes=7-');
  assert.equal(r.codigo, 206); assert.equal(String(r.corpo), '789');
  r = await pedir('bytes=-3');
  assert.equal(r.codigo, 206); assert.equal(r.cab['content-range'], 'bytes 7-9/10');
  r = await pedir('bytes=20-30');
  assert.equal(r.codigo, 416); assert.equal(r.cab['content-range'], 'bytes */10');
  assert.equal((await pedir('lixo')).codigo, 200, 'cabeçalho estranho: arquivo inteiro');
});
