// Direção 3 · peças comuns (quadros D3-Gaveta, D3-StatusMenu, D3-NovaDemanda, D3-Entrada, D3-Topo, D3-Celular e famílias).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const gaveta = ler('vybe-gaveta.js');
const status = ler('vybe-status.js');
const d3 = ler('padrao-v2/d3-pecas.css');
const peca = ler('padrao-v2/peca.css');
const stCss = ler('padrao-v2/status.css');
const fam = ler('padrao-v2/familias.css');

test('gaveta: etapas em barra, atraso no canto, data vencida em vermelho e o Resumo em duas colunas', () => {
  assert.match(gaveta, /function gavetaEtapasHtml\(item\)/);
  assert.match(gaveta, /\$\{gavetaEtapasHtml\(item\)\}/);
  assert.match(gaveta, /gavetaAtrasoDesktopHtml\(item\)/);
  assert.match(gaveta, /gavetaDataVencida\(item\.prazo_iso, item\)/);
  assert.match(gaveta, /<div class="gv2-resumo"><div class="gv2-col">/);
  for (const f of ['gavetaArquivosPreviaHtml(assets, entrega)', 'gavetaConversaPreviaHtml(updates)', 'gavetaFichaResumoHtml(detail, item)', "abrirLogDaPeca('${id}')"]) assert.ok(gaveta.includes(f), f);
  assert.match(peca, /\.gv2-resumo\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(peca, /\.gv2-aba\[aria-checked="true"\]\{background:var\(--d3-tinta,#1F1D1A\);color:#FFFFFF/);
});

test('pílula de status: clara com a bolinha; cheia só em Alteração, Atrasada e Finalizado', () => {
  assert.match(gaveta, /const cheia = \/altera\/i\.test\(s\) \? ' a' : \/atrasad\/i\.test\(s\) \? ' r' : \/finaliz\/i\.test\(s\) \? ' g' : '';/);
  assert.match(peca, /\.gv2-st::before\{content:"";[^}]*background:var\(--c,#8A847A\)\}/);
  assert.match(stCss, /\.v2-st-pilula::before\{content:""/);
});

test('status: lista inteira com "Todos · N" e o visto; Ordem e próximo passo em três cartões e o botão que conta o estado', () => {
  assert.match(status, /<span>Todos · \$\{statusOptions\.length\}<\/span>/);
  assert.match(status, /\['ordem', 'Seguir a lista', 'vai ao de baixo'/);
  assert.match(status, /<b>Depois de cada status<\/b>/);
  assert.match(status, /botao\.dataset\.estado = 'indo'/);
  assert.doesNotMatch(status, /Como o botão principal da peça escolhe para onde ela vai/);
  assert.match(stCss, /#workflow-modal \.fx-modos\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('famílias: aba escolhida preta, ícone do vazio em círculo claro, obrigatório em âmbar, desfazer em pílula', () => {
  assert.match(fam, /\[role="tab"\]:is\(\[aria-selected="true"\],\.ativa,\.active\)\{background:var\(--d3-tinta,#1F1D1A\);color:#FFFFFF/);
  assert.match(fam, /\.vb-estado-icone\{[^}]*width:52px;height:52px;border-radius:50%;background:var\(--d3-trilho,#F3F1EC\)/);
  assert.match(fam, /\.vb-obrig\.vb-obrig:not\(#vb-a\)\{[^}]*color:var\(--d3-ajuste,#7A4A00\)\}/);
  assert.match(d3, /body\.mundo #v2-desfazer button\{[^}]*background:rgba\(255,255,255,\.16\)/);
});

test('menu lateral e topo: Criar branco, módulo ativo branco com o ícone do módulo, barra do topo branca, + preto no celular', () => {
  assert.match(d3, /\.vv-trilho-btn\.criar\{background:#FFFFFF;/);
  assert.match(d3, /\[aria-current\]:not\(\.criar\):not\(\[data-trilho="hoje"\]\) > svg\{color:var\(--d3-mod,#C2490C\)/);
  assert.match(d3, /\.vv-ilha\.vv-barra-topo\{background:#FFFFFF;box-shadow:none\}/);
  assert.match(d3, /@media \(max-width:900px\)\{[^@]*\.vv-trilho-btn\.criar\{background:var\(--d3-tinta,#1F1D1A\)/);
});

test('fragmentos do grupo: sem !important e sem html body.mundo; entram no juntado', () => {
  for (const css of [d3, peca, stCss, fam, ler('padrao-v2/entrada.css')]) {
    assert.doesNotMatch(css, /!important/);
    assert.doesNotMatch(css, /html body\.mundo/);
  }
  assert.match(ler('vybe-mundo-padrao-v2.css'), /\/\* ===== padrao-v2\/d3-pecas\.css ===== \*\//);
});
