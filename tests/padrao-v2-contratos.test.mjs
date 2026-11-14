import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (12/11/2026): Contratos e Churn (menu Comercial) são os quadros DEPOIS do moodboard aprovado.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo-carteira.js'), css = ler('padrao-v2/contratos.css');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
const trecho = (de, ate) => js.slice(js.indexOf(de), js.indexOf(ate, js.indexOf(de)));

test('Contratos segue a ordem do quadro: título com as ações, fala do Vorcaro, três números, busca e fichas, Pede ação e mês a mês ao lado dos clientes', () => {
  const tela = trecho('  function abaContratos() {', '  // ---------- janela ----------');
  // Direção 3 (13/11/2026): bloco de ação, quatro números (com "Sem contrato"), a tabela dos clientes à esquerda com a
  // trilha "até renovar" e, à direita, Pede ação e o mês a mês em linha.
  naOrdem(tela, ["botao('Como funciona'", "botao('Registrar contrato'", 'd3AcaoOu(AGENTE_CONTRATOS', "rotulo: 'Em contratos'", "rotulo: 'Renovam em 30 dias'", "rotulo: 'Tempo de casa'", "rotulo: 'Sem contrato'",
    "['todos', 'Todos os clientes ativos'", "['sem', 'Sem contrato'", "buscaHtml('Buscar contrato por cliente')", "botao('Filtros'", "cartaoTopo('Pede ação'", 'd3Linha(valores', '<h2>Mês a mês</h2>',
    '<span>Até renovar</span>', 'linhaContratoQ', '${ajudaHtml}${registrar}${fala}${numeros}${filtros}', '<div class="v2k-grade2 v2k-contratos d3k-contratos">${clientes}<div class="v2k-col-esq">${pedeAcao}${mesAMes}</div></div>']);
  assert.match(js, /const AGENTE_CONTRATOS = \{ nome: 'Vorcaro', papel: 'Financeiro e contratos' \};/);
  // A linha: nome e desde quando, a trilha até a renovação, o valor e a data; abre no lugar com o histórico e as ações.
  const linha = trecho('  function linhaContratoQ(', '  function abaContratos() {');
  naOrdem(linha, ['class="v2-abre v2c-linha v2k-ct"', 'class="v2k-nome"', 'class="d3k-desde"', 'class="v2k-trilha"', 'class="d3k-trilha-n"', 'class="v2k-valor"', '${pilulaRenovacao(l)}', 'class="v2-mais"', 'class="v2k-hist"']);
  for (const a of ["'Abrir o contrato'", "'Registrar contrato'", "botao('Mudar a data'", "botao('Abrir o cliente'"]) assert.ok(linha.includes(a), a);
  assert.match(linha, /pode = !fc && podeContratos\(\)/, 'contrato do Vybe Finanças continua sem editar aqui');
  // O que saiu do alto continua a um clique: período e ordem em "Filtros"; conta do LTV e do mês a mês em "Como funciona".
  assert.match(tela, /estado\.filtros \? painelPeriodo\('contratos', \[\['renovacao', 'Renovação mais próxima'\]/);
  assert.match(tela, /<p>\$\{esc\(dicaLtv\)\}<\/p><p>\$\{esc\(comoContaMesAMes\(serie\)\)\}<\/p>/);
  for (const velho of ['vc-resumo', 'resumo([', 'vc-breve', 'Todos os clientes ativos</h3>']) assert.ok(!tela.includes(velho), `saiu ${velho}`);
});

test('Churn segue a ordem do quadro: período, Como funciona e Registrar saída; fala, três números, fichas, Pede ação com quem saiu e Saídas e retenção', () => {
  const tela = trecho('  function abaChurn() {', '  // Como o churn é contado');
  // Direção 3: bloco de ação, quatro números (com "Até sair"), "Quem saiu" em tabela e os gráficos em linha.
  naOrdem(tela, ['<span class="d3c-meta">${periodo}</span>${como}', "botao('Registrar saída'", 'd3AcaoOu(AGENTE_CHURN', "rotulo: 'Taxa de churn'", "rotulo: 'Saídas'", "rotulo: 'Receita perdida'", "rotulo: 'Até sair'",
    "['sem', 'Sem motivo'", "buscaHtml('Buscar saída por cliente')", "botao('Filtros'", '<span class="v2c-pill r">Sem motivo</span>', '<span class="v2c-pill a">Pode sair</span>', "cartaoTopo('Pede ação'",
    "'mostrar o histórico'", '<span>Motivo</span>', "[['motivos', 'Motivos'], ['meses', 'Por mês'], ['retencao', 'Retenção']]", '<h2>Saídas e retenção</h2>',
    '${ajudaHtml}${registrar}${fala}${numeros}${filtros}', '<div class="v2k-grade2 v2k-churn">']);
  assert.match(js, /const AGENTE_CHURN = \{ nome: 'VYBES', papel: 'Comercial' \};/);
  assert.match(tela, /cohortHtml\(c\)/, 'a retenção por mês de entrada continua, na vista "Retenção"');
  assert.ok(tela.includes("${linhaMes('saidas', 'Saíram')}${linhaMes('novos', 'Entraram')}"), 'saídas e entradas por mês continuam, agora em linha');
});

test('o que vai ao servidor não mudou: os mesmos formulários e o mesmo envio; "Por quê?" só escolhe o motivo no formulário', () => {
  const nomes = (fn) => [...trecho(`  function ${fn}(`, '</form>`').matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(nomes('formContrato'), ['valor_mensal', 'inicio', 'renovacao', 'status', 'observacao']);
  assert.deepEqual(nomes('formChurn'), ['saiu_em', 'tipo', 'motivo', 'receita_mensal', 'detalhe']);
  assert.match(js, /if \(f\.dataset\.vcForm === 'churn'\) gravar\(\{ acao: 'churn_registrar', cliente_id: f\.dataset\.vcCli, \.\.\.v \}, 'Motivo da saída salvo\.'\);\n    else gravar\(\{ acao: 'contrato_salvar', cliente_id: f\.dataset\.vcCli, \.\.\.v \}, 'Contrato salvo\.'\);/);
  const porque = trecho('    if (d.vcMotivoCh) {', '\n    }\n');
  assert.ok(porque.length > 50 && !/gravar|pedir|fetch/.test(porque), 'a ficha de motivo não grava nada');
  assert.equal((js.match(/acao: 'contrato_salvar'|acao: 'churn_registrar'/g) || []).length, 2, 'nenhum envio novo');
});

test('CSS do grupo: só #vv-carteira, sem !important nem html body.mundo, com as medidas dos quadros', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const r of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{/g).map((x) => x.trim()).filter((x) => !x.startsWith('@') && !/^(from|to)\b/.test(x))) {
    for (const s of r.slice(0, -1).split(/,(?![^(]*\))/)) assert.match(s.trim(), /^#vv-carteira /, s);
  }
  assert.match(css, /\.v2k-linha-ct\{display:grid;grid-template-columns:minmax\(0,1fr\) 150px 76px 122px;/);
  assert.match(css, /\.v2k-grade2\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.3fr\);gap:14px/);
  assert.match(css, /\.v2k-grade2\.v2k-churn\{grid-template-columns:minmax\(0,1\.4fr\) minmax\(0,1fr\)\}/);
  assert.match(css, /\.v2k-vz\{[^}]*border:1\.5px dashed #D9D1C3;border-radius:999px/);
  assert.match(css, /\.v2k-col > i\{[^}]*width:24px;[^}]*border-radius:7px 7px 3px 3px;background:#D9D3C8/);
});

// Na tela de verdade (vm): a linha do contrato, a trilha e o envio pelo mesmo formulário.
function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {}, classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    querySelector: () => null, querySelectorAll: () => [], contains: () => true, append() {}, focus() {}, remove() {} };
}
async function abrirTela(aba, corpo) {
  const criados = [];
  const doc = { body: elemento('body'), activeElement: null, createElement: (t) => { const e = elemento(t); criados.push(e); return e; }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = vm.createContext({ document: doc, console, setTimeout, clearTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Map, Set, URL,
    localStorage: { getItem: () => '1', setItem() {} }, CADASTRO_CLIENTES: [], hojeDeVerdade: () => '2026-11-12',
    fetch: async () => ({ ok: true, status: 200, json: async () => corpo }) });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {};
  vm.runInContext(ler('vybe-carteira-saude.js'), ctx);
  vm.runInContext(ler('vybe-mundo-carteira.js'), ctx);
  await ctx.VybeCarteira.abrir(aba, { abas: [aba] });
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 2));
  const janela = criados.find((e) => e.id === 'vv-carteira'), camada = criados.find((e) => e.className === 'vc-camada');
  const clicar = (dataset) => camada.ouvintes.click[0]({ target: { closest: () => ({ dataset, disabled: false, closest: () => null }) } });
  return { janela, clicar, camada };
}
const BASE = { ok: true, pode: { contratos: true, churn: true }, onboarding: { disponivel: false }, etapas: [], etapas_padrao: [], historico: { disponivel: false },
  clientes: [{ id: '1', nome: 'Alfa', ativo: true, entrada: '2025-11-23', valor: 4200 }, { id: '2', nome: 'Beta', ativo: true, entrada: '2026-06-01', valor: null },
    { id: '3', nome: 'Gama', ativo: false, entrada: '2025-01-10', saida: '2026-11-02', valor: 2200 }],
  contratos: { disponivel: true, lista: [{ cliente_id: '1', valor_mensal: 4200, inicio: '2025-11-23', renovacao: '2026-11-23', status: 'ativo', observacao: '' }] },
  churn: { disponivel: true, registros: [] } };

test('Contratos na tela: Pede ação com a renovação e quem está sem contrato, a linha com trilha, valor e data; "Renovar" abre o formulário de sempre', async () => {
  const { janela, clicar } = await abrirTela('contratos', BASE);
  let html = janela.innerHTML;
  // Sem o núcleo (vm), o bloco de ação cai na fala de antes com a mesma frase curta.
  assert.match(html, /Alfa renova em 11 dias\./);
  assert.match(html, /<span class="v2c-pill a">Renova em 11 dias<\/span><p><span class="v2k-cli">Alfa<\/span> · R\$\s4\.200 por mês/);
  assert.match(html, /<span class="v2c-pill r">Sem contrato<\/span><p><b>Beta<\/b> · ativo, sem valor mensal nem início/);
  assert.match(html, /<span class="v2k-nome"><b>Alfa<\/b><small>desde 11\/2025<\/small><\/span>\s*<span class="d3k-desde">11\/2025<\/span>\s*<span class="v2k-trilha"><span class="v2-barra"><i style="--v:97%;--c:#7A4A00"><\/i><\/span><small>12 de 12 meses<\/small><em class="d3k-trilha-n">12\/12<\/em><\/span>\s*<b class="v2k-valor">R\$\s4\.200<\/b><span class="v2c-pill a">23\/11 · 11 dias<\/span>/);
  clicar({ vcFormAbrir: 'contrato', vcCli: '1', vcOnde: 'acao', vcCampo: 'renovacao' });
  html = janela.innerHTML;
  assert.match(html, /<div class="v2k-acao-form"><form class="vc-form" data-vc-form="contrato" data-vc-cli="1">/);
  assert.equal((html.match(/data-vc-form="contrato"/g) || []).length, 1, 'o formulário abre num lugar só');
});

test('Churn na tela: a saída sem motivo pede ação; "Classificar a saída" abre "Por quê?" e o formulário de sempre', async () => {
  const { janela, clicar } = await abrirTela('churn', BASE);
  let html = janela.innerHTML;
  assert.match(html, /Gama saiu em novembro e está sem motivo\./);
  assert.match(html, /data-vc-filtro-ch="sem">Sem motivo · 1<\/button>/);
  assert.match(html, /<h2>Quem saiu · 1<\/h2>/);
  clicar({ vcFormAbrir: 'churn', vcCli: '3', vcOnde: 'acao' });
  html = janela.innerHTML;
  assert.match(html, /<p class="v2k-porque"><span class="v2c-sub">Por quê\?<\/span><button type="button" class="v2c-chip" aria-pressed="false" data-vc-motivo-ch="preco">Preço<\/button>/);
  assert.match(html, /<form class="vc-form" data-vc-form="churn" data-vc-cli="3">/);
});
