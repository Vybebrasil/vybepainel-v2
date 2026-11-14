// Guarda das folhas de estilo (14/11/2026): folha vazia ou padrão novo fora → pede de novo, uma vez só.
// SAFE: DOM de mentira; nada de rede.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function montar({ token = '', regras = 10 } = {}) {
  const inseridos = [];
  const link = (href, n) => ({ href, rel: 'stylesheet', sheet: { cssRules: { length: n } }, remove() {}, addEventListener() {},
    cloneNode() { return link(href, n); }, after(x) { inseridos.push(x.href); } });
  const links = [link('https://x/assets/mundo-abc.css', 10), link('https://x/assets/mundo-padrao-v2-123.css', regras)];
  const ctx = { console: { warn() {} }, Date, setTimeout: (f) => f(), globalThis: {},
    window: { addEventListener() {} },
    document: { readyState: 'complete', documentElement: {}, addEventListener() {}, querySelectorAll: () => links },
    getComputedStyle: () => ({ getPropertyValue: () => token }) };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-estilo-guarda.js', 'utf8'), ctx);
  return { ctx, inseridos };
}

test('com o padrão novo valendo, nada é pedido de novo', () => {
  const { inseridos } = montar({ token: '#C2490C' });
  assert.deepEqual(inseridos, []);
});

test('sem o token do padrão novo, a folha padrao-v2 é pedida de novo uma vez só', () => {
  const { ctx, inseridos } = montar({ token: '' });
  ctx.vbConferirEstilos(); ctx.vbConferirEstilos();
  assert.equal(inseridos.length, 1);
  assert.match(inseridos[0], /mundo-padrao-v2-123\.css\?r=\d+/);
});

test('folha que chegou vazia é pedida de novo', () => {
  const { inseridos } = montar({ token: '#C2490C', regras: 0 });
  assert.equal(inseridos.length, 1);
});

test('o index carrega a guarda logo depois do vybe-core', () => {
  assert.match(readFileSync('index.html', 'utf8'), /vybe-core\.js"><\/script>\r?\n\s*<script src="\/vybe-estilo-guarda\.js">/);
});
