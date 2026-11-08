// shared/pessoas-calculos.js — as contas do setor de Pessoas (Paulo, 07/11/2026).
//
// Funções puras, sem banco, sem DOM e sem rede: o servidor (server/pessoas.js) e a
// tela (vybe-mundo-pessoas.js) usam as mesmas. No navegador ficam em
// window.VybePessoasCalculos; no Node, module.exports (como
// shared/escritorio-trabalho-calculos.js).
//
// ── Produtividade ──────────────────────────────────────────────────────────────
// Score de 0 a 100 por pessoa no mês, a partir de quatro fatos do banco:
//  - prazo   = entregas no prazo ÷ entregas com data (a data do cliente manda:
//              veiculação; sem ela, o prazo interno).
//  - volume  = entregas ÷ meta do cargo no mês (proporcional aos dias que já
//              passaram, no mês corrente), no máximo 1.
//  - ajustes = 1 − peças que voltaram em Alteração ÷ entregas, no mínimo 0.
//  - atrasos = 1 − abertas atrasadas ÷ (entregas + abertas atrasadas).
// Score = média ponderada dos componentes que têm dado, com os pesos que os donos
// escolhem. Componente sem dado (nenhuma entrega, nenhuma meta, sem histórico de
// status) sai da conta e o peso dele também: ninguém perde ponto por falta de dado.
// Sem nenhum componente, o score é null ("ainda sem dado no mês").
(function (raiz) {
  'use strict';

  const PESOS_PADRAO = Object.freeze({ prazo: 35, volume: 30, ajustes: 20, atrasos: 15 });
  const COMPONENTES = Object.freeze([
    ['prazo', 'Entregas no prazo'], ['volume', 'Volume do mês'], ['ajustes', 'Poucos ajustes'], ['atrasos', 'Fila sem atraso'],
  ]);
  // Entregas por mês, por cargo (a função do Escritório). Ponto de partida; os donos ajustam.
  const METAS_PADRAO = Object.freeze({ criacao: 40, producao: 20, atendimento: 30, agendamento: 60, gestao: 20, padrao: 25 });
  const CARGOS = Object.freeze({ criacao: 'Criação', producao: 'Produção', atendimento: 'Atendimento', agendamento: 'Agendamento', gestao: 'Gestão', padrao: 'Sem cargo definido' });
  const CAPACIDADE_PADRAO = 12; // itens por pessoa por semana (peças + etapas de projeto)

  // ── datas (texto YYYY-MM-DD, sem fuso) ─────────────────────────────────────────
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const emUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const somarDias = (iso, n) => new Date(emUtc(iso) + n * 864e5).toISOString().slice(0, 10);
  const diasEntre = (de, ate) => Math.round((emUtc(ate) - emUtc(de)) / 864e5);
  const diaDaSemana = (iso) => new Date(emUtc(iso)).getUTCDay();
  const inicioDaSemana = (iso) => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));
  const dataValida = (s) => typeof s === 'string' && ISO.test(s) && new Date(emUtc(s)).toISOString().slice(0, 10) === s;
  const mesValido = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  function limitesDoMes(mes) {
    const de = mes + '-01', proximo = somarDias(de, 32).slice(0, 7) + '-01';
    return { de, ate: somarDias(proximo, -1), dias: diasEntre(de, proximo) };
  }
  const util = (iso) => ![0, 6].includes(diaDaSemana(iso));
  function somarDiasUteis(iso, n) {
    let d = iso, falta = n;
    while (falta > 0) { d = somarDias(d, 1); if (util(d)) falta--; }
    return d;
  }

  // ── produtividade ──────────────────────────────────────────────────────────────
  function normalizarPesos(p) {
    const saida = {};
    for (const [k] of COMPONENTES) {
      const v = p && p[k] != null ? Number(p[k]) : PESOS_PADRAO[k];
      saida[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : PESOS_PADRAO[k];
    }
    if (!Object.values(saida).some((v) => v > 0)) return { ...PESOS_PADRAO };
    return saida;
  }
  // Valida pesos vindos de quem edita: inteiros 0–100, ao menos um acima de zero.
  function validarPesos(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Pesos inválidos.';
    for (const [k, nome] of COMPONENTES) {
      const v = p[k];
      if (!Number.isInteger(v) || v < 0 || v > 100) return `${nome}: use um número inteiro de 0 a 100.`;
    }
    if (!COMPONENTES.some(([k]) => p[k] > 0)) return 'Pelo menos um peso precisa ser maior que zero.';
    return '';
  }
  function validarMetas(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return 'Metas inválidas.';
    for (const k of Object.keys(CARGOS)) {
      const v = m[k];
      if (!Number.isInteger(v) || v < 0 || v > 1000) return `${CARGOS[k]}: use um número inteiro de 0 a 1000.`;
    }
    return '';
  }
  // Meta do mês até hoje: no mês corrente, proporcional aos dias que passaram.
  function metaProporcional(meta, mes, hoje) {
    const m = Number(meta);
    if (!Number.isFinite(m) || m <= 0) return 0;
    const { de, ate, dias } = limitesDoMes(mes);
    if (!dataValida(hoje) || hoje > ate) return m;
    if (hoje < de) return 0;
    return Math.max(1, Math.round(m * (diasEntre(de, hoje) + 1) / dias));
  }
  const n0 = (v) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0; };
  // fatos: { entregues, comData, noPrazo, ajustes (null = sem histórico), atrasadas, meta }
  function componentes(f) {
    const entregues = n0(f.entregues), comData = Math.min(n0(f.comData), entregues), noPrazo = Math.min(n0(f.noPrazo), comData);
    const atrasadas = n0(f.atrasadas), meta = n0(f.meta);
    const ajustes = f.ajustes == null ? null : n0(f.ajustes);
    return {
      prazo: comData ? noPrazo / comData : null,
      volume: meta ? Math.min(1, entregues / meta) : null,
      ajustes: ajustes == null || !entregues ? null : Math.max(0, 1 - ajustes / entregues),
      atrasos: entregues + atrasadas ? 1 - atrasadas / (entregues + atrasadas) : null,
    };
  }
  function pontuar(fatos, pesos) {
    const w = normalizarPesos(pesos), c = componentes(fatos || {});
    let soma = 0, total = 0;
    for (const [k] of COMPONENTES) if (c[k] != null && w[k] > 0) { soma += w[k] * c[k]; total += w[k]; }
    return { score: total ? Math.round((soma / total) * 100) : null, componentes: c, pesos: w };
  }
  // Frases curtas para a pessoa (tom humano: o que foi bem primeiro, o que ajustar depois).
  function explicar(f) {
    const entregues = n0(f.entregues), comData = n0(f.comData), noPrazo = n0(f.noPrazo), atrasadas = n0(f.atrasadas), meta = n0(f.meta);
    const frases = [];
    if (comData) frases.push(`${noPrazo} de ${comData} ${comData === 1 ? 'entrega' : 'entregas'} no prazo`);
    frases.push(meta ? `${entregues} de ${meta} entregas da meta até agora` : `${entregues} ${entregues === 1 ? 'entrega' : 'entregas'} no mês`);
    if (f.ajustes != null && entregues) frases.push(n0(f.ajustes) ? `${n0(f.ajustes)} ${n0(f.ajustes) === 1 ? 'peça voltou' : 'peças voltaram'} para ajuste` : 'nenhuma peça voltou para ajuste');
    frases.push(atrasadas ? `${atrasadas} ${atrasadas === 1 ? 'peça aberta atrasada' : 'peças abertas atrasadas'}` : 'nada atrasado na fila');
    return frases;
  }
  // Conquistas do mês: só reconhecimento, nunca punição.
  const CONQUISTAS = Object.freeze({
    pontual: ['Pontualidade total', 'Todas as entregas do mês no prazo (5 ou mais).'],
    meta: ['Meta do cargo', 'Bateu a meta de entregas do cargo.'],
    capricho: ['Capricho', 'Cinco ou mais entregas sem nenhuma voltar para ajuste.'],
    em_dia: ['Fila em dia', 'Três ou mais entregas e nada atrasado.'],
    destaque: ['Mais entregas', 'O maior volume de entregas da equipe no mês.'],
  });
  function conquistasDe(f, { maiorVolume = 0 } = {}) {
    const entregues = n0(f.entregues), comData = n0(f.comData), noPrazo = n0(f.noPrazo), meta = n0(f.meta);
    const lista = [];
    if (comData >= 5 && noPrazo >= comData) lista.push('pontual');
    if (meta && entregues >= meta) lista.push('meta');
    if (f.ajustes != null && entregues >= 5 && n0(f.ajustes) === 0) lista.push('capricho');
    if (entregues >= 3 && n0(f.atrasadas) === 0) lista.push('em_dia');
    if (maiorVolume > 0 && entregues === maiorVolume) lista.push('destaque');
    return lista.map((id) => ({ id, titulo: CONQUISTAS[id][0], texto: CONQUISTAS[id][1] }));
  }
  // pessoas: [{ id, nome, cargo, entregues, comData, noPrazo, ajustes, atrasadas, meta }]
  function ranking(pessoas, pesos) {
    const lista = (pessoas || []).map((p) => ({ ...p, ...pontuar(p, pesos), frases: explicar(p) }));
    const maiorVolume = lista.reduce((m, p) => Math.max(m, n0(p.entregues)), 0);
    for (const p of lista) p.conquistas = conquistasDe(p, { maiorVolume });
    lista.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || n0(b.entregues) - n0(a.entregues) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    let pos = 0;
    for (const p of lista) p.posicao = p.score == null ? null : ++pos;
    return lista;
  }

  // ── carga da semana ────────────────────────────────────────────────────────────
  // pecas: [{ pessoa_id, data }] (abertas, data = prazo ou veiculação); etapas: [{ responsavel, inicio, fim, esforco, feita }]
  function cargaDaSemana({ pessoas = [], pecas = [], etapas = [], inicio, capacidade = CAPACIDADE_PADRAO }) {
    const fim = somarDias(inicio, 6), cap = Math.max(1, n0(capacidade) || CAPACIDADE_PADRAO);
    const mapa = new Map(pessoas.map((p) => [String(p.id), { id: String(p.id), nome: p.nome, pecas: 0, atrasadas: 0, etapas: 0 }]));
    for (const x of pecas) {
      const m = mapa.get(String(x.pessoa_id)); if (!m || !dataValida(x.data)) continue;
      if (x.data < inicio) m.atrasadas++;
      else if (x.data <= fim) m.pecas++;
    }
    for (const e of etapas) {
      const m = mapa.get(String(e.responsavel)); if (!m || e.feita || !dataValida(e.inicio) || !dataValida(e.fim)) continue;
      if (e.inicio <= fim && e.fim >= inicio) m.etapas += Math.max(1, Math.min(3, n0(e.esforco) || 1));
    }
    return [...mapa.values()].map((m) => {
      const total = m.pecas + m.atrasadas + m.etapas, pct = Math.round(total / cap * 100);
      const nivel = pct > 100 ? 'sobrecarregada' : pct >= 80 ? 'cheia' : pct >= 30 ? 'ok' : 'leve';
      return { ...m, total, pct, nivel };
    }).sort((a, b) => b.pct - a.pct || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  // ── projetos: linha do tempo (Gantt simples) ───────────────────────────────────
  function linhaDoTempo(projetos, hoje) {
    const datas = [];
    for (const p of projetos || []) for (const d of [p.inicio, p.fim, ...(p.etapas || []).flatMap((e) => [e.inicio, e.fim])]) if (dataValida(d)) datas.push(d);
    const base = dataValida(hoje) ? hoje : datas[0];
    if (!base) return { de: null, ate: null, dias: 0, semanas: [], projetos: [], hoje: null };
    datas.push(base);
    datas.sort();
    const de = inicioDaSemana(datas[0]), ate = somarDias(inicioDaSemana(datas[datas.length - 1]), 6);
    const dias = diasEntre(de, ate) + 1;
    const pos = (ini, fim) => {
      if (!dataValida(ini) || !dataValida(fim) || fim < ini) return null;
      return { esq: diasEntre(de, ini) / dias * 100, larg: (diasEntre(ini, fim) + 1) / dias * 100 };
    };
    const semanas = [];
    for (let d = de; d <= ate; d = somarDias(d, 7)) semanas.push({ inicio: d, esq: diasEntre(de, d) / dias * 100 });
    return {
      de, ate, dias, semanas,
      hoje: dataValida(hoje) ? (diasEntre(de, hoje) + .5) / dias * 100 : null,
      projetos: (projetos || []).map((p) => ({ ...p, pos: pos(p.inicio, p.fim),
        etapas: (p.etapas || []).map((e) => ({ ...e, pos: pos(e.inicio, e.fim), atrasada: !e.feita && dataValida(e.fim) && dataValida(hoje) && e.fim < hoje })) })),
    };
  }

  // ── RH: prazo (SLA) dos pedidos ────────────────────────────────────────────────
  // Tipo → [rótulo, dias úteis de resposta (padrão; os donos ajustam)]. "folha" e "beneficio"
  // ficam só para ler pedidos antigos: o formulário oferece TIPOS_PEDIDO (Paulo, 08/11/2026).
  const TIPOS_RH = Object.freeze({
    ferias: ['Férias ou folga', 5], documento: ['Documento ou declaração', 2], reembolso: ['Reembolso', 3],
    equipamento: ['Equipamento', 3], outro: ['Outro assunto', 3], folha: ['Pagamento ou folha', 2], beneficio: ['Benefício', 3],
  });
  const TIPOS_PEDIDO = Object.freeze(['ferias', 'documento', 'reembolso', 'equipamento', 'outro']);
  const STATUS_RH = Object.freeze({ aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido', recusado: 'Recusado', cancelado: 'Cancelado' });
  const ENCERRADOS_RH = Object.freeze(['resolvido', 'recusado', 'cancelado']);
  const PRAZO_MAXIMO_DIAS = 30;
  // Prazos configurados ({ tipo: dias }) por cima dos padrões; valor inválido volta ao padrão.
  function normalizarPrazos(cfg) {
    const saida = {};
    for (const [k, [, padrao]] of Object.entries(TIPOS_RH)) {
      const v = cfg && cfg[k] != null ? Number(cfg[k]) : padrao;
      saida[k] = Number.isInteger(v) && v >= 1 && v <= PRAZO_MAXIMO_DIAS ? v : padrao;
    }
    return saida;
  }
  // Para quem edita: todos os tipos do formulário, inteiros de 1 a 30 dias úteis.
  function validarPrazos(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Prazos inválidos.';
    for (const k of TIPOS_PEDIDO) {
      const v = p[k];
      if (!Number.isInteger(v) || v < 1 || v > PRAZO_MAXIMO_DIAS) return `${TIPOS_RH[k][0]}: use de 1 a ${PRAZO_MAXIMO_DIAS} dias úteis.`;
    }
    return '';
  }
  const diasDoTipo = (tipo, prazos) => {
    const v = prazos ? Number(prazos[tipo]) : NaN;
    return Number.isInteger(v) && v >= 1 && v <= PRAZO_MAXIMO_DIAS ? v : (TIPOS_RH[tipo] || TIPOS_RH.outro)[1];
  };
  const prazoSla = (tipo, criadoDia, prazos) => somarDiasUteis(criadoDia, diasDoTipo(tipo, prazos));
  function situacaoSla(pedido, hoje) {
    if (ENCERRADOS_RH.includes(pedido.status)) return 'encerrado';
    if (!dataValida(pedido.prazo) || !dataValida(hoje)) return 'sem_prazo';
    if (pedido.prazo < hoje) return 'atrasado';
    if (pedido.prazo === hoje) return 'vence_hoje';
    return 'no_prazo';
  }
  // Dias úteis depois de `de` até `ate` (inclusive): pedido de sexta respondido na segunda = 1.
  function diasUteisEntre(de, ate) {
    if (!dataValida(de) || !dataValida(ate) || ate <= de) return 0;
    let n = 0;
    for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1)) if (util(d)) n++;
    return n;
  }
  // Números da fila. pedidos: [{ status, prazo, criado_dia, respondido_dia }]
  //  - abertos = aberto + em andamento; foraDoPrazo = desses, os com prazo vencido;
  //  - tempo médio = dias úteis do pedido até a resposta (resolvido ou recusado; cancelado não conta).
  function indicadoresPedidos(pedidos, hoje) {
    const lista = pedidos || [];
    const abertos = lista.filter((p) => !ENCERRADOS_RH.includes(p.status));
    const fora = abertos.filter((p) => situacaoSla(p, hoje) === 'atrasado');
    const resp = lista.filter((p) => ['resolvido', 'recusado'].includes(p.status) && dataValida(p.criado_dia) && dataValida(p.respondido_dia));
    const dias = resp.map((p) => diasUteisEntre(p.criado_dia, p.respondido_dia));
    const noPrazo = resp.filter((p) => !dataValida(p.prazo) || p.respondido_dia <= p.prazo).length;
    return {
      abertos: abertos.length, foraDoPrazo: fora.length, respondidos: resp.length,
      tempoMedioDias: dias.length ? Math.round(dias.reduce((t, d) => t + d, 0) / dias.length * 10) / 10 : null,
      noPrazoPct: resp.length ? Math.round(noPrazo / resp.length * 100) : null,
    };
  }

  // ── clima / eNPS ───────────────────────────────────────────────────────────────
  // DIMENSOES = a pesquisa trimestral antiga (tabela vybe_clima_respostas, 07/11).
  // DIMENSOES_PESQUISA = a pesquisa que os donos abrem com período (08/11/2026).
  const DIMENSOES = Object.freeze([
    ['lideranca', 'Liderança'], ['ambiente', 'Ambiente'], ['crescimento', 'Crescimento'], ['processos', 'Processos'], ['beneficios', 'Benefícios'],
  ]);
  const DIMENSOES_PESQUISA = Object.freeze([
    ['lideranca', 'Liderança'], ['comunicacao', 'Comunicação'], ['reconhecimento', 'Reconhecimento'], ['carga', 'Carga de trabalho'], ['ambiente', 'Ambiente'],
  ]);
  const MINIMO_CLIMA = 3;
  const trimestreDe = (iso) => `${iso.slice(0, 4)}-T${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
  function validarResposta(r, dimensoes = DIMENSOES) {
    if (!r || typeof r !== 'object') return 'Resposta inválida.';
    if (!Number.isInteger(r.enps) || r.enps < 0 || r.enps > 10) return 'Escolha uma nota de 0 a 10 para a recomendação.';
    for (const [k, nome] of dimensoes) if (!Number.isInteger(r[k]) || r[k] < 1 || r[k] > 5) return `${nome}: escolha de 1 a 5.`;
    if (r.comentario != null && (typeof r.comentario !== 'string' || r.comentario.length > 1000)) return 'Comentário: até 1.000 caracteres.';
    return '';
  }
  // eNPS = % de promotores (9 e 10) − % de detratores (0 a 6), de −100 a 100.
  function calcularEnps(notas) {
    const lista = (notas || []).map(Number).filter((n) => Number.isFinite(n));
    const n = lista.length, promotores = lista.filter((x) => x >= 9).length, detratores = lista.filter((x) => x <= 6).length;
    return { n, promotores, neutros: n - promotores - detratores, detratores, enps: n ? Math.round((promotores - detratores) / n * 100) : null };
  }
  // Anonimato: abaixo do mínimo de respostas não sai número nenhum, só a contagem.
  const resultadoLiberado = (n, minimo = MINIMO_CLIMA) => Number(n) >= Math.max(1, Number(minimo) || MINIMO_CLIMA);
  function mediaDe(lista, k) {
    const v = (lista || []).map((r) => Number(r[k])).filter((x) => Number.isFinite(x));
    return v.length ? Math.round(v.reduce((t, x) => t + x, 0) / v.length * 10) / 10 : null;
  }
  function agregarClima(respostas, minimo = MINIMO_CLIMA, dimensoes = DIMENSOES) {
    const lista = respostas || [], n = lista.length;
    if (!resultadoLiberado(n, minimo)) return { respostas: n, minimo, liberado: false };
    const e = calcularEnps(lista.map((r) => r.enps));
    return {
      respostas: n, minimo, liberado: true,
      enps: e.enps, promotores: e.promotores, neutros: e.neutros, detratores: e.detratores,
      dimensoes: dimensoes.map(([id, nome]) => ({ id, nome, media: mediaDe(lista, id) })),
    };
  }
  // Pesquisa com período: agendada (abre depois de hoje), aberta, encerrada (passou do fim ou os donos encerraram).
  function situacaoPesquisa(p, hoje) {
    if (!p) return 'encerrada';
    if (p.encerrada_em || (dataValida(p.fecha) && p.fecha < hoje)) return 'encerrada';
    if (dataValida(p.abre) && p.abre > hoje) return 'agendada';
    return 'aberta';
  }
  function validarPesquisa(p, hoje) {
    if (!p || typeof p !== 'object') return 'Pesquisa inválida.';
    if (typeof p.titulo !== 'string' || !p.titulo.trim() || p.titulo.trim().length > 120) return 'Dê um nome de até 120 caracteres à pesquisa.';
    if (!dataValida(p.abre) || !dataValida(p.fecha)) return 'Informe as datas de abertura e de fim.';
    if (p.fecha < p.abre) return 'O fim vem depois da abertura.';
    if (dataValida(hoje) && p.fecha < hoje) return 'O fim da pesquisa não pode estar no passado.';
    if (diasEntre(p.abre, p.fecha) > 60) return 'A pesquisa fica aberta no máximo 60 dias.';
    return '';
  }
  // Histórico: [{ id, titulo, abre, fecha, resultado }] (resultado = agregarClima), do mais novo ao mais
  // antigo, com a variação do eNPS (e de cada dimensão) contra a pesquisa liberada anterior.
  function historicoClima(pesquisas) {
    const lista = [...(pesquisas || [])].sort((a, b) => String(a.abre).localeCompare(String(b.abre)) || Number(a.id) - Number(b.id));
    let anterior = null;
    const saida = lista.map((p) => {
      const r = p.resultado || { liberado: false };
      const vs = r.liberado && anterior ? versus(r.enps, anterior.enps) : { delta: null, pct: null };
      const vsDimensoes = r.liberado && anterior ? Object.fromEntries((r.dimensoes || []).map((d) => {
        const a = (anterior.dimensoes || []).find((x) => x.id === d.id);
        return [d.id, a ? versus(d.media, a.media).delta : null];
      })) : {};
      if (r.liberado) anterior = r;
      return { ...p, vs, vsDimensoes };
    });
    return saida.reverse();
  }

  // ── Academy ────────────────────────────────────────────────────────────────────
  // A trilha de boas-vindas (placeholders: quem administra troca títulos e links).
  const TRILHA_PADRAO = Object.freeze({
    nome: 'Primeira semana na Vybe',
    descricao: 'O básico para começar bem: quem somos, como a produção anda e onde fica cada coisa.',
    aulas: Object.freeze([
      ['Boas-vindas: quem é a Vybe', 'video', 10], ['Como funciona o Vybe OS', 'video', 15], ['Fluxo de uma peça: do briefing à veiculação', 'doc', 15],
      ['Clientes ativos e as carteiras', 'doc', 10], ['Padrão visual e tom de voz', 'doc', 15], ['Combinados da equipe e o RH', 'doc', 10],
    ].map(([titulo, tipo, minutos]) => Object.freeze({ titulo, tipo, minutos, link: '' }))),
  });
  function progressoDaTrilha(aulas, feitas) {
    const ids = new Set((feitas || []).map(String)), total = (aulas || []).length;
    const concluidas = (aulas || []).filter((a) => ids.has(String(a.id))).length;
    return { total, concluidas, pct: total ? Math.round(concluidas / total * 100) : 0 };
  }

  // ── período (Mensal ou Anual) e "vs anterior" ──────────────────────────────────
  // ref = 'YYYY-MM'. Mensal: o mês e o anterior; Anual: o ano de ref e o ano anterior.
  function periodoDe(tipo, ref) {
    const ano = Number(ref.slice(0, 4));
    if (tipo === 'anual') return { tipo, de: `${ano}-01-01`, ate: `${ano}-12-31`, antes: { de: `${ano - 1}-01-01`, ate: `${ano - 1}-12-31` }, rotulo: String(ano) };
    const { de, ate } = limitesDoMes(ref), anterior = limitesDoMes(somarDias(de, -1).slice(0, 7));
    return { tipo: 'mensal', de, ate, antes: { de: anterior.de, ate: anterior.ate }, rotulo: ref };
  }
  // Variação contra o período anterior: número e sentido (null quando não há base).
  function versus(atual, anterior) {
    const a = Number(atual), b = Number(anterior);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { delta: null, pct: null };
    return { delta: Math.round((a - b) * 10) / 10, pct: b ? Math.round((a - b) / Math.abs(b) * 100) : null };
  }

  // ── RH: visão geral (headcount, admissões, desligamentos, tempo de casa) ───────
  // pessoas: [{ id, entrada: 'YYYY-MM-DD' | null, saida: 'YYYY-MM-DD' | null }]
  // Headcount no fim do período = entrou até o fim e não saiu até lá. Tempo médio de casa
  // (meses) de quem está na casa no fim do período e tem entrada conhecida.
  function indicadoresRh(pessoas, periodo) {
    const calc = (de, ate) => {
      let headcount = 0, admissoes = 0, desligamentos = 0, somaMeses = 0, comEntrada = 0;
      for (const p of pessoas || []) {
        const ent = dataValida(p.entrada) ? p.entrada : null, sai = dataValida(p.saida) ? p.saida : null;
        if (ent && ent >= de && ent <= ate) admissoes++;
        if (sai && sai >= de && sai <= ate) desligamentos++;
        const naCasa = (!ent || ent <= ate) && (!sai || sai > ate);
        if (!naCasa) continue;
        headcount++;
        if (ent) { somaMeses += diasEntre(ent, ate) / 30.44; comEntrada++; }
      }
      return { headcount, admissoes, desligamentos, tempoMedioMeses: comEntrada ? Math.round(somaMeses / comEntrada * 10) / 10 : null };
    };
    const atual = calc(periodo.de, periodo.ate), antes = calc(periodo.antes.de, periodo.antes.ate);
    return { atual, antes, vs: Object.fromEntries(Object.keys(atual).map((k) => [k, versus(atual[k], antes[k])])) };
  }

  // ── Recrutamento ───────────────────────────────────────────────────────────────
  // Etapas configuráveis; a última positiva é "Aprovado" (contratado) e a de saída é "Reprovado".
  const ETAPAS_RECRUTAMENTO_PADRAO = Object.freeze(['Novos', 'Entrevista', 'Aprovado', 'Reprovado']);
  function validarEtapas(lista) {
    if (!Array.isArray(lista) || lista.length < 2 || lista.length > 10) return 'Use de 2 a 10 etapas.';
    const vistos = new Set();
    for (const e of lista) {
      if (typeof e !== 'string' || !e.trim() || e.trim().length > 40) return 'Cada etapa precisa de um nome de até 40 caracteres.';
      const k = e.trim().toLowerCase(); if (vistos.has(k)) return 'Há etapas repetidas.'; vistos.add(k);
    }
    return '';
  }
  // candidatos: [{ criado_em: 'YYYY-MM-DD', contratado_em: 'YYYY-MM-DD' | null }]
  function tempoMedioContratacao(candidatos, periodo) {
    const dias = (candidatos || []).filter((c) => dataValida(c.contratado_em) && dataValida(c.criado_em)
      && (!periodo || (c.contratado_em >= periodo.de && c.contratado_em <= periodo.ate))).map((c) => Math.max(0, diasEntre(c.criado_em, c.contratado_em)));
    return dias.length ? { dias: Math.round(dias.reduce((t, d) => t + d, 0) / dias.length), contratacoes: dias.length } : { dias: null, contratacoes: 0 };
  }

  // ── Documentos ─────────────────────────────────────────────────────────────────
  const TIPOS_DOCUMENTO = Object.freeze({ contrato: 'Contrato', aditivo: 'Aditivo', nda: 'Termo de confidencialidade', exame: 'Exame', certificado: 'Certificado', outro: 'Outro' });
  const AVISO_RENOVACAO_DIAS = 30;
  // vencido (renovação passou), renovar (até 30 dias), em_dia, sem_renovacao, encerrado.
  function situacaoDocumento(d, hoje) {
    if (d.status === 'encerrado') return 'encerrado';
    if (!dataValida(d.renovacao)) return 'sem_renovacao';
    if (d.renovacao < hoje) return 'vencido';
    if (diasEntre(hoje, d.renovacao) <= AVISO_RENOVACAO_DIAS) return 'renovar';
    return 'em_dia';
  }

  const api = Object.freeze({
    PESOS_PADRAO, COMPONENTES, METAS_PADRAO, CARGOS, CAPACIDADE_PADRAO, CONQUISTAS, TIPOS_RH, TIPOS_PEDIDO, STATUS_RH, ENCERRADOS_RH, PRAZO_MAXIMO_DIAS,
    DIMENSOES, DIMENSOES_PESQUISA, MINIMO_CLIMA, TRILHA_PADRAO, ETAPAS_RECRUTAMENTO_PADRAO, TIPOS_DOCUMENTO, AVISO_RENOVACAO_DIAS,
    normalizarPesos, validarPesos, validarMetas, metaProporcional, componentes, pontuar, explicar, conquistasDe, ranking,
    cargaDaSemana, linhaDoTempo, normalizarPrazos, validarPrazos, prazoSla, situacaoSla, diasUteisEntre, indicadoresPedidos,
    trimestreDe, validarResposta, calcularEnps, resultadoLiberado, agregarClima, situacaoPesquisa, validarPesquisa, historicoClima, progressoDaTrilha,
    periodoDe, versus, indicadoresRh, validarEtapas, tempoMedioContratacao, situacaoDocumento,
    util: Object.freeze({ somarDias, diasEntre, inicioDaSemana, dataValida, mesValido, limitesDoMes, somarDiasUteis }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybePessoasCalculos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
