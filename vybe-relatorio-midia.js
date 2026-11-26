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
        grafico: topo.length ? { tipo: 'ranking', itens: topo.slice(0, 12).map((f) => ({ rotulo: f.c.nome, valor: Math.round(Number(f.meta.investido) || 0), sub: TOM[sinal(f)], tom: sinal(f) === 'r' ? 'ruim' : sinal(f) === 'g' ? 'bom' : '' })), formato: (n) => u.brl(n) } : null,
        tabela: topo.length ? { colunas: ['Cliente', 'Investido', 'Antes', 'Resultados', 'Custo por resultado', 'Frequência', 'Sinal'], linhas: topo.map((f) => [f.c.nome, u.brl(f.meta.investido), f.meta.investido_anterior != null ? u.brl(f.meta.investido_anterior) : '—', u.num(f.meta.resultados), cpr(f.meta), f.meta.frequencia != null ? u.num(f.meta.frequencia, 1) : '—', TOM[sinal(f)]]) } : null },
      { titulo: 'O que o Ícaro acendeu', texto: vermelhos.length || ambar.length ? ['A conta que pede ação primeiro, com o motivo.'] : ['Nenhuma conta pedindo ação ou olho.'],
        tabela: vermelhos.length || ambar.length ? { colunas: ['Cliente', 'Sinal', 'Motivo'], linhas: [...vermelhos, ...ambar].map((f) => [f.c.nome, TOM[sinal(f)], String(f.meta.sinal?.motivo || '')]) } : null },
      { titulo: 'Campanhas que mais gastaram', texto: ['As campanhas de cada cliente no período, pelo investido.'],
        tabela: (() => { const cs = comMeta.flatMap((f) => lista(f.meta.campanhas).map((c) => ({ ...c, cliente: f.c.nome }))).sort((a, b) => b.investido - a.investido).slice(0, 15); return cs.length ? { colunas: ['Cliente', 'Campanha', 'Investido', 'Resultados', 'Custo por resultado', 'CTR'], linhas: cs.map((c) => [c.cliente, String(c.nome).slice(0, 40), u.brl(c.investido), u.num(c.resultados), cpr(c), c.ctr != null ? `${u.num(c.ctr, 2)}%` : '—']) } : null; })() },
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
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('midia', relatorio, { nome: 'Mídia', telas: ['setor:midia', 'midia'], acesso: 'dinheiro', agente: { nome: 'Ícaro', papel: 'Mídia Paga' } });
  raiz.VybeRelMidia = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
