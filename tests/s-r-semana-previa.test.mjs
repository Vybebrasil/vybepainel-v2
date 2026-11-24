// Prévia da semana dia a dia (Paulo, 24/11/2026: "esse gráfico não faz jus... olha o tanto de demanda já pra agendar ou
// agendada nos dias aí na semana... o gráfico não devia mostrar essa prévia?"). Uma conta só (VybeDono.util.previaDaSemana)
// para o cartão Semana do Hoje e a régua da semana da Produção: total por dia, prontas por fase, em produção e atrasadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const dono = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync('vybe-dono-metricas.js', 'utf8'), dono);
const U = dono.window.VybeDono.util;
const json = (x) => JSON.parse(JSON.stringify(x));

const SEMANA = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
const HOJE = '2026-11-24';

test('previaDaSemana: total por dia, prontas por fase, em produção e atrasadas (passou da data e não está pronta)', () => {
  const p = (dia, status, x = {}) => ({ id: `${dia}-${status}-${Math.random()}`, status, veiculacao_iso: dia, ...x });
  const itens = [
    p('2026-11-23', 'Finalizado'), p('2026-11-23', 'Para agendar'), p('2026-11-23', 'Em andamento'), // segunda: 1 atrasada
    p('2026-11-24', 'Agendado'), p('2026-11-24', 'A Fazer'), p('2026-11-24', 'Feito'), // hoje não atrasa
    p('2026-11-27', 'Para agendar'), p('2026-11-27', 'Para agendar'), p('2026-11-27', 'Alteração', { prazo_iso: '2026-11-20' }),
    p('2026-12-01', 'A Fazer'), p('', 'A Fazer'), // fora da semana e sem data: não contam
  ];
  const r = json(U.previaDaSemana({ itens, dias: SEMANA, hoje: HOJE }));
  const dia = (iso) => { const c = r.porDia.find((x) => x.dia === iso); delete c.itens; return c; };
  assert.deepEqual(dia('2026-11-23'), { dia: '2026-11-23', total: 3, prontas: 2, finalizadas: 1, paraAgendar: 1, agendadas: 0, emProducao: 0, atrasadas: 1 });
  assert.deepEqual(dia('2026-11-24'), { dia: '2026-11-24', total: 3, prontas: 2, finalizadas: 1, paraAgendar: 0, agendadas: 1, emProducao: 1, atrasadas: 0 });
  // A data é a do cliente: o prazo interno vencido de sexta não faz a peça "atrasada" (era o "Atrasadas 14" do cartão antigo).
  assert.deepEqual(dia('2026-11-27'), { dia: '2026-11-27', total: 3, prontas: 2, finalizadas: 0, paraAgendar: 2, agendadas: 0, emProducao: 1, atrasadas: 0 });
  assert.equal(r.porDia.length, 7);
  assert.deepEqual([r.total, r.prontas, r.finalizadas, r.paraAgendar, r.agendadas, r.emProducao, r.atrasadas], [9, 6, 2, 3, 1, 2, 1]);
  for (const c of r.porDia) assert.equal(c.total, c.prontas + c.emProducao + c.atrasadas, c.dia);
  // A lista do dia é exatamente o que a coluna contou.
  assert.equal(U.previaDaSemana({ itens, dias: SEMANA, hoje: HOJE }).porDia[0].itens.length, 3);
});

test('previaDaSemana: quem chama decide a data, o Finalizado e a fase (a regra da régua)', () => {
  const itens = [{ status: 'Aprovado', prazo_iso: '2026-11-25', origem: 'solicitacao' }, { status: 'Para agendar', prazo_iso: '2026-11-25', origem: 'solicitacao' }];
  const r = U.previaDaSemana({ itens, dias: SEMANA, hoje: HOJE, dataDe: (d) => d.prazo_iso,
    concluida: (d) => ['Feito', 'Aprovado'].includes(d.status), faseDe: (d) => (d.origem === 'solicitacao' ? '' : U.faseDaPronta(d)) });
  const qua = r.porDia[2];
  assert.equal(qua.total, 2); assert.equal(qua.finalizadas, 1); assert.equal(qua.paraAgendar, 0, 'solicitação não tem Para agendar'); assert.equal(qua.emProducao, 1);
  assert.equal(U.previaDaSemana({ itens: null, dias: SEMANA }).total, 0, 'sem peças, tudo zero');
});

// A régua da semana da Produção (vybe-gestor.js) e o cartão do Hoje na mesma fixture: o mesmo número por dia.
function gestor({ carteira = 'all' } = {}) {
  const c = vm.createContext({ Date, Set, Map, console, panelMode: 'gestor', BOARD_ID: 1, dateMode: 'veiculacao', selectedPersonIds: new Set(),
    DADOS: [], DADOS_ALL: [], DADOS_DEMANDAS: [], META: { weeks: [{ startIso: SEMANA[0], endIso: SEMANA[6] }] },
    DEMANDA_CONCLUIDA: ['Feito', 'Aprovado', 'Concluído', 'Finalizado'],
    isRequestItem: (d) => d.origem === 'solicitacao',
    normalizeRequestForOperational: (d) => ({ ...d, origem: 'solicitacao', board_id: 2, veiculacao_iso: d.veiculacao_iso || d.conclusao_iso || d.prazo_iso || '' }),
    clientesDoItem: (d) => [d.cliente], carteiraDoCliente: (n) => (n === 'Alfa' ? 'vinicius' : 'ewerton') });
  c.globalThis = c; c.VybeDono = dono.window.VybeDono;
  c.getDateIso = (d) => (c.dateMode === 'prazo' ? d.prazo_iso || '' : d.veiculacao_iso);
  vm.runInContext(fs.readFileSync('vybe-core.js', 'utf8').split('// QUANDO FOI')[0], c);
  vm.runInContext(fs.readFileSync('vybe-gestor.js', 'utf8'), c);
  vm.runInContext(`getDiasSemana = () => ${JSON.stringify(SEMANA.map((iso) => ({ iso })))}; filtroCarteira = ${JSON.stringify(carteira)}; clientesDoItem = (d) => [d.cliente]; carteiraDoCliente = (n) => (n === 'Alfa' ? 'vinicius' : 'ewerton');`, c);
  // ~100 peças pela semana, com fases misturadas, solicitações e prazo interno 2 dias antes.
  const ST = ['Finalizado', 'Para agendar', 'Agendado', 'Em andamento', 'A Fazer', 'Alteração', 'Para aprovação'];
  let n = 0;
  SEMANA.forEach((dia, k) => { for (let j = 0; j < 12 + k; j++) { n++; c.DADOS.push({ id: 'c' + n, semana: 1, cliente: n % 3 ? 'Alfa' : 'Beta', status: ST[(n + k) % ST.length], veiculacao_iso: dia, prazo_iso: SEMANA[Math.max(0, k - 2)] }); }
    c.DADOS_DEMANDAS.push({ id: 'd' + k, cliente: 'Alfa', status: k % 2 ? 'Feito' : 'Em andamento', conclusao_iso: dia, prazo_iso: dia }); });
  c.DADOS_ALL = c.DADOS.slice();
  return c;
}
// A régua ANTES desta mudança (pv2PintarSemana, até 23/11): a referência que o cartão novo tem de repetir.
function doDiaAntigo(c, iso) {
  const l = c.itensDaSemanaGestor(1).filter(c.itemNaCarteira).filter((d) => c.dataDoCartaoDia(d) === iso);
  const feitas = l.filter(c.atividadeDoDiaConcluida), resto = l.filter((d) => !feitas.includes(d) && !c.isRequestItem(d));
  const paraAgendar = resto.filter((d) => U.faseDaPronta(d) === 'paraAgendar').length, agendadas = resto.filter((d) => U.faseDaPronta(d) === 'agendado').length;
  return { total: l.length, prontas: feitas.length + paraAgendar + agendadas, finalizadas: feitas.length, paraAgendar, agendadas };
}
const so = (x) => ({ total: x.total, prontas: x.prontas, finalizadas: x.finalizadas, paraAgendar: x.paraAgendar, agendadas: x.agendadas });

test('régua e cartão: o mesmo número por dia na mesma fixture (e iguais à régua de antes)', () => {
  const c = gestor();
  const regua = c.previaDaSemanaGestor(SEMANA, { itens: c.itensDaSemanaGestor(1).filter(c.itemNaCarteira), hoje: HOJE });
  const cartao = c.previaDaSemanaGestor(SEMANA, { campo: 'veiculacao', carteira: false, hoje: HOJE });
  assert.ok(cartao.total >= 100, `fixture cheia (${cartao.total})`);
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(so(regua.porDia[i]), doDiaAntigo(c, SEMANA[i]), `régua ${SEMANA[i]}`);
    assert.deepEqual(so(cartao.porDia[i]), so(regua.porDia[i]), `cartão ${SEMANA[i]}`);
  }
  // As solicitações entram (era a diferença do 95 do Hoje contra o ~107 da régua) e concluem em Feito.
  assert.ok(cartao.porDia[1].itens.some((d) => d.origem === 'solicitacao' && d.status === 'Feito'));
});

test('a carteira da Produção filtra a régua; o cartão do Hoje é a agência toda', () => {
  const c = gestor({ carteira: 'vinicius' });
  const regua = c.previaDaSemanaGestor(SEMANA, { itens: c.itensDaSemanaGestor(1).filter(c.itemNaCarteira), hoje: HOJE });
  const cartao = c.previaDaSemanaGestor(SEMANA, { campo: 'veiculacao', carteira: false, hoje: HOJE });
  assert.ok(regua.total < cartao.total);
  assert.deepEqual(so(regua.porDia[3]), doDiaAntigo(c, SEMANA[3]));
});

test('pelo prazo, a régua e o cartão usam o prazo (solicitação também)', () => {
  const c = gestor(); c.dateMode = 'prazo';
  const cartao = c.previaDaSemanaGestor(SEMANA, { campo: 'prazo', carteira: false, hoje: HOJE });
  const regua = c.previaDaSemanaGestor(SEMANA, { itens: c.itensDaSemanaGestor(1).filter(c.itemNaCarteira), hoje: HOJE });
  for (let i = 0; i < 7; i++) assert.deepEqual(so(regua.porDia[i]), doDiaAntigo(c, SEMANA[i]), `régua ${SEMANA[i]}`);
  assert.equal(c.dataDaPrevia({ origem: 'solicitacao', conclusao_iso: '2026-11-26', prazo_iso: '2026-11-25' }, 'prazo'), '2026-11-25');
  assert.equal(c.dataDaPrevia({ origem: 'solicitacao', conclusao_iso: '2026-11-26', prazo_iso: '2026-11-25' }, 'veiculacao'), '2026-11-26');
  assert.ok(cartao.total > 0);
});

const mundo = fs.readFileSync('vybe-mundo.js', 'utf8');
const trecho = (a, b) => { const i = mundo.indexOf(a); assert.ok(i >= 0, a); const j = mundo.indexOf(b, i + a.length); return mundo.slice(i, j < 0 ? undefined : j); };

test('cartão Semana: linha por dia (não acumulada), hoje destacado, dia escolhido, lista do dia e pé igual aos pontos', () => {
  const s = trecho('  function semanaD3Html(', '  function pintarAgencia(');
  // 25/11/2026 (Paulo: "prefiro gráfico de linha"): linha, mas cada ponto é o dia (a acumulada foi a queixa de 24/11).
  assert.match(s, /linhaPreviaD3\(porDia, max\)/);
  assert.match(s, /<i class="pt tot" style="--y:\$\{\(\(x\.total \|\| 0\) \/ max\)/);
  assert.match(s, /<i class="pt prt" style="--y:\$\{\(\(x\.prontas \|\| 0\) \/ max\)/);
  assert.match(s, /x\.atrasadas \? '<i class="d3h-prv-atr"><\/i>'/, 'atrasada marcada no dia');
  assert.match(mundo, /\['tot', 'com a data'\], \['prt', 'prontas'\], \['fin', 'finalizadas'\], \['atr', 'atrasada'\]/);
  assert.match(s, /x\.dia === hoje \? ' hoje'/);
  assert.match(s, /data-semana-dia="\$\{x\.dia\}" aria-pressed=/, 'tocar num dia escolhe o dia');
  assert.match(s, /data-espiar="semdia:\$\{sel\}\|/, 'a lista do dia escolhido');
  assert.match(s, /T\[k\] = \(T\[k\] \|\| 0\) \+ \(x\[k\] \|\| 0\)/, 'o pé soma as mesmas colunas');
  assert.match(s, /pela \$\{campo === 'prazo' \? 'data do prazo' : 'veiculação'\}/, 'diz de que data é');
  // A lista do dia abre o que a coluna contou (agência ou fila), com a solicitação no quadro dela.
  assert.match(mundo, /const daPrevia = escopo \? pecasDaPreviaD3\.get\(escopo\)\?\.get\(dia\) : null;/);
  assert.match(mundo, /chamar\(it\.dem \? 'openDemandaWorkspace' : 'openItemWorkspace'/);
});

test('Agência e Minhas tarefas usam a prévia; o dono vê a agência por padrão com "Agência | Minha fila" guardado', () => {
  assert.match(mundo, /decidirHtml\(\) : semanaD3Html\(previaD3\(\)\)/);
  assert.match(mundo, /const escolheSemana = dono && !verComo, escopoSem = escolheSemana && escopoSemanaTarefas !== 'fila' \? 'agencia' : 'fila';/);
  assert.match(mundo, /data-semana-escopo="\$\{k\}"/);
  assert.match(mundo, /try \{ localStorage\.setItem\('vybe\.mundo\.semanaTarefas', escopoSemanaTarefas\); \} catch/);
  assert.match(mundo, /try \{ escopoSemanaTarefas = localStorage\.getItem\('vybe\.mundo\.semanaTarefas'\) \|\| ''; \} catch/);
  // Prontas da semana do Hoje = a prévia (a mesma conta da régua), com o motor de números de reserva.
  assert.match(mundo, /const PSD3 = PV \? \{ prontas: PV\.prontas, finalizadas: PV\.finalizadas, paraAgendar: PV\.paraAgendar, agendadas: PV\.agendadas, previstas: PV\.total \} : prontasSemD3\(S\);/);
  const regua = fs.readFileSync('vybe-gestor.js', 'utf8');
  assert.match(regua.slice(regua.indexOf('function pv2PintarSemana'), regua.indexOf('// No celular, Redes/Demandas/Pendências')), /previaDaSemanaGestor\(dias\.map\(\(d\) => d\.iso\)/);
});

test('s-r.css: só tokens, sem !important, sem :has, sem caixa-alta e no arquivo juntado', () => {
  const css = fs.readFileSync('padrao-v2/s-r.css', 'utf8');
  const regras = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important/);
  assert.doesNotMatch(regras, /:has\(/);
  assert.doesNotMatch(regras, /html\s+body\.mundo/);
  assert.doesNotMatch(regras, /text-transform\s*:\s*uppercase/);
  assert.doesNotMatch(regras, /:\s*#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(regras, /rgba?\(/);
  for (const v of regras.match(/var\(--[\w-]+/g) || []) assert.match(v, /var\(--(d3-|vsg-clara|y$|vv-texto)/, v); // --y: a altura do ponto, que vem do style
  assert.match(fs.readFileSync('vybe-mundo-padrao-v2.css', 'utf8'), /padrao-v2\/s-r\.css/);
});

test('linha da semana (25/11/2026): cada ponto é o dia, não a soma dos dias anteriores', () => {
  const fonte = trecho('  function linhaPreviaD3(', '  function semanaD3Html(');
  const linhaPreviaD3 = vm.runInNewContext(`(${fonte.trim()})`);
  const porDia = [{ total: 15, prontas: 14, finalizadas: 4 }, { total: 19, prontas: 7, finalizadas: 2 }, { total: 0, prontas: 0, finalizadas: 0 }, { total: 10, prontas: 10, finalizadas: 10 }];
  const svg = linhaPreviaD3(porDia, 20);
  const pontos = (cls) => svg.match(new RegExp(`class="${cls}" points="([^"]+)"`))[1];
  // y = 100 - 100 * v / max: 15 -> 25, 19 -> 5, 0 -> 100, 10 -> 50 (acumulado daria 15, 34, 34, 44)
  assert.equal(pontos('tot'), '50,25 150,5 250,100 350,50');
  assert.equal(pontos('prt'), '50,30 150,65 250,100 350,50');
  assert.equal(pontos('fin'), '50,100 50,80 150,90 250,100 350,50 350,100', 'a área do Finalizado fecha no chão');
  assert.match(svg, /viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"/);
});
