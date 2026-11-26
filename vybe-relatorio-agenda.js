// vybe-relatorio-agenda.js — o relatório técnico da Agenda e captações, pelo Heitor. Paulo, 26/11/2026 (vybe-relatorio.js).
// Só leitura: as captações vêm de GET /api/painel?area=captacoes (janelas de até 42 dias, a mesma rota da tela) e as peças
// que esperam captação, do que o painel já carregou (status "Agendar Captação").
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const MAX_JANELAS = 10; // ~14 meses de captações; mais que isso pesa no servidor (cada janela lê o Google Agenda)

  // Lê as captações de [inicio, fim] em janelas de 42 dias e junta sem repetir.
  async function lerCaptacoes(ctx, inicio, fim) {
    const u = ctx.util, janelas = [];
    for (let d = inicio; d <= fim && janelas.length < MAX_JANELAS; d = u.somarDias(d, 42)) janelas.push(d);
    const respostas = [];
    for (let i = 0; i < janelas.length; i += 3) respostas.push(...await Promise.all(janelas.slice(i, i + 3).map((s) => ctx.api('captacoes', { semana: s, dias: 42 }))));
    const porId = new Map();
    let ok = false, clientes = [];
    for (const r of respostas) {
      if (!r) continue; ok = true; if (lista(r.clientes).length) clientes = r.clientes;
      for (const k of lista(r.captacoes)) if (k && k.id != null && !porId.has(String(k.id))) porId.set(String(k.id), k);
    }
    return { ok, clientes, captacoes: [...porId.values()].filter((k) => String(k.dia || '') >= inicio && String(k.dia || '') <= fim) };
  }

  function contar(l, hoje) {
    const pecas = l.flatMap((k) => lista(k.pecas));
    const passadas = l.filter((k) => k.dia < hoje);
    return { total: l.length, gravadas: l.filter((k) => k.estado === 'gravada').length, aFazer: l.filter((k) => k.dia >= hoje && k.estado !== 'gravada').length,
      faltaFechar: passadas.filter((k) => !k.fechada_em).length, passadas: passadas.length,
      pecas: pecas.length, pecasGravadas: pecas.filter((p) => p.gravado).length, videos: pecas.filter((p) => p.tipo !== 'foto').length, fotos: pecas.filter((p) => p.tipo === 'foto').length };
  }

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas;
    const inicioHist = [per.anterior.inicio, `${u.somarMeses(per.fim.slice(0, 7), -5)}-01`].sort()[0];
    const lido = await lerCaptacoes(ctx, inicioHist < u.somarDias(per.fim, -420) ? u.somarDias(per.fim, -420) : inicioHist, per.fim > u.somarDias(hoje, 30) ? per.fim : u.somarDias(hoje, 30));
    const todas = lido.captacoes;
    const doPer = todas.filter((k) => u.dentro(k.dia, per)), doAnt = todas.filter((k) => u.dentro(k.dia, per.anterior));
    const at = contar(doPer, hoje), an = contar(doAnt, hoje);
    const contra = { contra: `vs ${per.anterior.rotulo}` };
    // Peças do feed que esperam captação (status "Agendar Captação") e quantas já estão numa captação marcada.
    const marcadas = new Set(todas.filter((k) => k.estado === 'agendada').flatMap((k) => lista(k.pecas).map((p) => String(p.id))));
    const pecas = ctx.dados.pecas();
    const esperando = pecas.filter((d) => P.chave(d.status) === 'agendar captacao' && P.situacao(d, hoje).situacao !== 'esquecida');
    const semCaptacao = esperando.filter((d) => !marcadas.has(String(d.vybe_id || d.conteudo_id || '').replace(/^vybe:/, '')) && !marcadas.has(String(d.id || '').replace(/^vybe:/, '')));
    const urgentes = semCaptacao.filter((d) => { const r = P.dataDe(d); return r && r <= u.somarDias(hoje, 7); }).sort((a, b) => P.dataDe(a).localeCompare(P.dataDe(b)));
    ctx.fonte('Peças da Produção (DADOS_ALL)', `${u.num(esperando.length)} peças em "Agendar Captação" no painel`);
    const porCliente = new Map();
    for (const k of doPer) {
      const c = porCliente.get(k.cliente || 'Sem cliente') || { nome: k.cliente || 'Sem cliente', total: 0, gravadas: 0, pecas: 0, faltaFechar: 0 };
      c.total++; if (k.estado === 'gravada') c.gravadas++; c.pecas += lista(k.pecas).length; if (k.dia < hoje && !k.fechada_em) c.faltaFechar++;
      porCliente.set(c.nome, c);
    }
    const clientes = [...porCliente.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    const ativos = lista(lido.clientes).map((c) => c.nome);
    const semCaptar = ativos.filter((n) => !todas.some((k) => k.cliente === n && k.dia >= u.somarDias(hoje, -60)));
    const mesesH = u.mesesEntre(`${u.somarMeses(per.fim.slice(0, 7), -5)}-01`, per.fim);
    const hist = mesesH.map((m) => ({ mes: m, ...contar(todas.filter((k) => k.dia.slice(0, 7) === m), hoje) }));
    const faltaFechar = doPer.filter((k) => k.dia < hoje && !k.fechada_em).sort((a, b) => a.dia.localeCompare(b.dia));
    const proximas = todas.filter((k) => k.dia >= hoje && k.dia <= u.somarDias(hoje, 14) && k.estado !== 'gravada');
    const sem = (k) => lista(k.pecas).filter((p) => !p.gravado).length;

    const resumo = [];
    if (!lido.ok) resumo.push('A leitura das captações não respondeu agora; o relatório traz só as peças que esperam captação.');
    resumo.push(at.total ? `No período, ${u.plural(at.total, 'captação marcada', 'captações marcadas')} com ${u.plural(at.pecas, 'peça', 'peças')}: ${u.num(at.gravadas)} já ${at.gravadas === 1 ? 'gravada' : 'gravadas'} e ${u.num(at.aFazer)} por fazer.` : 'Nenhuma captação marcada no período.');
    if (at.faltaFechar) resumo.push(`${u.plural(at.faltaFechar, 'captação já passou', 'captações já passaram')} e ninguém fechou a gravação: o material pode estar parado sem ir para a edição.`);
    resumo.push(esperando.length ? `${u.plural(esperando.length, 'peça espera', 'peças esperam')} captação; ${u.num(semCaptacao.length)} ainda sem captação marcada${urgentes.length ? `, ${u.num(urgentes.length)} com data em até 7 dias` : ''}.` : 'Nenhuma peça parada esperando captação.');
    if (semCaptar.length && lido.ok) resumo.push(`${u.plural(semCaptar.length, 'cliente ativo não tem', 'clientes ativos não têm')} captação nos últimos 60 dias.`);

    const numeros = [
      { rotulo: 'Captações no período', valor: u.num(at.total), variacao: u.variacao(at.total, an.total, '', contra), porque: 'Captações marcadas (não canceladas) com dia dentro do período.' },
      { rotulo: 'Gravadas', valor: `${u.num(at.gravadas)}${at.total ? ` · ${u.pct(at.gravadas, at.total)}%` : ''}`, variacao: u.variacao(at.gravadas, an.gravadas, 'maior', contra), porque: 'Todas as peças da captação marcadas como gravadas.' },
      { rotulo: 'Peças captadas', valor: `${u.num(at.pecasGravadas)} de ${u.num(at.pecas)}`, variacao: u.variacao(at.pecasGravadas, an.pecasGravadas, 'maior', contra), porque: `${u.num(at.videos)} de vídeo e ${u.num(at.fotos)} de foto nas captações do período.` },
      { rotulo: 'Falta fechar', valor: u.num(at.faltaFechar), porque: 'Dia já passou e a gravação não foi fechada (sem link do material nem o que gerou).' },
      { rotulo: 'Esperando captação', valor: u.num(esperando.length), porque: 'Peças em "Agendar Captação" no painel, de qualquer data.' },
      { rotulo: 'Sem captação marcada', valor: u.num(semCaptacao.length), porque: semCaptacao.length ? 'Esperam captação e não estão em nenhuma captação agendada.' : 'Toda peça que espera captação já tem dia.' },
    ];
    const secoes = [
      { titulo: 'Captações por cliente', texto: [clientes[0] ? `Quem mais captou no período: ${clientes.slice(0, 3).map((c) => `${c.nome} (${c.total})`).join(', ')}.` : 'Sem captação no período.'],
        grafico: clientes.length ? { tipo: 'ranking', de: 'cliente', itens: clientes.slice(0, 10).map((c) => ({ rotulo: c.nome, valor: c.total, sub: `${c.pecas} peças`, tom: c.faltaFechar ? 'ruim' : '' })) } : null,
        tabela: clientes.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Captações', 'Gravadas', 'Peças', 'Falta fechar'], linhas: clientes.slice(0, 15).map((c) => [c.nome, u.num(c.total), u.num(c.gravadas), u.num(c.pecas), u.num(c.faltaFechar)]) } : null },
      { titulo: 'Gravações que faltam fechar', texto: faltaFechar.length ? ['A mais antiga primeiro. Fechar é registrar o que foi gravado e o link do material: sem isso a edição não começa.'] : ['Todas as captações que já passaram foram fechadas.'],
        tabela: faltaFechar.length ? { colunas: ['Dia', { rotulo: 'Cliente', cliente: true }, 'Local', 'Peças', 'Sem gravar', 'Dias'], linhas: faltaFechar.slice(0, 20).map((k) => [u.dataCurta(k.dia), k.cliente || '—', String(k.local || '—').slice(0, 30), u.num(lista(k.pecas).length), u.num(sem(k)), u.num(u.diasEntre(k.dia, hoje))]) } : null },
      { titulo: 'Peças sem captação marcada', texto: urgentes.length ? [`${u.plural(urgentes.length, 'peça tem', 'peças têm')} data em até 7 dias e nenhuma captação marcada: é o risco de furo mais perto.`] : ['Nenhuma peça urgente sem captação.'],
        tabela: urgentes.length ? { colunas: ['Data', 'Peça', { rotulo: 'Cliente', cliente: true }, 'Formato'], linhas: urgentes.slice(0, 20).map((d) => [u.dataCurta(P.dataDe(d)), String(d.nome || d.titulo || '').slice(0, 44), P.clientesDe(d).join(', ').slice(0, 26), String(d.formato || '—')]) } : null },
      { titulo: 'Próximos 14 dias', texto: [proximas.length ? `${u.plural(proximas.length, 'captação marcada', 'captações marcadas')} até ${u.dataCurta(u.somarDias(hoje, 14))}.` : 'Nada marcado nos próximos 14 dias.'],
        tabela: proximas.length ? { colunas: ['Dia', 'Hora', { rotulo: 'Cliente', cliente: true }, 'Local', 'Peças'], linhas: proximas.slice(0, 20).map((k) => [u.dataCurta(k.dia), k.inicio || '—', k.cliente || '—', String(k.local || '—').slice(0, 30), u.num(lista(k.pecas).length)]) } : null },
    ];
    if (semCaptar.length && lido.ok) secoes.push({ titulo: 'Clientes sem captação há 60 dias', texto: ['Clientes ativos sem nenhuma captação nos últimos 60 dias: vale conferir se o plano deles pede vídeo ou foto.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }], linhas: semCaptar.slice(0, 30).map((n) => [n]) } });
    const historico = { texto: [`Captações por mês. ${u.tendenciaTexto(hist.map((h) => h.total), { coisa: 'Tendência das captações', melhor: '' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Gravadas', valores: hist.map((h) => h.gravadas), papel: 'pronto' }, { nome: 'Outras', valores: hist.map((h) => h.total - h.gravadas), papel: 'aberto' }], empilhado: true },
      tabela: { colunas: ['Mês', 'Captações', 'Gravadas', 'Peças', 'Falta fechar'], linhas: hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.gravadas), u.num(h.pecas), u.num(h.faltaFechar)]) } };
    const prox = u.projetar(hist.map((h) => h.total), 3);
    const projecao = { texto: [`Se o ritmo dos últimos meses seguir: ${[1, 2, 3].map((k, i) => `${u.nomeMes(u.somarMeses(per.fim.slice(0, 7), k))} ≈ ${u.num(prox[i])}`).join(', ')} captações.`,
      esperando.length ? `Com ${u.num(esperando.length)} peças esperando e ${u.num(at.total ? at.pecas / at.total : 0, 1)} peças por captação, faltam cerca de ${u.num(Math.ceil(semCaptacao.length / Math.max(1, at.total ? at.pecas / at.total : 3)))} captações para zerar a fila.` : 'Sem fila de captação.'] };
    const recomendacoes = [];
    if (urgentes.length) recomendacoes.push({ o_que: `Marcar captação para as ${u.num(urgentes.length)} peças com data em até 7 dias.`, por_que: 'Sem captação marcada não há material, e a data do cliente não muda.', impacto: `${u.num(urgentes.length)} furos evitados.`, prioridade: 'alta' });
    if (at.faltaFechar) recomendacoes.push({ o_que: `Fechar as ${u.num(at.faltaFechar)} gravações que já passaram${faltaFechar[0] ? `, a começar por ${faltaFechar[0].cliente} (${u.dataCurta(faltaFechar[0].dia)})` : ''}.`, por_que: 'Fechar registra o que foi gravado e leva o material para a edição.', impacto: 'Peças gravadas saem do limbo e entram na fila da edição.', prioridade: 'alta' });
    if (semCaptacao.length > urgentes.length) recomendacoes.push({ o_que: `Agrupar as ${u.num(semCaptacao.length - urgentes.length)} peças restantes por cliente em captações maiores.`, por_que: 'Uma ida ao cliente que grava várias peças custa menos que várias idas.', impacto: 'Menos deslocamento e fila menor.', prioridade: 'media' });
    if (semCaptar.length && lido.ok) recomendacoes.push({ o_que: `Conferir com o atendimento os ${u.num(semCaptar.length)} clientes sem captação há 60 dias.`, por_que: 'Cliente sem material novo tende a cair em post genérico.', impacto: 'Conteúdo mais próprio para esses clientes.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter as captações fechadas no mesmo dia.', por_que: 'É o que deixa a edição começar sem esperar.', impacto: 'Fila de edição sempre andando.', prioridade: 'baixa' });
    return { titulo: 'Produção · Agenda e captações', subtitulo: 'Captações marcadas, gravadas, por fechar e o que ainda espera captação', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Captação = registro do Vybe OS (não cancelado) com o dia dentro do período; gravada = todas as peças marcadas como gravadas; falta fechar = dia passado sem o fechamento da gravação.', 'Esperando captação = peças com status "Agendar Captação" (as esquecidas há mais de 30 dias ficam fora). A projeção é a tendência linear dos últimos 6 meses.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('agenda', relatorio, { nome: 'Agenda e captações', telas: ['agenda'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' } });
  raiz.VybeRelAgenda = Object.freeze({ relatorio, lerCaptacoes, contar });
})(typeof window !== 'undefined' ? window : globalThis);
