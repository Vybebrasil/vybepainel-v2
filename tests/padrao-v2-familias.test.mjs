// Padrão v2 · Famílias de subtela (quadro FamiliasDepois, 13/11/2026): abas, menu de linha, gaveta, formulário,
// confirmação, vazio e carregando, cada uma com uma peça só em vybe-core.js e o desenho em padrao-v2/familias.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const core = ler('vybe-core.js');
const css = ler('padrao-v2/familias.css');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const trecho = (de, ate) => core.slice(core.indexOf(de), core.indexOf(ate));
const ctx = vm.createContext({ safeText: esc, vbIcone: (n) => `<svg data-i="${n}"></svg>`, console });
vm.runInContext(trecho('function vbEstadoHtml', '// Confirmação (família 5)'), ctx);
vm.runInContext(trecho('function vbMenuLinhaHtml', '// Marca (ou limpa'), ctx);

test('vazio: ícone, uma frase e uma ação; o texto, quando vem, numa linha apagada', () => {
  const html = ctx.vbEstadoHtml({ titulo: 'Nenhum projeto ainda.', acao: '<button>Criar projeto</button>' });
  assert.match(html, /^<div class="vb-estado vazio" role="status"><span class="vb-estado-icone"><svg data-i="vazio"><\/svg><\/span><b>Nenhum projeto ainda\.<\/b><button>Criar projeto<\/button><\/div>$/);
  assert.doesNotMatch(html, /<p>/);
  assert.match(ctx.vbEstadoHtml({ texto: 'Só o texto' }), /<b>Só o texto<\/b>/, 'sem título, o texto é a frase');
  assert.match(ctx.vbEstadoHtml({ tipo: 'erro', titulo: 'Falhou', texto: 'Sem rede' }), /class="vb-estado erro" role="alert".*<b>Falhou<\/b><p>Sem rede<\/p>/);
});

test('carregando: esqueleto com a forma da tela, sem barra genérica', () => {
  const lista = ctx.vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando os roteiros' });
  assert.match(lista, /^<div class="vb-carregando vb-esq lista" role="status" aria-busy="true" aria-label="Carregando os roteiros">/);
  assert.equal((lista.match(/class="vb-esq-lin"/g) || []).length, 3);
  assert.match(lista, /<i class="vb-sk vb-esq-av"><\/i><i class="vb-sk vb-esq-txt"><\/i><i class="vb-sk vb-esq-pil"><\/i>/);
  assert.doesNotMatch(lista, /vb-brilho|style=/, 'nada de barra genérica nem estilo na linha');
  assert.equal((ctx.vbEstadoHtml({ tipo: 'carregando', forma: 'cartoes', linhas: 2 }).match(/vb-esq-cartao/g) || []).length, 2);
  assert.match(ctx.vbEstadoHtml({ tipo: 'carregando', forma: 'outra', linhas: 99 }), /vb-esq lista/);
});

test('menu de linha: três pontos, o que apaga por último e marcado; etapas "1 de N"', () => {
  const html = ctx.vbMenuLinhaHtml({ rotulo: 'Mais opções da linha', itens: [{ rotulo: 'Apagar', perigo: true, attrs: 'data-a="x"' }, { rotulo: 'Abrir' }, { rotulo: 'Editar', desligado: true }] });
  assert.match(html, /^<details class="vb-menu-linha"><summary class="vb-pt3" aria-label="Mais opções da linha"/);
  const itens = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(itens, ['Abrir', 'Editar', 'Apagar']);
  assert.match(html, /class="vb-mi vb-mi-apaga" data-a="x">Apagar/);
  assert.match(html, /class="vb-mi" disabled>Editar/);
  const et = ctx.vbEtapasHtml(['Empresa', 'Contato', 'Revisão'], 1, { attr: 'data-p' });
  assert.match(et, /aria-label="Etapa 2 de 3"/);
  assert.match(et, /<span class="vb-etapa feito" data-p="0"><b>1<\/b><em>Empresa<\/em><\/span><i aria-hidden="true"><\/i><span class="vb-etapa atual" data-p="1">/);
  assert.match(ctx.vbEtapasHtml(['a', 'b', 'c', 'd', 'e'], 0), /class="vb-etapas muitas"/);
});

test('abas: uma peça para todas as listas de abas do mundo (pílula que desliza, contador sem zero, "Mais" passou de 6)', () => {
  const abas = trecho('function vbArrumarAbas', "if (typeof window !== 'undefined') Object.assign(window");
  assert.match(core, /const VB_ABAS_MAX = 6;/);
  assert.match(abas, /n\.hidden = Number\(n\.textContent\.replace\(\/\\D\/g, ''\)\) === 0;/, 'o zero some');
  assert.match(abas, /if \(!vistas\.has\(sel\)\) \{ vistas\.delete\(VB_ABAS_MAX - 1\); vistas\.add\(sel\); \}/, 'a selecionada nunca vai para o Mais');
  assert.match(abas, /lista\.scrollWidth > larguraUtil\(\) \+ 1/, 'no celular, o que não cabe também vai para o Mais');
  assert.match(abas, /alvo\?\.click\(\)/, 'o Mais clica na aba de verdade');
  assert.match(core, /new MutationObserver\(pedirAbas\)\.observe\(document\.body/);
  assert.match(css, /\.vb-abas\.vb-abas:not\(#vb-a\):not\(#vb-b\)\{--ds-on-fundo:#1F1D1A;[^}]*border-radius:999px;background:var\(--d3-trilho,#F3F1EC\)/, 'Direção 3: trilho #F3F1EC e a escolhida preta');
  assert.match(css, /\.vb-abas\.vb-abas-desliza:not\(#vb-a\):not\(#vb-b\)::before\{[^}]*transform:translateX\(var\(--vb-aba-x,0px\)\);[^}]*background:var\(--d3-tinta,#1F1D1A\)/);
  assert.match(css, /\.vb-aba-n\{[^}]*background:#FFFFFF;color:var\(--d3-tinta,#1F1D1A\)/, 'Direção 3: o contador não é laranja');
  assert.match(css, /@media \(max-width:640px\)\{[^@]*\.vb-abas:not\(#vb-a\):not\(#vb-b\) \[role="tab"\]\{height:36px/);
});

test('confirmação: janela só para apagar, Cancelar e Apagar vermelho; confirm( de apagar trocado', () => {
  const f = trecho('function vbConfirmarApagar', '// Menu de linha (família 2)');
  assert.match(f, /role="alertdialog" aria-modal="true"/);
  // Direção 3 (D3-Fam-Confirmacoes): Apagar só liga depois de "Digite APAGAR" (tests/d3-faltas.test.mjs).
  assert.match(f, /<button type="button" class="vb-apagar-nao">Cancelar<\/button><button type="button" class="vb-apagar-sim"\$\{exigida \? ' disabled' : ''\}>\$\{safeText\(rotulo\)\}<\/button>/);
  assert.match(f, /e\.key === 'Escape'/);
  assert.match(f, /e\.target === fundo/, 'clique fora cancela');
  assert.match(core, /function vbConfirmarApagar\(\{ titulo = 'Apagar\?', texto = '', rotulo = 'Apagar', palavra = 'APAGAR' \} = \{\}\)/);
  assert.match(css, /#vb-apagar \.vb-apagar-acoes \.vb-apagar-sim\{background:#B42318;/);
  assert.doesNotMatch(ler('vybe-mundo-agentes.js'), /!confirm\('Remover esta atribuição\?'\)/);
  assert.doesNotMatch(ler('vybe-arquivos.js'), /window\.confirm\(/);
  assert.match(ler('vybe-clientes.js'), /if \(perigo && typeof vbConfirmarApagar === 'function'\) return vbConfirmarApagar\(\{ titulo, texto, rotulo: confirmar \}\);/);
  assert.match(ler('vybe-grupos.js'), /vbConfirmarApagar\(pergunta\)/);
  assert.match(ler('vybe-subitens.js'), /vbConfirmarApagar\(\{ titulo: `Remover a subdemanda/);
});

test('portões e contexto de status: etapas em pílula, botões em pílula, primário preto, erro embaixo do campo', () => {
  const portoes = ler('vybe-portoes.js'), status = ler('vybe-status.js');
  assert.match(portoes, /function etapasDoPortao\(destino\)/);
  assert.equal((portoes.match(/class="pt-btn k"/g) || []).length >= 3, true);
  assert.doesNotMatch(portoes, /class="workflow-primary"/);
  assert.doesNotMatch(portoes, /Validar e continuar →|Confirmar ✓|← Voltar/);
  assert.match(portoes, /document\.getElementById\('conferencia-confirmar'\)/);
  assert.match(status, /<button id="context-back" type="button" class="pt-btn"[^>]*>Cancelar<\/button><button id="status-context-submit" type="button" class="pt-btn k"/);
  assert.match(status, /vbEtapasHtml\(etapas\.map\(\(e\) => e\.nome\), 0, \{ attr: 'data-progress-step' \}\)/);
  assert.match(status, /<em class="vb-obrig">obrigatório<\/em>/);
  assert.match(status, /ancora\.after\(aviso\)/);
  assert.match(css, /\.vb-erro,body\.mundo #context-step-error\.vb-erro\{[^}]*color:#B42318/);
});

test('status: menu curto em pílula na cor do status, "Todos os N" em tinta, um aviso só na recusa; Grupos com a pílula das listas', () => {
  const status = ler('vybe-status.js'), agenda = ler('vybe-agenda.js'), dominio = ler('vybe-dominio.js');
  assert.match(status, /<span class="v2-st-pilula \$\{typeof pv2Tom === 'function' \? pv2Tom\(o\.label\) : ''\}" style="--c:\$\{o\.color\}">/);
  assert.match(css, /#status-editor \.v2-st-todos \.v2-st-todos-txt\{color:#1F1D1A;[^}]*text-decoration:underline/, 'Direção 3: link em tinta sublinhada');
  assert.match(dominio, /erro\.vbAvisado = true;/);
  assert.match(status, /else if \(!e\?\.vbAvisado\) showToast\(recadoDeStatusRecusado\(e, option\), 'err', 9000\);/);
  assert.match(agenda, /\$\{pv2 \? pv2StatusBotao\(item\) : `<button type="button" class="grupo-pill-btn"/);
  assert.match(agenda, /\$\{pv2 && typeof pv2Chegou === 'function' \? pv2Chegou\(item\) : ''\}/);
  assert.match(css, /:is\(#grupos-board,#grupos-board-demandas,#cartao-rapido\) \.pv2-st\{/);
});

test('gaveta: 520 pela direita e Esc fecha as gavetas que só fechavam pelo X', () => {
  assert.match(css, /\.prod-v2-drawer\.prod-v2-drawer:not\(#vb-a\)\{left:auto;top:12px;right:12px;bottom:12px;height:auto;width:520px/);
  assert.match(css, /\.manager-command-drawer\.manager-command-drawer\.open:not\(#vb-a\)\{left:auto;[^}]*width:520px/);
  assert.match(core, /window\.closeProductionSheet\(\)/);
  assert.match(core, /closeManagerCommandDrawer\(\)/);
});

test('o fragmento segue as regras do padrão: sem !important e sem html body.mundo', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  const juntado = ler('vybe-mundo-padrao-v2.css');
  assert.match(juntado, /\/\* ===== padrao-v2\/familias\.css ===== \*\//);
});
