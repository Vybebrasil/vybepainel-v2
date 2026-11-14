// Redesign, frente Negócio (10/11/2026; quadros 13, 18, 19, 20, 56, 58, 59 e 60): números numa linha (zero discreto),
// mês num seletor de período, aviso de ativação sem nome de arquivo para a equipe ("Ver o que falta" só para quem
// administra), esteira do onboarding desenhada, títulos com o nome do dock, ação principal uma vez e o WhatsApp da conta
// numa linha com "Conectar".
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const esperar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 2)); };
const safeText = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// As peças de verdade do Padrão Vybe (vybe-core.js): vbResumoHtml e vbMesHtml.
const core = ler('vybe-core.js');
const pecas = core.slice(core.indexOf('// itens: [{ valor, rotulo'), core.indexOf("// tipo: 'vazio' | 'erro' | 'carregando'"));

function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, hidden: false, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {}, classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    querySelector: () => null, querySelectorAll: () => [], contains: () => false, append() {}, focus() {}, remove() {} };
}
function contexto(respostas, extra = {}) {
  const criados = [];
  const doc = { body: elemento('body'), activeElement: null, createElement: (t) => { const e = elemento(t); criados.push(e); return e; },
    getElementById: (id) => criados.find((e) => e.id === id) || null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = vm.createContext({ document: doc, console, setTimeout, clearTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Map, Set, URL,
    encodeURIComponent, confirm: () => true, safeText, localStorage: { getItem: () => '1', setItem() {} },
    fetch: async (url, op = {}) => { const r = respostas(String(url), op); return { ok: r.status === 200, status: r.status, json: async () => r.corpo }; }, ...extra });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {};
  vm.runInContext(pecas, ctx);
  return { ctx, criados };
}

test('seletor de período: ‹ mês por extenso ›, não passa do mês atual; no anual anda de ano em ano', () => {
  const { ctx } = contexto(() => ({ status: 200, corpo: {} }));
  const html = ctx.vbMesHtml({ mes: '2026-11', max: '2026-11', attr: 'data-x' });
  assert.match(html, /<b aria-live="polite">novembro de 2026<\/b>/);
  assert.match(html, /data-x="2026-10" aria-label="Mês anterior"/);
  assert.match(html, /data-x="2026-12" aria-label="Próximo mês" title="Próximo mês" disabled/);
  assert.match(ctx.vbMesHtml({ mes: '2026-01', attr: 'data-x' }), /data-x="2025-12"/, 'virada de ano');
  const ano = ctx.vbMesHtml({ mes: '2026-11', max: '2026-11', attr: 'data-x', ano: true });
  assert.match(ano, />2026<\/b>/);
  assert.match(ano, /data-x="2025-11" aria-label="Ano anterior"/);
  assert.match(ano, /data-x="2027-11"[^>]*disabled/);
  assert.equal(ctx.vbMesHtml({ mes: '2026-1' }), '', 'mês inválido não desenha nada');
  const r = ctx.vbResumoHtml([{ valor: '0', rotulo: ' sem contrato', tom: 'zero', espiar: 'carteira:contratos:sem', dica: 'Explica <b>' }]);
  assert.match(r, /class="vb-resumo-item zero espiavel" data-espiar="carteira:contratos:sem" role="button" tabindex="0"/);
  assert.match(r, /data-dica="Explica &lt;b&gt;"/);
});

function carteira({ resposta, admin = false } = {}) {
  const c = contexto((url) => (url.includes('area=carteira') ? resposta : { status: 200, corpo: { ok: true } }), {
    CADASTRO_CLIENTES: [{ id: '1', nome: 'Antonov' }], souAdmin: () => admin, hojeDeVerdade: () => '2026-11-10' });
  vm.runInContext(ler('vybe-carteira-saude.js'), c.ctx);
  vm.runInContext(ler('vybe-mundo-carteira.js'), c.ctx);
  const janela = () => c.criados.find((e) => e.id === 'vv-carteira');
  const camada = () => c.criados.find((e) => e.className === 'vc-camada');
  const clicar = (dataset) => camada().ouvintes.click[0]({ target: { closest: () => ({ dataset, disabled: false }) } });
  // o clique só vale para botão dentro da janela
  return { ...c, janela, clicar: (d) => { janela().contains = () => true; clicar(d); } };
}
const semTabelas = { status: 200, corpo: { ok: true, clientes: [{ id: '1', nome: 'Antonov', ativo: true, entrada: '2025-03-01' }], contratos: { disponivel: false }, churn: { disponivel: false },
  onboarding: { disponivel: false }, etapas: [], etapas_padrao: [{ id: 'boas_vindas', nome: 'Boas-vindas', itens: [{ id: 'a', texto: 'Mensagem enviada' }] }, { id: 'kickoff', nome: 'Kickoff', itens: [] }], pode: {} } };

test('Contratos (quadro do padrão v2): título com as ações, fala do Vorcaro, três números, fichas; o período em Filtros', async () => {
  const { ctx, janela, clicar } = carteira({ resposta: semTabelas });
  await ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'], rotulo: 'Comercial' });
  await esperar();
  let html = janela().innerHTML;
  assert.match(html, /<div class="v2c" data-tela="contratos"><div class="v2c-topo"><h2 id="vc-titulo">Contratos<\/h2>/);
  assert.doesNotMatch(html, /class="vc-kicker"|class="vc-resumo"|class="vc-controles"/, 'sem o cabeçalho antigo nem a linha de números');
  assert.match(html, /data-vc-ajuda aria-expanded="false"[^>]*>Como funciona<\/button>[\s\S]*>Registrar contrato<\/button>/);
  assert.match(html, /Vorcaro · Financeiro e contratos/);
  // Direção 3 (13/11/2026): quatro números, o quarto é "Sem contrato".
  assert.match(html, /<span class="d3-num-rot">Em contratos<\/span>[\s\S]*<span class="d3-num-rot">Renovam em 30 dias<\/span>[\s\S]*<span class="d3-num-rot">Tempo de casa<\/span>[\s\S]*<span class="d3-num-rot">Sem contrato<\/span>/);
  assert.match(html, /data-vc-filtro-ct="sem">Sem contrato · 1<\/button>/);
  assert.match(html, /<p><b>Antonov<\/b><\/p><span class="v2c-pill r">Sem contrato<\/span>/);
  assert.doesNotMatch(html, /class="vb-mes"/, 'o mês saiu do alto');
  clicar({ vcFiltros: '' });
  assert.match(janela().innerHTML, /class="vb-mes"[\s\S]*novembro de 2026/);
  clicar({ vcMesIr: '2026-10' });
  assert.match(janela().innerHTML, /outubro de 2026/);
  // o rodapé de ativação: sem arquivo e, para quem não administra, sem "ver o que falta"
  assert.match(html, /<div class="v2k-vz" role="note"><p><b>Os contratos ainda não foram ligados\.<\/b>/);
  assert.doesNotMatch(html, /\.sql|Tentar de novo|ver o que falta/);
  // a conta do LTV mora em "Como funciona"
  assert.doesNotMatch(html, /LTV = meses desde o início/);
  clicar({ vcAjuda: '' });
  assert.match(janela().innerHTML, /LTV = meses desde o início do contrato/);
});

test('Ativação: quem administra vê "ver o que falta" no rodapé e, aberto, o nome da migração', async () => {
  const { ctx, janela, clicar } = carteira({ resposta: semTabelas, admin: true });
  await ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'] });
  await esperar();
  assert.match(janela().innerHTML, /<button type="button" class="v2c-btn" data-vc-falta aria-expanded="false">Para quem administra: ver o que falta<\/button>/);
  assert.doesNotMatch(janela().innerHTML, /2026-11-07-carteira\.sql/);
  clicar({ vcFalta: '' });
  assert.match(janela().innerHTML, /migração <code>2026-11-07-carteira\.sql<\/code>/);
});

test('Onboarding sem ativação (quadro do padrão v2): a tela do quadro vazia, e a esteira numerada em "Como funciona"', async () => {
  const a = carteira({ resposta: semTabelas });
  await a.ctx.VybeCarteira.abrir('onboarding', { abas: ['onboarding'], rotulo: 'Clientes' });
  await esperar();
  let html = a.janela().innerHTML;
  assert.match(html, /O onboarding ainda não foi ligado/);
  assert.match(html, /<h2>Pede ação<\/h2><\/div><div class="v2c-vazio"><p>Nenhum cliente em entrada\.<\/p>/);
  assert.doesNotMatch(html, /vc-esteira-previa|ver o que falta/, 'a esteira saiu do alto; quem não administra não vê o botão');
  a.clicar({ vcAjuda: '' });
  html = a.janela().innerHTML;
  assert.match(html, /<ol class="vc-esteira vc-esteira-previa"[^>]*><li title="Mensagem enviada"><i aria-hidden="true">1<\/i><span>Boas-vindas<\/span><small>1 item<\/small>/);
  assert.match(html, /<i aria-hidden="true">2<\/i><span>Kickoff<\/span><small>0 itens<\/small>/);
  assert.doesNotMatch(html, /Tentar de novo/);
  // Servidor sem a carteira (503 "aguardando"): não é erro, nem mostra o arquivo na tela.
  const b = carteira({ resposta: { status: 503, corpo: { error: 'Carteira aguardando ativação: falta aplicar a migração 2026-11-07-carteira.sql.', aguardando: true } } });
  await b.ctx.VybeCarteira.abrir('onboarding', { abas: ['onboarding'] });
  await esperar();
  html = b.janela().innerHTML;
  assert.doesNotMatch(html, /\.sql|Tentar de novo|role="alert"/);
  assert.match(html, /data-vc-etapa-onb="cadastro">Cadastro <b>0<\/b>/, 'sem etapas do servidor, as fichas mostram o caminho em três passos');
  b.clicar({ vcAjuda: '' });
  html = b.janela().innerHTML;
  assert.match(html, /<span>Cadastro<\/span>[\s\S]*<span>Questionário e kickoff<\/span>[\s\S]*<span>Checklist<\/span>/);
});

function comercial(respostas, extra = {}) {
  const c = contexto(respostas, extra);
  vm.runInContext(ler('shared/comercial-calculos.js'), c.ctx);
  vm.runInContext(ler('vybe-mundo-comercial.js'), c.ctx);
  const janela = () => c.criados.find((e) => e.id === 'vv-comercial');
  const clicar = (dataset) => janela().ouvintes.click[0]({ target: { closest: () => ({ dataset }) } });
  return { ...c, janela, clicar };
}
const topoDe = (html) => html.slice(0, html.indexOf('vc-abas'));

test('Funil: título "CRM e funil", números numa linha, sem arquivo de migração para a equipe; Novo lead no cabeçalho do dono', async () => {
  const resp = (url) => (url.includes('aba=funil') ? { status: 200, corpo: { ok: true, valor_disponivel: false } } : { status: 200, corpo: { ok: true } });
  const time = comercial(resp);
  time.ctx.VybeComercial.abrir('funil', { abas: ['funil'], rotulo: 'Comercial' }); await esperar();
  let html = time.janela().innerHTML;
  assert.match(topoDe(html), /<h2>CRM e funil<\/h2>/);
  assert.doesNotMatch(html, /class="vc-kpi/);
  assert.match(html, /<span class="d3-num-rot">Taxa de ganho<\/span>[\s\S]*nada encerrado/);
  assert.match(html, /O valor da negociação ainda não foi ligado/);
  assert.doesNotMatch(html, /\.sql|Ver o que falta|Novo lead/);
  const dono = comercial(resp, { souDonoDaSessao: () => true, souAdmin: () => true });
  dono.ctx.VybeComercial.abrir('funil', { abas: ['funil'] }); await esperar();
  html = dono.janela().innerHTML;
  assert.match(topoDe(html), /data-vc="lead">.*Novo lead/, 'sem resposta de permissão, o palpite de dono desenha o botão');
  assert.doesNotMatch(html, /2026-11-07-comercial\.sql/);
  dono.clicar({ vc: 'falta' });
  assert.match(dono.janela().innerHTML, /migração <code>2026-11-07-comercial\.sql<\/code>/);
  assert.match(ler('vybe-mundo-comercial.css'), /@media \(min-width:760px\)\{\s*#vv-comercial \.vc-funil\{grid-auto-flow:row;grid-template-columns:repeat\(auto-fill,minmax\(150px,1fr\)\);overflow-x:visible\}/, 'a coluna Perdido fica dentro da largura');
});

test('Pacotes: título do dock e vazio com o botão de começar (uma vez); com pacotes, "Novo pacote" no cabeçalho', async () => {
  let pacotes = [];
  const { ctx, janela } = comercial((url) => (url.includes('aba=pacotes') ? { status: 200, corpo: { ok: true, pode: { editar_pacotes: true }, pacotes } } : { status: 200, corpo: { ok: true } }));
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  let html = janela().innerHTML;
  assert.match(topoDe(html), /<h2>Produtos e pacotes<\/h2>/);
  assert.equal((html.match(/data-vc="pacote"/g) || []).length, 1);
  assert.match(html, /class="v2c-vz"[\s\S]*Cadastrar o primeiro pacote/);
  pacotes = [{ id: '1', nome: 'Social', tipo: 'recorrente', preco: 2000, ativo: true, entregas: [], carga: {} }];
  ctx.VybeComercial.abrir('pacotes', { abas: ['pacotes'] }); await esperar();
  html = janela().innerHTML;
  assert.equal((html.match(/data-vc="pacote"/g) || []).length, 2, 'o do cabeçalho e o Editar do cartão');
  assert.match(topoDe(html), /data-vc="pacote">.*Novo pacote/);
});

test('Contas a pagar: números numa linha, para onde vai o dinheiro com %, "Nova conta" uma vez e sem recado de documentação', async () => {
  let contas = [];
  const corpo = () => ({ ok: true, pode: { ver_dinheiro: true }, contas, faturamento: 10000, resumo: { total: contas.length ? 3000 : 0, fixo: 2000, variavel: 1000, fixo_percentual: 20, variavel_percentual: 10,
    vencidas: { total: 0, quantidade: 0 }, sete_dias: { total: 0, quantidade: 0 }, resultado: 7000,
    grupos: [{ id: 'fixas', nome: 'Fixas', total: contas.length ? 2000 : 0 }, { id: 'variaveis', nome: 'Variáveis', total: contas.length ? 1000 : 0 }] } });
  const { ctx, janela } = comercial((url) => (url.includes('aba=contas') ? { status: 200, corpo: corpo() } : { status: 200, corpo: { ok: true } }), {
    souDonoDaSessao: () => true, VybeFinancas: { estado: () => ({ dados: { conectado: false, motivo: 'Sem ligação', passos: ['Leia docs/vybe-financas.md'] } }), carregar: async () => {} } });
  ctx.VybeComercial.abrir('contas', { abas: ['contas'] }); await esperar();
  let html = janela().innerHTML;
  // 2ª rodada (quadro 20): com a lista vazia o botão também fica no cabeçalho, e só nele.
  assert.equal((html.match(/Nova conta/g) || []).length, 1, 'vazio: o botão só no cabeçalho');
  assert.match(topoDe(html), /data-vc="conta">.*Nova conta/);
  assert.match(html, /class="vc-vazio"><p>Nenhuma conta neste período\.[^<]*<\/p><\/div>/, 'o vazio fica só com a frase');
  assert.doesNotMatch(html, /class="vc-kpi|passo a passo|docs\/|type="month"/);
  assert.match(html, /nenhuma conta lançada no período/);
  assert.match(html, /class="vb-mes"/);
  contas = [{ id: '1', descricao: 'Aluguel', valor: 2000, grupo: 'fixas', vencimento: '2026-11-20' }];
  ctx.VybeComercial.abrir('contas', { abas: ['contas'] }); await esperar();
  html = janela().innerHTML;
  assert.equal((html.match(/Nova conta/g) || []).length, 1, 'com contas: só no cabeçalho');
  assert.match(topoDe(html), /Nova conta/);
  assert.match(html, /aria-label="Fixas 66,7%, Variáveis 33,3%"/);
  assert.match(html, /<i style="background:#1D4ED8"><\/i>Fixas 66,7%/, 'a porcentagem escrita, não só a cor');
});

test('Finanças por cliente (padrão v2): três números, fichas e a lista com o cliente por linha, mesmo sem contrato', async () => {
  const { ctx, janela } = comercial((url) => (url.includes('aba=financas') ? { status: 200, corpo: { ok: true, pode: { ver_dinheiro: true }, clientes: [], resumo: { receita: 0, custo: 0, margem_percentual: null, criticas: 1, pagamento: { atrasado: 0, inadimplente: 0 } } } } : { status: 200, corpo: { ok: true } }), {
    souDonoDaSessao: () => true, CADASTRO_CLIENTES: [{ id: '1', nome: 'Antonov' }] });
  ctx.VybeComercial.abrir('financas', { abas: ['financas'] }); await esperar();
  const html = janela().innerHTML;
  assert.match(topoDe(html), /<h2>Finanças por cliente<\/h2><span class="d3-selo-donos">só donos<\/span>/);
  assert.doesNotMatch(html, /class="vc-kpi/);
  // 2ª rodada (quadro 59): sem chips acima e sem cartões; uma tabela com o cliente por linha e os totais no rodapé.
  assert.doesNotMatch(html, /class="vb-resumo"|class="vc-cartao|<table/);
  assert.match(html, />Contratado<\/span>[\s\S]*>Custo da carteira<\/span>[\s\S]*>Margem<\/span>[\s\S]*sem contrato e pacote/, 'sem dado fica escrito, não vira número inventado');
  assert.match(html, /aria-pressed="true">Todos <b>1<\/b><\/button>[\s\S]*>Em atraso <b>0<\/b><\/button>[\s\S]*>Margem baixa <b>0<\/b><\/button>[\s\S]*>Em dia <b>0<\/b><\/button>/);
  assert.match(html, /<div class="v2c-tb v2c-tb-cab"><span>Cliente<\/span><span class="v2c-num">Contrato<\/span><span>Margem<\/span><span>Pagamento<\/span>/);
  assert.equal((html.match(/data-v2-linha="fc:/g) || []).length, 1, 'o cliente ativo do cadastro aparece mesmo sem contrato');
  assert.match(html, /<h3>Clientes<\/h3><small>1<\/small>[\s\S]*sem valor[\s\S]*sem pacote[\s\S]*<span class="v2c-pill n">sem contrato<\/span>/);
  assert.doesNotMatch(html, /Vybe Finanças/, 'o aviso fala do efeito, sem nome de sistema');
});

test('Conta: o WhatsApp é uma linha com a situação numa etiqueta; quem resolve é o "Pede ação"; código só depois de pedir', () => {
  const ctx = vm.createContext({ console, Date, safeText, vbEstadoHtml: () => '<div class="vb-estado"></div>', document: { querySelector: () => null, getElementById: () => null } });
  vm.runInContext(ler('vybe-conta.js'), ctx);
  const html = (estado) => { ctx.__e = estado; return vm.runInContext('CONTA_AI = globalThis.__e; blocoContaAI()', ctx); };
  const livre = html({ disponivel: true, vinculado: false, pode_gerar: true });
  assert.match(livre, /conta-ai-linha"><span class="conta-ai-rotulo">WhatsApp<\/span>[\s\S]*<b class="v2c-pill a"[^>]*>Não conectado<\/b>/);
  assert.doesNotMatch(livre, />Conectar<\/button>/, 'padrão v2: o Conectar fica no Pede ação');
  ctx.__eu = { nome: 'Pessoa', email: 'p@x', foto_url: 'f.png' };
  assert.match(vm.runInContext('pedeAcaoDaConta(globalThis.__eu)', ctx), /Não conectado[\s\S]*onclick="acaoContaAI\('vinculacao_iniciar'\)">Conectar<\/button>/);
  assert.doesNotMatch(livre, /vb-estado|<h3|Gerar código temporário/);
  assert.match(html({ disponivel: true, vinculado: true, pode_gerar: true }), /<b class="v2c-pill g"[^>]*>Conectado<\/b>[\s\S]*>Desconectar</);
  const erro = html({ erro: 'Sem resposta.' });
  assert.match(erro, /conta-ai-linha erro[\s\S]*Não deu para conferir agora[\s\S]*Sem resposta\./);
  assert.match(vm.runInContext('pedeAcaoDaConta(globalThis.__eu)', ctx), /Não conferido[\s\S]*onclick="carregarContaAI\(\)">Tentar de novo<\/button>/);
  assert.doesNotMatch(erro, /vb-estado/, 'erro numa linha, sem o bloco com ícone vermelho');
  const comCodigo = html({ disponivel: true, vinculado: false, pode_gerar: true, codigo: 'a'.repeat(20), expiraEm: new Date(Date.now() + 6e5).toISOString() });
  assert.match(comCodigo, /Cancelar o código[\s\S]*conta-ai-codigo/);
  assert.match(vm.runInContext('pedeAcaoDaConta(globalThis.__eu)', ctx), />Já enviei o código<\/button>/);
});

test('CSS do redesign Negócio: no fim, sem !important nem html body.mundo', () => {
  const css = ler('vybe-mundo.css'), bloco = css.slice(css.indexOf('/* === NEGÓCIO (redesign, quadros 13, 18 a 20'));
  assert.ok(bloco.length > 200 && bloco.includes('.vb-mes{') && bloco.includes('.conta-ai-linha{'));
  for (const b of [bloco, ler('vybe-mundo-comercial.css').split('/* === Redesign Negócio')[1], ler('vybe-mundo-carteira.css').split('/* === Redesign Negócio')[1]]) {
    assert.ok(b);
    assert.doesNotMatch(b, /!important|html body\.mundo/);
  }
});

// ---- 2ª rodada (10/11/2026, re-auditoria): 13 e 60, 18, 30 e 54 ----
test('Contratos: o mês a mês é um cartão com uma série por vez; a conta fica em "Como funciona"; sem dado, uma frase', async () => {
  const comDado = carteira({ resposta: semTabelas });
  await comDado.ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'], rotulo: 'Comercial' }); await esperar();
  let html = comDado.janela().innerHTML;
  // Direção 3: a série em abas que esticam e o gráfico em linha (fora do painel, sem o núcleo, ficam o valor e os meses).
  assert.match(html, /<h2>Mês a mês<\/h2><span class="v2c-seg" role="group" aria-label="Série"><button type="button" data-vc-serie-ct="ativos" aria-pressed="true">Ativos<\/button>/);
  assert.match(html, /class="d3k-agora"[\s\S]*<span class="agora">/, 'com cliente ativo o mês a mês aparece, o mês de agora marcado');
  comDado.clicar({ vcSerieCt: 'novos' });
  assert.match(comDado.janela().innerHTML, /data-vc-serie-ct="novos" aria-pressed="true"/);
  comDado.clicar({ vcAjuda: '' });
  assert.match(comDado.janela().innerHTML, /Cada mês na data do último dia[\s\S]*Ticket = receita mensal ativa ÷ clientes ativos com valor/);
  const vazio = carteira({ resposta: { status: 200, corpo: { ...semTabelas.corpo, clientes: [] } } });
  await vazio.ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'], rotulo: 'Comercial' }); await esperar();
  html = vazio.janela().innerHTML;
  assert.match(html, /Sem data de entrada ainda\./);
  assert.doesNotMatch(html, /class="d3k-agora"|<figure|vc-graf/, 'nada de gráfico só com zero');
});

test('"Ver o que falta" e "Atualizar" são botões do padrão, não texto clicável (quadro 30)', () => {
  assert.match(ler('vybe-mundo-comercial.js'), /<button type="button" class="vc-sec" data-vc="falta" aria-expanded="\$\{st\.verFalta\}">Ver o que falta<\/button>/);
  assert.doesNotMatch(ler('vybe-mundo-comercial.js'), /class="vc-link" data-vc="falta"/);
  assert.match(ler('vybe-clientes-ficha.js'), /<button type="button" class="vb-botao" onclick="delete FICHA_REGISTROS\[[^>]*>Atualizar<\/button>/);
});

test('Conta: no mundo a tela não é um cartão dentro da janela (quadros 13 e 60)', () => {
  const css = ler('vybe-appearance.css');
  // Limpeza de 14/11/2026: a regra de .conta-tela saiu na poda das regras mortas (nenhum JS/HTML monta mais .conta-tela).
  assert.doesNotMatch(css, /\.vybe-desktop :is\([^)]*\.conta-tela/);
});

test('Sinapses: "Como o VYBES pensa" e o detalhe por agente moram na página Agentes (quadro 54)', () => {
  const cerebro = ler('vybe-clientes-cerebro.js');
  const sinapses = cerebro.slice(cerebro.indexOf('function renderSinapsesCerebroHtml'), cerebro.indexOf('function renderDiagnosticoCerebroHtml'));
  assert.doesNotMatch(sinapses, /Como o VYBES pensa|Fila do Qwen|filtrarMotorSinapses|porAgente/, 'o diagnóstico saiu das Sinapses do cliente');
  assert.match(sinapses, /renderEstudoClienteCerebroHtml\(cliente\)/, 'o estudo (com o selo Qwen) fica');
  assert.match(sinapses, /De onde vem cada coisa/);
  assert.match(sinapses, /onclick="abrirDiagnosticoDosAgentes\(\)">Ver o diagnóstico em Agentes/);
  assert.match(cerebro, /cb-sin-quando">Feito em [\s\S]{0,200}cerebroMotorHtml\('qwen'\)/,'o selo Qwen do estudo continua à vista (decisão do Paulo)');
  const diag = cerebro.slice(cerebro.indexOf('function renderDiagnosticoCerebroHtml'), cerebro.indexOf('function focarClienteNoCerebro'));
  for (const pedaco of ["'Qwen', k.qwen", "'Lógica fixa', k.logica", 'Fila do Qwen agora', 'porAgente.map', 'De onde vem']) assert.ok(diag.includes(pedaco), pedaco);
  const agentes = ler('vybe-mundo-agentes.js');
  assert.match(agentes, /data-vga-cerebro>[\s\S]*<b>Como o VYBES pensa<\/b>/, 'a entrada na lista da página Agentes');
  assert.match(agentes, /if \(st\.vista === 'cerebro'\) return cerebroHtml\(\);/);
  assert.match(agentes, /G\.renderDiagnosticoCerebroHtml\(\)/);
  assert.match(agentes, /G\.VybeAgentes = \{ abrir, abrirCerebro, /);
  assert.match(agentes, /addEventListener\('vybe:cerebro-mapa'/, 'repinta quando o mapa chega ou o filtro muda');
  assert.match(cerebro, /function cerebroAvisarMapa\(\) \{ try \{ document\.dispatchEvent\(new CustomEvent\('vybe:cerebro-mapa'\)\)/);
  const bloco = ler('vybe-mundo.css').split('/* ==== Redesign negocio2 (quadro 54')[1];
  assert.ok(bloco);
  assert.doesNotMatch(bloco, /!important|html body\.mundo/);
  const tabela = ler('vybe-mundo-comercial.css').split('/* === Redesign negocio2 (quadro 59')[1];
  assert.ok(tabela);
  assert.doesNotMatch(tabela, /!important|html body\.mundo/);
});

// ---- 3ª rodada (11/11/2026): Churn com o tratamento dos Contratos (18) e Saúde sem cartão de zero (00 Main) ----
test('Churn (quadro do padrão v2): fala, três números, fichas, Pede ação com quem saiu e "Saídas e retenção" em três vistas', async () => {
  const vazio = carteira({ resposta: { status: 200, corpo: { ...semTabelas.corpo, clientes: [] } } });
  await vazio.ctx.VybeCarteira.abrir('churn', { abas: ['churn'], rotulo: 'Comercial' }); await esperar();
  let html = vazio.janela().innerHTML;
  assert.match(html, /<div class="v2c" data-tela="churn"><div class="v2c-topo"><h2 id="vc-titulo">Churn<\/h2><span class="d3c-meta">novembro de 2026<\/span>/);
  assert.doesNotMatch(html, /class="vc-controles"|class="vc-resumo"/);
  // Direção 3: a fala é uma frase só (fora do painel, a fala de antes) e são quatro números.
  assert.match(html, /VYBES · Comercial<\/span>Nenhum cliente saiu até agora\./);
  assert.match(html, /<span class="d3-num-rot">Taxa de churn<\/span>[\s\S]*<span class="d3-num-rot">Saídas<\/span>[\s\S]*<span class="d3-num-rot">Receita perdida<\/span>[\s\S]*<span class="d3-num-rot">Até sair<\/span>/);
  assert.match(html, /data-vc-filtro-ch="todas">Todas · 0<\/button>/);
  assert.match(html, /<h2>Saídas e retenção<\/h2>[\s\S]*data-vc-vista-ch="motivos" aria-pressed="true">Motivos/);
  assert.match(html, /<b>A classificação das saídas ainda não foi ligada\.<\/b>/);
  assert.doesNotMatch(html, /Saída = desativação/, 'a conta mora em "Como funciona"');
  vazio.clicar({ vcAjuda: '' });
  assert.match(vazio.janela().innerHTML, /Saída = desativação no cadastro[^<]*Entrada = início do contrato/);
  // Com cliente que tem data de entrada: a retenção aparece na vista dela.
  const ativo = carteira({ resposta: semTabelas });
  await ativo.ctx.VybeCarteira.abrir('churn', { abas: ['churn'], rotulo: 'Comercial' }); await esperar();
  ativo.clicar({ vcVistaCh: 'retencao' });
  assert.match(ativo.janela().innerHTML, /<div class="vc-tabela-rola"><table class="vc-cohort">/);
  // Com saída: a fala conta, Pede ação pede o motivo e quem saiu entra na lista; os gráficos por mês na vista deles.
  const saiu = carteira({ resposta: { status: 200, corpo: { ...semTabelas.corpo, clientes: [{ id: '1', nome: 'Antonov', ativo: false, entrada: '2025-03-01', saida: '2026-11-05' }] } } });
  await saiu.ctx.VybeCarteira.abrir('churn', { abas: ['churn'], rotulo: 'Comercial' }); await esperar();
  html = saiu.janela().innerHTML;
  assert.match(html, /Antonov saiu em novembro e está sem motivo\./);
  assert.match(html, /<span class="v2c-pill r">Sem motivo<\/span><p><span class="v2k-cli">Antonov<\/span> · saiu 05\/11<\/p>/);
  assert.match(html, /<h2>Quem saiu<\/h2><small>1 · /);
  saiu.clicar({ vcVistaCh: 'meses' });
  assert.match(saiu.janela().innerHTML, /<figure class="d3k-graf"><figcaption>Saíram <b>1<\/b><\/figcaption>/);
  const js = ler('vybe-mundo-carteira.js');
  assert.match(js, /const estadoVazio = \(titulo, texto = '', botao = ''\) => \(typeof vbEstadoHtml === 'function' \? vbEstadoHtml\(\{ titulo, texto, acao: botao \}\)/, 'o vazio é a peça do padrão');
});

test('Saúde da carteira: título igual ao do dock (a tela é o quadro do padrão v2); o Churn também é o quadro', async () => {
  const { ctx, janela } = carteira({ resposta: semTabelas });
  await ctx.VybeCarteira.abrir('saude', { abas: ['saude'], rotulo: 'Clientes' }); await esperar();
  assert.match(janela().innerHTML, /<div class="v2c" data-tela="saude"><div class="v2c-topo"><h2 id="vc-titulo">Saúde da carteira<\/h2>/);
  assert.doesNotMatch(janela().innerHTML, /class="vc-frase"|class="vc-resumo"/, 'o quadro não tem a frase nem a linha de números antiga');
  await ctx.VybeCarteira.abrir('churn', { abas: ['churn'], rotulo: 'Comercial' }); await esperar();
  assert.match(janela().innerHTML, /<div class="v2c" data-tela="churn"><div class="v2c-topo"><h2 id="vc-titulo">Churn<\/h2>/, 'o Churn também é o quadro do padrão v2');
  const js = ler('vybe-mundo-carteira.js');
  assert.doesNotMatch(js, /class="vc-kpi|function kpi\(/, 'sem cartão de número grande em nenhuma aba');
  // Na Saúde os riscos viraram fichas de filtro (quadro); o painel de quem está em cada risco continua existindo.
  assert.match(js, /\['precisam', 'Precisam de você'\], \['todos', 'Todos'\], \['alto', 'Risco alto'\], \['medio', 'Risco médio'\], \['baixo', 'Risco baixo'\]/);
  assert.match(js, /if \(tipo === 'risco' && espiarCarteira\.saude\)/);
  // A peça de verdade: zero vira texto discreto e continua clicável (o mesmo data-espiar dos cartões).
  const linha = ctx.vbResumoHtml([{ valor: '0', rotulo: ' em risco alto', tom: 'zero', espiar: 'carteira:risco:alto' }, { valor: '15', rotulo: ' em risco baixo', tom: 'ok', espiar: 'carteira:risco:baixo' }]);
  assert.match(linha, /class="vb-resumo-item zero espiavel" data-espiar="carteira:risco:alto" role="button" tabindex="0"><b>0<\/b> em risco alto/);
  assert.match(linha, /class="vb-resumo-item ok espiavel" data-espiar="carteira:risco:baixo"/);
  const css = ler('vybe-mundo-carteira.css').split('/* === Terceira rodada (quadros 18 e 00 Main')[1];
  assert.ok(css);
  assert.doesNotMatch(css, /!important|html body\.mundo/);
});

test('Recebimentos, Inadimplência e Orçamentos (quadro 20 e 00 Main, regra 4): zero vira uma linha, criar só no cabeçalho, sem pacote leva a Pacotes', async () => {
  let rec = [];
  const resp = (url) => {
    if (url.includes('aba=recebimentos')) return { status: 200, corpo: { ok: true, pode: { ver_dinheiro: true }, recebiveis: rec, periodo: { tipo: 'mensal', mes: '2026-11' },
      resumo: { atual: { a_receber: rec.length ? 3000 : 0, recebido: 0, pendente: rec.length ? 3000 : 0, inadimplente: 0 }, variacao: {} } } };
    if (url.includes('aba=inadimplencia')) return { status: 200, corpo: { ok: true, pode: { ver_dinheiro: true }, total: 0, criticos: 0, clientes: [], faturas: [] } };
    if (url.includes('aba=orcamentos')) return { status: 200, corpo: { ok: true, pode: { editar_comercial: true }, pacotes: [], orcamentos: [] } };
    return { status: 200, corpo: { ok: true } };
  };
  const { ctx, janela } = comercial(resp, { souDonoDaSessao: () => true });
  ctx.VybeComercial.abrir('recebimentos', { abas: ['recebimentos'] }); await esperar();
  let html = janela().innerHTML;
  assert.doesNotMatch(html, /class="vc-kpi/);
  assert.equal((html.match(/Novo recebimento/g) || []).length, 1, 'vazio: o botão só no cabeçalho');
  assert.match(topoDe(html), /data-vc="recebivel">.*Novo recebimento/);
  assert.match(html, /class="vc-vazio"><p>Nenhum recebimento neste período\.[^<]*botão do alto da tela\.<\/p><\/div>/);
  assert.match(html, /class="vb-resumo-item zero"><b>R\$\s0,00<\/b> a receber/);
  rec = [{ id: '1', tipo: 'pontual', descricao: 'Evento', valor: 3000, status: 'pendente', vencimento: '2026-11-20' }];
  ctx.VybeComercial.abrir('recebimentos', { abas: ['recebimentos'] }); await esperar();
  html = janela().innerHTML;
  assert.equal((html.match(/Novo recebimento/g) || []).length, 1, 'com recebimento: só no cabeçalho');
  assert.match(html, /class="vb-resumo-item atencao"><b>R\$\s3\.000,00<\/b> pendente/);
  ctx.VybeComercial.abrir('inadimplencia', { abas: ['inadimplencia'] }); await esperar();
  html = janela().innerHTML;
  assert.doesNotMatch(html, /class="vc-kpi/);
  assert.match(html, /class="vb-resumo-item zero espiavel" data-espiar="comercial:inadimplencia:criticos"[^>]*><b>0<\/b> críticos \(\+30 dias\)/, 'o zero continua abrindo quem está nele');
  assert.match(html, /<b>0<\/b> clientes[\s\S]*<b>0<\/b> faturas/);
  ctx.VybeComercial.abrir('orcamentos', { abas: ['pacotes', 'orcamentos'] }); await esperar();
  html = janela().innerHTML;
  assert.match(html, /Falta pacote ativo\.<\/p><button type="button" class="v2c-btn s" data-vc="ir-pacotes">Ir para Pacotes<\/button>/);
  assert.doesNotMatch(html.slice(html.indexOf('vc-abas')), /<h3>Orçamentos<\/h3>/, 'o título fica só no cabeçalho');
  assert.match(ler('vybe-mundo-comercial.js'), /'ir-pacotes': \(\) => abrir\('pacotes'/, 'o botão abre a aba Pacotes');
  const css = ler('vybe-mundo.css').split('/* ==== Quadro 20 (Finanças, 11/11/2026)')[1];
  assert.ok(css);
  assert.doesNotMatch(css, /!important|html body\.mundo/);
});

test('Painéis de setor, Gestão e Performance (00 Main, regra 4): o zero sai do cartão grande para a linha discreta', () => {
  const setor = ler('vybe-mundo-setor.js');
  assert.ok(setor.includes('if (!cartao && /^(R'), 'zero, R$ 0,00 e "—" viram item da linha');
  assert.match(setor, /data-espiar="\$\{esc\(espiar\)\}"/, 'o zero continua abrindo o mini painel');
  assert.match(setor, /kpi: \(o\) => kpi\(\{ \.\.\.o, cartao: true \}\), kpiLinha: kpi, grade,/, 'fora daqui o cartão segue cartão');
  assert.equal((setor.match(/\$\{grade\(kpis\)\}/g) || []).length, 6);
  assert.match(ler('vybe-mundo.js'), /kpiLinha: k = V\.kpi, grade: G = /);
  assert.match(ler('vybe-mundo-performance.js'), /kpiLinha: k = V\.kpi, grade: G = /);
  const css = ler('vybe-mundo.css').split('/* ==== 00 Main, regra 4 (11/11/2026)')[1];
  assert.ok(css);
  assert.doesNotMatch(css, /!important|html body\.mundo/);
});
