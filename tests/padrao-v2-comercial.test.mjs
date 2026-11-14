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

// Direção 3 (moodboard 3, 13/11/2026): CRM e funil, Produtos e pacotes e Orçamentos pelos quadros D3. A ordem é a do
// quadro: título com o mês, "Como funciona" e a ação em branco; o bloco de ação laranja; quatro números; as fichas; o
// quadro ou a tabela ao lado de "Pede ação". O que o quadro não mostra fica a um clique.
test('CRM e funil: bloco de ação com a proposta parada, quatro números, fichas das etapas e as colunas de todas as fases', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  let html = janela().innerHTML;
  assert.equal(janela().className, 'vc v2c d3c');
  naOrdem(html, ['<div class="v2c-topo d3c-topo"><h2>CRM e funil</h2><span class="d3c-sub">', 'aria-label="Visão do funil"', 'Como funciona</button>', 'class="v2c-btn d3c-novo" data-vc="lead">',
    '<section class="d3-acao"', '<div class="d3c-nums', '<div class="d3c-etapas"', '<div class="v2c-quadro d3c-quadro"', 'class="d3c-mais"']);
  assert.ok(!/class="v2c-btn p"/.test(html), 'o único laranja cheio é o bloco de ação');
  assert.match(html, /Academia E · proposta sem resposta há 8 dias\.<\/span><\/span><button type="button" class="d3-acao-btn" data-v2="paradas" data-id="6">Ver a proposta<\/button>/);
  naOrdem(html, ['>Em negociação</span>', 'abertas · R$ 9.900/mês', '>Meta do mês</span>', 'R$ 3,8 mil de 10 mil', 'class="d3-barra"', '>Taxa de ganho</span>', '50%', '>Paradas 5+ dias</span>', 'a mais antiga · 8 d']);
  // Fichas: Abertas e uma por fase, com a contagem em negrito; a vazia apagada.
  assert.match(html, /data-v2="fase" data-id="" aria-pressed="true">Abertas <b>6<\/b><\/button>/);
  assert.equal((html.match(/class="d3c-et[^"]*" data-v2="fase" data-id="[a-z_]+" data-v2-solta/g) || []).length, fases.length);
  assert.match(html, /class="d3c-et z" data-v2="fase" data-id="apresentacao"[^>]*><i style="--c:#579BFC"><\/i>Apresentação <b>0<\/b>/);
  // Colunas: todas as fases abertas, até três cartões; Ganho e Perdido no pé da última.
  assert.equal((html.match(/<section class="v2c-colu d3c-colu"/g) || []).length, 5);
  assert.match(html, /<b>Novo<\/b><span>3 · R\$ 2,8 mil<\/span>/);
  assert.match(html, /class="d3c-fim-b g" data-v2="fase" data-id="ganho"[^>]*><span>Ganho<\/span><span>1 · R\$ 3,8 mil<\/span>/);
  assert.match(html, /data-id="perdido"[^>]*><span>Perdido<\/span><span>1 · preço 1<\/span>/);
  assert.ok(html.includes('Clínica &lt;i&gt;A&lt;/i&gt;') && !html.includes('<i>A</i>'), 'nome escapado');
  assert.match(html, /<b>Academia E<\/b><span class="d3c-av" title="Vinícius">VI<\/span>/);
  assert.match(html, /<span class="v2c-pill a">parado 8 d<\/span>/);
  // O cartão abre no lugar com o próximo passo e os botões.
  const cartao = html.slice(html.indexOf('data-v2-linha="op:6"'), html.indexOf('data-v2-linha="op:7"'));
  naOrdem(cartao, ['draggable="true" data-v2-arrasta="6"', 'data-v2="abre" data-id="op:6"', '<div class="v2-mais">', 'Proposta enviada em ', '<b>Próximo passo:</b>', 'data-v2="liguei" data-id="6"', '>Avançar etapa</button>', '>Perdido</button>']);
  clicar({ v2: 'liguei', id: '6' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'comentar')?.corpo, { acao: 'comentar', id: '6', observacao: 'Liguei para o contato.' });
  clicar({ v2: 'fase', id: 'ganho' }); html = janela().innerHTML;
  assert.match(html, /<div class="v2c-quadro d3c-quadro foco">[\s\S]*Cliente G/);
  clicar({ v2: 'visao', id: 'lista' }); html = janela().innerHTML;
  assert.match(html, /<h3>Abertas<\/h3><small>6<\/small>/); assert.ok(html.indexOf('Academia E') < html.indexOf('Provedor F'), 'a mais parada primeiro');
  assert.ok(!html.includes('Corrida comercial'));
  clicar({ v2: 'mes' }); html = janela().innerHTML;
  assert.match(html, /<div class="v2c-resto">[\s\S]*Metas de [\s\S]*class="d3-graf"[\s\S]*Corrida comercial/);
  assert.ok(!html.includes('class="vc-g-barra"'), 'série de meses em linha, não em barra');
  assert.match(html, /data-vc="etapas">Configurar etapas<\/button>/);
});

test('funil vazio: as fichas em 0, o bloco de ação e a linha tracejada com "Cadastrar o primeiro lead"', async () => {
  const { ctx, janela } = comercial(() => ({ ok: true, pode: { editar_comercial: true }, valor_disponivel: true }));
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  const html = janela().innerHTML;
  assert.equal((html.match(/class="d3c-et(?: g)? z"/g) || []).length, calc.FASES.length);
  assert.doesNotMatch(html, /class="v2c-quadro/);
  assert.match(html, /Nenhuma oportunidade em negociação\.<\/span><\/span><button type="button" class="d3-acao-btn" data-vc="lead">Cadastrar lead<\/button>/);
  assert.match(html, /<div class="v2c-vz"><p><b>Nenhuma oportunidade ainda\.<\/b> As 7 etapas ficam em 0\.<\/p><button type="button" class="v2c-btn s" data-vc="lead">Cadastrar o primeiro lead<\/button><\/div>/);
});

test('Produtos e pacotes: bloco de ação do sem preço, quatro números, fichas, a tabela e "Pede ação"', async () => {
  const { ctx, janela, clicar } = comercial(respostas);
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Produtos e pacotes</h2>', 'Como funciona</button>', 'class="v2c-btn d3c-novo" data-vc="pacote">', '<section class="d3-acao"', '>Produto campeão</span>', '>Ticket mensal</span>', '>Ticket avulso</span>', '>Pacotes ativos</span>',
    'class="v2c-busca" data-vc-busca="pacotes" placeholder="Buscar pacote"', 'aria-pressed="true">Ativos <b>4</b></button>', '>Mensal <b>1</b></button>', '>Avulso <b>3</b></button>', '>Inativos <b>1</b></button>', '>Filtros</button>',
    '<div class="v2c-grade d3c-grade pacotes">', '<h3>Pacotes</h3>', '<span>Pacote</span><span>Tipo</span><span>Horas</span>', '<h3>Pede ação</h3>']);
  assert.match(html, /VYBES · Comercial<\/small><span class="d3c-frase">Tráfego está sem preço e fora dos orçamentos\.<\/span><\/span><button type="button" class="d3-acao-btn" data-vc="pacote" data-id="5">Definir preço<\/button>/);
  assert.ok(!html.includes('<b>Completo</b>'), 'nome do pacote escapado');
  assert.match(html, /<p><b>Vídeo Institucional<\/b> · margem 7,2%<\/p><span class="v2c-pill r">Zona crítica<\/span><\/div><button type="button" class="v2c-btn s" data-vc="pacote" data-id="2">Rever o pacote<\/button>/);
  // A tabela mostra até seis; o inativo fica nas fichas.
  assert.equal((html.match(/class="v2c-lin d3c-pk"/g) || []).length, 4);
  const linha = html.slice(html.indexOf('data-v2-linha="pk:1"'), html.indexOf('data-v2-linha="pk:2"'));
  naOrdem(linha, ['data-v2="abre" data-id="pk:1"', '<span>Mensal</span><span>46 h/mês</span>', 'R$ 3.800', 'class="d3-barra"', '46%', 'Entra: 12 posts, 8 stories', 'Carga: ', 'Custo R$ 2.070 · margem 46%', 'data-v2="usar" data-id="1">Usar em orçamento</button>', 'data-vc="pacote" data-id="1">Editar pacote</button>']);
  clicar({ v2: 'chip', id: 'inativos' }); html = janela().innerHTML;
  assert.match(html, /aria-pressed="true">Inativos <b>1<\/b><\/button>/); assert.ok(html.includes('sem preço') && !html.includes('data-v2-linha="pk:1"'));
  // Quem não é dono não recebe custo: a tabela perde a coluna da margem.
  const equipe = comercial((url) => (url.includes('aba=pacotes') ? { ok: true, pode: {}, hoje, pacotes: [{ id: '1', nome: 'Social', tipo: 'recorrente', preco: 2000, entregas: ['8 posts'], carga: {}, ativo: true }] } : { ok: true }));
  equipe.ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  const h = equipe.janela().innerHTML;
  assert.match(h, /class="v2c-lin d3c-pk sem-margem"/);
  assert.ok(!h.includes('Custo R$') && !h.includes('<span>Margem</span>') && !h.includes('Novo pacote') && !h.includes('Editar pacote'));
});

test('Orçamentos: bloco de ação do que vence, quatro números, fichas, a tabela e "Pede ação"', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('orcamentos', { abas: ['orcamentos'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Orçamentos</h2>', 'Como funciona</button>', 'class="v2c-btn d3c-novo" data-vc="orcamento">', '<section class="d3-acao"', '>Em aberto</span>', '>Vencem em 7 dias</span>', '>Aprovados</span>', '>Ticket médio</span>',
    'placeholder="Buscar cliente ou pacote"', 'aria-pressed="true">Abertos <b>4</b></button>', '>Rascunho <b>1</b></button>', '>Aprovados <b>1</b></button>', '>Recusados <b>1</b></button>', '>Filtros</button>',
    '<div class="v2c-grade d3c-grade orcamentos">', '<h3>Abertos</h3><small>4</small>', '<span>Cliente</span><span>Pacote</span>', '<h3>Pede ação</h3>']);
  assert.match(html, /Academia E vence amanhã, sem resposta há 5 dias\.<\/span><\/span><button type="button" class="d3-acao-btn" data-vc="imprimir" data-id="1">Ver a proposta<\/button>/);
  assert.match(html, /class="d3-num r[^"]*"><span class="d3-num-rot">Vencem em 7 dias<\/span>/);
  const pede = html.slice(html.indexOf('<h3>Pede ação</h3>'));
  naOrdem(pede, ['<span class="v2c-pill r">Vence amanhã</span>', 'data-vc="imprimir" data-id="1">Ver</button>', '<span class="v2c-pill n">Rascunho</span>', 'class="v2c-btn s k v2-estado" data-v2="orc-status" data-id="6" data-status="enviado" data-feito="Enviado">Enviar</button>']);
  assert.ok(!pede.includes('Registrar contrato'), 'sem a Carteira carregada, não promete o contrato');
  assert.equal((html.match(/class="v2c-lin d3c-orc"/g) || []).length, 4);
  const linha = html.slice(html.indexOf('data-v2-linha="orc:1"'), html.indexOf('data-v2-linha="orc:2"'));
  naOrdem(linha, ['<b class="d3c-orc-v">R$ 3.800', '<span class="v2c-pill r">vence amanhã</span>', 'Itens: 1× Social &lt;b&gt;Completo&lt;/b&gt;', 'Criado em ', 'class="v2c-btn s k" data-vc="imprimir" data-id="1">Ver a proposta</button>', 'data-v2="duplicar" data-id="1">Duplicar</button>',
    'data-status="aceito">Marcar aprovado</button>', 'data-status="recusado">Marcar recusado</button>']);
  clicar({ v2: 'orc-status', id: '1', status: 'aceito' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'orcamento_status')?.corpo, { acao: 'orcamento_status', id: '1', status: 'aceito' });
  clicar({ v2: 'duplicar', id: '1' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Novo orçamento"[\s\S]*name="cliente_nome" type="text" value="Academia E"[\s\S]*name="q_1" type="number" value="1"/);
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

// Direção 3 (quadro D3-PorCliente, só donos): selo no título, o bloco do Vorcaro, quatro números, fichas, Pede ação e a lista.
test('Finanças por cliente: selo só donos, Lançar em branco, bloco do Vorcaro, quatro números, fichas, Pede ação e a linha com Recebi', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('financas', { abas: ['financas'] }); await esperar();
  const html = janela().innerHTML;
  assert.equal(janela().className, 'vc v2c d3c');
  naOrdem(html, ['<h2>Finanças por cliente</h2><span class="d3-selo-donos">só donos</span>', 'class="v2c-btn d3c-novo" data-v2="lancar">', '<section class="d3-acao"', '<small class="d3c-quem">Vorcaro · Financeiro</small>', 'custa quase o que paga.', '>Rever contrato</button>',
    '>Contratado</span>', '>Em atraso</span>', '>Custo da carteira</span>', '>Margem</span>', 'placeholder="Buscar cliente"', 'aria-pressed="true">Todos <b>4</b></button>', '>Em atraso <b>1</b></button>', '>Margem baixa <b>1</b></button>', '>Em dia <b>2</b></button>',
    '>Colunas</button>', '>Filtros</button>', '<h3>Pede ação</h3>', 'Margem 7%', '>Rever contrato</button>', '<h3>Clientes</h3><small>4</small>', '<span>Cliente</span>', 'class="d3c-mais"', 'Como é calculado']);
  assert.ok(!/class="v2c-btn p"/.test(html), 'o único laranja cheio é o bloco de ação');
  assert.ok(!html.includes('Como funciona'), 'neste quadro a ajuda é "Como é calculado"');
  // Quem está em atraso vem primeiro, com "Recebi" na linha; a linha abre com contrato, custo e pagamento.
  const linha = html.slice(html.indexOf('data-v2-linha="fc:1"'), html.indexOf('data-v2-linha="fc:2"'));
  naOrdem(linha, ['data-v2="abre" data-id="fc:1"', 'R$ 4.000', 'class="v2-barra', '<span class="v2c-pill r">Em atraso</span>', 'class="v2c-btn s v2-estado" data-v2="recebi" data-id="1">Recebi</button>', '<b>Contrato</b>', '<b>Custo</b>', '<b>Pagamento</b>', 'data-vc="financas" data-id="1"']);
  assert.ok(html.indexOf('"fc:1"') < html.indexOf('"fc:2"') && html.indexOf('"fc:2"') < html.indexOf('"fc:3"'), 'atraso, depois margem baixa');
  assert.ok(!html.includes('<span class="v2c-num">Custo</span>'));
  clicar({ v2: 'colunas' }); assert.match(janela().innerHTML, /<span class="v2c-num">Custo<\/span>/);
  clicar({ v2: 'recebi', id: '1' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'financas_salvar')?.corpo, { acao: 'financas_salvar', cliente_id: '1', versao: '3', valor_mensal: 4000, pacote_id: '1', status_pagamento: 'em_dia', observacao: '' });
});

test('Fornecedores (Direção 3): bloco de ação do Nestor, quatro números, a busca com as fichas e a tabela com Pede ação e Completos', async () => {
  const { ctx, janela, clicar } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('fornecedores', { abas: ['fornecedores'] }); await esperar();
  assert.equal(janela().className, 'vc v2c d3c');
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Fornecedores</h2>', 'gráficas, estúdios e parceiros', '>Ajuda</button>', 'class="v2c-btn d3c-novo" data-vc="fornecedor">', '<small class="d3c-quem">Nestor · Compras</small><span class="d3c-frase">Faltam 1 BV e 1 contato para as Impressões.</span>',
    'data-v2="abre-um" data-id="fo:2">Completar os 2</button>', '<span class="d3-num-rot">Fornecedores</span>', '2 gráfica · 1 audiovisual', '<span class="d3-num-rot">Com BV</span><b class="d3-num-v">2 / 3</b>', 'falta Gráfica B',
    '<span class="d3-num-rot">Impressões andando</span>', 'em 2 gráficas', '<span class="d3-num-rot">Sem contato</span>', 'placeholder="Buscar fornecedor ou contato"', 'aria-pressed="true">Todos <b>3</b></button>', '>Gráfica <b>2</b></button>',
    'class="v2c-lin v2c-fr d3fo-cab"', '<div class="d3fo-sec a"><h3>Pede ação</h3><small>2 incompletos</small>', 'data-v2-linha="fo:2"', '<span class="v2c-pill a">Sem BV</span>', '>Registrar BV</button>', 'data-v2-campo="forn:bv:2"', 'data-feito="BV salvo">Salvar BV</button>',
    'data-v2-linha="fo:3"', '>Completar contato</button>', '<div class="d3fo-sec g"><h3>Completos</h3>', 'data-v2-linha="fo:1"', '<span class="v2c-pill g">BV 10%</span>', '>Abrir</button>', 'data-vc="arquivar-forn" data-id="1"']);
  assert.ok(html.includes('Gráfica &lt;b&gt;A&lt;/b&gt;') && !html.includes('<b>A</b>'));
  clicar({ v2: 'chip', id: 'grafica' }); html = janela().innerHTML;
  assert.ok(!html.includes('<h3>Pede ação</h3>') && html.includes('"fo:1"') && html.includes('"fo:2"') && !html.includes('"fo:3"'), 'com ficha, a lista traz todos daquele tipo');
});

test('Creators (Direção 3): bloco de ação, quatro números, Pede ação sem contato, fichas por cidade e quatro cartões', async () => {
  const { ctx, janela, clicar } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('creators', { abas: ['creators'] }); await esperar();
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Creators</h2>', 'Irecê e região', '>Ajuda</button>', 'class="v2c-btn d3c-novo" data-vc="creator">', '<small class="d3c-quem">VYBES · Agência</small><span class="d3c-frase">1 creator sem contato. Não dá para chamar.</span>',
    'data-v2="abre-um" data-id="cr:2">Completar o contato</button>', '<span class="d3-num-rot">Creators</span>', '4 Irecê · 1 região', '<span class="d3-num-rot">Seguidores somados</span>', '<span class="d3-num-rot">Nichos</span>',
    '<span class="d3-num-rot">Sem contato</span><b class="d3-num-v">1 / 5</b>', '<h3>Pede ação</h3><small>1 incompleto</small>', '<span class="v2c-pill a">Sem contato</span>', '>Completar contato</button>', 'data-v2-campo="creator:contato:2"', '>Salvar contato</button>',
    'placeholder="Buscar nome ou @"', 'aria-pressed="true">Todos <b>5</b></button>', '>Irecê <b>4</b></button>', '>Região <b>1</b></button>', '>Filtros</button>', '4 de 5 · ', 'mostrar o outro', '<div class="v2c-pessoas">']);
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
