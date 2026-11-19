// Auditoria das janelas (14/11/2026): o planejamento aberto e o construtor de regra das Automações fecham com Esc,
// devolvem o foco a quem abriu e seguem a Direção 3 (claro, cartão branco canto 20, botão principal preto).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const plj = ler('vybe-planejamentos.js'), mplj = ler('vybe-mundo-planejamentos.js'), auto = ler('vybe-automacoes-ui.js');
const css = ler('padrao-v2/d3-auditoria-janelas.css');
const junto = ler('vybe-mundo-padrao-v2.css');

test('CSS da auditoria: preso às janelas, sem !important, sem html body.mundo, com tokens e na folha juntada', () => {
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important/);
  assert.doesNotMatch(regras, /html body\.mundo/);
  const seletores = regras.split('}').map((r) => r.split('{').slice(-2, -1)[0]?.trim()).filter((s) => s && !s.startsWith('@'));
  for (const s of seletores) assert.match(s, /#workflow-modal\.plj-janela|#automacoes-root/, `regra presa à janela: ${s.slice(0, 80)}`);
  assert.match(regras, /var\(--d3-areia\)/);
  assert.ok(junto.includes('/* ===== padrao-v2/d3-auditoria-janelas.css ===== */'), 'o juntador levou o fragmento');
});

test('Planejamento aberto: diálogo com foco, Esc fecha (também de dentro do documento) e o foco volta ao gatilho', () => {
  const abrir = plj.slice(plj.indexOf('async function abrirPlanejamento'), plj.indexOf('function pintarPlanejamento'));
  assert.match(abrir, /setAttribute\('role', 'dialog'\)/);
  assert.match(abrir, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(abrir, /janela\.returnFocus = origem/);
  assert.match(plj, /document\.addEventListener\('keydown', pljEscFecha, true\)/, 'Esc em captura, antes do Esc do módulo');
  assert.match(plj, /e\.data\?\.vybe === 'planejamento-esc'/, 'o Esc dado dentro da moldura chega por mensagem');
  assert.match(plj, /moldura\.srcdoc = pljPreparaDocumento\(html\)/);
  // A lista atrás não fecha junto e devolve o foco ao botão depois de repintar.
  assert.match(mplj, /!ev\.defaultPrevented && janela && !janela\.hidden && !document\.querySelector\('#workflow-modal, #cli-pergunta, #vb-apagar'\)/);
  assert.match(mplj, /botoes\.find\(\(b\) => b\.className === origem\?\.className/);
});

test('Planejamento aberto: a escolha "Como você quer revisar?" vem clara só na cópia do painel', () => {
  const ctx = { window: { addEventListener() {} }, document: { addEventListener() {}, querySelector: () => null, getElementById: () => null }, CSS: { escape: (s) => s } };
  vm.createContext(ctx);
  vm.runInContext(`${plj}\nthis.prepara = pljPreparaDocumento; this.d3 = PLJ_DOC_D3;`, ctx);
  const doc = '<!doctype html><html><head><style>.escolha{background:#111}</style></head><body class="no-painel"><div class="escolha"></div></body></html>';
  const pronto = ctx.prepara(doc);
  assert.ok(pronto.indexOf('id="plj-d3"') > pronto.indexOf('.escolha{background:#111}'), 'a folha clara vem depois da escura');
  assert.ok(pronto.indexOf('id="plj-d3"') < pronto.indexOf('</head>'));
  assert.match(ctx.d3, /body\.no-painel \.escolha\{[^}]*background:var\(--d3-areia\)/);
  assert.match(ctx.d3, /body\.no-painel \.escolha \.op\{[^}]*border-radius:20px;background:var\(--d3-cartao\)/);
  assert.match(ctx.d3, /\.op:hover \.op-ir[^{]*\{background:var\(--d3-tinta\);color:#FFFFFF\}/, 'botão principal preto');
  assert.match(ctx.d3, /postMessage\(\{vybe:'planejamento-esc'\}/);
  assert.doesNotMatch(ctx.d3, /#e8602e|#ff9d00/i, 'sem o laranja do tema escuro');
  assert.equal(ctx.prepara('<p>sem head</p>').startsWith('<style id="plj-d3">'), true);
});

test('Planejamentos: todo botão que começa um planejamento tem nome com verbo', () => {
  assert.match(mplj, /const rotuloNovo = \(p\) => `aria-label="Começar o planejamento de \$\{esc\(p\.cliente\)\}"`/);
  const novos = mplj.match(/data-plj-novo="[^`]*`/g) || [];
  assert.ok(novos.length >= 3);
  for (const n of novos) assert.match(n, /rotuloNovo\(/, `botão com nome: ${n.slice(0, 60)}`);
});

test('Automações › Nova regra: Esc e troca de tela fecham, foco volta, prévia clara e "Criar regra" desligado', () => {
  const fechar = auto.slice(auto.indexOf('function fecharConstrutor'), auto.indexOf('// Toda mudança no rascunho'));
  assert.match(fechar, /e\.key !== 'Escape'/);
  assert.match(fechar, /fecharConstrutor\(\);\r?\n\s*\}, true\);/, 'Esc em captura');
  assert.match(fechar, /\.vv-trilho \[data-trilho\], \.vv-trilho \[data-submodulo\]/, 'clique no trilho fecha');
  assert.match(fechar, /origem\?\.isConnected/, 'o foco volta a quem abriu');
  const construtor = auto.slice(auto.indexOf('function pintarConstrutor'), auto.indexOf('async function salvarAutomacao'));
  // V2 · S (prancha V2-S-Automacoes-Regra, 19/11/2026): passos numerados, a frase ao lado e Criar regra desligado com o motivo.
  assert.match(construtor, /<span class="rg2-n" aria-hidden="true">\$\{n\}<\/span>/);
  assert.match(construtor, /class="rg2-frase/);
  assert.doesNotMatch(construtor, /auto-frase-final|auto-salvar|auto-construtor-botoes/, 'fora das classes presas ao tema escuro');
  assert.match(construtor, /class="v2g-btn k rg2-criar" onclick="salvarAutomacao\(\)" \$\{problema \? \x60disabled/);
  assert.match(construtor, /onclick="ensaiarRascunho\(\)"/, 'Testar numa peça é o ensaio na tela');
  assert.doesNotMatch(construtor, / — /, 'sem travessão nos textos do construtor');
  const sd = ler('padrao-v2/s-d.css');
  assert.match(sd, /#automacoes-root \.rg2-lado \.v2g-btn\.k\.rg2-criar:disabled\{[^}]*color:var\(--d3-fume-apagado\)/);
  assert.match(sd, /#automacoes-root \.rg2-n\{[^}]*background:var\(--d3-tinta\)/, 'números sem laranja');
  assert.ok(junto.includes('/* ===== padrao-v2/s-d.css ===== */'), 'o juntador levou o fragmento da frente d');
});
