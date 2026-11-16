import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Contratos e Churn (menu Comercial) nas pranchas V2-M-Contratos e V2-M-Churn (16/11/2026): a janela em vidro fumê, a
// folha com a lista e a coluna de consulta com o cartão laranja. Antes eram os quadros do padrão v2 (12/11/2026).
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo-carteira.js'), css = ler('padrao-v2/contratos.css'), cssM = ler('padrao-v2/zm-d-carteira.css');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
const trecho = (de, ate) => js.slice(js.indexOf(de), js.indexOf(ate, js.indexOf(de)));

test('Contratos segue a prancha: o laranja do Vorcaro, a folha com as fichas, a linha com a régua de doze meses, o "De olho" e a coluna de consulta', () => {
  const tela = trecho('  function abaContratos() {', '  // ---------- janela ----------');
  naOrdem(tela, ['larMq(AGENTE_CONTRATOS', "['todos', 'Todos'", "['sem', 'Sem contrato'", 'linhaContratoM(l, { regua, din, rotGrupo })', '<small>De olho</small>', '<span>Cliente</span>', '<span>Desde</span>', '<span class="d3m-d-ct-r">Renova</span>',
    "segM('Filtrar os clientes'", "segM('Série'", 'd3Linha(valores', '<b>Clientes ativos</b>', '<b>Churn</b> · quem saiu e por quê', '<b>Mês a mês</b>', '<b>Como funciona</b>', "buscaM('Buscar contrato por cliente')", 'Período e ordem', 'Registrar contrato</button>',
    '<div class="d3m-d-ct" data-tela="ct-contratos"><div class="d3m-d-ct-main">', "${estado.vistaCt === 'meses' ? folhaMeses : folhaLista}", '<aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${laranja}${ativosM}${abrirM}</aside>']);
  assert.match(js, /const AGENTE_CONTRATOS = \{ nome: 'Vorcaro', papel: 'Financeiro e contratos' \};/);
  // A linha: o grupo, o cliente, o valor, desde quando, a régua e a renovação; abre no lugar com o histórico e as ações.
  const linha = trecho('  function linhaContratoM(', '  function abaContratos() {');
  naOrdem(linha, ['class="d3m-d-ct-li" data-vc-linha=', 'data-vc-abrir=', 'class="d3m-d-ct-g ${g}"', '${avM(l.nome)}', 'class="d3m-d-ct-n"', 'class="d3m-d-ct-v"', 'class="d3m-d-ct-d', '${reguaHtml}${renova}', 'class="d3m-d-ct-mais"', 'class="v2k-acao-form"', 'class="d3m-d-ct-acoes"']);
  for (const a of ["'Abrir o contrato'", "'Registrar contrato'", "btnFolha('Mudar a data'", "btnFolha('Abrir o cliente'"]) assert.ok(linha.includes(a), a);
  assert.match(linha, /pode = !fc && podeContratos\(\)/, 'contrato do Vybe Finanças continua sem editar aqui');
  // O que saiu do alto continua a um clique: período e ordem no "Mais"; a conta do LTV e do mês a mês em "Como funciona".
  assert.match(tela, /estado\.filtros \? periodoM\('contratos', ORDENS\)/);
  assert.match(tela, /<p>\$\{esc\(dicaLtv\)\}<\/p><p>\$\{esc\(comoContaMesAMes\(serie\)\)\}<\/p>/);
  for (const velho of ['vc-resumo', 'resumo([', 'vc-breve', 'v2c-card', 'd3AcaoOu(', 'numD3(']) assert.ok(!tela.includes(velho), `saiu ${velho}`);
});

test('Churn segue a prancha: três números em folha, as saídas por mês ao lado do porquê, "Quem saiu" em colunas e a coluna de consulta', () => {
  const tela = trecho('  function abaChurn() {', '  // Como o churn é contado');
  naOrdem(tela, ['larMq(AGENTE_CHURN', 'rotulo: `Taxa de churn ${noPeriodo}`', "rotulo: 'Receita perdida'", "rotulo: 'Tempo até sair'", "['sem', 'Sem motivo'", "segM('Filtrar as saídas'", '<span>Cliente</span><span>Saiu em</span><span>Como</span><span>Motivo</span>',
    "[['meses', 'Por mês'], ['motivos', 'Motivos'], ['retencao', 'Retenção']]", 'cohortHtml(c)', "barrasDe('saidas', 'Saídas por mês')", '<h3>Por que saíram</h3>', '<b>Em risco agora</b>', '<b>Retenção</b><span>por ano de entrada</span>',
    "buscaM('Buscar saída por cliente')", 'Período e ordem', 'Registrar saída</button>', '<div class="d3m-d-ct d3m-d-ch', '" data-tela="ct-churn">', '${numeros}', '<div class="d3m-d-ch-meio">${folhaVista}${folhaMotivos}</div>${quemSaiu}', '${laranja}${riscoM}${retencaoM}</aside>']);
  assert.match(js, /const AGENTE_CHURN = \{ nome: 'VYBES', papel: 'Comercial' \};/);
  const linha = trecho('  function linhaSaidaM(', '  function abaChurn() {');
  for (const a of ["btnFolha('Registrar motivo'", "btnFolha('Abrir a ficha'", "'Editar motivo' : 'Classificar a saída'", '${porQueHtml(s)}${formChurn(s)}']) assert.ok(linha.includes(a), a);
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

test('CSS dos quadros de antes: só #vv-carteira, sem !important nem html body.mundo', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const r of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{/g).map((x) => x.trim()).filter((x) => !x.startsWith('@') && !/^(from|to)\b/.test(x))) {
    for (const s of r.slice(0, -1).split(/,(?![^(]*\))/)) assert.match(s.trim(), /^#vv-carteira /, s);
  }
});

test('CSS das pranchas (zm-d-carteira.css): só tokens --d3-*, sem !important, sem html body.mundo, sem :has e sem animação nova', () => {
  const regras = cssM.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(regras, /!important|html body\.mundo|:has\(|@keyframes|animation/);
  assert.doesNotMatch(regras, /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?=[;} ])/, 'nenhuma cor fixa: só tokens');
  for (const r of regras.match(/[^{}]+\{/g).map((x) => x.trim()).filter((x) => !x.startsWith('@'))) {
    for (const s of r.slice(0, -1).split(/,(?![^(]*\))/)) assert.match(s.trim(), /^(body\.mundo \.vc-camada > #vv-carteira\.vc-janela\.d3m-d-m|#vv-carteira\.d3m-d-m|b?\.d3m-d-(ct|ch|pk-seg)|button\.d3m-d-ct|\[aria-expanded="true"\] > \.d3m-d-ct-mais)/, s);
  }
  assert.match(regras, /body\.mundo \.vc-camada > #vv-carteira\.vc-janela\.d3m-d-m\{[^}]*background:var\(--d3-fume\)/, 'a janela é vidro fumê só nessas telas');
  assert.match(regras, /\.d3m-d-ct\{display:grid;grid-template-columns:minmax\(0,1fr\) 316px;gap:16px/);
  assert.match(regras, /\.d3m-d-ct-lin\{[^}]*grid-template-columns:60px 28px minmax\(0,1fr\) 96px 72px 228px 96px;[^}]*height:38px/);
  assert.match(regras, /\.d3m-d-ct-regua > i\{[^}]*width:16px;height:18px;border-radius:4px/);
  assert.match(regras, /\.d3m-d-ch-lin\{[^}]*height:48px/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/zm-d-carteira.css ===== */'), 'o fragmento entrou na folha juntada');
  assert.ok(!/[^\r]\n/.test(fs.readFileSync('padrao-v2/zm-d-carteira.css', 'utf8')), 'fim de linha em CRLF');
});

// Na tela de verdade (vm): a linha do contrato, a régua e o envio pelo mesmo formulário.
function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {}, classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    querySelector: () => null, querySelectorAll: () => [], contains: () => true, append() {}, focus() {}, remove() {} };
}
async function abrirTela(aba, corpo, extra = {}) {
  const criados = [];
  const doc = { body: elemento('body'), activeElement: null, createElement: (t) => { const e = elemento(t); criados.push(e); return e; }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const ctx = vm.createContext({ document: doc, console, setTimeout, clearTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Map, Set, URL,
    localStorage: { getItem: () => '1', setItem() {} }, CADASTRO_CLIENTES: [], hojeDeVerdade: () => '2026-11-12',
    fetch: async () => ({ ok: true, status: 200, json: async () => corpo }), ...extra });
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

test('Contratos na tela: o laranja com a renovação, a linha com o grupo, o valor, a régua e a data; o formulário de sempre abre na linha', async () => {
  const { janela, clicar } = await abrirTela('contratos', BASE);
  let html = janela.innerHTML;
  assert.equal(janela.className, 'vc-janela d3m-d-m', 'a janela vira vidro fumê');
  assert.match(html, /<h2 id="vc-titulo">Contratos<\/h2>/);
  assert.match(html, /Vorcaro · renovação chegando<\/span>\s*<div class="d3m-lar-txt"><b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">contrato renova em 30 dias<\/span><small>Alfa em 23\/11: <span data-espiar="carteira:contratos:breve">R\$\s4\.200 por mês<\/span>\.<\/small>/);
  assert.match(html, /<button type="button" class="d3m-btn l" data-vc-abrir="k:1" data-vc-focar="linha">Abrir Alfa<\/button>/);
  assert.match(html, /<span class="d3m-d-ct-g agora">Agora<\/span><i class="d3m-d-ct-av c\d" aria-hidden="true">AL<\/i><span class="d3m-d-ct-n">Alfa<\/span>\s*<b class="d3m-d-ct-v">R\$\s4\.200<\/b>\s*<span class="d3m-d-ct-d">nov 25<\/span><span class="d3m-d-ct-regua" aria-hidden="true"><i class="on r">n<\/i>(<i><\/i>){11}<\/span><span class="d3m-d-ct-r a">23\/11<\/span>/);
  assert.match(html, /<span class="d3m-d-ct-g falta">Falta<\/span>[\s\S]*<span class="d3m-d-ct-n">Beta<\/span>\s*<span class="d3m-d-ct-v q">sem valor<\/span>[\s\S]*<span class="d3m-d-ct-r k">Registrar<\/span>/);
  assert.match(html, /<small>De olho<\/small><span><b>R\$\s4,2 mil<\/b> em contratos, por mês<\/span>/);
  assert.match(html, /data-vc-registrar aria-expanded="false">[\s\S]*?Registrar contrato<\/button>/);
  clicar({ vcFormAbrir: 'contrato', vcCli: '1', vcOnde: 'lista', vcCampo: 'renovacao' });
  html = janela.innerHTML;
  assert.match(html, /<div class="v2k-acao-form"><form class="vc-form" data-vc-form="contrato" data-vc-cli="1">/);
  assert.equal((html.match(/data-vc-form="contrato"/g) || []).length, 1, 'o formulário abre num lugar só');
});

test('Churn na tela: a saída sem motivo vai para o laranja; "Registrar o motivo" abre "Por quê?" e o formulário de sempre na linha', async () => {
  const { janela, clicar } = await abrirTela('churn', BASE);
  let html = janela.innerHTML;
  assert.match(html, /VYBES · saída sem motivo<\/span>\s*<div class="d3m-lar-txt"><b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">saída de novembro sem motivo<\/span><small>Gama saiu em 02\/11\. Sem o motivo, a retenção não aprende\.<\/small>/);
  assert.match(html, /<button type="button" class="d3m-btn l" data-vc-form-abrir="churn" data-vc-cli="3" data-vc-onde="lista">Registrar o motivo<\/button>/);
  assert.match(html, /data-vc-filtro-ch="sem" aria-pressed="false">Sem motivo <b class="a">1<\/b><\/button>/);
  assert.match(html, /<section class="d3m-d-folha d3m-d-ch-quem" aria-label="Quem saiu"><div class="d3m-d-cab"><h3>Quem saiu <small>· 1 em novembro de 2026<\/small><\/h3>/);
  assert.match(html, /data-vc-abrir="s:3"[^>]*>Gama<\/button>\s*<span>02\/11<\/span><span>sem tipo<\/span>\s*<span class="d3m-d-ch-mot a">sem motivo<\/span>\s*<span class="d3m-d-ch-v">R\$\s2\.200<\/span>/);
  clicar({ vcFormAbrir: 'churn', vcCli: '3', vcOnde: 'lista' });
  html = janela.innerHTML;
  assert.match(html, /<p class="v2k-porque"><span class="v2c-sub">Por quê\?<\/span><button type="button" class="v2c-chip" aria-pressed="false" data-vc-motivo-ch="preco">Preço<\/button>/);
  assert.match(html, /<form class="vc-form" data-vc-form="churn" data-vc-cli="3">/);
});

// Dinheiro: nenhum valor para quem não é dono, também no "ver como" (Paulo, 13/11/2026). O servidor já manda a carteira
// sem valores para quem não é dono; vendo como outra pessoa, a sessão é de dono e quem esconde é a tela.
test('dinheiro: Contratos e Churn não mostram valor nem formulário para quem não é dono, nem no "ver como"', async () => {
  const semValor = { ...BASE, pode: { contratos: false, churn: false, ver_dinheiro: false }, clientes: BASE.clientes.map((c) => ({ ...c, valor: null })),
    contratos: { disponivel: true, lista: BASE.contratos.lista.map((c) => ({ ...c, valor_mensal: null })) } };
  const verComo = { sessionStorage: { getItem: (k) => (k === 'vybe.verComo' ? '9' : null) }, TEAM_USERS: [{ id: '9', nome: 'Equipe', dono: false }] };
  for (const [nome, corpo, extra] of [['não dono', semValor, {}], ['ver como', { ...BASE, pode: { ...BASE.pode, ver_dinheiro: true } }, verComo]]) {
    for (const aba of ['contratos', 'churn']) {
      const { janela, clicar } = await abrirTela(aba, corpo, extra);
      for (const passo of [null, { vcVistaCt: 'meses' }, { vcAjuda: '' }, { vcFiltros: '' }, { vcHistCh: '' }, { vcFormAbrir: aba === 'churn' ? 'churn' : 'contrato', vcCli: aba === 'churn' ? '3' : '1', vcOnde: 'lista' }]) {
        if (passo) clicar(passo);
        const html = janela.innerHTML;
        assert.doesNotMatch(html, /R\$|4\.200|2\.200|4,2 mil|2,2 mil/, `${nome}, ${aba}: sem valor em reais`);
        assert.doesNotMatch(html, /Por mês<\/span>|Receita perdida|ticket|Maior valor|Maior receita|data-espiar=/i, `${nome}, ${aba}: sem coluna, número, ordem ou espiada de dinheiro`);
        assert.doesNotMatch(html, /class="vc-form"|name="valor_mensal"|name="receita_mensal"|Registrar contrato<\/button>|Registrar saída<\/button>/, `${nome}, ${aba}: sem formulário de valor`);
      }
    }
  }
  // O dono, fora do "ver como", segue vendo.
  const dono = await abrirTela('contratos', { ...BASE, pode: { ...BASE.pode, ver_dinheiro: true } }, { sessionStorage: { getItem: () => null }, TEAM_USERS: [] });
  assert.match(dono.janela.innerHTML, /R\$\s4\.200/);
  assert.match(js, /const veDinheiro = \(\) => estado\.servidor\?\.pode\?\.ver_dinheiro !== false && !vendoComoSemDinheiro\(\);/);
  assert.match(js, /S\(\)\.contratos\(\{ clientes: clientesM\(\), contratos: contratosM\(\),/);
  assert.match(js, /S\(\)\.churn\(\{ clientes: base0, registros, contratos: contratosM\(\),/);
});
