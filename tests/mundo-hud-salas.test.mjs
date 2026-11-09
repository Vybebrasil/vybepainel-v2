// HUD das salas no Irecity (Paulo, 09/11/2026: "muito ruim o HUD que abre das salas... quem tá online e controles").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');
const trecho = js.slice(js.indexOf('  function pintarChamada()'), js.indexOf("  barra.addEventListener?.('click'"));

test('barra das salas: controles com nome, ícones desenhados e nenhuma peça antiga', () => {
  for (const [id, nome] of [['camera', "'Câmera'"], ['tela', "'Tela'"], ['musica', "'Música'"], ['tv', "'TV'"], ['ajustes', "'Áudio'"]]) {
    assert.match(trecho, new RegExp(`botao\\('${id}', [^\\n]*${nome.replace(/[()]/g, '\\$&')}`), id);
  }
  assert.doesNotMatch(trecho, /[⏮⏭⏸▶🔇🔈♪]/u, 'música sem emoji');
  assert.doesNotMatch(trecho, /class="vv-botao|vv-chamar|vv-voz-sala|vv-voz-pessoa|class="vv-musica/, 'nada da barra antiga');
  assert.match(trecho, /class="vz-sair" data-chamada="sair"/);
  assert.ok(trecho.includes(`class="vz-mic \${mic ? 'on' : 'mudo'}" data-chamada="mic"`), 'microfone grande na chamada');
  assert.ok(trecho.includes("'Você está mudo'") && trecho.includes("'Ninguém te ouve. Toque para falar.'"), 'mudo escrito');
  assert.match(js, /pausada: 'Entrar na chamada', fora: 'Entrar na chamada'/, 'topo laranja diz onde entra');
  assert.match(js, /mr\.textContent = mic \? 'Ligado' : 'Mudo';/, 'microfone do topo com nome');
  assert.match(trecho, /class="vz-entrar" data-chamada="entrar-voz"/, 'Entrar na chamada grande fora dela');
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
  const ini = css.indexOf('/* ===== HUD das salas'), fim = css.indexOf('/* =====', ini + 10);
  const bloco = css.slice(ini, fim > ini ? fim : undefined);
  assert.doesNotMatch(bloco, /!important/, 'bloco novo sem !important');
});

test('quem entra no painel já entra na própria sala (uma vez, sem abrir o andar) e na chamada dela, mudo', () => {
  assert.match(trecho, /if \(!pintarChamada\.naMinha\) \{\n\s*const s = minhaSalaDaConta\(\);/);
  assert.match(trecho, /if \(e\.zona !== s\) \{ moverParaSala\(s\);/);
  assert.doesNotMatch(trecho.slice(trecho.indexOf('pintarChamada.naMinha'), trecho.indexOf("const canal = fn('escritorioCanal')")), /focarSalaDaChamada|abrirAndarVoxel/, 'sem levar a pessoa para o 3D');
  assert.match(js, /if \(e\.microfoneQuer === undefined\) e\.microfoneQuer = false;/, 'entra mudo');
});
