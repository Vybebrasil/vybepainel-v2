// Frente s-v, varredura de responsividade (Paulo, 24/11/2026): "faz um teste de responsividade em tudo. todos os
// tamanhos de tela. menus. huds. telas. submenus." Regra dele: nada cobre nada, nada exige rolar para ver o que importa,
// nenhum texto estoura ou fica cortado. Trava as correções medidas (9 tamanhos, 3 temas). SAFE: só lê o código.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lf = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const css = lf('padrao-v2/s-v.css');
const junto = lf('vybe-mundo-padrao-v2.css');
const mundo = lf('vybe-mundo.js'), seletor = lf('vybe-seletor.js');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, de); const j = texto.indexOf(ate, i); assert.ok(j > i, ate); return texto.slice(i, j); };

test('s-v.css entra no CSS juntado, sem !important, sem :has com [style] e sem html body.mundo', () => {
  assert.ok(junto.includes(css.trim()), 'rode node scripts/padrao-v2-juntar.mjs');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /:has\([^)]*\[style/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  for (const cor of css.match(/#[0-9a-f]{3,8}\b(?![\w-])/gi) || []) assert.fail('cor solta fora dos tokens --d3-*: ' + cor);
});

test('celular: alvos de toque com 28 px no Nova demanda, nos links pequenos e no mês da agenda', () => {
  const cel = trecho(css, '@media (max-width:600px){\n  body.mundo #fc-overlay#fc-overlay .nd.nd .nd-chip', '\n}\n');
  assert.match(cel, /\.nd\.nd \.nd-chip,[^{]*\{height:28px\}/);
  assert.match(cel, /\.nd-sazonal\{display:inline-flex;align-items:center;min-height:28px\}/);
  assert.match(cel, /\.capt-mes-num\.capt-mes-num\{min-width:28px;height:28px\}/);
  assert.match(cel, /\.d3m-e-pes-seta\.d3m-e-pes-seta\{width:28px;height:28px\}/);
  assert.match(cel, /\.d3m-d-troca\.d3m-d-troca > summary\{min-height:28px\}/);
});

test('Nova demanda cabe acima da faixa das salas e, no celular, o Continuar fica acima da barra de baixo', () => {
  assert.match(css, /body\.mundo\.com-dock-salas #fc-overlay#fc-overlay \.nd\.nd\{max-height:calc\(100dvh - 36px - var\(--vv-dock-alto,0px\)\)\}/);
  assert.match(css, /body\.mundo #fc-overlay#fc-overlay \.nd\.nd\{padding-bottom:calc\(var\(--vv-barra-cel,64px\) \+ 14px\)\}/);
});

test('Demandas numa coluna: a lista vem antes da consulta', () => {
  const m = trecho(css, '@media (max-width:1180px){', '\n}\n');
  assert.match(m, /> \.s-dm-folha\{order:1\}/);
  assert.match(m, /> \.s-dm-lado,[^{]*> \.s-dm-lado > div\{order:2\}/);
});

test('Hoje, Minhas tarefas e Direção de arte: cartões estreitos não espremem o texto', () => {
  assert.match(css, /#vv-hoje \.d3h-cartao > \.d3h-corpo\{container-type:inline-size\}/);
  assert.match(css, /#vv-hoje \.d3h-decidir-acoes\{flex-wrap:wrap;row-gap:8px\}/);
  assert.match(css, /#vv-hoje \.d3q \.d3h-ola > small\{max-width:100%;white-space:normal\}/);
  assert.match(css, /#vv-hoje \.d3m-a-da \.d3m-a-da-arte\{container-type:inline-size\}/);
  assert.match(css, /@container \(max-width:320px\)\{\n  #vv-hoje \.d3m-a-da-arte \.d3m-a-da-img\{width:96px;height:128px\}/);
});

test('menu de setor e lista do seletor param acima da faixa das salas (e da barra do celular)', () => {
  const setor = trecho(mundo, '// Ao lado do menu, sem descer por cima da faixa das salas', 'el.style.top');
  assert.match(setor, /\.vv-dock-salas-faixa:not\(\[hidden\]\)/);
  assert.match(setor, /el\.style\.maxHeight = Math\.max\(160, chao - 16\) \+ 'px'/);
  const sel = trecho(seletor, 'let chao = innerHeight;', 'const embaixo');
  assert.match(sel, /\.vv-dock-salas-faixa:not\(\[hidden\]\), body\.mundo \.vv-trilho/);
  assert.match(seletor, /const embaixo = chao - r\.bottom - 12, emcima = r\.top - 12;/);
});
