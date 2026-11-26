// vybe-relatorio-performance.js — o relatório técnico da Performance (Gestão): como a máquina da agência anda — quanto
// saiu, no prazo, tempo de entrega, onde trava, por departamento, pessoa, formato e cliente, e os processos em volta.
// Paulo, 26/11/2026 (vybe-relatorio.js). A conta é a da tela (VybePerformance.calcular, vybe-mundo-performance.js), numa
// janela do tamanho do período; o anterior é a mesma janela logo antes. Pelo Alex (Análise e números). Só leitura.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const dd = (u, v) => (v == null ? '—' : `${u.num(v, 1)} d`);

  function janela(VP, base, per, hoje, u) {
    const fim = per.fim < hoje ? per.fim : hoje;
    const dias = Math.max(1, u.diasEntre(per.inicio, fim) + 1);
    return VP.calcular({ ...base, hoje: fim, dias });
  }

  function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, VP = raiz.VybePerformance, D = raiz.VybeDono?.util;
    const pecas = ctx.dados.pecas(), sol = ctx.dados.demandas();
    let pessoas = null; try { pessoas = D?.pessoasDe ? D.pessoasDe(ctx.dados.equipe()) : Object.fromEntries(ctx.dados.equipe().map((p) => [String(p.id), p.name || p.nome])); } catch { pessoas = null; }
    ctx.fonte('Painel (DADOS_ALL, DADOS_DEMANDAS)', `${u.num(pecas.length)} peças e ${u.num(sol.length)} solicitações; a mesma conta da tela Performance`);
    const base = { demandas: pecas, solicitacoes: sol, pessoas };
    const r = VP?.calcular ? janela(VP, base, per, hoje, u) : null;
    const ant = VP?.calcular ? janela(VP, base, per.anterior, hoje, u) : null;
    if (!r) return { titulo: 'Gestão · Performance', resumo: ['A conta da Performance não está carregada nesta tela.'], recomendacoes: [{ o_que: 'Abrir a Performance antes de gerar.', por_que: 'O relatório usa a mesma conta da tela.', impacto: 'Relatório completo.', prioridade: 'baixa' }] };
    const t = r.total, ta = ant?.total || {}, contra = { contra: `vs ${per.anterior.rotulo}` };
    const etapas = lista(r.etapas), pior = etapas[0];
    const proc = r.processos || {};
    const pessoasL = lista(r.pessoas).filter((p) => p.nome), grupos = lista(r.grupos), formatos = lista(r.formatos), clientes = lista(r.clientes);
    const lento = [...formatos].filter((f) => f.tempoMediano != null && f.entregues >= 3).sort((a, b) => b.tempoMediano - a.tempoMediano)[0];
    const resumo = [
      `No período saíram ${u.plural(t.entregues, 'peça', 'peças')}${t.noPrazoPct != null ? `, ${t.noPrazoPct}% no prazo` : ''}${t.tempoMediano != null ? `, com tempo mediano de ${dd(u, t.tempoMediano)} do cadastro à entrega` : ''}.`,
      `A fila de agora tem ${u.plural(t.abertas, 'peça aberta', 'peças abertas')}: ${u.num(t.atrasadas)} atrasadas, ${u.num(t.paradas)} paradas há 3 dias ou mais e ${u.num(t.alteracao)} em alteração.`,
      pior ? `Onde mais trava: ${String(pior.status).toLowerCase()} (${u.num(pior.qtd)} peças, mediana de ${dd(u, pior.idadeMediana)} paradas).` : '',
      lento ? `O formato mais lento é ${String(lento.nome).toLowerCase()} (${dd(u, lento.tempoMediano)} de mediana).` : '',
      (lista(proc.semBriefing).length || lista(proc.semResponsavel).length) ? `Processo: ${u.num(lista(proc.semBriefing).length)} sem briefing e ${u.num(lista(proc.semResponsavel).length)} sem responsável.` : '',
    ].filter(Boolean).slice(0, 5);
    const numeros = [
      { rotulo: 'Entregues', valor: u.num(t.entregues), variacao: u.variacao(t.entregues, ta.entregues, 'maior', contra), porque: 'Peças que chegaram ao status final com o dia da entrega dentro do período.' },
      { rotulo: 'No prazo', valor: t.noPrazoPct != null ? `${t.noPrazoPct}%` : 'sem dado', variacao: t.noPrazoPct != null && ta.noPrazoPct != null ? u.variacao(t.noPrazoPct, ta.noPrazoPct, 'maior', { ...contra, pontos: true }) : null, porque: 'Entregues até a data do cliente (veiculação; sem ela o prazo).' },
      { rotulo: 'Tempo de entrega', valor: dd(u, t.tempoMediano), variacao: t.tempoMediano != null && ta.tempoMediano != null ? u.variacao(t.tempoMediano, ta.tempoMediano, 'menor', { ...contra, unidade: ' d' }) : null, porque: 'Mediana de dias do cadastro à entrega.' },
      { rotulo: 'Abertas', valor: u.num(t.abertas), porque: 'A fila de agora (pausadas e esquecidas ficam fora).' },
      { rotulo: 'Paradas 3+ dias', valor: u.num(t.paradas), porque: 'Sem andamento há 3 dias ou mais e sem depender do cliente.' },
      { rotulo: 'Solicitações vencidas', valor: u.num(lista(proc.solicitacoesVencidas).length), porque: `${u.num(lista(proc.solicitacoesAbertas).length)} solicitações abertas; vencida = conclusão planejada passou.` },
    ];
    const tab = (l, titulo) => ({ colunas: [titulo, 'Entregues', 'No prazo', 'Tempo', 'Abertas', 'Atrasadas', 'Paradas'], linhas: l.slice(0, 15).map((x) => [x.nome, u.num(x.entregues), x.noPrazoPct != null ? `${x.noPrazoPct}%` : '—', dd(u, x.tempoMediano), u.num(x.abertas), u.num(x.atrasadas), u.num(x.paradas)]) });
    const sem = lista(r.semanas);
    const secoes = [
      { titulo: 'Onde a fila trava (por etapa)', texto: ['Peças abertas em cada status, a pior combinação de quantidade e tempo parado primeiro.'],
        grafico: etapas.length ? { tipo: 'ranking', itens: etapas.slice(0, 10).map((e) => ({ rotulo: e.status, valor: e.qtd, sub: `${dd(u, e.idadeMediana)} parada`, tom: e.atrasadas ? 'ruim' : '' })) } : null,
        tabela: etapas.length ? { colunas: ['Etapa', 'Peças', 'Atrasadas', 'Parada (mediana)', 'Clientes com atraso'], linhas: etapas.slice(0, 15).map((e) => [e.status, u.num(e.qtd), u.num(e.atrasadas), dd(u, e.idadeMediana), lista(e.atrasadasPorCliente).slice(0, 3).map((c) => `${c.cliente} (${c.qtd})`).join(', ') || '—']) } : null },
      { titulo: 'Por departamento', texto: ['Cada grupo do quadro.'], tabela: grupos.length ? tab(grupos, 'Departamento') : null },
      { titulo: 'Por pessoa', texto: ['Peça de vários responsáveis conta para cada um.'],
        grafico: pessoasL.length ? { tipo: 'barras', rotulos: pessoasL.slice(0, 10).map((p) => p.nome.split(' ')[0]), series: [{ nome: 'Entregues', valores: pessoasL.slice(0, 10).map((p) => p.entregues) }, { nome: 'Abertas', valores: pessoasL.slice(0, 10).map((p) => p.abertas) }, { nome: 'Atrasadas', valores: pessoasL.slice(0, 10).map((p) => p.atrasadas) }] } : null,
        tabela: pessoasL.length ? tab(pessoasL, 'Pessoa') : null },
      { titulo: 'Por formato', texto: [lento ? `Tempo mediano mais alto: ${lento.nome} (${dd(u, lento.tempoMediano)}).` : 'Formatos do período.'], tabela: formatos.length ? tab(formatos, 'Formato') : null },
      { titulo: 'Por cliente', texto: ['Clientes com mais atraso primeiro.'], tabela: clientes.length ? tab(clientes, 'Cliente') : null },
      { titulo: 'Processos', texto: ['O que falta em volta das peças abertas.'],
        tabela: { colunas: ['Processo', 'Peças'], linhas: [['Sem briefing', u.num(lista(proc.semBriefing).length)], ['Sem responsável', u.num(lista(proc.semResponsavel).length)], ['Captação a agendar', u.num(lista(proc.captacaoAgendar).length)], ['Sem data', u.num(lista(proc.semData).length)], ['Pausadas', u.num(lista(proc.pausadas).length)], ['Esquecidas (30+ dias)', u.num(lista(proc.esquecidas).length)], ['Solicitações vencidas', u.num(lista(proc.solicitacoesVencidas).length)]] } },
    ];
    const historico = sem.length >= 2
      ? { texto: [`Entregas por semana (até 26 semanas). ${u.tendenciaTexto(sem.map((s) => s.entregues), { coisa: 'Tendência das entregas', melhor: 'maior' }).texto.replace('por mês', 'por semana')}.`],
        grafico: { tipo: 'linha', rotulos: sem.map((s) => u.dataCurta(s.inicio)), series: [{ nome: 'Entregues', valores: sem.map((s) => s.entregues) }, { nome: 'No prazo', valores: sem.map((s) => s.noPrazo) }, { nome: 'Cadastradas', valores: sem.map((s) => s.criadas) }] },
        tabela: { colunas: ['Semana de', 'Entregues', 'No prazo', 'Atrasadas', 'Cadastradas'], linhas: sem.map((s) => [u.dataCurta(s.inicio), u.num(s.entregues), u.num(s.noPrazo), u.num(s.atrasadas), u.num(s.criadas)]) } }
      : { texto: ['Período curto demais para a série semanal.'] };
    const ent = sem.map((s) => s.entregues), cri = sem.map((s) => s.criadas);
    const saldo = sem.length ? u.media(cri) - u.media(ent) : 0;
    const projecao = { texto: [sem.length >= 3 ? `Com ${u.num(u.media(ent), 1)} entregas e ${u.num(u.media(cri), 1)} cadastros por semana, a fila ${saldo > 0.5 ? `cresce cerca de ${u.num(saldo, 1)} peças por semana` : saldo < -0.5 ? `diminui cerca de ${u.num(-saldo, 1)} peças por semana` : 'fica estável'}.` : 'Poucas semanas para projetar.',
      sem.length >= 3 ? `Próximas 4 semanas, pela tendência: ${u.projetar(ent, 4).map((v) => u.num(v)).join(', ')} entregas.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (pior && pior.qtd >= 3) recomendacoes.push({ o_que: `Atacar a etapa ${pior.status}: ${u.num(pior.qtd)} peças paradas.`, por_que: `É o maior gargalo (mediana de ${dd(u, pior.idadeMediana)} parada).`, impacto: 'A fila anda mais rápido.', prioridade: 'alta' });
    if (saldo > 0.5) recomendacoes.push({ o_que: 'Rever a capacidade: entra mais do que sai.', por_que: `A fila cresce ${u.num(saldo, 1)} peças por semana.`, impacto: 'Atraso contido antes de virar furo.', prioridade: 'alta' });
    if (lista(proc.semResponsavel).length) recomendacoes.push({ o_que: `Dar dono às ${u.num(lista(proc.semResponsavel).length)} peças sem responsável.`, por_que: 'Peça sem dono não entra na fila de ninguém.', impacto: 'Peças acompanhadas.', prioridade: 'media' });
    if (lista(proc.semBriefing).length) recomendacoes.push({ o_que: `Completar o briefing de ${u.num(lista(proc.semBriefing).length)} peças.`, por_que: 'Sem briefing, a peça volta para alteração.', impacto: 'Menos retrabalho.', prioridade: 'media' });
    if (lento) recomendacoes.push({ o_que: `Olhar o fluxo de ${String(lento.nome).toLowerCase()}.`, por_que: `É o formato mais lento (${dd(u, lento.tempoMediano)}).`, impacto: 'Tempo de entrega menor.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter o acompanhamento semanal da Performance.', por_que: 'A máquina está andando.', impacto: 'Ritmo mantido.', prioridade: 'baixa' });
    return { titulo: 'Gestão · Performance', subtitulo: 'Entregas, prazo, tempo, gargalos por etapa, departamento, pessoa, formato, cliente e processos', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Mesma conta da tela Performance (vybe-mundo-performance.js): situação pela VybeDono.util.situacaoDaPeca; entregue = status final com o dia da entrega na janela; no prazo = entregue até a data do cliente.', 'A janela é o período escolhido (até hoje, se estiver em curso); o anterior é a janela do mesmo tamanho logo antes. A fila (abertas, paradas) é a de agora.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('performance', relatorio, { nome: 'Performance', telas: ['performance'], acesso: 'donos', agente: { nome: 'Alex', papel: 'Análise e números' } });
  raiz.VybeRelPerformance = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
