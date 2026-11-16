// vybe-mundo-performance.js — a Performance da Gestão: medir e acompanhar a operação inteira.
//
// Paulo, 09/11/2026: "o performance em gestão seria voltado a tudo, todos operacionais e processos" (a Produtividade do
// RH é a do time, pessoa a pessoa, para RH). Aqui a pergunta é como a máquina da agência está andando num período:
// quanto saiu, no prazo ou não, quanto tempo leva, onde trava, por etapa, departamento, pessoa, formato e cliente, e os
// processos em volta (briefing, responsável, captação, solicitações, peças esquecidas).
//
// Regras (as mesmas da visão do dono, vybe-dono-metricas.js): a situação de cada peça é a da função oficial
// VybeDono.util.situacaoDaPeca (veiculação primeiro; entregue pelo status final; pausada e esquecida fora do atraso).
// Dia da entrega = dia de status_updated_at de uma peça entregue. No prazo = entregue até a data do cliente (veiculação;
// sem ela, o prazo). Tempo de entrega = do cadastro (criado_em) à entrega. Peça de vários responsáveis conta para cada um.
//
//   VybePerformance.calcular({ demandas, solicitacoes, pessoas, hoje: 'AAAA-MM-DD', dias: 30 }) → números (sem DOM)
//   VybePerformance.html(alvo)                                                               → desenha no alvo
//   VybePerformance.escolher({ etapa, todas, vista, foco })                                  → as escolhas da tela
(function (raiz) {
  'use strict';
  const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '3 meses'], [180, '6 meses']];
  const soDia = (v) => { const s = String(v || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) && s.length <= 10) return s.slice(0, 10); const d = new Date(s); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d) : ''; };
  const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
  const segunda = (iso) => { const x = new Date(`${iso}T12:00:00Z`), w = (x.getUTCDay() + 6) % 7; return somarDias(iso, -w); };
  const mediana = (l) => { const v = l.filter((n) => Number.isFinite(n)).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const pctDe = (a, b) => (b ? Math.round((a / b) * 100) : null);
  // Status no meio da frase ("22 em pode fazer"); o valor de comparação continua o do Monday.
  const stFrase = (s, inicio = false) => (typeof raiz.statusEmFrase === 'function' ? raiz.statusEmFrase(s, inicio) : s);
  const nomesDe = (d, pessoas) => {
    const ids = Array.isArray(d.responsavel_ids) ? d.responsavel_ids.map(String) : d.responsavel_id ? [String(d.responsavel_id)] : [];
    const porId = ids.map((id) => pessoas?.[id]).filter(Boolean);
    if (porId.length) return [...new Set(porId)];
    return [...new Set(String(d.responsavel || '').split(',').map((s) => s.trim()).filter(Boolean))];
  };
  const clientesDe = (d) => [...new Set((Array.isArray(d.clientes) && d.clientes.length ? d.clientes : [d.cliente]).map((c) => String(c || '').trim()).filter((c) => c && c !== 'Sem cliente'))];

  function grupoNovo() { return { entregues: 0, noPrazo: 0, atrasadasEnt: 0, tempos: [], abertas: 0, atrasadas: 0, paradas: 0, alteracao: 0, ids: { entregues: [], abertas: [], atrasadas: [] } }; }
  function fechar(g) {
    const julgadas = g.noPrazo + g.atrasadasEnt;
    return { entregues: g.entregues, noPrazo: g.noPrazo, atrasadasEnt: g.atrasadasEnt, noPrazoPct: pctDe(g.noPrazo, julgadas), tempoMediano: mediana(g.tempos),
      abertas: g.abertas, atrasadas: g.atrasadas, paradas: g.paradas, alteracao: g.alteracao, ids: g.ids };
  }

  function calcular({ demandas = [], solicitacoes = [], pessoas = null, hoje, dias = 30, situacao = null } = {}) {
    hoje = hoje || soDia(new Date());
    const sit = situacao || raiz.VybeDono?.util?.situacaoDaPeca;
    if (typeof sit !== 'function') return null;
    const corte = dias ? somarDias(hoje, -(dias - 1)) : '';
    const total = grupoNovo(), porStatus = new Map(), porGrupo = new Map(), porPessoa = new Map(), porFormato = new Map(), porCliente = new Map();
    const semanas = new Map(), processos = { semBriefing: [], semResponsavel: [], captacaoAgendar: [], esquecidas: [], pausadas: [], semData: [] };
    const pegar = (m, k) => { if (!m.has(k)) m.set(k, grupoNovo()); return m.get(k); };
    const nSemanas = Math.min(26, Math.max(1, Math.ceil((dias || 182) / 7)));
    const iniSem = segunda(somarDias(hoje, -(nSemanas - 1) * 7));
    for (let i = 0; i < nSemanas; i++) semanas.set(somarDias(iniSem, i * 7), { entregues: 0, noPrazo: 0, atrasadas: 0, criadas: 0 });
    for (const d of demandas) {
      const s = sit(d, { hoje }), id = String(d.id), grupos = [total];
      const chaves = { grupo: String(d.grupo || 'Sem grupo').trim() || 'Sem grupo', formato: String(d.formato || 'Sem formato').trim() || 'Sem formato' };
      grupos.push(pegar(porGrupo, chaves.grupo), pegar(porFormato, chaves.formato));
      for (const p of nomesDe(d, pessoas)) grupos.push(pegar(porPessoa, p));
      for (const c of clientesDe(d)) grupos.push(pegar(porCliente, c));
      const criado = soDia(d.criado_em);
      if (criado && semanas.has(segunda(criado))) semanas.get(segunda(criado)).criadas += 1;
      if (s.entregue) {
        const dia = soDia(d.status_updated_at);
        if (!dia || (corte && dia < corte) || dia > hoje) continue;
        const ref = s.referencia || '', noPrazo = ref ? dia <= ref : null, tempo = criado && criado <= dia ? diasEntre(criado, dia) : null;
        for (const g of grupos) {
          g.entregues += 1; g.ids.entregues.push(id);
          if (noPrazo === true) g.noPrazo += 1; else if (noPrazo === false) g.atrasadasEnt += 1;
          if (tempo != null) g.tempos.push(tempo);
        }
        const sem = semanas.get(segunda(dia));
        if (sem) { sem.entregues += 1; if (noPrazo === true) sem.noPrazo += 1; else if (noPrazo === false) sem.atrasadas += 1; }
        continue;
      }
      if (s.situacao === 'pausada') { processos.pausadas.push(id); continue; }
      if (s.situacao === 'esquecida') { processos.esquecidas.push(id); continue; }
      // Aberta: a fila de agora, por etapa (status) e em cada recorte.
      const st = String(d.status || 'Sem status').trim() || 'Sem status';
      const e = porStatus.get(st) || { status: st, cor: d.status_color || '', qtd: 0, idades: [], atrasadas: 0, ids: [], idsAtrasadas: [], porCliente: new Map() };
      e.qtd += 1; e.ids.push(id); if (s.idade != null) e.idades.push(s.idade); if (s.atrasada) e.atrasadas += 1; porStatus.set(st, e);
      // As atrasadas da etapa, por cliente, com os dias da mais antiga (a etapa abre no lugar com isto).
      if (s.atrasada) {
        e.idsAtrasadas.push(id);
        const venceu = s.referencia && s.referencia < hoje ? diasEntre(s.referencia, hoje) : 0;
        for (const c of clientesDe(d)) { const x = e.porCliente.get(c) || { cliente: c, qtd: 0, dias: 0 }; x.qtd += 1; x.dias = Math.max(x.dias, venceu); e.porCliente.set(c, x); }
      }
      const alteracao = s.chave === 'alteracao', parada = s.semAndamento && !s.esperaCliente && (s.idade ?? 0) >= 3;
      for (const g of grupos) {
        g.abertas += 1; g.ids.abertas.push(id);
        if (s.atrasada) { g.atrasadas += 1; g.ids.atrasadas.push(id); }
        if (parada) g.paradas += 1;
        if (alteracao) g.alteracao += 1;
      }
      if (d.tem_briefing === false) processos.semBriefing.push(id);
      if (raiz.VybeDono?.util?.semDono ? raiz.VybeDono.util.semDono(d) : !nomesDe(d, pessoas).length) processos.semResponsavel.push(id);
      if (/agendar capta/i.test(String(d.captacao || ''))) processos.captacaoAgendar.push(id);
      if (!s.referencia) processos.semData.push(id);
    }
    // Solicitações (quadro de demandas): abertas e com a conclusão planejada vencida.
    const solAbertas = [], solVencidas = [];
    for (const d of solicitacoes) {
      const s = sit(d, { hoje });
      if (s.entregue || s.situacao === 'pausada') continue;
      solAbertas.push(String(d.id));
      const c = String(d.conclusao_iso || d.prazo_iso || '');
      if (c && c < hoje) solVencidas.push(String(d.id));
    }
    const lista = (m, min = 1) => [...m.entries()].map(([nome, g]) => ({ nome, ...fechar(g) })).filter((x) => x.entregues + x.abertas >= min);
    const etapas = [...porStatus.values()].map((e) => ({ status: e.status, cor: e.cor, qtd: e.qtd, atrasadas: e.atrasadas, idadeMediana: mediana(e.idades), ids: e.ids, idsAtrasadas: e.idsAtrasadas,
      atrasadasPorCliente: [...e.porCliente.values()].sort((a, b) => b.qtd - a.qtd || b.dias - a.dias) }))
      .sort((a, b) => b.qtd * (1 + (a.idadeMediana || 0)) - a.qtd * (1 + (b.idadeMediana || 0)) || b.qtd - a.qtd);
    return {
      hoje, dias, corte, total: fechar(total), etapas,
      grupos: lista(porGrupo).sort((a, b) => b.entregues - a.entregues || b.abertas - a.abertas),
      pessoas: lista(porPessoa).sort((a, b) => b.entregues - a.entregues || b.abertas - a.abertas),
      formatos: lista(porFormato).sort((a, b) => b.entregues - a.entregues || b.abertas - a.abertas),
      clientes: lista(porCliente).sort((a, b) => b.atrasadas - a.atrasadas || b.entregues - a.entregues),
      semanas: [...semanas.entries()].map(([inicio, s]) => ({ inicio, ...s })),
      processos: { ...processos, solicitacoesAbertas: solAbertas, solicitacoesVencidas: solVencidas },
    };
  }

  // ---------- Desenho (no painel; usa as peças de vybe-mundo-setor.js) ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const n0 = (v) => Number(v || 0).toLocaleString('pt-BR');
  const dd = (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`);
  const pc = (v) => (v == null ? '—' : `${v}%`);
  const pl = (n, um, varios) => `${n0(n ?? 0)} ${Number(n) === 1 ? um : varios}`;
  let dias = 30, ultimo = null;
  try { const g = Number(localStorage.getItem('vybe.performance.dias')); if (PERIODOS.some(([d]) => d === g)) dias = g; } catch { /* sem guardar */ }

  function dados() {
    const todos = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
    const sol = typeof DADOS_DEMANDAS !== 'undefined' && Array.isArray(DADOS_DEMANDAS) ? DADOS_DEMANDAS : [];
    let pessoas = null; try { pessoas = raiz.VybeDono?.util?.pessoasDe?.(typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : []) || null; } catch { pessoas = null; }
    const hoje = typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : soDia(new Date());
    return { demandas: todos, solicitacoes: sol, pessoas, hoje, dias };
  }
  const pecaPorId = () => { const m = new Map(); for (const l of [typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : [], typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []]) for (const d of l || []) m.set(String(d.id), d); return m; };
  const itensDe = (ids) => { const m = pecaPorId(); return ids.map((id) => m.get(String(id))).filter(Boolean).map((d) => ({ id: d.id, nome: d.nome || 'Peça', sub: [d.cliente, d.status, d.responsavel].filter(Boolean).join(' · '), subHtml: typeof pecaMetaHtml === 'function' ? pecaMetaHtml(d) : '', dirHtml: typeof pecaDatasHtml === 'function' ? pecaDatasHtml(d) : '' })); };
  const abrirPeca = (it) => { if (typeof raiz.openItemWorkspace === 'function') raiz.openItemWorkspace(String(it.id)); };

  // O número abre a lista por trás dele (o mesmo mini painel dos outros painéis).
  const prov = (raiz.VybeEspiarProvedores = raiz.VybeEspiarProvedores || {});
  prov.perf = (resto) => {
    const P = ultimo; if (!P) return null;
    const [tipo, qual = '', nome = ''] = String(resto).split('|');
    const TIT = { entregues: 'entregues no período', abertas: 'abertas agora', atrasadas: 'atrasadas agora' };
    if (tipo === 'etapaAtr') { const e = P.etapas.find((x) => x.status === qual); return e ? { titulo: `atrasadas em ${stFrase(e.status)}`, itens: itensDe(e.idsAtrasadas || []), clicar: abrirPeca } : null; }
    if (tipo === 'etapa') { const e = P.etapas.find((x) => x.status === qual); return e ? { titulo: `em ${stFrase(e.status)}`, itens: itensDe(e.ids), clicar: abrirPeca } : null; }
    if (tipo === 'proc') { const ids = P.processos[qual] || []; const T = { semBriefing: 'sem briefing', semResponsavel: 'sem responsável', captacaoAgendar: 'com captação a agendar', esquecidas: 'esquecidas (data vencida há 30+ dias)', pausadas: 'pausadas', semData: 'sem data', solicitacoesAbertas: 'solicitações abertas', solicitacoesVencidas: 'solicitações com conclusão vencida' }; return { titulo: T[qual] || qual, itens: itensDe(ids), clicar: abrirPeca }; }
    const fonte = tipo === 'total' ? P.total : (P[tipo] || []).find((x) => x.nome === nome);
    if (!fonte?.ids?.[qual]) return null;
    return { titulo: `${TIT[qual] || qual}${nome ? ' · ' + nome : ''}`, itens: itensDe(fonte.ids[qual]), clicar: abrirPeca };
  };

  function tabela(linhas, { cli = false, chave } = {}) {
    if (!linhas.length) return '<p class="vs-aviso">Sem dados no período.</p>';
    return `<div class="vs-tabela"><table class="vv-g-tabela vv-perf-tabela"><thead><tr><th>${cli ? 'Cliente' : 'Nome'}</th><th class="n">Entregues</th><th class="n">No prazo</th><th class="n">Tempo (med.)</th><th class="n">Abertas</th><th class="n">Atrasadas</th><th class="n">Paradas 3d+</th><th class="n">Em alteração</th></tr></thead><tbody>
      ${linhas.map((l) => { const b = (q, v, cls = '') => (v ? `<button type="button" class="vv-num ${cls}" data-espiar="perf:${chave}|${q}|${esc(l.nome)}">${n0(v)}</button>` : '0');
        return `<tr><td><b>${cli && typeof cliCor === 'function' ? cliCor(l.nome) : esc(l.nome)}</b></td><td class="n">${b('entregues', l.entregues)}</td><td class="n ${l.noPrazoPct != null && l.noPrazoPct < 80 ? 't-u2' : ''}">${pc(l.noPrazoPct)}</td><td class="n">${dd(l.tempoMediano)}</td><td class="n">${b('abertas', l.abertas)}</td><td class="n ${l.atrasadas ? 't-u1' : ''}">${b('atrasadas', l.atrasadas)}</td><td class="n ${l.paradas ? 't-u2' : ''}">${n0(l.paradas)}</td><td class="n">${n0(l.alteracao)}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  }

  // ─── Performance na direção V2 (prancha V2-M-Performance, aprovada pelo Paulo em 16/11/2026) ───────────────────
  // O esqueleto novo da tela, na casca do grupo E (.d3m-e-*, padrao-v2/zm-e-casca.css e zm-e-performance.css): no vidro,
  // o título (com a seta das telas da Gestão), o período, a busca e "Como funciona"; à esquerda, quatro números, a folha
  // "Onde a fila está" (uma linha por etapa; o pé mostra as atrasadas por cliente da etapa escolhida) e, lado a lado,
  // "Pede ação" e "Entregas por semana"; à direita, direto no vidro, o cartão laranja do Heitor (onde a fila trava), as
  // outras leituras da Gestão e as pessoas. As tabelas por departamento, formato, pessoa e cliente (que a prancha não
  // tem) abrem numa folha só, por "Ver por cliente" e por "Tabelas", e voltam para o painel.
  let etapaSel = '', etapasTodas = false, vista = 'painel', focoTabela = '';
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = { seta: '<path d="M9 6l6 6-6 6"/>', volta: '<path d="M15 6l-6 6 6 6"/>', lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.9M12 17h.01"/>',
    agenda: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', alerta: '<path d="M12 7v6M12 17h.01"/>', lapis: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>', certo: '<path d="M5 12l4 4 10-10"/>' };
  const estado = (op) => (typeof d3mEEstado === 'function' ? d3mEEstado(op)
    : op.tipo === 'carregando' ? `<div class="d3m-e-estado-carregando" role="status" aria-busy="true" aria-label="${esc(op.titulo || 'Carregando')}"></div>`
      : `<div class="d3m-e-estado d3m-e-estado-${op.tipo === 'erro' ? 'erro' : 'vazio'}" role="status"><b>${esc(op.titulo || '')}</b><span>${esc(op.texto || '')}</span>${op.acao || ''}</div>`);
  const iniciais = (nome) => { const p = String(nome || '').trim().split(/\s+/).filter(Boolean); return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '').slice(0, 2)).toUpperCase(); };
  // O status com o ponto na cor dele (.d3v-st), escrito como frase ("Pode fazer").
  const stPonto = (e) => { const cor = e.cor || (typeof corDeStatus === 'function' ? corDeStatus(e.status)?.cor : '') || ''; return `<span class="d3v-st"${cor ? ` style="--st:${esc(cor)}"` : ''} title="${esc(e.status)}"><i aria-hidden="true"></i>${esc(stFrase(e.status, true))}</span>`; };
  const AJUDA = ['Atrasada é a peça aberta com a data do cliente vencida (a veiculação; sem ela, o prazo). Pausada e esquecida não contam.',
    'Entregue é a peça no status final; o dia da entrega é o da última troca de status.',
    'No prazo é a entregue até a data do cliente. O tempo vai do cadastro à entrega (mediana).',
    'Peça de duas pessoas conta para as duas. Cada número abre as peças por trás dele.'];

  function topoHtml(sub) {
    const per = `<span class="d3m-e-per vv-perf-periodo" role="group" aria-label="Período">${PERIODOS.map(([d, r]) => `<button type="button" data-perf-dias="${d}" aria-pressed="${d === dias}">${r}</button>`).join('')}</span>`;
    const acoes = `${per}<button type="button" class="d3m-e-ico" data-perf-busca aria-label="Buscar" title="Buscar em todo o painel">${svg(IC.lupa)}</button>`
      + `<details class="d3m-e-troca d3m-e-ajuda"><summary class="d3m-e-ico" aria-label="Como funciona" title="Como funciona">${svg(IC.ajuda)}</summary><div class="d3m-e-pop d3m-e-ajuda-pop" role="note" aria-label="Como a Performance conta"><b class="d3m-e-ajuda-t">Como funciona</b>${AJUDA.map((t) => `<p class="d3m-e-ajuda-p">${esc(t)}</p>`).join('')}</div></details>`;
    return typeof d3mETopo === 'function' ? d3mETopo({ titulo: 'Performance', sub, setor: 'gestao', atual: 'performance', acoes })
      : `<div class="d3m-e-topo"><div class="d3m-e-tit"><span class="d3m-e-h" role="heading" aria-level="2">Performance</span><span class="d3m-e-sub">${esc(sub)}</span></div><div class="d3m-e-acoes">${acoes}</div></div>`;
  }
  // Cartão de número: o rótulo e o selo em cima; embaixo o número (com o "/ total" menor), a nota curta e, se houver, o anel.
  function kpiHtml({ rotulo, valor, de = '', sub = '', tom = '', selo = 't', icone = 'agenda', anel = null, espiar = '' }) {
    const tag = espiar ? 'button' : 'div';
    const pct = anel == null ? null : Math.max(0, Math.min(100, Math.round(anel)));
    return `<${tag}${espiar ? ` type="button" data-espiar="${espiar}" title="Ver as peças"` : ''} class="d3m-e-kpi${tom ? ' ' + tom : ''}"><span class="d3m-e-kpi-topo"><span>${esc(rotulo)}</span><span class="d3v-selo" data-k="${selo}">${svg(IC[icone] || IC.agenda)}</span></span>`
      + `<span class="d3m-e-kpi-baixo"><span class="d3m-e-kpi-txt"><b class="d3m-e-kpi-v">${valor}${de ? `<small class="d3m-e-kpi-de">${de}</small>` : ''}</b><small class="d3m-e-kpi-sub">${sub}</small></span>`
      + `${pct == null ? '' : `<svg class="d3m-e-anel" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17"/><circle cx="22" cy="22" r="17" stroke-dasharray="${(106.8 * pct / 100).toFixed(1)} 106.8"/></svg>`}</span></${tag}>`;
  }
  // "Onde a fila está": uma linha por etapa (o número abre as peças; "N atrasadas" escolhe a etapa do pé) e, no pé, as
  // atrasadas da etapa escolhida por cliente. Sem escolha, a primeira etapa com atraso.
  function filaHtml(P, cli) {
    const todas = P.etapas, vis = etapasTodas ? todas : todas.slice(0, 5), outras = todas.slice(5), nOutras = outras.reduce((s, e) => s + e.qtd, 0);
    const maxQtd = Math.max(1, ...todas.map((e) => e.qtd));
    const comAtraso = (e) => (e.atrasadasPorCliente || []).length > 0;
    const sel = vis.find((e) => e.status === etapaSel && comAtraso(e)) || vis.find(comAtraso) || null;
    const linhas = vis.map((e) => `<div class="d3m-e-fx-lin${e === sel ? ' on' : ''}"><span class="d3m-e-fx-st">${stPonto(e)}</span><span class="d3m-e-fx-barra"><i style="--v:${Math.round((e.qtd / maxQtd) * 100)}%"></i></span>`
      + `<button type="button" class="d3m-e-fx-n" data-espiar="perf:etapa|${esc(e.status)}" title="Ver as peças">${n0(e.qtd)}</button>`
      + (comAtraso(e) ? `<button type="button" class="d3m-e-fx-at" data-perf-etapa="${esc(e.status)}" aria-pressed="${e === sel}" title="Ver por cliente">${pl(e.atrasadas, 'atrasada', 'atrasadas')}</button>` : '<span class="d3m-e-fx-at calmo">em dia</span>') + '</div>').join('');
    let pe = '';
    if (sel) {
      const cs = sel.atrasadasPorCliente.slice(0, 3).map((c, i) => `<span class="d3m-e-fx-cli">${typeof logoDoClienteHtml === 'function' ? logoDoClienteHtml(c.cliente, { iniciais: iniciais(c.cliente) }) : `<i class="d3v-foto" aria-hidden="true">${esc(iniciais(c.cliente))}</i>`}<b>${cli(c.cliente)}</b><span>${n0(c.qtd)}${i === 0 && c.dias > 0 ? `, a mais antiga há ${pl(c.dias, 'dia', 'dias')}` : ''}</span></span>`).join('');
      const resto = sel.atrasadasPorCliente.length - 3;
      pe = `<div class="d3m-e-fx-pe"><span class="d3m-e-fx-pe-rot"${sel.idadeMediana != null ? ` title="Parada há ${dd(sel.idadeMediana)} (mediana)"` : ''}>Em ${esc(stFrase(sel.status, true))}, por cliente${sel.idadeMediana != null ? ` · há ${dd(sel.idadeMediana)}` : ''}</span>${cs}${resto > 0 ? `<span class="d3m-e-fx-pe-rot">e mais ${n0(resto)}</span>` : ''}`
        + `<button type="button" class="d3m-e-elo" data-espiar="perf:etapaAtr|${esc(sel.status)}">${sel.atrasadas === 1 ? 'abrir a atrasada' : `abrir as ${n0(sel.atrasadas)}`}</button></div>`;
    } else if (vis.length) pe = '<div class="d3m-e-fx-pe"><span class="d3m-e-fx-pe-rot">Nenhuma etapa com peça atrasada.</span></div>';
    const mais = outras.length ? `<button type="button" class="d3m-e-elo" data-perf-todas="${etapasTodas ? '0' : '1'}" aria-expanded="${etapasTodas}">${etapasTodas ? 'mostrar só as 5 maiores' : `mais ${pl(outras.length, 'etapa', 'etapas')}, com ${pl(nOutras, 'peça', 'peças')}`}</button>` : '';
    return `<section class="d3m-e-folha d3m-e-perf-fila${etapasTodas ? ' todas' : ''}" aria-label="Onde a fila está"><div class="d3m-e-cab"><b>Onde a fila está <span>· peças por etapa</span></b><span class="d3m-e-cab-dir">${mais}</span></div>`
      + (vis.length ? `<div class="d3m-e-fx-cab" aria-hidden="true"><span class="d3m-e-fx-st">Etapa</span><span class="d3m-e-fx-barra-rot">Peças na etapa</span><span class="d3m-e-fx-n"></span><span class="d3m-e-fx-at">Atrasadas</span></div><div class="d3m-e-fx-lista">${linhas}</div>${pe}`
        : `<div class="d3m-e-fx-lista">${estado({ tipo: 'vazio', forma: 'lista', titulo: 'Nenhuma peça aberta', texto: 'As etapas aparecem aqui quando houver peça na fila.' })}</div>`) + '</section>';
  }

  function html(alvo) {
    const V = raiz.VybeSetor?.pecas;
    const P = calcular(dados());
    ultimo = P;
    const rotDias = (PERIODOS.find(([d]) => d === dias) || [dias, `${dias} dias`])[1];
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (!alvo.vybePerfOuve) {
      alvo.vybePerfOuve = true;
      alvo.addEventListener?.('click', (ev) => {
        const b = ev.target.closest?.('button'); if (!b) return;
        if (b.dataset.perfEtapa) { escolher({ etapa: b.dataset.perfEtapa }); html(alvo); return; }
        if (b.dataset.perfTodas) { escolher({ todas: b.dataset.perfTodas === '1' }); html(alvo); return; }
        if (b.dataset.perfVista) { escolher({ vista: b.dataset.perfVista, foco: b.dataset.perfFoco || '' }); html(alvo); return; }
        if (b.dataset.perfBusca !== undefined) { document.querySelector('[data-ferr="busca"]')?.click?.(); return; }
        if (V?.v2?.clique?.(b)) return;
        if (b.dataset.perfIr) { const item = document.querySelector(`.vv-trilho [data-submodulo="${b.dataset.perfIr}"]`); if (item) item.click(); else raiz.VybePessoas?.abrir?.(b.dataset.perfIr); }
      });
    }
    // Sem a conta ainda (a produção não terminou de carregar): o esqueleto da própria tela, parado.
    if (!P) {
      alvo.innerHTML = `<div class="d3m-e-tela d3m-e-perf" aria-busy="true">${topoHtml(`a operação inteira · últimos ${rotDias}`)}<div class="d3m-e-corpo"><div class="d3m-e-main"><section class="d3m-e-folha cresce" aria-label="Performance"><div class="d3m-e-cab"><b>Juntando os números</b></div><div class="d3m-e-rola">${estado({ tipo: 'carregando', forma: 'lista', linhas: 8, titulo: 'Os números aparecem quando a produção terminar de carregar.' })}</div></section></div><aside class="d3m-lado" aria-label="Consulta">${estado({ tipo: 'carregando', forma: 'ficha', vidro: true, titulo: 'Carregando' })}</aside></div></div>`;
      return;
    }
    const T = P.total, Pr = P.processos;
    const sem = P.semanas.map((s) => ({ ...s, rotulo: s.inicio.slice(8, 10) + '/' + s.inicio.slice(5, 7) }));
    const cli = (n) => (typeof cliCor === 'function' ? cliCor(n) : esc(n));
    const nProc = (q) => (Pr[q] || []).length, semResp = nProc('semResponsavel');
    const maior = P.etapas[0];
    // A frase inteira do Heitor (fica na dica do cartão laranja): o gargalo é dono (peça sem responsável) ou etapa.
    const gargalo = semResp && semResp * 2 >= T.abertas ? `O gargalo é a distribuição, não a etapa: ${n0(semResp)} das ${pl(T.abertas, 'peça aberta', 'peças abertas')} ${semResp === 1 ? 'está' : 'estão'} sem responsável`
      : maior ? `A fila está mais cheia em ${stFrase(maior.status)}, com ${pl(maior.qtd, 'peça', 'peças')}${semResp ? `, e ${n0(semResp)} ${semResp === 1 ? 'está' : 'estão'} sem responsável` : ''}` : 'Nenhuma peça aberta agora';
    const frase = `${gargalo}${T.atrasadas ? ` e ${pl(T.atrasadas, 'já passou', 'já passaram')} da data` : ''}. `
      + (T.entregues ? `Em ${rotDias} ${T.entregues === 1 ? 'saiu' : 'saíram'} ${n0(T.entregues)}${T.noPrazoPct != null ? `, ${T.noPrazoPct}% no prazo do cliente` : ''}${T.tempoMediano != null ? `, em ${dd(T.tempoMediano)} do cadastro à entrega (mediana)` : ''}.`
        : `Nada saiu em ${rotDias}, então ainda não dá para medir prazo nem tempo de entrega.`);

    // As tabelas por departamento, formato, pessoa e cliente (as mesmas de antes, com as peças de vybe-mundo-setor.js).
    if (vista === 'tabelas') {
      let corpo;
      if (!V) corpo = estado({ tipo: 'carregando', forma: 'lista', linhas: 8, titulo: 'Carregando as tabelas' });
      else {
        // Zero vira uma linha (00 Main, regra 4): kpiLinha marca o zero e G (pecas.grade) junta os zeros numa linha discreta.
        const { kpiLinha: k = V.kpi, grade: G = (h) => `<div class="vs-kpis">${h}</div>`, bloco, barras, deitadas, linha } = V;
        const blocos = [
          ['resumo', G(`
        ${k({ icone: 'aperto', titulo: 'Entregues', valor: n0(T.entregues), sub: `nos últimos ${n0(dias)} dias`, espiar: T.entregues ? 'perf:total|entregues' : '' })}
        ${k({ icone: 'relogio', titulo: 'No prazo do cliente', valor: pc(T.noPrazoPct), sub: `${n0(T.noPrazo)} no prazo · ${n0(T.atrasadasEnt)} depois da data`, cls: T.noPrazoPct != null && T.noPrazoPct < 80 ? 'atencao' : '' })}
        ${k({ icone: 'calendario', titulo: 'Tempo de entrega', valor: dd(T.tempoMediano), sub: 'mediana do cadastro à entrega' })}
      `)
            + bloco('Entregas e cadastros por semana', 'no prazo do cliente e depois da data; e as peças cadastradas', barras(sem, [{ chave: 'noPrazo', rotulo: 'No prazo', cls: 'c3' }, { chave: 'atrasadas', rotulo: 'Depois da data', cls: 'c4' }, { chave: 'criadas', rotulo: 'Cadastradas', cls: 'c5' }]), { icone: 'alta' })
            + linha(bloco('Por departamento', 'entregues no período e abertas agora', barras(P.grupos.slice(0, 8).map((g) => ({ rotulo: String(g.nome).split(' ')[0], entregues: g.entregues, abertas: g.abertas, atrasadas: g.atrasadas })), [{ chave: 'entregues', rotulo: 'Entregues', cls: 'c3' }, { chave: 'abertas', rotulo: 'Abertas', cls: 'c5' }, { chave: 'atrasadas', rotulo: 'Atrasadas', cls: 'c4' }]), { icone: 'pessoas' })
              + bloco('Por formato', 'quanto sai e quanto leva', deitadas(P.formatos.slice(0, 8).map((f) => ({ nome: f.nome, valor: f.entregues, cls: 'ok', rotulo: `${n0(f.entregues)} <small>${dd(f.tempoMediano)}</small>`, sub: `${n0(f.abertas)} aberta${Number(f.abertas) === 1 ? '' : 's'} · no prazo ${pc(f.noPrazoPct)}` })), { vazio: 'Sem entregas no período.' }), { icone: 'doc' }))],
          ['departamentos', bloco('Departamentos', 'cada número abre as peças por trás dele', tabela(P.grupos, { chave: 'grupos' }), { icone: 'pessoas' })],
          ['pessoas', bloco('Operacionais', 'cada pessoa responsável pelas peças; peça de duas pessoas conta para as duas', tabela(P.pessoas, { chave: 'pessoas' }), { icone: 'pessoas' })],
          ['clientes', bloco('Clientes', 'os com mais atrasos primeiro', tabela(P.clientes, { chave: 'clientes', cli: true }), { icone: 'coracao' })],
        ];
        // "Ver por cliente" abre com a tabela dos clientes em cima.
        corpo = `<div class="d3m-e-perf-tabs vs-corpo">${blocos.sort((a, b) => (b[0] === focoTabela ? 1 : 0) - (a[0] === focoTabela ? 1 : 0)).map(([, h]) => h).join('')}</div>`;
      }
      alvo.innerHTML = `<div class="d3m-e-tela d3m-e-perf" data-vista="tabelas">${topoHtml(`a operação inteira · últimos ${rotDias} · atualizado às ${agora}`)}<div class="d3m-e-corpo um"><div class="d3m-e-main">`
        + `<section class="d3m-e-folha cresce d3m-e-perf-tabelas" aria-label="Tabelas"><div class="d3m-e-cab"><b>Tabelas <span>· por departamento, formato, pessoa e cliente</span></b><span class="d3m-e-cab-dir"><button type="button" class="d3v-btn sec s" data-perf-vista="painel">${svg(IC.volta)}Voltar para o painel</button></span></div><div class="d3m-e-rola">${corpo}</div></section></div></div></div>`;
      return;
    }

    // Os quatro números.
    const kpis = '<div class="d3m-e-kpis">' + kpiHtml({ rotulo: 'Abertas', valor: n0(T.abertas), sub: T.paradas ? `${pl(T.paradas, 'parada', 'paradas')} há 3 dias ou mais` : 'nenhuma parada há 3 dias ou mais', selo: 't', icone: 'agenda', espiar: T.abertas ? 'perf:total|abertas' : '' })
      + kpiHtml({ rotulo: 'Atrasadas', valor: n0(T.atrasadas), tom: T.atrasadas ? 'r' : '', sub: T.abertas ? `${pctDe(T.atrasadas, T.abertas)}% da fila` : 'fila vazia', selo: 'r', icone: 'alerta', anel: T.abertas && T.atrasadas ? (T.atrasadas * 100) / T.abertas : null, espiar: T.atrasadas ? 'perf:total|atrasadas' : '' })
      + kpiHtml({ rotulo: 'Em alteração', valor: n0(T.alteracao), tom: T.alteracao ? 'a' : '', sub: 'retrabalho na fila', selo: 'a', icone: 'lapis' })
      + kpiHtml({ rotulo: 'Sem responsável', valor: n0(semResp), de: ` / ${n0(T.abertas)}`, tom: semResp ? 'r' : '', sub: semResp ? (semResp === 1 ? 'ninguém vai fazer esta' : 'ninguém vai fazer estas') : T.abertas ? 'todas com dono' : 'fila vazia', selo: semResp ? 'r' : 'g', icone: semResp ? 'alerta' : 'certo', espiar: semResp ? 'perf:proc|semResponsavel' : '' }) + '</div>';

    // Pede ação: o que trava antes de produzir, o vermelho primeiro; o que só informa vai no fim; os zerados ficam no pé.
    const porAtraso = [...P.etapas].filter((e) => e.atrasadas).sort((a, b) => b.atrasadas - a.atrasadas);
    const aprov = porAtraso.filter((e) => /aprova/i.test(e.status))[0];
    const PROC = [
      ['semResponsavel', 'Sem responsável', 'ninguém vai fazer', 'r', 'sem dono'], ['solicitacoesVencidas', 'Solicitações vencidas', 'a conclusão planejada já passou', 'r', 'solicitações vencidas'],
      ['semBriefing', 'Sem briefing', 'peças abertas sem o briefing preenchido', 'a', 'sem briefing'], ['captacaoAgendar', 'Captação a agendar', 'esperando a produção marcar', 'a', 'captação a agendar'],
      ['semData', 'Sem data', 'nem veiculação nem prazo', 'a', 'sem data'], ['esquecidas', 'Esquecidas', 'data vencida há 30 dias ou mais: limpar', 'a', 'esquecidas'],
      ['solicitacoesAbertas', 'Solicitações abertas', 'quadro de demandas', 'n', 'solicitações abertas'], ['pausadas', 'Pausadas', 'Segurar Post: não atrasam', 'n', 'pausadas'],
    ];
    const linhaProc = ([q, t, s, tom]) => ({ n: nProc(q), tom, t, s, rot: 'Ver quais', attrs: `data-espiar="perf:proc|${q}"` });
    const comNumero = PROC.filter(([q, , , tom]) => nProc(q) && tom !== 'n').map(linhaProc);
    if (T.atrasadas) comNumero.push({ n: T.atrasadas, tom: 'r', t: 'Atrasadas', s: porAtraso.slice(0, 2).map((e) => `${n0(e.atrasadas)} em ${stFrase(e.status)}`).join(', '), rot: T.atrasadas === 1 ? 'Abrir a atrasada' : `Abrir as ${n0(T.atrasadas)}`, attrs: 'data-espiar="perf:total|atrasadas"' });
    if (aprov) comNumero.push({ n: aprov.atrasadas, tom: 'a', t: `${stFrase(aprov.status, true)} ${aprov.atrasadas === 1 ? 'vencida' : 'vencidas'}`, s: 'esperando o cliente', rot: 'Ver quais', attrs: `data-espiar="perf:etapaAtr|${esc(aprov.status)}"` });
    const ordem = comNumero.sort((a, b) => (a.tom === b.tom ? b.n - a.n : a.tom === 'r' ? -1 : 1)).concat(PROC.filter(([q, , , tom]) => nProc(q) && tom === 'n').map(linhaProc));
    // No pé, os zerados de nome curto primeiro (como na prancha); cabem três e o resto fica no "+N" (com os nomes na dica).
    const ORDEM_ZERO = ['semResponsavel', 'semBriefing', 'semData', 'captacaoAgendar', 'esquecidas', 'pausadas', 'solicitacoesVencidas', 'solicitacoesAbertas'];
    const zerados = PROC.filter(([q]) => !nProc(q)).sort((a, b) => ORDEM_ZERO.indexOf(a[0]) - ORDEM_ZERO.indexOf(b[0]));
    // O "+N" dos zerados que não couberam (os nomes ficam na dica): depois de três na tela larga, de dois na estreita.
    const maisZero = (de, cls) => (zerados.length > de ? `<span class="d3m-e-pd-z mais ${cls}" title="Também zerados: ${esc(zerados.slice(de).map((z) => z[4]).join(', '))}">+${n0(zerados.length - de)}</span>` : '');
    const pedeLinhas = ordem.map((l) => `<div class="d3m-e-pd-lin"><b class="d3m-e-pd-n ${l.tom}">${n0(l.n)}</b><span class="d3m-e-pd-txt"><b>${esc(l.t)}</b>${l.s ? ` <span>· ${esc(l.s)}</span>` : ''}</span><button type="button" class="d3v-btn s d3m-e-fio" ${l.attrs}>${esc(l.rot)}</button></div>`).join('');
    const zerHtml = zerados.length ? `<div class="d3m-e-pd-zer" aria-label="Zerados"><span class="d3m-e-pd-zer-rot">Zerados</span>${zerados.slice(0, 3).map((z, i) => `<span class="d3m-e-pd-z${i === 2 ? ' terceiro' : ''}" title="${esc(z[1])}: ${esc(z[2])}"><b>0</b><small class="d3m-e-pd-z-rot">${esc(z[4])}</small></span>`).join('')}${maisZero(3, 'larga')}${maisZero(2, 'curta')}</div>` : '';
    const pedeHtml = `<section class="d3m-e-folha d3m-e-perf-pede" aria-label="Pede ação"><div class="d3m-e-cab"><b>Pede ação</b><span class="d3m-e-cab-dir">trava antes de produzir</span></div><div class="d3m-e-rola">${pedeLinhas || estado({ tipo: 'vazio', forma: 'lista', titulo: 'Nada travando a fila agora', texto: 'O que trava antes de produzir aparece aqui, o mais grave primeiro.' })}</div>${zerHtml}</section>`;

    // Entregas por semana: o gráfico em linha (entregues cheia, cadastradas tracejada) e os três números; sem entrega, o vazio.
    const outro = dias === 90 ? [180, 'ver 6 meses'] : dias === 180 ? [30, 'ver 30 dias'] : [90, 'ver 3 meses'];
    const entPorSem = sem.map((x) => (Number(x.noPrazo) || 0) + (Number(x.atrasadas) || 0)), cad = sem.map((x) => Number(x.criadas) || 0);
    const grafico = T.entregues && sem.length > 1 && V?.d3?.grafico ? `<div class="d3m-e-ent-graf">${V.d3.grafico(entPorSem, cad, sem.map((x) => x.rotulo), { atual: sem.length - 1, altura: 90, rotulo: 'Entregues e cadastradas por semana' })}</div>` : '';
    const entPe = `<div class="d3m-e-pd-zer d3m-e-ent-pe" aria-label="Entregas no período"><span class="d3m-e-pd-z" title="Entregues em ${esc(rotDias)}"><button type="button" class="d3m-e-mini-v" data-espiar="perf:total|entregues" title="Ver as peças">${n0(T.entregues)}</button><small class="d3m-e-pd-z-rot">${T.entregues === 1 ? 'entregue' : 'entregues'}</small></span>`
      + `<span class="d3m-e-pd-z" title="No prazo do cliente: ${n0(T.noPrazo)} no prazo · ${n0(T.atrasadasEnt)} depois da data"><b>${T.noPrazoPct == null ? 'sem dado' : T.noPrazoPct + '%'}</b><small class="d3m-e-pd-z-rot">no prazo</small></span>`
      + `<span class="d3m-e-pd-z" title="Do cadastro à entrega (mediana)"><b>${T.tempoMediano == null ? 'sem dado' : dd(T.tempoMediano)}</b><small class="d3m-e-pd-z-rot">até a entrega</small></span></div>`;
    const entregasHtml = `<section class="d3m-e-folha d3m-e-perf-ent" aria-label="Entregas por semana"><div class="d3m-e-cab"><b>Entregas por semana</b><span class="d3m-e-cab-dir"><button type="button" class="d3m-e-elo" data-perf-dias="${outro[0]}">${outro[1]}</button></span></div><div class="d3m-e-rola">`
      + (T.entregues ? (grafico || estado({ tipo: 'vazio', forma: 'lista', icone: 'alta', titulo: 'Ainda sem semanas para comparar', texto: 'O gráfico aparece com duas semanas ou mais no período.' })) : estado({ tipo: 'vazio', forma: 'lista', grande: true, icone: 'alta', titulo: `Nenhuma entrega registrada em ${rotDias}`, texto: 'Com entregas, aparece aqui o gráfico de no prazo e depois da data, e o tempo do cadastro à entrega.' })) + `</div>${T.entregues ? entPe : ''}</section>`;

    // O cartão laranja do Heitor: onde a fila trava (a etapa mais cheia) ou, se a maior parte está sem dono, a distribuição.
    const dono = semResp && semResp * 2 >= T.abertas;
    const tabelasBtn = '<button type="button" class="d3m-btn l s" data-perf-vista="tabelas" data-perf-foco="clientes">Ver por cliente</button>';
    let larNum = '', larTit = 'Nenhuma peça aberta agora', larSub = 'Quando houver fila, o Heitor mostra aqui onde ela trava.', larBts = '';
    if (dono) {
      larNum = n0(semResp); larTit = semResp === 1 ? 'peça sem responsável' : 'peças sem responsável';
      larSub = `O gargalo é a distribuição, não a etapa.${T.atrasadas ? ` ${T.atrasadas === 1 ? '1 já passou' : `${n0(T.atrasadas)} já passaram`} da data.` : ''}`;
      larBts = `<button type="button" class="d3m-btn l" data-espiar="perf:proc|semResponsavel">${semResp === 1 ? 'Distribuir a peça' : `Distribuir as ${n0(semResp)}`}</button>${tabelasBtn}`;
    } else if (maior) {
      larNum = n0(maior.qtd); larTit = `${maior.qtd === 1 ? 'peça parada' : 'peças paradas'} em ${esc(stFrase(maior.status, true))}`;
      larSub = `É onde a fila trava.${maior.atrasadas ? ` ${maior.atrasadas === 1 ? '1 delas já está atrasada' : `${n0(maior.atrasadas)} delas já estão atrasadas`}.` : ''}`;
      larBts = (semResp ? `<button type="button" class="d3m-btn l" data-espiar="perf:proc|semResponsavel">${semResp === 1 ? 'Distribuir a peça' : `Distribuir as ${n0(semResp)}`}</button>`
        : T.atrasadas ? `<button type="button" class="d3m-btn l" data-espiar="perf:total|atrasadas">${T.atrasadas === 1 ? 'Abrir a atrasada' : `Abrir as ${n0(T.atrasadas)}`}</button>` : '') + tabelasBtn;
    }
    const laranja = `<section class="d3m-laranja d3m-e-perf-lar" aria-label="O que pede ação agora" title="${esc(frase)}"><div class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">H</span><span>Heitor · ${dono ? 'distribuição' : 'onde trava'}</span></div>`
      + `<div class="d3m-lar-txt">${larNum ? `<b class="d3m-lar-num">${larNum}</b>` : ''}<span class="d3-acao-frase">${larTit}</span><small class="d3m-lar-sub">${esc(larSub)}</small>${larBts ? `<div class="d3m-lar-bts">${larBts}</div>` : ''}</div></section>`;
    // Consulta, direto no vidro: as outras abas da Gestão (os mesmos data-gestao-aba), as tabelas e as pessoas (RH).
    const vlin = (attrs, t, s = '') => `<button type="button" class="d3m-vlin" ${attrs}><span><b>${t}</b>${s ? ` · ${s}` : ''}</span>${svg(IC.seta)}</button>`;
    const leituras = `<section class="d3m-cons" aria-label="Outras leituras"><div class="d3m-cons-cab"><b>Outras leituras</b><span></span></div>`
      + vlin('data-gestao-aba="agencia"', 'Agência', 'os quatro setores') + vlin('data-gestao-aba="agora"', 'Agora', 'o dia de hoje') + vlin('data-gestao-aba="semana"', 'Semana')
      + vlin('data-gestao-aba="clientes"', 'Clientes e carteiras') + vlin('data-gestao-aba="time"', 'Time e bots') + vlin('data-gestao-aba="historico"', 'Histórico e projeção')
      + vlin('data-perf-vista="tabelas"', 'Tabelas', 'departamento, formato, pessoa e cliente') + '</section>';
    const pessoas = `<section class="d3m-cons" aria-label="As pessoas"><div class="d3m-cons-cab"><b>As pessoas</b><span></span></div>${vlin('data-perf-ir="produtividade"', 'Produtividade', 'fica em Recursos Humanos')}</section>`;

    alvo.innerHTML = `<div class="d3m-e-tela d3m-e-perf" data-vista="painel">${topoHtml(`a operação inteira · últimos ${rotDias} · atualizado às ${agora}`)}<div class="d3m-e-corpo">`
      + `<div class="d3m-e-main">${kpis}${filaHtml(P, cli)}<div class="d3m-e-par">${pedeHtml}${entregasHtml}</div></div>`
      + `<aside class="d3m-lado" aria-label="Consulta">${laranja}${leituras}${pessoas}</aside></div></div>`;
  }
  // As escolhas da tela (ficam entre um desenho e outro: a Gestão redesenha a cada minuto).
  function escolher({ etapa, todas, vista: v, foco } = {}) {
    if (etapa !== undefined) etapaSel = String(etapa || '');
    if (todas !== undefined) etapasTodas = Boolean(todas);
    if (v !== undefined) { vista = v === 'tabelas' ? 'tabelas' : 'painel'; focoTabela = vista === 'tabelas' ? String(foco || '') : ''; }
  }

  raiz.VybePerformance = Object.freeze({
    calcular, html, escolher, PERIODOS,
    dias: () => dias,
    definirDias(d) { if (!PERIODOS.some(([x]) => x === Number(d))) return; dias = Number(d); try { localStorage.setItem('vybe.performance.dias', String(dias)); } catch { /* sem guardar */ } },
  });
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.VybePerformance;
