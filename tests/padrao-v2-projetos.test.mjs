// Padrão v2 em Projetos (quadro DEPOIS de Projetos: Produção › Projetos pontuais).
// SAFE: vm com DOM de mentira e fetch dublê; nada grava nem fala com servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(tag) { this.tagName = tag; this.innerHTML = ''; this.ouvintes = {}; this.isConnected = false; }
  append(el) { this.filho = el; el.isConnected = true; }
  setAttribute() {}
  addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); }
  remove() { this.isConnected = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
}
const HOJE = '2026-11-12';
const etapa = (id, nome, resp, inicio, fim, feita = false, extra = {}) => ({ id, nome, responsavel: resp?.[0] || null, responsavel_nome: resp?.[1] || null, inicio, fim, feita, esforco: 1, ...extra });
const BIA = ['3', 'Beatriz Alves'], DEI = ['1', 'Deivid Souza'], RER = ['2', 'Reriston Lima'], JAD = ['4', 'Jady Rocha'];
const PROJETOS = [
  { id: '10', nome: 'Inauguração da unidade nova', tipo: 'evento', cliente: 'Grupo Serra', cliente_id: '50', status: 'andamento', inicio: '2026-11-03', fim: '2026-11-28', descricao: '',
    etapas: [etapa('101', 'Briefing e conceito', BIA, '2026-11-03', '2026-11-03', true), etapa('102', 'Identidade do evento', DEI, '2026-11-04', '2026-11-09', true),
      etapa('103', 'Convites e impressos', DEI, '2026-11-10', '2026-11-12', false, { demanda_id: '900', demanda_status: 'Em produção', demanda_prazo: '2026-11-12', demanda_final: false }),
      etapa('104', 'Captação no dia', RER, '2026-11-21', '2026-11-21'), etapa('105', 'Vídeo de cobertura', RER, '2026-11-22', '2026-11-27')] },
  { id: '11', nome: 'Site novo', tipo: 'site', cliente: 'Clínica Sol', cliente_id: '51', status: 'andamento', inicio: '2026-11-02', fim: '2026-12-04',
    etapas: [etapa('111', 'Mapa do site', JAD, '2026-11-02', '2026-11-05', true), etapa('112', 'Textos das páginas', JAD, '2026-11-06', '2026-11-10'), etapa('113', 'Layout', DEI, '2026-11-11', '2026-11-20')] },
  { id: '12', nome: 'Campanha de verão', tipo: 'campanha', cliente: '', status: 'concluido', inicio: '2026-10-01', fim: '2026-10-30', etapas: [etapa('121', 'Peças', DEI, '2026-10-01', '2026-10-30', true)] },
];
const resposta = (gestao) => ({ ok: true, gestao, eu: { id: '2', nome: 'Reriston Lima' }, provisionado: true, hoje: HOJE, semana: '2026-11-09', fim: '2026-11-15', capacidade: 12,
  pessoas: [], clientes: [{ id: '50', nome: 'Grupo Serra' }, { id: '51', nome: 'Clínica Sol' }], projetos: JSON.parse(JSON.stringify(PROJETOS)), linha: { semanas: [{ inicio: '2026-11-02', esq: 0 }], hoje: 40, projetos: [] }, carga: [] });
function montar({ gestao = true } = {}) {
  const corpo = new El('body'), pedidos = [];
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, encodeURIComponent, setTimeout: () => {},
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelectorAll: () => [] }, window: { addEventListener() {} },
    fetch: async (url, op = {}) => { pedidos.push({ url, metodo: op.method, corpo: op.body ? JSON.parse(op.body) : null });
      return op.method === 'POST' ? { ok: true, json: async () => ({ ok: true }) } : { ok: true, json: async () => resposta(gestao) }; } };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), ctx);
  const raiz = () => corpo.filho;
  const alvo = (dataset, attrs = {}) => ({ dataset, disabled: false, getAttribute: (k) => attrs[k] ?? null, setAttribute() {}, classList: { toggle() {}, add() {} }, parentElement: null });
  const clicar = (seletor, dataset = {}, attrs = {}) => raiz().ouvintes.click[0]({ target: { closest: (s) => (s === seletor ? alvo(dataset, attrs) : null) } });
  return { P: ctx.window.VybePessoas, pedidos, clicar, janela: () => raiz().filho, html: () => raiz()?.filho?.innerHTML || '' };
}
const ordem = (h, ...trechos) => { let i = -1; for (const t of trechos) { const j = h.indexOf(t, i + 1); assert.ok(j > i, `"${t}" na ordem do quadro`); i = j; } };
const espera = () => new Promise((ok) => setImmediate(ok));

test('a tela segue o quadro (Direção 3): título com Cartões e Linha do tempo, o bloco de ação do Heitor, quatro números, a barra e os cartões com o projeto aberto', async () => {
  const t = montar();
  await t.P.abrir('projetos');
  const h = t.html();
  assert.equal(t.janela().className, 'vp-janela v2p-janela');
  // no HTML a ação vem antes; o CSS põe na ordem do quadro (vista, ajuda, ação)
  ordem(h, '<h2 id="vp-titulo">Projetos</h2>', 'data-vp-abrir-form="projeto">Novo projeto', 'data-v2pj-vista="cartoes" aria-pressed="true">Cartões', 'data-v2pj-vista="tempo" aria-pressed="false">Linha do tempo',
    'data-vp-ajuda', 'class="d3-acao"', 'Heitor · Coordenação', 'class="d3pj-nums"',
    'placeholder="Buscar projeto"', 'data-v2p-filtro="abertos">Em andamento <b>2</b>', 'data-v2p-filtro="concluidos">Concluídos <b>1</b>', '>Cliente</button>', '>Responsável</button>', '>Filtros</button>',
    'class="v2pj-grade"', 'data-v2pj-abre="10" aria-pressed="true"', 'data-v2pj-abre="11" aria-pressed="false"', 'data-v2pj-pag');
  assert.equal(h.split('<button type="button" class="vp-acao"').length - 1, 1, 'uma ação principal');
  assert.doesNotMatch(h, /vp-nums|Gantt de projetos pontuais|Campanha de verão/, 'sem os quatro números antigos; concluído só no filtro');
  // a fala: quantos andam e a etapa vencida mais antiga, com o botão que abre o projeto
  assert.ok(h.includes('<span>Site novo da Clínica Sol com etapa vencida há 2 dias.</span>'), 'a frase curta do bloco de ação');
  assert.match(h, /data-v2pj-abre="11" data-forcar="1">Ver a etapa</);
  // o cartão: cliente, situação, etapas e a próxima (vencida em vermelho)
  assert.match(h, /class="v2p-pill r">Etapa vencida<\/span><\/span><b class="v2pj-tit">Site novo<\/b>/);
  assert.match(h, /1 de 3 etapas/); assert.match(h, /v2pj-prox ruim">Textos das páginas · era 10\/11</);
  assert.match(h, /v2pj-prox">Convites e impressos · hoje</);
  // a página: período, pessoas, 40%, etapas riscadas, a próxima, as demandas e o rodapé
  assert.match(h, /De 3 a 28 de novembro · com Beatriz, Deivid e Reriston/);
  assert.match(h, /<b>40%<\/b><span class="v2p-sub">2 de 5 etapas/);
  assert.match(h, /class="v2-risca feita">Briefing e conceito</); assert.match(h, /<b><span class="v2-risca">Convites e impressos<\/span><\/b> <span class="v2p-pill b">próxima</);
  assert.match(h, /sáb 21\/11/); assert.match(h, /1 demanda<\/span><p>ligada ao projeto · não está atrasada<\/p><button type="button" class="v2p-btn s" data-vp-demanda="900"/);
  assert.match(h, /3 pessoas nas etapas/); assert.match(h, /data-v2pj-nova-etapa="10">Nova etapa/); assert.match(h, /data-v2pj-concluir="103"[^>]*>Concluir etapa/);
  assert.match(h, /data-vp-editar-projeto="10">Editar/); assert.match(h, /aria-label="Mais opções"/); assert.match(h, /data-v2pj-abre="">Fechar/);
});

test('escolher, fechar, filtrar e trocar para a linha do tempo', async () => {
  const t = montar();
  await t.P.abrir('projetos');
  t.clicar('[data-v2pj-abre]', { v2pjAbre: '11' });
  let h = t.html();
  assert.match(h, /data-v2pj-abre="11" aria-pressed="true"/); assert.match(h, /v2pj-pag v2pj-vira/); assert.match(h, /<b><span class="v2-risca">Textos das páginas<\/span><\/b> <span class="v2p-pill r">vencida/);
  t.clicar('[data-v2pj-abre]', { v2pjAbre: '' });
  h = t.html();
  assert.match(h, /class="v2pj-grade so-lista"/); assert.doesNotMatch(h, /data-v2pj-pag/);
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'concluidos' });
  assert.match(t.html(), /Campanha de verão/); assert.match(t.html(), /Projeto interno/);
  t.clicar('[data-v2pj-painel]', { v2pjPainel: 'cliente' });
  assert.match(t.html(), /data-v2pj-campo="cliente" data-valor="Clínica Sol"/);
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'abertos' });
  t.clicar('[data-v2pj-campo]', { v2pjCampo: 'cliente', valor: 'Clínica Sol' });
  h = t.html();
  assert.match(h, /aria-pressed="true" aria-expanded="true">Cliente: Clínica Sol/); assert.doesNotMatch(h, /data-v2pj-abre="10" aria-pressed/);
  t.clicar('[data-v2pj-abre]', { v2pjAbre: '11' });
  t.clicar('[data-v2pj-mais]', { v2pjMais: '11' });
  assert.match(t.html(), /data-v2pj-tempo="11">Ver na linha do tempo/);
  t.clicar('[data-v2pj-tempo]', { v2pjTempo: '11' });
  h = t.html();
  assert.match(h, /data-v2pj-vista="tempo" aria-pressed="true"/); assert.match(h, /<h3>Linha do tempo<\/h3>/); assert.match(h, /data-vp-proj-sel/); assert.match(h, /data-vp-proj-zoom="semana" aria-pressed="true"/);
  assert.match(h, /<h3>A semana<\/h3>/); assert.match(h, /data-vp-semana="-7"/);
});

test('marcar e concluir etapa mandam ao servidor o mesmo etapa_feita de antes', async () => {
  const t = montar();
  await t.P.abrir('projetos');
  t.clicar('[data-v2pj-etapa]', { v2pjEtapa: '104' }, { 'aria-pressed': 'false' }); await espera();
  t.clicar('[data-v2pj-etapa]', { v2pjEtapa: '101' }, { 'aria-pressed': 'true' }); await espera();
  t.clicar('[data-v2pj-concluir]', { v2pjConcluir: '103' }); await espera();
  assert.deepEqual(t.pedidos.filter((p) => p.metodo === 'POST').map((p) => p.corpo), [
    { acao: 'etapa_feita', id: '104', feita: true }, { acao: 'etapa_feita', id: '101', feita: false }, { acao: 'etapa_feita', id: '103', feita: true }]);
});

test('o formulário de projeto continua com os mesmos campos e abre no lugar da página', async () => {
  const t = montar();
  await t.P.abrir('projetos');
  t.clicar('[data-vp-editar-projeto]', { vpEditarProjeto: '10' });
  const h = t.html();
  assert.match(h, /<form data-vp-form="projeto" class="vp-cartao vp-form v2pj-form"/); assert.doesNotMatch(h, /data-v2pj-pag/);
  for (const n of ['id', 'nome', 'tipo', 'cliente_id', 'cliente', 'status', 'inicio', 'fim', 'descricao', 'e_id', 'e_feita', 'e_nome', 'e_responsavel', 'e_inicio', 'e_fim', 'e_esforco']) assert.match(h, new RegExp(`name="${n}"`), n);
  assert.equal(h.split('class="vp-etapa-form"').length - 1, 5);
  t.clicar('[data-vp-fechar-form]');
  t.clicar('[data-v2pj-nova-etapa]', { v2pjNovaEtapa: '10' });
  assert.equal(t.html().split('class="vp-etapa-form"').length - 1, 6, 'Nova etapa abre o formulário com uma etapa em branco no fim');
  const js = readFileSync('vybe-mundo-pessoas.js', 'utf8');
  assert.match(js, /gravar\(\{ acao: 'projeto_salvar', id: f\.id \|\| null, nome: f\.nome, tipo: f\.tipo, cliente_id: f\.cliente_id \|\| null, cliente: f\.cliente_id \? '' : f\.cliente \|\| '', status: f\.status, inicio: f\.inicio, fim: f\.fim, descricao: f\.descricao, etapas \}/);
});

test('quem não é da gestão: sem Novo projeto, Editar nem Nova etapa; só marca a própria etapa', async () => {
  const t = montar({ gestao: false });
  await t.P.abrir('projetos');
  const h = t.html();
  assert.doesNotMatch(h, /Novo projeto|data-vp-editar-projeto|data-v2pj-nova-etapa/);
  assert.match(h, /data-v2pj-etapa="103"[^>]*disabled/, 'etapa do Deivid travada para o Reriston');
  assert.match(h, /data-v2pj-etapa="104" aria-pressed="false" aria-label="Marcar como feita: Captação no dia">/, 'a dele fica livre');
  assert.doesNotMatch(h, /data-v2pj-concluir/, 'a próxima é do Deivid: sem Concluir etapa');
});

test('sem projeto: a fala do Heitor diz o que é a tela; Novo projeto só no alto e só para quem cria', async () => {
  const t = montar();
  PROJETOS.splice(0);
  await t.P.abrir('projetos');
  assert.match(t.html(), /Heitor · Coordenação/); assert.match(t.html(), /Nenhum projeto pontual\./); assert.doesNotMatch(t.html(), /data-v2pj-vista/);
  assert.equal(t.html().split('Novo projeto').length - 1, 1);
});

test('o CSS de Projetos fica no fragmento, pelo id da janela e sem forçar regra antiga', () => {
  const css = readFileSync('padrao-v2/projetos.css', 'utf8'), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(semComentario, /!important|html body\.mundo/);
  assert.ok(semComentario.split('}').every((r) => !r.trim() || /^\s*(@|#vv-pessoas|from|to|\d+%)/.test(r.trim())), 'toda regra começa pelo id da janela');
  assert.match(css, /#vv-pessoas \.v2pj-grade\{[^}]*grid-template-columns:350px minmax\(0,1fr\);gap:14px/);
  assert.match(css, /\.v2pj-card\[aria-pressed="true"\]\{box-shadow:0 0 0 2px var\(--c,#3B5BA9\)/);
  assert.match(css, /#vv-pessoas \.v2p-card\.v2pj-pag\{[^}]*padding:22px\}/);
  assert.match(css, /\.v2pj-pag-tit\{margin:12px 0 0;font:700 22px\/1\.2/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});
