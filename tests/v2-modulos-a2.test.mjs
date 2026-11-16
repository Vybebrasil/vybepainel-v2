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
