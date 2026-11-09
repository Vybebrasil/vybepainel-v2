// shared/financas-calculos.js — resumos do Vybe Finanças para o Vybe OS (Paulo, 08/11/2026).
//
// Funções puras: não leem DOM, rede nem banco. O servidor (server/vybe-financas-api.js) recebe as linhas cruas do
// Supabase do Vybe Finanças (PostgREST, colunas em snake_case) e devolve à tela só o que sai daqui, já resumido.
// No navegador ficariam em window.VybeFinancasCalculos (hoje só o servidor usa).
//
// ── Definições (seguem src/services do Vybe Finanças) ────────────────────────────────────────────
// Transação: type INCOME | EXPENSE | TRANSFER (transferência entre contas nunca é receita nem despesa);
//   status PAID | PENDING; date = vencimento/previsto; paid_date = dia em que o dinheiro entrou/saiu.
// Data de caixa = paid_date quando PAID e preenchida; senão date (transactionDates.ts getTransactionCashDate).
// Data do filtro = data de caixa se PAID, date se PENDING (getTransactionFilterDate).
// Recebido no mês   = receitas PAID com data de caixa no mês.
// Previsto no mês   = receitas (pagas + pendentes) com date no mês + mensalidade (monthly_fee) dos clientes
//                     com contract_status 'Ativo' que ainda não têm receita lançada no mês (projectedIncomeForMonth).
// Despesas do mês   = despesas pela data do filtro no mês, por categoria, separando pago e pendente.
// Custos fixos      = assinaturas ativas (subscriptions.active), custo mensal.
// Folha do mês      = salário + bônus de cada funcionário vigentes no mês: o registro mais recente de
//                     employee_compensation_history com effective_month <= mês; sem registro, o salary/bonus atual
//                     (employeePayroll.ts getEmployeeCompensationForMonth). Variação = contra o mês anterior.
// Margem por cliente = receitas PAID com client_id (data de caixa) − despesas com client_id (data do filtro, pagas e
//                     pendentes, como o ClientMarginSection do Finanças), no mês e nos 3 meses que terminam nele.
// Série mensal      = faturamento recebido × custos pagos (data de caixa) e ticket médio = receita recebida de
//                     clientes (com client_id) ÷ clientes distintos que pagaram no mês.
// Inadimplência     = receitas PENDING com date antes de hoje, somadas por cliente (o atraso mais antigo manda).
// Ligação de clientes: CNPJ (14 dígitos) quando os dois lados têm; senão o nome normalizado (sem acento, minúsculas,
//   sem pontuação e sem os sufixos ltda/me/eireli), só quando há um único cliente do Vybe OS com aquele nome.
// Dinheiro sempre em centavos inteiros nas contas; a saída volta em reais.
(function (raiz) {
  'use strict';
  const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const reais = (c) => Math.round(c) / 100;
  const pct = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);
  const ehMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
  const dia = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
  function somarMeses(mes, n) {
    const [a, m] = mes.split('-').map(Number), t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }
  const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);
  const ehReceita = (t) => t?.type === 'INCOME';
  const ehDespesa = (t) => t?.type === 'EXPENSE';
  const pago = (t) => t?.status === 'PAID';
  const pendente = (t) => t?.status === 'PENDING';
  const dataCaixa = (t) => (pago(t) && dia(t.paid_date) ? dia(t.paid_date) : dia(t.date));
  const dataFiltro = (t) => (pago(t) ? dataCaixa(t) : dia(t.date));
  const noMes = (iso, mes) => Boolean(iso) && iso.slice(0, 7) === mes;
  const entre = (iso, de, ate) => Boolean(iso) && iso.slice(0, 7) >= de && iso.slice(0, 7) <= ate;

  // ---------- Ligação de clientes (Finanças × Vybe OS) ----------
  // Palavras que não distinguem um cliente: tipo de empresa e "grupo" (Grupo Serra Grande = Serra Grande).
  const SUFIXOS = new Set(['ltda', 'me', 'eireli', 'epp', 'sa', 'grupo']);
  function normalizarNome(s) {
    const base = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return base.split(/\s+/).filter((p) => p && !SUFIXOS.has(p)).join(' ');
  }
  const soDigitos = (v) => String(v || '').replace(/\D+/g, '');
  const cnpjValido = (v) => { const d = soDigitos(v); return d.length === 14 ? d : ''; };
  // fin: [{ id, name, cnpj }] · vybe: [{ id, nome, cnpj }] → { porFinancas: { finId: { vybe_id, vybe_nome, por } }, ligados, sem_par }
  function ligarClientes(fin = [], vybe = []) {
    const porCnpj = new Map(), porNome = new Map();
    for (const v of vybe) {
      const c = cnpjValido(v.cnpj); if (c && !porCnpj.has(c)) porCnpj.set(c, v);
      const n = normalizarNome(v.nome); if (n) porNome.set(n, porNome.has(n) ? null : v); // null = nome repetido no Vybe OS
    }
    const porFinancas = {}, ligados = [], semPar = [];
    for (const f of fin) {
      const c = cnpjValido(f.cnpj);
      let v = c ? porCnpj.get(c) : null, por = v ? 'cnpj' : '';
      if (!v) { v = porNome.get(normalizarNome(f.name)) || null; if (v) por = 'nome'; }
      // Nome parecido (Paulo, 08/11: "Brussolo" × "Brussolo Ristorante", "Alpha 1" × "Alpha1"): sem espaços, igual ou um
      // contendo o outro. Só liga quando há UM candidato só, para nunca ligar errado; o resto fica em "sem par".
      if (!v) {
        const fn = normalizarNome(f.name).replace(/ /g, '');
        if (fn.length >= 3) {
          const cand = vybe.filter((x) => { const vn = normalizarNome(x.nome).replace(/ /g, ''); return vn.length >= 3 && (vn === fn || vn.includes(fn) || fn.includes(vn)); });
          if (cand.length === 1) { v = cand[0]; por = 'nome_parecido'; }
        }
      }
      if (v) { porFinancas[f.id] = { vybe_id: String(v.id), vybe_nome: v.nome, por }; ligados.push({ financas_id: f.id, financas_nome: f.name, vybe_id: String(v.id), vybe_nome: v.nome, por }); }
      else semPar.push({ financas_id: f.id, nome: f.name || 'Sem nome', status: f.contract_status || '' });
    }
    semPar.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // O caminho inverso: cliente ativo do Vybe OS que não tem cadastro no Finanças ("tudo integrado", Paulo 08/11).
    const usados = new Set(ligados.map((l) => l.vybe_id));
    const vybeSemPar = vybe.filter((v) => !usados.has(String(v.id))).map((v) => ({ vybe_id: String(v.id), nome: v.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { porFinancas, ligados, sem_par: semPar, vybe_sem_par: vybeSemPar };
  }

  // ---------- Mês: recebido × previsto ----------
  function resumoMes(transacoes = [], clientes = [], mes) {
    let recebido = 0, previstoLancado = 0, pendenteMes = 0, despesasPagas = 0, despesasPendentes = 0, folhaLancada = 0;
    const comReceita = new Set();
    for (const t of transacoes) {
      if (ehReceita(t)) {
        if (pago(t) && noMes(dataCaixa(t), mes)) recebido += centavos(t.amount);
        if (noMes(dia(t.date), mes)) { previstoLancado += centavos(t.amount); if (t.client_id) comReceita.add(String(t.client_id)); if (pendente(t)) pendenteMes += centavos(t.amount); }
      } else if (ehDespesa(t) && noMes(dataFiltro(t), mes)) {
        if (pago(t)) despesasPagas += centavos(t.amount); else despesasPendentes += centavos(t.amount);
        if (ehFolha(t)) folhaLancada += centavos(t.amount); // salário lançado como despesa: é a folha, não "outra despesa"
      }
    }
    // Mensalidade de cliente ativo ainda não lançada no mês (o Finanças também casa pela descrição "Mensalidade - Nome").
    let semLancamento = 0, clientesSemLancamento = 0;
    for (const c of clientes) {
      if (c.contract_status !== 'Ativo' || comReceita.has(String(c.id))) continue;
      const descricao = `mensalidade - ${String(c.name || '').toLowerCase()}`;
      if (transacoes.some((t) => ehReceita(t) && noMes(dia(t.date), mes) && String(t.description || '').toLowerCase() === descricao)) continue;
      const v = centavos(c.monthly_fee); if (v > 0) { semLancamento += v; clientesSemLancamento++; }
    }
    const previsto = previstoLancado + semLancamento;
    return { mes, recebido: reais(recebido), previsto: reais(previsto), previsto_lancado: reais(previstoLancado), pendente: reais(pendenteMes),
      mensalidades_sem_lancamento: reais(semLancamento), clientes_sem_lancamento: clientesSemLancamento, recebido_percentual: pct(recebido, previsto),
      despesas_pagas: reais(despesasPagas), despesas_pendentes: reais(despesasPendentes), resultado: reais(recebido - despesasPagas),
      // Auditoria 09/11: "Despesas do mês" e "Folha do mês" saíam com o mesmo valor porque os salários estão lançados como despesa.
      despesas_folha: reais(folhaLancada), despesas_sem_folha: reais(despesasPagas + despesasPendentes - folhaLancada) };
  }

  // ---------- Despesas do mês por categoria ----------
  function despesasPorCategoria(transacoes = [], mes) {
    const mapa = new Map();
    for (const t of transacoes) {
      if (!ehDespesa(t) || !noMes(dataFiltro(t), mes)) continue;
      const k = String(t.category || 'Sem categoria').trim() || 'Sem categoria';
      const c = mapa.get(k) || { categoria: k, pago: 0, pendente: 0, quantidade: 0 };
      if (pago(t)) c.pago += centavos(t.amount); else c.pendente += centavos(t.amount);
      c.quantidade++; mapa.set(k, c);
    }
    const total = [...mapa.values()].reduce((s, c) => s + c.pago + c.pendente, 0);
    const categorias = [...mapa.values()].map((c) => ({ categoria: c.categoria, pago: reais(c.pago), pendente: reais(c.pendente), total: reais(c.pago + c.pendente),
      quantidade: c.quantidade, percentual: pct(c.pago + c.pendente, total) })).sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, 'pt-BR'));
    return { mes, total: reais(total), categorias };
  }

  // ---------- Custos fixos (assinaturas ativas) ----------
  function custosFixos(assinaturas = []) {
    const ativas = assinaturas.filter((s) => s && s.active !== false);
    const itens = ativas.map((s) => ({ id: String(s.id), nome: s.name || 'Assinatura', custo: reais(centavos(s.cost)), dia_renovacao: Number(s.renewal_day) || null }))
      .sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { total: reais(ativas.reduce((s, x) => s + centavos(x.cost), 0)), quantidade: itens.length, itens };
  }

  // ---------- Folha do mês ----------
  function compensacaoNoMes(funcionario, historico = [], mes) {
    const dele = historico.filter((h) => String(h.employee_id) === String(funcionario.id) && ehMes(h.effective_month) && h.effective_month <= mes)
      .sort((a, b) => b.effective_month.localeCompare(a.effective_month));
    if (dele.length) return { salario: centavos(dele[0].salary), bonus: centavos(dele[0].bonus), desde: dele[0].effective_month === '1970-01' ? null : dele[0].effective_month };
    return { salario: centavos(funcionario.salary), bonus: centavos(funcionario.bonus), desde: null };
  }
  function folhaDoMes(funcionarios = [], historico = [], mes) {
    const anterior = somarMeses(mes, -1);
    let total = 0, totalAnterior = 0;
    const linhas = funcionarios.map((f) => {
      const a = compensacaoNoMes(f, historico, mes), b = compensacaoNoMes(f, historico, anterior);
      const t = a.salario + a.bonus, tb = b.salario + b.bonus;
      total += t; totalAnterior += tb;
      return { id: String(f.id), nome: f.name || 'Sem nome', cargo: f.role || '', salario: reais(a.salario), bonus: reais(a.bonus), total: reais(t),
        dia_pagamento: Number(f.payment_day) || null, vigente_desde: a.desde, total_anterior: reais(tb), variacao: reais(t - tb), variacao_percentual: tb ? pct(t - tb, tb) : null };
    }).sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome, 'pt-BR'));
    return { mes, mes_anterior: anterior, total: reais(total), total_anterior: reais(totalAnterior), variacao: reais(total - totalAnterior),
      variacao_percentual: totalAnterior ? pct(total - totalAnterior, totalAnterior) : null, quantidade: linhas.length, funcionarios: linhas };
  }

  // ---------- Margem real por cliente ----------
  function margemPorCliente(transacoes = [], mes, meses = 3) {
    const inicio = somarMeses(mes, -(meses - 1)), mapa = new Map();
    const de = (id) => { const k = String(id); if (!mapa.has(k)) mapa.set(k, { cliente_id: k, mr: 0, md: 0, pr: 0, pd: 0 }); return mapa.get(k); };
    for (const t of transacoes) {
      if (!t?.client_id) continue;
      if (ehReceita(t) && pago(t)) {
        const d = dataCaixa(t); if (!entre(d, inicio, mes)) continue;
        const c = de(t.client_id), v = centavos(t.amount); c.pr += v; if (noMes(d, mes)) c.mr += v;
      } else if (ehDespesa(t)) {
        const d = dataFiltro(t); if (!entre(d, inicio, mes)) continue;
        const c = de(t.client_id), v = centavos(t.amount); c.pd += v; if (noMes(d, mes)) c.md += v;
      }
    }
    const bloco = (r, d) => ({ receita: reais(r), despesas: reais(d), margem: reais(r - d), margem_percentual: r ? pct(r - d, r) : null });
    return [...mapa.values()].map((c) => ({ cliente_id: c.cliente_id, mes: bloco(c.mr, c.md), periodo: bloco(c.pr, c.pd) }))
      .sort((a, b) => b.periodo.margem - a.periodo.margem);
  }

  // ---------- Séries mês a mês (faturamento × custos, ticket médio) ----------
  function serieMensal(transacoes = [], mesFinal, n = 12, minimo = 6) {
    const meses = []; for (let i = n - 1; i >= 0; i--) meses.push(somarMeses(mesFinal, -i));
    const por = new Map(meses.map((m) => [m, { fat: 0, cus: 0, cli: 0, pagantes: new Set() }]));
    for (const t of transacoes) {
      if (!pago(t)) continue;
      const m = por.get(dataCaixa(t).slice(0, 7)); if (!m) continue;
      if (ehReceita(t)) { m.fat += centavos(t.amount); if (t.client_id) { m.cli += centavos(t.amount); m.pagantes.add(String(t.client_id)); } }
      else if (ehDespesa(t)) m.cus += centavos(t.amount);
    }
    let lista = meses.map((mes) => { const m = por.get(mes); return { mes, faturamento: reais(m.fat), custos: reais(m.cus), resultado: reais(m.fat - m.cus),
      clientes_pagantes: m.pagantes.size, ticket_medio: m.pagantes.size ? reais(Math.round(m.cli / m.pagantes.size)) : 0 }; });
    // Começo vazio (antes de usarem o Finanças) sai, ficando pelo menos `minimo` meses.
    while (lista.length > minimo && !lista[0].faturamento && !lista[0].custos) lista = lista.slice(1);
    return lista;
  }

  // ---------- Inadimplência (receitas vencidas e não pagas) ----------
  function inadimplencia(transacoes = [], hoje) {
    const mapa = new Map(); let total = 0, faturas = 0;
    for (const t of transacoes) {
      const venc = dia(t.date);
      // Lançamento de valor zero não é dívida (a Visão geral contava 10 clientes em atraso, a Inadimplência 9).
      if (!ehReceita(t) || !pendente(t) || !venc || venc >= hoje || centavos(t.amount) <= 0) continue;
      const k = t.client_id ? String(t.client_id) : '';
      const c = mapa.get(k) || { cliente_id: k || null, valor: 0, faturas: 0, vencimento_mais_antigo: venc, descricao: '' };
      c.valor += centavos(t.amount); c.faturas++; if (venc < c.vencimento_mais_antigo) c.vencimento_mais_antigo = venc;
      if (!k && !c.descricao) c.descricao = String(t.description || '').slice(0, 80);
      mapa.set(k, c); total += centavos(t.amount); faturas++;
    }
    const clientes = [...mapa.values()].map((c) => ({ ...c, valor: reais(c.valor), atraso_mais_antigo: diasEntre(c.vencimento_mais_antigo, hoje) }))
      .sort((a, b) => b.atraso_mais_antigo - a.atraso_mais_antigo || b.valor - a.valor);
    return { hoje, total: reais(total), faturas, clientes, criticos: clientes.filter((c) => c.atraso_mais_antigo > 30).length };
  }

  // ---------- Contratos ----------
  // Status do Finanças (Ativo | Pendente | Encerrado | Cancelado) → status da Carteira (ativo | negociando | encerrado).
  const STATUS_CONTRATO = { Ativo: 'ativo', Pendente: 'negociando', Encerrado: 'encerrado', Cancelado: 'encerrado' };
  function contratosDoFinancas(contratos = [], ligacao = { porFinancas: {} }, nomes = {}, hoje) {
    return contratos.map((c) => {
      const par = ligacao.porFinancas[c.client_id] || null, fim = dia(c.end_date) || null;
      return { id: String(c.id), financas_cliente_id: c.client_id ? String(c.client_id) : null, cliente_id: par ? par.vybe_id : null,
        cliente_nome: par ? par.vybe_nome : nomes[c.client_id] || 'Cliente do Finanças', ligado_por: par ? par.por : null,
        titulo: c.title || 'Contrato', valor: reais(centavos(c.amount)), inicio: dia(c.start_date) || null, fim, assinado_em: dia(c.signed_date) || null,
        dia_vencimento: Number(c.due_day) || null, status: c.status || '', status_carteira: STATUS_CONTRATO[c.status] || 'ativo',
        tem_pdf: Boolean(c.tem_pdf || c.pdf_url || c.pdf_file_name), dias_restantes: fim && hoje ? diasEntre(hoje, fim) : null };
    }).sort((a, b) => (a.dias_restantes ?? 1e9) - (b.dias_restantes ?? 1e9) || a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR'));
  }
  // O contrato que representa o cliente na Carteira: o ativo mais recente; sem ativo, o mais recente de todos.
  function contratoPrincipal(lista = []) {
    const ord = [...lista].sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
    return ord.find((c) => c.status_carteira === 'ativo') || ord[0] || null;
  }

  // ---------- Lançamentos do Finanças no formato das abas Recebimentos / Contas / Inadimplência (auditoria 09/11) ----------
  // A tela do Comercial já sabe mostrar "recebíveis" e "contas"; o servidor entrega os do Finanças nesse formato, e os
  // números deixam de se contradizer (Recebimentos R$ 0 × R$ 28,5 mil a receber; Inadimplentes 0 × R$ 41,3 mil em atraso).
  // porFinancas: { finClienteId: { vybe_id, vybe_nome } } (de ligarClientes); nomeFin: { finClienteId: nome no Finanças }.
  // Sem cliente no lançamento, o nome sai da descrição "Mensalidade - Nome" e é ligado ao cliente ativo do Vybe OS pela
  // mesma regra de ligarClientes (um candidato só); sem par (ex.: cliente que saiu), fica o nome limpo.
  const nomeDaDescricao = (d) => String(d || '').replace(/^\s*(mensalidade|parcela|fatura|pagamento)\s*[-–:]\s*/i, '').trim();
  function recebiveisDoFinancas(transacoes = [], porFinancas = {}, nomeFin = {}, vybe = []) {
    const out = [], porDescricao = new Map();
    for (const t of transacoes) {
      if (!ehReceita(t) || centavos(t.amount) <= 0 || !dia(t.date)) continue;
      let par = t.client_id ? porFinancas[String(t.client_id)] : null;
      // Também quando o cliente do lançamento foi apagado no Finanças (id que não está mais na lista de clientes).
      const semCadastro = !t.client_id || !nomeFin[String(t.client_id)];
      const daDescricao = !par && semCadastro ? nomeDaDescricao(t.description) : '';
      if (!par && daDescricao && vybe.length) {
        if (!porDescricao.has(daDescricao)) porDescricao.set(daDescricao, ligarClientes([{ id: 'd', name: daDescricao }], vybe).porFinancas.d || null);
        par = porDescricao.get(daDescricao);
      }
      const nome = par ? par.vybe_nome : (t.client_id && nomeFin[String(t.client_id)]) || daDescricao;
      out.push({ id: 'fin:' + String(t.id), fonte: 'financas', tipo: /mensalidade/i.test(String(t.description || '')) ? 'recorrente' : 'avulso',
        cliente_id: par ? String(par.vybe_id) : null, cliente_nome: nome || String(t.description || 'Sem cliente').slice(0, 80),
        descricao: String(t.description || '').slice(0, 160), categoria: String(t.category || ''), ciclo: 'mensal',
        valor: reais(centavos(t.amount)), valor_recebido: pago(t) ? reais(centavos(t.amount)) : 0, vencimento: dia(t.date),
        recebido_em: pago(t) ? dia(t.paid_date) || dia(t.date) : null, cancelado: !pago(t) && !pendente(t) });
    }
    return out;
  }
  function grupoDaDespesa(t) {
    if (ehFolha(t)) return 'folha';
    const c = semAcentoFin(t.category);
    if (/imposto|tribut|das|inss|fgts|iss|irpj|csll/.test(c)) return 'imposto';
    if (/aluguel|internet|energia|agua|telefone|software|assinatura|contabil|fixa/.test(c)) return 'fixa';
    if (/investimento|equipamento/.test(c)) return 'investimento';
    return 'variavel';
  }
  // Folha: lançamento ligado a funcionário OU com categoria/descrição de salário (em produção os salários vêm só com a
  // categoria "Salário/Prolabore", sem funcionário ligado, e caíam em "Variáveis").
  const ehFolha = (t) => Boolean(t?.employee_id) || /salario|pro ?-?labore|folha de pagamento|ferias|13o|decimo terceiro/.test(semAcentoFin(`${t?.category || ''} ${t?.description || ''}`));
  const semAcentoFin = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function contasDoFinancas(transacoes = []) {
    const out = [];
    for (const t of transacoes) {
      if (!ehDespesa(t) || centavos(t.amount) <= 0 || !dia(t.date)) continue;
      out.push({ id: 'fin:' + String(t.id), fonte: 'financas', grupo: grupoDaDespesa(t), descricao: String(t.description || t.category || 'Despesa').slice(0, 160),
        fornecedor_id: null, fornecedor_nome: String(t.category || ''), valor: reais(centavos(t.amount)), vencimento: dia(t.date),
        pago_em: pago(t) ? dia(t.paid_date) || dia(t.date) : null, cancelada: !pago(t) && !pendente(t) });
    }
    return out;
  }
  const api = Object.freeze({ recebiveisDoFinancas, contasDoFinancas, grupoDaDespesa, normalizarNome, soDigitos, cnpjValido, ligarClientes, dataCaixa, dataFiltro, somarMeses, ehMes,
    resumoMes, despesasPorCategoria, custosFixos, compensacaoNoMes, folhaDoMes, margemPorCliente, serieMensal, inadimplencia,
    STATUS_CONTRATO, contratosDoFinancas, contratoPrincipal });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybeFinancasCalculos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
