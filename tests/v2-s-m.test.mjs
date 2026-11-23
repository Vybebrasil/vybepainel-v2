// SAFE: frente s-m (Paulo, 23/11/2026) — Hoje › Coordenação sem os balões do topo, com o quadro em tela cheia e as abas
// Semana, Grupos e Heitor. Roda vybe-mundo-coordenacao.js num vm (sem rede) e confere o código que liga a aba Grupos à
// tabela de Grupos da Produção (vybe-agenda.js e vybe-mundo.js) e o fragmento padrao-v2/s-m.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const HOJE = '2026-11-14';
const TIME = [
  { id: 'bia', nome: 'Beatriz', disciplina: 'design', limiteSemana: 14 },
  { id: 'jady', nome: 'Jady', disciplina: 'design', limiteSemana: 14 },
  { id: 'rer', nome: 'Reriston', disciplina: 'audiovisual', limiteSemana: 24 },
];
let seq = 0;
const peca = (quem, prazo, extra = {}) => ({ id: `vybe:${++seq}`, nome: 'P' + seq, responsavel_ids: quem ? [quem] : [], prazo_iso: prazo, veiculacao_iso: '', status: 'A Fazer', formato: 'Card', cliente: 'Lions', ...extra });

// Nós de DOM mínimos: o bastante para emprestar a seção #grupos-board e devolvê-la ao lugar.
function no(id = '', { visivel = true } = {}) {
  const n = { id, filhos: [], parentNode: null, innerHTML: 'x', visivel, classes: new Set(),
    classList: { add: (c) => n.classes.add(c), remove: (c) => n.classes.delete(c), contains: (c) => n.classes.has(c) },
    get isConnected() { let p = n; while (p.parentNode) p = p.parentNode; return p.raiz === true; },
    getClientRects() { let p = n; while (p) { if (p.visivel === false) return []; p = p.parentNode; } return [1]; },
    appendChild(f) { f.parentNode?.filhos.splice(f.parentNode.filhos.indexOf(f), 1); f.parentNode = n; n.filhos.push(f); return f; },
    insertBefore(f, ref) { f.parentNode?.filhos.splice(f.parentNode.filhos.indexOf(f), 1); f.parentNode = n; n.filhos.splice(n.filhos.indexOf(ref), 0, f); return f; },
    remove() { n.parentNode?.filhos.splice(n.parentNode.filhos.indexOf(n), 1); n.parentNode = null; } };
  return n;
}

function contexto({ aba = null } = {}) {
  const ouvintes = [], guardado = new Map(aba ? [['vybe.coordenacao.aba', aba]] : []);
  const raiz = no('raiz'); raiz.raiz = true;
  const painel = raiz.appendChild(no('painel')), secao = painel.appendChild(no('grupos-board'));
  const hoje = raiz.appendChild(no('vv-hoje')), host = hoje.appendChild(no('s-m-grupos-host'));
  const todos = () => { const l = []; const anda = (n) => { l.push(n); n.filhos.forEach(anda); }; anda(raiz); return l; };
  const desenhos = [];
  const ctx = vm.createContext({ console, Promise, setTimeout, CustomEvent: class {},
    localStorage: { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)) },
    document: { addEventListener: (t, f) => ouvintes.push([t, f]), dispatchEvent() {}, querySelectorAll: () => [], querySelector: () => null,
      getElementById: (id) => todos().find((n) => n.id === id) || null, createComment: () => no('#comentario') },
    findOperationalItem: () => null, TEAM_USERS: TIME.map((t) => ({ id: t.id, name: t.nome })),
    renderVisaoDeGrupos: (q) => desenhos.push(q) });
  vm.runInContext(ler('vybe-mundo-coordenacao.js'), ctx);
  const de = (tipo) => ouvintes.filter(([t]) => t === tipo).map(([, f]) => f);
  return { C: ctx.VybeCoordenacao, de, guardado, dom: { raiz, painel, secao, hoje, host }, desenhos };
}
const el = (attrs, dataset) => { const e = { dataset, hasAttribute: (k) => k in attrs, closest: (s) => (Object.keys(attrs).some((k) => s.includes(`[${k}]`)) ? e : null) }; return e; };
const ev = (type, alvo) => ({ type, target: alvo, stopPropagation() {}, preventDefault() {} });
const ITENS = () => [
  peca('bia', '2026-11-10'), peca('jady', '2026-11-14', { veiculacao_iso: '2026-11-14' }), peca('', '2026-11-13'),
  peca('jady', '2026-11-18', { status: 'Para aprovação' }), peca('rer', '2026-11-12', { formato: 'Reels' }),
];
const args = (itens) => ({ itens, time: TIME, hoje: HOJE, peso: () => 1, abas: '', nome: (id) => TIME.find((t) => t.id === id)?.nome || id });

test('sem balões: o topo tem só a saudação, o período e as abas; os números vão discretos para o cabeçalho do quadro', () => {
  const { C } = contexto();
  const html = C.html(args(ITENS()));
  for (const velho of ['class="v2o-inds"', 'd3q-co-topo', 'v2o-heitor-cab', 'data-coord-heitor', 'd3h-num v2o-ind']) assert.ok(!html.includes(velho), `saiu: ${velho}`);
  assert.doesNotMatch(html, /d3v-laranja/, 'o laranja não fica no topo nem na Semana');
  // O cabeçalho do quadro: as abas e os seis números, na ordem do que pede ação; nada some (cada um abre a lista no lugar).
  const cab = html.slice(html.indexOf('class="d3h-cab s-m-cab"'), html.indexOf('class="s-m-semana"'));
  assert.deepEqual([...cab.matchAll(/data-coord-aba="(\w+)"/g)].map((m) => m[1]), ['semana', 'grupos', 'heitor']);
  assert.match(cab, /aria-selected="true" data-coord-aba="semana"/, 'a Semana abre por padrão');
  assert.deepEqual([...cab.matchAll(/class="s-m-conta[^"]*" data-coord-ind="(\w+)"/g)].map((m) => m[1]), ['atrasadas', 'aprovar', 'aguardando', 'hoje', 'ar', 'semana']);
  assert.match(cab, /<b>1<\/b> vai ao ar</, 'singular no 1'); assert.match(cab, /<b>3<\/b> atrasadas</);
  assert.match(cab, /class="s-m-conta r" data-coord-ind="atrasadas"/, 'vermelho só nas atrasadas');
  // A Semana: fichas, período, avisos, filtros e a grade, no painel da aba.
  const sem = html.slice(html.indexOf('class="s-m-semana"'));
  for (const k of ['data-coord-sem-pessoa=', 'data-coord-sem-anda=', 'data-coord-sem-ref="prazo"', 'data-coord-sem-ref="veiculacao"', 'v2o-sem-resumo', 'data-coord-busca', 'class="v2o-sem-grade"', 'data-coord-arrasta=', 'data-coord-solta']) assert.ok(sem.includes(k), k);
});

test('o número abre a lista no lugar, em qualquer aba: Para aprovação com Aprovar, Atrasadas com Mudar prazo', () => {
  const { C, de } = contexto();
  const itens = ITENS();
  C.html(args(itens));
  const clique = de('click')[1];
  clique(ev('click', el({ 'data-coord-aba': '' }, { coordAba: 'heitor' })));
  clique(ev('click', el({ 'data-coord-ind': '' }, { coordInd: 'aprovar' })));
  let html = C.html(args(itens));
  assert.match(html, /class="d3h-cartao v2o-ind-lista" aria-label="Para aprovação"/);
  assert.match(html, /data-coord-aprovar="vybe:\d+"/);
  assert.match(html, /aria-expanded="true" title="Para aprovação: ver a lista"/);
  clique(ev('click', el({ 'data-coord-ind': '' }, { coordInd: 'atrasadas' })));
  html = C.html(args(itens));
  assert.match(html, /data-coord-mudar-prazo=/);
});

test('aba Heitor: o único laranja (o que era o cartão do topo e a faixa do Heitor) com os mesmos botões, os números e as sugestões', () => {
  const { C, de, guardado } = contexto();
  const itens = [...ITENS(), ...Array.from({ length: 4 }, () => peca('', '2026-11-12'))];
  C.html(args(itens));
  de('click')[1](ev('click', el({ 'data-coord-aba': '' }, { coordAba: 'heitor' })));
  assert.equal(guardado.get('vybe.coordenacao.aba'), 'heitor', 'a aba fica lembrada');
  const html = C.html(args(itens));
  assert.equal((html.match(/d3v-laranja/g) || []).length, 1, 'um laranja por tela');
  const lar = html.slice(html.indexOf('s-m-laranja'), html.indexOf('</section>', html.indexOf('s-m-laranja')));
  assert.match(lar, /atrasada.*no ar hoje.*para aprovar/, 'a frase do cartão de antes');
  assert.match(lar, /sem ninguém/, 'e o que o Heitor sugere');
  assert.match(lar, /data-coord-ind="atrasadas">Ver atrasadas</);
  assert.match(lar, /data-coord-atribuir="vybe:\d+" data-para="\w+">Atribuir a 1ª/);
  for (const k of ['Sem ninguém atribuído', 'Para equilibrar', 'Carga do time', 'agora → depois', 'class="d3h-nums"']) assert.ok(html.includes(k), k);
  assert.match(html, /data-coord-aba="heitor"[^>]*>Heitor<small>\d+<\/small>/, 'a aba conta as sugestões');
  assert.doesNotMatch(html, /class="v2o-sem-grade"/, 'só a aba aberta é desenhada');
});

test('aba Grupos: a tabela de Grupos da Produção é emprestada (não copiada) e volta ao Painel quando sai da vista', () => {
  const { C, dom, desenhos, guardado } = contexto({ aba: 'grupos' });
  const html = C.html(args(ITENS()));
  assert.match(html, /aria-selected="true" data-coord-aba="grupos"/, 'a aba guardada volta aberta');
  assert.match(html, /<div class="s-m-grupos-lado d3m-a-lado-v" id="s-m-grupos-lado"><\/div><div class="s-m-grupos-host" id="s-m-grupos-host"><\/div>/);
  assert.doesNotMatch(html, /<table/, 'nenhuma tabela própria: a de sempre entra no lugar');
  // Depois de pintar: a seção #grupos-board entra no quadro e é redesenhada lá (renderVisaoDeGrupos de sempre).
  assert.equal(C.depoisDePintar(), true);
  assert.equal(dom.secao.parentNode, dom.host); assert.deepEqual(desenhos, ['producao']);
  assert.equal(C.gruposNaCoordenacao(), true, 'renderVisaoDeGrupos desenha aqui');
  assert.equal(dom.painel.filhos[0].id, '#comentario', 'o lugar dela no Painel fica marcado');
  // Saiu do Hoje (a aba sumiu da vista): a primeira pergunta devolve a seção ao lugar exato, vazia e escondida.
  dom.hoje.visivel = false;
  assert.equal(C.gruposNaCoordenacao(), false);
  assert.equal(dom.secao.parentNode, dom.painel); assert.deepEqual(dom.painel.filhos.map((n) => n.id), ['grupos-board']);
  assert.ok(dom.secao.classes.has('focus-hidden')); assert.equal(dom.secao.innerHTML, '');
  // De volta à aba e depois para a Semana: soltar devolve e redesenha no Painel.
  dom.hoje.visivel = true; C.depoisDePintar(); assert.equal(dom.secao.parentNode, dom.host);
  guardado.clear();
  C.soltarGrupos(); assert.equal(dom.secao.parentNode, dom.painel); assert.equal(desenhos.at(-1), 'producao');
});

test('ligações: renderVisaoDeGrupos desenha no quadro, Esc tira a seleção ali e o Hoje devolve a tabela fora da Coordenação', () => {
  const agenda = ler('vybe-agenda.js'), mundo = ler('vybe-mundo.js');
  const r = agenda.slice(agenda.indexOf('function renderVisaoDeGrupos('), agenda.indexOf('const peca = (n) =>', agenda.indexOf('function renderVisaoDeGrupos(')));
  assert.match(r, /const naCoordenacao = quadro === 'producao' && Boolean\(typeof window !== 'undefined' && window\.VybeCoordenacao\?\.gruposNaCoordenacao\?\.\(\)\);\r?\n  const wrap = document\.getElementById\(cfg\.alvo\);/, 'pergunta antes de achar a seção');
  assert.match(r, /const aberta = forcar \|\| emprestadaAoDa\(cfg\.alvo\) \|\| naCoordenacao/);
  assert.match(r, /if \(naCoordenacao\) window\.VybeCoordenacao\.pintarLadoDeGrupos\?\.\(\);/);
  assert.match(agenda, /if \(haAlgoNaFrenteDaSelecao\(naCoordenacao \? \['#mode-gate'\] : \[\]\)\) return;/, 'o Hoje é o #mode-gate: ali ele não bloqueia o Esc');
  const d = mundo.slice(mundo.indexOf('  function desenharHoje() {'), mundo.indexOf("if (visaoHoje === 'coordenacao' && podeCoordenar() && pintarCoordenacao(el, { data })) return;"));
  assert.ok(d.indexOf('soltarGrupos') >= 0 && d.indexOf('soltarGrupos') < d.indexOf('pintarAgencia('), 'devolve antes de pintar outra aba');
  assert.match(mundo, /el\.innerHTML = html; el\.vvHtml = html; \}\r?\n    \/\/ Aba Grupos[^\n]*\r?\n    C\.depoisDePintar\?\.\(el\);/);
  // A busca da coluna ganha outro id (a do Painel continua lá) e o foco volta ao campo.
  const coord = ler('vybe-mundo-coordenacao.js');
  assert.match(coord, /replace\('id="busca-cliente-conteudos"', 'id="s-m-grupos-busca"'\)/);
  assert.doesNotMatch(coord, /pv2GruposHtml\(/, 'não desenha a tabela por conta própria');
});

test('CSS da frente s-m: fragmento novo, só tokens, sem !important, botão 34 canto 8, rótulo 12 e tutorial no lugar novo', () => {
  const css = ler('padrao-v2/s-m.css');
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\([^)]*\[style/);
  assert.match(ler('vybe-mundo-padrao-v2.css'), /\/\* ===== padrao-v2\/s-m\.css ===== \*\//);
  assert.match(css, /\.s-m-abas > button\{[^}]*height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  assert.match(css, /\.s-m-conta\{[^}]*height:34px;[^}]*border-radius:var\(--d3-r-botao\);[^}]*font:400 var\(--d3-fs-apoio\)/);
  assert.match(css, /\.s-m-semana > :is\(\.v2o-sem-grade,\.v2o-cal\)\{flex:1 1 0;min-height:0;overflow-y:auto/, 'a grade rola por dentro');
  for (const cor of css.match(/#[0-9a-f]{3,8}\b(?![-\w])/gi) || []) assert.fail(`cor solta ${cor}`);
  const rot = ler('vybe-mundo-tutorial-roteiros.js');
  const passo = rot.slice(rot.indexOf("id: 'hoje-coordenacao'"), rot.indexOf('],', rot.indexOf("id: 'hoje-coordenacao'")));
  assert.doesNotMatch(passo, /v2o-inds|v2o-heitor|d3v-lar-faixa/);
  assert.match(passo, /\.s-m-abas/); assert.match(passo, /\.s-m-contas/); assert.match(passo, /data-coord-aba="heitor"/);
});
