// Montar o mês no Feed (Paulo, 15/11/2026: "o head consegue adicionar ali o formato e quantidade de peças em lote ou
// individual... encaixar, reorganizar, clicar na data que tava furada e add um conteúdo, mudar datas furadas em lote
// pra add conteúdo em lote"). O vybe-feed.js de verdade, numa data fixa, com o cadastro e o calendário de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function feed(itens, { hoje = '2026-11-16', extra = {} } = {}) {
  const chamadas = [];
  const c = vm.createContext({
    console, Intl, URLSearchParams,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${hoje}T15:00:00Z`])); } static now() { return Date.parse(`${hoje}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ id: 1, nome: 'Lions', ativo: true, cadastro: { instagram: '@lions' } }],
    goldenDeadlineIso: (iso) => `prazo-${iso}`,
    datasSazonaisDoAno: () => [{ iso: '2026-11-20', nome: 'Consciência Negra', destaque: 1 }],
    window: { openCadastrosGoverned: (x) => chamadas.push(x) },
    location: { search: '', origin: 'https://vybepainel-v2.vercel.app' },
    document: { getElementById: () => null },
    ...extra,
  });
  vm.runInContext(ler('vybe-feed.js'), c);
  vm.runInContext('renderFeedDoCliente = () => {}; feedToast = () => {};', c);
  return { chamadas, run: (js) => vm.runInContext(js, c) };
}
const pecas = (lista) => lista.map(([id, formato, iso, status = 'A Fazer', prazo]) => ({ id, cliente: 'Lions', formato, veiculacao_iso: iso, status, prazo_iso: prazo }));
const json = (v) => JSON.parse(JSON.stringify(v));

test('o + do X cadastra naquele dia, com o prazo de ouro e a data comemorativa no título', () => {
  const { run, chamadas } = feed([]);
  run("feedCriarNoDia('Lions', '2026-11-20'); feedCriarNoDia('Lions', '2026-11-18'); feedCriarNoDia('Lions', '')");
  assert.deepEqual(json(chamadas), [
    { board: 'producao', client: 'Lions', veic: '2026-11-20', prazo: 'prazo-2026-11-20', titulo: 'Consciência Negra', brief: 'Data comemorativa: Consciência Negra.' },
    { board: 'producao', client: 'Lions', veic: '2026-11-18', prazo: 'prazo-2026-11-18' },
    { board: 'producao', client: 'Lions' },
  ]);
});

test('marcar datas furadas e cadastrar em lote: uma peça por data, no formato escolhido', () => {
  const { run, chamadas } = feed([]);
  run("feedMarcar('Lions', '2026-11-20'); feedMarcar('Lions', '2026-11-18'); feedMarcar('Lions', '2026-11-25'); feedMarcar('Lions', '2026-11-25'); feedLoteFormato('carrossel'); feedCadastrarMarcadas()");
  assert.equal(chamadas.length, 1);
  const x = json(chamadas[0]);
  assert.equal(x.format, 'Carrossel');
  assert.equal(x.client, 'Lions');
  assert.deepEqual(x.itens.map((i) => [i.veic, i.prazo, i.titulo]), [['2026-11-18', 'prazo-2026-11-18', ''], ['2026-11-20', 'prazo-2026-11-20', 'Consciência Negra']]);
  assert.equal(run('FEED.sel'), null, 'cadastrou, desmarca');
});

test('+ Em lote: formato e quantidade marcam os X primeiro e depois os dias livres', () => {
  const { run } = feed(pecas([['1', 'Reels', '2026-11-16'], ['2', 'Card', '2026-11-18'], ['3', 'Card', '2026-11-20']]));
  // Semana de 16/11 cheia (3); as outras três têm 3 X cada: seg, qua, sex.
  const isos = json(run("FEED.lote = { cliente: 'Lions', fmt: 'reels', qtd: 11 }; feedLoteEncaixar(); [...FEED.sel.isos].sort()"));
  assert.equal(isos.length, 11);
  assert.deepEqual(isos.filter((i) => i >= '2026-11-23' && i <= '2026-11-29').slice(0, 3), ['2026-11-23', '2026-11-25', '2026-11-27'], 'os X da semana seguinte');
  assert.ok(isos.includes('2026-11-17'), 'passados os 9 X, os dias livres (ter 17/11)');
  assert.equal(run('FEED.sel.fmt'), 'reels');
  const g = run("feedMontar({ nome: 'Lions', usuario: '' })");
  assert.ok(g.livres.some((x) => x.iso === '2026-11-17' && x.marcado), 'a data livre marcada aparece na grade');
});

test('Intercalar formatos: as mesmas datas, sem o mesmo formato seguido, só na prévia até aplicar', () => {
  const { run } = feed(pecas([['1', 'Reels', '2026-11-16'], ['2', 'Reels', '2026-11-18'], ['3', 'Reels', '2026-11-20'], ['4', 'Card', '2026-11-23'], ['5', 'Card', '2026-11-25']]));
  run("feedIntercalarPropor('Lions')");
  const g = run("feedMontar({ nome: 'Lions', usuario: '' })");
  const seq = [...g.futuras].sort((a, b) => a.iso.localeCompare(b.iso)).map((x) => x.fmt.chave);
  assert.deepEqual(seq, ['reels', 'card', 'reels', 'card', 'reels']);
  assert.equal(g.repetido, null);
  assert.ok(run('FEED.intercalar.moves.length') > 0);
  assert.ok(ler('vybe-feed.js').includes("await moverDataDoItem(x.it, 'veiculacao', m.para, { request: x.request, renderizar: false, avisar: false })"));
});

test('visão do mês: os X só dentro do mês escolhido e a contagem do mês', () => {
  const { run } = feed(pecas([['1', 'Reels', '2026-12-01'], ['2', 'Card', '2026-12-03']]));
  const g = run("FEED.vista = 'mes'; FEED.mes = '2026-12'; feedMontar({ nome: 'Lions', usuario: '' })");
  assert.equal(g.jan.ini, '2026-12-01');
  assert.equal(g.jan.fim, '2026-12-31');
  assert.ok([...g.buracos].every((b) => b.iso >= '2026-12-01' && b.iso <= '2026-12-31'));
  assert.equal(g.noMes.length, 2);
  // Semana de 30/11 a 06/12: só os dias de dezembro contam (seg 30/11 fica fora); 2 peças, falta 1, no primeiro dia
  // bom livre: qua 02/12.
  assert.deepEqual([...g.buracos].filter((b) => b.iso <= '2026-12-06').map((b) => b.iso), ['2026-12-02']);
});

test('peça atrasada: prazo de ouro vencido e ainda não em Para agendar; a etapa aparece na peça', () => {
  const { run } = feed(pecas([['1', 'Reels', '2026-11-20', 'Em Produção', '2026-11-13'], ['2', 'Card', '2026-11-21', 'Agendado', '2026-11-14']]));
  const g = run("feedMontar({ nome: 'Lions', usuario: '' })");
  assert.equal(g.atrasadas, 1);
  const html = run("feedClienteHtml({ nome: 'Lions', usuario: '', heads: [], carteira: '', bio: '', site: '' })");
  assert.match(html, /vfd-peca vfd-sem-arte vfd-atrasada/);
  assert.match(html, /<span class="vfd-etapa" aria-hidden="true">Em Produção<\/span>/);
  assert.match(html, /1 peça atrasada/);
});

test('a peça abre o cartão rápido do calendário ali na grade; no celular, segurar e arrastar', () => {
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("abrirCartaoRapido(id, event, request ? 'request' : 'content')"));
  assert.ok(src.includes("wrap.addEventListener('touchmove', (e) => {"));
  assert.ok(src.includes('{ passive: false }'));
});

test('o cadastro aceita o formato e uma lista de peças (o lote do Feed)', () => {
  const cad = ler('cadastros_governed_v2.js');
  assert.ok(cad.includes("if (inicio.format && fcListaCatalogo('format').includes(inicio.format)) state.format = inicio.format;"));
  assert.ok(cad.includes('state.itens = inicio.itens.slice(0, 20).map('));
});

test('Atualizar Instagram: o favorito só fala com o Vybe OS, a janela só aceita o Instagram, e só dono vê o botão', () => {
  const { run } = feed([]);
  const codigo = decodeURIComponent(String(run('feedFavoritoCodigo()')).replace(/^javascript:/, ''));
  assert.ok(codigo.includes('const O="https://vybepainel-v2.vercel.app"'));
  assert.ok(codigo.includes("W.postMessage({vfd:'perfil',perfil},O)"));
  assert.ok(codigo.includes('if(e.origin!==O||!e.data)return;'));
  const src = ler('vybe-feed.js');
  assert.ok(src.includes("if (e.origin !== INSTA || e.data?.vfd !== 'perfil' || feito) return;"));
  const semDono = run("feedClienteHtml({ nome: 'Lions', usuario: 'lions', heads: [], carteira: '', bio: '', site: '' })");
  assert.doesNotMatch(semDono, /Atualizar Instagram/);
  const { run: comoDono } = feed([], { extra: { souDonoDaSessao: () => true } });
  assert.match(comoDono("feedClienteHtml({ nome: 'Lions', usuario: 'lions', heads: [], carteira: '', bio: '', site: '' })"), /Atualizar Instagram/);
});

test('sem regra por cliente: a meta é 3 por semana para todos e o cadastro não tem mais os campos do ritmo', async () => {
  const { CAMPOS_CADASTRO } = await import('../server/clientes-cadastro.js');
  assert.ok(!CAMPOS_CADASTRO.some((c) => /^feed_/.test(c.chave)));
  assert.doesNotMatch(ler('vybe-feed.js'), /feedAjustar|feed_por_semana/);
});
