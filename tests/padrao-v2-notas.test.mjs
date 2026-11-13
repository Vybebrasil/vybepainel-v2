// Padrão v2, grupo "notas" (13/11/2026): o quadro DEPOIS "Janelas do topo" diz que Notas, Agenda, Boletim e Ajuda
// abrem na mesma janela da Busca e dos Avisos: 340 de largura, mesmo cabeçalho (nome, etiqueta e X redondo de 30),
// embaixo do ícone, pé com a dica. As Notas abrem pequenas; "Abrir grande" leva à janela solta de sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('padrao-v2/notas.css'), notas = ler('vybe-notas.js'), topo = ler('vybe-topo.js');
const boletim = ler('vybe-mundo-boletim.js'), tutorial = ler('vybe-mundo-tutorial.js');
const regra = (seletor) => { const i = css.indexOf(seletor + '{'); assert.ok(i >= 0, 'falta a regra ' + seletor); return css.slice(i, css.indexOf('}', i)); };
const safeText = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

test('CSS do grupo: sem forçar e sem html body.mundo; as janelas com 340, branco, raio 24 e o X de 30', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  for (const s of ['#v2-notas.v2nt', '.vbl-fundo #vbl-janela.vbl-janela', '.vv-tour-raiz .vv-tour-janela.v2aj']) {
    const r = regra(s);
    assert.match(r, /width:340px/, s); assert.match(r, /border-radius:24px/, s); assert.match(r, /background:#FFFFFF/, s);
  }
  assert.match(regra('body.ver-agenda #mundo-hud #vv-agenda.vv-agenda'), /border-radius:24px/);
  for (const s of ['#v2-notas .v2nt-ib', '.vbl-fundo #vbl-janela .vbl-fechar', '.vv-tour-raiz .v2aj .vv-tour-x', 'body.ver-agenda #mundo-hud #vv-agenda .vv-agenda-seta']) {
    const r = regra(s); assert.match(r, /width:30px;height:30px/, s); assert.match(r, /border-radius:50%/, s);
  }
  assert.match(regra('#v2-notas .v2nt-cab'), /padding:14px 14px 10px 18px/);
  assert.match(regra('#v2-notas .v2nt-pe'), /border-top:1px solid #F1EDE6/);
  assert.match(regra('#v2-notas .v2nt-r'), /min-height:40px/);
  assert.match(regra('#v2-notas .v2nt-chip[aria-pressed="true"]'), /background:#1F1D1A;color:#FFFFFF/);
  assert.match(regra('#v2-notas .v2nt-btn.p'), /background:#C2490C/);
  // no celular, de ponta a ponta no alto
  assert.match(css, /@media \(max-width:599px\)\{\s*#v2-notas\.v2nt\{top:8px;left:8px;right:8px;width:auto/);
});

test('janela do topo: abre embaixo do ícone; quem mora no "Mais" abre embaixo dos três pontinhos', () => {
  assert.match(topo, /function colocarJanelaDoTopo\(janela, seletor\)/);
  assert.match(topo, /ancora\.closest\?\.\('\.vv-mais-menu'\)\) ancora = document\.querySelector\('\.vv-barra-topo \.vv-mais-menu > summary'\)/);
  const c = vm.createContext({ innerWidth: 1440, document: {
    querySelector: (s) => (s.includes('summary') ? { getBoundingClientRect: () => ({ width: 40, right: 1351, bottom: 60 }) }
      : { getBoundingClientRect: () => ({ width: 40, right: 1200, bottom: 60 }), closest: () => ({}) }) } });
  vm.runInContext(topo.slice(topo.indexOf('function colocarJanelaDoTopo')), c);
  const jan = { style: {}, atributos: {}, setAttribute(k, v) { this.atributos[k] = v; }, removeAttribute(k) { delete this.atributos[k]; } };
  c.jan = jan;
  assert.equal(vm.runInContext("colocarJanelaDoTopo(jan, '[data-ferr=\"notas\"]')", c), true);
  assert.deepEqual({ ...jan.style }, { top: '68px', right: '89px' });
  c.innerWidth = 390;
  assert.equal(vm.runInContext("colocarJanelaDoTopo(jan, '[data-ferr=\"notas\"]')", c), false, 'no celular a folha de estilo decide');
  assert.deepEqual({ ...jan.style }, { top: '', right: '' });
});

test('Notas: no mundo o ícone abre a janela pequena; "Abrir grande" leva à janela solta, com arrastar e redimensionar', () => {
  assert.match(notas, /if \(notasNoMundo\(\)\) return document\.getElementById\('v2-notas'\) \? fecharNotas\(\) : abrirNotasNoTopo\(\);/);
  assert.match(notas, /janela\.id = 'v2-notas';/);
  assert.match(notas, /colocarJanelaDoTopo\(janela, '\[data-ferr="notas"\]'\)/);
  assert.match(notas, /onclick="abrirNotasGrande\(\)"[^>]*>Abrir grande<\/button>/);
  // a grande continua a de antes
  const grande = notas.slice(notas.indexOf('function abrirNotasGrande'), notas.indexOf('function notasCabTopoHtml'));
  assert.match(grande, /criarNotasGrande\(\)/);
  assert.match(notas, /onpointerdown="notasArrastar\(event\)"/);
  assert.match(notas, /onpointerdown="notasRedimensionar\(event\)"/);
  assert.match(notas, /onclick="renomearCadernoAtual\(\)"/, 'renomear e apagar caderno seguem na grande');
  assert.match(notas, /onclick="mandarNotaParaPeca\(\)"/, 'mandar para a peça segue na grande');
  // fecha por fora e com Esc, como as outras janelas do topo
  assert.match(notas, /document\.addEventListener\('pointerdown', notasForaDoTopo, true\)/);
});

test('Notas: cabeçalho, fichas dos cadernos, linhas e pé montados pelo quadro', () => {
  const pintado = { id: 'v2-notas', innerHTML: '', querySelector: () => null };
  const c = vm.createContext({ console, safeText, localStorage: { getItem: () => null, setItem() {} },
    window: { addEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {}, querySelector: () => null,
      getElementById: (id) => (id === 'v2-notas' ? pintado : null), body: { classList: { contains: () => true } } },
    quandoNaBahia: () => '12/11 às 10:14' });
  vm.runInContext(notas, c);
  vm.runInContext(`NOTAS_CADERNOS = [{ nome: 'Notas do dia', notas: 2 }, { nome: 'Clientes', notas: 1 }];
    NOTAS = [{ id: 7, titulo: 'Reunião', corpo: 'x', caderno: 'Notas do dia', atualizado_em: '2026-11-12' }, { id: 8, titulo: 'Outra', corpo: '', caderno: 'Clientes' }];
    NOTAS_CADERNO = 'Notas do dia'; pintarNotasNoTopo();`, c);
  const h = pintado.innerHTML;
  assert.match(h, /<h2 id="v2nt-titulo">Notas<\/h2>\s*<span class="v2nt-pill">3 notas<\/span>/);
  assert.match(h, /aria-label="Fechar as notas"/);
  assert.match(h, /class="v2nt-busca" type="search" placeholder="Buscar nas notas"/);
  assert.match(h, /class="v2nt-chip" aria-pressed="true"[\s\S]*?>Notas do dia<i>2<\/i>/);
  assert.match(h, /<p class="v2nt-g">Notas do dia<\/p>/);
  assert.equal((h.match(/class="v2nt-r"/g) || []).length, 1, 'só as notas do caderno escolhido');
  assert.match(h, /<b>Reunião<\/b>[\s\S]*?<span class="v2nt-sub">12\/11 às 10:14<\/span>/);
  assert.match(h, /<div class="v2nt-pe"><span class="v2nt-dica">salva sozinha enquanto você escreve<\/span><button type="button" class="v2nt-btn p" onclick="novaNota\(\)">Nova nota<\/button>/);
  // a nota abre no lugar da lista, com a volta e a escrita por linhas
  vm.runInContext("abrirNota(7)", c);
  assert.match(pintado.innerHTML, /aria-label="Voltar para as notas"/);
  assert.match(pintado.innerHTML, /class="v2nt-titulo" value="Reunião"/);
  assert.match(pintado.innerHTML, /class="nota-folha"/);
  assert.match(pintado.innerHTML, />Pronto<\/button>/);
});

test('Boletim e Ajuda: o nome, a etiqueta e o X no cabeçalho, embaixo do "Mais"', () => {
  assert.match(boletim, /<h2 id="vbl-titulo"[^>]*>Boletim<\/h2>/);
  assert.match(boletim, /class="vbl-etiqueta \$\{etiqueta\[0\]\}"/);
  assert.match(boletim, /G\.colocarJanelaDoTopo\(jan, '\[data-boletim\]'\)/);
  assert.match(tutorial, /h\('h2', \{ class: 'vv-tour-titulo', id: 'vv-tour-ajuda-titulo' \}, 'Ajuda'\)/);
  assert.match(tutorial, /class: 'vv-tour-janela v2aj'/);
  assert.match(tutorial, /G\.colocarJanelaDoTopo\?\.\(janela, '\[data-ferr="ajuda"\]'\)/);
  assert.match(tutorial, /h\('div', \{ class: 'vv-tour-janela-pe' \}, zerar, refazer\)/, 'pé com Zerar e Refazer o passeio');
});
