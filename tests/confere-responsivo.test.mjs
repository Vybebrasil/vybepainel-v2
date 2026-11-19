// Confere de responsividade e UI (14/11/2026). Guarda as regras que nasceram das medidas em 1024, 1135 (app do Mac),
// 1366 e 390: a página parada atrás do palco, o 3D do Centro dentro da largura, o dock da Minha sala dentro da tela,
// as colunas que encolhem pelo tamanho do painel (não da janela) e as abas apertadas que vão para o "Mais".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const junto = semComentario(ler('vybe-mundo-padrao-v2.css'));

test('palco aberto: a página não rola por trás (o painel antigo escondido deixava a página com 800 a 1.600 px)', () => {
  assert.match(junto, /body\.mundo\.mundo-visivel\{overflow:hidden\}/);
});

test('Centro e Minha sala: a grade do quadro não passa da largura (no 1024 o Centro saía 100 px pela direita)', () => {
  assert.match(junto, /#mundo-hud > #d3-centro\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(junto, /#mundo-andar > #d3-sala\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
});

test('Minha sala no quadro: o dock não herda o recuo do quarto antigo', () => {
  assert.match(junto, /body\.mundo\.mundo-quarto\.d3s-painel #vv-dock-salas-faixa\{left:var\(--vv-palco-esq,0px\)\}/);
});

test('colunas pelo tamanho do painel: Conta, Planejamentos, visão do setor, tarefas, coluna do meio da sala e Gestão', () => {
  // d3sc2 saiu com a grade antiga da Minha sala (.d3s-grade), que a sala V2 (.d3m-f-corpo) não gera mais
  for (const nome of ['d3conta', 'd3pl', 'd3setor', 'd3htf', 'd3gestao']) {
    assert.match(junto, new RegExp(`container:${nome} / inline-size`), `${nome}: container`);
    // d3conta e d3gestao: as consultas eram da grade antiga da Conta (.d3c-cols) e dos números/ajustes da Gestão
    // (.d3g-nums, .d3g-set), que as telas V2 não geram mais (limpeza de 16 e 18/11/2026)
    if (nome !== 'd3conta' && nome !== 'd3gestao') assert.match(junto, new RegExp(`@container ${nome} \\(max-width:\\d+px\\)`), `${nome}: consulta`);
  }
});

test('números dos cartões: diminuem com o cartão em vez de virar "R..." ou "Sem cam..."', () => {
  assert.match(junto, /\.d3f-nums > \.d3-num\{container-type:inline-size\}/);
  assert.match(junto, /\.d3c-nums > \.d3-num\{container-type:inline-size\}/);
  assert.match(junto, /font-size:clamp\(18px,16cqi,30px\)/);
});

test('abas apertadas: a que não cabe no próprio botão também manda a última para o "Mais"', () => {
  const core = ler('vybe-core.js');
  assert.match(core, /a\.scrollWidth > a\.clientWidth \+ 1/);
  assert.match(core, /naoCabe\(\) && vistas\.size > 1/);
});

test('celular e tablet: a busca termina acima da barra de baixo e o menu do tablet ocupa a largura toda', () => {
  assert.match(junto, /#v2j-busca\{max-height:calc\(100dvh - 84px - env\(safe-area-inset-bottom\)\)\}/);
  assert.match(junto, /@media \(min-width:601px\) and \(max-width:900px\)\{\s*#mundo-hud \.vv-ilha\.vv-trilho\{width:auto/);
});
