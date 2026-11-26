// vybe-relatorio-demandas.js — o relatório técnico das Demandas (solicitações fora do feed: impresso, site, vídeo,
// evento, reunião…), pelo Heitor. Paulo, 26/11/2026 (vybe-relatorio.js). Lê só o que o painel já carregou
// (DADOS_DEMANDAS e TEAM_USERS). Data da demanda = conclusão combinada; sem ela, o prazo.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas;
    const demandas = lista(ctx.dados.demandas()).map((d) => ({ ...d, veiculacao_iso: '', prazo_iso: String(d.conclusao_iso || d.prazo_iso || '').slice(0, 10) }));
    ctx.fonte('Demandas (DADOS_DEMANDAS)', `${u.num(demandas.length)} demandas carregadas no painel; data = conclusão combinada, sem ela o prazo`);
    const a = P.analisar({ pecas: demandas, per, hoje, equipe: ctx.dados.equipe() });
    const at = a.atual, an = a.anterior;
    const v = (x, y, m, o) => u.variacao(x, y, m, { contra: `vs ${a.contraRotulo}`, ...o });
    const porTipo = u.contarPor(a.doPer, (x) => String(x.d.tipo || '').trim() || 'Sem tipo');
    const atrTipo = u.contarPor(a.atrasadas, (x) => String(x.d.tipo || '').trim() || 'Sem tipo');
    const comTarefas = a.doPer.filter((x) => Number(x.d.tarefas) > 0 && !x.s.entregue);
    const progresso = comTarefas.length ? Math.round(u.media(comTarefas.map((x) => Math.min(1, Number(x.d.tarefas_feitas || 0) / Number(x.d.tarefas))) ) * 100) : null;
    const travadas = comTarefas.filter((x) => Number(x.d.tarefas_feitas || 0) === 0 && x.data <= u.somarDias(hoje, 3));
    const atrasam = P.quemAtrasa(a);
    const resumo = [
      at.total ? `${u.plural(at.total, 'demanda tem', 'demandas têm')} conclusão no período: ${u.num(at.entregues)} feitas e ${u.num(at.abertas)} em aberto.` : 'Nenhuma demanda com conclusão neste período.',
      porTipo.length ? `O que mais entrou: ${porTipo.slice(0, 3).map(([t, n]) => `${t.toLowerCase()} (${n})`).join(', ')}.` : '',
      at.atrasadas ? `${u.plural(at.atrasadas, 'está atrasada', 'estão atrasadas')}${atrTipo[0] ? `, a maioria de ${atrTipo[0][0].toLowerCase()}` : ''}${atrasam.length ? `; com ${atrasam.map((p) => `${p.nome} (${p.atrasadas})`).join(', ')}` : ''}.` : (at.total ? 'Nenhuma demanda atrasada.' : ''),
      progresso != null ? `As abertas com lista de tarefas estão, em média, ${progresso}% feitas${travadas.length ? `; ${u.plural(travadas.length, 'vence', 'vencem')} em até 3 dias sem nenhuma tarefa marcada` : ''}.` : '',
    ].filter(Boolean);
    const numeros = [
      { rotulo: 'Demandas no período', valor: u.num(at.total), variacao: v(at.total, an.total, ''), porque: 'Solicitações com a conclusão combinada (ou o prazo) dentro do período.' },
      { rotulo: 'Feitas', valor: `${u.num(at.entregues)}${at.total ? ` · ${u.pct(at.entregues, at.total)}%` : ''}`, variacao: v(at.entregues, an.entregues, 'maior'), porque: 'Concluída pelo status final da demanda.' },
      { rotulo: 'Atrasadas', valor: u.num(at.atrasadas), variacao: v(at.atrasadas, an.atrasadas, 'menor'), porque: 'Conclusão já passou e a demanda não fechou.' },
      { rotulo: 'Tarefas feitas (abertas)', valor: progresso == null ? 'sem dado' : `${progresso}%`, porque: comTarefas.length ? `Média das ${u.num(comTarefas.length)} demandas abertas que têm lista de tarefas.` : 'As demandas abertas do período não têm lista de tarefas.' },
      { rotulo: 'Esperando o cliente', valor: u.num(at.cliente), porque: 'Paradas em "Ag. info do cliente" ou aprovação do cliente: dependem de fora.' },
      { rotulo: 'Sem responsável', valor: u.num(at.semDono), porque: at.semDono ? 'Sem dono, ninguém puxa a demanda.' : 'Todas têm responsável.' },
    ];
    const meses = a.hist.map((h) => u.nomeMes(h.mes));
    const secoes = [
      { titulo: 'Tipos de demanda', texto: ['O que a agência entrega além do feed, por tipo, no período.'], grafico: porTipo.length ? { tipo: 'rosca', fatias: porTipo.slice(0, 7).map(([t, n]) => ({ rotulo: t, valor: n })), centro: u.num(at.total), sub: 'demandas' } : null,
        tabela: { colunas: ['Tipo', 'Demandas', 'Atrasadas'], linhas: porTipo.slice(0, 10).map(([t, n]) => [t, u.num(n), u.num(atrTipo.find(([x]) => x === t)?.[1] || 0)]) } },
      { titulo: 'Situação das abertas', texto: [a.travas[0] ? `O que mais segura: ${a.travas[0][0].toLowerCase()} (${a.travas[0][1]}).` : 'Sem gargalo de status entre as abertas.'], grafico: a.porStatus.length ? { tipo: 'ranking', de: 'status', itens: a.porStatus.slice(0, 8).map(([s, n]) => ({ rotulo: s, valor: n })) } : null },
      { titulo: 'Quem está atrasado e com o quê', texto: a.atrasadas.length ? ['A conclusão mais antiga primeiro.'] : ['Nenhuma demanda atrasada.'],
        tabela: a.atrasadas.length ? { colunas: ['Conclusão', 'Demanda', 'Tipo', { rotulo: 'Cliente', cliente: true }, { rotulo: 'Com quem', pessoa: true }, 'Tarefas', 'Dias'], linhas: a.atrasadas.slice(0, 20).map((x) => [u.dataCurta(x.data), String(x.d.nome || '').slice(0, 40), String(x.d.tipo || ''), x.clientes.join(', ').slice(0, 24), x.pessoas.join(', ').slice(0, 22), Number(x.d.tarefas) ? `${x.d.tarefas_feitas || 0}/${x.d.tarefas}` : '—', u.num(u.diasEntre(x.data, hoje))]) } : null },
      { titulo: 'Carga por pessoa', texto: ['Demandas de cada pessoa no período.'], grafico: a.porPessoa.length ? { tipo: 'barras', rotulos: a.porPessoa.slice(0, 10).map((p) => p.nome.split(' ')[0]), series: [{ nome: 'Feitas', valores: a.porPessoa.slice(0, 10).map((p) => p.entregues), papel: 'pronto' }, { nome: 'Abertas', valores: a.porPessoa.slice(0, 10).map((p) => p.abertas), papel: 'aberto' }, { nome: 'Atrasadas', valores: a.porPessoa.slice(0, 10).map((p) => p.atrasadas), papel: 'atraso' }] } : null,
        tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Demandas', 'Feitas', 'Abertas', 'Atrasadas'], linhas: a.porPessoa.slice(0, 12).map((p) => [p.nome, u.num(p.total), u.num(p.entregues), u.num(p.abertas), u.num(p.atrasadas)]) } },
    ];
    const prox = u.projetar(a.hist.map((h) => h.total), 3), mesesProx = [1, 2, 3].map((k) => u.somarMeses(per.fim.slice(0, 7), k));
    const historico = { texto: [`Demandas por mês de conclusão. ${u.tendenciaTexto(a.hist.map((h) => h.total), { coisa: 'Tendência do volume', melhor: '' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: meses, series: [{ nome: 'Feitas', valores: a.hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: a.hist.map((h) => h.abertas), papel: 'aberto' }], empilhado: true },
      tabela: { colunas: ['Mês', 'Demandas', 'Feitas', 'Atrasadas'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas)]) } };
    const projecao = { texto: [a.ritmo?.projetado != null && at.total ? `No ritmo do período (${u.num(a.ritmo.porDia, 1)} por dia), fecham cerca de ${u.num(Math.min(a.ritmo.projetado, at.total))} de ${u.num(at.total)}.` : 'Período fechado.', `Volume esperado: ${mesesProx.map((m, i) => `${u.nomeMes(m)} ≈ ${u.num(prox[i])}`).join(', ')} demandas (tendência dos meses do histórico).`] };
    const recomendacoes = [];
    if (at.atrasadas) recomendacoes.push({ o_que: `Fechar as ${u.num(at.atrasadas)} demandas atrasadas${atrasam[0] ? `, a começar pelas de ${atrasam[0].nome}` : ''}.`, por_que: 'Demanda fora do feed (impresso, site, evento) costuma ter data fixa com o cliente.', impacto: `${u.num(at.atrasadas)} entregas destravadas; menos cobrança do cliente.`, prioridade: 'alta' });
    if (travadas.length) recomendacoes.push({ o_que: `Conferir as ${u.num(travadas.length)} demandas que vencem em até 3 dias sem tarefa feita.`, por_que: 'Nenhuma tarefa marcada perto do prazo é sinal de que não começou.', impacto: 'Atraso evitado antes de acontecer.', prioridade: 'alta' });
    if (at.cliente >= 2) recomendacoes.push({ o_que: `Cobrar do cliente o que falta nas ${u.num(at.cliente)} demandas paradas nele.`, por_que: 'Elas não andam sem resposta de fora.', impacto: 'Libera a equipe e protege o prazo.', prioridade: 'media' });
    if (at.semDono) recomendacoes.push({ o_que: `Dar responsável às ${u.num(at.semDono)} demandas sem dono.`, por_que: 'Sem dono, ninguém puxa.', impacto: 'Demanda volta para a fila de alguém.', prioridade: 'media' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter as listas de tarefas atualizadas nas demandas abertas.', por_que: 'É o que mostra o andamento real de cada uma.', impacto: 'Leitura mais fiel do progresso.', prioridade: 'baixa' });
    // amostra: as demandas do período (o quadro das demandas tem as cores de status dele).
    return { titulo: 'Produção · Demandas', subtitulo: 'Solicitações fora do feed: tipos, andamento, atrasos e carga', amostra: a.doPer.map((x) => x.d), resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Data da demanda = conclusão combinada (conclusao_iso); sem ela, o prazo. Feita = status final; atrasada = data vencida sem fechar (pausadas e esquecidas há mais de 30 dias ficam fora).', 'Progresso = tarefas feitas ÷ tarefas da demanda, média das abertas que têm lista.'] };
  }
  const registrar = () => raiz.VybeRelatorio?.registrar?.('demandas', relatorio, { nome: 'Demandas', telas: ['demandas'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' } });
  if (raiz.VybeRelatorio?.registrar) registrar();
  raiz.VybeRelDemandas = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
