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
  return `<button type="button" class="focus-status-btn" onclick="openStatusEditor(event,'${d.id}')" title="Atualizar status no Monday">${pillHtml(d.status,d.status_color,d.status_border)}</button>`;
}
function operationalOriginTag(item={}) { const request=isRequestItem(item); return `<span class="operational-origin-tag ${request?'request':'content'}" title="Origem operacional: ${request?'Solicitação de Demandas':'Produção de Conteúdo'}">${request?'SOLICITAÇÃO':'CONTEÚDO'}</span>`; }
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
    const baseMeta = [contexto, late ? '⚠️ Atrasado' : '', risk.sla_label || '', dateLabel].filter(Boolean).join(' • ');
    const meta = baseMeta;
    const finalMetaHtml = safeText(meta) + timerHtml;
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
  const top = cabeAbaixo ? rect.bottom + 6 : Math.max(margem, rect.top - 6 - height);
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(Math.min(Math.max(margem, rect.left), window.innerWidth - width - margem))}px`;
  menu.style.visibility = '';
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
  menu.innerHTML = `<div class="status-editor-head">${isRequestItem(item)?'Solicitação':'Status'}</div>${statusOptions.map(o => `<button type="button" class="status-editor-option ${o.index === item.status_index ? 'current' : ''}" onclick="updateFocusStatus('${item.id}',${o.index})"><span class="status-editor-dot" style="background:${o.color};color:${o.color}"></span><span>${safeText(o.label)}</span>${o.index === item.status_index ? '<span class="status-editor-check">✓</span>' : ''}</button>`).join('')}`;
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
const QUALITY_TARGET_STATUSES = new Set(['para agendar','agendado']);
const MATERIAL_REVIEW_TARGET_STATUSES = new Set(['agendado','finalizado','feito']);
const CONTEXT_FREE_STATUSES = new Set(['em andamento','em execução','em execucao','para aprovação','para aprovacao','finalizado','feito']);
let pendingWorkflowChange = null;
function normalizedWorkflowStatus(status='') { return String(status).trim().toLowerCase(); }
function statusNeedsHandoff(item, option) { return item && option && HANDOFF_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && normalizedWorkflowStatus(item.status) !== normalizedWorkflowStatus(option.label); }
function statusNeedsMaterialReview(option) { return option && MATERIAL_REVIEW_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)); }
function statusNeedsQuality(option) { return option && QUALITY_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && !statusNeedsMaterialReview(option); }
function statusNeedsContext(option) {
  const status = normalizedWorkflowStatus(option?.label);
  // Finalizado não exige justificativa: a única trava é a conferência visual do material.
  return Boolean(status) && !CONTEXT_FREE_STATUSES.has(status) && !statusNeedsQuality(option) && !statusNeedsMaterialReview(option);
}
function workflowItemHtml(item, target='') { return `<div class="workflow-item"><span class="workflow-item-client">${safeText(item.cliente || 'Cliente não informado')}</span><span class="workflow-item-name">${safeText(item.nome)}${target ? ` <small style="color:#ffb850">→ ${safeText(target)}</small>` : ''}</span></div>`; }
function closeWorkflowModal() { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); pendingWorkflowChange = null; }
function openWorkflowModal(html) { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); const back=document.createElement('div'); back.id='workflow-backdrop'; back.className='workflow-backdrop'; back.onclick=closeWorkflowModal; const modal=document.createElement('section'); modal.id='workflow-modal'; modal.className='workflow-modal'; modal.innerHTML=html; document.body.append(back,modal); }
// Todo registro de histórico do painel passa por aqui — checklist de qualidade,
// troca de responsáveis, ajuste de prazo. Ligando esta função, o histórico
// inteiro passa a nascer no banco da Vybe em vez de nascer no Monday.
async function postItemUpdate(itemId, body) {
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null) || { id: itemId };
  const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'comentario', item:String(itemId), texto:String(body) });
  if (pelaEscritaDupla) return true;
  const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
  return mondayQuery(mutation, { item:String(itemId), body:String(body) });
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
function openHandoffGate(item, option=null) { pendingWorkflowChange={item,option,manual:!option}; const target=option?.label || 'próxima pessoa ou etapa'; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Passagem de bastão</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Deixe a próxima etapa pronta</h2><p class="workflow-copy">Registre o contexto mínimo para que o trabalho siga sem perda de informação.</p>${workflowItemHtml(item,target)}<label class="workflow-field"><span>O que foi concluído?</span><textarea id="handoff-done" rows="3" placeholder="Ex.: Arte revisada, versão final aprovada internamente e arquivo anexado."></textarea></label><label class="workflow-field"><span>O que precisa acontecer agora?</span><textarea id="handoff-next" rows="3" placeholder="Ex.: Tainara deve conferir a legenda e agendar para segunda-feira."></textarea></label><label class="workflow-field"><span>Link ou arquivo de referência (opcional)</span><input id="handoff-link" type="url" placeholder="https://drive.google.com/... ou link do arquivo"></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitHandoff()">REGISTRAR E ${option ? 'ATUALIZAR STATUS' : 'SALVAR'} →</button></div>`); }
function openManualHandoff(itemId) { const item=findOperationalItem(itemId); if (item) openHandoffGate(item,null); }

const outboundItemPatchQueue = new Map();
function outboundPatchFields(patch={}) { return Object.entries(patch).filter(([,value])=>value!==undefined && value!==null); }
function applyOutboundItemPatch(itemId, patch={}, label='alteração') {
  if (patch.status && !patch.status_updated_at) patch.status_updated_at = new Date().toISOString();
  const key=String(itemId); const now=new Date().toISOString(); const fields=outboundPatchFields(patch);
  [DADOS,DADOS_ALL].forEach(list=>(list||[]).forEach(item=>{
    if(String(item.id)!==key) return;
    fields.forEach(([field,value])=>{ item[field]=Array.isArray(value)?[...value]:value; });
    if(patch.prazo_iso) item.prazo=planningDateBr(patch.prazo_iso);
    if(patch.veiculacao_iso) item.veiculacao=planningDateBr(patch.veiculacao_iso);
    item.updated_at=now;
    item.operational_risk=getOperationalRisk(item);
  }));
  saveProductionCache();
  renderOutboundItemPatch(label);
  queueOutboundItemReconciliation(key,patch,label);
}
function renderOutboundItemPatch(label='alteração') {
  const previousScroll=window.scrollY;
  renderCompactSummary(); renderOperationalTools(); renderIdentityOperationalPulse();
  if(panelMode==='foco') renderFocusDashboard();
  else if(panelMode==='controler') renderDaController();
  else { renderKPIs(); for(let n=1;n<=(META?.weeks?.length||0);n++) renderWeek(n,currentFilter,currentDayFilter); renderManagerIntelligence(); }
  requestAnimationFrame(()=>window.scrollTo({top:previousScroll,behavior:'instant'}));
  cacheSyncLabel(`Alteração local aplicada · confirmando somente a demanda no Monday…`);
  setSyncHealth('checking', `Alteração enviada · confirmando somente a demanda alterada…`);
}
function outboundPatchMatches(item,patch={}) {
  return outboundPatchFields(patch).every(([field,value])=>{
    const remote=item?.[field];
    return Array.isArray(value) ? JSON.stringify((remote||[]).map(String).sort())===JSON.stringify(value.map(String).sort()) : String(remote??'')===String(value??'');
  });
}
function queueOutboundItemReconciliation(itemId, patch={}, label='alteração', attempt=0) {
  const key=String(itemId); const previous=outboundItemPatchQueue.get(key); if(previous?.timer) clearTimeout(previous.timer);
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
function updateGoldenDeadlineState() { const veic=String(document.getElementById('planning-veiculacao')?.value||''); const prazo=String(document.getElementById('planning-prazo')?.value||''); const target=goldenDeadlineIso(veic); const gap=goldenDeadlineGap(prazo,veic); const state=document.getElementById('planning-golden-state'); if(!state) return; const ok=Boolean(target&&prazo===target); state.classList.toggle('golden-ok',ok); state.classList.toggle('golden-risk',!ok); state.innerHTML=`<b>${ok?'✓ PRAZO DE OURO PROTEGIDO':target?`◷ PRAZO DE OURO: ${planningDateBr(target)}`:'◷ INFORME A VEICULAÇÃO'}</b><span>${gap===null?'Defina as duas datas para medir a antecedência.':ok?`${PRAZO_OURO_DIAS} dias completos de antecedência para a criação.`:`A margem atual é de ${gap} dia${gap===1?'':'s'}; use o padrão de ${PRAZO_OURO_DIAS} dias ou registre uma exceção.`}</span><button type="button" class="workflow-secondary" onclick="applyGoldenDeadline()">Aplicar 7 dias</button>`; }
function applyGoldenDeadline() { const veic=String(document.getElementById('planning-veiculacao')?.value||''); const prazo=document.getElementById('planning-prazo'); const golden=goldenDeadlineIso(veic); if(!golden) return showToast('Informe a veiculação antes de aplicar o Prazo de Ouro.','info'); if(prazo) prazo.value=golden; updateGoldenDeadlineState(); }
function openPlanningEditor(itemId) {
  const item=findOperationalItem(itemId);
  if(!item) return showToast('Demanda não encontrada.', 'err');
  const prazo=item.prazo_iso || '';
  const veiculacao=item.veiculacao_iso || '';
  const golden=goldenDeadlineIso(veiculacao);
  const gap=goldenDeadlineGap(prazo,veiculacao);
  const onGolden=Boolean(golden&&prazo===golden);
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Planejamento da demanda</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Datas rápidas</h2><p class="workflow-copy">Altere prazo e veiculação sem sair da atividade. O <b>Prazo de Ouro</b> protege a criação com sete dias completos antes da publicação.</p>${workflowItemHtml(item,item.status)}<div class="planning-date-grid"><label class="planning-date-card"><b>⏰ PRAZO DE OURO</b><small>Produção pronta ${PRAZO_OURO_DIAS} dias antes da veiculação.</small><input id="planning-prazo" type="date" value="${prazo}" onchange="updateGoldenDeadlineState()"></label><label class="planning-date-card"><b>◷ VEICULAÇÃO</b><small>Data prevista para publicação do conteúdo.</small><input id="planning-veiculacao" type="date" value="${veiculacao}" onchange="updateGoldenDeadlineState()"></label></div><div id="planning-golden-state" class="planning-change-note ${onGolden?'golden-ok':'golden-risk'}"><b>${onGolden?'✓ PRAZO DE OURO PROTEGIDO':golden?`◷ PRAZO DE OURO: ${planningDateBr(golden)}`:'◷ INFORME A VEICULAÇÃO'}</b><span>${gap===null?'Defina as duas datas para medir a antecedência.':onGolden?`${PRAZO_OURO_DIAS} dias completos de antecedência para a criação.`:`A margem atual é de ${gap} dia${gap===1?'':'s'}; use o padrão de ${PRAZO_OURO_DIAS} dias ou registre uma exceção.`}</span><button type="button" class="workflow-secondary" onclick="applyGoldenDeadline()">Aplicar 7 dias</button></div><label class="workflow-field"><span>Motivo da exceção <em style="opacity:.55;font-style:normal">(obrigatório se o prazo não seguir 7 dias)</em></span><textarea id="planning-reason" rows="3" placeholder="Ex.: urgência aprovada; cliente alterou a campanha ou a captação."></textarea></label><div class="planning-change-note"><b>Rastreabilidade automática:</b> o Vybe OS registra as datas anterior e nova, o horário, a regra aplicada e o responsável no histórico da peça.</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="planning-save" type="button" class="workflow-primary" onclick="savePlanningDates('${item.id}')">Salvar datas →</button></div>`);
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
    const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
    await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify(values)});
    const changes=[]; if(prazoChanged) changes.push(`Prazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(prazo)}`); if(veicChanged) changes.push(`Veiculação: ${planningDateBr(item.veiculacao_iso)} → ${planningDateBr(veiculacao)}`);
    try { await postItemUpdate(item.id,`[Vybe OS · Planejamento atualizado]\n${changes.join('\n')}\nRegra: ${followsGolden?`Prazo de Ouro respeitado (${PRAZO_OURO_DIAS} dias antes da veiculação)`:`Exceção ao Prazo de Ouro (${(()=>{const d=goldenDeadlineGap(prazo,veiculacao);return d===1?'1 dia':`${d} dias`;})()} de antecedência)`}${reason ? `\nMotivo: ${reason}` : ''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); } catch(logError) { console.warn('Datas atualizadas, mas o log não foi registrado.',logError); }
    if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){ if(prazoChanged){request.prazo_iso=prazo;request.prazo=planningDateBr(prazo).slice(0,5);} if(veicChanged){request.conclusao_iso=veiculacao;request.conclusao=planningDateBr(veiculacao).slice(0,5);request.veiculacao_iso=veiculacao;request.veiculacao=planningDateBr(veiculacao).slice(0,5);} } outboundMutationGuardUntil=0; renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{...(prazoChanged?{prazo_iso:prazo}:{}),...(veicChanged?{veiculacao_iso:veiculacao}:{})},'planejamento');
    closeWorkflowModal();
    if(activeWorkspaceItemId===String(item.id)) { const refreshed=findOperationalItem(item.id)||item; renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),refreshed); }
    showToast('✓ Planejamento atualizado no Monday · painel mantido no contexto atual','ok');
  } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível atualizar o planejamento: ${e.message}`,'err',7000); }
}
function openDaDirectionModal(itemId) { const item=findOperationalItem(itemId); if(!item) return showToast('Demanda não encontrada.', 'err'); pendingDaDirectionItemId=String(itemId); const owners=daControllerTeam().map(user=>`<option value="${user.id}">${safeText(firstName(user.name))}</option>`).join(''); openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Direcionamento de arte</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Direcionar esta demanda</h2><p class="workflow-copy">Registre a decisão visual no histórico da peça para que o time execute sem depender do WhatsApp.</p>${workflowItemHtml(item,item.status)}<label class="workflow-field"><span>Qual é a direção objetiva?</span><textarea id="da-direction-text" rows="4" placeholder="Ex.: Ajustar a hierarquia do título, trocar a imagem principal e usar a referência enviada pelo cliente."></textarea></label><label class="workflow-field"><span>Quem precisa agir agora?</span><select id="da-direction-owner"><option value="">Manter responsável atual</option>${owners}</select></label><label class="workflow-field"><span>Próximo passo esperado</span><input id="da-direction-next" type="text" placeholder="Ex.: Nova versão para validação interna até amanhã."></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitDaDirection()">Registrar direção →</button></div>`); }
async function submitDaDirection() { const item=findOperationalItem(pendingDaDirectionItemId); const direction=String(document.getElementById('da-direction-text')?.value||'').trim(); const next=String(document.getElementById('da-direction-next')?.value||'').trim(); const ownerId=String(document.getElementById('da-direction-owner')?.value||''); if(!item || !direction) return showToast('Descreva a direção antes de registrar.', 'info'); const owner=daControllerTeam().find(user=>user.id===ownerId); try { await postItemUpdate(item.id,`[Vybe OS · Direcionamento de D.A.]\nDireção: ${direction}${owner?`\nQuem executa: ${owner.name}`:''}${next?`\nPróximo passo: ${next}`:''}`); item.status_context={reason:direction,next:next||item.status_context?.next||'',created_at:new Date().toISOString()}; closeWorkflowModal(); pendingDaDirectionItemId=''; showToast('✓ Direcionamento registrado no Monday','ok'); renderDaController(); if(activeWorkspaceItemId===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),item); } catch(e) { showToast(`Não foi possível registrar o direcionamento: ${e.message}`,'err',7000); } }
async function submitHandoff() { const flow=pendingWorkflowChange; const done=String(document.getElementById('handoff-done')?.value||'').trim(); const next=String(document.getElementById('handoff-next')?.value||'').trim(); const link=String(document.getElementById('handoff-link')?.value||'').trim(); if (!flow || !done || !next) return showToast('Preencha o que foi concluído e o próximo passo.','info'); if (link && !/^https?:\/\//i.test(link)) return showToast('Use um link válido começando com https:// ou deixe o campo em branco.','info'); try { await postItemUpdate(flow.item.id, `[Vybe OS · Passagem de bastão]\n${flow.option ? `Etapa: ${flow.item.status} → ${flow.option.label}\n` : ''}Concluído: ${done}\nPróximo passo: ${next}${link ? `\nReferência: ${link}` : ''}`); const {item,option,manual}=flow; closeWorkflowModal(); if (manual) { showToast('✓ Passagem de bastão registrada no Monday','ok'); if (activeWorkspaceItemId) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId),item); } else await commitStatusChange(item,option); } catch(e) { showToast(`Não foi possível registrar a passagem: ${e.message}`,'err',7000); } }
async function commitStatusChange(item, option) { const mutation=`mutation ($board: ID!, $item: ID!, $value: JSON!) { change_column_value(board_id: $board, item_id: $item, column_id: "status", value: $value) { id } }`; armOutboundMutationGuard('status'); try { const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'status', item:String(item.id), para:chaveDeStatus(option.label) }); if (!pelaEscritaDupla) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),value:JSON.stringify({index:Number(option.index)})}); updateLocalStatus(item.id,option); if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(d=>String(d.id)===String(item.id)); if(request) { request.status=option.label; request.status_color=option.color; request.status_border=option.border; request.status_index=option.index; request.status_updated_at=new Date().toISOString(); } renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{status:option.label,status_color:option.color,status_border:option.border,status_index:option.index},'status'); closeStatusEditor(); if(String(activeWorkspaceItemId)===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id), findOperationalItem(item.id) || item); renderFocusUserPicker(); showToast(`✓ Status atualizado para ${option.label} · tela mantida no contexto atual`,'ok'); } catch(e) { showToast(`Não foi possível atualizar no Monday: ${e.message}`,'err',7000); } }
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
function statusContextResponsibleOptions(item){ const rule=ownerEligibility(item); const current=new Set(assignedIds(item)); const eligible=(rule?.users||[]).filter(user=>user?.id); const currentUsers=(TEAM_USERS||[]).filter(user=>current.has(String(user.id))); const users=[...new Map([...eligible,...currentUsers].map(user=>[String(user.id),user])).values()]; return users.map(user=>{const isEligible=eligible.some(candidate=>String(candidate.id)===String(user.id)); return `<option value="${safeText(user.id)}" ${current.has(String(user.id))?'selected':''}>${safeText(user.name)} · ${safeText(isEligible?rule?.label||'Equipe':'Responsável atual')}</option>`;}).join(''); }
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
  const responsible=`<div class="status-context-responsible"><label class="workflow-field"><span>Quem executará a próxima ação?</span><select id="status-context-next-owner"><option value="">Selecione o responsável</option>${statusContextResponsibleOptions(item)}</select></label><small class="status-context-responsible-hint"><b>Responsável da próxima ação:</b> a seleção é limitada à disciplina elegível e fica registrada junto com esta passagem de status.</small></div>`;
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
async function updateFocusStatus(itemId, statusIndex) { const item=findOperationalItem(itemId); const option=operationalStatusOptions(item).find(o=>Number(o.index)===Number(statusIndex)); if(!item || !option || item.status_index===option.index) return closeStatusEditor(); const needsGate=statusNeedsMaterialReview(option)||statusNeedsQuality(option)||statusNeedsContext(option)||statusNeedsHandoff(item,option); closeStatusEditor(); if(needsGate){ await new Promise(resolve=>requestAnimationFrame(resolve)); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if(statusNeedsQuality(option)) return openQualityGate(item,option); if(statusNeedsContext(option)) return openStatusContextGate(item,option); return openHandoffGate(item,option); } return commitStatusChange(item,option); }
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
    const sourceItem=findOperationalItem(itemId);
    const boardId=sourceItem?.board_id || (isRequestItem(sourceItem)?BOARD_DEMANDAS_ID:BOARD_ID);
    // Anexos, comentários e histórico saem do banco da Vybe. Era o último lugar
    // do dia a dia que buscava no Monday a cada abertura de peça. Item de
    // Demandas não está no domínio e segue pelo caminho antigo; qualquer falha
    // cai no Monday também, para abrir a peça nunca depender disto.
    if (!isRequestItem(sourceItem)) {
      try {
        const r = await fetch(`/api/painel?area=peca&item=${encodeURIComponent(itemId)}`, { credentials:'same-origin' });
        if (r.ok) { const d = await r.json(); if (d?.ok) return d; }
      } catch (erro) { console.warn('Detalhe da peça pelo banco falhou; usando o Monday.', erro); }
    }
    const query = `query($board: [ID!]!, $item: [ID!]!) { items(ids: $item) { id name created_at assets { id name url url_thumbnail public_url file_extension file_size created_at } column_values(ids:["file_mkwtx2j4"]) { id value } updates(limit: 12) { id body created_at creator { name } assets { id name url url_thumbnail public_url file_extension file_size } } } boards(ids: $board) { activity_logs(item_ids: $item, column_ids: ["status"], limit: 50) { id event data created_at } } }`;
    const data = await mondayQuery(query, { board: [String(boardId)], item: [String(itemId)] });
    const itemData = data?.items?.[0];
    if (itemData) {
      itemData.activity_logs = data?.boards?.[0]?.activity_logs || [];
    }
    return itemData || null;
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
    ...(detail?.assets || []).map(asset => ({ ...asset, source: 'Arquivo da demanda', removable: columnAssetIds.has(String(asset?.id || '')), column_asset_count: columnAssetCount })),
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
  const removal = asset.removable
    ? (asset.column_asset_count === 1
      ? `<button type="button" class="workspace-asset-remove" onclick="requestWorkspaceFileRemoval('${safeText(asset.id)}')">Remover</button>`
      : `<span class="workspace-asset-locked" title="O Monday só permite limpar todos os arquivos desta coluna de uma vez.">Arquivo de coluna</span>`)
    : `<span class="workspace-asset-locked">${safeText(asset.source || 'ARQUIVO')}</span>`;
  const isImage = Boolean(asset.url_thumbnail || /\\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)(?:$|[?#])/i.test(String(asset.name || href)));
    const openAction = isImage 
      ? `<a class="workspace-asset-open" href="${safeText(href)}" onclick="event.preventDefault(); event.stopPropagation(); openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')">ABRIR ↗</a>` 
      : `<a class="workspace-asset-open" href="${safeText(href)}" target="_blank" rel="noopener">ABRIR ↗</a>`;
    const clickPreview = isImage ? `onclick="openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')"` : "";
    return `<article class="workspace-asset" ${clickPreview} style="${isImage ? 'cursor:pointer;' : ''}">${workspaceAssetPreview(asset)}<div class="workspace-asset-name" title="${safeText(asset.name)}">${safeText(asset.name)}</div><small>${safeText(workspaceBytes(asset.file_size))} · ${safeText(asset.source || 'Arquivo')}</small><div class="workspace-asset-actions">${openAction}${removal}</div></article>`;
}
async function requestWorkspaceFileRemoval(assetId) {
  const asset = activeWorkspaceAssets.find(entry => String(entry?.id || '') === String(assetId));
  const item = (DADOS || []).find(entry => String(entry.id) === String(activeWorkspaceItemId)) || (typeof DADOS_ALL !== 'undefined' ? (DADOS_ALL || []).find(entry => String(entry.id) === String(activeWorkspaceItemId)) : null);
  if (!asset || !item || !asset.removable || asset.column_asset_count !== 1) return showToast('Este arquivo não pode ser removido individualmente pelo painel.', 'info', 7000);
  const client = item.cliente || 'cliente não informado';
  const confirmed = window.confirm(`Remover definitivamente o arquivo "${asset.name}" da demanda "${item.nome}" do cliente ${client}?\n\nEsta ação remove o único arquivo da coluna de entrega no Monday e não pode ser desfeita.`);
  if (!confirmed) return;
  try {
    const mutation = `mutation($board: ID!, $item: ID!, $value: JSON!) { change_column_value(board_id: $board, item_id: $item, column_id: "file_mkwtx2j4", value: $value) { id } }`;
    await mondayQuery(mutation, { board: String(BOARD_ID), item: String(item.id), value: JSON.stringify({ clear_all: true }) });
    try { await postItemUpdate(item.id, `[Vybe OS · Arquivo removido]\nCliente: ${client}\nArquivo removido: ${asset.name}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); } catch (historyError) { console.warn('Arquivo removido, mas o histórico não foi registrado.', historyError); }
    showToast('✓ Arquivo removido do Monday', 'ok');
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
function redesenharAposMudanca(motivo = 'alteração') {
  if (typeof renderOutboundItemPatch === 'function') renderOutboundItemPatch(motivo);
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
  if (typeof renderManagerCalendar === 'function') renderManagerCalendar();
  if (typeof renderDemandas === 'function' && typeof activeBoard !== 'undefined'
      && activeBoard === 'demandas') renderDemandas();
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
async function removerPeca(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  if (!confirm(`Excluir “${item.nome}”?\n\nEla sai do painel e vai para a lixeira do Monday. O histórico fica guardado e um administrador consegue trazer de volta.`)) return;
  const motivo = prompt('Por que está excluindo? (opcional, fica no histórico)') || '';
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
    showToast(String(d.replica_monday || '').startsWith('falhou')
      ? '✓ Excluída do painel · o Monday não recebeu' : '✓ Atividade excluída', 'ok', 5000);
  } catch (erro) { showToast(`Não foi possível remover: ${erro.message}`, 'err', 7000); }
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

function podeVerMonday() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
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
    <div class="workspace-actions"><button type="button" class="workspace-action" onclick="openFocusBlocker('${item.id}')">Sinalizar bloqueio</button>${podeVerMonday() ? `<button type="button" class="workspace-action" onclick="moverPecaDeBoard('${item.id}')">Mover para Demandas</button><button type="button" class="workspace-action perigo" onclick="removerPeca('${item.id}')">Excluir atividade</button>` : ''}${podeVerMonday() ? `<a class="workspace-action" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">↗ Abrir no Monday</a>` : ''}</div>
    ${latestStatusContext({updates}) ? `<section class="workspace-section workspace-handoff"><div class="workspace-section-head">Contexto da etapa atual</div><div class="workspace-section-body"><div class="workspace-update-meta">${safeText(latestStatusContext({updates}).creator || 'Equipe Vybe')} · ${safeText((latestStatusContext({updates}).created_at || '').replace('T',' ').slice(0,16))}</div><div class="workspace-update-body">${safeText(latestStatusContext({updates}).reason || latestStatusContext({updates}).text)}</div>${latestStatusContext({updates}).next ? `<p class="workspace-note"><b>Próximo passo:</b> ${safeText(latestStatusContext({updates}).next)}</p>` : ''}</div></section>` : ''}
    <section class="workspace-section"><div class="workspace-section-head">Arquivos da demanda</div><div class="workspace-section-body"><div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<div class="workspace-empty">Nenhum arquivo anexado ainda.</div>'}</div></div></section>
    <section class="workspace-section"><div class="workspace-section-head">Anexar entrega</div><div class="workspace-section-body"><input id="workspace-file-input" type="file" hidden accept="image/png,image/jpeg,image/webp,application/pdf" onchange="uploadWorkspaceFile(this)"><div class="workspace-dropzone" onclick="document.getElementById('workspace-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleWorkspaceDrop(event)"><div><strong>Enviar card ou arte</strong>Arraste aqui ou clique para selecionar</div></div><p class="workspace-note">PNG, JPG, WEBP ou PDF · até 3 MB. Para vídeos, registre o link do Drive abaixo.</p></div></section>
    <details class="workspace-section workspace-recolhida"><summary>Entrega guiada<small>passo a passo, se preferir</small></summary><div class="workspace-section-head-oculta"><div class="workspace-section-body"><p class="workspace-note">Para concluir com continuidade: anexe ou registre o link final, atualize o status e deixe a passagem de bastão para a próxima etapa.</p><input id="workspace-link-input" class="workspace-input" type="url" placeholder="Cole o link do Drive, Frame.io ou Canva"><div class="workspace-form-row"><button type="button" class="workspace-action primary" onclick="saveWorkspaceLink()">1. Registrar link da entrega</button><button type="button" class="workspace-action" onclick="openManualHandoff('${item.id}')">2. Passar bastão</button></div></div></details>
    
    <section class="workspace-section"><div class="workspace-section-head">Atualização rápida</div><div class="workspace-section-body"><textarea id="workspace-comment-input" class="workspace-textarea" placeholder="Ex.: Card finalizado e enviado para aprovação."></textarea><div class="workspace-form-row"><button type="button" class="workspace-action" onclick="saveWorkspaceComment()">Registrar atualização</button></div></div></section>
    
    <details class="workspace-section workspace-recolhida workspace-checkin"><summary>Check-in de execução</summary><div class="workspace-section-body"><p class="workspace-note">Registre o início ou o encerramento de um bloco de trabalho sem sair do Vybe OS. O sinal entra na linha do tempo da atividade.</p><div class="workspace-form-row"><button type="button" class="workspace-action primary" onclick="registerWorkspaceCheckin('início')">▶ Iniciar bloco</button><button type="button" class="workspace-action" onclick="registerWorkspaceCheckin('fechamento')">■ Encerrar bloco</button></div></div></details>
    ${workspaceExecutiveHistoryHtml(updates)}
      ${workspaceHistoryHtml(detail, item)}
    <details class="workspace-section workspace-recolhida"><summary>Todo o histórico<small>${updates.length} registro${updates.length===1?'':'s'}</small></summary><div class="workspace-section-body">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<div class="workspace-empty">Sem eventos registrados ainda.</div>'}</div></details></div>`;
}
async function openItemWorkspace(itemId) {
  closeItemWorkspace();
  let item = findOperationalItem(itemId);
  activeWorkspaceItemId = String(itemId);
  const backdrop = document.createElement('div');
  backdrop.id = 'workspace-backdrop'; backdrop.className = 'workspace-backdrop'; backdrop.onclick = closeItemWorkspace;
  const drawer = document.createElement('aside');
  drawer.id = 'workspace-drawer'; drawer.className = 'workspace-drawer'; drawer.innerHTML = '<div class="workspace-loading">Carregando contexto da demanda...</div>';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    if (!detail) throw new Error('A atividade não foi encontrada no Monday.');
    if (!item) item = { id:String(itemId), nome:detail.name || 'Demanda', cliente:'Cliente não informado', status:'—', status_color:'#8f8f8f', status_border:'#8f8f8f', prazo_iso:'', veiculacao_iso:'', formato:'Conteúdo', url:`https://gestaovybes-team.monday.com/boards/${BOARD_ID}/pulses/${itemId}` };
    renderWorkspaceDrawer(detail, item);
  } catch (e) { drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Workspace</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-empty">Não foi possível carregar o contexto da demanda. ${safeText(e.message)}</div>`; }
}

// Workspace interno de Solicitações: leitura e contexto sem aplicar as automações do board de Produção.
async function openDemandaWorkspace(itemId) {
  closeItemWorkspace();
  const item = DADOS_DEMANDAS.find(d => String(d.id) === String(itemId));
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
  const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
  await mondayQuery(mutation, { item: String(activeWorkspaceItemId), body: text });
  showToast(successMessage, 'ok');
  const input = document.getElementById('workspace-comment-input'); if (input) input.value = '';
  const link = document.getElementById('workspace-link-input'); if (link) link.value = '';
  const item = DADOS.find(d => String(d.id) === String(activeWorkspaceItemId));
  if (item) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId), item);
}
async function registerWorkspaceCheckin(stage) { const label=stage==='início'?'INÍCIO DE EXECUÇÃO CONFIRMADO':'FECHAMENTO DE BLOCO CONFIRMADO'; try { await postWorkspaceUpdate(`[Vybe OS · Check-in] ${label}`, `✓ ${stage==='início'?'Bloco iniciado':'Bloco encerrado'} e registrado no Monday`); } catch (e) { showToast(`Não foi possível registrar o check-in: ${e.message}`, 'err', 7000); } }
async function saveWorkspaceComment() {
  const input = document.getElementById('workspace-comment-input');
  try { await postWorkspaceUpdate(`[Vybe OS] ${input?.value || ''}`, '✓ Atualização registrada no Monday'); }
  catch (e) { showToast(`Não foi possível registrar: ${e.message}`, 'err', 7000); }
}
async function saveWorkspaceLink() {
  const input = document.getElementById('workspace-link-input');
  const url = String(input?.value || '').trim();
  if (!/^https?:\/\//i.test(url)) return showToast('Cole um link válido começando com https://', 'info');
  try { await postWorkspaceUpdate(`[Vybe OS · Link de entrega] ${url}`, '✓ Link de entrega registrado no Monday'); }
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
async function uploadWorkspaceFile(input) {
  const file = input?.files?.[0];
  if (!file || !activeWorkspaceItemId) return;
  const allowed = ['image/png','image/jpeg','image/webp','application/pdf'];
  if (!allowed.includes(file.type)) return showToast('Envie PNG, JPG, WEBP ou PDF.', 'info');
  if (file.size > 3 * 1024 * 1024) return showToast('Arquivo acima de 3 MB. Para vídeo, use o link do Drive.', 'info');
  const item = DADOS.find(d => String(d.id) === String(activeWorkspaceItemId));
  try {
    showToast('Enviando arquivo para o Drive da Vybe...', 'info', 6000);
    const base64 = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const res = await fetch('/api/painel?area=peca', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ item:String(activeWorkspaceItemId), nome:file.name, mime:file.type, conteudo:base64 }) });
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(json.error || json.errors?.[0]?.message || `HTTP ${res.status}`);
    showToast('✓ Arquivo anexado no Drive da Vybe', 'ok');
    if (item) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId), item);
  } catch (e) { showToast(`Não foi possível anexar: ${e.message}`, 'err', 7000); }
  finally { if (input) input.value = ''; }
}
