// O Plano do dia e o fechamento de turno do Modo Foco.
//
// Solicitação e conteúdo chamam a mesma etapa por nomes diferentes: "Em execução"
// e "Em andamento", "Aguardando Info." e "Falta Info". Estes testes rodam os
// arquivos de verdade e conferem que a tela não depende do nome cru.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const HOJE = '2026-09-16'; // quarta-feira

function foco() {
  const c = vm.createContext({
    console, setTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, body: { classList: { contains: () => false } } },
    window: {},
  });
  for (const arquivo of ['vybe-config.js', 'vybe-demandas.js', 'vybe-foco.js']) {
    vm.runInContext(fs.readFileSync(arquivo, 'utf8'), c, { filename: arquivo });
  }
  vm.runInContext(`
    HOJE_ISO = '${HOJE}';
    safeText = (v) => String(v ?? '');
    focusReferenceDate = (d) => d.prazo_iso || '';
    focusReferenceLabel = (d) => d.prazo_iso || '';
    focusSort = (itens) => [...itens].sort((a, b) => String(a.prazo_iso).localeCompare(String(b.prazo_iso)));
    isFinishedItem = (d) => ['Finalizado', 'Feito'].includes(operationalFlowStatus(d));
  `, c);
  return c;
}

const demanda = (o) => ({ origem: 'solicitacao', board_id: 8385559107, ...o });
const conteudo = (o) => ({ origem: 'producao_conteudo', ...o });

// Os títulos que aparecem em cada coluna do Plano do dia, lidos do HTML.
function plano(c, itens, proxima = null) {
  c.itens = itens; c.proxima = proxima;
  vm.runInContext('html = focusDailyPlanHtml(itens, {id:"1",name:"Jady"}, proxima ? {item: proxima} : null);', c);
  const colunas = [...c.html.matchAll(/<span>(AGORA|DESTRAVAR|ATÉ SEXTA)<\/span>(?:<button[^>]*>([^<]*)<\/button>|<em>([^<]*)<\/em>)/g)];
  return Object.fromEntries(colunas.map((m) => [m[1], m[2] ?? `vazio: ${m[3]}`]));
}

test('solicitação em execução aparece no AGORA', () => {
  const c = foco();
  // O caso do print: a Brussolo rodando e o AGORA mostrando outra peça.
  const r = plano(c, [
    demanda({ id: 'b', nome: 'Design - Capas de categorias', status: 'Em execução', prazo_iso: HOJE }),
    conteudo({ id: 'a', nome: 'Card - Alpha1', status: 'Pode Fazer', prazo_iso: HOJE }),
  ]);
  assert.equal(r.AGORA, 'Design - Capas de categorias');
});

test('sem nada em execução, o AGORA não repete a próxima demanda', () => {
  const c = foco();
  const proxima = conteudo({ id: 'a', nome: 'Card - Alpha1', status: 'Pode Fazer', prazo_iso: HOJE });
  // A próxima já tem o card grande logo abaixo; repetir aqui divide a atenção.
  const r = plano(c, [proxima], proxima);
  assert.equal(r.AGORA, 'vazio: nada em execução agora');
});

test('ATÉ SEXTA não inclui o que vence hoje', () => {
  const c = foco();
  const r = plano(c, [
    conteudo({ id: 'h', nome: 'Carrossel - Hangar', status: 'Pode Fazer', prazo_iso: HOJE }),
    conteudo({ id: 's', nome: 'Card - Sexta', status: 'Pode Fazer', prazo_iso: '2026-09-18' }),
    conteudo({ id: 'p', nome: 'Card - Semana que vem', status: 'Pode Fazer', prazo_iso: '2026-09-21' }),
  ]);
  assert.equal(r['ATÉ SEXTA'], 'Card - Sexta');
});

test('solicitação aguardando informação conta como bloqueio', () => {
  const c = foco();
  const r = plano(c, [demanda({ id: 'i', nome: 'Arte da fachada', status: 'Aguardando Info.', prazo_iso: HOJE })]);
  assert.equal(r.DESTRAVAR, 'Arte da fachada');
});

test('o fechamento de turno traduz os status da solicitação', () => {
  const c = foco();
  c.itens = [
    demanda({ id: 'b', nome: 'Capas', status: 'Em execução', prazo_iso: HOJE }),
    demanda({ id: 'i', nome: 'Fachada', status: 'Aguardando Info.', prazo_iso: HOJE }),
    conteudo({ id: 'c', nome: 'Card', status: 'Em andamento', prazo_iso: HOJE }),
  ];
  vm.runInContext(`focusOwnItems = () => itens;
    r = focusShiftSummary({id:'1',name:'Jady'});
    saida = JSON.stringify({ executadas: r.executed.map((d) => d.id), bloqueadas: r.blocked.map((d) => d.id) });`, c);
  assert.deepEqual(JSON.parse(c.saida), { executadas: ['b', 'c'], bloqueadas: ['i'] });
});
