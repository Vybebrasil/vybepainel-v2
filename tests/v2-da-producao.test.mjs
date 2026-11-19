// Correções do confere de diretor de arte, frente da-4 (Paulo, 19/11/2026: "dá um confere geral como diretor de arte…
// muita coisinha mal diagramada"): Produção, Demandas, Direção de arte, Agenda, Minhas tarefas e Visão do setor.
// Confere a régua no CSS: botão 34 ou 28, canto 8, rótulo 12, um laranja por tela e alvo de toque de 32 no celular.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const frag = ler('padrao-v2/da-producao.css');
const direcao = ler('padrao-v2/z-direcao.css');
const producao = ler('padrao-v2/d3-producao.css');
const junto = ler('vybe-mundo-padrao-v2.css');
const regras = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const bloco = (css, sel) => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, sel); return css.slice(i + sel.length + 1, css.indexOf('}', i)); };
const UM = '.pv2.pv2-dias.d3m-um-dia:is(#pv2-dias-s1,#pv2-dias-s2,#pv2-dias-s3,#pv2-dias-s4,#pv2-dias-s5,#pv2-dias-s6)';

test('o fragmento entra no CSS junto e segue as regras técnicas', () => {
  assert.ok(junto.includes('/* ===== padrao-v2/da-producao.css ===== */'), 'rodar scripts/padrao-v2-juntar.mjs');
  const r = regras(frag);
  assert.doesNotMatch(r, /!important/);
  assert.doesNotMatch(r, /html body\.mundo/);
  assert.doesNotMatch(r, /:has\([^)]*\[style/);
  assert.doesNotMatch(r, /text-transform:\s*uppercase/);
  for (const cor of r.match(/:\s*#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || []) assert.fail(`cor fixa ${cor}: usar token --d3-*`);
  for (const v of r.match(/var\(--[a-z0-9-]+/g) || []) assert.match(v, /var\(--(d3|d3m|agv2)-/, v);
});

test('régua de dias da Visão do setor: linha de 28 com canto 8 e sem fio; 34 no celular', () => {
  const b = bloco(frag, '.vst .vst-dia.vst-dia');
  assert.match(b, /height:28px/); assert.match(b, /border-radius:var\(--d3-r-botao\)/); assert.match(b, /border-top:0/);
  assert.match(frag, /@media \(max-width:480px\)\{[\s\S]*\.vst \.vst-dia\.vst-dia\{height:34px\}/);
});

test('segmentados: moldura 34 e botão 28, na Produção, nas Demandas e na Visão do setor', () => {
  assert.match(frag, /\.pv2-seg\.pv2-seg button\{height:28px\}/);
  assert.match(frag, /\.g2-topo \.g2-seg\{height:34px\}/);
  assert.match(frag, /\.g2-topo \.g2-seg > button\{height:28px\}/);
  assert.match(direcao, /#pv2-demandas\.pv2\.d3m-a-dm #pv2d-vistas\{flex:none;gap:2px;height:34px;/);
  assert.match(direcao, /#pv2-demandas\.pv2\.d3m-a-dm #pv2d-vistas > button\{height:28px;/);
});

test('botão pequeno dos painéis em 28 (34 no celular) e rótulo do lote em 12', () => {
  assert.match(frag, /\.pv2-btn\.s\.s\{height:28px\}/);
  assert.match(producao, /#pv2-demandas\.pv2 \.pv2-det \.pv2-btn\.s\{height:28px;/);
  assert.match(frag, /\.pv2-det \.pv2-lote\{font-size:var\(--d3-fs-apoio\)\}/);
  assert.match(frag, /@media \(max-width:480px\)\{[\s\S]*\.pv2-btn\.s\.s\{height:34px\}/);
});

test('colunas do dia: "Briefing até publicar" cabe e as colunas da linha acompanham o cabeçalho', () => {
  const col = (n) => Number(direcao.match(new RegExp(UM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ` \\.d3m-colunas > span:nth-child\\(${n}\\)\\{flex:0 0 (\\d+)px`))[1]);
  assert.equal(col(4), 120); assert.equal(col(5), 126); assert.equal(col(6), 80);
  assert.ok(direcao.includes(UM + ' .d3m-trilha{flex:0 0 120px}'));
  assert.ok(direcao.includes(UM + ' .pv2-r{flex:0 0 126px;'));
  assert.ok(direcao.includes(UM + ' .pv2-avs{flex:0 0 80px;'));
  assert.ok(direcao.includes(UM + ' .pv2-av{width:28px;height:28px}'));
  assert.match(direcao, /#pv2-painel \.d3m-tit\{[^}]*box-sizing:border-box/, 'título não estoura a largura no celular');
});

test('um laranja por tela: gravação a fechar na cor da captação e "em produção" fora do laranja', () => {
  const ev = bloco(frag, '.agv2 .agv2-ev.fechar');
  assert.match(ev, /--agv2-cor:var\(--d3-mod-vybe\)/); assert.doesNotMatch(ev, /--d3-acao/);
  assert.match(bloco(frag, ':is(.d3m-a-eq-leg,.d3m-a-eq-b)'), /--d3m-a-producao:var\(--d3-agente\)/);
});

test('fila do Danilo: sem caixa alta, botões 28 e 34 com canto 8', () => {
  assert.match(bloco(frag, '#vv-hoje .d3h-danilo .vcr-fila .vcr-q.vcr-q'), /text-transform:none/);
  assert.match(frag, /:is\(\.vc-acao,\.vc-sec\)\{height:28px;min-height:28px;border-radius:var\(--d3-r-botao\)\}/);
  assert.match(bloco(frag, '#vv-hoje .d3h-danilo .vcr-lote.vcr-lote > .vc-acao'), /height:34px/);
});

test('celular: alvo de toque de 32 nas telas da frente, fora o calendário do mês e o evento da semana', () => {
  const m = frag.slice(frag.indexOf('@media (max-width:480px){'));
  assert.match(m, /min-width:32px;min-height:32px/);
  assert.match(m, /:not\(\.capt-mes \*,\.d3m-a-dia-pcs \*,\.agv2-ev,\.pv2-av\)/);
  for (const id of ['#pv2-painel', '#pv2-demandas', '#pv2-agenda', '#vv-hoje', '.vv-setor-visao']) assert.ok(m.includes(id), id);
});
