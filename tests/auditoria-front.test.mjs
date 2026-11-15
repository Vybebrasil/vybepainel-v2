// Auditoria front x back (14/11/2026): VybeHub como link, aviso que não cobre a janela, dica que não cobre controle,
// Esc do espiar, nomes acessíveis com verbo, fala sem ação em cartão claro e os acertos de CSS (contraste, foco, camadas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const mundo = ler('vybe-mundo.js'), core = ler('vybe-core.js'), tutorial = ler('vybe-mundo-tutorial.js');
const css = ler('padrao-v2/d3-auditoria.css');

test('VybeHub e os outros ↗ do menu são links (o navegador abre a aba), sem window.open no clique', () => {
  assert.match(mundo, /const tag = t\.url \? `a href="\$\{t\.url\}" target="_blank" rel="noopener"` : 'button type="button"';/);
  assert.match(mundo, /x\.url \? `<a href="\$\{x\.url\}" target="_blank" rel="noopener" data-submodulo=/);
  assert.match(mundo, /if \(e\.target\.closest\?\.\('\.vv-trilho a\[href\]\[target="_blank"\]'\)\) return;/);
  assert.match(mundo, /if \(b\.matches\('a\[href\]'\)\) return;/);
  assert.match(css, /#mundo-hud \.vv-trilho a:is\(\.vv-trilho-btn,\.vv-trilho-fav-item,\[data-submodulo\]\)[^{]*\{text-decoration:none/);
});

test('aviso curto no computador: a janela aberta conta inteira; sem vaga vira pílula fora dela ou vai ao sino', () => {
  assert.match(core, /if \(W > 600\) for \(const q of avisoCurtoJanelas\(caixa, W, H\)\) obstaculos\.push/);
  assert.match(core, /function avisoCurtoJanelas\(caixa, W, H\)/);
  const fn = core.slice(core.indexOf('function ajustarAvisosCurtos'), core.indexOf('function avisoCurtoJanelas'));
  assert.match(fn, /caixa\.classList\.add\('pilula'\);/);
  assert.match(fn, /for \(const x of filhos\) mandarAvisoAoSino\(x\);/);
  assert.doesNotMatch(fn, /if \(menor\) \{ caixa\.classList\.toggle\('minimo', menor\.minimo\); por\(menor\.x, menor\.y, menor\.w\); \}/, 'não fica mais "onde cobre menos"');
  assert.match(core, /if \(window\.innerWidth > 600\) \{\s*\/\/ Computador: abre no lugar da pílula/);
});

test('dica grande do tour: cobrindo controle, procura vaga como a compacta e, sem vaga, espera escondida', () => {
  const fn = tutorial.slice(tutorial.indexOf('function posicionarDica'), tutorial.indexOf('// ---------- dica compacta'));
  assert.match(fn, /if \(!embaixo\.length \|\| !soOsDaFrente\(embaixo\)\.length\) return;/);
  assert.match(fn, /const posto = colocarCompacta\(d\.balao, c, alvo, evitar\);\s*esconderDica\(d, posto === 'espera'\);/);
  // Esperando escondida, confere a cada 2 s (5 voltas do relógio de 400 ms) e só escreve hidden quando muda (auditoria 15/11/2026).
  assert.match(tutorial, /if \(dicaAtual && \(agora === true \|\| !dicaAtual\.balao\.hidden \|\| tique % 5 === 0\)\) posicionarDica\(\);/);
  assert.match(tutorial, /function esconderDica\(d, sim\) \{ if \(d\.balao\.hidden !== sim\) d\.balao\.hidden = sim;/);
});

test('espiar: Esc na janela em captura (antes do Esc das telas) e o foco volta ao número', () => {
  assert.match(mundo, /window\.addEventListener\?\.\('keydown', \(e\) => \{\s*if \(e\.key === 'Escape' && !espiaoEl\.hidden\)/);
  assert.match(mundo, /if \(volta\?\.isConnected && \(!foco \|\| foco === document\.body \|\| espiaoEl\.contains\(foco\)\)\) volta\.focus/);
});

test('nome acessível com verbo nos botões que só diziam "Abrir", "Salvar" ou a opção', () => {
  assert.match(core, /aria-label="Escolher \$\{e\(o\.nome\)\}/);
  assert.match(ler('vybe-mundo-setor.js'), /class="vs-abrir" data-setor-sub="\$\{esc\(id\)\}" aria-label=/);
  assert.match(mundo, /data-criacao-atalho="perguntar" aria-expanded="false" aria-label="Perguntar ao Danilo sobre a arte"/);
  assert.match(mundo, /data-pend-agente="design" aria-label="Ver o agente da direção de arte"/);
  assert.match(ler('vybe-mundo-pendencias.js'), /data-pend-agente="concierge" aria-label="Ver o agente/);
  assert.equal((ler('vybe-demandas.js').match(/class="ai-setting-save[^"]*" type="button" onclick="saveAiUsageSettings\(\)" aria-label="Salvar/g) || []).length, 2);
  assert.match(ler('vybe-clientes.js'), /aria-label="Abrir o planejamento"/);
});

test('fala de agente sem ação vira cartão claro; com botão continua laranja', () => {
  assert.match(ler('vybe-mundo-setor.js'), /g2-fala v2-abre\$\{linhas\.length \? '' : ' g2-fala-quieta'\}/);
  assert.match(mundo, /v2n-fala\$\{D\.nRecados \? '' : ' v2n-fala-quieta'\}/);
  assert.match(css, /\.g2-fala\.g2-fala-quieta\{background:var\(--d3-cartao/);
  assert.match(css, /\.v2n-fala\.v2n-fala-quieta\{background:var\(--d3-cartao/);
});

test('CSS da auditoria: filtros, contraste, foco, camadas antigas, agenda, loja e "Sem filtros"; sem !important', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.match(css, /\.v2c-filtros > \.v2c-btn:is\(\.k,\[aria-expanded="true"\]\)[^{]*\{background:var\(--d3-tinta\);color:#FFFFFF\}/);
  assert.match(css, /\.d3-num\.q\.q > \.d3-num-v\{color:var\(--vv-apagado/);
  assert.match(css, /\.vb-resumo-item\.zero\.zero[^{]*\{color:var\(--vv-apagado/);
  assert.match(css, /\.g2-mais > summary > u\{color:#A83D08\}/);
  assert.match(css, /--ds-foco:0 0 0 2px #FFFFFF,0 0 0 4px #1F1D1A/);
  assert.match(css, /body\.mundo:not\(\.mundo-modulo\):not\(\.mundo-gestao\) > :is\(header\.app-header,\.container,\[id\^="painel-"\]:not\(#painel-escritorio\)\)\{visibility:hidden\}/);
  assert.match(css, /#pv2-agenda \.capt-fab\.capt-fab\{display:none\}/);
  assert.match(css, /\.ag-chip\.ag-chip span\{text-overflow:ellipsis\}/);
  assert.match(css, /#office-catalogo \.v2l-grade\.v2l-grade\{grid-template-columns:repeat\(auto-fill,minmax\(180px,1fr\)\)\}/);
  assert.match(css, /body\.mundo #ops-clear-btn\.ops-clear-btn\{/);
  assert.match(ler('vybe-padrao.css'), /:where\(body:not\(\.mundo\)\) \.ops-clear-btn\{height:32px!important;/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('body.mundo #ops-clear-btn.ops-clear-btn{'), 'o juntador já levou o fragmento');
});
