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

test('as cinco telas no esqueleto do grupo E: vidro fumê, título no vidro, uma ação principal e a consulta', async () => {
  const t = montar();
  for (const aba of ['academy', 'produtividade', 'rh', 'recrutamento', 'documentos']) {
    await t.P.abrir(aba);
    const h = t.html();
    assert.equal(t.janela().className, 'vp-janela d3m-e-pes-janela', aba);
    ordem(h, 'class="d3m-e-topo"', 'id="vp-titulo"', 'class="d3m-e-sub"', 'class="vp-corpo d3m-e-corpo', 'class="d3m-e-main"', '<aside class="d3m-lado" aria-label="Consulta">');
    assert.ok(h.split('class="d3v-btn d3m-e-claro"').length - 1 <= 1, `${aba}: no máximo uma ação principal no topo`);
    assert.doesNotMatch(h, /v2p-fala|v2p-tres|d3-acao/, `${aba}: sem a fala laranja e os números de antes`);
  }
  assert.match(readFileSync('vybe-mundo-pessoas.js', 'utf8'), /const V2 = new Set\(\['produtividade', 'rh', 'projetos', 'recrutamento', 'documentos', 'academy'\]\);/, 'Projetos também no padrão v2 (quadro ProjetosDepois)');
});
test('Pedidos e calendário (prancha V2-M-RH-Pedidos): pedidos que se decidem na linha, calendário do mês e a consulta no vidro', async () => {
  const t = montar();
  await t.P.abrir('rh');
  let h = t.html();
  assert.equal(t.janela().className, 'vp-janela d3m-e-pes-janela');
  ordem(h, 'class="d3m-e-topo"', 'Pedidos e calendário', 'Recursos Humanos · 2 pedidos esperando resposta', 'data-vp-abrir-form="pedido"', 'Pedidos ao RH', 'data-v2p-filtro="abertos" aria-checked="true">Abertos', 'Calendário do time', '<aside class="d3m-lado"', 'O que dá para pedir', 'Clima', 'No calendário', 'Só da gestão');
  assert.match(h, /data-v2p-recusar="11">Recusar</); assert.match(h, /data-v2p-decidir="11" data-feito="Aprovado">Aprovar</); assert.match(h, /data-v2p-decidir="12" data-feito="Resolvido">Resolver</);
  assert.match(h, /“Deixo as pautas fechadas\.”/); assert.match(h, /class="d3m-e-pes-selo a">até amanhã</);
  assert.match(h, /class="d3m-e-pes-ev pend" title="Bia Alves pediu férias ou folga e espera resposta">Bia</, 'pedido de férias aberto entra tracejado');
  assert.match(h, /class="d3m-e-pes-ev ferias" title="Ewerton Dias de férias ou folga">Ewerton</); assert.match(h, /class="d3m-e-pes-ev aniv"[^>]*>Jady</);
  assert.match(h, /class="d3m-e-pes-fer"[^>]*>Consc\. Negra</, 'os feriados nacionais no calendário'); assert.match(h, /3 feriados em novembro/);
  assert.match(h, /data-vp-abrir-form="pedido" data-tipo="ferias"/, 'o que dá para pedir abre o formulário no tipo');
  // Respondidos: o histórico com o selo
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'respondidos' }); h = t.html();
  assert.match(h, /Declaração de vínculo/); assert.match(h, /class="d3m-e-pes-selo g">Respondido</);
  // recusar pede o motivo no lugar e usa o formulário de resposta de sempre
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'abertos' });
  t.clicar('[data-v2p-recusar]', { v2pRecusar: '12' });
  assert.match(t.html(), /<form data-vp-form="responder" data-id="12" class="d3m-e-pes-recusa"><input name="resposta"[^>]*required/);
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
  assert.match(h, /Seus pedidos ao RH/); assert.match(h, /nada esperando o RH/); assert.match(h, /Nenhum pedido por aqui/); assert.match(h, /Nova solicitação/);
  assert.doesNotMatch(h, /data-v2p-decidir|data-v2p-recusar|Visão geral|Datas de RH|Só da gestão/);
  assert.doesNotMatch(h, /responderam/, 'quem não é da gestão não vê quantos responderam o clima');
});

test('Recrutamento (prancha V2-M-RH-Recrutamento): três números, o funil do mês com a vaga que abre no lugar e quem espera retorno na consulta', async () => {
  const t = montar();
  await t.P.abrir('academy'); await t.P.abrir('recrutamento'); // a primeira resposta diz que é gestão
  let h = t.html();
  ordem(h, 'class="d3m-e-topo"', 'Recursos Humanos · só os donos e quem administra · 1 vaga aberta', 'data-vp-periodo="mensal"', 'data-v2p-busca', 'data-vp-abrir-form="vaga"', 'Vagas abertas', 'Candidatos', 'Tempo até contratar', 'Funil de novembro', '<aside class="d3m-lado"', 'Quem vê', 'Esperando retorno', 'Configurar as etapas');
  assert.match(h, /mais antiga · 34 dias/); assert.match(h, /1 contratação · ▼ 3 dias/);
  assert.match(h, /data-v2p-filtro="abertas" aria-checked="true">Abertas <span class="d3m-e-pes-n">1</); assert.match(h, /data-v2p-filtro="pendente" aria-checked="false">Retorno pendente <span class="d3m-e-pes-n">1</); assert.match(h, /data-v2p-filtro="fechadas" aria-checked="false">Fechadas <span class="d3m-e-pes-n">1</);
  assert.match(h, /data-vp-editar-candidato="1"><span><b>Fulana Um<\/b> · Designer · 8 dias/, 'quem espera retorno abre o candidato para mover de etapa');
  assert.match(h, /class="d3m-e-pes-fun" role="listitem"><small class="d3m-e-pes-lin-s">Triagem<\/small><b>1<\/b>/, 'o funil por etapa');
  assert.match(h, /class="v2-abre v2p-linha" data-linha="1" aria-expanded="false"/); assert.match(h, /class="d3m-e-pes-selo">Triagem 1<\/span><span class="d3m-e-pes-selo">Entrevista 1</);
  assert.match(h, /class="v2p-etp-nome at" data-vp-editar-candidato="1"[^>]*>Fulana Um</, 'cartão da etapa com o nome (quadro D3-Recrutamento)');
  assert.match(h, /data-vp-abrir-form="candidato" data-vaga="1">Novo candidato</); assert.match(h, /data-vp-editar-vaga="1">Editar vaga</);
  assert.doesNotMatch(h, /Redator/); assert.match(h, /data-vp-vaga-ir="1"/, 'com mais de uma vaga, escolher uma na consulta');
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'fechadas' }); h = t.html();
  assert.match(h, /data-v2p-filtro="fechadas" aria-checked="true"/); assert.match(h, /Redator/);
});

test('Documentos (prancha V2-M-RH-Documentos): três números, Por colaborador com a pessoa que abre e Renovar na consulta', async () => {
  const t = montar();
  await t.P.abrir('academy'); await t.P.abrir('documentos');
  let h = t.html();
  ordem(h, 'class="d3m-e-topo"', 'contratos e documentos do time · 1 vencido', 'data-v2p-busca', 'data-vp-abrir-form="documento"', 'Documentos do time', 'Vencem em 30 dias', 'Vencidos', 'Por colaborador', '<aside class="d3m-lado"', 'O aviso', 'Para renovar', 'Tipos', 'Abrir');
  assert.match(h, /o mais antigo há 4 dias/); assert.match(h, /1º em 12 dias/);
  assert.match(h, /data-vp-editar-documento="1" data-foco="renovacao"><span><b>Renovar<\/b> · Contrato PJ · Reri · venceu 08\/11/);
  assert.match(h, /class="d3m-e-pes-selo r">1 venceu em 08\/11</); assert.match(h, /class="d3m-e-pes-selo a">1 vence em 24\/11</); assert.match(h, /Abrir<\/a>/); assert.match(h, /data-vp-editar-documento="2">Editar</);
  assert.ok(h.indexOf('Reri Lima') < h.indexOf('Jady Rocha') && h.indexOf('Jady Rocha') < h.indexOf('Deivid Souza'), 'o vencido sobe para o topo da lista');
  assert.match(h, /data-v2p-tipo="contrato"/, 'os tipos viram filtro na consulta');
  t.clicar('[data-v2p-filtro]', { v2pFiltro: 'vencidos' }); h = t.html();
  assert.match(h, /Reri Lima/); assert.doesNotMatch(h, /Jady Rocha/);
});

test('Academy (prancha V2-M-Academy): três números, Trilhas no ar com a trilha que abre, quem falta e a busca na consulta', async () => {
  const t = montar();
  await t.P.abrir('academy');
  let h = t.html();
  ordem(h, 'class="d3m-e-h" id="vp-titulo" role="heading" aria-level="2">Academy', 'trilhas de treinamento da Vybe · 1 trilha no ar', 'data-vp-abrir-form="trilha"', 'Trilhas no ar', 'Aulas feitas', 'A sua trilha', '<aside class="d3m-lado"', 'Quem monta', 'Pede atenção', 'Buscar');
  assert.doesNotMatch(h, /class="d3m-e-troca" ontoggle/, 'a Academy não é do setor do RH: sem a seta de trocar de tela');
  assert.match(h, /1 vídeo · 1 doc/); assert.match(h, /Boas-vindas · falta 1 aula/); assert.match(h, /data-v2p-abre="1" data-abrir="1" title="Continuar a Boas-vindas"/);
  assert.match(h, /data-v2p-abre="1" data-abrir="1"><span><b>Jady<\/b> · Boas-vindas · atrasada há 9 dias/);
  assert.match(h, /1 de 2 terminou/); assert.match(h, /class="v2p-cx ok" data-v2p-aula="a1" aria-pressed="true"/); assert.match(h, /data-vp-editar-trilha="1">Editar trilha</); assert.match(h, /Atribuir e acompanhar/);
  assert.match(h, /data-v2p-busca placeholder="trilha, vídeo ou documento"/);
  t.pedidos.length = 0;
  t.clicar('[data-v2p-aula]', { v2pAula: 'a2' }); await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(t.pedidos.find((p) => p.metodo === 'POST')?.corpo, { acao: 'aula_feita', aula_id: 'a2', feita: true });
  // quem não monta trilhas: "Pedir uma trilha" na consulta abre a solicitação ao RH com o assunto
  const e = montar({ gestao: false });
  await e.P.abrir('academy');
  h = e.html();
  assert.match(h, /data-v2p-pedir-trilha><span><b>Pedir uma trilha/); assert.doesNotMatch(h, /Nova trilha|Editar trilha|Atribuir e acompanhar|Pede atenção/); assert.match(h, /Aulas feitas/);
  e.clicar('[data-v2p-pedir-trilha]'); await new Promise((ok) => setTimeout(ok, 0));
  assert.match(e.html(), /data-vp-form="pedido"/); assert.match(e.html(), /value="Trilha na Academy: "/);
});
test('Produtividade (prancha V2-M-RH-Produtividade): a folha do mês com o anel, O mês de cada um e o que é dos donos pela consulta', async () => {
  const comps = [{ id: 'prazo', nome: 'Entregas no prazo' }, { id: 'volume', nome: 'Volume' }];
  const p = (id, nome, score, entregues, meta, cq = []) => ({ id, nome, score, entregues, meta, atrasadas: score < 70 ? 4 : 0, componentes: { prazo: score / 100, volume: .5 }, frases: ['frase do mês'], conquistas: cq.map((t2, i) => ({ id: 'c' + i, titulo: t2, texto: '' })) });
  const ranking = [p('4', 'Jady Rocha', 94, 16, 15, ['Sequência de 10 no prazo']), p('5', 'Vini Prado', 77, 9, 12), p('2', 'Reri Lima', 61, 6, 15)];
  RESPOSTAS.produtividade = (g) => ({ ...comum(g), mes: '2026-11', componentes: comps, detalhe: g ? ranking[1] : { ...ranking[1], posicao: null }, ...(g ? { ranking, pesos: { prazo: 60, volume: 40 }, metas: { criacao: 40 }, cargos: { criacao: 'Criação' } } : {}) });
  RESPOSTAS.projetos = (g) => ({ ...comum(g), semana: '2026-11-09', fim: '2026-11-15', capacidade: 12, carga: [] });
  const t = montar();
  await t.P.abrir('produtividade');
  let h = t.html();
  assert.equal(t.janela().className, 'vp-janela d3m-e-pes-janela', 'a janela vira o vidro fumê do grupo E');
  ordem(h, 'class="d3m-e-topo"', 'id="vp-titulo"', 'Recursos Humanos · novembro de 2026 · score do time 77', 'O mês do time', 'class="d3m-e-pes-anel"', 'O mês de cada um', 'Conquistas do mês', '<aside class="d3m-lado"', 'Como o score é feito', 'Pede atenção', 'Do time', 'Da operação');
  assert.match(h, /data-vp-mes-ir="2026-10" aria-label="Mês anterior"/, 'o mês anda pelas mesmas setas de antes');
  assert.match(h, /Score 77 de 100/); assert.match(h, /<b>Entregas no prazo<\/b>[\s\S]*?<span>77%<\/span>/, 'o componente é a média do time');
  assert.match(h, /data-v2p-abre="2" data-abrir="1"><span><b>Reri<\/b> · score 61, 4 atrasadas/, 'quem pede atenção abre a linha no lugar');
  assert.match(h, /data-linha="4" aria-expanded="false"/); assert.match(h, /class="d3-barra v2p-barra-lin a"><i style="--v:61%">/); assert.match(h, /<b class="v2p-sc">94<\/b>/);
  assert.match(h, /data-v2p-ver="carga"/); assert.match(h, /data-v2p-ver="pesos"/); assert.match(h, /data-vp-ir="performance"/); assert.match(h, /data-v2p-busca/);
  assert.doesNotMatch(h, /v2p-fala|d3p-acao|v2p-tres|Também aqui/, 'sem a fala laranja e os três números de antes');
  t.P._teste.ver('pesos'); assert.match(t.html(), /data-vp-form="pesos"/); assert.match(t.html(), /data-v2p-ver="">Fechar/);
  // quem não é dono: só o próprio mês, o score por semana e as conquistas, sem comparação
  const e = montar({ gestao: false });
  await e.P.abrir('produtividade');
  h = e.html();
  ordem(h, 'O seu mês', 'Score 77 de 100', 'Score por semana', 'Conquistas do mês', 'Ranking da semana');
  assert.match(h, /o seu score é 77/); assert.match(h, /9 de 12 entregas/);
  assert.doesNotMatch(h, /Jady|Reri|Pede atenção|data-v2p-ver=|data-v2p-busca/);
});

test('o CSS do grupo fica no fragmento, com as medidas do quadro e sem forçar regra antiga', () => {
  const css = readFileSync('padrao-v2/pessoas.css', 'utf8'), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(semComentario, /!important|html body\.mundo/);
  assert.ok(semComentario.split('}').every((r) => !r.trim() || /^\s*(@|#vv-pessoas|from|to|\d+%|0%)/.test(r.trim()) || /^\s*$/.test(r)), 'toda regra começa pelo id da janela');
  assert.match(css, /#vv-pessoas\.vp-janela\.v2p-janela\{border:0;border-radius:var\(--d3-r-janela,28px\);background:var\(--d3-areia,#EAE6DE\)/);
  assert.match(css, /#vv-pessoas \.v2p-card\{[^}]*border:0;border-radius:20px;background:#FFFFFF/);
  assert.match(css, /#vv-pessoas \.v2p-btn\{[^}]*height:38px[^}]*border-radius:999px/); assert.match(css, /#vv-pessoas \.v2p-btn\.s\{height:30px/);
  assert.match(css, /#vv-pessoas \.v2p-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF/);
  assert.match(css, /\.vp-topo-botoes > \.vp-acao\{order:3;[^}]*background:var\(--d3-cartao,#FFFFFF\)/, 'Direção 3: a ação do topo é branca; o laranja cheio é só o bloco de ação');
  assert.match(css, /#vv-pessoas \.v2p-baralho\{flex:none;width:380px;[^}]*height:300px\}/); assert.match(css, /#vv-pessoas \.v2p-grade-rh\{grid-template-columns:440px minmax\(0,1fr\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  const js = readFileSync('vybe-mundo-pessoas.js', 'utf8');
  assert.doesNotMatch(js, /class="v2p[^"]*"[^>]*>[^<]* — /, 'texto de interface sem travessão');
});
