// Frente s-w (Paulo, 25/11/2026: "Sim, ataca"): os 6 pontos de responsividade que pediam redesenho, achados na
// varredura s-v. Trava cada um: (1) os botões do topo à vista no Ranking e na Performance; (2) Hoje e Visão geral do
// setor no celular por prioridade, com linhas que abrem; (3) a coluna de consulta sem rolagem entre 1280 e 1536;
// (4) a folha da captação acima da barra de baixo; (5) a placa do elevador compacta; (6) os filtros das Demandas atrás
// de "Filtros (N)" no celular. SAFE: só lê o código.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lf = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const css = lf('padrao-v2/s-w.css');
const junto = lf('vybe-mundo-padrao-v2.css');
const mundo = lf('vybe-mundo.js'), setor = lf('vybe-mundo-setor.js'), demandas = lf('vybe-demandas.js');
const legado = lf('vybe-mundo.css'), tutorial = lf('vybe-mundo-tutorial-roteiros.js');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, de); const j = texto.indexOf(ate, i); assert.ok(j > i, ate); return texto.slice(i, j); };

test('s-w.css entra no CSS juntado, sem !important, sem :has com [style], sem html body.mundo e sem cor solta', () => {
  assert.ok(junto.includes(css.trim()), 'rode node scripts/padrao-v2-juntar.mjs');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /:has\([^)]*\[style/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  for (const cor of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-f]{3,8}\b(?![\w-])/gi) || []) assert.fail('cor solta fora dos tokens --d3-*: ' + cor);
});

test('1 · Ranking e Performance: a barra do topo fica por cima e o cabeçalho reserva o lugar dela', () => {
  const p1 = trecho(css, '@media (min-width:901px){\n  body.mundo.com-ranking-janela #mundo-hud{z-index:842}', '\n}\n');
  // o Ranking aberto vira classe no body (sem :has no body): posta ao abrir, tirada ao fechar ou trocar a janela
  assert.doesNotMatch(css, /body\.mundo:has\(/);
  assert.match(lf('vybe-escritorio-ficha.js'), /document\.body\.classList\.add\("com-ranking-janela"\)/);
  const portoes = lf('vybe-portoes.js');
  assert.match(portoes, /function closeWorkflowModal\(\) \{ document\.body\.classList\.remove\('com-ranking-janela'\);/);
  assert.match(portoes, /function openWorkflowModal\(html\) \{ document\.body\.classList\.remove\('com-ranking-janela'\);/);
  assert.match(p1, /#mundo-hud > \.vv-topo\{visibility:visible;pointer-events:none\}/);
  assert.match(p1, /\.vv-ferramentas > \*\{pointer-events:auto;margin-left:0\}/);
  assert.match(p1, /\.d3m-e-topo\.d3m-e-topo,[\s\S]*?\{flex-wrap:wrap;row-gap:12px;padding-right:300px\}/);
  assert.match(css, /> \.d3m-e-acoes\{flex:1 0 calc\(100% \+ 300px\);justify-content:flex-end;margin-right:-300px\}/);
  // a Gestão não esconde mais a barra do topo
  assert.match(legado, /body\.mundo-gestao #mundo-hud > :not\(\.vv-trilho\):not\(\.vv-setor\):not\(\.vv-topo\)/);
});

test('2 · Celular: o Hoje e a Visão geral põem os blocos de consulta em linhas que abrem e lembram o que ficou aberto', () => {
  const js = trecho(mundo, "const celSw = window.matchMedia ? window.matchMedia('(max-width:600px)')", 'window.VybeCelDobras');
  assert.match(js, /SW_DOBRAS = 'vybe\.cel\.dobras'/);
  assert.match(js, /try \{[^}]*localStorage/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /ver todas/);
  assert.ok(mundo.includes("queueMicrotask(() => { pend = false; swHoje(); }); }).observe(el, { childList: true, subtree: true })"), 'o Hoje redobra quando é repintado');
  assert.match(setor, /window\.VybeCelDobras\?\.setor\?\.\(el\)/);
  const cel = trecho(css, '/* 2 · Celular', '\n/* 3 ·');
  assert.match(cel, /\.sw-dobra\{display:grid;grid-template-rows:auto 0fr/);
  assert.match(cel, /\.sw-dobra\.aberta\{grid-template-rows:auto 1fr\}/);
  assert.match(cel, /\.d3h-lin:nth-child\(n\+4\)/);
  assert.match(cel, /\.vst-lin:nth-child\(n\+4\)/);
  assert.match(cel, /\.d3h-nums\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(cel, /\.vst \.vst-nums\{order:0;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(cel, /\.vst \.vst-laranja\{order:1/);
  // Minhas tarefas: as abas numa linha própria que corre para o lado; a lupa e o Por status embaixo
  assert.match(cel, /\.d3h-tarefas > \.d3h-filtros\{flex-wrap:wrap;row-gap:8px\}/);
  assert.match(cel, /> \.v2t-fichas\{display:flex;flex:1 0 100%;flex-wrap:nowrap;[^}]*overflow-x:auto/);
  // o chip da miniatura corta com reticências dentro dele
  assert.match(css, /\.d3h-arte > span:not\(\[class\]\)\{display:block;[^}]*text-overflow:ellipsis\}/);
});

test('3 · A coluna de consulta não rola entre 1280 e 1536: resumo por bloco, o resto no "abrir"', () => {
  const p3 = trecho(css, '/* 3 ·', '\n/* 4 ·');
  assert.match(p3, /@media \(min-width:1181px\) and \(max-height:900px\)\{[\s\S]*?\.d3h-agl:nth-child\(n\+2\)\{display:none\}/);
  assert.match(p3, /@media \(min-width:1181px\) and \(max-height:800px\)\{[\s\S]*?\.d3h-ag:nth-child\(n\+3\)\{display:none\}/);
  assert.match(p3, /#md-lado > \.d3m-cons\.mdq-como\{display:none\}/);
});

test('4 · Celular: a folha da captação para acima da barra de baixo e rola por dentro', () => {
  const p4 = trecho(css, '/* 4 ·', '\n/* 6 ·');
  assert.match(p4, /#ag-cartao\.ag-cartao\.folha\{bottom:var\(--vv-pe-janela,76px\);[^}]*height:calc\(100dvh - var\(--vv-pe-janela,76px\) - var\(--vv-m,8px\)\);[^}]*overflow-y:auto/);
});

test('5 · Prédio: a placa do elevador numa linha por andar, duas colunas em tela larga e folha no celular', () => {
  const p5 = css.slice(css.indexOf('/* 5 ·'));
  assert.match(p5, /\.vv-elevador > \.meio\{display:flex;align-items:baseline/);
  assert.match(p5, /@media \(min-width:1600px\)\{[\s\S]*?\.vv-elevador-lista\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(p5, /\.com-placa[^{]*\.v2m-fala\.d3h-acao\{right:340px\}/);
  assert.match(p5, /@media \(max-width:900px\)\{[\s\S]*?#vv-placa:has\(> \.vv-elevador-lista\)\{top:auto;bottom:var\(--vv-pe-janela,76px\)/);
});

test('6 · Demandas no celular: "Filtros (N)" abre a folha com os filtros; no computador nada muda', () => {
  const js = trecho(demandas, 'function pv2dFolhaDeFiltros(raiz)', 'function pv2dMontar()');
  assert.match(js, /bt\.id = 'pv2d-filtros-bt'/);
  assert.match(js, /`Filtros \(\$\{n\}\)`/);
  assert.match(js, /querySelectorAll\('\.s-dm-chip'\)/);
  assert.match(js, /sw-filtros-aberta/);
  assert.match(js, /ev\.key === 'Escape'/);
  assert.match(demandas, /raiz\.querySelector\('#pv2d-filtros'\)\.append\(controles\);\n  pv2dFolhaDeFiltros\(raiz\);/);
  const p6 = trecho(css, '/* 6 ·', '\n/* 5 ·');
  assert.match(css, /#pv2-demandas \.sw-filtros-bt,#pv2-demandas \.sw-filtros-cab\{display:none\}/);
  assert.match(css, /\.s-dm-folha:not\(\.sw-filtros-aberta\) > \.s-dm-filtros\{display:none\}/);
  assert.match(css, /\.s-dm-folha\.sw-filtros-aberta > \.s-dm-filtros\{position:fixed;[^}]*bottom:var\(--vv-pe-janela,76px\)/);
  assert.match(css, /> \.demanda-resumo\{flex:1 1 auto;min-width:0;padding:0 12px 0 0;overflow-x:auto/);
  assert.ok(p6.length > 0);
});

test('o tutorial acha os blocos que mudaram de lugar no celular', () => {
  assert.match(tutorial, /alvo: \['#vv-hoje \.d3q-olho', '#vv-hoje \.sw-dobra:has\(> \.d3q-olho\) > \.sw-dobra-cab'\]/);
  assert.match(tutorial, /alvo: \['#pv2d-chips', '#pv2d-filtros', '#pv2d-filtros-bt'\]/);
});
