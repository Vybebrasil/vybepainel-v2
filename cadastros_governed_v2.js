/* Vybe OS — Cadastro Rápido + Prévia Ao Vivo */
(function() {
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function todayIso() {
    return (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) ? HOJE_ISO : new Date().toISOString().slice(0,10);
  }
  
  function getOffsetDate(iso, days) {
    if(!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function ensureFastCadastrosStyles() {
    if(document.getElementById('fast-cad-styles')) return;
    const style = document.createElement('style');
    style.id = 'fast-cad-styles';
    style.textContent = `
      .fc-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); z-index:20000; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s ease; }
      .fc-overlay.open { opacity:1; }
      
      .fc-modal { background:radial-gradient(circle at top right, rgba(255,255,255,0.05), transparent 70%), rgba(15,20,25,0.85); backdrop-filter:blur(30px) saturate(1.2); width:100%; max-width:960px; border:1px solid rgba(255,255,255,0.1); border-radius:24px; display:flex; flex-direction:row; box-shadow:0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); font-family:var(--mac-ui, sans-serif); transform:scale(0.95) translateY(20px); transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1); margin: 20px; max-height: calc(100vh - 40px); }
      .fc-overlay.open .fc-modal { transform:scale(1) translateY(0); }

      .fc-main-col { flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid rgba(255,255,255,0.06); }
      
      .fc-header { padding:28px 32px 20px; display:flex; flex-direction:column; gap:16px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
      .fc-kicker { font:800 11px monospace; color:#00f0ff; letter-spacing:1px; text-transform:uppercase; }
      .fc-title-input { background:transparent; border:none; color:#fff; font:800 32px/1.2 var(--mac-ui, sans-serif); width:100%; outline:none; letter-spacing:-0.5px; }
      .fc-title-input::placeholder { color:rgba(255,255,255,0.2); }

      .fc-body { padding:24px 32px; display:flex; flex-direction:column; gap:20px; overflow-y:auto;  flex:1; }
      .fc-body::-webkit-scrollbar { width: 6px; }
      .fc-body::-webkit-scrollbar-track { background: transparent; }
      .fc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
      .fc-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      
      @keyframes fcErrorPulse {
         0% { box-shadow: 0 0 0 0 rgba(255, 99, 122, 0.4); border-color: #ff637a; }
         70% { box-shadow: 0 0 0 8px rgba(255, 99, 122, 0); border-color: #ff637a; }
         100% { box-shadow: 0 0 0 0 rgba(255, 99, 122, 0); border-color: rgba(255,255,255,0.1); }
      }
      .fc-error-pulse { animation: fcErrorPulse 1.5s ease; border-color: #ff637a !important; }
      .fc-title-input.fc-error-pulse { border-bottom: 1px solid #ff637a !important; }
      
      .fc-row { display:flex; align-items:flex-start; gap:20px; }
      .fc-label { width:120px; color:#9cafba; font-size:13px; font-weight:600; flex-shrink:0; margin-top:12px; letter-spacing:0.3px; }
      
      .fc-input-wrap { flex:1; min-width:0; }
      .fc-input { width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px; font-weight:500; padding:12px 16px; border-radius:12px; outline:none; transition:all 0.2s; font-family:var(--mac-ui, sans-serif); }
      .fc-input:hover { background:rgba(0,0,0,0.4); border-color:rgba(255,255,255,0.15); }
      .fc-input:focus { border-color:#00f0ff; background:rgba(0,0,0,0.5); box-shadow:0 0 0 3px rgba(0,240,255,0.1); }
      
      select.fc-input { appearance:none; cursor:pointer; }
      select.fc-input option { background:#151a21; color:#fff; }
      
      .fc-persons { display:flex; gap:8px; flex-wrap:wrap; }
      .fc-person-btn { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:30px; padding:6px 14px 6px 6px; display:flex; align-items:center; gap:8px; color:#b8d7df; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
      .fc-person-btn:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.2); }
      .fc-person-btn.active { background:rgba(0,240,255,0.1); border-color:#00f0ff; color:#fff; box-shadow:0 4px 12px rgba(0,240,255,0.2); }
      .fc-avatar { width:24px; height:24px; border-radius:50%; overflow:hidden; display:flex; justify-content:center; align-items:center; font-size:11px; font-weight:800; color:#fff; }
      .fc-avatar img { width:100%; height:100%; object-fit:cover; }

      .fc-footer { padding:24px 32px; display:flex; justify-content:flex-end; gap:16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.2); flex-shrink:0; }
      .fc-btn-cancel { background:transparent; border:none; color:#849aa6; font-size:14px; font-weight:600; cursor:pointer; padding:12px 20px; transition:color 0.2s; }
      .fc-btn-cancel:hover { color:#fff; }
      .fc-btn-create { background:linear-gradient(135deg, #00f0ff, #0074e0); color:#000; border:none; padding:12px 28px; border-radius:12px; font-size:14px; font-weight:800; cursor:pointer; transition:all 0.2s; box-shadow:0 10px 20px rgba(0,240,255,0.2); }
      .fc-btn-create:hover { transform:translateY(-2px); box-shadow:0 15px 25px rgba(0,240,255,0.3); }
      .fc-btn-create:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
      
      textarea.fc-input { resize:vertical; min-height:80px; line-height:1.5; }
      
      .fc-checkbox-group { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
      .fc-checkbox-row { display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(0,0,0,0.2); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); transition:all 0.2s; }
      .fc-checkbox-row:hover { background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.1); }
      .fc-checkbox-row input { accent-color:#00f0ff; width:18px; height:18px; cursor:pointer; }
      .fc-checkbox-row span { color:#d9e2e5; font-size:13px; font-weight:500; }
      
      .fc-custom-dropdown { position:relative; width:100%; font-family:var(--mac-ui, sans-serif); }
      .fc-dropdown-value { width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:13px; font-weight:700; padding:10px 16px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:all 0.2s; }
      .fc-dropdown-value:hover { background:rgba(0,0,0,0.5); }
      .fc-dropdown-value::after { content:'▼'; font-size:9px; color:#849aa6; }
      .fc-dropdown-list { position:absolute; top:calc(100% + 4px); left:0; width:100%; background:#1a2026; border:1px solid rgba(255,255,255,0.1); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:100; display:none; flex-direction:column; padding:6px; max-height:200px; overflow-y:auto; }
      .fc-dropdown-list.open { display:flex; }
      .fc-dropdown-list::-webkit-scrollbar { width:4px; }
      .fc-dropdown-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }
      .fc-dropdown-item { padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700; display:flex; align-items:center; transition:background 0.2s; }
      .fc-dropdown-item:hover { filter:brightness(1.2); }
      
      .fc-auto-group { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; background:rgba(255,255,255,0.02); padding:16px; border-radius:16px; border:1px dashed rgba(255,255,255,0.1); }
      .fc-auto-col { display:flex; flex-direction:column; gap:8px; }
      .fc-auto-col label { font-size:11px; color:#849aa6; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }

      .fc-side-col { width:340px; padding:32px 24px; background:rgba(0,0,0,0.2); display:flex; flex-direction:column; position:relative; }
      .fc-close { z-index:50; position:absolute; top:24px; right:24px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#849aa6; font-size:20px; cursor:pointer; line-height:1; width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; transition:all 0.2s; }
      .fc-close:hover { background:rgba(255,255,255,0.1); color:#fff; transform:scale(1.05); }
      
      .fc-side-title { font:800 11px monospace; color:#849aa6; letter-spacing:1px; margin-bottom:24px; }
      .fc-preview-card { background:radial-gradient(circle at top left, rgba(255,255,255,0.05), transparent), rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3); }
      .fc-prev-head { display:flex; flex-direction:column; gap:4px; }
      .fc-prev-head b { color:#fff; font:800 18px/1.2 var(--mac-ui, sans-serif); word-break:break-word; }
      .fc-prev-head span { color:#b8d7df; font:600 13px var(--mac-ui, sans-serif); }
      
      .fc-prev-body { display:flex; flex-direction:column; gap:12px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06); }
      .fc-prev-item { display:flex; flex-direction:column; gap:4px; }
      .fc-prev-item small { font:800 10px monospace; color:#627885; text-transform:uppercase; letter-spacing:0.5px; }
      .fc-prev-item div { color:#eef8fc; font:500 13px var(--mac-ui, sans-serif); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .fc-prev-tag { background:rgba(0,240,255,0.1); color:#00f0ff; border:1px solid rgba(0,240,255,0.2); font:800 10px monospace; padding:2px 8px; border-radius:4px; text-transform:uppercase; }
      
      .fc-prev-users { display:flex; gap:6px; flex-wrap:wrap; }
      .fc-prev-users .fc-avatar { width:20px; height:20px; border:1px solid rgba(255,255,255,0.1); }
      
      .fc-helper-text { margin-top:24px; font-size:12px; color:#627885; line-height:1.5; font-family:var(--mac-ui, sans-serif); }
      
      @media(max-width: 900px) {
        .fc-modal { flex-direction:column; }
        .fc-main-col { border-right:none; border-bottom:1px solid rgba(255,255,255,0.06); }
        .fc-side-col { width:100%; border-radius:0 0 24px 24px; }
      }
      @media(max-width: 600px) {
        .fc-row { flex-direction:column; gap:8px; }
        .fc-label { margin-top:0; width:100%; }
        .fc-auto-group { grid-template-columns:1fr; }
        .fc-modal { margin:0; height:100vh; max-height:100vh; border-radius:0; border:none; }
      }
    `;
    document.head.appendChild(style);
  }

  let state = {
    title: '',
    client: '',
    format: '',
    veic: '',
    prazo: '',
    brief: '',
    assignees: [],
    materialReady: false,
    briefReady: false,
    manualGroup: undefined,
    manualStatus: undefined,
    manualCap: undefined
  };

  function updateDestinyUI() {
     if(typeof cadastrosDestiny !== 'function') return;
     const formatName = state.format || 'Formato Padrão';
     const dest = cadastrosDestiny(formatName, state.briefReady, state.materialReady, state.assignees);
     
     if(state.manualGroup === undefined) {
         const groups = { 'group_title': 'Redação', 'novo_grupo__1': 'Design & Edição', 'novo_grupo57911__1': 'Produção (Foto e Vídeo)' };
         fcSelectDropdown('manualGroup', dest.group, groups[dest.group] || dest.group, null, false);
     }
     
     if(state.manualStatus === undefined) {
         const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
         const col = c[dest.status] ? c[dest.status].color : '#8888a8';
         fcSelectDropdown('manualStatus', dest.status, dest.status, {color: col}, false);
     }
     
     if(state.manualCap === undefined) {
         const capVal = dest.capture ? 'Agendar Captação' : '';
         const capText = capVal || '- Nenhuma -';
         const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
         const col = capVal && c[capVal] ? c[capVal].color : null;
         fcSelectDropdown('manualCap', capVal, capText, col ? {color: col} : null, false);
     }
     
     updateLivePreview(dest);
  }
  
  function updateLivePreview(dest) {
     const titleEl = document.getElementById('fc-prev-title');
     const clientEl = document.getElementById('fc-prev-client');
     const groupEl = document.getElementById('fc-prev-group');
     const statusEl = document.getElementById('fc-prev-status');
     const datesEl = document.getElementById('fc-prev-dates');
     const usersEl = document.getElementById('fc-prev-users');
     
     if(!titleEl) return;
     
     const formatText = state.format || 'Formato';
     const titleText = state.title || 'Título pendente';
     titleEl.textContent = `${formatText} - ${titleText}`;
     clientEl.textContent = state.client || 'Cliente não selecionado';
     
     const groups = { 'group_title': 'Redação', 'novo_grupo__1': 'Design & Edição', 'novo_grupo57911__1': 'Produção (Foto e Vídeo)' };
     const finalGroup = state.manualGroup !== undefined ? state.manualGroup : dest.group;
     const finalGroupLabel = groups[finalGroup] || 'Redação';
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : dest.status;
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');
     
     groupEl.textContent = finalGroupLabel;
     
     const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
     const bgStatus = c[finalStatus] ? c[finalStatus].bg : 'rgba(255,255,255,0.1)';
     const txtStatus = c[finalStatus] ? c[finalStatus].color : '#fff';
     const brdStatus = c[finalStatus] ? c[finalStatus].border : 'rgba(255,255,255,0.2)';
     let statusesHtml = `<span class="fc-prev-tag" style="background:${bgStatus}; color:${txtStatus}; border-color:${brdStatus};">${esc(finalStatus)}</span>`;
     
     if (finalCap) {
         const bgCap = c[finalCap] ? c[finalCap].bg : 'rgba(246,191,58,0.1)';
         const txtCap = c[finalCap] ? c[finalCap].color : '#f6bf3a';
         const brdCap = c[finalCap] ? c[finalCap].border : 'rgba(246,191,58,0.2)';
         statusesHtml += `<span class="fc-prev-tag" style="background:${bgCap}; color:${txtCap}; border-color:${brdCap};">CAPTAÇÃO: ${esc(finalCap)}</span>`;
     }
     statusEl.innerHTML = statusesHtml;
     
     datesEl.innerHTML = state.veic ? `Veiculação: ${state.veic.split('-').reverse().join('/')}` : 'Prazos pendentes';
     
     const users = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
     const assignedUsers = dest.assignees.map(id => users.find(u => String(u.id) === String(id))).filter(Boolean);
     
     if (assignedUsers.length) {
         usersEl.innerHTML = assignedUsers.map(u => {
             const avatar = u.photo ? `<img src="${u.photo}">` : `<span>${u.name[0]}</span>`;
             return `<div class="fc-avatar" style="background:${u.color}" title="${esc(u.name)}">${avatar}</div>`;
         }).join('');
     } else {
         usersEl.textContent = 'Definido na Triagem';
     }
  }

  window.fcHandleInput = function(key, val) {
     if(isManual) state[key] = val;
     
     if(key === 'veic' && val) {
        state.prazo = getOffsetDate(val, -7);
        const pEl = document.getElementById('fc-prazo');
        if(pEl) pEl.value = state.prazo;
     }

     updateDestinyUI();
  };
  
  window.fcTogglePerson = function(id) {
     if(state.assignees.includes(id)) {
        state.assignees = state.assignees.filter(x => x !== id);
     } else {
        state.assignees.push(id);
     }
     renderPersons();
     updateDestinyUI();
  };

  function renderPersons() {
     const container = document.getElementById('fc-persons-container');
     if(!container) return;
     const users = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
     container.innerHTML = users.map(u => {
        const active = state.assignees.includes(u.id);
        const avatar = u.photo ? `<img src="${u.photo}">` : `<span>${u.name[0]}</span>`;
        return `
          <div class="fc-person-btn ${active?'active':''}" onclick="fcTogglePerson('${u.id}')">
             <div class="fc-avatar" style="background:${u.color}">${avatar}</div>
             ${u.name.split(' ')[0]}
          </div>
        `;
     }).join('');
  }

  window.fcSubmit = async function() {
     const title = document.getElementById('fc-title').value.trim();
     state.title = title; // ensure sync
     
     // Visual validation
     document.querySelectorAll('.fc-error-pulse').forEach(el => el.classList.remove('fc-error-pulse'));
     let hasError = false;
     
     if(!title) { document.getElementById('fc-title').classList.add('fc-error-pulse'); hasError = true; }
     if(!state.client) { document.getElementById('fc-client-input').classList.add('fc-error-pulse'); hasError = true; }
     if(!state.format) { document.getElementById('fc-format-input').classList.add('fc-error-pulse'); hasError = true; }
     if(!state.veic) { document.getElementById('fc-veic-input').classList.add('fc-error-pulse'); hasError = true; }
     if(!state.prazo) { document.getElementById('fc-prazo').classList.add('fc-error-pulse'); hasError = true; }
     if(!state.brief) { document.getElementById('fc-brief-input').classList.add('fc-error-pulse'); hasError = true; }
     
     if(hasError) {
        return typeof showToast === 'function' ? showToast('Preencha os campos obrigatórios destacados em vermelho.', 'info') : alert('Preencha os campos obrigatórios.');
     }
     
     const finalGroup = state.manualGroup !== undefined ? state.manualGroup : dest.group;
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : dest.status;
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');
     
     const dest = cadastrosDestiny(state.format, state.briefReady, state.materialReady, state.assignees);
     const normalized = `${state.format} - ${title}`;
     
     const btn = document.getElementById('fc-submit-btn');
     btn.disabled = true;
     btn.textContent = 'CRIANDO...';

     const values = {
        lista_suspensa_mkmqnjbv: {labels:[state.client]},
        lista_suspensa0__1: {labels:[state.format]},
        lista_suspensa__1: {index:3},
        data__1: {date:state.veic},
        data: {date:state.prazo},
        status: {label:finalStatus},
        person: {personsAndTeams:dest.assignees.map(id=>({id:Number(id),kind:'person'}))}
     };
     if(finalCap) values.status_1__1 = {label:finalCap};

     try {
        const create = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;
        const response = await mondayQuery(create, {board:String(BOARD_ID), group:finalGroup, name:normalized, values:JSON.stringify(values)});
        const itemId = response?.create_item?.id;
        if(!itemId) throw new Error('Falha ao obter ID');

        const hellen = state.client.toLowerCase().includes('hellen rocha') ? '<li>✅ Validar informações jurídicas com a Hellen antes de publicar</li>' : '';
        const captureLine = finalCap ? `<li>📸 Agendar e confirmar captação externa</li>` : '';
        const update = `<p><strong>🚀 CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${esc(state.brief)}</p><ul><li>✅ Revisar copy e adaptar ao tom da marca</li><li>✅ Selecionar referências visuais / banco de imagens</li><li>✅ Montar layout no padrão do cliente</li>${captureLine}<li>✅ Enviar para aprovação antes de publicar</li>${hellen}</ul>`;
        
        await mondayQuery(`mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {item:String(itemId), body:update});

        if(typeof showToast === 'function') showToast('Conteúdo criado com sucesso!', 'ok');
        fcCloseModal();
        if(typeof refreshData === 'function') await refreshData();
     } catch (e) {
        btn.disabled = false;
        btn.textContent = 'CRIAR CONTEÚDO';
        if(typeof showToast === 'function') showToast(`Erro: ${e.message}`, 'err');
     }
  };

  window.fcToggleDropdown = function(id) {
       const list = document.getElementById(id);
       const isOpen = list.classList.contains('open');
       document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
       if(!isOpen) list.classList.add('open');
    };
    
    window.fcSelectDropdown = function(key, val, text, colorObj, isManual = true) {
       state[key] = val;
       document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
       
       const valEl = document.getElementById('fc-val-' + key);
       if(valEl) {
           valEl.textContent = text;
           if(colorObj) {
               valEl.style.background = colorObj.color;
               valEl.style.color = '#fff';
               if(colorObj.color === '#c4c4c4' || colorObj.color === '#ffcb00') valEl.style.color = '#000';
               valEl.style.border = 'none';
           } else {
               valEl.style.background = 'rgba(0,0,0,0.3)';
               valEl.style.color = '#fff';
               valEl.style.border = '1px solid rgba(255,255,255,0.1)';
           }
       }
       updateDestinyUI();
    };

    window.openCadastrosGoverned = function() {
    ensureFastCadastrosStyles();
    
    const existing = document.getElementById('fc-overlay');
    if(existing) existing.remove();

    state = { title: '', client: '', format: '', veic: '', prazo: '', brief: '', assignees: [], materialReady: false, briefReady: false, manualGroup: undefined, manualStatus: undefined, manualCap: undefined };
    
    function renderCustomDropdowns() {
        const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
        const getCol = (s) => c[s] || { color:'#8888a8' };
        
        const groups = [
           { val: 'group_title', label: 'Redação' },
           { val: 'novo_grupo__1', label: 'Design & Edição' },
           { val: 'novo_grupo57911__1', label: 'Produção (Foto e Vídeo)' }
        ];
        
        const statuses = ['A Fazer', 'Pode Fazer', 'Falta D.A', 'Ag. Aprovação Cliente', 'Agendado'];
        const caps = ['', 'Agendar Captação', 'A Fazer'];
        
        const html = `
           <div class="fc-auto-col" id="col-manualGroup">
              <label>Grupo / Destino</label>
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualGroup" onclick="fcToggleDropdown('fc-list-group')">Redação</div>
                 <div class="fc-dropdown-list" id="fc-list-group">
                    ${groups.map(g => `<div class="fc-dropdown-item" onclick="fcSelectDropdown('manualGroup', '${g.val}', '${g.label}')" style="color:#fff">${g.label}</div>`).join('')}
                 </div>
              </div>
           </div>
           
           <div class="fc-auto-col" id="col-manualStatus">
              <label>Status Inicial</label>
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualStatus" onclick="fcToggleDropdown('fc-list-status')" style="background:#c4c4c4; color:#000; border:none;">A Fazer</div>
                 <div class="fc-dropdown-list" id="fc-list-status">
                    ${statuses.map(s => {
                        const col = getCol(s).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('manualStatus', '${s}', '${s}', {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${s}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>
           
           <div class="fc-auto-col" id="col-manualCap">
              <label>Captação Externa</label>
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualCap" onclick="fcToggleDropdown('fc-list-cap')">- Nenhuma -</div>
                 <div class="fc-dropdown-list" id="fc-list-cap">
                    ${caps.map(s => {
                        if(!s) return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('manualCap', '', '- Nenhuma -')" style="color:#849aa6; margin-bottom:4px;">- Nenhuma -</div>`;
                        const col = getCol(s).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('manualCap', '${s}', '${s}', {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${s}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>
        `;
        
        document.getElementById('fc-auto-group-container').innerHTML = html;
        
        // global click to close
        document.getElementById('fc-overlay').addEventListener('click', (e) => {
            if(!e.target.closest('.fc-custom-dropdown')) {
                document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
            }
        });
    }
    
    const clients = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const formats = typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories'];

    const overlay = document.createElement('div');
    overlay.id = 'fc-overlay';
    overlay.className = 'fc-overlay';
    overlay.onclick = e => { if(e.target === overlay) fcCloseModal(); };

    overlay.innerHTML = `
      <div class="fc-modal">
         
         <!-- LEFT COLUMN: FORM -->
         <div class="fc-main-col">
             <div class="fc-header">
                <div class="fc-kicker">CADASTRO RÁPIDO</div>
                <input type="text" id="fc-title" class="fc-title-input" placeholder="Título do Conteúdo..." autofocus oninput="fcHandleInput('title', this.value)">
             </div>
             
             <div class="fc-body">
                <div class="fc-row">
                   <div class="fc-label">Cliente</div>
                   <div class="fc-input-wrap">
                      <select class="fc-input" id="fc-client-input" onchange="fcHandleInput(\'client\', this.value)">
                         <option value="">Selecionar cliente...</option>
                         ${clients.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
                      </select>
                   </div>
                </div>

                <div class="fc-row">
                   <div class="fc-label">Formato</div>
                   <div class="fc-input-wrap">
                      <select class="fc-input" id="fc-format-input" onchange="fcHandleInput(\'format\', this.value)">
                         <option value="">Selecionar formato...</option>
                         ${formats.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
                      </select>
                   </div>
                </div>

                <div class="fc-row">
                   <div class="fc-label">Equipe Extra</div>
                   <div class="fc-input-wrap">
                      <div class="fc-persons" id="fc-persons-container"></div>
                   </div>
                </div>
                
                <div class="fc-auto-group" id="fc-auto-group-container">
       <!-- Populated by JS -->
    </div>

                <div class="fc-row">
                   <div class="fc-label">Instruções</div>
                   <div class="fc-input-wrap">
                      <textarea class="fc-input" id="fc-brief-input" placeholder="Objetivo, referência ou contexto do conteúdo..." onchange="fcHandleInput(\'brief\', this.value)"></textarea>
                      
                      <div class="fc-checkbox-group">
                         <label class="fc-checkbox-row">
                            <input type="checkbox" onchange="fcHandleInput('briefReady', this.checked)">
                            <span>O briefing está 100% pronto (pular Redação)</span>
                         </label>
                         <label class="fc-checkbox-row">
                            <input type="checkbox" onchange="fcHandleInput('materialReady', this.checked)">
                            <span>O material bruto já foi fornecido (ignorar Captação)</span>
                         </label>
                      </div>
                   </div>
                </div>

             </div>
             
             <div class="fc-footer">
                <button class="fc-btn-cancel" onclick="fcCloseModal()">CANCELAR</button>
                <button class="fc-btn-create" id="fc-submit-btn" onclick="fcSubmit()">CRIAR CONTEÚDO</button>
             </div>
         </div>
         
         <!-- RIGHT COLUMN: LIVE PREVIEW -->
         <div class="fc-side-col">
             <button class="fc-close" onclick="fcCloseModal()">×</button>
             
             <div class="fc-side-title">PRÉVIA DE DESTINO</div>
             
             <div class="fc-preview-card">
                 <div class="fc-prev-head">
                    <b id="fc-prev-title">Formato - Título pendente</b>
                    <span id="fc-prev-client">Cliente não selecionado</span>
                 </div>
                 
                 <div class="fc-prev-body">
                    <div class="fc-prev-item">
                       <small>Alojamento Operacional</small>
                       <div id="fc-prev-group">Redação</div>
                    </div>
                    
                    <div class="fc-prev-item">
                       <small>Prazos</small>
                       <div id="fc-prev-dates">Prazos pendentes</div>
                    </div>
                    
                    <div class="fc-prev-item">
                       <small>Equipe Atribuída</small>
                       <div class="fc-prev-users" id="fc-prev-users">
                          Definido na Triagem
                       </div>
                    </div>
                    
                    <div class="fc-prev-item">
                       <small>Sinalização Visual</small>
                       <div id="fc-prev-status">
                          <span class="fc-prev-tag" style="background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2);">A FAZER</span>
                       </div>
                    </div>
                 </div>
             </div>
             
             <div class="fc-helper-text">
                O cartão acima reflete como a demanda chegará na visão da equipe, considerando o formato escolhido e as regras de entrada (automações).
             </div>
         </div>
         
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
       overlay.classList.add('open');
       renderCustomDropdowns();
       renderPersons();
       updateDestinyUI();
       
       // Bind title input live update safely
       overlay.addEventListener('keydown', function(e) {
           if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
               e.preventDefault();
               fcSubmit();
           }
       });
       
       document.getElementById('fc-title').addEventListener('input', function(e) {
           fcHandleInput('title', e.target.value);
       });
    });
  };

  window.fcCloseModal = function() {
    const existing = document.getElementById('fc-overlay');
    if(existing) {
       existing.classList.remove('open');
       setTimeout(() => existing.remove(), 300);
    }
  };

  window.showCadastrosPreview = () => window.openCadastrosGoverned();

})();
