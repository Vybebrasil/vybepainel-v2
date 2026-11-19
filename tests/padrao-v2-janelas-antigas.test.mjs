// Confere das telas antigas (18/11/2026): as janelas dos portões (#workflow-modal) e os menus da linha (.status-editor)
// saem da Direção 3 e entram na linha V2 (folha e vidro fumê, tokens --d3-*, botão de 34 com canto 8, um laranja só).
// SAFE: só lê arquivos e roda a função pura janelaV2DoPortao num vm; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const fragmentos = ['padrao-v2/zm-h-1-janelas.css', 'padrao-v2/zm-h-2-menus.css', 'padrao-v2/zm-h-3-gaveta.css', 'padrao-v2/zm-h-4-cadastro.css'];

test('fragmentos do grupo H: sem !important, sem html body.mundo, sem :has com [style], sem cor escrita', () => {
  for (const f of fragmentos) {
    const css = ler(f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /!important/, f);
    assert.doesNotMatch(css, /html body\.mundo/, f);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${f}: cor escrita em vez de token`);
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /text-transform:uppercase/, f);
  }
});

test('a junção leva os dois fragmentos para vybe-mundo-padrao-v2.css', () => {
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) assert.ok(junto.includes(`/* ===== ${f} ===== */`), f);
});

test('janelas dos portões: botão de 34 com canto 8, laranja só na ação principal, etapas sem pílula preta', () => {
  const css = ler('padrao-v2/zm-h-1-janelas.css');
  assert.match(css, /\.pt-btn\{height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  assert.match(css, /\.pt-btn\.k\{background:var\(--d3-acao\)/);
  assert.match(css, /\.pt-etp > span\.atual\{padding:0;border-radius:0;background:none/);
  // a sobra do tema escuro (texto branco no resumo da direção) passa a usar a tinta
  assert.match(css, /\.direcao-resumo b\{color:var\(--d3-tinta\)/);
});

test('casca antiga com !important agora usa tokens (o número de !important não sobe)', () => {
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /:not\(\.ofc-menu-jogo\)\{\r?\n  background:var\(--d3-cartao\)!important;[^}]*border-radius:var\(--d3-r-janela\)!important/);
  assert.match(mundo, /\.workflow-title\{color:var\(--d3-tinta\)!important;font:600 var\(--d3-fs-titulo\)/);
  assert.match(mundo, /\.workflow-primary\{background:var\(--d3-acao\)!important/);
  assert.match(mundo, /html body\.mundo \.status-editor:not\(#vv-x\)\{background:var\(--d3-fume-painel\)!important/);
  assert.doesNotMatch(mundo, /\.workflow-title\{color:#1F1D1A!important;font:800 26px/);
});

test('menus da linha: vidro fumê com os tokens da folha trocados pelos do vidro e o Salvar no laranja', () => {
  const css = ler('padrao-v2/zm-h-2-menus.css');
  assert.match(css, /--d3-tinta:var\(--d3-fume-texto\)/);
  assert.match(css, /\.v2-st-pilula::before[^{]*\{content:"";[^}]*background:var\(--c,var\(--d3-fume-apagado\)\)/);
  assert.match(css, /#dono-editor\.status-editor\{--ds-acao:var\(--d3-acao\)/);
});

test('janelaV2DoPortao: só a janela com o cartão da peça escurece junto no tema Escuro', () => {
  const fonte = ler('vybe-portoes.js');
  const a = fonte.indexOf('function janelaV2DoPortao'); assert.ok(a >= 0);
  const ctx = {}; vm.runInNewContext(fonte.slice(a, fonte.indexOf('\n', a)), ctx);
  assert.equal(ctx.janelaV2DoPortao('<div class="workflow-item"><span>x</span></div>'), true);
  assert.equal(ctx.janelaV2DoPortao('<div class="workflow-kicker">Ficha do móvel</div>'), false);
  assert.equal(ctx.janelaV2DoPortao(undefined), false);
  assert.match(fonte, /modal\.innerHTML=html; if\(janelaV2DoPortao\(html\)\) modal\.classList\.add\('d3-tema'\);/);
});

test('gaveta da peça na linha V2: abas sem preto, botões de 34 com canto 8, laranja só no botão que leva adiante', () => {
  const css = ler('padrao-v2/zm-h-3-gaveta.css');
  assert.ok(css.includes('.gv2-aba[aria-checked="true"]{background:var(--d3-cartao)'));
  assert.ok(css.includes('.gv2-pe .gv2-btn{height:34px;padding:0 14px;border-radius:var(--d3-r-botao)'));
  assert.match(css, /\.gv2-avancar\{[^}]*background:var\(--d3-acao\)/);
  assert.ok(css.includes('.gv2-obj-grupo > .gv2-sub{display:inline;order:-1'));
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /#workspace-drawer button:not\(\.workspace-action\)[^{]*\{background:var\(--d3-veu\)!important/);
  assert.ok(ler('vybe-gaveta.js').includes('<span class="gv2-rot-campo" aria-hidden="true">Status</span>${pillHtmlDemanda'));
});

test('nova demanda e novo conteúdo: fichas e botões com canto 8, escolhido em tinta, Continuar no laranja', () => {
  const css = ler('padrao-v2/zm-h-4-cadastro.css');
  assert.ok(css.includes('.nd .nd-chip{height:28px;padding:0 10px;border-radius:var(--d3-r-botao)'));
  assert.ok(css.includes('.nd .nd-chip.on{background:var(--d3-tinta);color:var(--d3-contra)}'));
  assert.ok(css.includes('.nd .nd-btn.k{background:var(--d3-acao)'));
  assert.ok(ler('vybe-mundo.css').includes('.fc-modal :is(.fc-primary,.fc-continuar,button.principal):not(#vv-x){background:var(--d3-acao)!important'));
});
