import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2, fase 3 (12/11/2026): a aprovação interna de conteúdo vira um baralho, uma decisão por vez.
const js = fs.readFileSync('vybe-mundo-conteudo.js', 'utf8');
const css = fs.readFileSync('vybe-mundo-conteudo.css', 'utf8');

test('Conteúdo abre em Para aprovar, com as três abas', () => {
  assert.match(js, /function abrir\(\{ aba = 'aprovar', cliente = '', mes = '' \} = \{\}\)/);
  assert.match(js, /st\.aba = \['links', 'equilibrio'\]\.includes\(aba\) \? aba : 'aprovar';/);
  for (const aba of ['aprovar', 'equilibrio', 'links']) assert.ok(js.includes(`role="tab" data-vc-aba="${aba}"`), aba);
});

test('a fila é a aprovação interna, pela data do cliente, e larga a peça que o painel já mostra fora de aprovação', () => {
  assert.match(js, /pecas\.filter\(\(i\) => i\.etapa === 'interna'\)/);
  assert.match(js, /return !p \|\| \/aprova\/i\.test\(String\(p\.status \|\| ''\)\);/);
  assert.match(js, /String\(a\.veiculacao \|\| a\.prazo \|\| '9'\)\.localeCompare\(String\(b\.veiculacao \|\| b\.prazo \|\| '9'\)\)/);
});

test('a decisão passa pelos portões de sempre; sem peça, status ou portão, abre a peça', () => {
  assert.match(js, /alvo = acao === 'aprovar' \? 'para agendar' : 'alteração';/);
  assert.match(js, /const portao = acao === 'aprovar' \? globalThis\.openQualityGate : globalThis\.openStatusContextGate;/);
  assert.match(js, /if \(!item \|\| !opcao \|\| typeof portao !== 'function'\) \{ toast\('Abri a peça: a decisão dela é por lá\.', 'info'\); return abrirDaFila\(i\); \}/);
  assert.match(js, /portao\(item, opcao\);/);
  // Nada grava status direto daqui.
  const trecho = js.slice(js.indexOf('// ---------- Para aprovar'), js.indexOf('// ---------- Equilíbrio ----------'));
  assert.doesNotMatch(trecho, /fetch\(|updateFocusStatus|commitStatusChange/);
});

test('o baralho usa as peças do padrão e as setas só mexem nas posições', () => {
  assert.match(js, /<div class="v2-baralho vc-apr-baralho" aria-live="polite">/);
  assert.match(js, /const posDaCarta = \(k\) => \(k < st\.apr \? 'fora' : k - st\.apr <= 2 \? String\(k - st\.apr\) : ''\);/);
  assert.match(js, /if \(pos\) c\.dataset\.pos = pos; else delete c\.dataset\.pos;/);
  assert.match(js, /e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowRight'\) && st\.aba === 'aprovar' && !porCima/);
});

test('sem dados (leitura antes do login), abrir a aba lê de novo; a gaveta da peça fica na frente da janela', () => {
  assert.match(js, /const relerFila = \(forcar = false\) => A\(\)\?\.atualizar\?\.\(forcar \|\| !A\(\)\.estado\(\)\.dados\);/);
  assert.match(js, /document\.body\.classList\.toggle\('vc-aberto', st\.aberto\);/);
  assert.match(css, /html body\.mundo\.vc-aberto #workspace-drawer\.workspace-drawer\{z-index:660!important\}/);
  assert.match(css, /#vv-conteudo \.vc-apr-ok\{[^}]*background:#1F1D1A;color:#FFFFFF/);
});
