// shared/comercial-calculos.js — contas do setor Comercial (Paulo, 07/11/2026; inspirado no AgencyFlow).
//
// Funções puras: não leem DOM, rede nem banco. O servidor (server/comercial.js) e a janela do Irecity
// (vybe-mundo-comercial.js) usam as mesmas. No navegador ficam em window.VybeComercialCalculos.
//
// ── Definições ──────────────────────────────────────────────────────────────────
// Funil comercial (fases que o time vê) sobre as etapas do CRM de prospecção (server/crm.js):
//   Novo            = empresa, qualificação, abordagem proposta, aprovada (antes do primeiro contato;
//                     a aprovação humana do SDR continua valendo)
//   Primeiro contato = contato_feito · Apresentação = reuniao · Proposta = proposta_comercial
//   Follow-up       = follow_up · Ganho · Perdido (motivo obrigatório)
// Conversão da fase = quantos chegaram à fase seguinte ÷ quantos chegaram a esta. "Chegou" = a fase atual,
//   ou a fase de onde saiu para Perdido (etapa_antes_perda, do histórico); Ganho conta como tendo passado
//   por todas (o Follow-up é opcional). Perdido sem etapa anterior conhecida conta só em Novo.
// Em negociação = oportunidades abertas (nem ganho nem perdido): soma do valor mensal (recorrente) e do
//   valor avulso, separados.
// Pacote: custo estimado = horas × custo/hora + captações × custo por captação. Margem = preço − custo;
//   margem % = margem ÷ preço (sem preço: null).
// Finanças por cliente: custo = custo estimado do pacote do contrato; margem % sobre o valor mensal;
//   zona crítica = margem abaixo de 20%.
// Produto campeão = pacote com mais negócios ganhos (empate: maior receita). Ticket médio = média do valor
//   mensal dos ganhos com valor mensal, e média do avulso dos ganhos com valor avulso (separados).
// Orçamento: subtotal por tipo (recorrente/avulso) = preço × quantidade; o desconto % vale para os dois.
// Dinheiro sempre em centavos inteiros nas contas (sem erro de ponto flutuante); a saída volta em reais.
(function (raiz) {
  'use strict';
  // Etapas do CRM: as do SDR (antes do primeiro contato) e o fim são fixos; o meio é configurável pelos donos
  // (adicionar etapa e reordenar; server/crm.js etapasCrm). Cada etapa do meio é uma fase do funil.
  const ETAPAS_INICIO = Object.freeze(['empresa', 'qualificacao', 'abordagem_proposta', 'aprovada']);
  const ETAPAS_MEIO_PADRAO = Object.freeze(['contato_feito', 'reuniao', 'proposta_comercial', 'follow_up']);
  const FASE_DA_ETAPA = Object.freeze({ contato_feito: ['primeiro_contato', 'Primeiro contato'], reuniao: ['apresentacao', 'Apresentação'],
    proposta_comercial: ['proposta', 'Proposta'], follow_up: ['follow_up', 'Follow-up'] });
  // etapas: a lista ordenada do CRM [{ id, nome }] (todas, com início, meio, ganho e perdido).
  function montarFases(etapas) {
    const meio = (etapas || []).map((e) => (typeof e === 'string' ? { id: e, nome: e } : e))
      .filter((e) => !ETAPAS_INICIO.includes(e.id) && !['ganho', 'perdido'].includes(e.id));
    const lista = meio.length ? meio : ETAPAS_MEIO_PADRAO.map((id) => ({ id }));
    return Object.freeze([
      { id: 'novo', nome: 'Novo', etapas: [...ETAPAS_INICIO] },
      ...lista.map((e) => ({ id: FASE_DA_ETAPA[e.id]?.[0] || e.id, nome: e.extra || !FASE_DA_ETAPA[e.id] ? e.nome || e.id : (e.nome_fase || FASE_DA_ETAPA[e.id][1]), etapas: [e.id], extra: !FASE_DA_ETAPA[e.id] })),
      { id: 'ganho', nome: 'Ganho', etapas: ['ganho'] },
      { id: 'perdido', nome: 'Perdido', etapas: ['perdido'] },
    ].map(Object.freeze));
  }
  const FASES = montarFases(null);
  const MOTIVOS_PERDA = Object.freeze([
    ['preco', 'Preço'], ['sem_retorno', 'Sem retorno'], ['fechou_com_outro', 'Fechou com outro'],
    ['sem_verba', 'Sem verba'], ['timing', 'Timing'], ['outro', 'Outro'],
  ].map(([id, nome]) => Object.freeze({ id, nome })));
  const STATUS_PAGAMENTO = Object.freeze([
    ['em_dia', 'Em dia'], ['atrasado', 'Atrasado'], ['inadimplente', 'Inadimplente'],
  ].map(([id, nome]) => Object.freeze({ id, nome })));
  const ZONA_CRITICA = 20;

  const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const reais = (c) => c / 100;
  const pct = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null);

  function faseDaEtapa(etapa, fases = FASES) {
    const f = fases.find((x) => x.etapas.includes(etapa));
    return f ? f.id : null;
  }

  function validarMotivoPerda(motivo, texto) {
    const m = MOTIVOS_PERDA.find((x) => x.id === motivo);
    if (!m) throw Object.assign(new Error('Escolha o motivo da perda.'), { status: 400 });
    const t = typeof texto === 'string' ? texto.trim() : '';
    if (t.length > 500) throw Object.assign(new Error('Motivo: máximo de 500 caracteres.'), { status: 400 });
    if (m.id === 'outro' && !t) throw Object.assign(new Error('Em "Outro", escreva o motivo da perda.'), { status: 400 });
    return { motivo: m.id, motivo_nome: m.nome, texto: t };
  }

  function custoPacote(p) {
    const horas = Math.max(0, Number(p?.horas) || 0), hora = Math.max(0, centavos(p?.custo_hora));
    const capt = Math.max(0, Number(p?.captacoes) || 0), porCapt = Math.max(0, centavos(p?.custo_captacao));
    return reais(Math.round(horas * hora + capt * porCapt));
  }
  function margem(preco, custo) {
    const p = centavos(preco), c = centavos(custo), m = p - c;
    return { valor: reais(m), percentual: pct(m, p), critica: p > 0 ? (m / p) * 100 < ZONA_CRITICA : c > 0 };
  }
  function pacoteComMargem(p) {
    const custo = custoPacote(p), m = margem(p?.preco, custo);
    return { ...p, custo, margem: m.valor, margem_percentual: m.percentual, zona_critica: m.critica };
  }

  function financasCliente({ valor_mensal, pacote } = {}) {
    const valor = reais(Math.max(0, centavos(valor_mensal)));
    const custo = pacote ? custoPacote(pacote) : null;
    if (custo == null) return { valor_mensal: valor, custo: null, margem: null, margem_percentual: null, zona_critica: false, sem_pacote: true };
    const m = margem(valor, custo);
    return { valor_mensal: valor, custo, margem: m.valor, margem_percentual: m.percentual, zona_critica: m.critica, sem_pacote: false };
  }
  function resumoFinancas(linhas) {
    let receita = 0, custo = 0, criticas = 0;
    const pagamento = Object.fromEntries(STATUS_PAGAMENTO.map((s) => [s.id, 0]));
    for (const l of linhas || []) {
      const f = financasCliente(l);
      receita += centavos(f.valor_mensal); custo += centavos(f.custo || 0);
      if (f.zona_critica) criticas++;
      if (l.status_pagamento in pagamento) pagamento[l.status_pagamento]++;
    }
    const m = receita - custo;
    return { receita: reais(receita), custo: reais(custo), margem: reais(m), margem_percentual: pct(m, receita), criticas, pagamento };
  }

  function totalOrcamento({ itens = [], desconto_percentual = 0 } = {}) {
    const d = Math.min(100, Math.max(0, Number(desconto_percentual) || 0));
    const sub = { recorrente: 0, avulso: 0 };
    for (const i of itens) {
      const q = Math.max(0, Math.floor(Number(i.quantidade) || 0));
      sub[i.tipo === 'recorrente' ? 'recorrente' : 'avulso'] += centavos(i.preco) * q;
    }
    const desc = (c) => Math.round(c * d / 100);
    const total = { recorrente: sub.recorrente - desc(sub.recorrente), avulso: sub.avulso - desc(sub.avulso) };
    return {
      desconto_percentual: d,
      subtotal_recorrente: reais(sub.recorrente), subtotal_avulso: reais(sub.avulso),
      desconto: reais(desc(sub.recorrente) + desc(sub.avulso)),
      total_recorrente: reais(total.recorrente), total_avulso: reais(total.avulso),
      total: reais(total.recorrente + total.avulso),
    };
  }

  // oportunidades: [{ etapa, etapa_antes_perda?, motivo_perda?, valor_mensal?, valor_avulso?, pacote_id? }]
  function resumoFunil(oportunidades, FASES = montarFases(null)) {
    const lista = Array.isArray(oportunidades) ? oportunidades : [];
    const indiceFase = (id) => FASES.findIndex((f) => f.id === id), iGanho = indiceFase('ganho');
    const ABERTAS = new Set(FASES.slice(0, iGanho).map((f) => f.id));
    const atual = Object.fromEntries(FASES.map((f) => [f.id, 0]));
    const alcancaram = Object.fromEntries(FASES.slice(0, iGanho + 1).map((f) => [f.id, 0]));
    const motivos = Object.fromEntries(MOTIVOS_PERDA.map((m) => [m.id, 0]));
    let mensal = 0, avulso = 0, abertas = 0, perdidosSemMotivo = 0;
    for (const o of lista) {
      const fase = faseDaEtapa(o.etapa, FASES); if (!fase) continue;
      atual[fase]++;
      let ate;
      if (fase === 'ganho') ate = indiceFase('ganho');
      else if (fase === 'perdido') {
        const antes = faseDaEtapa(o.etapa_antes_perda, FASES);
        ate = antes && antes !== 'perdido' && antes !== 'ganho' ? indiceFase(antes) : 0;
        if (o.motivo_perda in motivos) motivos[o.motivo_perda]++; else perdidosSemMotivo++;
      } else ate = indiceFase(fase);
      for (let i = 0; i <= ate; i++) alcancaram[FASES[i].id]++;
      if (ABERTAS.has(fase)) { abertas++; mensal += centavos(o.valor_mensal); avulso += centavos(o.valor_avulso); }
    }
    const fases = FASES.map((f, i) => {
      const prox = FASES[i + 1];
      const conv = i < iGanho && prox ? pct(alcancaram[prox.id], alcancaram[f.id]) : null;
      return { id: f.id, nome: f.nome, atual: atual[f.id], alcancaram: f.id in alcancaram ? alcancaram[f.id] : atual[f.id], conversao: conv };
    });
    const perdidos = atual.perdido, encerradas = atual.ganho + perdidos;
    return {
      fases,
      total: lista.length,
      em_negociacao: { quantidade: abertas, mensal: reais(mensal), avulso: reais(avulso) },
      taxa_ganho: pct(atual.ganho, encerradas),
      motivos_perda: MOTIVOS_PERDA.map((m) => ({ id: m.id, nome: m.nome, quantidade: motivos[m.id], percentual: pct(motivos[m.id], perdidos) }))
        .concat(perdidosSemMotivo ? [{ id: 'sem_registro', nome: 'Sem motivo registrado', quantidade: perdidosSemMotivo, percentual: pct(perdidosSemMotivo, perdidos) }] : []),
    };
  }

  function produtoCampeao(oportunidades, pacotes) {
    const ganhos = (oportunidades || []).filter((o) => o.etapa === 'ganho');
    const porPacote = new Map();
    for (const o of ganhos) {
      if (o.pacote_id == null || o.pacote_id === '') continue;
      const k = String(o.pacote_id), a = porPacote.get(k) || { ganhos: 0, receita: 0 };
      a.ganhos++; a.receita += centavos(o.valor_mensal) + centavos(o.valor_avulso); porPacote.set(k, a);
    }
    let campeao = null;
    for (const [id, a] of porPacote) {
      if (!campeao || a.ganhos > campeao.ganhos || (a.ganhos === campeao.ganhos && a.receita > campeao.receita_c)) {
        const p = (pacotes || []).find((x) => String(x.id) === id);
        campeao = { pacote_id: id, nome: p?.nome || 'Pacote removido', ganhos: a.ganhos, receita_c: a.receita };
      }
    }
    if (campeao) { campeao.receita = reais(campeao.receita_c); delete campeao.receita_c; }
    const comMensal = ganhos.filter((o) => centavos(o.valor_mensal) > 0), comAvulso = ganhos.filter((o) => centavos(o.valor_avulso) > 0);
    const media = (l, campo) => (l.length ? reais(Math.round(l.reduce((s, o) => s + centavos(o[campo]), 0) / l.length)) : null);
    return { campeao, ganhos: ganhos.length, ticket_medio_mensal: media(comMensal, 'valor_mensal'), ticket_medio_avulso: media(comAvulso, 'valor_avulso') };
  }

  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function filtrarCreators(lista, { nicho = '', cidade = '', busca = '' } = {}) {
    const n = semAcento(nicho), c = semAcento(cidade), b = semAcento(busca).replace(/^@/, '');
    return (lista || []).filter((x) => (!n || semAcento(x.nicho) === n) && (!c || semAcento(x.cidade) === c)
      && (!b || `${semAcento(x.nome)} ${semAcento(x.arroba).replace(/^@/, '')}`.includes(b)))
      .sort((a, z) => (Number(z.seguidores) || 0) - (Number(a.seguidores) || 0) || String(a.nome).localeCompare(String(z.nome), 'pt-BR'));
  }
  function opcoesCreators(lista) {
    const unicos = (campo) => [...new Map((lista || []).filter((x) => String(x[campo] || '').trim()).map((x) => [semAcento(x[campo]), String(x[campo]).trim()])).values()]
      .sort((a, z) => a.localeCompare(z, 'pt-BR'));
    return { nichos: unicos('nicho'), cidades: unicos('cidade') };
  }

  // ── Finanças da agência (recebimentos, contas a pagar, inadimplência, fornecedores) ──────────────
  // Datas são texto YYYY-MM-DD (dia de calendário, sem fuso). "hoje" vem de quem chama.
  // Período: mensal (o mês escolhido) ou anual (o ano do mês escolhido); "anterior" = mês ou ano anterior.
  // Recebível (uma fatura): cancelado não conta. Em aberto = valor − recebido. Status:
  //   recebido (em aberto = 0) · parcial/pendente (não venceu) · atrasado (venceu há 1 a 30 dias)
  //   · inadimplente (venceu há mais de 30 dias). Totais do período (pelo vencimento): a receber = soma dos valores;
  //   recebido = soma do recebido; inadimplente = em aberto dos inadimplentes; pendente = o resto em aberto.
  // Contas a pagar no período (pelo vencimento, sem as canceladas). % do faturamento = total do grupo ÷ "a receber"
  //   do mesmo período. Fixo = fixas + folha; variável = variáveis + impostos + investimentos.
  //   "A pagar em 7 dias" = não pagas com vencimento de hoje até hoje + 7 (vencidas não pagas aparecem à parte).
  // Inadimplência: faturas em aberto já vencidas (qualquer período), por cliente; severidade pelo atraso mais antigo:
  //   mais de 30 dias = crítico (u1), 8 a 30 = alto (u2), 1 a 7 = atenção (u3).
  const CICLOS = Object.freeze({ mensal: 1, trimestral: 3, semestral: 6, anual: 12 });
  const GRUPOS_CONTAS = Object.freeze([
    ['fixa', 'Fixas'], ['variavel', 'Variáveis'], ['folha', 'Folha'], ['imposto', 'Impostos'], ['investimento', 'Investimentos'],
  ].map(([id, nome]) => Object.freeze({ id, nome })));
  const CATEGORIAS_FORNECEDOR = Object.freeze([
    ['grafica', 'Gráfica'], ['eventos', 'Eventos'], ['brindes', 'Brindes'], ['audiovisual', 'Audiovisual'], ['fotografia', 'Fotografia'],
    ['midia_ooh', 'Mídia OOH'], ['trafego', 'Tráfego'], ['ti', 'TI'], ['cenografia', 'Cenografia'], ['textil', 'Têxtil'], ['outros', 'Outros'],
  ].map(([id, nome]) => Object.freeze({ id, nome })));
  const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  const diaIso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
  const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5);
  const fimDoMes = (a, m) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  function somarMeses(iso, n) {
    const [a, m, d] = iso.split('-').map(Number), alvo = new Date(Date.UTC(a, m - 1 + n, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10);
  }
  function periodo(mes, tipo = 'mensal') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) throw Object.assign(new Error('Mês inválido (use AAAA-MM).'), { status: 400 });
    const [a, m] = mes.split('-').map(Number);
    if (tipo === 'anual') return { tipo, mes, inicio: a + '-01-01', fim: a + '-12-31', anterior: { inicio: (a - 1) + '-01-01', fim: (a - 1) + '-12-31' }, rotulo: String(a) };
    const ant = m === 1 ? [a - 1, 12] : [a, m - 1];
    return { tipo: 'mensal', mes, inicio: mes + '-01', fim: fimDoMes(a, m), anterior: { inicio: ant[0] + '-' + String(ant[1]).padStart(2, '0') + '-01', fim: fimDoMes(ant[0], ant[1]) }, rotulo: mes };
  }
  const noIntervalo = (d, p) => d >= p.inicio && d <= p.fim;
  function proximoVencimento(iso, ciclo) {
    if (!CICLOS[ciclo]) throw Object.assign(new Error('Ciclo inválido.'), { status: 400 });
    return somarMeses(diaIso(iso), CICLOS[ciclo]);
  }
  function statusRecebivel(r, hoje) {
    if (r.cancelado) return { status: 'cancelado', aberto: 0, atraso: 0 };
    const aberto = Math.max(0, centavos(r.valor) - centavos(r.valor_recebido)), venc = diaIso(r.vencimento);
    if (aberto <= 0) return { status: 'recebido', aberto: 0, atraso: 0 };
    const atraso = Math.max(0, diasEntre(venc, hoje));
    const status = atraso > 30 ? 'inadimplente' : atraso > 0 ? 'atrasado' : centavos(r.valor_recebido) > 0 ? 'parcial' : 'pendente';
    return { status, aberto: reais(aberto), atraso };
  }
  function totaisRecebimentos(lista, p, hoje) {
    const t = { a_receber: 0, recebido: 0, pendente: 0, inadimplente: 0, quantidade: 0 };
    for (const r of lista || []) {
      if (r.cancelado || !noIntervalo(diaIso(r.vencimento), p)) continue;
      const s = statusRecebivel(r, hoje), ab = centavos(s.aberto);
      t.quantidade++; t.a_receber += centavos(r.valor); t.recebido += Math.min(centavos(r.valor_recebido), centavos(r.valor));
      if (s.status === 'inadimplente') t.inadimplente += ab; else t.pendente += ab;
    }
    return { a_receber: reais(t.a_receber), recebido: reais(t.recebido), pendente: reais(t.pendente), inadimplente: reais(t.inadimplente), quantidade: t.quantidade };
  }
  function variacao(atual, anterior) { const a = centavos(atual), b = centavos(anterior); return b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null; }
  function resumoRecebimentos(lista, p, hoje) {
    const atual = totaisRecebimentos(lista, p, hoje), anterior = totaisRecebimentos(lista, p.anterior, hoje);
    return { atual, anterior, variacao: Object.fromEntries(Object.keys(atual).filter((k) => k !== 'quantidade').map((k) => [k, variacao(atual[k], anterior[k])])) };
  }
  function totaisContas(lista, p) {
    const g = Object.fromEntries(GRUPOS_CONTAS.map((x) => [x.id, 0]));
    let pago = 0;
    for (const c of lista || []) {
      if (c.cancelada || !(c.grupo in g) || !noIntervalo(diaIso(c.vencimento), p)) continue;
      g[c.grupo] += centavos(c.valor); if (c.pago_em) pago += centavos(c.valor);
    }
    const total = Object.values(g).reduce((s, v) => s + v, 0);
    return { grupos: g, total, pago, fixo: g.fixa + g.folha, variavel: g.variavel + g.imposto + g.investimento };
  }
  function resumoContas(lista, p, hoje, faturamento = 0, faturamentoAnterior = 0) {
    const a = totaisContas(lista, p), b = totaisContas(lista, p.anterior), fat = centavos(faturamento);
    const seteDias = [], vencidas = [];
    for (const c of lista || []) {
      if (c.cancelada || c.pago_em) continue;
      const v = diaIso(c.vencimento);
      if (v < hoje) vencidas.push(c); else if (v <= somarDias(hoje, 7)) seteDias.push(c);
    }
    const soma = (l) => reais(l.reduce((s, c) => s + centavos(c.valor), 0));
    return {
      grupos: GRUPOS_CONTAS.map((x) => ({ id: x.id, nome: x.nome, total: reais(a.grupos[x.id]), percentual_faturamento: pct(a.grupos[x.id], fat),
        anterior: reais(b.grupos[x.id]), variacao: variacao(reais(a.grupos[x.id]), reais(b.grupos[x.id])) })),
      total: reais(a.total), total_anterior: reais(b.total), variacao_total: variacao(reais(a.total), reais(b.total)), pago: reais(a.pago), a_pagar: reais(a.total - a.pago),
      percentual_faturamento: pct(a.total, fat),
      fixo: reais(a.fixo), variavel: reais(a.variavel), fixo_percentual: pct(a.fixo, a.total), variavel_percentual: pct(a.variavel, a.total),
      sete_dias: { quantidade: seteDias.length, total: soma(seteDias), contas: seteDias.sort((x, z) => diaIso(x.vencimento).localeCompare(diaIso(z.vencimento))) },
      vencidas: { quantidade: vencidas.length, total: soma(vencidas) },
      resultado: reais(fat - a.total), resultado_anterior: reais(centavos(faturamentoAnterior) - b.total),
    };
  }
  function severidade(atraso) { return atraso > 30 ? { nivel: 'u1', nome: 'Crítico' } : atraso > 7 ? { nivel: 'u2', nome: 'Alto' } : { nivel: 'u3', nome: 'Atenção' }; }
  function inadimplencia(lista, hoje) {
    const porCliente = new Map(), faturas = [];
    for (const r of lista || []) {
      const s = statusRecebivel(r, hoje);
      if (!['atrasado', 'inadimplente'].includes(s.status)) continue;
      faturas.push({ ...r, ...s, severidade: severidade(s.atraso) });
      const k = r.cliente_id != null ? 'c' + r.cliente_id : 'd' + semAcento(r.descricao || 'avulso');
      const a = porCliente.get(k) || { cliente_id: r.cliente_id ?? null, cliente_nome: r.cliente_nome || r.descricao || 'Sem cliente', valor_c: 0, faturas: 0, atraso_mais_antigo: 0, vencimento_mais_antigo: null };
      a.valor_c += centavos(s.aberto); a.faturas++;
      if (s.atraso > a.atraso_mais_antigo) { a.atraso_mais_antigo = s.atraso; a.vencimento_mais_antigo = diaIso(r.vencimento); }
      porCliente.set(k, a);
    }
    const clientes = [...porCliente.values()].map(({ valor_c, ...a }) => ({ ...a, valor: reais(valor_c), severidade: severidade(a.atraso_mais_antigo) }))
      .sort((x, z) => z.atraso_mais_antigo - x.atraso_mais_antigo || z.valor - x.valor);
    faturas.sort((x, z) => z.atraso - x.atraso);
    return { clientes, faturas, total: reais(clientes.reduce((s, c) => s + centavos(c.valor), 0)), criticos: clientes.filter((c) => c.severidade.nivel === 'u1').length };
  }
  function filtrarFornecedores(lista, { categoria = '', busca = '' } = {}) {
    const b = semAcento(busca);
    return (lista || []).filter((f) => (!categoria || f.categoria === categoria) && (!b || semAcento(f.nome + ' ' + (f.contato || '')).includes(b)))
      .sort((a, z) => String(a.nome).localeCompare(String(z.nome), 'pt-BR'));
  }

  // ── Previsão de caixa (mês atual e os 3 seguintes) ───────────────────────────────────────────────
  // Entradas do mês = recebíveis RECORRENTES não cancelados com vencimento no mês (o valor da fatura, recebida ou não)
  //   + a projeção de cada série recorrente (mesmo cliente e ciclo) a partir da última fatura lançada, de ciclo em ciclo.
  // Saídas do mês = contas fixas + folha (não canceladas) com vencimento no mês. Mês futuro sem nenhuma lançada repete o
  //   total fixo + folha do mês atual e vem marcado "estimado".
  // Saldo = entradas − saídas. Alerta de concentração: cliente com risco ALTO de churn (lista vinda da Carteira, se houver)
  //   que represente mais de 15% das entradas recorrentes do mês atual.
  const LIMITE_CONCENTRACAO = 15;
  function mesesAPartir(hoje, n) {
    const [a, m] = diaIso(hoje).split('-').map(Number);
    return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(a, m - 1 + i, 1)); return d.toISOString().slice(0, 7); });
  }
  const chaveNome = (s) => semAcento(s).replace(/[^a-z0-9]+/g, ' ').trim();
  function riscoAlto(r) {
    const v = semAcento(r?.risco ?? r?.churn ?? r?.risco_churn ?? r?.nivel ?? '');
    return v === 'alto' || v === 'alta' || v === 'critico' || v === 'u1' || (Number.isFinite(Number(r?.risco_churn)) && Number(r.risco_churn) >= 70);
  }
  function previsaoCaixa({ recebiveis = [], contas = [], hoje, meses = 4, churn = [] } = {}) {
    const lista = mesesAPartir(hoje, meses), ultimo = lista[lista.length - 1];
    const entradas = Object.fromEntries(lista.map((m) => [m, 0])), porCliente = {};
    const series = new Map();
    for (const r of recebiveis) {
      if (r.cancelado || r.tipo !== 'recorrente') continue;
      const v = diaIso(r.vencimento), m = v.slice(0, 7);
      if (m in entradas) { entradas[m] += centavos(r.valor); if (m === lista[0]) porCliente[r.cliente_id] = (porCliente[r.cliente_id] || 0) + centavos(r.valor); }
      const k = String(r.cliente_id) + '|' + r.ciclo, s = series.get(k);
      if (!s || v > s.vencimento) series.set(k, { ...r, vencimento: v });
    }
    for (const s of series.values()) {
      if (!CICLOS[s.ciclo]) continue;
      let v = s.vencimento;
      for (let i = 0; i < 60; i++) {
        v = proximoVencimento(v, s.ciclo); const m = v.slice(0, 7);
        if (m > ultimo) break;
        if (m in entradas) { entradas[m] += centavos(s.valor); if (m === lista[0]) porCliente[s.cliente_id] = (porCliente[s.cliente_id] || 0) + centavos(s.valor); }
      }
    }
    const saidas = Object.fromEntries(lista.map((m) => [m, 0])), lancadas = Object.fromEntries(lista.map((m) => [m, 0]));
    for (const c of contas) {
      if (c.cancelada || !['fixa', 'folha'].includes(c.grupo)) continue;
      const m = diaIso(c.vencimento).slice(0, 7);
      if (m in saidas) { saidas[m] += centavos(c.valor); lancadas[m]++; }
    }
    const base = saidas[lista[0]];
    const mesesOut = lista.map((m, i) => {
      const estimado = i > 0 && !lancadas[m];
      const s = estimado ? base : saidas[m];
      return { mes: m, entradas: reais(entradas[m]), saidas: reais(s), saldo: reais(entradas[m] - s), saidas_estimadas: estimado };
    });
    const totalAtual = entradas[lista[0]], alertas = [];
    for (const r of churn || []) {
      if (!riscoAlto(r)) continue;
      const id = r.cliente_id ?? r.id, nome = r.cliente_nome ?? r.nome ?? r.cliente ?? '';
      let valor = id != null && porCliente[String(id)] != null ? porCliente[String(id)] : 0;
      if (!valor && nome) for (const rec of recebiveis) if (rec.cliente_nome && chaveNome(rec.cliente_nome) === chaveNome(nome) && porCliente[rec.cliente_id]) { valor = porCliente[rec.cliente_id]; break; }
      const p = pct(valor, totalAtual);
      if (p != null && p > LIMITE_CONCENTRACAO) alertas.push({ cliente_id: id ?? null, cliente_nome: nome, percentual: p, valor: reais(valor) });
    }
    alertas.sort((a, z) => z.percentual - a.percentual);
    return { meses: mesesOut, alertas, limite_concentracao: LIMITE_CONCENTRACAO };
  }

  // ── Capacidade × vendas ──────────────────────────────────────────────────────────────────────────
  // Cargos = as funções do Escritório (vybe_escritorio_funcoes): Criação, Atendimento, Agendamento, Produção, Gestão.
  // Capacidade mensal de cada cargo = quantas demandas o cargo dá conta por mês (os donos configuram).
  // Carga atual = demandas abertas hoje no painel, uma vez para cada responsável, somadas pelo cargo da pessoa
  //   (proxy da carga do mês; pessoa sem cargo fica de fora e é contada à parte).
  // Acréscimo = carga do pacote (demandas por mês por cargo) × quantidade vendida.
  // Uso = (carga atual + acréscimo) ÷ capacidade: até 80% cabe (verde, u6), até 100% aperta (âmbar, u2),
  //   acima de 100% estoura (vermelho, u1). Cargo com acréscimo e sem capacidade configurada = estoura.
  //   O veredito geral é o pior dos cargos que o pacote usa (sem acréscimo: o pior de todos).
  const CARGOS = Object.freeze([['criacao', 'Criação'], ['atendimento', 'Atendimento'], ['agendamento', 'Agendamento'], ['producao', 'Produção'], ['gestao', 'Gestão']]
    .map(([id, nome]) => Object.freeze({ id, nome })));
  const NIVEIS_CAPACIDADE = Object.freeze({ cabe: { rotulo: 'Cabe', urgencia: 'u6' }, aperta: { rotulo: 'Aperta', urgencia: 'u2' }, estoura: { rotulo: 'Estoura', urgencia: 'u1' } });
  const ORDEM_NIVEL = { cabe: 0, aperta: 1, estoura: 2 };
  function cargaDosItens(itens) {
    const total = {};
    for (const i of itens || []) {
      const q = Math.max(0, Math.floor(Number(i.quantidade ?? 1) || 0));
      for (const [cargo, n] of Object.entries(i.carga || {})) { const v = Math.max(0, Number(n) || 0) * q; if (v) total[cargo] = (total[cargo] || 0) + v; }
    }
    return total;
  }
  function capacidadeTime({ capacidades = {}, pessoas = [], demandas = [], acrescimo = {} } = {}) {
    const cargoDe = new Map();
    for (const p of pessoas) if (p.cargo) for (const id of [p.id, p.monday_user_id]) if (id != null && id !== '') cargoDe.set(String(id), p.cargo);
    const atual = Object.fromEntries(CARGOS.map((c) => [c.id, 0]));
    let semCargo = 0;
    for (const d of demandas) {
      if (!d || d.aberta === false) continue;
      const ids = Array.isArray(d.responsavel_ids) && d.responsavel_ids.length ? d.responsavel_ids : d.responsavel_id != null ? [d.responsavel_id] : [];
      for (const id of new Set(ids.map(String))) { const c = cargoDe.get(id); if (c && c in atual) atual[c]++; else semCargo++; }
    }
    const cargos = CARGOS.map((c) => {
      const cap = Math.max(0, Number(capacidades[c.id]) || 0), extra = Math.max(0, Number(acrescimo[c.id]) || 0), total = atual[c.id] + extra;
      const uso = cap > 0 ? Math.round((total / cap) * 1000) / 10 : null;
      const estado = cap > 0 ? (uso > 100 ? 'estoura' : uso > 80 ? 'aperta' : 'cabe') : extra > 0 ? 'estoura' : 'cabe';
      return { cargo: c.id, nome: c.nome, carga_atual: atual[c.id], acrescimo: extra, total, capacidade: cap, uso, estado, ...NIVEIS_CAPACIDADE[estado], sem_capacidade: !cap };
    });
    const usados = cargos.filter((c) => c.acrescimo > 0), base = usados.length ? usados : cargos.filter((c) => c.capacidade > 0);
    const pior = base.reduce((p, c) => (ORDEM_NIVEL[c.estado] > ORDEM_NIVEL[p] ? c.estado : p), 'cabe');
    return { cargos, estado: pior, ...NIVEIS_CAPACIDADE[pior], sem_cargo: semCargo, configurado: cargos.some((c) => c.capacidade > 0) };
  }

  // ── Metas do mês, corrida comercial e séries mensais (Paulo, 08/11/2026; inspirado no AgencyFlow) ──────────
  // Datas das oportunidades chegam do servidor já como dia de Irecê (YYYY-MM-DD):
  //   criado_dia = quando entrou no funil (lead novo: SDR, cadastro à mão ou formulário);
  //   ganho_dia  = quando foi para Ganho (encerrado_em), só nas que estão em Ganho.
  // Propostas enviadas = oportunidades que entraram na etapa Proposta comercial no período (histórico do CRM),
  //   cada oportunidade uma vez por período.
  // Metas por mês: { 'AAAA-MM': { mrr, avulso, negocios, leads } }. Visão anual = soma dos meses do ano.
  // Progresso = realizado ÷ meta (meta 0 ou ausente: sem %); a barra para em 100%, o % não.
  // Corrida comercial: negócios ganhos no período por quem fechou = o responsável da oportunidade; sem responsável,
  //   quem cadastrou (criado_por), menos no lead do formulário (quem "cadastrou" foi o link) — esse fica sem atribuição.
  //   Ordem: valor total (MRR + avulso), depois quantidade, depois nome.
  const METAS = Object.freeze([['mrr', 'MRR (recorrente)', 'dinheiro'], ['avulso', 'Avulso', 'dinheiro'], ['negocios', 'Negócios fechados', 'numero'], ['leads', 'Leads novos', 'numero']]
    .map(([id, nome, tipo]) => Object.freeze({ id, nome, tipo })));
  const erro400 = (m) => Object.assign(new Error(m), { status: 400 });
  const ehMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
  function validarMetas(entrada) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw erro400('Metas inválidas.');
    const saida = {};
    for (const m of METAS) {
      const v = entrada[m.id];
      if (v == null || v === '') { saida[m.id] = 0; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > (m.tipo === 'dinheiro' ? 1e8 : 100000)) throw erro400(`Meta de ${m.nome.toLowerCase()} inválida.`);
      if (m.tipo === 'numero' && !Number.isInteger(n)) throw erro400(`Meta de ${m.nome.toLowerCase()}: use número inteiro.`);
      saida[m.id] = m.tipo === 'dinheiro' ? reais(centavos(n)) : n;
    }
    return saida;
  }
  function metasDoPeriodo(porMes, p) {
    const soma = Object.fromEntries(METAS.map((m) => [m.id, 0]));
    let meses = 0;
    for (const [mes, v] of Object.entries(porMes && typeof porMes === 'object' ? porMes : {})) {
      if (!ehMes(mes) || !noIntervalo(mes + '-01', p) || !v || typeof v !== 'object') continue;
      let alguma = false;
      for (const m of METAS) { const n = Math.max(0, Number(v[m.id]) || 0); if (n > 0) alguma = true; soma[m.id] += m.tipo === 'dinheiro' ? centavos(n) : n; }
      if (alguma) meses++;
    }
    for (const m of METAS) if (m.tipo === 'dinheiro') soma[m.id] = reais(soma[m.id]);
    return { ...soma, meses_com_meta: meses, definida: meses > 0 };
  }
  const diaDe = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
  const leadsDoPeriodo = (ops, p) => (ops || []).filter((o) => { const d = diaDe(o.criado_dia); return d && noIntervalo(d, p); });
  const fechadosDoPeriodo = (ops, p) => (ops || []).filter((o) => { const d = diaDe(o.ganho_dia); return o.etapa === 'ganho' && d && noIntervalo(d, p); });
  function propostasDoPeriodo(eventos, p) {
    const ids = new Set();
    for (const e of eventos || []) { const d = diaDe(e.dia); if (d && noIntervalo(d, p) && e.oportunidade_id != null) ids.add(String(e.oportunidade_id)); }
    return [...ids];
  }
  function realizadoDoPeriodo({ oportunidades = [], propostas = [] } = {}, p) {
    const ganhos = fechadosDoPeriodo(oportunidades, p);
    return { leads: leadsDoPeriodo(oportunidades, p).length, propostas: propostasDoPeriodo(propostas, p).length, negocios: ganhos.length,
      mrr: reais(ganhos.reduce((s, o) => s + Math.max(0, centavos(o.valor_mensal)), 0)), avulso: reais(ganhos.reduce((s, o) => s + Math.max(0, centavos(o.valor_avulso)), 0)) };
  }
  function progressoMetas(metas, realizado) {
    return METAS.map((m) => {
      const meta = Math.max(0, Number(metas?.[m.id]) || 0), feito = Math.max(0, Number(realizado?.[m.id]) || 0);
      const percentual = meta > 0 ? Math.round((feito / meta) * 1000) / 10 : null;
      const falta = meta > 0 ? (m.tipo === 'dinheiro' ? reais(Math.max(0, centavos(meta) - centavos(feito))) : Math.max(0, meta - feito)) : null;
      return { id: m.id, nome: m.nome, tipo: m.tipo, meta, realizado: feito, percentual, barra: percentual == null ? 0 : Math.min(100, percentual), falta, batida: meta > 0 && feito >= meta };
    });
  }
  function kpisComerciais(dados, p) {
    const atual = realizadoDoPeriodo(dados, p), anterior = realizadoDoPeriodo(dados, p.anterior);
    return { atual, anterior, variacao: Object.fromEntries(Object.keys(atual).map((k) => [k, variacao(atual[k], anterior[k])])) };
  }
  // De onde vem o nome de quem fechou (ver as definições acima). null = não há como atribuir.
  function quemFechou(o) {
    const r = String(o?.responsavel_nome || '').trim(); if (r) return { nome: r, fonte: 'responsavel' };
    const c = String(o?.criado_por_nome || '').trim(); if (c && o?.origem !== 'formulario') return { nome: c, fonte: 'criado_por' };
    return null;
  }
  function rankingFechamentos(oportunidades, p) {
    const porNome = new Map(), sem = { quantidade: 0, mrr: 0, avulso: 0 };
    for (const o of fechadosDoPeriodo(oportunidades, p)) {
      const q = quemFechou(o), m = Math.max(0, centavos(o.valor_mensal)), a = Math.max(0, centavos(o.valor_avulso));
      if (!q) { sem.quantidade++; sem.mrr += m; sem.avulso += a; continue; }
      const k = semAcento(q.nome), x = porNome.get(k) || { nome: q.nome, quantidade: 0, mrr: 0, avulso: 0, pelo_cadastro: 0 };
      x.quantidade++; x.mrr += m; x.avulso += a; if (q.fonte === 'criado_por') x.pelo_cadastro++; porNome.set(k, x);
    }
    const linhas = [...porNome.values()].sort((a, z) => (z.mrr + z.avulso) - (a.mrr + a.avulso) || z.quantidade - a.quantidade || a.nome.localeCompare(z.nome, 'pt-BR'))
      .map((x, i) => ({ posicao: i + 1, nome: x.nome, quantidade: x.quantidade, mrr: reais(x.mrr), avulso: reais(x.avulso), total: reais(x.mrr + x.avulso), pelo_cadastro: x.pelo_cadastro }));
    return { linhas, sem_atribuicao: { quantidade: sem.quantidade, mrr: reais(sem.mrr), avulso: reais(sem.avulso) } };
  }
  // Últimos n meses terminando em mesFinal (AAAA-MM), do mais antigo para o mais novo.
  function seriesMensais(dados, mesFinal, n = 6) {
    if (!ehMes(mesFinal)) throw erro400('Mês inválido (use AAAA-MM).');
    const qtd = Math.max(1, Math.min(24, Math.floor(Number(n) || 6))), saida = [];
    for (let i = qtd - 1; i >= 0; i--) {
      const mes = somarMeses(mesFinal + '-01', -i).slice(0, 7);
      saida.push({ mes, ...realizadoDoPeriodo(dados, periodo(mes)) });
    }
    return saida;
  }

  // ── Formulário público de captura de leads ──────────────────────────────────────────────────────────────
  // Campos e limites (o servidor recusa acima disso; a página usa os mesmos maxlength). Obrigatórios: nome e WhatsApp.
  // WhatsApp: só dígitos, de 10 a 13 (com ou sem 55). Interesse: um da lista (ou vazio). O campo "site" é a isca:
  // gente não vê nem preenche; robô preenche. Isca preenchida = finge que deu certo e não grava nada.
  const INTERESSES_LEAD = Object.freeze(['Gestão de redes sociais', 'Tráfego pago (anúncios)', 'Identidade visual e marca', 'Fotos e vídeos', 'Site', 'Outro']);
  const LIMITES_LEAD = Object.freeze({ nome: 120, empresa: 160, whatsapp: 20, cidade: 80, interesse: 60, mensagem: 1000 });
  const CAMPO_ISCA = 'site';
  // Tira caracteres de controle e invisíveis (inclusive os que invertem a direção do texto); só a mensagem guarda quebra de linha.
  const INVISIVEIS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g;
  function limparTexto(s, multilinha) {
    const t = String(s).normalize('NFC').replace(/\r\n?/g, '\n').replace(INVISIVEIS, ' ');
    return multilinha ? t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim() : t.replace(/\s+/g, ' ').trim();
  }
  const ROTULO_LEAD = { nome: 'Nome', empresa: 'Empresa', whatsapp: 'WhatsApp', cidade: 'Cidade', interesse: 'Interesse', mensagem: 'Mensagem' };
  function validarLead(corpo) {
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return { erro: 'Envio inválido.' };
    const isca = corpo[CAMPO_ISCA];
    if (isca != null && String(isca).trim() !== '') return { isca: true };
    const dados = {};
    for (const [campo, max] of Object.entries(LIMITES_LEAD)) {
      const v = corpo[campo];
      if (v != null && typeof v !== 'string') return { erro: `${ROTULO_LEAD[campo]} inválido.`, campo };
      const s = v ? limparTexto(v.slice(0, max * 4), campo === 'mensagem') : '';
      if (s.length > max || (v && v.length > max * 4)) return { erro: `${ROTULO_LEAD[campo]}: no máximo ${max} caracteres.`, campo };
      dados[campo] = s;
    }
    if (dados.nome.length < 2) return { erro: 'Informe o seu nome.', campo: 'nome' };
    const digitos = dados.whatsapp.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 13) return { erro: 'Informe o WhatsApp com DDD (ex.: 74 99999-9999).', campo: 'whatsapp' };
    dados.whatsapp = digitos;
    if (dados.interesse && !INTERESSES_LEAD.includes(dados.interesse)) return { erro: 'Escolha um interesse da lista.', campo: 'interesse' };
    return { dados };
  }
  function formatarWhatsapp(d) {
    const s = String(d || '').replace(/\D/g, ''), n = s.length >= 12 && s.startsWith('55') ? s.slice(2) : s;
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return s;
  }

  const api = Object.freeze({
    FASES, ETAPAS_INICIO, ETAPAS_MEIO_PADRAO, montarFases, MOTIVOS_PERDA, STATUS_PAGAMENTO, ZONA_CRITICA,
    faseDaEtapa, validarMotivoPerda, custoPacote, margem, pacoteComMargem, financasCliente, resumoFinancas,
    totalOrcamento, resumoFunil, produtoCampeao, filtrarCreators, opcoesCreators,
    CICLOS, GRUPOS_CONTAS, CATEGORIAS_FORNECEDOR, ehData, somarDias, somarMeses, periodo, proximoVencimento, statusRecebivel,
    resumoRecebimentos, resumoContas, inadimplencia, severidade, variacao, filtrarFornecedores,
    LIMITE_CONCENTRACAO, previsaoCaixa, CARGOS, NIVEIS_CAPACIDADE, cargaDosItens, capacidadeTime,
    METAS, validarMetas, metasDoPeriodo, leadsDoPeriodo, fechadosDoPeriodo, propostasDoPeriodo, realizadoDoPeriodo, progressoMetas,
    kpisComerciais, quemFechou, rankingFechamentos, seriesMensais, INTERESSES_LEAD, LIMITES_LEAD, CAMPO_ISCA, validarLead, formatarWhatsapp,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybeComercialCalculos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
