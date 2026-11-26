// vybe-relatorio-aprovacao.js — o relatório técnico da Aprovação (Conteúdo): o que espera aprovação interna e do cliente,
// há quanto tempo, quanto volta para alteração e o equilíbrio Atração/Educação/Conversão. Paulo, 26/11/2026.
// Só leitura: GET /api/painel?area=aprovacoes (a mesma lista do Seu dia, já filtrada pelo que a pessoa pode ver) e
// area=conteudo_modulo&acao=objetivos (objetivo das peças e a última resposta do cliente pelo link).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  const OBJ = { atracao: 'Atração', educacao: 'Educação', conversao: 'Conversão' };
  const idDe = (d) => String(d.id || '');
  const faixa = (h) => (h == null ? 'sem dado' : h < 24 ? 'até 1 dia' : h < 72 ? '1 a 3 dias' : h < 168 ? '3 a 7 dias' : 'mais de 7 dias');
  const FAIXAS = ['até 1 dia', '1 a 3 dias', '3 a 7 dias', 'mais de 7 dias'];

  async function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas;
    const [apr, obj] = await Promise.all([ctx.api('aprovacoes'), ctx.api('conteudo_modulo', { acao: 'objetivos' })]);
    const pecas = ctx.dados.pecas();
    const a = P.analisar({ pecas, per, hoje, equipe: ctx.dados.equipe() });
    ctx.fonte('Peças da Produção (DADOS_ALL)', `${u.num(pecas.length)} peças carregadas no painel`);
    // Fila de agora (servidor): peças e planejamentos esperando alguém aprovar.
    const filaPecas = lista(apr?.pecas), filaPlanos = lista(apr?.planejamentos);
    const interna = filaPecas.filter((p) => p.etapa === 'interna'), doCliente = filaPecas.filter((p) => p.etapa === 'cliente');
    const medH = (l) => u.mediana(l.map((p) => Number(p.horas)).filter(Number.isFinite));
    const hInt = medH(interna), hCli = medH(doCliente);
    const velhas = filaPecas.filter((p) => Number(p.horas) >= 72).sort((x, y) => Number(y.horas) - Number(x.horas));
    // No período (painel): peças que passaram por aprovação e as que voltaram para alteração.
    const st = (x) => x.s.chave;
    const emAlteracao = a.doPer.filter((x) => st(x) === 'alteracao');
    const esperandoPer = a.doPer.filter((x) => ['para aprovacao', 'em aprovacao', 'ag aprovacao cliente'].includes(st(x)));
    // Respostas do cliente pelo link (últimos 120 dias), só das peças do período.
    const respostas = obj?.respostas || {}, objetivos = obj?.objetivos || {};
    const idsPer = new Set(a.doPer.map((x) => idDe(x.d)));
    const resp = Object.entries(respostas).filter(([id, r]) => idsPer.has(id) && r);
    const aprovadas = resp.filter(([, r]) => r.acao === 'aprovar').length, ajustes = resp.filter(([, r]) => r.acao === 'ajuste').length;
    const taxaPrimeira = resp.length ? u.pct(aprovadas, resp.length) : null;
    // Equilíbrio do período: objetivo marcado nas peças do período.
    const porObj = { atracao: 0, educacao: 0, conversao: 0 }; let semObj = 0;
    for (const x of a.doPer) { const o = objetivos[idDe(x.d)]; if (OBJ[o]) porObj[o]++; else semObj++; }
    const marcadasObj = porObj.atracao + porObj.educacao + porObj.conversao;
    const porCliente = new Map();
    for (const p of filaPecas) for (const c of String(p.cliente || 'Sem cliente').split(',').map((s) => s.trim()).filter(Boolean)) {
      const r = porCliente.get(c) || { nome: c, interna: 0, cliente: 0, horas: [] };
      r[p.etapa === 'cliente' ? 'cliente' : 'interna']++; if (Number.isFinite(Number(p.horas))) r.horas.push(Number(p.horas)); porCliente.set(c, r);
    }
    const clientes = [...porCliente.values()].map((r) => ({ ...r, total: r.interna + r.cliente, med: u.mediana(r.horas) })).sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome, 'pt-BR'));
    const dias = (h) => (h == null ? '—' : h < 24 ? `${u.num(h)} h` : `${u.num(h / 24, 1)} d`);

    const resumo = [];
    if (!apr) resumo.push('A fila de aprovações não respondeu agora; os números de espera ficaram de fora.');
    else resumo.push(filaPecas.length || filaPlanos.length ? `Agora, ${u.plural(interna.length, 'peça espera', 'peças esperam')} aprovação interna (mediana de ${dias(hInt)}) e ${u.plural(doCliente.length, 'espera', 'esperam')} o cliente (mediana de ${dias(hCli)}); ${u.plural(filaPlanos.length, 'planejamento está', 'planejamentos estão')} no caminho.` : 'Nada esperando aprovação agora.');
    if (velhas.length) resumo.push(`${u.plural(velhas.length, 'item está parado', 'itens estão parados')} há mais de 3 dias: é onde a aprovação vira gargalo.`);
    if (resp.length) resumo.push(`O cliente respondeu ${u.plural(resp.length, 'peça', 'peças')} do período pelo link: ${u.num(aprovadas)} aprovadas e ${u.num(ajustes)} com ajuste (${taxaPrimeira}% de aprovação).`);
    if (emAlteracao.length) resumo.push(`${u.plural(emAlteracao.length, 'peça do período está', 'peças do período estão')} em alteração agora.`);
    if (marcadasObj) { const top = Object.entries(porObj).sort((x, y) => y[1] - x[1])[0]; resumo.push(`No equilíbrio do período, ${OBJ[top[0]].toLowerCase()} domina (${u.pct(top[1], marcadasObj)}% das peças com objetivo).`); }

    const numeros = [
      { rotulo: 'Esperando aprovação interna', valor: apr ? u.num(interna.length) : 'sem dado', porque: 'Peças em "Para aprovação"/"Em aprovação" agora: dependem do head ou do diretor de arte.' },
      { rotulo: 'Esperando o cliente', valor: apr ? u.num(doCliente.length) : 'sem dado', porque: 'Peças em "Ag. Aprovação Cliente" agora.' },
      { rotulo: 'Espera mediana (interna)', valor: apr ? dias(hInt) : 'sem dado', porque: 'Tempo desde a última troca de status, metade espera menos que isso.' },
      { rotulo: 'Planejamentos no caminho', valor: apr ? u.num(filaPlanos.length) : 'sem dado', porque: 'Em revisão, ajustes, com o cliente ou aprovados sem as peças cadastradas.' },
      { rotulo: 'Aprovação do cliente pelo link', valor: taxaPrimeira == null ? 'sem dado' : `${taxaPrimeira}%`, porque: resp.length ? `${u.num(aprovadas)} aprovadas e ${u.num(ajustes)} com ajuste entre as ${u.num(resp.length)} respostas.` : 'Nenhuma resposta pelo link nas peças do período.' },
      { rotulo: 'Em alteração', valor: u.num(emAlteracao.length), porque: 'Peças do período que voltaram e estão sendo refeitas.' },
    ];
    const tempo = FAIXAS.map((f) => ({ f, i: interna.filter((p) => faixa(p.horas) === f).length, c: doCliente.filter((p) => faixa(p.horas) === f).length }));
    const etapas = { revisar: 'Revisão interna', ajustes: 'Ajustes', enviado: 'Com o cliente', aprovado: 'Aprovado, falta cadastrar' };
    const planosEtapa = u.contarPor(filaPlanos, (p) => etapas[p.estado] || p.estado);
    const secoes = [
      { titulo: 'Há quanto tempo cada item espera', texto: ['A fila de agora, pelo tempo desde a última troca de status.'],
        grafico: apr && filaPecas.length ? { tipo: 'barras', rotulos: tempo.map((t) => t.f), series: [{ nome: 'Interna', valores: tempo.map((t) => t.i) }, { nome: 'Cliente', valores: tempo.map((t) => t.c) }] } : null,
        tabela: velhas.length ? { colunas: ['Peça', 'Cliente', 'Etapa', 'Status', 'Parada há'], linhas: velhas.slice(0, 20).map((p) => [String(p.titulo || '').slice(0, 40), String(p.cliente || '—').slice(0, 26), p.etapa === 'cliente' ? 'Cliente' : 'Interna', String(p.status || ''), dias(Number(p.horas))]) } : null },
      { titulo: 'Fila por cliente', texto: [clientes[0] ? `Mais itens esperando: ${clientes.slice(0, 3).map((c) => `${c.nome} (${c.total})`).join(', ')}.` : 'Sem fila por cliente.'],
        grafico: clientes.length ? { tipo: 'ranking', de: 'cliente', itens: clientes.slice(0, 10).map((c) => ({ rotulo: c.nome, valor: c.total, sub: `mediana ${dias(c.med)}`, tom: c.med >= 72 ? 'ruim' : '' })) } : null,
        tabela: clientes.length ? { colunas: ['Cliente', 'Interna', 'Cliente', 'Espera mediana'], linhas: clientes.slice(0, 15).map((c) => [c.nome, u.num(c.interna), u.num(c.cliente), dias(c.med)]) } : null },
      { titulo: 'Planejamentos', texto: [filaPlanos.length ? 'Planejamentos do mês e em que etapa estão.' : 'Nenhum planejamento esperando.'],
        grafico: planosEtapa.length ? { tipo: 'rosca', fatias: planosEtapa.map(([e, n]) => ({ rotulo: e, valor: n })), centro: u.num(filaPlanos.length), sub: 'planejamentos' } : null,
        tabela: filaPlanos.length ? { colunas: ['Cliente', 'Mês', 'Etapa', 'Peças', 'Parado há'], linhas: filaPlanos.slice(0, 20).map((p) => [p.cliente || '—', p.mes ? u.nomeMes(p.mes) : '—', etapas[p.estado] || p.estado, u.num(p.pecas), dias(Number(p.horas))]) } : null },
      { titulo: 'Equilíbrio Atração, Educação e Conversão', texto: [marcadasObj ? `${u.num(marcadasObj)} peças do período têm objetivo; ${u.num(semObj)} ainda sem.` : 'As peças do período ainda não têm objetivo marcado.'],
        grafico: marcadasObj ? { tipo: 'rosca', fatias: Object.entries(porObj).map(([k, n]) => ({ rotulo: OBJ[k], valor: n })), centro: `${u.pct(marcadasObj, a.doPer.length)}%`, sub: 'com objetivo' } : null },
    ];
    const hist = a.hist.map((h) => ({ mes: h.mes, alteracao: h.alteracao, cliente: h.cliente, total: h.total }));
    const historico = { texto: [`Peças de cada mês que estão em alteração ou esperando o cliente hoje. ${u.tendenciaTexto(hist.map((h) => h.alteracao), { coisa: 'Tendência das alterações', melhor: 'menor' }).texto}.`],
      grafico: { tipo: 'linha', rotulos: hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Em alteração', valores: hist.map((h) => h.alteracao), status: 'Alteração' }, { nome: 'Esperando o cliente', valores: hist.map((h) => h.cliente), status: 'Ag. Aprovação Cliente' }] },
      tabela: { colunas: ['Mês', 'Peças', 'Em alteração', 'Esperando o cliente'], linhas: hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.alteracao), u.num(h.cliente)]) } };
    const projecao = { texto: [interna.length && hInt != null ? `Com a espera mediana de ${dias(hInt)}, a fila interna de hoje (${u.num(interna.length)}) só sai toda em cerca de ${dias(Math.max(...interna.map((p) => Number(p.horas) || 0)) + hInt)} se nada novo entrar.` : 'Sem fila interna para projetar.',
      esperandoPer.length ? `${u.plural(esperandoPer.length, 'peça do período ainda depende', 'peças do período ainda dependem')} de aprovação antes da data.` : ''].filter(Boolean) };
    const recomendacoes = [];
    if (velhas.length) recomendacoes.push({ o_que: `Destravar os ${u.num(velhas.length)} itens parados há mais de 3 dias${velhas[0] ? `, a começar por ${String(velhas[0].titulo || '').slice(0, 40)} (${velhas[0].cliente || 'sem cliente'})` : ''}.`, por_que: '"Não pode virar um gargalo": cada dia na fila é um dia a menos para produzir.', impacto: `${u.num(velhas.length)} peças voltam a andar.`, prioridade: 'alta' });
    if (doCliente.length >= 3 && hCli >= 48) recomendacoes.push({ o_que: `Cobrar a aprovação do cliente nas ${u.num(doCliente.length)} peças com ele.`, por_que: `A espera mediana do cliente está em ${dias(hCli)}.`, impacto: 'Protege a data de veiculação.', prioridade: 'media' });
    if (ajustes && taxaPrimeira < 70) recomendacoes.push({ o_que: 'Revisar o briefing das peças que voltaram com ajuste do cliente.', por_que: `Só ${taxaPrimeira}% foram aprovadas de primeira pelo link.`, impacto: 'Menos retrabalho por peça.', prioridade: 'media' });
    if (marcadasObj) { const fraco = Object.entries(porObj).sort((x, y) => x[1] - y[1])[0]; if (u.pct(fraco[1], marcadasObj) < 20) recomendacoes.push({ o_que: `Planejar mais peças de ${OBJ[fraco[0]].toLowerCase()} no próximo mês.`, por_que: `Ficou com ${u.pct(fraco[1], marcadasObj)}% do período.`, impacto: 'Feed equilibrado entre atrair, educar e converter.', prioridade: 'baixa' }); }
    if (semObj && a.doPer.length && u.pct(semObj, a.doPer.length) > 50) recomendacoes.push({ o_que: `Marcar o objetivo nas ${u.num(semObj)} peças sem ele.`, por_que: 'Sem objetivo não dá para medir o equilíbrio do mês.', impacto: 'Leitura do equilíbrio mais fiel.', prioridade: 'baixa' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a aprovação interna em menos de 1 dia.', por_que: 'É o que segura a fila curta hoje.', impacto: 'Mais tempo para produzir e para o cliente responder.', prioridade: 'baixa' });
    return { titulo: 'Produção · Aprovação', subtitulo: 'Aprovação interna e do cliente, planejamentos e o equilíbrio do conteúdo', amostra: a.doPer.map((x) => x.d), resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['A fila vem do servidor (a mesma do Seu dia) e mostra só o que quem gerou pode ver. Tempo parado = horas desde a última troca de status.', 'Aprovação pelo link = última resposta do cliente (aprovar ou ajuste) nos últimos 120 dias, das peças do período. O histórico mostra o status de hoje das peças de cada mês, não o que aconteceu no mês.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('aprovacao', relatorio, { nome: 'Aprovação', telas: ['conteudo', 'planejamentos'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' } });
  raiz.VybeRelAprovacao = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
