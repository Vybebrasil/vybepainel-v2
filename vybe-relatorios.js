// vybe-relatorios.js — diário de produção, performance e departamentos
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Diário de Produção ────────────────────────────────────────────────────────────────────────────────
const DIARIO_KEY = 'vybe_diario_snapshots_v1';
const DIARIO_MAX = 30;
let diarioSnapshotAtivo = null;
let diarioPersonFilter = 'all';
let diarioDateMode = 'veiculacao'; // 'veiculacao' ou 'prazo'

function setDiarioDateMode(mode, btn) {
  diarioDateMode = mode;
  document.querySelectorAll('#date-mode-bar-diario .date-mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (diarioSnapshotAtivo) renderDiarioDetalhe(diarioSnapshotAtivo);
}

function salvarSnapshot() {
  if (DADOS.length === 0) {
    showToast('Carregue os dados de Produção primeiro!', 'err', 4000);
    return;
  }
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const dataHora = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const snapshot = {
    id: Date.now(),
    dataHora,
    total: DADOS.length,
    itens: DADOS.map(d => ({
      id:             d.id,
      nome:           d.nome,
      cliente:        d.cliente,
      formato:        d.formato,
      status:         d.status,
      responsavel:    d.responsavel,
      responsavel_id: d.responsavel_id,
      responsavel_ids:d.responsavel_ids,
      veiculacao:     d.veiculacao,
      veiculacao_iso: d.veiculacao_iso,
      prazo:          d.prazo,
      prazo_iso:      d.prazo_iso,
      semana:         d.semana,
      url:            d.url
    }))
  };
  const lista = carregarSnapshots();
  lista.unshift(snapshot);
  if (lista.length > DIARIO_MAX) lista.splice(DIARIO_MAX);
  localStorage.setItem(DIARIO_KEY, JSON.stringify(lista));
  showToast(`✓ Snapshot salvo: ${dataHora} (${DADOS.length} itens)`, 'ok');
  renderDiarioLista();
}

function carregarSnapshots() {
  try { return JSON.parse(localStorage.getItem(DIARIO_KEY) || '[]'); } catch(e) { return []; }
}

function renderDiarioLista() {
  const lista = carregarSnapshots();
  const el = document.getElementById('diario-snapshots-list');
  if (!el) return;
  document.getElementById('diario-lista').style.display = 'block';
  document.getElementById('diario-detalhe').style.display = 'none';
  if (lista.length === 0) {
    el.innerHTML = `<div style="color:var(--text-muted);padding:40px 0;text-align:center;">
      <div style="font-size:32px;margin-bottom:12px;">📸</div>
      <div>Nenhum snapshot salvo ainda.</div>
      <div style="font-size:11px;margin-top:8px;">Clique em <strong>📸 Salvar Snapshot Agora</strong> para registrar o estado atual.</div>
    </div>`;
    return;
  }
  el.innerHTML = lista.map(s => `
    <div class="client-card alert-ok" style="cursor:pointer;margin-bottom:10px;" onclick="abrirSnapshot(${s.id})">
      <div class="client-header">
        <div>
          <div class="client-name">📸 ${s.dataHora}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${s.total} itens capturados</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="posts-count ok">${s.total} itens</span>
          <button class="sort-btn" style="border-color:#e2445c;color:#e2445c;" onclick="event.stopPropagation();excluirSnapshot(${s.id})">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function abrirSnapshot(id) {
  const lista = carregarSnapshots();
  const snap = lista.find(s => s.id === id);
  if (!snap) return;
  diarioSnapshotAtivo = snap;
  diarioPersonFilter = 'all';
  document.getElementById('diario-lista').style.display = 'none';
  document.getElementById('diario-detalhe').style.display = 'block';
  document.getElementById('diario-detalhe-titulo').textContent = `📸 ${snap.dataHora} — ${snap.total} itens`;
  renderDiarioPersonFilter(snap);
  renderDiarioDetalhe(snap);
}

function voltarDiarioLista() {
  diarioSnapshotAtivo = null;
  renderDiarioLista();
}

function renderDiarioPersonFilter(snap) {
  const bar = document.getElementById('diario-person-filter');
  if (!bar) return;
  // Coletar pessoas presentes no snapshot
  const activePeople = new Set();
  snap.itens.forEach(d => {
    if (d.responsavel_ids && d.responsavel_ids.length > 0) d.responsavel_ids.forEach(id => activePeople.add(id));
    else if (d.responsavel_id) activePeople.add(d.responsavel_id);
  });
  bar.innerHTML = '';
  // Chip Todos
  const allWrap = document.createElement('div');
  allWrap.className = 'person-wrap';
  allWrap.onclick = () => { diarioPersonFilter='all'; renderDiarioDetalhe(snap); document.querySelectorAll('#diario-person-filter .person-chip').forEach(c=>c.classList.remove('active')); allWrap.querySelector('.person-chip').classList.add('active'); };
  const allChip = document.createElement('span');
  allChip.className = 'person-chip active';
  allChip.style.background = '#6b7280';
  allChip.textContent = 'Todos';
  allWrap.appendChild(allChip);
  bar.appendChild(allWrap);
  // Chips por pessoa
  TEAM_USERS.forEach(u => {
    if (!activePeople.has(u.id)) return;
    const wrap = document.createElement('div');
    wrap.className = 'person-wrap';
    wrap.onclick = () => {
      diarioPersonFilter = u.id;
      renderDiarioDetalhe(snap);
      document.querySelectorAll('#diario-person-filter .person-chip').forEach(c=>c.classList.remove('active'));
      wrap.querySelector('.person-chip').classList.add('active');
    };
    const chip = document.createElement('span');
    chip.className = 'person-chip';
    chip.style.background = u.color;
    chip.style.color = '#fff';
    chip.textContent = u.name;
    wrap.appendChild(chip);
    bar.appendChild(wrap);
  });
}

function renderDiarioDetalhe(snap) {
  const el = document.getElementById('diario-detalhe-content');
  if (!el) return;
  let itens = snap.itens;
  // Filtro por pessoa
  if (diarioPersonFilter !== 'all') {
    itens = itens.filter(d => (d.responsavel_ids && d.responsavel_ids.includes(diarioPersonFilter)) || d.responsavel_id === diarioPersonFilter);
  }
  // Agrupar por responsavel
  const porResp = {};
  itens.forEach(d => {
    const nome = firstName(d.responsavel) || '—';
    if (!porResp[nome]) porResp[nome] = [];
    porResp[nome].push(d);
  });
  // Buscar status atual para comparar
  const statusAtual = {};
  const respAtual = {};
  DADOS.forEach(d => { statusAtual[d.id] = d.status; respAtual[d.id] = d.responsavel; });
  const html = Object.entries(porResp).sort((a,b)=>a[0].localeCompare(b[0])).map(([resp, items]) => {
    const rows = items.sort((a,b)=>{
      const da = diarioDateMode === 'prazo' ? (a.prazo_iso||a.veiculacao_iso||'') : (a.veiculacao_iso||a.prazo_iso||'');
      const db = diarioDateMode === 'prazo' ? (b.prazo_iso||b.veiculacao_iso||'') : (b.veiculacao_iso||b.prazo_iso||'');
      return da.localeCompare(db);
    }).map(d => {
      const statusNow = statusAtual[d.id];
      const respNow   = respAtual[d.id];
      const statusMudou = statusNow && statusNow !== d.status;
      const respMudou   = respNow   && respNow   !== d.responsavel;
      const statusHtml = statusMudou
        ? `<span style="text-decoration:line-through;opacity:.5;">${pillHtml(d.status)}</span> <span style="color:#4ade80;">→</span> ${pillHtml(statusNow)} <span style="background:#4ade80;color:#000;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;">MUDOU</span>`
        : pillHtml(d.status);
      const respHtml = respMudou
        ? `<span style="text-decoration:line-through;opacity:.5;">${firstName(d.responsavel)}</span> <span style="color:#fbbf24;">→ ${firstName(respNow)}</span>`
        : `<span>${firstName(d.responsavel)}</span>`;
      const dataExib = diarioDateMode === 'prazo' ? (d.prazo || d.veiculacao || '—') : (d.veiculacao || d.prazo || '—');
      const dataLabel = diarioDateMode === 'prazo'
        ? (d.prazo ? `⏰ ${d.prazo}` : (d.veiculacao ? `📅 ${d.veiculacao}` : '—'))
        : (d.veiculacao ? `📅 ${d.veiculacao}` : (d.prazo ? `⏰ ${d.prazo}` : '—'));
      return `<div class="item-row">
        <span class="item-date">${dataLabel}</span>
        ${fmtHtml(d.formato)}
        <span class="item-name"><button type="button" class="item-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.cliente)} — ${safeText(d.nome)}</button></span>
        <span>${statusHtml}</span>
        <span class="item-resp">${respHtml}</span>
      </div>`;
    }).join('');
    return `<div class="client-card alert-ok" style="margin-bottom:12px;">
      <div class="client-header">
        <div class="client-name">👤 ${resp}</div>
        <span class="posts-count ok">${items.length} item${items.length!==1?'s':''}</span>
      </div>
      <div class="item-list">${rows}</div>
    </div>`;
  }).join('');
  el.innerHTML = html || '<div style="color:var(--text-muted);padding:20px 0;">Nenhum item para exibir.</div>';
}

function excluirSnapshot(id) {
  const lista = carregarSnapshots().filter(s => s.id !== id);
  localStorage.setItem(DIARIO_KEY, JSON.stringify(lista));
  if (diarioSnapshotAtivo && diarioSnapshotAtivo.id === id) voltarDiarioLista();
  else renderDiarioLista();
  showToast('Snapshot excluído.', 'ok');
}

function exportarSnapshot() {
  if (!diarioSnapshotAtivo) return;
  const snap = diarioSnapshotAtivo;
  const linhas = [`Diário de Produção — ${snap.dataHora}`, `Total: ${snap.total} itens`, ''];
  const porResp = {};
  snap.itens.forEach(d => {
    const n = firstName(d.responsavel) || '—';
    if (!porResp[n]) porResp[n] = [];
    porResp[n].push(d);
  });
  Object.entries(porResp).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([resp, items]) => {
    linhas.push(`=== ${resp} (${items.length} itens) ===`);
    items.forEach(d => linhas.push(`  [${d.status}] ${d.cliente} — ${d.nome} | ${d.veiculacao || d.prazo || '—'} | ${d.url}`));
    linhas.push('');
  });
  const blob = new Blob([linhas.join('\n')], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diario_${snap.dataHora.replace(/[/:]/g,'-').replace(/ /g,'_')}.txt`;
  a.click();
}

// ─── Performance ──────────────────────────────────────────────────────────────────────────────────────────
let perfPeriodDias = 30;
let perfFiltroAtivo = null; // 'atrasados' | 'concluidos' | 'pendentesVeic' | 'publicados' | null
let perfChartColaborador = null;
let perfChartSemanal = null;
let perfChartDiario = null;
let perfChartDiarioPrazo = null;
let perfChartDiarioVeiculacao = null;
window.perfFiltroCache = { atrasados:[], concluidos:[], pendentesVeic:[], publicados:[] };
const STATUS_CONCLUIDO = ['Finalizado','Agendado','Para Agendar'];

function setPerfPeriod(dias, btn) {
  perfPeriodDias = dias;
  perfFiltroAtivo = null;
  document.querySelectorAll('.perf-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPerformance();
}

function getPerfBase() {
  return (typeof DADOS_ALL !== 'undefined' && DADOS_ALL.length > 0) ? DADOS_ALL : DADOS;
}

function getPerfCutoff() {
  if (perfPeriodDias === 0) return '';
  const corte = new Date();
  corte.setDate(corte.getDate() - perfPeriodDias);
  return corte.toISOString().slice(0,10);
}

function togglePerfFiltro(tipo, itens) {
  if (perfFiltroAtivo === tipo) {
    perfFiltroAtivo = null;
  } else {
    perfFiltroAtivo = tipo;
  }
  renderPerfFiltradoLista(itens);
  // Atualizar visual dos KPIs
  document.querySelectorAll('.perf-kpi-clickable').forEach(el => {
    el.style.outline = el.dataset.filtro === perfFiltroAtivo ? '2px solid var(--accent2)' : 'none';
    el.style.transform = el.dataset.filtro === perfFiltroAtivo ? 'scale(1.03)' : 'scale(1)';
  });
}

// Mapa de cores padrão Monday.com por status
const MONDAY_STATUS_COLORS = {
  // Cores EXATAS extraídas via API do Monday.com (board 7829537690)
  'Em andamento':          { bg:'rgba(253,171,61,.15)',  color:'#fdab3d', border:'rgba(253,171,61,.3)' },
  'Em Andamento':          { bg:'rgba(253,171,61,.15)',  color:'#fdab3d', border:'rgba(253,171,61,.3)' },
  'Falta D.A':             { bg:'rgba(78,204,198,.15)',  color:'#4eccc6', border:'rgba(78,204,198,.3)' },
  'Alteração':             { bg:'rgba(223,47,74,.15)',   color:'#df2f4a', border:'rgba(223,47,74,.3)' },
  'Finalizado':            { bg:'rgba(156,211,38,.15)',  color:'#9cd326', border:'rgba(156,211,38,.3)' },
  'Aguardo':               { bg:'rgba(157,80,221,.15)',  color:'#9d50dd', border:'rgba(157,80,221,.3)' },
  'A Fazer':               { bg:'rgba(196,196,196,.12)', color:'#c4c4c4', border:'rgba(196,196,196,.25)' },
  'Para agendar':          { bg:'rgba(3,127,76,.15)',    color:'#037f4c', border:'rgba(3,127,76,.3)' },
  'Para Agendar':          { bg:'rgba(3,127,76,.15)',    color:'#037f4c', border:'rgba(3,127,76,.3)' },
  'Para aprovação':        { bg:'rgba(87,155,252,.15)',  color:'#579bfc', border:'rgba(87,155,252,.3)' },
  'Para Aprovação':        { bg:'rgba(87,155,252,.15)',  color:'#579bfc', border:'rgba(87,155,252,.3)' },
  'Cap. Agendada':         { bg:'rgba(255,0,127,.15)',   color:'#ff007f', border:'rgba(255,0,127,.3)' },
  'Ag. Aprovação Cliente': { bg:'rgba(250,161,241,.15)', color:'#faa1f1', border:'rgba(250,161,241,.3)' },
  'Ag. Info Cliente':      { bg:'rgba(188,165,138,.15)', color:'#bca58a', border:'rgba(188,165,138,.3)' },
  'Falta Info':            { bg:'rgba(255,109,59,.15)',  color:'#ff6d3b', border:'rgba(255,109,59,.3)' },
  'Agendando Cap':         { bg:'rgba(255,90,196,.15)',  color:'#ff5ac4', border:'rgba(255,90,196,.3)' },
  'Agendando Cap.':        { bg:'rgba(255,90,196,.15)',  color:'#ff5ac4', border:'rgba(255,90,196,.3)' },
  'Segurar Post':          { bg:'rgba(127,83,71,.15)',   color:'#7f5347', border:'rgba(127,83,71,.3)' },
  'Agendado':              { bg:'rgba(161,227,246,.15)', color:'#a1e3f6', border:'rgba(161,227,246,.3)' },
  'Pode Fazer':            { bg:'rgba(255,203,0,.15)',   color:'#ffcb00', border:'rgba(255,203,0,.3)' },
  // Status adicionais
  'Ag. Interno':           { bg:'rgba(188,165,138,.15)', color:'#bca58a', border:'rgba(188,165,138,.3)' },
  'Em execução':           { bg:'rgba(253,171,61,.15)',  color:'#fdab3d', border:'rgba(253,171,61,.3)' },
  'Em aprovação':          { bg:'rgba(87,155,252,.15)',  color:'#579bfc', border:'rgba(87,155,252,.3)' },
  'Aprovado':              { bg:'rgba(156,211,38,.15)',  color:'#9cd326', border:'rgba(156,211,38,.3)' },
  'Nova Demanda':          { bg:'rgba(161,227,246,.15)', color:'#a1e3f6', border:'rgba(161,227,246,.3)' },
  'Aguardando Info.':      { bg:'rgba(255,203,0,.15)',   color:'#ffcb00', border:'rgba(255,203,0,.3)' },
  'Falta Briefing':        { bg:'rgba(255,109,59,.15)',  color:'#ff6d3b', border:'rgba(255,109,59,.3)' },
  'Revisão':               { bg:'rgba(253,171,61,.15)',  color:'#fdab3d', border:'rgba(253,171,61,.3)' },
};

function getStatusBadge(status) {
  const s = status || '—';
  const c = MONDAY_STATUS_COLORS[s] || { bg:'rgba(136,136,168,.12)', color:'#8888a8', border:'rgba(136,136,168,.25)' };
  return `<span style="background:${c.bg};color:${c.color};border:1px solid ${c.border};border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap;">${s}</span>`;
}

function renderPerfFiltradoLista(itens) {
  let container = document.getElementById('perf-filtro-lista');
  if (!container) return;
  if (!perfFiltroAtivo || !itens || itens.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  const hoje = new Date().toISOString().slice(0,10);
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };
  // Ordenar cronologicamente: mais atrasado primeiro (data mais antiga no topo)
  const itensSorted = [...itens].sort((a, b) => {
    const da = a.prazo_iso || a.veiculacao_iso || '9999';
    const db = b.prazo_iso || b.veiculacao_iso || '9999';
    return da.localeCompare(db);
  });
  const rows = itensSorted.slice(0,80).map(d => {
    const resp = firstName(d.responsavel) || 'Sem responsável';
    const cores = EQUIPE_CORES[resp] || ['#7c3aed','#5b21b6'];
    const dataRef = d.prazo_iso || d.veiculacao_iso || '';
    const dataFmt = dataRef ? dataRef.split('-').reverse().join('/') : '—';
    // Calcular dias de atraso se aplicável
    let atrasoHtml = '';
    if (dataRef && dataRef < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) {
      const dias = Math.floor((new Date(hoje) - new Date(dataRef)) / 86400000);
      atrasoHtml = `<span style="color:#ef4444;font-weight:700;font-size:10px;min-width:30px;">+${dias}d</span>`;
    }
    const itemUrl = d.url || `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${d.id}`;
    return `<a href="${itemUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;text-decoration:none;transition:background .15s;" onmouseover="this.style.background='rgba(124,58,237,0.08)'" onmouseout="this.style.background='transparent'">
      ${getStatusBadge(d.status)}
      <span style="color:var(--text-muted);min-width:52px;">${dataFmt}</span>
      ${atrasoHtml}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${d.cliente} — ${d.nome}</span>
      <span style="color:${cores[0]};font-weight:700;min-width:60px;text-align:right;">${resp}</span>
      <span style="color:var(--text-muted);font-size:10px;margin-left:4px;">↗</span>
    </a>`;
  }).join('');
  const titulo = { atrasados:'Itens Atrasados (prazo vencido)', concluidos:'Itens Concluídos', pendentesVeic:'Pendentes Atrasados (veiculação)', publicados:'Publicados' }[perfFiltroAtivo] || 'Itens';
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);">
      <span style="font-size:11px;font-weight:700;color:var(--accent2);">${titulo} (${itens.length})</span>
      <button onclick="togglePerfFiltro(null,[])" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;">✕ Fechar</button>
    </div>
    ${rows}
    ${itens.length > 80 ? `<div style="padding:8px 12px;color:var(--text-muted);font-size:11px;">...e mais ${itens.length-80} itens</div>` : ''}
  `;
}

// ─── Departamentos ───────────────────────────────────────────────────────────────────────────────
// Mapeamento fixo: quem pertence a qual departamento
// CRITÉRIO PRINCIPAL: groupIds = grupo do item no Monday.com
// Se o item está no grupo certo, vai para aquele departamento independente do responsável
const DEPT_CONFIG = [
  {
    id: 'redacao',
    label: '✍️ Redação',
    cor: '#3b82f6',
    desc: 'Copywriters e redatores',
    groupIds: ['group_title'], // Grupo "Redação" no Monday
    pessoas: ['Paulo','Thiago','Vinícius','Ewerton','Ewerton L.','Manus'],
    // Status que indicam que o item está na fila de redação
    statusAtivos: ['A Fazer','Em andamento','Em Andamento','Falta Info','Ag. Info Cliente','Aguardando Info.'],
    statusConcluidos: ['Pode Fazer','Falta D.A','Agendado','Finalizado','Para Agendar','Para agendar','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Aprovado','Ag. Interno','Alteração','Em execução']
  },
  {
    id: 'producao',
    label: '🎬 Produção',
    cor: '#f97316',
    desc: 'Captadores de foto e vídeo',
    groupIds: ['novo_grupo57911__1'], // Grupo "Produção (Foto e Vídeo)" no Monday
    pessoas: ['Thiago','Vinícius','Ewerton','Ewerton L.','Ademir','Tainara'], // Tainara faz agendamento de fotos/vídeos com clientes
    statusAtivos: ['Aguardo','Agendando Cap.','Cap. Agendada','Em andamento','Em Andamento'],
    statusConcluidos: ['Pode Fazer','Agendado','Finalizado','Para Agendar','Para agendar','Alteração','Em execução','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Aprovado']
  },
  {
    id: 'criacao',
    label: '🎨 Criação',
    cor: '#a855f7',
    desc: 'Designers, editores de foto e vídeo',
    groupIds: ['novo_grupo__1'], // Grupo "Design & Edição" no Monday
    pessoas: ['Deivid','Jady','Victória','Reriston','Beatriz','Vinícius','Thiago','Ewerton','Ewerton L.'],
    statusAtivos: ['Pode Fazer','Falta D.A','Em andamento','Em Andamento','Alteração','Em execução','Ag. Aprovação Cliente','Para aprovação','Para Aprovação','Ag. Interno'],
    statusConcluidos: ['Agendado','Finalizado','Para Agendar','Para agendar','Aprovado']
  },
  {
    id: 'saidas',
    label: '📤 Saídas',
    cor: '#22c55e',
    desc: 'Agendamento e publicação',
    groupIds: ['novo_grupo22352__1'], // Grupo "Gestão de publicações" no Monday
    pessoas: ['Tainara'],
    statusAtivos: ['Para Agendar','Para agendar','Ag. Aprovação Cliente','Aprovado','Ag. Interno'],
    statusConcluidos: ['Agendado','Finalizado']
  }
];

// Cache global de itens por departamento para filtros
window.deptFiltroCache = {};

function showDeptFiltro(titulo, itens) {
  // Reutiliza o container de filtro global
  perfFiltroAtivo = 'dept_custom';
  // Injeta título customizado no cache
  window._deptFiltroTitulo = titulo;
  renderPerfFiltradoListaCustom(titulo, itens);
  // Scroll suave até a lista
  const el = document.getElementById('perf-filtro-lista');
  if (el) setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}

function renderPerfFiltradoListaCustom(titulo, itens) {
  let container = document.getElementById('perf-filtro-lista');
  if (!container) return;
  if (!itens || itens.length === 0) {
    container.innerHTML = `<div style="padding:12px 16px;color:var(--text-muted);font-size:12px;">Nenhum item encontrado.</div>`;
    container.style.display = 'block';
    return;
  }
  container.style.display = 'block';
  const hoje = new Date().toISOString().slice(0,10);
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };
  const itensSorted = [...itens].sort((a, b) => {
    const da = a.prazo_iso || a.veiculacao_iso || '9999';
    const db = b.prazo_iso || b.veiculacao_iso || '9999';
    return da.localeCompare(db);
  });
  const rows = itensSorted.slice(0,100).map(d => {
    const resp = firstName(d.responsavel) || 'Sem responsável';
    const cores = EQUIPE_CORES[resp] || ['#7c3aed','#5b21b6'];
    const dataRef = d.prazo_iso || d.veiculacao_iso || '';
    const dataFmt = dataRef ? dataRef.split('-').reverse().join('/') : '—';
    let atrasoHtml = '';
    if (dataRef && dataRef < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) {
      const dias = Math.floor((new Date(hoje) - new Date(dataRef)) / 86400000);
      atrasoHtml = `<span style="color:#ef4444;font-weight:700;font-size:10px;min-width:30px;">+${dias}d</span>`;
    }
    const itemUrl = d.url || `https://gestaovybes-team.monday.com/boards/7829537690/pulses/${d.id}`;
    return `<a href="${itemUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;text-decoration:none;transition:background .15s;" onmouseover="this.style.background='rgba(124,58,237,0.08)'" onmouseout="this.style.background='transparent'">
      ${getStatusBadge(d.status)}
      <span style="color:var(--text-muted);min-width:52px;">${dataFmt}</span>
      ${atrasoHtml}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);">${d.cliente} — ${d.nome}</span>
      <span style="color:${cores[0]};font-weight:700;min-width:60px;text-align:right;">${resp}</span>
      <span style="color:var(--text-muted);font-size:10px;margin-left:4px;">↗</span>
    </a>`;
  }).join('');
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--surface2);">
      <span style="font-size:11px;font-weight:700;color:var(--accent2);">${titulo} (${itens.length})</span>
      <button onclick="document.getElementById('perf-filtro-lista').style.display='none';perfFiltroAtivo=null;" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">✕ Fechar</button>
    </div>
    ${rows}
    ${itens.length > 100 ? `<div style="padding:8px 12px;color:var(--text-muted);font-size:11px;">...e mais ${itens.length-100} itens</div>` : ''}
  `;
}

function renderDepartamentos(base, hoje, corte, periodoLabel) {
  const container = document.getElementById('perf-departamentos-grid');
  if (!container) return;

  // Limpar cache
  window.deptFiltroCache = {};

  const EQUIPE_CORES_LOCAL = {
    'Paulo':'#3b82f6','Vinícius':'#22c55e','Ewerton':'#ef4444','Ewerton L.':'#ef4444',
    'Reriston':'#f97316','Thiago':'#a855f7','Deivid':'#f59e0b','Beatriz':'#ec4899',
    'Ademir':'#14b8a6','Tainara':'#06b6d4','Jady':'#84cc16','Victória':'#94a3b8'
  };
  const BTN_STYLE = 'cursor:pointer;transition:opacity .15s,transform .15s;border:none;background:transparent;padding:0;width:100%;text-align:center;border-radius:8px;';
  const BTN_HOVER = 'onmouseover="this.style.opacity=\'0.75\'" onmouseout="this.style.opacity=\'1\'"';

  const html = DEPT_CONFIG.map(dept => {
    const todosStatus = [...dept.statusAtivos, ...dept.statusConcluidos];
    const itens = base.filter(d => {
      // CRITÉRIO PRINCIPAL: grupo do item no Monday (group_id)
      const noGrupoDept = dept.groupIds && dept.groupIds.includes(d.group_id);
      if (!noGrupoDept) return false;
      if (!todosStatus.includes(d.status)) return false;
      const ref = d.prazo_iso || d.veiculacao_iso;
      if (!ref) return false;
      if (corte && ref < corte) return false;
      return true;
    });

    if (itens.length === 0) {
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;border-top:3px solid ${dept.cor};">
        <div style="font-size:13px;font-weight:700;color:${dept.cor};margin-bottom:4px;">${dept.label}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;">${dept.desc}</div>
        <p style="color:var(--text-muted);font-size:11px;">Sem dados no período.</p>
      </div>`;
    }

    const total = itens.length;
    const ativos = itens.filter(d => dept.statusAtivos.includes(d.status));
    // Finalizados = apenas status 'Finalizado' (literal)
    const concluidos = itens.filter(d => d.status === 'Finalizado');
    const atrasadosPrazo = ativos.filter(d => d.prazo_iso && d.prazo_iso < hoje);
    const atrasadosVeic  = ativos.filter(d => d.veiculacao_iso && d.veiculacao_iso < hoje);
    const atrasados = ativos.filter(d => { const ref = d.prazo_iso || d.veiculacao_iso; return ref && ref < hoje; });
    // Taxa OK real: % de itens que saíram do grupo antes do prazo original
    const actLogs = window.ACTIVITY_LOGS || null;
    let taxaOKData = null;
    if (actLogs) {
      taxaOKData = calcTaxaOK(itens, dept, actLogs.moveEvents, actLogs.prazoEvents);
    }
    const taxaConclusao = taxaOKData && taxaOKData.total > 0 ? taxaOKData.pct : null;
    const taxaLabel = taxaConclusao !== null ? `${taxaConclusao}%` : '—';
    const taxaCor = taxaConclusao === null ? 'var(--text-muted)' : taxaConclusao >= 70 ? '#22c55e' : taxaConclusao >= 40 ? '#f59e0b' : '#ef4444';
      // Salvar itens OK/NOK no cache para filtro clicável
    const cid = dept.id;
    if (taxaOKData) {
      window.deptFiltroCache[cid + '_taxaOK'] = taxaOKData.okItems;
      window.deptFiltroCache[cid + '_taxaNOK'] = taxaOKData.nokItems;
    }
    let somaAtraso = 0;
    atrasados.forEach(d => { const ref = d.prazo_iso || d.veiculacao_iso; somaAtraso += Math.floor((new Date(hoje) - new Date(ref)) / 86400000); });
    const mediaAtraso = atrasados.length > 0 ? (somaAtraso/atrasados.length).toFixed(1) : 0;
    // Salvar no cache global para acesso pelos onclick
    window.deptFiltroCache[cid] = {
      todos: itens,
      concluidos,
      aberto: ativos,
      atrasadosPrazo,
      atrasadosVeic
    };

    // Por pessoa — todos os responsáveis, marcando os que são forasteiros (cadastro errado)
    const porPessoa = {};
    const itensCadastroErrado = []; // itens com responsável fora do time do departamento
    itens.forEach(d => {
      // Pegar todos os responsáveis do item
      const resps = (d.responsavel || '').split(',').map(r => r.trim().split(' ')[0]).filter(r => r && r !== '—');
      if (resps.length === 0) return;
      // Verificar se algum responsável é forasteiro (não pertence ao time do depto)
      const respsForasteiros = resps.filter(r => r && r !== '—' && !dept.pessoas.includes(r));
      const respsDept = resps.filter(r => dept.pessoas.includes(r));
      // Se NENHUM responsável é do time → item com cadastro errado
      const cadastroErrado = respsDept.length === 0;
      if (cadastroErrado) itensCadastroErrado.push({...d, _respsForasteiros: respsForasteiros});
      // Registrar TODOS os responsáveis no porPessoa, marcando forasteiros
      resps.forEach(resp => {
        if (!resp || resp === '—') return;
        const eForasteiro = !dept.pessoas.includes(resp);
        if (!porPessoa[resp]) porPessoa[resp] = { total:0, ativos:0, concluidos:0, atrasados:0, itens:[], itensAtrasados:[], forasteiro: eForasteiro };
        // Evitar duplicar o mesmo item para a mesma pessoa
        if (!porPessoa[resp].itens.includes(d)) {
          porPessoa[resp].total++;
          porPessoa[resp].itens.push(d);
          if (dept.statusAtivos.includes(d.status)) porPessoa[resp].ativos++;
          if (dept.statusConcluidos.includes(d.status)) porPessoa[resp].concluidos++;
          const ref = d.prazo_iso || d.veiculacao_iso;
          if (ref && ref < hoje && dept.statusAtivos.includes(d.status)) {
            porPessoa[resp].atrasados++;
            porPessoa[resp].itensAtrasados.push(d);
          }
        }
      });
    });
    // Salvar no cache
    window.deptFiltroCache[cid].porPessoa = porPessoa;
    window.deptFiltroCache[cid].cadastroErrado = itensCadastroErrado;

    const pessoasOrdenadas = Object.entries(porPessoa).sort((a,b) => b[1].total - a[1].total);
    const maxPessoa = pessoasOrdenadas[0]?.[1].total || 1;

    const pessoasHtml = pessoasOrdenadas.map(([nome, s]) => {
      const pct = Math.round((s.total/maxPessoa)*100);
      const taxaP = s.total > 0 ? Math.round((s.concluidos/s.total)*100) : 0;
      const eForasteiro = s.forasteiro === true;
      // Forasteiro: cor de alerta laranja-vermelho, borda tracejada
      const cor = eForasteiro ? '#f97316' : (EQUIPE_CORES_LOCAL[nome] || dept.cor);
      const barCor = eForasteiro ? '#f97316' : cor;
      const wrapStyle = eForasteiro
        ? 'margin-bottom:6px;background:rgba(249,115,22,.07);border:1px dashed rgba(249,115,22,.4);border-radius:6px;padding:5px 7px;'
        : 'margin-bottom:6px;';
      const alertaBadge = eForasteiro
        ? `<span title="Responsável fora do time deste departamento — possível cadastro errado" style="background:#f97316;color:#fff;font-size:9px;font-weight:900;padding:1px 5px;border-radius:4px;margin-left:3px;">! ERRADO</span>`
        : '';
      return `<div style="${wrapStyle}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:4px;">
          <span style="display:flex;align-items:center;gap:2px;">
            <button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — todos os itens (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)" style="${BTN_STYLE}text-align:left;font-size:11px;color:${cor};font-weight:700;flex-shrink:0;width:auto;">${nome}</button>
            ${alertaBadge}
          </span>
          <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;display:flex;align-items:center;gap:4px;">
            <button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — todos (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)" style="${BTN_STYLE}display:inline;font-size:10px;color:var(--text-muted);width:auto;">${s.total} itens</button>
            ${s.atrasados > 0 ? `<button ${BTN_HOVER} onclick="showDeptFiltro('${nome} — atrasados (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itensAtrasados)" style="${BTN_STYLE}display:inline;font-size:10px;color:#ef4444;font-weight:700;width:auto;">${s.atrasados} atrasados</button>` : ''}
            <span style="color:${taxaP>=70?'#22c55e':taxaP>=40?'#f59e0b':'#ef4444'};">${taxaP}% ok</span>
          </span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;cursor:pointer;" onclick="showDeptFiltro('${nome} — todos (${dept.label})', window.deptFiltroCache['${cid}'].porPessoa['${nome}'].itens)">
          <div style="height:100%;width:${pct}%;background:${barCor};border-radius:3px;${eForasteiro?'background:repeating-linear-gradient(45deg,#f97316,#f97316 4px,#f9731633 4px,#f9731633 8px);':''}"></div>
        </div>
      </div>`;
    }).join('');

    // Status breakdown — clicáveis
    const statusCount = {};
    itens.forEach(d => { statusCount[d.status] = (statusCount[d.status]||0)+1; });
    const statusTop = Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const statusHtml = statusTop.map(([s, q]) => {
      const c = MONDAY_STATUS_COLORS[s] || { color:'#8888a8', bg:'rgba(136,136,168,.12)', border:'rgba(136,136,168,.25)' };
      const itensStatus = itens.filter(d => d.status === s);
      // Salvar no cache
      window.deptFiltroCache[cid][`status_${s}`] = itensStatus;
      return `<button ${BTN_HOVER} onclick="showDeptFiltro('${s} — ${dept.label} (${q} itens)', window.deptFiltroCache['${cid}']['status_${s}'])" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;transition:opacity .15s;">${s} <strong>${q}</strong></button>`;
    }).join(' ');

    const pctPrazo = total > 0 ? Math.round((atrasadosPrazo.length/total)*100) : 0;
    const pctVeic  = total > 0 ? Math.round((atrasadosVeic.length/total)*100) : 0;
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;border-top:3px solid ${dept.cor};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:${dept.cor};">${dept.label}</div>
          <div style="font-size:10px;color:var(--text-muted);">${dept.desc}</div>
        </div>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — todos os itens', window.deptFiltroCache['${cid}'].todos)" style="${BTN_STYLE}text-align:right;">
          <div style="font-size:22px;font-weight:900;color:var(--text);line-height:1;">${total}</div>
          <div style="font-size:9px;color:var(--text-muted);">itens no período</div>
        </button>
      </div>
      <!-- KPIs clicáveis -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px;">
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Finalizados', window.deptFiltroCache['${cid}'].concluidos)" style="${BTN_STYLE}background:var(--surface2);border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:#9cd326;line-height:1;">${concluidos.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Finalizados</div>
        </button>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Em Aberto', window.deptFiltroCache['${cid}'].aberto)" style="${BTN_STYLE}background:var(--surface2);border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:#f59e0b;line-height:1;">${ativos.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Em Aberto</div>
        </button>
        ${taxaOKData && taxaOKData.total > 0 ? `
        <div style="background:var(--surface2);border-radius:8px;padding:7px 4px;text-align:center;cursor:pointer;" onclick="showDeptFiltro('${dept.label} \u2014 Taxa OK (${taxaOKData.okCount} ok / ${taxaOKData.nokCount} fora do prazo)', window.deptFiltroCache['${cid}_taxaOK'].concat(window.deptFiltroCache['${cid}_taxaNOK']))" title="${taxaOKData.okCount} entregues no prazo, ${taxaOKData.nokCount} fora do prazo">
          <div style="font-size:15px;font-weight:900;color:${taxaCor};line-height:1;">${taxaLabel}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Taxa OK</div>
          <div style="font-size:8px;color:var(--text-muted);margin-top:1px;">${taxaOKData.okCount}/${taxaOKData.total}</div>
        </div>` : `
        <div style="background:var(--surface2);border-radius:8px;padding:7px 4px;text-align:center;" title="Aguardando dados de histórico...">
          <div style="font-size:15px;font-weight:900;color:var(--text-muted);line-height:1;">—</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">Taxa OK</div>
          <div style="font-size:8px;color:var(--text-muted);margin-top:1px;">carregando...</div>
        </div>`}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Prazo em Atraso', window.deptFiltroCache['${cid}'].atrasadosPrazo)" style="${BTN_STYLE}background:${atrasadosPrazo.length > 0 ? 'rgba(239,68,68,.12)' : 'var(--surface2)'};border:1px solid ${atrasadosPrazo.length > 0 ? 'rgba(239,68,68,.3)' : 'transparent'};border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:${atrasadosPrazo.length > 0 ? '#ef4444' : '#22c55e'};line-height:1;">${atrasadosPrazo.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">⏰ Prazo Atraso${pctPrazo > 0 ? ` (${pctPrazo}%)` : ''}</div>
        </button>
        <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Veiculação em Atraso', window.deptFiltroCache['${cid}'].atrasadosVeic)" style="${BTN_STYLE}background:${atrasadosVeic.length > 0 ? 'rgba(239,68,68,.12)' : 'var(--surface2)'};border:1px solid ${atrasadosVeic.length > 0 ? 'rgba(239,68,68,.3)' : 'transparent'};border-radius:8px;padding:7px 4px;">
          <div style="font-size:15px;font-weight:900;color:${atrasadosVeic.length > 0 ? '#ef4444' : '#22c55e'};line-height:1;">${atrasadosVeic.length}</div>
          <div style="font-size:8px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">📅 Veic. Atraso${pctVeic > 0 ? ` (${pctVeic}%)` : ''}</div>
        </button>
      </div>
      ${atrasados.length > 0 ? `<div style="font-size:10px;color:#ef4444;margin-bottom:10px;">Média de atraso: <strong>${mediaAtraso} dias</strong></div>` : ''}
      <!-- Por pessoa -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Por Colaborador</div>
        ${pessoasHtml}
      </div>
      <!-- Status breakdown -->
      <div style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Status Atuais</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${statusHtml}</div>
      <!-- Alerta de cadastro errado -->
      ${itensCadastroErrado.length > 0 ? `
      <div style="margin-top:12px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.4);border-radius:8px;padding:8px 10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:900;color:#f97316;">⚠️ CADASTRO INCORRETO</span>
          <button ${BTN_HOVER} onclick="showDeptFiltro('${dept.label} — Cadastro Incorreto (${itensCadastroErrado.length} itens)', window.deptFiltroCache['${cid}'].cadastroErrado)" style="${BTN_STYLE}font-size:9px;color:#f97316;font-weight:700;width:auto;text-decoration:underline;">ver todos</button>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Itens neste grupo com responsável fora do time esperado:</div>
        ${itensCadastroErrado.slice(0,3).map(d => {
          const respsStr = (d._respsForasteiros || []).join(', ') || firstName(d.responsavel);
          return `<div style="font-size:10px;color:#f97316;padding:2px 0;border-bottom:1px solid rgba(249,115,22,.15);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${d.nome}">• <strong>${respsStr}</strong> — ${d.cliente || ''} ${d.nome}</div>`;
        }).join('')}
        ${itensCadastroErrado.length > 3 ? `<div style="font-size:9px;color:var(--text-muted);margin-top:4px;">...e mais ${itensCadastroErrado.length - 3} itens</div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${html}</div>`;
}

function renderPerformance() {
  const base = getPerfBase();
  if (base.length === 0) {
    document.getElementById('perf-departamentos-grid').innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Carregue os dados de Produção primeiro (clique em Atualizar Dados).</p>';
    return;
  }
  const hoje = new Date().toISOString().slice(0,10);
  const corte = getPerfCutoff();
  const periodoLabel = perfPeriodDias === 0 ? 'histórico completo' : `últimos ${perfPeriodDias} dias`;
  const EQUIPE_CORES = {
    'Paulo':['#3b82f6','#1d4ed8'],'Vinícius':['#22c55e','#15803d'],
    'Ewerton':['#ef4444','#b91c1c'],'Ewerton L.':['#ef4444','#b91c1c'],
    'Reriston':['#f97316','#c2410c'],'Thiago':['#a855f7','#7e22ce'],
    'Deivid':['#f59e0b','#b45309'],'Beatriz':['#ec4899','#be185d'],
    'Ademir':['#14b8a6','#0f766e'],'Tainara':['#06b6d4','#0e7490'],
    'Jady':['#84cc16','#4d7c0f'],'Victória':['#94a3b8','#475569']
  };

  // Garantir container de lista filtrada
  let filtroContainer = document.getElementById('perf-filtro-lista');
  if (!filtroContainer) {
    filtroContainer = document.createElement('div');
    filtroContainer.id = 'perf-filtro-lista';
    filtroContainer.style.cssText = 'display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px;';
    const perfDiv = document.getElementById('painel-performance').querySelector('.container');
    const sec1 = perfDiv.querySelector('.perf-section');
    perfDiv.insertBefore(filtroContainer, sec1);
  }

  // Calcular publicados e pendentes para o cache de filtros (ainda usado por togglePerfFiltro)
  const itensVeic = base.filter(d => d.veiculacao_iso && (!corte || d.veiculacao_iso >= corte));
  const itensVeicPassados = itensVeic.filter(d => d.veiculacao_iso < hoje);
  const publicados = itensVeicPassados.filter(d => STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const pendentesAtrasados = itensVeicPassados.filter(d => !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const itensPassados = base.filter(d => d.veiculacao_iso && d.veiculacao_iso <= hoje && (!corte || d.veiculacao_iso >= corte));
  const diasProdUnicos = [...new Set(itensPassados.map(d=>d.veiculacao_iso).filter(Boolean))].length || 1;

  // ================================================================
  // SEÇÃO 5: DEPARTAMENTOS
  // ================================================================
  renderDepartamentos(base, hoje, corte, periodoLabel);

  // ================================================================
  // SEÇÃO 4: GRÁFICOS CHART.JS
  // ================================================================
  // Dados por colaborador (excluir sem responsável)
  // Mapa de cores dos status do Monday
  const STATUS_CORES = {
    // Cores EXATAS extraídas via API do Monday.com (board 7829537690)
    'Em andamento':          '#fdab3d', // laranja
    'Em Andamento':          '#fdab3d', // laranja
    'Falta D.A':             '#4eccc6', // verde-água
    'Alteração':             '#df2f4a', // vermelho
    'Finalizado':            '#9cd326', // verde-limão
    'Aguardo':               '#9d50dd', // roxo
    'A Fazer':               '#c4c4c4', // cinza
    'Para agendar':          '#037f4c', // verde escuro
    'Para Agendar':          '#037f4c', // verde escuro
    'Para aprovação':        '#579bfc', // azul
    'Para Aprovação':        '#579bfc', // azul
    'Cap. Agendada':         '#ff007f', // rosa
    'Ag. Aprovação Cliente': '#faa1f1', // rosa claro
    'Ag. Aprovação Cliente': '#faa1f1', // rosa claro
    'Ag. Info Cliente':      '#bca58a', // bege
    'Falta Info':            '#ff6d3b', // laranja-vermelho
    'Agendando Cap':         '#ff5ac4', // rosa-magenta
    'Agendando Cap.':        '#ff5ac4', // rosa-magenta
    'Segurar Post':          '#7f5347', // marrom
    'Agendado':              '#a1e3f6', // azul bebê
    'Pode Fazer':            '#ffcb00', // amarelo
    // Status adicionais (não presentes no board mas usados no painel)
    'Ag. Interno':           '#bca58a', // bege (similar a Ag. Info Cliente)
    'Revisão':               '#fdab3d', // laranja
    'Aprovado':              '#9cd326', // verde-limão
    'Falta Briefing':        '#ff6d3b', // laranja-vermelho
    'default':               '#676879'  // cinza escuro
  };
  // Coletar todos os status únicos presentes nos dados
  // Usar o mesmo critério dos cards de departamento:
  // cada item pertence ao departamento pelo grupo do Monday,
  // e é atribuído aos responsáveis que pertencem ao time daquele departamento.
  const colaboradorStats = {}; // { resp: { total, porStatus: { status: count }, dept: id } }
  const statusPresentes = new Set();

  // Mapa de groupId → departamento
  const groupIdToDept = {};
  DEPT_CONFIG.forEach(dept => {
    dept.groupIds.forEach(gid => { groupIdToDept[gid] = dept; });
  });

  base.filter(d => {
    if (!d.veiculacao_iso && !d.prazo_iso) return false;
    const ref = d.veiculacao_iso || d.prazo_iso;
    if (corte && ref < corte) return false;
    return true;
  }).forEach(d => {
    const dept = groupIdToDept[d.group_id];
    // Todos os responsáveis do item
    const resps = (d.responsavel || '').split(',').map(r => r.trim().split(' ')[0]).filter(r => r && r !== '—');
    if (resps.length === 0) return;
    // Se o item tem departamento definido, usar apenas responsáveis do time daquele departamento
    // Se nenhum responsável pertence ao time, usar o primeiro (cadastro errado — ainda mostra)
    const respsDept = dept ? resps.filter(r => dept.pessoas.includes(r)) : [];
    const respList = respsDept.length > 0 ? respsDept : [resps[0]];
    const st = d.status || 'Sem status';
    statusPresentes.add(st);
    respList.forEach(resp => {
      if (!resp || resp === '—') return;
      if (!colaboradorStats[resp]) colaboradorStats[resp] = { total:0, porStatus:{}, dept: dept ? dept.id : null };
      // Evitar duplicar o mesmo item para a mesma pessoa
      if (!colaboradorStats[resp]._itens) colaboradorStats[resp]._itens = new Set();
      if (colaboradorStats[resp]._itens.has(d.id || d.nome)) return;
      colaboradorStats[resp]._itens.add(d.id || d.nome);
      colaboradorStats[resp].total++;
      colaboradorStats[resp].porStatus[st] = (colaboradorStats[resp].porStatus[st]||0) + 1;
    });
  });
  const colaboradores = Object.keys(colaboradorStats).sort((a,b) =>
    colaboradorStats[b].total - colaboradorStats[a].total
  );
  // Ordenar status: concluídos primeiro, depois por frequência
  const statusOrdenados = [...statusPresentes].sort((a,b) => {
    const aConc = STATUS_CONCLUIDO.some(s=>a.includes(s)) ? 0 : 1;
    const bConc = STATUS_CONCLUIDO.some(s=>b.includes(s)) ? 0 : 1;
    if (aConc !== bConc) return aConc - bConc;
    const aTotal = colaboradores.reduce((s,c)=>(colaboradorStats[c].porStatus[a]||0)+s, 0);
    const bTotal = colaboradores.reduce((s,c)=>(colaboradorStats[c].porStatus[b]||0)+s, 0);
    return bTotal - aTotal;
  });

  // Gráfico de linha: histórico dia a dia de publicações
  if (typeof Chart !== 'undefined') {
    // Coletar apenas dias com status FINALIZADO e veiculacao_iso ANTES de hoje (dias passados)
    const ontem = new Date(hoje); // hoje já é YYYY-MM-DD string, comparar < hoje exclui hoje
    const diasMap = {};
    base.filter(d => {
      if (!d.veiculacao_iso) return false;
      // Apenas dias estritamente anteriores a hoje
      if (d.veiculacao_iso >= hoje) return false;
      if (corte && d.veiculacao_iso < corte) return false;
      // Apenas itens com status FINALIZADO
      const isFinalizado = STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      return isFinalizado;
    }).forEach(d => {
      diasMap[d.veiculacao_iso] = (diasMap[d.veiculacao_iso] || 0) + 1;
    });
    const diasOrdenados = Object.keys(diasMap).sort();
    const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const diasLabels = diasOrdenados.map(s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    });
    const diasValues = diasOrdenados.map(d => diasMap[d]);
    // Média móvel de 7 dias — apenas sobre dias passados (todos os pontos já são passados)
    const mediaMovel = diasValues.map((_, i) => {
      // Usar apenas os 6 dias anteriores + o próprio dia (nunca dias futuros)
      const slice = diasValues.slice(Math.max(0, i-6), i+1);
      return Math.round((slice.reduce((a,b)=>a+b,0)/slice.length)*10)/10;
    });
    const ctxDiario = document.getElementById('chart-diario').getContext('2d');
    if (perfChartDiario) perfChartDiario.destroy();
    perfChartDiario = new Chart(ctxDiario, {
      type: 'line',
      data: {
        labels: diasLabels,
        datasets: [
          {
            label: 'Posts veiculados',
            data: diasValues,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168,85,247,.15)',
            fill: true,
            tension: 0.3,
            pointRadius: diasOrdenados.length > 60 ? 0 : 3,
            pointHoverRadius: 5,
            borderWidth: 2
          },
          {
            label: 'Média móvel (7d)',
            data: mediaMovel,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [4,3]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode:'index', intersect:false },
        plugins: {
          legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return diasOrdenados[idx] ? diasOrdenados[idx].split('-').reverse().join('/') : items[0].label;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color:'#8888a8', font:{size:10},
              maxTicksLimit: 20,
              maxRotation: 45
            },
            grid: { color:'#2a2a38' }
          },
          y: {
            ticks: { color:'#8888a8', font:{size:10} },
            grid: { color:'#2a2a38' },
            beginAtZero: true,
            title: { display:true, text:'Posts', color:'#8888a8', font:{size:10} }
          }
        }
      }
    });
  }

  // Gráfico de linha: volume de produção por prazo — passado (sólido) + futuro (tracejado)
  if (typeof Chart !== 'undefined') {
    const DIAS_SEMANA2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    // Coletar todos os dias com prazo (passado e futuro)
    const prazoPassadoMap = {}; // dias < hoje
    const prazoFuturoMap  = {}; // dias >= hoje
    // Para o futuro: mostrar sempre os próximos 60 dias a partir de hoje
    const hojeDate2 = new Date(hoje + 'T00:00:00');
    const futuro60 = new Date(hojeDate2); futuro60.setDate(futuro60.getDate() + 60);
    const futuro60iso = futuro60.toISOString().slice(0,10);
    base.forEach(d => {
      if (!d.prazo_iso) return;
      if (d.prazo_iso < hoje) {
        // Passado: respeitar corte de período
        if (corte && d.prazo_iso < corte) return;
        prazoPassadoMap[d.prazo_iso] = (prazoPassadoMap[d.prazo_iso] || 0) + 1;
      } else {
        // Futuro: até 60 dias
        if (d.prazo_iso > futuro60iso) return;
        prazoFuturoMap[d.prazo_iso] = (prazoFuturoMap[d.prazo_iso] || 0) + 1;
      }
    });
    // Unir todos os dias em ordem cronológica
    const todosDiasPrazo = [...new Set([...Object.keys(prazoPassadoMap), ...Object.keys(prazoFuturoMap)])].sort();
    const labelFnPrazo = s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA2[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    };
    const prazoLabels = todosDiasPrazo.map(labelFnPrazo);
    // Dataset passado: valor nos dias passados, null nos futuros
    const prazoPassadoData = todosDiasPrazo.map(d => d < hoje ? (prazoPassadoMap[d] || 0) : null);
    // Dataset futuro: null nos passados, valor nos futuros
    const prazoFuturoData  = todosDiasPrazo.map(d => d >= hoje ? (prazoFuturoMap[d] || 0) : null);
    // Média móvel 7d apenas sobre o passado
    const prazoMediaMovel = todosDiasPrazo.map((d, i) => {
      if (d >= hoje) return null;
      const vals = [];
      for (let j = Math.max(0, i-6); j <= i; j++) {
        const v = prazoPassadoData[j];
        if (v !== null) vals.push(v);
      }
      return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
    });
    const ctxDiarioPrazo = document.getElementById('chart-diario-prazo');
    if (ctxDiarioPrazo) {
      if (perfChartDiarioPrazo) perfChartDiarioPrazo.destroy();
      perfChartDiarioPrazo = new Chart(ctxDiarioPrazo.getContext('2d'), {
        type: 'line',
        data: {
          labels: prazoLabels,
          datasets: [
            {
              label: 'Passado (prazos vencidos)',
              data: prazoPassadoData,
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.12)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasPrazo.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              spanGaps: false
            },
            {
              label: 'Futuro (prazos agendados)',
              data: prazoFuturoData,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96,165,250,.08)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasPrazo.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              borderDash: [5,4],
              spanGaps: false
            },
            {
              label: 'Média móvel 7d (passado)',
              data: prazoMediaMovel,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [4,3],
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const iso = todosDiasPrazo[idx];
                  const label = iso ? iso.split('-').reverse().join('/') : items[0].label;
                  return iso >= hoje ? `📅 ${label} (futuro)` : `⏳ ${label} (passado)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color:'#8888a8', font:{size:10}, maxTicksLimit:25, maxRotation:45 },
              grid: { color:'#2a2a38' }
            },
            y: {
              ticks: { color:'#8888a8', font:{size:10} },
              grid: { color:'#2a2a38' },
              beginAtZero: true,
              title: { display:true, text:'Itens', color:'#8888a8', font:{size:10} }
            }
          }
        }
      });
    }
  }

  // Gráfico de linha: Volume de Veiculação por Dia (passado + futuro + média móvel)
  if (typeof Chart !== 'undefined') {
    const veicPassadoMap = {};
    const veicFuturoMap  = {};
    const futuro60iso = new Date(new Date().getTime() + 60*86400000).toISOString().slice(0,10);
    base.forEach(d => {
      if (!d.veiculacao_iso) return;
      if (d.veiculacao_iso < hoje) {
        // Passado: respeita corte
        if (corte && d.veiculacao_iso < corte) return;
        veicPassadoMap[d.veiculacao_iso] = (veicPassadoMap[d.veiculacao_iso] || 0) + 1;
      } else {
        // Futuro: até 60 dias
        if (d.veiculacao_iso > futuro60iso) return;
        veicFuturoMap[d.veiculacao_iso] = (veicFuturoMap[d.veiculacao_iso] || 0) + 1;
      }
    });
    const todosDiasVeic = [...new Set([...Object.keys(veicPassadoMap), ...Object.keys(veicFuturoMap)])].sort();
    const DIAS_SEMANA_VEIC = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const labelFnVeic = s => {
      const dt = new Date(s + 'T00:00:00');
      const diaSem = DIAS_SEMANA_VEIC[dt.getDay()];
      const dia = String(dt.getDate()).padStart(2,'0');
      const mes = String(dt.getMonth()+1).padStart(2,'0');
      return `${diaSem} ${dia}/${mes}`;
    };
    const veicLabels = todosDiasVeic.map(labelFnVeic);
    const veicPassadoData = todosDiasVeic.map(d => d < hoje ? (veicPassadoMap[d] || 0) : null);
    const veicFuturoData  = todosDiasVeic.map(d => d >= hoje ? (veicFuturoMap[d] || 0) : null);
    const veicMediaMovel  = todosDiasVeic.map((d, i) => {
      if (d >= hoje) return null;
      const vals = [];
      for (let j = Math.max(0, i-6); j <= i; j++) {
        const v = veicPassadoData[j];
        if (v !== null) vals.push(v);
      }
      return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
    });
    const ctxDiarioVeic = document.getElementById('chart-diario-veiculacao');
    if (ctxDiarioVeic) {
      if (perfChartDiarioVeiculacao) perfChartDiarioVeiculacao.destroy();
      perfChartDiarioVeiculacao = new Chart(ctxDiarioVeic.getContext('2d'), {
        type: 'line',
        data: {
          labels: veicLabels,
          datasets: [
            {
              label: 'Passado (veiculações realizadas)',
              data: veicPassadoData,
              borderColor: '#a78bfa',
              backgroundColor: 'rgba(167,139,250,.12)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasVeic.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              spanGaps: false
            },
            {
              label: 'Futuro (veiculações agendadas)',
              data: veicFuturoData,
              borderColor: '#f97316',
              backgroundColor: 'rgba(249,115,22,.08)',
              fill: true,
              tension: 0.3,
              pointRadius: todosDiasVeic.length > 80 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              borderDash: [5,4],
              spanGaps: false
            },
            {
              label: 'Média móvel 7d (passado)',
              data: veicMediaMovel,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [4,3],
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode:'index', intersect:false },
          plugins: {
            legend: { labels: { color:'#8888a8', font:{size:11}, boxWidth:14 } },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const iso = todosDiasVeic[idx];
                  const label = iso ? iso.split('-').reverse().join('/') : items[0].label;
                  return iso >= hoje ? `📅 ${label} (futuro)` : `⏳ ${label} (passado)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color:'#8888a8', font:{size:10}, maxTicksLimit:25, maxRotation:45 },
              grid: { color:'#2a2a38' }
            },
            y: {
              ticks: { color:'#8888a8', font:{size:10} },
              grid: { color:'#2a2a38' },
              beginAtZero: true,
              title: { display:true, text:'Itens', color:'#8888a8', font:{size:10} }
            }
          }
        }
      });
    }
  }

  // Gráfico barras horizontais por colaborador — por status real do Monday
  if (typeof Chart !== 'undefined') {
    const ctxColaborador = document.getElementById('chart-colaborador').getContext('2d');
    if (perfChartColaborador) perfChartColaborador.destroy();
    // Usar cor exata do Monday para cada status; adicionar opacidade 0.85 para não ficar sólido demais
    const datasetsColaborador = statusOrdenados.map(st => {
      const corBase = STATUS_CORES[st] || STATUS_CORES['default'];
      return {
        label: st,
        data: colaboradores.map(n => colaboradorStats[n].porStatus[st] || 0),
        backgroundColor: corBase,
        borderColor: corBase,
        borderWidth: 0,
        borderRadius: 3,
        borderSkipped: false
      };
    });
    // Altura dinâmica baseada no número de colaboradores
    const alturaColaborador = Math.max(280, colaboradores.length * 32 + 60);
    const canvasCol = document.getElementById('chart-colaborador');
    if (canvasCol) canvasCol.parentElement.style.height = alturaColaborador + 'px';
    perfChartColaborador = new Chart(ctxColaborador, {
      type: 'bar',
      data: {
        labels: colaboradores,
        datasets: datasetsColaborador
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const nomeColaborador = colaboradores[el.index];
          const statusClicado = statusOrdenados[el.datasetIndex];
          // Filtrar itens desta pessoa com este status
          const itensFiltrados = base.filter(d => {
            const resp = firstName(d.responsavel);
            return resp === nomeColaborador && d.status === statusClicado;
          }).sort((a,b) => {
            const da = a.prazo_iso || a.veiculacao_iso || '';
            const db = b.prazo_iso || b.veiculacao_iso || '';
            return da < db ? -1 : da > db ? 1 : 0;
          });
          showDeptFiltro(`${nomeColaborador} — ${statusClicado} (${itensFiltrados.length})`, itensFiltrados);
        },
        plugins: {
          legend: {
            labels: {
              color:'#8888a8', font:{size:10}, boxWidth:12,
              filter: (item) => {
                return datasetsColaborador[item.datasetIndex]?.data.some(v => v > 0);
              }
            },
            onClick: (e, legendItem) => {
              // Clicar na legenda filtra todos os itens com aquele status
              const statusClicado = statusOrdenados[legendItem.datasetIndex];
              const itensFiltrados = base.filter(d => d.status === statusClicado)
                .sort((a,b) => {
                  const da = a.prazo_iso || a.veiculacao_iso || '';
                  const db = b.prazo_iso || b.veiculacao_iso || '';
                  return da < db ? -1 : da > db ? 1 : 0;
                });
              showDeptFiltro(`Status: ${statusClicado} (${itensFiltrados.length})`, itensFiltrados);
            }
          },
          tooltip: {
            mode:'index', intersect:false,
            callbacks: {
              title: (items) => `${colaboradores[items[0].dataIndex]} — clique para filtrar`,
              label: (ctx) => {
                if (ctx.raw === 0) return null;
                return ` ${ctx.dataset.label}: ${ctx.raw}`;
              }
            },
            filter: (item) => item.raw > 0
          }
        },
        scales: {
          x: { stacked:true, ticks:{color:'#8888a8',font:{size:10}}, grid:{color:'#2a2a38'} },
          y: { stacked:true, ticks:{color:'#e8e8f0',font:{size:11}}, grid:{color:'#2a2a38'} }
        }
      }
    });

    // Gráfico comparativo semanal — PRAZO em atraso (contínuo) e VEICULACÃO em atraso (pontilhado) por pessoa
    const EQUIPE_CHART_COLORS = {
      'Thiago':   '#3b82f6',
      'Deivid':   '#22c55e',
      'Tainara':  '#ef4444',
      'Vinícius': '#f97316',
      'Ademir':   '#a855f7',
      'Victória': '#f59e0b',
      'Reriston': '#ec4899',
      'Jady':     '#14b8a6',
      'Beatriz':  '#06b6d4',
      'Paulo':    '#84cc16',
      'Ewerton':  '#94a3b8',
      'Manus':    '#e879f9'
    };

    // Coletar semanas a partir de prazo_iso e veiculacao_iso (apenas passados)
    const semanasSetSem = new Set();
    const prazoPorPessoa = {};   // { nome: { semKey: count } } — itens com prazo vencido
    const veicPorPessoa = {};    // { nome: { semKey: count } } — itens com veiculacao vencida

    base.forEach(d => {
      const resp = firstName(d.responsavel);
      if (!resp || resp === '—') return;
      const isConcluido = STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      if (isConcluido) return; // só conta itens EM ATRASO (não finalizados)

      // Atraso de prazo
      if (d.prazo_iso && d.prazo_iso < hoje) {
        if (!corte || d.prazo_iso >= corte) {
          const dt = new Date(d.prazo_iso + 'T00:00:00');
          const dow = dt.getDay() || 7;
          const mon = new Date(dt); mon.setDate(dt.getDate() - dow + 1);
          const semKey = mon.toISOString().slice(0,10);
          semanasSetSem.add(semKey);
          if (!prazoPorPessoa[resp]) prazoPorPessoa[resp] = {};
          prazoPorPessoa[resp][semKey] = (prazoPorPessoa[resp][semKey]||0) + 1;
        }
      }

      // Atraso de veiculacao
      if (d.veiculacao_iso && d.veiculacao_iso < hoje) {
        if (!corte || d.veiculacao_iso >= corte) {
          const dt = new Date(d.veiculacao_iso + 'T00:00:00');
          const dow = dt.getDay() || 7;
          const mon = new Date(dt); mon.setDate(dt.getDate() - dow + 1);
          const semKey = mon.toISOString().slice(0,10);
          semanasSetSem.add(semKey);
          if (!veicPorPessoa[resp]) veicPorPessoa[resp] = {};
          veicPorPessoa[resp][semKey] = (veicPorPessoa[resp][semKey]||0) + 1;
        }
      }
    });

    const semanas = [...semanasSetSem].sort();
    const semanaLabels = semanas.map(s => {
      const d = new Date(s + 'T00:00:00');
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    // Pessoas que têm pelo menos 1 atraso de prazo ou veiculacao
    const pessoasComAtraso = colaboradores.filter(n =>
      Object.values(prazoPorPessoa[n]||{}).some(v=>v>0) ||
      Object.values(veicPorPessoa[n]||{}).some(v=>v>0)
    );

    // Gerar datasets: linha contínua = prazo, pontilhada = veiculacao
    const datasetsSemanais = [];
    pessoasComAtraso.forEach(nome => {
      const cor = EQUIPE_CHART_COLORS[nome] || '#8888a8';
      const temPrazo = Object.values(prazoPorPessoa[nome]||{}).some(v=>v>0);
      const temVeic = Object.values(veicPorPessoa[nome]||{}).some(v=>v>0);
      // Linha contínua: prazo em atraso
      if (temPrazo) {
        datasetsSemanais.push({
          label: `${nome} (prazo)`,
          data: semanas.map(s => (prazoPorPessoa[nome]||{})[s] || 0),
          borderColor: cor,
          backgroundColor: cor + '22',
          borderDash: [],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          _nome: nome,
          _tipo: 'prazo'
        });
      }
      // Linha pontilhada: veiculacao em atraso
      if (temVeic) {
        datasetsSemanais.push({
          label: `${nome} (veic.)`,
          data: semanas.map(s => (veicPorPessoa[nome]||{})[s] || 0),
          borderColor: cor,
          backgroundColor: cor + '11',
          borderDash: [6, 4],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointStyle: 'rectRot',
          _nome: nome,
          _tipo: 'veic'
        });
      }
    });

    const ctxSemanal = document.getElementById('chart-semanal').getContext('2d');
    if (perfChartSemanal) perfChartSemanal.destroy();
    window._semanas = semanas;
    window._semanaLabels = semanaLabels;
    window._prazoPorPessoa = prazoPorPessoa;
    window._veicPorPessoa = veicPorPessoa;
    window._datasetsSemanais = datasetsSemanais;

    perfChartSemanal = new Chart(ctxSemanal, {
      type: 'line',
      data: { labels: semanaLabels, datasets: datasetsSemanais },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event, elements) => {
          event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        onClick: (event, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const ds = datasetsSemanais[el.datasetIndex];
          const semKey = semanas[el.index];
          const semLabel = semanaLabels[el.index];
          const dtSeg = new Date(semKey + 'T00:00:00');
          const dtDom = new Date(dtSeg); dtDom.setDate(dtSeg.getDate() + 6);
          const fimSem = dtDom.toISOString().slice(0,10);
          let itensFiltrados, label;
          if (ds._tipo === 'prazo') {
            itensFiltrados = base.filter(d => {
              if (firstName(d.responsavel) !== ds._nome) return false;
              if (!d.prazo_iso || d.prazo_iso >= hoje) return false;
              if (STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) return false;
              return d.prazo_iso >= semKey && d.prazo_iso <= fimSem;
            }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
            label = `${ds._nome} — prazo em atraso — semana ${semLabel} (${itensFiltrados.length})`;
          } else {
            itensFiltrados = base.filter(d => {
              if (firstName(d.responsavel) !== ds._nome) return false;
              if (!d.veiculacao_iso || d.veiculacao_iso >= hoje) return false;
              if (STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s))) return false;
              return d.veiculacao_iso >= semKey && d.veiculacao_iso <= fimSem;
            }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
            label = `${ds._nome} — veicul. em atraso — semana ${semLabel} (${itensFiltrados.length})`;
          }
          showDeptFiltro(label, itensFiltrados);
        },
        plugins: {
          legend: {
            labels: { color:'#8888a8', font:{size:10}, boxWidth:12,
              generateLabels: (chart) => {
                // Agrupar por pessoa: mostrar 1 entrada com — e indicar contínuo/pontilhado
                return chart.data.datasets.map((ds, i) => ({
                  text: ds.label,
                  fillStyle: ds.borderColor,
                  strokeStyle: ds.borderColor,
                  lineWidth: 2,
                  lineDash: ds.borderDash,
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i
                }));
              }
            },
            onClick: (e, legendItem, legend) => {
              const ds = datasetsSemanais[legendItem.datasetIndex];
              let itensFiltrados, label;
              if (ds._tipo === 'prazo') {
                itensFiltrados = base.filter(d => {
                  if (firstName(d.responsavel) !== ds._nome) return false;
                  if (!d.prazo_iso || d.prazo_iso >= hoje) return false;
                  return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
                }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
                label = `${ds._nome} — todos com prazo em atraso (${itensFiltrados.length})`;
              } else {
                itensFiltrados = base.filter(d => {
                  if (firstName(d.responsavel) !== ds._nome) return false;
                  if (!d.veiculacao_iso || d.veiculacao_iso >= hoje) return false;
                  return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
                }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
                label = `${ds._nome} — todos com veicul. em atraso (${itensFiltrados.length})`;
              }
              showDeptFiltro(label, itensFiltrados);
            }
          },
          tooltip: {
            mode:'index', intersect:false,
            callbacks: {
              title: (items) => `Semana de ${semanaLabels[items[0].dataIndex]}`,
              label: (ctx) => {
                const ds = datasetsSemanais[ctx.datasetIndex];
                const tipo = ds._tipo === 'prazo' ? 'prazo em atraso' : 'veicul. em atraso';
                return ` ${ds._nome} (${tipo}): ${ctx.raw}`;
              }
            }
          }
        },
        scales: {
          x: { ticks:{color:'#8888a8',font:{size:10}}, grid:{color:'#2a2a38'} },
          y: {
            ticks:{color:'#8888a8',font:{size:10}},
            grid:{color:'#2a2a38'},
            beginAtZero:true,
            title:{display:true,text:'Itens em atraso',color:'#8888a8',font:{size:10}}
          }
        }
      }
    });
  }

  // Tabela de detalhamento por colaborador
  const tabelaRows = colaboradores.map(nome => {
    const s = colaboradorStats[nome];
    const total = s.total;
    const cores = EQUIPE_CORES[nome] || ['#7c3aed','#5b21b6'];

    // Calcular atrasos de prazo desta pessoa
    const atrasadosPrazoPessoa = base.filter(d => {
      if (firstName(d.responsavel) !== nome) return false;
      const ref = d.prazo_iso;
      if (!ref || ref >= hoje) return false;
      return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
    });
    const pctPrazo = total > 0 ? Math.round((atrasadosPrazoPessoa.length / total) * 100) : 0;
    const corPrazo = pctPrazo === 0 ? '#22c55e' : pctPrazo <= 20 ? '#f97316' : '#ef4444';

    // Calcular atrasos de veiculacao desta pessoa
    const atrasadosVeicPessoa = base.filter(d => {
      if (firstName(d.responsavel) !== nome) return false;
      const ref = d.veiculacao_iso;
      if (!ref || ref >= hoje) return false;
      return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
    });
    const pctVeic = total > 0 ? Math.round((atrasadosVeicPessoa.length / total) * 100) : 0;
    const corVeic = pctVeic === 0 ? '#22c55e' : pctVeic <= 20 ? '#f97316' : '#ef4444';

    // Gerar pills de status clicáveis para esta pessoa
    const statusPills = Object.entries(s.porStatus)
      .sort((a,b) => b[1]-a[1])
      .map(([st, cnt]) => {
        const cor = STATUS_CORES[st] || STATUS_CORES['default'];
        const itensSt = base.filter(d => firstName(d.responsavel) === nome && d.status === st)
          .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
        const payload = encodeURIComponent(JSON.stringify({ nome, st, label: `${nome} — ${st} (${cnt})` }));
        return `<span onclick="handleTabelaFiltro(event,'status','${payload}')" style="display:inline-block;background:${cor}22;color:${cor};border:1px solid ${cor}44;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin:1px;cursor:pointer;transition:opacity .15s;" onmouseenter="this.style.opacity='.7'" onmouseleave="this.style.opacity='1'">${st} ${cnt}</span>`;
      }).join('');

    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px 12px;font-weight:700;color:${cores[0]};cursor:pointer;" onclick="handleTabelaFiltro(event,'pessoa','${encodeURIComponent(nome)}')" title="Ver todos os itens de ${nome}">${nome}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:700;color:var(--text);cursor:pointer;" onclick="handleTabelaFiltro(event,'pessoa','${encodeURIComponent(nome)}')" title="Ver todos os itens de ${nome}">${total}</td>
      <td style="padding:8px 12px;">${statusPills}</td>
      <td style="padding:8px 12px;min-width:110px;">
        <div onclick="handleTabelaFiltro(event,'prazo_atraso','${encodeURIComponent(nome)}')" title="Ver ${atrasadosPrazoPessoa.length} itens com prazo em atraso" style="cursor:pointer;padding:4px 8px;border-radius:6px;background:${corPrazo}18;border:1px solid ${corPrazo}44;text-align:center;transition:background .15s;" onmouseenter="this.style.background='${corPrazo}33'" onmouseleave="this.style.background='${corPrazo}18'">
          <div style="font-size:14px;font-weight:800;color:${corPrazo};">${atrasadosPrazoPessoa.length}</div>
          <div style="font-size:9px;color:${corPrazo};opacity:.8;">⏰ ${pctPrazo}% do total</div>
        </div>
      </td>
      <td style="padding:8px 12px;min-width:110px;">
        <div onclick="handleTabelaFiltro(event,'veic_atraso','${encodeURIComponent(nome)}')" title="Ver ${atrasadosVeicPessoa.length} itens com veiculação em atraso" style="cursor:pointer;padding:4px 8px;border-radius:6px;background:${corVeic}18;border:1px solid ${corVeic}44;text-align:center;transition:background .15s;" onmouseenter="this.style.background='${corVeic}33'" onmouseleave="this.style.background='${corVeic}18'">
          <div style="font-size:14px;font-weight:800;color:${corVeic};">${atrasadosVeicPessoa.length}</div>
          <div style="font-size:9px;color:${corVeic};opacity:.8;">📅 ${pctVeic}% do total</div>
        </div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('perf-tabela-colaborador').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:var(--surface2);">
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:700;font-size:11px;">Colaborador</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">Total</th>
          <th style="padding:8px 12px;text-align:left;color:var(--text-muted);font-weight:700;font-size:11px;">Status</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">⏰ Prazo em Atraso</th>
          <th style="padding:8px 12px;text-align:center;color:var(--text-muted);font-weight:700;font-size:11px;">📅 Veiculação em Atraso</th>
        </tr>
      </thead>
      <tbody>${tabelaRows}</tbody>
    </table>
  `;

  // Handler para filtros da tabela de detalhamento
  window.handleTabelaFiltro = function(event, tipo, payload) {
    event.stopPropagation();
    const nome = decodeURIComponent(payload);
    let itens, label;
    if (tipo === 'pessoa') {
      itens = base.filter(d => firstName(d.responsavel) === nome)
        .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
      label = `${nome} — todos os itens (${itens.length})`;
    } else if (tipo === 'prazo_atraso') {
      itens = base.filter(d => {
        if (firstName(d.responsavel) !== nome) return false;
        const ref = d.prazo_iso;
        if (!ref || ref >= hoje) return false;
        return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      }).sort((a,b) => (a.prazo_iso||'') < (b.prazo_iso||'') ? -1 : 1);
      label = `${nome} — prazo em atraso (${itens.length})`;
    } else if (tipo === 'veic_atraso') {
      itens = base.filter(d => {
        if (firstName(d.responsavel) !== nome) return false;
        const ref = d.veiculacao_iso;
        if (!ref || ref >= hoje) return false;
        return !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s));
      }).sort((a,b) => (a.veiculacao_iso||'') < (b.veiculacao_iso||'') ? -1 : 1);
      label = `${nome} — veiculação em atraso (${itens.length})`;
    } else if (tipo === 'status') {
      try {
        const obj = JSON.parse(decodeURIComponent(payload));
        itens = base.filter(d => firstName(d.responsavel) === obj.nome && d.status === obj.st)
          .sort((a,b) => (a.prazo_iso||a.veiculacao_iso||'') < (b.prazo_iso||b.veiculacao_iso||'') ? -1 : 1);
        label = obj.label;
      } catch(e) { return; }
    }
    if (itens && itens.length >= 0) showDeptFiltro(label, itens);
  };

  // Cache de itens para filtros clicáveis
  const atrasadosPrazo = base.filter(d => d.prazo_iso && d.prazo_iso < hoje && !STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  const concluidosNoPrazo = base.filter(d => STATUS_CONCLUIDO.some(s => d.status && d.status.includes(s)));
  window.perfFiltroCache = {
    atrasados: atrasadosPrazo,
    concluidos: concluidosNoPrazo,
    pendentesVeic: pendentesAtrasados,
    publicados: publicados
  };

  // Restaurar estado do filtro ativo se houver
  if (perfFiltroAtivo && window.perfFiltroCache[perfFiltroAtivo]) {
    renderPerfFiltradoLista(window.perfFiltroCache[perfFiltroAtivo]);
    document.querySelectorAll('.perf-kpi-clickable').forEach(el => {
      el.style.outline = el.dataset.filtro === perfFiltroAtivo ? '2px solid var(--accent2)' : 'none';
      el.style.transform = el.dataset.filtro === perfFiltroAtivo ? 'scale(1.03)' : 'scale(1)';
    });
  }
}

