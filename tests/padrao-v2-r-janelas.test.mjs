// Pranchas V2-R das janelas e formulários (19/11/2026): Criar, cartão rápido, notas, aparência, clientes da peça,
// cadastro do cliente, nova demanda e o menu de status com o portão de motivo nos três temas.
// SAFE: só lê arquivos (e roda funções puras num vm quando dá); nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const fragmentos = readdirSync('padrao-v2').filter((f) => /^zm-r-a-.*\.css$/.test(f)).map((f) => `padrao-v2/${f}`);

test('fragmentos zm-r-a: sem !important, sem html body.mundo, sem :has com [style], sem cor escrita', () => {
  assert.ok(fragmentos.length >= 1);
  for (const f of fragmentos) {
    const cru = ler(f), css = semComentario(cru);
    assert.doesNotMatch(css, /!important/, f);
    assert.doesNotMatch(css, /html body\.mundo/, f);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${f}: cor escrita em vez de token`);
  }
});

test('a junção leva os fragmentos zm-r-a para vybe-mundo-padrao-v2.css', () => {
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) assert.ok(junto.includes(`/* ===== ${f} ===== */`), f);
});

test('Criar: janela no vidro fumê, folha de canto 12, escolha com rádio, prévia em rótulo e valor, tipos dizem o que abrem', () => {
  const css = ler('padrao-v2/zm-r-a-1-criar.css');
  assert.match(css, /#vv-criar \.v2cr-janela\{width:min\(840px,100%\);[^}]*border-radius:var\(--d3-r-janela\);background:var\(--d3-fume-forte\)/);
  assert.match(css, /#vv-criar \.v2cr \.v2cr-dem\{padding:0;border-radius:12px;background:var\(--d3-folha\)/);
  assert.match(css, /\.v2cr-op\[aria-checked="true"\] \.v2cr-radio\{box-shadow:inset 0 0 0 5px var\(--d3-tinta\)\}/);
  assert.match(css, /\.v2cr-btn\{height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  const js = ler('vybe-mundo.js');
  assert.match(js, /class="v2cr-janela d3-tema"/, 'no Escuro a folha escurece junto');
  assert.match(js, /o que entra na Vybe começa aqui · /);
  assert.match(js, /<i class="v2cr-radio" aria-hidden="true"><\/i>/);
  assert.match(js, /kv\('Prazos', 'calculados no passo 3'\)/);
  for (const t of ['abre Planejamentos', 'abre o cadastro completo', 'abre Reuniões']) assert.ok(js.includes(t), t);
  // os gatilhos de sempre continuam
  for (const a of ['data-criar="sair"', 'data-criar="demanda"', 'data-criar="continuar"', 'data-criar="sazonal"', 'data-criar-cliente', 'data-criar="sem-cliente"']) assert.ok(js.includes(a), a);
  // o Criar dentro do Hoje mantém a frase do pé
  assert.match(js, /\$\{jan \? '' : '<p class="v2cr-pe">Demanda e Conteúdo seguem/);
});

test('Cartão rápido: vidro fumê, quatro campos em cima, Mais campos em grade, preso ao lado da linha quando cobriria', () => {
  const css = ler('padrao-v2/zm-r-a-2-cartao.css');
  assert.match(css, /\.cr-essenciais \.cr-linha\{display:grid;grid-template-columns:108px minmax\(0,1fr\)/);
  assert.match(css, /\.cr-grade\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.cr-rodape \.cr-abrir\{[^}]*background:var\(--d3-fume-texto\);color:var\(--d3-fume-contra\)/);
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /html body\.mundo \.cartao-rapido\{background:var\(--d3-fume-forte\)!important;[^}]*border-radius:var\(--d3-r-janela\)!important/);
  const agenda = ler('vybe-agenda.js');
  assert.match(agenda, /cartao\.className = 'cartao-rapido d3-tema'/);
  assert.match(agenda, /function ancorarCartaoNaLinha\(cartao, rect\)/);
  assert.match(agenda, /<small class="cr-mais-recolher">recolher<\/small>/);
  assert.match(agenda, /linha\('OFF e áudio'/);
  assert.match(agenda, /linha\('Cadastro', /);
  // o fluxo e os botões de sempre
  for (const t of ["openStatusEditor", "vybeDono(item, 'cr-dono'", "openPlanningEditor", "renomearPeca", "abrirClientesDoItem", "abrirSeletorDeGrupo", "ontoggle=\"window.CR_MAIS_ABERTO=this.open\""]) assert.ok(agenda.includes(t), t);
});

test('Cartão rápido: data curta com o dia da semana', async () => {
  const agenda = ler('vybe-agenda.js');
  const ini = agenda.indexOf("const DIA_SEM = "), fim = agenda.indexOf('const palavrasCli');
  const dataCurta = new Function(`${agenda.slice(ini, fim)}; return dataCurta;`)();
  assert.equal(dataCurta('2026-11-19'), 'qui, 19/11');
  assert.equal(dataCurta('2026-11-20T10:00:00Z'), 'sex, 20/11');
  assert.equal(dataCurta(''), '—');
});

test('Notas grande: três colunas (cadernos, lista, nota aberta) no vidro, com as variáveis no lugar dos valores fixos', () => {
  const notas = ler('vybe-notas.js');
  assert.match(notas, /function notasGrandeHtml\(\)/);
  assert.match(notas, /<div class="notas-conteudo notas-3\$\{aberta \? ' com-nota' : ''\}">/);
  assert.match(notas, /\$\{aberta \? notaGrandeHtml\(\) : '<div class="notas-editor notas-editor-vazio">/);
  assert.match(notas, /<span class="notas-caderno-rot">Caderno escolhido<\/span>/);
  assert.match(notas, /arraste pelo topo, mude o tamanho pelo canto/);
  assert.match(notas, /Number\(g\.largura\) \|\| 880/);
  for (const t of ['onclick="renomearCadernoAtual()"', 'onclick="apagarCadernoAtual()"', 'onclick="mandarNotaParaPeca()"', 'onclick="voltarParaAsNotas()"', 'onclick="apagarNotaAberta()"', 'onclick="salvarNotaAgora()"', 'onpointerdown="notasArrastar(event)"', 'onpointerdown="notasRedimensionar(event)"']) assert.ok(notas.includes(t), t);
  const css = ler('padrao-v2/zm-r-a-3-notas.css');
  assert.match(css, /\.notas-conteudo\.notas-3\{display:grid;grid-template-columns:176px minmax\(0,256px\) minmax\(0,1fr\)/);
  assert.match(css, /@container \(max-width:759px\)/);
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /:is\(section\.notas-janela,#notas-janela\):not\(#ds-a\):not\(#ds-b\)\{background:var\(--d3-fume-forte\)!important/);
  assert.match(mundo, /background:var\(--nt-fundo,transparent\)!important;color:var\(--nt-cor,inherit\)!important/);
});

test('Notas pequena: vidro fumê, contagem de notas e cadernos embaixo do título', () => {
  const css = ler('padrao-v2/zm-r-a-3-notas.css');
  assert.match(css, /#v2-notas\.v2nt\{width:372px;[^}]*background:var\(--d3-fume-forte\)/);
  assert.match(css, /#v2-notas\.v2nt \.v2nt-chip\[aria-pressed="true"\]\{background:var\(--d3-fume-texto\);color:var\(--d3-fume-contra\)\}/);
  const notas = ler('vybe-notas.js');
  assert.match(notas, /janela\.className = 'v2nt d3-tema'/);
  assert.match(notas, /janela\.className = 'notas-janela d3-tema'/);
});

