// Aviso de versão nova (Paulo, 10/11/2026: "todos já estão usando as novas interfaces?").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const init = readFileSync('vybe-init.js', 'utf8');
const trecho = init.slice(init.indexOf('const VERSAO_ARQUIVO'), init.indexOf('const VERSAO = {'));

function comparar(carregados, servidos) {
  const ctx = { document: { querySelectorAll: () => carregados.map((src) => ({ getAttribute: (k) => (k === 'src' ? src : null) })) }, Set };
  vm.runInNewContext(trecho + '\nthis.arq = arquivosDaVersao; this.carregada = VERSAO_CARREGADA;', ctx);
  const s = ctx.arq(servidos.map((a) => `<script src="${a}"></script>`).join(''));
  if (!ctx.carregada.size || !s.size) return false;
  for (const a of s) if (!ctx.carregada.has(a)) return true;
  return false;
}

test('avisa quando o site serve arquivos com outro código; não avisa quando é a mesma versão nem na demo local', () => {
  const v1 = ['/assets/painel-871d42118b93.css', '/assets/vybe-mundo-358e25c2200a.js'];
  assert.equal(comparar(v1, v1), false, 'mesma versão');
  assert.equal(comparar(v1, ['/assets/painel-871d42118b93.css', '/assets/vybe-mundo-99aa88bb77cc.js']), true, 'arquivo novo');
  assert.equal(comparar(['/vybe-mundo.js', '/vybe-styles.css'], ['/vybe-mundo.js']), false, 'demo local sem código nos arquivos');
});

test('nunca recarrega sozinho; Recarregar e Depois; confere ao voltar para a aba', () => {
  assert.match(init, /\.vb-versao-recarregar'\)\.addEventListener\('click', \(\) => location\.reload\(\)\)/);
  assert.equal((init.match(/location\.reload\(\)/g) || []).length, 1, 'o único reload é o do botão');
  assert.match(init, /document\.addEventListener\('visibilitychange', \(\) => \{ if \(!document\.hidden\) conferirVersao\(\); \}\)/);
  assert.match(init, /fetch\('\/', \{ cache: 'no-store', credentials: 'same-origin' \}\)/);
  const css = readFileSync('vybe-appearance.css', 'utf8');
  assert.match(css, /#vb-versao \{ position: fixed;[^}]*bottom: calc\(16px \+ var\(--vv-dock-alto, 0px\) \+ 14px\)/, 'acima do dock');
  assert.match(css, /@keyframes vb-versao-entra \{ from \{ translate: 0 14px; \}/, 'entra só com movimento');
});

test('o aviso fica logo acima do dock medido, também no celular', () => {
  assert.match(init, /function posicionarVersaoNova\(\) \{/);
  assert.match(init, /el\.style\.bottom = baixo\.length \? `\$\{Math\.round\(innerHeight - Math\.min\(\.\.\.baixo\) \+ 12\)\}px` : '';/);
});
