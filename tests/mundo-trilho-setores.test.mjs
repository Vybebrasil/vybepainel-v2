// SAFE: só lê o vybe-mundo.js e avalia a lista do trilho em memória.
// Paulo, 07/11/2026: módulos em setores com submódulos (ideia do AgencyFlow), sem tirar nenhum módulo que já existia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // checkout no Windows
const ini = js.indexOf('  const TRILHO = [');
const fim = js.indexOf('  const subVisivel', ini);
// Avalia o bloco do trilho (TRILHO, SUBMODULOS e setorDe) com um svg falso.
const { TRILHO, SUBMODULOS, setorDe } = new Function('svg', `${js.slice(ini, fim)}; return { TRILHO, SUBMODULOS, setorDe };`)((d) => `<svg>${d}</svg>`);

test('trilho por setores: o separador não quebra a lista (String.prototype.sub existe)', () => {
  assert.ok(TRILHO.includes('-'));
  assert.ok(SUBMODULOS.length > 10);
  assert.ok(SUBMODULOS.every((x) => x.id && x.nome && x.setor.startsWith('setor:')));
});

test('trilho por setores: nenhum módulo antigo sumiu', () => {
  const diretos = TRILHO.filter((t) => typeof t === 'object').map((t) => t.id);
  const todos = new Set([...diretos, ...SUBMODULOS.map((x) => x.id)]);
  for (const id of ['hoje', 'gestao', 'tarefas', 'criar', 'gestor', 'direcao', 'agenda', 'clientes', 'equipe', 'jogos', 'predio', 'perfil', 'vybes'])
    assert.ok(todos.has(id), `o módulo ${id} continua no trilho`);
  assert.equal(setorDe('agenda'), 'setor:producao');
  assert.equal(setorDe('hoje'), 'hoje');
});

test('Planejamentos (Centro de Operação) está em Produção e usa a janela de sempre', () => {
  const p = SUBMODULOS.find((x) => x.id === 'planejamentos');
  assert.equal(p.setor, 'setor:producao');
  assert.deepEqual(p.mod, ['VybePlanejamentos']);
  const mod = readFileSync(new URL('../vybe-mundo-planejamentos.js', import.meta.url), 'utf8');
  assert.match(mod, /area=planejamentos&acao=operacao/);
  assert.match(mod, /window\.abrirPlanejamento\(/);
  assert.match(mod, /zona === 'operacao'/);
});

// Dock no jeito do AgencyFlow (Paulo, 08/11/2026): categorias, setor que abre para baixo e a Visão geral de cada setor.
test('dock: setores e atalhos em categorias, na ordem Operação, Negócio, Time e Vybe', () => {
  const grupos = TRILHO.filter((t) => typeof t === 'object' && t.grupo).map((t) => t.grupo);
  assert.deepEqual([...new Set(grupos)], ['Operação', 'Negócio', 'Time', 'Vybe']);
  for (const t of TRILHO) if (typeof t === 'object' && Array.isArray(t.sub)) assert.ok(t.grupo, `${t.id} tem categoria`);
  assert.equal(TRILHO.find((t) => t.id === 'hoje').grupo, undefined, 'Hoje fica no topo, fora das categorias');
});

test('dock: cada setor (menos a Gestão, que já é a visão geral) abre a Visão geral do setor', () => {
  assert.match(js, /data-visao-setor="\$\{t\.id\}">Visão geral<\/button>/);
  assert.match(js, /if \(id === 'setor:gestao'\) \{ usarTrilho\('gestao'\); return; \}/);
  assert.match(js, /if \(dockLargo\(\)\) abrirVisaoSetor\(id\); else abrirSetor\(/);
  const setor = readFileSync(new URL('../vybe-mundo-setor.js', import.meta.url), 'utf8');
  for (const id of ['setor:producao', 'setor:clientes', 'setor:comercial', 'setor:financas', 'setor:pessoas']) assert.ok(setor.includes(`'${id}'`), `visão geral de ${id}`);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('/vybe-mundo-setor.js') > html.indexOf('/vybe-mundo.js'), 'o painel do setor carrega depois do mundo');
});

test('o Painel de trabalho (Gestor) é da Produção e toda navegação fecha o que estava aberto', () => {
  assert.equal(setorDe('gestor'), 'setor:producao');
  assert.match(js, /function limparTela\(\) \{/);
  assert.match(js, /if \(id !== 'criar' && id !== 'vybes'\) \{\n      limparTela\(\);/);
});
