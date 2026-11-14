// SAFE: auditoria front x back (14/11/2026), tema regras. Leitura de fonte e funções puras num vm, sem rede.
// - "Pronta" no front é só Finalizado, Feito ou Concluído (VybeDono.util.finalizado), com fallback local igual.
// - Fila de aprovação: regex ancorada no começo do status sem acento ("Aprovado" não é "para aprovar").
// - Prazo interno no cadastro e no sazonal: window.VybePrazoInterno (shared/prazo-interno.js), com fallback.
// - Coordenação: o limite do dia vem de limite_dia (area=series), não de limite_carga.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const HOJE = '2026-11-14'; // sábado
const STATUS = ['Finalizado', 'Feito', 'Concluído', 'Concluido', 'Aprovado', 'Publicado', 'Postado', 'Agendado', 'Para agendar',
  'Para aprovação', 'Em aprovação', 'Ag. Aprovação Cliente', 'Em andamento'];
const PRONTAS = ['Finalizado', 'Feito', 'Concluído', 'Concluido'];

function gestor({ comDono }) {
  const js = ler('vybe-gestor.js');
  const i = js.indexOf('const STATUS_PRONTA_LOCAL'), j = js.indexOf('function getReferenceDate');
  assert.ok(i > 0 && j > i, 'achou statusPronto e isFinishedItem');
  const ctx = vm.createContext({ operationalFlowStatus: (d) => d.status });
  ctx.globalThis = ctx;
  if (comDono) vm.runInContext(ler('vybe-dono-metricas.js'), ctx, { filename: 'vybe-dono-metricas.js' });
  vm.runInContext(js.slice(i, j) + '\nthis.statusPronto = statusPronto; this.isFinishedItem = isFinishedItem;', ctx);
  return ctx;
}

test('pronta: isFinishedItem usa VybeDono.util.finalizado e o fallback local dá o mesmo', () => {
  const com = gestor({ comDono: true }), sem = gestor({ comDono: false });
  assert.equal(typeof com.VybeDono?.util?.finalizado, 'function');
  for (const s of STATUS) {
    const esperado = PRONTAS.includes(s);
    assert.equal(com.isFinishedItem({ status: s }), esperado, `com VybeDono: ${s}`);
    assert.equal(sem.isFinishedItem({ status: s }), esperado, `fallback: ${s}`);
  }
});

test('pronta: o "O time fez hoje" e as listas de feito em vybe-perfis.js não contam Agendado nem Para agendar', () => {
  const js = ler('vybe-perfis.js');
  assert.match(js, /const feitosHoje = snapshot\.movements\.filter\(\(i\) => daStatusPronto\(i\._todayStatus \|\| i\.status\)\)/);
  assert.doesNotMatch(js, /\['Finalizado','Feito','Agendado','Para agendar'\]/);
  assert.doesNotMatch(js, /\['Finalizado','Feito'\]\.includes/);
  assert.match(js, /function daStatusPronto\(status\) \{ return typeof statusPronto === 'function' \? statusPronto\(status\)/);
});

test('aprovação: a fila para aprovar não pega "Aprovado" nem "Ag. Aprovação Cliente"', () => {
  const fontes = {
    'vybe-mundo-conteudo.js': /const esperaAprovacao = \(status\) => \/\^\(para\|em\|aguardando\) aprova\/\.test\(normal\(status\)\)/,
    'vybe-mundo-coordenacao.js': /const paraAprovar = \(d\) => \/\^\(para\|em\|aguardando\) aprova\/\.test\(norm\(d\.status\)\)/,
  };
  for (const [f, re] of Object.entries(fontes)) assert.match(ler(f), re, f);
  const mundo = ler('vybe-mundo.js');
  const i = mundo.indexOf('  function filaDecidir()'), j = mundo.indexOf('  function previaDecidir(');
  const fila = mundo.slice(i, j);
  assert.match(fila, /\/\^\(para\|em\|aguardando\) aprova\/\.test/, 'filaDecidir com a regex ancorada');
  assert.doesNotMatch(fila, /\/aprova\/i\.test/);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const espera = (s) => /^(para|em|aguardando) aprova/.test(norm(s));
  assert.deepEqual(STATUS.filter(espera), ['Para aprovação', 'Em aprovação']);
  assert.equal(espera('Aguardando Aprovação'), true);
});

test('prazo interno: o index.html carrega shared/prazo-interno.js antes do cadastro e do sazonal', () => {
  const html = ler('index.html');
  const p = html.indexOf('src="/shared/prazo-interno.js"');
  assert.ok(p > 0, 'script do prazo interno no index.html');
  assert.ok(p < html.indexOf('src="/vybe-sazonal.js"') && p < html.indexOf('src="/cadastros_governed_v2.js"'));
});

function comPrazo(ctx) {
  ctx.globalThis = ctx;
  vm.runInContext(ler('shared/prazo-interno.js'), ctx, { filename: 'prazo-interno.js' });
  assert.equal(typeof ctx.VybePrazoInterno?.prazoInterno, 'function');
  return ctx;
}

test('prazo interno: o cadastro usa o Prazo de Ouro comum e, sem ele, 7 dias antes', () => {
  const js = ler('cadastros_governed_v2.js');
  assert.doesNotMatch(js, /getOffsetDate\([^)]*, -7\)/, 'nenhum cálculo próprio de 7 dias');
  assert.doesNotMatch(js, /prazo: somar\(veic, -7\)/);
  const fora = js.split('\n(function() {')[0];
  const com = comPrazo(vm.createContext({ console })), sem = vm.createContext({ console });
  sem.globalThis = sem;
  vm.runInContext(fora, com); vm.runInContext(fora, sem);
  // 29/11 menos 7 = 22/11, domingo: volta para a sexta 20/11. 18/11: o ouro passou, fica hoje. 15/11: 2 dias antes.
  for (const [veic, esperado] of [['2026-11-30', '2026-11-23'], ['2026-11-29', '2026-11-20'], ['2026-11-18', HOJE], ['2026-11-15', '2026-11-13']])
    assert.equal(com.cadastroPrazoInterno(veic, HOJE), esperado, veic);
  assert.equal(sem.cadastroPrazoInterno('2026-11-29', HOJE), '2026-11-22', 'fallback: 7 dias antes');
  assert.equal(com.cadastroPrazoInterno('', HOJE), '');
});

test('prazo interno: o sazonal usa o Prazo de Ouro comum e mantém a conta antiga sem ele', () => {
  const js = ler('vybe-sazonal.js');
  const fn = js.match(/function sazonalPrazoDe\(iso\) \{[\s\S]*?\r?\n\}/)[0];
  const rodar = (ctx) => { ctx.HOJE_ISO = HOJE; ctx.sazonalHojeIso = () => HOJE; vm.runInContext(fn + '\nthis.sazonalPrazoDe = sazonalPrazoDe;', ctx); return ctx.sazonalPrazoDe; };
  const com = rodar(comPrazo(vm.createContext({}))), semCtx = vm.createContext({}); semCtx.globalThis = semCtx;
  const sem = rodar(semCtx);
  assert.equal(com('2026-11-29'), '2026-11-20');
  assert.equal(com('2026-11-15'), '2026-11-13');
  assert.equal(sem('2026-11-29'), '2026-11-22');
});

test('coordenação: o limite do dia vem de limite_dia (padrão e por pessoa), não de limite_carga', () => {
  const js = ler('vybe-mundo-coordenacao.js');
  const i = js.indexOf('    const limiteDia = (id) => {'), j = js.indexOf('    const pessoa = pessoaDaFicha(time);');
  assert.ok(i > 0 && j > i, 'achou limiteDia do painel');
  const trecho = js.slice(i, j);
  assert.doesNotMatch(trecho, /S\.limite\?\.pessoas/);
  const fazer = (S) => vm.runInContext(`const LIMITE_DIA = 5; const S = ${JSON.stringify(S)};\n${trecho}\nlimiteDia`, vm.createContext({}));
  const S = { carga: { 7: { sujeito: '7', monday: 'm7' }, 8: { sujeito: '8', monday: 'm8' } },
    limite: { padrao: 8, pessoas: { 7: 20 } }, limite_dia: { padrao: 4, pessoas: { 8: 6 } } };
  const lim = fazer(S);
  assert.equal(lim('m7'), 4, 'limite_carga da pessoa não manda no dia');
  assert.equal(lim('m8'), 6, 'limite_dia da pessoa manda');
  assert.equal(lim('m9'), 4, 'sem ficha na carga: o padrão de limite_dia');
  assert.equal(fazer(null)('m8'), 5, 'sem a série: 5');
  assert.equal(fazer({ carga: {}, limite: { padrao: 8 } })('m8'), 5, 'série sem limite_dia: 5');
});
