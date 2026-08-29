// vybe-init.js — inicialização
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Init ──────────────────────────────────────────────────────────────────────────────────────────
// A inicialização não começa sem sessão: o painel não pode aparecer para quem
// não entrou. iniciarPainel() é chamado aqui, ou pelo vybe-login.js logo depois
// de um login bem-sucedido.
window.addEventListener('DOMContentLoaded', async () => {
  if (await garantirSessao()) iniciarPainel();
});

// Escolhe a fonte de leitura. O banco próprio só entra quando alguém liga a
// chave; qualquer falha nele cai no espelho, para a troca não poder derrubar.
async function carregarOperacao() {
  if (fonteDeLeitura() === 'dominio') {
    try { if (await puxarDominio()) return true; }
    catch (erro) { console.warn('Leitura do banco falhou; usando o espelho.', erro); }
  }
  return pullOperationalMirror();
}

function iniciarPainel() {
  // Depois de garantirSessao(), então já se sabe de quem são os avisos.
  if (typeof iniciarNotificacoes === 'function') iniciarNotificacoes();
  if (typeof ajustarAbasPorPapel === 'function') ajustarAbasPorPapel();
  if (typeof pintarQuemSou === 'function') pintarQuemSou();
  const legacyKpi = document.getElementById('kpi-grid');
  if (legacyKpi) legacyKpi.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:20px 0;">Carregando dados do Monday.com...</div>';
  initPanelMode();
  if (hydrateProductionCache()) {
    setSyncHealth('checking', 'Cache operacional carregado · aguardando confirmação do Monday…');
    // A tela entra com o último estado válido; primeiro tenta o espelho central e usa o Monday direto como fallback.
    setTimeout(async () => {
      const mirrored = await carregarOperacao();
      if (!mirrored) reconcileProductionCache();
      startOperationalMirrorFeed();
    }, 80);
  } else {
    setSyncHealth('checking', 'Sem cache local · buscando uma base operacional confirmada…');
    // Em um novo navegador, o espelho central evita que toda a equipe repita a mesma carga do Monday.
    setTimeout(async () => {
      const mirrored = await carregarOperacao();
      if (!mirrored) await refreshProducao();
      startOperationalMirrorFeed();
    }, 0);
  }
}
// ─── Modo Reunião: leitura executiva sem os controles operacionais do Gestor ───
function meetingScopeItems() { return selectedPersonIds.size ? DADOS.filter(itemMatchesSelectedPeople) : DADOS; }
function closeMeetingMode() { document.getElementById('meeting-mode-overlay')?.remove(); }
function openMeetingItem(itemId) { closeMeetingMode(); setTimeout(()=>openItemWorkspace(itemId),80); }
function openMeetingMode() {
  const scope=meetingScopeItems().filter(d=>!isFinishedItem(d));
  const critical=scope.filter(d=>['critical','high'].includes((d.operational_risk||getOperationalRisk(d)).level)).sort((a,b)=>Number((a.operational_risk||getOperationalRisk(a)).score)-Number((b.operational_risk||getOperationalRisk(b)).score));
  const blockers=getBlockerCommandEntries(scope);
  const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const dueToday=scope.filter(d=>getReferenceDate(d)===today && !['Para agendar','Agendado'].includes(d.status));
  const creators=daControllerTeam().map(user=>{const metrics=daControllerPersonMetrics(user); return {user,metrics};});
  const priority=critical[0] || blockers[0]?.d || dueToday[0] || null;
  const actionRows=(rows,label,empty)=>`<section class="meeting-panel"><div class="meeting-panel-head"><span>${safeText(label)}</span><b>${rows.length}</b></div>${rows.length?rows.slice(0,6).map(d=>{const action=riskActionOwner(d); return `<button type="button" class="meeting-row" onclick="openMeetingItem('${d.id}')"><span class="meeting-row-client">${safeText(d.cliente||'Sem cliente')}</span><span class="meeting-row-name">${safeText(d.nome)}</span><span class="meeting-row-owner">${safeText(action.owner)}<small>${safeText(action.action)}</small></span>${pillHtml(d.status,d.status_color,d.status_border)}</button>`;}).join(''):`<div class="meeting-empty">${safeText(empty)}</div>`}</section>`;
  const overlay=document.createElement('div'); overlay.id='meeting-mode-overlay'; overlay.className='meeting-mode-overlay'; overlay.onclick=event=>{if(event.target===overlay)closeMeetingMode();};
  overlay.innerHTML=`<section class="meeting-mode-sheet" role="dialog" aria-modal="true" aria-label="Modo Reunião"><header class="meeting-head"><div><span>Vybe OS · Modo reunião</span><h2>Operação em uma linha de decisão</h2><p>${safeText(managerCommandContextLabel())} · ${scope.length} demandas abertas no contexto</p></div><button type="button" onclick="closeMeetingMode()" aria-label="Fechar Modo Reunião">×</button></header><section class="meeting-priority ${priority?'':'stable'}"><span>Decisão principal</span>${priority?`<b>${safeText(priority.nome)}</b><p>${safeText(priority.cliente||'Sem cliente')} · ${safeText(riskActionOwner(priority).owner)} deve ${safeText(riskActionOwner(priority).action)}.</p><button type="button" onclick="openMeetingItem('${priority.id}')">Abrir contexto →</button>`:'<b>Operação estável</b><p>Nenhuma escalação crítica no contexto atual.</p>'}</section><div class="meeting-metrics"><span><b>${critical.length}</b> ação hoje</span><span><b>${blockers.length}</b> bloqueios</span><span><b>${dueToday.length}</b> vencem hoje</span><span><b>${creators.reduce((sum,entry)=>sum+entry.metrics.active.length,0)}</b> em execução</span></div><div class="meeting-capacity"><div class="meeting-section-label">CAPACIDADE DA CÉLULA CRIATIVA · estimativa por complexidade</div>${creators.map(({user,metrics})=>`<div class="meeting-capacity-row"><span>${safeText(firstName(user.name))}<small>${safeText(daDisciplineForUser(user).label)}</small></span><b>${metrics.capacity.workload} pts</b><em>${safeText(metrics.capacity.types.slice(0,2).map(([type,points])=>`${type} ${points}`).join(' · ')||'sem carga')}</em><i class="${metrics.capacity.state}">${safeText(metrics.capacity.state)}</i></div>`).join('')}</div><div class="meeting-grid">${actionRows(critical,'AÇÃO HOJE','Nenhuma ação crítica para esta reunião.')}${actionRows(blockers.map(entry=>entry.d),'BLOQUEIOS E DONOS','Nenhum bloqueio ativo.')}${actionRows(dueToday,'ENTREGAS DO DIA','Nenhuma entrega operacional vence hoje.')}</div><footer class="meeting-foot">Use esta visão para conduzir a reunião. As demandas só abrem quando você clicar conscientemente em um contexto.</footer></section>`;
  document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
}

