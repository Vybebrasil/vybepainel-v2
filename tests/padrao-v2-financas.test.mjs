// Direção 3 · Finanças: Recebimentos, Contas a pagar, Inadimplência e a Visão geral pelos quadros D3 (moodboard 3).
// Roda vybe-mundo-financas.js num vm, com as peças d3 da base (vybe-core.js), sem navegador nem servidor. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync(new URL('../vybe-mundo-financas.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../padrao-v2/financas.css', import.meta.url), 'utf8');
const D3CSS = readFileSync(new URL('../padrao-v2/d3-financas.css', import.meta.url), 'utf8');
const CORE = readFileSync(new URL('../vybe-core.js', import.meta.url), 'utf8');
const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
const HOJE = '2026-11-12';
function carregar() {
  const window = {}, ctx = vm.createContext({ window, console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout });
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  vm.runInContext(FONTE, ctx);
  return window.VybeFinancas;
}
const fatura = (id, nome, valor, vencimento, extra = {}) => ({ id: String(id), tipo: 'recorrente', cliente_id: String(id), cliente_nome: nome, descricao: '', categoria: '', ciclo: 'mensal', valor, valor_recebido: 0,
  vencimento, recebido_em: null, cancelado: false, status: 'pendente', aberto: valor, atraso: 0, ...extra });
const RECEBIMENTOS = () => ({ hoje: HOJE, fonte: 'Vybe OS', periodo: { tipo: 'mensal', mes: '2026-11' }, resumo: { atual: { a_receber: 12000, recebido: 3000, pendente: 9000, inadimplente: 0, quantidade: 4 }, variacao: { recebido: 8.4 } },
  recebiveis: [fatura(1, 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 }), fatura(2, 'Cliente A', 4200, '2026-11-24'),
    fatura(3, 'Cliente D', 3000, '2026-11-05', { status: 'recebido', aberto: 0, valor_recebido: 3000, recebido_em: '2026-11-05' }), fatura(4, 'Cliente E', 1000, '2026-11-20', { cancelado: true, status: 'cancelado', aberto: 0 })] });
const DE_OUTUBRO = fatura(9, 'Cliente A', 4200, '2026-10-25', { status: 'atrasado', atraso: 18 });
const naOrdem = (html, partes) => { const pos = partes.map((x) => html.indexOf(x)); assert.ok(pos.every((p, i) => p > -1 && (i === 0 || p > pos[i - 1])), 'fora de ordem: ' + JSON.stringify(partes.map((x, i) => [x, pos[i]]))); };

test('telas publicadas, sem travessão em texto de tela', () => {
  const t = carregar().telas;
  for (const k of ['recebimentos', 'contas', 'inadimplencia', 'visao']) assert.equal(typeof t[k], 'function', k);
  assert.ok(!/—/.test(FONTE.slice(FONTE.indexOf('Telas de Finanças na Direção 3'))), 'sem travessão nas telas');
});

test('Recebimentos: ordem do quadro D3, selo, bloco de ação, três números, fichas com contagem, Pede ação com Recebi e a tabela', () => {
  const html = carregar().telas.recebimentos({ d: RECEBIMENTOS(), filtro: {}, atrasadas: [DE_OUTUBRO, RECEBIMENTOS().recebiveis[0]] });
  naOrdem(html, ['fv2-topo', 'd3-selo-donos', 'class="d3-acao"', 'd3f-nums', 'fv2-filtros', 'data-fv-card="acao"', 'data-fv-card="lista"']);
  assert.match(html, /class="fv2 d3f" data-tela="rec"/);
  assert.equal(html.match(/class="d3-num[ "]/g).length, 3);
  assert.equal((html.match(/class="d3-acao"/g) || []).length, 1, 'um bloco de ação: o único laranja cheio');
  assert.match(html, /Vorcaro · Financeiro<\/small>2 faturas em atraso, uma ainda de outubro\./);
  assert.match(html, /data-fv="foco" data-valor="acao">Ver as 2</);
  assert.match(html, /R\$ 3 mil<small class="d3f-de"> \/ 12<\/small>/, 'o número com o total ao lado');
  assert.match(html, /data-vc-busca="rec"/); assert.match(html, /data-vc="recebivel">.*Novo recebimento/); assert.match(html, /data-vc-periodo="anual"/); assert.match(html, /data-vc-mes-ir="2026-10"/);
  assert.match(html, /data-vc-mes-ir="2026-12"[^>]*disabled/, 'não passa do mês de hoje');
  assert.match(html, /data-vc="ajuda">Como funciona/);
  assert.match(html, /aria-pressed="true">Todas <b>3<\/b></); assert.match(html, /Em atraso <b class="r">1<\/b>/); assert.match(html, /Recebidas <b class="g">1<\/b>/);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('data-fv-card="lista"'));
  assert.match(acao, /18 dias[\s\S]*Cliente A<\/span> · outubro[\s\S]*R\$ 4\.200[\s\S]*data-fv="receber" data-valor="9" data-total="4200">Recebi</);
  assert.match(acao, /Ver em outubro/, 'a de outro mês leva ao mês dela, sem editar por aqui');
  assert.match(acao, /data-vc="cancelar-rec" data-id="1"/, 'a do período continua com editar e cancelar');
  const lista = html.slice(html.indexOf('data-fv-card="lista"'));
  assert.match(lista, /class="d3f-cab"[\s\S]*Cliente[\s\S]*Tipo[\s\S]*Valor[\s\S]*Situação/);
  assert.doesNotMatch(lista, /data-linha="1"/, 'a atrasada do período está só no Pede ação');
  assert.match(lista, /Vence 24\/11/); assert.match(lista, /Recebido · 05\/11/); assert.doesNotMatch(lista, /Cliente E/, 'cancelada só em Filtros');
  assert.doesNotMatch(html, /A baixa é manual|uma linha por fatura/, 'sem frase explicativa');
});

test('Recebimentos: mês vazio fica uma linha com o botão de lançar; lançamento do Vybe Finanças não ganha Recebi', () => {
  const F = carregar(), vazio = F.telas.recebimentos({ d: { hoje: HOJE, periodo: { tipo: 'mensal', mes: '2026-11' }, resumo: { atual: {} }, recebiveis: [] }, filtro: {}, atrasadas: [] });
  assert.match(vazio, /fv2-vz[\s\S]*Nenhum recebimento neste período[\s\S]*data-vc="recebivel">Lançar o primeiro/); assert.doesNotMatch(vazio, /fv2-grade/);
  assert.match(vazio, /Nada lançado em novembro\./);
  const d = RECEBIMENTOS(); d.recebiveis[0].id = 'fin:77';
  const html = F.telas.recebimentos({ d, filtro: {}, atrasadas: [d.recebiveis[0]] });
  assert.doesNotMatch(html, /data-fv="receber" data-valor="fin:77"/); assert.match(html, /baixa no Vybe Finanças/);
});

const CONTAS = () => {
  const c = (id, grupo, descricao, valor, vencimento, pago_em = null) => ({ id: String(id), grupo, descricao, fornecedor_nome: null, valor, vencimento, pago_em, cancelada: false });
  const contas = [c(1, 'fixa', 'Aluguel', 3000, '2026-11-05', '2026-11-05'), c(2, 'fixa', 'Internet e telefone', 389, '2026-11-13'), c(3, 'folha', 'Folha do mês', 9000, '2026-11-05', '2026-11-05'), c(4, 'imposto', 'ISS', 2000, '2026-11-10')];
  return { hoje: HOJE, fonte: 'Vybe OS', periodo: { tipo: 'mensal', mes: '2026-11' }, faturamento: 20000, contas, grupos: [],
    resumo: { grupos: [['fixa', 'Fixas', 3389], ['variavel', 'Variáveis', 0], ['folha', 'Folha', 9000], ['imposto', 'Impostos', 2000], ['investimento', 'Investimentos', 0]].map(([id, nome, total]) => ({ id, nome, total, percentual_faturamento: 10, variacao: null })),
      total: 14389, pago: 12000, a_pagar: 2389, sete_dias: { quantidade: 1, total: 389, contas: [contas[1]] }, vencidas: { quantidade: 1, total: 2000 }, resultado: 5611 } };
};
test('Contas a pagar: Pede ação com Paguei e as já pagas, a fatia do que já saiu por grupo e o resultado do mês', () => {
  const F = carregar(), html = F.telas.contas({ d: CONTAS(), filtro: {} });
  assert.match(html, /1 conta venceu sem pagar\. 1 vence em 7 dias\./);
  assert.match(html, /Resultado do mês[\s\S]*R\$ 5,6 mil[\s\S]*R\$ 20 mil − contas/);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('data-fv-card="grupos"'));
  assert.ok(acao.indexOf('ISS') < acao.indexOf('Internet e telefone'), 'a vencida antes da que vence');
  assert.match(acao, /2 dias[\s\S]*<b>ISS<\/b> · imposto[\s\S]*R\$ 2\.000[\s\S]*data-fv="pagar" data-valor="4">Paguei</); assert.match(acao, /Amanhã/);
  assert.match(acao, /Já pagas[\s\S]*Aluguel · 05\/11[\s\S]*Folha do mês · 05\/11/);
  const onde = html.slice(html.indexOf('data-fv-card="grupos"'));
  assert.match(onde, /Grupo[\s\S]*Já saiu[\s\S]*Pago[\s\S]*Falta/);
  assert.match(onde, /<b>Fixas<\/b> <span class="d3f-mes">· 2 contas[\s\S]*--v:25%[\s\S]*R\$ 3 de 3,4 mil[\s\S]*fv2-pill a">R\$ 389/); assert.match(onde, /<b>Folha<\/b>[\s\S]*--v:75%[\s\S]*Tudo pago/);
  assert.match(onde, /d3f-zero" data-grupo="variavel"/, 'grupo sem conta fica na tabela, apagado e sem abrir'); assert.doesNotMatch(onde, /data-linha="gvariavel"/);
  assert.match(onde, /data-vc="conta" data-id="2">Editar/, 'as contas continuam editáveis dentro do grupo');
  const d = CONTAS(); d.faturamento = {};
  assert.match(F.telas.contas({ d, filtro: {} }), /R\$ 20 mil − contas/);
  F.telas._teste.ui.con.chip = 'imposto';
  const so = F.telas.contas({ d: CONTAS(), filtro: {} });
  assert.match(so, /data-linha="gimposto" aria-expanded="true"/); assert.doesNotMatch(so, /data-linha="gfixa"/);
});

test('Inadimplência: três números, cliente com Recebi de um toque, a régua pelas faixas e o atraso por mês em linha', () => {
  const faturas = [DE_OUTUBRO, fatura(1, 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 })];
  const d = { hoje: HOJE, fonte: 'Vybe OS', faturas, total: 8000, criticos: 0, marcados_a_mao: [{ cliente_id: '5', cliente_nome: 'Cliente E', status_pagamento: 'atrasado' }],
    clientes: faturas.map((f) => ({ cliente_id: f.cliente_id, cliente_nome: f.cliente_nome, valor: f.aberto, faturas: 1, atraso_mais_antigo: f.atraso, vencimento_mais_antigo: f.vencimento })) };
  const F = carregar(), html = F.telas.inadimplencia({ d, filtro: {}, admin: false });
  assert.match(html, /2 clientes em atraso; Cliente A há 18 dias\./);
  assert.match(html, /quinta, 12 nov/, 'a data ao lado do título');
  assert.match(html, /O mais antigo[\s\S]*18<small class="d3f-de"> \/ 30 dias[\s\S]*--v:60%[\s\S]*venceu 25\/10/); assert.match(html, /Até 7 dias <b>0</); assert.match(html, /8 a 30 dias <b>2</);
  assert.match(html, /Clientes em atraso[\s\S]*data-fv="receber" data-valor="9"[\s\S]*data-vc="receber" data-id="9">Recebi uma parte/);
  assert.match(html, /Régua do atraso/); assert.equal(html.match(/class="fv2-pt /g).length, 2, 'uma bolinha por cliente');
  assert.match(html, /Em atraso · 6 meses[\s\S]*class="d3-graf"/, 'o atraso por mês do vencimento em linha');
  assert.doesNotMatch(html, /Avisar o sócio|Régua de avisos|Sem aviso/, 'o aviso aos sócios não existe no sistema: a tela não promete');
  assert.doesNotMatch(html, /ver o que falta/, 'o que falta ligar é só para quem administra');
  assert.match(html, /data-vc="ajuda">Como funciona/); assert.match(html, /data-fv="ir" data-valor="recebimentos">Ver recebimentos/);
  assert.match(F.telas.inadimplencia({ d: { hoje: HOJE, clientes: [], faturas: [], marcados_a_mao: [] }, filtro: {} }), /fv2-vz[\s\S]*Ninguém em atraso/);
});

test('Finanças (Visão geral): bloco de ação com a conta, quatro números, Pede ação, Caixa em linha, Saiu por grupo e os atalhos com contagem', () => {
  const F = carregar(), rec = RECEBIMENTOS(), con = CONTAS();
  const fx = { transacoes: [{ banco: { data: '2026-11-10', valor: 6100 }, real: { conferido: false, categoria: 'receita_boleto', partes: [] } }, { banco: { data: '2026-11-11', valor: -300 }, real: { conferido: true, categoria: 'cartao_agencia' } }],
    vorcaro: { propostas: [{ id: 'p1', estado: 'pendente', recebido_em: '2026-11-12T10:00:00Z' }] }, importacoes: [{ ate: '2026-11-12' }] };
  const L = { hoje: HOJE, atual: '2026-11', mes: '2026-11', tipo: 'mensal', vf: { conectado: false }, rec, con, fx, porCliente: { clientes: [{ valor_mensal: 0 }, { valor_mensal: 100 }], resumo: {} },
    ina: { total: 3800, faturas: [rec.recebiveis[0]], clientes: [{ cliente_id: '1', cliente_nome: 'Cliente B', valor: 3800, faturas: 1, atraso_mais_antigo: 9, vencimento_mais_antigo: '2026-11-03' }] },
    cx: { previsao: { meses: [{ mes: '2026-11', entradas: 12000 }, { mes: '2026-12', entradas: 13000 }, { mes: '2027-01', entradas: 11000 }, { mes: '2027-02', entradas: 14000 }] } },
    passados: [['2026-08', 9000], ['2026-09', 10000], ['2026-10', 9500]].map(([mes, recebido]) => ({ mes, dados: { resumo: { atual: { recebido } } } })) };
  F.telas._teste.ui.vis.inteira = true;
  const html = F.telas._teste.visaoHtml(L, { subs: [{ id: 'recebimentos', nome: 'Recebimentos' }, { id: 'extrato', nome: 'Extrato' }, { id: 'vybe-financas', nome: 'Vybe Finanças', url: 'https://exemplo.invalid' }] });
  assert.match(html, /Vorcaro · Tesouraria<\/small>Novembro fica <b>R\$ 2,4 mil<\/b> no vermelho se o atrasado pagar\./);
  assert.match(html, /data-fv="conta" aria-expanded="false">Ver a conta</);
  assert.equal(html.match(/class="d3-num[ "]/g).length, 4);
  assert.match(html, /Entrou[\s\S]*R\$ 3 mil[\s\S]*25% de R\$ 12 mil/); assert.match(html, /Saiu[\s\S]*R\$ 12 mil[\s\S]*Folha 63%/); assert.match(html, /Em atraso[\s\S]*R\$ 3,8 mil[\s\S]*o mais antigo há 9 dias/);
  assert.match(html, /Resultado[\s\S]*sem atrasos · -R\$ 6,2 mil/);
  assert.match(html, /data-fv="per" data-valor="anterior" aria-pressed="false">Outubro</); assert.match(html, /aria-pressed="true">Novembro</); assert.match(html, /data-fv="lancar"[^>]*>.*Lançar</);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('data-fv-card="caixa"'));
  assert.match(acao, /data-fv="receber" data-valor="1"/); assert.match(acao, /data-fv="pagar" data-valor="4"/); assert.match(acao, /Controle financeiro/); assert.match(acao, /<b>1 cliente<\/b> sem contrato informado/);
  assert.match(acao, /Do grupo[\s\S]*1 lançamento<\/b> · Vybe Financeiro[\s\S]*data-valor="vorcaro">Conferir/); assert.match(acao, /1 a conferir<\/b> · 1 boleto a dividir/);
  assert.doesNotMatch(acao, /data-vc=/, 'fora da janela do Comercial não há formulário: a linha leva à tela');
  const caixa = html.slice(html.indexOf('data-fv-card="caixa"'));
  assert.match(caixa, /<svg class="d3-graf d3f-graf"[\s\S]*<polyline class="meta"[\s\S]*<polyline points=/, 'o caixa é uma linha: o realizado cheio e a projeção tracejada');
  assert.doesNotMatch(html, /fv2-col/, 'sem colunas: gráfico em linha');
  assert.match(html, /Saiu por grupo[\s\S]*Folha[\s\S]*63%/);
  assert.match(html, /Abrir<\/span>[\s\S]*data-valor="recebimentos">Recebimentos <b>3<\/b>[\s\S]*data-valor="extrato">Extrato <b class="a">1<\/b>[\s\S]*Vybe Finanças ↗[\s\S]*data-valor="caixa">Caixa[\s\S]*data-valor="rh">Folha/);
  assert.match(html, /Previsto para entrar<\/dt><dd>R\$ 12\.000[\s\S]*Resultado previsto<\/dt><dd>-R\$ 2\.389/);
});

test('CSS do grupo: sem !important, sem html body.mundo, fundo areia, o svg do gráfico livre do tamanho de ícone e movimento que respeita "Reduzir movimento"', () => {
  for (const c of [CSS, D3CSS]) { assert.doesNotMatch(c, /!important/); assert.doesNotMatch(c, /html body\.mundo/); assert.match(c, /prefers-reduced-motion:reduce/); }
  assert.match(CSS, /#vv-comercial\.fv2-casa\{background:var\(--d3-areia/);
  assert.match(CSS, /\.fv2 svg:not\(\.d3-graf\)\{width:14px/);
  assert.match(D3CSS, /\.fv2\.d3f \.fv2-card\{min-height:0;[^}]*border-radius:var\(--d3-r-cartao\);box-shadow:none\}/);
  assert.match(D3CSS, /\.fv2\.d3f \.fv2-btn\.p\{background:var\(--d3-cartao\)/, 'o "Novo" é branco: o laranja cheio é só o bloco de ação');
  assert.match(D3CSS, /@container fv2 \(max-width:560px\)/);
});
