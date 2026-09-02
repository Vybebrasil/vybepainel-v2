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
  return ` style="background:rgba(${rgb.r},${rgb.g},${rgb.b},.15);color:${hex};border-color:${borderHex};"`;
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

function vybeChipId(item) {
  if (!item?.id) return '';
  return `<button type="button" class="vybe-id" onclick="event.stopPropagation();copiarId('${safeText(item.id)}')"
    title="ID da atividade · clique para copiar">#${safeText(item.id)}</button>`;
}

function vybeTagCliente(item) {
  const nome = item?.cliente;
  if (!nome || nome === '—') return '';
  return `<span class="vybe-cliente" title="${safeText(nome)}">${safeText(nome)}</span>`;
}

// Status sempre clicável: era pílula morta na fila de demandas e no modo
// reunião, e trocar exigia abrir a peça.
function vybeStatus(item) {
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

function vybeDono(item, className = '') {
  return ownerEditorTrigger(item, className);
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
  const bordaFinal = border || doCatalogo?.borda || '';
  return `<span class="pill pill-${statusCls(s)}"${statusInlineStyle(cor, bordaFinal)}><span class="pill-dot"${statusDotInlineStyle(cor)}></span>${s}</span>`;
}
function managerStatusControl(item) {
    const label = `Alterar status de ${safeText(item.nome || 'atividade')} no Vybe OS`;
    const pill = `<button type="button" class="manager-status-control" onclick="openStatusEditor(event,'${item.id}')" title="${label}" aria-label="${label}">${pillHtml(item.status, item.status_color, item.status_border)}</button>`;
    
    if (!item.status_updated_at || ['Finalizado', 'Agendado', 'Para agendar'].includes(item.status)) {
        return pill;
    }
    
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
  if (user && user.photo) return `<img class="item-resp-photo" src="${user.photo}" title="${first}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ${user.color};" onerror="this.outerHTML='<span class=item-resp-badge style=background:${user.color} title=${first}>${first.slice(0,2).toUpperCase()}</span>'"/>`;
  const color = user ? user.color : '#6b7280';
  return `<span class="item-resp-badge" style="background:${color}" title="${first}">${first.slice(0,2).toUpperCase()}</span>`;
}
function ownerAssignedIds(item={}) { const listed=Array.isArray(item.responsavel_ids)?item.responsavel_ids:[]; return [...new Set([...listed,item.responsavel_id].filter(Boolean).map(String))]; }
function ownerUsersFor(item={}) { const ids=ownerAssignedIds(item); const users=(typeof TEAM_USERS==='undefined'?[]:TEAM_USERS).filter(user=>ids.includes(String(user.id))); if(users.length) return users; const names=String(item.responsavel||'').split(',').map(name=>name.trim().toLowerCase()).filter(Boolean); return (typeof TEAM_USERS==='undefined'?[]:TEAM_USERS).filter(user=>names.some(name=>name.startsWith(user.name.toLowerCase()) || user.name.toLowerCase().startsWith(name))); }
function ownerFormatKind(item={}) { const format=String(item.formato||item.tipo||item.formato_conteudo||'').toLowerCase(); const title=String(item.nome||'').toLowerCase(); const signal=`${format} ${title}`; if(/motion/.test(signal)) return 'motion'; if(/reels|vídeo|video/.test(signal)) return 'audiovisual'; if(/card|carrossel|feed|story|fotografia/.test(signal)) return 'design'; return ''; }
function ownerEligibility(item={}) { const status=String(item.status||'').trim().toLowerCase(); const kind=ownerFormatKind(item); const lookup=(ids=[])=>TEAM_USERS.filter(user=>ids.includes(String(user.id))); if(['para agendar','agendado'].includes(status)) return {kind:'publicacao',label:'Publicação / Agendamento',users:lookup(EQUIPES.publicacao),rule:'Nesta etapa, Tainara, Paulo ou Vinícius podem assumir a responsabilidade operacional de publicação e agendamento.'}; if(['para aprovação','ag. aprovação cliente','ag. interno'].includes(status)) { if(kind==='audiovisual') return {kind:'aprovacao audiovisual',label:'Aprovação audiovisual',users:lookup(EQUIPES.aprovacaoAudiovisual),rule:'Conteúdo audiovisual segue para a fila de aprovação de Paulo, Vinícius ou Ewerton.'}; if(kind==='design') return {kind:'direcao de arte',label:'Direção de Arte',users:lookup([PESSOAS.DEIVID]),rule:'Peças de Design em aprovação ficam sob a direção de arte de Deivid.'}; }
  if(kind==='motion') return {kind,label:'Motion · coparticipação obrigatória',users:lookup(EQUIPES.motion),rule:'Motion exige Reriston no audiovisual e mantém Deivid e Bia na direção e no Design & Edição.'}; if(kind==='audiovisual') return {kind,label:'Audiovisual',users:lookup(EQUIPES.audiovisual),rule:'Reels e Vídeos permanecem com Reriston na disciplina Audiovisual.'}; if(kind==='design') return {kind,label:'Design',users:lookup(EQUIPES.design),rule:'Cards, Carrosséis, Feed, Story e Fotografia permanecem com Deivid, Beatriz e Jady na disciplina Design.'}; return {kind:'indefinido',label:'Classificação pendente',users:[],rule:'Defina o formato da atividade antes de atribuir responsáveis.'}; }
function ownerAvatarHtml(user) { const name=safeText(firstName(user?.name||'Sem responsável')); const initial=safeText(name.slice(0,2).toUpperCase()); return user?.photo?`<img src="${user.photo}" alt="${name}" style="border-color:${user.color||'#6b7280'}" onerror="this.outerHTML='<span class=owner-avatar-fallback style=background:${user.color||'#6b7280'}>${initial}</span>'">`:`<span class="owner-avatar-fallback" style="background:${user?.color||'#6b7280'}">${initial}</span>`; }
function ownerEditorTrigger(item, className='') { const owners=ownerUsersFor(item); const title=owners.length?`Gerenciar responsáveis: ${owners.map(user=>user.name).join(', ')}`:'Adicionar responsável'; const visual=owners.length?owners.slice(0,3).map(ownerAvatarHtml).join('')+(owners.length>3?`<span class="owner-avatar-fallback" style="background:#465363">+${owners.length-3}</span>`:''):`<span class="owner-avatar-add">+</span>`; return `<button type="button" class="owner-editor-trigger ${className}" onclick="openOwnerEditor(event,'${item.id}')" title="${safeText(title)}" aria-label="${safeText(title)}"><span class="owner-avatar-stack">${visual}</span></button>`; }
let pendingOwnerEditorItemId='';
// A disciplina diz quem normalmente assume; não é uma tranca. Quem manda no
// painel precisa poder colocar alguém de fora — botar Paulo numa peça de Design,
// por exemplo — sem sair do painel para fazer isso no Monday. Então a regra vira
// o padrão visível, e o time todo fica a um clique, marcado como fora dela.
let donoSelecionados = new Set();
let donoMostraTimeTodo = false;

function pessoasDoSeletorDeDono(item, rule) {
  const todos = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS);
  const daRegra = rule.users;
  const jaNoItem = ownerUsersFor(item);
  const base = [...new Map([...daRegra, ...jaNoItem].map((u) => [String(u.id), u])).values()];
  if (!donoMostraTimeTodo) return base;
  const dentro = new Set(base.map((u) => String(u.id)));
  return [...base, ...todos.filter((u) => !dentro.has(String(u.id)))];
}

function listaDoSeletorDeDono(item, rule) {
  const pessoas = pessoasDoSeletorDeDono(item, rule);
  if (!pessoas.length) return '<div class="dono-vazio">Ninguém elegível até o formato ser classificado.</div>';
  const elegiveis = new Set(rule.users.map((u) => String(u.id)));
  return pessoas.map((u) => {
    const marcado = donoSelecionados.has(String(u.id));
    const daRegra = elegiveis.has(String(u.id));
    return `<button type="button" class="dono-pessoa owner-editor-person ${marcado ? 'selected' : ''} ${daRegra ? '' : 'fora'}"
      data-owner-id="${u.id}" onclick="toggleOwnerEditorPerson('${u.id}')">
      ${ownerAvatarHtml(u)}<span class="dono-nome"><b>${safeText(firstName(u.name))}</b>
      <small>${safeText(daRegra ? (rule.label || '') : 'fora da disciplina')}</small></span>
      <span class="owner-editor-person-check">${marcado ? '✓' : ''}</span></button>`;
  }).join('');
}

function redesenharListaDeDonos() {
  const item = findOperationalItem(pendingOwnerEditorItemId);
  const lista = document.getElementById('owner-editor-options');
  if (!item || !lista) return;
  lista.innerHTML = listaDoSeletorDeDono(item, ownerEligibility(item));
  const link = document.getElementById('dono-ver-todos');
  if (link) link.textContent = donoMostraTimeTodo ? 'Só a disciplina' : 'Ver o time todo';
}

function alternarTimeTodoNoDono() {
  donoMostraTimeTodo = !donoMostraTimeTodo;
  redesenharListaDeDonos();
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
  // A LISTA ABRE COM O TIME INTEIRO.
  //
  // Ela comecava recortada pela disciplina do formato, e havia um "Ver o time
  // todo" para sair do recorte. Mas quem abre o seletor ja sabe quem quer pôr
  // ali — o recorte so acrescentava um clique antes de toda escolha fora do
  // comum, que e justamente quando a pessoa esta com pressa.
  //
  // A disciplina NAO SUMIU: continua escrita no topo do seletor e ao lado de
  // cada nome, e escolher fora dela continua indo para o historico da peca. A
  // diferenca e que ela informa em vez de impedir.
  donoMostraTimeTodo = true;

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
    <div id="owner-editor-options" class="dono-lista">${listaDoSeletorDeDono(item, rule)}</div>
    <button type="button" id="dono-ver-todos" class="dono-ver-todos"
      onclick="alternarTimeTodoNoDono()">${donoMostraTimeTodo ? 'Só a disciplina' : 'Ver o time todo'}</button>
    <label class="dono-sem"><input id="owner-editor-empty" type="checkbox"> Pode ficar sem responsável</label>
    <div class="dono-rodape">
      <button type="button" id="owner-editor-save" class="dono-salvar" onclick="saveOwnerAssignments()">Salvar</button>
    </div>`;
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
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
async function gravarResponsaveisDaPeca(item, ids) {
  const selected = ids.map(String);
  const rule = ownerEligibility(item);
  const allowed = new Set((rule?.users || []).map((u) => String(u.id)));
  const foraDaRegra = TEAM_USERS.filter((u) => selected.includes(String(u.id)) && !allowed.has(String(u.id)))
    .map((u) => firstName(u.name));
  const before = ownerUsersFor(item).map((u) => u.name).join(', ') || 'Sem responsável';
  const after = TEAM_USERS.filter((u) => selected.includes(String(u.id))).map((u) => u.name).join(', ') || 'Sem responsável';

  const pelaEscritaDupla = await tentarEscritaDupla(item, { acao: 'responsaveis', item: String(item.id), pessoas: selected });
  if (!pelaEscritaDupla) {
    const mutation = `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
    const values = { person: { personsAndTeams: selected.map((id) => ({ id: Number(id), kind: 'person' })) } };
    await mondayQuery(mutation, { board: String(item.board_id || (isRequestItem(item) ? BOARD_DEMANDAS_ID : BOARD_ID)),
      item: String(item.id), values: JSON.stringify(values) });
  }
  try {
    await postItemUpdate(item.id, `[Vybe OS · Responsáveis atualizados]\nAnterior: ${before}\nNovo: ${after}\nDisciplina: ${rule?.label || '—'}${foraDaRegra.length ? `\nFora da disciplina: ${foraDaRegra.join(', ')}` : ''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`);
  } catch (erro) { console.warn('Responsáveis atualizados, mas o log não foi registrado.', erro); }
  updateLocalOwners(item.id, selected);
  return { antes: before, depois: after };
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
async function saveOwnerAssignments() { const item=findOperationalItem(pendingOwnerEditorItemId); if(!item) return showToast('Demanda não encontrada.','err');
  const emLote = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.size >= 2
    && SELECIONADAS.has(String(item.id));
  if (emLote) return salvarResponsaveisDaSelecao(item); const rule=ownerEligibility(item); const selected=[...donoSelecionados]; const allowed=new Set(rule.users.map(user=>String(user.id))); const foraDaRegra=TEAM_USERS.filter(user=>selected.includes(String(user.id)) && !allowed.has(String(user.id))).map(user=>firstName(user.name)); if(!selected.length && !document.getElementById('owner-editor-empty')?.checked) return showToast('Escolha um responsável ou confirme que a atividade ficará sem responsável.','info'); const before=ownerUsersFor(item).map(user=>user.name).join(', ') || 'Sem responsável'; const after=TEAM_USERS.filter(user=>selected.includes(String(user.id))).map(user=>user.name).join(', ') || 'Sem responsável'; const button=document.getElementById('owner-editor-save'); if(button) button.disabled=true; armOutboundMutationGuard('responsáveis'); try { const pelaEscritaDupla=await tentarEscritaDupla(item,{acao:'responsaveis',item:String(item.id),pessoas:selected}); if(!pelaEscritaDupla){ const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`; const values={person:{personsAndTeams:selected.map(id=>({id:Number(id),kind:'person'}))}}; await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify(values)}); } try { await postItemUpdate(item.id,`[Vybe OS · Responsáveis atualizados]\nAnterior: ${before}\nNovo: ${after}\nDisciplina: ${rule.label}${foraDaRegra.length?`\nFora da disciplina: ${foraDaRegra.join(', ')}`:''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); } catch(logError) { console.warn('Responsáveis atualizados, mas o log não foi registrado.',logError); } updateLocalOwners(item.id,selected); if(isRequestItem(item)){ outboundMutationGuardUntil=0; renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{responsavel_ids:selected,responsavel_id:selected[0]||''},'responsáveis'); closeOwnerEditor(); if(String(activeWorkspaceItemId)===String(item.id)) { const current=findOperationalItem(item.id)||item; renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),current); } showToast(foraDaRegra.length?`✓ Responsáveis atualizados · ${foraDaRegra.join(', ')} fora da disciplina ${rule.label}, registrado no histórico`:'✓ Responsáveis atualizados · painel mantido no contexto atual', foraDaRegra.length?'info':'ok', foraDaRegra.length?7000:undefined); } catch(error) { if(button) button.disabled=false; showToast(`Não foi possível atualizar responsáveis: ${error.message}`,'err',7000); } }

const DESIGN_TEAM   = ['deivid','beatriz','jady','victória','victoria'];
const TAINARA_NAMES = ['tainara'];
function isTainara(r) { return (r||'').toLowerCase().split(',').some(x=>TAINARA_NAMES.some(t=>x.trim().includes(t))); }
function isDesign(r)  { return (r||'').toLowerCase().split(',').some(x=>DESIGN_TEAM.some(d=>x.trim().includes(d))); }
function isEdicao(r)  { return (r||'').toLowerCase().includes('reriston'); }

function getItemsBySemana(sem) { return DADOS.filter(d=>d.semana===sem && getDateIso(d)); }
function getDiasSemana(sem) { return DIAS_SEMANAS[sem-1] || []; }
function groupByCliente(items) {
  const m={};
  items.forEach(d=>{ if(!m[d.cliente]) m[d.cliente]=[]; m[d.cliente].push(d); });
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
  else if(filter==='redacao') fi = fi.filter(d=>d.grupo==='Redação' && d.status==='A Fazer');
  else if(filter==='design')  fi = fi.filter(d=>isDesign(d.responsavel));
  else if(filter==='edicao')  fi = fi.filter(d=>isEdicao(d.responsavel));
  else if(filter==='status:pending_all') fi = fi.filter(d=>!['Finalizado','Agendado','Para agendar'].includes(d.status));
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
    const diaSem = dateMode === 'prazo' ? (d.prazo_iso ? ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(d.prazo_iso+'T12:00:00').getDay()] : '') : d.dia_semana;
    const isUrgent = !['Finalizado','Agendado','Para agendar'].includes(d.status) && isDateTodayOrTomorrow(getDateIso(d));
    // Mesmas peças da fila de demandas e da visão por grupo, arrumadas para a
    // largura desta coluna. O ID e a captação entram aqui: faltavam.
    return `
    <div class="item-row${isUrgent?' urgent':''}">
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
  const doneItems = fi.filter(d => ['Finalizado','Agendado','Para agendar'].includes(d.status)).length;
  const progressPct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0;
  const hasPending = fi.some(d => ['A Fazer','Falta D.A','Pode Fazer','Aguardo','Alteração'].includes(d.status));
  const allDone = totalItems > 0 && fi.every(d => ['Finalizado','Agendado','Para agendar'].includes(d.status));
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
  const numWeeks = META.weeks ? META.weeks.length : 4;
  for (let s = 1; s <= numWeeks; s++) renderWeek(s, currentFilter, currentDayFilter);
}

// ─── Limpar todos os filtros ──────────────────────────────────────────────────
function updateClearFiltersState() {
  const btn = document.getElementById('ops-clear-btn');
  if (!btn) return;
  const search = document.getElementById('global-search');
  const hasActiveFilter = currentFilter !== 'all' || currentDayFilter !== '' || currentPersonFilter !== 'all' || sortCritico || pendingOnlyActive || (search && search.value.trim() !== '') || dateMode === 'prazo';
  btn.classList.toggle('is-idle', !hasActiveFilter);
  btn.textContent = hasActiveFilter ? '✕ Limpar filtros' : '✓ Sem filtros';
  btn.title = hasActiveFilter ? 'Limpar busca e todos os filtros ativos' : 'Nenhum filtro ativo';
}

function clearAllFilters(preserveDateMode = false) {
  pendingOnlyActive = false;
  const pendBtn = document.getElementById('btn-pending-only');
  if(pendBtn) { pendBtn.classList.remove('pending-active'); pendBtn.textContent = 'Só pendentes'; }
  currentFilter = 'all';
  currentDayFilter = '';
  currentPersonFilter = 'all';
  selectedPersonIds.clear();
  sortCritico = false;
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
  updateClearFiltersState();
}
// ─── Renderizar por dia ────────────────────────────────────────────────────────────
function renderByDay(sem, filter, dayFilter) {
  const items = getItemsBySemana(sem);
  // No modo PRAZO, construir lista de dias a partir dos prazos dos itens desta semana
  let dias;
  if (dateMode === 'prazo') {
    const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const isoSet = [...new Set(items.map(d=>d.prazo_iso).filter(Boolean))].sort();
    dias = isoSet.map(iso => {
      const dt = new Date(iso+'T12:00:00');
      return { iso, label: labels[dt.getDay()], num: String(dt.getDate()).padStart(2,'0'), hoje: iso === HOJE_ISO };
    });
  } else {
    dias = getDiasSemana(sem);
  }
  const grid = document.getElementById(`grid-s${sem}`);
  if (!grid) return;
  // Aplicar filtros
  let fi = [...items];
  if (selectedPersonIds.size) {
    fi = fi.filter(itemMatchesSelectedPeople);
  }
  if(filter==='pending')      fi = fi.filter(d=>!isTainara(d.responsavel));
  else if(filter==='ready')   fi = fi.filter(d=>isTainara(d.responsavel));
  else if(filter==='redacao') fi = fi.filter(d=>d.grupo==='Redação' && d.status==='A Fazer');
  else if(filter==='design')  fi = fi.filter(d=>isDesign(d.responsavel));
  else if(filter==='edicao')  fi = fi.filter(d=>isEdicao(d.responsavel));
  else if(filter==='status:pending_all') fi = fi.filter(d=>!['Finalizado','Agendado','Para agendar'].includes(d.status));
  else if(filter&&filter.startsWith('status:')) fi = fi.filter(d=>d.status===filter.replace('status:',''));
  const diasFiltrados = dayFilter ? dias.filter(d=>d.iso===dayFilter) : dias;
  // A ordem que o olho ve nesta tela, na sequencia em que os dias aparecem: e
  // ela que o shift+clique usa para marcar um intervalo.
  const ordemVisivel = [];
  grid.innerHTML = diasFiltrados.map(dia => {
    const dayItems = fi.filter(d=>getDateIso(d)===dia.iso).sort((a,b)=>{
      // Pendentes primeiro, finalizados depois
      const aOk = ['Finalizado','Agendado','Para agendar'].includes(a.status);
      const bOk = ['Finalizado','Agendado','Para agendar'].includes(b.status);
      if(aOk && !bOk) return 1;
      if(!aOk && bOk) return -1;
      return a.cliente.localeCompare(b.cliente);
    });
    // DIA VAZIO PASSA A EXISTIR, e por um motivo novo: agora ele e um ALVO.
    //
    // Antes sumir fazia sentido — cartao vazio so ocupava espaco. Com o arrasto,
    // sumir vira defeito: nao havia como levar uma peca para a quarta-feira se a
    // quarta nao tinha nada. O dia vazio aparece rasteiro, so com a data e o
    // convite, e some de novo assim que a semana e filtrada por um unico dia.
    if(dayItems.length === 0) {
      return `<div class="client-card dia-solta dia-vazio" style="margin-bottom:12px;" data-date="${dia.iso}"
        ondragover="soltarNoDiaSobre(event,this)" ondragleave="soltarNoDiaSai(this)"
        ondrop="soltarNoDia('${dia.iso}',event,this)">
        <div class="client-header"><div class="client-name">${dia.label} — ${
          String(new Date(dia.iso+'T12:00:00').getDate()).padStart(2,'0')}/${
          String(new Date(dia.iso+'T12:00:00').getMonth()+1).padStart(2,'0')}</div>
        <span class="dia-vazio-recado">arraste uma peça para cá</span></div>
      </div>`;
    }
    const dayDone = dayItems.filter(d=>['Finalizado','Agendado','Para agendar'].includes(d.status)).length;
    const dayPct = Math.round(dayDone / dayItems.length * 100);
    dayItems.forEach(d => ordemVisivel.push(String(d.id)));
    const rows = dayItems.map(d=>{
      const prazoAtrasadoBadge = (dateMode === 'prazo' && d.prazo_atrasado) ? '<span class="prazo-badge">Atrasado</span>' : '';
      const marcada = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.has(String(d.id));
      const isPending = !['Finalizado','Agendado','Para agendar'].includes(d.status);
      // ARRASTAR A PECA DE UM DIA PARA O OUTRO MUDA A VEICULACAO.
      //
      // A agenda mensal ja fazia isso; a lista da semana, que e onde o time
      // passa o dia, nao. Reusa a MESMA maquina do calendario — mesmo
      // dragstart, mesmo drop, mesma gravacao — em vez de uma segunda
      // implementacao que amanha divergiria da primeira.
      return `<div class="item-row${isPending?' urgent':''}${marcada?' marcada':''}" draggable="true"
        ondragstart="managerCalendarDragStart('content','${safeText(d.id)}',event)"
        ondragend="managerCalendarDragEnd()"
        title="Arraste para outro dia para mudar a veiculação">
        <label class="dia-marcar" onclick="event.stopPropagation()" title="Marcar para ação em lote">
          <input type="checkbox" ${marcada?'checked':''} aria-label="Marcar ${safeText(d.nome||'')}"
            onclick="event.stopPropagation();alternarSelecao('${safeText(d.id)}',this.checked,event,ORDEM_VISIVEL_DO_DIA)"></label>
        <span class="item-cliente-tag" style="background:rgba(168,85,247,.18);color:#c084fc;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;white-space:nowrap;flex-shrink:0;">${d.cliente}</span>
        ${fmtHtml(d.formato)}
        <button type="button" class="item-name item-workspace-link" style="flex:1;min-width:0;" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}${prazoAtrasadoBadge}</button>
        ${managerStatusControl(d)}
        ${quickDateTrigger(d,'manager-date-trigger')}
        ${ownerEditorTrigger(d,'manager-owner-trigger')}
      </div>`;
    }).join('');
    const modeIcon = '';
    const progressColor = dayPct === 100 ? '#00ff88' : dayPct >= 50 ? '#ff6b00' : '#ffbd2e';
    return `<div class="client-card dia-solta" style="margin-bottom:12px;" data-date="${dia.iso}"
      ondragover="soltarNoDiaSobre(event,this)" ondragleave="soltarNoDiaSai(this)"
      ondrop="soltarNoDia('${dia.iso}',event,this)">
      <div class="client-header">
        <div class="client-name">${modeIcon} ${dia.label} — ${String(new Date(dia.iso+'T12:00:00').getDate()).padStart(2,'0')}/${String(new Date(dia.iso+'T12:00:00').getMonth()+1).padStart(2,'0')}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" class="day-summary-btn" onclick="openDailySummary('${dia.iso}')" title="Gerar mensagem copiável para o grupo de Criação">◈ Gerar resumo</button>
          <span class="count-badge ok">${dayItems.length} post${dayItems.length!==1?'s':''}</span>
          <span style="font-size:10px;color:${progressColor};font-weight:700;">${dayDone}/${dayItems.length}</span>
        </div>
      </div>
      <div class="client-progress"><div class="client-progress-bar"><div class="client-progress-fill" style="width:${dayPct}%;background:${progressColor}"></div></div><span class="client-progress-text">${dayPct}%</span></div>
      <div class="item-list">${rows}</div>
    </div>`;
  }).join('');
  // O dock e o MESMO da visao de Grupos: flutua no rodape e some quando nada
  // esta marcado. Basta existir no DOM — nao precisa de lugar proprio.
  ORDEM_VISIVEL_DO_DIA = ordemVisivel;
  if (typeof deckDeLoteHtml === 'function' && typeof SELECIONADAS !== 'undefined' && SELECIONADAS.size) {
    grid.insertAdjacentHTML('afterbegin', deckDeLoteHtml('producao'));
  }
}
// A ordem em que as pecas aparecem na lista por dia. Guardada porque o
// shift+clique de uma linha precisa saber o que veio antes e depois DELA nesta
// tela, e nao na visao de Grupos.
let ORDEM_VISIVEL_DO_DIA = [];
const DAILY_SUMMARY_CLOSED_STATUSES = new Set(['finalizado','feito','concluído','concluido']);
const DAILY_SUMMARY_DISCIPLINES = {
  audiovisual:{ icon:'', label:'AUDIOVISUAL' },
  design:{ icon:'', label:'DESIGN' },
  publicacao:{ icon:'', label:'PUBLICAÇÃO / AGENDAMENTO' },
  'sem-responsavel':{ icon:'⚑', label:'SEM RESPONSÁVEL DEFINIDO' }
};
function dailySummaryPlain(value='') { return String(value || '').replace(/\s+/g,' ').trim(); }
function dailySummaryDateLabel(iso) { const date=new Date(`${iso}T12:00:00`); return `${['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`; }
function dailySummaryDiscipline(item) {
  const owner=String(item.responsavel || '').toLowerCase();
  const status=normalizedWorkflowStatus(item.status);
  const format=String(item.formato || '').toLowerCase();
  if (/tainara/.test(owner) || ['para agendar','agendado'].includes(status)) return 'publicacao';
  if (/reriston/.test(owner) || /reels|vídeo|video|fotografia|motion/.test(format)) return 'audiovisual';
  if (/deivid|beatriz|jady/.test(owner)) return 'design';
  return owner ? 'design' : 'sem-responsavel';
}
function buildDailySummary(dayIso) {
  const referenceLabel=dateMode==='prazo' ? 'Prazo' : 'Veiculação';
  const openItems=DADOS.filter(item=>getDateIso(item)===dayIso && !DAILY_SUMMARY_CLOSED_STATUSES.has(normalizedWorkflowStatus(item.status)));
  const lines=[`*VYBE OS · RESUMO DE CRIAÇÃO — ${dailySummaryDateLabel(dayIso)}*`, `_${openItems.length} atividade${openItems.length===1?'':'s'} em aberto · referência: ${referenceLabel}_`];
  if (!openItems.length) return [...lines,'','✅ Nenhuma atividade em aberto para este dia.'].join('\n');
  const groups={audiovisual:[],design:[],publicacao:[],'sem-responsavel':[]};
  openItems.forEach(item=>groups[dailySummaryDiscipline(item)].push(item));
  ['audiovisual','design','publicacao','sem-responsavel'].forEach(key=>{
    const items=groups[key]; if(!items.length) return;
    const info=DAILY_SUMMARY_DISCIPLINES[key];
    lines.push('',`${info.icon} *${info.label}*`);
    const byOwner={};
    items.sort((a,b)=>dailySummaryPlain(a.responsavel).localeCompare(dailySummaryPlain(b.responsavel)) || dailySummaryPlain(a.nome).localeCompare(dailySummaryPlain(b.nome))).forEach(item=>{
      const owner=dailySummaryPlain(item.responsavel) || 'Sem responsável';
      (byOwner[owner] ||= []).push(item);
    });
    Object.entries(byOwner).forEach(([owner,ownerItems])=>{
      lines.push(`*${owner}*`);
      ownerItems.forEach(item=>{
        const format=dailySummaryPlain(item.formato || 'Conteúdo');
        const client=dailySummaryPlain(item.cliente || 'Cliente não informado');
        lines.push(`• *${dailySummaryPlain(item.status || 'Sem status')}* — ${dailySummaryPlain(item.nome)} (${format})\n  ${client}`);
      });
    });
  });
  const late=openItems.filter(item=>item.prazo_atrasado);
  const blockedStatuses=new Set(['alteração','falta info','falta d.a','aguardo','ag. interno','ag. info cliente','ag. aprovação cliente']);
  const blocked=openItems.filter(item=>blockedStatuses.has(normalizedWorkflowStatus(item.status)));
  if(late.length || blocked.length) {
    lines.push('','⚠ *PONTOS DE ATENÇÃO*');
    if(late.length) lines.push(`• ${late.length} atividade${late.length===1?'':'s'} com prazo atrasado.`);
    if(blocked.length) lines.push(`• ${blocked.length} atividade${blocked.length===1?'':'s'} aguardando contexto, informação, direção ou aprovação.`);
  }
  lines.push('','_Atualizado via Vybe OS · use o status como referência antes de iniciar a próxima etapa._');
  return lines.join('\n');
}
function openDailySummary(dayIso) {
  const summary=buildDailySummary(dayIso);
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Comunicação operacional</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Resumo do dia para Criação</h2><p class="daily-summary-meta">A mensagem reúne somente atividades em aberto, com responsável e status atual. Ela não envia nada: revise e copie para o grupo do WhatsApp quando estiver pronto.</p><textarea id="daily-summary-preview" class="daily-summary-preview" readonly aria-label="Mensagem de resumo diário">${safeText(summary)}</textarea><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button><button type="button" class="workflow-primary" onclick="copyDailySummary()">Copiar para WhatsApp →</button></div>`);
}
async function copyDailySummary() {
  const area=document.getElementById('daily-summary-preview'); if(!area) return;
  const text=area.value;
  try {
    if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else { area.focus(); area.select(); if(!document.execCommand('copy')) throw new Error('A cópia não foi autorizada pelo navegador.'); }
    showToast('✓ Resumo copiado. Cole no grupo de Criação no WhatsApp.','ok',5000);
  } catch(error) { area.focus(); area.select(); showToast('Selecione e copie manualmente a mensagem.','info',5000); }
}

// ─── Renderizar semana ────────────────────────────────────────────────────────
function renderWeek(sem, filter, dayFilter) {
  if (viewMode === 'day') { renderByDay(sem, filter, dayFilter); updateClearFiltersState(); return; }
  const items = getItemsBySemana(sem);
  const porCliente = groupByCliente(items);
  const dias = getDiasSemana(sem);
  const grid = document.getElementById(`grid-s${sem}`);
  if (!grid) return;
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
  updateClearFiltersState();
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
function renderKPIs() { /* integrado no compact summary */ }

// ─── Progresso Geral ───────────────────────────────────────────────────────
function renderCompactSummary() {
  const all = DADOS;
  const total = all.length;
  const clientes = [...new Set(all.map(d => d.cliente))];
  const numWeeks = META.weeks ? META.weeks.length : 4;
  const done = all.filter(d => ['Finalizado','Agendado','Para agendar'].includes(d.status)).length;
  const podeFazer = all.filter(d => d.status === 'Pode Fazer').length;
  const pendentes = all.filter(d => ['A Fazer','Falta D.A'].includes(d.status)).length;
  const captacao = all.filter(d => d.status === 'Aguardo').length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  let clientesLow = 0;
  clientes.forEach(c => { for (let w = 1; w <= numWeeks; w++) { if ((groupByCliente(getItemsBySemana(w))[c] || []).length < 3) { clientesLow++; break; } } });
  // Hoje: usar a mesma fonte temporal devolvida pela sincronização do Monday.
  const todayIso = HOJE_ISO || new Date().toISOString().slice(0, 10);
  const todayItems = DADOS.filter(d => d.veiculacao_iso === todayIso);
  const todayPending = todayItems.filter(d => !['Finalizado','Agendado','Para agendar'].includes(d.status)).length;

  // Eram oito números do mesmo tamanho, cada um com uma cor. Oito destaques é
  // nenhum destaque: o olho não sabia por onde começar. Agora um número lidera
  // — quanto da semana está fechado —, o dia vem em seguida, e o resto é
  // detalhe em texto quieto. Cor só onde ela quer dizer risco.
  const detalhe = (valor, rotulo, risco = false) => `
    <span class="resumo-item${risco && valor > 0 ? ' risco' : ''}">
      <b>${valor}</b><span>${rotulo}</span></span>`;

  document.getElementById('compact-summary').innerHTML = `
    <div class="resumo-principal">
      <div class="resumo-numero">${pct}<i>%</i></div>
      <div class="resumo-legenda">
        <span>da semana fechada</span>
        <div class="resumo-barra"><i style="width:${pct}%"></i></div>
        <small>${done} de ${total} conteúdos</small>
      </div>
    </div>
    <div class="resumo-hoje">
      ${todayItems.length === 0
        ? '<b>Nada publica hoje</b>'
        : `<b>${todayItems.length} ${todayItems.length === 1 ? 'publica' : 'publicam'} hoje</b>
           ${todayPending > 0 ? `<span class="resumo-alerta">${todayPending} sem estar pronto</span>` : '<span class="resumo-ok">tudo pronto</span>'}`}
    </div>
    <div class="resumo-detalhes">
      ${detalhe(clientes.length, 'clientes')}
      ${detalhe(podeFazer, 'pode fazer')}
      ${detalhe(captacao, 'captação')}
      ${detalhe(pendentes, 'pendentes', true)}
      ${detalhe(clientesLow, 'clientes com menos de 3', true)}
    </div>`;
}

// ─── Resumo do Dia ──────────────────────────────────────────────────────────
function renderDaySummary() {
  const todayIso = HOJE_ISO || new Date().toISOString().slice(0,10);
  const todayStr = todayIso ? `${todayIso.slice(8,10)}/${todayIso.slice(5,7)}` : '—';
  const todayItems = DADOS.filter(d => d.veiculacao_iso === todayIso);
  const pending = todayItems.filter(d => !['Finalizado','Agendado'].includes(d.status));
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
function opsSelectedScope(){ return DADOS.filter(d => getDateIso(d) && itemMatchesSelectedPeople(d)); }
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
  const existing=document.getElementById('ops-today-panel'); if(!existing) return;
  const items=opsTodayItems(); const count=document.getElementById('ops-today-count'); if(count) count.textContent=items.length;
  const groups=new Map(); items.forEach(d=>opsOwners(d).forEach(owner=>{ const key=String(owner.id); if(!groups.has(key)) groups.set(key,{owner,items:[]}); groups.get(key).items.push(d); }));
  const content=groups.size?[...groups.values()].map(({owner,items})=>{ const avatar=owner.photo?`<img src="${owner.photo}" alt="${safeText(owner.name)}" onerror="this.remove()">`:'<span style="width:17px;height:17px;border-radius:50%;display:inline-grid;place-items:center;background:#566070;color:#fff;font-size:7px">?</span>'; return `<div class="ops-today-group"><div class="ops-today-group-head">${avatar}<b>${safeText(firstName(owner.name))}</b><span>${items.length} entrega${items.length===1?'':'s'}</span></div>${items.map(d=>{const date=getDateIso(d);const overdue=date<opsTodayIso();return `<div class="ops-today-line" onclick="openItemWorkspace('${d.id}')">${vybeChipId(d)}<b title="${safeText(d.nome)}">${safeText(d.nome)}</b>${vybeTagCliente(d)}<span class="${overdue?'ops-today-alert':'ops-today-due'}">${overdue?'ATRASADA':`HOJE · ${safeText(getDateFmt(d))}`}</span></div>`;}).join('')}</div>`;}).join(''):'<div class="ops-empty">✓ Nenhuma entrega aberta vence hoje ou está atrasada neste contexto.</div>';
  existing.innerHTML=`<div class="ops-panel-title"><span>O que vence hoje · ${safeText(opsTodayIso().split('-').reverse().join('/'))}</span><span>${items.length} item${items.length===1?'':'s'}</span></div>${content}`;
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
  const renderList=(items,label,empty)=>items.length?items.slice(0,5).map(d=>`<div class="ops-today-line" onclick="openItemWorkspace('${d.id}')"><b title="${safeText(d.nome)}">${safeText(d.nome)}</b><small>${safeText(opsOwnerLabel(d))} · ${safeText(d.cliente)}</small><span class="ops-daily-tag">${safeText(label(d))}</span></div>`).join(''):`<div class="ops-daily-empty">${empty}</div>`;
  panel.innerHTML=`<div class="ops-panel-title"><span>◷ Fechamento do dia · ${safeText(today.split('-').reverse().join('/'))}</span><span>leitura do contexto atual</span></div><div class="ops-daily-kpis"><div class="ops-daily-kpi"><b>${finalizedToday.length}</b><span>finalizadas e atualizadas hoje</span></div><div class="ops-daily-kpi"><b>${ongoing.length}</b><span>permanecem em execução</span></div><div class="ops-daily-kpi"><b>${carry.length}</b><span>riscos ou bloqueios atravessam</span></div></div><div class="ops-daily-section"><div class="ops-daily-section-head"><span>Em execução ao encerrar</span><small>clique para abrir</small></div>${renderList(ongoing,d=>d.status,'✓ Nenhuma entrega permanece em execução.')}</div><div class="ops-daily-section"><div class="ops-daily-section-head"><span>Riscos que atravessam</span><small>atraso ou bloqueio</small></div>${renderList(carry,d=>d.status,'✓ Nenhum risco ou bloqueio precisa atravessar para o próximo ciclo.')}</div>`;
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
}

function toggleActionQueue() { alternarPainelDaBarra('acao'); }


function renderActionQueue() {
  const panel = document.getElementById('ops-action-panel');
  const countEl = document.getElementById('ops-action-count');
  if (!panel || !countEl) return;
  const items = getActionItems(currentWeek).sort((a,b) => {
    const aRisk = Number(a.operational_risk?.score ?? 99);
    const bRisk = Number(b.operational_risk?.score ?? 99);
    const aDate = getDateIso(a) || '9999-12-31';
    const bDate = getDateIso(b) || '9999-12-31';
    return aRisk - bRisk || aDate.localeCompare(bDate) || a.cliente.localeCompare(b.cliente);
  });
  countEl.textContent = items.length;
  const visibleItems = showAllActionItems ? items : items.slice(0,5);
  const list = visibleItems.length ? visibleItems.map(d => `<div class="ops-item">
    ${vybeChipId(d)}
    ${vybeTagCliente(d)}
    <span class="ops-item-name" title="${safeText(d.nome)}">${vybeNome(d)}</span>
    ${vybeStatus(d)}
    ${riskBadgeHtml(d,true)}
    <span class="ops-item-date">${safeText(getDateFmt(d))}</span>
  </div>`).join('') : '<div class="ops-empty">✓ Nenhum item requer ação nesta semana.</div>';
  const toggle = items.length > 5 ? `<button class="search-result-action" onclick="toggleAllActionItems()">${showAllActionItems ? 'Mostrar menos' : `Ver mais (${items.length - 5})`}</button>` : '';
  const weekLabel = META.weeks && META.weeks[currentWeek-1] ? META.weeks[currentWeek-1].label : `Semana ${currentWeek}`;
  panel.innerHTML = `<div class="ops-panel-title"><span>Requer ação — ${safeText(weekLabel)}</span>${toggle}</div><div class="ops-list">${list}</div>`;
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
