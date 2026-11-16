// Passagem de bastão leva a peça à etapa seguinte (Paulo, 16/11/2026): Em andamento → Para aprovação e
// Para aprovação → Para agendar. As outras transições e os portões ficam como estavam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const portoes = ler('vybe-portoes.js'), status = ler('vybe-status.js');

const OPCOES = ['Pode Fazer', 'Em andamento', 'Para aprovação', 'Alteração', 'Ag. Aprovação Cliente', 'Para agendar', 'Agendado', 'Finalizado']
  .map((label) => ({ label }));

function portoesNoVm(opcoes = OPCOES) {
  const chamadas = [];
  const c = vm.createContext({
    console, setTimeout: () => 0, safeText: (t) => String(t ?? ''),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    operationalStatusOptions: () => opcoes,
    openWorkflowModal: () => {}, closeWorkflowModal: () => {},
    updateFocusStatus: (id, rotulo) => chamadas.push(['updateFocusStatus', id, rotulo]),
  });
  vm.runInContext(portoes, c);
  // O checklist de verdade abre a caixa; aqui só importa que é ele quem recebe a aprovação.
  vm.runInContext('openWorkflowModal = () => {};', c);
  vm.runInContext('openQualityGate =(item, option) => globalThis.__q.push(["openQualityGate", item.id, option.label]);', c);
  c.__q = chamadas;
  return { c, chamadas };
}

test('bastão: Em andamento vai para Para aprovação e Para aprovação vai para Para agendar', () => {
  const { c } = portoesNoVm();
  assert.equal(c.destinoDoBastao({ status: 'Em andamento' })?.label, 'Para aprovação');
  assert.equal(c.destinoDoBastao({ status: 'Para aprovação' })?.label, 'Para agendar');
  // A grafia do quadro varia (Monday x catálogo): a chave do rótulo é a mesma.
  assert.equal(c.destinoDoBastao({ status: 'Em Andamento' })?.label, 'Para aprovação');
  assert.equal(c.destinoDoBastao({ status: 'Para Aprovação' })?.label, 'Para agendar');
  assert.equal(c.destinoDoBastao({ status: 'Para Aprovacao' })?.label, 'Para agendar');
});

test('bastão: os outros status seguem só com o registro, sem trocar o status', () => {
  const { c } = portoesNoVm();
  for (const s of ['Pode Fazer', 'Alteração', 'Ag. Aprovação Cliente', 'Para agendar', 'Agendado', 'Finalizado', '', undefined]) {
    assert.equal(c.destinoDoBastao({ status: s }), null, String(s));
  }
  assert.deepEqual({ ...vm.runInContext('BASTAO_PROXIMA_ETAPA', c) }, { em_andamento: 'para_aprovacao', para_aprovacao: 'para_agendar' }, 'só as duas transições');
});

test('bastão: quadro sem o status de destino (ou com ele desligado) não inventa a troca', () => {
  let { c } = portoesNoVm(OPCOES.filter((o) => o.label !== 'Para agendar'));
  assert.equal(c.destinoDoBastao({ status: 'Para aprovação' }), null);
  ({ c } = portoesNoVm(OPCOES.map((o) => (o.label === 'Para aprovação' ? { ...o, ativa: false } : o))));
  assert.equal(c.destinoDoBastao({ status: 'Em andamento' }), null);
});

test('bastão: o botão abre a passagem já com o destino e marca que é bastão', () => {
  const { c } = portoesNoVm();
  vm.runInContext('findOperationalItem = (id) => ({ "1": { id: "1", status: "Em andamento" }, "2": { id: "2", status: "Pode Fazer" } })[id];', c);
  c.openManualHandoff('1');
  let fluxo = vm.runInContext('pendingWorkflowChange', c);
  assert.equal(fluxo.option.label, 'Para aprovação');
  assert.equal(fluxo.manual, false);
  assert.equal(fluxo.bastao, true);
  c.openManualHandoff('2');
  fluxo = vm.runInContext('pendingWorkflowChange', c);
  assert.equal(fluxo.option, null, 'fora do mapa continua manual');
  assert.equal(fluxo.manual, true);
  assert.equal(fluxo.bastao, undefined);
});

test('bastão: depois do registro, a troca passa pelos portões de sempre', () => {
  const { c, chamadas } = portoesNoVm();
  c.seguirDepoisDoBastao({ id: 7, status: 'Em andamento' }, { label: 'Para aprovação' });
  c.seguirDepoisDoBastao({ id: 8, status: 'Para aprovação' }, { label: 'Para agendar' });
  assert.deepEqual(JSON.parse(JSON.stringify(chamadas)), [['updateFocusStatus', '7', 'Para aprovação'], ['openQualityGate', 8, 'Para agendar']],
    'Para aprovação pela conferência visual (updateFocusStatus); aprovar pelo checklist de qualidade');
  assert.ok(status.includes('} else if (flow.bastao) await seguirDepoisDoBastao(flow.item, flow.option);'), 'submitHandoff usa o caminho com portões');
  assert.ok(status.includes('else await commitStatusChange(flow.item, flow.option);'), 'as outras passagens gravam como antes');
});

test('bastão: os portões e o resto do fluxo não mudaram', () => {
  const { c } = portoesNoVm();
  const st = (label) => ({ label });
  assert.equal(c.statusNeedsConferenciaVisual(st('Para aprovação')), true);
  assert.equal(c.statusNeedsHandoff({ status: 'Para aprovação' }, st('Ag. Aprovação Cliente')), true);
  assert.equal(c.statusNeedsHandoff({ status: 'Em andamento' }, st('Para aprovação')), false);
  assert.equal(c.statusNeedsQuality(st('Agendado')), false, 'Agendado fica na revisão de material');
  assert.equal(c.statusNeedsMaterialReview(st('Agendado')), true);
  assert.equal(c.statusNeedsContext(st('Para agendar')), false);
  assert.equal(c.statusNeedsContext(st('Alteração')), true);
  assert.ok(portoes.includes("const HANDOFF_TARGET_STATUSES = new Set(['ag. aprovação cliente']);"));
  assert.ok(portoes.includes("const QUALITY_TARGET_STATUSES = new Set(['agendado']);"));
});
