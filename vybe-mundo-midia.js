// Mídia (Vinícius, 20/11/2026: "um controle geral do que é relacionado à mídia desse cliente... o que não tiver
// conectado ainda, a gente deixa o espacinho para conectar"). A tela interna da gestão, só dos quatro donos.
//
// Confere e completa (Paulo, 23/11/2026, S-N): números da carteira no topo, ficha do cliente em abas (Resumo, Histórico,
// Campanhas, Resumo da semana, Relatórios) e os canais do cliente (site e ID do Google Ads gravados daqui).
//
// Melhoria geral e rotina do gestor (Paulo, 24/11/2026, S-Q: "preciso de algo fácil de usar mas sem perder o nível de
// complexidade e análise que uma aba de mídia requer... sem contar a rotina do gestor... o que fazer no dia a dia com os
// checks e tal"). A tela abre em duas visões, no mesmo vidro:
//   · Hoje: a rotina do gestor de tráfego. O que os números de cada cliente acenderam (Pede ação, De olho), a rotina da
//     cadência (todo dia, esta semana, início do mês) e quem ainda não tem conta (Para conectar). Cada item diz o que é,
//     por quê (com o número) e o que fazer, e tem o check "feito" com quem e quando (vybe_midia_checks). No laranja, o
//     que pede você agora; ao lado, os últimos 7 dias da rotina.
//   · Carteira: um cliente por linha com o que o gestor compara (investido, resultado, custo por resultado com a variação,
//     frequência e o alerta principal), filtros (pedem atenção, sem conta) e ordem pelo cabeçalho (atenção, investimento,
//     custo por resultado, nome).
// A ficha (um clique) guarda a análise: os números com a variação, CTR, CPM, frequência e orçamento, os alertas do
// cliente com o check, o melhor anúncio com a miniatura, o cérebro, 8 semanas de investido, resultado e custo, as
// campanhas com status e orçamento, o resumo da semana e os relatórios.
//
// Os dados vêm de area=midia (server/midia.js): a carteira chega de uma vez e o Meta de cada cliente chega depois, de 4
// em 4 (cada um pergunta ao VybeHub, que pergunta ao Meta). Os alertas da rotina são sempre dos 7 dias até ontem, mesmo
// com a tela em 30 dias. Tudo só leitura no Meta, menos os campos de conectar e os checks.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = {
    lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    volta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    fora: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/></svg>',
    tomada: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ordem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3"/></svg>',
    foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 4 4 2.5-2.5L20 18"/><circle cx="15.5" cy="9.5" r="1.5"/></svg>',
  };
  const TIPO = { messages: ['conversa', 'conversas'], profile_visits: ['visita ao perfil', 'visitas ao perfil'], reach: ['pessoa alcançada', 'pessoas alcançadas'],
    impressions: ['impressão', 'impressões'], link_clicks: ['clique no link', 'cliques no link'], leads: ['cadastro', 'cadastros'], purchases: ['compra', 'compras'],
    video_views: ['visualização de vídeo', 'visualizações de vídeo'], follows: ['seguidor', 'seguidores'], engagement: ['interação', 'interações'], other: ['resultado', 'resultados'] };
  const TOM = { r: 'Pede ação', a: 'De olho', g: 'Em dia', n: 'Sem dados' };
  const PESO = { r: 0, a: 1, g: 2, n: 3 };
  const ABAS = [['resumo', 'Resumo'], ['historico', 'Histórico'], ['campanhas', 'Campanhas'], ['semana', 'Resumo da semana'], ['relatorios', 'Relatórios']];
  const CADENCIA = { dia: 'Todo dia', semana: 'Esta semana', mes: 'Início do mês' };
  const LINK = { gerenciador: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns', faturamento: 'https://business.facebook.com/billing_hub/payment_settings' };
  const reais = (v) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const reaisCurto = (v) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
  const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
  const decimal = (v, n = 1) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n }));
  const tipoTxt = (t, n) => { const p = TIPO[t] || TIPO.other; return Number(n) === 1 ? p[0] : p[1]; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const variacao = (agora, antes) => (agora != null && antes > 0 ? Math.round(((agora - antes) / antes) * 100) : null);
  const pct = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${v}%`);
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); } };
  const hora = (iso) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }); } catch { return ''; } };
  const diaSemana = (iso) => { try { return new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''); } catch { return ''; } };
  const hojeLongo = (iso) => { try { const s = new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); return s; } catch { return ''; } };

  let estado = { clientes: [], canais: [], dias: 7, hubAtivo: true, hubUrl: 'https://vybehub.vercel.app', visao: 'hoje', filtro: 'todos', ordem: 'atencao', busca: '',
    carregando: false, erro: '', ficha: '', aba: 'resumo', salvando: '', aviso: null, editando: '', conectarAberto: false, avisoRotina: '' };
  // O Meta de cada cliente por período: { [dias]: { [id]: { estado: 'buscando'|'pronto'|'falhou', dados, registros } } }.
  let metas = {};
  // O que a ficha já buscou: { 'historico:ID', 'campanhas:ID:7', 'anuncios:ID:7', 'semana:ID', 'relatorio:ID:AAAA-MM' }.
  let fichas = {};
  // A rotina de hoje (area=midia&acao=rotina): itens da cadência, checks que valem agora e os últimos 7 dias.
  let rotina = { estado: '', dados: null };
  const marcando = new Set();
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
      if (!b) { const l = ev.target.closest('[data-md-linha]'); if (l && !ev.target.closest('a,input,form')) abrirFicha(l.dataset.mdLinha); return; }
      if (b.dataset.mdFechar !== undefined) return fechar();
      if (b.dataset.mdCheck) return alternarCheck(b.dataset.mdCheck);
      if (b.dataset.mdVisao) { estado.visao = b.dataset.mdVisao; estado.ficha = ''; return pintar(); }
      if (b.dataset.mdIr) return irPara(b.dataset.mdIr, b.dataset.mdCli || '');
      if (b.dataset.mdLinha) return abrirFicha(b.dataset.mdLinha, b.dataset.mdAbaIr || 'resumo');
      if (b.dataset.mdVoltar !== undefined) return voltarALista();
      if (b.dataset.mdAba) { estado.aba = b.dataset.mdAba; pintar(); return buscarDaAba(); }
      if (b.dataset.mdFiltro) { estado.filtro = b.dataset.mdFiltro; return pintarCorpo(); }
      if (b.dataset.mdOrdem) { estado.ordem = b.dataset.mdOrdem; return pintarCorpo(); }
      if (b.dataset.mdConectar !== undefined) { estado.conectarAberto = !estado.conectarAberto; return pintarCorpo(); }
      if (b.dataset.mdDias) { estado.dias = Number(b.dataset.mdDias) || 7; pintar(); buscarMetas(estado.dias); return buscarDaAba(); }
      if (b.dataset.mdRecarregar !== undefined) { metas = {}; fichas = {}; rotina = { estado: '', dados: null }; return carregar(); }
      if (b.dataset.mdTentar) { delete (metas[estado.dias] || {})[b.dataset.mdTentar]; delete (metas[7] || {})[b.dataset.mdTentar]; pintar(); buscarMetas(7); return buscarMetas(estado.dias); }
      if (b.dataset.mdTentarTodos !== undefined) { metas = {}; pintar(); buscarMetas(7); return buscarMetas(estado.dias); }
      if (b.dataset.mdTentarRotina !== undefined) { rotina = { estado: '', dados: null }; return buscarRotina(); }
      if (b.dataset.mdTentarAba !== undefined) { delete fichas[chaveDaAba()]; pintar(); return buscarDaAba(); }
      if (b.dataset.mdEditar) { estado.editando = b.dataset.mdEditar; estado.aviso = null; pintarLado(); janela.querySelector(`[data-md-campo="${b.dataset.mdEditar}"]`)?.focus(); return; }
      if (b.dataset.mdCancelar !== undefined) { estado.editando = ''; estado.aviso = null; return pintarLado(); }
      if (b.dataset.mdApagar) return salvarCanal(b.dataset.mdApagar, '');
      if (b.dataset.mdCopiar !== undefined) return copiarSemana(b);
      if (b.dataset.mdRelatorio) return abrirRelatorio(b.dataset.mdRelatorio);
      if (b.dataset.mdEntregas) { try { window.VybeRelatorio?.abrir?.(clienteDe(estado.ficha)?.nome, b.dataset.mdEntregas); } catch { /* sem o módulo */ } }
    });
    janela.addEventListener('submit', (ev) => {
      const f = ev.target.closest('[data-md-form]');
      if (!f) return;
      ev.preventDefault();
      salvarCanal(f.dataset.mdForm, f.querySelector('input')?.value || '');
    });
    janela.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-md-busca]')) { estado.busca = ev.target.value; pintarCorpo(); } });
    // A miniatura do anúncio que não carregou (link vencido da Meta) vira o quadro com o ícone, nunca imagem quebrada.
    janela.addEventListener('error', (ev) => { const i = ev.target; if (i?.tagName === 'IMG' && i.closest('.mdq-ad-img')) { i.closest('.mdq-ad-img').classList.add('sem'); i.remove(); } }, true);
    // Esc: na ficha volta à lista; na lista fecha. O passeio do tutorial cuida do próprio Esc antes (captura).
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || !janela || janela.hidden) return;
      if (document.querySelector('.vv-tour-raiz .vv-tour, .vb-sem-acesso-janela')) return;
      if (ev.target?.closest?.('[data-md-form]') && estado.editando) { estado.editando = ''; return pintarLado(); }
      if (estado.ficha) return voltarALista();
      fechar();
    });
  }

  const clienteDe = (id) => estado.clientes.find((c) => c.id === id) || null;
  const metaDe = (id, dias = estado.dias) => metas[dias]?.[id] || null;
  const dadosDe = (id, dias = estado.dias) => { const m = metaDe(id, dias); return m?.estado === 'pronto' ? m.dados : null; };
  // O tom da linha: o sinal do Ícaro quando o Meta respondeu; pagamento pendente é vermelho; sem conta ou sem dados, cinza.
  function tomDe(c) { const d = dadosDe(c.id); return d?.estado === 'ok' ? d.sinal?.tom || 'n' : d?.estado === 'pagamento' ? 'r' : 'n'; }
  const semConta = (c) => dadosDe(c.id)?.estado === 'sem_conta';
  // Quantos ainda estão chegando (o Meta dos 7 dias, base da rotina).
  const lendo = (dias = 7) => estado.clientes.filter((c) => { const m = metaDe(c.id, dias); return !m || m.estado === 'buscando'; }).length;
  function custoDe(c) { const d = dadosDe(c.id); return d?.estado === 'ok' && d.custo_resultado != null ? d.custo_resultado : null; }
  function linhasVisiveis() {
    const q = norm(estado.busca);
    let lista = estado.clientes.filter((c) => !q || norm(c.nome).includes(q));
    if (estado.filtro === 'acao') lista = lista.filter((c) => ['r', 'a'].includes(tomDe(c)));
    if (estado.filtro === 'sem') lista = lista.filter(semConta);
    const nome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    const inv = (c) => { const d = dadosDe(c.id); return d?.estado === 'ok' ? d.investido || 0 : -1; };
    // Custo por resultado só compara o mesmo tipo de resultado: agrupa pelo tipo e, dentro dele, o mais caro primeiro.
    const tipo = (c) => dadosDe(c.id)?.tipo_resultado || '~';
    const ordens = {
      atencao: (a, b) => PESO[tomDe(a)] - PESO[tomDe(b)] || inv(b) - inv(a) || nome(a, b),
      investido: (a, b) => inv(b) - inv(a) || nome(a, b),
      custo: (a, b) => (custoDe(a) == null) - (custoDe(b) == null) || tipo(a).localeCompare(tipo(b)) || (custoDe(b) ?? 0) - (custoDe(a) ?? 0) || nome(a, b),
      nome,
    };
    return [...lista].sort(ordens[estado.ordem] || ordens.atencao);
  }
  function contagem() {
    const t = estado.clientes;
    return { todos: t.length, acao: t.filter((c) => ['r', 'a'].includes(tomDe(c))).length, sem: t.filter(semConta).length };
  }
  // O Hub não respondeu para ninguém (ou a ponte está desligada): um aviso só, no lugar de 18 linhas de "não respondeu".
  function hubFora() {
    if (!estado.hubAtivo) return 'desligado';
    const t = estado.clientes; if (!t.length) return '';
    const m = t.map((c) => metaDe(c.id));
    if (m.some((x) => !x || x.estado === 'buscando')) return '';
    return m.every((x) => x.estado === 'falhou' || ['erro', 'desligado'].includes(x.dados?.estado)) ? 'fora' : '';
  }

  // ── A rotina: os itens de hoje com os checks ─────────────────────────────────────────────────────────────────────
  const chaveItem = (it) => `${it.cliente_id || '0'}:${it.chave}`;
  function checkDe(it) { return (rotina.dados?.checks || []).find((k) => k.cliente_id === String(it.cliente_id || '0') && k.chave === it.chave) || null; }
  function itensDaRotina() {
    const out = [];
    for (const c of estado.clientes) {
      const d = dadosDe(c.id, 7);
      for (const a of d?.alertas || []) out.push({ ...a, cliente_id: c.id, cliente: c.nome });
    }
    for (const f of rotina.dados?.fixos || []) out.push({ ...f, cliente_id: '0', cliente: '' });
    return out.map((it) => ({ ...it, check: checkDe(it) }));
  }
  function progresso() { const l = itensDaRotina(); return { feitos: l.filter((x) => x.check).length, total: l.length }; }

  function botaoAcao(it, k = 'c') {
    const cli = it.cliente_id && it.cliente_id !== '0' ? it.cliente_id : '';
    const ext = (href, t) => `<a class="d3m-c-btn ${k}" href="${esc(href)}" target="_blank" rel="noopener">${t} ${IC.fora}</a>`;
    const ir = (alvo, t) => `<button type="button" class="d3m-c-btn ${k}" data-md-ir="${alvo}" data-md-cli="${esc(cli)}">${t}</button>`;
    switch (it.acao) {
      case 'faturamento': return ext(LINK.faturamento, 'Pagamentos no Meta');
      case 'gerenciador': return ext(LINK.gerenciador, 'Gerenciador');
      case 'vincular': return ext(estado.hubUrl + '/admin', 'Vincular no VybeHub');
      case 'campanhas': return cli ? ir('campanhas', 'Ver campanhas') : ir('carteira', 'Abrir a carteira');
      case 'historico': return cli ? ir('historico', 'Ver histórico') : ir('carteira', 'Abrir a carteira');
      case 'semana': return cli ? ir('semana', 'Resumo da semana') : ir('carteira', 'Abrir a carteira');
      case 'relatorios': return cli ? ir('relatorios', 'Relatórios') : ir('carteira', 'Abrir a carteira');
      default: return ir('carteira', 'Abrir a carteira');
    }
  }
  function itemHtml(it, { comCliente = true } = {}) {
    const k = chaveItem(it), feito = it.check, ocupado = marcando.has(k);
    const quem = feito ? `<small class="mdq-quem">Feito${feito.feito_por_nome ? ` por ${esc(feito.feito_por_nome)}` : ''} ${it.cadencia === 'dia' ? `às ${hora(feito.feito_em)}` : `em ${dataBr(feito.feito_em.slice(0, 10))}`}</small>` : '';
    const tom = it.tom === 'rotina' ? '' : `<i class="mdq-ponto ${esc(it.tom)}" aria-hidden="true"></i>`;
    return `<div class="mdq-item${feito ? ' feito' : ''}" data-md-item="${esc(k)}">
      <button type="button" class="mdq-check" role="checkbox" aria-checked="${feito ? 'true' : 'false'}" data-md-check="${esc(k)}" ${ocupado ? 'disabled' : ''} aria-label="${feito ? 'Desfazer' : 'Marcar como feito'}: ${esc(it.titulo)}${it.cliente ? ' · ' + esc(it.cliente) : ''}">${IC.check}</button>
      <div class="mdq-txt"><b>${tom}${esc(it.titulo)}</b><span>${esc(it.porque)}</span>${quem}</div>
      <div class="mdq-fim">${comCliente && it.cliente ? `<button type="button" class="mdq-cli" data-md-linha="${esc(it.cliente_id)}" title="Abrir a ficha">${esc(it.cliente)}</button>` : ''}${botaoAcao(it)}</div></div>`;
  }
  function rotinaHtml() {
    if (estado.carregando) return carregandoHtml('Buscando a rotina de hoje');
    if (estado.erro) return erroHtml();
    if (rotina.estado === 'falhou') return `<div class="mdn-vazio"><b>Não foi possível abrir a rotina.</b><span>${esc(rotina.motivo || '')}</span><button type="button" class="d3m-c-btn c" data-md-tentar-rotina>Tentar de novo</button></div>`;
    if (!rotina.dados) return carregandoHtml('Buscando a rotina de hoje');
    const q = norm(estado.busca);
    const todos = itensDaRotina().filter((it) => !q || norm(it.cliente).includes(q) || norm(it.titulo).includes(q));
    // O que falta fazer vem antes do que já foi feito, dentro de cada grupo (a ordem de chegada fica entre os iguais).
    todos.sort((x, y) => Boolean(x.check) - Boolean(y.check));
    const grupo = (id, t, itens, extra = '') => (itens.length ? `<section class="mdq-grupo" aria-label="${t}"><h4 class="mdq-gh"><span>${t}</span><b>${itens.filter((x) => x.check).length} de ${itens.length}</b>${extra}</h4>${itens.map((x) => itemHtml(x)).join('')}</section>` : '');
    const r = todos.filter((x) => x.tom === 'r'), a = todos.filter((x) => x.tom === 'a'), n = todos.filter((x) => x.tom === 'n'), fixos = todos.filter((x) => x.tom === 'rotina');
    const porCad = ['dia', 'semana', 'mes'].map((cad) => { const l = fixos.filter((x) => x.cadencia === cad); return l.length ? `<p class="mdq-sub">${CADENCIA[cad]}</p>${l.map((x) => itemHtml(x)).join('')}` : ''; }).join('');
    const faltam = lendo(7), fora = hubFora();
    const aviso = fora ? avisoHub() : faltam ? `<p class="mdq-lendo" role="status">Lendo o Meta de ${plural(faltam, 'cliente', 'clientes')}: os alertas deles entram aqui quando chegarem.</p>` : '';
    const erroCheck = estado.avisoRotina ? `<p class="mdn-msg erro mdq-erro" role="alert">${esc(estado.avisoRotina)}</p>` : '';
    const nadaDeAlerta = !r.length && !a.length && !faltam && !fora ? '<p class="mdq-calmo">Nenhum cliente pedindo ação nem olho nos 7 dias até ontem.</p>' : '';
    // Para conectar: fechado por padrão (é a mesma pendência toda semana), abre com um clique.
    const conectar = n.length ? `<section class="mdq-grupo mdq-conectar" aria-label="Para conectar"><h4 class="mdq-gh"><span>Para conectar</span><b>${n.filter((x) => x.check).length} de ${n.length}</b>
        <button type="button" class="md-link" data-md-conectar aria-expanded="${estado.conectarAberto}">${estado.conectarAberto ? 'Fechar' : `Ver ${plural(n.length, 'cliente', 'clientes')}`}</button></h4>
        ${estado.conectarAberto ? n.map((x) => itemHtml(x)).join('') : `<p class="mdq-resumo">${esc(n.slice(0, 4).map((x) => x.cliente).join(', '))}${n.length > 4 ? ` e mais ${n.length - 4}` : ''}: sem a conta do Meta ligada no VybeHub, o Ícaro não acompanha.</p>`}</section>` : '';
    if (!todos.length) return aviso + `<p class="md-vazio">${q ? 'Nada na rotina com esse nome.' : 'Nada na rotina agora.'}</p>`;
    return aviso + erroCheck + grupo('r', 'Pede ação', r) + grupo('a', 'De olho', a) + nadaDeAlerta
      + (fixos.length ? `<section class="mdq-grupo" aria-label="Rotina do gestor"><h4 class="mdq-gh"><span>Rotina do gestor</span><b>${fixos.filter((x) => x.check).length} de ${fixos.length}</b></h4>${porCad}</section>` : '')
      + conectar;
  }
  function folhaRotinaHtml() {
    const p = progresso(), pctFeito = p.total ? Math.round((p.feitos / p.total) * 100) : 0;
    const dia = rotina.dados?.hoje ? hojeLongo(rotina.dados.hoje) : '';
    return `<div class="d3m-c-folha-cab mdq-cab"><b class="d3m-c-h3" role="heading" aria-level="3">Rotina de hoje${dia ? ` <span>· ${esc(dia)}</span>` : ''}</b>
        <span class="mdq-prog" role="progressbar" aria-label="Feitos hoje" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.feitos}"><span class="mdq-prog-barra"><i style="--v:${pctFeito}%"></i></span><b>${p.feitos} de ${p.total}</b><small>feitos</small></span></div>
      <div id="md-rotina" class="mdq-lista">${rotinaHtml()}</div>`;
  }

  // ── A carteira: a lista ─────────────────────────────────────────────────────────────────────────────────────────────
  const cel = (a, b = '', k = '') => `<span class="mdn-cel${k ? ' ' + k : ''}"><b>${a}</b>${b ? `<small>${b}</small>` : ''}</span>`;
  const brilho = '<span class="mdn-cel md-brilho" aria-label="Buscando o Meta"><i></i></span>';
  function celulasMeta(c) {
    const m = metaDe(c.id);
    if (!m || m.estado === 'buscando') return brilho.repeat(5);
    if (m.estado === 'falhou') return `${cel('Não respondeu', '', 'apagado')}<span class="mdn-cel"><button type="button" class="md-link" data-md-tentar="${esc(c.id)}">Tentar de novo</button></span>${cel('—', '', 'apagado mdq-c-custo')}${cel('—', '', 'apagado mdq-c-freq')}${cel('', '', 'mdq-c-alerta')}`;
    const d = m.dados;
    const alerta = (t, k = '') => `<span class="mdn-cel mdq-c-alerta${k ? ' ' + k : ''}"><b>${t}</b></span>`;
    if (d.estado === 'sem_conta') return `${cel('Sem conta', 'no VybeHub', 'apagado')}${cel('—', '', 'apagado')}${cel('—', '', 'apagado mdq-c-custo')}${cel('—', '', 'apagado mdq-c-freq')}${alerta('Ligar a conta do Meta', 'apagado')}`;
    if (d.estado === 'pagamento') return `${cel('Pagamento pendente', 'no Meta', 'mdq-r')}${cel('—', '', 'apagado')}${cel('—', '', 'apagado mdq-c-custo')}${cel('—', '', 'apagado mdq-c-freq')}${alerta('Conta parada até acertar', 'mdq-r')}`;
    if (d.estado === 'desligado') return `${cel('Ponte desligada', '', 'apagado')}${cel('—', '', 'apagado')}${cel('—', '', 'apagado mdq-c-custo')}${cel('—', '', 'apagado mdq-c-freq')}${alerta('', 'apagado')}`;
    if (d.estado !== 'ok') return `${cel(d.estado === 'erro' ? 'Hub não respondeu' : 'Sem dados', d.estado === 'erro' ? '' : 'no período', 'apagado')}${cel('—', '', 'apagado')}${cel('—', '', 'apagado mdq-c-custo')}${cel('—', '', 'apagado mdq-c-freq')}${alerta('', 'apagado')}`;
    const dInv = variacao(d.investido, d.investido_anterior), dCusto = variacao(d.custo_resultado, d.custo_anterior);
    const res = d.resultados ? cel(`${inteiro(d.resultados)} ${tipoTxt(d.tipo_resultado, d.resultados)}`, d.resultados_anterior != null ? `${pct(variacao(d.resultados, d.resultados_anterior)) || 'igual'} vs anterior` : '') : cel('Sem resultado', 'no período', 'mdq-r');
    const tomCusto = dCusto == null ? '' : dCusto >= 20 ? ' pior' : dCusto <= -10 ? ' melhor' : '';
    const custo = d.custo_resultado != null ? cel(reais(d.custo_resultado), dCusto != null ? `${pct(dCusto)} vs anterior` : 'sem anterior', 'num mdq-c-custo' + tomCusto) : cel('—', '', 'apagado mdq-c-custo');
    const freq = cel(d.frequencia != null ? decimal(d.frequencia) : '—', d.frequencia > 3 ? 'alta' : '', 'num mdq-c-freq' + (d.frequencia > 3 ? ' alta' : ''));
    // O alerta principal: o primeiro da rotina (7 dias) ou o sinal do Ícaro no período escolhido.
    const al = (dadosDe(c.id, 7)?.alertas || [])[0];
    const txtAlerta = al ? alerta(`${esc(al.titulo)}`, al.tom === 'r' ? 'mdq-r' : '') : alerta(esc(TOM[d.sinal?.tom || 'g']), 'apagado');
    return cel(reais(d.investido), dInv != null ? `${pct(dInv)} vs anterior` : 'sem anterior', 'num') + res + custo + freq + txtAlerta;
  }
  // Os três canais do cliente numa linha só, embaixo do nome: o ponto aceso é o canal ligado.
  function canaisMini(c) {
    const d = dadosDe(c.id), meta = d ? !['sem_conta', 'erro', 'desligado'].includes(d.estado) : null;
    const p = (on, t) => `<span class="mdq-canal${on ? ' on' : ''}"><i aria-hidden="true"></i>${t}</span>`;
    return `<span class="mdq-canais" aria-label="Canais: Meta ${meta ? 'ligado' : 'sem conta'}, Google Ads ${c.google_ads ? 'com ID' : 'não conectado'}, site ${c.site ? 'cadastrado' : 'sem site'}">${p(meta, 'Meta')}${p(Boolean(c.google_ads), 'Google')}${p(Boolean(c.site), 'Site')}</span>`;
  }
  function linha(c) {
    const tom = tomDe(c);
    return `<div class="mdn-lin mdq-lin" data-md-linha="${esc(c.id)}">
      <span class="md-sinal ${tom}" title="${TOM[tom]}"><i aria-hidden="true"></i><span class="md-sr">${TOM[tom]}</span></span>
      <span class="mdq-nome"><button type="button" class="mdn-nome" data-md-linha="${esc(c.id)}">${esc(c.nome)}</button>${canaisMini(c)}</span>
      ${celulasMeta(c)}
      <span class="md-chev" aria-hidden="true">${IC.seta}</span></div>`;
  }
  function avisoHub() {
    const f = hubFora();
    if (f === 'desligado') return '<div class="mdn-aviso" role="status"><b>A ponte com o VybeHub está desligada neste ambiente.</b><span>Os números do Meta não chegam aqui. Site e Google Ads continuam editáveis na ficha de cada cliente.</span></div>';
    if (f === 'fora') return '<div class="mdn-aviso" role="alert"><b>O VybeHub não respondeu para nenhum cliente agora.</b><span>Os números do Meta vêm de lá. Confira se o Hub está no ar e tente de novo.</span><button type="button" class="d3m-c-btn c k" data-md-tentar-todos>Tentar de novo</button></div>';
    return '';
  }
  const erroHtml = () => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível abrir a Mídia', texto: estado.erro, acao: '<button type="button" class="d3m-btn" data-md-recarregar>Tentar de novo</button>' })
    : `<p class="md-vazio">${esc(estado.erro)} <button type="button" class="md-link" data-md-recarregar>Tentar de novo</button></p>`);
  function listaHtml() {
    if (estado.carregando) return carregandoHtml('Buscando os clientes');
    if (estado.erro) return erroHtml();
    const l = linhasVisiveis();
    if (!l.length) {
      if (estado.filtro === 'sem' && !estado.busca) return avisoHub() + `<div class="mdn-vazio mdq-vazio-lista"><b>Todos os clientes respondidos têm conta do Meta ligada.</b>${lendo(estado.dias) ? `<span>Ainda lendo ${plural(lendo(estado.dias), 'cliente', 'clientes')}.</span>` : ''}</div>`;
      return avisoHub() + `<p class="md-vazio">${estado.busca ? 'Nenhum cliente com esse nome.' : estado.filtro === 'acao' ? 'Nenhum cliente pedindo atenção agora.' : 'Nenhum cliente ativo.'}</p>`;
    }
    const dica = estado.filtro === 'sem' ? `<p class="mdq-dica">A conta de anúncios de cada cliente mora no VybeHub: vincule lá e os números e alertas aparecem aqui sozinhos. <a class="md-link" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Abrir o admin do VybeHub</a></p>` : '';
    return avisoHub() + dica + l.map(linha).join('');
  }
  // O cabeçalho ordena: atenção (o sinal), cliente, investido e custo por resultado.
  function cabListaHtml() {
    const th = (id, t, k = '', rot = t) => `<button type="button" class="mdq-th${k ? ' ' + k : ''}" data-md-ordem="${id}" aria-pressed="${estado.ordem === id}" title="Ordenar por ${rot.toLowerCase()}" aria-label="Ordenar por ${rot.toLowerCase()}">${t}${estado.ordem === id ? IC.ordem : ''}</button>`;
    return `<div class="mdn-cab mdq-lin mdq-cab-lista">${th('atencao', '', 'sinal', 'Atenção')}${th('nome', 'Cliente')}${th('investido', 'Investido')}<span>Resultado</span>${th('custo', 'Custo por resultado', 'mdq-c-custo')}<span class="mdq-c-freq">Frequência</span><span class="mdq-c-alerta">Principal alerta</span><span></span></div>`;
  }
  function folhaListaHtml() {
    const n = contagem();
    const ficha = (id, t) => `<button type="button" role="radio" data-md-filtro="${id}" aria-checked="${estado.filtro === id}">${t} <b>${n[id]}</b></button>`;
    return `<div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">Clientes <span>· ${estado.dias} dias até ontem</span></b>
        <span class="d3m-c-abas" role="radiogroup" aria-label="Mostrar">${ficha('todos', 'Todos')}${ficha('acao', 'Pedem atenção')}${ficha('sem', 'Sem conta Meta')}</span></div>
      ${cabListaHtml()}
      <div id="md-lista" class="mdn-lista">${listaHtml()}</div>`;
  }

  // ── O resumo da carteira (os quatro números do topo) ──────────────────────────────────────────────────────────────
  function numerosHtml() {
    const t = estado.clientes, prontos = t.filter((c) => metaDe(c.id)?.estado === 'pronto' || metaDe(c.id)?.estado === 'falhou');
    const ok = t.map((c) => dadosDe(c.id)).filter((d) => d?.estado === 'ok');
    const inv = ok.reduce((s, d) => s + (d.investido || 0), 0), ant = ok.reduce((s, d) => s + (d.investido_anterior || 0), 0);
    const conv = ok.reduce((s, d) => s + (d.conversas || 0), 0), convAnt = ok.filter((d) => d.tipo_resultado === 'messages').reduce((s, d) => s + (d.resultados_anterior || 0), 0);
    const n = contagem(), r = t.filter((c) => tomDe(c) === 'r').length, faltam = t.length - prontos.length;
    const fora = hubFora(), p = progresso();
    const num = (rot, valor, apoio, k = '') => `<div class="mdn-num${k ? ' ' + k : ''}"><span class="mdn-num-rot">${rot}</span><b>${valor}</b><small>${apoio}</small></div>`;
    const espera = fora ? (fora === 'desligado' ? 'ponte desligada' : 'Hub fora do ar') : faltam ? `lendo ${prontos.length} de ${t.length}` : '';
    return `<div class="mdn-nums" role="group" aria-label="Carteira de mídia em ${estado.dias} dias">
      ${num(`Investido no Meta · ${estado.dias} dias`, fora ? '—' : reaisCurto(inv), espera || `${pct(variacao(inv, ant)) || 'sem anterior'} sobre o anterior · ${plural(ok.length, 'cliente', 'clientes')}`)}
      ${num('Conversas pelo Meta', fora ? '—' : inteiro(conv), espera || (convAnt ? `${pct(variacao(conv, convAnt))} sobre o anterior` : 'só o que é conversa'))}
      ${num('Pedem atenção', fora ? '—' : n.acao, espera || (n.acao ? `${r} pede${r === 1 ? '' : 'm'} ação · ${n.acao - r} de olho · ${n.sem} sem conta` : `nenhum agora · ${n.sem} sem conta`))}
      ${num('Rotina de hoje', rotina.dados ? `${p.feitos} de ${p.total}` : '—', rotina.dados ? (p.total && p.feitos === p.total ? 'tudo feito' : `${plural(p.total - p.feitos, 'item falta', 'itens faltam')}`) : 'buscando', 'mdq-num-rotina')}</div>`;
  }

  // ── A ficha do cliente ────────────────────────────────────────────────────────────────────────────────────────────
  const meses = () => { const h = new Date(); return [0, 1, 2].map((k) => { const d = new Date(h.getFullYear(), h.getMonth() - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }); };
  const nomeMes = (m) => { const [a, n] = m.split('-').map(Number); const s = new Date(a, n - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  function chaveDaAba(aba = estado.aba, id = estado.ficha) { return aba === 'historico' ? `historico:${id}` : aba === 'campanhas' ? `campanhas:${id}:${estado.dias}` : aba === 'semana' ? `semana:${id}` : aba === 'resumo' ? `anuncios:${id}:${estado.dias}` : ''; }
  function semContaHtml(oque) {
    return `<div class="mdq-semconta"><span class="mdq-semconta-ic" aria-hidden="true">${IC.tomada}</span>
      <div><b>Este cliente ainda não tem a conta do Meta ligada.</b><span>${oque} chega aqui quando a conta de anúncios estiver vinculada no VybeHub. Até lá, o Ícaro não acompanha este cliente e ele aparece na rotina em "Para conectar".</span>
      <ol class="mdq-passos"><li>No admin do VybeHub, abra este cliente.</li><li>Vincule a conta de anúncios do Meta (o Business da Vybe precisa ter acesso a ela).</li><li>Volte aqui: os números, as campanhas e os alertas aparecem sozinhos.</li></ol>
      <span class="mdq-semconta-bts"><a class="d3m-c-btn c k" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Vincular no VybeHub ${IC.fora}</a><span class="mdq-nota">O site e o ID do Google Ads se cadastram ao lado.</span></span></div></div>`;
  }
  function estadoDoHub(d, oque) {
    if (d.estado === 'sem_conta') return semContaHtml(oque);
    if (d.estado === 'pagamento') return `<div class="mdq-semconta r"><span class="mdq-semconta-ic" aria-hidden="true">${IC.tomada}</span><div><b>A conta de anúncios está com pagamento pendente no Meta.</b><span>Enquanto o pagamento não for acertado, nada entrega. ${oque} volta a chegar quando a conta for regularizada.</span>
      <span class="mdq-semconta-bts"><a class="d3m-c-btn c k" href="${LINK.faturamento}" target="_blank" rel="noopener">Pagamentos no Meta ${IC.fora}</a></span></div></div>`;
    if (d.estado === 'desligado') return `<div class="mdn-vazio"><b>A ponte com o VybeHub está desligada neste ambiente.</b><span>${oque} vem do VybeHub.</span></div>`;
    if (d.estado === 'sem_dados') return `<div class="mdn-vazio"><b>Sem dados no período.</b><span>${esc(d.motivo || 'O Hub respondeu sem números para este cliente.')}</span></div>`;
    return `<div class="mdn-vazio"><b>O VybeHub não respondeu.</b><span>${esc(d.motivo || '')}</span><button type="button" class="d3m-c-btn c" data-md-tentar-aba>Tentar de novo</button></div>`;
  }
  const carregandoHtml = (t) => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando', titulo: t, forma: 'lista', linhas: 4 }) : `<p class="md-vazio">${t}</p>`);
  const tile = (rot, valor, apoio, k = '') => `<div class="mdn-tile${k ? ' ' + k : ''}"><span>${rot}</span><b>${valor}</b>${apoio ? `<small>${apoio}</small>` : ''}</div>`;
  function melhorAnuncioHtml(c, d) {
    const f = fichas[`anuncios:${c.id}:${estado.dias}`];
    const anuncio = (a, grande) => `<div class="mdq-ad${grande ? ' grande' : ''}"><span class="mdq-ad-img${a.imagem ? '' : ' sem'}">${a.imagem ? `<img src="${esc(a.imagem)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}${IC.foto}</span>
      <span class="mdq-ad-txt"><b>${esc(a.nome)}</b>${a.resultados ? `<small>${inteiro(a.resultados)} ${tipoTxt(a.tipo_resultado, a.resultados)}${a.investido && a.resultados ? ` a ${reais(a.investido / a.resultados)} cada` : ''}</small>` : '<small>sem resultado no período</small>'}${grande && a.texto ? `<span>${esc(a.texto)}</span>` : ''}${grande && a.campanha ? `<small>Campanha ${esc(a.campanha)}</small>` : ''}</span></div>`;
    if (f?.estado === 'pronto' && f.dados.estado === 'ok' && f.dados.anuncios.length) {
      const [a, ...resto] = f.dados.anuncios;
      return `<section class="mdn-bloco"><b class="mdn-bloco-h">Anúncios que mais trouxeram resultado</b>${anuncio(a, true)}${resto.length ? `<div class="mdq-ads">${resto.slice(0, 3).map((x) => anuncio(x, false)).join('')}</div>` : ''}</section>`;
    }
    const a = d.melhor_anuncio;
    const lendoAds = !f || f.estado === 'buscando' ? '<p class="mdn-txt apagado">Buscando as miniaturas…</p>' : '';
    return `<section class="mdn-bloco"><b class="mdn-bloco-h">Melhor anúncio</b>${a ? anuncio({ nome: a.nome, resultados: a.resultados, tipo_resultado: a.tipo_resultado, investido: a.custo_resultado != null ? a.custo_resultado * a.resultados : 0, campanha: a.campanha, imagem: null }, true) : '<p class="mdn-txt apagado">Nenhum anúncio com resultado no período.</p>'}${lendoAds}</section>`;
  }
  function abaResumo(c) {
    const m = metaDe(c.id), d = m?.estado === 'pronto' ? m.dados : null;
    if (!m || m.estado === 'buscando') return carregandoHtml('Buscando o Meta deste cliente');
    if (m.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: 'O painel não respondeu.' }, 'O resumo');
    const cerebro = (m.registros || []).map((r) => `<li><b>${esc(r.titulo)}</b><small> · ${esc(new Date(r.criado_em).toLocaleDateString('pt-BR'))}</small>${r.resumo ? `<span>${esc(r.resumo)}</span>` : ''}</li>`).join('');
    const blocoCerebro = `<section class="mdn-bloco"><b class="mdn-bloco-h">No cérebro do cliente</b>${cerebro ? `<ul class="mdn-cerebro">${cerebro}</ul>` : '<p class="mdn-txt apagado">Nenhuma decisão ou aprendizado de mídia registrado ainda.</p>'}</section>`;
    if (d.estado !== 'ok') return estadoDoHub(d, 'O resumo do Meta') + (d.estado === 'sem_conta' ? '' : blocoCerebro);
    const dInv = variacao(d.investido, d.investido_anterior), dRes = variacao(d.resultados, d.resultados_anterior), dCusto = variacao(d.custo_resultado, d.custo_anterior);
    // Custo que sobe é ruim; resultado que sobe é bom. O tom vai no texto ("pior"/"melhor"), não só na cor.
    const leitura = (v, bomSubir) => (v == null ? 'sem anterior comparável' : `${pct(v)} sobre o anterior · ${v === 0 ? 'igual' : (v > 0) === bomSubir ? 'melhor' : 'pior'}`);
    const tomCusto = dCusto == null ? '' : dCusto >= 20 ? 'pior' : dCusto <= -10 ? 'melhor' : '';
    const d7 = dadosDe(c.id, 7), ontem = d7?.ontem, orc = d7?.orcamento_dia;
    const mini = (rot, valor, apoio = '', k = '') => `<div class="mdq-met${k ? ' ' + k : ''}"><span>${rot}</span><b>${valor}</b>${apoio ? `<small>${apoio}</small>` : ''}</div>`;
    const alertas = (d7?.alertas || []).map((a) => ({ ...a, cliente_id: c.id, cliente: c.nome })).map((it) => ({ ...it, check: checkDe(it) }));
    const tom = d.sinal?.tom || 'n';
    return `<div class="mdn-tiles">
        ${tile(`Investido · ${estado.dias} dias`, reais(d.investido), dInv == null ? 'sem anterior' : `${pct(dInv)} sobre o anterior`)}
        ${tile(`Resultado · ${tipoTxt(d.tipo_resultado, 2)}`, inteiro(d.resultados), leitura(dRes, true))}
        ${tile('Custo por resultado', d.custo_resultado != null ? reais(d.custo_resultado) : '—', leitura(dCusto, false), tomCusto)}
        ${tile('Alcance', d.alcance != null ? inteiro(d.alcance) : '—', d.frequencia != null ? `frequência ${decimal(d.frequencia)}${d.frequencia > 3 ? ' · alta' : ''}` : '')}</div>
      <div class="mdq-mets" role="group" aria-label="Indicadores do período">
        ${mini('CTR', d.ctr != null ? `${decimal(d.ctr, 2)}%` : '—')}${mini('CPM', d.cpm != null ? reais(d.cpm) : '—')}${mini('Frequência', decimal(d.frequencia), d.frequencia > 3 ? 'acima de 3' : '', d.frequencia > 3 ? 'alta' : '')}
        ${mini('Orçamento por dia', orc != null ? reais(orc) : '—', orc != null ? 'campanhas ativas' : 'no conjunto ou sem dado')}${mini('Ontem', ontem ? reais(ontem.investido) : '—', ontem ? `anteontem ${reais(ontem.investido_anterior)}` : '')}</div>
      <section class="mdn-bloco mdq-alertas"><b class="mdn-bloco-h">O que o Ícaro viu · 7 dias até ontem <span>· ${TOM[tom].toLowerCase()}</span></b>
        ${alertas.length ? alertas.map((x) => itemHtml(x, { comCliente: false })).join('') : !d7 ? '<p class="mdn-txt apagado">Lendo os 7 dias…</p>' : `<p class="mdn-txt apagado">Nada pedindo ação nem olho. ${esc(d.sinal?.motivo || '')}</p>`}</section>
      <div class="mdn-duas">${melhorAnuncioHtml(c, d)}${blocoCerebro}</div>`;
  }
  // Três gráficos pequenos, uma série cada (investido, resultado, custo por resultado), a semana mais nova escura.
  function mini8(s, campo, fmt, rot, apoio) {
    const vals = s.map((x) => x[campo]), max = Math.max(...vals.map((v) => v || 0)) || 1;
    const barras = s.map((x) => { const v = x[campo], h = v ? Math.max(4, Math.round((v / max) * 100)) : 0;
      const dica = `${dataBr(x.de)} a ${dataBr(x.ate)}: ${v != null ? fmt(v) : 'sem dado'}`;
      return `<span class="mdq-b" title="${esc(dica)}" aria-label="${esc(dica)}" role="img"><i style="--h:${h}%"></i></span>`; }).join('');
    const ult = vals[vals.length - 1], pen = vals[vals.length - 2];
    return `<section class="mdq-mini"><span class="mdq-mini-rot">${rot}</span><b>${ult != null ? fmt(ult) : '—'}</b><small>${pen ? `${pct(variacao(ult, pen)) || 'igual'} sobre a semana anterior` : apoio}</small>
      <div class="mdq-mini-g">${barras}</div><span class="mdq-mini-eixo"><em>${dataBr(s[0]?.de)}</em><em>${dataBr(s[s.length - 1]?.de)}</em></span></section>`;
  }
  function abaHistorico(c) {
    const f = fichas[chaveDaAba('historico', c.id)];
    if (!f || f.estado === 'buscando') return carregandoHtml('Buscando as últimas 8 semanas');
    if (f.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: f.motivo }, 'O histórico');
    const d = f.dados;
    if (d.estado !== 'ok') return estadoDoHub(d, 'O histórico');
    const s = d.semanas || [];
    if (!s.some((x) => x.investido)) return '<div class="mdn-vazio"><b>Sem investimento nas últimas 8 semanas.</b></div>';
    const tipo = s.map((x) => x.tipo_resultado).filter(Boolean).pop();
    const linhas = [...s].reverse().map((x) => `<tr><td>${dataBr(x.de)} a ${dataBr(x.ate)}</td><td class="n">${reais(x.investido)}</td><td class="n">${x.resultados != null ? `${inteiro(x.resultados)} <small>${tipoTxt(x.tipo_resultado, x.resultados)}</small>` : '—'}</td><td class="n">${x.custo_resultado != null ? reais(x.custo_resultado) : '—'}</td></tr>`).join('');
    return `<div class="mdq-minis">${mini8(s, 'investido', reaisCurto, 'Investido por semana', '8 semanas até ontem')}${mini8(s, 'resultados', inteiro, `Resultado · ${tipoTxt(tipo, 2)}`, '8 semanas até ontem')}${mini8(s, 'custo_resultado', reais, 'Custo por resultado', 'só com o mesmo tipo de resultado')}</div>
      <table class="mdn-tab"><thead><tr><th>Semana</th><th class="n">Investido</th><th class="n">Resultado</th><th class="n">Custo por resultado</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }
  const STATUS = { ACTIVE: ['Ativa', 'g'], PAUSED: ['Pausada', 'n'], ARCHIVED: ['Arquivada', 'n'], DELETED: ['Apagada', 'n'], CAMPAIGN_PAUSED: ['Pausada', 'n'], ADSET_PAUSED: ['Conjunto pausado', 'n'], IN_PROCESS: ['Em revisão', 'a'], WITH_ISSUES: ['Com problema', 'r'], DISAPPROVED: ['Reprovada', 'r'] };
  function abaCampanhas(c) {
    const f = fichas[chaveDaAba('campanhas', c.id)];
    if (!f || f.estado === 'buscando') return carregandoHtml('Buscando as campanhas');
    if (f.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: f.motivo }, 'As campanhas');
    const d = f.dados;
    if (d.estado !== 'ok') return estadoDoHub(d, 'As campanhas');
    if (!d.campanhas.length) return '<div class="mdn-vazio"><b>Nenhuma campanha com gasto no período.</b></div>';
    const ativas = d.campanhas.filter((k) => k.status === 'ACTIVE').length, orc = d.campanhas.filter((k) => k.status === 'ACTIVE' && k.orcamento_dia > 0).reduce((s, k) => s + k.orcamento_dia, 0);
    const linhas = d.campanhas.map((k) => { const [st, t] = STATUS[k.status] || [k.status ? k.status.toLowerCase() : '—', 'n'];
      const custo = k.resultados ? k.investido / k.resultados : null;
      const orcTxt = k.orcamento_dia ? `${reais(k.orcamento_dia)}<small> por dia</small>` : k.orcamento_total ? `${reais(k.orcamento_total)}<small> total</small>` : '<small>no conjunto</small>';
      return `<tr><td><span class="mdn-st ${t}"><i aria-hidden="true"></i>${esc(st)}</span></td><td class="nome">${esc(k.nome)}${k.inicio ? `<small class="mdq-desde">desde ${dataBr(k.inicio)}</small>` : ''}</td><td class="n mdq-c-orc">${orcTxt}</td><td class="n">${reais(k.investido)}</td><td class="n">${k.resultados ? `${inteiro(k.resultados)} <small>${tipoTxt(k.tipo_resultado, k.resultados)}</small>` : '—'}</td><td class="n">${custo != null ? reais(custo) : '—'}</td><td class="n${k.frequencia > 3 ? ' alta' : ''}">${k.frequencia != null ? decimal(k.frequencia) : '—'}</td></tr>`; }).join('');
    return `<p class="mdn-txt apagado">${plural(d.campanhas.length, 'campanha', 'campanhas')} com gasto em ${estado.dias} dias · ${plural(ativas, 'ativa', 'ativas')}${orc ? ` · ${reais(orc)} por dia nas ativas` : ''}${d.limitado ? ' · mostrando as 25 primeiras' : ''}. Mexer em campanha continua no Gerenciador, com o SIM de um dono.</p>
      <table class="mdn-tab mdq-tab-camp"><thead><tr><th class="st">Status</th><th>Campanha</th><th class="n mdq-c-orc">Orçamento</th><th class="n">Investido</th><th class="n">Resultado</th><th class="n">Custo</th><th class="n">Frequência</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }
  // O texto do WhatsApp com o negrito e o itálico dele.
  const zap = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');
  function abaSemana(c) {
    const f = fichas[chaveDaAba('semana', c.id)];
    if (!f || f.estado === 'buscando') return carregandoHtml('Buscando o resumo da semana');
    if (f.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: f.motivo }, 'O resumo da semana');
    const d = f.dados;
    if (d.estado !== 'ok') return estadoDoHub(d, 'O resumo da semana');
    return `<div class="mdn-semana-cab"><p class="mdn-txt apagado">O mesmo texto do botão "Resumo da semana" do VybeHub, que o Ícaro manda ao Ewerton na segunda às 7h para revisar e encaminhar no grupo do cliente.</p>
        <button type="button" class="d3m-c-btn c" data-md-copiar>Copiar o texto</button></div>
      <div class="mdn-zap" data-md-texto>${zap(d.texto)}</div>`;
  }
  function abaRelatorios(c) {
    const ms = meses(), semMeta = dadosDe(c.id)?.estado === 'sem_conta';
    const linhaMes = (mes) => { const f = fichas[`relatorio:${c.id}:${mes}`];
      const st = f?.estado === 'buscando' ? '<small class="apagado">Pedindo ao VybeHub…</small>' : f?.estado === 'pronto' && f.dados.estado !== 'ok' ? `<small class="apagado">${esc(f.dados.estado === 'desligado' ? 'Ponte desligada.' : f.dados.motivo || 'O Hub não abriu o relatório.')}</small>` : '';
      return `<li><span><b>${nomeMes(mes)}</b>${st}</span><button type="button" class="d3m-c-btn c" data-md-relatorio="${mes}" ${f?.estado === 'buscando' ? 'disabled' : ''}>Abrir no VybeHub ${IC.fora}</button></li>`; };
    const entregas = typeof window.VybeRelatorio?.abrir === 'function';
    return `<div class="mdn-duas">
        <section class="mdn-bloco"><b class="mdn-bloco-h">Relatório do mês no VybeHub</b><p class="mdn-txt apagado">O BI do cliente (Meta e planilha) no mesmo relatório que o cliente vê. O link vale 10 minutos.${semMeta ? ' Sem conta do Meta nem planilha de BI, o Hub não monta.' : ''}</p>
          <ul class="mdn-meses">${ms.map(linhaMes).join('')}</ul></section>
        <section class="mdn-bloco"><b class="mdn-bloco-h">Relatório de entregas do Vybe OS</b><p class="mdn-txt apagado">Peças entregues, no prazo e por formato no mês, com os números de anúncio colados à mão, para salvar em PDF.</p>
          ${entregas ? `<ul class="mdn-meses">${ms.slice(0, 2).map((mes) => `<li><span><b>${nomeMes(mes)}</b></span><button type="button" class="d3m-c-btn c" data-md-entregas="${mes}">Abrir</button></li>`).join('')}</ul>` : '<p class="mdn-txt apagado">O relatório de entregas não está carregado nesta tela.</p>'}
          <a class="md-link" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Painel completo do cliente no VybeHub</a></section></div>`;
  }
  function fichaHtml(c) {
    const corpo = { resumo: abaResumo, historico: abaHistorico, campanhas: abaCampanhas, semana: abaSemana, relatorios: abaRelatorios }[estado.aba] || abaResumo;
    const tom = tomDe(c);
    return `<div class="d3m-c-folha-cab mdn-ficha-cab"><button type="button" class="d3m-c-btn c mdn-volta" data-md-voltar aria-label="Voltar para ${estado.visao === 'hoje' ? 'a rotina' : 'os clientes'}">${IC.volta}${estado.visao === 'hoje' ? 'Hoje' : 'Clientes'}</button>
        <span class="md-sinal ${tom}" title="${TOM[tom]}"><i aria-hidden="true"></i><span class="md-sr">${TOM[tom]}</span></span>
        <b class="d3m-c-h3 mdn-ficha-nome" role="heading" aria-level="3">${esc(c.nome)}</b></div>
      <div class="mdn-abas d3m-c-abas" role="radiogroup" aria-label="Ficha de mídia">${ABAS.map(([id, t]) => `<button type="button" role="radio" data-md-aba="${id}" aria-checked="${estado.aba === id}">${t}</button>`).join('')}</div>
      <div class="mdn-ficha-corpo" role="region" aria-label="${esc(ABAS.find((a) => a[0] === estado.aba)?.[1] || '')}">${corpo(c)}</div>`;
  }

  // ── A consulta (coluna da direita) ────────────────────────────────────────────────────────────────────────────────
  function laranjaHtml(c) {
    const rot = '<span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">Í</span>Ícaro · Mídia Paga</span>';
    if (c) {
      const d = dadosDe(c.id), tom = tomDe(c);
      const frase = !metaDe(c.id) || metaDe(c.id).estado === 'buscando' ? 'Lendo o Meta' : d?.estado === 'ok' ? TOM[tom] : d?.estado === 'sem_conta' ? 'Sem conta do Meta' : d?.estado === 'pagamento' ? 'Pagamento pendente' : 'Sem números do Meta';
      const sub = d?.estado === 'ok' ? d.sinal?.motivo || '' : d?.estado === 'sem_conta' ? 'Vincule a conta de anúncios no VybeHub para o Ícaro acompanhar.' : d?.motivo || '';
      return `<section class="d3m-laranja md-laranja" aria-label="O Ícaro sobre ${esc(c.nome)}">${rot}
        <div class="d3m-lar-txt"><b class="d3-acao-frase">${esc(frase)}</b><small class="d3m-c-s">${esc(sub)}</small></div></section>`;
    }
    const fora = hubFora();
    if (estado.visao === 'hoje') {
      // O que pede você agora: o primeiro item ainda não feito de Pede ação, depois De olho, depois a rotina do dia.
      const l = itensDaRotina().filter((x) => !x.check), prim = l.find((x) => x.tom === 'r') || l.find((x) => x.tom === 'a') || l.find((x) => x.tom === 'rotina' && x.cadencia === 'dia');
      const faltam = lendo(7);
      const frase = fora ? 'Sem números do Meta agora' : prim ? (prim.cliente ? `${esc(prim.cliente)} · ${esc(prim.titulo.charAt(0).toLowerCase() + prim.titulo.slice(1))}` : esc(prim.titulo)) : faltam ? 'Lendo o Meta de cada cliente' : 'Rotina de hoje em dia';
      const sub = fora ? (fora === 'desligado' ? 'A ponte com o VybeHub está desligada neste ambiente.' : 'O VybeHub não respondeu. Tente de novo em instantes.') : prim ? esc(prim.porque) : faltam ? `Faltam ${faltam}.` : 'Tudo marcado. Amanhã a rotina recomeça.';
      const bts = prim && !fora ? `<div class="d3m-lar-bts"><button type="button" class="d3m-btn l" data-md-check="${esc(chaveItem(prim))}">Marcar feito</button>${prim.cliente ? `<button type="button" class="d3m-btn l mdq-l2" data-md-linha="${esc(prim.cliente_id)}">Ver o cliente</button>` : ''}</div>` : '';
      return `<section class="d3m-laranja md-laranja" aria-label="O que pede você agora">${rot}<div class="d3m-lar-txt"><b class="d3-acao-frase">${frase}</b><small class="d3m-c-s">${sub}</small></div>${bts}</section>`;
    }
    const prim = linhasVisiveis().find((x) => ['r', 'a'].includes(tomDe(x)));
    const buscando = lendo(estado.dias);
    const frase = fora ? 'Sem números do Meta agora' : prim ? `${esc(prim.nome)} · ${TOM[tomDe(prim)].toLowerCase()}` : buscando ? 'Lendo o Meta de cada cliente' : 'Nenhum cliente pedindo atenção';
    const motivo = prim ? (dadosDe(prim.id)?.estado === 'pagamento' ? 'Conta com pagamento pendente no Meta.' : dadosDe(prim.id)?.sinal?.motivo || '') : '';
    const sub = fora ? (fora === 'desligado' ? 'A ponte com o VybeHub está desligada neste ambiente.' : 'O VybeHub não respondeu. Tente de novo em instantes.') : prim ? esc(motivo) : buscando ? `Faltam ${buscando}.` : `No período de ${estado.dias} dias, tudo dentro do esperado.`;
    return `<section class="d3m-laranja md-laranja" aria-label="O que pede atenção">${rot}
      <div class="d3m-lar-txt"><b class="d3-acao-frase">${frase}</b><small class="d3m-c-s">${sub}</small></div>
      ${prim && !fora ? `<div class="d3m-lar-bts"><button type="button" class="d3m-btn l" data-md-linha="${esc(prim.id)}">Ver o cliente</button></div>` : ''}</section>`;
  }
  // Os últimos 7 dias da rotina: quantos itens foram feitos em cada dia e por quem.
  function historicoRotinaHtml() {
    const h = rotina.dados?.historico || [];
    if (!h.length) return '';
    const max = Math.max(...h.map((x) => x.feitos), 1);
    const linhas = h.map((x, i) => `<div class="mdq-hist"><span>${i === 0 ? 'Hoje' : i === 1 ? 'Ontem' : `${diaSemana(x.dia)} ${dataBr(x.dia)}`}</span><span class="d3m-vbarra n"><i style="--v:${Math.round((x.feitos / max) * 100)}%"></i></span><b>${x.feitos}</b><small>${x.quem.length ? esc(x.quem.join(', ')) : '—'}</small></div>`).join('');
    return `<div class="d3m-cons mdq-hist-cons"><div class="d3m-cons-cab"><b>Últimos 7 dias</b><span>itens feitos</span></div><div class="mdq-hists">${linhas}</div></div>`;
  }
  function canaisDaCarteira() {
    const t = estado.clientes, prontos = t.filter((c) => metaDe(c.id)?.estado === 'pronto');
    const comMeta = prontos.filter((c) => !['sem_conta', 'erro', 'desligado'].includes(dadosDe(c.id).estado)).length;
    const comSite = t.filter((c) => c.tem_site).length, comGoogle = t.filter((c) => c.google_ads).length;
    const barra = (rot, n, total, tom = '') => `<div class="md-canal"><span>${rot}</span><span class="d3m-vbarra ${tom}"><i style="--v:${total ? Math.round((n / total) * 100) : 0}%"></i></span><b>${n} de ${total}</b></div>`;
    return `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Canais conectados</b><span>${plural(t.length, 'cliente', 'clientes')}</span></div><div class="md-canais">
      ${barra('Meta Ads', comMeta, prontos.length || t.length)}${barra('Google Ads (ID)', comGoogle, t.length, 'n')}${barra('Site', comSite, t.length, 'n')}</div>
      <p class="md-nota">Abra um cliente para adicionar o site e o ID do Google Ads. A leitura dos números do Google Ads e a análise do site ainda não estão ligadas.</p></div>`;
  }
  const comoTrabalha = () => `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Como o Ícaro trabalha</b></div><p class="md-nota">Lê todos os canais, aponta o que pede atenção e propõe. Criar, pausar ou mudar verba só com o SIM de um dono, e tudo nasce pausado.</p></div>`;
  // Os canais do cliente aberto: o Meta (com o caminho para vincular), o Google Ads e o site, com os campos de conectar.
  function canaisDoCliente(c) {
    const d = dadosDe(c.id), aviso = estado.aviso;
    const msg = (canal) => (aviso?.canal === canal ? `<p class="mdn-msg ${aviso.ok ? 'ok' : 'erro'}" role="${aviso.ok ? 'status' : 'alert'}">${esc(aviso.texto)}</p>` : '');
    const form = (canal, rot, valor, dica, tipo) => `<form class="mdn-form" data-md-form="${canal}" novalidate><input data-md-campo="${canal}" type="${tipo}" aria-label="${rot}" title="${rot}" inputmode="${canal === 'google_ads' ? 'numeric' : 'url'}" autocomplete="off" placeholder="${dica}" value="${esc(valor)}" ${estado.salvando === canal ? 'disabled' : ''}>
      <button type="submit" class="d3m-c-btn" ${estado.salvando === canal ? 'disabled' : ''}>${estado.salvando === canal ? 'Salvando' : 'Salvar'}</button>${valor ? '<button type="button" class="d3m-c-btn v" data-md-cancelar>Cancelar</button>' : ''}</form>`;
    const meta = !d ? '<p class="md-nota">Lendo do VybeHub.</p>' : d.estado === 'ok' ? '<p class="md-nota">Lendo do VybeHub, pela mesma ponte do bot.</p>'
      : d.estado === 'sem_conta' ? `<p class="md-nota">Sem conta de anúncios vinculada. A conta do Meta do cliente mora no VybeHub: vincule lá e os números aparecem aqui.</p><span class="mdn-form-bts"><a class="d3m-c-btn v" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Vincular no VybeHub ${IC.fora}</a></span>`
      : d.estado === 'pagamento' ? `<p class="md-nota">Conta ligada, com pagamento pendente no Meta.</p><span class="mdn-form-bts"><a class="d3m-c-btn v" href="${LINK.faturamento}" target="_blank" rel="noopener">Pagamentos no Meta ${IC.fora}</a></span>`
      : `<p class="md-nota">${esc(d.motivo || 'O VybeHub não respondeu agora.')}</p>`;
    const google = estado.editando === 'google_ads' || !c.google_ads ? form('google_ads', 'ID da conta do Google Ads', c.google_ads, '123-456-7890', 'text')
      : `<p class="mdn-valor"><b>${esc(c.google_ads)}</b><span>ID salvo. A leitura dos números ainda não está ligada.</span></p><span class="mdn-form-bts"><a class="d3m-c-btn v" href="https://ads.google.com/aw/overview" target="_blank" rel="noopener" title="Abre o Google Ads; escolha a conta ${esc(c.google_ads)}">Abrir ${IC.fora}</a><button type="button" class="d3m-c-btn v" data-md-editar="google_ads">Editar</button><button type="button" class="d3m-c-btn v" data-md-apagar="google_ads">Tirar</button></span>`;
    const site = estado.editando === 'site' || !c.site ? form('site', 'Endereço do site', c.site, 'cliente.com.br', 'text')
      : `<p class="mdn-valor"><a href="${esc(c.site)}" target="_blank" rel="noopener">${esc(dominio(c.site))} ${IC.fora}</a><span>A análise do site ainda não tem fonte: falta ligar o Google Analytics (GA4) do cliente.</span></p><span class="mdn-form-bts"><button type="button" class="d3m-c-btn v" data-md-editar="site">Editar</button><button type="button" class="d3m-c-btn v" data-md-apagar="site">Tirar</button></span>`;
    return `<div class="d3m-cons mdn-canais"><div class="d3m-cons-cab"><b>Canais deste cliente</b><span>só donos</span></div>
      <section class="mdn-canal" aria-label="Meta Ads"><b class="mdn-canal-h"><span class="md-sinal ${d?.estado === 'ok' ? 'g' : d?.estado === 'pagamento' ? 'r' : 'n'}" aria-hidden="true"><i></i></span>Meta Ads</b>${meta}</section>
      <section class="mdn-canal" aria-label="Google Ads"><b class="mdn-canal-h"><span class="md-sinal n" aria-hidden="true"><i></i></span>Google Ads</b>${google}${msg('google_ads')}</section>
      <section class="mdn-canal" aria-label="Site"><b class="mdn-canal-h"><span class="md-sinal n" aria-hidden="true"><i></i></span>Site</b>${site}${msg('site')}</section></div>`;
  }
  function ladoHtml() {
    if (estado.carregando || estado.erro) return '';
    const c = estado.ficha ? clienteDe(estado.ficha) : null;
    if (c) return laranjaHtml(c) + canaisDoCliente(c);
    return laranjaHtml(null) + (estado.visao === 'hoje' ? historicoRotinaHtml() + `<div class="d3m-cons mdq-como"><div class="d3m-cons-cab"><b>Como a rotina funciona</b></div><p class="md-nota">Os alertas vêm dos números do Meta de cada cliente (7 dias até ontem e o dia de ontem). A rotina vale para o dia, a semana ou o início do mês. O check guarda quem fez e quando, para os quatro donos verem.</p></div>` : canaisDaCarteira() + comoTrabalha());
  }
  function pintarLado() { const l = janela?.querySelector('#md-lado'); if (l) l.innerHTML = ladoHtml(); }

  function subtitulo() {
    if (estado.carregando) return 'buscando os clientes';
    if (estado.erro) return 'não foi possível buscar';
    const n = contagem(), faltam = lendo(estado.dias);
    return `${estado.dias} dias até ontem · ${plural(n.todos, 'cliente', 'clientes')}${n.acao ? ` · ${n.acao} ${n.acao === 1 ? 'pede' : 'pedem'} atenção` : ''}${faltam ? ` · lendo ${faltam}` : ''}`;
  }
  // Repinta o que muda com o Meta chegando: subtítulo, números, a visão aberta (rotina, lista ou o Resumo da ficha) e o lado.
  function pintarCorpo() {
    if (!janela) return;
    const sub = janela.querySelector('.d3m-c-sub'); if (sub) sub.textContent = subtitulo();
    const nums = janela.querySelector('.mdn-nums'); if (nums && !estado.carregando && !estado.erro) nums.outerHTML = numerosHtml();
    const n = contagem(), p = progresso();
    janela.querySelectorAll('[data-md-visao]').forEach((b) => { const x = b.querySelector('b'); if (x) x.textContent = b.dataset.mdVisao === 'hoje' ? `${p.feitos}/${p.total}` : n.todos; });
    if (estado.ficha) {
      if (estado.aba === 'resumo') { const corpo = janela.querySelector('.mdn-ficha-corpo'), c = clienteDe(estado.ficha); if (corpo && c) corpo.innerHTML = abaResumo(c); buscarDaAba(); }
      // Não repinta o lado com alguém digitando no campo de conectar.
      if (!janela.querySelector('#md-lado')?.contains(document.activeElement)) pintarLado();
      return;
    }
    if (estado.visao === 'hoje') {
      const folha = janela.querySelector('.md-folha'); if (!folha) return pintar();
      const foco = document.activeElement?.dataset?.mdCheck;
      folha.innerHTML = folhaRotinaHtml();
      if (foco) janela.querySelector(`[data-md-check="${CSS.escape(foco)}"]`)?.focus();
    } else {
      const alvo = janela.querySelector('#md-lista'); if (!alvo) return pintar();
      alvo.innerHTML = listaHtml();
      janela.querySelectorAll('[data-md-filtro]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.mdFiltro === estado.filtro)); const x = b.querySelector('b'); if (x) x.textContent = n[b.dataset.mdFiltro]; });
      const cab = janela.querySelector('.mdq-cab-lista'); if (cab) cab.outerHTML = cabListaHtml();
    }
    pintarLado();
  }
  function pintar() {
    if (!janela) return;
    const c = estado.ficha ? clienteDe(estado.ficha) : null, n = contagem(), p = progresso();
    const titulo = typeof window.d3mcTrocaHtml === 'function' ? window.d3mcTrocaHtml('Mídia', 'midia', 'midia') : '<b class="d3m-c-h" role="heading" aria-level="2">Mídia</b>';
    const visoes = `<span class="d3m-c-seg mdq-visoes" role="radiogroup" aria-label="Visão"><button type="button" role="radio" data-md-visao="hoje" aria-checked="${estado.visao === 'hoje'}">Hoje <b>${rotina.dados ? `${p.feitos}/${p.total}` : ''}</b></button><button type="button" role="radio" data-md-visao="carteira" aria-checked="${estado.visao === 'carteira'}">Carteira <b>${n.todos || ''}</b></button></span>`;
    const seg = `<span class="d3m-c-seg mdq-dias" role="radiogroup" aria-label="Período">${[7, 30].map((d) => `<button type="button" role="radio" data-md-dias="${d}" aria-checked="${estado.dias === d}">${d} dias</button>`).join('')}</span>`;
    const foco = document.activeElement?.id === 'md-busca';
    const pronto = estado.carregando || estado.erro ? '' : ' mdn-pronto';
    janela.classList.toggle('mdn-com-ficha', Boolean(c));
    janela.dataset.visao = c ? 'ficha' : estado.visao;
    janela.innerHTML = `<div class="d3m-c-topo"><div class="d3m-c-tit">${titulo}<span class="d3m-c-sub">${esc(subtitulo())}</span></div>${visoes}${seg}
        <label class="d3m-c-busca" title="Buscar cliente">${IC.lupa}<input id="md-busca" type="search" aria-label="Buscar cliente" autocomplete="off" placeholder="Buscar cliente" data-md-busca value="${esc(estado.busca)}"></label>
        <button type="button" class="d3m-c-ico" data-md-fechar aria-label="Fechar" title="Fechar">${IC.x}</button></div>
      ${estado.carregando || estado.erro ? '' : numerosHtml()}
      <div class="d3m-c-corpo md-corpo"><section class="d3m-c-folha md-folha${pronto}${!c && estado.visao === 'hoje' ? ' mdq-folha-hoje' : ''}" aria-label="${c ? `Mídia de ${esc(c.nome)}` : estado.visao === 'hoje' ? 'Rotina de hoje' : 'Mídia por cliente'}">${c ? fichaHtml(c) : estado.visao === 'hoje' ? folhaRotinaHtml() : folhaListaHtml()}</section>
        <aside id="md-lado" class="d3m-lado" aria-label="Consulta">${ladoHtml()}</aside></div>`;
    if (foco && !c) { const b = janela.querySelector('#md-busca'); b?.focus(); try { b?.setSelectionRange(b.value.length, b.value.length); } catch { /* sem seleção */ } }
  }

  function abrirFicha(id, aba = 'resumo') {
    if (!clienteDe(id)) return;
    estado.ficha = id; estado.aba = ABAS.some((a) => a[0] === aba) ? aba : 'resumo'; estado.editando = ''; estado.aviso = null;
    pintar(); buscarDaAba();
    janela.querySelector('.mdn-volta')?.focus();
  }
  // Os botões de ação da rotina: abrem a ficha na aba certa, ou a carteira.
  function irPara(alvo, cli) {
    if (cli && alvo !== 'carteira') return abrirFicha(cli, alvo);
    estado.visao = 'carteira'; estado.ficha = ''; pintar();
  }
  function voltarALista() {
    const id = estado.ficha;
    estado.ficha = ''; estado.editando = ''; estado.aviso = null; pintar();
    janela.querySelector(`.mdn-nome[data-md-linha="${CSS.escape(id)}"], .mdq-cli[data-md-linha="${CSS.escape(id)}"]`)?.focus();
  }

  async function lerJson(url, opcoes) {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opcoes });
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
      estado.clientes = Array.isArray(d.clientes) ? d.clientes.map((c) => ({ ...c, site: c.site || '', google_ads: c.google_ads || '' })) : [];
      estado.canais = Array.isArray(d.canais) ? d.canais : [];
      estado.hubAtivo = d.hub_ativo !== false;
      if (typeof d.hub_url === 'string' && /^https:\/\//.test(d.hub_url)) estado.hubUrl = d.hub_url.replace(/\/$/, '');
      if (estado.ficha && !clienteDe(estado.ficha)) estado.ficha = '';
    } catch (e) { if (minha === geracao) estado.erro = e.message; }
    if (minha !== geracao) return;
    estado.carregando = false; pintar();
    if (!estado.erro) { buscarRotina(); buscarMetas(7); if (estado.dias !== 7) buscarMetas(estado.dias); buscarDaAba(); }
  }
  async function buscarRotina() {
    if (rotina.estado === 'buscando') return;
    rotina = { estado: 'buscando', dados: rotina.dados };
    try { const d = await lerJson('/api/painel?area=midia&acao=rotina'); rotina = { estado: 'pronto', dados: { hoje: d.hoje, fixos: d.fixos || [], checks: d.checks || [], historico: d.historico || [] } }; }
    catch (e) { rotina = { estado: 'falhou', dados: null, motivo: e.message }; }
    if (janela && !janela.hidden) pintarCorpo();
  }
  // O check de um item: marca ou desfaz no servidor (só donos); a tela muda quando o servidor confirma.
  async function alternarCheck(k) {
    if (marcando.has(k) || !rotina.dados) return;
    const it = itensDaRotina().find((x) => chaveItem(x) === k);
    if (!it) return;
    const desfazer = Boolean(it.check);
    marcando.add(k); estado.avisoRotina = ''; pintarCorpo();
    try {
      const d = await lerJson('/api/painel?area=midia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: desfazer ? 'desfazer' : 'check', chave: it.chave, cliente_id: it.cliente_id || '0' }) });
      const outros = rotina.dados.checks.filter((x) => !(x.cliente_id === String(it.cliente_id || '0') && x.chave === it.chave));
      rotina.dados.checks = desfazer ? outros : [...outros, d.check];
      const h = rotina.dados.historico?.[0];
      if (h) { if (desfazer && d.removido) h.feitos = Math.max(0, h.feitos - 1); if (!desfazer && !d.ja_estava) { h.feitos++; const nome = d.check?.feito_por_nome; if (nome && !h.quem.includes(nome)) h.quem.push(nome); } }
    } catch (e) { estado.avisoRotina = `Não foi possível ${desfazer ? 'desfazer' : 'marcar'} "${it.titulo}": ${e.message}`; }
    marcando.delete(k);
    pintarCorpo();
  }
  // De 4 em 4: cada cliente leva alguns segundos no Hub. O que chega repinta só o que depende dele, uma vez por quadro: os
  // que chegam juntos (no cache ou na demo, os 18 de uma vez) viram uma repintura só, não uma por cliente (sistema leve 2).
  let corpoNoQuadro = false;
  function pintarCorpoNoQuadro() {
    if (corpoNoQuadro) return; corpoNoQuadro = true;
    const quadro = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
    quadro(() => { corpoNoQuadro = false; if (janela && !janela.hidden) pintarCorpo(); });
  }
  // Com a ponte desligada não pergunta a ninguém: cada cliente já fica como "ponte desligada".
  async function buscarMetas(dias = estado.dias) {
    const minha = geracao;
    const mapa = (metas[dias] ||= {});
    if (!estado.hubAtivo) { estado.clientes.forEach((c) => { mapa[c.id] ||= { estado: 'pronto', dados: { estado: 'desligado', motivo: 'A ponte com o VybeHub está desligada neste ambiente.' }, registros: [] }; }); return pintarCorpo(); }
    // A ficha aberta vai primeiro na fila.
    const fila = estado.clientes.filter((c) => !mapa[c.id]).sort((a, b) => (b.id === estado.ficha) - (a.id === estado.ficha));
    fila.forEach((c) => { mapa[c.id] = { estado: 'buscando' }; });
    pintarCorpo();
    const trabalhar = async () => {
      for (let c = fila.shift(); c; c = fila.shift()) {
        try {
          const d = await lerJson(`/api/painel?area=midia&acao=cliente&cliente_id=${encodeURIComponent(c.id)}&dias=${dias}`);
          mapa[c.id] = { estado: 'pronto', dados: d.meta || { estado: 'sem_dados' }, registros: Array.isArray(d.registros) ? d.registros : [] };
        } catch { mapa[c.id] = { estado: 'falhou' }; }
        if (minha === geracao && janela && !janela.hidden && (dias === estado.dias || dias === 7)) pintarCorpoNoQuadro();
      }
    };
    await Promise.all([trabalhar(), trabalhar(), trabalhar(), trabalhar()]);
  }
  // O que a aba aberta precisa (Histórico, Campanhas, Resumo da semana, anúncios do Resumo), uma vez por cliente.
  async function buscarDaAba() {
    const id = estado.ficha, aba = estado.aba, chave = chaveDaAba();
    if (!id || !chave || fichas[chave]) return;
    // Os anúncios do Resumo só quando o Meta do cliente respondeu (sem conta, não pergunta de novo ao Hub).
    if (aba === 'resumo') { const d = dadosDe(id); if (!d) return; if (d.estado !== 'ok') return; }
    if (!estado.hubAtivo) { fichas[chave] = { estado: 'pronto', dados: { estado: 'desligado' } }; return repintarAba(aba, id); }
    fichas[chave] = { estado: 'buscando' };
    const acao = aba === 'historico' ? 'historico' : aba === 'campanhas' ? `campanhas&dias=${estado.dias}` : aba === 'resumo' ? `anuncios&dias=${estado.dias}` : 'semana';
    try { fichas[chave] = { estado: 'pronto', dados: await lerJson(`/api/painel?area=midia&acao=${acao}&cliente_id=${encodeURIComponent(id)}`) }; }
    catch (e) { fichas[chave] = { estado: 'falhou', motivo: e.message }; }
    repintarAba(aba, id);
  }
  function repintarAba(aba, id) {
    if (!janela || janela.hidden || estado.ficha !== id || estado.aba !== aba) return;
    const corpo = janela.querySelector('.mdn-ficha-corpo'), c = clienteDe(id);
    if (corpo && c) corpo.innerHTML = { resumo: abaResumo, historico: abaHistorico, campanhas: abaCampanhas, semana: abaSemana }[aba](c);
  }
  // O relatório do mês: o Hub devolve um convite de 10 minutos. A aba é aberta já no clique (o navegador não bloqueia)
  // e recebe o endereço quando o convite chega; sem convite, fecha e a linha diz o motivo.
  async function abrirRelatorio(mes) {
    const id = estado.ficha, chave = `relatorio:${id}:${mes}`;
    let aba = null; try { aba = window.open('', '_blank'); } catch { aba = null; }
    fichas[chave] = { estado: 'buscando' }; repintarRelatorios(id);
    try {
      const d = await lerJson(`/api/painel?area=midia&acao=relatorio&cliente_id=${encodeURIComponent(id)}&mes=${encodeURIComponent(mes)}`);
      fichas[chave] = { estado: 'pronto', dados: d };
      if (d.estado === 'ok' && /^https:\/\//.test(d.url)) { if (aba) { aba.opener = null; aba.location.href = d.url; } else window.open(d.url, '_blank', 'noopener'); }
      else aba?.close();
    } catch (e) { fichas[chave] = { estado: 'pronto', dados: { estado: 'erro', motivo: e.message } }; aba?.close(); }
    repintarRelatorios(id);
  }
  function repintarRelatorios(id) { if (estado.ficha === id && estado.aba === 'relatorios') { const corpo = janela?.querySelector('.mdn-ficha-corpo'); const c = clienteDe(id); if (corpo && c) corpo.innerHTML = abaRelatorios(c); } }
  async function copiarSemana(b) {
    const d = fichas[chaveDaAba('semana')]?.dados;
    if (!d?.texto) return;
    try { await navigator.clipboard.writeText(d.texto); b.textContent = 'Copiado'; } catch { b.textContent = 'Não deu para copiar'; }
    setTimeout(() => { if (b.isConnected) b.textContent = 'Copiar o texto'; }, 2000);
  }
  // Conectar: grava o site ou o ID do Google Ads no cadastro do cliente (só donos; o servidor confere de novo).
  async function salvarCanal(canal, valor) {
    const id = estado.ficha, c = clienteDe(id);
    if (!c || !['site', 'google_ads'].includes(canal) || estado.salvando) return;
    estado.salvando = canal; estado.aviso = null; pintarLado();
    try {
      const d = await lerJson('/api/painel?area=midia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'conectar', cliente_id: id, [canal]: valor }) });
      c.site = d.site || ''; c.tem_site = Boolean(d.site); c.google_ads = d.google_ads || '';
      estado.editando = '';
      estado.aviso = { canal, ok: true, texto: canal === 'site' ? (c.site ? 'Site salvo no cadastro do cliente.' : 'Site tirado do cadastro.') : (c.google_ads ? 'ID salvo no cadastro do cliente.' : 'ID tirado do cadastro.') };
    } catch (e) { estado.aviso = { canal, ok: false, texto: e.message }; estado.editando = canal; }
    estado.salvando = '';
    pintarLado();
    if (!estado.aviso.ok) { const i = janela.querySelector(`[data-md-campo="${canal}"]`); if (i) { i.value = valor; i.focus(); } }
  }

  function abrir() {
    if (!janela) criarJanela();
    janela.hidden = false;
    document.body.classList.add('mundo-midia');
    if (!estado.clientes.length || estado.erro) carregar();
    else { pintar(); buscarRotina(); buscarMetas(7); if (estado.dias !== 7) buscarMetas(estado.dias); buscarDaAba(); }
  }
  function fechar() { if (janela) janela.hidden = true; document.body.classList.remove('mundo-midia'); }

  // aberto: o dock (remarcarAoFechar em vybe-mundo.js) pergunta antes de acender o Hoje no lugar da Mídia.
  window.VybeMidia = { abrir, fechar, aberto: () => Boolean(janela && !janela.hidden) };
})();
