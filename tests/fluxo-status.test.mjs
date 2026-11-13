// Fluxo do botão principal da peça (Paulo, 13/11/2026): seguir a ordem da lista, escolher o próximo de cada status ou
// sempre perguntar; editável no menu de status por quem administra e guardado para todo mundo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizarFluxo, normalizarFluxoDoQuadro, conferirFluxoDoQuadro, CHAVE_FLUXO_STATUS } from '../server/fluxo-status.js';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const gaveta = ler('vybe-gaveta.js'), status = ler('vybe-status.js'), painel = ler('api/painel.js');

test('servidor: o fluxo é normalizado por quadro, com modo padrão "ordem"', () => {
  assert.equal(CHAVE_FLUXO_STATUS, 'fluxo_status');
  assert.deepEqual(normalizarFluxoDoQuadro(null), { modo: 'ordem', proximo: {} });
  assert.deepEqual(normalizarFluxoDoQuadro({ modo: 'xyz' }).modo, 'ordem');
  assert.deepEqual(normalizarFluxoDoQuadro({ modo: 'proprio', proximo: { a: 'b', c: 'c', d: '', e: '-' } }), { modo: 'proprio', proximo: { a: 'b', e: '-' } }, 'tira o vazio e o que aponta para si');
  assert.deepEqual(normalizarFluxo({ boards: { '123': { modo: 'perguntar' }, abc: { modo: 'ordem' } } }), { boards: { '123': { modo: 'perguntar', proximo: {} } } }, 'quadro só com id numérico');
  assert.equal(conferirFluxoDoQuadro({ proximo: { a: 'b', b: '-' } }, ['a', 'b']), '');
  assert.match(conferirFluxoDoQuadro({ proximo: { a: 'z' } }, ['a', 'b']), /"z" não está/);
});

test('servidor: toda a equipe lê o fluxo; gravar é de quem administra e confere as chaves do catálogo', () => {
  assert.ok(painel.includes("if (req.query?.fluxo === '1') return res.status(200).json({ ok: true, fluxo: await lerFluxoStatus(db) });"));
  const ini = painel.indexOf('async function areaOpcoes'), get = painel.indexOf("req.query?.fluxo === '1'", ini), admin = painel.indexOf("if (!ehAdmin) return res.status(403)", ini), grava = painel.indexOf("if (acao === 'fluxo-status')", ini);
  assert.ok(get > ini && get < admin && admin < grava, 'ler antes da trava de admin; gravar depois');
  assert.ok(painel.includes('conferirFluxoDoQuadro(cfg, (await lerEtiquetas(db, cat)).map((e) => e.chave))'));
});

function gavetaNoVm(opcoes, fluxo) {
  const c = vm.createContext({ console, setTimeout: () => 0, document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    safeText: (t) => String(t ?? ''), findOperationalItem: () => ({}), operationalStatusOptions: () => opcoes, BOARD_ID: 1, BOARD_DEMANDAS_ID: 2,
    isRequestItem: (i) => Boolean(i?.pedido), mesmoStatus: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(), showToast() {} });
  vm.runInContext(gaveta, c);
  vm.runInContext(`FLUXO_STATUS = ${JSON.stringify(fluxo)};`, c);
  return c;
}
const OPCOES = [['afazer', 'A Fazer'], ['andamento', 'Em Andamento'], ['aprovacao', 'Para aprovação'], ['agendar', 'Para agendar'], ['finalizado', 'Finalizado']].map(([chave, label]) => ({ chave, label }));

test('gaveta: o botão principal segue o modo do quadro da peça', () => {
  let c = gavetaNoVm(OPCOES, { boards: {} });
  assert.equal(c.proximoStatusDaPeca({ status: 'Em Andamento' }).label, 'Para aprovação', 'sem fluxo gravado, segue a lista');
  c = gavetaNoVm(OPCOES, { boards: { 1: { modo: 'perguntar', proximo: {} } } });
  assert.equal(c.proximoStatusDaPeca({ status: 'Em Andamento' }), null, 'perguntar: o botão abre o seletor');
  assert.equal(c.proximoStatusDaPeca({ status: 'Em Andamento', pedido: true }).label, 'Para aprovação', 'o outro quadro tem o fluxo dele');
  c = gavetaNoVm(OPCOES, { boards: { 1: { modo: 'proprio', proximo: { andamento: 'finalizado', aprovacao: '-' } } } });
  assert.equal(c.proximoStatusDaPeca({ status: 'Em Andamento' }).label, 'Finalizado', 'o próximo escolhido');
  assert.equal(c.proximoStatusDaPeca({ status: 'Para aprovação' }), null, '"-" pergunta');
  assert.equal(c.proximoStatusDaPeca({ status: 'A Fazer' }).label, 'Em Andamento', 'sem escolha, segue a lista');
  c = gavetaNoVm(OPCOES, { boards: { 1: { modo: 'ordem', proximo: { andamento: 'finalizado' } } } });
  assert.equal(c.proximoStatusDaPeca({ status: 'Em Andamento' }).label, 'Para aprovação', 'no modo ordem, as escolhas guardadas não valem');
});

test('menu de status: o "próximo" é o da gaveta e quem administra edita o fluxo ali mesmo', () => {
  assert.ok(status.includes("const sugerido = i < 0 ? null : (typeof proximoStatusDaPeca === 'function' ? proximoStatusDaPeca(item) : ativas[i + 1]);"));
  assert.ok(status.includes("typeof podeGerirEtiquetas === 'function' && podeGerirEtiquetas()") && status.includes('Ordem e próximo passo'));
  for (const p of ["['ordem', 'Seguir a ordem da lista'", "['proprio', 'Escolher o próximo de cada status'", "['perguntar', 'Sempre perguntar'",
    "organizarEtiquetas(`status:${board}`, 'status', 'Status')", "chamarEtiqueta({ acao: 'fluxo-status', coluna: `status:${f.board}`"]) assert.ok(status.includes(p), p);
});

test('Diário: pronta é só Finalizado; Agendado e Para agendar com a data passada contam como atrasada', () => {
  const rel = ler('vybe-relatorios.js');
  assert.ok(rel.includes("const DIARIO_PRONTO = ['finalizado'];"));
  const c = vm.createContext({});
  vm.runInContext(rel.slice(rel.indexOf('const DIARIO_PRONTO'), rel.indexOf('\n', rel.indexOf('const DIARIO_PRONTO'))).replace('const ', 'globalThis.'), c);
  vm.runInContext(rel.slice(rel.indexOf('function diarioPronto'), rel.indexOf('\n', rel.indexOf('function diarioPronto'))), c);
  assert.equal(c.diarioPronto({ status: 'Finalizado' }), true);
  for (const s of ['Agendado', 'Para agendar', 'Em andamento']) assert.equal(c.diarioPronto({ status: s }), false, s);
});
