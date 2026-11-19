// Palco da chamada solto (Paulo, 18/11/2026: "isso tá fixo... deixa quem tá assistindo poder mover e redimensionar").
// A conta da caixa é pura: limites da tela (trilho, dock e margem), largura entre 280 px e 90% da tela, altura na
// proporção do vídeo. O resto confere a fonte: alça, guardar por pessoa com try/catch, duplo clique e tela cheia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../padrao-v2/d3-palco.css', import.meta.url), 'utf8');
const junto = readFileSync(new URL('../vybe-mundo-padrao-v2.css', import.meta.url), 'utf8');
const corpoFn = fonte.match(/  function palcoEncaixar\(pedido, area, corpo\) \{[\s\S]*?\r?\n  \}\r?\n/)[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext('const PALCO_MIN = 280;\n' + corpoFn + '\nthis.encaixar = palcoEncaixar;', ctx);
const encaixar = (...a) => ({ ...ctx.encaixar(...a) });

// Computador 1440 x 900: trilho até 104 px, dock da sala com topo em 812, margem 14.
const area = { esq: 104, topo: 14, dir: 1426, fundo: 798, tela: 1440 };
const corpo = { extra: 64, folga: 16, razoes: [16 / 9] };

test('arrastar: a janela fica dentro da área (não passa do trilho, do dock nem da margem)', () => {
  assert.deepEqual(encaixar({ x: 500, y: 300, w: 420 }, area, corpo), { x: 500, y: 300, w: 420, h: 64 + Math.round((420 - 16) * 9 / 16), alto: 498 });
  const fora = encaixar({ x: -900, y: -400, w: 420 }, area, corpo);
  assert.equal(fora.x, 104); assert.equal(fora.y, 14);
  const longe = encaixar({ x: 5000, y: 5000, w: 420 }, area, corpo);
  assert.equal(longe.x + longe.w, 1426);
  assert.equal(longe.y + longe.h, 798, 'o pé da janela para no topo do dock');
});

test('redimensionar: mínimo de 280 px, máximo de 90% da tela e da altura que cabe; o vídeo segue a proporção', () => {
  assert.equal(encaixar({ x: 200, y: 20, w: 50 }, area, corpo).w, 280);
  const grande = encaixar({ x: 200, y: 20, w: 5000 }, area, corpo);
  // 90% de 1440 = 1296; a altura que cabe ((784 - 64) / (9/16) + 16) também dá 1296; a área tem 1322.
  assert.equal(grande.w, 1296);
  assert.ok(grande.h <= area.fundo - area.topo, 'a janela inteira cabe na altura');
  const baixa = { ...area, fundo: 414 }; // tela baixa: a altura limita a largura
  const g = encaixar({ x: 200, y: 20, w: 1200 }, baixa, corpo);
  assert.equal(g.w, Math.round((400 - 64) * 16 / 9 + 16));
  assert.ok(Math.abs(g.h - (400)) <= 1);
  // vídeo 4:3 e duas pessoas: a altura é a soma das duas na proporção de cada uma
  const dois = encaixar({ x: 200, y: 20, w: 500 }, area, { extra: 70, folga: 16, razoes: [4 / 3, 16 / 9] });
  assert.equal(dois.h, Math.round(70 + (500 - 16) * (3 / 4 + 9 / 16)));
  // proporção inválida (stream ainda sem tamanho) vira 16:9
  assert.equal(encaixar({ x: 200, y: 20, w: 500 }, area, { ...corpo, razoes: [0] }).h, encaixar({ x: 200, y: 20, w: 500 }, area, corpo).h);
});

test('celular 375 de largura: a janela nunca passa da tela, mesmo com o mínimo de 280', () => {
  const cel = { esq: 14, topo: 14, dir: 361, fundo: 700, tela: 375 };
  const g = encaixar({ x: 300, y: 0, w: 900 }, cel, corpo);
  assert.ok(g.x >= 14 && g.x + g.w <= 361);
  assert.ok(g.w >= 280 && g.w <= 375 * 0.9);
  const estreita = encaixar({ x: 0, y: 0, w: 300 }, { esq: 14, topo: 14, dir: 254, fundo: 600, tela: 268 }, corpo);
  assert.equal(estreita.w, 240, 'tela menor que o mínimo: ocupa a área toda, sem sair');
});

test('guardar por pessoa, com try/catch; duplo clique volta ao canto; tela muda, a janela volta para dentro', () => {
  assert.match(fonte, /const chavePalco = \(\) => 'vybe\.mundo\.palco\.' \+ \(String\(\(typeof operadorDoTopo === 'function' \? operadorDoTopo\(\)\?\.id : ''\) \|\| ''\) \|\| 'anon'\);/);
  assert.match(fonte, /try \{ localStorage\.setItem\(palcoLido, JSON\.stringify\(palcoPedido\)\); \} catch/);
  assert.match(fonte, /try \{ const g = JSON\.parse\(localStorage\.getItem\(chave\) \|\| 'null'\);[^\n]*\} catch/);
  assert.match(fonte, /try \{ localStorage\.removeItem\(chavePalco\(\)\); \} catch/);
  assert.match(fonte, /palcoTopo\.addEventListener\('dblclick', \(ev\) => \{ if \(!ev\.target\.closest\('button'\)\) palcoVoltarAoCanto\(\); \}\);/);
  assert.match(fonte, /addEventListener\('resize', \(\) => \{ cancelAnimationFrame\(quadroPalco\); quadroPalco = requestAnimationFrame\(\(\) => palcoReencaixar\(true\)\); \}\)/);
  assert.match(fonte, /palco\.classList\.toggle\('com-video', originais\.length > 0\);\r?\n    palcoReencaixar\(\);/);
});

test('arrastar não dispara os botões; pointer events com captura; alça e tela cheia', () => {
  assert.match(fonte, /palcoTopo\.addEventListener\('pointerdown', \(ev\) => \{\r?\n    if \(ev\.button !== 0 \|\| ev\.target\.closest\('button'\) \|\| document\.fullscreenElement === palco\) return;/);
  assert.match(fonte, /alvo\.setPointerCapture\?\.\(ev\.pointerId\)/);
  assert.match(fonte, /palcoAlca\.className = 'vv-palco-alca'/);
  assert.match(fonte, /'fullscreenchange'/);
  // os botões de sempre continuam no topo
  for (const b of ['parar', 'cheia', 'min']) assert.match(fonte, new RegExp(`data-palco="${b}"`));
});

test('CSS: só tokens --d3-*, sem !important, sem html body.mundo e sem :has; a junção leva o fragmento', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\(/);
  const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.ok(vars.length && vars.every((v) => v.startsWith('--d3-')), vars.join(','));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'cor só por token');
  assert.match(css, /\.vv-palco-alca\{[^}]*cursor:nwse-resize[^}]*touch-action:none/);
  assert.match(css, /\.vv-palco-topo\{[^}]*touch-action:none/);
  assert.ok(junto.includes('/* ===== padrao-v2/d3-palco.css ===== */'));
});
