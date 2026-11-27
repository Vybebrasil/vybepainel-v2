// vybe-relatorio-midia.js — o relatório técnico da Mídia, pelo Ícaro (Mídia Paga). Paulo, 26/11/2026 (vybe-relatorio.js).
// Só os quatro donos (investimento é dinheiro: SO_DINHEIRO no vybe-mundo.js, pegarDono no servidor). Só leitura, pelas
// rotas que a tela já usa: GET /api/painel?area=midia&acao=carteira | cliente&dias=30 | historico | rotina.
// O VybeHub só entrega 7 ou 30 dias fechando ontem: o retrato é dos últimos 30 dias, qualquer que seja o período escolhido,
// e a tendência é das últimas 8 semanas dos clientes que mais investem. Google Ads e site ainda não têm fonte.
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const TOM = { r: 'Pede ação', a: 'Pede olho', g: 'Andando', n: 'Sem dado' };
  const MAX_CLIENTES = 40, MAX_HISTORICO = 5;

  async function emLotes(itens, n, fn) { const out = []; for (let i = 0; i < itens.length; i += n) out.push(...await Promise.all(itens.slice(i, i + n).map(fn))); return out; }

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo;
    const [cart, rotina] = await Promise.all([ctx.api('midia', { acao: 'carteira' }), ctx.api('midia', { acao: 'rotina' })]);
    const clientes = lista(cart?.clientes).slice(0, MAX_CLIENTES);
    const fichas = (await emLotes(clientes, 4, async (c) => ({ c, r: await ctx.api('midia', { acao: 'cliente', cliente_id: c.id, dias: 30 }) }))).map(({ c, r }) => ({ c, meta: r?.meta || { estado: 'erro' }, registros: lista(r?.registros) }));
    const comMeta = fichas.filter((f) => f.meta.estado === 'ok');
    const investido = comMeta.reduce((t, f) => t + (Number(f.meta.investido) || 0), 0);
    const investidoAnt = comMeta.reduce((t, f) => t + (Number(f.meta.investido_anterior) || 0), 0);
    const conversas = comMeta.reduce((t, f) => t + (Number(f.meta.conversas) || 0), 0);
    const sinal = (f) => f.meta.sinal?.tom || 'n';
    const vermelhos = fichas.filter((f) => sinal(f) === 'r'), ambar = fichas.filter((f) => sinal(f) === 'a');
    const semConta = fichas.filter((f) => f.meta.estado === 'sem_conta'), pagamento = fichas.filter((f) => f.meta.estado === 'pagamento');
    const topo = [...comMeta].sort((a, b) => (Number(b.meta.investido) || 0) - (Number(a.meta.investido) || 0));
    const semGoogle = clientes.filter((c) => !c.google_ads).length, semSite = clientes.filter((c) => !c.tem_site).length;
    // 8 semanas dos que mais investem.
    const hist = await emLotes(topo.slice(0, MAX_HISTORICO), 2, async (f) => ({ f, h: await ctx.api('midia', { acao: 'historico', cliente_id: f.c.id }) }));
    const semanas = new Map();
    for (const { h } of hist) for (const s of lista(h?.semanas)) {
      const x = semanas.get(s.de) || { de: s.de, investido: 0, resultados: 0 }; x.investido += Number(s.investido) || 0; x.resultados += Number(s.resultados) || 0; semanas.set(s.de, x);
    }
    const sem = [...semanas.values()].sort((a, b) => a.de.localeCompare(b.de));
    // Rotina do gestor: itens fixos de hoje, os feitos e os 7 dias.
    const fixos = lista(rotina?.fixos), feitos = new Set(lista(rotina?.checks).map((c) => c.chave));
    const pendentesRotina = fixos.filter((i) => !feitos.has(i.chave));
    const dias7 = lista(rotina?.historico), diasComCheck = dias7.filter((d) => d.feitos > 0).length;
    const cpr = (m) => (m.custo_resultado != null ? `${u.brl(m.custo_resultado)}${m.tipo_resultado ? ` / ${String(m.tipo_resultado).toLowerCase()}` : ''}` : '—');

    const resumo = [];
    if (!cart) resumo.push('A leitura da Mídia não respondeu agora (ou a sessão não é de dono): o relatório saiu sem os números do Meta.');
    else resumo.push(comMeta.length ? `Nos últimos 30 dias, ${u.plural(comMeta.length, 'cliente investiu', 'clientes investiram')} ${u.brl(investido)} no Meta${investidoAnt ? ` (${u.variacao(investido, investidoAnt, '', { contra: 'sobre os 30 dias anteriores' }).texto})` : ''}, com ${u.num(conversas)} conversas.` : `Nenhum dos ${u.num(clientes.length)} clientes ativos trouxe números do Meta agora.`);
    if (vermelhos.length) resumo.push(`${u.plural(vermelhos.length, 'conta pede', 'contas pedem')} ação: ${vermelhos.slice(0, 3).map((f) => `${f.c.nome} (${String(f.meta.sinal?.motivo || '').replace(/\.$/, '').toLowerCase()})`).join('; ')}.`);
    if (ambar.length) resumo.push(`${u.plural(ambar.length, 'conta pede', 'contas pedem')} olho, a maioria por frequência ou custo subindo.`);
    if (semConta.length || pagamento.length) resumo.push(`${u.plural(semConta.length, 'cliente está', 'clientes estão')} sem conta de anúncios ligada no VybeHub${pagamento.length ? ` e ${u.plural(pagamento.length, 'conta está', 'contas estão')} com pagamento pendente` : ''}.`);
    if (rotina) resumo.push(`Rotina do gestor: ${u.num(fixos.length - pendentesRotina.length)} de ${u.num(fixos.length)} itens de hoje feitos; ${u.num(diasComCheck)} dos últimos 7 dias tiveram check.`);

    const numeros = [
      { rotulo: 'Investido no Meta (30 dias)', valor: comMeta.length ? u.brl(investido) : 'sem dado', variacao: investidoAnt ? u.variacao(investido, investidoAnt, '', { contra: 'vs 30 dias anteriores' }) : null, porque: 'Soma do investido de todos os clientes com conta ligada no VybeHub.' },
      { rotulo: 'Conversas', valor: u.num(conversas), porque: 'Conversas iniciadas pelos anúncios no período.' },
      { rotulo: 'Contas que pedem ação', valor: u.num(vermelhos.length), porque: 'Verba parou, custo por resultado subiu 40% ou mais, ou investiu sem resultado.' },
      { rotulo: 'Contas que pedem olho', valor: u.num(ambar.length), porque: 'Frequência acima de 3 ou custo subindo 20% ou mais.' },
      { rotulo: 'Sem conta ligada', valor: u.num(semConta.length), porque: 'Cliente ativo sem conta de anúncios no VybeHub: canal a conectar.' },
      { rotulo: 'Rotina de hoje', valor: rotina ? `${u.num(fixos.length - pendentesRotina.length)} de ${u.num(fixos.length)}` : 'sem dado', porque: 'Itens fixos da cadência do gestor (gasto, pagamento, reprovados, resumo, revisão, mês).' },
    ];
    const secoes = [
      { titulo: 'Investimento por cliente', texto: [topo[0] ? `Quem mais investe: ${topo.slice(0, 3).map((f) => `${f.c.nome} (${u.brl(f.meta.investido)})`).join(', ')}.` : 'Sem investimento registrado.'],
        grafico: topo.length ? { tipo: 'ranking', de: 'cliente', itens: topo.slice(0, 12).map((f) => ({ rotulo: f.c.nome, valor: Math.round(Number(f.meta.investido) || 0), sub: TOM[sinal(f)], tom: sinal(f) === 'r' ? 'ruim' : sinal(f) === 'g' ? 'bom' : '' })), formato: (n) => u.brl(n) } : null,
        tabela: topo.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Investido', 'Antes', 'Resultados', 'Custo por resultado', 'Frequência', 'Sinal'], linhas: topo.map((f) => [f.c.nome, u.brl(f.meta.investido), f.meta.investido_anterior != null ? u.brl(f.meta.investido_anterior) : '—', u.num(f.meta.resultados), cpr(f.meta), f.meta.frequencia != null ? u.num(f.meta.frequencia, 1) : '—', TOM[sinal(f)]]) } : null },
      { titulo: 'O que o Ícaro acendeu', texto: vermelhos.length || ambar.length ? ['A conta que pede ação primeiro, com o motivo.'] : ['Nenhuma conta pedindo ação ou olho.'],
        tabela: vermelhos.length || ambar.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Sinal', 'Motivo'], linhas: [...vermelhos, ...ambar].map((f) => [f.c.nome, TOM[sinal(f)], String(f.meta.sinal?.motivo || '')]) } : null },
      { titulo: 'Campanhas que mais gastaram', texto: ['As campanhas de cada cliente no período, pelo investido.'],
        tabela: (() => { const cs = comMeta.flatMap((f) => lista(f.meta.campanhas).map((c) => ({ ...c, cliente: f.c.nome }))).sort((a, b) => b.investido - a.investido).slice(0, 15); return cs.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Campanha', 'Investido', 'Resultados', 'Custo por resultado', 'CTR'], linhas: cs.map((c) => [c.cliente, String(c.nome).slice(0, 40), u.brl(c.investido), u.num(c.resultados), cpr(c), c.ctr != null ? `${u.num(c.ctr, 2)}%` : '—']) } : null; })() },
      { titulo: 'Canais e contas', texto: [`Meta: ${u.num(comMeta.length)} com número, ${u.num(semConta.length)} sem conta ligada, ${u.num(pagamento.length)} com pagamento pendente. Google Ads: ${u.num(clientes.length - semGoogle)} IDs salvos, ainda sem leitura. Site: ${u.num(clientes.length - semSite)} endereços salvos, ainda sem análise.`],
        grafico: clientes.length ? { tipo: 'barras', rotulos: ['Meta com número', 'Sem conta', 'Pagamento', 'Google salvo', 'Site salvo'], series: [{ nome: 'Clientes', valores: [comMeta.length, semConta.length, pagamento.length, clientes.length - semGoogle, clientes.length - semSite] }] } : null },
      { titulo: 'Rotina do gestor', texto: [rotina ? (pendentesRotina.length ? `Falta hoje: ${pendentesRotina.map((i) => i.titulo.toLowerCase()).join('; ')}.` : 'Tudo da rotina de hoje feito.') : 'A rotina não respondeu.'],
        grafico: dias7.length ? { tipo: 'barras', rotulos: [...dias7].reverse().map((d) => u.dataCurta(d.dia)), series: [{ nome: 'Checks', valores: [...dias7].reverse().map((d) => d.feitos) }] } : null,
        tabela: dias7.length ? { colunas: ['Dia', 'Checks', 'Quem'], linhas: dias7.map((d) => [u.dataCurta(d.dia), u.num(d.feitos), lista(d.quem).join(', ') || '—']) } : null },
    ];
    const historico = sem.length >= 3
      ? { texto: [`Investido e resultados por semana dos ${u.num(hist.length)} clientes que mais investem (o VybeHub guarda 8 semanas). ${u.tendenciaTexto(sem.map((s) => s.investido), { coisa: 'Tendência do investimento', melhor: '' }).texto}.`],
        grafico: { tipo: 'area', rotulos: sem.map((s) => u.dataCurta(s.de)), series: [{ nome: 'Investido (R$)', valores: sem.map((s) => Math.round(s.investido)) }], formato: (n) => u.brl(n) },
        tabela: { colunas: ['Semana de', 'Investido', 'Resultados'], linhas: sem.map((s) => [u.dataCurta(s.de), u.brl(s.investido), u.num(s.resultados)]) } }
      : { texto: ['Sem semanas suficientes do VybeHub para a tendência.'] };
    const proxS = sem.length >= 3 ? u.projetar(sem.map((s) => s.investido), 4) : null;
    const projecao = { texto: [proxS ? `Se o ritmo das 8 semanas seguir, as próximas 4 semanas somam cerca de ${u.brl(proxS.reduce((t, v) => t + Math.max(0, v), 0))} nesses clientes.` : 'Sem semanas suficientes para projetar.', comMeta.length ? `No ritmo dos últimos 30 dias (${u.brl(investido / 30)} por dia), o período escolhido (${per.rotulo}) soma perto de ${u.brl((investido / 30) * (u.diasEntre(per.inicio, per.fim) + 1))}.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (pagamento.length) recomendacoes.push({ o_que: `Resolver o pagamento das contas de ${pagamento.map((f) => f.c.nome).join(', ')}.`, por_que: 'Conta com pagamento pendente para de entregar no mesmo dia.', impacto: 'Anúncios voltam a rodar.', prioridade: 'alta' });
    for (const f of vermelhos.slice(0, 3)) recomendacoes.push({ o_que: `Revisar a conta de ${f.c.nome}.`, por_que: String(f.meta.sinal?.motivo || 'O Ícaro acendeu vermelho.'), impacto: `Verba de ${u.brl(f.meta.investido)} em 30 dias trabalhando melhor.`, prioridade: 'alta' });
    if (ambar.some((f) => Number(f.meta.frequencia) > 3)) recomendacoes.push({ o_que: `Trocar o criativo onde a frequência passou de 3 (${ambar.filter((f) => Number(f.meta.frequencia) > 3).map((f) => f.c.nome).slice(0, 4).join(', ')}).`, por_que: 'O público está vendo o mesmo anúncio demais: o custo sobe a seguir.', impacto: 'Custo por resultado contido.', prioridade: 'media' });
    if (semConta.length) recomendacoes.push({ o_que: `Ligar a conta de anúncios no VybeHub de ${u.num(semConta.length)} clientes.`, por_que: 'Sem a conta ligada, ninguém vê se a mídia deles anda.', impacto: 'Carteira inteira na rotina do gestor.', prioridade: 'media' });
    if (pendentesRotina.length) recomendacoes.push({ o_que: `Fechar a rotina de hoje: ${pendentesRotina.slice(0, 3).map((i) => i.titulo.toLowerCase()).join('; ')}.`, por_que: 'A cadência diária é o que pega gasto fora do normal antes de virar prejuízo.', impacto: 'Problema visto no dia, não na semana.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a revisão semanal de criativos e verba.', por_que: 'As contas estão andando.', impacto: 'Custo estável.', prioridade: 'baixa' });
    return { titulo: 'Mídia', subtitulo: 'Investimento, resultado e sinais do Meta por cliente, canais e a rotina do gestor', resumo: resumo.slice(0, 5), numeros, secoes, historico, projecao, recomendacoes, dinheiro: true,
      metodologia: ['Meta Ads pelo VybeHub (a mesma ponte do bot): últimos 30 dias fechando ontem, contra os 30 anteriores; o VybeHub não entrega outro intervalo, então o período escolhido vale para a projeção.', 'Sinal do Ícaro: vermelho se a verba parou, o custo por resultado subiu 40% ou mais ou investiu sem resultado; âmbar se a frequência passou de 3 ou o custo subiu 20%. Google Ads e site ainda não têm leitura.'] };
  }
  // ---------- As subabas (Paulo, 27/11/2026): Hoje (rotina), Carteira de contas, Investimento e um cliente ----------
  const cprDe = (u, m) => (m?.custo_resultado != null ? `${u.brl(m.custo_resultado)}${m.tipo_resultado ? ` / ${String(m.tipo_resultado).toLowerCase()}` : ''}` : '—');
  const fechaMd = (aba, rel) => ({ ...rel, aba, dinheiro: true, resumo: lista(rel.resumo).filter(Boolean).slice(0, 5),
    recomendacoes: lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Manter a revisão semanal de criativos e verba.', por_que: 'Nada pede ação pelos números lidos.', impacto: 'Custo estável.', prioridade: 'baixa' }] });
  async function fichasDe(ctx, cart) {
    const clientes = lista(cart?.clientes).slice(0, MAX_CLIENTES);
    return (await emLotes(clientes, 4, async (c) => ({ c, r: await ctx.api('midia', { acao: 'cliente', cliente_id: c.id, dias: 30 }) }))).map(({ c, r }) => ({ c, meta: r?.meta || { estado: 'erro' } }));
  }
  const tomDe = (f) => f.meta.sinal?.tom || 'n';

  async function abaHoje(ctx) {
    const u = ctx.util, [rotina, cart] = await Promise.all([ctx.api('midia', { acao: 'rotina' }), ctx.api('midia', { acao: 'carteira' })]);
    const fichas = await fichasDe(ctx, cart), nomeDe = new Map(fichas.map((f) => [String(f.c.id), f.c.nome]));
    const fixos = lista(rotina?.fixos), feitos = new Set(lista(rotina?.checks).map((c) => c.chave)), pend = fixos.filter((i) => !feitos.has(i.chave));
    const porCad = u.contarPor(fixos, (i) => ({ dia: 'Todo dia', semana: 'Toda semana', mes: 'Todo mês' }[i.cadencia] || 'Outra'));
    const dias7 = lista(rotina?.historico), comCheck = dias7.filter((d) => d.feitos > 0).length;
    const alertas = lista(rotina?.alertas || rotina?.itens).filter((i) => i && i.cliente_id && String(i.cliente_id) !== '0');
    const acender = fichas.filter((f) => ['r', 'a'].includes(tomDe(f))).sort((a, b) => (tomDe(a) === 'r' ? 0 : 1) - (tomDe(b) === 'r' ? 0 : 1));
    const pag = fichas.filter((f) => f.meta.estado === 'pagamento');
    ctx.fonte('Rotina do gestor (area=midia&acao=rotina)', `${u.num(fixos.length)} itens fixos`);
    const resumo = [
      rotina ? `Hoje, ${u.num(fixos.length - pend.length)} de ${u.num(fixos.length)} itens da rotina do gestor estão feitos.` : 'A rotina do gestor não respondeu agora.',
      pend.length ? `Falta: ${pend.slice(0, 3).map((i) => i.titulo.toLowerCase()).join('; ')}${pend.length > 3 ? ` e mais ${pend.length - 3}` : ''}.` : rotina ? 'Nada da rotina pendente.' : '',
      dias7.length ? `${u.num(comCheck)} dos últimos ${u.num(dias7.length)} dias tiveram check.` : '',
      acender.length ? `O Ícaro acendeu ${u.plural(acender.length, 'conta', 'contas')} para olhar hoje: ${acender.slice(0, 3).map((f) => f.c.nome).join(', ')}.` : cart ? 'Nenhuma conta acesa para hoje.' : '',
      pag.length ? `${u.plural(pag.length, 'conta está', 'contas estão')} com pagamento pendente: a entrega para no mesmo dia.` : '',
    ];
    const numeros = [
      { rotulo: 'Rotina de hoje', valor: rotina ? `${u.num(fixos.length - pend.length)} de ${u.num(fixos.length)}` : 'sem dado', porque: 'Itens fixos da cadência do gestor de hoje, da semana e do mês.' },
      { rotulo: 'Pendentes', valor: u.num(pend.length), porque: 'Itens da rotina sem check.' },
      { rotulo: 'Dias com check (7)', valor: dias7.length ? `${u.num(comCheck)} de ${u.num(dias7.length)}` : 'sem dado', porque: 'Dias da última semana em que o gestor marcou algo.' },
      { rotulo: 'Contas para olhar', valor: u.num(acender.length), porque: 'Sinal vermelho ou âmbar do Ícaro.' },
      { rotulo: 'Pagamento pendente', valor: u.num(pag.length), porque: 'Conta com saldo ou cartão com problema.' },
    ];
    const secoes = [
      { titulo: 'A rotina de hoje', texto: ['Cada item fixo, a cadência e se já foi feito.'],
        tabela: fixos.length ? { colunas: ['Item', 'Cadência', 'Feito', 'Por quê'], linhas: fixos.map((i) => [i.titulo, ({ dia: 'dia', semana: 'semana', mes: 'mês' }[i.cadencia] || i.cadencia || '—'), feitos.has(i.chave) ? 'sim' : 'não', String(i.porque || '').slice(0, 80)]) } : null,
        grafico: porCad.length ? { tipo: 'barras', rotulos: porCad.map((x) => x[0]), series: [{ nome: 'Feitos', valores: porCad.map(([k]) => fixos.filter((i) => ({ dia: 'Todo dia', semana: 'Toda semana', mes: 'Todo mês' }[i.cadencia] || 'Outra') === k && feitos.has(i.chave)).length), papel: 'pronto' }, { nome: 'Faltam', valores: porCad.map(([k]) => fixos.filter((i) => ({ dia: 'Todo dia', semana: 'Toda semana', mes: 'Todo mês' }[i.cadencia] || 'Outra') === k && !feitos.has(i.chave)).length), papel: 'aberto' }], empilhado: true } : null },
      acender.length ? { titulo: 'Contas para olhar hoje', texto: ['O que pede ação primeiro, com o motivo do Ícaro.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Sinal', 'Motivo'], linhas: acender.map((f) => [f.c.nome, TOM[tomDe(f)], String(f.meta.sinal?.motivo || '')]) } } : null,
      alertas.length ? { titulo: 'Avisos por cliente', texto: ['O que a rotina levantou de cada cliente.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Aviso'], linhas: alertas.slice(0, 20).map((i) => [nomeDe.get(String(i.cliente_id)) || `Cliente ${i.cliente_id}`, String(i.titulo || i.texto || '')]) } } : null,
    ].filter(Boolean);
    const historico = dias7.length ? { texto: ['Checks da rotina nos últimos dias.'], grafico: { tipo: 'barras', rotulos: [...dias7].reverse().map((d) => u.dataCurta(d.dia)), series: [{ nome: 'Checks', valores: [...dias7].reverse().map((d) => d.feitos), papel: 'destaque' }] },
      tabela: { colunas: ['Dia', 'Checks', { rotulo: 'Quem', pessoa: true }], linhas: dias7.map((d) => [u.dataCurta(d.dia), u.num(d.feitos), lista(d.quem).join(', ') || '—']) } } : { texto: ['Sem histórico da rotina.'] };
    const recomendacoes = [];
    if (pag.length) recomendacoes.push({ o_que: `Resolver hoje o pagamento de ${pag.map((f) => f.c.nome).join(', ')}.`, por_que: 'A entrega para no mesmo dia.', impacto: 'Anúncios voltam a rodar.', prioridade: 'alta' });
    for (const f of acender.filter((x) => tomDe(x) === 'r').slice(0, 2)) recomendacoes.push({ o_que: `Abrir a conta de ${f.c.nome} antes do resto.`, por_que: String(f.meta.sinal?.motivo || 'Sinal vermelho.'), impacto: 'Verba parada ou cara corrigida no dia.', prioridade: 'alta' });
    if (pend.length) recomendacoes.push({ o_que: `Fechar a rotina: ${pend.slice(0, 3).map((i) => i.titulo.toLowerCase()).join('; ')}.`, por_que: 'A cadência pega gasto fora do normal antes de virar prejuízo.', impacto: 'Problema visto no dia.', prioridade: 'media' });
    return fechaMd('hoje', { titulo: 'Mídia · Hoje', subtitulo: 'A rotina do gestor de hoje e as contas que pedem olho', resumo, numeros, secoes, historico, projecao: null, recomendacoes,
      metodologia: ['Rotina de GET area=midia&acao=rotina (a mesma da tela Hoje). Sinal do Ícaro pela ficha de 30 dias de cada cliente (area=midia&acao=cliente).'] });
  }

  async function abaCarteira(ctx) {
    const u = ctx.util, cart = await ctx.api('midia', { acao: 'carteira' }), fichas = await fichasDe(ctx, cart), clientes = fichas.map((f) => f.c);
    const est = (e) => ({ ok: 'Com número', sem_conta: 'Sem conta ligada', pagamento: 'Pagamento pendente', sem_dados: 'Sem número no período', erro: 'Não respondeu' }[e] || e || 'Não respondeu');
    const porEstado = u.contarPor(fichas, (f) => est(f.meta.estado)), porTom = ['r', 'a', 'g', 'n'].map((t) => [TOM[t], fichas.filter((f) => tomDe(f) === t).length]);
    const semGoogle = clientes.filter((c) => !c.google_ads), semSite = clientes.filter((c) => !c.tem_site), canais = lista(cart?.canais);
    const freqAlta = fichas.filter((f) => Number(f.meta.frequencia) > 3);
    ctx.fonte('Carteira da Mídia (area=midia&acao=carteira)', `${u.num(clientes.length)} clientes`);
    const resumo = [
      cart ? `A carteira da Mídia tem ${u.plural(clientes.length, 'cliente', 'clientes')}: ${porEstado.map(([e, n]) => `${u.num(n)} ${e.toLowerCase()}`).join(', ')}.` : 'A carteira da Mídia não respondeu agora (ou a sessão não é de dono).',
      `Sinal do Ícaro: ${porTom.filter((x) => x[1]).map(([t, n]) => `${u.num(n)} ${t.toLowerCase()}`).join(', ') || 'nenhum'}.`,
      freqAlta.length ? `${u.plural(freqAlta.length, 'conta está', 'contas estão')} com frequência acima de 3: o público já viu o anúncio demais.` : '',
      clientes.length ? `Google Ads: ${u.num(clientes.length - semGoogle.length)} IDs salvos; site: ${u.num(clientes.length - semSite.length)} endereços salvos (ainda sem leitura).` : '',
    ];
    const numeros = [
      { rotulo: 'Clientes na Mídia', valor: u.num(clientes.length), porque: 'Clientes ativos na carteira da Mídia.' },
      { rotulo: 'Meta com número', valor: u.num(fichas.filter((f) => f.meta.estado === 'ok').length), porque: 'Conta ligada no VybeHub com números dos 30 dias.' },
      { rotulo: 'Sem conta ligada', valor: u.num(fichas.filter((f) => f.meta.estado === 'sem_conta').length), porque: 'Canal a conectar.' },
      { rotulo: 'Pedem ação', valor: u.num(porTom[0][1]), porque: 'Verba parou, custo subiu 40% ou investiu sem resultado.' },
      { rotulo: 'Pedem olho', valor: u.num(porTom[1][1]), porque: 'Frequência acima de 3 ou custo subindo 20%.' },
      { rotulo: 'Google Ads salvo', valor: `${u.num(clientes.length - semGoogle.length)} de ${u.num(clientes.length)}`, porque: 'ID salvo; a leitura ainda não existe.' },
    ];
    const secoes = [
      { titulo: 'Sinal de cada conta', texto: ['Quantas contas em cada sinal do Ícaro.'], grafico: fichas.length ? { tipo: 'rosca', fatias: porTom.map(([t, n], i) => ({ rotulo: t, valor: n, papel: ['atraso', 'risco', 'pronto', 'neutro'][i] })), centro: u.num(fichas.length), sub: 'contas' } : null,
        tabela: fichas.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Conta', 'Sinal', 'Frequência', 'Custo por resultado', 'Motivo'], linhas: fichas.map((f) => [f.c.nome, est(f.meta.estado), TOM[tomDe(f)], f.meta.frequencia != null ? u.num(f.meta.frequencia, 1) : '—', cprDe(u, f.meta), String(f.meta.sinal?.motivo || '—').slice(0, 60)]) } : null },
      { titulo: 'Contas ligadas', texto: ['O estado da conta de cada cliente no VybeHub.'], grafico: porEstado.length ? { tipo: 'barras', rotulos: porEstado.map((x) => x[0]), series: [{ nome: 'Clientes', valores: porEstado.map((x) => x[1]), papel: 'destaque' }] } : null },
      { titulo: 'Canais', texto: canais.length ? canais.map((c) => `${c.nome}: ${c.fonte ? `lido pelo ${c.fonte}` : String(c.falta || 'sem fonte')}`) : ['Sem a lista de canais.'],
        tabela: clientes.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Google Ads', 'Site'], linhas: clientes.map((c) => [c.nome, c.google_ads ? 'ID salvo' : '—', c.tem_site ? String(c.site || 'salvo').slice(0, 36) : '—']) } : null },
    ];
    const recomendacoes = [];
    const semConta = fichas.filter((f) => f.meta.estado === 'sem_conta');
    if (semConta.length) recomendacoes.push({ o_que: `Ligar a conta de anúncios de ${semConta.slice(0, 4).map((f) => f.c.nome).join(', ')}${semConta.length > 4 ? ` e mais ${semConta.length - 4}` : ''} no VybeHub.`, por_que: 'Sem a conta ligada ninguém vê se a mídia anda.', impacto: 'Carteira inteira na rotina do gestor.', prioridade: 'media' });
    if (freqAlta.length) recomendacoes.push({ o_que: `Trocar o criativo de ${freqAlta.slice(0, 4).map((f) => f.c.nome).join(', ')}.`, por_que: 'Frequência acima de 3: o custo sobe a seguir.', impacto: 'Custo por resultado contido.', prioridade: 'media' });
    if (porTom[0][1]) recomendacoes.push({ o_que: `Revisar as ${u.num(porTom[0][1])} contas em vermelho.`, por_que: 'Verba parada, custo alto ou investimento sem resultado.', impacto: 'Verba trabalhando.', prioridade: 'alta' });
    return fechaMd('carteira', { titulo: 'Mídia · Carteira de contas', subtitulo: 'As contas de anúncio de cada cliente: ligada, sinal do Ícaro e canais', resumo, numeros, secoes, historico: null, projecao: null, recomendacoes,
      metodologia: ['Carteira de GET area=midia&acao=carteira; o estado e o sinal de cada conta pela ficha de 30 dias (area=midia&acao=cliente&dias=30).'] });
  }

  async function abaInvestimento(ctx) {
    const u = ctx.util, per = ctx.periodo, cart = await ctx.api('midia', { acao: 'carteira' }), fichas = await fichasDe(ctx, cart);
    const comMeta = fichas.filter((f) => f.meta.estado === 'ok'), topo = [...comMeta].sort((a, b) => (Number(b.meta.investido) || 0) - (Number(a.meta.investido) || 0));
    const soma = (k) => comMeta.reduce((t, f) => t + (Number(f.meta[k]) || 0), 0), inv = soma('investido'), invA = soma('investido_anterior'), res = soma('resultados'), resA = soma('resultados_anterior');
    const tipoMais = u.contarPor(comMeta, (f) => f.meta.tipo_resultado || null)[0]?.[0] || null, doTipo = comMeta.filter((f) => (f.meta.tipo_resultado || null) === tipoMais);
    const somaT = (k) => doTipo.reduce((t, f) => t + (Number(f.meta[k]) || 0), 0), resT = somaT('resultados'), resTA = somaT('resultados_anterior');
    const cpr = resT ? somaT('investido') / resT : null, cprA = resTA ? somaT('investido_anterior') / resTA : null;
    const nomeTipo = ({ messages: 'mensagem', reach: 'pessoa alcançada', profile_visits: 'visita ao perfil', leads: 'cadastro', purchases: 'compra', link_clicks: 'clique' })[tipoMais] || String(tipoMais || 'resultado').toLowerCase();
    const camp = comMeta.flatMap((f) => lista(f.meta.campanhas).map((c) => ({ ...c, cliente: f.c.nome }))).sort((a, b) => b.investido - a.investido);
    const porObj = new Map(); for (const c of camp) { const k = ({ ENGAGEMENT: 'Engajamento e mensagens', SALES: 'Vendas', AWARENESS: 'Reconhecimento', TRAFFIC: 'Tráfego', LEADS: 'Cadastros', APP_PROMOTION: 'App' })[String(c.objetivo || '').replace(/^OUTCOME_/, '')] || 'Sem objetivo'; const x = porObj.get(k) || { k, inv: 0, res: 0 }; x.inv += Number(c.investido) || 0; x.res += Number(c.resultados) || 0; porObj.set(k, x); }
    const objs = [...porObj.values()].sort((a, b) => b.inv - a.inv);
    const hist = await emLotes(topo.slice(0, MAX_HISTORICO), 2, async (f) => ({ f, h: await ctx.api('midia', { acao: 'historico', cliente_id: f.c.id }) }));
    const semanas = new Map(); for (const { h } of hist) for (const s of lista(h?.semanas)) { const x = semanas.get(s.de) || { de: s.de, investido: 0, resultados: 0 }; x.investido += Number(s.investido) || 0; x.resultados += Number(s.resultados) || 0; semanas.set(s.de, x); }
    const sem = [...semanas.values()].sort((a, b) => a.de.localeCompare(b.de)), proxS = sem.length >= 3 ? u.projetar(sem.map((s) => s.investido), 4) : null;
    const subiu = comMeta.filter((f) => f.meta.custo_anterior && f.meta.custo_resultado && f.meta.custo_resultado >= f.meta.custo_anterior * 1.2);
    ctx.fonte('Investimento do Meta (VybeHub, 30 dias)', `${u.num(comMeta.length)} clientes com número, ${u.num(camp.length)} campanhas`);
    const resumo = [
      comMeta.length ? `Nos últimos 30 dias, ${u.brl(inv)} investidos no Meta em ${u.plural(comMeta.length, 'cliente', 'clientes')}${invA ? ` (${u.variacao(inv, invA, '', { contra: 'sobre os 30 dias anteriores' }).texto})` : ''}, com ${u.num(res)} resultados.` : 'Nenhum cliente trouxe números do Meta agora.',
      cpr != null ? `Custo médio por ${nomeTipo} de ${u.brl(cpr)} nas ${u.num(doTipo.length)} contas que buscam ${nomeTipo}${cprA != null ? ` (era ${u.brl(cprA)})` : ''}.` : '',
      topo[0] ? `Quem mais investe: ${topo.slice(0, 3).map((f) => `${f.c.nome} (${u.brl(f.meta.investido)})`).join(', ')}; os três somam ${u.pct(topo.slice(0, 3).reduce((t, f) => t + Number(f.meta.investido || 0), 0), inv)}% da verba.` : '',
      objs[0] ? `Por objetivo, ${objs[0].k.toLowerCase()} leva a maior parte (${u.brl(objs[0].inv)}).` : '',
      subiu.length ? `${u.plural(subiu.length, 'cliente viu', 'clientes viram')} o custo por resultado subir 20% ou mais: ${subiu.slice(0, 3).map((f) => f.c.nome).join(', ')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Investido (30 dias)', valor: comMeta.length ? u.brl(inv) : 'sem dado', variacao: invA ? u.variacao(inv, invA, '', { contra: 'vs 30 dias anteriores' }) : null, porque: 'Soma de todos os clientes com conta ligada.' },
      { rotulo: 'Resultados', valor: u.num(res), variacao: resA ? u.variacao(res, resA, 'maior', { contra: 'vs 30 dias anteriores' }) : null, porque: 'Soma do resultado de cada conta (mensagem, alcance, visita): tipos diferentes.' },
      { rotulo: `Custo por ${nomeTipo}`, valor: cpr != null ? u.brl(cpr) : '—', variacao: cpr != null && cprA != null ? u.variacao(Math.round(cpr * 100) / 100, Math.round(cprA * 100) / 100, 'menor', { contra: 'vs 30 dias anteriores' }) : null, porque: `Só as contas cujo resultado é ${nomeTipo}, o tipo mais comum.` },
      { rotulo: 'Campanhas ativas', valor: u.num(camp.length), porque: 'Campanhas com gasto nos 30 dias.' },
      { rotulo: 'Por dia', valor: comMeta.length ? u.brl(inv / 30) : '—', porque: 'Ritmo médio dos 30 dias.' },
    ];
    const secoes = [
      { titulo: 'Investimento por cliente', texto: ['Quanto cada cliente investiu e o custo por resultado.'],
        grafico: topo.length ? { tipo: 'ranking', de: 'cliente', itens: topo.slice(0, 12).map((f) => ({ rotulo: f.c.nome, valor: Math.round(Number(f.meta.investido) || 0), sub: cprDe(u, f.meta) })), formato: (n) => u.brl(n) } : null,
        tabela: topo.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Investido', 'Antes', 'Resultados', 'Custo por resultado', 'Custo antes'], linhas: topo.map((f) => [f.c.nome, u.brl(f.meta.investido), f.meta.investido_anterior != null ? u.brl(f.meta.investido_anterior) : '—', u.num(f.meta.resultados), cprDe(u, f.meta), f.meta.custo_anterior != null ? u.brl(f.meta.custo_anterior) : '—']) } : null },
      objs.length ? { titulo: 'Por objetivo de campanha', texto: ['Onde a verba vai: mensagens, venda, alcance, tráfego.'], grafico: { tipo: 'rosca', fatias: objs.slice(0, 6).map((o, i) => ({ rotulo: o.k, valor: Math.round(o.inv), papel: ['destaque', 'info', 'agente', 'neutro', 'neutro2', 'ajuste'][i] })), centro: u.brl(inv), sub: '30 dias', formato: (n) => u.brl(n) },
        tabela: { colunas: ['Objetivo', 'Investido', 'Resultados', 'Custo por resultado'], linhas: objs.map((o) => [o.k, u.brl(o.inv), u.num(o.res), o.res ? u.brl(o.inv / o.res) : '—']) } } : null,
      camp.length ? { titulo: 'Campanhas que mais gastaram', texto: ['As 15 campanhas de maior investimento.'], tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Campanha', 'Investido', 'Resultados', 'Custo por resultado', 'CTR'], linhas: camp.slice(0, 15).map((c) => [c.cliente, String(c.nome).slice(0, 40), u.brl(c.investido), u.num(c.resultados), cprDe(u, c), c.ctr != null ? `${u.num(c.ctr, 2)}%` : '—']) } } : null,
    ].filter(Boolean);
    const historico = sem.length >= 3 ? { texto: [`Investido por semana dos ${u.num(hist.length)} clientes que mais investem (o VybeHub guarda 8 semanas). ${u.tendenciaTexto(sem.map((s) => s.investido), { coisa: 'Tendência', melhor: '' }).texto}.`],
      grafico: { tipo: 'area', rotulos: sem.map((s) => u.dataCurta(s.de)), series: [{ nome: 'Investido (R$)', valores: sem.map((s) => Math.round(s.investido)) }], formato: (n) => u.brl(n) },
      tabela: { colunas: ['Semana de', 'Investido', 'Resultados', 'Custo por resultado'], linhas: sem.map((s) => [u.dataCurta(s.de), u.brl(s.investido), u.num(s.resultados), s.resultados ? u.brl(s.investido / s.resultados) : '—']) } } : { texto: ['Sem semanas suficientes do VybeHub para a tendência.'] };
    const projecao = { texto: [proxS ? `No ritmo das últimas semanas, as próximas 4 somam cerca de ${u.brl(proxS.reduce((t, v) => t + Math.max(0, v), 0))} nesses clientes.` : 'Sem semanas suficientes para projetar.', comMeta.length ? `No ritmo dos 30 dias, o período escolhido (${per.rotulo}) soma perto de ${u.brl((inv / 30) * (u.diasEntre(per.inicio, per.fim) + 1))}.` : ''].filter(Boolean) };
    const recomendacoes = [];
    for (const f of subiu.slice(0, 3)) recomendacoes.push({ o_que: `Rever criativo e público de ${f.c.nome}.`, por_que: `O custo por resultado foi de ${u.brl(f.meta.custo_anterior)} para ${u.brl(f.meta.custo_resultado)}.`, impacto: 'Mais resultado pela mesma verba.', prioridade: 'alta' });
    const caras = camp.filter((c) => cpr != null && (c.tipo_resultado || tipoMais) === tipoMais && c.custo_resultado > cpr * 1.5 && c.investido > inv * 0.02).slice(0, 2);
    for (const c of caras) recomendacoes.push({ o_que: `Mover verba da campanha "${String(c.nome).slice(0, 40)}" (${c.cliente}).`, por_que: `Custo por resultado de ${u.brl(c.custo_resultado)}, bem acima da média de ${u.brl(cpr)}.`, impacto: 'Verba onde o resultado sai mais barato.', prioridade: 'media' });
    return fechaMd('investimento', { titulo: 'Mídia · Investimento', subtitulo: 'Quanto foi investido, em quê, o custo por resultado e para onde vai', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Meta Ads pelo VybeHub: últimos 30 dias fechando ontem, contra os 30 anteriores. Histórico semanal dos que mais investem (area=midia&acao=historico).'] });
  }

  let ultimosAlvos = [];
  async function abaCliente(ctx) {
    const u = ctx.util, alvo = ctx.aba.alvo;
    if (!alvo) throw new Error('Escolha o cliente do relatório.');
    const [f, h] = await Promise.all([ctx.api('midia', { acao: 'cliente', cliente_id: alvo.id, dias: 30 }), ctx.api('midia', { acao: 'historico', cliente_id: alvo.id })]);
    const m = f?.meta || { estado: 'erro' }, nome = f?.cliente?.nome || alvo.nome, camp = lista(m.campanhas).slice().sort((a, b) => b.investido - a.investido), sem = lista(h?.semanas);
    const tom = m.sinal?.tom || 'n', ok = m.estado === 'ok';
    ctx.fonte(`Ficha de ${nome} (area=midia&acao=cliente, 30 dias)`, ok ? `${u.num(camp.length)} campanhas` : `estado: ${m.estado}`);
    if (sem.length) ctx.fonte(`Histórico de ${nome} (area=midia&acao=historico)`, `${u.num(sem.length)} semanas`);
    const resumo = [
      ok ? `${nome} investiu ${u.brl(m.investido)} no Meta nos últimos 30 dias${m.investido_anterior ? ` (${u.variacao(m.investido, m.investido_anterior, '', { contra: 'sobre os 30 anteriores' }).texto})` : ''}, com ${u.num(m.resultados)} resultados a ${cprDe(u, m)}.` : m.estado === 'sem_conta' ? `${nome} está sem conta de anúncios ligada no VybeHub.` : m.estado === 'pagamento' ? `A conta de ${nome} está com pagamento pendente.` : `A ficha de ${nome} não trouxe números agora.`,
      `Sinal do Ícaro: ${TOM[tom].toLowerCase()}${m.sinal?.motivo ? ` (${String(m.sinal.motivo).replace(/\.$/, '').toLowerCase()})` : ''}.`,
      ok && m.frequencia != null ? `Frequência ${u.num(m.frequencia, 1)}${Number(m.frequencia) > 3 ? ': o público já viu o anúncio demais' : ''}; alcance de ${u.num(m.alcance)} pessoas.` : '',
      camp[0] ? `A campanha que mais gasta é "${String(camp[0].nome).slice(0, 50)}" (${u.brl(camp[0].investido)}).` : '',
      m.melhor_anuncio ? `Melhor anúncio: ${m.melhor_anuncio.nome}.` : '',
    ];
    const numeros = [
      { rotulo: 'Investido (30 dias)', valor: ok ? u.brl(m.investido) : 'sem dado', variacao: ok && m.investido_anterior ? u.variacao(m.investido, m.investido_anterior, '', { contra: 'vs 30 dias anteriores' }) : null, porque: 'Pelo VybeHub, fechando ontem.' },
      { rotulo: 'Resultados', valor: ok ? u.num(m.resultados) : '—', variacao: ok && m.resultados_anterior ? u.variacao(m.resultados, m.resultados_anterior, 'maior', { contra: 'vs 30 dias anteriores' }) : null, porque: m.tipo_resultado ? `Tipo: ${String(m.tipo_resultado).toLowerCase()}.` : 'O resultado da campanha.' },
      { rotulo: 'Custo por resultado', valor: ok ? cprDe(u, m) : '—', variacao: ok && m.custo_anterior ? u.variacao(m.custo_resultado, m.custo_anterior, 'menor', { contra: 'vs 30 dias anteriores' }) : null, porque: 'Investido dividido pelos resultados.' },
      { rotulo: 'Frequência', valor: ok && m.frequencia != null ? u.num(m.frequencia, 1) : '—', porque: 'Acima de 3, o público cansa.' },
      { rotulo: 'CTR', valor: ok && m.ctr != null ? `${u.num(m.ctr, 2)}%` : '—', porque: 'Cliques sobre impressões.' },
      { rotulo: 'CPM', valor: ok && m.cpm != null ? u.brl(m.cpm) : '—', porque: 'Custo de mil impressões.' },
    ];
    const secoes = [
      camp.length ? { titulo: 'Campanhas', texto: ['Cada campanha, o investido e o custo por resultado.'], grafico: { tipo: 'ranking', itens: camp.slice(0, 10).map((c) => ({ rotulo: String(c.nome).slice(0, 40), valor: Math.round(c.investido), sub: cprDe(u, c) })), formato: (n) => u.brl(n) },
        tabela: { colunas: ['Campanha', 'Investido', 'Resultados', 'Custo por resultado', 'Frequência', 'CTR'], linhas: camp.map((c) => [String(c.nome).slice(0, 44), u.brl(c.investido), u.num(c.resultados), cprDe(u, c), c.frequencia != null ? u.num(c.frequencia, 1) : '—', c.ctr != null ? `${u.num(c.ctr, 2)}%` : '—']) } } : { titulo: 'Campanhas', texto: ['Nenhuma campanha com gasto nos 30 dias.'] },
      m.melhor_anuncio ? { titulo: 'Melhor anúncio', texto: [`${m.melhor_anuncio.nome}${m.melhor_anuncio.campanha ? `, na campanha ${m.melhor_anuncio.campanha}` : ''}${m.melhor_anuncio.resultados != null ? `: ${u.num(m.melhor_anuncio.resultados)} resultados` : ''}${m.melhor_anuncio.custo_resultado != null ? ` a ${u.brl(m.melhor_anuncio.custo_resultado)}` : ''}.`] } : null,
    ].filter(Boolean);
    const historico = sem.length >= 2 ? { texto: [`Investido e resultados por semana. ${u.tendenciaTexto(sem.map((s) => s.custo_resultado ?? (s.resultados ? s.investido / s.resultados : 0)), { coisa: 'Custo por resultado', melhor: 'menor' }).texto}.`],
      grafico: { tipo: 'barras', rotulos: sem.map((s) => u.dataCurta(s.de)), series: [{ nome: 'Investido (R$)', valores: sem.map((s) => Math.round(s.investido)), papel: 'destaque' }], formato: (n) => u.brl(n) },
      tabela: { colunas: ['Semana de', 'Investido', 'Resultados', 'Custo por resultado'], linhas: sem.map((s) => [u.dataCurta(s.de), u.brl(s.investido), u.num(s.resultados), s.custo_resultado != null ? u.brl(s.custo_resultado) : '—']) } } : { texto: ['Sem semanas guardadas no VybeHub.'] };
    const prox = sem.length >= 3 ? u.projetar(sem.map((s) => s.investido), 4) : null;
    const projecao = { texto: [prox ? `No ritmo das semanas, as próximas 4 somam cerca de ${u.brl(prox.reduce((t, v) => t + Math.max(0, v), 0))}.` : ok ? `No ritmo dos 30 dias, cerca de ${u.brl(m.investido / 30 * 28)} nas próximas 4 semanas.` : 'Sem número para projetar.'] };
    const recomendacoes = [];
    if (m.estado === 'pagamento') recomendacoes.push({ o_que: `Resolver o pagamento da conta de ${nome}.`, por_que: 'A entrega para no mesmo dia.', impacto: 'Anúncios voltam a rodar.', prioridade: 'alta' });
    if (m.estado === 'sem_conta') recomendacoes.push({ o_que: `Ligar a conta de anúncios de ${nome} no VybeHub.`, por_que: 'Sem a conta ninguém vê se a mídia anda.', impacto: 'Cliente na rotina do gestor.', prioridade: 'media' });
    if (tom === 'r') recomendacoes.push({ o_que: `Revisar a conta de ${nome} hoje.`, por_que: String(m.sinal?.motivo || 'Sinal vermelho do Ícaro.'), impacto: 'Verba trabalhando melhor.', prioridade: 'alta' });
    if (ok && Number(m.frequencia) > 3) recomendacoes.push({ o_que: 'Trocar o criativo das campanhas com frequência acima de 3.', por_que: `Frequência de ${u.num(m.frequencia, 1)}: o custo sobe a seguir.`, impacto: 'Custo por resultado contido.', prioridade: 'media' });
    const cara = camp.find((c) => m.custo_resultado && c.custo_resultado > m.custo_resultado * 1.2 && c.investido > m.investido * 0.05);
    if (cara) recomendacoes.push({ o_que: `Mover verba de "${String(cara.nome).slice(0, 40)}" para a campanha que sai mais barato.`, por_que: `Custo de ${u.brl(cara.custo_resultado)}, acima da média da conta (${u.brl(m.custo_resultado)}).`, impacto: 'Mais resultado pela mesma verba.', prioridade: 'media' });
    return fechaMd('cliente', { titulo: `Mídia · ${nome}`, subtitulo: 'O Meta deste cliente: investimento, campanhas, semanas e o que fazer', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Ficha de 30 dias e histórico semanal pelo VybeHub (area=midia&acao=cliente e acao=historico), a mesma da tela da Mídia.'] });
  }
  const ABAS_MD = { hoje: abaHoje, carteira: abaCarteira, investimento: abaInvestimento, cliente: abaCliente };
  // O que está aberto na janela da Mídia: a visão (Hoje ou Clientes) e, com a ficha aberta, o nome do cliente.
  const janelaMd = () => { try { const j = typeof document !== 'undefined' ? document.querySelector('.mdn-ficha-nome, [data-md-visao]')?.closest('[hidden]') : null; return !j; } catch { return false; } };
  const fichaAberta = () => { try { const n = document.querySelector('.mdn-ficha-nome'); return n && n.getClientRects().length ? n.textContent.trim() : ''; } catch { return ''; } };
  const visao = (v) => () => { try { return janelaMd() && !fichaAberta() && Boolean(document.querySelector(`[data-md-visao="${v}"][aria-checked="true"]`)); } catch { return false; } };
  const ABAS = [
    { id: 'hoje', nome: 'Hoje', telas: ['setor:midia', 'midia'], seletor: visao('hoje') },
    { id: 'carteira', nome: 'Carteira de contas', telas: ['setor:midia', 'midia'], seletor: visao('carteira') },
    { id: 'investimento', nome: 'Investimento', telas: ['setor:midia', 'midia'] },
    { id: 'cliente', nome: 'Um cliente', telas: ['setor:midia', 'midia'], seletor: () => Boolean(fichaAberta()), rotuloAlvo: 'Cliente',
      alvos: async (c) => { const r = await c.api('midia', { acao: 'carteira' }); ultimosAlvos = lista(r?.clientes).map((x) => ({ id: String(x.id), nome: String(x.nome) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); return ultimosAlvos; },
      alvoDaTela: () => { const n = fichaAberta(); return n ? (ultimosAlvos.find((x) => x.nome === n)?.id || '') : ''; } },
  ];
  async function relatorioComAbas(ctx) { return ctx.aba && ABAS_MD[ctx.aba.id] ? ABAS_MD[ctx.aba.id](ctx) : relatorio(ctx); }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('midia', relatorioComAbas, { nome: 'Mídia', telas: ['setor:midia', 'midia'], acesso: 'dinheiro', agente: { nome: 'Ícaro', papel: 'Mídia Paga' }, abas: ABAS });
  raiz.VybeRelMidia = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
