// Padrão v2 · Finanças: as telas Recebimentos, Contas a pagar, Inadimplência e a Visão geral pelos quadros do moodboard.
// Roda vybe-mundo-financas.js num vm, sem navegador nem servidor. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync(new URL('../vybe-mundo-financas.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../padrao-v2/financas.css', import.meta.url), 'utf8');
const HOJE = '2026-11-12';
function carregar() {
  const window = {}, ctx = vm.createContext({ window, console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout });
  vm.runInContext(FONTE, ctx);
  return window.VybeFinancas;
}
const fatura = (id, nome, valor, vencimento, extra = {}) => ({ id: String(id), tipo: 'recorrente', cliente_id: String(id), cliente_nome: nome, descricao: '', categoria: '', ciclo: 'mensal', valor, valor_recebido: 0,
  vencimento, recebido_em: null, cancelado: false, status: 'pendente', aberto: valor, atraso: 0, ...extra });
const RECEBIMENTOS = () => ({ hoje: HOJE, fonte: 'Vybe OS', periodo: { tipo: 'mensal', mes: '2026-11' }, resumo: { atual: { a_receber: 12000, recebido: 3000, pendente: 9000, inadimplente: 0, quantidade: 4 }, variacao: { recebido: 8.4 } },
  recebiveis: [fatura(1, 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 }), fatura(2, 'Cliente A', 4200, '2026-11-24'),
    fatura(3, 'Cliente D', 3000, '2026-11-05', { status: 'recebido', aberto: 0, valor_recebido: 3000, recebido_em: '2026-11-05' }), fatura(4, 'Cliente E', 1000, '2026-11-20', { cancelado: true, status: 'cancelado', aberto: 0 })] });
const DE_OUTUBRO = fatura(9, 'Cliente A', 4200, '2026-10-25', { status: 'atrasado', atraso: 18 });

test('telas publicadas, sem travessão em texto de tela', () => {
  const t = carregar().telas;
  for (const k of ['recebimentos', 'contas', 'inadimplencia', 'visao']) assert.equal(typeof t[k], 'function', k);
  assert.ok(!/—/.test(FONTE.slice(FONTE.indexOf('Telas do padrão v2'))), 'sem travessão nas telas novas');
});

test('Recebimentos: ordem do quadro, três números, fichas, Pede ação com Recebi e a lista sem repetir as atrasadas', () => {
  const html = carregar().telas.recebimentos({ d: RECEBIMENTOS(), filtro: {}, atrasadas: [DE_OUTUBRO, RECEBIMENTOS().recebiveis[0]] });
  const ordem = ['fv2-topo', 'fv2-fala', 'fv2-kpis', 'fv2-filtros', 'data-fv-card="acao"', 'uma linha por fatura'].map((x) => html.indexOf(x));
  assert.ok(ordem.every((p, i) => p > -1 && (i === 0 || p > ordem[i - 1])), 'cabeçalho, fala, números, filtro, Pede ação e lista, nesta ordem: ' + ordem);
  assert.equal(html.match(/class="fv2-kpi[ "]/g).length, 3);
  assert.equal(html.match(/fv2-btn p"/g).length, 1, 'uma ação laranja');
  assert.match(html, /Vorcaro · Financeiro<\/span>Entraram <b>R\$ 3 mil<\/b> dos R\$ 12 mil de novembro\. <b>2 faturas estão em atraso<\/b>, uma de outubro\./);
  assert.match(html, /data-vc-busca="rec"/); assert.match(html, /data-vc="recebivel">Novo recebimento/); assert.match(html, /data-vc-periodo="anual"/); assert.match(html, /data-vc-mes-ir="2026-10"/);
  assert.match(html, /data-vc-mes-ir="2026-12"[^>]*disabled/, 'não passa do mês de hoje');
  assert.match(html, /aria-pressed="true">Todas · 3</); assert.match(html, /Em atraso · 1</); assert.match(html, /Recebidas · 1</);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('uma linha por fatura'));
  assert.match(acao, /18 dias[\s\S]*mensalidade de outubro, R\$ 4\.200[\s\S]*data-fv="receber" data-valor="9" data-total="4200">Recebi</);
  assert.match(acao, /Ver em outubro/, 'a de outro mês leva ao mês dela, sem editar por aqui');
  assert.match(acao, /data-vc="cancelar-rec" data-id="1"/, 'a do período continua com editar e cancelar');
  const lista = html.slice(html.indexOf('uma linha por fatura'));
  assert.doesNotMatch(lista, /data-linha="1"/, 'a atrasada do período está só no Pede ação');
  assert.match(lista, /vence dia 24/); assert.match(lista, /Recebido em 05\/11/); assert.doesNotMatch(lista, /Cliente E/, 'cancelada só em Filtros');
});

test('Recebimentos: mês vazio fica uma linha com o botão de lançar; lançamento do Vybe Finanças não ganha Recebi', () => {
  const F = carregar(), vazio = F.telas.recebimentos({ d: { hoje: HOJE, periodo: { tipo: 'mensal', mes: '2026-11' }, resumo: { atual: {} }, recebiveis: [] }, filtro: {}, atrasadas: [] });
  assert.match(vazio, /fv2-vz[\s\S]*Nenhum recebimento neste período[\s\S]*data-vc="recebivel">Lançar o primeiro/); assert.doesNotMatch(vazio, /fv2-grade/);
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
test('Contas a pagar: Pede ação com Paguei, a fatia do que já saiu por grupo e o resultado do mês', () => {
  const F = carregar(), html = F.telas.contas({ d: CONTAS(), filtro: {} });
  assert.match(html, /Já saíram <b>R\$ 12 mil<\/b> dos R\$ 14,4 mil de novembro\. <b>1 conta venceu sem pagar<\/b> e 1 vence em 7 dias\./);
  assert.match(html, /Resultado do mês[\s\S]*R\$ 5,6 mil[\s\S]*faturamento a receber R\$ 20 mil, menos as contas/);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('Para onde vai o dinheiro'));
  assert.ok(acao.indexOf('ISS') < acao.indexOf('Internet e telefone'), 'a vencida antes da que vence');
  assert.match(acao, /2 dias[\s\S]*<b>ISS<\/b> · imposto, R\$ 2\.000[\s\S]*data-fv="pagar" data-valor="4">Paguei</); assert.match(acao, /Amanhã/);
  const onde = html.slice(html.indexOf('Para onde vai o dinheiro'));
  assert.match(onde, /<b>Fixas<\/b> · 2 contas[\s\S]*--v:25%[\s\S]*R\$ 3 de 3,4 mil pagos[\s\S]*falta R\$ 389/); assert.match(onde, /<b>Folha<\/b> · 1 conta[\s\S]*--v:75%[\s\S]*tudo pago/);
  assert.match(onde, /Variáveis, Investimentos: nada lançado\./); assert.doesNotMatch(onde, /data-linha="gvariavel"/, 'grupo sem conta não ganha linha');
  assert.match(onde, /data-vc="conta" data-id="2">Editar/, 'as contas continuam editáveis dentro do grupo');
  // A janela entrega o faturamento como objeto vazio quando a resposta passa pelo completar(): a conta sai do resultado.
  const d = CONTAS(); d.faturamento = {};
  assert.match(F.telas.contas({ d, filtro: {} }), /faturamento a receber R\$ 20 mil/);
  // A ficha de um grupo mostra só ele, aberto.
  F.telas._teste.ui.con.chip = 'imposto';
  const so = F.telas.contas({ d: CONTAS(), filtro: {} });
  assert.match(so, /data-linha="gimposto" aria-expanded="true"/); assert.doesNotMatch(so, /data-linha="gfixa"/);
});

test('Inadimplência: três números, cliente com Recebi de um toque e a régua pelas faixas que o sistema tem', () => {
  const faturas = [DE_OUTUBRO, fatura(1, 'Cliente B', 3800, '2026-11-03', { status: 'atrasado', atraso: 9 })];
  const d = { hoje: HOJE, fonte: 'Vybe OS', faturas, total: 8000, criticos: 0, marcados_a_mao: [{ cliente_id: '5', cliente_nome: 'Cliente E', status_pagamento: 'atrasado' }],
    clientes: faturas.map((f) => ({ cliente_id: f.cliente_id, cliente_nome: f.cliente_nome, valor: f.aberto, faturas: 1, atraso_mais_antigo: f.atraso, vencimento_mais_antigo: f.vencimento })) };
  const F = carregar(), html = F.telas.inadimplencia({ d, filtro: {}, admin: false });
  assert.match(html, /<b>R\$ 8 mil<\/b> em atraso de 2 clientes; o mais antigo há 18 dias\. Ninguém passou de 30 dias\./);
  assert.match(html, /O mais antigo[\s\S]*18 dias[\s\S]*venceu em 25 de outubro/); assert.match(html, /Até 7 dias · 0</); assert.match(html, /8 a 30 dias · 2</);
  assert.match(html, /Clientes em atraso[\s\S]*data-fv="receber" data-valor="9"[\s\S]*data-vc="receber" data-id="9">Recebi uma parte/);
  assert.match(html, /Régua do atraso/); assert.equal(html.match(/class="fv2-pt /g).length, 2, 'uma bolinha por cliente');
  assert.doesNotMatch(html, /Avisar o sócio|Régua de avisos/, 'o aviso aos sócios não existe no sistema: a tela não promete');
  assert.doesNotMatch(html, /ver o que falta/, 'o que falta ligar é só para quem administra');
  assert.match(html, /data-vc="ajuda">Como funciona/); assert.match(html, /data-fv="ir" data-valor="recebimentos">Ver recebimentos/);
  assert.match(F.telas.inadimplencia({ d: { hoje: HOJE, clientes: [], faturas: [], marcados_a_mao: [] }, filtro: {} }), /fv2-vz[\s\S]*Ninguém em atraso/);
});

test('Finanças (Visão geral): fala com a conta do mês, Entrou, Saiu e Em atraso, Pede ação, Caixa em sete colunas e os atalhos', () => {
  const F = carregar(), rec = RECEBIMENTOS(), con = CONTAS();
  const L = { hoje: HOJE, atual: '2026-11', mes: '2026-11', tipo: 'mensal', vf: { conectado: false }, rec, con, porCliente: { clientes: [{ valor_mensal: 0 }, { valor_mensal: 100 }], resumo: {} },
    ina: { total: 3800, faturas: [rec.recebiveis[0]], clientes: [{ cliente_id: '1', cliente_nome: 'Cliente B', valor: 3800, faturas: 1, atraso_mais_antigo: 9, vencimento_mais_antigo: '2026-11-03' }] },
    cx: { previsao: { meses: [{ mes: '2026-11', entradas: 12000 }, { mes: '2026-12', entradas: 13000 }, { mes: '2027-01', entradas: 11000 }, { mes: '2027-02', entradas: 14000 }] } },
    passados: [['2026-08', 9000], ['2026-09', 10000], ['2026-10', 9500]].map(([mes, recebido]) => ({ mes, dados: { resumo: { atual: { recebido } } } })) };
  const html = F.telas._teste.visaoHtml(L, { subs: [{ id: 'recebimentos', nome: 'Recebimentos' }, { id: 'vybe-financas', nome: 'Vybe Finanças', url: 'https://exemplo.invalid' }] });
  assert.match(html, /Vorcaro · Tesouraria<\/span>Novembro fecha com <b>R\$ 2,4 mil no vermelho<\/b> se a fatura em atraso for paga\. Sem ela, faltam <b>R\$ 6,2 mil<\/b>\./);
  assert.match(html, /Entrou[\s\S]*R\$ 3 mil[\s\S]*25% dos R\$ 12 mil previstos/); assert.match(html, /Saiu[\s\S]*R\$ 12 mil[\s\S]*Folha 63%/); assert.match(html, /Em atraso[\s\S]*R\$ 3,8 mil[\s\S]*o mais antigo há 9 dias/);
  assert.match(html, /data-fv="per" data-valor="anterior" aria-pressed="false">Outubro</); assert.match(html, /aria-pressed="true">Novembro</); assert.match(html, /data-fv="lancar"[^>]*>Lançar</);
  const acao = html.slice(html.indexOf('data-fv-card="acao"'), html.indexOf('data-fv-card="caixa"'));
  assert.match(acao, /5 coisas, na ordem/); assert.match(acao, /data-fv="receber" data-valor="1"/); assert.match(acao, /data-fv="pagar" data-valor="4"/); assert.match(acao, /Controle financeiro/); assert.match(acao, /<b>1 cliente<\/b> sem contrato informado/);
  assert.doesNotMatch(acao, /data-vc=/, 'fora da janela do Comercial não há formulário: a linha leva à tela');
  assert.equal(html.match(/class="fv2-col /g).length, 7); assert.equal(html.match(/fv2-col antes/g).length, 3); assert.equal(html.match(/fv2-col depois/g).length, 3); assert.match(html, /fv2-col agora[^>]*><i style="--h:86%"/);
  assert.match(html, /Abrir:[\s\S]*data-valor="recebimentos">Recebimentos[\s\S]*Vybe Finanças ↗[\s\S]*data-valor="caixa">Caixa[\s\S]*data-valor="rh">Folha/);
  assert.match(html, /Ver a conta[\s\S]*Previsto para entrar<\/dt><dd>R\$ 12\.000[\s\S]*Resultado previsto<\/dt><dd>-R\$ 2\.389/);
});

test('CSS do grupo: sem !important, sem html body.mundo, movimento para com "Reduzir movimento" e cabe no celular', () => {
  assert.doesNotMatch(CSS, /!important/); assert.doesNotMatch(CSS, /html body\.mundo/);
  assert.match(CSS, /prefers-reduced-motion:reduce/); assert.match(CSS, /@container fv2 \(max-width:560px\)/);
  assert.match(CSS, /\.fv2-chip\[aria-pressed="true"\]\{background:#1F1D1A;color:#FFFFFF/); assert.match(CSS, /\.fv2-btn\.p\{background:#C2490C/);
  assert.match(CSS, /:is\(\.fv2-card,\.fv2-fala,\.fv2-kpi\)\{[^}]*border-radius:20px;background:#FFFFFF/);
});
