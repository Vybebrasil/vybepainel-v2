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
// "Tipo de demanda" veio do Monday quase todo vazio, e sem ele nao da para
// perguntar coisas simples: quantos impressos estao em pe? o que ainda nao foi
// classificado? A etiqueta so vira ferramenta quando da para ver quem esta sem
// ela — por isso "Sem tipo" e um filtro de primeira classe aqui, e nao uma
// ausencia que se descobre rolando a lista.
let currentDemandaTipoFilter = 'all';
// Atrasada nao e um status, e uma relacao entre o prazo e hoje — por isso
// precisa de estado proprio. Os outros tres numeros do topo nao precisam: eles
// acionam os filtros de status e de tipo que ja existem, e e assim que o cartao
// aceso e a etiqueta acesa contam sempre a mesma historia.
let currentDemandaAtrasadas = false;
// Solicitacao nao tem semana.
//
// Conteudo tem: ele e feito para veicular num dia, e a semana e a unidade em que
// a producao se organiza. Solicitacao chega quando chega e se arrasta ate alguem
// resolver — a de 26/06 ainda em execucao nao pertence a semana nenhuma. Recortar
// por semana aqui nao organizava, escondia: eram justamente as antigas, que sao
// as que pedem acao, que sumiam do recorte.
//
// As abas Semana 1 / Semana 2 sairam. Quem precisa de recorte de tempo tem o
// filtro de Dia, que agora vale em toda a tela, e o Calendario. A constante fica
// fixa em 0 porque as tres visoes ainda existem no arquivo e o resto do codigo
// as consulta; o que deixou de existir e o caminho para sair da esteira.
const currentDemandaWeek = 0;
const currentDemandaViewDay = false;
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
  if (activeBoard !== board && typeof closeTransientOverlaysForNavigation === 'function') closeTransientOverlaysForNavigation();
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

// Toggle ver por dia

// Popular select de dias da semana ativa
// Os dias disponiveis viraram uma lista do painel, nao do sistema. A funcao
// continua com o mesmo nome porque continua fazendo o mesmo: descobrir quais
// dias existem no recorte atual — so que agora guarda numa lista e escreve no
// botao o que esta escolhido.
let DIAS_DA_DEMANDA = [];
function abrirDiasDaDemanda(gatilho) {
  if (!DIAS_DA_DEMANDA.length) return showToast('Nenhum dia com solicitação neste recorte.', 'info', 3500);
  abrirListaDoPainel(gatilho, {
    titulo: 'Dia',
    atual: currentDemandaDayFilter || '',
    opcoes: [{ valor:'', rotulo:'Todos os dias' }, ...DIAS_DA_DEMANDA],
    aoEscolher: (iso) => { currentDemandaDayFilter = iso; renderDemandas(); },
  });
}
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
  DIAS_DA_DEMANDA = sorted.map((iso) => {
    const dt = new Date(iso + 'T12:00:00');
    return { valor: iso, rotulo: `${DIAS_LABEL[dt.getDay()]} ${iso.slice(8,10)}/${iso.slice(5,7)}` };
  });
  // Dia que sumiu do recorte nao pode continuar filtrando escondido.
  if (currentDemandaDayFilter && !sorted.includes(currentDemandaDayFilter)) currentDemandaDayFilter = '';
  const escolhido = DIAS_DA_DEMANDA.find((d) => d.valor === currentDemandaDayFilter);
  sel.textContent = escolhido ? escolhido.rotulo : 'Todos os dias';
  sel.classList.toggle('escolhido', Boolean(escolhido));
}

function filterDemandaByDay(sel) {
  currentDemandaDayFilter = sel.value;
  renderDemandas();
}

// ─── Buscar itens do board Demandas ────────────────────────────────────────────────────────────────────
async function fetchAllDemandas() {
  // Solicitações vivem no banco da Vybe. Em modo normal, uma falha precisa ficar
  // visível e preservar o cache; nunca pode devolver autoridade ao Monday.
  // O caminho legado abaixo só é alcançado quando a contingência administrativa
  // explícita muda fonteDeLeitura() para "espelho".
  if (fonteDeLeitura() === 'dominio') {
    const dados = await buscarDemandas();
    return demandasComoItensDoMonday(dados);
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
  'Alteração':'#ff637a', 'Aguardando Info.':'#9d50dd', 'Aguardando Aprovação':'#579bfc',
  'Para Aprovação':'#579bfc', 'Em aprovação':'#579bfc'
});
const REQUEST_STATUS_ORDER = ['Nova Demanda','Pode Fazer','Em execução','Feito','Alteração','Aguardando Info.','Para Aprovação'];
function operationalFlowStatus(item={}) {
  const status=String(item?.status || '').trim();
  if(!isRequestItem(item)) return status;
  // Todo nome que signifique "esperando aprovacao" precisa cair no MESMO estado
  // de fluxo. Faltava "Em aprovacao" — e o Modo Foco separa por estado, entao a
  // peca que a Jady mandou para aprovacao nao pertencia a grupo nenhum e sumia
  // da tela dela. Um nome fora do mapa nao vira um grupo novo: vira invisivel.
  return ({'Nova Demanda':'A Fazer','Em execução':'Em andamento','Em Execução':'Em andamento','Feito':'Finalizado','Aguardando Info.':'Falta Info','Aguardando Aprovação':'Para aprovação','Em aprovação':'Para aprovação','Em Aprovação':'Para aprovação','Para Aprovação':'Para aprovação','Aguardando aprovação':'Para aprovação'})[status] || status;
}
function isRequestItem(item={}) { return item?.origem === 'solicitacao' || item?.board_id === BOARD_DEMANDAS_ID; }
function normalizeContentForOperational(item={}) {
  return {...item, origem:item.origem || 'producao_conteudo', origem_label:item.origem_label || 'PRODUÇÃO DE CONTEÚDO', board_id:item.board_id || BOARD_ID};
}
function normalizeRequestForOperational(item={}) {
  const completionIso=item.conclusao_iso || item.prazo_iso || '';
  return {...item,
    origem:'solicitacao', origem_label:'SOLICITAÇÃO DE DEMANDA', board_id:BOARD_DEMANDAS_ID,
    // "Solicitacao" era um preenchimento para a linha nao ficar vazia, e virou um
    // tipo falso: aparecia no cartao como se fosse a classificacao da peca, e
    // escondia que ela esta SEM tipo — logo depois de a tela ganhar um filtro
    // inteiro para isso. A linha ja sabe desenhar campo vazio.
    tipo_demanda:item.tipo || '', formato:item.tipo || '', formato_original:item.tipo || '',
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
// UM STATUS SEM NINGUEM NAO PODE FINGIR TER INDICE.
//
// O indice de um status e do quadro, nao nosso — e so aparece aqui de carona,
// copiado de alguma solicitacao que ja esta naquele status. Quando NENHUMA esta
// — o caso de "Para Aprovação" — o codigo antigo caia na posicao da lista e
// entregava esse numero como se fosse o indice de verdade.
//
// Dois status ficavam entao com o mesmo numero, e o numero era a identidade do
// que a pessoa clicou: escolher "Para Aprovação" resolvia para o outro. Se o
// outro fosse o status atual da peca, a guarda de "ja esta neste status"
// entendia que nao havia nada a fazer, fechava o menu e nao dizia nada. Era
// isso que se via como o botao de aprovar nao funcionando.
//
// Sem exemplo, o indice fica nulo e assumido: quem manda e o rotulo.
function statusDoQuadroDeDemandas() {
  return (typeof CATALOGO_STATUS_DEMANDAS === 'undefined' ? [] : CATALOGO_STATUS_DEMANDAS) || [];
}
function requestStatusOptions(item={}) {
  // O quadro manda quando ele ja respondeu. A lista escrita a mao continua como
  // rede de seguranca para o primeiro desenho, antes de a leitura chegar.
  const doQuadro = statusDoQuadroDeDemandas();
  // '—' e o tracinho que o painel poe numa solicitacao SEM status. Ele entrava
  // na lista junto com os status de verdade e podia ser escolhido; escolher
  // manda um nome vazio ao servidor, que recusa. Nao ter status nao e um lugar
  // para onde se mande a peca.
  const eStatus = (rotulo) => Boolean(rotulo) && !/^[—–-]+$/.test(String(rotulo).trim());
  if (doQuadro.length) {
    const labels=[...new Set([...doQuadro.map(st=>String(st.rotulo||'').trim()),...(DADOS_DEMANDAS||[]).map(row=>row.status),item.status].filter(eStatus))];
    return labels.map((label)=>{
      const st=doQuadro.find(entry=>String(entry.rotulo||'').trim()===label);
      const sample=(DADOS_DEMANDAS||[]).find(row=>row.status===label);
      const cru=st?st.indice:sample?.status_index;
      const indice=(cru===null||cru===undefined||cru==='')?NaN:Number(cru);
      return {label,index:Number.isFinite(indice)?indice:null,
        color:st?.cor || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f',
        border:st?.borda || st?.cor || sample?.status_border || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f'};
    });
  }
  const labels=[...new Set([...REQUEST_STATUS_ORDER,...(DADOS_DEMANDAS||[]).map(row=>row.status),item.status].filter(eStatus))];
  return labels.map((label)=>{
    const sample=(DADOS_DEMANDAS||[]).find(row=>row.status===label);
    // Number(null) e 0, e 0 e indice de verdade de alguem: a checagem tem de ser
    // por ausencia, nao por conversao — senao a peca que acabou de entrar num
    // status sem indice reinventa a colisao com o indice 0.
    const cru=sample?.status_index;
    const indice=(cru===null||cru===undefined||cru==='')?NaN:Number(cru);
    return {label,index:Number.isFinite(indice)?indice:null,color:sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f',border:sample?.status_border || sample?.status_color || REQUEST_STATUS_FALLBACK_COLORS[label] || '#8f8f8f'};
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
    // Se a tela de Demandas ja estiver aberta, ela tem de acompanhar: era comum
    // o dado chegar por aqui e a tela continuar vazia ate alguem trocar de aba.
    if (typeof activeBoard !== 'undefined' && activeBoard === 'demandas') renderDemandas();
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
// Atrasada: prazo vencido e ainda nao concluida. A mesma regra em todo lugar —
// no numero do topo e no filtro que ele aciona.
const DEMANDA_CONCLUIDA = ['Feito', 'Aprovado', 'Concluído', 'Concluido', 'Finalizado'];
function demandaAtrasada(d) {
  const hoje = META.today_iso || '';
  return Boolean(d.prazo_iso && hoje && d.prazo_iso < hoje && !DEMANDA_CONCLUIDA.includes(d.status));
}

// Quatro numeros, e os quatro filtram.
//
// Eram sete, e tinham tres problemas. Nao fechavam: 1 + 5 + 34 + 316 dava 356 de
// 364, porque "Em aprovacao", "Alteracao" e "Aguardando Info." nao entravam em
// nenhum cartao — oito solicitacoes existiam no quadro e nao existiam no topo.
// Nao pediam acao: "Total 364" e "Concluidas 316" ocupavam o maior tipo da
// pagina e nao mudam nada do que se faz hoje. E nao levavam a lugar nenhum:
// "Atrasadas 12" era a unica coisa urgente ali, e nao dava para clicar nela.
//
// Agora sao quatro perguntas do dia, cada uma abrindo a lista dela. E cada
// cartao le o MESMO estado que a etiqueta de status e a de tipo usam: acender o
// cartao acende a etiqueta, e vice-versa. Sem dois lugares dizendo coisas
// diferentes sobre o mesmo filtro.
function renderDemandaKPIs() {
  const all = DADOS_DEMANDAS;
  const porStatus = (nomes) => all.filter((d) => nomes.includes(d.status)).length;
  const kpis = [
    { label:'Atrasadas', valor: all.filter(demandaAtrasada).length, sub:'prazo vencido', cls:'red',
      aceso: currentDemandaAtrasadas, acao: 'focarAtrasadas()' },
    { label:'Em execução', valor: porStatus(['Em andamento','Em Andamento','Em execução']), sub:'em produção', cls:'cyan',
      aceso: currentDemandaStatusFilter === 'Em execução', acao: "focarStatus('Em execução')" },
    { label:'Pode fazer', valor: porStatus(['Pode Fazer']), sub:'briefing pronto', cls:'yellow',
      aceso: currentDemandaStatusFilter === 'Pode Fazer', acao: "focarStatus('Pode Fazer')" },
    { label:'Sem tipo', valor: all.filter((d) => !tipoDaDemanda(d)).length, sub:'falta classificar', cls:'orange',
      aceso: currentDemandaTipoFilter === '__sem__', acao: "filtrarDemandaPorTipo('__sem__')" },
  ];
  const alvo = document.getElementById('kpi-grid-demandas');
  if (!alvo) return;
  alvo.className = 'kpi-grid kpi-grid-quatro';
  alvo.innerHTML = kpis.map((k) => `
    <button type="button" class="kpi-card ${k.cls} clicavel ${k.aceso ? 'aceso' : ''}"
      onclick="${k.acao}" title="${k.aceso ? 'Clique para mostrar todas de novo' : `Ver só as ${k.label.toLowerCase()}`}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.valor}</div>
      <div class="kpi-sub">${k.sub}</div>
    </button>`).join('');
}

function focarAtrasadas() {
  currentDemandaAtrasadas = !currentDemandaAtrasadas;
  // Atrasada e sobre o prazo, entao a coluna de data tem de ser a do prazo:
  // filtrar por atraso e continuar lendo a data de conclusao esconde o motivo.
  if (currentDemandaAtrasadas && currentDemandaDateMode !== 'prazo') {
    const botao = document.getElementById('btn-dmode-prazo');
    if (botao) return setDemandaDateMode('prazo', botao);
  }
  renderDemandas();
}
function focarStatus(status) {
  currentDemandaStatusFilter = currentDemandaStatusFilter === status ? 'all' : status;
  document.querySelectorAll('#demanda-status-legend .pill').forEach((p) => {
    p.classList.toggle('active-legend',
      currentDemandaStatusFilter !== 'all' && p.textContent.trim().toLowerCase() === status.toLowerCase());
  });
  renderDemandas();
}

// Helper: linha de item de demanda
// O CARTAO TINHA OITO PECAS SOLTAS NUMA LINHA QUE QUEBRAVA SOZINHA.
//
// Cliente, id, tipo, nome, duas datas, prioridade, status e as bolinhas, tudo
// em flex-wrap. Cada cartao quebrava num lugar diferente conforme o tamanho do
// nome, e por isso dois cartoes vizinhos nunca alinhavam nada — era essa a
// sensacao de bagunca, e nenhuma cor nova ia consertar.
//
// Agora a estrutura e FIXA, tres faixas em todo cartao:
//   1. de quem e (cliente) e o id, miudo e quieto — id de onze digitos ninguem
//      le, so copia;
//   2. o NOME, sozinho, no maior peso do cartao: e a unica coisa que se procura
//      passando o olho por uma coluna;
//   3. o rodape: status a esquerda, datas no meio, quem faz a direita — sempre
//      nessas posicoes, mesmo quando algum deles nao existe.
function demandaItemRow(d, showCliente = true) {
  const data = (rotulo, valor, classe) => valor
    ? `<span class="dem-data ${classe}" title="${rotulo}"><i>${rotulo}</i>${safeText(valor)}</span>` : '';
  const datas = `${data('Prazo', d.prazo, d.prazo_atrasado ? 'vencido' : '')}${data('Conclusão', d.conclusao, 'fim')}`;
  const selos = [
    d.prazo_atrasado ? '<span class="dem-selo atrasado">Atrasado</span>' : '',
    d.prioridade ? prioHtml(d.prioridade) : '',
    d.tipo && String(d.tipo).trim() !== '—' ? fmtHtml(d.tipo) : '',
  ].filter(Boolean).join('');

  return `<article class="item-row dem-cartao abre-resumo"
      onclick="abrirCartaoRapido('${safeText(d.id)}',event,'request')"
      title="Abrir o resumo de ${safeText(d.nome || '')}">
    <div class="dem-cartao-topo">
      ${showCliente ? vybeTagCliente(d) : ''}
      ${vybeChipId(d)}
    </div>
    <div class="dem-cartao-nome">${vybeNome(d)}</div>
    ${selos ? `<div class="dem-cartao-selos">${selos}</div>` : ''}
    <div class="dem-cartao-pe">
      <span class="dem-cartao-estado">${vybeStatus(d)}</span>
      <span class="dem-cartao-datas">${datas}</span>
      <span class="dem-cartao-donos">${vybeDono(d)}</span>
    </div>
  </article>`;
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

// Onde esta o tipo, de verdade.
//
// A lista crua de Solicitacoes guarda em 'tipo'. O normalizador que a tabela usa
// copia para 'formato' — mas, quando esta vazio, escreve "Solicitacao" no lugar
// (`formato: item.tipo || 'Solicitacao'`). Isso e bom para a linha, que precisa
// mostrar alguma coisa, e pessimo para contar: lido por 'formato', NENHUMA
// solicitacao aparece sem tipo, e era por isso que o problema nunca virava
// numero. Aqui 'tipo' manda, e 'formato_original' e a copia fiel dele; so quem
// nao tem nenhum dos dois cai no formato.
// A REGRA DO CALENDARIO, dita pelo Paulo em 01/09/2026: uma solicitacao so entra
// no calendario de conteudo se ela vai pro feed — e quem diz isso e a TAG dela.
// Card, Carrossel, Fotografia e Reels vao. Relatorio, reuniao, ajuste de site e
// o que mais aparecer nao vao: sao trabalho, mas nao sao publicacao.
//
// PARA MUDAR A REGRA, mexa so nesta lista: cada linha e o comeco do nome da tag,
// sem acento e em minusculas. Vale o comeco e nao o nome inteiro porque a mesma
// tag chega escrita de varios jeitos, e o plural do portugues troca a palavra:
// 'Carrossel' vira 'Carrosseis', 'Foto' vira 'Fotografia'. Comparar pelo comeco
// pega os dois; comparar pelo nome exato perdia metade.
const TAGS_DO_FEED = ['card', 'carross', 'foto', 'reel', 'feed'];
function chaveDeTag(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
}
function tagEhDeFeed(tag) {
  const chave = chaveDeTag(tag);
  return Boolean(chave) && TAGS_DO_FEED.some((comeco) => chave.startsWith(comeco));
}
// Sem tag nao e "nao vai pro feed" — e "ninguem disse ainda". Some do calendario
// so quem tem uma tag que diz explicitamente outra coisa; assim uma peca de feed
// que alguem esqueceu de etiquetar nunca desaparece da agenda em silencio.
function solicitacaoVaiProFeed(item) {
  const tag = tipoDaDemanda(item);
  return !tag || tagEhDeFeed(tag);
}
function solicitacaoSemTag(item) {
  return !tipoDaDemanda(item);
}
function tipoDaDemanda(d) {
  if (!d) return '';
  const bruto = String(
    'tipo' in d ? (d.tipo ?? '')
    : 'formato_original' in d ? (d.formato_original ?? '')
    : (d.formato ?? '')).trim();
  return bruto === '—' ? '' : bruto;
}
function filtrarPorTipoDeDemanda(lista) {
  if (currentDemandaTipoFilter === 'all') return lista;
  if (currentDemandaTipoFilter === '__sem__') return lista.filter((d) => !tipoDaDemanda(d));
  return lista.filter((d) => tipoDaDemanda(d) === currentDemandaTipoFilter);
}
function filtrarDemandaPorTipo(tipo) {
  currentDemandaTipoFilter = currentDemandaTipoFilter === tipo ? 'all' : tipo;
  renderDemandas();
}
function limparTipoDeDemanda() { currentDemandaTipoFilter = 'all'; renderDemandas(); }

// A fileira de tipos e desenhada a partir dos dados, nao de uma lista fixa: se
// alguem criar "Impresso" no cadastro de etiquetas, ele aparece aqui sozinho, e
// com a conta de quantos ja estao nele.
// ── dois nomes para o mesmo momento ──────────────────────────────────────────
// "Aguardando Aprovacao" e "Em aprovacao" convivem nas solicitacoes, herdados da
// epoca em que cada um escrevia o seu no Monday. Vocabulario dobrado nao e
// detalhe: quem filtra por um nao ve as do outro, e as duas listas ficam sempre
// pela metade. O aviso so aparece enquanto os dois existirem — feita a juncao,
// ele some sozinho, porque a condicao que o mostra deixa de ser verdadeira.
const APROVACAO_FINAL = 'Para Aprovação';
function chaveDeStatusDemanda(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// A JUNCAO E DOS NOMES DE ESPERA, E SO DELES.
//
// "Aprovado" tambem fala de aprovacao, e nao e nome repetido de nada: e o outro
// lado da mesma porta. Uma peca em "Para Aprovação" espera resposta; uma em
// "Aprovado" ja recebeu. Procurar por /aprova/ colocava as duas no mesmo saco e
// oferecia juntar uma na outra — apagando a diferenca entre pedir e ter, sem
// desfazer. Foi o que a lista mostrou assim que ela passou a enxergar o quadro
// inteiro.
//
// Entao o que entra e so a familia da espera: "aprovacao" sozinha, ou precedida
// de em / para / aguardando / ag. Participio nao entra.
function aprovacoesParaAbsorver() {
  const item = (DADOS_DEMANDAS || [])[0] || {};
  const daLista = typeof requestStatusOptions === 'function'
    ? requestStatusOptions(item).map((o) => String(o.label || '').trim()) : [];
  const usados = (DADOS_DEMANDAS || []).map((d) => String(d.status || '').trim());
  // O que existe no quadro conta mesmo sem ninguem nele: era exatamente o nome
  // vazio que ficava sem jeito de tirar, porque nao aparecia em lugar nenhum.
  const noQuadro = typeof statusDoQuadroDeDemandas === 'function'
    ? statusDoQuadroDeDemandas().map((st) => String(st.rotulo || '').trim()) : [];
  const todos = [...new Set([...daLista, ...usados, ...noQuadro])].filter(Boolean);
  const final = chaveDeStatusDemanda(APROVACAO_FINAL);
  const esperaAprovacao = (r) => /^(?:(?:em|para|aguardando|ag|aguardo)\s+)?aprovacao\b/.test(chaveDeStatusDemanda(r));
  return todos.filter((r) => esperaAprovacao(r) && chaveDeStatusDemanda(r) !== final);
}
function pintarAvisoDeAprovacoes() {
  const caixa = document.getElementById('demanda-tipo-legend');
  if (!caixa) return;
  document.getElementById('juntar-aprovacoes')?.remove();
  const sobrando = aprovacoesParaAbsorver();
  const podeMexer = typeof podeAdministrar === 'function' ? podeAdministrar() : false;
  if (!sobrando.length || !podeMexer) return;
  const conta = (r) => (DADOS_DEMANDAS || []).filter((d) => String(d.status || '').trim() === r).length;
  const rotulo = sobrando.length === 1
    ? `tirar "${sobrando[0]}" — vira "${APROVACAO_FINAL}"`
    : `${sobrando.length} status de aprovação — juntar em "${APROVACAO_FINAL}"`;
  caixa.insertAdjacentHTML('beforeend', `<button type="button" id="juntar-aprovacoes" class="tipo-chip juntar"
    title="${safeText(sobrando.map((r) => `${r}: ${conta(r)}`).join(' · '))}"
    onclick="juntarAprovacoes()">${safeText(rotulo)}</button>`);
}
async function juntarAprovacoes() {
  const sobrando = aprovacoesParaAbsorver();
  if (!sobrando.length) return;
  const total = sobrando.reduce((n, r) => n + (DADOS_DEMANDAS || [])
    .filter((d) => String(d.status || '').trim() === r).length, 0);
  const ok = await perguntarNoPainel({
    titulo: sobrando.length === 1 ? `Tirar "${sobrando[0]}" da lista?` : 'Juntar os status de aprovação?',
    texto: `${sobrando.join(' e ')} ${sobrando.length === 1 ? 'vira' : 'viram'} "${APROVACAO_FINAL}". `
      + (total
        ? `${total} solicitaç${total === 1 ? 'ão passa' : 'ões passam'} a usar o nome novo. `
        : 'Nenhuma solicitação está nele hoje; só o nome sai da lista. ')
      + 'Isso vale para todo mundo e não tem desfazer automático.',
    confirmar: sobrando.length === 1 ? 'Tirar da lista' : 'Juntar', perigo: true });
  if (!ok) return;
  try {
    const r = await fetch('/api/painel?area=opcoes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'unificar-status', de: sobrando, para: APROVACAO_FINAL }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível juntar.');
    showToast(d.pecas_movidas
      ? `✓ ${d.pecas_movidas} solicitação(ões) movidas · agora é "${APROVACAO_FINAL}"`
      : `✓ ${d.nota || 'Lista de status limpa.'}`, 'ok', 6000);
    await refreshDemandas();
  } catch (e) { showToast(e.message, 'err', 7000); }
}

function pintarTiposDeDemanda() {
  const caixa = document.getElementById('demanda-tipo-legend');
  if (!caixa) return;
  const base = (DADOS_DEMANDAS || []);
  if (!base.length) { caixa.innerHTML = ''; return; }
  const conta = new Map();
  let sem = 0;
  base.forEach((d) => { const t = tipoDaDemanda(d);
    if (!t) { sem += 1; return; }
    conta.set(t, (conta.get(t) || 0) + 1); });
  const cor = (rotulo) => {
    const coluna = 'dropdown_mkv8d52z';
    const o = (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
      .find((x) => x.coluna_id === coluna && x.rotulo === rotulo);
    const c = o?.cor ? { cor:o.cor, borda:o.borda || o.cor }
      : (typeof corDeOpcao === 'function' ? corDeOpcao(rotulo, coluna) : null);
    return c ? `style="background:${c.cor};border-color:${c.borda}"` : '';
  };
  const chip = (chave, rotulo, quantos, extra = '') => `<button type="button"
    class="tipo-chip ${currentDemandaTipoFilter === chave ? 'ativo' : ''} ${extra}" ${extra ? '' : cor(rotulo)}
    onclick="filtrarDemandaPorTipo('${String(chave).replace(/'/g, "\\'")}')"
    title="${extra ? 'Solicitações que ainda não têm tipo' : `Ver só ${safeText(rotulo)}`}">${
    safeText(rotulo)}<span>${quantos}</span></button>`;
  const tipos = [...conta.entries()].sort((a, b) => b[1] - a[1]);
  caixa.innerHTML = (sem ? chip('__sem__', 'Sem tipo', sem, 'sem') : '')
    + tipos.map(([rotulo, quantos]) => chip(rotulo, rotulo, quantos)).join('')
    + (currentDemandaTipoFilter !== 'all'
      ? '<button type="button" class="tipo-chip limpar" onclick="limparTipoDeDemanda()">mostrar todas</button>' : '');
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
  fi = filtrarPorTipoDeDemanda(fi);
  if (currentDemandaAtrasadas) fi = fi.filter(demandaAtrasada);
  // O filtro de dia so era aplicado nas visoes de semana. Na esteira — que e por
  // onde a tela abre — o botao "Dia" nao fazia nada: escolher um dia mudava o
  // rotulo do botao e mais nada. Agora ele filtra aqui, junto dos outros, e por
  // isso vale em toda visao.
  if (currentDemandaDayFilter) fi = fi.filter((d) => getDemandaDateIso(d) === currentDemandaDayFilter);
  // Filtrar por semana (exceto na esteira)
  if (currentDemandaWeek === 1) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week1_start_iso && iso <= META.week1_end_iso; });
  } else if (currentDemandaWeek === 2) {
    fi = fi.filter(d => { const iso = getDemandaDateIso(d); return iso >= META.week2_start_iso && iso <= META.week2_end_iso; });
  }
  return fi;
}

// "Mostrando 1 de 364, porque..."
//
// Era o que faltava. A tela dizia 364 no topo e uma linha embaixo, e nada ligava
// os dois numeros. Quem abria nao sabia distinguir "nao ha o que fazer" de "um
// filtro escondeu tudo" — e sao seis filtros nesta tela (status, tipo, atraso,
// semana, equipe, dia). Agora ela diz quanto esta mostrando, de quanto, e por
// que; cada motivo sai com um clique no proprio nome.
function pintarResumoDeFiltros(quantos) {
  const alvo = document.getElementById('demanda-resumo');
  if (!alvo) return;
  const total = (DADOS_DEMANDAS || []).length;
  const chip = (rotulo, limpar) => `<button type="button" class="resumo-chip" onclick="${limpar}"
    title="Tirar este filtro">${safeText(rotulo)}<i aria-hidden="true">✕</i></button>`;
  const ativos = [];
  if (currentDemandaAtrasadas) ativos.push(chip('atrasadas', 'focarAtrasadas()'));
  if (currentDemandaStatusFilter !== 'all') ativos.push(chip(currentDemandaStatusFilter, `focarStatus('${String(currentDemandaStatusFilter).replace(/'/g, "\\'")}')`));
  if (currentDemandaTipoFilter !== 'all') ativos.push(chip(
    currentDemandaTipoFilter === '__sem__' ? 'sem tipo' : currentDemandaTipoFilter, 'limparTipoDeDemanda()'));
  if (currentDemandaPersonFilter !== 'all') {
    const quem = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS)
      .find((u) => String(u.id) === String(currentDemandaPersonFilter));
    ativos.push(chip(quem ? firstName(quem.name) : 'uma pessoa',
      "filterDemandaByPerson('all',document.getElementById('person-all-demandas'))"));
  }
  // Dizer "um dia" obriga a pessoa a procurar QUAL. O resumo existe para
  // responder, nao para anunciar que ha uma resposta em outro lugar.
  if (currentDemandaDayFilter) {
    const dia = DIAS_DA_DEMANDA.find((d) => d.valor === currentDemandaDayFilter);
    ativos.push(chip(dia ? dia.rotulo : currentDemandaDayFilter, 'limparDiaDaDemanda()'));
  }

  if (!ativos.length) {
    alvo.innerHTML = `<span class="resumo-conta">${total} solicitaç${total === 1 ? 'ão' : 'ões'}</span>
      <span class="resumo-nota">nenhum filtro — está tudo à vista</span>`;
    return;
  }
  alvo.innerHTML = `<span class="resumo-conta">${quantos} de ${total}</span>
    <span class="resumo-nota">filtrando por</span>${ativos.join('')}
    <button type="button" class="resumo-limpar" onclick="clearDemandaFilters()">limpar tudo</button>`;
}
function limparDiaDaDemanda() {
  currentDemandaDayFilter = '';
  renderDemandas();
}

function renderDemandas() {
  // A moldura da tela (numeros do topo, filtro de equipe, lista de dias) era
  // pintada SO por refreshDemandas. E o switchBoard so chama refreshDemandas
  // quando ainda nao ha dados:
  //
  //     if (DADOS_DEMANDAS.length === 0) refreshDemandas(); else renderDemandas();
  //
  // Como o Modo Gestor carrega as solicitacoes por conta propria
  // (ensureDemandasForOperationalViews), quem passa por ele antes de abrir
  // Demandas chega com os dados prontos — e cai no ramo que nao pinta a
  // moldura. Resultado: a tela abria com o topo vazio e "Equipe" so com o botao
  // Todos, exatamente como se estivesse quebrada. Agora a moldura mora aqui,
  // junto do resto do desenho: qualquer caminho que chegue nesta tela a pinta.
  pintarTiposDeDemanda();
  pintarAvisoDeAprovacoes();
  buildDemandaPersonFilter();
  populateDemandaDaySelect();
  renderDemandaKPIs();
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos('demandas');
  if (typeof renderAgendaDeDemandas === 'function') renderAgendaDeDemandas();
  const fi = filtrarDemandasBase();
  pintarResumoDeFiltros(fi.length);
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

// TRECENTOS E TREZE CARTOES NUMA COLUNA SO.
//
// "Concluidas" guarda tudo o que ja foi entregue, e a coluna desenhava os 313 de
// uma vez. Ninguem rola trezentos cartoes de coisa pronta — o que se faz ali e
// conferir os ultimos e seguir. Cada coluna mostra os primeiros e oferece o
// resto num clique; o numero no cabecalho continua sendo o total de verdade,
// entao nada fica escondido sem ser dito.
const TETO_DA_COLUNA = 25;
let COLUNAS_ABERTAS = new Set();
function mostraTudoNaColuna(grupo) { return COLUNAS_ABERTAS.has(String(grupo)); }
function verTudoNaColuna(grupo) {
  COLUNAS_ABERTAS.add(String(grupo));
  renderDemandas();
}

// View: Por Esteira (tab 0)
function renderDemandasEsteira(fi) {
  const grid = document.getElementById('grid-demandas-esteira');
  grid.innerHTML = DEMANDAS_GROUP_ORDER.map(grupo => {
    const items = sortDemandas(fi.filter(d => d.grupo === grupo));
    const icon = DEMANDAS_GROUP_ICON[grupo] || '';
    // Coluna vazia CONTINUA na tela. Sumir com ela reordena o quadro a cada
    // filtro, e quem procurava uma etapa fica sem saber se ela nao tem nada ou
    // se ele e que errou o filtro.
    return `<div class="demanda-group-card">
      <div class="demanda-group-header">
        <div class="demanda-group-title">${icon} ${grupo}</div>
        <span class="posts-count ${items.length ? 'ok' : ''}">${items.length}</span>
      </div>
      <div class="item-list">${items.length
        ? items.slice(0, mostraTudoNaColuna(grupo) ? items.length : TETO_DA_COLUNA)
            .map(d => demandaItemRow(d, true)).join('')
          + (items.length > TETO_DA_COLUNA && !mostraTudoNaColuna(grupo)
            ? `<button type="button" class="demanda-ver-mais" onclick="verTudoNaColuna('${
                String(grupo).replace(/'/g, "\\'")}')">Ver as outras ${items.length - TETO_DA_COLUNA}</button>`
            : '')
        : '<div class="demanda-group-vazia">Nada nesta etapa agora.</div>'}</div>
    </div>`;
  }).join('');
}

