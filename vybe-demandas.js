// vybe-demandas.js — board de solicitações de demandas e custos de IA
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Board Solicitações de Demandas ────────────────────────────────────────────────────────────
const BOARD_DEMANDAS_ID = 8385559107;
const BOARD_CLIENTES_ID = 7758256536;
const BOARD_ACESSOS_ID = 7758163799;
const CLIENTES_HEADS_COLUMNS = ['name','multiple_person_mm35kefy','status','link_mkzdvjjs','date_mm35wp7q','color_mkzkgn5c','lista_suspensa9__1','dropdown_mkw9njy6'];
const CLIENTES_ACESSOS_COLUMNS = ['name','monday_doc__1','link6__1','boolean_mm3248x2','link_mm3fwkja'];
const DEMANDAS_GROUP_MAP = {
  'group_mm187437':        'Novas Demandas/Ideias',
  'novo_grupo_mkmkjdqd':   'A Fazer',
  'novo_grupo_mkkyfhtw':   'Em Execução',
  'novo_grupo_mkkyx8pv':   'Concluídas'
};
const DEMANDAS_GROUP_ORDER = ['Novas Demandas/Ideias','A Fazer','Em Execução','Concluídas'];
const DEMANDAS_GROUP_ICON  = {};

let DADOS_DEMANDAS = [];
let CLIENT_MASTER_HEADS = [];
let CLIENT_MASTER_ACESSOS = [];
let CLIENT_MASTER_LOADING = false;
let CLIENT_MASTER_LOADED = false;
let CLIENT_MASTER_ERROR = '';
let currentDemandaPersonFilter = 'all';
let currentDemandaStatusFilter = 'all';
let currentDemandaWeek = 1;              // 1 | 2 | 0 (esteira)
let currentDemandaViewDay = false;       // true = ver por dia
let currentDemandaDateMode = 'conclusao'; // 'conclusao' | 'prazo'
let currentDemandaDayFilter = '';        // ISO date string para filtro de dia
let activeBoard = 'producao';

// Abas que só quem administra abre.
const ABAS_DE_GESTAO = new Set(['ai-usage', 'performance']);

// Esconde os botões dessas abas para quem não administra. Botão que existe e
// recusa é pior que botão que não existe.
function ajustarAbasPorPapel() {
  const admin = typeof souAdmin === 'function' && souAdmin();
  ABAS_DE_GESTAO.forEach((aba) => {
    const btn = document.getElementById(`btn-board-${aba}`);
    if (btn) btn.style.display = admin ? '' : 'none';
  });
}

// ─── Monitoramento de uso e custo de IA ─────────────────────────────────────
const AI_USAGE_API = '/api/ia-custos';
let aiUsageDays = 30;
let aiUsageData = null;
let aiUsageLoading = false;

function aiNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function aiBrl(value) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(aiNumber(value)); }
function aiUsd(value) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:4}).format(aiNumber(value)); }
function aiTokens(value) { return new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(aiNumber(value)); }
function aiProviderLabel(provider) { return ({gpt:'GPT',gemini:'GEMINI',claude:'CLAUDE'})[provider] || String(provider || 'IA').toUpperCase(); }

async function loadAiUsage(force=false) {
  if (aiUsageLoading || (!force && aiUsageData?.period_days === aiUsageDays)) { renderAiUsageBoard(aiUsageData); return; }
  aiUsageLoading = true;
  const root = document.getElementById('ai-usage-root');
  if (root) root.innerHTML = '<div class="ai-usage-loading">Consultando uso e custos...</div>';
  try {
    const response = await fetch(`${AI_USAGE_API}?days=${aiUsageDays}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Falha ao carregar monitoramento.');
    aiUsageData = data;
    renderAiUsageBoard(data);
  } catch (error) {
    if (root) root.innerHTML = `<div class="ai-usage-loading">Monitor indisponível<br><small style="display:block;margin-top:8px;color:#8b6b52;font-family:Arial;font-weight:400;letter-spacing:0">${safeText(error.message || 'Tente atualizar.')}</small></div>`;
  } finally {
    aiUsageLoading = false;
  }
}

function setAiUsageDays(days, button) {
  aiUsageDays = Number(days) || 30;
  document.querySelectorAll('.ai-usage-period').forEach(node => node.classList.toggle('active', Number(node.dataset.days) === aiUsageDays));
  loadAiUsage(true);
}

function aiBudgetMeta(data) {
  const budget = aiNumber(data?.settings?.monthly_budget_brl);
  const spent = aiNumber(data?.month?.cost_brl);
  if (budget <= 0) return { label:'Sem teto mensal definido', value:'—', percentage:0, state:'' };
  const raw = (spent / budget) * 100;
  return {
    label:`${aiBrl(spent)} de ${aiBrl(budget)} neste mês`,
    value:`${raw.toFixed(0)}%`,
    percentage:Math.min(raw,100),
    state: raw >= 100 ? 'danger' : raw >= 80 ? 'warning' : ''
  };
}

function renderAiUsageBoard(data) {
  const root = document.getElementById('ai-usage-root');
  if (!root || !data) return;
  const overview = data.overview || {};
  const month = data.month || {};
  const settings = data.settings || {};
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const people = Array.isArray(data.people) ? data.people : [];
  const budget = aiBudgetMeta(data);
  const maxDaily = Math.max(0.00001, ...daily.map(row => aiNumber(row.cost_brl)));
  const providerRows = providers.length ? providers.map(row => `
    <div class="ai-provider-row">
      <div><span class="ai-provider-name">${safeText(aiProviderLabel(row.provider))}</span><span class="ai-provider-model">${safeText(row.model || 'Modelo não identificado')}</span></div>
      <div class="ai-provider-calls">${aiNumber(row.calls)} comandos</div>
      <div class="ai-provider-cost">${aiBrl(row.cost_brl)}</div>
    </div>`).join('') : '<div class="ai-usage-empty">Ainda não há chamadas registradas neste período.</div>';
  const trend = daily.length ? daily.map(row => {
    const height = Math.max(3, (aiNumber(row.cost_brl) / maxDaily) * 100);
    const label = String(row.day || '').slice(5).replace('-', '/');
    return `<div class="ai-trend-day" title="${safeText(row.day)} · ${aiBrl(row.cost_brl)}"><div class="ai-trend-bar" style="height:${height}%"></div><span class="ai-trend-label">${label}</span></div>`;
  }).join('') : '<div class="ai-usage-empty" style="width:100%">O histórico aparecerá após os próximos comandos ao Jarvis.</div>';
  const personRows = people.length ? people.map(row => `<div class="ai-person-row"><div><span class="ai-person-name">${safeText(row.profile_name)}</span><span class="ai-person-meta">${aiNumber(row.calls)} comandos</span></div><span class="ai-person-cost">${aiBrl(row.cost_brl)}</span></div>`).join('') : '<div class="ai-usage-empty">Sem usuários no período.</div>';
  const geminiNote = settings.gemini_billing === 'paid' ? 'Pago — custo por token ativo' : 'Gratuito — custo estimado em R$ 0,00';
  root.innerHTML = `
    <div class="ai-usage-head">
      <div><div class="ai-usage-kicker">Vybe intelligence · Finops</div><h2 class="ai-usage-title">Monitor de IA e custos</h2><p class="ai-usage-sub">Consumo estimado do Jarvis por modelo, equipe e período. O registro é criado automaticamente a cada comando respondido.</p></div>
      <div class="ai-usage-periods"><button class="ai-usage-period ${aiUsageDays===7?'active':''}" data-days="7" onclick="setAiUsageDays(7,this)">7 DIAS</button><button class="ai-usage-period ${aiUsageDays===30?'active':''}" data-days="30" onclick="setAiUsageDays(30,this)">30 DIAS</button><button class="ai-usage-period ${aiUsageDays===90?'active':''}" data-days="90" onclick="setAiUsageDays(90,this)">90 DIAS</button><button class="ai-usage-period" onclick="loadAiUsage(true)">↻ ATUALIZAR</button></div>
    </div>
    <div class="ai-usage-grid">
      <div class="ai-usage-metric"><div class="ai-usage-label">Custo no mês</div><div class="ai-usage-value">${aiBrl(month.cost_brl)}</div><div class="ai-usage-detail">${aiUsd(month.cost_usd)} estimados</div></div>
      <div class="ai-usage-metric"><div class="ai-usage-label">Comandos no período</div><div class="ai-usage-value">${aiNumber(overview.calls)}</div><div class="ai-usage-detail">${aiNumber(month.calls)} no mês corrente</div></div>
      <div class="ai-usage-metric"><div class="ai-usage-label">Tokens processados</div><div class="ai-usage-value">${aiTokens(aiNumber(overview.input_tokens)+aiNumber(overview.output_tokens))}</div><div class="ai-usage-detail">${aiTokens(overview.input_tokens)} entrada · ${aiTokens(overview.output_tokens)} saída</div></div>
      <div class="ai-usage-metric"><div class="ai-usage-label">Teto mensal</div><div class="ai-usage-value">${budget.value}</div><div class="ai-usage-detail">${safeText(budget.label)}</div></div>
    </div>
    <div class="ai-usage-main-grid">
      <div class="ai-usage-block"><div class="ai-usage-block-title"><span>Uso por provedor</span><small>${aiUsageDays} DIAS</small></div>${providerRows}</div>
      <div class="ai-usage-block"><div class="ai-usage-block-title"><span>Equipe</span><small>Custo estimado</small></div>${personRows}</div>
      <div class="ai-usage-block"><div class="ai-usage-block-title"><span>Trajetória diária</span><small>R$ POR DIA</small></div><div class="ai-trend">${trend}</div></div>
      <div class="ai-usage-block"><div class="ai-usage-block-title"><span>Orçamento do mês</span><small>Alerta visual</small></div><div class="ai-budget-wrap"><div class="ai-budget-line"><span>${safeText(budget.label)}</span><span>${budget.value}</span></div><div class="ai-budget-track"><div class="ai-budget-fill ${budget.state}" style="width:${budget.percentage}%"></div></div><div class="ai-usage-note">Quando o teto é definido, a barra sinaliza em amarelo a partir de 80% e em vermelho ao atingir 100%.</div></div></div>
    </div>
    <div class="ai-usage-settings">
      <div class="ai-setting-copy"><b>Parâmetros de estimativa</b>Use o teto para receber alertas visuais. O Gemini está configurado como <strong>${safeText(geminiNote)}</strong>.</div>
      <div class="ai-setting-field"><label for="ai-budget-input">Teto mensal (R$)</label><input id="ai-budget-input" type="number" min="0" step="1" value="${aiNumber(settings.monthly_budget_brl)}"></div>
      <div class="ai-setting-field"><label for="ai-usd-input">Dólar de referência</label><input id="ai-usd-input" type="number" min="0.01" step="0.01" value="${aiNumber(settings.brl_per_usd)||5.5}"></div>
      <div class="ai-setting-field"><label for="ai-gemini-billing">Gemini</label><select id="ai-gemini-billing"><option value="free" ${settings.gemini_billing==='free'?'selected':''}>Plano gratuito</option><option value="paid" ${settings.gemini_billing==='paid'?'selected':''}>API paga</option></select></div>
      <button class="ai-setting-save" type="button" onclick="saveAiUsageSettings()">Salvar</button>
    </div>
    <div class="ai-usage-note">Os valores são estimativas calculadas por tokens. Eles não substituem os consoles de cobrança do OpenAI, Google e Anthropic e podem variar conforme plano, créditos, descontos, cache ou cobrança intermediada.</div>`;
}

async function saveAiUsageSettings() {
  const budget = document.getElementById('ai-budget-input');
  const usd = document.getElementById('ai-usd-input');
  const gemini = document.getElementById('ai-gemini-billing');
  const button = document.querySelector('.ai-setting-save');
  if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
  try {
    const response = await fetch(AI_USAGE_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days:aiUsageDays, monthly_budget_brl:aiNumber(budget?.value), brl_per_usd:aiNumber(usd?.value)||5.5, gemini_billing:gemini?.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Não foi possível salvar.');
    aiUsageData = result.dashboard;
    renderAiUsageBoard(aiUsageData);
    if (typeof showToast === 'function') showToast('Parâmetros de custo atualizados.');
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'Falha ao salvar parâmetros.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Salvar'; }
  }
}

function switchBoard(board, btn) {
  // Custo de IA e desempenho individual são leitura de quem gere, não do dia a
  // dia de quem executa. Antes as oito abas apareciam para todo mundo.
  if (!souAdmin() && ABAS_DE_GESTAO.has(board)) {
    showToast('Esta área é de quem administra o painel.', 'info', 4000);
    return;
  }
  if (activeBoard === board) return;
  activeBoard = board;
  document.querySelectorAll('.board-switch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const subs = {
    producao:    'Controle semanal de conteúdo por cliente e equipe',
    demandas:    'Solicitações de Demandas — esteira de produção',
    clientes:    'Visão unificada por cliente',
    diario:      'Diário de Produção — snapshots do estado dos conteúdos',
    performance: 'Médias e desempenho individual da equipe',
    'ai-usage':  'Uso, custos estimados e limites do Jarvis',
    automacoes:  'Regras que movem, atribuem e avisam sozinhas',
    conta:       'Sua conta e, para quem administra, a equipe'
  };
  document.getElementById('header-sub').textContent = subs[board] || '';
  document.querySelector('.container').style.display        = board==='producao' ? '' : 'none';
  document.getElementById('painel-demandas').style.display  = board==='demandas' ? 'block' : 'none';
  document.getElementById('painel-clientes').style.display  = board==='clientes' ? 'block' : 'none';
  document.getElementById('painel-diario').style.display       = board==='diario'      ? 'block' : 'none';
  document.getElementById('painel-performance').style.display  = board==='performance' ? 'block' : 'none';
  document.getElementById('painel-ai-usage').style.display     = board==='ai-usage' ? 'block' : 'none';
  document.getElementById('painel-automacoes').style.display   = board==='automacoes' ? 'block' : 'none';
  document.getElementById('painel-conta').style.display        = board==='conta' ? 'block' : 'none';
  if (board === 'demandas') {
    if (DADOS_DEMANDAS.length === 0) refreshDemandas();
    else renderDemandas();
  }
  if (board === 'clientes') renderClientesBoard();
  if (board === 'diario') renderDiarioLista();
  if (board === 'performance') renderPerformance();
  if (board === 'ai-usage') loadAiUsage();
  if (board === 'automacoes') carregarAutomacoes();
  if (board === 'conta') carregarConta();
}

// Helper: data ISO conforme modo ativo
function getDemandaDateIso(d) {
  return currentDemandaDateMode === 'prazo' ? (d.prazo_iso||'') : (d.conclusao_iso||'');
}
function getDemandaDateFmt(d) {
  return currentDemandaDateMode === 'prazo' ? (d.prazo||'') : (d.conclusao||'');
}

// Toggle modo de data
function setDemandaDateMode(mode, btn) {
  currentDemandaDateMode = mode;
  const botoes = [...document.querySelectorAll('#date-mode-bar-demandas .date-mode-btn')];
  botoes.forEach(b => b.classList.remove('active'));
  // Sem botao clicado (veio de um atalho na tela vazia): acha o que corresponde.
  const alvo = btn || botoes.find(b => (b.getAttribute('onclick') || '').includes(`'${mode}'`));
  alvo?.classList.add('active');
  populateDemandaDaySelect();
  renderDemandas();
}

// Tabs de semana
function showDemandaWeek(n, btn) {
  currentDemandaWeek = n;
  currentDemandaDayFilter = '';
  currentDemandaViewDay = false;
  document.querySelectorAll('#demanda-week-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const btnDay = document.getElementById('btn-dview-day');
  if (btnDay) btnDay.classList.remove('active');
  document.getElementById('filter-bar-demandas-main').style.display = n !== 0 ? 'flex' : 'none';
  populateDemandaDaySelect();
  renderDemandas();
}

// Toggle ver por dia
function toggleDemandaViewDay(btn) {
  currentDemandaViewDay = !currentDemandaViewDay;
  btn.classList.toggle('active', currentDemandaViewDay);
  renderDemandas();
}

// Popular select de dias da semana ativa
function populateDemandaDaySelect() {
  const sel = document.getElementById('day-select-demandas');
  if (!sel) return;
  // Determinar intervalo da semana
  let startIso = '', endIso = '';
  if (currentDemandaWeek === 1) { startIso = META.week1_start_iso; endIso = META.week1_end_iso; }
  else if (currentDemandaWeek === 2) { startIso = META.week2_start_iso; endIso = META.week2_end_iso; }
  const days = new Set();
  DADOS_DEMANDAS.forEach(d => {
    const iso = getDemandaDateIso(d);
    if (!iso) return;
    if (startIso && endIso && (iso < startIso || iso > endIso)) return;
    days.add(iso);
  });
  const sorted = [...days].sort();
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  sel.innerHTML = '<option value="">Todos os dias</option>' + sorted.map(iso => {
    const dt = new Date(iso+'T12:00:00');
    const dow = DIAS_LABEL[dt.getDay()];
    const fmt = `${iso.slice(8,10)}/${iso.slice(5,7)}`;
    return `<option value="${iso}">${dow} ${fmt}</option>`;
  }).join('');
  if (currentDemandaDayFilter) sel.value = currentDemandaDayFilter;
}

function filterDemandaByDay(sel) {
  currentDemandaDayFilter = sel.value;
  renderDemandas();
}

// ─── Buscar itens do board Demandas ────────────────────────────────────────────────────────────────────
async function fetchAllDemandas() {
  // O board de Demandas passou a viver no banco da Vybe. O caminho do Monday
  // fica como queda: se o banco falhar, a aba não pode sumir.
  if (fonteDeLeitura() === 'dominio') {
    try {
      const dados = await buscarDemandas();
      const itens = demandasComoItensDoMonday(dados);
      if (itens.length) return itens;
    } catch (erro) { console.warn('Demandas pelo banco falharam; usando o Monday.', erro); }
  }
  const allItems = [];
  let cursor = null;
  let page = 0;
  while (true) {
    page++;
    const pct = Math.min(92, 5 + page * 16);
    document.getElementById('loading-progress').style.width = `${pct}%`;
    setLoadingState({ phase:'SINCRO DE DEMANDAS EM CURSO', text:`Coletando solicitações operacionais · pacote ${String(page).padStart(2,'0')}`, count:`${String(pct).padStart(2,'0')} / 100`, code:`DEMANDAS // ${String(page).padStart(2,'0')}`, system:'CENTRAL DE DEMANDAS ATIVA' });
    const query = cursor
      ? `query($cursor: String!) {
          next_items_page(limit: 200, cursor: $cursor) {
            cursor
            items {
              id name
              group { id title }
              column_values(ids: ["lista_suspensa_mkmet5gs","status","color_mkwtgakv","data","data_mkky6jx","person","dropdown_mkv8d52z"]) {
                  id text value
                  ... on StatusValue { index label_style { color border } updated_at }
                }
            }
          }
        }`
      : `{
          boards(ids: [${BOARD_DEMANDAS_ID}]) {
            items_page(limit: 200) {
              cursor
              items {
                id name
                group { id title }
                column_values(ids: ["lista_suspensa_mkmet5gs","status","color_mkwtgakv","data","data_mkky6jx","person","dropdown_mkv8d52z"]) {
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

function processDemandas(rawItems) {
  const fmtDate = iso => iso ? `${iso.slice(8,10)}/${iso.slice(5,7)}` : '';
  return rawItems.map(item => {
    const colMap = {}, colValueMap = {}, colStyleMap = {};
    (item.column_values||[]).forEach(c => {
      colMap[c.id] = c.text || '';
      colValueMap[c.id] = c.value || '';
      colStyleMap[c.id] = { ...(c.label_style || {}), index: c.index, updated_at: c.updated_at };
    });
    const cliente    = normalizarCliente(colMap[COLUNAS.demandas.cliente]) || '—';
    const status     = colMap['status'] || '—';
    const prioridade = colMap[COLUNAS.demandas.prioridade] || '';
    const prazoIso   = (colMap['data']||'').slice(0,10);
    const conclusaoIso = (colMap[COLUNAS.demandas.veiculacao]||'').slice(0,10);
    const tipo       = colMap[COLUNAS.demandas.formato] || '—';
    const groupId    = item.group?.id || '';
    const grupo      = DEMANDAS_GROUP_MAP[groupId] || item.group?.title || groupId || '—';
    let responsavelId = '', responsavelIds = [];
    const pv = colValueMap['person'];
    if (pv) {
      try {
        const parsed = JSON.parse(pv);
        const arr = parsed.personsAndTeams || parsed.persons || [];
        responsavelIds = arr.map(p => String(p.id));
        if (responsavelIds.length > 0) responsavelId = responsavelIds[0];
      } catch(e) {}
    }
    const hoje = META.today_iso || '';
    const prazoAtrasado = !!(prazoIso && prazoIso < hoje && !['Feito','Aprovado','Concluído','Concluido','Finalizado'].includes(status));
    return {
      // contagem de tarefas da solicitação, para a fila mostrar o andamento
      tarefas: item.tarefas || 0, tarefas_feitas: item.tarefas_feitas || 0,
      id: String(item.id),
      nome: item.name || '',
      cliente, status, prioridade, tipo,
      status_color: colStyleMap['status']?.color || '',
      status_updated_at: colStyleMap['status']?.updated_at || '',
      status_border: colStyleMap['status']?.border || '',
      status_index: colStyleMap['status']?.index ?? null,
      prazo: fmtDate(prazoIso),       prazo_iso: prazoIso,       prazo_atrasado: prazoAtrasado,
      conclusao: fmtDate(conclusaoIso), conclusao_iso: conclusaoIso,
      grupo, group_id: groupId,
      responsavel: colMap['person'] || '',
      responsavel_id: responsavelId, responsavel_ids: responsavelIds,
      url: `https://gestaovybes-team.monday.com/boards/${BOARD_DEMANDAS_ID}/pulses/${item.id}`
    };
  });
}

// ─── Fluxo operacional integrado · CADASTROS → Produção / Solicitações ────────
// Os módulos são visões diferentes da mesma operação. A origem continua explícita
// para que uma solicitação não seja confundida com conteúdo editorial.
const REQUEST_STATUS_FALLBACK_COLORS = Object.freeze({
  'Nova Demanda':'#579bfc', 'Pode Fazer':'#ffbd2e', 'Em execução':'#ff6b00',
  'Em Execução':'#ff6b00', 'Feito':'#00c875', 'Concluídas':'#00c875',
  'Alteração':'#ff637a', 'Aguardando Info.':'#9d50dd', 'Aguardando Aprovação':'#579bfc'
});
const REQUEST_STATUS_ORDER = ['Nova Demanda','Pode Fazer','Em execução','Feito','Alteração','Aguardando Info.','Aguardando Aprovação'];
function operationalFlowStatus(item={}) {
  const status=String(item?.status || '').trim();
  if(!isRequestItem(item)) return status;
  return ({'Nova Demanda':'A Fazer','Em execução':'Em andamento','Em Execução':'Em andamento','Feito':'Finalizado','Aguardando Info.':'Falta Info','Aguardando Aprovação':'Para aprovação'})[status] || status;
}
function isRequestItem(item={}) { return item?.origem === 'solicitacao' || item?.board_id === BOARD_DEMANDAS_ID; }
function normalizeContentForOperational(item={}) {
  return {...item, origem:item.origem || 'producao_conteudo', origem_label:item.origem_label || 'PRODUÇÃO DE CONTEÚDO', board_id:item.board_id || BOARD_ID};
}
function normalizeRequestForOperational(item={}) {
  const completionIso=item.conclusao_iso || item.prazo_iso || '';
  return {...item,
    origem:'solicitacao', origem_label:'SOLICITAÇÃO DE DEMANDA', board_id:BOARD_DEMANDAS_ID,
    tipo_demanda:item.tipo || '', formato:item.tipo || 'Solicitação', formato_original:item.tipo || '',
    veiculacao_iso:item.veiculacao_iso || completionIso, veiculacao:item.veiculacao || item.conclusao || item.prazo || '',
    updated_at:item.updated_at || item.status_updated_at || '',
    status_context:item.status_context || null
  };
}
function unifiedOperationalItems() {
  const content=(DADOS_ALL?.length ? DADOS_ALL : DADOS || []).map(normalizeContentForOperational);
  const requests=(DADOS_DEMANDAS || []).map(normalizeRequestForOperational);
  const seen=new Set();
  return [...content,...requests].filter(item=>{ const key=`${item.board_id || ''}:${String(item.id)}`; if(seen.has(key)) return false; seen.add(key); return true; });
}
function findOperationalItem(itemId) { return unifiedOperationalItems().find(item=>String(item.id)===String(itemId)); }
function requestStatusOptions(item={}) {
  const labels=[...new Set([...REQUEST_STATUS_ORDER,...(DADOS_DEMANDAS||[]).map(row=>row.status),item.status].filter(Boolean))];
  return labels.map((label,index)=>{
    const sample=(DADOS_DEMANDAS||[]).find(row=>row.status===label);
    return {label,index:Number(sample?.status_index ?? index),color:sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f',border:sample?.status_border || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f'};
  });
}
function operationalStatusOptions(item={}) { return isRequestItem(item) ? requestStatusOptions(item) : (STATUS_OPTIONS || []); }
function renderIntegratedOperationalViews() {
  if(panelMode==='foco') renderFocusDashboard();
  else if(panelMode==='controler') renderDaController();
  else if(panelMode==='gestor') { renderManagerIntelligence(); renderManagerCalendar(); }
}
let unifiedDemandasLoading=false;
async function ensureDemandasForOperationalViews(force=false) {
  if(unifiedDemandasLoading || (!force && DADOS_DEMANDAS.length)) { renderIntegratedOperationalViews(); return; }
  unifiedDemandasLoading=true;
  try {
    const rawItems=await fetchAllDemandas();
    DADOS_DEMANDAS=processDemandas(rawItems);
    syncStatusLegendColors('#demanda-status-legend',DADOS_DEMANDAS);
    renderIntegratedOperationalViews();
  } catch(error) {
    console.warn('Solicitações indisponíveis para os módulos integrados:',error);
  } finally { unifiedDemandasLoading=false; }
}

async function refreshDemandas() {
  const btn = document.getElementById('btn-refresh');
  const icon = document.getElementById('refresh-icon');
  const loading = document.getElementById('loading');
  btn.disabled = true;
  icon.className = 'spin';
  const loadingCycle = beginLoadingCycle();
  setLoadingState({ phase:'CONECTANDO À CENTRAL DE DEMANDAS', text:'Autenticando canal de solicitações...', count:'00 / 100', code:'DEMANDAS // 00', system:'CENTRAL DE DEMANDAS EM SINCRONIA' });
  showToast('Buscando Solicitações de Demandas...', 'info', 60000);
  try {
    const rawItems = await fetchAllDemandas();
    DADOS_DEMANDAS = processDemandas(rawItems);
    syncStatusLegendColors('#demanda-status-legend', DADOS_DEMANDAS);
    buildDemandaPersonFilter();
    populateDemandaDaySelect();
    renderDemandaKPIs();
    renderDemandas();
    showToast(`✓ ${DADOS_DEMANDAS.length} demandas carregadas`, 'ok');
  } catch(e) {
    console.error(e);
    showToast(`Erro: ${e.message}`, 'err', 8000);
  } finally {
    finishLoadingCycle(loadingCycle);
    btn.disabled = false;
    icon.className = '';
    icon.textContent = '↻';
    setTimeout(() => {
      if (loadingCycle !== loadingCycleId) return;
      loading.classList.remove('show');
    }, 620);
  }
}

// Helpers de prioridade
function prioHtml(p) {
  if (!p) return '<span class="prio-none">—</span>';
  const cls = p.toLowerCase().includes('alta') ? 'prio-alta' : p.toLowerCase().includes('média') || p.toLowerCase().includes('media') ? 'prio-media' : p.toLowerCase().includes('baixa') ? 'prio-baixa' : 'prio-none';
  return `<span class="${cls}">${p}</span>`;
}

// Mapeamento de status do board Solicitações de Demandas
const STATUS_CLS_DEMANDAS = {
  'Nova Demanda':     'nova-demanda',
  'Pode Fazer':       'pode-fazer',
  'Em execução':     'em-execucao',
  'Feito':            'feito',
  'Alteração':        'alteracao-d',
  'Aguardando Info.': 'aguardando-info',
  'Em aprovação':    'em-aprovacao',
  'Aprovado':         'aprovado',
  'Em impressão':     'em-impressao',
  'Em Orçamento':     'em-orcamento',
  'Para Orçar':       'para-orcar',
  // compat
  'Em andamento':     'em-execucao',
  'Concluído':        'feito',
  'Finalizado':       'feito',
  'A Fazer':          'a-fazer',
};
function statusClsDemanda(s) { return STATUS_CLS_DEMANDAS[s] || 'default'; }
// Mesma regra da produção: sem cor explícita, a cor vem do catálogo — não de
// uma classe de CSS com a cor escrita à mão.
function pillHtmlDemanda(s, color='', border='') {
  if (!color) {
    const c = typeof corDeStatus === 'function' ? corDeStatus(s) : null;
    if (c) { color = c.cor; border = border || c.borda; }
  }
  return `<span class="pill pill-${statusClsDemanda(s)}"${statusInlineStyle(color, border)}><span class="pill-dot"${statusDotInlineStyle(color)}></span>${s}</span>`;
}

// ─── Renderizar KPIs das demandas ────────────────────────────────────────────────────────────────────
function renderDemandaKPIs() {
  const all = DADOS_DEMANDAS;
  const clientes = [...new Set(all.map(d=>d.cliente))];
  const hoje = META.today_iso || '';
  const atrasadas = all.filter(d=>d.prazo_iso && d.prazo_iso < hoje && !['Feito','Aprovado','Concluído','Concluido','Finalizado'].includes(d.status)).length;
  const kpis = [
    {label:'Total de Demandas', value:all.length, sub:'no board', cls:'purple'},
    {label:'Clientes', value:clientes.length, sub:'com demandas', cls:'green'},
    {label:'Novas / A Fazer', value:all.filter(d=>['Nova Demanda','A Fazer'].includes(d.status)).length, sub:'aguardando início', cls:'blue'},
    {label:'Em Execução', value:all.filter(d=>['Em andamento','Em Andamento','Em execução'].includes(d.status)).length, sub:'em produção', cls:'cyan'},
    {label:'Pode Fazer', value:all.filter(d=>d.status==='Pode Fazer').length, sub:'briefing pronto', cls:'yellow'},
    {label:'Concluídas', value:all.filter(d=>['Feito','Aprovado','Concluído','Concluido','Finalizado'].includes(d.status)).length, sub:'finalizadas', cls:'green'},
    {label:'Atrasadas', value:atrasadas, sub:'prazo vencido', cls:'red'},
  ];
  document.getElementById('kpi-grid-demandas').innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join('');
}

// Helper: linha de item de demanda
function demandaItemRow(d, showCliente=true) {
  // Mesmas peças da fila de produção. Antes esta linha tinha implementação
  // própria de tudo: cliente numa cápsula roxa escrita à mão, responsável em
  // texto onde a outra fila usa a foto, status que não abria, e nenhum ID.
  const atrasadoBadge = d.prazo_atrasado ? '<span class="prazo-badge">Atrasado</span>' : '';
  const data = (rotulo, valor, cor) => valor
    ? `<span class="vybe-data" style="color:${cor}" title="${rotulo}">${valor}</span>` : '';
  const dateBlock = (d.prazo || d.conclusao)
    ? `<span class="item-date vybe-datas">
        ${data('Prazo', d.prazo, '#f59e0b')}${atrasadoBadge}
        ${d.prazo && d.conclusao ? '<i class="vybe-datas-sep"></i>' : ''}
        ${data('Conclusão', d.conclusao, '#34d399')}
      </span>`
    : '<span class="item-date vybe-data">—</span>';
  return `<div class="item-row">
    ${showCliente ? vybeTagCliente(d) : ''}
    ${vybeChipId(d)}
    ${fmtHtml(d.tipo)}
    <span class="item-name">${vybeNome(d)}</span>
    ${dateBlock}
    ${prioHtml(d.prioridade)}
    ${vybeStatus(d)}
    ${vybeDono(d)}
  </div>`;
}

// Andamento das tarefas de dentro da solicitação. Sem isto, saber que 3 de 12
// já estão feitas exigia abrir a peça — e é a pergunta que se faz olhando a fila.
function tarefasHtml(d) {
  const total = Number(d?.tarefas || 0);
  if (!total) return '';
  const feitas = Number(d?.tarefas_feitas || 0);
  const completa = feitas === total;
  return `<span class="item-tarefas ${completa ? 'completa' : ''}"
    title="${feitas} de ${total} tarefa${total === 1 ? '' : 's'} concluída${feitas === 1 ? '' : 's'}">
    <i style="--feito:${Math.round((feitas / total) * 100)}%"></i>${feitas}/${total}</span>`;
}

// Ordenar por data mais recente primeiro (prazo ou conclusão, decrescente)
function sortDemandas(items) {
  const getDateKey = d => {
    // Usar a data mais recente entre prazo e conclusão
    const p = d.prazo_iso || '';
    const c = d.conclusao_iso || '';
    if (p && c) return p > c ? p : c;
    return p || c || '';
  };
  return [...items].sort((a,b) => {
    const da = getDateKey(a);
    const db = getDateKey(b);
    // Sem data vai para o final
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    // Crescente: mais antigo primeiro
    return da.localeCompare(db);
  });
}

// ─── Renderizar demandas (dispatcher por view) ────────────────────────────────────────────────────
function filtrarDemandasBase() {
  let fi = [...DADOS_DEMANDAS];
  if (currentDemandaPersonFilter !== 'all') {
    fi = fi.filter(d => (d.responsavel_ids && d.responsavel_ids.includes(currentDemandaPersonFilter)) || d.responsavel_id === currentDemandaPersonFilter);
  }
  if (currentDemandaStatusFilter !== 'all') {
    fi = fi.filter(d => d.status === currentDemandaStatusFilter);
  }
  // Filtrar por semana (exceto na esteira)
  if (currentDemandaWeek === 1) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week1_start_iso && iso <= META.week1_end_iso; });
  } else if (currentDemandaWeek === 2) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week2_start_iso && iso <= META.week2_end_iso; });
  }
  return fi;
}

function renderDemandas() {
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos('demandas');
  if (typeof renderAgendaDeDemandas === 'function') renderAgendaDeDemandas();
  const fi = filtrarDemandasBase();
  // Atualizar título da semana
  const titleEl = document.getElementById('title-demanda-semana');
  if (titleEl) {
    if (currentDemandaWeek === 1) titleEl.textContent = `Semana 1 — ${META.week1_start} a ${META.week1_end}`;
    else if (currentDemandaWeek === 2) titleEl.textContent = `Semana 2 — ${META.week2_start} a ${META.week2_end}`;
  }
  // Mostrar/ocultar painéis
  const showEsteira = currentDemandaWeek === 0;
  const showDia     = !showEsteira && currentDemandaViewDay;
  const showSemana  = !showEsteira && !currentDemandaViewDay;
  document.getElementById('panel-demandas-semana').style.display  = showSemana  ? '' : 'none';
  document.getElementById('panel-demandas-dia').style.display     = showDia     ? '' : 'none';
  document.getElementById('panel-demandas-esteira').style.display = showEsteira ? '' : 'none';
  if (showEsteira)  renderDemandasEsteira(fi);
  else if (showDia) renderDemandasDia(fi);
  else              renderDemandasSemana(fi);
}

// View: Por Semana (cards de cliente)
function renderDemandasSemana(fi) {
  const clientes = [...new Set(fi.map(d=>d.cliente))].sort();
  const grid = document.getElementById('grid-demandas-semana');
  if (clientes.length === 0) {
    const porConclusao = currentDemandaDateMode !== 'prazo';
    const outroModo = porConclusao ? 'prazo' : 'conclusao';
    const quantasNoOutro = DADOS_DEMANDAS.filter(d => {
      const iso = outroModo === 'prazo' ? (d.prazo_iso || '') : (d.conclusao_iso || '');
      const ini = currentDemandaWeek === 2 ? META.week2_start_iso : META.week1_start_iso;
      const fim = currentDemandaWeek === 2 ? META.week2_end_iso : META.week1_end_iso;
      return iso >= ini && iso <= fim;
    }).length;
    const semData = DADOS_DEMANDAS.filter(d => !getDemandaDateIso(d)).length;
    grid.innerHTML = `<div class="demandas-vazio">
      <b>Nenhuma demanda ${porConclusao ? 'concluída' : 'com prazo'} nesta semana.</b>
      <span>São ${DADOS_DEMANDAS.length} no quadro; a semana filtra pela data de
        ${porConclusao ? 'conclusão' : 'prazo'}${semData ? `, e ${semData} ainda não têm essa data` : ''}.</span>
      <div class="demandas-vazio-acoes">
        ${quantasNoOutro
          ? `<button type="button" class="sort-btn" onclick="setDemandaDateMode('${outroModo}')">
               Ver por ${porConclusao ? 'prazo' : 'conclusão'} — ${quantasNoOutro} nesta semana</button>`
          : ''}
        <button type="button" class="sort-btn" onclick="if(!gruposDeDemandasAberto) alternarGruposDeDemandas()">
          Ver as ${DADOS_DEMANDAS.length} por grupo</button>
        <button type="button" class="sort-btn" onclick="showDemandaWeek(3)">Ver todas por esteira</button>
      </div>
    </div>`;
    return;
  }
  grid.innerHTML = clientes.map(cli => {
    let items = sortDemandas(fi.filter(d => d.cliente === cli));
    if (currentDemandaDayFilter) items = items.filter(d => getDemandaDateIso(d) === currentDemandaDayFilter);
    if (items.length === 0) return '';
    const atrasadas = items.filter(d=>d.prazo_atrasado).length;
    const alertCls = atrasadas > 0 ? 'alert-low' : 'alert-ok';
    return `<div class="demanda-group-card ${alertCls}">
      <div class="demanda-group-header">
        <div class="demanda-group-title">${cli}</div>
        <span class="posts-count ok">${items.length} demanda${items.length!==1?'s':''}</span>
      </div>
      <div class="item-list">${items.map(d => demandaItemRow(d, false)).join('')}</div>
    </div>`;
  }).join('');
}

// View: Por Dia (dentro da semana selecionada)
function renderDemandasDia(fi) {
  let items = fi;
  if (currentDemandaDayFilter) items = fi.filter(d => getDemandaDateIso(d) === currentDemandaDayFilter);
  const byDay = {};
  items.forEach(d => {
    const iso = getDemandaDateIso(d);
    if (!iso) return;
    if (!byDay[iso]) byDay[iso] = [];
    byDay[iso].push(d);
  });
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const grid = document.getElementById('grid-demandas-dia');
  const sortedDays = Object.keys(byDay).sort();
  let html = sortedDays.map(iso => {
    const dt = new Date(iso+'T12:00:00');
    const dow = DIAS_LABEL[dt.getDay()];
    const fmt = `${iso.slice(8,10)}/${iso.slice(5,7)}`;
    const isHoje = iso === META.today_iso;
    const dayItems = sortDemandas(byDay[iso]);
    return `<div style="margin-bottom:18px;">
      <div class="section-title" style="margin-bottom:8px;">
        <span></span>${dow} ${fmt}${isHoje?' <span style="color:var(--accent2);font-size:11px;">(Hoje)</span>':''}
        <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:8px;">${dayItems.length} demanda${dayItems.length!==1?'s':''}</span>
      </div>
      <div class="demandas-grid">${dayItems.map(d => `<div class="demanda-group-card"><div class="item-list">${demandaItemRow(d,true)}</div></div>`).join('')}</div>
    </div>`;
  }).join('');
  grid.innerHTML = html || '<div style="color:var(--text-muted);padding:20px 0;">Nenhuma demanda com data neste período.</div>';
}

// View: Por Esteira (tab 0)
function renderDemandasEsteira(fi) {
  const grid = document.getElementById('grid-demandas-esteira');
  grid.innerHTML = DEMANDAS_GROUP_ORDER.map(grupo => {
    const items = sortDemandas(fi.filter(d => d.grupo === grupo));
    if (items.length === 0) return '';
    const icon = DEMANDAS_GROUP_ICON[grupo] || '';
    return `<div class="demanda-group-card">
      <div class="demanda-group-header">
        <div class="demanda-group-title">${icon} ${grupo}</div>
        <span class="posts-count ok">${items.length} demanda${items.length!==1?'s':''}</span>
      </div>
      <div class="item-list">${items.map(d => demandaItemRow(d, true)).join('')}</div>
    </div>`;
  }).join('');
}

