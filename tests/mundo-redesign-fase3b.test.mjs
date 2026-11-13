// Redesign, fase 3b (Paulo, 10/11/2026: "executa tudo"): o HUD do mundo, sem tirar informação da tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('vybe-mundo.css'), js = ler('vybe-mundo.js'), esc = ler('vybe-escritorio.js');

test('Cidade: legenda conta os clientes do mapa pela situação, só na vista da Cidade', () => {
  // Padrão v2 (quadro "Centro"): a legenda virou a barra Vybelândia, com as mesmas três contagens, que ficam à vista
  // também com a loja aberta (a barra do quadro não some).
  assert.match(js, /function pintarLegendaCidade\(lista, sel = ''\) \{/);
  assert.match(js, /pintarLegendaCidade\(lista\);/);
  assert.match(js, /const grupoDaCidade = \(c\) => \(c\.situacao === 'atrasada' \? 'atraso' : \['aprovar', 'ajuste', 'hoje', 'briefing'\]\.includes\(c\.situacao\) \? 'atencao' : 'dia'\);/);
  assert.match(css, /#mundo-hud \.vv-legenda-cidade\.v2m-barra\{position:absolute/);
});

test('Prédio: número do andar neutro, nome inteiro, situação num ponto e aviso discreto', () => {
  assert.match(css, /\.vv-elevador \.num\{[^}]*color:var\(--vv-tinta\);background:#F1ECE4;box-shadow:inset 0 -2px 0 var\(--c\)\}/);
  assert.match(css, /\.vv-elevador \.sit\{flex:none;width:8px;height:8px;border-radius:50%;background:var\(--s\)\}/);
  assert.doesNotMatch(css, /\.vv-elevador-lista \.vv-elevador \.meio b\{[^}]*text-overflow:ellipsis/);
  assert.match(css, /\.vv-elevador-aviso\.off\{color:var\(--vv-apagado\)\}/);
});

test('TV: o player fica (o clipe que está passando e quem pôs); Desligar é o perigoso do padrão', () => {
  assert.ok(esc.includes('const idPassando = '), 'lê o vídeo que está passando');
  assert.match(esc, /Passando agora\$\{quemPassou \? " · posto por " \+ safeText\(quemPassou\) : ""\}/);
  assert.match(esc, /\$\{telaHtml\}\r?\n<div class="ofc-tv-opcoes vb-alternar"/);
  assert.match(css, /body\.mundo \.ofc-tv-desligar\{[^}]*border:1px solid #F6BBC4;[^}]*color:#B42318/);
  assert.match(css, /body\.mundo \.ofc-tv-opcao\.on\{background:var\(--ds-on-fundo\)/);
});

test('Música fora de uma sala com som: um caminho (Entrar no Lounge), não só o aviso', () => {
  // Desde a frente topo (quadros 44/45) o caminho vai no aviso curto de sempre; ver tests/redesign-topo.test.mjs.
  assert.match(js, /function musicaForaDaSala\(\) \{/);
  assert.match(js, /musicaForaDaSala\(b\);/);
  assert.match(js, /irParaSala\('lounge'\)/);
});
