// DA Controler: o que a régua de entregas chama de alerta.
//
// "Alerta" contava risco alto, e risco alto é tudo que vence hoje — o dia de
// hoje inteiro virava alerta. Estes testes rodam o arquivo de verdade numa
// sandbox e leem só a contagem de um dia.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const HOJE = '2026-09-16';

function da() {
  const c = vm.createContext({
    console, setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, body: { classList: { contains: () => false } } },
    window: { addEventListener() {} },
  });
  for (const arquivo of ['vybe-config.js', 'vybe-demandas.js', 'vybe-perfis.js']) {
    vm.runInContext(fs.readFileSync(arquivo, 'utf8'), c, { filename: arquivo });
  }
  vm.runInContext(`isFinishedItem = (d) => ['Finalizado', 'Feito'].includes(operationalFlowStatus(d));`, c);
  return c;
}

const alertas = (c, itens, dia) => {
  c.args = { itens, dia };
  vm.runInContext(`saida = JSON.stringify(daAlertasDoDia(args.itens, args.dia, '${HOJE}'));`, c);
  return JSON.parse(c.saida);
};

const peca = (status) => ({ origem: 'producao_conteudo', status });

test('o que vence hoje e está andando não é alerta', () => {
  const r = alertas(da(), [peca('Em andamento'), peca('Pode Fazer')], HOJE);
  assert.equal(r.total, 0);
});

test('dia que passou: conta o que não foi finalizado, com a palavra certa', () => {
  const r = alertas(da(), [peca('Em andamento'), peca('Pode Fazer'), peca('Finalizado')], '2026-09-14');
  assert.deepEqual([r.atrasadas, r.bloqueadas, r.texto], [2, 0, '2 atrasadas']);
});

test('peça bloqueada conta uma vez só, mesmo atrasada', () => {
  const r = alertas(da(), [peca('Falta Info'), peca('Em andamento')], '2026-09-14');
  assert.deepEqual([r.total, r.texto], [2, '1 atrasada · 1 bloqueada']);
  // Hoje, a bloqueada continua pedindo ação; a que anda, não.
  assert.equal(alertas(da(), [peca('Falta Info'), peca('Em andamento')], HOJE).texto, '1 bloqueada');
});

// A data inicial é a referência da fila, mesmo sem entregas no dia atual.
test('DA abre em hoje dentro do período, mesmo com fila vazia ou só futura', () => {
  const c=da();
  const range={start:'2026-09-14',end:'2026-09-20'};
  assert.equal(c.daControllerInitialDay(range,[],HOJE),HOJE);
  assert.equal(c.daControllerInitialDay(range,['2026-09-18'],HOJE),HOJE);
});

test('DA respeita a janela navegada ao atravessar mês e ano', () => {
  const c=da();
  assert.equal(c.daControllerInitialDay({start:'2026-12-28',end:'2027-01-03'},[],'2027-01-01'),'2027-01-01');
  assert.equal(c.daControllerInitialDay({start:'2027-01-04',end:'2027-01-10'},['2027-01-06'],'2027-01-01'),'2027-01-06');
  assert.equal(c.daControllerInitialDay({start:'2026-12-21',end:'2026-12-27'},[],'2027-01-01'),'2026-12-21');
});
