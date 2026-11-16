// Padrão V2 · Finanças (16/11/2026): o molde comum (prancha V2-M-Financas-Modelo) em Recebimentos, Contas a pagar e
// Inadimplência. Roda vybe-mundo-financeiro.js (o molde) e vybe-mundo-financas.js (as telas) num vm, sem navegador nem
// servidor nem banco. SAFE. Sem o molde carregado, as telas saem como antes (padrao-v2-financas.test.mjs cobre esse caminho).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (a) => readFileSync(new URL('../' + a, import.meta.url), 'utf8');
const CORE = ler('vybe-core.js');
const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
const HOJE = '2026-11-12';
function carregar() {
  const window = {}, ctx = vm.createContext({ window, console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout });
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  vm.runInContext(ler('shared/financeiro-extrato.js'), ctx);
  vm.runInContext(ler('vybe-mundo-financeiro.js'), ctx);
  vm.runInContext(ler('vybe-mundo-financas.js'), ctx);
  return window;
}
const naOrdem = (html, partes) => { const pos = partes.map((x) => html.indexOf(x)); assert.ok(pos.every((p, i) => p > -1 && (i === 0 || p > pos[i - 1])), 'fora de ordem: ' + JSON.stringify(partes.map((x, i) => [x, pos[i]]))); };
const laranjas = (html) => (html.match(/class="d3m-laranja/g) || []).length;
const comum = (html, tela, aba, titulo) => {
  naOrdem(html, [`class="fv2 fx d3f d3m-d-fx d3m-d-fm" data-tela="${tela}"`, `<h1>${titulo}</h1>`, 'class="d3-selo-donos"', 'só donos', 'data-fx="buscar"', 'data-v2="ajuda"', 'class="d3m-d-folha d3m-d-fm-folha', 'class="d3m-d-fm-olho"', 'De olho',
    'class="d3m-lado d3m-d-fx-lado d3m-d-fm-lado"', `class="d3m-vlin" data-fx="ir-aba" data-valor="${aba}" aria-current="page"`]);
  assert.doesNotMatch(html, /class="d3-acao"|d3f-nums|fv2-topo/, `${tela}: o bloco de ação, os números e o topo antigos saíram`);
  assert.doesNotMatch(html, /—/, `${tela}: sem travessão`);
};
const fatura = (id, nome, valor, vencimento, extra = {}) => ({ id: String(id), tipo: 'recorrente', cliente_id: String(id), cliente_nome: nome, descricao: '', categoria: '', ciclo: 'mensal', valor, valor_recebido: 0,
  vencimento, recebido_em: null, cancelado: false, status: 'pendente', aberto: valor, atraso: 0, ...extra });
const RECEBIMENTOS = () => ({ hoje: HOJE, fonte: 'Vybe OS', periodo: { tipo: 'mensal', mes: '2026-11' }, resumo: { atual: { a_receber: 12000, recebido: 3000, pendente: 9000, inadimplente: 0 }, variacao: {} },
  recebiveis: [fatura(1, 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 }), fatura(2, 'Cliente A', 4200, '2026-11-24'),
    fatura(3, 'Cliente D', 3000, '2026-11-05', { status: 'recebido', aberto: 0, valor_recebido: 3000, recebido_em: '2026-11-05', forma: 'pix' }), fatura(4, 'Cliente E', 1000, '2026-11-20', { cancelado: true, status: 'cancelado', aberto: 0 })] });

test('Recebimentos no molde: grupos Agora, A vencer e Recebida; Recebi na linha; De olho; laranja só com atraso', () => {
  const w = carregar(), d = RECEBIMENTOS();
  let html = w.VybeFinancas.telas.recebimentos({ d, filtro: {}, atrasadas: [d.recebiveis[0]] });
  comum(html, 'rec', 'recebimentos', 'Recebimentos');
  naOrdem(html, ['data-vc-mes-ir="2026-10"', 'data-vc-periodo="mensal"', 'data-vc="recebivel"', 'Faturas de novembro', 'data-fv="chip" data-tela="rec" data-valor="todas" aria-pressed="true">Todas<span>3</span>',
    'data-linha="1"', '>Agora</span>', 'Cliente B', 'atrasada há 9 dias', 'data-fv="receber" data-valor="1"', 'data-linha="2"', '>A vencer</span>', 'data-linha="3"', '>Recebida</span>', 'recebida em 05/11, por Pix',
    'R$ 3 mil</b> recebido', 'em atraso', 'class="d3m-laranja d3m-d-fm-lar"', 'fatura em atraso']);
  assert.equal(laranjas(html), 1);
  assert.ok(!html.includes('data-linha="4"'), 'a cancelada fica no filtro dela');
  // Sem atraso, sem laranja: a tela sem pendência fica sem laranja.
  const semAtraso = RECEBIMENTOS(); semAtraso.recebiveis = semAtraso.recebiveis.slice(1);
  html = w.VybeFinancas.telas.recebimentos({ d: semAtraso, filtro: {}, atrasadas: [] });
  assert.equal(laranjas(html), 0);
  // Pelo extrato, lançar é pelo Vorcaro e a baixa é no Extrato.
  html = w.VybeFinancas.telas.recebimentos({ d: { ...RECEBIMENTOS(), fonte: 'Extrato do banco', recebiveis: [fatura('ext:1', 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 })] }, filtro: {}, atrasadas: [] });
  assert.match(html, /data-fv="ir" data-valor="vorcaro" data-mao="pago"/);
  assert.match(html, /pelo extrato<\/small>/);
  assert.doesNotMatch(html, /data-fv="receber"/);
});

test('Contas a pagar no molde: vencida em Agora com Paguei, A pagar, Pagas, fichas por grupo e o laranja da vencida', () => {
  const w = carregar();
  const conta = (id, descricao, grupo, valor, vencimento, pago_em = null) => ({ id: String(id), descricao, grupo, valor, vencimento, pago_em, cancelada: false, fornecedor_nome: '' });
  const d = { hoje: HOJE, periodo: { tipo: 'mensal', mes: '2026-11' }, faturamento: 9600, grupos: [{ id: 'fixa', nome: 'Fixas' }, { id: 'variavel', nome: 'Variáveis' }],
    contas: [conta(1, 'Aluguel da sala', 'fixa', 1200, '2026-11-05'), conta(2, 'Internet', 'fixa', 159.9, '2026-11-20'), conta(3, 'Freela', 'variavel', 1200, '2026-11-10', '2026-11-10')],
    resumo: { total: 2559.9, pago: 1200, a_pagar: 1359.9, resultado: 7040.1, vencidas: { quantidade: 1, total: 1200 }, sete_dias: { quantidade: 0, total: 0, contas: [] }, grupos: [{ id: 'fixa', nome: 'Fixas', total: 1359.9, percentual_faturamento: 14.2 }, { id: 'variavel', nome: 'Variáveis', total: 1200 }] } };
  const html = w.VybeFinancas.telas.contas({ d, filtro: {} });
  comum(html, 'con', 'contas', 'Contas a pagar');
  naOrdem(html, ['data-vc="conta"', 'Contas de novembro', '>Todas<span>3</span>', '>A pagar<span class="r">2</span>', '>Pagas<span>1</span>', '>Fixas<span>2</span>',
    'data-linha="c1"', '>Agora</span>', 'Aluguel da sala', 'venceu há 7 dias', 'data-fv="pagar" data-valor="1"', '>A pagar</span>', 'vence em 8 dias', '>Pagas</span>', 'paga em 10/11',
    'R$ 1,2 mil</b> pago', '14,2%</b> do que entra vai nas fixas', 'resultado do mês', 'venceu e não saiu', 'd3m-lar-num">7 dias', 'Aluguel da sala vencida', 'class="d3m-btn l" data-fv="pagar" data-valor="1">Paguei']);
  assert.equal(laranjas(html), 1);
});

test('Inadimplência no molde: clientes com a barra dos dias, sócio e Ver; Régua de avisos; laranja com o mais antigo', () => {
  const w = carregar();
  const d = { hoje: HOJE, total: 7300, clientes: [{ cliente_id: '1', cliente_nome: 'Cliente B', atraso_mais_antigo: 40, vencimento_mais_antigo: '2026-10-03', faturas: 2, valor: 5000 },
    { cliente_id: '2', cliente_nome: 'Cliente C', atraso_mais_antigo: 12, vencimento_mais_antigo: '2026-10-31', faturas: 1, valor: 2300 }], faturas: [], marcados_a_mao: [] };
  const html = w.VybeFinancas.telas.inadimplencia({ d, filtro: {} });
  comum(html, 'ina', 'inadimplencia', 'Inadimplência');
  naOrdem(html, ['data-fv="ir" data-valor="recebimentos">Ver recebimentos', '2 clientes em atraso', '>Críticos<span class="r">1</span>', 'data-linha="k1"', 'Cliente B', 'class="d3m-d-fm-dias r"', '--v:100%', '40 dias', 'R$ 5.000',
    'data-linha="k2"', 'class="d3m-d-fm-dias a"', 'R$ 7,3 mil</b> em atraso', 'Régua de avisos', 'o sócio do cliente', 'os quatro sócios', 'crítico',
    'class="d3m-laranja d3m-d-fm-lar"', 'Vorcaro · o mais antigo', 'd3m-lar-num">40 dias', 'de atraso de Cliente B', 'class="d3m-btn l" data-fv="linha" data-tela="ina" data-valor="k1"']);
  assert.equal(laranjas(html), 1);
  const vazio = w.VybeFinancas.telas.inadimplencia({ d: { hoje: HOJE, total: 0, clientes: [], faturas: [], marcados_a_mao: [] }, filtro: {} });
  assert.equal(laranjas(vazio), 0, 'ninguém em atraso, nenhum laranja');
  assert.match(vazio, /Ninguém em atraso\./);
});

test('molde: CSS só com tokens d3 e sem o que é proibido', () => {
  const css = ler('padrao-v2/zm-d-financas.css');
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\([^)]*\[style/);
  assert.doesNotMatch(css.replace(/rgba?\([^)]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b(?![\w-])(?=[;}\s,)])/, 'cor só por token');
  assert.match(ler('vybe-mundo-padrao-v2.css'), /padrao-v2\/zm-d-financas\.css/);
});

// O botão da linha (Conferir no Extrato, Recebi, Paguei, Ver): a regra antiga de financeiro.css (#vv-comercial .fx-ok) faz
// dele um círculo de 30 px, e o texto saía cortado na beirada ("Confe"). No molde a regra do botão pesa mais e devolve a
// largura do texto. Se alguém tirar o width:auto ou baixar o peso do seletor, o corte volta.
test('molde: o botão da linha não herda o círculo de 30 px do .fx-ok antigo', () => {
  const css = ler('padrao-v2/zm-d-financas.css').replace(/\r\n/g, '\n');
  const regra = css.split('\n').find((l) => l.startsWith('#vv-comercial .fv2.d3m-d-fm :is(.v2c-btn,.fv2-btn,.fv2-btn.s){'));
  assert.ok(regra, 'a regra do botão do molde existe, com #vv-comercial e as duas classes da janela');
  assert.match(regra, /width:auto/);
  assert.match(regra, /border-radius:var\(--d3-r-botao\)/);
  assert.match(regra, /padding:0 10px/);
  assert.match(ler('padrao-v2/financeiro.css'), /#vv-comercial \.fx-ok\{[^}]*width:30px/, 'a regra antiga continua lá: o molde precisa vencê-la');
  const js = ler('vybe-mundo-financeiro.js');
  assert.match(js, /class="fv2-btn s fx-ok" data-fx="conferir"/, 'o Conferir do Extrato é um fv2-btn: pega a regra do molde');
  assert.match(js, /COLS_EXTRATO = \[[^\n]*\[96, ''\]\];/, 'a coluna do Conferir tem 96 px, o bastante para o texto inteiro');
});
