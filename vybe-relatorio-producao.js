// vybe-relatorio-producao.js — o relatório técnico da Produção (Visão geral), pelo Heitor (Coordenação de produção).
//
// Paulo, 26/11/2026 (botão "Gerar relatório" em todos os módulos, vybe-relatorio.js). Lê só o que a Produção já tem
// carregado: as peças (DADOS_ALL), a equipe (TEAM_USERS) e o cadastro de clientes. A situação de cada peça é a função
// oficial VybeDono.util.situacaoDaPeca (a data do cliente manda; pronta = Finalizado; pausada e esquecida fora do atraso),
// para os números baterem com a Gestão e a Visão do setor.
//
// Também deixa window.VybeRelPecas: a análise de peças de um período (usada pelos relatórios de Aprovação, Direção de
// arte e Clientes, que olham as mesmas peças por outro ângulo). Pura: recebe as peças, o período e o dia.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const U = () => raiz.VybeRelatorio.util;

  // ---------- A análise das peças (pura) ----------
  const STATUS_TRAVA = { 'falta info': 'Falta informação do cliente', 'ag info cliente': 'Falta informação do cliente', 'falta d a': 'Falta direção de arte', 'alteracao': 'Em alteração',
    'ag aprovacao cliente': 'Esperando aprovação do cliente', 'para aprovacao': 'Esperando aprovação interna', 'aguardo': 'Aguardando material', 'agendar captacao': 'Esperando captação', 'a fazer': 'Ainda não começou', 'pode fazer': 'Liberada, não começou' };
  function chave(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function situacao(d, hoje) {
    const f = raiz.VybeDono?.util?.situacaoDaPeca;
    if (typeof f === 'function') { try { return f(d, { hoje }); } catch { /* conta simples abaixo */ } }
    const k = chave(d.status), veic = String(d.veiculacao_iso || '').slice(0, 10), prazo = String(d.prazo_iso || '').slice(0, 10);
    const entregue = ['finalizado', 'finalizada', 'concluido', 'concluida', 'feito'].includes(k), ref = veic || prazo;
    const atrasada = !entregue && k !== 'segurar post' && Boolean(ref) && ref < hoje;
    return { chave: k, veic, prazo, referencia: ref, entregue, atrasada, furo: atrasada && Boolean(veic) && veic < hoje, situacao: entregue ? 'entregue' : atrasada ? 'atrasada' : 'andamento' };
  }
  const dataDe = (d) => String(d.veiculacao_iso || d.prazo_iso || '').slice(0, 10);
  function nomesDe(d, porId) {
    const ids = Array.isArray(d.responsavel_ids) && d.responsavel_ids.length ? d.responsavel_ids.map(String) : d.responsavel_id ? [String(d.responsavel_id)] : [];
    const n = ids.map((id) => porId.get(id)).filter(Boolean);
    if (n.length) return [...new Set(n)];
    const t = String(d.responsavel || '').split(',').map((s) => s.trim()).filter((s) => s && s !== '—');
    return t.length ? [...new Set(t)] : ['Sem responsável'];
  }
  const clientesDe = (d) => [...new Set((Array.isArray(d.clientes) && d.clientes.length ? d.clientes : [d.cliente]).map((c) => String(c || '').trim()).filter((c) => c && c !== 'Sem cliente'))];

  // pecas: as peças (só conteúdo); per: VybeRelatorio.periodo(); equipe: TEAM_USERS; meses: quantos meses de histórico.
  function analisar({ pecas = [], per, hoje, equipe = [], meses = 6 } = {}) {
    const u = U();
    const porId = new Map(lista(equipe).map((p) => [String(p.id), String(p.name || p.nome || '').trim()]).filter(([, n]) => n));
    const marcadas = lista(pecas).filter((d) => d && dataDe(d)).map((d) => ({ d, s: situacao(d, hoje), data: dataDe(d), pessoas: nomesDe(d, porId), clientes: clientesDe(d), entregueEm: u.soDia(d.status_updated_at) }));
    // Período em curso: compara com o anterior até o mesmo ponto (mês até o dia 26 contra o mês passado até o dia 26).
    const corteAnt = per.emCurso ? u.somarDias(per.anterior.inicio, u.diasEntre(per.inicio, hoje)) : per.anterior.fim;
    const doPer = marcadas.filter((x) => u.dentro(x.data, per)), doAnt = marcadas.filter((x) => u.dentro(x.data, { inicio: per.anterior.inicio, fim: corteAnt < per.anterior.fim ? corteAnt : per.anterior.fim }));
    const contraRotulo = per.emCurso && corteAnt < per.anterior.fim ? `${per.anterior.rotulo} até ${u.dataCurta(corteAnt)}` : per.anterior.rotulo;
    const conta = (l) => {
      const ent = l.filter((x) => x.s.entregue), julg = ent.filter((x) => x.entregueEm);
      const noPrazo = julg.filter((x) => x.entregueEm <= x.data).length;
      return { total: l.length, entregues: ent.length, abertas: l.length - ent.length, atrasadas: l.filter((x) => x.s.atrasada).length, furos: l.filter((x) => x.s.furo).length,
        emRisco: l.filter((x) => x.s.emRisco).length, pausadas: l.filter((x) => x.s.situacao === 'pausada').length, esquecidas: l.filter((x) => x.s.situacao === 'esquecida').length,
        cliente: l.filter((x) => x.s.esperaCliente).length, alteracao: l.filter((x) => x.s.chave === 'alteracao').length,
        semDono: l.filter((x) => x.pessoas[0] === 'Sem responsável').length, noPrazo, julgadas: julg.length, noPrazoPct: u.pct(noPrazo, julg.length) };
    };
    const atual = conta(doPer), anterior = conta(doAnt);
    // Histórico: os `meses` até o fim do período (ou o período inteiro, se for maior).
    const fimYm = per.fim.slice(0, 7), nM = Math.max(meses, per.meses.length);
    const mesesH = u.mesesEntre(`${u.somarMeses(fimYm, -(nM - 1))}-01`, per.fim);
    const hist = mesesH.map((m) => { const l = marcadas.filter((x) => x.data.slice(0, 7) === m); const c = conta(l); return { mes: m, ...c }; });
    // Gargalos: onde as abertas do período estão paradas (por status).
    const abertas = doPer.filter((x) => !x.s.entregue && x.s.situacao !== 'pausada' && x.s.situacao !== 'esquecida');
    const porStatus = u.contarPor(abertas, (x) => String(x.d.status || 'Sem status'));
    const travas = u.contarPor(abertas, (x) => STATUS_TRAVA[x.s.chave] || null);
    // Pessoas: abertas, atrasadas e entregues de cada uma no período (peça de duas pessoas conta para as duas).
    const pessoas = new Map();
    for (const x of doPer) for (const n of x.pessoas) {
      const p = pessoas.get(n) || { nome: n, total: 0, entregues: 0, abertas: 0, atrasadas: 0, itens: [] };
      p.total++; if (x.s.entregue) p.entregues++; else if (x.s.situacao !== 'pausada' && x.s.situacao !== 'esquecida') p.abertas++;
      if (x.s.atrasada) { p.atrasadas++; p.itens.push(x); }
      pessoas.set(n, p);
    }
    const porPessoa = [...pessoas.values()].sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas || a.nome.localeCompare(b.nome, 'pt-BR'));
    const porCliente = new Map();
    for (const x of doPer) for (const c of x.clientes) {
      const p = porCliente.get(c) || { nome: c, total: 0, entregues: 0, atrasadas: 0 };
      p.total++; if (x.s.entregue) p.entregues++; if (x.s.atrasada) p.atrasadas++; porCliente.set(c, p);
    }
    const atrasadas = doPer.filter((x) => x.s.atrasada).sort((a, b) => a.data.localeCompare(b.data));
    const porFormato = u.contarPor(doPer, (x) => String(x.d.formato || '').trim() || 'Sem formato');
    // Semanas do período (segunda a domingo) × pessoa: peças com data na semana (a carga de cada um).
    const segunda = (iso) => u.somarDias(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));
    const semanas = []; for (let s = segunda(per.inicio); s <= per.fim && semanas.length < 60; s = u.somarDias(s, 7)) semanas.push(s);
    const ritmo = per.emCurso ? u.ritmo({ feito: atual.entregues, inicio: per.inicio, fim: per.fim, hoje }) : null;
    return { atual, anterior, contraRotulo, hist, porStatus, travas, porPessoa, porCliente: [...porCliente.values()].sort((a, b) => b.atrasadas - a.atrasadas || b.total - a.total), atrasadas, porFormato, semanas, doPer, abertas, ritmo, segunda };
  }

  // Frase "X está com N atrasadas (cliente A, cliente B)".
  const quemAtrasa = (a, n = 3) => a.porPessoa.filter((p) => p.atrasadas && p.nome !== 'Sem responsável').slice(0, n);
  raiz.VybeRelPecas = Object.freeze({ analisar, situacao, dataDe, nomesDe, clientesDe, quemAtrasa, STATUS_TRAVA, chave });

  // ---------- O relatório da Produção ----------
  function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje;
    const pecas = ctx.dados.pecas(), equipe = ctx.dados.equipe();
    ctx.fonte('Peças da Produção (DADOS_ALL)', `${u.num(pecas.length)} peças carregadas no painel; data da peça = veiculação, sem ela o prazo`);
    ctx.fonte('Equipe (TEAM_USERS)', `${u.num(equipe.length)} pessoas para dar nome aos responsáveis`);
    const a = analisar({ pecas, per, hoje, equipe });
    const at = a.atual, an = a.anterior;
    const v = (x, y, m, o) => u.variacao(x, y, m, { contra: `vs ${a.contraRotulo}`, ...o });
    const pctEnt = u.pct(at.entregues, at.total);
    const atrasam = quemAtrasa(a);
    const trava = a.travas[0];
    const resumo = [];
    resumo.push(at.total ? `No período, a Produção tem ${u.plural(at.total, 'peça', 'peças')} com data do cliente: ${u.num(at.entregues)} prontas (${pctEnt ?? 0}%) e ${u.num(at.abertas)} em aberto.` : 'Nenhuma peça com data do cliente neste período.');
    if (at.atrasadas) resumo.push(`${u.plural(at.atrasadas, 'peça está atrasada', 'peças estão atrasadas')}${at.furos ? `, ${u.num(at.furos)} já com a veiculação vencida (furo)` : ''}${atrasam.length ? `; quem mais carrega atraso: ${atrasam.map((p) => `${p.nome} (${p.atrasadas})`).join(', ')}` : ''}.`);
    else if (at.total) resumo.push('Nenhuma peça do período está atrasada.');
    if (trava) resumo.push(`O maior gargalo é "${trava[0].toLowerCase()}": ${u.plural(trava[1], 'peça parada', 'peças paradas')} aí.`);
    if (a.ritmo?.projetado != null && at.total) resumo.push(`No ritmo de agora (${u.num(a.ritmo.porDia, 1)} prontas por dia), o período fecha com cerca de ${u.num(Math.min(a.ritmo.projetado, at.total))} de ${u.num(at.total)} prontas.`);
    else if (an.total) { const vv = v(at.entregues, an.entregues, 'maior'); if (vv) resumo.push(`Contra ${per.anterior.rotulo}, as prontas ${vv.direcao === 'sobe' ? 'subiram' : vv.direcao === 'desce' ? 'caíram' : 'ficaram iguais'} (${u.num(an.entregues)} → ${u.num(at.entregues)}).`); }

    const numeros = [
      { rotulo: 'Peças no período', valor: u.num(at.total), variacao: v(at.total, an.total, ''), porque: 'Peças de conteúdo com veiculação (ou prazo) dentro do período. É a carga que o cliente espera ver no ar.' },
      { rotulo: 'Prontas (Finalizado)', valor: `${u.num(at.entregues)}${pctEnt != null ? ` · ${pctEnt}%` : ''}`, variacao: v(at.entregues, an.entregues, 'maior'), porque: 'Só Finalizado conta como pronta (Paulo, 13/11): Para agendar e Agendado ainda esperam a postagem.' },
      { rotulo: 'Atrasadas agora', valor: u.num(at.atrasadas), variacao: v(at.atrasadas, an.atrasadas, 'menor'), porque: at.furos ? `${u.num(at.furos)} com a veiculação vencida: o cliente já sentiu.` : 'Atraso pelo prazo interno ou pela veiculação; pausadas e esquecidas ficam fora.' },
      { rotulo: 'Entregues no prazo', valor: at.noPrazoPct == null ? 'sem dado' : `${at.noPrazoPct}%`, variacao: at.noPrazoPct != null && an.noPrazoPct != null ? v(at.noPrazoPct, an.noPrazoPct, 'maior', { pontos: true }) : null, porque: at.julgadas ? `${u.num(at.noPrazo)} de ${u.num(at.julgadas)} prontas com o dia da entrega registrado saíram até a data do cliente.` : 'As prontas do período não têm o dia da entrega registrado.' },
      { rotulo: 'Em risco de furo', valor: u.num(at.emRisco), porque: 'Vão ao ar em até 2 dias sem andamento (regra da Gestão).' },
      { rotulo: 'Sem responsável', valor: u.num(at.semDono), porque: at.semDono ? 'Peça sem dono não entra na fila de ninguém: é a que mais fura.' : 'Todas as peças do período têm alguém responsável.' },
    ];
    const meses = a.hist.map((h) => u.nomeMes(h.mes));
    const secoes = [];
    secoes.push({ titulo: 'Entregas mês a mês',
      texto: [`Peças com data em cada mês e quantas ficaram prontas. ${u.tendenciaTexto(a.hist.map((h) => h.entregues), { coisa: 'Tendência das prontas' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: meses, series: [{ nome: 'Prontas', valores: a.hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: a.hist.map((h) => h.abertas), papel: 'aberto' }], empilhado: true },
      tabela: { colunas: ['Mês', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.noPrazoPct == null ? '—' : `${h.noPrazoPct}%`]) } });
    if (a.travas.length || a.porStatus.length) secoes.push({ titulo: 'Gargalos: onde as peças param',
      texto: [`Das ${u.num(a.abertas.length)} peças em aberto no período, esta é a distribuição pelo que as segura. Cada parada aqui é uma peça que não anda sem alguém agir.`],
      grafico: { tipo: 'rosca', de: 'status', fatias: a.porStatus.slice(0, 7).map(([s, n]) => ({ rotulo: s, valor: n })), centro: u.num(a.abertas.length), sub: 'em aberto' },
      tabela: { colunas: ['O que segura', 'Peças'], linhas: a.travas.slice(0, 8).map(([t, n]) => [t, u.num(n)]) } });
    const comAtraso = a.porPessoa.filter((p) => p.atrasadas);
    secoes.push({ titulo: 'Quem está atrasado e com o quê',
      texto: comAtraso.length ? [`${u.plural(comAtraso.length, 'pessoa tem', 'pessoas têm')} peça atrasada. A lista abaixo é a ordem para cobrar: a veiculação mais antiga primeiro.`] : ['Ninguém tem peça atrasada no período.'],
      grafico: comAtraso.length ? { tipo: 'ranking', de: 'pessoa', itens: comAtraso.slice(0, 10).map((p) => ({ rotulo: p.nome, valor: p.atrasadas, sub: `${p.abertas} em aberto`, tom: 'ruim' })) } : null,
      tabela: a.atrasadas.length ? { colunas: ['Data', 'Peça', { rotulo: 'Cliente', cliente: true }, { rotulo: 'Com quem', pessoa: true }, { rotulo: 'Status', status: true }, 'Dias'], linhas: a.atrasadas.slice(0, 20).map((x) => [u.dataCurta(x.data), String(x.d.nome || '').slice(0, 48), x.clientes.join(', ').slice(0, 28), x.pessoas.join(', ').slice(0, 26), String(x.d.status || ''), u.num(u.diasEntre(x.data, hoje))]), nota: a.atrasadas.length > 20 ? `Mais ${a.atrasadas.length - 20} atrasadas fora da lista.` : '' } : null });
    if (a.porPessoa.length) secoes.push({ titulo: 'Carga por pessoa',
      texto: ['Peças de cada pessoa no período: o que já saiu, o que está aberto e o atrasado. Peça de duas pessoas conta para as duas.'],
      grafico: { tipo: 'barras', rotulos: a.porPessoa.slice(0, 10).map((p) => p.nome.split(' ')[0]), series: [{ nome: 'Prontas', valores: a.porPessoa.slice(0, 10).map((p) => p.entregues), papel: 'pronto' }, { nome: 'Abertas', valores: a.porPessoa.slice(0, 10).map((p) => p.abertas), papel: 'aberto' }, { nome: 'Atrasadas', valores: a.porPessoa.slice(0, 10).map((p) => p.atrasadas), papel: 'atraso' }] },
      tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Peças', 'Prontas', 'Abertas', 'Atrasadas'], linhas: a.porPessoa.slice(0, 15).map((p) => [p.nome, u.num(p.total), u.num(p.entregues), u.num(p.abertas), u.num(p.atrasadas)]) } });
    // Heatmap: pessoa × semana (peças com data na semana).
    if (a.semanas.length >= 2 && a.porPessoa.length) {
      const top = a.porPessoa.filter((p) => p.nome !== 'Sem responsável').sort((x, y) => y.total - x.total).slice(0, 10);
      secoes.push({ titulo: 'Carga semana a semana',
        texto: ['Quantas peças cada pessoa tem com data em cada semana do período. Célula escura = semana pesada; o número vale também no papel em preto e branco.'],
        grafico: { tipo: 'heatmap', linhasDe: 'pessoa', linhas: top.map((p) => p.nome), colunas: a.semanas.map((s) => u.dataCurta(s)), valores: top.map((p) => a.semanas.map((s) => a.doPer.filter((x) => x.pessoas.includes(p.nome) && a.segunda(x.data) === s).length)) } });
    }
    if (a.porFormato.length) secoes.push({ titulo: 'Formatos',
      texto: [`O que a Produção mais entrega no período: ${a.porFormato.slice(0, 3).map(([f, n]) => `${f} (${n})`).join(', ')}.`],
      grafico: { tipo: 'ranking', itens: a.porFormato.slice(0, 8).map(([f, n]) => ({ rotulo: f, valor: n })) } });
    if (a.porCliente.length) secoes.push({ titulo: 'Clientes com mais atraso',
      texto: [a.porCliente[0].atrasadas ? `${a.porCliente[0].nome} é o cliente com mais peças atrasadas (${a.porCliente[0].atrasadas}).` : 'Nenhum cliente com peça atrasada no período.'],
      tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Peças', 'Prontas', 'Atrasadas'], linhas: a.porCliente.slice(0, 12).map((c) => [c.nome, u.num(c.total), u.num(c.entregues), u.num(c.atrasadas)]) } });

    const prox = u.projetar(a.hist.map((h) => h.total), 3), mesesProx = [1, 2, 3].map((k) => u.somarMeses(per.fim.slice(0, 7), k));
    const projecao = {
      texto: [a.ritmo?.projetado != null ? `Ritmo do período em curso: ${u.num(a.ritmo.porDia, 1)} prontas por dia em ${u.num(a.ritmo.passados)} dias; faltam ${u.num(a.ritmo.restam)} dias. Fecha com cerca de ${u.num(Math.min(a.ritmo.projetado, at.total))} de ${u.num(at.total)} (${u.pct(Math.min(a.ritmo.projetado, at.total), at.total) ?? 0}%). Para fechar tudo, precisa de ${u.num(Math.max(0, at.total - at.entregues) / Math.max(1, a.ritmo.restam), 1)} prontas por dia.` : 'O período já fechou: a projeção abaixo é a dos próximos meses pela tendência.',
        `Volume esperado pela tendência dos últimos meses: ${mesesProx.map((m, i) => `${u.nomeMes(m)} ≈ ${u.num(prox[i])} peças`).join(', ')} (reta pelos meses do histórico; serve de ordem de grandeza, não de meta).`],
      grafico: { tipo: 'linha', rotulos: [...meses, ...mesesProx.map((m) => u.nomeMes(m))], series: [{ nome: 'Peças com data', valores: [...a.hist.map((h) => h.total), null, null, null] }, { nome: 'Tendência', valores: [...a.hist.map(() => null).slice(0, -1), a.hist[a.hist.length - 1]?.total ?? null, ...prox], tracejada: true }] },
    };
    const historico = {
      texto: [`Prontas e atrasadas nos últimos ${a.hist.length} meses. ${u.tendenciaTexto(a.hist.map((h) => h.atrasadas), { melhor: 'menor', coisa: 'Tendência do atraso' }).texto}.`],
      grafico: { tipo: 'linha', rotulos: meses, series: [{ nome: 'Prontas', valores: a.hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Atrasadas', valores: a.hist.map((h) => h.atrasadas), papel: 'atraso' }] },
    };
    const recomendacoes = [];
    if (at.atrasadas) recomendacoes.push({ o_que: `Destravar as ${u.num(at.atrasadas)} atrasadas, começando por ${atrasam[0] ? `${atrasam[0].nome} (${atrasam[0].atrasadas})` : 'as de veiculação mais antiga'}.`, por_que: at.furos ? `${u.num(at.furos)} já passaram da veiculação: o cliente vê o buraco no feed.` : 'Atraso no prazo interno vira furo de veiculação em poucos dias.', impacto: `Até ${u.num(at.atrasadas)} peças a menos em atraso; a nota de saúde dos clientes afetados sobe (cada furo tira 10 pontos).`, prioridade: 'alta' });
    if (trava && trava[1] >= 3) {
      const t = trava[0];
      const acao = /cliente/i.test(t) ? 'Cobrar do cliente o que falta, num lote só, pelo head da conta.' : /alteração/i.test(t) ? 'Revisar com a Direção de arte o porquê das alterações e fechar o ajuste numa rodada.' : /direção/i.test(t) ? 'Pedir ao Deivid e ao Danilo a direção das peças paradas antes de distribuir mais.' : /captação/i.test(t) ? 'Marcar as captações pendentes na agenda desta semana.' : `Atacar as peças em "${t.toLowerCase()}".`;
      recomendacoes.push({ o_que: acao, por_que: `"${t}" segura ${u.plural(trava[1], 'peça', 'peças')}: é o maior gargalo do período.`, impacto: `Libera ${u.num(trava[1])} peças para andar.`, prioridade: trava[1] >= 8 ? 'alta' : 'media' });
    }
    const totAbertas = a.porPessoa.reduce((t, p) => t + p.abertas, 0), maior = a.porPessoa.filter((p) => p.nome !== 'Sem responsável').sort((x, y) => y.abertas - x.abertas)[0];
    if (maior && totAbertas >= 8 && maior.abertas / totAbertas > 0.35) recomendacoes.push({ o_que: `Redistribuir parte da fila de ${maior.nome}.`, por_que: `${maior.nome} tem ${u.num(maior.abertas)} das ${u.num(totAbertas)} peças abertas (${u.pct(maior.abertas, totAbertas)}%): uma pessoa só segura a entrega do time.`, impacto: 'Menos risco de furo concentrado e entrega mais estável.', prioridade: 'media' });
    if (at.semDono) recomendacoes.push({ o_que: `Dar responsável às ${u.num(at.semDono)} peças sem dono.`, por_que: 'Peça sem responsável não entra na fila de ninguém.', impacto: `${u.num(at.semDono)} peças voltam a ser acompanhadas.`, prioridade: at.semDono >= 5 ? 'alta' : 'media' });
    if (a.ritmo?.projetado != null && at.total && a.ritmo.projetado < at.total * 0.9) recomendacoes.push({ o_que: `Subir o ritmo para ${u.num(Math.max(0, at.total - at.entregues) / Math.max(1, a.ritmo.restam), 1)} prontas por dia até o fim do período.`, por_que: `No passo atual fecham cerca de ${u.num(a.ritmo.projetado)} de ${u.num(at.total)}.`, impacto: `Evita até ${u.num(at.total - a.ritmo.projetado)} peças viradas para o período seguinte.`, prioridade: 'alta' });
    if (at.noPrazoPct != null && at.noPrazoPct < 85) recomendacoes.push({ o_que: 'Antecipar o prazo interno das peças da próxima semana.', por_que: `Só ${at.noPrazoPct}% das prontas saíram até a data do cliente.`, impacto: 'Mais peças no ar no dia certo; menos retrabalho de reagendar.', prioridade: 'media' });
    if (at.emRisco) recomendacoes.push({ o_que: `Olhar hoje as ${u.num(at.emRisco)} peças em risco de furo.`, por_que: 'Vão ao ar em até 2 dias e não andaram.', impacto: 'Furo evitado antes de acontecer.', prioridade: 'alta' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter o ritmo e adiantar as peças da próxima quinzena.', por_que: 'Sem atraso nem gargalo relevante no período.', impacto: 'Folga para imprevistos e captações.', prioridade: 'baixa' });

    // amostra: as peças do período, para a cor de cada status ser a do quadro (vybe-relatorio.js, corDoStatus).
    return { titulo: 'Produção · Visão geral', subtitulo: 'Entregas, prazos, gargalos e carga do time', amostra: a.doPer.map((x) => x.d), resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Data da peça = veiculação (o dia em que o cliente publica); sem ela, o prazo interno. Uma peça entra no período pela data dela.',
        'Situação de cada peça pela função oficial da Gestão (VybeDono.util.situacaoDaPeca): pronta só com Finalizado; Para agendar e Agendado esperam a postagem; Segurar Post pausa; peça vencida há mais de 30 dias conta como esquecida e sai do atraso.',
        'No prazo = pronta até a data do cliente, pelo dia da última troca de status. Comparação com o período anterior de mesmo tamanho. Projeção = reta pelos meses do histórico e ritmo diário do período em curso.'] };
  }

  const registrar = () => raiz.VybeRelatorio?.registrar?.('producao', relatorio, { nome: 'Produção', telas: ['setor:producao', 'gestor', 'projetos'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' } });
  if (raiz.VybeRelatorio?.registrar) registrar();
  raiz.VybeRelProducao = Object.freeze({ relatorio, registrar });
})(typeof window !== 'undefined' ? window : globalThis);
