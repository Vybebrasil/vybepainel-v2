// Redesign, fase 3a (Paulo, 10/11/2026: "Sim, fase 3a"): as peças do sistema numa camada só, e o Hoje de quem trabalha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('vybe-mundo.css');
const bloco = css.slice(css.indexOf('PEÇAS DO SISTEMA (redesign fase 3a'));

test('um botão em quatro jeitos e três alturas; os módulos não pintam mais o próprio botão', () => {
  assert.match(bloco, /body\.mundo\{--pc-h:34px;--pc-h-p:28px;--pc-h-g:40px;--pc-r:999px;/);
  assert.match(bloco, /body\.mundo :is\(\.vc-acao,\.vp-acao,\.vf-botao\.principal,\.vi-botao\.principal,\.conta-botao\.primario,\.auto-novo,\.quadro-novo/, 'principal');
  assert.match(bloco, /:is\(:disabled,\.desligado\)\{background:var\(--pc-desligado-fundo\)/, 'desligado é cinza');
  assert.doesNotMatch(bloco, /!important/);
  assert.doesNotMatch(bloco, /html body\.mundo/);
  assert.match(css, /--ds-r-botao:999px;/, 'um raio para todo controle');
  // Nenhum módulo redefine o botão (o segundo laranja #F76808 e as alturas 38/40/44 saíram).
  for (const [f, sel] of [['vybe-mundo-ferramentas.css', '#vv-ferramentas .vf-botao.principal{'], ['vybe-mundo-impressoes.css', '#vv-impressoes .vi-botao.principal{'], ['vybe-mundo-pessoas.css', '#vv-pessoas .vp-acao{'], ['vybe-mundo-comercial.css', '#vv-comercial .vc-acao{'], ['vybe-mundo-carteira.css', '#vv-carteira .vc-acao{'], ['vybe-mundo-conteudo.css', '#vv-conteudo .vc-acao{']]) {
    assert.ok(!ler(f).includes(sel), `${f} sem ${sel}`);
  }
  assert.doesNotMatch(ler('vybe-mundo-ferramentas.css') + ler('vybe-mundo-impressoes.css'), /#F76808;color:#FFFFFF/);
});

test('as regras do tema escuro que pintavam o principal de cinza valem só fora do mundo', () => {
  const padrao = ler('vybe-padrao.css');
  assert.ok(padrao.includes(':where(body:not(.mundo)) :is(.eq-acoes button,.auto-sincronizar,.conta-botao,.vb-cabecalho .vb-botao:not(.principal)){'));
  assert.ok(padrao.includes(':where(body:not(.mundo)) :is(.conta-botao.primario,.auto-novo){'));
  assert.ok(padrao.includes(':where(body:not(.mundo)) .vb-botao.principal{'));
  assert.ok(padrao.includes(':where(body:not(.mundo)) .capt-tb-criar{'));
});

test('campos: a mesma seta de select em todo navegador; avisos abaixo do cabeçalho da visão geral do setor', () => {
  assert.match(css, /body\.mundo select:not\(\[multiple\]\):not\(\[size\]\)\{appearance:none;/);
  assert.match(css, /select,textarea\):not\(#ds-a\):not\(#ds-b\):not\(#ds-c\)\{background-color:#FFFFFF!important;/, 'a regra dos campos não apaga a seta');
  assert.match(css, /body\.mundo:has\(\.vv-setor-visao:not\(\[hidden\]\)\) #vv-wa-avisos\{top:calc\(var\(--vv-m,14px\) \+ 136px\)\}/);
});

test('Hoje: trocar status, briefing, bruto, entregar e roteiro na própria linha, com os botões de Minhas tarefas', () => {
  const js = ler('vybe-mundo.js');
  const acoes = js.slice(js.indexOf('function acoesDaPeca(d) {'), js.indexOf('function linhaDemanda('));
  for (const f of ['botaoDeBriefingHtml(d)', 'botaoDeMaterialBrutoHtml(d)', 'botaoDeEntregaHtml(d)', "openStatusEditor(event,'${id}')", 'roteiroDaPeca(d)']) assert.ok(acoes.includes(f), f);
  assert.match(js, /quem: fila\.users\.length > 1 \? x\.quem : null, acoes: true \}\)/, 'as três colunas do Hoje usam as ações');
  assert.match(js, /fetch\('\/api\/painel\?area=roteiros'/, 'roteiro pela biblioteca de roteiros');
  const risco = ler('vybe-risco.js');
  assert.match(risco, /function botaoDeEntregaHtml\(d\) \{/);
  assert.match(risco, /\$\{botaoDeMaterialBrutoHtml\(d\)\}\$\{botaoDeEntregaHtml\(d\)\}/, 'Minhas tarefas usa o mesmo botão');
  assert.match(css, /body\.mundo \.vv-demanda-acoes \.focus-brief-btn\.faltando\{background:#FFF4DC;/, 'a etiqueta Sem briefing');
});

test('janelas de formulário cabem acima do dock (Cancelar e Salvar da Nova reunião ficavam atrás dele)', () => {
  assert.match(css, /body\.mundo\{--vv-janela-alto:calc\(100dvh - var\(--vv-dock-alto,0px\) - 2 \* var\(--vv-m,14px\) - 28px\)\}/);
  assert.match(css, /body\.mundo \.workflow-modal:where\(:not\(\.ofc-snc-jogo\):not\(\.ofc-snc-menu\):not\(\.plj-janela\)\)\{max-height:var\(--vv-janela-alto\);top:calc\(50% - var\(--vv-dock-alto,0px\) \/ 2 - 7px\)\}/,
    'o documento do planejamento é tela cheia (top:0): fica fora, senão abre pela metade da tela');
  assert.ok(ler('vybe-styles.css').includes(':where(body:not(.mundo)) .workflow-modal:where(:not(.ofc-snc-jogo):not(.ofc-snc-menu)){max-height:88vh!important}'), 'os 88% valem só fora do mundo');
  assert.ok(ler('vybe-mundo-clientes-ficha.css').includes('max-height:var(--vv-janela-alto,calc(100dvh - 32px))'));
});

test('janela de notebook (1110 px): busca numa linha, alternador da semana sem passar por baixo das setas, Ver como quebra', () => {
  assert.match(css, /body\.mundo \.vv-busca-larga \.vv-busca-texto\{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(css, /body\.mundo \.section-title :is\(\.semana-abas,\.dias-setas,\.dias-layout-btn\)\{flex:0 0 auto\}/);
  assert.match(css, /body\.mundo \.ops-segmentos\{flex-wrap:wrap;overflow:visible;row-gap:8px\}/);
  assert.ok(ler('docs/padrao-visual.md').includes('Texto branco no laranja fica (Paulo, 10/11/2026'), 'decisão do contraste registrada');
});

test('janelas e conteúdo do mundo entram só com movimento: nada começa transparente (só os fundos escurecidos)', () => {
  const arquivos = ['vybe-mundo.css', ...readdirSync('.').filter((f) => /^vybe-mundo-.*\.css$/.test(f))];
  for (const f of arquivos) {
    for (const [, nome] of ler(f).matchAll(/@keyframes ([a-z-]+)\{from\{opacity:0/g)) {
      assert.ok(/fundo|pisca/.test(nome), `${f}: @keyframes ${nome} começa transparente`);
    }
  }
  assert.ok(ler('vybe-styles.css').includes(':where(body:not(.mundo)) #workflow-modal.ofc-menu-jogo {height:calc(100vh - 32px)!important;max-height:none!important}'), 'a janela do jogo cabe entre o topo e o dock');
  assert.match(css, /body\.mundo #workflow-modal\.ofc-menu-jogo\{height:var\(--vv-janela-alto\);max-height:var\(--vv-janela-alto\)\}/);
  assert.match(css, /body\.mundo #workflow-modal\.ofc-menu-jogo \.ofc-rk-cab\{color:#1F1D1A\}/, 'título das Conquistas legível');
});

test('Conquistas na janela clara: abas e dica com a cor do sistema', () => {
  assert.match(css, /body\.mundo #workflow-modal\.ofc-menu-jogo \.ofc-cq-abas \.vb-chip\{background:#FFFFFF;/);
  assert.match(css, /body\.mundo #workflow-modal\.ofc-menu-jogo \.cq-dica\{color:#6B665E\}/);
});
