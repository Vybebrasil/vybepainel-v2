// vybe-relatorio-equipe.js — o relatório técnico da Equipe: quem é o time e o que cada pessoa tem na mão agora (peças do
// feed e demandas), com o que entregou no período. Paulo, 26/11/2026 (vybe-relatorio.js). Só o que o painel já carregou
// (TEAM_USERS, DADOS_ALL, DADOS_DEMANDAS); presença, recados e missões da Equipe online são do jogo e ficam fora.
// O score e o ranking do time são do relatório de Recursos Humanos (gestão).
(function (raiz) {
  'use strict';
  const lista = (v) => (Array.isArray(v) ? v : []);
  function relatorio(ctx) {
    const u = ctx.util, per = ctx.periodo, hoje = ctx.hoje, P = raiz.VybeRelPecas;
    const equipe = ctx.dados.equipe().filter((p) => p && (p.name || p.nome) && p.ativo !== false);
    const pecas = ctx.dados.pecas(), dem = ctx.dados.demandas().map((d) => ({ ...d, veiculacao_iso: '', prazo_iso: String(d.conclusao_iso || d.prazo_iso || '').slice(0, 10) }));
    ctx.fonte('Equipe (TEAM_USERS)', `${u.num(equipe.length)} pessoas ativas`);
    const a = P.analisar({ pecas, per, hoje, equipe }), d = P.analisar({ pecas: dem, per, hoje, equipe });
    const porNome = new Map();
    const pega = (n) => porNome.get(n) || porNome.set(n, { nome: n, cargo: '', pecas: 0, entregues: 0, abertas: 0, atrasadas: 0, demandas: 0, demAtr: 0 }).get(n);
    for (const p of equipe) pega(String(p.name || p.nome).trim()).cargo = String(p.cargo || p.funcao || p.role || '');
    for (const p of a.porPessoa) { const x = pega(p.nome); x.pecas = p.total; x.entregues = p.entregues; x.abertas = p.abertas; x.atrasadas = p.atrasadas; }
    for (const p of d.porPessoa) { const x = pega(p.nome); x.demandas = p.abertas; x.demAtr = p.atrasadas; }
    const todos = [...porNome.values()].filter((x) => x.nome !== 'Sem responsável').sort((x, y) => (y.abertas + y.demandas) - (x.abertas + x.demandas) || x.nome.localeCompare(y.nome, 'pt-BR'));
    const naMao = (x) => x.abertas + x.demandas;
    const cargaMedia = todos.length ? u.media(todos.map(naMao)) : 0;
    const pesados = todos.filter((x) => naMao(x) >= Math.max(5, cargaMedia * 1.5)), livres = todos.filter((x) => naMao(x) === 0);
    const semDono = a.atual.semDono + d.atual.semDono;
    const resumo = [
      `O time tem ${u.plural(todos.length, 'pessoa', 'pessoas')}; em média, ${u.num(cargaMedia, 1)} itens abertos por pessoa (peças do período e demandas).`,
      pesados.length ? `Mais carregados: ${pesados.slice(0, 3).map((x) => `${x.nome} (${naMao(x)})`).join(', ')}.` : 'Carga bem distribuída.',
      livres.length ? `${u.plural(livres.length, 'pessoa está', 'pessoas estão')} sem nada aberto no período: ${livres.slice(0, 4).map((x) => x.nome).join(', ')}.` : '',
      semDono ? `${u.plural(semDono, 'item está', 'itens estão')} sem responsável.` : '',
    ].filter(Boolean);
    const numeros = [
      { rotulo: 'Pessoas no time', valor: u.num(todos.length), porque: 'Pessoas ativas da equipe carregada no painel.' },
      { rotulo: 'Itens abertos por pessoa', valor: u.num(cargaMedia, 1), porque: 'Média de peças do período e demandas abertas de cada um.' },
      { rotulo: 'Entregas no período', valor: u.num(a.atual.entregues), variacao: u.variacao(a.atual.entregues, a.anterior.entregues, 'maior', { contra: `vs ${a.contraRotulo}` }), porque: 'Peças finalizadas com data no período.' },
      { rotulo: 'Sem responsável', valor: u.num(semDono), porque: 'Peças e demandas do período sem ninguém.' },
    ];
    const secoes = [
      { titulo: 'O que cada pessoa tem na mão', texto: ['Abertas do período (peças) e demandas abertas; a mais carregada primeiro.'],
        grafico: todos.length ? { tipo: 'barras', rotulos: todos.slice(0, 12).map((x) => x.nome.split(' ')[0]), series: [{ nome: 'Peças abertas', valores: todos.slice(0, 12).map((x) => x.abertas) }, { nome: 'Demandas', valores: todos.slice(0, 12).map((x) => x.demandas) }], empilhado: true } : null,
        tabela: todos.length ? { colunas: ['Pessoa', 'Cargo', 'Peças', 'Finalizadas', 'Abertas', 'Atrasadas', 'Demandas', 'Dem. atrasadas'], linhas: todos.map((x) => [x.nome, x.cargo || '—', u.num(x.pecas), u.num(x.entregues), u.num(x.abertas), u.num(x.atrasadas), u.num(x.demandas), u.num(x.demAtr)]) } : null },
    ];
    const historico = { texto: ['Entregas do time por mês (peças finalizadas pela data do cliente).'],
      grafico: { tipo: 'barras', rotulos: a.hist.map((h) => u.nomeMes(h.mes)), series: [{ nome: 'Finalizadas', valores: a.hist.map((h) => h.entregues) }] },
      tabela: { colunas: ['Mês', 'Peças', 'Finalizadas', 'Atrasadas'], linhas: a.hist.map((h) => [u.nomeMes(h.mes, true), u.num(h.total), u.num(h.entregues), u.num(h.atrasadas)]) } };
    const projecao = { texto: [a.ritmo?.projetado != null && a.atual.total ? `No ritmo do período, o time fecha cerca de ${u.num(Math.min(a.ritmo.projetado, a.atual.total))} de ${u.num(a.atual.total)} peças.` : 'Período fechado.'] };
    const recomendacoes = [];
    if (pesados.length && livres.length) recomendacoes.push({ o_que: `Passar parte da fila de ${pesados[0].nome} para ${livres[0].nome}.`, por_que: `${pesados[0].nome} tem ${naMao(pesados[0])} itens abertos e ${livres[0].nome} nenhum.`, impacto: 'Carga equilibrada e menos atraso.', prioridade: 'alta' });
    else if (pesados.length) recomendacoes.push({ o_que: `Rever a carga de ${pesados.slice(0, 2).map((x) => x.nome).join(' e ')}.`, por_que: 'Bem acima da média do time.', impacto: 'Menos risco de atraso.', prioridade: 'media' });
    if (semDono) recomendacoes.push({ o_que: `Dar responsável aos ${u.num(semDono)} itens sem dono.`, por_que: 'Sem dono, ninguém puxa.', impacto: 'Itens acompanhados.', prioridade: 'media' });
    if (!recomendacoes.length) recomendacoes.push({ o_que: 'Manter a distribuição da semana na segunda.', por_que: 'A carga está equilibrada.', impacto: 'Ritmo mantido.', prioridade: 'baixa' });
    return { titulo: 'Equipe', subtitulo: 'Quem é o time e o que cada um tem na mão', resumo, numeros, secoes, historico, projecao, recomendacoes,
      metodologia: ['Peças do período pela data do cliente e demandas pela conclusão; peça de duas pessoas conta para as duas. Presença e recados do jogo ficam fora; score e ranking estão no relatório de Recursos Humanos.'] };
  }
  if (raiz.VybeRelatorio?.registrar) raiz.VybeRelatorio.registrar('equipe', relatorio, { nome: 'Equipe', telas: ['equipe'], agente: { nome: 'Heitor', papel: 'Coordenação de produção' } });
  raiz.VybeRelEquipe = Object.freeze({ relatorio });
})(typeof window !== 'undefined' ? window : globalThis);
