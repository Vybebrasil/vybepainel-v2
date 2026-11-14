// Direção 3 (moodboard 3, 13/11/2026), grupo Comercial: CRM e funil, Produtos e pacotes, Orçamentos, Finanças por cliente,
// Diário, Contratos, Churn, Gestão e Performance. SAFE: só lê os arquivos; o comportamento de cada tela está nos testes
// padrao-v2-comercial e padrao-v2-diario.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('o CSS do grupo não força regra antiga e usa os tokens da Direção 3', () => {
  const css = ler('padrao-v2/d3-comercial.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) {
    if (!/^\s*[#.]/.test(linha) || !linha.includes('{')) continue;
    assert.match(linha, /^\s*(#vv-comercial\.v2c\.d3c|#vv-carteira \.v2c(:is\(\[data-tela="contratos"\],\[data-tela="churn"\]\)|\[data-tela="contratos"\])|\.vv-gestao\.vv-gestao)[ .:{]/, 'tudo pelo id ou pela classe da janela: ' + linha.slice(0, 70));
  }
  // Fundo areia, o bloco de ação laranja e números de 36.
  assert.match(css, /#vv-comercial\.v2c\.d3c\{background:var\(--d3-areia\)/);
  assert.match(css, /\.v2c-fala\{[^}]*background:var\(--d3-acao\)/);
  assert.match(css, /\.g2-fala\{[^}]*background:var\(--d3-acao\)/);
  assert.match(css, /\.d3-num > \.d3-num-v\{font-size:36px/);
  // A ação do topo deixa de ser laranja: o único laranja cheio é o bloco de ação.
  assert.match(css, /\.v2c-topo \.v2c-btn\.p\{background:var\(--d3-cartao\)/);
  assert.match(css, /\.g2-topo \.g2-btn\{background:var\(--d3-cartao\)/);
  const diario = ler('padrao-v2/diario.css');
  assert.doesNotMatch(diario, /!important|html body\.mundo/);
  assert.match(diario, /#painel-diario \.v2d-acao\{[^}]*background:#1F1D1A/);
});

test('as telas do grupo montam as peças da Direção 3 e as séries de meses em linha', () => {
  const com = ler('vybe-mundo-comercial.js');
  assert.match(com, /const D3 = new Set\(\[[^\]]*'funil', 'pacotes', 'orcamentos'[^\]]*'financas'\]\)/);
  assert.match(com, /g3\('d3AcaoHtml'\)/); assert.match(com, /g3\('d3NumHtml'\)/); assert.match(com, /g3\('d3LinhaSvg'\)/);
  assert.match(com, /const grafico = ehD3\(\) \? graficoLinha : graficoBarras;/);
  const rel = ler('vybe-relatorios.js');
  assert.match(rel, /d3AcaoHtml\(\{ frase: corpo, agente: 'H'/);
  assert.match(rel, /diarioD3Linha\(serie\.map\(\(x\) => x\.n\.prontas\)/, 'Finalizado na semana em linha');
  // Pronta continua sendo só Finalizado.
  assert.match(rel, /const DIARIO_PRONTO = \['finalizado'\];/);
});
