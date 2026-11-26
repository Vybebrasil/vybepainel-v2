// shared/financeiro-analises.js — as análises de agência do Finanças (Paulo, 26/11/2026: "preciso que seja FODA,
// COMPLETO, que eu consiga analisar tudo: gráficos de linha, pizza, projeções, históricos… ter projeções de tudo").
//
// Funções puras (sem DOM, rede nem banco), em cima do que o Finanças já guarda (shared/financeiro-extrato.js: cada
// lançamento com o lado do banco e o lado real) e dos contratos dos clientes. No servidor: import A from
// '../shared/financeiro-analises.js'. No navegador: window.VybeFinancasAnalises (carregar depois do extrato).
//   contratos     valorNoMes, vigente, vencimento (o dia real do vencimento, com fim e reajuste)
//   dre           DRE por competência (ou de caixa): receita, impostos, equipe, ferramentas, gerais, resultado, margem
//   recorrente    MRR mês a mês, cascata (novo, expansão, contração, perdido), churn, ticket, vida média e LTV
//   margemClientes receita − custo direto − equipe rateada pelas peças que o cliente consumiu na produção
//   aging         a receber por idade: em dia, 1–30, 31–60, 61–90, 90+
//   orcamento     orçado × realizado por grupo, copiar do mês anterior com ajuste em %
//   fechamento    o checklist do mês e o resumo para a contabilidade
//   historico     todo o período, comparação com o mês anterior e o mesmo mês do ano anterior, sazonalidade (12+ meses)
//   projecao3     pessimista, base e otimista dia a dia até 12 meses: saldo, fôlego, primeiro dia negativo
//   equilibrio    quanto de MRR cobre o custo fixo
//   lote          sugestão para cada lançamento a conferir (regra ou o histórico da mesma contraparte)
//   repetidas     saídas que se repetem (mesma contraparte, valor parecido em 2–3 meses) e ainda não são fixo
//   achados       o que o Vorcaro vê: o que fazer e o impacto em reais
//   confianca     quanto histórico a conta usou e a confiança dela
// Dinheiro em centavos inteiros nas contas; a saída volta em reais.
(function (raiz) {
  'use strict';
  const X = (typeof module !== 'undefined' && module.exports) ? require('./financeiro-extrato.js') : raiz.VybeFinanceiroExtrato;
  const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const reais = (c) => Math.round(c) / 100;
  const ehMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
  const ehDia = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const somarMeses = (m, n) => X.somarMeses(m, n);
  const ultimoDia = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  const diaMs = (iso) => Date.parse(iso + 'T12:00:00Z');
  const diasEntre = (a, b) => Math.round((diaMs(b) - diaMs(a)) / 864e5);
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const CAT = new Map(X.CATEGORIAS.map((c) => [c.id, c]));
  const mesesEntre = (de, ate) => { const out = []; if (!ehMes(de) || !ehMes(ate)) return out; for (let m = de; m <= ate && out.length < 240; m = somarMeses(m, 1)) out.push(m); return out; };
  const media = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);
  const percentil = (l, p) => { if (!l.length) return 0; const o = l.slice().sort((a, b) => a - b), i = (o.length - 1) * p, a = Math.floor(i), b = Math.ceil(i); return o[a] + (o[b] - o[a]) * (i - a); };

  // ---------- Quanto histórico e qual confiança (Paulo só tem 3 meses de extrato, de 17/08 a 13/11/2026) ----------
  function confianca(nMeses) {
    const n = Number(nMeses) || 0;
    const nivel = n >= 9 ? 'alta' : n >= 5 ? 'media' : n >= 1 ? 'baixa' : 'nenhuma';
    const nome = { alta: 'alta', media: 'média', baixa: 'baixa', nenhuma: 'sem base' }[nivel];
    return { meses: n, nivel, texto: n ? `base em ${n} ${n === 1 ? 'mês' : 'meses'}: confiança ${nome}` : 'sem mês fechado para usar de base' };
  }

  // ---------- Contrato do cliente ----------
  // ct: { cliente_id, cliente_nome, valor_mensal, inicio 'AAAA-MM-DD', fim 'AAAA-MM-DD' | '' (sem fim), dia_vencimento,
  //       reajuste_em 'AAAA-MM-DD', reajuste_pct }
  function vigente(ct, mes) {
    if (!ct || !(Number(ct.valor_mensal) > 0)) return false;
    if (ct.inicio && String(ct.inicio).slice(0, 7) > mes) return false;
    if (ct.fim && String(ct.fim).slice(0, 7) < mes) return false;
    return true;
  }
  // O valor do mês: a mensalidade e, a partir do mês do reajuste, a mensalidade com o reajuste.
  function valorNoMes(ct, mes) {
    if (!vigente(ct, mes)) return 0;
    let c = centavos(ct.valor_mensal);
    const pct = Number(ct.reajuste_pct) || 0;
    if (pct && ct.reajuste_em && String(ct.reajuste_em).slice(0, 7) <= mes) c = Math.round(c * (1 + pct / 100));
    return reais(c);
  }
  // O dia em que a mensalidade do mês vence: o dia do contrato (31 em fevereiro = último dia) ou o último dia do mês.
  function vencimento(ct, mes) {
    const ult = ultimoDia(mes), d = Number(ct?.dia_vencimento) || 0;
    return `${mes}-${String(d >= 1 ? Math.min(d, ult) : ult).padStart(2, '0')}`;
  }

  // ---------- DRE ----------
  // Linhas fixas. `grupo` diz em qual linha cada categoria entra; o que não é resultado (empréstimo, aporte, retirada,
  // transferência) fica fora, mostrado embaixo. Cartão: na competência, uma fatura com itens conta pelos itens (cada um
  // na categoria dele, no mês da fatura) e o pagamento dela sai; sem itens, o pagamento entra em despesas gerais.
  const LINHA_DA = {
    receita_cliente: 'receita', receita_boleto: 'receita', receita_outra: 'receita', rendimento: 'receita',
    impostos: 'impostos',
    salario: 'equipe', freela: 'equipe', pro_labore: 'equipe', adiantamento: 'equipe', devolucao_vale: 'equipe',
    ferramentas: 'ferramentas',
    combustivel: 'gerais', alimentacao: 'gerais', viagem: 'gerais', producao: 'gerais', estrutura: 'gerais', tarifa_bancaria: 'gerais', juros_banco: 'gerais', outra_saida: 'gerais', cartao_agencia: 'gerais',
    a_classificar: 'sem_categoria',
    emprestimo: 'fora', emprestimo_entrada: 'fora', aporte_socio: 'fora', retirada_socio: 'fora',
  };
  const LINHAS_DRE = Object.freeze([
    { id: 'receita', nome: 'Receita', sinal: 1 }, { id: 'impostos', nome: 'Impostos', sinal: -1 }, { id: 'equipe', nome: 'Custo de equipe', sinal: -1 },
    { id: 'ferramentas', nome: 'Ferramentas e assinaturas', sinal: -1 }, { id: 'gerais', nome: 'Despesas gerais', sinal: -1 }, { id: 'sem_categoria', nome: 'Sem categoria', sinal: -1 }]);
  // { meses, base: 'competencia' | 'caixa', itensCartao } → { meses, linhas: [{ id, nome, valores[], total }], resultado[], margem[], fora[], ids }
  function dre(lista = [], { meses = [], base = 'competencia', itensCartao = [] } = {}) {
    const ix = new Map(meses.map((m, i) => [m, i]));
    const soma = new Map([...LINHAS_DRE.map((l) => [l.id, new Array(meses.length).fill(0)]), ['fora', new Array(meses.length).fill(0)]]);
    const porCat = new Map(); // linha|categoria → valores (para abrir a linha)
    const faturasComItens = new Set();
    if (base === 'competencia') for (const it of itensCartao) if (ehMes(it.fatura)) faturasComItens.add(`${it.cartao || 'Cartão da agência'}|${it.fatura}`);
    const somar = (linha, cat, mes, v) => {
      const i = ix.get(mes); if (i == null) return;
      soma.get(linha)[i] += v;
      const k = linha + '|' + cat; if (!porCat.has(k)) porCat.set(k, new Array(meses.length).fill(0)); porCat.get(k)[i] += v;
    };
    for (const t of lista) for (const p of X.pedacos(t)) {
      if (p.categoria === 'cartao_agencia' && base === 'competencia' && faturasComItens.has(String(t.real.fatura || ''))) continue;
      const linha = LINHA_DA[p.categoria] || (Number(p.valor) > 0 ? 'receita' : 'gerais');
      const mes = base === 'competencia' ? (ehMes(p.competencia) ? p.competencia : p.data.slice(0, 7)) : p.data.slice(0, 7);
      // Receita positiva; custos positivos também (a linha diz o sinal). Devolução de vale abate o custo de equipe.
      const v = linha === 'receita' ? centavos(p.valor) : -centavos(p.valor);
      somar(linha, p.categoria, mes, v);
    }
    if (base === 'competencia') for (const it of itensCartao) {
      if (!ehMes(it.fatura)) continue;
      const linha = LINHA_DA[it.categoria] && LINHA_DA[it.categoria] !== 'receita' ? LINHA_DA[it.categoria] : it.categoria === 'a_classificar' ? 'sem_categoria' : 'gerais';
      somar(linha, it.categoria || 'a_classificar', it.fatura, Math.abs(centavos(it.valor)));
    }
    const resultado = meses.map((_, i) => LINHAS_DRE.reduce((s, l) => s + l.sinal * soma.get(l.id)[i], 0));
    const linhas = LINHAS_DRE.map((l) => ({ id: l.id, nome: l.nome, sinal: l.sinal, valores: soma.get(l.id).map(reais), total: reais(soma.get(l.id).reduce((s, v) => s + v, 0)),
      categorias: [...porCat].filter(([k]) => k.startsWith(l.id + '|')).map(([k, v]) => ({ categoria: k.slice(l.id.length + 1), nome: CAT.get(k.slice(l.id.length + 1))?.nome || k, valores: v.map(reais), total: reais(v.reduce((s, x) => s + x, 0)) })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)) }));
    const rec = soma.get('receita');
    const totRec = rec.reduce((s, v) => s + v, 0), totRes = resultado.reduce((s, v) => s + v, 0);
    return { meses, base, linhas, resultado: resultado.map(reais), total_resultado: reais(totRes), total_receita: reais(totRec),
      margem: resultado.map((r, i) => (rec[i] > 0 ? Math.round(r / rec[i] * 1000) / 10 : null)), margem_total: totRec > 0 ? Math.round(totRes / totRec * 1000) / 10 : null,
      fora: { valores: soma.get('fora').map((v) => reais(-v)), total: reais(-soma.get('fora').reduce((s, v) => s + v, 0)),
        categorias: [...porCat].filter(([k]) => k.startsWith('fora|')).map(([k, v]) => ({ categoria: k.slice(5), nome: CAT.get(k.slice(5))?.nome || k, valores: v.map((x) => reais(-x)), total: reais(-v.reduce((s, x) => s + x, 0)) })) } };
  }

  // ---------- Receita recorrente (MRR) ----------
  // contratos de TODOS os clientes, inclusive os que saíram (o fim, ou o dia em que saíram, diz até quando contam).
  function recorrente(contratos = [], meses = [], { hoje = '' } = {}) {
    const cs = contratos.filter((c) => Number(c.valor_mensal) > 0);
    const out = meses.map((mes, i) => {
      const ant = somarMeses(mes, -1);
      let mrr = 0, novo = 0, expansao = 0, contracao = 0, perdido = 0, ativos = 0, mrrAnt = 0;
      const mov = [];
      for (const c of cs) {
        const a = centavos(valorNoMes(c, ant)), b = centavos(valorNoMes(c, mes));
        mrr += b; mrrAnt += a; if (b > 0) ativos++;
        if (!a && b) { novo += b; mov.push({ tipo: 'novo', cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome, valor: reais(b) }); }
        else if (a && !b) { perdido += a; mov.push({ tipo: 'perdido', cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome, valor: reais(-a) }); }
        else if (b > a) { expansao += b - a; mov.push({ tipo: 'expansao', cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome, valor: reais(b - a) }); }
        else if (b < a) { contracao += a - b; mov.push({ tipo: 'contracao', cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome, valor: reais(b - a) }); }
      }
      return { mes, mrr: reais(mrr), mrr_anterior: reais(mrrAnt), novo: reais(novo), expansao: reais(expansao), contracao: contracao ? reais(-contracao) : 0, perdido: perdido ? reais(-perdido) : 0, ativos,
        churn_pct: mrrAnt > 0 ? Math.round(perdido / mrrAnt * 1000) / 10 : 0, ticket: ativos ? reais(Math.round(mrr / ativos)) : 0, movimentos: mov, primeiro: i === 0 };
    });
    // Vida média: do início ao fim (ou até hoje, se ainda está) de cada contrato com início conhecido.
    const ate = ehDia(hoje) ? hoje : (meses.length ? `${meses[meses.length - 1]}-28` : '');
    const vidas = cs.filter((c) => ehDia(c.inicio) && ate).map((c) => Math.max(1, Math.round(diasEntre(c.inicio, c.fim && c.fim < ate ? c.fim : ate) / 30.44)));
    const vida = vidas.length ? Math.round(media(vidas) * 10) / 10 : null;
    const ult = out[out.length - 1] || null;
    const churns = out.filter((m) => !m.primeiro && m.mrr_anterior > 0).map((m) => m.churn_pct);
    const churnMedio = churns.length ? Math.round(media(churns) * 10) / 10 : 0;
    // LTV: ticket × vida média (contratos conhecidos); com churn, ticket ÷ churn mensal é a outra leitura.
    const ticket = ult?.ticket || 0;
    return { meses: out, mrr: ult?.mrr || 0, ticket, vida_media_meses: vida, churn_medio_pct: churnMedio,
      ltv: vida ? reais(Math.round(centavos(ticket) * vida)) : null, ltv_pelo_churn: churnMedio > 0 ? reais(Math.round(centavos(ticket) / (churnMedio / 100))) : null,
      vidas_conhecidas: vidas.length };
  }

  // ---------- Margem real por cliente ----------
  // pecas: [{ cliente_id, mes, pecas }] — as peças da produção do Vybe OS (vybe_conteudos ligadas ao cliente, não
  // canceladas, pelo mês da veiculação). Regra do rateio (vai explicada na tela): o custo de equipe do mês (DRE) é dividido
  // entre os clientes pela parte das peças do mês que cada um consumiu; num mês sem peça nenhuma, pela parte da receita.
  function margemClientes(lista = [], { meses = [], pecas = [], nomes = {}, itensCartao = [] } = {}) {
    const d = dre(lista, { meses, base: 'competencia', itensCartao });
    const equipe = d.linhas.find((l) => l.id === 'equipe').valores.map(centavos);
    const ix = new Map(meses.map((m, i) => [m, i]));
    const cli = new Map();
    const de = (id, nome) => { const k = String(id); if (!cli.has(k)) cli.set(k, { cliente_id: k, cliente_nome: nome || nomes[k] || 'Cliente', receita: new Array(meses.length).fill(0), direto: new Array(meses.length).fill(0), pecas: new Array(meses.length).fill(0), rateio: new Array(meses.length).fill(0) }); const c = cli.get(k); if (nome && c.cliente_nome === 'Cliente') c.cliente_nome = nome; return c; };
    for (const t of lista) for (const p of X.pedacos(t)) {
      if (!p.cliente_id) continue;
      const mes = ehMes(p.competencia) ? p.competencia : p.data.slice(0, 7), i = ix.get(mes);
      if (i == null) continue;
      const linha = LINHA_DA[p.categoria];
      if (linha === 'fora') continue;
      const c = de(p.cliente_id, p.cliente_nome);
      if (Number(p.valor) > 0 && linha === 'receita') c.receita[i] += centavos(p.valor); else if (Number(p.valor) < 0) c.direto[i] += -centavos(p.valor);
    }
    for (const it of itensCartao) { const i = ix.get(it.fatura); if (i == null || !it.cliente_id) continue; de(it.cliente_id, it.cliente_nome).direto[i] += Math.abs(centavos(it.valor)); }
    for (const p of pecas) { const i = ix.get(p.mes); if (i == null || !p.cliente_id) continue; de(p.cliente_id, p.cliente_nome).pecas[i] += Number(p.pecas) || 0; }
    const todos = [...cli.values()];
    const regra = meses.map((_, i) => {
      const totP = todos.reduce((s, c) => s + c.pecas[i], 0), totR = todos.reduce((s, c) => s + c.receita[i], 0);
      for (const c of todos) c.rateio[i] = equipe[i] > 0 ? (totP > 0 ? Math.round(equipe[i] * c.pecas[i] / totP) : totR > 0 ? Math.round(equipe[i] * c.receita[i] / totR) : 0) : 0;
      return totP > 0 ? 'pecas' : totR > 0 ? 'receita' : 'nada';
    });
    const linhas = todos.map((c) => {
      const rec = c.receita.reduce((s, v) => s + v, 0), dir = c.direto.reduce((s, v) => s + v, 0), rat = c.rateio.reduce((s, v) => s + v, 0), nP = c.pecas.reduce((s, v) => s + v, 0);
      const mg = rec - dir - rat;
      return { cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, receita: reais(rec), custo_direto: reais(dir), custo_equipe: reais(rat), margem: reais(mg),
        margem_pct: rec > 0 ? Math.round(mg / rec * 1000) / 10 : null, pecas: nP, custo_por_peca: nP ? reais(Math.round((dir + rat) / nP)) : null,
        por_mes: meses.map((m, i) => ({ mes: m, receita: reais(c.receita[i]), custo: reais(c.direto[i] + c.rateio[i]), margem: reais(c.receita[i] - c.direto[i] - c.rateio[i]), pecas: c.pecas[i],
          margem_pct: c.receita[i] > 0 ? Math.round((c.receita[i] - c.direto[i] - c.rateio[i]) / c.receita[i] * 1000) / 10 : null })) };
    }).filter((l) => l.receita || l.custo_direto || l.pecas).sort((a, b) => b.margem - a.margem);
    return { meses, regra, custo_equipe: equipe.map(reais), linhas, prejuizo: linhas.filter((l) => l.margem < 0).sort((a, b) => a.margem - b.margem) };
  }

  // ---------- A receber por idade (aging) ----------
  // porCliente: as linhas de X.porCliente (meses com em_aberto e a_receber); contratos para o dia do vencimento.
  const FAIXAS = Object.freeze([{ id: 'em_dia', nome: 'Em dia', ate: 0 }, { id: 'd30', nome: '1 a 30 dias', ate: 30 }, { id: 'd60', nome: '31 a 60 dias', ate: 60 }, { id: 'd90', nome: '61 a 90 dias', ate: 90 }, { id: 'd90mais', nome: 'Mais de 90 dias', ate: Infinity }]);
  function aging(porCliente = [], contratos = [], { hoje }) {
    const ct = new Map(contratos.map((c) => [String(c.cliente_id), c]));
    const itens = [];
    for (const l of porCliente) for (const m of l.meses || []) {
      const v = centavos((m.em_aberto || 0) + (m.a_receber || 0));
      if (v <= 0) continue;
      const vence = vencimento(ct.get(String(l.cliente_id)), m.mes);
      const atraso = Math.max(0, diasEntre(vence, hoje));
      const faixa = atraso === 0 ? 'em_dia' : FAIXAS.find((f) => f.id !== 'em_dia' && atraso <= f.ate).id;
      itens.push({ cliente_id: String(l.cliente_id), cliente_nome: l.cliente_nome, mes: m.mes, vence, atraso_dias: atraso, valor: reais(v), faixa });
    }
    itens.sort((a, b) => b.atraso_dias - a.atraso_dias || b.valor - a.valor);
    const faixas = FAIXAS.map((f) => { const l = itens.filter((i) => i.faixa === f.id); return { id: f.id, nome: f.nome, total: reais(l.reduce((s, i) => s + centavos(i.valor), 0)), quantos: l.length, itens: l }; });
    const vencido = itens.filter((i) => i.atraso_dias > 0);
    return { faixas, itens, total: reais(itens.reduce((s, i) => s + centavos(i.valor), 0)), vencido: reais(vencido.reduce((s, i) => s + centavos(i.valor), 0)),
      atraso_medio_dias: vencido.length ? Math.round(media(vencido.map((i) => i.atraso_dias))) : 0 };
  }
  // Quantos dias depois do vencimento os clientes pagaram (o "atraso médio" do cenário pessimista).
  function atrasoMedioPago(lista = [], contratos = []) {
    const ct = new Map(contratos.map((c) => [String(c.cliente_id), c]));
    const atrasos = [];
    for (const t of lista) for (const p of X.pedacos(t)) {
      if (!(Number(p.valor) > 0) || p.status !== 'pago' || !ct.has(String(p.cliente_id || ''))) continue;
      const comp = ehMes(p.competencia) ? p.competencia : p.data.slice(0, 7);
      atrasos.push(Math.max(0, diasEntre(vencimento(ct.get(String(p.cliente_id)), comp), p.data)));
    }
    return atrasos.length ? Math.round(media(atrasos)) : null;
  }

  // ---------- Orçamento × real ----------
  // orcamento: { 'AAAA-MM': { '<grupo>': valor } }; o real é a soma das saídas do mês pelo grupo da categoria.
  const GRUPOS_ORCAMENTO = Object.freeze(['Pessoas', 'Sócios', 'Operação', 'Estrutura', 'Impostos', 'Banco', 'Empréstimos', 'Cartão', 'Outros']);
  function realPorGrupo(lista = [], mes) {
    const g = new Map();
    for (const t of lista) {
      if (!t.banco.data.startsWith(mes)) continue;
      for (const p of X.pedacos(t)) {
        if (!(Number(p.valor) < 0)) continue;
        const grupo = CAT.get(p.categoria)?.grupo || 'Outros', k = GRUPOS_ORCAMENTO.includes(grupo) ? grupo : 'Outros';
        g.set(k, (g.get(k) || 0) - centavos(p.valor));
      }
    }
    return g;
  }
  function orcadoReal(orcamento = {}, lista = [], mes) {
    const o = orcamento?.[mes] || {}, r = realPorGrupo(lista, mes);
    const grupos = [...new Set([...Object.keys(o), ...r.keys()])].sort((a, b) => GRUPOS_ORCAMENTO.indexOf(a) - GRUPOS_ORCAMENTO.indexOf(b));
    const linhas = grupos.map((grupo) => {
      const orc = centavos(o[grupo] || 0), re = r.get(grupo) || 0;
      return { grupo, orcado: reais(orc), real: reais(re), desvio: reais(re - orc), desvio_pct: orc > 0 ? Math.round((re - orc) / orc * 100) : null, estourou: orc > 0 && re > orc, sem_orcamento: !orc && re > 0 };
    });
    const tO = linhas.reduce((s, l) => s + centavos(l.orcado), 0), tR = linhas.reduce((s, l) => s + centavos(l.real), 0);
    return { mes, tem_orcamento: Object.keys(o).length > 0, linhas, orcado: reais(tO), real: reais(tR), desvio: reais(tR - tO), estourados: linhas.filter((l) => l.estourou) };
  }
  function copiarOrcamento(orcamento = {}, de, para, pct = 0) {
    const fator = 1 + (Number(pct) || 0) / 100;
    return Object.fromEntries(Object.entries(orcamento?.[de] || {}).map(([g, v]) => [g, reais(Math.round(centavos(v) * fator))]));
  }
  // Sugestão para um mês sem orçamento: a média dos meses fechados que existem (até 3), por grupo.
  function sugerirOrcamento(lista = [], meses = []) {
    const g = new Map();
    for (const m of meses) for (const [k, v] of realPorGrupo(lista, m)) g.set(k, (g.get(k) || 0) + v);
    // Arredondado a R$ 10.
    return Object.fromEntries([...g].map(([k, v]) => [k, reais(Math.round(v / Math.max(1, meses.length) / 1000) * 1000)]));
  }

  // ---------- Fechamento do mês ----------
  // Checklist: extrato até o fim do mês, tudo conferido, cartão conciliado, a receber revisado (pago, cobrado ou marcado).
  function checklistFechamento({ lista = [], mes, faturas = [], pagamentosSemFatura = [], aging: ag = null, cobrados = new Set() } = {}) {
    const fim = `${mes}-${String(ultimoDia(mes)).padStart(2, '0')}`;
    const doBanco = lista.filter((t) => t.banco.saldo != null).map((t) => t.banco.data).sort();
    const ultimo = doBanco[doBanco.length - 1] || '';
    const doMes = lista.filter((t) => t.banco.data.startsWith(mes));
    const semConferir = doMes.filter((t) => !t.real.conferido).length;
    const fat = faturas.filter((f) => f.fatura === mes && f.situacao !== 'vazia' && f.situacao !== 'paga');
    const soltos = pagamentosSemFatura.filter((p) => String(p.data).startsWith(mes)).length;
    const abertos = (ag?.itens || []).filter((i) => i.mes <= mes && i.atraso_dias > 0 && !cobrados.has(i.cliente_id));
    const itens = [
      { id: 'extrato', nome: 'Extrato importado até o fim do mês', ok: Boolean(ultimo) && ultimo >= fim, det: ultimo ? `o extrato vai até ${ultimo.split('-').reverse().join('/')}` : 'sem extrato', aba: 'fin_movimento' },
      { id: 'conferido', nome: 'Tudo conferido', ok: doMes.length > 0 && semConferir === 0, det: semConferir ? `${semConferir} sem conferir` : doMes.length ? `${doMes.length} lançamentos conferidos` : 'nenhum lançamento no mês', aba: 'fin_movimento', chip: 'conferir' },
      { id: 'cartao', nome: 'Cartão conciliado', ok: !fat.length && !soltos, det: fat.length ? `${fat.length} fatura(s) sem bater com o pagamento` : soltos ? `${soltos} pagamento(s) de cartão sem fatura` : 'nada pendente', aba: 'fin_movimento', chip: 'cartao' },
      { id: 'receber', nome: 'A receber revisado', ok: !abertos.length, det: abertos.length ? `${abertos.length} mensalidade(s) vencida(s) sem cobrança registrada` : 'todo atraso está cobrado ou pago', aba: 'fin_analise', sub: 'receber' },
    ];
    return { mes, itens, pronto: itens.every((i) => i.ok), faltam: itens.filter((i) => !i.ok).length };
  }
  // O resumo para a contabilidade: DRE de caixa e de competência do mês, entradas e saídas por categoria e os saldos.
  function resumoContabil({ lista = [], mes, itensCartao = [] } = {}) {
    const r = X.resumo(lista, { mes });
    const comSaldo = lista.filter((t) => t.banco.saldo != null).sort((a, b) => a.banco.data.localeCompare(b.banco.data) || (a.banco.ordem || 0) - (b.banco.ordem || 0));
    const antes = comSaldo.filter((t) => t.banco.data < `${mes}-01`), noMes = comSaldo.filter((t) => t.banco.data.startsWith(mes));
    const primeiro = noMes[0];
    const saldoInicial = antes.length ? antes[antes.length - 1].banco.saldo : primeiro ? reais(centavos(primeiro.banco.saldo) - centavos(primeiro.banco.valor)) : null;
    return { mes, saldo_inicial: saldoInicial, saldo_final: r.saldo_final, entradas: r.entradas, saidas: r.saidas, cartao_e_transferencias: r.cartao_e_transferencias, resultado_caixa: r.resultado,
      lancamentos: r.lancamentos, categorias: r.categorias, competencia: dre(lista, { meses: [mes], base: 'competencia', itensCartao }), caixa: dre(lista, { meses: [mes], base: 'caixa' }) };
  }

  // ---------- Histórico ----------
  // serie: [{ mes, entradas, saidas, cartao, resultado, saldo_final }] (server/financeiro.js montar().serie).
  function historico(serie = []) {
    const s = serie.slice().sort((a, b) => a.mes.localeCompare(b.mes));
    const por = new Map(s.map((x) => [x.mes, x]));
    const saida = (x) => (Number(x.saidas) || 0) + (Number(x.cartao) || 0);
    const linhas = s.map((x) => {
      const ant = por.get(somarMeses(x.mes, -1)), ano = por.get(somarMeses(x.mes, -12));
      const varia = (a, b) => (b ? Math.round((a - b) / Math.abs(b) * 100) : null);
      return { mes: x.mes, entradas: x.entradas, saidas: reais(centavos(saida(x))), resultado: x.resultado, saldo_final: x.saldo_final,
        vs_anterior: ant ? { entradas: varia(x.entradas, ant.entradas), saidas: varia(saida(x), saida(ant)), resultado: reais(centavos(x.resultado) - centavos(ant.resultado)) } : null,
        vs_ano_anterior: ano ? { entradas: varia(x.entradas, ano.entradas), saidas: varia(saida(x), saida(ano)), resultado: reais(centavos(x.resultado) - centavos(ano.resultado)) } : null };
    });
    const tem12 = s.length >= 12;
    const sazonal = tem12 ? Array.from({ length: 12 }, (_, i) => {
      const doMes = s.filter((x) => Number(x.mes.slice(5, 7)) === i + 1);
      return { mes_do_ano: i + 1, entradas: reais(Math.round(media(doMes.map((x) => centavos(x.entradas))))), saidas: reais(Math.round(media(doMes.map((x) => centavos(saida(x)))))), anos: doMes.length };
    }) : null;
    const faltam = Math.max(0, 12 - s.length);
    return { linhas, meses: s.length, de: s[0]?.mes || '', ate: s[s.length - 1]?.mes || '', sazonalidade: sazonal, tem_ano_anterior: linhas.some((l) => l.vs_ano_anterior),
      aviso_12: tem12 ? '' : `A sazonalidade e a comparação com o mesmo mês do ano passado aparecem com 12 meses de extrato (faltam ${faltam}${s.length ? `, a partir de ${somarMeses(s[0].mes, 12).split('-').reverse().join('/')}` : ''}).` };
  }

  // ---------- Saídas fixas × variáveis do histórico ----------
  // Fixas = gastos fixos cadastrados + salários combinados; variáveis = o resto do que saiu (sem o que já é fixo: o
  // lançamento ligado ou achado como pagamento do fixo e o salário/pró-labore de quem tem combinado).
  function variaveisPorMes(lista = [], meses = [], opcoes = {}) { return variaveisDetalhe(lista, meses, opcoes).total; }
  function variaveisDetalhe(lista = [], meses = [], { fixos = [], itensCartao = [], salarios = {} } = {}) {
    const comComb = new Set(Object.entries(salarios || {}).filter(([, s]) => s && !s.fora && Number(s.valor) > 0).map(([id]) => String(id)));
    const porCat = new Map();
    const total = meses.map((mes) => {
      const fa = X.analisarFixos(fixos, lista, mes, itensCartao);
      const pagosFixo = new Set(fa.fixos.filter((f) => f.achado?.id).map((f) => f.achado.id));
      let v = 0;
      for (const t of lista) {
        if (!t.banco.data.startsWith(mes) || pagosFixo.has(t.id) || t.real.fixo_id) continue;
        for (const p of X.pedacos(t)) {
          if (!(Number(p.valor) < 0)) continue;
          const c = CAT.get(p.categoria);
          if (c && c.tipo === 'transferencia' && c.id !== 'cartao_agencia') continue;
          if (['salario', 'pro_labore'].includes(p.categoria) && comComb.has(String(p.pessoa_id || ''))) continue;
          v += -centavos(p.valor);
          porCat.set(p.categoria, (porCat.get(p.categoria) || 0) - centavos(p.valor));
        }
      }
      return reais(v);
    });
    return { total, por_categoria: Object.fromEntries([...porCat].map(([k, v]) => [k, reais(Math.round(v / Math.max(1, meses.length)))])) };
  }
  // As entradas que não vêm de contrato (rendimento, outra entrada, cliente sem contrato), média por mês.
  function entradasForaDeContrato(lista = [], meses = [], contratos = []) {
    const comContrato = new Set(contratos.filter((c) => Number(c.valor_mensal) > 0).map((c) => String(c.cliente_id)));
    return meses.map((mes) => {
      let v = 0;
      for (const t of lista) if (t.banco.data.startsWith(mes)) for (const p of X.pedacos(t)) {
        if (!(Number(p.valor) > 0)) continue;
        if (LINHA_DA[p.categoria] !== 'receita') continue;
        // A mensalidade de quem tem contrato já entra pelo contrato; o resto (rendimento, avulso, cliente sem contrato) é média.
        if (p.cliente_id && comContrato.has(String(p.cliente_id))) continue;
        if (!p.cliente_id && ['receita_cliente', 'receita_boleto'].includes(p.categoria) && comContrato.size) continue; // sem dizer de quem: conta como mensalidade
        v += centavos(p.valor);
      }
      return reais(v);
    });
  }

  // ---------- Projeção em três cenários ----------
  // p = { hoje, saldo_hoje, lista, meses_base (os meses fechados usados), contratos (ativos, com dia/fim/reajuste),
  //       fixos, salarios, itensCartao, risco: Set(cliente_id) em risco alto, pipeline: [{ nome, valor_mensal, valor_avulso, chance }],
  //       horizonte (meses, até 12), cenario (o "E se" por cima do base) }
  // Dia a dia: a mensalidade entra no dia do vencimento (no pessimista, com o atraso médio); o fixo sai no dia dele; o
  // salário combinado no dia 5; o variável espalhado pelos dias do mês. Devolve por cenário os meses (saldo no fim do mês,
  // menor saldo do mês), o primeiro dia negativo e o fôlego (quantos meses até o caixa ficar negativo).
  function projecao3(p = {}) {
    const hoje = ehDia(p.hoje) ? p.hoje : new Date().toISOString().slice(0, 10);
    const H = Math.max(1, Math.min(12, Number(p.horizonte) || 12));
    const lista = p.lista || [], mesesBase = p.meses_base || [];
    const contratos = (p.contratos || []).filter((c) => Number(c.valor_mensal) > 0);
    const fixos = (p.fixos || []).filter((f) => f.ativo !== false);
    const comb = Object.values(p.salarios || {}).filter((s) => s && !s.fora && Number(s.valor) > 0).map((s) => ({ valor: Number(s.valor), desde: s.desde || '' }));
    const det = variaveisDetalhe(lista, mesesBase, { fixos: p.fixos || [], itensCartao: p.itensCartao || [], salarios: p.salarios || {} }), vars = det.total;
    const outras = entradasForaDeContrato(lista, mesesBase, contratos);
    const semContratos = !contratos.length;
    // Sem contrato cadastrado, a entrada vem da média do que entrou (não dá para saber o dia: entra espalhada).
    const mediaEntradas = mesesBase.length ? media(mesesBase.map((m) => centavos(X.resumo(lista, { mes: m }).entradas))) : 0;
    const varBase = centavos(media(vars)), varAlto = centavos(vars.length >= 3 ? percentil(vars, 0.8) : media(vars) * 1.15);
    const outrasMedia = semContratos ? 0 : centavos(media(outras));
    const atraso = Number.isFinite(p.atraso_medio) ? p.atraso_medio : 10;
    const risco = p.risco instanceof Set ? p.risco : new Set((p.risco || []).map(String));
    const pipe = (p.pipeline || []).filter((o) => Number(o.valor_mensal) > 0 || Number(o.valor_avulso) > 0);
    const c = p.cenario || {};
    const inicio = somarMeses(hoje.slice(0, 7), 0);
    const meses = Array.from({ length: H }, (_, i) => somarMeses(inicio, i));
    const maior = contratos.slice().sort((a, b) => Number(b.valor_mensal) - Number(a.valor_mensal))[0] || null;
    const passou = (i, a) => i + 1 >= Math.max(1, Number(a) || 1);

    function rodar(tipo) {
      let saldo = centavos(p.saldo_hoje || 0);
      let empurrado = []; // mensalidade que o atraso jogou para o mês seguinte: [{ dia, v }]
      let negativo = null, folego = null;
      const out = [];
      meses.forEach((mes, i) => {
        const nDias = ultimoDia(mes), dia0 = mes === hoje.slice(0, 7) ? Number(hoje.slice(8, 10)) + 1 : 1;
        const fluxo = new Array(nDias + 1).fill(0); // fluxo[d] = o que entra − o que sai no dia d
        let entra = 0, sai = 0;
        const pos = (dia, v) => { const d = Math.max(dia0, Math.min(nDias, dia)); fluxo[d] += v; if (v > 0) entra += v; else sai += -v; };
        const posDia = (dia, v) => { if (dia >= dia0) pos(dia, v); }; // o que já passou neste mês não entra de novo
        for (const e of empurrado) pos(e.dia, e.v);
        const proximo = [];
        if (semContratos) for (let d = 1; d <= nDias; d++) posDia(d, Math.round(mediaEntradas * (tipo === 'pessimista' ? 0.85 : 1) / nDias));
        for (const ct of contratos) {
          if (c.perder_maior && maior && String(ct.cliente_id) === String(maior.cliente_id) && passou(i, c.perder_maior_a_partir || 1)) continue;
          if ((c.clientes_perdidos || []).some((x) => String(x.cliente_id || '') === String(ct.cliente_id) && passou(i, x.a_partir))) continue;
          if (tipo === 'pessimista' && risco.has(String(ct.cliente_id)) && i >= 1) continue; // o cliente em risco sai depois do mês que vem
          let v = centavos(valorNoMes(ct, mes));
          for (const a of c.aumentar || []) if (String(a.cliente_id) === String(ct.cliente_id) && passou(i, a.a_partir)) v = Math.round(v * (1 + (Number(a.pct) || 0) / 100));
          if (!v) continue;
          const vd = Number(vencimento(ct, mes).slice(8, 10));
          if (vd < dia0) continue; // venceu antes de hoje neste mês: ou já entrou (está no saldo), ou é atraso (A receber)
          const venc = vd + (tipo === 'pessimista' ? atraso : 0);
          if (venc > nDias) proximo.push({ dia: venc - nDias, v }); // o atraso empurra para o mês seguinte
          else pos(venc, v);
        }
        empurrado = proximo;
        for (let d = 1; d <= nDias; d++) posDia(d, Math.round(outrasMedia / nDias));
        if (tipo === 'otimista') for (const o of pipe) {
          if (i < 1) continue; // fechar leva um mês
          const ch = Math.max(0, Math.min(1, Number(o.chance) || 0));
          if (Number(o.valor_mensal) > 0) posDia(Number(o.dia_vencimento) || 10, Math.round(centavos(o.valor_mensal) * ch));
          if (i === 1 && Number(o.valor_avulso) > 0) posDia(15, Math.round(centavos(o.valor_avulso) * ch));
        }
        for (const n of c.clientes_novos || []) if (passou(i, n.a_partir)) posDia(10, centavos(n.valor) * Math.max(1, Number(n.quantos) || 1));
        for (const f of fixos) {
          if (!X.fixoVigente(f, mes)) continue;
          if ((c.economias || []).some((e) => (e.fixo_id ? e.fixo_id === f.id : e.nome === f.nome) && passou(i, e.a_partir))) continue;
          posDia(Number(f.dia) || 1, -centavos(f.valor));
        }
        for (const s of comb) if (!s.desde || s.desde <= mes) posDia(5, -centavos(s.valor));
        for (const g of c.contratar || []) if (passou(i, g.a_partir)) posDia(5, -centavos(g.salario));
        for (const g of c.gastos_novos || []) if (passou(i, g.a_partir)) posDia(10, -centavos(g.valor));
        // Corte por categoria: tira a parte daquela categoria na média do variável.
        const corte = (c.cortes || []).reduce((s, x) => s + Math.round(centavos(det.por_categoria[x.categoria] || 0) * Math.max(0, Math.min(100, Number(x.percentual) || 0)) / 100), 0);
        const vMes = Math.max(0, (tipo === 'pessimista' ? varAlto : varBase) - corte);
        for (let d = 1; d <= nDias; d++) posDia(d, -Math.round(vMes / nDias));
        const ajuste = 1 + (Number(c.ajuste_entradas_pct) || 0) / 100;
        let menor = saldo;
        for (let d = dia0; d <= nDias; d++) {
          const f = fluxo[d] > 0 ? Math.round(fluxo[d] * ajuste) : fluxo[d];
          saldo += f;
          if (saldo < menor) menor = saldo;
          if (negativo == null && saldo < 0) negativo = `${mes}-${String(d).padStart(2, '0')}`;
        }
        if (folego == null && saldo < 0) folego = i;
        out.push({ mes, entradas: reais(Math.round(entra * ajuste)), saidas: reais(sai), resultado: reais(Math.round(entra * ajuste) - sai), saldo: reais(saldo), menor_saldo: reais(menor) });
      });
      return { tipo, meses: out, saldo_final: out.length ? out[out.length - 1].saldo : reais(saldo), primeiro_dia_negativo: negativo,
        folego_meses: folego == null ? null : folego, menor_saldo: out.length ? Math.min(...out.map((m) => m.menor_saldo)) : 0 };
    }
    const cen = { pessimista: rodar('pessimista'), base: rodar('base'), otimista: rodar('otimista') };
    const conf = confianca(mesesBase.length);
    return { meses, horizonte: H, ...cen, confianca: conf,
      premissas: { variaveis_base: reais(varBase), variaveis_alto: reais(varAlto), outras_entradas: reais(outrasMedia), atraso_medio_dias: atraso, em_risco: [...risco], pipeline: pipe.length,
        pipeline_ponderado: reais(pipe.reduce((s, o) => s + Math.round(centavos(o.valor_mensal) * (Number(o.chance) || 0)), 0)), entradas_pela_media: semContratos,
        fixos: reais(fixos.filter((f) => X.fixoVigente(f, inicio)).reduce((s, f) => s + centavos(f.valor), 0)), combinados: reais(comb.reduce((s, x) => s + centavos(x.valor), 0)), meses_base: mesesBase } };
  }

  // ---------- Ponto de equilíbrio ----------
  function equilibrio({ mrr = 0, fixos = 0, combinados = 0, variaveis = 0 } = {}) {
    const fixo = centavos(fixos) + centavos(combinados), total = fixo + centavos(variaveis);
    return { mrr: reais(centavos(mrr)), custo_fixo: reais(fixo), custo_total: reais(total), cobre_fixo: centavos(mrr) >= fixo, cobre_total: centavos(mrr) >= total,
      falta_fixo: reais(Math.max(0, fixo - centavos(mrr))), falta_total: reais(Math.max(0, total - centavos(mrr))), pct_do_fixo: fixo ? Math.round(centavos(mrr) / fixo * 100) : null };
  }

  // ---------- Metas ----------
  function metas(m = {}, { mrr = 0, margem_pct = null, menor_saldo = 0 } = {}) {
    const out = [];
    if (Number(m.mrr) > 0) out.push({ id: 'mrr', nome: 'MRR', meta: Number(m.mrr), atual: mrr, falta: reais(Math.max(0, centavos(m.mrr) - centavos(mrr))), ok: centavos(mrr) >= centavos(m.mrr), pct: Math.round(mrr / Number(m.mrr) * 100) });
    if (m.margem_pct != null && m.margem_pct !== '') out.push({ id: 'margem', nome: 'Margem', meta: Number(m.margem_pct), atual: margem_pct, falta: margem_pct == null ? null : Math.max(0, Math.round((Number(m.margem_pct) - margem_pct) * 10) / 10), ok: margem_pct != null && margem_pct >= Number(m.margem_pct), unidade: '%' });
    if (Number(m.caixa_minimo) > 0) out.push({ id: 'caixa', nome: 'Caixa mínimo', meta: Number(m.caixa_minimo), atual: menor_saldo, falta: reais(Math.max(0, centavos(m.caixa_minimo) - centavos(menor_saldo))), ok: centavos(menor_saldo) >= centavos(m.caixa_minimo) });
    return out;
  }

  // ---------- Conferir em lote ----------
  // Para cada lançamento sem conferir: a regra que bateu (quando não pede revisão), senão o que foi decidido nos
  // lançamentos conferidos da MESMA contraparte (o mais comum), senão nada. A confiança diz quantos iguais viu.
  const chaveContra = (t) => semAcento(t.banco.contraparte || String(t.banco.historico || '').replace(/[\d/.,-]+/g, ' ')).replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
  function lote(lista = []) {
    const hist = new Map();
    for (const t of lista) {
      if (!t.real.conferido || t.real.partes?.length || t.real.categoria === 'a_classificar') continue;
      const k = chaveContra(t) + '|' + (t.banco.valor < 0 ? 's' : 'e');
      if (!chaveContra(t)) continue;
      const dec = { categoria: t.real.categoria, cliente_id: t.real.cliente_id || '', cliente_nome: t.real.cliente_nome || '', pessoa_id: t.real.pessoa_id || '', pessoa_nome: t.real.pessoa_nome || '', fixo_id: t.real.fixo_id || '', quem: t.real.quem || '' };
      const dk = JSON.stringify(dec), m = hist.get(k) || new Map(); m.set(dk, (m.get(dk) || 0) + 1); hist.set(k, m);
    }
    return lista.filter((t) => !t.real.conferido).map((t) => {
      const k = chaveContra(t) + '|' + (t.banco.valor < 0 ? 's' : 'e');
      const visto = hist.get(k);
      if (visto && visto.size) {
        const [dk, n] = [...visto].sort((a, b) => b[1] - a[1])[0];
        const tot = [...visto.values()].reduce((s, v) => s + v, 0);
        return { id: t.id, origem: 'historico', confianca: n / tot >= 0.75 && n >= 2 ? 'alta' : 'media', vezes: n, contraparte: chaveContra(t), sugestao: JSON.parse(dk) };
      }
      if (t.sugestao?.regra && t.real.categoria !== 'a_classificar') return { id: t.id, origem: 'regra', confianca: t.sugestao.revisar ? 'media' : 'alta', vezes: 0, contraparte: chaveContra(t),
        sugestao: { categoria: t.real.categoria, cliente_id: t.real.cliente_id || '', cliente_nome: t.real.cliente_nome || '', pessoa_id: t.real.pessoa_id || '', pessoa_nome: t.real.pessoa_nome || '', fixo_id: t.real.fixo_id || '', quem: t.real.quem || '' } };
      return { id: t.id, origem: 'nenhuma', confianca: 'baixa', vezes: 0, contraparte: chaveContra(t), sugestao: { categoria: t.real.categoria, cliente_id: t.real.cliente_id || '', cliente_nome: t.real.cliente_nome || '', pessoa_id: t.real.pessoa_id || '', pessoa_nome: t.real.pessoa_nome || '', fixo_id: '', quem: t.real.quem || '' } };
    });
  }
  // A regra que uma confirmação vira: o pedaço da contraparte (2–3 palavras) e o sentido.
  function regraDaConfirmacao(t, dec = {}) {
    const contra = t.banco.contraparte ? t.banco.contraparte.split(/\s+/).slice(0, 2).join(' ') : chaveContra(t);
    if (!contra || contra.length < 3) return null;
    return { contem: contra, sinal: t.banco.valor < 0 ? 'saida' : 'entrada', revisar: false, categoria: dec.categoria || t.real.categoria, quem: dec.quem || '',
      cliente_id: dec.cliente_id || '', cliente_nome: dec.cliente_nome || '', pessoa_id: dec.pessoa_id || '', pessoa_nome: dec.pessoa_nome || '', fixo_id: dec.fixo_id || '', nota: 'confirmado em lote' };
  }

  // ---------- Saídas que se repetem (candidatas a gasto fixo) ----------
  function repetidas(lista = [], fixos = []) {
    const grupos = new Map();
    const ligados = new Set(fixos.map((f) => f.id));
    for (const t of lista) {
      if (t.banco.valor >= 0 || (t.real.fixo_id && ligados.has(t.real.fixo_id))) continue;
      if (['cartao_agencia', 'salario', 'pro_labore', 'retirada_socio', 'freela', 'combustivel', 'alimentacao', 'juros_banco', 'adiantamento', 'tarifa_bancaria'].includes(t.real.categoria)) continue;
      const nome = (t.banco.contraparte || String(t.banco.historico).replace(/\d[\d/.]*/g, '').trim()).slice(0, 40);
      const k = semAcento(nome).replace(/\s+/g, ' ').trim();
      if (!k) continue;
      const g = grupos.get(k) || { nome, categoria: t.real.categoria, itens: [] };
      g.itens.push({ id: t.id, mes: t.banco.data.slice(0, 7), dia: Number(t.banco.data.slice(8, 10)), valor: Math.abs(t.banco.valor) });
      grupos.set(k, g);
    }
    const ja = fixos.map((f) => semAcento(f.contem || f.nome)).filter(Boolean);
    const out = [];
    for (const g of grupos.values()) {
      const meses = [...new Set(g.itens.map((i) => i.mes))];
      if (meses.length < 2) continue;
      if (ja.some((j) => semAcento(g.nome).includes(j) || j.includes(semAcento(g.nome)))) continue;
      // Valor parecido: o de cada mês a até 15% da mediana.
      const porMes = meses.map((m) => g.itens.filter((i) => i.mes === m).reduce((s, i) => s + i.valor, 0));
      const med = percentil(porMes, 0.5);
      if (!porMes.every((v) => Math.abs(v - med) <= med * 0.15)) continue;
      out.push({ nome: g.nome, categoria: g.categoria, meses: meses.length, valor: Math.round(med * 100) / 100, dia: Math.round(media(g.itens.map((i) => i.dia))), contem: g.nome.slice(0, 40), ids: g.itens.map((i) => i.id) });
    }
    return out.sort((a, b) => b.meses - a.meses || b.valor - a.valor);
  }

  // ---------- Extrato parado ----------
  function extratoParado(lista = [], hoje) {
    const datas = lista.filter((t) => t.banco.saldo != null).map((t) => t.banco.data).sort();
    const ult = datas[datas.length - 1] || '';
    if (!ult || !ehDia(hoje)) return { ultimo: ult, dias: null, parado: false };
    const dias = Math.max(0, diasEntre(ult, hoje));
    return { ultimo: ult, dias, parado: dias > 7 };
  }

  // ---------- Achados do Vorcaro (regras e números, nenhum modelo pago) ----------
  // ctx: { hoje, mrr (recorrente()), margem (margemClientes()), receitaPorCliente: [[nome, valor]], projecao (projecao3()),
  //        orcamento (orcadoReal() do mês corrente), fechados: Set('AAAA-MM'), mesesExtrato, parado (extratoParado()), saidaMediaMes }
  function achados(ctx = {}) {
    const out = [];
    const rs = (v) => `R$ ${Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const hoje = ctx.hoje || '', mesHoje = hoje.slice(0, 7);
    const parado = ctx.parado;
    if (parado?.parado) out.push({ g: 3, id: 'extrato_parado', rot: 'Extrato parado', det: `${parado.dias} dias sem extrato novo`, impacto: reais(Math.round(centavos(ctx.saidaMediaMes || 0) / 30 * parado.dias)),
      texto: `O extrato parou em ${parado.ultimo.split('-').reverse().join('/')}: são ${parado.dias} dias sem ver o banco.`, fazer: 'Exporte o extrato do Santander a partir desse dia e importe em Movimento.', aba: 'fin_movimento' });
    const pj = ctx.projecao;
    if (pj?.base) {
      const f = pj.base.folego_meses;
      if (f != null && f < 3) out.push({ g: 3, id: 'folego', rot: 'Fôlego abaixo de 3 meses', det: pj.base.primeiro_dia_negativo ? `negativo em ${pj.base.primeiro_dia_negativo.split('-').reverse().join('/')}` : `${f} meses`,
        impacto: Math.abs(pj.base.menor_saldo), texto: `No cenário base, o caixa fica negativo${pj.base.primeiro_dia_negativo ? ` em ${pj.base.primeiro_dia_negativo.split('-').reverse().join('/')}` : ''}.`,
        fazer: `Cobrir ${rs(pj.base.menor_saldo)} até lá: cobrar o que está vencido, adiar um gasto ou trazer receita nova.`, aba: 'fin_projecao' });
    }
    const m = ctx.mrr;
    if (m?.meses?.length >= 2) {
      const a = m.meses[m.meses.length - 1], b = m.meses[Math.max(0, m.meses.length - 3)];
      if (a.mrr < b.mrr) out.push({ g: 2, id: 'mrr_caindo', rot: 'MRR caindo', det: `${rs(b.mrr)} → ${rs(a.mrr)}`, impacto: reais(centavos(b.mrr) - centavos(a.mrr)),
        texto: `A receita recorrente caiu de ${rs(b.mrr)} para ${rs(a.mrr)} por mês.`, fazer: 'Veja na cascata quem saiu ou reduziu e o que repõe essa receita.', aba: 'fin_analise', sub: 'recorrente' });
    }
    for (const l of (ctx.margem?.prejuizo || []).slice(0, 3)) out.push({ g: 2, id: 'margem_' + l.cliente_id, rot: `${l.cliente_nome} dá prejuízo`, det: `margem ${rs(l.margem)}`, impacto: Math.abs(l.margem),
      texto: `${l.cliente_nome} custou ${rs(l.custo_direto + l.custo_equipe)} e trouxe ${rs(l.receita)} no período.`, fazer: `Rever o escopo ou o preço de ${l.cliente_nome} (${l.pecas} peças no período).`, aba: 'fin_analise', sub: 'margem' });
    const rc = (ctx.receitaPorCliente || []).filter(([, v]) => v > 0), tot = rc.reduce((s, [, v]) => s + v, 0);
    if (tot > 0 && rc.length) {
      const [nome, v] = rc.slice().sort((x, y) => y[1] - x[1])[0], pct = Math.round(v / tot * 100);
      if (pct > 40) out.push({ g: 2, id: 'concentracao', rot: 'Receita concentrada', det: `${nome}: ${pct}%`, impacto: v, texto: `${nome} é ${pct}% da receita do período.`, fazer: 'Perder esse cliente derruba o caixa: diversifique a carteira antes de depender mais dele.', aba: 'fin_projecao' });
    }
    for (const e of (ctx.orcamento?.estourados || []).slice(0, 3)) out.push({ g: 1, id: 'orc_' + e.grupo, rot: `Orçamento estourado: ${e.grupo}`, det: `${rs(e.real)} de ${rs(e.orcado)}`, impacto: e.desvio,
      texto: `${e.grupo} já gastou ${rs(e.real)} de ${rs(e.orcado)} orçados.`, fazer: `Segurar ${e.grupo} pelo resto do mês ou ajustar o orçamento.`, aba: 'fin_analise', sub: 'orcamento' });
    const fechados = ctx.fechados instanceof Set ? ctx.fechados : new Set(ctx.fechados || []);
    const abertos = (ctx.mesesExtrato || []).filter((x) => x < mesHoje && !fechados.has(x));
    if (abertos.length) out.push({ g: 1, id: 'mes_aberto', rot: abertos.length === 1 ? 'Mês sem fechar' : 'Meses sem fechar', det: abertos.map((x) => x.split('-').reverse().join('/')).join(', '), impacto: ctx.valorAbertos || 0,
      texto: `${abertos.length === 1 ? 'O mês' : 'Os meses'} ${abertos.map((x) => x.split('-').reverse().join('/')).join(', ')} ainda não ${abertos.length === 1 ? 'foi fechado' : 'foram fechados'}.`, fazer: 'Rode o checklist e feche para mandar o resumo à contabilidade.', aba: 'fin_fechamento' });
    return out.sort((x, y) => y.g - x.g || (y.impacto || 0) - (x.impacto || 0));
  }

  const api = Object.freeze({ confianca, vigente, valorNoMes, vencimento, LINHAS_DRE, LINHA_DA, dre, recorrente, margemClientes, FAIXAS, aging, atrasoMedioPago, GRUPOS_ORCAMENTO, realPorGrupo,
    orcadoReal, copiarOrcamento, sugerirOrcamento, checklistFechamento, resumoContabil, historico, variaveisPorMes, variaveisDetalhe, entradasForaDeContrato, projecao3, equilibrio, metas, lote, regraDaConfirmacao,
    repetidas, extratoParado, achados, mesesEntre, percentil });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybeFinancasAnalises = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
