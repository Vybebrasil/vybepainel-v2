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

  // ---------- As vistas do Painel de trabalho (Semana, Mês, Feed, Grupos, Equipe), uma por relatório ----------
  // Paulo, 27/11/2026: o relatório de cada subaba. As cinco vistas de #pv2-vistas (vybe-gestor.js): a aberta é a de
  // aria-checked="true" (ou body[data-pv2-vista]). Cada uma lê as mesmas peças da tela, pelo ângulo da vista.
  const LIMITE_DIA = 5; // o limite de peças por pessoa no dia (PV2_LIMITE_DIA, o mesmo da Coordenação)
  const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  function pecasMarcadas(ctx) {
    const u = ctx.util, hoje = ctx.hoje, equipe = ctx.dados.equipe(), pecas = ctx.dados.pecas();
    const porId = new Map(lista(equipe).map((p) => [String(p.id), String(p.name || p.nome || '').trim()]).filter(([, n]) => n));
    const segunda = (iso) => u.somarDias(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));
    const todas = lista(pecas).filter((d) => d && dataDe(d)).map((d) => ({ d, s: situacao(d, hoje), data: dataDe(d), pessoas: nomesDe(d, porId), clientes: clientesDe(d), entregueEm: u.soDia(d.status_updated_at), status: String(d.status || 'Sem status') }));
    const conta = (l) => { const ent = l.filter((x) => x.s.entregue), julg = ent.filter((x) => x.entregueEm); const noPrazo = julg.filter((x) => x.entregueEm <= x.data).length;
      return { total: l.length, entregues: ent.length, abertas: l.filter((x) => !x.s.entregue && !['pausada', 'esquecida'].includes(x.s.situacao)).length, atrasadas: l.filter((x) => x.s.atrasada).length, emRisco: l.filter((x) => x.s.emRisco).length, noPrazoPct: u.pct(noPrazo, julg.length), julgadas: julg.length }; };
    return { todas, conta, segunda, pecas, equipe };
  }
  const fechaAba = (aba, rel, amostra) => ({ aba, amostra, ...rel, resumo: lista(rel.resumo).filter(Boolean).slice(0, 5),
    recomendacoes: lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Manter o passo e olhar esta vista de novo amanhã.', por_que: 'Nada fora do normal nos números desta vista.', impacto: 'Entrega em dia.', prioridade: 'baixa' }] });

  function abaSemana(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, M = pecasMarcadas(ctx);
    const ini = M.segunda(per.emCurso ? hoje : per.fim), fim = u.somarDias(ini, 6), dias = Array.from({ length: 7 }, (_, i) => u.somarDias(ini, i));
    const daSemana = M.todas.filter((x) => x.data >= ini && x.data <= fim), c = M.conta(daSemana);
    const deAntes = M.todas.filter((x) => x.data < ini && x.s.atrasada);
    const porDia = dias.map((dia) => M.conta(daSemana.filter((x) => x.data === dia)));
    const gente = [...new Set(daSemana.flatMap((x) => x.pessoas))].filter((n) => n !== 'Sem responsável');
    const carga = gente.map((n) => ({ nome: n, dias: dias.map((dia) => daSemana.filter((x) => x.data === dia && x.pessoas.includes(n) && !x.s.entregue).length), total: daSemana.filter((x) => x.pessoas.includes(n)).length })).sort((a, b) => b.total - a.total);
    const estouros = carga.flatMap((p) => p.dias.map((n, i) => ({ nome: p.nome, dia: dias[i], n })).filter((x) => x.n > LIMITE_DIA));
    const semanas = Array.from({ length: 8 }, (_, k) => u.somarDias(ini, -7 * (7 - k)));
    const hist = semanas.map((s) => ({ s, ...M.conta(M.todas.filter((x) => x.data >= s && x.data <= u.somarDias(s, 6))) }));
    const prox = M.conta(M.todas.filter((x) => x.data > fim && x.data <= u.somarDias(fim, 7)));
    const pior = porDia.map((x, i) => ({ ...x, dia: dias[i] })).sort((a, b) => b.abertas - a.abertas)[0];
    const restam = dias.filter((d) => d >= hoje).length, faltam = Math.max(0, c.total - c.entregues);
    const resumo = [
      c.total ? `A semana de ${u.dataCurta(ini)} a ${u.dataCurta(fim)} tem ${u.plural(c.total, 'peça', 'peças')} com data: ${u.num(c.entregues)} prontas, ${u.num(c.abertas)} em aberto e ${u.num(c.atrasadas)} atrasadas.` : `A semana de ${u.dataCurta(ini)} a ${u.dataCurta(fim)} não tem peça com data.`,
      pior?.abertas ? `O dia mais carregado é ${SEMANA[dias.indexOf(pior.dia)]} ${u.dataCurta(pior.dia)}, com ${u.num(pior.abertas)} em aberto.` : '',
      estouros.length ? `${u.plural(new Set(estouros.map((x) => x.nome)).size, 'pessoa passa', 'pessoas passam')} do limite de ${LIMITE_DIA} peças no dia: ${estouros.slice(0, 3).map((x) => `${x.nome} (${x.n} em ${u.dataCurta(x.dia)})`).join(', ')}.` : `Ninguém passa de ${LIMITE_DIA} peças em aberto num dia.`,
      deAntes.length ? `Chegam de semanas anteriores ${u.plural(deAntes.length, 'peça atrasada', 'peças atrasadas')}, que disputam o mesmo tempo.` : 'Nada atrasado das semanas anteriores.',
      `A próxima semana já tem ${u.plural(prox.total, 'peça marcada', 'peças marcadas')}.`,
    ];
    const numeros = [
      { rotulo: 'Peças da semana', valor: u.num(c.total), variacao: u.variacao(c.total, hist[6]?.total, '', { contra: 'vs semana anterior' }), porque: 'Peças com veiculação (ou prazo) entre segunda e domingo.' },
      { rotulo: 'Prontas', valor: `${u.num(c.entregues)}${c.total ? ` · ${u.pct(c.entregues, c.total)}%` : ''}`, variacao: u.variacao(c.entregues, hist[6]?.entregues, 'maior', { contra: 'vs semana anterior' }), porque: 'Só Finalizado conta como pronta.' },
      { rotulo: 'Atrasadas na semana', valor: u.num(c.atrasadas), porque: 'Da semana, já com a data vencida.' },
      { rotulo: 'Vindas de antes', valor: u.num(deAntes.length), porque: 'Atrasadas de semanas anteriores, ainda abertas.' },
      { rotulo: `Dias acima de ${LIMITE_DIA}`, valor: u.num(estouros.length), porque: `Pessoa × dia com mais de ${LIMITE_DIA} peças em aberto (o limite da Coordenação).` },
      { rotulo: 'Em risco de furo', valor: u.num(c.emRisco), porque: 'Vão ao ar em até 2 dias sem andamento.' },
    ];
    const secoes = [
      { titulo: 'Dia a dia da semana', texto: ['Quantas peças vão ao ar em cada dia e quantas já estão prontas.'],
        grafico: { tipo: 'barras', rotulos: dias.map((d, i) => `${SEMANA[i]} ${u.dataCurta(d)}`), series: [{ nome: 'Prontas', valores: porDia.map((x) => x.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: porDia.map((x) => x.abertas), papel: 'aberto' }, { nome: 'Atrasadas', valores: porDia.map((x) => x.atrasadas), papel: 'atraso' }], empilhado: true },
        tabela: { colunas: ['Dia', 'Peças', 'Prontas', 'Em aberto', 'Atrasadas'], linhas: dias.map((d, i) => [`${SEMANA[i]} ${u.dataCurta(d)}`, u.num(porDia[i].total), u.num(porDia[i].entregues), u.num(porDia[i].abertas), u.num(porDia[i].atrasadas)]) } },
      carga.length ? { titulo: 'Pessoa × dia (em aberto)', texto: [`As peças em aberto de cada pessoa em cada dia. Acima de ${LIMITE_DIA} é o dia que não fecha.`],
        grafico: { tipo: 'heatmap', linhasDe: 'pessoa', linhas: carga.slice(0, 10).map((p) => p.nome), colunas: dias.map((d, i) => SEMANA[i]), valores: carga.slice(0, 10).map((p) => p.dias) } } : null,
      { titulo: 'O que falta sair esta semana', texto: [faltam ? `${u.num(faltam)} peça(s) ainda não estão prontas, na ordem da data.` : 'Tudo da semana está pronto.'],
        tabela: faltam ? { colunas: ['Dia', 'Peça', { rotulo: 'Cliente', cliente: true }, { rotulo: 'Com quem', pessoa: true }, { rotulo: 'Status', status: true }], linhas: daSemana.filter((x) => !x.s.entregue).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 25).map((x) => [u.dataCurta(x.data), String(x.d.nome || '').slice(0, 44), x.clientes.join(', ').slice(0, 26), x.pessoas.join(', ').slice(0, 24), x.status]) } : null },
      deAntes.length ? { titulo: 'Atrasadas que chegam de antes', texto: ['Peças de semanas anteriores ainda abertas: entram na fila desta semana.'],
        tabela: { colunas: ['Data', 'Peça', { rotulo: 'Cliente', cliente: true }, { rotulo: 'Com quem', pessoa: true }, 'Dias'], linhas: deAntes.sort((a, b) => a.data.localeCompare(b.data)).slice(0, 15).map((x) => [u.dataCurta(x.data), String(x.d.nome || '').slice(0, 44), x.clientes.join(', ').slice(0, 26), x.pessoas.join(', ').slice(0, 24), u.num(u.diasEntre(x.data, hoje))]) } } : null,
    ];
    const historico = { texto: [`As últimas 8 semanas. ${u.tendenciaTexto(hist.map((h) => h.entregues), { coisa: 'Prontas por semana' }).texto.replace('por mês', 'por semana')}.`],
      grafico: { tipo: 'linha', rotulos: hist.map((h) => u.dataCurta(h.s)), series: [{ nome: 'Peças', valores: hist.map((h) => h.total), papel: 'neutro' }, { nome: 'Prontas', valores: hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Atrasadas', valores: hist.map((h) => h.atrasadas), papel: 'atraso' }] },
      tabela: { colunas: ['Semana de', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: hist.map((h) => [u.dataCurta(h.s), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.noPrazoPct == null ? '—' : `${h.noPrazoPct}%`]) } };
    const projecao = { texto: [restam && faltam ? `Faltam ${u.num(faltam)} peças em ${u.plural(restam, 'dia', 'dias')}: ${u.num(faltam / restam, 1)} prontas por dia para fechar a semana.` : 'A semana já passou ou está toda pronta.', `Semana que vem: ${u.plural(prox.total, 'peça', 'peças')} com data (${u.num(prox.entregues)} já prontas).`] };
    const recomendacoes = [];
    if (estouros.length) { const p = estouros.sort((a, b) => b.n - a.n)[0]; recomendacoes.push({ o_que: `Tirar peças de ${p.nome} em ${u.dataCurta(p.dia)}.`, por_que: `${p.n} peças em aberto no dia, acima do limite de ${LIMITE_DIA}.`, impacto: 'Dia que fecha sem furo.', prioridade: 'alta' }); }
    if (deAntes.length) recomendacoes.push({ o_que: `Fechar primeiro as ${u.num(deAntes.length)} atrasadas que vêm de antes.`, por_que: 'Cada dia a mais é um dia de buraco no feed do cliente.', impacto: `${u.num(deAntes.length)} peças no ar.`, prioridade: 'alta' });
    if (c.emRisco) recomendacoes.push({ o_que: `Olhar hoje as ${u.num(c.emRisco)} peças em risco.`, por_que: 'Vão ao ar em até 2 dias sem andamento.', impacto: 'Furo evitado.', prioridade: 'alta' });
    if (pior?.abertas >= 6) recomendacoes.push({ o_que: `Adiantar peças de ${SEMANA[dias.indexOf(pior.dia)]} ${u.dataCurta(pior.dia)} para os dias mais leves.`, por_que: `${u.num(pior.abertas)} em aberto num dia só.`, impacto: 'Semana mais lisa.', prioridade: 'media' });
    return fechaAba('semana', { titulo: `Produção · Semana · ${u.dataCurta(ini)} a ${u.dataCurta(fim)}`, subtitulo: 'O dia a dia da semana, a carga de cada pessoa e o que falta sair', periodo: `Semana de ${u.dataBr(ini)} a ${u.dataBr(fim)}`, resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Semana de segunda a domingo: a de hoje quando o período está em curso; senão, a última do período. Data da peça = veiculação; sem ela, o prazo. Limite de 5 peças por pessoa no dia (o da Coordenação).'] }, daSemana.map((x) => x.d));
  }

  function abaMes(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, M = pecasMarcadas(ctx);
    const ym = per.fim.slice(0, 7), ini = `${ym}-01`, fim = u.fimDoMes(ym);
    const doMes = M.todas.filter((x) => x.data >= ini && x.data <= fim), c = M.conta(doMes);
    const semanas = []; for (let s = M.segunda(ini); s <= fim; s = u.somarDias(s, 7)) semanas.push(s);
    const grade = semanas.map((s) => Array.from({ length: 7 }, (_, i) => { const d = u.somarDias(s, i); return d < ini || d > fim ? null : doMes.filter((x) => x.data === d).length; }));
    const porSemana = semanas.map((s) => M.conta(doMes.filter((x) => x.data >= s && x.data <= u.somarDias(s, 6))));
    const porCli = u.contarPor(doMes, (x) => x.clientes), porForm = u.contarPor(doMes, (x) => String(x.d.formato || '').trim() || 'Sem formato');
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(ym, k - 5)), hist = mesesH.map((m) => ({ m, ...M.conta(M.todas.filter((x) => x.data.slice(0, 7) === m)) }));
    const ritmo = hoje >= ini && hoje <= fim ? u.ritmo({ feito: c.entregues, inicio: ini, fim, hoje }) : null;
    const prox = M.conta(M.todas.filter((x) => x.data.slice(0, 7) === u.somarMeses(ym, 1)));
    const semData = M.pecas.filter((d) => d && !dataDe(d) && !situacao(d, hoje).entregue).length;
    const pico = porSemana.map((x, i) => ({ ...x, s: semanas[i] })).sort((a, b) => b.total - a.total)[0];
    const resumo = [
      `${u.nomeMes(ym, true).replace(/^./, (x) => x.toUpperCase())} tem ${u.plural(c.total, 'peça', 'peças')} com data: ${u.num(c.entregues)} prontas (${u.pct(c.entregues, c.total) ?? 0}%), ${u.num(c.abertas)} em aberto e ${u.num(c.atrasadas)} atrasadas.`,
      pico?.total ? `A semana mais cheia começa em ${u.dataCurta(pico.s)}, com ${u.num(pico.total)} peças.` : '',
      porCli[0] ? `Quem mais tem peça no mês: ${porCli.slice(0, 3).map(([n, k]) => `${n} (${k})`).join(', ')}.` : '',
      ritmo?.projetado != null ? `No ritmo de agora (${u.num(ritmo.porDia, 1)} prontas por dia) o mês fecha com cerca de ${u.num(Math.min(ritmo.projetado, c.total))} de ${u.num(c.total)} prontas.` : '',
      `O mês seguinte já tem ${u.plural(prox.total, 'peça marcada', 'peças marcadas')}${semData ? `; ${u.plural(semData, 'peça aberta está', 'peças abertas estão')} sem data nenhuma` : ''}.`,
    ];
    const numeros = [
      { rotulo: 'Peças do mês', valor: u.num(c.total), variacao: u.variacao(c.total, hist[4]?.total, '', { contra: 'vs mês anterior' }), porque: 'Peças com data dentro do mês.' },
      { rotulo: 'Prontas', valor: `${u.num(c.entregues)} · ${u.pct(c.entregues, c.total) ?? 0}%`, variacao: u.variacao(c.entregues, hist[4]?.entregues, 'maior', { contra: 'vs mês anterior' }), porque: 'Só Finalizado.' },
      { rotulo: 'Atrasadas', valor: u.num(c.atrasadas), porque: 'Do mês, com a data vencida.' },
      { rotulo: 'No prazo', valor: c.noPrazoPct == null ? 'sem dado' : `${c.noPrazoPct}%`, porque: 'Prontas até a data do cliente.' },
      { rotulo: 'Mês seguinte', valor: u.num(prox.total), porque: 'Peças já com data no mês que vem.' },
      { rotulo: 'Sem data', valor: u.num(semData), porque: 'Abertas sem veiculação nem prazo: não aparecem no calendário.' },
    ];
    const secoes = [
      { titulo: 'O calendário do mês', texto: ['Peças com data em cada dia, semana por semana (o número vale no papel em preto e branco).'],
        grafico: { tipo: 'heatmap', linhas: semanas.map((s) => `sem. ${u.dataCurta(s)}`), colunas: SEMANA, valores: grade } },
      { titulo: 'Semana a semana', texto: ['O que cada semana do mês tem e quanto já saiu.'],
        grafico: { tipo: 'barras', rotulos: semanas.map((s) => u.dataCurta(s)), series: [{ nome: 'Prontas', valores: porSemana.map((x) => x.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: porSemana.map((x) => x.abertas), papel: 'aberto' }], empilhado: true },
        tabela: { colunas: ['Semana de', 'Peças', 'Prontas', 'Atrasadas', 'Em risco'], linhas: porSemana.map((x, i) => [u.dataCurta(semanas[i]), u.num(x.total), u.num(x.entregues), u.num(x.atrasadas), u.num(x.emRisco)]) } },
      porCli.length ? { titulo: 'Clientes no mês', texto: ['Quantas peças cada cliente tem no mês.'], grafico: { tipo: 'ranking', de: 'cliente', itens: porCli.slice(0, 12).map(([n, k]) => ({ rotulo: n, valor: k })) } } : null,
      porForm.length ? { titulo: 'Formatos do mês', texto: [`${porForm.slice(0, 3).map(([f, k]) => `${f} (${k})`).join(', ')}.`], grafico: { tipo: 'rosca', fatias: porForm.slice(0, 7).map(([f, k], i) => ({ rotulo: f, valor: k, papel: ['destaque', 'neutro', 'neutro2', 'info', 'agente', 'ajuste', 'risco'][i] })), centro: u.num(c.total), sub: 'peças' } } : null,
    ];
    const historico = { texto: [`Os últimos 6 meses. ${u.tendenciaTexto(hist.map((h) => h.total), { coisa: 'Volume', melhor: '' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: hist.map((h) => u.nomeMes(h.m)), series: [{ nome: 'Prontas', valores: hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: hist.map((h) => h.abertas), papel: 'aberto' }], empilhado: true },
      tabela: { colunas: ['Mês', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: hist.map((h) => [u.nomeMes(h.m, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.noPrazoPct == null ? '—' : `${h.noPrazoPct}%`]) } };
    const tend = u.projetar(hist.map((h) => h.total), 2);
    const projecao = { texto: [ritmo?.projetado != null ? `Faltam ${u.num(ritmo.restam)} dias: para fechar o mês, ${u.num(Math.max(0, c.total - c.entregues) / Math.max(1, ritmo.restam), 1)} prontas por dia.` : 'O mês já fechou.', `Pela tendência dos 6 meses, os próximos dois ficam perto de ${tend.map((n) => u.num(n)).join(' e ')} peças.`] };
    const recomendacoes = [];
    if (ritmo?.projetado != null && ritmo.projetado < c.total * 0.9) recomendacoes.push({ o_que: `Subir para ${u.num(Math.max(0, c.total - c.entregues) / Math.max(1, ritmo.restam), 1)} prontas por dia até o fim do mês.`, por_que: `No passo de agora fecham cerca de ${u.num(ritmo.projetado)} de ${u.num(c.total)}.`, impacto: `Até ${u.num(c.total - ritmo.projetado)} peças a menos atrasadas.`, prioridade: 'alta' });
    if (semData) recomendacoes.push({ o_que: `Dar data às ${u.num(semData)} peças abertas sem data.`, por_que: 'Sem data a peça não entra no calendário nem na fila do dia.', impacto: 'Mês com a carga real.', prioridade: 'media' });
    if (pico?.total && porSemana.length > 1 && pico.total > (c.total / porSemana.length) * 1.5) recomendacoes.push({ o_que: `Espalhar a semana de ${u.dataCurta(pico.s)}.`, por_que: `${u.num(pico.total)} peças, bem acima da média de ${u.num(c.total / porSemana.length, 1)} por semana.`, impacto: 'Carga mais lisa no mês.', prioridade: 'media' });
    if (c.atrasadas) recomendacoes.push({ o_que: `Fechar as ${u.num(c.atrasadas)} atrasadas do mês.`, por_que: 'Atraso no prazo vira furo de veiculação.', impacto: `${u.num(c.atrasadas)} peças no ar.`, prioridade: 'alta' });
    return fechaAba('mes', { titulo: `Produção · Mês · ${u.nomeMes(ym, true)}`, subtitulo: 'O calendário do mês, semana a semana, clientes e formatos', periodo: u.nomeMes(ym, true).replace(/^./, (x) => x.toUpperCase()), resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Mês = o do fim do período escolhido. Data da peça = veiculação; sem ela, o prazo. Ritmo = prontas por dia desde o dia 1.'] }, doMes.map((x) => x.d));
  }

  function abaFeed(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, M = pecasMarcadas(ctx);
    const noPer = M.todas.filter((x) => u.dentro(x.data, per)), proxSem = M.todas.filter((x) => x.data > hoje && x.data <= u.somarDias(hoje, 7));
    const ativos = ctx.dados.clientes().filter((c) => c && c.nome && c.ativo !== false && !c.nao_e_cliente).map((c) => String(c.nome).trim());
    const nomes = [...new Set([...ativos, ...noPer.flatMap((x) => x.clientes)])];
    const cli = nomes.map((n) => {
      const l = noPer.filter((x) => x.clientes.includes(n)), datas = [...new Set(l.map((x) => x.data))].sort();
      let maiorBuraco = 0; for (let i = 1; i < datas.length; i++) maiorBuraco = Math.max(maiorBuraco, u.diasEntre(datas[i - 1], datas[i]));
      const formatos = u.contarPor(l, (x) => String(x.d.formato || '').trim() || 'Sem formato');
      return { nome: n, total: l.length, prontas: l.filter((x) => x.s.entregue).length, atrasadas: l.filter((x) => x.s.atrasada).length, maiorBuraco, formatos, proxima: proxSem.filter((x) => x.clientes.includes(n)).length };
    }).sort((a, b) => b.total - a.total);
    const comPeca = cli.filter((c) => c.total), semNada = cli.filter((c) => !c.total && ativos.includes(c.nome)), semProxima = comPeca.filter((c) => !c.proxima);
    const buracos = comPeca.filter((c) => c.maiorBuraco >= 7).sort((a, b) => b.maiorBuraco - a.maiorBuraco);
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 5));
    const topo = comPeca.slice(0, 10);
    const resumo = [
      `No período, ${u.plural(comPeca.length, 'cliente tem', 'clientes têm')} peça no feed, ${u.plural(noPer.length, 'peça', 'peças')} ao todo; ${u.num(noPer.filter((x) => x.s.entregue).length)} já prontas.`,
      semNada.length ? `${u.plural(semNada.length, 'cliente ativo está', 'clientes ativos estão')} sem nenhuma peça no período: ${semNada.slice(0, 4).map((c) => c.nome).join(', ')}.` : 'Todo cliente ativo tem peça no período.',
      buracos.length ? `Buracos de uma semana ou mais entre um post e outro: ${buracos.slice(0, 3).map((c) => `${c.nome} (${c.maiorBuraco} dias)`).join(', ')}.` : 'Nenhum cliente fica uma semana sem post entre as peças do período.',
      semProxima.length ? `${u.plural(semProxima.length, 'cliente não tem', 'clientes não têm')} peça marcada nos próximos 7 dias.` : 'Todos os clientes do feed têm peça nos próximos 7 dias.',
    ];
    const numeros = [
      { rotulo: 'Clientes com peça', valor: `${u.num(comPeca.length)}${ativos.length ? ` de ${u.num(ativos.length)}` : ''}`, porque: 'Clientes com pelo menos uma peça com data no período.' },
      { rotulo: 'Peças no feed', valor: u.num(noPer.length), porque: 'Peças com data do cliente no período.' },
      { rotulo: 'Sem peça no período', valor: u.num(semNada.length), porque: 'Cliente ativo sem nada no feed.' },
      { rotulo: 'Buraco de 7+ dias', valor: u.num(buracos.length), porque: 'Clientes com uma semana ou mais entre dois posts.' },
      { rotulo: 'Sem peça em 7 dias', valor: u.num(semProxima.length), porque: 'Clientes do feed sem nada marcado na próxima semana.' },
      { rotulo: 'Média por cliente', valor: comPeca.length ? u.num(noPer.length / comPeca.length, 1) : '—', porque: 'Peças por cliente com peça no período.' },
    ];
    const secoes = [
      { titulo: 'O feed de cada cliente', texto: ['Peças no período, prontas, atrasadas, o maior intervalo entre posts e o que já está marcado para a próxima semana.'],
        grafico: comPeca.length ? { tipo: 'ranking', de: 'cliente', itens: comPeca.slice(0, 12).map((c) => ({ rotulo: c.nome, valor: c.total, sub: `${c.prontas} prontas` })) } : null,
        tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Peças', 'Prontas', 'Atrasadas', 'Maior buraco', 'Próx. 7 dias'], linhas: cli.filter((c) => c.total || ativos.includes(c.nome)).map((c) => [c.nome, u.num(c.total), u.num(c.prontas), u.num(c.atrasadas), c.total > 1 ? `${c.maiorBuraco} d` : '—', u.num(c.proxima)]) } },
      topo.length ? { titulo: 'Formatos por cliente', texto: ['O formato que mais aparece no feed de cada cliente: feed só de um formato cansa o público.'],
        tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Principal', 'Formatos', 'Peso do principal'], linhas: topo.map((c) => [c.nome, c.formatos[0]?.[0] || '—', u.num(c.formatos.length), c.formatos[0] ? `${u.pct(c.formatos[0][1], c.total)}%` : '—']) } } : null,
      semNada.length || semProxima.length ? { titulo: 'Feed vazio à vista', texto: ['Quem está sem peça no período ou sem nada marcado para a próxima semana.'],
        lista: [...semNada.map((c) => `${c.nome}: nenhuma peça no período`), ...semProxima.map((c) => `${c.nome}: nada nos próximos 7 dias`)].slice(0, 16) } : null,
    ];
    const historico = { texto: ['Peças de cada cliente mês a mês (os 10 com mais peças no período).'],
      grafico: topo.length ? { tipo: 'heatmap', linhasDe: 'cliente', linhas: topo.map((c) => c.nome), colunas: mesesH.map((m) => u.nomeMes(m)), valores: topo.map((c) => mesesH.map((m) => M.todas.filter((x) => x.clientes.includes(c.nome) && x.data.slice(0, 7) === m).length)) } : null };
    const recomendacoes = [];
    if (semProxima.length) recomendacoes.push({ o_que: `Marcar peça para ${semProxima.slice(0, 4).map((c) => c.nome).join(', ')} na próxima semana.`, por_que: 'Sem nada marcado, o feed do cliente para.', impacto: 'Feed sem buraco.', prioridade: 'alta' });
    if (semNada.length) recomendacoes.push({ o_que: `Planejar o conteúdo de ${semNada.slice(0, 4).map((c) => c.nome).join(', ')}.`, por_que: 'Cliente ativo sem peça no período.', impacto: 'Entrega do contrato em dia.', prioridade: 'alta' });
    if (buracos.length) recomendacoes.push({ o_que: `Encaixar posts no buraco de ${buracos[0].nome}.`, por_que: `${buracos[0].maiorBuraco} dias entre dois posts.`, impacto: 'Constância no feed.', prioridade: 'media' });
    const mono = topo.filter((c) => c.total >= 4 && c.formatos[0] && c.formatos[0][1] / c.total > 0.7);
    if (mono.length) recomendacoes.push({ o_que: `Variar o formato no feed de ${mono.slice(0, 3).map((c) => c.nome).join(', ')}.`, por_que: 'Mais de 70% das peças num formato só.', impacto: 'Feed mais vivo.', prioridade: 'baixa' });
    return fechaAba('feed', { titulo: 'Produção · Feed', subtitulo: 'O feed de cada cliente: constância, formatos e o que vem na próxima semana', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Feed = peças com data do cliente (veiculação; sem ela, o prazo). Buraco = maior intervalo entre duas datas de post no período. Próximos 7 dias contados a partir de hoje.'] }, noPer.map((x) => x.d));
  }

  function abaGrupos(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, M = pecasMarcadas(ctx);
    const noPer = M.todas.filter((x) => u.dentro(x.data, per)), abertas = noPer.filter((x) => !x.s.entregue && !['pausada', 'esquecida'].includes(x.s.situacao));
    const parada = (x) => (u.soDia(x.d.status_updated_at) ? u.diasEntre(u.soDia(x.d.status_updated_at), hoje) : null);
    const grupos = u.contarPor(noPer, (x) => x.status).map(([st, n]) => {
      const l = noPer.filter((x) => x.status === st), ab = l.filter((x) => !x.s.entregue), dias = ab.map(parada).filter((n2) => n2 != null);
      return { st, n, abertas: ab.length, atrasadas: l.filter((x) => x.s.atrasada).length, media: dias.length ? Math.round(u.media(dias)) : null, max: dias.length ? Math.max(...dias) : null };
    });
    const parados = abertas.map((x) => ({ x, dias: parada(x) })).filter((y) => y.dias != null).sort((a, b) => b.dias - a.dias);
    const pior = grupos.filter((g) => g.abertas && g.media != null).sort((a, b) => b.media - a.media)[0];
    const travas = u.contarPor(abertas, (x) => STATUS_TRAVA[x.s.chave] || null);
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 5));
    const topSt = grupos.slice(0, 6).map((g) => g.st);
    const resumo = [
      `As ${u.plural(noPer.length, 'peça', 'peças')} do período estão em ${u.plural(grupos.length, 'grupo de status', 'grupos de status')}; ${u.num(abertas.length)} ainda abertas.`,
      grupos[0] ? `O grupo mais cheio é "${grupos[0].st}", com ${u.num(grupos[0].n)}.` : '',
      pior ? `Onde a peça mais fica parada: "${pior.st}", em média ${u.plural(pior.media, 'dia', 'dias')} no mesmo status (a mais antiga há ${pior.max}).` : '',
      travas[0] ? `O que mais trava: ${travas[0][0].toLowerCase()} (${u.plural(travas[0][1], 'peça', 'peças')}).` : 'Nada travado por cliente, direção ou alteração.',
    ];
    const numeros = [
      { rotulo: 'Grupos com peça', valor: u.num(grupos.length), porque: 'Status do quadro com pelo menos uma peça no período.' },
      { rotulo: 'Abertas', valor: u.num(abertas.length), porque: 'Sem Finalizado, fora pausadas e esquecidas.' },
      { rotulo: 'Travadas', valor: u.num(travas.reduce((t, [, n]) => t + n, 0)), porque: 'Esperando cliente, direção de arte, alteração, aprovação ou material.' },
      { rotulo: 'Parada há 7+ dias', valor: u.num(parados.filter((y) => y.dias >= 7).length), porque: 'Abertas sem troca de status há uma semana ou mais.' },
      { rotulo: 'Maior tempo parado', valor: parados[0] ? `${parados[0].dias} dias` : '—', porque: parados[0] ? `${String(parados[0].x.d.nome || '').slice(0, 40)} (${parados[0].x.status}).` : 'Sem o dia da última troca de status.' },
    ];
    const secoes = [
      { titulo: 'Peças por grupo de status', texto: ['Quantas peças em cada status do quadro, no período.'],
        grafico: { tipo: 'rosca', de: 'status', fatias: grupos.slice(0, 8).map((g) => ({ rotulo: g.st, valor: g.n })), centro: u.num(noPer.length), sub: 'peças' },
        tabela: { colunas: [{ rotulo: 'Status', status: true }, 'Peças', 'Abertas', 'Atrasadas', 'Parada (média)', 'Mais antiga'], linhas: grupos.map((g) => [g.st, u.num(g.n), u.num(g.abertas), u.num(g.atrasadas), g.media == null ? '—' : `${g.media} d`, g.max == null ? '—' : `${g.max} d`]) } },
      travas.length ? { titulo: 'O que segura as abertas', texto: ['As abertas pelo motivo de estarem paradas.'], grafico: { tipo: 'ranking', itens: travas.slice(0, 8).map(([t, n]) => ({ rotulo: t, valor: n, tom: 'ruim' })) } } : null,
      parados.length ? { titulo: 'Paradas há mais tempo', texto: ['As abertas há mais tempo no mesmo status: a ordem para destravar.'],
        tabela: { colunas: ['Dias', 'Peça', { rotulo: 'Cliente', cliente: true }, { rotulo: 'Status', status: true }, { rotulo: 'Com quem', pessoa: true }], linhas: parados.slice(0, 20).map((y) => [u.num(y.dias), String(y.x.d.nome || '').slice(0, 42), y.x.clientes.join(', ').slice(0, 24), y.x.status, y.x.pessoas.join(', ').slice(0, 22)]) } } : null,
    ];
    const historico = { texto: ['Peças de cada mês pelo status que têm hoje (os 6 status mais cheios).'],
      grafico: topSt.length ? { tipo: 'barras', rotulos: mesesH.map((m) => u.nomeMes(m)), series: topSt.map((st) => ({ nome: st, status: st, valores: mesesH.map((m) => M.todas.filter((x) => x.status === st && x.data.slice(0, 7) === m).length) })), empilhado: true } : null };
    const recomendacoes = [];
    if (pior && pior.media >= 3) recomendacoes.push({ o_que: `Destravar o grupo "${pior.st}".`, por_que: `As peças ficam em média ${pior.media} dias nele.`, impacto: `${u.num(pior.abertas)} peças voltam a andar.`, prioridade: pior.media >= 7 ? 'alta' : 'media' });
    if (travas[0] && travas[0][1] >= 3) recomendacoes.push({ o_que: /cliente/i.test(travas[0][0]) ? 'Cobrar do cliente o que falta, num lote só.' : `Resolver "${travas[0][0].toLowerCase()}" em uma rodada.`, por_que: `${u.num(travas[0][1])} peças seguram por isso.`, impacto: 'Fila andando.', prioridade: 'media' });
    for (const y of parados.filter((z) => z.dias >= 10).slice(0, 2)) recomendacoes.push({ o_que: `Decidir o que fazer com "${String(y.x.d.nome || '').slice(0, 40)}".`, por_que: `${y.dias} dias em "${y.x.status}".`, impacto: 'Peça entregue ou tirada do quadro.', prioridade: 'media' });
    return fechaAba('grupos', { titulo: 'Produção · Grupos', subtitulo: 'O quadro por grupo de status: onde as peças estão e onde param', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Grupo = status do quadro. Dias parada = hoje − o dia da última troca de status. Travada = esperando cliente, direção de arte, alteração, aprovação, material ou captação.'] }, noPer.map((x) => x.d));
  }

  function abaEquipe(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, M = pecasMarcadas(ctx);
    const noPer = M.todas.filter((x) => u.dentro(x.data, per));
    const nomes = [...new Set(noPer.flatMap((x) => x.pessoas))];
    const gente = nomes.map((n) => { const l = noPer.filter((x) => x.pessoas.includes(n)), c = M.conta(l); return { nome: n, ...c, clientes: new Set(l.flatMap((x) => x.clientes)).size, hoje: l.filter((x) => x.data === hoje && !x.s.entregue).length }; })
      .sort((a, b) => b.abertas - a.abertas || b.total - a.total);
    const pessoas = gente.filter((p) => p.nome !== 'Sem responsável'), semDono = gente.find((p) => p.nome === 'Sem responsável');
    const totAb = pessoas.reduce((t, p) => t + p.abertas, 0), maior = pessoas[0], leve = pessoas.slice().sort((a, b) => a.abertas - b.abertas)[0];
    const mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 5));
    const top = pessoas.slice(0, 10);
    const resumo = [
      `${u.plural(pessoas.length, 'pessoa tem', 'pessoas têm')} peça no período; ${u.num(totAb)} abertas no time${semDono ? ` e ${u.num(semDono.total)} sem responsável` : ''}.`,
      maior ? `Quem tem mais na mão: ${maior.nome}, com ${u.num(maior.abertas)} abertas (${u.pct(maior.abertas, totAb) ?? 0}% do time)${maior.atrasadas ? ` e ${u.num(maior.atrasadas)} atrasadas` : ''}.` : '',
      leve && maior && leve.nome !== maior.nome ? `Quem está mais leve: ${leve.nome}, com ${u.num(leve.abertas)} abertas.` : '',
      pessoas.some((p) => p.noPrazoPct != null) ? `No prazo: ${pessoas.filter((p) => p.noPrazoPct != null).sort((a, b) => b.noPrazoPct - a.noPrazoPct).slice(0, 3).map((p) => `${p.nome} ${p.noPrazoPct}%`).join(', ')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Pessoas com peça', valor: u.num(pessoas.length), porque: 'Responsáveis por pelo menos uma peça no período.' },
      { rotulo: 'Abertas no time', valor: u.num(totAb), porque: 'Peça de duas pessoas conta para as duas.' },
      { rotulo: 'Maior fila', valor: maior ? `${maior.nome.split(' ')[0]} · ${u.num(maior.abertas)}` : '—', porque: 'Quem tem mais peças abertas.' },
      { rotulo: 'Concentração', valor: maior && totAb ? `${u.pct(maior.abertas, totAb)}%` : '—', porque: 'Peso da maior fila no time: acima de 35% uma pessoa segura a entrega.' },
      { rotulo: 'Atrasadas no time', valor: u.num(pessoas.reduce((t, p) => t + p.atrasadas, 0)), porque: 'Somando cada pessoa.' },
      { rotulo: 'Sem responsável', valor: u.num(semDono?.total || 0), porque: 'Peça sem dono não entra na fila de ninguém.' },
    ];
    const cl = u.contarPor(noPer, (x) => x.clientes).slice(0, 8).map(([n]) => n);
    const secoes = [
      { titulo: 'A fila de cada pessoa', texto: ['Prontas, abertas e atrasadas de cada pessoa no período.'],
        grafico: top.length ? { tipo: 'barras', rotulos: top.map((p) => p.nome.split(' ')[0]), series: [{ nome: 'Prontas', valores: top.map((p) => p.entregues), papel: 'pronto' }, { nome: 'Abertas', valores: top.map((p) => p.abertas), papel: 'aberto' }, { nome: 'Atrasadas', valores: top.map((p) => p.atrasadas), papel: 'atraso' }] } : null,
        tabela: { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Peças', 'Prontas', 'Abertas', 'Atrasadas', 'No prazo', 'Clientes', 'Hoje'], linhas: gente.map((p) => [p.nome, u.num(p.total), u.num(p.entregues), u.num(p.abertas), u.num(p.atrasadas), p.noPrazoPct == null ? '—' : `${p.noPrazoPct}%`, u.num(p.clientes), u.num(p.hoje)]) } },
      top.length && cl.length ? { titulo: 'Quem atende quem', texto: ['Peças de cada pessoa nos clientes com mais peças no período.'],
        grafico: { tipo: 'heatmap', linhasDe: 'pessoa', linhas: top.map((p) => p.nome), colunas: cl.map((c) => c.split(' ')[0].slice(0, 10)), valores: top.map((p) => cl.map((c) => noPer.filter((x) => x.pessoas.includes(p.nome) && x.clientes.includes(c)).length)) } } : null,
    ];
    const historico = { texto: ['Prontas de cada pessoa mês a mês (as 10 com mais abertas).'],
      grafico: top.length ? { tipo: 'heatmap', linhasDe: 'pessoa', linhas: top.map((p) => p.nome), colunas: mesesH.map((m) => u.nomeMes(m)), valores: top.map((p) => mesesH.map((m) => M.todas.filter((x) => x.pessoas.includes(p.nome) && x.data.slice(0, 7) === m && x.s.entregue).length)) } : null };
    const recomendacoes = [];
    if (maior && leve && totAb >= 8 && maior.abertas / totAb > 0.35 && maior.nome !== leve.nome) recomendacoes.push({ o_que: `Passar parte da fila de ${maior.nome} para ${leve.nome}.`, por_que: `${maior.nome} tem ${u.pct(maior.abertas, totAb)}% das abertas; ${leve.nome}, ${u.num(leve.abertas)}.`, impacto: 'Entrega menos dependente de uma pessoa.', prioridade: 'media' });
    for (const p of pessoas.filter((x) => x.atrasadas >= 3).slice(0, 2)) recomendacoes.push({ o_que: `Conversar com ${p.nome} sobre as ${u.num(p.atrasadas)} atrasadas.`, por_que: 'Atraso acumulado numa pessoa vira furo em vários clientes.', impacto: `${u.num(p.atrasadas)} peças destravadas.`, prioridade: 'alta' });
    if (semDono?.total) recomendacoes.push({ o_que: `Dar responsável às ${u.num(semDono.total)} peças sem dono.`, por_que: 'Ninguém vê essas peças na própria fila.', impacto: 'Nenhuma peça esquecida.', prioridade: 'media' });
    return fechaAba('equipe', { titulo: 'Produção · Equipe', subtitulo: 'A fila de cada pessoa, quem atende quem e o histórico de entregas', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Pessoa = responsável da peça (peça de duas pessoas conta para as duas). No prazo = pronta até a data do cliente. "Hoje" = abertas com data de hoje.'] }, noPer.map((x) => x.d));
  }
  const ABAS_PROD = { semana: abaSemana, mes: abaMes, feed: abaFeed, grupos: abaGrupos, equipe: abaEquipe };
  const vista = (v) => () => typeof document !== 'undefined' && (Boolean(document.querySelector(`#pv2-vistas [data-vista="${v}"][aria-checked="true"]`)) || (!document.querySelector('#pv2-vistas [aria-checked="true"]') && document.body?.dataset?.pv2Vista === v));
  const ABAS = [['semana', 'Semana'], ['mes', 'Mês'], ['feed', 'Feed'], ['grupos', 'Grupos'], ['equipe', 'Equipe']].map(([id, nome]) => ({ id, nome, telas: ['gestor', 'setor:producao'], seletor: vista(id) }));
  function relatorioComAbas(ctx) { return ctx.aba && ABAS_PROD[ctx.aba.id] ? ABAS_PROD[ctx.aba.id](ctx) : relatorio(ctx); }

  const registrar = () => raiz.VybeRelatorio?.registrar?.('producao', relatorioComAbas, { nome: 'Produção', telas: ['setor:producao', 'gestor', 'projetos'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' }, abas: ABAS });
  if (raiz.VybeRelatorio?.registrar) registrar();
  raiz.VybeRelProducao = Object.freeze({ relatorio, registrar });
})(typeof window !== 'undefined' ? window : globalThis);
