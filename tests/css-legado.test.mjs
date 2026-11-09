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

test('vybe-mundo.css fecha todas as regras (uma regra aberta faz o navegador ignorar o resto do arquivo)', () => {
  const css = ler('vybe-mundo.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"/g, '');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
  // No bloco gerado, cada regra termina na própria linha ou na seguinte, nunca com a vírgula solta no fim.
  const ini = css.indexOf('html body.mundo.mundo-modulo .header-title h1');
  for (const l of css.slice(ini).split('\n').slice(0, 2000)) assert.ok(!/,\s*$/.test(l) || /\{|^\s/.test(l) || !l.trim(), l.slice(0, 80));
});

test('campos escuros e topo laranja do tema antigo só fora do Irecity; perfil novo da sinuca sem !important', () => {
  const pd = ler('vybe-padrao.css'), ap = ler('vybe-appearance.css'), st = ler('vybe-styles.css');
  assert.match(pd, /:where\(body:not\(\.mundo\)\) \.workflow-field input,/);
  assert.match(pd, /:where\(body:not\(\.mundo\)\) \.capt-form :is\(/);
  assert.match(ap, /\.vybe-desktop:where\(:not\(\.mundo\)\) > header \{\n  background: linear-gradient\(110deg/);
  assert.match(st, /\.snc-perfil \.snc-perfil-caixa:not\(\.snc-cf\)\{grid-template-areas:/);
  assert.doesNotMatch(st, /body \.snc-perfil \.snc-perfil-caixa\.snc-cf\{[^}]*!important/);
});

test('sem remendo de repouso: vybe-energia.js pausa só os laços infinitos', () => {
  for (const f of readdirSync('.').filter((n) => /^vybe-mundo.*\.css$/.test(n)))
    assert.doesNotMatch(ler(f), /html\.vb-ocioso[^{]*\{[^}]*animation:none/, f);
});
