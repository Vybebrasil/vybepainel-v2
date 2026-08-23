/* Vybe OS — Produção Governada v2 (Apple Glassmorphism) */
(function() {
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function ensureProductionV2Styles() {
    if(document.getElementById('prod-v2-styles')) return;
    const style = document.createElement('style');
    style.id = 'prod-v2-styles';
    style.textContent = `
      .prod-v2-layout { display:flex; flex-direction:column; gap:24px; padding:24px 32px; max-width:1200px; margin:0 auto; animation:fadeIn 0.3s ease; }
      @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      
      .prod-v2-head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px; }
      .p-head-title h3 { margin:0; font:800 28px/1.2 var(--mac-ui, sans-serif); color:#fff; letter-spacing:-0.5px; }
      .p-head-title p { margin:6px 0 0; color:#9cafba; font:500 13px var(--mac-ui, sans-serif); }
      
      .p-segment { display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:4px; gap:4px; }
      .p-segment button { background:transparent; border:none; color:#849aa6; font:600 12px var(--mac-ui, sans-serif); padding:8px 16px; border-radius:6px; cursor:pointer; transition:all 0.2s; }
      .p-segment button:hover { color:#fff; background:rgba(255,255,255,0.05); }
      .p-segment button.active { background:rgba(255,255,255,0.15); color:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.2); }
      
      .prod-v2-dates { display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; }
      .prod-v2-date-btn { min-width:120px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:4px; cursor:pointer; transition:all 0.2s; text-align:left; position:relative; }
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
      
      @media(max-width:780px){
         .prod-v2-head { flex-direction:column; align-items:flex-start; gap:16px; }
         .prod-v2-card { flex-direction:column; align-items:flex-start; gap:12px; }
         .p-card-right { width:100%; justify-content:space-between; }
         .prod-v2-drawer { width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  window.renderProductionCommand = function() {
    ensureProductionV2Styles();
    const root = document.getElementById('production-command-dashboard');
    if(!root) return;

    const all = typeof productionCommandItems === 'function' ? productionCommandItems() : [];
    const dates = typeof productionCommandDates === 'function' ? productionCommandDates() : [];
    
    const focus = productionCommandFocusDate && dates.includes(productionCommandFocusDate) ? productionCommandFocusDate : (dates.find(iso => all.some(item => productionCommandReference(item) === iso)) || dates[0]);
    productionCommandFocusDate = focus;

    const focused = all.filter(item => productionCommandReference(item) === focus).sort((a,b) => {
        const rank = {blocked:0, brief:1, ready:2, scheduled:3, executing:4, approval:5};
        return (rank[productionCommandReadiness(a).key] || 0) - (rank[productionCommandReadiness(b).key] || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });

    const dateRail = dates.map(iso => {
       const list = all.filter(item => productionCommandReference(item) === iso);
       const capture = list.filter(item => ['📸','🎥'].includes(productionCommandKind(item).icon)).length;
       const active = iso === focus;
       const isToday = typeof HOJE_ISO !== 'undefined' && iso === HOJE_ISO;
       return `
         <button class="prod-v2-date-btn ${active?'active':''} ${isToday?'today':''}" onclick="productionCommandSetDate('${iso}')">
           <span class="p-day">${new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase()}</span>
           <span class="p-date">${iso.split('-').slice(1).reverse().join('/')}</span>
           ${capture ? `<span class="p-badge-cap">${capture} CAPTAÇÃO${capture>1?'ES':''}</span>` : ''}
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
              ${isCapture ? `<span class="p-tag-cap">Captação Externa</span>` : ''}
              <span class="p-tag-status" style="color:${readiness.color}; background:${readiness.color}15; border-color:${readiness.color}30;">${esc(readiness.label)}</span>
              <button class="p-play-btn" style="color:${readiness.color}">▶</button>
           </div>
         </div>
       `;
    }).join('');

    root.innerHTML = `
      <div class="prod-v2-layout">
         <header class="prod-v2-head">
            <div class="p-head-title">
               <h3>Produção</h3>
               <p>Agenda operacional limpa. Captações e edições da semana organizadas por dia.</p>
            </div>
            <div class="p-head-controls">
               <div class="p-segment">
                  <button class="${productionCommandDateMode==='prazo'?'active':''}" onclick="productionCommandSetDateMode('prazo')">Prazo Final</button>
                  <button class="${productionCommandDateMode==='veiculacao'?'active':''}" onclick="productionCommandSetDateMode('veiculacao')">Veiculação</button>
               </div>
            </div>
         </header>
         <nav class="prod-v2-dates">
            ${dateRail}
         </nav>
         <main class="prod-v2-feed">
            ${feed || `<div class="p-empty">Nada agendado para esta data. Que tal antecipar algo do dia seguinte?</div>`}
         </main>
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
     
     overlay.innerHTML = `<aside class="prod-v2-drawer"><div style="padding:40px;color:#fff;">CARREGANDO FICHA...</div></aside>`;
     document.body.appendChild(overlay);
     requestAnimationFrame(() => overlay.classList.add('open'));

     const readiness = productionCommandReadiness(item);
     try {
        const detail = await fetchWorkspaceItem(item.id).catch(()=>null);
        const packet = productionCommandUpdateText(detail, item);
        const brief = packet.text || 'Nenhum briefing localizado no histórico carregado. Abra o Workspace para verificar as instruções iniciais da demanda.';

        overlay.innerHTML = `
          <aside class="prod-v2-drawer">
             <header class="p-draw-head">
                <button class="p-draw-close" onclick="closeProductionSheet()">×</button>
                <div class="p-draw-title">
                   <span>FICHA OPERACIONAL</span>
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
                   <b>ROTEIRO E CONTEXTO OPERACIONAL</b>
                   <div class="p-brief-box">${esc(brief)}</div>
                   <small class="p-source">Fonte: ${esc(packet.source)}</small>
                </div>
                
                <div class="p-draw-section">
                   <b>CHECKLIST DE PRONTIDÃO</b>
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
