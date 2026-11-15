// Auditoria de 15/11/2026: os cinco primeiros achados (dinheiro do Comercial e do CRM, aspas nos cliques,
// Impressões só para donos, dica do tour escondida e observador das abas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jsArg } from './apoio-js-arg.mjs';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = (t) => t.replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('jsArg: o nome volta inteiro ao JS do clique e nada escapa do texto nem do atributo', () => {
  for (const nome of ["D'Ávila", 'Bar "do Zé"', 'a\\b', "'); alert(1); ('", 'linha\nnova', '<img src=x onerror=alert(1)>', 'Tom & Jerry', 'x' + String.fromCharCode(0x2028) + 'y']) {
    const attr = jsArg(nome);
    assert.doesNotMatch(attr, /["<>\n]/, nome);
    assert.equal(Function(`return '${html(attr)}'`)(), nome);
  }
  assert.equal(jsArg(null), ''); assert.equal(jsArg(42), '42');
});

test('cliques com texto: nenhum argumento de onclick fica só com o escape de HTML ou com a troca caseira de aspas', () => {
  const arquivos = ['vybe-clientes.js', 'vybe-captacoes.js', 'vybe-conta.js', 'vybe-subitens.js', 'vybe-material.js', 'vybe-agenda.js', 'vybe-gestor.js', 'vybe-briefing.js', 'vybe-risco.js', 'vybe-perfis.js', 'vybe-demandas.js'];
  for (const f of arquivos) {
    for (const l of ler(f).split(/\r?\n/)) {
      if (!/on[a-z]+="/.test(l)) continue;
      assert.doesNotMatch(l, /on[a-z]+="[^"]*[(,]\s*'\$\{safeText\(/, f + ': ' + l.trim().slice(0, 120));
    }
  }
  assert.doesNotMatch(ler('vybe-clientes.js'), /const aspas = String\(nome\)\.replace/);
  assert.equal(ler('vybe-clientes.js').match(/const aspas = jsArg\(nome\);/g).length, 3);
});

test('pílula de status e etiqueta de formato escapam o texto', () => {
  const g = ler('vybe-gestor.js');
  assert.match(g, /<i aria-hidden="true"><\/i>\$\{safeText\(s\)\}<\/span>/);
  assert.match(g, /statusDotInlineStyle\(cor\)\}><\/span>\$\{safeText\(s\)\}<\/span>/);
  assert.match(g, />\$\{safeText\(f\)\}<\/span>`;/);
  assert.match(ler('vybe-core.js'), /pillHtml\(s, d\?\.status_color/);
});

test('Impressões: valor e cotações só para os quatro donos', () => {
  const s = ler('server/impressoes.js');
  assert.match(s, /import \{ ehDonoPessoa \} from '\.\/donos\.js';/);
  assert.match(s, /const ehGestao = \(pessoa\) => ehDonoPessoa\(pessoa\);/);
  assert.doesNotMatch(s, /from '\.\/pessoas\.js'/);
});

test('abas: o observador de largura solta a lista que saiu da tela', () => {
  const c = ler('vybe-core.js');
  assert.match(c, /function vbSoltarAbasForaDaTela\(\) \{\s*for \(const l of VB_ABAS_OBSERVADAS\) if \(!l\.isConnected\) \{ l\.vbAbasRO\?\.disconnect\(\);/);
  assert.match(c, /lista\.vbAbasRO\.observe\(lista\.parentElement\); VB_ABAS_OBSERVADAS\.add\(lista\);/);
  const fn = c.slice(c.indexOf('function vbArrumarAbas('), c.indexOf('function vbArrumarAbas(') + 200);
  assert.match(fn, /vbSoltarAbasForaDaTela\(\);/);
});
