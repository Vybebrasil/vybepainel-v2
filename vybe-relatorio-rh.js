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
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('rh', relatorio, { nome: 'Recursos Humanos', telas: ['setor:pessoas', 'produtividade', 'rh', 'recrutamento', 'documentos'], agente: { nome: 'VYBES', papel: 'Pessoas e RH' } });
  raiz.VybeRelRh = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
