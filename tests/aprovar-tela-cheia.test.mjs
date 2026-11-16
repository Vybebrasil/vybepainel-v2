// Aprovar em tela cheia (Paulo, 15/11/2026: "olha a diferença... tá zoando?", com os painéis de vidro de referência, e
// "do lado a copy certinha como ia ficar no Insta, quem fez, as infos"): a arte vira o fundo, o cartão de vidro com a
// arte e a copy, quem fez e os detalhes ao lado; as decisões passam pelos portões de sempre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('a tela cheia mostra a copy como no Instagram, quem fez e os detalhes; os portões decidem', () => {
  const js = ler('vybe-mundo-conteudo.js');
  assert.ok(js.includes("el.id = 'vc-imersao'; el.className = 'vc-im';"));
  assert.ok(js.includes('<section class="vc-im-ig" aria-label="Como fica no Instagram">'));
  assert.ok(js.includes('<section class="vc-im-vidro vc-im-quem" aria-label="Quem fez">'));
  assert.ok(js.includes('<section class="vc-im-vidro vc-im-det" aria-label="Detalhes">'));
  // Decidir passa pelo decidir() de sempre e a tela cheia se recolhe enquanto o portão está aberto.
  assert.ok(js.includes("el.classList.add('vc-im-pausa');\n    decidir(acao);") || js.includes("el.classList.add('vc-im-pausa');\r\n    decidir(acao);"));
  // Setas e Esc são da tela cheia quando ela está aberta; a arte da vez no leque abre a tela cheia.
  assert.ok(js.includes("if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return imerFechar(); }"));
  assert.ok(js.includes('if (Number(t.dataset.vcLeque) === st.apr) return imerAbrir();'));
});

test('o fundo é a arte desfocada, o laranja é o Aprovar, nada começa transparente e só tokens', () => {
  const css = ler('padrao-v2/aprovar-tela-cheia.css');
  assert.match(css, /\.vc-im-fundo\{[^}]*background-image:var\(--arte\)[^}]*filter:blur\(60px\)/);
  // Dentro da janela da Aprovação (o menu e a barra do Vybe OS seguem à vista).
  assert.match(css, /\.vc-im\{[^}]*position:absolute;inset:0;z-index:30;/);
  assert.match(css, /\.vc-im-btn\.k\{background:var\(--d3-acao\)/);
  assert.match(css, /@keyframes vc-im-vem-dir\{from\{opacity:\.35;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|!important/);
});
