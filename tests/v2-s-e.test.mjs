// SAFE: rodada S do padrão V2, frente "e" (19/11/2026). Funções puras num vm, sem rede, sem banco e sem gravar nada:
// a gravação dos responsáveis é trocada por uma função que só anota a chamada.
// - Requer ação com recorte (Agenda e Creators) e "Heitor sugere" com nomes e "Distribuir assim" (só dono).
// - A conta do Heitor é uma só (pv2CoordSemana) para a Equipe e para a janela.
// - Fornecedores e Creators na casa da Visão do setor sem perder botão; passagem de bastão na casca V2.
// - Legado: as regras com !important estreitadas na origem, sem !important novo no fragmento.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const trecho = (js, de, ate) => { const i = js.indexOf(de), j = js.indexOf(ate, i + 1); assert.ok(i >= 0 && j > i, `achou ${de}`); return js.slice(i, j); };
const J = (x) => JSON.parse(JSON.stringify(x));
const gestor = ler('vybe-gestor.js');

function fila(extra = {}) {
  const motivos = [{ chave: 'vencido', rotulo: 'Prazo vencido' }, { chave: 'semdono', rotulo: 'Sem responsável' }];
  const itens = [
    { id: 'a', nome: 'Reels A', cliente: 'Alfa', formato: 'Reels', prazo: '2026-11-18', dono: '' },
    { id: 'b', nome: 'Card B', cliente: 'Beta', formato: 'Card', prazo: '2026-11-18', dono: '' },
    { id: 'c', nome: 'Card C', cliente: 'Alfa', formato: 'Card', prazo: '2026-11-19', dono: '1' },
  ];
  const chamadas = [];
  const ctx = vm.createContext({
    window: {}, console, SESSAO_ATUAL: { dono: true }, currentWeek: 1, showAllActionItems: false,
    TEAM_USERS: [{ id: '7', name: 'Danilo Souza' }, { id: '8', name: 'Lucas Lima' }],
    ACAO_MOTIVOS: motivos, getActionItems: () => itens, acaoMotivoDoItem: (d) => (d.dono ? 'vencido' : 'semdono'),
    opsTodayIso: () => '2026-11-19', opsTodayItems: () => itens, getDateIso: (d) => d.prazo, opsOwners: () => [],
    firstName: (n) => String(n || '').split(' ')[0], pv2SemDono: (d) => !d.dono, assignedIds: (d) => (d.dono ? [d.dono] : []),
    findOperationalItem: (id) => itens.find((d) => d.id === id), filaV2Pintar: () => {},
    pv2CoordSemana: () => ({ semDono: [{ d: { id: 'b' }, sugerido: '7' }, { d: { id: 'a' }, sugerido: '8' }, { d: { id: 'z' }, sugerido: '7' }] }),
    gravarResponsaveisDaPeca: async (item, novos) => { chamadas.push([item.id, [...novos]]); },
    ...extra,
  });
  vm.runInContext(trecho(gestor, 'const FILA_V2 = {', 'function filaV2Linha(') + '\nthis.F = FILA_V2;', ctx);
  return { ctx, chamadas, itens };
}

test('Requer ação: o recorte vale para as duas abas e sai pelo chip', () => {
  const { ctx } = fila();
  ctx.F.recorte = { chave: 'x', rotulo: 'só Alfa', filtro: (d) => d.cliente === 'Alfa' };
  ctx.F.aba = 'acao';
  assert.deepEqual(ctx.filaV2Dados().acao.map((d) => d.id), ['a', 'c']);
  ctx.F.aba = 'hoje'; ctx.F.hoje = 'todas';
  assert.deepEqual(ctx.filaV2Dados().doDia.map((d) => d.id), ['a', 'c']);
  ctx.filaV2SemRecorte();
  assert.equal(ctx.F.recorte, null);
  assert.equal(ctx.filaV2Dados().doDia.length, 3);
});

test('Requer ação da Agenda: só o que passa pela captação e pelo audiovisual', () => {
  const { ctx } = fila();
  const r = ctx.filaV2RecorteAgenda();
  assert.equal(r.chave, 'agenda');
  assert.equal(r.filtro({ formato: 'Reels' }), true);
  assert.equal(r.filtro({ formato: 'Card', status: 'Aguardo' }), true);
  assert.equal(r.filtro({ formato: 'Card', captacao: 'Sim' }), true);
  assert.equal(r.filtro({ formato: 'Card', status: 'A fazer' }), false);
});

test('Heitor sugere: os nomes vêm da mesma conta da Coordenação, só para as sem responsável desta fila', () => {
  const { ctx, itens } = fila();
  const S = J(ctx.filaV2Sugestoes(itens));
  assert.equal(S.semDono, 2);
  assert.deepEqual(S.lista.map((x) => [x.d.id, x.para, x.nome]), [['b', '7', 'Danilo'], ['a', '8', 'Lucas']]);
});

test('Distribuir assim: pergunta antes, grava pelo caminho da Coordenação e só para dono', async () => {
  const { ctx, chamadas } = fila();
  ctx.filaV2Distribuir();
  assert.equal(ctx.F.heitor.pergunta, true, 'o 1º clique só pergunta');
  assert.equal(chamadas.length, 0);
  const r = await ctx.filaV2Distribuir('sim');
  assert.deepEqual(J(r), { ok: 2, falhas: 0, n: 2 });
  assert.deepEqual(chamadas, [['b', ['7']], ['a', ['8']]]);
  const outro = fila({ SESSAO_ATUAL: { dono: false } });
  outro.ctx.filaV2Distribuir(); await outro.ctx.filaV2Distribuir('sim');
  assert.equal(outro.ctx.F.heitor.pergunta, false);
  assert.equal(outro.chamadas.length, 0, 'quem não é dono não grava');
});

test('A conta do Heitor é uma só: a Equipe e a janela chamam pv2CoordSemana', () => {
  assert.equal((gestor.match(/C\.calcular\(|\.calcular\(\{ itens: abertas/g) || []).length, 1);
  assert.match(gestor, /const r = pv2CoordSemana\(itens\);/);
  const ctx = vm.createContext({ window: {}, EQUIPES: { design: ['1'], audiovisual: ['2'] }, TEAM_USERS: [{ id: '1', name: 'Ana' }, { id: '2', name: 'Rui' }],
    isFinishedItem: (d) => d.fim, isRequestItem: () => false, pv2HojeIso: () => '2026-11-19', unifiedOperationalItems: () => [{ id: 'x' }, { id: 'y', fim: true }] });
  let args = null; ctx.window.VybeCoordenacao = { calcular: (a) => { args = a; return { semDono: [] }; } };
  vm.runInContext(trecho(gestor, 'function pv2CoordSemana(', 'function pv2EquipePintar('), ctx);
  ctx.pv2CoordSemana();
  assert.deepEqual(args.itens.map((d) => d.id), ['x']);
  assert.deepEqual(J(args.time.map((p) => [p.id, p.disciplina])), [['1', 'design'], ['2', 'audiovisual']]);
  assert.equal(args.periodo, 'semana');
});

test('Creators: o "Requer ação" abre a janela só com os clientes que têm creator em campanha', () => {
  const com = ler('vybe-mundo-comercial.js');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ctx = vm.createContext({ norm, window: { clientesDoItem: (d) => d.clientes } });
  vm.runInContext(trecho(com, '  function recorteCreators(', '  const M2 = {') + '\nthis.r = recorteCreators;', ctx);
  const r = ctx.r(['academia lions']);
  assert.equal(r.filtro({ clientes: ['Academia Lions'] }), true);
  assert.equal(r.filtro({ clientes: ['Hebravet'] }), false);
  assert.match(com, /window\.filaV2Abrir\?\.\('acao', clientes\.length \? \{ recorte: recorteCreators\(clientes\) \} : \{\}\)/);
  assert.match(ler('vybe-captacoes.js'), /onclick="filaV2AbrirDaAgenda\(\)"/);
});

test('Fornecedores e Creators na casa da Visão do setor, com todos os botões de antes', () => {
  const com = ler('vybe-mundo-comercial.js');
  const bloco = trecho(com, '  const VSX_SELO = {', '  function recorteCreators(');
  for (const a of ['data-vc="fornecedor"', 'data-vc="arquivar-forn"', 'data-vc="ver-impressoes"', 'data-vc="creator"', 'data-vc="arquivar-creator"', 'data-vc="campanha"', 'data-vc="campanha-encerrar"',
    'data-v2="salvar-campo"', 'data-v2="abre"', 'data-v2="abre-um"', 'data-v2="chip"', 'data-m2="categorias"', 'data-m2="ajuda"', 'data-m2="nicho"', 'data-m2="ordem"', 'data-m2="ir" data-id="impressoes"', 'data-m2="ir" data-id="creators"']) assert.ok(bloco.includes(a), a);
  for (const c of ['vst-nums', 'Pede ação, na ordem', 'vst-laranja', 'Por status', 'vst-dir', 'vst-esq']) assert.ok(bloco.includes(c), c);
  assert.match(bloco, /quem = 'Nestor · Compras'/, 'Fornecedores fala pelo Nestor');
  assert.match(bloco, /quem = 'Creators · o mais grave'/, 'Creators não inventa agente');
});

test('Bastão na casca V2: os mesmos ids e o mesmo caminho de gravação', () => {
  const p = ler('vybe-portoes.js');
  const g = trecho(p, 'function openHandoffGate(', 'function passoDoBastao(');
  for (const id of ['id="handoff-done"', 'id="handoff-link"', 'id="handoff-next"', 'id="bastao-revisao"', 'id="bastao-voltar"', 'id="bastao-seguir"', 'id="bastao-onde"', 'data-bastao="0"', 'data-bastao-passo']) assert.ok(g.includes(id), id);
  assert.match(g, /abrirJanelaV2\(html, 'vbb'\)/);
  assert.match(g, /facilitarPassagemDeBastao\(item, option\)/);
  assert.match(p, /if \(ir >= secoes\.length\) return submitHandoff\(\);/);
});

test('CSS: fragmento só com tokens e sem !important; o legado estreitado na origem', () => {
  const css = ler('padrao-v2/s-e.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.doesNotMatch(css, /:has\([^)]*\[style/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, 'sem cor escrita');
  const leg = ler('vybe-mundo.css');
  assert.match(leg, /\.t-u1:not\(\.vle-n > b\)\{color:#B42318!important/);
  assert.match(leg, /:is\(#workflow-modal,\.workflow-modal\):not\(\.vbj\) :is\(select,/);
  assert.match(leg, /background:var\(--wm-veu,rgba\(31,29,26,\.28\)\)!important/);
  assert.match(css, /\.workflow-backdrop:has\(\+ \.vbj\)\{--wm-veu:var\(--d3-ambiente-veu\)\}/);
  assert.match(leg, /background-color:var\(--d3-cartao,#FFFFFF\)!important/);
});
