// vybe-perfis.js — perfis, modos de uso, ordenação e filtros
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Perfis e modos de uso ───────────────────────────────────────────────────
const FOCUS_ACTIVE_IDS = new Set([PESSOAS.PAULO,PESSOAS.VINICIUS,PESSOAS.EWERTON_L,PESSOAS.RERISTON,PESSOAS.DEIVID,PESSOAS.BEATRIZ,PESSOAS.TAINARA,PESSOAS.BRENO,PESSOAS.EDUARDO,PESSOAS.JADY]);
const DA_CONTROLLER_TEAM_IDS = Object.freeze([...EQUIPES.design, ...EQUIPES.audiovisual]);
const DA_CONTROLLER_ROLES = Object.freeze({[PESSOAS.DEIVID]:'Direção de Arte',[PESSOAS.BEATRIZ]:'Designer',[PESSOAS.JADY]:'Designer Jr.',[PESSOAS.RERISTON]:'Edição & Motion'});
let panelMode = 'gestor';
let focusUserId = '';
let daControllerPeriod = 'week';
let daControllerDateMode = 'prazo';
let daControllerPersonId = 'all';
let daControllerDayFocusIso = '';
let pendingDaDirectionItemId = '';

function getStorage(key) { try { return localStorage.getItem(key) || ''; } catch(e) { return ''; } }
function setStorage(key, value) { try { localStorage.setItem(key, value); } catch(e) {} }
function focusUser() { return TEAM_USERS.find(u => u.id === focusUserId) || null; }

function operatorAssignedItems(userId) {
  const key=String(userId); const source=unifiedOperationalItems();
  return source.filter(d => assignedIds(d).some(id=>String(id)===key) && !isFinishedItem(d));
}
function operatorOperationalSignal(userId) {
  const items = operatorAssignedItems(userId);
  const critical = items.filter(d => ['critical','high'].includes((d.operational_risk || getOperationalRisk(d)).level));
  const inProgress = items.filter(d => String(d.status || '').toLowerCase() === 'em andamento');
  const waiting = items.filter(d => SLA_STATUS_HOURS[d.status]);
  const lead = critical[0] || inProgress[0] || waiting[0] || items[0] || null;
  if (!lead) return { total:0, critical:0, waiting:0, status:'SEM FILA', detail:'Nenhuma tarefa ativa', color:'#80654d', kind:'idle' };
  if (critical.length) return { total:items.length, critical:critical.length, waiting:waiting.length, status:'ATENÇÃO', detail:`${critical.length} prazo${critical.length > 1 ? 's' : ''} crítico${critical.length > 1 ? 's' : ''}`, color:'#ff637a', kind:'critical' };
  if (inProgress.length) return { total:items.length, critical:0, waiting:waiting.length, status:'EM EXECUÇÃO', detail:`${items.length} tarefa${items.length > 1 ? 's' : ''} ativa${items.length > 1 ? 's' : ''}`, color:lead.status_color || '#ff9d00', kind:'working' };
  if (waiting.length) return { total:items.length, critical:0, waiting:waiting.length, status:safeText(lead.status || 'AGUARDANDO').toUpperCase(), detail:`${waiting.length} dependência${waiting.length > 1 ? 's' : ''} em espera`, color:lead.status_color || '#9d50dd', kind:'waiting' };
  return { total:items.length, critical:0, waiting:0, status:safeText(lead.status || 'ATIVO').toUpperCase(), detail:`${items.length} tarefa${items.length > 1 ? 's' : ''} na fila`, color:lead.status_color || '#ff9d00', kind:'queued' };
}
function pulseItemsFor(userId, kind) {
  const items = operatorAssignedItems(userId);
  const byRisk = (a,b) => ((a.operational_risk || getOperationalRisk(a)).score - (b.operational_risk || getOperationalRisk(b)).score) || priorityData(a).score - priorityData(b).score;
  if (kind === 'attention') return items.filter(d => ['critical','high'].includes((d.operational_risk || getOperationalRisk(d)).level)).sort(byRisk);
  if (kind === 'waiting') return items.filter(d => SLA_STATUS_HOURS[d.status]).sort(byRisk);
  return items.sort(byRisk);
}
function pulseRows(kind) {
  return TEAM_USERS.filter(u => FOCUS_ACTIVE_IDS.has(u.id)).map(user => {
    const items = pulseItemsFor(user.id, kind);
    return items.length ? { user, item:items[0], count:items.length } : null;
  }).filter(Boolean).sort((a,b) => b.count - a.count || priorityData(a.item).score - priorityData(b.item).score);
}
function openPulseContext(event, itemId) { event.stopPropagation(); openItemWorkspace(String(itemId)); }
function pulseDetailHtml(kind, label, description, color) {
  const rows = pulseRows(kind);
  const preview = rows.slice(0,3);
  const list = preview.map(({user,item,count}) => {
    const avatar = user.photo ? `<img src="${user.photo}" alt="${safeText(user.name)}">` : `<span class="pulse-detail-avatar" style="--pulse-color:${user.color};background:${user.color}">${safeText(firstName(user.name).slice(0,2).toUpperCase())}</span>`;
    const task = kind === 'attention' ? `${item.nome} · ${item.operational_risk?.label || getOperationalRisk(item).label}` : kind === 'waiting' ? `${item.nome} · ${item.status}` : `${item.nome} · ${count} na fila`;
    return `<div class="pulse-detail-row">${avatar}<div class="pulse-detail-copy"><span class="pulse-detail-user">${safeText(firstName(user.name))}</span><span class="pulse-detail-task">${safeText(task)}</span><button type="button" class="pulse-detail-open" onclick="openPulseContext(event,'${item.id}')">Abrir contexto →</button></div></div>`;
  }).join('') || `<div class="pulse-detail-more">Nenhuma atividade encontrada neste momento.</div>`;
  return `<div class="pulse-detail"><div class="pulse-detail-head"><span>${safeText(label)}</span><span>${safeText(description)}</span></div>${list}${rows.length > 3 ? `<div class="pulse-detail-more">+ ${rows.length - 3} operador${rows.length - 3 > 1 ? 'es' : ''} neste sinal</div>` : ''}</div>`;
}
function renderIdentityOperationalPulse() {
  const target = document.getElementById('identity-pulse');
  if (!target) return;
  const activeRows = pulseRows('active'), attentionRows = pulseRows('attention'), waitingRows = pulseRows('waiting');
  const item = (label, rows, extra='') => `<div class="identity-pulse-item ${extra}" title="${safeText(label)}: ${rows.length} operadores"><b>${rows.length}</b><span>${label}</span></div>`;
  target.innerHTML = `${item('com fila',activeRows)}${item('em atenção',attentionRows,'critical')}${item('em espera',waitingRows,'waiting')}<div class="identity-pulse-caption">PULSO OPERACIONAL / DADOS AO VIVO</div>`;
}
function renderFocusUserPicker() {
  const grid = document.getElementById('focus-user-grid');
  if (!grid) return;
  // Todo mundo vê a equipe toda: as estações são abertas por decisão da Vybe.
  // A pessoa logada vem primeiro, para quem entrou achar a própria fila sem
  // procurar — conveniência, não restrição.
  const eu = meuFoco();
  const users = TEAM_USERS.filter((u) => FOCUS_ACTIVE_IDS.has(u.id))
    .sort((a, b) => (a.id === eu ? -1 : 0) - (b.id === eu ? -1 : 0));
  grid.innerHTML = users.map(user => {
    const signal = operatorOperationalSignal(user.id);
    const avatar = user.photo
      ? `<img class="focus-user-avatar" src="${user.photo}" alt="${safeText(user.name)}" onerror="this.outerHTML='<span class=focus-user-avatar-fallback style=background:${user.color}>${user.name.slice(0,2).toUpperCase()}</span>'">`
      : `<span class="focus-user-avatar-fallback" style="background:${user.color}">${user.name.slice(0,2).toUpperCase()}</span>`;
    return `<button class="focus-user-card" style="--user-color:${user.color};--operator-signal:${signal.color}" onclick="chooseFocusUser('${user.id}')">${avatar}<span>${safeText(firstName(user.name))}</span><small class="operator-work-status">${safeText(signal.status)}</small><small class="operator-work-signal">${safeText(signal.detail)}</small></button>`;
  }).join('');
}

function daControllerTeam() { return TEAM_USERS.filter(user => DA_CONTROLLER_TEAM_IDS.includes(user.id)); }
let daCurrentContextBar='';
// Disciplinas operacionais: vídeo/motion é uma célula própria; design é distribuído entre Deivid, Beatriz e Jady.
const DA_DISCIPLINES={audiovisual:{key:'audiovisual',label:'AUDIOVISUAL',short:'VÍDEO & MOTION',color:'#ff8b2b',members:EQUIPES.audiovisual},design:{key:'design',label:'DESIGN',short:'CARDS, FOTOS & CARROSSÉIS',color:'#ff5f8f',members:EQUIPES.design}};
function daDisciplineForUser(user){ const id=String(user?.id||''); return DA_DISCIPLINES.audiovisual.members.includes(id)?DA_DISCIPLINES.audiovisual:DA_DISCIPLINES.design; }
function daDisciplineForItem(item){ const owner=daControllerTeam().find(user=>assignedIds(item).includes(user.id)); return daDisciplineForUser(owner); }
function daEffortWeight(item,user){ const format=String(daTacticalFormat(item)).toLowerCase(); const discipline=daDisciplineForUser(user);
  if(discipline.key==='audiovisual') return /reels|vídeo|video|motion/.test(format)?3:2;
  return /carrossel/.test(format)?2:1;
}
function daWorkType(item,user) {
  const format=String(daTacticalFormat(item)).toLowerCase(); const discipline=daDisciplineForUser(user);
  if(discipline.key==='audiovisual') {
    if(/motion/.test(format)) return 'Motion';
    if(/capta|fotografia|foto/.test(format)) return 'Captação';
    if(/reels|vídeo|video/.test(format)) return 'Edição / Reels';
    return 'Audiovisual';
  }
  if(/carrossel/.test(format)) return 'Carrosséis';
  if(/fotografia|foto/.test(format)) return 'Fotografia';
  if(/card/.test(format)) return 'Cards';
  return 'Design geral';
}
function daCapacitySignal(user,items){ const discipline=daDisciplineForUser(user); const workload=items.reduce((sum,item)=>sum+daEffortWeight(item,user),0); const active=items.filter(item=>operationalFlowStatus(item)==='Em andamento').length; const late=items.filter(item=>daControllerRisk(item)?.level==='critical').length; const blocked=items.filter(daControllerBlocked).length; const threshold=discipline.key==='audiovisual'?24:14; const state=workload>=threshold?'saturada':workload>=Math.round(threshold*.7)?'atenção':'estável'; const composition={}; items.forEach(item=>{const type=daWorkType(item,user); composition[type]=(composition[type]||0)+daEffortWeight(item,user);}); const types=Object.entries(composition).sort((a,b)=>b[1]-a[1]); return {discipline,workload,active,late,blocked,threshold,state,composition,types}; }
function daControllerDate(item) { return daControllerDateMode === 'veiculacao' ? (item.veiculacao_iso || '') : (item.prazo_iso || ''); }
function daControllerDateLabel(item) { return daControllerDateMode === 'veiculacao' ? (item.veiculacao || 'Sem veiculação') : (item.prazo || 'Sem prazo'); }
function daControllerSource() { const source=unifiedOperationalItems(); return source.filter(item => !isFinishedItem(item) && hasAnyAssignment(item, DA_CONTROLLER_TEAM_IDS)); }
function daControllerIsoAt(baseIso, delta) { const date=new Date(`${baseIso}T12:00:00`); date.setDate(date.getDate()+delta); return date.toISOString().slice(0,10); }
function daControllerPeriodRange() {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  if (daControllerPeriod === 'day') return {start:today,end:today,label:'Hoje'};
  if (daControllerPeriod === 'month') { const start=`${today.slice(0,7)}-01`; const end=new Date(`${today.slice(0,7)}-01T12:00:00`); end.setMonth(end.getMonth()+1); end.setDate(0); return {start,end:end.toISOString().slice(0,10),label:'Este mês'}; }
  const date=new Date(`${today}T12:00:00`); const weekday=date.getDay() || 7; const start=daControllerIsoAt(today,1-weekday); return {start,end:daControllerIsoAt(start,6),label:'Esta semana'};
}
function daControllerInPeriod(item, range=daControllerPeriodRange()) { const date=daControllerDate(item); return Boolean(date && date >= range.start && date <= range.end); }
function daControllerRisk(item) { const today=HOJE_ISO || new Date().toISOString().slice(0,10); const tomorrow=daControllerIsoAt(today,1); const date=daControllerDate(item); const flowStatus=operationalFlowStatus(item); if (!date) return null; if (date < today && !['Para agendar','Agendado'].includes(flowStatus)) return {level:'critical',label:'Atrasado'}; if (date === today && !['Para agendar','Agendado'].includes(flowStatus)) return {level:'high',label:'Hoje'}; if (date === tomorrow && !['Para agendar','Agendado'].includes(flowStatus)) return {level:'attention',label:'Amanhã'}; return null; }
function daControllerRiskHtml(item) { const risk=daControllerRisk(item); if (!risk) return ''; const mark=risk.level==='critical'?'⚑':risk.level==='high'?'!':'◌'; return `<span class="risk-level ${risk.level}">${mark} ${risk.label}</span>`; }
function daControllerItemsFor(userId='all') { const items=daControllerSource(); return userId==='all' ? items : items.filter(item => assignedIds(item).includes(userId)); }
function daControllerBlocked(item) { return ['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(operationalFlowStatus(item)); }
function daStatusClock(item) { const today=HOJE_ISO || new Date().toISOString().slice(0,10); const ctx=item?.status_context||null; const sameStatus=ctx?.target && String(ctx.target).trim().toLowerCase()===String(item?.status||'').trim().toLowerCase(); const timestamp=sameStatus ? ctx.created_at : (item?.updated_at || ''); if(!timestamp) return {days:null,source:'indefinido',label:'Sem dado de movimento'}; const ref=new Date(timestamp); if(Number.isNaN(ref.getTime())) return {days:null,source:'indefinido',label:'Sem dado de movimento'}; const now=new Date(`${today}T12:00:00`); const days=Math.max(0,Math.floor((now-ref)/86400000)); const source=sameStatus?'status':'atualização'; const label=days===0?'ATUALIZADO HOJE':source==='status'?`${days}D NO STATUS`:`${days}D SEM MOVIMENTO`; return {days,source,label}; }
function daCriticalEscalation(item) { const today=HOJE_ISO || new Date().toISOString().slice(0,10); const date=daControllerDate(item); const overdueDays=date && date<today ? Math.max(1,Math.floor((new Date(`${today}T12:00:00`)-new Date(`${date}T12:00:00`))/86400000)) : 0; const clock=daStatusClock(item); const blocked=daControllerBlocked(item) || ['Para aprovação','Ag. Aprovação Cliente'].includes(operationalFlowStatus(item)); const extreme=blocked && (overdueDays>=14 || (clock.source==='status' && clock.days>=7)); const critical=blocked && !extreme && (overdueDays>=7 || (clock.source==='status' && clock.days>=4)); return {level:extreme?'extreme':critical?'critical':null,overdueDays,clock,blocked,label:extreme?'EXTREMA URGÊNCIA':critical?'ESCALAÇÃO CRÍTICA':''}; }
function daStatusAgeTag(item) { const clock=daStatusClock(item); if(clock.days===null) return ''; const escal=daCriticalEscalation(item); const className=escal.level==='extreme' ? 'extreme' : (escal.level==='critical' ? 'critical' : ''); return `<span class="da-status-age ${className}"><i></i>${safeText(clock.label)}</span>`; }
function daControllerPriority(item) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const date=daControllerDate(item) || '9999-12-31';
  const statusWeight={'Em andamento':0,'Pode Fazer':1,'A Fazer':2,'Alteração':3,'Falta D.A':4,'Falta Info':5,'Aguardo':6,'Para aprovação':7,'Ag. Aprovação Cliente':7,'Ag. Interno':7,'Para agendar':8,'Agendado':9};
  const urgency=date < today ? 0 : date === today ? 1 : 2;
  return urgency*20 + (statusWeight[operationalFlowStatus(item)] ?? 12);
}
function daControllerPersonMetrics(user) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const items=daControllerItemsFor(user.id); const range=daControllerPeriodRange(); const period=items.filter(item => daControllerInPeriod(item,range));   const active=items.filter(item => operationalFlowStatus(item) === 'Em andamento'); const late=items.filter(item => {const date=daControllerDate(item); return Boolean(date && date < today && !['Para agendar','Agendado'].includes(operationalFlowStatus(item)));}); const blocked=items.filter(daControllerBlocked); const signal=operatorOperationalSignal(user.id);
  const capacity=daCapacitySignal(user,period);
  return {items,period,active,late,blocked,signal,capacity};
}
let DA_METRIC_DETAIL_STATE={scopeType:'discipline',scopeId:'design',metric:'overview'};
function daMetricScopeUsers(scopeType,scopeId,team=daControllerTeam()){ return scopeType==='person' ? team.filter(user=>String(user.id)===String(scopeId)) : team.filter(user=>daDisciplineForUser(user).key===scopeId); }
function daMetricScopeLabel(scopeType,scopeId,team=daControllerTeam()){ if(scopeType==='person'){ const user=team.find(entry=>String(entry.id)===String(scopeId)); return user?.name||'Pessoa não identificada'; } return DA_DISCIPLINES?.[scopeId]?.label||'Disciplina'; }
function daMetricEntries(scopeType,scopeId,metric='overview',team=daControllerTeam()){
  const selectedMetrics=metric==='overview'?['effort','blocked','late']:[metric]; const entries=[];
  daMetricScopeUsers(scopeType,scopeId,team).forEach(user=>{ const metrics=daControllerPersonMetrics(user); const sources={effort:metrics.period,blocked:metrics.blocked,late:metrics.late}; selectedMetrics.forEach(kind=>{ (sources[kind]||[]).forEach(item=>entries.push({item,user,kind,points:kind==='effort'?daEffortWeight(item,user):0})); }); });
  return entries.sort((a,b)=>{ const rank={blocked:0,late:1,effort:2}; const byKind=rank[a.kind]-rank[b.kind]; if(byKind) return byKind; if(a.kind==='effort') return b.points-a.points||daTacticalScore(a.item)-daTacticalScore(b.item); return daTacticalScore(a.item)-daTacticalScore(b.item); });
}
function daMetricContext(entry){ const item=entry.item; if(entry.kind==='effort') return `${entry.points} ponto${entry.points===1?'':'s'} · ${daWorkType(item,entry.user)}`; if(entry.kind==='late'){ const date=daControllerDate(item)||'Sem data'; return `${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'} ${date} · ${daControllerRisk(item)?.label||'Atrasado'}`; } return item?.status_context?.reason || daTacticalActionInfo(item).copy || 'Há uma dependência ou decisão pendente nesta etapa.'; }
function daMetricSummary(scopeType,scopeId,team=daControllerTeam()){
  const effort=daMetricEntries(scopeType,scopeId,'effort',team); const blocked=daMetricEntries(scopeType,scopeId,'blocked',team); const late=daMetricEntries(scopeType,scopeId,'late',team); return {effort,blocked,late,points:effort.reduce((sum,entry)=>sum+entry.points,0)};
}
function closeDaMetricDetail(immediate=false){ const overlay=document.getElementById('da-metric-detail-overlay'); if(!overlay) return; if(immediate){ overlay.remove(); return; } overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
function daBindMetricDrilldowns(team=daControllerTeam()){
  const disciplines=Object.values(DA_DISCIPLINES||{}); document.querySelectorAll('#da-controller-dashboard .da-discipline-card').forEach((card,index)=>{ const discipline=disciplines[index]; if(!discipline) return; card.classList.add('drilldown'); card.setAttribute('role','button'); card.setAttribute('tabindex','0'); card.setAttribute('title',`Abrir composição de esforço, bloqueios e atrasos de ${discipline.label}`); const open=()=>openDaMetricDetail('discipline',discipline.key,'overview'); card.onclick=open; card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}}; if(!card.querySelector('.da-discipline-detail-cta')){ const cta=document.createElement('span'); cta.className='da-discipline-detail-cta'; cta.textContent='Detalhar →'; cta.onclick=event=>{event.stopPropagation();open();}; card.appendChild(cta); } });
  document.querySelectorAll('#da-controller-dashboard .da-capacity-card').forEach((card,index)=>{ if(card.closest('.da-cell-filter-grid')) return; const user=team[index]; if(!user) return; if(card.querySelector('.da-capacity-detail-cta')) return; const cta=document.createElement('span'); cta.className='da-capacity-detail-cta'; cta.textContent='Detalhar carga ↗'; cta.setAttribute('role','button'); cta.setAttribute('tabindex','0'); const open=()=>openDaMetricDetail('person',user.id,'overview'); cta.onclick=event=>{event.preventDefault();event.stopPropagation();open();}; cta.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open();}}; card.appendChild(cta); });
  document.querySelectorAll('#da-controller-dashboard .da-cell-filter-grid .da-capacity-card').forEach((card,index)=>{ const user=team[index]; if(!user || card.querySelector('.da-capacity-plan-cta')) return; const cta=document.createElement('span'); cta.className='da-capacity-plan-cta'; cta.textContent='Organizar agenda →'; cta.setAttribute('role','button'); cta.setAttribute('tabindex','0'); cta.setAttribute('aria-label',`Organizar agenda de ${firstName(user.name)}`); const open=()=>openDaIndividualPlanningDesk(user.id); cta.onclick=event=>{event.preventDefault();event.stopPropagation();open();}; cta.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open();}}; card.appendChild(cta); });
}
let DA_METRIC_SELECTED_IDS = new Set();
function daMetricUniqueEntries(entries=[]){ const seen=new Set(); return entries.filter(entry=>{ const key=String(entry?.item?.id||''); if(!key||seen.has(key)) return false; seen.add(key); return true; }); }
function daMetricSelectionEntries(){ const state=DA_METRIC_DETAIL_STATE||{}; if(!state.scopeType||!state.scopeId) return []; return daMetricUniqueEntries(daMetricEntries(state.scopeType,state.scopeId,'overview',daControllerTeam())).filter(entry=>DA_METRIC_SELECTED_IDS.has(String(entry.item.id))); }
function daMetricToggleItem(itemId,checked){ const key=String(itemId); if(checked) DA_METRIC_SELECTED_IDS.add(key); else DA_METRIC_SELECTED_IDS.delete(key); const state=DA_METRIC_DETAIL_STATE; openDaMetricDetail(state.scopeType,state.scopeId,state.metric); }
function daMetricToggleVisible(){ const state=DA_METRIC_DETAIL_STATE; const visible=daMetricUniqueEntries(daMetricEntries(state.scopeType,state.scopeId,state.metric,daControllerTeam())); const allSelected=visible.length>0&&visible.every(entry=>DA_METRIC_SELECTED_IDS.has(String(entry.item.id))); visible.forEach(entry=>{ const key=String(entry.item.id); if(allSelected) DA_METRIC_SELECTED_IDS.delete(key); else DA_METRIC_SELECTED_IDS.add(key); }); openDaMetricDetail(state.scopeType,state.scopeId,state.metric); }
function daMetricClearSelection(){ DA_METRIC_SELECTED_IDS.clear(); const state=DA_METRIC_DETAIL_STATE; openDaMetricDetail(state.scopeType,state.scopeId,state.metric); }
function daMetricBulkToolbarHtml(){ const state=DA_METRIC_DETAIL_STATE; const visible=daMetricUniqueEntries(daMetricEntries(state.scopeType,state.scopeId,state.metric,daControllerTeam())); const selected=daMetricSelectionEntries(); const allSelected=visible.length>0&&visible.every(entry=>DA_METRIC_SELECTED_IDS.has(String(entry.item.id))); return `<div class="da-metric-bulkbar"><div class="da-metric-bulk-copy"><b>SELEÇÃO EM LOTE · ${selected.length} DEMANDA${selected.length===1?'':'S'}</b><small>Marque as atividades para alterar prazo ou veiculação de uma só vez.</small></div><div class="da-metric-bulk-actions"><button type="button" onclick="daMetricToggleVisible()">${allSelected?'LIMPAR VISÍVEIS':'MARCAR VISÍVEIS'} (${visible.length})</button>${selected.length?`<button type="button" onclick="daMetricClearSelection()">Limpar seleção</button>`:''}<button type="button" class="primary" ${selected.length?'':'disabled'} onclick="daMetricOpenBulkEditor()">◷ AJUSTAR ${selected.length||''} DATA${selected.length===1?'':'S'}</button></div></div>`; }
function daMetricSectionHtml(kind,entries,summary){ const info={effort:{label:'PONTOS DE ESFORÇO',empty:'Nenhuma atividade com esforço calculado nesta janela.',total:`${summary.points} ponto${summary.points===1?'':'s'}`},blocked:{label:'BLOQUEIOS ATIVOS',empty:'Nenhum bloqueio ativo nesta seleção.',total:`${summary.blocked.length} bloqueio${summary.blocked.length===1?'':'s'}`},late:{label:'ATRASOS',empty:'Nenhum atraso nesta seleção.',total:`${summary.late.length} atraso${summary.late.length===1?'':'s'}`}}[kind]; const rows=entries.length?entries.map(entry=>{ const item=entry.item; const selected=DA_METRIC_SELECTED_IDS.has(String(item.id)); const ref=daControllerDate(item)?`${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'} ${daControllerDateLabel(item)}`:'Sem data de referência'; return `<article class="da-metric-detail-row ${kind}"><label class="da-metric-detail-select" title="Selecionar para alteração em lote"><input type="checkbox" ${selected?'checked':''} onchange="daMetricToggleItem('${item.id}',this.checked)"><span></span></label><span class="da-metric-detail-avatar">${daTacticalAvatar(entry.user,entry.user?.color||'#ff9d00')}</span><button type="button" class="da-metric-detail-open" onclick="closeDaMetricDetail();openItemWorkspace('${item.id}')"><span class="da-metric-detail-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(firstName(entry.user?.name||'Equipe'))} · ${safeText(ref)}</small><em>${safeText(daMetricContext(entry))}</em></span></button><span class="da-metric-detail-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag(item,true)}</span><span class="da-metric-detail-actions">${quickDateDaTrigger(item)}</span></article>`; }).join(''):`<div class="da-metric-detail-empty">✓ ${info.empty}</div>`; return `<section class="da-metric-detail-section ${kind}"><div class="da-metric-detail-section-head"><b>${info.label}</b><span>${info.total}</span></div><div class="da-metric-detail-list">${rows}</div></section>`; }
function daMetricBulkEvaluation(field,date,entries=daMetricSelectionEntries()){ const invalid=[]; let exceptions=0; let noReference=0; entries.forEach(entry=>{ const item=entry.item; const prazo=field==='prazo'?date:String(item.prazo_iso||''); const veiculacao=field==='veiculacao'?date:String(item.veiculacao_iso||''); if(prazo&&veiculacao&&prazo>veiculacao){ invalid.push(item); return; } if(!prazo||!veiculacao){ noReference++; return; } if(prazo!==goldenDeadlineIso(veiculacao)) exceptions++; }); return {invalid,exceptions,noReference,total:entries.length}; }
function daMetricBulkRefreshPreview(){ const field=String(document.getElementById('da-bulk-date-field')?.value||'prazo'); const date=String(document.getElementById('da-bulk-date-value')?.value||''); const note=document.getElementById('da-bulk-date-preview'); if(!note) return; const entries=daMetricSelectionEntries(); if(!date){ note.className='da-bulk-date-preview'; note.textContent=`Selecione a nova ${field==='prazo'?'data de prazo':'data de veiculação'} para avaliar ${entries.length} demanda${entries.length===1?'':'s'}.`; return; } const result=daMetricBulkEvaluation(field,date,entries); if(result.invalid.length){ note.className='da-bulk-date-preview err'; note.textContent=`Não é possível aplicar: ${result.invalid.length} demanda${result.invalid.length===1?'':'s'} ficaria${result.invalid.length===1?'':'m'} com o prazo depois da veiculação.`; return; } const parts=[`${entries.length} demanda${entries.length===1?'':'s'} ${entries.length===1?'receberá':'receberão'} ${field==='prazo'?'o novo prazo':'a nova veiculação'} em ${planningDateBr(date)}.`]; if(result.exceptions) parts.push(`${result.exceptions} ${result.exceptions===1?'ficará':'ficarão'} fora do padrão de ${PRAZO_OURO_DIAS} dias; o alerta visual será exibido, sem bloquear o ajuste.`); if(result.noReference) parts.push(`${result.noReference} ainda não tem as duas datas para medir a margem.`); note.className=`da-bulk-date-preview ${result.exceptions?'warn':'ok'}`; note.textContent=parts.join(' '); }
function daMetricOpenBulkEditor(){ const entries=daMetricSelectionEntries(); if(!entries.length) return showToast('Selecione pelo menos uma demanda para alterar as datas.','info'); const preview=entries.slice(0,5).map(entry=>entry.item.nome).join(' · '); const extra=entries.length>5?` · +${entries.length-5} demanda${entries.length-5===1?'':'s'}`:''; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Planejamento em lote</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Ajustar ${entries.length} demanda${entries.length===1?'':'s'}</h2><p class="workflow-copy">Defina uma data única para a seleção. O painel valida prazo, veiculação e a margem do Prazo de Ouro antes do envio.</p><div class="planning-change-note"><b>Seleção ativa:</b> ${safeText(preview+extra)}</div><div class="planning-date-grid"><label class="planning-date-card"><b>Campo a alterar</b><small>Escolha qual coluna receberá a nova data.</small><select id="da-bulk-date-field" onchange="daMetricBulkRefreshPreview()"><option value="prazo" ${daControllerDateMode==='prazo'?'selected':''}>Prazo</option><option value="veiculacao" ${daControllerDateMode==='veiculacao'?'selected':''}>Veiculação</option></select></label><label class="planning-date-card"><b>Nova data</b><small>Será aplicada somente às demandas marcadas.</small><input id="da-bulk-date-value" type="date" onchange="daMetricBulkRefreshPreview()"></label></div><div id="da-bulk-date-preview" class="da-bulk-date-preview">Selecione a nova data para avaliar a seleção.</div><div class="planning-change-note"><b>Regra do DA CONTROLER:</b> ajustes fora da margem de ${PRAZO_OURO_DIAS} dias são permitidos e ficam sinalizados visualmente, sem exigir justificativa.</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="da-bulk-date-save" type="button" class="workflow-primary" onclick="applyDaMetricBulkDate()">APLICAR EM ${entries.length} DEMANDA${entries.length===1?'':'S'} →</button></div>`); daMetricBulkRefreshPreview(); }
async function applyDaMetricBulkDate(){ const entries=daMetricSelectionEntries(); const field=String(document.getElementById('da-bulk-date-field')?.value||'prazo'); const date=String(document.getElementById('da-bulk-date-value')?.value||'');  if(!entries.length) return showToast('A seleção em lote foi perdida. Reabra o detalhamento e marque as demandas.','err'); if(!date) return showToast('Informe a nova data antes de aplicar a seleção.','info'); const evaluation=daMetricBulkEvaluation(field,date,entries); if(evaluation.invalid.length) return showToast('A alteração deixaria algum prazo depois da veiculação. Ajuste as datas individualmente ou escolha outra data.','info',7000); const button=document.getElementById('da-bulk-date-save'); if(button){ button.disabled=true; button.textContent='Aplicando...'; } armOutboundMutationGuard(`datas em lote do DA · ${field}`); const column=field==='prazo'?COLUNAS.producao.prazo:COLUNAS.producao.veiculacao; const patchKey=field==='prazo'?'prazo_iso':'veiculacao_iso'; const results=await Promise.allSettled(entries.map(async entry=>{ const item=entry.item; const before=String(item[patchKey]||''); const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`; if(!await tentarEscritaDupla(item,{acao:field==='prazo'?'prazo':'veiculacao',item:String(item.id),data:date})) await mondayQuery(mutation,{board:String(BOARD_ID),item:String(item.id),values:JSON.stringify({[column]:{date}})}); const nextPrazo=field==='prazo'?date:String(item.prazo_iso||''); const nextVeiculacao=field==='veiculacao'?date:String(item.veiculacao_iso||''); const followsGolden=Boolean(nextPrazo&&nextVeiculacao&&nextPrazo===goldenDeadlineIso(nextVeiculacao)); const rule=followsGolden?`Prazo de Ouro respeitado (${PRAZO_OURO_DIAS} dias antes da veiculação).`:(nextPrazo&&nextVeiculacao?`Exceção ao Prazo de Ouro: ${goldenDeadlineGap(nextPrazo,nextVeiculacao)} dias de antecedência.`:'Margem ainda não mensurável; falta uma das datas.'); try{ await postItemUpdate(item.id,`[Vybe OS · Planejamento em lote do DA]\n${field==='prazo'?'Prazo':'Veiculação'}: ${planningDateBr(before)} → ${planningDateBr(date)}\n${rule}\nSelecionado no detalhamento do DA.`); }catch(logError){ console.warn('Data em lote atualizada, mas histórico não registrado.',logError); } return {item,patch:{[patchKey]:date}}; })); const success=results.filter(result=>result.status==='fulfilled').map(result=>result.value); const failed=results.filter(result=>result.status==='rejected'); success.forEach(({item,patch})=>{ [DADOS,DADOS_ALL].forEach(list=>list.forEach(local=>{ if(String(local.id)===String(item.id)){ Object.assign(local,patch); if(patch.prazo_iso) local.prazo=planningDateBr(patch.prazo_iso); if(patch.veiculacao_iso) local.veiculacao=planningDateBr(patch.veiculacao_iso); local.updated_at=new Date().toISOString(); } })); queueOutboundItemReconciliation(item.id,patch,`datas em lote do DA · ${field}`); DA_METRIC_SELECTED_IDS.delete(String(item.id)); }); saveProductionCache(); renderDaController(); if(!failed.length) closeWorkflowModal(); const state=DA_METRIC_DETAIL_STATE; openDaMetricDetail(state.scopeType,state.scopeId,state.metric); if(failed.length){ if(button){button.disabled=false;button.textContent=`Tentar novamente em ${failed.length}`;} showToast(`${success.length} data${success.length===1?'':'s'} aplicada${success.length===1?'':'s'}; ${failed.length} demanda${failed.length===1?' falhou':'s falharam'}.`,'info',7000); }else showToast(`✓ ${success.length} ${field==='prazo'?'prazo':'veiculação'}${success.length===1?' atualizado':' atualizados'} em lote.`,'ok'); }
function openDaMetricDetail(scopeType,scopeId,metric='overview'){
  const previous=DA_METRIC_DETAIL_STATE||{}; if(previous.scopeType!==scopeType||String(previous.scopeId)!==String(scopeId)) DA_METRIC_SELECTED_IDS.clear(); const team=daControllerTeam(); const users=daMetricScopeUsers(scopeType,scopeId,team); if(!users.length) return showToast('Não foi possível identificar a seleção deste indicador.','err'); DA_METRIC_DETAIL_STATE={scopeType,scopeId,metric}; closeDaMetricDetail(true); const summary=daMetricSummary(scopeType,scopeId,team); const label=daMetricScopeLabel(scopeType,scopeId,team); const discipline=scopeType==='discipline'?DA_DISCIPLINES?.[scopeId]:daDisciplineForUser(users[0]); const overlay=document.createElement('div'); overlay.id='da-metric-detail-overlay'; overlay.className='da-metric-detail-overlay'; overlay.onclick=event=>{if(event.target===overlay) closeDaMetricDetail();}; const tabs=[['overview','VISÃO GERAL'],['effort',`${summary.points} PTS`],['blocked',`${summary.blocked.length} BLOQUEIO${summary.blocked.length===1?'':'S'}`],['late',`${summary.late.length} ATRASO${summary.late.length===1?'':'S'}`]].map(([key,text])=>`<button type="button" class="da-metric-detail-tab ${metric===key?'active':''}" onclick="openDaMetricDetail('${scopeType}','${scopeId}','${key}')">${text}</button>`).join(''); const content=metric==='overview'?`${daMetricSectionHtml('effort',summary.effort,summary)}${daMetricSectionHtml('blocked',summary.blocked,summary)}${daMetricSectionHtml('late',summary.late,summary)}`:daMetricSectionHtml(metric,summary[metric],summary); const scopeNote=scopeType==='discipline'?`Composição atribuída a ${users.map(user=>firstName(user.name)).join(', ')}. Marque itens para ajustar datas em lote.`:`Carga ativa de ${firstName(users[0].name)}. Marque itens para ajustar prazo ou veiculação em lote.`; overlay.innerHTML=`<section class="da-metric-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhamento de ${safeText(label)}"><div class="da-metric-detail-head" style="--metric-color:${discipline?.color||'#ff9d00'}"><div><span>RASTREABILIDADE OPERACIONAL · ${safeText(scopeType==='discipline'?discipline?.label||label:'MEMBRO DA CÉLULA')}</span><b>${safeText(label)}</b><small>${safeText(scopeNote)}</small></div><button class="x-fechar" type="button" onclick="closeDaMetricDetail()" aria-label="Fechar detalhamento">×</button></div><div class="da-metric-detail-summary"><span><b>${summary.points}</b><small>Pontos de esforço</small></span><span><b>${summary.blocked.length}</b><small>Bloqueios</small></span><span><b>${summary.late.length}</b><small>Atrasos</small></span></div><div class="da-metric-detail-tabs">${tabs}</div>${daMetricBulkToolbarHtml()}<div class="da-metric-detail-body">${content}</div></section>`; document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
}
function daControllerAvatar(user) { return user.photo ? `<img class="da-person-avatar" src="${user.photo}" alt="${safeText(user.name)}" onerror="this.outerHTML='<span class=da-person-fallback style=background:${user.color}>${firstName(user.name).slice(0,2).toUpperCase()}</span>'">` : `<span class="da-person-fallback" style="background:${user.color}">${firstName(user.name).slice(0,2).toUpperCase()}</span>`; }
function daControllerPersonCard(user) {
  const metrics=daControllerPersonMetrics(user); const isActive=daControllerPersonId===user.id; const signalColor=metrics.late.length ? '#ff637a' : metrics.blocked.length ? '#ffd15a' : metrics.active.length ? '#00d184' : user.color;
  const signalText=metrics.late.length ? `${metrics.late.length} atraso${metrics.late.length>1?'s':''} a agir` : metrics.blocked.length ? `${metrics.blocked.length} bloqueio${metrics.blocked.length>1?'s':''} na fila` : metrics.active.length ? `${metrics.active.length} em execução` : `${metrics.period.length} no período`;
  return `<button type="button" class="da-person-card ${isActive?'active':''}" style="--da-person-color:${user.color};--da-signal:${signalColor}" onclick="setDaControllerPerson('${user.id}')"><span class="da-person-top">${daControllerAvatar(user)}<span><b class="da-person-name">${safeText(firstName(user.name))}</b><small class="da-person-role">${safeText(DA_CONTROLLER_ROLES[user.id] || 'Criação')}</small></span></span><span class="da-person-metrics"><span class="da-person-metric"><b>${metrics.period.length}</b><span>${daControllerPeriod === 'day' ? 'hoje' : daControllerPeriod === 'week' ? 'semana' : 'mês'}</span></span><span class="da-person-metric"><b>${metrics.active.length}</b><span>em execução</span></span><span class="da-person-metric"><b>${metrics.late.length}</b><span>atrasados</span></span></span><span class="da-person-status"><i></i>${signalText}</span></button>`;
}
function daControllerQueueRow(item) {
  const owner=daControllerTeam().find(user => assignedIds(item).includes(user.id)); const reference=daControllerDateLabel(item); const urgency=(daControllerDate(item) && daControllerDate(item)<(HOJE_ISO || new Date().toISOString().slice(0,10))) ? 'danger' : ''; const dateRisk=daControllerRiskHtml(item);
  return `<div class="da-queue-row"><span class="da-queue-person">${safeText(firstName(owner?.name || 'Equipe'))}</span><span class="da-queue-client">${safeText(item.cliente || 'Sem cliente')}</span><button type="button" class="da-queue-name" onclick="openItemWorkspace('${item.id}')" title="Abrir contexto">${safeText(item.nome)}</button><span class="da-queue-date ${urgency}">${safeText(reference)}</span>${dateRisk || pillHtml(item.status,item.status_color,item.status_border)}<button type="button" class="da-queue-open" onclick="openItemWorkspace('${item.id}')">Abrir</button></div>`;
}
function renderDaController() {
  return renderDaControllerTactical();
}
function daTacticalActionInfo(item) {
  const discipline=daDisciplineForItem(item); const map={
    'Falta D.A':{verb:'DEFINIR DIREÇÃO',copy:'O time depende da sua referência para retomar a execução.',color:'#ffbd2e'},
    'Alteração':{verb:'DIRECIONAR ALTERAÇÃO',copy:'Feche o que precisa mudar e devolva uma instrução única para a nova versão.',color:'#ff8b2b'},
    'Para aprovação':{verb:'VALIDAR E LIBERAR',copy:'A produção saiu do time e precisa da sua decisão para ganhar velocidade.',color:'#579bfc'},
    'Ag. Interno':{verb:'DESTRAVAR VALIDAÇÃO',copy:'Defina quem decide a próxima etapa para a demanda não ficar parada.',color:'#ffd15a'},
    'Falta Info':{verb:'COBRAR CONTEXTO',copy:'O material ou a informação pendente ainda impede o avanço da criação.',color:'#ff637a'},
    'Ag. Info Cliente':{verb:'COBRAR CONTEXTO',copy:'A criação não avança até o retorno com as informações necessárias.',color:'#ff637a'},
    'Aguardo':{verb:'DEFINIR PRÓXIMO PASSO',copy:'Há uma dependência em espera; clarifique responsável e próxima ação.',color:'#ff637a'},
    'Em andamento':{verb:'PROTEGER A ENTREGA',copy:'A demanda já está em produção; remova ruído e preserve o tempo de execução.',color:'#00d184'},
    'Pode Fazer':{verb:'LIBERAR PRODUÇÃO',copy:'A demanda está pronta para entrar em execução dentro da célula criativa.',color:'#ffbd2e'},
    'A Fazer':{verb:'DISTRIBUIR COM INTENÇÃO',copy:'Defina quem deve assumir e qual é a primeira entrega esperada.',color:'#ffbd2e'}
  };
  const flowStatus=operationalFlowStatus(item); const base=map[flowStatus] || {verb:'ANALISAR CONTEXTO',copy:'Revise o contexto operacional e decida a melhor próxima ação.',color:'#ff8b2b'};
  if(discipline.key==='audiovisual' && flowStatus==='Em andamento') return {...base,copy:'Proteja o tempo de edição e motion: remova ruído, antecipe informações e preserve a entrega audiovisual.'};
  if(discipline.key==='audiovisual' && flowStatus==='Pode Fazer') return {...base,copy:'A entrega audiovisual está pronta para entrar em edição; confirme briefing, arquivos e prazo antes de iniciar.'};
  return base;
}
function daTacticalPriorityContext(item, team=daControllerTeam()) {
  const risk=daControllerRisk(item); const owner=daTacticalOwner(item,team); const metrics=owner?daControllerPersonMetrics(owner):null; const escalation=daCriticalEscalation(item); const flowStatus=operationalFlowStatus(item); const statusPoints={'Falta D.A':100,'Alteração':96,'Para aprovação':86,'Ag. Interno':82,'Falta Info':80,'Ag. Info Cliente':80,'Aguardo':76,'Em andamento':54,'Pode Fazer':42,'A Fazer':30,'Para agendar':8,'Agendado':4}; let score=statusPoints[flowStatus] ?? 18; const reasons=[];
  const directionStatuses=['Falta D.A','Alteração','Para aprovação','Ag. Interno','Falta Info','Ag. Info Cliente','Aguardo'];
  if(escalation.level==='extreme'){score+=260;reasons.push(`EXTREMA URGÊNCIA: ${escalation.overdueDays} DIAS EM ATRASO`); if(escalation.clock.source==='status' && escalation.clock.days>0) reasons.push(`NO STATUS HÁ ${escalation.clock.days} DIAS`);} else if(escalation.level==='critical'){score+=120;reasons.push(`ESCALAÇÃO: ${escalation.overdueDays} DIAS EM ATRASO`);}
  if(directionStatuses.includes(flowStatus)) reasons.push(flowStatus==='Alteração'?'ALTERAÇÃO A DIRECIONAR':flowStatus==='Para aprovação'?'VALIDAÇÃO PENDENTE':flowStatus==='Falta D.A'?'DIREÇÃO PENDENTE':'DEPENDÊNCIA A DESTRAVAR');
  if(risk?.level==='critical'){score+=42;reasons.push('PRAZO ATRASADO');} else if(risk?.level==='high'){score+=30;reasons.push('VENCE HOJE');} else if(risk?.level==='attention'){score+=14;reasons.push('VENCE AMANHÃ');}
  if(flowStatus==='Em andamento' && risk){score+=12;reasons.push('PROTEGE ENTREGA EM EXECUÇÃO');}
  if(flowStatus==='Pode Fazer' && (risk?.level==='high'||risk?.level==='attention')){score+=10;reasons.push('LIBERA EXECUÇÃO IMEDIATA');}
  if(metrics?.capacity?.state==='saturada' && (risk || directionStatuses.includes(flowStatus))){score+=14;reasons.push(metrics.capacity.discipline.key==='audiovisual'?'LINHA AUDIOVISUAL SATURADA':'CARGA DE DESIGN SATURADA');} else if(metrics?.capacity?.state==='atenção' && (risk || directionStatuses.includes(flowStatus))){score+=6;reasons.push(metrics.capacity.discipline.key==='audiovisual'?'ATENÇÃO À LINHA AUDIOVISUAL':'ATENÇÃO À CARGA DE DESIGN');}
  if(!reasons.length) reasons.push(flowStatus==='Pode Fazer'?'PRONTO PARA DISTRIBUIR':'PRÓXIMA ETAPA DA FILA');
  return {score,reasons:[...new Set(reasons)].slice(0,3),owner,risk,escalation};
}
function daTacticalScore(item) { return -daTacticalPriorityContext(item).score; }
function daTacticalOwner(item, team=daControllerTeam()) { return team.find(user=>assignedIds(item).includes(user.id)) || null; }
function daTacticalAvatar(user, color='#ff8b2b') { return user?.photo ? `<img src="${user.photo}" alt="${safeText(user.name)}">` : `<span style="background:${user?.color || color}">${safeText(firstName(user?.name || 'EQ').slice(0,2).toUpperCase())}</span>`; }
function daTacticalPersonVisual(owner, color='#ff8b2b') { const label=safeText(owner?.name || 'Sem responsável'); const role=safeText(DA_CONTROLLER_ROLES[owner?.id] || 'Criação'); return `<span class="da-tactical-person" title="${label} · ${role}">${daTacticalAvatar(owner,color)}</span>`; }
function daTacticalOwnerEditor(item, owner, color='#ff8b2b') { const label=safeText(owner?.name || 'Sem responsável'); const role=safeText(DA_CONTROLLER_ROLES[owner?.id] || 'Criação'); return `<span class="da-tactical-person owner-editor-da" role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();openOwnerEditor(event,'${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openOwnerEditor(event,'${item.id}')}" title="${label} · ${role}. Clique para gerenciar responsáveis.">${daTacticalAvatar(owner,color)}</span>`; }
function daTacticalFormat(item) { const raw=item?.formato || item?.tipo || item?.formato_conteudo || ''; if(raw && String(raw).trim() !== '—') return raw; const name=String(item?.nome || '').toLowerCase(); if(name.includes('reels')||name.includes('vídeo')||name.includes('video')) return 'Reels'; if(name.includes('carrossel')) return 'Carrossel'; if(name.includes('fotografia')||name.includes('foto')) return 'Fotografia'; if(name.includes('card')) return 'Card'; return 'Conteúdo'; }
function daTacticalFormatTag(item) { return `<span class="da-content-tags">${fmtHtml(daTacticalFormat(item))}${operationalOriginTag(item)}</span>`; }
function daTacticalStatusTag(item, withAge=false) { const risk=daControllerRisk(item); const escalation=daCriticalEscalation(item); const riskHtml=escalation.level?`<span class="da-risk-mini ${escalation.level==='extreme'?'extreme':'critical'}">⚑ ${escalation.label}</span>`:risk?`<span class="da-risk-mini ${risk.level}">${risk.level==='critical'?'⚑':risk.level==='high'?'!':'◌'} ${risk.label}</span>`:''; const apoio=[riskHtml, withAge?daStatusAgeTag(item):''].filter(Boolean);
  const resumo=apoio.length
    ? `<span class="da-apoio" title="${safeText(apoio.join(' · ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())}">${apoio.join('')}</span>`
    : '';
  return `<span class="da-status-tags">${pillHtml(item.status,item.status_color,item.status_border)}${resumo}</span>`; }
function daTacticalListAvatar(owner) { const name=safeText(owner?.name || 'Equipe'); const role=safeText(DA_CONTROLLER_ROLES[owner?.id] || 'Criação'); const initials=safeText(firstName(owner?.name || 'EQ').slice(0,2).toUpperCase()); const visual=owner?.photo?`<img src="${owner.photo}" alt="${name}">`:`<span class="da-list-avatar-fallback" style="background:${owner?.color || '#80654d'}">${initials}</span>`; const click=owner?.id?`onclick="event.stopPropagation();setDaControllerPerson('${owner.id}')"`:'disabled'; return `<button type="button" class="da-list-avatar" ${click} title="${name} · ${role}. Clique para filtrar a visão.">${visual}<span class="da-list-avatar-tip"><b>${name}</b><span>${role}</span><small>Clique para filtrar esta pessoa</small></span></button>`; }
function daTacticalCapacityCard(user, maxLoad) {
  const metrics=daControllerPersonMetrics(user); const active=daControllerPersonId===user.id; const load=Math.round((metrics.period.length / Math.max(1,maxLoad))*100); const signalColor=metrics.late.length ? '#ff637a' : metrics.blocked.length ? '#ffd15a' : metrics.active.length ? '#00d184' : user.color; const state=metrics.late.length ? `${metrics.late.length} atraso${metrics.late.length>1?'s':''}` : metrics.blocked.length ? `${metrics.blocked.length} bloqueio${metrics.blocked.length>1?'s':''}` : metrics.capacity.state==='saturada'?'capacidade saturada':metrics.capacity.state==='atenção'?'capacidade em atenção':metrics.active.length ? `${metrics.active.length} em execução` : 'fila estável'; const typeSummary=metrics.capacity.types.slice(0,3).map(([type,points])=>`${type}: ${points} pts`).join(' · ') || 'Sem composição relevante'; const hover=`${metrics.period.length} entrega${metrics.period.length===1?'':'s'} no período · ${metrics.capacity.workload} pontos de esforço · ${metrics.active.length} em execução · ${metrics.late.length} atrasada${metrics.late.length===1?'':'s'} · ${typeSummary}`; const discipline=metrics.capacity.discipline; const today=HOJE_ISO || new Date().toISOString().slice(0,10); const nextFive=[...metrics.period].filter(item=>!isFinishedItem(item)).sort((a,b)=>{const ad=daControllerDate(a)||'9999-12-31'; const bd=daControllerDate(b)||'9999-12-31'; const af=ad>=today?0:1; const bf=bd>=today?0:1; return af-bf || ad.localeCompare(bd) || daTacticalScore(a)-daTacticalScore(b);}).slice(0,5); const nextFiveHtml=nextFive.length?nextFive.map(item=>`<span class="da-capacity-hover-row"><span class="da-capacity-hover-date">${safeText(daControllerDateLabel(item)||'SEM DATA')}</span><span class="da-capacity-hover-name">${safeText(item.nome)}</span><span class="da-capacity-hover-status">${safeText(item.status||'Sem status')}</span></span>`).join(''):'<span class="da-capacity-hover-row"><span class="da-capacity-hover-name">Sem demandas ativas no período.</span></span>';
  return `<button type="button" class="da-capacity-card ${active?'active':''}" style="--da-person-color:${user.color};--da-load:${load}%;--da-signal:${signalColor}" onclick="setDaControllerPerson('${user.id}')" title="Clique para ${active?'limpar':'filtrar'} a visão por ${safeText(firstName(user.name))}"><span class="da-capacity-top">${user.photo?`<img class="da-capacity-avatar" src="${user.photo}" alt="${safeText(user.name)}" onerror="this.outerHTML='<span class=da-capacity-fallback style=background:${user.color}>${firstName(user.name).slice(0,2).toUpperCase()}</span>'">`:`<span class="da-capacity-fallback" style="background:${user.color}">${firstName(user.name).slice(0,2).toUpperCase()}</span>`}<span><b class="da-capacity-name">${safeText(firstName(user.name))}</b><small class="da-capacity-role">${safeText(DA_CONTROLLER_ROLES[user.id] || 'Criação')}</small><small class="da-discipline-tag" style="--discipline-color:${discipline.color}">${discipline.label}</small></span></span><span class="da-capacity-volume"><b>${metrics.period.length}</b><span>no período</span></span><span class="da-capacity-load"><i></i></span><span class="da-capacity-signal"><span>${metrics.capacity.workload} pts · ${discipline.short}</span><strong>${state}</strong><small>${safeText(metrics.capacity.types.slice(0,2).map(([type,points])=>`${type} ${points}pts`).join(' · '))}</small></span><span class="da-capacity-hover"><span class="da-capacity-hover-head"><b>PRÓXIMAS 5 · ${safeText(firstName(user.name)).toUpperCase()}</b><small>Hover</small></span><span class="da-capacity-hover-summary">${safeText(hover)}</span><span class="da-capacity-hover-list">${nextFiveHtml}</span></span></button>`;
}
function daTacticalActionRow(item, team) {
  const owner=daTacticalOwner(item,team); const info=daTacticalActionInfo(item); const ref=daControllerDate(item) ? `${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'} ${daControllerDateLabel(item)}` : 'Sem data de referência'; return `<div class="da-action-row" onclick="openItemWorkspace('${item.id}')" title="Clique para abrir contexto">${vybeChipId(item)}${daTacticalListAvatar(owner)}<span class="da-action-copy"><button type="button" class="da-action-name" onclick="event.stopPropagation();openItemWorkspace('${item.id}')">${safeText(item.nome)}</button><span class="da-action-meta">${daTacticalFormatTag(item)} · ${safeText(info.verb)} · ${safeText(ref)}</span></span>${daTacticalStatusTag(item,true)}</div>`;
}
function daTacticalDeliveryRiskRow(item, team) {
  const owner=daTacticalOwner(item,team); const risk=daControllerRisk(item); const ref=daControllerDate(item) ? `${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'} ${daControllerDateLabel(item)}` : 'Sem data'; const next=item.status==='Em andamento'?'PROTEGER EXECUÇÃO':item.status==='Pode Fazer'?'CONFIRMAR INÍCIO':'REVISAR CAMINHO'; return `<div class="da-delivery-risk-row" onclick="openItemWorkspace('${item.id}')" title="Clique para abrir contexto">${daTacticalListAvatar(owner)}<span class="da-delivery-risk-copy"><b>${safeText(item.nome)}</b><span class="da-delivery-risk-meta">${daTacticalFormatTag(item)} · ${safeText(ref)}</span></span><span class="da-status-tags">${daTacticalStatusTag(item,true)}<span class="da-delivery-risk-next">${
    risk?.label && !['hoje','amanhã','amanha'].includes(String(risk.label).trim().toLowerCase())
      ? risk.label.toUpperCase() : next}</span></span></div>`;
}
function daTacticalWindowRow(item, team) {
  const owner=daTacticalOwner(item,team); const date=daControllerDate(item); return `<div class="da-window-row"><span class="da-window-date">${safeText(daControllerDateLabel(item))}</span><span class="da-window-copy"><b>${safeText(item.nome)}</b><span>${safeText(firstName(owner?.name || 'Equipe'))} · ${safeText(item.cliente || 'Sem cliente')}</span></span><span class="da-queue-go">›</span></div>`;
}
let DA_TODAY_STATUS_LOGS = null;
let DA_TODAY_STATUS_LOGS_PROMISE = null;
async function daLoadTodayStatusLogs(){
  if(DA_TODAY_STATUS_LOGS) return DA_TODAY_STATUS_LOGS;
  if(DA_TODAY_STATUS_LOGS_PROMISE) return DA_TODAY_STATUS_LOGS_PROMISE;
  DA_TODAY_STATUS_LOGS_PROMISE=fetchActivityLogs().then(logs=>{DA_TODAY_STATUS_LOGS=logs||{statusEvents:{}}; return DA_TODAY_STATUS_LOGS;}).catch(()=>{DA_TODAY_STATUS_LOGS={statusEvents:{}}; return DA_TODAY_STATUS_LOGS;}).finally(()=>{DA_TODAY_STATUS_LOGS_PROMISE=null;});
  return DA_TODAY_STATUS_LOGS_PROMISE;
}
function daTodayStatusTimestamp(item,logs,today){
  const events=(logs?.statusEvents?.[String(item?.id||'')]||[]).filter(event=>new Date(event.tsMs||0).toISOString().slice(0,10)===today);
  return events.reduce((latest,event)=>Math.max(latest,Number(event.tsMs)||0),0);
}
function daOwnerIdsAtMoment(item,tsMs,logs){
  let ownerIds=assignedIds(item).map(String);
  const changes=(logs?.ownerEvents?.[String(item?.id||'')]||[]).filter(event=>Number(event.tsMs||0)>Number(tsMs||0)).sort((a,b)=>Number(b.tsMs||0)-Number(a.tsMs||0));
  changes.forEach(change=>{ if(Array.isArray(change.previousOwnerIds)) ownerIds=change.previousOwnerIds.map(String); });
  return ownerIds;
}
function daHistoricalExecutor(item,tsMs,logs,team){
  const historicalOwner=team.find(user=>daOwnerIdsAtMoment(item,tsMs,logs).includes(String(user.id)));
  return historicalOwner || null;
}
function daTodayMovementTimestamp(item) {
  const directTs=item?._todayStatusTs || ''; if(directTs) return Number(directTs);
  const contextTs=item?.status_context?.created_at || '';
  const updatedTs=item?.updated_at || item?.updatedAt || '';
  const contextStatus=String(item?.status_context?.target || '').trim().toLowerCase();
  const currentStatus=String(item?.status || '').trim().toLowerCase();
  return contextTs && contextStatus===currentStatus ? contextTs : (updatedTs || contextTs || '');
}
function daTodayMovementIso(item) {
  const ts=daTodayMovementTimestamp(item); if(!ts) return '';
  const date=new Date(ts); return Number.isNaN(date.getTime()) ? String(ts).slice(0,10) : date.toISOString().slice(0,10);
}
function daTodayMovementTime(item) {
  const ts=daTodayMovementTimestamp(item); if(!ts) return 'Horário não informado';
  const date=new Date(ts); return Number.isNaN(date.getTime()) ? 'Horário não informado' : date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
let DA_TODAY_HISTORY_ISO = null;
function daTodayHistoryIso(){ return DA_TODAY_HISTORY_ISO || HOJE_ISO || new Date().toISOString().slice(0,10); }
function daTodayHistoryDates(){ const anchor=HOJE_ISO || new Date().toISOString().slice(0,10); return Array.from({length:7},(_,offset)=>{const date=new Date(`${anchor}T12:00:00`); date.setDate(date.getDate()-(6-offset)); return date.toISOString().slice(0,10);}); }
function daTodayHistoryNavigatorHtml(selected){ const today=HOJE_ISO || new Date().toISOString().slice(0,10); return `<div class="da-today-date-nav">${daTodayHistoryDates().map(iso=>{const date=new Date(`${iso}T12:00:00`); const label=iso===today?'HOJE':date.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit'}).replace('.','').toUpperCase(); return `<button type="button" class="da-today-date-chip ${iso===selected?'active':''}" onclick="setDaTodayHistoryDate('${iso}')">${safeText(label)}</button>`;}).join('')}</div>`; }
function setDaTodayHistoryDate(iso){ DA_TODAY_HISTORY_ISO=iso; renderDaControllerTactical(); }
function daTodayProductionSnapshot(team=daControllerTeam(), logs=DA_TODAY_STATUS_LOGS, selectedIso=daTodayHistoryIso()) {
  const ids=team.map(user=>String(user.id)); const source=(DADOS_ALL?.length?DADOS_ALL:DADOS)||[];
  const movements=(logs?source.map(item=>{const rawEvents=(logs.statusEvents?.[String(item.id)]||[]).filter(event=>new Date(event.tsMs||0).toISOString().slice(0,10)===selectedIso); const events=[...new Map(rawEvents.map(event=>[`${event.tsMs}|${event.previousStatus}|${event.status}|${event.actorId}`,event])).values()]; const creativeAdvances=events.map(event=>{const actor=team.find(user=>String(user.id)===String(event.actorId||'')); const historicalOwner=daHistoricalExecutor(item,event.tsMs,logs,team); const currentOwner=team.find(user=>assignedIds(item).includes(user.id)); const executor=historicalOwner||currentOwner||actor; return executor?{event,executor}:null;}).filter(Boolean).sort((a,b)=>Number(b.event.tsMs||0)-Number(a.event.tsMs||0)); const selected=creativeAdvances[0]; if(!selected) return null; const latest=selected.event; const executor=selected.executor; return {...item,_todayStatusTs:latest.tsMs,_todayStatus:latest.status,_todayActorId:latest.actorId,_todayActorName:daHistoryActor(latest,item),_todayExecutorId:executor.id,_todayExecutorName:executor.name,_todayEvents:events};}).filter(Boolean):[]).sort((a,b)=>daTodayMovementTimestamp(b)-daTodayMovementTimestamp(a));
  const statusOf=item=>item._todayStatus||item.status||''; const finished=movements.filter(item=>['Finalizado','Feito'].includes(statusOf(item))); const advanced=movements.filter(item=>['Em andamento','Pode Fazer','A Fazer'].includes(statusOf(item))); const handedOff=movements.filter(item=>['Para aprovação','Para agendar','Agendado','Ag. Aprovação Cliente'].includes(statusOf(item))); const blocked=movements.filter(item=>daControllerBlocked({...item,status:statusOf(item)}));
  const perPerson=team.map(user=>{const items=movements.filter(item=>String(item._todayExecutorId||'')===String(user.id)); return {user,items,finished:items.filter(item=>['Finalizado','Feito'].includes(statusOf(item))).length,advanced:items.filter(item=>['Em andamento','Pode Fazer','A Fazer'].includes(statusOf(item))).length,handedOff:items.filter(item=>['Para aprovação','Para agendar','Agendado','Ag. Aprovação Cliente'].includes(statusOf(item))).length};}).filter(entry=>entry.items.length);
  return {today:selectedIso,movements,finished,advanced,handedOff,blocked,perPerson};
}
const DA_CHECKINS_STORAGE_KEY='vybe_os_da_checkins_v2';
function daCheckinStore(){ try{ const parsed=JSON.parse(localStorage.getItem(DA_CHECKINS_STORAGE_KEY)||'{"items":{}}'); return parsed&&typeof parsed==='object'?{items:parsed.items||{}}:{items:{}}; }catch(error){ return {items:{}}; } }
function daSaveCheckinStore(store){ try{ localStorage.setItem(DA_CHECKINS_STORAGE_KEY,JSON.stringify(store)); return true; }catch(error){ showToast('Não foi possível salvar o check-in neste navegador.','err'); return false; } }
function daCheckinEntry(itemId,iso=daTodayHistoryIso()){ const store=daCheckinStore(); return store.items?.[String(itemId)]?.days?.[iso]||null; }
function daCheckinState(entry){ const action=entry?.events?.[entry.events.length-1]?.action||''; return ['start','resume'].includes(action)?'running':action==='pause'?'paused':action==='end'?'closed':'idle'; }
function daCheckinElapsedMs(entry,iso=daTodayHistoryIso()){
  const events=[...(entry?.events||[])].sort((a,b)=>String(a.at).localeCompare(String(b.at))); let startedAt=0,total=0;
  events.forEach(event=>{ const ms=new Date(event.at).getTime(); if(Number.isNaN(ms)) return; if(['start','resume'].includes(event.action) && !startedAt) startedAt=ms; if(['pause','end'].includes(event.action) && startedAt){ total+=Math.max(0,ms-startedAt); startedAt=0; } });
  const today=HOJE_ISO||new Date().toISOString().slice(0,10); if(startedAt&&iso===today) total+=Math.max(0,Date.now()-startedAt); return total;
}
function daCheckinDurationLabel(ms){ const mins=Math.max(0,Math.floor(Number(ms||0)/60000)); const hours=Math.floor(mins/60); const minutes=mins%60; return hours?`${hours}h ${String(minutes).padStart(2,'0')}m`:`${minutes}min`; }
function daCheckinStatusLabel(entry,iso=daTodayHistoryIso()){
  const state=daCheckinState(entry); const duration=daCheckinDurationLabel(daCheckinElapsedMs(entry,iso));
  if(state==='running') return `EM EXECUÇÃO · ${duration}`; if(state==='paused') return `PAUSADO · ${duration}`; if(state==='closed') return `ENCERRADO · ${duration}`; return 'SEM CHECK-IN';
}
function daCheckinForOwner(store,userId,iso){ return Object.values(store.items||{}).map(item=>item?.days?.[iso]).filter(entry=>entry&&String(entry.ownerId||'')===String(userId)); }
function daRegisterCheckin(itemId,action){
  const today=HOJE_ISO||new Date().toISOString().slice(0,10); const selected=daTodayHistoryIso(); if(selected!==today) return showToast('Os check-ins só podem ser registrados na data atual.','info');
  const item=(DADOS_ALL?.find(entry=>String(entry.id)===String(itemId))||DADOS?.find(entry=>String(entry.id)===String(itemId))); const owner=item?daTacticalOwner(item):null; if(!item||!owner) return showToast('Defina um responsável da célula antes de registrar a execução.','info');
  const store=daCheckinStore(); const itemKey=String(itemId); const bucket=store.items[itemKey]||(store.items[itemKey]={days:{}}); const entry=bucket.days[today]||(bucket.days[today]={itemId:itemKey,ownerId:String(owner.id),ownerName:owner.name,events:[]}); const state=daCheckinState(entry);
  const allowed=(action==='start'&&['idle','closed'].includes(state))||(action==='pause'&&state==='running')||(action==='resume'&&state==='paused')||(action==='end'&&['running','paused'].includes(state));
  if(!allowed) return showToast('Esse controle não está disponível para o estado atual do check-in.','info');
  entry.ownerId=String(owner.id); entry.ownerName=owner.name; entry.events.push({action,at:new Date().toISOString()}); entry.updatedAt=new Date().toISOString();
  if(!daSaveCheckinStore(store)) return; const labels={start:'Execução iniciada',pause:'Execução pausada',resume:'Execução retomada',end:'Execução encerrada'}; showToast(`✓ ${labels[action]} · ${firstName(owner.name)}`,'ok'); renderDaControllerTactical();
}
function daCheckinControlsHtml(item,owner){
  const today=HOJE_ISO||new Date().toISOString().slice(0,10); const selected=daTodayHistoryIso(); const entry=daCheckinEntry(item.id,selected); const state=daCheckinState(entry); const label=daCheckinStatusLabel(entry,selected);
  if(selected!==today) return `<div class="da-checkin-controls historic"><span class="da-checkin-state ${state}">${safeText(label)}</span><small>Registro local da data</small></div>`;
  const tools=state==='running'?`<button type="button" class="da-checkin-btn pause" onclick="event.stopPropagation();daRegisterCheckin('${item.id}','pause')">⏸ PAUSAR</button><button type="button" class="da-checkin-btn end" onclick="event.stopPropagation();daRegisterCheckin('${item.id}','end')">✓ ENCERRAR</button>`:state==='paused'?`<button type="button" class="da-checkin-btn resume" onclick="event.stopPropagation();daRegisterCheckin('${item.id}','resume')">▶ RETOMAR</button><button type="button" class="da-checkin-btn end" onclick="event.stopPropagation();daRegisterCheckin('${item.id}','end')">✓ ENCERRAR</button>`:`<button type="button" class="da-checkin-btn start" onclick="event.stopPropagation();daRegisterCheckin('${item.id}','start')">▶ INICIAR</button>`;
  return `<div class="da-checkin-controls"><span class="da-checkin-state ${state}" title="Responsável: ${safeText(owner?.name||'Equipe')}">${safeText(label)}</span><span class="da-checkin-buttons">${tools}</span></div>`;
}
function daCommitmentScoreboard(team=daControllerTeam(),logs=DA_TODAY_STATUS_LOGS,selectedIso=daTodayHistoryIso()){
  const source=(DADOS_ALL?.length?DADOS_ALL:DADOS)||[]; const plannedSource=source.filter(item=>hasAnyAssignment(item,DA_CONTROLLER_TEAM_IDS)&&daControllerDate(item)===selectedIso); const snapshot=daTodayProductionSnapshot(team,logs,selectedIso); const store=daCheckinStore();
  const people=team.map(user=>{ const planned=plannedSource.filter(item=>assignedIds(item).map(String).includes(String(user.id))); const advances=snapshot.movements.filter(item=>String(item._todayExecutorId||'')===String(user.id)); const advanceIds=new Set(advances.map(item=>String(item.id))); const checkins=daCheckinForOwner(store,user.id,selectedIso); const checkinIds=new Set(checkins.map(entry=>String(entry.itemId))); const startedIds=new Set([...advanceIds,...checkinIds]); const plannedIds=new Set(planned.map(item=>String(item.id))); const notStarted=planned.filter(item=>!startedIds.has(String(item.id))); const lastMinute=advances.filter(item=>!plannedIds.has(String(item.id))); return {user,planned,advances,notStarted,lastMinute,checkins}; });
  return {today:selectedIso,people,snapshot,plannedTotal:people.reduce((sum,row)=>sum+row.planned.length,0)};
}
function daCommitmentScoreboardHtml(team=daControllerTeam(),logs=DA_TODAY_STATUS_LOGS){
  const board=daCommitmentScoreboard(team,logs); const dateLabel=new Date(`${board.today}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'short'}).replace(/^./,letter=>letter.toUpperCase()); const reference=daControllerDateMode==='veiculacao'?'VEICULAÇÃO':'PRAZO';
  const renderPerson=row=>{ const selected=daControllerPersonId===row.user.id; const discipline=daDisciplineForUser(row.user); const checkinRunning=row.checkins.filter(entry=>daCheckinState(entry)==='running').length; const checkinNote=checkinRunning?`${checkinRunning} EM EXECUÇÃO AGORA`:row.checkins.length?`${row.checkins.length} CHECK-IN${row.checkins.length===1?'':'S'} NA DATA`:'SEM CHECK-IN LOCAL'; return `<button type="button" class="da-commitment-person ${selected?'selected':''}" style="--commitment-color:${discipline.color};--person-color:${row.user.color}" onclick="setDaControllerPerson('${row.user.id}')" title="Filtrar a visão por ${safeText(row.user.name)}"><span class="da-commitment-person-head">${daTacticalAvatar(row.user,row.user.color)}<span><b>${safeText(firstName(row.user.name))}</b><small>${safeText(discipline.short)} · ${safeText(checkinNote)}</small></span></span><span class="da-commitment-progresso" aria-hidden="true"><i style="width:${row.planned.length?Math.round((row.advances.length/row.planned.length)*100):0}%"></i></span><span class="da-commitment-metrics"><span class="${row.planned.length?'':'zero'}"><b>${row.planned.length}</b><small>planejado</small></span><span class="${row.advances.length?'':'zero'}"><b>${row.advances.length}</b><small>avançou</small></span><span class="attention ${row.notStarted.length?'':'zero'}"><b>${row.notStarted.length}</b><small>não iniciou</small></span><span class="late ${row.lastMinute.length?'':'zero'}"><b>${row.lastMinute.length}</b><small>última hora</small></span></span></button>`; };
  const audiovisual=board.people.filter(row=>daDisciplineForUser(row.user).key==='audiovisual'); const design=board.people.filter(row=>daDisciplineForUser(row.user).key==='design'); const group=(label,rows,color)=>`<div class="da-commitment-group" style="--commitment-group:${color}"><div class="da-commitment-group-head"><b>${label}</b><small>${rows.reduce((sum,row)=>sum+row.planned.length,0)} compromisso${rows.reduce((sum,row)=>sum+row.planned.length,0)===1?'':'s'} na data</small></div><div class="da-commitment-persons">${rows.map(renderPerson).join('')}</div></div>`;
  return `<section class="da-commitment-scoreboard"><div class="da-commitment-head"><div><span>◫ PLANEJADO × REALIZADO</span><b>${safeText(dateLabel)}</b><small>Base: demandas com ${reference.toLowerCase()} nesta data. “Avançou” usa a transição auditável; check-in mede tempo de execução local.</small></div><div class="da-commitment-total"><b>${board.plannedTotal}</b><span>compromissos<br>da célula</span></div></div><p class="da-commitment-frase">${(() => {
      const p=board.plannedTotal, a=board.people.reduce((t,r)=>t+r.advances.length,0);
      const n=board.people.reduce((t,r)=>t+r.notStarted.length,0);
      if(!p) return 'Nenhum compromisso com esta data.';
      if(!n) return p===1 ? 'O único compromisso do dia já andou.' : `Os ${p} compromissos do dia já andaram.`;
      const alvo = n===1 ? 'compromisso ainda não saiu' : 'compromissos ainda não saíram';
      const andou = a ? `; ${a===1?'1 avançou':`${a} avançaram`}` : '';
      return `${n} de ${p} ${alvo} do lugar${andou}.`;
    })()}</p>
    <details class="da-commitment-detalhe"><summary>Ver pessoa por pessoa</summary>
    <div class="da-commitment-groups">${group('Audiovisual',audiovisual,'#38d6ff')}${group('Design',design,'#ff9d00')}</div>
    </details></section>`;
}
function daTodayPulseHtml(snapshot) {
  const humanDate=new Date(`${snapshot.today}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'short'}).replace(/^./,letter=>letter.toUpperCase()); const today=HOJE_ISO || new Date().toISOString().slice(0,10); const historical=snapshot.today!==today;
  const people=snapshot.perPerson.length ? snapshot.perPerson.map(({user,items,finished,advanced,handedOff})=>`<span class="da-today-person" style="--today-person:${user.color}" title="${safeText(user.name)} · ${items.length} entrega(s) avançada(s) na data selecionada">${daTacticalAvatar(user,user.color)}<span><b>${safeText(firstName(user.name))}</b><small>${finished?`${finished} finalizado${finished===1?'':'s'}`:advanced?`${advanced} avanço${advanced===1?'':'s'}`:handedOff?`${handedOff} encaminhamento${handedOff===1?'':'s'}`:`${items.length} atualização${items.length===1?'':'ões'}`}</small></span></span>`).join('') : '<span class="da-today-empty">Nenhuma mudança de status registrada pela célula nesta data.</span>';
  return `<section class="da-today-pulse"><div class="da-today-pulse-lead"><span class="da-today-pulse-kicker"><i></i>${historical?'O TIME FEZ NESTE DIA':'O TIME FEZ HOJE'}</span><b>${safeText(humanDate)}</b><small>${historical?'Entregas da célula que avançaram nesta data; cada etapa preserva quem atualizou o status.':'Entregas da célula que avançaram hoje; cada etapa preserva quem atualizou o status.'}</small>${daTodayHistoryNavigatorHtml(snapshot.today)}</div><div class="da-today-pulse-metrics"><span class="da-today-pulse-metric done"><b>${snapshot.finished.length}</b><small>finalizados</small></span><span class="da-today-pulse-metric progress"><b>${snapshot.advanced.length}</b><small>em avanço</small></span><span class="da-today-pulse-metric handoff"><b>${snapshot.handedOff.length}</b><small>encaminhados</small></span><span class="da-today-pulse-metric ${snapshot.blocked.length?'blocked':''}"><b>${snapshot.blocked.length}</b><small>bloqueios</small></span></div><div class="da-today-people">${people}</div><button type="button" class="da-today-open" onclick="openDaTodayProduction()">Ver movimentações <span>→</span></button></section>`;
}
function daHistoryMs(value){ const date=new Date(value||0); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }
function daHistoryTime(ts){ const date=new Date(ts||0); return Number.isNaN(date.getTime()) ? 'Horário não informado' : date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function daHistoryActor(event,item){ const actorId=String(event?.actorId||''); const members=(typeof TEAM_USERS!=='undefined'?TEAM_USERS:(window.TEAM_USERS||[])); const team=members.find(user=>String(user.id)===actorId); return event?.actorName || team?.name || (event?.kind==='context' ? event?.actorName : '') || (actorId ? `Conta Monday ${actorId}` : 'Autor não informado'); }
function daTodayStatusProgressHtml(item,logs,selectedIso=daTodayHistoryIso()){
  const raw=logs?.statusEvents?.[String(item?.id||'')]||[]; const seen=new Set();
  const events=raw.filter(event=>new Date(event.tsMs||0).toISOString().slice(0,10)===selectedIso).filter(event=>{const key=[event.tsMs,event.previousStatus||'',event.status||'',event.actorId||''].join('|'); if(seen.has(key)) return false; seen.add(key); return Boolean(event.status);}).sort((a,b)=>a.tsMs-b.tsMs).slice(-5);
  if(!events.length) return `<div class="da-today-status-progress empty" id="da-status-trail-${safeText(item.id)}"><span>Sem transições de status registradas</span></div>`;
  return `<div class="da-today-status-progress" id="da-status-trail-${safeText(item.id)}">${events.map(event=>`<span class="da-today-status-step">${daHistoryStatusChip(event.previousStatus||'Etapa inicial')}<i>→</i>${daHistoryStatusChip(event.status)}<small>${safeText(daHistoryActor(event,item))} · ${safeText(daHistoryTime(event.tsMs))}</small></span>`).join('')}</div>`;
}
function daHistoryStatusChip(label){ const option=(STATUS_OPTIONS||[]).find(entry=>String(entry.label||'').toLowerCase()===String(label||'').toLowerCase()); const color=option?.color || '#b9aca0'; return `<span class="da-history-status" style="--history-status:${safeText(color)}">${safeText(label||'—')}</span>`; }
function daActivityHistoryEvents(item,logs={},detail=null){
  const itemId=String(item?.id||''); const events=[];
  (logs.statusEvents?.[itemId]||[]).forEach(event=>events.push({kind:'status',tsMs:event.tsMs,from:event.previousStatus||'',to:event.status||'',actorId:event.actorId,actorName:event.actorName||''}));
  (logs.prazoEvents?.[itemId]||[]).forEach(event=>events.push({kind:'deadline',tsMs:event.tsMs,from:event.previousPrazoDate||'',to:event.prazoDate||'',actorId:event.actorId,actorName:event.actorName||''}));
  (logs.veiculacaoEvents?.[itemId]||[]).forEach(event=>events.push({kind:'airdate',tsMs:event.tsMs,from:event.previousVeiculacaoDate||'',to:event.veiculacaoDate||'',actorId:event.actorId,actorName:event.actorName||''}));
  (logs.ownerEvents?.[itemId]||[]).forEach(event=>events.push({kind:'owner',tsMs:event.tsMs,actorId:event.actorId,actorName:event.actorName||''}));
  (detail?.updates||[]).forEach(update=>{ const body=workspacePlainText(update?.body||''); if(!body) return; const isStructured=/Vybe OS|Contexto de status|Passagem de bastão|Direcionamento D\.A|Check-in/i.test(body); if(!isStructured) return; const stage=body.match(/Etapa:\s*(.*?)\s*→\s*([^\n]+)/i); events.push({kind:'context',tsMs:daHistoryMs(update.created_at),actorName:update?.creator?.name||'Equipe Vybe',body,from:stage?.[1]?.trim()||'',to:stage?.[2]?.trim()||''}); });
  const seen=new Set();
  return events.filter(event=>{
    if(!event.tsMs) return false;
    const key=[event.kind,event.tsMs,event.from||'',event.to||'',event.body||''].join('|');
    if(seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b)=>b.tsMs-a.tsMs);
}
function daActivityHistoryRow(event,item){
  const actor=daHistoryActor(event,item); const time=daHistoryTime(event.tsMs); let icon='◌', title='Atualização registrada', detail='';
  if(event.kind==='status'){icon='↳'; title=`Status alterado`; detail=`${daHistoryStatusChip(event.from||'Sem etapa anterior')}<span class="da-history-arrow">→</span>${daHistoryStatusChip(event.to||'Sem etapa definida')}`;}
  if(event.kind==='deadline'){icon='◷'; title='Prazo atualizado'; detail=`${safeText(event.from||'não definido')} <span class="da-history-arrow">→</span> ${safeText(event.to||'não definido')}`;}
  if(event.kind==='airdate'){icon='◉'; title='Veiculação atualizada'; detail=`${safeText(event.from||'não definida')} <span class="da-history-arrow">→</span> ${safeText(event.to||'não definida')}`;}
  if(event.kind==='owner'){icon='◈'; title='Responsáveis atualizados'; detail='A coluna de pessoas foi alterada no Monday.';}
  if(event.kind==='context'){icon='✦'; title=event.from&&event.to?`Contexto: ${event.from} → ${event.to}`:'Contexto operacional registrado'; detail=safeText(event.body||'');}
  return `<article class="da-history-event ${safeText(event.kind)}"><div class="da-history-time">${safeText(time)}</div><div class="da-history-rail"><i>${icon}</i></div><div class="da-history-copy"><b>${safeText(title)}</b><div class="da-history-detail">${detail}</div><small>${safeText(actor)}</small></div></article>`;
}
function closeDaActivityTimeline(){ const overlay=document.getElementById('da-activity-history-overlay'); if(!overlay) return; overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
async function openDaActivityTimeline(itemId){
  const item=(DADOS_ALL?.find(entry=>String(entry.id)===String(itemId))||DADOS?.find(entry=>String(entry.id)===String(itemId))); if(!item) return showToast('Não foi possível localizar esta demanda para montar o histórico.','err'); closeDaTodayProduction(); closeDaActivityTimeline();
  const overlay=document.createElement('div'); overlay.id='da-activity-history-overlay'; overlay.className='da-activity-history-overlay'; overlay.onclick=event=>{if(event.target===overlay) closeDaActivityTimeline();}; overlay.innerHTML='<section class="da-activity-history-modal"><div class="da-activity-history-loading">Carregando histórico verificável...</div></section>'; document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
  try{ const [logs,detail]=await Promise.all([fetchActivityLogs(),fetchWorkspaceItem(itemId).catch(()=>null)]); const events=daActivityHistoryEvents(item,logs,detail); const owner=daTacticalOwner(item); const rows=events.length?events.map(event=>daActivityHistoryRow(event,item)).join(''):'<div class="da-history-empty">Ainda não há eventos auditáveis disponíveis para esta demanda no período carregado.</div>'; const modal=overlay.querySelector('.da-activity-history-modal'); modal.innerHTML=`<div class="da-activity-history-head"><div><span>Histórico verificável · Atividade</span><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(firstName(owner?.name||item.responsavel||'Equipe'))} · ${events.length} evento(s) auditável(is)</small></div><button class="x-fechar" type="button" onclick="closeDaActivityTimeline()" aria-label="Fechar histórico">×</button></div><div class="da-activity-history-current"><span>${daTacticalFormatTag(item)}</span>${daTacticalStatusTag(item)}<button type="button" onclick="closeDaActivityTimeline();openItemWorkspace('${item.id}')">Abrir workspace →</button></div><div class="da-history-note">Transições e datas vêm do histórico da peça; contextos registrados pelo Vybe OS complementam a decisão operacional.</div><div class="da-history-list">${rows}</div>`; }catch(error){ const modal=overlay.querySelector('.da-activity-history-modal'); if(modal) modal.innerHTML=`<div class="da-activity-history-head"><div><span>Histórico da atividade</span><b>${safeText(item.nome)}</b></div><button class="x-fechar" type="button" onclick="closeDaActivityTimeline()">×</button></div><div class="da-history-empty">Não foi possível carregar o histórico verificável agora. ${safeText(error.message)}</div>`; }
}
function closeDaTodayProduction(){ const overlay=document.getElementById('da-today-production-overlay'); if(!overlay) return; overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
async function openDaTodayProduction(){
  const logs=await daLoadTodayStatusLogs(); const snapshot=daTodayProductionSnapshot(daControllerTeam(),logs); closeDaTodayProduction();
  const overlay=document.createElement('div'); overlay.id='da-today-production-overlay'; overlay.className='da-today-production-overlay'; overlay.onclick=event=>{if(event.target===overlay) closeDaTodayProduction();};
  overlay.innerHTML='<section class="da-today-production-modal" role="dialog" aria-modal="true"><div class="da-activity-history-loading">Carregando progressão de status...</div></section>';
  document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
  const rows=snapshot.movements.length ? snapshot.movements.map(item=>{const owner=daTacticalOwner(item); const executor=daControllerTeam().find(user=>String(user.id)===String(item._todayExecutorId||''))||owner||{name:item._todayExecutorName||'Executor não informado',color:'#67e8d2'}; const mover=daControllerTeam().find(user=>String(user.id)===String(item._todayActorId||''))||{name:item._todayActorName||'Autor não informado',color:'#67e8d2'}; const dayStatus=item._todayStatus||item.status; const kind=['Finalizado','Feito'].includes(dayStatus)?'done':['Para aprovação','Para agendar','Agendado','Ag. Aprovação Cliente'].includes(dayStatus)?'handoff':daControllerBlocked({...item,status:dayStatus})?'blocked':'progress'; return `<article class="da-today-timeline-row ${kind}"><span class="da-today-timeline-time">${safeText(daTodayMovementTime(item))}</span><span class="da-today-timeline-owner">${daTacticalAvatar(executor,executor?.color || '#67e8d2')}</span><span class="da-today-timeline-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · entrega de ${safeText(firstName(executor?.name||'Equipe'))} · status atualizado por ${safeText(firstName(mover?.name||'Autor não informado'))}</small></span><span class="da-today-timeline-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag({...item,status:item._todayStatus||item.status})}</span><div class="da-today-status-progress-cell">${daTodayStatusProgressHtml(item,logs,snapshot.today)}</div></article>`;}).join('') : '<div class="da-today-timeline-empty">Ainda não há movimentações registradas hoje para a célula criativa.</div>';
  overlay.innerHTML=`<section class="da-today-production-modal" role="dialog" aria-modal="true" aria-label="Produção realizada hoje"><div class="da-today-production-modal-head"><div><span>O time fez hoje</span><b>${safeText(new Date(`${snapshot.today}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}))}</b><small>${snapshot.movements.length} entrega(s) da célula avançaram · executor, status e auditoria por horário</small></div><button class="x-fechar" type="button" onclick="closeDaTodayProduction()" aria-label="Fechar produção do dia">×</button></div><div class="da-today-timeline">${rows}</div></section>`;
}
function daAgendaDayInfo(iso) { const date=new Date(`${iso}T12:00:00`); const names=['DOM','SEG','TER','QUA','QUI','SEX','SÁB']; return {name:names[date.getDay()], date:date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}), weekend:[0,6].includes(date.getDay())}; }
function daQuickWeekdaysHtml(range,items) { if(daControllerPeriod!=='week') return ''; const labels=['SEG','TER','QUA','QUI','SEX']; return `<div class="da-quick-weekdays"><span class="da-quick-label">Foco rápido</span>${labels.map((label,offset)=>{const iso=daControllerIsoAt(range.start,offset); const count=items.filter(item=>daControllerDate(item)===iso && !['Para agendar','Agendado'].includes(item.status)).length; const active=daControllerDayFocusIso===iso; return `<button type="button" class="da-quick-day ${active?'active':''}" onclick="setDaQuickWeekday('${iso}')" title="${active?'Limpar':'Focar'} ${label} ${daAgendaDayInfo(iso).date}">${label}<span>${count}</span></button>`;}).join('')}</div>`; }
function daFocusedDayDetailHtml(items,team) { if(!daControllerDayFocusIso) return ''; const info=daAgendaDayInfo(daControllerDayFocusIso); const dayItems=items.filter(item=>daControllerDate(item)===daControllerDayFocusIso && !['Para agendar','Agendado'].includes(item.status)).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b)); const rows=dayItems.map(item=>{const owner=daTacticalOwner(item,team); const reference=`${daControllerDateMode==='veiculacao'?'VEICULAÇÃO':'PRAZO'} ${daControllerDateLabel(item)}`; return `<article class="da-day-focus-row"><span class="da-day-focus-avatar">${daTacticalOwnerEditor(item,owner,owner?.color || '#ff9d00')}</span><button type="button" class="da-day-focus-open" onclick="openItemWorkspace('${item.id}')" aria-label="Abrir contexto de ${safeText(item.nome)}"><span class="da-day-focus-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(firstName(owner?.name||'Equipe'))}</small></span></button><span class="da-day-focus-status">${daTacticalFormatTag(item)}${daTacticalStatusTag(item)}</span><span class="da-day-focus-tools">${quickDateDaTrigger(item)}<small>${safeText(reference)}</small></span></article>`;}).join('') || '<div class="da-empty-tactical">Nenhuma entrega criativa ativa neste dia.</div>'; return `<section class="da-day-focus-panel da-day-workspace"><div class="da-day-focus-head"><span><b>FILA DO DIA · ${info.name} ${info.date}</b> <span>· ${dayItems.length} entrega${dayItems.length===1?'':'s'} para conduzir</span></span></div><div class="da-day-focus-list">${rows}</div></section>`; }
function daCheckinDayBoardHtml(items,team){
  const today=HOJE_ISO||new Date().toISOString().slice(0,10); const iso=daControllerDayFocusIso||today; const info=daAgendaDayInfo(iso); const daily=items.filter(item=>daControllerDate(item)===iso&&!['Para agendar','Agendado'].includes(item.status)).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b));
  if(!daily.length) return ''; const current=iso===today; const rows=daily.map(item=>{ const owner=daTacticalOwner(item,team); return `<article class="da-execution-row"><button type="button" class="da-execution-open" onclick="openItemWorkspace('${item.id}')" aria-label="Abrir contexto de ${safeText(item.nome)}"><span class="da-execution-owner">${daTacticalPersonVisual(owner,owner?.color||'#ff9d00')}</span><span class="da-execution-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(firstName(owner?.name||'Equipe'))}</small></span><span class="da-execution-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag(item)}</span></button>${daCheckinControlsHtml(item,owner)}</article>`; }).join('');
  return `<section class="da-execution-board ${current?'current':''}"><div class="da-execution-board-head"><div><b>◷ EXECUÇÃO REAL · ${safeText(info.name)} ${safeText(info.date)}</b><small>${current?'Use o check-in para registrar o tempo efetivo; esse registro permanece local e não cria atualização no Monday.':'Consulta histórica de check-ins locais desta data; novos registros só são permitidos hoje.'}</small></div><span>${daily.length} atividade${daily.length===1?'':'s'}</span></div><div class="da-execution-list">${rows}</div></section>`;
}
function daWeekDeliveryHtml(item,team) { const owner=daTacticalOwner(item,team); const context=item.status_context?.reason || (daControllerBlocked(item)?'Há uma dependência ou decisão pendente nesta etapa.':'Sem contexto registrado ainda. Abra a demanda para orientar ou atualizar.'); const ref=`${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'}: ${daControllerDateLabel(item)}`; return `<button type="button" class="da-week-delivery" onclick="openItemWorkspace('${item.id}')" aria-label="Abrir contexto de ${safeText(item.nome)}"><span class="da-week-owner">${daTacticalOwnerEditor(item,owner,owner?.color || '#ff9d00')}${quickDateDaTrigger(item)}<span>${safeText(item.cliente || 'Sem cliente')}</span></span><span class="da-week-item-name">${safeText(item.nome)}</span><span class="da-week-item-meta">${daTacticalFormatTag(item)}${daTacticalStatusTag(item)}</span><span class="da-week-hover"><strong>${daTacticalPersonVisual(owner,owner?.color || '#ff9d00')}${safeText(owner?.name || 'Equipe')}</strong><span>${safeText(ref)}<br>${safeText(context)}</span><small>Clique para abrir contexto e agir →</small></span></button>`; }
function daMemberFocusHtml(user, scopedItems, scopedPeriod, today) { if(!user) return ''; const active=scopedPeriod.filter(item=>operationalFlowStatus(item)==='Em andamento'); const late=scopedPeriod.filter(item=>daControllerRisk(item)?.level==='critical'); const blocked=scopedPeriod.filter(daControllerBlocked); const next=[...scopedPeriod].filter(item=>{const date=daControllerDate(item); return date && date>=today && !['Para agendar','Agendado'].includes(operationalFlowStatus(item));}).sort((a,b)=>(daControllerDate(a)||'').localeCompare(daControllerDate(b)||''))[0]; const visual=user.photo?`<img class="da-member-avatar" src="${user.photo}" alt="${safeText(user.name)}">`:`<span class="da-member-avatar da-member-avatar-fallback" style="background:${user.color}">${safeText(firstName(user.name).slice(0,2).toUpperCase())}</span>`; const nextLabel=next?`${daControllerDateLabel(next)} · ${next.nome}`:'Sem nova entrega'; const riskTotal=late.length+blocked.length; return `<section class="da-member-focus" style="--da-member-color:${user.color}"><div class="da-member-ident">${visual}<span><span class="da-member-eyebrow">Filtro ativo</span><b class="da-member-name">${safeText(user.name)}</b><small class="da-member-role">${safeText(DA_CONTROLLER_ROLES[user.id] || 'Criação')} · agenda e riscos pessoais</small></span></div><div class="da-member-metric"><b>${scopedPeriod.length}</b><span>No período</span></div><div class="da-member-metric ${riskTotal?'danger':''}"><b>${riskTotal}</b><span>Riscos ativos</span></div><div class="da-member-metric ${active.length?'warn':''}"><b>${active.length}</b><span>Em execução</span></div><div class="da-member-metric"><b>${safeText(nextLabel)}</b><span>Próxima entrega</span></div><button type="button" class="da-member-workload-open" onclick="openDaIndividualPlanningDesk('${user.id}')">PLANEJAR PRAZOS ↗</button><button type="button" class="da-member-return" onclick="setDaControllerPerson('all')">LIMPAR FILTRO ×</button></section>`; }
function daMemberProductionHtml(user,items) {
  if(!user) return '';
  const pending=items.filter(item=>!isFinishedItem(item));
  const groups=new Map();
  const weekKey=iso=>{ if(!iso) return 'sem-data'; const date=new Date(`${iso}T12:00:00`); const offset=(date.getDay()+6)%7; date.setDate(date.getDate()-offset); return date.toISOString().slice(0,10); };
  pending.sort((a,b)=>{const aa=daControllerDate(a)||'9999-12-31';const bb=daControllerDate(b)||'9999-12-31';return aa.localeCompare(bb)||daTacticalScore(a)-daTacticalScore(b);}).forEach(item=>{const key=weekKey(daControllerDate(item)); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(item);});
  const weekHtml=[...groups.entries()].map(([key,group])=>{const start=key==='sem-data'?null:key; const end=start?daControllerIsoAt(start,6):null; const label=start?`SEMANA · ${daAgendaDayInfo(start).date}–${daAgendaDayInfo(end).date}`:'SEM DATA DE REFERÊNCIA'; const rows=group.map(item=>{const date=daControllerDate(item); const dateLabel=date?`${daAgendaDayInfo(date).name} ${daAgendaDayInfo(date).date}`:'SEM DATA'; return `<button type="button" class="da-member-production-row" onclick="openItemWorkspace('${item.id}')" title="Abrir contexto de ${safeText(item.nome)}"><span class="da-member-production-date">${safeText(dateLabel)}</span><span class="da-member-production-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')}</small></span><span class="da-member-production-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag(item)}</span></button>`;}).join(''); return `<section class="da-member-production-week"><div class="da-member-production-week-head"><b>${safeText(label)}</b><span>${group.length} entrega${group.length===1?'':'s'}</span></div>${rows}</section>`;}).join('') || '<div class="da-empty-tactical">Nenhuma entrega ativa no período selecionado.</div>';
  return `<section class="da-member-production"><div class="da-member-production-head"><b>PRODUÇÃO DE ${safeText(firstName(user.name).toUpperCase())} NO PERÍODO · ${pending.length} ENTREGA${pending.length===1?'':'S'}</b><small>Toda a carga ativa aparece aqui; riscos continuam separados acima.</small></div><div class="da-member-production-weeks">${weekHtml}</div></section>`;
}
function daWeekAgendaHtml(items,range,team,today) {
  const dates=[];
  if (daControllerPeriod==='week') {
    for(let offset=0;offset<7;offset++) dates.push(daControllerIsoAt(range.start,offset));
  } else if (daControllerPeriod==='month') {
    for(let iso=range.start;iso<=range.end;iso=daControllerIsoAt(iso,1)) dates.push(iso);
  } else {
    dates.push(range.start);
  }
  const isMonth=daControllerPeriod==='month';
  const title=isMonth?'MAPA DE ENTREGAS DO MÊS':daControllerPeriod==='week'?'RÉGUA DE ENTREGAS DA SEMANA':'DIA DE ENTREGA';
  const focus=daAgendaDayInfo(daControllerDayFocusIso || range.start);
  const leading=isMonth ? '<span class="da-month-empty"></span>'.repeat(new Date(`${range.start}T12:00:00`).getDay()) : '';
  const rail=dates.map(iso=>{const info=daAgendaDayInfo(iso); const active=daControllerDayFocusIso===iso; const dayItems=items.filter(item=>daControllerDate(item)===iso && !['Para agendar','Agendado'].includes(operationalFlowStatus(item))); const alerts=dayItems.filter(item=>daControllerBlocked(item)||['critical','high'].includes(daControllerRisk(item)?.level)).length; const owners=[...new Map(dayItems.map(item=>{const owner=daTacticalOwner(item,team); return [owner?.id||`none-${item.id}`,owner];})).values()].filter(Boolean).slice(0,4); const extraOwners=Math.max(0,new Set(dayItems.flatMap(item=>assignedIds(item))).size-owners.length); const state=alerts?`${alerts} alerta${alerts===1?'':'s'} para conduzir`:(dayItems.length?'sem alerta imediato':'sem entrega'); return `<button type="button" class="da-week-rail-day ${active?'active':''} ${iso===today?'today':''}" onclick="setDaControllerDayFocus('${iso}')" title="Abrir fila de ${info.name} ${info.date}"><span class="da-week-rail-top"><b>${info.name} <span>${info.date}</span></b><span class="da-week-rail-count">${dayItems.length}</span></span><span class="da-week-rail-avatars">${owners.map(owner=>daTacticalPersonVisual(owner,owner.color)).join('')}${extraOwners?`<span class="da-tactical-person" title="Mais ${extraOwners} pessoa${extraOwners===1?'':'s'}"><span style="background:#5f4939">+${extraOwners}</span></span>`:''}</span><span class="da-week-rail-info"><b>${dayItems.length?`${dayItems.length} entrega${dayItems.length===1?'':'s'}`:'Sem entrega'}</b><small class="${alerts?'risk':''}">${safeText(state)}</small></span></button>`;}).join('');
  return `<section class="da-week-agenda"><div class="da-week-agenda-head"><b>▦ ${title}</b><span>${isMonth?'O mês inteiro está visível. Escolha um dia para abrir a fila de trabalho.':'Escolha um dia para abrir a fila de trabalho.'} Dia ativo: ${focus.name} ${focus.date}</span></div><div class="da-week-rail ${isMonth?'month':''}">${leading}${rail}</div></section>`;
}
const DA_APPROVAL_RADAR_STATUSES=new Set(['Para aprovação','Ag. Aprovação Cliente','Ag. Interno']);
function daDailyCommandSource(){ return daControllerItemsFor('all').filter(item=>!isFinishedItem(item)); }
function daDailyCommandEntries(kind){ const today=HOJE_ISO||new Date().toISOString().slice(0,10); const source=daDailyCommandSource(); const productionExcluded=new Set(['Para agendar','Agendado','Para aprovação','Ag. Aprovação Cliente','Ag. Interno']); const unique=list=>[...new Map(list.map(item=>[`${item.board_id||BOARD_ID}:${String(item.id)}`,item])).values()]; const entries=kind==='publish'?source.filter(item=>String(item.veiculacao_iso||'')===today):kind==='produce'?source.filter(item=>String(item.prazo_iso||'')===today&&!productionExcluded.has(String(operationalFlowStatus(item)||''))):kind==='approval'?source.filter(item=>DA_APPROVAL_RADAR_STATUSES.has(String(operationalFlowStatus(item)||''))):source.filter(item=>daControllerRisk(item)?.level==='critical'||daControllerBlocked(item)); return unique(entries).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b)); }
function daDailyCommandSpec(kind){ const items=daDailyCommandEntries(kind); const specs={publish:{kicker:'Publicar hoje',label:'veiculações a garantir',copy:items.length?'Confirme material e agendamento antes do horário de publicação.':'Nenhuma veiculação ativa na data de hoje.',color:'#00d184'},produce:{kicker:'Produzir hoje',label:'demandas de criação',copy:items.length?'Prazo de hoje que ainda exige execução da célula criativa.':'Nenhuma produção pendente com prazo para hoje.',color:'#ffb451'},approval:{kicker:'Aprovar agora',label:'decisões pendentes',copy:items.length?'Abra prévia, decida e libere a próxima etapa.':'Nenhuma aprovação ativa para a célula.',color:'#8ea2ff'},risk:{kicker:'Risco e atraso',label:'itens a destravar',copy:items.length?'Atrasos e bloqueios que podem quebrar a sequência.':'Nenhum atraso ou bloqueio ativo.',color:'#ff637a'}}; return {...specs[kind],kind,items}; }
// A linha da fila deixou de ser um <button> para poder ter um botao dentro dela:
// botao dentro de botao nao e HTML valido, e o clique de um comeria o do outro.
// Vira uma div que se comporta como botao — clique e Enter abrem a peca.
function daFilaAbrirPeca(itemId, event){
  if (event?.target?.closest?.('button, a, input')) return;
  closeWorkflowModal();
  openItemWorkspace(String(itemId));
}

// Excluir daqui fecha a fila: a lista foi montada antes da exclusao e mostraria
// uma peca que nao existe mais. Fecha so quando a exclusao acontece de verdade —
// quem desiste na pergunta continua olhando a fila.
async function daFilaExcluirPeca(itemId){
  if (await removerPeca(String(itemId))) closeWorkflowModal();
}

function daDailyCommandModalRow(item){ const owner=daTacticalOwner(item); const ref=item.veiculacao_iso?`VEICULAÇÃO ${planningDateBr(item.veiculacao_iso)}`:item.prazo_iso?`PRAZO ${planningDateBr(item.prazo_iso)}`:'SEM DATA'; const podeExcluir=typeof podeAdministrar==='function'&&podeAdministrar(); return `<div class="da-command-modal-row" role="button" tabindex="0" onclick="daFilaAbrirPeca('${item.id}',event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();daFilaAbrirPeca('${item.id}',event);}"><span class="da-command-modal-owner">${daTacticalPersonVisual(owner,owner?.color||'#ff9d00')}</span><span class="da-command-modal-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(firstName(owner?.name||'Equipe'))} · ${safeText(ref)}</small></span><span class="da-command-modal-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag(item,true)}</span>${podeExcluir?`<button type="button" class="da-fila-excluir" title="Excluir ${safeText(item.nome||'esta demanda')}" aria-label="Excluir demanda" onclick="event.stopPropagation();daFilaExcluirPeca('${item.id}')">${typeof ICONE!=='undefined'?ICONE.lixo:'×'}</button>`:''}</div>`; }
function openDaDailyCommand(kind){ if(kind==='approval') return openDaApprovalRadar(); const spec=daDailyCommandSpec(kind); const rows=spec.items.length?spec.items.map(daDailyCommandModalRow).join(''):'<div class="da-approval-radar-empty">✓ Nenhuma demanda nesta fila.</div>'; openWorkflowModal(`<div class="workflow-kicker"><span>VYBE OS · ${safeText(spec.kicker)}</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">${safeText(spec.label)}</h2><p class="workflow-copy">${safeText(spec.copy)}</p><div class="da-command-modal-list">${rows}</div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button></div>`); }
function daDailyCommandHtml(){ const specs=['publish','produce','approval','risk'].map(daDailyCommandSpec); const cards=specs.map((spec,index)=>{ const vazia=spec.items.length===0; return `<button type="button" class="da-command-daily-card ${index===0&&!vazia?'is-primary':''} ${spec.kind==='risk'&&!vazia?'is-risk':''} ${vazia?'vazia':''}" style="--command-color:${spec.color}" ${vazia?'disabled aria-disabled="true"':`onclick="openDaDailyCommand('${spec.kind}')"`}><span class="da-command-daily-kicker">${safeText(spec.kicker)}</span><b class="da-command-daily-count">${spec.items.length}</b><span class="da-command-daily-label">${safeText(spec.label)}</span><span class="da-command-daily-copy">${safeText(spec.copy)}</span><span class="da-command-daily-go">${vazia?'nada nesta fila':'Abrir fila →'}</span></button>`; }).join(''); return `<section class="da-command-daily"><div class="da-command-daily-head"><div><b>Mesa de comando · Hoje</b><small>Uma ordem única de decisão para a Direção de Arte.</small></div><span class="da-command-daily-rule">Prioridade: <strong>veicular</strong> → <strong>produzir</strong> → <strong>aprovar</strong> → <strong>destravar risco</strong>.</span></div><div class="da-command-daily-grid">${cards}</div></section>`; }
function closeDaApprovalRadar(){ const overlay=document.getElementById('da-approval-radar-overlay'); if(!overlay) return; overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
function daApprovalWaitText(item){ const clock=daStatusClock(item); const days=Math.max(0,Number(clock?.days||0)); if(!days) return 'ENTROU HOJE'; return `${days} DIA${days===1?'':'S'} AGUARDANDO`; }
function daApprovalPreviewAsset(detail){ const updates=(detail?.updates||[]).flatMap(update=>update?.assets||[]); const assets=[...(detail?.assets||[]),...updates]; return assets.find(asset=>asset?.public_url||asset?.url_thumbnail||asset?.url)||null; }
function daApprovalCardHtml(item,detail){ const owner=daTacticalOwner(item); const rule=ownerEligibility(item); const asset=daApprovalPreviewAsset(detail); const source=asset?.public_url||asset?.url_thumbnail||asset?.url||''; const preview=source?`<img src="${safeText(source)}" alt="Prévia de ${safeText(item.nome)}">`:`<div class="da-approval-preview-empty">Sem prévia<br>Abra o material para revisar.</div>`; const eligible=(rule?.users||[]).map(user=>firstName(user.name)).join(', ')||'Responsável não definido'; const actions=`<button type="button" class="approve" onclick="daApprovalApprove('${item.id}')">Aprovar → agendar</button><button type="button" class="return" onclick="daApprovalReturn('${item.id}')">Devolver para alteração</button>`; return `<article class="da-approval-card"><div class="da-approval-preview">${preview}</div><div class="da-approval-copy"><div class="da-approval-topline">${daTacticalStatusTag(item,true)}<span class="da-approval-wait">${safeText(daApprovalWaitText(item))}</span></div><h3>${safeText(item.nome)}</h3><div class="da-approval-meta">${safeText(item.cliente||'Sem cliente')} · entregue por ${safeText(firstName(owner?.name||'Equipe'))}</div><div class="da-approval-routing">Decisão de Direção disponível agora. Em devoluções, o responsável continua limitado à disciplina elegível: ${safeText(eligible)}.</div><div class="da-approval-actions"><button type="button" onclick="daApprovalOpenWorkspace('${item.id}')">Ver material</button>${actions}</div></div></article>`; }
async function openDaApprovalRadar(){ closeDaApprovalRadar(); const items=daDailyCommandEntries('approval'); const overlay=document.createElement('div'); overlay.id='da-approval-radar-overlay'; overlay.className='da-approval-radar-overlay'; overlay.onclick=event=>{if(event.target===overlay) closeDaApprovalRadar();}; overlay.innerHTML=`<section class="da-approval-radar" role="dialog" aria-modal="true" aria-label="Radar de aprovação"><div class="da-approval-radar-head"><div><span>Vybe OS · Radar de aprovação</span><b>Aprovar agora</b><small>${items.length} demanda${items.length===1?'':'s'} aguardando uma decisão. Design é decidido por Deivid; Audiovisual exibe o aprovador elegível.</small></div><button type="button" class="da-approval-radar-close" onclick="closeDaApprovalRadar()" aria-label="Fechar radar">×</button></div><div class="da-approval-radar-summary"><span><b>Fluxo:</b> prévia → decisão → próxima etapa registrada no Vybe OS.</span><span>${items.length} na fila</span></div><div id="da-approval-radar-list" class="da-approval-radar-list">${items.length?'<div class="da-approval-loading">Carregando prévias e contexto...</div>':'<div class="da-approval-radar-empty">✓ Nenhuma aprovação ativa para a célula criativa.</div>'}</div></section>`; document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open')); if(!items.length) return; const details=await Promise.all(items.map(item=>fetchWorkspaceItem(item.id).catch(()=>null))); const list=document.getElementById('da-approval-radar-list'); if(list&&document.getElementById('da-approval-radar-overlay')) list.innerHTML=items.map((item,index)=>daApprovalCardHtml(item,details[index])).join(''); }
function daApprovalOpenWorkspace(itemId){ closeDaApprovalRadar(); openItemWorkspace(itemId); }
function daApprovalApprove(itemId){ const item=(DADOS_ALL||DADOS||[]).find(entry=>String(entry.id)===String(itemId)); const option=STATUS_OPTIONS.find(entry=>normalizedWorkflowStatus(entry.label)==='para agendar'); if(!item||!option) return showToast('Não foi possível preparar a aprovação desta demanda.','err'); closeDaApprovalRadar(); openQualityGate(item,option); }
function daApprovalReturn(itemId){ const item=(DADOS_ALL||DADOS||[]).find(entry=>String(entry.id)===String(itemId)); const option=STATUS_OPTIONS.find(entry=>normalizedWorkflowStatus(entry.label)==='alteração'); if(!item||!option) return showToast('Não foi possível preparar a devolução desta demanda.','err'); closeDaApprovalRadar(); openStatusContextGate(item,option); }
function daTacticalBacklogRow(item,team) { const owner=daTacticalOwner(item,team); const ref=daControllerDate(item)?`${daControllerDateMode==='veiculacao'?'Veiculação':'Prazo'} ${daControllerDateLabel(item)}`:'Sem data'; return `<div class="da-backlog-row" onclick="openItemWorkspace('${item.id}')" title="Clique para abrir contexto">${vybeChipId(item)}${daTacticalListAvatar(owner)}<span class="da-backlog-copy"><button type="button" class="da-backlog-name" onclick="event.stopPropagation();openItemWorkspace('${item.id}')">${safeText(item.nome)}</button><span class="da-backlog-meta">${daTacticalFormatTag(item)} · ${safeText(ref)}</span></span>${daTacticalStatusTag(item,true)}</div>`; }
function renderDaControllerTactical() {
  const dash=document.getElementById('da-controller-dashboard'); if (!dash) return;
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const range=daControllerPeriodRange(); const team=daControllerTeam(); const allItems=daControllerItemsFor('all'); const scopedItems=daControllerItemsFor(daControllerPersonId); const selectableDates=[...new Set(scopedItems.filter(item=>daControllerInPeriod(item,range)).map(daControllerDate).filter(Boolean))].sort(); if(!daControllerDayFocusIso || daControllerDayFocusIso<range.start || daControllerDayFocusIso>range.end){ daControllerDayFocusIso=selectableDates.includes(today)?today:(selectableDates.find(iso=>iso>=today)||selectableDates[0]||range.start); } const allPeriod=allItems.filter(item=>daControllerInPeriod(item,range)); const scopedPeriod=scopedItems.filter(item=>daControllerInPeriod(item,range)); const focusedItems=daControllerDayFocusIso ? scopedPeriod.filter(item=>daControllerDate(item)===daControllerDayFocusIso) : scopedPeriod; const isIndividualView=daControllerPersonId!=='all'; const useFocusedScope=daControllerPeriod!=='month' && Boolean(daControllerDayFocusIso); const headlineItems=useFocusedScope ? focusedItems : (isIndividualView ? scopedPeriod : allPeriod); const backlogCritical=scopedItems.filter(item=>{const date=daControllerDate(item); return Boolean(date && date<range.start && (daControllerBlocked(item) || daControllerRisk(item)?.level==='critical'));}).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b)); const lateInWindow=(isIndividualView ? scopedPeriod : allPeriod).filter(item=>daControllerRisk(item)?.level==='critical'); const summaries=team.map(user=>({user,metrics:daControllerPersonMetrics(user)})); const maxLoad=Math.max(1,...summaries.map(entry=>entry.metrics.period.length)); const disciplineSummaryHtml=Object.values(DA_DISCIPLINES).map(discipline=>{const members=summaries.filter(entry=>daDisciplineForUser(entry.user).key===discipline.key); const totalPoints=members.reduce((sum,entry)=>sum+entry.metrics.capacity.workload,0); const late=members.reduce((sum,entry)=>sum+entry.metrics.late.length,0); const blocked=members.reduce((sum,entry)=>sum+entry.metrics.blocked.length,0); const saturated=members.some(entry=>entry.metrics.capacity.state==='saturada'); const action=discipline.key==='audiovisual'?(saturated?'PROTEGER PRAZO · ANTECIPAR BRIEFING':'LINHA DE VÍDEO & MOTION SOB CONTROLE'):(saturated?'EQUILIBRAR DESIGN ENTRE DEIVID, BIA E JADY':'CÉLULA DE DESIGN EQUILIBRADA'); return `<section class="da-discipline-card" style="--discipline-color:${discipline.color}"><b>${discipline.label}</b><span>${totalPoints} pontos de esforço · ${late} atraso${late===1?'':'s'} · ${blocked} bloqueio${blocked===1?'':'s'}</span><small>${action} · estimativa por complexidade</small></section>`;}).join('');
  const extremeEscalations=scopedItems.filter(item=>daCriticalEscalation(item).level==='extreme'); const periodWork=(daControllerPeriod==='month'?scopedPeriod:focusedItems).filter(item=>!['Para agendar','Agendado'].includes(operationalFlowStatus(item))); const primaryPool=extremeEscalations.length?extremeEscalations:(periodWork.length?periodWork:backlogCritical); const priority=[...primaryPool].sort((a,b)=>daTacticalScore(a)-daTacticalScore(b))[0] || null; const priorityInfo=priority?daTacticalActionInfo(priority):{verb:'CÉLULA ESTÁVEL',copy:'Não há intervenção pendente dentro da janela atual.',color:'#00d184'}; const owner=priority?daTacticalOwner(priority,team):null; const selectedUser=daControllerPersonId==='all'?null:team.find(user=>user.id===daControllerPersonId) || null; const selectedName=selectedUser?firstName(selectedUser.name):'Toda a célula criativa'; const memberFocusHtml=daMemberFocusHtml(selectedUser,scopedItems,scopedPeriod,today); const memberProductionHtml=daMemberProductionHtml(selectedUser,scopedPeriod); const selectedDiscipline=selectedUser?daDisciplineForUser(selectedUser):null; daCurrentContextBar=`<section class="da-barra">
    <div class="da-barra-grupo">
      <span class="da-barra-rotulo">Janela</span>
      <div class="da-segmento" role="group" aria-label="Janela de planejamento">
        ${[['day','Dia'],['week','Semana'],['month','Mês']].map(([chave,rotulo])=>
          `<button type="button" class="${daControllerPeriod===chave?'marcado':''}"
             aria-pressed="${daControllerPeriod===chave}"
             onclick="setDaControllerPeriod('${chave}')">${rotulo}</button>`).join('')}
      </div>
      <span class="da-barra-periodo">${safeText(range.label)}</span>
    </div>
    <div class="da-barra-grupo">
      <span class="da-barra-rotulo">Contar por</span>
      <div class="da-segmento" role="group" aria-label="Data de referência">
        ${[['prazo','Prazo'],['veiculacao','Veiculação']].map(([chave,rotulo])=>
          `<button type="button" class="${daControllerDateMode===chave?'marcado':''}"
             aria-pressed="${daControllerDateMode===chave}"
             onclick="setDaControllerDateMode('${chave}')">${rotulo}</button>`).join('')}
      </div>
    </div>
    <div class="da-barra-grupo da-barra-pessoa">
      <span class="da-barra-rotulo">Pessoa</span>
      ${selectedUser
        ? `<span class="da-barra-quem" style="--cor-pessoa:${selectedUser.color}">
             ${daTacticalPersonVisual(selectedUser,selectedUser.color)}
             <b>${safeText(selectedName)}</b>
             ${selectedDiscipline?`<small>${safeText(selectedDiscipline.label)}</small>`:''}
           </span>
           <button type="button" class="da-barra-acao" onclick="openDaIndividualPlanningDesk('${selectedUser.id}')">Organizar agenda →</button>
           <button type="button" class="da-barra-limpar" onclick="setDaControllerPerson('all')" aria-label="Ver toda a célula">Toda a célula</button>`
        : `<span class="da-barra-quem vazia"><b>Toda a célula criativa</b></span>
           <span class="da-barra-dica">Clique em alguém abaixo para ver só a carga dela.</span>`}
    </div>
  </section>`; const scopeReference=daControllerPeriod==='month'?'neste mês':daControllerPeriod==='week'?'nesta semana':'hoje'; const scopePossessive=daControllerPeriod==='month'?'deste mês':daControllerPeriod==='week'?'desta semana':'deste dia'; const directionStatuses=['Alteração','Falta Info','Falta D.A','Para aprovação','Ag. Interno','Aguardo','Ag. Aprovação Cliente','Ag. Info Cliente']; const withoutPrimary=item=>String(item.id)!==String(priority?.id||''); const directionActions=periodWork.filter(item=>withoutPrimary(item)&&(daControllerBlocked(item)||directionStatuses.includes(operationalFlowStatus(item)))).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b)).slice(0,4); const deliveryRisks=periodWork.filter(item=>withoutPrimary(item)&&!directionStatuses.includes(operationalFlowStatus(item))&&(operationalFlowStatus(item)==='Em andamento'||daControllerRisk(item)?.level==='critical'||daControllerRisk(item)?.level==='high')).sort((a,b)=>daTacticalScore(a)-daTacticalScore(b)).slice(0,4); const backlog=backlogCritical.filter(withoutPrimary).slice(0,5); const backlogCount=backlog.length;
  const focusDayInfo=daControllerDayFocusIso?daAgendaDayInfo(daControllerDayFocusIso):null; const priorityBasis=priority?daTacticalPriorityContext(priority,team):null; const priorityColor=priorityBasis?.escalation?.level==='extreme'?'#df2f4a':priorityInfo.color; const decisionWindow=priorityBasis?.escalation?.level==='extreme'?`ESCALAÇÃO CRÍTICA · ${priorityBasis.escalation.overdueDays} DIAS EM ATRASO`:daControllerPeriod==='month'?'MÊS EM FOCO':focusDayInfo?`DIA SELECIONADO · ${focusDayInfo.name} ${focusDayInfo.date}`:'JANELA ATUAL'; const priorityBasisHtml=priorityBasis?`<div class="da-priority-basis"><span class="da-priority-label">Por que agora</span>${priorityBasis.reasons.map(reason=>`<span class="da-priority-reason">${safeText(reason)}</span>`).join('')}</div>`:'';
  const decisionHtml=priority?`<section class="da-decision-card" style="--da-decision-color:${priorityColor}"><span class="da-decision-rail"></span><div class="da-decision-main"><div class="da-decision-kicker"><i></i>DECISÃO DE DIREÇÃO · ${decisionWindow}</div><h3 class="da-decision-title">${priorityBasis?.escalation?.level==='extreme'?'EXTREMA URGÊNCIA':safeText(priorityInfo.verb)}: ${safeText(priority.nome)}</h3><div class="da-decision-detail"><b>${safeText(priority.cliente||'Sem cliente')}</b><span>·</span><span>${safeText(priorityInfo.copy)}</span></div>${priorityBasisHtml}<div class="da-decision-owner">${daTacticalOwnerEditor(priority,owner,priorityColor)}${quickDateDaTrigger(priority)}${daTacticalFormatTag(priority)}${daTacticalStatusTag(priority,true)}</div></div><div class="da-decision-side"><small>${safeText(daControllerDateMode==='veiculacao'?'Veiculação':'Prazo')}: ${safeText(daControllerDateLabel(priority))}</small><button type="button" class="da-decision-btn" onclick="openItemWorkspace('${priority.id}')">Abrir contexto →</button></div></section>`:`<section class="da-decision-card" style="--da-decision-color:#00d184"><span class="da-decision-rail"></span><div class="da-decision-main"><div class="da-decision-kicker"><i></i>Célula criativa</div><h3 class="da-decision-title">Nenhuma intervenção pendente na janela atual.</h3><div class="da-decision-detail"><span>${safeText(priorityInfo.copy)}</span></div></div></section>`;
  const directionHtml=directionActions.map(item=>daTacticalActionRow(item,team)).join(''); const deliveryHtml=deliveryRisks.map(item=>daTacticalDeliveryRiskRow(item,team)).join(''); const backlogHtml=backlog.length?backlog.map(item=>daTacticalBacklogRow(item,team)).join(''):'<div class="da-backlog-empty">✓ Nenhuma dívida crítica anterior à janela selecionada.</div>'; const commandMode=directionActions.length&&deliveryRisks.length?'split':directionActions.length?'only-direction':deliveryRisks.length?'only-delivery':'stable'; const commandCopy=commandMode==='only-delivery'?'Nenhuma nova decisão de direção pendente. Acompanhe as entregas que precisam de proteção.':commandMode==='only-direction'?'A Direção de Arte é o ponto de destravamento da janela atual.':commandMode==='stable'?'A janela atual não exige uma nova intervenção depois da decisão principal.':'Escolha o próximo comando: resolver uma dependência ou proteger uma entrega.'; const commandPanels=commandMode==='stable'?'<div class="da-command-empty-full">✓ Nenhuma nova intervenção dentro desta janela.</div>':`${directionActions.length?`<section class="da-command-panel"><div class="da-command-panel-head"><b>${selectedUser?'O que '+safeText(firstName(selectedUser.name))+' precisa resolver':'O que a célula precisa resolver'}</b><small>${directionActions.length} ${directionActions.length===1?'ação':'ações'} de direção</small></div>${directionHtml}</section>`:''}${deliveryRisks.length?`<section class="da-command-panel"><div class="da-command-panel-head"><b>Entregas a proteger</b><small>${deliveryRisks.length} risco${deliveryRisks.length===1?'':'s'} ${scopeReference}</small></div>${deliveryHtml}</section>`:''}`; const commandZoneHtml=`<section class="da-command-zone ${commandMode}"><div class="da-command-zone-head"><b>Depois da decisão principal</b><span>${commandCopy}</span></div><div class="da-command-grid">${commandPanels}</div><details class="da-debt-panel"><summary><b>⚑ DÍVIDAS DE CICLOS ANTERIORES · ${backlogCount}</b><small>não muda a prioridade ${scopePossessive} · clique para revisar</small></summary>${backlogHtml}</details></section>`; const periodLabel=daControllerPeriod==='day'?'HOJE':daControllerPeriod==='week'?'ESTA SEMANA':'ESTE MÊS'; const referenceLabel=daControllerDateMode==='veiculacao'?'VEICULAÇÃO':'PRAZO'; const lateWindowLabel=daControllerPeriod==='day'?'atrasos hoje':daControllerPeriod==='week'?'atrasos na semana':'atrasos no mês';
  dash.innerHTML=`<section class="da-tactical-head"><div><div class="da-tactical-kicker">VYBE OS · DIREÇÃO DE ARTE / CENTRAL TÁTICA</div><h2 class="da-tactical-title">Direção de arte</h2><p class="da-tactical-subtitle">Acompanhe o compromisso de entrega de cada dia sem perder de vista onde sua direção destrava valor agora.</p></div><div class="da-tactical-meta"><span class="da-tactical-meta-item"><b>${headlineItems.length}</b><span>${daControllerPeriod==='month'?periodLabel:(focusDayInfo?`${focusDayInfo.name} ${focusDayInfo.date}`:periodLabel)}</span></span><span class="da-tactical-meta-item"><b class="danger">${lateInWindow.length}</b><span>${lateWindowLabel}</span></span><span class="da-tactical-meta-item"><b class="warn">${backlogCount}</b><span>passivo antigo</span></span></div></section>${daCurrentContextBar}<section class="da-cell-filter-zone"><div class="da-cell-header"><div><b>Quem está carregando o quê</b><span>Escolha quem precisa de direção · ${safeText(referenceLabel)} · ${safeText(periodLabel)} · ${safeText(selectedName)}</span></div><button type="button" class="da-cell-acao" onclick="abrirAjusteDeDemandas()" title="Abrir a mesa de planejamento para acertar prazos, arquivos e prioridade">Ajustar demandas →</button></div><div class="da-capacity-grid da-cell-filter-grid">${summaries.map(({user})=>daTacticalCapacityCard(user,maxLoad)).join('')}</div></section><section class="da-day-direction">${decisionHtml}${commandZoneHtml}</section>${daDailyCommandHtml()}<section class="da-prova"><div class="da-prova-topo"><b>A prova</b><small>De onde essa decisão saiu: carga de cada pessoa, compromissos do dia e a semana à frente.</small></div>${daCommitmentScoreboardHtml(team,DA_TODAY_STATUS_LOGS)}</section><section class="da-operational-agenda"><div class="da-structure-heading"><span>A semana</span><b>Semana e próximas decisões</b><small>Escolha um dia e conduza a fila sem repetir a mesma demanda em vários blocos.</small></div>${daWeekAgendaHtml(scopedPeriod,range,team,today)}${daFocusedDayDetailHtml(scopedPeriod,team)}<details class="da-execution-details"><summary>CONTROLE DE EXECUÇÃO · ${focusDayInfo?`${focusDayInfo.name} ${focusDayInfo.date}`:'DIA ATIVO'}</summary>${daCheckinDayBoardHtml(scopedPeriod,team)}</details></section><section class="da-secondary-zone"><div class="da-structure-heading"><span>Saúde e memória</span><b>Capacidade, atividade e exceções</b><small>Indicadores importantes, mas secundários à direção do dia.</small></div><details class="da-secondary-panel" open><summary>Saúde da célula · Capacidade e disciplinas</summary><div class="da-discipline-summary">${disciplineSummaryHtml}</div></details><details class="da-secondary-panel"><summary>Atividade da célula · Movimentações e produtividade</summary>${daTodayPulseHtml(daTodayProductionSnapshot(team,DA_TODAY_STATUS_LOGS))}</details></section>`;
  daBindMetricDrilldowns(team);
  if(!DA_TODAY_STATUS_LOGS){ daLoadTodayStatusLogs().then(()=>{if(document.getElementById('da-controller-dashboard')) renderDaControllerTactical();}); }
}
// O botao principal da Central. Ajustar demanda e o que se faz aqui todo dia —
// prazo, arquivo, prioridade — e isso morava atras de um "Organizar agenda" em
// cada cartao de pessoa, entao so dava para entrar por uma pessoa de cada vez.
//
// Abre a mesa com quem estiver escolhido no filtro; sem ninguem escolhido, abre
// a celula inteira, que e o caso de quem chega para dar uma geral.
function abrirAjusteDeDemandas() {
  const time = daControllerTeam();
  if (!time.length) return showToast('A célula criativa ainda está carregando.', 'info');
  const escolhida = time.find((p) => String(p.id) === String(daControllerPersonId));
  if (escolhida) DA_PLANNING_PESSOAS = new Set([String(escolhida.id)]);
  else DA_PLANNING_PESSOAS = new Set(time.map((p) => String(p.id)));
  openDaIndividualPlanningDesk([...DA_PLANNING_PESSOAS][0]);
}

function setDaControllerPeriod(period) { daControllerPeriod=period; daControllerDayFocusIso=''; renderDaController(); }
function setDaControllerDateMode(mode) { if(daControllerDateMode===mode) return; daControllerDateMode=mode; daControllerDayFocusIso=''; renderDaController(); }
function closeDaMemberWorkload(){ const overlay=document.getElementById('da-member-workload-overlay'); if(!overlay) return; overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
function openDaMemberWorkload(){ const range=daControllerPeriodRange(); const user=daControllerTeam().find(entry=>entry.id===daControllerPersonId); if(!user) return; const items=daControllerItemsFor(user.id).filter(item=>daControllerInPeriod(item,range)); closeDaMemberWorkload(); const overlay=document.createElement('div'); overlay.id='da-member-workload-overlay'; overlay.className='da-member-workload-overlay'; overlay.onclick=event=>{if(event.target===overlay) closeDaMemberWorkload();}; overlay.innerHTML=`<section class="da-member-workload-modal" role="dialog" aria-modal="true" aria-label="Carga de ${safeText(user.name)}"><div class="da-member-workload-modal-head"><div><b>PRODUÇÃO DE ${safeText(user.name).toUpperCase()} · ${items.filter(item=>!isFinishedItem(item)).length} ENTREGAS</b><small>${safeText(daControllerPeriod==='month'?'Mês completo':daControllerPeriod==='week'?'Semana selecionada':'Dia selecionado')} · clique em uma demanda para abrir o contexto</small></div><button type="button" class="da-member-workload-close" onclick="closeDaMemberWorkload()" aria-label="Fechar carga individual">×</button></div><div class="da-member-workload-scroll">${daMemberProductionHtml(user,items)}</div></section>`; document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open')); }
function closeDaIndividualPlanningDesk(){ const overlay=document.getElementById('da-individual-planning-overlay'); if(!overlay) return; overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),180); }
let DA_PLANNING_SELECTED_IDS=new Set(); let DA_PLANNING_SELECTION_ANCHOR_ID=''; let DA_PLANNING_ACTIVE_USER='';
let DA_PLANNING_FILTER='all'; let DA_PLANNING_SORT='veiculacao'; let DA_PLANNING_SORT_DESC=false;
// Quem a mesa esta mostrando. Era sempre uma pessoa; agora e um conjunto, porque
// duas pessoas da mesma celula dividem entregas e planejar uma sem ver a outra
// e planejar no escuro.
let DA_PLANNING_PESSOAS = new Set();
function daPlanningTodayIso(){ return String(HOJE_ISO||new Date().toISOString().slice(0,10)); }
function daPlanningAddDays(iso,days){ if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))) return ''; const date=new Date(iso+'T12:00:00'); date.setDate(date.getDate()+Number(days||0)); return date.toISOString().slice(0,10); }
// Aceita uma pessoa ou uma lista. Com varias, a peca de dois donos selecionados
// aparece UMA vez: a mesa mostra entregas, nao atribuicoes.
function daIndividualPlanningAllItems(userId){
  const ids = Array.isArray(userId) ? userId.map(String).filter(Boolean) : [String(userId || '')].filter(Boolean);
  if (ids.length <= 1) return daControllerItemsFor(ids[0] || 'all').filter(item=>!isFinishedItem(item));
  const vistos = new Set(); const juntos = [];
  for (const id of ids) {
    for (const item of daControllerItemsFor(id)) {
      if (isFinishedItem(item)) continue;
      const chave = String(item.id);
      if (vistos.has(chave)) continue;
      vistos.add(chave); juntos.push(item);
    }
  }
  return juntos;
}

// Quem esta na mesa agora. O conjunto manda; o argumento so serve quando alguem
// abre a mesa de fora, apontando uma pessoa.
function daPlanningPessoasDaMesa(userIdPadrao) {
  if (DA_PLANNING_PESSOAS.size) return [...DA_PLANNING_PESSOAS];
  const um = String(userIdPadrao || daControllerPersonId || '');
  return um ? [um] : [];
}

// O clique simples soma e tira. Na primeira versao somar exigia shift, e o gesto
// era invisivel: clicar em Deivid e depois em Beatriz trocava de pessoa em vez
// de juntar as duas, que e o que qualquer um espera de botoes que ficam acesos.
// Quem quer ver so uma clica para apagar as outras — a mesa ja abre com uma so.
function daPlanningEscolherPessoa(id, event) {
  const alvo = String(id);
  if (DA_PLANNING_PESSOAS.has(alvo)) {
    // Tirar a ultima deixaria a mesa sem ninguem e sem o que mostrar.
    if (DA_PLANNING_PESSOAS.size > 1) DA_PLANNING_PESSOAS.delete(alvo);
  } else DA_PLANNING_PESSOAS.add(alvo);
  // Redesenhar apontando quem ACABOU DE SAIR trazia essa pessoa de volta: a mesa
  // recomeca em quem e apontado de fora do conjunto, e quem saiu esta fora dele.
  // Ao tirar alguem, o desenho aponta quem ficou.
  const aindaNaMesa = DA_PLANNING_PESSOAS.has(alvo) ? alvo : ([...DA_PLANNING_PESSOAS][0] || alvo);
  openDaIndividualPlanningDesk(aindaNaMesa);
}

function daPlanningTodasAsPessoas() {
  DA_PLANNING_PESSOAS = new Set(daControllerTeam().map((p) => String(p.id)));
  openDaIndividualPlanningDesk([...DA_PLANNING_PESSOAS][0]);
}
function daPlanningItemMatchesFilter(item,filter){ const today=daPlanningTodayIso(); const veic=String(item.veiculacao_iso||''); const prazo=String(item.prazo_iso||''); if(filter==='atrasados') return Boolean(prazo&&prazo<today); if(filter==='fora7') return daIndividualPlanningGoldenState(item).kind==='risk'; if(filter==='proximos7') return Boolean(veic&&veic>=today&&veic<=daPlanningAddDays(today,7)); if(filter==='semveic') return !veic; return true; }
function daPlanningSortItems(items,sort){ const copy=[...items];
  // A direcao se aplica ao criterio inteiro, desempates inclusive: inverter so o
  // primeiro campo deixaria blocos internos fora de ordem.
  const sentido = DA_PLANNING_SORT_DESC ? -1 : 1; const byIso=value=>String(value||'9999-12-31'); return copy.sort((a,b)=>sentido*(((a2,b2)=>{ if(sort==='prazo') return byIso(a.prazo_iso).localeCompare(byIso(b.prazo_iso))||byIso(a.veiculacao_iso).localeCompare(byIso(b.veiculacao_iso)); if(sort==='margem'){ const margin=item=>{ const gap=goldenDeadlineGap(item.prazo_iso,item.veiculacao_iso); return gap===null?999999:Number(gap); }; const av=margin(a); const bv=margin(b); return av-bv||byIso(a.veiculacao_iso).localeCompare(byIso(b.veiculacao_iso))||byIso(a.prazo_iso).localeCompare(byIso(b.prazo_iso)); } if(sort==='cliente') return String(a.cliente||'').localeCompare(String(b.cliente||''),'pt-BR')||byIso(a.veiculacao_iso).localeCompare(byIso(b.veiculacao_iso)); const av=byIso(a.veiculacao_iso); const bv=byIso(b.veiculacao_iso); return av.localeCompare(bv)||byIso(a.prazo_iso).localeCompare(byIso(b.prazo_iso))||daTacticalScore(a)-daTacticalScore(b); })(a,b))); }
function daIndividualPlanningItems(userId){ return daPlanningSortItems(daIndividualPlanningAllItems(userId).filter(item=>daPlanningItemMatchesFilter(item,DA_PLANNING_FILTER)),DA_PLANNING_SORT); }
function daPlanningSelection(userId){ return daIndividualPlanningAllItems(daPlanningPessoasDaMesa(userId)).filter(item=>DA_PLANNING_SELECTED_IDS.has(String(item.id))); }
function daPlanningBatchDeadlineLimit(userId){
  return daPlanningSelection(userId).map(item=>String(item.veiculacao_iso||'')).filter(Boolean).sort()[0]||'';
}
// ── coluna ARQUIVO da mesa individual ────────────────────────────────────────
//
// A entrega da demanda era invisível daqui: para saber se já existe arte, a
// pessoa abria a peça, olhava e voltava — uma vez por linha. A coluna responde
// isso na própria lista, e quando não há nada ela vira o caminho de enviar.
//
// As miniaturas chegam numa pergunta só depois que a lista já está desenhada.
// Buscar antes atrasaria a abertura da mesa por causa de uma coluna; buscar por
// linha seriam 65 idas ao servidor.

// A prioridade e a informacao que decide o que fazer primeiro — e era
// justamente ela que faltava na mesa que existe para planejar. Vai junto do
// formato e do status, na mesma celula, para nao custar mais uma coluna.
//
// So de leitura aqui: a cor vem do mesmo catalogo do resto do painel, entao a
// etiqueta e a mesma que a pessoa ve no quadro. Trocar a prioridade continua
// sendo na peca, onde ha espaco para o seletor.
// De quem e a peca, na propria linha.
//
// A linha dizia "Gonzalez Advocacia · Beatriz Rocha Cardoso, Deivid Oliveira
// Ribeiro" — uma frase que ninguem le numa lista de cem. Com duas ou tres
// agendas somadas isso deixou de ser detalhe: sem saber de quem e cada peca, a
// mesa somada nao serve para nada.
//
// Mesma bolinha com foto que o resto do painel usa — a pessoa reconhece o rosto
// antes de ler o nome, e um segundo desenho para a mesma coisa so faria a mesa
// parecer outro sistema.
//
// Quem esta na mesa aparece normal; quem divide a peca mas nao esta na mesa
// aparece apagado, porque tambem e responsavel e some-lo em silencio faria a
// peca parecer de uma pessoa so.

// RESPONSAVEL GANHOU COLUNA, E A COLUNA EDITA.
//
// As bolinhas moravam embaixo do cliente, so para olhar: para trocar quem faz a
// peca era preciso abrir a gaveta. Agora e uma coluna, e clicar nela abre o
// MESMO editor de responsaveis do resto do painel (openOwnerEditor) — nao um
// segundo editor parecido, que e como nascem as duas verdades.
//
// A marca de "fora da mesa" continua: quem divide a peca mas nao esta na mesa
// aberta aparece apagado. Continua responsavel, so nao e o assunto agora.
function daPlanningDonosHtml(item) {
  const equipe = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const ids = (typeof assignedIds === 'function' ? assignedIds(item) : []).map(String);
  const donos = ids.map((id) => equipe.find((u) => String(u.id) === id)).filter(Boolean);
  const abrir = `onclick="openOwnerEditor(event,'${safeText(String(item.id))}')"`;
  if (!donos.length) {
    return `<button type="button" class="owner-editor-trigger da-planning-donos" ${abrir}
      title="Sem responsável — clique para escolher"
      aria-label="Escolher responsável"><span class="owner-avatar-add">+</span></button>`;
  }
  const naMesa = new Set(daPlanningPessoasDaMesa().map(String));
  const nomes = donos.map((u) => u.name).join(', ');
  return `<button type="button" class="owner-editor-trigger da-planning-donos" ${abrir}
    title="${safeText(nomes)} — clique para somar ou tirar"
    aria-label="Responsáveis: ${safeText(nomes)}"><span class="owner-avatar-stack">${donos.slice(0, 4).map((u) => {
    const fora = naMesa.size && !naMesa.has(String(u.id)) ? ' fora-da-mesa' : '';
    return `<span class="da-planning-dono${fora}">${ownerAvatarHtml(u)}</span>`;
  }).join('')}${donos.length > 4 ? `<span class="owner-avatar-fallback" style="background:#465363">+${donos.length - 4}</span>` : ''}</span></button>`;
}

function daPlanningPrioridadeTag(item) {
  const valor = String(item?.prioridade || '').trim();
  if (!valor || valor === '—') return '';
  const coluna = (typeof CAMPOS_DE_ESCOLHA !== 'undefined' && typeof quadroDoItem === 'function')
    ? (CAMPOS_DE_ESCOLHA.prioridade?.colunas?.[quadroDoItem(item)] || '') : '';
  const doCatalogo = (typeof CATALOGO_OPCOES !== 'undefined' ? CATALOGO_OPCOES : [])
    .find((o) => o.coluna_id === coluna && o.rotulo === valor);
  const cor = doCatalogo?.cor
    ? { cor: doCatalogo.cor, borda: doCatalogo.borda || doCatalogo.cor }
    : (typeof corDeOpcao === 'function' ? corDeOpcao(valor, coluna) : null);
  return typeof pillHtml === 'function' ? pillHtml(valor, cor?.cor || '', cor?.borda || '') : '';
}

function daPlanningArquivoVazioHtml(itemId) {
  return `<button type="button" class="da-planning-file-vazio" onclick="daPlanningEscolherArquivo('${safeText(String(itemId))}')"
    title="Sem entrega anexada — clique para enviar. O arquivo vai para a pasta do cliente no Drive da Vybe.">+</button>`;
}

function daPlanningArquivoHtml(itemId, info) {
  if (!info) return daPlanningArquivoVazioHtml(itemId);
  const mais = Number(info.total) > 1 ? `<i>${Number(info.total)}</i>` : '';
  const nome = safeText(String(info.nome || 'arquivo'));
  if (info.thumb) {
    return `<button type="button" class="da-planning-file-tem" title="${nome}${Number(info.total) > 1 ? ` · ${info.total} arquivos` : ''} · abrir no Drive"
      onclick="window.open('${safeText(String(info.abrir || info.thumb))}','_blank','noopener')"><img src="${safeText(String(info.thumb))}" alt="" loading="lazy">${mais}</button>`;
  }
  // Arquivo que ainda mora no Monday não tem miniatura estável: a tela diz que
  // existe e leva para a peça, em vez de mostrar uma imagem quebrada.
  return `<button type="button" class="da-planning-file-tem sem-previa" title="${nome} — ainda no Monday, sem prévia. Abrir a peça."
    onclick="closeDaIndividualPlanningDesk();openItemWorkspace('${safeText(String(itemId))}')">▣${mais}</button>`;
}

// O que ja foi perguntado ao servidor fica guardado aqui. Sem isso, cada clique
// na mesa (que redesenha tudo) disparava uma ida ao servidor pelas miniaturas
// das 23 linhas e recarregava as imagens — era esse o "demora pra atualizar
// qualquer comando". O mapa distingue tres coisas: nao perguntei ainda (a chave
// nao existe), perguntei e nao tem arquivo (null), perguntei e tem (o objeto).
const DA_PLANNING_ARQUIVOS = new Map();
function daPlanningEsquecerArquivo(itemId) { DA_PLANNING_ARQUIVOS.delete(String(itemId)); }
async function daPlanningCarregarArquivos() {
  const celulas = [...document.querySelectorAll('#da-individual-planning-overlay .da-planning-file')];
  if (!celulas.length) return;
  // Primeiro o que ja se sabe, na hora e sem rede: a mesa redesenhada aparece
  // com as miniaturas ja no lugar em vez de piscar vazia.
  const faltando = [];
  celulas.forEach((c) => {
    const id = String(c.dataset.item || '');
    if (!id) return;
    if (DA_PLANNING_ARQUIVOS.has(id)) c.innerHTML = daPlanningArquivoHtml(id, DA_PLANNING_ARQUIVOS.get(id));
    else faltando.push(id);
  });
  if (!faltando.length) return;
  try {
    const r = await fetch(`/api/painel?area=arquivos&itens=${encodeURIComponent(faltando.join(','))}`,
      { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    const mapa = d.itens || {};
    faltando.forEach((id) => DA_PLANNING_ARQUIVOS.set(id, mapa[id] || null));
    // A mesa pode ter sido fechada ou trocado de pessoa enquanto isso; só
    // preenche a célula que ainda está na tela.
    celulas.forEach((c) => { if (c.isConnected && faltando.includes(String(c.dataset.item))) c.innerHTML = daPlanningArquivoHtml(c.dataset.item, mapa[c.dataset.item]); });
  } catch (erro) {
    console.warn('Miniaturas da mesa indisponíveis:', erro.message);
    // Falhar aqui não pode esconder o caminho de enviar: a célula vira o botão
    // de sempre, e quem já tem arquivo descobre ao abrir a peça. E nao guarda o
    // fracasso no mapa, para a proxima abertura tentar de novo.
    celulas.forEach((c) => { if (c.isConnected && faltando.includes(String(c.dataset.item))) c.innerHTML = daPlanningArquivoVazioHtml(c.dataset.item); });
  }
}

// O erro de envio vinha numa tarja que sumia sozinha. Quem esbarrava nele
// tentava de novo, desistia, e chegava ate aqui como "ta dando erro" — sem a
// frase, que e justamente a unica parte que diz onde consertar. Agora ele para
// na tela, o texto vem selecionado e sai copiado num toque.
async function daPlanningContarFalhaDeEnvio(nomeDoArquivo, mensagem) {
  const texto = `Vybe Painel · envio de arquivo falhou\nArquivo: ${nomeDoArquivo}\nErro: ${mensagem}`;
  const resposta = await perguntarNoPainel({
    titulo: 'Não foi possível enviar o arquivo',
    texto: String(mensagem || 'Erro sem descrição.'),
    confirmar: 'Copiar o erro',
    campo: { valor: texto.replace(/\n/g, ' · '), dica: '' },
  });
  if (resposta === null) return;
  try {
    await navigator.clipboard.writeText(texto);
    showToast('Erro copiado. Cole na conversa com quem cuida do painel.', 'ok', 7000);
  } catch (falha) {
    showToast('Não consegui copiar sozinho — selecione o texto da caixa e copie à mão.', 'info', 7000);
  }
}

function daPlanningEscolherArquivo(itemId) {
  let input = document.getElementById('da-planning-file-input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.id = 'da-planning-file-input';
    input.hidden = true;
    input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
    input.onchange = () => daPlanningEnviarArquivo(input);
    document.body.appendChild(input);
  }
  input.dataset.item = String(itemId);
  input.value = '';
  input.click();
}

// Varios de uma vez, um atras do outro. Um carrossel de dez paginas era dez idas
// ao botao, com as dez ja selecionadas na pasta.
async function daPlanningEnviarArquivo(input) {
  const itemId = input?.dataset?.item || '';
  const arquivos = [...(input?.files || [])];
  if (!itemId || !arquivos.length) return;
  const celula = document.getElementById(`arq-${itemId}`);
  const total = arquivos.length;
  const foram = []; const falhas = [];
  let ultimo = null;
  try {
    for (let i = 0; i < total; i += 1) {
      const file = arquivos[i];
      if (celula && celula.isConnected) {
        celula.innerHTML = `<span class="da-planning-file-carregando" title="${
          safeText(file.name)}">${total > 1 ? `${i + 1}/${total}` : '…'}</span>`;
      }
      try {
        const r = await enviarArquivoDaPeca(itemId, file);
        const drive = r?.drive_file_id || '';
        ultimo = { nome: file.name,
          thumb: drive ? `https://drive.google.com/thumbnail?id=${drive}&sz=w160` : null,
          abrir: drive ? `https://drive.google.com/file/d/${drive}/view` : null };
        foram.push(file.name);
      } catch (erro) { falhas.push({ nome: file.name, motivo: erro.message }); }
    }
    if (foram.length) {
      // A celula mostra a miniatura do ULTIMO e o total do que a peca tem agora:
      // e a mesma leitura que o servidor devolve quando a mesa recarrega.
      const info = { ...ultimo, total: foram.length };
      DA_PLANNING_ARQUIVOS.set(String(itemId), info);
      if (celula && celula.isConnected) celula.innerHTML = daPlanningArquivoHtml(itemId, info);
      showToast(foram.length === 1
        ? `✓ ${foram[0]} guardado na pasta do cliente no Drive`
        : `✓ ${foram.length} arquivos guardados na pasta do cliente no Drive`, 'ok', 6000);
    } else {
      daPlanningEsquecerArquivo(itemId);
      if (celula && celula.isConnected) celula.innerHTML = daPlanningArquivoVazioHtml(itemId);
    }
    // Uma caixa com a lista, e nao uma caixa por arquivo que falhou.
    if (falhas.length) {
      daPlanningContarFalhaDeEnvio(
        falhas.length === 1 ? falhas[0].nome : `${falhas.length} arquivos`,
        falhas.map((f) => `${f.nome}: ${f.motivo}`).join('\n'));
    }
  } finally { if (input) input.value = ''; }
}

function daPlanningSetFilter(filter,userId){ DA_PLANNING_FILTER=filter; repintarMesaDePlanejamento(); }
// Clicar de novo no mesmo criterio inverte a ordem, como na tabela por grupos.
// Trocar de criterio sempre comeca do menor: quem clica em CLIENTE espera o A,
// nao o Z de uma ordem que sobrou do clique anterior.
function daPlanningSetSort(sort,userId){
  if (DA_PLANNING_SORT === sort) DA_PLANNING_SORT_DESC = !DA_PLANNING_SORT_DESC;
  else { DA_PLANNING_SORT = sort; DA_PLANNING_SORT_DESC = false; }
  repintarMesaDePlanejamento();
}

// O cabecalho e os botoes ORDENAR mexem no MESMO estado. Dois controles com
// duas memorias diferentes fariam a lista dizer uma coisa e o botao outra.
function daPlanningCabecalho(rotulo, chave, userId) {
  const ativa = DA_PLANNING_SORT === chave;
  const icones = typeof ICONE !== 'undefined' ? ICONE : {};
  const seta = ativa ? (DA_PLANNING_SORT_DESC ? icones.desce : icones.sobe) : icones.ordenar;
  const comoEsta = ativa ? (DA_PLANNING_SORT_DESC ? ' — hoje: maior para menor' : ' — hoje: menor para maior') : '';
  return `<span><button type="button" class="da-planning-th ${ativa ? 'ordenando' : ''}"
    onclick="daPlanningSetSort('${chave}','${safeText(String(userId || ''))}')"
    title="Ordenar por ${safeText(rotulo)}${comoEsta}">${safeText(rotulo)}<i>${seta || ''}</i></button></span>`;
}
function daPlanningControlsHtml(userId,visible,total){ const filters=[['all','TODOS'],['atrasados','ATRASOS'],['fora7','ABAIXO 7D'],['proximos7','PRÓX. 7D'],['semveic','SEM VEIC.']]; const sorts=[['veiculacao','VEICULAÇÃO'],['prazo','PRAZO'],['margem','MENOR MARGEM'],['cliente','CLIENTE']]; return `<div class="da-planning-controls"><div class="da-planning-control-group"><span>Filtrar</span>${filters.map(([id,label])=>`<button type="button" class="${DA_PLANNING_FILTER===id?'active':''}" onclick="daPlanningSetFilter('${id}','${userId}')">${label}</button>`).join('')}<small>${visible}/${total}</small></div><div class="da-planning-control-group"><span>Ordenar</span>${sorts.map(([id,label])=>`<button type="button" class="${DA_PLANNING_SORT===id?'active':''}" onclick="daPlanningSetSort('${id}','${userId}')">${label}</button>`).join('')}</div></div>`; }

function daIndividualPlanningGoldenState(item){ const veic=String(item?.veiculacao_iso||''); const prazo=String(item?.prazo_iso||''); const golden=goldenDeadlineIso(veic); const gap=goldenDeadlineGap(prazo,veic); if(!veic) return {kind:'pending',label:'SEM VEICULAÇÃO',copy:'Defina a veiculação para validar a margem.'}; if(!prazo) return {kind:'pending',label:'SEM PRAZO',copy:`Padrão sugerido: ${planningDateBr(golden)}.`}; if(gap===PRAZO_OURO_DIAS) return {kind:'ok',label:'✓ 7 DIAS',copy:'Prazo de Ouro protegido.'}; if(gap>PRAZO_OURO_DIAS){ const extra=gap-PRAZO_OURO_DIAS; return {kind:'slack',label:`✓ +${extra}D DE FOLGA`,copy:`Antecedência de ${gap} dias até a veiculação.`}; } const missing=PRAZO_OURO_DIAS-gap; return {kind:'risk',label:`⚠ ${missing}D ABAIXO`,copy:`Antecedência de ${Math.max(0,gap)} dias · ideal ${planningDateBr(golden)}.`}; }
function daIndividualPlanningAvatar(user){ return user?.photo?`<img class="da-planning-avatar" src="${user.photo}" alt="${safeText(user.name)}">`:`<span class="da-planning-avatar" style="background:${user?.color||'#ff9d00'}">${safeText(firstName(user?.name||'DA').slice(0,2).toUpperCase())}</span>`; }
// Clicar na linha abre a atividade, como na tabela por grupos. So o botao
// "Contexto" abria, e ele e o menor alvo da linha — a peca inteira parecia
// clicavel e nao era.
//
// Em vez de espalhar stopPropagation por cada celula que faz outra coisa, o
// guarda e um so: clique que nasceu dentro de um controle (marcar, data, enviar
// arquivo, o proprio Contexto) nao abre nada. Um lugar para conferir, e nao
// cinco espalhados que alguem esquece ao acrescentar a sexta coluna.
function daPlanningAbrirPeca(itemId, event) {
  if (event?.target?.closest?.('input, button, a, label, select, textarea')) return;
  const selecao = window.getSelection?.();
  // Quem arrastou para copiar o nome nao quis abrir a peca.
  if (selecao && String(selecao).trim().length > 2) return;
  // Abre o cartao rapido, o mesmo do calendario: status, grupo, responsavel,
  // captacao, formato, tipo, OFF, prioridade e as duas datas, tudo a mao e sem
  // sair da mesa. A gaveta inteira continua a um clique, no rodape do cartao.
  //
  // A mesa fica aberta atras: quem esta ajustando prazos vai mexer em varias
  // seguidas, e fechar tudo a cada clique jogaria a pessoa de volta ao comeco.
  const peca = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  const origem = (typeof isRequestItem === 'function' && peca && isRequestItem(peca)) ? 'request' : 'content';
  if (typeof abrirCartaoRapido === 'function') return abrirCartaoRapido(String(itemId), event, origem);
  closeDaIndividualPlanningDesk();
  openItemWorkspace(String(itemId));
}

// Formato, status e prioridade eram tres etiquetas SO DE LEITURA, amontoadas
// numa coluna chamada "FORMATO / STATUS". Para trocar qualquer uma delas era
// preciso sair da mesa e achar a peca em outra tela. O painel inteiro ja edita
// essas tres na propria linha; aqui era a excecao, e nao havia motivo.
//
// Status ganhou coluna propria: e a pergunta que se faz olhando a mesa, e
// dividir espaco com o formato fazia as duas competirem.
// FORMATO E FORMATO. So isso.
//
// A coluna trazia o formato E a origem colados — "Fotografia CONTEUDO" debaixo
// de um cabecalho escrito FORMATO. Sao duas perguntas diferentes: uma diz o que
// a peca E, a outra de qual operacao ela VEIO.
//
// A origem foi para junto do cliente, e nao para uma coluna nova: numa tabela
// que ja tem nove colunas, uma coluna inteira para um valor binario que se
// repete linha apos linha custa mais espaco do que informa. Ao lado do cliente
// ela se le como identidade — "Hebravet · SOLICITACAO" — que e o que ela e.
function daPlanningFormatoEditavel(item) {
  const podeTrocar = typeof pillEditavel === 'function' && typeof campoExisteNoQuadro === 'function'
    && campoExisteNoQuadro('formato', item);
  return `<span class="da-content-tags">${
    podeTrocar ? pillEditavel(item, 'formato') : fmtHtml(daTacticalFormat(item))
  }</span>`;
}
function daPlanningStatusEditavel(item) {
  const risco = daControllerRisk(item);
  const escalada = daCriticalEscalation(item);
  const alerta = escalada.level
    ? `<span class="da-risk-mini ${escalada.level}">${safeText(escalada.label || '')}</span>`
    : (risco?.mini || '');
  return `<span class="da-status-tags"><button type="button" class="grupo-pill-btn"
    onclick="openStatusEditor(event,'${safeText(String(item.id))}')"
    title="Trocar o status de ${safeText(item.nome || '')}">${
      pillHtml(item.status, item.status_color, item.status_border)}</button>${alerta}</span>`;
}
function daPlanningPrioridadeEditavel(item) {
  if (typeof pillEditavel !== 'function' || typeof campoExisteNoQuadro !== 'function'
      || !campoExisteNoQuadro('prioridade', item)) return daPlanningPrioridadeTag(item);
  return `<span class="da-status-tags">${pillEditavel(item, 'prioridade')}</span>`;
}

function daIndividualPlanningRow(item,index,userId){
  const state=daIndividualPlanningGoldenState(item);
  const veic=item.veiculacao_iso?planningDateBr(item.veiculacao_iso):'Não definida';
  const deadline=item.prazo_iso||'';
  const selected=DA_PLANNING_SELECTED_IDS.has(String(item.id));
  const batchLimit=selected&&DA_PLANNING_SELECTED_IDS.size>=2?daPlanningBatchDeadlineLimit(userId):'';
  const allowedUntil=batchLimit||String(item.veiculacao_iso||'');
  const maxAttr=allowedUntil?` max="${safeText(allowedUntil)}"`:'';
  const directTitle=batchLimit?` title="Prazo coletivo: a data será aplicada a todas as demandas marcadas. Limite do lote: ${planningDateBr(batchLimit)}."`:'';
  return `<article class="da-planning-row ${selected?'is-selected':''}" onclick="daPlanningAbrirPeca('${safeText(String(item.id))}',event)" title="Abrir ${safeText(item.nome||'a atividade')}"><label class="da-planning-select" title="Selecionar para ajuste de prazo em lote"><input type="checkbox" ${selected?'checked':''} onclick="daPlanningToggleItem('${userId||''}','${item.id}',this.checked,event)"><span></span></label><span class="da-planning-seq">${String(index+1).padStart(2,'0')}</span><span class="da-planning-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')}${operationalOriginTag(item)}</small></span><span class="da-planning-donos-col" onclick="event.stopPropagation()">${daPlanningDonosHtml(item)}</span><span class="da-planning-airdate"><b>${safeText(veic)}</b><small>Veiculação</small></span><span class="da-planning-tags da-col-formato" onclick="event.stopPropagation()">${daPlanningFormatoEditavel(item)}</span><span class="da-planning-tags da-col-status" onclick="event.stopPropagation()">${daPlanningStatusEditavel(item)}${daPlanningPrioridadeEditavel(item)}</span><label class="da-planning-deadline"><input type="date" value="${safeText(deadline)}" data-item-id="${item.id}"${maxAttr}${directTitle} onchange="saveDaPlanningGridDeadline('${userId||''}','${item.id}',this.value,this)" aria-label="Prazo de ${safeText(item.nome)}"><small class="gold-${state.kind}">${safeText(state.label)} · ${safeText(state.copy)}</small></label><div class="da-planning-file" id="arq-${safeText(String(item.id))}" data-item="${safeText(String(item.id))}"><span class="da-planning-file-carregando" title="Conferindo arquivos…">·</span></div><button type="button" class="da-planning-open" onclick="closeDaIndividualPlanningDesk();openItemWorkspace('${item.id}')">Contexto →</button></article>`;
}
function daPlanningToggleItem(userId,itemId,checked,event){
  const id=String(itemId);
  const hasShift=Boolean(event&&event.shiftKey);
  const items=daIndividualPlanningItems(userId);
  const anchorId=String(DA_PLANNING_SELECTION_ANCHOR_ID||'');
  const anchorIndex=items.findIndex(item=>String(item.id)===anchorId);
  const targetIndex=items.findIndex(item=>String(item.id)===id);
  if(hasShift&&anchorIndex>=0&&targetIndex>=0){
    const start=Math.min(anchorIndex,targetIndex);
    const end=Math.max(anchorIndex,targetIndex);
    items.slice(start,end+1).forEach(item=>{
      const rangeId=String(item.id);
      if(checked) DA_PLANNING_SELECTED_IDS.add(rangeId);
      else DA_PLANNING_SELECTED_IDS.delete(rangeId);
    });
  }else{
    if(checked) DA_PLANNING_SELECTED_IDS.add(id);
    else DA_PLANNING_SELECTED_IDS.delete(id);
    DA_PLANNING_SELECTION_ANCHOR_ID=id;
  }
  if(!DA_PLANNING_SELECTION_ANCHOR_ID) DA_PLANNING_SELECTION_ANCHOR_ID=id;
  repintarMesaDePlanejamento();
}
function daPlanningToggleAll(userId){ const items=daIndividualPlanningItems(daPlanningPessoasDaMesa(userId)); const all=items.length>0&&items.every(item=>DA_PLANNING_SELECTED_IDS.has(String(item.id))); items.forEach(item=>all?DA_PLANNING_SELECTED_IDS.delete(String(item.id)):DA_PLANNING_SELECTED_IDS.add(String(item.id))); DA_PLANNING_SELECTION_ANCHOR_ID=items[0]?String(items[0].id):''; repintarMesaDePlanejamento(); }
function daPlanningBulkToolbarHtml(items,userId){
  const selected=daPlanningSelection(userId);
  const all=items.length>0&&items.every(item=>DA_PLANNING_SELECTED_IDS.has(String(item.id)));
  const direct=selected.length>=2;
  const batchLimit=direct?daPlanningBatchDeadlineLimit(userId):'';
  const message=direct?`Altere o prazo em qualquer linha marcada: o mesmo prazo será aplicado a toda a seleção.${batchLimit?` Data máxima do lote: ${planningDateBr(batchLimit)}.`:''}`:'Marque 2 ou mais demandas para aplicar um prazo diretamente na tabela.';
  return `<div class="da-planning-bulkbar ${direct?'direct-mode':''}"><div><b>SELEÇÃO EM LOTE · ${selected.length} DEMANDA${selected.length===1?'':'S'}</b><small>${message}</small></div><div><button type="button" onclick="daPlanningToggleAll('${userId}')">${all?'LIMPAR VISÍVEIS':'MARCAR VISÍVEIS'} (${items.length})</button>${selected.length?`<button type="button" onclick="DA_PLANNING_SELECTED_IDS.clear();DA_PLANNING_SELECTION_ANCHOR_ID='';openDaIndividualPlanningDesk('${userId}')">Limpar seleção</button>`:''}<span class="da-planning-direct-hint ${direct?'':'quiet'}">${direct?(batchLimit?`PRAZO ≤ ${planningDateBr(batchLimit)}`:'EDITE UMA DATA MARCADA'):'SELECIONE 2+'}</span></div></div>`;
}
function daPlanningRefreshBulkPreview(userId){ const note=document.getElementById('da-planning-bulk-preview'); const date=String(document.getElementById('da-planning-bulk-date')?.value||''); const items=daPlanningSelection(userId); if(!note) return; if(!date){note.className='da-bulk-date-preview';note.textContent='Selecione uma nova data para avaliar '+items.length+' demanda'+(items.length===1?'':'s')+'.';return;} const invalid=items.filter(item=>item.veiculacao_iso&&date>item.veiculacao_iso); if(invalid.length){note.className='da-bulk-date-preview err';note.textContent='Não é possível aplicar: '+invalid.length+' demanda'+(invalid.length===1?' ficaria':'s ficariam')+' com o prazo depois da veiculação.';return;} const alerts=items.filter(item=>item.veiculacao_iso&&date!==goldenDeadlineIso(item.veiculacao_iso)).length; note.className='da-bulk-date-preview '+(alerts?'warn':'ok'); const suffix=alerts?' '+alerts+' ficará'+(alerts===1?'':'ão')+' fora do padrão de '+PRAZO_OURO_DIAS+' dias, apenas com alerta visual.':''; note.textContent=items.length+' demanda'+(items.length===1?' receberá':'s receberão')+' o prazo '+planningDateBr(date)+'.'+suffix; }
function daPlanningOpenBulkEditor(userId){ const selected=daPlanningSelection(userId); return showToast(selected.length>=2?'Altere a data diretamente em qualquer linha marcada para aplicar em '+selected.length+' demandas.':'Marque ao menos 2 demandas para editar o prazo em lote diretamente na tabela.','info',5000); }
async function applyDaPlanningBulkDeadline(userId){ const date=String(document.getElementById('da-planning-bulk-date')?.value||''); const items=daPlanningSelection(userId); if(!date||!items.length) return showToast('Selecione a data e pelo menos uma demanda.','info'); const invalid=items.filter(item=>item.veiculacao_iso&&date>item.veiculacao_iso); if(invalid.length) return showToast('O prazo não pode ficar depois da veiculação.','err',7000); if(!window.confirm(`Aplicar o prazo ${planningDateBr(date)} em ${items.length} demanda${items.length===1?'':'s'}?`)) return; const button=document.getElementById('da-planning-bulk-save'); if(button){button.disabled=true;button.textContent='Aplicando…';} armOutboundMutationGuard('prazos em lote da mesa individual'); const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`; const success=[]; const failed=[]; for(const item of items){ try{ if(!await tentarEscritaDupla(item,{acao:'prazo',item:String(item.id),data:date})) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify({data:{date}})}); const veic=String(item.veiculacao_iso||''); const followsGolden=Boolean(veic&&date===goldenDeadlineIso(veic)); try{await postItemUpdate(item.id,`[Vybe OS · Planejamento em lote do DA]\nPrazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(date)}\nVeiculação: ${planningDateBr(veic)}\n${followsGolden?`Prazo de Ouro protegido (${PRAZO_OURO_DIAS} dias antes da veiculação).`:`Ajuste coletivo permitido; alerta visual de margem aplicado quando necessário.`}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`);}catch(logError){console.warn('Prazo alterado, mas histórico não foi registrado.',logError);} if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){request.prazo_iso=date;request.prazo=planningDateBr(date).slice(0,5);} outboundMutationGuardUntil=0; } else applyOutboundItemPatch(item.id,{prazo_iso:date},'prazos em lote da mesa individual'); DA_PLANNING_SELECTED_IDS.delete(String(item.id)); success.push(item);}catch(error){failed.push(item);console.warn('Falha ao aplicar prazo em lote',item.id,error);}} saveProductionCache(); renderDaController(); repintarMesaDePlanejamento(); if(!failed.length){closeWorkflowModal();showToast(`✓ ${success.length} prazo${success.length===1?' atualizado':'s atualizados'} em lote.`,'ok');}else{if(button){button.disabled=false;button.textContent=`Tentar novamente em ${failed.length}`;}showToast(`${success.length} prazo${success.length===1?'':'s'} atualizado${success.length===1?'':'s'}; ${failed.length} falhou${failed.length===1?'':'ram'}.`,'info',7000);} }
// ── ARRUMAR A AGENDA ─────────────────────────────────────────────────────────
//
// O trabalho da mesa era todo na mao: abrir todo dia, olhar o que venceu, e
// reescrever prazo por prazo para caber no dia de cada um. Com 89 entregas
// ativas isso e uma hora de digitacao para chegar a uma conta que o computador
// faz em milissegundos.
//
// A proposta NAO GRAVA NADA. Ela devolve a lista do que mudaria, e quem decide
// e a pessoa olhando a lista. Reescrever 89 prazos em silencio seria trocar um
// trabalho chato por um susto.

// A proposta de agenda para as pessoas da mesa. Uma fila por pessoa: duas
// pessoas dividindo a mesa nao somam carga uma da outra.
//
// DUAS VERSOES ANTERIORES ERRARAM, e as duas por acreditar demais numa regra so.
//
// A primeira enfileirava tudo a partir de hoje, cinco por dia, e ignorava o
// Prazo de Ouro: onze pecas viravam onze prazos nos tres dias seguintes.
//
// A segunda ancorou tudo no Prazo de Ouro — sete dias antes do ar — e caiu no
// oposto: com o trabalho todo empurrado para a vespera do proprio ar, AMANHA
// FICAVA VAZIO. Uma agenda que deixa a pessoa sem o que fazer amanha e sem
// tempo depois nao e uma agenda.
//
// A regra que vale e a da operacao: cada pessoa com CINCO ENTREGAS POR DIA UTIL,
// na ordem de quem vai ao ar primeiro, comecando hoje. O Prazo de Ouro deixa de
// mandar e vira o que sempre foi bom para ser — um sinal na tela. E o unico
// limite duro continua sendo a veiculacao: prazo nunca depois do ar.
const CARGA_IDEAL_POR_DIA = 5;

function proximoDiaUtil(iso) {
  const d = new Date(`${iso}T12:00:00`);
  // Sabado e domingo nao recebem prazo: marcar entrega para o fim de semana e
  // combinar um atraso com antecedencia.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

function proporAgenda(pessoasDaMesa) {
  const hoje = daPlanningTodayIso();
  const propostas = [];
  const semVeiculacao = [];

  (pessoasDaMesa || []).forEach((pessoaId) => {
    const itens = daIndividualPlanningItems(pessoaId).filter((item) => !isFinishedItem(item));
    // Sem veiculacao nao ha o que calcular: a regra inteira parte dela. Estas
    // saem da conta e sao DEVOLVIDAS a pessoa como pendencia, em vez de
    // receberem uma data inventada.
    itens.filter((item) => !String(item.veiculacao_iso || ''))
      .forEach((item) => { if (!semVeiculacao.some((x) => String(x.id) === String(item.id))) semVeiculacao.push(item); });
    // O DESEMPATE PELO ID NAO E DETALHE: duas pecas que vao ao ar no mesmo dia
    // empatam, e sem criterio fixo a ordem entre elas mudava a cada leitura — a
    // proposta ficava sugerindo troca-las de lugar para sempre.
    const comData = itens.filter((item) => String(item.veiculacao_iso || ''))
      .sort((a, b) => String(a.veiculacao_iso).localeCompare(String(b.veiculacao_iso))
        || String(a.id).localeCompare(String(b.id)));

    const carga = new Map();
    let dia = proximoDiaUtil(hoje);

    comData.forEach((item) => {
      const veic = String(item.veiculacao_iso);
      // Enche o dia ate a meta antes de andar para o proximo: e isso que impede
      // o dia de amanha de nascer vazio.
      while ((carga.get(dia) || 0) >= CARGA_IDEAL_POR_DIA) dia = proximoDiaUtil(somarDias(dia, 1));
      // Unico limite duro: nada depois do ar. Peca que vai ao ar antes da vez
      // dela na fila e puxada para o proprio dia de veiculacao.
      const escolhido = dia > veic ? veic : dia;
      carga.set(escolhido, (carga.get(escolhido) || 0) + 1);

      const atual = String(item.prazo_iso || '');
      if (atual === escolhido) return;
      const ouro = goldenDeadlineIso(veic);
      propostas.push({
        id: String(item.id), nome: item.nome || 'Sem título', cliente: item.cliente || '',
        de: atual, para: escolhido, veiculacao: veic,
        motivo: !atual ? 'estava sem prazo'
          : atual < hoje ? 'o prazo já tinha passado'
          : escolhido === veic && dia > veic ? 'vai ao ar antes da vez na fila'
          : ouro && escolhido > ouro ? 'entrou na fila do dia · fica abaixo dos 7 dias'
          : 'para encher o dia de trabalho',
      });
    });
  });
  return { propostas, semVeiculacao, carga: CARGA_IDEAL_POR_DIA };
}

// O TOPO DA MESA PASSA A DIZER O QUE FAZER, E NAO O QUE E.
//
// Ali havia a definicao do Prazo de Ouro e um manual de duas linhas ensinando a
// marcar caixinhas. Nada disso e o motivo de alguem abrir esta tela: quem abre
// vem consertar prazos que passaram e distribuir a carga. Entao o topo mostra
// esses numeros — e os que levam a algum lugar sao botoes que filtram a lista.
function daPlanningPainelDeAcao(itens, pessoasDaMesa) {
  const hoje = daPlanningTodayIso();
  const vencidos = itens.filter((d) => String(d.prazo_iso || '') && String(d.prazo_iso) < hoje);
  const semPrazo = itens.filter((d) => !String(d.prazo_iso || ''));
  const semVeic = itens.filter((d) => !String(d.veiculacao_iso || ''));
  // Quantos dias de trabalho a fila representa na carga ideal. E a conta que
  // decide se da para aceitar mais uma demanda hoje.
  const dias = Math.max(1, Math.ceil(itens.length / CARGA_IDEAL_POR_DIA));
  const proposta = proporAgenda(pessoasDaMesa).propostas.length;
  const quem = pessoasDaMesa[0] || '';

  const numero = (valor, rotulo, tom, acao) => `<button type="button"
    class="ag-num ${tom} ${acao ? '' : 'quieto'}" ${acao ? `onclick="${acao}"` : 'disabled'}
    ><b>${valor}</b><span>${rotulo}</span></button>`;

  return `<div class="da-planning-acao">
      <div class="ag-numeros">
        ${numero(vencidos.length, vencidos.length === 1 ? 'prazo venceu' : 'prazos venceram',
          vencidos.length ? 'alerta' : '', vencidos.length ? `daPlanningSetFilter('atrasados','${quem}')` : '')}
        ${numero(semPrazo.length, 'sem prazo', semPrazo.length ? 'atencao' : '', '')}
        ${numero(semVeic.length, 'sem veiculação', semVeic.length ? 'atencao' : '',
          semVeic.length ? `daPlanningSetFilter('semveic','${quem}')` : '')}
        ${numero(dias, dias === 1 ? 'dia de fila' : 'dias de fila', '', '')}
      </div>
      <div class="ag-acao-lado">
        <span class="ag-acao-nota">${proposta
          ? `<b>${proposta}</b> ${proposta === 1 ? 'prazo sairia do lugar' : 'prazos sairiam do lugar'} se a agenda fosse arrumada agora.`
          : `A agenda já está cheia na ordem de veiculação, ${CARGA_IDEAL_POR_DIA} por dia útil.`}</span>
        <button type="button" class="ag-arrumar" onclick="arrumarAgenda()" ${proposta ? '' : 'disabled'}>
          Arrumar a agenda</button>
      </div>
    </div>`;
}

let PROPOSTA_DE_AGENDA = null;

// Mostra o que MUDARIA. Só depois de ver é que existe o botão de aplicar.
function arrumarAgenda() {
  const pessoas = daPlanningPessoasDaMesa();
  const r = proporAgenda(pessoas);
  PROPOSTA_DE_AGENDA = r.propostas;
  const linhas = r.propostas.map((p) => `<article class="ag-linha">
      <span class="ag-copy"><b>${safeText(p.nome)}</b><small>${safeText(p.cliente || 'Sem cliente')} · veicula ${planningDateBr(p.veiculacao)}</small></span>
      <span class="ag-mudanca"><i>${p.de ? safeText(planningDateBr(p.de)) : 'sem prazo'}</i><em>→</em><b>${safeText(planningDateBr(p.para))}</b></span>
      <span class="ag-motivo">${safeText(p.motivo)}</span>
    </article>`).join('');

  const pendentes = r.semVeiculacao.length
    ? `<div class="ag-pendencia"><b>${r.semVeiculacao.length} ${r.semVeiculacao.length === 1 ? 'entrega ficou' : 'entregas ficaram'} de fora</b>
       Sem data de veiculação não dá para calcular prazo — estas continuam como estão e precisam de uma data primeiro.</div>`
    : '';

  openWorkflowModal(`<div class="workflow-head"><b>Arrumar a agenda</b>
      <small>${r.carga} entregas por dia útil, na ordem de quem vai ao ar primeiro · prazo nunca depois do ar · nada em fim de semana</small></div>
    ${r.propostas.length
      ? `<div class="ag-resumo"><b>${r.propostas.length}</b> ${r.propostas.length === 1 ? 'prazo mudaria' : 'prazos mudariam'}. Confira antes de aplicar.</div>
         <div id="ag-lista-ou-progresso"><div class="ag-lista">${linhas}</div></div>`
      : '<div class="ag-resumo ok">✓ A agenda já está no padrão. Nenhum prazo precisa mudar.</div>'}
    ${pendentes}
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      ${r.propostas.length ? `<button type="button" class="workflow-primary" id="ag-aplicar" onclick="aplicarPropostaDeAgenda()">Aplicar ${r.propostas.length} ${r.propostas.length === 1 ? 'prazo' : 'prazos'}</button>` : ''}
    </div>`);
}

// Grava a proposta. Passa pelo MESMO caminho de gravacao de prazo que a mao
// usa — nao uma via propria, que seria uma segunda verdade sobre o que "salvar
// prazo" faz.
async function aplicarPropostaDeAgenda() {
  const lista = PROPOSTA_DE_AGENDA || [];
  if (!lista.length) return closeWorkflowModal();
  const botao = document.getElementById('ag-aplicar');
  if (botao) { botao.disabled = true; botao.textContent = 'Aplicando…'; }
  // NOVENTA E QUATRO GRAVACOES SAO UMA POR UMA, e cada uma e uma ida ao
  // servidor. "Aplicando…" num botao nao diz se falta um ou noventa — e a
  // diferenca entre esperar e achar que travou. A barra conta em voz alta.
  const painel = document.getElementById('ag-lista-ou-progresso');
  const pintarProgresso = (feitos, total, nome) => {
    if (!painel) return;
    const pct = Math.round((feitos / total) * 100);
    painel.innerHTML = `<div class="ag-progresso">
        <div class="ag-progresso-topo"><b>${feitos} de ${total}</b><span>${pct}%</span></div>
        <div class="ag-progresso-trilha"><i style="width:${pct}%"></i></div>
        <small>${feitos < total ? `gravando ${safeText(nome || '')}` : 'concluindo…'}</small>
      </div>`;
  };
  const total = lista.length;
  pintarProgresso(0, total, lista[0]?.nome);
  const feitos = []; const falhas = [];
  for (const p of lista) {
    const item = findOperationalItem(p.id);
    if (!item) { falhas.push(p.nome); pintarProgresso(feitos.length + falhas.length, total, p.nome); continue; }
    try {
      if (!await tentarEscritaDupla(item, { acao: 'prazo', item: String(item.id), data: p.para })) {
        await mondayQuery(`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`,
          { board: String(item.board_id || BOARD_ID), item: String(item.id), values: JSON.stringify({ data: { date: p.para } }) });
      }
      applyOutboundItemPatch(item.id, { prazo_iso: p.para }, 'agenda arrumada', { render: false, cache: false });
      feitos.push(p);
    } catch (erro) { falhas.push(p.nome); console.warn('agenda: não deu em', p.id, erro); }
    pintarProgresso(feitos.length + falhas.length, total, p.nome);
    // Um respiro para o navegador DESENHAR a barra — mas so quando ha alguem
    // olhando.
    //
    // setTimeout em aba fora de foco e estrangulado para UMA VEZ POR SEGUNDO.
    // Com o respiro incondicional, 94 prazos levavam 94 segundos se a pessoa
    // trocasse de aba enquanto rodava — medido aqui: um item por segundo. E se
    // a aba esta escondida ninguem ve a barra, entao o respiro so paga o preco.
    if (document.visibilityState === 'visible') {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  PROPOSTA_DE_AGENDA = null;
  saveProductionCache();
  closeWorkflowModal();
  if (typeof redesenharAposMudanca === 'function') redesenharAposMudanca('agenda arrumada');
  showToast(falhas.length
    ? `${feitos.length} prazo${feitos.length === 1 ? '' : 's'} ajustado${feitos.length === 1 ? '' : 's'} · ${falhas.length} não deu`
    : `✓ ${feitos.length} prazo${feitos.length === 1 ? '' : 's'} ajustado${feitos.length === 1 ? '' : 's'} pela ordem de veiculação`,
    falhas.length ? 'info' : 'ok', 8000);
}

function daPlanningDeadlineHealthBar(exact,slack,risk,pending,total){
  const base=Math.max(1,Number(total)||0);
  const segments=[['ok',exact,'No padrão · 7 dias'],['slack',slack,'Com folga'],['risk',risk,'Abaixo do padrão'],['pending',pending,'A validar']].filter(([,count])=>count>0).map(([kind,count,label])=>({kind,count,label,pct:Math.round((count/base)*100)}));
  return `<div class="da-planning-health" aria-label="Saúde dos prazos"><div class="da-planning-health-head"><b>Saúde dos prazos</b><small>margem até a veiculação · ${total} entregas</small></div><div class="da-planning-health-track">${segments.map(segment=>`<span class="health-${segment.kind}" style="width:${segment.pct}%" title="${segment.label}: ${segment.count} de ${total} (${segment.pct}%)"></span>`).join('')}</div><div class="da-planning-health-legend">${segments.map(segment=>`<span class="health-${segment.kind}"><i></i><strong>${segment.label}</strong><b>${segment.count}</b><em>${segment.pct}%</em></span>`).join('')}</div></div>`;
}
// Redesenha a mesa SE ela estiver aberta — e so nesse caso.
//
// Sem isto, trocar o responsavel pela coluna nova gravava certo e deixava as
// bolinhas antigas na tela: o botao pareceria nao funcionar. A guarda importa
// tanto quanto o redesenho: chamar a abertura com a mesa fechada ABRIRIA a mesa
// no meio de outra tela.
// QUEM ESTA NA MESA E DA_PLANNING_PESSOAS. NAO E O FILTRO DO DA.
//
// daControllerPersonId e o filtro de pessoa da tela do DA — vale 'all' quando
// ninguem esta filtrado, e vale DEIVID quando o filtro esta nele. Reabrir a mesa
// por esse valor troca de pessoa: a Bia abria a agenda da Jady, mexia num prazo,
// e a mesa voltava para o Deivid com a alteracao feita numa tela que ela nao
// estava mais vendo. E com 'all' era pior — 'all' nao e pessoa, a abertura
// desistia em silencio e a mesa nao se repintava.
//
// Toda repintura da mesa passa por aqui, por isso, e reabrir por alguem que JA
// esta nela preserva as mesas de duas ou tres pessoas.
function repintarMesaDePlanejamento() {
  if (!document.getElementById('da-individual-planning-overlay')) return;
  if (typeof openDaIndividualPlanningDesk !== 'function') return;
  const naMesa = typeof DA_PLANNING_PESSOAS !== 'undefined' ? [...DA_PLANNING_PESSOAS][0] : '';
  if (!naMesa) return;
  openDaIndividualPlanningDesk(naMesa);
}

function openDaIndividualPlanningDesk(userId=daControllerPersonId){ const user=daControllerTeam().find(entry=>String(entry.id)===String(userId)); if(!user) return showToast('Selecione uma pessoa da célula para abrir o planejamento individual.','info');
  // Abrir apontando alguem de fora do conjunto recomeca a mesa nessa pessoa. Os
  // redesenhos (filtro, ordem, selecao) apontam alguem que ja esta dentro, e por
  // isso nao desfazem uma mesa de duas ou tres pessoas.
  if (!DA_PLANNING_PESSOAS.has(String(user.id))) DA_PLANNING_PESSOAS = new Set([String(user.id)]);
  const pessoasDaMesa = daPlanningPessoasDaMesa(user.id);
  const items=daIndividualPlanningItems(pessoasDaMesa);
  // A marcacao em lote e por mesa: mudar quem esta na mesa muda o que esta a
  // vista, e uma marca herdada aplicaria prazo numa peca que sumiu da tela.
  const assinatura = pessoasDaMesa.slice().sort().join('+');
  if(String(DA_PLANNING_ACTIVE_USER)!==assinatura){ DA_PLANNING_SELECTED_IDS.clear(); DA_PLANNING_SELECTION_ANCHOR_ID=''; DA_PLANNING_ACTIVE_USER=assinatura; } const goldenStates=items.map(item=>daIndividualPlanningGoldenState(item)); const exactCount=goldenStates.filter(state=>state.kind==='ok').length; const riskCount=goldenStates.filter(state=>state.kind==='risk').length; const slackCount=goldenStates.filter(state=>state.kind==='slack').length; const pendingCount=goldenStates.filter(state=>state.kind==='pending').length; const previousPlanning=document.getElementById('da-individual-planning-overlay');
  // Toda mudanca aqui (filtro, marcar, salvar prazo) redesenha a mesa inteira, e
  // a mesa nova nascia rolada no topo: quem estava na linha 18 voltava pra 1 a
  // cada clique. Guardar a rolagem e devolver depois e o que faz a tela ficar
  // parada onde a pessoa estava.
  const rolagemAnterior=previousPlanning?.querySelector('.da-planning-list')?.scrollTop||0;
  const eraRedesenho=Boolean(previousPlanning);
  if(previousPlanning) previousPlanning.remove(); const overlay=document.createElement('div'); overlay.id='da-individual-planning-overlay'; overlay.className='da-planning-overlay'; overlay.style.setProperty('--da-plan-color',user.color||'#ff9d00'); overlay.onclick=event=>{if(event.target===overlay) closeDaIndividualPlanningDesk();}; const totalItems=daIndividualPlanningAllItems(user.id).length; const healthBar=daPlanningDeadlineHealthBar(exactCount,slackCount,riskCount,pendingCount,items.length); const rows=items.length?items.map((item,index)=>daIndividualPlanningRow(item,index,user.id)).join(''):'<div class="da-planning-empty">Nenhuma demanda nesta visão. Ajuste os filtros para revisar as demais.</div>'; const controls=daPlanningControlsHtml(user.id,items.length,totalItems); const bulk=daPlanningBulkToolbarHtml(items,user.id); const quickSwitch=`<nav class="da-planning-switcher" aria-label="Troca rápida de agenda"><span>Agendas na mesa</span>${daControllerTeam().map(entry=>{const active=pessoasDaMesa.includes(String(entry.id)); const total=daIndividualPlanningItems(entry.id).length; return `<button type="button" class="${active?'active':''}" onclick="daPlanningEscolherPessoa('${entry.id}',event)" aria-pressed="${active}" title="${active?(pessoasDaMesa.length>1?'Clique para tirar '+safeText(firstName(entry.name))+' da mesa':'Única agenda na mesa — some outra para comparar'):'Clique para somar '+safeText(firstName(entry.name))+' à mesa'}">${daIndividualPlanningAvatar(entry)}<b>${safeText(firstName(entry.name))}</b><small>${total}</small></button>`;}).join('')}<button type="button" class="da-planning-todos ${pessoasDaMesa.length===daControllerTeam().length?'active':''}" onclick="daPlanningTodasAsPessoas()" title="Ver a célula inteira numa mesa só">Toda a célula<small>${daControllerTeam().length}</small></button><small class="da-planning-dica">clique para somar ou tirar</small></nav>`; overlay.innerHTML=`<section class="da-planning-modal" role="dialog" aria-modal="true" aria-label="Planejamento individual de ${safeText(user.name)}"><div class="da-planning-head"><div class="da-planning-head-main">${pessoasDaMesa.slice(0,3).map(id=>daIndividualPlanningAvatar(daControllerTeam().find(p=>String(p.id)===String(id))||user)).join('')}<div><span>${pessoasDaMesa.length>1?'Mesa de planejamento · '+pessoasDaMesa.length+' pessoas':'Mesa individual de planejamento'}</span><b>${safeText(pessoasDaMesa.length>1?daControllerTeam().filter(p=>pessoasDaMesa.includes(String(p.id))).map(p=>firstName(p.name)).join(' + '):user.name).toUpperCase()}</b><small>${pessoasDaMesa.length>1?'entregas das agendas somadas, sem repetir a peça de dono compartilhado':safeText(DA_CONTROLLER_ROLES[user.id]||'Criação')+' · todas as entregas ativas ordenadas pela data de veiculação'}</small></div></div><button type="button" class="da-planning-close" onclick="closeDaIndividualPlanningDesk()" aria-label="Fechar planejamento">×</button></div>${quickSwitch}${controls}<div class="da-planning-summary"><span><b>${items.length}</b><small>Entregas ativas</small></span><span class="gold-ok-metric"><b>${exactCount}</b><small>No padrão · 7D</small></span><span class="gold-slack-metric"><b>${slackCount}</b><small>Com folga</small></span><span class="gold-risk-metric"><b>${riskCount}</b><small>Abaixo do padrão</small></span></div>${daPlanningPainelDeAcao(items, pessoasDaMesa)}${healthBar}${bulk}<div class="da-planning-list"><div class="da-planning-row da-planning-row-head"><span class="da-planning-select-head">Selec.</span><span>#</span>${daPlanningCabecalho("DEMANDA / CLIENTE","cliente",userId)}<span>RESPONSÁVEL</span>${daPlanningCabecalho("Veiculação","veiculacao",userId)}<span>FORMATO</span><span>STATUS</span>${daPlanningCabecalho("Prazo editável","prazo",userId)}<span>ARQUIVO</span><span>AÇÃO</span></div>${rows}</div></section>`; document.body.appendChild(overlay);
  const lista=overlay.querySelector('.da-planning-list');
  if(lista&&rolagemAnterior) lista.scrollTop=rolagemAnterior;
  daPlanningCarregarArquivos();
  // Redesenho nao e abertura: repetir o fade fazia a mesa piscar a cada clique.
  if(eraRedesenho) overlay.classList.add('open');
  else requestAnimationFrame(()=>overlay.classList.add('open')); }
function saveDaPlanningGridDeadline(userId,itemId,prazo,input){
  const selected=daPlanningSelection(userId);
  const inSelection=selected.some(item=>String(item.id)===String(itemId));
  if(selected.length>=2&&inSelection) return saveDaPlanningSelectedDeadlines(userId,itemId,prazo,input);
  return saveDaIndividualDeadline(itemId,prazo,input);
}
async function saveDaPlanningSelectedDeadlines(userId,sourceItemId,prazo,input){
  if(input?.dataset?.saving==='1') return;
  const selected=daPlanningSelection(userId);
  const date=String(prazo||'');
  const sourceItem=selected.find(item=>String(item.id)===String(sourceItemId));
  if(!date||!sourceItem) return showToast('Informe uma data válida para as demandas marcadas.','info');
  const invalid=selected.filter(item=>item.veiculacao_iso&&date>String(item.veiculacao_iso));
  if(invalid.length){ const limit=daPlanningBatchDeadlineLimit(userId); const names=invalid.slice(0,2).map(item=>String(item.nome||'Demanda sem título')).join(' · '); const extra=invalid.length>2?' +'+(invalid.length-2)+' outra'+(invalid.length-2===1?'':'s'):''; input.value=sourceItem.prazo_iso||''; input.setAttribute('aria-invalid','true'); input.classList.add('batch-date-invalid'); setTimeout(()=>{input?.removeAttribute('aria-invalid');input?.classList.remove('batch-date-invalid');},4200); return showToast('Prazo não alterado: '+planningDateBr(date)+' ultrapassa a veiculação de '+invalid.length+' demanda'+(invalid.length===1?'':'s')+'. Data máxima do lote: '+(limit?planningDateBr(limit):'não definida')+'. Bloqueiam: '+names+extra+'.','err',9500); }
  const targets=selected.filter(item=>String(item.prazo_iso||'')!==date);
  if(!targets.length){ showToast('As demandas marcadas já estão com esse prazo.','info'); return; }
  const selectedInputs=[...document.querySelectorAll('#da-individual-planning-overlay .da-planning-row input[type="date"]')].filter(field=>field.closest('.da-planning-row')?.querySelector('input[type="checkbox"]')?.checked);
  selectedInputs.forEach(field=>{field.dataset.saving='1';field.setAttribute('aria-busy','true');field.classList.add('is-saving');field.value=date;});
  armOutboundMutationGuard('prazo direto em lote da mesa individual');
  const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
  const success=[]; const failed=[];
  for(const item of targets){
    try{
      if(!await tentarEscritaDupla(item,{acao:'prazo',item:String(item.id),data:date})) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify({data:{date}})});
      const veic=String(item.veiculacao_iso||''); const followsGolden=Boolean(veic&&date===goldenDeadlineIso(veic));
      try{await postItemUpdate(item.id,`[Vybe OS · Planejamento direto em lote do DA]\nPrazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(date)}\nVeiculação: ${planningDateBr(veic)}\n${followsGolden?`Prazo de Ouro protegido (${PRAZO_OURO_DIAS} dias antes da veiculação).`:`Ajuste coletivo direto permitido; alerta visual de margem aplicado quando necessário.`}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`);}catch(logError){console.warn('Prazo alterado, mas histórico não foi registrado.',logError);}
      if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){request.prazo_iso=date;request.prazo=planningDateBr(date).slice(0,5);} outboundMutationGuardUntil=0; } else applyOutboundItemPatch(item.id,{prazo_iso:date},'prazo direto em lote da mesa individual'); DA_PLANNING_SELECTED_IDS.delete(String(item.id)); success.push(item);
    }catch(error){failed.push(item);console.warn('Falha no prazo direto em lote',item.id,error);}
  }
  failed.forEach(item=>DA_PLANNING_SELECTED_IDS.add(String(item.id)));
  saveProductionCache(); renderDaController(); repintarMesaDePlanejamento();
  if(!failed.length) showToast('✓ '+success.length+' prazo'+(success.length===1?' atualizado':'s atualizados')+' diretamente na tabela.','ok');
  else showToast(success.length+' prazo'+(success.length===1?'':'s')+' atualizado'+(success.length===1?'':'s')+'; '+failed.length+' falhou'+(failed.length===1?'':'ram')+'.','info',7000);
}
async function saveDaIndividualDeadline(itemId,prazo,input){ if(input?.dataset?.saving==='1') return; const item=findOperationalItem(itemId); if(!item||!prazo) return showToast('Informe um prazo válido antes de atualizar.','info'); const veic=String(item.veiculacao_iso||''); if(veic&&prazo>veic){ input.value=item.prazo_iso||''; return showToast('O prazo não pode ficar depois da veiculação. Ajuste a data antes de salvar.','info'); } if(String(item.prazo_iso||'')===prazo) return; input.dataset.saving='1'; input.setAttribute('aria-busy','true'); input.classList.add('is-saving'); armOutboundMutationGuard('prazo individual do DA'); const golden=goldenDeadlineIso(veic); const followsGolden=Boolean(golden&&prazo===golden); try{ const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`; if(!await tentarEscritaDupla(item,{acao:'prazo',item:String(item.id),data:prazo})) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify({data:{date:prazo}})}); const signal=veic?(followsGolden?`Prazo de Ouro protegido (${PRAZO_OURO_DIAS} dias antes da veiculação).`:`Alerta visual: prazo fora do padrão de ${PRAZO_OURO_DIAS} dias; ajuste permitido pela mesa individual do DA.`):'Veiculação ainda não definida; prazo ajustado pela mesa individual do DA.'; try{ await postItemUpdate(item.id,`[Vybe OS · Planejamento individual do DA]\nPrazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(prazo)}\nVeiculação: ${planningDateBr(veic)}\n${signal}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); }catch(logError){ console.warn('Prazo ajustado, mas o histórico não foi registrado.',logError); } if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){request.prazo_iso=prazo;request.prazo=planningDateBr(prazo).slice(0,5);} outboundMutationGuardUntil=0; renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{prazo_iso:prazo},'prazo individual do DA'); showToast(followsGolden?'✓ Prazo atualizado · padrão de 7 dias protegido':'⚠ Prazo atualizado · alerta de margem exibido','ok'); repintarMesaDePlanejamento(); renderDaController(); }catch(error){ delete input.dataset.saving; input.removeAttribute('aria-busy'); input.classList.remove('is-saving'); input.value=item.prazo_iso||''; showToast(`Não foi possível atualizar o prazo: ${error.message}`,'err',7000); } }
function setDaControllerPerson(userId) { const next=daControllerPersonId===userId?'all':userId; daControllerPersonId=next; renderDaController(); }
function setDaControllerDayFocus(iso) { daControllerDayFocusIso=iso; renderDaController(); }
function setDaQuickWeekday(iso) { if(daControllerPeriod!=='week') daControllerPeriod='week'; daControllerDayFocusIso=iso; renderDaController(); }

function showCadastrosPreview(){ const existing=document.getElementById('cadastros-preview-overlay'); if(existing){existing.remove();return;} const overlay=document.createElement('div'); overlay.id='cadastros-preview-overlay'; overlay.className='cadastros-preview-overlay'; overlay.onclick=event=>{if(event.target===overlay) overlay.remove();}; overlay.innerHTML=`<section class="cadastros-preview-modal" role="dialog" aria-modal="true" aria-label="Módulo Cadastros bloqueado"><button type="button" class="cadastros-preview-close" onclick="document.getElementById('cadastros-preview-overlay').remove()">×</button><div class="cadastros-preview-kicker">04 / GOVERNANÇA OPERACIONAL · ACESSO BLOQUEADO</div><h3>Cadastros<br><span>Próxima estação do Vybe OS</span></h3><p>Este módulo será a porta de entrada controlada das demandas. Nenhum item será criado sem a ação explícita do responsável.</p><div class="cadastros-preview-grid"><div><b>01 · INTENÇÃO</b><span>Cliente, objetivo, formato e briefing.</span></div><div><b>02 · PLANEJAMENTO</b><span>Responsáveis, prazo, veiculação e frequência.</span></div><div><b>03 · GOVERNANÇA</b><span>Nomenclatura, status, checklist e trilha de aprovação.</span></div></div><small>STATUS: ARQUITETURA RESERVADA · LIBERAÇÃO APÓS DEFINIÇÃO DO FLUXO</small></section>`; document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open')); }
const CADASTROS_ROUTES=[{id:'producao',label:'Produção de Conteúdo',copy:'Fluxo editorial e criativo recorrente.'},{id:'demanda',label:'Solicitação de Demanda',copy:'Pedido recebido que entra na esteira de solicitações.'}]; const CADASTROS_FORMATS=['Reels','Vídeo','Fotografia','Carrossel','Feed','Story','Card','Motion'];
function cadastrosIsoOffset(base,delta){const d=new Date(`${base}T12:00:00`);d.setDate(d.getDate()+delta);return d.toISOString().slice(0,10);}
function cadastrosDestiny(format, briefingReady, materialReady = false, extraAssignees = []) {
    const baseAssignees = (arr) => [...new Set([...arr, ...extraAssignees])];
    if(!briefingReady) return {group:'group_title',groupLabel:'Redação',status:'A Fazer',assignees:baseAssignees([]),capture:false,why:'Sem briefing confirmado: entra em Redação para construir a base do conteúdo.'};
    // FOTOGRAFIA E CAPTADA COMO VIDEO, MAS EDITADA COMO DESIGN.
    //
    // Estava na mesma linha que Reels e Video, e por isso caia com o Reriston
    // quando o material chegava pronto. Reriston e edicao e motion; foto tratada
    // e do Deivid, da Bia e da Jady — a mesma regra que o resto do painel ja
    // segue ("Cards, Carrosseis, Feed, Story e Fotografia" sao Design).
    //
    // O que os tres formatos DIVIDEM e a captacao: sem material, os tres entram
    // na fila de Producao Foto e Video. O que muda e para quem vao depois.
    const PRECISA_CAPTAR = ['Reels', 'Vídeo', 'Fotografia'];
    if(PRECISA_CAPTAR.includes(format)) {
        if (materialReady) {
            const daFoto = format === 'Fotografia';
            const equipe = daFoto ? EQUIPES.design : EQUIPES.audiovisual;
            return {group:'novo_grupo__1',groupLabel:'Design & Edição',status:'Pode Fazer',
              assignees:baseAssignees(equipe),capture:false,
              why: daFoto
                ? 'Material já fornecido. Foto tratada é Design & Edição: vai para Deivid, Beatriz e Jady.'
                : 'Material de captação já fornecido. Vai direto para edição com o Reriston.'};
        }
        return {group:'novo_grupo57911__1',groupLabel:'Produção (Foto e Vídeo)',status:'A Fazer',assignees:baseAssignees([]),capture:true,why:'Formato exige captação; a demanda entra na fila de Produção Foto e Vídeo.'};
    }
    if(format==='Motion') return {group:'novo_grupo__1',groupLabel:'Design & Edição',status:'Falta D.A',assignees:baseAssignees(EQUIPES.motion),capture:false,why:'Motion entra em Design & Edição aguardando direção de arte.'};
    // EQUIPES.design e nao a dupla escrita a mao: Card, Carrossel, Story e Feed
    // caiam so com Deivid e Beatriz, deixando a Jady de fora do proprio time
    // dela. Mesmo defeito da Fotografia, uma linha acima — e a mesma causa: a
    // equipe repetida no lugar de ser lida de onde ela e definida.
    return {group:'novo_grupo__1',groupLabel:'Design & Edição',status:'Pode Fazer',assignees:baseAssignees(EQUIPES.design),capture:false,why:'Briefing pronto: o conteúdo entra diretamente na produção de Design & Edição.'};
  }
// A lista sai de DADOS_ALL, nao de DADOS: DADOS e o recorte da semana aberta, e
// um cliente sem peca nesta semana simplesmente nao aparecia para cadastrar.
function cadastrosClientOptions(){const base=(typeof DADOS_ALL!=='undefined'&&DADOS_ALL?.length)?DADOS_ALL:(DADOS||[]);return [...new Set(base.map(d=>d.cliente).filter(client=>client&&client!=='Sem cliente'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));}
function cadastrosAssigneeNames(ids){return ids.map(id=>TEAM_USERS.find(user=>String(user.id)===String(id))?.name).filter(Boolean).join(' + ') || 'definido na triagem';}
function cadastrosDraftData(){const title=String(document.getElementById('cad-title')?.value||'').trim();const client=String(document.getElementById('cad-client')?.value||'').trim();const route=String(document.getElementById('cad-route')?.value||'producao').trim();const format=String(document.getElementById('cad-format')?.value||'').trim();const veic=String(document.getElementById('cad-veic')?.value||'').trim();const prazo=String(document.getElementById('cad-prazo')?.value||'').trim();const brief=String(document.getElementById('cad-brief')?.value||'').trim();const briefingReady=Boolean(document.getElementById('cad-brief-ready')?.checked);const destiny=cadastrosDestiny(format,briefingReady);const routeMeta=CADASTROS_ROUTES.find(item=>item.id===route)||CADASTROS_ROUTES[0];const normalized=title ? `${format} - ${title.replace(new RegExp(`^${format}\\s*-\\s*`,'i'),'')}` : '';return {title,client,route,routeMeta,format,veic,prazo,brief,briefingReady,destiny,normalized};}
function updateCadastrosPreview(){const target=document.getElementById('cad-preview'); if(!target)return;const d=cadastrosDraftData();const routeDestiny=d.route==='demanda'?{groupLabel:'Solicitações de Demandas',status:'Nova Demanda',assignees:d.destiny.assignees,why:'A entrada será criada na esteira de Solicitações e continuará visível em GESTOR, FOCO e DA CONTROLER.'}:d.destiny;const autoDeadline=d.veic&&!d.prazo?cadastrosIsoOffset(d.veic,-7):d.prazo;target.innerHTML=`<div class="cad-preview-title">PRÉ-VALIDAÇÃO</div><b>${safeText(d.normalized||'Formato - Título do conteúdo')}</b><span>${safeText(d.client||'Cliente pendente')} · ${safeText(d.format||'Formato pendente')}</span><small>Entrada: ${safeText(d.routeMeta.label)} · Destino: ${safeText(routeDestiny.groupLabel)} · ${safeText(routeDestiny.status)} · ${safeText(cadastrosAssigneeNames(routeDestiny.assignees))}</small><small>${safeText(routeDestiny.why)}</small><small>Prazo: ${safeText(autoDeadline||'pendente')} · Veiculação: ${safeText(d.veic||'pendente')}</small>`;const prazo=document.getElementById('cad-prazo'); if(prazo&&d.veic&&!prazo.value)prazo.value=cadastrosIsoOffset(d.veic,-7);}
function closeCadastrosGoverned(){document.getElementById('cadastros-preview-overlay')?.remove();}
function openCadastrosGovernedLegacy(){const existing=document.getElementById('cadastros-preview-overlay');if(existing){existing.remove();return;}const clients=cadastrosClientOptions();const today=HOJE_ISO||new Date().toISOString().slice(0,10);const overlay=document.createElement('div');overlay.id='cadastros-preview-overlay';overlay.className='cadastros-preview-overlay cadastros-governed-overlay';overlay.onclick=event=>{if(event.target===overlay)closeCadastrosGoverned();};overlay.innerHTML=`<section class="cadastros-preview-modal cadastros-governed-modal" role="dialog" aria-modal="true" aria-label="CADASTROS governado"><button type="button" class="cadastros-preview-close" onclick="closeCadastrosGoverned()">×</button><div class="cadastros-preview-kicker">04 / GOVERNANÇA OPERACIONAL · PRÉ-CADASTRO</div><h3>Cadastros<br><span>Entrada controlada no Vybe OS</span></h3><p>O sistema valida a regra de nomenclatura, o destino do formato, responsáveis, prazo e veiculação antes da criação. Nenhuma demanda é criada até o comando final.</p><div class="cadastros-governed-layout"><form class="cadastros-form" oninput="updateCadastrosPreview()" onchange="updateCadastrosPreview()"><label><span>Cliente *</span><select id="cad-client" required><option value="">Selecione o cliente</option>${clients.map(client=>`<option value="${safeText(client)}">${safeText(client)}</option>`).join('')}</select></label><label><span>Tipo de entrada *</span><select id="cad-route" required><option value="producao">Produção de Conteúdo · fluxo editorial</option><option value="demanda">Solicitação de Demanda · pedido recebido</option></select></label><label><span>Formato *</span><select id="cad-format" required><option value="">Selecione o formato</option>${CADASTROS_FORMATS.map(format=>`<option value="${format}">${format}</option>`).join('')}</select></label><label class="cad-full"><span>Título do conteúdo *</span><input id="cad-title" type="text" placeholder="Ex.: Bastidores da nova coleção" required></label><label><span>Veiculação *</span><input id="cad-veic" type="date" min="${today}" required></label><label><span>Prazo de Ouro * · 7 dias antes</span><input id="cad-prazo" type="date" min="${today}" required></label><label class="cad-full"><span>Briefing / intenção *</span><textarea id="cad-brief" rows="4" placeholder="Objetivo, mensagem, referência ou orientação do conteúdo." required></textarea></label><label class="cad-full cad-check"><input id="cad-brief-ready" type="checkbox"><span>O briefing está pronto para produção. Se não estiver, a demanda seguirá para Redação com status A Fazer.</span></label></form><aside id="cad-preview" class="cad-preview"></aside></div><div class="cadastros-governed-foot"><span>Regras aplicadas: formato no início do nome · Prazo de Ouro de sete dias antes da veiculação · status e responsáveis conforme a triagem.</span><button type="button" class="cadastros-submit" onclick="submitCadastrosGoverned()">Validar e criar →</button></div></section>`;document.body.appendChild(overlay);requestAnimationFrame(()=>{overlay.classList.add('open');updateCadastrosPreview();});}
async function submitCadastrosGoverned(){const d=cadastrosDraftData();const today=HOJE_ISO||new Date().toISOString().slice(0,10);if(!d.client||!d.format||!d.title||!d.veic||!d.prazo||!d.brief)return showToast('Preencha cliente, formato, título, prazo, veiculação e briefing antes de criar.','info');if(d.veic<today)return showToast('A veiculação não pode ser anterior à data atual.','info');if(d.prazo>d.veic)return showToast('O prazo precisa ser anterior ou igual à veiculação.','info');if(d.prazo!==cadastrosIsoOffset(d.veic,-7))return showToast('O Prazo de Ouro precisa ficar sete dias antes da veiculação.','info');const button=document.querySelector('.cadastros-submit');if(button){button.disabled=true;button.textContent='Criando...';}const values={[COLUNAS.producao.cliente]:{labels:[d.client]},[COLUNAS.producao.formato]:{labels:[d.format]},[COLUNAS.producao.etapa]:{index:3},[COLUNAS.producao.veiculacao]:{date:d.veic},[COLUNAS.producao.prazo]:{date:d.prazo},status:{label:d.destiny.status},person:{personsAndTeams:d.destiny.assignees.map(id=>({id:Number(id),kind:'person'}))}};if(d.destiny.capture)values[COLUNAS.producao.captacao]={label:'Agendar Captação'};if(d.route==='demanda'){delete values[COLUNAS.producao.cliente];delete values[COLUNAS.producao.formato];delete values[COLUNAS.producao.etapa];delete values[COLUNAS.producao.veiculacao];values[COLUNAS.demandas.cliente]={labels:[d.client]};values[COLUNAS.demandas.formato]={labels:[d.format]};values[COLUNAS.demandas.veiculacao]={date:d.veic};values.status={label:'Nova Demanda'};}try{const targetBoard=d.route==='demanda'?BOARD_DEMANDAS_ID:BOARD_ID;const targetGroup=d.route==='demanda'?'group_mm187437':d.destiny.group;const create=`mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;const created=await mondayQuery(create,{board:String(targetBoard),group:targetGroup,name:d.normalized,values:JSON.stringify(values)});const itemId=created?.create_item?.id;if(!itemId)throw new Error('Monday não retornou o identificador do item.');const extra=d.client.toLowerCase().includes('hellen rocha')?'\n<li>☐ Validar informações jurídicas com a Hellen antes de publicar</li>':'';const checklist=`<p><strong>✅ CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${safeText(d.brief)}</p><ul><li>☐ Revisar copy e adaptar ao tom da marca</li><li>☐ Selecionar referências visuais / banco de imagens</li><li>☐ Montar layout no padrão do cliente</li><li>☐ Enviar para aprovação antes de publicar</li>${extra}</ul>`;await mondayQuery(`mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,{item:String(itemId),body:checklist});closeCadastrosGoverned();showToast(`✓ ${d.route==='demanda'?'Solicitação':'Cadastro'} criado e conectado ao fluxo integrado.`,'ok',6000);if(d.route==='demanda'){DADOS_DEMANDAS=[];await ensureDemandasForOperationalViews(true);}else await refreshData();}catch(error){if(button){button.disabled=false;button.textContent='Validar e criar →';}showToast(`Não foi possível criar o cadastro: ${error.message}`,'err',8000);}}

function identityDecodeTitle() {
  const title = document.querySelector('.identity-hero h2');
  if (!title || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  title.classList.remove('identity-title-reveal');
  void title.offsetWidth;
  title.classList.add('identity-title-reveal');
}

/* ─── UNIDADE PRODUÇÃO · ordem única para captação, fotografia e edição ─── */
let productionCommandDateMode='prazo';
let productionCommandFocusDate='';
const PRODUCTION_COMMAND_FINISHED=new Set(['Finalizado','Feito']);
function productionCommandReference(item){ return productionCommandDateMode==='veiculacao' ? (item.veiculacao_iso||item.prazo_iso||'') : (item.prazo_iso||item.veiculacao_iso||''); }
function productionCommandDateLabel(item){ const iso=productionCommandReference(item); return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : 'Sem data'; }
function productionCommandKind(item){ const format=String(item?.formato||'').toLowerCase(); if(/foto|fotografia/.test(format)) return {icon:'◉',label:'FOTOGRAFIA'}; if(/motion/.test(format)) return {icon:'◇',label:'MOTION'}; if(/reels|vídeo|video/.test(format)) return {icon:'▶',label:'VÍDEO'}; return {icon:'◫',label:'PRODUÇÃO'}; }
function productionCommandRelevant(item){ return String(item?.group_id||'')==='novo_grupo57911__1' || (item?.responsavel||'').includes('Ademir') || (item?.responsavel||'').includes('Mizinho'); }
function productionCommandItems(){ return (DADOS_ALL?.length?DADOS_ALL:DADOS).filter(item=>productionCommandRelevant(item)&&!PRODUCTION_COMMAND_FINISHED.has(item.status)); }
function productionCommandReadiness(item){ const status=String(item?.status||'').trim(); if(['Falta Info','Ag. Info Cliente','Aguardo','Falta D.A','Alteração'].includes(status)) return {key:'blocked',label:'BLOQUEADO',color:'#ff637a',copy:item?.status_context?.reason||'Há uma dependência ou decisão pendente antes da execução.'}; if(['Para agendar','Agendado','Ag. Interno'].includes(status)) return {key:'scheduled',label:'CAPTAÇÃO AGENDADA',color:'#74a9ff',copy:'A ordem está em etapa de agenda ou confirmação operacional.'}; if(['Em andamento','Em Andamento','Em execução'].includes(status)) return {key:'executing',label:'EM EXECUÇÃO',color:'#00d184',copy:'A produção está em andamento; proteja material, tempo e próxima entrega.'}; if(['Para aprovação','Ag. Aprovação Cliente'].includes(status)) return {key:'approval',label:'EM VALIDAÇÃO',color:'#b493ff',copy:'A execução terminou esta etapa e aguarda validação para seguir.'}; if(status==='Pode Fazer' || status==='A Captar' || status==='A Fazer') return {key:'ready',label:'PRONTO PARA CAPTAÇÃO',color:'#ffd15a',copy:'O status indica que a base está liberada para iniciar a captação.'}; return {key:'brief',label:'PREPARAR ORDEM',color:'#ff9d00',copy:'Conferir briefing, roteiro, responsáveis e dados de captação antes de iniciar.'}; }
function productionCommandDates(){ const start=HOJE_ISO||new Date().toISOString().slice(0,10); return Array.from({length:7},(_,offset)=>{const d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);}); }
function productionCommandSetDate(iso){ productionCommandFocusDate=iso; renderProductionCommand(); }
function productionCommandSetDateMode(mode){ if(productionCommandDateMode===mode) return; productionCommandDateMode=mode; productionCommandFocusDate=''; renderProductionCommand(); }
function productionCommandOwner(item){ const ids=assignedIds(item); const users=(TEAM_USERS||[]).filter(user=>ids.includes(String(user.id))); return users.length?users.map(user=>firstName(user.name)).join(' + '):(item.responsavel||'Equipe a definir'); }
function productionCommandUpdateText(detail,item){ const record=detail?.item||detail||{}; const updates=Array.isArray(record?.updates)?record.updates:[]; const update=updates.find(entry=>/briefing|roteiro|captaç|captação|fotografia|pré-produção|pre-produção|checklist/i.test(statusContextPlainText(entry?.body||''))); const text=statusContextPlainText(update?.body||'') || item?.status_context?.reason || ''; return {text,updated:update?.created_at||item?.updated_at||'',source:update?'Atualização operacional registrada':'Contexto operacional disponível'}; }
function productionCommandIsoLabel(iso){ return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','').toUpperCase() : 'SEM DATA'; }
function productionCommandRow(item){ const readiness=productionCommandReadiness(item); const kind=productionCommandKind(item); const ref=productionCommandDateLabel(item); const context=readiness.copy; return `<button type="button" class="production-item-row" style="--production-state:${readiness.color}" onclick="openProductionSheet('${item.id}')"><span class="production-item-icon">${kind.icon}</span><span class="production-item-copy"><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(productionCommandOwner(item))} · ${safeText(ref)}</small><em class="production-item-context">${safeText(context)}</em></span><span class="production-item-tags">${daTacticalFormatTag(item)}${daTacticalStatusTag(item,true)}</span></button>`; }
function productionCommandReadyRow(item){ const readiness=productionCommandReadiness(item); return `<button type="button" class="production-ready-row" style="--production-ready:${readiness.color}" onclick="openProductionSheet('${item.id}')"><i></i><span><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(productionCommandDateLabel(item))} · ${safeText(readiness.label)}</small></span><span>${daTacticalFormatTag(item)}</span></button>`; }
function renderProductionCommand(){ const root=document.getElementById('production-command-dashboard'); if(!root) return; const all=productionCommandItems(); const dates=productionCommandDates(); const focus=productionCommandFocusDate&&dates.includes(productionCommandFocusDate)?productionCommandFocusDate:(dates.find(iso=>all.some(item=>productionCommandReference(item)===iso))||dates[0]); productionCommandFocusDate=focus; const focused=all.filter(item=>productionCommandReference(item)===focus).sort((a,b)=>{const rank={blocked:0,brief:1,ready:2,scheduled:3,executing:4,approval:5}; return rank[productionCommandReadiness(a).key]-rank[productionCommandReadiness(b).key]||String(a.nome).localeCompare(String(b.nome),'pt-BR');}); const blocked=all.filter(item=>productionCommandReadiness(item).key==='blocked'); const ready=all.filter(item=>['ready','scheduled','executing'].includes(productionCommandReadiness(item).key)); const executing=all.filter(item=>productionCommandReadiness(item).key==='executing'); const dateRail=dates.map(iso=>{const list=all.filter(item=>productionCommandReference(item)===iso); const capture=list.filter(item=>['▶','◉'].includes(productionCommandKind(item).icon)).length; const active=iso===focus; return `<button type="button" class="production-day ${active?'active':''} ${iso===(HOJE_ISO||'')?'today':''}" onclick="productionCommandSetDate('${iso}')"><b>${safeText(productionCommandIsoLabel(iso))}</b><small>${productionCommandDateMode==='veiculacao'?'VEICULAÇÃO':'PRAZO'}</small><span>${list.length}</span><em>${capture?`${capture} ${capture===1?'captação':'captações'}`:'sem captação'}</em></button>`;}).join(''); const queue=focused.length?focused.map(productionCommandRow).join(''):'<div class="production-empty">Nenhuma ordem de produção com esta referência. O dia permanece livre para preparação, captação ou edição pendente.</div>'; const readyRows=ready.sort((a,b)=>(productionCommandReference(a)||'9999-12-31').localeCompare(productionCommandReference(b)||'9999-12-31')).slice(0,8).map(productionCommandReadyRow).join('')||'<div class="production-empty">Nenhuma ordem já liberada para captação ou edição nesta janela.</div>'; root.innerHTML=`<section class="production-command-head"><div><div class="production-command-kicker">Vybe OS · Ordem operacional de produção</div><h2>Produção</h2><p>Uma agenda única para transformar briefing em captação, fotografia, edição e entrega. Datas, status e responsáveis são lidos do domínio operacional do Vybe OS.</p></div><div class="production-command-meta"><span><b>${all.length}</b><small>ordens ativas</small></span><span><b>${ready.length}</b><small>liberadas</small></span><span><b>${blocked.length}</b><small>bloqueios</small></span></div></section><section class="production-command-controls"><div class="production-control-group"><span class="production-control-label">Referência</span><button type="button" class="production-control-btn ${productionCommandDateMode==='prazo'?'active':''}" onclick="productionCommandSetDateMode('prazo')">Prazo</button><button type="button" class="production-control-btn ${productionCommandDateMode==='veiculacao'?'active':''}" onclick="productionCommandSetDateMode('veiculacao')">Veiculação</button></div><div class="production-control-note">${executing.length} em execução · clique em uma ordem para abrir roteiro, contexto e checklist.</div></section><section class="production-agenda"><div class="production-agenda-head"><b>Agenda de produção · Próximos 7 dias</b><small>Dia selecionado: ${safeText(productionCommandIsoLabel(focus))}</small></div><div class="production-day-rail">${dateRail}</div></section><div class="production-command-grid"><section class="production-queue"><div class="production-section-head"><b>FILA OPERACIONAL · ${safeText(productionCommandIsoLabel(focus))}</b><small>${focused.length} ${focused.length===1?'ordem':'ordens'} · prioridade por bloqueio e prontidão</small></div><div class="production-queue-list">${queue}</div></section><aside class="production-ready-panel"><div class="production-section-head"><b>Liberadas para execução</b><small>${ready.length} na janela ativa</small></div><div class="production-ready-list">${readyRows}</div></aside></div>`; }
function closeProductionSheet(){ const overlay=document.getElementById('production-sheet-overlay'); if(!overlay)return; overlay.classList.remove('open');setTimeout(()=>overlay.remove(),180); }
function productionChecklistHtml(item,packet){ const readiness=productionCommandReadiness(item); const hasPacket=Boolean(packet?.text); const capture=['▶','◉'].includes(productionCommandKind(item).icon); const rows=[{ok:hasPacket,label:'Briefing, roteiro ou orientação',copy:hasPacket?'Há conteúdo operacional registrado no histórico carregado.':'Não localizado no histórico carregado; registre ou confirme no Workspace.'},{ok:['ready','scheduled','executing','approval'].includes(readiness.key),label:'Base liberada para execução',copy:readiness.copy},{ok:Boolean(productionCommandReference(item)),label:productionCommandDateMode==='prazo'?'Prazo definido':'Veiculação definida',copy:productionCommandReference(item)?productionCommandDateLabel(item):'Sem referência de data — corrija diretamente no Vybe OS.'},{ok:!capture||['scheduled','executing','approval'].includes(readiness.key),label:capture?'Captação ou fotografia confirmada':'Captação não obrigatória para este formato',copy:capture?'Confirme local, horário, equipe e material na ficha operacional.':'Esta ordem pode seguir diretamente para a etapa criativa/edição.'}]; return `<div class="production-checklist">${rows.map(row=>`<div class="production-check" style="--production-check:${row.ok?'#62f5df':'#ffbf62'}"><i>${row.ok?'✓':'○'}</i><span><b>${safeText(row.label)}</b><small>${safeText(row.copy)}</small></span></div>`).join('')}</div>`; }
async function openProductionSheet(itemId){ const item=(DADOS_ALL?.find(entry=>String(entry.id)===String(itemId))||DADOS?.find(entry=>String(entry.id)===String(itemId))); if(!item) return showToast('Não foi possível localizar a ordem de produção.','err'); closeProductionSheet(); const overlay=document.createElement('div');overlay.id='production-sheet-overlay';overlay.className='production-sheet-overlay';overlay.onclick=event=>{if(event.target===overlay)closeProductionSheet();};overlay.innerHTML='<section class="production-sheet"><div class="production-sheet-loading">Carregando ficha operacional...</div></section>';document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('open')); const readiness=productionCommandReadiness(item); try{const detail=await fetchWorkspaceItem(item.id).catch(()=>null);const packet=productionCommandUpdateText(detail,item);const kind=productionCommandKind(item);const reference=productionCommandReference(item);const brief=packet.text||'Nenhum briefing, roteiro ou instrução de captação foi localizado no histórico carregado. Abra o Workspace para confirmar ou registrar a orientação operacional antes da execução.';overlay.innerHTML=`<section class="production-sheet" role="dialog" aria-modal="true" aria-label="Ficha de produção"><div class="production-sheet-head"><div><span>FICHA DE PRODUÇÃO · ${safeText(kind.label)}</span><b>${safeText(item.nome)}</b><small>${safeText(item.cliente||'Sem cliente')} · ${safeText(productionCommandOwner(item))}</small></div><button type="button" class="production-sheet-close" onclick="closeProductionSheet()" aria-label="Fechar ficha">×</button></div><div class="production-sheet-status">${daTacticalFormatTag(item)}${daTacticalStatusTag(item,true)}<span class="production-control-note">${safeText(readiness.label)} · atualizado ${safeText(packet.updated?new Date(packet.updated).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'sem horário disponível')}</span></div><div class="production-sheet-grid"><div class="production-sheet-main"><span class="production-sheet-label">ROTEIRO, BRIEFING E ORIENTAÇÃO DISPONÍVEL</span><div class="production-sheet-brief">${safeText(brief)}</div><div class="production-sheet-warning">A ficha só mostra informação disponível no domínio próprio e no histórico carregado. Campos ausentes permanecem visíveis como pendência para evitar execução por suposição.</div><div style="margin-top:16px"><span class="production-sheet-label">Checklist de prontidão</span>${productionChecklistHtml(item,packet)}</div></div><aside class="production-sheet-side"><span class="production-sheet-label">Ordem operacional</span><div class="production-sheet-facts"><div class="production-fact"><b>Referência de execução</b><small>${safeText(productionCommandDateMode==='prazo'?'Prazo':'Veiculação')} · ${safeText(reference?productionCommandDateLabel(item):'Sem data definida')}</small></div><div class="production-fact"><b>Responsáveis</b><small>${safeText(productionCommandOwner(item))}</small></div><div class="production-fact"><b>Etapa atual</b><small>${safeText(item.status||'Sem status')} · ${safeText(readiness.copy)}</small></div><div class="production-fact"><b>Formato</b><small>${safeText(item.formato||'Não informado')} · ${safeText(kind.label)}</small></div><div class="production-fact"><b>Fonte do contexto</b><small>${safeText(packet.source||'Domínio operacional')}.</small></div></div></aside></div><div class="production-sheet-actions"><button type="button" class="production-sheet-action" onclick="closeProductionSheet();openItemWorkspace('${item.id}')">Abrir workspace interno →</button><button type="button" class="production-sheet-action secondary" onclick="closeProductionSheet()">VOLTAR À AGENDA</button></div></section>`;}catch(error){overlay.innerHTML=`<section class="production-sheet"><div class="production-sheet-head"><div><span>Ficha de produção</span><b>${safeText(item.nome)}</b></div><button type="button" class="production-sheet-close" onclick="closeProductionSheet()">×</button></div><div class="production-empty">Não foi possível montar a ficha detalhada agora. ${safeText(error.message||'Tente novamente.')}</div></section>`;} }

function setupIdentityInteractions() {
  const shell = document.querySelector('.identity-shell');
  if (!shell || shell.dataset.fxReady === '1') return;
  shell.dataset.fxReady = '1';
  shell.querySelectorAll('.identity-station').forEach(station => {
    station.addEventListener('pointerenter', () => {
      shell.dataset.station = station.dataset.station || '';
      station.classList.add('station-hovered');
    });
    station.addEventListener('pointerleave', () => {
      delete shell.dataset.station;
      station.classList.remove('station-hovered');
      station.style.transform = '';
    });
    station.addEventListener('pointermove', event => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const rect = station.getBoundingClientRect();
      const rx = ((event.clientY - rect.top) / rect.height - .5) * -7;
      const ry = ((event.clientX - rect.left) / rect.width - .5) * 9;
      station.style.transform = `translateY(-5px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  });
}

function openModeGate() {
  // O portão perguntava "qual estação você vai operar?" sem dizer quem estava
  // perguntando. Quem acabou de fazer login precisa ver em qual conta está.
  const eu = pessoaLogada();
  const rodape = document.getElementById('identity-quem');
  if (rodape && eu) {
    rodape.textContent = `${eu.nome}${eu.admin ? ' · administra o painel' : ''}`;
    // O crachá do cabeçalho existe, mas o portão cobre o cabeçalho inteiro — daqui
    // não havia como sair nem chegar na própria conta.
    const cx = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    cx('identity-conta-nome', eu.nome || '');
    cx('identity-conta-email', eu.email || '');
    cx('identity-conta-papel', eu.admin ? 'Administra o painel' : 'Acesso da equipe');
  }
  renderIdentityOperationalPulse();
  renderFocusUserPicker();
  setupIdentityInteractions();
  document.getElementById('focus-picker')?.classList.remove('open');
  document.getElementById('mode-gate')?.classList.add('open');
  identityDecodeTitle();
}
function closeModeGate() {
  document.getElementById('focus-picker')?.classList.remove('open');
  document.getElementById('mode-gate')?.classList.remove('focus-selecting');
  document.getElementById('mode-gate')?.classList.remove('open');
}
function openFocusPicker() {
  renderIdentityOperationalPulse();
  renderFocusUserPicker();
  document.getElementById('mode-gate')?.classList.add('focus-selecting');
  document.getElementById('focus-picker')?.classList.add('open');
}
function closeFocusPicker() {
  document.getElementById('focus-picker')?.classList.remove('open');
  document.getElementById('mode-gate')?.classList.remove('focus-selecting');
}
function closeTransientOverlaysForNavigation() {
  try { if (typeof closeDaApprovalRadar === 'function') closeDaApprovalRadar(); } catch {}
  try { if (typeof closeItemWorkspace === 'function') closeItemWorkspace(); } catch {}
  try { if (typeof closeWorkflowModal === 'function') closeWorkflowModal(); } catch {}
  try { if (typeof closeCadastrosGoverned === 'function') closeCadastrosGoverned(); } catch {}
  try { if (typeof closeProductionSheet === 'function') closeProductionSheet(); } catch {}
  ['da-approval-radar-overlay','workspace-backdrop','workspace-drawer','workflow-backdrop','workflow-modal','cadastros-preview-overlay','production-sheet-overlay']
    .forEach((id) => document.getElementById(id)?.remove());
}
function activateOperationalBoard() { const btn=document.getElementById('btn-board-producao'); if(btn && activeBoard!=='producao') switchBoard('producao',btn); }
// Clicar no logo e voltar para casa — a convencao de todo site, e ela nao valia
// aqui.
//
// "Casa" e a tela "Qual estacao voce vai operar?", que e onde as estacoes estao
// TODAS a vista. Na primeira versao isto caia direto no Modo Gestor, que e uma
// das estacoes e nao a escolha entre elas: quem clicava pedindo o menu ganhava
// um destino. Fechar o portao continua sendo a saida de quem so passou o olho.
function voltarAoMenu() {
  if (typeof closeTransientOverlaysForNavigation === 'function') closeTransientOverlaysForNavigation();
  if (typeof openModeGate === 'function') openModeGate();
}
function chooseManagerMode() { closeTransientOverlaysForNavigation(); panelMode='gestor'; focusUserId=''; currentPersonFilter='all'; selectedPersonIds.clear(); setStorage('vybePanelMode','gestor'); setStorage('vybePanelFocusUser',''); closeModeGate(); activateOperationalBoard(); applyPanelMode(); }
function chooseFocusUser(userId) { closeTransientOverlaysForNavigation(); panelMode='foco'; focusUserId=userId; selectedPersonIds.clear(); setStorage('vybePanelMode','foco'); setStorage('vybePanelFocusUser',userId); closeModeGate(); activateOperationalBoard(); applyPanelMode(); }
function chooseDaControllerMode() { closeTransientOverlaysForNavigation(); panelMode='controler'; focusUserId=''; currentPersonFilter='all'; selectedPersonIds.clear(); daControllerPersonId='all'; setStorage('vybePanelMode','controler'); setStorage('vybePanelFocusUser',''); closeModeGate(); activateOperationalBoard(); applyPanelMode(); }
function chooseProductionMode() { closeTransientOverlaysForNavigation(); panelMode='producao'; focusUserId=''; currentPersonFilter='all'; selectedPersonIds.clear(); setStorage('vybePanelMode','producao'); setStorage('vybePanelFocusUser',''); closeModeGate(); activateOperationalBoard(); applyPanelMode(); }
function chooseClientMode() { closeTransientOverlaysForNavigation(); panelMode='clientes'; focusUserId=''; currentPersonFilter='all'; selectedPersonIds.clear(); setStorage('vybePanelMode','clientes'); setStorage('vybePanelFocusUser',''); closeModeGate(); const btn=document.getElementById('btn-board-clientes'); if(btn) switchBoard('clientes',btn); applyPanelMode(); }

function applyPanelMode() {
  const isFocus = panelMode === 'foco' && !!focusUser();
  const isDaController = panelMode === 'controler';
  const isProductionCommand = panelMode === 'producao';
  const isClientMode = panelMode === 'clientes';
  const isDedicatedMode = isFocus || isDaController || isProductionCommand || isClientMode;
  const user = focusUser();
  document.querySelector('.board-switch-bar')?.classList.toggle('focus-hidden', isDedicatedMode);
  // A volta so aparece quando a fileira de modulos NAO esta na tela. Com ela a
  // vista, um botao "todos os modulos" ao lado da propria lista de modulos seria
  // dizer duas vezes a mesma coisa.
  document.getElementById('btn-voltar-menu')?.classList.toggle('focus-hidden', !isDedicatedMode);
  document.getElementById('compact-summary')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.querySelector('.ops-command-bar')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('search-results')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('ops-action-panel')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('manager-intelligence')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('manager-calendar')?.classList.toggle('focus-hidden', isDedicatedMode || panelMode !== 'gestor');
  // o botão que abre a agenda segue a agenda: fora do Gestor não há o que abrir
  document.getElementById('ops-agenda-btn')?.classList.toggle('focus-hidden', isDedicatedMode || panelMode !== 'gestor');
  document.getElementById('sidebar')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('sidebar-toggle')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('sidebar-overlay')?.classList.remove('show');
  document.getElementById('week-tabs-container')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.getElementById('btn-view-day')?.classList.toggle('focus-hidden', isDedicatedMode);
  document.querySelectorAll('.week-panel').forEach(panel => panel.classList.toggle('focus-hidden', isDedicatedMode));
  document.getElementById('focus-dashboard')?.classList.toggle('active', isFocus);
  document.getElementById('da-controller-dashboard')?.classList.toggle('active', isDaController);
  document.getElementById('production-command-dashboard')?.classList.toggle('active', isProductionCommand);
  document.getElementById('focus-mode-banner')?.classList.toggle('active', isFocus);
  document.getElementById('da-controller-banner')?.classList.toggle('active', isDaController);
  document.getElementById('production-command-banner')?.classList.toggle('active', isProductionCommand);
  const modeButton = document.getElementById('mode-switch-btn');
  if (modeButton) modeButton.textContent = isFocus ? '◎ Modo Foco' : isDaController ? '◈ DA Controler' : isProductionCommand ? '◫ Produção' : isClientMode ? '◉ Clientes' : '⌘ Modo Gestor';
  const subtitle = document.getElementById('header-sub');
  if (subtitle) subtitle.textContent = isFocus ? `Meu Dia · ${firstName(user.name)} · fila individual de prioridades` : isDaController ? 'DA Controler · produtividade da célula criativa' : isProductionCommand ? 'Produção · ordem operacional de captação, fotografia e edição' : isClientMode ? 'Clientes · cadastro mestre, heads, acessos e operação' : 'Controle semanal de conteúdo por cliente e equipe';
  const personEl = document.getElementById('focus-person');
  if (personEl && isFocus) {
    const avatar = user.photo ? `<img src="${user.photo}" alt="${safeText(user.name)}" onerror="this.outerHTML='<span class=focus-person-fallback>${firstName(user.name).slice(0,2).toUpperCase()}</span>'">` : `<span class="focus-person-fallback">${firstName(user.name).slice(0,2).toUpperCase()}</span>`;
    personEl.innerHTML = `${avatar}<div><div class="focus-mode-label">Modo foco</div><div class="focus-mode-name">${safeText(firstName(user.name))} · Meu Dia</div></div>`;
  }
  if (isFocus) { selectedPersonIds.clear(); currentPersonFilter = user.id; viewMode = 'day'; }
  else if (isDaController || isClientMode) { selectedPersonIds.clear(); currentPersonFilter = 'all'; }
  if (DADOS.length) {
    if (isFocus) {
      viewMode = 'day';
      const viewBtn = document.getElementById('btn-view-day');
      if (viewBtn) { viewBtn.textContent = '👤 Ver por Cliente'; viewBtn.classList.add('active'); }
    } else if (currentPersonFilter === focusUserId) {
      currentPersonFilter = 'all';
    }
    const weeksCount = META.weeks ? META.weeks.length : 4;
    for (let s=1;s<=weeksCount;s++) renderWeek(s,currentFilter,currentDayFilter);
    if (isFocus) renderFocusDashboard();
    else if (isDaController) renderDaController();
    else if (isProductionCommand) renderProductionCommand();
    else if (isClientMode) renderClientesBoard();
    else renderManagerIntelligence();
  }
  if (panelMode === 'gestor' || isFocus || isDaController || isClientMode) void ensureDemandasForOperationalViews();
}

// Quem entrou. O painel foi construído antes do login existir, então ele
// perguntava quem você era; agora ele já sabe.
function pessoaLogada() {
  return (typeof sessaoAtual === 'function' && sessaoAtual()) || null;
}
function souAdmin() { return Boolean(pessoaLogada()?.admin); }

// A pessoa logada, quando ela é alguém que executa trabalho. Quem administra não
// entra nessa lista e continua escolhendo o foco.
function meuFoco() {
  const eu = pessoaLogada();
  const id = eu ? String(eu.id) : '';
  return id && FOCUS_ACTIVE_IDS.has(id) && TEAM_USERS.some((u) => u.id === id) ? id : '';
}

function initPanelMode() {
  const savedMode = getStorage('vybePanelMode');
  const savedUser = getStorage('vybePanelFocusUser');


  if (savedMode === 'foco' && TEAM_USERS.some(u => u.id === savedUser) && FOCUS_ACTIVE_IDS.has(savedUser)) {
    panelMode='foco'; focusUserId=savedUser; applyPanelMode();
  } else if (savedMode === 'controler') {
    panelMode='controler'; focusUserId=''; applyPanelMode();
  } else if (savedMode === 'producao') {
    panelMode='producao'; focusUserId=''; applyPanelMode();
  } else if (savedMode === 'clientes') {
    panelMode='clientes'; focusUserId=''; const btn=document.getElementById('btn-board-clientes'); if(btn) switchBoard('clientes',btn); applyPanelMode();
  } else if (savedMode === 'gestor') {
    panelMode='gestor'; applyPanelMode();
  } else {
    panelMode='gestor'; openModeGate();
  }
}

let currentPersonFilter = 'all';
let selectedPersonIds = new Set();
let sortCritico = false;

function itemMatchesSelectedPeople(d) {
  if (!selectedPersonIds.size) return true;
  const ids = [...(d.responsavel_ids || []), d.responsavel_id].filter(Boolean).map(String);
  return ids.some(id => selectedPersonIds.has(id));
}

function syncPersonFilterVisual() {
  const allActive=!selectedPersonIds.size;
  const allWrap=document.getElementById('person-all');
  const allChip=allWrap?.querySelector('.person-chip');
  if (allChip) { allChip.classList.toggle('active',allActive); allChip.setAttribute('aria-pressed',String(allActive)); }
  allWrap?.classList.toggle('filter-active',allActive);
  document.querySelectorAll('#person-filter-bar .person-wrap[data-person-id]').forEach(wrap => {
    const active=selectedPersonIds.has(String(wrap.dataset.personId));
    const chip=wrap.querySelector('.person-chip');
    chip?.classList.toggle('active',active);
    chip?.setAttribute('aria-pressed',String(active));
    wrap.classList.toggle('filter-active',active);
  });
}

function buildPersonFilter() {
  const bar = document.getElementById('person-filter-bar');
  // Descobrir quais pessoas aparecem nos dados
  const activePeople = new Set();
  DADOS.forEach(d => {
    if (d.responsavel_ids && d.responsavel_ids.length > 0) d.responsavel_ids.forEach(id => activePeople.add(id));
    else if (d.responsavel_id) activePeople.add(d.responsavel_id);
  });
  // Remover avatares antigos (exceto o "Todos")
  const existing = bar.querySelectorAll('.person-wrap:not(#person-all)');
  existing.forEach(e => e.remove());
  TEAM_USERS.forEach(u => {
    if (!activePeople.has(u.id)) return;
    const wrap = document.createElement('div');
    wrap.className = 'person-wrap';
    wrap.dataset.personId = u.id;
    wrap.style.setProperty('--person-color',u.color || '#00f0ff');
    wrap.title = u.name;
    wrap.onclick = () => filterByPerson(u.id, wrap);
    // Pessoa no painel e bolinha com foto — vale para o dono da peca, para o
    // head do cliente e, agora, tambem para o filtro de equipe. Nome por extenso
    // dentro de uma pastilha colorida era a unica excecao, e uma fileira delas
    // ocupava mais largura que a tabela inteira.
    const chip = document.createElement('span');
    chip.className = 'person-chip so-foto';
    chip.innerHTML = typeof ownerAvatarHtml === 'function'
      ? ownerAvatarHtml(u)
      : `<span class="owner-avatar-fallback" style="background:${u.color}">${
          String(u.name || '').slice(0, 2).toUpperCase()}</span>`;
    wrap.appendChild(chip);
    bar.appendChild(wrap);
  });
  syncPersonFilterVisual();
}

function filterByPerson(personId, wrap) {
  const id = String(personId);
  if (id === 'all') {
    selectedPersonIds.clear();
  } else if (selectedPersonIds.has(id)) {
    selectedPersonIds.delete(id);
  } else {
    selectedPersonIds.add(id);
  }
  // Compatibilidade com fluxos legados; a filtragem usa selectedPersonIds.
  currentPersonFilter = selectedPersonIds.size ? [...selectedPersonIds].join(',') : 'all';
  syncPersonFilterVisual();
  const weeksCount = META.weeks ? META.weeks.length : 4;
  for (let s = 1; s <= weeksCount; s++) renderWeek(s, currentFilter, currentDayFilter);
  renderOperationalTools();
  renderManagerIntelligence();
  updateClearFiltersState();
}

// ─── Ordenação por criticidade ────────────────────────────────────────────────
function toggleSortCritico(btn) {
  sortCritico = !sortCritico;
  btn.classList.toggle('active', sortCritico);
  for (let s = 1; s <= 4; s++) renderWeek(s, currentFilter, currentDayFilter);
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function filterByDay(sel) {
  currentDayFilter = sel.value || '';
  // Resetar filtros de texto ao filtrar por dia
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.filter-btn').classList.add('active');
  currentFilter = 'all';
  for (let s = 1; s <= 4; s++) renderWeek(s,'all',currentDayFilter);
  if(currentDayFilter) {
    // Encontrar qual semana contém esse dia
    let targetSem = 1;
    for (let s = 1; s <= 4; s++) {
      const dias = getDiasSemana(s);
      if (dateMode === 'prazo') {
        if (DADOS.some(d=>d.prazo_iso===currentDayFilter && d.semana===s)) { targetSem=s; break; }
      } else {
        if (dias.some(d=>d.iso===currentDayFilter)) { targetSem=s; break; }
      }
    }
    document.querySelectorAll('.week-panel').forEach(p=>p.classList.remove('active'));
    const tp = document.getElementById(`panel-week${targetSem}`);
    if(tp) tp.classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const tt = document.getElementById(`tab-s${targetSem}-label`);
    if(tt) tt.classList.add('active');
    currentWeek = targetSem;
  }
}

function showWeek(n, btn) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.week-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('filter-bar').style.display = n===0?'none':'flex';
  if(n===0) document.getElementById('panel-team').classList.add('active');
  else {
    const panel = document.getElementById(`panel-week${n}`);
    if(panel) panel.classList.add('active');
    currentWeek=n;
    showAllActionItems=false;
    renderWeek(n,currentFilter,currentDayFilter);
    renderOperationalTools();
  }
}

function filterClients(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#status-legend .pill').forEach(p=>p.classList.remove('active-legend'));
  currentFilter = type; currentDayFilter = '';
  document.getElementById('day-select').value = '';
  for (let s = 1; s <= 4; s++) renderWeek(s, type);
}

function filterByStatus(status, pill) {
  const key = 'status:'+status;
  if(currentFilter===key) {
    document.querySelectorAll('#status-legend .pill').forEach(p=>p.classList.remove('active-legend'));
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.filter-btn[onclick*="\'all\'"]').classList.add('active');
    currentFilter='all'; currentDayFilter='';
    document.getElementById('day-select').value='';
    renderWeek(currentWeek,'all'); return;
  }
  document.querySelectorAll('#status-legend .pill').forEach(p=>p.classList.remove('active-legend'));
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  pill.classList.add('active-legend');
  currentFilter=key; currentDayFilter='';
  document.getElementById('day-select').value='';
  for (let s = 1; s <= 4; s++) renderWeek(s,key);
  document.querySelectorAll('.week-content').forEach(w=>w.style.display='block');
}

