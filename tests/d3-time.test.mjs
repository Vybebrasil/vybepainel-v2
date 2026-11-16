// Direção 3 nas telas do Time (quadros D3-RhPedidos, D3-Produtividade, D3-Recrutamento, D3-Documentos, D3-Academy,
// D3-ContaEquipe, D3-EquipeOnline, D3-Agentes, D3-PerfilAgente e D3-Automacoes).
// SAFE: vm com DOM de mentira e fetch dublê; nada grava nem fala com servidor.
// As partes da Conta e dos Agentes ficam nos arquivos ao lado e rodam junto por aqui.
import './d3-time-conta.test.mjs';
import './d3-time-agentes.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(tag) { this.tagName = tag; this.innerHTML = ''; this.ouvintes = {}; }
  append(el) { this.filho = el; }
  setAttribute() {}
  addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); }
  remove() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
}
const H = '2026-11-13';
const comum = { ok: true, gestao: true, eu: { id: '5', nome: 'Paulo Vybe' }, provisionado: true, hoje: H };
const p = (id, nome, score, entregues, meta) => ({ id, nome, score, entregues, meta, atrasadas: 0, conquistas: score > 90 ? [{ titulo: '10 seguidas no prazo' }] : [], componentes: { prazo: score / 100 }, frases: [] });
const DADOS = {
  produtividade: { ...comum, mes: '2026-11', componentes: [{ id: 'prazo', nome: 'Entregas no prazo' }], ranking: [p('1', 'Jady Rocha', 94, 30, 30), p('2', 'Reriston Alves', 61, 8, 25)], pesos: {}, cargos: {}, metas: {} },
  rh: { ...comum, rhPronto: true, tipos: [{ id: 'ferias', nome: 'Férias ou folga', dias: 5 }], status: { aberto: 'Aberto' },
    pedidos: [{ id: '11', pessoa_id: '3', pessoa_nome: 'Beatriz Lima', titulo: 'Férias', tipo: 'ferias', status: 'aberto', prazo: '2026-11-14', sla: 'no_prazo', inicio: '2026-11-23', fim: '2026-11-27', idadeDias: 2 }],
    indicadores: { abertos: 1, foraDoPrazo: 0, respondidos: 10, tempoMedioDias: 1, noPrazoPct: 90 }, aniversarios: [], ferias: [], meuPerfil: {}, pessoas: [], perfis: [], pesquisa: { dimensoes: [] } },
  documentos: { ...comum, tipos: { contrato: 'Contratos' }, avisoDias: 30, pessoas: [],
    documentos: [{ id: '1', pessoa_id: '2', pessoa_nome: 'Reriston Alves', tipo: 'contrato', titulo: 'Contrato', renovacao: '2026-11-07', situacao: 'vencido' }, { id: '2', pessoa_id: '4', pessoa_nome: 'Jady Rocha', tipo: 'contrato', titulo: 'Estágio', renovacao: '2026-11-23', situacao: 'renovar' }] },
  recrutamento: { ...comum, etapas: ['Triagem', 'Proposta'], vagas: [{ id: '1', titulo: 'Designer', status: 'aberta', aberta_em: '2026-10-10' }], candidatos: [], indicadores: { abertas: 1, candidatos: 0, tempoMedio: {} } },
  academy: { ...comum, feitas: [], modelo: null, pessoas: [], trilhas: [] },
};
function montar() {
  const corpo = new El('body');
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, encodeURIComponent,
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelectorAll: () => [] }, window: { addEventListener() {} },
    fetch: async (url) => ({ ok: true, json: async () => DADOS[new URL(url, 'http://x').searchParams.get('aba')] }) };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), ctx);
  return { P: ctx.window.VybePessoas, html: () => corpo.filho?.filho?.innerHTML || '' };
}

// V2 · grupo E (pranchas V2-M-RH-* e V2-M-Academy, 16/11/2026): as telas já no esqueleto novo saem do teste da Direção 3
// e ganham o do vidro fumê; as outras seguem com a proteção de antes até chegar a vez delas.
const E_FEITAS = ['produtividade', 'rh', 'recrutamento'];
test('V2 · grupo E: o título no vidro, as abas de antes escondidas no DOM e sem o bloco laranja', async () => {
  const t = montar();
  for (const aba of E_FEITAS) {
    await t.P.abrir(aba);
    const h = t.html();
    assert.match(h, /^<div class="d3m-e-tela d3m-e-pes /, `${aba}: a casca do grupo E`);
    assert.match(h, /class="d3m-e-topo"><div class="d3m-e-tit">/, `${aba}: o topo no vidro`);
    assert.match(h, /<div class="vp-abas" role="tablist" aria-label="Partes do setor de Pessoas" hidden>/, `${aba}: as abas seguem no DOM, escondidas`);
    assert.match(h, /data-vp-fechar aria-label="Fechar"/, `${aba}: o Fechar no topo`);
    assert.doesNotMatch(h, /d3-acao|v2p-fala|vp-topo-botoes/, `${aba}: sem o bloco laranja e sem o cabeçalho antigo`);
  }
});
test('RH na Direção 3: abas no cabeçalho, o dia ao lado do título, um bloco de ação laranja e números d3-num', async () => {
  const t = montar();
  await t.P.abrir('academy'); // a primeira resposta diz que é gestão (Recrutamento e Documentos só abrem para ela)
  for (const aba of ['produtividade', 'rh', 'recrutamento', 'documentos', 'academy'].filter((a) => !E_FEITAS.includes(a))) {
    await t.P.abrir(aba);
    const h = t.html();
    assert.match(h, /class="vp-topo-botoes"><div class="d3p-abas" role="tablist"/, `${aba}: abas dentro do cabeçalho`);
    assert.doesNotMatch(h, /class="vp-abas"/, `${aba}: sem a fileira de abas antiga`);
    // Acabamento 15/11: um bloco só, laranja quando há ação e a nota branca (d3-nota) quando não há.
    assert.equal(h.split('class="v2p-fala d3-acao d3p-acao"').length - 1 + h.split('class="v2p-fala d3-nota"').length - 1, 1, `${aba}: um bloco de ação ou nota`);
    assert.match(h, /class="(v2p-ag d3-acao-av|d3-nota-av)"/, `${aba}: avatar do agente no bloco`);
    assert.ok(h.split('class="v2p-card v2p-kpi d3-num').length - 1 >= 3, `${aba}: números d3-num`);
    assert.doesNotMatch(h, /v2p-card v2p-fala/, `${aba}: a fala branca saiu`);
  }
});

test('Produtividade: o anel, os componentes do servidor, as colunas Pessoa · Metas · Conquistas · Score e quem pede atenção', async () => {
  const t = montar();
  await t.P.abrir('produtividade');
  const h = t.html();
  // Prancha V2-M-RH-Produtividade: o anel do score e os quatro componentes na folha do mês; as colunas do mês de cada um e
  // quem pede atenção na consulta.
  assert.match(h, /class="d3m-e-pes-anel/); assert.equal((h.match(/class="d3m-e-pes-comp( [ga])?"/g) || []).length, 1, 'só os componentes que o servidor mandou (aqui, o prazo)');
  assert.match(h, /class="d3p-col-meta g">30\/30</); assert.match(h, /class="d3p-col-meta a">8\/25</);
  assert.match(h, /<b>Reriston<\/b> · score 61/);
});

test('Pedidos: rótulos curtos e o 1º que vence; Documentos: linha do tempo dos vencimentos com o hoje', async () => {
  const t = montar();
  await t.P.abrir('rh');
  let h = t.html();
  // Prancha V2-M-RH-Pedidos: o prazo de cada pedido no selo da linha e a legenda do calendário na consulta.
  assert.match(h, /class="d3m-e-pes-selo( a)?">até /); assert.match(h, /class="d3m-e-pes-leg-c"/);
  await t.P.abrir('documentos');
  h = t.html();
  assert.match(h, /aria-label="Vencimentos"/); assert.match(h, /class="d3p-tl-hoje"/);
  assert.match(h, /class="d3p-tl-pt r"[^>]*title="Contrato"/); assert.match(h, /class="d3p-tl-pt a"[^>]*title="Estágio"/);
  assert.match(h, /data-v2p-tipo="contrato"/, 'os tipos viram fichas de filtro');
  assert.match(h, /<span>Pessoa<\/span><span>Docs<\/span><span>Situação<\/span>/);
});

test('Recrutamento: o período Mensal | Anual no topo, no vidro, e o mês na cabeça do funil', async () => {
  const t = montar();
  await t.P.abrir('academy'); await t.P.abrir('recrutamento'); // a primeira resposta diz que é gestão
  const h = t.html(), topo = h.slice(0, h.indexOf('vp-corpo'));
  assert.match(topo, /class="d3m-e-per" role="group" aria-label="Período"><button type="button" data-vp-periodo="mensal" aria-pressed="true">Mensal/);
  assert.match(h, /data-vp-ref-ir="\d{4}-\d{2}" aria-label="Mês anterior"/);
});

test('CSS do Time: sem !important nem html body.mundo, tokens --d3-* e o prefixo da janela', () => {
  const css = readFileSync('padrao-v2/d3-time.css', 'utf8'), sem = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sem, /!important|html body\.mundo/);
  const rh = css.slice(css.indexOf('/* ===== RECURSOS HUMANOS ===== */'), css.indexOf('/* ===== FIM RECURSOS HUMANOS ===== */'));
  assert.match(rh, /#vv-pessoas\.v2p-janela \.v2p-fala\.d3-acao\{/); assert.match(rh, /var\(--d3-areia\)|var\(--d3-tinta\)/);
  assert.match(readFileSync('vybe-mundo-padrao-v2.css', 'utf8'), /padrao-v2\/d3-time\.css/, 'o juntador levou o fragmento');
});
