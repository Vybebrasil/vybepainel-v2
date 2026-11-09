// HUD das salas no Irecity (Paulo, 09/11/2026: "muito ruim o HUD que abre das salas... quem tá online e controles").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');
const trecho = js.slice(js.indexOf('  function pintarChamada()'), js.indexOf("  barra.addEventListener?.('click'"));

test('barra das salas: só as salas; os controles da chamada no dock (Ouvir, Câmera, Tela, Áudio, TV); nenhuma peça antiga', () => {
  for (const acao of ['ouvir', 'camera', 'tela', 'audio', 'tv']) assert.ok(js.includes(`acao: '${acao}'`), acao + ' no dock');
  for (const peca of ["botao('camera'", "botao('tela'", "botao('ajustes'", 'vz-controles', 'vz-chip']) assert.ok(!trecho.includes(peca), peca + ' saiu do painel');
  assert.doesNotMatch(trecho, /[⏮⏭⏸▶🔇🔈♪]/u, 'música sem emoji');
  assert.doesNotMatch(trecho, /class="vv-botao|vv-chamar|vv-voz-sala|vv-voz-pessoa|class="vv-musica/, 'nada da barra antiga');
  // o que está no dock fixo não se repete no painel (Paulo, 09/11/2026: "pensa se faz sentido os botões")
  for (const peca of ['class="vz-sair"', 'class="vz-mic ', 'class="vz-entrar"', "botao('musica'", '${musicaHtml(e, temSom)}']) assert.ok(!trecho.includes(peca), `${peca}: microfone, Entrar, Sair e Música ficam só no dock`);
  assert.match(js, /pausada: 'Entrar na chamada', fora: 'Entrar na chamada'/, 'topo laranja diz onde entra');
  assert.match(js, /mr\.textContent = mic \? 'Ligado' : 'Mudo';/, 'microfone do topo com nome');
});

test('quem está online: salas com gente primeiro, depois todas as vazias; Chamar alguém recolhido e lembrado entre redesenhos', () => {
  assert.ok(trecho.includes('<div class="vz-rotulo">Vazias agora · '), 'as vazias aparecem abertas (Paulo: mostra as salas, toda)');
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
