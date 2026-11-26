// SAFE: sistema leve 2 (26/11/2026) — as regras com :has() sem nome à direita viraram marcas que o JS põe no elemento
// certo, e a trava do voo saiu da classe no <html>. Só lê arquivos e roda funções puras com um DOM de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const core = ler('vybe-core.js'), mundo = ler('vybe-mundo.js'), midia = ler('vybe-mundo-midia.js');
const folhas = ['vybe-mundo.css', 'vybe-styles.css', 'vybe-mundo-padrao-v2.css', 'padrao-v2/z-direcao.css'].map(ler).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

test('as quatro regras pesadas saíram das folhas', () => {
  for (const velho of [':has(> #vv-hoje > .d3q)', 'body.mundo:has(> #workspace-drawer) #mundo-hud', 'body.mundo:has(> #workspace-drawer) .vv-canto-modulo',
    'body:has(> #workflow-modal.ofc-xdz)', '[class*="-kicker"]:has(button,a,input,select) >']) assert.ok(!folhas.includes(velho), velho);
  assert.ok(folhas.includes('#mundo-hud > #vv-hoje.vv-hoje.com-d3q:not(#sem-d3q){margin-top:-62px}'));
  assert.ok(folhas.includes('#mundo-hud > #vv-hoje.com-d3q ~ .vv-topo .vv-ferramentas > *{pointer-events:auto;margin-left:0}'));
  assert.ok(folhas.includes('body:where(.mundo) #mundo-hud.com-gaveta:not(#sem-gaveta) > :not(.vv-trilho){visibility:hidden}'));
  assert.ok(folhas.includes('body.com-xadrez:not(#sem-xadrez) > :not(#workflow-modal,#workflow-backdrop,.versao-nova,.snc-perfil,script,style){content-visibility:hidden}'));
});

test('o kicker com botão vai pelos nomes: todo "-kicker" usado no código está na lista', () => {
  const lista = folhas.match(/html body\.mundo :is\(([^)]*)\):has\(button,a,input,select\) > :not\(/)[1].split(',').map((x) => x.slice(1));
  const fontes = ['vybe-core.js', 'vybe-mundo.js', 'vybe-perfis.js', 'vybe-portoes.js', 'vybe-mundo-tutorial.js', 'vybe-mundo-tutorial.css', 'vybe-styles.css', 'vybe-mundo.css'].map(ler).join('\n');
  for (const nome of new Set(fontes.match(/(?<![\w-])[a-z][a-z0-9-]*-kicker(?![\w-])/g))) assert.ok(lista.includes(nome), nome);
});

test('vbMarcasDoCorpo: com-gaveta no HUD e no canto, com-xadrez no body, só enquanto são filhos do body', () => {
  const classes = () => { const s = new Set(); return { s, toggle: (c, v) => (v ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; };
  const hud = { classList: classes() }, canto = { classList: classes() };
  const filhos = new Set();
  const body = { classList: classes(), querySelector: (q) => (q === ':scope > #workspace-drawer' ? filhos.has('gaveta') : q === ':scope > #workflow-modal.ofc-xdz' ? filhos.has('xadrez') : null) || null };
  const document = { body, getElementById: (id) => (id === 'mundo-hud' ? hud : null), querySelectorAll: (q) => (q === '.vv-canto-modulo' ? [canto] : []) };
  const c = vm.createContext({ document });
  vm.runInContext(core.slice(core.indexOf('function vbMarcasDoCorpo'), core.indexOf('if (typeof document !== \'undefined\' && document.body && typeof MutationObserver')), c);
  c.vbMarcasDoCorpo();
  assert.ok(!hud.classList.s.has('com-gaveta') && !body.classList.s.has('com-xadrez'));
  filhos.add('gaveta'); c.vbMarcasDoCorpo();
  assert.ok(hud.classList.s.has('com-gaveta') && canto.classList.s.has('com-gaveta'));
  filhos.delete('gaveta'); filhos.add('xadrez'); c.vbMarcasDoCorpo();
  assert.ok(!hud.classList.s.has('com-gaveta') && !canto.classList.s.has('com-gaveta') && body.classList.s.has('com-xadrez'));
  assert.ok(core.includes("new MutationObserver(vbMarcasDoCorpo).observe(document.body, { childList: true })"), 'só os filhos do body, sem a subárvore');
});

test('o voo não marca mais o <html> com classe; o Hoje marca com-d3q; a Mídia repinta uma vez por quadro', () => {
  assert.ok(!core.includes("'vb-voando'"), 'a trava do voo é a variável vbVoando');
  assert.ok(core.includes('|| document.hidden || vbVoando) {') && core.includes("vbVoando = true; document.documentElement.dataset.vbVoo = tipo;"));
  assert.ok(mundo.includes("h.classList.toggle('com-d3q', Boolean(h.querySelector(':scope > .d3q')));"));
  assert.ok(mundo.includes('new MutationObserver(marcarHojeD3q).observe(h, { childList: true })'));
  assert.ok(midia.includes('(dias === estado.dias || dias === 7)) pintarCorpoNoQuadro();'), 'cada cliente que chega pede o quadro');
  assert.ok(midia.includes('quadro(() => { corpoNoQuadro = false; if (janela && !janela.hidden) pintarCorpo(); });'));
});
