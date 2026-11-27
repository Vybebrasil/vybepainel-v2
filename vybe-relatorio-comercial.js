// vybe-relatorio-comercial.js — o relatório técnico do Comercial (funil, metas, fechamentos, perdas e orçamentos), pelo
// VYBES. Paulo, 26/11/2026 (vybe-relatorio.js). Só donos e coordenação (setor:comercial está em TRANCADOS); os valores em
// reais (MRR, avulso, ticket) são só dos quatro donos e vão marcados `dinheiro` — e o servidor já não os manda para os
// outros. Só leitura: GET /api/painel?area=comercial&aba=funil&mes= e aba=orcamentos (as mesmas da tela).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const ABERTA = (o) => !['ganho', 'perdido'].includes(o.etapa);
  const MOTIVO = { preco: 'Preço', sem_retorno: 'Sem retorno', fechou_com_outro: 'Fechou com outro', sem_verba: 'Sem verba', timing: 'Timing', outro: 'Outro' };
  const MOTIVO_CHURN = { preco: 'Preço', resultado: 'Resultado', atendimento: 'Atendimento', fechou_empresa: 'Fechou a empresa', internalizou: 'Internalizou', outro: 'Outro' };
  const ORIGEM = { sdr: 'SDR', manual: 'Cadastro manual', formulario: 'Formulário' };

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje;
    const [funil, orc, cart] = await Promise.all([ctx.api('comercial', { aba: 'funil', mes: per.fim.slice(0, 7) }), ctx.api('comercial', { aba: 'orcamentos' }), ctx.api('carteira')]);
    const ops = lista(funil?.oportunidades);
    const fases = lista(funil?.resumo?.fases), resumoFunil = funil?.resumo || {};
    const dentro = (d, p) => Boolean(d) && u.dentro(String(d).slice(0, 10), p);
    const conta = (p) => {
      const ganhos = ops.filter((o) => o.etapa === 'ganho' && dentro(o.ganho_dia, p));
      return { leads: ops.filter((o) => dentro(o.criado_dia, p)).length, ganhos: ganhos.length,
        mrr: ganhos.reduce((t, o) => t + Math.max(0, Number(o.valor_mensal) || 0), 0), avulso: ganhos.reduce((t, o) => t + Math.max(0, Number(o.valor_avulso) || 0), 0),
        propostas: lista(funil?.mes?.propostas).filter((x) => dentro(x.dia, p)).length };
    };
    const at = conta(per), an = conta(per.anterior), contra = { contra: `vs ${per.anterior.rotulo}` };
    const abertas = ops.filter(ABERTA);
    const paradas = abertas.filter((o) => !o.proxima_acao_data || o.proxima_acao_data < hoje).sort((a, b) => String(a.proxima_acao_data || '').localeCompare(String(b.proxima_acao_data || '')));
    const perdidas = ops.filter((o) => o.etapa === 'perdido');
    const motivos = lista(resumoFunil.motivos_perda).filter((m) => m.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade);
    const porOrigem = u.contarPor(ops.filter((o) => dentro(o.criado_dia, per)), (o) => ORIGEM[o.origem_tipo] || 'Outro');
    // Funil: a maior queda entre duas fases (onde o lead se perde).
    const quedas = fases.filter((f) => f.conversao != null && f.alcancaram > 0);
    const pior = [...quedas].sort((a, b) => a.conversao - b.conversao)[0];
    const ranking = lista(funil?.mes?.ranking?.linhas);
    const progresso = lista(funil?.mes?.progresso).filter((m) => m.tipo !== 'dinheiro' || ctx.acesso.dinheiro);
    const metasPessoa = lista(funil?.mes?.metas_pessoa?.linhas);
    // Histórico: 6 meses (leads e negócios contados aqui; propostas pela série do servidor, que é do mês escolhido).
    const mesesH = u.mesesEntre(`${u.somarMeses(per.fim.slice(0, 7), -5)}-01`, per.fim);
    const serie = new Map(lista(funil?.mes?.series).map((s) => [s.mes, s]));
    const hist = mesesH.map((m) => { const p = { inicio: `${m}-01`, fim: u.fimDoMes(m) }; const c = conta(p); return { mes: m, ...c, propostas: serie.get(m)?.propostas ?? c.propostas }; });
    const orcs = lista(orc?.orcamentos), orcPer = orcs.filter((o) => dentro(o.criado_em, per));
    const orcStatus = u.contarPor(orcPer, (o) => ({ rascunho: 'Rascunho', enviado: 'Enviado', aceito: 'Aceito', recusado: 'Recusado', expirado: 'Expirado' }[o.status] || o.status || 'Sem status'));
    const aceitos = orcPer.filter((o) => o.status === 'aceito').length;
    const conv = at.leads ? u.pct(at.ganhos, at.leads) : null;
    // Churn e contratos: as abas Contratos e Churn leem area=carteira (saída pelo registro de churn ou desativação).
    const base = lista(cart?.clientes), regs = new Map(lista(cart?.churn?.registros).map((r) => [String(r.cliente_id), r]));
    const saidas = (p) => base.filter((c) => c.saida && dentro(c.saida, p));
    const saiu = saidas(per), saiuAnt = saidas(per.anterior);
    const ativosInicio = base.filter((c) => (!c.entrada || String(c.entrada).slice(0, 10) < per.inicio) && (!c.saida || String(c.saida).slice(0, 10) >= per.inicio)).length;
    const taxaChurn = ativosInicio ? Math.round((saiu.length / ativosInicio) * 1000) / 10 : null;
    const receitaPerdida = saiu.reduce((t, c) => t + (Number(regs.get(String(c.id))?.receita_mensal ?? c.valor) || 0), 0);
    const motivosChurn = u.contarPor(saiu, (c) => MOTIVO_CHURN[regs.get(String(c.id))?.motivo] || 'Sem classificar');
    const contratos = lista(cart?.contratos?.lista), nomeDe = new Map(base.map((c) => [String(c.id), c.nome]));
    const renovam = contratos.filter((k) => k.renovacao && k.renovacao >= hoje && k.renovacao <= u.somarDias(hoje, 60)).sort((a, b) => a.renovacao.localeCompare(b.renovacao));
    const vencidos = contratos.filter((k) => k.renovacao && k.renovacao < hoje && !/encerr|cancel/i.test(String(k.status || '')));
    const campeao = funil?.produtos?.campeao || null;

    const resumo = [];
    if (!funil) resumo.push('O funil não respondeu agora (ou a sessão não tem acesso ao Comercial): o relatório saiu sem os números.');
    else {
      resumo.push(`No período, ${u.plural(at.leads, 'lead entrou', 'leads entraram')}, ${u.plural(at.propostas, 'proposta foi enviada', 'propostas foram enviadas')} e ${u.plural(at.ganhos, 'negócio foi fechado', 'negócios foram fechados')}${conv != null ? ` (${conv}% dos leads do período)` : ''}.`);
      resumo.push(`O funil tem ${u.plural(abertas.length, 'negociação aberta', 'negociações abertas')}; ${u.num(paradas.length)} sem próxima ação ou com ela vencida.`);
      if (pior) resumo.push(`O lead mais se perde de ${pior.nome.toLowerCase()} para a fase seguinte: só ${pior.conversao}% avançam.`);
      if (motivos[0]) resumo.push(`Principal motivo de perda: ${motivos[0].nome.toLowerCase()} (${motivos[0].quantidade} de ${perdidas.length}).`);
      if (cart && saiu.length) resumo.push(`${u.plural(saiu.length, 'cliente saiu', 'clientes saíram')} no período${taxaChurn != null ? ` (churn de ${u.num(taxaChurn, 1)}%)` : ''}${motivosChurn[0] ? `, mais por ${motivosChurn[0][0].toLowerCase()}` : ''}.`);
      const meta = progresso.find((x) => x.id === 'negocios');
      if (meta?.meta) resumo.push(`Meta de negócios do mês: ${u.num(meta.realizado)} de ${u.num(meta.meta)} (${u.num(meta.percentual)}%).`);
    }
    const numeros = [
      { rotulo: 'Leads', valor: u.num(at.leads), variacao: u.variacao(at.leads, an.leads, 'maior', contra), porque: 'Oportunidades criadas no funil dentro do período (SDR, formulário ou cadastro).' },
      { rotulo: 'Propostas enviadas', valor: u.num(at.propostas), variacao: u.variacao(at.propostas, an.propostas, 'maior', contra), porque: 'Entradas na etapa Proposta comercial no período.' },
      { rotulo: 'Negócios fechados', valor: u.num(at.ganhos), variacao: u.variacao(at.ganhos, an.ganhos, 'maior', contra), porque: 'Oportunidades que viraram Ganho no período.' },
      { rotulo: 'MRR fechado', valor: u.brl(at.mrr), variacao: u.variacao(at.mrr, an.mrr, 'maior', contra), dinheiro: true, porque: 'Soma do valor mensal dos negócios fechados no período.' },
      { rotulo: 'Avulso fechado', valor: u.brl(at.avulso), dinheiro: true, porque: 'Soma do valor avulso dos negócios fechados no período.' },
      { rotulo: 'Taxa de ganho', valor: resumoFunil.taxa_ganho != null ? `${u.num(resumoFunil.taxa_ganho)}%` : 'sem dado', porque: 'Ganhos ÷ negociações encerradas (ganho + perdido), no funil inteiro.' },
      { rotulo: 'Churn do período', valor: cart ? (taxaChurn != null ? `${u.num(taxaChurn, 1)}%` : u.num(saiu.length)) : 'sem dado', variacao: cart ? u.variacao(saiu.length, saiuAnt.length, 'menor', { ...contra, unidade: ' saídas' }) : null, porque: `${u.plural(saiu.length, 'saída', 'saídas')} ÷ ${u.plural(ativosInicio, 'cliente ativo', 'clientes ativos')} no início do período.` },
      { rotulo: 'Receita mensal perdida', valor: u.brl(receitaPerdida), dinheiro: true, porque: 'Receita mensal de quem saiu no período (do registro de churn; sem ele, do contrato ou cadastro).' },
      { rotulo: 'Negociações paradas', valor: u.num(paradas.length), porque: 'Abertas sem próxima ação marcada ou com ela vencida.' },
    ];
    const secoes = [
      { titulo: 'Funil por fase', texto: [quedas.length ? `Conversão de cada fase para a seguinte, de quem já passou por ela. ${pior ? `A maior queda é em ${pior.nome.toLowerCase()} (${pior.conversao}%).` : ''}` : 'Sem passagens suficientes para medir a conversão.'],
        grafico: fases.length ? { tipo: 'barras', rotulos: fases.filter((f) => f.id !== 'perdido').map((f) => f.nome), series: [{ nome: 'Passaram pela fase', valores: fases.filter((f) => f.id !== 'perdido').map((f) => f.alcancaram) }, { nome: 'Estão nela agora', valores: fases.filter((f) => f.id !== 'perdido').map((f) => f.atual) }] } : null,
        tabela: fases.length ? { colunas: ['Fase', 'Agora', 'Passaram', 'Avançam'], linhas: fases.map((f) => [f.nome, u.num(f.atual), u.num(f.alcancaram), f.conversao != null ? `${f.conversao}%` : '—']) } : null },
      { titulo: 'Por que perdemos', texto: [motivos.length ? `${u.plural(perdidas.length, 'negociação perdida', 'negociações perdidas')} no funil.` : 'Nenhuma perda registrada com motivo.'],
        grafico: motivos.length ? { tipo: 'rosca', fatias: motivos.map((m) => ({ rotulo: m.nome, valor: m.quantidade })), centro: u.num(perdidas.length), sub: 'perdidas' } : null,
        tabela: motivos.length ? { colunas: ['Motivo', 'Perdas', '%'], linhas: motivos.map((m) => [m.nome, u.num(m.quantidade), `${u.num(m.percentual)}%`]) } : null },
      { titulo: 'De onde vêm os leads', texto: [porOrigem.length ? `Origem dos leads do período: ${porOrigem.map(([o, n]) => `${o.toLowerCase()} (${n})`).join(', ')}.` : 'Nenhum lead no período.'],
        grafico: porOrigem.length ? { tipo: 'rosca', fatias: porOrigem.map(([o, n]) => ({ rotulo: o, valor: n })), centro: u.num(at.leads), sub: 'leads' } : null },
      { titulo: 'Quem fechou', texto: [ranking.length ? 'Negócios fechados no mês por pessoa (a corrida comercial).' : 'Nenhum fechamento no mês.'],
        tabela: ranking.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Negócios', { rotulo: 'MRR', dinheiro: true }, { rotulo: 'Avulso', dinheiro: true }], linhas: ranking.map((x) => [x.nome || x.pessoa || '—', u.num(x.quantidade ?? x.negocios ?? 0), x.mrr != null ? u.brl(x.mrr) : '—', x.avulso != null ? u.brl(x.avulso) : '—']) } : null },
      { titulo: 'Negociações paradas', texto: [paradas.length ? 'Sem próxima ação, ou com ela vencida, a mais antiga primeiro.' : 'Toda negociação aberta tem próxima ação em dia.'],
        tabela: paradas.length ? { colunas: ['Negociação', 'Etapa', { rotulo: 'Responsável', pessoa: true }, 'Próxima ação', 'Desde'], linhas: paradas.slice(0, 20).map((o) => [String(o.nome || '').slice(0, 36), String(o.etapa || '').replace(/_/g, ' '), o.responsavel_nome || '—', String(o.proxima_acao || 'sem próxima ação').slice(0, 34), o.proxima_acao_data ? u.dataCurta(o.proxima_acao_data) : '—']) } : null },
    ];
    if (campeao) secoes.push({ titulo: 'Produto campeão', texto: [`O pacote que mais fecha: ${campeao.nome} (${u.plural(campeao.ganhos, 'negócio ganho', 'negócios ganhos')}).`] });
    if (cart) secoes.push({ titulo: 'Churn: quem saiu e por quê', texto: [saiu.length ? `${u.plural(saiu.length, 'saída', 'saídas')} no período contra ${u.num(saiuAnt.length)} no anterior.` : 'Nenhum cliente saiu no período.'],
      grafico: motivosChurn.length ? { tipo: 'rosca', fatias: motivosChurn.map(([m, n]) => ({ rotulo: m, valor: n })), centro: u.num(saiu.length), sub: 'saídas' } : null,
      tabela: saiu.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Saiu em', 'Motivo', 'Meses de casa', { rotulo: 'Receita mensal', dinheiro: true }], linhas: saiu.map((c) => { const r = regs.get(String(c.id)); return [c.nome, u.dataCurta(String(c.saida).slice(0, 10)), MOTIVO_CHURN[r?.motivo] || 'Sem classificar', c.entrada ? u.num(u.diasEntre(String(c.entrada).slice(0, 10), String(c.saida).slice(0, 10)) / 30.44, 1) : '—', r?.receita_mensal != null ? u.brl(r.receita_mensal) : c.valor != null ? u.brl(c.valor) : '—']; }) } : null });
    if (contratos.length) secoes.push({ titulo: 'Contratos: renovação', texto: [`${u.plural(renovam.length, 'contrato renova', 'contratos renovam')} nos próximos 60 dias${vencidos.length ? `; ${u.plural(vencidos.length, 'está', 'estão')} com a renovação vencida` : ''}.`],
      tabela: renovam.length || vencidos.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Renovação', 'Status', { rotulo: 'Valor mensal', dinheiro: true }], linhas: [...vencidos, ...renovam].slice(0, 20).map((k) => [nomeDe.get(String(k.cliente_id)) || '—', u.dataCurta(k.renovacao), String(k.status || '—'), k.valor_mensal != null ? u.brl(k.valor_mensal) : '—']) } : null });
    if (progresso.length) secoes.push({ titulo: 'Metas do mês', texto: ['O que foi feito contra a meta do mês escolhido.'],
      tabela: { colunas: ['Meta', 'Meta do mês', 'Feito', '%'], linhas: progresso.map((m) => [m.nome, m.tipo === 'dinheiro' ? u.brl(m.meta) : u.num(m.meta), m.tipo === 'dinheiro' ? u.brl(m.realizado) : u.num(m.realizado), m.percentual != null ? `${u.num(m.percentual)}%` : 'sem meta']) } });
    if (metasPessoa.length) secoes.push({ titulo: 'Metas por pessoa', texto: ['Cada pessoa com meta no mês e o que já fez.'],
      tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Progresso'], linhas: metasPessoa.map((p) => [p.nome || '—', lista(p.progresso).filter((x) => x.tipo !== 'dinheiro').map((x) => `${x.nome}: ${u.num(x.realizado)}/${u.num(x.meta)}`).join(' · ') || '—']) } });
    if (orc) secoes.push({ titulo: 'Orçamentos', texto: [orcPer.length ? `${u.plural(orcPer.length, 'orçamento criado', 'orçamentos criados')} no período, ${u.num(aceitos)} ${aceitos === 1 ? 'aceito' : 'aceitos'}.` : 'Nenhum orçamento criado no período.'],
      grafico: orcStatus.length ? { tipo: 'ranking', itens: orcStatus.map(([s, n]) => ({ rotulo: s, valor: n })) } : null });
    const historico = { texto: [`Leads, propostas e negócios por mês. ${u.tendenciaTexto(hist.map((h) => h.leads), { coisa: 'Tendência dos leads', melhor: 'maior' }).texto}.`],
      grafico: { tipo: 'linha', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Leads', valores: hist.map((h) => h.leads) }, { nome: 'Propostas', valores: hist.map((h) => h.propostas) }, { nome: 'Negócios', valores: hist.map((h) => h.ganhos), papel: 'pronto' }] },
      tabela: { colunas: ['Mês', 'Leads', 'Propostas', 'Negócios', { rotulo: 'MRR fechado', dinheiro: true }], linhas: hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.leads), u.num(h.propostas), u.num(h.ganhos), u.brl(h.mrr)]) } };
    const proxL = u.projetar(hist.map((h) => h.leads), 3), taxaHist = (() => { const l = hist.reduce((t, h) => t + h.leads, 0), g = hist.reduce((t, h) => t + h.ganhos, 0); return l ? g / l : 0; })();
    const projecao = { texto: [`Se a tendência seguir: ${[1, 2, 3].map((k, i) => `${u.nomeMes(u.somarMeses(per.fim.slice(0, 7), k))} ≈ ${u.num(proxL[i])} leads`).join(', ')}; com a conversão dos 6 meses (${u.num(taxaHist * 100, 1)}%), são cerca de ${u.num(proxL.reduce((t, v) => t + v, 0) * taxaHist, 1)} negócios nos 3 meses.`,
      per.emCurso && at.ganhos ? `No ritmo do período, fecham ${u.num(u.ritmo({ feito: at.ganhos, inicio: per.inicio, fim: per.fim, hoje }).projetado)} negócios até ${u.dataCurta(per.fim)}.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (paradas.length) recomendacoes.push({ o_que: `Dar próxima ação às ${u.num(paradas.length)} negociações paradas${paradas[0] ? `, começando por ${String(paradas[0].nome).slice(0, 30)}` : ''}.`, por_que: 'Negociação sem próximo passo esfria e vira "sem retorno".', impacto: 'Menos perda por sem retorno.', prioridade: 'alta' });
    if (pior && pior.conversao < 40) recomendacoes.push({ o_que: `Trabalhar a passagem de ${pior.nome.toLowerCase()} para a fase seguinte.`, por_que: `Só ${pior.conversao}% avançam: é a maior queda do funil.`, impacto: 'Cada ponto aqui vira mais propostas e negócios.', prioridade: 'alta' });
    if (motivos[0]?.id === 'preco') recomendacoes.push({ o_que: 'Rever a apresentação de valor e os pacotes de entrada.', por_que: 'Preço é o principal motivo de perda.', impacto: 'Menos perda por preço.', prioridade: 'media' });
    if (motivos.find((m) => m.id === 'sem_registro')) recomendacoes.push({ o_que: 'Registrar o motivo de toda perda.', por_que: 'Perda sem motivo não ensina nada ao funil.', impacto: 'Leitura das perdas mais fiel.', prioridade: 'baixa' });
    if (vencidos.length || renovam.length) recomendacoes.push({ o_que: `Tratar a renovação de ${[...vencidos, ...renovam].slice(0, 3).map((k) => nomeDe.get(String(k.cliente_id)) || 'cliente').join(', ')}${vencidos.length ? ' (renovação vencida primeiro)' : ''}.`, por_que: 'Contrato que passa da data sem conversa vira churn por descuido.', impacto: 'Receita recorrente protegida.', prioridade: vencidos.length ? 'alta' : 'media' });
    if (saiu.length > saiuAnt.length) recomendacoes.push({ o_que: 'Rever com o Mateus os clientes em risco antes do próximo mês.', por_que: `Saíram ${u.num(saiu.length)} clientes contra ${u.num(saiuAnt.length)} no período anterior.`, impacto: 'Churn de volta ao normal.', prioridade: 'alta' });
    if (at.leads < an.leads) recomendacoes.push({ o_que: 'Reforçar a geração de leads (SDR e formulário).', por_que: `Entraram ${u.num(at.leads)} leads contra ${u.num(an.leads)} no período anterior.`, impacto: 'Funil cheio para os próximos meses.', prioridade: 'media' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a próxima ação de cada negociação em dia.', por_que: 'O funil está andando.', impacto: 'Conversão estável.', prioridade: 'baixa' });
    return { titulo: 'Comercial', subtitulo: 'Funil, conversão por fase, perdas, metas, fechamentos, orçamentos, contratos e churn', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Lead = oportunidade criada no período; proposta = entrada na etapa Proposta comercial; negócio = virou Ganho no período (dia de Irecê). Conversão da fase = quem chegou à fase seguinte ÷ quem passou pela fase.', 'Valores em reais só para os quatro donos. A projeção é a tendência linear dos 6 meses vezes a conversão média do mesmo intervalo.'] };
  }
  // ---------- As subabas (Paulo, 27/11/2026): Funil, Orçamentos, Contratos e Churn ----------
  // O relatório geral já monta tudo; cada aba refaz a conta só da parte dela, com seções, histórico e recomendações próprias.
  const fechaCo = (aba, rel) => ({ ...rel, aba, resumo: lista(rel.resumo).filter(Boolean).slice(0, 5),
    recomendacoes: lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Olhar esta aba de novo na semana que vem.', por_que: 'Nada pede ação pelos números lidos.', impacto: 'Comercial em dia.', prioridade: 'baixa' }] });

  async function abaFunil(ctx) {
    const geral = await relatorio(ctx), fica = new Set(['Funil por fase', 'Por que perdemos', 'De onde vêm os leads', 'Quem fechou', 'Negociações paradas', 'Produto campeão', 'Metas do mês', 'Metas por pessoa']);
    const funil = await ctx.api('comercial', { aba: 'funil', mes: ctx.periodo.fim.slice(0, 7) }), ops = lista(funil?.oportunidades), u = ctx.util;
    const abertas = ops.filter(ABERTA), porEtapa = u.contarPor(abertas, (o) => String(o.etapa || 'sem etapa').replace(/_/g, ' '));
    const porResp = u.contarPor(abertas, (o) => o.responsavel_nome || 'Sem responsável');
    const valorAberto = abertas.reduce((t, o) => t + Math.max(0, Number(o.valor_mensal) || 0), 0);
    const secoes = geral.secoes.filter((s) => fica.has(s.titulo));
    if (porResp.length) secoes.push({ titulo: 'Negociações abertas por responsável', texto: ['Quantas negociações cada um tem na mão.'], grafico: { tipo: 'ranking', de: 'pessoa', itens: porResp.slice(0, 10).map(([n, k]) => ({ rotulo: n, valor: k })) } });
    if (porEtapa.length) secoes.push({ titulo: 'Abertas por etapa', texto: ['Onde estão as negociações em aberto.'], tabela: { colunas: ['Etapa', 'Negociações'], linhas: porEtapa.map(([e, n]) => [e, u.num(n)]) } });
    const numeros = [...geral.numeros.filter((n) => ['Leads', 'Propostas enviadas', 'Negócios fechados', 'MRR fechado', 'Taxa de ganho', 'Negociações paradas'].includes(n.rotulo)),
      { rotulo: 'MRR em negociação', valor: u.brl(valorAberto), dinheiro: true, porque: 'Valor mensal das negociações abertas.' }];
    const recomendacoes = geral.recomendacoes.filter((r) => !/renova|churn|Mateus/i.test(`${r.o_que} ${r.por_que}`));
    return fechaCo('funil', { titulo: 'Comercial · Funil', subtitulo: 'Leads, conversão por fase, perdas, quem fecha e o que está parado', resumo: geral.resumo.filter((t) => !/saiu|saíram|churn/i.test(t)), numeros, secoes, historico: geral.historico, projecao: geral.projecao, recomendacoes, metodologia: geral.metodologia });
  }

  async function abaOrcamentos(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, orc = await ctx.api('comercial', { aba: 'orcamentos' }), todos = lista(orc?.orcamentos);
    const dia = (o) => String(o.criado_em || '').slice(0, 10), noPer = todos.filter((o) => dia(o) && u.dentro(dia(o), per)), noAnt = todos.filter((o) => dia(o) && u.dentro(dia(o), per.anterior));
    const st = (o) => ({ rascunho: 'Rascunho', enviado: 'Enviado', aceito: 'Aceito', recusado: 'Recusado', expirado: 'Expirado' }[o.status] || o.status || 'Sem status');
    const mensal = (l) => l.reduce((t, o) => t + (Number(o.totais?.total_recorrente) || 0), 0), avulso = (l) => l.reduce((t, o) => t + (Number(o.totais?.total_avulso) || 0), 0);
    const enviados = todos.filter((o) => o.status === 'enviado'), falta = (o) => (/^\d{4}-\d{2}-\d{2}$/.test(String(o.validade || '').slice(0, 10)) ? u.diasEntre(hoje, String(o.validade).slice(0, 10)) : null);
    const vencendo = enviados.filter((o) => { const n = falta(o); return n != null && n >= 0 && n <= 7; }), vencidos = enviados.filter((o) => { const n = falta(o); return n != null && n < 0; });
    const aceitos = noPer.filter((o) => o.status === 'aceito'), decididos = noPer.filter((o) => ['aceito', 'recusado'].includes(o.status)), taxa = decididos.length ? u.pct(aceitos.length, decididos.length) : null;
    const itens = u.contarPor(todos.flatMap((o) => lista(o.itens)), (i) => i.nome || null), porSt = u.contarPor(noPer, st);
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 5));
    ctx.fonte('Orçamentos (area=comercial&aba=orcamentos)', `${u.num(todos.length)} orçamentos`);
    const resumo = [
      orc ? `No período, ${u.plural(noPer.length, 'orçamento criado', 'orçamentos criados')}${noAnt.length ? ` (${u.num(noAnt.length)} no anterior)` : ''}: ${porSt.map(([s, n]) => `${u.num(n)} ${s.toLowerCase()}`).join(', ') || 'nenhum'}.` : 'Os orçamentos não responderam agora.',
      taxa != null ? `${taxa}% dos decididos foram aceitos.` : '',
      enviados.length ? `${u.plural(enviados.length, 'proposta espera', 'propostas esperam')} resposta${vencidos.length ? `; ${u.plural(vencidos.length, 'já venceu', 'já venceram')}` : ''}${vencendo.length ? `; ${u.plural(vencendo.length, 'vence', 'vencem')} em até 7 dias` : ''}.` : 'Nenhuma proposta esperando resposta.',
      itens[0] ? `O item que mais entra nas propostas: ${itens[0][0]} (${itens[0][1]}).` : '',
    ];
    const numeros = [
      { rotulo: 'Criados no período', valor: u.num(noPer.length), variacao: u.variacao(noPer.length, noAnt.length, 'maior', { contra: `vs ${per.anterior.rotulo}` }), porque: 'Orçamentos criados no período.' },
      { rotulo: 'Aceitos', valor: u.num(aceitos.length), porque: 'Orçamentos do período aceitos.' },
      { rotulo: 'Taxa de aceite', valor: taxa == null ? 'sem dado' : `${taxa}%`, porque: 'Aceitos ÷ (aceitos + recusados) do período.' },
      { rotulo: 'Esperando resposta', valor: u.num(enviados.length), porque: 'Enviados sem resposta.' },
      { rotulo: 'Mensal em aberto', valor: u.brl(mensal(enviados)), dinheiro: true, porque: 'Valor mensal das propostas enviadas.' },
      { rotulo: 'Mensal aceito', valor: u.brl(mensal(aceitos)), dinheiro: true, porque: 'Valor mensal dos aceitos no período.' },
    ];
    const secoes = [
      { titulo: 'Situação dos orçamentos', texto: [noPer.length ? 'Os orçamentos do período por situação.' : 'Nenhum orçamento no período.'], grafico: porSt.length ? { tipo: 'rosca', fatias: porSt.map(([s, n], i) => ({ rotulo: s, valor: n, papel: ({ Aceito: 'pronto', Recusado: 'atraso', Enviado: 'aberto', Expirado: 'risco' })[s] || ['neutro', 'neutro2'][i % 2] })), centro: u.num(noPer.length), sub: 'orçamentos' } : null },
      enviados.length ? { titulo: 'Esperando resposta', texto: ['Do que vence primeiro para o que vence depois.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Itens', 'Validade', { rotulo: 'Mensal', dinheiro: true }, { rotulo: 'Avulso', dinheiro: true }], linhas: enviados.slice().sort((a, b) => String(a.validade || '9').localeCompare(String(b.validade || '9'))).map((o) => [o.cliente_nome || '—', lista(o.itens).map((i) => i.nome).join(' + ').slice(0, 40) || '—', o.validade ? u.dataCurta(String(o.validade).slice(0, 10)) : '—', u.brl(Number(o.totais?.total_recorrente) || 0), u.brl(Number(o.totais?.total_avulso) || 0)]) } } : null,
      itens.length ? { titulo: 'O que mais entra nas propostas', texto: ['Itens dos pacotes por quantas propostas os levam.'], grafico: { tipo: 'ranking', itens: itens.slice(0, 10).map(([n, k]) => ({ rotulo: n, valor: k })) } } : null,
    ].filter(Boolean);
    const historico = { texto: ['Orçamentos criados e aceitos por mês.'], grafico: { tipo: 'barras', rotulos: mesesH.map((m) => u.nomeMes(m)), series: [{ nome: 'Criados', valores: mesesH.map((m) => todos.filter((o) => dia(o).slice(0, 7) === m).length), papel: 'neutro' }, { nome: 'Aceitos', valores: mesesH.map((m) => todos.filter((o) => dia(o).slice(0, 7) === m && o.status === 'aceito').length), papel: 'pronto' }] } };
    const projecao = { texto: [enviados.length && taxa != null ? `Com a taxa de aceite do período (${taxa}%), das ${u.num(enviados.length)} propostas esperando devem fechar cerca de ${u.num(Math.round(enviados.length * taxa / 100))}.` : 'Sem base para projetar o aceite.'] };
    const recomendacoes = [];
    if (vencidos.length || vencendo.length) recomendacoes.push({ o_que: `Ligar para ${[...vencidos, ...vencendo].slice(0, 3).map((o) => o.cliente_nome).join(', ')} antes que a proposta caia.`, por_que: vencidos.length ? `${u.plural(vencidos.length, 'proposta venceu', 'propostas venceram')} sem resposta.` : 'Vencem em até 7 dias.', impacto: 'Menos proposta perdida por silêncio.', prioridade: 'alta' });
    if (todos.filter((o) => o.status === 'rascunho').length) recomendacoes.push({ o_que: `Enviar ou apagar os ${u.num(todos.filter((o) => o.status === 'rascunho').length)} rascunhos.`, por_que: 'Rascunho parado não vende.', impacto: 'Funil limpo.', prioridade: 'baixa' });
    if (taxa != null && taxa < 30) recomendacoes.push({ o_que: 'Rever a montagem da proposta (itens e desconto).', por_que: `Só ${taxa}% dos decididos foram aceitos.`, impacto: 'Mais aceite por proposta.', prioridade: 'media' });
    return fechaCo('orcamentos', { titulo: 'Comercial · Orçamentos', subtitulo: 'As propostas montadas dos pacotes: aceite, o que espera resposta e o que vence', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Orçamentos de GET area=comercial&aba=orcamentos (os mesmos da tela). Taxa de aceite = aceitos ÷ (aceitos + recusados) criados no período.'] });
  }

  async function abaContratos(ctx) {
    const u = ctx.util, hoje = ctx.hoje, cart = await ctx.api('carteira'), base = lista(cart?.clientes), nomeDe = new Map(base.map((c) => [String(c.id), c.nome]));
    const ks = lista(cart?.contratos?.lista), ativos = ks.filter((k) => !/encerr|cancel/i.test(String(k.status || '')));
    const dias = (k) => (k.renovacao ? u.diasEntre(hoje, String(k.renovacao).slice(0, 10)) : null);
    const vencidos = ativos.filter((k) => dias(k) != null && dias(k) < 0), em30 = ativos.filter((k) => dias(k) != null && dias(k) >= 0 && dias(k) <= 30), em90 = ativos.filter((k) => dias(k) != null && dias(k) > 30 && dias(k) <= 90), semData = ativos.filter((k) => !k.renovacao);
    const mrr = ativos.reduce((t, k) => t + (Number(k.valor_mensal) || 0), 0), mrrRisco = [...vencidos, ...em30].reduce((t, k) => t + (Number(k.valor_mensal) || 0), 0);
    const semContrato = base.filter((c) => !c.saida && !ks.some((k) => String(k.cliente_id) === String(c.id)));
    const meses = Array.from({ length: 6 }, (_, k) => u.somarMeses(hoje.slice(0, 7), k));
    ctx.fonte('Contratos (area=carteira)', `${u.num(ks.length)} contratos`);
    const resumo = [
      cart ? `${u.plural(ativos.length, 'contrato ativo', 'contratos ativos')}${semContrato.length ? `; ${u.plural(semContrato.length, 'cliente ativo está', 'clientes ativos estão')} sem contrato cadastrado` : ''}.` : 'A carteira não respondeu agora.',
      vencidos.length ? `${u.plural(vencidos.length, 'contrato está', 'contratos estão')} com a renovação vencida: ${vencidos.slice(0, 3).map((k) => nomeDe.get(String(k.cliente_id)) || '—').join(', ')}.` : '',
      em30.length ? `${u.plural(em30.length, 'renova', 'renovam')} nos próximos 30 dias e ${u.num(em90.length)} entre 31 e 90 dias.` : em90.length ? `${u.num(em90.length)} renovam entre 31 e 90 dias.` : '',
      semData.length ? `${u.plural(semData.length, 'contrato está', 'contratos estão')} sem data de renovação.` : '',
    ];
    const numeros = [
      { rotulo: 'Contratos ativos', valor: u.num(ativos.length), porque: 'Contratos não encerrados.' },
      { rotulo: 'Renovação vencida', valor: u.num(vencidos.length), porque: 'A data passou sem renovar.' },
      { rotulo: 'Renovam em 30 dias', valor: u.num(em30.length), porque: 'Renovação até 30 dias.' },
      { rotulo: 'Sem data', valor: u.num(semData.length), porque: 'Contrato sem renovação marcada.' },
      { rotulo: 'MRR dos contratos', valor: u.brl(mrr), dinheiro: true, porque: 'Valor mensal dos ativos.' },
      { rotulo: 'MRR em renovação', valor: u.brl(mrrRisco), dinheiro: true, porque: 'Vencidos e os que renovam em 30 dias.' },
    ];
    const linha = (k) => [nomeDe.get(String(k.cliente_id)) || '—', k.inicio ? u.dataCurta(String(k.inicio).slice(0, 10)) : '—', k.renovacao ? u.dataCurta(String(k.renovacao).slice(0, 10)) : '—', dias(k) == null ? '—' : dias(k) < 0 ? `venceu há ${-dias(k)} d` : `${dias(k)} d`, String(k.status || '—'), k.valor_mensal != null ? u.brl(k.valor_mensal) : '—'];
    const secoes = [
      { titulo: 'Renovações pela data', texto: [ativos.length ? 'Vencidos primeiro, depois os mais próximos.' : 'Nenhum contrato cadastrado.'], tabela: ativos.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Início', 'Renovação', 'Falta', 'Status', { rotulo: 'Valor mensal', dinheiro: true }], linhas: ativos.slice().sort((a, b) => (dias(a) ?? 9999) - (dias(b) ?? 9999)).map(linha) } : null },
      ativos.length ? { titulo: 'Renovações nos próximos meses', texto: ['Quantos contratos renovam em cada mês.'], grafico: { tipo: 'barras', rotulos: meses.map((m) => u.nomeMes(m)), series: [{ nome: 'Renovações', valores: meses.map((m) => ativos.filter((k) => String(k.renovacao || '').slice(0, 7) === m).length), papel: 'destaque' }] } } : null,
      semContrato.length ? { titulo: 'Clientes sem contrato', texto: ['Ativos na carteira sem contrato cadastrado no Vybe OS.'], lista: semContrato.slice(0, 30).map((c) => c.nome) } : null,
    ].filter(Boolean);
    const recomendacoes = [];
    if (vencidos.length) recomendacoes.push({ o_que: `Renovar ou encerrar no sistema os contratos de ${vencidos.slice(0, 3).map((k) => nomeDe.get(String(k.cliente_id)) || '—').join(', ')}.`, por_que: 'Renovação vencida sem conversa vira churn por descuido.', impacto: 'Receita recorrente protegida.', prioridade: 'alta' });
    if (em30.length) recomendacoes.push({ o_que: `Preparar a renovação dos ${u.num(em30.length)} que vencem em 30 dias com o resumo do que foi entregue.`, por_que: 'Renovar com o resultado na mão.', impacto: 'Renovação sem desconto.', prioridade: 'media' });
    if (semContrato.length || semData.length) recomendacoes.push({ o_que: 'Cadastrar contrato e data de renovação de quem está sem.', por_que: 'Sem data, a renovação não aparece em lugar nenhum.', impacto: 'Nenhuma renovação esquecida.', prioridade: 'baixa' });
    return fechaCo('contratos', { titulo: 'Comercial · Contratos', subtitulo: 'Contratos ativos, renovações e quem está sem contrato', resumo, numeros, secoes, historico: null, projecao: null, recomendacoes,
      metodologia: ['Contratos do Vybe OS de GET area=carteira (contratos.lista), os mesmos da aba Contratos. Valores só para os donos.'] });
  }

  async function abaChurn(ctx) {
    const u = ctx.util, per = ctx.periodo, cart = await ctx.api('carteira'), base = lista(cart?.clientes), regs = new Map(lista(cart?.churn?.registros).map((r) => [String(r.cliente_id), r]));
    const dentro = (d, p) => Boolean(d) && u.dentro(String(d).slice(0, 10), p), saidas = (p) => base.filter((c) => c.saida && dentro(c.saida, p));
    const saiu = saidas(per), ant = saidas(per.anterior), rec = (c) => Number(regs.get(String(c.id))?.receita_mensal ?? c.valor) || 0;
    const ativosIni = base.filter((c) => (!c.entrada || String(c.entrada).slice(0, 10) < per.inicio) && (!c.saida || String(c.saida).slice(0, 10) >= per.inicio)).length;
    const taxa = ativosIni ? Math.round((saiu.length / ativosIni) * 1000) / 10 : null, motivos = u.contarPor(saiu, (c) => MOTIVO_CHURN[regs.get(String(c.id))?.motivo] || 'Sem classificar');
    const casa = saiu.filter((c) => c.entrada).map((c) => u.diasEntre(String(c.entrada).slice(0, 10), String(c.saida).slice(0, 10)) / 30.44);
    const mesesH = Array.from({ length: 12 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 11)), porMes = mesesH.map((m) => base.filter((c) => String(c.saida || '').slice(0, 7) === m));
    ctx.fonte('Churn (area=carteira)', `${u.num(lista(cart?.churn?.registros).length)} registros de saída`);
    const resumo = [
      cart ? `${u.plural(saiu.length, 'cliente saiu', 'clientes saíram')} no período${taxa != null ? ` (churn de ${u.num(taxa, 1)}%)` : ''}, contra ${u.num(ant.length)} no anterior.` : 'A carteira não respondeu agora.',
      motivos[0] ? `Motivo mais comum: ${motivos[0][0].toLowerCase()} (${motivos[0][1]}).` : '',
      casa.length ? `Quem saiu ficou em média ${u.num(u.media(casa), 1)} meses.` : '',
      saiu.length ? `Foram ${u.brl(saiu.reduce((t, c) => t + rec(c), 0))} de receita mensal junto.` : '',
    ];
    const numeros = [
      { rotulo: 'Saídas', valor: u.num(saiu.length), variacao: u.variacao(saiu.length, ant.length, 'menor', { contra: `vs ${per.anterior.rotulo}` }), porque: 'Saída (churn ou desativação) no período.' },
      { rotulo: 'Churn', valor: taxa == null ? 'sem dado' : `${u.num(taxa, 1)}%`, porque: `Saídas ÷ ${u.plural(ativosIni, 'ativo', 'ativos')} no início do período.` },
      { rotulo: 'Tempo de casa', valor: casa.length ? `${u.num(u.media(casa), 1)} meses` : '—', porque: 'Média de quem saiu.' },
      { rotulo: 'Sem classificar', valor: u.num(saiu.filter((c) => !regs.get(String(c.id))?.motivo).length), porque: 'Saída sem motivo registrado.' },
      { rotulo: 'Receita mensal perdida', valor: u.brl(saiu.reduce((t, c) => t + rec(c), 0)), dinheiro: true, porque: 'Do registro de churn; sem ele, do contrato.' },
    ];
    const secoes = [
      { titulo: 'Por que saíram', texto: [saiu.length ? 'Motivo de cada saída do período.' : 'Ninguém saiu no período.'], grafico: motivos.length ? { tipo: 'rosca', fatias: motivos.map(([m, n], i) => ({ rotulo: m, valor: n, papel: ['atraso', 'risco', 'neutro', 'neutro2', 'info', 'agente'][i % 6] })), centro: u.num(saiu.length), sub: 'saídas' } : null,
        tabela: saiu.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Saiu em', 'Motivo', 'Meses de casa', { rotulo: 'Receita mensal', dinheiro: true }], linhas: saiu.map((c) => [c.nome, u.dataCurta(String(c.saida).slice(0, 10)), MOTIVO_CHURN[regs.get(String(c.id))?.motivo] || 'Sem classificar', c.entrada ? u.num(u.diasEntre(String(c.entrada).slice(0, 10), String(c.saida).slice(0, 10)) / 30.44, 1) : '—', u.brl(rec(c))]) } : null },
    ];
    const historico = { texto: ['Saídas por mês nos últimos 12 meses.'], grafico: { tipo: 'barras', rotulos: mesesH.map((m) => u.nomeMes(m)), series: [{ nome: 'Saídas', valores: porMes.map((l) => l.length), papel: 'atraso' }] },
      tabela: { colunas: ['Mês', 'Saídas', { rotulo: 'Receita mensal', dinheiro: true }], linhas: mesesH.map((m, i) => [u.nomeMes(m, true), u.num(porMes[i].length), u.brl(porMes[i].reduce((t, c) => t + rec(c), 0))]) } };
    const proxC = u.projetar(porMes.map((l) => l.length), 3);
    const projecao = { texto: [`Pela tendência dos 12 meses, os próximos 3 ficam perto de ${proxC.map((n) => u.num(Math.max(0, n), 1)).join(', ')} saídas por mês.`] };
    const recomendacoes = [];
    if (saiu.some((c) => !regs.get(String(c.id))?.motivo)) recomendacoes.push({ o_que: 'Registrar o motivo de cada saída sem classificar.', por_que: 'Sem motivo, o churn não ensina nada.', impacto: 'Leitura fiel das perdas.', prioridade: 'media' });
    if (motivos[0] && motivos[0][0] !== 'Sem classificar') recomendacoes.push({ o_que: `Atacar a causa "${motivos[0][0].toLowerCase()}" com o Mateus.`, por_que: `É o motivo de ${u.plural(motivos[0][1], 'saída', 'saídas')} no período.`, impacto: 'Menos saídas pelo mesmo motivo.', prioridade: 'alta' });
    if (saiu.length > ant.length) recomendacoes.push({ o_que: 'Rever os clientes em risco alto da carteira antes do próximo mês.', por_que: `Saíram ${u.num(saiu.length)} contra ${u.num(ant.length)}.`, impacto: 'Churn de volta ao normal.', prioridade: 'alta' });
    return fechaCo('churn', { titulo: 'Comercial · Churn', subtitulo: 'Quem saiu, por quê, quanto tempo ficou e quanto levou', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Saída pelo registro de churn ou desativação (area=carteira). Churn = saídas ÷ ativos no início do período.'] });
  }
  const ABAS_CO = { funil: abaFunil, orcamentos: abaOrcamentos, contratos: abaContratos, churn: abaChurn };
  const ABAS = [
    { id: 'funil', nome: 'Funil', telas: ['funil', 'setor:comercial'] },
    { id: 'orcamentos', nome: 'Orçamentos', telas: ['orcamentos'] },
    { id: 'contratos', nome: 'Contratos', telas: ['contratos'] },
    { id: 'churn', nome: 'Churn', telas: ['churn'] },
  ];
  async function relatorioComAbas(ctx) { return ctx.aba && ABAS_CO[ctx.aba.id] ? ABAS_CO[ctx.aba.id](ctx) : relatorio(ctx); }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('comercial', relatorioComAbas, { nome: 'Comercial', telas: ['setor:comercial', 'funil', 'conversas', 'pacotes', 'orcamentos', 'contratos', 'churn'], acesso: 'donos', agente: { nome: 'VYBES', papel: 'Comercial da agência' }, abas: ABAS });
  raiz.VybeRelComercial = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
