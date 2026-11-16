// SAFE: o controle manual da Coordenação (vybe-mundo-coordenacao.js) num vm, sem rede de verdade: a grade pessoa × dia,
// o calendário do Mês, os avisos, os indicadores e o arrastar → OK → gravar → Desfazer, com um fetch dublê de
// /api/conteudo atrás das funções de sempre (gravarResponsaveisDaPeca e moverDataDoItem).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const J = (x) => JSON.parse(JSON.stringify(x));
const esperar = () => new Promise((r) => setTimeout(r, 0));
const HOJE = '2026-11-14'; // sábado; a semana é 09 a 15/11
const TIME = [
  { id: 'bia', nome: 'Beatriz', disciplina: 'design', limiteSemana: 14 },
  { id: 'jady', nome: 'Jady', disciplina: 'design', limiteSemana: 14 },
  { id: 'rer', nome: 'Reriston', disciplina: 'audiovisual', limiteSemana: 24 },
];
let seq = 0;
const peca = (quem, prazo, extra = {}) => ({ id: `vybe:${++seq}`, nome: 'P' + seq, responsavel_ids: quem ? [quem] : [], prazo_iso: prazo, veiculacao_iso: '', status: 'A Fazer', formato: 'Card', cliente: 'Lions', ...extra });

function contexto({ itens = [], posts = [], falhar = false } = {}) {
  const ouvintes = [], desfazer = [];
  const ctx = vm.createContext({ console, Promise, setTimeout, CustomEvent: class {}, localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener: (t, f) => ouvintes.push([t, f]), dispatchEvent() {}, querySelectorAll: () => [], querySelector: () => null },
    // Como no painel: devolve uma cópia nova da peça (unifiedOperationalItems normaliza a cada chamada).
    findOperationalItem: (id) => { const d = itens.find((x) => x.id === String(id)); return d ? { ...d } : null; },
    TEAM_USERS: TIME.map((t) => ({ id: t.id, name: t.nome })),
    mostrarDesfazer: (texto, fn) => { desfazer.push([texto, fn]); return true; },
    fetch: async (url, o) => { const corpo = JSON.parse(o.body); posts.push([url, corpo]); if (falhar && corpo.acao !== 'responsaveis') return { ok: false, json: async () => ({ error: 'sem rede' }) }; return { ok: true, json: async () => ({ ok: true }) }; },
  });
  // As funções de sempre, como o painel as expõe: gravam por POST /api/conteudo e atualizam a peça na memória.
  const guardada = (item) => itens.find((x) => x.id === String(item.id));
  ctx.gravarResponsaveisDaPeca = async (item, ids) => { const r = await ctx.fetch('/api/conteudo', { method: 'POST', body: JSON.stringify({ acao: 'responsaveis', item: item.id, pessoas: ids }) }); if (!r.ok) throw new Error((await r.json()).error); guardada(item).responsavel_ids = [...ids]; };
  // Como a de vybe-agenda.js: sem mudança (a data da peça recebida já é aquela) não grava nada.
  ctx.moverDataDoItem = async (item, campo, iso) => { const k = campo === 'prazo' ? 'prazo_iso' : 'veiculacao_iso'; if (String(item[k] || '') === iso) return false;
    const r = await ctx.fetch('/api/conteudo', { method: 'POST', body: JSON.stringify({ acao: campo, item: item.id, data: iso }) }); if (!r.ok) throw new Error((await r.json()).error); guardada(item)[k] = iso; return true; };
  vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx);
  const de = (tipo) => ouvintes.filter(([t]) => t === tipo).map(([, f]) => f);
  return { C: ctx.VybeCoordenacao, ctx, de, desfazer };
}
// Um elemento dublê: closest devolve ele mesmo quando o seletor cita um dos atributos dele.
const el = (attrs, dataset) => { const e = { dataset, classList: { add() {}, remove() {} }, hasAttribute: (k) => k in attrs, contains: () => false,
  closest: (s) => (Object.keys(attrs).some((k) => s.includes(`[${k}]`)) ? e : null) }; return e; };
const ev = (type, alvo) => ({ type, target: alvo, stopPropagation() {}, preventDefault() {}, dataTransfer: { setData() {} } });

test('grade: pessoa × dia com limite de 5 peças, Antes, fim de semana vazio fora e sem data contado', () => {
  const { C } = contexto();
  const itens = [...Array.from({ length: 6 }, () => peca('jady', '2026-11-12')), peca('bia', '2026-11-10'), peca('bia', '2026-11-02'), peca('', '2026-11-13'), peca('rer', ''), peca('outra', '2026-11-12')];
  const g = J(C.gradeCalcular({ itens, time: TIME, hoje: HOJE, periodo: 'semana' }));
  assert.deepEqual(g.cols.map((c) => c.inicio), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'], 'domingo vazio sai; sábado fica porque é hoje');
  const jady = g.todas.find((l) => l.id === 'jady'), qui = jady.celulas[3];
  assert.equal(qui.n, 6); assert.equal(qui.limite, 5); assert.equal(qui.passou, true);
  assert.equal(g.todas.find((l) => l.id === 'bia').antes.n, 1, 'a de 02/11 vencida aparece em Antes');
  assert.equal(g.ninguem.celulas[4].n, 1, 'sem ninguém na sexta');
  assert.equal(g.semData, 1, 'Reriston sem prazo vira contagem');
  assert.equal(g.agencia[3].pecas.length, 6, 'peça só de quem não é do time fica fora');
  assert.equal(g.resumo.diasAcima, 1);
  // O limite de carga da pessoa, quando existe, manda.
  const g2 = J(C.gradeCalcular({ itens, time: TIME, hoje: HOJE, limiteDia: (id) => (id === 'jady' ? 8 : 5) }));
  assert.equal(g2.todas.find((l) => l.id === 'jady').celulas[3].passou, false);
  // Ficha individual: só a linha da pessoa, sem a de Sem ninguém.
  const g3 = J(C.gradeCalcular({ itens, time: TIME, hoje: HOJE, pessoa: 'bia' }));
  assert.deepEqual(g3.linhas.map((l) => l.id), ['bia']); assert.equal(g3.ninguem, null);
});

test('avisos: cliente repetido na pessoa e na agência, formato repetido no dia; resumo em uma linha', () => {
  const { C } = contexto();
  const qui = '2026-11-12';
  const itens = [peca('jady', qui, { cliente: 'Lions', formato: 'Carrossel' }), peca('jady', qui, { cliente: 'Lions', formato: 'Carrossel' }), peca('bia', qui, { cliente: 'Lions', formato: 'Carrossel' }),
    peca('bia', qui, { cliente: 'Brussolo', formato: 'Carrossel' }), peca('bia', '2026-11-13', { cliente: 'Brussolo', formato: 'Card' })];
  const g = C.gradeCalcular({ itens, time: TIME, hoje: HOJE });
  const jady = g.todas.find((l) => l.id === 'jady');
  assert.deepEqual(J(jady.celulas[3].repetidos), [{ cliente: 'Lions', n: 2 }]);
  assert.deepEqual(J(g.agencia[3].repetidos), [{ cliente: 'Lions', n: 3 }]);
  assert.deepEqual(J(g.agencia[3].formatos), [{ formato: 'Carrossel', n: 4 }]);
  assert.equal(C.resumoTexto(g).join(' · '), '1 cliente repetido · 4 carrosséis na quinta');
  // Filtro e busca escondem o que não interessa, mas a conta do limite continua com tudo.
  const f = C.gradeCalcular({ itens, time: TIME, hoje: HOJE, filtro: { cliente: 'Brussolo' } });
  assert.equal(f.todas.find((l) => l.id === 'bia').celulas[3].visiveis.length, 1);
  assert.equal(f.todas.find((l) => l.id === 'bia').celulas[3].n, 2);
  assert.equal(C.gradeCalcular({ itens, time: TIME, hoje: HOJE, busca: 'bruss' }).agencia[3].visiveis.length, 1);
});

test('Mês: calendário de segunda a domingo cobrindo o mês, dia a dia', () => {
  const { C } = contexto();
  const cols = J(C.colunasDe('mes', HOJE));
  assert.equal(cols[0].inicio, '2026-10-26'); assert.equal(cols[cols.length - 1].inicio, '2026-12-06');
  assert.equal(cols.length % 7, 0); assert.equal(cols[0].fora, true); assert.equal(cols.find((c) => c.inicio === '2026-11-30').fora, false);
  assert.equal(J(C.colunasDe('mes', HOJE, 1))[6].inicio, '2026-12-06', '› anda um mês');
});

test('indicadores: no ar hoje, ao ar na semana, prazo na semana, sem ninguém, para aprovação e atrasadas', () => {
  const { C } = contexto();
  const itens = [peca('bia', '2026-11-07', { veiculacao_iso: HOJE, status: 'Para aprovação' }), peca('jady', '2026-11-10', { veiculacao_iso: '2026-11-17' }),
    peca('', '2026-11-20', { veiculacao_iso: '2026-11-27' }), peca('jady', '2026-11-03', { veiculacao_iso: '2026-11-10', status: 'Ag. aprovação cliente' }), peca('outra', '2026-11-01')];
  const I = J(C.indicadores({ itens, time: TIME, hoje: HOJE }));
  const n = Object.fromEntries(Object.entries(I.listas).map(([k, v]) => [k, v.length]));
  assert.deepEqual(n, { hoje: 1, ar: 2, semana: 1, aguardando: 1, aprovar: 1, atrasadas: 3 }, 'atrasada = prazo interno ou veiculação antes de hoje');
  assert.deepEqual(I.porPessoa, { bia: 1, jady: 2, rer: 0 }); assert.equal(I.ninguem, 1); assert.equal(I.total, 4);
});

test('arrastar: soltar em outra pessoa e outro dia pede o OK; Mover grava responsável e prazo por /api/conteudo; Desfazer volta', async () => {
  const posts = [];
  const itens = [peca('jady', '2026-11-12', { veiculacao_iso: '2026-11-19' })];
  const { C, de, desfazer } = contexto({ itens, posts });
  const args = { itens, time: TIME, hoje: HOJE, peso: () => 1, abas: '', nome: (id) => TIME.find((t) => t.id === id)?.nome || id };
  let html = C.html(args);
  const id = itens[0].id, nomeP = itens[0].nome;
  assert.match(html, /class="v2o-man"/); assert.match(html, new RegExp(`data-coord-arrasta="${id}"[^>]*data-de="jady"`));
  assert.ok(html.indexOf('v2o-man') < html.indexOf('Sugestões do Heitor'), 'o controle manual vem antes das sugestões');
  const [arrastar] = de('dragstart'), solta = de('drop')[0], clique = de('click')[1];
  const cols = C.ultimaGrade().g.cols, sexta = cols.findIndex((c) => c.inicio === '2026-11-13');
  arrastar(ev('dragstart', el({ 'data-coord-arrasta': '' }, { coordArrasta: id, de: 'jady' })));
  solta(ev('drop', el({ 'data-coord-solta': '' }, { pessoa: 'bia', col: String(sexta) })));
  const P = J(C.estadoGrade().pedido);
  assert.deepEqual([P.de, P.para, P.campo, P.dataDe, P.dataPara], ['jady', 'bia', 'prazo', '2026-11-12', '2026-11-13']);
  assert.deepEqual(P.avisos.map((a) => a.t), ['6 dias antes do ar'], 'a menos de 7 dias da veiculação avisa no OK');
  html = C.html(args);
  assert.ok(html.includes(`${nomeP}: Passar para Beatriz e mudar o prazo para sex 13/11?`)); assert.equal(posts.length, 0, 'soltar não grava');
  clique(ev('click', el({ 'data-coord-sem-ok': '' }, {}))); for (let i = 0; i < 4; i++) await esperar();
  assert.deepEqual(posts.map(([u, c]) => [u, c.acao, c.pessoas || c.data]), [['/api/conteudo', 'responsaveis', ['bia']], ['/api/conteudo', 'prazo', '2026-11-13']]);
  assert.equal(desfazer.length, 1); assert.equal(desfazer[0][0], `${nomeP}: com Beatriz · prazo 13/11`);
  await desfazer[0][1](); await esperar();
  assert.deepEqual(posts.slice(2).map(([, c]) => [c.acao, c.pessoas || c.data]), [['prazo', '2026-11-12'], ['responsaveis', ['jady']]]);
  assert.deepEqual(J(itens[0].responsavel_ids), ['jady']); assert.equal(itens[0].prazo_iso, '2026-11-12');
});

test('arrastar: mexer na veiculação avisa que é a data do cliente; falha na data mostra o que ficou', async () => {
  const posts = [];
  const itens = [peca('jady', '2026-11-05', { veiculacao_iso: '2026-11-12' })];
  const { C, de } = contexto({ itens, posts, falhar: true });
  const args = { itens, time: TIME, hoje: HOJE, peso: () => 1, abas: '' };
  C.html(args);
  const clique = de('click')[1];
  clique(ev('click', el({ 'data-coord-sem-ref': '' }, { coordSemRef: 'veiculacao' }))); C.html(args);
  const qua = C.ultimaGrade().g.cols.findIndex((c) => c.inicio === '2026-11-11');
  de('dragstart')[0](ev('dragstart', el({ 'data-coord-arrasta': '' }, { coordArrasta: 'vybe:' + seq, de: 'jady' })));
  de('drop')[0](ev('drop', el({ 'data-coord-solta': '' }, { pessoa: 'jady', col: String(qua) })));
  assert.deepEqual(J(C.estadoGrade().pedido.avisos.map((a) => a.t)), ['Data do cliente', '6 dias antes do ar']);
  clique(ev('click', el({ 'data-coord-sem-ok': '' }, {}))); for (let i = 0; i < 4; i++) await esperar();
  assert.deepEqual(posts.map(([, c]) => c.acao), ['veiculacao'], 'mesma pessoa: só a data');
  assert.match(C.estadoGrade().msg, /Não gravou: sem rede/);
  clique(ev('click', el({ 'data-coord-sem-ref': '' }, { coordSemRef: 'prazo' })));
});

test('fichas por pessoa, Mês arrastando entre dias (mantém quem faz), Aprovar pelo portão e CSS sem !important', () => {
  const itens = [peca('bia', '2026-11-18', { status: 'Para aprovação' })];
  const { C, ctx, de } = contexto({ itens });
  const chamadas = []; ctx.updateFocusStatus = (id, label) => chamadas.push([id, label]);
  ctx.operationalStatusOptions = () => [{ label: 'Em andamento' }, { label: 'Para aprovação' }, { label: 'Para agendar' }, { label: 'Alteração' }];
  ctx.operadorDoTopo = () => ({ id: 'bia' });
  const args = { itens, time: TIME, hoje: HOJE, peso: () => 1, abas: '' };
  let html = C.html(args);
  assert.match(html, /aria-pressed="true" data-coord-sem-pessoa="bia"/, 'a ficha padrão é de quem olha');
  assert.ok(html.indexOf('data-coord-sem-pessoa="bia"') < html.indexOf('data-coord-sem-pessoa="jady"'), 'quem olha vem primeiro');
  assert.ok(html.indexOf('data-coord-sem-pessoa="ninguem"') < html.indexOf('data-coord-sem-pessoa="todos"'));
  const clique = de('click')[1];
  clique(ev('click', el({ 'data-coord-aprovar': '' }, { coordAprovar: itens[0].id })));
  assert.deepEqual(chamadas, [[itens[0].id, 'Para agendar']]);
  // Mês: calendário; soltar em outro dia (data-manter) só muda o dia.
  const fonte = ler('vybe-mundo-coordenacao.js');
  assert.match(fonte, /data-coord-solta data-manter data-pessoa=/);
  assert.match(fonte, /const para = cel\.hasAttribute\('data-manter'\) \? \(cel\.dataset\.pessoa \|\| a\.de\)/);
  assert.match(fonte, /G\.gravarResponsaveisDaPeca\(item, novos\)/); assert.match(fonte, /G\.moverDataDoItem\(item, P\.campo, P\.dataPara/);
  assert.doesNotMatch(fonte, /fetch\(\s*['"`]\/api\/conteudo/, 'nenhuma rota nova: grava só pelas funções de sempre');
  const css = ler('padrao-v2/d3-coordenacao.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.match(ler('vybe-mundo-padrao-v2.css'), /padrao-v2\/d3-coordenacao\.css/);
  html = C.html(args);
  assert.match(html, /class="d3-acao d3h-acao d3v-laranja d3v-lar-faixa"/); // direção V2: a faixa virou o cartão laranja ao lado dos indicadores assert.equal((html.match(/class="d3-acao /g) || []).length, 1, 'um só bloco laranja');
});
