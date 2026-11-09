// Tela do setor de Pessoas (vybe-mundo-pessoas.js). SAFE: vm com DOM de mentira e fetch dublê.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(tag) { this.tagName = tag; this.innerHTML = ''; this.ouvintes = {}; this.atributos = {}; this.isConnected = false; }
  append(el) { this.filho = el; el.isConnected = true; }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); }
  remove() { this.isConnected = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
}
const comum = (gestao) => ({ ok: true, gestao, eu: { id: '2', nome: 'Ana' }, provisionado: true });
const RESPOSTAS = {
  produtividade: (g) => ({ ...comum(g), mes: '2026-11', componentes: [{ id: 'prazo', nome: 'Entregas no prazo' }], fonte: { ajustes: 'Histórico' },
    detalhe: { id: '2', nome: 'Ana', score: 80, frases: ['2 de 3 entregas no prazo'], componentes: { prazo: .66 }, conquistas: [{ id: 'em_dia', titulo: 'Fila em dia', texto: '' }], posicao: g ? 1 : null },
    ...(g ? { ranking: [{ id: '2', nome: 'Ana', score: 80, posicao: 1, entregues: 3, meta: 10, cargoNome: 'Criação', conquistas: [] }], pesos: { prazo: 35 }, metas: { criacao: 40 }, cargos: { criacao: 'Criação' } } : {}) }),
  rh: (g) => ({ ...comum(g), rhPronto: true, migracaoRh: '2026-11-08-rh-pedidos-clima.sql',
    tipos: [{ id: 'ferias', nome: 'Férias ou folga', dias: 5, formulario: true }, { id: 'reembolso', nome: 'Reembolso', dias: 3, formulario: true }, { id: 'folha', nome: 'Pagamento ou folha', dias: 2, formulario: false }],
    status: { aberto: 'Aberto', resolvido: 'Resolvido', recusado: 'Recusado' },
    pedidos: [{ id: '1', pessoa_id: '2', pessoa_nome: 'Ana', titulo: 'Férias', tipo: 'ferias', status: 'aberto', prazo: '2026-11-12', sla: 'no_prazo', inicio: '2026-12-01', fim: '2026-12-10', idadeDias: 1 },
      { id: '2', pessoa_id: '2', pessoa_nome: 'Ana', titulo: 'Uber da captação', tipo: 'reembolso', status: 'aberto', prazo: '2026-11-03', sla: 'atrasado', atrasoUteis: 2, idadeDias: 6, data_desejada: '2026-11-04' },
      { id: '3', pessoa_id: '2', pessoa_nome: 'Ana', titulo: 'Declaração', tipo: 'folha', status: 'recusado', prazo: '2026-11-03', sla: 'encerrado', resposta: 'Já enviamos por e-mail.', respondido_dia: '2026-11-03', idadeDias: 8 }],
    indicadores: { abertos: 2, foraDoPrazo: 1, respondidos: 1, tempoMedioDias: 1.5, noPrazoPct: 100 },
    aniversarios: [{ nome: 'Ana', dia: '03-14' }], ferias: [], meuPerfil: {}, clima: { trimestre: '2026-T4', respondeu: false, dimensoes: [{ id: 'ambiente', nome: 'Ambiente' }], minimo: 3 },
    pesquisa: { atual: { id: '7', titulo: 'Clima de novembro', abre: '2026-11-08', fecha: '2026-11-15', situacao: 'aberta', respondeu: false },
      dimensoes: [{ id: 'lideranca', nome: 'Liderança' }, { id: 'carga', nome: 'Carga de trabalho' }], minimo: 3,
      ...(g ? { equipe: 6, historico: [{ id: '7', titulo: 'Clima de novembro', abre: '2026-11-08', fecha: '2026-11-15', situacao: 'aberta', resultado: { liberado: false, respostas: 2, minimo: 3 }, vs: { delta: null } },
        { id: '5', titulo: 'Clima de agosto', abre: '2026-08-01', fecha: '2026-08-08', situacao: 'encerrada', resultado: { liberado: true, respostas: 4, enps: 25, promotores: 2, detratores: 1, dimensoes: [{ id: 'carga', nome: 'Carga de trabalho', media: 3.5 }], comentarios: ['Bom time'] }, vs: { delta: null }, vsDimensoes: {} }] } : {}) },
    ...(g ? { pessoas: [{ id: '2', nome: 'Ana' }], perfis: [], visao: { atual: { headcount: 5, admissoes: 1, desligamentos: 0, tempoMedioMeses: 12.5 }, vs: { headcount: { delta: 1 }, admissoes: { delta: 1 }, desligamentos: { delta: 0 }, tempoMedioMeses: { delta: null } }, semEntrada: 2 },
      climaResultado: { trimestre: '2026-T4', liberado: false, respostas: 2, minimo: 3 } } : {}) }),
  projetos: (g) => ({ ...comum(g), semana: '2026-11-02', fim: '2026-11-08', capacidade: 12, pessoas: [{ id: '2', nome: 'Ana' }],
    carga: [{ id: '2', nome: 'Ana', pecas: 10, atrasadas: 2, etapas: 3, total: 15, pct: 125, nivel: 'sobrecarregada' }],
    projetos: [{ id: '1', nome: 'Site', tipo: 'site', status: 'andamento', etapas: [] }],
    linha: { semanas: [{ inicio: '2026-11-02', esq: 0 }], hoje: 50, projetos: [{ id: '1', nome: 'Site', tipo: 'site', status: 'andamento', pos: { esq: 0, larg: 100 }, etapas: [{ id: '9', nome: 'Wireframe', responsavel: '2', inicio: '2026-11-02', fim: '2026-11-04', pos: { esq: 0, larg: 40 }, atrasada: true }] }] } }),
  academy: (g) => ({ ...comum(g), trilhas: [{ id: '1', nome: 'Primeira semana na Vybe', minha: true, progresso: { pct: 50, concluidas: 1, total: 2 }, aulas: [{ id: '1', titulo: 'Boas-vindas', tipo: 'video', minutos: 10, link: 'https://x' }, { id: '2', titulo: 'Fluxo', tipo: 'doc', minutos: 5, link: '' }], atribuidas: [] }], feitas: ['1'], pessoas: [] }),
  recrutamento: (g) => ({ ...comum(g), etapas: ['Novos', 'Entrevista', 'Aprovado', 'Reprovado'], vagas: [{ id: '1', titulo: 'Designer', status: 'aberta' }],
    candidatos: [{ id: '1', vaga_id: '1', nome: 'Fulana', etapa: 'Entrevista', criado_em: '2026-11-01' }], indicadores: { abertas: 1, candidatos: 1, tempoMedio: { dias: 12 }, vs: { delta: -3 } } }),
  documentos: (g) => ({ ...comum(g), tipos: { contrato: 'Contrato' }, avisoDias: 30, avisos: 1, pessoas: [], documentos: [{ id: '1', pessoa_nome: 'Ana', tipo: 'contrato', titulo: 'Contrato PJ', renovacao: '2026-11-20', situacao: 'renovar' }] }),
};

function montar({ gestao = false } = {}) {
  const corpo = new El('body'), pedidos = [];
  const ctx = {
    console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, encodeURIComponent,
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelectorAll: () => [] },
    window: { addEventListener() {} },
    fetch: async (url, op = {}) => {
      const aba = new URL(url, 'http://x').searchParams.get('aba');
      pedidos.push({ url, metodo: op.method, corpo: op.body ? JSON.parse(op.body) : null });
      if (op.method === 'POST') return { ok: true, json: async () => ({ ok: true }) };
      if (!gestao && ['recrutamento', 'documentos'].includes(aba)) return { ok: false, status: 403, json: async () => ({ error: 'Só gestão.' }) };
      return { ok: true, json: async () => RESPOSTAS[aba](gestao) };
    },
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), ctx);
  const P = ctx.window.VybePessoas;
  return { P, pedidos, ctx, html: () => corpo.filho?.filho?.innerHTML || '' };
}

test('quem não é da gestão: só o próprio mês, sem ranking, sem pesos e sem abas de gestão', async () => {
  const t = montar();
  await t.P.abrir('produtividade');
  const h = t.html();
  assert.match(h, /Como foi o seu mês/); assert.match(h, /Fila em dia/);
  assert.doesNotMatch(h, /Ranking do mês|Pesos do score|data-vp-aba="recrutamento"|data-vp-aba="documentos"/);
  await t.P.abrir('recrutamento');
  assert.match(t.html(), /aria-selected="true" data-vp-aba="produtividade"/, 'aba da gestão cai em Produtividade');
  assert.ok(!t.pedidos.some((p) => p.url.includes('aba=recrutamento')), 'nem pede ao servidor');
});

test('gestão: ranking, pesos, metas e as abas de Recrutamento e Documentos', async () => {
  const t = montar({ gestao: true });
  await t.P.abrir('produtividade');
  assert.match(t.html(), /Ranking do mês/); assert.match(t.html(), /Pesos do score/);
  assert.match(t.html(), /Carga da semana/); assert.match(t.html(), /Sobrecarregada/, 'a carga da semana fica na Produtividade dos donos'); assert.match(t.html(), /data-vp-aba="documentos"/);
  await t.P.abrir('recrutamento');
  assert.match(t.html(), /Fulana/); assert.match(t.html(), /vs mês anterior/); assert.match(t.html(), /Mensal/);
  await t.P.abrir('documentos');
  assert.match(t.html(), /Renovar em breve/);
});

test('todas as abas desenham com dados e com o estado vazio', async () => {
  const t = montar({ gestao: true });
  for (const aba of ['rh', 'projetos', 'academy']) { await t.P.abrir(aba); assert.doesNotMatch(t.html(), /Carregando|Não deu para abrir/, aba); }
  await t.P.abrir('projetos');
  assert.match(t.html(), /vp-gantt-barra atrasada/);
  assert.doesNotMatch(t.html(), /Carga da semana/, 'a carga saiu de Projetos pontuais (auditoria 09/11)');
  await t.P.abrir('rh');
  assert.match(t.html(), /Headcount/); assert.match(t.html(), /Responder a pesquisa/); assert.match(t.html(), /O resultado aparece com 3/);
});

test('RH 08/11: fila com números clicáveis, fora do prazo em vermelho, resposta e histórico do clima', async () => {
  const g = montar({ gestao: true });
  await g.P.abrir('rh');
  let h = g.html();
  assert.match(h, /data-espiar="pessoas:abertos"/); assert.match(h, /data-espiar="pessoas:fora"/); assert.match(h, /data-espiar="pessoas:respondidos"/);
  assert.match(h, /vp-kpi espiavel u1/, 'fora do prazo pinta o número de vermelho');
  assert.match(h, /1,5 dias úteis/); assert.match(h, /100% respondidos no prazo/);
  assert.match(h, /vp-item u1/); assert.match(h, /Fora do prazo há 2 dias úteis/); assert.match(h, /aberto há 6 dias/); assert.match(h, /para 04\/11/);
  assert.match(h, /data-vp-form="responder"/); assert.match(h, /Prazos de resposta por tipo/);
  assert.match(h, /Clima de agosto/); assert.match(h, /Encerrar agora/); assert.match(h, /2 respostas de 6 pessoas/);
  assert.doesNotMatch(h, /name="folha"/, 'tipo antigo fora da tabela de prazos');
  // Mini painel: a lista por trás do número, e o clique filtra a lista.
  const prov = g.ctx.window.VybeEspiarProvedores.pessoas;
  const fora = prov('fora');
  assert.equal(fora.titulo, 'Fora do prazo'); assert.equal(fora.itens.length, 1); assert.equal(fora.itens[0].nome, 'Uber da captação'); assert.equal(fora.itens[0].cls, 'u1');
  assert.equal(prov('abertos').itens.length, 2); assert.equal(prov('respondidos').itens.length, 1);
  assert.equal(prov('clima').itens.length, 2); assert.equal(prov('nada'), null);
  fora.clicar(fora.itens[0]);
  h = g.html();
  assert.match(h, /Mostrando: <b>Fora do prazo<\/b> \(1\)/); assert.doesNotMatch(h, /<b>Férias<\/b>/);
  // Quem pediu: vê os próprios pedidos e a resposta, não vê a tabela de prazos nem resultado.
  const a = montar();
  await a.P.abrir('rh');
  h = a.html();
  assert.match(h, /Seus pedidos ao RH/); assert.match(h, /Resposta do RH:<\/b> Já enviamos por e-mail/); assert.match(h, /Cancelar pedido/);
  assert.doesNotMatch(h, /Prazos de resposta|data-vp-form="responder"|Clima de agosto|Encerrar agora/);
});

test('Nova solicitação ao RH: o atalho do Hoje abre o RH já no formulário', async () => {
  const t = montar();
  await t.P.novoPedido();
  const h = t.html();
  assert.match(h, /aria-selected="true" data-vp-aba="rh"/); assert.match(h, /data-vp-form="pedido"/); assert.match(h, /Nova solicitação ao RH/);
  assert.match(h, /Férias ou folga \(resposta em 5 dias úteis\)/); assert.match(h, /Reembolso/); assert.doesNotMatch(h, /<option value="folha"/, 'tipo antigo não abre');
  assert.match(h, /Primeiro dia/); assert.match(h, /Data desejada/);
});

test('carga() devolve a carga por pessoa da semana para o Comercial', async () => {
  const t = montar();
  const c = await t.P.carga();
  assert.equal(c.capacidade, 12); assert.equal(c.semana, '2026-11-02');
  assert.equal(c.pessoas[0].nivel, 'sobrecarregada'); assert.equal(c.pessoas[0].total, 15);
  assert.equal(t.P.aberto(), false, 'carga() não abre a janela');
});

test('Projetos: etapa que virou demanda mostra o status da esteira e o aviso de quantas foram (PR #542)', async () => {
  const original = RESPOSTAS.projetos;
  RESPOSTAS.projetos = (g) => { const r = original(g); r.linha.projetos[0].etapas[0] = { ...r.linha.projetos[0].etapas[0], demanda_id: '77', demanda_status: 'Em andamento' }; return r; };
  try {
    const t = montar({ gestao: true });
    t.ctx.statusCor = (d) => `<span class="pill">${d.status}</span>`;
    await t.P.abrir('projetos');
    assert.match(t.html(), /data-vp-demanda="77"/); assert.match(t.html(), /Em andamento/);
  } finally { RESPOSTAS.projetos = original; }
});
