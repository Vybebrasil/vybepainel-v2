// SAFE: só lê o vybe-mundo.js e avalia a lista do trilho em memória.
// Paulo, 07/11/2026: módulos em setores com submódulos (ideia do AgencyFlow), sem tirar nenhum módulo que já existia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
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
