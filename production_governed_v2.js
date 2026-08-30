/* Vybe OS — Produção Governada v2 (Apple Glassmorphism Calendário) */
(function() {
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  window.productionV2View = window.productionV2View || 'feed';

  window.setProdV2View = function(view) {
      window.productionV2View = view;
      if(typeof renderProductionCommand === 'function') renderProductionCommand();
  };

  function ensureProductionV2Styles() {
    if(document.getElementById('prod-v2-styles-cal')) return;
    const style = document.createElement('style');
    style.id = 'prod-v2-styles-cal';
    style.textContent = `
      .prod-v2-layout { display:flex; flex-direction:column; gap:24px; padding:24px 32px; max-width:1400px; margin:0 auto; animation:fadeIn 0.3s ease; height: 100%; }
      @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      
      .prod-v2-head { display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px; width: 100%; text-align: left; }
        .prod-v2-head > * { text-align: left; }
        .p-head-title { flex: 1; display: flex; flex-direction: column; align-items: flex-start; }
      .p-head-title h3 { margin:0; font:800 28px/1.2 var(--mac-ui, sans-serif); color:#fff; letter-spacing:-0.5px; }
      .p-head-title p { margin:6px 0 0; color:#9cafba; font:500 13px var(--mac-ui, sans-serif); }
      
      .p-controls-row { display:flex; gap:16px; align-items:center; }
      .p-segment { display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:4px; gap:4px; }
      .p-segment button { background:transparent; border:none; color:#849aa6; font:600 12px var(--mac-ui, sans-serif); padding:8px 16px; border-radius:6px; cursor:pointer; transition:all 0.2s; }
      .p-segment button:hover { color:#fff; background:rgba(255,255,255,0.05); }
      .p-segment button.active { background:rgba(255,255,255,0.15); color:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.2); }
      
      /* Feed View */
      .prod-v2-dates { display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; }
      .prod-v2-date-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px 20px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:6px; min-width:160px; height:80px; cursor:pointer; position:relative; overflow:hidden; transition:all 0.2s; flex-shrink: 0; box-sizing: border-box; }
      .prod-v2-date-btn:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.2); transform:translateY(-2px); }
      .prod-v2-date-btn.active { background:rgba(0,240,255,0.05); border-color:#00f0ff; box-shadow:0 10px 30px rgba(0,240,255,0.1); }
      .prod-v2-date-btn.today { border-top:3px solid #00f0ff; }
      .p-day { font:800 12px monospace; color:#b8d7df; }
      .p-date { font:600 16px var(--mac-ui, sans-serif); color:#fff; }
      .p-badge-cap { background:rgba(246,191,58,0.2); color:#f6bf3a; font:800 9px monospace; padding:2px 6px; border-radius:4px; margin-top:4px; width:fit-content; }
      .p-count { position:absolute; top:12px; right:12px; font:700 12px var(--mac-ui, sans-serif); color:#627885; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px; }
      .prod-v2-date-btn.active .p-day { color:#00f0ff; }
      
      .prod-v2-feed { display:flex; flex-direction:column; gap:12px; padding-bottom:40px; }
      .p-empty { padding:40px; text-align:center; color:#627885; font:600 14px var(--mac-ui, sans-serif); background:rgba(0,0,0,0.2); border-radius:16px; border:1px dashed rgba(255,255,255,0.1); }
      
      .prod-v2-card { display:flex; align-items:center; gap:16px; background:radial-gradient(circle at right, rgba(255,255,255,0.03), transparent 60%), rgba(10,15,20,0.6); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.06); border-left:4px solid var(--st-color); border-radius:12px; padding:16px 20px; cursor:pointer; transition:all 0.2s; }
      .prod-v2-card:hover { transform:translateX(4px); background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.15); box-shadow:0 10px 30px rgba(0,0,0,0.5); }
      .prod-v2-card.is-capture { border-left-color:#f6bf3a; background:linear-gradient(90deg, rgba(246,191,58,0.05), transparent), rgba(10,15,20,0.6); }
      
      .p-card-left { flex-shrink:0; }
      .p-card-icon { width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center; font-size:20px; border:1px solid rgba(255,255,255,0.1); }
      .prod-v2-card.is-capture .p-card-icon { background:rgba(246,191,58,0.1); border-color:rgba(246,191,58,0.3); }
      
      .p-card-body { flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; }
      .p-card-body b { color:#fff; font:800 16px var(--mac-ui, sans-serif); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .p-client { color:#b8d7df; font:600 13px var(--mac-ui, sans-serif); }
      .p-context { color:#849aa6; font:500 12px var(--mac-ui, sans-serif); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%; }
      
      .p-card-right { display:flex; align-items:center; gap:16px; flex-shrink:0; }
      .p-tag-cap { font:800 10px monospace; color:#f6bf3a; border:1px solid rgba(246,191,58,0.3); padding:4px 8px; border-radius:6px; background:rgba(246,191,58,0.05); }
      .p-tag-status { font:800 11px var(--mac-ui, sans-serif); padding:6px 12px; border-radius:20px; border:1px solid; text-transform:uppercase; letter-spacing:0.5px; }
      .p-play-btn { background:rgba(0,0,0,0.3); border:1px solid currentColor; width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:14px; cursor:pointer; opacity:0.7; transition:all 0.2s; padding-left:4px; }
      .prod-v2-card:hover .p-play-btn { opacity:1; transform:scale(1.1); background:currentColor; color:#000 !important; }
      
      /* Calendar View */
      .prod-v2-cal-grid { display:flex; gap:12px; overflow-x:auto; flex:1; min-height:500px; padding-bottom:16px; scrollbar-width:thin; }
      .p-cal-col { flex:1; min-width:240px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; display:flex; flex-direction:column; transition:all 0.2s; }
      .p-cal-col.drag-over { background:rgba(0,240,255,0.05); border-color:#00f0ff; }
      .p-cal-col.today { border-top:3px solid #00f0ff; }
      
      .p-cal-col-head { padding:16px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; }
      .p-cal-col-head div { display:flex; flex-direction:column; }
      .p-cal-col-head b { font:800 14px monospace; color:#b8d7df; }
      .p-cal-col-head span { font:600 16px var(--mac-ui, sans-serif); color:#fff; }
      .p-cal-col-head button { background:rgba(0,240,255,0.1); border:1px solid rgba(0,240,255,0.3); color:#00f0ff; width:28px; height:28px; border-radius:50%; font-size:18px; line-height:1; display:flex; justify-content:center; align-items:center; cursor:pointer; transition:all 0.2s; }
      .p-cal-col-head button:hover { background:#00f0ff; color:#000; transform:scale(1.1); }
      
      .p-cal-col-body { padding:12px; display:flex; flex-direction:column; gap:10px; flex:1; overflow-y:auto; }
      
      .p-cal-card { background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-left:4px solid var(--st-color); border-radius:8px; padding:12px; cursor:grab; transition:transform 0.2s; }
      .p-cal-card:active { cursor:grabbing; transform:scale(0.98); }
      .p-cal-card:hover { border-color:rgba(255,255,255,0.2); }
      .p-cal-card.is-capture { border-left-color:#f6bf3a; background:linear-gradient(90deg, rgba(246,191,58,0.08), transparent); }
      
      .p-cal-card b { color:#fff; font:700 13px var(--mac-ui, sans-serif); display:block; margin-bottom:4px; line-height:1.2; }
      .p-cal-card span { color:#b8d7df; font:500 11px var(--mac-ui, sans-serif); display:block; }
      .p-cal-card .p-tag-status { margin-top:8px; display:inline-block; font-size:9px; padding:4px 8px; border-radius:4px; text-transform:uppercase; font-weight:800; letter-spacing:0.5px; }

      /* Drawer */
      .prod-v2-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:15000; opacity:0; transition:opacity 0.3s; }
      .prod-v2-overlay.open { opacity:1; }
      .prod-v2-drawer { position:absolute; top:0; right:0; width:min(500px, 90vw); height:100%; background:rgba(15,20,25,0.95); backdrop-filter:blur(24px) saturate(1.2); border-left:1px solid rgba(255,255,255,0.08); box-shadow:-20px 0 50px rgba(0,0,0,0.8); transform:translateX(100%); transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1); display:flex; flex-direction:column; }
      .prod-v2-overlay.open .prod-v2-drawer { transform:translateX(0); }
      
      .p-draw-head { padding:32px; border-bottom:1px solid rgba(255,255,255,0.06); position:relative; }
      .p-draw-close { position:absolute; top:16px; right:24px; background:transparent; border:none; color:#849aa6; font-size:28px; cursor:pointer; line-height:1; }
      .p-draw-close:hover { color:#fff; }
      .p-draw-title { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; padding-right:32px; }
      .p-draw-title span { font:800 10px monospace; color:#00f0ff; letter-spacing:1px; }
      .p-draw-title b { font:800 24px/1.2 var(--mac-ui, sans-serif); color:#fff; }
      .p-draw-meta { display:flex; gap:12px; }
      .p-draw-meta span { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#b8d7df; padding:4px 10px; border-radius:6px; font:600 12px var(--mac-ui, sans-serif); }
      
      .p-draw-body { flex:1; overflow-y:auto; padding:32px; display:flex; flex-direction:column; gap:32px; }
      
      .p-draw-status { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:16px; border-radius:12px; }
      .st-dot { width:12px; height:12px; border-radius:50%; background:var(--st-color); box-shadow:0 0 10px var(--st-color); }
      .p-draw-status b { color:var(--st-color); font:800 14px var(--mac-ui, sans-serif); flex:1; text-transform:uppercase; }
      .p-draw-status small { color:#849aa6; font:500 11px var(--mac-ui, sans-serif); }
      
      .p-draw-section { display:flex; flex-direction:column; gap:12px; }
      .p-draw-section > b { font:800 12px monospace; color:#627885; letter-spacing:0.5px; }
      .p-brief-box { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; color:#d9e2e5; font:500 14px/1.6 var(--mac-ui, sans-serif); white-space:pre-wrap; }
      .p-source { font:600 11px var(--mac-ui, sans-serif); color:#849aa6; text-align:right; }
      
      .prod-v2-checklist { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
      .prod-v2-checklist li { display:flex; gap:12px; align-items:flex-start; }
      .prod-v2-checklist i { width:24px; height:24px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-style:normal; font-size:12px; font-weight:800; flex-shrink:0; }
      .prod-v2-checklist li.pass i { background:rgba(0,209,132,0.1); color:#00d184; }
      .prod-v2-checklist li.fail i { background:rgba(255,191,98,0.1); color:#ffbf62; }
      .prod-v2-checklist div { display:flex; flex-direction:column; gap:2px; }
      .prod-v2-checklist b { color:#eef8fc; font:700 13px var(--mac-ui, sans-serif); }
      .prod-v2-checklist span { color:#849aa6; font:500 12px var(--mac-ui, sans-serif); line-height:1.4; }
      
      .p-draw-foot { padding:24px 32px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.2); }
      .p-btn-open { width:100%; background:#00f0ff; color:#000; border:none; padding:16px; border-radius:12px; font:800 14px var(--mac-ui, sans-serif); cursor:pointer; transition:all 0.2s; box-shadow:0 0 20px rgba(0,240,255,0.2); }
      .p-btn-open:hover { background:#33f3ff; box-shadow:0 0 30px rgba(0,240,255,0.4); transform:translateY(-2px); }

      /* Create Modal */
      .p-create-modal { background:#151a21; width:400px; padding:32px; border-radius:24px; border:1px solid rgba(255,255,255,0.1); margin:auto; display:flex; flex-direction:column; gap:20px; box-shadow:0 30px 60px rgba(0,0,0,0.8); }
      .p-create-modal h3 { margin:0; color:#fff; font:800 20px var(--mac-ui, sans-serif); }
      .p-create-modal p { margin:0; color:#9cafba; font:500 13px var(--mac-ui, sans-serif); }
      .p-create-modal input, .p-create-modal select { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px; border-radius:8px; font:600 14px var(--mac-ui, sans-serif); width:100%; }
      .p-create-modal input:focus, .p-create-modal select:focus { border-color:#00f0ff; outline:none; }
      .p-create-modal select option { background:#151a21; color:#fff; }
      .p-create-modal .p-btn-create { background:#00f0ff; color:#000; border:none; padding:14px; border-radius:8px; font:800 14px var(--mac-ui, sans-serif); cursor:pointer; transition:all 0.2s; }
      .p-create-modal .p-btn-create:hover { background:#33f3ff; }
      .p-create-modal .p-btn-cancel { background:transparent; color:#849aa6; border:none; cursor:pointer; font:600 13px var(--mac-ui, sans-serif); padding:8px; }
      
      @media(max-width:780px){
         .prod-v2-head { flex-direction:column; align-items:flex-start; gap:16px; }
         .p-controls-row { flex-wrap:wrap; }
         .prod-v2-card { flex-direction:column; align-items:flex-start; gap:12px; }
         .p-card-right { width:100%; justify-content:space-between; }
         .prod-v2-drawer { width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  // --- Drag and Drop API ---
  window.pCalAllowDrop = function(ev) {
      ev.preventDefault();
      ev.currentTarget.classList.add('drag-over');
  };
  window.pCalLeaveDrop = function(ev) {
      ev.currentTarget.classList.remove('drag-over');
  };
  window.pCalDrag = function(ev, itemId) {
      ev.dataTransfer.setData("text", itemId);
  };
  window.pCalDrop = async function(ev, iso) {
      ev.preventDefault();
      ev.currentTarget.classList.remove('drag-over');
      const itemId = ev.dataTransfer.getData("text");
      if(!itemId) return;

      const item = (typeof DADOS_ALL !== 'undefined' && DADOS_ALL ? DADOS_ALL.find(e => String(e.id) === String(itemId)) : null) || (typeof DADOS !== 'undefined' && DADOS ? DADOS.find(e => String(e.id) === String(itemId)) : null);
      if(!item) return;

      const col = typeof productionCommandDateMode !== 'undefined' && productionCommandDateMode === 'prazo' ? 'data' : 'data__1';

      if(typeof applyOutboundItemPatch === 'function') {
          if (col === 'data') applyOutboundItemPatch(itemId, {prazo_iso: iso}, 'drag drop calendar');
          else applyOutboundItemPatch(itemId, {veiculacao_iso: iso}, 'drag drop calendar');
      }

      if(typeof renderProductionCommand === 'function') renderProductionCommand();

      try {
          const alvo = (typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null) || { id: itemId };
          const pelaEscritaDupla = await tentarEscritaDupla(alvo, { acao: col === 'data' ? 'prazo' : 'veiculacao', item: String(itemId), data: iso });
          if (!pelaEscritaDupla) {
            const mutation = `mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
            await mondayQuery(mutation, { board: String(BOARD_ID), item: String(itemId), values: JSON.stringify({ [col]: {date: iso} }) });
          }
          if(typeof showToast === 'function') showToast(`Data atualizada para ${iso.split('-').reverse().join('/')}`, 'ok');
      } catch (e) {
          if(typeof showToast === 'function') showToast(`Erro ao atualizar data: ${e.message}`, 'err');
      }
  };

  // --- Create Appointment Modal ---
  window.pCalOpenNewModal = function(iso) {
      const existing = document.getElementById('prod-v2-overlay-create');
      if(existing) existing.remove();
      
      const clients = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];

      const overlay = document.createElement('div');
      overlay.id = 'prod-v2-overlay-create';
      overlay.className = 'prod-v2-overlay';
      overlay.innerHTML = `
         <div class="p-create-modal">
             <div>
                <h3>Novo Agendamento</h3>
                <p>Data: ${iso.split('-').reverse().join('/')}</p>
             </div>
             <input type="text" id="p-cap-title" placeholder="Nome do Conteúdo / Gravação" autofocus>
             <select id="p-cap-client">
                 <option value="Vybe Interno">Vybe Interno</option>
                 ${clients.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
             </select>
             <select id="p-cap-format">
                 <option value="Fotografia">Fotografia</option>
                 <option value="Vídeo">Vídeo</option>
                 <option value="Reels">Reels</option>
             </select>
             <button class="p-btn-create" onclick="pCalCreateItem('${iso}')">Agendar no Monday</button>
             <button class="p-btn-cancel" onclick="document.getElementById('prod-v2-overlay-create').remove()">Cancelar</button>
         </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
  };

  window.pCalCreateItem = async function(iso) {
      const title = document.getElementById('p-cap-title').value.trim();
      const client = document.getElementById('p-cap-client').value.trim();
      const format = document.getElementById('p-cap-format').value.trim();

      if(!title) return alert('Dê um nome para a gravação!');
      
      const btn = document.querySelector('.p-btn-create');
      btn.textContent = 'Criando...';
      btn.disabled = true;

      const normalized = `${format} - ${title}`;
      const group = 'novo_grupo57911__1';
      
      const values = {
          lista_suspensa_mkmqnjbv: {labels: [client]},
          lista_suspensa0__1: {labels: [format]},
          data__1: {date: iso},
          data: {date: iso},
          status_1__1: {label: 'Agendar Captação'},
          status: {label: 'A Fazer'}
      };

      try {
          const create = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;
          await mondayQuery(create, {board: String(BOARD_ID), group: group, name: normalized, values: JSON.stringify(values)});
          
          if(typeof showToast === 'function') showToast('Compromisso agendado com sucesso!', 'ok');
          document.getElementById('prod-v2-overlay-create').remove();
          if(typeof refreshData === 'function') await refreshData();
          if(typeof renderProductionCommand === 'function') renderProductionCommand();
      } catch (error) {
          btn.textContent = 'Tentar novamente';
          btn.disabled = false;
          if(typeof showToast === 'function') showToast(`Erro ao criar: ${error.message}`, 'err');
      }
  };


  window.renderProductionCommand = function() {
    ensureProductionV2Styles();
    const root = document.getElementById('production-command-dashboard');
    const banner = document.getElementById('production-command-banner');
    if (banner) banner.style.display = 'none';
    if(!root) return;

    const all = typeof productionCommandItems === 'function' ? productionCommandItems() : [];
    const dates = typeof productionCommandDates === 'function' ? productionCommandDates() : [];
    
    all.sort((a,b) => {
        const rank = {blocked:0, brief:1, ready:2, scheduled:3, executing:4, approval:5};
        return (rank[productionCommandReadiness(a).key] || 0) - (rank[productionCommandReadiness(b).key] || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });

    let contentHtml = '';

    if (window.productionV2View === 'feed') {
        const focus = typeof productionCommandFocusDate !== 'undefined' && productionCommandFocusDate && dates.includes(productionCommandFocusDate) ? productionCommandFocusDate : (dates.find(iso => all.some(item => productionCommandReference(item) === iso)) || dates[0]);
        if(typeof productionCommandFocusDate !== 'undefined') productionCommandFocusDate = focus;
        const focused = all.filter(item => productionCommandReference(item) === focus);

        
          const dateRail = dates.map(iso => {
             const list = all.filter(item => productionCommandReference(item) === iso);
             // Count items that are captacao
             const capture = list.filter(item => {
                 const ic = productionCommandKind(item).icon;
                 return ic === '📸' || ic === '🎥' || ic === '?' || ic === '?';
             }).length;
             const active = iso === focus;
             const isToday = typeof HOJE_ISO !== 'undefined' && iso === HOJE_ISO;
             
             // Safely generate day of week
             const d = new Date(iso + 'T12:00:00');
             const days = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
             const dayStr = days[d.getDay()];
             
             return `
               <button class="prod-v2-date-btn ${active?'active':''} ${isToday?'today':''}" onclick="productionCommandSetDate('${iso}')">
                 <span class="p-day">${dayStr}</span>
                 <span class="p-date">${iso.split('-').slice(1).reverse().join('/')}</span>
                 ${capture ? `<span class="p-badge-cap">${capture} CAPTAÇÃO</span>` : ''}
                 <span class="p-count">${list.length}</span>
               </button>
             `;
          }).join('');


        const feed = focused.map(item => {
           const readiness = productionCommandReadiness(item);
           const kind = productionCommandKind(item);
           const owner = productionCommandOwner(item);
           const isCapture = ['📸','🎥'].includes(kind.icon);

           return `
             <div class="prod-v2-card ${isCapture?'is-capture':''}" onclick="openProductionSheet('${item.id}')" style="--st-color:${readiness.color}">
               <div class="p-card-left">
                 <div class="p-card-icon">${kind.icon}</div>
               </div>
               <div class="p-card-body">
                 <b>${esc(item.nome)}</b>
                 <span class="p-client">${esc(item.cliente)} · ${esc(owner)}</span>
                 <span class="p-context">${esc(readiness.copy)}</span>
               </div>
               <div class="p-card-right">
                  ${isCapture ? `<span class="p-tag-cap">Gravação</span>` : ''}
                  <span class="p-tag-status" style="color:${readiness.color}; background:${readiness.color}15; border-color:${readiness.color}30;">${esc(readiness.label)}</span>
                  <button class="p-play-btn" style="color:${readiness.color}">▶</button>
               </div>
             </div>
           `;
        }).join('');

        contentHtml = `
           <nav class="prod-v2-dates">
              ${dateRail}
           </nav>
           <main class="prod-v2-feed">
              ${feed || `<div class="p-empty">Nada agendado para esta data. Use a Visão de Calendário para criar novos agendamentos ou arrastar cards para cá.</div>`}
           </main>
        `;
    } 
    else if (window.productionV2View === 'calendar') {
        const gridCols = dates.map(iso => {
           const list = all.filter(item => productionCommandReference(item) === iso);
           const isToday = typeof HOJE_ISO !== 'undefined' && iso === HOJE_ISO;
           const ddmm = iso.split('-').slice(1).reverse().join('/');
           const dayOfWeek = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase();
           
           const cards = list.map(item => {
               const readiness = productionCommandReadiness(item);
               const kind = productionCommandKind(item);
               const isCapture = ['📸','🎥'].includes(kind.icon);
               return `
                 <div class="p-cal-card ${isCapture?'is-capture':''}" style="--st-color:${readiness.color}" draggable="true" ondragstart="pCalDrag(event, '${item.id}')" onclick="openProductionSheet('${item.id}')">
                    <b>${esc(item.nome)}</b>
                    <span>${esc(item.cliente)}</span>
                    <span class="p-tag-status" style="color:${readiness.color}; background:${readiness.color}15; border-color:${readiness.color}30;">${esc(readiness.label)}</span>
                 </div>
               `;
           }).join('');

           return `
             <div class="p-cal-col ${isToday?'today':''}" data-iso="${iso}" ondragover="pCalAllowDrop(event)" ondragleave="pCalLeaveDrop(event)" ondrop="pCalDrop(event, '${iso}')">
                <div class="p-cal-col-head">
                   <div>
                      <b>${dayOfWeek}</b>
                      <span>${ddmm}</span>
                   </div>
                   <button onclick="pCalOpenNewModal('${iso}')" title="Novo Compromisso">+</button>
                </div>
                <div class="p-cal-col-body">
                   ${cards}
                </div>
             </div>
           `;
        }).join('');

        contentHtml = `
           <div class="prod-v2-cal-grid">
               ${gridCols}
           </div>
        `;
    }

    root.innerHTML = `
      <div class="prod-v2-layout">
         <header class="prod-v2-head">
            <div class="p-head-title">
               <h3>Mizinho Agenda</h3>
               <p>Controle central de captações, roteiros e agendamentos.</p>
            </div>
            <div class="p-controls-row">
               <div class="p-segment">
                  <button class="${window.productionV2View==='feed'?'active':''}" onclick="setProdV2View('feed')">≡ Feed</button>
                  <button class="${window.productionV2View==='calendar'?'active':''}" onclick="setProdV2View('calendar')">Calendário</button>
               </div>
               <div class="p-segment">
                  <button class="${typeof productionCommandDateMode !== 'undefined' && productionCommandDateMode==='prazo'?'active':''}" onclick="productionCommandSetDateMode('prazo')" title="Agrupar pelo Prazo de Entrega">Prazo Base</button>
                  <button class="${typeof productionCommandDateMode !== 'undefined' && productionCommandDateMode==='veiculacao'?'active':''}" onclick="productionCommandSetDateMode('veiculacao')" title="Agrupar pela data que vai para o ar">Veiculação</button>
               </div>
            </div>
         </header>
         ${contentHtml}
      </div>
    `;
  };

  window.openProductionSheet = async function(itemId) {
     const item = (typeof DADOS_ALL !== 'undefined' && DADOS_ALL ? DADOS_ALL.find(e=>String(e.id)===String(itemId)) : null) || (typeof DADOS !== 'undefined' && DADOS ? DADOS.find(e=>String(e.id)===String(itemId)) : null);
     if(!item) return typeof showToast === 'function' ? showToast('Ordem não encontrada.','err') : alert('Ordem não encontrada.');
     
     closeProductionSheet();
     
     const overlay = document.createElement('div');
     overlay.id = 'prod-v2-overlay';
     overlay.className = 'prod-v2-overlay';
     overlay.onclick = e => { if(e.target === overlay) closeProductionSheet(); };
     
     overlay.innerHTML = `<aside class="prod-v2-drawer"><div style="padding:40px;color:#fff;">Carregando roteiro...</div></aside>`;
     document.body.appendChild(overlay);
     requestAnimationFrame(() => overlay.classList.add('open'));

     const readiness = productionCommandReadiness(item);
     try {
        const detail = await fetchWorkspaceItem(item.id).catch(()=>null);
        const packet = productionCommandUpdateText(detail, item);
        const brief = packet.text || 'Nenhum roteiro localizado no histórico carregado. Abra o Workspace para verificar as instruções iniciais da demanda.';

        overlay.innerHTML = `
          <aside class="prod-v2-drawer">
             <header class="p-draw-head">
                <button class="p-draw-close" onclick="closeProductionSheet()">×</button>
                <div class="p-draw-title">
                   <span>Roteiro e ficha técnica</span>
                   <b>${esc(item.nome)}</b>
                </div>
                <div class="p-draw-meta">
                   <span>${esc(item.cliente)}</span>
                   <span>${esc(productionCommandOwner(item))}</span>
                </div>
             </header>
             
             <div class="p-draw-body">
                <div class="p-draw-status" style="--st-color:${readiness.color}">
                   <div class="st-dot"></div>
                   <b>${esc(readiness.label)}</b>
                   <small>Atualizado: ${packet.updated ? new Date(packet.updated).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : 'sem horário'}</small>
                </div>
                
                <div class="p-draw-section">
                   <b>ROTEIRO / INSTRUÇÕES DE CAPTAÇÃO</b>
                   <div class="p-brief-box">${esc(brief)}</div>
                   <small class="p-source">Fonte: ${esc(packet.source)}</small>
                </div>
                
                <div class="p-draw-section">
                   <b>Checklist de prontidão</b>
                   ${productionChecklistHtml(item, packet)}
                </div>
             </div>
             
             <footer class="p-draw-foot">
                <button class="p-btn-open" onclick="closeProductionSheet(); openItemWorkspace('${item.id}')">ABRIR NO WORKSPACE ↗</button>
             </footer>
          </aside>
        `;
     } catch(e) {
        overlay.innerHTML = `<aside class="prod-v2-drawer"><div style="padding:40px;color:#ff637a;">Erro ao carregar a ficha.</div></aside>`;
     }
  };

  window.closeProductionSheet = function() {
     const overlay = document.getElementById('prod-v2-overlay');
     if(overlay) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
     }
  };

  window.productionChecklistHtml = function(item, packet) {
     const readiness = productionCommandReadiness(item);
     const hasPacket = Boolean(packet?.text);
     const capture = ['📸','🎥'].includes(productionCommandKind(item).icon);
     
     const rows = [
        {ok: hasPacket, label:'Briefing ou roteiro', copy:hasPacket?'Disponível no histórico':'Não localizado'},
        {ok: ['ready','scheduled','executing','approval'].includes(readiness.key), label:'Base liberada', copy:readiness.copy},
        {ok: Boolean(productionCommandReference(item)), label:'Data de referência', copy:productionCommandReference(item)?productionCommandDateLabel(item):'Falta preencher data'},
        {ok: !capture || ['scheduled','executing','approval'].includes(readiness.key), label:'Captação externa', copy:capture?'Confirmada':'Não é obrigatória para iniciar edição'}
     ];

     return `<ul class="prod-v2-checklist">
       ${rows.map(r => `
         <li class="${r.ok?'pass':'fail'}">
           <i>${r.ok?'✓':'○'}</i>
           <div><b>${esc(r.label)}</b><span>${esc(r.copy)}</span></div>
         </li>
       `).join('')}
     </ul>`;
  };

})();
