// A camada do Feed (Paulo, 15/11/2026: "quando clicar em feed vem um hover pra frente, tela cheia por cima... a troca
// tá dura, amador; deixa fluida" e "escurece o que não for o principal"): o Feed abre por cima de tudo, os celulares
// ficam montados e só deslizam, cada um rola por dentro, e o Esc fecha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('a distância até a frente é em círculo e sem repetir lado', () => {
  const c = vm.createContext({ console, localStorage: { getItem: () => null, setItem() {} } });
  vm.runInContext(ler('vybe-feed.js'), c);
  const d = (j, i, n) => vm.runInContext(`feedDistancia(${j}, ${i}, ${n})`, c);
  assert.equal(d(0, 0, 15), 0);
  assert.equal(d(1, 0, 15), 1);
  assert.equal(d(14, 0, 15), -1, 'o último fica à esquerda do primeiro');
  assert.equal(d(7, 0, 15), 7);
  assert.equal(d(8, 0, 15), -7);
  assert.equal(d(1, 0, 2), 1);
  assert.equal(d(0, 0, 1), 0);
});

test('o Feed abre numa camada por cima de tudo e o quadro antigo do Painel fica vazio', () => {
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("c.id = 'vfd-camada'; c.className = 'vfd-camada';"));
  assert.ok(src.includes("if (wrap) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); }"));
  assert.ok(src.includes("document.body.classList.add('vfd-aberto');"));
  const css = ler('padrao-v2/feed.css');
  // Abaixo do menu e da barra do Vybe OS (camada 700) e encaixada na moldura do módulo (Paulo, 15/11/2026: "parece que
  // tô saindo do sistema").
  assert.match(css, /\.vfd-camada\{[^}]*position:fixed;inset:0;z-index:690;/);
  assert.ok(src.includes("const m = document.getElementById('mundo-moldura'), r = m?.getBoundingClientRect();"));
  // O cartão rápido e o cadastro, que abrem da camada, sobem junto.
  assert.match(css, /body\.vfd-aberto \.cartao-rapido\{z-index:742\}/);
  assert.match(css, /body\.vfd-aberto \.fc-overlay\{z-index:743\}/);
});

test('trocar de cliente só muda a posição dos celulares, sem refazer o conteúdo igual', () => {
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("cel.style.setProperty('--d', String(d)); cel.style.setProperty('--ad', String(ad)); cel.dataset.ad = String(Math.min(ad, 4));"));
  assert.ok(src.includes("if (cel.vfdHtml !== html) { cel.querySelector('.vfd-cel-rola').innerHTML = html; cel.vfdHtml = html; }"));
  const css = ler('padrao-v2/feed.css');
  assert.match(css, /transition:transform \.7s cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(css, /\.vfd-cel-rola\{height:100%;overflow-y:auto;overscroll-behavior:contain/);
  // Só o do meio claro: os vizinhos escurecem com a distância.
  assert.match(css, /\.vfd-cel\[data-ad="1"\]\{filter:brightness\(\.42\)/);
  assert.match(css, /\.vfd-cel\[data-ad="3"\],\.vfd-cel\[data-ad="4"\]\{filter:brightness\(\.22\)/);
  // Margem: os celulares não encostam no topo nem na doca.
  assert.match(css, /top:max\(28px,calc\(50% - 400px\)\);bottom:max\(28px,calc\(50% - 400px\)\)/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /:[^;{}]*#[0-9a-fA-F]{3,8}\b|!important/);
});

test('teclado, trackpad e Esc: as setas trocam, dois dedos trocam, Esc fecha (na subida da tecla)', () => {
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("window.addEventListener('keyup', (e) => {"));
  assert.ok(src.includes("if (e.key !== 'Escape' || !feedAberto || !camada.isConnected || algoPorCima()) return;"));
  assert.ok(src.includes("camada.addEventListener('wheel', (e) => {"));
  assert.ok(src.includes("feedPasso(e.key === 'ArrowRight' ? 1 : -1);"));
});
