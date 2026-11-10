// vybe-init.js — inicialização
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Init ──────────────────────────────────────────────────────────────────────────────────────────
// A inicialização não começa sem sessão: o painel não pode aparecer para quem
// não entrou. iniciarPainel() é chamado aqui, ou pelo vybe-login.js logo depois
// de um login bem-sucedido.
window.addEventListener('DOMContentLoaded', async () => {
  // Convidado do Escritório (link de alguém da equipe): entra sem conta e o
  // painel não carrega nada para ele (vybe-escritorio-convidado.js).
  if (typeof convidadoAntesDoLogin === 'function' && await convidadoAntesDoLogin()) return;
  if (await garantirSessao()) iniciarPainel();
});

// O banco próprio é a autoridade. Uma falha preserva o cache e gera alerta;
// o espelho só assume dados se um administrador ativar a contingência explícita.
async function carregarOperacao() {
  if (fonteDeLeitura() === 'dominio') {
    try { return !!(await puxarDominio()); }
    catch (erro) {
      console.error('Leitura do banco Vybe falhou; o Monday não assumirá automaticamente.', erro);
      setSyncHealth('error', `Banco Vybe indisponível; última base segura preservada. ${erro.message}`);
      return false;
    }
  }
  return pullOperationalMirror({ force: true });
}

// QUEM CHEGA POR UM LINK CAI NA PECA.
//
// O botao de copiar link nao serve de nada se abrir o endereco nao levar a lugar
// nenhum. Aqui a peca e aberta assim que os dados chegam — na gaveta, e nao no
// cartao rapido, porque o cartao se ancora numa linha da tela que ainda pode nao
// existir para quem acabou de entrar.
//
// O endereco e limpo depois: recarregar a pagina uma hora depois nao deve
// reabrir a peca de novo, e o painel volta a ser o painel.
function abrirAtividadeDoLink() {
  let id = '';
  try { id = new URLSearchParams(location.search).get('atividade') || ''; } catch { return; }
  if (!id) return;
  try { history.replaceState(null, '', location.origin + location.pathname); } catch { /* segue */ }
  const ehPedido = (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : [])
    .some((d) => String(d.id) === String(id));
  const abrir = ehPedido ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir !== 'function') return;
  setTimeout(() => abrir(String(id)), 120);
}

function iniciarPainel() {
  document.body.classList.remove('auth-pending');
  // Depois de garantirSessao(), então já se sabe de quem são os avisos.
  if (typeof iniciarNotificacoes === 'function') iniciarNotificacoes();
  if (typeof iniciarVigiaPlanejamentos === 'function') iniciarVigiaPlanejamentos();
  if (typeof ajustarAbasPorPapel === 'function') ajustarAbasPorPapel();
  if (typeof pintarQuemSou === 'function') pintarQuemSou();
  const legacyKpi = document.getElementById('kpi-grid');
  if (legacyKpi) legacyKpi.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:20px 0;">Carregando dados do banco Vybe...</div>';
  initPanelMode();
  // O ESCRITÓRIO DESENHA PRIMEIRO. Montar o quadro (do cache e depois do banco)
  // ocupava o navegador por segundos enquanto a pessoa via só a cidade, e o
  // Escritório esperava atrás (Paulo, 03/11/2026: painel pesado nos notebooks).
  // Quando ele abre, o quadro monta depois do primeiro desenho; quando não abre
  // (celular, link de atividade, painel em outra aba, servidor sem Escritório),
  // monta logo em seguida, como antes. O limite de 8 s é o da cortina da entrada.
  if (typeof iniciarNoEscritorio !== 'function') return carregarPainelDeTrabalho();
  // Irecity (Paulo, 07/11/2026: "nada do legado pesando"): a cidade é a primeira tela, então os dados da
  // produção carregam já, sem esperar o mapa antigo do Escritório desenhar (ele levava até 8 s). O Escritório
  // sobe 1,5 s depois, por baixo, só como motor da voz, da presença e dos jogos.
  if (document.body.classList.contains('mundo') && !/[?&]legado=1/.test(location.search)) {
    carregarPainelDeTrabalho();
    setTimeout(() => { iniciarNoEscritorio().catch?.(() => {}); }, 1500);
    return;
  }
  const desenhou = iniciarNoEscritorio().then(() => typeof escritorio !== 'undefined' && escritorio.mapa?.prontos);
  Promise.race([desenhou, new Promise((ok) => setTimeout(ok, 8000))])
    .catch(() => {})
    .then(() => new Promise((ok) => setTimeout(ok, 0)))
    .then(carregarPainelDeTrabalho);
}
function carregarPainelDeTrabalho() {
  if (hydrateProductionCache()) {
    setSyncHealth('checking', 'Cache operacional carregado · aguardando confirmação do banco Vybe…');
    // A tela entra com o último estado válido e confirma o domínio próprio; o espelho apenas observa a contingência.
    setTimeout(async () => {
      const mirrored = await carregarOperacao();
      if (!mirrored) reconcileProductionCache();
      startOperationalMirrorFeed();
      abrirAtividadeDoLink();
    }, 80);
  } else {
    setSyncHealth('checking', 'Sem cache local · buscando a base operacional no banco Vybe…');
    // Em um novo navegador, a base vem do domínio próprio. O espelho não substitui a autoridade.
    setTimeout(async () => {
      const mirrored = await carregarOperacao();
      if (!mirrored) await refreshProducao();
      startOperationalMirrorFeed();
      abrirAtividadeDoLink();
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
  const actionRows=(rows,label,empty)=>`<section class="meeting-panel"><div class="meeting-panel-head"><span>${safeText(label)}</span><b>${rows.length}</b></div>${rows.length?rows.slice(0,6).map(d=>{const action=riskActionOwner(d); return `<button type="button" class="meeting-row" onclick="openMeetingItem('${d.id}')">${vybeChipId(d)}<span class="meeting-row-client">${safeText(d.cliente||'Sem cliente')}</span><span class="meeting-row-name">${safeText(d.nome)}</span><span class="meeting-row-owner">${safeText(action.owner)}<small>${safeText(action.action)}</small></span>${pillHtml(d.status,d.status_color,d.status_border)}</button>`;}).join(''):`<div class="meeting-empty">${safeText(empty)}</div>`}</section>`;
  const overlay=document.createElement('div'); overlay.id='meeting-mode-overlay'; overlay.className='meeting-mode-overlay'; overlay.onclick=event=>{if(event.target===overlay)closeMeetingMode();};
  overlay.innerHTML=`<section class="meeting-mode-sheet" role="dialog" aria-modal="true" aria-label="Modo Reunião"><header class="meeting-head"><div><span>Vybe OS · Modo reunião</span><h2>Operação em uma linha de decisão</h2><p>${safeText(managerCommandContextLabel())} · ${scope.length} demandas abertas no contexto</p></div><button class="x-fechar" type="button" onclick="closeMeetingMode()" aria-label="Fechar Modo Reunião">×</button></header><section class="meeting-priority ${priority?'':'stable'}"><span>Decisão principal</span>${priority?`<b>${safeText(priority.nome)}</b><p>${safeText(priority.cliente||'Sem cliente')} · ${safeText(riskActionOwner(priority).owner)} deve ${safeText(riskActionOwner(priority).action)}.</p><button type="button" onclick="openMeetingItem('${priority.id}')">Abrir contexto →</button>`:'<b>Operação estável</b><p>Nenhuma escalação crítica no contexto atual.</p>'}</section><div class="meeting-metrics"><span><b>${critical.length}</b> ação hoje</span><span><b>${blockers.length}</b> bloqueios</span><span><b>${dueToday.length}</b> vencem hoje</span><span><b>${creators.reduce((sum,entry)=>sum+entry.metrics.active.length,0)}</b> em execução</span></div><div class="meeting-capacity"><div class="meeting-section-label">CAPACIDADE DA CÉLULA CRIATIVA · estimativa por complexidade</div>${creators.map(({user,metrics})=>`<div class="meeting-capacity-row"><span>${safeText(firstName(user.name))}<small>${safeText(daDisciplineForUser(user).label)}</small></span><b>${metrics.capacity.workload} pts</b><em>${safeText(metrics.capacity.types.slice(0,2).map(([type,points])=>`${type} ${points}`).join(' · ')||'sem carga')}</em><i class="${metrics.capacity.state}">${safeText(metrics.capacity.state)}</i></div>`).join('')}</div><div class="meeting-grid">${actionRows(critical,'AÇÃO HOJE','Nenhuma ação crítica para esta reunião.')}${actionRows(blockers.map(entry=>entry.d),'BLOQUEIOS E DONOS','Nenhum bloqueio ativo.')}${actionRows(dueToday,'ENTREGAS DO DIA','Nenhuma entrega operacional vence hoje.')}</div><footer class="meeting-foot">Use esta visão para conduzir a reunião. As demandas só abrem quando você clicar conscientemente em um contexto.</footer></section>`;
  document.body.appendChild(overlay); requestAnimationFrame(()=>overlay.classList.add('open'));
}


// VERSÃO NOVA (Paulo, 10/11/2026: "todos já estão usando as novas interfaces?"). Quem estava com o painel aberto
// numa publicação seguia na versão antiga até recarregar, sem saber. O build põe um código no nome de cada arquivo
// (/assets/painel-871d42118b93.css): o painel guarda os que carregou e, de tempos em tempos e ao voltar para a aba,
// lê a página de novo; se o site já serve outros arquivos, avisa no canto com "Recarregar". Nunca recarrega sozinho
// (pode ter alguém escrevendo). Na demonstração local os arquivos não têm código e o aviso não aparece.
const VERSAO_ARQUIVO = /\/assets\/[\w.-]+-[a-f0-9]{8,}\.(?:js|css)/g;
function arquivosDaVersao(texto) { return new Set(String(texto || '').match(VERSAO_ARQUIVO) || []); }
const VERSAO_CARREGADA = arquivosDaVersao([...document.querySelectorAll('script[src], link[href]')].map((e) => e.getAttribute('src') || e.getAttribute('href')).join('\n'));
const VERSAO = { ultima: 0, ignorada: '', avisada: false };
function haVersaoNova(servidos) {
  if (!VERSAO_CARREGADA.size || !servidos.size) return false;
  for (const a of servidos) if (!VERSAO_CARREGADA.has(a)) return true;
  return false;
}
async function conferirVersao(forcar = false) {
  if (!VERSAO_CARREGADA.size || document.hidden || VERSAO.avisada) return;
  if (!forcar && Date.now() - VERSAO.ultima < 120000) return;
  VERSAO.ultima = Date.now();
  try {
    const r = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok) return;
    const servidos = arquivosDaVersao(await r.text());
    const chave = [...servidos].sort().join('|');
    if (haVersaoNova(servidos) && chave !== VERSAO.ignorada) mostrarVersaoNova(chave);
  } catch { /* sem rede: confere na próxima */ }
}
function mostrarVersaoNova(chave) {
  if (document.getElementById('vb-versao')) return;
  VERSAO.avisada = true;
  const el = document.createElement('div');
  el.id = 'vb-versao'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="vb-versao-texto"><b>Tem versão nova do Vybe OS</b><small>Recarregue para usar o que acabou de ser publicado.</small></span>'
    + '<button type="button" class="vb-versao-depois">Depois</button><button type="button" class="vb-versao-recarregar">Recarregar</button>';
  el.querySelector('.vb-versao-recarregar').addEventListener('click', () => location.reload());
  el.querySelector('.vb-versao-depois').addEventListener('click', () => { VERSAO.ignorada = chave; VERSAO.avisada = false; el.remove(); });
  document.body.appendChild(el);
  posicionarVersaoNova();
}
// Logo acima do que estiver embaixo (dock das salas e, no celular, a barra de baixo): mede em vez de somar alturas.
function posicionarVersaoNova() {
  const el = document.getElementById('vb-versao'); if (!el) return;
  const baixo = [...document.querySelectorAll('.vv-dock-salas, .vv-celular-nav, .mobile-nav')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().top).filter((t) => t > innerHeight / 2);
  el.style.bottom = baixo.length ? `${Math.round(innerHeight - Math.min(...baixo) + 12)}px` : '';
}
window.addEventListener('resize', posicionarVersaoNova);
setInterval(() => conferirVersao(), 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirVersao(); });
window.addEventListener('focus', () => conferirVersao());
