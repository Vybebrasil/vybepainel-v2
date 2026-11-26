// vybe-relatorio-direcao.js — o relatório técnico da Direção de arte, pelo Danilo (braço direito do Deivid). Paulo,
// 26/11/2026 (vybe-relatorio.js). As peças do time de design (EQUIPES.design, vybe-config.js), a fila do parecer da
// arte (GET /api/painel?area=aprovacoes, etapa interna) e o que voltou para alteração. Só leitura.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const ehVideo = (d) => /v[ií]deo|reels?|motion|anima/i.test(`${d.formato || ''} ${d.nome || d.titulo || ''}`);
  const time = () => { try { return typeof EQUIPES !== 'undefined' && EQUIPES?.design ? lista(EQUIPES.design).map(String) : []; } catch { return []; } };

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas;
    const equipe = ctx.dados.equipe(), ids = new Set(time());
    const nomesTime = new Set(lista(equipe).filter((p) => ids.has(String(p.id))).map((p) => String(p.name || p.nome || '').trim()).filter(Boolean));
    const todas = ctx.dados.pecas();
    // Peça de arte: tem alguém do time de design como responsável; sem time conhecido, toda peça que não é vídeo.
    const doTime = (d) => {
      const rid = Array.isArray(d.responsavel_ids) ? d.responsavel_ids.map(String) : d.responsavel_id ? [String(d.responsavel_id)] : [];
      if (ids.size && rid.some((i) => ids.has(i))) return true;
      if (nomesTime.size) return String(d.responsavel || '').split(',').some((n) => nomesTime.has(n.trim()));
      return !ehVideo(d);
    };
    const pecas = todas.filter(doTime);
    ctx.fonte('Peças do time de design (DADOS_ALL)', `${u.num(pecas.length)} de ${u.num(todas.length)} peças têm alguém do design (${[...nomesTime].join(', ') || 'time não identificado: peças que não são vídeo'})`);
    const apr = await ctx.api('aprovacoes');
    const a = P.analisar({ pecas, per, hoje, equipe });
    const at = a.atual, an = a.anterior;
    const v = (x, y, m) => u.variacao(x, y, m, { contra: `vs ${a.contraRotulo}` });
    const fila = lista(apr?.pecas).filter((p) => p.etapa === 'interna' && String(p.status || '').toLowerCase().includes('aprova'));
    const medFila = u.mediana(fila.map((p) => Number(p.horas)).filter(Number.isFinite));
    const faltaDA = a.abertas.filter((x) => x.s.chave === 'falta d a');
    const alteracao = a.doPer.filter((x) => x.s.chave === 'alteracao');
    const taxaAlt = at.total ? u.pct(at.alteracao, at.total) : 0, taxaAltAnt = an.total ? u.pct(an.alteracao, an.total) : 0;
    const pessoasTime = a.porPessoa.filter((p) => !nomesTime.size || nomesTime.has(p.nome));
    const atrasam = P.quemAtrasa({ porPessoa: pessoasTime });
    const altPorPessoa = new Map();
    for (const x of alteracao) for (const n of x.pessoas) altPorPessoa.set(n, (altPorPessoa.get(n) || 0) + 1);
    const dias = (h) => (h == null ? '—' : h < 24 ? `${u.num(h)} h` : `${u.num(h / 24, 1)} d`);

    const resumo = [
      at.total ? `O time de design tem ${u.plural(at.total, 'peça', 'peças')} no período: ${u.num(at.entregues)} finalizadas e ${u.num(at.abertas)} em aberto.` : 'O time de design não tem peças com data neste período.',
      apr ? (fila.length ? `${u.plural(fila.length, 'arte espera', 'artes esperam')} o parecer da direção de arte, com espera mediana de ${dias(medFila)}.` : 'Nenhuma arte esperando parecer agora.') : 'A fila de aprovação não respondeu agora.',
      at.alteracao ? `${u.plural(at.alteracao, 'peça voltou', 'peças voltaram')} para alteração (${taxaAlt}% do período${an.total ? `, contra ${taxaAltAnt}% antes` : ''}).` : '',
      atrasam.length ? `Atrasos no time: ${atrasam.map((p) => `${p.nome} (${p.atrasadas})`).join(', ')}.` : (at.total ? 'Ninguém do time com peça atrasada.' : ''),
      faltaDA.length ? `${u.plural(faltaDA.length, 'peça espera', 'peças esperam')} a direção de arte para começar ("Falta D.A.").` : '',
    ].filter(Boolean);
    const numeros = [
      { rotulo: 'Peças do design', valor: u.num(at.total), variacao: v(at.total, an.total, ''), porque: 'Peças com alguém do time de design como responsável e data no período.' },
      { rotulo: 'Finalizadas', valor: `${u.num(at.entregues)}${at.total ? ` · ${u.pct(at.entregues, at.total)}%` : ''}`, variacao: v(at.entregues, an.entregues, 'maior'), porque: 'Pronta só em Finalizado.' },
      { rotulo: 'Esperando parecer', valor: apr ? u.num(fila.length) : 'sem dado', porque: 'Artes em aprovação interna agora (a fila do diretor de arte).' },
      { rotulo: 'Taxa de alteração', valor: `${taxaAlt}%`, variacao: u.variacao(taxaAlt, taxaAltAnt, 'menor', { contra: `vs ${a.contraRotulo}`, pontos: true }), porque: 'Peças do período em alteração ÷ peças do período.' },
      { rotulo: 'Atrasadas', valor: u.num(at.atrasadas), variacao: v(at.atrasadas, an.atrasadas, 'menor'), porque: 'Data já passou e a peça não está finalizada.' },
      { rotulo: 'Falta D.A.', valor: u.num(faltaDA.length), porque: 'Abertas paradas esperando a direção de arte para começar.' },
    ];
    const secoes = [
      { titulo: 'Carga do time', texto: ['Peças de cada pessoa do design no período.'],
        grafico: pessoasTime.length ? { tipo: 'barras', rotulos: pessoasTime.map((p) => p.nome.split(' ')[0]), series: [{ nome: 'Finalizadas', valores: pessoasTime.map((p) => p.entregues), papel: 'pronto' }, { nome: 'Abertas', valores: pessoasTime.map((p) => p.abertas), papel: 'aberto' }, { nome: 'Atrasadas', valores: pessoasTime.map((p) => p.atrasadas), papel: 'atraso' }] } : null,
        tabela: pessoasTime.length ? { colunas: ['Pessoa', 'Peças', 'Finalizadas', 'Abertas', 'Atrasadas', 'Em alteração'], linhas: pessoasTime.map((p) => [p.nome, u.num(p.total), u.num(p.entregues), u.num(p.abertas), u.num(p.atrasadas), u.num(altPorPessoa.get(p.nome) || 0)]) } : null },
      { titulo: 'Fila do parecer da arte', texto: [fila.length ? 'A mais antiga primeiro.' : 'Sem arte esperando parecer.'],
        tabela: fila.length ? { colunas: ['Peça', 'Cliente', 'Formato', 'Esperando há'], linhas: [...fila].sort((x, y) => Number(y.horas) - Number(x.horas)).slice(0, 20).map((p) => [String(p.titulo || '').slice(0, 44), String(p.cliente || '—').slice(0, 26), String(p.formato || '—'), dias(Number(p.horas))]) } : null },
      { titulo: 'O que voltou para alteração', texto: [alteracao.length ? `Por formato: ${u.contarPor(alteracao, (x) => String(x.d.formato || 'Sem formato')).slice(0, 4).map(([f, n]) => `${f.toLowerCase()} (${n})`).join(', ')}.` : 'Nenhuma peça do período em alteração.'],
        tabela: alteracao.length ? { colunas: ['Data', 'Peça', 'Cliente', 'Com quem'], linhas: alteracao.slice(0, 20).map((x) => [u.dataCurta(x.data), String(x.d.nome || x.d.titulo || '').slice(0, 40), x.clientes.join(', ').slice(0, 24), x.pessoas.join(', ').slice(0, 22)]) } : null },
      { titulo: 'Formatos', texto: ['O que o time desenhou no período.'], grafico: a.porFormato.length ? { tipo: 'rosca', fatias: a.porFormato.slice(0, 7).map(([f, n]) => ({ rotulo: f, valor: n })), centro: u.num(at.total), sub: 'peças' } : null },
      { titulo: 'Atrasadas do design', texto: a.atrasadas.length ? ['A data mais antiga primeiro.'] : ['Nenhuma atrasada.'],
        tabela: a.atrasadas.length ? { colunas: ['Data', 'Peça', 'Cliente', 'Status', 'Com quem', 'Dias'], linhas: a.atrasadas.slice(0, 20).map((x) => [u.dataCurta(x.data), String(x.d.nome || x.d.titulo || '').slice(0, 36), x.clientes.join(', ').slice(0, 22), String(x.d.status || ''), x.pessoas.join(', ').slice(0, 20), u.num(u.diasEntre(x.data, hoje))]) } : null },
    ];
    const historico = { texto: [`Peças do design por mês. ${u.tendenciaTexto(a.hist.map((h) => h.alteracao), { coisa: 'Tendência das alterações', melhor: 'menor' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: a.hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Finalizadas', valores: a.hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: a.hist.map((h) => h.abertas), papel: 'aberto' }], empilhado: true },
      tabela: { colunas: ['Mês', 'Peças', 'Finalizadas', 'Atrasadas', 'Em alteração'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), u.num(h.alteracao)]) } };
    const prox = u.projetar(a.hist.map((h) => h.total), 3);
    const projecao = { texto: [a.ritmo?.projetado != null && at.total ? `No ritmo de agora (${u.num(a.ritmo.porDia, 1)} finalizadas por dia), o time fecha o período com cerca de ${u.num(Math.min(a.ritmo.projetado, at.total))} de ${u.num(at.total)}.` : 'Período fechado.',
      `Volume esperado para o design: ${[1, 2, 3].map((k, i) => `${u.nomeMes(u.somarMeses(per.fim.slice(0, 7), k))} ≈ ${u.num(prox[i])}`).join(', ')} peças.`] };
    const recomendacoes = [];
    if (fila.length && medFila >= 24) recomendacoes.push({ o_que: `Dar parecer às ${u.num(fila.length)} artes na fila, a mais antiga primeiro.`, por_que: `A espera mediana está em ${dias(medFila)}: a arte parada segura a aprovação do cliente.`, impacto: 'Peças chegam ao cliente com mais folga.', prioridade: 'alta' });
    if (atrasam[0]) recomendacoes.push({ o_que: `Redistribuir parte das atrasadas de ${atrasam[0].nome} (${atrasam[0].atrasadas}).`, por_que: 'Quem tem mais atraso não fecha a fila sozinho.', impacto: `${u.num(atrasam[0].atrasadas)} peças com chance de sair no prazo.`, prioridade: 'alta' });
    if (faltaDA.length) recomendacoes.push({ o_que: `Passar a direção das ${u.num(faltaDA.length)} peças em "Falta D.A.".`, por_que: 'Sem direção a peça nem começa.', impacto: 'O time ganha fila para trabalhar.', prioridade: 'media' });
    if (taxaAlt >= 15) recomendacoes.push({ o_que: 'Revisar o briefing e a referência das peças que mais voltam.', por_que: `${taxaAlt}% do período voltou para alteração.`, impacto: 'Menos retrabalho no time.', prioridade: 'media' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter o parecer da arte no mesmo dia.', por_que: 'A fila curta é o que dá folga para o cliente aprovar.', impacto: 'Prazo protegido.', prioridade: 'baixa' });
    return { titulo: 'Direção de arte', subtitulo: 'Carga do time de design, fila do parecer, alterações e atrasos', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Peças do design = com alguém do time de design (EQUIPES.design) como responsável; data = veiculação, sem ela o prazo.', 'Fila do parecer = peças em aprovação interna (rota aprovacoes); a taxa de alteração usa o status de hoje das peças do período.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('direcao', relatorio, { nome: 'Direção de arte', telas: ['direcao'], agente: { nome: 'Danilo', papel: 'Direção de arte' } });
  raiz.VybeRelDirecao = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
