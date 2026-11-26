// vybe-relatorio-impressoes.js — o relatório técnico das Impressões, pelo Nestor (Compras). Paulo, 26/11/2026
// (vybe-relatorio.js). Lê a mesma rota da tela (GET /api/painel?area=impressoes&todas=1&leitura=1, server/impressoes.js): etapas,
// atrasadas, sem fornecedor, o histórico de cada gráfica e o que espera o Nestor. Valor e cotação são dinheiro (só os
// quatro donos: o servidor já não manda para os outros, e aqui vão marcados `dinheiro`).
// Só lê: com leitura=1 o servidor não anda a arte concluída de "Arte" para "Orçamento" (isso fica para quando a tela
// abre). Uma impressão cuja arte acabou de terminar pode aparecer ainda em "Arte" até alguém abrir a tela.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const FECHADAS = new Set(['entregue', 'cancelado']);

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje;
    const r = await ctx.api('impressoes', { todas: 1, leitura: 1 });
    const todas = lista(r?.impressoes), etapas = lista(r?.etapas), nomeEtapa = new Map(etapas.map((e) => [e.id, e.nome]));
    const dia = (v) => String(v || '').slice(0, 10);
    const pedidaEm = (i) => dia(i.pedido_em) || dia(i.criado_em);
    const doPer = todas.filter((i) => u.dentro(pedidaEm(i), per)), doAnt = todas.filter((i) => u.dentro(pedidaEm(i), per.anterior));
    const entreguesPer = todas.filter((i) => i.etapa === 'entregue' && u.dentro(dia(i.entregue_em), per));
    const entreguesAnt = todas.filter((i) => i.etapa === 'entregue' && u.dentro(dia(i.entregue_em), per.anterior));
    const abertas = todas.filter((i) => !FECHADAS.has(i.etapa)), atrasadas = abertas.filter((i) => i.atrasada).sort((a, b) => String(a.previsao).localeCompare(String(b.previsao)));
    const semFornecedor = abertas.filter((i) => !i.fornecedor_id), semPrevisao = abertas.filter((i) => !i.previsao);
    const noPrazo = entreguesPer.filter((i) => i.previsao && i.entregue_em && dia(i.entregue_em) <= dia(i.previsao)), julgadas = entreguesPer.filter((i) => i.previsao && i.entregue_em);
    const prazoMed = u.mediana(entreguesPer.filter((i) => i.pedido_em && i.entregue_em).map((i) => u.diasEntre(dia(i.pedido_em), dia(i.entregue_em))));
    const porEtapa = etapas.filter((e) => !FECHADAS.has(e.id)).map((e) => [e.nome, abertas.filter((i) => i.etapa === e.id).length]).filter(([, n]) => n);
    const valorPer = doPer.reduce((t, i) => t + (Number(i.valor) || 0), 0), temValor = doPer.some((i) => i.valor != null);
    const ranking = lista(r?.ranking).filter((f) => f.entregues || f.categoria === 'grafica');
    const aguardando = lista(r?.aguardando);
    const porCliente = u.contarPor(doPer, (i) => i.cliente_nome || 'Sem cliente');
    const resumo = [];
    if (!r) resumo.push('As impressões não responderam agora; o relatório saiu sem os números.');
    else {
      resumo.push(`No período, ${u.plural(doPer.length, 'impressão foi pedida', 'impressões foram pedidas')} e ${u.plural(entreguesPer.length, 'foi entregue', 'foram entregues')}${julgadas.length ? ` (${u.pct(noPrazo.length, julgadas.length)}% no prazo)` : ''}${prazoMed != null ? `, ${u.num(prazoMed)} dias do pedido à entrega (mediana)` : ''}.`);
      resumo.push(`Abertas agora: ${u.num(abertas.length)}, ${u.num(atrasadas.length)} atrasadas e ${u.num(semFornecedor.length)} sem fornecedor.`);
      if (porEtapa.length) { const [e, n] = [...porEtapa].sort((a, b) => b[1] - a[1])[0]; resumo.push(`A maior fila está em ${e.toLowerCase()} (${n}).`); }
      if (aguardando.length) resumo.push(`${u.plural(aguardando.length, 'impresso espera', 'impressos esperam')} o Nestor definir responsável, prazo e gráfica.`);
      if (ranking[0]?.entregues) resumo.push(`Gráfica com melhor histórico: ${ranking[0].nome} (${ranking[0].motivo}).`);
    }
    const numeros = [
      { rotulo: 'Pedidas no período', valor: u.num(doPer.length), variacao: u.variacao(doPer.length, doAnt.length, '', { contra: `vs ${per.anterior.rotulo}` }), porque: 'Dia do pedido à gráfica (sem ele, o cadastro) dentro do período.' },
      { rotulo: 'Entregues', valor: u.num(entreguesPer.length), variacao: u.variacao(entreguesPer.length, entreguesAnt.length, 'maior', { contra: `vs ${per.anterior.rotulo}` }), porque: 'Chegaram em "Entregue" dentro do período.' },
      { rotulo: 'Entregues no prazo', valor: julgadas.length ? `${u.pct(noPrazo.length, julgadas.length)}%` : 'sem dado', porque: 'Entregue até a previsão combinada.' },
      { rotulo: 'Atrasadas agora', valor: u.num(atrasadas.length), porque: 'Previsão vencida e ainda não entregue.' },
      { rotulo: 'Sem fornecedor', valor: u.num(semFornecedor.length), porque: 'Abertas sem gráfica escolhida: não vão para a impressão.' },
      { rotulo: 'Valor pedido', valor: temValor ? u.brl(valorPer) : 'sem dado', dinheiro: true, porque: 'Soma do valor das impressões pedidas no período.' },
    ];
    const secoes = [
      { titulo: 'Onde estão as abertas', texto: [porEtapa.length ? 'Impressões abertas por etapa.' : 'Nenhuma impressão aberta.'],
        grafico: porEtapa.length ? { tipo: 'barras', rotulos: porEtapa.map(([e]) => e), series: [{ nome: 'Impressões', valores: porEtapa.map(([, n]) => n) }] } : null },
      { titulo: 'Atrasadas', texto: [atrasadas.length ? 'A previsão mais antiga primeiro.' : 'Nenhuma impressão atrasada.'],
        tabela: atrasadas.length ? { colunas: ['Previsão', 'Impressão', 'Cliente', 'Etapa', 'Gráfica', 'Com quem', 'Dias'], linhas: atrasadas.slice(0, 20).map((i) => [u.dataCurta(dia(i.previsao)), String(i.titulo || '').slice(0, 34), i.cliente_nome || '—', nomeEtapa.get(i.etapa) || i.etapa, i.fornecedor_nome || 'sem gráfica', i.responsavel_nome || '—', u.num(u.diasEntre(dia(i.previsao), hoje))]) } : null },
      { titulo: 'Gráficas', texto: [ranking.length ? 'Histórico de cada fornecedor em todas as impressões: entregas, pontualidade e prazo médio.' : 'Sem histórico de fornecedor.'],
        grafico: ranking.some((f) => f.entregues) ? { tipo: 'ranking', itens: ranking.filter((f) => f.entregues).slice(0, 10).map((f) => ({ rotulo: f.nome, valor: f.entregues, sub: f.pontualidade != null ? `${Math.round(f.pontualidade * 100)}% no prazo` : '', tom: f.pontualidade != null && f.pontualidade < 0.7 ? 'ruim' : '' })) } : null,
        tabela: ranking.length ? { colunas: ['Fornecedor', 'Cidade', 'Entregas', 'No prazo', 'Prazo médio'], linhas: ranking.slice(0, 15).map((f) => [f.nome, f.cidade || '—', u.num(f.entregues), f.pontualidade != null ? `${Math.round(f.pontualidade * 100)}%` : '—', f.prazo_medio_dias != null ? `${u.num(f.prazo_medio_dias)} d` : '—']) } : null },
      { titulo: 'Por cliente', texto: [porCliente.length ? 'Impressões pedidas no período por cliente.' : 'Nenhuma no período.'],
        tabela: porCliente.length ? { colunas: ['Cliente', 'Impressões', { rotulo: 'Valor', dinheiro: true }], linhas: porCliente.slice(0, 15).map(([c, n]) => [c, u.num(n), u.brl(doPer.filter((i) => (i.cliente_nome || 'Sem cliente') === c).reduce((t, i) => t + (Number(i.valor) || 0), 0))]) } : null },
    ];
    if (aguardando.length) secoes.push({ titulo: 'Esperando o Nestor', texto: ['Impressos das Solicitações sem responsável, prazo ou gráfica, com a proposta pela regra do setor.'],
      tabela: { colunas: ['Impresso', 'Cliente', 'Proposta'], linhas: aguardando.slice(0, 20).map((p) => [String(p.titulo || p.nome || '').slice(0, 40), p.cliente || p.cliente_nome || '—', [p.proposta?.responsavel, p.proposta?.prazo ? u.dataCurta(p.proposta.prazo) : '', p.proposta?.fornecedor].filter(Boolean).join(' · ') || '—']) } });
    const meses = u.mesesEntre(`${u.somarMeses(per.fim.slice(0, 7), -5)}-01`, per.fim);
    const hist = meses.map((m) => ({ mes: m, pedidas: todas.filter((i) => pedidaEm(i).slice(0, 7) === m).length, entregues: todas.filter((i) => i.etapa === 'entregue' && dia(i.entregue_em).slice(0, 7) === m).length }));
    const historico = { texto: [`Impressões pedidas e entregues por mês. ${u.tendenciaTexto(hist.map((h) => h.pedidas), { coisa: 'Tendência dos pedidos', melhor: '' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Pedidas', valores: hist.map((h) => h.pedidas) }, { nome: 'Entregues', valores: hist.map((h) => h.entregues) }] },
      tabela: { colunas: ['Mês', 'Pedidas', 'Entregues'], linhas: hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.pedidas), u.num(h.entregues)]) } };
    const projecao = { texto: [`Se a tendência seguir: ${u.projetar(hist.map((h) => h.pedidas), 3).map((v, i) => `${u.nomeMes(u.somarMeses(per.fim.slice(0, 7), i + 1))} ≈ ${u.num(v)}`).join(', ')} impressões.`,
      abertas.length && prazoMed != null ? `Com ${u.num(prazoMed)} dias do pedido à entrega, as ${u.num(abertas.filter((i) => ['arquivo_enviado', 'em_impressao'].includes(i.etapa)).length)} que já estão na gráfica devem chegar até ${u.dataCurta(u.somarDias(hoje, prazoMed))}.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (atrasadas.length) recomendacoes.push({ o_que: `Cobrar a gráfica das ${u.num(atrasadas.length)} atrasadas${atrasadas[0]?.fornecedor_nome ? `, começando pela ${atrasadas[0].fornecedor_nome}` : ''}.`, por_que: 'Impresso costuma ter data de evento: atraso aqui não tem como recuperar.', impacto: 'Entrega antes da data do cliente.', prioridade: 'alta' });
    if (semFornecedor.length) recomendacoes.push({ o_que: `Escolher a gráfica de ${u.plural(semFornecedor.length, 'impressão', 'impressões')} sem fornecedor${ranking[0] ? ` (sugestão: ${ranking[0].nome})` : ''}.`, por_que: 'Sem fornecedor a impressão não sai da cotação.', impacto: 'Fila andando para a gráfica.', prioridade: 'alta' });
    if (aguardando.length) recomendacoes.push({ o_que: `Aprovar a proposta do Nestor para ${u.plural(aguardando.length, 'impresso', 'impressos')}.`, por_que: 'Sem responsável e prazo, ninguém puxa o impresso.', impacto: 'Impressos com dono e data.', prioridade: 'media' });
    if (semPrevisao.length) recomendacoes.push({ o_que: `Combinar a previsão de ${u.plural(semPrevisao.length, 'impressão', 'impressões')} sem data.`, por_que: 'Sem previsão, o atraso nem aparece.', impacto: 'Atraso visível a tempo.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a previsão combinada com a gráfica em todo pedido.', por_que: 'As impressões estão em dia.', impacto: 'Prazo protegido.', prioridade: 'baixa' });
    return { titulo: 'Produção · Impressões', subtitulo: 'Pedidos, entregas, atrasos, gráficas e o que espera o Nestor', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Rota da tela (server/impressoes.js) com o histórico inteiro: pedida = dia do pedido (sem ele, o cadastro); atrasada = previsão vencida sem entrega; no prazo = entregue até a previsão.', 'Ranking das gráficas pelo histórico de todas as impressões. Valor e cotação só para os quatro donos.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('impressoes', relatorio, { nome: 'Impressões', telas: ['impressoes'], agente: { nome: 'Nestor', papel: 'Compras e impressos' } });
  raiz.VybeRelImpressoes = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
