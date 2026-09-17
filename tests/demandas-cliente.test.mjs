// Demandas: o filtro de cliente por botão (nome exato) e pela caixa de busca
// (parte do nome) são o mesmo filtro, e valem para esteira, Grupos e Calendário
// porque todos passam por filtrarDemandasBase.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function demandas(itens) {
  const c = vm.createContext({
    console, setTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, body: { classList: { contains: () => false } } },
    window: {},
  });
  for (const arquivo of ['vybe-config.js', 'vybe-demandas.js']) {
    vm.runInContext(fs.readFileSync(arquivo, 'utf8'), c, { filename: arquivo });
  }
  c.itens = itens;
  vm.runInContext(`
    DADOS_DEMANDAS = itens;
    clientesDoItem = (d) => d.clientes || [d.cliente];
    renderDemandas = () => {};
    ids = () => JSON.stringify(filtrarDemandasBase().map((d) => d.id));
  `, c);
  return c;
}

const itens = [
  { id: 'a', cliente: 'VOA', status: 'Pode Fazer' },
  { id: 'b', cliente: 'VOAR Turismo', status: 'Pode Fazer' },
  { id: 'c', clientes: ['Antonov', 'VOA'], status: 'Feito' },
];

test('o botão escolhe o cliente pelo nome exato, inclusive em peça com dois clientes', () => {
  const c = demandas(itens);
  vm.runInContext("escolherClienteDemandas('VOA')", c);
  assert.deepEqual(JSON.parse(vm.runInContext('ids()', c)), ['a', 'c']);
});

test('a caixa de busca continua aceitando parte do nome e desfaz o exato', () => {
  const c = demandas(itens);
  vm.runInContext("escolherClienteDemandas('VOA'); buscarClienteDemandas('voa')", c);
  assert.deepEqual(JSON.parse(vm.runInContext('ids()', c)), ['a', 'b', 'c']);
});

test('clicar de novo no mesmo cliente tira o filtro', () => {
  const c = demandas(itens);
  vm.runInContext("escolherClienteDemandas('VOA'); escolherClienteDemandas('VOA')", c);
  assert.equal(JSON.parse(vm.runInContext('ids()', c)).length, 3);
});

test('a contagem dos botões ignora só o filtro de cliente', () => {
  const c = demandas(itens);
  vm.runInContext("escolherClienteDemandas('VOA'); currentDemandaStatusFilter = 'Feito';", c);
  assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(filtrarDemandasBase({semCliente:true}).map(d=>d.id))", c)), ['c']);
});

// Quem cadastrou e quando: a mesma leitura para tabela, cartão e ficha.
test('cadastro da peça: autor gravado, importada do Monday e data na hora da Bahia', () => {
  const c = vm.createContext({ console });
  vm.runInContext(fs.readFileSync('vybe-core.js', 'utf8').split('// vybe-core.js — núcleo')[0], c);
  const ler = (x) => JSON.parse(vm.runInContext(`JSON.stringify(cadastroDaPeca(${JSON.stringify(x)}))`, c));
  assert.deepEqual(ler({ id: 'vybe:12', criado_em: '2026-09-17T10:05', cadastrado_por: 'Deivid' }),
    { quem: 'Deivid', quando: '17/09/2026 10:05', ordem: '2026-09-17T10:05' });
  assert.equal(ler({ id: '11623475731', criado_em: '2026-08-02T12:00' }).quem, 'Importado do Monday');
  // A ficha manda o carimbo do banco (UTC): vira a hora da Bahia.
  assert.equal(ler({ id: 'vybe:12', criado_em: '2026-09-17T13:05:00.000Z', importada: false }).quando, '17/09/2026 10:05');
  assert.equal(ler({ id: 'vybe:13' }).quem, 'Sem registro');
});
