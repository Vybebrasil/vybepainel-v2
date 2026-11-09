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
      const e = porStatus.get(st) || { status: st, cor: d.status_color || '', qtd: 0, idades: [], atrasadas: 0, ids: [] };
      e.qtd += 1; e.ids.push(id); if (s.idade != null) e.idades.push(s.idade); if (s.atrasada) e.atrasadas += 1; porStatus.set(st, e);
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
    const etapas = [...porStatus.values()].map((e) => ({ status: e.status, cor: e.cor, qtd: e.qtd, atrasadas: e.atrasadas, idadeMediana: mediana(e.idades), ids: e.ids }))
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

  function html(alvo) {
    const V = raiz.VybeSetor?.pecas;
    const P = calcular(dados());
    ultimo = P;
    const seletor = `<span class="vs-alternar vv-perf-periodo" role="group" aria-label="Período">${PERIODOS.map(([d, r]) => `<button type="button" data-perf-dias="${d}" aria-pressed="${d === dias}">${r}</button>`).join('')}</span>`;
    if (!V || !P) { alvo.innerHTML = '<p class="vv-vazio">Os números aparecem quando a produção terminar de carregar.</p>'; return; }
    const { kpi: k, bloco, barras, deitadas, linha } = V, T = P.total, Pr = P.processos;
    const sem = P.semanas.map((s) => ({ ...s, rotulo: s.inicio.slice(8, 10) + '/' + s.inicio.slice(5, 7) }));
    const etapasMax = P.etapas.slice(0, 12);
    const proc = [
      ['semBriefing', 'Sem briefing', 'peças abertas sem o briefing preenchido', 'atencao'],
      ['semResponsavel', 'Sem responsável', 'ninguém vai fazer', 'ruim'],
      ['captacaoAgendar', 'Captação a agendar', 'esperando a produção marcar', 'atencao'],
      ['semData', 'Sem data', 'nem veiculação nem prazo', 'atencao'],
      ['solicitacoesAbertas', 'Solicitações abertas', 'quadro de demandas', ''],
      ['solicitacoesVencidas', 'Solicitações vencidas', 'conclusão planejada já passou', 'ruim'],
      ['pausadas', 'Pausadas', 'Segurar Post: não atrasam', ''],
      ['esquecidas', 'Esquecidas', 'data vencida há 30+ dias: limpar', 'atencao'],
    ];
    alvo.innerHTML = `<div class="vv-perf-topo"><p class="vs-aviso">Como a operação inteira está andando: o que saiu, no prazo ou não, quanto leva e onde trava. A produtividade de cada pessoa do time fica no RH.</p>${seletor}</div>
      <div class="vs-kpis">
        ${k({ icone: 'aperto', titulo: 'Entregues', valor: n0(T.entregues), sub: `nos últimos ${n0(dias)} dias`, espiar: T.entregues ? 'perf:total|entregues' : '' })}
        ${k({ icone: 'relogio', titulo: 'No prazo do cliente', valor: pc(T.noPrazoPct), sub: `${n0(T.noPrazo)} no prazo · ${n0(T.atrasadasEnt)} depois da data`, cls: T.noPrazoPct != null && T.noPrazoPct < 80 ? 'atencao' : '' })}
        ${k({ icone: 'calendario', titulo: 'Tempo de entrega', valor: dd(T.tempoMediano), sub: 'mediana do cadastro à entrega' })}
        ${k({ icone: 'doc', titulo: 'Abertas agora', valor: n0(T.abertas), sub: `${n0(T.paradas)} paradas há 3+ dias`, espiar: T.abertas ? 'perf:total|abertas' : '' })}
        ${k({ icone: 'alerta', titulo: 'Atrasadas agora', valor: n0(T.atrasadas), cls: T.atrasadas ? 'ruim' : '', espiar: T.atrasadas ? 'perf:total|atrasadas' : '' })}
        ${k({ icone: 'saida', titulo: 'Em alteração', valor: n0(T.alteracao), sub: 'retrabalho na fila agora', cls: T.alteracao ? 'atencao' : '' })}
      </div>
      ${bloco('Entregas por semana', 'no prazo do cliente e depois da data; e as peças cadastradas', barras(sem, [{ chave: 'noPrazo', rotulo: 'No prazo', cls: 'c3' }, { chave: 'atrasadas', rotulo: 'Depois da data', cls: 'c4' }, { chave: 'criadas', rotulo: 'Cadastradas', cls: 'c5' }]), { icone: 'alta' })}
      ${linha(bloco('Fluxo: onde a fila está', 'peças abertas por etapa; a barra é a quantidade, o número pequeno é quantos dias paradas (mediana)', deitadas(etapasMax.map((e) => ({ st: true, nome: e.status, valor: e.qtd, cls: (e.idadeMediana || 0) >= 3 ? 'ruim' : e.atrasadas ? 'atencao' : 'ok', rotulo: `<button type="button" class="vv-num" data-espiar="perf:etapa|${esc(e.status)}">${n0(e.qtd)}</button> <small>${dd(e.idadeMediana)}</small>`, sub: `${n0(e.atrasadas)} atrasadas` })), { vazio: 'Nenhuma peça aberta.' }), { icone: 'relogio' })
        + bloco('Processos', 'o que costuma travar antes da produção', `<ul class="vv-perf-proc">${proc.map(([q, t, s, cls]) => { const n = (Pr[q] || []).length; return `<li class="${n && cls ? cls : ''}"><span><b>${esc(t)}</b><small>${esc(s)}</small></span>${n ? `<button type="button" class="vv-num" data-espiar="perf:proc|${q}">${n0(n)}</button>` : '<em>0</em>'}</li>`; }).join('')}</ul>`, { icone: 'alerta' }))}
      ${linha(bloco('Por departamento', 'entregues no período e abertas agora', barras(P.grupos.slice(0, 8).map((g) => ({ rotulo: String(g.nome).split(' ')[0], entregues: g.entregues, abertas: g.abertas, atrasadas: g.atrasadas })), [{ chave: 'entregues', rotulo: 'Entregues', cls: 'c3' }, { chave: 'abertas', rotulo: 'Abertas', cls: 'c5' }, { chave: 'atrasadas', rotulo: 'Atrasadas', cls: 'c4' }]), { icone: 'pessoas' })
        + bloco('Por formato', 'quanto sai e quanto leva', deitadas(P.formatos.slice(0, 8).map((f) => ({ nome: f.nome, valor: f.entregues, cls: 'ok', rotulo: `${n0(f.entregues)} <small>${dd(f.tempoMediano)}</small>`, sub: `${n0(f.abertas)} abertas · no prazo ${pc(f.noPrazoPct)}` })), { vazio: 'Sem entregas no período.' }), { icone: 'doc' }))}
      ${bloco('Departamentos', 'cada número abre as peças por trás dele', tabela(P.grupos, { chave: 'grupos' }), { icone: 'pessoas' })}
      ${bloco('Operacionais', 'cada pessoa responsável pelas peças; peça de duas pessoas conta para as duas', tabela(P.pessoas, { chave: 'pessoas' }), { icone: 'pessoas' })}
      ${bloco('Clientes', 'os com mais atrasos primeiro', tabela(P.clientes, { chave: 'clientes', cli: true }), { icone: 'coracao' })}`;
  }

  raiz.VybePerformance = Object.freeze({
    calcular, html, PERIODOS,
    dias: () => dias,
    definirDias(d) { if (!PERIODOS.some(([x]) => x === Number(d))) return; dias = Number(d); try { localStorage.setItem('vybe.performance.dias', String(dias)); } catch { /* sem guardar */ } },
  });
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.VybePerformance;
