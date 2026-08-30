// vybe-foco.js — Modo Foco: a tela "Meu Dia" de cada pessoa.
//
// Este arquivo era vybe-jarvis.js e comecava com 357 linhas de assistente por
// voz e texto, que falavam com Claude, GPT e Gemini a cada comando. Saiu inteiro:
// gastava token por pergunta e ninguem operava por ele. O que ficou e o que a
// equipe usa todo dia — a fila de cada um, o proximo item, o fechamento de turno.

function focusOwnItems(user=focusUser()) { const source=unifiedOperationalItems(); return user ? source.filter(d => ((d.responsavel_ids || []).map(String).includes(String(user.id)) || String(d.responsavel_id || '') === String(user.id)) && !isFinishedItem(d)) : []; }
function focusIsNextReady(d) { return ['Pode Fazer','A Fazer'].includes(operationalFlowStatus(d)); }
function focusActionPriority(d,user=focusUser()) {
  const risk=d.operational_risk || getOperationalRisk(d); const due=focusReferenceDate(d,user) || '9999-12-31';
  const state={'Pode Fazer':0,'A Fazer':1}[operationalFlowStatus(d)] ?? 8;
  return Number(risk.score ?? 99) * 100 + state * 10 + Number(due.replace(/-/g,''));
}
function getFocusNextAction(items=focusOwnItems(),user=focusUser()) {
  const nextReady=items.filter(focusIsNextReady).sort((a,b)=>focusActionPriority(a,user)-focusActionPriority(b,user));
  if (nextReady.length) return { item:nextReady[0], mode:'next' };
  const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(operationalFlowStatus(d))).sort((a,b)=>focusActionPriority(a,user)-focusActionPriority(b,user));
  return blocked[0] ? { item:blocked[0], mode:'unblock' } : null;
}
function focusWorkflowProfile(item,user=focusUser()) {
  const name=String(user?.name || '').toLowerCase();
  if (name.includes('reriston')) return { labels:['Briefing','Edição','Entrega','Aprovação','Publicação'], execution:1, approval:3, publication:4, briefing:0 };
  if (['deivid','beatriz','bia','jady'].some(person=>name.includes(person))) return { labels:['Briefing','Criação','Aprovação interna','Entrega','Publicação'], execution:1, approval:2, publication:4, briefing:0 };
  if (name.includes('tainara')) return { labels:['Recebimento','Conferência','Agendamento','Publicação'], execution:1, approval:1, publication:2, briefing:0 };
  return { labels:['Briefing','Produção','Revisão','Entrega','Aprovação','Publicação'], execution:1, approval:4, publication:5, briefing:0 };
}
function focusTrailIndex(item, profile=focusWorkflowProfile(item)) {
  const key=String(operationalFlowStatus(item) || '').toLowerCase();
  if (key === 'finalizado') return profile.labels.length - 1;
  if (['para agendar','agendado'].includes(key)) return profile.publication;
  if (['para aprovação','ag. aprovação cliente','ag. interno'].includes(key)) return profile.approval;
  if (['em andamento','alteração'].includes(key)) return profile.execution;
  return profile.briefing;
}
function focusTrailHtml(item) {
  const profile=focusWorkflowProfile(item); const active=focusTrailIndex(item,profile); const current=profile.labels[active];
  return `<div class="focus-production-trail" aria-label="Trilha operacional · ${safeText(item.status)}"><span class="focus-trail-current">ETAPA: ${safeText(current).toUpperCase()} · ${safeText(item.status).toUpperCase()}</span><div class="focus-trail-steps">${profile.labels.map((label,index)=>`<span class="focus-trail-step ${index<active?'done':index===active?'active':''}">${safeText(label)}</span>${index<profile.labels.length-1?'<span class="focus-trail-arrow">›</span>':''}`).join('')}</div></div>`;
}
function focusNextActionHtml(data) {
  if(!data) return `<div class="focus-next-action"><div class="focus-next-kicker">Próxima melhor ação</div><div class="focus-next-name">Sua fila está limpa por agora.</div><div class="focus-next-reason">Não há itens de produção ou bloqueios atribuídos a você neste momento.</div></div>`;
  const {item,mode}=data; const risk=item.operational_risk || getOperationalRisk(item); const user=focusUser(); const date=focusReferenceLabel(item,user);
  const title=mode==='next' ? 'PRÓXIMA DEMANDA' : 'DESTRAVE ESTA DEMANDA';
  const reason=mode==='next' ? `${risk.reason || 'Esta é a próxima atividade ainda não iniciada com maior prioridade'} · ${date}` : `${focusStatusExplanation(operationalFlowStatus(item)) || 'Esta atividade depende de uma ação para avançar'} · ${risk.reason || date}`;
  const primary=mode==='next' ? 'Abrir e produzir' : 'VER BLOQUEIO';
  const primaryAction=mode==='next' ? `openFocusPriorityWorkspace('${item.id}')` : `openItemWorkspace('${item.id}')`;
  const statusControl=mode==='next' ? `<button type="button" class="focus-next-btn status" style="border-color:${item.status_color||'#00f0ff'} !important; background:color-mix(in srgb, ${item.status_color||'#00f0ff'} 12%, transparent) !important; color:${item.status_color||'#a6f8ff'} !important;" onclick="openStatusEditor(event,'${item.id}')">STATUS: ${safeText(item.status).toUpperCase()} ▼</button>` : '';
  const checkinControl=mode==='next' ? `<button type="button" class="focus-next-btn checkin" onclick="openFocusPriorityCheckin('${item.id}')">Iniciar bloco</button>` : '';
  const secondary=mode==='next' ? `<button type="button" class="focus-next-btn" onclick="openFocusBlocker('${item.id}')">Sinalizar bloqueio</button>` : `<button type="button" class="focus-next-btn" onclick="openFocusBlocker('${item.id}')">Registrar contexto</button>`;
  const controlNote=mode==='next' ? `<div class="focus-priority-control-note"><i></i>PRÓXIMA A INICIAR · ao mudar para Em andamento, esta demanda entra na fila de execução</div>` : '';
  return `<section class="focus-next-action"><div class="focus-next-kicker">${title} · PRIORIDADE CALCULADA</div><div class="focus-next-main"><div><div class="focus-next-client">${safeText(item.cliente || 'Cliente não informado')}</div><div class="focus-next-name">${safeText(item.nome)}</div><div class="focus-next-reason">${safeText(reason)}</div>${focusTrailHtml(item)}${controlNote}</div><div class="focus-next-tools"><button type="button" class="focus-next-btn primary" onclick="${primaryAction}">${primary} →</button>${statusControl}${checkinControl}${secondary}</div></div></section>`;
}
function openFocusBlocker(itemId) {
  const item=findOperationalItem(itemId); if(!item) return showToast('Demanda não encontrada.','err');
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Bloqueio inteligente</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">O que está impedindo o avanço?</h2><p class="workflow-copy">Este registro cria contexto, muda a demanda para a etapa adequada e avisa a Mesa de Comando sobre o bloqueio.</p>${workflowItemHtml(item,'sinalizar bloqueio')}<label class="workflow-field"><span>Tipo de bloqueio</span><select id="focus-blocker-type"><option value="info">Informação ou material pendente</option><option value="feedback">Feedback, aprovação ou decisão pendente</option><option value="direction">Direção de arte ou referência visual</option><option value="dependency">Outra etapa ou área ainda precisa agir</option></select></label><label class="workflow-field"><span>O que está faltando ou precisa ser resolvido?</span><textarea id="focus-blocker-reason" rows="3" placeholder="Ex.: Cliente ainda não enviou as fotos do produto solicitadas no briefing."></textarea></label><label class="workflow-field"><span>De quem depende?</span><input id="focus-blocker-owner" type="text" placeholder="Ex.: Cliente, Paulo, Direção de Arte..."/></label><label class="workflow-field"><span>Qual é o próximo passo?</span><textarea id="focus-blocker-next" rows="3" placeholder="Ex.: Atendimento cobra as fotos; assim que chegarem, retomo a arte."></textarea></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitFocusBlocker('${item.id}')">Registrar bloqueio →</button></div>`);
}
async function submitFocusBlocker(itemId) {
  const item=findOperationalItem(itemId); const type=String(document.getElementById('focus-blocker-type')?.value||''); const reason=String(document.getElementById('focus-blocker-reason')?.value||'').trim(); const owner=String(document.getElementById('focus-blocker-owner')?.value||'').trim(); const next=String(document.getElementById('focus-blocker-next')?.value||'').trim();
  if(!item || !reason || !owner || !next) return showToast('Descreva o bloqueio, de quem depende e o próximo passo.','info');
  const targets=isRequestItem(item)?{info:'Aguardando Info.',feedback:'Aguardando Aprovação',direction:'Aguardando Aprovação',dependency:'Aguardando Info.'}:{info:'Falta Info',feedback:'Aguardo',direction:'Falta D.A',dependency:'Aguardo'}; const option=operationalStatusOptions(item).find(o=>o.label===targets[type]) || STATUS_OPTIONS.find(o=>o.label===targets[type]); if(!option) return showToast('O status necessário ainda não carregou.','info');
  const button=document.querySelector('#workflow-modal .workflow-primary'); if(button) button.disabled=true;
  try { const body=`[Vybe OS · Contexto de status]\nEtapa: ${item.status} → ${option.label}\nMotivo: ${reason}\nSolicitante/Dependência: ${owner}\nOrigem: Modo Foco · Bloqueio inteligente\nPróximo passo: ${next}`; await postItemUpdate(item.id,body); [DADOS,DADOS_ALL,DADOS_DEMANDAS].forEach(list=>(list||[]).forEach(d=>{if(String(d.id)===String(item.id)) d.status_context={target:option.label,reason,next,requester:owner,source:'Modo Foco · Bloqueio inteligente',created_at:new Date().toISOString()};})); closeWorkflowModal(); await commitStatusChange(item,option); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o bloqueio: ${e.message}`,'err',7000); }
}
function openFocusPriorityWorkspace(itemId) { openItemWorkspace(itemId); }
function openFocusPriorityCheckin(itemId) { openItemWorkspace(itemId); setTimeout(()=>{ document.querySelector('.workspace-checkin')?.scrollIntoView({behavior:'smooth',block:'center'}); },340); }
function openFocusDelivery(itemId) { openItemWorkspace(itemId); setTimeout(()=>{ document.getElementById('workspace-link-input')?.scrollIntoView({behavior:'smooth',block:'center'}); },320); }
function focusContinuityHtml(items,user) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const next=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>today && !['Agendado','Finalizado'].includes(d.status);}),user).slice(0,3); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)).length;
  const nextText=next.length ? next.map(d=>`${d.nome} (${focusReferenceLabel(d,user)})`).join(' · ') : 'Nenhuma prioridade futura com prazo informado';
  return `<section class="focus-continuity"><div class="focus-continuity-head"><span>⌁ CONTINUIDADE DE TURNO</span><span>${blocked ? `${blocked} bloqueio${blocked===1?'':'s'} para acompanhar` : 'fila sem bloqueios ativos'}</span></div><div class="focus-continuity-body">Sua próxima linha de continuidade: <b>${safeText(nextText)}</b><div class="focus-continuity-actions"><button type="button" class="focus-command-btn" onclick="copyFocusContinuity()">Copiar resumo</button></div></div></section>`;
}
async function copyFocusContinuity() { const user=focusUser(); const items=focusOwnItems(user); const action=getFocusNextAction(items,user); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)); const text=`[Vybe OS · Continuidade] ${user?.name || 'Operador'}\nPróxima prioridade: ${action?.item ? `${action.item.nome} · ${action.item.cliente}` : 'Sem item prioritário aberto'}\nBloqueios ativos: ${blocked.length}${blocked.length ? ` · ${blocked.slice(0,3).map(d=>d.nome).join(' | ')}` : ''}\nGerado em: ${new Date().toLocaleString('pt-BR')}`; try { await navigator.clipboard.writeText(text); showToast('✓ Resumo de continuidade copiado','ok'); } catch(e) { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); showToast('✓ Resumo de continuidade copiado','ok'); } }

function focusDailyPlanHtml(items,user,nextAction) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const inProgress=focusSort(items.filter(d=>d.status==='Em andamento'),user);
  const blocked=focusSort(items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)),user);
  const dueByFriday=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>=today && due<=getFridayIso(today) && !isFinishedItem(d);}),user);
  const next=nextAction?.item;
  const row=(label,item,empty)=>item ? `<div class="focus-daily-plan-row"><span>${safeText(label)}</span><button type="button" onclick="openItemWorkspace('${item.id}')">${safeText(item.nome)}</button><small>${safeText(item.status)} · ${safeText(focusReferenceLabel(item,user))}</small></div>` : `<div class="focus-daily-plan-row muted"><span>${safeText(label)}</span><em>${safeText(empty)}</em></div>`;
  return `<section class="focus-daily-plan"><div class="focus-daily-plan-head"><div><span>Plano do dia</span><small>uma leitura rápida para executar sem perder a próxima decisão</small></div></div><div class="focus-daily-plan-grid">${row('AGORA',inProgress[0] || next,'sem execução registrada')}${row('PRÓXIMA',next && String(next.id)!==String(inProgress[0]?.id||'') ? next : dueByFriday.find(d=>String(d.id)!==String(inProgress[0]?.id||'')),'sem prioridade pronta')}${row('DESTRAVAR',blocked[0], 'sem bloqueio ativo')}${row('ATÉ SEXTA',dueByFriday.filter(d=>String(d.id)!==String(inProgress[0]?.id||'') && String(d.id)!==String(next?.id||''))[0], 'sem outro prazo nesta semana')}</div></section>`;
}
function getFridayIso(base) { const d=new Date(`${base}T12:00:00`); const weekday=d.getDay(); d.setDate(d.getDate()+((5-weekday+7)%7)); return d.toISOString().slice(0,10); }
function focusShiftSummary(user=focusUser()) {
  const items=focusOwnItems(user); const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const executed=items.filter(d=>d.status==='Em andamento');
  const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status));
  const tomorrow=focusSort(items.filter(d=>focusReferenceDate(d,user)>today),user).slice(0,3);
  return {items,executed,blocked,tomorrow};
}
function openFocusShiftClose() {
  const user=focusUser(); if(!user) return;
  const data=focusShiftSummary(user);
  const active=data.executed[0] || getFocusNextAction(data.items,user)?.item || data.items[0];
  const tomorrow=data.tomorrow.map(d=>d.nome).join(' · ') || 'Nenhuma prioridade futura com data registrada';
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Encerramento de turno</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Fechar o dia de ${safeText(firstName(user.name))}</h2><p class="workflow-copy">Registre somente o contexto que precisa atravessar para amanhã. O resumo é calculado pela fila real e pode ser salvo no item que ficou em execução.</p><div class="focus-shift-summary"><span><b>${data.executed.length}</b> em execução</span><span><b>${data.blocked.length}</b> bloqueio${data.blocked.length===1?'':'s'}</span><span><b>${data.items.length}</b> aberto${data.items.length===1?'':'s'}</span></div><label class="workflow-field"><span>O que avançou hoje?</span><textarea id="focus-shift-progress" rows="3" placeholder="Ex.: Estruturei a primeira versão e deixei a capa pronta para revisão."></textarea></label><label class="workflow-field"><span>O que precisa continuar amanhã?</span><textarea id="focus-shift-next" rows="3" placeholder="Próximas prioridades: ${safeText(tomorrow)}"></textarea></label><label class="workflow-field"><span>Registrar no item em execução</span><select id="focus-shift-item">${data.items.map(d=>`<option value="${d.id}" ${String(d.id)===String(active?.id)?'selected':''}>${safeText(d.nome)} · ${safeText(d.status)}</option>`).join('')}</select></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="copyFocusShiftClose()">Copiar resumo</button><button type="button" class="workflow-primary" onclick="submitFocusShiftClose()">Registrar no Monday →</button></div>`);
}
function focusShiftText() { const user=focusUser(); const data=focusShiftSummary(user); const progress=String(document.getElementById('focus-shift-progress')?.value||'').trim(); const next=String(document.getElementById('focus-shift-next')?.value||'').trim(); return `[Vybe OS · Encerramento de turno]\nOperador: ${user?.name || 'Não identificado'}\nEm execução: ${data.executed.map(d=>d.nome).join(' | ') || 'Nenhuma'}\nBloqueios: ${data.blocked.map(d=>d.nome).join(' | ') || 'Nenhum'}\nAvanço: ${progress || 'Não informado'}\nAmanhã: ${next || 'Não informado'}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`; }
async function copyFocusShiftClose() { const text=focusShiftText(); try { await navigator.clipboard.writeText(text); showToast('✓ Encerramento copiado','ok'); } catch(e) { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); showToast('✓ Encerramento copiado','ok'); } }
async function submitFocusShiftClose() { const itemId=String(document.getElementById('focus-shift-item')?.value||''); if(!itemId) return showToast('Escolha o item que continuará no próximo turno.','info'); const button=document.querySelector('#workflow-modal .workflow-primary'); if(button) button.disabled=true; try { await postItemUpdate(itemId,focusShiftText()); closeWorkflowModal(); showToast('✓ Encerramento registrado no Monday','ok'); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o encerramento: ${e.message}`,'err',7000); } }

function renderFocusDashboard() {
  const dash = document.getElementById('focus-dashboard');
  const user = focusUser();
  if (!dash || !user) return;
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const referenceLabel = focusUsesVeiculacao(user) ? 'veiculação' : 'prazo';
  const mine = focusOwnItems(user);
  const inProgress = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Em andamento'), user);
  const toProduceToday = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Pode Fazer' && focusReferenceDate(d,user) && focusReferenceDate(d,user) <= today), user);
  const toStart = focusSort(mine.filter(d => operationalFlowStatus(d) === 'A Fazer'), user);
  const awaitingApproval = focusSort(mine.filter(d => ['Para aprovação','Ag. Aprovação Cliente','Ag. Interno'].includes(operationalFlowStatus(d))), user);
  const inRevision = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Alteração'), user);
  const awaitingInfo = focusSort(mine.filter(d => ['Falta Info','Ag. Info Cliente','Aguardo'].includes(operationalFlowStatus(d))), user);
  const blocked = focusSort(mine.filter(d => ['Falta D.A','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(operationalFlowStatus(d))), user);
  const classified = new Set([...inProgress,...toProduceToday,...toStart,...awaitingApproval,...inRevision,...awaitingInfo,...blocked].map(d => String(d.id)));
  const nextDeadlines = focusSort(mine.filter(d => !classified.has(String(d.id)) && focusReferenceDate(d,user) > today), user);
  const late = mine.filter(d => { const due=focusReferenceDate(d,user); return due && due < today; }).length;
  const todayCount = mine.filter(d => focusReferenceDate(d,user) === today).length;
  const ready = mine.filter(d => ['Para agendar','Agendado'].includes(operationalFlowStatus(d))).length;
  const renderGroup = (label, subtitle, items, contextText, tone, icon='') => {
    if (!items.length) return '';
    const displayed = focusShowAll ? items : items.slice(0,5);
    const more = items.length > 5 ? `<button class="search-result-action" onclick="toggleFocusShowAll()">${focusShowAll?'Mostrar menos':`Ver mais (${items.length-5})`}</button>` : '';
    return `<section class="focus-section" style="--focus-group-color:${tone}"><div class="focus-section-head"><span>${icon ? `${icon} ` : ''}${label} <b>${items.length}</b></span><span><small>${subtitle}</small> ${more}</span></div><div class="focus-list">${(() => {
        const origens = new Set(displayed.map(d => String(operationalOriginTag(d) || '')));
        const donos = new Set(displayed.map(d => (d.responsavel_ids || [d.responsavel_id]).join(',')));
        return displayed.map((d, n) => focusTaskHtml(d, contextText, {
          primeira: n === 0, origemVaria: origens.size > 1, donoVaria: donos.size > 1,
        })).join('');
      })()}</div></section>`;
  };
  const nextAction=getFocusNextAction(mine,user);
  const primaryId=String(nextAction?.item?.id || '');
  const withoutPrimary=(items=[])=>primaryId ? items.filter(d=>String(d.id)!==primaryId) : items;
  const groups = [
    renderGroup('Em execução hoje','todas as demandas já iniciadas; acompanhe e atualize sem misturar com a próxima a começar',inProgress,'Em execução por você','#ff6b00','◉'),
    renderGroup('Para produzir hoje',`itens com ${referenceLabel} vencido ou para hoje`,withoutPrimary(toProduceToday),'Pronto para você executar','#ffbd2e','→'),
    renderGroup('Conteúdos a iniciar','ainda não tiveram produção iniciada',withoutPrimary(toStart),'Conteúdo ainda não iniciado','#ffbd2e','＋'),
    renderGroup('Entregue por mim — aguardando aprovação','o que já saiu da sua execução',withoutPrimary(awaitingApproval),'Entregue por você; aguardando aprovação','#579bfc','✓'),
    renderGroup('Em alteração','ajustes solicitados que precisam ser resolvidos antes da próxima entrega',withoutPrimary(inRevision),'Ajuste solicitado; abra o contexto para conferir o que mudar','#ff637a','↻'),
    renderGroup('Aguardando informação','não avança sem resposta, material ou contexto',withoutPrimary(awaitingInfo),'Aguardando informação ou material','#9d50dd','?'),
    renderGroup('Bloqueadas por outra etapa','dependem de outra área para seguir',withoutPrimary(blocked),'Dependência de outra etapa','#ff4d6d','⚠'),
    renderGroup('Próximos prazos',`itens futuros organizados por ${referenceLabel}`,withoutPrimary(nextDeadlines),'Próximo prazo','#a58c79','›')
  ].join('');
  const commandStrip=`<div class="focus-command-strip"><span class="focus-command-strip-label">Atalhos de execução</span><div class="focus-command-actions"><button type="button" class="focus-command-btn" onclick="document.querySelector('.focus-daily-plan')?.scrollIntoView({behavior:'smooth',block:'center'})">Meu plano</button><button type="button" class="focus-command-btn" onclick="openFocusShiftClose()">Fechar turno</button></div></div>`;
  dash.innerHTML = `<div class="focus-hero"><div><h2 class="focus-hero-title">Meu Dia, ${safeText(firstName(user.name))}</h2><p class="focus-hero-text">${focusUsesVeiculacao(user) ? 'Sua fila usa a data de veiculação para organizar a publicação.' : 'Sua fila usa o prazo de entrega para organizar o trabalho.'}</p></div><div class="focus-metrics"><div class="focus-metric" style="--focus-color:#ff4d6d"><strong>${late}</strong><span>atrasados</span></div><div class="focus-metric" style="--focus-color:#ffe600"><strong>${todayCount}</strong><span>hoje</span></div><div class="focus-metric" style="--focus-color:#ff6b00"><strong>${mine.length}</strong><span>abertos</span></div><div class="focus-metric" style="--focus-color:#00ff88"><strong>${ready}</strong><span>prontos</span></div></div></div>${commandStrip}${focusDailyPlanHtml(mine,user,nextAction)}${focusNextActionHtml(nextAction)}${groups || '<div class="focus-empty">✓ Nenhuma demanda aberta neste momento.</div>'}${focusContinuityHtml(mine,user)}`;
}
function toggleFocusShowAll() { focusShowAll = !focusShowAll; renderFocusDashboard(); }
function managerRow(d, meta) { return `<div class="manager-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}</button>${pillHtml(d.status,d.status_color,d.status_border)}<span class="manager-meta">${safeText(meta || d.prazo || d.veiculacao || '')}</span></div>`; }
function managerRiskRow(d) {
  const risk = d.operational_risk || getOperationalRisk(d);
  const meta = risk.sla_label || (getReferenceDate(d) ? `Prazo ${d.prazo || d.veiculacao}` : 'Sem prazo informado');
  return `<div class="manager-row manager-risk-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}<span class="risk-sla">${safeText(meta)}</span></button><div class="manager-risk-meta">${riskBadgeHtml(d)}${riskActionHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}</div></div>`;
}

