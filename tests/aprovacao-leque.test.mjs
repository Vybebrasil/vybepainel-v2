// O leque da Aprovação de conteúdo (Paulo, 15/11/2026: "melhora a forma de mostrar os conteúdos para aprovar...
// quero foda assim também", com o card fan de referência): as artes da fila abertas como cartas na mão, a da vez no
// meio; passar de peça só troca as posições, sem refazer a tela; os portões de Aprovar e Pedir alteração não mudam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('o baralho de aprovação ganha o leque das artes ao lado da carta de informações', () => {
  const js = ler('vybe-mundo-conteudo.js');
  assert.ok(js.includes('<div class="d3a-palco"><div class="d3a-leque">${fila.map(lequeHtml).join(\'\')}</div><div class="v2-baralho vc-apr-baralho" aria-live="polite">${fila.map(cartaHtml).join(\'\')}</div></div>'));
  // Cada arte sabe a distância até a da vez (--lp) e some depois de 3 para cada lado.
  assert.ok(js.includes('style="--lp:${d};--alp:${a}"${a > LEQUE_LADO ? \' hidden\' : \'\'}'));
  // Passar de peça gira o leque no lugar (sem pintar a tela de novo) e clicar numa arte vai até ela.
  assert.ok(js.includes("c.style.setProperty('--lp', d); c.style.setProperty('--alp', a); c.hidden = a > LEQUE_LADO; c.classList.toggle('vez', d === 0);"));
  assert.ok(js.includes('if (t.dataset.vcLeque !== undefined) { st.lote = []; return passar(Number(t.dataset.vcLeque)); }'));
  // As decisões continuam pelos portões de sempre.
  assert.match(js, /d\.portao\(d\.item, d\.opcao\);/);
});

test('o leque gira com mola, respeita quem pede menos movimento e só usa tokens', () => {
  const css = ler('padrao-v2/d3-producao.css');
  const bloco = css.slice(css.indexOf('/* O leque da aprovação'));
  assert.match(bloco, /rotate\(calc\(var\(--lp\) \* 9deg\)\)/);
  assert.match(bloco, /transition:transform \.6s cubic-bezier\(\.34,1\.45,\.64,1\)/);
  assert.match(bloco, /@media \(prefers-reduced-motion:reduce\)\{#vv-conteudo\.vc\.vc \.d3a-leque-c\{transition:none\}\}/);
  assert.match(bloco, /#vv-conteudo\.vc\.vc \.d3a-palco \.d3a-arte-caixa\{display:none\}/, 'a arte não se repete na carta de informações');
  assert.doesNotMatch(bloco.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|!important/);
});
