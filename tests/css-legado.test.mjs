// Regras globais do tema antigo isoladas do Irecity (diagnóstico de !important, 09/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('cabeçalho escuro e camada do .app-header só fora do Irecity, com a força de antes', () => {
  const st = ler('vybe-styles.css'), pd = ler('vybe-padrao.css');
  assert.match(st, /:where\(body:not\(\.mundo\)\) header:where\(:not\(\.tema-sinuca\)\) \{ background:/);
  assert.match(st, /:where\(body:not\(\.mundo\)\) header:where\(:not\(\.tema-sinuca\)\),:where\(body:not\(\.mundo\)\) \.topbar\{/);
  assert.doesNotMatch(st, /\n\s*header:where\(:not\(\.tema-sinuca\)\) \{ background/);
  assert.match(pd, /:where\(body:not\(\.mundo\)\) \.app-header\{z-index:200!important\}/);
});

test('sem remendo de repouso: vybe-energia.js pausa só os laços infinitos', () => {
  for (const f of readdirSync('.').filter((n) => /^vybe-mundo.*\.css$/.test(n)))
    assert.doesNotMatch(ler(f), /html\.vb-ocioso[^{]*\{[^}]*animation:none/, f);
});
