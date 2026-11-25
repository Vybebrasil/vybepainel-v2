// Frente s-x (Paulo, 25/11/2026: "Sim, ataca"): os 3 pontos de responsividade que ficaram de fora do s-w (PR #778).
// Trava cada um: (1) a Loja (com Inventário, Carteira e Conquistas) abre como janela, não como modal, e os botões do topo
// ficam por cima e clicáveis; (2) a Visão geral do setor Clientes no celular com o essencial primeiro e o resto em
// linhas que abrem; (3) entre 601 e 1100 px, nenhum rótulo cortado: o menu manda o que não cabe para um "Mais" e o dock
// vira uma linha só de ícones. SAFE: só lê o código.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lf = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const css = lf('padrao-v2/s-x.css');
const junto = lf('vybe-mundo-padrao-v2.css');
const mundo = lf('vybe-mundo.js'), editor = lf('vybe-escritorio-editor.js'), tutorial = lf('vybe-mundo-tutorial.js');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, de); const j = texto.indexOf(ate, i); assert.ok(j > i, ate); return texto.slice(i, j); };

test('s-x.css entra no CSS juntado, sem !important, sem :has, sem html body.mundo e sem cor solta', () => {
  assert.ok(junto.includes(css.trim()), 'rode node scripts/padrao-v2-juntar.mjs');
  const sem = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sem, /!important/);
  assert.doesNotMatch(sem, /:has\(/);
  assert.doesNotMatch(sem, /html\s+body/);
  for (const cor of sem.match(/#[0-9a-f]{3,8}\b(?![\w-])|rgba?\(|hsla?\(/gi) || []) assert.fail('cor solta fora dos tokens --d3-*: ' + cor);
});

test('1 · Loja, Inventário, Carteira e Conquistas: janela sem modal no mundo, topo por cima e clicável', () => {
  const abrir = trecho(editor, 'function escritorioAbrirJanelaSemModal(d, classeBody)', '\nfunction abrirCatalogoEscritorio(');
  // fora do mundo (?legado=1) segue modal; no mundo, show()
  assert.match(abrir, /if \(!document\.body\.classList\.contains\("mundo"\)\) \{ d\.showModal\(\); return; \}/);
  assert.match(abrir, /document\.body\.classList\.add\(classeBody\);\n  d\.show\(\);/);
  // Esc e o X fecham, o Tab roda dentro, o foco volta, a classe sai ao fechar, o menu lateral fecha a janela
  assert.match(abrir, /ev\.key !== "Escape"[\s\S]*?d\.close\(\)/);
  assert.match(abrir, /ev\.key !== "Tab"[\s\S]*?ultimo\.focus\(\)[\s\S]*?f\[0\]\.focus\(\)/);
  assert.match(abrir, /d\.addEventListener\("close", \(\) => \{\n      document\.body\.classList\.remove\(d\.dataset\.semModal\);/);
  assert.match(abrir, /volta\.focus\?\.\(\)/);
  assert.match(abrir, /closest\?\.\("\.vv-trilho \[data-trilho\]"\)/);
  const cat = trecho(editor, 'function abrirCatalogoEscritorio(aba)', '\n}\n');
  assert.match(cat, /if \(!d\.open\) escritorioAbrirJanelaSemModal\(d, "com-loja-janela"\);/);
  assert.doesNotMatch(cat, /showModal/);
  // a camada: a janela em 841, a barra do topo (o HUD) em 842, sem fundo escurecido
  const p1 = trecho(css, '/* 1 ·', '/* 2 ·');
  assert.match(p1, /body\.mundo #office-catalogo\.d3m-f-lojaj\[data-sem-modal\]\[open\]\{z-index:841\}/);
  assert.match(p1, /body\.mundo\.com-loja-janela #mundo-hud\{z-index:842\}/);
  assert.match(p1, /body\.mundo\.com-loja-janela #mundo-hud > :is\(#vv-hoje,#vv-placa,#d3-centro,\.vv-controles\)\{visibility:hidden\}/);
  assert.match(p1, /\.vv-ferramentas > \*\{pointer-events:auto;margin-left:0\}/);
  // o cabeçalho da Loja reserva o lugar dos sete botões e desce as partes de linha quando não cabem
  assert.match(p1, /#office-catalogo\.d3m-f-lojaj \.d3m-f-loja > \.d3m-e-topo\{flex-wrap:wrap;row-gap:12px;padding-right:300px\}/);
  assert.match(p1, /> \.d3m-e-acoes\{flex:1 0 calc\(100% \+ 300px\);justify-content:flex-end;margin-right:-300px\}/);
});

test('2 · Celular: a Visão geral de Clientes com o essencial primeiro e o resto em linhas que abrem', () => {
  const js = trecho(mundo, '  function sxClientes(el) {', '\n  }\n');
  assert.match(js, /data-setor-ir="setor:clientes"\]\[aria-pressed="true"\]/);
  assert.match(js, /el\.classList\.toggle\('sx-cli', cli\)/);
  assert.match(js, /swDobrar\(el, '\.g2-duas > \.g2-mods', 'setor:clientes'\)/);
  assert.match(js, /swAbertas\.add\(k\); else swAbertas\.delete\(k\); swGuardar\(\)/);
  assert.match(js, /sum\.title = tudo; sum\.setAttribute\('aria-label', tudo\)/);
  assert.match(mundo, /swTres\(el\.querySelector\('\.vst-pede'\), '\.vst-rolo > \.vst-lin', 'setor:pede'\);\n    sxClientes\(el\);/);
  assert.match(mundo, /swDesfazer\(el\); el\.classList\?\.remove\?\.\('sx-cli'\); return; \}/);
  const p2 = trecho(css, '/* 2 ·', '/* 3 ·');
  assert.match(p2, /@media \(max-width:600px\)/);
  assert.match(p2, /\.sx-cli > \.g2-topo\{flex-direction:row;flex-wrap:wrap/);
  assert.match(p2, /\.sx-cli \.g2-tres\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(p2, /\.sx-cli details\.g2-mais > summary\{[^}]*height:44px;min-height:44px/);
  assert.match(p2, /\.sx-cli > \.g2-topo > \.g2-vaga\{display:none\}/);
});

test('3 · Tablet e telas estreitas: o menu manda o que não cabe para o "Mais" e o dock fica numa linha de ícones', () => {
  const caber = trecho(mundo, '  function sxTrilhoCaber() {', '\n  }\n');
  assert.match(caber, /matchMedia\('\(min-width:601px\)'\)\.matches && !dockLargo\(\)/);
  assert.match(caber, /\['criar', 'hoje'\]\.includes\(x\.dataset\.trilho\) && !x\.hasAttribute\('aria-current'\)/);
  assert.match(caber, /x\.classList\.add\('sx-fora'\)/);
  assert.match(mundo, /if \(x\.hasAttribute\('data-trilho-resto'\)\) out\.push\(\.\.\.tr\.querySelectorAll\(':scope > \.vv-trilho-resto\[data-trilho\]'\)\)/);
  // a folha do "Mais" chama o MESMO botão de antes
  assert.match(mundo, /const orig = itens\[Number\(b\.dataset\.sxOrig\)\]; fecharSxMais\(\); orig\?\.click\(\);/);
  // dock: compacto de 601 a 1100, a sala sem o nome se não couber (o nome vai para a dica) e o resto num "Mais"
  assert.match(mundo, /function sxFaixaCompacta\(\) \{ return typeof matchMedia === 'function' && matchMedia\('\(min-width:601px\) and \(max-width:1100px\)'\)\.matches; \}/);
  assert.match(mundo, /if \(r && r\.width && \(sxFaixaCompacta\(\) \|\| r\.right > innerWidth - 4/);
  assert.match(mundo, /faixaDock\.classList\.add\('sx-sem-nome'\)/);
  assert.match(mundo, /title="\$\{textoVoz\}\$\{dicaVoz \? ' · ' \+ esc\(dicaVoz\) : ''\}"/);
  const p3 = css.slice(css.indexOf('/* 3 ·'));
  assert.match(p3, /@media \(min-width:601px\) and \(max-width:900px\)\{[\s\S]*?\.vv-trilho > \.vv-trilho-btn > span\{max-width:none;overflow:visible;text-overflow:clip\}/);
  assert.match(p3, /@media \(min-width:601px\) and \(max-width:1100px\)\{\n  #vv-dock-salas-faixa\.dock-compacto > \.vq-dock\.vv-dock-salas\{flex-wrap:nowrap/);
  assert.match(p3, /#vv-dock-salas-faixa\.dock-compacto\.sx-sem-nome \.vq-dock \.vq-voz > span:not\(\.vq-rostos\)\{display:none\}/);
  assert.match(p3, /\.sx-fora,[\s\S]*?\{display:none\}/);
  // o tutorial acha o Centro mesmo quando ele foi para o "Mais"
  assert.match(tutorial, /alvo: \['\[data-trilho="centro"\]', '\.vv-trilho > \.sx-mais'\]/);
});
