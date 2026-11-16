// Módulos V2 · grupo A, segunda leva (pranchas V2-M-Minhas-Tarefas e V2-M-Demandas, aprovadas pelo Paulo em 16/11/2026):
// cada módulo no esqueleto da prancha, com as mesmas funções, ids e comandos de antes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const seletores = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('@') && !l.startsWith('}')).map((l) => l.split('{')[0]);

test('Minhas tarefas V2: pelo menu lateral o módulo abre no esqueleto da prancha, com os comandos da aba do Hoje', () => {
  const src = ler('vybe-mundo.js');
  const ini = src.indexOf('    if (tarefasPeloDock) {\n      const formatoDe');
  assert.ok(ini > 0, 'o ramo do módulo existe dentro de desenharHoje');
  const mt = src.slice(ini, src.indexOf('    // ===== Hoje no quadro "Direção de cor e vidro"'));
  for (const f of ['data-hoje-acao="filtro" data-valor="${k}"', 'role="radio" aria-checked="${k === filtroTarefas}"', 'role="switch" aria-checked="${hojeVerTodas}"', 'data-busca-tarefas', 'data-hoje-acao="linha" data-valor="${id}"',
    'data-linha="${id}" data-vt="peca-${id}"', "openStatusEditor(event,'${id}')", 'data-editar-data="veiculacao" data-peca="${id}"', 'data-hoje-acao="concluir" data-valor="${id}"', 'data-hoje-acao="peca" data-valor="${id}"',
    'data-hoje-acao="demandas"', 'data-hoje-acao="agentes"', 'botaoDeBriefingHtml(x.d)', 'botaoDeMaterialBrutoHtml(x.d)', 'botaoDeEntregaHtml(x.d)', 'botaoDePreviaNaLinha(x.d', 'etapasHtml(x.d)', 'motivoNoGuia(x, hoje)',
    'compromissosD3Html()', "whatsappD3Html('tarefas')", 'class="v2-lista d3m-a-mt-lista"', 'aplicarLinhaAberta(el)', 'segDono', 'diaDe']) assert.ok(mt.includes(f), `Minhas tarefas mantém ${f}`);
  // Filtro e "Por status" sem aria-pressed, aria-selected nem role="tab": a folha antiga pinta esses à força.
  assert.doesNotMatch(mt, /aria-pressed|aria-selected|role="tab"/, 'os seletores do módulo usam radio e switch');
  // A primeira da fila vai no laranja, com Abrir a peça e Marcar pronta.
  assert.match(mt, /laranjaD3\(\{ rotulo: `\$\{agente\.nome\} · \$\{varios \? 'a primeira do dia' : 'a sua primeira agora'\}`/);
  assert.match(mt, /botoes: \[\{ rot: 'Abrir a peça', attrs: `data-hoje-acao="peca" data-valor="\$\{esc\(primeiraV2\.d\.id\)\}"` \}, \{ rot: 'Marcar pronta'/);
  // O dock liga o módulo; trocar de aba ou ir para o Hoje desliga, e a aba Minhas tarefas do Hoje continua como estava.
  assert.match(src, /if \(id === 'tarefas'\) \{ visaoHoje = 'tarefas'; tarefasPeloDock = true;/);
  assert.match(src, /if \(!usarTrilho\.tarefas\) tarefasPeloDock = false;/);
  assert.match(src, /if \(tarefasPeloDock && v !== 'tarefas'\) \{ tarefasPeloDock = false; marcarTrilho\('hoje'\); \}/);
  assert.ok(src.includes('const html = `<div class="d3h d3h-tf d3q"><div class="d3q-main">${topoD3({ sub: diaD3(), dir: `${diaDe}${segDono}` })}'), 'a aba do Hoje segue com o esqueleto dela');
  const css = ler('padrao-v2/zm-a-5-tarefas.css');
  assert.doesNotMatch(seletores(css).filter((s) => !s.includes('#vv-hoje')).join('\n'), /\S/, 'todo seletor preso à janela do Hoje');
});

test('Demandas V2: a folha por urgência, a consulta ao lado e o Calendário, com os mesmos ids, funções e comandos de antes', () => {
  const src = ler('vybe-demandas.js');
  const ini = src.indexOf('// ─── Padrão V2 · Demandas pela prancha V2-M-Demandas');
  assert.ok(ini > 0, 'o bloco da prancha existe');
  const dm = src.slice(ini, src.indexOf('try { pv2dMontar(); } catch', ini));
  // Topo, folha e consulta, na ordem da prancha.
  const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
  naOrdem(dm, ['id="pv2d-troca"', '<h2>Demandas</h2>', 'id="pv2d-data"', 'id="pv2d-vistas" role="radiogroup"', 'data-vista="lista"', 'data-vista="calendario"', 'id="pv2d-busca"', 'id="pv2d-busca-bt"', 'id="pv2d-colunas"', 'Nova demanda</button>',
    'id="pv2d-folha"', 'id="pv2d-chips" role="radiogroup"', 'id="pv2d-por-status" role="switch"', 'id="pv2d-lista"', 'id="pv2d-pe"', 'id="pv2d-lado"', 'id="pv2d-alto"', 'id="pv2d-tipos"', 'id="pv2d-abrir"']);
  // Os comandos de sempre: busca, visões, agenda, ordenação, colunas, cadastro, status, responsável e a peça.
  for (const f of ['oninput="buscarClienteDemandas(this.value)"', "onclick=\"escolherVisaoDemanda('${id}')\"", 'alternarAgendaDeDemandas()', 'function pv2dOrdenar(campo) { ordenarPor(campo); pv2dPintar(); }', "onclick=\"cadastrarNoGrupo('demandas','')\"",
    'data-coluna="dem-coluna-id"', 'data-coluna="dem-coluna-cadastro"', "document.getElementById('dem-coluna-id')", '<span class="pv2-cs">${pv2StatusBotao(d)}</span>', 'openOwnerEditor(', 'openItemWorkspace(', 'alternarSelecao(', 'data-editar-data=', 'data-vt=', 'pv2EtapasHtml(d)'])
    assert.ok(dm.includes(f), `Demandas mantém ${f}`);
  // O que era da tela antiga segue vivo pelos mesmos ids, guardado na reserva ou dentro do ⋯.
  for (const id of ['demanda-resumo', 'kpi-grid-demandas', 'dem-visoes', 'grupos-board-demandas', 'panel-demandas-semana', 'panel-demandas-dia', 'panel-demandas-esteira']) assert.ok(dm.includes(`'${id}'`), `reserva ou ⋯ guarda #${id}`);
  assert.match(dm, /reserva\.id = 'pv2-demandas-reserva'; reserva\.hidden = true;/);
  // Escolhas em radio e switch: a folha antiga pinta aria-pressed, aria-selected e role="tab" à força.
  assert.doesNotMatch(dm.slice(0, dm.indexOf('// ─── Padrão v2 · IA e custos') > 0 ? dm.indexOf('// ─── Padrão v2 · IA e custos') : dm.length), /aria-pressed|aria-selected|role="tab"/);
  // Urgência (Agora, Semana, Depois), Por status e Grupos; o laranja do Heitor e o pé De olho.
  assert.match(dm, /const PV2D_URGENCIA = \[\['Agora', 'r'\], \['Semana', ''\], \['Depois', ''\]/);
  assert.match(dm, /function pv2dArrumar\(modo\) \{ pv2dModo = \['urgencia', 'status', 'grupos'\]\.includes\(modo\)/);
  assert.match(dm, /pv2Laranja\(\{ agente: 'H', \.\.\.cartao \}\)/);
  assert.match(dm, /<span>De olho<\/span>/);
  // A janela sabe qual quadro está aberto: a folha das Demandas se prende a isso, sem :has.
  // (O data-quadro da main, que escolhe a janela das telas do grupo E, continua logo antes.)
  assert.match(src, /activeBoard = board;\r?\n(?: {2}\/\/[^\n]*\n| {2}if \(document\.body && document\.body\.dataset\.quadro !== board\) document\.body\.dataset\.quadro = board;\r?\n)* {2}if \(document\.body\) document\.body\.dataset\.pv2Quadro = board;/);
  assert.match(src, /activeBoard = board;[\s\S]{0,400}document\.body\.dataset\.quadro = board;/);
  // O CSS: cada seletor preso à tela, só tokens d3, nada forçado e nenhuma entrada que comece invisível.
  const css = ler('padrao-v2/zm-a-6-demandas.css');
  const partes = seletores(css).flatMap((s) => s.split(/,(?![^(]*\))/)).map((s) => s.trim()).filter(Boolean);
  for (const s of partes) assert.match(s, /^(#pv2-demandas\.pv2\.d3m-a-dm|body\.mundo\.mundo-modulo\[data-pv2-quadro="demandas"\])/, s.slice(0, 80));
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\(/);
  assert.doesNotMatch(css, /@keyframes[^{]*\{\s*(from|0%)\s*\{\s*opacity:\s*0/);
  const vars = [...new Set(css.match(/var\(--[a-z0-9-]+/g) || [])].filter((v) => !['var(--v', 'var(--st'].includes(v) && !/^var\(--(d3-|d3m-|vv-texto|vv-titulo)/.test(v));
  assert.deepEqual(vars, [], 'só tokens --d3-* (mais os do módulo --d3m-*, o --v da barra, o --st da cor do status e as fontes do mundo)');
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/zm-a-6-demandas.css ===== */'), 'o juntador já incluiu o fragmento');
});
