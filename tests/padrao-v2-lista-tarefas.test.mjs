import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2 (12/11/2026): Minhas tarefas é o quadro B2 do moodboard aprovado, elemento por elemento.
const js = fs.readFileSync('vybe-mundo.js', 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync('vybe-mundo.css', 'utf8').replace(/\r\n/g, '\n');
const tela = js.slice(js.indexOf('// ===== Minhas tarefas pelo quadro D3-Tarefas'), js.indexOf('  function acaoDoHoje('));

test('a tela segue a ordem do quadro D3-Tarefas: topo, faixa do guia, números, lista e as duas colunas', () => {
  assert.ok(tela.length > 2000);
  const ordem = ['<div class="d3h d3h-tf">', 'dir: `${diaDe}${segDono}${criarHtml}`', '${faixa}', '${numeros}', '<div class="d3h-col">${tarefas}</div>', 'decidirHtml()', 'agentesD3Html(', 'compromissosD3Html()', "whatsappD3Html('tarefas')", 'aprovacoesD3Html()'];
  let p = -1; for (const parte of ordem) { const i = tela.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; }
  // O que o quadro não tem saiu da tela.
  for (const velho of ['vv-hoje-dias', 'vv-anel', 'data-pergunta', 'vv-chips', 'vv-blocos-prio', 'guiaHtml(']) assert.ok(!tela.includes(velho), `saiu ${velho}`);
});

test('faixa do guia com os três primeiros passos e Começar, e os quatro números com barra', () => {
  assert.match(tela, /const passosFaixa = ordemGuia\.slice\(0, 3\)/);
  assert.match(tela, /botao: passosGuia\[0\] \? 'Começar' : '', attrs: passosGuia\[0\]\?\.attrs/);
  assert.match(tela, /rotulo: 'Para hoje'[\s\S]{0,400}rotulo: 'Atrasadas'[\s\S]{0,500}rotulo: 'Feitas na semana', valor: n0\(feitas\.length\)[^\n]{0,80}barra:/);
});

test('filtros Hoje, Semana, Todas, Atrasadas e Feitas, a busca e Filtros', () => {
  // Todas (13/11/2026) fica entre Semana e Atrasadas: a fila inteira, na ordem.
  assert.match(tela, /const GRUPOS = \{ hoje: \['Hoje', hojeP, 'Hoje, na ordem'[^\]]*\], semana: \['Semana', semanaP[^\]]*\], todas: \['Todas', naFila, 'Todas, na ordem', 'Nada aberto\.'\], atrasadas: \['Atrasadas', atrasadasP[^\]]*\], feitas: \['Feitas', feitas[^\]]*\] \};/);
  assert.match(tela, /class="v2t-busca" data-busca-tarefas placeholder="Buscar nas minhas tarefas"/);
  assert.match(tela, /<div class="v2-lista d3h-lista" aria-label="Minha fila">/, "a busca repinta só a lista; fichas e campo ficam fora dela");
  assert.match(tela, /aria-pressed="\$\{hojeVerTodas\}">Filtros<\/button>/);
  // A busca redesenha só a lista: o campo não perde o foco.
  assert.match(js, /if \(!e\.target\.matches\?\.\('\[data-busca-tarefas\]'\)\) return;\n    buscaTarefas = e\.target\.value; linhaAberta = ''; soListaAgora = true; pintarHoje\(\); soListaAgora = false;/);
  assert.match(tela, /const atual = soListaAgora \? el\.querySelector\('\.v2-lista'\) : null;/);
});

test('a linha: bolinha que conclui, cliente e peça, status que troca ali, quando e a seta', () => {
  const linha = tela.slice(tela.indexOf('const linha = (x) =>'), tela.indexOf('function listaHtml()'));
  const ordem = ['class="v2t-cx', 'class="v2t-nome"', 'class="v2t-st"', 'class="v2t-quando"', 'class="v2-linha-seta"'];
  let p = -1; for (const parte of ordem) { const i = linha.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; }
  assert.match(linha, /onclick="openStatusEditor\(event,'\$\{id\}'\)" title="Trocar o status"/);
  assert.match(linha, /data-hoje-acao="concluir" data-valor="\$\{id\}"/);
});

test('a linha abre no lugar com etapas, o motivo, Passar bastão e Abrir; abrir não redesenha a tela', () => {
  assert.match(tela, /\['Briefing', 'Texto', 'Arte', 'Aprovação', 'Publicar'\]/);
  assert.match(tela, /<div class="v2-mais"><div><div class="v2t-det">\$\{etapasHtml\(x\.d\)\}/);
  assert.match(tela, />Passar bastão<\/button>`\}<button type="button" class="d3h-btn s k" data-hoje-acao="peca" data-valor="\$\{id\}">Abrir<\/button>/);
  assert.match(js, /if \(acao === 'linha'\) \{ linhaAberta = linhaAberta === String\(valor\) \? '' : String\(valor\); aplicarLinhaAberta\(\); return; \}/);
});

test('a bolinha grava pelo caminho de sempre e a linha volta se não gravar', () => {
  const c = js.slice(js.indexOf("if (acao === 'concluir') {"), js.indexOf("if (acao === 'peca')"));
  assert.match(c, /opcoes\.find\(\(o\) => \/\^finalizad\/i\.test/);
  assert.match(c, /Promise\.resolve\(updateFocusStatus\(String\(valor\), fim\.label\)\)\.catch\(\(\) => \{\}\)\.finally\(/);
  assert.doesNotMatch(c, /fetch\(/);
});

test('o CSS entra no fim, com as medidas do quadro e sem forçar nada', () => {
  const fim = css.slice(css.indexOf('PADRÃO V2 · MINHAS TAREFAS EM LISTA ÚNICA'));
  assert.ok(fim.length > 2000);
  assert.doesNotMatch(fim, /!important|html body\.mundo|overflow-x:auto/);
  // Limpeza de 14/11/2026: a regra de .v2t-grade saiu na poda das regras mortas (nenhum JS/HTML monta mais .v2t-grade).
  assert.match(fim, /#vv-hoje \.v2t-fichas \.v2t-ficha\[aria-selected="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(fim, /#vv-hoje \.v2t-st\{flex:none;width:150px/);
  assert.match(fim, /#vv-hoje \.v2t-det\{[^}]*margin:0 0 12px 30px;padding:12px 14px;border-radius:14px;background:#F9F8F5\}/);
});
