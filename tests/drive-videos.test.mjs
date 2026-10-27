import test from 'node:test';
import assert from 'node:assert/strict';
import { videosDaPasta, areaDriveVideos } from '../server/drive-videos.js';

const PASTA = 'application/vnd.google-apps.folder';
const arvore = {
  raiz000000: [{ id: 'sub1000000', name: 'HEBRAVET', mimeType: PASTA }, { id: 'v1', name: 'solto.mp4', mimeType: 'video/mp4' }, { id: 'd1', name: 'roteiro', mimeType: 'application/vnd.google-apps.document' }],
  sub1000000: [{ id: 'v2', name: 'rotina.mov', mimeType: 'video/quicktime', videoMediaMetadata: { durationMillis: '31000' } }, { id: 'sub2000000', name: 'brutos', mimeType: PASTA }],
  sub2000000: [{ id: 'v3', name: 'bruto.mp4', mimeType: 'video/mp4' }, { id: 'sub3000000', name: 'fundo', mimeType: PASTA }],
  sub3000000: [{ id: 'v4', name: 'longe.mp4', mimeType: 'video/mp4' }],
};
const listar = async (id) => arvore[id] || [];

test('lista vídeos da pasta e de até dois níveis de subpastas, com o caminho', async () => {
  const v = await videosDaPasta('raiz000000', { listar });
  assert.deepEqual(v.map((x) => [x.id, x.caminho]), [['v1', ''], ['v2', 'HEBRAVET'], ['v3', 'HEBRAVET / brutos']]);
  assert.equal(v[1].duracao, 31);
});

test('id inválido é recusado sem ir ao Drive; sem sessão, 401', async () => {
  await assert.rejects(videosDaPasta("x' or 1=1", { listar: () => { throw new Error('não devia chamar'); } }), /inválida/);
  const res = { status(c) { this.c = c; return this; }, json(d) { this.d = d; return this; } };
  await areaDriveVideos({ method: 'GET', query: { pasta: 'abc' } }, res, { id: 1 }, { buscar: videosDaPasta });
  assert.equal(res.c, 400);
  await areaDriveVideos({ method: 'GET', query: { pasta: 'raiz000000' } }, res, null);
  assert.equal(res.c, 401);
  await areaDriveVideos({ method: 'GET', query: { pasta: 'raiz000000' } }, res, { id: 1 }, { buscar: (p) => videosDaPasta(p, { listar }) });
  assert.equal(res.c, 200);
  assert.equal(res.d.videos.length, 3);
});
