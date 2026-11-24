// Prévia pelo link de entrega (Paulo, 24/11/2026: "ao inves da previa preta, se o video nao tiver capa não deveria
// aparecer uma tumb do primeiro frame?"). SAFE: PGlite em memória e Drive de mentira; nada vai ao Neon nem ao Google.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { areaPreviaEntrega, previaDaEntrega, escolherDaPasta, linkDeEntrega, miniaturaAssinada, assinarMiniatura, esquecerPreviasDaEntrega } from '../server/previa-entrega.js';
import { usarBancoDoPainel, usarDriveDeTeste, areaMiniatura } from '../api/painel.js';

const salvo = process.env.SESSAO_SECRET;
before(() => { process.env.SESSAO_SECRET = 'segredo-ficticio-da-previa-de-entrega'; });
after(() => { if (salvo === undefined) delete process.env.SESSAO_SECRET; else process.env.SESSAO_SECRET = salvo; usarBancoDoPainel(null); });

const PASTA = 'application/vnd.google-apps.folder';
const DRIVE = {
  PastaDoDia24xx: [{ id: 'sub-hebravet-01', name: 'HEBRAVET', mimeType: PASTA }, { id: 'sub-voa-0000001', name: 'VOA', mimeType: PASTA }, { id: 'img-solta-00001', name: 'logo.png', mimeType: 'image/png', hasThumbnail: true }],
  'sub-hebravet-01': [{ id: 'vid-campo-exp-2x', name: 'campo experimental 2 final.mp4', mimeType: 'video/mp4', hasThumbnail: true }, { id: 'img-capa-camp01', name: 'capa.png', mimeType: 'image/png', hasThumbnail: true }],
  'sub-voa-0000001': [{ id: 'vid-voa-outro-01', name: 'voa bastidores.mp4', mimeType: 'video/mp4', hasThumbnail: true }],
  PastaCarrossel1: [3, 1, 2].map((n) => ({ id: `img-dicas-00000${n}`, name: `dicas-${n}.png`, mimeType: 'image/png', hasThumbnail: true })),
  PastaSemThumb01: [{ id: 'vid-sem-thumb-01', name: 'entrevista.mp4', mimeType: 'video/mp4', hasThumbnail: false }],
};
const listar = async (id) => DRIVE[id] || [];
const nota = (url) => ({ corpo: `<p>[Vybe OS · Link de entrega] ${url}</p>` });

test('linkDeEntrega: a nota de entrega mais nova; material bruto não entra', () => {
  assert.equal(linkDeEntrega([{ corpo: '<p>Material bruto: https://drive.google.com/drive/folders/BrutoBruto01</p>' }, nota('https://drive.google.com/drive/folders/PastaDoDia24xx'), nota('https://x.test/antigo')]),
    'https://drive.google.com/drive/folders/PastaDoDia24xx');
  assert.equal(linkDeEntrega([{ corpo: 'Material bruto: https://drive.google.com/drive/folders/BrutoBruto01' }]), '');
  assert.equal(linkDeEntrega([{ corpo: 'Link final: https://drive.google.com/file/d/ArquivoFinal01/view?usp=sharing.' }]), 'https://drive.google.com/file/d/ArquivoFinal01/view?usp=sharing');
});

test('pasta do dia: escolhe o vídeo da subpasta que combina com a peça, com a miniatura assinada do Drive', async () => {
  const p = await previaDaEntrega('https://drive.google.com/drive/folders/PastaDoDia24xx', { cliente: 'Hebravet', nome: 'Reels - Campo experimental 2', formato: 'Reels' }, { listar });
  assert.equal(p.tipo, 'video');
  assert.equal(p.nome, 'campo experimental 2 final.mp4');
  assert.equal(p.fonte, 'entrega');
  assert.equal(p.n, 0, 'uma imagem só (a capa) não vira carrossel: vale o vídeo');
  assert.equal(p.abrir, 'https://drive.google.com/file/d/vid-campo-exp-2x/view');
  const e = new URL(p.thumb, 'http://x').searchParams;
  assert.equal(e.get('area'), 'miniatura'); assert.equal(e.get('id'), 'vid-campo-exp-2x');
  assert.ok(miniaturaAssinada('vid-campo-exp-2x', e.get('e')));
  assert.ok(!miniaturaAssinada('vid-voa-outro-01', e.get('e')), 'a assinatura vale só para o arquivo dela');
});

test('pasta com 2+ imagens vira carrossel 1/N pela ordem do nome; vídeo sem miniatura vem sem thumb', async () => {
  const c = await previaDaEntrega('https://drive.google.com/drive/u/0/folders/PastaCarrossel1', { formato: 'Carrossel' }, { listar });
  assert.deepEqual([c.tipo, c.nome, c.n], ['imagem', 'dicas-1.png', 3]);
  const v = await previaDaEntrega('https://drive.google.com/drive/folders/PastaSemThumb01', { formato: 'Reels' }, { listar });
  assert.deepEqual([v.tipo, v.thumb, v.nome], ['video', null, 'entrevista.mp4']);
  assert.equal(escolherDaPasta([], {}), null);
});

test('link de arquivo do Drive: o próprio arquivo; sem acesso, ainda diz que há link (vídeo pelo formato)', async () => {
  const f = await previaDaEntrega('https://drive.google.com/file/d/ArquivoFinal01/view', { formato: 'Post' },
    { arquivo: async (id) => ({ id, name: 'final.mov', mimeType: 'video/quicktime', hasThumbnail: true }) });
  assert.deepEqual([f.tipo, f.nome, f.fonte], ['video', 'final.mov', 'entrega']);
  assert.match(f.thumb, /area=miniatura&id=ArquivoFinal01&sz=480&e=/);
  const s = await previaDaEntrega('https://drive.google.com/file/d/ArquivoFinal01/view', { formato: 'Reels' }, { arquivo: async () => { throw new Error('Drive 404'); } });
  assert.deepEqual([s.tipo, s.thumb, s.fonte], ['video', null, 'entrega']);
  // Fora do Drive: .mp4 direto vai para o <video> do primeiro quadro; link qualquer é só o link.
  const d = await previaDaEntrega('https://cdn.exemplo.test/final.mp4?x=1', { formato: 'Reels' }, {});
  assert.deepEqual([d.tipo, d.video, d.thumb], ['video', 'https://cdn.exemplo.test/final.mp4?x=1', null]);
  const l = await previaDaEntrega('https://www.dropbox.com/scl/fo/abc/pasta', { formato: 'Card' }, {});
  assert.deepEqual([l.tipo, l.fonte], ['link', 'entrega']);
  assert.equal(await previaDaEntrega('', {}, {}), null);
});

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
  INSERT INTO vybe_clientes VALUES(10,'Hebravet');
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,titulo text,formato text,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,monday_item_id,titulo,formato) VALUES(11650,NULL,'Reels - Campo experimental 2','Reels'),(11651,'9900','Card - Com arquivo','Card'),(11652,NULL,'Reels - Nada','Reels');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  INSERT INTO vybe_conteudo_clientes VALUES(11650,10);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,drive_file_id text,ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,drive_file_id) VALUES(11651,'d-anexo-000001');
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,criado_em timestamptz);
  INSERT INTO vybe_conteudo_updates(conteudo_id,corpo,criado_em) VALUES
    (11650,'<p>Material bruto: https://drive.google.com/drive/folders/BrutoBruto01</p>','2026-11-20'),
    (11650,'<p>[Vybe OS · Link de entrega] https://drive.google.com/drive/folders/PastaDoDia24xx</p>','2026-11-23'),
    (11651,'<p>[Vybe OS · Link de entrega] https://drive.google.com/drive/folders/PastaDoDia24xx</p>','2026-11-23'),
    (11652,'<p>Material bruto: https://drive.google.com/drive/folders/BrutoBruto01</p>','2026-11-20');`);
  return sql;
}
const resposta = () => { const r = { codigo: 0, cab: {}, corpo: null }; r.status = (c) => { r.codigo = c; return r; }; r.setHeader = (k, v) => { r.cab[k.toLowerCase()] = v; }; r.json = (c) => { r.corpo = c; return r; }; r.end = (b) => { r.corpo = b; return r; }; return r; };

test('area=previa_entrega: sessão, só peça sem arquivo, guarda a leitura do Drive; sem link é null ("sem arquivo")', async (t) => {
  const db = await banco(t); esquecerPreviasDaEntrega();
  let leituras = 0; const contar = async (id) => { leituras++; return listar(id); };
  const pedir = async (item, quem = { tipo: 'sessao', pessoa: { id: 3 } }) => { const r = resposta(); await areaPreviaEntrega({ method: 'GET', query: { item } }, r, quem, { db, listar: contar, arquivo: async () => { throw new Error('não'); } }); return r; };
  assert.equal((await pedir('vybe:11650', null)).codigo, 401, 'sem sessão não abre, como area=peca');
  let r = await pedir('vybe:11650');
  assert.equal(r.codigo, 200); assert.equal(r.corpo.previa.nome, 'campo experimental 2 final.mp4'); assert.equal(r.corpo.previa.fonte, 'entrega');
  assert.equal(r.cab['cache-control'], 'private, max-age=300');
  const antes = leituras; r = await pedir('vybe:11650'); assert.equal(leituras, antes, 'a segunda passada não volta ao Drive');
  r = await pedir('9900'); assert.deepEqual([r.corpo.previa, r.corpo.motivo], [null, 'tem_arquivo']);
  r = await pedir('vybe:11652'); assert.deepEqual([r.corpo.previa, r.corpo.motivo], [null, 'sem_link'], 'material bruto não é prévia');
  assert.equal((await pedir('vybe:99999')).codigo, 404);
});

test('area=miniatura: arquivo do link de entrega passa só com a assinatura do servidor', async (t) => {
  const db = await banco(t); usarBancoDoPainel(() => db);
  const pedidos = []; usarDriveDeTeste({ miniatura: async (id, sz) => { pedidos.push([id, sz]); return { bytes: Buffer.from('JPEG'), tipo: 'image/jpeg' }; } });
  let r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'vid-campo-exp-2x', sz: '480', e: assinarMiniatura('vid-campo-exp-2x') } }, r);
  assert.equal(r.codigo, 200); assert.deepEqual(pedidos, [['vid-campo-exp-2x', 480]]);
  r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'vid-campo-exp-2x', e: assinarMiniatura('outro-arquivo-01') } }, r);
  assert.equal(r.codigo, 404, 'assinatura de outro arquivo não vale');
  r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'vid-campo-exp-2x', e: 'x' } }, r);
  assert.equal(r.codigo, 404);
  r = resposta(); await areaMiniatura({ method: 'GET', query: { id: 'd-anexo-000001' } }, r);
  assert.equal(r.codigo, 200, 'o anexo da peça continua sem assinatura');
});

// O front: a prévia do detalhe sem arquivo procura o link de entrega, e o rótulo diz de onde veio.
const fonte = readFileSync('vybe-mundo-conteudo.js', 'utf8'), mundo = readFileSync('vybe-mundo.js', 'utf8');
const trecho = (texto, de, ate) => texto.slice(texto.indexOf(de), texto.indexOf(ate, texto.indexOf(de)));
function frente(respostas) {
  const pedidos = [];
  const c = vm.createContext({ esc: (x) => String(x ?? '').replace(/[&<>"]/g, (m) => `&#${m.charCodeAt(0)};`), pedidos,
    lerJson: async (url) => { pedidos.push(url); const r = respostas(url); if (r instanceof Error) throw r; return r; } });
  vm.runInContext(trecho(fonte, 'const EXT_VIDEO', 'const previas = st.thumbs') + trecho(fonte, '  async function lerDetalhe', '  function avisarPrevia')
    + trecho(fonte, '  function arteHtml', '  // A miniatura não abriu'), c);
  vm.runInContext(trecho(mundo, '  const origemDaPrevia', '  function arteDecidir') + trecho(mundo, '  function arteDecidir', '  const posDecidir')
    .replace('VC()?.arteHtml ? VC().arteHtml', 'arteHtml ? arteHtml'), c);
  return c;
}
const detalhe = (link, extra = {}) => ({ ok: true, name: 'Reels - Campo', ficha: { formato: 'Reels' }, assets: [], ...extra,
  updates: [{ body: '<p>Material bruto: https://drive.google.com/drive/folders/BrutoBruto01</p>' }, ...(link ? [{ body: `<p>[Vybe OS · Link de entrega] ${link}</p>` }] : [])] });

test('front: sem arquivo e com link de entrega, a prévia vem do servidor e o rótulo diz "link de entrega"', async () => {
  const previa = { tipo: 'video', thumb: '/api/painel?area=miniatura&id=vid1234567&sz=480&e=abc', abrir: 'x', nome: 'campo.mp4', n: 0, fonte: 'entrega' };
  const c = frente((url) => (url.includes('area=peca') ? detalhe('https://drive.google.com/drive/folders/PastaDoDia24xx') : { ok: true, previa }));
  const p = await c.lerDetalhe('vybe:11650');
  assert.equal(p.fonte, 'entrega'); assert.ok(c.pedidos.some((u) => u.includes('area=previa_entrega&item=vybe%3A11650')));
  const i = { ref: 'vybe:11650', formato: 'Reels', titulo: 'Reels - Campo' };
  assert.match(c.arteDecidir(i, p), /<img[^>]+area=miniatura[\s\S]*▶[\s\S]*Reels · link de entrega<\/span>$/);
  assert.match(c.arteDecidir(i, null), /Reels · sem arquivo<\/span>$/);
  assert.match(c.arteDecidir(i, { tipo: 'imagem', thumb: 'a.png', n: 0 }), />Reels<\/span>$/);
});

test('front: servidor fora ou link fora do Drive ainda mostra o quadro com ▶; sem link nem arquivo, null', async () => {
  const c = frente((url) => (url.includes('area=peca') ? detalhe('https://www.dropbox.com/scl/fo/abc') : new Error('502')));
  const p = await c.lerDetalhe('vybe:1');
  assert.deepEqual([p.tipo, p.fonte, p.thumb], ['video', 'entrega', null]);
  assert.match(c.arteHtml('vybe:1', p, ''), /vc-previa-quadro[\s\S]*▶[\s\S]*Vídeo · link de entrega/);
  const vazio = frente((url) => (url.includes('area=peca') ? detalhe('') : { ok: true, previa: null }));
  assert.equal(await vazio.lerDetalhe('vybe:2'), null);
  assert.ok(!vazio.pedidos.some((u) => u.includes('previa_entrega')), 'sem link não pergunta ao servidor');
});

test('front: vídeo sem miniatura com endereço carregável vira <video> do primeiro quadro, mudo e sem tocar', () => {
  const c = frente(() => ({}));
  const html = c.arteHtml('vybe:3', { tipo: 'video', thumb: null, video: 'https://cdn.exemplo.test/v.mp4', nome: 'v.mp4' }, 'Prévia');
  assert.match(html, /<video class="vc-previa-video" src="https:\/\/cdn\.exemplo\.test\/v\.mp4#t=0\.1" preload="metadata" muted playsinline/);
  assert.doesNotMatch(html, /autoplay|controls/);
  assert.match(html, /▶/);
  // Longe da vez também: o baralho só troca a posição ao passar, não redesenha a carta.
  assert.match(c.arteHtml('vybe:3', { tipo: 'video', thumb: null, video: 'https://cdn.exemplo.test/v.mp4', nome: 'v.mp4' }, '', false), /<video/);
  // Sem endereço que o navegador carregue: o quadro com ▶ e o nome.
  assert.match(c.arteHtml('vybe:3', { tipo: 'video', thumb: null, video: null, nome: 'v.mp4' }, ''), /vc-previa-quadro[\s\S]*▶[\s\S]*v\.mp4/);
  // O anexo de vídeo sem miniatura usa o download autenticado (até 60 MB).
  const d = c.previaDoDetalhe({ assets: [{ name: 'final.mp4', file_extension: 'mp4', local_id: 77, file_size: 5e6 }] });
  assert.equal(d.video, '/api/painel?area=baixar&arquivo=77');
  assert.equal(c.previaDoDetalhe({ assets: [{ name: 'final.mp4', file_extension: 'mp4', local_id: 78, file_size: 9e7 }] }).video, null);
});
