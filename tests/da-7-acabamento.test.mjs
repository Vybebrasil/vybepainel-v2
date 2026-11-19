// Correções do confere de diretor de arte, frente da-7 (19/11/2026): acabamento do que as frentes da-1 a da-5 deixaram.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sem = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const da7 = sem(readFileSync('padrao-v2/da-7.css', 'utf8'));

test('o fragmento da-7 não usa !important, html body.mundo nem :has com [style]', () => {
  assert.doesNotMatch(da7, /!important/);
  assert.doesNotMatch(da7, /html\s+body\.mundo/);
  assert.doesNotMatch(da7, /:has\([^)]*\[style/);
});

test('as telas do Escritório no tablet terminam acima do dock (um pé só, --vv-pe-janela)', () => {
  assert.match(da7, /--vv-pe-janela:max\(76px,calc\(var\(--vv-dock-alto,0px\) \+ var\(--vv-m,8px\) \+ 6px\)\)/);
  for (const f of ['d3-hoje', 'zm-f-centro', 'zm-f-jogos', 'zm-f-loja', 'zm-f-ranking', 'zm-f-sala', 'zm-g-equipe']) {
    const css = sem(readFileSync(`padrao-v2/${f}.css`, 'utf8'));
    assert.doesNotMatch(css, /bottom:76px/, f);
    assert.match(css, /bottom:var\(--vv-pe-janela,76px\)/, f);
  }
});

test('a placa antiga do elevador sai do Prédio também até 900 (a folha do elevador é a lista)', () => {
  assert.match(da7, /@media \(max-width:900px\)\{\s*body\.mundo\.mundo-centro\.mundo-predio\.d3c-painel:not\(\.mundo-modulo\) #mundo-hud > #vv-placa:has\(> \.vv-elevador-lista\):not\(#v2-da7\)\{display:none\}/);
});

test('o chip do mapa cabe no cartão e quebra em vez de sair dele', () => {
  const campos = sem(readFileSync('padrao-v2/da-campos.css', 'utf8'));
  const r = campos.match(/\.d3c-chips\.d3m-f-chips > \.d3m-f-chip:is\(\.d3m-f-chip,#vv-h\)\{([^}]*)\}/);
  assert.ok(r, 'regra do chip do mapa');
  assert.match(r[1], /min-height:28px/);
  assert.match(r[1], /max-width:100%/);
  assert.match(r[1], /white-space:normal/);
});

test('Agenda, pílula das Finanças, barra do topo e Toolkit na régua', () => {
  assert.match(da7, /\.agv2-tela\.agv2-tela\{margin-left:-14px;margin-right:-14px\}/);
  assert.match(da7, /\.d3f-tit > \.fv2-pill\.fv2-pill\{height:24px/);
  assert.match(da7, /@media \(min-width:901px\) and \(max-width:1180px\)\{[\s\S]*?\{height:34px;min-height:34px;border-radius:var\(--d3-r-botao\)\}/);
  assert.match(da7, /\.vf-corpo\.d3m-e-corpo\.d3m-e-corpo\{grid-template-columns:minmax\(0,1fr\);flex:none\}/);
});

test('as prévias de peça do Feed e do Conteúdo saem com width e height', () => {
  const feed = readFileSync('vybe-feed.js', 'utf8');
  const cont = readFileSync('vybe-mundo-conteudo.js', 'utf8');
  for (const [nome, js] of [['feed', feed], ['conteudo', cont]]) {
    const imgs = js.match(/<img [^>]*>/g) || [];
    assert.ok(imgs.length >= 4, nome);
    for (const i of imgs) assert.match(i, /width="\d+" height="\d+"/, `${nome}: ${i.slice(0, 80)}`);
  }
});
