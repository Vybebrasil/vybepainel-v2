// Mídia (Vinícius, 20/11/2026: "um controle geral do que é relacionado à mídia desse cliente... o que não tiver
// conectado ainda, a gente deixa o espacinho para conectar"). A tela interna da gestão, só dos quatro donos: uma linha
// por cliente ativo com cada canal de mídia — Meta Ads, Google Ads e o site — e o sinal do Ícaro (Mídia Paga, 5º andar).
//
// Confere e completa (Paulo, 23/11/2026: "tá meio bugado.. não mostra quase nada de info.. não consigo add o site? o
// google ads? olhar históricos? relatórios? resumo da semana do cliente?"):
//   · no topo, o resumo da carteira de mídia (investido, conversas, quantos pedem atenção, quantos sem conta);
//   · a linha abre a ficha do cliente dentro do módulo, em abas: Resumo, Histórico (8 semanas), Campanhas, Resumo da
//     semana (o mesmo texto que o Ícaro manda ao Ewerton na segunda) e Relatórios (o do mês no VybeHub e o de entregas);
//   · na consulta da ficha, os canais do cliente: o site e o ID do Google Ads se gravam daqui (cadastro do cliente), e o
//     Meta sem conta mostra o caminho para vincular no VybeHub. Google Ads e análise do site ainda não têm leitura de
//     números: a tela diz isso, nunca mostra zero.
//
// Os dados vêm de area=midia (server/midia.js): a carteira chega de uma vez e o Meta de cada cliente chega depois, de 4
// em 4 (cada um pergunta ao VybeHub, que pergunta ao Meta). Tudo só leitura, menos os dois campos de conectar.
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
  };
  const TIPO = { messages: ['conversa', 'conversas'], profile_visits: ['visita ao perfil', 'visitas ao perfil'], reach: ['pessoa alcançada', 'pessoas alcançadas'],
    impressions: ['impressão', 'impressões'], link_clicks: ['clique no link', 'cliques no link'], leads: ['cadastro', 'cadastros'], purchases: ['compra', 'compras'],
    video_views: ['visualização de vídeo', 'visualizações de vídeo'], follows: ['seguidor', 'seguidores'], engagement: ['interação', 'interações'], other: ['resultado', 'resultados'] };
  const TOM = { r: 'Pede ação', a: 'De olho', g: 'Em dia', n: 'Sem dados' };
  const PESO = { r: 0, a: 1, g: 2, n: 3 };
  const ABAS = [['resumo', 'Resumo'], ['historico', 'Histórico'], ['campanhas', 'Campanhas'], ['semana', 'Resumo da semana'], ['relatorios', 'Relatórios']];
  const reais = (v) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const reaisCurto = (v) => (v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
  const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
  const tipoTxt = (t, n) => { const p = TIPO[t] || TIPO.other; return Number(n) === 1 ? p[0] : p[1]; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const variacao = (agora, antes) => (agora != null && antes > 0 ? Math.round(((agora - antes) / antes) * 100) : null);
  const pct = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${v}%`);
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); } };

  let estado = { clientes: [], canais: [], dias: 7, hubAtivo: true, hubUrl: 'https://vybehub.vercel.app', filtro: 'todos', busca: '', carregando: false, erro: '',
    ficha: '', aba: 'resumo', salvando: '', aviso: null, editando: '' };
  // O Meta de cada cliente por período: { [dias]: { [id]: { estado: 'buscando'|'pronto'|'falhou', dados, registros } } }.
  let metas = {};
  // O que a ficha já buscou: { 'historico:ID', 'campanhas:ID:7', 'semana:ID', 'relatorio:ID:AAAA-MM' } → { estado, dados }.
  let fichas = {};
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
      if (b.dataset.mdLinha) return abrirFicha(b.dataset.mdLinha);
      if (b.dataset.mdVoltar !== undefined) return voltarALista();
      if (b.dataset.mdAba) { estado.aba = b.dataset.mdAba; pintar(); return buscarDaAba(); }
      if (b.dataset.mdFiltro) { estado.filtro = b.dataset.mdFiltro; return pintarLista(); }
      if (b.dataset.mdDias) { estado.dias = Number(b.dataset.mdDias) || 7; pintar(); buscarMetas(); return buscarDaAba(); }
      if (b.dataset.mdRecarregar !== undefined) { metas = {}; fichas = {}; return carregar(); }
      if (b.dataset.mdTentar) { delete (metas[estado.dias] || {})[b.dataset.mdTentar]; pintar(); return buscarMetas(); }
      if (b.dataset.mdTentarTodos !== undefined) { metas[estado.dias] = {}; pintar(); return buscarMetas(); }
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
    janela.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-md-busca]')) { estado.busca = ev.target.value; pintarLista(); } });
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
  const metaDe = (id) => metas[estado.dias]?.[id] || null;
  const dadosDe = (id) => { const m = metaDe(id); return m?.estado === 'pronto' ? m.dados : null; };
  // O tom da linha: o sinal do Ícaro quando o Meta respondeu; sem conta ou sem dados, cinza.
  function tomDe(c) { const d = dadosDe(c.id); return d?.estado === 'ok' ? d.sinal?.tom || 'n' : 'n'; }
  const semConta = (c) => dadosDe(c.id)?.estado === 'sem_conta';
  function linhasVisiveis() {
    const q = norm(estado.busca);
    let lista = estado.clientes.filter((c) => !q || norm(c.nome).includes(q));
    if (estado.filtro === 'acao') lista = lista.filter((c) => ['r', 'a'].includes(tomDe(c)));
    if (estado.filtro === 'sem') lista = lista.filter(semConta);
    return [...lista].sort((a, b) => PESO[tomDe(a)] - PESO[tomDe(b)] || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
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

  // ── A lista ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Duas linhas por célula (o número e o apoio embaixo): nada cortado com reticências, nem a 1366.
  const cel = (a, b = '', k = '') => `<span class="mdn-cel${k ? ' ' + k : ''}"><b>${a}</b>${b ? `<small>${b}</small>` : ''}</span>`;
  function celulasMeta(c) {
    const m = metaDe(c.id);
    if (!m || m.estado === 'buscando') return '<span class="mdn-cel md-brilho" aria-label="Buscando o Meta"><i></i></span><span class="mdn-cel md-brilho"><i></i></span>';
    if (m.estado === 'falhou') return `${cel('Não respondeu', '', 'apagado')}<span class="mdn-cel"><button type="button" class="md-link" data-md-tentar="${esc(c.id)}">Tentar de novo</button></span>`;
    const d = m.dados;
    if (d.estado === 'sem_conta') return `${cel('Sem conta', 'no VybeHub', 'apagado')}${cel('—', '', 'apagado')}`;
    if (d.estado === 'desligado') return `${cel('Ponte desligada', '', 'apagado')}${cel('—', '', 'apagado')}`;
    if (d.estado !== 'ok') return `${cel(d.estado === 'erro' ? 'Hub não respondeu' : 'Sem dados', d.estado === 'erro' ? '' : 'no período', 'apagado')}${cel('—', '', 'apagado')}`;
    const delta = variacao(d.investido, d.investido_anterior);
    const res = d.resultados ? cel(`${inteiro(d.resultados)} ${tipoTxt(d.tipo_resultado, d.resultados)}`, d.custo_resultado != null ? `${reais(d.custo_resultado)} cada` : '') : cel('Sem resultado', 'no período');
    return cel(reais(d.investido), delta != null ? `${pct(delta)} vs anterior` : 'sem anterior', 'num') + res;
  }
  function celulaGoogle(c) { return c.google_ads ? cel(esc(c.google_ads), 'ID salvo, sem leitura') : `<span class="mdn-cel apagado md-tomada">${IC.tomada}Não conectado</span>`; }
  function celulaSite(c) { return c.site ? cel(esc(dominio(c.site)), 'sem análise') : cel('Sem site', '', 'apagado'); }
  function linha(c) {
    const tom = tomDe(c);
    return `<div class="mdn-lin" data-md-linha="${esc(c.id)}">
      <span class="md-sinal ${tom}" title="${TOM[tom]}"><i aria-hidden="true"></i><span class="md-sr">${TOM[tom]}</span></span>
      <button type="button" class="mdn-nome" data-md-linha="${esc(c.id)}">${esc(c.nome)}</button>
      ${celulasMeta(c)}${celulaGoogle(c)}${celulaSite(c)}
      <span class="md-chev" aria-hidden="true">${IC.seta}</span></div>`;
  }
  function avisoHub() {
    const f = hubFora();
    if (f === 'desligado') return '<div class="mdn-aviso" role="status"><b>A ponte com o VybeHub está desligada neste ambiente.</b><span>Os números do Meta não chegam aqui. Site e Google Ads continuam editáveis na ficha de cada cliente.</span></div>';
    if (f === 'fora') return '<div class="mdn-aviso" role="alert"><b>O VybeHub não respondeu para nenhum cliente agora.</b><span>Os números do Meta vêm de lá. Confira se o Hub está no ar e tente de novo.</span><button type="button" class="d3m-c-btn c k" data-md-tentar-todos>Tentar de novo</button></div>';
    return '';
  }
  function listaHtml() {
    if (estado.carregando) return typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando', titulo: 'Buscando os clientes', forma: 'lista', linhas: 6 }) : '<p class="md-vazio">Buscando os clientes.</p>';
    if (estado.erro) return typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível abrir a Mídia', texto: estado.erro, acao: '<button type="button" class="d3m-btn" data-md-recarregar>Tentar de novo</button>' })
      : `<p class="md-vazio">${esc(estado.erro)} <button type="button" class="md-link" data-md-recarregar>Tentar de novo</button></p>`;
    const l = linhasVisiveis();
    if (!l.length) return avisoHub() + `<p class="md-vazio">${estado.busca ? 'Nenhum cliente com esse nome.' : estado.filtro === 'acao' ? 'Nenhum cliente pedindo atenção agora.' : estado.filtro === 'sem' ? 'Todos os clientes respondidos têm conta do Meta vinculada.' : 'Nenhum cliente ativo.'}</p>`;
    return avisoHub() + l.map(linha).join('');
  }

  // ── O resumo da carteira de mídia (os quatro números do topo) ─────────────────────────────────────────────────────
  function numerosHtml() {
    const t = estado.clientes, prontos = t.filter((c) => metaDe(c.id)?.estado === 'pronto' || metaDe(c.id)?.estado === 'falhou');
    const ok = t.map((c) => dadosDe(c.id)).filter((d) => d?.estado === 'ok');
    const inv = ok.reduce((s, d) => s + (d.investido || 0), 0), ant = ok.reduce((s, d) => s + (d.investido_anterior || 0), 0);
    const conv = ok.reduce((s, d) => s + (d.conversas || 0), 0), convAnt = ok.filter((d) => d.tipo_resultado === 'messages').reduce((s, d) => s + (d.resultados_anterior || 0), 0);
    const n = contagem(), r = t.filter((c) => tomDe(c) === 'r').length, lendo = t.length - prontos.length;
    const fora = hubFora();
    const num = (rot, valor, apoio) => `<div class="mdn-num"><span class="mdn-num-rot">${rot}</span><b>${valor}</b><small>${apoio}</small></div>`;
    const espera = fora ? (fora === 'desligado' ? 'ponte desligada' : 'Hub fora do ar') : lendo ? `lendo ${prontos.length} de ${t.length}` : '';
    return `<div class="mdn-nums" role="group" aria-label="Carteira de mídia em ${estado.dias} dias">
      ${num(`Investido no Meta · ${estado.dias} dias`, fora ? '—' : reaisCurto(inv), espera || `${pct(variacao(inv, ant)) || 'sem anterior'} sobre o anterior · ${plural(ok.length, 'cliente', 'clientes')}`)}
      ${num('Conversas pelo Meta', fora ? '—' : inteiro(conv), espera || (convAnt ? `${pct(variacao(conv, convAnt))} sobre o anterior` : 'só o que é conversa'))}
      ${num('Pedem atenção', fora ? '—' : n.acao, espera || (n.acao ? `${r} pede${r === 1 ? '' : 'm'} ação · ${n.acao - r} de olho` : 'nenhum agora'))}
      ${num('Sem conta Meta', fora ? '—' : n.sem, espera || `de ${plural(t.length, 'cliente', 'clientes')} · vincular no VybeHub`)}</div>`;
  }

  // ── A ficha do cliente ────────────────────────────────────────────────────────────────────────────────────────────
  const meses = () => { const h = new Date(); return [0, 1, 2].map((k) => { const d = new Date(h.getFullYear(), h.getMonth() - k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }); };
  const nomeMes = (m) => { const [a, n] = m.split('-').map(Number); const s = new Date(a, n - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  function chaveDaAba(aba = estado.aba, id = estado.ficha) { return aba === 'historico' ? `historico:${id}` : aba === 'campanhas' ? `campanhas:${id}:${estado.dias}` : aba === 'semana' ? `semana:${id}` : ''; }
  function estadoDoHub(d, oque) {
    if (d.estado === 'sem_conta') return `<div class="mdn-vazio"><b>Sem conta de anúncios vinculada no VybeHub.</b><span>${oque} chega aqui quando a conta do Meta do cliente estiver vinculada no admin do Hub.</span><a class="d3m-c-btn c" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Vincular no VybeHub ${IC.fora}</a></div>`;
    if (d.estado === 'desligado') return `<div class="mdn-vazio"><b>A ponte com o VybeHub está desligada neste ambiente.</b><span>${oque} vem do VybeHub.</span></div>`;
    if (d.estado === 'sem_dados') return `<div class="mdn-vazio"><b>Sem dados no período.</b><span>${esc(d.motivo || 'O Hub respondeu sem números para este cliente.')}</span></div>`;
    return `<div class="mdn-vazio"><b>O VybeHub não respondeu.</b><span>${esc(d.motivo || '')}</span><button type="button" class="d3m-c-btn c" data-md-tentar-aba>Tentar de novo</button></div>`;
  }
  const carregandoHtml = (t) => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo: 'carregando', titulo: t, forma: 'lista', linhas: 4 }) : `<p class="md-vazio">${t}</p>`);
  const tile = (rot, valor, apoio, k = '') => `<div class="mdn-tile${k ? ' ' + k : ''}"><span>${rot}</span><b>${valor}</b>${apoio ? `<small>${apoio}</small>` : ''}</div>`;

  function abaResumo(c) {
    const m = metaDe(c.id), d = m?.estado === 'pronto' ? m.dados : null;
    if (!m || m.estado === 'buscando') return carregandoHtml('Buscando o Meta deste cliente');
    if (m.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: 'O painel não respondeu.' }, 'O resumo');
    const cerebro = (m.registros || []).map((r) => `<li><b>${esc(r.titulo)}</b><small> · ${esc(new Date(r.criado_em).toLocaleDateString('pt-BR'))}</small>${r.resumo ? `<span>${esc(r.resumo)}</span>` : ''}</li>`).join('');
    const blocoCerebro = `<section class="mdn-bloco"><b class="mdn-bloco-h">No cérebro do cliente</b>${cerebro ? `<ul class="mdn-cerebro">${cerebro}</ul>` : '<p class="mdn-txt apagado">Nenhuma decisão ou aprendizado de mídia registrado ainda.</p>'}</section>`;
    if (d.estado !== 'ok') return estadoDoHub(d, 'O resumo do Meta') + blocoCerebro;
    const dInv = variacao(d.investido, d.investido_anterior), dRes = variacao(d.resultados, d.resultados_anterior), dCusto = variacao(d.custo_resultado, d.custo_anterior);
    // Custo que sobe é ruim; resultado que sobe é bom. O tom vai no texto ("pior"/"melhor"), não só na cor.
    const leitura = (v, bomSubir) => (v == null ? 'sem anterior comparável' : `${pct(v)} sobre o anterior · ${v === 0 ? 'igual' : (v > 0) === bomSubir ? 'melhor' : 'pior'}`);
    const tomCusto = dCusto == null ? '' : dCusto >= 20 ? 'pior' : dCusto <= -10 ? 'melhor' : '';
    const a = d.melhor_anuncio;
    const tom = d.sinal?.tom || 'n';
    return `<div class="mdn-tiles">
        ${tile(`Investido · ${estado.dias} dias`, reais(d.investido), dInv == null ? 'sem anterior' : `${pct(dInv)} sobre o anterior`)}
        ${tile(`Resultado · ${tipoTxt(d.tipo_resultado, 2)}`, inteiro(d.resultados), leitura(dRes, true))}
        ${tile('Custo por resultado', d.custo_resultado != null ? reais(d.custo_resultado) : '—', leitura(dCusto, false), tomCusto)}
        ${tile('Alcance', d.alcance != null ? inteiro(d.alcance) : '—', d.frequencia != null ? `frequência ${String(d.frequencia).replace('.', ',')}${d.frequencia > 3 ? ' · alta' : ''}` : '')}</div>
      <p class="mdn-icaro"><span class="md-sinal ${tom}" aria-hidden="true"><i></i></span><span><b>Ícaro · ${TOM[tom].toLowerCase()}:</b> ${esc(d.sinal?.motivo || '')}</span></p>
      <div class="mdn-duas">
        <section class="mdn-bloco"><b class="mdn-bloco-h">Melhor anúncio</b>${a ? `<p class="mdn-txt"><b>${esc(a.nome)}</b></p><p class="mdn-txt">${inteiro(a.resultados)} ${tipoTxt(a.tipo_resultado, a.resultados)}${a.custo_resultado != null ? ` a ${reais(a.custo_resultado)} cada` : ''}</p>${a.campanha ? `<p class="mdn-txt apagado">Campanha ${esc(a.campanha)}</p>` : ''}` : '<p class="mdn-txt apagado">Nenhum anúncio com resultado no período.</p>'}</section>
        ${blocoCerebro}</div>`;
  }
  function abaHistorico(c) {
    const f = fichas[chaveDaAba('historico', c.id)];
    if (!f || f.estado === 'buscando') return carregandoHtml('Buscando as últimas 8 semanas');
    if (f.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: f.motivo }, 'O histórico');
    const d = f.dados;
    if (d.estado !== 'ok') return estadoDoHub(d, 'O histórico');
    const s = d.semanas || [];
    if (!s.some((x) => x.investido)) return '<div class="mdn-vazio"><b>Sem investimento nas últimas 8 semanas.</b></div>';
    const max = Math.max(...s.map((x) => x.investido || 0)) || 1;
    // Uma série só (o investido), um tom só; resultado e custo ficam na tabela, sem segundo eixo.
    const barras = s.map((x) => { const h = x.investido ? Math.max(4, Math.round((x.investido / max) * 100)) : 0;
      const dica = `${dataBr(x.de)} a ${dataBr(x.ate)}: ${reais(x.investido)}${x.resultados != null ? ` · ${inteiro(x.resultados)} ${tipoTxt(x.tipo_resultado, x.resultados)}` : ''}`;
      return `<div class="mdn-barra" title="${esc(dica)}" aria-label="${esc(dica)}" role="img"><small>${x.investido != null ? reaisCurto(x.investido) : '—'}</small><span><i style="--h:${h}%"></i></span><em>${dataBr(x.de)}</em></div>`; }).join('');
    const linhas = [...s].reverse().map((x) => `<tr><td>${dataBr(x.de)} a ${dataBr(x.ate)}</td><td class="n">${reais(x.investido)}</td><td class="n">${x.resultados != null ? `${inteiro(x.resultados)} <small>${tipoTxt(x.tipo_resultado, x.resultados)}</small>` : '—'}</td><td class="n">${x.custo_resultado != null ? reais(x.custo_resultado) : '—'}</td></tr>`).join('');
    return `<section class="mdn-bloco"><b class="mdn-bloco-h">Investido por semana no Meta <span>· 8 semanas até ontem</span></b><div class="mdn-grafico">${barras}</div></section>
      <table class="mdn-tab"><thead><tr><th>Semana</th><th class="n">Investido</th><th class="n">Resultado</th><th class="n">Custo por resultado</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }
  const STATUS = { ACTIVE: ['Ativa', 'g'], PAUSED: ['Pausada', 'n'], ARCHIVED: ['Arquivada', 'n'], DELETED: ['Apagada', 'n'], CAMPAIGN_PAUSED: ['Pausada', 'n'], IN_PROCESS: ['Em revisão', 'a'], WITH_ISSUES: ['Com problema', 'r'] };
  function abaCampanhas(c) {
    const f = fichas[chaveDaAba('campanhas', c.id)];
    if (!f || f.estado === 'buscando') return carregandoHtml('Buscando as campanhas');
    if (f.estado === 'falhou') return estadoDoHub({ estado: 'erro', motivo: f.motivo }, 'As campanhas');
    const d = f.dados;
    if (d.estado !== 'ok') return estadoDoHub(d, 'As campanhas');
    if (!d.campanhas.length) return '<div class="mdn-vazio"><b>Nenhuma campanha no período.</b></div>';
    const ativas = d.campanhas.filter((k) => k.status === 'ACTIVE').length;
    const linhas = d.campanhas.map((k) => { const [st, t] = STATUS[k.status] || [k.status ? k.status.toLowerCase() : '—', 'n'];
      const custo = k.resultados ? k.investido / k.resultados : null;
      return `<tr><td><span class="mdn-st ${t}"><i aria-hidden="true"></i>${esc(st)}</span></td><td class="nome">${esc(k.nome)}</td><td class="n">${reais(k.investido)}</td><td class="n">${k.resultados ? `${inteiro(k.resultados)} <small>${tipoTxt(k.tipo_resultado, k.resultados)}</small>` : '—'}</td><td class="n">${custo != null ? reais(custo) : '—'}</td><td class="n${k.frequencia > 3 ? ' alta' : ''}">${k.frequencia != null ? String(k.frequencia).replace('.', ',') : '—'}</td></tr>`; }).join('');
    return `<p class="mdn-txt apagado">${plural(d.campanhas.length, 'campanha', 'campanhas')} em ${estado.dias} dias · ${plural(ativas, 'ativa', 'ativas')}${d.limitado ? ' · mostrando as 25 primeiras' : ''}. Mexer em campanha continua no Gerenciador, com o SIM de um dono.</p>
      <table class="mdn-tab"><thead><tr><th class="st">Status</th><th>Campanha</th><th class="n">Investido</th><th class="n">Resultado</th><th class="n">Custo</th><th class="n">Frequência</th></tr></thead><tbody>${linhas}</tbody></table>`;
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
    return `<div class="d3m-c-folha-cab mdn-ficha-cab"><button type="button" class="d3m-c-btn c mdn-volta" data-md-voltar aria-label="Voltar aos clientes">${IC.volta}Clientes</button>
        <b class="d3m-c-h3 mdn-ficha-nome" role="heading" aria-level="3">${esc(c.nome)}</b></div>
      <div class="mdn-abas d3m-c-abas" role="radiogroup" aria-label="Ficha de mídia">${ABAS.map(([id, t]) => `<button type="button" role="radio" data-md-aba="${id}" aria-checked="${estado.aba === id}">${t}</button>`).join('')}</div>
      <div class="mdn-ficha-corpo" role="region" aria-label="${esc(ABAS.find((a) => a[0] === estado.aba)?.[1] || '')}">${corpo(c)}</div>`;
  }

  // ── A consulta (coluna da direita) ────────────────────────────────────────────────────────────────────────────────
  function laranjaHtml(c) {
    if (c) {
      const d = dadosDe(c.id), tom = d?.estado === 'ok' ? d.sinal?.tom || 'n' : 'n';
      const frase = !metaDe(c.id) || metaDe(c.id).estado === 'buscando' ? 'Lendo o Meta' : d?.estado === 'ok' ? TOM[tom] : d?.estado === 'sem_conta' ? 'Sem conta do Meta' : 'Sem números do Meta';
      const sub = d?.estado === 'ok' ? d.sinal?.motivo || '' : d?.estado === 'sem_conta' ? 'Vincule a conta de anúncios no VybeHub para o Ícaro acompanhar.' : d?.motivo || '';
      return `<section class="d3m-laranja md-laranja" aria-label="O Ícaro sobre ${esc(c.nome)}"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">Í</span>Ícaro · Mídia Paga</span>
        <div class="d3m-lar-txt"><b class="d3-acao-frase">${esc(frase)}</b><small class="d3m-c-s">${esc(sub)}</small></div>
</section>`;
    }
    const t = estado.clientes, prim = linhasVisiveis().find((x) => ['r', 'a'].includes(tomDe(x)));
    const buscando = t.filter((x) => !metaDe(x.id) || metaDe(x.id).estado === 'buscando').length, fora = hubFora();
    const frase = fora ? 'Sem números do Meta agora' : prim ? `${esc(prim.nome)} · ${TOM[tomDe(prim)].toLowerCase()}` : buscando ? 'Lendo o Meta de cada cliente' : 'Nenhum cliente pedindo atenção';
    const sub = fora ? (fora === 'desligado' ? 'A ponte com o VybeHub está desligada neste ambiente.' : 'O VybeHub não respondeu. Tente de novo em instantes.') : prim ? esc(dadosDe(prim.id).sinal.motivo) : buscando ? `Faltam ${buscando}.` : `No período de ${estado.dias} dias, tudo dentro do esperado.`;
    return `<section class="d3m-laranja md-laranja" aria-label="O que pede atenção"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">Í</span>Ícaro · Mídia Paga</span>
      <div class="d3m-lar-txt"><b class="d3-acao-frase">${frase}</b><small class="d3m-c-s">${sub}</small></div>
      ${prim && !fora ? `<div class="d3m-lar-bts"><button type="button" class="d3m-btn l" data-md-linha="${esc(prim.id)}">Ver o cliente</button></div>` : ''}</section>`;
  }
  function canaisDaCarteira() {
    const t = estado.clientes, prontos = t.filter((c) => metaDe(c.id)?.estado === 'pronto');
    const comMeta = prontos.filter((c) => !['sem_conta', 'erro', 'desligado'].includes(dadosDe(c.id).estado)).length;
    const comSite = t.filter((c) => c.tem_site).length, comGoogle = t.filter((c) => c.google_ads).length;
    const barra = (rot, n, total, tom = '') => `<div class="md-canal"><span>${rot}</span><span class="d3m-vbarra ${tom}"><i style="--v:${total ? Math.round((n / total) * 100) : 0}%"></i></span><b>${n} de ${total}</b></div>`;
    return `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Canais conectados</b><span>${plural(t.length, 'cliente', 'clientes')}</span></div><div class="md-canais">
      ${barra('Meta Ads', comMeta, prontos.length || t.length)}${barra('Google Ads (ID)', comGoogle, t.length, 'n')}${barra('Site', comSite, t.length, 'n')}</div>
      <p class="md-nota">Abra um cliente para adicionar o site e o ID do Google Ads. A leitura dos números do Google Ads e a análise do site ainda não estão ligadas.</p></div>
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>Como o Ícaro trabalha</b></div><p class="md-nota">Lê todos os canais, aponta o que pede atenção e propõe. Criar, pausar ou mudar verba só com o SIM de um dono, e tudo nasce pausado.</p></div>`;
  }
  // Os canais do cliente aberto: o Meta (com o caminho para vincular), o Google Ads e o site, com os campos de conectar.
  function canaisDoCliente(c) {
    const d = dadosDe(c.id), aviso = estado.aviso;
    const msg = (canal) => (aviso?.canal === canal ? `<p class="mdn-msg ${aviso.ok ? 'ok' : 'erro'}" role="${aviso.ok ? 'status' : 'alert'}">${esc(aviso.texto)}</p>` : '');
    const form = (canal, rot, valor, dica, tipo) => `<form class="mdn-form" data-md-form="${canal}" novalidate><input data-md-campo="${canal}" type="${tipo}" aria-label="${rot}" title="${rot}" inputmode="${canal === 'google_ads' ? 'numeric' : 'url'}" autocomplete="off" placeholder="${dica}" value="${esc(valor)}" ${estado.salvando === canal ? 'disabled' : ''}>
      <button type="submit" class="d3m-c-btn" ${estado.salvando === canal ? 'disabled' : ''}>${estado.salvando === canal ? 'Salvando' : 'Salvar'}</button>${valor ? '<button type="button" class="d3m-c-btn v" data-md-cancelar>Cancelar</button>' : ''}</form>`;
    const meta = !d ? '<p class="md-nota">Lendo do VybeHub.</p>' : d.estado === 'ok' ? '<p class="md-nota">Lendo do VybeHub, pela mesma ponte do bot.</p>'
      : d.estado === 'sem_conta' ? `<p class="md-nota">Sem conta de anúncios vinculada. A conta do Meta do cliente mora no VybeHub: vincule lá e os números aparecem aqui.</p><span class="mdn-form-bts"><a class="d3m-c-btn v" href="${esc(estado.hubUrl)}/admin" target="_blank" rel="noopener">Vincular no VybeHub ${IC.fora}</a></span>`
      : `<p class="md-nota">${esc(d.motivo || 'O VybeHub não respondeu agora.')}</p>`;
    const google = estado.editando === 'google_ads' || !c.google_ads ? form('google_ads', 'ID da conta do Google Ads', c.google_ads, '123-456-7890', 'text')
      : `<p class="mdn-valor"><b>${esc(c.google_ads)}</b><span>ID salvo. A leitura dos números ainda não está ligada.</span></p><span class="mdn-form-bts"><a class="d3m-c-btn v" href="https://ads.google.com/aw/overview" target="_blank" rel="noopener" title="Abre o Google Ads; escolha a conta ${esc(c.google_ads)}">Abrir ${IC.fora}</a><button type="button" class="d3m-c-btn v" data-md-editar="google_ads">Editar</button><button type="button" class="d3m-c-btn v" data-md-apagar="google_ads">Tirar</button></span>`;
    const site = estado.editando === 'site' || !c.site ? form('site', 'Endereço do site', c.site, 'cliente.com.br', 'text')
      : `<p class="mdn-valor"><a href="${esc(c.site)}" target="_blank" rel="noopener">${esc(dominio(c.site))} ${IC.fora}</a><span>A análise do site ainda não tem fonte: falta ligar o Google Analytics (GA4) do cliente.</span></p><span class="mdn-form-bts"><button type="button" class="d3m-c-btn v" data-md-editar="site">Editar</button><button type="button" class="d3m-c-btn v" data-md-apagar="site">Tirar</button></span>`;
    return `<div class="d3m-cons mdn-canais"><div class="d3m-cons-cab"><b>Canais deste cliente</b><span>só donos</span></div>
      <section class="mdn-canal" aria-label="Meta Ads"><b class="mdn-canal-h"><span class="md-sinal ${d?.estado === 'ok' ? 'g' : 'n'}" aria-hidden="true"><i></i></span>Meta Ads</b>${meta}</section>
      <section class="mdn-canal" aria-label="Google Ads"><b class="mdn-canal-h"><span class="md-sinal n" aria-hidden="true"><i></i></span>Google Ads</b>${google}${msg('google_ads')}</section>
      <section class="mdn-canal" aria-label="Site"><b class="mdn-canal-h"><span class="md-sinal n" aria-hidden="true"><i></i></span>Site</b>${site}${msg('site')}</section></div>`;
  }
  function ladoHtml() {
    if (estado.carregando || estado.erro) return '';
    const c = estado.ficha ? clienteDe(estado.ficha) : null;
    return laranjaHtml(c) + (c ? canaisDoCliente(c) : canaisDaCarteira());
  }
  function pintarLado() { const l = janela?.querySelector('#md-lado'); if (l) l.innerHTML = ladoHtml(); }

  function subtitulo(n) {
    return estado.carregando ? 'buscando os clientes' : estado.erro ? 'não foi possível buscar' : `${estado.dias} dias até ontem · ${plural(n.todos, 'cliente', 'clientes')}${n.acao ? ` · ${n.acao} ${n.acao === 1 ? 'pede' : 'pedem'} atenção` : ''}`;
  }
  function folhaListaHtml() {
    const n = contagem();
    const ficha = (id, t) => `<button type="button" role="radio" data-md-filtro="${id}" aria-checked="${estado.filtro === id}">${t} <b>${n[id]}</b></button>`;
    return `<div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">Clientes <span>· canal por canal</span></b>
        <span class="d3m-c-abas" role="radiogroup" aria-label="Mostrar">${ficha('todos', 'Todos')}${ficha('acao', 'Pedem atenção')}${ficha('sem', 'Sem conta Meta')}</span></div>
      <div class="mdn-cab" aria-hidden="true"><span></span><span>Cliente</span><span>Meta · investido</span><span>Meta · resultado</span><span>Google Ads</span><span>Site</span><span></span></div>
      <div id="md-lista" class="mdn-lista">${listaHtml()}</div>`;
  }
  // Repinta só a lista, os números e a consulta (o Meta de cada cliente chegando); a ficha aberta repinta o Resumo e o lado.
  function pintarLista() {
    if (!janela) return;
    const n = contagem();
    const sub = janela.querySelector('.d3m-c-sub'); if (sub) sub.textContent = subtitulo(n);
    const nums = janela.querySelector('.mdn-nums'); if (nums && !estado.carregando && !estado.erro) nums.outerHTML = numerosHtml();
    if (estado.ficha) {
      if (estado.aba === 'resumo') { const corpo = janela.querySelector('.mdn-ficha-corpo'), c = clienteDe(estado.ficha); if (corpo && c) corpo.innerHTML = abaResumo(c); }
      // Não repinta o lado com alguém digitando no campo de conectar.
      if (!janela.querySelector('#md-lado')?.contains(document.activeElement)) pintarLado();
      return;
    }
    const alvo = janela.querySelector('#md-lista');
    if (!alvo) return pintar();
    alvo.innerHTML = listaHtml();
    janela.querySelectorAll('[data-md-filtro]').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.mdFiltro === estado.filtro)); const x = b.querySelector('b'); if (x) x.textContent = n[b.dataset.mdFiltro]; });
    pintarLado();
  }
  function pintar() {
    if (!janela) return;
    const n = contagem(), c = estado.ficha ? clienteDe(estado.ficha) : null;
    const titulo = typeof window.d3mcTrocaHtml === 'function' ? window.d3mcTrocaHtml('Mídia', 'midia', 'midia') : '<b class="d3m-c-h" role="heading" aria-level="2">Mídia</b>';
    const seg = `<span class="d3m-c-seg" role="radiogroup" aria-label="Período">${[7, 30].map((d) => `<button type="button" role="radio" data-md-dias="${d}" aria-checked="${estado.dias === d}">${d} dias</button>`).join('')}</span>`;
    const foco = document.activeElement?.id === 'md-busca';
    janela.classList.toggle('mdn-com-ficha', Boolean(c));
    janela.innerHTML = `<div class="d3m-c-topo"><div class="d3m-c-tit">${titulo}<span class="d3m-c-sub">${esc(subtitulo(n))}</span></div>${seg}
        <label class="d3m-c-busca" title="Buscar cliente">${IC.lupa}<input id="md-busca" type="search" aria-label="Buscar cliente" autocomplete="off" placeholder="Buscar cliente" data-md-busca value="${esc(estado.busca)}"></label>
        <button type="button" class="d3m-c-ico" data-md-fechar aria-label="Fechar" title="Fechar">${IC.x}</button></div>
      ${estado.carregando || estado.erro ? '' : numerosHtml()}
      <div class="d3m-c-corpo md-corpo"><section class="d3m-c-folha md-folha${estado.carregando || estado.erro ? '' : ' mdn-pronto'}" aria-label="${c ? `Mídia de ${esc(c.nome)}` : 'Mídia por cliente'}">${c ? fichaHtml(c) : folhaListaHtml()}</section>
        <aside id="md-lado" class="d3m-lado" aria-label="Consulta">${ladoHtml()}</aside></div>`;
    if (foco && !c) { const b = janela.querySelector('#md-busca'); b?.focus(); try { b?.setSelectionRange(b.value.length, b.value.length); } catch { /* sem seleção */ } }
  }

  function abrirFicha(id) {
    if (!clienteDe(id)) return;
    estado.ficha = id; estado.aba = 'resumo'; estado.editando = ''; estado.aviso = null;
    pintar(); buscarDaAba();
    janela.querySelector('.mdn-volta')?.focus();
  }
  function voltarALista() {
    const id = estado.ficha;
    estado.ficha = ''; estado.editando = ''; estado.aviso = null; pintar();
    janela.querySelector(`.mdn-nome[data-md-linha="${CSS.escape(id)}"]`)?.focus();
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
    if (!estado.erro) { buscarMetas(); buscarDaAba(); }
  }
  // De 4 em 4: cada cliente leva alguns segundos no Hub. O que chega repinta só a lista, os números e a consulta.
  // Com a ponte desligada não pergunta a ninguém: cada cliente já fica como "ponte desligada".
  async function buscarMetas() {
    const dias = estado.dias, minha = geracao;
    const mapa = (metas[dias] ||= {});
    if (!estado.hubAtivo) { estado.clientes.forEach((c) => { mapa[c.id] ||= { estado: 'pronto', dados: { estado: 'desligado', motivo: 'A ponte com o VybeHub está desligada neste ambiente.' }, registros: [] }; }); return pintarLista(); }
    // A ficha aberta vai primeiro na fila.
    const fila = estado.clientes.filter((c) => !mapa[c.id]).sort((a, b) => (b.id === estado.ficha) - (a.id === estado.ficha));
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
  // O que a aba aberta precisa (Histórico, Campanhas, Resumo da semana), uma vez por cliente (e período, nas campanhas).
  async function buscarDaAba() {
    const id = estado.ficha, aba = estado.aba, chave = chaveDaAba();
    if (!id || !chave || fichas[chave]) return;
    if (!estado.hubAtivo) { fichas[chave] = { estado: 'pronto', dados: { estado: 'desligado' } }; return repintarAba(aba, id); }
    fichas[chave] = { estado: 'buscando' };
    const acao = aba === 'historico' ? 'historico' : aba === 'campanhas' ? `campanhas&dias=${estado.dias}` : 'semana';
    try { fichas[chave] = { estado: 'pronto', dados: await lerJson(`/api/painel?area=midia&acao=${acao}&cliente_id=${encodeURIComponent(id)}`) }; }
    catch (e) { fichas[chave] = { estado: 'falhou', motivo: e.message }; }
    repintarAba(aba, id);
  }
  function repintarAba(aba, id) {
    if (!janela || janela.hidden || estado.ficha !== id || estado.aba !== aba) return;
    const corpo = janela.querySelector('.mdn-ficha-corpo'), c = clienteDe(id);
    if (corpo && c) corpo.innerHTML = { historico: abaHistorico, campanhas: abaCampanhas, semana: abaSemana }[aba](c);
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
    if (!estado.clientes.length || estado.erro) carregar(); else { pintar(); buscarMetas(); buscarDaAba(); }
  }
  function fechar() { if (janela) janela.hidden = true; document.body.classList.remove('mundo-midia'); }

  // aberto: o dock (remarcarAoFechar em vybe-mundo.js) pergunta antes de acender o Hoje no lugar da Mídia.
  window.VybeMidia = { abrir, fechar, aberto: () => Boolean(janela && !janela.hidden) };
})();
