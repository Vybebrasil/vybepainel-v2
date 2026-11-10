// Redesign do legado, fase 2 (Paulo, 09/11/2026: "Sim, fase 2").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('vybe-mundo.css', 'utf8');
const agenda = readFileSync('vybe-agenda.js', 'utf8');
const demandas = readFileSync('vybe-demandas.js', 'utf8');
const html = readFileSync('index.html', 'utf8');

test('cartão rápido: o essencial em cima, o resto em "Mais campos", com os mesmos botões', () => {
  const ess = agenda.slice(agenda.indexOf('cr-campos cr-essenciais'), agenda.indexOf('<details class="cr-mais"'));
  for (const r of ["'Status'", "'Responsável'", "'Prazo'", "'Conclusão' : 'Veiculação'"]) assert.ok(ess.includes(r), r);
  assert.ok(!ess.includes("'Clientes'"), 'clientes ficam em Mais campos');
  assert.match(agenda, /ontoggle="window\.CR_MAIS_ABERTO=this\.open"/, 'abre do mesmo jeito na próxima vez');
  assert.match(agenda, /ehDemanda \? 'Abrir a demanda' : 'Abrir a peça'/);
});

test('Painel: os modos num menu só, que fecha ao escolher', () => {
  assert.match(html, /<details class="ops-modos">/);
  assert.match(html, /if\(event\.target\.closest\('button'\)\)this\.closest\('details'\)\.open=false/);
});

test('agenda: evento estreito vira uma linha com reticências; a do Escritório fica legível fora do módulo', () => {
  assert.match(css, /html body\.mundo \.ag-ev\{container-type:inline-size\}/);
  assert.match(css, /@container \(max-width:64px\)\{\s*\.ag-ev b\{display:block;white-space:nowrap;text-overflow:ellipsis/);
  assert.match(css, /html body\.mundo \.capt-tb-pend\.atencao\{background:#FDECEE;/);
  assert.match(css, /html body\.mundo \.ofc-agenda \.ag-ev\{color:#1F1D1A\}/);
});

test('Demandas: zero sai do resumo (menos o filtro aceso) e, tudo zerado, a linha some', () => {
  assert.match(demandas, /const visiveis = kpis\.filter\(\(k\) => k\.valor \|\| k\.aceso\);\r?\n\s*alvo\.hidden = !visiveis\.length;/);
  assert.match(readFileSync('vybe-appearance.css', 'utf8'), /\.vb-resumo\[hidden\] \{ display: none; \}/);
});

test('o bloco da fase 2 não força nada', () => {
  const bloco = css.slice(css.indexOf('Agenda e captações: o evento mede a própria largura'));
  assert.doesNotMatch(bloco, /!important/);
});

test('celular: a faixa de dias e o dia vazio da agenda legíveis no fundo claro', () => {
  assert.match(css, /html body\.mundo \.ag-faixa-dia\{color:#1F1D1A\}/);
  assert.match(css, /html body\.mundo \.ag-nada\{background:#F6F3EE;color:#5E5A53\}/);
});
