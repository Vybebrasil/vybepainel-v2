// vybe-mundo-boletim.js — Boletim de hoje dos agentes (Paulo, 09/11/2026: "os bots não deviam cada um me trazer um
// relatório todo dia? ... um relatório de cada setor, do que cada um fez, do que tá errado por setor ... o que fez e pra
// onde ir"; "meu pc fica ligado, sem problema").
//
// Não há outro relatório nem outra fonte: cada cartão junta o que a central do VYBES já entrega ao painel, ao vivo pelo
// túnel (o PC do Paulo fica ligado):
//   - O que fez: a atividade registrada do agente nas últimas 24 h (etapa=agentes, a mesma do Prédio e da página Agentes)
//     e os achados que ele fechou nesse tempo (etapa=perfil).
//   - O que está errado: os achados em aberto do perfil, do mais grave ao menos grave.
//   - Pra onde ir: as sugestões dos achados mais graves e as falhas, com o botão que abre o agente.
// Só para os donos (Agentes é trancado no dock). Abre sozinho uma vez por dia, na primeira vez que o dono entra e a
// central responde; depois fica no botão "Boletim dos agentes" do Hoje. Nada é gravado daqui.
(() => {
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const souDono = () => { try { return typeof G.souDonoDaSessao === 'function' && Boolean(G.souDonoDaSessao()); } catch { return false; } };
  const vendoComoOutro = () => { try { return Boolean(sessionStorage.getItem('vybe.verComo')); } catch { return false; } };
  const mv = () => G.mundoVoxel || {};
  const CHAVE_VISTO = 'vybe.boletim.visto';
  const DIA_MS = 864e5;
  const GRAV = { alta: 0, media: 1, baixa: 2 };
  const ESTADO_SETOR = { ativo: ['Ativo', '#18A957'], sombra: ['Sombra', '#0D74CE'], planejado: ['Planejado', '#7A8B82'] };
  const st = { aberto: false, i: 0, perfis: {}, carregando: null, erro: '', lidoEm: 0, achados: {}, msg: '', repintando: -1 };
  let raiz = null;

  const diaBahia = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
  const hora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' }); };
  const quando = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; return (diaBahia(d) === diaBahia() ? 'hoje' : 'ontem') + ' ' + hora(iso); };
  const recente = (iso, agora) => { const t = Date.parse(iso || ''); return Number.isFinite(t) && agora - t <= DIA_MS; };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const AGORA = { executando: ['Fazendo agora', '#0D74CE'], aguardando_aprovacao: ['Esperando aprovação', '#8E4EC6'], falhou: ['Parou com falha', '#D13D36'], disponivel: ['Livre', '#18A957'] };
  function agoraDe(atividade) {
    if (!atividade) return null;
    const [rotulo, cor] = AGORA[atividade.estado] || AGORA.disponivel;
    const ultimo = atividade.ultimos?.[0] || null;
    return { estado: atividade.estado, rotulo, cor, tarefa: atividade.tarefa || '', desde: atividade.desde || null, emCurso: atividade.emCurso || 0, ultimo };
  }
  function agoraTexto(a) {
    if (!a) return 'Sem leitura da central agora.';
    if (a.tarefa) return a.tarefa + (a.desde ? ' · desde ' + quando(a.desde) : '');
    if (a.ultimo) return 'Último: ' + a.ultimo.tarefa + ' · ' + quando(a.ultimo.em);
    return 'Nada registrado ainda.';
  }

  // Quem tem agente, andar por andar, na ordem do prédio (a mesma planta de mundo/planta.mjs).
  function agentesDaPlanta() {
    const planta = mv().planta?.() || [];
    return planta.flatMap((a) => (a.setores || []).filter((s) => s.agente).map((s) => ({ id: s.id, agente: s.agente, funcao: s.funcao || '', nome: s.nome, estado: s.estado || 'ativo', andar: a.nome })));
  }

  // Monta o boletim de um agente a partir das duas leituras. Função pura: os testes chamam direto.
  function boletimDoAgente(ag, { atividade = null, perfil = null, agora = Date.now() } = {}) {
    const feitos = (atividade?.ultimos || []).filter((e) => recente(e.em, agora));
    const concluidas = feitos.filter((e) => e.estado === 'concluida');
    const falhas = feitos.filter((e) => e.estado === 'falhou');
    const aguardando = feitos.filter((e) => e.estado === 'aguardando_aprovacao');
    const fechados = (perfil?.achados?.resolvidos || []).filter((a) => recente(a.fechadoEm, agora));
    const abertos = [...(perfil?.achados?.abertos || [])].sort((x, y) => (GRAV[x.gravidade] ?? 3) - (GRAV[y.gravidade] ?? 3) || (y.vezes || 0) - (x.vezes || 0));
    const urgentes = abertos.filter((a) => a.gravidade === 'alta').length;
    const ir = [];
    for (const f of falhas.slice(0, 1)) ir.push({ texto: `Ver por que falhou: ${f.tarefa}`, motivo: f.erro || 'A execução não terminou.' });
    for (const a of aguardando.slice(0, 1)) ir.push({ texto: `Aprovar ou recusar: ${a.tarefa}`, motivo: 'Em modo sombra: só sai com o ok de um dono.' });
    for (const a of abertos) { if (ir.length >= 3) break; if (a.sugestao) ir.push({ texto: a.sugestao, motivo: a.fato }); }
    const peso = urgentes * 100 + falhas.length * 50 + aguardando.length * 20 + abertos.length;
    const vivo = agoraDe(atividade);
    const ins = perfil?.insight, txt = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const insight = ins && txt(ins.insight, 600) ? { em: txt(ins.em, 40), referencia: txt(ins.referencia, 300), insight: txt(ins.insight, 600), aplicacao: txt(ins.aplicacao, 400) } : null;
    const ocupado = vivo && ['executando', 'aguardando_aprovacao'].includes(vivo.estado);
    // O que fez, sem repetir: "Registrar achado da esteira" 4 vezes vira uma linha com ×4 (Paulo, 09/11/2026: "muito texto corrido").
    const porTarefa = new Map();
    for (const e of concluidas) { const k = e.tarefa + '|' + (e.resultado || ''); const x = porTarefa.get(k) || { ...e, vezes: 0 }; x.vezes++; porTarefa.set(k, x); }
    const historico = Object.entries(perfil?.historico || {}).sort().slice(-14).map(([dia, v]) => ({ dia, concluidas: Number(v?.concluidas) || 0, falhas: Number(v?.falhas) || 0, aguardando: Number(v?.aguardando) || 0 }));
    return { ...ag, feitos, concluidas, falhas, aguardando, fechados, abertos, urgentes, ir, peso, agora: vivo, insight,
      fezAgrupado: [...porTarefa.values()], historico, numeros: perfil?.numeros || null, tendencia: perfil?.projecao?.tendencia || '',
      semLeitura: !atividade && !perfil, quieto: !ocupado && !insight && !feitos.length && !fechados.length && !abertos.length };
  }

  // Ordem do boletim: quem pede ação primeiro; quem não tem nada a dizer fica para o fim (e só é contado no resumo).
  function montar(agentes, { atividades = {}, perfis = {}, agora = Date.now() } = {}) {
    const lista = agentes.map((ag) => boletimDoAgente(ag, { atividade: atividades[ag.id], perfil: perfis[ag.id], agora }));
    const comAlgo = lista.filter((b) => !b.quieto).sort((x, y) => y.peso - x.peso);
    const quietos = lista.filter((b) => b.quieto);
    const soma = (k) => comAlgo.reduce((n, b) => n + b[k].length, 0);
    return { cartoes: comAlgo, quietos, todos: lista, resumo: { feitos: soma('concluidas'), fechados: soma('fechados'), abertos: soma('abertos'), urgentes: comAlgo.reduce((n, b) => n + b.urgentes, 0), falhas: soma('falhas'), aguardando: soma('aguardando') } };
  }

  async function lerPerfil(setor) {
    const r = await fetch(`/api/painel?area=vybes&etapa=perfil&setor=${encodeURIComponent(setor)}`, { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.perfil) throw new Error(d.error || 'Sem perfil da central agora.');
    return d.perfil;
  }
  // Lê a atividade de todos e o perfil de cada agente (4 de cada vez, para não entupir o túnel).
  function carregar(forcar = false) {
    if (st.carregando) return st.carregando;
    if (!forcar && st.lidoEm && Date.now() - st.lidoEm < 60e3) return Promise.resolve(true);
    st.carregando = (async () => {
      await mv().garantirModulo?.();
      const fonte = mv().fonteAgentes?.();
      const f = fonte ? await fonte.atualizar(true) : null;
      if (!f?.dados || f.erro) throw new Error('A central do VYBES não respondeu agora.');
      const fila = agentesDaPlanta().map((a) => a.id), perfis = {};
      await Promise.all(Array.from({ length: 4 }, async () => { while (fila.length) { const id = fila.shift(); try { perfis[id] = await lerPerfil(id); } catch { /* sem perfil: o cartão usa só a atividade */ } } }));
      st.perfis = perfis; st.atividades = Object.fromEntries(f.dados.agentes.map((a) => [a.setor, a])); st.erro = ''; st.lidoEm = Date.now();
      return true;
    })().catch((e) => { st.erro = e.message || 'A central do VYBES não respondeu agora.'; return false; }).finally(() => { st.carregando = null; if (st.aberto) pintar(); });
    return st.carregando;
  }

  const ICONE = {
    numeros: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    peca: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    insight: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
    agora: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    feito: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    errado: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
    ir: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };
  const secao = (tipo, titulo, corpo) => `<section class="vbl-secao vbl-${tipo}"><h4><span class="vbl-ic" aria-hidden="true">${ICONE[tipo]}</span>${titulo}</h4>${corpo}</section>`;

  function agoraHtml(b) {
    const a = b.agora, [rot, cor] = a ? [a.rotulo, a.cor] : ['Sem leitura', '#7A8B82'];
    return `<p class="vbl-agora" style="--c:${cor}"><span class="vbl-agora-rot"><i aria-hidden="true"></i>${esc(rot)}</span><span>${esc(agoraTexto(a))}${a?.emCurso > 1 ? ` · ${plural(a.emCurso, 'tarefa', 'tarefas')} na fila` : ''}</span></p>`;
  }
  // Um achado: clicar abre a peça (calendário, quem faz, datas e a sugestão do agente para aplicar). Resolvido e Ignorar
  // fecham pela mesma rota da página Agentes. Achado sem peça (vybe:ID) fica só com os botões.
  const ehPeca = (ref) => /^vybe:[1-9]\d{0,19}$/.test(String(ref || ''));
  function achadoHtml(a, setor, { fechado = false } = {}) {
    st.achados[setor + '|' + a.chave] = a;
    const cli = a.cliente ? (typeof G.cliCor === 'function' ? G.cliCor(a.cliente) : esc(a.cliente)) + ' ' : '';
    const meta = fechado ? `achado fechado ${esc(quando(a.fechadoEm))}${a.comoFechou ? ' · ' + esc(a.comoFechou) : ''}`
      : `${a.gravidade === 'alta' ? '<em>urgente</em> · ' : ''}${esc(a.prova || '')}${a.vezes > 1 ? ` · visto ${a.vezes}x` : ''}`;
    const titulo = a.titulo && !fechado ? a.titulo : a.fato;
    const corpo = `<b>${esc(titulo)}</b>${titulo !== a.fato ? `<span class="vbl-fato">${esc(a.fato)}</span>` : ''}<small>${cli}${meta}</small>`;
    const abrir = ehPeca(a.ref) ? `<button type="button" class="vbl-achado-abrir" data-vbl-peca="${esc(a.ref)}" data-vbl-chave="${esc(a.chave)}" data-vbl-setor="${esc(setor)}" title="Abrir a peça: calendário, quem faz, datas e a sugestão do agente"><span class="vbl-achado-ic" aria-hidden="true">${ICONE.peca}</span><span class="vbl-achado-txt">${corpo}</span><i aria-hidden="true">→</i></button>` : `<div class="vbl-achado-txt">${corpo}</div>`;
    const acoes = fechado ? '' : `<span class="vbl-achado-acoes"><button type="button" data-vbl-achado="resolvido" data-vbl-chave="${esc(a.chave)}" data-vbl-setor="${esc(setor)}">Resolvido</button><button type="button" data-vbl-achado="ignorar" data-vbl-chave="${esc(a.chave)}" data-vbl-setor="${esc(setor)}">Ignorar</button></span>`;
    return `<li class="vbl-achado g-${esc(fechado ? 'feito' : a.gravidade || 'baixa')}">${abrir}${acoes}</li>`;
  }
  // Achados do mesmo tipo numa linha (como no "Depende de você"): o resumo, os clientes e a lista um a um.
  function grupoHtml(g, setor) {
    const urg = g.achados.some((a) => a.gravidade === 'alta'), vis = g.clientes.slice(0, 6);
    return `<li class="vbl-achado vbl-grupo g-${urg ? 'alta' : 'media'}"><details><summary><span class="vbl-achado-txt"><b>${esc(g.titulo)}</b>
      <small>${urg ? '<em>urgente</em> · ' : ''}${vis.map((c) => (typeof G.cliCor === 'function' ? G.cliCor(c) : esc(c))).join(' ')}${g.clientes.length > vis.length ? ` e mais ${g.clientes.length - vis.length}` : ''}${g.exemplo ? ' · ex.: ' + esc(g.exemplo) : ''}</small></span><span class="vbl-ver">Ver os ${g.achados.length}</span></summary>
      <ul>${g.achados.map((a) => achadoHtml(a, setor)).join('')}</ul></details></li>`;
  }
  // Os números do agente (Paulo: "trazer gráfico, análise dentro de cada boletim"): o que fez por dia em 14 dias, com as
  // falhas em vermelho, e acerto, resolvidos e tempo até resolver, das mesmas contas do perfil (core/perfil-agente.js).
  function numerosHtml(b) {
    const n = b.numeros || {}, h = b.historico || [];
    if (!h.length && !b.numeros) return '';
    const max = Math.max(1, ...h.map((d) => d.concluidas + d.falhas));
    const total = h.reduce((t, d) => t + d.concluidas, 0), falhas = h.reduce((t, d) => t + d.falhas, 0);
    const kpi = (v, rot, dica, cls = '') => `<span class="vbl-kpi ${cls}" title="${esc(dica)}"><b>${v}</b><small>${rot}</small></span>`;
    const barras = h.length ? `<div class="vbl-barras" role="img" aria-label="${total} execuções concluídas e ${falhas} falhas em ${h.length} dias">${h.map((d) => `<span title="${esc(d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7))}: ${d.concluidas} concluídas${d.falhas ? ', ' + d.falhas + ' falhas' : ''}${d.aguardando ? ', ' + d.aguardando + ' esperando' : ''}"><i style="height:${Math.round(d.concluidas / max * 100)}%"></i>${d.falhas ? `<i class="f" style="height:${Math.max(6, Math.round(d.falhas / max * 100))}%"></i>` : ''}<small>${esc(d.dia.slice(8, 10))}</small></span>`).join('')}</div>` : '<p class="vbl-vazio">Sem execução registrada nos últimos 14 dias.</p>';
    return secao('numeros', 'Como está indo', `<div class="vbl-kpis">
        ${kpi(n.abertos ?? b.abertos.length, 'em aberto', 'Achados abertos agora', (n.altas || b.urgentes) ? 'ruim' : '')}
        ${kpi(n.resolvidos7d ?? 0, 'resolvidos em 7 dias', 'Achados que fecharam na última semana')}
        ${kpi(n.acerto == null ? '—' : n.acerto + '%', 'de acerto', 'Resolvidos ÷ (resolvidos + marcados como errado), em 7 dias', n.acerto != null && n.acerto < 70 ? 'atencao' : '')}
        ${kpi(n.horasAteResolver == null ? '—' : n.horasAteResolver + ' h', 'até resolver', 'Mediana do tempo entre o agente achar e o achado fechar')}
      </div>${barras}<p class="vbl-tendencia">${h.length ? `${total} execuções em ${h.length} dias${falhas ? `, ${falhas} com falha` : ', nenhuma falha'}` : ''}${b.tendencia ? `${h.length ? ' · ' : ''}tendência: ${esc(b.tendencia)}` : ''}</p>`);
  }
  function cartaoHtml(b) {
    const [rotEstado, corEstado] = ESTADO_SETOR[b.estado] || ESTADO_SETOR.ativo;
    const fez = [
      ...b.fezAgrupado.slice(0, 5).map((e) => `<li class="vbl-fez"><b>${esc(e.tarefa)}${e.vezes > 1 ? ` <span class="vbl-vezes">×${e.vezes}</span>` : ''}</b><small>${e.vezes > 1 ? 'a última ' : ''}${esc(quando(e.em))}${e.resultado ? ' · ' + esc(e.resultado) : ''}</small></li>`),
      ...b.fechados.slice(0, 3).map((a) => achadoHtml(a, b.id, { fechado: true })),
    ];
    const mais = b.fezAgrupado.length + b.fechados.length - fez.length;
    const grupos = typeof G.VybeAgentes?.agrupar === 'function' ? G.VybeAgentes.agrupar(b.abertos) : b.abertos.map((a) => ({ achados: [a] }));
    const errado = grupos.slice(0, 5).map((g) => (g.achados.length === 1 ? achadoHtml(g.achados[0], b.id) : grupoHtml(g, b.id)));
    const falhas = b.falhas.slice(0, 2).map((e) => `<li class="g-alta"><b>Falhou: ${esc(e.tarefa)}</b><small>${esc(quando(e.em))}${e.erro ? ' · ' + esc(e.erro) : ''}</small></li>`);
    return `<article class="vbl-cartao" aria-label="Boletim de ${esc(b.agente)}">
      <div class="vbl-cab"><span class="vbl-av" aria-hidden="true">${esc(b.agente.slice(0, 1))}</span>
        <span class="vbl-quem"><small>${esc(b.andar)} · ${esc(b.nome)}</small><b>${esc(b.agente)}</b><small>${esc(b.funcao)}</small></span>
        <span class="vbl-estado" style="--c:${corEstado}"><i></i>${rotEstado}</span></div>
      ${agoraHtml(b)}
      ${numerosHtml(b)}
      ${secao('feito', 'O que eu fiz', fez.length ? `<ul>${fez.join('')}</ul>${mais > 0 ? `<p class="vbl-mais">e mais ${mais}</p>` : ''}` : `<p class="vbl-vazio">${b.semLeitura ? 'Sem leitura deste agente agora.' : 'Nada concluído nas últimas 24 horas.'}</p>`)}
      ${secao('errado', 'O que está errado', falhas.length || errado.length ? `<ul>${falhas.join('')}${errado.join('')}</ul>${grupos.length > 5 ? `<p class="vbl-mais">e mais ${grupos.length - 5} tipos de achado: <button type="button" class="vbl-link" data-vbl-agente="${esc(b.id)}">ver todos em ${esc(b.agente)}</button></p>` : ''}` : '<p class="vbl-vazio">Nada em aberto no setor.</p>')}
      ${secao('ir', 'Pra onde ir', `${b.ir.length ? `<ol>${b.ir.map((x) => `<li><b>${esc(x.texto)}</b><small>${esc(x.motivo)}</small></li>`).join('')}</ol>` : '<p class="vbl-vazio">Seguir a rotina: nada pede decisão hoje.</p>'}
        <button type="button" class="vbl-botao principal" data-vbl-agente="${esc(b.id)}">Abrir ${esc(b.agente)}</button>`)}
      ${b.insight ? secao('insight', 'Insight da semana', `<p class="vbl-insight-texto">${esc(b.insight.insight)}</p>
        ${b.insight.aplicacao ? `<p class="vbl-insight-aplicar"><b>Como aplicar</b>${esc(b.insight.aplicacao)}</p>` : ''}
        <small class="vbl-insight-fonte">${b.insight.referencia ? 'Referência: ' + esc(b.insight.referencia) : ''}${b.insight.em ? (b.insight.referencia ? ' · ' : '') + 'estudado ' + esc(quando(b.insight.em) || b.insight.em) : ''}</small>`) : ''}
    </article>`;
  }

  function resumoHtml(B) {
    const r = B.resumo;
    const linha = (n, rot, cls = '') => `<span class="vbl-num ${cls}"><b>${n}</b><small>${rot}</small></span>`;
    return `<article class="vbl-cartao vbl-agencia" aria-label="Resumo da agência">
      <div class="vbl-cab"><span class="vbl-av vybes" aria-hidden="true">V</span><span class="vbl-quem"><small>Todos os setores</small><b>A agência hoje</b><small>${plural(B.cartoes.length, 'agente com algo a dizer', 'agentes com algo a dizer')}</small></span></div>
      <div class="vbl-nums">${linha(r.feitos, 'feitas em 24 h')}${linha(r.fechados, 'achados fechados')}${linha(r.abertos, 'em aberto', r.abertos ? 'atencao' : '')}${linha(r.urgentes, 'urgentes', r.urgentes ? 'ruim' : '')}</div>
      ${r.falhas || r.aguardando ? `<p class="vbl-alerta">${r.falhas ? plural(r.falhas, 'execução falhou', 'execuções falharam') : ''}${r.falhas && r.aguardando ? ' · ' : ''}${r.aguardando ? plural(r.aguardando, 'proposta espera um dono', 'propostas esperam um dono') : ''}</p>` : ''}
      ${(() => { const com = (B.todos || []).filter((b) => b.abertos.length).sort((x, y) => y.abertos.length - x.abertos.length); const max = Math.max(1, ...com.map((b) => b.abertos.length));
        return com.length ? secao('numeros', 'Onde estão os problemas', `<ul class="vbl-onde">${com.map((b) => `<li><button type="button" data-vbl-ir="${B.cartoes.indexOf(b) + 1}" ${B.cartoes.includes(b) ? '' : 'disabled'}><b>${esc(b.agente)}</b><span class="vbl-onde-barra" style="--t:${Math.round(b.abertos.length / max * 100)}%;--u:${Math.round(b.urgentes / max * 100)}%"><i></i><i class="u"></i></span><small>${b.abertos.length}${b.urgentes ? ` · <em>${b.urgentes} urgente${b.urgentes > 1 ? 's' : ''}</em>` : ''}</small></button></li>`).join('')}</ul>`) : ''; })()}
      ${secao('agora', 'O que cada um está fazendo agora', `<ul class="vbl-agora-lista">${(B.todos || []).map((b) => `<li><b>${esc(b.agente)}</b><small>${esc(b.nome)}</small>${agoraHtml(b)}</li>`).join('')}</ul>`)}
      ${secao('ir', 'Por onde começar', B.cartoes.length ? `<ol>${B.cartoes.slice(0, 3).map((b, i) => `<li><button type="button" class="vbl-pular" data-vbl-ir="${i + 1}"><b>${esc(b.agente)} · ${esc(b.nome)}</b><small>${b.urgentes ? plural(b.urgentes, 'urgente', 'urgentes') + ' · ' : ''}${plural(b.abertos.length, 'em aberto', 'em aberto')}${b.falhas.length ? ' · ' + plural(b.falhas.length, 'falha', 'falhas') : ''}</small></button></li>`).join('')}</ol>` : '<p class="vbl-vazio">Nenhum agente pede atenção hoje.</p>')}
      ${(() => { const sem = B.quietos.filter((b) => b.semLeitura), calmos = B.quietos.filter((b) => !b.semLeitura); return `${calmos.length ? `<p class="vbl-mais">Sem nada a relatar: ${calmos.map((b) => esc(b.agente)).join(', ')}.</p>` : ''}${sem.length ? `<p class="vbl-mais">Sem leitura da central (ainda não rodam ou não responderam): ${sem.map((b) => esc(b.agente)).join(', ')}.</p>` : ''}`; })()}
    </article>`;
  }

  function pintar() {
    if (!st.aberto) { if (raiz) raiz.hidden = true; return; }
    if (!raiz) {
      raiz = document.createElement('div'); raiz.className = 'vbl-fundo'; raiz.hidden = true;
      raiz.innerHTML = '<div class="vbl-janela" role="dialog" aria-modal="false" aria-labelledby="vbl-titulo"></div>';
      raiz.addEventListener('click', aoClicar); document.body.append(raiz);
    }
    const jan = raiz.querySelector('.vbl-janela'); st.achados = {};
    const rolagem = raiz.querySelector('.vbl-palco')?.scrollTop || 0, abertos = [...raiz.querySelectorAll('.vbl-palco details[open] > summary')].map((x) => x.textContent);
    const pronto = st.lidoEm && !st.erro;
    const B = pronto ? montar(agentesDaPlanta(), { atividades: st.atividades, perfis: st.perfis }) : null;
    const paginas = B ? [resumoHtml(B), ...B.cartoes.map(cartaoHtml)] : [];
    st.i = Math.max(0, Math.min(st.i, paginas.length - 1));
    const nomes = B ? ['Agência', ...B.cartoes.map((b) => b.agente)] : [];
    const data = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', weekday: 'long', day: 'numeric', month: 'long' });
    jan.innerHTML = `<div class="vbl-topo"><span><small>${esc(data)}</small><h2 id="vbl-titulo">Boletim dos agentes</h2><p>O que cada setor fez, o que está errado e pra onde ir.</p></span>
        <button type="button" class="vbl-fechar" data-vbl-fechar aria-label="Fechar o boletim"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      ${!B ? (st.erro
        ? `<div class="vbl-estado-tela"><b>Não deu para montar o boletim</b><p>${esc(st.erro)}</p><button type="button" class="vbl-botao principal" data-vbl-tentar>Tentar de novo</button></div>`
        : '<div class="vbl-estado-tela vbl-carregando" aria-busy="true"><i></i><i></i><i></i><p>Pedindo o relatório de cada agente à central…</p></div>')
      : `<nav class="vbl-abas" aria-label="Agentes do boletim">${nomes.map((n, i) => `<button type="button" data-vbl-ir="${i}" ${i === st.i ? 'aria-current="true"' : ''}>${esc(n)}${i && B.cartoes[i - 1].urgentes ? '<i aria-label="tem urgente"></i>' : ''}</button>`).join('')}</nav>
        <div class="vbl-palco">${paginas[st.i]}</div>
        ${st.msg ? `<p class="vbl-msg" role="status">${esc(st.msg)}</p>` : ''}<div class="vbl-pe"><button type="button" class="vbl-botao" data-vbl-passo="-1" ${st.i ? '' : 'disabled'}>Anterior</button><small>${st.i + 1} de ${paginas.length}</small>
          <button type="button" class="vbl-botao ${st.i < paginas.length - 1 ? 'principal' : ''}" data-vbl-passo="${st.i < paginas.length - 1 ? 1 : 0}">${st.i < paginas.length - 1 ? 'Próximo' : 'Concluir'}</button></div>`}`;
    raiz.hidden = false;
    if (st.repintando === st.i) { raiz.querySelectorAll('.vbl-palco details > summary').forEach((x) => { if (abertos.includes(x.textContent)) x.parentElement.open = true; }); const p = raiz.querySelector('.vbl-palco'); if (p) p.scrollTop = rolagem; }
    st.repintando = st.i;
    raiz.querySelector('.vbl-abas [aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  function aoClicar(e) {
    if (e.target === raiz) { fechar(); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-vbl-fechar')) { fechar(); return; }
    if (b.hasAttribute('data-vbl-tentar')) { st.erro = ''; pintar(); void carregar(true); return; }
    if (b.dataset.vblIr != null) { st.i = Number(b.dataset.vblIr) || 0; pintar(); return; }
    if (b.dataset.vblPasso != null) { const p = Number(b.dataset.vblPasso); if (!p) fechar(); else { st.i += p; pintar(); } return; }
    if (b.dataset.vblAgente) { fechar(); G.VybeAgentes?.abrir?.(b.dataset.vblAgente); return; }
    if (b.dataset.vblPeca) { G.VybePeca?.abrir?.(b.dataset.vblPeca, { achado: st.achados[b.dataset.vblSetor + '|' + b.dataset.vblChave] || null, setor: b.dataset.vblSetor }); return; }
    if (b.dataset.vblAchado) { void fecharAchado(b.dataset.vblChave, b.dataset.vblAchado, b.dataset.vblSetor); }
  }
  // Resolvido / Ignorar um achado daqui: a mesma rota da página Agentes; depois relê só o perfil desse agente.
  async function fecharAchado(chave, acao, setor) {
    st.msg = '';
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'achado', chave, acao }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && d.error !== 'Esse achado já foi fechado.') throw new Error(d.error || 'Não foi possível salvar agora.');
      st.msg = acao === 'ignorar' ? 'Achado ignorado.' : 'Achado resolvido.';
      await relerPerfil(setor);
    } catch (e) { st.msg = e.message; }
    pintar();
  }
  async function relerPerfil(setor) { try { st.perfis[setor] = await lerPerfil(setor); } catch { /* fica o que havia */ } if (st.aberto) pintar(); }
  G.addEventListener?.('vybe:achado-mudou', (e) => { if (e.detail?.setor && st.lidoEm) void relerPerfil(e.detail.setor); });
  // "Abrir a demanda completa" na peça: a gaveta abre embaixo das janelas; o boletim sai da frente.
  G.addEventListener?.('vybe:peca-completa', () => { if (st.aberto) fechar(); });
  function abrir() {
    st.aberto = true; st.i = 0;
    try { localStorage.setItem(CHAVE_VISTO, diaBahia()); } catch { /* sem armazenamento: abre de novo amanhã do mesmo jeito */ }
    pintar(); void carregar();
    setTimeout(() => raiz?.querySelector('.vbl-fechar')?.focus(), 0);
  }
  function fechar() { st.aberto = false; pintar(); }
  document.addEventListener('keydown', (e) => {
    if (!st.aberto || e.target.closest?.('input,textarea,select')) return;
    if (e.key === 'Escape') fechar();
    // Painel sem fundo (o resto da tela segue clicável): as setas só trocam de agente com o foco dentro dele.
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && raiz?.contains(document.activeElement)) { const n = raiz?.querySelectorAll('.vbl-abas button').length || 0; const i = st.i + (e.key === 'ArrowRight' ? 1 : -1); if (i >= 0 && i < n) { st.i = i; pintar(); } }
  });
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-boletim]')) abrir(); });

  // Botão do Hoje (só para os donos, como a página Agentes).
  const podeVer = () => souDono() && !vendoComoOutro();
  const botaoHtml = () => (podeVer()
    ? '<button type="button" class="vbl-abrir" data-boletim><span class="vbl-abrir-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg></span><span class="vbl-abrir-texto"><b>Boletim dos agentes</b><small>O que cada setor fez, o que está errado e pra onde ir</small></span><i aria-hidden="true">→</i></button>'
    : '');

  // Uma vez por dia: na primeira vez que um dono entra no painel e a central responde. Sem central, não abre sozinho
  // (um erro na cara logo cedo não ajuda); o botão continua no Hoje.
  async function talvezAbrirSozinho() {
    let visto = ''; try { visto = localStorage.getItem(CHAVE_VISTO) || ''; } catch { return; }
    if (visto === diaBahia() || st.aberto || !souDono() || vendoComoOutro() || !document.body.classList.contains('mundo')) return;
    if (document.body.classList.contains('auth-pending') || document.querySelector('.workflow-modal.open, dialog[open]')) return;
    if (await carregar()) abrir();
  }
  if (typeof setTimeout === 'function' && typeof document !== 'undefined' && document.addEventListener) {
    let tentativas = 0;
    const agendar = () => setTimeout(async () => { if (++tentativas > 6) return; if (!G.mundoVoxel || !souDono()) { agendar(); return; } await talvezAbrirSozinho(); }, tentativas ? 10e3 : 6e3);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agendar); else agendar();
  }

  G.VybeBoletim = { abrir, fechar, botaoHtml, podeVer, montar, boletimDoAgente, aberto: () => st.aberto };
})();
