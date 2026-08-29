// vybe-agenda.js — aprovações e agenda mensal por cliente
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Central de aprovações e pendências externas ─────────────────────────────
let showAllExternalPendings = false;
const EXTERNAL_PENDING_RULES = Object.freeze({
  'Para aprovação': { label:'Aprovação', next:'Solicitar aprovação do cliente', request:'a aprovação final deste conteúdo', external:true },
  'Ag. Aprovação Cliente': { label:'Aprovação cliente', next:'Fazer follow-up de aprovação', request:'o retorno de aprovação deste conteúdo', external:true },
  'Falta Info': { label:'Informação', next:'Solicitar as informações ou materiais pendentes', request:'as informações ou materiais necessários para concluir o conteúdo', external:true },
  'Ag. Info Cliente': { label:'Informação cliente', next:'Fazer follow-up das informações solicitadas', request:'as informações solicitadas para avançar com o conteúdo', external:true },
  'Aguardo': { label:'Retorno', next:'Confirmar com o cliente o que falta para seguir', request:'a confirmação necessária para seguirmos com o conteúdo', external:true },
  'Alteração': { label:'Alteração', next:'Solicitar ou alinhar o retorno sobre a alteração', request:'o retorno sobre os ajustes solicitados', external:true },
  'Ag. Interno': { label:'Validação interna', next:'Definir quem fará a validação interna', request:'a validação interna necessária para liberar o conteúdo', external:false }
});
function externalPendingInfo(d) { return EXTERNAL_PENDING_RULES[d.status] || null; }
function getExternalPendingItems() {
  return DADOS.filter(d => !isFinishedItem(d) && externalPendingInfo(d)).sort((a,b) => {
    const ar = Number(a.operational_risk?.score ?? 99), br = Number(b.operational_risk?.score ?? 99);
    const ah = Number(a.operational_risk?.hours_in_status ?? 0), bh = Number(b.operational_risk?.hours_in_status ?? 0);
    return ar - br || bh - ah || getReferenceDate(a).localeCompare(getReferenceDate(b));
  });
}
function pendingFollowUpMessage(d) {
  const info = externalPendingInfo(d);
  if (!info) return '';
  const greeting = info.external ? 'Olá! ' : 'Pendente interno: ';
  return `${greeting}para avançarmos com “${d.nome}”${d.cliente && d.cliente !== '—' ? `, da ${d.cliente}` : ''}, precisamos de ${info.request}. Assim que recebermos esse retorno, seguiremos com a próxima etapa.`;
}
async function copyPendingFollowUp(itemId) {
  const item = DADOS.find(d => String(d.id) === String(itemId));
  const text = item ? pendingFollowUpMessage(item) : '';
  if (!text) return showToast('Não foi possível montar o lembrete desta pendência.', 'err');
  try {
    await navigator.clipboard.writeText(text);
    showToast('✓ Lembrete copiado para enviar no canal de atendimento', 'ok');
  } catch (e) {
    const area = document.createElement('textarea');
    area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    showToast('✓ Lembrete copiado para enviar no canal de atendimento', 'ok');
  }
}
function pendingRowHtml(d) {
  const info = externalPendingInfo(d);
  const risk = d.operational_risk || getOperationalRisk(d);
  const elapsed = risk.sla_label || 'SLA ainda sem histórico de etapa';
  return `<div class="pending-row"><span class="pending-client" title="${safeText(d.cliente)}">${safeText(d.cliente)}</span><div class="pending-content"><button type="button" class="pending-name" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto do conteúdo">${safeText(d.nome)}</button><div class="pending-next">${safeText(info.next)} · ${safeText(elapsed)}</div></div><div class="pending-actions">${riskBadgeHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}<button type="button" class="pending-copy" onclick="copyPendingFollowUp('${d.id}')">COPIAR</button><button type="button" class="pending-open" onclick="openItemWorkspace('${d.id}')">ABRIR</button></div></div>`;
}
function pendingCentralCard(items) {
  const visible = showAllExternalPendings ? items : items.slice(0,5);
  const body = visible.length ? visible.map(pendingRowHtml).join('') : '<div class="manager-empty">✓ Nenhuma aprovação ou pendência externa aguardando retorno</div>';
  const more = items.length > 5 ? `<button type="button" class="pending-expand" onclick="toggleExternalPendings()">${showAllExternalPendings ? 'MOSTRAR MENOS' : `VER MAIS (${items.length - 5})`}</button>` : '';
  return `<div class="manager-card pending-card" style="--card-color:#579bfc"><div class="manager-card-head"><span>⌁ Aprovações e pendências externas</span><span>${items.length}</span></div><div class="manager-card-body">${body}${more}</div></div>`;
}
function toggleExternalPendings() { showAllExternalPendings = !showAllExternalPendings; renderManagerIntelligence(); }
function assignedIds(d) { return (d.responsavel_ids && d.responsavel_ids.length) ? d.responsavel_ids : (d.responsavel_id ? [d.responsavel_id] : []); }
function hasAnyAssignment(d, ids) { return assignedIds(d).some(id => ids.includes(id)); }
function getIntegrityIssues(items=DADOS) {
  const designIds = EQUIPES.design; // Deivid, Beatriz, Jady
  const publicationIds = EQUIPES.publicacao; // Tainara, Paulo, Vinícius
  const reristonId = PESSOAS.RERISTON;
  return items.filter(d => !isFinishedItem(d)).map(d => {
    const assigned = assignedIds(d);
    const fmt = String(d.formato || '').toLowerCase();
    if (!assigned.length) return {d, reason:'Sem responsável'};
    if (d.status === 'Falta D.A' && !hasAnyAssignment(d, designIds)) return {d, reason:'Falta D.A fora do design'};
    if (['Para agendar','Agendado'].includes(d.status) && !hasAnyAssignment(d, publicationIds)) return {d, reason:'Publicação sem responsável elegível'};
    if (fmt.includes('motion') && !assigned.includes(reristonId)) return {d, reason:'Motion fora da edição'};
    return null;
  }).filter(Boolean).sort((a,b) => priorityData(a.d).score - priorityData(b.d).score);
}
function managerIssueRow(issue) {
  const {d,reason} = issue;
  return `<div class="manager-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}</button><span style="color:#ff6b81;font-size:9px;font-weight:800;white-space:nowrap;">⚑ ${safeText(reason)}</span></div>`;
}
let managerCommandExpanded = { critical:false, external:false, internal:false };
function commandEntry(d, next, opts={}) {
  const risk = d.operational_risk || getOperationalRisk(d);
  return {
    d,
    next,
    copyable: Boolean(opts.copyable),
    detail: opts.detail || risk.sla_label || (getReferenceDate(d) ? `Prazo ${d.prazo || d.veiculacao}` : 'Sem prazo informado'),
    score: Number(risk.score ?? 99)
  };
}
function commandResponsibleHtml(d) {
  const ids = assignedIds(d);
  const users = ids.map(id => TEAM_USERS.find(u => u.id === String(id))).filter(Boolean);
  if (!users.length) {
    const text = String(d.responsavel || '').trim();
    return text ? `<span class="command-owner" title="Responsável: ${safeText(text)}"><span class="command-owner-label">Com</span><span class="command-owner-name">${safeText(text)}</span></span>` : '<span class="command-unassigned">⚑ Sem responsável</span>';
  }
  const names = users.map(u => u.name).join(', ');
  const avatars = users.slice(0,3).map(user => user.photo
    ? `<img class="command-avatar" src="${user.photo}" alt="${safeText(user.name)}" title="${safeText(user.name)}" onerror="this.outerHTML='<span class=command-avatar-fallback style=background:${user.color}>${user.name.slice(0,2).toUpperCase()}</span>'">`
    : `<span class="command-avatar-fallback" style="background:${user.color}" title="${safeText(user.name)}">${user.name.slice(0,2).toUpperCase()}</span>`
  ).join('');
  const suffix = users.length > 3 ? `<span class="command-avatar-fallback" style="background:#4b5563" title="${safeText(names)}">+${users.length-3}</span>` : '';
  return `<span class="command-owner" title="Responsável(is): ${safeText(names)}"><span class="command-owner-label">Com</span><span class="command-avatar-stack">${avatars}${suffix}</span><span class="command-owner-name">${safeText(users.map(u => firstName(u.name)).join(', '))}</span></span>`;
}
function commandEntryHtml(entry) {
  const { d, next, copyable, detail } = entry;
  const context = d.status_context?.reason ? `<small class="command-context">↳ ${safeText(d.status_context.reason)}</small>` : '';
  return `<div class="command-row"><span class="command-client" title="${safeText(d.cliente)}">${safeText(d.cliente)}</span><div class="command-item"><button type="button" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da atividade">${safeText(d.nome)}</button><div class="command-detail"><span>${safeText(detail)}</span>${commandResponsibleHtml(d)}</div></div><div class="command-next">${safeText(next)}${context}${riskActionHtml(d,true)}</div><div class="command-tools">${riskBadgeHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}${copyable ? `<button type="button" class="command-copy" onclick="copyPendingFollowUp('${d.id}')">COPIAR</button>` : ''}<button type="button" class="command-open" onclick="openItemWorkspace('${d.id}')">ABRIR</button></div></div>`;
}
function commandGroupHtml(key, title, note, color, entries, empty, extraClass='') {
  const shown = managerCommandExpanded[key] ? entries : entries.slice(0,4);
  const rows = shown.length ? shown.map(commandEntryHtml).join('') : `<div class="manager-empty">${empty}</div>`;
  const more = entries.length > 4 ? `<button type="button" class="command-more" onclick="toggleManagerCommandGroup('${key}')">${managerCommandExpanded[key] ? 'MOSTRAR MENOS' : `VER MAIS (${entries.length - 4})`}</button>` : '';
  return `<section class="command-group ${extraClass}" style="--command-color:${color}"><div class="command-group-head"><span class="command-group-title">${title} · ${entries.length}</span><span class="command-group-note">${note}</span></div>${rows}${more}</section>`;
}
function commandTeamRailHtml() {
  const users = TEAM_USERS.filter(u => FOCUS_ACTIVE_IDS.has(u.id) && (!selectedPersonIds.size || selectedPersonIds.has(String(u.id))));
  const chips = users.map(user => ({ user, signal:operatorOperationalSignal(user.id) })).sort((a,b) => b.signal.critical - a.signal.critical || b.signal.waiting - a.signal.waiting || b.signal.total - a.signal.total).map(({user,signal}) => {
    const avatar = user.photo ? `<img src="${user.photo}" alt="${safeText(user.name)}">` : `<span class="command-team-fallback" style="background:${user.color}">${safeText(firstName(user.name).slice(0,2).toUpperCase())}</span>`;
    const klass = signal.kind === 'critical' ? 'critical' : signal.kind === 'waiting' ? 'waiting' : '';
    return `<div class="command-team-chip ${klass}" title="${safeText(user.name)} · ${safeText(signal.detail)}">${avatar}<div><span class="command-team-name">${safeText(firstName(user.name))}</span><span class="command-team-state"><i class="command-team-dot" style="color:${signal.color};background:${signal.color}"></i> ${safeText(signal.detail)}</span></div></div>`;
  }).join('');
  return `<section class="command-team-rail"><div class="command-team-head"><span>CAPACIDADE DA EQUIPE</span><span>priorizada por alerta operacional</span></div><div class="command-team-list">${chips}</div></section>`;
}
function toggleManagerCommandGroup(key) {
  managerCommandExpanded[key] = !managerCommandExpanded[key];
  renderManagerIntelligence();
}
function getBlockerCommandEntries(items=DADOS) {
  const blockerStatuses=new Set(['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post']);
  return items.filter(d=>!isFinishedItem(d) && blockerStatuses.has(d.status)).map(d=>{
    const owner=riskActionOwner(d);
    return commandEntry(d,`${owner.owner}: ${owner.action}`,{detail:`${d.status} · ${owner.source}`});
  }).sort((a,b)=>a.score-b.score || getReferenceDate(a.d).localeCompare(getReferenceDate(b.d)));
}
function getInternalCommandEntries(claimed, items=DADOS) {
  const entries = [];
  const push = (d, next, detail) => {
    if (!d || claimed.has(String(d.id))) return;
    claimed.add(String(d.id)); entries.push(commandEntry(d,next,{detail}));
  };
  getIntegrityIssues(items).forEach(issue => push(issue.d, `Corrigir cadastro: ${issue.reason}`, issue.reason));
  items.filter(d => !isFinishedItem(d) && d.status === 'Ag. Interno')
    .forEach(d => push(d, 'Definir quem valida internamente e liberar a próxima etapa'));
  items.filter(d => !isFinishedItem(d) && d.grupo === 'Produção (Foto e Vídeo)' && !['Para agendar','Agendado'].includes(d.status))
    .forEach(d => push(d, 'Confirmar captação, material ou responsável pela produção'));
  return entries.sort((a,b) => a.score - b.score || getReferenceDate(a.d).localeCompare(getReferenceDate(b.d)));
}
function jarvisProactiveHtml(items=DADOS) {
  const critical = items.filter(d => !isFinishedItem(d) && ['critical','high'].includes((d.operational_risk || getOperationalRisk(d)).level));
  const external = items.filter(d => !isFinishedItem(d) && externalPendingInfo(d)?.external);
  const unassigned = items.filter(d => !isFinishedItem(d) && !assignedIds(d).length);
  const lateSla = critical.filter(d => (d.operational_risk || getOperationalRisk(d)).hours_in_status >= 24 || (d.operational_risk || getOperationalRisk(d)).reason?.toLowerCase().includes('vencido'));
  const alerts = [
    {key:'risk',count:critical.length,label:'risco de prazo',detail:critical[0] ? `${critical[0].cliente} · ${critical[0].nome}` : 'Nenhum risco crítico agora',color:'#ff6b81',item:critical[0]},
    {key:'external',count:external.length,label:'dependências externas',detail:external[0] ? `${external[0].cliente} · ${externalPendingInfo(external[0])?.label || external[0].status}` : 'Nenhuma cobrança pendente',color:'#579bfc',item:external[0]},
    {key:'sla',count:lateSla.length,label:'SLA em atenção',detail:lateSla[0] ? `${lateSla[0].operational_risk?.sla_label || 'Prazo vencido'} · ${lateSla[0].nome}` : 'Nenhum SLA estourado',color:'#ffbd2e',item:lateSla[0]},
    {key:'owner',count:unassigned.length,label:'sem responsável',detail:unassigned[0] ? `${unassigned[0].cliente} · ${unassigned[0].nome}` : 'Todas as atividades têm atribuição',color:'#c084fc',item:unassigned[0]}
  ];
  const active = alerts.filter(a => a.count > 0);
  const cards = active.length ? active.map(a => `<button type="button" class="jarvis-proactive-alert ${managerCommandInsight===a.key?'active':''}" style="--jarvis-alert:${a.color}" onclick="openManagerCommandInsight('${a.key}')" title="Ver as demandas deste sinal na Central de Decisão"><b>${a.count}</b><span>${safeText(a.label)}</span><small>${safeText(a.detail)}</small></button>`).join('') : '<div class="jarvis-proactive-empty">✓ Jarvis não identificou bloqueios que precisem de decisão agora.</div>';
  return `<section class="jarvis-proactive"><div class="jarvis-proactive-head"><strong>JARVIS · LEITURA PROATIVA</strong><span>Atualiza a cada sincronização do Monday</span></div>${cards}</section>`;
}
let managerCommandDrawerOpen=false;
let managerCommandTab='critical';
let managerCommandInsight=null;
function managerCommandContextLabel(){ const selected=[...selectedPersonIds].map(id=>TEAM_USERS.find(user=>String(user.id)===String(id))).filter(Boolean).map(user=>firstName(user.name)); return selected.length?selected.join(' + '):'Toda a operação'; }
function updateManagerCommandToggle(total){ const button=document.getElementById('manager-command-toggle'); const count=document.getElementById('manager-command-count'); if(!button||!count)return; const available=panelMode==='gestor'; button.classList.toggle('visible',available); button.classList.toggle('active',managerCommandDrawerOpen&&available); button.setAttribute('aria-expanded',String(managerCommandDrawerOpen&&available)); count.textContent=total; button.title=`Mesa de Comando · ${managerCommandContextLabel()} · ${total} alerta${total===1?'':'s'}`; }
function toggleManagerCommandDrawer(){ managerCommandDrawerOpen=!managerCommandDrawerOpen; if(!managerCommandDrawerOpen) managerCommandInsight=null; renderManagerIntelligence(); }
function closeManagerCommandDrawer(){ if(!managerCommandDrawerOpen)return; managerCommandDrawerOpen=false; managerCommandInsight=null; renderManagerIntelligence(); }
function setManagerCommandTab(tab){ managerCommandTab=tab; managerCommandInsight=null; renderManagerIntelligence(); }
function openManagerCommandInsight(key){ managerCommandDrawerOpen=true; managerCommandInsight=key; managerCommandTab=key==='external'?'external':key==='owner'?'internal':'critical'; renderManagerIntelligence(); }
function renderManagerIntelligence() {
  const wrap = document.getElementById('manager-intelligence');
  if (!wrap) return;
  if (panelMode !== 'gestor') { wrap.innerHTML=''; wrap.classList.add('focus-hidden'); updateManagerCommandToggle(0); return; }
  wrap.classList.remove('focus-hidden');
  const claimed = new Set();
  const scopedItems = selectedPersonIds.size ? DADOS.filter(itemMatchesSelectedPeople) : DADOS;
  const allExternal = scopedItems.filter(d => !isFinishedItem(d) && externalPendingInfo(d)?.external);
  const criticalRaw = scopedItems.filter(d => !isFinishedItem(d) && ['critical','high'].includes(d.operational_risk?.level))
    .sort((a,b) => Number(a.operational_risk?.score ?? 99) - Number(b.operational_risk?.score ?? 99) || getReferenceDate(a).localeCompare(getReferenceDate(b)));
  const critical = criticalRaw.map(d => {
    claimed.add(String(d.id));
    const risk = d.operational_risk || getOperationalRisk(d);
    const externalInfo = externalPendingInfo(d);
    const next = externalInfo?.external ? `${externalInfo.next} — ${risk.reason}` : (risk.reason || 'Definir o próximo responsável e destravar o item');
    return commandEntry(d, next, { copyable:Boolean(externalInfo?.external) });
  });
  const externalRaw = allExternal.filter(d => !claimed.has(String(d.id)));
  const external = externalRaw.map(d => {
    claimed.add(String(d.id));
    return commandEntry(d, externalPendingInfo(d).next, { copyable:true });
  });
  const internal = getInternalCommandEntries(claimed, scopedItems);
  const blockers = getBlockerCommandEntries(scopedItems);
  const lateSla = critical.filter(entry => { const risk=entry.d.operational_risk || getOperationalRisk(entry.d); return Number(risk.hours_in_status || 0)>=24 || String(risk.reason || '').toLowerCase().includes('vencido'); });
  const unassigned = scopedItems.filter(d=>!isFinishedItem(d) && !assignedIds(d).length).map(d=>commandEntry(d,'Corrigir cadastro: Sem responsável',{detail:'Sem responsável'}));
  const summary = `<div class="command-summary"><div class="command-summary-item critical"><b>${critical.length}</b><span>críticos</span></div><div class="command-summary-item external"><b>${allExternal.length}</b><span>cliente</span></div><div class="command-summary-item internal"><b>${internal.length}</b><span>internos</span></div></div>`;
  const priority = critical[0] || external[0] || internal[0] || null;
  const priorityCard = priority ? `<aside class="command-decision"><span class="command-decision-label">DECISÃO PRIORITÁRIA AGORA</span><span class="command-decision-main">${safeText(priority.d.cliente)} · ${safeText(priority.d.nome)}</span><span class="command-decision-meta">${safeText(priority.next)}</span><button type="button" class="command-decision-button" onclick="openItemWorkspace('${priority.d.id}')">ABRIR PRIORIDADE →</button></aside>` : `<aside class="command-decision" style="border-left-color:#00c875"><span class="command-decision-label" style="color:#65d7a0">OPERAÇÃO ESTÁVEL</span><span class="command-decision-main">Nenhum bloqueio prioritário identificado.</span></aside>`;
  const totalAlerts=critical.length+allExternal.length+internal.length;
  const tabs=[{id:'critical',label:'RESOLVER HOJE',count:critical.length,color:'#ff6b81'},{id:'blockers',label:'BLOQUEIOS',count:blockers.length,color:'#9d50dd'},{id:'external',label:'DEPENDE DE CLIENTE',count:allExternal.length,color:'#579bfc'},{id:'internal',label:'AJUSTE INTERNO',count:internal.length,color:'#ffbd2e'},{id:'capacity',label:'CAPACIDADE',count:0,color:'#ff9d00'}];
  const activeTab=tabs.some(tab=>tab.id===managerCommandTab)?managerCommandTab:'critical'; managerCommandTab=activeTab;
  const activeContent=managerCommandInsight==='risk'?commandGroupHtml('critical','Risco de prazo','itens críticos por prazo vencido, prazo de hoje ou risco operacional','#ff6b81',critical,'✓ Nenhum risco de prazo no contexto atual','command-critical'):managerCommandInsight==='external'?commandGroupHtml('external','Dependências externas','itens que precisam de aprovação, informação, retorno ou alteração do cliente','#579bfc',external,'✓ Nenhuma dependência externa no contexto atual','command-external'):managerCommandInsight==='sla'?commandGroupHtml('critical','SLA em atenção','itens há 24 horas ou mais sem movimento, ou com prazo vencido','#ffbd2e',lateSla,'✓ Nenhum SLA em atenção no contexto atual','command-critical'):managerCommandInsight==='owner'?commandGroupHtml('internal','Sem responsável','itens que precisam de atribuição antes de seguir','#c084fc',unassigned,'✓ Nenhuma demanda sem responsável no contexto atual','command-internal'):activeTab==='blockers'?commandGroupHtml('blockers','Central de bloqueios','quem precisa destravar, por qual motivo e qual é o próximo movimento','#9d50dd',blockers,'✓ Nenhum bloqueio ativo no contexto atual','command-external'):activeTab==='critical'?commandGroupHtml('critical','Resolver hoje','prazo vencido, prazo de hoje ou SLA estourado','#ff6b81',critical,'✓ Nenhum item crítico agora','command-critical'):activeTab==='external'?commandGroupHtml('external','Depende de cliente','aprovação, informação, retorno ou alteração','#579bfc',external,'✓ Nenhuma cobrança externa adicional','command-external'):activeTab==='internal'?commandGroupHtml('internal','Ajuste interno','cadastro, captação, responsabilidade ou validação','#ffbd2e',internal,'✓ Nenhum ajuste interno prioritário','command-internal'):`<div class="manager-command-capacity-note">A capacidade é apresentada por alerta operacional. Clique nos chips na barra superior para filtrar a agenda da semana por pessoa.</div>${commandTeamRailHtml()}`;
  updateManagerCommandToggle(totalAlerts);
  wrap.innerHTML = `<div class="manager-command-backdrop ${managerCommandDrawerOpen?'open':''}" onclick="closeManagerCommandDrawer()"></div><section class="manager-command-drawer ${managerCommandDrawerOpen?'open':''}" role="dialog" aria-modal="true" aria-label="Mesa de Comando" onclick="event.stopPropagation()"><header class="manager-command-drawer-head"><div><div class="manager-command-drawer-kicker">VYBE OS · CENTRAL DE DECISÃO</div><div class="manager-command-drawer-title">Mesa de Comando</div><div class="manager-command-drawer-context">${safeText(managerCommandContextLabel())} · decisões e riscos do contexto atual</div></div><button type="button" class="manager-command-close" onclick="closeManagerCommandDrawer()" aria-label="Fechar Mesa de Comando">×</button></header><div class="manager-command-summary">${summary}${priorityCard}</div><nav class="manager-command-tabs" aria-label="Seções da Mesa de Comando">${tabs.map(tab=>`<button type="button" class="manager-command-tab ${activeTab===tab.id?'active':''}" style="--tab-color:${tab.color}" onclick="setManagerCommandTab('${tab.id}')">${tab.label}${tab.count?` · ${tab.count}`:''}</button>`).join('')}</nav><div class="manager-command-content">${jarvisProactiveHtml(scopedItems)}${activeContent}</div></section>`;
  renderManagerCalendar();
}

// ─── GESTOR · Agenda Mensal unificada por cliente, origem e data ─────────────
// A agenda ocupa a tela inteira e nem todo dia se planeja o mês. Ela nasce
// fechada e abre pelo botão CALENDÁRIO, ao lado dos outros da mesma barra. A
// escolha fica no navegador: quem trabalha com ela aberta não reabre todo dia.
const AGENDA_ABERTA = 'vybe_agenda_aberta';
let agendaMensalAberta = (() => {
  try { return localStorage.getItem(AGENDA_ABERTA) === '1'; } catch { return false; }
})();
function toggleAgendaMensal() {
  agendaMensalAberta = !agendaMensalAberta;
  try { localStorage.setItem(AGENDA_ABERTA, agendaMensalAberta ? '1' : '0'); } catch { /* sem storage */ }
  renderManagerCalendar();
  if (agendaMensalAberta) {
    const wrap = document.getElementById('manager-calendar');
    setTimeout(() => wrap?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

let managerCalendarClientFilter = 'all';
let managerCalendarSourceFilter = 'all';
let managerCalendarDragPayload = null;
let managerCalendarDemandasLoading = false;

function managerCalendarDateIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function managerCalendarMonthMeta() {
  const base = new Date();
  base.setHours(12,0,0,0);
  base.setMonth(base.getMonth() + Number(MONTH_OFFSET || 0), 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1, 12);
  const last = new Date(year, month + 1, 0, 12);
  const firstDay = first.getDay();
  const shift = firstDay === 0 ? -6 : 1 - firstDay;
  const start = new Date(year, month, 1 + shift, 12);
  const cells = Array.from({length:42}, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, iso: managerCalendarDateIso(date), inMonth: date.getMonth() === month };
  });
  return {year, month, first, last, cells};
}
function managerCalendarLabel(meta) {
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(meta.first);
}
function managerCalendarStatusColor(item, fallback='#ff8b38') {
  return String(item?.status_color || fallback).match(/^#[0-9a-f]{3,8}$/i)?.[0] || fallback;
}
// 'ignorarCliente' existe para a régua de clientes: ela precisa enxergar o mês
// inteiro, senão some todo mundo assim que alguém é escolhido — e a única saída
// vira voltar em 'Todos' para depois escolher outro.
function managerCalendarItems({ ignorarCliente = false } = {}) {
  const production = (DADOS_ALL?.length ? DADOS_ALL : DADOS || []).filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item)).map(item => ({
    ...item, cliente:clientMasterResolveName(item.cliente), calendarSource:'content', calendarDateIso: dateMode === 'prazo' ? (item.prazo_iso || '') : (item.veiculacao_iso || ''), calendarType: item.formato || 'Conteúdo'
  }));
  const requests = (DADOS_DEMANDAS || []).filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item)).map(item => ({
    ...item, cliente:clientMasterResolveName(item.cliente), calendarSource:'request', calendarDateIso: dateMode === 'prazo' ? (item.prazo_iso || '') : (item.conclusao_iso || ''), calendarType: item.tipo || 'Solicitação'
  }));
  return [...production, ...requests].filter(item => {
    if (managerCalendarSourceFilter !== 'all' && item.calendarSource !== managerCalendarSourceFilter) return false;
    if (!ignorarCliente && managerCalendarClientFilter !== 'all' && item.cliente !== managerCalendarClientFilter) return false;
    return Boolean(item.calendarDateIso);
  });
}
function managerCalendarClientList(allItems, meta) {
  const monthItems = allItems.filter(item => meta.cells.some(cell => cell.iso === item.calendarDateIso));
  const counts = new Map();
  monthItems.forEach(item => counts.set(item.cliente || '—', (counts.get(item.cliente || '—') || 0) + 1));
  return [...counts.entries()].sort((a,b) => a[0].localeCompare(b[0],'pt-BR')).map(([client,count]) => ({client,count}));
}
function managerCalendarSetClient(client) {
  managerCalendarClientFilter = client || 'all';
  renderManagerCalendar();
}
function managerCalendarOpenClientMaster() {
  const client=managerCalendarClientFilter && managerCalendarClientFilter !== 'all' ? clientMasterResolveName(managerCalendarClientFilter) : '';
  const button=document.getElementById('btn-board-clientes');
  if(typeof switchBoard==='function') switchBoard('clientes',button);
  if(client) setTimeout(()=>{ if(typeof abrirClienteDetalhe==='function') abrirClienteDetalhe(client); },120);
}
function managerCalendarSetSource(source) {
  managerCalendarSourceFilter = source || 'all';
  renderManagerCalendar();
}
function managerCalendarGoMonth(delta) {
  MONTH_OFFSET += Number(delta || 0);
  updateMonthNav();
  renderManagerCalendar();
}
function managerCalendarGoToday() {
  MONTH_OFFSET = 0;
  updateMonthNav();
  renderManagerCalendar();
}
function managerCalendarSetDateMode(mode) {
  const button = document.getElementById(mode === 'prazo' ? 'btn-mode-prazo' : 'btn-mode-veiculacao');
  setDateMode(mode, button);
  renderManagerCalendar();
}
function managerCalendarOpen(source, itemId) {
  if (source === 'request') return openDemandaWorkspace(itemId);
  return openItemWorkspace(itemId);
}
function managerCalendarAdd(dateIso) {
  if (typeof openCadastrosGovernedLegacy !== 'function') return showToast('CADASTROS ainda não está disponível neste contexto.', 'info');
  openCadastrosGovernedLegacy();
  setTimeout(() => {
    const veic = document.getElementById('cad-veic');
    const prazo = document.getElementById('cad-prazo');
    if (veic) veic.value = dateIso;
    if (prazo) prazo.value = goldenDeadlineIso(dateIso);
    if (typeof updateCadastrosPreview === 'function') updateCadastrosPreview();
  }, 70);
}
function managerCalendarDragStart(source, itemId, event) {
  managerCalendarDragPayload = {source, itemId:String(itemId)};
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${source}:${itemId}`);
  }
}
function managerCalendarDragEnd() { managerCalendarDragPayload = null; document.querySelectorAll('.manager-calendar-day').forEach(node => node.classList.remove('is-drop-target')); }
function managerCalendarDragOver(event, cell) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; cell.classList.add('is-drop-target'); }
function managerCalendarDragLeave(cell) { cell.classList.remove('is-drop-target'); }
// Arrastar JÁ é a decisão: quem soltou a peça no dia escolheu a data. Abrir o
// editor de datas depois disso fazia a pessoa repetir o que acabou de dizer.
// O editor continua no clique, para quem precisa mexer nas duas datas ou
// registrar exceção ao Prazo de Ouro.
async function managerCalendarDrop(dateIso, event, cell) {
  event.preventDefault();
  cell.classList.remove('is-drop-target');
  const payload = managerCalendarDragPayload || String(event.dataTransfer?.getData('text/plain') || '').split(':');
  managerCalendarDragPayload = null;
  const source = payload?.source || payload?.[0];
  const itemId = payload?.itemId || payload?.[1];
  if (!source || !itemId) return;

  const request = source === 'request';
  const item = request
    ? (DADOS_DEMANDAS || []).find(row => String(row.id) === String(itemId))
    : findOperationalItem(itemId);
  if (!item) return showToast('Atividade não encontrada.', 'err');

  const campo = dateMode === 'prazo' ? 'prazo' : 'veiculacao';
  cell.classList.add('is-saving');
  try {
    await moverDataDoItem(item, campo, dateIso, { request });
  } catch (erro) {
    showToast(`Não foi possível mover a data: ${erro.message}`, 'err', 7000);
  } finally {
    cell.classList.remove('is-saving');
  }
}

// Um caminho só para mudar data, venha do arrasto na agenda ou do campo na
// tabela por grupo. Duas implementações da mesma gravação viram duas verdades.
// Devolve false quando a data já era aquela — não é erro, é nada a fazer.
async function moverDataDoItem(item, campo, dateIso, { request = false } = {}) {
  const anterior = campo === 'prazo'
    ? String(item.prazo_iso || '')
    : String((request ? item.conclusao_iso : item.veiculacao_iso) || '');
  if (anterior === dateIso) return false;

  armOutboundMutationGuard(campo === 'prazo' ? 'prazo' : 'veiculação');
  const pelaEscritaDupla = await tentarEscritaDupla(item, { acao: campo, item: String(item.id), data: dateIso });
  if (!pelaEscritaDupla) {
    const colunas = request ? COLUNAS.demandas : COLUNAS.producao;
    const mutation = `mutation($board:ID!,$item:ID!,$column:String!,$value:JSON!){ change_column_value(board_id:$board,item_id:$item,column_id:$column,value:$value){ id } }`;
    await mondayQuery(mutation, {
      board: String(item.board_id || (request ? BOARD_DEMANDAS_ID : BOARD_ID)),
      item: String(item.id), column: colunas[campo], value: JSON.stringify({ date: dateIso }),
    });
    // Sem escrita dupla não existe histórico nosso; o registro vai para o Monday.
    try {
      await postItemUpdate(item.id, `[Vybe OS · Data alterada]\n${campo === 'prazo' ? 'Prazo' : 'Veiculação'}: ${planningDateBr(anterior) || '—'} → ${planningDateBr(dateIso)}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`);
    } catch (falhaLog) { console.warn('Data alterada, mas o log não foi registrado.', falhaLog); }
  }

  const curto = (iso) => planningDateBr(iso).slice(0, 5);
  if (request) {
    if (campo === 'prazo') { item.prazo_iso = dateIso; item.prazo = curto(dateIso); }
    else { item.conclusao_iso = dateIso; item.conclusao = curto(dateIso);
           item.veiculacao_iso = dateIso; item.veiculacao = curto(dateIso); }
    outboundMutationGuardUntil = 0;
    renderIntegratedOperationalViews();
  } else {
    applyOutboundItemPatch(item.id,
      campo === 'prazo' ? { prazo_iso: dateIso } : { veiculacao_iso: dateIso }, 'planejamento');
  }
  renderManagerCalendar();
  renderVisaoDeGrupos();

  // O Prazo de Ouro deixa de barrar e passa a avisar: quem move a data está
  // replanejando, e travar no meio só devolveria o formulário.
  const prazo = campo === 'prazo' ? dateIso : String(item.prazo_iso || '');
  const veic = campo === 'veiculacao' ? dateIso : String((request ? item.conclusao_iso : item.veiculacao_iso) || '');
  const folga = (prazo && veic) ? goldenDeadlineGap(prazo, veic) : null;
  const alerta = (folga !== null && folga < PRAZO_OURO_DIAS)
    ? ` · atenção: ${folga} dia${folga === 1 ? '' : 's'} de antecedência, abaixo do Prazo de Ouro`
    : '';
  showToast(`✓ ${campo === 'prazo' ? 'Prazo' : 'Veiculação'} de ${safeText(item.nome || 'a peça')}: ${planningDateBr(anterior) || '—'} → ${planningDateBr(dateIso)}${alerta}`,
    alerta ? 'info' : 'ok', alerta ? 7000 : 4200);
  return true;
}

function managerCalendarLoadDemandas(button) {
  if (managerCalendarDemandasLoading) return;
  managerCalendarDemandasLoading = true;
  if (button) { button.disabled = true; button.textContent = 'CARREGANDO…'; }
  refreshDemandas().finally(() => { managerCalendarDemandasLoading = false; renderManagerCalendar(); });
}
function managerCalendarEventHtml(item) {
  const sourceLabel = item.calendarSource === 'request' ? 'SOLICITAÇÃO' : 'CONTEÚDO';
  const sourceClass = item.calendarSource === 'request' ? 'request' : '';
  const color = managerCalendarStatusColor(item, item.calendarSource === 'request' ? '#c084fc' : '#ff8b38');
  const status = item.status || 'Sem status';
  const owner = item.responsavel ? firstName(item.responsavel) : 'Sem responsável';
  return `<button type="button" draggable="true" class="manager-calendar-event" style="--event-color:${color}" title="${safeText(`${item.nome} · ${item.cliente} · ${status} · arraste para mover a data`)}" onclick="managerCalendarOpen('${item.calendarSource}','${item.id}')" ondragstart="managerCalendarDragStart('${item.calendarSource}','${item.id}',event)" ondragend="managerCalendarDragEnd()"><span class="manager-calendar-event-bar"></span><span class="manager-calendar-event-copy"><b>${safeText(item.nome || 'Sem título')}</b><small>${safeText(item.cliente || '—')} · ${safeText(owner)} · <span class="manager-calendar-event-status">${safeText(status)}</span></small></span><span class="manager-calendar-event-meta"><i class="${sourceClass}"></i><em class="manager-calendar-event-age">${sourceLabel}</em></span></button>`;
}
function openDemandaPlanningEditor(itemId, targetDate='') {
  const item = (DADOS_DEMANDAS || []).find(entry => String(entry.id) === String(itemId));
  if (!item) return showToast('Solicitação não encontrada.', 'err');
  const initial = targetDate || (dateMode === 'prazo' ? item.prazo_iso : item.conclusao_iso) || '';
  const fieldLabel = dateMode === 'prazo' ? 'PRAZO DA SOLICITAÇÃO' : 'CONCLUSÃO PREVISTA';
  openWorkflowModal(`<div class="workflow-kicker"><span>VYBE OS · SOLICITAÇÃO DE DEMANDA</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Mover solicitação</h2><p class="workflow-copy">Ajuste a data diretamente na agenda. A solicitação continua identificada como origem própria e não vira conteúdo automaticamente.</p>${workflowItemHtml(item,item.status)}<label class="workflow-field"><span>${fieldLabel}</span><input id="demanda-calendar-date" type="date" value="${safeText(initial)}"></label><div class="planning-change-note"><b>Rastreabilidade:</b> o painel atualiza a coluna correspondente do board Solicitações de Demandas e preserva a origem do item.</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">CANCELAR</button><button type="button" class="workflow-primary" onclick="saveDemandaCalendarDate('${item.id}','${dateMode}')">SALVAR DATA →</button></div>`);
}
async function saveDemandaCalendarDate(itemId, mode) {
  const item = (DADOS_DEMANDAS || []).find(entry => String(entry.id) === String(itemId));
  const date = String(document.getElementById('demanda-calendar-date')?.value || '');
  if (!item || !date) return showToast('Informe uma data válida.', 'info');
  const columnId = mode === 'prazo' ? COLUNAS.demandas.prazo : COLUNAS.demandas.veiculacao;
  const previous = mode === 'prazo' ? item.prazo_iso : item.conclusao_iso;
  if (date === previous) return closeWorkflowModal();
  const button = document.querySelector('.workflow-primary');
  if (button) { button.disabled = true; button.textContent = 'SALVANDO…'; }
  armOutboundMutationGuard('data da solicitação');
  try {
    const mutation = `mutation($board:ID!,$item:ID!,$column:String!,$value:JSON!){ change_column_value(board_id:$board,item_id:$item,column_id:$column,value:$value){ id } }`;
    await mondayQuery(mutation,{board:String(BOARD_DEMANDAS_ID),item:String(item.id),column:columnId,value:JSON.stringify({date})});
    if (mode === 'prazo') { item.prazo_iso = date; item.prazo = `${date.slice(8,10)}/${date.slice(5,7)}`; item.prazo_atrasado = Boolean(date < (META.today_iso || HOJE_ISO) && !['Feito','Aprovado','Concluído','Concluido','Finalizado'].includes(item.status)); }
    else { item.conclusao_iso = date; item.conclusao = `${date.slice(8,10)}/${date.slice(5,7)}`; }
    closeWorkflowModal();
    renderManagerCalendar();
    if (activeBoard === 'demandas') renderDemandas();
    showToast('✓ Data da solicitação atualizada no board de Demandas.', 'ok');
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'SALVAR DATA →'; }
    showToast(`Não foi possível atualizar a solicitação: ${error.message}`, 'err', 7000);
  }
}
function renderManagerCalendar() {
  const wrap = document.getElementById('manager-calendar');
  const botao = document.getElementById('ops-agenda-btn');
  if (!wrap) return;
  if (panelMode !== 'gestor') {
    wrap.innerHTML = ''; wrap.classList.add('focus-hidden');
    if (botao) botao.classList.add('focus-hidden');
    return;
  }
  if (botao) {
    botao.classList.remove('focus-hidden');
    botao.classList.toggle('active', agendaMensalAberta);
    botao.setAttribute('aria-expanded', String(agendaMensalAberta));
    const noMes = managerCalendarMonthMeta();
    const total = managerCalendarItems({ ignorarCliente: true })
      .filter(item => noMes.cells.some(cell => cell.iso === item.calendarDateIso)).length;
    const contador = document.getElementById('ops-agenda-count');
    if (contador) contador.textContent = total;
  }
  if (!agendaMensalAberta) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); return; }
  wrap.classList.remove('focus-hidden');
  const meta = managerCalendarMonthMeta();
  const semRecorte = managerCalendarItems({ ignorarCliente: true });
  const allItems = managerCalendarClientFilter === 'all'
    ? semRecorte
    : semRecorte.filter(item => item.cliente === managerCalendarClientFilter);
  const monthItems = allItems.filter(item => meta.cells.some(cell => cell.iso === item.calendarDateIso));
  const clients = managerCalendarClientList(semRecorte, meta);
  const grouped = new Map();
  monthItems.forEach(item => { if (!grouped.has(item.calendarDateIso)) grouped.set(item.calendarDateIso, []); grouped.get(item.calendarDateIso).push(item); });
  const sourceCount = {content: monthItems.filter(item => item.calendarSource === 'content').length, request: monthItems.filter(item => item.calendarSource === 'request').length};
  const cells = meta.cells.map(cell => {
    const dayItems = (grouped.get(cell.iso) || []).sort((a,b) => String(a.nome).localeCompare(String(b.nome),'pt-BR')).slice(0,5);
    const total = (grouped.get(cell.iso) || []).length;
    const isToday = cell.iso === (HOJE_ISO || META.today_iso);
    const events = dayItems.map(managerCalendarEventHtml).join('');
    const more = total > 5 ? `<button type="button" class="manager-calendar-more" onclick="managerCalendarSetClient('${safeText(managerCalendarClientFilter)}')">+ ${total-5} itens neste dia</button>` : '';
    return `<div class="manager-calendar-day ${cell.inMonth?'':'is-other'} ${isToday?'is-today':''}" data-date="${cell.iso}" ondragover="managerCalendarDragOver(event,this)" ondragleave="managerCalendarDragLeave(this)" ondrop="managerCalendarDrop('${cell.iso}',event,this)"><div class="manager-calendar-day-head"><span><b>${cell.date.getDate()}</b><small>${new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(cell.date).replace('.','')}</small></span><button type="button" class="manager-calendar-add" onclick="managerCalendarAdd('${cell.iso}')" title="Adicionar pelo CADASTROS neste dia">+</button></div><div class="manager-calendar-events">${events || '<span class="manager-calendar-empty">—</span>'}${more}</div></div>`;
  }).join('');
  const clientButtons = [`<button type="button" class="manager-calendar-client ${managerCalendarClientFilter==='all'?'active':''}" onclick="managerCalendarSetClient('all')"><b>Todos</b> ${semRecorte.filter(item => meta.cells.some(cell => cell.iso === item.calendarDateIso)).length}</button>`, ...clients.map(({client,count}) => `<button type="button" class="manager-calendar-client ${managerCalendarClientFilter===client?'active':''}" onclick="managerCalendarSetClient(decodeURIComponent('${encodeURIComponent(client)}'))"><b>${safeText(client)}</b> ${count}</button>`)].join('');
  const demandNote = DADOS_DEMANDAS.length ? `<div class="manager-calendar-demand-note"><span><b>${sourceCount.request}</b> solicitações aparecem na agenda. Elas permanecem separadas do conteúdo e podem ser abertas pelo próprio calendário.</span><button type="button" onclick="switchBoard('demandas',document.getElementById('btn-board-demandas'))">ABRIR ESTEIRA DE SOLICITAÇÕES →</button></div>` : `<div class="manager-calendar-demand-note"><span><b>Solicitações ainda não carregadas nesta sessão.</b> A agenda já está preparada para cruzar o board de Solicitação de Demandas sem misturar sua origem com conteúdo.</span><button type="button" onclick="managerCalendarLoadDemandas(this)">CARREGAR SOLICITAÇÕES</button></div>`;
  wrap.innerHTML = `<div class="manager-calendar-head"><div><div class="manager-calendar-kicker">GESTOR · PLANEJAMENTO VISUAL</div><div class="manager-calendar-title">Agenda mensal por cliente</div><div class="manager-calendar-sub">Troque de cliente, veja veiculações e prazos no mês, abra a atividade no Workspace e arraste um item para preparar uma nova data.</div></div><div class="manager-calendar-actions"><button type="button" class="${dateMode==='veiculacao'?'active':''}" onclick="managerCalendarSetDateMode('veiculacao')">VEICULAÇÃO</button><button type="button" class="${dateMode==='prazo'?'active':''}" onclick="managerCalendarSetDateMode('prazo')">PRAZO</button><button type="button" class="primary" onclick="managerCalendarAdd('${managerCalendarDateIso(new Date())}')">+ CADASTROS</button><button type="button" onclick="managerCalendarOpenClientMaster()">CLIENTE MASTER</button></div></div><div class="manager-calendar-toolbar"><div class="manager-calendar-month"><button type="button" onclick="managerCalendarGoMonth(-1)" aria-label="Mês anterior">‹</button><span class="manager-calendar-month-label">${safeText(managerCalendarLabel(meta))}</span><button type="button" onclick="managerCalendarGoMonth(1)" aria-label="Próximo mês">›</button><button type="button" onclick="managerCalendarGoToday()">HOJE</button></div><div class="manager-calendar-clients">${clientButtons}</div><div class="manager-calendar-status"><i class="${DADOS_DEMANDAS.length?'demands':''}"></i>${sourceCount.content} conteúdo · ${sourceCount.request} solicitações</div></div><div class="manager-calendar-legend"><span class="manager-calendar-legend-copy">Referência ativa: <b>${dateMode==='prazo'?'PRAZO DE PRODUÇÃO':'VEICULAÇÃO'}</b> · clique para abrir · arraste para mover</span><span class="manager-calendar-source-legend"><span><i></i> Conteúdo</span><span><i class="request"></i> Solicitação de Demanda</span></span></div>${demandNote}<div class="manager-calendar-grid"><div class="manager-calendar-weekday">SEG</div><div class="manager-calendar-weekday">TER</div><div class="manager-calendar-weekday">QUA</div><div class="manager-calendar-weekday">QUI</div><div class="manager-calendar-weekday">SEX</div><div class="manager-calendar-weekday">SÁB</div><div class="manager-calendar-weekday">DOM</div>${cells}</div><div class="manager-calendar-footer"><span><strong>${monthItems.length}</strong> itens no mês · <strong>${clients.length}</strong> clientes com atividade</span><button type="button" onclick="managerCalendarSetClient('all');managerCalendarSetSource('all')">LIMPAR VISÃO DO CALENDÁRIO</button></div>`;
}

function handleGlobalSearch(query) {
  const normalized = (query || '').trim().toLowerCase();
  const resultBox = document.getElementById('search-results');
  const clear = document.getElementById('global-search-clear');
  clear.classList.toggle('visible', normalized.length > 0);
  updateClearFiltersState();
  if (normalized.length < 2) { resultBox.classList.remove('open'); resultBox.innerHTML = ''; return; }
  const matches = DADOS.filter(d => [d.cliente,d.nome,d.formato,d.responsavel,d.status].some(value => String(value || '').toLowerCase().includes(normalized))).slice(0,5);
  const totalMatches = DADOS.filter(d => [d.cliente,d.nome,d.formato,d.responsavel,d.status].some(value => String(value || '').toLowerCase().includes(normalized))).length;
  if (!matches.length) {
    resultBox.innerHTML = '<div class="ops-empty">Nenhum conteúdo encontrado.</div>';
    resultBox.classList.add('open');
    return;
  }
  resultBox.innerHTML = `<div class="ops-panel-title"><span>Resultados da busca</span>${totalMatches > 5 ? `<span style="color:var(--text-muted);font-weight:400;text-transform:none;letter-spacing:0;">5 de ${totalMatches}</span>` : ''}</div><div class="ops-list">${matches.map(d => `<button class="ops-item" style="text-align:left;cursor:pointer;" onclick="openSearchItem('${safeText(d.id)}')">
    <span class="ops-item-client">${safeText(d.cliente)}</span><span class="ops-item-name">${safeText(d.nome)}</span>${pillHtml(d.status,d.status_color,d.status_border)}<span class="ops-item-date">S${d.semana} · ${safeText(getDateFmt(d))}</span>
  </button>`).join('')}</div>`;
  resultBox.classList.add('open');
}

function clearGlobalSearch() {
  const input = document.getElementById('global-search');
  input.value = '';
  handleGlobalSearch('');
  input.focus();
}

function openSearchItem(itemId) {
  const item = DADOS.find(d => String(d.id) === String(itemId));
  if (!item) return;
  viewMode = 'day';
  const viewBtn = document.getElementById('btn-view-day');
  if (viewBtn) { viewBtn.textContent = '👤 Ver por Cliente'; viewBtn.classList.add('active'); }
  currentFilter = 'all';
  currentDayFilter = getDateIso(item) || '';
  currentWeek = item.semana || 1;
  const select = document.getElementById('day-select');
  if (select) select.value = currentDayFilter;
  for (let s=1; s<=(META.weeks||[]).length; s++) renderWeek(s, currentFilter, currentDayFilter);
  document.querySelectorAll('.week-panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById(`panel-week${currentWeek}`);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('#week-tabs-container .tab-btn').forEach(b=>b.classList.remove('active'));
  const tab = document.getElementById(`tab-s${currentWeek}-label`);
  if (tab) tab.classList.add('active');
  renderOperationalTools();
  clearGlobalSearch();
  setTimeout(() => panel && panel.scrollIntoView({behavior:'smooth',block:'start'}), 60);
}

// ─── Legenda Toggle ─────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  const aberto = sidebar.classList.toggle('open');
  toggle.classList.toggle('open', aberto);
  overlay.classList.toggle('show', aberto);
  // troca apenas o ícone: trocar o textContent do botão apagava o rótulo "Filtros" para sempre
  const icone = toggle.querySelector('.sidebar-toggle-icon');
  if (icone) icone.textContent = aberto ? '✕' : '☰';
  toggle.setAttribute('aria-expanded', String(aberto));
  toggle.setAttribute('aria-label', aberto ? 'Fechar filtros' : 'Abrir filtros');
}

function toggleLegend() {
  const legend = document.getElementById('status-legend');
  const btn = document.getElementById('legend-toggle');
  if (legend.classList.contains('expanded')) {
    legend.classList.remove('expanded');
    legend.classList.add('collapsed');
    btn.textContent = '▶ Mostrar';
  } else {
    legend.classList.remove('collapsed');
    legend.classList.add('expanded');
    btn.textContent = '▼ Ocultar';
  }
}

// ─── Equipe ───────────────────────────────────────────────────────────────────
function renderTeam() {
  const all = DADOS;
  const porResp = {};
  all.forEach(d=>{
    const r = d.responsavel || "—";
    if(!porResp[r]) porResp[r]={total:0,agendado:0,pendente:0,aguardo:0};
    porResp[r].total++;
    if(["Agendado","Finalizado"].includes(d.status)) porResp[r].agendado++;
    else if(["A Fazer","Falta D.A","Pode Fazer"].includes(d.status)) porResp[r].pendente++;
    else if(d.status==="Aguardo") porResp[r].aguardo++;
  });
  const maxR = Math.max(...Object.values(porResp).map(v=>v.total), 1);
  document.getElementById("team-grid").innerHTML = Object.entries(porResp)
    .sort((a,b)=>b[1].total-a[1].total)
    .map(([r,s])=>`<div class="stat-card">
      <div class="stat-name">${r}</div>
      <div class="stat-row"><span>Total</span><strong>${s.total}</strong></div>
      <div class="stat-row"><span>Prontos/Agendados</span><strong style="color:#4ade80">${s.agendado}</strong></div>
      <div class="stat-row"><span>Em produção</span><strong style="color:#60a5fa">${s.pendente}</strong></div>
      <div class="stat-row"><span>Aguardando captação</span><strong style="color:#22d3ee">${s.aguardo}</strong></div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(s.total/maxR*100)}%"></div></div>
    </div>`).join("");

  const porFmt = {};
  all.forEach(d=>{ porFmt[d.formato]=(porFmt[d.formato]||0)+1; });
  const maxF = Math.max(...Object.values(porFmt), 1);
  document.getElementById("format-grid").innerHTML = Object.entries(porFmt)
    .sort((a,b)=>b[1]-a[1])
    .map(([f,c])=>`<div class="stat-card">
      <div class="stat-name">${fmtHtml(f)} ${f}</div>
      <div class="stat-row"><span>Quantidade</span><strong>${c}</strong></div>
      <div class="stat-row"><span>% do total</span><strong>${Math.round(c/all.length*100)}%</strong></div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(c/maxF*100)}%"></div></div>
    </div>`).join("");
}

// ─── Select de dias ───────────────────────────────────────────────────────────
function populateDaySelect() {
  const sel = document.getElementById('day-select');
  sel.innerHTML = '<option value="">Todos os dias</option>';
  // No modo PRAZO, listar apenas os dias que têm ao menos 1 item com prazo nesse dia
  if (dateMode === 'prazo') {
    const seen = new Set();
    const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    DADOS.filter(d=>d.prazo_iso && d.semana).forEach(d=>{
      if (!seen.has(d.prazo_iso)) {
        seen.add(d.prazo_iso);
        const dt = new Date(d.prazo_iso+'T12:00:00');
        const o = document.createElement('option');
        o.value = d.prazo_iso;
        o.textContent = `${labels[dt.getDay()]} ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        sel.appendChild(o);
      }
    });
    // Ordenar as options por data
    const opts = [...sel.options].slice(1).sort((a,b)=>a.value.localeCompare(b.value));
    opts.forEach(o => sel.appendChild(o));
  } else {
    const seen = new Set();
    // Listar dias de todas as 4 semanas
    const allDias = DIAS_SEMANAS.flat();
    allDias.sort((a,b)=>a.iso.localeCompare(b.iso)).forEach(d=>{
      if(!seen.has(d.iso)){
        seen.add(d.iso);
        const o = document.createElement('option');
        o.value = d.iso;
        o.textContent = `${d.label} ${d.num}/${d.iso.slice(5,7)}`;
        sel.appendChild(o);
      }
    });
  }
}

// ─── Filtro por pessoa ───────────────────────────────────────────────────────
const TEAM_USERS = [
  {id:PESSOAS.PAULO, name:'Paulo',       color:'#0073ea', photo:'https://files.monday.com/use1/photos/68035537/thumb_small/68035537-user_photo_2024_11_12_01_18_55.png?1731374335'},
  {id:PESSOAS.VINICIUS, name:'Vinícius',    color:'#037f4c', photo:'https://files.monday.com/use1/photos/68035653/thumb_small/68035653-user_photo_2024_11_24_05_50_54.png?1732427454'},
  {id:PESSOAS.EWERTON_L, name:'Ewerton L.',  color:'#e2445c', photo:'https://files.monday.com/use1/photos/68036687/thumb_small/68036687-user_photo_2025_03_17_14_41_06.png?1742222466'},
  {id:PESSOAS.RERISTON, name:'Reriston',    color:'#ff642e', photo:'https://files.monday.com/use1/photos/68036697/thumb_small/68036697-user_photo_initials_2024_11_12_03_28_40.png?1731382120'},
  {id:PESSOAS.DEIVID, name:'Deivid',      color:'#fdab3d', photo:'https://files.monday.com/use1/photos/68997024/thumb_small/68997024-user_photo_2026_01_28_14_44_09.png?1769611450'},
  {id:PESSOAS.BEATRIZ, name:'Beatriz',     color:'#df2f4a', photo:'https://files.monday.com/use1/photos/71130408/thumb_small/71130408-user_photo_2026_01_30_13_49_45.png?1769780986'},
  {id:PESSOAS.ADEMIR, name:'Ademir',      color:'#4eccc6', photo:'https://files.monday.com/use1/photos/78158742/thumb_small/78158742-user_photo_2025_07_09_01_44_21.png?1752025461'},
  {id:PESSOAS.TAINARA, name:'Tainara',     color:'#579bfc', photo:'https://files.monday.com/use1/photos/80146924/thumb_small/80146924-user_photo_2026_01_22_18_56_43.png?1769108203'},
  {id:PESSOAS.EWERTON_S, name:'Ewerton S.',  color:'#ff5ac4', photo:'https://files.monday.com/use1/photos/98079733/thumb_small/98079733-user_photo_initials_2026_01_08_20_21_57.png?1767903717'},
  {id:PESSOAS.BRENO, name:'Breno',       color:'#66ccff', photo:'https://files.monday.com/use1/photos/99331644/thumb_small/99331644-user_photo_initials_2026_02_05_16_31_55.png?1770309115'},
  {id:PESSOAS.EDUARDO, name:'Eduardo',     color:'#7e3b8a', photo:'https://files.monday.com/use1/photos/99331648/thumb_small/99331648-user_photo_initials_2026_02_05_14_46_07.png?1770302767'},
  {id:PESSOAS.JADY,name:'Jady',        color:'#00c875', photo:'https://files.monday.com/use1/photos/100482777/thumb_small/100482777-user_photo_2026_03_02_17_19_22.png?1772471962'},
];


// ─── Visão por grupo · a mesma divisão que o board tem ────────────────────────
//
// Redação, Produção, Design & Edição, Gestão de publicações, Finalizados. É como
// o time sempre leu a operação; o painel mostrava tudo misturado por semana e
// obrigava a abrir o Monday só para responder "em que etapa isso está?".
//
// Fica atrás de um botão, como a agenda: são 1900 itens, e nem todo dia se olha
// o board inteiro.

const GRUPOS_ABERTOS = 'vybe_grupos_abertos';
const GRUPOS_VISAO = 'vybe_visao_grupos';
// A ordem é a do board, não a do objeto GROUP_MAP: o time lê nesta sequência.
const ORDEM_DOS_GRUPOS = ['group_title', 'novo_grupo57911__1', 'novo_grupo__1',
                          'novo_grupo22352__1', 'novo_grupo31348__1'];
const LINHAS_POR_GRUPO = 50;
// Uma cor por etapa. O board sempre teve isso e era metade de como o time
// reconhecia onde a peça está sem ler nada.
const CORES_DOS_GRUPOS = {
  group_title:        '#579bfc',  // Redação
  novo_grupo57911__1: '#ff642e',  // Produção (Foto e Vídeo)
  novo_grupo__1:      '#a25ddc',  // Design & Edição
  novo_grupo22352__1: '#fdab3d',  // Gestão de publicações
  novo_grupo31348__1: '#00c875',  // Finalizados
};
const corDoGrupo = (id) => CORES_DOS_GRUPOS[id] || '#7c8797';

let visaoDeGruposAberta = (() => {
  try { return localStorage.getItem(GRUPOS_VISAO) === '1'; } catch { return false; }
})();
// Finalizados nasce fechado: são 1733 itens que ninguém abre para trabalhar.
let gruposRecolhidos = (() => {
  try {
    const salvo = localStorage.getItem(GRUPOS_ABERTOS);
    return new Set(salvo ? JSON.parse(salvo) : ['novo_grupo31348__1']);
  } catch { return new Set(['novo_grupo31348__1']); }
})();
let gruposExpandidos = new Set();

function guardarGruposRecolhidos() {
  try { localStorage.setItem(GRUPOS_ABERTOS, JSON.stringify([...gruposRecolhidos])); }
  catch { /* navegador sem storage */ }
}

function toggleVisaoDeGrupos() {
  visaoDeGruposAberta = !visaoDeGruposAberta;
  try { localStorage.setItem(GRUPOS_VISAO, visaoDeGruposAberta ? '1' : '0'); } catch { /* sem storage */ }
  renderVisaoDeGrupos();
  if (visaoDeGruposAberta) {
    const alvo = document.getElementById('grupos-board');
    setTimeout(() => alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

function toggleGrupo(groupId) {
  if (gruposRecolhidos.has(groupId)) gruposRecolhidos.delete(groupId);
  else gruposRecolhidos.add(groupId);
  guardarGruposRecolhidos();
  renderVisaoDeGrupos();
}

function verGrupoInteiro(groupId) {
  gruposExpandidos.add(groupId);
  renderVisaoDeGrupos();
}

function itensPorGrupo() {
  const base = (DADOS_ALL?.length ? DADOS_ALL : DADOS || [])
    .filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item));
  const mapa = new Map();
  base.forEach(item => {
    const id = String(item.group_id || '');
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(item);
  });
  // Grupos na ordem do board; qualquer grupo novo que apareça no Monday entra
  // no fim em vez de sumir da tela.
  const conhecidos = ORDEM_DOS_GRUPOS.filter(id => mapa.has(id));
  const novos = [...mapa.keys()].filter(id => !ORDEM_DOS_GRUPOS.includes(id)).sort();
  return [...conhecidos, ...novos].map(id => ({
    id,
    nome: GROUP_MAP[id] || id || 'Sem grupo',
    itens: mapa.get(id).sort((a, b) => String(a.veiculacao_iso || '9999').localeCompare(String(b.veiculacao_iso || '9999'))),
  }));
}

function linhaDeGrupoHtml(item) {
  const parar = 'event.stopPropagation()';
  const captacao = CATALOGO_CAPTACAO.length
    ? `<select class="grupo-select" onclick="${parar}" onchange="${parar};salvarCaptacaoNaLinha('${item.id}',this)">
        <option value=""${item.captacao ? '' : ' selected'}>—</option>
        ${CATALOGO_CAPTACAO
          .filter(([, rotulo, ativa]) => ativa !== false || rotulo === item.captacao)
          .map(([chave, rotulo, ativa]) => `<option value="${safeText(chave)}"${rotulo === item.captacao ? ' selected' : ''}>${safeText(rotulo)}${ativa === false ? ' (desativada)' : ''}</option>`).join('')}
      </select>`
    : `<span class="grupo-captacao">${safeText(item.captacao || '—')}</span>`;
  const data = (campo, iso, atrasado) =>
    `<input type="date" class="grupo-data-campo${atrasado ? ' is-late' : ''}" value="${safeText(iso || '')}"
       onclick="${parar}" onchange="${parar};salvarDataNaLinha('${item.id}','${campo}',this)"
       title="${campo === 'prazo' ? 'Prazo de produção' : 'Data de veiculação'}">`;
  return `<tr onclick="openItemWorkspace('${safeText(item.id)}')" title="Abrir ${safeText(item.nome || '')}">
    <td class="grupo-nome">${safeText(item.nome || 'Sem título')}</td>
    <td>${safeText(item.cliente || '—')}</td>
    <td class="grupo-dono" onclick="${parar}">${ownerEditorTrigger(item)}</td>
    <td onclick="${parar}"><button type="button" class="grupo-status" onclick="openStatusEditor(event,'${item.id}')"
      title="Trocar status">${pillHtml(item.status || 'Sem status', item.status_color, item.status_border)}</button></td>
    <td>${captacao}</td>
    <td>${data('prazo', item.prazo_iso, item.prazo_atrasado)}</td>
    <td>${data('veiculacao', item.veiculacao_iso, false)}</td>
  </tr>`;
}

// Captação e datas gravam pelo mesmo caminho do resto do painel; aqui só se
// escolhe o campo e se devolve o valor antigo quando a gravação não passa.
async function salvarCaptacaoNaLinha(itemId, select) {
  const rotulo = select.options[select.selectedIndex]?.textContent || '';
  const deuCerto = await salvarCampoDaFicha(itemId, 'captacao', select.value, select);
  if (deuCerto) applyOutboundItemPatch(itemId, { captacao: rotulo === '—' ? '' : rotulo }, 'captação');
}

async function salvarDataNaLinha(itemId, campo, input) {
  const item = findOperationalItem(itemId);
  const valor = String(input.value || '');
  if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return;
  input.disabled = true;
  try {
    await moverDataDoItem(item, campo, valor, { request: isRequestItem(item) });
  } catch (erro) {
    input.value = (campo === 'prazo' ? item.prazo_iso : item.veiculacao_iso) || '';
    showToast(`Não foi possível salvar a data: ${erro.message}`, 'err', 7000);
  } finally {
    input.disabled = false;
  }
}

function renderVisaoDeGrupos() {
  const wrap = document.getElementById('grupos-board');
  const botao = document.getElementById('ops-grupos-btn');
  if (!wrap) return;
  const grupos = itensPorGrupo();
  if (botao) {
    botao.classList.toggle('active', visaoDeGruposAberta);
    botao.setAttribute('aria-expanded', String(visaoDeGruposAberta));
    const contador = document.getElementById('ops-grupos-count');
    if (contador) contador.textContent = grupos.length;
  }
  if (!visaoDeGruposAberta) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); return; }
  wrap.classList.remove('focus-hidden');

  const blocos = grupos.map(grupo => {
    const recolhido = gruposRecolhidos.has(grupo.id);
    const total = grupo.itens.length;
    const mostrarTodos = gruposExpandidos.has(grupo.id);
    const visiveis = mostrarTodos ? grupo.itens : grupo.itens.slice(0, LINHAS_POR_GRUPO);
    const restam = total - visiveis.length;
    const corpo = recolhido ? '' : `
      <div class="grupo-tabela-rolagem">
        <table class="grupo-tabela">
          <thead><tr><th>Conteúdo</th><th>Cliente</th><th>Responsável</th><th>Status</th>
            <th>Captação</th><th>Prazo</th><th>Veiculação</th></tr></thead>
          <tbody>${visiveis.map(linhaDeGrupoHtml).join('')}</tbody>
        </table>
      </div>
      ${restam > 0 ? `<button type="button" class="grupo-ver-mais" onclick="verGrupoInteiro('${grupo.id}')">Mostrar os outros ${restam} ${restam === 1 ? 'conteúdo' : 'conteúdos'}</button>` : ''}`;
    return `<section class="grupo-bloco ${recolhido ? 'recolhido' : ''}" style="--cor-grupo:${corDoGrupo(grupo.id)}">
      <button type="button" class="grupo-cabeca" onclick="toggleGrupo('${grupo.id}')" aria-expanded="${!recolhido}">
        <span class="grupo-seta">${recolhido ? '›' : '⌄'}</span>
        <span class="grupo-titulo"><b>${safeText(grupo.nome)}</b><small>${total} ${total === 1 ? 'conteúdo' : 'conteúdos'}</small></span>
      </button>${corpo}</section>`;
  }).join('');

  const totalGeral = grupos.reduce((soma, g) => soma + g.itens.length, 0);
  wrap.innerHTML = `<div class="grupos-head">
      <div><div class="grupos-kicker">OPERAÇÃO · POR ETAPA</div>
        <div class="grupos-titulo">Conteúdos por grupo</div>
        <div class="grupos-sub">A mesma divisão do board: clique num grupo para recolher, clique numa linha para abrir a atividade.</div></div>
      <div class="grupos-total"><b>${totalGeral}</b><span>conteúdos${selectedPersonIds.size ? ' no filtro atual' : ''}</span></div>
    </div>${blocos || '<div class="grupos-vazio">Nenhum conteúdo carregado ainda.</div>'}`;
}
