// SAFE: os movimentos que faltavam do moodboard (13/11/2026) — a base em vybe-core.js e onde cada um foi ligado.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const core = ler('vybe-core.js');

test('base: vbTransicao troca na hora sem suporte, com menos movimento ou com a aba escondida', () => {
  const ini = core.indexOf('const VB_VT_MAX'), fim = core.indexOf('// 5 · Edita no lugar');
  let chamou = 0;
  const doc = { hidden: false, documentElement: { classList: { contains: () => false } }, querySelectorAll: () => [] };
  const c = vm.createContext({ document: doc, matchMedia: () => ({ matches: false }), innerHeight: 900, innerWidth: 1440 });
  vm.runInContext(core.slice(ini, fim), c);
  c.vbTransicao(() => chamou++);
  assert.equal(chamou, 1, 'sem startViewTransition, atualiza direto');
  doc.startViewTransition = () => { throw new Error('não devia chamar'); };
  c.matchMedia = () => ({ matches: true });
  vm.runInContext('vbTransicao(() => 0)', c);
  assert.ok(core.includes("matchMedia('(prefers-reduced-motion: reduce)').matches;"));
  assert.ok(core.includes("if (usados.has(nome) || !vbVisivelNaTela(el)) continue;"), 'chave repetida não voa (o navegador recusaria)');
});

test('cor do humor: a nota vira --humor de 0 a 100 e o nível', () => {
  const c = vm.createContext({});
  vm.runInContext(core.slice(core.indexOf('function vbHumorAttr'), core.indexOf('\n', core.indexOf('function vbHumorAttr'))), c);
  assert.equal(c.vbHumorAttr(73), ' style="--humor:73" data-humor="bom"');
  assert.equal(c.vbHumorAttr(150), ' style="--humor:100" data-humor="bom"');
  assert.equal(c.vbHumorAttr(10), ' style="--humor:10" data-humor="ruim"');
  assert.equal(c.vbHumorAttr('x'), '');
});

test('ligações: troca de visão, chip que voa, edita no lugar e cor do humor nas telas', () => {
  const dem = ler('vybe-demandas.js'), mundo = ler('vybe-mundo.js'), com = ler('vybe-mundo-comercial.js'), ag = ler('vybe-agenda.js'), gest = ler('vybe-gestor.js');
  assert.ok(dem.includes("vbTransicao(() => alternarAgendaDeDemandas(), { raiz: '#painel-demandas', tipo: 'visao' })"), 'Demandas: lista ↔ calendário');
  assert.ok(dem.includes('data-vt="peca-${id}"') && ag.includes('data-vt="peca-${safeText(String(item.id))}" class="manager-calendar-event'), 'a mesma chave na linha e no dia do calendário');
  assert.ok(dem.includes("vbTransicao(() => renderDemandas(), { raiz: '#painel-demandas', tipo: 'chip' })"), 'Demandas: chips de visão');
  assert.ok(com.includes("window.vbTransicao(() => pintar(), { tipo: a === 'visao' ? 'visao' : 'chip' })") && com.includes('data-vt="op-${id}"'), 'Funil: quadro ↔ lista');
  assert.ok(mundo.includes("vbTransicao(() => pintarHoje(), { raiz: '#vv-hoje', tipo: 'chip' })") && mundo.includes('data-vt="peca-${id}" aria-expanded="false"'), 'Minhas tarefas: fichas');
  assert.ok(ag.includes("vbTransicao(redesenhar, { raiz: '#workspace-drawer', tipo: 'chip' })") && gest.includes('data-vt="dono-${safeText(String(u.id))}"'), 'gaveta: responsáveis');
  assert.ok(mundo.includes('data-editar-data="veiculacao" data-peca="${id}"') && dem.includes('data-editar-data="prazo" data-peca="${id}"'), 'datas editáveis nas linhas');
  assert.ok(core.includes('await moverDataDoItem(item, campo, iso, { request: pedido });') && core.includes('mostrarDesfazer('), 'grava pela função de sempre, com Desfazer');
  // Direção 3 (13/11/2026): na Saúde da carteira a cor do humor deu lugar à faixa do risco à esquerda da linha
  // (vermelho só no que venceu); o humor segue nas outras telas.
  for (const f of ['vybe-mundo-agentes.js', 'vybe-clientes.js']) assert.ok(ler(f).includes('vbHumorAttr('), f);
  assert.match(ler('vybe-mundo-carteira.js'), /<i class="d3c-faixa \$\{tom\}" aria-hidden="true"><\/i>/);
  const css = ler('padrao-v2/movimentos.css');
  assert.match(css, /prefers-reduced-motion:reduce\)\{::view-transition-group/);
  assert.doesNotMatch(css, /!important|html body\.mundo/);
});
