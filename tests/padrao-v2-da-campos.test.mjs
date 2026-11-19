// Correções do confere de diretor de arte, frente da-2 (19/11/2026): a peça de campo e controle em padrao-v2/da-campos.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('padrao-v2/da-campos.css', 'utf8');
const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('a peça de campo não usa !important, html body.mundo nem :has com [style]', () => {
  assert.doesNotMatch(semComentarios, /!important/);
  assert.doesNotMatch(semComentarios, /html\s+body\.mundo/);
  assert.doesNotMatch(semComentarios, /:has\([^)]*\[style/);
});

test('o campo lê as variáveis da regra antiga: fundo, contorno ≥3:1 na letra da superfície, canto 8 e foco sem laranja', () => {
  const regra = semComentarios.match(/:where\(body\.mundo\) :where\(input\[type="text"\][^{]*\{([^}]*)\}/);
  assert.ok(regra, 'regra das variáveis do campo');
  assert.match(regra[1], /--d3-cartao:transparent/);
  assert.match(regra[1], /--ds-linha:color-mix\(in srgb,currentColor 68%,transparent\)/);
  assert.match(regra[1], /--d3-tinta:currentColor/);
  assert.match(regra[1], /--ds-r-botao:var\(--d3-r-botao\)/);
  assert.match(regra[1], /--ds-foco:0 0 0 1px currentColor/);
});

test('Conversas e Conta (frente da-3) e o modal antigo ficam fora da peça', () => {
  for (const fora of ['#vv-whatsapp *', '.d3m-e-conta *', '.workflow-modal *']) assert.ok(semComentarios.includes(fora), fora);
});

test('chips passam a 28 com canto 8 e segmentados a 28 na moldura de 34', () => {
  assert.match(semComentarios, /\.cv2-chip:is\(\.cv2-chip,#vv-h\)[\s\S]*?\{height:28px;border-radius:var\(--d3-r-botao\)\}/);
  assert.match(semComentarios, /\.d3m-d-seg:is\(\.d3m-d-seg,#vv-h\) > button,[\s\S]*?\{height:28px\}/);
  assert.doesNotMatch(semComentarios, /vst-dia/, 'a régua .vst-dia é da frente da-4');
});

test('o fragmento entra no CSS gerado', () => {
  const gerado = readFileSync('vybe-mundo-padrao-v2.css', 'utf8');
  assert.ok(gerado.includes('/* ===== padrao-v2/da-campos.css ===== */'));
});
