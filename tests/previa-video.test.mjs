// Vídeo no olho: a prévia de um Reels toca o vídeo e marca a imagem como capa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fonte = fs.readFileSync('vybe-material.js', 'utf8');
const gaveta = fs.readFileSync('vybe-gaveta.js', 'utf8');
const status = fs.readFileSync('vybe-status.js', 'utf8');
const trecho = (texto, de, ate) => texto.slice(texto.indexOf(de), texto.indexOf(ate, texto.indexOf(de)));

function contexto() {
  const c = vm.createContext({ PREVIA_MATERIAL: [], safeText: (x) => String(x ?? ''), vbEstadoHtml: ({ titulo, acao = '' }) => `<estado>${titulo}${acao}</estado>` });
  vm.runInContext(trecho(status, 'function statusContextPreviewAssets', 'function statusContextPreviewAsset('), c);
  vm.runInContext(trecho(gaveta, 'function workspacePlainText', 'function workspaceCopyFallback'), c);
  vm.runInContext(trecho(fonte, 'function eVideoDoMaterial', '// A barra das peças só existe'), c);
  // Sem DOM no teste: o texto da atualização já vem sem marcação.
  c.workspacePlainText = (x) => String(x || '').replace(/<[^>]+>/g, ' ');
  return c;
}
const capa = { id: 'capa1', name: 'capa-voa.png', file_extension: 'png', url_thumbnail: 'https://drive.google.com/thumbnail?id=capa1&sz=w400', public_url: 'https://drive.google.com/thumbnail?id=capa1&sz=w1920' };
const entrega = (url) => ({ body: `Link de entrega: ${url}`, assets: [], creator: { name: 'Edição' } });

test('Reels com capa e link de entrega do Drive: vídeo primeiro, imagem marcada como capa', () => {
  const c = contexto();
  const m = c.materialDaPeca({ assets: [capa], updates: [entrega('https://drive.google.com/file/d/VIDEO_VOA_123/view?usp=sharing')] }, { formato: 'Reels' });
  assert.equal(m.length, 2);
  assert.equal(m[0].tipo, 'video');
  assert.equal(c.fonteDoVideo(m[0]).embed, 'https://drive.google.com/file/d/VIDEO_VOA_123/preview');
  assert.equal(m[1].capa, true);
  c.PREVIA_MATERIAL = m;
  assert.match(c.videoDaPrevia(m[0]), /<iframe[^>]+VIDEO_VOA_123\/preview/);
  assert.doesNotMatch(c.capaDaPrevia(m[1]), /só a capa/);
});

test('arquivo de vídeo do Drive toca no player, não vira imagem da miniatura', () => {
  const c = contexto();
  const video = { id: 'vid9876543210', name: 'reels-final.mp4', file_extension: 'mp4', url_thumbnail: 'https://drive.google.com/thumbnail?id=vid9876543210&sz=w400', public_url: 'https://drive.google.com/thumbnail?id=vid9876543210&sz=w1920' };
  const m = c.materialDaPeca({ assets: [video, capa], updates: [] }, { formato: 'Post' });
  assert.equal(JSON.stringify(m.map((x) => [x.tipo || 'imagem', !!x.capa])), JSON.stringify([['video', false], ['imagem', true]]));
  assert.match(c.videoDaPrevia(m[0]), /vid9876543210\/preview/);
});

test('só a capa: avisa que o vídeo ainda não foi anexado', () => {
  const c = contexto();
  const m = c.materialDaPeca({ assets: [capa], updates: [] }, { formato: 'Reels' });
  c.PREVIA_MATERIAL = m;
  assert.equal(m.length, 1);
  assert.match(c.capaDaPrevia(m[0]), /só a capa/);
});

test('link de pasta vira "Abrir o vídeo"; post comum não ganha etiqueta de capa', () => {
  const c = contexto();
  const m = c.materialDaPeca({ assets: [capa], updates: [entrega('https://drive.google.com/drive/folders/PASTA123')] }, { formato: 'Reels' });
  assert.equal(m[0].tipo, 'link');
  assert.match(c.videoDaPrevia(m[0]), /Abrir o vídeo/);
  const post = c.materialDaPeca({ assets: [{ ...capa, name: 'card-promo.png' }], updates: [] }, { formato: 'Card' });
  assert.equal(post[0].capa, undefined);
});

test('YouTube e mp4 direto também tocam', () => {
  const c = contexto();
  assert.equal(c.fonteDoVideo({ abrir: 'https://youtube.com/shorts/abcdefghijk' }).embed, 'https://www.youtube.com/embed/abcdefghijk');
  assert.equal(c.fonteDoVideo({ abrir: 'https://cdn.exemplo.com/v.mp4' }).src, 'https://cdn.exemplo.com/v.mp4');
});
