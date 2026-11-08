// vybe-mundo-setor.js — a Visão geral de cada setor do dock (Paulo, 08/11/2026: "quando eu clicar em clientes, ele
// já vai abrir a visão geral com todos os resumos de tudo no cliente, como no AgencyFlow").
//
//   VybeSetor.abrir(setor, ctx)  setor = 'setor:producao' | 'setor:clientes' | 'setor:comercial' | 'setor:financas' | 'setor:pessoas'
//   VybeSetor.fechar() · VybeSetor.aberto() → id do setor aberto ou ''
//
// ctx (de vybe-mundo.js): { nome, dica, subs: [{ id, nome, dica, url }], numeros(), fila(), abrirSub(id), aoFechar() }
// Um painel do mesmo desenho da Gestão (números no topo e um cartão por aba, com o resumo dela e "Abrir"). Os números
// vêm das MESMAS fontes das abas: numerosDoDono/minhaFila do painel (dados já carregados), VybeCarteira.dados(),
// VybePessoas.carga() e as leituras do servidor de cada aba (area=comercial&aba=…). Nada aqui grava; quem não pode
// ver o dinheiro recebe do servidor a recusa e o cartão diz isso.
(() => {
  'use strict';
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const n0 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)).toLocaleString('pt-BR') : '—');
  const reais = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—');
  const pct = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Math.round(Number(v))}%`);
  const carregando = () => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando' }) : '<div class="vb-carregando"><div class="vb-brilho"></div></div>');

  const el = document.createElement('section');
  el.className = 'vv-gestao vv-setor-visao'; el.hidden = true; el.setAttribute('aria-label', 'Visão geral do setor');
  document.body.append(el);
  let atual = '', ctx = null, geracao = 0;

  // Leituras do servidor com cache de 1 minuto (abrir e fechar o painel não refaz a conta toda).
  const cache = new Map();
  async function ler(url) {
    const c = cache.get(url);
    if (c && Date.now() - c.em < 60000) return c.r;
    let r;
    try {
      const resp = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      const corpo = await resp.json().catch(() => ({}));
      r = resp.ok ? corpo : { falha: resp.status === 403 ? 'negado' : resp.status === 503 ? 'aguardando' : 'erro', mensagem: corpo.error || '' };
    } catch { r = { falha: 'erro', mensagem: 'Sem conexão com o servidor.' }; }
    if (!r.falha) cache.set(url, { em: Date.now(), r });
    return r;
  }

  const kpi = (v, r, cls = '', sub = '') => `<div class="vv-g-kpi ${cls}"><b>${v}</b><small>${esc(r)}</small>${sub ? `<em>${esc(sub)}</em>` : ''}</div>`;
  // Cartão de uma aba: título, para que serve e o resumo; clicar abre a aba.
  function cartao(sub, resumo = '') {
    const ext = sub.url ? ' <i aria-hidden="true">↗</i>' : '';
    return `<button type="button" class="vv-g-cartao vv-setor-cartao" data-setor-sub="${esc(sub.id)}">
      <span class="vv-setor-cartao-topo"><b>${esc(sub.nome)}${ext}</b><em>Abrir →</em></span>
      <small>${esc(sub.dica || '')}</small>${resumo ? `<span class="vv-setor-resumo">${resumo}</span>` : ''}</button>`;
  }
  const linhas = (lista) => `<span class="vv-setor-linhas">${lista.filter(Boolean).map(([r, v, cls = '']) => `<span><small>${esc(r)}</small><b class="${cls}">${v}</b></span>`).join('')}</span>`;
  // Leitura que voltou sem o resumo (servidor sem a aba, demonstração): diz que não há números, sem fileira de traços.
  const semResumo = (r, campo = 'resumo') => !r.falha && !r[campo];
  const vazioHtml = '<span class="vv-setor-falha">Sem números agora.</span>';
  const falhaHtml = (r) => `<span class="vv-setor-falha">${r.falha === 'negado' ? 'Só os donos e a administração veem.' : r.falha === 'aguardando' ? 'Aguardando ativação no servidor.' : 'Não deu para ler agora.'}</span>`;

  // ---------- O que cada setor mostra ----------
  const SETORES = {
    'setor:producao'() {
      const N = ctx.numeros(), F = ctx.fila(), H = N?.hoje || {}, L = H.lista || {}, S = N?.semana || {}, C = N?.cobertura || {};
      const minhas = F?.itens || [], minhasAtrasadas = minhas.filter((x) => x.sit === 'atrasada').length;
      const itens = typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
      const emAprovacao = itens.filter((d) => /aprova/i.test(String(d.status || ''))).length;
      const kpis = kpi(n0(minhas.length), 'na sua fila', minhasAtrasadas ? 'u1' : '', minhasAtrasadas ? `${n0(minhasAtrasadas)} atrasadas` : 'em dia')
        + kpi(n0((L.atrasadas || []).length), 'atrasadas na agência', (L.atrasadas || []).length ? 'u1' : '')
        + kpi(n0((L.emRisco || []).length), 'risco de furo (2 dias)', (L.emRisco || []).length ? 'u2' : '')
        + kpi(`${n0(S.entregues)}<i>/${n0(S.previstas)}</i>`, 'entregues / previstas na semana');
      const resumo = {
        tarefas: linhas([['Na sua fila', n0(minhas.length)], ['Atrasadas', n0(minhasAtrasadas), minhasAtrasadas ? 't-u1' : ''], ['Para hoje', n0(minhas.filter((x) => x.sit === 'hoje').length)]]),
        agenda: (() => {
          // A agenda que o painel da direita já carregou (próximos 7 dias, area=captacoes); sem ela, diz que está carregando.
          const ag = ctx.agenda?.(); if (!Array.isArray(ag)) return linhas([['Agenda', 'carregando no painel']]);
          const prox = ag[0], cap = ag.filter((e) => e.tipo === 'captacao').length, reu = ag.filter((e) => e.tipo === 'reuniao').length;
          return linhas([['Captações em 7 dias', n0(cap)], ['Reuniões em 7 dias', n0(reu)], prox && ['Próximo', esc(String(prox.dia || '').slice(8, 10) + '/' + String(prox.dia || '').slice(5, 7) + ' · ' + (prox.cliente || prox.titulo || ''))]]);
        })(),
        direcao: linhas([['Em aprovação', n0(emAprovacao), emAprovacao ? 't-u2' : '']]),
        planejamentos: linhas([['Clientes sem planejamento', n0((C.semPlanejamento || []).length), (C.semPlanejamento || []).length ? 't-u2' : '']]),
        conteudo: linhas([['Sem 3 posts na semana', n0((C.sem3 || []).length), (C.sem3 || []).length ? 't-u2' : ''], ['Sem nenhum post', n0((C.semConteudo || []).length), (C.semConteudo || []).length ? 't-u1' : '']]),
      };
      return { kpis, cartoes: ctx.subs.map((s) => cartao(s, resumo[s.id] || '')).join('') };
    },
    'setor:clientes'() {
      const N = ctx.numeros(), C = N?.cobertura || {}, cl = N?.clientes || [];
      const conta = (k) => cl.filter((c) => c.saude === k).length;
      const saude = typeof window.VybeCarteira?.dados === 'function' ? window.VybeCarteira.dados() : [];
      const media = saude.length ? saude.reduce((s, c) => s + (Number(c.score) || 0), 0) / saude.length : null;
      const piores = [...saude].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 3);
      const kpis = kpi(n0(C.clientesAtivos), 'clientes ativos')
        + kpi(n0(conta('critico')), 'críticos', conta('critico') ? 'u1' : '')
        + kpi(n0(conta('atencao')), 'pedem atenção', conta('atencao') ? 'u2' : '')
        + kpi(media == null ? '—' : n0(media), 'saúde média da carteira (0–100)');
      const resumo = {
        clientes: linhas([['Ativos', n0(C.clientesAtivos)], ['Em dia', n0(conta('ok'))], ['Sem planejamento', n0((C.semPlanejamento || []).length)]]),
        carteira: piores.length ? `<span class="vv-setor-lista">${piores.map((c) => `<span><b>${esc(c.cliente)}</b><em>${n0(c.score)}</em></span>`).join('')}</span><small class="vv-setor-nota">Os 3 com a menor nota de saúde.</small>` : '',
      };
      return { kpis, cartoes: ctx.subs.map((s) => cartao(s, resumo[s.id] || '')).join('') };
    },
    async 'setor:comercial'() {
      const r = await ler('/api/painel?area=comercial&aba=funil'), R = r.resumo || {}, neg = R.em_negociacao || {};
      const kpis = r.falha || semResumo(r) ? '' : kpi(n0(neg.quantidade), 'em negociação', '', reais(neg.mensal) + ' por mês')
        + kpi(pct(R.taxa_ganho), 'taxa de ganho') + kpi(n0(R.total), 'oportunidades no funil');
      const fases = (R.fases || []).filter((f) => f.id !== 'perdido' && f.atual).slice(0, 4);
      const resumo = { funil: r.falha ? falhaHtml(r) : semResumo(r) ? vazioHtml : fases.length ? linhas(fases.map((f) => [f.nome, n0(f.atual)])) : linhas([['Nenhuma oportunidade aberta', '—']]) };
      return { kpis, cartoes: ctx.subs.map((s) => cartao(s, resumo[s.id] || '')).join('') };
    },
    async 'setor:financas'() {
      const [fin, rec, con, ina] = await Promise.all(['financas', 'recebimentos', 'contas', 'inadimplencia'].map((a) => ler(`/api/painel?area=comercial&aba=${a}`)));
      if (fin.falha === 'negado') return { kpis: '', cartoes: ctx.subs.map((s) => cartao(s, s.url ? '' : falhaHtml(fin))).join('') };
      const F = fin.resumo || {}, A = rec.resumo?.atual || {}, K = con.resumo || {};
      const kpis = semResumo(fin) && semResumo(rec) ? '' : kpi(reais(F.receita), 'receita mensal dos contratos') + kpi(pct(F.margem_percentual), 'margem', Number(F.margem_percentual) < 20 ? 'u2' : '')
        + kpi(reais(A.a_receber), 'a receber no mês') + kpi(reais(ina.total), 'em atraso', Number(ina.total) > 0 ? 'u1' : '');
      const resumo = {
        financas: fin.falha ? falhaHtml(fin) : semResumo(fin) ? vazioHtml : linhas([['Custo', reais(F.custo)], ['Margem', reais(F.margem)], ['Clientes com margem crítica', n0(F.criticas), F.criticas ? 't-u1' : '']]),
        recebimentos: rec.falha ? falhaHtml(rec) : semResumo(rec) ? vazioHtml : linhas([['A receber', reais(A.a_receber)], ['Recebido', reais(A.recebido)], ['Pendente', reais(A.pendente), Number(A.pendente) > 0 ? 't-u2' : '']]),
        contas: con.falha ? falhaHtml(con) : semResumo(con) ? vazioHtml : linhas([['Total do mês', reais(K.total)], ['A pagar', reais(K.a_pagar)], ['Vencidas', `${n0(K.vencidas?.quantidade)} · ${reais(K.vencidas?.total)}`, K.vencidas?.quantidade ? 't-u1' : '']]),
        inadimplencia: ina.falha ? falhaHtml(ina) : semResumo(ina, 'clientes') ? vazioHtml : linhas([['Clientes em atraso', n0((ina.clientes || []).length), (ina.clientes || []).length ? 't-u1' : ''], ['Críticos', n0(ina.criticos), ina.criticos ? 't-u1' : ''], ['Total', reais(ina.total)]]),
      };
      return { kpis, cartoes: ctx.subs.map((s) => cartao(s, resumo[s.id] || '')).join('') };
    },
    async 'setor:pessoas'() {
      let carga = null; try { carga = await window.VybePessoas?.carga?.(); } catch { carga = null; }
      const P = carga?.pessoas || [], cheias = P.filter((p) => Number(p.pct) >= 100).length, atrasadas = P.reduce((s, p) => s + (Number(p.atrasadas) || 0), 0);
      const e = typeof escritorio !== 'undefined' ? escritorio : null, online = (e?.conectado ? e.onlineTodos || e.online : e?.lobbyOnline) || [];
      const naEquipe = P.length || (typeof TEAM_USERS !== 'undefined' && Array.isArray(TEAM_USERS) ? TEAM_USERS.length : 0);
      const kpis = kpi(n0(naEquipe), 'pessoas na equipe') + kpi(n0(online.length), 'online agora')
        + kpi(n0(cheias), 'com a semana cheia (100%+)', cheias ? 'u2' : '') + kpi(n0(atrasadas), 'peças atrasadas no time', atrasadas ? 'u1' : '');
      const top = [...P].sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0)).slice(0, 3);
      const resumo = {
        equipe: linhas([['Online agora', n0(online.length)], ['Na equipe', n0(naEquipe)]]),
        produtividade: top.length ? `<span class="vv-setor-lista">${top.map((p) => `<span><b>${esc(p.nome)}</b><em>${pct(p.pct)} da semana</em></span>`).join('')}</span><small class="vv-setor-nota">Quem está com a semana mais cheia.</small>` : '',
      };
      return { kpis, cartoes: ctx.subs.map((s) => cartao(s, resumo[s.id] || '')).join('') };
    },
  };

  async function pintar() {
    if (el.hidden || !ctx) return;
    const g = ++geracao, montar = SETORES[atual];
    el.innerHTML = `<div class="vv-g-topo"><span><small class="vv-cb-kicker">Visão geral</small><h2>${esc(ctx.nome)}</h2><p>${esc(ctx.dica || '')}</p></span>
      <span class="vv-g-acoes"><button type="button" class="vv-botao" data-setor-fechar aria-label="Fechar">✕</button></span></div>
      <div class="vv-g-corpo">${carregando()}</div>`;
    let corpo;
    try {
      const r = montar ? await montar() : { kpis: '', cartoes: ctx.subs.map((s) => cartao(s)).join('') };
      corpo = `${r.kpis ? `<div class="vv-g-kpis">${r.kpis}</div>` : ''}<div class="vv-g-grade vv-setor-grade">${r.cartoes}</div>`;
    } catch (e) {
      console.error('[setor]', e);
      corpo = typeof window.vbEstadoHtml === 'function'
        ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não deu para montar a visão geral', texto: 'As abas continuam abrindo pelo dock.', acao: '<button type="button" class="vb-botao" data-setor-tentar>Tentar de novo</button>' })
        : '<p>Não deu para montar a visão geral.</p>';
    }
    if (g !== geracao || el.hidden) return;
    el.querySelector('.vv-g-corpo').innerHTML = corpo;
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-setor-fechar')) { fechar(); ctx?.aoFechar?.(); return; }
    if (b.hasAttribute('data-setor-tentar')) { cache.clear(); pintar(); return; }
    if (b.dataset.setorSub) ctx?.abrirSub?.(b.dataset.setorSub);
  });

  function abrir(setor, contexto) {
    atual = setor; ctx = contexto; el.hidden = false; el.scrollTop = 0;
    document.body.classList.add('mundo-setor-visao');
    pintar();
  }
  function fechar() {
    if (el.hidden) return;
    el.hidden = true; atual = ''; geracao++;
    document.body.classList.remove('mundo-setor-visao');
  }
  window.VybeSetor = Object.freeze({ abrir, fechar, aberto: () => (el.hidden ? '' : atual), atualizar: () => pintar() });
})();
