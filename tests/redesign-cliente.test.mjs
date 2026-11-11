// Redesign das telas do cliente (moodboard, quadros 24 e 26, 10/11/2026):
// a página do link de aprovação de peças (server/conteudo-aprovacao-pagina.js) e a
// coluna "Pedidos do cliente" do documento do planejamento (server/planejamento-documento.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import * as A from '../server/conteudo-aprovacao.js';
import { paginaHtml, TEXTO_SEM_ARTE, paginaAprovarPecas } from '../server/conteudo-aprovacao-pagina.js';
import { documentoHtml, assinaturaDaPeca } from '../server/planejamento-documento.js';
import { trocarStatus, comentar } from '../api/conteudo.js';

const fazer = { trocarStatus, comentar };
const MIGRACAO = readFileSync('migrations/2026-11-07-conteudo-objetivo-aprovacao.sql', 'utf8');
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean DEFAULT true);
  INSERT INTO vybe_pessoas VALUES(3,'Vinícius','vini@vybe.invalid',true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
  INSERT INTO vybe_clientes VALUES(10,'Alfa Café',true);
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(10,3,0);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,board_id bigint,titulo text,formato text,status_chave text,status_em timestamptz,
    veiculacao date,atualizado_em timestamptz,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,veiculacao) VALUES
    (100,1,'Reels - Bastidores','Reels','ag_aprovacao_cliente','2026-11-14'),
    (101,1,'Card - Horário especial','Card','ag_aprovacao_cliente','2026-11-15'),
    (102,1,'Carrossel - Três dúvidas','Carrossel','ag_aprovacao_cliente','2026-11-16'),
    (103,1,'Card - Arte que saiu do Drive','Card','ag_aprovacao_cliente','2026-11-17');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(100,10),(101,10),(102,10),(103,10);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,PRIMARY KEY(board_id,chave));
  INSERT INTO vybe_status VALUES(1,'ag_aprovacao_cliente','Ag. Aprovação Cliente',NULL),(1,'para_agendar','Para agendar',NULL),(1,'alteracao','Alteração',NULL);
  CREATE TABLE vybe_conteudo_eventos(id serial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT now());
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,autor text,criado_em timestamptz);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,nome text,extensao text,drive_file_id text,tamanho_bytes bigint,criado_em timestamptz DEFAULT now(),ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id,ausente_em) VALUES
    (100,'bastidores.mp4','.mp4','d-video',NULL),
    (102,'tela-1.png','.png','d-1',NULL),(102,'tela-2.png','.png','d-2',NULL),(102,'tela-3.png','.png','d-3',NULL),
    (103,'antiga.png','.png','d-x',now());`);
  await db.exec(MIGRACAO);
  return { sql };
}

test('sem arte, sem aprovar: o servidor recusa aprovar peça sem arquivo, mesmo sem passar pela página', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  for (const id of [101, 103]) { // sem arquivo nenhum; arquivo marcado como ausente do Drive
    await assert.rejects(A.responderPeca(sql, l.token, { conteudo_id: id, acao: 'aprovar', nome: 'Ana' }, fazer),
      (e) => e.status === 409 && /não dá para aprovar sem ver/.test(e.message));
  }
  // Pela rota da página (o POST que o navegador manda).
  const res = { codigo: 0, cab: {}, corpo: null, status(c) { this.codigo = c; return this; }, setHeader(k, v) { this.cab[k] = v; }, json(b) { this.corpo = b; return this; } };
  await paginaAprovarPecas({ method: 'POST', query: { t: l.token }, body: { conteudo_id: '101', acao: 'aprovar', nome: 'Ana' } }, res, sql, { fazer });
  assert.equal(res.codigo, 409); assert.match(res.corpo.error, /arte desta peça ainda não está aqui/);
  const st = await sql`SELECT id::int, status_chave FROM vybe_conteudos WHERE id IN (101,103) ORDER BY id`;
  assert.deepEqual(st.map((x) => x.status_chave), ['ag_aprovacao_cliente', 'ag_aprovacao_cliente'], 'nada mudou');
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_aprovacao_respostas`)[0].n, 0);
  // Com arte, aprova como antes.
  assert.equal((await A.responderPeca(sql, l.token, { conteudo_id: 100, acao: 'aprovar', nome: 'Ana' }, fazer)).status, 'Para agendar');
});

test('a página mostra o vídeo num player, o carrossel como galeria e a peça sem arte sem os botões', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const dados = await A.pecasDoLink(sql, l.token);
  assert.deepEqual(dados.pecas.map((p) => [p.id, p.arquivos.length]), [['100', 1], ['101', 0], ['102', 3], ['103', 0]]);
  assert.equal(dados.pecas[0].arquivos[0].video, true);
  const html = paginaHtml(dados, { nonce: 'n', base: '/aprovar-pecas/x' });
  const cartao = (id) => html.split(`data-peca="${id}"`)[1].split('</article>')[0];
  // Vídeo na própria página, pela mesma rota de arquivo.
  assert.match(cartao(100), /<video controls preload="metadata" playsinline src="\/aprovar-pecas\/x\/arquivo\/\d+"/);
  assert.doesNotMatch(cartao(100), /Abrir bastidores\.mp4<\/a><\/div>/);
  // Carrossel: galeria de deslizar com "1 de 3", não links soltos.
  assert.match(cartao(102), /class="galeria"[^>]*aria-label="Carrossel com 3 imagens/);
  assert.match(cartao(102), /data-pos aria-live="polite">1 de 3</);
  assert.equal((cartao(102).match(/<img /g) || []).length, 3);
  // Sem arte: o aviso no lugar dos botões.
  for (const id of [101, 103]) {
    assert.ok(cartao(id).includes(TEXTO_SEM_ARTE));
    assert.doesNotMatch(cartao(id), /data-acao="aprovar"|data-acao="abrir-ajuste"/);
  }
  // Ações lado a lado, Aprovar em verde (estado de sim), só onde há arte.
  assert.match(cartao(100), /data-acao="abrir-ajuste"[^>]*>Pedir ajuste<\/button><button type="button" class="btn sim" data-acao="aprovar">Aprovar/);
  assert.equal((html.match(/data-acao="aprovar"/g) || []).length, 2);
  // Sem o registro de vista (migração de 11/11 não aplicada): progresso das respondidas e o logo de verdade.
  assert.match(html, /<b data-feitas>0<\/b> de 4 respondidas/);
  assert.match(html, /<div class="marca"><img src="data:image\/png;base64,/);
  // "Aprovar todas" no fim (rota em lote: tests/aprovacao-lote.test.mjs); sem vista, sem "as vistas".
  assert.match(html, /data-lote-rot>Aprovar todas<\/span>/);
  // O logo embutido precisa do data: na política da página.
  const res = { cab: {}, status() { return this; }, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, send(b) { this.corpo = b; return this; } };
  await paginaAprovarPecas({ method: 'GET', query: { t: l.token } }, res, sql, { fazer });
  assert.match(res.cab['content-security-policy'], /img-src 'self' data:;/);
  assert.match(res.cab['content-security-policy'], /media-src 'self'/);
  // Fotos do redesign: VYBE_SALVAR_APROVACAO=<pasta> grava a página com os arquivos da pasta.
  const pasta = process.env.VYBE_SALVAR_APROVACAO;
  if (pasta) {
    const ids = dados.pecas.flatMap((p) => p.arquivos.map((a) => a.id));
    const base = 'file:///' + pasta.split('\\').join('/');
    writeFileSync(`${pasta}/aprovacao.html`, paginaHtml(dados, { nonce: 'n', base }).replace(/ nonce="n"/g, ''));
    writeFileSync(`${pasta}/ids.json`, JSON.stringify(ids));
  }
});

test('documento do planejamento: pedidos do cliente numa coluna e marcados na peça, sem o aviso repetido', () => {
  const pecas = [
    { data: '2026-12-05', formato: 'Card', tema: 'Apresentação da equipe', legenda: 'Legenda.' },
    { data: '2026-12-12', formato: 'Carrossel', tema: 'Três dúvidas comuns', legenda: 'Legenda.' },
    { data: '2026-12-19', formato: 'Reels', tema: 'Bastidores', legenda: 'Roteiro.', ajuste_cliente: 'Mais curto.' },
  ];
  const revisoes = { [assinaturaDaPeca(pecas[1])]: { cliente: { estado: 'ajuste', nota: 'Trocar por um Reels.', nome: 'Ana' } } };
  const p = { id: '1', cliente: 'Cliente demonstração', mes: '2026-12', versao: 2, estado: 'ajustes', resposta_nome: 'Ana',
    resposta_texto: 'Podemos trocar o tema do dia 12 por um Reels?', conteudo: { pecas, revisoes } };
  const head = documentoHtml(p, { revisor: 'head' });
  assert.match(head, /<body class="no-painel com-pedidos">/);
  const aside = head.split('<aside class="pedidos-cliente"')[1].split('</aside>')[0];
  assert.match(aside, /Pedidos do cliente/); assert.match(aside, /2 peças com ajuste pedido/);
  assert.match(aside, /Ana pediu ajustes/); assert.match(aside, /trocar o tema do dia 12/);
  assert.match(aside, /href="#peca-2"[\s\S]*Trocar por um Reels\.[\s\S]*href="#peca-3"[\s\S]*Mais curto\./);
  // No celular a coluna vira um bloco acima das peças: vem antes da seção no documento.
  assert.ok(head.indexOf('class="pedidos-cliente"') < head.indexOf('id="area-pecas"'));
  // Marcado na própria peça; a peça sem pedido fica sem marca.
  assert.match(head, /<article class="peca com-pedido" id="peca-2"/);
  assert.match(head, /<article class="peca" id="peca-1"/);
  assert.doesNotMatch(head, /Ajustes recebidos/, 'o pedido geral já está na coluna');
  // O cliente e o documento do Drive não levam a coluna interna.
  for (const html of [documentoHtml(p), documentoHtml({ ...p, estado: 'enviado' }, { paraCliente: true, token: 't' })]) {
    assert.doesNotMatch(html, /<aside class="pedidos-cliente"|class="peca com-pedido"|marca-pedido"/);
  }
  assert.match(documentoHtml(p), /Ajustes recebidos/);
});

test('painel: o pedido saiu do balão por cima do documento e a moldura abre com esqueleto', () => {
  const js = readFileSync('vybe-planejamentos.js', 'utf8');
  assert.doesNotMatch(js, /plj-flut-aviso/);
  assert.match(js, /const PLJ_ESQUELETO = /);
  assert.match(js, /prefers-reduced-motion:reduce/);
  assert.equal((js.match(/pljMolduraHtml\(\)/g) || []).length >= 2, true);
});
