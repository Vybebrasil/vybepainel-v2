// A miniatura PRETA do Drive (Paulo, 24/11/2026, "Sim, faz"): vídeo de entrega que abre com fade do preto ganha do Drive
// uma miniatura toda zero; a carta mede no navegador e troca pelo quadro de ~1 s do próprio arquivo (area=video_entrega,
// por partes, com assinatura própria). SAFE: Drive de mentira, nada vai ao Google nem ao Neon.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { areaVideoEntrega, previaDaEntrega, assinarVideo, videoAssinado, assinarMiniatura, esquecerFichasDoVideo, VIDEO_TRECHO_MAX } from '../server/previa-entrega.js';

const salvo = process.env.SESSAO_SECRET;
before(() => { process.env.SESSAO_SECRET = 'segredo-ficticio-do-quadro-preto'; });
after(() => { if (salvo === undefined) delete process.env.SESSAO_SECRET; else process.env.SESSAO_SECRET = salvo; });

// ---------- servidor ----------
const ID = 'vid-copirece-exp-2';
const VIDEO = Buffer.alloc(VIDEO_TRECHO_MAX + 5000, 7); VIDEO.write('ftypqt  ', 4);
const resposta = () => { const r = { codigo: 0, cab: {}, corpo: null }; r.status = (c) => { r.codigo = c; return r; }; r.setHeader = (k, v) => { r.cab[k.toLowerCase()] = v; }; r.json = (c) => { r.corpo = c; return r; }; r.end = (b) => { r.corpo = b; return r; }; return r; };
function drive({ mime = 'video/quicktime', tamanho = VIDEO.length } = {}) {
  const d = { fichas: 0, trechos: [] };
  d.arquivo = async (id) => { d.fichas++; return { id, name: '20 DE NOV - COPIRECE - EXP 2.mov', mimeType: mime, size: String(tamanho) }; };
  d.trecho = async (id, ini, fim) => { d.trechos.push([id, ini, fim]); return VIDEO.subarray(ini, fim + 1); };
  return d;
}
const SESSAO = { tipo: 'sessao', pessoa: { id: 3 } };
async function pedir(d, { id = ID, e = assinarVideo(ID), range, quem = SESSAO, method = 'GET' } = {}) {
  const r = resposta();
  await areaVideoEntrega({ method, query: { id, e }, headers: range ? { range } : {} }, r, quem, d);
  return r;
}

test('prévia de vídeo da entrega leva o endereço assinado do quadro; imagem não leva', async () => {
  const listar = async (id) => (id === 'PastaCopirece01' ? [{ id: ID, name: '20 DE NOV - COPIRECE - EXP 2.mov', mimeType: 'video/quicktime', hasThumbnail: true }]
    : id === 'PastaImagens001' ? [{ id: 'img-unica-000001', name: 'card.png', mimeType: 'image/png', hasThumbnail: true }] : []);
  const v = await previaDaEntrega('https://drive.google.com/drive/folders/PastaCopirece01', { formato: 'Reels' }, { listar });
  const q = new URL(v.quadro, 'http://x').searchParams;
  assert.deepEqual([q.get('area'), q.get('id')], ['video_entrega', ID]);
  assert.ok(videoAssinado(ID, q.get('e')));
  assert.match(v.thumb, /area=miniatura/, 'a miniatura continua sendo a primeira tentativa');
  const i = await previaDaEntrega('https://drive.google.com/drive/folders/PastaImagens001', { formato: 'Card' }, { listar });
  assert.equal(i.quadro, undefined);
});

test('area=video_entrega: sessão e assinatura própria (a da miniatura não abre o vídeo)', async () => {
  esquecerFichasDoVideo(); const d = drive();
  assert.equal((await pedir(d, { quem: null })).codigo, 401);
  assert.equal((await pedir(d, { method: 'POST' })).codigo, 405);
  assert.equal((await pedir(d, { id: 'x' })).codigo, 400);
  assert.equal((await pedir(d, { e: assinarMiniatura(ID) })).codigo, 404, 'assinatura da miniatura não vale para o vídeo');
  assert.equal((await pedir(d, { e: assinarVideo('outro-arquivo-01') })).codigo, 404, 'assinatura de outro arquivo não vale');
  assert.equal((await pedir(d, { e: '' })).codigo, 404);
  assert.equal(d.fichas + d.trechos.length, 0, 'recusado não chega ao Drive');
  const semSegredo = process.env.SESSAO_SECRET, mirror = process.env.MIRROR_ADMIN_KEY; delete process.env.SESSAO_SECRET; delete process.env.MIRROR_ADMIN_KEY;
  try { assert.equal(assinarVideo(ID), ''); assert.ok(!videoAssinado(ID, '')); }
  finally { process.env.SESSAO_SECRET = semSegredo; if (mirror !== undefined) process.env.MIRROR_ADMIN_KEY = mirror; }
  esquecerFichasDoVideo();
  assert.equal((await pedir(drive({ mime: 'application/pdf' }))).codigo, 404, 'só vídeo');
  esquecerFichasDoVideo();
  assert.equal((await pedir(drive({ tamanho: 0 }))).codigo, 404);
});

test('area=video_entrega: Range sai só o trecho pedido; sem Range, o começo (nunca o arquivo inteiro)', async () => {
  esquecerFichasDoVideo(); const d = drive(), total = VIDEO.length;
  let r = await pedir(d, { range: 'bytes=0-1023' });
  assert.equal(r.codigo, 206);
  assert.equal(r.cab['content-range'], `bytes 0-1023/${total}`);
  assert.equal(r.cab['content-length'], '1024');
  assert.equal(r.cab['content-type'], 'video/quicktime');
  assert.equal(r.cab['accept-ranges'], 'bytes');
  assert.equal(r.cab['cache-control'], 'private, max-age=300');
  assert.equal(r.cab['x-content-type-options'], 'nosniff');
  assert.equal(r.corpo.subarray(4, 12).toString(), 'ftypqt  ');
  // O fim do arquivo (onde o .mov costuma guardar o índice).
  r = await pedir(d, { range: 'bytes=-100' });
  assert.equal(r.cab['content-range'], `bytes ${total - 100}-${total - 1}/${total}`);
  // bytes=0- e sem Range: só até o teto de um pedaço.
  for (const range of ['bytes=0-', undefined, 'lixo']) {
    r = await pedir(d, { range });
    assert.equal(r.codigo, 206);
    assert.equal(r.corpo.length, VIDEO_TRECHO_MAX);
    assert.equal(r.cab['content-range'], `bytes 0-${VIDEO_TRECHO_MAX - 1}/${total}`);
  }
  r = await pedir(d, { range: `bytes=${total + 10}-` });
  assert.equal(r.codigo, 416); assert.equal(r.cab['content-range'], `bytes */${total}`);
  assert.equal(d.fichas, 1, 'o tamanho do arquivo é lido uma vez e guardado');
  assert.ok(d.trechos.every(([id, ini, fim]) => id === ID && fim - ini < VIDEO_TRECHO_MAX));
});

test('area=video_entrega: Drive fora responde 502, sem derrubar', async () => {
  esquecerFichasDoVideo();
  const r = await pedir({ arquivo: async () => { throw new Error('Drive 500'); }, trecho: async () => Buffer.alloc(0) });
  assert.equal(r.codigo, 502);
  const p = await pedir({ arquivo: drive().arquivo, trecho: async () => { throw new Error('Drive 403'); } }, { range: 'bytes=0-9' });
  assert.equal(p.codigo, 502);
});

test('api/painel.js liga area=video_entrega ao Drive de verdade', () => {
  const painel = readFileSync('api/painel.js', 'utf8');
  assert.match(painel, /video_entrega: \(req, res, quem\) => areaVideoEntrega\(req, res, quem, \{ arquivo: \(id\) => abrirBaixa\.arquivo\(id\), trecho:/);
  assert.match(readFileSync('vybe_drive.js', 'utf8'), /fields=id,name,mimeType,createdTime,hasThumbnail,size/);
});

// ---------- front ----------
const fonte = readFileSync('vybe-mundo-conteudo.js', 'utf8');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, de); return texto.slice(i, texto.indexOf(ate, i)); };
function imagem(w, h, cor) { const px = new Uint8ClampedArray(w * h * 4); for (let k = 0; k < w * h; k++) { const [r, g, b, a = 255] = cor(k % w, Math.floor(k / w)); px.set([r, g, b, a], k * 4); } return px; }
function frente({ pixels } = {}) {
  const ouvintes = {}, timers = [], avisos = [], medidas = { n: 0 };
  const c = vm.createContext({
    esc: (x) => String(x ?? '').replace(/[&<>"]/g, (m) => `&#${m.charCodeAt(0)};`), previas: {}, avisos, timers, medidas,
    avisarPrevia: (r) => avisos.push(r), setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; },
    document: { addEventListener: (tipo, f) => { (ouvintes[tipo] ||= []).push(f); },
      createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => { medidas.n++; return { data: pixels() }; } }) }) },
  });
  vm.runInContext(trecho(fonte, '  const PRETAS = new Map()', '  // ---------- Links de aprovação') + trecho(fonte, '  function arteHtml', '  // A miniatura não abriu'), c);
  c.disparar = (tipo, alvo) => (ouvintes[tipo] || []).forEach((f) => f({ target: alvo }));
  return c;
}
const img = (ref, src) => ({ tagName: 'IMG', dataset: { vcPrevia: ref }, getAttribute: () => src });
const video = (ref, largura) => ({ tagName: 'VIDEO', dataset: { vcPreviaVideo: ref }, videoWidth: largura });
const THUMB = '/api/painel?area=miniatura&id=vid-copirece-exp-2&sz=480&e=abc', QUADRO = '/api/painel?area=video_entrega&id=vid-copirece-exp-2&e=def';
const entrega = (extra = {}) => ({ tipo: 'video', thumb: THUMB, quadro: QUADRO, nome: '20 DE NOV - COPIRECE - EXP 2.mov', n: 0, fonte: 'entrega', abrir: 'x', ...extra });

test('quasePreta: miniatura toda zero (e com ruído de compressão) é preta; quadro escuro com conteúdo não é', () => {
  const c = frente();
  assert.equal(c.quasePreta(imagem(48, 27, () => [0, 0, 0])), true, 'a 480x270 do Copirecê, toda zero');
  assert.equal(c.quasePreta(imagem(24, 24, (x, y) => [(x * 7 + y * 3) % 6, (x + y) % 5, 2])), true, 'ruído de JPEG perto do zero');
  assert.equal(c.quasePreta(imagem(24, 24, () => [40, 40, 40])), false, 'cinza escuro uniforme não é o preto do fade');
  assert.equal(c.quasePreta(imagem(24, 24, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]))), false, 'fundo preto com um título claro: tem conteúdo');
  assert.equal(c.quasePreta(imagem(24, 24, (x, y) => [x * 4, y * 3, 30])), false, 'quadro noturno com gradiente');
  assert.equal(c.quasePreta(imagem(8, 8, () => [0, 0, 0, 0])), false, 'transparente não conta como preta');
  assert.equal(c.quasePreta(new Uint8ClampedArray(0)), false);
});

test('front: miniatura preta vira o <video> parado em 1 s do arquivo da entrega; medida uma vez por sessão', () => {
  const c = frente({ pixels: () => imagem(24, 24, () => [0, 0, 0]) });
  c.previas['vybe:11650'] = entrega();
  c.disparar('load', img('vybe:11650', THUMB));
  const p = c.previas['vybe:11650'];
  assert.deepEqual([p.thumb, p.video, p.t, p.quadroDe], [null, QUADRO, 1, THUMB]);
  assert.deepEqual(c.avisos, ['vybe:11650']);
  const html = c.arteHtml('vybe:11650', p, 'Prévia');
  assert.match(html, /<video class="vc-previa-video" src="\/api\/painel\?area=video_entrega&#38;id=vid-copirece-exp-2&#38;e=def#t=1" preload="metadata" muted playsinline/);
  assert.doesNotMatch(html, /autoplay|controls/);
  assert.match(html, /▶/);
  // O vídeo abriu com imagem: fica.
  c.disparar('loadeddata', video('vybe:11650', 1080));
  assert.equal(c.previas['vybe:11650'].video, QUADRO);
  c.timers.forEach((t) => t.f());
  assert.equal(c.previas['vybe:11650'].video, QUADRO, 'abriu antes do prazo: o prazo não desfaz');
  // A mesma miniatura de novo (a prévia voltou do servidor): não mede de novo.
  c.previas['vybe:2'] = entrega();
  c.disparar('load', img('vybe:2', THUMB));
  assert.equal(c.medidas.n, 1);
  assert.equal(c.previas['vybe:2'].video, QUADRO);
});

test('front: o quadro não decodifica (HEVC), dá erro ou demora: fica o quadro com ▶ e o nome, sem pedir de novo', () => {
  for (const como of ['sem-imagem', 'erro', 'prazo']) {
    const c = frente({ pixels: () => imagem(24, 24, () => [0, 0, 0]) });
    c.previas.r = entrega();
    c.disparar('load', img('r', THUMB));
    if (como === 'sem-imagem') c.disparar('loadeddata', video('r', 0));
    if (como === 'erro') vm.runInContext('desistirDoQuadro("r")', c);
    if (como === 'prazo') { assert.equal(c.timers[0].ms, 12e3); c.timers[0].f(); }
    const p = c.previas.r;
    assert.equal(p.video, null, como); assert.equal(p.thumb, null, como);
    assert.match(c.arteHtml('r', p, ''), /vc-previa-quadro[\s\S]*▶[\s\S]*20 DE NOV - COPIRECE - EXP 2\.mov/, como);
    // Voltou a mesma prévia: vai direto para o quadro com ▶ (o vídeo que falhou não é pedido de novo).
    c.previas.r = entrega(); c.disparar('load', img('r', THUMB));
    assert.equal(c.previas.r.video, null, como); assert.equal(c.previas.r.thumb, null, como);
  }
});

test('front: o erro do <video> do quadro passa pelo mesmo desistir (e o vídeo do anexo segue como antes)', () => {
  assert.match(fonte, /const r = img\.dataset\.vcPreviaVideo; if \(previas\[r\]\?\.quadroDe\) return desistirDoQuadro\(r\);/);
});

test('front: miniatura boa (Maninho), imagem, anexo sem quadro ou outra src não mudam', () => {
  const c = frente({ pixels: () => imagem(24, 24, (x, y) => [120 + x, 90 + y, 60]) });
  c.previas.maninho = entrega({ thumb: '/api/painel?area=miniatura&id=vid-maninho-0001&sz=480&e=x', quadro: '/api/painel?area=video_entrega&id=vid-maninho-0001&e=y', nome: 'maninho.mp4' });
  const antes = { ...c.previas.maninho };
  c.disparar('load', img('maninho', antes.thumb));
  assert.deepEqual(c.previas.maninho, antes);
  assert.match(c.arteHtml('maninho', c.previas.maninho, ''), /<img src="\/api\/painel\?area=miniatura&#38;id=vid-maninho-0001/);
  const preta = frente({ pixels: () => imagem(24, 24, () => [0, 0, 0]) });
  preta.previas.anexo = { tipo: 'video', thumb: '/t.jpg', nome: 'a.mp4' };
  preta.previas.img = { tipo: 'imagem', thumb: '/i.jpg', quadro: '/q', nome: 'a.png' };
  preta.previas.outra = entrega();
  preta.disparar('load', img('anexo', '/t.jpg')); preta.disparar('load', img('img', '/i.jpg')); preta.disparar('load', img('outra', '/antiga.jpg'));
  assert.equal(preta.previas.anexo.thumb, '/t.jpg', 'anexo sem endereço de quadro: fica a miniatura');
  assert.equal(preta.previas.img.thumb, '/i.jpg', 'imagem preta é a arte: não troca');
  assert.equal(preta.previas.outra.thumb, THUMB, 'evento de uma <img> antiga não mexe na prévia nova');
  assert.equal(preta.medidas.n, 0);
  // O <video> do anexo (sem quadroDe) segue o caminho de antes.
  preta.previas.v = { tipo: 'video', thumb: null, video: '/api/painel?area=baixar&arquivo=7', nome: 'v.mp4' };
  preta.disparar('loadeddata', video('v', 0));
  assert.equal(preta.previas.v.video, '/api/painel?area=baixar&arquivo=7');
});
