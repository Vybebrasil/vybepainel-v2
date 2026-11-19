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

// Módulos V2 (prancha V2-M-Comercial, 16/11/2026): CRM e funil no esqueleto da prancha. A janela é vidro; o topo tem o
// título que abre as outras telas, a linha de apoio e as ferramentas; três números em folha; o quadro com todas as fases
// abertas; Ganho e Perdido no pé; e a coluna de consulta com o laranja, as conversas, por que se perde e o "Abrir".
test('CRM e funil: topo no vidro, três números, o quadro de todas as fases, Ganho e Perdido no pé e a coluna de consulta', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  let html = janela().innerHTML;
  assert.equal(janela().className, 'vc d3m-d-m');
  naOrdem(html, ['<div class="d3m-d-topo d3m-d-cm-topo">', '<details class="d3m-d-troca">', '<h2>Comercial</h2>', 'data-v2="ir" data-id="funil" aria-current="page">CRM e funil</button>', 'data-v2="ir" data-id="conversas">', 'data-v2="ir" data-id="pacotes">', 'data-v2="ir" data-id="orcamentos">', 'data-v2="ir" data-id="contratos">', 'data-v2="ir" data-id="churn">',
    '<span class="d3m-d-sub">CRM e funil · ', ' · 6 abertas · taxa de ganho de 50%</span>', 'aria-label="Visão do funil"', '<select class="d3m-d-sel" data-vc-filtro="dono"', '<option value="">Dono: todos</option>', 'data-v2="busca"', '<details class="d3m-d-mais">', 'data-v2="ajuda"', 'data-v2="mes"', 'data-vc="etapas">Configurar etapas</button>', 'data-vc="fechar">Fechar</button>', 'class="d3m-d-vbtn p" data-vc="lead">',
    '<div class="d3m-d-cm" data-tela="cm-funil">', '<div class="d3m-d-nums">', '<div class="d3m-d-cm-quadro"', '<div class="d3m-d-cm-fim">', '<aside class="d3m-lado d3m-d-cm-lado"', '<section class="d3m-laranja d3m-d-cm-pesa"', 'aria-label="Conversas"', 'aria-label="Por que se perde"', '<nav class="d3m-cons d3m-d-cm-abrir"']);
  assert.doesNotMatch(html, /v2c-topo|d3c-|class="d3-acao"/, 'nada do esqueleto anterior');
  // O laranja é a proposta mais parada, com o valor (quem vê é dono) e os dois botões.
  naOrdem(html, ['VYBES · proposta parada</span>', '<b class="d3m-lar-num">8 dias</b>', 'sem resposta de Academia E</span>', 'Proposta de R$ 3.200 por mês.', 'data-v2="ir" data-id="conversas">Retomar a conversa</button>', 'class="d3m-btn l s" data-v2="paradas" data-id="6">Ver a proposta</button>']);
  // Três números: em negociação, a meta do mês e as paradas (em vermelho, e o número abre a proposta).
  naOrdem(html, ['<span>Em negociação</span>', '>R$ 9,9 mil</b>', '6 oportunidades abertas, por mês', '<span>Meta de ', '>R$ 3,8 mil<small> / 10 mil</small></b>', '38% da meta, com 1 ganho', 'class="d3m-d-anel g"', 'data-v2="paradas" data-id="6" class="d3m-d-folha d3m-d-num">', '<span>Paradas há mais de 5 dias</span>', '<b class="d3m-d-num-v r">1</b>', 'a mais antiga há 8 dias']);
  // O quadro: todas as fases abertas, com a contagem e a soma por mês; o SDR e o lead novo no pé da coluna Novo.
  assert.equal((html.match(/<section class="d3m-d-cm-col"/g) || []).length, 5);
  assert.match(html, /<b title="Novo">Novo <span>3<\/span><\/b><span>R\$ 2,8 mil<\/span>/);
  assert.match(html, /<b title="Primeiro contato">1º contato <span>1<\/span><\/b>/);
  assert.match(html, /<span class="d3m-d-cm-sdr">SDR · nada para aprovar<\/span><button type="button" class="d3m-d-cm-aqui" data-vc="lead">/);
  assert.match(html, /data-v2="fase" data-id="ganho" data-v2-solta="ganho" aria-pressed="false"><i class="d3m-pt g"><\/i><span><b>Ganho<\/b> · 1 em [a-zç]+<\/span><b class="d3m-vn">R\$ 3,8 mil<\/b>/);
  assert.match(html, /data-v2="fase" data-id="perdido" aria-pressed="false"><i class="d3m-pt"><\/i><span><b>Perdido<\/b> · 1, por preço<\/span><b class="d3m-vn">R\$ 1,5 mil<\/b>/);
  assert.ok(html.includes('Clínica &lt;i&gt;A&lt;/i&gt;') && !html.includes('<i>A</i>'), 'nome escapado');
  // O cartão: empresa e valor; há quanto tempo (em vermelho quando parou) e quem cuida. Abre no lugar com os botões.
  const cartao = html.slice(html.indexOf('data-v2-linha="op:6"'), html.indexOf('data-v2-linha="op:7"'));
  naOrdem(cartao, ['draggable="true" data-v2-arrasta="6"', 'data-v2="abre" data-id="op:6"', '<b>Academia E</b><span>R$ 3.200 por mês</span>', '<span class="r">parada há 8 dias</span><i class="d3m-d-cm-av" title="Vinícius">VI</i>', '<div class="d3m-d-cm-mais">', 'Proposta enviada em ', '<b>Próximo passo:</b>', 'data-v2="liguei" data-id="6"', '>Avançar etapa</button>', '>Perdido</button>']);
  assert.match(html, /<span class="g">ligar amanhã<\/span>/);
  // Por que se perde: o motivo abre as perdidas dele; o "Abrir" leva às outras telas.
  assert.match(html, /<button type="button" data-v2="motivo" data-id="preco"[^>]*><span>Preço<\/span><span class="d3m-vbarra"><i style="--v:100%"><\/i><\/span><b>1<\/b><\/button>/);
  naOrdem(html.slice(html.indexOf('d3m-d-cm-abrir')), ['data-v2="ir" data-id="pacotes"><span><b>Produtos e pacotes</b> · 4 ativos</span>', 'data-id="orcamentos"><span><b>Orçamentos</b>', 'data-id="contratos"><span><b>Contratos</b>', 'data-id="churn"><span><b>Churn</b>']);
  clicar({ v2: 'liguei', id: '6' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'comentar')?.corpo, { acao: 'comentar', id: '6', observacao: 'Liguei para o contato.' });
  // Uma fase só, a lista e "Metas, corrida e formulário" abrem em folha, no lugar do quadro.
  clicar({ v2: 'fase', id: 'ganho' }); html = janela().innerHTML;
  assert.match(html, /<section class="d3m-d-folha d3m-d-cm-folha" aria-label="Ganho">[\s\S]*data-v2="fase" data-id="ganho">voltar ao quadro<\/button>[\s\S]*Cliente G/);
  assert.doesNotMatch(html, /class="d3m-d-cm-quadro"/);
  clicar({ v2: 'motivo', id: 'preco' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Perdido">[\s\S]*data-vc-motivo="preco" aria-pressed="true"[\s\S]*Pizzaria H/);
  clicar({ v2: 'visao', id: 'lista' }); html = janela().innerHTML;
  assert.match(html, /<h3>Abertas<\/h3><small>6 · da proposta mais parada para a mais nova<\/small>/); assert.ok(html.indexOf('Academia E</b> · ') < html.indexOf('Provedor F</b> · '), 'a mais parada primeiro');
  assert.ok(!html.includes('Corrida comercial'));
  clicar({ v2: 'mes' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Metas, corrida e formulário">[\s\S]*<div class="d3m-d-cm-resto">[\s\S]*Metas de [\s\S]*class="d3-graf"[\s\S]*Corrida comercial/);
  assert.ok(!html.includes('class="vc-g-barra"'), 'série de meses em linha, não em barra');
  // "Dono: todos" filtra pelo responsável da oportunidade ("-" = sem responsável); a busca, pelo nome da empresa.
  clicar({ v2: 'visao', id: 'quadro' });
  janela().ouvintes.change[0]({ target: { dataset: { vcFiltro: 'dono' }, value: '-' } }); html = janela().innerHTML;
  assert.ok(html.includes('data-v2-linha="op:1"') && !html.includes('data-v2-linha="op:6"'), 'só a oportunidade sem responsável');
  janela().ouvintes.change[0]({ target: { dataset: { vcFiltro: 'dono' }, value: '' } });
  clicar({ v2: 'busca' }); janela().ouvintes.input[0]({ target: { dataset: { vcBusca: 'funil' }, value: 'academ' } }); html = janela().innerHTML;
  assert.match(html, /class="d3m-d-cm-busca" data-vc-busca="funil"[^>]*value="academ"/);
  assert.ok(html.includes('data-v2-linha="op:6"') && !html.includes('data-v2-linha="op:7"'), 'só a empresa buscada');
});

test('funil para quem não é dono: nenhum valor em dinheiro na tela (o servidor tira e a tela não monta)', async () => {
  const semValor = () => { const f = funil(); return { ...f, pode: { ver_dinheiro: false, editar_comercial: true, editar_pacotes: false } }; };
  const { ctx, janela, clicar } = comercial((url) => (url.includes('aba=funil') ? semValor() : { ok: true }));
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  let html = janela().innerHTML;
  // Mesmo com os valores na resposta (não deveriam vir), a tela não monta dinheiro para quem não vê dinheiro.
  assert.doesNotMatch(html, /R\$/, 'nenhum valor no quadro');
  naOrdem(html, ['<span>Em negociação</span>', '<b class="d3m-d-num-v">6</b>', 'oportunidades abertas', 'sem resposta de Academia E</span>', 'Proposta enviada e sem retorno.']);
  assert.match(html, /<b>Academia E<\/b><span>Vinícius<\/span>/, 'no lugar do valor, quem cuida');
  assert.doesNotMatch(html, /data-vc="valor"|data-vc="etapas"|data-vc="metas"/);
  for (const passo of [{ v2: 'visao', id: 'lista' }, { v2: 'fase', id: 'ganho' }, { v2: 'fase', id: 'perdido' }]) { clicar(passo); html = janela().innerHTML; assert.doesNotMatch(html, /R\$/, 'nenhum valor em ' + passo.id); }
});

test('funil vazio: o mesmo esqueleto, com as colunas vazias e "Cadastrar o primeiro lead" no laranja', async () => {
  const { ctx, janela } = comercial(() => ({ ok: true, pode: { editar_comercial: true }, valor_disponivel: true }));
  ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  const html = janela().innerHTML;
  assert.equal((html.match(/<section class="d3m-d-cm-col"/g) || []).length, calc.FASES.length - 2, 'todas as fases abertas, vazias');
  assert.doesNotMatch(html, /class="d3m-d-cm-op"/);
  assert.match(html, /<span class="d3-acao-frase">Nenhuma oportunidade ainda<\/span>[\s\S]*class="d3m-btn l" data-vc="lead">Cadastrar o primeiro lead<\/button>/);
  naOrdem(html, ['<span>Em negociação</span>', '<b class="d3m-d-num-v">0</b>', '<b class="d3m-d-num-v">—</b>', 'sem meta ainda', 'nenhuma proposta parada', 'Nenhuma perda registrada.']);
  // Sem oportunidade aberta, o lead novo mora no laranja e no pé da coluna Novo; o topo não repete.
  assert.doesNotMatch(html, /class="d3m-d-vbtn p" data-vc="lead"/);
});

// Módulos V2 (prancha V2-M-Pacotes, 16/11/2026): os números em folha, a esteira numa folha só com o "De olho" no pé e a
// coluna de consulta com o laranja, o "Pede ação", a carga do time e o "Abrir".
test('Produtos e pacotes: topo no vidro, os números, a esteira em colunas com a linha que abre e a coluna de consulta', async () => {
  const { ctx, janela, clicar } = comercial(respostas);
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  let html = janela().innerHTML;
  assert.equal(janela().className, 'vc d3m-d-m');
  naOrdem(html, ['<div class="d3m-d-topo d3m-d-cm-topo">', '<h2>Produtos e pacotes</h2>', 'data-v2="ir" data-id="pacotes" aria-current="page">', '<span class="d3m-d-sub">a esteira de produtos da Vybe · 4 ativos · custo e margem de cada um</span>', 'data-v2="busca"', 'data-v2="ajuda"', 'data-v2="cap" aria-expanded="false">Capacidade por cargo</button>', 'data-vc="capacidade">Configurar a capacidade</button>', 'class="d3m-d-vbtn p" data-vc="pacote">',
    '<div class="d3m-d-cm" data-tela="cm-pacotes">', '<span>Produto campeão</span>', '<span>Ticket mensal</span>', '<span>Ticket avulso</span>', '<section class="d3m-d-folha d3m-d-cm-folha d3m-d-pk" aria-label="A esteira">', '<h3>A esteira <small>· 4 pacotes ativos</small></h3>',
    'aria-pressed="true">Ativos <b>4</b></button>', '>Mensal <b>1</b></button>', '>Avulso <b>3</b></button>', '>Rascunho <b>1</b></button>', '>Inativos <b>1</b></button>',
    '<span>Pacote</span><span>Tipo</span><span class="d3m-d-pk-p">Preço</span><span class="d3m-d-pk-c">Custo em horas</span><span>Margem</span><span class="d3m-d-pk-vd">Vendidos</span>', '<div class="d3m-d-pk-olho"><small>De olho</small>',
    '<aside class="d3m-lado d3m-d-cm-lado"', '<section class="d3m-laranja d3m-d-cm-pesa"', 'aria-label="Pede ação"', '<nav class="d3m-cons d3m-d-cm-abrir"']);
  assert.doesNotMatch(html, /v2c-topo|d3c-|class="d3-acao"/, 'nada do esqueleto anterior');
  // O rascunho (sem preço) aparece com os ativos e é o que o laranja pede primeiro.
  assert.match(html, /<b>Tráfego<\/b><\/span>\s*<span><i class="d3m-d-pk-tipo">rascunho<\/i><\/span><b class="d3m-d-pk-p r">sem preço<\/b>/);
  naOrdem(html, ['VYBES · pacote sem preço</span>', '<span class="d3-acao-frase">Tráfego está sem preço</span>', 'class="d3m-btn l" data-vc="pacote" data-id="5">Definir preço</button>']);
  assert.ok(!html.includes('<b>Completo</b>'), 'nome do pacote escapado');
  // Pede ação: o selo, a frase e o botão na linha.
  assert.match(html, /<small class="r">Zona crítica<\/small><em><b>Vídeo Institucional<\/b> · margem 7,2%<\/em><\/span><button type="button" class="v2c-btn s" data-vc="pacote" data-id="2">Rever o pacote<\/button>/);
  naOrdem(html.slice(html.indexOf('d3m-d-pk-olho')), ['<b>20%</b> é a margem mínima da casa', '<b class="a">1</b> abaixo dela', '<b class="r">1</b> sem preço']);
  // A esteira inteira (os quatro ativos e o rascunho), cada linha abrindo no lugar com o que entra, o custo e os botões.
  assert.equal((html.match(/<article class="d3m-d-pk-li/g) || []).length, 5);
  const linha = html.slice(html.indexOf('data-v2-linha="pk:1"'), html.indexOf('data-v2-linha="pk:2"'));
  naOrdem(linha, ['data-v2="abre" data-id="pk:1"', '<i class="d3m-d-pk-tipo">mensal</i>', '<b class="d3m-d-pk-p">R$ 3.800</b>', '<span class="d3m-d-pk-c">R$ 2.070</span>', 'class="d3m-d-pk-barra g"', '<b class="g">46%</b>', '<span class="d3m-d-pk-vd">', 'Entra: 12 posts, 8 stories', '46 h por mês · Carga: ', 'Custo R$ 2.070 · margem 46%', 'data-v2="usar" data-id="1">Usar em orçamento</button>', 'data-vc="pacote" data-id="1">Editar pacote</button>']);
  assert.match(html, /<b class="r">7%<\/b>/);
  clicar({ v2: 'chip', id: 'inativos' }); html = janela().innerHTML;
  assert.match(html, /aria-pressed="true">Inativos <b>1<\/b><\/button>/); assert.ok(html.includes('sem preço') && !html.includes('data-v2-linha="pk:1"'));
  // "Capacidade por cargo" abre em folha, no lugar da esteira.
  clicar({ v2: 'chip', id: 'ativos' }); clicar({ v2: 'cap' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Capacidade do time">[\s\S]*data-vc="capacidade">configurar<\/button>[\s\S]*data-v2="cap" aria-expanded="true">voltar à esteira<\/button>/);
  assert.doesNotMatch(html, /aria-label="A esteira"/);
  // Quem não é dono não recebe custo: a esteira não monta custo nem margem, e os tickets dão lugar aos pacotes ativos.
  const equipe = comercial((url) => (url.includes('aba=pacotes') ? { ok: true, pode: {}, hoje, pacotes: [{ id: '1', nome: 'Social', tipo: 'recorrente', preco: 2000, entregas: ['8 posts'], carga: {}, ativo: true }] } : { ok: true }));
  equipe.ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  const h = equipe.janela().innerHTML;
  assert.match(h, /class="d3m-d-pk-lin sem-margem" data-v2="abre"/);
  assert.match(h, /<span>Pacotes ativos<\/span>/);
  assert.ok(!h.includes('Custo') && !h.includes('<span>Margem</span>') && !/[^-]margem/.test(h) && !h.includes('Ticket') && !h.includes('Novo pacote') && !h.includes('Editar pacote'));
});

// Módulos V2 (prancha V2-M-Orcamentos, 16/11/2026): duas folhas lado a lado (a lista em três grupos e a proposta
// escolhida) e a coluna de consulta com o laranja do que vence, os números, o "Pede ação" e o "Abrir".
test('Orçamentos: topo no vidro, a lista em grupos, a proposta escolhida com as ações e a coluna de consulta', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas);
  ctx.VybeComercial.abrir('orcamentos', { abas: ['orcamentos'] }); await esperar();
  let html = janela().innerHTML;
  assert.equal(janela().className, 'vc d3m-d-m');
  naOrdem(html, ['<div class="d3m-d-topo d3m-d-cm-topo">', '<h2>Orçamentos</h2>', 'data-v2="ir" data-id="orcamentos" aria-current="page">', '<span class="d3m-d-sub">propostas a partir dos pacotes · 4 abertas · R$ 15,2 mil por mês em aberto</span>', 'data-v2="busca"', 'data-v2="ajuda"', 'data-v2="roi" aria-expanded="false">ROI na proposta</button>', 'class="d3m-d-vbtn p" data-vc="orcamento">',
    '<div class="d3m-d-cm" data-tela="cm-orcamentos">', '<section class="d3m-d-folha d3m-d-cm-folha d3m-d-or" aria-label="Orçamentos">', '<h3>7 orçamentos</h3>',
    'aria-pressed="true">Todos <b>7</b></button>', '>Abertos <b>4</b></button>', '>Aprovados <b>1</b></button>', '>Recusados <b>1</b></button>',
    '<div class="d3m-d-pk-olho"><small>De olho</small>', '<b>R$ 15,2 mil</b> em aberto</span>', 'data-v2="chip" data-id="vencendo" title="Vencem em 7 dias" aria-pressed="false"><b class="r">1</b> a vencer</button>', 'data-v2="chip" data-id="rascunho" title="Rascunho" aria-pressed="false"><b>1</b> rascunho</button>', '<section class="d3m-d-folha d3m-d-cm-folha d3m-d-or-prop" aria-label="Proposta para Academia E">',
    '<aside class="d3m-lado d3m-d-cm-lado"', '<section class="d3m-laranja d3m-d-cm-pesa"', '<div class="d3m-d-or-minis">', 'aria-label="Pede ação"', '<nav class="d3m-cons d3m-d-cm-abrir"']);
  assert.doesNotMatch(html, /v2c-topo|d3c-|class="d3-acao"/, 'nada do esqueleto anterior');
  // A lista: Agora (o que vence), Andando (enviados e rascunhos) e Fechados, com o nome do grupo uma vez só.
  assert.equal((html.match(/<button type="button" class="d3m-d-or-lin"/g) || []).length, 7);
  naOrdem(html, ['data-v2-linha="orc:1" aria-pressed="true"><span class="d3m-d-or-g r">Agora</span>', '<span class="d3m-d-or-g">Andando</span>', 'data-v2-linha="orc:6"', 'data-v2-linha="orc:5" aria-pressed="false"><span class="d3m-d-or-g">Fechados</span>', 'data-v2-linha="orc:7"']);
  const linha = html.slice(html.indexOf('data-v2-linha="orc:1"'), html.indexOf('data-v2-linha="orc:2"'));
  naOrdem(linha, ['Academia E', 'Social &lt;b&gt;Completo&lt;/b&gt;', '<b>R$ 3.800</b> por mês', '<i class="d3m-d-or-pt l"></i>Enviado <em class="r">vence amanhã</em>']);
  // O laranja é o que vence primeiro: abre a proposta na folha ao lado ou o documento.
  naOrdem(html, ['VYBES · proposta sem resposta</span>', '<b class="d3m-lar-num">5 dias</b>', 'sem resposta de Academia E</span>', 'A proposta vence amanhã. R$ 3.800 por mês.', 'class="d3m-btn l" data-v2="abre-um" data-id="orc:1">Ver a proposta</button>', 'class="d3m-btn l s" data-vc="imprimir" data-id="1">Abrir o documento</button>']);
  naOrdem(html.slice(html.indexOf('d3m-d-or-minis')), ['<b>4</b><small>abertos</small>', '<b>1 de 2</b><small>aprovado</small>', '<b>R$ 3,8 mil</b><small>ganho por mês</small>']);
  const pede = html.slice(html.indexOf('aria-label="Pede ação"'), html.indexOf('d3m-d-cm-abrir'));
  naOrdem(pede, ['<small class="r">Vence amanhã</small>', 'data-vc="imprimir" data-id="1">Ver</button>', '<small class="n">Rascunho</small>', 'class="v2c-btn s k v2-estado" data-v2="orc-status" data-id="6" data-status="enviado" data-feito="Enviado">Enviar</button>']);
  assert.ok(!pede.includes('Registrar contrato'), 'sem a Carteira carregada, não promete o contrato');
  // A proposta escolhida: os itens com o preço do dia, o total e as ações de sempre.
  const prop = html.slice(html.indexOf('d3m-d-or-prop'), html.indexOf('<aside'));
  naOrdem(prop, ['<h3>Proposta para Academia E</h3><small>enviado</small>', 'Criada em ', 'Vale até ', '<b>Social &lt;b&gt;Completo&lt;/b&gt;</b><small>1× · mensal</small></span><b>R$ 3.800</b>', '<div class="d3m-d-or-tot"><span>Por mês</span><b>R$ 3.800</b>',
    'class="d3m-d-or-bt k" data-vc="imprimir" data-id="1">Abrir como documento</button>', 'data-v2="duplicar" data-id="1">Duplicar</button>', 'data-status="aceito">Marcar aprovado</button>', 'data-status="recusado">Marcar recusado</button>']);
  // Outra linha escolhida troca a proposta ao lado.
  clicar({ v2: 'abre-um', id: 'orc:5' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Proposta para Cliente G">[\s\S]*<small>aprovado<\/small>/);
  clicar({ v2: 'chip', id: 'recusados' }); html = janela().innerHTML;
  assert.equal((html.match(/<button type="button" class="d3m-d-or-lin"/g) || []).length, 1); assert.match(html, /aria-label="Proposta para Pizzaria H"/);
  clicar({ v2: 'chip', id: 'todos' });
  clicar({ v2: 'orc-status', id: '1', status: 'aceito' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'orcamento_status')?.corpo, { acao: 'orcamento_status', id: '1', status: 'aceito' });
  clicar({ v2: 'duplicar', id: '1' }); html = janela().innerHTML;
  assert.match(html, /aria-label="Novo orçamento"[\s\S]*name="cliente_nome" type="text" value="Academia E"[\s\S]*name="q_1" type="number" value="1"/);
  clicar({ vc: 'fechar-folha' }); assert.ok(!janela().innerHTML.includes('vc-roi'));
  // "ROI na proposta" abre no lugar da proposta.
  clicar({ v2: 'roi' }); assert.match(janela().innerHTML, /aria-label="ROI na proposta">[\s\S]*<div class="d3m-d-cm-resto"><details class="vc-roi vc-roi-det" open>/);
});

test('Orçamentos vazio: o mesmo esqueleto, com a frase na lista e o primeiro orçamento no laranja', async () => {
  const { ctx, janela } = comercial((url) => (url.includes('aba=orcamentos') ? { ok: true, pode, hoje, pacotes: pacotes.filter((x) => x.ativo), orcamentos: [] } : { ok: true }));
  ctx.VybeComercial.abrir('orcamentos', { abas: ['orcamentos'] }); await esperar();
  const html = janela().innerHTML;
  naOrdem(html, ['<h3>0 orçamentos</h3>', 'Nenhum orçamento ainda. As propostas saem dos pacotes.', 'aria-label="Proposta"', '<span class="d3-acao-frase">Nenhum orçamento ainda</span>', 'class="d3m-btn l" data-vc="orcamento">Fazer o primeiro</button>']);
  assert.doesNotMatch(html, /class="d3m-d-or-lin"|ROI na proposta/);
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
  assert.match(css, /\.v2c-card\{[^}]*padding:18px;border-radius:20px;background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\));box-shadow:/);
  assert.match(css, /\.v2c-btn\{[^}]*height:38px;padding:0 16px;border:0;border-radius:999px/);
  assert.match(css, /\.v2c-btn\.s\{height:30px;padding:0 12px;font-size:var\(--d3-fs-texto\)\}/);
  assert.match(css, /\.v2c-btn\.p\{background:#C2490C;color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /\.v2c-chip\[aria-pressed="true"\]\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\));color:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\));box-shadow:none\}/);
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

// Padrão V2 (prancha V2-M-Financas-Por-Cliente, 16/11/2026): com o molde das telas de Finanças carregado, a mesma aba sai
// no esqueleto comum (topo no vidro, um cartão com os grupos Agora/Em dia/Falta, "De olho" e a coluna de Finanças).
test('Finanças por cliente no molde V2: topo com só donos e Lançar, laranja só com decisão, grupos, linha que abre, De olho e Recebi', async () => {
  const { ctx, janela, clicar, pedidos } = comercial(respostas2, dono);
  vm.runInContext(ler('vybe-mundo-financeiro.js'), ctx);
  ctx.VybeComercial.abrir('financas', { abas: ['financas'] }); await esperar();
  const html = janela().innerHTML;
  assert.equal(janela().className, 'vc', 'nem v2c nem d3c: a casa é a das telas de Finanças');
  naOrdem(html, ['class="fv2 fx d3f d3m-d-fx d3m-d-fm" data-tela="fx-financas"', '<h1>Finanças por cliente</h1>', 'só donos', 'contrato, pagamento e margem de cada conta', 'data-vc-periodo="mensal"', 'data-v2="lancar"',
    '4 clientes ativos', '3 com cobrança', 'data-v2="chip" data-id="todos" aria-pressed="true">Todos<span>4</span>', 'data-v2="chip" data-id="atraso"', '>Colunas</button>', '>Cliente<', '>Margem<',
    'data-v2-linha="fc:1"', '>Agora<', '>Em dia<', '>Falta<', 'data-vc="financas" data-id="4"', 'class="d3m-d-fm-olho"', 'De olho', 'cobrados por mês',
    'class="d3m-laranja d3m-d-fm-lar"', 'margem baixa', '>Rever contrato</button>', 'aria-current="page"><span><b>Por cliente</b>']);
  assert.equal((html.match(/class="d3m-laranja/g) || []).length, 1, 'um laranja só');
  const linha = html.slice(html.indexOf('data-v2-linha="fc:1"'), html.indexOf('data-v2-linha="fc:', html.indexOf('data-v2-linha="fc:1"') + 5));
  naOrdem(linha, ['data-v2="abre" data-id="fc:1"', 'R$ 4.000', 'em atraso', '<b>Contrato</b>', '<b>Custo</b>', '<b>Pagamento</b>', 'data-vc="financas" data-id="1"', 'data-v2="recebi" data-id="1">Recebi</button>']);
  assert.ok(!/style="--w:100px">Custo<\/span>/.test(html), 'sem a coluna de custo');
  clicar({ v2: 'colunas' }); assert.match(janela().innerHTML, /style="--w:100px">Custo<\/span>/);
  clicar({ v2: 'recebi', id: '1' }, { textContent: '' }); await esperar();
  assert.deepEqual(pedidos.find((p) => p.corpo?.acao === 'financas_salvar')?.corpo, { acao: 'financas_salvar', cliente_id: '1', versao: '3', valor_mensal: 4000, pacote_id: '1', status_pagamento: 'em_dia', observacao: '' });
});

test('Fornecedores (Direção 3): bloco de ação do Nestor, quatro números, a busca com as fichas e a tabela com Pede ação e Completos', async () => {
  const { ctx, janela, clicar } = comercial(respostas2, dono);
  ctx.VybeComercial.abrir('fornecedores', { abas: ['fornecedores'] }); await esperar();
  assert.equal(janela().className, 'vc v2c d3c');
  let html = janela().innerHTML;
  naOrdem(html, ['<h2>Fornecedores</h2>', 'gráficas, estúdios e parceiros', 'Como funciona</button>', 'class="v2c-btn d3c-novo" data-vc="fornecedor">', '<small class="d3c-quem">Nestor · Compras</small><span class="d3c-frase">Faltam 1 BV e 1 contato para as Impressões.</span>',
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
  naOrdem(html, ['<h2>Creators</h2>', 'Irecê e região', 'Como funciona</button>', 'class="v2c-btn d3c-novo" data-vc="creator">', '<small class="d3c-quem">VYBES · Agência</small><span class="d3c-frase">1 creator sem contato. Não dá para chamar.</span>',
    'data-v2="abre-um" data-id="cr:2">Completar o contato</button>', '<span class="d3-num-rot">Creators</span>', '4 Irecê · 1 região', '<span class="d3-num-rot">Seguidores somados</span>', '<span class="d3-num-rot">Em campanha</span>',
    '<span class="d3-num-rot">Sem contato</span><b class="d3-num-v">1 / 5</b>', '<h3>Pede ação</h3><small>1 incompleto</small>', '<span class="v2c-pill a">Sem contato</span>', '>Completar contato</button>', 'data-v2-campo="creator:contato:2"', '>Salvar contato</button>',
    'placeholder="Buscar nome ou @"', 'aria-pressed="true">Todos <b>5</b></button>', '>Irecê <b>4</b></button>', '>Região <b>1</b></button>', '<span class="d3c-dono d3cr-nicho">', 'data-vc-filtro="nicho"', '>Filtros</button>', '<div class="v2c-pessoas d3cr-grade">']);
  // Fiel ao quadro (14/11): cartões com seguidores à direita e nicho e cidade em pílulas; até oito, todos aparecem.
  assert.equal((html.match(/class="v2c-card d3cr-c v2-abre"/g) || []).length, 5);
  assert.match(html, /<b>Caio<\/b><small>@c3<\/small><\/span><b class="d3cr-seg">3 mil<\/b>/);
  assert.match(html, /<p class="d3cr-tags"><span>Fitness<\/span><span>Lapão<\/span><\/p>/);
  assert.doesNotMatch(html, /<select/);
  // Campanhas (14/11/2026): sem campanha registrada, o número diz "nenhuma campanha agora" e a ficha conta zero.
  assert.match(html, /<span class="d3-num-rot">Em campanha<\/span><b class="d3-num-v">0<\/b>[\s\S]*nenhuma campanha agora/); assert.match(html, />Em campanha <b>0<\/b><\/button>/);
  janela().ouvintes.change[0]({ target: { dataset: { vcFiltro: 'nicho' }, value: 'Fitness' } }); html = janela().innerHTML;
  assert.ok(html.includes('<b>Caio</b><small>') && !html.includes('<b>Ana</b><small>'), 'o nicho filtra');
  janela().ouvintes.change[0]({ target: { dataset: { vcFiltro: 'nicho' }, value: '' } });
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
  // Padrão V2 (16/11/2026): Finanças por cliente também mora na casa das telas de Finanças (o molde de vybe-mundo-financeiro.js).
  assert.match(ler('vybe-mundo-comercial.js'), /el\.classList\?\.toggle\?\.\('fv2-casa', telaFin \|\| fm\);/);
  assert.match(ler('vybe-mundo-comercial.js'), /const fm = st\.aba === 'financas' && Boolean\(window\.VybeFinanceiro\?\.molde\);/);
});
