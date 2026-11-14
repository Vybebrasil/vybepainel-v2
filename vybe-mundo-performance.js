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
//   VybePerformance.html(alvo, { numeros })                                                  → desenha no alvo
(function (raiz) {
  'use strict';
  const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '3 meses'], [180, '6 meses']];
  const soDia = (v) => { const s = String(v || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) && s.length <= 10) return s.slice(0, 10); const d = new Date(s); return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d) : ''; };
  const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
  const segunda = (iso) => { const x = new Date(`${iso}T12:00:00Z`), w = (x.getUTCDay() + 6) % 7; return somarDias(iso, -w); };
  const mediana = (l) => { const v = l.filter((n) => Number.isFinite(n)).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const pctDe = (a, b) => (b ? Math.round((a / b) * 100) : null);
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
      if (!nomesDe(d, pessoas).length) processos.semResponsavel.push(id);
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
    if (tipo === 'etapaAtr') { const e = P.etapas.find((x) => x.status === qual); return e ? { titulo: `atrasadas em ${e.status}`, itens: itensDe(e.idsAtrasadas || []), clicar: abrirPeca } : null; }
    if (tipo === 'etapa') { const e = P.etapas.find((x) => x.status === qual); return e ? { titulo: `em ${e.status}`, itens: itensDe(e.ids), clicar: abrirPeca } : null; }
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

  // Padrão v2 (quadro "Performance", moodboard aprovado em 12/11/2026): a frase do Heitor, três números, o que pede
  // ação antes de produzir, as entregas e a fila por etapa (a etapa abre no lugar com as atrasadas por cliente). As
  // tabelas por departamento, formato, pessoa e cliente continuam no "mostrar" do pé. Desenho em padrao-v2/gestao.css.
  let pintado = '';
  function html(alvo) {
    const V = raiz.VybeSetor?.pecas, v2 = V?.v2;
    const P = calcular(dados());
    ultimo = P;
    if (!V || !v2 || !P) { alvo.innerHTML = '<p class="vv-vazio">Os números aparecem quando a produção terminar de carregar.</p>'; return; }
    // Zero vira uma linha (00 Main, regra 4): kpiLinha marca o zero e G (pecas.grade) junta os zeros numa linha discreta.
    const { kpiLinha: k = V.kpi, grade: G = (h) => `<div class="vs-kpis">${h}</div>`, bloco, barras, deitadas, linha } = V, T = P.total, Pr = P.processos;
    const { fala, tres, pede, cartao, duas, mais, tela, btn, elo, pl, pctDe } = v2;
    const sem = P.semanas.map((s) => ({ ...s, rotulo: s.inicio.slice(8, 10) + '/' + s.inicio.slice(5, 7) }));
    const rotDias = (PERIODOS.find(([d]) => d === dias) || [dias, `${dias} dias`])[1];
    const cli = (n) => (typeof cliCor === 'function' ? cliCor(n) : esc(n)), st = (n) => (typeof statusCor === 'function' ? statusCor({ status: n }) : esc(n));
    const nProc = (q) => (Pr[q] || []).length, semResp = nProc('semResponsavel');
    const ativos = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES.filter((c) => c && c.id && c.nome && c.ativo !== false).length : null;
    const principal = semResp ? btn(semResp === 1 ? 'Distribuir a peça sem dono' : `Distribuir as ${n0(semResp)}`, 'data-espiar="perf:proc|semResponsavel"', 'p')
      : T.atrasadas ? btn(T.atrasadas === 1 ? 'Abrir a atrasada' : `Abrir as ${n0(T.atrasadas)} atrasadas`, 'data-espiar="perf:total|atrasadas"', 'p') : '';
    // Direção 3 (quadro D3-Performance): título curto com os clientes ativos e a hora; o botão do que pede ação mora no
    // bloco laranja, não no topo.
    const D3 = V.d3;
    const topo = `<div class="g2-topo"><h2 title="Performance da operação">Performance</h2><small class="g2-topo-sub">${!ativos ? '' : `${pl(ativos, 'cliente ativo', 'clientes ativos')} · `}@@HORA@@</small><span class="g2-seg vv-perf-periodo" role="group" aria-label="Período">${PERIODOS.map(([d, r]) => `<button type="button" data-perf-dias="${d}" aria-pressed="${d === dias}">${r}</button>`).join('')}</span>${D3 ? '' : principal}</div>`;
    // A frase: o gargalo é dono (peça sem responsável) ou etapa (onde a fila está parada).
    const maior = P.etapas[0];
    const gargalo = semResp && semResp * 2 >= T.abertas ? `O gargalo é dono, não etapa: <b>${n0(semResp)} das ${pl(T.abertas, 'peça aberta', 'peças abertas')} ${semResp === 1 ? 'está' : 'estão'} sem responsável</b>`
      : maior ? `A fila está mais cheia em <b>${esc(maior.status)}</b>, com ${pl(maior.qtd, 'peça', 'peças')}${semResp ? `, e ${n0(semResp)} ${semResp === 1 ? 'está' : 'estão'} sem responsável` : ''}` : '<b>Nenhuma peça aberta agora</b>';
    const frase = `${gargalo}${T.atrasadas ? ` e <b>${pl(T.atrasadas, 'já passou', 'já passaram')} da data</b>` : ''}. `
      + (T.entregues ? `Em ${esc(rotDias)} ${T.entregues === 1 ? 'saiu' : 'saíram'} ${n0(T.entregues)}${T.noPrazoPct != null ? `, ${T.noPrazoPct}% no prazo do cliente` : ''}${T.tempoMediano != null ? `, em ${dd(T.tempoMediano)} do cadastro à entrega (mediana)` : ''}.`
        : `Nada saiu em ${esc(rotDias)}, então ainda não dá para medir prazo nem tempo de entrega.`);
    const falaHtml = fala('heitor', frase).replace('</p></div>', `</p>${semResp ? btn(semResp === 1 ? 'Ver a peça' : `Ver as ${n0(semResp)}`, 'data-espiar="perf:proc|semResponsavel"') : T.atrasadas ? btn('Ver as atrasadas', 'data-espiar="perf:total|atrasadas"') : ''}</div>`);
    const numeros = tres([
      { rotulo: 'Abertas agora', valor: n0(T.abertas), espiar: T.abertas ? 'perf:total|abertas' : '', sub: `${n0(T.paradas)} ${T.paradas === 1 ? 'parada' : 'paradas'} há 3 dias ou mais` },
      { rotulo: 'Atrasadas agora', valor: n0(T.atrasadas), tom: T.atrasadas ? 'ruim' : '', espiar: T.atrasadas ? 'perf:total|atrasadas' : '', sub: T.abertas ? `${pctDe(T.atrasadas, T.abertas)}% da fila${T.atrasadas ? ` · ${elo('ver quais', 'data-espiar="perf:total|atrasadas"')}` : ''}` : 'fila vazia' },
      { rotulo: 'Em alteração', valor: n0(T.alteracao), tom: T.alteracao ? 'atencao' : '', sub: 'retrabalho na fila agora' },
    ]);
    // Pede ação: o que trava antes de produzir, o que tem número primeiro; os zerados ficam em "mostrar".
    const porAtraso = [...P.etapas].filter((e) => e.atrasadas).sort((a, b) => b.atrasadas - a.atrasadas);
    const aprov = porAtraso.filter((e) => /aprova/i.test(e.status))[0];
    const PROC = [
      ['semResponsavel', 'Sem responsável', 'ninguém vai fazer', 'r'], ['solicitacoesVencidas', 'Solicitações vencidas', 'a conclusão planejada já passou', 'r'],
      ['semBriefing', 'Sem briefing', 'peças abertas sem o briefing preenchido', 'a'], ['captacaoAgendar', 'Captação a agendar', 'esperando a produção marcar', 'a'],
      ['semData', 'Sem data', 'nem veiculação nem prazo', 'a'], ['esquecidas', 'Esquecidas', 'data vencida há 30 dias ou mais: limpar', 'a'],
      ['solicitacoesAbertas', 'Solicitações abertas', 'quadro de demandas', 'n'], ['pausadas', 'Pausadas', 'Segurar Post: não atrasam', 'n'],
    ];
    const linhaProc = ([q, t, s, tom]) => ({ q, n: nProc(q), tom, pill: n0(nProc(q)), texto: `<b>${esc(t)}</b> · ${esc(s)}`, botao: nProc(q) ? btn('Ver quais são', `data-espiar="perf:proc|${q}"`) : '' });
    const comNumero = PROC.filter(([q, , , tom]) => nProc(q) && tom !== 'n').map(linhaProc);
    if (T.atrasadas) comNumero.push({ n: T.atrasadas, tom: 'r', pill: n0(T.atrasadas), texto: `<b>Atrasadas</b>${porAtraso.length ? ' · ' + porAtraso.slice(0, 2).map((e) => `${n0(e.atrasadas)} em ${esc(e.status)}`).join(', ') : ''}`, botao: btn(T.atrasadas === 1 ? 'Abrir a atrasada' : `Abrir as ${n0(T.atrasadas)}`, 'data-espiar="perf:total|atrasadas"') });
    if (aprov) comNumero.push({ n: aprov.atrasadas, tom: 'a', pill: n0(aprov.atrasadas), texto: `<b>${esc(aprov.status)}</b> ${aprov.atrasadas === 1 ? 'vencida' : 'vencidas'}, esperando o cliente`, botao: btn('Ver quais são', `data-espiar="perf:etapaAtr|${esc(aprov.status)}"`) });
    const ordem = comNumero.sort((a, b) => (a.tom === b.tom ? b.n - a.n : a.tom === 'r' ? -1 : 1));
    const zerados = PROC.filter(([q, , , tom]) => !nProc(q) && tom !== 'n'), informa = PROC.filter(([, , , tom]) => tom === 'n');
    const foraN = Math.max(0, ordem.length - 3);
    // Direção 3 (quadro D3-Performance): os zerados viram uma linha de pílulas verdes claras ("Zerados"), no pé do cartão.
    const zeradosHtml = zerados.length ? `<div class="g2-zerados" aria-label="Zerados"><span>Zerados</span>${zerados.map((z) => `<span class="g2-zero" title="${esc(z[2])}">${esc(z[1])}</span>`).join('')}</div>` : '';
    const pedeHtml = pede(ordem, { sub: 'trava antes de produzir', vazio: 'Nada travando a fila agora.', mostra: 3, resto: informa.map(linhaProc).map((l) => ({ ...l, tom: 'n' })),
      pe: [foraN ? `+ ${n0(foraN)} com número` : '', 'Solicitações abertas e pausadas'].filter(Boolean).join(' · ') }).replace(/<\/section>$/, `${zeradosHtml}</section>`);
    // Entregas por semana: o gráfico só com entrega no período; os três números ficam sempre.
    const outro = dias === 90 ? [180, 'Ver 6 meses'] : dias === 180 ? [30, 'Ver 30 dias'] : [90, 'Ver 3 meses'];
    const entregasHtml = cartao('Entregas por semana', '', (T.entregues
      ? barras(sem, [{ chave: 'noPrazo', rotulo: 'No prazo', cls: 'c3' }, { chave: 'atrasadas', rotulo: 'Depois da data', cls: 'c4' }, { chave: 'criadas', rotulo: 'Cadastradas', cls: 'c5' }], { altura: 150 })
      : `<p class="g2-pe g2-pe-topo">Nenhuma entrega registrada em ${esc(rotDias)}. Com entregas, o gráfico de no prazo, depois da data e cadastradas aparece aqui.</p>`)
      + `<div class="g2-minis"><p class="g2-mini"><span>Entregues em ${esc(rotDias)}</span>${T.entregues ? `<button type="button" class="g2-link forte" data-espiar="perf:total|entregues">${n0(T.entregues)}</button>` : '<b>0</b>'}</p>
        <p class="g2-mini"><span>No prazo do cliente</span><b>${T.noPrazoPct == null ? 'sem dado' : T.noPrazoPct + '%'}</b><span>${n0(T.noPrazo)} no prazo · ${n0(T.atrasadasEnt)} depois</span></p>
        <p class="g2-mini"><span>Do cadastro à entrega</span><b>${T.tempoMediano == null ? 'sem dado' : dd(T.tempoMediano)}</b>${T.tempoMediano == null ? '' : '<span>mediana</span>'}</p></div>`,
      { cls: 'g2-entregas', acao: btn(outro[1], `data-perf-dias="${outro[0]}"`) });
    // Onde a fila está: uma linha por etapa; clicar abre no lugar as atrasadas por cliente.
    const maxQtd = Math.max(1, ...P.etapas.map((e) => e.qtd)), temIdade = P.etapas.some((e) => e.idadeMediana != null);
    const linhaEtapa = (e, aberta) => {
      const det = (e.atrasadasPorCliente || []).slice(0, 3).map((c, i, l) => `<span>${cli(c.cliente)} · ${pl(c.qtd, 'atrasada', 'atrasadas')}${i === 0 && c.dias > 0 ? `, a mais antiga há ${pl(c.dias, 'dia', 'dias')}` : ''}${i === l.length - 1 ? ` · ${elo(e.atrasadas === 1 ? 'abrir a atrasada' : `abrir as ${n0(e.atrasadas)}`, `data-espiar="perf:etapaAtr|${esc(e.status)}"`)}` : ''}</span>`);
      if (e.idadeMediana != null) det.push(`<span>parada há ${dd(e.idadeMediana)} (mediana)</span>`);
      const lin = `<div class="g2-fx"><span class="g2-fx-st">${st(e.status)}</span><div class="v2-barra g2-barra"><i style="--v:${Math.round((e.qtd / maxQtd) * 100)}%;--c:#1F1D1A"></i></div><button type="button" class="g2-fx-n" data-espiar="perf:etapa|${esc(e.status)}" title="Ver as peças">${n0(e.qtd)}</button>${det.length ? `<button type="button" class="g2-fx-at${e.atrasadas ? '' : ' calmo'}" data-g2-abre aria-expanded="${aberta}">${e.atrasadas ? pl(e.atrasadas, 'atrasada', 'atrasadas') : 'em dia'}</button>` : '<span class="g2-fx-at calmo">em dia</span>'}</div>`;
      return det.length ? `<div class="v2-abre g2-linha" aria-expanded="${aberta}">${lin}<div class="v2-mais"><div><div class="g2-hists fx">${det.map((d) => `<p class="g2-hist">${d}</p>`).join('')}</div></div></div></div>` : `<div class="g2-linha">${lin}</div>`;
    };
    const vis = P.etapas.slice(0, 5), outras = P.etapas.slice(5), nOutras = outras.reduce((s, e) => s + e.qtd, 0);
    let abriu = false;
    const filaHtml = cartao('Onde a fila está', `peças por etapa · dias parada: ${temIdade ? 'ao abrir a etapa' : 'sem dado'}`, (vis.length ? vis.map((e) => { const a = !abriu && (e.atrasadasPorCliente || []).length > 0; if (a) abriu = true; return linhaEtapa(e, a); }).join('') : '<p class="g2-vazio">Nenhuma peça aberta.</p>')
      + (outras.length ? `<div class="v2-abre g2-resto" aria-expanded="false"><div class="v2-mais"><div>${outras.map((e) => linhaEtapa(e, false)).join('')}</div></div><p class="g2-pe">+ ${pl(outras.length, 'outra etapa', 'outras etapas')} com ${pl(nOutras, 'peça recolhida', 'peças recolhidas')} · <button type="button" class="g2-link" data-g2-abre data-g2-troca="recolher" aria-expanded="false">mostrar</button> · a etapa abre no lugar com as atrasadas por cliente</p></div>`
        : vis.length ? '<p class="g2-pe g2-pe-fim">A etapa abre no lugar com as atrasadas por cliente.</p>' : ''), { cls: 'g2-fila' });
    const ABAS = [['agencia', 'Agência'], ['agora', 'Agora'], ['semana', 'Semana'], ['clientes', 'Clientes'], ['carteiras', 'Carteiras'], ['time', 'Time e bots'], ['historico', 'Histórico e projeção']];
    const abrir = `<nav class="g2-abrir" aria-label="Abrir"><span>Abrir:</span>${ABAS.map(([id, n]) => `<button type="button" class="g2-chip" data-gestao-aba="${id}">${n}</button>`).join('')}<span class="g2-abrir-fim">As pessoas ficam em <button type="button" class="g2-link" data-perf-ir="produtividade">RH › Produtividade</button></span></nav>`;
    const antigo = G(`
        ${k({ icone: 'aperto', titulo: 'Entregues', valor: n0(T.entregues), sub: `nos últimos ${n0(dias)} dias`, espiar: T.entregues ? 'perf:total|entregues' : '' })}
        ${k({ icone: 'relogio', titulo: 'No prazo do cliente', valor: pc(T.noPrazoPct), sub: `${n0(T.noPrazo)} no prazo · ${n0(T.atrasadasEnt)} depois da data`, cls: T.noPrazoPct != null && T.noPrazoPct < 80 ? 'atencao' : '' })}
        ${k({ icone: 'calendario', titulo: 'Tempo de entrega', valor: dd(T.tempoMediano), sub: 'mediana do cadastro à entrega' })}
      `)
      + bloco('Entregas e cadastros por semana', 'no prazo do cliente e depois da data; e as peças cadastradas', barras(sem, [{ chave: 'noPrazo', rotulo: 'No prazo', cls: 'c3' }, { chave: 'atrasadas', rotulo: 'Depois da data', cls: 'c4' }, { chave: 'criadas', rotulo: 'Cadastradas', cls: 'c5' }]), { icone: 'alta' })
      + linha(bloco('Por departamento', 'entregues no período e abertas agora', barras(P.grupos.slice(0, 8).map((g) => ({ rotulo: String(g.nome).split(' ')[0], entregues: g.entregues, abertas: g.abertas, atrasadas: g.atrasadas })), [{ chave: 'entregues', rotulo: 'Entregues', cls: 'c3' }, { chave: 'abertas', rotulo: 'Abertas', cls: 'c5' }, { chave: 'atrasadas', rotulo: 'Atrasadas', cls: 'c4' }]), { icone: 'pessoas' })
        + bloco('Por formato', 'quanto sai e quanto leva', deitadas(P.formatos.slice(0, 8).map((f) => ({ nome: f.nome, valor: f.entregues, cls: 'ok', rotulo: `${n0(f.entregues)} <small>${dd(f.tempoMediano)}</small>`, sub: `${n0(f.abertas)} aberta${Number(f.abertas) === 1 ? '' : 's'} · no prazo ${pc(f.noPrazoPct)}` })), { vazio: 'Sem entregas no período.' }), { icone: 'doc' }))
      + bloco('Departamentos', 'cada número abre as peças por trás dele', tabela(P.grupos, { chave: 'grupos' }), { icone: 'pessoas' })
      + bloco('Operacionais', 'cada pessoa responsável pelas peças; peça de duas pessoas conta para as duas', tabela(P.pessoas, { chave: 'pessoas' }), { icone: 'pessoas' })
      + bloco('Clientes', 'os com mais atrasos primeiro', tabela(P.clientes, { chave: 'clientes', cli: true }), { icone: 'coracao' });
    // Direção 3: bloco de ação curto, quatro números e as entregas por semana em linha (entregues cheia, cadastradas
    // tracejada). A frase longa do Heitor vira a dica do bloco.
    let corpo = tela(falaHtml, numeros, duas(`<div class="g2-col">${pedeHtml}${entregasHtml}</div>`, filaHtml, 'iguais'), abrir, mais('Tabelas por departamento, formato, pessoa e cliente', antigo));
    if (D3) {
      const dono = semResp && semResp * 2 >= T.abertas;
      const fraseD3 = dono ? `O gargalo é dono: ${pl(semResp, 'peça', 'peças')} sem responsável.` : maior ? `A fila trava em ${esc(maior.status)}: ${pl(maior.qtd, 'peça', 'peças')}.` : 'Nenhuma peça aberta agora.';
      const [rotBtn, attrs] = semResp ? [semResp === 1 ? 'Distribuir a peça' : `Distribuir as ${n0(semResp)}`, 'data-espiar="perf:proc|semResponsavel"'] : T.atrasadas ? [T.atrasadas === 1 ? 'Abrir a atrasada' : `Abrir as ${n0(T.atrasadas)}`, 'data-espiar="perf:total|atrasadas"'] : ['', ''];
      const acao = D3.acao({ frase: fraseD3, agente: 'H', botao: rotBtn, attrs: `${attrs} title="${esc(frase.replace(/<[^>]*>/g, ''))}"` })
        .replace('<span class="d3-acao-frase">', '<span class="d3-acao-frase"><small class="d3s-quem">Heitor · Coordenação</small>');
      const entPorSem = sem.map((x) => (Number(x.noPrazo) || 0) + (Number(x.atrasadas) || 0)), cad = sem.map((x) => Number(x.criadas) || 0);
      // A linha das atrasadas: o número da agência guardado dia a dia (server/series-historicas.js, série atrasadas, últimos 30 dias).
      const serieAtr = typeof raiz.d3Series === 'function' && typeof raiz.d3SerieValores === 'function'
        ? raiz.d3SerieValores(raiz.d3Series('performance', () => { if (alvo.isConnected) html(alvo); })?.atrasadas)?.slice(-30) || null : null;
      const nums = `<div class="d3g-nums">${D3.num({ rotulo: 'Abertas', valor: n0(T.abertas), serie: cad.length > 1 && cad.some(Boolean) ? cad : null, attrs: T.abertas ? 'data-espiar="perf:total|abertas"' : '' }, `${n0(T.paradas)} ${T.paradas === 1 ? 'parada' : 'paradas'} 3+ dias`)}
        ${D3.num({ rotulo: 'Atrasadas', valor: n0(T.atrasadas), tom: T.atrasadas ? 'r' : '', serie: serieAtr, attrs: T.atrasadas ? 'data-espiar="perf:total|atrasadas"' : '' }, T.abertas ? `${pctDe(T.atrasadas, T.abertas)}% da fila` : 'fila vazia', T.atrasadas ? 'r' : '')}
        ${D3.num({ rotulo: 'Em alteração', valor: n0(T.alteracao), tom: T.alteracao ? 'a' : '' }, 'retrabalho na fila')}
        ${D3.num({ rotulo: 'Sem responsável', valor: `${n0(semResp)}<small> / ${n0(T.abertas)}</small>`, barra: T.abertas ? (semResp * 100) / T.abertas : 0, attrs: semResp ? 'data-espiar="perf:proc|semResponsavel"' : '' })}</div>`;
      const grafico = T.entregues && sem.length > 1 ? `<div class="d3g-graf-caixa">${D3.grafico(entPorSem, cad, sem.map((x) => x.rotulo), { atual: sem.length - 1, altura: 110, rotulo: 'Entregues e cadastradas por semana' })}</div>` : '';
      const entregasD3 = grafico ? entregasHtml.replace(/<p class="g2-pe g2-pe-topo">[\s\S]*?<\/p>|<figure class="vs-grafico">[\s\S]*?<\/figure>/, grafico) : entregasHtml;
      corpo = `<div class="g2 d3g">${acao}${nums}${duas(`<div class="g2-col">${pedeHtml}${entregasD3}</div>`, filaHtml, 'iguais')}${abrir}${mais('Tabelas por departamento, formato, pessoa e cliente', antigo)}</div>`;
    }
    const tudo = topo + `<div class="vs-corpo@@QUIETA@@">${corpo}</div>`;
    alvo.innerHTML = tudo.replace('@@HORA@@', v2.hora()).replace('@@QUIETA@@', tudo === pintado ? ' g2-quieta' : '');
    pintado = tudo;
    alvo.addEventListener?.('click', (ev) => {
      const b = ev.target.closest?.('button'); if (!b) return;
      if (v2.clique(b)) return;
      if (b.dataset.perfIr) { const item = document.querySelector(`.vv-trilho [data-submodulo="${b.dataset.perfIr}"]`); if (item) item.click(); else raiz.VybePessoas?.abrir?.(b.dataset.perfIr); }
    });
  }

  raiz.VybePerformance = Object.freeze({
    calcular, html, PERIODOS,
    dias: () => dias,
    definirDias(d) { if (!PERIODOS.some(([x]) => x === Number(d))) return; dias = Number(d); try { localStorage.setItem('vybe.performance.dias', String(dias)); } catch { /* sem guardar */ } },
  });
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.VybePerformance;
