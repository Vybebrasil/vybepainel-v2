// Redesign das telas da Produção (quadros 15 e 16 do moodboard, 10/11/2026). SAFE: vm com DOM de mentira e fetch dublê.
//   15 Visão geral da Produção: "Pede ação" primeiro, com o botão de resolver; os números numa linha; gráfico só com dado.
//   16 Aprovação de conteúdo: o que falta em poucas palavras por cliente (VybeEquilibrio.resumoCurto).
//   16 Projetos pontuais: sem projeto, um estado vazio só, com "Novo projeto" para quem cria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vbResumoHtml = (itens) => `<div class="vb-resumo">${itens.filter(Boolean).map((x) => `<span class="vb-resumo-item ${x.tom || ''}">${x.valor == null ? '' : `<b>${esc(x.valor)}</b>`}${esc(x.rotulo)}</span>`).join('')}</div>`;
const vbEstadoHtml = ({ tipo = 'vazio', titulo = '', texto = '', acao = '' } = {}) => `<div class="vb-estado ${tipo}"><b>${esc(titulo)}</b><p>${esc(texto)}</p>${acao}</div>`;

// ---------- Visão geral (vybe-mundo-setor.js) ----------
function montarSetor({ respostas = {} } = {}) {
  const partes = new Map(), removidos = [];
  const parte = (sel) => { if (!partes.has(sel)) partes.set(sel, { innerHTML: '', remove() { removidos.push(sel); } }); return partes.get(sel); };
  const el = { hidden: true, innerHTML: '', className: '', scrollTop: 0, ouvintes: {}, setAttribute() {}, addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); }, querySelector: parte };
  const ctx = {
    console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, URL,
    document: { createElement: () => el, body: { append() {}, classList: { add() {}, remove() {} } } },
    fetch: async (url) => {
      const chave = Object.keys(respostas).find((k) => url.includes(k));
      return { ok: true, status: 200, json: async () => (chave ? respostas[chave] : {}) };
    },
    vbResumoHtml, vbEstadoHtml, DADOS_ALL: [{ id: '7', status: 'Ag. Aprovação Cliente' }],
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-setor.js', 'utf8'), ctx);
  const corpo = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); return parte('.vs-corpo').innerHTML; };
  return { S: ctx.VybeSetor, el, corpo, removidos };
}
const numeros = (extra = {}) => ({
  hoje: { atrasadas: 1, emRisco: 0, lista: {} }, semana: { previstas: 4, previstasEntregues: 1, entregues: 2 },
  historico: { mediaNoPrazoPct: null, medianaEntregues: 0, semanas: [{ inicio: '2026-11-09', previstas: 4, entregues: 2 }] },
  projecao: { proximaSemana: { previstas: 0, capacidadeMediana: 0, folga: 0 } }, cobertura: { meta: 3 }, time: [], clientes: [], gargalos: [],
  alertas: [
    { nivel: 1, texto: '1 peça furando a data do cliente (veiculação vencida): Post A', ref: { tipo: 'pecas', ids: ['7'] } },
    { nivel: 2, texto: '2 peças com risco de furo nos próximos 2 dias: Post B, Post C', ref: { tipo: 'pecas', ids: ['8', '9'] } },
    { nivel: 3, texto: 'Próxima semana: 9 peças previstas para uma capacidade de 4 por semana', ref: { tipo: 'semana', inicio: '2026-11-16' } },
    { nivel: 4, texto: '1 peça esperando o cliente (aprovação ou informação): Post D', ref: { tipo: 'pecas', ids: ['7', '10'] } },
    { nivel: 5, texto: '2 clientes sem planejamento: X, Y', ref: { tipo: 'clientes', nomes: ['X', 'Y'] } },
  ],
  ...extra,
});
const ctxProducao = (N, fila = []) => ({ nome: 'Produção', dica: '', subs: [{ id: 'gestor', nome: 'Painel de trabalho' }, { id: 'tarefas', nome: 'Minhas tarefas' }, { id: 'conteudo', nome: 'Aprovação de conteúdo' }],
  numeros: () => N, fila: () => ({ itens: fila }), agenda: () => [], abrirSub() {}, irSetor() {}, aoFechar() {} });

test('Produção: "Pede ação" vem primeiro, cada alerta com o botão de resolver', async () => {
  const t = montarSetor();
  t.S.abrir('setor:producao', ctxProducao(numeros(), [{ sit: 'atrasada' }, { sit: 'ok' }]));
  const h = await t.corpo();
  assert.ok(h.indexOf('Pede ação') >= 0 && h.indexOf('Pede ação') < h.indexOf('vb-resumo'), 'Pede ação antes da linha de números');
  assert.match(h, /data-vs-peca="7">Abrir a peça/, 'uma peça só abre a peça');
  assert.match(h, /data-espiar="alerta:1">Resolver/, 'várias peças abrem a lista por trás do alerta');
  assert.match(h, /data-setor-sub="gestor">Ver a semana/, 'a semana cheia leva ao Painel de trabalho');
  assert.match(h, /data-espiar="alerta:3">Cobrar/, 'esperando o cliente: cobrar');
  assert.doesNotMatch(h, /<b>2 clientes sem planejamento<\/b>/, 'nível 5 fica nos cartões de baixo');
  assert.match(h, /1 peça atrasada na sua fila/);
  assert.match(h, /<b>Post A<\/b>|Post A/);
});

test('Produção: os seis números viram uma linha de resumo, com o zero discreto', async () => {
  const t = montarSetor();
  t.S.abrir('setor:producao', ctxProducao(numeros()));
  const h = await t.corpo();
  assert.doesNotMatch(h, /vs-kpis/, 'sem os seis cartões grandes');
  assert.match(h, /<b>1 de 4<\/b>previstas da semana prontas \(25%\)/);
  assert.match(h, /vb-resumo-item alerta"><b>1<\/b>atrasada agora/);
  assert.match(h, /vb-resumo-item zero"><b>0<\/b>com risco de furo/);
  assert.match(h, /no prazo: sem histórico ainda/);
  assert.match(h, /<b>1<\/b>em aprovação/, 'em aprovação continua, pelas peças do painel');
  for (const bloco of ['Entregas por semana', 'Carga do time', 'Onde trava', 'Clientes com atraso', 'Cobertura da semana', 'Próximos compromissos']) assert.match(h, new RegExp(bloco), `${bloco} continua`);
});

test('Produção: sem histórico, uma frase no lugar do gráfico; com histórico, o gráfico', async () => {
  let t = montarSetor();
  t.S.abrir('setor:producao', ctxProducao(numeros()));
  let h = await t.corpo();
  assert.match(h, /Sem histórico ainda/); assert.doesNotMatch(h, /vs-grafico/);
  t = montarSetor();
  t.S.abrir('setor:producao', ctxProducao(numeros({ historico: { mediaNoPrazoPct: 90, medianaEntregues: 3, semanas: [{ inicio: '2026-11-02', previstas: 3, entregues: 3 }, { inicio: '2026-11-09', previstas: 4, entregues: 2 }] } })));
  h = await t.corpo();
  assert.match(h, /vs-grafico/); assert.match(h, /<b>90%<\/b>no prazo/);
});

test('Produção: nada pedindo ação vira uma frase, não uma lista vazia', async () => {
  const t = montarSetor();
  t.S.abrir('setor:producao', ctxProducao(numeros({ alertas: [] })));
  assert.match(await t.corpo(), /Nada pedindo ação na produção agora/);
});

test('Comercial sem número nenhum: Mensal/Anual sai do topo (só onde muda algo)', async () => {
  const t = montarSetor({ respostas: { 'aba=funil': { mes: {}, resumo: null }, 'aba=pacotes': { pacotes: [] }, 'area=carteira': {} } });
  t.S.abrir('setor:comercial', { nome: 'Comercial', subs: [{ id: 'pacotes', nome: 'Pacotes' }, { id: 'funil', nome: 'Funil' }], numeros: () => null });
  assert.match(t.el.innerHTML, /vs-periodo/, 'o topo nasce com o período');
  await t.corpo();
  assert.ok(t.removidos.includes('.vs-topo .vs-periodo'), 'e ele sai quando o servidor não trouxe números');
});

// ---------- Aprovação de conteúdo (vybe-conteudo-equilibrio.js) ----------
test('Equilíbrio: o que falta em poucas palavras para a linha do cliente', () => {
  const ctxE = vm.createContext({ window: {} });
  vm.runInContext(readFileSync('vybe-conteudo-equilibrio.js', 'utf8'), ctxE);
  const E = ctxE.window.VybeEquilibrio, curto = (c) => JSON.parse(JSON.stringify(E.resumoCurto(c)));
  const fechado = (c) => ({ sem: 0, ...c, total: (c.atracao || 0) + (c.educacao || 0) + (c.conversao || 0) + (c.sem || 0), falta: E.faltando(c) });
  assert.deepEqual(curto(fechado({ atracao: 1, educacao: 0, conversao: 0 })), { texto: 'só atração', tom: 'neutro' });
  assert.deepEqual(curto(fechado({ atracao: 4, educacao: 3, conversao: 3 })), { texto: 'equilibrado', tom: 'ok' });
  assert.deepEqual(curto(fechado({ atracao: 2, educacao: 0, conversao: 8 })), { texto: 'falta educação', tom: 'falta' });
  assert.deepEqual(curto(fechado({ atracao: 0, educacao: 0, conversao: 0, sem: 2 })), { texto: 'sem objetivo marcado', tom: 'neutro' });
  assert.deepEqual(curto(fechado({ atracao: 1, educacao: 1, conversao: 0 })), { texto: 'poucas peças ainda', tom: 'neutro' });
});

test('Conteúdo: a vista principal não tem mais o calendário de 30 caixas nem os cinco cartões', () => {
  const fonte = readFileSync('vybe-mundo-conteudo.js', 'utf8');
  const corpo = fonte.slice(fonte.indexOf('function corpoEquilibrio'), fonte.indexOf('function calendario'));
  assert.match(corpo, /resumoDoMes\(d\)/); assert.match(corpo, /legendaObjetivos\(\)/); assert.match(corpo, /E\.resumoCurto\(c\)/);
  assert.match(corpo, /aberto \? `<div class="vc-eq-detalhe">/, 'o calendário só abre no cliente clicado');
  assert.doesNotMatch(corpo, /vc-kpis/);
});

// ---------- Projetos pontuais (vybe-mundo-pessoas.js) ----------
class El {
  constructor(tag) { this.tagName = tag; this.innerHTML = ''; this.ouvintes = {}; this.isConnected = false; }
  append(el) { this.filho = el; el.isConnected = true; }
  setAttribute() {} addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); } remove() {}
  querySelector() { return null; } querySelectorAll() { return []; } contains() { return false; }
}
function montarPessoas({ gestao, projetos = [] }) {
  const corpo = new El('body');
  const ctx = {
    console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, URL, encodeURIComponent, vbEstadoHtml,
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelectorAll: () => [] },
    window: { addEventListener() {} },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, gestao, eu: { id: '2' }, provisionado: true, semana: '2026-11-09', pessoas: [], projetos, linha: { semanas: [], projetos } }) }),
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), ctx);
  return { P: ctx.window.VybePessoas, html: () => corpo.filho?.filho?.innerHTML || '' };
}

test('Projetos sem nenhum projeto: um vazio só, com "Novo projeto" para quem cria', async () => {
  let t = montarPessoas({ gestao: true });
  await t.P.abrir('projetos');
  let h = t.html();
  assert.match(h, /Nenhum projeto pontual/); assert.match(h, /data-vp-abrir-form="projeto"[^>]*>Novo projeto/);
  assert.doesNotMatch(h, /Gantt de projetos pontuais|Linha do tempo da semana|vp-nums|vp-dia-vazio/, 'sem os zeros, o Gantt vazio e as sete caixas');
  t = montarPessoas({ gestao: false });
  await t.P.abrir('projetos');
  h = t.html();
  assert.match(h, /Nenhum projeto pontual/); assert.doesNotMatch(h, /Novo projeto/); assert.match(h, /Quem cuida da gestão cria os projetos/);
});

test('Projetos com projeto: a tela de hoje continua (números, Gantt e semana)', async () => {
  const t = montarPessoas({ gestao: true, projetos: [{ id: '1', nome: 'Site', tipo: 'site', status: 'andamento', etapas: [] }] });
  await t.P.abrir('projetos');
  const h = t.html();
  assert.match(h, /vp-nums/); assert.match(h, /Gantt de projetos pontuais/); assert.match(h, /Linha do tempo da semana/);
});
