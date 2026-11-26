// vybe-relatorio-ranking.js — o relatório técnico do Ranking (XP do trabalho no Escritório), pelo VYBES. Paulo, 26/11/2026
// (vybe-relatorio.js). Só leitura, pelas rotas da janela do Ranking: GET /api/painel?area=escritorio&acao=ranking&periodo=
// semana|mes (o servidor só calcula dia, semana, mês e desde sempre) e o score semanal guardado (area=series&para=pessoas,
// que dá a linha de cada um a quem é da gestão e só a própria aos outros). Nada de moedas ou prêmio pago aqui.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const seta = (p) => (p.antes && p.posicao ? (p.antes > p.posicao ? `subiu ${p.antes - p.posicao}` : p.antes < p.posicao ? `caiu ${p.posicao - p.antes}` : 'manteve') : p.posicao ? 'novo no pódio' : '—');

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo;
    const curto = per.meses.length <= 1 && per.emCurso;
    const [mes, semana, score] = await Promise.all([ctx.api('escritorio', { acao: 'ranking', periodo: 'mes' }), ctx.api('escritorio', { acao: 'ranking', periodo: 'semana' }), ctx.api('series', { para: 'pessoas', leitura: 1 })]);
    const principal = mes?.disponivel === false ? null : mes;
    const ps = lista(principal?.pessoas), sem = lista(semana?.pessoas);
    const comPos = ps.filter((p) => p.posicao).sort((a, b) => a.posicao - b.posicao);
    const lider = comPos[0], semEntrega = ps.filter((p) => !p.entregas);
    const superacao = [...ps].filter((p) => p.entregas).sort((a, b) => b.pct - a.pct)[0];
    const subiram = ps.filter((p) => p.antes && p.posicao && p.antes > p.posicao).sort((a, b) => (b.antes - b.posicao) - (a.antes - a.posicao));
    const ag = principal?.agencia || null, agS = semana?.agencia || null;
    // Score da semana (12 semanas): a média da equipe e a linha de cada um.
    const linhas = Object.values(score?.score || {}).map((x) => ({ nome: x.nome || x.sujeito, pontos: lista(x.pontos) })).filter((x) => x.pontos.length);
    const semanas = [...new Set(linhas.flatMap((x) => x.pontos.map((p) => p.dia)))].sort();
    const mediaSem = semanas.map((d) => { const v = linhas.map((x) => x.pontos.find((p) => p.dia === d)?.valor).filter((n) => Number.isFinite(Number(n))).map(Number); return v.length ? Math.round(u.media(v)) : null; });
    const resumo = [];
    if (!principal) resumo.push('O ranking não respondeu agora (ou o Escritório ainda não está ligado neste ambiente).');
    else {
      resumo.push(lider ? `No mês, ${lider.nome} lidera com ${u.num(lider.xp)} XP${comPos[1] ? `, seguido de ${comPos[1].nome} (${u.num(comPos[1].xp)})` : ''}${comPos[2] ? ` e ${comPos[2].nome} (${u.num(comPos[2].xp)})` : ''}.` : 'Ninguém pontuou no mês ainda.');
      if (ag) resumo.push(`A agência fez ${u.num(ag.pecas)} de ${u.num(ag.meta)} peças da meta do mês (${u.num(ag.pct)}%).`);
      if (superacao) resumo.push(`Maior superação da própria meta: ${superacao.nome} (${u.num(superacao.pct)}%).`);
      if (subiram[0]) resumo.push(`Quem mais subiu sobre o mês passado: ${subiram.slice(0, 2).map((p) => `${p.nome} (${seta(p)})`).join(', ')}.`);
      if (semEntrega.length) resumo.push(`${u.plural(semEntrega.length, 'pessoa ainda não tem', 'pessoas ainda não têm')} entrega no mês.`);
    }
    if (!curto) resumo.push('O ranking é sempre do mês e da semana em curso: o período escolhido vale para o score semanal guardado.');
    const numeros = [
      { rotulo: 'Líder do mês', valor: lider ? lider.nome : '—', porque: lider ? `${u.num(lider.xp)} XP do trabalho (o XP pesa o papel na peça e o formato).` : 'Sem pontuação.' },
      { rotulo: 'Meta da agência (mês)', valor: ag ? `${u.num(ag.pecas)} de ${u.num(ag.meta)}` : 'sem dado', porque: 'Peças entregues pela agência contra a meta proporcional ao mês.' },
      { rotulo: 'Meta da agência (semana)', valor: agS ? `${u.num(agS.pct)}%` : 'sem dado', porque: agS ? `${u.num(agS.pecas)} de ${u.num(agS.meta)} peças; batida, todo mundo ganha o bônus.` : '' },
      { rotulo: 'XP da equipe no mês', valor: u.num(ps.reduce((t, p) => t + (Number(p.xp) || 0), 0)), porque: 'Soma do XP do trabalho de todos no mês.' },
      { rotulo: 'Sem entrega no mês', valor: u.num(semEntrega.length), porque: 'Pessoas do ranking sem nenhuma entrega contada no mês.' },
      { rotulo: 'Score médio da semana', valor: mediaSem.length && mediaSem[mediaSem.length - 1] != null ? u.num(mediaSem[mediaSem.length - 1]) : 'sem dado', variacao: mediaSem.length >= 2 && mediaSem[mediaSem.length - 2] != null ? u.variacao(mediaSem[mediaSem.length - 1], mediaSem[mediaSem.length - 2], 'maior', { contra: 'vs semana anterior' }) : null, porque: 'Média do score semanal guardado pelo servidor.' },
    ];
    const secoes = [
      { titulo: 'Ranking do mês', texto: ['Posição pelo XP do trabalho; o % é da própria meta (a Superação).'],
        grafico: comPos.length ? { tipo: 'ranking', itens: comPos.slice(0, 12).map((p, i) => ({ rotulo: `${p.posicao}º ${p.nome}`, valor: Number(p.xp) || 0, sub: `${u.num(p.pct)}% da meta`, destaque: i === 0 })) } : null,
        tabela: ps.length ? { colunas: ['Posição', 'Pessoa', 'XP', 'Entregas', 'Meta', '% da meta', 'Sobre o mês passado'], linhas: [...ps].sort((a, b) => (a.posicao || 999) - (b.posicao || 999)).map((p) => [p.posicao ? `${p.posicao}º` : '—', p.nome, u.num(p.xp), u.num(p.entregas), u.num(p.meta), `${u.num(p.pct)}%`, seta(p)]) } : null },
      { titulo: 'Semana em curso', texto: [sem.length ? 'Quem está na frente nesta semana (o pódio da semana é pago no fechamento).' : 'Sem dado da semana.'],
        tabela: sem.length ? { colunas: ['Posição', 'Pessoa', 'XP', 'Entregas', '% da meta'], linhas: [...sem].filter((p) => p.posicao).sort((a, b) => a.posicao - b.posicao).slice(0, 10).map((p) => [`${p.posicao}º`, p.nome, u.num(p.xp), u.num(p.entregas), `${u.num(p.pct)}%`]) } : null },
      { titulo: 'De onde vem o XP', texto: ['As atividades que mais deram XP no mês.'],
        tabela: (() => { const m = new Map(); for (const p of ps) for (const [k, v] of Object.entries(p.xpPor || {})) m.set(k, (m.get(k) || 0) + Number(v)); const l = [...m].sort((a, b) => b[1] - a[1]).slice(0, 12); return l.length ? { colunas: ['Atividade', 'XP'], linhas: l.map(([k, v]) => [String(k).replace(/_/g, ' '), u.num(v)]) } : null; })() },
    ];
    if (principal?.anterior?.podio?.length) secoes.push({ titulo: 'Pódio da semana passada', texto: [`Semana de ${u.dataCurta(principal.anterior.inicio)} a ${u.dataCurta(principal.anterior.fim)}${principal.anterior.agenciaBateu ? '; a agência bateu a meta' : ''}.`],
      tabela: { colunas: ['Posição', 'Pessoa'], linhas: principal.anterior.podio.sort((a, b) => a.posicao - b.posicao).map((p) => [`${p.posicao}º`, p.nome]) } });
    const historico = semanas.length >= 3
      ? { texto: [`Score semanal guardado (12 semanas). ${u.tendenciaTexto(mediaSem.filter((v) => v != null), { coisa: 'Tendência do score médio', melhor: 'maior' }).texto.replace('por mês', 'por semana')}.`],
        grafico: { tipo: 'linha', rotulos: semanas.map((d) => u.dataCurta(d)), series: [{ nome: 'Média da equipe', valores: mediaSem }, ...linhas.slice(0, 4).map((x) => ({ nome: x.nome, valores: semanas.map((d) => { const p = x.pontos.find((q) => q.dia === d); return p ? Number(p.valor) : null; }) }))] },
        tabela: { colunas: ['Semana de', 'Score médio'], linhas: semanas.map((d, i) => [u.dataCurta(d), mediaSem[i] != null ? u.num(mediaSem[i]) : '—']) } }
      : { texto: ['O servidor ainda não guardou semanas suficientes do score.'] };
    const proj = ag && principal?.fim ? u.ritmo({ feito: ag.pecas, inicio: principal.inicio, fim: principal.fim, hoje: principal.hoje || ctx.hoje }) : null;
    const projecao = { texto: [proj ? `No ritmo do mês, a agência fecha com cerca de ${u.num(proj.projetado)} de ${u.num(ag.meta)} peças da meta (${u.num(u.pct(proj.projetado, ag.meta))}%).` : 'Sem dado para projetar a meta do mês.',
      lider && comPos[1] ? `Diferença entre o 1º e o 2º: ${u.num(lider.xp - comPos[1].xp)} XP.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (proj && proj.projetado < ag.meta) recomendacoes.push({ o_que: 'Puxar a meta da agência na reunião da semana.', por_que: `No ritmo atual, faltam cerca de ${u.num(ag.meta - proj.projetado)} peças para a meta do mês.`, impacto: 'Bônus da agência para todos.', prioridade: 'alta' });
    if (semEntrega.length) recomendacoes.push({ o_que: `Conferir a fila de ${semEntrega.slice(0, 3).map((p) => p.nome).join(', ')}.`, por_que: 'Sem entrega contada no mês: pode ser fila travada ou entrega sem registro.', impacto: 'Ranking fiel ao trabalho.', prioridade: 'media' });
    if (superacao) recomendacoes.push({ o_que: `Reconhecer ${superacao.nome} pela superação.`, por_que: `${u.num(superacao.pct)}% da própria meta no mês.`, impacto: 'Time engajado.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter o fechamento semanal do ranking.', por_que: 'O ranking está rodando.', impacto: 'Ritmo mantido.', prioridade: 'baixa' });
    return { titulo: 'Ranking', subtitulo: 'XP do trabalho do mês e da semana, meta da agência e o score semanal', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Ranking do Escritório: posição pelo XP do trabalho (o papel na peça e o formato pesam); % da meta = entregas ÷ meta da pessoa na proporção do período. O servidor calcula só o mês e a semana em curso.', 'Score semanal: série score_semana do servidor (12 semanas); quem não é da gestão recebe só a própria linha.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('ranking', relatorio, { nome: 'Ranking', telas: ['ranking'], agente: { nome: 'VYBES', papel: 'Escritório e ranking' } });
  raiz.VybeRelRanking = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
