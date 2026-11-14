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
  return `<button type="button" class="vybe-link${icone ? ' so-icone' : ''}" onclick="event.stopPropagation();copiarLinkDaAtividade('${safeText(item.id)}',this)"
    title="Copiar o link desta atividade para mandar no grupo"${icone ? ' aria-label="Copiar link"' : ''}>${ICONE_LINHA.link}<span${icone ? ' class="sr-only"' : ''}>Copiar link</span></button>`;
}

function vybeChipId(item) {
  if (!item?.id) return '';
  return `<button type="button" class="vybe-id" onclick="event.stopPropagation();copiarId('${safeText(item.id)}')"
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
    onclick="openStatusEditor(event,'${safeText(item.id)}')"
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
  return `<button type="button" class="vybe-nome" onclick="openItemWorkspace('${safeText(item.id)}')"
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
  if (pv2Ligado()) return `<span class="pill vv-st-ponto ${pv2Tom(s)}"${cor ? ` style="--st:${safeText(cor)}"` : ''}><i aria-hidden="true"></i>${s}</span>`;
  const bordaFinal = border || doCatalogo?.borda || '';
  return `<span class="pill pill-${statusCls(s)}"${statusInlineStyle(cor, bordaFinal)}><span class="pill-dot"${statusDotInlineStyle(cor)}></span>${s}</span>`;
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
  return `<span class="fmt fmt-${fmtCls(f)}"${statusInlineStyle(c?.cor || '', c?.borda || '')}>${f}</span>`;
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
      ${d.captacao ? pillHtml(d.captacao) : ''}
      ${managerStatusControl(d)}
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
        ondragstart="managerCalendarDragStart('${isRequestItem(d)?'request':'content'}','${safeText(d.id)}',event)" ondragend="managerCalendarDragEnd()" title="Arraste para mudar a data">
        <label class="dia-marcar" onclick="event.stopPropagation()" title="Marcar para ação em lote"><input type="checkbox" ${marcada?'checked':''} data-day-item="${safeText(d.id)}" aria-label="Marcar ${safeText(d.nome||'')}"
          onclick="event.stopPropagation();alternarSelecao('${safeText(d.id)}',this.checked,event,ORDEM_VISIVEL_DO_DIA)"></label>
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
      <div><small>Semana fechada</small><span><b>${pct}%</b> ${done} de ${total} ${total === 1 ? 'conteúdo' : 'conteúdos'}</span></div>`) +
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
function abrirDoResumo(nome) {
  const p = PAINEIS_DA_BARRA[nome];
  if (!p) return;
  if (!p.aberto()) alternarPainelDaBarra(nome);
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
function renderOpsSelectionSummary(){
  const el=document.getElementById('ops-selection-summary'); if(!el) return;
  const users=TEAM_USERS.filter(user=>selectedPersonIds.has(String(user.id)));
  if(!users.length){ el.classList.remove('open'); el.innerHTML=''; return; }
  const scope=opsSelectedScope().filter(opsOpenItem);
  const risks=scope.filter(d=>ACTION_STATUSES.includes(d.status)||['critical','high','attention'].includes(d.operational_risk?.level)).length;
  const today=opsTodayIso(); const due=scope.filter(d=>getDateIso(d)===today).length;
  const names=users.map(user=>safeText(firstName(user.name))).join(' + ');
  el.innerHTML=`<span class="ops-selection-dot"></span><b>${names}</b><span>· ${users.length} pessoa${users.length===1?'':'s'} · ${scope.length} entregas · ${risks} riscos · ${due} vencem hoje</span>`;
  el.classList.add('open');
}
function opsTodayItems(){
  const today=opsTodayIso();
  return opsSelectedScope().filter(d=>opsOpenItem(d) && getDateIso(d)<=today).sort((a,b)=>{ const ad=getDateIso(a),bd=getDateIso(b); return ad.localeCompare(bd)||Number(a.operational_risk?.score??99)-Number(b.operational_risk?.score??99)||a.nome.localeCompare(b.nome); });
}
function toggleTodayQueue(){ alternarPainelDaBarra('hoje'); }
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
  acao: {
    grupo: 'consulta', botao: 'ops-action-btn',
    aberto: () => document.getElementById('ops-action-panel')?.classList.contains('open') || false,
    definir: (v) => document.getElementById('ops-action-panel')?.classList.toggle('open', v),
  },
  hoje: {
    grupo: 'consulta', botao: 'ops-today-btn',
    aberto: () => showTodayQueue,
    definir: (v) => { showTodayQueue = v; document.getElementById('ops-today-panel')?.classList.toggle('open', v); },
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
      onclick="acaoAbrirPeca('${safeText(String(d.id))}',event)" title="Abrir ${safeText(d.nome || 'a atividade')}">
      <label class="acao-marcar" onclick="event.stopPropagation()"><input type="checkbox" ${marcada ? 'checked' : ''}
        data-id="${safeText(String(d.id))}" onclick="filaMarcar(this,event)" aria-label="Marcar ${safeText(d.nome || 'atividade')}"></label>
      ${marca}
      <span class="acao-copy"><b>${safeText(d.nome || 'Sem título')}</b><small>${safeText(apoio)}</small></span>
      <span class="acao-status" onclick="event.stopPropagation()">${vybeStatus(d)}</span>
      <span class="acao-data">${safeText(planningDateBr(getDateIso(d)).slice(0, 5) || '—')}<small>${dateMode === 'prazo' ? 'Prazo' : 'Veiculação'}</small></span>
      <button type="button" class="acao-abrir" onclick="event.stopPropagation();openItemWorkspace('${safeText(String(d.id))}')">Contexto</button>
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
}

function toggleAllActionItems() {
  showAllActionItems = !showAllActionItems;
  renderActionQueue();
}

// ─── Meu Dia / Inteligência de gestão ─────────────────────────────────────────
let focusShowAll = false;
function isFinishedItem(d) { return ['Finalizado','Feito','Concluído','Concluido'].includes(operationalFlowStatus(d)); }
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
function pv2SemDono(item) { return !ownerUsersFor(item).length && !String(item?.responsavel || '').replace('—', '').trim(); }
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
  const n = fim ? 5 : /agend|aprovad|pronta/.test(st) ? 4 : /aprova/.test(st) ? 3 : /andamento|execu|produ|altera|ajuste|corre|edi/.test(st) ? 2 : d?.tem_briefing === false || /briefing|info|nova/.test(st) ? 0 : 1;
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
  raiz.innerHTML = `<div class="pv2-topo"><h2>Painel de trabalho</h2><span class="d3p-data" id="pv2-data">${safeText(d3pDataDeHoje())}</span>
      <span class="pv2-seg" id="pv2-vistas" role="radiogroup" aria-label="Vista">
        <button type="button" role="radio" data-vista="semana" onclick="mostrarAgendaDaSemana()" title="Agenda da equipe, dia a dia">Semana</button>
        <button type="button" role="radio" data-vista="mes" onclick="toggleAgendaMensal()" title="Calendário do mês por cliente">Mês</button>
        <button type="button" role="radio" data-vista="grupos" onclick="toggleVisaoDeGrupos()" title="Conteúdos divididos pelos grupos do quadro">Grupos</button>
        <button type="button" role="radio" data-vista="equipe" onclick="mostrarEquipeDaSemana(document.getElementById('ops-equipe-btn'))" title="Carga de cada pessoa e distribuição por formato na semana">Equipe</button>
      </span>
      <details class="pv2-menu" id="pv2-modos"><summary class="pv2-btn" title="Fechamento do dia, mesa de comando, modo reunião e carga da equipe">Modos</summary>
        <div class="pv2-pop" role="group" aria-label="Modos" onclick="if(event.target.closest('button'))this.closest('details').open=false">
          <button type="button" data-modo-v2="fechamento" onclick="toggleDailyClose()">Fechamento do dia</button>
          <button type="button" data-modo-v2="comando" onclick="toggleManagerCommandDrawer()">Mesa de comando <b id="pv2-comando-n"></b></button>
          <button type="button" onclick="openMeetingMode()">Modo Reunião</button>
          <button type="button" onclick="document.getElementById('ops-carga-btn')?.click()">Carga da equipe</button>
        </div></details>
      <button type="button" class="pv2-btn d3p-novo" onclick="typeof openCadastrosGoverned==='function'?openCadastrosGoverned({board:'producao'}):openCadastrosStation()">${D3P_MAIS}Novo conteúdo</button></div>
    <div class="pv2-alto" id="pv2-alto"></div>
    <div class="pv2-filtros" role="group" aria-label="Busca e filtros">
      <label class="pv2-oculto" for="pv2-busca">Buscar peça ou cliente</label>
      <input id="pv2-busca" class="pv2-busca" type="search" autocomplete="off" placeholder="Buscar peça ou cliente" oninput="const t=this.value;this.value='';handleGlobalSearch(t)">
      <span class="pv2-fichas" id="pv2-chips"></span>
      <details class="pv2-menu" id="pv2-filtros-menu"><summary class="pv2-btn s" id="pv2-filtros-rot">Filtros</summary>
        <div class="pv2-pop pv2-pop-filtros" id="pv2-filtros-pop"><span class="pv2-pop-rot">Mês de referência</span></div></details>
    </div>`;
  cab.before(raiz);
  const semana = document.createElement('div');
  semana.id = 'pv2-semana'; semana.className = 'pv2 pv2-semana';
  semana.innerHTML = `<button type="button" class="pv2-btn s ic" data-passo="-1" onclick="passarSemana(-1)" aria-label="Semana anterior">${PV2_IC.antes}</button>
    <h3 id="pv2-semana-rot" aria-live="polite">Semana</h3>
    <button type="button" class="pv2-btn s ic" data-passo="1" onclick="passarSemana(1)" aria-label="Próxima semana">${PV2_IC.depois}</button>
    <button type="button" class="pv2-btn s" id="pv2-semana-hoje" onclick="semanaDeHoje()">Hoje</button>
    <span class="pv2-abas" id="pv2-abas" role="radiogroup" aria-label="Mostrar em todos os dias"></span>
    <span class="pv2-seg" id="pv2-modo" role="radiogroup" aria-label="Como ver a semana">
      <button type="button" role="radio" data-modo-semana="dia" onclick="pv2Modo('dia')">Por dia</button>
      <button type="button" role="radio" data-modo-semana="cliente" onclick="pv2Modo('cliente')">Por cliente</button>
      <button type="button" role="radio" data-modo-semana="grade" onclick="pv2Modo('grade')">Grade</button>
    </span>`;
  nav.before(semana);
  const reserva = document.createElement('div');
  reserva.id = 'pv2-reserva'; reserva.hidden = true;
  casa.append(reserva);
  // Filtros guarda o que saiu da barra: mês, Pessoa, Status, Veiculação ou Prazo, Mais filtros, Arquivo e limpar.
  const pop = raiz.querySelector('#pv2-filtros-pop');
  const mes = document.getElementById('month-nav'), filtros = document.getElementById('agenda-filtros');
  const arquivo = document.getElementById('ops-arquivo-btn'), limpar = document.getElementById('ops-clear-btn');
  if (mes) pop.append(mes);
  if (filtros) { const rot = document.createElement('span'); rot.className = 'pv2-pop-rot'; rot.textContent = 'Recorte'; pop.append(rot, filtros); }
  const pe = document.createElement('div'); pe.className = 'pv2-pop-pe';
  if (arquivo) pe.append(arquivo);
  if (limpar) pe.append(limpar);
  pop.append(pe);
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
  pv2Trocar(document.getElementById('pv2-alto'), d3pAcao({ agente: 'H', quem: 'Heitor · Coordenação', frase, botao, attrs: `onclick="${acao}"` })
    + `<div class="d3p-nums">${kpi('Publica hoje', n.hoje, { serie: porDia(() => true), serieRotulo: 'Publicações por dia da semana', acao: n.hoje ? "abrirDoResumo('hoje')" : '',
      sub: !n.hoje ? 'nada hoje' : n.hojePendente === n.hoje ? 'nenhuma pronta' : n.hojePendente > 0 ? `${n.hojePendente} sem estar pronto` : 'tudo pronto', subTom: n.hojePendente > 0 ? 'r' : '' })}
    ${kpi('Pendentes', n.pendentes, { linhaTom: 'a', serie: porDia((d) => ['A Fazer', 'Falta D.A'].includes(d.status)), serieRotulo: 'Pendentes por dia da semana', acao: n.pendentes ? "abrirDoResumo('acao')" : '', sub: 'a fazer ou falta D.A.' })}
    ${kpi('Semana fechada', n.feitas, { de: n.total, barra: n.pct, dica: `${n.pct}% da semana em Finalizado` })}</div>`);
  pv2Totais.poucosPosts = n.poucosPosts;
  pv2PintarControles();
}
function pv2PintarControles() {
  const raiz = pv2Montar(); if (!raiz) return;
  const P = PAINEIS_DA_BARRA;
  const vista = P.calendario.aberto() ? 'mes' : P.grupos.aberto() ? 'grupos' : equipeNaTela() ? 'equipe' : 'semana';
  raiz.querySelectorAll('#pv2-vistas [data-vista]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.vista === vista)));
  const conta = (id) => Number(document.getElementById(id)?.textContent) || 0;
  const semDono = typeof DADOS !== 'undefined' && DADOS.length ? itensDaSemanaGestor(currentWeek).filter(itemNaCarteira).filter((d) => !atividadeDoDiaConcluida(d) && pv2SemDono(d)).length : 0;
  const ficha = (rotulo, n, ligada, acao, dica) => `<button type="button" class="pv2-chip" aria-pressed="${Boolean(ligada)}" onclick="${acao}" title="${dica}">${rotulo} <b>${n}</b></button>`;
  pv2Trocar(document.getElementById('pv2-chips'), ficha('Requer ação', conta('ops-action-count'), P.acao.aberto(), 'toggleActionQueue()', 'A fila do que pede ação, com o motivo')
    + ficha('Vence hoje', conta('ops-today-count'), P.hoje.aberto(), 'toggleTodayQueue()', 'O que vence hoje')
    + ficha('Sem dono', semDono, pv2SoSemDono, 'pv2AlternarSemDono()', 'Só as peças abertas da semana sem responsável')
    + ficha('Menos de 3 posts', pv2Totais.poucosPosts || 0, typeof sortCritico !== 'undefined' && sortCritico, 'pv2PoucosPosts()', 'Clientes com menos de 3 posts em alguma semana, primeiro'));
  pv2PintarFiltroAtivo();
  const comando = document.getElementById('pv2-comando-n'), nComando = document.getElementById('manager-command-count')?.textContent || '';
  if (comando && comando.textContent !== nComando) comando.textContent = nComando;
  raiz.querySelector('[data-modo-v2="fechamento"]')?.setAttribute('aria-pressed', String(P.fechamento.aberto()));
  raiz.querySelector('[data-modo-v2="comando"]')?.setAttribute('aria-pressed', String(P.comando.aberto()));
  document.getElementById('pv2-semana')?.toggleAttribute('hidden', vista === 'equipe');
}
// "Filtros" acende quando há recorte ligado lá dentro (ou o Arquivo aberto).
function pv2PintarFiltroAtivo() {
  const limpar = document.getElementById('ops-clear-btn');
  document.getElementById('pv2-filtros-rot')?.classList.toggle('tem', Boolean(limpar && !limpar.classList.contains('is-idle')) || Boolean(document.getElementById('arquivadas-painel')));
}
function pv2PintarSemana() {
  if (!pv2Montar()) return;
  const dias = getDiasSemana(currentWeek), rot = document.getElementById('pv2-semana-rot');
  if (rot && dias.length) {
    const a = dias[0].iso, b = dias[dias.length - 1].iso, mes = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const texto = a.slice(0, 7) === b.slice(0, 7) ? `${a.slice(8, 10)} a ${b.slice(8, 10)} de ${mes(b)}` : `${a.slice(8, 10)} de ${mes(a)} a ${b.slice(8, 10)} de ${mes(b)}`;
    if (rot.textContent !== texto) rot.textContent = texto;
  }
  const lista = pilulasDeSemana(), atual = document.getElementById(`tab-s${currentWeek}-label`), i = lista.indexOf(atual);
  const semana = document.getElementById('pv2-semana');
  semana?.querySelector('[data-passo="-1"]')?.toggleAttribute('disabled', i <= 0);
  semana?.querySelector('[data-passo="1"]')?.toggleAttribute('disabled', i < 0 || i >= lista.length - 1);
  document.getElementById('pv2-semana-hoje')?.toggleAttribute('data-atual', Boolean(atual?.classList.contains('e-hoje')));
  const modo = viewMode === 'client' ? 'cliente' : DIAS_EM_COLUNAS ? 'dia' : 'grade';
  semana?.querySelectorAll('[data-modo-semana]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.modoSemana === modo)));
  const t = pv2Totais[currentWeek];
  pv2Trocar(document.getElementById('pv2-abas'), modo === 'cliente' || !t || panelMode !== 'gestor' ? '' : [['social', 'Redes'], ['demandas', 'Demandas'], ['pendencias', 'Pendências']]
    .map(([id, nome]) => `<button type="button" role="radio" aria-checked="${abaDaSemana === id}" onclick="escolherAbaDaSemana(${currentWeek},'${id}')">${nome} ${t[id]}</button>`).join('<i aria-hidden="true">·</i>'));
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
  if (data && data < hoje) { const n = dias(data); return { texto: n === 1 ? 'ontem' : `há ${n} dias`, tom: 'r' }; }
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
  const datas = [d.prazo_iso ? `prazo ${pv2DiaMes(d.prazo_iso)}` : '', d.veiculacao_iso ? `no ar ${pv2DiaMes(d.veiculacao_iso)}` : !isRequestItem(d) ? '' : d.conclusao_iso ? `conclusão ${pv2DiaMes(d.conclusao_iso)}` : ''].filter(Boolean).join(' · ');
  // Direção 3: a linha do dia é "• Cliente · peça", e embaixo a pílula do status (o menu de sempre) e o quando, em
  // vermelho só no que já venceu. O dono fica na bolinha da direita.
  const q = d3pQuando(d, data);
  return `<article class="pv2-pc v2-abre${marcada ? ' marcada' : ''}${feita ? ' feita' : ''}${pv2Chegou(d)}" data-cartao="${id}" aria-expanded="${aberto}" draggable="true"
      ondragstart="managerCalendarDragStart('${isRequestItem(d) ? 'request' : 'content'}','${id}',event)" ondragend="managerCalendarDragEnd()">
    <div class="pv2-pc-lin" role="button" tabindex="0" aria-expanded="${aberto}" title="Abrir no lugar. Arraste para mudar a data"
        onclick="pv2AlternarCartao('${id}',this)" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();pv2AlternarCartao('${id}',this)}">
      <p class="pv2-t">${pv2Cli(clientes[0]) || '<span class="pv2-sub">Sem cliente</span>'}${clientes.length > 1 ? `<span class="pv2-sub" title="${safeText(clientes.join(', '))}"> +${clientes.length - 1}</span>` : ''}<span class="d3p-peca"> · ${safeText(titulo)}</span></p>
      <div class="pv2-r">${pv2StatusBotao(d)}${q.texto ? `<span class="d3p-quando ${q.tom}">${safeText(q.texto)}</span>` : ''}${comHora ? `<span class="d3p-hora" data-hora-de="${id}"${hora ? '' : ' hidden'} title="Hora de publicação">${safeText(hora ? pv2HoraCurta(hora) : '')}</span>` : ''}</div>
      <span class="pv2-avs">${pv2Av(d)}</span>
    </div>
    <div class="v2-mais"><div><div class="pv2-det">${pv2EtapasHtml(d)}
      ${datas || aba === 'pendencias' ? `<p class="pv2-sub">${aba === 'pendencias' ? (data ? `Entrega ${pv2DiaMes(data)}` : 'Sem data') + (datas ? ' · ' : '') : ''}${datas}</p>` : ''}
      ${comHora ? `<label class="d3p-hora-campo" onclick="event.stopPropagation()">Publica às <input type="time" step="900" value="${safeText(hora)}" data-hora-campo="${id}" aria-label="Hora de publicação (opcional)" onchange="pv2SalvarHora('${id}',this)"></label>` : ''}
      <div class="pv2-det-acoes"><button type="button" class="pv2-btn s k" onclick="openItemWorkspace('${id}')">Abrir a peça</button>${previa}
        <label class="pv2-lote" title="Marcar para ação em lote"><input type="checkbox" ${marcada ? 'checked' : ''} data-day-item="${id}" aria-label="Marcar ${safeText(d.nome || '')}" onclick="alternarSelecao('${id}',this.checked,event,ORDEM_VISIVEL_DO_DIA)">Marcar</label></div>
    </div></div></div>
  </article>`;
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
    const inteiro = diasExpandidos.has(dia.iso);
    const aVista = inteiro ? [...abertas, ...concluidas] : abertas.slice(0, PV2_POR_DIA);
    aVista.forEach((x) => ordemVisivel.push(String(x.id)));
    const resto = abertas.length - Math.min(abertas.length, PV2_POR_DIA), pct = lista.length ? Math.round(concluidas.length * 100 / lista.length) : 0;
    const naJanela = i >= inicio && i < inicio + PV2_JANELA;
    if (!naJanela) fora.push(`${dia.label.toLowerCase()} ${Number(dia.iso.slice(8, 10))}`);
    const nome = dia.iso === hoje ? `Hoje · ${dia.label.toLowerCase()} ${Number(dia.iso.slice(8, 10))}` : `${dia.label} ${Number(dia.iso.slice(8, 10))}`;
    const dataCurta = dia.iso.slice(8, 10) + '/' + dia.iso.slice(5, 7);
    const vazio = aba === 'social' ? 'Nada marcado neste dia.' : aba === 'demandas' ? 'Nenhuma entrega neste dia.' : 'Nada atrasado ou sem data.';
    // Direção 3: o pé do dia é um botão só, "+4 · 4 prontas", que abre o dia inteiro no lugar (e recolhe de novo).
    const pe = inteiro ? `<button type="button" class="d3p-mais" onclick="pv2MostrarDia(${sem},'${dia.iso}')" aria-label="Recolher ${dataCurta}">Recolher</button>`
      : resto > 0 || concluidas.length ? `<button type="button" class="d3p-mais" onclick="pv2MostrarDia(${sem},'${dia.iso}')" aria-label="Mostrar tudo de ${dataCurta}" title="${resto > 0 ? `${resto} a mais` : ''}${resto > 0 && concluidas.length ? ' e ' : ''}${concluidas.length ? `${concluidas.length} ${concluidas.length === 1 ? 'pronta recolhida' : 'prontas recolhidas'}` : ''}">${resto > 0 ? `+${resto}` : 'Ver'}${concluidas.length ? `<span> · ${concluidas.length} ${concluidas.length === 1 ? 'pronta' : 'prontas'}</span>` : ''}</button>` : '';
    return `<section class="pv2-col${dia.iso === hoje ? ' hoje' : ''}"${naJanela ? ' data-janela' : ''} data-date="${dia.iso}" data-previa-sequencia="${dia.label} · ${dataCurta}" aria-label="${dia.label} ${dataCurta}"
        ondragover="soltarNoDiaSobre(event,this)" ondragleave="soltarNoDiaSai(this)" ondrop="soltarNoDia('${dia.iso}',event,this)">
      <div class="pv2-cab"><details class="pv2-menu pv2-dia-menu"><summary title="Adicionar atividade ou gerar o resumo de ${dataCurta}"><b>${nome}</b></summary>
          <div class="pv2-pop" onclick="if(event.target.closest('button'))this.closest('details').open=false">${gestor ? `<button type="button" onclick="adicionarDemandaNoDia('${dia.iso}','${aba}')">Adicionar atividade</button>` : ''}<button type="button" onclick="openDailySummary('${dia.iso}')">Gerar resumo</button></div></details>
        <span class="pv2-sub">${concluidas.length} de ${lista.length}</span>${dia.iso === hoje && lista.length ? `<span class="d3-barra" role="progressbar" aria-label="Progresso de ${dataCurta}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="--v:${pct}%"><i></i></span>` : ''}</div>
      ${aba !== 'social' && aviso ? `<p class="pv2-sub" role="status">${aviso} <button type="button" class="pv2-link" onclick="ensureDemandasForOperationalViews(true)">Atualizar</button></p>` : ''}
      <div class="d3p-linhas">${aVista.map((d) => pv2CartaoHtml(d, aba)).join('')}
      ${!abertas.length && !inteiro ? `<p class="pv2-sub pv2-nada">${lista.length ? 'Tudo concluído.' : vazio}</p>` : ''}</div>
      ${pe}
    </section>`;
  }).join('');
  const emColunas = DIAS_EM_COLUNAS;
  grid.innerHTML = ''; grid.classList.remove('dias-colunas', 'dias-encaixados'); grid.classList.add('pv2-fora');
  alvo.hidden = false;
  alvo.classList.toggle('grade', !emColunas);
  alvo.innerHTML = colunas + (emColunas && fora.length ? `<p class="pv2-sub pv2-fora-janela">${fora.length === 1 ? `${fora[0]} fica` : `${fora.slice(0, -1).join(', ')} e ${fora[fora.length - 1]} ficam`} fora desta vista · <button type="button" class="pv2-link" onclick="pv2Modo('grade')">mostrar a semana inteira</button></p>` : '');
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
  if (!op || op.hasAttribute('data-status-todos')) return;
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
