// vybe-relatorio-rh.js — o relatório técnico de Recursos Humanos (produtividade, pedidos ao RH, clima, quadro,
// recrutamento e documentos). Paulo, 26/11/2026 (vybe-relatorio.js). Só leitura, pelas rotas da tela
// (GET /api/painel?area=setor_pessoas&aba=produtividade|rh|recrutamento|documentos). Quem pode ver o quê é do servidor:
// fora da gestão, a pessoa recebe só o próprio detalhe (sem ranking), e recrutamento e documentos nem são pedidos.
// Salário não passa por estas rotas; se um dia passar, vai marcado `dinheiro` (só os donos).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const TIPO = { ferias: 'Férias ou folga', documento: 'Documento', reembolso: 'Reembolso', equipamento: 'Equipamento', outro: 'Outro' };

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje;
    const mesFim = (per.fim < hoje ? per.fim : hoje).slice(0, 7);
    const meses = u.mesesEntre(`${u.somarMeses(mesFim, -5)}-01`, `${mesFim}-01`);
    const gestao = Boolean(ctx.acesso.dono);
    const [prods, rh, rec, docs] = await Promise.all([
      Promise.all(meses.map((m) => ctx.api('setor_pessoas', { aba: 'produtividade', mes: m }))),
      ctx.api('setor_pessoas', { aba: 'rh', periodo: per.meses.length > 1 ? 'anual' : 'mensal', ref: mesFim }),
      gestao ? ctx.api('setor_pessoas', { aba: 'recrutamento', ref: mesFim }) : null,
      gestao ? ctx.api('setor_pessoas', { aba: 'documentos' }) : null]);
    const prod = prods[prods.length - 1], prodAnt = prods[prods.length - 2];
    const rank = lista(prod?.ranking), rankAnt = lista(prodAnt?.ranking), eu = prod?.detalhe;
    const media = (l) => { const v = l.map((p) => p.score).filter((n) => Number.isFinite(Number(n))).map(Number); return v.length ? Math.round(u.media(v)) : null; };
    const mScore = media(rank), mScoreAnt = media(rankAnt);
    const comScore = rank.filter((p) => p.score != null);
    const baixo = comScore.filter((p) => p.score < 60), bateu = rank.filter((p) => p.meta && p.entregues >= p.meta);
    const ind = rh?.indicadores || {}, pedidos = lista(rh?.pedidos);
    const abertos = pedidos.filter((p) => !['resolvido', 'recusado'].includes(p.status)), fora = abertos.filter((p) => p.sla === 'atrasado');
    const visao = rh?.visao || null, clima = rh?.climaResultado || null;
    const proxFerias = lista(rh?.ferias).filter((f) => f.fim >= hoje).slice(0, 10);
    const aniv = lista(rh?.aniversarios).filter((a) => a.dia >= hoje.slice(5) && a.dia <= u.somarDias(hoje, 30).slice(5)).slice(0, 10);
    const vagas = lista(rec?.vagas), cands = lista(rec?.candidatos);
    const abertasV = vagas.filter((v) => v.status === 'aberta');
    const docsL = lista(docs?.documentos), docAviso = docsL.filter((d) => ['vencido', 'renovar'].includes(d.situacao));

    const resumo = [];
    if (!prod) resumo.push('A produtividade não respondeu agora; o relatório saiu só com o que veio.');
    else if (gestao) resumo.push(rank.length ? `Em ${u.nomeMes(mesFim, true)}, o score médio do time é ${u.num(mScore)}${mScoreAnt != null ? ` (${u.num(mScoreAnt)} no mês anterior)` : ''}; ${comScore[0] ? `${comScore[0].nome} lidera com ${u.num(comScore[0].score)}` : 'ninguém pontuou ainda'}.` : 'Sem ranking de produtividade no mês.');
    else if (eu) resumo.push(`Seu score em ${u.nomeMes(mesFim, true)} é ${eu.score != null ? u.num(eu.score) : 'ainda sem nota'}: ${lista(eu.frases).join('; ')}.`);
    if (gestao && baixo.length) resumo.push(`${u.plural(baixo.length, 'pessoa está', 'pessoas estão')} abaixo de 60: ${baixo.slice(0, 3).map((p) => `${p.nome} (${p.score})`).join(', ')}.`);
    if (rh) resumo.push(`${gestao ? 'Pedidos ao RH' : 'Seus pedidos ao RH'}: ${u.plural(ind.abertos || 0, 'aberto', 'abertos')}, ${u.num(ind.foraDoPrazo || 0)} fora do prazo${ind.tempoMedioDias != null ? `; resposta média em ${u.num(ind.tempoMedioDias, 1)} dias úteis` : ''}.`);
    if (visao) resumo.push(`Quadro: ${u.plural(visao.headcount || 0, 'pessoa', 'pessoas')}, ${u.num(visao.admissoes || 0)} admissões e ${u.num(visao.desligamentos || 0)} desligamentos no período${visao.tempoMedioMeses != null ? `; tempo médio de casa de ${u.num(visao.tempoMedioMeses, 1)} meses` : ''}.`);
    if (clima?.liberado) resumo.push(`Clima (${clima.trimestre}): eNPS ${u.num(clima.enps)} com ${u.plural(clima.respostas, 'resposta', 'respostas')}.`);
    else if (gestao && docAviso.length) resumo.push(`${u.plural(docAviso.length, 'documento vence', 'documentos vencem')} ou já venceu: renovar.`);

    const numeros = gestao ? [
      { rotulo: 'Score médio do time', valor: mScore != null ? u.num(mScore) : 'sem dado', variacao: mScore != null && mScoreAnt != null ? u.variacao(mScore, mScoreAnt, 'maior', { contra: `vs ${u.nomeMes(u.somarMeses(mesFim, -1), true)}` }) : null, porque: 'Score de 0 a 100 das demandas: prazo, volume contra a meta do cargo, ajustes e atraso.' },
      { rotulo: 'Bateram a meta do mês', valor: `${u.num(bateu.length)} de ${u.num(rank.length)}`, porque: 'Entregas até agora ≥ meta proporcional do cargo.' },
      { rotulo: 'Pedidos fora do prazo', valor: u.num(ind.foraDoPrazo || 0), porque: `${u.plural(ind.abertos || 0, 'pedido aberto', 'pedidos abertos')}; prazo em dias úteis por tipo.` },
      { rotulo: 'Pedidos respondidos no prazo', valor: ind.noPrazoPct != null ? `${ind.noPrazoPct}%` : 'sem dado', porque: `${u.num(ind.respondidos || 0)} respondidos.` },
      { rotulo: 'Quadro', valor: visao ? u.num(visao.headcount) : 'sem dado', porque: visao ? `${u.num(visao.admissoes)} admissões e ${u.num(visao.desligamentos)} desligamentos no período.` : '' },
      { rotulo: 'eNPS', valor: clima?.liberado ? u.num(clima.enps) : 'sem dado', porque: clima?.liberado ? `${u.num(clima.promotores)} promotores, ${u.num(clima.detratores)} detratores.` : `Resultado só com o mínimo de ${u.num(clima?.minimo || 3)} respostas.` },
    ] : [
      { rotulo: 'Seu score', valor: eu?.score != null ? u.num(eu.score) : 'sem dado', porque: 'Prazo, volume contra a meta do cargo, ajustes e atraso.' },
      { rotulo: 'Suas entregas', valor: eu ? `${u.num(eu.entregues)} de ${u.num(eu.meta)}` : 'sem dado', porque: 'Entregas no mês contra a meta proporcional.' },
      { rotulo: 'Seus pedidos abertos', valor: u.num(ind.abertos || 0), porque: `${u.num(ind.foraDoPrazo || 0)} fora do prazo.` },
    ];
    const secoes = [];
    if (gestao && rank.length) secoes.push({ titulo: 'Produtividade do time', texto: ['Score do mês por pessoa, com as entregas e o que pesou.'],
      grafico: { tipo: 'ranking', itens: comScore.slice(0, 14).map((p, i) => ({ rotulo: p.nome, pessoa: p.nome, valor: p.score, sub: p.cargoNome || '', tom: p.score < 60 ? 'ruim' : i === 0 ? 'bom' : '' })) },
      tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Cargo', 'Score', 'Entregas', 'Meta', 'No prazo', 'Ajustes', 'Atrasadas'], linhas: rank.map((p) => [p.nome, p.cargoNome || '—', p.score != null ? u.num(p.score) : '—', u.num(p.entregues), u.num(p.meta), p.comData ? `${p.noPrazo}/${p.comData}` : '—', p.ajustes != null ? u.num(p.ajustes) : '—', u.num(p.atrasadas)]) } });
    if (!gestao && eu) secoes.push({ titulo: 'Sua produtividade', texto: lista(eu.frases).map((f) => `${f[0].toUpperCase()}${f.slice(1)}.`) });
    if (rh) secoes.push({ titulo: 'Pedidos ao RH', texto: [abertos.length ? `${u.plural(abertos.length, 'pedido aberto', 'pedidos abertos')}, o mais atrasado primeiro.` : 'Nenhum pedido aberto.'],
      grafico: pedidos.length ? { tipo: 'rosca', fatias: u.contarPor(pedidos, (p) => TIPO[p.tipo] || p.tipo).map(([t, n]) => ({ rotulo: t, valor: n })), centro: u.num(pedidos.length), sub: 'pedidos' } : null,
      tabela: abertos.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Tipo', 'Aberto há', 'Prazo', 'Situação'], linhas: [...abertos].sort((a, b) => (b.atrasoUteis || 0) - (a.atrasoUteis || 0)).slice(0, 20).map((p) => [p.pessoa_nome || '—', TIPO[p.tipo] || p.tipo, p.idadeDias != null ? `${u.num(p.idadeDias)} dias` : '—', p.prazo ? u.dataCurta(p.prazo) : '—', p.sla === 'atrasado' ? `fora (${u.num(p.atrasoUteis)} d úteis)` : 'no prazo']) } : null });
    if (proxFerias.length || aniv.length) secoes.push({ titulo: 'Calendário do time', texto: [proxFerias.length ? `Férias e folgas aprovadas: ${proxFerias.map((f) => `${f.nome} (${u.dataCurta(f.inicio)} a ${u.dataCurta(f.fim)})`).join('; ')}.` : 'Ninguém de férias à vista.', aniv.length ? `Aniversários nos próximos 30 dias: ${aniv.map((a) => `${a.nome} (${a.dia.slice(3)}/${a.dia.slice(0, 2)})`).join(', ')}.` : ''].filter(Boolean) });
    if (clima?.liberado) secoes.push({ titulo: 'Clima do time', texto: [`Trimestre ${clima.trimestre}, ${u.plural(clima.respostas, 'resposta', 'respostas')} (anônimas e só agregadas).`],
      grafico: { tipo: 'barras', rotulos: lista(clima.dimensoes).map((d) => d.nome), series: [{ nome: 'Média (1 a 5)', valores: lista(clima.dimensoes).map((d) => d.media) }] }, soDonos: true });
    if (rec) secoes.push({ titulo: 'Recrutamento', soDonos: true, texto: [`${u.plural(abertasV.length, 'vaga aberta', 'vagas abertas')} e ${u.plural(cands.length, 'candidato', 'candidatos')}${rec.indicadores?.tempoMedio?.dias != null ? `; contratação em ${u.num(rec.indicadores.tempoMedio.dias, 1)} dias em média` : ''}.`],
      tabela: abertasV.length ? { colunas: ['Vaga', 'Cargo', 'Aberta em', 'Candidatos'], linhas: abertasV.map((v) => [v.titulo, v.cargo || '—', v.aberta_em ? u.dataCurta(v.aberta_em) : '—', u.num(cands.filter((c) => c.vaga_id === v.id).length)]) } : null });
    if (docs) secoes.push({ titulo: 'Documentos a renovar', soDonos: true, texto: [docAviso.length ? `${u.plural(docAviso.length, 'documento', 'documentos')} vencidos ou a renovar em ${u.num(docs.avisoDias || 30)} dias.` : 'Nenhum documento vencendo.'],
      tabela: docAviso.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Documento', 'Renovação', 'Situação'], linhas: docAviso.map((d) => [d.pessoa_nome, d.titulo || d.tipo, d.renovacao ? u.dataCurta(d.renovacao) : '—', d.situacao === 'vencido' ? 'Vencido' : 'Renovar']) } : null });
    const hist = meses.map((m, i) => ({ mes: m, media: gestao ? media(lista(prods[i]?.ranking)) : (prods[i]?.detalhe?.score ?? null), entregues: gestao ? lista(prods[i]?.ranking).reduce((t, p) => t + (Number(p.entregues) || 0), 0) : Number(prods[i]?.detalhe?.entregues || 0) }));
    const historico = { texto: [`${gestao ? 'Score médio do time' : 'Seu score'} e entregas por mês. ${u.tendenciaTexto(hist.map((h) => h.media).filter((v) => v != null), { coisa: 'Tendência do score', melhor: 'maior' }).texto}.`],
      grafico: { tipo: 'linha', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Score', valores: hist.map((h) => h.media), papel: 'destaque' }], min: 0, max: 100 },
      tabela: { colunas: ['Mês', 'Score', 'Entregas'], linhas: hist.map((h) => [u.nomeMes(h.mes, true), h.media != null ? u.num(h.media) : '—', u.num(h.entregues)]) } };
    const vals = hist.map((h) => h.media).filter((v) => v != null);
    const projecao = { texto: [vals.length >= 3 ? `Se a tendência seguir, o score fica perto de ${u.projetar(vals, 3).map((v) => u.num(Math.max(0, Math.min(100, v)))).join(', ')} nos próximos 3 meses.` : 'Poucos meses para projetar o score.'] };
    const recomendacoes = [];
    if (gestao && baixo.length) recomendacoes.push({ o_que: `Conversar com ${baixo.slice(0, 3).map((p) => p.nome).join(', ')} sobre a fila e o prazo.`, por_que: `Score abaixo de 60; o que mais pesou em ${baixo[0].nome}: ${lista(baixo[0].frases).slice(-1)[0] || 'atraso'}.`, impacto: 'Entregas no prazo e menos atraso no time.', prioridade: 'alta' });
    if (fora.length) recomendacoes.push({ o_que: `Responder os ${u.num(fora.length)} pedidos ao RH fora do prazo.`, por_que: 'Pedido esquecido (férias, reembolso) desgasta o time.', impacto: 'Confiança no RH.', prioridade: 'alta' });
    if (gestao && docAviso.length) recomendacoes.push({ o_que: `Renovar ${u.plural(docAviso.length, 'documento', 'documentos')} do time.`, por_que: 'Contrato vencido é risco trabalhista.', impacto: 'Documentação em dia.', prioridade: 'media', soDonos: true });
    if (gestao && clima && !clima.liberado) recomendacoes.push({ o_que: 'Lembrar o time de responder a pesquisa de clima.', por_que: `O resultado só abre com ${u.num(clima.minimo)} respostas (há ${u.num(clima.respostas || 0)}).`, impacto: 'Leitura do clima do trimestre.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: gestao ? 'Reconhecer quem bateu a meta do mês.' : 'Manter a fila em dia.', por_que: gestao ? `${u.num(bateu.length)} pessoas bateram a meta.` : 'É o que mais pesa no score.', impacto: 'Time engajado.', prioridade: 'baixa' });
    return { titulo: 'Recursos Humanos', subtitulo: gestao ? 'Produtividade do time, pedidos ao RH, calendário, clima, quadro, recrutamento e documentos' : 'A sua produtividade e os seus pedidos ao RH', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Score de produtividade de shared/pessoas-calculos.js (prazo, volume contra a meta do cargo, ajustes e atraso; pesos dos donos). Fora da gestão, cada pessoa recebe só o próprio detalhe.', 'Pedidos com prazo em dias úteis por tipo; clima só agregado e com o mínimo de respostas. Recrutamento e documentos só para os donos e quem administra.'] };
  }
  // ---------- As subabas (Paulo, 27/11/2026): Produtividade, Pedidos ao RH, Recrutamento e Documentos ----------
  const fechaRh = (aba, rel) => ({ ...rel, aba, resumo: lista(rel.resumo).filter(Boolean).slice(0, 5),
    recomendacoes: lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Olhar esta aba de novo no mês que vem.', por_que: 'Nada pede ação pelos números lidos.', impacto: 'Time em dia.', prioridade: 'baixa' }] });
  const mesDe = (ctx) => { const per = ctx.periodo; return (per.fim < ctx.hoje ? per.fim : ctx.hoje).slice(0, 7); };

  async function abaProdutividade(ctx) {
    const u = ctx.util, mesFim = mesDe(ctx), meses = u.mesesEntre(`${u.somarMeses(mesFim, -5)}-01`, `${mesFim}-01`), gestao = Boolean(ctx.acesso.dono);
    const prods = await Promise.all(meses.map((m) => ctx.api('setor_pessoas', { aba: 'produtividade', mes: m })));
    const prod = prods[prods.length - 1], rank = lista(prod?.ranking), eu = prod?.detalhe, com = rank.filter((p) => p.score != null);
    const med = (l) => { const v = lista(l).map((p) => Number(p.score)).filter(Number.isFinite); return v.length ? Math.round(u.media(v)) : null; };
    const m0 = med(rank), m1 = med(prods[prods.length - 2]?.ranking), baixo = com.filter((p) => p.score < 60), bateu = rank.filter((p) => p.meta && p.entregues >= p.meta);
    const porCargo = [...rank.reduce((m, p) => { const k = p.cargoNome || 'Sem cargo', x = m.get(k) || { k, n: 0, s: [], ent: 0, meta: 0 }; x.n++; if (p.score != null) x.s.push(Number(p.score)); x.ent += Number(p.entregues) || 0; x.meta += Number(p.meta) || 0; m.set(k, x); return m; }, new Map()).values()];
    const hist = meses.map((m, i) => ({ mes: m, media: gestao ? med(prods[i]?.ranking) : (prods[i]?.detalhe?.score ?? null), entregues: gestao ? lista(prods[i]?.ranking).reduce((t, p) => t + (Number(p.entregues) || 0), 0) : Number(prods[i]?.detalhe?.entregues || 0) }));
    const vals = hist.map((h) => h.media).filter((v) => v != null);
    ctx.fonte('Produtividade (area=setor_pessoas&aba=produtividade)', `${u.num(meses.length)} meses lidos`);
    const resumo = gestao ? [
      prod ? (rank.length ? `Em ${u.nomeMes(mesFim, true)}, o score médio do time é ${u.num(m0)}${m1 != null ? ` (${u.num(m1)} no mês anterior)` : ''}.` : 'Sem ranking de produtividade no mês.') : 'A produtividade não respondeu agora.',
      com[0] ? `${com[0].nome} lidera com ${u.num(com[0].score)}; ${u.num(bateu.length)} de ${u.num(rank.length)} já bateram a meta do mês.` : '',
      baixo.length ? `${u.plural(baixo.length, 'pessoa está', 'pessoas estão')} abaixo de 60: ${baixo.slice(0, 3).map((p) => `${p.nome} (${p.score})`).join(', ')}.` : rank.length ? 'Ninguém abaixo de 60.' : '',
      porCargo.length > 1 ? `Por cargo: ${porCargo.map((c) => `${c.k} ${c.s.length ? u.num(Math.round(u.media(c.s))) : '—'}`).join(', ')}.` : '',
      vals.length >= 3 ? `${u.tendenciaTexto(vals, { coisa: 'O score do time', melhor: 'maior' }).texto}.` : '',
    ] : [eu ? `Seu score em ${u.nomeMes(mesFim, true)} é ${eu.score != null ? u.num(eu.score) : 'ainda sem nota'}: ${lista(eu.frases).join('; ')}.` : 'Sem o seu detalhe de produtividade agora.'];
    const numeros = gestao ? [
      { rotulo: 'Score médio', valor: m0 != null ? u.num(m0) : 'sem dado', variacao: m0 != null && m1 != null ? u.variacao(m0, m1, 'maior', { contra: `vs ${u.nomeMes(u.somarMeses(mesFim, -1), true)}` }) : null, porque: 'Score de 0 a 100: prazo, volume contra a meta do cargo, ajustes e atraso.' },
      { rotulo: 'Bateram a meta', valor: `${u.num(bateu.length)} de ${u.num(rank.length)}`, porque: 'Entregas até agora ≥ meta proporcional do cargo.' },
      { rotulo: 'Abaixo de 60', valor: u.num(baixo.length), porque: 'Pede conversa sobre fila e prazo.' },
      { rotulo: 'Entregas do time', valor: u.num(rank.reduce((t, p) => t + (Number(p.entregues) || 0), 0)), porque: 'Soma das entregas no mês.' },
      { rotulo: 'Atrasadas', valor: u.num(rank.reduce((t, p) => t + (Number(p.atrasadas) || 0), 0)), porque: 'Peças atrasadas de todos.' },
    ] : [
      { rotulo: 'Seu score', valor: eu?.score != null ? u.num(eu.score) : 'sem dado', porque: 'Prazo, volume, ajustes e atraso.' },
      { rotulo: 'Suas entregas', valor: eu ? `${u.num(eu.entregues)} de ${u.num(eu.meta)}` : 'sem dado', porque: 'Entregas no mês contra a meta.' },
    ];
    const secoes = gestao ? [
      rank.length ? { titulo: 'Score de cada pessoa', texto: ['Score do mês, com as entregas e o que pesou.'], grafico: { tipo: 'ranking', de: 'pessoa', itens: com.slice(0, 14).map((p, i) => ({ rotulo: p.nome, valor: p.score, sub: p.cargoNome || '', tom: p.score < 60 ? 'ruim' : i === 0 ? 'bom' : '' })) },
        tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Cargo', 'Score', 'Entregas', 'Meta', 'No prazo', 'Ajustes', 'Atrasadas'], linhas: rank.map((p) => [p.nome, p.cargoNome || '—', p.score != null ? u.num(p.score) : '—', u.num(p.entregues), u.num(p.meta), p.comData ? `${p.noPrazo}/${p.comData}` : '—', p.ajustes != null ? u.num(p.ajustes) : '—', u.num(p.atrasadas)]) } } : { titulo: 'Score de cada pessoa', texto: ['Sem ranking no mês.'] },
      porCargo.length ? { titulo: 'Por cargo', texto: ['Média do score, entregas e meta de cada cargo.'], tabela: { colunas: ['Cargo', 'Pessoas', 'Score médio', 'Entregas', 'Meta'], linhas: porCargo.map((c) => [c.k, u.num(c.n), c.s.length ? u.num(Math.round(u.media(c.s))) : '—', u.num(c.ent), u.num(c.meta)]) } } : null,
      baixo.length ? { titulo: 'O que pesou em quem está abaixo de 60', texto: baixo.slice(0, 6).map((p) => `${p.nome} (${p.score}): ${lista(p.frases).join('; ') || 'sem detalhe'}.`) } : null,
    ].filter(Boolean) : [{ titulo: 'Sua produtividade', texto: lista(eu?.frases).map((f) => `${f[0].toUpperCase()}${f.slice(1)}.`) }];
    const historico = { texto: [`${gestao ? 'Score médio do time' : 'Seu score'} e entregas por mês.`], grafico: { tipo: 'linha', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Score', valores: hist.map((h) => h.media), papel: 'destaque' }], min: 0, max: 100 },
      tabela: { colunas: ['Mês', 'Score', 'Entregas'], linhas: hist.map((h) => [u.nomeMes(h.mes, true), h.media != null ? u.num(h.media) : '—', u.num(h.entregues)]) } };
    const projecao = { texto: [vals.length >= 3 ? `Se a tendência seguir, o score fica perto de ${u.projetar(vals, 3).map((v) => u.num(Math.max(0, Math.min(100, v)))).join(', ')} nos próximos 3 meses.` : 'Poucos meses para projetar o score.'] };
    const recomendacoes = [];
    if (gestao && baixo.length) recomendacoes.push({ o_que: `Conversar com ${baixo.slice(0, 3).map((p) => p.nome).join(', ')} sobre a fila e o prazo.`, por_que: `Score abaixo de 60; em ${baixo[0].nome} pesou: ${lista(baixo[0].frases).slice(-1)[0] || 'atraso'}.`, impacto: 'Entregas no prazo.', prioridade: 'alta' });
    if (gestao && bateu.length) recomendacoes.push({ o_que: `Reconhecer ${bateu.slice(0, 3).map((p) => p.nome).join(', ')} por bater a meta.`, por_que: 'Já passaram da meta proporcional do mês.', impacto: 'Time engajado.', prioridade: 'baixa' });
    return fechaRh('produtividade', { titulo: 'Recursos Humanos · Produtividade', subtitulo: gestao ? 'O score do time, por pessoa e por cargo, mês a mês' : 'A sua produtividade no mês', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Score de shared/pessoas-calculos.js (prazo, volume contra a meta do cargo, ajustes e atraso). Fora da gestão, cada pessoa recebe só o próprio detalhe.'] });
  }

  async function abaPedidos(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, mesFim = mesDe(ctx), gestao = Boolean(ctx.acesso.dono);
    const rh = await ctx.api('setor_pessoas', { aba: 'rh', periodo: per.meses.length > 1 ? 'anual' : 'mensal', ref: mesFim });
    const ind = rh?.indicadores || {}, pedidos = lista(rh?.pedidos), abertos = pedidos.filter((p) => !['resolvido', 'recusado'].includes(p.status)), fora = abertos.filter((p) => p.sla === 'atrasado');
    const visao = rh?.visao || null, clima = rh?.climaResultado || null, porTipo = u.contarPor(pedidos, (p) => TIPO[p.tipo] || p.tipo || 'Outro');
    const ferias = lista(rh?.ferias).filter((f) => f.fim >= hoje).slice(0, 12), aniv = lista(rh?.aniversarios).filter((a) => a.dia >= hoje.slice(5) && a.dia <= u.somarDias(hoje, 30).slice(5));
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(mesFim, k - 5)), criado = (p) => String(p.criado_em || p.aberto_em || '').slice(0, 7);
    ctx.fonte('Pedidos ao RH (area=setor_pessoas&aba=rh)', `${u.num(pedidos.length)} pedidos`);
    const resumo = [
      rh ? `${gestao ? 'Pedidos ao RH' : 'Seus pedidos ao RH'}: ${u.plural(ind.abertos ?? abertos.length, 'aberto', 'abertos')}, ${u.num(ind.foraDoPrazo ?? fora.length)} fora do prazo${ind.tempoMedioDias != null ? `; resposta média em ${u.num(ind.tempoMedioDias, 1)} dias úteis` : ''}.` : 'Os pedidos ao RH não responderam agora.',
      porTipo[0] ? `O que mais se pede: ${porTipo.slice(0, 3).map(([t, n]) => `${t.toLowerCase()} (${n})`).join(', ')}.` : '',
      visao ? `Quadro: ${u.plural(visao.headcount || 0, 'pessoa', 'pessoas')}, ${u.num(visao.admissoes || 0)} admissões e ${u.num(visao.desligamentos || 0)} desligamentos.` : '',
      clima?.liberado ? `Clima (${clima.trimestre}): eNPS ${u.num(clima.enps)} com ${u.plural(clima.respostas, 'resposta', 'respostas')}.` : clima ? `A pesquisa de clima tem ${u.num(clima.respostas || 0)} de ${u.num(clima.minimo || 3)} respostas para abrir.` : '',
      ferias.length ? `${u.plural(ferias.length, 'férias ou folga aprovada', 'férias ou folgas aprovadas')} à vista.` : '',
    ];
    const numeros = [
      { rotulo: 'Pedidos abertos', valor: u.num(ind.abertos ?? abertos.length), porque: 'Pedidos não resolvidos nem recusados.' },
      { rotulo: 'Fora do prazo', valor: u.num(ind.foraDoPrazo ?? fora.length), porque: 'Prazo em dias úteis por tipo.' },
      { rotulo: 'Respondidos no prazo', valor: ind.noPrazoPct != null ? `${ind.noPrazoPct}%` : 'sem dado', porque: `${u.num(ind.respondidos || 0)} respondidos.` },
      { rotulo: 'Tempo de resposta', valor: ind.tempoMedioDias != null ? `${u.num(ind.tempoMedioDias, 1)} d úteis` : 'sem dado', porque: 'Média até a resposta.' },
      ...(gestao ? [{ rotulo: 'Quadro', valor: visao ? u.num(visao.headcount) : 'sem dado', porque: visao ? `${u.num(visao.admissoes)} admissões, ${u.num(visao.desligamentos)} desligamentos.` : '' },
        { rotulo: 'eNPS', valor: clima?.liberado ? u.num(clima.enps) : 'sem dado', porque: clima?.liberado ? `${u.num(clima.promotores)} promotores, ${u.num(clima.detratores)} detratores.` : 'Só abre com o mínimo de respostas.' }] : []),
    ];
    const secoes = [
      { titulo: 'Pedidos abertos', texto: [abertos.length ? 'O mais atrasado primeiro.' : 'Nenhum pedido aberto.'], grafico: porTipo.length ? { tipo: 'rosca', fatias: porTipo.map(([t, n], i) => ({ rotulo: t, valor: n, papel: ['destaque', 'info', 'agente', 'neutro', 'neutro2'][i % 5] })), centro: u.num(pedidos.length), sub: 'pedidos' } : null,
        tabela: abertos.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Tipo', 'Aberto há', 'Prazo', 'Situação'], linhas: [...abertos].sort((a, b) => (b.atrasoUteis || 0) - (a.atrasoUteis || 0)).slice(0, 25).map((p) => [p.pessoa_nome || '—', TIPO[p.tipo] || p.tipo, p.idadeDias != null ? `${u.num(p.idadeDias)} dias` : '—', p.prazo ? u.dataCurta(p.prazo) : '—', p.sla === 'atrasado' ? `fora (${u.num(p.atrasoUteis)} d úteis)` : 'no prazo']) } : null },
      ferias.length || aniv.length ? { titulo: 'Calendário do time', texto: [ferias.length ? 'Férias e folgas aprovadas.' : 'Ninguém de férias à vista.', aniv.length ? `Aniversários nos próximos 30 dias: ${aniv.map((a) => `${a.nome} (${a.dia.slice(3)}/${a.dia.slice(0, 2)})`).join(', ')}.` : ''].filter(Boolean),
        tabela: ferias.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'De', 'Até'], linhas: ferias.map((f) => [f.nome, u.dataCurta(f.inicio), u.dataCurta(f.fim)]) } : null } : null,
      clima?.liberado ? { titulo: 'Clima do time', soDonos: true, texto: [`Trimestre ${clima.trimestre}, ${u.plural(clima.respostas, 'resposta', 'respostas')} (anônimas e só agregadas).`], grafico: { tipo: 'barras', rotulos: lista(clima.dimensoes).map((d) => d.nome), series: [{ nome: 'Média (1 a 5)', valores: lista(clima.dimensoes).map((d) => d.media), papel: 'destaque' }] } } : null,
    ].filter(Boolean);
    const historico = pedidos.some(criado) ? { texto: ['Pedidos abertos por mês.'], grafico: { tipo: 'barras', rotulos: mesesH.map((m) => u.nomeMes(m)), series: [{ nome: 'Pedidos', valores: mesesH.map((m) => pedidos.filter((p) => criado(p) === m).length), papel: 'destaque' }] } } : { texto: ['Os pedidos não trazem a data de abertura para o histórico.'] };
    const recomendacoes = [];
    if (fora.length) recomendacoes.push({ o_que: `Responder os ${u.num(fora.length)} pedidos fora do prazo${fora[0]?.pessoa_nome ? `, começando pelo de ${fora[0].pessoa_nome}` : ''}.`, por_que: 'Pedido esquecido (férias, reembolso) desgasta o time.', impacto: 'Confiança no RH.', prioridade: 'alta' });
    if (gestao && clima && !clima.liberado) recomendacoes.push({ o_que: 'Lembrar o time de responder a pesquisa de clima.', por_que: `Só abre com ${u.num(clima.minimo)} respostas (há ${u.num(clima.respostas || 0)}).`, impacto: 'Leitura do clima do trimestre.', prioridade: 'baixa' });
    return fechaRh('rh', { titulo: 'Recursos Humanos · Pedidos ao RH', subtitulo: gestao ? 'Pedidos, prazos, calendário, quadro e clima do time' : 'Os seus pedidos ao RH', resumo, numeros, secoes, historico, projecao: null, recomendacoes,
      metodologia: ['Pedidos com prazo em dias úteis por tipo (area=setor_pessoas&aba=rh). Clima só agregado e com o mínimo de respostas.'] });
  }

  async function abaRecrutamento(ctx) {
    const u = ctx.util, hoje = ctx.hoje, rec = await ctx.api('setor_pessoas', { aba: 'recrutamento', ref: mesDe(ctx) });
    const vagas = lista(rec?.vagas), cands = lista(rec?.candidatos), abertas = vagas.filter((v) => v.status === 'aberta'), porEtapa = u.contarPor(cands, (c) => c.etapa || c.status || 'Sem etapa');
    const semCand = abertas.filter((v) => !cands.some((c) => c.vaga_id === v.id)), idade = (v) => (v.aberta_em ? u.diasEntre(String(v.aberta_em).slice(0, 10), hoje) : null);
    const tempo = rec?.indicadores?.tempoMedio?.dias;
    ctx.fonte('Recrutamento (area=setor_pessoas&aba=recrutamento)', `${u.num(vagas.length)} vagas, ${u.num(cands.length)} candidatos`);
    const resumo = [
      rec ? `${u.plural(abertas.length, 'vaga aberta', 'vagas abertas')} e ${u.plural(cands.length, 'candidato', 'candidatos')}${tempo != null ? `; a contratação leva ${u.num(tempo, 1)} dias em média` : ''}.` : 'O recrutamento não respondeu agora.',
      semCand.length ? `${u.plural(semCand.length, 'vaga está', 'vagas estão')} sem candidato: ${semCand.slice(0, 3).map((v) => v.titulo).join(', ')}.` : '',
      porEtapa[0] ? `A maior parte dos candidatos está em ${String(porEtapa[0][0]).toLowerCase()} (${porEtapa[0][1]}).` : '',
    ];
    const numeros = [
      { rotulo: 'Vagas abertas', valor: u.num(abertas.length), porque: 'Vagas com status aberta.' },
      { rotulo: 'Candidatos', valor: u.num(cands.length), porque: 'Em todas as vagas.' },
      { rotulo: 'Vagas sem candidato', valor: u.num(semCand.length), porque: 'Abertas sem ninguém inscrito.' },
      { rotulo: 'Tempo de contratação', valor: tempo != null ? `${u.num(tempo, 1)} dias` : 'sem dado', porque: 'Da abertura à contratação.' },
    ];
    const secoes = [
      { titulo: 'Vagas abertas', texto: [abertas.length ? 'Cada vaga, há quanto tempo está aberta e quantos candidatos tem.' : 'Nenhuma vaga aberta.'], tabela: abertas.length ? { colunas: ['Vaga', 'Cargo', 'Aberta há', 'Candidatos'], linhas: abertas.map((v) => [v.titulo, v.cargo || '—', idade(v) != null ? `${u.num(idade(v))} dias` : '—', u.num(cands.filter((c) => c.vaga_id === v.id).length)]) } : null },
      porEtapa.length ? { titulo: 'Candidatos por etapa', texto: ['Onde os candidatos estão no processo.'], grafico: { tipo: 'barras', rotulos: porEtapa.map((e) => e[0]), series: [{ nome: 'Candidatos', valores: porEtapa.map((e) => e[1]), papel: 'destaque' }] } } : null,
    ].filter(Boolean);
    const recomendacoes = [];
    if (semCand.length) recomendacoes.push({ o_que: `Divulgar ${semCand.slice(0, 3).map((v) => v.titulo).join(', ')}.`, por_que: 'Vaga sem candidato não anda.', impacto: 'Contratação mais rápida.', prioridade: 'media' });
    const velhas = abertas.filter((v) => idade(v) > 45);
    if (velhas.length) recomendacoes.push({ o_que: `Rever a descrição das vagas abertas há mais de 45 dias (${velhas.slice(0, 3).map((v) => v.titulo).join(', ')}).`, por_que: 'Vaga parada sobrecarrega quem está no time.', impacto: 'Time completo antes.', prioridade: 'media' });
    return fechaRh('recrutamento', { titulo: 'Recursos Humanos · Recrutamento', subtitulo: 'Vagas abertas, candidatos por etapa e tempo de contratação', resumo, numeros, secoes, historico: null, projecao: null, recomendacoes,
      metodologia: ['Vagas e candidatos de area=setor_pessoas&aba=recrutamento, só para os donos e quem administra.'] });
  }

  async function abaDocumentos(ctx) {
    const u = ctx.util, docs = await ctx.api('setor_pessoas', { aba: 'documentos' }), l = lista(docs?.documentos);
    const SIT = { vencido: 'Vencido', renovar: 'Renovar', ok: 'Em dia' }, porSit = u.contarPor(l, (d) => SIT[d.situacao] || d.situacao || 'Sem data'), porTipo = u.contarPor(l, (d) => d.tipo || d.titulo || 'Outro');
    const aviso = l.filter((d) => ['vencido', 'renovar'].includes(d.situacao)).sort((a, b) => String(a.renovacao || '').localeCompare(String(b.renovacao || '')));
    ctx.fonte('Documentos (area=setor_pessoas&aba=documentos)', `${u.num(l.length)} documentos`);
    const resumo = [
      docs ? `${u.plural(l.length, 'documento guardado', 'documentos guardados')} do time: ${porSit.map(([s, n]) => `${u.num(n)} ${s.toLowerCase()}`).join(', ') || 'nenhum'}.` : 'Os documentos não responderam agora.',
      aviso.length ? `A renovar primeiro: ${aviso.slice(0, 3).map((d) => `${d.titulo || d.tipo} de ${d.pessoa_nome}`).join('; ')}.` : l.length ? `Nenhum vence nos próximos ${u.num(docs?.avisoDias || 30)} dias.` : '',
    ];
    const numeros = [
      { rotulo: 'Documentos', valor: u.num(l.length), porque: 'Guardados no RH.' },
      { rotulo: 'Vencidos', valor: u.num(l.filter((d) => d.situacao === 'vencido').length), porque: 'A data de renovação passou.' },
      { rotulo: 'A renovar', valor: u.num(l.filter((d) => d.situacao === 'renovar').length), porque: `Vencem em até ${u.num(docs?.avisoDias || 30)} dias.` },
    ];
    const secoes = [
      { titulo: 'A renovar', texto: [aviso.length ? 'Vencidos e a renovar, pela data.' : 'Nada a renovar agora.'], tabela: aviso.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Documento', 'Renovação', 'Situação'], linhas: aviso.map((d) => [d.pessoa_nome, d.titulo || d.tipo, d.renovacao ? u.dataCurta(d.renovacao) : '—', SIT[d.situacao]]) } : null },
      porTipo.length ? { titulo: 'Por tipo', texto: ['Quantos documentos de cada tipo.'], grafico: { tipo: 'ranking', itens: porTipo.slice(0, 10).map(([t, n]) => ({ rotulo: t, valor: n })) } } : null,
    ].filter(Boolean);
    const recomendacoes = aviso.length ? [{ o_que: `Renovar ${u.plural(aviso.length, 'documento', 'documentos')}, a começar por ${aviso[0].titulo || aviso[0].tipo} de ${aviso[0].pessoa_nome}.`, por_que: 'Contrato vencido é risco trabalhista.', impacto: 'Documentação em dia.', prioridade: aviso.some((d) => d.situacao === 'vencido') ? 'alta' : 'media' }] : [];
    return fechaRh('documentos', { titulo: 'Recursos Humanos · Documentos', subtitulo: 'Os documentos do time e o que vence', resumo, numeros, secoes, historico: null, projecao: null, recomendacoes,
      metodologia: ['Documentos de area=setor_pessoas&aba=documentos, só para os donos e quem administra.'] });
  }
  const ABAS_RH = { produtividade: abaProdutividade, rh: abaPedidos, recrutamento: abaRecrutamento, documentos: abaDocumentos };
  const ABAS = [
    { id: 'produtividade', nome: 'Produtividade', telas: ['produtividade', 'setor:pessoas'] },
    { id: 'rh', nome: 'Pedidos ao RH', telas: ['rh'] },
    { id: 'recrutamento', nome: 'Recrutamento', telas: ['recrutamento'], acesso: 'donos' },
    { id: 'documentos', nome: 'Documentos', telas: ['documentos'], acesso: 'donos' },
  ];
  async function relatorioComAbas(ctx) { return ctx.aba && ABAS_RH[ctx.aba.id] ? ABAS_RH[ctx.aba.id](ctx) : relatorio(ctx); }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('rh', relatorioComAbas, { nome: 'Recursos Humanos', telas: ['setor:pessoas', 'produtividade', 'rh', 'recrutamento', 'documentos'], agente: { nome: 'VYBES', papel: 'Pessoas e RH' }, abas: ABAS });
  raiz.VybeRelRh = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
