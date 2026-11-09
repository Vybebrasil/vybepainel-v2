// Listas curtas de peças seguem as regras do painel (Paulo, 09/11/2026: "ainda tem lugar que não segue regras? cada a cor do
// head no cliente? a cor do status? essa data é veiculação ou prazo?").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('pecaDatasHtml: prazo e veiculação sempre com nome, sem deslocar o dia', () => {
  const core = ler('vybe-core.js');
  const ini = core.indexOf('function pecaDatasHtml'), fim = core.indexOf('function atualizarCoresDasCarteiras');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(core.slice(ini, fim), ctx);
  assert.equal(ctx.pecaDatasHtml({ prazo_iso: '2026-11-10', veiculacao_iso: '2026-11-12' }), '<span class="peca-data"><i>Prazo</i> 10/11</span><span class="peca-data"><i>No ar</i> 12/11</span>');
  assert.equal(ctx.pecaDatasHtml({ veiculacao_iso: '2026-12-31T00:00:00' }), '<span class="peca-data"><i>No ar</i> 31/12</span>');
  assert.equal(ctx.pecaDatasHtml({}), '');
});

test('espiar, Gestão e Performance: cliente com cliCor, status com statusCor e datas com nome; nada de data misturada', () => {
  const mundo = ler('vybe-mundo.js'), perf = ler('vybe-mundo-performance.js');
  assert.match(mundo, /<small class="vv-g-meta">\$\{metaPeca\(p\)\}<\/small><em class="vv-g-datas">\$\{datasPeca\(p\)\}<\/em>/);
  assert.match(mundo, /it\.subHtml \?/); assert.match(mundo, /it\.dirHtml \?/);
  assert.match(perf, /subHtml: typeof pecaMetaHtml === 'function' \? pecaMetaHtml\(d\)/);
  assert.match(perf, /dirHtml: typeof pecaDatasHtml === 'function' \? pecaDatasHtml\(d\)/);
  assert.doesNotMatch(mundo + perf, /String\([a-z]\.veiculacao_iso \|\| [a-z]\.prazo_iso \|\| ''\)\.slice\(8, 10\)/, 'data sem nome');
  assert.match(mundo, /\$\{d\.status \? statusCor\(d\) : ''\}/, 'Minhas tarefas com a pílula do status');
  assert.match(mundo, /'Prazo' : ref === String\(d\.veiculacao_iso \|\| ''\)\.slice\(0, 10\) \? 'No ar'/);
});
