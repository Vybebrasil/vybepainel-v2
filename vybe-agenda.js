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
  return `<div class="pending-row"><span class="pending-client" title="${safeText(d.cliente)}">${safeText(d.cliente)}</span><div class="pending-content"><button type="button" class="pending-name" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto do conteúdo">${safeText(d.nome)}</button><div class="pending-next">${safeText(info.next)} · ${safeText(elapsed)}</div></div><div class="pending-actions">${riskBadgeHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}<button type="button" class="pending-copy" onclick="copyPendingFollowUp('${d.id}')">Copiar</button><button type="button" class="pending-open" onclick="openItemWorkspace('${d.id}')">Abrir</button></div></div>`;
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
  return `<div class="command-row"><span class="command-client" title="${safeText(d.cliente)}">${safeText(d.cliente)}</span><div class="command-item"><button type="button" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da atividade">${safeText(d.nome)}</button><div class="command-detail"><span>${safeText(detail)}</span>${commandResponsibleHtml(d)}</div></div><div class="command-next">${safeText(next)}${context}${riskActionHtml(d,true)}</div><div class="command-tools">${riskBadgeHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}${copyable ? `<button type="button" class="command-copy" onclick="copyPendingFollowUp('${d.id}')">Copiar</button>` : ''}<button type="button" class="command-open" onclick="openItemWorkspace('${d.id}')">Abrir</button></div></div>`;
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
  return `<section class="command-team-rail"><div class="command-team-head"><span>Capacidade da equipe</span><span>priorizada por alerta operacional</span></div><div class="command-team-list">${chips}</div></section>`;
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
function leituraProativaHtml(items=DADOS) {
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
  const cards = active.length ? active.map(a => `<button type="button" class="leitura-proativa-alerta ${managerCommandInsight===a.key?'active':''}" style="--cor-alerta:${a.color}" onclick="openManagerCommandInsight('${a.key}')" title="Ver as demandas deste sinal na Central de Decisão"><b>${a.count}</b><span>${safeText(a.label)}</span><small>${safeText(a.detail)}</small></button>`).join('') : '<div class="leitura-proativa-empty">✓ Jarvis não identificou bloqueios que precisem de decisão agora.</div>';
  return `<section class="leitura-proativa"><div class="leitura-proativa-topo"><strong>Leitura proativa</strong><span>Atualiza a cada sincronização do Monday</span></div>${cards}</section>`;
}
let managerCommandDrawerOpen=false;
let managerCommandTab='critical';
let managerCommandInsight=null;
function managerCommandContextLabel(){ const selected=[...selectedPersonIds].map(id=>TEAM_USERS.find(user=>String(user.id)===String(id))).filter(Boolean).map(user=>firstName(user.name)); return selected.length?selected.join(' + '):'Toda a operação'; }
function updateManagerCommandToggle(total){ const button=document.getElementById('manager-command-toggle'); const count=document.getElementById('manager-command-count'); if(!button||!count)return; const available=panelMode==='gestor'; button.classList.toggle('visible',available); if(typeof pintarBarraDeComando==='function') pintarBarraDeComando(); button.setAttribute('aria-expanded',String(managerCommandDrawerOpen&&available)); count.textContent=total; button.title=`Mesa de Comando · ${managerCommandContextLabel()} · ${total} alerta${total===1?'':'s'}`; }
function toggleManagerCommandDrawer(){ alternarPainelDaBarra('comando'); }
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
  const priorityCard = priority ? `<aside class="command-decision"><span class="command-decision-label">Decisão prioritária agora</span><span class="command-decision-main">${safeText(priority.d.cliente)} · ${safeText(priority.d.nome)}</span><span class="command-decision-meta">${safeText(priority.next)}</span><button type="button" class="command-decision-button" onclick="openItemWorkspace('${priority.d.id}')">Abrir prioridade →</button></aside>` : `<aside class="command-decision" style="border-left-color:#00c875"><span class="command-decision-label" style="color:#65d7a0">Operação estável</span><span class="command-decision-main">Nenhum bloqueio prioritário identificado.</span></aside>`;
  const totalAlerts=critical.length+allExternal.length+internal.length;
  const tabs=[{id:'critical',label:'RESOLVER HOJE',count:critical.length,color:'#ff6b81'},{id:'blockers',label:'BLOQUEIOS',count:blockers.length,color:'#9d50dd'},{id:'external',label:'DEPENDE DE CLIENTE',count:allExternal.length,color:'#579bfc'},{id:'internal',label:'AJUSTE INTERNO',count:internal.length,color:'#ffbd2e'},{id:'capacity',label:'CAPACIDADE',count:0,color:'#ff9d00'}];
  const activeTab=tabs.some(tab=>tab.id===managerCommandTab)?managerCommandTab:'critical'; managerCommandTab=activeTab;
  const activeContent=managerCommandInsight==='risk'?commandGroupHtml('critical','Risco de prazo','itens críticos por prazo vencido, prazo de hoje ou risco operacional','#ff6b81',critical,'✓ Nenhum risco de prazo no contexto atual','command-critical'):managerCommandInsight==='external'?commandGroupHtml('external','Dependências externas','itens que precisam de aprovação, informação, retorno ou alteração do cliente','#579bfc',external,'✓ Nenhuma dependência externa no contexto atual','command-external'):managerCommandInsight==='sla'?commandGroupHtml('critical','SLA em atenção','itens há 24 horas ou mais sem movimento, ou com prazo vencido','#ffbd2e',lateSla,'✓ Nenhum SLA em atenção no contexto atual','command-critical'):managerCommandInsight==='owner'?commandGroupHtml('internal','Sem responsável','itens que precisam de atribuição antes de seguir','#c084fc',unassigned,'✓ Nenhuma demanda sem responsável no contexto atual','command-internal'):activeTab==='blockers'?commandGroupHtml('blockers','Central de bloqueios','quem precisa destravar, por qual motivo e qual é o próximo movimento','#9d50dd',blockers,'✓ Nenhum bloqueio ativo no contexto atual','command-external'):activeTab==='critical'?commandGroupHtml('critical','Resolver hoje','prazo vencido, prazo de hoje ou SLA estourado','#ff6b81',critical,'✓ Nenhum item crítico agora','command-critical'):activeTab==='external'?commandGroupHtml('external','Depende de cliente','aprovação, informação, retorno ou alteração','#579bfc',external,'✓ Nenhuma cobrança externa adicional','command-external'):activeTab==='internal'?commandGroupHtml('internal','Ajuste interno','cadastro, captação, responsabilidade ou validação','#ffbd2e',internal,'✓ Nenhum ajuste interno prioritário','command-internal'):`<div class="manager-command-capacity-note">A capacidade é apresentada por alerta operacional. Clique nos chips na barra superior para filtrar a agenda da semana por pessoa.</div>${commandTeamRailHtml()}`;
  updateManagerCommandToggle(totalAlerts);
  wrap.innerHTML = `<div class="manager-command-backdrop ${managerCommandDrawerOpen?'open':''}" onclick="closeManagerCommandDrawer()"></div><section class="manager-command-drawer ${managerCommandDrawerOpen?'open':''}" role="dialog" aria-modal="true" aria-label="Mesa de Comando" onclick="event.stopPropagation()"><header class="manager-command-drawer-head"><div><div class="manager-command-drawer-kicker">Vybe OS · Central de decisão</div><div class="manager-command-drawer-title">Mesa de Comando</div><div class="manager-command-drawer-context">${safeText(managerCommandContextLabel())} · decisões e riscos do contexto atual</div></div><button type="button" class="manager-command-close" onclick="closeManagerCommandDrawer()" aria-label="Fechar Mesa de Comando">×</button></header><div class="manager-command-summary">${summary}${priorityCard}</div><nav class="manager-command-tabs" aria-label="Seções da Mesa de Comando">${tabs.map(tab=>`<button type="button" class="manager-command-tab ${activeTab===tab.id?'active':''}" style="--tab-color:${tab.color}" onclick="setManagerCommandTab('${tab.id}')">${tab.label}${tab.count?` · ${tab.count}`:''}</button>`).join('')}</nav><div class="manager-command-content">${leituraProativaHtml(scopedItems)}${activeContent}</div></section>`;
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
function toggleAgendaMensal() { alternarPainelDaBarra('calendario'); }


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
function managerCalendarItems({ ignorarCliente = false, apenas = '' } = {}) {
  // A aba Solicitacoes tem o proprio botao Conclusao/Prazo; quando o recorte e
  // dela, e ele que manda.
  const porPrazo = apenas === 'request'
    ? (typeof currentDemandaDateMode !== 'undefined' && currentDemandaDateMode === 'prazo')
    : dateMode === 'prazo';
  const production = (DADOS_ALL?.length ? DADOS_ALL : DADOS || []).filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item)).map(item => ({
    ...item, cliente:clientMasterResolveName(item.cliente), calendarSource:'content', calendarDateIso: porPrazo ? (item.prazo_iso || '') : (item.veiculacao_iso || ''), calendarType: item.formato || 'Conteúdo'
  }));
  const requests = (DADOS_DEMANDAS || []).filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item)).map(item => ({
    ...item, cliente:clientMasterResolveName(item.cliente), calendarSource:'request', calendarDateIso: porPrazo ? (item.prazo_iso || '') : (item.conclusao_iso || ''), calendarType: item.tipo || 'Solicitação'
  }));
  return [...production, ...requests].filter(item => {
    // 'apenas' e o recorte fixo de quem chama (a aba Solicitacoes pede so as
    // dela); managerCalendarSourceFilter continua sendo a escolha da pessoa.
    if (apenas && item.calendarSource !== apenas) return false;
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
// ── cartão rápido ────────────────────────────────────────────────────────────
//
// Clicar numa peça abria a gaveta lateral inteira — doze seções e vinte botões —
// mesmo quando a intenção era só trocar o status ou puxar a data. Agora o clique
// abre um cartão do tamanho da tarefa, ancorado na peça, onde tudo que se muda
// no dia a dia está à mão. A gaveta continua a um clique, para quando a pergunta
// é outra: histórico, arquivos, passagem de bastão.
//
// Ele é feito das mesmas peças da tabela e da fila — mesmo seletor de status,
// mesmas pílulas de catálogo, mesmos campos de data. Não é uma terceira
// implementação das mesmas coisas.
function managerCalendarOpen(source, itemId, event) {
  if (event) return abrirCartaoRapido(itemId, event, source);
  if (source === 'request') return openDemandaWorkspace(itemId);
  return openItemWorkspace(itemId);
}

function fecharCartaoRapido() {
  document.getElementById('cartao-rapido-fundo')?.remove();
  document.getElementById('cartao-rapido')?.remove();
}

function abrirCartaoRapido(itemId, event, source = 'content') {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  fecharCartaoRapido();
  // A lista crua de Solicitacoes nao tem board_id nem 'formato' — sem traduzir,
  // as pilhas deste cartao procuravam a coluna do quadro errado.
  const cru = (DADOS_DEMANDAS || []).find((d) => String(d.id) === String(itemId));
  const item = source === 'request'
    ? (cru ? normalizeRequestForOperational(cru) : null)
    : findOperationalItem(itemId);
  if (!item) return showToast('Atividade não encontrada.', 'err');

  const rect = (event.currentTarget || event.target).getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'cartao-rapido-fundo';
  fundo.className = 'cartao-rapido-fundo';
  fundo.onclick = fecharCartaoRapido;

  const cartao = document.createElement('div');
  cartao.id = 'cartao-rapido';
  cartao.className = 'cartao-rapido';
  const linha = (rotulo, conteudo) => `<div class="cr-linha"><span>${rotulo}</span><div>${conteudo}</div></div>`;
  const data = (campo, iso) => `<input type="date" class="grupo-data-campo" value="${safeText(iso || '')}"
      onchange="event.stopPropagation();salvarDataNaLinha('${safeText(item.id)}','${campo}',this)">`;
  const ehDemanda = source === 'request';

  cartao.innerHTML = `
    <div class="cr-topo">
      <div class="cr-cliente">${safeText(item.cliente || 'Sem cliente')} ${vybeChipId(item)}</div>
      <button type="button" class="cr-fechar" onclick="fecharCartaoRapido()" aria-label="Fechar">×</button>
    </div>
    <button type="button" class="cr-titulo" onclick="renomearPeca('${safeText(item.id)}')"
      title="Clique para renomear">${safeText(item.nome || 'Sem título')}</button>
    <div class="cr-campos">
      ${linha('Status', `<button type="button" class="grupo-pill-btn" onclick="openStatusEditor(event,'${safeText(item.id)}')">${pillHtml(item.status || 'Sem status', item.status_color, item.status_border)}</button>`)}
      ${linha('Grupo', botaoDeGrupo(item))}
      ${linha('Responsável', vybeDono(item))}
      ${ehDemanda ? '' : linha('Captação', pillEditavel(item, 'captacao'))}
      ${linha(ehDemanda ? 'Tipo de demanda' : 'Formato', pillEditavel(item, 'formato'))}
      ${ehDemanda ? '' : linha('Tipo', pillEditavel(item, 'tipo_conteudo'))}
      ${ehDemanda ? '' : linha('OFF / áudio', pillEditavel(item, 'off_audio'))}
      ${linha('Prioridade', pillEditavel(item, 'prioridade'))}
      ${linha('Prazo', data('prazo', item.prazo_iso))}
      ${linha('Veiculação', data('veiculacao', ehDemanda ? item.conclusao_iso : item.veiculacao_iso))}
    </div>
    <div class="cr-rodape">
      <button type="button" class="cr-abrir" onclick="fecharCartaoRapido();${ehDemanda ? `openDemandaWorkspace('${safeText(item.id)}')` : `openItemWorkspace('${safeText(item.id)}')`}">
        Abrir tudo — arquivos, histórico e entrega →</button>
      ${podeVerMonday() ? `<button type="button" class="cr-excluir" onclick="removerPeca('${safeText(item.id)}')"
        title="Excluir esta atividade — vai para a lixeira do Monday">Excluir</button>` : ''}
    </div>`;
  document.body.append(fundo, cartao);
  ancorarPopover(cartao, rect);
}

// O + do dia abria o formulario antigo — o de onze campos de uma vez, que so
// sobrou como socorro para quando o CADASTROS de verdade nao carrega. Agora
// abre o mesmo CADASTROS do painel, ja com o que o calendario sabe: o dia
// clicado e, se a visao estiver num cliente so, o cliente.
function managerCalendarAdd(dateIso) {
  // O dia clicado e uma veiculacao ou um prazo, conforme a referencia ativa do
  // calendario. Sem olhar para isso, clicar num dia no modo Prazo criaria a
  // peca para veicular naquele dia — uma semana adiantada.
  const veic = dateMode === 'prazo' ? cadastrosIsoOffset(dateIso, PRAZO_OURO_DIAS) : dateIso;
  const prazo = dateMode === 'prazo' ? dateIso : goldenDeadlineIso(dateIso);
  const cliente = managerCalendarClientFilter !== 'all' ? managerCalendarClientFilter : '';

  if (typeof openCadastrosGoverned === 'function') {
    return openCadastrosGoverned({ client: cliente, veic, prazo });
  }
  if (typeof openCadastrosGovernedLegacy !== 'function') return showToast('CADASTROS ainda não está disponível neste contexto.', 'info');
  openCadastrosGovernedLegacy();
  setTimeout(() => {
    const campoVeic = document.getElementById('cad-veic');
    const campoPrazo = document.getElementById('cad-prazo');
    const campoCliente = document.getElementById('cad-client');
    if (campoVeic) campoVeic.value = veic;
    if (campoPrazo) campoPrazo.value = prazo;
    // O socorro tambem aproveita o cliente da visao, e so se ele estiver na lista.
    if (campoCliente && cliente && [...campoCliente.options].some((o) => o.value === cliente)) {
      campoCliente.value = cliente;
    }
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
async function moverDataDoItem(item, campo, dateIso, { request = false, renderizar = true, avisar = true } = {}) {
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
    (DADOS_DEMANDAS || []).forEach((registro) => {
      if (String(registro.id) !== String(item.id)) return;
      if (campo === 'prazo') { registro.prazo_iso = dateIso; registro.prazo = curto(dateIso); }
      else { registro.conclusao_iso = dateIso; registro.conclusao = curto(dateIso);
             registro.veiculacao_iso = dateIso; registro.veiculacao = curto(dateIso); }
      registro.updated_at = new Date().toISOString();
    });
    outboundMutationGuardUntil = 0;
    if (renderizar) renderIntegratedOperationalViews();
  } else {
    applyOutboundItemPatch(item.id,
      campo === 'prazo' ? { prazo_iso: dateIso } : { veiculacao_iso: dateIso }, 'planejamento', { render: renderizar });
  }
  if (renderizar) {
    renderManagerCalendar();
    renderVisaoDeGrupos();
  }

  // O Prazo de Ouro deixa de barrar e passa a avisar: quem move a data está
  // replanejando, e travar no meio só devolveria o formulário.
  const prazo = campo === 'prazo' ? dateIso : String(item.prazo_iso || '');
  const veic = campo === 'veiculacao' ? dateIso : String((request ? item.conclusao_iso : item.veiculacao_iso) || '');
  const folga = (prazo && veic) ? goldenDeadlineGap(prazo, veic) : null;
  const alerta = (folga !== null && folga < PRAZO_OURO_DIAS)
    ? ` · atenção: ${folga} dia${folga === 1 ? '' : 's'} de antecedência, abaixo do Prazo de Ouro`
    : '';
  if (avisar) showToast(`✓ ${campo === 'prazo' ? 'Prazo' : 'Veiculação'} de ${safeText(item.nome || 'a peça')}: ${planningDateBr(anterior) || '—'} → ${planningDateBr(dateIso)}${alerta}`,
    alerta ? 'info' : 'ok', alerta ? 7000 : 4200);
  return true;
}

function managerCalendarLoadDemandas(button) {
  if (managerCalendarDemandasLoading) return;
  managerCalendarDemandasLoading = true;
  if (button) { button.disabled = true; button.textContent = 'Carregando…'; }
  refreshDemandas().finally(() => { managerCalendarDemandasLoading = false; renderManagerCalendar(); });
}
function managerCalendarEventHtml(item) {
  const sourceLabel = item.calendarSource === 'request' ? 'SOLICITAÇÃO' : 'CONTEÚDO';
  const sourceClass = item.calendarSource === 'request' ? 'request' : '';
  const color = managerCalendarStatusColor(item, item.calendarSource === 'request' ? '#c084fc' : '#ff8b38');
  const status = item.status || 'Sem status';
  const owner = item.responsavel ? firstName(item.responsavel) : 'Sem responsável';
  return `<button type="button" draggable="true" class="manager-calendar-event" style="--event-color:${color}" title="${safeText(`${item.nome} · ${item.cliente} · ${status} · arraste para mover a data`)}" onclick="managerCalendarOpen('${item.calendarSource}','${item.id}',event)" ondragstart="managerCalendarDragStart('${item.calendarSource}','${item.id}',event)" ondragend="managerCalendarDragEnd()"><span class="manager-calendar-event-bar"></span><span class="manager-calendar-event-copy"><b>${safeText(item.nome || 'Sem título')}</b><small>${safeText(item.cliente || '—')} · ${safeText(owner)} · <span class="manager-calendar-event-status">${safeText(status)}</span></small></span><span class="manager-calendar-event-meta"><i class="${sourceClass}"></i><em class="manager-calendar-event-age">${sourceLabel}</em></span></button>`;
}
function openDemandaPlanningEditor(itemId, targetDate='') {
  const item = (DADOS_DEMANDAS || []).find(entry => String(entry.id) === String(itemId));
  if (!item) return showToast('Solicitação não encontrada.', 'err');
  const initial = targetDate || (dateMode === 'prazo' ? item.prazo_iso : item.conclusao_iso) || '';
  const fieldLabel = dateMode === 'prazo' ? 'PRAZO DA SOLICITAÇÃO' : 'CONCLUSÃO PREVISTA';
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Solicitação de demanda</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Mover solicitação</h2><p class="workflow-copy">Ajuste a data diretamente na agenda. A solicitação continua identificada como origem própria e não vira conteúdo automaticamente.</p>${workflowItemHtml(item,item.status)}<label class="workflow-field"><span>${fieldLabel}</span><input id="demanda-calendar-date" type="date" value="${safeText(initial)}"></label><div class="planning-change-note"><b>Rastreabilidade:</b> o painel atualiza a coluna correspondente do board Solicitações de Demandas e preserva a origem do item.</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="saveDemandaCalendarDate('${item.id}','${dateMode}')">Salvar data →</button></div>`);
}
async function saveDemandaCalendarDate(itemId, mode) {
  const item = (DADOS_DEMANDAS || []).find(entry => String(entry.id) === String(itemId));
  const date = String(document.getElementById('demanda-calendar-date')?.value || '');
  if (!item || !date) return showToast('Informe uma data válida.', 'info');
  const columnId = mode === 'prazo' ? COLUNAS.demandas.prazo : COLUNAS.demandas.veiculacao;
  const previous = mode === 'prazo' ? item.prazo_iso : item.conclusao_iso;
  if (date === previous) return closeWorkflowModal();
  const button = document.querySelector('.workflow-primary');
  if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
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
    if (button) { button.disabled = false; button.textContent = 'Salvar data →'; }
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
  const demandNote = DADOS_DEMANDAS.length ? `<div class="manager-calendar-demand-note"><span><b>${sourceCount.request}</b> solicitações aparecem na agenda. Elas permanecem separadas do conteúdo e podem ser abertas pelo próprio calendário.</span><button type="button" onclick="switchBoard('demandas',document.getElementById('btn-board-demandas'))">Abrir esteira de solicitações →</button></div>` : `<div class="manager-calendar-demand-note"><span><b>Solicitações ainda não carregadas nesta sessão.</b> A agenda já está preparada para cruzar o board de Solicitação de Demandas sem misturar sua origem com conteúdo.</span><button type="button" onclick="managerCalendarLoadDemandas(this)">Carregar solicitações</button></div>`;
  wrap.innerHTML = `<div class="manager-calendar-head"><div><div class="manager-calendar-kicker">Gestor · Planejamento visual</div><div class="manager-calendar-title">Agenda mensal por cliente</div><div class="manager-calendar-sub">Troque de cliente, veja veiculações e prazos no mês, abra a atividade no Workspace e arraste um item para preparar uma nova data.</div></div><div class="manager-calendar-actions"><button type="button" class="${dateMode==='veiculacao'?'active':''}" onclick="managerCalendarSetDateMode('veiculacao')">Veiculação</button><button type="button" class="${dateMode==='prazo'?'active':''}" onclick="managerCalendarSetDateMode('prazo')">Prazo</button><button type="button" class="primary" onclick="managerCalendarAdd('${managerCalendarDateIso(new Date())}')">+ CADASTROS</button><button type="button" onclick="managerCalendarOpenClientMaster()">Cliente master</button></div></div><div class="manager-calendar-toolbar"><div class="manager-calendar-month"><button type="button" onclick="managerCalendarGoMonth(-1)" aria-label="Mês anterior">‹</button><span class="manager-calendar-month-label">${safeText(managerCalendarLabel(meta))}</span><button type="button" onclick="managerCalendarGoMonth(1)" aria-label="Próximo mês">›</button><button type="button" onclick="managerCalendarGoToday()">HOJE</button></div><div class="manager-calendar-clients">${clientButtons}</div><div class="manager-calendar-status"><i class="${DADOS_DEMANDAS.length?'demands':''}"></i>${sourceCount.content} conteúdo · ${sourceCount.request} solicitações</div></div><div class="manager-calendar-legend"><span class="manager-calendar-legend-copy">Referência ativa: <b>${dateMode==='prazo'?'PRAZO DE PRODUÇÃO':'VEICULAÇÃO'}</b> · clique para abrir · arraste para mover</span><span class="manager-calendar-source-legend"><span><i></i> Conteúdo</span><span><i class="request"></i> Solicitação de Demanda</span></span></div>${demandNote}<div class="manager-calendar-grid"><div class="manager-calendar-weekday">SEG</div><div class="manager-calendar-weekday">TER</div><div class="manager-calendar-weekday">QUA</div><div class="manager-calendar-weekday">QUI</div><div class="manager-calendar-weekday">SEX</div><div class="manager-calendar-weekday">SÁB</div><div class="manager-calendar-weekday">DOM</div>${cells}</div><div class="manager-calendar-footer"><span><strong>${monthItems.length}</strong> itens no mês · <strong>${clients.length}</strong> clientes com atividade</span><button type="button" onclick="managerCalendarSetClient('all');managerCalendarSetSource('all')">Limpar visão do calendário</button></div>`;
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
    ${vybeChipId(d)}<span class="ops-item-client">${safeText(d.cliente)}</span><span class="ops-item-name">${safeText(d.nome)}</span>${pillHtml(d.status,d.status_color,d.status_border)}<span class="ops-item-date">S${d.semana} · ${safeText(getDateFmt(d))}</span>
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
  if (viewBtn) { viewBtn.textContent = 'Ver por cliente'; viewBtn.classList.add('active'); }
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
    btn.innerHTML = '<span class="chevron fechado"></span> Mostrar';
  } else {
    legend.classList.remove('collapsed');
    legend.classList.add('expanded');
    btn.innerHTML = '<span class="chevron"></span> Ocultar';
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
  {id:PESSOAS.PAULO, name:'Paulo',       color:'#0073ea', photo:null},
  {id:PESSOAS.VINICIUS, name:'Vinícius',    color:'#037f4c', photo:null},
  {id:PESSOAS.EWERTON_L, name:'Ewerton L.',  color:'#df2f4a', photo:null},
  {id:PESSOAS.RERISTON, name:'Reriston',    color:'#ff642e', photo:null},
  {id:PESSOAS.DEIVID, name:'Deivid',      color:'#fdab3d', photo:null},
  {id:PESSOAS.BEATRIZ, name:'Beatriz',     color:'#df2f4a', photo:null},
  {id:PESSOAS.ADEMIR, name:'Ademir',      color:'#4eccc6', photo:null},
  {id:PESSOAS.TAINARA, name:'Tainara',     color:'#579bfc', photo:null},
  {id:PESSOAS.EWERTON_S, name:'Ewerton S.',  color:'#ff5ac4', photo:null},
  {id:PESSOAS.BRENO, name:'Breno',       color:'#66ccff', photo:null},
  {id:PESSOAS.EDUARDO, name:'Eduardo',     color:'#7e3b8a', photo:null},
  {id:PESSOAS.JADY,name:'Jady',        color:'#00c875', photo:null},
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
  novo_grupo__1:      '#9d50dd',  // Design & Edição
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

function toggleVisaoDeGrupos() { alternarPainelDaBarra('grupos'); }


// Recolher e expandir redesenhavam SEMPRE a visao de Producao. Na aba
// Solicitacoes o clique gravava o estado e redesenhava a outra tela — dava a
// impressao de que nada acontecia.
function quadroDoGrupo(groupId) {
  return GRUPOS_DE_DEMANDAS.includes(String(groupId)) ? 'demandas' : 'producao';
}

function toggleGrupo(groupId) {
  if (gruposRecolhidos.has(groupId)) gruposRecolhidos.delete(groupId);
  else gruposRecolhidos.add(groupId);
  guardarGruposRecolhidos();
  renderVisaoDeGrupos(quadroDoGrupo(groupId));
}

function verGrupoInteiro(groupId) {
  gruposExpandidos.add(groupId);
  renderVisaoDeGrupos(quadroDoGrupo(groupId));
}

function itensPorGrupo(fonte = null, ordem = null) {
  const base = (fonte || (DADOS_ALL?.length ? DADOS_ALL : DADOS || []))
    .filter(item => !selectedPersonIds.size || itemMatchesSelectedPeople(item));
  const mapa = new Map();
  base.forEach(item => {
    const id = String(item.group_id || '');
    if (!mapa.has(id)) mapa.set(id, []);
    mapa.get(id).push(item);
  });
  // Grupos na ordem do board; qualquer grupo novo que apareça no Monday entra
  // no fim em vez de sumir da tela.
  const sequencia = ordem || ORDEM_DOS_GRUPOS;
  const conhecidos = sequencia.filter(id => mapa.has(id));
  const novos = [...mapa.keys()].filter(id => !sequencia.includes(id)).sort();
  return [...conhecidos, ...novos].map(id => ({
    id,
    nome: TITULO_DOS_GRUPOS[id] || GROUP_MAP[id] || id || 'Sem grupo',
    itens: ordenarItens(mapa.get(id)),
  }));
}

// ── ordenação por coluna ─────────────────────────────────────────────────────
//
// A ordem era fixa por veiculação. Ordenar por prazo, por cliente ou por quem
// responde exigia ler a lista inteira com o olho.
//
// A ordenação vale dentro de cada grupo, não entre eles: os grupos são etapas
// da produção e a sequência deles não é uma opinião — misturar Redação com
// Finalizados numa lista só desfaria a divisão que a tela existe para mostrar.
let ORDEM = { campo: 'veiculacao_iso', desc: false };

// Producao e Solicitacoes nao tem as mesmas colunas. Captacao, Tipo de conteudo
// e OFF so existem em Producao; mostra-las do outro lado enchia a tabela de
// travessao e prometia uma edicao que o servidor recusa.
const COLUNAS_DA_TABELA = {
  producao: ['id','nome','cliente','responsavel','status','captacao','formato',
             'tipo_conteudo','off_audio','prioridade','prazo_iso','veiculacao_iso'],
  demandas: ['id','nome','cliente','responsavel','status','formato',
             'prioridade','prazo_iso','veiculacao_iso'],
};

const CAMPOS_ORDENAVEIS = {
  id:            { rotulo: 'ID',          valor: (i) => Number(i.id) || 0 },
  nome:          { rotulo: 'Conteúdo',    rotuloDemandas: 'Demanda', valor: (i) => String(i.nome || '') },
  cliente:       { rotulo: 'Cliente',     valor: (i) => String(i.cliente || '') },
  responsavel:   { rotulo: 'Responsável', valor: (i) => String(i.responsavel || '') },
  status:        { rotulo: 'Status',      valor: (i) => String(i.status || '') },
  captacao:      { rotulo: 'Captação',    valor: (i) => String(i.captacao || '') },
  formato:       { rotulo: 'Formato',     rotuloDemandas: 'Tipo de demanda', valor: (i) => String(i.formato || '') },
  tipo_conteudo: { rotulo: 'Tipo',        valor: (i) => String(i.tipo_conteudo || '') },
  off_audio:     { rotulo: 'OFF',         valor: (i) => String(i.off_audio || '') },
  prioridade:    { rotulo: 'Prioridade',  valor: (i) => String(i.prioridade || '') },
  prazo_iso:     { rotulo: 'Prazo',       valor: (i) => String(i.prazo_iso || '') },
  veiculacao_iso:{ rotulo: 'Veiculação',  valor: (i) => String(i.veiculacao_iso || '') },
};

function ordenarItens(itens) {
  const cfg = CAMPOS_ORDENAVEIS[ORDEM.campo] || CAMPOS_ORDENAVEIS.veiculacao_iso;
  const sinal = ORDEM.desc ? -1 : 1;
  return [...itens].sort((a, b) => {
    const x = cfg.valor(a);
    const y = cfg.valor(b);
    // Vazio vai sempre para o fim, subindo ou descendo: uma peça sem prazo não
    // é "a mais antiga", é uma peça sem prazo.
    const xVazio = x === '' || x === '—';
    const yVazio = y === '' || y === '—';
    if (xVazio !== yVazio) return xVazio ? 1 : -1;
    if (typeof x === 'number') return (x - y) * sinal;
    return x.localeCompare(y, 'pt-BR', { numeric: true }) * sinal;
  });
}

function ordenarPor(campo) {
  if (!CAMPOS_ORDENAVEIS[campo]) return;
  ORDEM = ORDEM.campo === campo ? { campo, desc: !ORDEM.desc } : { campo, desc: false };
  renderVisaoDeGrupos();
}

function cabecalhoOrdenavel(campo, quadro = 'producao') {
  const base = CAMPOS_ORDENAVEIS[campo];
  const cfg = quadro === 'demandas' && base?.rotuloDemandas
    ? { ...base, rotulo: base.rotuloDemandas } : base;
  const ativa = ORDEM.campo === campo;
  const seta = ativa ? (ORDEM.desc ? ICONE.desce : ICONE.sobe) : ICONE.ordenar;
  return `<th><button type="button" class="grupo-th ${ativa ? 'ordenando' : ''}"
    onclick="ordenarPor('${campo}')"
    title="Ordenar por ${cfg.rotulo}${ativa ? (ORDEM.desc ? ' — hoje: maior para menor' : ' — hoje: menor para maior') : ''}"
    >${cfg.rotulo}<i class="grupo-ordem">${seta}</i></button></th>`;
}

// Seleção múltipla: sem ela, mudar o prazo de dez peças era abrir dez peças.
const SELECIONADAS = new Set();

// ── campos de escolha, uma regra só ──────────────────────────────────────────
//
// Captação virou editável e as outras quatro nasceram só de leitura — um caso
// especial por coluna. Agora é uma regra: todo campo que vem de catálogo se
// desenha como pílula com a cor do catálogo e abre o mesmo seletor. Acrescentar
// uma coluna nova é acrescentar uma linha aqui.
//
// O servidor já aceitava os cinco desde sempre; faltava a tela pedir.
// A coluna nao e a mesma nos dois quadros: Formato em Producao e
// lista_suspensa0__1 e em Solicitacoes e dropdown_mkv8d52z; Prioridade e
// color_mm164yv8 num e color_mkwtgakv no outro. Havia um id so por campo, entao
// a tela oferecia o catalogo de Producao numa Solicitacao e mandava gravar la.
//
// Captacao, Tipo de conteudo e OFF nao existem em Solicitacoes — para um item
// de la o campo simplesmente nao aparece.
const CAMPOS_DE_ESCOLHA = {
  captacao:      { rotulo: 'Captação',
                   colunas: { producao: 'status_1__1' } },
  formato:       { rotulo: 'Formato', rotuloDemandas: 'Tipo de demanda',
                   colunas: { producao: 'lista_suspensa0__1', demandas: 'dropdown_mkv8d52z' } },
  tipo_conteudo: { rotulo: 'Tipo de conteúdo',
                   colunas: { producao: 'lista_suspensa__1' } },
  off_audio:     { rotulo: 'OFF / áudio',
                   colunas: { producao: 'color_mkynd7j8' } },
  prioridade:    { rotulo: 'Prioridade',
                   colunas: { producao: 'color_mm164yv8', demandas: 'color_mkwtgakv' } },
};

// Quem decide se a atividade e uma solicitacao e o isRequestItem, que ja
// existia: ele olha a origem E o board_id. Olhar so o board_id me traiu — a
// lista crua de Solicitacoes nao carrega esse campo, entao toda linha se dizia
// de Producao e a tabela desenhava as colunas do quadro errado.
const quadroDoItem = (item) => (typeof isRequestItem === 'function' && isRequestItem(item))
  ? 'demandas' : 'producao';
const colunaDoCampo = (campo, item) => CAMPOS_DE_ESCOLHA[campo]?.colunas?.[quadroDoItem(item)] || '';
const campoExisteNoQuadro = (campo, item) => Boolean(colunaDoCampo(campo, item));
// A mesma coluna tem nome diferente nos dois quadros. O que em Producao e
// 'Formato' e em Solicitacoes 'Tipo de demanda' — e e assim que o time chama.
const rotuloDoCampo = (campo, item) => {
  const cfg = CAMPOS_DE_ESCOLHA[campo];
  if (!cfg) return campo;
  return quadroDoItem(item) === 'demandas' && cfg.rotuloDemandas ? cfg.rotuloDemandas : cfg.rotulo;
};

// O processItems escreve '—' quando a coluna vem vazia. Sem isto, o traço virava
// uma pílula com um traço dentro, como se fosse um valor.
const vazio = (v) => !v || String(v).trim() === '' || String(v).trim() === '—';

function catalogoDoCampo(campo, item) {
  if (campo === 'captacao') {
    return (typeof CATALOGO_CAPTACAO === 'undefined' ? [] : CATALOGO_CAPTACAO)
      .map((c) => ({ chave: c.chave, rotulo: c.rotulo, cor: c.cor, borda: c.borda, ativa: c.ativa !== false }));
  }
  const coluna = colunaDoCampo(campo, item);
  return (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
    .filter((o) => o.coluna_id === coluna)
    .map((o) => {
      // A bolinha do seletor tem que ser a MESMA cor da etiqueta na linha. Em
      // coluna dropdown o Monday não manda cor, e sem isto o seletor mostrava
      // nove bolinhas cinzas iguais enquanto as etiquetas eram coloridas.
      const c = o.cor ? { cor: o.cor, borda: o.borda || o.cor } : corDeOpcao(o.rotulo, coluna);
      return { chave: o.chave, rotulo: o.rotulo, cor: c?.cor, borda: c?.borda, ativa: o.ativa !== false };
    });
}

function pillEditavel(item, campo) {
  // Campo que nao existe no quadro deste item nao vira botao: clicar nele
  // gravaria numa coluna do outro quadro.
  if (!campoExisteNoQuadro(campo, item)) return '<span class="grupo-vazio">—</span>';
  const valor = item[campo];
  const escolha = catalogoDoCampo(campo, item).find((o) => o.rotulo === valor);
  const dentro = vazio(valor)
    ? '<span class="grupo-vazio">—</span>'
    : pillHtml(valor, escolha?.cor || '', escolha?.borda || '');
  return `<button type="button" class="grupo-pill-btn"
    onclick="abrirEscolha(event,'${safeText(item.id)}','${campo}')"
    title="Trocar ${safeText(rotuloDoCampo(campo, item))}">${dentro}</button>`;
}

function abrirEscolha(event, itemId, campo) {
  event.preventDefault();
  event.stopPropagation();
  fecharEscolha();
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Item não encontrado.', 'err');
  const atual = String(item[campo] || '');
  // Opção desativada no Monday só aparece se a peça ainda estiver nela.
  // Quem administra vê também as desligadas, para poder religar; quem opera vê
  // só o que dá para escolher.
  if (!campoExisteNoQuadro(campo, item)) {
    return showToast(`${rotuloDoCampo(campo, item)} não existe no quadro desta atividade.`, 'info');
  }
  const coluna = colunaDoCampo(campo, item);
  const opcoes = catalogoDoCampo(campo, item)
    .filter((o) => o.ativa || o.rotulo === atual || podeGerirEtiquetas());
  if (!opcoes.length) return showToast(`As opções de ${rotuloDoCampo(campo, item)} ainda estão carregando.`, 'info');

  const rect = event.currentTarget.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'escolha-backdrop';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharEscolha;
  const menu = document.createElement('div');
  menu.id = 'escolha-editor';
  menu.className = 'status-editor';
  const gerindo = podeGerirEtiquetas();
  // Ligada/desligada era ◉ contra ○: dois glifos quase iguais de 22px, sem cor,
  // e ainda escondidos até passar o mouse. Estado não se esconde — a chave fica
  // sempre à vista; renomear, cor e apagar são ações e continuam aparecendo no
  // hover.
  const chave = (o) => gerindo ? `<button type="button" class="vybe-chave ${o.ativa ? 'ligada' : ''}"
      role="switch" aria-checked="${o.ativa ? 'true' : 'false'}"
      title="${o.ativa ? 'Ligada — aparece nas escolhas. Clique para desligar.' : 'Desligada — não aparece nas escolhas novas. Clique para ligar.'}"
      onclick="event.stopPropagation();alternarEtiqueta('${coluna}','${campo}','${safeText(o.chave)}','${safeText(o.rotulo).replace(/'/g, "\\'")}',${o.ativa})"><span></span></button>` : '';
  const ferramentas = (o) => gerindo ? `<span class="etiqueta-ferramentas">
      <button type="button" class="icone-btn" title="Renomear" aria-label="Renomear" onclick="event.stopPropagation();renomearEtiqueta('${coluna}','${campo}','${safeText(o.chave)}','${safeText(o.rotulo).replace(/'/g, "\\'")}')">${ICONE.lapis}</button>
      <button type="button" class="icone-btn" title="Trocar a cor" aria-label="Trocar a cor" onclick="event.stopPropagation();recolorirEtiqueta('${coluna}','${campo}','${safeText(o.chave)}','${o.cor || ''}')">${ICONE.gota}</button>
      <button type="button" class="icone-btn perigo" title="Apagar" aria-label="Apagar" onclick="event.stopPropagation();removerEtiqueta('${coluna}','${campo}','${safeText(o.chave)}','${safeText(o.rotulo).replace(/'/g, "\\'")}')">${ICONE.lixo}</button>
    </span>` : '';
  menu.innerHTML = `<div class="status-editor-head">${safeText(rotuloDoCampo(campo, item))}</div>
    ${opcoes.map((o) => `<div class="etiqueta-linha ${o.ativa ? '' : 'desligada'}">
        <button type="button" class="status-editor-option ${o.rotulo === atual ? 'current' : ''}"
          onclick="escolherValor('${safeText(item.id)}','${campo}','${safeText(o.chave)}')">
          <span class="status-editor-dot" style="background:${o.cor || '#7c8797'};color:${o.cor || '#7c8797'}"></span>
          <span>${safeText(o.rotulo)}${o.ativa ? '' : ' (desligada)'}</span>
          ${o.rotulo === atual ? '<span class="status-editor-check">✓</span>' : ''}</button>
        ${ferramentas(o)}${chave(o)}
      </div>`).join('')}
    <div class="etiqueta-linha">
      <button type="button" class="status-editor-option" onclick="escolherValor('${safeText(item.id)}','${campo}','')">
        <span class="status-editor-dot" style="background:#4a5464;color:#4a5464"></span><span>Deixar em branco</span></button>
    </div>
    ${gerindo ? `<div class="etiqueta-rodape">
      <button type="button" onclick="event.stopPropagation();criarEtiqueta('${coluna}','${campo}')">+ Nova etiqueta</button>
    </div>` : ''}`;
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
}

// ── gerir as etiquetas de dentro do próprio menu ─────────────────────────────
//
// Mudar o nome ou a cor de uma etiqueta exigia abrir o Monday. Agora acontece
// onde a etiqueta é usada. Vale para todo campo de catálogo, não para um.
//
// Só administrador vê as ferramentas: quem escolhe uma etiqueta é o time
// inteiro, quem muda o vocabulário da operação é quem administra.
function podeGerirEtiquetas() { return Boolean(sessaoAtual()?.admin); }

async function chamarEtiqueta(corpo) {
  const r = await fetch('/api/painel?area=opcoes', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
  return d;
}

// Depois de mexer no catálogo, ele precisa ser relido: a tela inteira desenha a
// partir dele, e continuar com a cópia antiga mostraria o nome velho.
async function recarregarCatalogos() {
  try {
    const r = await fetch('/api/conteudos', { credentials: 'same-origin' });
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.opcoes)) CATALOGO_OPCOES = d.opcoes;
    if (Array.isArray(d.captacao)) {
      CATALOGO_CAPTACAO = d.captacao.map((c) => ({
        chave: c.chave, rotulo: c.rotulo, cor: c.cor || '', borda: c.borda || '', ativa: c.ativa !== false,
      }));
    }
  } catch { /* segue com o catálogo que já tem */ }
  renderVisaoDeGrupos();
}

async function renomearEtiqueta(coluna, campo, chave, atual) {
  const novo = window.prompt('Nome da etiqueta:', atual);
  if (novo === null || novo.trim() === atual) return;
  try {
    await chamarEtiqueta({ acao: 'renomear', coluna, chave, rotulo: novo.trim() });
    await recarregarCatalogos();
    showToast(`✓ Agora é "${novo.trim()}"`, 'ok');
  } catch (e) { showToast(e.message, 'err', 7000); }
}

async function recolorirEtiqueta(coluna, campo, chave, corAtual) {
  const nova = window.prompt('Cor da etiqueta em hexadecimal (ex.: #ff6b00):', corAtual || '#7c8797');
  if (nova === null) return;
  try {
    await chamarEtiqueta({ acao: 'cor', coluna, chave, cor: nova.trim() });
    await recarregarCatalogos();
    showToast('✓ Cor trocada', 'ok');
  } catch (e) { showToast(e.message, 'err', 7000); }
}

async function alternarEtiqueta(coluna, campo, chave, rotulo, ativa) {
  try {
    await chamarEtiqueta({ acao: 'alternar', coluna, chave });
    await recarregarCatalogos();
    showToast(ativa ? `"${rotulo}" desligada — some das escolhas novas` : `✓ "${rotulo}" ligada`, 'ok', 5000);
  } catch (e) { showToast(e.message, 'err', 7000); }
}

async function removerEtiqueta(coluna, campo, chave, rotulo) {
  if (!window.confirm(`Apagar a etiqueta "${rotulo}"? Isto não dá para desfazer.`)) return;
  try {
    await chamarEtiqueta({ acao: 'remover', coluna, chave });
    await recarregarCatalogos();
    showToast(`✓ "${rotulo}" apagada`, 'ok');
  } catch (e) { showToast(e.message, 'info', 9000); }
}

async function criarEtiqueta(coluna, campo) {
  const rotulo = window.prompt(`Nova etiqueta em ${CAMPOS_DE_ESCOLHA[campo].rotulo}:`, '');
  if (!rotulo || !rotulo.trim()) return;
  try {
    await chamarEtiqueta({ acao: 'criar', coluna, rotulo: rotulo.trim() });
    await recarregarCatalogos();
    showToast(`✓ "${rotulo.trim()}" criada`, 'ok');
  } catch (e) { showToast(e.message, 'err', 7000); }
}

function fecharEscolha() {
  document.getElementById('escolha-backdrop')?.remove();
  document.getElementById('escolha-editor')?.remove();
}

async function escolherValor(itemId, campo, chave) {
  fecharEscolha();
  const alvo = findOperationalItem(itemId);
  const escolhida = catalogoDoCampo(campo, alvo).find((o) => o.chave === chave);
  const deuCerto = await salvarCampoDaFicha(itemId, campo, chave, null);
  if (deuCerto) applyOutboundItemPatch(itemId, { [campo]: escolhida?.rotulo || '' }, campo);
}

function linhaDeGrupoHtml(item) {
  const parar = 'event.stopPropagation()';
  const marcada = SELECIONADAS.has(String(item.id));
  const data = (campo, iso, atrasado) =>
    `<input type="date" class="grupo-data-campo${atrasado ? ' is-late' : ''}" value="${safeText(iso || '')}"
       onclick="${parar}" onchange="${parar};salvarDataNaLinha('${item.id}','${campo}',this)"
       title="${campo === 'prazo' ? 'Prazo de produção' : 'Data de veiculação'}">`;
  const escolha = (campo) => `<td onclick="${parar}">${pillEditavel(item, campo)}</td>`;
  return `<tr class="${marcada ? 'marcada' : ''}" onclick="openItemWorkspace('${safeText(item.id)}')" title="Abrir ${safeText(item.nome || '')}">
    <td class="grupo-marcar" onclick="${parar}">
      <input type="checkbox" ${marcada ? 'checked' : ''} aria-label="Selecionar ${safeText(item.nome || '')}"
             onclick="${parar};alternarSelecao('${safeText(item.id)}',this.checked,event)"></td>
    <td class="grupo-id" onclick="${parar};copiarId('${safeText(item.id)}')"
        title="ID da atividade · clique para copiar">${safeText(item.id)}</td>
    <td class="grupo-nome">${safeText(item.nome || 'Sem título')}</td>
    <td>${safeText(item.cliente || '—')}</td>
    <td class="grupo-dono" onclick="${parar}">${ownerEditorTrigger(item)}</td>
    <td onclick="${parar}"><button type="button" class="grupo-pill-btn" onclick="openStatusEditor(event,'${item.id}')"
      title="Trocar status">${pillHtml(item.status || 'Sem status', item.status_color, item.status_border)}</button></td>
    ${COLUNAS_DA_TABELA[quadroDoItem(item)]
        .filter((c) => ['captacao','formato','tipo_conteudo','off_audio','prioridade'].includes(c))
        .map(escolha).join('')}
    <td>${data('prazo', item.prazo_iso, item.prazo_atrasado)}</td>
    <td>${data('veiculacao', item.veiculacao_iso, false)}</td>
  </tr>`;
}

// Shift marca o intervalo, como no Finder e no Monday: clica na primeira, segura
// shift e clica na última. Sem isso, marcar quarenta peças era quarenta cliques.
//
// Usa 'click' e não 'change' de propósito: o evento change não carrega a tecla
// pressionada, então não há como saber que o shift estava segurado.
let ULTIMA_MARCADA = null;

function alternarSelecao(id, marcada, event) {
  const alvo = String(id);
  const lista = itensPorGrupo().flatMap((g) => {
    const visiveis = gruposExpandidos.has(g.id) ? g.itens : g.itens.slice(0, LINHAS_POR_GRUPO);
    return visiveis.map((i) => String(i.id));
  });

  if (event?.shiftKey && ULTIMA_MARCADA && ULTIMA_MARCADA !== alvo) {
    const de = lista.indexOf(ULTIMA_MARCADA);
    const ate = lista.indexOf(alvo);
    if (de >= 0 && ate >= 0) {
      const [ini, fim] = de < ate ? [de, ate] : [ate, de];
      // O intervalo assume o estado do clique: shift-clicando numa marcada,
      // desmarca o trecho inteiro. É o que o Finder faz.
      for (let k = ini; k <= fim; k++) {
        if (marcada) SELECIONADAS.add(lista[k]); else SELECIONADAS.delete(lista[k]);
      }
      ULTIMA_MARCADA = alvo;
      renderVisaoDeGrupos();
      const n = fim - ini + 1;
      showToast(`${marcada ? 'Marcadas' : 'Desmarcadas'} ${n} peças`, 'info', 2500);
      return;
    }
  }

  if (marcada) SELECIONADAS.add(alvo); else SELECIONADAS.delete(alvo);
  ULTIMA_MARCADA = alvo;
  renderVisaoDeGrupos();
}

function selecionarGrupo(groupId, marcar) {
  const quadro = quadroDoGrupo(groupId);
  const cfg = VISAO_DE_GRUPOS[quadro];
  const grupo = itensPorGrupo(cfg.fonte(), cfg.ordem()).find((g) => g.id === groupId);
  if (!grupo) return;
  const visiveis = gruposExpandidos.has(groupId) ? grupo.itens : grupo.itens.slice(0, LINHAS_POR_GRUPO);
  visiveis.forEach((i) => (marcar ? SELECIONADAS.add(String(i.id)) : SELECIONADAS.delete(String(i.id))));
  renderVisaoDeGrupos(quadro);
}

function limparSelecao() { SELECIONADAS.clear(); renderVisaoDeGrupos(); }

async function salvarDataNaLinha(itemId, campo, input) {
  const item = findOperationalItem(itemId);
  const valor = String(input.value || '');
  if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return;
  const fazParteDoLote = SELECIONADAS.size >= 2 && SELECIONADAS.has(String(itemId));
  if (fazParteDoLote) return aplicarDataSelecionadaEmLote(campo, valor, { input, sourceItemId: itemId, confirmar: true });
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

async function aplicarDataSelecionadaEmLote(campo, dateIso, { input = null, sourceItemId = '', confirmar = true } = {}) {
  const ids = [...SELECIONADAS];
  const itens = ids.map(findOperationalItem).filter(Boolean);
  const rotulo = campo === 'prazo' ? 'prazo' : 'veiculação';
  const fonte = sourceItemId ? findOperationalItem(sourceItemId) : null;
  const restaurarFonte = () => {
    if (!input || !fonte) return;
    input.value = (campo === 'prazo' ? fonte.prazo_iso : (isRequestItem(fonte) ? fonte.conclusao_iso : fonte.veiculacao_iso)) || '';
  };
  if (!itens.length) {
    restaurarFonte();
    return showToast('Selecione ao menos uma demanda para alterar a data.', 'info');
  }
  if (itens.length !== ids.length) {
    restaurarFonte();
    return showToast('A seleção contém uma demanda que não está mais disponível. Atualize os dados e tente novamente.', 'err', 7000);
  }
  const invalidos = itens.filter((item) => {
    if (isRequestItem(item)) return false;
    const prazo = campo === 'prazo' ? dateIso : String(item.prazo_iso || '');
    const veiculacao = campo === 'veiculacao' ? dateIso : String(item.veiculacao_iso || '');
    return Boolean(prazo && veiculacao && prazo > veiculacao);
  });
  if (invalidos.length) {
    restaurarFonte();
    return showToast(`Lote bloqueado: ${invalidos.length} demanda${invalidos.length === 1 ? ' ficaria' : 's ficariam'} com o prazo depois da veiculação.`, 'err', 8000);
  }
  if (confirmar && !window.confirm(`Aplicar ${rotulo} ${planningDateBr(dateIso)} nas ${itens.length} demandas selecionadas?`)) {
    restaurarFonte();
    return false;
  }

  if (input) input.disabled = true;
  showToast(`Aplicando ${rotulo} em ${itens.length} demandas…`, 'info', 5000);
  const atualizadas = [];
  const semMudanca = [];
  const falhas = [];
  for (const item of itens) {
    try {
      const mudou = await moverDataDoItem(item, campo, dateIso, {
        request: isRequestItem(item), renderizar: false, avisar: false,
      });
      (mudou ? atualizadas : semMudanca).push(item);
      SELECIONADAS.delete(String(item.id));
    } catch (erro) {
      falhas.push({ item, erro });
      console.warn('Falha ao aplicar data em lote', item.id, erro);
    }
  }

  saveProductionCache();
  renderOutboundItemPatch(`${rotulo} em lote`);
  renderManagerCalendar();
  renderVisaoDeGrupos();
  if (input?.isConnected) input.disabled = false;

  const processadas = atualizadas.length + semMudanca.length;
  if (!falhas.length) {
    const complemento = semMudanca.length ? ` · ${semMudanca.length} já tinha${semMudanca.length === 1 ? '' : 'm'} essa data` : '';
    showToast(`✓ Lote concluído: ${processadas}/${itens.length} demandas processadas${complemento}.`, 'ok', 6000);
  } else {
    showToast(`Lote parcial: ${processadas}/${itens.length} processadas · ${falhas.length} falhou${falhas.length === 1 ? '' : 'ram'}. As falhas continuam selecionadas.`, 'err', 9000);
  }
  return falhas.length === 0;
}

// A mesma visao serve os dois quadros: muda a fonte, o destino e a ordem dos
// grupos. Solicitacoes tem grupos proprios (Novas Demandas, A Fazer, Em
// Execucao, Concluidas) e nunca vao aparecer na ordem de Producao.
const VISAO_DE_GRUPOS = {
  producao: { alvo: 'grupos-board', botao: 'ops-grupos-btn', contador: 'ops-grupos-count',
              fonte: () => (DADOS_ALL?.length ? DADOS_ALL : DADOS || []), ordem: () => ORDEM_DOS_GRUPOS },
  demandas: { alvo: 'grupos-board-demandas', botao: 'demandas-grupos-btn', contador: 'demandas-grupos-count',
              // A lista crua de Solicitacoes fala outro idioma: 'tipo' em vez de
              // 'formato', 'conclusao_iso' em vez de 'veiculacao_iso', e sem
              // board_id. O normalizador que Meu Dia e Modo Foco ja usam faz a
              // traducao — sem ele a tabela lia campos que nao existem.
              fonte: () => (DADOS_DEMANDAS || []).map(normalizeRequestForOperational),
              ordem: () => GRUPOS_DE_DEMANDAS },
};

function renderVisaoDeGrupos(quadro) {
  if (!quadro) { renderVisaoDeGrupos('producao'); renderVisaoDeGrupos('demandas'); return; }
  const cfg = VISAO_DE_GRUPOS[quadro] || VISAO_DE_GRUPOS.producao;
  const wrap = document.getElementById(cfg.alvo);
  const botao = document.getElementById(cfg.botao);
  if (!wrap) return;
  const grupos = itensPorGrupo(cfg.fonte(), cfg.ordem());
  if (botao) {
    const contador = document.getElementById(cfg.contador);
    if (contador) contador.textContent = grupos.length;
  }
  const aberta = quadro === 'demandas' ? gruposDeDemandasAberto : visaoDeGruposAberta;
  if (botao) botao.setAttribute('aria-expanded', String(aberta));
  if (!aberta) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); return; }
  wrap.classList.remove('focus-hidden');

  const peca = (n) => quadro === 'demandas'
    ? (n === 1 ? 'solicitação' : 'solicitações')
    : (n === 1 ? 'conteúdo' : 'conteúdos');

  const blocos = grupos.map(grupo => {
    const recolhido = gruposRecolhidos.has(grupo.id);
    const total = grupo.itens.length;
    const mostrarTodos = gruposExpandidos.has(grupo.id);
    const visiveis = mostrarTodos ? grupo.itens : grupo.itens.slice(0, LINHAS_POR_GRUPO);
    const restam = total - visiveis.length;
    const todasMarcadas = visiveis.length > 0 && visiveis.every((i) => SELECIONADAS.has(String(i.id)));
    const corpo = recolhido ? '' : `
      <div class="grupo-tabela-rolagem">
        <table class="grupo-tabela">
          <thead><tr>
            <th class="grupo-marcar"><input type="checkbox" ${todasMarcadas ? 'checked' : ''}
              aria-label="Selecionar tudo em ${safeText(grupo.nome)}"
              onchange="selecionarGrupo('${grupo.id}',this.checked)"></th>
            ${COLUNAS_DA_TABELA[quadro].map((c) => cabecalhoOrdenavel(c, quadro)).join('')}</tr></thead>
          <tbody>${visiveis.map(linhaDeGrupoHtml).join('')}</tbody>
        </table>
      </div>
      ${restam > 0 ? `<button type="button" class="grupo-ver-mais" onclick="verGrupoInteiro('${grupo.id}')">Mostrar os outros ${restam} ${peca(restam)}</button>` : ''}`;
    return `<section class="grupo-bloco ${recolhido ? 'recolhido' : ''}" style="--cor-grupo:${corDeQualquerGrupo(grupo.id)}">
      <button type="button" class="grupo-cabeca" onclick="toggleGrupo('${grupo.id}')" aria-expanded="${!recolhido}">
        <span class="grupo-seta chevron ${recolhido ? 'fechado' : ''}"></span>
        <span class="grupo-titulo"><b>${safeText(grupo.nome)}</b><small>${total} ${peca(total)}</small></span>
      </button>${corpo}</section>`;
  }).join('');

  const totalGeral = grupos.reduce((soma, g) => soma + g.itens.length, 0);
  // Some quando não há nada marcado: barra de ação vazia é ruído permanente.
  const barra = SELECIONADAS.size ? `<div class="grupos-lote">
      <b>${SELECIONADAS.size} selecionada${SELECIONADAS.size === 1 ? '' : 's'}</b>
      <button type="button" onclick="loteStatus(event)">Status…</button>
      ${quadro === 'demandas' ? '' : '<button type="button" onclick="loteCaptacao(event)">Captação…</button>'}
      <button type="button" onclick="lotePrazo('prazo')">Prazo…</button>
      <button type="button" onclick="lotePrazo('veiculacao')">Veiculação…</button>
      <button type="button" class="quieto" onclick="limparSelecao()">Limpar</button>
    </div>` : '';
  wrap.innerHTML = `${barra}<div class="grupos-head">
      <div><div class="grupos-kicker">Operação · Por etapa</div>
        <div class="grupos-titulo">${quadro === 'demandas' ? 'Solicitações' : 'Conteúdos'} por grupo</div>
        <div class="grupos-sub">A mesma divisão do board: clique num grupo para recolher, clique numa linha para abrir a atividade.</div></div>
      <div class="grupos-total"><b>${totalGeral}</b><span>${quadro === 'demandas' ? 'solicitações' : 'conteúdos'}${selectedPersonIds.size ? ' no filtro atual' : ''}</span></div>
    </div>${blocos || `<div class="grupos-vazio">Nenhum${quadro === 'demandas' ? 'a solicitação carregada' : ' conteúdo carregado'} ainda.</div>`}`;
}

// ── ações em lote ────────────────────────────────────────────────────────────
//
// Cada peça é gravada por uma chamada, não por uma "mutation em massa": o
// servidor já sabe fazer uma, e o histórico de cada peça continua registrando o
// que aconteceu com ela. Se uma falhar, as outras seguem — e a conta no fim diz
// quantas passaram e quantas não.

async function aplicarEmLote(rotulo, executar) {
  const ids = [...SELECIONADAS];
  if (!ids.length) return;
  if (!window.confirm(`Aplicar ${rotulo} em ${ids.length} peça${ids.length === 1 ? '' : 's'}?`)) return;
  showToast(`Aplicando ${rotulo} em ${ids.length}…`, 'info', 4000);
  let ok = 0;
  const falhas = [];
  for (const id of ids) {
    const item = findOperationalItem(id);
    if (!item) { falhas.push(id); continue; }
    try { await executar(item); ok += 1; }
    catch (erro) { falhas.push(item.nome || id); console.warn('lote falhou em', id, erro); }
  }
  SELECIONADAS.clear();
  renderVisaoDeGrupos();
  if (!falhas.length) showToast(`✓ ${rotulo} aplicado em ${ok} peça${ok === 1 ? '' : 's'}`, 'ok', 5000);
  else showToast(`${ok} atualizada${ok === 1 ? '' : 's'} · ${falhas.length} falhou: ${falhas.slice(0, 3).join(', ')}`, 'info', 8000);
}

function loteStatus(event) {
  const opcoes = (typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : []) || [];
  if (!opcoes.length) return showToast('As opções de status ainda estão carregando.', 'info');
  abrirMenuDeLote(event, 'Status para todas', opcoes.map((o) => ({
    rotulo: o.label, cor: o.color,
    aplicar: (item) => tentarEscritaDupla(item, { acao: 'status', item: String(item.id), para: chaveDeStatus(o.label) })
      .then((feito) => { if (!feito) throw new Error('gravação recusada'); applyOutboundItemPatch(item.id,
        { status: o.label, status_color: o.color, status_border: o.border, status_index: o.index }, 'status em lote'); }),
  })), 'status');
}

function loteCaptacao(event) {
  if (!CATALOGO_CAPTACAO.length) return showToast('As opções de captação ainda estão carregando.', 'info');
  abrirMenuDeLote(event, 'Captação para todas', CATALOGO_CAPTACAO.filter((c) => c.ativa).map((c) => ({
    rotulo: c.rotulo, cor: c.cor,
    aplicar: async (item) => {
      const deu = await salvarCampoDaFicha(item.id, 'captacao', c.chave, null);
      if (!deu) throw new Error('gravação recusada');
      applyOutboundItemPatch(item.id, { captacao: c.rotulo }, 'captação em lote');
    },
  })), 'captação');
}

function lotePrazo(campo) {
  const rotulo = campo === 'prazo' ? 'prazo' : 'veiculação';
  const hoje = new Date().toISOString().slice(0, 10);
  const data = window.prompt(`Nova ${rotulo} para as ${SELECIONADAS.size} selecionadas (AAAA-MM-DD):`, hoje);
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.trim())) {
    if (data !== null) showToast('Data inválida; use AAAA-MM-DD.', 'info');
    return;
  }
  aplicarDataSelecionadaEmLote(campo, data.trim(), { confirmar: true });
}

// Mesmo popover do resto do painel, com a lista que a ação pediu.
function abrirMenuDeLote(event, titulo, opcoes, rotuloAcao) {
  event.preventDefault();
  event.stopPropagation();
  document.getElementById('lote-editor-backdrop')?.remove();
  document.getElementById('lote-editor')?.remove();
  const rect = event.currentTarget.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'lote-editor-backdrop';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharMenuDeLote;
  const menu = document.createElement('div');
  menu.id = 'lote-editor';
  menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">${safeText(titulo)}</div>`;
  opcoes.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'status-editor-option';
    b.innerHTML = `<span class="status-editor-dot" style="background:${o.cor || '#7c8797'};color:${o.cor || '#7c8797'}"></span><span>${safeText(o.rotulo)}</span>`;
    b.onclick = () => { fecharMenuDeLote(); aplicarEmLote(`${rotuloAcao} "${o.rotulo}"`, o.aplicar); };
    menu.appendChild(b);
  });
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
}

function fecharMenuDeLote() {
  document.getElementById('lote-editor-backdrop')?.remove();
  document.getElementById('lote-editor')?.remove();
}

// O ID é o que identifica a peça em qualquer lugar — no Monday, no banco, numa
// conversa no WhatsApp. Não aparecia em canto nenhum da tela.
async function copiarId(id) {
  try { await navigator.clipboard.writeText(String(id)); showToast(`ID ${id} copiado`, 'ok', 2500); }
  catch { showToast(`ID da atividade: ${id}`, 'info', 5000); }
}

// ─── Trocar de grupo ──────────────────────────────────────────────────────────
// Mover uma peça de etapa (voltar para Redação, mandar para Design) só existia
// dentro das automações. Pelo painel não tinha conserto: peça no grupo errado
// ficava no grupo errado. O servidor já sabia fazer (acao 'grupo'); faltava a
// porta.

// Produção lê na ordem do board. Demandas tem grupos próprios — o mesmo item
// nunca vê as duas listas, então cada board mostra só a sua.
const GRUPOS_DE_DEMANDAS = ['group_mm187437', 'novo_grupo_mkmkjdqd',
                            'novo_grupo_mkkyfhtw', 'novo_grupo_mkkyx8pv'];
const TITULO_DOS_GRUPOS = {
  ...(typeof GROUP_MAP === 'object' ? GROUP_MAP : {}),
  group_mm187437:      'Novas Demandas/Ideias',
  novo_grupo_mkmkjdqd: 'A Fazer',
  novo_grupo_mkkyfhtw: 'Em Execução',
  novo_grupo_mkkyx8pv: 'Concluídas',
};
const CORES_GRUPOS_DEMANDAS = {
  group_mm187437:      '#a25ddc',
  novo_grupo_mkmkjdqd: '#579bfc',
  novo_grupo_mkkyfhtw: '#fdab3d',
  novo_grupo_mkkyx8pv: '#00c875',
};
const ehItemDeDemanda = (item) => String(item?.board_id || '') === String(
  typeof BOARD_DEMANDAS_ID !== 'undefined' ? BOARD_DEMANDAS_ID : '');
const gruposDoItem = (item) => (ehItemDeDemanda(item) ? GRUPOS_DE_DEMANDAS : ORDEM_DOS_GRUPOS);
const tituloDoGrupo = (id) => TITULO_DOS_GRUPOS[id] || 'Sem grupo';
const corDeQualquerGrupo = (id) => CORES_GRUPOS_DEMANDAS[id] || corDoGrupo(id);

function botaoDeGrupo(item) {
  const id = String(item.group_id || '');
  const cor = corDeQualquerGrupo(id);
  return `<button type="button" class="cr-grupo-pill" onclick="abrirSeletorDeGrupo(event,'${safeText(item.id)}')"
    style="--g:${cor}" title="Mover de grupo"><span class="status-editor-dot" style="background:${cor}"></span>${
    safeText(tituloDoGrupo(id))}</button>`;
}

function fecharSeletorDeGrupo() {
  document.getElementById('grupo-editor-fundo')?.remove();
  document.getElementById('grupo-editor')?.remove();
}

function abrirSeletorDeGrupo(event, itemId) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  fecharSeletorDeGrupo();
  const item = findOperationalItem(itemId)
    || (DADOS_DEMANDAS || []).find((d) => String(d.id) === String(itemId));
  if (!item) return showToast('Atividade não encontrada.', 'err');
  const atual = String(item.group_id || '');
  const rect = (event.currentTarget || event.target).getBoundingClientRect();

  const fundo = document.createElement('div');
  fundo.id = 'grupo-editor-fundo';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharSeletorDeGrupo;

  const menu = document.createElement('div');
  menu.id = 'grupo-editor';
  menu.className = 'status-editor';
  menu.innerHTML = '<div class="status-editor-head">Mover para</div>'
    + gruposDoItem(item).map((id) => {
        const cor = corDeQualquerGrupo(id);
        return `<button type="button" class="status-editor-option ${id === atual ? 'current' : ''}"
          onclick="moverPecaDeGrupo('${safeText(item.id)}','${id}')">
          <span class="status-editor-dot" style="background:${cor}"></span>${safeText(tituloDoGrupo(id))}
          <span class="status-editor-check">${id === atual ? '✓' : ''}</span></button>`;
      }).join('');
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
}

async function moverPecaDeGrupo(itemId, grupoId) {
  const item = findOperationalItem(itemId)
    || (DADOS_DEMANDAS || []).find((d) => String(d.id) === String(itemId));
  if (!item) return showToast('Atividade não encontrada.', 'err');
  if (String(item.group_id || '') === String(grupoId)) return fecharSeletorDeGrupo();
  const de = tituloDoGrupo(String(item.group_id || ''));
  const para = tituloDoGrupo(grupoId);
  fecharSeletorDeGrupo();

  const gravou = await tentarEscritaDupla(item, {
    acao: 'grupo', item: String(item.id), grupo_id: String(grupoId),
  });
  if (!gravou) {
    try {
      await mondayQuery(
        `mutation($item: ID!, $grupo: String!) { move_item_to_group(item_id: $item, group_id: $grupo) { id } }`,
        { item: String(item.id), grupo: String(grupoId) }
      );
    } catch (erro) {
      return showToast(`Não foi possível mover de grupo: ${erro.message}`, 'err', 7000);
    }
  }
  // O grupo vive em dois campos (id e título) e a visão de grupos lê os dois.
  [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach((lista) => (lista || []).forEach((d) => {
    if (String(d.id) !== String(item.id)) return;
    d.group_id = String(grupoId);
    d.grupo = para;
  }));
  showToast(`✓ ${de} → ${para}`, 'ok');
  if (typeof renderIntegratedOperationalViews === 'function') renderIntegratedOperationalViews();
  if (document.getElementById('cartao-rapido')) fecharCartaoRapido();
}

// ─── Grupos e calendário na aba Solicitações ─────────────────────────────────
// A aba so tinha semana, dia e esteira: para ver tudo dividido por etapa do
// quadro, ou espalhado num mes, era preciso ir ao Monday. A visao de grupos ja
// existia para Producao e passou a aceitar o quadro como parametro; o
// calendario ja somava os dois quadros e passou a aceitar um recorte.
let gruposDeDemandasAberto = false;
let agendaDeDemandasAberta = false;

function alternarGruposDeDemandas() {
  gruposDeDemandasAberto = !gruposDeDemandasAberto;
  if (gruposDeDemandasAberto) { agendaDeDemandasAberta = false; renderAgendaDeDemandas(); }
  renderVisaoDeGrupos('demandas');
}

function alternarAgendaDeDemandas() {
  agendaDeDemandasAberta = !agendaDeDemandasAberta;
  if (agendaDeDemandasAberta) { gruposDeDemandasAberto = false; renderVisaoDeGrupos('demandas'); }
  renderAgendaDeDemandas();
}

function renderAgendaDeDemandas() {
  const wrap = document.getElementById('agenda-board-demandas');
  const botao = document.getElementById('demandas-agenda-btn');
  if (!wrap) return;
  const meta = managerCalendarMonthMeta();
  const itens = managerCalendarItems({ ignorarCliente: true, apenas: 'request' });
  const contador = document.getElementById('demandas-agenda-count');
  if (contador) contador.textContent = itens.filter(i => meta.cells.some(c => c.iso === i.calendarDateIso)).length;
  if (botao) botao.setAttribute('aria-expanded', String(agendaDeDemandasAberta));
  if (!agendaDeDemandasAberta) { wrap.innerHTML = ''; wrap.classList.add('focus-hidden'); return; }
  wrap.classList.remove('focus-hidden');

  const porDia = new Map();
  itens.forEach(i => {
    if (!porDia.has(i.calendarDateIso)) porDia.set(i.calendarDateIso, []);
    porDia.get(i.calendarDateIso).push(i);
  });
  const dias = ['seg','ter','qua','qui','sex','sáb','dom'];
  wrap.innerHTML = `<section class="manager-calendar-shell">
    <div class="manager-calendar-toolbar">
      <span class="manager-calendar-month-label">${safeText(meta.label || '')}</span>
      <span class="manager-calendar-status">${itens.length} solicitaç${itens.length === 1 ? 'ão' : 'ões'} com data</span>
    </div>
    <div class="manager-calendar-grid">
      ${dias.map(d => `<div class="manager-calendar-weekday">${d}</div>`).join('')}
      ${meta.cells.map(cell => {
        const doDia = porDia.get(cell.iso) || [];
        return `<div class="manager-calendar-day ${cell.outside ? 'outside' : ''} ${cell.iso === (HOJE_ISO || '') ? 'today' : ''}">
          <div class="manager-calendar-day-head"><b>${cell.day}</b>${doDia.length ? `<small>${doDia.length}</small>` : ''}</div>
          ${doDia.slice(0, 4).map(i => `<button type="button" class="manager-calendar-item"
              style="--cor-item:${corDeStatus(i.status)?.cor || '#7c8797'}"
              onclick="abrirCartaoRapido('${safeText(i.id)}',event,'request')"
              title="${safeText(i.cliente || '')} · ${safeText(i.nome || '')}">
              <span class="manager-calendar-client">${safeText(i.cliente || 'Sem cliente')}</span>
              <span class="manager-calendar-name">${safeText(i.nome || 'Sem título')}</span></button>`).join('')}
          ${doDia.length > 4 ? `<span class="manager-calendar-more">+${doDia.length - 4}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
  </section>`;
}
