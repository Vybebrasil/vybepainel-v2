/* Vybe OS — Cadastro Rápido (Estilo Monday) */
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
      .fc-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:20000; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.2s; }
      .fc-overlay.open { opacity:1; }
      
      .fc-modal { background:#1e1e24; width:520px; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.5); font-family:var(--mac-ui, sans-serif); overflow:hidden; transform:scale(0.95); transition:transform 0.2s; }
      .fc-overlay.open .fc-modal { transform:scale(1); }

      .fc-header { padding:24px 32px 16px; display:flex; justify-content:space-between; align-items:center; }
      .fc-title-input { background:transparent; border:none; color:#fff; font:700 22px var(--mac-ui, sans-serif); width:100%; outline:none; }
      .fc-title-input::placeholder { color:#849aa6; }
      .fc-close { background:transparent; border:none; color:#849aa6; font-size:24px; cursor:pointer; line-height:1; }
      .fc-close:hover { color:#fff; }

      .fc-body { padding:16px 32px; display:flex; flex-direction:column; gap:12px; max-height:70vh; overflow-y:auto; scrollbar-width:thin; }
      
      .fc-row { display:flex; align-items:center; min-height:40px; }
      .fc-label { width:160px; display:flex; align-items:center; gap:8px; color:#c3c6d4; font-size:13px; font-weight:500; flex-shrink:0; }
      .fc-label .fc-icon { width:20px; height:20px; border-radius:4px; display:flex; justify-content:center; align-items:center; font-size:12px; }
      
      .fc-input-wrap { flex:1; position:relative; }
      .fc-input { width:100%; background:#2a2b33; border:1px solid transparent; color:#fff; font-size:13px; padding:10px 12px; border-radius:6px; outline:none; transition:all 0.2s; }
      .fc-input:hover { background:#32333d; }
      .fc-input:focus { border-color:#0085ff; background:#2a2b33; }
      
      select.fc-input { appearance:none; cursor:pointer; }
      
      .fc-read-only { background:#2a2b33; color:#c3c6d4; padding:10px 12px; border-radius:6px; font-size:13px; display:flex; align-items:center; gap:8px; }
      .fc-read-only .fc-dot { width:8px; height:8px; border-radius:50%; }

      .fc-persons { display:flex; gap:4px; flex-wrap:wrap; background:#2a2b33; padding:6px; border-radius:6px; min-height:40px; }
      .fc-person-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:4px 10px 4px 4px; display:flex; align-items:center; gap:6px; color:#c3c6d4; font-size:12px; cursor:pointer; transition:all 0.2s; }
      .fc-person-btn:hover { background:rgba(255,255,255,0.1); }
      .fc-person-btn.active { background:rgba(0,133,255,0.2); border-color:#0085ff; color:#fff; }
      .fc-avatar { width:20px; height:20px; border-radius:50%; overflow:hidden; display:flex; justify-content:center; align-items:center; font-size:10px; font-weight:bold; color:#fff; }
      .fc-avatar img { width:100%; height:100%; object-fit:cover; }

      .fc-footer { padding:16px 32px 24px; display:flex; justify-content:flex-end; gap:12px; border-top:1px solid rgba(255,255,255,0.05); margin-top:16px; }
      .fc-btn-cancel { background:transparent; border:none; color:#c3c6d4; font-size:14px; cursor:pointer; padding:8px 16px; }
      .fc-btn-cancel:hover { color:#fff; }
      .fc-btn-create { background:#0085ff; color:#fff; border:none; padding:10px 24px; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; transition:background 0.2s; }
      .fc-btn-create:hover { background:#0074e0; }
      .fc-btn-create:disabled { opacity:0.5; cursor:not-allowed; }
      
      textarea.fc-input { resize:vertical; min-height:60px; line-height:1.4; }
      
      .fc-checkbox-row { display:flex; align-items:center; gap:8px; margin-top:8px; cursor:pointer; }
      .fc-checkbox-row input { accent-color:#0085ff; width:16px; height:16px; cursor:pointer; }
      .fc-checkbox-row span { color:#c3c6d4; font-size:13px; }
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
    briefReady: false
  };

  function updateDestinyUI() {
     if(typeof cadastrosDestiny !== 'function') return;
     const formatName = state.format || 'Formato Padrão';
     const dest = cadastrosDestiny(formatName, state.briefReady, state.materialReady, state.assignees);
     
     const elGroup = document.getElementById('fc-group-val');
     if(elGroup) elGroup.innerHTML = `<div class="fc-dot" style="background:#ff9d00"></div> ${dest.groupLabel}`;
     
     const elStatus = document.getElementById('fc-status-val');
     if(elStatus) elStatus.textContent = dest.status;
     
     const elCap = document.getElementById('fc-cap-val');
     if(elCap) elCap.textContent = dest.capture ? 'A Fazer' : '-';
  }

  window.fcHandleInput = function(key, val) {
     state[key] = val;
     
     // Auto-calculate prazo based on veic
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
     if(!title || !state.client || !state.format || !state.veic || !state.prazo || !state.brief) {
        return typeof showToast === 'function' ? showToast('Preencha título, cliente, formato, datas e briefing.', 'info') : alert('Faltam campos');
     }
     
     const dest = cadastrosDestiny(state.format, state.briefReady, state.materialReady, state.assignees);
     const normalized = `${state.format} - ${title}`;
     
     const btn = document.getElementById('fc-submit-btn');
     btn.disabled = true;
     btn.textContent = 'Criando...';

     const values = {
        lista_suspensa_mkmqnjbv: {labels:[state.client]},
        lista_suspensa0__1: {labels:[state.format]},
        lista_suspensa__1: {index:3}, // Some priority or step field? from old logic
        data__1: {date:state.veic},
        data: {date:state.prazo},
        status: {label:dest.status},
        person: {personsAndTeams:dest.assignees.map(id=>({id:Number(id),kind:'person'}))}
     };
     if(dest.capture) values.status_1__1 = {label:'Agendar Captação'};

     try {
        const create = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;
        const response = await mondayQuery(create, {board:String(BOARD_ID), group:dest.group, name:normalized, values:JSON.stringify(values)});
        const itemId = response?.create_item?.id;
        if(!itemId) throw new Error('Falha ao obter ID');

        const hellen = state.client.toLowerCase().includes('hellen rocha') ? '<li>✅ Validar informações jurídicas com a Hellen antes de publicar</li>' : '';
        const captureLine = dest.capture ? `<li>📸 Agendar e confirmar captação externa</li>` : '';
        const update = `<p><strong>🚀 CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${esc(state.brief)}</p><ul><li>✅ Revisar copy e adaptar ao tom da marca</li><li>✅ Selecionar referências visuais / banco de imagens</li><li>✅ Montar layout no padrão do cliente</li>${captureLine}<li>✅ Enviar para aprovação antes de publicar</li>${hellen}</ul>`;
        
        await mondayQuery(`mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {item:String(itemId), body:update});

        if(typeof showToast === 'function') showToast('Conteúdo criado com sucesso!', 'ok');
        closeCadastrosGoverned();
        if(typeof refreshData === 'function') await refreshData();
     } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Criar Conteúdo';
        if(typeof showToast === 'function') showToast(`Erro: ${e.message}`, 'err');
     }
  };

  window.openCadastrosGoverned = function() {
    ensureFastCadastrosStyles();
    
    const existing = document.getElementById('fc-overlay');
    if(existing) existing.remove();

    // Reset state
    state = { title: '', client: '', format: '', veic: '', prazo: '', brief: '', assignees: [], materialReady: false, briefReady: false };
    
    const clients = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const formats = typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories'];

    const overlay = document.createElement('div');
    overlay.id = 'fc-overlay';
    overlay.className = 'fc-overlay';
    overlay.onclick = e => { if(e.target === overlay) closeCadastrosGoverned(); };

    overlay.innerHTML = `
      <div class="fc-modal">
         <div class="fc-header">
            <input type="text" id="fc-title" class="fc-title-input" placeholder="Novo Conteúdo..." autofocus>
            <button class="fc-close" onclick="closeCadastrosGoverned()">×</button>
         </div>
         <div class="fc-body">
            
            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#ff9d0033; color:#ff9d00;">🗂️</div> Grupo</div>
               <div class="fc-input-wrap"><div class="fc-read-only" id="fc-group-val"><div class="fc-dot" style="background:#ff9d00"></div> Design & Edição</div></div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#00d18433; color:#00d184;">💼</div> Cliente</div>
               <div class="fc-input-wrap">
                  <select class="fc-input" onchange="fcHandleInput('client', this.value)">
                     <option value="">Selecionar cliente...</option>
                     ${clients.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
                  </select>
               </div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#b493ff33; color:#b493ff;">🎨</div> Formato</div>
               <div class="fc-input-wrap">
                  <select class="fc-input" onchange="fcHandleInput('format', this.value)">
                     <option value="">Selecionar formato...</option>
                     ${formats.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
                  </select>
               </div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#0085ff33; color:#0085ff;">👤</div> Responsável</div>
               <div class="fc-input-wrap">
                  <div class="fc-persons" id="fc-persons-container"></div>
               </div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#e4e6f133; color:#e4e6f1;">📊</div> Status</div>
               <div class="fc-input-wrap"><div class="fc-read-only" id="fc-status-val">A Fazer</div></div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#00d18433; color:#00d184;">🎥</div> Captação</div>
               <div class="fc-input-wrap"><div class="fc-read-only" id="fc-cap-val">-</div></div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#b493ff33; color:#b493ff;">📅</div> Veiculação</div>
               <div class="fc-input-wrap">
                  <input type="date" class="fc-input" min="${todayIso()}" onchange="fcHandleInput('veic', this.value)">
               </div>
            </div>

            <div class="fc-row">
               <div class="fc-label"><div class="fc-icon" style="background:#b493ff33; color:#b493ff;">⏳</div> Prazo</div>
               <div class="fc-input-wrap">
                  <input type="date" id="fc-prazo" class="fc-input" min="${todayIso()}" onchange="fcHandleInput('prazo', this.value)">
               </div>
            </div>

            <div class="fc-row" style="align-items:flex-start; margin-top:8px;">
               <div class="fc-label" style="margin-top:10px;"><div class="fc-icon" style="background:#ff637a33; color:#ff637a;">📝</div> Briefing</div>
               <div class="fc-input-wrap">
                  <textarea class="fc-input" placeholder="Objetivo, referência ou contexto do conteúdo..." onchange="fcHandleInput('brief', this.value)"></textarea>
                  <label class="fc-checkbox-row">
                     <input type="checkbox" onchange="fcHandleInput('briefReady', this.checked)">
                     <span>O briefing está 100% pronto (não precisa de Redação)</span>
                  </label>
                  <label class="fc-checkbox-row">
                     <input type="checkbox" onchange="fcHandleInput('materialReady', this.checked)">
                     <span>O material bruto já foi fornecido (ignorar Captação)</span>
                  </label>
               </div>
            </div>

         </div>
         <div class="fc-footer">
            <button class="fc-btn-cancel" onclick="closeCadastrosGoverned()">Cancelar</button>
            <button class="fc-btn-create" id="fc-submit-btn" onclick="fcSubmit()">Criar Conteúdo</button>
         </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
       overlay.classList.add('open');
       renderPersons();
       updateDestinyUI();
    });
  };

  window.closeCadastrosGoverned = function() {
    const existing = document.getElementById('fc-overlay');
    if(existing) {
       existing.classList.remove('open');
       setTimeout(() => existing.remove(), 200);
    }
  };

  window.showCadastrosPreview = () => window.openCadastrosGoverned();

})();
