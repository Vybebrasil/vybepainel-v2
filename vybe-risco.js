// vybe-risco.js — radar de risco e SLA operacional
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
function getTomorrowIso() { const dt = new Date((HOJE_ISO || new Date().toISOString().slice(0,10)) + 'T12:00:00'); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); }

// ─── Radar de Risco e SLA operacional ────────────────────────────────────────
const RISK_READY_STATUSES = new Set(['Finalizado','Feito','Para agendar','Agendado']);
const SLA_STATUS_HOURS = Object.freeze({
  'Para aprovação': 24,
  'Ag. Aprovação Cliente': 24,
  'Ag. Interno': 24,
  'Falta Info': 24,
  'Ag. Info Cliente': 24,
  'Aguardo': 24,
  'Alteração': 24,
  'Falta D.A': 24,
  'Agendando Cap': 24,
  'Cap. Agendada': 48,
  'Falta OFF': 24,
  'Aguardo Redação': 24,
  'Segurar Post': 72
});
function riskStatusEvent(d) {
  const events = window.ACTIVITY_LOGS?.statusEvents?.[String(d.id)] || [];
  for (let i = events.length - 1; i >= 0; i--) if (events[i].status === d.status) return events[i];
  return null;
}
function formatRiskDuration(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '';
  if (hours < 24) return `${Math.max(1,Math.floor(hours))}h na etapa`;
  const days = Math.floor(hours / 24), rest = Math.floor(hours % 24);
  return `${days}d${rest ? ` ${rest}h` : ''} na etapa`;
}
function getOperationalRisk(d) {
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const tomorrow = getTomorrowIso();
  const due = getReferenceDate(d);
  const flowStatus = operationalFlowStatus(d);
  if (RISK_READY_STATUSES.has(flowStatus)) return { level:'safe', label:'Pronto', score:99, reason:'Etapa concluída para a operação', sla_label:'' };
  const event = riskStatusEvent(d);
  const hoursInStatus = event ? Math.max(0, (Date.now() - Number(event.tsMs || 0)) / 3600000) : null;
  const slaHours = SLA_STATUS_HOURS[flowStatus] || 0;
  const isBlocked = Boolean(slaHours);
  const slaLabel = isBlocked && hoursInStatus !== null ? formatRiskDuration(hoursInStatus) : '';
  const slaBreached = isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours;
  const slaCritical = isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours * 2;
  if (due && due < today) return { level:'critical', label:'Prazo vencido', score:0, reason:isBlocked ? 'Prazo vencido e dependência sem resolução' : 'Prazo de entrega vencido', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (slaCritical) return { level:'critical', label:'SLA estourado', score:1, reason:`${flowStatus} excedeu ${Math.round(hoursInStatus)}h`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (due === today && !RISK_READY_STATUSES.has(flowStatus)) return { level:'high', label:'Prazo hoje', score:2, reason:isBlocked ? 'Depende de resolução ainda hoje' : 'Precisa avançar hoje', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (slaBreached) return { level:'high', label:'SLA vencido', score:3, reason:`${flowStatus} ultrapassou o SLA de ${slaHours}h`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (due === tomorrow && ['A Fazer','Pode Fazer','Falta D.A','Falta Info','Aguardo','Alteração'].includes(flowStatus)) return { level:'attention', label:'Prazo amanhã', score:4, reason:'Ainda precisa avançar antes do próximo prazo', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours * .5) return { level:'attention', label:'SLA em curso', score:5, reason:`${flowStatus} já consumiu metade do SLA`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  return { level:'safe', label:'No prazo', score:99, reason:'Sem sinal crítico nas regras atuais', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
}
function applyOperationalRisk(items) {
  (items || []).forEach(d => { d.operational_risk = getOperationalRisk(d); });
  return items;
}

// Toda sinalização crítica passa a indicar quem tem a próxima ação de destrava.
function riskActionOwner(d) {
  const status = String(d?.status || '');
  const requester = String(d?.status_context?.requester || '').trim();
  const responsible = (assignedIds(d).map(id => TEAM_USERS.find(u => String(u.id) === String(id))).filter(Boolean)[0]?.name || String(d?.responsavel || '')).trim();
  if (!assignedIds(d).length) return { owner:'Operação', source:'cadastro', action:'atribuir um responsável antes de seguir' };
  if (['Falta Info','Ag. Info Cliente','Aguardo','Ag. Aprovação Cliente'].includes(status)) return { owner:requester || 'Atendimento / Cliente', source:'cliente', action:'cobrar o retorno ou material pendente' };
  if (status === 'Falta D.A') return { owner:'Deivid · D.A.', source:'direção', action:'definir a direção visual necessária' };
  if (status === 'Alteração') return { owner:requester || responsible || 'Responsável atual', source:'revisão', action:'alinhar o ajuste e devolver o próximo passo' };
  if (status === 'Ag. Interno') return { owner:requester || 'Operação', source:'interno', action:'definir quem valida e liberar a próxima etapa' };
  if (status === 'Em andamento') return { owner:responsible || 'Responsável atual', source:'execução', action:'registrar avanço ou sinalizar uma trava' };
  return { owner:responsible || 'Responsável atual', source:'execução', action:'confirmar início e proteger o prazo' };
}
function riskSeverityLabel(d) {
  const risk = d?.operational_risk || getOperationalRisk(d || {});
  if (risk.level === 'critical') return 'ESCALAÇÃO';
  if (risk.level === 'high') return 'AÇÃO HOJE';
  if (risk.level === 'attention') return 'ATENÇÃO';
  return 'INFORMATIVO';
}
function riskActionHtml(d, compact=false) {
  const next = riskActionOwner(d);
  return `<span class="risk-action-owner ${compact ? 'compact' : ''}" title="Próxima ação: ${safeText(next.action)}"><b>${safeText(riskSeverityLabel(d))}</b><span>→ ${safeText(next.owner)}</span></span>`;
}
function riskBadgeHtml(d, compact=false) {
  const risk = d?.operational_risk || getOperationalRisk(d || {});
  if (!risk || risk.level === 'safe') return '';
  const label = compact ? risk.label.replace('Prazo ','') : risk.label;
  return `<span class="risk-level ${risk.level}" title="${safeText(risk.reason || risk.label)}">${risk.level === 'critical' ? '⚑' : risk.level === 'high' ? '!' : '◌'} ${safeText(label)}</span>`;
}
function priorityData(d) {
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const tomorrow = getTomorrowIso();
  const due = getReferenceDate(d);
  const statusWeight = {'Falta Info':0,'Alteração':0,'Falta D.A':1,'A Fazer':2,'Pode Fazer':3,'Aguardo':4,'Para aprovação':5,'Ag. Aprovação Cliente':5,'Para agendar':6,'Agendado':7};
  let dateWeight = 3;
  if (due && due < today) dateWeight = 0;
  else if (due === today) dateWeight = 1;
  else if (due === tomorrow) dateWeight = 2;
  return { score: dateWeight * 10 + (statusWeight[d.status] ?? 8), dateWeight, due };
}
function priorityColor(d) {
  const p = priorityData(d);
  if (p.dateWeight === 0 || ['Falta Info','Alteração'].includes(d.status)) return '#ff4d6d';
  if (p.dateWeight <= 2 || ['Falta D.A','A Fazer'].includes(d.status)) return '#ffe600';
  if (['Para agendar','Agendado'].includes(d.status)) return '#00ff88';
  return '#ff6b00';
}

// No Modo Foco, prazo é a referência de trabalho. Tainara opera por veiculação/publicação.
const TAINARA_USER_ID = PESSOAS.TAINARA;
function focusUsesVeiculacao(user) { return String(user?.id || '') === TAINARA_USER_ID; }
function focusReferenceDate(d, user=focusUser()) { return focusUsesVeiculacao(user) ? (d.veiculacao_iso || '') : (d.prazo_iso || ''); }
function focusReferenceLabel(d, user=focusUser()) { return focusUsesVeiculacao(user) ? (d.veiculacao || 'Sem veiculação') : (d.prazo || 'Sem prazo'); }
function focusSort(items, user) {
  return [...items].sort((a,b) => {
    const da = focusReferenceDate(a,user) || '9999-12-31';
    const db = focusReferenceDate(b,user) || '9999-12-31';
    return da.localeCompare(db) || safeText(a.cliente).localeCompare(safeText(b.cliente));
  });
}
function focusStatusExplanation(status) {
  const map = {
    'Em andamento':'Em execução por você',
    'Pode Fazer':'Pronto para você executar',
    'A Fazer':'Conteúdo ainda não iniciado',
    'Para aprovação':'Entregue por você; aguardando aprovação',
    'Ag. Aprovação Cliente':'Entregue; aguardando aprovação do cliente',
    'Ag. Interno':'Entregue; aguardando retorno interno',
    'Falta Info':'Aguardando informação ou material',
    'Ag. Info Cliente':'Aguardando informação do cliente',
    'Aguardo':'Aguardando retorno para seguir',
    'Falta D.A':'Aguardando Direção de Arte',
    'Cap. Agendada':'Captação já está agendada',
    'Agendando Cap':'Captação ainda está sendo organizada',
    'Falta OFF':'Aguardando a etapa OFF',
    'Aguardo Redação':'Aguardando redação',
    'Segurar Post':'Publicação pausada',
    'Para agendar':'Pronto para agendar',
    'Agendado':'Já agendado'
  };
  return map[status] || '';
}
function focusTaskTone(status) {
  if (status === 'Em andamento' || status === 'Em execução') return '#ff6b00';
  if (['Pode Fazer','A Fazer'].includes(status)) return '#ffbd2e';
  if (['Para aprovação','Ag. Aprovação Cliente','Ag. Interno'].includes(status)) return '#579bfc';
  if (['Falta Info','Ag. Info Cliente','Aguardo'].includes(status)) return '#9d50dd';
  if (['Falta D.A','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(status)) return '#ff4d6d';
  return '#a58c79';
}
function focusStatusButtonHtml(d) {
  return `<button type="button" class="focus-status-btn" onclick="openStatusEditor(event,'${d.id}')" title="Atualizar status no Vybe OS">${pillHtml(d.status,d.status_color,d.status_border)}</button>`;
}
function operationalOriginTag(item={}) { const request=isRequestItem(item); return `<span class="operational-origin-tag ${request?'request':'content'}" title="Origem operacional: ${request?'Solicitação de Demandas':'Produção de Conteúdo'}">${request?'SOLICITAÇÃO':'CONTEÚDO'}</span>`; }
// AS DUAS DATAS, COM NOME.
//
// A linha mostrava uma data so, nua. E nao era sempre a mesma: a fila usa prazo
// para quase todo mundo e veiculacao para quem trabalha por data de publicacao —
// entao a mesma tela mostrava coisas diferentes para pessoas diferentes, sem
// dizer qual. Quem olha nao tem como saber se aquele 31/08 e o dia de entregar
// ou o dia de ir ao ar.
//
// Agora aparecem as duas, cada uma com o proprio nome, e a que MANDA na fila
// daquela pessoa fica em destaque. Em solicitacao a segunda data chama
// "Conclusao"; em conteudo, "Veiculacao" — o mesmo vocabulario da tabela.
function focusDatasHtml(d, user = focusUser()) {
  const ehPedido = typeof isRequestItem === 'function' && isRequestItem(d);
  const porVeiculacao = focusUsesVeiculacao(user);
  const nomeDaSegunda = ehPedido ? 'Conclusão' : 'Veiculação';
  const dia = (iso, texto) => {
    const bruto = String(texto || '').trim();
    if (bruto) return bruto;
    const limpo = String(iso || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? limpo.split('-').reverse().join('/') : '';
  };
  const prazo = dia(d.prazo_iso, d.prazo);
  const segunda = dia(d.veiculacao_iso, d.veiculacao);
  const atrasado = d.prazo_iso && d.prazo_iso < (HOJE_ISO || '');
  const marca = (rotulo, valor, manda, alerta) => valor
    ? `<span class="focus-data ${manda ? 'manda' : ''} ${alerta ? 'atrasada' : ''}"><b>${rotulo}</b>${safeText(valor)}</span>`
    : '';
  // Duas datas iguais nao sao duas informacoes. "PRAZO 01/09 VEICULAÇÃO 01/09"
  // ocupa o dobro do espaco para dizer uma coisa so — e a linha inteira fica
  // parecendo cheia de numero. Quando coincidem, aparece uma, com os dois nomes.
  const mesmaData = prazo && segunda && prazo === segunda;
  const partes = mesmaData
    ? [marca(`Prazo e ${nomeDaSegunda.toLowerCase()}`, prazo, true, atrasado)]
    : [
        marca('Prazo', prazo, !porVeiculacao, atrasado),
        marca(nomeDaSegunda, segunda, porVeiculacao, false),
      ].filter(Boolean);
  if (!partes.length) return '<span class="focus-data vazia">sem data</span>';
  return `<span class="focus-datas">${partes.join('')}</span>`;
}

function focusTaskHtml(d, contextText='', opcoes={}) {
  const user = focusUser();
  const deadline = focusReferenceDate(d, user);
  const dateLabel = focusReferenceLabel(d, user);
  const flowStatus = operationalFlowStatus(d);
  const color = focusTaskTone(flowStatus);
  const late = deadline && deadline < (HOJE_ISO || '');
  const risk = d.operational_risk || getOperationalRisk(d);
  const isRunning = flowStatus === 'Em andamento';
    const timerHtml = isRunning && d.status_updated_at ? `<span class="live-timer" data-start="${d.status_updated_at}" style="margin-left:8px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.06);color:#a6f8ff;font:700 11px var(--mac-mono, monospace);letter-spacing:1px;border:1px solid rgba(0,240,255,0.2);display:inline-block;vertical-align:middle;">00:00:00</span>` : '';
    // O texto de contexto e do GRUPO — 'Pronto para voce executar' aparecia
    // igual nas cinco linhas. Fica so na primeira, como quem diz a regra uma
    // vez; nas outras sobra o que de fato muda.
    const contexto = opcoes.primeira ? (contextText || focusStatusExplanation(flowStatus) || d.status) : '';
    const baseMeta = [contexto, late ? '⚠️ Atrasado' : '', risk.sla_label || ''].filter(Boolean).join(' • ');
    const meta = baseMeta;
    const finalMetaHtml = safeText(meta) + focusDatasHtml(d, user) + timerHtml;
  return `<div class="focus-task ${opcoes.primeira ? 'primeira' : ''}" style="--priority-color:${color}">
    <span class="focus-task-priority"></span>
    <div class="focus-task-title"><div class="focus-task-client">${safeText(d.cliente)}</div><div class="focus-task-name"><button type="button" class="focus-task-open" onclick="openItemWorkspace('${d.id}')">${safeText(d.nome)}</button>${opcoes.origemVaria === false ? '' : operationalOriginTag(d)}${opcoes.riscoVaria === false ? '' : (riskBadgeHtml(d,true) ? `<span class="focus-risk">${riskBadgeHtml(d,true)}</span>` : '')}</div></div>
    <div class="focus-task-meta">${finalMetaHtml}</div>
    <div style="display:flex;align-items:center;gap:7px;justify-content:flex-end;">${quickDateTrigger(d,'focus-date-trigger')}${opcoes.donoVaria === false ? '' : ownerEditorTrigger(d,'focus-owner-trigger')}${focusStatusButtonHtml(d)}</div>
  </div>`;
}

let statusEditorItemId = '';
function closeStatusEditor() {
  document.getElementById('status-editor-backdrop')?.remove();
  document.getElementById('status-editor')?.remove();
  statusEditorItemId = '';
}
// Popover ancorado no controle que o abriu. O cálculo antigo alinhava a BORDA
// DIREITA do painel com a borda direita da pílula, então um painel de 310px
// pendurava 300px para a esquerda de um controle de 90px e parecia solto na
// tela. Alinha pela esquerda, sobe quando não cabe embaixo e nunca vaza da
// janela — e mede depois de entrar no DOM, senão a altura é um chute.
function ancorarPopover(menu, rect) {
  const margem = 10;
  menu.style.visibility = 'hidden';
  menu.style.top = '0px';
  menu.style.left = '0px';
  const { width, height } = menu.getBoundingClientRect();
  const cabeAbaixo = rect.bottom + 6 + height <= window.innerHeight - margem;
  const desejado = cabeAbaixo ? rect.bottom + 6 : rect.top - 6 - height;
  // O popover nunca sai da tela, mesmo quando o que o ancora esta fora dela.
  // Acontecia ao abrir o cartao de uma peca listada dentro de outro popover: a
  // ficha clicada ficava abaixo da dobra, e o cartao nascia com metade cortada.
  // Sem teto, so o topo era protegido; agora o rodape tambem.
  const limite = window.innerHeight - height - margem;
  const top = height + margem * 2 >= window.innerHeight ? margem
    : Math.min(Math.max(margem, desejado), Math.max(margem, limite));
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(Math.min(Math.max(margem, rect.left), Math.max(margem, window.innerWidth - width - margem)))}px`;
  menu.style.visibility = '';
}

// O conserto onde a duvida nasce.
//
// A juncao dos dois nomes de aprovacao morava num botao na tela de Demandas. So
// que a duvida — "qual a diferenca entre estes dois?" — nasce AQUI, com a lista
// aberta. Fazer a pessoa sair da tela, achar outra tela e achar um botao para
// resolver o que esta na frente dela e um jeito de garantir que nao vai ser
// resolvido. Entao a saida aparece junto do problema, so para quem administra e
// so enquanto os dois existirem.
function juntarAprovacaoNoSeletorHtml(item) {
  if (typeof isRequestItem !== 'function' || !isRequestItem(item)) return '';
  if (typeof podeAdministrar !== 'function' || !podeAdministrar()) return '';
  if (typeof aprovacoesParaAbsorver !== 'function') return '';
  const sobrando = aprovacoesParaAbsorver();
  if (!sobrando.length) return '';
  return `<button type="button" class="status-editor-arrumar"
    onclick="closeStatusEditor();juntarAprovacoes()"
    title="${safeText(sobrando.join(' · '))} deixam de existir; tudo passa a ser Para Aprovação">
    juntar “${safeText(sobrando[0])}” em “Para Aprovação”</button>`;
}

function openStatusEditor(event, itemId) {
  event.preventDefault();
  event.stopPropagation();
  closeStatusEditor();
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Item não encontrado para atualização.', 'err');
  const statusOptions = operationalStatusOptions(item);
  if (!statusOptions.length) return showToast('As opções de status ainda estão carregando.', 'info');
  statusEditorItemId = String(itemId);
  const rect = event.currentTarget.getBoundingClientRect();
  const backdrop = document.createElement('div');
  backdrop.id = 'status-editor-backdrop';
  backdrop.className = 'status-editor-backdrop';
  backdrop.onclick = closeStatusEditor;
  const menu = document.createElement('div');
  menu.id = 'status-editor';
  menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">${isRequestItem(item)?'Solicitação':'Status'}</div>${statusOptions.map(o => `<button type="button" class="status-editor-option ${o.index === item.status_index ? 'current' : ''}" onclick="updateFocusStatus('${item.id}',${o.index})"><span class="status-editor-dot" style="background:${o.color};color:${o.color}"></span><span>${safeText(o.label)}</span>${o.index === item.status_index ? '<span class="status-editor-check">✓</span>' : ''}</button>`).join('')}${juntarAprovacaoNoSeletorHtml(item)}`;
  document.body.append(backdrop, menu);
  ancorarPopover(menu, rect);
}
function updateLocalStatus(itemId, option) {
  const logs = window.ACTIVITY_LOGS || (window.ACTIVITY_LOGS = {moveEvents:{}, prazoEvents:{}, statusEvents:{}});
  logs.statusEvents = logs.statusEvents || {};
  const key = String(itemId);
  logs.statusEvents[key] = logs.statusEvents[key] || [];
  logs.statusEvents[key].push({ status: option.label, previousStatus: '', date: HOJE_ISO || '', tsMs: Date.now() });
  [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach(list => (list || []).forEach(d => {
    if (String(d.id) !== key) return;
    d.status = option.label;
    d.status_color = option.color;
    d.status_border = option.border;
    d.status_index = option.index;
    d.operational_risk = getOperationalRisk(d);
  }));
}
const HANDOFF_TARGET_STATUSES = new Set(['ag. aprovação cliente']);
// 'para agendar' saiu daqui: entrar nesse status e dizer "a peca esta pronta,
// falta marcar a hora" — nao e a entrega em si, e o checklist de qualidade antes
// dele virava pedagio. 'agendado' fica, mas na pratica quem manda nele e a
// revisao de material, que roda antes desta.
const QUALITY_TARGET_STATUSES = new Set(['agendado']);
const MATERIAL_REVIEW_TARGET_STATUSES = new Set(['agendado','finalizado','feito']);
// Status que nao pedem justificativa escrita para entrar.
//
// 'Pode Fazer' e o mais comum de todos: e o que significa "o briefing esta de pe,
// pode comecar". Nao e uma volta nem um bloqueio — nao ha o que justificar, e
// obrigar a escrever um motivo em cada peca liberada era um pedagio na parte
// mais repetida do dia.
//
// 'Finalizado' entra pelo mesmo motivo: ali a trava que importa e a conferencia
// visual do material, nao o texto.
// 'para agendar' precisa entrar AQUI junto com a saida do checklist. Sem isso, o
// portao nao some — troca de nome: statusNeedsContext e "nao esta livre e nenhum
// outro portao pegou", entao tirar de um so empurra a peca para o outro.
const CONTEXT_FREE_STATUSES = new Set(['em andamento','em execução','em execucao',
  'finalizado','feito','pode fazer','a fazer','para agendar']);
// Mandar para aprovacao nao e prestar contas — e mostrar o que ficou pronto.
//
// O portao antigo pedia motivo escrito, proxima pessoa e link de referencia
// antes de deixar a peca entrar em "Aguardando Aprovacao". Isso faz sentido
// quando a mudanca precisa de justificativa (uma volta, um bloqueio); aqui nao:
// quem terminou quer olhar a arte uma ultima vez e mandar. O texto obrigatorio
// virava um pedagio, e pedagio na hora de entregar e o jeito mais rapido de o
// time parar de usar o painel.
//
// Entao estas passam a abrir a arte no centro da tela, com voltar e confirmar —
// e nada mais.
const CONFERENCIA_VISUAL_STATUSES = new Set([
  'para aprovação', 'para aprovacao',
  // Os dois nomes antigos ficam ate a juncao ser feita em todos os ambientes.
  'aguardando aprovação', 'aguardando aprovacao',
  'em aprovação', 'em aprovacao',
]);
function statusNeedsConferenciaVisual(option) {
  return Boolean(option) && CONFERENCIA_VISUAL_STATUSES.has(normalizedWorkflowStatus(option.label));
}
let pendingWorkflowChange = null;
function normalizedWorkflowStatus(status='') { return String(status).trim().toLowerCase(); }
function statusNeedsHandoff(item, option) { return item && option && HANDOFF_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && normalizedWorkflowStatus(item.status) !== normalizedWorkflowStatus(option.label); }
function statusNeedsMaterialReview(option) { return option && MATERIAL_REVIEW_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)); }
function statusNeedsQuality(option) { return option && QUALITY_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && !statusNeedsMaterialReview(option); }
function statusNeedsContext(option) {
  const status = normalizedWorkflowStatus(option?.label);
  // Finalizado não exige justificativa: a única trava é a conferência visual do material.
  return Boolean(status) && !CONTEXT_FREE_STATUSES.has(status) && !statusNeedsQuality(option)
    && !statusNeedsMaterialReview(option) && !statusNeedsConferenciaVisual(option);
}
function workflowItemHtml(item, target='') { return `<div class="workflow-item"><span class="workflow-item-client">${safeText(item.cliente || 'Cliente não informado')}</span><span class="workflow-item-name">${safeText(item.nome)}${target ? ` <small style="color:#ffb850">→ ${safeText(target)}</small>` : ''}</span></div>`; }
function closeWorkflowModal() { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); pendingWorkflowChange = null; }
function openWorkflowModal(html) { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); const back=document.createElement('div'); back.id='workflow-backdrop'; back.className='workflow-backdrop'; back.onclick=closeWorkflowModal; const modal=document.createElement('section'); modal.id='workflow-modal'; modal.className='workflow-modal'; modal.innerHTML=html; document.body.append(back,modal); }
// Todo registro de histórico do painel passa por aqui — checklist de qualidade,
// troca de responsáveis, ajuste de prazo. Ligando esta função, o histórico
// inteiro passa a nascer no banco da Vybe em vez de nascer no Monday.
// A NOTA NUNCA SEGURA O TRABALHO.
//
// Isto aqui grava a nota no historico da peca — "fulano mudou de X para Y, e o
// motivo foi este". Toda troca de status passa por ela ANTES de a troca
// acontecer, e ela estava deixando o erro subir. Resultado: se a nota falhasse
// por qualquer razao, a troca de status era abortada e a pessoa via so um erro
// vermelho. Foi o que o time viu tentando mudar para "Agendar".
//
// A ordem estava certa (registrar antes de mexer), a consequencia e que estava
// errada: o que a pessoa PEDIU foi trocar o status; a nota e efeito colateral.
// Agora, se a nota nao entrar, ela avisa e devolve false — e quem chamou segue
// em frente. Melhor uma peca certa com o historico incompleto do que uma peca
// parada com o historico limpo.
async function postItemUpdate(itemId, body) {
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null) || { id: itemId };
  try {
    const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'comentario', item:String(itemId), texto:String(body) });
    if (pelaEscritaDupla) return true;
    const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
    return await mondayQuery(mutation, { item:String(itemId), body:String(body) });
  } catch (erro) {
    console.warn('Nota de histórico não gravada:', erro);
    showToast('A alteração foi feita. A nota no histórico não pôde ser gravada.', 'info', 6000);
    return false;
  }
}
function qualityChecklistFor(item) { const fmt = String(item.formato || item.tipo || '').toLowerCase(); const common=['Arquivo final correto e sem versão provisória','Copy, legenda e CTA revisados','Cliente e responsável pela publicação confirmados']; if (/reels|vídeo|video|motion|fotografia/.test(fmt)) return [...common,'Capa, áudio e proporção validados','Link de entrega ou arquivo final disponível']; if (/carrossel/.test(fmt)) return [...common,'Sequência das páginas revisada','Capa e última página com CTA confirmadas']; return [...common,'Dimensões e identidade visual conferidas','Link ou arquivo final disponível']; }
function updateQualityGateState() { const form=document.getElementById('quality-checklist-form'); const button=document.getElementById('quality-submit'); if (!form || !button) return; button.disabled=[...form.querySelectorAll('input[type=checkbox]')].some(input => !input.checked); }
function openQualityGate(item, option) { if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); pendingWorkflowChange={item,option,manual:false}; const checks=qualityChecklistFor(item); openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Qualidade antes da publicação</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Checklist de qualidade</h2><p class="workflow-copy">Antes de enviar este conteúdo para ${safeText(option.label)}, confira a prévia e confirme os pontos essenciais. O registro fica no histórico da peça.</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout material-review-layout"><div class="status-context-main"><form id="quality-checklist-form" class="workflow-checks" onchange="updateQualityGateState()">${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" name="check-${index}"><span>${safeText(check)}</span></label>`).join('')}</form><p class="workflow-hint">Este controle vale para mudanças feitas dentro da Vybe OS. Alterações diretas no Monday não passam por este fluxo.</p></div><aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia para conferência</b><small>arquivo vinculado</small></div><div id="material-review-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside></div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="quality-submit" type="button" class="workflow-primary" disabled onclick="submitQualityChecklist()">Validar e continuar →</button></div>`); document.getElementById('workflow-modal')?.classList.add('status-context-split','material-review-modal'); loadMaterialReviewPreview(item.id); }
async function submitQualityChecklist() { const flow=pendingWorkflowChange; const form=document.getElementById('quality-checklist-form'); if (!flow || !form) return; const checks=[...form.querySelectorAll('label')].map(label=>label.textContent.trim()).filter(Boolean); const button=document.getElementById('quality-submit'); if (button) button.disabled=true; try { await postItemUpdate(flow.item.id, `[Vybe OS · Checklist de qualidade]\nDestino: ${flow.option.label}\nFormato: ${flow.item.formato || flow.item.tipo || 'Conteúdo'}\nValidado: ${checks.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if (statusNeedsHandoff(item,option)) openHandoffGate(item,option); else await commitStatusChange(item,option); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o checklist: ${e.message}`,'err',7000); } }
function materialReviewChecklistFor(item, option) { const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const format=String(item?.formato||item?.tipo||'conteúdo'); return scheduled ? [`Conferi a prévia final de ${format} antes do agendamento`,`Confirmei que legenda, CTA, canal e data de publicação estão corretos`,`O arquivo ou link aberto corresponde a esta demanda`] : [`Conferi a prévia do material entregue ou publicado`,`Confirmei que o destino final corresponde a esta demanda`,`Não há pendência de publicação ou material incorreto antes de finalizar`]; }
function updateMaterialReviewState(){ const checks=[...document.querySelectorAll('input[data-material-review-check]')]; const button=document.getElementById('material-review-submit'); if(button) button.disabled=!checks.length||checks.some(check=>!check.checked); }
function materialReviewPreviewFailed(image){ const fallback=String(image?.dataset?.fallbackSrc||''); if(fallback&&image.dataset.fallbackTried!=='true'){ image.dataset.fallbackTried='true'; image.src=fallback; return; } const holder=image.closest('.status-context-preview-media'); if(holder) holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Abra o material vinculado para conferir o arquivo final.</div>'; }
async function loadMaterialReviewPreview(itemId){
  const holder=document.getElementById('material-review-preview');
  if(!holder) return;
  try {
    const detail=await fetchWorkspaceItem(itemId);
    const assets=statusContextPreviewAssets(detail);
    const delivery=workspaceDeliveryInfo(detail);
    const open=delivery?.url?`<a class="material-review-open" href="${safeText(delivery.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a>`:'';
    PREVIA_MATERIAL=assets;
    PREVIA_GRANDE_INDICE=0;
    if(!assets.length){
      holder.innerHTML=`<div class="status-context-preview-empty"><b>Sem prévia visual</b>${delivery?.url?'Há um material vinculado. Abra-o antes de confirmar a conferência.':'Nenhum arquivo ou link final foi localizado nesta demanda.'}${open}</div>`;
      return;
    }
    const primeira=assets[0];
    const fonte=primeira.url_thumbnail||primeira.public_url||primeira.url||'';
    if(!fonte){
      holder.innerHTML=`<div class="status-context-preview-empty"><b>Arquivo sem prévia</b>${delivery?.url?'Abra o material vinculado para conferir o arquivo final.':'O item não disponibiliza imagem de visualização.'}${open}</div>`;
      return;
    }
    // Com mais de uma arte, as demais viram miniaturas clicáveis — conferir só a
    // primeira e aprovar seria aprovar no escuro o resto do carrossel.
    const tira=assets.length>1
      ? `<div id="material-review-strip" class="material-review-strip">${assets.map((a,i)=>`<button type="button" class="${i===0?'ativa':''}" title="${safeText(a.name||'')}" onclick="trocarPreviaMaterial(${i})"><img src="${safeText(a.url_thumbnail||a.public_url||a.url||'')}" alt=""></button>`).join('')}</div>`
      : '';
    holder.innerHTML=`<img id="material-review-img" src="${safeText(fonte)}" alt="Prévia de ${safeText(primeira.name||'material')}" loading="eager" title="Clique para ver em tamanho grande" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)" onerror="materialReviewPreviewFailed(this)"><small id="material-review-caption" class="status-context-preview-caption">${assets.length>1?`(1/${assets.length}) `:''}${safeText(primeira.name||'Prévia vinculada ao item')}</small><button type="button" class="previa-grande-abrir" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)">CONFERIR EM TAMANHO GRANDE ⤢</button>${tira}${open}`;
  } catch(error){
    holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. Feche e tente novamente antes de confirmar.</div>';
  }
}
function openMaterialReviewGate(item,option){ const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const checks=materialReviewChecklistFor(item,option); pendingWorkflowChange={item,option,manual:false}; const title=scheduled?'Conferir antes de agendar':'Conferir antes de finalizar'; const copy=scheduled?'Antes de liberar o agendamento, confira a prévia e valide que o material, a publicação e o canal correspondem a esta demanda.':'Antes de marcar como finalizado, confira a prévia do material postado ou entregue. Não é necessário explicar o motivo do encerramento.'; const action=scheduled?'CONFIRMAR E AGENDAR →':'CONFIRMAR E FINALIZAR →'; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Conferência final</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">${title}</h2><p class="workflow-copy">${copy}</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout material-review-layout"><div class="status-context-main"><form id="material-review-form" class="workflow-checks" onchange="updateMaterialReviewState()">${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" data-material-review-check name="material-review-${index}"><span>${safeText(check)}</span></label>`).join('')}</form><p class="workflow-hint">Esta conferência é registrada no histórico da peça junto com a mudança de status. Nenhuma justificativa é exigida para finalizar.</p></div><aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia para conferência</b><small>arquivo vinculado</small></div><div id="material-review-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside></div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="material-review-submit" type="button" class="workflow-primary" disabled onclick="submitMaterialReview()">${action}</button></div>`); document.getElementById('workflow-modal')?.classList.add('status-context-split','material-review-modal'); loadMaterialReviewPreview(item.id); updateMaterialReviewState(); }
async function submitMaterialReview(){ const flow=pendingWorkflowChange; const checks=[...document.querySelectorAll('input[data-material-review-check]')]; if(!flow||!checks.length) return; if(checks.some(check=>!check.checked)) return showToast('Confirme a conferência visual antes de continuar.','info'); const button=document.getElementById('material-review-submit'); if(button){button.disabled=true;button.textContent='Registrando...';} try { const checked=checks.map(check=>check.parentElement.textContent.trim()).filter(Boolean); await postItemUpdate(flow.item.id,`[Vybe OS · Conferência final]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMaterial conferido: ${checked.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); await commitStatusChange(item,option); } catch(error){ if(button){button.disabled=false;button.textContent=normalizedWorkflowStatus(flow?.option?.label)==='agendado'?'CONFIRMAR E AGENDAR →':'CONFIRMAR E FINALIZAR →';} showToast(`Não foi possível registrar a conferência: ${error.message}`,'err',7000); } }
// ── conferencia visual ────────────────────────────────────────────────────────
// A arte no centro, e duas saidas: voltar ou mandar. Sem campo obrigatorio, sem
// checklist, sem trava. Se a peca tiver mais de um arquivo, da para passar entre
// eles — quem confere quer ver o que vai ser aprovado, nao so o primeiro.
let CONFERENCIA_INDICE = 0;
function abrirConferenciaVisual(item, option) {
  pendingWorkflowChange = { item, option, manual: false };
  CONFERENCIA_INDICE = 0;
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Confira antes de mandar</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${safeText(item.nome || 'Esta peça')}</h2>
    <p class="workflow-copy">${safeText(item.cliente || 'Cliente não informado')} · vai para
      <b>${safeText(option.label)}</b>.</p>
    <div class="conferencia-palco" id="conferencia-palco">
      <div class="status-context-preview-loading">Buscando a arte…</div>
    </div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">← Voltar</button>
      <button type="button" class="workflow-primary" onclick="confirmarConferenciaVisual()">Confirmar ✓</button>
    </div>`);
  document.getElementById('workflow-modal')?.classList.add('conferencia-visual');
  carregarArteDaConferencia(item.id);
}

async function carregarArteDaConferencia(itemId) {
  const palco = document.getElementById('conferencia-palco');
  if (!palco) return;
  try {
    const detail = await fetchWorkspaceItem(itemId);
    const artes = statusContextPreviewAssets(detail) || [];
    const entrega = workspaceDeliveryInfo(detail);
    PREVIA_MATERIAL = artes;
    const abrir = entrega?.url
      ? `<a class="material-review-open" href="${safeText(entrega.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a>`
      : '';
    if (!artes.length) {
      palco.innerHTML = `<div class="status-context-preview-empty"><b>Nenhuma arte anexada</b>
        ${entrega?.url ? 'Há um material vinculado — abra antes de confirmar.'
          : 'Esta peça não tem arquivo para conferir. Você ainda pode mandar para aprovação.'}${abrir}</div>`;
      return;
    }
    // Quantos arquivos existem, dito em voz alta.
    //
    // Um carrossel tem varias paginas, e a tela mostrava a primeira sem dizer
    // que era a primeira DE UMA. Quem conferia nao sabia distinguir "so tem
    // esta" de "o resto nao aparece" — e as duas coisas se resolvem de jeitos
    // opostos: uma e anexar o que falta, a outra e um defeito. Agora a conta
    // aparece sempre, e com um so arquivo ela diz isso com todas as letras.
    const varias = artes.length > 1;
    const conta = varias
      ? `<span class="conferencia-conta"><b id="conferencia-n">1</b> de ${artes.length} arquivos</span>`
      : '<span class="conferencia-conta unica">1 arquivo anexado nesta peça</span>';
    const setas = varias ? `
      <button type="button" class="conferencia-seta" onclick="passarArteDaConferencia(-1)" aria-label="Arte anterior">‹</button>
      <button type="button" class="conferencia-seta" onclick="passarArteDaConferencia(1)" aria-label="Próxima arte">›</button>` : '';
    palco.innerHTML = `<figure class="conferencia-arte ${varias ? 'tem-setas' : ''}">
        ${setas}
        <img id="conferencia-img" src="" alt="" title="Clique para ver em tamanho grande"
          onclick="abrirPreviaGrande(CONFERENCIA_INDICE)">
        <figcaption id="conferencia-legenda"></figcaption>
      </figure>
      ${conta}${abrir}`;
    // A fileira numerada saiu. Com as setas e o "N de M" sempre a vista, ela era
    // uma terceira forma de fazer a mesma coisa — e, numa janela mais baixa,
    // ficava fora do campo de visao, empurrando a conta para a rolagem. Duas
    // navegacoes, uma delas escondida, e pior que uma que sempre aparece.
    trocarArteDaConferencia(0);
  } catch (erro) {
    palco.innerHTML = `<div class="status-context-preview-empty"><b>Não deu para carregar a arte</b>
      ${safeText(erro.message || '')} — você ainda pode confirmar.</div>`;
  }
}

// Setas alem dos numeros: numero e preciso, seta e obvio. Quem esta conferindo
// cinco paginas de um carrossel nao quer mirar em quadradinhos de 26px.
function passarArteDaConferencia(passo) {
  if (!PREVIA_MATERIAL.length) return;
  const total = PREVIA_MATERIAL.length;
  trocarArteDaConferencia((CONFERENCIA_INDICE + passo + total) % total);
}

function trocarArteDaConferencia(indice) {
  const arte = PREVIA_MATERIAL[indice];
  if (!arte) return;
  CONFERENCIA_INDICE = indice;
  const img = document.getElementById('conferencia-img');
  const legenda = document.getElementById('conferencia-legenda');
  if (img) {
    img.src = arte.public_url || arte.url_thumbnail || arte.url || '';
    img.alt = `Prévia de ${arte.name || 'material'}`;
  }
  if (legenda) {
    legenda.textContent = PREVIA_MATERIAL.length > 1
      ? `(${indice + 1}/${PREVIA_MATERIAL.length}) ${arte.name || ''}`
      : (arte.name || '');
  }
  document.querySelectorAll('#conferencia-tiras button')
    .forEach((b, i) => b.classList.toggle('ativa', i === indice));
  const n = document.getElementById('conferencia-n');
  if (n) n.textContent = String(indice + 1);
}

async function confirmarConferenciaVisual() {
  const fluxo = pendingWorkflowChange;
  if (!fluxo) return;
  const botao = document.querySelector('#workflow-modal .workflow-primary');
  if (botao) { botao.disabled = true; botao.textContent = 'Mandando…'; }
  const { item, option } = fluxo;
  // A nota de historico nao segura a troca — a mesma regra de todos os portoes.
  void postItemUpdate(item.id, `[Vybe OS · Conferência visual]\nEtapa: ${item.status} → ${option.label}`);
  closeWorkflowModal();
  await commitStatusChange(item, option);
}

function openHandoffGate(item, option=null) { pendingWorkflowChange={item,option,manual:!option}; const target=option?.label || 'próxima pessoa ou etapa'; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Passagem de bastão</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Deixe a próxima etapa pronta</h2><p class="workflow-copy">Registre o contexto mínimo para que o trabalho siga sem perda de informação.</p>${workflowItemHtml(item,target)}<label class="workflow-field"><span>O que foi concluído?</span><textarea id="handoff-done" rows="3" placeholder="Ex.: Arte revisada, versão final aprovada internamente e arquivo anexado."></textarea></label><label class="workflow-field"><span>O que precisa acontecer agora?</span><textarea id="handoff-next" rows="3" placeholder="Ex.: Tainara deve conferir a legenda e agendar para segunda-feira."></textarea></label><label class="workflow-field"><span>Link ou arquivo de referência (opcional)</span><input id="handoff-link" type="url" placeholder="https://drive.google.com/... ou link do arquivo"></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitHandoff()">REGISTRAR E ${option ? 'ATUALIZAR STATUS' : 'SALVAR'} →</button></div>`); }
function openManualHandoff(itemId) { const item=findOperationalItem(itemId); if (item) openHandoffGate(item,null); }

const outboundItemPatchQueue = new Map();
function outboundPatchFields(patch={}) { return Object.entries(patch).filter(([,value])=>value!==undefined && value!==null); }
function applyOutboundItemPatch(itemId, patch={}, label='alteração', options={}) {
  const renderizar=options?.render!==false;
  if (patch.status && !patch.status_updated_at) patch.status_updated_at = new Date().toISOString(); const key=String(itemId); const now=new Date().toISOString(); const fields=outboundPatchFields(patch);
  [DADOS,DADOS_ALL].forEach(list=>(list||[]).forEach(item=>{
    if(String(item.id)!==key) return;
    fields.forEach(([field,value])=>{ item[field]=Array.isArray(value)?[...value]:value; });
    if(patch.prazo_iso) item.prazo=planningDateBr(patch.prazo_iso);
    if(patch.veiculacao_iso) item.veiculacao=planningDateBr(patch.veiculacao_iso);
    item.updated_at=now;
    item.operational_risk=getOperationalRisk(item);
  }));
  // Em lote, guardar o cache a cada peca serializa a base inteira no navegador
  // uma vez por item — com sessenta prazos isso e sessenta gravacoes de tudo, e
  // era o que fazia a barra de progresso andar de dois em dois. Quem chama em
  // lote guarda UMA vez no fim.
  if(options?.cache!==false) saveProductionCache();
  if(renderizar) renderOutboundItemPatch(label);
  queueOutboundItemReconciliation(key,patch,label);
}
function renderOutboundItemPatch(label='alteração') {
  const previousScroll=window.scrollY;
  // A ficha do cliente mostra as mesmas atividades, na mesma tabela: mudar o
  // status de uma peca por la tem de repintar a ficha, senao a linha continua
  // dizendo o valor antigo ate alguem sair e voltar.
  if(typeof redesenharListasDoCliente==='function') redesenharListasDoCliente();
  renderCompactSummary(); renderOperationalTools(); renderIdentityOperationalPulse();
  if(panelMode==='foco') renderFocusDashboard();
  else if(panelMode==='controler') renderDaController();
  else { renderKPIs(); for(let n=1;n<=(META?.weeks?.length||0);n++) renderWeek(n,currentFilter,currentDayFilter); renderManagerIntelligence(); }
  // AS OUTRAS TRES TELAS QUE MOSTRAM A MESMA PECA.
  //
  // Existiam duas funcoes para repintar depois de uma mudanca: esta, que so
  // sabia das semanas e dos KPIs, e a redesenharAposMudanca, que sabia de tudo.
  // Trocar o status passava pela incompleta — entao a fileira de Grupos, o
  // calendario e a esteira de Solicitacoes continuavam com o valor antigo, e a
  // pessoa concluia que so recarregando a pagina resolvia. Era exatamente isso.
  //
  // As tres tem guarda propria e nao fazem nada quando a tela nao esta aberta,
  // entao chamar sempre custa quase nada e nao deixa mais nenhuma delas para
  // tras. A redesenharAposMudanca passa a delegar para ca: uma verdade so.
  if(typeof repintarCartaoRapido==='function') repintarCartaoRapido();
  if(typeof repintarMesaDePlanejamento==='function') repintarMesaDePlanejamento();
  if(typeof renderVisaoDeGrupos==='function') renderVisaoDeGrupos();
  if(typeof renderManagerCalendar==='function') renderManagerCalendar();
  if(typeof renderDemandas==='function' && typeof activeBoard!=='undefined' && activeBoard==='demandas') renderDemandas();
  requestAnimationFrame(()=>window.scrollTo({top:previousScroll,behavior:'instant'}));
  const dominioAtivo = typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio';
  cacheSyncLabel(dominioAtivo ? 'Alteração confirmada no banco Vybe.' : 'Alteração local aplicada · confirmando contingência…');
  setSyncHealth(dominioAtivo ? 'healthy' : 'checking', dominioAtivo ? 'Banco Vybe confirmou a alteração.' : 'Alteração enviada · confirmando contingência…');
}
function outboundPatchMatches(item,patch={}) {
  return outboundPatchFields(patch).every(([field,value])=>{
    const remote=item?.[field];
    return Array.isArray(value) ? JSON.stringify((remote||[]).map(String).sort())===JSON.stringify(value.map(String).sort()) : String(remote??'')===String(value??'');
  });
}
function queueOutboundItemReconciliation(itemId, patch={}, label='alteração', attempt=0) {
  const key=String(itemId); const previous=outboundItemPatchQueue.get(key); if(previous?.timer) clearTimeout(previous.timer);
  if (typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio') {
    outboundItemPatchQueue.delete(key);
    cacheSyncLabel('Alteração confirmada no banco Vybe · réplica externa em fila de contingência.');
    setSyncHealth('healthy', `Banco Vybe confirmou a alteração às ${syncHealthClock(Date.now())}`);
    return;
  }
  const timer=setTimeout(async()=>{
    try {
      const raw=(await fetchItemsByIds([key]))[0];
      if(!raw) throw new Error('Demanda não encontrada no retorno do Monday.');
      const remote=processItemsAll([raw],calcWeeks())[0];
      if(!remote) throw new Error('Retorno da demanda inválido.');
      const confirmed=outboundPatchMatches(remote,patch);
      if(!confirmed && attempt<3) { queueOutboundItemReconciliation(key,patch,label,attempt+1); return; }
      if(!confirmed) {
        outboundItemPatchQueue.delete(key);
        setSyncHealth('degraded', 'Alteração local mantida · confirmação do Monday pendente.');
        cacheSyncLabel('Alteração local mantida · confirmação do Monday ainda pendente.');
        showToast('A alteração continua aplicada no painel; o Monday ainda não confirmou o item.', 'info', 5200);
        return;
      }
      const merged=new Map((DADOS_ALL||[]).map(item=>[String(item.id),item]));
      merged.set(key,remote);
      // Reconciliação de saída: atualiza a base local sem reposicionar semana, filtros, rolagem ou modo ativo.
      DADOS_ALL=[...merged.values()];
      DADOS=visibleProductionItems(DADOS_ALL,META);
      recalcSemanas(); applyOperationalRisk(DADOS); applyOperationalRisk(DADOS_ALL);
      syncStatusLegendColors('#status-legend',DADOS_ALL);
      renderOutboundItemPatch(label);
      saveProductionCache(); outboundItemPatchQueue.delete(key);
      cacheSyncLabel(`Alteração confirmada no Monday · somente 1 demanda reconciliada`);
      setSyncHealth('healthy', `Monday confirmou 1 alteração às ${syncHealthClock(Date.now())}`);
    } catch(error) {
      console.warn('Reconciliação individual pendente:',error);
      if(attempt<3) { queueOutboundItemReconciliation(key,patch,label,attempt+1); return; }
      outboundItemPatchQueue.delete(key);
      setSyncHealth('degraded', `Alteração local mantida · confirmação do Monday pendente.`);
      showToast(`A alteração foi mantida no painel; a confirmação do Monday será repetida em segundo plano.`, 'info', 5200);
    }
  },attempt?Math.min(1400*(attempt+1),5000):900);
  outboundItemPatchQueue.set(key,{timer,patch,label,attempt});
}
function planningDateBr(iso='') { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : 'não definido'; }
const PRAZO_OURO_DIAS = 7;
function goldenDeadlineIso(veiculacao='') { if(!/^\d{4}-\d{2}-\d{2}$/.test(String(veiculacao))) return ''; const date=new Date(`${veiculacao}T12:00:00`); date.setDate(date.getDate()-PRAZO_OURO_DIAS); return date.toISOString().slice(0,10); }
function goldenDeadlineGap(prazo='',veiculacao='') { if(!prazo || !veiculacao) return null; const from=new Date(`${prazo}T12:00:00`); const to=new Date(`${veiculacao}T12:00:00`); return Math.round((to-from)/86400000); }
function quickDateTrigger(item, className='') { const gap=goldenDeadlineGap(item?.prazo_iso,item?.veiculacao_iso); const risk=gap!==null&&gap<PRAZO_OURO_DIAS; const title=`Editar prazo e veiculação · Prazo de Ouro: ${PRAZO_OURO_DIAS} dias antes da veiculação${gap===null?'':` · atual: ${gap} dias`}`; return `<button type="button" class="quick-date-trigger ${risk?'gold-risk':''} ${className}" onclick="openPlanningEditor('${item.id}')" title="${safeText(title)}" aria-label="${safeText(title)}">◷</button>`; }
function quickDateDaTrigger(item) { const gap=goldenDeadlineGap(item?.prazo_iso,item?.veiculacao_iso); const risk=gap!==null&&gap<PRAZO_OURO_DIAS; const title=`Editar datas · Prazo de Ouro: ${PRAZO_OURO_DIAS} dias antes da veiculação`; return `<span class="quick-date-da ${risk?'gold-risk':''}" role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();openPlanningEditor('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openPlanningEditor('${item.id}')}" title="${safeText(title)}">◷</span>`; }
// ── Datas rápidas ────────────────────────────────────────────────────────────
//
// A caixa dizia tudo o tempo todo: um paragrafo de explicacao no topo, dois
// campos com titulo e legenda cada, uma faixa laranja com a conta da margem
// espremida numa linha, um campo de motivo SEMPRE aberto — mesmo quando o prazo
// estava no padrao e nao havia excecao nenhuma para justificar — e um rodape
// explicando que o sistema guarda historico.
//
// Aqui a tela responde a uma pergunta so: as duas datas estao certas? Entao ela
// mostra as duas datas, o que a regra acha delas, e some com o resto. O motivo
// da excecao nasce fechado e SO APARECE quando o prazo sai do padrao — que e
// exatamente quando ele passa a ser obrigatorio.
function leituraDoPrazoDeOuro(prazo, veic) {
  const alvo = goldenDeadlineIso(veic);
  const gap = goldenDeadlineGap(prazo, veic);
  if (!veic) return { estado: 'pendente', titulo: 'Falta a veiculação',
    texto: 'Sem a data de publicação não dá para medir a antecedência.', alvo: '' };
  if (!prazo) return { estado: 'pendente', titulo: `Sugerido: ${planningDateBr(alvo)}`,
    texto: `${PRAZO_OURO_DIAS} dias antes do ar.`, alvo };
  if (prazo === alvo) return { estado: 'ok', titulo: 'No padrão',
    texto: `${PRAZO_OURO_DIAS} dias completos de antecedência.`, alvo };
  if (gap > PRAZO_OURO_DIAS) return { estado: 'folga', titulo: `${gap} dias de antecedência`,
    texto: `${gap - PRAZO_OURO_DIAS} a mais que o padrão.`, alvo };
  return { estado: 'risco', titulo: `${Math.max(0, gap)} dia${gap === 1 ? '' : 's'} de antecedência`,
    texto: `${PRAZO_OURO_DIAS - gap} abaixo do padrão · ideal ${planningDateBr(alvo)}.`, alvo };
}

function painelDoPrazoDeOuro(prazo, veic) {
  const l = leituraDoPrazoDeOuro(prazo, veic);
  const forade = l.estado === 'risco' || l.estado === 'folga';
  return `<div class="dr-regra dr-${l.estado}">
      <span class="dr-regra-marca" aria-hidden="true"></span>
      <span class="dr-regra-copy"><b>${safeText(l.titulo)}</b><small>${safeText(l.texto)}</small></span>
      ${l.alvo && l.estado !== 'ok'
        ? `<button type="button" class="dr-aplicar" onclick="applyGoldenDeadline()">Usar ${planningDateBr(l.alvo)}</button>`
        : ''}
    </div>
    <label class="dr-motivo ${forade ? 'aberto' : ''}">
      <span>Por que fora do padrão? <em>fica no histórico da peça</em></span>
      <textarea id="planning-reason" rows="2"
        placeholder="Ex.: urgência aprovada; o cliente mudou a campanha."></textarea>
    </label>`;
}

function updateGoldenDeadlineState() {
  const veic = String(document.getElementById('planning-veiculacao')?.value || '');
  const prazo = String(document.getElementById('planning-prazo')?.value || '');
  const caixa = document.getElementById('planning-golden-state');
  if (!caixa) return;
  // O motivo ja digitado nao pode se perder quando a pessoa mexe numa data.
  const escrito = document.getElementById('planning-reason')?.value || '';
  caixa.innerHTML = painelDoPrazoDeOuro(prazo, veic);
  const campo = document.getElementById('planning-reason');
  if (campo && escrito) campo.value = escrito;
}

function applyGoldenDeadline() {
  const veic = String(document.getElementById('planning-veiculacao')?.value || '');
  const prazo = document.getElementById('planning-prazo');
  const golden = goldenDeadlineIso(veic);
  if (!golden) return showToast('Informe a veiculação antes de aplicar o Prazo de Ouro.', 'info');
  if (prazo) prazo.value = golden;
  updateGoldenDeadlineState();
}

function openPlanningEditor(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Demanda não encontrada.', 'err');
  const prazo = item.prazo_iso || '';
  const veiculacao = item.veiculacao_iso || '';
  openWorkflowModal(`<div class="dr-topo">
      <div><span class="dr-kicker">${safeText(item.cliente || 'Sem cliente')}</span>
        <h2 class="dr-titulo">${safeText(item.nome || 'Sem título')}</h2></div>
      <button class="dr-fechar" type="button" onclick="closeWorkflowModal()" aria-label="Fechar">×</button>
    </div>
    <div class="dr-datas">
      <label class="dr-campo">
        <span>Prazo de produção</span>
        <input id="planning-prazo" type="date" value="${prazo}" onchange="updateGoldenDeadlineState()">
      </label>
      <span class="dr-seta" aria-hidden="true">→</span>
      <label class="dr-campo">
        <span>Veiculação</span>
        <input id="planning-veiculacao" type="date" value="${veiculacao}" onchange="updateGoldenDeadlineState()">
      </label>
    </div>
    <div id="planning-golden-state">${painelDoPrazoDeOuro(prazo, veiculacao)}</div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button id="planning-save" type="button" class="workflow-primary" onclick="savePlanningDates('${item.id}')">Salvar</button>
    </div>`);
}

async function savePlanningDates(itemId) {
  const item=findOperationalItem(itemId);
  const prazo=String(document.getElementById('planning-prazo')?.value||'');
  const veiculacao=String(document.getElementById('planning-veiculacao')?.value||'');
  const reason=String(document.getElementById('planning-reason')?.value||'').trim();
  if(!item) return showToast('Demanda não encontrada.', 'err');
  if(!prazo || !veiculacao) return showToast('Preencha Prazo e Veiculação para manter o planejamento completo.', 'info');
  if(prazo > veiculacao) return showToast('O prazo não pode ficar depois da veiculação. Ajuste as datas antes de salvar.', 'info');
  const golden=goldenDeadlineIso(veiculacao);
  const followsGolden=prazo===golden;
  if(!followsGolden && !reason) return showToast(`O Prazo de Ouro é ${PRAZO_OURO_DIAS} dias antes da veiculação. Aplique o padrão ou registre o motivo da exceção.`, 'info');
  const prazoChanged=prazo!==String(item.prazo_iso||'');
  const veicChanged=veiculacao!==String(item.veiculacao_iso||'');
  if(!prazoChanged && !veicChanged) return closeWorkflowModal();
  const values={}; if(prazoChanged) values.data={date:prazo}; if(veicChanged) values[isRequestItem(item)?COLUNAS.demandas.veiculacao:COLUNAS.producao.veiculacao]={date:veiculacao};
  const button=document.getElementById('planning-save'); if(button) button.disabled=true;
  armOutboundMutationGuard(veicChanged?'veiculação':'prazo');
  try {
    const pelaEscritaPropria=await tentarEscritaDupla(item,{ acao:'datas', item:String(item.id), prazo, veiculacao });
    if(!pelaEscritaPropria){
      const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
      await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify(values)});
    }
    const changes=[]; if(prazoChanged) changes.push(`Prazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(prazo)}`); if(veicChanged) changes.push(`Veiculação: ${planningDateBr(item.veiculacao_iso)} → ${planningDateBr(veiculacao)}`);
    try { await postItemUpdate(item.id,`[Vybe OS · Planejamento atualizado]\n${changes.join('\n')}\nRegra: ${followsGolden?`Prazo de Ouro respeitado (${PRAZO_OURO_DIAS} dias antes da veiculação)`:`Exceção ao Prazo de Ouro (${(()=>{const d=goldenDeadlineGap(prazo,veiculacao);return d===1?'1 dia':`${d} dias`;})()} de antecedência)`}${reason ? `\nMotivo: ${reason}` : ''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); } catch(logError) { console.warn('Datas atualizadas, mas o log não foi registrado.',logError); }
    if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){ if(prazoChanged){request.prazo_iso=prazo;request.prazo=planningDateBr(prazo).slice(0,5);} if(veicChanged){request.conclusao_iso=veiculacao;request.conclusao=planningDateBr(veiculacao).slice(0,5);request.veiculacao_iso=veiculacao;request.veiculacao=planningDateBr(veiculacao).slice(0,5);} } outboundMutationGuardUntil=0; renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{...(prazoChanged?{prazo_iso:prazo}:{}),...(veicChanged?{veiculacao_iso:veiculacao}:{})},'planejamento');
    closeWorkflowModal();
    if(activeWorkspaceItemId===String(item.id)) { const refreshed=findOperationalItem(item.id)||item; renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),refreshed); }
    showToast('✓ Planejamento atualizado no Vybe OS · painel mantido no contexto atual','ok');
  } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível atualizar o planejamento: ${e.message}`,'err',7000); }
}
function openDaDirectionModal(itemId) { const item=findOperationalItem(itemId); if(!item) return showToast('Demanda não encontrada.', 'err'); pendingDaDirectionItemId=String(itemId); const owners=daControllerTeam().map(user=>`<option value="${user.id}">${safeText(firstName(user.name))}</option>`).join(''); openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Direcionamento de arte</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Direcionar esta demanda</h2><p class="workflow-copy">Registre a decisão visual no histórico da peça para que o time execute sem depender do WhatsApp.</p>${workflowItemHtml(item,item.status)}<label class="workflow-field"><span>Qual é a direção objetiva?</span><textarea id="da-direction-text" rows="4" placeholder="Ex.: Ajustar a hierarquia do título, trocar a imagem principal e usar a referência enviada pelo cliente."></textarea></label><label class="workflow-field"><span>Quem precisa agir agora?</span><select id="da-direction-owner"><option value="">Manter responsável atual</option>${owners}</select></label><label class="workflow-field"><span>Próximo passo esperado</span><input id="da-direction-next" type="text" placeholder="Ex.: Nova versão para validação interna até amanhã."></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitDaDirection()">Registrar direção →</button></div>`); }
async function submitDaDirection() { const item=findOperationalItem(pendingDaDirectionItemId); const direction=String(document.getElementById('da-direction-text')?.value||'').trim(); const next=String(document.getElementById('da-direction-next')?.value||'').trim(); const ownerId=String(document.getElementById('da-direction-owner')?.value||''); if(!item || !direction) return showToast('Descreva a direção antes de registrar.', 'info'); const owner=daControllerTeam().find(user=>user.id===ownerId); try { await postItemUpdate(item.id,`[Vybe OS · Direcionamento de D.A.]\nDireção: ${direction}${owner?`\nQuem executa: ${owner.name}`:''}${next?`\nPróximo passo: ${next}`:''}`); item.status_context={reason:direction,next:next||item.status_context?.next||'',created_at:new Date().toISOString()}; closeWorkflowModal(); pendingDaDirectionItemId=''; showToast('✓ Direcionamento registrado no Vybe OS','ok'); renderDaController(); if(activeWorkspaceItemId===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),item); } catch(e) { showToast(`Não foi possível registrar o direcionamento: ${e.message}`,'err',7000); } }
async function submitHandoff() { const flow=pendingWorkflowChange; const done=String(document.getElementById('handoff-done')?.value||'').trim(); const next=String(document.getElementById('handoff-next')?.value||'').trim(); const link=String(document.getElementById('handoff-link')?.value||'').trim(); if (!flow || !done || !next) return showToast('Preencha o que foi concluído e o próximo passo.','info'); if (link && !/^https?:\/\//i.test(link)) return showToast('Use um link válido começando com https:// ou deixe o campo em branco.','info'); try { await postItemUpdate(flow.item.id, `[Vybe OS · Passagem de bastão]\n${flow.option ? `Etapa: ${flow.item.status} → ${flow.option.label}\n` : ''}Concluído: ${done}\nPróximo passo: ${next}${link ? `\nReferência: ${link}` : ''}`); const {item,option,manual}=flow; closeWorkflowModal(); if (manual) { showToast('✓ Passagem de bastão registrada no Vybe OS','ok'); if (activeWorkspaceItemId) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId),item); } else await commitStatusChange(item,option); } catch(e) { showToast(`Não foi possível registrar a passagem: ${e.message}`,'err',7000); } }
// As automações rodam no servidor depois da gravação e podem trocar o dono e o
// grupo da peça — é o caso de "Para agendar", que passa a peça para a Tainara em
// Gestão de publicações. A resposta traz o estado final; sem escrevê-lo aqui, a
// linha continuava mostrando quem mudou o status, e quem mudou concluía que a
// regra não tinha rodado. Ela tinha: só não aparecia.
function aplicarEfeitoDaAutomacao(item, resposta) {
  const depois = resposta && typeof resposta === 'object' ? resposta.depois : null;
  const regras = (resposta && resposta.automacoes) || [];
  if (!depois) return '';
  const donosAntes = assignedIds(item).map(String).sort().join(',');
  const donosDepois = (depois.responsavel_ids || []).map(String).sort().join(',');
  const remendo = {};
  // LISTA VAZIA E UMA RESPOSTA, NAO A FALTA DE UMA.
  //
  // A condicao era `if (donosDepois && ...)`, e string vazia e falsa: quando a
  // automacao TIRAVA o responsavel — o que a regra de Finalizados faz — o
  // remendo nunca era aplicado e a tela continuava mostrando o dono antigo. O
  // servidor so manda 'depois' quando alguma regra rodou, entao aqui uma lista
  // vazia significa "ficou sem ninguem", e nao "nao sei".
  if (donosDepois !== donosAntes) remendo.responsavel_ids = (depois.responsavel_ids || []).map(String);
  if (depois.grupo_id && String(depois.grupo_id) !== String(item.grupo_id || '')) {
    remendo.grupo_id = depois.grupo_id;
    if (depois.grupo) remendo.grupo = depois.grupo;
  }
  if (!Object.keys(remendo).length) return '';
  applyOutboundItemPatch(item.id, remendo, 'automação após troca de status');
  const nomes = (remendo.responsavel_ids || []).map((id) =>
    firstName((TEAM_USERS || []).find((u) => String(u.id) === String(id))?.name || '')).filter(Boolean);
  const quem = nomes.length ? ` · agora com ${nomes.join(' e ')}`
    : (remendo.responsavel_ids ? ' · e saiu da fila de quem estava com ela' : '');
  const onde = remendo.grupo ? ` em ${remendo.grupo}` : '';
  const regra = regras[0]?.nome ? ` (${regras[0].nome})` : '';
  return `✓ ${item.nome || 'Peça'} seguiu pela automação${quem}${onde}${regra}`;
}

async function commitStatusChange(item, option) { const mutation=`mutation ($board: ID!, $item: ID!, $value: JSON!) { change_column_value(board_id: $board, item_id: $item, column_id: "status", value: $value) { id } }`; armOutboundMutationGuard('status'); try { const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'status', item:String(item.id), para:chaveDeStatus(option.label), _devolve:true }); if (!pelaEscritaDupla) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),value:JSON.stringify({index:Number(option.index)})}); updateLocalStatus(item.id,option); const efeito=aplicarEfeitoDaAutomacao(item, pelaEscritaDupla); if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(d=>String(d.id)===String(item.id)); if(request) { request.status=option.label; request.status_color=option.color; request.status_border=option.border; request.status_index=option.index; request.status_updated_at=new Date().toISOString(); } renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{status:option.label,status_color:option.color,status_border:option.border,status_index:option.index},'status'); closeStatusEditor(); if(String(activeWorkspaceItemId)===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id), findOperationalItem(item.id) || item); renderFocusUserPicker(); showToast(efeito || `✓ Status atualizado para ${option.label} · tela mantida no contexto atual`,'ok', efeito ? 9000 : 4200); } catch(e) { showToast(`Não foi possível atualizar no Vybe OS: ${e.message}`,'err',7000); } }
const STATUS_CONTEXT_RULES = Object.freeze({
  'alteração': { question:'Qual alteração foi solicitada?', helper:'Descreva o ajuste com objetividade para que a equipe não precise recuperar o contexto no WhatsApp.', requester:true, source:true },
  'falta info': { question:'O que está faltando para avançar?', helper:'Informe qual material, informação ou aprovação é necessária e de quem ela depende.', requester:true, source:true },
  'ag. info cliente': { question:'Qual informação está sendo aguardada?', helper:'Registre exatamente o que foi pedido ao cliente e o que fica bloqueado até o retorno.', requester:true, source:true },
  'aguardo': { question:'O que está sendo aguardado?', helper:'Explique o retorno, a decisão ou o material que impede a próxima etapa.', requester:true, source:true },
  'ag. aprovação cliente': { question:'Que aprovação ainda falta?', helper:'Registre qual ponto espera validação e de quem precisa vir o retorno.', requester:true, source:true, completed:true },
  'ag. interno': { question:'O que precisa de validação interna?', helper:'Especifique a decisão e a área ou pessoa que precisa validar.', requester:true, source:true },
  'falta d.a': { question:'Que direção de arte ou referência falta?', helper:'Descreva o ponto visual que precisa ser definido antes da produção.', requester:true, source:true },
  'finalizado': { question:'O que foi concluído e entregue?', helper:'Registre a entrega final, o destino e qualquer pendência residual.', completed:true }
});
function contextRuleFor(option) { return STATUS_CONTEXT_RULES[normalizedWorkflowStatus(option?.label)] || { question:`Por que esta demanda entra em ${option?.label || 'esta etapa'}?`, helper:'Registre o motivo da mudança e o próximo passo necessário.' }; }
function updateStatusContextState() { const form=document.getElementById('status-context-form'); const button=document.getElementById('status-context-submit'); if(!form || !button) return; const checks=[...form.querySelectorAll('input[data-quality-check]')]; button.disabled=checks.some(check=>!check.checked); }
function statusContextIsCard(item){ return /card/i.test(String(daTacticalFormat(item)||item?.formato||'')) || /(^|\W)card\b/i.test(String(item?.nome||'')); }
// Escolher responsavel e sempre pela bolinha com foto, como no resto do painel.
// Antes era um <select> de texto: a lista abria com a fonte do sistema, sem
// rosto nenhum, e a pessoa lia "Deivid · Design" onde em toda outra tela ela
// reconhece a foto antes do nome.
//
// Um <select> nao aceita imagem — entao deixa de ser select. Vira uma fileira de
// fichas, e um campo escondido guarda o escolhido para quem le o formulario nao
// precisar saber que a tela mudou.
function statusContextResponsibleOptions(item){
  const rule=ownerEligibility(item);
  const current=new Set(assignedIds(item));
  const eligible=(rule?.users||[]).filter(user=>user?.id);
  const currentUsers=(TEAM_USERS||[]).filter(user=>current.has(String(user.id)));
  const users=[...new Map([...eligible,...currentUsers].map(user=>[String(user.id),user])).values()];
  const escolhido=users.find(u=>current.has(String(u.id)));
  const fichas=users.map(user=>{
    const id=String(user.id);
    const naRegra=eligible.some(c=>String(c.id)===id);
    const papel=naRegra?(rule?.label||'Equipe'):'Responsável atual';
    return `<button type="button" class="dono-ficha ${current.has(id)?'marcada':''}" data-dono="${safeText(id)}"
      onclick="escolherResponsavelDoStatus('${safeText(id)}')" title="${safeText(user.name)} · ${safeText(papel)}">
      ${ownerAvatarHtml(user)}<span><b>${safeText(firstName(user.name))}</b><small>${safeText(papel)}</small></span></button>`;
  }).join('');
  return `<input type="hidden" id="status-context-next-owner" value="${safeText(escolhido?String(escolhido.id):'')}">
    <div class="dono-fichas" id="status-context-donos">${fichas
      || '<span class="workflow-hint">Nenhuma pessoa elegível para esta etapa.</span>'}</div>`;
}

// Uma pessoa por vez: clicar em outra troca. Clicar na marcada desmarca, porque
// nem toda passagem de status tem um dono definido do outro lado.
function escolherResponsavelDoStatus(id){
  const campo=document.getElementById('status-context-next-owner');
  if(!campo) return;
  const alvo=String(id);
  const jaEra=String(campo.value||'')===alvo;
  campo.value=jaEra?'':alvo;
  document.querySelectorAll('#status-context-donos .dono-ficha').forEach(b=>{
    b.classList.toggle('marcada', !jaEra && b.dataset.dono===alvo);
  });
}
// Todas as imagens da peça, não só a primeira: uma demanda com cinco artes
// mostrava uma e escondia quatro, sem dizer que existiam.
function statusContextPreviewAssets(detail){ const updates=(detail?.updates||[]).flatMap(update=>update?.assets||[]); const assets=[...(detail?.assets||[]),...updates]; return assets.filter(asset=>asset?.url_thumbnail || /^\.?(png|jpe?g|webp|gif|avif)$/i.test(String(asset?.file_extension||''))); }
function statusContextPreviewAsset(detail){ return statusContextPreviewAssets(detail)[0] || null; }
let PREVIA_MATERIAL=[];
// Painel flutuante para conferir a arte em tamanho de verdade. Dentro do modal a
// imagem cabe em 38% da altura da tela, o que serve para reconhecer a peça mas
// não para conferir texto pequeno — e conferir é justamente o que se pede ali.
let PREVIA_GRANDE_INDICE = 0;

function abrirPreviaGrande(indice = 0) {
  if (!PREVIA_MATERIAL.length) return;
  PREVIA_GRANDE_INDICE = Math.max(0, Math.min(indice, PREVIA_MATERIAL.length - 1));
  let caixa = document.getElementById('previa-grande');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'previa-grande';
    caixa.className = 'previa-grande';
    caixa.innerHTML = `
      <div class="previa-grande-vidro">
        <div class="previa-grande-topo">
          <span id="previa-grande-nome"></span>
          <button class="x-fechar" type="button" onclick="fecharPreviaGrande()" aria-label="Fechar">✕</button>
        </div>
        <div class="previa-grande-palco">
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(-1)" aria-label="Anterior">❮</button>
          <img id="previa-grande-img" alt="">
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(1)" aria-label="Próxima">❯</button>
        </div>
      </div>`;
    document.body.appendChild(caixa);
    // Clicar fora fecha; dentro, não — senão fecha ao tentar arrastar a imagem.
    caixa.addEventListener('click', (e) => { if (e.target === caixa) fecharPreviaGrande(); });
    document.addEventListener('keydown', teclaPreviaGrande);
  }
  caixa.style.display = 'flex';
  pintarPreviaGrande();
}

function pintarPreviaGrande() {
  const a = PREVIA_MATERIAL[PREVIA_GRANDE_INDICE];
  if (!a) return;
  const img = document.getElementById('previa-grande-img');
  const nome = document.getElementById('previa-grande-nome');
  if (img) { img.src = a.url_thumbnail || a.public_url || a.url || ''; img.alt = a.name || ''; }
  if (nome) nome.textContent = `(${PREVIA_GRANDE_INDICE + 1}/${PREVIA_MATERIAL.length}) ${a.name || ''}`;
  document.querySelectorAll('.previa-grande-seta').forEach((b) => {
    b.style.visibility = PREVIA_MATERIAL.length > 1 ? 'visible' : 'hidden';
  });
}

function passarPreviaGrande(passo) {
  if (!PREVIA_MATERIAL.length) return;
  PREVIA_GRANDE_INDICE = (PREVIA_GRANDE_INDICE + passo + PREVIA_MATERIAL.length) % PREVIA_MATERIAL.length;
  pintarPreviaGrande();
  trocarPreviaMaterial(PREVIA_GRANDE_INDICE);
}

function fecharPreviaGrande() {
  const caixa = document.getElementById('previa-grande');
  if (caixa) caixa.style.display = 'none';
}

// Só responde às teclas com o painel aberto: ESC dentro do modal de checklist
// continua fechando o checklist, não a imagem.
function teclaPreviaGrande(e) {
  const caixa = document.getElementById('previa-grande');
  if (!caixa || caixa.style.display === 'none') return;
  if (e.key === 'Escape') { e.stopPropagation(); fecharPreviaGrande(); }
  if (e.key === 'ArrowLeft') passarPreviaGrande(-1);
  if (e.key === 'ArrowRight') passarPreviaGrande(1);
}

function trocarPreviaMaterial(indice){ const asset=PREVIA_MATERIAL[indice]; if(!asset) return; PREVIA_GRANDE_INDICE=indice; const img=document.getElementById('material-review-img'); const legenda=document.getElementById('material-review-caption'); if(img){ img.src=asset.url_thumbnail||asset.public_url||asset.url||''; img.alt=`Prévia de ${asset.name||'material'}`; } if(legenda) legenda.textContent=`(${indice+1}/${PREVIA_MATERIAL.length}) ${asset.name||''}`; document.querySelectorAll('#material-review-strip button').forEach((b,i)=>b.classList.toggle('ativa',i===indice)); }
async function loadStatusContextCardPreview(itemId){ const holder=document.getElementById('status-context-card-preview'); if(!holder) return; try{ const detail=await fetchWorkspaceItem(itemId); const asset=statusContextPreviewAsset(detail); if(!asset){ holder.innerHTML='<div class="status-context-preview-empty"><b>Sem arte disponível</b>Não há imagem anexada à demanda ou às atualizações carregadas. O briefing continua sendo a fonte de orientação até que uma prévia seja vinculada.</div>'; return; } const source=asset.public_url||asset.url_thumbnail||asset.url||''; if(!source){ holder.innerHTML='<div class="status-context-preview-empty"><b>Arquivo sem prévia</b>O item possui um arquivo, mas ele não disponibiliza imagem de visualização.</div>'; return; } holder.innerHTML=`<img src="${safeText(source)}" alt="Prévia de ${safeText(asset.name||'Card')}"><small class="status-context-preview-caption">${safeText(asset.name||'Prévia vinculada ao item')}</small>`; }catch(error){ holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. O restante do fluxo permanece disponível.</div>'; } }
function openStatusContextGate(item, option) {
  const rule=contextRuleFor(option); const requiresQuality=statusNeedsQuality(option); const requiresHandoff=statusNeedsHandoff(item,option); const checks=requiresQuality ? qualityChecklistFor(item) : []; const isCard=statusContextIsCard(item);
  const requesterFields = rule.requester ? `<label class="workflow-field"><span>De quem veio ou depende esta decisão?</span><input id="status-context-requester" type="text" placeholder="Ex.: Cliente, Paulo, aprovação interna..."></label>` : '';
  const sourceFields = rule.source ? `<label class="workflow-field"><span>Onde está a referência?</span><select id="status-context-source"><option value="WhatsApp">WhatsApp</option><option value="Monday">Monday.com</option><option value="Reunião">Reunião</option><option value="E-mail">E-mail</option><option value="Outro">Outro</option></select></label>` : '';
  const completedField = (rule.completed || requiresHandoff) ? `<label class="workflow-field"><span>O que foi concluído antes desta etapa?</span><textarea id="status-context-completed" rows="3" placeholder="Ex.: Versão final revisada, arquivo anexado e copy conferida."></textarea></label>` : '';
  const checklist = requiresQuality ? `<div class="workflow-checks"><span class="workflow-field"><span>Checklist de qualidade</span></span>${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" data-quality-check name="quality-${index}"><span>${safeText(check)}</span></label>`).join('')}</div>` : '';
  const responsible=`<div class="status-context-responsible"><div class="workflow-field"><span>Quem executará a próxima ação?</span>${statusContextResponsibleOptions(item)}</div><small class="status-context-responsible-hint"><b>Responsável da próxima ação:</b> a seleção é limitada à disciplina elegível e fica registrada junto com esta passagem de status.</small></div>`;
  const form=`<form id="status-context-form" onchange="updateStatusContextState()"><label class="workflow-field"><span>${safeText(rule.question)}</span><textarea id="status-context-reason" rows="3" placeholder="Descreva o motivo desta mudança de status."></textarea></label>${completedField}${requesterFields}${sourceFields}${responsible}<label class="workflow-field"><span>Link ou arquivo de referência (opcional)</span><input id="status-context-link" type="url" placeholder="https://drive.google.com/... ou link da referência"></label>${checklist}</form>`;
  const preview=isCard?`<aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia do card</b><small>arquivo vinculado</small></div><div id="status-context-card-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside>`:'';
  pendingWorkflowChange={item,option,manual:false};
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Contexto de status</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Antes de entrar em “${safeText(option.label)}”</h2><p class="workflow-copy">${safeText(rule.helper)}</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout"><div class="status-context-main">${form}</div>${preview}</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="status-context-submit" type="button" class="workflow-primary" onclick="submitStatusContext()">Registrar e atualizar →</button></div><p class="workflow-hint">A Vybe OS registra este contexto e quem executará a próxima ação no histórico da peça, junto com a mudança de etapa.</p>`);
  if(isCard){ document.getElementById('workflow-modal')?.classList.add('status-context-split'); loadStatusContextCardPreview(item.id); }
  updateStatusContextState();
}
async function submitStatusContext() {
  const flow=pendingWorkflowChange; if(!flow) { showToast('O contexto desta mudança expirou. Feche e abra a alteração novamente.','err',7000); return; } const reason=String(document.getElementById('status-context-reason')?.value||'').trim(); const nextOwnerId=String(document.getElementById('status-context-next-owner')?.value||'').trim(); const nextOwner=[...(ownerEligibility(flow.item)?.users||[]),...(TEAM_USERS||[])].find(user=>String(user.id)===nextOwnerId)||null; const next=nextOwner?`${nextOwner.name} executará a próxima ação.`:''; const completed=String(document.getElementById('status-context-completed')?.value||'').trim(); const requester=String(document.getElementById('status-context-requester')?.value||'').trim(); const source=String(document.getElementById('status-context-source')?.value||'').trim(); const link=String(document.getElementById('status-context-link')?.value||'').trim(); const rule=contextRuleFor(flow.option);
  if(!reason || !nextOwner) return showToast('Explique o motivo e selecione quem executará a próxima ação.','info'); if((rule.requester && !requester) || (rule.completed && !completed)) return showToast('Preencha os campos de contexto obrigatórios desta etapa.','info'); if(link && !/^https?:\/\//i.test(link)) return showToast('Use um link válido começando com https:// ou deixe o campo em branco.','info'); const quality=[...document.querySelectorAll('input[data-quality-check]')]; if(quality.some(check=>!check.checked)) return showToast('Conclua o checklist de qualidade para continuar.','info'); const button=document.getElementById('status-context-submit'); const idleLabel=button?.textContent||'REGISTRAR E ATUALIZAR →'; if(button){button.disabled=true;button.textContent='Registrando...';}
  try { const qualityText=quality.length ? `\nChecklist de qualidade: ${quality.map(check=>check.parentElement.textContent.trim()).join(' | ')}` : ''; const body=`[Vybe OS · Contexto de status]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMotivo: ${reason}${completed ? `\nConcluído: ${completed}` : ''}${requester ? `\nSolicitante/Dependência: ${requester}` : ''}${source ? `\nOrigem: ${source}` : ''}\nResponsável pela próxima ação: ${nextOwner.name}${link ? `\nReferência: ${link}` : ''}${qualityText}`; await postItemUpdate(flow.item.id,body); [DADOS,DADOS_ALL,DADOS_DEMANDAS].forEach(list=>(list||[]).forEach(d=>{if(String(d.id)===String(flow.item.id)) d.status_context={target:flow.option.label,reason,next,requester,source,completed,link,next_owner_id:nextOwner.id,next_owner_name:nextOwner.name,created_at:new Date().toISOString()};})); const {item,option}=flow; closeWorkflowModal(); await commitStatusChange(item,option); } catch(e) { if(button){button.disabled=false;button.textContent=idleLabel;} showToast(`Não foi possível registrar o contexto: ${e.message}`,'err',7000); }
}
async function updateFocusStatus(itemId, statusIndex) { const item=findOperationalItem(itemId); const option=operationalStatusOptions(item).find(o=>Number(o.index)===Number(statusIndex)); if(!item || !option || item.status_index===option.index) return closeStatusEditor(); const needsGate=statusNeedsConferenciaVisual(option)||statusNeedsMaterialReview(option)||statusNeedsQuality(option)||statusNeedsContext(option)||statusNeedsHandoff(item,option); closeStatusEditor(); if(needsGate){ /* Um respiro para o seletor sair da tela antes de o portao entrar.
   Era requestAnimationFrame, que NAO dispara em aba de fundo: se a pessoa
   clicasse e trocasse de aba, a troca de status ficava parada para sempre,
   esperando um quadro que nunca vem. */
  await new Promise(resolve=>setTimeout(resolve,0)); if(statusNeedsConferenciaVisual(option)) return abrirConferenciaVisual(item,option); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if(statusNeedsQuality(option)) return openQualityGate(item,option); if(statusNeedsContext(option)) return openStatusContextGate(item,option); return openHandoffGate(item,option); } return commitStatusChange(item,option); }
let activeWorkspaceItemId = '';
let activeWorkspaceAssets = [];
function workspacePlainText(html='') {
  const temp = document.createElement('div');
  // Bloco vira quebra ANTES de extrair o texto: textContent de <p>A</p><p>B</p>
  // devolve "AB", sem separador — era assim que a memoria executiva saia com
  // tudo grudado, "atualizado]Veiculação: 28/08".
  temp.innerHTML = String(html).replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
                               .replace(/<br\s*\/?>/gi, '\n');
  return (temp.textContent || temp.innerText || '')
    .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}
function workspaceBytes(bytes=0) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function closeItemWorkspace() {
  document.getElementById('workspace-backdrop')?.remove();
  document.getElementById('workspace-drawer')?.remove();
  activeWorkspaceItemId = '';
  activeWorkspaceAssets = [];
}
async function fetchWorkspaceItem(itemId) {
  const r = await fetch(`/api/painel?area=peca&item=${encodeURIComponent(itemId)}`, { credentials:'same-origin', cache:'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `Workspace indisponível (${r.status})`);
  return d;
}
function workspaceFileColumnAssetIds(detail) {
  const column = (detail?.column_values || []).find(entry => String(entry?.id || '') === COLUNAS.producao.arquivos);
  if (!column?.value) return new Set();
  try {
    const value = typeof column.value === 'string' ? JSON.parse(column.value) : column.value;
    return new Set((value?.files || []).map(file => String(file?.assetId || file?.asset_id || file?.id || '')).filter(Boolean));
  } catch (error) { return new Set(); }
}
function workspaceAssetsForDetail(detail) {
  const columnAssetIds = workspaceFileColumnAssetIds(detail);
  const columnAssetCount = columnAssetIds.size;
  const collected = [
    // 'no_drive' guarda a resposta do servidor ANTES de a linha abaixo misturar
    // nela os arquivos da coluna do Monday. Sem essa separacao nao havia como
    // saber se a restricao de apagar um por vez se aplica ao arquivo.
    ...(detail?.assets || []).map(asset => ({ ...asset, source: asset.onde === 'drive' ? 'Drive da Vybe' : 'Arquivo legado', no_drive: Boolean(asset.removable || asset.onde === 'drive'), removable: Boolean(asset.removable || columnAssetIds.has(String(asset?.id || ''))), column_asset_count: columnAssetCount })),
    ...(detail?.updates || []).flatMap(update => (update?.assets || []).map(asset => ({ ...asset, source: 'Arquivo do histórico', removable: false, column_asset_count: columnAssetCount })))
  ];
  const used = new Set();
  return collected.filter(asset => {
    const key = String(asset?.id || `${asset?.name || ''}:${asset?.url || ''}`);
    if (!key || used.has(key)) return false;
    used.add(key);
    return true;
  });
}
function workspaceAssetPreviewFailed(image) {
  const fallback = String(image?.dataset?.fallbackSrc || '');
  if (fallback && image.dataset.fallbackTried !== 'true') {
    image.dataset.fallbackTried = 'true';
    image.src = fallback;
    return;
  }
  image.closest('.workspace-asset-preview')?.classList.add('preview-failed');
}
function workspaceAssetPreview(asset) {
  const href = asset.public_url || asset.url || '';
  const thumbnail = asset.url_thumbnail || '';
  const isImage = Boolean(thumbnail || /\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)(?:$|[?#])/i.test(String(asset.name || href)));
  if (!isImage) return `<div class="workspace-asset-preview workspace-asset-file">${safeText((asset.file_extension || 'ARQ').toUpperCase())}</div>`;
  const src = thumbnail || href;
  if (!src) return `<div class="workspace-asset-preview workspace-asset-file">IMG</div>`;
  const fallback = thumbnail && href && thumbnail !== href ? ` data-fallback-src="${safeText(href)}"` : '';
  return `<div class="workspace-asset-preview"><img src="${safeText(src)}"${fallback} alt="Prévia de ${safeText(asset.name)}" loading="eager" onerror="workspaceAssetPreviewFailed(this)"><div class="workspace-asset-preview-fallback"><b>Prévia indisponível</b><small>Abra o material para conferir o arquivo.</small></div></div>`;
}
function workspaceAssetCard(asset) {
  const href = asset.public_url || asset.url || '#';
  // Arquivo no Drive apaga um por um. A trava de "todos de uma vez" era do
  // Monday, que so deixa limpar a coluna inteira — e ela sobrou aplicada a tudo:
  // dependia de column_asset_count, contado a partir da coluna do Monday, que
  // hoje vem vazia. A conta dava 0, nunca 1, e o botao nao aparecia para
  // arquivo nenhum. Era por isso que nao dava para excluir.
  const removal = !asset.removable
    ? `<span class="workspace-asset-locked">${safeText(asset.source || 'ARQUIVO')}</span>`
    : (asset.no_drive || asset.column_asset_count === 1)
      ? `<button type="button" class="workspace-asset-remove"
          onclick="event.preventDefault();event.stopPropagation();requestWorkspaceFileRemoval('${safeText(asset.id)}')">Remover</button>`
      : `<span class="workspace-asset-locked" title="Este arquivo ainda mora na coluna do Monday, que só permite limpar todos de uma vez.">Arquivo de coluna</span>`;
  const isImage = Boolean(asset.url_thumbnail || /\\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)(?:$|[?#])/i.test(String(asset.name || href)));
    const openAction = isImage 
      ? `<a class="workspace-asset-open" href="${safeText(href)}" onclick="event.preventDefault(); event.stopPropagation(); openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')">ABRIR ↗</a>` 
      : `<a class="workspace-asset-open" href="${safeText(href)}" target="_blank" rel="noopener">ABRIR ↗</a>`;
    const clickPreview = isImage ? `onclick="openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')"` : "";
    return `<article class="workspace-asset" ${clickPreview} style="${isImage ? 'cursor:pointer;' : ''}">${workspaceAssetPreview(asset)}<div class="workspace-asset-name" title="${safeText(asset.name)}">${safeText(asset.name)}</div><small>${safeText(workspaceBytes(asset.file_size))} · ${safeText(asset.source || 'Arquivo')}</small><div class="workspace-asset-actions">${openAction}${removal}</div></article>`;
}
// Remover arquivo estava recusando SOLICITACAO.
//
// A peca era procurada so em DADOS e DADOS_ALL — as duas listas de Producao.
// Solicitacao vive em DADOS_DEMANDAS, entao a busca voltava vazia e a funcao
// caia no aviso "Migracao deste arquivo ainda nao foi concluida", que nao tem
// nada a ver: da frente, um botao que nao apaga e uma explicacao errada. Este
// painel ja tem uma funcao que procura nas tres listas — findOperationalItem —
// e era so usa-la, como o resto da tela faz.
//
// De quebra, a recusa passou a dizer O QUE esta faltando, em vez de repetir a
// mesma frase para tres motivos diferentes.
async function requestWorkspaceFileRemoval(assetId) {
  const asset = activeWorkspaceAssets.find((entry) => String(entry?.id || '') === String(assetId));
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(activeWorkspaceItemId) : null)
    || (DADOS || []).find((entry) => String(entry.id) === String(activeWorkspaceItemId))
    || (typeof DADOS_ALL !== 'undefined' ? (DADOS_ALL || []).find((entry) => String(entry.id) === String(activeWorkspaceItemId)) : null);
  if (!asset) return showToast('Arquivo não encontrado nesta atividade — recarregue a página.', 'err', 6000);
  if (!item) return showToast('Atividade não encontrada — recarregue a página e tente de novo.', 'err', 6000);
  if (!asset.removable || !asset.local_id) {
    return showToast('Este arquivo veio do Monday e ainda não foi copiado para o Drive da Vybe; '
      + 'por isso não pode ser removido daqui.', 'info', 8000);
  }
  // A arte aparece DENTRO da pergunta. Antes o clique no Remover subia para o
  // cartao e abria a arte em tela cheia; so depois de fechar e que vinha a
  // pergunta — a conferencia acontecia longe da decisao. Agora e uma coisa so:
  // ve o que vai apagar e decide ali.
  const previa = asset.url_thumbnail || asset.public_url || asset.url || '';
  const confirmado = typeof perguntarNoPainel === 'function'
    ? await perguntarNoPainel({
        titulo: 'Remover este arquivo?',
        imagem: previa ? { url: previa, nome: asset.name } : null,
        texto: 'Ele sai desta atividade e vai para a lixeira do Drive da Vybe. A remoção fica registrada no histórico, e um administrador consegue recuperar.',
        confirmar: 'Mover para a lixeira', perigo: true })
    : window.confirm(`Mover o arquivo "${asset.name}" para a lixeira do Drive da Vybe?`);
  if (!confirmado) return;
  try {
    const resposta = await fetch('/api/painel?area=peca', {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin',
      body:JSON.stringify({ item:item.id, arquivo_id:asset.local_id }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados?.error || `Falha ao remover (${resposta.status})`);
    showToast('✓ Arquivo movido para a lixeira do Drive', 'ok');
    renderWorkspaceDrawer(await fetchWorkspaceItem(item.id), item);
  } catch (error) { showToast(`Não foi possível remover o arquivo: ${error.message}`, 'err', 8000); }
}
function workspaceTimelineType(body){ const text=String(body||''); if(/Check-in/i.test(text)) return 'CHECK-IN'; if(/Planejamento/i.test(text)) return 'PLANEJAMENTO'; if(/Direcionamento D\.A/i.test(text)) return 'DIREÇÃO D.A.'; if(/Passagem de bastão/i.test(text)) return 'PASSAGEM'; if(/Link de entrega/i.test(text)) return 'ENTREGA'; if(/Bloqueio/i.test(text)) return 'BLOQUEIO'; return 'ATUALIZAÇÃO'; }
function workspaceUrlFromText(value=''){ const match=String(value||'').match(/https?:\/\/[^\s<>"']+/i); return match ? match[0].replace(/[),.;]+$/,'') : ''; }
function workspaceDeliveryInfo(detail={}){ const updates=detail?.updates||[]; const tagged=updates.map(update=>({update,url:workspaceUrlFromText(workspacePlainText(update?.body||''))})).find(entry=>entry.url && /Link de entrega|Link final|Entrega final/i.test(workspacePlainText(entry.update?.body||''))); if(tagged) return {url:tagged.url,label:'LINK DE ENTREGA REGISTRADO',name:'Material pronto para abrir e postar',creator:tagged.update?.creator?.name||'Equipe Vybe',created_at:tagged.update?.created_at||'',source:'Atualização de entrega'}; const assets=[...(detail?.assets||[]),...updates.flatMap(update=>update?.assets||[])]; const asset=assets.find(entry=>entry?.public_url||entry?.url); if(asset) return {url:asset.public_url||asset.url,label:'ARQUIVO ANEXADO À DEMANDA',name:asset.name||'Material anexado',creator:'Equipe Vybe',created_at:asset.created_at||'',source:'Arquivo do item'}; return null; }
function workspaceCopyFallback(text){ const input=document.createElement('textarea'); input.value=text; input.setAttribute('readonly',''); input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(input); input.select(); const copied=document.execCommand('copy'); input.remove(); if(!copied) throw new Error('Cópia manual indisponível'); }
function showWorkspaceDeliveryCopySheet(text){ document.getElementById('workspace-delivery-copy-sheet')?.remove(); const sheet=document.createElement('section'); sheet.id='workspace-delivery-copy-sheet'; sheet.className='workspace-delivery-copy-sheet'; sheet.innerHTML=`<b>Link pronto para copiar</b><small>Seu navegador bloqueou a cópia automática. O endereço abaixo já está selecionado: use Ctrl/Cmd + C.</small><input id="workspace-delivery-copy-value" readonly value="${safeText(text)}"><button type="button" onclick="document.getElementById('workspace-delivery-copy-sheet')?.remove()">Fechar</button>`; document.body.appendChild(sheet); const input=sheet.querySelector('input'); input?.focus(); input?.select(); }
async function copyWorkspaceDeliveryLink(url){ const text=String(url||'').trim(); if(!text) return showToast('Nenhum material disponível para copiar.','info'); try{ if(navigator.clipboard?.writeText){ await Promise.race([navigator.clipboard.writeText(text),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de cópia excedido')),1200))]); } else workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(error){ try{ workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(fallbackError){ showWorkspaceDeliveryCopySheet(text); showToast('Link aberto para cópia manual.','info',7000); } } }
function focusWorkspaceDeliveryInput(){ const input=document.getElementById('workspace-link-input'); if(!input) return; input.scrollIntoView({behavior:'smooth',block:'center'}); input.focus(); showToast('Cole aqui o link final para liberar a postagem.','info'); }
function workspaceDeliveryDock(detail,item){ const delivery=workspaceDeliveryInfo(detail); if(!delivery) return `<section class="workspace-delivery-dock missing"><div class="workspace-delivery-copy"><span class="workspace-delivery-kicker">Entrega para postagem</span><b>Material ainda não enviado</b><small>Quem publica não tem link nem arquivo final nesta demanda. Registre o material antes de mover para publicação.</small></div><div class="workspace-delivery-actions"><button type="button" class="workspace-delivery-focus" onclick="focusWorkspaceDeliveryInput()">REGISTRAR MATERIAL ↓</button></div></section>`; const when=delivery.created_at?new Date(delivery.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'sem horário disponível'; return `<section class="workspace-delivery-dock"><div class="workspace-delivery-copy"><span class="workspace-delivery-kicker">Entrega pronta para postar</span><b>${safeText(delivery.name)}</b><small>${safeText(delivery.source)} · enviado por ${safeText(delivery.creator)} · ${safeText(when)}</small></div><div class="workspace-delivery-actions"><a class="workspace-delivery-open" href="${safeText(delivery.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a><button type="button" class="workspace-delivery-copy-btn" onclick="copyWorkspaceDeliveryLink('${safeText(delivery.url)}')">Copiar link</button></div></section>`; }
function workspaceTimelineEvent(update){ const body=workspacePlainText(update?.body||'') || 'Atualização sem texto.'; const type=workspaceTimelineType(body); return `<div class="workspace-update workspace-timeline-event"><div class="workspace-update-meta"><span class="workspace-timeline-type">${type}</span>${safeText(update?.creator?.name||'Equipe Vybe')} · ${safeText((update?.created_at||'').replace('T',' ').slice(0,16))}</div><div class="workspace-update-body">${safeText(body)}</div></div>`; }
function workspaceExecutiveHistoryHtml(updates=[]) {
  const decisive=(updates||[]).filter(update=>/Direcionamento D\.A|Contexto de status|Passagem de bastão|Planejamento atualizado|Check-in/i.test(workspacePlainText(update?.body||''))).slice(0,5);
  if(!decisive.length) return '<section class="workspace-section workspace-executive-history"><div class="workspace-section-head">Memória executiva</div><div class="workspace-section-body"><div class="workspace-empty">Ainda não há decisão estruturada registrada nesta demanda.</div></div></section>';
  return `<section class="workspace-section workspace-executive-history"><div class="workspace-section-head">Memória executiva</div><div class="workspace-section-body"><p class="workspace-note">Somente decisões que mudam a próxima etapa, o responsável, o prazo ou a direção entram nesta leitura.</p>${decisive.map(update=>{const text=workspacePlainText(update?.body||''); const type=workspaceTimelineType(text); return `<div class="workspace-decision-memory"><span>${safeText(type)}</span><div><b>${safeText((update?.created_at||'').replace('T',' ').slice(0,16))}</b><p>${safeText(text)}</p></div></div>`;}).join('')}</div></section>`;
}

  function formatDuration(ms) {
    if (!ms || ms < 0) return 'agora';
    const totalMins = Math.floor(ms / 60000);
    if (totalMins < 60) return `${totalMins}m`;
    const hours = Math.floor(totalMins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        const remH = hours % 24;
        return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
    }
    const remM = totalMins % 60;
    return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`;
  }
  
  function workspaceHistoryHtml(detail, item) {
    if (!detail.activity_logs) return '';
    const logs = [...detail.activity_logs].sort((a,b) => Number(b.created_at) - Number(a.created_at));
    const history = [];
    let endTime = Date.now();
    let expectedTo = item.status;
    
    for (const entry of logs) {
        if (entry.event !== 'update_column_value') continue;
        try {
            const data = JSON.parse(entry.data);
            const fromStatus = data.previous_value?.label?.text || '-';
            const toStatus = data.value?.label?.text || '-';
            const timestamp = Math.floor(Number(entry.created_at) / 10000);
            
            history.push({ status: toStatus, durationMs: endTime - timestamp });
            endTime = timestamp;
            expectedTo = fromStatus;
        } catch(e) {}
    }
    
    const createdTime = detail.created_at ? new Date(detail.created_at).getTime() : null;
    if (createdTime) {
        history.push({ status: expectedTo, durationMs: endTime - createdTime });
    }
    
    const totals = {};
    for (const h of history) {
        if (h.status === '-' || !h.status) continue;
        if (h.durationMs) {
            totals[h.status] = (totals[h.status] || 0) + h.durationMs;
        }
    }
    
    const lines = Object.entries(totals)
        .sort((a,b) => b[1] - a[1])
        .map(([st, ms]) => `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">${pillHtml(st)}</div>
          <strong style="color:#b8d7df;font:700 12px var(--mac-mono, monospace);letter-spacing:0.5px;">${formatDuration(ms)}</strong>
        </div>`);
        
    if (lines.length === 0) return '';
    return `<section class="workspace-section"><div class="workspace-section-head">Tempo em cada etapa</div><div class="workspace-section-body">${lines.join('')}</div></section>`;
  }

// A ficha da peça, com os mesmos campos que o Monday mostra ao abrir um item —
// e editáveis no mesmo lugar, como lá. Antes o drawer trazia formato, prazo e
// status; para ver ou mudar captação, OFF, tipo de conteúdo ou o grupo era
// preciso abrir o Monday, que é justamente o que estamos deixando de fazer.

const GRUPOS_DA_PRODUCAO = [
  ['novo_grupo57911__1', 'Produção ( Foto e Vídeo, à Captar )'],
  ['novo_grupo__1', 'Design & Edição'],
  ['group_title', 'Redação'],
  ['novo_grupo22352__1', 'Gestão de publicações'],
  ['novo_grupo31348__1', 'Finalizados'],
];

let FICHA_ITEM = null;

// Só oferece opção ativa no Monday. Opção desativada continua no catálogo dele e
// gravaria aqui, mas a réplica é recusada com "label has been deactivated" — a
// tela ofereceria uma escolha que não chega ao outro lado.
//
// A opção atual entra mesmo desativada: esconder o valor que a peça já tem faria
// o seletor mostrar "—" para um campo preenchido, e salvar sem querer o apagaria.
function fichaSelect(campo, opcoes, atual, itemId) {
  const escolhida = String(atual || '');
  const oferecidas = opcoes.filter(([v, , ativa]) => ativa !== false || String(v) === escolhida);
  return `<select class="workspace-ficha-select" onchange="salvarCampoDaFicha('${itemId}','${campo}',this.value,this)">
    <option value=""${escolhida ? '' : ' selected'}>—</option>
    ${oferecidas.map(([v, r, ativa]) => `<option value="${safeText(v)}"${String(v) === escolhida ? ' selected' : ''}>${safeText(r)}${ativa === false ? ' (desativada)' : ''}</option>`).join('')}
  </select>`;
}

// O Monday deixa de ser lugar para o time entrar: quem não administra não vê o
// atalho, senão ele abre uma tela de "sem acesso" e parece defeito do painel.
// Renomear a peça. Não existia: dava para criar, nunca para corrigir um título.
// Com o time fora do Monday, um erro de digitação viraria permanente.
// Redesenha o painel depois de uma mudanca feita aqui dentro.
//
// Estas tres acoes chamavam uma funcao de nome renderAll, que nunca existiu — o
// typeof engolia o erro e a tela so mudava no proximo refresh: a peca renomeada
// continuava com o nome antigo, a excluida continuava na lista. Quem sabe
// redesenhar tudo e o renderOutboundItemPatch, ja usado em toda alteracao
// local; a visao de grupos, o calendario e a tabela de Demandas ficam de fora
// dele e sao chamados aqui.
// Ficou sendo o mesmo que renderOutboundItemPatch. Continua existindo porque o
// nome diz a intencao no ponto de uso — mas nao repete a lista de telas, que era
// justamente o que fazia as duas divergirem.
function redesenharAposMudanca(motivo = 'alteração') {
  if (typeof renderOutboundItemPatch === 'function') renderOutboundItemPatch(motivo);
}

async function renomearPeca(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  const novo = prompt('Novo título da peça:', item.nome || '');
  if (novo === null) return;
  const limpo = String(novo).trim();
  if (!limpo || limpo === item.nome) return;
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'titulo', item: String(itemId), titulo: limpo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível renomear.');
    // Atualiza as listas em memória para o card não voltar com o nome antigo.
    [DADOS, DADOS_ALL].forEach((lista) => (lista || []).forEach((x) => {
      if (String(x.id) === String(itemId)) x.nome = limpo;
    }));
    saveProductionCache();
    showToast(String(d.replica_monday || '').startsWith('falhou')
      ? '✓ Renomeado no Vybe · o Monday não recebeu a cópia' : '✓ Renomeado', 'ok', 4000);
    renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), findOperationalItem(itemId) || item);
    redesenharAposMudanca('renome');
  } catch (erro) {
    showToast(`Não foi possível renomear: ${erro.message}`, 'err', 7000);
  }
}

// Remover a peça. Sai das telas e vai para a lixeira do Monday; aqui a linha
// fica, com quem removeu e quando — histórico apagado não volta, e remover por
// engano é o motivo de a operação existir.
// Devolve true so quando a peca saiu de verdade. Quem chama da fila precisa
// saber: fechar a lista sem ter excluido nada seria mentir sobre o que houve.
async function removerPeca(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return false;
  // Uma caixa so, com o motivo dentro: eram duas janelas cinzas do navegador em
  // sequencia, e a segunda pedindo texto num prompt. Agora que apagar e de todo
  // o time, a pergunta pesa mais — e ela precisa parecer com o resto do painel.
  const motivo = await perguntarNoPainel({
    titulo: `Arquivar “${item.nome}”?`,
    texto: `Ela sai das listas e fica no arquivo por ${DIAS_NO_ARQUIVO} dias, de onde volta com um clique. Depois disso o caminho de volta é a lixeira do Monday.`,
    confirmar: 'Arquivar', perigo: true,
    campo: { valor: '', dica: 'Por que está arquivando? (opcional, fica no histórico)' },
  });
  if (motivo === null) return false;

  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'remover', item: String(itemId), motivo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível remover.');
    // Solicitacoes vivem numa terceira lista. Sem tira-la de la, a atividade
    // sumia da tabela de Producao e continuava na de Demandas e no calendario.
    [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach((lista) => {
      const pos = (lista || []).findIndex((x) => String(x.id) === String(itemId));
      if (pos >= 0) lista.splice(pos, 1);
    });
    saveProductionCache();
    closeItemWorkspace();
    // O botao agora tambem vive no cartao rapido, que fica por cima do calendario.
    if (typeof fecharCartaoRapido === 'function') fecharCartaoRapido();
    redesenharAposMudanca('exclusão');
    // O arrependimento chega em segundos, nao em dias: o desfazer fica no proprio
    // aviso, sem obrigar ninguem a saber que existe uma tela de arquivo.
    mostrarDesfazerArquivamento(item);
    return true;
  } catch (erro) { showToast(`Não foi possível arquivar: ${erro.message}`, 'err', 7000); return false; }
}

const DIAS_NO_ARQUIVO = 15;

function mostrarDesfazerArquivamento(item) {
  return mostrarDesfazerArquivamentoEmLote([item]);
}

// Uma barra so, saiba ela de uma peca ou de vinte. Duas implementacoes acabariam
// divergindo — e a que ninguem testa e a que fica errada.
function mostrarDesfazerArquivamentoEmLote(pecas) {
  const lista = (pecas || []).filter(Boolean);
  if (!lista.length) return;
  document.getElementById('desfazer-arquivo')?.remove();
  const ids = lista.map((p) => String(p.id)).join(',');
  const dito = lista.length === 1
    ? `<b>${safeText(lista[0].nome)}</b> foi para o arquivo.`
    : `<b>${lista.length} atividades</b> foram para o arquivo.`;
  const barra = document.createElement('div');
  barra.id = 'desfazer-arquivo';
  barra.className = 'desfazer-arquivo';
  barra.innerHTML = `<span>${dito}</span>
    <button type="button" onclick="restaurarVarias('${safeText(ids)}',this)">Desfazer</button>
    <button type="button" class="fechar" onclick="this.parentElement.remove()" aria-label="Fechar">×</button>`;
  document.body.append(barra);
  // setTimeout e nao requestAnimationFrame: rAF nao dispara em aba fora de foco,
  // e quem arquiva costuma trocar de janela em seguida. A barra ficaria com
  // opacidade zero, some sozinha em 12s, e o desfazer nunca teria existido.
  setTimeout(() => barra.classList.add('aberta'), 0);
  setTimeout(() => barra.remove(), 12000);
}

// Desfaz um arquivamento inteiro. Recarrega os dados UMA vez no fim, e nao a
// cada peca: vinte recargas seguidas travariam a tela justamente quando alguem
// esta com pressa de consertar.
async function restaurarVarias(idsJuntos, botao) {
  const ids = String(idsJuntos || '').split(',').filter(Boolean);
  if (!ids.length) return;
  if (botao) { botao.disabled = true; botao.textContent = 'Voltando…'; }
  let ok = 0; const falhas = [];
  for (const id of ids) {
    try {
      const r = await fetch('/api/conteudo', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'restaurar', item: String(id) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`);
      ok += 1;
    } catch (erro) { falhas.push(id); console.warn('não voltou', id, erro); }
  }
  document.getElementById('desfazer-arquivo')?.remove();
  showToast(falhas.length
    ? `${ok} de volta · ${falhas.length} não deu`
    : `✓ ${ok === 1 ? 'Voltou' : `${ok} voltaram`} para as listas`, falhas.length ? 'info' : 'ok', 6000);
  if (typeof refreshData === 'function') await refreshData();
  if (document.getElementById('arquivadas-lista')) carregarArquivadas();
}

// Traz UMA peca de volta. Serve a lista do arquivo, onde cada linha tem o
// proprio botao — os dois caminhos falam com a mesma acao do servidor.
async function restaurarPeca(itemId, botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Voltando…'; }
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'restaurar', item: String(itemId) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível restaurar.');
    document.getElementById('desfazer-arquivo')?.remove();
    // A peca voltou no banco; a tela so sabe disso recarregando os dados.
    showToast(`✓ “${d.titulo || 'Atividade'}” voltou para as listas`, 'ok', 6000);
    if (typeof refreshData === 'function') await refreshData();
    if (document.getElementById('arquivadas-lista')) carregarArquivadas();
    return true;
  } catch (erro) {
    if (botao) { botao.disabled = false; botao.textContent = 'Desfazer'; }
    showToast(`Não foi possível restaurar: ${erro.message}`, 'err', 7000);
    return false;
  }
}

// Mover entre Produção e Demandas. Demandas nunca entrou no nosso banco — é lido
// direto do Monday — então esta é uma das poucas operações que ainda depende
// dele de verdade, e a peça sai das nossas telas ao ir para lá.
async function moverPecaDeBoard(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  if (!confirm(`Mover “${item.nome}” para o board de Demandas?\n\nEla sai do painel de Produção. Demandas ainda é lido do Monday, então a peça passa a viver lá.`)) return;
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'mover_board', item: String(itemId), destino: '8385559107' }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível mover.');
    [DADOS, DADOS_ALL].forEach((lista) => {
      const pos = (lista || []).findIndex((x) => String(x.id) === String(itemId));
      if (pos >= 0) lista.splice(pos, 1);
    });
    saveProductionCache();
    closeItemWorkspace();
    redesenharAposMudanca('mudança de board');
    showToast(`✓ Movida para ${d.para}. ${d.aviso || ''}`, 'ok', 7000);
  } catch (erro) { showToast(`Não foi possível mover: ${erro.message}`, 'err', 7000); }
}

// Quem administra. Sobrou para o que muda a operacao de outras pessoas — mover
// uma peca de quadro, mexer no cadastro de clientes, nas etiquetas. Excluir
// peca SAIU daqui em 01/09/2026: quem cria e quem descobre que nasceu errada, e
// esperar um administrador para limpar a propria bagunca custava mais que o
// risco de um engano que a lixeira desfaz.
//
// Existia so o podeVerMonday, e ele deixou de significar "e administrador":
// passou a exigir tambem a chave de contingencia do Monday, ligada a mao num
// incidente. Como os botoes de excluir estavam pendurados nele, sumiram da tela
// de todo mundo — inclusive de quem administra. Quem e do Monday continua no
// portao do Monday; o resto vem para ca.
function podeAdministrar() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

function podeVerMonday() {
  if (!(typeof sessaoAtual === 'function' && sessaoAtual()?.admin)) return false;
  try { return localStorage.getItem('vybe_monday_contingency_ui_v1') === 'ativa'; }
  catch { return false; }
}

// A lista de tarefas de dentro de uma solicitação. Existe só no board de
// Demandas — em Produção a consulta volta vazia e a seção não aparece.
//
// Cada linha é editável: a bolinha troca o status, o nome renomeia, o × remove.
// Deixar isso só de leitura mandava a pessoa de volta ao Monday para marcar uma
// tarefa como feita.
function subitensHtml(detail, item) {
  const itens = detail?.subitens || [];
  const ehDemanda = typeof isRequestItem === 'function' ? isRequestItem(item) : false;
  if (!itens.length && !ehDemanda) return '';
  const feitos = itens.filter((s) => /^(feito|conclu|aprovado)/i.test(String(s.status || ''))).length;
  const dataCurta = (v) => {
    const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8,10)}/${iso.slice(5,7)}` : '';
  };
  const linhas = itens.map((s) => `
    <li class="subitem" data-subitem="${safeText(s.ref)}">
      <button type="button" class="subitem-marca" style="--cor:${s.status_cor || '#7c8797'}"
        title="Trocar status desta tarefa"
        onclick="abrirStatusDaTarefa(event,'${safeText(s.ref || '')}','${safeText(item.id)}')"></button>
      <span class="subitem-corpo">
        <b title="Clique para renomear"
           onclick="renomearTarefa('${safeText(s.ref || '')}','${safeText(item.id)}',this)">${safeText(s.titulo)}</b>
        <small>${[s.status, s.tipo, s.prioridade, s.responsaveis]
                  .filter(Boolean).map(safeText).join(' · ') || 'sem detalhe'}</small>
      </span>
      ${dataCurta(s.conclusao || s.prazo) ? `<span class="subitem-data">${dataCurta(s.conclusao || s.prazo)}</span>` : ''}
      <button type="button" class="subitem-tirar" title="Remover tarefa"
        onclick="removerTarefa('${safeText(s.ref || '')}','${safeText(item.id)}','${safeText(s.titulo).replace(/'/g, "\\'")}')">×</button>
    </li>`).join('');
  return `<section class="workspace-section">
    <div class="workspace-section-head">Tarefas da solicitação
      ${itens.length ? `<span class="subitem-contagem">${feitos} de ${itens.length}</span>` : ''}</div>
    <div class="workspace-section-body">
      <ul class="subitem-lista">${linhas || '<li class="workspace-empty">Nenhuma tarefa ainda.</li>'}</ul>
      <div class="subitem-nova">
        <input id="subitem-nova-${safeText(item.id)}" class="workspace-input" type="text"
               placeholder="Nova tarefa…" maxlength="255"
               onkeydown="if(event.key==='Enter'){event.preventDefault();criarTarefa('${safeText(item.id)}')}">
        <button type="button" class="workspace-action" onclick="criarTarefa('${safeText(item.id)}')">Adicionar</button>
      </div>
    </div>
  </section>`;
}

// Todas as escritas de tarefa passam por aqui: um caminho só para gravar, e um
// só lugar para redesenhar a gaveta depois.
async function mexerNaTarefa(corpo, itemId) {
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'subitem', ...corpo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    if (String(d.replica_monday || '').startsWith('falhou')) {
      showToast('✓ Salvo no Vybe · o Monday não recebeu a cópia, será reconciliada', 'info', 6000);
    }
    const atual = findOperationalItem(itemId);
    if (atual) renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), atual);
    return d;
  } catch (erro) {
    showToast(`Não foi possível salvar a tarefa: ${erro.message}`, 'err', 7000);
    return null;
  }
}

async function criarTarefa(itemId) {
  const campo = document.getElementById(`subitem-nova-${itemId}`);
  const titulo = String(campo?.value || '').trim();
  if (!titulo) return campo?.focus();
  campo.disabled = true;
  const d = await mexerNaTarefa({ operacao: 'criar', item: String(itemId), titulo }, itemId);
  if (d) showToast(`✓ Tarefa "${titulo}" adicionada`, 'ok');
  else if (campo) { campo.disabled = false; campo.focus(); }
}

async function renomearTarefa(subitemId, itemId, alvo) {
  const atual = alvo?.textContent || '';
  const novo = window.prompt('Nome da tarefa:', atual);
  if (novo === null || novo.trim() === atual.trim()) return;
  await mexerNaTarefa({ operacao: 'titulo', subitem: subitemId, titulo: novo.trim() }, itemId);
}

async function removerTarefa(subitemId, itemId, titulo) {
  if (!window.confirm(`Remover a tarefa "${titulo}"? Ela sai daqui e do Monday.`)) return;
  const d = await mexerNaTarefa({ operacao: 'remover', subitem: subitemId }, itemId);
  if (d) showToast('✓ Tarefa removida', 'ok');
}

// Mesmo seletor do status da peça: quem já sabe trocar um não aprende outro.
function abrirStatusDaTarefa(event, subitemId, itemId) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof fecharEscolha === 'function') fecharEscolha();
  document.getElementById('tarefa-editor-backdrop')?.remove();
  document.getElementById('tarefa-editor')?.remove();
  const opcoes = (typeof requestStatusOptions === 'function' ? requestStatusOptions({}) : []) || [];
  if (!opcoes.length) return showToast('As opções de status ainda estão carregando.', 'info');
  const rect = event.currentTarget.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'tarefa-editor-backdrop';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = () => { fundo.remove(); document.getElementById('tarefa-editor')?.remove(); };
  const menu = document.createElement('div');
  menu.id = 'tarefa-editor';
  menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">Status da tarefa</div>
    ${opcoes.map((o) => `<button type="button" class="status-editor-option"
        onclick="escolherStatusDaTarefa('${safeText(subitemId)}','${safeText(itemId)}','${safeText(chaveDeStatus(o.label))}')">
        <span class="status-editor-dot" style="background:${o.color};color:${o.color}"></span>
        <span>${safeText(o.label)}</span></button>`).join('')}`;
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
}

async function escolherStatusDaTarefa(subitemId, itemId, chave) {
  document.getElementById('tarefa-editor-backdrop')?.remove();
  document.getElementById('tarefa-editor')?.remove();
  const d = await mexerNaTarefa({ operacao: 'status', subitem: subitemId, para: chave }, itemId);
  if (d?.rotulo) showToast(`✓ Tarefa em ${d.rotulo}`, 'ok');
}

function workspaceFichaHtml(detail, itemId) {
  const f = detail?.ficha;
  if (!f) return '';
  FICHA_ITEM = itemId;
  const cat = detail.catalogos || { captacao: [], opcoes: [] };
  const por = (coluna) => (cat.opcoes || []).filter((o) => o.coluna_id === coluna).map((o) => [o.chave, o.rotulo, o.ativa]);
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const texto = (v) => `<b class="${v ? '' : 'vazio'}">${safeText(v || '—')}</b>`;

  const linhas = [
    ['Grupo', fichaSelect('grupo', GRUPOS_DA_PRODUCAO, f.grupo_id, itemId)],
    ['Cliente', texto(f.cliente)],
    // Status, datas e responsáveis eram texto morto aqui, com um aviso dizendo
    // para usar os botões acima. Editar onde a informação está é a regra do
    // resto do painel; três botões deixam de ser necessários.
    ['Status', `<button type="button" class="grupo-pill-btn" onclick="openStatusEditor(event,'${itemId}')"
        title="Trocar status">${pillHtml(f.status || 'Sem status')}</button>`],
    ['Captação', fichaSelect('captacao', (cat.captacao || []).map((o) => [o.chave, o.rotulo, o.ativa]), f.captacao_chave, itemId)],
    ['OFF / áudio', fichaSelect('off_audio', por('color_mkynd7j8'), f.off_audio_chave, itemId)],
    ['Tipo de conteúdo', fichaSelect('tipo_conteudo', por('lista_suspensa__1'), (f.tipo_conteudo_chaves || [])[0], itemId)],
    ['Formato', fichaSelect('formato', por('lista_suspensa0__1'), (f.formato_chaves || [])[0], itemId)],
    ['Prioridade', fichaSelect('prioridade', por('color_mm164yv8'), f.prioridade_chave, itemId)],
    ['Prazo', `<input type="date" class="grupo-data-campo" value="${safeText(String(f.prazo || '').slice(0,10))}"
        onchange="salvarDataNaLinha('${itemId}','prazo',this)">`],
    ['Veiculação', `<input type="date" class="grupo-data-campo" value="${safeText(String(f.veiculacao || '').slice(0,10))}"
        onchange="salvarDataNaLinha('${itemId}','veiculacao',this)">`],
    ['Responsável', `<button type="button" class="ficha-dono" onclick="openOwnerEditor(event,'${itemId}')"
        title="Gerenciar responsáveis">${safeText(f.responsaveis || '—')}</button>`],
    ['Editor/Designer', texto(f.editores)],
  ];

  // Campo vazio aparece como "—" em vez de sumir: saber que a captação está em
  // branco é informação, e sumir com a linha esconde o que falta preencher.
  return `<section class="workspace-section"><div class="workspace-section-head">Ficha da peça</div><div class="workspace-section-body"><div class="workspace-ficha">${
    linhas.map(([r, v]) => `<div class="workspace-ficha-linha"><span>${safeText(r)}</span>${v}</div>`).join('')
  }</div></div></section>`;
}

// Grava e recarrega a peça. Status e datas continuam pelos botões próprios, que
// passam pelas conferências — mudar status por um seletor solto pularia o
// checklist de qualidade.
async function salvarCampoDaFicha(itemId, campo, valor, alvo) {
  const anterior = alvo ? alvo.value : null;
  if (alvo) alvo.disabled = true;
  try {
    const corpo = campo === 'grupo'
      ? { acao: 'grupo', item: String(itemId), grupo_id: valor }
      : { acao: campo, item: String(itemId), para: valor ? [valor] : [] };
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    if (String(d.replica_monday || '').startsWith('falhou')) {
      showToast('✓ Salvo no Vybe · o Monday não recebeu a cópia, será reconciliada', 'info', 6000);
    } else {
      showToast(`✓ ${campo.replace('_', ' ')} atualizado`, 'ok', 3500);
    }
    if ((d.automacoes || []).length) {
      showToast(`Automação: ${d.automacoes.map((a) => a.nome).join(' · ')}`, 'info', 7000);
    }
    const item = findOperationalItem(itemId);
    // Só redesenha a gaveta se for esta peça que está aberta. Chamado pela
    // tabela por grupo, um refetch por campo salvo seria ida à rede à toa.
    if (item && String(activeWorkspaceItemId) === String(itemId)) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), item);
    }
    if (alvo) alvo.disabled = false;
    return true;
  } catch (erro) {
    if (alvo) { alvo.disabled = false; alvo.value = anterior; }
    showToast(`Não foi possível salvar: ${erro.message}`, 'err', 7000);
    return false;
  }
}

  function renderWorkspaceDrawer(detail, item) {
  const drawer = document.getElementById('workspace-drawer');
  if (!drawer || !detail) return;
  const assets = workspaceAssetsForDetail(detail);
  activeWorkspaceAssets = assets;
  const updates = detail.updates || [];
  const deadline = focusReferenceDate(item, focusUser());
  const format = item.formato || item.tipo || item.formato_conteudo || 'Conteúdo';
  drawer.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:22px 24px 120px;box-sizing:border-box;width:100%;height:100%;">
      <div class="workspace-kicker"><span>Vybe OS · Workspace da demanda</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div>
    <div class="workspace-client">${safeText(item.cliente || 'Cliente não informado')}
      <button type="button" class="workspace-id" onclick="copiarId('${safeText(item.id)}')"
              title="ID da atividade · clique para copiar">#${safeText(item.id)}</button></div>
    <h2 class="workspace-title" id="workspace-titulo" title="Clique para renomear" onclick="renomearPeca('${item.id}')">${safeText(item.nome)}</h2>
    <div class="workspace-meta"><span>${safeText(format)}</span><span>Prazo: ${safeText(deadline || 'não definido')}</span>${pillHtml(item.status,item.status_color,item.status_border)}</div>
    ${workspaceFichaHtml(detail, item.id)}
    ${subitensHtml(detail, item)}
    ${workspaceDeliveryDock(detail,item)}
    <div class="workspace-actions">${podeVerMonday() ? `<button type="button" class="workspace-action" onclick="moverPecaDeBoard('${item.id}')">Mover para Demandas</button>` : ''}<button type="button" class="workspace-action perigo" onclick="removerPeca('${item.id}')">Arquivar atividade</button>${podeVerMonday() ? `<a class="workspace-action" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">↗ Abrir no Monday</a>` : ''}</div>
    ${latestStatusContext({updates}) ? `<section class="workspace-section workspace-handoff"><div class="workspace-section-head">Contexto da etapa atual</div><div class="workspace-section-body"><div class="workspace-update-meta">${safeText(latestStatusContext({updates}).creator || 'Equipe Vybe')} · ${safeText((latestStatusContext({updates}).created_at || '').replace('T',' ').slice(0,16))}</div><div class="workspace-update-body">${safeText(latestStatusContext({updates}).reason || latestStatusContext({updates}).text)}</div>${latestStatusContext({updates}).next ? `<p class="workspace-note"><b>Próximo passo:</b> ${safeText(latestStatusContext({updates}).next)}</p>` : ''}</div></section>` : ''}
    <section class="workspace-section"><div class="workspace-section-head">Arquivos da demanda</div><div class="workspace-section-body"><div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<div class="workspace-empty">Nenhum arquivo anexado ainda.</div>'}</div></div></section>
    <section class="workspace-section"><div class="workspace-section-head">Entregar</div><div class="workspace-section-body">
      <p class="workspace-note">Duas formas, conforme o que você tem em mãos. Qualquer uma das duas registra a entrega na atividade.</p>
      <div class="entrega-caminhos">
        <div class="entrega-caminho">
          <div class="entrega-caminho-topo"><b>Arquivo pronto</b><small>card, arte ou PDF</small></div>
          <input id="workspace-file-input" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,application/pdf" onchange="uploadWorkspaceFile(this)">
          <div class="workspace-dropzone" onclick="document.getElementById('workspace-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleWorkspaceDrop(event)"><div><strong>Arraste aqui ou clique</strong>PNG, JPG, WEBP ou PDF · até 200 MB</div></div>
          <p class="workspace-note">Vai para a pasta do cliente no Drive da Vybe e aparece em “Arquivos da demanda”.</p>
        </div>
        <div class="entrega-caminho">
          <div class="entrega-caminho-topo"><b>Link do material</b><small>vídeo, ou arquivo grande demais</small></div>
          <input id="workspace-link-input" class="workspace-input" type="url" placeholder="Cole o link do Drive, Frame.io ou Canva">
          <button type="button" class="workspace-action primary" onclick="saveWorkspaceLink()">Registrar link da entrega</button>
          <p class="workspace-note">Fica no histórico da atividade, com quem registrou e quando.</p>
        </div>
      </div>
      <div class="entrega-depois"><span>Entregou? A próxima etapa precisa saber.</span><button type="button" class="workspace-action" onclick="openManualHandoff('${item.id}')">Passar bastão →</button></div>
    </div></section>
    
    <section class="workspace-section"><div class="workspace-section-head">Atualização rápida</div><div class="workspace-section-body"><textarea id="workspace-comment-input" class="workspace-textarea" placeholder="Ex.: Card finalizado e enviado para aprovação."></textarea><div class="workspace-form-row"><button type="button" class="workspace-action" onclick="saveWorkspaceComment()">Registrar atualização</button></div></div></section>
    

    ${workspaceExecutiveHistoryHtml(updates)}
      ${workspaceHistoryHtml(detail, item)}
    <details class="workspace-section workspace-recolhida"><summary>Todo o histórico<small>${updates.length} registro${updates.length===1?'':'s'}</small></summary><div class="workspace-section-body">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<div class="workspace-empty">Sem eventos registrados ainda.</div>'}</div></details></div>`;
}
async function openItemWorkspace(itemId) {
  closeItemWorkspace();
  // A gaveta e a mesa de planejamento nao convivem: a mesa cobre a tela inteira
  // e a gaveta abriria atras dela, invisivel. Quem pede o contexto completo esta
  // saindo da mesa — entao a mesa sai junto, venha o pedido de onde vier.
  if (typeof closeDaIndividualPlanningDesk === 'function'
      && document.getElementById('da-individual-planning-overlay')) closeDaIndividualPlanningDesk();
  let item = findOperationalItem(itemId);
  activeWorkspaceItemId = String(itemId);
  const backdrop = document.createElement('div');
  backdrop.id = 'workspace-backdrop'; backdrop.className = 'workspace-backdrop'; backdrop.onclick = closeItemWorkspace;
  const drawer = document.createElement('aside');
  drawer.id = 'workspace-drawer'; drawer.className = 'workspace-drawer'; drawer.innerHTML = '<div class="workspace-loading">Carregando contexto da demanda...</div>';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    if (!detail) throw new Error('A atividade não foi encontrada no banco Vybe.');
    if (!item) item = { id:String(itemId), nome:detail.name || 'Demanda', cliente:'Cliente não informado', status:'—', status_color:'#8f8f8f', status_border:'#8f8f8f', prazo_iso:'', veiculacao_iso:'', formato:'Conteúdo', url:'' };
    renderWorkspaceDrawer(detail, item);
  } catch (e) { drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Workspace</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-empty">Não foi possível carregar o contexto da demanda. ${safeText(e.message)}</div>`; }
}

// Workspace interno de Solicitações: leitura e contexto sem aplicar as automações do board de Produção.
async function openDemandaWorkspace(itemId) {
  closeItemWorkspace();
  // A gaveta da solicitacao esquecia de fechar a mesa. Ela abria — e abria ATRAS
  // da mesa, que cobre a tela inteira: clicar em "Abrir tudo" numa SOLICITACAO
  // parecia nao fazer nada. O conteudo fechava a mesa e a solicitacao nao; duas
  // portas para a mesma sala, so uma sabia disso.
  if (typeof closeDaIndividualPlanningDesk === 'function'
      && document.getElementById('da-individual-planning-overlay')) closeDaIndividualPlanningDesk();
  const item = (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []).find(d => String(d.id) === String(itemId));
  if (!item) return showToast('Solicitação não encontrada no contexto atual.', 'err');
  activeWorkspaceItemId = '';
  const backdrop = document.createElement('div');
  backdrop.id = 'workspace-backdrop'; backdrop.className = 'workspace-backdrop'; backdrop.onclick = closeItemWorkspace;
  const drawer = document.createElement('aside');
  drawer.id = 'workspace-drawer'; drawer.className = 'workspace-drawer';
  drawer.innerHTML = '<div class="workspace-loading">Carregando contexto da solicitação...</div>';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    const assets = detail?.assets || [];
    const updates = detail?.updates || [];
    drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Contexto da solicitação</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-client">${safeText(item.cliente || 'Cliente não informado')}</div><h2 class="workspace-title">${safeText(item.nome)}</h2><div class="workspace-meta"><span>${safeText(item.tipo || 'Solicitação')}</span><span>Prazo: ${safeText(item.prazo || 'não definido')}</span>${pillHtmlDemanda(item.status,item.status_color,item.status_border)}</div><section class="workspace-section"><div class="workspace-section-head">Contexto operacional</div><div class="workspace-section-body"><p class="workspace-note">Esta solicitação pertence à Central de Demandas. A atualização completa permanece no fluxo próprio dela.</p><p class="workspace-note"><b>Conclusão:</b> ${safeText(item.conclusao || 'não definida')} · <b>Responsável:</b> ${safeText(item.responsavel || 'não definido')}</p></div></section><section class="workspace-section"><div class="workspace-section-head">Arquivos</div><div class="workspace-section-body"><div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<div class="workspace-empty">Nenhum arquivo anexado ainda.</div>'}</div></div></section><section class="workspace-section"><div class="workspace-section-head">Histórico recente</div><div class="workspace-section-body">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<div class="workspace-empty">Sem atualizações registradas ainda.</div>'}</div></section><div class="workspace-actions">${podeVerMonday() ? `<a class="workspace-action" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">↗ Abrir no Monday</a>` : ''}</div></div>`;
  } catch (e) {
    drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Solicitação</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-empty">Não foi possível carregar o contexto. ${safeText(e.message)}</div>`;
  }
}

// Regra Vybe OS: clique em atividade abre contexto interno; Monday é um atalho deliberado dentro do workspace.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('workspace-drawer')) closeItemWorkspace();
  if (typeof managerCommandDrawerOpen !== 'undefined' && managerCommandDrawerOpen) closeManagerCommandDrawer();
  document.getElementById('cadastros-preview-overlay')?.remove();
  if (document.getElementById('da-member-workload-overlay')) closeDaMemberWorkload();
});

document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href*="/pulses/"]');
  if (!link || link.dataset.externalMonday === 'true') return;
  const match = link.href.match(/\/pulses\/(\d+)/);
  if (!match) return;
  event.preventDefault();
  event.stopPropagation();
  openItemWorkspace(match[1]);
}, true);
async function postWorkspaceUpdate(body, successMessage) {
  if (!activeWorkspaceItemId) return;
  const text = String(body || '').trim();
  if (!text) return showToast('Escreva uma atualização antes de enviar.', 'info');
  const item = findOperationalItem(activeWorkspaceItemId) || { id:activeWorkspaceItemId };
  await tentarEscritaDupla(item, { acao:'comentario', item:String(activeWorkspaceItemId), texto:text });
  showToast(successMessage, 'ok');
  const input = document.getElementById('workspace-comment-input'); if (input) input.value = '';
  const link = document.getElementById('workspace-link-input'); if (link) link.value = '';
  const atualizado = findOperationalItem(activeWorkspaceItemId);
  if (atualizado) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId), atualizado);
}
async function saveWorkspaceComment() {
  const input = document.getElementById('workspace-comment-input');
  try { await postWorkspaceUpdate(`[Vybe OS] ${input?.value || ''}`, '✓ Atualização registrada no Vybe OS'); }
  catch (e) { showToast(`Não foi possível registrar: ${e.message}`, 'err', 7000); }
}
async function saveWorkspaceLink() {
  const input = document.getElementById('workspace-link-input');
  const url = String(input?.value || '').trim();
  if (!/^https?:\/\//i.test(url)) return showToast('Cole um link válido começando com https://', 'info');
  try { await postWorkspaceUpdate(`[Vybe OS · Link de entrega] ${url}`, '✓ Link de entrega registrado no Vybe OS'); }
  catch (e) { showToast(`Não foi possível registrar o link: ${e.message}`, 'err', 7000); }
}
function handleWorkspaceDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  const input = document.getElementById('workspace-file-input');
  if (!input || !event.dataTransfer?.files?.[0]) return;
  const transfer = new DataTransfer(); transfer.items.add(event.dataTransfer.files[0]); input.files = transfer.files;
  uploadWorkspaceFile(input);
}
// Enviar arquivo de uma peça, num lugar só.
//
// A gaveta lateral já fazia isso; a coluna ARQUIVO da mesa individual precisa do
// mesmo envio. Duas implementações da mesma gravação viram duas verdades — uma
// aceitando tamanho que a outra recusa, uma criando pasta no Drive que a outra
// não cria.
//
// Devolve a resposta do servidor porque quem chama da mesa precisa do id do
// arquivo no Drive para desenhar a miniatura sem ir buscar de novo.
const ARQUIVO_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
// Ate aqui o arquivo cabe dentro de uma chamada nossa; acima disso ele vai
// direto para o Drive. O teto de 3 MB nunca foi do Drive — era o tamanho maximo
// que a nossa funcao aceita por chamada, e o base64 engorda o arquivo em um
// terco no caminho. O destino sempre aceitou muito mais.
const ARQUIVO_PELO_SERVIDOR = 3 * 1024 * 1024;
const ARQUIVO_LIMITE = 200 * 1024 * 1024;

async function enviarArquivoDaPeca(itemId, file, aoAndar) {
  if (!itemId || !file) throw new Error('Informe a peça e o arquivo.');
  if (!ARQUIVO_TIPOS.includes(file.type)) throw new Error('Envie PNG, JPG, WEBP ou PDF.');
  if (file.size > ARQUIVO_LIMITE) {
    throw new Error('Arquivo acima de 200 MB. Suba no Drive e registre o link aqui.');
  }
  const corpo = { item: String(itemId), nome: file.name, mime: file.type };

  if (file.size > ARQUIVO_PELO_SERVIDOR) return enviarArquivoGrande(corpo, file, aoAndar);

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, conteudo: base64 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) throw new Error(explicarFalhaDeArquivo(json, res.status, file));
  return json;
}

// Erro de upload que chega como "HTTP 500" ou como a frase crua do Google nao
// diz a quem esta na frente da tela o que fazer. Estas sao as falhas que
// aparecem de verdade, traduzidas para a acao correspondente. O texto original
// vai inteiro para o console: e ele que precisa chegar a quem for consertar.
function explicarFalhaDeArquivo(json, status, file) {
  const cru = String(json?.error || json?.errors?.[0]?.message || `HTTP ${status}`);
  console.error('Falha ao anexar arquivo', { status, resposta: json, arquivo: file && {
    nome: file.name, tipo: file.type, bytes: file.size } });
  const tem = (...termos) => termos.some((t) => cru.toLowerCase().includes(t));
  if (tem('quota', 'storage limit', 'storagequotaexceeded')) {
    return 'O Drive da Vybe está sem espaço para receber arquivo novo. '
      + `Avise quem administra — nada do que já subiu se perdeu. (${cru})`;
  }
  if (tem('permission', 'forbidden', 'insufficient', '403')) {
    return `O Vybe não tem permissão de escrita nessa pasta do Drive. (${cru})`;
  }
  if (tem('não configurada', 'nao configurada', 'service_account', 'drive_pasta_raiz')) {
    return `A ligação com o Drive está sem configuração no servidor. (${cru})`;
  }
  if (tem('não encontrado', 'nao encontrado', '404')) {
    return `Esta peça não existe no banco — recarregue a página e tente de novo. (${cru})`;
  }
  if (status === 413 || tem('payload', 'too large', 'request entity')) {
    return 'O arquivo é grande demais para esta via. Tente de novo — acima de 3 MB '
      + `ele deveria ir direto ao Drive. (${cru})`;
  }
  return cru;
}

// Arquivo grande vai em pedacos, todos pela nossa API.
//
// A primeira tentativa mandava os bytes do navegador direto para o Google, o que
// seria o caminho mais curto. Nao funciona: a sessao e aberta pelo servidor, sem
// cabecalho de origem, e o Google recusa um envio que venha de outra origem —
// "Failed to fetch", sem explicacao nenhuma na tela.
//
// Entao os bytes voltam a passar por nos, fatiados. Cada pedaco cabe folgado no
// limite da funcao e o arquivo inteiro deixa de ter teto. O preco e uma ida por
// pedaco; por isso a barra de progresso, para a espera ter rosto.
const PEDACO_DO_ENVIO = 2 * 1024 * 1024; // multiplo de 256 KB, como o Drive exige

async function enviarArquivoGrande(corpo, file, aoAndar) {
  const abertura = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, etapa: 'abrir' }),
  });
  const dadosDaAbertura = await abertura.json().catch(() => ({}));
  if (!abertura.ok || !dadosDaAbertura?.sessao) {
    // Mesma traducao do envio pequeno: falha do Drive tem de dizer o que fazer.
    throw new Error(explicarFalhaDeArquivo(dadosDaAbertura, abertura.status, file));
  }

  const total = file.size;
  let enviado = 0;
  let arquivo = null;
  while (enviado < total) {
    const pedaco = file.slice(enviado, Math.min(enviado + PEDACO_DO_ENVIO, total));
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(pedaco);
    });
    const parte = await fetch('/api/painel?area=peca', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corpo, etapa: 'parte', sessao: dadosDaAbertura.sessao,
                             inicio: enviado, total, conteudo: base64 }),
    });
    const d = await parte.json().catch(() => ({}));
    if (!parte.ok) throw new Error(d?.error || `Envio interrompido em ${Math.round(enviado / 1048576)} MB.`);
    enviado = d.concluido ? total : (Number(d.recebido) || enviado + pedaco.size);
    if (typeof aoAndar === 'function') aoAndar(Math.min(100, Math.round((enviado / total) * 100)));
    if (d.concluido) { arquivo = d; break; }
  }
  if (!arquivo?.id) throw new Error('O Drive não confirmou o arquivo no fim do envio.');

  const registro = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, etapa: 'registrar', drive_file_id: arquivo.id, bytes: total }),
  });
  const json = await registro.json().catch(() => ({}));
  if (!registro.ok) throw new Error(json?.error || `Arquivo no Drive, mas não registrado (${registro.status}).`);
  return json;
}

// VÁRIOS ARQUIVOS DE UMA VEZ.
//
// O campo aceitava um por vez, e um carrossel de dez paginas virava dez idas ao
// botao — sendo que a pessoa ja tinha as dez selecionadas na pasta.
//
// Vao um atras do outro, e nao todos juntos, de proposito: cada arquivo grande
// e fatiado em pedacos, e disparar dez em paralelo multiplicaria as idas ao
// servidor sem acelerar nada. Um que falha nao derruba os outros — o aviso do
// fim diz quantos foram e quais nao deram.
async function uploadWorkspaceFile(input) {
  const arquivos = [...(input?.files || [])];
  if (!arquivos.length || !activeWorkspaceItemId) return;
  const item = findOperationalItem(activeWorkspaceItemId);
  const total = arquivos.length;
  const foram = []; const falhas = [];
  try {
    for (let i = 0; i < total; i += 1) {
      const file = arquivos[i];
      const deQuantos = total > 1 ? ` (${i + 1} de ${total})` : '';
      const mega = (file.size / 1048576).toFixed(1).replace('.', ',');
      showToast(`Enviando ${file.name} (${mega} MB)${deQuantos}…`, 'info', 60000);
      try {
        // Arquivo de 40 MB leva vinte idas ao servidor. Sem contar em voz alta,
        // a tela parece travada e a pessoa fecha no meio.
        await enviarArquivoDaPeca(activeWorkspaceItemId, file, (pct) => {
          if (pct < 100) showToast(`Enviando ${file.name}${deQuantos} · ${pct}%`, 'info', 60000);
        });
        foram.push(file.name);
      } catch (erro) { falhas.push({ nome: file.name, motivo: erro.message }); }
    }
    if (foram.length) {
      showToast(foram.length === 1
        ? '✓ Arquivo anexado no Drive da Vybe'
        : `✓ ${foram.length} arquivos anexados no Drive da Vybe`, 'ok', 6000);
    }
    if (falhas.length) {
      // Uma caixa por falha viraria uma fila de caixas. Uma so, com a lista.
      await perguntarNoPainel({
        titulo: falhas.length === 1 ? 'Um arquivo não subiu' : `${falhas.length} arquivos não subiram`,
        texto: falhas.map((f) => `${f.nome}: ${f.motivo}`).join('\n'),
        confirmar: 'Entendi',
      });
    }
    if (item) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId), item);
  } finally { if (input) input.value = ''; }
}
