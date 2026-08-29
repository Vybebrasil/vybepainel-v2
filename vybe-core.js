// vybe-core.js — núcleo: toast, GraphQL, carregamento, semanas e parsing de itens
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Modo de data (Veiculação / Prazo) ───────────────────────────────────────
// Retorna o campo ISO correto de um item conforme o modo ativo
function getDateIso(d) { return dateMode === 'prazo' ? (d.prazo_iso || '') : d.veiculacao_iso; }
function getDateFmt(d) { return dateMode === 'prazo' ? (d.prazo || '—') : d.veiculacao; }

function setDateMode(mode, btn) {
  if (dateMode === mode) return;
  dateMode = mode;
  // Atualizar visual dos botões
  document.querySelectorAll('.date-mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // A referência muda: o dia anteriormente selecionado pode não existir no novo calendário.
  // Mantemos os demais filtros ativos, inclusive a seleção acumulada da equipe.
  currentDayFilter = '';
  recalcSemanas();
  populateDaySelect();
  const weeksCount = META.weeks ? META.weeks.length : 4;
  for (let s = 1; s <= weeksCount; s++) renderWeek(s, currentFilter, currentDayFilter);
  renderOperationalTools();
  renderManagerIntelligence();
  updateClearFiltersState();
}

// Recalcula o campo `semana` de cada item com base no dateMode atual
function recalcSemanas() {
  const weeks = META.weeks || [];
  [DADOS, DADOS_ALL].forEach(list => (list || []).forEach(d => {
    const iso = getDateIso(d);
    d.semana = null;
    for (let i = 0; i < weeks.length; i++) {
      if (iso && iso >= weeks[i].startIso && iso <= weeks[i].endIso) {
        d.semana = i + 1;
        break;
      }
    }
  }));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type='info', duration=3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ''; }, duration);
}

// ─── GraphQL Query ────────────────────────────────────────────────────────────
async function mondayQuery(query, variables={}) {
  // Consultas podem receber 502/503 transitórios do relay ou do Monday.
  // Mutations não são repetidas automaticamente para evitar gravação duplicada.
  const isMutation = /^\s*mutation\b/i.test(query);
  const maxAttempts = isMutation ? 1 : 3;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(MONDAY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MONDAY_TOKEN,
          'API-Version': '2024-01'
        },
        body: JSON.stringify({ query, variables })
      });
      if (!res.ok) {
        const transient = [429, 500, 502, 503, 504].includes(res.status);
        if (!isMutation && transient && attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 650 * (attempt + 1)));
          continue;
        }
        const errorTxt = await res.text(); throw new Error(`HTTP ${res.status}: ${errorTxt}`);
      }
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      return json.data;
    } catch (error) {
      lastError = error;
      const canRetry = !isMutation && attempt < maxAttempts - 1 && (/HTTP (429|500|502|503|504)/.test(error.message || '') || error.name === 'TypeError');
      if (!canRetry) throw error;
      await new Promise(resolve => setTimeout(resolve, 650 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Falha ao consultar o Monday');
}
// ─── Buscar activity logs do board (movimentações de grupo e alterações de prazo) ──────────────────────────────────────────────────────
let ACTIVITY_LOGS_CACHE = null; // cache para não rebuscar a cada render
async function fetchActivityLogs() {
  if (ACTIVITY_LOGS_CACHE) return ACTIVITY_LOGS_CACHE;
  const allLogs = [];
  let page = 1;
  let from = null;
  // Buscar até 5 páginas (5000 logs) para cobrir histórico suficiente
  while (page <= 5) {
    const q = from
      ? `{ boards(ids:[${BOARD_ID}]) { activity_logs(limit:1000, from:"${from}") { id event created_at user_id data } } }`
      : `{ boards(ids:[${BOARD_ID}]) { activity_logs(limit:1000) { id event created_at user_id data } } }`;
    const data = await mondayQuery(q);
    const logs = data.boards[0].activity_logs;
    if (!logs || logs.length === 0) break;
    allLogs.push(...logs);
    if (logs.length < 1000) break;
    // Usar o created_at do último como cursor para próxima página
    const lastTs = logs[logs.length - 1].created_at;
    from = new Date(parseInt(lastTs) / 10000).toISOString(); // Monday usa timestamp em 100-nanoseconds
    page++;
  }
  // Processar: separar eventos de movimentação de grupo e alterações de prazo
  const moveEvents = {}; // pulseId -> [{sourceGroupId, destGroupId, date}]
  const prazoEvents = {}; // pulseId -> [{date, prazoDate, previousPrazoDate}]
  const statusEvents = {}; // pulseId -> [{date, tsMs, status, previousStatus}]
  const veiculacaoEvents = {}; // pulseId -> [{date, tsMs, veiculacaoDate, previousVeiculacaoDate}]
  const ownerEvents = {}; // pulseId -> [{date, tsMs, actorId}]
  for (const log of allLogs) {
    try {
      const d = JSON.parse(log.data);
      // Timestamp do Monday: é um bigint em 100-nanoseconds desde epoch
      // created_at vem como string numérica
      const tsMs = Math.floor(parseInt(log.created_at) / 10000);
      const eventDate = new Date(tsMs).toISOString().slice(0, 10);
      if (log.event === 'move_pulse_from_group') {
        const pid = String(d.pulse_id);
        if (!moveEvents[pid]) moveEvents[pid] = [];
        moveEvents[pid].push({
          sourceGroupId: d.source_group?.id,
          destGroupId: d.dest_group?.id,
          date: eventDate,
          tsMs
        });
      } else if ((log.event === 'update_column_value' || log.event === 'batch_change_pulses_column_value') &&
                 d.column_id === 'data') {
        // Evento de alteração de prazo
        const pids = d.pulse_id ? [String(d.pulse_id)] : (d.pulse_ids || []).map(String);
        for (const pid of pids) {
          if (!prazoEvents[pid]) prazoEvents[pid] = [];
          prazoEvents[pid].push({
            date: eventDate,
            tsMs,
            prazoDate: d.value?.date || null,
            previousPrazoDate: d.previous_value?.date || null
          });
        }
      } else if ((log.event === 'update_column_value' || log.event === 'batch_change_pulses_column_value') &&
                 d.column_id === 'status') {
        // Evento de entrada em etapa. O rótulo vem na estrutura real do Monday.
        const pids = d.pulse_id ? [String(d.pulse_id)] : (d.pulse_ids || []).map(String);
        for (const pid of pids) {
          if (!statusEvents[pid]) statusEvents[pid] = [];
          statusEvents[pid].push({
            date: eventDate,
            tsMs,
            status: d.value?.label?.text || '',
            previousStatus: d.previous_value?.label?.text || '',
            actorId: d.user_id || d.user?.id || log.user_id || log.user?.id || null
          });
        }
      } else if ((log.event === 'update_column_value' || log.event === 'batch_change_pulses_column_value') &&
                 d.column_id === COLUNAS.producao.veiculacao) {
        // Evento de alteração de veiculação.
        const pids = d.pulse_id ? [String(d.pulse_id)] : (d.pulse_ids || []).map(String);
        for (const pid of pids) {
          if (!veiculacaoEvents[pid]) veiculacaoEvents[pid] = [];
          veiculacaoEvents[pid].push({date:eventDate,tsMs,veiculacaoDate:d.value?.date || null,previousVeiculacaoDate:d.previous_value?.date || null,actorId:d.user_id || d.user?.id || null});
        }
      } else if ((log.event === 'update_column_value' || log.event === 'batch_change_pulses_column_value') &&
                 d.column_id === 'person') {
        // Evento de mudança de responsáveis; o detalhe de pessoas pode variar por versão da API.
        const pids = d.pulse_id ? [String(d.pulse_id)] : (d.pulse_ids || []).map(String);
        for (const pid of pids) {
          if (!ownerEvents[pid]) ownerEvents[pid] = [];
          const peopleOf=value => (value?.personsAndTeams || value?.persons_and_teams || []).map(person=>String(person.id));
          ownerEvents[pid].push({date:eventDate,tsMs,actorId:d.user_id || d.user?.id || log.user_id || null,ownerIds:peopleOf(d.value),previousOwnerIds:peopleOf(d.previous_value)});
        }
      }
    } catch(e) { /* ignorar logs mal-formados */ }
  }
  // Ordenar por tsMs crescente (mais antigo primeiro)
  for (const pid in moveEvents) moveEvents[pid].sort((a,b) => a.tsMs - b.tsMs);
  for (const pid in prazoEvents) prazoEvents[pid].sort((a,b) => a.tsMs - b.tsMs);
  for (const pid in statusEvents) statusEvents[pid].sort((a,b) => a.tsMs - b.tsMs);
  for (const pid in veiculacaoEvents) veiculacaoEvents[pid].sort((a,b) => a.tsMs - b.tsMs);
  for (const pid in ownerEvents) ownerEvents[pid].sort((a,b) => a.tsMs - b.tsMs);
  ACTIVITY_LOGS_CACHE = { moveEvents, prazoEvents, statusEvents, veiculacaoEvents, ownerEvents };
  return ACTIVITY_LOGS_CACHE;
}

// Calcula Taxa OK para um departamento: % de itens que saíram do grupo antes do prazo original
function calcTaxaOK(itens, dept, moveEvents, prazoEvents) {
  // Apenas itens que já saíram do grupo deste departamento
  const groupIds = dept.groupIds || [];
  let okCount = 0, nokCount = 0;
  const okItems = [], nokItems = [];
  for (const item of itens) {
    const pid = String(item.id);
    const moves = moveEvents[pid] || [];
    // Encontrar o momento em que saiu do grupo deste departamento
    const saidaMove = moves.find(m => groupIds.includes(m.sourceGroupId));
    if (!saidaMove) continue; // ainda não saiu do grupo, não conta
    const dataSaida = saidaMove.date; // YYYY-MM-DD
    // Encontrar o primeiro prazo cadastrado para este item
    const prazos = prazoEvents[pid] || [];
    let primeiroPrazo = null;
    if (prazos.length > 0) {
      // O primeiro evento de prazo tem previousPrazoDate (prazo anterior) ou prazoDate
      // O prazo original é o previousPrazoDate do evento mais antigo, ou o prazoDate se não há anterior
      const primEvento = prazos[0];
      primeiroPrazo = primEvento.previousPrazoDate || primEvento.prazoDate;
    }
    // Se não há log de prazo, usar o prazo atual do item
    if (!primeiroPrazo) primeiroPrazo = item.prazo_iso || null;
    if (!primeiroPrazo) continue; // sem prazo, não conta
    // Comparar: saiu antes ou no prazo = OK; saiu depois = NOK
    if (dataSaida <= primeiroPrazo) {
      okCount++;
      okItems.push({...item, _dataSaida: dataSaida, _primeiroPrazo: primeiroPrazo});
    } else {
      nokCount++;
      nokItems.push({...item, _dataSaida: dataSaida, _primeiroPrazo: primeiroPrazo});
    }
  }
  const total = okCount + nokCount;
  const pct = total > 0 ? Math.round((okCount / total) * 100) : null;
  return { okCount, nokCount, total, pct, okItems, nokItems };
}

// ─── Controle visual de carregamento ─────────────────────────────────────────
let loadingCycleId = 0;
let outboundMutationGuardUntil = 0;
let outboundMutationGuardLabel = '';
function armOutboundMutationGuard(label='alteração local') {
  outboundMutationGuardUntil = Date.now() + 45000;
  outboundMutationGuardLabel = label;
}
function outboundMutationGuardActive() {
  return Date.now() < outboundMutationGuardUntil;
}
function setLoadingState({ phase, text, count, code, system } = {}) {
  const target = (id) => document.getElementById(id);
  if (phase) target('loading-phase').textContent = phase;
  if (text) target('loading-text').textContent = text;
  if (count) target('loading-count').textContent = count;
  if (code) target('loading-stage-code').textContent = code;
  if (system) target('loading-system').textContent = system;
}
function setBootAct(act) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.dataset.bootAct = act;
  const order = ['link','data','stations'];
  const current = order.indexOf(act);
  document.querySelectorAll('[data-boot-act]').forEach(node => {
    const index = order.indexOf(node.dataset.bootAct);
    node.classList.toggle('done', index >= 0 && index < current);
    node.classList.toggle('active', index === current);
  });
}
function beginLoadingCycle() {
  const cycleId = ++loadingCycleId;
  const loading = document.getElementById('loading');
  const spinner = document.getElementById('loading-spinner');
  const progress = document.getElementById('loading-progress');
  // Reinicia a sequência visual para evitar estado congelado entre atualizações.
  loading.classList.remove('show','is-complete','is-unlocking');
  spinner.classList.remove('is-spinning');
  progress.style.transition = 'none';
  progress.style.width = '0%';
  setLoadingState({ phase:'ESTABELECENDO VÍNCULO', text:'Autenticando conexão com a operação Vybe...', count:'00 / 100', code:'SYNC // 00', system:'NÚCLEO EM SINCRONIA' });
  setBootAct('link');
  void spinner.offsetWidth;
  spinner.classList.add('is-spinning');
  loading.classList.add('show');
  requestAnimationFrame(() => {
    if (cycleId !== loadingCycleId) return;
    progress.style.transition = 'width .35s ease';
    progress.style.width = '5%';
  });
  return cycleId;
}
function updateLoadingProgress(page) {
  const pct = Math.min(92, 5 + page * 9);
  document.getElementById('loading-progress').style.width = `${pct}%`;
  setBootAct('data');
  setLoadingState({ phase:'DADOS MAPEADOS EM TEMPO REAL', text:`Coletando sinais da produção · pacote ${String(page).padStart(2,'0')}`, count:`${String(pct).padStart(2,'0')} / 100`, code:`SYNC // ${String(page).padStart(2,'0')}`, system:'NÚCLEO PROCESSANDO PACOTES' });
}
function finishLoadingCycle(cycleId) {
  if (cycleId !== loadingCycleId) return;
  document.getElementById('loading-progress').style.width = '100%';
  document.getElementById('loading-spinner')?.classList.remove('is-spinning');
  const loading = document.getElementById('loading');
  loading?.classList.add('is-complete','is-unlocking');
  setBootAct('stations');
  setLoadingState({ phase:'ESTAÇÕES ARMADAS', text:'Operação sincronizada. Central liberada.', count:'100 / 100', code:'SYNC // READY', system:'SISTEMA OPERACIONAL ATIVO' });
}

// ─── Buscar todos os itens com paginação ──────────────────────────────────────────────────────
async function fetchAllItems(options={}) {
  const { silent=false } = options;
  const allItems = [];
  let cursor = null;
  let page = 0;

  const loadingText = document.getElementById('loading-text');

  while (true) {
    page++;
    if (!silent) updateLoadingProgress(page);

    const query = cursor
      ? `query($cursor: String!) {
          next_items_page(limit: 200, cursor: $cursor) {
            cursor
            items {
              id name updated_at
              group { id title }
              updates(limit: 3) { id body created_at creator { name } }
              column_values(ids: ["lista_suspensa_mkmqnjbv","status","lista_suspensa0__1","person","data__1","data"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
            }
          }
        }`
      : `{
          boards(ids: [${BOARD_ID}]) {
            items_page(limit: 200) {
              cursor
              items {
                id name updated_at
                group { id title }
                updates(limit: 3) { id body created_at creator { name } }
                column_values(ids: ["lista_suspensa_mkmqnjbv","status","lista_suspensa0__1","person","data__1","data"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
              }
            }
          }
        }`;

    const data = await mondayQuery(query, cursor ? { cursor } : {});

    let items, nextCursor;
    if (cursor) {
      items = data.next_items_page.items;
      nextCursor = data.next_items_page.cursor;
    } else {
      items = data.boards[0].items_page.items;
      nextCursor = data.boards[0].items_page.cursor;
    }

    allItems.push(...items);

    if (!nextCursor || items.length < 200) break;
    cursor = nextCursor;
  }

  return allItems;
}

// ─── Opções oficiais de status ───────────────────────────────────────────────
let STATUS_OPTIONS = [];
async function fetchStatusOptions() {
  const q = `{ boards(ids:[${BOARD_ID}]) { columns(ids:["status"]) { settings_str } } }`;
  const data = await mondayQuery(q);
  const raw = data?.boards?.[0]?.columns?.[0]?.settings_str || '{}';
  const settings = JSON.parse(raw);
  const labels = settings.labels || {};
  const colors = settings.labels_colors || {};
  STATUS_OPTIONS = Object.entries(labels)
    .filter(([, label]) => label)
    .map(([index, label]) => ({
      index: Number(index),
      label,
      color: validStatusColor(colors[index]?.color) || '#c4c4c4',
      border: validStatusColor(colors[index]?.border) || validStatusColor(colors[index]?.color) || '#c4c4c4'
    }))
    .sort((a, b) => a.index - b.index);
  return STATUS_OPTIONS;
}

// ─── Calcular semanas ────────────────────────────────────────────────────────────────────────────────
// Retorna as 4 (ou 5) semanas do mês atual, cada uma começando na segunda-feira.
// Se o dia 1 do mês não cai numa segunda, a Semana 01 começa na segunda-feira
// da semana anterior (garantindo que dias como 28/06–05/07 apareçam).
function calcWeeks() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  const iso  = d => d.toISOString().slice(0,10);
  const todayFmt = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
  // Mês-alvo com offset
  const targetDate = new Date(today);
  targetDate.setMonth(today.getMonth() + MONTH_OFFSET);
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const firstDay = new Date(year, month, 1, 12, 0, 0);
  const firstDow = firstDay.getDay(); // 0=Dom, 1=Seg, ...

  // Encontrar a segunda-feira que CONTÉM o dia 1 do mês.
  // Se dia 1 é segunda (dow=1), firstMon = dia 1.
  // Senão, voltar para a segunda-feira anterior.
  let firstMon;
  if (firstDow === 1) {
    firstMon = new Date(firstDay);
  } else {
    // Voltar para a segunda anterior
    // dow 0(Dom) → voltar 6 dias; dow 2(Ter) → voltar 1; dow 3(Qua) → voltar 2; etc.
    const daysBack = firstDow === 0 ? 6 : (firstDow - 1);
    firstMon = new Date(firstDay);
    firstMon.setDate(1 - daysBack);
  }

  // Último dia do mês
  const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

  // Gerar semanas até cobrir todo o mês (normalmente 4 ou 5)
  const weeks = [];
  let weekStart = new Date(firstMon);
  while (weekStart <= lastDayOfMonth && weeks.length < 6) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({ start, end, startFmt: fmt(start), endFmt: fmt(end), startIso: iso(start), endIso: iso(end) });
    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Semana atual = semana que contém hoje (para destacar)
  const todayIso = iso(today);
  let currentWeekIdx = weeks.findIndex(w => todayIso >= w.startIso && todayIso <= w.endIso);
  if (currentWeekIdx < 0) currentWeekIdx = 0;

  const result = {
    weeks,
    currentWeekIdx,
    today: todayFmt,
    today_iso: todayIso,
    generated_at: `${todayFmt.slice(0,10)} às ${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`,
    // Compat: manter week1/week2 apontando para semana atual e próxima
    week1_start: weeks[currentWeekIdx].startFmt, week1_end: weeks[currentWeekIdx].endFmt,
    week2_start: weeks[Math.min(currentWeekIdx+1, weeks.length-1)].startFmt, week2_end: weeks[Math.min(currentWeekIdx+1, weeks.length-1)].endFmt,
    week1_start_iso: weeks[currentWeekIdx].startIso, week1_end_iso: weeks[currentWeekIdx].endIso,
    week2_start_iso: weeks[Math.min(currentWeekIdx+1, weeks.length-1)].startIso, week2_end_iso: weeks[Math.min(currentWeekIdx+1, weeks.length-1)].endIso,
  };
  return result;
}

// ─── Processar itens brutos ───────────────────────────────────────────────
function statusContextPlainText(body='') { return String(body).replace(/<\/(p|div|li|br)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').trim(); }
function contextLine(text,label) { const match=String(text||'').match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, 'i')); return match ? match[1].trim() : ''; }
function latestStatusContext(item) { const update=(item?.updates||[]).find(u=>String(u.body||'').includes('Vybe OS · Contexto de status')); if(!update) return null; const text=statusContextPlainText(update.body); return { text, target:contextLine(text,'Etapa').split('→').pop().trim(), reason:contextLine(text,'Motivo'), next:contextLine(text,'Próximo passo'), requester:contextLine(text,'Solicitante/Dependência'), source:contextLine(text,'Origem'), created_at:update.created_at||'', creator:update.creator?.name||'' }; }
function processItems(rawItems, meta) {
  // Aceitar itens de qualquer das 4 semanas do mês
  const allWeekRanges = meta.weeks || [];
  // Compat: se não tiver meta.weeks, usar as 2 semanas antigas
  const weekRanges = allWeekRanges.length > 0 ? allWeekRanges : [
    { startIso: meta.week1_start_iso, endIso: meta.week1_end_iso },
    { startIso: meta.week2_start_iso, endIso: meta.week2_end_iso }
  ];

  const processed = [];
  const seen = new Set();

  for (const item of rawItems) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);

    const colMap = {};
    const colValueMap = {};
    const colStyleMap = {};
    (item.column_values || []).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });

    // Suporte a múltiplos clientes na mesma coluna (ex: "Daiana Miron, Larissa Fernanda")
    const clienteRaw = colMap[COLUNAS.producao.cliente] || '';
    if (!clienteRaw) continue;
    const clientesList = clienteRaw.split(',').map(s=>s.trim()).filter(Boolean);
    // Filtrar clientes inativos — se TODOS forem inativos, pular o item
    const clientesAtivos = clientesList.filter(c => !CLIENTES_INATIVOS.has(c.toLowerCase()));
    if (clientesAtivos.length === 0) continue;
    // Usar apenas o primeiro cliente ativo (evita card duplo)
    const cliente = clientesAtivos[0];

    const veiculacaoStr = colMap[COLUNAS.producao.veiculacao] || '';
    const prazoStr = colMap['data'] || '';
    // Uma demanda operacional pode existir por prazo antes de receber veiculação.
    // Só ignoramos itens realmente sem referência temporal nas duas colunas.
    if (!veiculacaoStr && !prazoStr) continue;

    const veiculacaoIso = veiculacaoStr ? veiculacaoStr.slice(0,10) : '';
    const veiculacao = veiculacaoIso ? new Date(veiculacaoIso + 'T12:00:00') : null;
    // prazoStr pode vir como YYYY-MM-DD ou vazio.
    const prazoIso = prazoStr ? prazoStr.slice(0,10) : '';
    const referenceIso = dateMode === 'prazo' ? (prazoIso || veiculacaoIso) : (veiculacaoIso || prazoIso);

    // Manter o item se prazo OU veiculação estiverem dentro da janela mensal.
    // A semana efetivamente exibida será recalculada conforme o modo ativo.
    const matchingWeeks = weekRanges
      .map((week, index) => ({ week, index }))
      .filter(({week}) => [veiculacaoIso, prazoIso].some(iso => iso && iso >= week.startIso && iso <= week.endIso));
    if (!matchingWeeks.length) continue;
    const activeWeek = weekRanges.findIndex(week => referenceIso && referenceIso >= week.startIso && referenceIso <= week.endIso);
    let semana = activeWeek >= 0 ? activeWeek + 1 : matchingWeeks[0].index + 1;

    const today = meta.today_iso;
    const prazoAtrasado = !!(prazoIso && prazoIso < today);

    const groupId = item.group?.id || '';
    const grupo = GROUP_MAP[groupId] || groupId || '—';

    const diasSem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const diaSemana = veiculacao ? diasSem[veiculacao.getDay()] : (prazoIso ? diasSem[new Date(prazoIso + 'T12:00:00').getDay()] : '—');
    const fmtDate = d => d ? `${String(new Date(d+'T12:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T12:00:00').getMonth()+1).padStart(2,'0')}` : '';

    // Extrair IDs dos responsáveis para filtro por pessoa (suporta múltiplos)
    let responsavelId = '';
    let responsavelIds = [];
    const personValue = colValueMap['person'] || '';
    if (personValue) {
      try {
        const pv = JSON.parse(personValue);
        const personsArr = pv.personsAndTeams || pv.persons || [];
        responsavelIds = personsArr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }

    processed.push({
      id,
      nome: item.name || '',
      cliente,
      status: colMap['status'] || '—',
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      formato: colMap[COLUNAS.producao.formato] || '—',
      captacao: colMap[COLUNAS.producao.captacao] || '',
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId,
      responsavel_ids: responsavelIds,
      veiculacao: fmtDate(veiculacaoIso),
      veiculacao_iso: veiculacaoIso,
      dia_semana: diaSemana,
      prazo: fmtDate(prazoIso),
      prazo_iso: prazoIso,
      prazo_atrasado: prazoAtrasado,
      grupo,
      group_id: groupId,
      url: `https://gestaovybes-team.monday.com/boards/${BOARD_ID}/pulses/${id}`,
      status_context: latestStatusContext(item),
      updated_at: item.updated_at || '',
      semana
    });
  }

  return processed;
}

// Versão sem filtro de semana — usada pela aba Clientes
function processItemsAll(rawItems, meta) {
  const weekRanges = meta.weeks || [];
  const processed = [];
  const seen = new Set();
  for (const item of rawItems) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const colMap = {}, colValueMap = {}, colStyleMap = {};
    (item.column_values || []).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });
    const clienteRaw = colMap[COLUNAS.producao.cliente] || '';
    const clientesAtivos = clienteRaw.split(',').map(s=>s.trim()).filter(c => c && !CLIENTES_INATIVOS.has(c.toLowerCase()));
    // Itens sem cliente não desaparecem: entram como exceção visível para correção de cadastro.
    const cliente = clientesAtivos[0] || 'Sem cliente';
    const veiculacaoStr = colMap[COLUNAS.producao.veiculacao] || '';
    const veiculacaoIso = veiculacaoStr ? veiculacaoStr.slice(0,10) : '';
    const prazoStr = colMap['data'] || '';
    const prazoIso = prazoStr ? prazoStr.slice(0,10) : '';
    const today = meta.today_iso;
    const prazoAtrasado = !!(prazoIso && prazoIso < today && !isFinishedItem({ status: colMap['status'] || '' }));
    const groupId = item.group?.id || '';
    const grupo = GROUP_MAP[groupId] || groupId || '—';
    const fmtDate = d => d ? `${String(new Date(d+'T12:00:00').getDate()).padStart(2,'0')}/${String(new Date(d+'T12:00:00').getMonth()+1).padStart(2,'0')}` : '';
    let responsavelId = '', responsavelIds = [];
    const personValue = colValueMap['person'] || '';
    if (personValue) {
      try {
        const pv = JSON.parse(personValue);
        const arr = pv.personsAndTeams || pv.persons || [];
        responsavelIds = arr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }
    const referenceIso = dateMode === 'prazo' ? (prazoIso || veiculacaoIso) : (veiculacaoIso || prazoIso);
    const weekIndex = weekRanges.findIndex(week => referenceIso && referenceIso >= week.startIso && referenceIso <= week.endIso);
    const semana = weekIndex >= 0 ? weekIndex + 1 : null;
    processed.push({
      id, nome: item.name || '', cliente,
      status: colMap['status'] || '—',
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      formato: colMap[COLUNAS.producao.formato] || '—',
      captacao: colMap[COLUNAS.producao.captacao] || '',
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId, responsavel_ids: responsavelIds,
      veiculacao: fmtDate(veiculacaoIso), veiculacao_iso: veiculacaoIso,
      prazo: fmtDate(prazoIso), prazo_iso: prazoIso, prazo_atrasado: prazoAtrasado,
      grupo, group_id: groupId,
      url: `https://gestaovybes-team.monday.com/boards/${BOARD_ID}/pulses/${id}`,
      status_context: latestStatusContext(item),
      updated_at: item.updated_at || '',
      semana
    });
  }
  return processed;
}

let DADOS_ALL = []; // todos os itens de produção sem filtro de semana
let DIAS_SEMANAS = [[], [], [], []]; // DIAS para cada semana (1-4)
let producaoRefreshRunning = false;

