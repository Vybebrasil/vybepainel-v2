// HUD das salas no Irecity (Paulo, 09/11/2026: "muito ruim o HUD que abre das salas... quem tá online e controles").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');
const trecho = js.slice(js.indexOf('  function pintarChamada()'), js.indexOf("  barra.addEventListener?.('click'"));

test('barra das salas: controles com nome, ícones desenhados e nenhuma peça antiga', () => {
  for (const [id, nome] of [['mic', "'Ligado' : 'Mudo'"], ['camera', "'Câmera'"], ['tela', "'Tela'"], ['musica', "'Música'"], ['tv', "'TV'"], ['ajustes', "'Áudio'"]]) {
    assert.match(trecho, new RegExp(`botao\\('${id}', [^\\n]*${nome.replace(/[()]/g, '\\$&')}`), id);
  }
  assert.doesNotMatch(trecho, /[⏮⏭⏸▶🔇🔈♪]/u, 'música sem emoji');
  assert.doesNotMatch(trecho, /class="vv-botao|vv-chamar|vv-voz-sala|vv-voz-pessoa|class="vv-musica/, 'nada da barra antiga');
  assert.match(trecho, /class="vz-sair" data-chamada="sair"/);
});

test('quem está online: salas com gente primeiro; vazias e "Chamar alguém" recolhidos e lembrados entre redesenhos', () => {
  assert.match(trecho, /<details class="vz-recolhe" data-k="vazias">/);
  assert.match(trecho, /<details class="vz-recolhe" data-k="chamar"><summary>Chamar alguém/);
  assert.match(trecho, /details\[open\]\[data-k\]/);
  assert.match(trecho, /setAttribute\('open', ''\)/);
});

test('CSS: uma coluna que não quebra (a lista não pula para o lado) e as regras antigas da barra saíram', () => {
  assert.match(css, /html body\.mundo \.vv-chamada\{display:flex;flex-direction:column;flex-wrap:nowrap;/);
  assert.match(css, /html body\.mundo \.vv-chamada > :not\(\.vz-salas\)\{flex-shrink:0\}/);
  assert.doesNotMatch(css, /\.vv-chamada \.vv-botao|\.vv-chamada \.gente|\.vv-chamada \.acoes|\.vv-voz-sala|\.vv-chamar\b|\.vv-chamada \.vv-musica/);
  const bloco = css.slice(css.indexOf('/* ===== HUD das salas'));
  assert.doesNotMatch(bloco, /!important/, 'bloco novo sem !important');
});
