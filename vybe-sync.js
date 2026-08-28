// vybe-sync.js — espelho operacional: cache, reconciliação incremental e refresh
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Cache operacional e reconciliação incremental ─────────────────────────
// O cache guarda somente dados já normalizados. Ele acelera a abertura, mas nunca
// substitui a conferência com o Monday: a base é reconciliada em segundo plano.
const PRODUCTION_CACHE_KEY = 'vybe_os_production_cache_v2';
const PRODUCTION_CACHE_SCHEMA = 2;
const PRODUCTION_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let productionCacheHydrated = false;
let productionCacheSyncing = false;
const OPERATIONAL_MIRROR_API = '/api/operational-mirror';
const OPERATIONAL_MIRROR_VERSION_KEY = 'vybe_os_operational_mirror_version_v1';
let operationalMirrorVersion = Number(localStorage.getItem(OPERATIONAL_MIRROR_VERSION_KEY) || 0);
let operationalMirrorUnavailable = false;
let operationalMirrorTimer = null;
let operationalMirrorRequestRunning = false;
let operationalMirrorFailures = 0;
let operationalMirrorNextAttemptAt = 0;
const OPERATIONAL_MIRROR_VISIBLE_INTERVAL = 15000;
const OPERATIONAL_MIRROR_HIDDEN_INTERVAL = 60000;

const SYNC_HEALTH_STORAGE_KEY = 'vybe_os_sync_health_last_confirmed_v1';
const SYNC_HEALTH_MAX_AGE = 5 * 60 * 1000;
let syncHealthLastConfirmedAt = Number(localStorage.getItem(SYNC_HEALTH_STORAGE_KEY) || 0);
let syncHealthState = 'checking';
function ensureSyncHealthIndicator() {
  let el = document.getElementById('sync-health-indicator');
  if (el) return el;
  el = document.createElement('button');
  el.type = 'button'; el.id = 'sync-health-indicator'; el.className = 'sync-health-indicator checking';
  el.setAttribute('aria-live','polite');
  el.innerHTML = `<i class="sync-health-dot"></i><span class="sync-health-copy"><b>CONFERINDO DADOS</b><span>Verificando a operação…</span></span><span class="sync-health-action">↻ TENTAR</span>`;
  el.addEventListener('click', () => refreshProducao());
  document.body.appendChild(el);
  return el;
}
function syncHealthClock(timestamp) {
  if (!timestamp) return 'sem confirmação registrada';
  try { return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(timestamp)); }
  catch(e) { return 'hora indisponível'; }
}
function setSyncHealth(state='checking', detail='') {
  syncHealthState = state;
  const el = ensureSyncHealthIndicator();
  const title = el.querySelector('b'), message = el.querySelector('.sync-health-copy span'), action = el.querySelector('.sync-health-action');
  el.className = `sync-health-indicator ${state}`;
  if (state === 'healthy') {
    syncHealthLastConfirmedAt = Date.now();
    localStorage.setItem(SYNC_HEALTH_STORAGE_KEY, String(syncHealthLastConfirmedAt));
    title.textContent = 'DADOS CONFIRMADOS';
    message.textContent = detail || `Última confirmação às ${syncHealthClock(syncHealthLastConfirmedAt)}`;
    action.textContent = '↻ ATUALIZAR';
  } else if (state === 'stale') {
    title.textContent = 'ATENÇÃO · DADOS DESATUALIZADOS';
    message.textContent = detail || `Sem confirmação desde ${syncHealthClock(syncHealthLastConfirmedAt)}. Não tome decisões sem atualizar.`;
    action.textContent = '↻ ATUALIZAR AGORA';
  } else if (state === 'error') {
    title.textContent = 'ERRO DE SINCRONIZAÇÃO';
    message.textContent = detail || `Última confirmação: ${syncHealthClock(syncHealthLastConfirmedAt)}. A operação pode estar desatualizada.`;
    action.textContent = '↻ TENTAR AGORA';
  } else {
    title.textContent = 'CONFERINDO DADOS';
    message.textContent = detail || `Última confirmação: ${syncHealthClock(syncHealthLastConfirmedAt)}`;
    action.textContent = '↻ ATUALIZAR';
  }
}
function refreshSyncHealthAge() {
  if (syncHealthState === 'error' || syncHealthState === 'checking') return;
  if (!syncHealthLastConfirmedAt || Date.now() - syncHealthLastConfirmedAt > SYNC_HEALTH_MAX_AGE) setSyncHealth('stale');
}
setInterval(refreshSyncHealthAge, 30000);
function cacheSyncLabel(text) {
  const footer = document.getElementById('footer-update');
  if (footer && text) footer.textContent = text;
}
function cacheClock(iso) {
  try { return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }
  catch(e) { return ''; }
}
function cachePayloadIsValid(payload) {
  return !!(payload && payload.schema === PRODUCTION_CACHE_SCHEMA && Array.isArray(payload.items) && payload.items.length && payload.saved_at && (Date.now() - new Date(payload.saved_at).getTime()) < PRODUCTION_CACHE_MAX_AGE);
}
function loadProductionCache() {
  try {
    const payload = JSON.parse(localStorage.getItem(PRODUCTION_CACHE_KEY) || 'null');
    return cachePayloadIsValid(payload) ? payload : null;
  } catch(e) { return null; }
}
function saveProductionCache() {
  if (!Array.isArray(DADOS_ALL) || !DADOS_ALL.length) return;
  try {
    localStorage.setItem(PRODUCTION_CACHE_KEY, JSON.stringify({
      schema: PRODUCTION_CACHE_SCHEMA,
      saved_at: new Date().toISOString(),
      items: DADOS_ALL,
      status_options: STATUS_OPTIONS
    }));
  } catch(e) {
    console.warn('Cache operacional indisponível:', e);
  }
}
function visibleProductionItems(items, meta) {
  const weeks = meta?.weeks || [];
  return (items || []).filter(item => {
    const refs = [item.veiculacao_iso, item.prazo_iso].filter(Boolean);
    return refs.some(iso => weeks.some(week => iso >= week.startIso && iso <= week.endIso));
  }).map(item => ({...item}));
}
function applyCachedProductionDataset(items, statusOptions=[]) {
  META = calcWeeks();
  HOJE_ISO = META.today_iso;
  updateMonthNav();
  DADOS_ALL = (items || []).map(item => ({...item}));
  DADOS = visibleProductionItems(DADOS_ALL, META);
  if (Array.isArray(statusOptions) && statusOptions.length) STATUS_OPTIONS = statusOptions;
  recalcSemanas();
  syncStatusLegendColors('#status-legend', DADOS_ALL);
  applyOperationalRisk(DADOS);
  applyOperationalRisk(DADOS_ALL);
  DIAS_SEMANAS = META.weeks.map(w => buildDias(w.startIso, w.endIso, META.today_iso));
  DIAS_S1 = DIAS_SEMANAS[0] || [];
  DIAS_S2 = DIAS_SEMANAS[1] || [];
  const badgeS1 = document.getElementById('badge-s1');
  const badgeS2 = document.getElementById('badge-s2');
  const badgeHoje = document.getElementById('badge-hoje');
  if (badgeS1) badgeS1.textContent = `S${META.currentWeekIdx+1} · ${META.weeks[META.currentWeekIdx].startFmt}–${META.weeks[META.currentWeekIdx].endFmt}`;
  if (badgeS2) badgeS2.textContent = `S${META.currentWeekIdx+2} · ${META.weeks[Math.min(META.currentWeekIdx+1, META.weeks.length-1)].startFmt}–${META.weeks[Math.min(META.currentWeekIdx+1, META.weeks.length-1)].endFmt}`;
  if (badgeHoje) badgeHoje.textContent = `Hoje: ${META.today}`;
  const footer = document.getElementById('footer-update');
  if (footer) footer.textContent = `Cache operacional: ${META.generated_at}`;
  const numLabels = ['01','02','03','04','05','06'];
  for (let t=1; t<=6; t++) { const tab=document.getElementById(`tab-s${t}-label`); if (tab) tab.style.display='none'; }
  META.weeks.forEach((week,index) => {
    const n=index+1, tab=document.getElementById(`tab-s${n}-label`), title=document.getElementById(`title-s${n}`);
    if (tab) { tab.textContent=`📅 Semana ${numLabels[index]} — ${week.startFmt} a ${week.endFmt}${index===META.currentWeekIdx?' ★':''}`; tab.style.display=''; }
    if (title) title.textContent=`Clientes — Semana ${numLabels[index]} (${week.startFmt}–${week.endFmt})`;
  });
  const activeTabN = META.currentWeekIdx + 1;
  document.querySelectorAll('.tab-btn').forEach(button => button.classList.remove('active'));
  document.querySelectorAll('.week-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`tab-s${activeTabN}-label`)?.classList.add('active');
  document.getElementById(`panel-week${activeTabN}`)?.classList.add('active');
  currentWeek = activeTabN;
  populateDaySelect(); buildPersonFilter(); renderKPIs(); renderCompactSummary();
  for (let n=1; n<=META.weeks.length; n++) renderWeek(n,currentFilter,currentDayFilter);
  renderOperationalTools(); renderTeam(); applyPanelMode(); renderManagerIntelligence(); renderIdentityOperationalPulse();
}
function hydrateProductionCache() {
  const payload = loadProductionCache();
  if (!payload) return false;
  applyCachedProductionDataset(payload.items, payload.status_options || []);
  productionCacheHydrated = true;
  const time = cacheClock(payload.saved_at);
  cacheSyncLabel(`Cache operacional de ${time || 'agora'} · verificando mudanças no Monday...`);
  showToast('⚡ Cache operacional carregado · verificando mudanças em segundo plano.', 'info', 3200);
  return true;
}
async function fetchAllItemVersions() {
  const versions=[]; let cursor=null;
  while (true) {
    const query = cursor ? `query($cursor:String!){ next_items_page(limit:200,cursor:$cursor){ cursor items { id updated_at } } }` : `{ boards(ids:[${BOARD_ID}]) { items_page(limit:200) { cursor items { id updated_at } } } }`;
    const data=await mondayQuery(query,cursor?{cursor}:{});
    const page=cursor ? data?.next_items_page : data?.boards?.[0]?.items_page;
    const items=page?.items || [];
    versions.push(...items);
    if (!page?.cursor || items.length < 200) break;
    cursor=page.cursor;
  }
  return versions;
}
async function fetchItemsByIds(ids=[]) {
  const chunks=[];
  for (let index=0; index<ids.length; index+=100) chunks.push(ids.slice(index,index+100));
  const results = await Promise.all(chunks.map(async chunk => {
    const query = `query($ids:[ID!]) { items(ids:$ids) { id name updated_at group { id title } updates(limit:3) { id body created_at creator { name } } column_values(ids:["lista_suspensa_mkmqnjbv","status","lista_suspensa0__1","person","data__1","data"]) { id text value ... on StatusValue { index label_style { color border } updated_at } } } }`;
    const data=await mondayQuery(query,{ids:chunk});
    return data?.items || [];
  }));
  return results.flat();
}
function applyMirrorSnapshot(snapshot) {
  const rawItems = Array.isArray(snapshot?.items) ? snapshot.items : [];
  if (!rawItems.length) return false;
  const meta = calcWeeks();
  const all = processItemsAll(rawItems, meta);
  if (!all.length) return false;
  applyCachedProductionDataset(all, snapshot.status_options || []);
  operationalMirrorVersion = Number(snapshot.version || operationalMirrorVersion || 0);
  localStorage.setItem(OPERATIONAL_MIRROR_VERSION_KEY, String(operationalMirrorVersion));
  saveProductionCache();
  cacheSyncLabel(`Espelho central ativo · versão ${operationalMirrorVersion} · ${all.length} itens no board`);
  setSyncHealth('healthy', `Espelho central confirmado às ${syncHealthClock(Date.now())} · versão ${operationalMirrorVersion}`);
  return true;
}
function applyMirrorChanges(changes = [], version = 0) {
  if (!changes.length) return false;
  const current = new Map(DADOS_ALL.map(item => [String(item.id), item]));
  changes.forEach(change => {
    const itemId = String(change.item_id || '');
    if (!itemId) return;
    if (change.operation === 'delete') current.delete(itemId);
    else if (change.raw) {
      const processed = processItemsAll([change.raw], calcWeeks())[0];
      if (processed) current.set(itemId, processed);
    }
  });
  applyCachedProductionDataset([...current.values()], STATUS_OPTIONS);
  operationalMirrorVersion = Number(version || operationalMirrorVersion || 0);
  localStorage.setItem(OPERATIONAL_MIRROR_VERSION_KEY, String(operationalMirrorVersion));
  saveProductionCache();
  cacheSyncLabel(`Espelho central ao vivo · ${changes.length} mudança${changes.length===1?'':'s'} aplicada${changes.length===1?'':'s'}`);
  setSyncHealth('healthy', `Espelho central aplicou ${changes.length} mudança${changes.length===1?'':'s'} às ${syncHealthClock(Date.now())}`);
  showToast(`↻ ${changes.length} atualização${changes.length===1?'':'ões'} recebida${changes.length===1?'':'s'} da operação.`, 'ok');
  return true;
}
async function mirrorRequest(path = '') {
  const response = await fetch(`${OPERATIONAL_MIRROR_API}${path}`, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    const error = new Error(`Espelho operacional indisponível (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function operationalMirrorRetryDelay() {
  const base = document.hidden ? OPERATIONAL_MIRROR_HIDDEN_INTERVAL : OPERATIONAL_MIRROR_VISIBLE_INTERVAL;
  return Math.min(base * Math.pow(2, Math.max(0, operationalMirrorFailures - 1)), 5 * 60 * 1000);
}
async function reconcileOperationalMirrorFromPanel() {
  try {
    const response = await fetch(OPERATIONAL_MIRROR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ action: 'reconcile' })
    });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(result?.error || `Reconciliação central indisponível (${response.status})`);
    if (Number(result.version || 0) > operationalMirrorVersion) {
      operationalMirrorVersion = Number(result.version);
      localStorage.setItem(OPERATIONAL_MIRROR_VERSION_KEY, String(operationalMirrorVersion));
    }
    const detail = result.skipped ? 'Já havia uma reconciliação central recente.' : `Espelho central reconciliado · versão ${result.version}.`;
    cacheSyncLabel(detail);
    return result;
  } catch(error) {
    console.warn('Atualização local concluída, mas o espelho central não confirmou a reconciliação:', error.message);
    setSyncHealth('stale', `Monday confirmado neste painel; o espelho compartilhado ainda não confirmou a reconciliação. ${error.message}`);
    return null;
  }
}
async function pullOperationalMirror(options = {}) {
  const { force = false } = options;
  if (producaoRefreshRunning || operationalMirrorRequestRunning) return false;
  if (!force && Date.now() < operationalMirrorNextAttemptAt) return false;
  operationalMirrorRequestRunning = true;
  try {
    if (!operationalMirrorVersion) {
      const snapshot = await mirrorRequest();
      if (!snapshot?.ready) throw new Error('Espelho operacional ainda não possui uma base confirmada.');
      const applied = applyMirrorSnapshot(snapshot);
      operationalMirrorFailures = 0;
      operationalMirrorUnavailable = false;
      operationalMirrorNextAttemptAt = 0;
      return applied;
    }
    const delta = await mirrorRequest(`?action=delta&since=${encodeURIComponent(operationalMirrorVersion)}`);
    if (delta.requires_snapshot) {
      const snapshot = await mirrorRequest();
      if (!snapshot?.ready) throw new Error('O espelho solicitou uma base completa, mas ainda não está pronto.');
      const applied = applyMirrorSnapshot(snapshot);
      operationalMirrorFailures = 0;
      operationalMirrorUnavailable = false;
      operationalMirrorNextAttemptAt = 0;
      return applied;
    }
    if (Number(delta.version || 0) > operationalMirrorVersion && Array.isArray(delta.changes) && delta.changes.length) {
      const applied = applyMirrorChanges(delta.changes, delta.version);
      operationalMirrorFailures = 0;
      operationalMirrorUnavailable = false;
      operationalMirrorNextAttemptAt = 0;
      return applied;
    }
    if (Number(delta.version || 0) > operationalMirrorVersion) {
      operationalMirrorVersion = Number(delta.version);
      localStorage.setItem(OPERATIONAL_MIRROR_VERSION_KEY, String(operationalMirrorVersion));
    }
    operationalMirrorFailures = 0;
    operationalMirrorUnavailable = false;
    operationalMirrorNextAttemptAt = 0;
    setSyncHealth('healthy', `Espelho central confirmado às ${syncHealthClock(Date.now())} · sem novas mudanças`);
    return true;
  } catch(error) {
    operationalMirrorFailures += 1;
    operationalMirrorUnavailable = true;
    const retryIn = operationalMirrorRetryDelay();
    operationalMirrorNextAttemptAt = Date.now() + retryIn;
    const retrySeconds = Math.max(1, Math.ceil(retryIn / 1000));
    console.warn('Espelho operacional indisponível; mantendo a última base segura.', error.message);
    setSyncHealth('error', `Não foi possível confirmar o espelho agora. Última base segura: ${syncHealthClock(syncHealthLastConfirmedAt)} · nova tentativa em ${retrySeconds}s.`);
    cacheSyncLabel(`Espelho indisponível · última base segura mantida · tentativa automática em ${retrySeconds}s`);
    return false;
  } finally {
    operationalMirrorRequestRunning = false;
  }
}
function startOperationalMirrorFeed() {
  if (operationalMirrorTimer) return;
  const schedule = async (force = false) => {
    await pullOperationalMirror({ force });
    const cadence = document.hidden ? OPERATIONAL_MIRROR_HIDDEN_INTERVAL : OPERATIONAL_MIRROR_VISIBLE_INTERVAL;
    operationalMirrorTimer = setTimeout(() => schedule(false), cadence);
  };
  void schedule(false);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      operationalMirrorNextAttemptAt = 0;
      if (operationalMirrorTimer) clearTimeout(operationalMirrorTimer);
      operationalMirrorTimer = null;
      void schedule(true);
    }
  });
}
async function reconcileProductionCache() {
  if (!productionCacheHydrated || productionCacheSyncing || producaoRefreshRunning) return;
  productionCacheSyncing=true;
  try {
    setSyncHealth('checking', 'Cache ativo · conferindo alterações do Monday em segundo plano…');
    cacheSyncLabel('Cache operacional ativo · conferindo alterações do Monday...');
    const remote=await fetchAllItemVersions();
    const localById=new Map(DADOS_ALL.map(item=>[String(item.id),item]));
    const remoteById=new Map(remote.map(item=>[String(item.id),item]));
    const changedIds=remote.filter(item=>!localById.has(String(item.id)) || String(localById.get(String(item.id))?.updated_at||'')!==String(item.updated_at||'')).map(item=>String(item.id));
    const removedIds=[...localById.keys()].filter(id=>!remoteById.has(id));
    if (!changedIds.length && !removedIds.length) {
      cacheSyncLabel(`Dados confirmados agora · ${DADOS_ALL.length} itens do board verificados`);
      setSyncHealth('healthy', `Monday confirmado às ${syncHealthClock(Date.now())} · ${DADOS_ALL.length} itens verificados`);
      return;
    }
    // Um lote excepcionalmente grande usa a carga completa silenciosa como contingência segura.
    if (changedIds.length > 140) { await refreshProducao({silent:true,source:'reconcile'}); return; }
    const changedRaw=await fetchItemsByIds(changedIds);
    const changedProcessed=processItemsAll(changedRaw,META);
    const merged=new Map(DADOS_ALL.map(item=>[String(item.id),item]));
    removedIds.forEach(id=>merged.delete(id));
    changedProcessed.forEach(item=>merged.set(String(item.id),item));
    applyCachedProductionDataset([...merged.values()], STATUS_OPTIONS);
    saveProductionCache();
    cacheSyncLabel(`Dados reconciliados agora · ${changedIds.length} alteração${changedIds.length===1?'':'ões'} aplicada${changedIds.length===1?'':'s'}`);
    setSyncHealth('healthy', `Monday reconciliado às ${syncHealthClock(Date.now())} · ${changedIds.length} mudança${changedIds.length===1?'':'s'} aplicada${changedIds.length===1?'':'s'}`);
    showToast(`✓ ${changedIds.length} alteração${changedIds.length===1?'':'ões'} sincronizada${changedIds.length===1?'':'s'} sem recarregar a tela.`, 'ok');
  } catch(error) {
    console.warn('Reconciliação em segundo plano indisponível:', error);
    setSyncHealth('error', `Não foi possível confirmar o Monday. Última base segura: ${syncHealthClock(syncHealthLastConfirmedAt)}.`);
    cacheSyncLabel('Cache operacional ativo · não foi possível confirmar o Monday agora.');
    showToast('Cache local mantido. A conferência com o Monday será tentada novamente na próxima atualização.', 'info', 5200);
  } finally { productionCacheSyncing=false; }
}

// ─── Refresh principal ────────────────────────────────────────────────────
async function refreshProducao(options={}) {
  const { silent=false, source='manual', force=false } = options;
  // Qualquer refresh não explicitamente manual é bloqueado enquanto uma alteração local
  // está sendo confirmada. A mutação deve reconciliar apenas o item editado.
  if (!silent && !force && outboundMutationGuardActive()) {
    cacheSyncLabel(`Alteração de ${outboundMutationGuardLabel || 'uma demanda'} em confirmação · carga integral bloqueada.`);
    setSyncHealth('checking', 'Alteração em confirmação · mantendo o contexto atual.');
    return { suppressed:true, reason:'outbound-mutation-guard' };
  }
  if (producaoRefreshRunning) { showToast('Atualização já está em andamento.', 'info'); return; }
  producaoRefreshRunning = true;
  const btn = document.getElementById('btn-refresh');
  const icon = document.getElementById('refresh-icon');
  const loading = document.getElementById('loading');

  if (!silent) { btn.disabled = true; icon.textContent = '↻'; icon.className = 'spin'; }
  setSyncHealth('checking', silent ? 'Reconciliação de segurança em andamento…' : 'Atualização manual em andamento…');
  const loadingCycle = silent ? null : beginLoadingCycle();
  if (!silent) showToast('Buscando dados do Monday.com...', 'info', 60000);

  try {
    META = calcWeeks();
    updateMonthNav();
    // O histórico não depende da lista: iniciar em paralelo reduz o tempo percebido de sincronização.
    ACTIVITY_LOGS_CACHE = null;
    const activityLogsPromise = fetchActivityLogs().catch(error => { console.warn('Histórico operacional indisponível nesta sincronização:', error); return null; });
    // A lista de itens é essencial. A legenda de status é complementar: se o relay
    // oscilar nela, preservamos as cores já conhecidas e seguimos com a atualização.
    const [rawItems] = await Promise.all([
      fetchAllItems({silent}),
      fetchStatusOptions().catch(error => {
        console.warn('Legenda de status indisponível nesta sincronização:', error);
        return STATUS_OPTIONS;
      })
    ]);
    DADOS = processItems(rawItems, META);
    DADOS_ALL = processItemsAll(rawItems, META); // todos os itens sem filtro de semana
    // Recalcular após normalizar para garantir que o modo de data ativo é a única
    // referência que decide em qual semana a demanda será exibida.
    recalcSemanas();
    syncStatusLegendColors('#status-legend', DADOS_ALL);
    // Histórico já foi buscado em paralelo à lista; se falhar, os sinais operacionais degradam de forma segura.
    window.ACTIVITY_LOGS = await activityLogsPromise;

    HOJE_ISO = META.today_iso;
    applyOperationalRisk(DADOS);
    applyOperationalRisk(DADOS_ALL);
    // Construir DIAS para cada semana
    DIAS_SEMANAS = META.weeks.map(w => buildDias(w.startIso, w.endIso, META.today_iso));
    // Compat
    DIAS_S1 = DIAS_SEMANAS[0] || [];
    DIAS_S2 = DIAS_SEMANAS[1] || [];

    document.getElementById('badge-s1').textContent = `S${META.currentWeekIdx+1} · ${META.weeks[META.currentWeekIdx].startFmt}–${META.weeks[META.currentWeekIdx].endFmt}`;
    document.getElementById('badge-s2').textContent = `S${META.currentWeekIdx+2} · ${META.weeks[Math.min(META.currentWeekIdx+1, META.weeks.length-1)].startFmt}–${META.weeks[Math.min(META.currentWeekIdx+1, META.weeks.length-1)].endFmt}`;
    document.getElementById('badge-hoje').textContent = `Hoje: ${META.today}`;
    document.getElementById('footer-update').textContent = `Última atualização: ${META.generated_at}`;
    setSyncHealth('healthy', `Monday confirmado às ${syncHealthClock(Date.now())} · ${DADOS_ALL.length} itens verificados`);

    // Gerar abas e painéis para todas as semanas do mês (4, 5 ou 6).
    const numLabels = ['01','02','03','04','05','06'];
    // Esconder todas as abas primeiro, depois mostrar as que existem.
    for (let t = 1; t <= 6; t++) {
      const el = document.getElementById(`tab-s${t}-label`);
      if (el) el.style.display = 'none';
    }
    META.weeks.forEach((w, i) => {
      const n = i + 1;
      const tabEl = document.getElementById(`tab-s${n}-label`);
      if (tabEl) {
        const isCurrent = i === META.currentWeekIdx;
        tabEl.textContent = `📅 Semana ${numLabels[i]} — ${w.startFmt} a ${w.endFmt}${isCurrent ? ' ★' : ''}`;
        tabEl.style.display = '';
      }
      const titleEl = document.getElementById(`title-s${n}`);
      if (titleEl) titleEl.textContent = `Clientes — Semana ${numLabels[i]} (${w.startFmt}–${w.endFmt})`;
    });

    // Ativar a tab da semana atual automaticamente
    const activeTabN = META.currentWeekIdx + 1;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.week-panel').forEach(p => p.classList.remove('active'));
    const activeTabEl = document.getElementById(`tab-s${activeTabN}-label`);
    if (activeTabEl) activeTabEl.classList.add('active');
    const activePanelEl = document.getElementById(`panel-week${activeTabN}`);
    if (activePanelEl) activePanelEl.classList.add('active');
    currentWeek = activeTabN;

    populateDaySelect();
    buildPersonFilter();
    renderKPIs();
    renderCompactSummary();
    for (let n = 1; n <= META.weeks.length; n++) renderWeek(n, currentFilter, currentDayFilter);
    renderOperationalTools();
    renderTeam();
    applyPanelMode();
    renderManagerIntelligence();
    renderIdentityOperationalPulse();
    // As Solicitações são uma segunda origem do mesmo fluxo e entram em segundo plano
    // para alimentar GESTOR, FOCO e DA CONTROLER sem travar a carga principal.
    if (panelMode === 'gestor' || panelMode === 'foco' || panelMode === 'controler') void ensureDemandasForOperationalViews();

    saveProductionCache();
    startOperationalMirrorFeed();
    if (!silent && source === 'manual') {
      void reconcileOperationalMirrorFromPanel();
      showToast(`✓ ${DADOS.length} itens carregados — conferindo a base compartilhada…`, 'ok');
    } else if (!silent) {
      showToast(`✓ ${DADOS.length} itens carregados — ${META.generated_at}`, 'ok');
    }
    else cacheSyncLabel(`Dados reconciliados agora · ${DADOS_ALL.length} itens do board verificados`);
  } catch(e) {
    console.error(e);
    showToast(`Erro: ${e.message}`, 'err', 8000);
    document.getElementById('footer-update').textContent = `Erro ao atualizar — ${e.message}`;
    setSyncHealth('error', `Falha ao atualizar: ${e.message}. Última confirmação: ${syncHealthClock(syncHealthLastConfirmedAt)}.`);
  } finally {
    producaoRefreshRunning = false;
    if (!silent) {
      finishLoadingCycle(loadingCycle);
      btn.disabled = false;
      icon.className = '';
      icon.textContent = '↻';
      // Deixa o estado “Núcleo online” aparecer antes da interface entrar em cena.
      setTimeout(() => {
        if (loadingCycle !== loadingCycleId) return;
        loading.classList.remove('show');
      }, 620);
    }
  }
}

