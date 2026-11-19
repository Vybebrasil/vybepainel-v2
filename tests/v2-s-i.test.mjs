// A regra do feed de cada cliente (Paulo, 19/11/2026: "olhando o feed da ACE... ele tá marcando que sábado precisa sair
// post... eu quero que em cada cliente eu possa definir ou mudar essa regra de forma fácil ali mesmo em Produção › Feed").
// O vybe-feed.js de verdade numa quinta fixa (19/11/2026), com o cadastro e o calendário de mentira; e a gravação em
// cadastro.feed (server/clientes-cadastro.js) com um banco de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { limparRegraDoFeed, salvarRegraDoFeed } from '../server/clientes-cadastro.js';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HOJE = '2026-11-19'; // quinta; a semana começa na segunda 16/11

function feed(itens, regra, extra = {}) {
  const c = vm.createContext({
    console, Intl, URLSearchParams, Promise, JSON,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${HOJE}T15:00:00Z`])); } static now() { return Date.parse(`${HOJE}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ id: 7, nome: 'ACE', ativo: true, cadastro: { instagram: '@ace', ...(regra === undefined ? {} : { feed: regra }) } }],
    window: {}, location: { search: '', origin: 'https://vybepainel-v2.vercel.app' },
    document: { getElementById: () => null },
    ...extra,
  });
  vm.runInContext(ler('vybe-feed.js'), c);
  vm.runInContext('renderFeedDoCliente = () => {}; feedToast = () => {};', c);
  return (js) => vm.runInContext(js, c);
}
const pecas = (lista) => lista.map(([id, formato, iso]) => ({ id, cliente: 'ACE', formato, veiculacao_iso: iso, status: 'Em andamento' }));
const json = (v) => JSON.parse(JSON.stringify(v));
// O caso da ACE: um card na quinta 19/11 e um post na sexta 20/11.
const ACE = pecas([['1', 'Card', '2026-11-19'], ['2', 'Feed', '2026-11-20']]);
const buracos = (run) => json(run("feedMontar(feedClientes()[0]).buracos.map((b) => b.iso)"));

test('regra padrão: sem regra gravada, 3 por semana em qualquer dia, e o sábado da ACE ganha X', () => {
  const run = feed(ACE);
  assert.deepEqual(json(run('feedClientes()[0].regra')), { porSemana: 3, dias: [0, 1, 2, 3, 4, 5, 6], semBuraco: false, gravada: false });
  const b = buracos(run);
  assert.ok(b.includes('2026-11-21'), 'o sábado 21/11 vira X, como hoje');
  // As semanas seguintes: seg, qua e sex primeiro.
  assert.deepEqual(b.filter((i) => i >= '2026-11-23' && i <= '2026-11-29'), ['2026-11-23', '2026-11-25', '2026-11-27']);
  assert.equal(run('feedRegraTexto(feedClientes()[0].regra)'), '3 posts por semana · qualquer dia');
});

test('regra do cliente: 2 por semana, seg qua sex', () => {
  const run = feed([], { porSemana: 2, dias: [0, 2, 4], semBuraco: false });
  const b = buracos(run);
  assert.deepEqual(b.filter((i) => i >= '2026-11-23' && i <= '2026-11-29'), ['2026-11-23', '2026-11-25'], 'só dois X na semana');
  assert.equal(run('feedRegraTexto(feedClientes()[0].regra)'), '2 posts por semana · seg qua sex');
  // O quadro das semanas mostra a regra no título e conta "de 2".
  const html = run("const c = feedClientes()[0]; feedV2SemanasHtml(c, feedMontar(c))");
  assert.match(html, /class="vfr-regra"[^>]*onclick="feedRegraAbrir\('ACE'\)"/);
  assert.match(html, /2 posts por semana · seg qua sex/);
  assert.match(html, /0 de 2/);
});

test('dia desmarcado nunca vira X: com seg, qua e qui, o sábado da ACE fica sem X', () => {
  const run = feed(ACE, { porSemana: 3, dias: [0, 2, 3], semBuraco: false });
  const b = buracos(run);
  assert.ok(!b.includes('2026-11-21'), 'sábado fora da regra');
  assert.ok(b.every((iso) => [1, 3, 4].includes(new Date(`${iso}T12:00:00Z`).getUTCDay())), 'só seg, qua e qui');
  // No calendário das semanas, o sábado é dia fechado (sem ponto) e não X.
  const html = run("const c = feedClientes()[0]; feedV2SemanasHtml(c, feedMontar(c))");
  assert.doesNotMatch(html, /vfd2-x[^>]*data-vfd-alvo="2026-11-21"/);
  assert.match(html, /vfd2-nada fechado" data-vfd-alvo="2026-11-21"/);
  assert.match(html, /vfd2-nada fechado" data-vfd-alvo="2026-11-28"/);
  // Semana com a meta cumprida: nenhum X, e o feed emenda com o que vem depois.
  const run2 = feed(ACE, { porSemana: 2, dias: [0, 2, 3, 4], semBuraco: false });
  assert.deepEqual(buracos(run2).filter((i) => i <= '2026-11-22'), []);
  // O "+ Em lote" também só usa os dias da regra.
  const isos = json(run("FEED.lote = { cliente: 'ACE', fmt: 'card', qtd: 12 }; feedLoteEncaixar(); [...FEED.sel.isos].sort()"));
  assert.ok(isos.every((iso) => [1, 3, 4].includes(new Date(`${iso}T12:00:00Z`).getUTCDay())), 'lote nos dias da regra');
});

test('0 por semana e "sem buraco": nenhum X, nenhum "posts faltando"', () => {
  const zero = feed(ACE, { porSemana: 0, dias: [0, 1, 2, 3, 4, 5, 6], semBuraco: false });
  assert.deepEqual(buracos(zero), []);
  assert.equal(zero('feedRegraTexto(feedClientes()[0].regra)'), 'sem post fixo na semana');
  const sem = feed(ACE, { porSemana: 3, dias: [0, 2, 4], semBuraco: true });
  assert.deepEqual(buracos(sem), []);
  assert.equal(sem('feedRegraTexto(feedClientes()[0].regra)'), 'sem meta fixa · só o que existe');
  const html = sem("const c = feedClientes()[0]; feedV2SemanasHtml(c, feedMontar(c))");
  assert.doesNotMatch(html, / de \d</, 'sem meta, a semana mostra só quantos posts tem');
  assert.match(html, />2 posts</);
  // Regra torta no cadastro (dias fora de 0..6, número fora de 0..7) cai no que dá para ler.
  assert.deepEqual(json(feed([], { porSemana: 12, dias: [9, 2, 2, 'x'] })('feedClientes()[0].regra')), { porSemana: 3, dias: [2], semBuraco: false, gravada: true });
});

test('gravação: limparRegraDoFeed valida e salvarRegraDoFeed grava só cadastro.feed', async () => {
  assert.deepEqual(limparRegraDoFeed({ porSemana: 3, dias: [4, 0, 2, 2], semBuraco: false }), { porSemana: 3, dias: [0, 2, 4], semBuraco: false });
  assert.deepEqual(limparRegraDoFeed({ porSemana: 0, dias: [], semBuraco: true }), { porSemana: 0, dias: [], semBuraco: true });
  for (const ruim of [null, [], { porSemana: 8, dias: [] }, { porSemana: 2.5, dias: [] }, { porSemana: 3, dias: [7] }, { porSemana: 3 }, { porSemana: 3, dias: [], semBuraco: 'sim' }])
    assert.throws(() => limparRegraDoFeed(ruim), (e) => e.status === 400, JSON.stringify(ruim));

  const chamadas = [];
  const db = (partes, ...valores) => { const q = partes.join('?'); chamadas.push({ q, valores }); return Promise.resolve(/^\s*UPDATE/.test(q) ? [{ id: 7, nome: 'ACE' }] : []); };
  const r = await salvarRegraDoFeed(db, 7, { porSemana: 3, dias: [0, 2, 3], semBuraco: false });
  assert.deepEqual(r, { ok: true, cliente: { id: 7, nome: 'ACE' }, feed: { porSemana: 3, dias: [0, 2, 3], semBuraco: false } });
  const up = chamadas.find((c) => /UPDATE vybe_clientes/.test(c.q));
  assert.match(up.q, /cadastro = COALESCE\(cadastro, '\{\}'::jsonb\) \|\| jsonb_build_object\('feed', \?::jsonb\)/, 'mexe só na chave feed');
  assert.deepEqual(JSON.parse(up.valores[0]), { porSemana: 3, dias: [0, 2, 3], semBuraco: false });
  assert.deepEqual(up.valores.slice(1), [7]);
  assert.doesNotMatch(chamadas.map((c) => c.q).join(' '), /CREATE TABLE|ADD COLUMN IF NOT EXISTS (?!cadastro)/, 'sem tabela nem coluna nova');

  chamadas.length = 0;
  const volta = await salvarRegraDoFeed(db, 7, null);
  assert.equal(volta.feed, null);
  assert.match(chamadas.find((c) => /UPDATE/.test(c.q)).q, /- 'feed'/, 'null apaga a regra e o cliente volta à de sempre');

  await assert.rejects(salvarRegraDoFeed(db, 0, { porSemana: 3, dias: [] }), (e) => e.status === 400);
  await assert.rejects(salvarRegraDoFeed(() => Promise.resolve([]), 9, { porSemana: 3, dias: [] }), (e) => e.status === 404);
});

test('a rota grava pela tranca de quem já edita o cadastro, e o demo usa a mesma validação', () => {
  const painel = ler('api/painel.js');
  const tranca = painel.indexOf("if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra altera clientes.' });");
  const rota = painel.indexOf("if (acao === 'feed_regra')");
  assert.ok(tranca > 0 && rota > tranca, 'feed_regra fica depois da tranca do cadastro');
  assert.match(painel.slice(rota, rota + 300), /salvarRegraDoFeed\(db, id, req\.body\?\.regra \?\? null\)/);
  assert.match(ler('scripts/fixtures.mjs'), /d\.acao==='feed_regra'[\s\S]{0,300}limparRegraDoFeed/);
});

test('salvar na tela: manda a regra, atualiza o cliente carregado e redesenha sem recarregar', async () => {
  const pedidos = [];
  let fechou = 0;
  const run = feed(ACE, undefined, {
    podeEditarClientes: () => true,
    closeWorkflowModal: () => { fechou += 1; },
    fetch: (url, op) => { pedidos.push({ url, corpo: JSON.parse(op.body) }); const regra = JSON.parse(op.body).regra; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, feed: regra }) }); },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  });
  run('renderFeedDoCliente = () => { globalThis.__pintou = (globalThis.__pintou || 0) + 1; }');
  run("FEED.regraEd = { cliente: 'ACE', id: 7, porSemana: 3, dias: new Set([0, 1, 2, 3, 4, 5, 6]), semBuraco: false, gravada: false }; feedRegraMudar('dia', 5); feedRegraMudar('dia', 6)");
  assert.equal(await run('feedRegraSalvar(false)'), true);
  const pintou = run('globalThis.__pintou');
  assert.deepEqual(pedidos, [{ url: '/api/painel?area=clientes', corpo: { acao: 'feed_regra', id: 7, regra: { porSemana: 3, dias: [0, 1, 2, 3, 4], semBuraco: false } } }]);
  assert.equal(pintou, 1); assert.equal(fechou, 1);
  assert.deepEqual(json(run('CADASTRO_CLIENTES[0].cadastro.feed')), { porSemana: 3, dias: [0, 1, 2, 3, 4], semBuraco: false });
  assert.equal(run('CADASTRO_CLIENTES[0].cadastro.instagram'), '@ace', 'o resto do cadastro fica');
  assert.ok(!buracos(run).includes('2026-11-21'), 'sem sábado na regra, o X do sábado some');
  // Quem não administra o cadastro não grava (a mesma tranca do servidor).
  const sem = feed(ACE, undefined, { podeEditarClientes: () => false, fetch: () => { throw new Error('não devia chamar'); } });
  sem("FEED.regraEd = { cliente: 'ACE', id: 7, porSemana: 3, dias: new Set([0]), semBuraco: false }");
  assert.equal(await sem('feedRegraSalvar(false)'), false);
});
