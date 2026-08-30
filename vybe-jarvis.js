// vybe-jarvis.js — Jarvis: comando por voz e texto
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Jarvis V1: comando por voz no Modo Foco ─────────────────────────────────
const JARVIS_API = '/api/jarvis';
let jarvisRecognition = null;
let jarvisListening = false;
let jarvisPendingAction = null;
let jarvisSubmitting = false;
let jarvisStageTimers = [];
let jarvisVoiceEnabled = localStorage.getItem('vybe_jarvis_voice') !== 'false';
let jarvisLastSpeech = '';
let jarvisProvider = localStorage.getItem('vybe_jarvis_provider') || 'auto';
let jarvisConversation = [];
let jarvisConversationProfile = '';
function jarvisProviderName(provider) { return ({auto:'Automático',claude:'Claude',gpt:'GPT',gemini:'Gemini'})[provider] || 'Automático'; }
function updateJarvisProviderControl(actual='') {
  const select = document.getElementById('jarvis-provider');
  if (select) select.value = jarvisProvider;
  const status = document.getElementById('jarvis-provider-state');
  if (status) { status.textContent = actual ? `· ${jarvisProviderName(actual)}` : ''; status.classList.toggle('active', Boolean(actual)); }
}
function setJarvisProvider(provider) {
  jarvisProvider = ['auto','claude','gpt','gemini'].includes(provider) ? provider : 'auto';
  localStorage.setItem('vybe_jarvis_provider', jarvisProvider);
  updateJarvisProviderControl();
  jarvisSetStatus(`Inteligência selecionada: ${jarvisProviderName(jarvisProvider)}.`);
}
function jarvisElements() {
  return {
    shell: document.getElementById('jarvis-shell'), panel: document.getElementById('jarvis-panel'), orb: document.getElementById('jarvis-orb'),
    status: document.getElementById('jarvis-status'), record: document.getElementById('jarvis-record'), transcript: document.getElementById('jarvis-transcript'),
    confirm: document.getElementById('jarvis-confirm'), response: document.getElementById('jarvis-response'), process: document.getElementById('jarvis-process')
  };
}
function jarvisSetStage(stage, state='active') {
  document.querySelectorAll('[data-jarvis-step]').forEach(node => {
    const n = Number(node.dataset.jarvisStep);
    node.classList.remove('active','done','error');
    if (n < stage && state !== 'error') node.classList.add('done');
    if (n === stage) node.classList.add(state);
  });
}
function jarvisClearStages() {
  jarvisStageTimers.forEach(clearTimeout); jarvisStageTimers = [];
  document.querySelectorAll('[data-jarvis-step]').forEach(node => node.classList.remove('active','done','error'));
}
function jarvisStartProcessing() {
  const el = jarvisElements();
  jarvisClearStages();
  if (el.response) { el.response.innerHTML = ''; el.response.classList.remove('active'); }
  if (el.confirm) el.confirm.innerHTML = '';
  jarvisSetStage(1, 'done');
  jarvisSetStatus('Comando capturado. Vou consultar sua fila.', 'processing');
  jarvisStageTimers.push(setTimeout(() => { if (jarvisSubmitting) { jarvisSetStage(2, 'active'); jarvisSetStatus('Consultando sua fila e os prazos ativos.', 'processing'); } }, 250));
  jarvisStageTimers.push(setTimeout(() => { if (jarvisSubmitting) { jarvisSetStage(3, 'active'); jarvisSetStatus('Organizando prioridades para a sua resposta.', 'processing'); } }, 800));
  jarvisStageTimers.push(setTimeout(() => { if (jarvisSubmitting) jarvisSetStatus('Preparando uma devolutiva objetiva para você.', 'processing'); }, 1400));
}
function jarvisPlayReadyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx(); const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.028,ctx.currentTime+.015); gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.22); gain.connect(ctx.destination);
    [660,880].forEach((freq,index) => { const osc=ctx.createOscillator(); osc.type='sine'; osc.frequency.setValueAtTime(freq,ctx.currentTime+index*.07); osc.connect(gain); osc.start(ctx.currentTime+index*.07); osc.stop(ctx.currentTime+.23); });
    setTimeout(() => ctx.close(), 420);
  } catch (_) {}
}
function jarvisFinishProcessing(success=true) {
  jarvisStageTimers.forEach(clearTimeout); jarvisStageTimers = [];
  const el = jarvisElements();
  if (el.panel) el.panel.classList.remove('processing');
  if (el.orb) el.orb.classList.remove('processing');
  if (el.record) { el.record.disabled = false; el.record.textContent = '◉ Falar com Jarvis'; }
  if (success) {
    [1,2,3].forEach(step => jarvisSetStage(step, 'done'));
    jarvisPlayReadyChime();
  } else {
    jarvisSetStage(3, 'error');
  }
}
function jarvisVoiceSupported() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
function updateJarvisVoiceControls() {
  const toggle = document.getElementById('jarvis-voice-toggle');
  const repeat = document.getElementById('jarvis-repeat');
  const supported = jarvisVoiceSupported();
  if (toggle) { toggle.disabled = !supported; toggle.classList.toggle('on', supported && jarvisVoiceEnabled); toggle.textContent = !supported ? 'SEM VOZ' : (jarvisVoiceEnabled ? 'Voz ligada' : 'Voz desligada'); }
  if (repeat) repeat.disabled = !supported || !jarvisLastSpeech;
}
function toggleJarvisVoice() {
  if (!jarvisVoiceSupported()) { jarvisSetStatus('Este navegador não disponibiliza voz sintetizada.'); return; }
  jarvisVoiceEnabled = !jarvisVoiceEnabled;
  localStorage.setItem('vybe_jarvis_voice', String(jarvisVoiceEnabled));
  if (!jarvisVoiceEnabled) window.speechSynthesis.cancel();
  updateJarvisVoiceControls();
  jarvisSetStatus(jarvisVoiceEnabled ? 'Voz do Jarvis ativada.' : 'Voz do Jarvis desativada.');
}
function jarvisPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => /^pt-BR/i.test(v.lang) && v.localService) || voices.find(v => /^pt-BR/i.test(v.lang)) || voices.find(v => /^pt/i.test(v.lang)) || null;
}
function jarvisSpeak(text, force=false) {
  const phrase = String(text || '').replace(/\s+/g,' ').trim().slice(0,260);
  if (!phrase || !jarvisVoiceSupported() || (!jarvisVoiceEnabled && !force)) return;
  jarvisLastSpeech = phrase; updateJarvisVoiceControls();
  const el = jarvisElements();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = 'pt-BR'; utterance.rate = .96; utterance.pitch = .9; utterance.volume = .84;
  const voice = jarvisPreferredVoice(); if (voice) utterance.voice = voice;
  utterance.onstart = () => { el.shell?.classList.add('speaking'); el.panel?.classList.add('jarvis-speaking'); el.orb?.classList.add('speaking'); };
  utterance.onend = utterance.onerror = () => { el.shell?.classList.remove('speaking'); el.panel?.classList.remove('jarvis-speaking'); el.orb?.classList.remove('speaking'); };
  window.speechSynthesis.speak(utterance);
}
function repeatJarvisVoice() { if (jarvisLastSpeech) jarvisSpeak(jarvisLastSpeech, true); }
if (jarvisVoiceSupported()) window.speechSynthesis.onvoiceschanged = updateJarvisVoiceControls;
function jarvisNarrationForIntent(intent, result) {
  const {user,items,today} = jarvisFocusItems();
  const ref = item => focusReferenceDate(item,user);
  if (intent === 'my_today') { const list=items.filter(d => ref(d) && ref(d)<=today); const late=list.filter(d=>ref(d)<today).length; return late ? `Você tem ${late} demanda${late===1?'':'s'} vencida${late===1?'':'s'} e ${list.length-late} com prazo para hoje.` : `Você tem ${list.length} demanda${list.length===1?'':'s'} com prazo para hoje.`; }
  if (intent === 'my_upcoming') { const list=focusSort(items.filter(d => ref(d) && ref(d)>today),user); return list.length ? `Você tem ${list.length} demandas futuras. A próxima vence em ${ref(list[0])}.` : 'Você não tem prazos futuros abertos.'; }
  if (intent === 'my_feasible') { const tomorrow = new Date(`${today}T12:00:00`); tomorrow.setDate(tomorrow.getDate()+1); const end = tomorrow.toISOString().slice(0,10); const list=focusSort(items.filter(d => ['Pode Fazer','Em andamento'].includes(d.status) && ref(d) && ref(d)<=end),user); return list.length ? `Há ${list.length} demanda${list.length===1?'':'s'} já em execução ou pronta${list.length===1?'':'s'} para você priorizar até amanhã.` : 'Não há demandas prontas para execução com prazo até amanhã.'; }
  if (intent === 'my_in_progress') { const n=items.filter(d=>d.status==='Em andamento').length; return n ? `Você tem ${n} demanda${n===1?'':'s'} em andamento agora.` : 'Você não tem demandas em andamento.'; }
  if (intent === 'list_blocked') { const blocked=['Falta Info','Ag. Info Cliente','Aguardo','Falta D.A','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post']; const n=items.filter(d=>blocked.includes(d.status)).length; return n ? `Existem ${n} demandas aguardando informação ou outra etapa.` : 'Você não tem bloqueios na sua fila.'; }
  if (result?.action?.type==='set_status') return `Encontrei a demanda. Posso alterar o status para ${result.action.status}.`;
  if (result?.action?.type==='add_update') return 'Preparei a atualização. Revise antes de confirmar.';
  if (intent==='open_item') return 'Demanda localizada. Abrindo o workspace.';
  return result?.reply || 'Não consegui interpretar o comando.';
}
function toggleJarvis(force) {
  const el = jarvisElements();
  const willOpen = typeof force === 'boolean' ? force : !el.panel?.classList.contains('open');
  el.panel?.classList.toggle('open', willOpen);
  if (willOpen && el.status && !el.status.textContent.trim()) el.status.textContent = 'Pronto para apoiar sua execução.';
  if (willOpen) { updateJarvisVoiceControls(); updateJarvisProviderControl(); }
  if (!willOpen && jarvisListening) stopJarvisListening();
  if (!willOpen && jarvisVoiceSupported()) window.speechSynthesis.cancel();
}
function jarvisSetStatus(text, type='') {
  const el = jarvisElements();
  const listening = type === 'listening';
  const processing = type === 'processing';
  if (el.status) el.status.textContent = text;
  if (el.panel) { el.panel.classList.toggle('listening', listening); el.panel.classList.toggle('processing', processing); }
  if (el.orb) { el.orb.classList.toggle('listening', listening); el.orb.classList.toggle('processing', processing); }
  if (el.record) {
    el.record.classList.toggle('recording', listening);
    el.record.disabled = processing;
    el.record.textContent = listening ? '◉ OUVINDO... CLIQUE PARA ENCERRAR' : (processing ? '◌ JARVIS ANALISANDO...' : '◉ Falar com Jarvis');
  }
}
function jarvisShowTranscript(text, label='ENTENDI') {
  const box = document.getElementById('jarvis-transcript');
  if (!box) return;
  box.innerHTML = `<strong>${safeText(label)}:</strong> ${safeText(text)}`;
  box.classList.toggle('active', Boolean(text));
}
function jarvisAnswerItem(item, user) {
  const reference = focusReferenceDate(item,user) || '—';
  return `<button type="button" class="jarvis-answer-item" onclick="openItemWorkspace('${item.id}')"><span><span class="jarvis-answer-client">${safeText(item.cliente || 'Cliente')}</span><span class="jarvis-answer-name">${safeText(item.nome || 'Demanda')}</span></span><span class="jarvis-answer-meta">${safeText(reference)}<br>${safeText(item.status || '')}</span></button>`;
}
function jarvisRenderAnswer({kicker='JARVIS', title='Resposta pronta', copy='', items=[], user=null, showMyDay=false}) {
  const el = jarvisElements();
  if (!el.response) return;
  const cards = items.length ? `<div class="jarvis-answer-items">${items.slice(0,3).map(item => jarvisAnswerItem(item,user)).join('')}</div>` : '';
  const more = showMyDay ? `<div class="jarvis-answer-actions"><button type="button" onclick="toggleJarvis(false);document.getElementById('focus-dashboard')?.scrollIntoView({behavior:'smooth',block:'start'})">Ver no meu dia</button></div>` : '';
  el.response.innerHTML = `<div class="jarvis-answer"><div class="jarvis-answer-kicker">${safeText(kicker)}</div><div class="jarvis-answer-title">${safeText(title)}</div><div class="jarvis-answer-copy">${safeText(copy)}</div>${cards}${more}</div>`;
  el.response.classList.add('active');
}
function jarvisFocusItems() {
  const user = focusUser();
  const items = user ? DADOS.filter(d => ((d.responsavel_ids || []).includes(user.id) || d.responsavel_id === user.id) && !isFinishedItem(d)) : [];
  return { user, items, today: HOJE_ISO || new Date().toISOString().slice(0,10) };
}
function jarvisRenderIntent(intent, reply='') {
  const {user,items,today} = jarvisFocusItems();
  const sort = list => focusSort([...list],user);
  const blockedStatuses = ['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'];
  if (intent === 'my_today') {
    const due = sort(items.filter(d => { const date = focusReferenceDate(d,user); return date && date <= today; }));
    const late = due.filter(d => focusReferenceDate(d,user) < today).length;
    const todayCount = due.length - late;
    return jarvisRenderAnswer({kicker:'FILA DE HOJE',title: late ? 'Há prazo vencido para resolver' : 'Sua fila de hoje',copy: late ? `${late} vencida${late===1?'':'s'} e ${todayCount} para hoje.` : `${todayCount} demanda${todayCount===1?'':'s'} com prazo hoje.`,items:due,user,showMyDay:true});
  }
  if (intent === 'my_upcoming') {
    const upcoming = sort(items.filter(d => { const date = focusReferenceDate(d,user); return date && date > today; }));
    const first = upcoming[0] ? focusReferenceDate(upcoming[0],user) : '';
    return jarvisRenderAnswer({kicker:'PRÓXIMOS PRAZOS',title: upcoming.length ? 'O que vem nos próximos dias' : 'Nenhum prazo futuro',copy: upcoming.length ? `${upcoming.length} demanda${upcoming.length===1?'':'s'} futura${upcoming.length===1?'':'s'}; a próxima vence em ${first}.` : 'Sua fila não possui demandas futuras abertas.',items:upcoming,user,showMyDay:true});
  }
  if (intent === 'my_in_progress') {
    const active = sort(items.filter(d => d.status === 'Em andamento'));
    return jarvisRenderAnswer({kicker:'EM EXECUÇÃO',title: active.length ? 'O que está em andamento agora' : 'Nada em andamento',copy: active.length ? `${active.length} demanda${active.length===1?'':'s'} já iniciada${active.length===1?'':'s'} por você.` : 'Você não tem nenhuma demanda marcada como Em andamento.',items:active,user,showMyDay:true});
  }
  if (intent === 'my_feasible') {
    const tomorrow = new Date(`${today}T12:00:00`); tomorrow.setDate(tomorrow.getDate()+1); const end = tomorrow.toISOString().slice(0,10);
    const feasible = sort(items.filter(d => ['Pode Fazer','Em andamento'].includes(d.status) && focusReferenceDate(d,user) && focusReferenceDate(d,user) <= end));
    return jarvisRenderAnswer({kicker:'JANELA DE EXECUÇÃO',title: feasible.length ? 'O que você pode priorizar até amanhã' : 'Nenhum item pronto até amanhã',copy: feasible.length ? `${feasible.length} demanda${feasible.length===1?'':'s'} já estão em execução ou prontas para você priorizar. A conclusão depende do tempo necessário em cada entrega.` : 'Não há demandas abertas em execução ou prontas para produzir com prazo até amanhã.',items:feasible,user,showMyDay:true});
  }
  if (intent === 'list_blocked') {
    const blocked = sort(items.filter(d => blockedStatuses.includes(d.status)));
    return jarvisRenderAnswer({kicker:'DEPENDÊNCIAS',title: blocked.length ? 'Itens aguardando resolução' : 'Nenhum bloqueio na sua fila',copy: blocked.length ? `${blocked.length} demanda${blocked.length===1?'':'s'} dependem de informação ou outra etapa.` : 'Não há demandas bloqueadas para você neste momento.',items:blocked,user,showMyDay:true});
  }
  return jarvisRenderAnswer({kicker:'JARVIS',title:'Preciso de mais contexto',copy:reply || 'Você pode perguntar sobre hoje, próximos prazos, itens em andamento ou pedir para abrir uma demanda.'});
}
function jarvisContext() {
  const user = focusUser();
  const mine = user ? DADOS.filter(d => ((d.responsavel_ids || []).includes(user.id) || d.responsavel_id === user.id) && !isFinishedItem(d)) : [];
  return {
    profile: { id: user?.id || '', nome: user?.name || '' },
    context: mine.map(d => ({ id:String(d.id), cliente:d.cliente || '', titulo:d.nome || '', formato:d.formato || d.tipo || '', prazo:d.prazo || focusReferenceDate(d,user) || '', veiculacao:d.veiculacao || '', status:d.status || '', responsavel:d.responsavel || user?.name || '' })),
    status_options: STATUS_OPTIONS.map(o => o.label)
  };
}
function jarvisFindSection(words) {
  const sections = [...document.querySelectorAll('#focus-dashboard .focus-section')];
  return sections.find(section => words.some(word => section.textContent.toLowerCase().includes(word.toLowerCase())));
}
function jarvisFocusView(intent) {
  const mapping = {
    my_in_progress: ['em andamento agora'],
    my_today: ['para produzir hoje','conteúdos a iniciar'],
    my_upcoming: ['próximos prazos'],
    my_feasible: ['em andamento agora','para produzir hoje'],
    list_blocked: ['aguardando informação','bloqueadas por outra etapa']
  };
  const section = jarvisFindSection(mapping[intent] || []);
  (section || document.getElementById('focus-dashboard'))?.scrollIntoView({ behavior:'smooth', block:'start' });
}
function jarvisConfirmHtml(result) {
  const target = document.getElementById('jarvis-confirm');
  if (!target) return;
  const action = result.action;
  if (!action || !['set_status','add_update'].includes(action.type)) { target.innerHTML = ''; return; }
  const item = DADOS.find(d => String(d.id) === String(action.item_id));
  if (!item) { target.innerHTML = '<div class="jarvis-confirm">Não encontrei a demanda mencionada na sua fila atual.</div>'; return; }
  const description = action.type === 'set_status'
    ? `Alterar <strong>${safeText(item.nome)}</strong> para <strong>${safeText(action.status)}</strong>?`
    : `Registrar em <strong>${safeText(item.nome)}</strong>: “${safeText(action.update_text)}”?`;
  target.innerHTML = `<div class="jarvis-confirm"><strong>Confirmar ação</strong>${description}<div class="jarvis-confirm-actions"><button type="button" onclick="confirmJarvisAction()">Confirmar</button><button type="button" onclick="cancelJarvisAction()">Cancelar</button></div></div>`;
}
function cancelJarvisAction() { jarvisPendingAction = null; const target = document.getElementById('jarvis-confirm'); if (target) target.innerHTML = ''; jarvisSetStatus('Ação cancelada. Posso ajudar com outra coisa.'); }
async function confirmJarvisAction() {
  const action = jarvisPendingAction;
  if (!action) return;
  const target = document.getElementById('jarvis-confirm');
  if (target) target.classList.add('jarvis-working');
  try {
    if (action.type === 'set_status') {
      const option = STATUS_OPTIONS.find(o => o.label === action.status);
      if (!option) throw new Error('Status solicitado não existe no Monday.');
      await updateFocusStatus(action.item_id, option.index);
      jarvisSetStatus(`Status atualizado para ${option.label}.`);
    } else if (action.type === 'add_update') {
      const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
      await mondayQuery(mutation, { item: String(action.item_id), body: `[Jarvis · Vybe OS] ${action.update_text}` });
      jarvisSetStatus('Atualização registrada no Monday.');
      showToast('✓ Atualização registrada no Monday', 'ok');
    }
    jarvisPendingAction = null;
    if (target) target.innerHTML = '';
  } catch (error) {
    jarvisSetStatus(`Não consegui concluir: ${error.message}`);
    if (target) target.classList.remove('jarvis-working');
  }
}
function handleJarvisResult(result) {
  jarvisSubmitting = false;
  jarvisFinishProcessing(true);
  jarvisShowTranscript(result.transcript || '', 'COMANDO');
  jarvisPendingAction = result.action || null;
  const actionType = result.action?.type || '';
  if (result.intent === 'open_item' && result.action?.item_id) {
    const item = DADOS.find(d => String(d.id) === String(result.action.item_id));
    jarvisSetStatus('Demanda localizada. Abrindo o workspace.');
    jarvisRenderAnswer({kicker:'DEMANDA LOCALIZADA',title:item?.nome || 'Abrindo demanda',copy:item ? `${item.cliente || 'Cliente'} · ${focusReferenceDate(item,focusUser()) || 'prazo não definido'}` : 'Abrindo o conteúdo solicitado.'});
    openItemWorkspace(result.action.item_id);
  } else if (['my_today','my_upcoming','my_feasible','my_in_progress','list_blocked'].includes(result.intent)) {
    jarvisSetStatus('Resposta pronta. Selecione um card para abrir a demanda.');
    jarvisRenderIntent(result.intent, result.reply);
  } else if (['set_status','add_update'].includes(actionType)) {
    const item = DADOS.find(d => String(d.id) === String(result.action?.item_id));
    const title = actionType === 'set_status' ? 'Alteração pronta para confirmar' : 'Atualização pronta para registrar';
    const copy = actionType === 'set_status' ? `Vou alterar ${item?.nome || 'a demanda'} para ${result.action?.status || 'o novo status'}.` : `Vou registrar uma atualização em ${item?.nome || 'a demanda'}.`;
    jarvisSetStatus('Revise a ação abaixo antes de confirmar.');
    jarvisRenderAnswer({kicker:'AÇÃO SOLICITADA',title,copy});
  } else {
    const natural = result.intent === 'general_question';
    jarvisSetStatus(natural ? `Resposta pronta com ${jarvisProviderName(result.provider)}.` : 'Preciso de mais contexto para encontrar a demanda.');
    jarvisRenderAnswer({kicker: natural ? `JARVIS · ${jarvisProviderName(result.provider).toUpperCase()}` : 'JARVIS',title:natural ? 'Leitura da sua operação' : 'Preciso de mais contexto',copy:result.reply || 'Você pode perguntar sobre hoje, próximos prazos, itens em andamento ou pedir para abrir uma demanda.'});
  }
  updateJarvisProviderControl(result.provider || '');
  jarvisConfirmHtml(result);
  const narration = jarvisNarrationForIntent(result.intent, result);
  if (narration) setTimeout(() => jarvisSpeak(narration), 120);
}
async function submitJarvisCommand(text) {
  const command = String(text || '').trim();
  if (!command || jarvisSubmitting) return;
  const user = focusUser();
  if (!user) return jarvisSetStatus('Selecione seu perfil no Modo Foco antes de usar o Jarvis.');
  const profileKey = String(user.id || '');
  if (jarvisConversationProfile !== profileKey) { jarvisConversation = []; jarvisConversationProfile = profileKey; }
  jarvisSubmitting = true;
  jarvisPendingAction = null;
  jarvisStartProcessing();
  jarvisShowTranscript(command, 'VOCÊ DISSE');
  try {
    const payload = { text: command, provider: jarvisProvider, history: jarvisConversation.slice(-6), ...jarvisContext() };
    const response = await fetch(JARVIS_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    jarvisConversation = [...jarvisConversation, {role:'user',content:command}, {role:'assistant',content:data.reply || ''}].slice(-6);
    handleJarvisResult(data);
  } catch (error) {
    jarvisSubmitting = false;
    jarvisFinishProcessing(false);
    jarvisSetStatus('Não foi possível processar o comando. Tente novamente ou use o campo de texto.');
    const el = jarvisElements();
    if (el.response) { el.response.innerHTML = `<div class="jarvis-answer"><div class="jarvis-answer-kicker">Conexão</div><div class="jarvis-answer-title">Não consegui concluir a consulta</div><div class="jarvis-answer-copy">${safeText(error.message || 'Tente novamente em alguns segundos.')}</div></div>`; el.response.classList.add('active'); }
  }
}
function submitJarvisText() {
  const input = document.getElementById('jarvis-text');
  const text = input?.value || '';
  if (input) input.value = '';
  submitJarvisCommand(text);
}
function ensureJarvisRecognition() {
  if (jarvisRecognition) return jarvisRecognition;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
  let finalText = '';
  recognition.onstart = () => { jarvisListening = true; jarvisSetStatus('Estou ouvindo. Diga um comando curto.', 'listening'); jarvisShowTranscript('', ''); };
  recognition.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += text; else interim += text;
    }
    jarvisShowTranscript(finalText || interim, finalText ? 'COMANDO CAPTURADO' : 'OUVINDO');
  };
  recognition.onerror = event => { jarvisListening = false; jarvisSetStatus(`Não consegui ouvir: ${event.error}. Use o campo de teste abaixo.`); };
  recognition.onend = () => {
    const command = finalText.trim();
    jarvisListening = false;
    jarvisSetStatus(command ? 'Comando capturado. Processando...' : 'Pronto para ouvir um novo comando.');
    if (command) submitJarvisCommand(command);
    finalText = '';
  };
  jarvisRecognition = recognition;
  return recognition;
}
function toggleJarvisListening() {
  toggleJarvis(true);
  const recognition = ensureJarvisRecognition();
  if (!recognition) return jarvisSetStatus('Seu navegador não disponibiliza reconhecimento de voz. Use o campo de teste abaixo.');
  try { if (jarvisListening) recognition.stop(); else recognition.start(); }
  catch (error) { jarvisSetStatus('O microfone já está em uso. Tente novamente em alguns segundos.'); }
}
function stopJarvisListening() { try { jarvisRecognition?.stop(); } catch (e) {} jarvisListening = false; jarvisSetStatus('Pronto para apoiar sua execução.'); }

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
  const primary=mode==='next' ? 'ABRIR E PRODUZIR' : 'VER BLOQUEIO';
  const primaryAction=mode==='next' ? `openFocusPriorityWorkspace('${item.id}')` : `openItemWorkspace('${item.id}')`;
  const statusControl=mode==='next' ? `<button type="button" class="focus-next-btn status" style="border-color:${item.status_color||'#00f0ff'} !important; background:color-mix(in srgb, ${item.status_color||'#00f0ff'} 12%, transparent) !important; color:${item.status_color||'#a6f8ff'} !important;" onclick="openStatusEditor(event,'${item.id}')">STATUS: ${safeText(item.status).toUpperCase()} ▼</button>` : '';
  const checkinControl=mode==='next' ? `<button type="button" class="focus-next-btn checkin" onclick="openFocusPriorityCheckin('${item.id}')">▶ INICIAR BLOCO</button>` : '';
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
function focusJarvisCommand(text) { toggleJarvis(true); submitJarvisCommand(text); }
function focusContinuityHtml(items,user) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const next=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>today && !['Agendado','Finalizado'].includes(d.status);}),user).slice(0,3); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)).length;
  const nextText=next.length ? next.map(d=>`${d.nome} (${focusReferenceLabel(d,user)})`).join(' · ') : 'Nenhuma prioridade futura com prazo informado';
  return `<section class="focus-continuity"><div class="focus-continuity-head"><span>⌁ CONTINUIDADE DE TURNO</span><span>${blocked ? `${blocked} bloqueio${blocked===1?'':'s'} para acompanhar` : 'fila sem bloqueios ativos'}</span></div><div class="focus-continuity-body">Sua próxima linha de continuidade: <b>${safeText(nextText)}</b><div class="focus-continuity-actions"><button type="button" class="focus-command-btn" onclick="copyFocusContinuity()">Copiar resumo</button><button type="button" class="focus-command-btn" onclick="focusJarvisCommand('Qual deve ser minha primeira prioridade amanhã?')">Perguntar ao Jarvis</button></div></div></section>`;
}
async function copyFocusContinuity() { const user=focusUser(); const items=focusOwnItems(user); const action=getFocusNextAction(items,user); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)); const text=`[Vybe OS · Continuidade] ${user?.name || 'Operador'}\nPróxima prioridade: ${action?.item ? `${action.item.nome} · ${action.item.cliente}` : 'Sem item prioritário aberto'}\nBloqueios ativos: ${blocked.length}${blocked.length ? ` · ${blocked.slice(0,3).map(d=>d.nome).join(' | ')}` : ''}\nGerado em: ${new Date().toLocaleString('pt-BR')}`; try { await navigator.clipboard.writeText(text); showToast('✓ Resumo de continuidade copiado','ok'); } catch(e) { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); showToast('✓ Resumo de continuidade copiado','ok'); } }

function focusDailyPlanHtml(items,user,nextAction) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const inProgress=focusSort(items.filter(d=>d.status==='Em andamento'),user);
  const blocked=focusSort(items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)),user);
  const dueByFriday=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>=today && due<=getFridayIso(today) && !isFinishedItem(d);}),user);
  const next=nextAction?.item;
  const row=(label,item,empty)=>item ? `<div class="focus-daily-plan-row"><span>${safeText(label)}</span><button type="button" onclick="openItemWorkspace('${item.id}')">${safeText(item.nome)}</button><small>${safeText(item.status)} · ${safeText(focusReferenceLabel(item,user))}</small></div>` : `<div class="focus-daily-plan-row muted"><span>${safeText(label)}</span><em>${safeText(empty)}</em></div>`;
  return `<section class="focus-daily-plan"><div class="focus-daily-plan-head"><div><span>◫ PLANO DO DIA</span><small>uma leitura rápida para executar sem perder a próxima decisão</small></div><button type="button" class="focus-command-btn" onclick="openFocusShiftClose()">Fechar turno</button></div><div class="focus-daily-plan-grid">${row('AGORA',inProgress[0] || next,'sem execução registrada')}${row('PRÓXIMA',next && String(next.id)!==String(inProgress[0]?.id||'') ? next : dueByFriday.find(d=>String(d.id)!==String(inProgress[0]?.id||'')),'sem prioridade pronta')}${row('DESTRAVAR',blocked[0], 'sem bloqueio ativo')}${row('ATÉ SEXTA',dueByFriday.filter(d=>String(d.id)!==String(inProgress[0]?.id||'') && String(d.id)!==String(next?.id||''))[0], 'sem outro prazo nesta semana')}</div></section>`;
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
    return `<section class="focus-section" style="--focus-group-color:${tone}"><div class="focus-section-head"><span>${icon ? `${icon} ` : ''}${label} <b>${items.length}</b></span><span><small>${subtitle}</small> ${more}</span></div><div class="focus-list">${displayed.map(d => focusTaskHtml(d, contextText)).join('')}</div></section>`;
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
  const commandStrip=`<div class="focus-command-strip"><span class="focus-command-strip-label">Jarvis · Atalhos de execução</span><div class="focus-command-actions"><button type="button" class="focus-command-btn" onclick="document.querySelector('.focus-daily-plan')?.scrollIntoView({behavior:'smooth',block:'center'})">Meu plano</button><button type="button" class="focus-command-btn" onclick="focusJarvisCommand('O que está bloqueado na minha fila?')">Meus bloqueios</button><button type="button" class="focus-command-btn" onclick="openFocusShiftClose()">Fechar turno</button></div></div>`;
  dash.innerHTML = `<div class="focus-hero"><div><h2 class="focus-hero-title">Meu Dia, ${safeText(firstName(user.name))}</h2><p class="focus-hero-text">${focusUsesVeiculacao(user) ? 'Sua fila usa a data de veiculação para organizar a publicação.' : 'Sua fila usa o prazo de entrega para organizar o trabalho.'}</p></div><div class="focus-metrics"><div class="focus-metric" style="--focus-color:#ff4d6d"><strong>${late}</strong><span>atrasados</span></div><div class="focus-metric" style="--focus-color:#ffe600"><strong>${todayCount}</strong><span>hoje</span></div><div class="focus-metric" style="--focus-color:#ff6b00"><strong>${mine.length}</strong><span>abertos</span></div><div class="focus-metric" style="--focus-color:#00ff88"><strong>${ready}</strong><span>prontos</span></div></div></div>${commandStrip}${focusDailyPlanHtml(mine,user,nextAction)}${focusNextActionHtml(nextAction)}${groups || '<div class="focus-empty">✓ Nenhuma demanda aberta neste momento.</div>'}${focusContinuityHtml(mine,user)}`;
}
function toggleFocusShowAll() { focusShowAll = !focusShowAll; renderFocusDashboard(); }
function managerRow(d, meta) { return `<div class="manager-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}</button>${pillHtml(d.status,d.status_color,d.status_border)}<span class="manager-meta">${safeText(meta || d.prazo || d.veiculacao || '')}</span></div>`; }
function managerRiskRow(d) {
  const risk = d.operational_risk || getOperationalRisk(d);
  const meta = risk.sla_label || (getReferenceDate(d) ? `Prazo ${d.prazo || d.veiculacao}` : 'Sem prazo informado');
  return `<div class="manager-row manager-risk-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}<span class="risk-sla">${safeText(meta)}</span></button><div class="manager-risk-meta">${riskBadgeHtml(d)}${riskActionHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}</div></div>`;
}

