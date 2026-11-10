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

test('Contratos: os oito números numa linha, o LTV no ⓘ, o mês no seletor e a etiqueta do setor do dock', async () => {
  const { ctx, janela, clicar } = carteira({ resposta: semTabelas });
  await ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'], rotulo: 'Comercial' });
  await esperar();
  let html = janela().innerHTML;
  assert.match(html, /<span class="vc-kicker">Comercial<\/span>/, 'sem a etiqueta "Clientes" no Contratos');
  assert.doesNotMatch(html, /class="vc-kpi/, 'sem cartões de número');
  assert.match(html, /class="vc-resumo"><div class="vb-resumo"/);
  assert.match(html, /vb-resumo-item atencao espiavel" data-espiar="carteira:contratos:sem"[^>]*><b>1<\/b> sem contrato/);
  assert.match(html, /ticket médio: sem valor/);
  assert.match(html, /data-dica="LTV = meses desde o início do contrato/, 'a explicação do LTV vira dica');
  assert.doesNotMatch(html, /<p class="vc-nota">LTV =/, 'sem o parágrafo do LTV no corpo');
  assert.doesNotMatch(html, /type="month"/);
  assert.match(html, /class="vb-mes"[\s\S]*novembro de 2026/);
  clicar({ vcMesIr: '2026-10' });
  assert.match(janela().innerHTML, /outubro de 2026/);
  // o aviso de ativação: sem arquivo, sem "Tentar de novo", e só quem administra vê "Ver o que falta"
  assert.match(html, /Os contratos ainda não foram ligados/);
  assert.doesNotMatch(html, /\.sql|Tentar de novo|Ver o que falta/);
});

test('Ativação: quem administra vê "Ver o que falta" e, aberto, o nome da migração', async () => {
  const { ctx, janela, clicar } = carteira({ resposta: semTabelas, admin: true });
  await ctx.VybeCarteira.abrir('contratos', { abas: ['contratos'] });
  await esperar();
  assert.match(janela().innerHTML, /Para quem administra: <button[^>]*data-vc-falta aria-expanded="false">Ver o que falta/);
  assert.doesNotMatch(janela().innerHTML, /2026-11-07-carteira\.sql/);
  clicar({ vcFalta: '' });
  assert.match(janela().innerHTML, /migração <code>2026-11-07-carteira\.sql<\/code>/);
});

test('Onboarding sem ativação: a esteira aparece numerada (do padrão do servidor, ou o caminho em 3 passos)', async () => {
  const a = carteira({ resposta: semTabelas });
  await a.ctx.VybeCarteira.abrir('onboarding', { abas: ['onboarding'], rotulo: 'Clientes' });
  await esperar();
  let html = a.janela().innerHTML;
  assert.match(html, /O onboarding ainda não foi ligado/);
  assert.match(html, /<ol class="vc-esteira vc-esteira-previa"[^>]*><li title="Mensagem enviada"><i aria-hidden="true">1<\/i><span>Boas-vindas<\/span><small>1 item<\/small>/);
  assert.match(html, /<i aria-hidden="true">2<\/i><span>Kickoff<\/span><small>0 itens<\/small>/);
  assert.doesNotMatch(html, /Tentar de novo/);
  // Servidor sem a carteira (503 "aguardando"): não é erro, nem mostra o arquivo na tela.
  const b = carteira({ resposta: { status: 503, corpo: { error: 'Carteira aguardando ativação: falta aplicar a migração 2026-11-07-carteira.sql.', aguardando: true } } });
  await b.ctx.VybeCarteira.abrir('onboarding', { abas: ['onboarding'] });
  await esperar();
  html = b.janela().innerHTML;
  assert.doesNotMatch(html, /\.sql|Tentar de novo|role="alert"/);
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
  assert.match(topoDe(html), /<b>CRM e funil<\/b>/);
  assert.doesNotMatch(html, /class="vc-kpi/);
  assert.match(html, /taxa de ganho: sem negócio fechado ainda/);
  assert.match(html, /O valor da negociação ainda não foi ligado/);
  assert.doesNotMatch(html, /\.sql|Ver o que falta|Novo lead/);
  const dono = comercial(resp, { souAdmin: () => true });
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
  assert.match(topoDe(html), /<b>Produtos e pacotes<\/b>/);
  assert.equal((html.match(/data-vc="pacote"/g) || []).length, 1);
  assert.match(html, /class="vc-vazio"[\s\S]*Cadastrar o primeiro pacote/);
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
  assert.equal((html.match(/Nova conta/g) || []).length, 1, 'vazio: o botão só no vazio');
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

test('Finanças por cliente: os seis números numa linha de resumo', async () => {
  const { ctx, janela } = comercial((url) => (url.includes('aba=financas') ? { status: 200, corpo: { ok: true, pode: { ver_dinheiro: true }, clientes: [], resumo: { receita: 0, custo: 0, margem_percentual: null, criticas: 1, pagamento: { atrasado: 0, inadimplente: 0 } } } } : { status: 200, corpo: { ok: true } }), {
    souDonoDaSessao: () => true, CADASTRO_CLIENTES: [{ id: '1', nome: 'Antonov' }] });
  ctx.VybeComercial.abrir('financas', { abas: ['financas'] }); await esperar();
  const html = janela().innerHTML;
  assert.match(topoDe(html), /<b>Finanças por cliente<\/b>/);
  assert.doesNotMatch(html, /class="vc-kpi/);
  const linha = html.slice(html.indexOf('class="vb-resumo"'), html.indexOf('vc-busca'));
  assert.equal((linha.match(/class="vb-resumo-item/g) || []).length, 6);
  assert.match(linha, /vb-resumo-item alerta espiavel" data-espiar="comercial:financas:critica"[^>]*><b>1<\/b> em zona crítica/);
});

test('Conta: o WhatsApp é uma linha com "Conectar" (não um bloco); código só depois de pedir', () => {
  const ctx = vm.createContext({ console, Date, safeText, vbEstadoHtml: () => '<div class="vb-estado"></div>', document: { querySelector: () => null, getElementById: () => null } });
  vm.runInContext(ler('vybe-conta.js'), ctx);
  const html = (estado) => { ctx.__e = estado; return vm.runInContext('CONTA_AI = globalThis.__e; blocoContaAI()', ctx); };
  const livre = html({ disponivel: true, vinculado: false, pode_gerar: true });
  assert.match(livre, /<div class="conta-ai-linha"><span class="conta-ai-rotulo">WhatsApp<\/span>[\s\S]*<b>Não conectado<\/b>[\s\S]*>Conectar<\/button>/);
  assert.doesNotMatch(livre, /vb-estado|<h3|Gerar código temporário/);
  assert.match(html({ disponivel: true, vinculado: true, pode_gerar: true }), /<b>Conectado<\/b>[\s\S]*>Desconectar</);
  const erro = html({ erro: 'Sem resposta.' });
  assert.match(erro, /conta-ai-linha erro[\s\S]*Não deu para conferir agora[\s\S]*Sem resposta\.[\s\S]*Tentar de novo/);
  assert.doesNotMatch(erro, /vb-estado/, 'erro numa linha, sem o bloco com ícone vermelho');
  const comCodigo = html({ disponivel: true, vinculado: false, pode_gerar: true, codigo: 'a'.repeat(20), expiraEm: new Date(Date.now() + 6e5).toISOString() });
  assert.match(comCodigo, /Já enviei o código[\s\S]*conta-ai-codigo/);
});

test('CSS do redesign Negócio: no fim, sem !important nem html body.mundo', () => {
  const css = ler('vybe-mundo.css'), bloco = css.slice(css.indexOf('/* === NEGÓCIO (redesign, quadros 13, 18 a 20'));
  assert.ok(bloco.length > 200 && bloco.includes('.vb-mes{') && bloco.includes('.conta-ai-linha{'));
  for (const b of [bloco, ler('vybe-mundo-comercial.css').split('/* === Redesign Negócio')[1], ler('vybe-mundo-carteira.css').split('/* === Redesign Negócio')[1]]) {
    assert.ok(b);
    assert.doesNotMatch(b, /!important|html body\.mundo/);
  }
});
