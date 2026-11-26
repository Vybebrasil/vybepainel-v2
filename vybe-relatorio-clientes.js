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
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('clientes', relatorio, { nome: 'Clientes', telas: ['setor:clientes', 'clientes', 'carteira', 'onboarding', 'reunioes'], agente: { nome: 'Mateus', papel: 'Atendimento ao cliente' } });
  raiz.VybeRelClientes = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
