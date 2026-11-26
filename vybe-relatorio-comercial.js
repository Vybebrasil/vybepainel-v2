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
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('comercial', relatorio, { nome: 'Comercial', telas: ['setor:comercial', 'funil', 'conversas', 'pacotes', 'orcamentos', 'contratos', 'churn'], acesso: 'donos', agente: { nome: 'VYBES', papel: 'Comercial da agência' } });
  raiz.VybeRelComercial = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
