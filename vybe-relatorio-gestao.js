// vybe-relatorio-gestao.js — o relatório técnico da Gestão (Visão geral da agência), pelo Alex (Análise e números).
// Paulo, 26/11/2026 (vybe-relatorio.js). Só donos e coordenação (setor:gestao está em TRANCADOS). Junta o que os setores
// já calculam: a Produção (VybeRelPecas), as Demandas, a saúde da carteira (VybeCarteiraSaude), o Comercial em quantidade
// (sem reais) e as séries que o servidor guarda dia a dia (GET /api/painel?area=series&para=setor e para=agentes).
// Só leitura; nada de dinheiro aqui (o Finanças tem o relatório dele).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const ultimo = (pts) => { const l = lista(pts).filter((p) => p && p.valor != null); return l.length ? l[l.length - 1] : null; };

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas, S = raiz.VybeCarteiraSaude;
    const [setor, agentes, funil] = await Promise.all([ctx.api('series', { para: 'setor', leitura: 1 }), ctx.api('series', { para: 'agentes', leitura: 1 }), ctx.api('comercial', { aba: 'funil', mes: per.fim.slice(0, 7) })]);
    const pecas = ctx.dados.pecas(), equipe = ctx.dados.equipe(), dem = ctx.dados.demandas(), cad = ctx.dados.clientes().filter((c) => c && c.nome && c.ativo !== false && !c.nao_e_cliente);
    ctx.fonte('Painel (DADOS_ALL, DADOS_DEMANDAS, CADASTRO_CLIENTES)', `${u.num(pecas.length)} peças, ${u.num(dem.length)} demandas, ${u.num(cad.length)} clientes ativos`);
    const a = P.analisar({ pecas, per, hoje, equipe });
    const d = P.analisar({ pecas: dem.map((x) => ({ ...x, veiculacao_iso: '', prazo_iso: String(x.conclusao_iso || x.prazo_iso || '').slice(0, 10) })), per, hoje, equipe });
    let saude = null; try { saude = S?.calcular ? S.calcular({ demandas: pecas, clientes: cad, hoje }) : null; } catch { saude = null; }
    const at = a.atual, an = a.anterior, contra = { contra: `vs ${a.contraRotulo}` };
    const pctEnt = u.pct(at.entregues, at.total);
    // Comercial em quantidade (os reais ficam no relatório do Comercial).
    const ops = lista(funil?.oportunidades), noPer = (dia) => Boolean(dia) && u.dentro(String(dia).slice(0, 10), per), noAnt = (dia) => Boolean(dia) && u.dentro(String(dia).slice(0, 10), per.anterior);
    const leads = ops.filter((o) => noPer(o.criado_dia)).length, ganhos = ops.filter((o) => o.etapa === 'ganho' && noPer(o.ganho_dia)).length;
    const ganhosAnt = ops.filter((o) => o.etapa === 'ganho' && noAnt(o.ganho_dia)).length;
    // Séries do servidor: atrasadas da agência (60 dias) e carga de cada pessoa (30 dias) contra o limite.
    const atr = lista(setor?.atrasadas?.pontos), atrHoje = ultimo(atr), atr30 = atr.find((p) => p.dia >= u.somarDias(hoje, -30));
    const limite = Number(setor?.limite) || null;
    const carga = Object.values(setor?.carga || {}).map((x) => ({ nome: x.nome || x.sujeito, ult: ultimo(x.pontos) })).filter((x) => x.ult)
      .map((x) => ({ nome: x.nome, valor: Number(x.ult.valor), cap: Number(x.ult.capacidade) || limite })).sort((x, y) => y.valor - x.valor);
    const acimaLimite = carga.filter((x) => x.cap && x.valor > x.cap);
    const acertos = Object.values(agentes?.acerto || {}).map((x) => ({ nome: x.nome || x.sujeito, ult: ultimo(x.pontos) })).filter((x) => x.ult).map((x) => ({ nome: x.nome, valor: Number(x.ult.valor) }));
    const metaAcerto = Number(agentes?.meta) || null;
    const abaixoMeta = metaAcerto ? acertos.filter((x) => x.valor < metaAcerto) : [];
    const res = saude?.resumo;

    const resumo = [
      at.total ? `A agência tem ${u.plural(at.total, 'peça', 'peças')} com data no período: ${pctEnt}% prontas, ${u.num(at.atrasadas)} atrasadas e ${at.julgadas ? `${at.noPrazoPct}% das entregas no prazo` : 'sem entrega julgada ainda'}.` : 'Nenhuma peça com data no período.',
      res?.total ? `A carteira está com nota média ${u.num(res.media)}: ${u.plural(res.alto, 'cliente em risco alto', 'clientes em risco alto')}.` : '',
      d.atual.total ? `Fora do feed, ${u.plural(d.atual.total, 'demanda', 'demandas')} no período e ${u.num(d.atual.atrasadas)} atrasadas.` : '',
      funil ? `No Comercial, ${u.plural(leads, 'lead', 'leads')} e ${u.plural(ganhos, 'negócio fechado', 'negócios fechados')}.` : '',
      acimaLimite.length ? `${u.plural(acimaLimite.length, 'pessoa está', 'pessoas estão')} acima do limite de carga: ${acimaLimite.slice(0, 3).map((x) => x.nome).join(', ')}.` : (atrHoje && atr30 ? `O atraso da agência foi de ${u.num(atr30.valor)} para ${u.num(atrHoje.valor)} peças em 30 dias.` : ''),
    ].filter(Boolean).slice(0, 5);
    const numeros = [
      { rotulo: 'Peças prontas', valor: `${u.num(at.entregues)} de ${u.num(at.total)}`, variacao: u.variacao(at.entregues, an.entregues, 'maior', contra), porque: 'Pronta só em Finalizado; data = veiculação, sem ela o prazo.' },
      { rotulo: 'Entregas no prazo', valor: at.julgadas ? `${at.noPrazoPct}%` : 'sem dado', variacao: at.julgadas && an.julgadas ? u.variacao(at.noPrazoPct, an.noPrazoPct, 'maior', { ...contra, pontos: true }) : null, porque: 'Entregues até a data do cliente ÷ entregues com dia de entrega conhecido.' },
      { rotulo: 'Atrasadas (peças)', valor: u.num(at.atrasadas), variacao: u.variacao(at.atrasadas, an.atrasadas, 'menor', contra), porque: 'Data vencida e a peça não está finalizada.' },
      { rotulo: 'Demandas atrasadas', valor: u.num(d.atual.atrasadas), porque: 'Solicitações fora do feed com a conclusão vencida.' },
      { rotulo: 'Nota da carteira', valor: res?.media != null ? u.num(res.media) : 'sem dado', porque: 'Média da nota de saúde dos clientes ativos (só com o que está na tela).' },
      { rotulo: 'Negócios fechados', valor: funil ? u.num(ganhos) : 'sem dado', variacao: funil ? u.variacao(ganhos, ganhosAnt, 'maior', { contra: `vs ${per.anterior.rotulo}` }) : null, porque: 'Oportunidades que viraram Ganho no período (quantidade).' },
    ];
    const secoes = [
      { titulo: 'Os setores lado a lado', texto: ['O retrato de cada frente no período.'],
        tabela: { colunas: ['Frente', 'No período', 'Feitas', 'Atrasadas', 'Situação'], linhas: [
          ['Produção (feed)', u.num(at.total), u.num(at.entregues), u.num(at.atrasadas), at.atrasadas > an.atrasadas ? 'Atraso subindo' : 'Atraso estável ou caindo'],
          ['Demandas', u.num(d.atual.total), u.num(d.atual.entregues), u.num(d.atual.atrasadas), d.atual.atrasadas ? 'Com atraso' : 'Em dia'],
          ['Clientes', u.num(res?.total || 0), '—', u.num(res?.alto || 0), res?.alto ? `${res.alto} em risco alto` : 'Sem risco alto'],
          ['Comercial', funil ? u.num(leads) : '—', funil ? u.num(ganhos) : '—', '—', funil ? `${u.num(ganhos)} fechados` : 'sem leitura'],
        ] } },
      { titulo: 'Quem segura o atraso', texto: [P.quemAtrasa(a).length ? `Atrasadas por pessoa: ${P.quemAtrasa(a, 5).map((p) => `${p.nome} (${p.atrasadas})`).join(', ')}.` : 'Ninguém com peça atrasada no período.'],
        grafico: a.porPessoa.some((p) => p.atrasadas) ? { tipo: 'ranking', itens: a.porPessoa.filter((p) => p.atrasadas).slice(0, 10).map((p) => ({ rotulo: p.nome, valor: p.atrasadas, sub: `${p.abertas} abertas`, tom: 'ruim' })) } : null },
      { titulo: 'Carga do time', texto: [carga.length ? `Peças abertas de cada pessoa no último dia guardado${limite ? `; o limite é ${u.num(limite)}` : ''}.` : 'O servidor ainda não guardou a carga por pessoa.'],
        grafico: carga.length ? { tipo: 'ranking', itens: carga.slice(0, 12).map((x) => ({ rotulo: x.nome, valor: x.valor, sub: x.cap ? `limite ${x.cap}` : '', tom: x.cap && x.valor > x.cap ? 'ruim' : '' })) } : null },
      { titulo: 'Acerto dos agentes', texto: [acertos.length ? `Quanto cada agente acertou no último dia guardado${metaAcerto ? ` (meta de ${u.num(metaAcerto)}%)` : ''}.` : 'Sem série de acerto dos agentes guardada.'],
        tabela: acertos.length ? { colunas: ['Agente', 'Acerto', 'Meta'], linhas: acertos.map((x) => [x.nome, `${u.num(x.valor)}%`, metaAcerto ? (x.valor >= metaAcerto ? 'batida' : 'abaixo') : '—']) } : null },
    ];
    const historico = atr.length >= 3
      ? { texto: [`Peças atrasadas da agência, dia a dia (o servidor guarda 60 dias). ${u.tendenciaTexto(atr.map((p) => Number(p.valor)), { coisa: 'Tendência do atraso', melhor: 'menor' }).texto.replace('por mês', 'por dia')}.`],
        grafico: { tipo: 'area', rotulos: atr.map((p) => u.dataCurta(p.dia)), series: [{ nome: 'Atrasadas', valores: atr.map((p) => Number(p.valor)) }] },
        tabela: { colunas: ['Mês', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.julgadas ? `${h.noPrazoPct}%` : '—']) } }
      : { texto: ['Peças por mês de veiculação.'], grafico: { tipo: 'barras', rotulos: a.hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Prontas', valores: a.hist.map((h) => h.entregues) }, { nome: 'Em aberto', valores: a.hist.map((h) => h.abertas) }], empilhado: true },
        tabela: { colunas: ['Mês', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.julgadas ? `${h.noPrazoPct}%` : '—']) } };
    const proxA = atr.length >= 7 ? u.projetar(atr.slice(-30).map((p) => Number(p.valor)), 14) : null;
    const projecao = { texto: [a.ritmo?.projetado != null && at.total ? `No ritmo do período, a agência fecha com cerca de ${u.num(Math.min(a.ritmo.projetado, at.total))} de ${u.num(at.total)} peças prontas.` : 'Período fechado.',
      proxA ? `Se o atraso seguir a reta dos últimos 30 dias, em 14 dias serão cerca de ${u.num(proxA[13])} peças atrasadas.` : ''].filter(Boolean) };
    const recomendacoes = [];
    const pior = P.quemAtrasa(a)[0];
    if (pior) recomendacoes.push({ o_que: `Redistribuir parte das ${u.num(pior.atrasadas)} atrasadas de ${pior.nome}.`, por_que: 'É a maior concentração de atraso da agência.', impacto: 'O atraso da agência cai mais rápido.', prioridade: 'alta' });
    if (acimaLimite.length) recomendacoes.push({ o_que: `Aliviar a carga de ${acimaLimite.slice(0, 3).map((x) => x.nome).join(', ')}.`, por_que: 'Acima do limite, a pessoa não fecha a fila e o atraso cresce.', impacto: 'Carga dentro do limite.', prioridade: 'alta' });
    if (res?.alto) recomendacoes.push({ o_que: `Cobrar do Mateus o plano para os ${u.num(res.alto)} clientes em risco alto.`, por_que: 'Cliente em risco alto é o próximo churn.', impacto: 'Receita protegida.', prioridade: 'media' });
    if (abaixoMeta.length) recomendacoes.push({ o_que: `Revisar as regras de ${abaixoMeta.map((x) => x.nome).join(', ')}.`, por_que: `Acerto abaixo da meta de ${u.num(metaAcerto)}%.`, impacto: 'Agentes mais confiáveis.', prioridade: 'baixa' });
    if (at.julgadas && at.noPrazoPct < 85) recomendacoes.push({ o_que: 'Subir a régua do prazo: revisar a semana da Produção na segunda.', por_que: `Só ${at.noPrazoPct}% das entregas saíram no prazo.`, impacto: 'Menos furo com o cliente.', prioridade: 'media' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a revisão semanal dos setores.', por_que: 'A agência está em dia.', impacto: 'Ritmo mantido.', prioridade: 'baixa' });
    return { titulo: 'Gestão · Visão geral', subtitulo: 'A agência inteira no período: produção, demandas, carteira, comercial, carga e agentes', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Mesmas regras dos setores: peça pronta só em Finalizado; atrasada = data do cliente vencida; nota de saúde de vybe-carteira-saude.js (aqui só com o que está na tela).', 'Séries do servidor (vybe_serie_diaria): atrasadas da agência 60 dias, carga por pessoa 30 dias e acerto dos agentes 60 dias. Valores em reais ficam no relatório do Comercial e do Finanças.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('gestao', relatorio, { nome: 'Gestão', telas: ['setor:gestao', 'gestao', 'diario', 'automacoes', 'conta'], acesso: 'donos', agente: { nome: 'Alex', papel: 'Análise e números' } });
  raiz.VybeRelGestao = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
