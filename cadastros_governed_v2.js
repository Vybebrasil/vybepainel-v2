/* Vybe OS — CADASTROS Governado v2 (Glassmorphism Wizard) */
(function () {
  const STORE_KEY = 'vybe_os_cadastros_queue_v2';
  let activeDraftId = null;
  let currentStep = 1;

  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const todayIso = () => (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  const readQueue = () => { try { const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(raw) ? raw : []; } catch { return []; } };
  const writeQueue = queue => localStorage.setItem(STORE_KEY, JSON.stringify(queue.slice(0, 80)));
  const isoOffset = (base, amount) => { const date = new Date(`${base}T12:00:00`); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };
  const queueStatus = status => ({draft:{label:'RASCUNHO',color:'#7c8a9d'},review:{label:'EM REVISÃO',color:'#f6bf3a'},created:{label:'CRIADO',color:'#00d184'}}[status] || {label:'RASCUNHO',color:'#7c8a9d'});
  const CREATIVE_LEAD_DAYS = 7;
  const earliestCreativeVeic = () => isoOffset(todayIso(), CREATIVE_LEAD_DAYS);
  const advancePlan = veic => {
    if (!veic) return {days:null, ok:false};
    const target = new Date(`${veic}T12:00:00`);
    const base = new Date(`${todayIso()}T12:00:00`);
    const days = Math.round((target - base) / 86400000);
    return {days, ok:days >= CREATIVE_LEAD_DAYS};
  };

  function ensureStyles(){
    if(document.getElementById('cadastros-wizard-style')) return;
    const style=document.createElement('style'); style.id='cadastros-wizard-style'; style.textContent=`
      .cad-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:15000; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s; }
      .cad-overlay.open { opacity:1; }
      .cad-modal { width:min(860px, calc(100vw - 32px)); max-height:calc(100vh - 40px); display:flex; flex-direction:column; background:radial-gradient(circle at top right, rgba(0, 240, 255, 0.05), transparent 50%), radial-gradient(circle at bottom left, rgba(0, 209, 180, 0.05), transparent 50%), rgba(10, 15, 20, 0.85); backdrop-filter:blur(24px) saturate(1.2); border:1px solid rgba(255, 255, 255, 0.08); border-radius:16px; box-shadow:0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(0, 240, 255, 0.05); color:#eef8fc; position:relative; overflow:hidden; transform:translateY(20px) scale(0.98); transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      .cad-overlay.open .cad-modal { transform:translateY(0) scale(1); }
      
      .cad-head { padding:24px 32px 20px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:12px; }
      .cad-head-top { display:flex; justify-content:space-between; align-items:flex-start; }
      .cad-title-block h3 { margin:0; font:800 24px/1.1 var(--mac-ui, sans-serif); letter-spacing:-0.5px; }
      .cad-title-block p { margin:6px 0 0; color:#9cafba; font-size:13px; max-width:500px; line-height:1.4; }
      .cad-controls { display:flex; gap:12px; align-items:center; }
      .cad-drafts-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#b8d7df; padding:8px 14px; border-radius:8px; font:700 11px monospace; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
      .cad-drafts-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
      .cad-drafts-btn b { background:rgba(0,240,255,0.2); color:#00f0ff; padding:2px 6px; border-radius:10px; font-size:10px; }
      .cad-close { background:transparent; border:none; color:#71838d; font-size:24px; cursor:pointer; padding:4px; line-height:1; transition:color 0.2s; }
      .cad-close:hover { color:#fff; }
      
      .cad-stepper { display:flex; gap:6px; margin-top:8px; }
      .cad-step { flex:1; display:flex; flex-direction:column; gap:6px; }
      .cad-step-bar { height:4px; border-radius:2px; background:rgba(255,255,255,0.08); transition:all 0.3s; }
      .cad-step-label { font:800 9px monospace; color:#627885; letter-spacing:0.5px; text-transform:uppercase; transition:color 0.3s; }
      .cad-step.active .cad-step-bar { background:#00f0ff; box-shadow:0 0 10px rgba(0,240,255,0.4); }
      .cad-step.active .cad-step-label { color:#00f0ff; }
      .cad-step.done .cad-step-bar { background:rgba(0,240,255,0.3); }
      
      .cad-body { flex:1; overflow-y:auto; position:relative; min-height:400px; }
      .cad-step-content { display:none; padding:24px 32px; animation:fadeSlide 0.3s ease; }
      .cad-step-content.active { display:block; }
      @keyframes fadeSlide { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
      
      .cad-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 20px; }
      .cad-full { grid-column:1/-1; }
      .cad-field { display:flex; flex-direction:column; gap:6px; }
      .cad-field label { font:700 11px var(--mac-ui, sans-serif); color:#b8d7df; }
      .cad-field small { font:500 11px var(--mac-ui, sans-serif); color:#627885; line-height:1.3; margin-top:-2px; }
      .cad-field input, .cad-field select, .cad-field textarea { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; padding:10px 14px; font:14px var(--mac-ui, sans-serif); outline:none; transition:all 0.2s; box-shadow:inset 0 2px 4px rgba(0,0,0,0.2); }
      .cad-field input:focus, .cad-field select:focus, .cad-field textarea:focus { border-color:#00f0ff; background:rgba(0,240,255,0.02); box-shadow:0 0 0 3px rgba(0,240,255,0.1), inset 0 2px 4px rgba(0,0,0,0.2); }
      
      .cad-toggle { display:flex; gap:12px; align-items:flex-start; padding:14px; border:1px solid rgba(255,255,255,0.08); border-radius:10px; background:rgba(255,255,255,0.02); cursor:pointer; transition:all 0.2s; }
      .cad-toggle:hover { background:rgba(255,255,255,0.04); }
      .cad-toggle input { margin-top:2px; accent-color:#00f0ff; width:16px; height:16px; cursor:pointer; }
      .cad-toggle div { display:flex; flex-direction:column; gap:4px; }
      .cad-toggle b { font:700 12px var(--mac-ui, sans-serif); color:#eef8fc; }
      .cad-toggle span { font:500 11px var(--mac-ui, sans-serif); color:#849aa6; line-height:1.4; }
      
      .cad-review-box { background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; flex-direction:column; gap:16px; }
      .cad-review-hero { border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:16px; }
      .cad-review-hero h4 { margin:0 0 8px; font:800 20px var(--mac-ui, sans-serif); color:#fff; }
      .cad-review-hero p { margin:0; color:#b8d7df; font:500 13px var(--mac-ui, sans-serif); }
      
      .cad-route-card { display:flex; align-items:center; gap:16px; background:linear-gradient(90deg, rgba(246,191,58,0.1), transparent); border:1px solid rgba(246,191,58,0.2); border-left:4px solid #f6bf3a; padding:16px; border-radius:8px; }
      .cad-route-card i { font-size:24px; font-style:normal; }
      .cad-route-card div { display:flex; flex-direction:column; gap:4px; }
      .cad-route-card b { color:#f6bf3a; font:800 12px monospace; }
      .cad-route-card span { color:#d9e2e5; font:500 12px var(--mac-ui, sans-serif); line-height:1.4; }
      
      .cad-checklist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
      .cad-checklist li { display:flex; gap:10px; align-items:flex-start; font:500 13px var(--mac-ui, sans-serif); color:#9cafba; }
      .cad-checklist li.pass { color:#00d184; }
      .cad-checklist li.fail { color:#ff637a; }
      
      .cad-foot { padding:20px 32px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); }
      .cad-btn { border:none; border-radius:8px; padding:12px 24px; font:800 12px var(--mac-ui, sans-serif); cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:8px; }
      .cad-btn-ghost { background:transparent; color:#9cafba; }
      .cad-btn-ghost:hover { color:#fff; background:rgba(255,255,255,0.05); }
      .cad-btn-secondary { background:rgba(255,255,255,0.1); color:#fff; }
      .cad-btn-secondary:hover { background:rgba(255,255,255,0.15); }
      .cad-btn-primary { background:#00f0ff; color:#000; box-shadow:0 0 15px rgba(0,240,255,0.3); }
      .cad-btn-primary:hover { background:#33f3ff; box-shadow:0 0 20px rgba(0,240,255,0.5); transform:translateY(-1px); }
      .cad-btn-primary:disabled { background:rgba(0,240,255,0.2); color:rgba(255,255,255,0.4); box-shadow:none; cursor:not-allowed; transform:none; }
      
      /* Drafts Drawer */
      .cad-drawer { position:absolute; top:0; right:0; width:320px; height:100%; background:rgba(15,20,25,0.95); backdrop-filter:blur(20px); border-left:1px solid rgba(255,255,255,0.08); transform:translateX(100%); transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1); z-index:10; display:flex; flex-direction:column; }
      .cad-drawer.open { transform:translateX(0); box-shadow:-10px 0 30px rgba(0,0,0,0.5); }
      .cad-drawer-head { padding:20px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center; }
      .cad-drawer-head b { font:800 12px var(--mac-ui, sans-serif); color:#fff; }
      .cad-drawer-list { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
      .cad-draft-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px; cursor:pointer; transition:all 0.2s; text-align:left; display:flex; flex-direction:column; gap:6px; }
      .cad-draft-card:hover { background:rgba(255,255,255,0.06); border-color:rgba(0,240,255,0.3); }
      .cad-draft-card.active { border-color:#00f0ff; background:rgba(0,240,255,0.05); }
      .cad-draft-card b { color:#fff; font:700 12px var(--mac-ui, sans-serif); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .cad-draft-card small { color:#849aa6; font:500 11px var(--mac-ui, sans-serif); }
      .cad-draft-badge { display:inline-block; padding:2px 6px; border-radius:4px; font:800 9px monospace; margin-top:4px; }
      
      @media(max-width:780px){
        .cad-grid { grid-template-columns:1fr; }
        .cad-head { padding:20px; }
        .cad-body { padding:0; }
        .cad-step-content { padding:20px; }
        .cad-foot { padding:16px 20px; }
      }
    `; document.head.appendChild(style);
  }

  function clients(){ const source=(typeof DADOS_ALL !== 'undefined' && DADOS_ALL?.length) ? DADOS_ALL : ((typeof DADOS !== 'undefined' && DADOS) || []); return [...new Set(source.map(item => item.cliente).filter(client => client && client !== 'Sem cliente'))].sort((a,b)=>a.localeCompare(b,'pt-BR')); }
  function activeSavedDraft(){ return readQueue().find(item => item.id === activeDraftId) || null; }
  function initialDraft(){ const saved=activeSavedDraft(); return saved ? {...saved,advanceException:Boolean(saved.advanceException),exceptionReason:String(saved.exceptionReason||'')} : {id:null,status:'draft',client:'',format:'',title:'',veic:'',prazo:'',captureDate:'',brief:'',copy:'',briefingReady:false,materialReady:false,extraAssignees:[],seasonalConfirmed:false,advanceException:false,exceptionReason:'',checks:{},createdAt:null,updatedAt:null}; }
  function getEl(id){ return document.getElementById(id); }
  
  function readDraft(){
    const old=initialDraft();
    const format=String(getEl('cw-format')?.value||'').trim();
    const veic=String(getEl('cw-veic')?.value||'').trim();
    const prazo=String(getEl('cw-prazo')?.value||'').trim() || (veic ? isoOffset(veic,-CREATIVE_LEAD_DAYS) : '');
    const briefReady=Boolean(getEl('cw-brief-ready')?.checked);
    const materialReady=Boolean(getEl('cw-material-ready')?.checked);
    const extraSel=getEl('cw-extra-assignees');
    const extraAssignees=extraSel?Array.from(extraSel.selectedOptions).map(o=>o.value):[];
    const destiny=typeof cadastrosDestiny==='function'?cadastrosDestiny(format, briefReady, materialReady, extraAssignees):{group:'novo_grupo__1',groupLabel:'Design & Edição',status:'Pode Fazer',assignees:['71130408'],capture:false,why:'Fallback'};
    const title=String(getEl('cw-title')?.value||'').trim();
    const cleanTitle=title.replace(new RegExp(`^${format}\\s*-\\s*`,'i'),'').trim();
    const checks={};
    if(getEl('cw-check-review')) checks.review = getEl('cw-check-review').checked;
    
    return {...old,
      client:String(getEl('cw-client')?.value||'').trim(),
      format,title,normalized:title?`${format} - ${cleanTitle}`:'',
      veic,prazo,captureDate:String(getEl('cw-capture')?.value||'').trim(),
      brief:String(getEl('cw-brief')?.value||'').trim(),
      copy:String(getEl('cw-copy')?.value||'').trim(),
      briefingReady:briefReady, materialReady, extraAssignees, seasonalConfirmed:Boolean(getEl('cw-seasonal')?.checked),
      advanceException:Boolean(getEl('cw-exception')?.checked),
      exceptionReason:String(getEl('cw-exception-reason')?.value||'').trim(),
      checks,destiny
    };
  }
  
  function checklistFor(d){
    const capture=['Reels','Vídeo','Fotografia'].includes(d.format);
    const base=[
      {key:'name',text:'Nomenclatura padronizada e formato definido',ok:Boolean(d.normalized && d.format)},
      {key:'dates',text:'Prazos consistentes e no futuro',ok:Boolean(d.prazo && d.veic && d.prazo<=d.veic && d.veic>=todayIso())},
      {key:'brief',text:'Briefing/Intenção preenchido',ok:Boolean(d.brief)}
    ];
    if(d.briefingReady) base.push({key:'copy',text:'Legenda/Roteiro fornecidos',ok:Boolean(d.copy)});
    if(capture) base.push({key:'capture',text:'Captação acontece antes do prazo de edição',ok:Boolean(d.captureDate && d.prazo && d.captureDate<=d.prazo)});
    const lead=advancePlan(d.veic);
    base.push({key:'lead',text:lead.ok?`Prazo de Ouro validado (${lead.days} dias de frente)`:d.advanceException&&d.exceptionReason?`Exceção de prazo justificada`:`Prazo de Ouro comprometido (faltam ${CREATIVE_LEAD_DAYS} dias)`,ok:lead.ok||Boolean(d.advanceException&&d.exceptionReason)});
    base.push({key:'review',text:'Declaro ter revisado as informações.',ok:Boolean(d.checks.review)});
    return base;
  }
  
  function validation(d){
    const errors=[];
    if(!d.client)errors.push('Selecione o cliente.');
    if(!d.format)errors.push('Selecione o formato.');
    if(!d.title)errors.push('Informe o título.');
    if(!d.brief)errors.push('Preencha o briefing.');
    if(d.briefingReady&&!d.copy)errors.push('Legenda obrigatória para briefing pronto.');
    if(!d.veic)errors.push('Informe a veiculação.');
    if(!d.prazo)errors.push('Informe o prazo.');
    if(d.veic && d.veic<todayIso())errors.push('Veiculação não pode ser no passado.');
    const lead=advancePlan(d.veic);
    if(d.veic&&!lead.ok&&!(d.advanceException&&d.exceptionReason))errors.push(`A produção criativa exige ${CREATIVE_LEAD_DAYS} dias de antecedência. Utilize uma exceção justificada se for urgente.`);
    if(d.prazo && d.veic && d.prazo>d.veic)errors.push('O prazo deve ser anterior ou igual à veiculação.');
    if(d.prazo && d.veic && d.prazo!==isoOffset(d.veic,-CREATIVE_LEAD_DAYS))errors.push(`O Prazo de Ouro deve ser ${CREATIVE_LEAD_DAYS} dias antes da veiculação.`);
    if(['Reels','Vídeo','Fotografia'].includes(d.format)&&d.briefingReady&&!d.captureDate)errors.push('Data de captação é obrigatória.');
    if(d.captureDate&&d.prazo&&d.captureDate>d.prazo)errors.push('Captação deve ocorrer antes do prazo final.');
    return errors;
  }
  
  function saveDraft(status='draft'){
    const draft=readDraft();
    const queue=readQueue();
    const now=new Date().toISOString();
    const item={...draft,id:draft.id||`cad-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,status,createdAt:draft.createdAt||now,updatedAt:now};
    const index=queue.findIndex(entry=>entry.id===item.id);
    if(index>=0)queue[index]=item; else queue.unshift(item);
    writeQueue(queue);
    activeDraftId=item.id;
    return item;
  }

  function renderDrawer(queue) {
    if(!queue.length) return `<div style="padding:20px;text-align:center;color:#627885;font-size:12px;">Nenhum rascunho salvo.</div>`;
    return queue.map(item => {
      const state = queueStatus(item.status);
      return `<div class="cad-draft-card ${item.id===activeDraftId?'active':''}" onclick="cadWizardLoad('${item.id}')">
        <b>${esc(item.normalized||'Sem título')}</b>
        <small>${esc(item.client||'Cliente pendente')}</small>
        <div><span class="cad-draft-badge" style="background:${state.color}20; color:${state.color}">${state.label}</span></div>
      </div>`;
    }).join('');
  }

  function renderReviewChecklist(d) {
    return checklistFor(d).map(c => `
      <li class="${c.ok?'pass':'fail'}">
        ${c.key==='review' ? `<input type="checkbox" id="cw-check-review" style="accent-color:#00f0ff;width:14px;height:14px;margin-top:2px;" ${c.ok?'checked':''} onchange="cadWizardRefresh()">` : (c.ok?'✓':'○')}
        <span>${esc(c.text)}</span>
      </li>
    `).join('');
  }

  window.cadWizardRefresh = () => {
    if(!document.getElementById('cad-wizard-overlay')) return;
    const d = readDraft();
    const prazo = getEl('cw-prazo');
    if(d.veic && prazo && !prazo.value) prazo.value = isoOffset(d.veic, -CREATIVE_LEAD_DAYS);
    
    // Update Lead Time Hint
    const lead = advancePlan(d.veic);
    const hint = getEl('cw-lead-hint');
    if(hint) {
      if(!d.veic) hint.innerHTML = `<span style="color:#627885">Selecione a veiculação para calcular.</span>`;
      else if(lead.ok) hint.innerHTML = `<span style="color:#00d184">✓ Janela protegida (${lead.days} dias de margem)</span>`;
      else hint.innerHTML = `<span style="color:#f6bf3a">⚠ Alerta: Faltam ${CREATIVE_LEAD_DAYS} dias. Requer justificativa de urgência.</span>`;
    }

    // Capture Date Visibility
    const captureBlock = getEl('cw-capture-block');
    if(captureBlock) {
      const isCapture = ['Reels','Vídeo','Fotografia'].includes(d.format) && !d.materialReady;
      const matBlock = getEl('cw-material-block');
      if(matBlock) matBlock.style.display = ['Reels','Vídeo','Fotografia'].includes(d.format) ? 'flex' : 'none';
      captureBlock.style.display = isCapture ? 'flex' : 'none';
    }

    // Exceptions Box
    const excBlock = getEl('cw-exception-block');
    if(excBlock) excBlock.style.display = d.advanceException ? 'flex' : 'none';

    // Copy Box
    const copyLabel = getEl('cw-copy-label');
    if(copyLabel) copyLabel.textContent = d.briefingReady ? 'Legenda / Roteiro *' : 'Legenda / Roteiro (Opcional)';

    // Update Review Tab if we are on it
    if(currentStep === 3) {
      const revHero = getEl('cw-rev-hero');
      if(revHero) revHero.innerHTML = `<h4>${esc(d.normalized||'Formato e Título pendentes')}</h4><p>${esc(d.client||'Cliente')} · Veiculação: ${esc(d.veic?new Date(d.veic+'T12:00:00').toLocaleDateString('pt-BR'):'Pendente')}</p>`;
      
      const revRoute = getEl('cw-rev-route');
      const route = d.format ? d.destiny : cadastrosDestiny('', false);
      if(revRoute) revRoute.innerHTML = `<i>${route.groupLabel.includes('PRODUÇÃO')?'🎬':route.groupLabel.includes('REDAÇÃO')?'📝':'⚡'}</i><div><b>DESTINO: ${esc(route.groupLabel)}</b><span>Status inicial: ${esc(route.status)} · Responsáveis: ${esc(cadastrosAssigneeNames(route.assignees))}<br>${esc(route.why)}</span></div>`;
      
      const revChecklist = getEl('cw-rev-checklist');
      if(revChecklist) revChecklist.innerHTML = renderReviewChecklist(d);

      const errs = validation(d);
      const errBox = getEl('cw-rev-errors');
      if(errBox) {
        if(errs.length) errBox.innerHTML = `<div style="background:rgba(255,99,122,0.1); border:1px solid rgba(255,99,122,0.3); padding:12px; border-radius:8px; color:#ff637a; font-size:12px; font-weight:600;">⚠ ${esc(errs[0])}</div>`;
        else errBox.innerHTML = '';
      }

      const btnSubmit = getEl('cw-submit-btn');
      if(btnSubmit) btnSubmit.disabled = errs.length > 0 || !d.checks.review;
    }
  };

  window.cadWizardNext = () => {
    if(currentStep < 3) { currentStep++; render(); }
  };
  window.cadWizardPrev = () => {
    if(currentStep > 1) { currentStep--; render(); }
  };
  window.cadWizardToggleDrawer = () => {
    const d = getEl('cw-drawer');
    if(d) d.classList.toggle('open');
  };
  window.cadWizardNew = () => { activeDraftId = null; currentStep = 1; render(); };
  window.cadWizardLoad = (id) => { activeDraftId = id; currentStep = 1; render(); };
  window.cadWizardSave = () => { saveDraft('draft'); showToast('✓ Rascunho salvo localmente.','ok',3000); render(); };

  window.cadWizardSubmit = async () => {
    const draft = readDraft();
    const errors = validation(draft);
    if(errors.length) return showToast(errors[0], 'err', 5000);
    if(!draft.checks.review) return showToast('Confirme a revisão no final do checklist.', 'err', 5000);
    
    const btn = getEl('cw-submit-btn');
    if(btn) { btn.disabled = true; btn.innerHTML = 'CRIANDO NO MONDAY...'; }

    const values = {
      lista_suspensa_mkmqnjbv: {labels:[draft.client]},
      lista_suspensa0__1: {labels:[draft.format]},
      lista_suspensa__1: {index:3},
      data__1: {date:draft.veic},
      data: {date:draft.prazo},
      status: {label:draft.destiny.status},
      person: {personsAndTeams:draft.destiny.assignees.map(id=>({id:Number(id),kind:'person'}))}
    };
    if(draft.destiny.capture) values.status_1__1 = {label:'Agendar Captação'};

    try {
      const create = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;
      const response = await mondayQuery(create, {board:String(BOARD_ID), group:draft.destiny.group, name:draft.normalized, values:JSON.stringify(values)});
      const itemId = response?.create_item?.id;
      if(!itemId) throw new Error('Monday não retornou ID do item.');

      const captureLine = draft.destiny.capture ? `<li>☐ Confirmar captação prevista para ${esc(draft.captureDate)}</li>` : '';
      const motionLine = draft.format === 'Motion' ? '<li>☐ Validar direção de arte antes da execução</li>' : '';
      const exceptionLine = draft.advanceException ? `<li><strong>⚠ EXCEÇÃO DE PRAZO:</strong> ${esc(draft.exceptionReason)}</li>` : '';
      const hellen = draft.client.toLowerCase().includes('hellen rocha') ? '<li>☐ Validar informações jurídicas com a Hellen antes de publicar</li>' : '';
      
      const update = `<p><strong>✅ CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${esc(draft.brief)}</p><p><strong>Legenda/Roteiro:</strong> ${esc(draft.copy || 'A construir em Redação')}</p><ul><li>☐ Revisar copy e adaptar ao tom da marca</li><li>☐ Selecionar referências visuais / banco de imagens</li><li>☐ Montar layout no padrão do cliente</li>${captureLine}${motionLine}${exceptionLine}<li>☐ Enviar para aprovação antes de publicar</li>${hellen}</ul>`;
      await mondayQuery(`mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {item:String(itemId), body:update});

      const queue = readQueue();
      const index = queue.findIndex(item => item.id === draft.id);
      if(index >= 0) { queue[index] = {...queue[index], status:'created', mondayItemId:String(itemId), updatedAt:new Date().toISOString()}; writeQueue(queue); }
      
      closeCadastrosGoverned();
      showToast('✓ Demanda criada com sucesso no Monday!', 'ok', 6000);
      if(typeof refreshData === 'function') await refreshData();
    } catch(err) {
      if(btn) { btn.disabled = false; btn.innerHTML = 'VALIDAR E CRIAR NO MONDAY'; }
      showToast(`Erro ao criar: ${err.message}`, 'err', 8000);
    }
  };

  function render(){
    ensureStyles();
    const old = document.getElementById('cad-wizard-overlay');
    if(old) {
      const temp = readDraft();
      activeDraftId = temp.id;
    } else {
      currentStep = 1;
    }
    
    if(old) old.remove();

    const draft = initialDraft();
    const queue = readQueue();
    const draftsCount = queue.filter(q => q.status === 'draft').length;

    const overlay = document.createElement('div');
    overlay.id = 'cad-wizard-overlay';
    overlay.className = 'cad-overlay';
    overlay.onclick = e => { if(e.target === overlay) closeCadastrosGoverned(); };

    overlay.innerHTML = `
      <section class="cad-modal" role="dialog">
        <header class="cad-head">
          <div class="cad-head-top">
            <div class="cad-title-block">
              <h3>Cadastros</h3>
              <p>Entrada controlada no Monday. Preencha as informações para a triagem inteligente.</p>
            </div>
            <div class="cad-controls">
              <button class="cad-drafts-btn" onclick="cadWizardToggleDrawer()">
                RASCUNHOS <b>${draftsCount}</b>
              </button>
              <button class="cad-close" onclick="closeCadastrosGoverned()">×</button>
            </div>
          </div>
          <div class="cad-stepper">
            <div class="cad-step ${currentStep>=1?'active':''} ${currentStep>1?'done':''}">
              <div class="cad-step-bar"></div>
              <span class="cad-step-label">1. Intenção</span>
            </div>
            <div class="cad-step ${currentStep>=2?'active':''} ${currentStep>2?'done':''}">
              <div class="cad-step-bar"></div>
              <span class="cad-step-label">2. Planejamento</span>
            </div>
            <div class="cad-step ${currentStep>=3?'active':''}">
              <div class="cad-step-bar"></div>
              <span class="cad-step-label">3. Validação</span>
            </div>
          </div>
        </header>

        <!-- DRAWER -->
        <aside id="cw-drawer" class="cad-drawer">
          <div class="cad-drawer-head">
            <b>Seus Pré-cadastros</b>
            <button class="cad-close" style="font-size:18px" onclick="cadWizardToggleDrawer()">×</button>
          </div>
          <div style="padding:12px;">
            <button class="cad-btn cad-btn-secondary" style="width:100%;justify-content:center;" onclick="cadWizardNew()">+ NOVO CADASTRO</button>
          </div>
          <div class="cad-drawer-list">
            ${renderDrawer(queue)}
          </div>
        </aside>

        <main class="cad-body" oninput="cadWizardRefresh()" onchange="cadWizardRefresh()">
          
          <!-- STEP 1: INTENÇÃO -->
          <div class="cad-step-content ${currentStep===1?'active':''}">
            <div class="cad-grid">
              <div class="cad-field">
                <label>Cliente *</label>
                <select id="cw-client">
                  <option value="">Selecione o cliente</option>
                  ${clients().map(c => `<option value="${esc(c)}" ${draft.client===c?'selected':''}>${esc(c)}</option>`).join('')}
                </select>
              </div>
              <div class="cad-field">
                <label>Formato *</label>
                <select id="cw-format">
                  <option value="">Selecione o formato</option>
                  ${CADASTROS_FORMATS.map(f => `<option value="${esc(f)}" ${draft.format===f?'selected':''}>${esc(f)}</option>`).join('')}
                </select>
              </div>
              <div class="cad-field cad-full">
                <label>Título do conteúdo *</label>
                <input id="cw-title" value="${esc(draft.title)}" placeholder="Ex.: Bastidores da nova coleção">
              </div>
              <div class="cad-field cad-full">
                <label>Briefing ou Intenção *</label>
                <textarea id="cw-brief" rows="3" placeholder="Objetivo, mensagem central, referências ou CTA.">${esc(draft.brief)}</textarea>
              </div>
              <div class="cad-field cad-full">
                <label id="cw-copy-label">Legenda ou Roteiro ${draft.briefingReady?'*':'(Opcional)'}</label>
                <textarea id="cw-copy" rows="3" placeholder="Texto base, narração ou legenda final.">${esc(draft.copy)}</textarea>
              </div>
              
              <label class="cad-toggle cad-full">
                <input type="checkbox" id="cw-brief-ready" ${draft.briefingReady?'checked':''}>
                <div>
                  <b>O briefing está pronto para a produção.</b>
                  <span>Se desmarcado, a demanda entrará em "A Fazer" na Redação para ser construída. Se marcado, pula direto para Design, Captação ou Motion.</span>
                </div>
              </label>
              <label class="cad-toggle cad-full" id="cw-material-block" style="display:none;">
                <input type="checkbox" id="cw-material-ready" ${draft.materialReady?'checked':''}>
                <div>
                  <b>Material de captação já fornecido</b>
                  <span>O cliente já enviou os arquivos brutos. Não precisa agendar captação, vai direto para edição com o Reriston.</span>
                </div>
              </label>
              <div class="cad-field cad-full">
                <label>Adicionar Responsáveis (Opcional)</label>
                <select id="cw-extra-assignees" multiple size="3" style="height:75px; padding:6px 14px;">
                  ${(typeof TEAM_USERS!=='undefined'?TEAM_USERS:[]).map(u => `<option value="${u.id}" ${(draft.extraAssignees||[]).includes(u.id)?'selected':''}>${esc(u.name)}</option>`).join('')}
                </select>
                <small>Segure CTRL/CMD para selecionar vários. Eles serão somados aos responsáveis da triagem.</small>
              </div>
              <label class="cad-toggle cad-full">
                <input type="checkbox" id="cw-seasonal" ${draft.seasonalConfirmed?'checked':''}>
                <div>
                  <b>Tema Sazonal Confirmado</b>
                  <span>Marque apenas se o cliente validou este tema sazonal explicitamente.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- STEP 2: PLANEJAMENTO -->
          <div class="cad-step-content ${currentStep===2?'active':''}">
            <div class="cad-grid">
              <div class="cad-field">
                <label>Data de Veiculação *</label>
                <input type="date" id="cw-veic" min="${todayIso()}" value="${esc(draft.veic)}">
                <small id="cw-lead-hint"></small>
              </div>
              <div class="cad-field">
                <label>Prazo de Ouro *</label>
                <input type="date" id="cw-prazo" min="${todayIso()}" value="${esc(draft.prazo)}">
                <small>Automaticamente 7 dias antes da veiculação.</small>
              </div>
              
              <div id="cw-capture-block" class="cad-field cad-full" style="display:none;">
                <label>Data Prevista de Captação *</label>
                <input type="date" id="cw-capture" min="${todayIso()}" value="${esc(draft.captureDate)}">
                <small>Para vídeo ou foto, a captação precisa ocorrer antes da edição.</small>
              </div>

              <label class="cad-toggle cad-full">
                <input type="checkbox" id="cw-exception" ${draft.advanceException?'checked':''}>
                <div>
                  <b>Exceção de Urgência (Pular Prazo de Ouro)</b>
                  <span>O sistema bloqueará datas muito próximas. Use isto para forçar a criação urgente.</span>
                </div>
              </label>

              <div id="cw-exception-block" class="cad-field cad-full" style="display:none;">
                <label>Justificativa da Exceção *</label>
                <textarea id="cw-exception-reason" rows="2" placeholder="Explique por que precisamos quebrar o prazo de segurança...">${esc(draft.exceptionReason)}</textarea>
              </div>
            </div>
          </div>

          <!-- STEP 3: VALIDAÇÃO -->
          <div class="cad-step-content ${currentStep===3?'active':''}">
            <div class="cad-review-box">
              <div class="cad-review-hero" id="cw-rev-hero"></div>
              <div class="cad-route-card" id="cw-rev-route"></div>
              <ul class="cad-checklist" id="cw-rev-checklist"></ul>
              <div id="cw-rev-errors"></div>
            </div>
          </div>
          
        </main>
        
        <footer class="cad-foot">
          <div style="display:flex;gap:12px;">
            ${currentStep>1 ? \`<button class="cad-btn cad-btn-ghost" onclick="cadWizardPrev()">← VOLTAR</button>\` : \`<button class="cad-btn cad-btn-ghost" style="visibility:hidden">← VOLTAR</button>\`}
          </div>
          <div style="display:flex;gap:12px;">
            <button class="cad-btn cad-btn-secondary" onclick="cadWizardSave()">SALVAR RASCUNHO</button>
            ${currentStep<3 ? \`<button class="cad-btn cad-btn-primary" onclick="cadWizardNext()">AVANÇAR →</button>\` : \`<button id="cw-submit-btn" class="cad-btn cad-btn-primary" onclick="cadWizardSubmit()">VALIDAR E CRIAR</button>\`}
          </div>
        </footer>
      </section>
    \`;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      cadWizardRefresh(); // Initial UI sync
    });
  }

  window.closeCadastrosGoverned = () => {
    const el = document.getElementById('cad-wizard-overlay');
    if(el) {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 300);
    }
  };
  window.openCadastrosGoverned = () => { activeDraftId = null; render(); };
  window.showCadastrosPreview = () => window.openCadastrosGoverned();
})();
