// Mídia (Vinícius, 20/11/2026: "um controle geral do que é relacionado à mídia desse cliente... o que não tiver
// conectado ainda, a gente deixa o espacinho para conectar"). A tela interna da gestão, só dos quatro donos: uma linha
// por cliente ativo com cada canal de mídia — Meta Ads, Google Ads e o site — e o sinal do Ícaro (Mídia Paga, 5º andar).
//
// Os dados vêm de area=midia (server/midia.js): a carteira chega de uma vez e o Meta de cada cliente chega depois, de 4
// em 4 (cada um pergunta ao VybeHub, que pergunta ao Meta). Canal sem conexão aparece como "não conectado", nunca zero.
// O detalhe completo do cliente é o painel do VybeHub; aqui fica a visão da agência inteira. Só leitura.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : esc(n); }
  const IC = {
    lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    tomada: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/></svg>',
  };
  const TIPO = { messages: ['conversa', 'conversas'], profile_visits: ['visita ao perfil', 'visitas ao perfil'], reach: ['pessoa alcançada', 'pessoas alcançadas'],
    impressions: ['impressão', 'impressões'], link_clicks: ['clique no link', 'cliques no link'], leads: ['cadastro', 'cadastros'], purchases: ['compra', 'compras'],
    video_views: ['visualização de vídeo', 'visualizações de vídeo'], follows: ['seguidor', 'seguidores'], engagement: ['interação', 'interações'], other: ['resultado', 'resultados'] };
  const TOM = { r: 'Pede ação', a: 'De olho', g: 'Em dia', n: 'Sem dados' };
  const PESO = { r: 0, a: 1, g: 2, n: 3 };
  const reais = (v) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
  const tipoTxt = (t, n) => { const p = TIPO[t] || TIPO.other; return Number(n) === 1 ? p[0] : p[1]; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  let estado = { clientes: [], canais: [], dias: 7, hubAtivo: true, filtro: 'todos', busca: '', aberta: '', carregando: false, erro: '' };
  // O Meta de cada cliente por período: { [dias]: { [id]: { estado: 'buscando'|'pronto'|'falhou', dados } } }.
  let metas = {};
  let geracao = 0, janela = null;

  function criarJanela() {
    janela = document.createElement('section');
    janela.id = 'vv-midia';
    janela.className = 'vv-midia d3-tema d3m-c-janela';
    janela.setAttribute('role', 'dialog');
    janela.setAttribute('aria-label', 'Mídia');
    janela.hidden = true;
    document.body.append(janela);
    janela.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) { const l = ev.target.closest('[data-md-linha]'); if (l && !ev.target.closest('a,input')) alternar(l.dataset.mdLinha); return; }
      if (b.dataset.mdFechar !== undefined) return fechar();
      if (b.dataset.mdLinha) return alternar(b.dataset.mdLinha);
      if (b.dataset.mdFiltro) { estado.filtro = b.dataset.mdFiltro; return pintarLista(); }
      if (b.dataset.mdDias) { estado.dias = Number(b.dataset.mdDias) || 7; estado.aberta = ''; pintar(); return buscarMetas(); }
      if (b.dataset.mdRecarregar !== undefined) { metas = {}; return carregar(); }
      if (b.dataset.mdTentar) { delete (metas[estado.dias] || {})[b.dataset.mdTentar]; pintar(); return buscarMetas(); }
    });
    janela.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-md-busca]')) { estado.busca = ev.target.value; pintarLista(); } });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !ev.defaultPrevented && janela && !janela.hidden) fechar(); });
  }
  function alternar(id) { estado.aberta = estado.aberta === id ? '' : id; pintarLista(); }

  const metaDe = (id) => metas[estado.dias]?.[id] || null;
  // O tom da linha: o sinal do Ícaro quando o Meta respondeu; sem conta ou sem dados, cinza.
  function tomDe(c) {
    const m = metaDe(c.id);
    if (!m || m.estado !== 'pronto') return 'n';
    return m.dados.estado === 'ok' ? m.dados.sinal?.tom || 'n' : 'n';
  }
  function linhasVisiveis() {
    const q = norm(estado.busca);
    let lista = estado.clientes.filter((c) => !q || norm(c.nome).includes(q));
    if (estado.filtro === 'acao') lista = lista.filter((c) => ['r', 'a'].includes(tomDe(c)));
    if (estado.filtro === 'sem') lista = lista.filter((c) => { const m = metaDe(c.id); return m?.estado === 'pronto' && m.dados.estado === 'sem_conta'; });
    return [...lista].sort((a, b) => PESO[tomDe(a)] - PESO[tomDe(b)] || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }
  function contagem() {
    const t = estado.clientes;
    return { todos: t.length, acao: t.filter((c) => ['r', 'a'].includes(tomDe(c))).length,
      sem: t.filter((c) => { const m = metaDe(c.id); return m?.estado === 'pronto' && m.dados.estado === 'sem_conta'; }).length };
  }

  // Célula do Meta: investido, variação e o resultado principal com o custo.
  function celulaMeta(c) {
    const m = metaDe(c.id);
    if (!m || m.estado === 'buscando') return '<span class="md-cel md-brilho" aria-label="Buscando o Meta"><i></i></span><span class="md-cel md-brilho"><i></i></span>';
    if (m.estado === 'falhou') return `<span class="md-cel md-apagado">Não respondeu</span><span class="md-cel"><button type="button" class="md-link" data-md-tentar="${esc(c.id)}">Tentar de novo</button></span>`;
    const d = m.dados;
    if (d.estado === 'sem_conta') return '<span class="md-cel md-apagado">Sem conta vinculada</span><span class="md-cel md-apagado">—</span>';
    if (d.estado !== 'ok') return `<span class="md-cel md-apagado">${esc(d.estado === 'erro' ? 'Não respondeu' : 'Sem dados no período')}</span><span class="md-cel md-apagado">—</span>`;
    const ant = d.investido_anterior, delta = ant > 0 ? Math.round(((d.investido - ant) / ant) * 100) : null;
    const res = d.resultados ? `${inteiro(d.resultados)} ${tipoTxt(d.tipo_resultado, d.resultados)}${d.custo_resultado != null ? ` · ${reais(d.custo_resultado)} cada` : ''}` : 'sem resultado';
    return `<span class="md-cel md-num">${reais(d.investido)}${delta != null ? ` <small class="md-delta">${delta > 0 ? '+' : ''}${delta}%</small>` : ''}</span><span class="md-cel" title="${esc(res)}">${esc(res)}</span>`;
  }
  const naoConectado = (txt = 'Não conectado') => `<span class="md-cel md-apagado md-tomada">${IC.tomada}${txt}</span>`;
  function linha(c) {
    const tom = tomDe(c), aberta = estado.aberta === c.id;
    return `<div class="md-lin${aberta ? ' aberta' : ''}" data-md-linha="${esc(c.id)}" aria-expanded="${aberta}">
      <span class="md-sinal ${tom}" title="${TOM[tom]}"><i aria-hidden="true"></i><span class="md-sr">${TOM[tom]}</span></span>
      <button type="button" class="md-nome" data-md-linha="${esc(c.id)}" aria-expanded="${aberta}">${cliCor(c.nome)}</button>
      ${celulaMeta(c)}${naoConectado()}${c.tem_site ? naoConectado('Site sem análise') : '<span class="md-cel md-apagado">Sem site</span>'}
      <span class="md-chev" aria-hidden="true">${IC.seta}</span></div>${aberta ? detalhe(c) : ''}`;
  }
  // A linha aberta: o porquê do sinal, as campanhas, o melhor anúncio, o que o cérebro guarda e o que falta conectar.
  function detalhe(c) {
    const m = metaDe(c.id), d = m?.estado === 'pronto' ? m.dados : null, canais = estado.canais;
    const falta = canais.filter((k) => !k.fonte && (k.id !== 'site' || c.tem_site)).map((k) => `<li><b>${esc(k.nome)}</b> · ${esc(k.falta)}</li>`).join('');
    let meta = '';
    if (!d) meta = '<p class="md-det-txt">Buscando o Meta deste cliente.</p>';
    else if (d.estado === 'sem_conta') meta = '<p class="md-det-txt">A conta de anúncios do Meta deste cliente não está vinculada no VybeHub. Vincule no admin do Hub (Conta Meta) e a linha passa a mostrar os números.</p>';
    else if (d.estado !== 'ok') meta = `<p class="md-det-txt">${esc(d.motivo || 'Sem dados do Meta no período.')}</p>`;
    else {
      const camp = (d.campanhas || []).map((k) => `<tr><td title="${esc(k.nome)}">${esc(k.nome)}</td><td class="n">${reais(k.investido)}</td><td class="n" title="${k.resultados ? esc(`${inteiro(k.resultados)} ${tipoTxt(k.tipo_resultado, k.resultados)}`) : ''}">${k.resultados ? inteiro(k.resultados) : '—'}</td><td class="n">${k.custo_resultado != null ? reais(k.custo_resultado) : '—'}</td><td class="n${k.frequencia > 3 ? ' a' : ''}">${k.frequencia != null ? String(k.frequencia).replace('.', ',') : '—'}</td></tr>`).join('');
      meta = `<p class="md-det-txt"><b>Ícaro:</b> ${esc(d.sinal?.motivo || '')}</p>
        ${camp ? `<table class="md-tab"><thead><tr><th>Campanhas que mais investiram</th><th class="n">Investido</th><th class="n">Resultado</th><th class="n">Custo</th><th class="n">Frequência</th></tr></thead><tbody>${camp}</tbody></table>` : ''}
        ${d.melhor_anuncio ? `<p class="md-det-txt">Melhor anúncio: <b>${esc(d.melhor_anuncio.nome)}</b> · ${inteiro(d.melhor_anuncio.resultados)} ${tipoTxt(d.melhor_anuncio.tipo_resultado, d.melhor_anuncio.resultados)}${d.melhor_anuncio.custo_resultado != null ? ` a ${reais(d.melhor_anuncio.custo_resultado)}` : ''}</p>` : ''}`;
    }
    const cerebro = (m?.registros || []).map((r) => `<li><b>${esc(r.titulo)}</b><small class="md-apagado"> · ${esc(new Date(r.criado_em).toLocaleDateString('pt-BR'))}</small></li>`).join('');
    return `<div class="md-det" role="region" aria-label="Mídia de ${esc(c.nome)}">
      <div class="md-det-col"><b class="md-det-h">Meta Ads · ${estado.dias} dias</b>${meta}
        <a class="md-link" href="https://vybehub.vercel.app/admin" target="_blank" rel="noopener">Ver o painel completo no VybeHub</a></div>
      <div class="md-det-col">${falta ? `<b class="md-det-h">A conectar</b><ul class="md-det-lista">${falta}</ul>` : ''}
        <b class="md-det-h">No cérebro do cliente</b>${cerebro ? `<ul class="md-det-lista">${cerebro}</ul>` : '<p class="md-det-txt md-apagado">Nenhuma decisão ou aprendizado de mídia registrado ainda.</p>'}</div></div>`;
  }

  function listaHtml() {
    if (estado.carregando) return typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando', titulo: 'Buscando os clientes', forma: 'lista', linhas: 6 }) : '<p class="md-vazio">Buscando os clientes.</p>';
    if (estado.erro) return typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível abrir a Mídia', texto: estado.erro, acao: '<button type="button" class="d3m-btn" data-md-recarregar>Tentar de novo</button>' })
      : `<p class="md-vazio">${esc(estado.erro)} <button type="button" class="md-link" data-md-recarregar>Tentar de novo</button></p>`;
    const l = linhasVisiveis();
    if (!l.length) return `<p class="md-vazio">${estado.busca ? 'Nenhum cliente com esse nome.' : estado.filtro === 'acao' ? 'Nenhum cliente pedindo atenção agora.' : estado.filtro === 'sem' ? 'Todos os clientes respondidos têm conta do Meta vinculada.' : 'Nenhum cliente ativo.'}</p>`;
    return l.map(linha).join('');
  }
  function pintarLista() {
    const alvo = janela?.querySelector('#md-lista');
    if (!alvo) return pintar();
    alvo.innerHTML = listaHtml();
    const n = contagem();
    janela.querySelectorAll('[data-md-filtro]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.mdFiltro === estado.filtro)); const x = b.querySelector('b'); if (x) x.textContent = n[b.dataset.mdFiltro]; });
    const sub = janela.querySelector('.d3m-c-sub'); if (sub) sub.textContent = subtitulo(n);
    pintarLado();
  }

  // A consulta: o Ícaro com o que mais pede atenção, e quanto de cada canal já está conectado.
  function ladoHtml() {
    const t = estado.clientes, prontos = t.filter((c) => metaDe(c.id)?.estado === 'pronto');
    const comMeta = prontos.filter((c) => !['sem_conta'].includes(metaDe(c.id).dados.estado)).length;
    const comSite = t.filter((c) => c.tem_site).length;
    const prim = linhasVisiveis().find((c) => ['r', 'a'].includes(tomDe(c)));
    const buscando = t.length - prontos.length;
    const frase = prim ? `${esc(prim.nome)} · ${TOM[tomDe(prim)].toLowerCase()}` : buscando ? 'Lendo o Meta de cada cliente' : 'Nenhum cliente pedindo atenção';
    const sub = prim ? esc(metaDe(prim.id).dados.sinal.motivo) : buscando ? `Faltam ${buscando}.` : `No período de ${estado.dias} dias, tudo dentro do esperado.`;
    const laranja = `<section class="d3m-laranja md-laranja" aria-label="O que pede atenção"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">Í</span>Ícaro · Mídia Paga</span>
      <div class="d3m-lar-txt"><b class="d3-acao-frase">${frase}</b><small class="d3m-c-s">${sub}</small></div>
      ${prim ? `<div class="d3m-lar-bts"><button type="button" class="d3m-btn l" data-md-linha="${esc(prim.id)}">Ver o cliente</button></div>` : ''}</section>`;
    const barra = (rot, n, total, tom = '') => `<div class="md-canal"><span>${rot}</span><span class="d3m-vbarra ${tom}"><i style="--v:${total ? Math.round((n / total) * 100) : 0}%"></i></span><b>${n} de ${total}</b></div>`;
    const canais = `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Canais conectados</b><span>${plural(t.length, 'cliente', 'clientes')}</span></div><div class="md-canais">
      ${barra('Meta Ads', comMeta, prontos.length || t.length)}${barra('Google Ads', 0, t.length, 'n')}${barra('Site com análise', 0, comSite, 'n')}</div>
      <p class="md-nota">${estado.hubAtivo ? '' : 'A ponte com o VybeHub está desligada neste ambiente. '}Google Ads e análise do site ainda não estão ligados: a coluna guarda o lugar até a conexão.</p></div>`;
    const regra = '<div class="d3m-cons"><div class="d3m-cons-cab"><b>Como o Ícaro trabalha</b></div><p class="md-nota">Lê todos os canais, aponta o que pede atenção e propõe. Criar, pausar ou mudar verba só com o SIM de um dono, e tudo nasce pausado.</p></div>';
    return laranja + canais + regra;
  }
  function pintarLado() { const l = janela?.querySelector('#md-lado'); if (l) l.innerHTML = ladoHtml(); }

  function subtitulo(n) {
    return estado.carregando ? 'buscando os clientes' : estado.erro ? 'não foi possível buscar' : `${estado.dias} dias até ontem · ${plural(n.todos, 'cliente', 'clientes')}${n.acao ? ` · ${n.acao} ${n.acao === 1 ? 'pede' : 'pedem'} atenção` : ''}`;
  }
  function pintar() {
    if (!janela) return;
    const n = contagem();
    const sub = subtitulo(n);
    const titulo = typeof window.d3mcTrocaHtml === 'function' ? window.d3mcTrocaHtml('Mídia', 'midia', 'midia') : '<b class="d3m-c-h" role="heading" aria-level="2">Mídia</b>';
    const seg = `<span class="d3m-c-seg" role="radiogroup" aria-label="Período">${[7, 30].map((d) => `<button type="button" role="radio" data-md-dias="${d}" aria-checked="${estado.dias === d}">${d} dias</button>`).join('')}</span>`;
    const ficha = (id, t) => `<button type="button" role="radio" data-md-filtro="${id}" aria-checked="${estado.filtro === id}">${t} <b>${n[id]}</b></button>`;
    const foco = document.activeElement?.id === 'md-busca';
    janela.innerHTML = `<div class="d3m-c-topo"><div class="d3m-c-tit">${titulo}<span class="d3m-c-sub">${esc(sub)}</span></div>${seg}
        <label class="d3m-c-busca" title="Buscar cliente">${IC.lupa}<input id="md-busca" type="search" aria-label="Buscar cliente" autocomplete="off" placeholder="Buscar cliente" data-md-busca value="${esc(estado.busca)}"></label>
        <button type="button" class="d3m-c-ico" data-md-fechar aria-label="Fechar" title="Fechar">${IC.x}</button></div>
      <div class="d3m-c-corpo md-corpo"><section class="d3m-c-folha md-folha" aria-label="Mídia por cliente">
        <div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">Clientes <span>· canal por canal</span></b>
          <span class="d3m-c-abas" role="radiogroup" aria-label="Mostrar">${ficha('todos', 'Todos')}${ficha('acao', 'Pedem atenção')}${ficha('sem', 'Sem conta Meta')}</span></div>
        <div class="md-cab" aria-hidden="true"><span></span><span>Cliente</span><span>Meta · investido</span><span>Meta · resultado</span><span>Google Ads</span><span>Site</span><span></span></div>
        <div id="md-lista" class="md-lista">${listaHtml()}</div></section>
        <aside id="md-lado" class="d3m-lado" aria-label="Consulta">${estado.carregando || estado.erro ? '' : ladoHtml()}</aside></div>`;
    if (foco) { const b = janela.querySelector('#md-busca'); b?.focus(); try { b?.setSelectionRange(b.value.length, b.value.length); } catch { /* sem seleção */ } }
  }

  async function lerJson(url) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'o painel não respondeu');
    return d;
  }
  async function carregar() {
    const minha = ++geracao;
    estado.carregando = true; estado.erro = ''; pintar();
    try {
      const d = await lerJson('/api/painel?area=midia&acao=carteira');
      if (minha !== geracao) return;
      estado.clientes = Array.isArray(d.clientes) ? d.clientes : [];
      estado.canais = Array.isArray(d.canais) ? d.canais : [];
      estado.hubAtivo = d.hub_ativo !== false;
    } catch (e) { if (minha === geracao) estado.erro = e.message; }
    if (minha !== geracao) return;
    estado.carregando = false; pintar();
    if (!estado.erro) buscarMetas();
  }
  // De 4 em 4: cada cliente leva alguns segundos no Hub. O que chega repinta só a lista e a consulta.
  async function buscarMetas() {
    const dias = estado.dias, minha = geracao;
    const mapa = (metas[dias] ||= {});
    const fila = estado.clientes.filter((c) => !mapa[c.id]);
    fila.forEach((c) => { mapa[c.id] = { estado: 'buscando' }; });
    pintarLista();
    const trabalhar = async () => {
      for (let c = fila.shift(); c; c = fila.shift()) {
        try {
          const d = await lerJson(`/api/painel?area=midia&acao=cliente&cliente_id=${encodeURIComponent(c.id)}&dias=${dias}`);
          mapa[c.id] = { estado: 'pronto', dados: d.meta || { estado: 'sem_dados' }, registros: Array.isArray(d.registros) ? d.registros : [] };
        } catch { mapa[c.id] = { estado: 'falhou' }; }
        if (minha === geracao && janela && !janela.hidden && estado.dias === dias) pintarLista();
      }
    };
    await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);
  }

  function abrir() {
    if (!janela) criarJanela();
    janela.hidden = false;
    document.body.classList.add('mundo-midia');
    if (!estado.clientes.length || estado.erro) carregar(); else { pintar(); buscarMetas(); }
  }
  function fechar() { if (janela) janela.hidden = true; document.body.classList.remove('mundo-midia'); }

  // aberto: o dock (remarcarAoFechar em vybe-mundo.js) pergunta antes de acender o Hoje no lugar da Mídia.
  window.VybeMidia = { abrir, fechar, aberto: () => Boolean(janela && !janela.hidden) };
})();
