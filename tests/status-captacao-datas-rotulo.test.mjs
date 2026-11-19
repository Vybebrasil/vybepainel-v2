// Status e captação separados; toda data com o nome (Paulo, 19/11/2026: "na tabela onde aparece o status, juntou status
// e status de captação... são coisas diferentes. Assim como quando aparecer uma data, precisa tá claro se é prazo ou
// veiculação"). Padrão único: cabeçalho "Prazo" / "Veiculação"; data solta "prazo 13/11" / "veic. 13/11".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const core = ler('vybe-core.js'), gestor = ler('vybe-gestor.js'), mundo = ler('vybe-mundo.js');
const fatia = (src, ini) => { const i = src.indexOf(ini); assert.ok(i >= 0, ini); const m = /\r?\n\}\r?\n/.exec(src.slice(i)); return src.slice(i, i + m.index + m[0].length); };

test('captação tem etiqueta própria, com o nome, e não entra na pílula do status', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fatia(core, 'function capRotuloHtml(d)') + 'this.cap = capRotuloHtml;', ctx);
  assert.equal(ctx.cap({ captacao: 'Agendada' }), '<span class="cap-rotulo" title="Status da captação: Agendada"><i>Captação</i> Agendada</span>');
  assert.equal(ctx.cap({ captacao: '—' }), ''); assert.equal(ctx.cap({}), '');
  assert.equal(ctx.cap({ captacao: '<b>' }), '<span class="cap-rotulo" title="Status da captação: &lt;b>"><i>Captação</i> &lt;b></span>');
  // A pílula do status só lê o status.
  assert.doesNotMatch(fatia(gestor, 'function pv2StatusBotao(d)'), /captacao/);
  // Onde as duas apareciam coladas (a pílula da captação antes da do status, sem nome), agora cada uma tem a sua.
  assert.doesNotMatch(gestor, /\$\{d\.captacao \? pillHtml\(d\.captacao\) : ''\}/);
  assert.match(gestor, /\$\{managerStatusControl\(d\)\}\r?\n\s+\$\{capRotuloHtml\(d\)\}/);
  // Semana › Por dia e Minhas tarefas: a captação aparece com o nome na linha aberta.
  assert.match(fatia(gestor, 'function pv2CartaoHtml('), /\$\{datas\}<\/p>` : ''\}\$\{capRotuloHtml\(d\)\}/);
  assert.equal((mundo.match(/typeof capRotuloHtml === 'function' \? capRotuloHtml\(x\.d\) : ''/g) || []).length, 2, 'aba do Hoje e módulo do dock');
  // Grupos e a ficha seguem com Status e Captação em colunas separadas.
  assert.match(gestor, /th\('status', 'Status'\)/); assert.match(gestor, /th\('captacao', 'Captação'\)/);
  assert.match(ler('vybe-agenda.js'), /captacao:\s+\{ rotulo: 'Captação'/);
});

test('toda data diz o que é: Prazo/Veiculação no cabeçalho, "prazo 13/11" e "veic. 13/11" soltas', () => {
  assert.match(gestor, /th\('prazo_iso', 'Prazo'\) \+ th\('veiculacao_iso', 'Veiculação'\)/, 'Grupos: o cabeçalho diz Veiculação');
  assert.match(gestor, /<td data-label="Veiculação"/);
  assert.match(fatia(gestor, 'function pv2CartaoHtml('), /`veic\. \$\{pv2DiaMes\(d\.veiculacao_iso\)\}`/);
  // Por dia: a atrasada vem com a data e o nome, não "há 3 dias" solto.
  const ctx = vm.createContext({ HOJE_ISO: '2026-11-19', atividadeDoDiaConcluida: () => false, pv2DiaMes: (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}` });
  vm.runInContext(fatia(gestor, 'function d3pQuando(d, data)') + 'this.q = d3pQuando;', ctx);
  assert.deepEqual({ ...ctx.q({ veiculacao_iso: '2026-11-16', prazo_iso: '2026-11-12' }, '2026-11-16') }, { texto: 'veic. 16/11', dica: 'venceu há 3 dias', tom: 'r' });
  assert.deepEqual({ ...ctx.q({ prazo_iso: '2026-11-18' }, '2026-11-18') }, { texto: 'prazo 18/11', dica: 'venceu ontem', tom: 'r' });
  assert.equal(ctx.q({ prazo_iso: '2026-11-25', veiculacao_iso: '2026-11-28' }, '2026-11-28').texto, 'prazo 25/11');
  // As listas do mundo (pecaDatasHtml), Minhas tarefas e a Coordenação usam o mesmo padrão.
  assert.match(core, /<i>Prazo<\/i> \$\{prazo\}<\/span>` : ""\) \+ \(ar \? `<span class="peca-data"><i>Veic\.<\/i>/);
  assert.match(mundo, /<small>\$\{campo === 'prazo' \? 'prazo' : 'veic\.'\}<\/small>/);
  assert.match(ler('vybe-mundo-coordenacao.js'), /dataBt\(d, 'veiculacao', 'Veic\.'\)/);
  for (const [f, src] of [['vybe-gestor.js', gestor], ['vybe-mundo.js', mundo], ['vybe-core.js', core]]) assert.doesNotMatch(src, /['`>]no ar \$\{|<i>No ar<\/i>|'No ar'\)/, `${f}: sem "no ar" como nome de data`);
});

test('CSS da etiqueta de captação: só tokens --d3-*', () => {
  const css = ler('padrao-v2/zm-a-0-rotulos.css');
  for (const l of css.split(/\r?\n/).filter((x) => x.includes('{'))) assert.doesNotMatch(l, /!important|html body\.mundo|:has\(|#[0-9a-f]{3,8}\b|rgba?\(/i, l);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('.cap-rotulo{'), 'rodou padrao-v2-juntar');
});
