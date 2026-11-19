// SAFE: rodada S do padrão V2, frente "a" (19/11/2026). Funções puras num vm, sem rede e sem banco.
// - Janela "Requer ação" (prancha V2-S-Ver-As-N): o "quando" de cada linha.
// - Lista rápida do número (V2-S-Lista-Rapida): "Furando a data" pela mesma conta do alerta e as prontas de hoje.
// - Visão do setor (V2-S-Visao-Setor): a linha de "Pede ação" (número, título, porquê) e "Prontas por dia".
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const trecho = (js, de, ate) => { const i = js.indexOf(de), j = js.indexOf(ate, i + 1); assert.ok(i >= 0 && j > i, `achou ${de}`); return js.slice(i, j); };
const J = (x) => JSON.parse(JSON.stringify(x));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => String(n ?? 0);

test('Requer ação: o "quando" da linha diz quanto venceu, hoje, amanhã ou em quantos dias', () => {
  const ctx = vm.createContext({});
  vm.runInContext(trecho(ler('vybe-gestor.js'), 'function filaV2Quando', '\n// Os grupos de cada aba') + '\nthis.q = filaV2Quando;', ctx);
  const hoje = '2026-11-19';
  assert.deepEqual(J(ctx.q('2026-11-16', hoje, 'prazo')), { texto: 'venceu há 3 dias', tom: 'r' });
  assert.deepEqual(J(ctx.q('2026-11-18', hoje, 'prazo')), { texto: 'venceu há 1 dia', tom: 'r' });
  assert.equal(ctx.q('2026-11-19', hoje, 'prazo').texto, 'prazo hoje');
  assert.equal(ctx.q('2026-11-19', hoje, 'veiculacao').texto, 'no ar hoje');
  assert.equal(ctx.q('2026-11-20', hoje, 'prazo').texto, 'amanhã');
  assert.equal(ctx.q('2026-11-25', hoje, 'prazo').texto, 'em 6 dias');
  assert.equal(ctx.q('', hoje, 'prazo').texto, 'sem data');
});

function dono() { const ctx = vm.createContext({ window: {} }); vm.runInContext(ler('vybe-dono-metricas.js'), ctx); return ctx.VybeDono || ctx.window.VybeDono; }

test('Lista rápida: "furando" separa a data do cliente vencida do só prazo; "prontas" traz as Finalizado de hoje', () => {
  const D = dono(), hoje = '2026-11-19';
  const base = { cliente: 'Alfa', clientes: ['Alfa'], responsavel: 'Jady', responsavel_ids: ['900'], origem: 'producao_conteudo' };
  const demandas = [
    { ...base, id: '1', nome: 'Furou', status: 'Em andamento', prazo_iso: '2026-11-10', veiculacao_iso: '2026-11-12' },
    { ...base, id: '2', nome: 'Só prazo', status: 'Em andamento', prazo_iso: '2026-11-15', veiculacao_iso: '2026-11-25' },
    { ...base, id: '3', nome: 'Pronta hoje', status: 'Finalizado', prazo_iso: '2026-11-18', veiculacao_iso: hoje },
    { ...base, id: '4', nome: 'Falta hoje', status: 'Em andamento', prazo_iso: '2026-11-18', veiculacao_iso: hoje },
  ];
  const r = J(D.calcular({ demandas, clientes: [{ id: '1', nome: 'Alfa', ativo: true }], pessoas: { 900: 'Jady' }, hoje }));
  const atr = Object.fromEntries((r.hoje.lista.atrasadas || []).map((p) => [p.nome, p.furando]));
  assert.equal(atr.Furou, true);
  assert.equal(atr['Só prazo'], false);
  assert.deepEqual((r.hoje.lista.prontas || []).map((p) => p.nome), ['Pronta hoje']);
  assert.ok((r.hoje.lista.faltam || []).some((p) => p.nome === 'Falta hoje'));
  assert.equal(r.hoje.furosProducao, 1, 'a aba "Furando a data" conta o mesmo que o alerta');
});

function setor() {
  const js = ler('vybe-mundo-setor.js');
  const ctx = vm.createContext({ esc, num, window: {}, ctx: { subs: [] } });
  vm.runInContext(trecho(js, '  const VST_PEDE = [', '  // O pé dos módulos') + '\nthis.vstPede = vstPede; this.vstDias = vstDias;', ctx);
  return ctx;
}

test('Visão do setor: cada linha de "Pede ação" vira número, título curto e porquê, com o botão de antes', () => {
  const S = setor();
  const html = S.vstPede([
    { tom: 'r', cab: '147 peças furando a data do cliente (veiculação vencida)', nomes: 'A, B', botao: '<button data-espiar="alerta:0">Resolver</button>' },
    { tom: 'a', cab: '16 peças vão ao ar hoje sem estar prontas', nomes: 'C', botao: '<button>Resolver</button>' },
    { tom: 'a', cab: '29 peças com risco de furo nos próximos 2 dias', nomes: 'D' },
    { tom: 'a', cab: '1 cliente sem nenhum conteúdo nesta semana', nomes: 'Gonzalez' },
    { tom: 'r', curto: '2 na sua fila', n: 2, botao: '<button>Abrir a fila</button>' },
  ], { previstas: 17, previstasFeitas: 1 });
  assert.match(html, /<b class="vst-lin-n r">147<\/b><span class="vst-lin-txt" title="[^"]*"><b>Furando a data do cliente<\/b><small>veiculação já passou e a peça não está Finalizado<\/small>/);
  assert.match(html, /data-espiar="alerta:0">Resolver/, 'o Resolver de antes continua');
  assert.match(html, /<b>Vão ao ar hoje sem estar prontas<\/b><small>1 de 17 já está Finalizado<\/small>/);
  assert.match(html, /<b>Risco de furo em 2 dias<\/b>/);
  assert.match(html, /<b>Cliente sem conteúdo nesta semana<\/b><small>Gonzalez<\/small>/);
  assert.match(html, /<b class="vst-lin-n">2<\/b>.*<b>Atrasadas na sua fila<\/b><small>peças com você<\/small>/s);
  assert.equal((html.match(/vst-lin-n r/g) || []).length, 1, 'só o primeiro número grave fica vermelho');
});

test('Visão do setor: "Prontas por dia" conta de segunda a domingo pela data do cliente e abre a lista do dia', () => {
  const S = setor();
  S.window.situacaoDaPecaNoMundo = (d) => (d.status === 'Finalizado' ? 'concluida' : 'aberta');
  const html = S.vstDias([
    { status: 'Finalizado', veiculacao_iso: '2026-11-17' }, { status: 'Em andamento', veiculacao_iso: '2026-11-17' },
    { status: 'Em andamento', prazo_iso: '2026-11-19' }, { status: 'Finalizado', veiculacao_iso: '2026-11-30' },
  ], '2026-11-19');
  assert.equal((html.match(/class="vst-dia( hoje)?"/g) || []).length, 7);
  assert.match(html, /seg 16/);
  assert.match(html, /dom 22/);
  // Frente S-g (19/11/2026): a barra empilha Finalizado (--v) e Para agendar/Agendado (--c, tom claro).
  assert.match(html, /ter 17<\/span><span class="vst-dia-barra vsg-pilha" style="--v:50%;--c:0%"><i><\/i><i class="vsg-clara"><\/i><\/span><b>1 de 2<\/b>/);
  assert.match(html, /class="vst-dia hoje" data-espiar="semdia:2026-11-19\|veiculacao_iso"/);
  assert.match(html, /qui 19 · hoje<\/span><span class="vst-dia-barra vsg-pilha" style="--v:0%;--c:0%"><i><\/i><i class="vsg-clara"><\/i><\/span><b>0 de 0<\/b>/, 'sem veiculação a peça não entra no dia');
  assert.match(html, /<b>1 de 2<\/b><\/small>/);
});
