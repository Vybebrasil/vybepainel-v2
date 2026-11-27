// vybe-relatorio-financas-abas.js — o relatório de CADA subaba do Finanças (Paulo, 27/11/2026: "tem o relatório de PDF
// de Finanças, mas se eu quiser só o de Pessoas? Só o de Assinaturas?").
//
// Uma função por tela real do menu do Finanças (FE_ABAS de vybe-mundo-financeiro.js): Hoje, Movimento, Clientes, Pessoas,
// Assinaturas, Análise, Projeção e Fechamento. Cada uma monta o relatório inteiro daquela parte, no contrato do motor
// (vybe-relatorio.js): números-chave, gráficos, histórico, projeção quando houver, o que fazer e fontes. O Cartão mora no
// Movimento; o Orçamento e as Metas, na Análise (como na tela).
//
// Puro: recebe o GET de area=financeiro (o mesmo da tela, só leitura e só para os quatro donos: o servidor recusa os
// outros) e o ctx do motor. Tudo sai marcado `dinheiro` (o motor tira de quem não pode ver; o módulo inteiro já é dinheiro).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const ehMes = (m) => /^\d{4}-\d{2}$/.test(String(m || ''));
  const nomeMes = (m) => (ehMes(m) ? `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}` : '');
  const mesCurto = (m) => (ehMes(m) ? `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3)}/${m.slice(2, 4)}` : '');
  const cent = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const rs = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v) < 0 ? '−' : ''}R$ ${Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const rsCurto = (n) => `${n < 0 ? '−' : ''}R$ ${Math.round(Math.abs(n)).toLocaleString('pt-BR')}`;
  const n0 = (n) => Number(n || 0).toLocaleString('pt-BR');
  const pctTxt = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${String(Math.round(Number(v) * 10) / 10).replace('.', ',')}%`);
  const soma = (l, f = (x) => x) => cent(l.reduce((t, x) => t + (Number(f(x)) || 0), 0));
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
  const somarMeses = (ym, n) => { const [a, m] = String(ym).split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
  const PAGO_PESSOA = ['salario', 'pro_labore', 'adiantamento', 'freela', 'retirada_socio'];
  const PRIOR = { 3: 'alta', 2: 'media', 1: 'baixa', 0: 'baixa' };

  // O lançamento em pedaços (as partes de um lançamento dividido), como o pedacos() de shared/financeiro-extrato.js.
  function pedacos(t) {
    const b = t?.banco || {}, r = t?.real || {}, sinal = Number(b.valor) < 0 ? -1 : 1;
    const base = { id: t?.id, data: String(b.data || ''), historico: String(b.historico || ''), contraparte: String(b.contraparte || ''), status: r.status, conferido: Boolean(r.conferido) };
    if (lista(r.partes).length) return r.partes.map((p) => ({ ...base, valor: sinal * Math.abs(Number(p.valor) || 0), categoria: p.categoria || r.categoria, quem: p.quem || r.quem || '',
      cliente_nome: p.cliente_nome || '', pessoa_id: p.pessoa_id || '', pessoa_nome: p.pessoa_nome || '', competencia: p.competencia || r.competencia || base.data.slice(0, 7) }));
    return [{ ...base, valor: Number(b.valor) || 0, categoria: r.categoria, quem: r.quem || '', cliente_nome: r.cliente_nome || '', pessoa_id: r.pessoa_id || '', pessoa_nome: r.pessoa_nome || '',
      competencia: r.competencia || base.data.slice(0, 7) }];
  }

  // O que todas as abas usam: os meses do extrato, o mês do relatório, os meses do período e a janela do histórico.
  function base(d, ctx) {
    const per = ctx.periodo || {}, meses = [...new Set([...lista(d.meses), String(d.hoje || '').slice(0, 7)].filter(ehMes))].sort();
    const pedido = String(per.fim || '').slice(0, 7);
    const mes = meses.includes(pedido) ? pedido : meses.filter((m) => m <= pedido).pop() || meses[meses.length - 1] || pedido;
    const doPer = lista(per.meses).filter((m) => meses.includes(m));
    const janela = meses.filter((m) => m <= mes).slice(-Math.max(6, doPer.length));
    const cats = new Map(lista(d.categorias).map((c) => [c.id, c]));
    const partes = lista(d.transacoes).flatMap(pedacos);
    const doMes = (m) => partes.filter((p) => p.data.slice(0, 7) === m);
    const serie = new Map(lista(d.serie).map((s) => [s.mes, s]));
    const emAberto = mes === String(d.hoje || '').slice(0, 7);
    return { per, meses, mes, doPer: doPer.length ? doPer : [mes], janela, cats, partes, doMes, serie, emAberto, hoje: String(d.hoje || ctx.hoje || ''), an: d.analise || null };
  }
  const grupoDe = (b, cat) => b.cats.get(cat)?.grupo || 'Outros';
  const nomeCat = (b, cat) => b.cats.get(cat)?.nome || cat || 'Sem categoria';
  const varPct = (a, ant, melhor = 'maior', contra = 'vs mês anterior') => {
    if (a == null || ant == null || !Number(ant)) return null;
    const p = Math.round(((a - ant) / Math.abs(ant)) * 100), bom = p === 0 || !melhor ? null : (melhor === 'maior') === (p > 0);
    return { texto: `${p > 0 ? '▲ +' : p < 0 ? '▼ ' : '= '}${p}% ${contra}`, bom };
  };
  const linhaMeses = (b, series, extra = {}) => ({ tipo: 'linha', rotulos: b.janela.map(mesCurto), series, formato: rsCurto, ...extra });
  const barrasMeses = (b, series, extra = {}) => ({ tipo: 'barras', rotulos: b.janela.map(mesCurto), series, formato: rsCurto, ...extra });
  const semExtrato = (aba) => ({ aba, resumo: ['Sem extrato importado: esta tela do Finanças ainda não tem números.'], numeros: [], secoes: [{ titulo: 'Sem dados', texto: 'Importe o extrato da conta PJ no Finanças para esta parte ganhar números.', dinheiro: true }],
    recomendacoes: [{ o_que: 'Importar o extrato da conta PJ no Finanças.', por_que: 'Sem extrato não há o que analisar nesta tela.', impacto: 'Relatório com números.', prioridade: 'alta', dinheiro: true }] });
  const FONTE = { nome: 'Vybe OS · Finanças (area=financeiro)', detalhe: 'extrato da conta PJ com o lado real conferido, contratos e cadastros (só donos)' };
  // Fecha a aba: tudo marcado dinheiro e o mês no subtítulo.
  function fechar(aba, rel, b) {
    const din = (x) => (x && typeof x === 'object' ? { ...x, dinheiro: true } : x);
    return { aba, periodo: b.doPer.length > 1 ? `${nomeMes(b.doPer[0])} a ${nomeMes(b.doPer[b.doPer.length - 1])}` : nomeMes(b.mes), ...rel,
      resumo: lista(rel.resumo).filter(Boolean).slice(0, 5), numeros: lista(rel.numeros).map(din), secoes: lista(rel.secoes).filter(Boolean).map(din),
      historico: rel.historico ? din(rel.historico) : null, projecao: rel.projecao ? din(rel.projecao) : null,
      recomendacoes: (lista(rel.recomendacoes).length ? rel.recomendacoes : [{ o_que: 'Nada pede ação nesta tela agora: conferir de novo na semana que vem.', por_que: 'Os números lidos não mostram desvio.', impacto: 'Acompanhamento em dia.', prioridade: 'baixa' }]).map(din),
      fontes: [FONTE, ...lista(rel.fontes)].map(din) };
  }

  // ---------- Hoje: o mês em quatro perguntas (entrou, falta entrar, pagou, falta pagar) e o que pede atenção ----------
  function hoje(d, b) {
    const s = b.serie.get(b.mes) || {}, ant = b.serie.get(somarMeses(b.mes, -1)) || null;
    const pc = d.por_cliente || { meses: [], linhas: [] };
    const doMesCli = lista(pc.linhas).map((l) => ({ l, m: lista(l.meses).find((x) => x.mes === b.mes) })).filter((x) => x.m && !['sem', 'fora'].includes(x.m.situacao));
    const faltaCli = doMesCli.map(({ l, m }) => ({ nome: l.cliente_nome, v: cent((m.em_aberto || 0) + (m.a_receber || 0)), sit: m.situacao })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
    const faltaEntrar = soma(faltaCli, (x) => x.v);
    const fx = lista(d.fixos_analise?.fixos).filter((f) => !f.achado), faltaFixos = soma(fx, (f) => f.valor);
    const sal = lista(d.contas_pessoas).map((c) => { const m = lista(c.meses).find((x) => x.mes === b.mes); return { nome: c.nome, v: m ? (m.aberto ? m.falta_pagar || 0 : m.a_pagar || 0) : 0 }; }).filter((x) => x.v > 0);
    const faltaPagar = cent(faltaFixos + soma(sal, (x) => x.v));
    const saiu = cent((s.saidas || 0) + (s.cartao || 0)), saldo = s.saldo_final ?? null;
    const fecha = saldo != null && b.emAberto ? cent(saldo + faltaEntrar - faltaPagar) : null;
    const pend = lista(d.transacoes).filter((t) => !t.real?.conferido && String(t.banco?.data || '').startsWith(b.mes)).length;
    const achados = lista(b.an?.achados).slice().sort((x, y) => (y.g || 0) - (x.g || 0));
    const grupos = new Map(); for (const p of b.doMes(b.mes)) if (p.valor < 0) { const g = grupoDe(b, p.categoria); grupos.set(g, cent((grupos.get(g) || 0) - p.valor)); }
    const gruposL = [...grupos].sort((x, y) => y[1] - x[1]);
    const saldos = b.janela.map((m) => b.serie.get(m)?.saldo_final ?? null);
    const resumo = [
      `${nomeMes(b.mes).replace(/^./, (c) => c.toUpperCase())}${b.emAberto ? ', em aberto' : ''}: já entraram ${rs(s.entradas)} e já saíram ${rs(saiu)}${saldo != null ? `; o saldo no banco está em ${rs(saldo)}` : ''}.`,
      faltaEntrar || faltaPagar ? `Falta entrar ${rs(faltaEntrar)}${faltaCli.length ? ` de ${n0(faltaCli.length)} cliente(s), a maior parte de ${faltaCli[0].nome}` : ''} e falta pagar ${rs(faltaPagar)} em fixos e salários.` : 'Nada falta entrar nem pagar pelo que está cadastrado.',
      fecha != null ? `Se entrar e sair tudo o que falta, o mês fecha com ${rs(fecha)}${fecha < 0 ? ', no vermelho' : ''}.` : '',
      pend ? `${n0(pend)} lançamento(s) do mês ainda esperam o lado real: o número muda quando forem conferidos.` : 'Tudo do mês está conferido.',
      achados[0] ? `O ponto que mais pede atenção: ${String(achados[0].texto || achados[0].rot).replace(/\.$/, '')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Saldo no banco', valor: rs(saldo), variacao: ant ? varPct(saldo, ant.saldo_final) : null, porque: 'Último saldo do extrato importado no mês.' },
      { rotulo: 'Já entrou', valor: rs(s.entradas), variacao: ant ? varPct(s.entradas, ant.entradas) : null, porque: `Entradas do extrato no mês; falta entrar ${rs(faltaEntrar)} pela mensalidade de cada cliente.` },
      { rotulo: 'Já pagou', valor: rs(saiu), variacao: ant ? varPct(saiu, cent((ant.saidas || 0) + (ant.cartao || 0)), 'menor') : null, porque: `Saídas e pagamento de cartão do mês; falta pagar ${rs(faltaPagar)}.` },
      { rotulo: fecha != null ? 'Fecha o mês com' : 'Resultado do mês', valor: rs(fecha ?? s.resultado), porque: fecha != null ? 'Saldo + falta entrar − falta pagar.' : 'O que entrou − o que saiu.' },
      { rotulo: 'Sem conferir', valor: n0(pend), porque: 'Lançamentos do mês sem o lado real (categoria, cliente, pessoa).' },
      { rotulo: 'Pontos de atenção', valor: n0(achados.length), porque: 'Achados do Vorcaro: orçamento estourado, fixo que não apareceu, atraso.' },
    ];
    const secoes = [
      { titulo: 'O que falta entrar', texto: faltaCli.length ? `${n0(faltaCli.length)} cliente(s) ainda devem a mensalidade de ${nomeMes(b.mes)}, somando ${rs(faltaEntrar)}.` : 'Todos os clientes com mensalidade já pagaram o mês (ou não há mensalidade prevista).',
        grafico: faltaCli.length ? { tipo: 'ranking', de: 'cliente', itens: faltaCli.slice(0, 10).map((x) => ({ rotulo: x.nome, valor: x.v, sub: x.sit === 'aberto' ? 'em aberto' : x.sit === 'parcial' ? 'pagou parte' : 'a receber', tom: x.sit === 'aberto' ? 'ruim' : '' })), formato: rsCurto } : null,
        tabela: faltaCli.length ? { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Situação', 'Falta'], linhas: faltaCli.map((x) => [x.nome, x.sit === 'aberto' ? 'Em aberto' : x.sit === 'parcial' ? 'Pagou parte' : 'A receber', rs(x.v)]) } : null },
      { titulo: 'O que falta pagar', texto: fx.length || sal.length ? `Fixos que ainda não apareceram no extrato nem no cartão (${rs(faltaFixos)}) e o que falta dos salários (${rs(soma(sal, (x) => x.v))}).` : 'Nenhum fixo ou salário pendente no mês.',
        tabela: fx.length || sal.length ? { colunas: ['O quê', 'Vence', 'Valor'], linhas: [...sal.map((x) => [`Salário · ${x.nome}`, '—', rs(x.v)]), ...fx.map((f) => [f.nome, dataBr(f.vence), rs(f.valor)])] } : null },
      gruposL.length ? { titulo: 'Para onde foi o dinheiro do mês', texto: `As saídas de ${nomeMes(b.mes)} por grupo. O maior é ${gruposL[0][0]} (${rs(gruposL[0][1])}).`,
        grafico: { tipo: 'rosca', fatias: gruposL.slice(0, 7).map(([g, v], i) => ({ rotulo: g, valor: v, papel: `fe${(i % 6) + 1}` })), centro: rsCurto(soma(gruposL, (x) => x[1])), sub: 'saiu no mês', formato: rsCurto },
        tabela: { colunas: ['Grupo', 'Saiu', '%'], linhas: gruposL.map(([g, v]) => [g, rs(v), `${Math.round((v / (soma(gruposL, (x) => x[1]) || 1)) * 100)}%`]) } } : null,
      achados.length ? { titulo: 'Pontos de atenção do Vorcaro', texto: 'O que o Vorcaro achou nos números, do mais grave para o mais leve.',
        tabela: { colunas: ['Gravidade', 'O quê', 'Detalhe'], linhas: achados.slice(0, 12).map((a) => [a.g >= 3 ? 'Alta' : a.g >= 2 ? 'Média' : 'Baixa', a.rot, String(a.det || '')]) } } : null,
    ];
    const historico = { texto: `Entradas, saídas e saldo nos últimos ${n0(b.janela.length)} meses do extrato.`,
      grafico: linhaMeses(b, [{ nome: 'Entradas', valores: b.janela.map((m) => b.serie.get(m)?.entradas ?? null), papel: 'fe2' }, { nome: 'Saídas', valores: b.janela.map((m) => cent((b.serie.get(m)?.saidas || 0) + (b.serie.get(m)?.cartao || 0))), papel: 'fe4' }, { nome: 'Saldo', valores: saldos, papel: 'fe1' }]),
      tabela: { colunas: ['Mês', 'Entradas', 'Saídas', 'Resultado', 'Saldo'], linhas: b.janela.map((m) => { const x = b.serie.get(m) || {}; return [mesCurto(m), rs(x.entradas), rs(cent((x.saidas || 0) + (x.cartao || 0))), rs(x.resultado), rs(x.saldo_final)]; }) } };
    const recomendacoes = [];
    if (fecha != null && fecha < 0) recomendacoes.push({ o_que: 'Segurar as saídas que podem esperar até o fim do mês.', por_que: `Se entrar e sair tudo o que falta, o mês fecha em ${rs(fecha)}.`, impacto: `Evita fechar ${rs(Math.abs(fecha))} no vermelho.`, prioridade: 'alta' });
    if (faltaCli.some((x) => x.sit === 'aberto')) recomendacoes.push({ o_que: `Cobrar ${faltaCli.filter((x) => x.sit === 'aberto').map((x) => x.nome).slice(0, 3).join(', ')}.`, por_que: 'A mensalidade já venceu e não apareceu no extrato.', impacto: `${rs(soma(faltaCli.filter((x) => x.sit === 'aberto'), (x) => x.v))} de volta ao caixa.`, prioridade: 'alta' });
    if (pend) recomendacoes.push({ o_que: `Conferir os ${n0(pend)} lançamentos do mês no Movimento.`, por_que: 'Sem o lado real, o resultado e o orçamento do mês ficam aproximados.', impacto: 'Números do mês certos.', prioridade: pend > 10 ? 'media' : 'baixa' });
    for (const a of achados.slice(0, 2)) recomendacoes.push({ o_que: a.fazer || a.rot, por_que: a.texto || a.det, impacto: a.impacto ? rs(a.impacto) : '', prioridade: PRIOR[a.g] || 'baixa' });
    return { titulo: `Finanças · Hoje · ${nomeMes(b.mes)}`, subtitulo: 'O que entrou, o que falta entrar, o que já pagou e o que falta pagar', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Entrou e saiu pelo extrato do mês (data do banco). Falta entrar pela mensalidade de cada cliente na grade de clientes; falta pagar pelos fixos ainda não achados no extrato nem no cartão e pelo combinado de cada pessoa em Pessoas.'] };
  }

  // ---------- Movimento: extrato, cartão e fixos, com a fila de conferir ----------
  function movimento(d, b) {
    const doMes = b.doMes(b.mes), entradas = doMes.filter((p) => p.valor > 0), saidas = doMes.filter((p) => p.valor < 0);
    const pend = lista(d.transacoes).filter((t) => !t.real?.conferido && String(t.banco?.data || '').startsWith(b.mes));
    const aClass = doMes.filter((p) => p.categoria === 'a_classificar' || !p.categoria);
    const porCat = new Map(); for (const p of saidas) porCat.set(p.categoria, cent((porCat.get(p.categoria) || 0) - p.valor));
    const cats = [...porCat].sort((x, y) => y[1] - x[1]);
    const maiores = saidas.slice().sort((x, y) => x.valor - y.valor).slice(0, 12);
    const faturas = lista(d.cartao?.faturas), fatMes = faturas.filter((f) => f.fatura === b.mes);
    const itensCart = lista(d.cartao?.itens).filter((i) => i.fatura === b.mes), cartTotal = soma(itensCart, (i) => i.valor);
    const semFatura = lista(d.cartao?.pagamentos_sem_fatura);
    const fa = d.fixos_analise || {}, fixos = lista(fa.fixos), achadosF = fixos.filter((f) => f.achado), dif = fixos.filter((f) => f.diferenca && Math.abs(f.diferenca) >= 0.01);
    const revisarSerie = b.janela.map((m) => b.serie.get(m)?.a_revisar ?? 0);
    const lancSerie = b.janela.map((m) => lista(d.transacoes).filter((t) => String(t.banco?.data || '').startsWith(m)).length);
    const cartSerie = b.janela.map((m) => soma(lista(d.cartao?.itens).filter((i) => i.fatura === m), (i) => i.valor));
    const resumo = [
      `Em ${nomeMes(b.mes)} o extrato tem ${n0(doMes.length)} lançamento(s): ${n0(entradas.length)} entradas (${rs(soma(entradas, (p) => p.valor))}) e ${n0(saidas.length)} saídas (${rs(-soma(saidas, (p) => p.valor))}).`,
      pend.length ? `${n0(pend.length)} ainda esperam o lado real${aClass.length ? `; ${n0(aClass.length)} nem têm categoria` : ''}.` : 'Tudo do mês já está conferido.',
      cats[0] ? `A categoria que mais tirou dinheiro foi ${nomeCat(b, cats[0][0])} (${rs(cats[0][1])}).` : '',
      itensCart.length ? `No cartão, a fatura de ${nomeMes(b.mes)} soma ${rs(cartTotal)} em ${n0(itensCart.length)} compra(s)${fatMes.some((f) => f.falta > 0) ? `, com ${rs(soma(fatMes, (f) => f.falta))} ainda sem pagamento no extrato` : ''}.` : 'Sem compras no cartão neste mês.',
      fixos.length ? `${n0(achadosF.length)} de ${n0(fixos.length)} fixos apareceram no mês${dif.length ? `; ${n0(dif.length)} cobraram valor diferente do combinado` : ''}.` : '',
    ];
    const numeros = [
      { rotulo: 'Lançamentos no mês', valor: n0(doMes.length), porque: 'Linhas do extrato do mês (lançamento dividido conta cada parte).' },
      { rotulo: 'Sem conferir', valor: n0(pend.length), variacao: revisarSerie.length > 1 ? varPct(pend.length, revisarSerie[revisarSerie.length - 2], 'menor') : null, porque: 'Esperam categoria, cliente ou pessoa: o lado real.' },
      { rotulo: 'Entradas', valor: rs(soma(entradas, (p) => p.valor)), porque: 'Tudo que entrou na conta PJ no mês.' },
      { rotulo: 'Saídas', valor: rs(-soma(saidas, (p) => p.valor)), porque: 'Tudo que saiu, incluindo o pagamento do cartão.' },
      { rotulo: 'Fatura do cartão', valor: rs(cartTotal), variacao: cartSerie.length > 1 ? varPct(cartTotal, cartSerie[cartSerie.length - 2], 'menor') : null, porque: 'Compras lançadas na fatura do mês.' },
      { rotulo: 'Fixos achados', valor: `${n0(achadosF.length)} de ${n0(fixos.length)}`, porque: 'Fixo achado = apareceu no extrato ou no cartão do mês.' },
    ];
    const secoes = [
      { titulo: 'Saídas por categoria', texto: cats.length ? `As ${n0(Math.min(cats.length, 10))} categorias com mais saída em ${nomeMes(b.mes)}.` : 'Sem saídas no mês.',
        grafico: cats.length ? { tipo: 'ranking', itens: cats.slice(0, 10).map(([c, v], i) => ({ rotulo: nomeCat(b, c), valor: v, papel: i === 0 ? 'destaque' : 'neutro' })), formato: rsCurto } : null,
        tabela: cats.length ? { colunas: ['Categoria', 'Grupo', 'Saiu'], linhas: cats.map(([c, v]) => [nomeCat(b, c), grupoDe(b, c), rs(v)]) } : null },
      { titulo: 'Maiores saídas do mês', texto: 'Os lançamentos que mais pesaram, para conferir um a um.',
        tabela: maiores.length ? { colunas: ['Dia', 'Histórico', 'Categoria', 'Valor'], linhas: maiores.map((p) => [dataBr(p.data), p.historico.slice(0, 44), nomeCat(b, p.categoria), rs(p.valor)]) } : null },
      { titulo: 'A fila de conferir', texto: pend.length ? `${n0(pend.length)} lançamento(s) sem o lado real. Os sem categoria primeiro: são os que mais distorcem o resultado.` : 'Nada esperando conferência.',
        tabela: pend.length ? { colunas: ['Dia', 'Histórico', 'Sugestão', 'Valor'], linhas: pend.slice().sort((x, y) => Math.abs(y.banco.valor) - Math.abs(x.banco.valor)).slice(0, 15).map((t) => [dataBr(t.banco.data), String(t.banco.historico || '').slice(0, 40), nomeCat(b, t.sugestao?.categoria || t.real?.categoria), rs(t.banco.valor)]) } : null },
      { titulo: 'Cartão', texto: faturas.length ? `Faturas lidas: ${n0(faturas.length)}. ${semFatura.length ? `${n0(semFatura.length)} pagamento(s) de cartão no extrato sem fatura ligada.` : 'Todo pagamento de cartão tem fatura.'}` : 'Nenhuma fatura de cartão cadastrada.',
        grafico: cartSerie.some((v) => v > 0) ? barrasMeses(b, [{ nome: 'Fatura', valores: cartSerie, papel: 'fe3' }]) : null,
        tabela: faturas.length ? { colunas: ['Fatura', 'Cartão', 'Total', 'Pago no extrato', 'Falta', 'Vence'], linhas: faturas.slice(-8).map((f) => [mesCurto(f.fatura), f.cartao, rs(f.total), rs(f.pago_no_extrato), rs(f.falta), dataBr(f.vence)]) } : null },
      fixos.length ? { titulo: 'Fixos do mês', texto: `${n0(fixos.length)} fixos somam ${rs(fa.total)} por mês (${rs(fa.anual)} por ano).`,
        tabela: { colunas: ['Fixo', 'Dia', 'Valor', 'Apareceu', 'Diferença'], linhas: fixos.map((f) => [f.nome, String(f.dia), rs(f.valor), f.achado ? `${dataBr(f.achado.data)} (${f.achado.onde})` : 'não', f.diferenca ? rs(f.diferenca) : '—']) } } : null,
    ];
    const historico = { texto: `Quantos lançamentos o extrato teve por mês e quantos ficaram sem conferir. ${b.janela.length > 2 ? (revisarSerie[revisarSerie.length - 1] > revisarSerie[0] ? 'A fila de conferir cresceu na janela.' : 'A fila de conferir não cresceu na janela.') : ''}`,
      grafico: { tipo: 'barras', rotulos: b.janela.map(mesCurto), series: [{ nome: 'Lançamentos', valores: lancSerie, papel: 'fe1' }, { nome: 'Sem conferir', valores: revisarSerie, papel: 'fe4' }] },
      tabela: { colunas: ['Mês', 'Lançamentos', 'Sem conferir', 'Cartão'], linhas: b.janela.map((m, i) => [mesCurto(m), n0(lancSerie[i]), n0(revisarSerie[i]), rs(cartSerie[i])]) } };
    const recomendacoes = [];
    if (aClass.length) recomendacoes.push({ o_que: `Dar categoria aos ${n0(aClass.length)} lançamentos sem categoria.`, por_que: 'Sem categoria o lançamento não entra no DRE nem no orçamento certo.', impacto: `${rs(Math.abs(soma(aClass, (p) => p.valor)))} classificados.`, prioridade: 'alta' });
    if (pend.length) recomendacoes.push({ o_que: `Conferir a fila de ${n0(pend.length)} lançamentos, do maior para o menor.`, por_que: 'O lado real (cliente, pessoa, fixo) é o que liga o extrato às outras telas.', impacto: 'Clientes, Pessoas e Análise com o número certo.', prioridade: pend.length > 15 ? 'media' : 'baixa' });
    if (semFatura.length) recomendacoes.push({ o_que: 'Ligar os pagamentos de cartão às faturas.', por_que: `${n0(semFatura.length)} pagamento(s) sem fatura: o cartão não fecha.`, impacto: 'Cartão conciliado no fechamento.', prioridade: 'media' });
    if (dif.length) recomendacoes.push({ o_que: `Conferir os fixos que cobraram diferente: ${dif.map((f) => f.nome).slice(0, 3).join(', ')}.`, por_que: 'Valor fora do combinado pode ser reajuste não avisado ou cobrança em dobro.', impacto: rs(soma(dif, (f) => f.diferenca)), prioridade: 'media' });
    return { titulo: `Finanças · Movimento · ${nomeMes(b.mes)}`, subtitulo: 'Extrato, cartão e fixos do mês, com a fila de conferir', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Mês do lançamento = data do banco. Lançamento dividido em partes conta cada parte com a categoria dela. Fixo achado = apareceu no extrato ou na fatura do cartão do mês, pelo texto e pelo valor.'] };
  }

  // ---------- Clientes: cada cliente mês a mês, com a margem real ----------
  function clientes(d, b) {
    const pc = d.por_cliente || { meses: [], linhas: [] }, linhas = lista(pc.linhas), mesesC = lista(pc.meses);
    const doMes = linhas.map((l) => ({ l, m: lista(l.meses).find((x) => x.mes === b.mes) || null }));
    const previsto = soma(doMes, (x) => x.m?.previsto), recebido = soma(doMes, (x) => x.m?.recebido);
    const aging = b.an?.aging || { total: 0, vencido: 0, faixas: [], itens: [] };
    const vencidos = new Map(); for (const x of lista(aging.itens)) { const v = vencidos.get(x.cliente_nome) || { nome: x.cliente_nome, valor: 0, meses: [], atraso: 0 }; v.valor = cent(v.valor + (Number(x.valor) || 0)); v.meses.push(mesCurto(x.mes)); v.atraso = Math.max(v.atraso, Number(x.atraso_dias) || 0); vencidos.set(x.cliente_nome, v); }
    const abertos = [...vencidos.values()].sort((x, y) => y.valor - x.valor);
    const margem = lista(b.an?.margem?.linhas).slice().sort((x, y) => (y.margem || 0) - (x.margem || 0)), prej = margem.filter((x) => x.margem < 0);
    const conc = margem.length ? Math.round(((margem.slice().sort((x, y) => y.receita - x.receita)[0]?.receita || 0) / (soma(margem, (x) => x.receita) || 1)) * 100) : null;
    const recSerie = mesesC.map((m) => soma(linhas, (l) => lista(l.meses).find((x) => x.mes === m)?.recebido));
    const prevSerie = mesesC.map((m) => soma(linhas, (l) => lista(l.meses).find((x) => x.mes === m)?.previsto));
    const risco = new Set(lista(b.an?.risco).map(String));
    const resumo = [
      `Em ${nomeMes(b.mes)}, a carteira previa ${rs(previsto)} de mensalidade e entrou ${rs(recebido)} (${previsto ? Math.round((recebido / previsto) * 100) : 0}%).`,
      abertos.length ? `${n0(abertos.length)} cliente(s) com mensalidade vencida sem entrada: ${abertos.slice(0, 3).map((x) => `${x.nome} (${rs(x.valor)}, ${x.meses.join(' e ')})`).join(', ')}.` : 'Nenhum cliente com mensalidade vencida sem entrada.',
      aging.vencido ? `O vencido a receber soma ${rs(aging.vencido)}, com atraso médio de ${n0(aging.atraso_medio_dias || b.an?.atraso_medio_dias || 0)} dias.` : 'Nada vencido a receber.',
      margem.length ? `${prej.length ? `${n0(prej.length)} cliente(s) dão prejuízo depois do custo da equipe` : 'Nenhum cliente dá prejuízo depois do custo da equipe'}; o maior cliente responde por ${conc}% da receita.` : '',
      risco.size ? `${n0(risco.size)} cliente(s) estão em risco na Saúde da Carteira: a receita deles é a primeira a olhar.` : '',
    ];
    const numeros = [
      { rotulo: 'Previsto no mês', valor: rs(previsto), porque: 'Soma das mensalidades previstas de cada cliente no mês.' },
      { rotulo: 'Recebido no mês', valor: rs(recebido), variacao: recSerie.length > 1 ? varPct(recSerie[recSerie.length - 1], recSerie[recSerie.length - 2]) : null, porque: 'Entradas do extrato ligadas a cada cliente.' },
      { rotulo: 'Vencido a receber', valor: rs(aging.vencido), porque: 'Pelo dia de vencimento do contrato; sem contrato, o que foi marcado em aberto.' },
      { rotulo: 'Clientes em aberto', valor: n0(abertos.length), porque: 'Clientes com mensalidade vencida sem entrada no extrato, em qualquer mês.' },
      { rotulo: 'Com prejuízo', valor: n0(prej.length), porque: 'Receita − custo direto − custo de equipe rateado < 0.' },
      { rotulo: 'Concentração', valor: conc == null ? '—' : `${conc}%`, porque: 'Quanto o maior cliente pesa na receita: acima de 30% é risco.' },
    ];
    const secoes = [
      { titulo: 'Cliente a cliente no mês', texto: 'O previsto, o recebido e a situação de cada cliente.',
        tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Mensalidade', 'Previsto', 'Recebido', 'Situação'], linhas: doMes.filter((x) => x.m).sort((x, y) => (y.m.previsto || 0) - (x.m.previsto || 0)).map(({ l, m }) => [l.cliente_nome, rs(l.mensalidade), rs(m.previsto), rs(m.recebido), ({ pago: 'Pago', aberto: 'Em aberto', parcial: 'Pagou parte', a_receber: 'A receber' })[m.situacao] || m.situacao]) } },
      margem.length ? { titulo: 'Margem por cliente', texto: `Receita menos custo direto e o custo de equipe rateado ${String(b.an?.margem?.regra || '').includes('pecas') ? 'pelas peças da produção' : 'pela receita'}.`,
        grafico: { tipo: 'ranking', itens: margem.slice(0, 12).map((l) => ({ rotulo: l.cliente_nome, valor: l.margem, papel: l.margem < 0 ? 'perigo' : 'pronto' })), formato: rsCurto },
        tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Receita', 'Equipe', 'Margem', '%'], linhas: margem.map((l) => [l.cliente_nome, rs(l.receita), rs(l.custo_equipe), rs(l.margem), pctTxt(l.margem_pct)]) } } : null,
      lista(aging.faixas).some((f) => f.total) ? { titulo: 'A receber por idade', texto: `Total ${rs(aging.total)}, vencido ${rs(aging.vencido)}.`,
        grafico: { tipo: 'barras', rotulos: aging.faixas.map((f) => f.nome), series: [{ nome: 'A receber', valores: aging.faixas.map((f) => f.total), papel: 'fe4' }], formato: rsCurto },
        tabela: { colunas: [{ rotulo: 'Cliente', cliente: true }, 'Mês', 'Venceu', 'Atraso', 'Valor'], linhas: lista(aging.itens).map((x) => [x.cliente_nome, mesCurto(x.mes), dataBr(x.vence), `${n0(x.atraso_dias)} d`, rs(x.valor)]) } } : null,
    ];
    const historico = mesesC.length ? { texto: `Previsto contra recebido nos últimos ${n0(mesesC.length)} meses da grade de clientes.`,
      grafico: { tipo: 'barras', rotulos: mesesC.map(mesCurto), series: [{ nome: 'Previsto', valores: prevSerie, papel: 'fe1-claro' }, { nome: 'Recebido', valores: recSerie, papel: 'fe2' }], formato: rsCurto },
      tabela: { colunas: ['Mês', 'Previsto', 'Recebido', '%'], linhas: mesesC.map((m, i) => [mesCurto(m), rs(prevSerie[i]), rs(recSerie[i]), prevSerie[i] ? `${Math.round((recSerie[i] / prevSerie[i]) * 100)}%` : '—']) } } : null;
    const recomendacoes = [];
    for (const x of abertos.slice(0, 3)) recomendacoes.push({ o_que: `Cobrar ${x.nome}.`, por_que: `Mensalidade de ${x.meses.join(' e ')} vencida há até ${n0(x.atraso)} dias sem entrada no extrato.`, impacto: rs(x.valor), prioridade: x.atraso > 15 ? 'alta' : 'media' });
    for (const x of prej.slice(0, 2)) recomendacoes.push({ o_que: `Rever o escopo ou o preço de ${x.cliente_nome}.`, por_que: `Dá ${rs(x.margem)} de margem com o custo da equipe.`, impacto: 'Cliente volta a pagar o próprio custo.', prioridade: 'media' });
    if (conc != null && conc > 30) recomendacoes.push({ o_que: 'Diminuir a dependência do maior cliente com novos contratos.', por_que: `Ele é ${conc}% da receita.`, impacto: 'Menos risco se ele sair.', prioridade: 'media' });
    return { titulo: `Finanças · Clientes · ${nomeMes(b.mes)}`, subtitulo: 'Cada cliente mês a mês, o que falta receber e a margem real', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['Previsto pela mensalidade (contrato ou cadastro) e recebido pelas entradas do extrato ligadas ao cliente. Margem = receita − custo direto − custo de equipe rateado.'] };
  }

  // ---------- Pessoas: salários, pró-labore, vales, combinados e custo por pessoa ----------
  function pessoas(d, b) {
    const contas = lista(d.contas_pessoas);
    // Quem recebeu: a pessoa do lado real; sem ela, o "quem" ou a contraparte do banco.
    const quemDe = (p) => String(p.pessoa_nome || p.quem || p.contraparte || 'Sem nome').trim();
    const pagos = b.partes.filter((p) => PAGO_PESSOA.includes(p.categoria) && p.valor < 0);
    const porMes = (m, f = () => true) => soma(pagos.filter((p) => p.data.slice(0, 7) === m && f(p)), (p) => -p.valor);
    const ehSocio = (p) => grupoDe(b, p.categoria) === 'Sócios';
    const equipeS = b.janela.map((m) => porMes(m, (p) => !ehSocio(p))), sociosS = b.janela.map((m) => porMes(m, ehSocio));
    const totalS = b.janela.map((_, i) => cent(equipeS[i] + sociosS[i]));
    const iM = b.janela.indexOf(b.mes), totalMes = totalS[iM] ?? 0, totalAnt = iM > 0 ? totalS[iM - 1] : null;
    const entradaMes = b.serie.get(b.mes)?.entradas || 0;
    const porPessoa = new Map();
    for (const p of pagos.filter((x) => b.janela.includes(x.data.slice(0, 7)))) {
      const k = quemDe(p), x = porPessoa.get(k) || { nome: k, socio: ehSocio(p), meses: new Map(), total: 0, cats: new Set() };
      x.meses.set(p.data.slice(0, 7), cent((x.meses.get(p.data.slice(0, 7)) || 0) - p.valor)); x.total = cent(x.total - p.valor); x.cats.add(nomeCat(b, p.categoria)); porPessoa.set(k, x);
    }
    const pessoasL = [...porPessoa.values()].sort((x, y) => (y.meses.get(b.mes) || 0) - (x.meses.get(b.mes) || 0) || y.total - x.total);
    // O combinado de cada pessoa (Pessoas da tela): combinado × recebeu × vale.
    const comb = contas.map((c) => { const m = lista(c.meses).find((x) => x.mes === b.mes) || {}; return { nome: c.nome, combinado: m.combinado || 0, pago: m.pago || 0, vale: c.vale || 0, falta: m.aberto ? m.falta_pagar || 0 : m.a_pagar || 0, proximo: c.proximo }; });
    const valeTotal = soma(comb, (c) => c.vale), comCombinado = comb.filter((c) => c.combinado > 0);
    // Pagamentos repetidos sem pessoa (ex.: "Equipe … Salários" em Outra saída): provável salário sem classificar.
    const repet = lista(b.an?.repetidas).filter((r) => !PAGO_PESSOA.includes(r.categoria) && /salar|equipe|folha|pro.?labore|vale/i.test(`${r.nome} ${r.contem}`));
    const tend = (() => { const v = totalS.filter((x) => x > 0); if (v.length < 3) return 'histórico curto para dizer a tendência'; const d0 = v[v.length - 1] - v[0]; return Math.abs(d0) / (v[0] || 1) < 0.05 ? 'estável na janela' : d0 > 0 ? `subindo (${rs(d0)} a mais que no começo da janela)` : `caindo (${rs(-d0)} a menos que no começo da janela)`; })();
    const proj = (() => { const ult = totalS.filter((x) => x > 0).slice(-3); return ult.length ? cent(ult.reduce((t, x) => t + x, 0) / ult.length) : 0; })();
    const resumo = [
      `Em ${nomeMes(b.mes)} saíram ${rs(totalMes)} para pessoas: ${rs(equipeS[iM] || 0)} de equipe (salário, freela, adiantamento) e ${rs(sociosS[iM] || 0)} de sócios (pró-labore e retirada)${entradaMes ? `, ${Math.round((totalMes / entradaMes) * 100)}% do que entrou` : ''}.`,
      pessoasL[0] ? `Quem mais recebeu no mês: ${pessoasL.filter((p) => p.meses.get(b.mes)).slice(0, 3).map((p) => `${p.nome} (${rs(p.meses.get(b.mes))})`).join(', ') || 'ninguém no mês'}.` : 'Nenhum pagamento a pessoa classificado no extrato.',
      contas.length ? (comCombinado.length ? `${n0(comCombinado.length)} pessoa(s) têm combinado informado; ${valeTotal ? `o vale acumulado soma ${rs(valeTotal)}` : 'ninguém está com vale'}.` : 'Ninguém tem o combinado informado ainda: sem ele não há vale nem "falta pagar".') : 'Pessoas ainda sem combinado nem pagamento ligado a uma pessoa do time: o custo sai pela categoria do extrato.',
      repet.length ? `Há pagamento todo mês que parece salário e está sem pessoa: ${repet.map((r) => `${r.nome} (${rs(r.valor)} por mês)`).slice(0, 2).join(', ')}.` : '',
      `O custo com pessoas está ${tend}.`,
    ];
    const numeros = [
      { rotulo: 'Pago a pessoas no mês', valor: rs(totalMes), variacao: totalAnt != null ? varPct(totalMes, totalAnt, 'menor') : null, porque: 'Salário, freela, adiantamento, pró-labore e retirada do mês, pelo extrato.' },
      { rotulo: 'Equipe', valor: rs(equipeS[iM] || 0), porque: 'Salário, freela e adiantamento (grupo Pessoas).' },
      { rotulo: 'Sócios', valor: rs(sociosS[iM] || 0), porque: 'Pró-labore e retirada (grupo Sócios).' },
      { rotulo: 'Peso na entrada', valor: entradaMes ? `${Math.round((totalMes / entradaMes) * 100)}%` : '—', porque: 'Pago a pessoas ÷ o que entrou no mês.' },
      { rotulo: 'Vale acumulado', valor: rs(valeTotal), porque: 'O que passou do combinado e ainda não foi descontado nem devolvido.' },
      { rotulo: 'Pessoas pagas no mês', valor: n0(pessoasL.filter((p) => p.meses.get(b.mes)).length), porque: 'Quem recebeu algum pagamento de pessoa no mês.' },
    ];
    const secoes = [
      { titulo: 'Custo por pessoa', texto: pessoasL.length ? `O que cada pessoa recebeu nos últimos ${n0(b.janela.length)} meses, pelo extrato (pessoa do lado real; sem ela, o nome do Pix).` : 'Nenhum pagamento a pessoa no período.',
        grafico: pessoasL.length ? { tipo: 'ranking', itens: pessoasL.slice(0, 12).map((p) => ({ rotulo: p.nome, valor: p.total, sub: p.socio ? 'sócio' : 'equipe', pessoa: p.nome })), formato: rsCurto } : null,
        tabela: pessoasL.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Tipo', `Em ${mesCurto(b.mes)}`, 'Média/mês', 'Na janela'], linhas: pessoasL.map((p) => [p.nome, [...p.cats].join(', '), rs(p.meses.get(b.mes) || 0), rs(p.total / (b.janela.length || 1)), rs(p.total)]) } : null },
      { titulo: 'Combinado, recebido e vale', texto: contas.length ? 'Combinado × o que a pessoa recebeu no mês. O que passa do combinado vira vale, descontado no salário seguinte.' : 'Ninguém tem combinado cadastrado em Pessoas. Informe o combinado de cada um para o vale e o "falta pagar" aparecerem.',
        grafico: comCombinado.length ? { tipo: 'barras', rotulos: comCombinado.map((c) => c.nome.split(' ')[0]), series: [{ nome: 'Combinado', valores: comCombinado.map((c) => c.combinado), papel: 'fe1-claro' }, { nome: 'Recebeu', valores: comCombinado.map((c) => c.pago), papel: 'fe1' }, { nome: 'Vale', valores: comCombinado.map((c) => c.vale), papel: 'fe5' }], formato: rsCurto } : null,
        tabela: contas.length ? { colunas: [{ rotulo: 'Pessoa', pessoa: true }, 'Combinado', 'Recebeu', 'Falta pagar', 'Vale', 'Próximo salário'], linhas: comb.map((c) => [c.nome, rs(c.combinado), rs(c.pago), rs(c.falta), rs(c.vale), c.proximo ? `${rs(c.proximo.a_receber)} em ${mesCurto(c.proximo.mes)}` : '—']) } : null },
      { titulo: 'Equipe e sócios mês a mês', texto: `Quanto foi para a equipe e quanto para os sócios em cada mês.`,
        grafico: { tipo: 'barras', rotulos: b.janela.map(mesCurto), series: [{ nome: 'Equipe', valores: equipeS, papel: 'fe1' }, { nome: 'Sócios', valores: sociosS, papel: 'fe3' }], empilhado: true, formato: rsCurto },
        tabela: { colunas: ['Mês', 'Equipe', 'Sócios', 'Total', '% da entrada'], linhas: b.janela.map((m, i) => [mesCurto(m), rs(equipeS[i]), rs(sociosS[i]), rs(totalS[i]), b.serie.get(m)?.entradas ? `${Math.round((totalS[i] / b.serie.get(m).entradas) * 100)}%` : '—']) } },
      repet.length ? { titulo: 'Parece pagamento de pessoa, sem pessoa', texto: 'Pagamentos que se repetem todo mês com nome de salário ou equipe, mas classificados em outra categoria. Enquanto ficarem assim, o custo com pessoas sai menor do que é.',
        tabela: { colunas: ['Descrição', 'Categoria hoje', 'Meses', 'Valor', 'Dia'], linhas: repet.map((r) => [r.nome, nomeCat(b, r.categoria), n0(r.meses), rs(r.valor), String(r.dia || '—')]) } } : null,
    ];
    const historico = { texto: `Custo com pessoas nos últimos ${n0(b.janela.length)} meses: ${tend}.`, grafico: linhaMeses(b, [{ nome: 'Pessoas (total)', valores: totalS, papel: 'fe1' }, { nome: 'Equipe', valores: equipeS, papel: 'fe2', tracejada: true }]) };
    const projecao = proj ? { texto: [`Na média dos últimos 3 meses, o custo com pessoas fica perto de ${rs(proj)} por mês: ${rs(proj * 12)} em 12 meses, se ninguém entrar nem sair.${repet.length ? ` Se os pagamentos repetidos sem pessoa forem mesmo salário, somam mais ${rs(soma(repet, (r) => r.valor))} por mês.` : ''}`],
      tabela: { colunas: ['Mês', 'Custo esperado'], linhas: [1, 2, 3].map((k) => [mesCurto(somarMeses(b.mes, k)), rs(proj)]) } } : null;
    const recomendacoes = [];
    if (repet.length) recomendacoes.push({ o_que: `Classificar ${repet[0].nome} como salário e ligar a cada pessoa.`, por_que: `Sai ${rs(repet[0].valor)} todo mês em ${nomeCat(b, repet[0].categoria)}: o custo com pessoas fica escondido.`, impacto: `Custo real da equipe (${rs(soma(repet, (r) => r.valor))} por mês a mais).`, prioridade: 'alta' });
    if (!comCombinado.length) recomendacoes.push({ o_que: 'Informar o combinado de cada pessoa em Pessoas.', por_que: 'Sem combinado não existe vale nem "falta pagar": o Hoje não sabe o que ainda sai no mês.', impacto: 'Falta pagar e vale certos no Hoje e no Fechamento.', prioridade: 'media' });
    for (const c of comb.filter((x) => x.vale > 0).slice(0, 3)) recomendacoes.push({ o_que: `Jogar o vale de ${c.nome} no próximo salário.`, por_que: `${rs(c.vale)} recebidos além do combinado.`, impacto: c.proximo ? `Recebe ${rs(c.proximo.a_receber)} em ${mesCurto(c.proximo.mes)}.` : 'Vale zerado.', prioridade: 'media' });
    if (entradaMes && totalMes / entradaMes > 0.5) recomendacoes.push({ o_que: 'Rever a folha contra a receita antes de contratar.', por_que: `Pessoas levam ${Math.round((totalMes / entradaMes) * 100)}% do que entrou.`, impacto: 'Margem para imposto, estrutura e caixa.', prioridade: 'media' });
    return { titulo: `Finanças · Pessoas · ${nomeMes(b.mes)}`, subtitulo: 'Salários, pró-labore, vales, combinados e o custo de cada pessoa', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Pago a pessoa = saída do extrato em salário, freela, adiantamento (grupo Pessoas), pró-labore ou retirada (grupo Sócios), pelo mês do banco. Quem recebeu = a pessoa do lado real; sem ela, o "quem" ou o nome do Pix.', 'Combinado e vale pela conta de cada pessoa (a mesma da tela Pessoas): o que passa do combinado vira vale e é abatido no mês seguinte.'] };
  }

  // ---------- Assinaturas: os programas que a Vybe paga todo mês ----------
  function assinaturas(d, b) {
    const fa = d.fixos_analise || {}, ass = lista(fa.fixos).filter((f) => f.categoria === 'ferramentas'), paradas = lista(d.fixos).filter((f) => f.categoria === 'ferramentas' && !ass.some((a) => a.id === f.id));
    const total = soma(ass, (f) => f.valor), pagas = ass.filter((f) => f.achado), faltam = ass.filter((f) => !f.achado), dif = ass.filter((f) => f.diferenca && Math.abs(f.diferenca) >= 0.01);
    // Ferramentas no cartão: o que se repete em 2+ faturas com o mesmo nome é assinatura, cadastrada ou não.
    const itens = lista(d.cartao?.itens).filter((i) => i.categoria === 'ferramentas');
    const porNome = new Map(); for (const i of itens) { const k = String(i.descricao || '').trim(); if (!k) continue; const x = porNome.get(k) || { nome: k, faturas: new Map() }; x.faturas.set(i.fatura, cent((x.faturas.get(i.fatura) || 0) + Number(i.valor || 0))); porNome.set(k, x); }
    const nomeNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const cadastrada = (n) => ass.some((f) => nomeNorm(n).includes(nomeNorm(f.contem || f.nome)) || nomeNorm(f.nome).includes(nomeNorm(n)));
    const doCartao = [...porNome.values()].filter((x) => x.faturas.size >= 2).map((x) => { const v = [...x.faturas.entries()].sort((a, c) => a[0].localeCompare(c[0])); return { nome: x.nome, meses: v.length, ultimo: v[v.length - 1][1], primeiro: v[0][1], cadastrada: cadastrada(x.nome) }; }).sort((x, y) => y.ultimo - x.ultimo);
    const sugeridas = doCartao.filter((x) => !x.cadastrada);
    const subiram = doCartao.filter((x) => x.ultimo > x.primeiro * 1.05);
    // Gasto com ferramentas mês a mês: extrato + cartão.
    const serie = b.janela.map((m) => cent(soma(b.partes.filter((p) => p.categoria === 'ferramentas' && p.valor < 0 && p.data.slice(0, 7) === m), (p) => -p.valor) + soma(itens.filter((i) => i.fatura === m), (i) => i.valor)));
    const iM = b.janela.indexOf(b.mes), noMes = serie[iM] ?? 0, mensalReal = cent(total + soma(sugeridas, (x) => x.ultimo));
    const tend = serie.filter((x) => x > 0).length >= 3 ? (serie[serie.length - 1] > serie.find((x) => x > 0) * 1.05 ? 'subindo' : serie[serie.length - 1] < serie.find((x) => x > 0) * 0.95 ? 'caindo' : 'estável') : 'com histórico curto';
    const ordem = [...ass.map((f) => ({ nome: f.nome, valor: f.valor, onde: f.forma === 'cartao' ? 'cartão' : f.forma || 'pix', cad: true })), ...sugeridas.map((x) => ({ nome: x.nome, valor: x.ultimo, onde: 'cartão', cad: false }))].sort((x, y) => y.valor - x.valor);
    const resumo = [
      ass.length ? `${n0(ass.length)} assinatura(s) cadastrada(s) somam ${rs(total)} por mês (${rs(total * 12)} por ano).` : 'Nenhuma assinatura cadastrada em Assinaturas.',
      sugeridas.length ? `No cartão, ${n0(sugeridas.length)} cobrança(s) se repetem todo mês sem cadastro (${sugeridas.map((x) => x.nome).slice(0, 3).join(', ')}): com elas, o custo real com programas é ${rs(mensalReal)} por mês.` : 'Toda cobrança repetida de programa no cartão já está cadastrada.',
      ass.length ? `Em ${nomeMes(b.mes)}, ${n0(pagas.length)} de ${n0(ass.length)} já foram pagas${faltam.length ? `; falta ${rs(soma(faltam, (f) => f.valor))}` : ''}${dif.length ? ` e ${n0(dif.length)} cobrou valor diferente` : ''}.` : '',
      `O gasto com ferramentas no extrato e no cartão está ${tend}: ${rs(noMes)} no mês.`,
      subiram.length ? `Subiram de preço: ${subiram.map((x) => `${x.nome} (${rs(x.primeiro)} → ${rs(x.ultimo)})`).slice(0, 3).join(', ')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Por mês (cadastradas)', valor: rs(total), porque: `${n0(ass.length)} assinatura(s) ativa(s) em Ferramentas e assinaturas.` },
      { rotulo: 'Por ano', valor: rs(total * 12), porque: 'Se nada mudar.' },
      { rotulo: 'Custo real por mês', valor: rs(mensalReal), porque: 'Cadastradas + o que se repete no cartão sem cadastro.' },
      { rotulo: `Pagas em ${mesCurto(b.mes)}`, valor: `${n0(pagas.length)} de ${n0(ass.length)}`, porque: 'Paga = apareceu no extrato ou na fatura do cartão do mês.' },
      { rotulo: 'Cobrou diferente', valor: n0(dif.length), porque: 'Valor do mês fora do combinado no cadastro.' },
      { rotulo: 'Ferramentas no mês', valor: rs(noMes), variacao: iM > 0 ? varPct(noMes, serie[iM - 1], 'menor') : null, porque: 'Tudo em Ferramentas e assinaturas, no extrato e no cartão.' },
    ];
    const secoes = [
      { titulo: 'O que a Vybe assina', texto: ordem.length ? 'Cada programa, quanto custa por mês e por ano, do maior para o menor. "Sem cadastro" = achado no cartão.' : 'Nada cadastrado nem repetido no cartão.',
        grafico: ordem.length ? { tipo: 'ranking', itens: ordem.slice(0, 12).map((x) => ({ rotulo: x.nome, valor: x.valor, sub: x.cad ? x.onde : 'sem cadastro', papel: x.cad ? 'fe1' : 'risco' })), formato: rsCurto } : null,
        tabela: ordem.length ? { colunas: ['Assinatura', 'Onde paga', 'Por mês', 'Por ano', 'Cadastro'], linhas: ordem.map((x) => [x.nome, x.onde, rs(x.valor), rs(x.valor * 12), x.cad ? 'sim' : 'não']) } : null },
      ass.length ? { titulo: `Vencimentos de ${nomeMes(b.mes)}`, texto: faltam.length ? `${n0(faltam.length)} ainda não apareceram no mês.` : 'Todas apareceram no mês.',
        tabela: { colunas: ['Assinatura', 'Dia', 'Valor', 'Situação', 'Cobrou'], linhas: ass.slice().sort((x, y) => x.dia - y.dia).map((f) => [f.nome, String(f.dia), rs(f.valor), f.achado ? `pago ${dataBr(f.achado.data)}` : f.vence < b.hoje ? 'venceu sem aparecer' : 'a vencer', f.achado ? rs(f.achado.valor) : '—']) } } : null,
      doCartao.length ? { titulo: 'Repetidas no cartão', texto: 'Compras de programa que se repetem em duas ou mais faturas: o preço da primeira e o da última.',
        tabela: { colunas: ['Descrição', 'Faturas', 'Primeira', 'Última', 'Cadastrada'], linhas: doCartao.map((x) => [x.nome, n0(x.meses), rs(x.primeiro), rs(x.ultimo), x.cadastrada ? 'sim' : 'não']) } } : null,
      paradas.length ? { titulo: 'Paradas', texto: 'Assinaturas canceladas ou fora do período, que não contam no total.', tabela: { colunas: ['Assinatura', 'Valor', 'Fim'], linhas: paradas.map((f) => [f.nome, rs(f.valor), f.fim ? mesCurto(f.fim) : '—']) } } : null,
    ];
    const historico = { texto: `Gasto com ferramentas e assinaturas mês a mês (extrato + cartão): ${tend}.`, grafico: barrasMeses(b, [{ nome: 'Ferramentas', valores: serie, papel: 'fe3' }]),
      tabela: { colunas: ['Mês', 'Ferramentas'], linhas: b.janela.map((m, i) => [mesCurto(m), rs(serie[i])]) } };
    const projecao = { texto: [`Mantidas as de hoje, as assinaturas custam ${rs(mensalReal * 12)} nos próximos 12 meses${subiram.length ? '; com os reajustes vistos no cartão, conte com um pouco mais' : ''}.`] };
    const recomendacoes = [];
    if (sugeridas.length) recomendacoes.push({ o_que: `Cadastrar ${sugeridas.map((x) => x.nome).slice(0, 3).join(', ')} em Assinaturas.`, por_que: 'Cobram todo mês no cartão e não entram no "falta pagar" nem no total.', impacto: `${rs(soma(sugeridas, (x) => x.ultimo))} por mês à vista.`, prioridade: 'media' });
    for (const x of subiram.slice(0, 2)) recomendacoes.push({ o_que: `Negociar ou trocar o plano de ${x.nome}.`, por_que: `Subiu de ${rs(x.primeiro)} para ${rs(x.ultimo)}.`, impacto: `${rs(cent((x.ultimo - x.primeiro) * 12))} por ano.`, prioridade: 'baixa' });
    for (const f of dif.slice(0, 2)) recomendacoes.push({ o_que: `Conferir a cobrança de ${f.nome}.`, por_que: `Cobrou ${rs(f.achado?.valor)} e o cadastro diz ${rs(f.valor)}.`, impacto: rs(f.diferenca), prioridade: 'media' });
    if (ordem.length >= 3) recomendacoes.push({ o_que: `Rever se as ${n0(ordem.length)} assinaturas são todas usadas; começar por ${ordem[0].nome}.`, por_que: 'Assinatura esquecida é custo fixo que ninguém vê.', impacto: `Até ${rs(ordem[0].valor * 12)} por ano na maior.`, prioridade: 'baixa' });
    if (faltam.some((f) => f.vence < b.hoje)) recomendacoes.push({ o_que: `Ver por que ${faltam.filter((f) => f.vence < b.hoje).map((f) => f.nome).join(', ')} não apareceu no mês.`, por_que: 'Venceu e não está no extrato nem no cartão: pode ter falhado o pagamento ou mudado o nome.', impacto: 'Programa sem corte de acesso.', prioridade: 'media' });
    return { titulo: `Finanças · Assinaturas · ${nomeMes(b.mes)}`, subtitulo: 'Programas e softwares: quanto custam, vencimentos, tendência e o que cortar', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Assinatura = fixo em Ferramentas e assinaturas; paga quando aparece no extrato ou na fatura do cartão do mês. "Repetida no cartão" = mesma descrição em duas ou mais faturas, em Ferramentas.'] };
  }

  // ---------- Análise: DRE, recorrente, margem, orçamento, metas e equilíbrio ----------
  function analise(d, b) {
    const an = b.an, dre = an.dre.competencia, i = dre.meses.indexOf(b.mes), rec = an.recorrente, ult = lista(rec.meses).find((x) => x.mes === b.mes) || lista(rec.meses).slice(-1)[0] || {};
    const orc = an.orcamento?.atual || {}, estouros = lista(orc.linhas).filter((l) => l.estourou), metas = lista(an.metas), eq = an.equilibrio || {};
    const jan = dre.meses.filter((m) => b.janela.includes(m)), idx = jan.map((m) => dre.meses.indexOf(m));
    const receita = i >= 0 ? dre.linhas[0].valores[i] : null, res = i >= 0 ? dre.resultado[i] : null, mg = i >= 0 ? dre.margem?.[i] : null;
    const resumo = [
      `Em ${nomeMes(b.mes)}, por competência, a receita foi ${rs(receita)} e o resultado ${rs(res)} (margem ${pctTxt(mg)}).`,
      `MRR de contrato ${rs(rec.mrr)}${rec.mrr_estimado != null && rec.mrr_estimado !== rec.mrr ? `, ${rs(rec.mrr_estimado)} com quem paga sem contrato` : ''}; churn médio ${pctTxt(rec.churn_medio_pct)} ao mês.`,
      eq.mrr ? `O recorrente ${eq.cobre_total ? 'cobre' : 'não cobre'} o custo total do mês (${rs(eq.custo_total)})${eq.cobre_total ? '' : `: faltam ${rs(eq.falta_total)}`}.` : '',
      estouros.length ? `Orçamento estourado em ${estouros.map((l) => l.grupo).join(', ')}.` : orc.tem_orcamento ? 'Nenhum grupo estourou o orçamento do mês.' : 'Sem orçamento para o mês.',
      metas.length ? `Metas: ${metas.map((m) => `${m.nome} ${m.ok ? 'batida' : `falta ${m.unidade === '%' ? pctTxt(m.falta) : rs(m.falta)}`}`).join('; ')}.` : '',
    ];
    const numeros = [
      { rotulo: 'Receita (competência)', valor: rs(receita), variacao: i > 0 ? varPct(receita, dre.linhas[0].valores[i - 1]) : null, porque: 'Entradas de receita pelo mês de competência.' },
      { rotulo: 'Resultado', valor: rs(res), variacao: i > 0 ? varPct(res, dre.resultado[i - 1]) : null, porque: 'Receita − impostos − equipe − ferramentas − despesas gerais.' },
      { rotulo: 'Margem', valor: pctTxt(mg), porque: 'Resultado ÷ receita.' },
      { rotulo: 'MRR de contrato', valor: rs(rec.mrr), porque: `Novo ${rs(ult.novo)}, perdido ${rs(ult.perdido)} no mês.` },
      { rotulo: 'Ponto de equilíbrio', valor: eq.custo_total != null ? rs(eq.custo_total) : '—', porque: 'O custo total do mês que o recorrente precisa cobrir.' },
      { rotulo: 'Estouros de orçamento', valor: n0(estouros.length), porque: 'Grupos que já gastaram mais do que o orçado no mês.' },
    ];
    const secoes = [
      { titulo: 'DRE por competência', texto: `Receita e resultado nos últimos ${n0(jan.length)} meses. Resultado do mês: ${rs(res)}.`,
        grafico: { tipo: 'barras', rotulos: jan.map(mesCurto), series: [{ nome: 'Receita', valores: idx.map((k) => dre.linhas[0].valores[k]), papel: 'fe2' }, { nome: 'Resultado', valores: idx.map((k) => dre.resultado[k]), papel: 'fe1' }], formato: rsCurto },
        tabela: { colunas: ['Mês', ...dre.linhas.filter((l) => l.valores.some((v) => Math.abs(v) > 0.009)).map((l) => ({ 'Custo de equipe': 'Equipe', 'Ferramentas e assinaturas': 'Ferramentas', 'Despesas gerais': 'Despesas', 'Sem categoria': 'Sem categ.' })[l.nome] || l.nome), 'Resultado'],
          linhas: idx.map((k, j) => [mesCurto(jan[j]), ...dre.linhas.filter((l) => l.valores.some((v) => Math.abs(v) > 0.009)).map((l) => rs(l.valores[k] * (l.sinal < 0 ? -1 : 1))), rs(dre.resultado[k])]) } },
      { titulo: 'Receita recorrente', texto: `Novo, expansão, contração e perdido no MRR de contrato, mês a mês.`,
        grafico: { tipo: 'linha', rotulos: lista(rec.meses).filter((x) => b.janela.includes(x.mes)).map((x) => mesCurto(x.mes)), series: [{ nome: 'MRR', valores: lista(rec.meses).filter((x) => b.janela.includes(x.mes)).map((x) => x.mrr), papel: 'fe1' }, ...(lista(rec.meses).some((x) => x.com_extrato) ? [{ nome: 'Com o extrato', valores: lista(rec.meses).filter((x) => b.janela.includes(x.mes)).map((x) => x.com_extrato ?? null), papel: 'fe2', tracejada: true }] : [])], formato: rsCurto },
        tabela: { colunas: ['Mês', 'MRR', 'Novo', 'Perdido', 'Ativos', 'Churn'], linhas: lista(rec.meses).filter((x) => b.janela.includes(x.mes)).map((x) => [mesCurto(x.mes), rs(x.mrr), rs(x.novo), rs(x.perdido), n0(x.ativos), pctTxt(x.churn_pct)]) } },
      orc.tem_orcamento ? { titulo: `Orçamento de ${nomeMes(orc.mes || b.mes)}`, texto: 'Orçado × real por grupo de despesa.',
        grafico: { tipo: 'barras', rotulos: lista(orc.linhas).map((l) => l.grupo), series: [{ nome: 'Orçado', valores: lista(orc.linhas).map((l) => l.orcado), papel: 'fe1-claro' }, { nome: 'Real', valores: lista(orc.linhas).map((l) => l.real), papel: 'fe4' }], formato: rsCurto },
        tabela: { colunas: ['Grupo', 'Orçado', 'Real', 'Desvio', 'Situação'], linhas: lista(orc.linhas).map((l) => [l.grupo, rs(l.orcado), rs(l.real), rs(l.desvio), l.estourou ? 'estourou' : 'dentro']) } } : null,
      metas.length ? { titulo: 'Metas', texto: 'As metas guardadas no Finanças e onde cada uma está.',
        tabela: { colunas: ['Meta', 'Alvo', 'Hoje', 'Falta', 'Situação'], linhas: metas.map((m) => [m.nome, m.unidade === '%' ? pctTxt(m.meta) : rs(m.meta), m.unidade === '%' ? pctTxt(m.atual) : rs(m.atual), m.unidade === '%' ? pctTxt(m.falta) : rs(m.falta), m.ok ? 'batida' : m.pct != null ? `${m.pct}%` : 'falta']) } } : null,
    ];
    const hl = lista(an.historico?.linhas).filter((x) => b.janela.includes(x.mes));
    const historico = hl.length ? { texto: 'Entradas, saídas e resultado de caixa, com a variação contra o mês anterior.', grafico: { tipo: 'linha', rotulos: hl.map((x) => mesCurto(x.mes)), series: [{ nome: 'Resultado', valores: hl.map((x) => x.resultado), papel: 'fe1' }, { nome: 'Saldo', valores: hl.map((x) => x.saldo_final), papel: 'fe2', tracejada: true }], formato: rsCurto },
      tabela: { colunas: ['Mês', 'Entradas', 'Saídas', 'Resultado', 'vs anterior'], linhas: hl.map((x) => [mesCurto(x.mes), rs(x.entradas), rs(x.saidas), rs(x.resultado), x.vs_anterior?.resultado != null ? `${x.vs_anterior.resultado > 0 ? '+' : ''}${x.vs_anterior.resultado}%` : '—']) } } : null;
    const recomendacoes = lista(an.achados).filter((a) => ['fin_analise', undefined].includes(a.aba) || /orc|margem|meta|mrr|churn/i.test(a.id)).slice(0, 5).map((a) => ({ o_que: a.fazer || a.rot, por_que: a.texto || a.det, impacto: a.impacto ? rs(a.impacto) : '', prioridade: PRIOR[a.g] || 'baixa' }));
    for (const m of metas.filter((x) => !x.ok).slice(0, 2)) recomendacoes.push({ o_que: `Plano para a meta de ${m.nome}.`, por_que: `Falta ${m.unidade === '%' ? pctTxt(m.falta) : rs(m.falta)} para ${m.unidade === '%' ? pctTxt(m.meta) : rs(m.meta)}.`, impacto: 'Meta batida no próximo fechamento.', prioridade: 'media' });
    return { titulo: `Finanças · Análise · ${nomeMes(b.mes)}`, subtitulo: 'DRE, receita recorrente, orçamento, metas e ponto de equilíbrio', resumo, numeros, secoes, historico, recomendacoes,
      metodologia: ['DRE por competência (o mês a que o lançamento se refere). MRR pelos contratos cadastrados; "com o extrato" soma quem paga sem contrato pela média dos meses fechados. Orçamento por grupo de despesa do mês.'] };
  }

  // ---------- Projeção: pessimista, base e otimista para 12 meses e o fôlego ----------
  function projecao(d, b) {
    const pj = b.an.projecao, cf = pj.confianca || b.an.confianca || {}, prs = pj.premissas || {}, eq = b.an.equilibrio || {};
    const cen = ['pessimista', 'base', 'otimista'].filter((k) => pj[k]);
    const neg = pj.base?.primeiro_dia_negativo, negP = pj.pessimista?.primeiro_dia_negativo;
    const menor = (k) => Math.min(...lista(pj[k]?.meses).map((x) => x.menor_saldo ?? x.saldo));
    const resumo = [
      `No cenário base, o caixa termina os 12 meses em ${rs(pj.base?.saldo_final)}; pessimista ${rs(pj.pessimista?.saldo_final)}, otimista ${rs(pj.otimista?.saldo_final)}.`,
      neg ? `No base o caixa fica negativo em ${neg.split('-').reverse().join('/')}.` : `O base não fica negativo em 12 meses${negP ? `; o pessimista fica, a partir de ${negP.split('-').reverse().join('/')}` : ''}.`,
      `O menor saldo dentro do mês, no base, é ${rs(menor('base'))}: é o aperto do dia a dia, antes de entrar a receita.`,
      cf.texto ? `${String(cf.texto).replace(/^./, (c) => c.toUpperCase())}${cf.motivo ? `, porque ${cf.motivo}` : ''}.` : '',
      eq.mrr ? `O recorrente de hoje (${rs(eq.mrr)}) ${eq.cobre_total ? 'cobre' : 'não cobre'} o custo total de ${rs(eq.custo_total)} por mês.` : '',
    ];
    const numeros = [
      { rotulo: 'Saldo em 12 meses (base)', valor: rs(pj.base?.saldo_final), porque: 'Contratos no dia do vencimento, fixos e a média do variável.' },
      { rotulo: 'Pessimista', valor: rs(pj.pessimista?.saldo_final), porque: 'Receita sem contrato 15% menor, atraso médio, clientes em risco saem e variável alto.' },
      { rotulo: 'Otimista', valor: rs(pj.otimista?.saldo_final), porque: 'Base + o funil do Comercial pela chance de cada proposta.' },
      { rotulo: 'Fôlego', valor: pj.base?.folego_meses == null ? '12+ meses' : `${pj.base.folego_meses} meses`, porque: 'Quantos meses o caixa aguenta no base.' },
      { rotulo: 'Menor saldo no mês (base)', valor: rs(menor('base')), porque: 'O ponto mais baixo dentro de algum mês, dia a dia.' },
      { rotulo: 'Confiança', valor: ({ alta: 'Alta', media: 'Média', baixa: 'Baixa' })[cf.nivel] || '—', porque: cf.motivo || cf.texto || 'Pela quantidade de meses e de contratos na base.' },
    ];
    const secoes = [
      { titulo: 'Os três cenários', texto: 'O saldo no fim de cada mês nos três cenários.',
        grafico: { tipo: 'linha', rotulos: lista(pj.meses).map(mesCurto), series: cen.map((k) => ({ nome: k[0].toUpperCase() + k.slice(1), valores: lista(pj[k].meses).map((x) => x.saldo), papel: k === 'base' ? 'fe1' : k === 'pessimista' ? 'fe4' : 'fe2', tracejada: k !== 'base' })), formato: rsCurto },
        tabela: { colunas: ['Mês', 'Pessimista', 'Base', 'Otimista', 'Menor no mês (base)'], linhas: lista(pj.meses).map((m, k) => [mesCurto(m), rs(pj.pessimista?.meses[k]?.saldo), rs(pj.base?.meses[k]?.saldo), rs(pj.otimista?.meses[k]?.saldo), rs(pj.base?.meses[k]?.menor_saldo)]) } },
      { titulo: 'Entradas e saídas do base', texto: `${prs.receita ? `Receita projetada ${rs(prs.receita.projetada)} por mês (média real recente ${rs(prs.receita.media_recente)}). ` : ''}${prs.saidas_projetadas_base != null ? `Saídas ${rs(prs.saidas_projetadas_base)} por mês contra ${rs(prs.saidas_historicas_media)} de média real.` : ''}`,
        grafico: { tipo: 'barras', rotulos: lista(pj.meses).map(mesCurto), series: [{ nome: 'Entradas', valores: lista(pj.base?.meses).map((x) => x.entradas), papel: 'fe2' }, { nome: 'Saídas', valores: lista(pj.base?.meses).map((x) => x.saidas), papel: 'fe4' }], formato: rsCurto } },
      lista(b.an.pipeline).length ? { titulo: 'O que entra no otimista', texto: 'As propostas abertas do Comercial, pela chance de cada uma.',
        tabela: { colunas: ['Proposta', 'Etapa', 'Mensal', 'Avulso', 'Chance'], linhas: lista(b.an.pipeline).map((p) => [p.nome, String(p.etapa || '').replace(/_/g, ' '), rs(p.valor_mensal), rs(p.valor_avulso), `${Math.round((p.chance || 0) * 100)}%`]) } } : null,
    ];
    const historico = { texto: 'O saldo real dos últimos meses, de onde a projeção parte.', grafico: linhaMeses(b, [{ nome: 'Saldo real', valores: b.janela.map((m) => b.serie.get(m)?.saldo_final ?? null), papel: 'fe1' }]) };
    const proj = { texto: [`A projeção é esta aba inteira: ${lista(pj.meses).length} meses à frente, a partir de ${nomeMes(pj.meses?.[0])}.`, cf.motivo ? `A confiança é ${cf.nivel} porque ${cf.motivo}.` : ''] };
    const recomendacoes = [];
    if (neg) recomendacoes.push({ o_que: `Agir antes de ${neg.split('-').reverse().join('/')}: cortar saída ou antecipar receita.`, por_que: 'O base fica negativo nessa data.', impacto: 'Caixa positivo o ano todo.', prioridade: 'alta' });
    if (menor('base') < 0) recomendacoes.push({ o_que: 'Ajustar o dia dos pagamentos para depois das maiores entradas.', por_que: `Dentro do mês o base chega a ${rs(menor('base'))} antes de a receita entrar.`, impacto: 'Sem cheque especial no meio do mês.', prioridade: 'media' });
    if (negP && !neg) recomendacoes.push({ o_que: 'Fazer reserva para o pessimista.', por_que: `Se os clientes em risco saírem, o caixa fica negativo em ${negP.split('-').reverse().join('/')}.`, impacto: 'Fôlego mesmo no cenário ruim.', prioridade: 'media' });
    if (cf.nivel && cf.nivel !== 'alta') recomendacoes.push({ o_que: 'Cadastrar os contratos dos clientes que pagam sem contrato.', por_que: `A confiança está ${cf.nivel}${cf.motivo ? `: ${cf.motivo}` : ''}.`, impacto: 'Projeção mais confiável.', prioridade: 'media' });
    return { titulo: `Finanças · Projeção · a partir de ${nomeMes(pj.meses?.[0] || b.mes)}`, subtitulo: 'Pessimista, base e otimista para 12 meses, o fôlego e o aperto do mês', resumo, numeros, secoes, historico, projecao: proj, recomendacoes,
      metodologia: ['Base: contratos no dia do vencimento, cliente sem contrato pela média dele no extrato, fixos e a média do variável. Pessimista: entradas pela média 15% menores, atraso médio, clientes em risco saem, variável alto. Otimista: base + funil do Comercial pela chance.'] };
  }

  // ---------- Fechamento: o checklist do mês e o resumo para a contabilidade ----------
  function fechamento(d, b) {
    const fm = lista(b.an.fechamento?.meses), atual = fm.find((x) => x.mes === b.mes) || fm[fm.length - 1] || { itens: [] };
    const fechados = Object.entries(d.fechamentos || {}).filter(([, f]) => f?.situacao === 'fechado').map(([m, f]) => ({ mes: m, ...f })).sort((x, y) => x.mes.localeCompare(y.mes));
    const jan = fm.filter((x) => b.janela.includes(x.mes));
    const mesF = atual.mes || b.mes, s = b.serie.get(mesF) || {};
    const porCatF = new Map(); for (const p of b.doMes(mesF)) { const x = porCatF.get(p.categoria) || { nome: nomeCat(b, p.categoria), grupo: grupoDe(b, p.categoria), quantidade: 0, total: 0 }; x.quantidade += 1; x.total = cent(x.total + p.valor); porCatF.set(p.categoria, x); }
    const r = { lancamentos: lista(d.transacoes).filter((t) => String(t.banco?.data || '').startsWith(mesF)).length, a_revisar: lista(d.transacoes).filter((t) => !t.real?.conferido && String(t.banco?.data || '').startsWith(mesF)).length, categorias: [...porCatF.values()].sort((x, y) => Math.abs(y.total) - Math.abs(x.total)) };
    const faltam = lista(atual.itens).filter((x) => !x.ok);
    const resumo = [
      `${nomeMes(atual.mes || b.mes).replace(/^./, (c) => c.toUpperCase())} ${atual.fechado ? 'está fechado' : atual.pronto ? 'está pronto para fechar' : `ainda não pode fechar: faltam ${n0(faltam.length)} item(ns) do checklist`}.`,
      faltam.length ? `Falta: ${faltam.map((x) => `${x.nome.toLowerCase()} (${x.det})`).join('; ')}.` : 'O checklist está completo.',
      `No mês, entraram ${rs(s.entradas)} e saíram ${rs(cent((s.saidas || 0) + (s.cartao || 0)))}; saldo final ${rs(s.saldo_final)}.`,
      fechados.length ? `Último mês fechado: ${nomeMes(fechados[fechados.length - 1].mes)}, por ${fechados[fechados.length - 1].por_nome || '—'}.` : 'Nenhum mês fechado ainda.',
      `${n0(jan.filter((x) => !x.fechado).length)} dos últimos ${n0(jan.length)} meses estão abertos.`,
    ];
    const numeros = [
      { rotulo: 'Checklist do mês', valor: `${n0(lista(atual.itens).length - faltam.length)} de ${n0(lista(atual.itens).length)}`, porque: 'Extrato até o fim do mês, tudo conferido, cartão conciliado e a receber revisado.' },
      { rotulo: 'Situação', valor: atual.fechado ? 'Fechado' : atual.pronto ? 'Pronto para fechar' : 'Aberto', porque: 'Fechar congela os totais do mês para a contabilidade.' },
      { rotulo: 'Entradas', valor: rs(s.entradas), porque: 'Pelo extrato do mês.' },
      { rotulo: 'Saídas', valor: rs(cent((s.saidas || 0) + (s.cartao || 0))), porque: 'Pelo extrato do mês, com o pagamento do cartão.' },
      { rotulo: 'Lançamentos', valor: n0(r.lancamentos), porque: `${n0(r.a_revisar)} sem conferir.` },
      { rotulo: 'Meses fechados', valor: n0(fechados.length), porque: 'Desde o começo do extrato.' },
    ];
    const secoes = [
      { titulo: `Checklist de ${nomeMes(atual.mes || b.mes)}`, texto: 'O que precisa estar certo antes de fechar o mês.',
        tabela: { colunas: ['Item', 'Situação', 'Detalhe'], linhas: lista(atual.itens).map((x) => [x.nome, x.ok ? 'ok' : 'falta', x.det]) } },
      { titulo: 'Resumo para a contabilidade', texto: `Totais do mês por categoria, pelo extrato (${n0(r.lancamentos)} lançamentos).`,
        tabela: { colunas: ['Categoria', 'Grupo', 'Qtde', 'Total'], linhas: lista(r.categorias).map((c) => [c.nome, c.grupo, n0(c.quantidade), rs(c.total)]) } },
      { titulo: 'Meses na janela', texto: 'Quais meses estão fechados e quantos itens faltam em cada um.',
        grafico: { tipo: 'barras', rotulos: jan.map((x) => mesCurto(x.mes)), series: [{ nome: 'Itens que faltam', valores: jan.map((x) => x.faltam || 0), papel: 'fe4' }] },
        tabela: { colunas: ['Mês', 'Situação', 'Faltam'], linhas: jan.map((x) => [mesCurto(x.mes), x.fechado ? 'fechado' : x.pronto ? 'pronto' : 'aberto', n0(x.faltam)]) } },
      fechados.length ? { titulo: 'Meses fechados', texto: 'Os totais congelados no fechamento.', tabela: { colunas: ['Mês', 'Entradas', 'Saídas', 'Resultado (caixa)', 'Por'], linhas: fechados.map((f) => [mesCurto(f.mes), rs(f.totais?.entradas), rs(f.totais?.saidas), rs(f.totais?.resultado_caixa), f.por_nome || '—']) } } : null,
    ];
    const recomendacoes = faltam.map((x) => ({ o_que: `${x.nome}: resolver antes de fechar.`, por_que: x.det, impacto: 'Mês pronto para fechar e mandar à contabilidade.', prioridade: x.id === 'conferido' ? 'alta' : 'media' }));
    if (!faltam.length && !atual.fechado) recomendacoes.push({ o_que: `Fechar ${nomeMes(atual.mes || b.mes)}.`, por_que: 'O checklist está completo.', impacto: 'Totais congelados para a contabilidade.', prioridade: 'media' });
    return { titulo: `Finanças · Fechamento · ${nomeMes(atual.mes || b.mes)}`, subtitulo: 'O checklist do mês e o resumo para a contabilidade', resumo, numeros, secoes, recomendacoes,
      metodologia: ['O checklist é o mesmo da tela de Fechamento: extrato até o fim do mês, tudo conferido, cartão conciliado e a receber revisado. O resumo por categoria é o do extrato do mês.'] };
  }

  const MONTAR = { fin_hoje: hoje, fin_movimento: movimento, fin_clientes: clientes, fin_pessoas: pessoas, fin_assinaturas: assinaturas, fin_analise: analise, fin_projecao: projecao, fin_fechamento: fechamento };
  // As subabas reais do menu do Finanças (FE_ABAS) e as telas antigas que abrem nelas (FE_DE).
  const ABAS = [
    { id: 'fin_hoje', nome: 'Hoje', telas: ['fin_hoje', 'vorcaro', 'setor:financas'] },
    { id: 'fin_movimento', nome: 'Movimento', telas: ['fin_movimento', 'extrato', 'cartao', 'fixos', 'recebimentos', 'contas'] },
    { id: 'fin_clientes', nome: 'Clientes', telas: ['fin_clientes', 'clientes_mes', 'financas', 'inadimplencia'] },
    { id: 'fin_pessoas', nome: 'Pessoas', telas: ['fin_pessoas', 'vales'] },
    { id: 'fin_assinaturas', nome: 'Assinaturas', telas: ['fin_assinaturas'] },
    { id: 'fin_analise', nome: 'Análise', telas: ['fin_analise'] },
    { id: 'fin_projecao', nome: 'Projeção', telas: ['fin_projecao', 'projecao'] },
    { id: 'fin_fechamento', nome: 'Fechamento', telas: ['fin_fechamento'] },
  ].map((a) => ({ ...a, dinheiro: true, seletor: () => typeof document !== 'undefined' && Boolean(document.querySelector(`.fe[data-tela="fe-${a.id}"]`)) }));

  function montar(abaId, d = {}, ctx = {}) {
    const f = MONTAR[abaId];
    if (!f) throw new Error(`Aba do Finanças desconhecida: ${abaId}`);
    if (!lista(d.transacoes).length || !d.analise) return { ...semExtrato(abaId), titulo: `Finanças · ${ABAS.find((a) => a.id === abaId)?.nome || abaId}` };
    const b = base(d, ctx);
    return fechar(abaId, f(d, b), b);
  }
  raiz.VybeRelFinAbas = Object.freeze({ ABAS, montar, pedacos });
})(typeof globalThis !== 'undefined' ? globalThis : this);
