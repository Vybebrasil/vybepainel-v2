// server/financeiro-fonte.js — as telas antigas de Finanças lendo o extrato do banco (Paulo, 14/11/2026: "o financeiro
// você não vai puxar os dados do Vybe Finanças; os dados são só o histórico dos 3 meses que mandei do banco").
//
// Funções puras (sem banco, sem rede). Transformam o que o Financeiro guarda (server/financeiro.js: extrato com o lado
// real, gastos fixos, cartão) e os clientes com a mensalidade do contrato do Vybe OS numa "base" no formato que as contas
// de shared/financas-calculos.js já sabem resumir. Assim Visão geral, Recebimentos, Contas a pagar, Inadimplência, Caixa,
// Por cliente, a Gestão e a Folha do RH mostram os números do extrato, sem tocar no Vybe Finanças.
//
// Regras:
//  - Realizado = o extrato (lado real: categoria, cliente, partes e status de cada pedaço). Pedaço "nao_pago" ou
//    "em_aberto" é previsto, não realizado.
//  - Receita = categorias dos grupos Receitas e Receitas financeiras. Aporte de sócio e empréstimo recebido mexem no
//    caixa mas não são receita (ficam como transferência). Pagar o cartão da agência é saída (como na projeção do
//    extrato): os itens da fatura são o detalhe e não entram de novo.
//  - Previsto a receber = a mensalidade do contrato do Vybe OS (só donos), mês a mês, do primeiro mês do extrato até o
//    mês atual. O que o extrato não mostrou entrar (por competência) vira a fatura em aberto daquele mês, com vencimento
//    no último dia do mês (o extrato não traz o dia do vencimento). Antes do primeiro mês do extrato não há como saber.
//  - A pagar = gastos fixos do mês que ainda não apareceram no extrato (os do cartão saem pela fatura) e o que falta
//    pagar das faturas do cartão.
//  - Folha = o que saiu no extrato como salário e pró-labore, por pessoa (o extrato não guarda o salário combinado).
//  - Faturas emitidas, assinaturas e contratos do Finanças não existem aqui: o que não tem fonte fica vazio.
import X from '../shared/financeiro-extrato.js';
import calc from '../shared/financas-calculos.js';

export const FONTE = 'Extrato do banco';
const CAT = new Map(X.CATEGORIAS.map((c) => [c.id, c]));
const RECEITA = new Set(['Receitas', 'Receitas financeiras']);
const centavos = (v) => Math.round((Number(v) || 0) * 100);
const reais = (c) => Math.round(c) / 100;
const ehMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
export const fimDoMes = (mes) => { const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)); return d.toISOString().slice(0, 10); };
const idCli = (id) => 'v:' + String(id);
const deCli = (id) => String(id || '').replace(/^v:/, '');

// Meses do primeiro mês do extrato até o mês de hoje (nunca antes do extrato).
function mesesCobertos(lista, hoje) {
  const meses = X.mesesDa(lista), fim = hoje.slice(0, 7);
  if (!meses.length) return [];
  const out = [];
  for (let m = meses[0]; m <= fim && out.length < 60; m = X.somarMeses(m, 1)) out.push(m);
  return out;
}

// base = { extrato: { transacoes }, fixos, cartao, cartoes } (server/financeiro.js) · clientes = clientesComMensalidade().
export function baseDoExtrato(base, clientes = [], { hoje }) {
  const lista = base?.extrato?.transacoes || [];
  const mesHoje = hoje.slice(0, 7);
  const contratos = clientes.filter((c) => c.ativo && Number(c.valor_mensal) > 0)
    .map((c) => ({ cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome, valor_mensal: Number(c.valor_mensal), inicio: c.inicio || '', fim: '' }));
  const comContrato = new Map(contratos.map((c) => [c.cliente_id, c]));
  const nomes = new Map(clientes.map((c) => [String(c.cliente_id), c.cliente_nome]));
  const transacoes = [];
  const marcado = new Map(); // cliente|competência → previsto já marcado no extrato (nao_pago/em_aberto)

  for (const t of lista) for (const p of X.pedacos(t)) {
    const c = CAT.get(p.categoria) || CAT.get('a_classificar');
    const v = Math.abs(centavos(p.valor));
    if (!v) continue;
    let type;
    if (c.tipo === 'entrada') type = RECEITA.has(c.grupo) ? 'INCOME' : 'TRANSFER';
    else if (c.tipo === 'saida' || c.id === 'cartao_agencia') type = 'EXPENSE';
    else type = Number(p.valor) > 0 ? 'INCOME' : 'EXPENSE';
    const status = p.status === 'pago' ? 'PAID' : 'PENDING';
    const cliente = p.cliente_id ? String(p.cliente_id) : '';
    if (cliente && !nomes.has(cliente)) nomes.set(cliente, p.cliente_nome || 'Cliente');
    const ct = type === 'INCOME' && cliente ? comContrato.get(cliente) : null;
    const competencia = ehMes(p.competencia) ? p.competencia : p.data.slice(0, 7);
    if (ct && status === 'PENDING') { const k = cliente + '|' + competencia; marcado.set(k, (marcado.get(k) || 0) + v); }
    transacoes.push({
      id: `${t.id}:${p.parte}`, transacao_id: t.id,
      description: ct ? `Mensalidade - ${ct.cliente_nome}` : String(t.real?.descricao || t.banco.historico || c.nome).slice(0, 160),
      amount: reais(v), type, category: c.nome, categoria_id: c.id,
      // Mensalidade: o mês a que ela se refere manda no "previsto"; o dia em que entrou manda no "recebido".
      date: ct ? fimDoMes(competencia) : p.data, paid_date: status === 'PAID' ? p.data : null, status,
      client_id: cliente && type !== 'TRANSFER' ? idCli(cliente) : null, employee_id: null, quem: p.pessoa_nome || p.quem || '', pessoa_id: p.pessoa_id || '',
    });
  }

  // Previsto pelo contrato: o que falta de cada mês coberto pelo extrato (o mês atual ainda a vencer).
  const meses = mesesCobertos(lista, hoje);
  if (meses.length && contratos.length) {
    const linhas = X.porCliente(lista, contratos, meses, { desde: meses[0], mesAtual: mesHoje });
    for (const l of linhas) {
      const ct = comContrato.get(String(l.cliente_id));
      if (!ct) continue;
      for (const m of l.meses) {
        const falta = centavos(l.mensalidade == null ? 0 : (m.em_aberto || 0) + (m.a_receber || 0)) - (marcado.get(ct.cliente_id + '|' + m.mes) || 0);
        if (falta <= 0) continue;
        transacoes.push({ id: `prev:${ct.cliente_id}:${m.mes}`, description: `Mensalidade - ${ct.cliente_nome}`, amount: reais(falta), type: 'INCOME',
          category: 'Contrato', categoria_id: 'contrato', date: fimDoMes(m.mes), paid_date: null, status: 'PENDING', client_id: idCli(ct.cliente_id), employee_id: null, quem: '' });
      }
    }
  }

  // A pagar no mês: fixos que ainda não saíram (os do cartão vêm pela fatura) e o que falta das faturas do cartão.
  const fixos = Array.isArray(base?.fixos) ? base.fixos : [], itensCartao = Array.isArray(base?.cartao) ? base.cartao : [];
  if (fixos.length) {
    for (const f of X.analisarFixos(fixos, lista, mesHoje, itensCartao).fixos) {
      if (f.achado || f.forma === 'cartao') continue;
      const c = CAT.get(f.categoria) || CAT.get('outra_saida');
      transacoes.push({ id: `fixo:${f.id}:${mesHoje}`, fixo: true, description: f.nome, amount: Number(f.valor) || 0, type: 'EXPENSE', category: c.nome, categoria_id: c.id,
        date: f.vence, paid_date: null, status: 'PENDING', client_id: null, employee_id: null, quem: '' });
    }
  }
  const venc = base?.cartoes && typeof base.cartoes === 'object' ? base.cartoes : {};
  for (const f of X.cartao(itensCartao, lista)) {
    if (!(f.falta > 0) || f.situacao === 'vazia') continue;
    const dia = Number(venc[f.cartao]?.dia) || 0;
    const ult = fimDoMes(f.fatura);
    const vence = dia >= 1 ? `${f.fatura}-${String(Math.min(dia, Number(ult.slice(8, 10)))).padStart(2, '0')}` : ult;
    transacoes.push({ id: `cartao:${f.cartao}:${f.fatura}`, description: `Fatura ${f.cartao} · ${f.fatura.slice(5, 7)}/${f.fatura.slice(0, 4)}`, amount: f.falta, type: 'EXPENSE',
      category: 'Pagar cartão da agência', categoria_id: 'cartao_agencia', date: vence, paid_date: null, status: 'PENDING', client_id: null, employee_id: null, quem: '' });
  }

  return {
    transacoes,
    clientes: [...nomes].map(([id, nome]) => ({ id: idCli(id), name: nome, cnpj: '', monthly_fee: comContrato.get(id)?.valor_mensal || 0, due_day: null,
      // Sem "Ativo": a mensalidade dos meses fora do extrato não vira previsto sozinha (não há como saber se pagou).
      contract_status: '' })),
    vybe: [...nomes].map(([id, nome]) => ({ id, nome, cnpj: '', financas_cliente_id: idCli(id) })),
    assinaturas: fixos.map((f) => ({ id: f.id, name: f.nome, cost: Number(f.valor) || 0, renewal_day: Number(f.dia) || null, active: X.fixoVigente(f, mesHoje) })),
    contratos, meses: X.mesesDa(lista), lancamentos: lista.length,
  };
}

// Recebíveis e contas no formato das abas do Comercial (ids "ext:…": a baixa é no Extrato, não aqui).
export function lancamentosDaBase(b) {
  const ligacao = calc.ligarClientes(b.clientes, b.vybe), nomeFin = Object.fromEntries(b.clientes.map((c) => [c.id, c.name]));
  const ext = (x) => ({ ...x, id: String(x.id).replace(/^fin:/, 'ext:'), fonte: 'extrato' });
  const porId = new Map(b.transacoes.map((t) => [String(t.id), t]));
  const recebiveis = calc.recebiveisDoFinancas(b.transacoes, ligacao.porFinancas, nomeFin, b.vybe).map((r) => {
    const t = porId.get(String(r.id).slice(4));
    return { ...ext(r), categoria: r.tipo === 'recorrente' ? 'Contrato' : r.categoria, transacao_id: t?.transacao_id || null };
  });
  const contas = calc.contasDoFinancas(b.transacoes).map((c) => {
    const t = porId.get(String(c.id).slice(4));
    return { ...ext(c), grupo: t?.fixo && c.grupo !== 'folha' ? 'fixa' : c.grupo, fornecedor_nome: t?.quem || c.fornecedor_nome, transacao_id: t?.transacao_id || null };
  });
  const porVybe = Object.fromEntries(b.contratos.map((c) => [c.cliente_id, { valor_mensal: c.valor_mensal, status: 'Ativo' }]));
  return { recebiveis, contas, porVybe };
}

// Folha do mês pelo extrato: salário e pró-labore que saíram, por pessoa.
export function folhaDaBase(b, mes) {
  const doMes = (m) => {
    const por = new Map();
    for (const t of b.transacoes) {
      if (t.type !== 'EXPENSE' || t.status !== 'PAID' || calc.grupoDaDespesa(t) !== 'folha' || calc.dataCaixa(t).slice(0, 7) !== m) continue;
      const nome = t.quem || 'Sem nome', chave = t.pessoa_id ? 'p:' + t.pessoa_id : 'n:' + nome;
      const x = por.get(chave) || { nome, pessoa_id: t.pessoa_id || '', cargo: t.category, total: 0, dia: null };
      x.total += centavos(t.amount); x.dia = Number(calc.dataCaixa(t).slice(8, 10)); por.set(chave, x);
    }
    return por;
  };
  const atual = doMes(mes), antes = doMes(X.somarMeses(mes, -1));
  const tot = (m) => [...m.values()].reduce((s, x) => s + x.total, 0);
  const total = tot(atual), anterior = tot(antes);
  const funcionarios = [...atual.values()].map((x) => {
    const tb = antes.get(x.pessoa_id ? 'p:' + x.pessoa_id : 'n:' + x.nome)?.total || 0;
    return { id: x.pessoa_id || x.nome, pessoa_id: x.pessoa_id || null, nome: x.nome, cargo: x.cargo, salario: reais(x.total), bonus: 0, total: reais(x.total), dia_pagamento: x.dia, vigente_desde: null,
      total_anterior: reais(tb), variacao: reais(x.total - tb), variacao_percentual: tb ? Math.round(((x.total - tb) / tb) * 1000) / 10 : null };
  }).sort((a, z) => z.total - a.total || a.nome.localeCompare(z.nome, 'pt-BR'));
  return { mes, mes_anterior: X.somarMeses(mes, -1), total: reais(total), total_anterior: reais(anterior), variacao: reais(total - anterior),
    variacao_percentual: anterior ? Math.round(((total - anterior) / anterior) * 1000) / 10 : null, quantidade: funcionarios.length, funcionarios };
}

// As partes que a Visão geral (comercial) e a Folha (rh) pediam ao Vybe Finanças, no mesmo formato.
export function parteDaBase(parte, b, { mes, hoje }) {
  const ligacao = calc.ligarClientes(b.clientes, b.vybe);
  const nomeFin = Object.fromEntries(b.clientes.map((c) => [c.id, c.name]));
  const quem = (finId) => { const par = finId ? ligacao.porFinancas[finId] : null;
    return { cliente_id: par ? par.vybe_id : deCli(finId) || null, cliente_nome: par ? par.vybe_nome : finId ? nomeFin[finId] || 'Cliente' : 'Sem cliente', no_vybe: Boolean(par) }; };
  if (parte === 'rh') return { folha: folhaDaBase(b, mes) };
  const folha = folhaDaBase(b, mes);
  const inad = calc.inadimplencia(b.transacoes, hoje);
  return {
    resumo: calc.resumoMes(b.transacoes, b.clientes, mes),
    despesas: calc.despesasPorCategoria(b.transacoes, mes),
    custos_fixos: calc.custosFixos(b.assinaturas),
    folha: { mes: folha.mes, total: folha.total, total_anterior: folha.total_anterior, variacao: folha.variacao, variacao_percentual: folha.variacao_percentual, quantidade: folha.quantidade },
    series: calc.serieMensal(b.transacoes, mes, 12, Math.max(1, b.meses.filter((m) => m <= mes).length)),
    inadimplencia: { ...inad, clientes: inad.clientes.map(({ cliente_id, descricao, ...c }) => ({ ...c, ...quem(cliente_id), descricao: cliente_id ? '' : descricao })) },
    margens: calc.margemPorCliente(b.transacoes, mes, 3).map(({ cliente_id, ...m }) => ({ ...quem(cliente_id), ...m })),
    ligacao: { ligados: ligacao.ligados.length, por_cnpj: 0, por_id: ligacao.ligados.length, sem_par: [], vybe_sem_par: [] },
    meses_extrato: b.meses, lancamentos: b.lancamentos,
  };
}
