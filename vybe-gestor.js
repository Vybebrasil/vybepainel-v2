// vybe-gestor.js — modo gestor: dias, cards de cliente, filtros, KPIs e central operacional
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Construir array de dias ──────────────────────────────────────────────────
function buildDias(startIso, endIso, hojeIso) {
  const dias = [];
  const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let cur = new Date(startIso + 'T12:00:00');
  const end = new Date(endIso + 'T12:00:00');
  while (cur <= end) {
    const iso = cur.toISOString().slice(0,10);
    dias.push({ iso, label: labels[cur.getDay()], num: String(cur.getDate()).padStart(2,'0'), hoje: iso === hojeIso });
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusCls(s) {
  const m = {
    "Agendado":"agendado","Pode Fazer":"pode-fazer","Falta D.A":"falta-da",
    "A Fazer":"a-fazer","Aguardo":"aguardo","Finalizado":"finalizado",
    "Para agendar":"para-agendar","Em andamento":"em-andamento","Em Andamento":"em-andamento",
    "Para aprovação":"para-aprovacao","Ag. Aprovação Cliente":"ag-aprovacao",
    "Ag. Info Cliente":"ag-info","Falta Info":"falta-info",
    "Alteração":"alteracao","Ag. Interno":"ag-interno","Cap. Agendada":"cap-agendada",
    "Agendando Cap":"agendando-cap","Agendando Cap.":"agendando-cap",
    "Falta OFF":"falta-off","Aguardo Redação":"aguardo-redacao",
    "Segurar Post":"segurar-post"
  };
  return m[s] || "default";
}
function fmtCls(f) { return (f||"").toLowerCase().replace(/[^a-z]/g,"") || "default"; }
function validStatusColor(color) { return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : ''; }
function hexToRgb(hex) {
  const normalized = validStatusColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}
function statusInlineStyle(color, border) {
  const hex = validStatusColor(color);
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  const borderHex = validStatusColor(border) || hex;
  // --st leva a cor do quadro (vybe_status.cor) para o tema claro do mundo escurecer o texto sem trocar a cor (auditoria 09/11, A5).
  return ` style="--st:${hex};background:rgba(${rgb.r},${rgb.g},${rgb.b},.15);color:${hex};border-color:${borderHex};"`;
}
function statusDotInlineStyle(color) {
  const hex = validStatusColor(color);
  return hex ? ` style="background:${hex};"` : '';
}
// ── as peças de uma atividade, uma implementação de cada ─────────────────────
//
// Cada aba montava a sua própria linha, e por isso a mesma informação aparecia
// de jeitos diferentes — ou não aparecia. Na fila da semana o responsável era
// uma bolinha com foto; na fila de demandas, o primeiro nome em texto. O status
// era clicável num lugar e só enfeite no outro. O ID não aparecia em lugar
// nenhum.
//
// Aqui mora UMA implementação de cada peça. As telas continuam livres para
// arrumá-las como couber no espaço delas — uma tabela larga e uma coluna
// estreita não têm por que ter o mesmo formato —, mas a peça é a mesma.

// ─── O LINK DA ATIVIDADE ─────────────────────────────────────────────────────
//
// Mandar uma peca no grupo do WhatsApp so dava para fazer por descricao — "a do
// DiaCenter, aquele card da familia" — ou copiando o numero do id, que nao abre
// nada sozinho. O link abre a peca direto, em qualquer maquina que tenha sessao.
//
// Uma implementacao so, usada pelo cartao rapido e pela gaveta: eram justamente
// esses dois lugares que ja tinham cada um a sua copia do botao de copiar id.
function linkDaAtividade(id) {
  return `${location.origin}${location.pathname}?atividade=${encodeURIComponent(String(id))}`;
}
async function copiarLinkDaAtividade(id, botao) {
  const link = linkDaAtividade(id);
  try {
    await navigator.clipboard.writeText(link);
    // O botão só de ícone (gaveta, quadro 06) mostra o visto no lugar do desenho, sem mudar de largura.
    const visto = '<svg class="icone-linha" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3.5 8.4 2.9 2.9 6.1-6.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only">Link copiado</span>';
    if (botao) { const antes = botao.innerHTML; botao.innerHTML = botao.classList.contains('so-icone') ? visto : '✓ copiado';
      setTimeout(() => { botao.innerHTML = antes; }, 1600); }
    showToast('✓ Link copiado · quem abrir cai direto nesta atividade', 'ok', 4000);
  } catch { showToast(link, 'info', 12000); }
}
// icone: só o desenho, com o nome para o leitor de tela e a dica ao passar o mouse (gaveta, quadro 06 do redesign).
function botaoDeLinkHtml(item, { icone = false } = {}) {
  if (!item?.id) return '';
  return `<button type="button" class="vybe-link${icone ? ' so-icone' : ''}" onclick="event.stopPropagation();copiarLinkDaAtividade('${jsArg(item.id)}',this)"
    title="Copiar o link desta atividade para mandar no grupo"${icone ? ' aria-label="Copiar link"' : ''}>${ICONE_LINHA.link}<span${icone ? ' class="sr-only"' : ''}>Copiar link</span></button>`;
}

function vybeChipId(item) {
  if (!item?.id) return '';
  return `<button type="button" class="vybe-id" onclick="event.stopPropagation();copiarId('${jsArg(item.id)}')"
    title="ID da atividade · clique para copiar">#${safeText(item.id)}</button>`;
}

function vybeTagCliente(item) {
  const nome = clientesDoItem(item).join(' · ');
  if (!nome || nome === '—') return '';
  return `<span class="vybe-cliente" title="${safeText(nome)}">${safeText(nome)}</span>`;
}

// Status sempre clicável: era pílula morta na fila de demandas e no modo
// reunião, e trocar exigia abrir a peça.
function vybeStatus(item) {
  if (typeof pv2Ligado === 'function' && pv2Ligado()) return pv2StatusBotao(item);
  const rotulo = item?.status || 'Sem status';
  const pill = pillHtml(rotulo, item?.status_color, item?.status_border);
  return `<button type="button" class="vybe-status-btn"
    onclick="openStatusEditor(event,'${jsArg(item.id)}')"
    title="Trocar status de ${safeText(item.nome || 'atividade')}">${pill}</button>`;
}

// ─── Ícones ───────────────────────────────────────────────────────────────────
// O painel desenhava ferramenta com caractere de texto: ✎ para renomear, ◐ para
// cor, ◉/○ para ligado. Glifo de texto muda de forma conforme a fonte instalada
// e não tem peso constante — é metade do ar de sistema antigo. Traço de 1.6 e
// ponta arredondada, o mesmo em todos.
const ICONE = Object.freeze({
  lapis: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2 2.6a1.4 1.4 0 0 1 2 2L6 11.8l-2.7.9.9-2.7z"/></svg>',
  gota:  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2s3.6 3.9 3.6 6.3a3.6 3.6 0 0 1-7.2 0C4.4 6.1 8 2.2 8 2.2z"/></svg>',
  lixo:  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.3h10.4M6.4 4.3V3.1h3.2v1.2M4.3 4.3l.6 8.2h6.2l.6-8.2M6.7 6.7v3.6M9.3 6.7v3.6"/></svg>',
  fechar:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/></svg>',
  // Ordenar mostra as duas pontas quando ninguem ordenou por ali, e so a ponta
  // que vale quando ordenou — a direcao e a informacao.
  ordenar:'<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.6 8 3.6l3 3M5 9.4l3 3 3-3"/></svg>',
  sobe:  '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 9.8 8 6.2l3.6 3.6"/></svg>',
  desce: '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 6.2 8 9.8l3.6-3.6"/></svg>',
});

function vybeDono(item, className = '', opcoes = {}) {
  return ownerEditorTrigger(item, className, opcoes);
}

function vybeData(item) {
  const iso = typeof getDateIso === 'function' ? getDateIso(item) : (item?.veiculacao_iso || item?.prazo_iso || '');
  const curta = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso.slice(8,10)}/${iso.slice(5,7)}` : '—';
  const atrasado = item?.prazo_atrasado && dateMode === 'prazo';
  return `<span class="vybe-data${atrasado ? ' atrasado' : ''}">${curta}</span>`;
}

function vybeNome(item) {
  return `<button type="button" class="vybe-nome" onclick="openItemWorkspace('${jsArg(item.id)}')"
    title="${safeText(item.nome || '')}">${safeText(item.nome || 'Sem título')}</button>`;
}

// ── uma cor por rótulo, para o painel inteiro ────────────────────────────────
//
// A mesma etiqueta saía de cores diferentes dependendo da tela: quem chamava
// pillHtml sem cor caía numa classe de CSS com a cor escrita à mão, e quem
// chamava com cor usava a do catálogo. 'Alteração' era roxo num painel e
// vermelho no outro, e ninguém tinha combinado nenhum dos dois.
//
// Agora a cor vem sempre do catálogo — o mesmo que o Monday devolve e que
// alimenta o banco. Quem passar cor explícita continua mandando; quem não
// passar, recebe a do catálogo em vez da inventada no CSS.
function corDeStatus(rotulo) {
  const alvo = String(rotulo || '').trim().toLowerCase();
  if (!alvo) return null;
  const listas = [
    typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : [],
    typeof requestStatusOptions === 'function' ? requestStatusOptions({}) : [],
  ];
  for (const lista of listas) {
    const achou = (lista || []).find((o) => String(o.label || '').trim().toLowerCase() === alvo);
    if (achou?.color) return { cor: achou.color, borda: achou.border || achou.color };
  }
  return null;
}

// Formato, tipo de conteúdo, OFF e prioridade também têm cor no catálogo, e
// também eram pintados por classe de CSS escrita à mão.
function corDeOpcao(rotulo, colunaId) {
  const alvo = String(rotulo || '').trim().toLowerCase();
  if (!alvo) return null;
  const doCatalogo = (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
    .find((o) => o.coluna_id === colunaId && String(o.rotulo || '').trim().toLowerCase() === alvo);
  if (doCatalogo?.cor) return { cor: doCatalogo.cor, borda: doCatalogo.borda || doCatalogo.cor };

  // Coluna de STATUS no Monday tem cor por etiqueta; coluna DROPDOWN não tem
  // nenhuma — e Formato, Tipo de conteúdo e Tipo de demanda são dropdown. Eram
  // as 29 opções que o painel pintava por uma tabela escrita à mão no CSS, e é
  // por isso que a mesma etiqueta mudava de cor entre telas.
  //
  // Sem cor de origem, ela sai da POSIÇÃO da etiqueta no catálogo da coluna:
  // as opções se espalham pelo círculo de cor, então nove formatos ficam a 40°
  // um do outro em vez de amontoados. Determinístico e sem lista para manter.
  // Mais dessaturado que status de propósito: status é a informação, formato é
  // o contexto, e não devem disputar o olho.
  return corPorPosicao(alvo, colunaId);
}

function corPorPosicao(alvo, colunaId) {
  const lista = (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
    .filter((o) => o.coluna_id === colunaId)
    .sort((a, b) => Number(a.indice ?? 0) - Number(b.indice ?? 0));
  const i = lista.findIndex((o) => String(o.rotulo || '').trim().toLowerCase() === alvo);
  if (i < 0 || !lista.length) return corDoRotulo(alvo);
  // Cada coluna começa num ponto diferente do círculo, senão Formato e Tipo de
  // conteúdo sairiam com a mesma paleta e pareceriam a mesma informação.
  const fase = (colunaId || '').split('').reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);
  const h = Math.round((fase + (i * 360) / lista.length) % 360);
  return { cor: hslParaHex(h, 44, 66), borda: hslParaHex(h, 44, 50) };
}

function corDoRotulo(texto) {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return null;
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  h = Math.abs(Math.imul(h, 2654435761)) % 360;
  return { cor: hslParaHex(h, 44, 66), borda: hslParaHex(h, 44, 50) };
}

function hslParaHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const canal = (n) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${canal(0)}${canal(8)}${canal(4)}`;
}

function pillHtml(s, color='', border='') {
  const doCatalogo = color ? null : corDeStatus(s);
  const cor = color || doCatalogo?.cor || '';
  // No mundo (padrão v2): pílula clara com a bolinha na cor do status; cheia só no que pede atenção (pv2Tom).
  if (pv2Ligado()) return `<span class="pill vv-st-ponto ${pv2Tom(s)}"${cor ? ` style="--st:${safeText(cor)}"` : ''}><i aria-hidden="true"></i>${safeText(s)}</span>`;
  const bordaFinal = border || doCatalogo?.borda || '';
  return `<span class="pill pill-${statusCls(s)}"${statusInlineStyle(cor, bordaFinal)}><span class="pill-dot"${statusDotInlineStyle(cor)}></span>${safeText(s)}</span>`;
}
function managerStatusControl(item, { comTempo = true } = {}) {
    const label = `Alterar status de ${safeText(item.nome || 'atividade')} no Vybe OS`;
    const cor = item.status_color || (typeof corDeStatus === 'function' ? corDeStatus(item.status)?.cor : '') || '';
    // No mundo, a pílula do padrão v2 com a setinha (quadro Status); no tema antigo, a de sempre.
    const pill = pv2Ligado() ? pv2StatusBotao(item) : `<button type="button" class="manager-status-control" onclick="openStatusEditor(event,'${item.id}')" title="${label}" aria-label="${label}">${pillHtml(item.status, cor, item.status_border)}</button>`;

    if (!comTempo || !item.status_updated_at || ['Finalizado', 'Agendado', 'Para agendar'].includes(item.status)) {
        return pill;
    }
    if (pv2Ligado()) return `<span class="pv2-st-com-tempo">${pill}<span class="live-timer pv2-st-tempo" data-start="${safeText(item.status_updated_at)}" title="Tempo neste status" onclick="event.stopPropagation()">00:00:00</span></span>`;

    const isRunning = item.status === 'Em andamento';
    const color = isRunning ? '#00f0ff' : '#9cafba';
    const border = isRunning ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.08)';
    const bg = isRunning ? 'rgba(0,240,255,0.05)' : 'rgba(255,255,255,0.02)';
    
    const timerHtml = `<span class="live-timer" data-start="${item.status_updated_at}" style="margin-left:8px;padding:4px 8px;border-radius:6px;background:${bg};color:${color};font:600 11px var(--mac-mono, monospace);letter-spacing:1px;border:1px solid ${border};display:inline-flex;align-items:center;vertical-align:middle;cursor:default;box-shadow:${isRunning?'0 0 10px rgba(0,240,255,0.1)':'none'};" onclick="event.stopPropagation()">00:00:00</span>`;
    
    return `<div style="display:inline-flex;align-items:center;">${pill}${timerHtml}</div>`;
  }
function syncStatusLegendColors(rootSelector, items) {
  const colors = new Map();
  items.forEach(item => {
    const color = validStatusColor(item.status_color);
    if (item.status && color && !colors.has(item.status)) {
      colors.set(item.status, { color, border: validStatusColor(item.status_border) || color });
    }
  });
  document.querySelectorAll(`${rootSelector} .pill`).forEach(el => {
    const action = el.getAttribute('onclick') || '';
    const match = action.match(/'([^']+)'/);
    const style = match ? colors.get(match[1]) : null;
    if (!style) return;
    const rgb = hexToRgb(style.color);
    el.style.background = `rgba(${rgb.r},${rgb.g},${rgb.b},.15)`;
    el.style.color = style.color;
    el.style.borderColor = style.border;
    const dot = el.querySelector('.pill-dot');
    if (dot) dot.style.background = style.color;
  });
}
const FMT_ICONS = {};
function fmtHtml(f) {
  // Sem formato não existe etiqueta: '—' dentro de uma cápsula parece um valor.
  if (!f || String(f).trim() === '' || String(f).trim() === '—') return '<span class="fmt-vazio">—</span>';
  const c = corDeOpcao(f, 'lista_suspensa0__1') || corDeOpcao(f, 'dropdown_mkv8d52z');
  return `<span class="fmt fmt-${fmtCls(f)}"${statusInlineStyle(c?.cor || '', c?.borda || '')}>${safeText(f)}</span>`;
}
function firstName(n) { if(!n||n==="—") return "—"; return n.split(",")[0].trim().split(" ")[0]; }
function respBadgeHtml(name) {
  if (!name || name === '—') return '<span class="item-resp">—</span>';
  const first = name.split(',')[0].trim().split(' ')[0];
  const user = (typeof TEAM_USERS !== 'undefined') ? TEAM_USERS.find(u => u.name.toLowerCase().startsWith(first.toLowerCase())) : null;
  if (user && user.photo) return `<img class="item-resp-photo" src="${user.photo}" loading="lazy" decoding="async" title="${first}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ${user.color};" onerror="this.outerHTML='<span class=item-resp-badge style=background:${user.color} title=${first}>${first.slice(0,2).toUpperCase()}</span>'"/>`;
  const color = user ? user.color : '#6b7280';
  return `<span class="item-resp-badge" style="background:${color}" title="${first}">${first.slice(0,2).toUpperCase()}</span>`;
}
function ownerAssignedIds(item={}) { const listed=Array.isArray(item.responsavel_ids)?item.responsavel_ids:[]; return [...new Set([...listed,item.responsavel_id].filter(Boolean).map(String))]; }
function ownerUsersFor(item={}) { const ids=ownerAssignedIds(item); const users=(typeof TEAM_USERS==='undefined'?[]:TEAM_USERS).filter(user=>ids.includes(String(user.id))); if(users.length) return users; const names=String(item.responsavel||'').split(',').map(name=>name.trim().toLowerCase()).filter(Boolean); return (typeof TEAM_USERS==='undefined'?[]:TEAM_USERS).filter(user=>names.some(name=>name.startsWith(user.name.toLowerCase()) || user.name.toLowerCase().startsWith(name))); }
function ownerFormatKind(item={}) { const format=String(item.formato||item.tipo||item.formato_conteudo||'').toLowerCase(); const title=String(item.nome||'').toLowerCase(); const signal=`${format} ${title}`; if(/motion/.test(signal)) return 'motion'; if(/reels|vídeo|video/.test(signal)) return 'audiovisual'; if(/card|carrossel|feed|story|fotografia/.test(signal)) return 'design'; return ''; }
function ownerEligibility(item={}) { const status=String(item.status||'').trim().toLowerCase(); const kind=ownerFormatKind(item); const lookup=(ids=[])=>TEAM_USERS.filter(user=>ids.includes(String(user.id))); if(['para agendar','agendado'].includes(status)) return {kind:'publicacao',label:'Publicação / Agendamento',users:lookup(EQUIPES.publicacao),rule:'Nesta etapa, Tainara, Paulo ou Vinícius podem assumir a responsabilidade operacional de publicação e agendamento.'}; if(['para aprovação','ag. aprovação cliente','ag. interno'].includes(status)) { if(kind==='audiovisual') return {kind:'aprovacao audiovisual',label:'Aprovação audiovisual',users:lookup(EQUIPES.aprovacaoAudiovisual),rule:'Conteúdo audiovisual segue para a fila de aprovação de Paulo, Vinícius ou Ewerton.'}; if(kind==='design') return {kind:'direcao de arte',label:'Direção de Arte',users:lookup([PESSOAS.DEIVID]),rule:'Peças de Design em aprovação ficam sob a direção de arte de Deivid.'}; }
  if(kind==='motion') return {kind,label:'Motion · coparticipação obrigatória',users:lookup(EQUIPES.motion),rule:'Motion exige Reriston no audiovisual e mantém Deivid e Bia na direção e no Design & Edição.'}; if(kind==='audiovisual') return {kind,label:'Audiovisual',users:lookup(EQUIPES.audiovisual),rule:'Reels e Vídeos permanecem com Reriston na disciplina Audiovisual.'}; if(kind==='design') return {kind,label:'Design',users:lookup(EQUIPES.design),rule:'Cards, Carrosséis, Feed, Story e Fotografia permanecem com Deivid, Beatriz e Jady na disciplina Design.'}; return {kind:'indefinido',label:'Classificação pendente',users:[],rule:'Defina o formato da atividade antes de atribuir responsáveis.'}; }
function ownerAvatarHtml(user) { const name=safeText(firstName(user?.name||'Sem responsável')); const initial=safeText(name.slice(0,2).toUpperCase()); return user?.photo?`<img src="${user.photo}" alt="${name}" loading="lazy" decoding="async" style="border-color:${user.color||'#6b7280'}" onerror="this.outerHTML='<span class=owner-avatar-fallback style=background:${user.color||'#6b7280'}>${initial}</span>'">`:`<span class="owner-avatar-fallback" style="background:${user?.color||'#6b7280'}">${initial}</span>`; }
// comNome: no cartão de resumo a foto sozinha não dizia quem é — as outras linhas
// mostram texto. O primeiro nome vai ao lado, dentro do mesmo botão.
function ownerEditorTrigger(item, className='', { comNome = false } = {}) { const owners=ownerUsersFor(item); const title=owners.length?`Gerenciar responsáveis: ${owners.map(user=>user.name).join(', ')}`:'Adicionar responsável'; const naGaveta=/gv2-dono/.test(className); const visual=owners.length?owners.slice(0,3).map(u=>naGaveta?ownerAvatarHtml(u).replace(/^<(img|span)/,`<$1 data-vt="dono-${safeText(String(u.id))}"`):ownerAvatarHtml(u)).join('')+(owners.length>3?`<span class="owner-avatar-fallback" style="background:#465363">+${owners.length-3}</span>`:''):`<span class="owner-avatar-add">+</span>`; return `<button type="button" class="owner-editor-trigger ${className}" onclick="openOwnerEditor(event,'${item.id}')" title="${safeText(title)}" aria-label="${safeText(title)}"><span class="owner-avatar-stack">${visual}</span>${comNome ? `<span class="owner-nomes">${safeText(owners.length ? owners.map(user=>firstName(user.name)).join(', ') : 'Adicionar')}</span>` : ''}</button>`; }
let pendingOwnerEditorItemId='';
// A disciplina diz quem normalmente assume; não é uma tranca. Quem manda no
// painel precisa poder colocar alguém de fora — botar Paulo numa peça de Design,
// por exemplo — sem sair do painel para fazer isso no Monday. Então a regra vira
// o padrão visível, e o time todo fica a um clique, marcado como fora dela.
let donoSelecionados = new Set();
let donoMostraTimeTodo = false;

// Menu de responsável (quadro 23 do redesign, 10/11/2026): busca no topo, quem já está na peça e a disciplina
// primeiro, e o resto do time recolhido em "+ N fora da disciplina". A disciplina continua informando, não
// trancando: a busca acha qualquer pessoa do time, e escolher fora dela segue indo para o histórico.
let donoBusca = '';
const semAcentoDoDono = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function gruposDoSeletorDeDono(item, rule) {
  const todos = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS);
  const jaNoItem = ownerUsersFor(item);
  const unicos = (lista) => [...new Map(lista.map((u) => [String(u.id), u])).values()];
  const base = unicos([...jaNoItem, ...rule.users]);
  const dentro = new Set(base.map((u) => String(u.id)));
  return { base, fora: todos.filter((u) => !dentro.has(String(u.id))) };
}

function pessoasDoSeletorDeDono(item, rule) {
  const { base, fora } = gruposDoSeletorDeDono(item, rule);
  const termo = semAcentoDoDono(donoBusca).trim();
  // Buscando, vale o time inteiro; sem disciplina definida, também (não há o que recolher).
  if (termo) return [...base, ...fora].filter((u) => semAcentoDoDono(u.name).includes(termo));
  if (!donoMostraTimeTodo && rule.users.length) return base;
  return [...base, ...fora];
}

function listaDoSeletorDeDono(item, rule) {
  const pessoas = pessoasDoSeletorDeDono(item, rule);
  if (!pessoas.length) return donoBusca.trim()
    ? `<div class="dono-vazio">Ninguém do time com “${safeText(donoBusca.trim())}”.</div>`
    : '<div class="dono-vazio">Ninguém elegível até o formato ser classificado.</div>';
  const elegiveis = new Set(rule.users.map((u) => String(u.id)));
  return pessoas.map((u) => {
    const marcado = donoSelecionados.has(String(u.id));
    const daRegra = elegiveis.has(String(u.id));
    return `<button type="button" class="dono-pessoa owner-editor-person ${marcado ? 'selected' : ''} ${daRegra ? '' : 'fora'}"
      data-owner-id="${u.id}" aria-pressed="${marcado}" onclick="toggleOwnerEditorPerson('${u.id}')">
      ${ownerAvatarHtml(u)}<span class="dono-nome"><b>${safeText(firstName(u.name))}</b>
      <small>${safeText(daRegra ? (rule.label || '') : 'fora da disciplina')}</small></span>
      <span class="owner-editor-person-check" aria-hidden="true">${marcado ? '✓' : ''}</span></button>`;
  }).join('');
}

// O botão do pé da lista: recolhido, conta quem está fora; aberto, volta à disciplina. Buscando ou sem disciplina, some.
function rotuloDoVerTodos(item, rule) {
  if (donoBusca.trim() || !rule.users.length) return '';
  const { fora } = gruposDoSeletorDeDono(item, rule);
  if (!fora.length) return '';
  return donoMostraTimeTodo ? 'Só a disciplina' : `+ ${fora.length} fora da disciplina`;
}

function redesenharListaDeDonos() {
  const item = findOperationalItem(pendingOwnerEditorItemId);
  const lista = document.getElementById('owner-editor-options');
  if (!item || !lista) return;
  const rule = ownerEligibility(item);
  lista.innerHTML = listaDoSeletorDeDono(item, rule);
  const link = document.getElementById('dono-ver-todos');
  if (link) { const r = rotuloDoVerTodos(item, rule); link.textContent = r; link.hidden = !r; }
}

function alternarTimeTodoNoDono() {
  donoMostraTimeTodo = !donoMostraTimeTodo;
  redesenharListaDeDonos();
}

function buscarNoSeletorDeDono(valor) {
  donoBusca = String(valor || '');
  redesenharListaDeDonos();
}

// Esc na busca fecha o balão de uma vez (num campo, o Esc do mundo só tiraria o foco). Enter com um nome só achado
// marca essa pessoa, como quem digita e escolhe.
function teclaNaBuscaDeDono(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeOwnerEditor(); return; }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const achados = document.querySelectorAll('#owner-editor-options [data-owner-id]');
  if (achados.length === 1) toggleOwnerEditorPerson(achados[0].dataset.ownerId);
}

function openOwnerEditor(event, itemId) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  fecharSeletorDeDono();
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Demanda não encontrada.', 'err');
  const rule = ownerEligibility(item);
  pendingOwnerEditorItemId = String(item.id);
  donoSelecionados = new Set(ownerAssignedIds(item));
  // A lista abre com quem está na peça e a disciplina; o resto do time fica a um clique ("+ N fora da disciplina")
  // ou a uma busca (quadro 23 do redesign, 10/11/2026). Antes abria com o time inteiro, doze nomes sem busca, para
  // não custar um clique a quem escolhe fora do comum: a busca resolve isso sem a lista longa.
  // A disciplina informa em vez de impedir: escolher fora dela continua indo para o histórico da peça.
  donoMostraTimeTodo = false;
  donoBusca = '';

  // Era uma caixa no meio da tela, cobrindo tudo, para escolher uma pessoa. É o
  // mesmo popover ancorado dos outros seletores: as bolinhas ficam ao lado do
  // campo que se está mudando, e o resto da tela continua visível.
  const rect = (event?.currentTarget || event?.target)?.getBoundingClientRect()
    || { top: 120, bottom: 140, left: 120, right: 300 };
  const fundo = document.createElement('div');
  fundo.id = 'dono-editor-fundo';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharSeletorDeDono;

  const menu = document.createElement('div');
  menu.id = 'dono-editor';
  menu.className = 'status-editor dono-editor';
  // Quando o clique vai valer para varias, a caixa diz ANTES — descobrir depois
  // que se mexeu em dez pecas e o tipo de surpresa que ninguem perdoa.
  const emLote = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.size >= 2
    && SELECIONADAS.has(String(item.id));
  menu.innerHTML = `<div class="status-editor-head">${emLote
      ? `Responsável · <b>${SELECIONADAS.size} marcadas</b>`
      : safeText(rule.label || 'Responsáveis')}</div>
    ${emLote ? `<p class="dono-regra dono-lote-aviso">O que você escolher aqui vale para as
      ${SELECIONADAS.size} atividades marcadas.</p>` : ''}
    <p class="dono-regra">${safeText(rule.rule || '')}</p>
    <input type="search" id="dono-busca" class="dono-busca" placeholder="Buscar pessoa" aria-label="Buscar pessoa do time"
      autocomplete="off" oninput="buscarNoSeletorDeDono(this.value)" onkeydown="teclaNaBuscaDeDono(event)">
    <div id="owner-editor-options" class="dono-lista">${listaDoSeletorDeDono(item, rule)}</div>
    <button type="button" id="dono-ver-todos" class="dono-ver-todos"${rotuloDoVerTodos(item, rule) ? '' : ' hidden'}
      onclick="alternarTimeTodoNoDono()">${safeText(rotuloDoVerTodos(item, rule))}</button>
    <label class="dono-sem"><input id="owner-editor-empty" type="checkbox"> Pode ficar sem responsável</label>
    <div class="dono-rodape">
      <button type="button" id="owner-editor-save" class="dono-salvar" onclick="saveOwnerAssignments()">Salvar</button>
    </div>`;
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
  // No computador o cursor já vai para a busca; no toque, abrir o teclado por cima da lista atrapalha.
  if (window.matchMedia?.('(hover: hover)').matches) document.getElementById('dono-busca')?.focus({ preventScroll: true });
}

function fecharSeletorDeDono() {
  document.getElementById('dono-editor-fundo')?.remove();
  document.getElementById('dono-editor')?.remove();
}

function toggleOwnerEditorPerson(userId) {
  const id = String(userId);
  if (donoSelecionados.has(id)) donoSelecionados.delete(id); else donoSelecionados.add(id);
  const button = document.querySelector(`#owner-editor-options [data-owner-id="${id}"]`);
  if (!button) return;
  button.classList.toggle('selected', donoSelecionados.has(id));
  button.setAttribute('aria-pressed', String(donoSelecionados.has(id)));
  const check = button.querySelector('.owner-editor-person-check');
  if (check) check.textContent = donoSelecionados.has(id) ? '✓' : '';
}

function closeOwnerEditor() { pendingOwnerEditorItemId=''; fecharSeletorDeDono(); }
function updateLocalOwners(itemId, userIds=[]) { const users=TEAM_USERS.filter(user=>userIds.includes(String(user.id))); const names=users.map(user=>user.name).join(', ') || '—'; [DADOS,DADOS_ALL,DADOS_DEMANDAS].forEach(list=>(list||[]).forEach(item=>{if(String(item.id)!==String(itemId)) return; item.responsavel_ids=[...userIds]; item.responsavel_id=userIds[0]||''; item.responsavel=names;})); }
// Gravar os responsaveis de UMA peca, sem mexer na tela.
//
// O editor de uma peca fecha o popover e redesenha; o lote faz isso uma vez no
// fim, para as dez. Sem separar, ou o lote redesenhava dez vezes ou eu teria uma
// segunda copia da mesma gravacao — e no dia em que o registro no historico
// mudasse, so uma das duas saberia.
const responsaveisEmGravacao = new Set();
async function gravarResponsaveisDaPeca(item, ids) {
  const id = String(item.id);
  if (responsaveisEmGravacao.has(id)) throw new Error('Aguarde a gravação dos responsáveis desta atividade.');
  responsaveisEmGravacao.add(id);
  try {
    const selected = [...new Set(ids.map(String))];
    const rule = ownerEligibility(item);
    const allowed = new Set((rule?.users || []).map((u) => String(u.id)));
    const foraDaRegra = TEAM_USERS.filter((u) => selected.includes(String(u.id)) && !allowed.has(String(u.id)))
      .map((u) => firstName(u.name));
    const before = ownerUsersFor(item).map((u) => u.name).join(', ') || 'Sem responsável';
    const after = TEAM_USERS.filter((u) => selected.includes(String(u.id))).map((u) => u.name).join(', ') || 'Sem responsável';

    const salvo = await tentarEscritaDupla(item, { acao: 'responsaveis', item: id, pessoas: selected });
    if (!salvo) throw new Error('A gravação no banco Vybe não foi confirmada.');
    updateLocalOwners(item.id, selected);
    let logRegistrado = true;
    try {
      await postItemUpdate(item.id, `[Vybe OS · Responsáveis atualizados]\nAnterior: ${before}\nNovo: ${after}\nDisciplina: ${rule?.label || '—'}${foraDaRegra.length ? `\nFora da disciplina: ${foraDaRegra.join(', ')}` : ''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`);
    } catch (erro) { logRegistrado = false; console.warn('Responsáveis atualizados, mas o log não foi registrado.', erro); }
    return { antes: before, depois: after, foraDaRegra, disciplina: rule?.label || '—', logRegistrado };
  } finally { responsaveisEmGravacao.delete(id); }
}

// EDITAR UMA LINHA COM VARIAS MARCADAS APLICA NO LOTE.
//
// Com duas pecas marcadas, tirar alguem de UMA delas mudava so aquela — e a
// pessoa concluia que o lote nao funcionou. Ela nao errou: escolheu duas e
// mexeu numa; o painel e que aplicou pela metade.
//
// A regra ja existia para o PRAZO na mesa de planejamento: 2+ marcadas e a
// linha editada dentro da selecao, entao vale para todas. Aqui era a mesma
// situacao com outra resposta — duas maneiras de o mesmo gesto se comportar.
//
// Editar uma linha FORA da selecao continua valendo so para ela: quem clicou
// numa peca que nao marcou nao pediu nada em lote.
async function saveOwnerAssignments() {
  const item = findOperationalItem(pendingOwnerEditorItemId);
  if (!item) return showToast('Demanda não encontrada.', 'err');
  if (responsaveisEmGravacao.has(String(item.id))) return;
  const emLote = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.size >= 2 && SELECIONADAS.has(String(item.id));
  if (emLote) return salvarResponsaveisDaSelecao(item);
  const selected = [...donoSelecionados];
  if (!selected.length && !document.getElementById('owner-editor-empty')?.checked) {
    return showToast('Escolha um responsável ou confirme que a atividade ficará sem responsável.', 'info');
  }
  const button = document.getElementById('owner-editor-save');
  const drawer = document.getElementById('workspace-drawer');
  if (button) button.disabled = true;
  let confirmado = false;
  armOutboundMutationGuard('responsáveis');
  try {
    const resultado = await gravarResponsaveisDaPeca(item, selected);
    confirmado = true;
    // Uma resposta atrasada não fecha o editor que a pessoa abriu depois.
    if (document.getElementById('owner-editor-save') === button) closeOwnerEditor();
    saveProductionCache(); renderOutboundItemPatch('responsáveis');
    const aviso = !resultado.logRegistrado ? 'Responsáveis salvos; o comentário de disciplina não foi registrado.'
      : resultado.foraDaRegra.length ? `Responsáveis atualizados · ${resultado.foraDaRegra.join(', ')} fora da disciplina ${resultado.disciplina}, registrado no histórico.`
      : 'Responsáveis atualizados.';
    showToast(aviso, !resultado.logRegistrado || resultado.foraDaRegra.length ? 'info' : 'ok');
    await atualizarGavetaPreservandoRascunhos(item, drawer);
  } catch (error) {
    showToast(confirmado ? 'Responsáveis salvos. Não foi possível atualizar todos os detalhes; atualize a tela para conferir.'
      : `Não foi possível atualizar responsáveis: ${error.message}`, confirmado ? 'info' : 'err', 7000);
  } finally { if (button) button.disabled = false; }
}

const DESIGN_TEAM   = ['deivid','beatriz','jady','victória','victoria'];
const TAINARA_NAMES = ['tainara'];
function isTainara(r) { return (r||'').toLowerCase().split(',').some(x=>TAINARA_NAMES.some(t=>x.trim().includes(t))); }
function isDesign(r)  { return (r||'').toLowerCase().split(',').some(x=>DESIGN_TEAM.some(d=>x.trim().includes(d))); }
function isEdicao(r)  { return (r||'').toLowerCase().includes('reriston'); }

function getItemsBySemana(sem) { return DADOS.filter(itemNaCarteira).filter(d=>d.semana===sem && getDateIso(d)); }
function getDiasSemana(sem) { return DIAS_SEMANAS[sem-1] || []; }
function groupByCliente(items) {
  const m={};
  items.forEach(d=>clientesDoItem(d).forEach(cliente=>{ if(!m[cliente]) m[cliente]=[]; m[cliente].push(d); }));
  return m;
}

// ─── Mini calendário ──────────────────────────────────────────────────────────
function renderCal(items, dias) {
  return dias.map(dia => {
    const dayItems = items.filter(d=>getDateIso(d)===dia.iso);
    const dots = dayItems.map(d=>`<div class="cal-dot ${statusCls(d.status)}"${statusDotInlineStyle(d.status_color)} title="${d.nome} — ${d.status}"></div>`).join("");
    return `<div class="cal-day ${dia.hoje?'hoje':''}">
      <div class="cal-day-label">${dia.label}</div>
      <div class="cal-day-num">${dia.num}</div>
      <div class="cal-dot-wrap">${dots}</div>
    </div>`;
  }).join("");
}
// ─── Card de cliente ────────────────────────────────────────────────────────────
function renderClientCard(cliente, items, dias, filter, dayFilter) {
  let fi = dayFilter ? items.filter(d=>getDateIso(d)===dayFilter) : items;
  // Filtro por pessoa
  if (selectedPersonIds.size) {
    fi = fi.filter(itemMatchesSelectedPeople);
  }
  if(filter==='pending')      fi = fi.filter(d=>!isTainara(d.responsavel));
  else if(filter==='ready')   fi = fi.filter(d=>isTainara(d.responsavel));
  else if(filter==='redacao') fi = fi.filter(d=>String(d.group_id)==='group_title' && d.status==='A Fazer');
  else if(filter==='design')  fi = fi.filter(d=>isDesign(d.responsavel));
  else if(filter==='edicao')  fi = fi.filter(d=>isEdicao(d.responsavel));
  else if(filter==='status:pending_all') fi = fi.filter(d=>!['Finalizado'].includes(d.status));
  else if(filter&&filter.startsWith('status:')) fi = fi.filter(d=>d.status===filter.replace('status:',''));

  // Todo número e indicador visual do cartão deve usar o mesmo recorte que a lista.
  if(fi.length===0) return '';

  const qtd = fi.length;
  const isLow = qtd < 3, isEmpty = qtd === 0;
  if(filter==='low' && !isLow) return '';

  const alertCls = isEmpty?'alert-empty':isLow?'alert-low':'alert-ok';
  const countCls = isEmpty?'empty':isLow?'low':'ok';
  const calHtml  = renderCal(fi, dias);
  const modeLabel = dateMode === 'prazo' ? 'Prazo' : 'Veiculação';
  const rows = [...fi].sort((a,b)=>getDateIso(a).localeCompare(getDateIso(b))).map(d=>{
    const prazoAtrasadoBadge = (dateMode === 'prazo' && d.prazo_atrasado) ? '<span class="prazo-badge">Atrasado</span>' : '';
    // O dia da semana sai da própria data (prazo ou veiculação): peça sem
    // dia_semana gravado mostrava "undefined" antes da data.
    const isoDoDia = dateMode === 'prazo' ? d.prazo_iso : getDateIso(d);
    const diaSem = isoDoDia ? ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(isoDoDia+'T12:00:00').getDay()] : (d.dia_semana || '');
    const isUrgent = !['Finalizado','Agendado','Para agendar'].includes(d.status) && isDateTodayOrTomorrow(getDateIso(d));
    // Mesmas peças da fila de demandas e da visão por grupo, arrumadas para a
    // largura desta coluna. O ID e a captação entram aqui: faltavam.
    return `
    <div class="item-row${isUrgent?' urgent':''}${pv2Ligado()?pv2Chegou(d):''}">
      <span class="item-date">${diaSem} ${getDateFmt(d)}${prazoAtrasadoBadge}</span>
      ${vybeChipId(d)}
      ${fmtHtml(d.formato)}
      <span class="item-name">${vybeNome(d)}</span>
      ${managerStatusControl(d)}
      ${capRotuloHtml(d)}
      ${quickDateTrigger(d,'manager-date-trigger')}
      ${vybeDono(d,'manager-owner-trigger')}
    </div>`;
  }).join("");
  // Barra de progresso
  const totalItems = fi.length;
  const doneItems = fi.filter(d => ['Finalizado'].includes(d.status)).length;
  const progressPct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;
  const hasPending = fi.some(d => ['A Fazer','Falta D.A','Pode Fazer','Aguardo','Alteração'].includes(d.status));
  const allDone = totalItems > 0 && fi.every(d => ['Finalizado'].includes(d.status));
  const pendingCls = allDone ? 'all-done' : (hasPending ? 'has-pending' : '');
  const progressHtml = totalItems > 0 ? `<div class="client-progress"><div class="client-progress-bar"><div class="client-progress-fill" style="width:${progressPct}%"></div></div><span class="client-progress-text">${doneItems}/${totalItems} (${progressPct}%)</span></div>` : '';
  return `<div class="client-card ${alertCls} ${pendingCls}">
    <div class="client-header">
      <span class="client-name">${cliente}</span>
      <div class="client-meta">
        <span class="posts-count ${countCls}">${qtd} post${qtd!==1?'s':''}</span>
        ${isLow?'<span style="color:#fbbf24;font-size:10px;">Abaixo do mínimo</span>':''}
      </div>
    </div>
    ${progressHtml}
    <div class="mini-calendar">${calHtml}</div>
    <div class="item-list">${rows||'<div style="padding:10px 14px;color:var(--text-muted);font-size:11px;">Nenhum conteúdo cadastrado</div>'}</div>
  </div>`;
}

// ─── Modo de visualização ─────────────────────────────────────────────────────
let viewMode = 'day'; // 'client' ou 'day'
function toggleViewMode(btn) {
  viewMode = viewMode === 'client' ? 'day' : 'client';
  btn.textContent = viewMode === 'day' ? 'Ver por cliente' : 'Ver por dia';
  btn.classList.toggle('active', viewMode === 'day');
  for (let s = 1; s <= (META.weeks?.length || 4); s++) renderWeek(s, currentFilter, currentDayFilter);
}
// ─── Helpers de data ──────────────────────────────────────────────────────
function isDateTodayOrTomorrow(isoStr) {
  if (!isoStr) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const d = new Date(isoStr+'T12:00:00'); d.setHours(0,0,0,0);
  return d.getTime() === today.getTime() || d.getTime() === tomorrow.getTime();
}

// ─── Filtro Só Pendentes ──────────────────────────────────────────────────
let pendingOnlyActive = false;
function togglePendingOnly(btn) {
  pendingOnlyActive = !pendingOnlyActive;
  btn.classList.toggle('pending-active', pendingOnlyActive);
  btn.textContent = pendingOnlyActive ? 'Mostrando pendentes' : 'Só pendentes';
  if (pendingOnlyActive) {
    currentFilter = 'status:pending_all';
  } else {
    currentFilter = 'all';
  }
  // "Só pendentes" toma o lugar do status escolhido: a pílula apaga junto.
  document.querySelectorAll('#status-legend .pill').forEach(p=>p.classList.remove('active-legend'));
  const numWeeks = META.weeks ? META.weeks.length : 4;
  for (let s = 1; s <= numWeeks; s++) renderWeek(s, currentFilter, currentDayFilter);
  renderManagerCalendar();
  updateClearFiltersState();
}

// ─── Limpar todos os filtros ──────────────────────────────────────────────────
function updateClearFiltersState() {
  const btn = document.getElementById('ops-clear-btn');
  if (!btn) return;
  const search = document.getElementById('global-search');
  const hasActiveFilter = filtroCarteira !== 'all' || currentFilter !== 'all' || currentDayFilter !== '' || currentPersonFilter !== 'all' || sortCritico || pendingOnlyActive || (search && search.value.trim() !== '') || dateMode === 'prazo';
  btn.classList.toggle('is-idle', !hasActiveFilter);
  btn.textContent = hasActiveFilter ? '✕ Limpar filtros' : '✓ Sem filtros';
  btn.title = hasActiveFilter ? 'Limpar busca e todos os filtros ativos' : 'Nenhum filtro ativo';
  if (typeof pintarFiltrosDaAgenda === 'function') pintarFiltrosDaAgenda();
  if (typeof pv2PintarFiltroAtivo === 'function') pv2PintarFiltroAtivo();
}

function clearAllFilters(preserveDateMode = false) {
  filtroCarteira = 'all';
  pintarFiltroCarteira();
  pendingOnlyActive = false;
  const pendBtn = document.getElementById('btn-pending-only');
  if(pendBtn) { pendBtn.classList.remove('pending-active'); pendBtn.textContent = 'Só pendentes'; }
  currentFilter = 'all';
  currentDayFilter = '';
  currentPersonFilter = 'all';
  selectedPersonIds.clear();
  sortCritico = false;
  if (typeof pv2SoSemDono !== 'undefined') pv2SoSemDono = false;
  if (!preserveDateMode && dateMode !== 'veiculacao') {
    dateMode = 'veiculacao';
    document.getElementById('btn-mode-veiculacao')?.classList.add('active');
    document.getElementById('btn-mode-prazo')?.classList.remove('active');
  }
  const searchInput = document.getElementById('global-search');
  if (searchInput) { searchInput.value = ''; handleGlobalSearch(''); }
  // Reset visual status pills
  document.querySelectorAll('#status-legend .pill').forEach(p=>p.classList.remove('active-legend'));
  // Reset person chips
  document.querySelectorAll('#person-filter-bar .person-chip').forEach(c=>c.classList.remove('active'));
  const allChip = document.querySelector('#person-all .person-chip');
  if(allChip) allChip.classList.add('active');
  // Reset day select
  const sel = document.getElementById('day-select');
  if(sel) sel.value = '';
  // Reset critico btn
  const critico = document.getElementById('sort-critico-btn');
  if(critico) critico.classList.remove('active');
  for (let s = 1; s <= (META.weeks ? META.weeks.length : 4); s++) renderWeek(s, currentFilter, currentDayFilter);
  renderOperationalTools();
  renderCompactSummary();
  renderManagerCalendar();
  renderManagerIntelligence();
  updateClearFiltersState();
}
// ─── Renderizar por dia ────────────────────────────────────────────────────────────
function itensDaSemanaGestor(sem) {
  const conteudos = getItemsBySemana(sem);
  if (panelMode !== 'gestor') return conteudos;
  const dias = new Set(getDiasSemana(sem).map(d => d.iso));
  const demandas = (DADOS_DEMANDAS || []).filter(itemNaCarteira).map(normalizeRequestForOperational)
    .filter(d => dias.has(dataDoCartaoDia(d)));
  const vistos = new Set();
  return [...conteudos, ...demandas].filter(d => {
    const chave = `${d.board_id || BOARD_ID}:${d.id}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave); return true;
  });
}
// Concluída é só Finalizado (Paulo, 13/11/2026): Para agendar e Agendado ainda esperam a postagem.
function atividadeDoDiaConcluida(item) {
  return isRequestItem(item) ? DEMANDA_CONCLUIDA.includes(item.status)
    : item.status === 'Finalizado';
}
function adicionarDemandaNoDia(dateIso, aba) {
  const veic = dateMode === 'prazo' ? cadastrosIsoOffset(dateIso, PRAZO_OURO_DIAS) : dateIso;
  const prazo = dateMode === 'prazo' ? dateIso : goldenDeadlineIso(dateIso);
  openCadastrosGoverned({ veic, prazo, ...(aba ? {board:aba==='social'?'producao':'demandas'} : {escolherQuadro:true}) });
}

const abasPendenciasDia = new Map();
// Redesign do legado, fase 2 (Paulo, 09/11/2026): Redes, Demandas ou Pendências escolhido uma vez para a semana
// inteira, na linha do título. Cada dia ainda pode trocar só o dele; escolher para a semana desfaz essas trocas.
let abaDaSemana = 'social';
function escolherAbaDaSemana(sem, aba) {
  if (!['social', 'demandas', 'pendencias'].includes(aba)) return;
  abaDaSemana = aba;
  abasPendenciasDia.clear();
  renderByDay(sem, currentFilter, currentDayFilter);
}
function pintarAbaDaSemana(grid, sem, totais = null) {
  const titulo = grid.previousElementSibling?.classList.contains('section-title') ? grid.previousElementSibling : null;
  if (!titulo) return;
  let grupo = titulo.querySelector('.semana-abas');
  if (panelMode !== 'gestor') { grupo?.remove(); return; }
  if (!grupo) {
    grupo = document.createElement('span');
    grupo.className = 'semana-abas vb-alternar'; grupo.setAttribute('role', 'group'); grupo.setAttribute('aria-label', 'Mostrar em todos os dias');
    titulo.insertBefore(grupo, titulo.querySelector('.dias-setas, .dias-layout-btn'));
  }
  // Agenda da semana (quadro 02, 10/11/2026): a contagem da semana fica no alternador, já que no mundo as abas de cada
  // dia saíram (Redes, Demandas e Pendências escolhidas uma vez para a semana inteira).
  grupo.innerHTML = [['social', 'Redes'], ['demandas', 'Demandas'], ['pendencias', 'Pendências']].map(([id, nome]) =>
    `<button type="button" aria-pressed="${abaDaSemana === id}" onclick="escolherAbaDaSemana(${sem},'${id}')">${nome}${totais ? ` <span class="semana-abas-n">${totais[id]}</span>` : ''}</button>`).join('');
}
// Agenda da semana (quadro 02): um seletor ‹ semana › no lugar das seis pílulas (que ficam no tema antigo); "Hoje" volta
// para a semana atual. Passa pelas mesmas pílulas (showWeek), então nada muda no que cada semana mostra.
function pilulasDeSemana() {
  return [...document.querySelectorAll('#week-tabs-container [id^="tab-s"][id$="-label"]')].filter((b) => b.style.display !== 'none');
}
function passarSemana(passo) {
  const lista = pilulasDeSemana(), atual = document.getElementById(`tab-s${currentWeek}-label`);
  const i = Math.max(0, lista.indexOf(atual)), alvo = lista[Math.min(lista.length - 1, Math.max(0, i + passo))];
  if (alvo && alvo !== atual) alvo.click();
  pintarSeletorDeSemana();
}
function semanaDeHoje() {
  const alvo = pilulasDeSemana().find((b) => b.classList.contains('e-hoje'));
  if (alvo) alvo.click();
  pintarSeletorDeSemana();
}
function pintarSeletorDeSemana() {
  if (typeof pv2PintarSemana === 'function') pv2PintarSemana();
  const rotulo = document.getElementById('semana-seletor-rotulo'); if (!rotulo) return;
  const lista = pilulasDeSemana(), atual = document.getElementById(`tab-s${currentWeek}-label`), i = lista.indexOf(atual);
  const texto = atual ? 'Semana ' + String(atual.textContent || '').replace(/^\s*\d+\s*·\s*/, '').trim() : 'Semana';
  if (rotulo.textContent !== texto) rotulo.textContent = texto;
  const seletor = rotulo.closest('.semana-seletor');
  seletor?.querySelector('[data-semana-passo="-1"]')?.toggleAttribute('disabled', i <= 0);
  seletor?.querySelector('[data-semana-passo="1"]')?.toggleAttribute('disabled', i < 0 || i >= lista.length - 1);
  seletor?.querySelector('.semana-hoje')?.setAttribute('aria-pressed', String(Boolean(atual?.classList.contains('e-hoje'))));
}
const diasExpandidos = new Set();
const concluidasAbertasDia = new Set();
function dataDoCartaoDia(item) {
  return isRequestItem(item) && dateMode !== 'prazo' ? (item.conclusao_iso || item.prazo_iso || '') : getDateIso(item);
}
// Ordem do dia: o que ainda precisa ser produzido vem primeiro (e fica em
// destaque vermelho leve); depois aprovação; "Para agendar" juntos; "Agendado"
// por último. Dentro de cada grupo, por cliente.
function grupoDoDiaPorStatus(status) {
  const s=String(status||'').toLocaleLowerCase('pt-BR');
  if(s==='agendado') return 3;
  if(s==='para agendar') return 2;
  if(/aprova/.test(s)) return 1;
  return 0;
}
function ordenarCartaoDia(lista) {
  return [...lista].sort((a,b)=>grupoDoDiaPorStatus(a.status)-grupoDoDiaPorStatus(b.status)
    ||String(a.cliente||'').localeCompare(String(b.cliente||''),'pt-BR'));
}
function listasDoCartaoDia(itens, pendencias, aba='social') {
  const redes=itens.filter(i=>!isRequestItem(i));
  const demandas=itens.filter(isRequestItem);
  const lista=aba==='pendencias'?pendencias:aba==='demandas'?demandas:redes;
  const abertas=ordenarCartaoDia(lista.filter(i=>i.status!=='Finalizado'));
  const concluidas=lista.filter(i=>i.status==='Finalizado');
  return {redes,demandas,lista,abertas,concluidas};
}
function registrarConcluidasDoDia(iso,aba,detalhes) {
  const chave=`${iso}:${aba}`;
  if(detalhes.open) concluidasAbertasDia.add(chave);else concluidasAbertasDia.delete(chave);
  ORDEM_VISIVEL_DO_DIA=Array.from(document.querySelectorAll('.day-activity-scroll [data-day-item]'))
    .filter(el=>!el.closest('.day-completed') || el.closest('.day-completed').open).map(el=>el.dataset.dayItem);
}

function alternarExpansaoDoDia(iso, botao) {
  const expandido=!diasExpandidos.has(iso);
  if(expandido) diasExpandidos.add(iso); else diasExpandidos.delete(iso);
  const cartao=botao.closest('.day-scroll-card');
  if(!cartao) return;
  cartao.classList.toggle('day-expanded',expandido);
  botao.setAttribute('aria-expanded',String(expandido));
  botao.textContent=expandido?'Recolher dia':`Ver todas as ${botao.dataset.total} atividades`;
}

function selecionarAbaDoDia(sem, iso, aba) {
  const seletor=`#grid-s${sem} [data-date="${iso}"]`;
  const antes=document.querySelector(seletor);
  const topo=antes?.getBoundingClientRect().top;
  const rolagens=Array.from(document.querySelectorAll(`#grid-s${sem} .day-activity-scroll`))
    .map(el=>({id:el.id,top:el.scrollTop}));
  abasPendenciasDia.set(iso, aba===true?'pendencias':aba===false?'social':aba);
  renderByDay(sem, currentFilter, currentDayFilter);
  rolagens.forEach(({id,top})=>{const el=document.getElementById(id);if(el)el.scrollTop=top;});
  const depois=document.querySelector(seletor);
  depois?.querySelector('.day-pending-tabs button[aria-pressed="true"]')?.focus({preventScroll:true});
  // A troca pode reduzir a altura da página. Mantém o cartão no mesmo ponto
  // da janela, inclusive quando o navegador ajusta a rolagem ao recriar a grade.
  if(depois && topo!==undefined) window.scrollBy({top:depois.getBoundingClientRect().top-topo,left:0,behavior:'instant'});
}

function filtrarItensDoDia(items, filter) {
  let fi = items.filter(itemNaCarteira);
  if (selectedPersonIds.size) {
    fi = fi.filter(itemMatchesSelectedPeople);
  }
  if(filter==='pending')      fi = fi.filter(d=>!isTainara(d.responsavel));
  else if(filter==='ready')   fi = fi.filter(d=>isTainara(d.responsavel));
  else if(filter==='redacao') fi = fi.filter(d=>String(d.group_id)==='group_title' && d.status==='A Fazer');
  else if(filter==='design')  fi = fi.filter(d=>isDesign(d.responsavel));
  else if(filter==='edicao')  fi = fi.filter(d=>isEdicao(d.responsavel));
  else if(filter==='status:pending_all') fi = fi.filter(d=>!atividadeDoDiaConcluida(d));
  else if(filter&&filter.startsWith('status:')) fi = fi.filter(d=>d.status===filter.replace('status:',''));
  return fi;
}
function pendenciasSolicitacoesDoDia(iso, filter) {
  const vistos = new Set();
  return filtrarItensDoDia((DADOS_DEMANDAS || []).map(normalizeRequestForOperational), filter)
    .filter(d => {
      const data = dataDoCartaoDia(d);
      const chave = String(d.id);
      if (vistos.has(chave) || atividadeDoDiaConcluida(d) || (data && data >= iso)) return false;
      vistos.add(chave);
      return true;
    }).sort((a,b) => (dataDoCartaoDia(a) || '9999').localeCompare(dataDoCartaoDia(b) || '9999'));
}

// Dias em colunas lado a lado, rolando para o lado (Paulo, 19/10/2026:
// "estilo um Trello, só que melhor"): cada dia é uma coluna com a altura da
// tela e a própria rolagem, e cabe muito mais por dia. "Ver em grade" volta
// ao mosaico de antes; a escolha fica guardada neste navegador.
let DIAS_EM_COLUNAS = (() => { try { return localStorage.getItem('vybeDiasLayout') !== 'grade'; } catch { return true; } })();
const DIAS_COLUNAS_POSICIONADOS = new Set();
function alternarDiasEmColunas() {
  DIAS_EM_COLUNAS = !DIAS_EM_COLUNAS;
  try { localStorage.setItem('vybeDiasLayout', DIAS_EM_COLUNAS ? 'colunas' : 'grade'); } catch { /* sem storage */ }
  DIAS_COLUNAS_POSICIONADOS.clear();
  for (let s = 1; s <= (META.weeks?.length || 4); s++) renderWeek(s, currentFilter, currentDayFilter);
}
function aplicarLayoutDosDias(grid, sem, emDias) {
  const colunas = emDias && DIAS_EM_COLUNAS && grid.querySelectorAll(':scope > .day-scroll-card').length > 1;
  grid.classList.toggle('dias-colunas', colunas);
  const titulo = grid.previousElementSibling?.classList.contains('section-title') ? grid.previousElementSibling : null;
  let botao = titulo?.querySelector('.dias-layout-btn');
  if (titulo && !botao && emDias) {
    botao = document.createElement('button');
    botao.type = 'button'; botao.className = 'dias-layout-btn';
    botao.addEventListener('click', alternarDiasEmColunas);
    titulo.append(botao);
  }
  if (botao) { botao.hidden = !emDias; botao.textContent = DIAS_EM_COLUNAS ? 'Ver em grade' : 'Ver em colunas'; }
  // ‹ › andam um dia para cada lado (Deivid, 20/10/2026: com mouse comum não
  // havia como rolar para o lado, só pela barrinha de baixo).
  let setas = titulo?.querySelector('.dias-setas');
  if (titulo && !setas && emDias) {
    setas = document.createElement('span');
    setas.className = 'dias-setas'; setas.setAttribute('role', 'group'); setas.setAttribute('aria-label', 'Rolar os dias');
    setas.innerHTML = '<button type="button" aria-label="Dias anteriores" title="Dias anteriores">‹</button><button type="button" aria-label="Próximos dias" title="Próximos dias">›</button>';
    const [antes, depois] = setas.querySelectorAll('button');
    const andar = (lado) => { const g = titulo.nextElementSibling; const passo = (g?.querySelector(':scope > .day-scroll-card')?.offsetWidth || 300) + 12; g?.scrollBy({ left: lado * passo, behavior: 'smooth' }); };
    antes.addEventListener('click', () => andar(-1)); depois.addEventListener('click', () => andar(1));
    titulo.insertBefore(setas, botao || null);
  }
  if (setas) setas.hidden = !colunas;
  if (!colunas) return false;
  grid.classList.remove('dias-encaixados');
  // Abre na coluna de hoje uma vez por semana mostrada (sem pular a cada atualização).
  if (!DIAS_COLUNAS_POSICIONADOS.has(sem)) {
    const hoje = grid.querySelector(':scope > .day-is-today');
    if (hoje && grid.offsetParent) { grid.scrollLeft = Math.max(0, hoje.offsetLeft - grid.offsetLeft - 12); DIAS_COLUNAS_POSICIONADOS.add(sem); }
  }
  return true;
}
// A cor de cada formato é a mesma dos planejamentos (PLJ_COR_FORMATO): Card,
// Carrossel, Reels… têm uma cor só no painel inteiro. O nome do quadro varia
// ("Story", "Vídeo institucional"), então ele é lido pelo começo.
function corDoFormato(formato) {
  const paleta = typeof PLJ_COR_FORMATO !== 'undefined' ? PLJ_COR_FORMATO : {};
  const n = String(formato || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nome = /stor/.test(n) ? 'Stories' : /video/.test(n) ? 'Vídeo' : /reel/.test(n) ? 'Reels'
    : /carross/.test(n) ? 'Carrossel' : /foto/.test(n) ? 'Fotografia' : /card/.test(n) ? 'Card' : 'Outro';
  return paleta[nome] || '#6b7280';
}
function renderByDay(sem, filter, dayFilter) {
  // No mundo, a semana é a do quadro do padrão v2 (pv2RenderDias, no fim deste arquivo); abaixo fica o tema antigo.
  if (typeof pv2RenderDias === 'function' && pv2Ligado()) { pv2RenderDias(sem, filter, dayFilter); return; }
  const items=itensDaSemanaGestor(sem);
  const fi=filtrarItensDoDia(items,filter);
  const diasBase=getDiasSemana(sem);
  const labels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const dias=dateMode==='prazo'
    ? [...new Set([...diasBase.map(d=>d.iso),...items.map(dataDoCartaoDia).filter(Boolean)])].sort().map(iso=>({iso,label:labels[new Date(iso+'T12:00:00').getDay()]}))
    : diasBase;
  const grid=document.getElementById(`grid-s${sem}`);
  if(!grid)return;
  const ordemVisivel=[];
  // No mundo, as abas de cada dia saem (quadro 02): a escolha é da semana e a contagem vai para o alternador dela.
  const abasPorDia=panelMode==='gestor'&&!document.body.classList.contains('mundo');
  const naSemana={social:new Set(),demandas:new Set(),pendencias:new Set()};
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  grid.innerHTML=dias.filter(d=>!dayFilter||d.iso===dayFilter).map(dia=>{
    const dataCurta=dia.iso.slice(8,10)+'/'+dia.iso.slice(5,7);
    const dayItems=fi.filter(d=>dataDoCartaoDia(d)===dia.iso).sort((a,b)=>String(a.cliente||'').localeCompare(String(b.cliente||''),'pt-BR'));
    const pendencias=panelMode==='gestor'?pendenciasSolicitacoesDoDia(dia.iso,filter):[];
    const estado=typeof unifiedDemandasState==='undefined'?'ready':unifiedDemandasState;
    const aviso=estado==='error'?'Não foi possível atualizar as solicitações. Os dados exibidos podem estar desatualizados.':estado!=='ready'?'Carregando solicitações…':'';
    const salva=abasPendenciasDia.get(dia.iso);
    const aba=panelMode==='gestor'?(salva===true?'pendencias':salva===false?'social':!salva?abaDaSemana:salva):'social';
    const {redes,demandas,lista,abertas,concluidas}=listasDoCartaoDia(dayItems,pendencias,aba);
    redes.forEach(i=>naSemana.social.add(String(i.id)));demandas.forEach(i=>naSemana.demandas.add(String(i.id)));pendencias.forEach(i=>naSemana.pendencias.add(String(i.id)));
    const mostrarConcluidas=concluidasAbertasDia.has(`${dia.iso}:${aba}`);
    [...abertas,...(mostrarConcluidas?concluidas:[])].forEach(i=>ordemVisivel.push(String(i.id)));
    const pct=lista.length?Math.round(concluidas.length*100/lista.length):0;
    const listaId=`atividades-dia-${sem}-${dia.iso}`;
    const linha=d=>{
      const marcada=typeof SELECIONADAS!=='undefined'&&SELECIONADAS.has(String(d.id));
      const data=dataDoCartaoDia(d);
      const emAberto=d.status!=='Finalizado'&&grupoDoDiaPorStatus(d.status)===0;
      return `<div class="item-row day-activity-row${marcada?' marcada':''}${aba==='pendencias'?' day-pending-row':''}${emAberto?' day-row-aberta':''}" data-grupo="${grupoDoDiaPorStatus(d.status)}" draggable="true"
        ondragstart="managerCalendarDragStart('${isRequestItem(d)?'request':'content'}','${jsArg(d.id)}',event)" ondragend="managerCalendarDragEnd()" title="Arraste para mudar a data">
        <label class="dia-marcar" onclick="event.stopPropagation()" title="Marcar para ação em lote"><input type="checkbox" ${marcada?'checked':''} data-day-item="${safeText(d.id)}" aria-label="Marcar ${safeText(d.nome||'')}"
          onclick="event.stopPropagation();alternarSelecao('${jsArg(d.id)}',this.checked,event,ORDEM_VISIVEL_DO_DIA)"></label>
        <div class="day-activity-content"><div class="day-activity-main">
          <button type="button" class="item-name item-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir detalhes da atividade">${safeText(d.nome)}</button>
          <div class="day-activity-caption"><span class="day-activity-clients">${clientesDoItem(d).map(nome=>cliCor(nome)).join(' ')||'Sem cliente'}${clientesDoItem(d).length>1?`<span class="dia-mais-clientes" title="${safeText(clientesDoItem(d).join(', '))}">+${clientesDoItem(d).length-1}</span>`:''}</span>${aba==='pendencias'?`<span class="day-pending-date">${data?'Entrega '+data.split('-').reverse().join('/'):'Sem data'}</span>`:''}</div>
        </div><div class="day-activity-lado">
          <div class="day-activity-pessoas">${botaoDePreviaNaLinha(d)}${ownerEditorTrigger(d,'manager-owner-trigger')}</div>
          <div class="day-activity-actions">${d.formato?`<span class="day-activity-formato" style="--formato:${corDoFormato(d.formato)}">${safeText(d.formato)}</span>`:''}${managerStatusControl(d,{comTempo:false})}</div>
        </div></div>
      </div>`;
    };
    const avisoHtml=aba!=='social'&&aviso?`<p class="day-pending-note" role="status">${aviso}<button type="button" class="day-summary-btn" onclick="ensureDemandasForOperationalViews(true)">Atualizar</button></p>`:'';
    const tituloAba=aba==='social'?'Redes sociais':aba==='demandas'?'Demandas':'Pendências';
    // Redesign fase 2: a frase repetida em todas as colunas vazias virou uma linha curta.
    const vazio=aba==='social'?'Nada marcado neste dia.':aba==='demandas'?'Nenhuma entrega neste dia.':'Nada atrasado ou sem data.';
    const contexto=dateMode==='prazo'?'Por prazo':aba==='social'?'Por veiculação':'Por conclusão prevista ou prazo';
    return `<div class="client-card dia-solta day-scroll-card${dia.iso===hoje?' day-is-today':''}${diasExpandidos.has(dia.iso)?' day-expanded':''}${lista.length?'':' day-empty'}" data-date="${dia.iso}" data-previa-sequencia="${dia.label} · ${dataCurta}" ondragover="soltarNoDiaSobre(event,this)" ondragleave="soltarNoDiaSai(this)" ondrop="soltarNoDia('${dia.iso}',event,this)">
      <div class="client-header"><div class="day-heading"><div class="client-name">${dia.label} · ${dataCurta}${dia.iso===hoje?'<span class="day-today-label">Hoje</span>':''}</div><span class="day-date-context">${contexto}</span></div>
        <div class="day-header-actions"><span class="day-progress-label">${concluidas.length}/${lista.length} concluídas</span><details class="day-menu"><summary aria-label="Ações de ${dataCurta}" title="Adicionar atividade ou gerar o resumo do dia"><svg class="day-menu-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg><span class="day-menu-rot">Ações</span></summary><div class="day-menu-options">${panelMode==='gestor'?`<button type="button" onclick="this.closest('details').open=false;adicionarDemandaNoDia('${dia.iso}','${aba}')">Adicionar atividade</button>`:''}<button type="button" onclick="this.closest('details').open=false;openDailySummary('${dia.iso}')">Gerar resumo</button></div></details></div>
      </div>
      ${abasPorDia?`<div class="day-pending-tabs" role="group" aria-label="Atividades de ${dia.iso}">${[['social','Redes',redes.length],['demandas','Demandas',demandas.length],['pendencias','Pendências',pendencias.length]].map(([id,nome,total])=>`<button type="button" aria-pressed="${aba===id}" onclick="selecionarAbaDoDia(${sem},'${dia.iso}','${id}')">${nome}<span>${id!=='social'&&aviso?'!':total}</span></button>`).join('')}</div>`:''}
      <div class="client-progress" role="progressbar" aria-label="Progresso de ${tituloAba} em ${dataCurta}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="client-progress-bar"><div class="client-progress-fill" style="width:${pct}%;background:${pct===100?'var(--green,#00c875)':'var(--accent,#ff6b00)'}"></div></div><span class="client-progress-text">${pct}%</span></div>
      ${aba==='pendencias'?'<p class="day-pending-note">Solicitações abertas anteriores a este dia ou sem data. Datas originais preservadas.</p>':''}
      <div class="item-list day-activity-scroll" id="${listaId}" role="region" aria-label="${tituloAba} de ${dataCurta}" tabindex="0">${avisoHtml}${abertas.map(linha).join('')}${!abertas.length?`<p class="day-pending-note">${lista.length?'Tudo concluído nesta aba.':vazio}</p>`:''}${concluidas.length?`<details class="day-completed" ${mostrarConcluidas?'open':''} ontoggle="registrarConcluidasDoDia('${dia.iso}','${aba}',this)"><summary>Concluídas <span>${concluidas.length}</span></summary>${concluidas.map(linha).join('')}</details>`:''}</div>
      ${lista.length>6?`<div class="day-expansion-footer"><button type="button" class="day-summary-btn day-expand-btn" data-total="${lista.length}" aria-controls="${listaId}" aria-expanded="${diasExpandidos.has(dia.iso)}" onclick="alternarExpansaoDoDia('${dia.iso}',this)">${diasExpandidos.has(dia.iso)?'Recolher dia':`Ver todas as ${lista.length} atividades`}</button></div>`:''}
    </div>`;
  }).join('');
  pintarAbaDaSemana(grid,sem,{social:naSemana.social.size,demandas:naSemana.demandas.size,pendencias:naSemana.pendencias.size});
  pintarSeletorDeSemana();
  ORDEM_VISIVEL_DO_DIA=ordemVisivel;
  if(!aplicarLayoutDosDias(grid,sem,true)) encaixarCartoesDoDia(grid);
}
// Cartões de dia com alturas diferentes deixavam buracos na grade (a linha
// toda esperava o cartão mais alto). Cada cartão ocupa só as linhas finas
// de que precisa, na ordem dos dias, e reencaixa quando muda de altura.
const OBSERVADOR_CARTOES_DIA = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entradas => { for (const e of entradas) ajustarAlturaCartaoDia(e.target); })
  : null;
function ajustarAlturaCartaoDia(cartao) {
  const grade = cartao.parentElement;
  if (!grade || !grade.classList.contains('dias-encaixados')) return;
  const linha = 4, espaco = 18;
  cartao.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((cartao.getBoundingClientRect().height + espaco) / linha));
}
function encaixarCartoesDoDia(grid) {
  if (!grid || !OBSERVADOR_CARTOES_DIA) return;
  const cartoes = [...grid.querySelectorAll(':scope > .day-scroll-card')];
  grid.classList.toggle('dias-encaixados', cartoes.length > 1);
  for (const c of cartoes) { ajustarAlturaCartaoDia(c); OBSERVADOR_CARTOES_DIA.observe(c); }
}
// A ordem em que as pecas aparecem na lista por dia. Guardada porque o
// shift+clique de uma linha precisa saber o que veio antes e depois DELA nesta
// tela, e nao na visao de Grupos.
let ORDEM_VISIVEL_DO_DIA = [];
// O mesmo gerador oferece uma mensagem revisável para cada destino interno.
let dailySummaryMessages = [];
let dailySummarySelected = 'geral';
let dailySummaryDate = '';
let dailySummaryOpening = 0;
function buildDailySummary(dayIso, contexto = {}) {
  const conteudos = contexto.conteudos || (typeof DADOS_ALL !== 'undefined' && DADOS_ALL.length ? DADOS_ALL : DADOS) || [];
  const solicitacoes = contexto.solicitacoes || (panelMode === 'gestor' ? (DADOS_DEMANDAS || []).map(normalizeRequestForOperational) : []);
  return resumosPorGrupo([...conteudos, ...solicitacoes].filter(itemNaCarteira), dayIso,
    { statusDe: operationalFlowStatus, clientesDe: clientesDoItem,
      baseAnterior:contexto.baseAnterior ? {...contexto.baseAnterior,itens:contexto.baseAnterior.itens.filter(itemNaCarteira)} : null,
      alertaBase:contexto.alertaBase || '',geradoEm:contexto.geradoEm || '', equipe:[
      {id:PESSOAS.RERISTON,nome:'Reriston',limite:4},
      {id:PESSOAS.BEATRIZ,nome:'Bia',limite:5,nomeCompleto:'Beatriz'},
      {id:PESSOAS.DEIVID,nome:'Deivid',limite:5,aprovacoesExtras:true},
      {id:PESSOAS.JADY,nome:'Jady',limite:5},
      {id:PESSOAS.PAULO,nome:'Paulo',grupo:'atendimento'},
      {id:PESSOAS.VINICIUS,nome:'Vinícius',grupo:'atendimento'},
      {id:PESSOAS.EWERTON_L,nome:'Ewerton',grupo:'atendimento'},
    ] });
}
// Os grupos viram cartões para tocar (uma escolha à vista em vez da lista);
// o select continua lá, escondido, e é ele que selectDailySummary lê.
function escolherGrupoDoResumo(id) {
  const sel = document.getElementById('daily-summary-group');
  if (!sel || sel.value === id) return;
  sel.value = id;
  selectDailySummary();
  marcarGrupoDoResumo();
}
function marcarGrupoDoResumo() {
  const id = document.getElementById('daily-summary-group')?.value;
  document.querySelectorAll('.resumo-grupo').forEach((b) => { const on = b.dataset.grupo === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  const nome = dailySummaryMessages.find((m) => m.id === id)?.nome;
  const rotulo = document.getElementById('daily-summary-nome');
  if (rotulo && nome) rotulo.textContent = nome;
}
async function selectDailySummary() {
  const grupo = document.getElementById('daily-summary-group')?.value;
  const mensagem = dailySummaryMessages.find(m=>m.id===grupo);
  const area = document.getElementById('daily-summary-preview');
  const anterior = dailySummaryMessages.find(m=>m.id===dailySummarySelected);
  if(area && anterior && (!anterior.agenda || anterior.pronta)) anterior.texto=area.value;
  if(area && mensagem) area.value=mensagem.texto;
  dailySummarySelected=grupo;
  const copiar=document.getElementById('daily-summary-copy');
  const aviso=document.getElementById('daily-summary-agenda-status');
  if(copiar) copiar.disabled=!!mensagem?.agenda && !mensagem.pronta;
  if(aviso) aviso.hidden=!mensagem?.agenda;
  const pessoal=document.getElementById('daily-summary-personal'); if(pessoal) pessoal.hidden=!mensagem?.pessoal;
  if(mensagem?.agenda && !mensagem.pronta) await loadDailySummaryAgenda();
}
async function loadDailySummaryAgenda() {
  const mensagens=dailySummaryMessages;
  const mensagem=mensagens.find(m=>m.id==='producao');
  if(!mensagem || mensagem.carregando) return;
  mensagem.carregando=true;
  mensagem.pronta=false;
  const dia=dailySummaryDate;
  if(dailySummarySelected==='producao') { const botao=document.getElementById('daily-summary-copy'); if(botao) botao.disabled=true; }
  const mostrar=texto=>{ if(dailySummaryMessages===mensagens && dailySummarySelected==='producao') {
    const area=document.getElementById('daily-summary-preview'); if(area) area.value=texto;
  }};
  mensagem.texto='Consultando gravações no Google Agenda…';
  mostrar(mensagem.texto);
  try {
    const resposta=await fetch(`/api/painel?area=agenda_producao&dia=${encodeURIComponent(dia)}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(25000)});
    const corpo=await resposta.json();
    if(!resposta.ok || !corpo.ok || !Array.isArray(corpo.eventos)) throw new Error(corpo.error || 'Não foi possível consultar a agenda.');
    mensagem.texto=resumoProducaoAgenda(corpo.eventos,dia);
    mensagem.pronta=true;
    const conferencia=mensagens.find(m=>m.id==='conferencia');
    if(conferencia) {
      conferencia.texto=conferencia.texto.split('\n').filter(l=>!l.startsWith('- Agenda:')).join('\n');
      for(const evento of corpo.eventos.filter(e=>e.ambiguo)) conferencia.texto+=`\n- Agenda: confirmar se é gravação para Mizinho: ${resumoTexto(evento.titulo)} (${resumoDiaCurto(evento.dia)}).`;
    }
    mostrar(mensagem.texto);
  } catch(erro) {
    const conferencia=mensagens.find(m=>m.id==='conferencia');
    if(conferencia && !conferencia.texto.includes('- Agenda: consulta indisponível')) conferencia.texto+='\n- Agenda: consulta indisponível; gravações ainda não confirmadas.';
    mensagem.texto=`Agenda indisponível: ${erro.message}. Nenhum resumo de Produção foi gerado. Use “Consultar agenda novamente” para tentar outra vez.`;
    mostrar(mensagem.texto);
  } finally {
    mensagem.carregando=false;
    if(dailySummaryMessages===mensagens && dailySummarySelected==='producao') {
      const copiar=document.getElementById('daily-summary-copy'); if(copiar) copiar.disabled=!mensagem.pronta;
    }
  }
}
async function openDailySummary(dayIso) {
  const abertura=++dailySummaryOpening;
  openWorkflowModal(`<div class="workflow-kicker"><span>Comunicação interna</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()" aria-label="Fechar resumo">×</button></div><h2 class="workflow-title">Consultando as mensagens</h2><p id="daily-summary-loading">Lendo a operação atual e a base da manhã…</p>`);
  let contexto;
  try {
    const baseResposta=async(url,opcoes={})=>{
      const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opcoes});const d=await r.json();
      if(!r.ok||!d.ok)throw new Error(d.error||'Base da manhã indisponível.');return d.base || null;
    };
    const hojeReal=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const [raw,reqs,base]=await Promise.all([
      fetchAllItems({silent:true}),panelMode==='gestor'?fetchAllDemandas():Promise.resolve([]),
      baseResposta(`/api/painel?area=diario&base_resumo=${resumoDiasAntes(dayIso,1)}`).then(baseAnterior=>({baseAnterior})).catch(erro=>({alertaBase:erro.message})),
    ]);
    contexto={...base,conteudos:processItemsAll(raw,calcWeeks()),solicitacoes:processDemandas(reqs).map(normalizeRequestForOperational),
      geradoEm:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Bahia',dateStyle:'short',timeStyle:'short'}).format(new Date())};
    const hora=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bahia',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
    if(dayIso===hojeReal && hora>=6 && hora<12) {
      try {await baseResposta('/api/painel?area=diario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'base_resumo'})});}
      catch {contexto.alertaBase=`${contexto.alertaBase||''} A base desta manhã não pôde ser registrada; conferir amanhã.`.trim();}
    }
    if(dayIso!==hojeReal) contexto.alertaBase=`${contexto.alertaBase||''} Data selecionada: ${resumoDiaCurto(dayIso)}. Hoje é ${resumoDiaCurto(hojeReal)}.`.trim();
  } catch(erro) {
    if(abertura===dailySummaryOpening && document.getElementById('daily-summary-loading')) {
      document.getElementById('daily-summary-loading').textContent=`Não foi possível ler a operação atual: ${erro.message}. Feche e tente novamente. Nenhuma mensagem foi gerada.`;
    }
    return;
  }
  if(abertura!==dailySummaryOpening || !document.getElementById('daily-summary-loading')) return;
  dailySummaryDate=dayIso;
  dailySummaryMessages=buildDailySummary(dayIso,contexto);
  dailySummarySelected='geral';
  openWorkflowModal(`<div class="workflow-kicker"><span>Comunicação interna · ${safeText(resumoDiaCurto(dayIso))}</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()" aria-label="Fechar resumo">×</button></div>
    <h2 class="workflow-title">Resumo por grupo</h2>
    <p class="daily-summary-meta">Escolha o destino, revise e copie. Dados consultados agora. Criação usa prazo; Publicações usa veiculação e antecipa amanhã (sábado e domingo às sextas). A busca e os filtros da lista não limitam este resumo. Nada é enviado automaticamente.</p>
    <div class="resumo-grade">
    <div class="resumo-lado">
    <label class="workflow-field resumo-select"><span>Grupo do WhatsApp</span><select id="daily-summary-group" onchange="selectDailySummary();marcarGrupoDoResumo()">${dailySummaryMessages.map(m=>`<option value="${m.id}">${safeText(m.nome)}</option>`).join('')}</select></label>
    <div class="resumo-grupos" role="radiogroup" aria-label="Grupo do WhatsApp">${dailySummaryMessages.map((m,i)=>`<button type="button" role="radio" aria-checked="${i===0}" class="resumo-grupo${i===0?' on':''}" data-grupo="${m.id}" onclick="escolherGrupoDoResumo('${m.id}')"><i aria-hidden="true"></i>${safeText(m.nome)}</button>`).join('')}</div>
    <p class="daily-summary-meta">Conteúdos usam veiculação; solicitações usam conclusão ou prazo. Finalizado, Para agendar e Agendado são contados separadamente, conforme o status da atividade. Produção consulta gravações no Google Agenda. Criação: design com mínimo de 5 demandas por pessoa, conforme disponibilidade; editor com 4. Aprovações de Deivid entram à parte.</p>
    </div>
    <div class="resumo-whats">
    <div class="resumo-whats-topo"><span class="resumo-whats-av" aria-hidden="true">V</span><span><b id="daily-summary-nome">${safeText(dailySummaryMessages[0].nome)}</b><small>prévia da mensagem · dá para editar antes de copiar</small></span></div>
    <p id="daily-summary-personal" class="daily-summary-meta" hidden>Uso pessoal. Estes pontos são para sua conferência, fora das mensagens dos grupos.</p>
    <p id="daily-summary-agenda-status" class="daily-summary-meta" hidden>Gravações e captações dos hoje e dos próximos 5 dias · horário de Brasília. <button type="button" class="workflow-secondary" onclick="loadDailySummaryAgenda()">Consultar agenda novamente</button></p>
    <textarea id="daily-summary-preview" class="daily-summary-preview" aria-label="Mensagem para revisar e copiar">${safeText(dailySummaryMessages[0].texto)}</textarea>
    </div>
    </div>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button><button type="button" id="daily-summary-copy" class="workflow-primary" onclick="copyDailySummary()">Copiar mensagem</button></div>`);
}
async function copyDailySummary() {
  const area=document.getElementById('daily-summary-preview'); if(!area) return;
  const mensagem=dailySummaryMessages.find(m=>m.id===dailySummarySelected);
  if(mensagem?.agenda && !mensagem.pronta) return showToast('Aguarde a consulta da agenda antes de copiar.','info');
  const text=area.value;
  try {
    if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else { area.focus(); area.select(); if(!document.execCommand('copy')) throw new Error('A cópia não foi autorizada pelo navegador.'); }
    const nome=dailySummaryMessages.find(m=>m.id===document.getElementById('daily-summary-group')?.value)?.nome || 'escolhido';
    showToast(`Resumo copiado. Cole no grupo ${nome}.`,'ok',5000);
  } catch(error) { area.focus(); area.select(); showToast('Selecione e copie manualmente a mensagem.','info',5000); }
}

// ─── Renderizar semana ────────────────────────────────────────────────────────
function renderWeek(sem, filter, dayFilter) {
  if (viewMode === 'day') { renderByDay(sem, filter, dayFilter); updateClearFiltersState(); return; }
  if (typeof pv2SairDosDias === 'function') pv2SairDosDias(sem);
  const items = getItemsBySemana(sem);
  const porCliente = groupByCliente(items);
  const dias = getDiasSemana(sem);
  const grid = document.getElementById(`grid-s${sem}`);
  if (!grid) return;
  aplicarLayoutDosDias(grid, sem, false);
  let clientes = Object.keys(porCliente).sort();
  // Sempre: pendentes primeiro, finalizados depois
  clientes = clientes.sort((a,b) => {
    const aItems = porCliente[a]||[];
    const bItems = porCliente[b]||[];
    const aDone = aItems.length > 0 && aItems.every(d => d.status === 'Finalizado');
    const bDone = bItems.length > 0 && bItems.every(d => d.status === 'Finalizado');
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    return 0;
  });
  if (sortCritico) {
    clientes = clientes.sort((a,b) => {
      const qa = (porCliente[a]||[]).length;
      const qb = (porCliente[b]||[]).length;
      return qa - qb; // menos posts primeiro
    });
  }
  grid.innerHTML = clientes.map(c=>renderClientCard(c, porCliente[c]||[], dias, filter, dayFilter||currentDayFilter)).join("");
  pintarSeletorDeSemana();
  updateClearFiltersState();
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
function renderKPIs() { /* integrado no compact summary */ }

// ─── Progresso Geral ───────────────────────────────────────────────────────
function renderCompactSummary() {
  pintarFiltroCarteira();
  const all = DADOS.filter(itemNaCarteira);
  const total = all.length;
  const clientes = [...new Set(all.flatMap(clientesDoItem))];
  const numWeeks = META.weeks ? META.weeks.length : 4;
  const done = all.filter(d => ['Finalizado'].includes(d.status)).length;
  const podeFazer = all.filter(d => d.status === 'Pode Fazer').length;
  const pendentes = all.filter(d => ['A Fazer','Falta D.A'].includes(d.status)).length;
  const captacao = all.filter(d => d.status === 'Aguardo').length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  let clientesLow = 0;
  clientes.forEach(c => { for (let w = 1; w <= numWeeks; w++) { if ((groupByCliente(getItemsBySemana(w))[c] || []).length < 3) { clientesLow++; break; } } });
  // Hoje: usar a mesma fonte temporal devolvida pela sincronização do Monday.
  const todayIso = HOJE_ISO || new Date().toISOString().slice(0, 10);
  const todayItems = DADOS.filter(itemNaCarteira).filter(d => d.veiculacao_iso === todayIso);
  const todayPending = todayItems.filter(d => !['Finalizado'].includes(d.status)).length;

  // Eram oito números do mesmo tamanho, cada um com uma cor. Oito destaques é
  // nenhum destaque: o olho não sabia por onde começar. Agora um número lidera
  // — quanto da semana está fechado —, o dia vem em seguida, e o resto é
  // detalhe em texto quieto. Cor só onde ela quer dizer risco.

  // Padrão visual: os números viram cartões. Um lidera (a semana fechada, com
  // o anel), o dia vem ao lado e o resto fica junto num cartão só.
  // Os números dizem o que fazer (quadro 01 do redesign, 10/11/2026): cada cartão que pede ação tem o link dela, pelas
  // mesmas filas e filtros da barra. O antigo "Na semana" espremido virou o cartão dos clientes com menos de 3 posts e
  // uma linha de resumo com as outras contagens.
  const cartao = (cls, conteudo) => `<div class="pv-kpi ${cls}">${conteudo}</div>`;
  const acao = (rotulo, onclick) => `<button type="button" class="pv-kpi-acao" onclick="${onclick}">${rotulo} <i aria-hidden="true">→</i></button>`;
  const linha = (valor, rotulo, onclick = '') => onclick && valor > 0
    ? `<button type="button" class="pv-kpi-linha-item" onclick="${onclick}"><b>${valor}</b> ${rotulo}</button>`
    : `<span class="pv-kpi-linha-item"><b>${valor}</b> ${rotulo}</span>`;
  document.getElementById('compact-summary').innerHTML =
    cartao('pv-kpi-semana', `<span class="pv-anel" style="--p:${pct}"><i>${done}/${total}</i></span>
      <div><small>Semana fechada</small><span><b>${pct}%</b> ${done} de ${total} ${total === 1 ? 'peça' : 'peças'}</span></div>`) +
    cartao(todayPending > 0 ? 'pv-kpi-risco' : '', `<b>${todayItems.length}</b><div><small>Publica hoje</small>
      <span>${todayItems.length === 0 ? 'nada publica hoje' : todayPending > 0 ? `<em>${todayPending} sem estar pronto</em>` : 'tudo pronto'}</span>
      ${todayPending > 0 ? acao('Resolver', "abrirDoResumo('hoje')") : todayItems.length ? acao('Ver', "abrirDoResumo('hoje')") : ''}</div>`) +
    cartao(pendentes > 0 ? 'pv-kpi-atencao' : '', `<b>${pendentes}</b><div><small>Pendentes</small><span>a fazer ou falta D.A</span>
      ${pendentes > 0 ? acao('Ver', "abrirDoResumo('acao')") : ''}</div>`) +
    cartao(clientesLow > 0 ? 'pv-kpi-atencao' : '', `<b>${clientesLow}</b><div><small>Com menos de 3 posts</small>
      <span>${clientesLow === 1 ? 'cliente' : 'clientes'} em alguma semana</span>
      ${clientesLow > 0 ? acao(clientesLow === 1 ? 'Ver qual' : 'Ver quais', 'verClientesComPoucosPosts()') : ''}</div>`) +
    `<p class="pv-kpi-linha" aria-label="Na semana"><span class="pv-kpi-linha-rot">Na semana</span>${linha(clientes.length, clientes.length === 1 ? 'cliente' : 'clientes')}${linha(podeFazer, 'pode fazer', "filtrarStatusDoResumo('Pode Fazer')")}${linha(captacao, 'em captação', "filtrarStatusDoResumo('Aguardo')")}</p>`;
  if (typeof pv2PintarAlto === 'function') pv2PintarAlto({ pct, feitas: done, total, hoje: todayItems.length, hojePendente: todayPending, pendentes, poucosPosts: clientesLow });
}
// Os links dos cartões: abrem a mesma fila da barra (Requer ação, Vence hoje) e descem até ela, sem fechar se já estiver aberta.
function abrirDoResumo(nome, filtro = 'hoje') {
  const p = PAINEIS_DA_BARRA[nome];
  if (!p) return;
  // A aba Vence hoje abre no recorte de quem chamou: "Ver as 12" (de hoje), "Ver as N" vencidas do mês, ou tudo (a ficha da barra).
  if (nome === 'hoje') { FILA_V2.pedido = filtro; if (p.aberto() && FILA_V2.hoje !== filtro) filaV2Filtrar(filtro); }
  if (!p.aberto()) alternarPainelDaBarra(nome);
  // No mundo a fila é a janela V2 (prancha V2-S-Ver-As-N): não há o que rolar até ela.
  if (typeof pv2Ligado === 'function' && pv2Ligado()) return;
  setTimeout(() => document.getElementById(nome === 'hoje' ? 'ops-today-panel' : 'ops-action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}
// "Ver qual": liga o "Crítico primeiro" (clientes com menos posts primeiro) e desce até a agenda da semana.
function verClientesComPoucosPosts() {
  if (!sortCritico) toggleSortCritico(document.getElementById('sort-critico-btn'));
  mostrarAgendaDaSemana();
}
// O mesmo filtro de Status da barra, pela pílula da legenda.
function filtrarStatusDoResumo(status) {
  const pilula = [...document.querySelectorAll('#status-legend .pill')].find((p) => p.getAttribute('onclick')?.includes(`'${status}'`));
  if (pilula && currentFilter !== 'status:' + status) filterByStatus(status, pilula);
  mostrarAgendaDaSemana();
}

// ─── Resumo do Dia ──────────────────────────────────────────────────────────
function renderDaySummary() {
  const todayIso = HOJE_ISO || new Date().toISOString().slice(0,10);
  const todayStr = todayIso ? `${todayIso.slice(8,10)}/${todayIso.slice(5,7)}` : '—';
  const todayItems = DADOS.filter(itemNaCarteira).filter(d => d.veiculacao_iso === todayIso);
  const pending = todayItems.filter(d => !['Finalizado'].includes(d.status));
  const done = todayItems.filter(d => d.status === 'Finalizado');
  const scheduled = todayItems.filter(d => d.status === 'Agendado');
  const el = document.getElementById('day-summary');
  if (todayItems.length === 0) { el.innerHTML = `<span class="day-summary-label">Hoje (${todayStr})</span><span class="day-summary-item">Nenhum conteúdo agendado para hoje</span>`; return; }
  el.innerHTML = `
    <span class="day-summary-label">Hoje (${todayStr})</span>
    <span class="day-summary-item"><strong>${todayItems.length}</strong> posts hoje</span>
    <span class="day-summary-item" style="color:#00ff88"><strong>${done.length + scheduled.length}</strong> prontos</span>
    ${pending.length > 0 ? `<span class="day-summary-item critical"><strong>${pending.length}</strong> pendentes</span>` : ''}
  `;
}

// ─── Central operacional ─────────────────────────────────────────────────────
let showAllActionItems = false;
const ACTION_STATUSES = ['A Fazer','Falta D.A','Falta Info','Alteração','Aguardo','Pode Fazer','Em andamento','Para aprovação','Ag. Aprovação Cliente','Ag. Info Cliente','Ag. Interno'];

// Texto que entra num argumento '...' de onclick/onchange: escapa barra, aspas e quebras para o JS e depois o HTML
// (auditoria 15/11/2026: com só safeText, a aspa vira &#039; e o navegador devolve a aspa ao JS antes de rodar).
const JS_ARG_RE = new RegExp('[\\\\\'"\\x00-\\x1f' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
function jsArg(value) {
  return safeText(String(value ?? '').replace(JS_ARG_RE, (c) => (c === '\\' || c === "'" || c === '"' ? '\\' + c : '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))));
}
function safeText(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function getActionItems(sem = currentWeek) {
  return getItemsBySemana(sem).filter(d => ACTION_STATUSES.includes(d.status) || ['critical','high','attention'].includes(d.operational_risk?.level));
}

let showTodayQueue = false;
function opsTodayIso(){ return HOJE_ISO || new Date().toISOString().slice(0,10); }
function opsOpenItem(d){ return !['Finalizado','Feito','Para agendar','Agendado'].includes(d.status); }
function opsSelectedScope(){ return DADOS.filter(itemNaCarteira).filter(d => getDateIso(d) && itemMatchesSelectedPeople(d)); }
function opsOwners(d){ const ids=[...(d.responsavel_ids||[]),d.responsavel_id].filter(Boolean).map(String); const users=TEAM_USERS.filter(user=>ids.includes(String(user.id))); return users.length?users:[{id:'unassigned',name:'Sem responsável',color:'#7b8798',photo:''}]; }
// Os números da pessoa escolhida (entregas abertas, riscos, vencem hoje): a faixa antiga e a linha dos chips da V2 de Grupos.
function opsSelectionNumeros(){
  const scope=opsSelectedScope().filter(opsOpenItem);
  const risks=scope.filter(d=>ACTION_STATUSES.includes(d.status)||['critical','high','attention'].includes(d.operational_risk?.level)).length;
  const today=opsTodayIso(); const due=scope.filter(d=>getDateIso(d)===today).length;
  return { scope, risks, due };
}
function renderOpsSelectionSummary(){
  const el=document.getElementById('ops-selection-summary'); if(!el) return;
  const users=TEAM_USERS.filter(user=>selectedPersonIds.has(String(user.id)));
  if(!users.length){ el.classList.remove('open'); el.innerHTML=''; return; }
  const { scope, risks, due }=opsSelectionNumeros();
  const names=users.map(user=>safeText(firstName(user.name))).join(' + ');
  el.innerHTML=`<span class="ops-selection-dot"></span><b>${names}</b><span>· ${users.length} pessoa${users.length===1?'':'s'} · ${scope.length} entregas · ${risks} riscos · ${due} vencem hoje</span>`;
  el.classList.add('open');
}
function opsTodayItems(){
  const today=opsTodayIso();
  return opsSelectedScope().filter(d=>opsOpenItem(d) && getDateIso(d)<=today).sort((a,b)=>{ const ad=getDateIso(a),bd=getDateIso(b); return ad.localeCompare(bd)||Number(a.operational_risk?.score??99)-Number(b.operational_risk?.score??99)||a.nome.localeCompare(b.nome); });
}
function toggleTodayQueue(){ FILA_V2.pedido = 'todas'; alternarPainelDaBarra('hoje'); }
function renderTodayQueue(){
  const painel=document.getElementById('ops-today-panel');
  if(!painel) return;
  const hoje=opsTodayIso();
  const items=opsTodayItems();
  const count=document.getElementById('ops-today-count');
  if(count) count.textContent=items.length;

  // Agrupado por pessoa, como já era: a pergunta aqui é "o que cada um tem para
  // entregar hoje". O que mudou é a linha — e o atraso, que agora tem nome.
  const grupos=new Map();
  items.forEach(d=>opsOwners(d).forEach(owner=>{
    const chave=String(owner.id);
    if(!grupos.has(chave)) grupos.set(chave,{owner,items:[]});
    grupos.get(chave).items.push(d);
  }));
  const motivoDoDia=(d)=>{
    const data=getDateIso(d);
    if(data && data<hoje){
      const dias=Math.max(1,Math.round((new Date(hoje+'T12:00:00')-new Date(data+'T12:00:00'))/86400000));
      return { chave:'vencido', rotulo:`Atrasado ${dias} ${dias===1?'dia':'dias'}` };
    }
    return { chave:'hoje', rotulo:'Vence hoje' };
  };
  const atrasados=items.filter(d=>getDateIso(d)<hoje).length;

  const blocos=[...grupos.values()]
    .sort((a,b)=>b.items.length-a.items.length||String(a.owner.name).localeCompare(String(b.owner.name),'pt-BR'))
    .map(({owner,items:doDono})=>{
      const avatar=typeof ownerAvatarHtml==='function' ? ownerAvatarHtml(owner)
        : `<span class="acao-avatar">${safeText(firstName(owner.name||'?').slice(0,2).toUpperCase())}</span>`;
      const linhas=doDono
        .sort((a,b)=>String(getDateIso(a)).localeCompare(String(getDateIso(b)))||String(a.nome).localeCompare(String(b.nome),'pt-BR'))
        .map(d=>filaLinhaHtml(d,motivoDoDia(d),{rotulo:true})).join('');
      return `<section class="acao-bloco">
        <div class="acao-bloco-topo acao-bloco-pessoa">${avatar}<span>${safeText(firstName(owner.name)||'Sem responsável')}</span>
          <b>${doDono.length} ${doDono.length===1?'entrega':'entregas'}</b></div>
        ${linhas}
      </section>`;
    }).join('');

  painel.innerHTML=`<div class="acao-topo">
      <div><b>O que vence hoje</b><small>${safeText(planningDateBr(hoje))} · ${items.length} ${items.length===1?'atividade':'atividades'}${
        atrasados?` · ${atrasados} ${atrasados===1?'atrasada':'atrasadas'}`:''}</small></div>
    </div>
    ${blocos||'<div class="acao-vazio">Nada vence hoje por aqui.</div>'}`;
}
let showDailyClose=false;
function opsOwnerLabel(d){ return opsOwners(d).map(owner=>firstName(owner.name)).join(', '); }
function opsUpdatedToday(d){ return String(d?.updated_at||'').slice(0,10)===opsTodayIso(); }
function toggleDailyClose(){ alternarPainelDaBarra('fechamento'); }
function renderDailyClose(){
  const panel=document.getElementById('ops-daily-panel'); if(!panel)return; const today=opsTodayIso(); const scope=opsSelectedScope();
  const finalizedToday=scope.filter(d=>['Finalizado','Feito'].includes(d.status)&&opsUpdatedToday(d));
  const ongoing=scope.filter(d=>d.status==='Em andamento');
  const blockerStatuses=new Set(['Falta Info','Falta D.A','Aguardo','Ag. Info Cliente','Ag. Aprovação Cliente','Alteração','Ag. Interno']);
  const carry=scope.filter(d=>opsOpenItem(d)&&(getDateIso(d)<today||blockerStatuses.has(d.status))).sort((a,b)=>getDateIso(a).localeCompare(getDateIso(b))||a.nome.localeCompare(b.nome));
  // A MESMA LINHA DA MESA DE COMANDO, AQUI.
  //
  // Eram três cartões roxos de KPI e listas com o responsável jogado à direita,
  // colado na etiqueta. Agora os números são uma leitura em uma linha e as duas
  // listas usam a linha de duas alturas: peça em cima, cliente e quem responde
  // embaixo, status à direita.
  const linha = (d) => `<div class="ops-linha${pv2Ligado() ? pv2Chegou(d) : ''}" role="button" tabindex="0" title="Abrir ${safeText(d.nome)}"
      onclick="openItemWorkspace('${d.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openItemWorkspace('${d.id}')}">
      <div class="ops-linha-corpo"><b>${safeText(d.nome)}</b>
        <span class="ops-linha-apoio"><span class="ops-linha-cliente">${safeText(d.cliente || 'Sem cliente')}</span>${
          opsOwnerLabel(d) ? `<span>${safeText(opsOwnerLabel(d))}</span>` : '<span class="ops-linha-sem">sem responsável</span>'}</span>
      </div>
      ${pv2Ligado() ? pv2StatusBotao(d) : pillHtml(d.status, d.status_color, d.status_border)}
    </div>`;
  const lista = (items, empty) => items.length
    ? items.slice(0, 5).map(linha).join('') + (items.length > 5 ? `<div class="ops-linha-mais">+ ${items.length - 5} no painel</div>` : '')
    : `<div class="ops-daily-empty">${empty}</div>`;
  const leitura = [
    [finalizedToday.length, 'finalizadas hoje'],
    [ongoing.length, 'em execução'],
    [carry.length, 'riscos ou bloqueios'],
  ].map(([n, r]) => `<span class="ops-daily-numero"><b>${n}</b>${r}</span>`).join('');
  panel.innerHTML = `<div class="ops-panel-title"><span>Fechamento do dia · ${safeText(today.split('-').reverse().join('/'))}</span></div>
    <div class="ops-daily-leitura" title="Leitura do contexto atual">${leitura}</div>
    <div class="ops-daily-section"><div class="ops-daily-section-head" title="Clique numa peça para abrir"><span>Em execução ao encerrar</span></div>${
      lista(ongoing, 'Nenhuma entrega permanece em execução.')}</div>
    <div class="ops-daily-section"><div class="ops-daily-section-head" title="Atraso ou bloqueio"><span>Riscos que atravessam</span></div>${
      lista(carry, 'Nenhum risco ou bloqueio precisa atravessar para o próximo ciclo.')}</div>`;
}
function renderOperationalTools() {
  renderTeamLoad();
  renderOpsSelectionSummary();
  renderActionQueue();
  renderTodayQueue();
  renderDailyClose();
  renderVisaoDeGrupos();
  if (typeof renderFeedDoCliente === 'function') renderFeedDoCliente();
  pintarBarraDeComando();
}

function renderTeamLoad() {
  const strip = document.getElementById('team-load-strip');
  if (!strip) return;
  const items = getActionItems(currentWeek);
  const loads = TEAM_USERS.map(user => {
    const count = items.filter(d => (d.responsavel_ids || []).includes(user.id) || d.responsavel_id === user.id).length;
    return {...user, count};
  }).filter(user => user.count > 0).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  if (!loads.length) {
    strip.innerHTML = '<span class="team-load-label">Carga da equipe</span><span style="color:#00ff88;font-size:10px;white-space:nowrap;">✓ sem pendências nesta semana</span>';
    return;
  }
  strip.innerHTML = `<span class="team-load-label">Carga da equipe</span>${loads.map(user => {
    const avatar = user.photo
      ? `<img class="team-load-avatar" src="${user.photo}" alt="${safeText(user.name)}" onerror="this.outerHTML='<span class=team-load-avatar-fallback style=background:${user.color}>${user.name.slice(0,2).toUpperCase()}</span>'">`
      : `<span class="team-load-avatar-fallback" style="background:${user.color}">${user.name.slice(0,2).toUpperCase()}</span>`;
    return `<button class="team-load-chip" style="--load-color:${user.color}" title="Filtrar pendências de ${safeText(user.name)}" onclick="filterByPerson('${user.id}', document.querySelector('#person-filter-bar .person-wrap[data-person-id=&quot;${user.id}&quot;]') || document.getElementById('person-all'))">${avatar}<span>${safeText(firstName(user.name))}</span><span class="team-load-number">${user.count}</span></button>`;
  }).join('')}`;
}

// ── os botões da barra de comando, uma lógica só ─────────────────────────────
//
// Eram seis interruptores independentes: cada um com a sua variável de estado,
// o seu jeito de marcar o botão e a sua decisão sobre lembrar ou não entre
// visitas — dois lembravam, quatro esqueciam. E nenhum fechava os outros, então
// dava para deixar os seis painéis abertos ao mesmo tempo, empilhados.
//
// Aqui eles viram um registro só, em dois grupos que se excluem por dentro:
//
//   consulta — painéis que abrem logo abaixo da barra. Dois abertos ao mesmo
//              tempo empurram um ao outro; só um por vez.
//   visão    — blocos grandes de conteúdo. Também um por vez: são duas
//              maneiras de olhar a mesma operação, não duas coisas para ver
//              juntas.
//
// 'Modo Reunião' e 'Sem filtros' ficam de fora de propósito: um abre uma tela
// por cima, o outro é uma ação que acontece e acaba. Não são estado, e não
// devem parecer estado.
const PAINEIS_DA_BARRA = {
  // No mundo (pv2Ligado) as duas filas são as abas da janela V2 (filaV2Abrir, prancha V2-S-Ver-As-N); fora dele, os
  // painéis no lugar de antes.
  acao: {
    grupo: 'consulta', botao: 'ops-action-btn',
    aberto: () => (pv2Ligado() ? filaV2Aberta() && FILA_V2.aba === 'acao' : document.getElementById('ops-action-panel')?.classList.contains('open') || false),
    definir: (v) => {
      if (!pv2Ligado()) return document.getElementById('ops-action-panel')?.classList.toggle('open', v);
      if (v) filaV2Abrir('acao'); else if (FILA_V2.aba === 'acao') filaV2Fechar();
    },
  },
  hoje: {
    grupo: 'consulta', botao: 'ops-today-btn',
    aberto: () => (pv2Ligado() ? filaV2Aberta() && FILA_V2.aba === 'hoje' : showTodayQueue),
    definir: (v) => {
      if (!pv2Ligado()) { showTodayQueue = v; document.getElementById('ops-today-panel')?.classList.toggle('open', v); return; }
      if (v) { filaV2Abrir('hoje', { hoje: FILA_V2.pedido || 'hoje' }); FILA_V2.pedido = ''; } else if (FILA_V2.aba === 'hoje') filaV2Fechar();
    },
  },
  fechamento: {
    grupo: 'consulta', botao: 'ops-daily-close-btn',
    aberto: () => showDailyClose,
    definir: (v) => { showDailyClose = v; document.getElementById('ops-daily-panel')?.classList.toggle('open', v); },
  },
  comando: {
    grupo: 'consulta', botao: 'manager-command-toggle',
    aberto: () => managerCommandDrawerOpen,
    definir: (v) => { managerCommandDrawerOpen = v; if (!v) managerCommandInsight = null; renderManagerIntelligence(); },
  },
  grupos: {
    grupo: 'visao', botao: 'ops-grupos-btn', lembra: () => GRUPOS_VISAO, alvo: 'grupos-board',
    aberto: () => visaoDeGruposAberta,
    definir: (v) => { visaoDeGruposAberta = v; renderVisaoDeGrupos(); },
  },
  calendario: {
    grupo: 'visao', botao: 'ops-agenda-btn', lembra: () => AGENDA_ABERTA, alvo: 'manager-calendar',
    aberto: () => agendaMensalAberta,
    definir: (v) => { agendaMensalAberta = v; renderManagerCalendar(); },
  },
  // Feed do cliente (vybe-feed.js, Paulo 15/11/2026): a grade do Instagram de cada cliente com o que vai sair.
  feed: {
    grupo: 'visao', botao: 'ops-feed-btn', lembra: () => FEED_LEMBRA, alvo: 'feed-board',
    aberto: () => (typeof feedAberto !== 'undefined' ? feedAberto : false),
    definir: (v) => { if (typeof feedAberto === 'undefined') return; feedAberto = v; renderFeedDoCliente(); },
  },
};

function definirPainel(nome, valor) {
  const p = PAINEIS_DA_BARRA[nome];
  if (!p) return;
  p.definir(valor);
  if (p.lembra) { try { localStorage.setItem(p.lembra(), valor ? '1' : '0'); } catch { /* sem storage */ } }
}

function alternarPainelDaBarra(nome) {
  const p = PAINEIS_DA_BARRA[nome];
  if (!p) return;
  const abrindo = !p.aberto();
  // Fecha os irmãos do mesmo grupo: é o que faltava, e o que fazia a tela
  // acumular painel sobre painel.
  if (abrindo) {
    Object.entries(PAINEIS_DA_BARRA)
      .filter(([outro, o]) => outro !== nome && o.grupo === p.grupo && o.aberto())
      .forEach(([outro]) => definirPainel(outro, false));
  }
  definirPainel(nome, abrindo);
  pintarBarraDeComando();
  if (abrindo && p.alvo) {
    setTimeout(() => document.getElementById(p.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

// Um lugar só decide como o botão aparece. Antes cinco trechos diferentes
// mexiam na classe 'active', e por isso um deles podia ficar para trás.
function pintarBarraDeComando() {
  Object.values(PAINEIS_DA_BARRA).forEach((p) => {
    const b = document.getElementById(p.botao);
    if (!b) return;
    const aberto = p.aberto();
    // Só mexe quando muda de verdade. Esta função roda a cada ciclo de desenho;
    // reescrever a classe com o mesmo valor reinicia a transição do botão, e ele
    // pisca sem nada ter mudado.
    if (b.classList.contains('active') !== aberto) b.classList.toggle('active', aberto);
    const dito = b.getAttribute('aria-expanded') === 'true';
    if (dito !== aberto) b.setAttribute('aria-expanded', String(aberto));
  });
  const semana = document.getElementById('ops-semana-btn');
  if (semana) {
    const semVisao = !Object.values(PAINEIS_DA_BARRA).some((o) => o.grupo === 'visao' && o.aberto()) && !document.getElementById('arquivadas-painel');
    const naSemana = semVisao && !equipeNaTela();
    if (semana.classList.contains('active') !== naSemana) semana.classList.toggle('active', naSemana);
    semana.setAttribute('aria-expanded', String(naSemana));
    const equipe = document.getElementById('ops-equipe-btn');
    if (equipe) { const naEquipe = semVisao && equipeNaTela(); if (equipe.classList.contains('active') !== naEquipe) equipe.classList.toggle('active', naEquipe); equipe.setAttribute('aria-expanded', String(naEquipe)); }
  }
  const arquivo = document.getElementById('ops-arquivo-btn');
  if (arquivo) arquivo.classList.toggle('active', Boolean(document.getElementById('arquivadas-painel')));
  if (typeof pv2PintarControles === 'function') pv2PintarControles();
}

// "Ver como": a agenda da semana é a visão de sempre. Ela fica marcada quando
// nenhuma outra visão (grupos, calendário do mês, arquivo) está aberta, e
// clicar nela fecha as outras.
// "Equipe" é uma visão como as outras (Paulo, 27/10/2026: o botão ficava
// marcado e o calendário continuava por cima): fecha grupos, calendário e
// arquivo e mostra a carga de cada pessoa. A agenda da semana volta dela.
const equipeNaTela = () => Boolean(document.getElementById('panel-team')?.classList.contains('active'));
function fecharVisoesDaBarra() {
  Object.entries(PAINEIS_DA_BARRA).filter(([, o]) => o.grupo === 'visao' && o.aberto()).forEach(([nome]) => definirPainel(nome, false));
  if (document.getElementById('arquivadas-painel')) alternarArquivo();
}
function mostrarEquipeDaSemana(botao) {
  fecharVisoesDaBarra();
  showWeek(0, botao);
  pintarBarraDeComando();
  document.getElementById('ops-equipe-btn')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function mostrarAgendaDaSemana() {
  fecharVisoesDaBarra();
  if (equipeNaTela()) showWeek(typeof currentWeek === 'number' && currentWeek > 0 ? currentWeek : 1, null);
  pintarBarraDeComando();
  document.getElementById('ops-semana-btn')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function toggleActionQueue() { alternarPainelDaBarra('acao'); }


// A FILA "REQUER AÇÃO" — o motivo primeiro, e o que resolver junto.
//
// Era uma fileira de etiquetas: id, cliente, status e data, com o nome da peça
// espremido e o motivo cortado no meio ("ven…"). E misturava tudo — prazo
// vencido ao lado de "pode fazer" —, então os 48 itens não diziam por onde
// começar. Agora cada linha diz POR QUE está aqui, a fila é dividida por motivo
// na ordem de urgência, e a marcação é a mesma do resto do painel: marcar duas
// linhas abre a barra de lote de sempre.
const ACAO_MOTIVOS = [
  { chave: 'vencido',   rotulo: 'Prazo vencido',         cor: '#ff7a88' },
  { chave: 'hoje',      rotulo: 'Vence hoje',            cor: '#ffc46b' },
  { chave: 'alteracao', rotulo: 'Alteração pedida',      cor: '#ff9ac4' },
  { chave: 'info',      rotulo: 'Falta informação',      cor: '#c79dff' },
  { chave: 'aprovacao', rotulo: 'Aguardando aprovação',  cor: '#7ab6ff' },
  { chave: 'semdono',   rotulo: 'Sem responsável',       cor: '#9aa0ad' },
  { chave: 'andando',   rotulo: 'Em execução',           cor: '#5fd6a4' },
];
const ACAO_STATUS_INFO = ['Falta Info', 'Falta D.A', 'Aguardo', 'Ag. Info Cliente', 'Ag. Interno', 'Aguardo Redação'];
const ACAO_STATUS_APROVACAO = ['Para aprovação', 'Ag. Aprovação Cliente', 'Em aprovação'];
let acaoFiltroMotivo = '';

function acaoMotivoDoItem(d) {
  const risco = d?.operational_risk?.level;
  const data = getDateIso(d);
  const hoje = opsTodayIso();
  if (risco === 'critical' || (data && data < hoje)) return 'vencido';
  if (data && data === hoje) return 'hoje';
  if (d.status === 'Alteração') return 'alteracao';
  if (ACAO_STATUS_INFO.includes(d.status)) return 'info';
  if (ACAO_STATUS_APROVACAO.includes(d.status)) return 'aprovacao';
  if (!(typeof assignedIds === 'function' ? assignedIds(d) : []).length) return 'semdono';
  return 'andando';
}

// A MESMA LINHA serve as duas filas da barra (Requer ação e O que vence hoje):
// marca do motivo, nome, cliente · responsável, status que troca ali, data e o
// atalho para o contexto. Duas listas com a mesma função não podem divergir.
function filaLinhaHtml(d, motivo, { rotulo = false } = {}) {
  const marcada = SELECIONADAS.has(String(d.id));
  const equipe = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const ids = (typeof assignedIds === 'function' ? assignedIds(d) : []).map(String);
  const nomes = ids.map((id) => equipe.find((u) => String(u.id) === id)).filter(Boolean).map((u) => firstName(u.name));
  const dono = nomes.join(', ') || String(d.responsavel || '').split(',').map((n) => n.trim().split(' ')[0]).filter(Boolean).join(', ') || 'Sem responsável';
  const apoio = [clientesDoItem(d).join(' · ') || 'Sem cliente', dono].filter(Boolean).join(' · ');
  const marca = rotulo
    ? `<span class="acao-motivo m-${motivo.chave}" title="${safeText(d.operational_risk?.reason || motivo.rotulo)}"><i aria-hidden="true"></i>${safeText(motivo.rotulo)}</span>`
    : `<span class="acao-marca m-${motivo.chave}" title="${safeText(d.operational_risk?.reason || motivo.rotulo)}" aria-label="${safeText(motivo.rotulo)}"></span>`;
  return `<article class="acao-linha${marcada ? ' marcada' : ''}${rotulo ? ' com-rotulo' : ''}${pv2Ligado() ? pv2Chegou(d) : ''}" data-id="${safeText(String(d.id))}"
      onclick="acaoAbrirPeca('${jsArg(String(d.id))}',event)" title="Abrir ${safeText(d.nome || 'a atividade')}">
      <label class="acao-marcar" onclick="event.stopPropagation()"><input type="checkbox" ${marcada ? 'checked' : ''}
        data-id="${safeText(String(d.id))}" onclick="filaMarcar(this,event)" aria-label="Marcar ${safeText(d.nome || 'atividade')}"></label>
      ${marca}
      <span class="acao-copy"><b>${safeText(d.nome || 'Sem título')}</b><small>${safeText(apoio)}</small></span>
      <span class="acao-status" onclick="event.stopPropagation()">${vybeStatus(d)}</span>
      <span class="acao-data">${safeText(planningDateBr(getDateIso(d)).slice(0, 5) || '—')}<small>${dateMode === 'prazo' ? 'Prazo' : 'Veiculação'}</small></span>
      <button type="button" class="acao-abrir" onclick="event.stopPropagation();openItemWorkspace('${jsArg(String(d.id))}')">Contexto</button>
    </article>`;
}

// Clicar na linha abre o cartão rápido — o mesmo do calendário e da mesa do DA —,
// que resolve status, responsável e datas sem sair da fila.
function acaoAbrirPeca(itemId, event) {
  if (event?.target?.closest?.('input, button, a, label, select')) return;
  if (typeof abrirCartaoRapido === 'function') return abrirCartaoRapido(String(itemId), event, 'content');
  openItemWorkspace(String(itemId));
}
// A ordem do shift sai do próprio painel, na sequência em que as linhas estão
// desenhadas — assim as duas filas usam o mesmo caminho sem guardar listas soltas.
function filaMarcar(campo, event) {
  const painel = campo.closest('.ops-panel') || document;
  const ordem = [...painel.querySelectorAll('.acao-linha')].map((linha) => linha.dataset.id);
  alternarSelecao(campo.dataset.id, campo.checked, event, ordem);
}
function acaoFiltrar(motivo) { acaoFiltroMotivo = acaoFiltroMotivo === motivo ? '' : motivo; renderActionQueue(); }

function renderActionQueue() {
  const panel = document.getElementById('ops-action-panel');
  const countEl = document.getElementById('ops-action-count');
  if (!panel || !countEl) return;
  const items = getActionItems(currentWeek);
  countEl.textContent = items.length;

  const porMotivo = new Map(ACAO_MOTIVOS.map((m) => [m.chave, []]));
  items.forEach((d) => porMotivo.get(acaoMotivoDoItem(d)).push(d));
  const ordenar = (lista) => lista.sort((a, b) => (getDateIso(a) || '9999-12-31').localeCompare(getDateIso(b) || '9999-12-31')
    || String(a.cliente).localeCompare(String(b.cliente), 'pt-BR'));

  const chips = ACAO_MOTIVOS.filter((m) => porMotivo.get(m.chave).length).map((m) => `
    <button type="button" class="acao-chip m-${m.chave}${acaoFiltroMotivo === m.chave ? ' ativo' : ''}"
      aria-pressed="${acaoFiltroMotivo === m.chave}" onclick="acaoFiltrar('${m.chave}')"><i aria-hidden="true"></i><b>${porMotivo.get(m.chave).length}</b> ${m.rotulo}</button>`).join('');

  const mostrados = ACAO_MOTIVOS.filter((m) => porMotivo.get(m.chave).length && (!acaoFiltroMotivo || acaoFiltroMotivo === m.chave));
  const LIMITE = 10;
  const blocos = mostrados.map((m) => {
    const lista = ordenar(porMotivo.get(m.chave));
    const visiveis = showAllActionItems ? lista : lista.slice(0, LIMITE);
    const restam = lista.length - visiveis.length;
    return `<section class="acao-bloco">
      <div class="acao-bloco-topo"><span class="acao-motivo m-${m.chave}"><i aria-hidden="true"></i>${m.rotulo}</span><b>${lista.length}</b></div>
      ${visiveis.map((d) => filaLinhaHtml(d, m)).join('')}
      ${restam > 0 ? `<button type="button" class="acao-mais" onclick="toggleAllActionItems()">Mostrar as outras ${restam}</button>` : ''}
    </section>`;
  }).join('');

  const semana = META.weeks && META.weeks[currentWeek - 1] ? META.weeks[currentWeek - 1].label : `Semana ${currentWeek}`;
  const rodape = showAllActionItems && items.length > LIMITE
    ? `<button type="button" class="acao-mais" onclick="toggleAllActionItems()">Mostrar menos</button>` : '';
  panel.innerHTML = `<div class="acao-topo">
      <div><b>Requer ação</b><small>${safeText(semana)} · ${items.length} ${items.length === 1 ? 'atividade' : 'atividades'}${
        acaoFiltroMotivo ? ' · filtrando por motivo' : ''}</small></div>
      <div class="acao-chips">${chips}</div>
    </div>
    ${blocos || '<div class="acao-vazio">Nada pendente nesta semana.</div>'}${rodape}`;
  // A janela V2 das filas acompanha cada repintura (dados novos, peça marcada, status trocado).
  if (typeof filaV2Aberta === 'function' && filaV2Aberta()) filaV2Pintar();
}

function toggleAllActionItems() {
  showAllActionItems = !showAllActionItems;
  renderActionQueue();
}

// ─── Padrão V2 · "Ver as N" vira janela (prancha V2-S-Ver-As-N, aprovada pelo Paulo em 19/11/2026) ──────────────────
// No mundo (pv2Ligado) as duas filas da barra, Requer ação e Vence hoje, deixam de abrir no meio do Painel e viram UMA
// janela com duas abas. Abre de todo lugar que já abria as filas: a ficha da barra, o "Ver as N" do Heitor, o pé
// "De olho", a Visão geral, a Agenda e Creators (todos passam por alternarPainelDaBarra ou abrirDoResumo).
// Esquerda: os motivos viram filtros, a lista vem em blocos por motivo (Vence hoje: por pessoa, como sempre foi) e cada
// linha tem marcar, cliente, peça, status que troca ali, data com quanto falta e o atalho para o contexto. Clicar na
// linha abre o cartão rápido. Direita: o bloco de lote (as mesmas funções da barra de lote), a contagem por motivo e o
// que o Heitor sugere. O Heitor só sugere: "pela carga" leva à Coordenação, onde quem coordena confirma cada troca pelo
// caminho de sempre (gravarResponsaveisDaPeca). Fora do mundo (?legado=1) as filas seguem no lugar de antes.
// Rodada S (frente e): a janela também abre com um recorte do contexto ({ chave, rotulo, filtro }), vindo da Agenda
// ("só o que é de captação e audiovisual") ou dos Creators ("só os clientes com creator em campanha"). O recorte vale
// para as duas abas e sai pelo chip "Só …" ou ao abrir de novo sem ele. O Heitor mostra, com nome, quem pega cada peça
// sem responsável (a mesma conta da Coordenação, pv2CoordSemana) e "Distribuir assim" grava as N, uma por vez, pelo
// caminho da Coordenação (gravarResponsaveisDaPeca), só com o sim de um dono.
const FILA_V2 = { aberta: false, aba: 'acao', motivo: '', hoje: 'hoje', limite: 0, pedido: '', recorte: null, heitor: { pergunta: false, rodando: false, i: 0, n: 0, resultado: null } };
const FILA_V2_CURTO = { vencido: 'Prazo vencido', hoje: 'Vence hoje', alteracao: 'Alteração', info: 'Falta info', aprovacao: 'Aprovação', semdono: 'Sem responsável', andando: 'Em execução' };
const FILA_V2_IC = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  ir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  status: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3"/></svg>',
  pessoa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.7.8 2.8 2.6 3 5.2"/></svg>',
  data: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};
function filaV2Aberta() { return FILA_V2.aberta && Boolean(document.getElementById('v2-fila')); }
function filaV2Abrir(aba, { hoje = 'hoje', recorte = null } = {}) {
  FILA_V2.aba = aba === 'hoje' ? 'hoje' : 'acao';
  if (FILA_V2.aba === 'hoje') FILA_V2.hoje = hoje;
  if (!FILA_V2.aberta) { FILA_V2.motivo = ''; FILA_V2.recorte = null; FILA_V2.heitor = { pergunta: false, rodando: false, i: 0, n: 0, resultado: null }; }
  if (recorte && typeof recorte.filtro === 'function') FILA_V2.recorte = { chave: String(recorte.chave || ''), rotulo: String(recorte.rotulo || 'o recorte'), filtro: recorte.filtro };
  FILA_V2.aberta = true; FILA_V2.limite = 0;
  let jan = document.getElementById('v2-fila');
  if (!jan) {
    const fundo = document.createElement('div');
    fundo.id = 'v2-fila-fundo'; fundo.className = 'vfa-fundo';
    fundo.onclick = () => filaV2Fechar();
    jan = document.createElement('section');
    jan.id = 'v2-fila'; jan.className = 'vfa d3-tema';
    jan.setAttribute('role', 'dialog'); jan.setAttribute('aria-modal', 'true'); jan.setAttribute('aria-labelledby', 'vfa-tit');
    document.body.append(fundo, jan);
    document.body.classList.add('vfa-aberta');
  }
  filaV2Pintar();
  setTimeout(() => jan.querySelector('.vfa-aba[aria-checked="true"]')?.focus?.({ preventScroll: true }), 30);
}
function filaV2Fechar() {
  FILA_V2.aberta = false;
  document.getElementById('v2-fila')?.remove();
  document.getElementById('v2-fila-fundo')?.remove();
  document.body.classList.remove('vfa-aberta');
  if (typeof pintarBarraDeComando === 'function') pintarBarraDeComando();
}
// As abas trocam a fila sem fechar a janela; a barra de comando fica sabendo (a ficha marcada é a da aba).
function filaV2Aba(aba) {
  if (FILA_V2.aba === aba) return;
  FILA_V2.motivo = '';
  filaV2Abrir(aba);
  if (typeof pintarBarraDeComando === 'function') pintarBarraDeComando();
}
function filaV2Filtrar(chave) {
  if (FILA_V2.aba === 'hoje') FILA_V2.hoje = chave;
  else FILA_V2.motivo = FILA_V2.motivo === chave ? '' : chave;
  FILA_V2.limite = 0;
  filaV2Pintar();
}
function filaV2SemRecorte() { FILA_V2.recorte = null; FILA_V2.limite = 0; filaV2Pintar(); }
// O recorte da Agenda: o que passa pela captação (audiovisual pela mesma regra da Coordenação, em Aguardo ou com
// captação marcada na peça).
function filaV2RecorteAgenda() {
  const audiovisual = (d) => (window.VybeCoordenacao?.disciplinaDe ? window.VybeCoordenacao.disciplinaDe(d) === 'audiovisual' : /reels|v[íi]deo|motion|capta|anima/i.test(String(d?.formato || '')));
  const captacao = (d) => String(d?.status || '') === 'Aguardo' || /^(sim|s|x|precisa|marcada?|agendada?)$/i.test(String(d?.captacao || '').trim());
  return { chave: 'agenda', rotulo: 'captação e audiovisual', filtro: (d) => audiovisual(d) || captacao(d) };
}
function filaV2AbrirDaAgenda() { filaV2Abrir('acao', { recorte: filaV2RecorteAgenda() }); }
// As sugestões do Heitor para as peças sem responsável desta fila: [{ d, para, nome }] na ordem da Coordenação.
function filaV2Sugestoes(itens) {
  const semDono = (itens || []).filter(pv2SemDono); if (!semDono.length) return { lista: [], semDono: 0, calculou: true };
  let r = null; try { r = pv2CoordSemana(); } catch { r = null; }
  const ids = new Set(semDono.map((d) => String(d.id))), T = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const lista = (r?.semDono || []).filter((x) => x.sugerido && ids.has(String(x.d?.id)))
    .map((x) => ({ d: semDono.find((d) => String(d.id) === String(x.d.id)) || x.d, para: String(x.sugerido), nome: firstName((T.find((u) => String(u.id) === String(x.sugerido)) || {}).name || '') || 'alguém do time' }));
  return { lista, semDono: semDono.length, calculou: Boolean(r) };
}
function filaV2PodeDistribuir() { try { return typeof SESSAO_ATUAL !== 'undefined' && Boolean(SESSAO_ATUAL?.dono); } catch { return false; } }
// "Distribuir assim": o 1º clique só pergunta; o sim grava cada uma pela função de sempre, na ordem da lista.
function filaV2Distribuir(passo) {
  const H = FILA_V2.heitor; if (H.rodando || !filaV2PodeDistribuir()) return null;
  if (passo === 'voltar') { H.pergunta = false; filaV2Pintar(); return null; }
  if (passo !== 'sim') { H.pergunta = true; H.resultado = null; filaV2Pintar(); return null; }
  const D = filaV2Dados(), S = filaV2Sugestoes(D.aba === 'hoje' ? D.base : D.acao);
  return filaV2GravarSugestoes(S.lista);
}
async function filaV2GravarSugestoes(lista) {
  const H = FILA_V2.heitor;
  if (typeof gravarResponsaveisDaPeca !== 'function') { H.pergunta = false; H.resultado = { ok: 0, falhas: lista.length, n: lista.length, erro: 'O painel ainda não carregou a edição de responsáveis.' }; filaV2Pintar(); return H.resultado; }
  Object.assign(H, { pergunta: false, rodando: true, i: 0, n: lista.length, resultado: null }); filaV2Pintar();
  let ok = 0;
  for (const x of lista) {
    H.i += 1; filaV2Pintar();
    try {
      const atual = (typeof findOperationalItem === 'function' && findOperationalItem(String(x.d.id))) || x.d;
      const antes = typeof assignedIds === 'function' ? assignedIds(atual).map(String) : [];
      if (typeof armOutboundMutationGuard === 'function') armOutboundMutationGuard('responsáveis');
      await gravarResponsaveisDaPeca(atual, [...new Set([...antes, x.para])]);
      ok += 1;
    } catch (e) { console.warn('[fila] Heitor não gravou', x.d?.id, e?.message || e); }
  }
  if (typeof saveProductionCache === 'function') saveProductionCache();
  if (typeof renderIntegratedOperationalViews === 'function') renderIntegratedOperationalViews();
  Object.assign(H, { rodando: false, resultado: { ok, falhas: lista.length - ok, n: lista.length } });
  if (typeof showToast === 'function') showToast(ok === lista.length ? `${ok} ${ok === 1 ? 'peça distribuída' : 'peças distribuídas'} como o Heitor sugeriu.` : `${ok} de ${lista.length} distribuídas; as outras não gravaram.`, ok === lista.length ? 'ok' : 'erro', 4200);
  filaV2Pintar();
  return H.resultado;
}
function filaV2Mais() { showAllActionItems = !showAllActionItems; FILA_V2.limite = 0; filaV2Pintar(); }
// Quanto falta para a data, em palavras: "venceu há 3 dias", "prazo hoje", "amanhã", "em 4 dias".
function filaV2Quando(iso, hoje = opsTodayIso(), modo = typeof dateMode !== 'undefined' ? dateMode : 'prazo') {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))) return { texto: 'sem data', tom: '' };
  const dias = Math.round((new Date(String(iso).slice(0, 10) + 'T12:00:00') - new Date(String(hoje).slice(0, 10) + 'T12:00:00')) / 86400000);
  if (dias < 0) return { texto: `venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, tom: 'r' };
  if (dias === 0) return { texto: `${modo === 'prazo' ? 'prazo' : 'no ar'} hoje`, tom: '' };
  if (dias === 1) return { texto: 'amanhã', tom: '' };
  return { texto: `em ${dias} dias`, tom: '' };
}
// Os grupos de cada aba. Requer ação: um bloco por motivo, na ordem de urgência. Vence hoje: um bloco por pessoa (a
// pergunta ali é "o que cada um tem para entregar"), filtrado em De hoje, Já vencidas ou Todas.
function filaV2Dados() {
  const ordenar = (lista) => lista.sort((a, b) => (getDateIso(a) || '9999-12-31').localeCompare(getDateIso(b) || '9999-12-31')
    || String(a.cliente).localeCompare(String(b.cliente), 'pt-BR'));
  const corta = (l) => (FILA_V2.recorte?.filtro ? l.filter((d) => { try { return FILA_V2.recorte.filtro(d); } catch { return false; } }) : l);
  const acao = corta(getActionItems(currentWeek));
  const porMotivo = new Map(ACAO_MOTIVOS.map((m) => [m.chave, []]));
  acao.forEach((d) => porMotivo.get(acaoMotivoDoItem(d)).push(d));
  const hojeIso = opsTodayIso(), doDia = corta(opsTodayItems());
  const deHoje = doDia.filter((d) => getDateIso(d) === hojeIso), vencidas = doDia.filter((d) => getDateIso(d) < hojeIso);
  if (FILA_V2.aba === 'acao') {
    const filtros = [{ chave: '', rotulo: 'Todos', n: acao.length }, ...ACAO_MOTIVOS.filter((m) => porMotivo.get(m.chave).length).map((m) => ({ chave: m.chave, rotulo: FILA_V2_CURTO[m.chave] || m.rotulo, n: porMotivo.get(m.chave).length, tom: m.chave === 'vencido' ? 'r' : '' }))];
    const grupos = ACAO_MOTIVOS.filter((m) => porMotivo.get(m.chave).length && (!FILA_V2.motivo || FILA_V2.motivo === m.chave))
      .map((m) => ({ chave: m.chave, rotulo: m.rotulo, itens: ordenar(porMotivo.get(m.chave)), motivo: m }));
    return { aba: 'acao', acao, doDia, deHoje, filtros, grupos, ativo: FILA_V2.motivo,
      motivos: ACAO_MOTIVOS.filter((m) => porMotivo.get(m.chave).length).map((m) => ({ chave: m.chave, rotulo: m.rotulo, n: porMotivo.get(m.chave).length })),
      semDono: acao.filter(pv2SemDono).length };
  }
  const base = FILA_V2.hoje === 'vencidas' ? vencidas : FILA_V2.hoje === 'todas' ? doDia : deHoje;
  const motivoDoDia = (d) => (getDateIso(d) < hojeIso ? { chave: 'vencido', rotulo: 'Prazo vencido' } : { chave: 'hoje', rotulo: 'Vence hoje' });
  const pessoas = new Map();
  base.forEach((d) => opsOwners(d).forEach((u) => { const k = String(u.id); if (!pessoas.has(k)) pessoas.set(k, { u, itens: [] }); pessoas.get(k).itens.push(d); }));
  const grupos = [...pessoas.values()].sort((a, b) => b.itens.length - a.itens.length || String(a.u.name).localeCompare(String(b.u.name), 'pt-BR'))
    .map(({ u, itens }) => ({ chave: 'p' + u.id, rotulo: u.id === 'unassigned' ? 'Sem responsável' : firstName(u.name) || 'Sem responsável', pessoa: u, itens: ordenar(itens), porItem: motivoDoDia }));
  const filtros = [{ chave: 'hoje', rotulo: 'De hoje', n: deHoje.length }, { chave: 'vencidas', rotulo: 'Já vencidas', n: vencidas.length, tom: 'r' }, { chave: 'todas', rotulo: 'Todas', n: doDia.length }];
  const semDono = base.filter(pv2SemDono).length;
  return { aba: 'hoje', base, acao, doDia, deHoje, filtros, grupos, ativo: FILA_V2.hoje,
    motivos: [{ chave: 'hoje', rotulo: 'Vence hoje', n: deHoje.length }, { chave: 'vencido', rotulo: 'Já vencidas', n: vencidas.length }], semDono };
}
function filaV2Linha(d, motivo) {
  const id = String(d.id), marcada = SELECIONADAS.has(id);
  const equipe = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const ids = (typeof assignedIds === 'function' ? assignedIds(d) : []).map(String);
  const nomes = ids.map((x) => equipe.find((u) => String(u.id) === x)).filter(Boolean).map((u) => firstName(u.name));
  const dono = nomes.join(', ') || String(d.responsavel || '').replace('—', '').split(',').map((n) => n.trim().split(' ')[0]).filter(Boolean).join(', ');
  const cliente = clientesDoItem(d)[0] || '';
  // Sem responsável pela regra única (pv2SemDono): id do Monday sem pessoa no cadastro tem dono, só não tem nome aqui.
  const apoio = [clientesDoItem(d).join(' · ') || 'Sem cliente', pv2SemDono(d) ? 'sem responsável' : dono || 'responsável sem cadastro'].join(' · ');
  const av = cliente && typeof logoDoClienteHtml === 'function' ? logoDoClienteHtml(cliente, { classe: 'vfa-av' })
    : `<i class="vfa-av" aria-hidden="true">${safeText(String(cliente || '?').trim().slice(0, 2).toUpperCase())}</i>`;
  const iso = getDateIso(d), q = filaV2Quando(iso);
  const nome = safeText(d.nome || 'a atividade');
  return `<article class="vfa-linha${marcada ? ' marcada' : ''}${pv2Chegou(d)}" data-id="${safeText(id)}" data-motivo="${safeText(motivo.chave)}"
      onclick="acaoAbrirPeca('${jsArg(id)}',event)" title="Abrir ${nome} no cartão rápido">
      <label class="vfa-marca" onclick="event.stopPropagation()"><input type="checkbox" ${marcada ? 'checked' : ''} data-id="${safeText(id)}"
        onclick="filaV2Marcar(this,event)" aria-label="Marcar ${nome}"><i aria-hidden="true">${FILA_V2_IC.ok}</i></label>
      ${av}
      <span class="vfa-peca"><b>${safeText(d.nome || 'Sem título')}</b><small>${safeText(apoio)}</small></span>
      <span class="vfa-st" onclick="event.stopPropagation()">${vybeStatus(d)}</span>
      <span class="vfa-data" title="${safeText(d.operational_risk?.reason || motivo.rotulo)}"><b>${safeText(planningDateBr(iso).slice(0, 5) || '—')}</b><small class="${q.tom}">${safeText(q.texto)}</small></span>
      <button type="button" class="vfa-ir" onclick="event.stopPropagation();filaV2Contexto('${jsArg(id)}')" aria-label="Abrir o contexto de ${nome}" title="Abrir o contexto">${FILA_V2_IC.ir}</button>
    </article>`;
}
// O contexto abre a gaveta da peça (que mora abaixo das janelas): a janela sai da frente; a ficha da barra reabre a fila.
function filaV2Contexto(id) { filaV2Fechar(); openItemWorkspace(String(id)); }
function filaV2Marcar(campo, event) {
  const ordem = [...document.querySelectorAll('#v2-fila .vfa-linha')].map((l) => l.dataset.id);
  alternarSelecao(campo.dataset.id, campo.checked, event, ordem);
}
function filaV2Lista(D, limite) {
  let resta = limite, escondidas = 0;
  const blocos = D.grupos.map((g) => {
    const vis = g.itens.slice(0, Math.max(0, resta)); resta -= vis.length; escondidas += g.itens.length - vis.length;
    if (!vis.length) return '';
    const marca = g.pessoa
      ? `<span class="vfa-g-av" aria-hidden="true">${safeText(g.pessoa.id === 'unassigned' ? '–' : String(firstName(g.pessoa.name) || '?').slice(0, 2).toUpperCase())}</span>`
      : `<i class="vfa-pt m-${safeText(g.chave)}" aria-hidden="true"></i>`;
    return `<div class="vfa-grupo">${marca}<b>${safeText(g.rotulo)}</b><span>${g.itens.length}</span></div>`
      + vis.map((d) => filaV2Linha(d, g.porItem ? g.porItem(d) : g.motivo)).join('');
  }).join('');
  return { html: blocos, escondidas };
}
function filaV2Pintar() {
  const jan = document.getElementById('v2-fila'); if (!jan || !FILA_V2.aberta) return;
  const D = filaV2Dados();
  const acaoN = D.acao.length, hojeN = D.deHoje.length, vencidasN = D.doDia.length - hojeN;
  const sem = META.weeks && META.weeks[currentWeek - 1], semana = sem?.startFmt ? `semana de ${sem.startFmt} a ${sem.endFmt}` : `semana ${currentWeek}`;
  const tit = FILA_V2.aba === 'acao' ? 'Requer ação' : 'Vence hoje';
  const sub = FILA_V2.aba === 'acao' ? `${semana} · na ordem de urgência` : `${planningDateBr(opsTodayIso())} · por pessoa · ${vencidasN} já ${vencidasN === 1 ? 'vencida' : 'vencidas'}`;
  const aba = (chave, rotulo, n) => `<button type="button" role="radio" class="vfa-aba" aria-checked="${FILA_V2.aba === chave}" onclick="filaV2Aba('${chave}')">${rotulo}<span>${n}</span></button>`;
  const recorte = FILA_V2.recorte ? `<button type="button" class="vfa-filtro vfa-recorte" aria-checked="true" onclick="filaV2SemRecorte()" title="Tirar o recorte e ver tudo">Só ${safeText(FILA_V2.recorte.rotulo)}${FILA_V2_IC.x}</button>` : '';
  const filtros = recorte + D.filtros.map((f) => `<button type="button" role="radio" class="vfa-filtro" aria-checked="${D.ativo === f.chave}" onclick="filaV2Filtrar('${f.chave}')">${safeText(f.rotulo)}<span class="${f.tom || ''}">${f.n}</span></button>`).join('');
  const max = Math.max(1, ...D.motivos.map((m) => m.n));
  const motivos = D.motivos.map((m) => `<span class="vfa-mot"><span>${safeText(m.rotulo)}</span><i class="m-${safeText(m.chave)}"><u style="width:${Math.round((m.n / max) * 100)}%"></u></i><b>${m.n}</b></span>`).join('');
  const marcadas = SELECIONADAS.size;
  const desliga = marcadas ? '' : ' disabled';
  const lote = `<div class="vfa-lote" role="group" aria-label="Mudar as marcadas de uma vez">
      <span class="vfa-lote-topo"><b>${marcadas ? `${marcadas} ${marcadas === 1 ? 'marcada' : 'marcadas'}` : 'Nenhuma marcada'}</b>${marcadas
        ? `<span><button type="button" class="vfa-elo" data-vfa-mais onclick="filaV2LoteMais(event)" aria-haspopup="menu">Mais</button><button type="button" class="vfa-elo" onclick="limparSelecao()">Desmarcar</button></span>`
        : '<small>marque as linhas</small>'}</span>
      <button type="button" class="vfa-btn"${desliga} onclick="loteStatus(event)">${FILA_V2_IC.status}Trocar o status</button>
      <button type="button" class="vfa-btn"${desliga} onclick="loteResponsavel(event)">${FILA_V2_IC.pessoa}Passar para alguém</button>
      <button type="button" class="vfa-btn"${desliga} onclick="filaV2LoteDatas(event)" aria-haspopup="menu">${FILA_V2_IC.data}Mudar as datas</button>
    </div>`;
  const heitor = filaV2HeitorHtml(D);
  jan.innerHTML = `<div class="vfa-topo">
      <div class="vfa-tit"><h2 id="vfa-tit">${tit}</h2><span>${safeText(sub)}</span></div>
      <div class="vfa-ferr"><div class="vfa-abas" role="radiogroup" aria-label="Filas">${aba('acao', 'Requer ação', acaoN)}${aba('hoje', 'Vence hoje', hojeN)}</div>
        <button type="button" class="vfa-x" onclick="filaV2Fechar()" aria-label="Fechar" title="Fechar (Esc)">${FILA_V2_IC.x}</button></div>
    </div>
    <div class="vfa-corpo">
      <div class="vfa-folha">
        <div class="vfa-filtros" role="radiogroup" aria-label="Filtrar">${filtros}</div>
        <div class="vfa-lista"></div>
        <div class="vfa-pe"><span>Clicar na linha abre o cartão rápido da peça</span><span class="vfa-pe-mais"></span></div>
      </div>
      <div class="vfa-lado">${lote}
        <section class="vfa-sec" aria-label="${FILA_V2.aba === 'acao' ? 'Por motivo' : 'Por data'}"><div class="vfa-sec-topo"><b>${FILA_V2.aba === 'acao' ? 'Por motivo' : 'Por data'}</b><span>${FILA_V2.aba === 'acao' ? `${acaoN} nesta semana` : `${D.doDia.length} no total`}</span></div><div class="vfa-mots">${motivos}</div></section>
        ${heitor}</div>
    </div>`;
  // A lista mostra o que cabe sem rolar: começa grande e encolhe até caber; "Mostrar as outras N" abre o resto (aí a
  // lista rola por dentro da folha, nunca a janela).
  const lista = jan.querySelector('.vfa-lista'), pe = jan.querySelector('.vfa-pe-mais');
  const total = D.grupos.reduce((s, g) => s + g.itens.length, 0);
  const pintarLista = (lim) => {
    const r = filaV2Lista(D, lim);
    lista.innerHTML = r.html || `<p class="vfa-vazio">${FILA_V2.aba === 'acao' ? 'Nada pendente nesta semana.' : 'Nada para entregar aqui.'}</p>`;
    pe.innerHTML = r.escondidas ? `<button type="button" class="vfa-elo" onclick="filaV2Mais()">Mostrar as outras ${r.escondidas}</button>`
      : showAllActionItems && total > 6 ? '<button type="button" class="vfa-elo" onclick="filaV2Mais()">Mostrar menos</button>' : '';
  };
  if (showAllActionItems) { pintarLista(total); return; }
  let lim = FILA_V2.limite || 14;
  pintarLista(lim);
  while (lim > 3 && lista.scrollHeight > lista.clientHeight + 1) { lim--; pintarLista(lim); }
  FILA_V2.limite = lim;
}
// "Mudar as datas": prazo ou veiculação (conclusão nas demandas), pelo mesmo campo de data do lote.
function filaV2LoteDatas(event) {
  if (!SELECIONADAS.size) return;
  const botao = event.currentTarget;
  const ev = () => ({ preventDefault() {}, stopPropagation() {}, currentTarget: botao });
  const demandas = [...SELECIONADAS].map(findOperationalItem).filter(Boolean).every(isRequestItem);
  abrirMenuDeLote(event, 'Mudar as datas', [
    { rotulo: 'Prazo', direto: true, cor: '#8A847A', aplicar: () => lotePrazo(ev(), 'prazo') },
    { rotulo: demandas ? 'Conclusão' : 'Veiculação', direto: true, cor: '#8A847A', aplicar: () => lotePrazo(ev(), 'veiculacao') },
  ], '');
}
// "Mais": o resto da barra de lote (grupo, formato, captação, prioridade e arquivar), as mesmas funções de antes.
function filaV2LoteMais(event) {
  if (!SELECIONADAS.size) return;
  const botao = event.currentTarget;
  const itens = [...SELECIONADAS].map(findOperationalItem).filter(Boolean);
  const quadro = itens.length && itens.every(isRequestItem) ? 'demandas' : 'producao';
  const ev = () => ({ preventDefault() {}, stopPropagation() {}, currentTarget: botao });
  abrirMenuDeLote(event, 'Mais ações', [
    { rotulo: 'Grupo', chamar: () => loteGrupo(ev(), quadro) },
    { rotulo: quadro === 'demandas' ? 'Tipo' : 'Formato', chamar: () => loteEscolha(ev(), 'formato') },
    ...(quadro === 'demandas' ? [] : [{ rotulo: 'Captação', chamar: () => loteEscolha(ev(), 'captacao') }]),
    { rotulo: 'Prioridade', chamar: () => loteEscolha(ev(), 'prioridade') },
    { rotulo: 'Arquivar', chamar: () => loteArquivar() },
  ].map((o) => ({ ...o, direto: true, cor: '#8A847A', aplicar: o.chamar })), '');
}
// "Heitor sugere" com nomes: até 3 linhas "peça → pessoa" (o resto no "+N", que leva à Coordenação), o atalho "pela
// carga" de antes e, para dono, "Distribuir assim" com a pergunta antes de gravar.
function filaV2HeitorHtml(D) {
  const H = FILA_V2.heitor, S = filaV2Sugestoes(D.aba === 'hoje' ? D.base : D.acao), n = S.lista.length, dono = filaV2PodeDistribuir();
  const cab = '<div class="vfa-sec-topo"><b>Heitor sugere</b><span>Coordenação</span></div>';
  const R = H.resultado;
  const feito = R ? `<p class="vfa-nota${R.falhas ? ' r' : ''}" role="status">${R.erro ? safeText(R.erro) : R.falhas ? `${R.ok} de ${R.n} distribuídas; ${R.falhas} não ${R.falhas === 1 ? 'gravou' : 'gravaram'}.` : `${R.ok} ${R.ok === 1 ? 'peça distribuída' : 'peças distribuídas'} como ele sugeriu.`}</p>` : '';
  if (!S.semDono) return `<section class="vfa-sec" aria-label="Heitor sugere">${cab}${feito}<p class="vfa-nota">Ninguém sem responsável nesta fila. Quando houver, o Heitor sugere quem pega, pela carga.</p></section>`;
  const linhas = S.lista.slice(0, 3).map((x) => `<button type="button" class="vfa-sug" onclick="acaoAbrirPeca('${jsArg(String(x.d.id))}',event)" title="${safeText(x.d.nome || 'A peça')} → ${safeText(x.nome)}: abrir no cartão rápido"><span class="vfa-sug-p">${safeText(x.d.nome || 'Sem título')}</span><i aria-hidden="true">→</i><b>${safeText(x.nome)}</b></button>`).join('');
  const resto = S.semDono - Math.min(3, n);
  const ir = `<button type="button" class="vfa-heitor" onclick="filaV2Heitor()"><span class="vfa-heitor-av" aria-hidden="true">HC</span><span class="vfa-heitor-txt"><b>${S.semDono} sem responsável</b> · ${resto > 0 ? `mais ${resto}` : 'pela carga'}</span>${FILA_V2_IC.ir}</button>`;
  let acao = '';
  if (dono && n) {
    acao = H.rodando ? `<div class="vfa-dist"><button type="button" class="vfa-btn k" disabled aria-live="polite">Distribuindo ${H.i}/${H.n}…</button></div>`
      : H.pergunta ? `<div class="vfa-dist" role="group" aria-label="Confirmar a distribuição"><span class="vfa-dist-q">Passar ${n} ${n === 1 ? 'peça' : 'peças'} como o Heitor sugere, uma por vez?</span><span class="vfa-dist-bts"><button type="button" class="vfa-btn" onclick="filaV2Distribuir('voltar')">Voltar</button><button type="button" class="vfa-btn k" onclick="filaV2Distribuir('sim')">Sim, distribuir ${n}</button></span></div>`
        : `<div class="vfa-dist"><button type="button" class="vfa-btn k" onclick="filaV2Distribuir()">Distribuir assim (${n})</button></div>`;
  }
  const nota = !n ? `<p class="vfa-nota">${S.calculou ? 'Ninguém da disciplina tem folga para estas peças; veja na Coordenação.' : 'A conta da carga não carregou; veja na Coordenação.'}</p>`
    : dono ? '' : '<p class="vfa-nota">Só um dono confirma a distribuição. Nada muda sem o sim.</p>';
  return `<section class="vfa-sec" aria-label="Heitor sugere">${cab}${linhas ? `<div class="vfa-sugs">${linhas}</div>` : ''}${ir}${acao}${feito}${nota}</section>`;
}
// O Heitor sugere quem pega pela carga na Coordenação; lá quem coordena confirma cada troca (nada é distribuído sozinho).
function filaV2Heitor() { filaV2Fechar(); if (typeof pv2AbrirCoordenacao === 'function') pv2AbrirCoordenacao(); }
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !filaV2Aberta()) return;
    // O cartão rápido, um menu ou uma pergunta na frente tratam o próprio Esc.
    if (['#cartao-rapido', '#status-editor', '#lote-editor', '#owner-editor', '#cli-pergunta', '#vybe-cal', '#workspace-drawer'].some((s) => document.querySelector(s)?.getClientRects().length)) return;
    e.preventDefault(); e.stopPropagation(); filaV2Fechar();
  }, true);
}

// ─── Meu Dia / Inteligência de gestão ─────────────────────────────────────────
let focusShowAll = false;
// "Pronta" é só Finalizado, Feito ou Concluído: a regra única de VybeDono.util.finalizado (vybe-dono-metricas.js).
// Sem ela carregada, a mesma lista aqui. Aprovado, Publicado, Postado, Agendado e Para agendar não fecham a peça.
const STATUS_PRONTA_LOCAL = new Set(['finalizado', 'finalizada', 'feito', 'concluido', 'concluida', 'concluidos', 'concluidas']);
function statusPronto(status) {
  const regra = globalThis.VybeDono?.util?.finalizado;
  if (typeof regra === 'function') return Boolean(regra(status));
  return STATUS_PRONTA_LOCAL.has(String(status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim());
}
function isFinishedItem(d) { return statusPronto(operationalFlowStatus(d)); }
function getReferenceDate(d) { return d.prazo_iso || d.veiculacao_iso || ''; }

// ── Soltar a peça num dia da semana ──────────────────────────────────────────
//
// O calendario mensal tem os proprios avisos visuais presos a .manager-calendar-day.
// Aqui o alvo e o cartao do dia, entao a marca de "pode soltar" e outra — mas a
// GRAVACAO e a mesma: managerCalendarDrop, que ja sabe qual campo mexer
// conforme a referencia ativa (veiculacao ou prazo) e ja passa pelo caminho
// unico de mudanca de data.
function soltarNoDiaSobre(event, cartao) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  cartao.classList.add('recebendo');
}
function soltarNoDiaSai(cartao) { cartao.classList.remove('recebendo'); }
async function soltarNoDia(dateIso, event, cartao) {
  cartao.classList.remove('recebendo');
  // Soltar a peca no mesmo dia de onde ela saiu nao e engano nem mudanca: o
  // caminho unico ja devolve "nada a fazer" nesse caso, e por isso nao ha
  // verificacao repetida aqui.
  await managerCalendarDrop(dateIso, event, cartao);
}

// Aplica a MESMA lista de responsaveis em todas as marcadas.
//
// Passa pelo aplicarEmLote, que ja pergunta antes e conta o resultado, e grava
// por gravarResponsaveisDaPeca — o mesmo gravador do editor de uma so. Uma via
// propria aqui seria a terceira implementacao de "trocar responsavel".
async function salvarResponsaveisDaSelecao(item) {
  const selected = [...donoSelecionados].map(String);
  if (!selected.length && !document.getElementById('owner-editor-empty')?.checked) {
    return showToast('Escolha um responsável ou confirme que as atividades ficarão sem responsável.', 'info');
  }
  const nomes = TEAM_USERS.filter((u) => selected.includes(String(u.id))).map((u) => firstName(u.name));
  const rotulo = nomes.length ? `${nomes.join(' e ')} como responsável` : 'a saída de todo mundo';
  closeOwnerEditor();
  await aplicarEmLote(rotulo, async (alvo) => {
    const atuais = (typeof assignedIds === 'function' ? assignedIds(alvo) : []).map(String).sort().join(',');
    // Peca que ja esta exatamente assim nao precisa de ida ao servidor.
    if (atuais === selected.slice().sort().join(',')) return;
    await gravarResponsaveisDaPeca(alvo, selected);
  });
}

// ─── Padrão v2 · Painel de trabalho pelo quadro DEPOIS do moodboard (12/11/2026) ─────────────
// A tela é o quadro, nesta ordem: título com as vistas (Semana, Mês, Grupos, Equipe), Modos e Novo conteúdo; a fala do
// Heitor ao lado de três números; a busca, as quatro fichas e Filtros; a semana com ‹ ›, Hoje, as contagens e
// Por dia, Por cliente ou Grade; e quatro colunas de dia com o cartão que abre no lugar. Só vale no mundo
// (body.mundo); no tema antigo (?legado=1) fica a tela de sempre. As peças antigas não são apagadas: cabeçalho, resumo,
// barra e a navegação da agenda vão para #pv2-reserva (escondida) e seguem respondendo pelos mesmos ids; Pessoa, Status,
// Veiculação ou Prazo, Mais filtros, Arquivo, o mês e "Limpar filtros" passam para dentro de Filtros.
const PV2_IC = {
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  antes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  depois: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  baixo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
};
function pv2Ligado() { return typeof document !== 'undefined' && Boolean(document.body?.classList.contains('mundo')); }
// Cor é significado (Paulo, 13/11/2026: "pra não olhar muita informação e tudo parecer a mesma coisa"). Pílula cheia só no
// que pede atenção: vermelho no que venceu, âmbar no que voltou para ajuste, verde no que está pronto (só Finalizado e
// equivalentes). O resto fica neutro, com a bolinha na cor do catálogo (a cor do status continua dizendo qual é).
function pv2Tom(status) {
  const s = String(status || '').toLocaleLowerCase('pt-BR');
  if (/atras|vencid/.test(s)) return 'r';
  if (/altera|ajuste|corre|refaz/.test(s)) return 'a';
  if (/finaliz|feito|conclu|publicad|postad/.test(s)) return 'g';
  return 'n';
}
function pv2Pill(texto, tom) { return `<span class="pv2-pill ${tom || pv2Tom(texto)}">${safeText(texto || 'Sem status')}</span>`; }
// O cliente com a bolinha na cor da carteira dele (laranja ou azul do Responsável geral; cinza sem carteira).
function pv2Cli(nome) {
  if (!nome || nome === '—') return '';
  const carteira = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '';
  const dica = typeof descricaoCarteiraCliente === 'function' ? descricaoCarteiraCliente(nome) : '';
  return `<span class="pv2-cli" data-carteira="${safeText(carteira)}" title="${safeText(dica)}">${safeText(nome)}</span>`;
}
function pv2Iniciais(nome) { return String(firstName(nome || '') || '?').slice(0, 2).toUpperCase(); }
// Regra única de "sem dono" (vybe-dono-metricas.js: id do Monday fora de TEAM_USERS tem dono); sem ela, a de antes.
function pv2SemDono(item) { return window.VybeDono?.util?.semDono ? window.VybeDono.util.semDono(item) : !ownerUsersFor(item).length && !String(item?.responsavel || '').replace('—', '').trim(); }
// Quem faz, em bolinha de duas letras. O "?" vermelho é peça sem dono: clicar escolhe o responsável (o mesmo editor de sempre).
function pv2Av(item, { comNome = false } = {}) {
  const donos = ownerUsersFor(item), id = safeText(item.id);
  const nomes = donos.length ? donos.map((u) => u.name) : String(item?.responsavel || '').replace('—', '').split(',').map((n) => n.trim()).filter(Boolean);
  if (!nomes.length && comNome) return `<button type="button" class="pv2-sem-dono" onclick="event.stopPropagation();openOwnerEditor(event,'${id}')" title="Escolher o responsável">Sem responsável</button>`;
  if (!nomes.length) return `<button type="button" class="pv2-av sd" onclick="event.stopPropagation();openOwnerEditor(event,'${id}')" title="Sem dono: escolher o responsável" aria-label="Sem dono: escolher o responsável">?</button>`;
  const rotulo = `Responsáveis: ${nomes.join(', ')}. Trocar`;
  return `<button type="button" class="pv2-av" onclick="event.stopPropagation();openOwnerEditor(event,'${id}')" title="${safeText(rotulo)}" aria-label="${safeText(rotulo)}">${safeText(pv2Iniciais(nomes[0]))}</button>${nomes.length > 1 ? `<span class="pv2-av mais" aria-hidden="true">+${nomes.length - 1}</span>` : ''}${comNome ? `<span class="pv2-dono-nome">${safeText(firstName(nomes[0]))}</span>` : ''}`;
}
// Etapas da peça, lidas do status (o painel não guarda etapa por etapa): o que já passou fica marcado e a etapa da vez
// vem em destaque. É a mesma leitura de Minhas tarefas.
function pv2Etapas(d) {
  const st = String(d?.status || '').toLocaleLowerCase('pt-BR'), fim = typeof isFinishedItem === 'function' && isFinishedItem(d);
  const n = fim ? 5 : /agend|aprovad|pronta/.test(st) ? 4 : /aprova|revis/.test(st) ? 3 : /andamento|execu|produ|altera|ajuste|corre|edi/.test(st) ? 2 : d?.tem_briefing === false || /briefing|info|nova/.test(st) ? 0 : 1;
  const video = typeof ownerFormatKind === 'function' && ['audiovisual', 'motion'].includes(ownerFormatKind(d));
  const nomes = video ? ['Briefing', 'Roteiro', 'Edição', 'Aprovação', 'Publicar'] : ['Briefing', 'Texto', 'Arte', 'Aprovação', 'Publicar'];
  return nomes.map((nome, k) => ({ nome, feita: k < n, daVez: k === n }));
}
function pv2EtapasHtml(d) {
  return `<div class="pv2-etapas" title="Pelo status da peça">${pv2Etapas(d).map((e) => `<span class="pv2-etp${e.feita ? ' ok' : e.daVez ? ' vez' : ''}"><i class="pv2-cx${e.feita ? ' ok' : ''}" aria-hidden="true">${e.feita ? PV2_IC.ok : ''}</i>${e.nome}</span>`).join('')}</div>`;
}
function pv2Titulo(d) {
  const nome = String(d?.nome || '').trim(), formato = String(d?.formato || '').trim();
  const temFormato = !formato || formato === '—' || nome.toLocaleLowerCase('pt-BR').startsWith(formato.toLocaleLowerCase('pt-BR'));
  return temFormato ? nome : `${formato} · ${nome}`;
}
const pv2DiaMes = (iso) => (iso ? `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}` : '');

// ----- Direção 3 (moodboard 3, 13/11/2026): as peças que o Painel e Demandas repetem -----
// Bloco de ação laranja com o agente e a área dele em cima da frase; cartão de número com rótulo, valor, mini linha ou
// barra e uma linha curta embaixo. Os desenhos-base (d3-acao, d3-num, d3-graf, d3-barra) moram em padrao-v2/0-d3-base.css.
const D3P_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
function d3pDataDeHoje() {
  const iso = (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace(/-feira$/, '');
  return `${dia}, ${d.getUTCDate()} ${d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}`;
}
function d3pAcao({ agente = 'H', quem = '', frase = '', botao = '', attrs = '' }) {
  const corpo = `${quem ? `<small class="d3p-quem">${safeText(quem)}</small>` : ''}<span class="d3p-frase">${frase}</span>`;
  if (typeof d3AcaoHtml === 'function') return d3AcaoHtml({ frase: corpo, agente, botao, attrs }).replace('class="d3-acao"', 'class="d3-acao d3p-acao"');
  return `<section class="d3-acao d3p-acao" aria-label="O que pede ação agora"><span class="d3-acao-av" aria-hidden="true">${safeText(agente)}</span><span class="d3-acao-frase">${corpo}</span>${botao ? `<button type="button" class="d3-acao-btn" ${attrs}>${safeText(botao)}</button>` : ''}</section>`;
}
// O cartão de número da Direção 3. serie (dois ou mais valores) vira a mini linha; barra (0 a 100) vira a barra que
// cresce. Com acao, o cartão é botão. tom: r (venceu), a (pede ajuste) ou g (pronto).
function d3pNum({ rotulo, valor, de = '', tom = '', linhaTom = '', serie = null, barra = null, sub = '', subTom = '', acao = '', dica = '', serieRotulo = '' }) {
  const graf = serie && typeof d3LinhaSvg === 'function' ? d3LinhaSvg(serie, { largura: 90, altura: 28, rotulo: serieRotulo }) : '';
  const tag = acao ? `button type="button" onclick="${acao}"` : 'div';
  return `<${tag} class="d3-num d3p-num${tom ? ' ' + tom : ''}${graf && (linhaTom || tom) ? ' l-' + (linhaTom || tom) : ''}"${dica ? ` title="${safeText(dica)}"` : ''}><span class="d3-num-rot">${safeText(rotulo)}</span>`
    + `<b class="d3-num-v">${valor}${de ? `<small> / ${de}</small>` : ''}</b>${graf}`
    + `${barra != null ? `<span class="d3-barra" role="progressbar" aria-label="${safeText(rotulo)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(barra)}" style="--v:${Math.max(0, Math.min(100, Math.round(barra)))}%"><i></i></span>` : ''}`
    + `${sub ? `<span class="d3p-num-sub${subTom ? ' ' + subTom : ''}">${sub}</span>` : ''}</${acao ? 'button' : 'div'}>`;
}

// ----- o alto da tela: título, vistas, Modos, Novo conteúdo, fala, números, busca, fichas e Filtros -----
// Vistas, abas e "Por dia" são escolha única (role="radio" com aria-checked): no quadro a ativa é branca; a ficha de
// filtro é liga e desliga (aria-pressed) e fica preta quando ligada.
let pv2SoSemDono = false;
const pv2Totais = {};
const pv2Pintado = {};
const PV2_LIMITE_DIA = 5; // o limite de peças por pessoa no dia, o mesmo da Coordenação
let pv2Dia = ''; // o dia escolhido na régua ("Por dia" mostra um dia só; vazio = hoje)
// A seta do título: as outras telas da Produção, as mesmas do submenu do menu lateral (o clique é o do próprio submenu).
function pv2PintarTroca() {
  const pop = document.getElementById('pv2-troca-pop'); if (!pop) return;
  const itens = [...document.querySelectorAll('#vv-sub-producao :is(button,a)')].filter((b) => (b.textContent || '').trim());
  pop.innerHTML = itens.map((b, i) => `<button type="button" data-troca="${i}"${b.dataset.submodulo === 'gestor' ? ' aria-current="page"' : ''}>${safeText((b.querySelector('b,span')?.textContent || b.textContent || '').trim())}</button>`).join('') || '<span class="pv2-pop-rot">Use o menu lateral para trocar de tela.</span>';
  pop.querySelectorAll('[data-troca]').forEach((bt) => bt.addEventListener('click', () => itens[Number(bt.dataset.troca)]?.click()));
  // No celular (prancha V2-M-Producao-Celular) a fileira das vistas sai do topo: elas moram neste menu, em cima das telas.
  const vistaAgora = document.body.dataset.pv2Vista || 'semana';
  pop.insertAdjacentHTML('afterbegin', '<span class="pv2-pop-rot d3m-a-cel">Vista</span>' + [['semana', 'Semana'], ['mes', 'Mês'], ['feed', 'Feed'], ['grupos', 'Grupos'], ['equipe', 'Equipe']]
    .map(([v, rot]) => `<button type="button" class="d3m-a-cel" data-vista-cel="${v}"${v === vistaAgora ? ' aria-current="true"' : ''} onclick="document.querySelector('#pv2-vistas [data-vista=&quot;${v}&quot;]')?.click()">${rot}</button>`).join('') + '<span class="pv2-pop-rot d3m-a-cel">Telas da Produção</span>');
}
// A logo do cliente (a fonte única de vybe-logo-cliente.js: cadastro → Instagram → Drive) ou as iniciais.
function pv2Foto(nome) {
  if (!nome) return '';
  if (typeof logoDoClienteHtml === 'function') return logoDoClienteHtml(nome);
  return `<i class="d3v-foto" aria-hidden="true">${safeText(String(nome).trim().slice(0, 2).toUpperCase())}</i>`;
}
function pv2EscolherDia(iso) {
  pv2Dia = iso;
  if (viewMode === 'client' || !DIAS_EM_COLUNAS) { pv2Modo('dia'); }
  renderWeek(currentWeek, currentFilter, currentDayFilter);
  pv2PintarSemana();
}
function pv2Trocar(el, html) { if (el && pv2Pintado[el.id] !== html) { pv2Pintado[el.id] = html; el.innerHTML = html; } }
function pv2Montar() {
  if (!pv2Ligado()) return null;
  let raiz = document.getElementById('pv2-painel');
  if (raiz) return raiz;
  const cab = document.querySelector('.container > .workspace-heading'), nav = document.querySelector('.container > .agenda-navigation');
  const barra = document.querySelector('.container > .ops-command-bar'), resumo = document.getElementById('compact-summary');
  if (!cab || !nav || !barra || !resumo) return null;
  const casa = cab.parentElement;
  raiz = document.createElement('div');
  raiz.id = 'pv2-painel'; raiz.className = 'pv2 pv2-painel';
  // Direção V2 (prancha V2-M-Producao, aprovada pelo Paulo em 16/11/2026): a janela é vidro fumê. No topo, o título com a
  // seta que troca de tela dentro da Produção, a linha do dia, as vistas, a busca em ícone e Novo conteúdo. À direita, direto
  // no vidro, a coluna de consulta: o único cartão laranja (o que trava hoje), a carga de hoje, onde a semana trava e os Modos.
  raiz.innerHTML = `<div class="pv2-topo d3m-topo"><div class="d3m-tit"><details class="pv2-menu d3m-troca" id="pv2-troca" ontoggle="if(this.open)pv2PintarTroca()"><summary title="Trocar de tela dentro da Produção"><h2>Produção</h2>${PV2_IC.baixo || ''}</summary>
          <div class="pv2-pop" id="pv2-troca-pop" role="group" aria-label="Telas da Produção" onclick="if(event.target.closest('button'))this.closest('details').open=false"></div></details>
        <span class="d3p-data" id="pv2-data">${safeText(d3pDataDeHoje())}</span></div>
      <span class="pv2-seg" id="pv2-vistas" role="radiogroup" aria-label="Vista">
        <button type="button" role="radio" data-vista="semana" onclick="mostrarAgendaDaSemana()" title="Agenda da equipe, dia a dia">Semana</button>
        <button type="button" role="radio" data-vista="mes" onclick="toggleAgendaMensal()" title="Calendário do mês por cliente">Mês</button>
        <button type="button" role="radio" data-vista="feed" onclick="toggleFeedDoCliente()" title="A grade do Instagram de cada cliente: o que está no ar e o que vai sair">Feed</button>
        <button type="button" role="radio" data-vista="grupos" onclick="toggleVisaoDeGrupos()" title="Conteúdos divididos pelos grupos do quadro">Grupos</button>
        <button type="button" role="radio" data-vista="equipe" onclick="mostrarEquipeDaSemana(document.getElementById('ops-equipe-btn'))" title="Carga de cada pessoa e distribuição por formato na semana">Equipe</button>
      </span>
      <span class="d3m-a-feed-ctl" id="pv2-feed-ctl"></span>
      <label class="pv2-oculto" for="pv2-busca">Buscar peça ou cliente</label>
      <input id="pv2-busca" class="pv2-busca" type="search" autocomplete="off" placeholder="Buscar peça ou cliente" oninput="const t=this.value;this.value='';handleGlobalSearch(t)" hidden tabindex="-1">
      <button type="button" class="d3m-ico" id="pv2-busca-bt" onclick="typeof abrirSpotlight==='function'?abrirSpotlight(''):document.querySelector('[data-ferr=busca]')?.click()" aria-label="Buscar peça ou cliente" title="Buscar peça ou cliente"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg></button>
      <button type="button" class="d3m-ico d3m-a-cel" id="pv2-filtros-bt" onclick="event.stopPropagation();pv2FiltrosNoCelular()" aria-label="Filtros e modos de ver a semana" title="Filtros e modos de ver a semana"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg></button>
      <button type="button" class="pv2-btn d3p-novo" onclick="typeof openCadastrosGoverned==='function'?openCadastrosGoverned({board:'producao'}):openCadastrosStation()">${D3P_MAIS}Novo conteúdo</button></div>
    <aside class="d3m-lado" id="pv2-lado" aria-label="Consulta">
      <div class="pv2-alto" id="pv2-alto"></div>
      <div class="d3m-a-lado-v" id="pv2-lado-v"></div>
      <div id="pv2-carga"></div>
      <div id="pv2-trava"></div>
      <details class="pv2-menu d3m-modos" id="pv2-modos"><summary class="d3m-vlin" title="Fechamento do dia, mesa de comando, modo reunião e carga da equipe"><span><b>Modos</b> · fechamento, mesa e reunião</span>${PV2_IC.depois}</summary>
        <div class="pv2-pop" role="group" aria-label="Modos" onclick="if(event.target.closest('button'))this.closest('details').open=false">
          <button type="button" data-modo-v2="fechamento" onclick="toggleDailyClose()">Fechamento do dia</button>
          <button type="button" data-modo-v2="comando" onclick="toggleManagerCommandDrawer()">Mesa de comando <b id="pv2-comando-n"></b></button>
          <button type="button" onclick="openMeetingMode()">Modo Reunião</button>
          <button type="button" onclick="document.getElementById('ops-carga-btn')?.click()">Carga da equipe</button>
        </div></details>
    </aside>`;
  cab.before(raiz);
  const semana = document.createElement('div');
  semana.id = 'pv2-semana'; semana.className = 'pv2 pv2-semana';
  // A cabeça do cartão do dia: o dia escolhido com as prontas; Redes, Demandas e Pendências; como ver (Por dia, Por cliente,
  // Grade) e os Filtros. As setas da semana e o Hoje ficam na régua, em cima.
  semana.innerHTML = `<h3 id="pv2-semana-rot" aria-live="polite">Semana</h3>
    <span class="pv2-abas" id="pv2-abas" role="radiogroup" aria-label="Mostrar em todos os dias"></span>
    <span class="pv2-seg" id="pv2-modo" role="radiogroup" aria-label="Como ver a semana">
      <button type="button" role="radio" data-modo-semana="dia" onclick="pv2Modo('dia')">Por dia</button>
      <button type="button" role="radio" data-modo-semana="cliente" onclick="pv2Modo('cliente')">Por cliente</button>
      <button type="button" role="radio" data-modo-semana="grade" onclick="pv2Modo('grade')">Grade</button>
    </span>
    <details class="pv2-menu" id="pv2-filtros-menu"><summary class="pv2-btn s" id="pv2-filtros-rot">Filtros</summary>
      <div class="pv2-pop pv2-pop-filtros" id="pv2-filtros-pop"><span class="pv2-pop-rot">Mês de referência</span></div></details>`;
  const regua = document.createElement('div');
  regua.id = 'pv2-regua'; regua.className = 'pv2 d3m-regua'; regua.setAttribute('role', 'group'); regua.setAttribute('aria-label', 'Dias da semana');
  const pe = document.createElement('div');
  pe.id = 'pv2-pe'; pe.className = 'pv2 d3m-olho'; pe.setAttribute('role', 'group'); pe.setAttribute('aria-label', 'De olho');
  pe.innerHTML = '<span class="d3m-olho-rot">De olho</span><span class="pv2-fichas" id="pv2-chips"></span>';
  nav.before(regua, semana);
  casa.append(pe);
  nav.before(semana);
  const reserva = document.createElement('div');
  reserva.id = 'pv2-reserva'; reserva.hidden = true;
  casa.append(reserva);
  // Filtros guarda o que saiu da barra: mês, Pessoa, Status, Veiculação ou Prazo, Mais filtros, Arquivo e limpar.
  const pop = semana.querySelector('#pv2-filtros-pop');
  const mes = document.getElementById('month-nav'), filtros = document.getElementById('agenda-filtros');
  const arquivo = document.getElementById('ops-arquivo-btn'), limpar = document.getElementById('ops-clear-btn');
  if (mes) pop.append(mes);
  if (filtros) { const rot = document.createElement('span'); rot.className = 'pv2-pop-rot'; rot.textContent = 'Recorte'; pop.append(rot, filtros); }
  const popPe = document.createElement('div'); popPe.className = 'pv2-pop-pe';
  if (arquivo) popPe.append(arquivo);
  if (limpar) popPe.append(limpar);
  pop.append(popPe);
  const escolhidos = document.getElementById('ops-selection-summary');
  if (escolhidos) raiz.after(escolhidos);
  reserva.append(cab, resumo, barra, nav);
  casa.classList.add('pv2-casa');
  // Um menu aberto fecha ao clicar fora dele.
  document.addEventListener('click', (ev) => { document.querySelectorAll('.pv2-menu[open]').forEach((m) => { if (!m.contains(ev.target)) m.open = false; }); });
  return raiz;
}
function pv2PintarAlto(n) {
  const raiz = pv2Montar(); if (!raiz || !n) return;
  const pl = (q, um, varios) => (q === 1 ? um : varios);
  // Direção 3: a frase curta do Heitor no bloco laranja, com o botão do que pede ação; embaixo, três números com a mini
  // linha da semana (quantas publicam e quantas estão pendentes em cada dia) e a barra da semana fechada.
  const semana = `Semana em ${n.pct}%.`;
  const frase = !n.hoje ? `Hoje não publica nada. ${semana}`
    : n.hojePendente > 0 ? `Hoje ${pl(n.hoje, 'publica', 'publicam')} ${n.hoje} e ${n.hojePendente === n.hoje ? pl(n.hoje, 'ela não está pronta', 'nenhuma está pronta') : `${n.hojePendente} não ${pl(n.hojePendente, 'está pronta', 'estão prontas')}`}. ${semana}`
    : `Hoje ${pl(n.hoje, 'publica', 'publicam')} ${n.hoje}, ${pl(n.hoje, 'já pronta', 'todas prontas')}. ${semana}`;
  const [botao, acao] = n.hojePendente > 0 ? [n.hojePendente === 1 ? 'Ver a de hoje' : `Ver as ${n.hojePendente}`, "abrirDoResumo('hoje')"]
    : n.pendentes ? ['Ver pendentes', "abrirDoResumo('acao')"] : n.hoje ? ['Ver as de hoje', "abrirDoResumo('hoje')"] : ['', ''];
  const dias = typeof getDiasSemana === 'function' && typeof currentWeek !== 'undefined' ? getDiasSemana(currentWeek) : [];
  const daSemana = (DADOS || []).filter(itemNaCarteira);
  const porDia = (filtro) => dias.map((dia) => daSemana.filter((d) => d.veiculacao_iso === dia.iso && filtro(d)).length);
  const kpi = (rotulo, valor, o = {}) => d3pNum({ rotulo, valor, ...o });
  // O laranja (o único da tela): quantas publicam hoje sem estar prontas, em número grande; quantas estão sem dono e a
  // semana. "Distribuir" liga o filtro Sem dono; "Ver" abre a fila de hoje.
  const hojeIso = (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  const abertasHoje = daSemana.filter((d) => dataDoCartaoDia(d) === hojeIso && !atividadeDoDiaConcluida(d));
  const semDonoHoje = abertasHoje.filter(pv2SemDono).length;
  const titulo = !n.hoje ? 'Hoje não publica nada' : n.hojePendente > 0 ? (n.hojePendente === n.hoje ? `${pl(n.hoje, 'publica hoje e não está pronta', 'publicam hoje, nenhuma pronta')}` : `de ${n.hoje} de hoje ainda não ${pl(n.hojePendente, 'está pronta', 'estão prontas')}`) : `${pl(n.hoje, 'publica hoje, já pronta', 'publicam hoje, todas prontas')}`;
  const apoio = `${semDonoHoje ? `${semDonoHoje} ainda sem dono. ` : ''}A semana está em ${n.pct}%.`;
  const bts = [semDonoHoje ? `<button type="button" class="d3m-btn l" onclick="pv2AlternarSemDono()">${semDonoHoje === 1 ? 'Distribuir a sem dono' : `Distribuir as ${semDonoHoje}`}</button>` : '', botao ? `<button type="button" class="d3m-btn l${semDonoHoje ? ' s' : ''}" onclick="${acao}">${safeText(botao)}</button>` : ''].join('');
  pv2Trocar(document.getElementById('pv2-alto'), `<section class="d3-acao d3p-acao d3m-laranja" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">H</span>Heitor · o que trava hoje</span>
      <span class="d3m-lar-txt">${n.hoje ? `<b class="d3m-lar-num">${n.hojePendente > 0 ? n.hojePendente : n.hoje}</b>` : ''}<span class="d3-acao-frase" title="${safeText(frase)}">${safeText(titulo)}</span><small>${safeText(apoio)}</small></span>${bts ? `<span class="d3m-lar-bts">${bts}</span>` : ''}</section>`);
  // Carga de hoje: as peças abertas de hoje por pessoa, contra o limite do dia (o mesmo da Coordenação).
  const porPessoa = new Map();
  for (const d of abertasHoje) for (const u of ownerUsersFor(d)) porPessoa.set(String(u.id), { nome: firstName(u.name || u.nome || ''), n: (porPessoa.get(String(u.id))?.n || 0) + 1 });
  const carga = [...porPessoa.values()].sort((a, b) => b.n - a.n).slice(0, 5);
  pv2Trocar(document.getElementById('pv2-carga'), `<section class="d3m-cons" aria-label="Carga de hoje"><div class="d3m-cons-cab"><b>Carga de hoje</b><span>abertas hoje / limite do dia</span></div>${carga.length
    ? carga.map((x) => `<button type="button" class="d3m-vlin" onclick="mostrarEquipeDaSemana(document.getElementById('ops-equipe-btn'))" title="Ver a carga da equipe"><i class="d3m-pes" aria-hidden="true">${safeText(pv2Iniciais(x.nome))}</i><span class="d3m-vnome">${safeText(x.nome)}</span><span class="d3m-vbarra${x.n > PV2_LIMITE_DIA ? ' r' : x.n / PV2_LIMITE_DIA > .6 ? ' a' : ''}" style="--v:${Math.min(100, Math.round(x.n / PV2_LIMITE_DIA * 100))}%"><i></i></span><span class="d3m-vn"><b>${x.n}</b> / ${PV2_LIMITE_DIA}</span></button>`).join('')
    : '<p class="d3m-vvazio">Ninguém com peça aberta hoje.</p>'}</section>`);
  // Onde a semana trava: as peças abertas da semana paradas em informação do cliente, alteração ou direção de arte.
  const abertasSemana = (typeof itensDaSemanaGestor === 'function' && typeof currentWeek !== 'undefined' ? itensDaSemanaGestor(currentWeek).filter(itemNaCarteira) : []).filter((d) => !atividadeDoDiaConcluida(d));
  const TRAVAS = [[/info/i, 'Falta informação do cliente', 'r'], [/altera|ajuste|corre/i, 'Em alteração', 'a'], [/falta d\.?\s?a/i, 'Falta direção de arte', 'a']];
  const travas = TRAVAS.map(([re, rot, tom]) => [rot, abertasSemana.filter((d) => re.test(String(d.status || ''))).length, tom]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
  pv2Trocar(document.getElementById('pv2-trava'), `<section class="d3m-cons" aria-label="Onde a semana trava"><div class="d3m-cons-cab"><b>Onde a semana trava</b><span>por etapa</span></div>${travas.length
    ? travas.map(([rot, q, tom]) => `<button type="button" class="d3m-vlin" onclick="abrirDoResumo('acao')" title="Abrir a fila do que pede ação"><i class="d3m-pt ${tom}" aria-hidden="true"></i><span class="d3m-vnome">${rot}</span><b class="d3m-vn">${q}</b>${PV2_IC.depois}</button>`).join('')
    : '<p class="d3m-vvazio">Nada travado nesta semana.</p>'}</section>`);
  // A linha do topo: o dia, a semana e as prontas do mês.
  const ds = typeof getDiasSemana === 'function' && typeof currentWeek !== 'undefined' ? getDiasSemana(currentWeek) : [];
  const linhaTopo = `${d3pDataDeHoje()}${ds.length ? ` · semana de ${Number(ds[0].iso.slice(8, 10))} a ${Number(ds[ds.length - 1].iso.slice(8, 10))}` : ''} · ${n.feitas} de ${n.total} prontas`;
  pv2Vista.semana = { linha: linhaTopo };
  pv2Totais.poucosPosts = n.poucosPosts;
  pv2PintarControles();
}
function pv2PintarControles() {
  const raiz = pv2Montar(); if (!raiz) return;
  const P = PAINEIS_DA_BARRA;
  const vista = P.calendario.aberto() ? 'mes' : P.feed.aberto() ? 'feed' : P.grupos.aberto() ? 'grupos' : equipeNaTela() ? 'equipe' : 'semana';
  raiz.querySelectorAll('#pv2-vistas [data-vista]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.vista === vista)));
  const conta = (id) => Number(document.getElementById(id)?.textContent) || 0;
  const semDono = typeof DADOS !== 'undefined' && DADOS.length ? itensDaSemanaGestor(currentWeek).filter(itemNaCarteira).filter((d) => !atividadeDoDiaConcluida(d) && pv2SemDono(d)).length : 0;
  const ficha = (rotulo, n, ligada, acao, dica) => `<button type="button" class="pv2-chip" aria-pressed="${Boolean(ligada)}" onclick="${acao}" title="${dica}">${rotulo} <b>${n}</b></button>`;
  pv2Trocar(document.getElementById('pv2-chips'), ficha('Requer ação', conta('ops-action-count'), P.acao.aberto(), 'toggleActionQueue()', 'A fila do que pede ação, com o motivo')
    // O recorte diz o que conta (acabamento 15/11): a fila de hoje traz as vencidas e as de hoje (data até hoje), e o
    // "sem dono" é o da semana; assim os números não brigam com "Publica hoje" nem com o Sem dono da Produção.
    + ficha('Vencidas e de hoje', conta('ops-today-count'), P.hoje.aberto(), 'toggleTodayQueue()', 'Peças com a data vencida ou de hoje')
    + ficha('Sem dono na semana', semDono, pv2SoSemDono, 'pv2AlternarSemDono()', 'Só as peças abertas da semana sem responsável')
    + ficha('Menos de 3 posts', pv2Totais.poucosPosts || 0, typeof sortCritico !== 'undefined' && sortCritico, 'pv2PoucosPosts()', 'Clientes com menos de 3 posts em alguma semana, primeiro'));
  pv2PintarFiltroAtivo();
  const comando = document.getElementById('pv2-comando-n'), nComando = document.getElementById('manager-command-count')?.textContent || '';
  if (comando && comando.textContent !== nComando) comando.textContent = nComando;
  raiz.querySelector('[data-modo-v2="fechamento"]')?.setAttribute('aria-pressed', String(P.fechamento.aberto()));
  raiz.querySelector('[data-modo-v2="comando"]')?.setAttribute('aria-pressed', String(P.comando.aberto()));
  document.getElementById('pv2-semana')?.toggleAttribute('hidden', vista === 'equipe');
  // A vista aberta fica no body: a janela de vidro, a régua, o pé e a coluna de consulta são da vista Semana.
  if (document.body.dataset.pv2Vista !== vista) document.body.dataset.pv2Vista = vista;
  pv2PintarVista(vista);
}
// "Filtros" acende quando há recorte ligado lá dentro (ou o Arquivo aberto).
function pv2PintarFiltroAtivo() {
  const limpar = document.getElementById('ops-clear-btn');
  document.getElementById('pv2-filtros-rot')?.classList.toggle('tem', Boolean(limpar && !limpar.classList.contains('is-idle')) || Boolean(document.getElementById('arquivadas-painel')));
}
function pv2PintarSemana() {
  if (!pv2Montar()) return;
  const dias = getDiasSemana(currentWeek), rot = document.getElementById('pv2-semana-rot');
  const modoAgora = viewMode === 'client' ? 'cliente' : DIAS_EM_COLUNAS ? 'dia' : 'grade';
  const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const escolhido = dias.some((d) => d.iso === pv2Dia) ? pv2Dia : dias.some((d) => d.iso === hojeIso) ? hojeIso : dias[0]?.iso || '';
  // Na régua da semana, pronta é a produção pronta (Paulo, 19/11/2026): Finalizado (feitas) e, das peças de conteúdo,
  // Para agendar e Agendado (VybeDono.util.faseDaPronta). A barra empilha: Finalizado cheio, os outros no tom claro.
  const faseDaPronta = globalThis.VybeDono?.util?.faseDaPronta;
  const doDia = (iso) => { const l = (typeof DADOS !== 'undefined' && DADOS.length ? itensDaSemanaGestor(currentWeek).filter(itemNaCarteira) : []).filter((d) => dataDoCartaoDia(d) === iso);
    const feitas = l.filter(atividadeDoDiaConcluida), resto = l.filter((d) => !feitas.includes(d) && !isRequestItem(d) && typeof faseDaPronta === 'function');
    const paraAgendar = resto.filter((d) => faseDaPronta(d) === 'paraAgendar').length, agendadas = resto.filter((d) => faseDaPronta(d) === 'agendado').length;
    return { total: l.length, feitas: feitas.length, finalizadas: feitas.length, paraAgendar, agendadas, prontas: feitas.length + paraAgendar + agendadas }; };
  const detalheDia = (t) => (typeof globalThis.VybeDono?.util?.resumoProntas === 'function' ? globalThis.VybeDono.util.resumoProntas(t) : `${t.feitas} ${t.feitas === 1 ? 'finalizada' : 'finalizadas'}`);
  const nomeDia = (iso) => `${new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')} ${Number(iso.slice(8, 10))}`;
  if (rot && dias.length) {
    const a = dias[0].iso, b = dias[dias.length - 1].iso, mes = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const semanaTxt = a.slice(0, 7) === b.slice(0, 7) ? `${a.slice(8, 10)} a ${b.slice(8, 10)} de ${mes(b)}` : `${a.slice(8, 10)} de ${mes(a)} a ${b.slice(8, 10)} de ${mes(b)}`;
    const t = doDia(escolhido);
    const texto = modoAgora === 'dia' && escolhido ? `${escolhido === hojeIso ? 'Hoje, ' : ''}${nomeDia(escolhido)}` : semanaTxt;
    const resto = modoAgora === 'dia' && escolhido ? ` · ${t.prontas} de ${t.total} ${t.total === 1 ? 'pronta' : 'prontas'}${t.prontas ? ` (${detalheDia(t)})` : ''}` : '';
    const html = `${safeText(texto)}<span>${safeText(resto)}</span>`;
    if (rot.dataset.txt !== html) { rot.dataset.txt = html; rot.innerHTML = html; }
  }
  // A régua da semana: cada dia com as prontas sobre o total e a barra; o escolhido fica claro. As setas passam a semana.
  const li = pilulasDeSemana(), at = document.getElementById(`tab-s${currentWeek}-label`), ix = li.indexOf(at);
  pv2Trocar(document.getElementById('pv2-regua'), `<button type="button" class="d3m-regua-seta" data-passo="-1" onclick="passarSemana(-1)" aria-label="Semana anterior"${ix <= 0 ? ' disabled' : ''}>${PV2_IC.antes}</button>`
    + dias.map((d) => { const t = doDia(d.iso), pct = t.total ? Math.round(t.feitas * 1000 / t.total) / 10 : 0, pctC = t.total ? Math.round((t.prontas - t.feitas) * 1000 / t.total) / 10 : 0;
      return `<button type="button" class="d3m-dia${modoAgora === 'dia' && d.iso === escolhido ? ' d3m-on' : ''}" data-dia="${d.iso}" onclick="pv2EscolherDia('${d.iso}')" title="Ver ${nomeDia(d.iso)}${t.total ? ` · ${t.prontas} de ${t.total} prontas: ${detalheDia(t)}` : ''}" aria-label="${nomeDia(d.iso)}: ${t.prontas} de ${t.total} prontas${t.prontas ? `, ${detalheDia(t)}` : ''}${modoAgora === 'dia' && d.iso === escolhido ? ', dia escolhido' : ''}"><span><b><i class="d3m-a-dsem">${nomeDia(d.iso).split(' ')[0]}</i> ${Number(d.iso.slice(8, 10))}</b>${d.iso === hojeIso ? '<small>hoje</small>' : ''}</span><span><b class="d3m-dia-n">${t.prontas}<small> / ${t.total}</small></b><i class="d3m-dia-b vsg-pilha" style="--v:${pct}%;--c:${pctC}%"><i></i><i class="vsg-clara"></i></i></span></button>`; }).join('')
    + `<button type="button" class="d3m-regua-seta" data-passo="1" onclick="passarSemana(1)" aria-label="Próxima semana"${ix < 0 || ix >= li.length - 1 ? ' disabled' : ''}>${PV2_IC.depois}</button>`
    + (at?.classList.contains('e-hoje') ? '' : '<button type="button" class="d3m-regua-hoje" id="pv2-semana-hoje" onclick="semanaDeHoje()">Hoje</button>'));
  const lista = pilulasDeSemana(), atual = document.getElementById(`tab-s${currentWeek}-label`), i = lista.indexOf(atual);
  const semana = document.getElementById('pv2-semana');
  const modo = viewMode === 'client' ? 'cliente' : DIAS_EM_COLUNAS ? 'dia' : 'grade';
  semana?.querySelectorAll('[data-modo-semana]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modoSemana === modo)));
  const t = pv2Totais[currentWeek];
  pv2Trocar(document.getElementById('pv2-abas'), modo === 'cliente' || !t || panelMode !== 'gestor' ? '' : [['social', 'Redes'], ['demandas', 'Demandas'], ['pendencias', 'Pendências']]
    .map(([id, nome]) => `<button type="button" role="radio" aria-checked="${abaDaSemana === id}" onclick="escolherAbaDaSemana(${currentWeek},'${id}')">${nome} ${t[id]}</button>`).join('<i aria-hidden="true">·</i>'));
}
// No celular, Redes/Demandas/Pendências, Por dia/Por cliente/Grade e os Filtros ficam recolhidos atrás do ícone do topo.
function pv2FiltrosNoCelular() {
  const menu = document.getElementById('pv2-filtros-menu'); if (!menu) return;
  if ((document.body.dataset.pv2Vista || 'semana') !== 'semana') mostrarAgendaDaSemana();
  menu.open = !menu.open;
  document.getElementById('pv2-filtros-bt')?.setAttribute('aria-expanded', String(menu.open));
  if (menu.open) document.getElementById('pv2-semana')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function pv2Modo(modo) {
  const botao = document.getElementById('btn-view-day');
  if (modo === 'cliente') { if (viewMode !== 'client' && botao) toggleViewMode(botao); return; }
  if (viewMode === 'client' && botao) toggleViewMode(botao);
  if ((modo === 'grade') === DIAS_EM_COLUNAS) alternarDiasEmColunas();
  pv2PintarSemana();
}
function pv2AlternarSemDono() {
  pv2SoSemDono = !pv2SoSemDono;
  if (pv2SoSemDono && viewMode === 'client') pv2Modo('dia');
  for (let s = 1; s <= (META.weeks?.length || 4); s++) renderWeek(s, currentFilter, currentDayFilter);
  mostrarAgendaDaSemana();
  pv2PintarControles();
}
// "Menos de 3 posts": liga o "Crítico primeiro" e mostra a semana por cliente, que é onde essa ordem aparece.
function pv2PoucosPosts() {
  toggleSortCritico(document.getElementById('sort-critico-btn'));
  if (sortCritico && viewMode !== 'client') pv2Modo('cliente');
  mostrarAgendaDaSemana();
  pv2PintarControles();
}

// ----- Direção V2: as outras vistas da Produção (pranchas V2-M-Producao-Mes, -Grupos, -Equipe e V2-M-Feed, 16/11/2026) -----
// A janela, o topo e a coluna de consulta são os mesmos da Semana. Cada vista guarda aqui o que conta (a linha embaixo do
// título e a coluna de consulta) e desenha a própria folha no lugar de sempre (#manager-calendar, #grupos-board,
// #panel-team, #feed-board), com as mesmas funções de antes.
const pv2Vista = { semana: null, mes: null, grupos: null, equipe: null, feed: null };
const pv2Pl = (q, um, varios) => (q === 1 ? um : varios);
const PV2_DIAS_CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
function pv2HojeIso() { return (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) || (typeof META !== 'undefined' && META.today_iso) || new Date().toISOString().slice(0, 10); }
// O cartão laranja da coluna de consulta (o único laranja cheio da tela) e as linhas de vidro embaixo dele.
function pv2Laranja({ quem, agente = 'H', numero = '', titulo, apoio = '', botoes = '', rotulo = 'O que pede ação agora' }) {
  return `<section class="d3-acao d3p-acao d3m-laranja" aria-label="${safeText(rotulo)}"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${safeText(agente)}</span>${safeText(quem)}</span>
      <span class="d3m-lar-txt">${numero !== '' ? `<b class="d3m-lar-num">${safeText(String(numero))}</b>` : ''}<span class="d3-acao-frase">${safeText(titulo)}</span>${apoio ? `<small>${safeText(apoio)}</small>` : ''}</span>${botoes ? `<span class="d3m-lar-bts">${botoes}</span>` : ''}</section>`;
}
function pv2Cons(titulo, nota, corpo) {
  return `<section class="d3m-cons" aria-label="${safeText(titulo)}"><div class="d3m-cons-cab"><b>${safeText(titulo)}</b><span>${safeText(nota || '')}</span></div>${corpo}</section>`;
}
// Escolha e chave nas peças V2 usam aria-checked (role="radio" ou "switch"): a folha antiga pinta de preto, com força, todo
// botão com aria-pressed, aria-selected ou .active dentro de módulo.
function pv2Vlin(html, acao, dica = '', extra = '') {
  return `<button type="button" class="d3m-vlin" onclick="${acao}"${dica ? ` title="${safeText(dica)}"` : ''}${extra}><span>${html}</span>${PV2_IC.depois}</button>`;
}
// A linha embaixo do título e a coluna de consulta da vista aberta.
function pv2PintarVista(vista) {
  const v = vista || document.body.dataset.pv2Vista || 'semana', d = pv2Vista[v];
  const dataEl = document.getElementById('pv2-data');
  if (dataEl && d?.linha && dataEl.textContent !== d.linha) dataEl.textContent = d.linha;
  const lado = document.getElementById('pv2-lado-v');
  if (lado) pv2Trocar(lado, v === 'semana' ? '' : d?.lado || '');
}

// MÊS (prancha V2-M-Producao-Mes): o mês inteiro numa folha. Cada dia diz quantas peças tem e quantas estão prontas;
// dia que já passou com peça aberta fica em vermelho. Clicar no dia abre a lista dele (a de sempre, onde a peça abre e
// muda de data); dia vazio cadastra. Na coluna de consulta: o laranja com as vencidas do mês, as carteiras (o mesmo
// recorte Todos, Viniceta e Galeguinho), o que ficou fora do feed, a esteira e as datas comemorativas.
// Dentro do dia, as peças em etiquetas (Paulo, 16/11: "preciso que apareça cada demanda pra eu arrastar e ver o status
// sem abrir"). A etiqueta é o bloco do calendário de antes no padrão V2: mesmo abrir (managerCalendarOpen) e mesmo
// arrastar (managerCalendarDragStart/End); o status vai no ponto, no title e por escrito quando a célula é larga.
// Passou de PV2_MES_PECAS, o "+N" abre a lista do dia.
const PV2_MES_PECAS = 12;
function pv2MesPecaHtml(item) {
  const fonte = item.calendarSource === 'request' ? 'request' : 'content', id = jsArg(item.id);
  const status = String(item.status || 'Sem status'), cliente = clientesDoItem(item)[0] || item.cliente || '';
  const cor = managerCalendarStatusColor(item, (typeof corDeStatus === 'function' ? corDeStatus(status)?.cor : '') || '#9A948A');
  const dono = item.responsavel && item.responsavel !== '—' ? firstName(item.responsavel) : 'Sem responsável';
  const dica = `${cliente || 'Sem cliente'} · ${item.nome || 'Sem título'} · ${status} · ${dono}. Clique para abrir, arraste para mudar a data`;
  return `<button type="button" draggable="true" data-vt="peca-${safeText(String(item.id))}" class="d3m-a-pc${atividadeDoDiaConcluida(item) ? ' feita' : ''}" title="${safeText(dica)}" aria-label="${safeText(dica)}"`
    + ` onclick="managerCalendarOpen('${fonte}','${id}',event)" ondragstart="managerCalendarDragStart('${fonte}','${id}',event)" ondragend="managerCalendarDragEnd()">`
    + `<i class="d3m-a-pc-st" style="--st:${safeText(cor)}" aria-hidden="true"></i><span class="d3m-a-pc-t"><b>${safeText(cliente || 'Sem cliente')}</b> ${safeText(pv2Titulo(item) || 'Sem título')}</span>`
    + `<span class="d3m-a-pc-s">${safeText(status)}</span></button>`;
}
function pv2MesHtml({ meta, grouped, clients, semCarteira, escolhido }) {
  const hoje = pv2HojeIso();
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(meta.first);
  const doMes = meta.cells.filter((c) => c.inMonth);
  let total = 0, prontas = 0, vencidas = 0, primeiroVencido = '', ultimoVencido = '', comemorativas = 0;
  const datas = window.VybeDatas?.pronto?.() ? window.VybeDatas : null;
  const semanas = [];
  for (let i = 0; i < meta.cells.length; i += 7) { const s = meta.cells.slice(i, i + 7); if (s.some((c) => c.inMonth)) semanas.push(s); }
  const celulas = semanas.flat().map((cell) => {
    if (!cell.inMonth) return '<span class="d3m-a-dia fora" aria-hidden="true"></span>';
    const itens = grouped.get(cell.iso) || [], n = itens.length, ok = itens.filter(atividadeDoDiaConcluida).length, abertas = n - ok;
    const venceu = cell.iso < hoje && abertas > 0, eHoje = cell.iso === hoje;
    total += n; prontas += ok;
    if (venceu) { vencidas += abertas; if (!primeiroVencido) primeiroVencido = cell.iso; ultimoVencido = cell.iso; }
    const doDia = datas ? datas.doDia(cell.iso) : [];
    if (doDia.length) comemorativas += 1;
    const nota = eHoje ? 'hoje' : doDia.length ? String(doDia[0].nome).split(/ \u2014 | - /)[0] : '';
    const dia = cell.date.getDate(), pct = n ? Math.round(ok * 100 / n) : 0;
    const conta = !n ? '' : venceu ? `<span class="d3m-a-dia-n r"><b>${abertas}</b> <span>${pv2Pl(abertas, 'vencida', 'vencidas')}</span></span>` : `<span class="d3m-a-dia-n"><b>${ok}</b> / ${n} <span>${pv2Pl(n, 'pronta', 'prontas')}</span></span>`;
    const fala = `${dia} de ${nomeMes}${eHoje ? ', hoje' : ''}${doDia.length ? `, ${doDia[0].nome}` : ''}: ${!n ? 'sem peças, cadastrar neste dia' : venceu ? `${abertas} ${pv2Pl(abertas, 'vencida', 'vencidas')} de ${n}` : `${ok} de ${n} ${pv2Pl(n, 'pronta', 'prontas')}`}`;
    // Cada peça do dia vira uma etiqueta (ponto do status, cliente e peça) que abre como no calendário de antes e se
    // arrasta para outro dia: o soltar é o do dia, managerCalendarDrop, a mesma gravação do calendário antigo e da Semana.
    const ordem = [...itens].sort((a, b) => Number(atividadeDoDiaConcluida(a)) - Number(atividadeDoDiaConcluida(b))
      || String(clientesDoItem(a)[0] || '').localeCompare(String(clientesDoItem(b)[0] || ''), 'pt-BR') || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    const pecas = ordem.slice(0, PV2_MES_PECAS).map(pv2MesPecaHtml).join('');
    const mais = n > PV2_MES_PECAS ? `<button type="button" class="d3m-a-dia-mais" onclick="abrirDiaDoCalendario(event,'${cell.iso}')" title="Ver as ${n} peças deste dia">+${n - PV2_MES_PECAS} ${pv2Pl(n - PV2_MES_PECAS, 'peça', 'peças')}</button>` : '';
    return `<div class="d3m-a-dia${eHoje ? ' hoje' : ''}${venceu ? ' venc' : ''}${n ? '' : ' vazio'}" role="group" aria-label="${dia} de ${safeText(nomeMes)}" data-date="${cell.iso}"${previaDoDiaAttrs(itens, planningDateBr(cell.iso).slice(0, 5))} ondragover="managerCalendarDragOver(event,this)" ondragleave="managerCalendarDragLeave(this)" ondrop="managerCalendarDrop('${cell.iso}',event,this)">`
      + `<button type="button" class="d3m-a-dia-cab" onclick="${n ? `abrirDiaDoCalendario(event,'${cell.iso}')` : `managerCalendarAdd('${cell.iso}')`}" aria-label="${safeText(fala)}" title="${n ? 'Ver as peças deste dia' : 'Cadastrar neste dia'}">`
      + `<span class="d3m-a-dia-topo"><b>${dia}</b><small>${safeText(nota)}</small>${conta}</span>`
      + `${n ? `<i class="d3m-a-dia-b${venceu ? ' r' : ''}" style="--v:${pct}%"><i></i></i>` : ''}</button>`
      + `${n ? `<div class="d3m-a-dia-pcs">${pecas}${mais}</div>` : ''}</div>`;
  }).join('');
  const noMesAtual = !Number(MONTH_OFFSET || 0);
  const titulo = managerCalendarLabel(meta);
  const recorte = escolhido?.rotulo || 'Todos os clientes';
  // O que a coluna de consulta e a linha do topo contam.
  const diaDe = (iso) => Number(iso.slice(8, 10));
  const faixa = !vencidas ? '' : primeiroVencido === ultimoVencido ? `do dia ${diaDe(primeiroVencido)}` : `de ${diaDe(primeiroVencido)} a ${diaDe(ultimoVencido)}`;
  const linha = `${nomeMes} de ${meta.year} · ${total} ${pv2Pl(total, 'peça', 'peças')} · ${prontas} ${pv2Pl(prontas, 'pronta', 'prontas')}${vencidas ? ` · ${vencidas} ${pv2Pl(vencidas, 'vencida', 'vencidas')} ${faixa}` : ''}`;
  const laranja = vencidas
    ? pv2Laranja({ quem: 'Heitor · o mês até aqui', numero: vencidas, titulo: `${pv2Pl(vencidas, 'vencida', 'vencidas')} ${faixa} de ${nomeMes}`, apoio: 'Em vermelho, o dia ainda tem peça aberta.',
      botoes: `<button type="button" class="d3m-btn l" onclick="abrirDoResumo('hoje','vencidas')">${vencidas === 1 ? 'Ver a vencida' : `Ver as ${vencidas}`}</button><button type="button" class="d3m-btn l s" onclick="abrirDiaDoCalendario(event,'${primeiroVencido}')" title="Abre o dia mais antigo com peça aberta: cada peça abre e muda de data">Dia mais antigo</button>` })
    : pv2Laranja({ quem: 'Heitor · o mês até aqui', numero: total ? prontas : '', titulo: total ? `de ${total} ${pv2Pl(total, 'peça pronta', 'peças prontas')} em ${nomeMes}` : `Nenhuma peça em ${nomeMes}`, apoio: total ? 'Nenhum dia para trás com peça aberta.' : 'Clique em um dia para cadastrar.',
      botoes: `<button type="button" class="d3m-btn l" onclick="managerCalendarAdd('${noMesAtual ? hoje : doMes[0].iso}')">Cadastrar</button>` });
  const maior = Math.max(1, semCarteira.length);
  const carteira = (rot, n, on, acao, cls, dica) => `<button type="button" class="d3m-a-cart${on ? ' on' : ''}" role="radio" aria-checked="${Boolean(on)}" onclick="${acao}" title="${safeText(dica)}"><span>${safeText(rot)}</span><i class="d3m-a-cart-b${cls}" style="--v:${Math.round(n * 100 / maior)}%"><i></i></i><b>${n}</b></button>`;
  const carteiras = pv2Cons('Carteiras', 'peças no mês', `<div class="d3m-a-caixa" role="radiogroup" aria-label="Carteira">${carteira('Todos', semCarteira.length, managerCalendarClientFilter === 'all' && filtroCarteira === 'all', 'managerCalendarTodos()', '', 'Todos os clientes')
    + CARTEIRAS_DA_AGENDA.map(({ id, apelido, dono }) => carteira(apelido, semCarteira.filter((item) => clientesDoItem(item).some((nome) => carteiraDoCliente(nome) === id)).length, filtroCarteira === id, `managerCalendarSetCarteira('${id}')`, ` c-${safeText(id)}`, filtroCarteira === id ? 'Voltar para todos os clientes' : `Só os clientes de ${dono}`)).join('')}</div>`);
  const fora = FORA_DO_FEED_NO_MES ? pv2Cons('Fora do feed', '', pv2Vlin(`<b>${FORA_DO_FEED_NO_MES} ${pv2Pl(FORA_DO_FEED_NO_MES, 'solicitação', 'solicitações')}</b> · ${MOSTRAR_FORA_DO_FEED ? 'aparecendo no mês' : pv2Pl(FORA_DO_FEED_NO_MES, 'não vai para o feed', 'não vão para o feed')}`, 'alternarForaDoFeed()', MOSTRAR_FORA_DO_FEED ? 'Esconder de novo as solicitações que não vão para o feed' : 'Mostrar mesmo assim no calendário', ` role="switch" aria-checked="${Boolean(MOSTRAR_FORA_DO_FEED)}"`)) : '';
  const abrir = pv2Cons('Abrir', '', pv2Vlin('<b>A esteira do mês</b>', "switchBoard('demandas',document.getElementById('btn-board-demandas'))", 'Abrir a esteira de solicitações')
    + pv2Vlin(`<b>Datas comemorativas</b>${comemorativas ? ` · ${comemorativas} em ${safeText(nomeMes)}` : ''}`, "typeof abrirCalendarioSazonal==='function'&&abrirCalendarioSazonal()", 'Abrir o calendário de datas comemorativas')
    + pv2Vlin('<b>Cliente master</b> · o cadastro do cliente', 'managerCalendarOpenClientMaster()', 'Abrir o cadastro do cliente escolhido'));
  pv2Vista.mes = { linha, lado: laranja + carteiras + fora + abrir };
  return `<section class="d3m-a-folha d3m-a-mes" aria-label="Calendário de ${safeText(titulo)}">
      <div class="d3m-a-cab"><h3><span class="manager-calendar-month-label">${safeText(titulo)}</span> <span>· ${total} ${pv2Pl(total, 'peça', 'peças')}</span></h3>
        <span class="d3m-a-setas" role="group" aria-label="Trocar de mês"><button type="button" class="d3v-btn txt ico s" onclick="managerCalendarGoMonth(-1)" aria-label="Mês anterior" title="Mês anterior">${PV2_IC.antes}</button><button type="button" class="d3v-btn txt ico s" onclick="managerCalendarGoMonth(1)" aria-label="Próximo mês" title="Próximo mês">${PV2_IC.depois}</button>${noMesAtual ? '' : '<button type="button" class="d3v-btn txt s manager-calendar-hoje" onclick="managerCalendarGoToday()">Hoje</button>'}</span>
        <span class="d3m-a-seg" role="radiogroup" aria-label="Data de referência"><button type="button" role="radio" aria-checked="${dateMode === 'veiculacao'}" onclick="managerCalendarSetDateMode('veiculacao')">Veiculação</button><button type="button" role="radio" aria-checked="${dateMode === 'prazo'}" onclick="managerCalendarSetDateMode('prazo')">Prazo</button></span>
        <i class="d3m-a-div" aria-hidden="true"></i>
        <button type="button" class="d3m-a-filtro${managerCalendarClientFilter === 'all' && filtroCarteira === 'all' ? '' : ' tem'}" onclick="abrirBuscaDeCliente(event)" title="Escolher ou buscar cliente (${clients.length} com atividade)">${safeText(recorte)}</button></div>
      <div class="d3m-a-mes-sem" aria-hidden="true">${PV2_DIAS_CURTOS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="d3m-a-mes-grade" style="--linhas:${semanas.length}">${celulas}</div></section>`;
}

// GRUPOS (prancha V2-M-Producao-Grupos): a tabela crua, um grupo por vez. O grupo se escolhe na coluna de consulta; a
// folha mostra as linhas dele com as colunas de conferir (ID, conteúdo, cliente, formato, status, prazo, no ar e quem) e
// guarda as outras seis atrás de "Colunas". Cada célula é o mesmo editor de sempre (clientes, formato, status, datas,
// responsável); "Marcar várias" liga as caixas e a barra de lote; o menu do grupo (renomear, cor, ordem, apagar) fica na
// cabeça da folha.
// Bia (Coordenação, 18/11/2026): "selecionar mais de um pra fazer alterações", "filtrar pro status" e "editar tudo dentro
// do cartão da atividade". As caixas de marcar ficam sempre à vista (a de cima marca o que está no recorte), a barra de
// lote é a de sempre (#lote-deck, montarDeckDeLote em vybe-agenda.js, que grava pelo /api/conteudo), o status filtra na
// cabeça da folha e a linha abre o cartão da atividade, onde título, status, datas, responsável e formato se editam.
let pv2GruposSel = '', pv2GruposFiltro = 'todos', pv2GruposColunas = false, pv2GruposLote = false, pv2GruposStatus = '';
// A Captação fica à mostra por padrão, ao lado do Status; "Colunas" esconde (fica guardado com o resto das preferências).
let pv2GruposCaptacao = true;
// O ID é coisa do sistema (Paulo, 19/11/2026: "coluna com ID não precisa aparecer... coisa de backend"): sai da vista por
// padrão e volta pelo menu "Colunas". Nada se perde: ele fica no title da linha, na gaveta (copiar), na busca e no CSV.
// O Formato também sai por padrão (Paulo, 20/11/2026: "se tem o formato do conteúdo antes do nome sempre, não precisa da
// tabela de formato"): o tipo já abre o nome ("Reels · Black Friday"). Volta por "Colunas"; o filtro Formato continua.
let pv2GruposComId = false, pv2GruposComFormato = false;
const PV2_GRUPOS_EXTRAS = ['captacao', 'tipo_conteudo', 'off_audio', 'prioridade'];
// OS OUTROS FILTROS DA LINHA (Paulo, 19/11/2026: "não seria ideal ter mais filtros?"). Pessoa e carteira são as do painel
// inteiro (selectedPersonIds e filtroCarteira, as mesmas das abas do Feed), para não nascer um segundo filtro de pessoa;
// formato, captação e data são da folha. Tudo vale junto, com a busca e com a ordem.
const pv2GruposFormatos = new Set(), pv2GruposCaptacoes = new Set();
let pv2GruposData = { campo: 'veiculacao_iso', recorte: '', de: '', ate: '' };
const PV2_GRUPOS_RECORTES = [['', 'Qualquer data'], ['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['7dias', 'Próximos 7 dias'], ['mes', 'Este mês'], ['intervalo', 'De… até…']];
const PV2_GRUPOS_CAMPOS_DATA = { veiculacao_iso: 'Veiculação', prazo_iso: 'Prazo' };
const pv2Preenchido = (v) => { const s = String(v ?? '').trim(); return s && s !== '—' ? s : ''; };
const pv2IsoOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
function pv2DiaMais(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// A janela [de, até] de cada recorte, em dia ISO. A semana vai de segunda a domingo; os próximos 7 dias contam hoje.
function pv2GruposJanela(recorte, hoje, de = '', ate = '') {
  if (recorte === 'hoje') return [hoje, hoje];
  if (recorte === 'semana') { const dia = (new Date(`${hoje}T12:00:00Z`).getUTCDay() + 6) % 7; return [pv2DiaMais(hoje, -dia), pv2DiaMais(hoje, 6 - dia)]; }
  if (recorte === '7dias') return [hoje, pv2DiaMais(hoje, 6)];
  if (recorte === 'mes') { const ini = `${hoje.slice(0, 7)}-01`, fim = new Date(`${ini}T12:00:00Z`); fim.setUTCMonth(fim.getUTCMonth() + 1, 0); return [ini, fim.toISOString().slice(0, 10)]; }
  if (recorte === 'intervalo') return [pv2IsoOk(de), pv2IsoOk(ate)];
  return null;
}
// O intervalo sem nenhuma das duas datas ainda não filtra nada.
const pv2GruposDataLigada = (f = pv2GruposData) => Boolean(f?.recorte) && (f.recorte !== 'intervalo' || Boolean(pv2IsoOk(f.de) || pv2IsoOk(f.ate)));
function pv2GruposNaData(item, filtro = pv2GruposData, hoje = pv2HojeIso()) {
  if (!pv2GruposDataLigada(filtro)) return true;
  const iso = String(item?.[filtro.campo] || '').slice(0, 10);
  if (!pv2IsoOk(iso)) return false;
  if (filtro.recorte === 'atrasadas') return iso < hoje && !atividadeDoDiaConcluida(item);
  const [ini, fim] = pv2GruposJanela(filtro.recorte, hoje, filtro.de, filtro.ate) || ['', ''];
  return (!ini || iso >= ini) && (!fim || iso <= fim);
}
function pv2GruposRotuloData(f = pv2GruposData) {
  if (f.recorte !== 'intervalo') return (PV2_GRUPOS_RECORTES.find(([k]) => k === f.recorte)?.[1] || '').toLocaleLowerCase('pt-BR');
  const de = pv2IsoOk(f.de), ate = pv2IsoOk(f.ate);
  return de && ate ? `${pv2DiaMes(de)} a ${pv2DiaMes(ate)}` : de ? `a partir de ${pv2DiaMes(de)}` : ate ? `até ${pv2DiaMes(ate)}` : '';
}
// Cliente, formato, captação e data, antes de separar por grupo (a pessoa e a carteira entram em itensPorGrupo).
function pv2GruposAplicarFiltros(itens, { clientes = pv2GruposClientes, formatos = pv2GruposFormatos, captacoes = pv2GruposCaptacoes, data = pv2GruposData, hoje = pv2HojeIso() } = {}) {
  const fmt = new Set([...formatos].map(pv2ChaveCliente)), cap = new Set([...captacoes].map(pv2ChaveCliente));
  return pv2GruposFiltroCliente(itens, clientes).filter((i) => (!fmt.size || fmt.has(pv2ChaveCliente(pv2Preenchido(i.formato))))
    && (!cap.size || cap.has(pv2ChaveCliente(pv2Preenchido(i.captacao)))) && pv2GruposNaData(i, data, hoje));
}
// As opções dos menus novos. O número de cada uma é quantas peças ficariam com ela somada aos OUTROS filtros ligados (cliente,
// formato, captação, data, pessoa e carteira, menos o do próprio menu). O que está escolhido aparece mesmo com zero, para poder sair.
function pv2GruposOpcoesExtras(base, quadro = 'producao', hoje = pv2HojeIso()) {
  const naCarteira = (i) => typeof itemNaCarteira !== 'function' || itemNaCarteira(i);
  const daPessoa = (i) => typeof selectedPersonIds === 'undefined' || !selectedPersonIds.size || itemMatchesSelectedPeople(i);
  const todos = base || [], sem = (o) => pv2GruposAplicarFiltros(todos, { hoje, ...o }), nosDois = (i) => naCarteira(i) && daPessoa(i);
  const comTodos = sem({});
  const contar = (lista, valor, escolhidos) => {
    const m = new Map();
    for (const i of lista) { const v = valor(i), k = pv2ChaveCliente(v), a = m.get(k); m.set(k, [a ? a[0] : v, (a ? a[1] : 0) + 1]); }
    for (const v of escolhidos) if (!m.has(pv2ChaveCliente(v))) m.set(pv2ChaveCliente(v), [v, 0]);
    return m;
  };
  const porNome = (a, b) => (a[0] === '') - (b[0] === '') || a[1].localeCompare(b[1], 'pt-BR');
  const formatos = [...contar(sem({ formatos: new Set() }).filter(nosDois), (i) => pv2Preenchido(i.formato), pv2GruposFormatos).values()].map(([v, n]) => [v, v || 'Sem formato', n]).sort(porNome);
  let captacoes = null;
  if (quadro === 'producao') {
    const m = contar(sem({ captacoes: new Set() }).filter(nosDois), (i) => pv2Preenchido(i.captacao), pv2GruposCaptacoes);
    let cat = []; try { cat = typeof catalogoDoCampo === 'function' ? catalogoDoCampo('captacao').filter((c) => c.ativa !== false).map((c) => String(c.rotulo || '').trim()).filter(Boolean) : []; } catch { cat = []; }
    // Na ordem do catálogo (a mesma do menu da pílula); o que não está nele vem depois, e "Sem captação" no fim.
    const ordem = cat.map(pv2ChaveCliente);
    captacoes = [...new Set([...ordem, ...[...m.keys()]])].filter((k) => m.has(k) || ordem.includes(k))
      .map((k) => { const [v, n] = m.get(k) || [cat[ordem.indexOf(k)], 0]; return [v, v || 'Sem captação', n, ordem.includes(k) ? ordem.indexOf(k) : 999]; })
      .sort((a, b) => (a[0] === '') - (b[0] === '') || a[3] - b[3] || a[1].localeCompare(b[1], 'pt-BR')).map(([v, r, n]) => [v, r, n]);
  }
  const time = typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS, pm = new Map();
  for (const i of comTodos.filter(naCarteira)) for (const id of new Set([...(i.responsavel_ids || []), i.responsavel_id].filter(Boolean).map(String))) pm.set(id, (pm.get(id) || 0) + 1);
  for (const id of typeof selectedPersonIds === 'undefined' ? [] : selectedPersonIds) if (!pm.has(String(id))) pm.set(String(id), 0);
  const pessoas = [...pm.entries()].map(([id, n]) => { const u = time.find((x) => String(x.id) === id); return u ? [id, String(u.name || ''), n] : null; })
    .filter(Boolean).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const daP = comTodos.filter(daPessoa), carteiras = { all: daP.length };
  for (const c of typeof CARTEIRAS_DA_AGENDA === 'undefined' ? [] : CARTEIRAS_DA_AGENDA) carteiras[c.id] = daP.filter((i) => clientesDoItem(i).some((n) => carteiraDoCliente(n) === c.id)).length;
  const datas = {}, semData = sem({ data: { recorte: '' } }).filter(nosDois);
  for (const [k] of PV2_GRUPOS_RECORTES) if (k && k !== 'intervalo') datas[k] = semData.filter((i) => pv2GruposNaData(i, { campo: pv2GruposData.campo, recorte: k }, hoje)).length;
  return { formatos, captacoes, pessoas, carteiras, datas };
}
const pv2GruposRedesenha = () => renderVisaoDeGrupos('producao');
function pv2GruposEscolher(id) { pv2GruposSel = String(id); pv2GruposRedesenha(); }
function pv2GruposFiltrar(f) { pv2GruposFiltro = f; pv2GruposRedesenha(); }
function pv2GruposFiltrarStatus(st) { pv2GruposStatus = String(st || ''); pv2GruposRedesenha(); }
// FILTRO DE CLIENTE (Paulo, 19/11/2026: "no painel de trabalho (em grupos) também quero poder filtrar por cliente"). Um ou
// mais clientes, com o nome como aparece no painel (clientesDoItem) e só os que estão na lista de clientes
// (clienteApareceNaLista, o mesmo critério do filtro de Cliente das Demandas). Vale junto com a busca e com a pessoa
// (itensPorGrupo), e fica guardado no navegador de quem escolheu, com a ordem da tabela.
const pv2GruposClientes = new Set();
let pv2GruposPrefsDe = '';
const pv2ChaveCliente = (n) => String(n ?? '').trim().toLocaleLowerCase('pt-BR');
function pv2GruposFiltroCliente(itens, escolhidos = pv2GruposClientes) {
  if (!escolhidos.size) return itens;
  const alvo = new Set([...escolhidos].map(pv2ChaveCliente));
  return itens.filter((i) => clientesDoItem(i).some((n) => alvo.has(pv2ChaveCliente(n))));
}
// Os clientes que dá para escolher, com quantas peças cada um tem nos outros filtros (carteira, pessoa e busca); quem
// está escolhido aparece mesmo com zero, para poder sair.
function pv2GruposOpcoesDeCliente(base) {
  const aparece = (n) => typeof clienteApareceNaLista !== 'function' || clienteApareceNaLista(n);
  const daPessoa = (i) => (typeof itemNaCarteira !== 'function' || itemNaCarteira(i)) && (typeof selectedPersonIds === 'undefined' || !selectedPersonIds.size || itemMatchesSelectedPeople(i));
  // Um cliente por nome, sem diferença de maiúscula (fica a grafia que aparece primeiro, a do painel).
  const conta = new Map();
  for (const i of base || []) {
    if (!daPessoa(i)) continue;
    for (const n of new Set(clientesDoItem(i).map((x) => String(x || '').trim()).filter((x) => x && aparece(x)))) {
      const k = pv2ChaveCliente(n), atual = conta.get(k) || [n, 0, ''];
      if (atual[2] !== i.id) conta.set(k, [atual[0], atual[1] + 1, i.id]);
    }
  }
  for (const n of pv2GruposClientes) if (!conta.has(pv2ChaveCliente(n))) conta.set(pv2ChaveCliente(n), [n, 0, '']);
  return [...conta.values()].map(([n, q]) => [n, q]).sort((a, b) => (b[1] > 0) - (a[1] > 0) || a[0].localeCompare(b[0], 'pt-BR'));
}
function pv2GruposChavePrefs() {
  const eu = typeof pessoaLogada === 'function' ? pessoaLogada() : null;
  return `vybe_grupos_producao:${eu?.id || 'todos'}`;
}
function pv2GruposRestaurar() {
  const chave = pv2GruposChavePrefs(); if (pv2GruposPrefsDe === chave) return;
  pv2GruposPrefsDe = chave;
  let salvo = {}; try { salvo = JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch { /* preferência inválida */ }
  pv2GruposClientes.clear();
  if (Array.isArray(salvo.clientes)) salvo.clientes.filter((n) => typeof n === 'string' && n.trim()).forEach((n) => pv2GruposClientes.add(n));
  pv2GruposCaptacao = salvo.semCaptacao !== true;
  pv2GruposComId = salvo.comId === true;
  pv2GruposComFormato = salvo.comFormato === true;
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  pv2GruposFormatos.clear(); lista(salvo.formatos).forEach((v) => pv2GruposFormatos.add(v));
  pv2GruposCaptacoes.clear(); lista(salvo.captacoes).forEach((v) => pv2GruposCaptacoes.add(v));
  const d = salvo.data && typeof salvo.data === 'object' ? salvo.data : {};
  pv2GruposData = { campo: Object.hasOwn(PV2_GRUPOS_CAMPOS_DATA, d.campo) ? d.campo : 'veiculacao_iso', recorte: PV2_GRUPOS_RECORTES.some(([k]) => k === d.recorte) ? d.recorte : '', de: pv2IsoOk(d.de), ate: pv2IsoOk(d.ate) };
  // Pessoa e carteira são as do painel inteiro: a escolha guardada só volta quando nada está escolhido agora.
  if (typeof selectedPersonIds !== 'undefined' && !selectedPersonIds.size && lista(salvo.pessoas).length) {
    lista(salvo.pessoas).forEach((id) => selectedPersonIds.add(id));
    if (typeof currentPersonFilter !== 'undefined') currentPersonFilter = [...selectedPersonIds].join(',');
    if (typeof syncPersonFilterVisual === 'function') syncPersonFilterVisual();
  }
  if (typeof filtroCarteira !== 'undefined' && filtroCarteira === 'all' && ['vinicius', 'ewerton'].includes(salvo.carteira)) {
    filtroCarteira = salvo.carteira;
    if (typeof pintarFiltroCarteira === 'function') pintarFiltroCarteira();
  }
  if (salvo.ordem && typeof CAMPOS_ORDENAVEIS !== 'undefined' && Object.hasOwn(CAMPOS_ORDENAVEIS, salvo.ordem.campo)) ORDEM = { campo: salvo.ordem.campo, desc: salvo.ordem.desc === true };
}
// O que a pessoa escolheu, por pessoa logada. Também roda a cada desenho da folha, porque pessoa e carteira podem mudar
// fora dela (o Feed, a faixa de pessoas); só grava quando mudou.
let pv2GruposGuardado = '';
function pv2GruposPrefsAtuais() {
  const pessoas = typeof selectedPersonIds === 'undefined' ? [] : [...selectedPersonIds].map(String);
  const carteira = typeof filtroCarteira === 'undefined' || filtroCarteira === 'all' ? '' : filtroCarteira;
  const d = pv2GruposData;
  return { clientes: [...pv2GruposClientes], ordem: ORDEM, ...(pv2GruposCaptacao ? {} : { semCaptacao: true }), ...(pv2GruposComId ? { comId: true } : {}), ...(pv2GruposComFormato ? { comFormato: true } : {}),
    ...(pv2GruposFormatos.size ? { formatos: [...pv2GruposFormatos] } : {}), ...(pv2GruposCaptacoes.size ? { captacoes: [...pv2GruposCaptacoes] } : {}),
    ...(d.recorte || d.campo !== 'veiculacao_iso' ? { data: { campo: d.campo, recorte: d.recorte, de: d.de, ate: d.ate } } : {}),
    ...(pessoas.length ? { pessoas } : {}), ...(carteira ? { carteira } : {}) };
}
function pv2GruposGuardar() {
  if (!pv2GruposPrefsDe) return;
  const txt = JSON.stringify(pv2GruposPrefsAtuais());
  if (txt === pv2GruposGuardado) return;
  try { localStorage.setItem(pv2GruposPrefsDe, txt); pv2GruposGuardado = txt; } catch { /* sem armazenamento, o filtro vale até fechar */ }
}
const pv2GruposTemCliente = (n) => [...pv2GruposClientes].some((x) => pv2ChaveCliente(x) === pv2ChaveCliente(n));
function pv2GruposAlternarCliente(nome) {
  const atual = [...pv2GruposClientes].find((x) => pv2ChaveCliente(x) === pv2ChaveCliente(nome));
  if (atual) pv2GruposClientes.delete(atual); else if (String(nome || '').trim()) pv2GruposClientes.add(String(nome).trim());
  pv2GruposGuardar(); pv2GruposRedesenha();
  if (document.getElementById('s-f-menu')) { pv2GruposPintarMenu(); [...document.querySelectorAll('#s-f-menu [data-cliente]')].find((b) => b.dataset.cliente === nome)?.focus(); }
}
function pv2GruposTirarCliente(nome) {
  const atual = [...pv2GruposClientes].find((x) => pv2ChaveCliente(x) === pv2ChaveCliente(nome));
  if (atual) pv2GruposClientes.delete(atual);
  pv2GruposGuardar(); pv2GruposRedesenha(); pv2GruposFocoNosFiltros();
}
function pv2GruposLimparClientes() { pv2GruposClientes.clear(); pv2GruposGuardar(); pv2GruposFecharMenu(false); pv2GruposRedesenha(); pv2GruposFocoNosFiltros('cliente'); }
function pv2GruposEscolherStatus(st) { pv2GruposFecharMenu(false); pv2GruposFiltrarStatus(st); pv2GruposFocoNosFiltros('status'); }
function pv2GruposTirarPessoa(id) {
  if (typeof filterByPerson === 'function') filterByPerson(String(id), document.querySelector(`#person-filter-bar .person-wrap[data-person-id="${CSS.escape(String(id))}"]`) || document.getElementById('person-all'));
  pv2GruposRedesenha(); pv2GruposFocoNosFiltros();
}
function pv2GruposTirarBusca() {
  if (typeof buscarClienteConteudos === 'function') buscarClienteConteudos(''); else { buscaClienteConteudos = ''; pv2GruposRedesenha(); }
  pv2GruposFocoNosFiltros();
}
function pv2GruposLimparTudo() {
  pv2GruposFecharMenu(false);
  pv2GruposClientes.clear(); pv2GruposStatus = ''; pv2GruposFormatos.clear(); pv2GruposCaptacoes.clear();
  pv2GruposData = { ...pv2GruposData, recorte: '', de: '', ate: '' };
  if (typeof selectedPersonIds !== 'undefined' && selectedPersonIds.size && typeof filterByPerson === 'function') filterByPerson('all', document.getElementById('person-all'));
  if (typeof filtroCarteira !== 'undefined' && filtroCarteira !== 'all' && typeof definirFiltroCarteira === 'function') definirFiltroCarteira('all');
  buscaClienteConteudos = '';
  pv2GruposGuardar();
  pv2GruposRedesenha(); pv2GruposFocoNosFiltros('cliente');
}
// Os menus novos: marcar e desmarcar deixa o menu aberto, na mesma opção; tirar pelo chip devolve o foco aos filtros.
function pv2GruposRepintarMenu(k) {
  if (!document.getElementById('s-f-menu')) return;
  pv2GruposPintarMenu();
  [...document.querySelectorAll('#s-f-menu [data-k]')].find((b) => b.dataset.k === k)?.focus();
}
const pv2GruposDepois = (k = '') => { pv2GruposGuardar(); pv2GruposRedesenha(); if (k) pv2GruposRepintarMenu(k); };
function pv2GruposAlternarEm(conjunto, v) { const s = String(v ?? ''); if (conjunto.has(s)) conjunto.delete(s); else conjunto.add(s); }
const pv2GruposPessoaWrap = (id) => document.querySelector(`#person-filter-bar .person-wrap[data-person-id="${CSS.escape(String(id))}"]`) || document.getElementById('person-all');
function pv2GruposAlternarPessoa(id) { if (typeof filterByPerson === 'function') filterByPerson(String(id), pv2GruposPessoaWrap(id)); pv2GruposDepois(`p:${id}`); }
function pv2GruposLimparPessoas() {
  if (typeof selectedPersonIds !== 'undefined' && selectedPersonIds.size && typeof filterByPerson === 'function') filterByPerson('all', document.getElementById('person-all'));
  pv2GruposFecharMenu(false); pv2GruposDepois(); pv2GruposFocoNosFiltros('pessoa');
}
function pv2GruposAlternarFormato(v) { pv2GruposAlternarEm(pv2GruposFormatos, v); pv2GruposDepois(`f:${v}`); }
function pv2GruposTirarFormato(v) { pv2GruposFormatos.delete(String(v ?? '')); pv2GruposDepois(); pv2GruposFocoNosFiltros(); }
function pv2GruposLimparFormatos() { pv2GruposFormatos.clear(); pv2GruposFecharMenu(false); pv2GruposDepois(); pv2GruposFocoNosFiltros('formato'); }
function pv2GruposAlternarCaptacao(v) { pv2GruposAlternarEm(pv2GruposCaptacoes, v); pv2GruposDepois(`a:${v}`); }
function pv2GruposTirarCaptacao(v) { pv2GruposCaptacoes.delete(String(v ?? '')); pv2GruposDepois(); pv2GruposFocoNosFiltros(); }
function pv2GruposEscolherCarteira(id) { if (typeof definirFiltroCarteira === 'function') definirFiltroCarteira(String(id)); pv2GruposDepois(`k:${id}`); }
function pv2GruposTirarCarteira() { if (typeof definirFiltroCarteira === 'function') definirFiltroCarteira('all'); pv2GruposDepois(); pv2GruposFocoNosFiltros(); }
function pv2GruposEscolherData(recorte) {
  const r = PV2_GRUPOS_RECORTES.some(([k]) => k === recorte) ? recorte : '';
  pv2GruposData = { ...pv2GruposData, recorte: r, ...(r === 'intervalo' ? {} : { de: '', ate: '' }) };
  if (r === 'intervalo') { pv2GruposDepois('de'); return; }
  pv2GruposFecharMenu(false); pv2GruposDepois(); pv2GruposFocoNosFiltros('data');
}
function pv2GruposCampoData(campo) { if (!Object.hasOwn(PV2_GRUPOS_CAMPOS_DATA, campo)) return; pv2GruposData = { ...pv2GruposData, campo }; pv2GruposDepois(`c:${campo}`); }
function pv2GruposIntervalo(qual, v) { const q = qual === 'ate' ? 'ate' : 'de'; pv2GruposData = { ...pv2GruposData, recorte: 'intervalo', [q]: pv2IsoOk(v) }; pv2GruposDepois(q); }
function pv2GruposTirarData() { pv2GruposData = { ...pv2GruposData, recorte: '', de: '', ate: '' }; pv2GruposDepois(); pv2GruposFocoNosFiltros(); }
// Depois de tirar um filtro, o foco fica no próximo chip (ou no botão do filtro), não cai no body.
function pv2GruposFocoNosFiltros(qual = '') {
  const folha = document.querySelector('#grupos-board .d3m-a-gr'); if (!folha) return;
  (qual ? folha.querySelector(`[data-s-f="${qual}"]`) : folha.querySelector('.s-f-chip') || folha.querySelector('.s-f-filtro[data-s-f="cliente"]'))?.focus();
}
// Os menus de Cliente e Status da cabeça: soltos no body, como o menu de status da linha, porque a folha corta o que sai
// dela. O de Status troca o select nativo, que a folha antiga pintava de branco à força (o "selecionar branco").
let pv2GruposMenuQual = '', pv2GruposMenuBusca = '';
const PV2_GRUPOS_MENUS = { cliente: 'Filtrar por cliente', colunas: 'Colunas da tabela', status: 'Filtrar por status', pessoa: 'Filtrar por pessoa', formato: 'Filtrar por formato', data: 'Filtrar por data', mais: 'Mais filtros: carteira e captação' };
// Uma opção dos menus (marcar vários, ou escolher um); data-k diz qual é, para o foco voltar a ela quando o menu repinta.
function pv2GruposOp(k, v, rotulo, n, on, acao, papel = 'checkbox') {
  return `<button type="button" class="s-f-op${n === 0 ? ' vazio' : ''}" role="${papel}" aria-checked="${on}" data-k="${safeText(k)}" data-v="${safeText(v)}" onclick="${acao}"><span>${safeText(rotulo)}</span>${n == null ? '' : `<b>${n}</b>`}${on ? `<i class="s-f-visto" aria-hidden="true">${PV2_IC.ok}</i>` : ''}</button>`;
}
const pv2GruposCabMenu = (titulo, n, vazio = 'escolha um ou mais') => `<div class="status-editor-head v2-st-cab"><span>${titulo}</span><small>${n ? `${n} ${pv2Pl(n, 'escolhido', 'escolhidos')}` : vazio}</small></div>`;
const pv2GruposTirarOp = (rotulo, acao) => `<button type="button" class="s-f-op s-f-tirar" onclick="${acao}"><span>${rotulo}</span></button>`;
function pv2GruposFecharMenu(devolverFoco = true) {
  const qual = pv2GruposMenuQual;
  document.getElementById('s-f-menu')?.remove(); document.getElementById('s-f-menu-fundo')?.remove();
  pv2GruposMenuQual = ''; pv2GruposMenuBusca = '';
  document.removeEventListener('keydown', pv2GruposEscDoMenu, true);
  document.querySelectorAll('[data-s-f][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  if (devolverFoco && qual) pv2GruposFocoNosFiltros(qual);
}
function pv2GruposAbrirMenu(ev, qual) {
  ev?.stopPropagation?.();
  if (pv2GruposMenuQual === qual) return pv2GruposFecharMenu();
  pv2GruposFecharMenu(false);
  const botao = ev?.currentTarget || document.querySelector(`#grupos-board [data-s-f="${qual}"]`); if (!botao) return;
  if (typeof closeStatusEditor === 'function') closeStatusEditor();
  pv2GruposMenuQual = qual;
  const fundo = document.createElement('div'); fundo.id = 's-f-menu-fundo'; fundo.className = 'status-editor-backdrop'; fundo.onclick = () => pv2GruposFecharMenu();
  const menu = document.createElement('div'); menu.id = 's-f-menu'; menu.className = 'status-editor s-f-menu';
  menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', PV2_GRUPOS_MENUS[qual] || 'Filtrar');
  // Esc fecha o menu e devolve o foco ao botão. Na captura: o mundo também escuta o Esc (fecha a janela) e chegava antes.
  document.addEventListener('keydown', pv2GruposEscDoMenu, true);
  document.body.append(fundo, menu);
  botao.setAttribute('aria-expanded', 'true');
  pv2GruposPintarMenu();
  if (typeof ancorarPopover === 'function') ancorarPopover(menu, botao.getBoundingClientRect());
  (menu.querySelector('input') || menu.querySelector('[aria-checked="true"]') || menu.querySelector('button'))?.focus();
}
function pv2GruposEscDoMenu(e) {
  if (e.key !== 'Escape' || !document.getElementById('s-f-menu')) return;
  e.preventDefault(); e.stopPropagation(); pv2GruposFecharMenu();
}
function pv2GruposPintarMenu({ soLista = false } = {}) {
  const menu = document.getElementById('s-f-menu'); if (!menu) return;
  const f = pv2Vista.grupos?.filtros || { clientes: [], status: [], total: 0 };
  const visto = `<i class="s-f-visto" aria-hidden="true">${PV2_IC.ok}</i>`;
  if (pv2GruposMenuQual === 'colunas') {
    const op = (v, r, on) => `<button type="button" class="s-f-op" role="checkbox" aria-checked="${on}" data-coluna="${v}" onclick="pv2GruposAlternarColuna('${v}')"><span>${r}</span>${on ? visto : ''}</button>`;
    menu.innerHTML = '<div class="status-editor-head">Colunas</div>' + op('captacao', 'Captação', pv2GruposCaptacao) + op('formato', 'Formato', pv2GruposComFormato) + op('id', 'ID', pv2GruposComId) + op('colunas', 'Tipo, OFF, prioridade, quem cadastrou e quando', pv2GruposColunas);
    return;
  }
  if (pv2GruposMenuQual === 'pessoa') {
    const sel = typeof selectedPersonIds === 'undefined' ? new Set() : selectedPersonIds;
    const linhas = (f.pessoas || []).map(([id, nome, n]) => pv2GruposOp(`p:${id}`, id, nome, n, sel.has(String(id)), 'pv2GruposAlternarPessoa(this.dataset.v)')).join('') || '<p class="s-f-nada">Ninguém responde pelas peças deste recorte.</p>';
    menu.innerHTML = pv2GruposCabMenu('Pessoa', sel.size) + `<div class="s-f-lista" role="group" aria-label="Pessoas">${linhas}</div>` + (sel.size ? pv2GruposTirarOp('Tirar o filtro de pessoa', 'pv2GruposLimparPessoas()') : '');
    return;
  }
  if (pv2GruposMenuQual === 'formato') {
    const linhas = (f.formatos || []).map(([v, r, n]) => pv2GruposOp(`f:${v}`, v, r, n, pv2GruposFormatos.has(v), 'pv2GruposAlternarFormato(this.dataset.v)')).join('') || '<p class="s-f-nada">Nenhum formato nas peças deste recorte.</p>';
    menu.innerHTML = pv2GruposCabMenu('Formato', pv2GruposFormatos.size) + `<div class="s-f-lista" role="group" aria-label="Formatos">${linhas}</div>` + (pv2GruposFormatos.size ? pv2GruposTirarOp('Tirar o filtro de formato', 'pv2GruposLimparFormatos()') : '');
    return;
  }
  if (pv2GruposMenuQual === 'data') {
    const d = pv2GruposData;
    const campos = Object.entries(PV2_GRUPOS_CAMPOS_DATA).map(([k, r]) => `<button type="button" role="radio" aria-checked="${d.campo === k}" data-k="c:${k}" data-v="${k}" onclick="pv2GruposCampoData(this.dataset.v)">${r}</button>`).join('');
    const recortes = PV2_GRUPOS_RECORTES.map(([k, r]) => pv2GruposOp(`r:${k}`, k, r, f.datas?.[k] ?? null, (d.recorte || '') === k, 'pv2GruposEscolherData(this.dataset.v)', 'radio')).join('');
    const intervalo = d.recorte === 'intervalo' ? `<div class="s-f-intervalo"><label><span>De</span><input type="date" class="s-f-busca" data-k="de" value="${safeText(d.de)}"${d.ate ? ` max="${safeText(d.ate)}"` : ''} onchange="pv2GruposIntervalo('de',this.value)"></label><label><span>Até</span><input type="date" class="s-f-busca" data-k="ate" value="${safeText(d.ate)}"${d.de ? ` min="${safeText(d.de)}"` : ''} onchange="pv2GruposIntervalo('ate',this.value)"></label></div>` : '';
    menu.innerHTML = '<div class="status-editor-head v2-st-cab"><span>Data</span><small>uma escolha</small></div>'
      + `<div class="s-f-seg" role="radiogroup" aria-label="Qual data usar">${campos}</div>`
      + `<div class="s-f-lista" role="radiogroup" aria-label="Quando">${recortes}</div>${intervalo}`;
    return;
  }
  if (pv2GruposMenuQual === 'mais') {
    const cart = typeof CARTEIRAS_DA_AGENDA === 'undefined' ? [] : CARTEIRAS_DA_AGENDA, atual = typeof filtroCarteira === 'undefined' ? 'all' : filtroCarteira;
    const carteiras = [['all', 'Todas as carteiras'], ...cart.map((c) => [c.id, `${c.apelido} · ${c.dono}`])]
      .map(([k, r]) => pv2GruposOp(`k:${k}`, k, r, f.carteiras?.[k] ?? null, atual === k, 'pv2GruposEscolherCarteira(this.dataset.v)', 'radio')).join('');
    const caps = f.captacoes ? (f.captacoes.map(([v, r, n]) => pv2GruposOp(`a:${v}`, v, r, n, pv2GruposCaptacoes.has(v), 'pv2GruposAlternarCaptacao(this.dataset.v)')).join('') || '<p class="s-f-nada">Nenhuma captação no catálogo.</p>') : '';
    menu.innerHTML = '<div class="status-editor-head v2-st-cab"><span>Carteira</span><small>uma escolha</small></div>' + `<div class="s-f-lista" role="radiogroup" aria-label="Carteira">${carteiras}</div>`
      + (f.captacoes ? pv2GruposCabMenu('Captação', pv2GruposCaptacoes.size) + `<div class="s-f-lista" role="group" aria-label="Captação">${caps}</div>` : '');
    return;
  }
  if (pv2GruposMenuQual === 'status') {
    menu.innerHTML = '<div class="status-editor-head">Status</div>' + [['', 'Todos os status', f.total], ...f.status.map(([s, n]) => [s, s, n])]
      .map(([v, r, n]) => { const on = (pv2GruposStatus || '') === v; return `<button type="button" class="s-f-op" role="radio" aria-checked="${on}" data-valor="${safeText(v)}" onclick="pv2GruposEscolherStatus(this.dataset.valor)"><span>${safeText(r)}</span><b>${n}</b>${on ? visto : ''}</button>`; }).join('');
    return;
  }
  const termo = pv2ChaveCliente(pv2GruposMenuBusca);
  const lista = f.clientes.filter(([n]) => !termo || pv2ChaveCliente(n).includes(termo));
  const linhas = lista.map(([n, q]) => { const on = pv2GruposTemCliente(n); return `<button type="button" class="s-f-op${q ? '' : ' vazio'}" role="checkbox" aria-checked="${on}" data-cliente="${safeText(n)}" onclick="pv2GruposAlternarCliente(this.dataset.cliente)" title="${on ? 'Tirar' : 'Mostrar'} ${safeText(n)}">${pv2Foto(n)}<span>${safeText(n)}</span><b>${q}</b>${on ? visto : ''}</button>`; }).join('')
    || `<p class="s-f-nada">${termo ? `Nenhum cliente com “${safeText(pv2GruposMenuBusca)}”.` : 'Nenhum cliente nas peças deste recorte.'}</p>`;
  if (soLista && menu.querySelector('.s-f-lista')) { menu.querySelector('.s-f-lista').innerHTML = linhas; return; }
  const n = pv2GruposClientes.size;
  menu.innerHTML = `<div class="status-editor-head v2-st-cab"><span>Cliente</span><small>${n ? `${n} ${pv2Pl(n, 'escolhido', 'escolhidos')}` : 'escolha um ou mais'}</small></div>`
    + `<input type="search" class="s-f-busca" autocomplete="off" placeholder="Buscar cliente" aria-label="Buscar cliente" value="${safeText(pv2GruposMenuBusca)}" oninput="pv2GruposMenuBusca=this.value;pv2GruposPintarMenu({soLista:true})">`
    + `<div class="s-f-lista" role="group" aria-label="Clientes">${linhas}</div>`
    + (n ? '<button type="button" class="s-f-op s-f-tirar" onclick="pv2GruposLimparClientes()"><span>Tirar o filtro de cliente</span></button>' : '');
}
// Uma coluna do menu "Colunas": a tabela redesenha e o menu continua aberto na mesma opção.
function pv2GruposAlternarColuna(qual) {
  pv2GruposAlternar(['captacao', 'id', 'formato'].includes(qual) ? qual : 'colunas');
  pv2GruposPintarMenu();
  document.querySelector(`#s-f-menu [data-coluna="${qual}"]`)?.focus();
}
// Marca (ou desmarca) tudo o que está no recorte da folha (grupo, filtro e status), não só as linhas à mostra.
function pv2GruposMarcarRecorte(marcar) {
  const itens = pv2Vista.grupos?.exporta?.itens || [];
  for (const i of itens) { if (marcar) SELECIONADAS.add(String(i.id)); else SELECIONADAS.delete(String(i.id)); }
  if (typeof repintarOndeHaSelecao === 'function') repintarOndeHaSelecao(); else pv2GruposRedesenha();
}
function pv2GruposAlternar(qual) {
  if (qual === 'colunas') pv2GruposColunas = !pv2GruposColunas;
  if (qual === 'captacao') { pv2GruposCaptacao = !pv2GruposCaptacao; pv2GruposGuardar(); }
  if (qual === 'id') { pv2GruposComId = !pv2GruposComId; pv2GruposGuardar(); }
  if (qual === 'formato') { pv2GruposComFormato = !pv2GruposComFormato; pv2GruposGuardar(); }
  if (qual === 'lote') { pv2GruposLote = !pv2GruposLote; if (!pv2GruposLote && SELECIONADAS.size && typeof limparSelecao === 'function') limparSelecao(); }
  pv2GruposRedesenha();
}
const pv2GrupoVencida = (i, hoje) => Boolean(i.veiculacao_iso) && i.veiculacao_iso < hoje && !atividadeDoDiaConcluida(i);
// A tabela do grupo em arquivo (CSV com ponto e vírgula, que a planilha abre direto): o que está na lista, no recorte.
function pv2GruposExportar() {
  const d = pv2Vista.grupos?.exporta; if (!d || !d.itens.length) return;
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['ID', 'Conteúdo', 'Cliente', 'Formato', 'Status', 'Prazo', 'Veiculação', 'Responsável'].map(cel).join(';')]
    .concat(d.itens.map((i) => [i.id, i.nome, clientesDoItem(i).join(', '), i.formato, i.status, i.prazo_iso, i.veiculacao_iso, String(i.responsavel || '').replace('—', '')].map(cel).join(';')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `${String(d.nome || 'grupo').toLowerCase().replace(/[^a-z0-9à-ú]+/gi, '-')}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function pv2GrupoLinha(item, { lote, extras, hoje, cap = false, comId = false, comFormato = false }) {
  const parar = 'event.stopPropagation()', id = jsArg(item.id), marcada = SELECIONADAS.has(String(item.id));
  const nome = String(item.nome || 'Sem título'), corte = nome.indexOf(' - ');
  const titulo = corte > 0 ? `<b>${safeText(nome.slice(0, corte))}</b> · ${safeText(nome.slice(corte + 3))}` : `<b>${safeText(nome)}</b>`;
  const data = (campo, iso, atrasado) => `<label class="d3m-a-data${atrasado ? ' r' : ''}"><span>${iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : 'sem data'}</span><input type="date" class="grupo-data-campo${atrasado ? ' is-late' : ''}" value="${safeText(iso || '')}" onclick="${parar};if(this.showPicker)try{this.showPicker()}catch(e){}" onchange="${parar};salvarDataNaLinha('${item.id}','${campo}',this)" title="${campo === 'prazo' ? 'Prazo de produção' : 'Data de veiculação'}" aria-label="${campo === 'prazo' ? 'Prazo de produção' : 'Data de veiculação'} de ${safeText(nome)}"></label>`;
  const escolha = (campo) => `<td class="s-f-td-${campo}" onclick="${parar}">${pillEditavel(item, campo)}</td>`;
  const cad = extras ? cadastroDaPeca(item) : null;
  return `<tr class="${marcada ? 'marcada' : ''}${typeof pv2Chegou === 'function' ? pv2Chegou(item) : ''}" onclick="openItemWorkspace('${id}')" title="Abrir ${safeText(nome)} · ${safeText(item.id)}">`
    // A célula inteira marca (com shift, o intervalo); o shift no mousedown não seleciona o texto das linhas no caminho.
    + (lote ? `<td class="grupo-marcar" onmousedown="if(event.shiftKey)event.preventDefault()" onclick="${parar};if(event.target===this)alternarSelecao('${id}',${!marcada},event)"><input type="checkbox" ${marcada ? 'checked' : ''} data-item-id="${safeText(item.id)}" aria-label="Selecionar ${safeText(nome)}" onclick="${parar};alternarSelecao('${id}',this.checked,event)"></td>` : '')
    // O ID só com "Colunas → ID" ligado, e só o número (o "vybe:" é igual em todas); o ID inteiro fica no title e na cópia.
    + (comId ? `<td class="grupo-id" onclick="${parar};copiarId('${id}')" title="${safeText(item.id)} · clique para copiar o ID">${safeText(String(item.id).replace(/^vybe:/, ''))}</td>` : '')
    + `<td class="d3m-a-g-nome"><span>${titulo}</span>${botaoDePreviaNaLinha(item)}</td>`
    + `<td class="d3m-a-g-cli" onclick="${parar}">${pv2Foto(clientesDoItem(item)[0] || '')}${botaoClientesDoItem(item)}</td>`
    + (comFormato ? escolha('formato') : '')
    + `<td data-label="Status" onclick="${parar}">${pv2StatusBotao(item)}</td>`
    // A Captação ao lado do Status, com a pílula e o menu dela (Paulo, 19/11/2026: "a tabela do status... e separada também").
    + (cap ? `<td class="s-f-cap" data-label="Captação" onclick="${parar}">${pillEditavel(item, 'captacao')}</td>` : '')
    + `<td data-label="Prazo" onclick="${parar}">${data('prazo', item.prazo_iso, item.prazo_atrasado)}</td>`
    + `<td data-label="Veiculação" onclick="${parar}">${data('veiculacao', item.veiculacao_iso, pv2GrupoVencida(item, hoje))}</td>`
    + `<td class="d3m-a-g-quem" onclick="${parar}">${pv2Av(item)}</td>`
    + (extras ? PV2_GRUPOS_EXTRAS.filter((c) => c !== 'captacao').map(escolha).join('') + `<td class="grupo-cadastro">${safeText(cad.quem)}</td><td class="grupo-cadastro grupo-cadastro-data">${safeText(cad.quando)}</td>` : '')
    + '</tr>';
}
function pv2GruposHtml({ grupos, quadro, base = null, semFiltro = null }) {
  const hoje = pv2HojeIso(), comPecas = grupos.filter((g) => g.itens.length);
  if (!grupos.some((g) => g.id === pv2GruposSel)) pv2GruposSel = (comPecas[0] || grupos[0])?.id || '';
  const grupo = grupos.find((g) => g.id === pv2GruposSel) || { id: '', nome: 'Sem grupo', itens: [] };
  const total = grupos.reduce((s, g) => s + g.itens.length, 0);
  const semDono = grupo.itens.filter(pv2SemDono), vencidas = grupo.itens.filter((i) => pv2GrupoVencida(i, hoje));
  const doFiltro = pv2GruposFiltro === 'semdono' ? semDono : pv2GruposFiltro === 'vencidas' ? vencidas : grupo.itens;
  // O filtro de status da cabeça: os status que o grupo tem, com quantas peças; um status que sumiu do grupo volta a "todos".
  const stDe = (i) => String(i.status || '').trim() || 'Sem status';
  const contaSt = new Map(); for (const i of grupo.itens) contaSt.set(stDe(i), (contaSt.get(stDe(i)) || 0) + 1);
  if (pv2GruposStatus && !contaSt.has(pv2GruposStatus)) pv2GruposStatus = '';
  const recorte = pv2GruposStatus ? doFiltro.filter((i) => stDe(i) === pv2GruposStatus) : doFiltro;
  const todos = gruposExpandidos.has(grupo.id), visiveis = todos ? recorte : recorte.slice(0, LINHAS_POR_GRUPO), restam = recorte.length - visiveis.length;
  // As caixas de marcar ficam sempre à vista (Bia, 18/11): marcar várias não depende mais de achar o "Marcar várias".
  const lote = true, extras = pv2GruposColunas, cap = pv2GruposCaptacao && quadro === 'producao';
  const comId = pv2GruposComId, comFormato = pv2GruposComFormato;
  const escondidas = (comId ? [] : ['ID']).concat(comFormato ? [] : ['formato']).concat(cap ? [] : ['captação']).concat(extras ? [] : ['tipo', 'off', 'prioridade', 'quem cadastrou', 'quando']);
  const marcadasAqui = recorte.filter((i) => SELECIONADAS.has(String(i.id))).length;
  // O ↕ vai em desenho: o caractere vira emoji colorido no Windows.
  const pv2SetaDupla = typeof ICONE !== 'undefined' && ICONE.ordenar ? ICONE.ordenar : '↕';
  // Cada cabeça leva a classe do campo: as larguras saem dela (s-f.css), não da posição, que muda com ID e Captação.
  const th = (campo, rotulo) => { const on = ORDEM.campo === campo; return `<th class="s-f-c-${campo}"${on ? ` aria-sort="${ORDEM.desc ? 'descending' : 'ascending'}"` : ''}><button type="button" class="d3m-a-th${on ? ' on' : ''}" onclick="ordenarPor('${campo}')" title="Ordenar por ${rotulo}${on ? (ORDEM.desc ? ' (maior para menor)' : ' (menor para maior)') : ''}">${rotulo}<i class="s-f-seta" aria-hidden="true">${on ? (ORDEM.desc ? '↓' : '↑') : pv2SetaDupla}</i></button></th>`; };
  const todasMarcadas = recorte.length > 0 && recorte.every((i) => SELECIONADAS.has(String(i.id)));
  const cabeca = (lote ? `<th class="grupo-marcar"><input type="checkbox" ${todasMarcadas ? 'checked' : ''} aria-label="Selecionar ${recorte.length === grupo.itens.length ? 'tudo' : `as ${recorte.length} do filtro`} em ${safeText(grupo.nome)}" title="${todasMarcadas ? 'Desmarcar' : 'Marcar'} ${recorte.length === 1 ? 'a peça' : `as ${recorte.length} peças`}${recorte.length === grupo.itens.length ? ' do grupo' : ' deste filtro'}" onchange="${recorte.length === grupo.itens.length ? `selecionarGrupo('${jsArg(grupo.id)}',this.checked,'${quadro}')` : 'pv2GruposMarcarRecorte(this.checked)'}"></th>` : '')
    + (comId ? th('id', 'ID') : '') + th('nome', 'Conteúdo') + th('cliente', 'Cliente') + (comFormato ? th('formato', 'Formato') : '') + th('status', 'Status') + (cap ? th('captacao', 'Captação') : '') + th('prazo_iso', 'Prazo') + th('veiculacao_iso', 'Veiculação') + th('responsavel', 'Quem')
    + (extras ? th('tipo_conteudo', 'Tipo') + th('off_audio', 'OFF') + th('prioridade', 'Prioridade') + th('cadastrado_por', 'Cadastrou') + th('criado_em', 'Quando') : '');
  const fil = (id, rotulo, n, tom) => `<button type="button" role="radio" aria-checked="${pv2GruposFiltro === id}" onclick="pv2GruposFiltrar('${id}')">${rotulo} <b${tom && n ? ` class="${tom}"` : ''}>${n}</b></button>`;
  const editavel = typeof grupoEditavelNaTela === 'function' && grupoEditavelNaTela(quadro, grupo.id);
  const algumFiltro = Boolean(String(buscaClienteConteudos || '').trim()) || pv2GruposClientes.size > 0 || pv2GruposFormatos.size > 0 || (cap || quadro === 'producao') && pv2GruposCaptacoes.size > 0
    || pv2GruposDataLigada() || (typeof selectedPersonIds !== 'undefined' && selectedPersonIds.size > 0) || (typeof filtroCarteira !== 'undefined' && filtroCarteira !== 'all');
  const corpo = !grupo.itens.length ? `<p class="d3v-estado"><b>Nenhuma peça neste grupo.</b>${algumFiltro ? (String(buscaClienteConteudos || '').trim() ? 'A busca não encontrou nada aqui.' : 'Os filtros não acharam nada aqui.') : 'Use o + para cadastrar a primeira.'}</p>`
    : !recorte.length ? `<p class="d3v-estado"><b>${pv2GruposStatus && doFiltro.length ? `Nenhuma peça em ${safeText(pv2GruposStatus)} neste recorte.` : pv2GruposFiltro === 'semdono' ? 'Todas as peças deste grupo têm responsável.' : 'Nenhuma peça vencida neste grupo.'}</b></p>`
    : `<div class="d3m-a-g-rola"><table class="d3m-a-g-tab grupo-tabela s-f-cols${extras ? ' larga' : ''}${cap ? ' s-f-com-cap' : ''}${comId ? ' s-f-com-id' : ''}"><thead><tr>${cabeca}</tr></thead><tbody>${visiveis.map((i) => pv2GrupoLinha(i, { lote, extras, hoje, cap, comId, comFormato })).join('')}</tbody></table></div>`;
  // A coluna de consulta: os grupos, a busca, o que esta aba é e o trabalho em lote.
  const mesTxt = (() => { try { return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(managerCalendarMonthMeta().first); } catch { return ''; } })();
  const linha = `conteúdos por grupo · ${total} ${pv2Pl(total, 'peça', 'peças')}${mesTxt ? ` em ${mesTxt}` : ''} · ${comPecas.length} ${pv2Pl(comPecas.length, 'grupo com peças', 'grupos com peças')}`;
  const lista = `<div class="d3m-a-grupos" role="radiogroup" aria-label="Grupos">${grupos.map((g) => `<button type="button" class="d3m-vlin d3m-a-grupo${g.id === grupo.id ? ' on' : ''}" role="radio" aria-checked="${g.id === grupo.id}" data-grupo="${safeText(g.id)}" onclick="pv2GruposEscolher('${jsArg(g.id)}')"><span><b>${safeText(g.nome)}</b></span><b class="d3m-vn">${g.itens.length}</b></button>`).join('')}${typeof botaoNovoGrupoNoFim === 'function' ? botaoNovoGrupoNoFim(quadro) : ''}</div>`;
  const xisBusca = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
  const busca = `<label class="d3m-a-busca"><span class="pv2-oculto">Buscar por cliente, conteúdo ou ID</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg><input id="busca-cliente-conteudos" type="search" autocomplete="off" placeholder="Cliente, conteúdo ou ID" value="${safeText(buscaClienteConteudos)}" oninput="buscarClienteConteudos(this.value)">${String(buscaClienteConteudos || '') ? `<button type="button" class="s-f-busca-x" onclick="event.preventDefault();pv2GruposTirarBusca();document.getElementById('busca-cliente-conteudos')?.focus()" aria-label="Limpar a busca" title="Limpar a busca">${xisBusca}</button>` : ''}</label>`;
  const lado = pv2Cons('Grupos', `${total} ${pv2Pl(total, 'peça', 'peças')}`, lista) + pv2Cons('Buscar', '', busca)
    + `<section class="d3m-cons d3m-a-nota-v"><div class="d3m-cons-cab"><b>Esta aba é a tabela crua</b></div><p>Serve para conferir e corrigir em lote. Para trabalhar o dia, a Semana mostra só o que publica.</p></section>`
    + pv2Cons('Em lote', SELECIONADAS.size ? `${SELECIONADAS.size} ${pv2Pl(SELECIONADAS.size, 'marcada', 'marcadas')}` : '', (recorte.length ? pv2Vlin(`<b>${todasMarcadas ? 'Desmarcar' : 'Marcar'} ${recorte.length === 1 ? 'a peça' : `as ${recorte.length}`}</b> · ${recorte.length === grupo.itens.length ? 'do grupo' : 'deste filtro'}`, `pv2GruposMarcarRecorte(${!todasMarcadas})`, 'A barra de baixo muda status, responsável, prazo e veiculação de todas de uma vez') : '')
      + (SELECIONADAS.size ? pv2Vlin(`<b>Limpar a seleção</b> · ${SELECIONADAS.size} ${pv2Pl(SELECIONADAS.size, 'marcada', 'marcadas')}`, 'limparSelecao()', 'Desmarcar todas (Esc)') : '')
      + pv2Vlin('<b>Exportar a tabela</b>', 'pv2GruposExportar()', 'Baixar a lista deste grupo em planilha (CSV)'));
  pv2Vista.grupos = { linha, lado, exporta: { nome: grupo.nome, itens: recorte } };
  const opSt = [...contaSt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  // Os filtros da cabeça (prancha V2-S-Filtros-Demandas): "Status · todos" e "Cliente · todos" abrem o menu; com escolha, o
  // botão fica cheio (tinta) e a escolha aparece num chip que sai no ×, junto da pessoa e da busca.
  // Os números do menu de Cliente também somam os outros filtros (formato, captação e data), menos o próprio cliente.
  const clientesOp = pv2GruposOpcoesDeCliente(pv2GruposAplicarFiltros(base || grupos.flatMap((g) => g.itens), { clientes: new Set(), hoje }));
  const baseOp = base || grupos.flatMap((g) => g.itens);
  pv2Vista.grupos.filtros = { clientes: clientesOp, status: opSt, total: grupo.itens.length, ...pv2GruposOpcoesExtras(baseOp, quadro, hoje) };
  const escolhidos = [...pv2GruposClientes];
  const filtroBt = (qual, rotulo, escolha, vazio = 'todos') => `<button type="button" class="s-f-filtro${escolha ? ' tem' : ''}" data-s-f="${qual}" aria-haspopup="dialog" aria-expanded="${pv2GruposMenuQual === qual}" onclick="pv2GruposAbrirMenu(event,'${qual}')" title="Filtrar por ${rotulo.toLowerCase()}${escolha ? ` (agora: ${safeText(escolha)})` : ''}">${rotulo} · <b>${safeText(escolha || vazio)}</b>${PV2_IC.baixo}</button>`;
  const pessoas = typeof selectedPersonIds === 'undefined' ? [] : [...selectedPersonIds];
  const nomeDe = (id) => { const u = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS).find((x) => String(x.id) === String(id)); return u ? firstName(u.name) : 'uma pessoa'; };
  const formatos = [...pv2GruposFormatos], rotFormato = (v) => v || 'Sem formato';
  const comCaptacao = quadro === 'producao', captacoes = comCaptacao ? [...pv2GruposCaptacoes] : [];
  const dataLigada = pv2GruposDataLigada(), rotData = dataLigada ? pv2GruposRotuloData() : '', campoData = PV2_GRUPOS_CAMPOS_DATA[pv2GruposData.campo] || 'Data';
  const carteira = typeof filtroCarteira === 'undefined' ? 'all' : filtroCarteira;
  const rotCarteira = (typeof CARTEIRAS_DA_AGENDA === 'undefined' ? [] : CARTEIRAS_DA_AGENDA).find((c) => c.id === carteira)?.apelido || carteira;
  // Carteira e Captação, os menos usados, ficam no "+ Filtros": os botões cabem numa linha em 1366.
  const nMais = (carteira !== 'all' ? 1 : 0) + captacoes.length;
  const filtroMais = `<button type="button" class="s-f-filtro s-f-mais${nMais ? ' tem' : ''}" data-s-f="mais" aria-haspopup="dialog" aria-expanded="${pv2GruposMenuQual === 'mais'}" onclick="pv2GruposAbrirMenu(event,'mais')" title="Carteira${comCaptacao ? ' e captação' : ''}${nMais ? ` (${nMais} ${pv2Pl(nMais, 'ligado', 'ligados')})` : ''}">+ Filtros${nMais ? ` · <b>${nMais}</b>` : ''}${PV2_IC.baixo}</button>`;
  const filtroSt = filtroBt('status', 'Status', pv2GruposStatus) + filtroBt('cliente', 'Cliente', escolhidos.length > 1 ? `${escolhidos.length} clientes` : escolhidos[0] || '')
    + filtroBt('pessoa', 'Pessoa', pessoas.length > 1 ? `${pessoas.length} pessoas` : pessoas.length ? nomeDe(pessoas[0]) : '')
    + filtroBt('formato', 'Formato', formatos.length > 1 ? `${formatos.length} formatos` : formatos.length ? rotFormato(formatos[0]) : '')
    + filtroBt('data', dataLigada ? campoData : 'Data', rotData, 'qualquer') + filtroMais;
  const xis = '<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17"/></svg></i>';
  const chip = (rotulo, acao, valor = '') => `<button type="button" class="s-f-chip" data-v="${safeText(valor)}" onclick="${acao}" title="Tirar este filtro" aria-label="Tirar o filtro ${safeText(rotulo)}">${safeText(rotulo)}${xis}</button>`;
  const chips = escolhidos.map((n) => chip(`Cliente: ${n}`, 'pv2GruposTirarCliente(this.dataset.v)', n))
    .concat(pv2GruposStatus ? [chip(`Status: ${pv2GruposStatus}`, "pv2GruposEscolherStatus('')")] : [])
    .concat(pessoas.map((id) => chip(`Pessoa: ${nomeDe(id)}`, 'pv2GruposTirarPessoa(this.dataset.v)', id)))
    .concat(formatos.map((v) => chip(`Formato: ${rotFormato(v)}`, 'pv2GruposTirarFormato(this.dataset.v)', v)))
    .concat(dataLigada ? [chip(`${campoData}: ${rotData}`, 'pv2GruposTirarData()')] : [])
    .concat(carteira !== 'all' ? [chip(`Carteira: ${rotCarteira}`, 'pv2GruposTirarCarteira()')] : [])
    .concat(captacoes.map((v) => chip(`Captação: ${v || 'Sem captação'}`, 'pv2GruposTirarCaptacao(this.dataset.v)', v)))
    .concat(String(buscaClienteConteudos || '').trim() ? [chip(`Busca: ${String(buscaClienteConteudos).trim()}`, 'pv2GruposTirarBusca()')] : []);
  // "N de M": M é o grupo inteiro, sem filtro nenhum.
  const doGrupoTodo = semFiltro ? semFiltro.filter((i) => String(i.group_id || '') === grupo.id).length : grupo.itens.length;
  pv2GruposGuardar();
  // A linha dos filtros fica embaixo da cabeça, como na prancha: os dois botões e, com filtro ligado, quantas sobram e os chips.
  // A faixa antiga da pessoa ("Paulo · 1 pessoa · 77 entregas…") some na V2 de Grupos; os números dela vêm para cá.
  const nums = pessoas.length && typeof opsSelectionNumeros === 'function' ? opsSelectionNumeros() : null;
  const daPessoa = nums ? `<span class="s-f-conta s-f-pessoa" title="Peças abertas com data de quem está escolhido, em toda a carteira">${pessoas.length === 1 ? safeText(nomeDe(pessoas[0])) : `${pessoas.length} pessoas`}: <b>${nums.scope.length}</b> ${pv2Pl(nums.scope.length, 'entrega', 'entregas')} · <b>${nums.risks}</b> ${pv2Pl(nums.risks, 'risco', 'riscos')} · <b>${nums.due}</b> ${pv2Pl(nums.due, 'vence hoje', 'vencem hoje')}</span>` : '';
  const ativos = `<div class="s-f-ativos" role="group" aria-label="Filtros da folha">${filtroSt}${chips.length ? `<span class="s-f-conta"><b>${recorte.length}</b> de ${doGrupoTodo} · filtrando por</span>${chips.join('')}${chips.length > 1 ? '<button type="button" class="s-f-limpar" onclick="pv2GruposLimparTudo()">Limpar tudo</button>' : ''}` : ''}${daPessoa}</div>`;
  return `<section class="d3m-a-folha d3m-a-gr${SELECIONADAS.size ? ' tem-lote' : ''}" data-grupo="${safeText(grupo.id)}" data-quadro="${quadro}" data-previa-sequencia="${safeText(grupo.nome)}" aria-label="Grupo ${safeText(grupo.nome)}">
      <div class="d3m-a-cab"><h3><span${editavel ? ` ondblclick="renomearGrupoPeloNome(event,'${quadro}','${jsArg(grupo.id)}')" title="Clique duplo para renomear"` : ''}>${safeText(grupo.nome)}</span> <span>· ${grupo.itens.length} ${pv2Pl(grupo.itens.length, 'peça', 'peças')}</span></h3>
        <span class="d3m-a-setas">${typeof botaoDoMenuDoGrupo === 'function' ? botaoDoMenuDoGrupo(quadro, grupo.id, grupo.nome) : ''}<button type="button" class="d3v-btn txt ico s grupo-adicionar" onclick="cadastrarNoGrupo('${quadro}','${jsArg(grupo.id)}')" aria-label="Adicionar conteúdo em ${safeText(grupo.nome)}" title="Novo conteúdo neste grupo">${D3P_MAIS}</button></span>
        <span class="d3m-a-seg" role="radiogroup" aria-label="Recorte do grupo">${fil('todos', 'Todos', grupo.itens.length, '')}${fil('semdono', 'Sem responsável', semDono.length, 'a')}${fil('vencidas', 'Vencidas', vencidas.length, 'r')}</span>
        <i class="d3m-a-div" aria-hidden="true"></i>
        <span class="d3m-a-seg"><button type="button" class="s-f-colunas" data-s-f="colunas" aria-haspopup="dialog" aria-expanded="${pv2GruposMenuQual === 'colunas'}" onclick="pv2GruposAbrirMenu(event,'colunas')" title="Escolher as colunas da tabela">Colunas</button><button type="button" role="switch" aria-checked="${ORDEM.campo === 'status'}" onclick="ordenarPor('status')" title="Ordenar a lista pelo status">Por status</button></span></div>
      ${ativos}${corpo}
      <div class="d3m-a-pe"><span>Tabela</span><span><b>${visiveis.length}</b>de ${recorte.length} na lista</span>${restam > 0 ? `<span><button type="button" class="d3v-btn txt s grupo-ver-mais" onclick="verGrupoInteiro('${jsArg(grupo.id)}')">Mostrar ${pv2Pl(restam, 'a outra', `as outras ${restam}`)}</button></span>` : ''}<span>${escondidas.length ? `<b>${escondidas.length}</b>${pv2Pl(escondidas.length, 'coluna escondida', 'colunas escondidas')}: ${escondidas.join(', ')}` : 'todas as colunas à mostra'}</span></div></section>`;
}

// EQUIPE (prancha V2-M-Producao-Equipe): a carga de cada pessoa no mês, em uma linha com a barra por etapa (prontas, em
// produção, esperando captação, a fazer), e as peças por formato em colunas. Clicar na pessoa filtra a Produção por ela.
// Na coluna de consulta: o laranja com o que está sem responsável, o limite da semana de cada um (os mesmos pontos da
// Coordenação) e o atalho para a Coordenação, onde se distribui à mão.
function pv2PodeCoordenar() {
  try {
    if (typeof SESSAO_ATUAL !== 'undefined' && SESSAO_ATUAL?.dono) return true;
    const eu = String((typeof operadorDoTopo === 'function' ? operadorDoTopo()?.id : '') || '');
    return Boolean(eu) && (typeof EQUIPES !== 'undefined' ? EQUIPES.coordenacao || [] : []).map(String).includes(eu);
  } catch { return false; }
}
function pv2AbrirCoordenacao() {
  if (!window.mundoVoxel?.irPara) return;
  window.mundoVoxel.irPara('hoje');
  setTimeout(() => document.querySelector('[data-visao-hoje="coordenacao"]')?.click(), 250);
}
function pv2FiltrarPessoa(id) {
  if (typeof filterByPerson === 'function') filterByPerson(String(id), document.querySelector(`#person-filter-bar .person-wrap[data-person-id="${CSS.escape(String(id))}"]`) || document.getElementById('person-all'));
  mostrarAgendaDaSemana();
}
// A conta do Heitor na semana (VybeCoordenacao.calcular), com o time de criação e os mesmos pontos e tetos da
// Coordenação. Uma só para a Equipe e para a janela Requer ação (rodada S): quem sugere é sempre a mesma conta.
function pv2CoordSemana(reserva = []) {
  const C = typeof window !== 'undefined' ? window.VybeCoordenacao : null, E = typeof EQUIPES !== 'undefined' ? EQUIPES : { design: [], audiovisual: [] }, T = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const ids = [...new Set([...(E.design || []), ...(E.audiovisual || [])].map(String))];
  if (!C?.calcular || !ids.length) return null;
  const av = (id) => (E.audiovisual || []).map(String).includes(id);
  const time = ids.map((id) => ({ id, nome: (T.find((u) => String(u.id) === id) || {}).name || id, papel: '', disciplina: av(id) ? 'audiovisual' : 'design', limiteSemana: typeof daCapacitySignal === 'function' ? daCapacitySignal({ id }, []).threshold : av(id) ? 24 : 14 }));
  const abertas = (typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() : reserva).filter((d) => !isFinishedItem(d) && !(typeof isRequestItem === 'function' && isRequestItem(d)));
  return C.calcular({ itens: abertas, time, hoje: pv2HojeIso(), periodo: 'semana', peso: (d, u) => (typeof daEffortWeight === 'function' ? daEffortWeight(d, u) : 1) });
}
function pv2EquipePintar() {
  const painel = typeof document !== 'undefined' ? document.getElementById('panel-team') : null; if (!painel) return;
  const v2 = pv2Ligado() && panelMode === 'gestor';
  painel.classList.toggle('d3m-a-v2', v2);
  if (!v2) return;
  const folha = (id, rotulo) => { let el = document.getElementById(id); if (!el) { el = document.createElement('section'); el.id = id; el.className = 'd3m-a-folha'; el.setAttribute('aria-label', rotulo); painel.append(el); } return el; };
  const itens = (typeof DADOS !== 'undefined' ? DADOS : []).filter(itemNaCarteira);
  const etapa = (d) => (atividadeDoDiaConcluida(d) ? 'g' : /^aguardo$|capta/i.test(String(d.status || '')) ? 'c' : /^(a fazer|pode fazer|nova demanda)$|falta/i.test(String(d.status || '')) ? 'f' : 'p');
  const vazio = () => ({ total: 0, g: 0, p: 0, c: 0, f: 0 });
  const porPessoa = new Map(), semDono = vazio(), fora = vazio();
  for (const d of itens) {
    const e = etapa(d), donos = ownerUsersFor(d);
    const alvos = donos.length ? donos.map((u) => { const k = String(u.id); if (!porPessoa.has(k)) porPessoa.set(k, { ...vazio(), id: k, nome: firstName(u.name || ''), papel: (typeof DA_CONTROLLER_ROLES !== 'undefined' && DA_CONTROLLER_ROLES[u.id]) || '' }); return porPessoa.get(k); }) : [pv2SemDono(d) ? semDono : fora];
    for (const a of alvos) { a.total += 1; a[e] += 1; }
  }
  const pessoas = [...porPessoa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  const comDono = itens.length - semDono.total;
  const barra = (x) => `<span class="d3m-a-eq-b" role="img" aria-label="${x.g} prontas, ${x.p} em produção, ${x.c} esperando captação e ${x.f} a fazer">${[['g', x.g], ['p', x.p], ['c', x.c], ['f', x.f]].filter(([, n]) => n).map(([k, n]) => `<i class="${k}" style="flex-grow:${n}"></i>`).join('')}</span>`;
  const linha = (x, { av, nome, papel, acao, dica, tom = '' }) => `<button type="button" class="d3m-a-eq-lin" onclick="${acao}" title="${safeText(dica)}">${av}<span class="d3m-a-eq-nome"><b>${safeText(nome)}</b>${papel ? ` · ${safeText(papel)}` : ''}</span>${barra(x)}<span class="d3m-a-eq-pr">${x.g} ${pv2Pl(x.g, 'pronta', 'prontas')}</span><b class="d3m-a-eq-n${tom}">${x.total}</b></button>`;
  const linhas = pessoas.map((x) => linha(x, { av: `<i class="d3m-a-eq-av" aria-hidden="true">${safeText(pv2Iniciais(x.nome))}</i>`, nome: x.nome, papel: x.papel, acao: `pv2FiltrarPessoa('${jsArg(x.id)}')`, dica: `Ver a semana só com as peças de ${x.nome}` }))
    .concat(fora.total ? [linha(fora, { av: '<i class="d3m-a-eq-av" aria-hidden="true">…</i>', nome: 'Outras pessoas', papel: 'fora do time do painel', acao: 'mostrarAgendaDaSemana()', dica: 'Peças com responsável que não está no time do painel' })] : [])
    .concat(semDono.total ? [linha(semDono, { av: '<i class="d3m-a-eq-av sd" aria-hidden="true">+</i>', nome: 'Sem responsável', papel: 'ninguém pegou ainda', acao: 'pv2AlternarSemDono()', dica: 'Ver na semana só as peças sem responsável', tom: ' r' })] : []);
  const carga = folha('pv2-eq-carga', 'Carga por pessoa');
  pv2Trocar(carga, `<div class="d3m-a-cab"><h3 class="d3m-a-so"><span>Carga por pessoa</span> <span>· ${comDono} ${pv2Pl(comDono, 'peça', 'peças')} com dono</span></h3>
      <span class="d3m-a-eq-leg" aria-hidden="true"><span><i class="g"></i>prontas</span><span><i class="p"></i>em produção</span><span><i class="c"></i>esperando captação</span><span><i class="f"></i>a fazer</span></span></div>
    <div class="d3m-a-eq-lista">${linhas.join('') || '<p class="d3v-estado"><b>Nenhuma peça no mês.</b>Quando houver, a carga de cada pessoa aparece aqui.</p>'}</div>`);
  // Por formato: colunas da mais cheia para a menos.
  const porFmt = new Map();
  for (const d of itens) { const f = String(d.formato || '').trim() || 'Sem formato'; porFmt.set(f, (porFmt.get(f) || 0) + 1); }
  const fmts = [...porFmt.entries()].sort((a, b) => b[1] - a[1]), maiorFmt = Math.max(1, ...fmts.map((x) => x[1]));
  pv2Trocar(folha('pv2-eq-formato', 'Por formato'), `<div class="d3m-a-cab"><h3 class="d3m-a-so"><span>Por formato</span> <span>· ${itens.length} ${pv2Pl(itens.length, 'peça', 'peças')} no mês</span></h3><span class="d3v-rot">quantidade e parte do total</span></div>
    ${fmts.length ? `<div class="d3m-a-eq-cols" role="list">${fmts.map(([f, n]) => `<div class="d3m-a-eq-col" role="listitem" aria-label="${safeText(f)}: ${n} ${pv2Pl(n, 'peça', 'peças')}, ${Math.round(n * 100 / itens.length)}% do total"><b>${n}</b><i style="--k:${Math.round(n * 100 / maiorFmt) / 100}"></i><span><span>${safeText(f)}</span><small>${Math.round(n * 100 / itens.length)}%</small></span></div>`).join('')}</div>` : '<p class="d3v-estado"><b>Nenhuma peça no mês.</b></p>'}`);
  // A coluna de consulta.
  const mesTxt = (() => { try { return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(managerCalendarMonthMeta().first); } catch { return ''; } })();
  const coord = pv2PodeCoordenar();
  const laranja = semDono.total
    ? pv2Laranja({ quem: 'Heitor · sem dono', numero: semDono.total, titulo: `${pv2Pl(semDono.total, 'peça do mês sem responsável', 'peças do mês sem responsável')}`, apoio: `${semDono.f ? `${pv2Pl(semDono.f, 'É 1 a fazer', `São ${semDono.f} a fazer`)}. ` : ''}Distribuir agora alivia as próximas semanas.`,
      botoes: (coord ? '<button type="button" class="d3m-btn l" onclick="pv2AbrirCoordenacao()">Distribuir</button>' : '') + `<button type="button" class="d3m-btn l${coord ? ' s' : ''}" onclick="pv2AlternarSemDono()">${semDono.total === 1 ? 'Ver a sem dono' : `Ver as ${semDono.total}`}</button>` })
    : pv2Laranja({ quem: 'Heitor · a carga do mês', numero: itens.length ? comDono : '', titulo: itens.length ? `${pv2Pl(comDono, 'peça com responsável', 'peças com responsável')}${mesTxt ? ` em ${mesTxt}` : ''}` : 'Nenhuma peça no mês', apoio: itens.length ? 'Nenhuma peça sem responsável.' : '',
      botoes: coord ? '<button type="button" class="d3m-btn l" onclick="pv2AbrirCoordenacao()">Abrir a Coordenação</button>' : '' });
  // O limite da semana de cada pessoa da criação: os mesmos pontos e o mesmo teto da Coordenação.
  let limites = '';
  try {
    const r = pv2CoordSemana(itens);
    if (r) {
      const n0 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
      limites = pv2Cons('Limite de cada um', 'pontos da semana / limite', (r.pessoas || []).slice().sort((a, b) => b.pct - a.pct).map((p) => `<button type="button" class="d3m-vlin" onclick="pv2FiltrarPessoa('${jsArg(p.id)}')" title="${safeText(firstName(p.nome))}: ${n0(p.pontos)} de ${p.limite} pontos na semana (${p.pct}%)"><i class="d3m-pes" aria-hidden="true">${safeText(pv2Iniciais(p.nome))}</i><span class="d3m-vnome">${safeText(firstName(p.nome))}</span><span class="d3m-vbarra${p.pct > 100 ? ' r' : p.pct >= 80 ? ' a' : ''}" style="--v:${Math.min(100, p.pct)}%"><i></i></span><span class="d3m-vn"><b>${n0(p.pontos)}</b> / ${p.limite}</span></button>`).join('') || '<p class="d3m-vvazio">Sem time de criação cadastrado.</p>');
    }
  } catch { limites = ''; }
  const abrir = pv2Cons('Abrir', '', (coord ? pv2Vlin('<b>Coordenação</b> · distribuir à mão, por pessoa', 'pv2AbrirCoordenacao()', 'Abrir a Coordenação no Hoje') : '')
    + pv2Vlin('<b>Carga da semana</b> · quem tem pendência', "mostrarAgendaDaSemana();document.getElementById('ops-carga-btn')?.click()", 'Abrir a carga da equipe na semana'));
  pv2Vista.equipe = { linha: `carga da equipe${mesTxt ? ` em ${mesTxt}` : ''} · ${itens.length} ${pv2Pl(itens.length, 'peça', 'peças')}${semDono.total ? ` · ${semDono.total} ainda sem responsável` : ''}`, lado: laranja + limites + abrir };
  if (document.body.dataset.pv2Vista === 'equipe') pv2PintarVista('equipe');
}

// ----- a semana em colunas de dia, com o cartão que abre no lugar -----
const PV2_POR_DIA = 7, PV2_JANELA = 4;
const pv2CartoesAbertos = new Set();
function pv2DiasEl(sem) {
  const grid = document.getElementById(`grid-s${sem}`); if (!grid) return null;
  let el = document.getElementById(`pv2-dias-s${sem}`);
  if (!el) { el = document.createElement('div'); el.id = `pv2-dias-s${sem}`; el.className = 'pv2 pv2-dias'; grid.after(el); }
  const titulo = grid.previousElementSibling?.classList.contains('section-title') ? grid.previousElementSibling : null;
  titulo?.classList.add('pv2-fora');
  return el;
}
// Por cliente: a grade de sempre volta e as colunas de dia saem.
function pv2SairDosDias(sem) {
  if (!pv2Ligado()) return;
  const el = pv2DiasEl(sem); if (!el) return;
  el.hidden = true; el.innerHTML = '';
  document.getElementById(`grid-s${sem}`)?.classList.remove('pv2-fora');
}
function pv2AlternarCartao(id, el) {
  const cartao = el.closest('.pv2-pc'); if (!cartao) return;
  const abrir = cartao.getAttribute('aria-expanded') !== 'true';
  if (abrir) pv2CartoesAbertos.add(String(id)); else pv2CartoesAbertos.delete(String(id));
  cartao.setAttribute('aria-expanded', String(abrir));
  el.setAttribute('aria-expanded', String(abrir));
}
function pv2MostrarDia(sem, iso) {
  if (diasExpandidos.has(iso)) diasExpandidos.delete(iso); else diasExpandidos.add(iso);
  renderByDay(sem, currentFilter, currentDayFilter);
}
// O quando da linha: a peça aberta de um dia que já passou diz há quanto tempo venceu (vermelho); a de hoje ou adiante
// mostra o prazo interno quando ele é outro dia que não o da coluna. Pronta não mostra nada.
function d3pQuando(d, data) {
  if (atividadeDoDiaConcluida(d)) return { texto: '', tom: '' };
  const hoje = (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  const dias = (iso) => Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(iso + 'T12:00:00Z')) / 864e5);
  if (data && data < hoje) { const n = dias(data); return { texto: `${data === d.prazo_iso && data !== d.veiculacao_iso ? 'prazo' : 'veic.'} ${pv2DiaMes(data)}`, dica: n === 1 ? 'venceu ontem' : `venceu há ${n} dias`, tom: 'r' }; }
  if (d.prazo_iso && d.prazo_iso !== data) return { texto: `prazo ${pv2DiaMes(d.prazo_iso)}`, tom: d.prazo_iso < hoje ? 'r' : d.prazo_iso === hoje ? 'a' : '' };
  return { texto: '', tom: '' };
}
// Hora de publicação da peça (14/11/2026): o Monday não tem o campo, então ela fica do nosso lado
// (vybe_peca_complemento, GET/POST /api/painel?area=peca_complemento) e é opcional. Lida uma vez; sem a rota, nada aparece.
let pv2Horas = null, pv2HorasLendo = null;
const PV2_ITEM_HORA = /^(vybe:)?[0-9]{1,20}$/;
function pv2CarregarHoras() {
  if (pv2Horas || pv2HorasLendo || typeof fetch !== 'function') return;
  pv2HorasLendo = fetch('/api/painel?area=peca_complemento', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).then((j) => { pv2Horas = j?.horas || {}; pv2PintarHoras(); })
    .catch(() => { pv2Horas = {}; }).finally(() => { pv2HorasLendo = null; });
}
function pv2PintarHoras() {
  if (typeof document === 'undefined') return;
  for (const el of document.querySelectorAll('[data-hora-de]')) { const h = pv2Horas?.[el.dataset.horaDe] || ''; el.textContent = h ? pv2HoraCurta(h) : ''; el.hidden = !h; }
  for (const el of document.querySelectorAll('input[data-hora-campo]')) if (document.activeElement !== el) el.value = pv2Horas?.[el.dataset.horaCampo] || '';
}
const pv2HoraCurta = (h) => (/^\d{2}:00$/.test(h) ? `${Number(h.slice(0, 2))}h` : h.replace(':', 'h'));
async function pv2SalvarHora(item, campo) {
  if (!PV2_ITEM_HORA.test(String(item))) return;
  const hora = String(campo?.value || '');
  try {
    const r = await fetch('/api/painel?area=peca_complemento', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, publicar_hora: hora || null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Não foi possível gravar a hora.');
    pv2Horas = { ...(pv2Horas || {}) }; if (hora) pv2Horas[item] = hora; else delete pv2Horas[item];
    pv2PintarHoras();
    if (typeof showToast === 'function') showToast(hora ? `Publica às ${pv2HoraCurta(hora)}.` : 'Hora de publicação tirada.');
  } catch (e) { if (typeof showToast === 'function') showToast(e.message); }
}
function pv2CartaoHtml(d, aba) {
  const id = safeText(d.id), aberto = pv2CartoesAbertos.has(String(d.id));
  const comHora = !isRequestItem(d) && PV2_ITEM_HORA.test(String(d.id)), hora = comHora ? pv2Horas?.[String(d.id)] || '' : '';
  if (comHora) pv2CarregarHoras();
  const marcada = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.has(String(d.id));
  const clientes = clientesDoItem(d), data = dataDoCartaoDia(d), titulo = pv2Titulo(d);
  const feita = atividadeDoDiaConcluida(d);
  const previa = typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(d) : '';
  const datas = [d.prazo_iso ? `prazo ${pv2DiaMes(d.prazo_iso)}` : '', d.veiculacao_iso ? `veic. ${pv2DiaMes(d.veiculacao_iso)}` : !isRequestItem(d) ? '' : d.conclusao_iso ? `conclusão ${pv2DiaMes(d.conclusao_iso)}` : ''].filter(Boolean).join(' · ');
  // Direção 3: a linha do dia é "• Cliente · peça", e embaixo a pílula do status (o menu de sempre) e o quando, em
  // vermelho só no que já venceu. O dono fica na bolinha da direita.
  const q = d3pQuando(d, data);
  return `<article class="pv2-pc v2-abre${marcada ? ' marcada' : ''}${feita ? ' feita' : ''}${pv2Chegou(d)}" data-cartao="${id}" aria-expanded="${aberto}" draggable="true"
      ondragstart="managerCalendarDragStart('${isRequestItem(d) ? 'request' : 'content'}','${id}',event)" ondragend="managerCalendarDragEnd()">
    <div class="pv2-pc-lin" role="button" tabindex="0" aria-expanded="${aberto}" title="Abrir no lugar. Arraste para mudar a data"
        onclick="pv2AlternarCartao('${id}',this)" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();pv2AlternarCartao('${id}',this)}">
      <span class="d3m-hora">${comHora ? `<span class="d3p-hora" data-hora-de="${id}"${hora ? '' : ' hidden'} title="Hora de publicação">${safeText(hora ? pv2HoraCurta(hora) : '')}</span>` : ''}</span>${pv2Foto(clientes[0])}
      <p class="pv2-t">${pv2Cli(clientes[0]) || '<span class="pv2-sub">Sem cliente</span>'}${clientes.length > 1 ? `<span class="pv2-sub" title="${safeText(clientes.join(', '))}"> +${clientes.length - 1}</span>` : ''}<span class="d3p-peca"><i class="d3m-a-sep"> · </i>${safeText(titulo)}</span></p>
      ${(() => { const et = pv2Etapas(d), vez = et.find((e) => e.daVez); return `<span class="d3m-trilha" title="${vez ? 'Etapa: ' + vez.nome : 'Publicada'}" aria-hidden="true">${et.map((e) => `<i class="${e.feita ? 'ok' : e.daVez ? 'vez' : ''}"></i>`).join('')}</span>`; })()}
      <div class="pv2-r">${pv2StatusBotao(d)}${q.texto ? `<span class="d3p-quando ${q.tom}"${q.dica ? ` title="${safeText(q.dica)}"` : ''}>${safeText(q.texto)}</span>` : ''}</div>
      <span class="pv2-avs">${pv2Av(d)}</span>
    </div>
    <div class="v2-mais"><div><div class="pv2-det">${pv2EtapasHtml(d)}
      ${datas || aba === 'pendencias' ? `<p class="pv2-sub">${aba === 'pendencias' ? (data ? `Entrega ${pv2DiaMes(data)}` : 'Sem data') + (datas ? ' · ' : '') : ''}${datas}</p>` : ''}${capRotuloHtml(d)}
      ${comHora ? `<label class="d3p-hora-campo" onclick="event.stopPropagation()">Publica às <input type="time" step="900" value="${safeText(hora)}" data-hora-campo="${id}" aria-label="Hora de publicação (opcional)" onchange="pv2SalvarHora('${id}',this)"></label>` : ''}
      <div class="pv2-det-acoes"><button type="button" class="pv2-btn s k" onclick="openItemWorkspace('${id}')">Abrir a peça</button>${previa}
        <label class="pv2-lote" title="Marcar para ação em lote"><input type="checkbox" ${marcada ? 'checked' : ''} data-day-item="${id}" aria-label="Marcar ${safeText(d.nome || '')}" onclick="alternarSelecao('${id}',this.checked,event,ORDEM_VISIVEL_DO_DIA)">Marcar</label></div>
    </div></div></div>
  </article>`;
}
// "Por dia" em fases (Paulo, 16/11: "ordena sempre por lógica do que tá mais sem fazer"): Precisa fazer, Sendo feito,
// Para agendar e Finalizado, nessa ordem, cada uma com o seu rótulo. A fase sai das etapas da peça (pv2Etapas, a mesma
// leitura do status da trilha da linha e de Minhas tarefas), sem outro mapa: briefing e texto/arte por começar = precisa
// fazer; produção, alteração e aprovação = sendo feito; aprovada, para agendar e agendado = para agendar; Finalizado é a
// regra de pronta de sempre (atividadeDoDiaConcluida). Dentro da fase, o prazo vencido mais antigo primeiro, depois a
// hora de publicar, a ordem do grupoDoDiaPorStatus (Para agendar antes de Agendado) e o cliente.
const PV2_FASES = [['fazer', 'Precisa fazer'], ['feito', 'Sendo feito'], ['agendar', 'Para agendar'], ['fim', 'Finalizado']];
function pv2FaseDaPeca(d) {
  if (atividadeDoDiaConcluida(d)) return 3;
  const vez = pv2Etapas(d).findIndex((e) => e.daVez);
  return vez < 0 ? 2 : vez <= 1 ? 0 : vez <= 3 ? 1 : 2;
}
function pv2OrdenarPorFase(lista, hoje) {
  const vencido = (d) => (d.prazo_iso && d.prazo_iso < hoje && !atividadeDoDiaConcluida(d) ? d.prazo_iso : '9999-12-31');
  const hora = (d) => (typeof pv2Horas !== 'undefined' && pv2Horas?.[String(d.id)]) || '99:99';
  return lista.map((d) => [pv2FaseDaPeca(d), d]).sort(([fa, a], [fb, b]) => fa - fb || vencido(a).localeCompare(vencido(b)) || String(hora(a)).localeCompare(String(hora(b))) || grupoDoDiaPorStatus(a.status) - grupoDoDiaPorStatus(b.status)
    || String(clientesDoItem(a)[0] || '').localeCompare(String(clientesDoItem(b)[0] || ''), 'pt-BR')).map(([, d]) => d);
}
// As linhas com o rótulo da fase na frente da primeira de cada uma; a contagem é a do dia inteiro, não só do que está à vista.
function pv2LinhasPorFase(aVista, todas, aba) {
  const conta = [0, 0, 0, 0]; todas.forEach((d) => { conta[pv2FaseDaPeca(d)] += 1; });
  let atual = -1;
  return aVista.map((d) => {
    const f = pv2FaseDaPeca(d), [cls, nome] = PV2_FASES[f];
    const rotulo = f === atual ? '' : `<div class="d3p-fase ${cls}" data-fase="${cls}" role="heading" aria-level="4"><span>${nome}</span><b>${conta[f]}</b></div>`;
    atual = f;
    return rotulo + pv2CartaoHtml(d, aba);
  }).join('');
}
function pv2RenderDias(sem, filter, dayFilter) {
  pv2Montar();
  const alvo = pv2DiasEl(sem), grid = document.getElementById(`grid-s${sem}`);
  if (!alvo || !grid) return;
  const items = itensDaSemanaGestor(sem);
  let fi = filtrarItensDoDia(items, filter);
  if (pv2SoSemDono) fi = fi.filter((d) => !atividadeDoDiaConcluida(d) && pv2SemDono(d));
  const diasBase = getDiasSemana(sem), labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dias = (dateMode === 'prazo'
    ? [...new Set([...diasBase.map((d) => d.iso), ...items.map(dataDoCartaoDia).filter(Boolean)])].sort().map((iso) => ({ iso, label: labels[new Date(iso + 'T12:00:00').getDay()] }))
    : diasBase).filter((d) => !dayFilter || d.iso === dayFilter);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  // Direção V2: "Por dia" abre em um dia só, o escolhido na régua (hoje, se for desta semana), com a lista inteira.
  const umDia = DIAS_EM_COLUNAS && !dayFilter && dias.length > 1;
  if (umDia) { const alvoDia = dias.some((d) => d.iso === pv2Dia) ? pv2Dia : dias.some((d) => d.iso === hoje) ? hoje : dias[0].iso; dias.splice(0, dias.length, ...dias.filter((d) => d.iso === alvoDia)); }
  const gestor = panelMode === 'gestor', ordemVisivel = [];
  const naSemana = { social: new Set(), demandas: new Set(), pendencias: new Set() };
  // Quatro colunas à vista, a partir de hoje (ou do começo, na semana que não é a atual).
  const iHoje = dias.findIndex((d) => d.iso === hoje), inicio = iHoje < 0 ? 0 : Math.min(iHoje, Math.max(0, dias.length - PV2_JANELA));
  const fora = [];
  const estado = typeof unifiedDemandasState === 'undefined' ? 'ready' : unifiedDemandasState;
  const aviso = estado === 'error' ? 'Não foi possível atualizar as solicitações. Os dados exibidos podem estar desatualizados.' : estado !== 'ready' ? 'Carregando solicitações…' : '';
  const colunas = dias.map((dia, i) => {
    const dayItems = fi.filter((d) => dataDoCartaoDia(d) === dia.iso).sort((a, b) => String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR'));
    const pendencias = gestor ? pendenciasSolicitacoesDoDia(dia.iso, filter) : [];
    const salva = abasPendenciasDia.get(dia.iso);
    const aba = gestor ? (salva === true ? 'pendencias' : salva === false ? 'social' : !salva ? abaDaSemana : salva) : 'social';
    const { redes, demandas, lista, abertas, concluidas } = listasDoCartaoDia(dayItems, pendencias, aba);
    redes.forEach((x) => naSemana.social.add(String(x.id))); demandas.forEach((x) => naSemana.demandas.add(String(x.id))); pendencias.forEach((x) => naSemana.pendencias.add(String(x.id)));
    const inteiro = umDia || diasExpandidos.has(dia.iso), emFases = pv2OrdenarPorFase(abertas, hoje);
    const aVista = inteiro ? [...emFases, ...concluidas] : emFases.slice(0, PV2_POR_DIA);
    aVista.forEach((x) => ordemVisivel.push(String(x.id)));
    const resto = abertas.length - Math.min(abertas.length, PV2_POR_DIA), pct = lista.length ? Math.round(concluidas.length * 100 / lista.length) : 0;
    const naJanela = i >= inicio && i < inicio + PV2_JANELA;
    if (!naJanela) fora.push(`${dia.label.toLowerCase()} ${Number(dia.iso.slice(8, 10))}`);
    const nome = dia.iso === hoje ? `Hoje · ${dia.label.toLowerCase()} ${Number(dia.iso.slice(8, 10))}` : `${dia.label} ${Number(dia.iso.slice(8, 10))}`;
    const dataCurta = dia.iso.slice(8, 10) + '/' + dia.iso.slice(5, 7);
    const vazio = aba === 'social' ? 'Nada marcado neste dia.' : aba === 'demandas' ? 'Nenhuma entrega neste dia.' : 'Nada atrasado ou sem data.';
    // Direção 3: o pé do dia é um botão só, "+4 · 4 prontas", que abre o dia inteiro no lugar (e recolhe de novo).
    const pe = umDia ? '' : inteiro ? `<button type="button" class="d3p-mais" onclick="pv2MostrarDia(${sem},'${dia.iso}')" aria-label="Recolher ${dataCurta}">Recolher</button>`
      : resto > 0 || concluidas.length ? `<button type="button" class="d3p-mais" onclick="pv2MostrarDia(${sem},'${dia.iso}')" aria-label="Mostrar tudo de ${dataCurta}" title="${resto > 0 ? `${resto} a mais` : ''}${resto > 0 && concluidas.length ? ' e ' : ''}${concluidas.length ? `${concluidas.length} ${concluidas.length === 1 ? 'pronta recolhida' : 'prontas recolhidas'}` : ''}">${resto > 0 ? `+${resto}` : 'Ver'}${concluidas.length ? `<span> · ${concluidas.length} ${concluidas.length === 1 ? 'pronta' : 'prontas'}</span>` : ''}</button>` : '';
    return `<section class="pv2-col${dia.iso === hoje ? ' hoje' : ''}"${naJanela ? ' data-janela' : ''} data-date="${dia.iso}" data-previa-sequencia="${dia.label} · ${dataCurta}" aria-label="${dia.label} ${dataCurta}"
        ondragover="soltarNoDiaSobre(event,this)" ondragleave="soltarNoDiaSai(this)" ondrop="soltarNoDia('${dia.iso}',event,this)">
      ${umDia ? '<div class="d3m-colunas" aria-hidden="true"><span>Publica</span><span></span><span>Cliente e peça</span><span>Briefing até publicar</span><span>Status</span><span></span></div>' : ''}<div class="pv2-cab"><details class="pv2-menu pv2-dia-menu"><summary title="Adicionar atividade ou gerar o resumo de ${dataCurta}"><b>${nome}</b></summary>
          <div class="pv2-pop" onclick="if(event.target.closest('button'))this.closest('details').open=false">${gestor ? `<button type="button" onclick="adicionarDemandaNoDia('${dia.iso}','${aba}')">Adicionar atividade</button>` : ''}<button type="button" onclick="openDailySummary('${dia.iso}')">Gerar resumo</button></div></details>
        <span class="pv2-sub">${concluidas.length} de ${lista.length}</span>${dia.iso === hoje && lista.length ? `<span class="d3-barra" role="progressbar" aria-label="Progresso de ${dataCurta}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="--v:${pct}%"><i></i></span>` : ''}</div>
      ${aba !== 'social' && aviso ? `<p class="pv2-sub" role="status">${aviso} <button type="button" class="pv2-link" onclick="ensureDemandasForOperationalViews(true)">Atualizar</button></p>` : ''}
      <div class="d3p-linhas">${pv2LinhasPorFase(aVista, [...abertas, ...concluidas], aba)}
      ${!abertas.length && !inteiro ? `<p class="pv2-sub pv2-nada">${lista.length ? 'Tudo concluído.' : vazio}</p>` : ''}</div>
      ${pe}
    </section>`;
  }).join('');
  const emColunas = DIAS_EM_COLUNAS;
  grid.innerHTML = ''; grid.classList.remove('dias-colunas', 'dias-encaixados'); grid.classList.add('pv2-fora');
  alvo.hidden = false;
  alvo.classList.toggle('grade', !emColunas);
  alvo.classList.toggle('d3m-um-dia', umDia);
  alvo.innerHTML = colunas + (emColunas && !umDia && fora.length ? `<p class="pv2-sub pv2-fora-janela">${fora.length === 1 ? `${fora[0]} fica` : `${fora.slice(0, -1).join(', ')} e ${fora[fora.length - 1]} ficam`} fora desta vista · <button type="button" class="pv2-link" onclick="pv2Modo('grade')">mostrar a semana inteira</button></p>` : '');
  pv2Totais[sem] = { social: naSemana.social.size, demandas: naSemana.demandas.size, pendencias: naSemana.pendencias.size };
  ORDEM_VISIVEL_DO_DIA = ordemVisivel;
  pintarSeletorDeSemana();
}
try { pv2Montar(); } catch { /* a tela antiga segue valendo */ }

// ----- o status mora na linha, com a setinha (quadro Status, passos 1 e 3) -----
// A pílula do status é o botão que abre o menu curto (openStatusEditor, em vybe-status.js). Enquanto grava, gira no
// lugar (v2-estado "indo"); quando a lista volta desenhada com o status novo, a pílula aparece verde com o visto e a
// linha chega deslizando (v2-chegou), e depois de um instante a pílula assenta na cor do status. O aviso "Movida para"
// com Desfazer é do commitStatusChange. Vale para qualquer lista que desenhe a pílula por aqui.
const pv2StatusVisto = new Map(), pv2StatusMudou = new Map();
const PV2_ST_CHEGADA = 1600;
let pv2AssentarRelogio = 0;
function pv2StatusChegouAgora(d) {
  const id = String(d?.id ?? ''), st = String(d?.status || '');
  if (!id) return false;
  const antes = pv2StatusVisto.get(id);
  pv2StatusVisto.set(id, st);
  if (antes !== undefined && antes !== st) pv2StatusMudou.set(id, Date.now());
  const em = pv2StatusMudou.get(id);
  if (em && Date.now() - em < PV2_ST_CHEGADA) return true;
  if (em) pv2StatusMudou.delete(id);
  return false;
}
function pv2Chegou(d) { return pv2StatusChegouAgora(d) ? ' v2-chegou' : ''; }
function pv2AgendarAssentar() {
  if (typeof document === 'undefined') return;
  clearTimeout(pv2AssentarRelogio);
  pv2AssentarRelogio = setTimeout(() => document.querySelectorAll('.pv2-st[data-estado="feito"]').forEach((b) => { b.removeAttribute('data-estado'); b.querySelector('.pv2-st-ok')?.remove(); }), 1400);
}
function pv2StatusBotao(d) {
  const id = safeText(d?.id ?? ''), rotulo = String(d?.status || 'Sem status'), chegou = pv2StatusChegouAgora(d);
  if (chegou) pv2AgendarAssentar();
  const dica = `Trocar status de ${safeText(d?.nome || 'atividade')}`;
  const corSt = d?.status_color || (typeof corDeStatus === 'function' ? corDeStatus(rotulo)?.cor : '') || '';
  return `<button type="button" class="pv2-st ${pv2Tom(rotulo)}${chegou ? ' v2-estado' : ''}"${corSt ? ` style="--st:${safeText(corSt)}"` : ''} data-v2-st="${id}"${chegou ? ' data-estado="feito"' : ''} aria-haspopup="menu" aria-expanded="false" title="${dica}" aria-label="${safeText(rotulo)}. ${dica}" onclick="event.stopPropagation();openStatusEditor(event,'${id}')">${chegou ? `<i class="pv2-st-ok" aria-hidden="true">${PV2_IC.ok}</i>` : ''}<span class="pv2-st-rot">${safeText(rotulo)}</span><i class="pv2-st-seta" aria-hidden="true">${PV2_IC.baixo}</i></button>`;
}
// Escolheu no menu: a pílula daquela peça gira até a lista voltar desenhada. Se abriu um portão (a caixa de contexto)
// ou a gravação terminou sem redesenhar (recusada, ou o mesmo status), ela volta a ser a pílula de antes.
function pv2StatusIndo(ev) {
  const op = ev.target?.closest?.('#status-editor button.status-editor-option');
  if (!op || op.hasAttribute('data-status-todos') || op.hasAttribute('data-captacao')) return;
  const id = typeof statusEditorItemId === 'undefined' ? '' : String(statusEditorItemId || '');
  if (!id) return;
  const pilulas = [...document.querySelectorAll('.pv2-st[data-v2-st]')].filter((b) => b.dataset.v2St === id);
  if (!pilulas.length) return;
  pilulas.forEach((b) => { b.classList.add('v2-estado'); b.dataset.estado = 'indo'; b.setAttribute('aria-busy', 'true'); });
  const inicio = Date.now();
  const solta = () => pilulas.forEach((b) => { if (b.dataset.estado === 'indo') { b.removeAttribute('data-estado'); b.removeAttribute('aria-busy'); } });
  const olha = () => {
    if (!pilulas.some((b) => b.isConnected)) return;
    const gravando = typeof statusEmGravacao !== 'undefined' && statusEmGravacao.has(id);
    if (document.getElementById('workflow-modal') || (!gravando && Date.now() - inicio > 300) || Date.now() - inicio > 20000) { solta(); return; }
    setTimeout(olha, 150);
  };
  setTimeout(olha, 150);
}
// A pílula que abriu o menu fica marcada (aria-expanded, a setinha vira para cima) enquanto o menu está na tela.
function pv2StatusAberto(ev) {
  const pilula = ev.target?.closest?.('.pv2-st[data-v2-st]');
  if (!pilula) return;
  setTimeout(() => {
    if (!document.getElementById('status-editor')) return;
    pilula.setAttribute('aria-expanded', 'true');
    const olha = () => { if (document.getElementById('status-editor') && pilula.isConnected) setTimeout(olha, 200); else pilula.setAttribute('aria-expanded', 'false'); };
    setTimeout(olha, 200);
  }, 0);
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', pv2StatusIndo, true);
  document.addEventListener('click', pv2StatusAberto, true);
}
