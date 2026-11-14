// Confere do back (14/11/2026): M1 (prévia por proxy autenticado, sem deixar o arquivo público), M2 (Range baixa só o
// trecho), M3 (logo público fechado), M5 (ids como bigint e histórico com período), B1 (mensagem genérica), B3 (onboarding
// com limite por IP e sem vazar erro) e B6 (resposta do cliente com a peça travada). SAFE: PGlite em memória e Drive de
// mentira; nada vai ao Neon nem ao Google.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import * as A from '../server/conteudo-aprovacao.js';
import { paginaAprovarPecas } from '../server/conteudo-aprovacao-pagina.js';
import { logoDoCliente } from '../server/planejamentos-api.js';
import { paginaDoOnboarding, ONBOARDING_POR_IP } from '../server/reunioes.js';
import { trocarStatus, comentar } from '../api/conteudo.js';
import handler, { usarBancoDoPainel, usarDriveDeTeste, areaBaixar, areaMiniatura, falhaInterna, HISTORICO_DIAS_PADRAO } from '../api/painel.js';

const fazer = { trocarStatus, comentar };
const salvo = process.env.MIRROR_ADMIN_KEY;
before(() => { process.env.MIRROR_ADMIN_KEY = 'chave-ficticia-arquivos'; });
after(() => { if (salvo === undefined) delete process.env.MIRROR_ADMIN_KEY; else process.env.MIRROR_ADMIN_KEY = salvo; usarBancoDoPainel(null); });

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,ativo boolean DEFAULT true);
  INSERT INTO vybe_pessoas VALUES(3,'Vinícius','vini@vybe.invalid',true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true, identidade jsonb); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
  INSERT INTO vybe_clientes(id,nome) VALUES(10,'Alfa Café'),(11,'Beta Moda');
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(10,3,0);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,board_id bigint,titulo text,formato text,status_chave text,status_em timestamptz,
    veiculacao date,atualizado_em timestamptz,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,veiculacao) VALUES
    (100,1,'Reels - Bastidores','Reels','ag_aprovacao_cliente','2026-11-14'),(104,1,'Card - Promoção','Card','ag_aprovacao_cliente','2026-11-18');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(100,10),(104,10);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,PRIMARY KEY(board_id,chave));
  INSERT INTO vybe_status VALUES(1,'ag_aprovacao_cliente','Ag. Aprovação Cliente',NULL),(1,'para_agendar','Para agendar',NULL),(1,'alteracao','Alteração',NULL);
  CREATE TABLE vybe_conteudo_eventos(id serial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text,em timestamptz DEFAULT now());
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,autor text,criado_em timestamptz);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,nome text,extensao text,drive_file_id text,tamanho_bytes bigint,
    url_publica text, url_monday text, monday_asset_id text, criado_em timestamptz DEFAULT now() - interval '1 hour',ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id,tamanho_bytes) VALUES
    (100,'bastidores.mp4','.mp4','d-video-0000001',10000000),(104,'promo.png','.png','d-promo-000001',2000);`);
  await db.exec(readFileSync('migrations/2026-11-07-conteudo-objetivo-aprovacao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-11-aprovacao-vistas.sql', 'utf8'));
  return { db, sql };
}
const resposta = () => {
  const r = { codigo: 0, cab: {}, corpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.setHeader = (k, v) => { r.cab[k.toLowerCase()] = v; };
  r.send = (b) => { r.corpo = b; return r; }; r.json = (b) => { r.corpo = b; return r; }; r.end = (b) => { r.corpo = b; return r; };
  return r;
};
const servico = { authorization: 'Bearer chave-ficticia-arquivos' };

test('M2: página de aprovação — vídeo com Range baixa só o trecho pedido (não o arquivo inteiro)', async (t) => {
  const { sql } = await banco(t);
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const [arq] = await sql`SELECT id FROM vybe_conteudo_arquivos WHERE conteudo_id=100`;
  let inteiros = 0; const trechos = [];
  const baixarDoDrive = async () => { inteiros++; return new Response(Buffer.alloc(10), { headers: { 'content-type': 'video/mp4' } }); };
  const baixarTrechoDoDrive = async (id, ini, fim) => { trechos.push([id, ini, fim]); return Buffer.alloc(fim - ini + 1, 7); };
  const res = resposta();
  await paginaAprovarPecas({ method: 'GET', headers: { range: 'bytes=1000-1999' }, query: { t: l.token, arquivo: String(arq.id) } }, res, sql, { fazer, baixarDoDrive, baixarTrechoDoDrive });
  assert.equal(res.codigo, 206);
  assert.equal(res.cab['content-range'], 'bytes 1000-1999/10000000');
  assert.equal(res.cab['content-type'], 'video/mp4');
  assert.equal(inteiros, 0, 'antes: o arquivo inteiro a cada Range');
  assert.deepEqual(trechos, [['d-video-0000001', 1000, 1999]]);
  // Pedido aberto (bytes=0-): um pedaço de no máximo 4 MB.
  const r2 = resposta();
  await paginaAprovarPecas({ method: 'GET', headers: { range: 'bytes=0-' }, query: { t: l.token, arquivo: String(arq.id) } }, r2, sql, { fazer, baixarDoDrive, baixarTrechoDoDrive });
  assert.equal(r2.cab['content-range'], `bytes 0-${4 * 1024 * 1024 - 1}/10000000`);
});

test('M2: area=baixar com Range responde 206 só com o trecho', async (t) => {
  const { sql } = await banco(t);
  usarBancoDoPainel(() => sql);
  let inteiros = 0;
  usarDriveDeTeste({ inteiro: async () => { inteiros++; throw new Error('não devia baixar inteiro'); }, trecho: async (id, ini, fim) => Buffer.alloc(fim - ini + 1, 1) });
  const [arq] = await sql`SELECT id FROM vybe_conteudo_arquivos WHERE conteudo_id=100`;
  const res = resposta();
  await areaBaixar({ method: 'GET', headers: { range: 'bytes=500-999' }, query: { arquivo: String(arq.id) } }, res);
  assert.equal(res.codigo, 206); assert.equal(res.cab['content-range'], 'bytes 500-999/10000000'); assert.equal(res.corpo.length, 500);
  assert.equal(inteiros, 0);
});

test('M1: a prévia sai pelo proxy com sessão (só arquivo de peça), com cache curto; a gaveta não torna público', async (t) => {
  const { sql } = await banco(t);
  usarBancoDoPainel(() => sql);
  const pedidos = [];
  usarDriveDeTeste({ miniatura: async (id, sz) => { pedidos.push([id, sz]); return { bytes: Buffer.from('JPEG'), tipo: 'image/jpeg' }; } });
  let r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'd-promo-000001', sz: '400' } }, r);
  assert.equal(r.codigo, 200); assert.equal(r.cab['content-type'], 'image/jpeg'); assert.equal(r.cab['cache-control'], 'private, max-age=300');
  assert.deepEqual(pedidos, [['d-promo-000001', 400]]);
  r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'arquivo-de-fora-123' } }, r);
  assert.equal(r.codigo, 404, 'arquivo que não é de peça não passa pelo proxy');
  r = resposta(); await areaMiniatura({ method: 'GET', query: { id: '../x' } }, r);
  assert.equal(r.codigo, 400);
  // Pelo roteador: sem sessão, 401.
  r = resposta(); await handler({ method: 'GET', headers: {}, query: { area: 'miniatura', id: 'd-promo-000001' } }, r);
  assert.equal(r.codigo, 401);
  // A abertura da peça não chama mais tornarPublico (só o upload e a foto de perfil, que ficam para depois).
  const fonte = readFileSync('api/painel.js', 'utf8');
  const leitura = fonte.slice(fonte.indexOf('async function areaPeca('), fonte.indexOf('const assets = arquivos.map'));
  assert.ok(leitura.length > 100);
  assert.doesNotMatch(leitura, /tornarPublico/);
});

test('M3: logo público com CSP fechada; sem sessão não procura no Drive nem grava; SVG vai como anexo', async (t) => {
  const { sql } = await banco(t);
  let procurou = 0;
  const procurar = async () => { procurou++; return [{ id: 'logo-achado', nota: 5 }]; };
  const baixar = async () => new Response('<svg onload="alert(1)"/>', { headers: { 'content-type': 'image/svg+xml' } });
  let r = resposta(); await logoDoCliente({ query: { c: '10' } }, r, sql, { procurar, baixar });
  assert.equal(r.codigo, 404); assert.equal(procurou, 0, 'antes: a página pública buscava no Drive e gravava');
  assert.equal(r.cab['content-security-policy'], "default-src 'none'; sandbox");
  assert.equal((await sql`SELECT identidade FROM vybe_clientes WHERE id=10`)[0].identidade, null);
  r = resposta(); await logoDoCliente({ query: { c: '10' } }, r, sql, { comSessao: true, procurar, baixar });
  assert.equal(procurou, 1); assert.equal(r.codigo, 200);
  assert.match(r.cab['content-disposition'], /^attachment/);
  // Já salvo: sem sessão, serve o que está salvo.
  r = resposta(); await logoDoCliente({ query: { c: '10' } }, r, sql, { procurar, baixar: async () => new Response('PNG', { headers: { 'content-type': 'image/png' } }) });
  assert.equal(r.codigo, 200); assert.equal(procurou, 1); assert.equal(r.cab['content-disposition'], undefined);
});

test('M5: aprovação com ids bigint segue funcionando; B6: duas respostas ao mesmo tempo registram uma só', async (t) => {
  const { sql } = await banco(t);
  const painel = await A.painelDeAprovacao(sql, { id: 3, admin: false });
  assert.ok(JSON.stringify(painel).includes('Alfa Café'));
  const l = await A.gerarLink(sql, { id: 3 }, { cliente_id: 10 });
  const pecas = await A.pecasDoLink(sql, l.token);
  assert.deepEqual(pecas.pecas.map((p) => p.id).sort(), ['100', '104']);
  const corpo = { conteudo_id: '104', acao: 'aprovar', nome: 'Cliente Alfa' };
  const r = await Promise.allSettled([A.responderPeca(sql, l.token, corpo, fazer), A.responderPeca(sql, l.token, corpo, fazer)]);
  assert.deepEqual(r.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(r.find((x) => x.status === 'rejected').reason.status, 409);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM vybe_aprovacao_respostas WHERE conteudo_id=104`;
  assert.equal(n, 1, 'antes: as duas passavam pela conferência e as duas gravavam');
});

test('M5: area=historico devolve os últimos 30 dias por padrão; ?dias= pede mais (até 365)', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(`INSERT INTO vybe_conteudo_eventos (conteudo_id,tipo,de,para,em) VALUES (100,'status','A','B',now() - interval '10 days'),
    (100,'status','B','C',now() - interval '60 days'),(100,'status','C','D',now() - interval '400 days');
    ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS etapa text; ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS grupo_id text;`);
  usarBancoDoPainel(() => sql);
  const ler = async (query) => { const r = resposta(); await handler({ method: 'GET', headers: servico, query: { area: 'historico', ...query } }, r); return r; };
  assert.equal(HISTORICO_DIAS_PADRAO, 30);
  let r = await ler({});
  assert.equal(r.codigo, 200, JSON.stringify(r.corpo));
  assert.equal(r.corpo.logs.statusEvents['vybe:100'].length, 1);
  r = await ler({ dias: '90' });
  assert.equal(r.corpo.logs.statusEvents['vybe:100'].length, 2);
  r = await ler({ dias: '9999' });
  assert.equal(r.corpo.logs.statusEvents['vybe:100'].length, 2, 'no máximo 365 dias');
});

test('B1: erro não tratado sai genérico (a mensagem do banco fica no log); erro de regra 4xx mantém a mensagem', async (t) => {
  usarBancoDoPainel(() => { const s = () => Promise.reject(Object.assign(new Error('relation "vybe_conteudo_eventos" does not exist'), { code: '42P01' })); s.query = s; return s; });
  t.after(() => usarBancoDoPainel(null));
  const r = resposta();
  await handler({ method: 'GET', headers: servico, query: { area: 'historico' } }, r);
  assert.equal(r.codigo, 500);
  assert.doesNotMatch(r.corpo.error, /relation|vybe_/);
  const x = resposta(); falhaInterna(x, 'teste', Object.assign(new Error('Informe o cliente.'), { status: 400 }));
  assert.deepEqual([x.codigo, x.corpo.error], [400, 'Informe o cliente.']);
});

test('B3: onboarding público com limite por IP (429) e erro inesperado sem a mensagem do banco', async () => {
  const quebrado = () => { const s = () => Promise.reject(new Error('password authentication failed for user neondb')); s.query = s; return s; };
  const r = resposta();
  await paginaDoOnboarding({ method: 'GET', query: { t: 'x'.repeat(40) }, headers: { 'x-real-ip': '192.0.2.50' } }, r, quebrado());
  assert.equal(r.codigo, 500); assert.doesNotMatch(String(r.corpo), /password|neondb/);
  const p = resposta();
  await paginaDoOnboarding({ method: 'POST', query: { t: 'x'.repeat(40) }, body: {}, headers: { 'x-real-ip': '192.0.2.50' } }, p, quebrado());
  assert.equal(p.codigo, 500); assert.doesNotMatch(JSON.stringify(p.corpo), /password|neondb/);
  let ultimo;
  for (let i = 0; i <= ONBOARDING_POR_IP.POST.max; i++) {
    ultimo = resposta();
    await paginaDoOnboarding({ method: 'POST', query: { t: 'y'.repeat(40) }, body: {}, headers: { 'x-real-ip': '192.0.2.51' } }, ultimo, quebrado());
  }
  assert.equal(ultimo.codigo, 429);
});
