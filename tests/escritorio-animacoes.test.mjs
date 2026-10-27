import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Botão de desligar as animações do Escritório (Paulo, 27/10/2026: "tá tudo
// meio travando"): com elas desligadas o mapa não redesenha móveis e o CSS
// termina os laços na hora.
const tela = readFileSync('vybe-escritorio.js', 'utf8');
const mapa = readFileSync('vybe-escritorio-mapa.js', 'utf8');
const css = readFileSync('vybe-styles.css', 'utf8');

test('a barra do Escritório tem o botão de ligar e desligar as animações', () => {
  assert.match(tela, /rail\("animacoes", "tocar", "Ligar animações", "alternarAnimacoesEscritorio\(\)"/);
  assert.match(tela, /rail\("animacoes", "pausa", "Desligar animações", "alternarAnimacoesEscritorio\(\)"/);
});
test('a escolha fica guardada e, sem escolha, vale o Reduzir movimento da Aparência', () => {
  assert.match(tela, /localStorage\.setItem\(ESCRITORIO_CHAVE_ANIMACOES, desligar \? "off" : "on"\)/);
  assert.match(tela, /escolha \? escolha === "off" : document\.body\?\.dataset\?\.motion === "reduce"/);
  assert.match(tela, /async function abrirEscritorio\(\) \{\s*aplicarAnimacoesEscritorio\(\);/);
});
test('desligadas, o mapa não troca quadro de móvel parado nem pisca bonecos', () => {
  assert.match(mapa, /if \(\(leve \|\| item\.foraDaTela\) && !item\.transicao\) continue;/);
  assert.match(mapa, /if \(leve && p\.acao !== "wlk"\) continue;/);
});
test('desligadas, as animações de CSS acabam na hora em vez de pausar no primeiro quadro', () => {
  assert.match(css, /html\.vb-sem-animacao \*[^{]*\{animation-duration:\.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important/);
});
