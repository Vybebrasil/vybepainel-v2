// Padrão v2 nas telas de Pessoas (quadros DEPOIS de Pedidos e calendário, Recrutamento, Documentos e Academy).
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
const comum = (gestao) => ({ ok: true, gestao, eu: { id: '5', nome: 'Vini Prado' }, provisionado: true, hoje: HOJE });
const prog = (c, t) => ({ pct: Math.round(c / t * 100), concluidas: c, total: t });
const RESPOSTAS = {
  rh: (g) => ({ ...comum(g), rhPronto: true, tipos: [{ id: 'ferias', nome: 'Férias ou folga', dias: 5, formulario: true }, { id: 'outro', nome: 'Outro assunto', dias: 3, formulario: true }], status: { aberto: 'Aberto', resolvido: 'Resolvido' },
    pedidos: [{ id: '11', pessoa_id: '3', pessoa_nome: 'Bia Alves', titulo: 'Férias de 23 a 27', tipo: 'ferias', status: 'aberto', prazo: '2026-11-13', sla: 'no_prazo', inicio: '2026-11-23', fim: '2026-11-27', idadeDias: 3, descricao: 'Deixo as pautas fechadas.' },
      { id: '12', pessoa_id: '2', pessoa_nome: 'Reri Lima', titulo: 'Troca do monitor', tipo: 'outro', status: 'aberto', prazo: '2026-11-17', sla: 'no_prazo', idadeDias: 1 },
      { id: '9', pessoa_id: '5', pessoa_nome: 'Vini Prado', titulo: 'Declaração de vínculo', tipo: 'outro', status: 'resolvido', prazo: '2026-11-11', sla: 'encerrado', resposta: 'Pronta.', respondido_dia: '2026-11-11', idadeDias: 4 }].filter((p) => g || p.pessoa_id === '5'),
    indicadores: { abertos: g ? 2 : 0, foraDoPrazo: 0, respondidos: 10, tempoMedioDias: 2, noPrazoPct: 90 },
    aniversarios: [{ nome: 'Jady Rocha', dia: '11-14' }], ferias: [{ nome: 'Ewerton Dias', inicio: '2026-11-16', fim: '2026-11-20' }], meuPerfil: {},
    pesquisa: { atual: { id: '7', titulo: 'Clima', abre: '2026-11-09', fecha: '2026-11-13', situacao: 'aberta', respondeu: false }, dimensoes: [], minimo: 3,
      ...(g ? { equipe: 6, historico: [{ id: '7', titulo: 'Clima', abre: '2026-11-09', fecha: '2026-11-13', situacao: 'aberta', resultado: { liberado: true, respostas: 4, enps: 50, dimensoes: [] }, vs: { delta: null } }] } : {}) },
    ...(g ? { pessoas: [], perfis: [] } : {}) }),
  recrutamento: (g) => ({ ...comum(g), etapas: ['Triagem', 'Entrevista', 'Aprovado', 'Reprovado'],
    vagas: [{ id: '1', titulo: 'Designer', cargo: 'Criação', status: 'aberta', aberta_em: '2026-10-09' }, { id: '2', titulo: 'Redator', status: 'fechada', aberta_em: '2026-08-01', fechada_em: '2026-09-20' }],
    candidatos: [{ id: '1', vaga_id: '1', nome: 'Fulana Um', etapa: 'Entrevista', criado_em: '2026-11-04 10:00:00+00' }, { id: '2', vaga_id: '1', nome: 'Beltrano Dois', etapa: 'Triagem', criado_em: '2026-11-11 10:00:00+00' }],
    indicadores: { abertas: 1, candidatos: 2, tempoMedio: { dias: 23, contratacoes: 1 }, vs: { delta: -3 } } }),
  documentos: (g) => ({ ...comum(g), tipos: { contrato: 'Contrato', nda: 'Termo de confidencialidade' }, avisoDias: 30, avisos: 2, pessoas: [],
    documentos: [{ id: '1', pessoa_id: '2', pessoa_nome: 'Reri Lima', tipo: 'contrato', titulo: 'Contrato PJ', renovacao: '2026-11-08', situacao: 'vencido', link: 'https://x' },
      { id: '2', pessoa_id: '4', pessoa_nome: 'Jady Rocha', tipo: 'contrato', titulo: 'Contrato de estágio', renovacao: '2026-11-24', situacao: 'renovar' },
      { id: '3', pessoa_id: '1', pessoa_nome: 'Deivid Souza', tipo: 'nda', titulo: 'Termo', renovacao: null, situacao: 'sem_renovacao' }] }),
  academy: (g) => ({ ...comum(g), feitas: ['a1'], modelo: null, pessoas: [],
    trilhas: [{ id: '1', nome: 'Boas-vindas', descricao: '', minha: true, progresso: prog(1, 2), aulas: [{ id: 'a1', titulo: 'A Vybe', tipo: 'video', minutos: 5, link: 'https://x' }, { id: 'a2', titulo: 'Manual', tipo: 'doc', minutos: 10, link: 'https://y' }],
      ...(g ? { atribuidas: [{ pessoa_id: '4', nome: 'Jady Rocha', prazo: '2026-11-03', progresso: prog(1, 2) }, { pessoa_id: '1', nome: 'Deivid Souza', prazo: null, progresso: prog(2, 2) }] } : {}) }] }),
};
function montar({ gestao = true } = {}) {
  const corpo = new El('body'), pedidos = [];
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, encodeURIComponent,
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelectorAll: () => [] }, window: { addEventListener() {} },
    fetch: async (url, op = {}) => { const aba = new URL(url, 'http://x').searchParams.get('aba'); pedidos.push({ url, metodo: op.method, corpo: op.body ? JSON.parse(op.body) : null });
      return op.method === 'POST' ? { ok: true, json: async () => ({ ok: true }) } : { ok: true, json: async () => RESPOSTAS[aba](gestao) }; } };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), ctx);
  const raiz = () => corpo.filho;
  const clicar = (seletor, dataset = {}) => raiz().ouvintes.click[0]({ target: { closest: (s) => (s === seletor ? { dataset, getAttribute: () => null } : null) } });
  return { P: ctx.window.VybePessoas, pedidos, clicar, janela: () => raiz().filho, html: () => raiz()?.filho?.innerHTML || '' };
}
const ordem = (h, ...trechos) => { let i = -1; for (const t of trechos) { const j = h.indexOf(t, i + 1); assert.ok(j > i, `"${t}" na ordem do quadro`); i = j; } };

test('as quatro telas seguem a ordem do quadro: título, fala do VYBES, três números, filtro, Pede ação e lista', async () => {
  const t = montar();
  for (const [aba, pe] of [['academy', 'Quem monta as trilhas'], ['recrutamento', 'A vaga abre no lugar'], ['documentos', 'O colaborador abre no lugar']]) {
    await t.P.abrir(aba);
    const h = t.html();
    assert.equal(t.janela().className, 'vp-janela v2p-janela', aba);
    ordem(h, 'id="vp-titulo"', 'class="v2p-card v2p-fala"', 'class="v2p-tres"', 'class="v2p-barra-f"', 'data-v2p-busca', '<h3>Pede ação</h3>', 'data-v2p-lista', pe);
    assert.equal(h.split('class="v2p-card v2p-kpi').length - 1, 3, `${aba}: três números`);
    assert.equal(h.split('<button type="button" class="vp-acao"').length - 1, 1, `${aba}: uma ação principal`);
    assert.doesNotMatch(h, /vb-cabecalho-texto"><h2[^>]*>[^<]*<\/h2><p>|<h2[^>]*>[^<]*<\/h2><p>/, 'sem a frase embaixo do título');
  }
  assert.match(readFileSync('vybe-mundo-pessoas.js', 'utf8'), /const V2 = new Set\(\['produtividade', 'rh', 'projetos', 'recrutamento', 'documentos', 'academy'\]\);/, 'Projetos também no padrão v2 (quadro ProjetosDepois)');
});

test('Pedidos e calendário: baralho de decisão, calendário com pendente tracejado e o resto a um clique', async () => {
  const t = montar();
  await t.P.abrir('rh');
  let h = t.html();
  ordem(h, 'class="v2p-card v2p-fala"', 'class="v2p-tres"', '<h3>Pede ação</h3>', 'class="v2-baralho v2p-baralho"', 'data-v2p-decide', '<h3>Calendário do time</h3>', 'aria-label="O seu pedido"', 'Também no RH:');
  assert.match(h, /<b>2 pedidos esperam resposta<\/b> e o de Bia vence amanhã\. Ewerton sai de férias de 16\/11 a 20\/11\./);
  assert.match(h, /Respondidos no prazo<\/small><b><span class="v2-num"[^>]*>9 de 10</); assert.match(h, /4 de 6/); assert.match(h, /fecha amanhã · <button[^>]*data-form="pesquisa">responder</);
  assert.equal(h.split('class="v2-carta v2p-carta"').length - 1, 2); assert.match(h, /data-pos="0" data-carta="11"/); assert.match(h, /data-pos="1" data-carta="12"/);
  assert.match(h, /Responder até amanhã/); assert.match(h, /“Deixo as pautas fechadas\.”/);
  assert.match(h, /data-v2p-recusar="11">Recusar</); assert.match(h, /class="v2p-btn k v2-estado v2p-aprovar" data-v2p-decidir="11" data-feito="Aprovado">Aprovar</);
  assert.match(h, /1 de 2 · seta para os lados passa · <button[^>]*data-v2p-ver="lista">ver em lista</);
  assert.match(h, /class="v2p-pill mi pd" title="Bia Alves pediu férias ou folga e espera resposta">BI</, 'pedido de férias aberto entra tracejado');
  assert.match(h, /class="v2p-pill mi g" title="Ewerton Dias de férias ou folga">EW</); assert.match(h, /class="v2p-pill mi an"[^>]*>JA</);
  assert.match(h, /O seu pedido<\/b> · Declaração de vínculo, respondido em 11\/11/);
  // o segundo cartão não é férias: o botão vira Resolver
  t.clicar('[data-v2p-carta]', { v2pCarta: '1' });
  assert.match(t.html(), /data-v2p-decidir="12" data-feito="Resolvido">Resolver</); assert.match(t.html(), /2 de 2/);
  // recusar pede o motivo no lugar e usa o formulário de resposta de sempre
  t.clicar('[data-v2p-recusar]', { v2pRecusar: '12' });
  assert.match(t.html(), /<form data-vp-form="responder" data-id="12" class="v2p-recusa"><input name="resposta"[^>]*required/);
  // aprovar grava pelo caminho de sempre
  const b = { dataset: { v2pDecidir: '11', feito: 'Aprovado' }, textContent: 'Aprovar' };
  t.janela(); await t.P.abrir('rh');
  t.pedidos.length = 0;
  await new Promise((ok) => { globalThis.setTimeout(ok, 0); t.clicar('[data-v2p-decidir]', b.dataset); });
  assert.deepEqual(t.pedidos.find((p) => p.metodo === 'POST')?.corpo, { acao: 'pedido_status', id: '11', status: 'resolvido', resposta: '' });
});

test('Pedidos e calendário de quem pediu: sem botões de decisão, com o próprio pedido e Nova solicitação', async () => {
  const t = montar({ gestao: false });
  await t.P.abrir('rh');
  const h = t.html();
  assert.match(h, /<h3>Seus pedidos<\/h3>/); assert.match(h, /Nada seu esperando o RH/); assert.match(h, /Nenhum pedido por aqui/);
  assert.doesNotMatch(h, /data-v2p-decidir|data-v2p-recusar|Visão geral|Datas de RH|Prazos de resposta/);
  assert.match(h, /<span class="v2-num"[^>]*>Aberta</, 'quem não é da gestão não vê quantos responderam o clima');
});

test('Recrutamento: período no cabeçalho, quem espera retorno em Pede ação, funil e vaga que abre no lugar', async () => {
  const t = montar();
  await t.P.abrir('academy'); await t.P.abrir('recrutamento'); // a primeira resposta diz que é gestão
  let h = t.html();
  assert.match(h, /class="vp-topo-botoes"><button[^>]*>Nova vaga<\/button><div class="vp-periodo">/);
  assert.match(h, /<b>1 vaga aberta, 2 candidatos\.<\/b> 1 espera retorno há mais de 5 dias/);
  assert.match(h, /a mais antiga há 34 dias/); assert.match(h, /1 contratação no período · <span class="vp-vs bom">▼ 3 dias vs mês anterior/);
  assert.match(h, /aria-pressed="true" data-v2p-filtro="abertas">Abertas <b>1<\/b>/); assert.match(h, /data-v2p-filtro="pendente">Com retorno pendente <b>1<\/b>/); assert.match(h, /data-v2p-filtro="fechadas">Fechadas <b>1<\/b>/);
  assert.match(h, /class="v2p-pill r">8 dias<\/span><p><b>Fulana Um<\/b> · Designer<br><span class="v2p-sub">em Entrevista · no funil desde 04\/11/);
  assert.match(h, /<select data-vp-mover="1">/, 'o candidato muda de etapa na própria linha');
  assert.match(h, /<h3>Funil de novembro<\/h3><small>2 candidatos na vaga aberta/); assert.doesNotMatch(h, /<div class="v2p-fun"><span>Aprovado/, 'etapa sem candidato não aparece');
  assert.match(h, /class="v2-abre v2p-linha" data-linha="1" aria-expanded="false"/); assert.match(h, /Triagem 1<\/span><span class="v2p-pill a">Entrevista 1</);
  assert.match(h, /class="v2p-av at" data-vp-editar-candidato="1"/); assert.match(h, /data-vp-abrir-form="candidato" data-vaga="1">Novo candidato</); assert.match(h, /data-vp-editar-vaga="1">Editar vaga</);
  assert.match(h, /\+ 1 vaga fechada recolhida · <button[^>]*data-v2p-filtro="fechadas">mostrar</); assert.doesNotMatch(h, /Redator/);
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'fechadas' }); h = t.html();
  assert.match(h, /<h3>Vagas fechadas<\/h3>/); assert.match(h, /Redator/);
  t.clicar('[data-v2p-filtros]'); assert.match(t.html(), /class="vb-escolha|data-vp-vaga/, 'Filtros guarda a escolha de vaga');
});

test('Documentos: o vencido em destaque, Renovar abre o documento e quem está em dia fica recolhido', async () => {
  const t = montar();
  await t.P.abrir('academy'); await t.P.abrir('documentos');
  let h = t.html();
  assert.match(h, /<b>1 documento venceu e 1 vence em até 30 dias\.<\/b> O outro documento do time está em dia\./);
  assert.match(h, /class="v2p-card v2p-kpi atencao"><small>Vencem em 30 dias/); assert.match(h, /class="v2p-card v2p-kpi ruim"><small>Vencidos<\/small>/); assert.match(h, /há 4 dias/); assert.match(h, /o primeiro em 12 dias/);
  assert.match(h, /class="v2p-lin dest"><p><span class="v2p-pill r">Venceu há 4 dias<\/span><br><b>Contrato PJ<\/b>/);
  assert.match(h, /data-vp-editar-documento="1" data-foco="renovacao">Renovar</); assert.match(h, /Vence em 12 dias/);
  assert.match(h, /1 venceu em 08\/11/); assert.match(h, /1 vence em 24\/11/); assert.match(h, /Abrir<\/a>/); assert.match(h, /data-vp-editar-documento="2">Editar</);
  assert.match(h, /\+ 1 colaborador com tudo em dia recolhido · /); assert.doesNotMatch(h, /Deivid/);
  t.clicar('[data-v2p-mostrar]', { v2pMostrar: 'emDia' }); assert.match(t.html(), /Deivid/);
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'vencidos' }); h = t.html();
  assert.match(h, /Reri/); assert.doesNotMatch(h, /<b>Jady<\/b>/);
});

test('Academy: quem falta em Pede ação, a sua trilha com Continuar e a aula que marca no lugar', async () => {
  const t = montar();
  await t.P.abrir('academy');
  let h = t.html();
  assert.match(h, /<b>1 trilha no ar\.<\/b> 1 pessoa ainda não terminou a Boas-vindas\./);
  assert.match(h, /Terminaram a Boas-vindas<\/small><b><span class="v2-num"[^>]*>1 de 2</); assert.match(h, /1 vídeo e 1 documento/); assert.match(h, /falta 1 aula · /);
  assert.match(h, /Atrasada há 9 dias<\/span><p><b>Jady<\/b> · Boas-vindas/);
  assert.match(h, /<b>Documento 2 · Manual<\/b>/); assert.match(h, /class="v2p-btn s k" href="https:\/\/y"[^>]*>Continuar</);
  assert.match(h, /1 de 2 terminou/); assert.match(h, /class="v2p-cx ok" data-v2p-aula="a1" aria-pressed="true"/); assert.match(h, /data-vp-editar-trilha="1">Editar trilha</); assert.match(h, /Atribuir e acompanhar/);
  t.pedidos.length = 0;
  t.clicar('[data-v2p-aula]', { v2pAula: 'a2' }); await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(t.pedidos.find((p) => p.metodo === 'POST')?.corpo, { acao: 'aula_feita', aula_id: 'a2', feita: true });
  // quem não monta trilhas: o botão do alto vira "Pedir uma trilha" e abre a solicitação ao RH com o assunto
  const e = montar({ gestao: false });
  await e.P.abrir('academy');
  h = e.html();
  assert.match(h, /data-v2p-pedir-trilha>Pedir uma trilha</); assert.doesNotMatch(h, /Nova trilha|Editar trilha|Atribuir e acompanhar/); assert.match(h, /<small>Aulas feitas<\/small>/);
  e.clicar('[data-v2p-pedir-trilha]'); await new Promise((ok) => setTimeout(ok, 0));
  assert.match(e.html(), /data-vp-form="pedido"/); assert.match(e.html(), /value="Trilha na Academy: "/);
});

test('Produtividade: a fala do Alex, o mês no cabeçalho, O mês de cada um e o que é dos donos a um clique', async () => {
  const comps = [{ id: 'prazo', nome: 'Entregas no prazo' }, { id: 'volume', nome: 'Volume' }];
  const p = (id, nome, score, entregues, meta, cq = []) => ({ id, nome, score, entregues, meta, atrasadas: score < 70 ? 4 : 0, componentes: { prazo: score / 100, volume: .5 }, frases: ['frase do mês'], conquistas: cq.map((t2, i) => ({ id: 'c' + i, titulo: t2, texto: '' })) });
  const ranking = [p('4', 'Jady Rocha', 94, 16, 15, ['Sequência de 10 no prazo']), p('5', 'Vini Prado', 77, 9, 12), p('2', 'Reri Lima', 61, 6, 15)];
  RESPOSTAS.produtividade = (g) => ({ ...comum(g), mes: '2026-11', componentes: comps, detalhe: g ? ranking[1] : { ...ranking[1], posicao: null }, ...(g ? { ranking, pesos: { prazo: 60, volume: 40 }, metas: { criacao: 40 }, cargos: { criacao: 'Criação' } } : {}) });
  RESPOSTAS.projetos = (g) => ({ ...comum(g), semana: '2026-11-09', fim: '2026-11-15', capacidade: 12, carga: [] });
  const t = montar();
  await t.P.abrir('produtividade');
  let h = t.html();
  assert.equal(t.janela().className, 'vp-janela v2p-janela');
  ordem(h, 'id="vp-titulo"', 'class="v2p-card v2p-fala"', 'Alex · Análise e números', 'class="v2p-tres"', '<h3>Pede ação</h3>', '<h3>Conquistas do mês</h3>', '<h3>O mês de cada um</h3>', 'Nada para preencher', 'Também aqui, só para os donos:');
  assert.match(h, /<b>Jady lidera novembro com score 94<\/b> e 1 conquista\. <b>Reri<\/b> está com 61, 6 de 15 entregas: vale uma conversa\./);
  assert.match(h, /data-vp-ajuda aria-expanded="false">Como o score é feito</);
  assert.match(h, /Score médio do time<\/small><b><span class="v2-num">77</); assert.match(h, /Metas batidas<\/small><b><span class="v2-num"[^>]*>1 de 3</);
  assert.match(h, /class="v2p-pill a">6 de 15 entregas<\/span><p><b>Reri<\/b> · 4 peças abertas atrasadas/); assert.match(h, /data-v2p-abre="2" data-abrir="1">Ver o mês</);
  assert.match(h, /data-linha="4" aria-expanded="false"/); assert.match(h, /--v:61%;--c:#9A5B00/); assert.match(h, /<b class="v2p-sc">94<\/b>/);
  assert.doesNotMatch(h, /vp-anel|Ranking do mês/, 'sem o anel e sem a lista antiga');
  // quem não é dono: só o próprio mês, aberto, sem comparação
  const e = montar({ gestao: false });
  await e.P.abrir('produtividade');
  h = e.html();
  assert.match(h, /<h3>O seu mês<\/h3>/); assert.match(h, /O seu score de novembro é 77/); assert.match(h, /class="v2p-linha" aria-expanded="true"/);
  assert.doesNotMatch(h, /Jady|Reri|Pede ação|Também aqui|data-v2p-ver=/);
});

test('o CSS do grupo fica no fragmento, com as medidas do quadro e sem forçar regra antiga', () => {
  const css = readFileSync('padrao-v2/pessoas.css', 'utf8'), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(semComentario, /!important|html body\.mundo/);
  assert.ok(semComentario.split('}').every((r) => !r.trim() || /^\s*(@|#vv-pessoas|from|to|\d+%|0%)/.test(r.trim()) || /^\s*$/.test(r)), 'toda regra começa pelo id da janela');
  assert.match(css, /#vv-pessoas\.vp-janela\.v2p-janela\{border:0;border-radius:28px;background:#F9F8F5/);
  assert.match(css, /#vv-pessoas \.v2p-card\{[^}]*border:0;border-radius:20px;background:#FFFFFF/);
  assert.match(css, /#vv-pessoas \.v2p-btn\{[^}]*height:38px[^}]*border-radius:999px/); assert.match(css, /#vv-pessoas \.v2p-btn\.s\{height:30px/);
  assert.match(css, /#vv-pessoas \.v2p-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /\.vp-topo-botoes > \.vp-acao\{order:3;height:38px;[^}]*background:#C2490C/);
  assert.match(css, /#vv-pessoas \.v2p-baralho\{flex:none;width:380px;[^}]*height:300px\}/); assert.match(css, /#vv-pessoas \.v2p-grade-rh\{grid-template-columns:440px minmax\(0,1fr\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  const js = readFileSync('vybe-mundo-pessoas.js', 'utf8');
  assert.doesNotMatch(js, /class="v2p[^"]*"[^>]*>[^<]* — /, 'texto de interface sem travessão');
});
