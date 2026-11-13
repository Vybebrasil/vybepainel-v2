// Padrão v2 (12/11/2026): CRM e funil, Produtos e pacotes e Orçamentos são os quadros DEPOIS do moodboard aprovado,
// bloco por bloco: título com "Como funciona" e uma ação cheia, a fala do VYBES, três números, a faixa de etapas ou a
// barra de filtro, "Pede ação" ao lado da lista que abre no lugar, o vazio numa linha e a frase de rodapé. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import calc from '../shared/comercial-calculos.js';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const esperar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 2)); };
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dia = (n) => calc.somarDias(hoje, n);

function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, hidden: false, innerHTML: '', className: '', ouvintes: {}, scrollTop: 0, setAttribute() {},
    addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); }, querySelector: () => null, querySelectorAll: () => [], contains: () => false, append() {}, focus() {} };
}
function comercial(respostas, extra = {}) {
  const criados = [], pedidos = [];
  const doc = { body: elemento('body'), activeElement: null, createElement: (t) => { const e = elemento(t); criados.push(e); return e; }, getElementById: (id) => criados.find((e) => e.id === id) || null, addEventListener() {} };
  const ctx = vm.createContext({ document: doc, console, setTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Map, Set, encodeURIComponent, confirm: () => true,
    fetch: async (url, op = {}) => { pedidos.push({ url: String(url), corpo: op.body ? JSON.parse(op.body) : null }); const r = respostas(String(url), op); return { ok: true, status: 200, json: async () => r }; }, ...extra });
  ctx.window = ctx; ctx.addEventListener = () => {};
  vm.runInContext(ler('shared/comercial-calculos.js'), ctx);
  vm.runInContext(ler('vybe-mundo-comercial.js'), ctx);
  const janela = () => criados.find((e) => e.id === 'vv-comercial');
  const clicar = (dataset, mais = {}) => janela().ouvintes.click[0]({ target: { closest: () => ({ dataset, ...mais }) } });
  return { ctx, janela, clicar, pedidos };
}
const naOrdem = (html, partes) => { let p = -1; for (const parte of partes) { const i = html.indexOf(parte, p + 1); assert.ok(i > p, 'fora de ordem ou ausente: ' + parte); p = i; } };

const etapas = [['empresa', 'Empresa'], ['qualificacao', 'Qualificação'], ['abordagem_proposta', 'Abordagem proposta'], ['aprovada', 'Aprovada'], ['contato_feito', 'Contato feito'], ['reuniao', 'Reunião'],
  ['proposta_comercial', 'Proposta comercial'], ['follow_up', 'Follow-up'], ['ganho', 'Ganho'], ['perdido', 'Perdido']].map(([id, nome]) => ({ id, nome }));
const fases = calc.montarFases(etapas);
const pacotes = [
  { id: '1', nome: 'Social <b>Completo</b>', tipo: 'recorrente', preco: 3800, entregas: ['12 posts', '8 stories'], horas: 46, custo_hora: 45, carga: { criacao: 22 }, ativo: true },
  { id: '2', nome: 'Vídeo Institucional', tipo: 'avulso', preco: 2500, entregas: ['roteiro'], horas: 40, custo_hora: 58, carga: {}, ativo: true },
  { id: '3', nome: 'Identidade', tipo: 'avulso', preco: 1800, entregas: [], horas: 10, custo_hora: 40, carga: {}, ativo: true },
  { id: '4', nome: 'Site', tipo: 'avulso', preco: 4000, entregas: [], horas: 20, custo_hora: 40, carga: {}, ativo: true },
  { id: '5', nome: 'Tráfego', tipo: 'recorrente', preco: 0, entregas: [], horas: 0, custo_hora: 0, carga: {}, ativo: false },
].map((p) => calc.pacoteComMargem(p));
const op = (id, nome, etapa, valor_mensal, x = {}) => ({ id: String(id), nome, etapa, versao: '1', valor_mensal, valor_avulso: 0, pacote_id: null, proxima_acao: '', proxima_acao_data: null, responsavel_nome: 'Vinícius', criado_dia: dia(-20), ganho_dia: null, origem: null, ...x });
const ops = [op(1, 'Clínica <i>A</i>', 'empresa', 1200, { criado_dia: hoje, responsavel_nome: null }), op(2, 'Loja B', 'empresa', 900), op(3, 'Mercado C', 'qualificacao', 700),
  op(4, 'Restaurante D', 'contato_feito', 1500, { proxima_acao: 'Ligar', proxima_acao_data: dia(1) }),
  op(6, 'Academia E', 'proposta_comercial', 3200, { pacote_id: '1' }), op(7, 'Provedor F', 'proposta_comercial', 2400),
  op(10, 'Cliente G', 'ganho', 3800, { pacote_id: '1', ganho_dia: dia(-2) }), op(13, 'Pizzaria H', 'perdido', 1500, { etapa_antes_perda: 'proposta_comercial', motivo_perda: 'preco' })];
const propostas = [{ oportunidade_id: '6', dia: dia(-8) }, { oportunidade_id: '7', dia: dia(-2) }];
const pode = { ver_dinheiro: true, editar_comercial: true, editar_pacotes: true };
function funil() {
  const p = calc.periodo(hoje.slice(0, 7)), dados = { oportunidades: ops, propostas }, metas_por_mes = { [hoje.slice(0, 7)]: { mrr: 10000 } }, kpis = calc.kpisComerciais(dados, p), metas = calc.metasDoPeriodo(metas_por_mes, p);
  return { ok: true, pode, hoje, etapas, fases, motivos: calc.MOTIVOS_PERDA, oportunidades: ops, resumo: calc.resumoFunil(ops, fases), produtos: calc.produtoCampeao(ops, pacotes), pacotes: pacotes.filter((x) => x.ativo), valor_disponivel: true,
    mes: { periodo: p, hoje, kpis, propostas, metas, progresso: calc.progressoMetas(metas, kpis.atual), ranking: calc.rankingFechamentos(ops, p), series: calc.seriesMensais(dados, p.mes, 6), config_disponivel: true, formulario: {}, leads_formulario: [], valores: true, metas_por_mes } };
}
function orcamentos() {
  const o = (id, cliente_nome, status, validade, pacote = '1') => { const p = pacotes.find((x) => x.id === pacote), x = { id: String(id), cliente_nome, status, validade: dia(validade), desconto_percentual: 0, criado_em: new Date(Date.now() - 5 * 864e5).toISOString(),
    itens: [{ pacote_id: p.id, nome: p.nome, tipo: p.tipo, preco: p.preco, quantidade: 1 }] }; return { ...x, totais: calc.totalOrcamento(x) }; };
  return { ok: true, pode, hoje, pacotes: pacotes.filter((x) => x.ativo), oportunidades: [],
    orcamentos: [o(1, 'Academia E', 'enviado', 1), o(2, 'Provedor F', 'enviado', 20), o(3, 'Loja B', 'enviado', 30), o(4, 'Mercado C', 'enviado', 40), o(5, 'Cliente G', 'aceito', 5), o(6, 'Restaurante D', 'rascunho', 15), o(7, 'Pizzaria H', 'recusado', -9)] };
}
const respostas = (url) => (url.includes('aba=funil') ? funil() : url.includes('aba=pacotes') ? { ok: true, pode, hoje, pacotes, produtos: calc.produtoCampeao(ops, pacotes) } : url.includes('aba=orcamentos') ? orcamentos() : { ok: true });

test('CRM e funil: a ordem do quadro, a fala com as propostas paradas, três números e a faixa das etapas', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  let html = janela().innerHTML;
  assert.equal(janela().className, 'vc v2c');
  naOrdem(html, ['<div class="v2c-topo"><h2>CRM e funil</h2>', 'aria-label="Visão do funil"', '>Como funciona</button>', '<button type="button" class="v2c-btn p" data-vc="lead">Novo lead</button>',
    'class="v2c-card v2c-fala"', '<div class="v2c-tres">', '<div class="v2c-etapas"', '<div class="v2c-quadro"', 'class="v2c-sub v2c-pe"']);
  assert.equal((html.match(/class="v2c-btn p"/g) || []).length, 1, 'uma ação cheia por tela');
  assert.match(html, /<span class="v2c-quem">VYBES · Comercial<\/span><b>R\$ 9,9 mil por mês<\/b> em negociação\. <b>1 proposta<\/b> sem resposta há mais de 5 dias é a que mais pesa na meta\./);
  assert.match(html, /data-v2="paradas" data-id="6">Ver a proposta<\/button>/);
  naOrdem(html, ['<small>Em negociação</small>', 'por mês · 6 abertas', '<small>Meta de ', 'R$ 3,8 mil de 10 mil', 'class="v2-barra"', '<small>Taxa de ganho</small>', '50%', 'de 2 negócios encerrados']);
  // Faixa: uma etapa por fase; a vazia tracejada, a Proposta parada em destaque, Perdido com o motivo.
  assert.equal((html.match(/class="v2c-et[ "]/g) || []).length, fases.length);
  assert.match(html, /class="v2c-et z" data-v2="fase" data-id="apresentacao"[^>]*>\s*<b>Apresentação<\/b><span>0<\/span><small>vazia<\/small>/);
  assert.match(html, /class="v2c-et at" data-v2="fase" data-id="proposta"[^>]*>\s*<b>Proposta<\/b><span>2<\/span><em>R\$ 5,6 mil<\/em><small>1 sem resposta<\/small>/);
  assert.match(html, /data-id="perdido"[^>]*>\s*<b>Perdido<\/b><span>1<\/span><small>motivo: preço<\/small>/);
  // Colunas: só as fases abertas com oportunidade; duas por coluna e o resto em "mostrar".
  assert.equal((html.match(/<section class="v2c-colu"/g) || []).length, 3);
  assert.match(html, /<h3>Novo · 3<\/h3>[\s\S]*\+ 1 · <button type="button" class="v2c-link" data-v2="mostra" data-id="f:novo">mostrar<\/button>/);
  assert.ok(!html.includes('Mercado C') && !html.includes('Pizzaria H') && !html.includes('Cliente G'));
  assert.ok(html.includes('Clínica &lt;i&gt;A&lt;/i&gt;') && !html.includes('<i>A</i>'), 'nome escapado');
  assert.match(html, /<span>Academia E<\/span><span class="v2c-pill r">8 dias sem resposta<\/span>/);
  assert.match(html, /<span>Provedor F<\/span><span class="v2c-pill b">enviada há 2 dias<\/span>/);
  assert.match(html, /<span>Restaurante D<\/span><span class="v2c-pill a">ligar amanhã<\/span>/);
  assert.match(html, /<span class="v2c-pill n">chegou hoje<\/span>/);
  // O cartão abre no lugar com a data da proposta, o próximo passo e os botões.
  const cartao = html.slice(html.indexOf('data-v2-linha="op:6"'), html.indexOf('data-v2-linha="op:7"'));
  naOrdem(cartao, ['draggable="true" data-v2-arrasta="6"', 'data-v2="abre" data-id="op:6"', '<div class="v2-mais">', 'Proposta enviada em ', '<b>Próximo passo:</b>', 'data-v2="liguei" data-id="6"', '>Avançar etapa</button>', '>Perdido</button>']);
  // "Liguei" anota o contato no histórico do CRM (ação comentar, que já existia).
  clicar({ v2: 'liguei', id: '6' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'comentar')?.corpo, { acao: 'comentar', id: '6', observacao: 'Liguei para o contato.' });
  // Ganho e Perdido abrem a lista ao clicar; "Lista" troca a visão; o mês fica a um clique.
  clicar({ v2: 'fase', id: 'ganho' }); html = janela().innerHTML;
  assert.match(html, /<div class="v2c-quadro foco">[\s\S]*Cliente G/);
  clicar({ v2: 'visao', id: 'lista' }); html = janela().innerHTML;
  assert.match(html, /<h3>Abertas · 6<\/h3>/); assert.ok(html.indexOf('Academia E') < html.indexOf('Provedor F'), 'a mais parada primeiro');
  assert.ok(!html.includes('Corrida comercial'));
  clicar({ v2: 'mes' }); html = janela().innerHTML;
  assert.match(html, /<div class="v2c-resto">[\s\S]*Metas de [\s\S]*Corrida comercial/);
  assert.match(html, /data-vc="etapas">Configurar etapas<\/button>/);
});

test('funil vazio: as etapas em 0 e a linha tracejada com "Cadastrar o primeiro lead"', async () => {
  const { ctx, janela } = comercial(() => ({ ok: true, pode: { editar_comercial: true }, valor_disponivel: true }));
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  const html = janela().innerHTML;
  assert.equal((html.match(/class="v2c-et z[ "]/g) || []).length, calc.FASES.length);
  assert.doesNotMatch(html, /class="v2c-quadro/);
  assert.match(html, /<div class="v2c-vz"><p><b>Nenhuma oportunidade ainda\.<\/b> As 7 etapas ficam em 0\.<\/p><button type="button" class="v2c-btn s" data-vc="lead">Cadastrar o primeiro lead<\/button><\/div>/);
});

test('Produtos e pacotes: fala do campeão, três números, fichas, "Pede ação" e a linha que abre no lugar', async () => {
  const { ctx, janela, clicar } = comercial(respostas);
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Produtos e pacotes</h2>', '>Como funciona</button>', 'class="v2c-btn p" data-vc="pacote">Novo pacote</button>', 'class="v2c-card v2c-fala"', '<small>Produto campeão</small>', '<small>Ticket médio mensal</small>', '<small>Ticket médio avulso</small>',
    'class="v2c-busca" data-vc-busca="pacotes" placeholder="Buscar pacote"', 'aria-pressed="true">Ativos · 4</button>', '>Mensal · 1</button>', '>Avulso · 3</button>', '>Inativos · 1</button>', '>Filtros</button>',
    '<div class="v2c-grade pacotes">', '<h3>Pede ação</h3>', '<h3>Pacotes</h3><small>preço, custo do time e margem</small>', 'class="v2c-sub v2c-pe"']);
  assert.match(html, /O campeão é o <b>Social &lt;b&gt;Completo&lt;\/b&gt;<\/b>: 1 do 1 negócio ganho\./);
  assert.ok(!html.includes('<b>Completo</b>'), 'nome do pacote escapado');
  // Pede ação: sem preço e zona crítica, com o botão na linha.
  assert.match(html, /<span class="v2c-pill r">Zona crítica<\/span><p><b>Vídeo Institucional<\/b> · margem de 7,2%, abaixo de 20%<\/p><\/div><button type="button" class="v2c-btn s" data-vc="pacote" data-id="2">Rever o pacote<\/button>/);
  assert.match(html, /<span class="v2c-pill r">Sem preço<\/span>[\s\S]*data-vc="pacote" data-id="5">Definir preço<\/button>/);
  // A lista mostra três; o resto e os inativos ficam a um clique.
  assert.equal((html.match(/class="v2c-lin v2c-pk"/g) || []).length, 3);
  assert.match(html, /\+ 1 recolhido · <button type="button" class="v2c-link" data-v2="mostra" data-id="pacotes">mostrar<\/button> · 1 fora deste filtro, nas fichas/);
  const linha = html.slice(html.indexOf('data-v2-linha="pk:1"'), html.indexOf('data-v2-linha="pk:2"'));
  naOrdem(linha, ['data-v2="abre" data-id="pk:1"', 'Mensal · 46 h por mês · 1 ganho', 'R$ 3.800', 'por mês', 'class="v2-barra', 'custo R$ 2.070 · margem 46%', 'Entra: 12 posts, 8 stories', 'Carga: ', 'data-v2="usar" data-id="1">Usar em orçamento</button>', 'data-vc="pacote" data-id="1">Editar pacote</button>']);
  clicar({ v2: 'chip', id: 'inativos' }); html = janela().innerHTML;
  assert.match(html, /aria-pressed="true">Inativos · 1<\/button>/); assert.ok(html.includes('sem preço') && !html.includes('data-v2-linha="pk:1"'));
  // Quem não é dono não recebe custo: a lista perde a coluna da margem.
  const equipe = comercial((url) => (url.includes('aba=pacotes') ? { ok: true, pode: {}, hoje, pacotes: [{ id: '1', nome: 'Social', tipo: 'recorrente', preco: 2000, entregas: ['8 posts'], carga: {}, ativo: true }] } : { ok: true }));
  equipe.ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  const h = equipe.janela().innerHTML;
  assert.match(h, /class="v2c-lin v2c-pk sem-margem"/); assert.match(h, /<small>preço e entregas<\/small>/);
  assert.ok(!h.includes('custo R$') && !h.includes('Novo pacote') && !h.includes('Editar pacote'));
});

test('Orçamentos: fala, três números, fichas por situação, "Pede ação" e o orçamento que abre com os itens', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('orcamentos', { abas: ['orcamentos'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Orçamentos</h2>', '>Como funciona</button>', 'class="v2c-btn p" data-vc="orcamento">Novo orçamento</button>', 'class="v2c-card v2c-fala"', '<small>Em aberto</small>', '<small>Vencem em 7 dias</small>', '<small>Aprovados</small>',
    'placeholder="Buscar cliente ou pacote"', 'aria-pressed="true">Abertos · 4</button>', '>Rascunho · 1</button>', '>Aprovados · 1</button>', '>Recusados · 1</button>', '>Filtros</button>',
    '<div class="v2c-grade orcamentos">', '<h3>Pede ação</h3>', '<h3>Abertos · 4</h3><small>1 recusado, nas fichas</small>', 'class="v2c-sub v2c-pe"']);
  assert.match(html, /Há <b>R\$ 15,2 mil por mês<\/b> em 4 orçamentos abertos\. <b>1 vence esta semana<\/b> sem resposta\./);
  assert.match(html, /class="v2c-card v2c-kpi ruim"><small>Vencem em 7 dias<\/small>/);
  // Pede ação, na ordem: o que vence, o rascunho pronto para sair (o botão conta o estado).
  const pede = html.slice(html.indexOf('<h3>Pede ação</h3>'), html.indexOf('aria-label="Orçamentos"'));
  naOrdem(pede, ['<span class="v2c-pill r">Vence amanhã</span>', 'data-vc="imprimir" data-id="1">Ver a proposta</button>', '<span class="v2c-pill n">Rascunho</span>', 'class="v2c-btn s v2-estado" data-v2="orc-status" data-id="6" data-status="enviado" data-feito="Enviado">Marcar como enviado</button>']);
  assert.ok(!pede.includes('Registrar contrato'), 'sem a Carteira carregada, não promete o contrato');
  // A lista mostra três e abre no lugar com os itens, a proposta, duplicar e a troca de situação.
  assert.equal((html.match(/class="v2c-lin v2c-orc"/g) || []).length, 3);
  const linha = html.slice(html.indexOf('data-v2-linha="orc:1"'), html.indexOf('data-v2-linha="orc:2"'));
  naOrdem(linha, ['<b>R$ 3.800 por mês</b>', '<span class="v2c-pill r">vence amanhã</span>', 'Itens: 1× Social &lt;b&gt;Completo&lt;/b&gt;', 'Criado em ', 'class="v2c-btn s k" data-vc="imprimir" data-id="1">Ver a proposta</button>', 'data-v2="duplicar" data-id="1">Duplicar</button>',
    'data-status="aceito">Marcar aprovado</button>', 'data-status="recusado">Marcar recusado</button>']);
  clicar({ v2: 'orc-status', id: '1', status: 'aceito' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'orcamento_status')?.corpo, { acao: 'orcamento_status', id: '1', status: 'aceito' });
  // Duplicar abre a folha do orçamento novo com o cliente e os pacotes do original.
  clicar({ v2: 'duplicar', id: '1' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Novo orçamento"[\s\S]*name="cliente_nome" type="text" value="Academia E"[\s\S]*name="q_1" type="number" value="1"/);
  // A calculadora de ROI continua a um clique.
  clicar({ vc: 'fechar-folha' }); assert.ok(!janela().innerHTML.includes('vc-roi'));
  clicar({ v2: 'roi' }); assert.match(janela().innerHTML, /<div class="v2c-resto"><details class="vc-roi vc-roi-det" open>/);
});

test('"Usar em orçamento" leva o pacote para a folha do orçamento novo', async () => {
  const { ctx, janela, clicar } = comercial(respostas);
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  clicar({ v2: 'usar', id: '2' }); await esperar();
  assert.match(janela().innerHTML, /<h2>Orçamentos<\/h2>[\s\S]*aria-label="Novo orçamento"[\s\S]*name="q_2" type="number" value="1"/);
});

test('as outras abas da janela seguem como eram; o CSS do grupo não força regra antiga', async () => {
  const { ctx, janela } = comercial(() => ({ ok: true, pode }), { souDonoDaSessao: () => true });
  ctx.VybeComercial.abrir('caixa', { abas: ['caixa'] }); await esperar();
  assert.equal(janela().className, 'vc'); assert.match(janela().innerHTML, /<div class="vc-topo">/);
  const css = ler('padrao-v2/comercial.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const linha of css.split('\n')) if (/^\s*[#.:a-z]/.test(linha) && linha.includes('{') && !linha.trim().startsWith('@')) assert.match(linha, /^\s*#vv-comercial\.v2c[ {]|^\s*\d|^\s*(from|to)\b/, 'tudo pelo id da janela: ' + linha.slice(0, 60));
  // Medidas do quadro: cartão branco de raio 20 sem borda, pílula de 38 e de 30, ficha selecionada preta, ação #C2490C, número de 34.
  assert.match(css, /\.v2c-card\{[^}]*padding:18px;border-radius:20px;background:#FFFFFF;box-shadow:/);
  assert.match(css, /\.v2c-btn\{[^}]*height:38px;padding:0 16px;border:0;border-radius:999px/);
  assert.match(css, /\.v2c-btn\.s\{height:30px;padding:0 12px;font-size:12\.5px\}/);
  assert.match(css, /\.v2c-btn\.p\{background:#C2490C;color:#FFFFFF/);
  assert.match(css, /\.v2c-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF;box-shadow:none\}/);
  assert.match(css, /\.v2c-kpi > b\{[^}]*font:700 34px\/1\.05/);
  assert.match(css, /\.v2c-et\.z\{background:transparent;border-color:#D9D1C3;border-style:dashed;box-shadow:none\}/);
  assert.match(css, /\.v2c-et\.at\{background:#FFF1E6\}/);
  assert.match(css, /\.v2c-vz\{[^}]*border:1\.5px dashed #D9D1C3;border-radius:999px/);
  assert.match(css, /\.v2c-pk\{display:grid;grid-template-columns:minmax\(0,1fr\) 124px 190px/);
  assert.match(css, /\.v2c-fr\{display:grid;grid-template-columns:minmax\(0,1\.35fr\) minmax\(0,1\.1fr\) 96px 132px 156px/);
  assert.match(css, /\.v2c-pessoas\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);gap:14px/);
});

// ---------- Finanças por cliente, Fornecedores e Creators (quadros PorCliente, Fornecedores e Creators) ----------
const dono = { souDonoDaSessao: () => true };
const fornecedores = () => { const f = (id, nome, categoria, bv_percentual, contato, abertas = 0) => ({ id: String(id), nome, categoria, bv_percentual, contato, cidade: 'Irecê', uf: 'BA', telefone: '', observacoes: '', ativo: true, impressoes: { abertas, atrasadas: 0, entregues: 1 } });
  return { ok: true, pode, hoje, categorias: calc.CATEGORIAS_FORNECEDOR, fornecedores: [f(1, 'Gráfica <b>A</b>', 'grafica', 10, 'Marcos', 2), f(2, 'Gráfica B', 'grafica', 0, 'Sandra', 1), f(3, 'Estúdio A', 'audiovisual', 5, '')] }; };
const creators = () => { const c = (id, nome, cidade, contato, nicho = 'Moda') => ({ id: String(id), nome, arroba: 'c' + id, seguidores: 1000 * id, engajamento: 4, nicho, cidade, contato, observacoes: '' });
  const lista = [c(1, 'Ana', 'Irecê', 'WhatsApp'), c(2, 'Bia', 'Irecê', ''), c(3, 'Caio', 'Lapão', 'e-mail', 'Fitness'), c(4, 'Duda', 'Irecê', 'x'), c(5, 'Edu', 'Irecê', 'y')];
  return { ok: true, pode, hoje, creators: lista, opcoes: calc.opcoesCreators(lista) }; };
const financas = () => { const c = (id, cliente_nome, valor_mensal, pacote, status_pagamento = 'em_dia') => ({ cliente_id: String(id), cliente_nome, valor_mensal, pacote_id: pacote?.id || null, pacote_nome: pacote?.nome || null, status_pagamento, observacao: '', versao: '3', ...calc.financasCliente({ valor_mensal, pacote }) });
  const lista = [c(1, 'Antonov', 4000, pacotes[0], 'atrasado'), c(2, 'Hebravet', 2500, pacotes[1]), c(3, 'Dia Lab', 3000, pacotes[2]), c(4, 'Pet Feliz', 0, null)];
  return { ok: true, pode, hoje, fonte: 'Vybe OS', clientes: lista, zona_critica: 20, pacotes: [], status: calc.STATUS_PAGAMENTO,
    resumo: calc.resumoFinancas(lista.filter((x) => x.valor_mensal).map((x) => ({ ...x, pacote: pacotes.find((p) => p.id === x.pacote_id) }))) }; };
const respostas2 = (url) => (url.includes('aba=fornecedores') ? fornecedores() : url.includes('aba=creators') ? creators() : url.includes('aba=financas') ? financas() : { ok: true, pode });

test('Finanças por cliente: cabeçalho com Lançar, fala do Vorcaro, três números, fichas, Pede ação e a linha com Recebi', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('financas', { abas: ['financas'] }); await esperar();
  const html = janela().innerHTML;
  naOrdem(html, ['<p class="v2c-sub">Finanças › Por cliente</p><h2>Finanças por cliente</h2>', '<button type="button" class="v2c-btn p" data-v2="lancar">Lançar</button>', '<span class="v2c-quem">Vorcaro · Financeiro</span>', '>Ver a conta</button>',
    '<small>Contratado no mês</small>', '<small>Custo da carteira</small>', '<small>Margem</small>', 'placeholder="Buscar cliente"', 'aria-pressed="true">Todos · 4</button>', '>Em atraso · 1</button>', '>Margem baixa · 1</button>', '>Em dia · 2</button>',
    '>Colunas</button>', '>Filtros</button>', '<h3>Pede ação</h3>', 'Margem 7%', '>Rever contrato</button>', 'Como é calculado', '<h3>Clientes · 4</h3>', '<span>Cliente</span>', 'class="v2c-sub v2c-pe"']);
  assert.ok(!html.includes('Como funciona'), 'neste quadro a ajuda é "Ver a conta"');
  // Quem está em atraso vem primeiro, com "Recebi" na linha; a linha abre com contrato, custo e pagamento.
  const linha = html.slice(html.indexOf('data-v2-linha="fc:1"'), html.indexOf('data-v2-linha="fc:2"'));
  naOrdem(linha, ['data-v2="abre" data-id="fc:1"', 'R$ 4.000', 'class="v2-barra', '<span class="v2c-pill r">Em atraso</span>', 'class="v2c-btn s v2-estado" data-v2="recebi" data-id="1">Recebi</button>', '<b>Contrato</b>', '<b>Custo</b>', '<b>Pagamento</b>', 'data-vc="financas" data-id="1"']);
  assert.ok(html.indexOf('"fc:1"') < html.indexOf('"fc:2"') && html.indexOf('"fc:2"') < html.indexOf('"fc:3"'), 'atraso, depois margem baixa');
  assert.ok(!html.includes('<span class="v2c-num">Custo</span>'));
  clicar({ v2: 'colunas' }); assert.match(janela().innerHTML, /<span class="v2c-num">Custo<\/span>/);
  clicar({ v2: 'recebi', id: '1' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'financas_salvar')?.corpo, { acao: 'financas_salvar', cliente_id: '1', versao: '3', valor_mensal: 4000, pacote_id: '1', status_pagamento: 'em_dia', observacao: '' });
});

test('Fornecedores: fala do Nestor, três números e um cartão com Pede ação, a busca com as fichas e a lista', async () => {
  const { ctx, janela, clicar } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('fornecedores', { abas: ['fornecedores'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Fornecedores</h2>', '>Ajuda</button>', 'class="v2c-btn p" data-vc="fornecedor">Novo fornecedor</button>', '<span class="v2c-quem">Nestor · Compras, fornecedores e impressões</span>', '<b>3 fornecedores</b>, 2 em Gráfica. Faltam <b>1 BV e 1 contato</b>',
    '>Completar os 2</button>', '<small>Fornecedores</small>', '<small>Com BV combinado</small>', '2 de 3', 'falta Gráfica B', '<small>Impressões em andamento</small>', 'em 2 fornecedores',
    '<h3>Pede ação</h3><small>2 cadastros incompletos</small>', 'data-v2-linha="fo:2"', '<span class="v2c-pill a">Sem BV</span>', '>Registrar BV</button>', 'data-v2-campo="forn:bv:2"', 'data-feito="BV salvo">Salvar BV</button>',
    'data-v2-linha="fo:3"', '<span class="v2c-pill a">Sem contato</span>', '>Completar contato</button>', 'placeholder="Buscar fornecedor ou contato"', 'aria-pressed="true">Todos · 3</button>', '>Gráfica · 2</button>', '>Audiovisual · 1</button>', '>Filtros</button>',
    'data-v2-linha="fo:1"', '<span class="v2c-pill g">BV 10%</span>', '2 em andamento', '>Abrir</button>', 'data-vc="arquivar-forn" data-id="1"']);
  assert.ok(html.includes('Gráfica &lt;b&gt;A&lt;/b&gt;') && !html.includes('<b>A</b>'));
  clicar({ v2: 'chip', id: 'grafica' }); html = janela().innerHTML;
  assert.ok(!html.includes('<h3>Pede ação</h3>') && html.includes('"fo:1"') && html.includes('"fo:2"') && !html.includes('"fo:3"'), 'com ficha, a lista traz todos daquele tipo');
});

test('Creators: fala, três números, Pede ação sem contato, fichas por cidade e quatro cartões', async () => {
  const { ctx, janela, clicar } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('creators', { abas: ['creators'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Creators</h2>', '>Ajuda</button>', 'class="v2c-btn p" data-vc="creator">Novo creator</button>', '<span class="v2c-ag" aria-hidden="true">VY</span>', '<span class="v2c-quem">VYBES · Agência inteira</span><b>5 creators</b>, 4 de Irecê e 1 da região.',
    '<small>Creators</small>', '4 de Irecê · 1 da região', '<small>Sem contato</small>', '<h3>Pede ação</h3><small>1 cadastro incompleto</small>', '<span class="v2c-pill a">Sem contato</span>', '>Completar contato</button>', 'data-v2-campo="creator:contato:2"', '>Salvar contato</button>',
    'placeholder="Buscar nome ou @"', 'aria-pressed="true">Todos · 5</button>', '>Irecê · 4</button>', '>Região · 1</button>', '>Filtros</button>', '4 de 5 · ', 'mostrar o outro', '<div class="v2c-pessoas">']);
  assert.equal((html.match(/class="v2c-card v2c-pes v2-abre"/g) || []).length, 4);
  assert.doesNotMatch(html, /<select|Em campanha/, 'campanha não tem fonte de dado: não aparece');
  clicar({ v2: 'mostra', id: 'creators' }); assert.equal((janela().innerHTML.match(/class="v2c-card v2c-pes v2-abre"/g) || []).length, 5);
  clicar({ v2: 'chip', id: 'regiao' }); html = janela().innerHTML;
  assert.ok(html.includes('<b>Caio</b><small>') && !html.includes('<b>Ana</b><small>'));
});

test('telas do grupo de Finanças hospedadas na janela; faturamento chega como número', async () => {
  const visto = [];
  const { ctx, janela } = comercial((url) => (url.includes('aba=contas') ? { ok: true, pode, hoje, faturamento: 9600, contas: [] } : { ok: true, pode }), { ...dono,
    VybeFinancas: { estado: () => null, carregar: async () => {}, telas: { contas: (x) => { visto.push(x); return '<div class="fv2">tela de contas</div>'; } } } });
  ctx.VybeComercial.abrir('contas', { abas: ['contas'] }); await esperar();
  assert.match(janela().innerHTML, /<div class="vc-corpo"><div class="fv2">tela de contas<\/div>/);
  const ultimo = visto.at(-1);
  assert.equal(ultimo.d.faturamento, 9600, 'antes virava {} em completar()');
  assert.equal(typeof ultimo.repintar, 'function'); assert.equal(typeof ultimo.recarregar, 'function'); assert.ok('filtro' in ultimo && 'verFalta' in ultimo && 'admin' in ultimo);
  assert.match(ler('vybe-mundo-comercial.js'), /el\.classList\?\.toggle\?\.\('fv2-casa', telaFin\);/);
});
