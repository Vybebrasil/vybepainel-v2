// vybe-relatorio-clientes.js — o relatório técnico dos Clientes (carteira), pelo Mateus (Atendimento ao cliente).
// Paulo, 26/11/2026 (vybe-relatorio.js). A nota de cada cliente é a mesma conta da Carteira (VybeCarteiraSaude.calcular,
// com os sinais e o clima de GET /api/painel?area=carteira); o histórico vem da nota guardada mês a mês
// (historico.meses da mesma rota) e o onboarding de area=carteira&acao=onboarding. Só leitura. Receita perdida é
// dinheiro: só os donos (o servidor já tira os valores para os outros; aqui a linha também sai).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const ROT = { alto: 'Risco alto', medio: 'Risco médio', baixo: 'Risco baixo' };

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas, S = raiz.VybeCarteiraSaude;
    const [cart, onb] = await Promise.all([ctx.api('carteira'), ctx.api('carteira', { acao: 'onboarding' })]);
    const pecas = ctx.dados.pecas(), cad = ctx.dados.clientes().filter((c) => c && c.nome && c.ativo !== false && !c.nao_e_cliente);
    ctx.fonte('Cadastro de clientes (CADASTRO_CLIENTES)', `${u.num(cad.length)} clientes ativos`);
    ctx.fonte('Peças da Produção (DADOS_ALL)', `${u.num(pecas.length)} peças, para atraso, furo e prazo de cada cliente`);
    let saude = null;
    try { saude = S?.calcular ? S.calcular({ demandas: pecas, clientes: cad, sinais: cart?.sinais || null, clima: cart?.clima?.disponivel ? cart.clima : null, hoje }) : null; } catch { saude = null; }
    const cls = lista(saude?.clientes), res = saude?.resumo || { total: 0, media: null, alto: 0, medio: 0, baixo: 0 };
    // Nota guardada por mês (a Carteira guarda a cada abertura): a tendência e o mês anterior.
    const meses = lista(cart?.historico?.meses).map((m) => ({ mes: String(m.mes || '').slice(0, 7), media: Number(m.media), clientes: Number(m.clientes), alto: Number(m.alto) })).filter((m) => m.mes && Number.isFinite(m.media));
    const mesAnt = meses.filter((m) => m.mes < per.fim.slice(0, 7) && m.mes <= per.anterior.fim.slice(0, 7)).pop();
    const contra = { contra: mesAnt ? `vs ${u.nomeMes(mesAnt.mes, true)}` : '' };
    // Peças de cada cliente no período (entregas, atraso).
    const a = P.analisar({ pecas, per, hoje, equipe: ctx.dados.equipe() });
    const pecasDe = new Map(a.porCliente.map((c) => [c.nome, c]));
    // Entradas e saídas no período (base do servidor).
    const base = lista(cart?.clientes);
    const sairam = base.filter((c) => c.saida && u.dentro(String(c.saida).slice(0, 10), per));
    const sairamAnt = base.filter((c) => c.saida && u.dentro(String(c.saida).slice(0, 10), per.anterior));
    const entraram = base.filter((c) => c.entrada && u.dentro(String(c.entrada).slice(0, 10), per));
    const registros = new Map(lista(cart?.churn?.registros).map((r) => [String(r.cliente_id), r]));
    const receitaPerdida = sairam.reduce((t, c) => t + (Number(registros.get(String(c.id))?.receita_mensal ?? c.valor) || 0), 0);
    const temReceita = sairam.some((c) => registros.get(String(c.id))?.receita_mensal != null || c.valor != null);
    // Contrato perto do fim com nota baixa: o risco de perder.
    const perigo = cls.filter((c) => c.risco !== 'baixo' && c.numeros?.diasContrato != null && c.numeros.diasContrato <= 60);
    const semReuniao = cls.filter((c) => Number(c.numeros?.diasSemReuniao) >= 60);
    const etapas = lista(onb?.etapas), paradas = etapas.filter((e) => Number(e.diasParada) >= 7);
    const piores = cls.slice(0, 5);
    const motivo = (c) => (c.motivos || []).find((m) => m.pontos > 0 || m.pontos < 0)?.texto || (c.motivos || [])[0]?.texto || '—';
    const comHead = saude?.heads ? saude.heads : [];

    const resumo = [];
    resumo.push(res.total ? `A carteira tem ${u.plural(res.total, 'cliente ativo', 'clientes ativos')} com nota média ${u.num(res.media)}${mesAnt ? ` (${u.num(mesAnt.media)} em ${u.nomeMes(mesAnt.mes, true)})` : ''}: ${u.num(res.alto)} em risco alto, ${u.num(res.medio)} em risco médio e ${u.num(res.baixo)} bem.` : 'Nenhum cliente ativo no cadastro carregado.');
    if (piores[0] && piores[0].risco !== 'baixo') resumo.push(`O que mais preocupa: ${piores.filter((c) => c.risco !== 'baixo').slice(0, 3).map((c) => `${c.nome} (${c.score}, ${motivo(c)})`).join('; ')}.`);
    if (perigo.length) resumo.push(`${u.plural(perigo.length, 'cliente com nota baixa tem', 'clientes com nota baixa têm')} contrato terminando em até 60 dias: é onde a renovação corre risco.`);
    if (sairam.length || entraram.length) resumo.push(`No período, ${u.plural(entraram.length, 'cliente entrou', 'clientes entraram')} e ${u.plural(sairam.length, 'saiu', 'saíram')}.`);
    else if (cart) resumo.push('Nenhuma entrada ou saída de cliente no período.');
    if (!cart) resumo.push('A leitura da carteira não respondeu: a nota usa só o que está na tela (sem NPS, reunião, contrato e clima).');

    const numeros = [
      { rotulo: 'Nota média da carteira', valor: res.media == null ? 'sem dado' : u.num(res.media), variacao: mesAnt && res.media != null ? u.variacao(res.media, mesAnt.media, 'maior', { ...contra, unidade: ' pts' }) : null, porque: 'Média da nota de saúde (0 a 100) dos clientes ativos, a mesma da Carteira.' },
      { rotulo: 'Clientes em risco alto', valor: u.num(res.alto), variacao: mesAnt && Number.isFinite(mesAnt.alto) ? u.variacao(res.alto, mesAnt.alto, 'menor', contra) : null, porque: 'Nota abaixo de 50: atraso, furo, ajuste demais, contrato ou clima ruim.' },
      { rotulo: 'Clientes ativos', valor: u.num(res.total), porque: 'Ativos no cadastro e que são clientes.' },
      { rotulo: 'Saídas no período', valor: cart ? u.num(sairam.length) : 'sem dado', variacao: cart ? u.variacao(sairam.length, sairamAnt.length, 'menor', { contra: `vs ${per.anterior.rotulo}` }) : null, porque: 'Clientes com saída (churn ou desativação) dentro do período.' },
      { rotulo: 'Receita mensal perdida', valor: temReceita ? u.brl(receitaPerdida) : 'sem dado', dinheiro: true, porque: 'Soma da receita mensal de quem saiu no período.' },
      { rotulo: 'Onboardings parados', valor: onb ? u.num(paradas.length) : 'sem dado', porque: 'Etapa do onboarding sem movimento há 7 dias ou mais.' },
    ];
    const faixas = [['Risco alto', res.alto], ['Risco médio', res.medio], ['Risco baixo', res.baixo]];
    const secoes = [
      { titulo: 'Saúde da carteira', texto: ['Quantos clientes em cada faixa de risco hoje.'], grafico: res.total ? { tipo: 'rosca', fatias: faixas.map(([r, n], i) => ({ rotulo: r, valor: n, papel: ['atraso', 'risco', 'pronto'][i] })), centro: u.num(res.media), sub: 'nota média' } : null },
      { titulo: 'Clientes da nota mais baixa para a mais alta', texto: ['A nota soma o que tira ponto (atraso, furo, ajuste, aprovação lenta, contrato, NPS, reunião, clima) e o que soma.'],
        grafico: cls.length ? { tipo: 'ranking', de: 'cliente', itens: cls.slice(0, 15).map((c) => ({ rotulo: c.nome, valor: c.score, sub: ROT[c.risco], tom: c.risco === 'alto' ? 'ruim' : c.risco === 'baixo' ? 'bom' : '' })) } : null,
        tabela: cls.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Nota', 'Risco', 'Head', 'Abertas', 'Atrasadas', 'Principal motivo'], linhas: cls.map((c) => [c.nome, u.num(c.score), ROT[c.risco], (c.heads || []).join(', ') || '—', u.num(c.numeros?.abertas || 0), u.num(c.numeros?.atrasadas || 0), String(motivo(c)).slice(0, 48)]) } : null },
      { titulo: 'Ficha dos clientes que mais preocupam', texto: piores.length ? piores.map((c) => `${c.nome} — nota ${c.score} (${ROT[c.risco].toLowerCase()}): ${(c.motivos || []).filter((m) => m.pontos).slice(0, 3).map((m) => `${m.texto} (−${Math.abs(m.pontos)})`).join('; ') || 'sem ponto perdido'}. No período: ${u.num(pecasDe.get(c.nome)?.total || 0)} peças, ${u.num(pecasDe.get(c.nome)?.atrasadas || 0)} atrasadas.`) : ['Sem clientes para mostrar.'] },
      { titulo: 'Por head', texto: ['Média da nota dos clientes de cada head.'],
        tabela: comHead.length ? { colunas: ['Head', 'Clientes', 'Média', 'Alto', 'Médio', 'Baixo'], linhas: comHead.map((h) => [h.head, u.num(h.total), u.num(h.media), u.num(h.alto), u.num(h.medio), u.num(h.baixo)]) } : null },
    ];
    if (perigo.length || semReuniao.length) secoes.push({ titulo: 'Renovação e relacionamento', texto: [perigo.length ? 'Contrato perto do fim com nota baixa primeiro.' : 'Nenhum contrato perto do fim com nota baixa.', semReuniao.length ? `${u.plural(semReuniao.length, 'cliente está', 'clientes estão')} há 60 dias ou mais sem reunião registrada.` : ''].filter(Boolean),
      tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Nota', 'Contrato em', 'Sem reunião há'], linhas: [...perigo, ...semReuniao.filter((c) => !perigo.includes(c))].slice(0, 20).map((c) => [c.nome, u.num(c.score), c.numeros?.diasContrato != null ? `${u.num(c.numeros.diasContrato)} dias` : '—', c.numeros?.diasSemReuniao != null ? `${u.num(c.numeros.diasSemReuniao)} dias` : '—']) } });
    if (sairam.length || entraram.length) secoes.push({ titulo: 'Entradas e saídas', texto: [`${u.plural(entraram.length, 'entrada', 'entradas')} e ${u.plural(sairam.length, 'saída', 'saídas')} no período.`],
      tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Movimento', 'Data', 'Motivo', { rotulo: 'Receita mensal', dinheiro: true }], linhas: [...entraram.map((c) => [c.nome, 'Entrou', u.dataCurta(String(c.entrada).slice(0, 10)), '—', '—']),
        ...sairam.map((c) => { const r = registros.get(String(c.id)); return [c.nome, 'Saiu', u.dataCurta(String(c.saida).slice(0, 10)), r?.motivo || c.motivo_saida || 'sem classificar', r?.receita_mensal != null ? u.brl(r.receita_mensal) : c.valor != null ? u.brl(c.valor) : '—']; })] } });
    if (etapas.length) secoes.push({ titulo: 'Onboarding', texto: [paradas.length ? `${u.plural(paradas.length, 'onboarding está parado', 'onboardings estão parados')} há 7 dias ou mais.` : 'Nenhum onboarding parado.'],
      tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Etapa', 'Andamento', 'Parada há', { rotulo: 'Responsável', pessoa: true }], linhas: etapas.slice(0, 20).map((e) => [e.cliente || '—', e.etapa || '—', e.pct != null ? `${u.num(e.pct)}%` : '—', e.diasParada != null ? `${u.num(e.diasParada)} dias` : '—', e.responsavel || '—']) } });
    const historico = meses.length >= 2
      ? { texto: [`Nota média da carteira por mês, guardada pela Carteira. ${u.tendenciaTexto(meses.map((m) => m.media), { coisa: 'Tendência da nota', melhor: 'maior' }).texto}.`],
        grafico: { tipo: 'linha', rotulos: meses.slice(-12).map((m) => u.nomeMes(m.mes)), series: [{ nome: 'Nota média', valores: meses.slice(-12).map((m) => m.media) }], min: 0, max: 100 },
        tabela: { colunas: ['Mês', 'Nota média', 'Clientes', 'Risco alto'], linhas: meses.slice(-12).map((m) => [u.nomeMes(m.mes, true), u.num(m.media), u.num(m.clientes), u.num(m.alto)]) } }
      : { texto: ['A Carteira ainda não guardou notas de meses anteriores: o histórico começa a aparecer a partir do próximo mês.'] };
    const proxN = meses.length >= 3 ? u.projetar(meses.map((m) => m.media), 3) : null;
    const projecao = { texto: [proxN ? `Se a tendência seguir, a nota média fica em ${[1, 2, 3].map((k, i) => `${u.nomeMes(u.somarMeses(meses[meses.length - 1].mes, k))} ≈ ${u.num(Math.max(0, Math.min(100, proxN[i])))}`).join(', ')}.` : 'Poucos meses guardados para projetar a nota.',
      perigo.length ? `${u.plural(perigo.length, 'renovação', 'renovações')} em risco nos próximos 60 dias.` : 'Nenhuma renovação em risco nos próximos 60 dias.'] };
    const recomendacoes = [];
    const altos = cls.filter((c) => c.risco === 'alto');
    if (altos.length) recomendacoes.push({ o_que: `Marcar conversa com ${altos.slice(0, 3).map((c) => c.nome).join(', ')}${altos.length > 3 ? ` e mais ${altos.length - 3}` : ''} (risco alto).`, por_que: `A nota está abaixo de 50; o maior motivo de ${altos[0].nome} é ${motivo(altos[0])}.`, impacto: 'Cliente ouvido antes de pensar em sair.', prioridade: 'alta' });
    if (perigo.length) recomendacoes.push({ o_que: `Preparar a renovação de ${perigo.slice(0, 3).map((c) => c.nome).join(', ')} com um resumo do que foi entregue.`, por_que: 'Contrato termina em até 60 dias com nota baixa.', impacto: 'Renovação protegida.', prioridade: 'alta' });
    const atrCli = a.porCliente.filter((c) => c.atrasadas >= 3);
    if (atrCli.length) recomendacoes.push({ o_que: `Combinar com a Produção as atrasadas de ${atrCli.slice(0, 3).map((c) => `${c.nome} (${c.atrasadas})`).join(', ')}.`, por_que: 'Atraso e furo são o que mais tira ponto da nota.', impacto: 'Nota volta a subir em poucas semanas.', prioridade: 'media' });
    if (paradas.length) recomendacoes.push({ o_que: `Destravar os ${u.num(paradas.length)} onboardings parados.`, por_que: 'Cliente novo que espera começa a relação com má impressão.', impacto: 'Primeiro mês do cliente no prazo.', prioridade: 'media' });
    if (semReuniao.length) recomendacoes.push({ o_que: `Agendar reunião com os ${u.num(semReuniao.length)} clientes sem reunião há 60 dias.`, por_que: 'Sem conversa, o cliente não vê o resultado.', impacto: 'Relacionamento em dia.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a reunião mensal com cada cliente.', por_que: 'A carteira está bem; a reunião mantém assim.', impacto: 'Nota estável.', prioridade: 'baixa' });
    return { titulo: 'Clientes', subtitulo: 'Saúde da carteira, clientes em risco, renovação, entradas e saídas', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Nota de saúde = 100 menos os pontos perdidos (regras em vybe-carteira-saude.js): risco alto abaixo de 50, médio abaixo de 75.', 'Entradas e saídas pela base do servidor (início do contrato ou cadastro; saída pelo registro de churn ou desativação). Receita perdida só aparece para os donos.'] };
  }
  // ---------- As subabas (Paulo, 27/11/2026): Saúde da carteira, Onboarding, Reuniões e um cliente ----------
  const ativosDe = (ctx) => ctx.dados.clientes().filter((c) => c && c.nome && c.ativo !== false && !c.nao_e_cliente);
  function saudeDe(ctx, cart) {
    const S = raiz.VybeCarteiraSaude, cad = ativosDe(ctx);
    try { return S?.calcular ? S.calcular({ demandas: ctx.dados.pecas(), clientes: cad, sinais: cart?.sinais || null, clima: cart?.clima?.disponivel ? cart.clima : null, hoje: ctx.hoje }) : null; } catch { return null; }
  }
  const tipoMotivo = (t) => { const x = String(t || '').replace(/\d+([.,/]\d+)?%?\s*/g, '').replace(/\s+/g, ' ').trim(); return x.charAt(0).toUpperCase() + x.slice(1); };
  const fecha = (aba, rel) => ({ ...rel, aba, resumo: lista(rel.resumo).filter(Boolean).slice(0, 5),
    recomendacoes: lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Olhar esta aba de novo na semana que vem.', por_que: 'Nada pede ação pelos números lidos.', impacto: 'Relação em dia.', prioridade: 'baixa' }] });

  async function abaCarteira(ctx) {
    const u = ctx.util, cart = await ctx.api('carteira'), saude = saudeDe(ctx, cart);
    const cls = lista(saude?.clientes), res = saude?.resumo || { total: 0, media: null, alto: 0, medio: 0, baixo: 0 }, heads = lista(saude?.heads);
    const motivos = new Map();
    for (const c of cls) for (const m of lista(c.motivos)) if (m.pontos < 0) { const k = tipoMotivo(m.texto), x = motivos.get(k) || { motivo: k, clientes: 0, pontos: 0 }; x.clientes += 1; x.pontos += -m.pontos; motivos.set(k, x); }
    const mot = [...motivos.values()].sort((a, b) => b.pontos - a.pontos);
    const meses = lista(cart?.historico?.meses).map((m) => ({ mes: String(m.mes || '').slice(0, 7), media: Number(m.media), alto: Number(m.alto), clientes: Number(m.clientes) })).filter((m) => m.mes && Number.isFinite(m.media));
    const faixa = (s) => (s < 50 ? '0–49' : s < 60 ? '50–59' : s < 75 ? '60–74' : s < 90 ? '75–89' : '90–100');
    const faixas = ['0–49', '50–59', '60–74', '75–89', '90–100'].map((f) => [f, cls.filter((c) => faixa(c.score) === f).length]);
    const quase = cls.filter((c) => c.score >= 50 && c.score < 58);
    ctx.fonte('Saúde da carteira (VybeCarteiraSaude)', `${u.num(cls.length)} clientes com nota, com os sinais de area=carteira`);
    const resumo = [
      res.total ? `A carteira tem ${u.plural(res.total, 'cliente', 'clientes')} com nota média ${u.num(res.media)}: ${u.num(res.alto)} em risco alto, ${u.num(res.medio)} em risco médio e ${u.num(res.baixo)} bem.` : 'Nenhum cliente com nota de saúde agora.',
      mot[0] ? `O que mais tira ponto da carteira inteira: ${mot.slice(0, 3).map((m) => `${m.motivo} (${u.plural(m.clientes, 'cliente', 'clientes')})`).join('; ')}.` : 'Nenhum cliente perdeu ponto.',
      quase.length ? `${u.plural(quase.length, 'cliente está', 'clientes estão')} a poucos pontos do risco alto: ${quase.slice(0, 3).map((c) => `${c.nome} (${c.score})`).join(', ')}.` : '',
      heads.length > 1 ? `Por head: ${heads.map((h) => `${h.head} ${u.num(h.media)}`).join(', ')}.` : '',
      meses.length >= 2 ? `${u.tendenciaTexto(meses.map((m) => m.media), { coisa: 'A nota média', melhor: 'maior' }).texto}.` : '',
    ];
    const numeros = [
      { rotulo: 'Nota média', valor: res.media == null ? 'sem dado' : u.num(res.media), porque: 'Média da nota de saúde (0 a 100), a mesma da tela.' },
      { rotulo: 'Risco alto', valor: u.num(res.alto), porque: 'Nota abaixo de 50.' },
      { rotulo: 'Risco médio', valor: u.num(res.medio), porque: 'Nota de 50 a 74.' },
      { rotulo: 'Bem', valor: u.num(res.baixo), porque: 'Nota de 75 para cima.' },
      { rotulo: 'Perto do risco alto', valor: u.num(quase.length), porque: 'Entre 50 e 57: um furo a mais e caem.' },
      { rotulo: 'Motivos diferentes', valor: u.num(mot.length), porque: 'Tipos de motivo que tiram ponto hoje.' },
    ];
    const secoes = [
      { titulo: 'As notas em faixas', texto: ['Quantos clientes em cada faixa de nota.'], grafico: cls.length ? { tipo: 'barras', rotulos: faixas.map((f) => f[0]), series: [{ nome: 'Clientes', valores: faixas.map((f) => f[1]), papel: 'destaque' }] } : null },
      mot.length ? { titulo: 'O que tira ponto da carteira', texto: ['Cada motivo, quantos clientes ele pega e quantos pontos tira somando todos.'], grafico: { tipo: 'ranking', itens: mot.slice(0, 10).map((m) => ({ rotulo: m.motivo, valor: m.pontos, sub: `${m.clientes} cliente(s)`, tom: 'ruim' })) },
        tabela: { colunas: ['Motivo', 'Clientes', 'Pontos'], linhas: mot.map((m) => [m.motivo, u.num(m.clientes), u.num(m.pontos)]) } } : null,
      heads.length ? { titulo: 'Carteira de cada head', texto: ['A nota dos clientes de cada head.'], grafico: { tipo: 'barras', rotulos: heads.map((h) => h.head), series: [{ nome: 'Alto', valores: heads.map((h) => h.alto), papel: 'atraso' }, { nome: 'Médio', valores: heads.map((h) => h.medio), papel: 'risco' }, { nome: 'Bem', valores: heads.map((h) => h.baixo), papel: 'pronto' }], empilhado: true },
        tabela: { colunas: ['Head', 'Clientes', 'Média', 'Alto', 'Médio', 'Bem'], linhas: heads.map((h) => [h.head, u.num(h.total), u.num(h.media), u.num(h.alto), u.num(h.medio), u.num(h.baixo)]) } } : null,
      cls.length ? { titulo: 'Todos os clientes pela nota', texto: ['Da nota mais baixa para a mais alta.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Nota', 'Risco', 'Atrasadas', 'Motivo principal'], linhas: cls.map((c) => [c.nome, u.num(c.score), ROT[c.risco], u.num(c.numeros?.atrasadas || 0), String((c.motivos || []).find((m) => m.pontos < 0)?.texto || '—').slice(0, 52)]) } } : null,
    ].filter(Boolean);
    const historico = meses.length >= 2 ? { texto: ['Nota média e clientes em risco alto mês a mês.'], grafico: { tipo: 'linha', rotulos: meses.slice(-12).map((m) => u.nomeMes(m.mes)), series: [{ nome: 'Nota média', valores: meses.slice(-12).map((m) => m.media), papel: 'destaque' }] },
      tabela: { colunas: ['Mês', 'Nota', 'Clientes', 'Risco alto'], linhas: meses.slice(-12).map((m) => [u.nomeMes(m.mes, true), u.num(m.media), u.num(m.clientes), u.num(m.alto)]) } } : { texto: ['A Carteira ainda não guardou a nota de meses anteriores.'] };
    const recomendacoes = [];
    if (mot[0]) recomendacoes.push({ o_que: /reuni/i.test(mot[0].motivo) ? 'Agendar as reuniões em atraso da carteira.' : /atras|furo/i.test(mot[0].motivo) ? 'Combinar com a Produção as atrasadas dos clientes da carteira.' : `Atacar "${mot[0].motivo}" em toda a carteira.`, por_que: `É o motivo que mais tira ponto: ${u.num(mot[0].pontos)} pontos em ${u.plural(mot[0].clientes, 'cliente', 'clientes')}.`, impacto: 'A nota média sobe de uma vez.', prioridade: 'alta' });
    if (quase.length) recomendacoes.push({ o_que: `Proteger ${quase.slice(0, 3).map((c) => c.nome).join(', ')} antes de caírem para risco alto.`, por_que: 'Estão a poucos pontos do limite.', impacto: 'Menos clientes em risco alto.', prioridade: 'media' });
    const hPior = heads.slice().sort((a, b) => a.media - b.media)[0];
    if (heads.length > 1 && hPior) recomendacoes.push({ o_que: `Rever a carteira de ${hPior.head} junto.`, por_que: `A média dos clientes de ${hPior.head} é ${u.num(hPior.media)}, a mais baixa.`, impacto: 'Carteira equilibrada entre os heads.', prioridade: 'media' });
    return fecha('carteira', { titulo: 'Clientes · Saúde da carteira', subtitulo: 'A nota de cada cliente, o que tira ponto e a carteira de cada head', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Nota de saúde = 100 menos os pontos perdidos (vybe-carteira-saude.js): risco alto abaixo de 50, médio abaixo de 75. Motivo agrupado pelo texto, sem os números.'] });
  }

  async function abaOnboarding(ctx) {
    const u = ctx.util, onb = await ctx.api('carteira', { acao: 'onboarding' }), etapas = lista(onb?.etapas).slice().sort((a, b) => (Number(b.diasParada) || 0) - (Number(a.diasParada) || 0));
    const paradas = etapas.filter((e) => Number(e.diasParada) >= 7), porEtapa = u.contarPor(etapas, (e) => e.etapa || 'Sem etapa'), porResp = u.contarPor(etapas, (e) => e.responsavel || 'Sem responsável');
    const pcts = etapas.map((e) => Number(e.pct)).filter(Number.isFinite), media = pcts.length ? Math.round(u.media(pcts)) : null;
    ctx.fonte('Onboarding (area=carteira&acao=onboarding)', `${u.num(etapas.length)} onboardings abertos`);
    const resumo = [
      onb ? (etapas.length ? `${u.plural(etapas.length, 'onboarding está aberto', 'onboardings estão abertos')}${media != null ? `, em média ${media}% andado` : ''}.` : 'Nenhum onboarding aberto agora.') : 'A leitura do onboarding não respondeu agora.',
      paradas.length ? `${u.plural(paradas.length, 'está parado', 'estão parados')} há 7 dias ou mais: ${paradas.slice(0, 3).map((e) => `${e.cliente} em "${e.etapa}" (${e.diasParada} dias)`).join('; ')}.` : etapas.length ? 'Nenhum parado há uma semana.' : '',
      porEtapa[0] ? `A etapa que mais segura: ${porEtapa[0][0]} (${porEtapa[0][1]}).` : '',
      porResp[0] && porResp[0][0] !== 'Sem responsável' ? `Quem tem mais onboarding na mão: ${porResp[0][0]} (${porResp[0][1]}).` : '',
    ];
    const numeros = [
      { rotulo: 'Abertos', valor: onb ? u.num(etapas.length) : 'sem dado', porque: 'Onboardings não concluídos.' },
      { rotulo: 'Parados 7+ dias', valor: u.num(paradas.length), porque: 'Etapa sem movimento há uma semana ou mais.' },
      { rotulo: 'Andamento médio', valor: media == null ? '—' : `${media}%`, porque: 'Média do percentual de cada onboarding.' },
      { rotulo: 'Mais parado', valor: etapas[0]?.diasParada != null ? `${etapas[0].diasParada} dias` : '—', porque: etapas[0] ? `${etapas[0].cliente}, em ${etapas[0].etapa}.` : 'Nada aberto.' },
    ];
    const secoes = [
      { titulo: 'Onboarding de cada cliente', texto: [etapas.length ? 'A etapa atual, o andamento e há quanto tempo está parada.' : 'Nenhum onboarding aberto.'],
        grafico: etapas.length ? { tipo: 'ranking', de: 'cliente', itens: etapas.slice(0, 12).map((e) => ({ rotulo: e.cliente || '—', valor: Number(e.diasParada) || 0, sub: e.etapa, tom: Number(e.diasParada) >= 7 ? 'ruim' : '' })) } : null,
        tabela: etapas.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Etapa', 'Andamento', 'Parada há', { rotulo: 'Responsável', pessoa: true }], linhas: etapas.map((e) => [e.cliente || '—', e.etapa || '—', e.pct != null ? `${u.num(e.pct)}%` : '—', e.diasParada != null ? `${u.num(e.diasParada)} dias` : '—', e.responsavel || '—']) } : null },
      porEtapa.length ? { titulo: 'Onde os onboardings estão', texto: ['Quantos clientes em cada etapa.'], grafico: { tipo: 'barras', rotulos: porEtapa.map((e) => e[0]), series: [{ nome: 'Clientes', valores: porEtapa.map((e) => e[1]), papel: 'destaque' }] } } : null,
      porResp.length ? { titulo: 'Por responsável', texto: ['Quem cuida de cada etapa aberta.'], tabela: { colunas: [{ rotulo: 'Responsável', pessoa: true }, 'Onboardings'], linhas: porResp.map(([n, k]) => [n, u.num(k)]) } } : null,
    ].filter(Boolean);
    const recomendacoes = paradas.slice(0, 3).map((e) => ({ o_que: `Destravar o onboarding de ${e.cliente} (${e.etapa}).`, por_que: `Parado há ${e.diasParada} dias${e.responsavel ? ` com ${e.responsavel}` : ''}.`, impacto: 'Cliente novo começando no prazo.', prioridade: Number(e.diasParada) >= 14 ? 'alta' : 'media' }));
    if (etapas.some((e) => !e.responsavel)) recomendacoes.push({ o_que: 'Dar responsável às etapas sem dono.', por_que: 'Etapa sem dono não anda.', impacto: 'Onboarding acompanhado.', prioridade: 'media' });
    return fecha('onboarding', { titulo: 'Clientes · Onboarding', subtitulo: 'Cliente novo ou contrato novo: etapa, andamento e o que está parado', resumo, numeros, secoes, historico: null, projecao: null, recomendacoes,
      metodologia: ['Onboardings abertos de GET area=carteira&acao=onboarding (o mesmo que o bot lê): etapa atual, % andado e dias sem movimento.'] });
  }

  async function abaReunioes(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, d = await ctx.api('reunioes'), todas = lista(d?.reunioes), tipos = d?.tipos || {};
    const cad = ativosDe(ctx), nomePorId = new Map(cad.map((c) => [String(c.id), String(c.nome)]));
    const nomeDe = (r) => r.cliente_nome || nomePorId.get(String(r.cliente_id)) || (r.cliente_id ? `Cliente ${r.cliente_id}` : 'Interna');
    const dia = (r) => String(r.data || '').slice(0, 10);
    const noPer = todas.filter((r) => dia(r) && u.dentro(dia(r), per)).sort((a, b) => dia(b).localeCompare(dia(a))), semAta = noPer.filter((r) => !String(r.ata || '').trim());
    const ultima = new Map(); for (const r of todas) { const k = String(r.cliente_id || ''); if (!k || !dia(r) || dia(r) > hoje) continue; if (!ultima.has(k) || dia(r) > ultima.get(k)) ultima.set(k, dia(r)); }
    const semReuniao = cad.map((c) => { const ul = ultima.get(String(c.id)) || ''; return { nome: c.nome, ultima: ul, dias: ul ? u.diasEntre(ul, hoje) : null }; }).filter((c) => c.dias == null || c.dias > 60).sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));
    const porTipo = u.contarPor(noPer, (r) => tipos[r.tipo] || r.tipo || 'Outra'), mesesH = Array.from({ length: 6 }, (_, k) => u.somarMeses(per.fim.slice(0, 7), k - 5));
    ctx.fonte('Reuniões (area=reunioes)', `${u.num(todas.length)} reuniões registradas`);
    const resumo = [
      d ? `No período, ${u.plural(noPer.length, 'reunião registrada', 'reuniões registradas')}${porTipo[0] ? `, a maioria ${String(porTipo[0][0]).toLowerCase()}` : ''}.` : 'A leitura das reuniões não respondeu agora.',
      semAta.length ? `${u.plural(semAta.length, 'está', 'estão')} sem ata: o combinado não fica escrito.` : noPer.length ? 'Todas têm ata.' : '',
      semReuniao.length ? `${u.plural(semReuniao.length, 'cliente ativo está', 'clientes ativos estão')} sem reunião há mais de 60 dias (ou nunca): ${semReuniao.slice(0, 3).map((c) => c.nome).join(', ')}.` : 'Todo cliente ativo teve reunião nos últimos 60 dias.',
      noPer.some((r) => r.gravacao) ? `${u.num(noPer.filter((r) => r.gravacao).length)} com gravação do áudio.` : '',
    ];
    const numeros = [
      { rotulo: 'Reuniões no período', valor: d ? u.num(noPer.length) : 'sem dado', porque: 'Reuniões com data no período.' },
      { rotulo: 'Sem ata', valor: u.num(semAta.length), porque: 'Reunião sem o combinado escrito.' },
      { rotulo: 'Com gravação', valor: u.num(noPer.filter((r) => r.gravacao).length), porque: 'O áudio guardado na reunião.' },
      { rotulo: 'Clientes sem reunião (60 d)', valor: u.num(semReuniao.length), porque: 'Ativos sem reunião há mais de 60 dias ou nunca.' },
    ];
    const secoes = [
      { titulo: 'Reuniões do período', texto: [noPer.length ? 'Cada reunião, de que tipo, com quem e se ficou ata.' : 'Nenhuma reunião com data no período.'],
        tabela: noPer.length ? { colunas: ['Data', { rotulo: 'Cliente', cliente: true }, 'Tipo', 'Título', 'Ata'], linhas: noPer.map((r) => [u.dataCurta(dia(r)), nomeDe(r), tipos[r.tipo] || r.tipo || '—', String(r.titulo || '').slice(0, 40), String(r.ata || '').trim() ? 'sim' : 'não']) } : null },
      porTipo.length ? { titulo: 'Por tipo', texto: ['Rotina, onboarding, alinhamento, comercial e interna.'], grafico: { tipo: 'rosca', fatias: porTipo.map(([t, n], i) => ({ rotulo: t, valor: n, papel: ['destaque', 'info', 'agente', 'neutro', 'neutro2'][i % 5] })), centro: u.num(noPer.length), sub: 'reuniões' } } : null,
      semReuniao.length ? { titulo: 'Clientes sem reunião', texto: ['Ativos sem reunião há mais de 60 dias, do mais antigo para o mais recente.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Última', 'Há'], linhas: semReuniao.slice(0, 20).map((c) => [c.nome, c.ultima ? u.dataBr(c.ultima) : 'nunca', c.dias == null ? '—' : `${c.dias} dias`]) } } : null,
    ].filter(Boolean);
    const historico = { texto: ['Reuniões registradas por mês.'], grafico: { tipo: 'barras', rotulos: mesesH.map((m) => u.nomeMes(m)), series: [{ nome: 'Reuniões', valores: mesesH.map((m) => todas.filter((r) => dia(r).slice(0, 7) === m).length), papel: 'destaque' }] } };
    const recomendacoes = [];
    if (semReuniao.length) recomendacoes.push({ o_que: `Agendar reunião com ${semReuniao.slice(0, 3).map((c) => c.nome).join(', ')}${semReuniao.length > 3 ? ` e mais ${semReuniao.length - 3}` : ''}.`, por_que: 'Mais de 60 dias sem reunião tira ponto da saúde e o cliente não vê o resultado.', impacto: 'Relacionamento e nota em dia.', prioridade: 'media' });
    if (semAta.length) recomendacoes.push({ o_que: `Escrever a ata das ${u.num(semAta.length)} reuniões sem ata.`, por_que: 'Sem ata o combinado se perde entre o atendimento e a produção.', impacto: 'Combinado cobrado no prazo.', prioridade: 'baixa' });
    return fecha('reunioes', { titulo: 'Clientes · Reuniões', subtitulo: 'As reuniões do período, as atas e quem está sem conversa', resumo, numeros, secoes, historico, projecao: null, recomendacoes,
      metodologia: ['Reuniões de GET area=reunioes (as mesmas da tela). Sem reunião = mais de 60 dias desde a última registrada, a mesma régua da nota de saúde.'] });
  }

  async function abaCliente(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas, alvo = ctx.aba.alvo;
    if (!alvo) throw new Error('Escolha o cliente do relatório.');
    const cad = ativosDe(ctx), c = cad.find((x) => String(x.id) === String(alvo.id)) || cad.find((x) => x.nome === alvo.nome) || { id: alvo.id, nome: alvo.nome };
    const [cart, reun] = await Promise.all([ctx.api('carteira'), ctx.api('reunioes', { cliente: c.id })]);
    const saude = saudeDe(ctx, cart), s = lista(saude?.clientes).find((x) => x.nome === c.nome || String(x.id) === String(c.id)) || null;
    const minhas = ctx.dados.pecas().filter((d) => d && lista(P.clientesDe(d)).includes(c.nome));
    const a = P.analisar({ pecas: minhas, per, hoje, equipe: ctx.dados.equipe() }), at = a.atual, an = a.anterior;
    const dia = (r) => String(r.data || '').slice(0, 10);
    const rs = lista(reun?.reunioes).filter((r) => !r.cliente_id || String(r.cliente_id) === String(c.id)).sort((x, y) => dia(y).localeCompare(dia(x))), ult = rs.find((r) => dia(r) && dia(r) <= hoje);
    const diasUlt = ult ? u.diasEntre(dia(ult), hoje) : null;
    const base = lista(cart?.clientes).find((x) => String(x.id) === String(c.id)) || null;
    const perdas = lista(s?.motivos).filter((m) => m.pontos < 0), bons = lista(s?.motivos).filter((m) => m.pontos > 0);
    const v = (x, y, m) => u.variacao(x, y, m, { contra: `vs ${a.contraRotulo}` });
    ctx.fonte('Peças do cliente (DADOS_ALL)', `${u.num(minhas.length)} peças de ${c.nome}`);
    if (reun) ctx.fonte('Reuniões do cliente (area=reunioes)', `${u.num(rs.length)} reuniões`);
    const resumo = [
      s ? `${c.nome} está com nota ${u.num(s.score)} (${ROT[s.risco].toLowerCase()})${perdas[0] ? `; o que mais tira ponto é ${perdas[0].texto}` : ''}.` : `${c.nome} ainda não tem nota de saúde.`,
      at.total ? `No período, ${u.plural(at.total, 'peça', 'peças')}: ${u.num(at.entregues)} prontas, ${u.num(at.abertas)} em aberto e ${u.num(at.atrasadas)} atrasadas${at.noPrazoPct != null ? `; ${at.noPrazoPct}% no prazo` : ''}.` : 'Nenhuma peça com data no período.',
      a.travas[0] ? `O que segura as peças dele: ${String(a.travas[0][0]).toLowerCase()} (${a.travas[0][1]}).` : '',
      ult ? `Última reunião em ${u.dataBr(dia(ult))} (há ${u.plural(diasUlt, 'dia', 'dias')})${String(ult.ata || '').trim() ? `: ${String(ult.ata).trim().slice(0, 110)}` : ', sem ata'}.` : 'Nenhuma reunião registrada.',
      s?.numeros?.diasContrato != null ? `O contrato termina em ${u.plural(s.numeros.diasContrato, 'dia', 'dias')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Nota de saúde', valor: s ? u.num(s.score) : 'sem dado', porque: s ? ROT[s.risco] : 'Sem cálculo.' },
      { rotulo: 'Peças no período', valor: u.num(at.total), variacao: v(at.total, an.total, 'maior'), porque: 'Peças com data do cliente no período.' },
      { rotulo: 'Prontas', valor: `${u.num(at.entregues)}${at.total ? ` · ${u.pct(at.entregues, at.total)}%` : ''}`, variacao: v(at.entregues, an.entregues, 'maior'), porque: 'Só Finalizado.' },
      { rotulo: 'Atrasadas', valor: u.num(at.atrasadas), variacao: v(at.atrasadas, an.atrasadas, 'menor'), porque: at.furos ? `${u.num(at.furos)} já com a veiculação vencida.` : 'Pelo prazo ou pela veiculação.' },
      { rotulo: 'No prazo', valor: at.noPrazoPct == null ? 'sem dado' : `${at.noPrazoPct}%`, porque: 'Prontas até a data do cliente.' },
      { rotulo: 'Dias sem reunião', valor: diasUlt != null ? u.num(diasUlt) : '—', porque: 'Desde a última reunião registrada.' },
      ...(base?.valor != null ? [{ rotulo: 'Mensalidade', valor: u.brl(base.valor), dinheiro: true, porque: 'Pelo contrato ou cadastro (só donos).' }] : []),
    ];
    const secoes = [
      s ? { titulo: 'A nota, ponto a ponto', texto: [perdas.length ? 'O que tira ponto da nota deste cliente e o que soma.' : 'Nada tira ponto da nota.'], tabela: perdas.length || bons.length ? { colunas: ['Motivo', 'Pontos'], linhas: [...perdas.map((m) => [m.texto, `−${Math.abs(m.pontos)}`]), ...bons.map((m) => [m.texto, `+${m.pontos}`])] } : null } : null,
      { titulo: 'As peças do cliente mês a mês', texto: [`${u.tendenciaTexto(a.hist.map((h) => h.entregues), { coisa: 'Prontas' }).texto}.`],
        grafico: { tipo: 'barras', rotulos: a.hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Prontas', valores: a.hist.map((h) => h.entregues), papel: 'pronto' }, { nome: 'Em aberto', valores: a.hist.map((h) => h.abertas), papel: 'aberto' }], empilhado: true },
        tabela: { colunas: ['Mês', 'Peças', 'Prontas', 'Atrasadas', 'No prazo'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas), h.noPrazoPct == null ? '—' : `${h.noPrazoPct}%`]) } },
      a.doPer.length ? { titulo: 'Peças do período', texto: ['Cada peça do cliente no período, na ordem da data.'],
        tabela: { colunas: ['Data', 'Peça', 'Formato', { rotulo: 'Status', status: true }, { rotulo: 'Com quem', pessoa: true }], linhas: a.doPer.slice().sort((x, y) => x.data.localeCompare(y.data)).slice(0, 30).map((x) => [u.dataCurta(x.data), String(x.d.nome || x.d.titulo || '').slice(0, 42), String(x.d.formato || '—'), String(x.d.status || ''), x.pessoas.join(', ').slice(0, 22)]) } } : null,
      a.porFormato.length ? { titulo: 'Formatos', texto: [`O que o cliente mais recebe: ${a.porFormato.slice(0, 3).map(([f, n]) => `${f} (${n})`).join(', ')}.`], grafico: { tipo: 'rosca', fatias: a.porFormato.slice(0, 6).map(([f, n], i) => ({ rotulo: f, valor: n, papel: ['destaque', 'neutro', 'neutro2', 'info', 'agente', 'ajuste'][i] })), centro: u.num(at.total), sub: 'peças' } } : null,
      rs.length ? { titulo: 'Reuniões', texto: ['As reuniões com o cliente, da mais recente para a mais antiga.'], tabela: { colunas: ['Data', 'Tipo', 'Título', 'Ata'], linhas: rs.slice(0, 10).map((r) => [u.dataBr(dia(r)), (reun?.tipos || {})[r.tipo] || r.tipo || '—', String(r.titulo || '').slice(0, 40), String(r.ata || '').trim().slice(0, 70) || '—']) } } : null,
    ].filter(Boolean);
    const prox = u.projetar(a.hist.map((h) => h.total), 2);
    const projecao = { texto: [a.ritmo?.projetado != null && at.total ? `No ritmo de agora, o período fecha com cerca de ${u.num(Math.min(Math.round(a.ritmo.projetado), at.total))} de ${u.num(at.total)} prontas.` : 'Sem período em curso para medir o ritmo.', `Pela tendência, os próximos dois meses ficam perto de ${prox.map((n) => u.num(Math.max(0, Math.round(n)))).join(' e ')} peças.`] };
    const recomendacoes = [];
    if (at.atrasadas) recomendacoes.push({ o_que: `Destravar as ${u.num(at.atrasadas)} atrasadas de ${c.nome}.`, por_que: at.furos ? `${u.num(at.furos)} já furaram a veiculação.` : 'Atraso tira ponto da nota e o cliente sente.', impacto: 'Nota e feed em dia.', prioridade: 'alta' });
    if (a.travas[0] && /cliente/i.test(a.travas[0][0])) recomendacoes.push({ o_que: `Cobrar de ${c.nome}, num lote só, o que falta para as peças andarem.`, por_que: `${u.plural(a.travas[0][1], 'peça espera', 'peças esperam')} o cliente.`, impacto: 'Peças voltam a andar.', prioridade: 'media' });
    if (diasUlt == null || diasUlt > 30) recomendacoes.push({ o_que: `Marcar a reunião do mês com ${c.nome}.`, por_que: diasUlt != null ? `A última foi há ${diasUlt} dias.` : 'Nenhuma reunião registrada.', impacto: 'Cliente vê o resultado e a relação esquenta.', prioridade: 'media' });
    if (s?.numeros?.diasContrato != null && s.numeros.diasContrato <= 60) recomendacoes.push({ o_que: `Preparar a renovação de ${c.nome}.`, por_que: `O contrato termina em ${s.numeros.diasContrato} dias.`, impacto: 'Renovação sem susto.', prioridade: s.risco === 'baixo' ? 'media' : 'alta' });
    if (perdas[0] && !recomendacoes.length) recomendacoes.push({ o_que: `Resolver "${perdas[0].texto}" com ${c.nome}.`, por_que: `Tira ${Math.abs(perdas[0].pontos)} pontos da nota.`, impacto: 'Nota sobe.', prioridade: 'media' });
    return fecha('cliente', { titulo: `Clientes · ${c.nome}`, subtitulo: 'A nota, as peças, as reuniões e o que fazer com este cliente', amostra: minhas, resumo, numeros, secoes, historico: null, projecao, recomendacoes,
      metodologia: ['A nota é a da Carteira (vybe-carteira-saude.js). As peças são as que têm este cliente, pela data dele (veiculação; sem ela, o prazo). Reuniões de area=reunioes do cliente.'] });
  }
  const ABAS_CLI = { carteira: abaCarteira, onboarding: abaOnboarding, reunioes: abaReunioes, cliente: abaCliente };
  // Cliente aberto na tela: o painel de detalhe visível e o nome em CLIENTE_ABERTO (global do index.html).
  function clienteAberto() {
    try {
      if (typeof document === 'undefined') return '';
      const painel = document.getElementById('panel-cliente-detalhe');
      if (!painel || painel.style.display === 'none' || !painel.getClientRects().length) return '';
      const nome = String(raiz.CLIENTE_ABERTO || (typeof CLIENTE_ABERTO !== 'undefined' ? CLIENTE_ABERTO : '') || ''); // eslint-disable-line no-undef
      const cad = lista(typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : raiz.CADASTRO_CLIENTES); // eslint-disable-line no-undef
      const c = cad.find((x) => x && x.nome === nome);
      return c ? String(c.id ?? c.nome) : '';
    } catch { return ''; }
  }
  const ABAS = [
    { id: 'carteira', nome: 'Saúde da carteira', telas: ['carteira'] },
    { id: 'onboarding', nome: 'Onboarding', telas: ['onboarding'] },
    { id: 'reunioes', nome: 'Reuniões', telas: ['reunioes'] },
    { id: 'cliente', nome: 'Um cliente', telas: ['clientes', 'setor:clientes'], seletor: () => Boolean(clienteAberto()), rotuloAlvo: 'Cliente',
      // O cadastro só carrega quando a tela de Clientes abre; antes disso, os clientes das peças (o id é o nome).
      alvos: (c) => { const cad = ativosDe(c); const l = cad.length ? cad.map((x) => ({ id: String(x.id ?? x.nome), nome: String(x.nome) }))
        : [...new Set(c.dados.pecas().flatMap((d) => lista(raiz.VybeRelPecas?.clientesDe?.(d))))].filter(Boolean).map((n) => ({ id: n, nome: n }));
      return l.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')); }, alvoDaTela: clienteAberto },
  ];
  async function relatorioComAbas(ctx) { return ctx.aba && ABAS_CLI[ctx.aba.id] ? ABAS_CLI[ctx.aba.id](ctx) : relatorio(ctx); }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('clientes', relatorioComAbas, { nome: 'Clientes', telas: ['setor:clientes', 'clientes', 'carteira', 'onboarding', 'reunioes'], agente: { nome: 'Mateus', papel: 'Atendimento ao cliente' }, abas: ABAS });
  raiz.VybeRelClientes = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
