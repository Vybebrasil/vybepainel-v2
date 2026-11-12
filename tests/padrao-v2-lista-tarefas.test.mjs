import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2, fase 4 (12/11/2026): Minhas tarefas é uma lista só, na ordem do guia; a linha abre no lugar.
const js = fs.readFileSync('vybe-mundo.js', 'utf8');
const css = fs.readFileSync('vybe-mundo.css', 'utf8');

test('os três grupos de prioridade viram filtros de uma lista, na ordem da fila', () => {
  assert.match(js, /const blocosHtml = !diaEscolhido && !hojeVerTodas \? listaUnica\(\)/);
  assert.match(js, /const GRUPOS = \{ ordem: \['Na ordem', naFila, [^\]]+\], atrasadas: \['Atrasadas', atrasadasP, [^\]]+\], hoje: \['Para hoje', deHojeP, [^\]]+\], depois: \['Próximos dias', depoisP, [^\]]+\] \};/);
  assert.match(js, /data-hoje-acao="filtro" data-valor="\$\{k\}"/);
  assert.doesNotMatch(js, /function blocosDePrioridade\(/);
});

test('a linha é enxuta e abre no lugar com as ações da peça', () => {
  assert.match(js, /<div class="v2-abre v2-linha" data-linha="\$\{id\}" aria-expanded="false">/);
  assert.match(js, /<div class="v2-mais"><div><div class="v2-linha-mais"><small>\$\{esc\(motivoNoGuia\(x, hoje\)\)\}<\/small>\$\{mais\}<button type="button" class="v2-linha-abrir" data-hoje-acao="peca"/);
  assert.match(js, /mais = acoesDaPeca\(x\.d\)/);
});

test('abrir a linha não redesenha a tela, e redesenhar não fecha a linha', () => {
  assert.match(js, /if \(acao === 'linha'\) \{ linhaAberta = linhaAberta === String\(valor\) \? '' : String\(valor\); aplicarLinhaAberta\(\); return; \}/);
  assert.match(js, /if \(el\.vvHtml !== html\) \{ el\.innerHTML = html; el\.vvHtml = html; \}\r?\n    aplicarLinhaAberta\(el\);/);
  assert.match(js, /if \(acao === 'filtro'\) \{ filtroTarefas = String\(valor \|\| 'ordem'\); linhaAberta = ''; pintarHoje\(\); return; \}/);
});

test('o CSS da lista entra no fim, sem forçar nada, e o filtro não rola de lado no celular', () => {
  const fim = css.slice(css.indexOf('PADRÃO V2 · MINHAS TAREFAS EM LISTA ÚNICA'));
  assert.ok(fim.length > 200);
  assert.doesNotMatch(fim, /!important|html body\.mundo/);
  assert.doesNotMatch(fim, /overflow-x:auto/);
  assert.match(fim, /@container hoje \(max-width:520px\)\{[^@]*#vv-hoje \.v2-lista-seg\{display:grid;grid-template-columns:1fr 1fr;width:100%\}/);
  assert.match(fim, /#vv-hoje \.v2-linha\[aria-expanded="false"\] > \.v2-mais\{visibility:hidden/);
});
