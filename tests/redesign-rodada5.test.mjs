// Redesign, quinta rodada (11/11/2026): o aviso curto no celular nunca fica sobre controle (quadro 29, regra 6; "nada
// cobre") e a tela antiga abre em pedaços no Safari (Painel de trabalho, Demandas, Clientes e as outras do legado).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('vybe-mundo.css'), mundo = ler('vybe-mundo.js'), core = ler('vybe-core.js');
const bloco = (inicio) => { const i = css.indexOf(inicio); assert.ok(i > 0, inicio); const j = css.indexOf('/* ====', i + 10); return css.slice(i, j < 0 ? undefined : j); };

test('celular: faixa livre, senão pílula na barra do topo junto do sino, senão direto para o sino; nenhum aviso se perde', () => {
  assert.match(core, /if \(W <= 600\) \{[\s\S]{0,700}avisoCurtoNoCelular\(\{ caixa, filhos: \[\.\.\.caixa\.children\], W, margem, pe, procurar, por, acordar \}\); return; \}/);
  const fn = core.slice(core.indexOf('function avisoCurtoNoCelular'), core.indexOf('globalThis.AVISOS_CURTOS_NO_SINO ='));
  // (1) faixa livre: só vale com zero controle embaixo
  assert.match(fn, /if \(v && !v\.n\) \{ avisoNaBarra\(false\); por\(margem, v\.y, larga\); acordar\(\); return; \}/);
  // (2) pílula entre a lupa e o sino, só com a barra por cima e sem botão dela na vaga
  assert.match(fn, /caixa\.classList\.add\('pilula'\)/);
  assert.match(fn, /const l = cabe \? rb\.right \+ 6 : 0, w = cabe \? rs\.left - 6 - l : 0/);
  assert.match(fn, /visto\.closest\('button,a\[href\],input'\)/);
  // (3) sem lugar: vai para o sino, com o número aceso
  assert.match(fn, /for \(const x of \[\.\.\.caixa\.children\]\) mandarAvisoAoSino\(x\);/);
  assert.match(core, /function mandarAvisoAoSino\(el\) \{[\s\S]{0,120}guardarAvisoCurto\(el\.vvDados, false\);/);
  assert.match(core, /while \(caixa\.children\.length > 3\) mandarAvisoAoSino\(caixa\.firstElementChild\);/, 'o quarto aviso não some: vai para o sino');
  assert.match(mundo, /const n = naoLidasDoPainel\(\) \+ avisosPlanejamento\(\) \+ curtosNaoVistos\(\)\.length,/);
  assert.match(mundo, /<h3>Chegaram agora<\/h3>/);
  assert.match(mundo, /document\.addEventListener\?\.\('vybe:aviso-no-sino'/);
  // tocar a pílula abre o aviso inteiro; o botão meio coberto (rodapé da gaveta) ainda conta como controle
  assert.match(core, /caixa\.addEventListener\('click', \(e\) => \{ if \(!e\.target\.closest\('button'\)\) abrirPilulaDoAviso\(caixa\); \}\);/);
  assert.match(core, /for \(const y of \[q\.top \+ q\.height \/ 2, q\.top \+ 3, q\.bottom - 3\]/);
  const c = bloco('/* ==== Quinta rodada · aviso curto no celular');
  assert.match(c, /body\.mundo\.vv-aviso-na-barra \.vv-barra-topo \.vv-busca-larga\{flex:0 0 36px/);
  assert.match(c, /#vv-wa-avisos\.pilula:not\(\.aberto\) \.vv-aviso-curto\{height:34px/);
  assert.doesNotMatch(c, /!important|html body\.mundo/);
});

test('tela antiga em pedaços: o clique só troca a tela; o desenho pesado vem depois do primeiro quadro, sem perder pedido', () => {
  assert.match(mundo, /abrirEmPedacos\(\(\) => \{ if \(!body\.classList\.contains\('mundo-modulo'\) \|\| \(typeof panelMode !== 'undefined' && panelMode !== 'gestor'\)\) chamar\('chooseManagerMode', sub\.board\); else quadro\(\); \}\);/);
  assert.match(mundo, /agenda: \(\) => abrirEmPedacos\(\(\) => abrirAgenda\(\)\), clientes: \(\) => abrirEmPedacos\(\(\) => chamar\('chooseClientMode'\)\)/);
  // o pedido repetido substitui o antigo; chamado fora da abertura, desenha na hora e tira o da fila
  assert.match(mundo, /if \(adiandoDesenho \? !SO_NO_FIM_DAS_FOLGAS\.has\(nome\) : nasFolgas && SO_NO_FIM_DAS_FOLGAS\.has\(nome\)\) \{ desenhosNaFila\.delete\(chave\); desenhosNaFila\.set\(chave, \{ f, a, este: this \}\); return undefined; \}\s*desenhosNaFila\.delete\(chave\);\s*return f\.apply\(this, a\);/);
  // a semana à vista primeiro, depois do primeiro quadro; as outras nas folgas
  assert.match(mundo, /requestAnimationFrame\(\(\) => \{\s*setTimeout\(\(\) => \{\s*const ativa = 'renderWeek:'/);
  assert.match(mundo, /const CONTEUDO_APARECE_MS = 300;/);
  const c = bloco('/* ==== Quinta rodada · tela antiga em pedaços');
  assert.match(c, /body\.mundo\.mundo-modulo > \.container\.vv-abrindo > :not\(\.workspace-heading\):not\(#production-command-dashboard\)\{display:none\}/);
  assert.doesNotMatch(c, /!important|html body\.mundo/);
});

test('pintarDock (a cada 1,5 s) só mede o dock quando algo que muda a medida mudou', () => {
  const fn = mundo.slice(mundo.indexOf('function pintarDock()'), mundo.indexOf("if (typeof addEventListener === 'function') { let quadro = 0;"));
  assert.match(fn, /if \(medidaDock\.tela !== tela\) \{ medidaDock\.tela = tela; medidaDock\.cabem = Math\.floor\(\(faixaDock\.clientWidth/);
  assert.match(fn, /if \(chave === medidaDock\.chave\) return;\s*medidaDock\.chave = chave;\s*const margem = parseFloat\(getComputedStyle\(body\)/);
});
