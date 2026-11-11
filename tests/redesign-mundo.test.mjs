// Frente "mundo" do redesign (moodboard de 10/11/2026): quadros 32 (Cidade e HUD), 33 (Prédio), 43 (Camadas),
// 35 a 37 (Loja, Ranking e Conquistas em voxel) e Jogos/Equipe acima do dock das salas.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const trecho = (texto, de, ate) => { const i = texto.indexOf(de); assert.ok(i >= 0, `faltou ${de}`); return texto.slice(i, texto.indexOf(ate, i + de.length)); };

test('32 · o pino da Cidade diz a situação com o número, não ✓ nem +2 solto', () => {
  const centro = ler('mundo/centro.mjs');
  assert.doesNotMatch(centro, /title="Em dia">✓/);
  const fonte = trecho(centro, 'function fraseDoPino(c) {', '\n  function pinoHtml');
  const frase = vm.runInNewContext(`(${fonte.replace('function fraseDoPino', 'function')})`);
  assert.equal(frase({ por: { atrasada: 3, hoje: 1 }, total: 5 }), '3 atrasadas');
  assert.equal(frase({ por: { atrasada: 1 }, total: 1 }), '1 atrasada');
  assert.equal(frase({ por: { hoje: 2 }, total: 4 }), '2 vencem hoje');
  assert.equal(frase({ por: { hoje: 1 }, total: 4 }), '1 vence hoje');
  assert.equal(frase({ por: { aprovar: 2 }, total: 2 }), '2 para aprovar');
  assert.equal(frase({ por: { fazer: 3, concluida: 1 }, total: 4 }), '3 em aberto');
  assert.equal(frase({ por: { concluida: 2 }, total: 2 }), 'em dia');
  assert.equal(frase({ total: 0 }), 'em dia');
  // Cada status com a contagem continua na dica e no nome acessível do pino.
  assert.match(centro, /dica: `\$\{c\.nome\}: \$\{frase\}\. \$\{detalhe\}`/);
  const motor = ler('mundo/motor.mjs');
  assert.match(motor, /if \(dica\) \{ el\.title = dica; el\.setAttribute\('aria-label', dica\); \}/);
  assert.match(motor, /'clientes'\} aqui perto`/);
  assert.match(ler('vybe-mundo.css'), /\.mundo-rotulo\.rotulo-loja\[data-mais\]::after\{content:attr\(data-mais-texto\)/);
});

test('32 · Hoje mais estreito na Cidade e o topo começa depois dele, com a busca escrita quando cabe', () => {
  const css = ler('vybe-mundo.css');
  assert.match(css, /body\.mundo\.mundo-centro \.vv-hoje\{width:340px\}/);
  assert.match(css, /body\.mundo\.mundo-centro \.vv-topo\{left:max\(var\(--vv-m\),var\(--vv-livre-esq,0px\)\)\}/);
  assert.match(css, /@container \(min-width:760px\)\{\s*body\.mundo\.mundo-centro \.vv-barra-topo \.vv-busca-larga \.vv-busca-texto\{display:inline/);
  // A medida da área livre vale mesmo antes do mapa montar (senão o topo cobria as abas do Hoje).
  const ajuste = trecho(ler('vybe-mundo.js'), 'function ajustarAreaLivre() {', '\n  }\n');
  assert.doesNotMatch(ajuste, /if \(!mundo\) return/);
  assert.match(ajuste, /mundo\?\.areaLivre\(/);
});

test('33 e 43 · controles do mapa ficam no canto acima do dock; o balão das Camadas abre ao lado', () => {
  const css = ler('vybe-mundo.css');
  assert.doesNotMatch(css, /\.vv-controles\{right:calc\(var\(--vv-m\) \* 2 \+ 360px\)\}/);
  assert.match(css, /body\.mundo\.mundo-centro:has\(#vv-placa:not\(\[hidden\]\)\) \.vv-controles\{flex-direction:row\}/);
  assert.match(css, /body\.mundo\.mundo-centro:has\(#vv-placa:not\(\[hidden\]\) \.vv-camada\) \.vv-controles\{flex-direction:column\}/);
  assert.match(css, /body\.mundo\.mundo-centro \.vv-placa:not\(:has\(\.vv-camada\)\)\{max-height:calc\(/);
});

test('43 · a Prospecção é um interruptor; as etapas só aparecem com ela ligada', () => {
  const mundo = ler('vybe-mundo.js');
  const camadas = trecho(mundo, 'function mostrarCamadas() {', '\n  // Liga a prospecção');
  assert.match(camadas, /data-camada-pros/);
  assert.match(camadas, /class="vv-camada-filtros" role="group" aria-label="Etapa da prospecção"\$\{pros \? '' : ' hidden'\}/);
  assert.match(camadas, /FILTROS_PROS\.filter\(\(\[k\]\) => k !== 'nenhuma'\)/);
  const escolher = trecho(mundo, 'async function escolherProspeccao(filtro) {', '\n  hud.addEventListener');
  assert.match(escolher, /querySelectorAll\('\.vv-camada-filtros,\.vv-cb-legenda'\)\.forEach\(\(x\) => \{ x\.hidden = !ligada; \}\)/);
  assert.match(mundo, /escolherProspeccao\(e\.target\.checked \? \(camadas\.prosFiltro \|\| 'todas'\) : 'nenhuma'\)/);
  assert.match(ler('vybe-mundo.css'), /body\.mundo \.vv-placa :is\(\.vv-camada-filtros,\.vv-cb-legenda\)\[hidden\]\{display:none\}/);
});

test('35 · ordem da Loja e do inventário em chips, não select nativo; categorias em chips no mundo', () => {
  const editor = ler('vybe-escritorio-editor.js');
  assert.doesNotMatch(editor, /<select onchange="escritorio\.cat\.ordem(Inv)?=this\.value/);
  const fonte = trecho(editor, 'function escritorioOrdemChipsHtml(campo, atual, opcoes) {', '\n}\n') + '\n}';
  const html = vm.runInNewContext(`${fonte}; escritorioOrdemChipsHtml("ordem", "preco", [["destaque", "Em destaque"], ["preco", "Mais baratos"]])`);
  assert.match(html, /role="group" aria-label="Ordem"/);
  assert.match(html, /aria-pressed="true" onclick="escritorio\.cat\.ordem='preco'[^"]*">Mais baratos/);
  assert.match(html, /aria-pressed="false" onclick="escritorio\.cat\.ordem='destaque'/);
  const css = ler('vybe-mundo.css');
  assert.match(css, /body\.mundo #office-catalogo \.ofc-catj-arvore\{display:flex;flex-wrap:wrap/);
  assert.match(css, /body\.mundo #office-catalogo \.ofc-loja-nav\[aria-pressed=true\]\{background:var\(--ds-sel-fundo\)/);
});

test('35 a 37 · ícones de móvel e troféu em voxel: parede também, guardados no navegador, sem pixel art esperando', () => {
  const quarto = ler('mundo/quarto.mjs');
  const retrato = trecho(quarto, 'export function retratoDoMovel(', '\nexport function abrirQuarto(');
  assert.doesNotMatch(retrato, /peça de parede: fica a arte de sempre/);
  assert.match(retrato, /guardado\.ler\(chaveGuardada\)/);
  assert.match(retrato, /guardado\.gravar\(chaveGuardada, url\)/);
  // A vez na fila é marcada na hora do pedido (sem esperar a si mesma) e quem saiu de vista é pulado.
  assert.match(retrato, /antes = filaDeFotos/);
  assert.match(retrato, /retratos\.delete\(chave\)/);
  assert.match(ler('mundo/moveis-habbo.mjs'), /export const guardado = /);
  const mundo = ler('vybe-mundo.js');
  assert.match(mundo, /img\.classList\.add\('movel-esperando'\)/);
  assert.match(mundo, /modAvatar\.retratoDoMovel\?\.\(classe, 96, vivo\)/);
  assert.match(ler('vybe-mundo.css'), /body\.mundo img\.movel-esperando\{object-position:-9999px -9999px/);
});

test('36 e 37 · Ranking e Conquistas numa janela do tamanho da Loja, fora do dock lateral', () => {
  const antigo = ler('vybe-styles.css');
  assert.match(antigo, /:where\(body:not\(\.mundo\)\) #workflow-modal\.ofc-menu-jogo \{width:min\(1480px/);
  assert.match(antigo, /:where\(body:not\(\.mundo\)\) #workflow-modal\.rk2-janela \{width:min\(820px/);
  assert.match(antigo, /:where\(body:not\(\.mundo\)\) #workflow-modal\.ofc-ranking-janela \{width:min\(640px/);
  assert.match(antigo, /\.workflow-modal:where\(:not\(\.ofc-snc-jogo\):not\(\.ofc-snc-menu\):not\(\.ofc-tv-janela\):not\(body\.mundo \.ofc-menu-jogo\)\)\{width:min\(940px,94vw\)!important\}/);
  const css = ler('vybe-mundo.css');
  assert.match(css, /body\.mundo #workflow-modal\.ofc-menu-jogo\{width:min\(1120px,calc\(100vw - var\(--vv-palco-esq,0px\) - var\(--vv-m\)\)\);left:calc\(50% \+/);
});

test('Jogos e Equipe online param acima do dock das salas', () => {
  // A regra geral da placa dá o fim (o mesmo das outras janelas); a regra própria, 8 px mais curta, deixava o Hoje à vista.
  const css = ler('vybe-mundo.css');
  assert.match(css, /body\.mundo\.com-dock-salas:not\(\.mundo-centro\) \.vv-placa\{bottom:calc\(var\(--vv-m,14px\) \+ var\(--vv-dock-alto,74px\) \+ 6px\)\}/);
  assert.doesNotMatch(css, /\.vv-placa:has\(> \.vv-jogos/);
});

test('o CSS novo da frente não usa !important nem html body.mundo', () => {
  const css = ler('vybe-mundo.css'), bloco = css.slice(css.indexOf('/* ===== Frente mundo'));
  assert.ok(bloco.length > 100);
  assert.doesNotMatch(bloco, /!important/);
  assert.doesNotMatch(bloco, /html body\.mundo/);
});
