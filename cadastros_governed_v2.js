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
      .fc-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); z-index:670; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s ease; }
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
      .fc-destino { display:inline-flex; gap:2px; padding:2px; margin:0 0 14px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:8px; }
      .fc-destino-btn { border:0; background:transparent; color:#9cafba; cursor:pointer;
        padding:6px 13px; border-radius:6px; font:600 12px var(--mac-ui); letter-spacing:0;
        transition:background .14s, color .14s; }
      .fc-destino-btn:hover { color:#e7ecf5; }
      .fc-destino-btn.ativo { background:var(--accent,#ff6b00); color:#fff; }
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
      .fc-dropdown-value::after { content:''; width:10px; height:10px; display:inline-block; background:#849aa6;
        -webkit-mask:var(--seta-baixo) center/contain no-repeat; mask:var(--seta-baixo) center/contain no-repeat; }
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
    
      /* ─── Fluxo guiado ──────────────────────────────────────────────────── */
      .fc-trilha { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:26px; }
      .fc-trilha-passo { border:0; border-radius:999px; padding:4px 11px; cursor:pointer;
        background:rgba(255,255,255,.05); color:#7d8b96; font:600 10.5px var(--mac-ui,system-ui);
        transition:background-color .14s var(--curva), color .14s var(--curva); }
      .fc-trilha-passo:disabled { opacity:.4; cursor:default; }
      .fc-trilha-passo.feito { background:rgba(0,240,255,.10); color:#7fd8e8; }
      .fc-trilha-passo.agora { background:#00f0ff; color:#061016; }
      .fc-pergunta { margin:0 0 5px; color:#fff; font:700 27px/1.15 var(--mac-ui,system-ui); letter-spacing:-.02em; }
      .fc-sub { margin:0 0 22px; color:#7d8b96; font:500 13px/1.45 var(--mac-ui,system-ui); }
      .fc-resposta { min-height:230px; }
      .fc-guia-rodape { display:flex; justify-content:flex-end; gap:10px; margin-top:26px;
        padding-top:18px; border-top:1px solid rgba(255,255,255,.07); }

      .fc-escolhas { display:flex; flex-wrap:wrap; gap:7px; max-height:320px; overflow-y:auto; padding:2px; }
      .fc-escolha { border:1px solid rgba(255,255,255,.11); border-radius:10px; padding:9px 14px;
        background:rgba(255,255,255,.03); color:#dfe6ec; cursor:pointer;
        font:600 13px var(--mac-ui,system-ui); text-align:left;
        transition:border-color .14s var(--curva), background-color .14s var(--curva); }
      .fc-escolha:hover { border-color:rgba(0,240,255,.5); background:rgba(0,240,255,.07); }
      .fc-escolha.marcada { border-color:#00f0ff; background:rgba(0,240,255,.13); color:#fff; }
      .fc-escolha.grande { display:block; width:100%; padding:16px 18px; margin-bottom:9px; }
      .fc-escolha.grande b { display:block; font:700 16px var(--mac-ui,system-ui); }
      .fc-escolha.grande small { display:block; margin-top:3px; color:#7d8b96; font:500 12px var(--mac-ui,system-ui); }

      .fc-busca, .fc-campo, .fc-campo-grande, .fc-campo-texto { width:100%; box-sizing:border-box;
        border:1px solid rgba(255,255,255,.12); border-radius:10px; background:rgba(0,0,0,.28);
        color:#fff; font:600 14px var(--mac-ui,system-ui); padding:11px 13px;
        transition:border-color .14s var(--curva); }
      .fc-busca { margin-bottom:11px; }
      .fc-campo-grande { font:700 22px var(--mac-ui,system-ui); padding:14px; }
      .fc-campo-texto { min-height:130px; resize:vertical; font:500 14px/1.5 var(--mac-ui,system-ui); }
      .fc-busca:focus, .fc-campo:focus, .fc-campo-grande:focus, .fc-campo-texto:focus {
        border-color:#00f0ff; outline:none; }
      .fc-dica { margin:11px 0 0; color:#7d8b96; font:500 12px var(--mac-ui,system-ui); }
      .fc-dica b { color:#bfe9f2; }

      .fc-datas { display:flex; gap:12px; flex-wrap:wrap; }
      .fc-datas label { flex:1 1 180px; display:block; }
      .fc-datas span { display:block; margin-bottom:6px; color:#7d8b96;
        font:600 10.5px var(--mac-ui,system-ui); text-transform:uppercase; letter-spacing:.05em; }

      .fc-atalhos { display:grid; gap:8px; margin-top:14px; }
      .fc-atalho { display:flex; align-items:flex-start; gap:10px; padding:11px 13px;
        border:1px solid rgba(255,255,255,.10); border-radius:10px; cursor:pointer;
        color:#dfe6ec; font:600 13px var(--mac-ui,system-ui);
        transition:border-color .14s var(--curva), background-color .14s var(--curva); }
      .fc-atalho:hover { border-color:rgba(0,240,255,.4); background:rgba(0,240,255,.05); }
      .fc-atalho input { margin-top:2px; accent-color:#00f0ff; }
      .fc-atalho small { display:block; color:#7d8b96; font:500 11.5px var(--mac-ui,system-ui); }
      .fc-bloco-equipe { margin-top:20px; }
      .fc-bloco-equipe .fc-dica { margin:0 0 10px; }

      .fc-itens { display:grid; gap:10px; max-height:min(46vh,380px); overflow-y:auto; padding:2px; }
      .fc-item { display:grid; gap:8px; padding:12px; border:1px solid rgba(255,255,255,.10);
        border-radius:12px; background:rgba(255,255,255,.02); }
      .fc-item:focus-within { border-color:rgba(0,240,255,.42); }
      .fc-item-topo { display:flex; align-items:center; gap:10px; }
      .fc-item-topo b { display:grid; place-items:center; width:20px; height:20px; flex:none;
        border-radius:50%; background:rgba(0,240,255,.14); color:#7fd8e8;
        font:700 10px var(--mac-ui,system-ui); }
      .fc-item-topo span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:#7d8b96; font:600 11.5px var(--mac-ui,system-ui); }
      .fc-item-datas { display:flex; gap:10px; flex-wrap:wrap; }
      .fc-item-datas label { flex:1 1 150px; }
      .fc-item-datas span { display:block; margin-bottom:4px; color:#7d8b96;
        font:600 10px var(--mac-ui,system-ui); text-transform:uppercase; letter-spacing:.05em; }
      .fc-item .fc-campo-texto { min-height:70px; }
      .fc-itens-acoes { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .fc-mais { border:1px dashed rgba(0,240,255,.34); border-radius:10px; padding:8px 12px;
        background:transparent; color:#7fd8e8; cursor:pointer; font:600 12px var(--mac-ui,system-ui);
        transition:background-color .14s var(--curva), border-color .14s var(--curva); }
      .fc-mais:hover { background:rgba(0,240,255,.08); border-color:#00f0ff; }
`;
    document.head.appendChild(style);
  }

  let state = {
    // Cinco cards com briefings e veiculacoes diferentes: o que se repete e
    // cliente, formato e destino; o que muda e titulo, data e briefing. Entao a
    // lista guarda so o que muda, e o resto continua valendo para o lote todo.
    itens: [{ titulo: '', veic: '', prazo: '', brief: '' }],
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
    manualCap: undefined,
    // 'producao' ou 'demandas'. Antes não existia: tudo ia para Produção, e
    // Solicitações só recebia item criado dentro do Monday.
    board: 'producao',
    prioridade: ''
  };

// O que muda entre os dois quadros. Grupos, status e o terceiro campo não são
// os mesmos — em Produção é Captação, em Demandas é Prioridade.
const FC_QUADROS = {
  producao: {
    id: 7829537690,
    nome: 'Produção de conteúdo',
    grupos: [
      { val: 'group_title', label: 'Redação' },
      { val: 'novo_grupo__1', label: 'Design & Edição' },
      { val: 'novo_grupo57911__1', label: 'Produção (Foto e Vídeo)' },
      { val: 'novo_grupo22352__1', label: 'Gestão de publicações' }
    ],
    status: ['A Fazer','Aguardo Redação','Pode Fazer','Falta D.A','Em andamento','Aguardo',
             'Ag. Aprovação Cliente','Ag. Info Cliente','Falta Info','Segurar Post','Agendado',
             'Finalizado','Feito'],
    formatos: null,
    rotuloFormato: 'Formato'
  },
  demandas: {
    id: 8385559107,
    nome: 'Solicitação de demanda',
    grupos: [
      { val: 'group_mm187437', label: 'Novas Demandas/Ideias' },
      { val: 'novo_grupo_mkmkjdqd', label: 'A Fazer' },
      { val: 'novo_grupo_mkkyfhtw', label: 'Em Execução' },
      { val: 'novo_grupo_mkkyx8pv', label: 'Concluídas' }
    ],
    status: ['Nova Demanda','Aguardando Info.','Para Orçar','Em Orçamento','Pode Fazer',
             'Em execução','Em impressão','Em aprovação','Alteração','Aprovado','Feito'],
    formatos: ['Impresso','Fotografia','Card','Digital','Texto','Vídeo','Design','Avulso',
               'Post','Implementação','Planejamento','Reunião'],
    rotuloFormato: 'Tipo de demanda'
  }
};
const FC_PRIORIDADES = ['', 'Crítica', 'Alta', 'Média', 'Baixa', 'Preventiva'];
function fcQuadro() { return FC_QUADROS[state.board] || FC_QUADROS.producao; }

  window.fcTrocarQuadro = function(qual) {
    if (state.board === qual) return;
    state.board = qual;
    // Grupo e status do quadro anterior não existem no novo — deixar para trás
    // faria o servidor recusar a criação com "status não existe neste board".
    state.manualGroup = undefined;
    state.manualStatus = undefined;
    state.manualCap = undefined;
    state.prioridade = '';
    state.format = '';
    document.querySelectorAll('.fc-destino-btn').forEach((b) => b.classList.remove('ativo'));
    document.getElementById(`fc-destino-${qual}`)?.classList.add('ativo');
    const rotulo = document.getElementById('fc-label-formato');
    if (rotulo) rotulo.textContent = fcQuadro().rotuloFormato;
    fcMontarFormatos();
    if (typeof renderCustomDropdownsGlobal === 'function') renderCustomDropdownsGlobal();
    updateDestinyUI();
  };

  // A lista de formato muda de quadro: Produção usa os formatos de conteúdo,
  // Demandas usa "Tipo de demanda", que é outra coluna e outra lista.
  window.fcMontarFormatos = function() {
    const campo = document.getElementById('fc-format-input');
    if (!campo) return;
    const quadro = fcQuadro();
    const lista = quadro.formatos
      || (typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS
          : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories']);
    campo.innerHTML = `<option value="">Selecionar ${quadro.rotuloFormato.toLowerCase()}...</option>`
      + lista.map((f) => `<option value="${String(f).replace(/"/g,'&quot;')}">${f}</option>`).join('');
    campo.value = state.format || '';
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
         const getCol = (s) => {
         // Custom overrides matching the exact Monday board screenshot
         if (s === 'Captação Agendada') return { color: '#ffcb00', bg: 'rgba(255,203,0,0.15)', border: 'rgba(255,203,0,0.3)' }; // yellow
         if (s === 'Captação Feita' || s === 'Feito') return { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' }; // light green
         if (s === 'Agendar Captação') return { color: '#df2f4a', bg: 'rgba(226,68,92,0.15)', border: 'rgba(226,68,92,0.3)' }; // red/pink
         if (s === 'Editado') return { color: '#037f4c', bg: 'rgba(3,127,76,0.15)', border: 'rgba(3,127,76,0.3)' }; // dark green
         if (s === 'A fazer') return { color: '#c4c4c4', bg: 'rgba(196,196,196,0.15)', border: 'rgba(196,196,196,0.3)' }; // gray
         if (s === 'Captação em Andamento') return { color: '#579bfc', bg: 'rgba(87,155,252,0.15)', border: 'rgba(87,155,252,0.3)' }; // blue
         if (s === 'Aguardo Redação') return { color: '#ff5ac4', bg: 'rgba(255,90,196,0.15)', border: 'rgba(255,90,196,0.3)' }; // pink
         return c[s] || { color: '#8888a8', bg: 'rgba(136,136,168,0.12)', border: 'rgba(136,136,168,0.25)' };
     };
         const col = getCol(dest.status).color;
         fcSelectDropdown('manualStatus', dest.status, dest.status, {color: col}, false);
     }
     
     if(state.manualCap === undefined) {
         const capVal = dest.capture ? 'Agendar Captação' : '';
         const capText = capVal || '- Nenhuma -';
         const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
         const getCol = (s) => {
         // Custom overrides matching the exact Monday board screenshot
         if (s === 'Captação Agendada') return { color: '#ffcb00', bg: 'rgba(255,203,0,0.15)', border: 'rgba(255,203,0,0.3)' }; // yellow
         if (s === 'Captação Feita' || s === 'Feito') return { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' }; // light green
         if (s === 'Agendar Captação') return { color: '#df2f4a', bg: 'rgba(226,68,92,0.15)', border: 'rgba(226,68,92,0.3)' }; // red/pink
         if (s === 'Editado') return { color: '#037f4c', bg: 'rgba(3,127,76,0.15)', border: 'rgba(3,127,76,0.3)' }; // dark green
         if (s === 'A fazer') return { color: '#c4c4c4', bg: 'rgba(196,196,196,0.15)', border: 'rgba(196,196,196,0.3)' }; // gray
         if (s === 'Captação em Andamento') return { color: '#579bfc', bg: 'rgba(87,155,252,0.15)', border: 'rgba(87,155,252,0.3)' }; // blue
         if (s === 'Aguardo Redação') return { color: '#ff5ac4', bg: 'rgba(255,90,196,0.15)', border: 'rgba(255,90,196,0.3)' }; // pink
         return c[s] || { color: '#8888a8', bg: 'rgba(136,136,168,0.12)', border: 'rgba(136,136,168,0.25)' };
     };
         const col = capVal ? getCol(capVal).color : null;
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
     const n = (state.itens || []).length;
     // Em lote a previa mostra o primeiro e diz quantos vem atras — o destino e
     // a equipe sao os mesmos para todos, entao um cartao ja representa o lote.
     titleEl.textContent = n > 1
       ? `${formatText} - ${titleText}  +${n - 1}`
       : `${formatText} - ${titleText}`;
     clientEl.textContent = state.client || 'Cliente não selecionado';
     
     const groups = { 'group_title': 'Redação', 'novo_grupo__1': 'Design & Edição', 'novo_grupo57911__1': 'Produção (Foto e Vídeo)' };
     const finalGroup = state.manualGroup !== undefined ? state.manualGroup : dest.group;
     const finalGroupLabel = groups[finalGroup] || 'Redação';
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : dest.status;
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');
     
     groupEl.textContent = finalGroupLabel;
     
     const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
     const getCol = (s) => {
         // Custom overrides matching the exact Monday board screenshot
         if (s === 'Captação Agendada') return { color: '#ffcb00', bg: 'rgba(255,203,0,0.15)', border: 'rgba(255,203,0,0.3)' }; // yellow
         if (s === 'Captação Feita' || s === 'Feito') return { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' }; // light green
         if (s === 'Agendar Captação') return { color: '#df2f4a', bg: 'rgba(226,68,92,0.15)', border: 'rgba(226,68,92,0.3)' }; // red/pink
         if (s === 'Editado') return { color: '#037f4c', bg: 'rgba(3,127,76,0.15)', border: 'rgba(3,127,76,0.3)' }; // dark green
         if (s === 'A fazer') return { color: '#c4c4c4', bg: 'rgba(196,196,196,0.15)', border: 'rgba(196,196,196,0.3)' }; // gray
         if (s === 'Captação em Andamento') return { color: '#579bfc', bg: 'rgba(87,155,252,0.15)', border: 'rgba(87,155,252,0.3)' }; // blue
         if (s === 'Aguardo Redação') return { color: '#ff5ac4', bg: 'rgba(255,90,196,0.15)', border: 'rgba(255,90,196,0.3)' }; // pink
         return c[s] || { color: '#8888a8', bg: 'rgba(136,136,168,0.12)', border: 'rgba(136,136,168,0.25)' };
     };
     const stObj = getCol(finalStatus);
     const bgStatus = stObj.bg;
     const txtStatus = stObj.color;
     const brdStatus = stObj.border;
     let statusesHtml = `<span class="fc-prev-tag" style="background:${bgStatus}; color:${txtStatus}; border-color:${brdStatus};">${esc(finalStatus)}</span>`;
     
     if (finalCap) {
         const capObj = getCol(finalCap);
         const bgCap = capObj.bg;
         const txtCap = capObj.color;
         const brdCap = capObj.border;
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
     // Era `if(isManual)`, e isManual nao existe aqui: e parametro de
     // fcSelectDropdown, outra funcao. Toda tecla no titulo, toda troca de
     // cliente e todo checkbox estouravam ReferenceError e nada chegava no
     // state — por isso a previa nunca saia de "Cliente nao selecionado".
     state[key] = val;
     
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

  // Cria UM conteudo. O laco de fora repete isto para cada cartao da lista.
  async function fcCriarUm(item, dest, finalGroup, finalStatus, finalCap) {
     const normalized = `${state.format} - ${String(item.titulo).trim()}`;
     const values = {
        lista_suspensa_mkmqnjbv: {labels:[state.client]},
        lista_suspensa0__1: {labels:[state.format]},
        lista_suspensa__1: {ids:[3]},
        data__1: {date:item.veic},
        data: {date:item.prazo},
        status: {label:finalStatus},
        person: {personsAndTeams:dest.assignees.map(id=>({id:Number(id),kind:'person'}))}
     };
     if(finalCap) values.status_1__1 = {label:finalCap};

     try {
        // Grava no banco da Vybe e replica no Monday. O id do Monday só existe
        // depois de criar lá, então o servidor grava aqui primeiro, sem id, e
        // liga os dois em seguida — criar no Monday primeiro para ter o id seria
        // devolver a ele o papel de fonte da verdade.
        let itemId = null;
        const pelaEscritaDupla = await tentarEscritaDupla({ id: '' }, {
           acao: 'criar', board: fcQuadro().id,
           titulo: normalized, cliente: state.client, formato: state.format,
           prazo: item.prazo, veiculacao: item.veic, status: chaveDeStatus(finalStatus),
           grupo_id: finalGroup, briefing: item.brief,
           // "Tipo de conteúdo" só existe em Produção, e lá "Post" (3) é o único
           // rótulo que não está desativado no board.
           tipo_conteudo: state.board === 'demandas' ? null : 3,
           captacao: state.board === 'demandas' ? null : (finalCap || null),
           prioridade: state.board === 'demandas' ? (state.prioridade || null) : null,
           responsaveis: dest.assignees.map(String),
           _devolve: true,
        });
        if (pelaEscritaDupla?.item_id) itemId = String(pelaEscritaDupla.item_id);
        // O ID local mantém o conteúdo imediatamente operável. A fila liga esse
        // registro ao ID externo quando a contingência do Monday voltar.
        else if (pelaEscritaDupla?.conteudo_id) {
          itemId = `vybe:${pelaEscritaDupla.conteudo_id}`;
          showToast('✓ Criado no Vybe · cópia de contingência enfileirada', 'info', 7000);
        }
        if (!itemId && !pelaEscritaDupla?.conteudo_id) {
          const create = `mutation($board: ID!, $group: String!, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }`;
          const response = await mondayQuery(create, {board:String(fcQuadro().id), group:finalGroup, name:normalized, values:JSON.stringify(values)});
          itemId = response?.create_item?.id;
        }
        if(!itemId && !pelaEscritaDupla?.conteudo_id) throw new Error('Falha ao obter ID');

        const hellen = state.client.toLowerCase().includes('hellen rocha') ? '<li>✅ Validar informações jurídicas com a Hellen antes de publicar</li>' : '';
        const captureLine = finalCap ? `<li>📸 Agendar e confirmar captação externa</li>` : '';
        const update = `<p><strong>🚀 CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${esc(item.brief)}</p><ul><li>✅ Revisar copy e adaptar ao tom da marca</li><li>✅ Selecionar referências visuais / banco de imagens</li><li>✅ Montar layout no padrão do cliente</li>${captureLine}<li>✅ Enviar para aprovação antes de publicar</li>${hellen}</ul>`;
        
        // O checklist usa o mesmo ID do conteúdo, inclusive o ID próprio vybe:.
        // Assim o histórico nasce no banco e a cópia externa pode chegar depois.
        if (itemId) { try { await postItemUpdate(itemId, update); } catch (erro) { console.warn('Conteúdo criado, mas o checklist não foi registrado.', erro); } }

        return { ok: true, id: itemId, nome: normalized };
     } catch (e) {
        return { ok: false, nome: normalized, erro: e.message };
     }
  }

  window.fcSubmit = async function() {
     fcSincronizarDaTela();
     const faltando = FC_PASSOS.find((q) => !fcRespondido(q));
     if (faltando) {
        fcPasso = FC_PASSOS.indexOf(faltando);
        fcDesenharPasso();
        return typeof showToast === 'function'
          ? showToast(FC_FALTA[faltando] || 'Falta responder esta.', 'info') : null;
     }

     const dest = cadastrosDestiny(state.format, state.briefReady, state.materialReady, state.assignees);
     const finalGroup = state.manualGroup !== undefined ? state.manualGroup : dest.group;
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : dest.status;
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');

     const btn = document.getElementById('fc-submit-btn');
     const total = state.itens.length;
     const feitos = [];
     const falhas = [];

     // Um de cada vez, e nao todos de uma vez: o Monday limita chamadas por
     // minuto, e em lote um erro de rede levaria os cinco junto.
     for (let n = 0; n < total; n++) {
        if (btn) { btn.disabled = true; btn.textContent = total > 1 ? `Criando ${n + 1} de ${total}...` : 'Criando...'; }
        const r = await fcCriarUm(state.itens[n], dest, finalGroup, finalStatus, finalCap);
        (r.ok ? feitos : falhas).push(r);
     }

     if (btn) { btn.disabled = false; btn.textContent = total > 1 ? `Criar ${total} conteúdos` : 'Criar conteúdo'; }

     if (!falhas.length) {
        if (typeof showToast === 'function') {
          showToast(total > 1 ? `✓ ${total} conteúdos criados` : '✓ Conteúdo criado', 'ok');
        }
        fcCloseModal();
        if (typeof refreshData === 'function') await refreshData();
        return;
     }

     // Parcial: os que entraram ficam, e a lista guarda so os que faltaram —
     // assim da para corrigir e tentar de novo sem duplicar o que ja existe.
     const nomesFalhos = new Set(falhas.map((f) => f.nome));
     state.itens = state.itens.filter((it) => nomesFalhos.has(`${state.format} - ${String(it.titulo).trim()}`));
     fcEspelharPrimeiro();
     fcPasso = FC_PASSOS.indexOf('itens');
     fcDesenharPasso();
     if (typeof showToast === 'function') {
        showToast(`${feitos.length} de ${total} criados. Ficaram na lista os ${falhas.length} que falharam: ${falhas[0].erro}`, 'err', 10000);
     }
     if (feitos.length && typeof refreshData === 'function') await refreshData();
  };

  window.fcToggleDropdown = function(id) {
       const list = document.getElementById(id);
       const isOpen = list.classList.contains('open');
       document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
       if(!isOpen) list.classList.add('open');
    };
    
    window.fcSelectDropdown = function(key, val, text, colorObj, isManual = true) {
       // Gravava sempre, ignorando isManual. Quem chama com isManual=false e o
       // calculo automatico, so para MOSTRAR o destino sugerido — ao gravar, o
       // sugerido virava escolha manual na primeira vez que a tela desenhava, e
       // dali em diante o grupo nunca mais seguia o formato: escolher Reels ou
       // Card continuava caindo em Redacao.
       if (isManual) state[key] = val;
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
       // Estava fora do if e chamava de volta o caminho automatico:
       // updateDestinyUI -> fcSelectDropdown(false) -> updateDestinyUI, sem fim.
       // Antes parava porque o automatico gravava no state e a condicao de la
       // deixava de valer — parava por causa do bug. Redesenhar so faz sentido
       // quando foi a pessoa que escolheu.
       if (isManual) updateDestinyUI();
    };


  // ─── Fluxo guiado ───────────────────────────────────────────────────────────
  // A tela pedia as onze informacoes de uma vez, num formulario que so dizia se
  // estava certo depois de clicar em Criar. Agora e uma pergunta por vez, e a
  // previa da direita vai se montando conforme cada resposta entra — quem
  // cadastra ve para onde a peca esta indo antes de terminar.
  const FC_PASSOS = ['board', 'client', 'format', 'itens', 'destino'];
  let fcPasso = 0;

  const FC_ROTULO = { board:'Onde', client:'Cliente', itens:'Conteúdos', destino:'Destino' };
  function fcRotulo(p) { return p === 'format' ? fcQuadro().rotuloFormato : FC_ROTULO[p]; }

  function fcPergunta(p) {
    if (p === 'board')   return ['O que você vai cadastrar?', 'Os dois quadros têm etapas e status diferentes.'];
    if (p === 'client')  return ['Para qual cliente?', ''];
    if (p === 'format')  return [`Qual ${fcQuadro().rotuloFormato.toLowerCase()}?`,
                                 'É isto que decide para qual etapa a peça vai.'];
    if (p === 'itens') {
      const n = state.itens.length;
      return [n === 1 ? 'O que vai ser cadastrado?' : `Os ${n} conteúdos`,
        `Cliente e ${fcQuadro().rotuloFormato.toLowerCase()} valem para todos. Título, data e briefing são de cada um.`];
    }
    return ['Confira antes de criar', 'Tudo aqui veio das regras de entrada. Mude o que quiser.'];
  }

  function fcRespondido(p) {
    if (p === 'board')  return true;
    if (p === 'client') return !!state.client;
    if (p === 'format') return !!state.format;
    if (p === 'itens')  return state.itens.length > 0 && state.itens.every(
      (i) => String(i.titulo || '').trim() && i.veic && i.prazo && String(i.brief || '').trim());
    return true;
  }

  function fcCorpo(p) {
    const esc2 = (t) => esc(String(t == null ? '' : t));
    if (p === 'board') {
      return ['producao', 'demandas'].map((q) => `
        <button type="button" class="fc-escolha grande ${state.board === q ? 'marcada' : ''}"
          onclick="fcEscolherQuadro('${q}')">
          <b>${esc2(FC_QUADROS[q].nome)}</b>
          <small>${q === 'producao' ? 'Conteúdo que a Vybe produz e publica'
                                    : 'Pedido que chega e precisa de triagem'}</small></button>`).join('');
    }
    if (p === 'client') {
      const clientes = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
      return `<input type="text" class="fc-busca" id="fc-busca-cliente" placeholder="Buscar cliente..."
          oninput="fcFiltrar('fc-lista-cliente', this.value)">
        <div class="fc-escolhas" id="fc-lista-cliente">${clientes.map((c) => `
          <button type="button" class="fc-escolha ${state.client === c ? 'marcada' : ''}"
            data-busca="${esc2(String(c).toLowerCase())}"
            onclick="fcResponder('client', '${esc2(c).replace(/'/g, "\\'")}')">${esc2(c)}</button>`).join('')}</div>`;
    }
    if (p === 'format') {
      const lista = fcQuadro().formatos
        || (typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS
            : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories']);
      return `<div class="fc-escolhas">${lista.map((f) => `
        <button type="button" class="fc-escolha ${state.format === f ? 'marcada' : ''}"
          onclick="fcResponder('format', '${esc2(f).replace(/'/g, "\\'")}')">${esc2(f)}</button>`).join('')}</div>`;
    }
    if (p === 'itens') {
      const cartoes = state.itens.map((it, n) => `
        <div class="fc-item">
          <div class="fc-item-topo">
            <b>${n + 1}</b>
            <span>${esc2(state.format || 'Formato')} - ${esc2(it.titulo || 'sem título')}</span>
            ${state.itens.length > 1
              ? `<button type="button" class="icone-btn perigo" title="Tirar da lista"
                   onclick="fcTirarItem(${n})">${typeof ICONE !== 'undefined' ? ICONE.lixo : '×'}</button>`
              : ''}
          </div>
          <input type="text" class="fc-campo" data-item="${n}" data-campo="titulo"
            placeholder="Título" value="${esc2(it.titulo)}"
            oninput="fcItemCampo(${n},'titulo',this.value)">
          <div class="fc-item-datas">
            <label><span>Veiculação</span>
              <input type="date" class="fc-campo" data-item="${n}" data-campo="veic" value="${esc2(it.veic)}"
                oninput="fcItemCampo(${n},'veic',this.value)"></label>
            <label><span>Prazo de ouro</span>
              <input type="date" class="fc-campo" data-item="${n}" data-campo="prazo" value="${esc2(it.prazo)}"
                oninput="fcItemCampo(${n},'prazo',this.value)"></label>
          </div>
          <textarea class="fc-campo-texto" data-item="${n}" data-campo="brief"
            placeholder="Briefing: objetivo, referência, contexto..."
            oninput="fcItemCampo(${n},'brief',this.value)">${esc2(it.brief)}</textarea>
        </div>`).join('');
      return `<div class="fc-itens">${cartoes}</div>
        <div class="fc-itens-acoes">
          <button type="button" class="fc-mais" onclick="fcAdicionarItem()">+ adicionar outro conteúdo</button>
          ${state.itens.length > 1
            ? '<button type="button" class="fc-mais" onclick="fcEscalonarDatas()">datas de sete em sete dias</button>'
            : ''}
        </div>
        <div class="fc-atalhos">
          <label class="fc-atalho"><input type="checkbox" ${state.briefReady ? 'checked' : ''}
            onchange="fcHandleInput('briefReady', this.checked);updateDestinyUI()">
            <span>Os briefings já estão prontos <small>pula a Redação</small></span></label>
          <label class="fc-atalho"><input type="checkbox" ${state.materialReady ? 'checked' : ''}
            onchange="fcHandleInput('materialReady', this.checked);updateDestinyUI()">
            <span>O material bruto já foi fornecido <small>ignora a Captação</small></span></label>
        </div>`;
    }
    return `<div class="fc-auto-group" id="fc-auto-group-container"></div>
      <div class="fc-bloco-equipe">
        <span class="fc-dica">Equipe extra — as regras já escolhem quem entra; some aqui quem mais precisa.</span>
        <div class="fc-persons" id="fc-persons-container"></div>
      </div>`;
  }


  // Redesenhar o passo a cada tecla arrancaria o campo debaixo do dedo. Aqui so
  // guarda, preenche o prazo e atualiza a previa e o aviso.
  window.fcDataDigitada = function(campo, valor) {
    fcHandleInput(campo, valor);
    if (campo === 'veic') {
      const p = document.getElementById('fc-prazo');
      if (p && state.prazo) p.value = state.prazo;
    }
    const dica = document.getElementById('fc-dica-datas');
    if (dica) {
      dica.textContent = state.veic && state.prazo
        ? `Prazo de ouro em ${state.prazo.split('-').reverse().join('/')} — sete dias antes da veiculação.`
        : 'Informe a veiculação; o prazo de ouro se preenche sozinho.';
    }
  };

  // O que a pessoa ve na tela e o campo, nao o state. Se um evento se perdeu, o
  // botao barrava com a tela cheia. Antes de julgar, le o que esta escrito.
  function fcSincronizarDaTela() {
    document.querySelectorAll('[data-item][data-campo]').forEach((el) => {
      const it = state.itens[Number(el.dataset.item)];
      if (it && el.value !== undefined && it[el.dataset.campo] !== el.value) {
        it[el.dataset.campo] = el.value;
      }
    });
    fcEspelharPrimeiro();
  }

  const FC_FALTA = {
    board: 'Escolha onde cadastrar.',
    client: 'Escolha o cliente.',
    format: 'Escolha o formato.',
    itens: 'Cada conteúdo precisa de título, data de veiculação e briefing.',
  };


  // Espelha o primeiro item nos campos antigos: a previa e as regras de entrada
  // foram escritas para um conteudo so e continuam funcionando.
  function fcEspelharPrimeiro() {
    const um = state.itens[0] || {};
    state.title = um.titulo || '';
    state.veic = um.veic || '';
    state.prazo = um.prazo || '';
    state.brief = um.brief || '';
  }

  // Nao redesenha o passo: redesenhar a cada tecla arrancaria o campo debaixo
  // do dedo e perderia o cursor. So o topo do cartao e a previa acompanham.
  window.fcItemCampo = function(n, campo, valor) {
    const it = state.itens[n];
    if (!it) return;
    it[campo] = valor;
    if (campo === 'veic' && valor) {
      it.prazo = getOffsetDate(valor, -7);
      const p = document.querySelector(`[data-item="${n}"][data-campo="prazo"]`);
      if (p) p.value = it.prazo;
    }
    if (campo === 'titulo') {
      const topo = document.querySelectorAll('.fc-item-topo span')[n];
      if (topo) topo.textContent = `${state.format || 'Formato'} - ${valor || 'sem título'}`;
    }
    fcEspelharPrimeiro();
    updateDestinyUI();
  };

  window.fcAdicionarItem = function() {
    // A data segue a cadencia do que ja existe: sete dias depois da ultima.
    const ultima = [...state.itens].reverse().find((i) => i.veic)?.veic || '';
    state.itens.push({ titulo: '', veic: ultima ? getOffsetDate(ultima, 7) : '',
                       prazo: ultima ? getOffsetDate(ultima, 0) : '', brief: '' });
    fcEspelharPrimeiro();
    fcDesenharPasso();
    // O titulo do novo cartao e onde a pessoa vai escrever agora.
    const campos = document.querySelectorAll('[data-campo="titulo"]');
    campos[campos.length - 1]?.focus();
  };

  window.fcTirarItem = function(n) {
    if (state.itens.length <= 1) return;
    state.itens.splice(n, 1);
    fcEspelharPrimeiro();
    fcDesenharPasso();
  };

  // Cinco cards costumam sair um por semana. Isto preenche a partir da primeira
  // data ja informada, e nao toca em quem ja tem data escolhida a mao.
  window.fcEscalonarDatas = function() {
    const base = state.itens.find((i) => i.veic)?.veic;
    if (!base) return typeof showToast === 'function'
      ? showToast('Informe a veiculação do primeiro para escalonar os outros.', 'info') : null;
    const inicio = state.itens.findIndex((i) => i.veic);
    state.itens.forEach((it, n) => {
      if (n <= inicio) return;
      it.veic = getOffsetDate(base, 7 * (n - inicio));
      it.prazo = getOffsetDate(it.veic, -7);
    });
    fcEspelharPrimeiro();
    fcDesenharPasso();
  };

  window.fcFiltrar = function(listaId, termo) {
    const t = String(termo || '').toLowerCase().trim();
    document.querySelectorAll('#' + listaId + ' .fc-escolha').forEach((b) => {
      b.style.display = !t || (b.dataset.busca || '').includes(t) ? '' : 'none';
    });
  };

  window.fcResponder = function(chave, valor) {
    fcHandleInput(chave, valor);
    fcAvancar();
  };

  window.fcEscolherQuadro = function(qual) {
    if (state.board !== qual) {
      state.board = qual;
      // Grupo e status do quadro anterior nao existem no novo.
      state.manualGroup = state.manualStatus = state.manualCap = undefined;
      state.prioridade = ''; state.format = '';
    }
    fcAvancar();
  };

  window.fcIrPara = function(n) {
    if (n < 0 || n >= FC_PASSOS.length) return;
    // So deixa pular para frente ate onde ja foi respondido.
    for (let i = 0; i < n; i++) if (!fcRespondido(FC_PASSOS[i])) return;
    fcPasso = n;
    fcDesenharPasso();
  };

  window.fcAvancar = function() {
    fcSincronizarDaTela();
    const p = FC_PASSOS[fcPasso];
    if (!fcRespondido(p)) return typeof showToast === 'function'
      ? showToast(FC_FALTA[p] || 'Responda esta pergunta para continuar.', 'info') : null;
    if (fcPasso >= FC_PASSOS.length - 1) return fcSubmit();
    fcPasso++;
    fcDesenharPasso();
  };

  window.fcVoltar = function() { if (fcPasso > 0) { fcPasso--; fcDesenharPasso(); } };

  window.fcDesenharPasso = function() {
    const caixa = document.getElementById('fc-guia');
    if (!caixa) return;
    const p = FC_PASSOS[fcPasso];
    const [titulo, sub] = fcPergunta(p);
    const ultimo = fcPasso === FC_PASSOS.length - 1;

    caixa.innerHTML = `
      <div class="fc-trilha">${FC_PASSOS.map((q, i) => `
        <button type="button" class="fc-trilha-passo ${i === fcPasso ? 'agora' : ''} ${i < fcPasso ? 'feito' : ''}"
          onclick="fcIrPara(${i})" ${i > fcPasso ? 'disabled' : ''}>${esc(fcRotulo(q))}</button>`).join('')}</div>
      <h2 class="fc-pergunta">${esc(titulo)}</h2>
      ${sub ? `<p class="fc-sub">${esc(sub)}</p>` : ''}
      <div class="fc-resposta">${fcCorpo(p)}</div>
      <div class="fc-guia-rodape">
        ${fcPasso > 0 ? '<button type="button" class="fc-btn-cancel" onclick="fcVoltar()">Voltar</button>' : ''}
        <button type="button" class="fc-btn-create" id="fc-submit-btn" onclick="fcAvancar()">${
          ultimo ? (state.itens.length > 1 ? `Criar ${state.itens.length} conteúdos` : 'Criar conteúdo') : 'Continuar'}</button>
      </div>`;


    if (ultimo) { renderPersons(); renderCustomDropdownsGlobal(); }
    updateDestinyUI();
    const foco = caixa.querySelector('#fc-busca-cliente, [data-campo="titulo"]');
    if (foco) foco.focus();
  };

    // Aceita o que quem chama ja sabe: {client, veic, prazo, board}. Quem abre
    // pelo calendario ja escolheu o dia e, se o calendario estiver num cliente
    // so, ja escolheu o cliente — perguntar de novo seria pedir para digitar o
    // que a tela ja tem na mao.
    window.openCadastrosGoverned = function(inicial) {
    ensureFastCadastrosStyles();
    
    const existing = document.getElementById('fc-overlay');
    if(existing) existing.remove();

    state = { itens: [{ titulo: '', veic: '', prazo: '', brief: '' }], title: '', client: '', format: '', veic: '', prazo: '', brief: '', assignees: [], materialReady: false, briefReady: false, manualGroup: undefined, manualStatus: undefined, manualCap: undefined, board: 'producao', prioridade: '' };
    
    const inicio = (inicial && typeof inicial === 'object') ? inicial : {};
    if (inicio.board === 'demandas' || inicio.board === 'producao') state.board = inicio.board;
    // So aceita cliente que exista na lista do passo: guardar um nome que a tela
    // nao mostra deixaria o resumo falando de um cliente que ninguem escolheu.
    const listaDeClientes = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    if (inicio.client && listaDeClientes.includes(inicio.client)) state.client = inicio.client;
    if (inicio.veic) {
      state.itens[0].veic = inicio.veic;
      state.itens[0].prazo = inicio.prazo || getOffsetDate(inicio.veic, -7);
      fcEspelharPrimeiro();
    }

    // Exposta porque a troca de quadro precisa redesenhar grupo, status e a
    // terceira coluna — e ela mora dentro desta função.
    window.renderCustomDropdownsGlobal = () => renderCustomDropdowns();
    function renderCustomDropdowns() {
        const c = typeof MONDAY_STATUS_COLORS !== 'undefined' ? MONDAY_STATUS_COLORS : {};
        const getCol = (s) => {
         // Custom overrides matching the exact Monday board screenshot
         if (s === 'Captação Agendada') return { color: '#ffcb00', bg: 'rgba(255,203,0,0.15)', border: 'rgba(255,203,0,0.3)' }; // yellow
         if (s === 'Captação Feita' || s === 'Feito') return { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' }; // light green
         if (s === 'Agendar Captação') return { color: '#df2f4a', bg: 'rgba(226,68,92,0.15)', border: 'rgba(226,68,92,0.3)' }; // red/pink
         if (s === 'Editado') return { color: '#037f4c', bg: 'rgba(3,127,76,0.15)', border: 'rgba(3,127,76,0.3)' }; // dark green
         if (s === 'A fazer') return { color: '#c4c4c4', bg: 'rgba(196,196,196,0.15)', border: 'rgba(196,196,196,0.3)' }; // gray
         if (s === 'Captação em Andamento') return { color: '#579bfc', bg: 'rgba(87,155,252,0.15)', border: 'rgba(87,155,252,0.3)' }; // blue
         if (s === 'Aguardo Redação') return { color: '#ff5ac4', bg: 'rgba(255,90,196,0.15)', border: 'rgba(255,90,196,0.3)' }; // pink
         return c[s] || { color: '#8888a8', bg: 'rgba(136,136,168,0.12)', border: 'rgba(136,136,168,0.25)' };
     };
        
        const quadro = fcQuadro();
        const groups = quadro.grupos;
        const statuses = quadro.status;
        const caps = ['', 'Captação Agendada', 'Captação Feita', 'Agendar Captação', 'Editado', 'A fazer', 'Captação em Andamento'];
        const ehDemanda = state.board === 'demandas';
        
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
           
           ${ehDemanda ? `
           <div class="fc-auto-col" id="col-prioridade">
              <label>Prioridade</label>
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-prioridade" onclick="fcToggleDropdown('fc-list-prio')">${state.prioridade || '- Nenhuma -'}</div>
                 <div class="fc-dropdown-list" id="fc-list-prio">
                    ${FC_PRIORIDADES.map(pr => {
                        const col = getCol(pr).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        if(!pr) return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('prioridade', '', '- Nenhuma -')" style="color:#849aa6; margin-bottom:4px;">- Nenhuma -</div>`;
                        return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('prioridade', '${pr}', '${pr}', {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${pr}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>` : `
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
           </div>`}
        `;

        // Guarda: no fluxo por etapas este bloco so existe no ultimo passo.
        const caixa = document.getElementById('fc-auto-group-container');
        if (!caixa) return;
        caixa.innerHTML = html;

        // Era registrado toda vez que a lista era redesenhada — um ouvinte novo
        // por redesenho, todos vivos ao mesmo tempo.
        const capa = document.getElementById('fc-overlay');
        if (capa && !capa.dataset.fechaDropdown) {
            capa.dataset.fechaDropdown = '1';
            capa.addEventListener('click', (e) => {
                if(!e.target.closest('.fc-custom-dropdown')) {
                    document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
                }
            });
        }
    }
    
    const clients = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const formats = typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories'];

    const overlay = document.createElement('div');
    overlay.id = 'fc-overlay';
    overlay.className = 'fc-overlay';
    overlay.onclick = e => { if(e.target === overlay) fcCloseModal(); };

    overlay.innerHTML = `
      <div class="fc-modal">
         
         <div class="fc-main-col">
             <div class="fc-header">
                <div class="fc-kicker">Cadastro rápido</div>
             </div>
             <div class="fc-body"><div id="fc-guia"></div></div>
         </div>

         <!-- RIGHT COLUMN: LIVE PREVIEW -->
         <div class="fc-side-col">
             <button class="fc-close" onclick="fcCloseModal()">×</button>
             
             <div class="fc-side-title">Prévia de destino</div>
             
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
                          <span class="fc-prev-tag" style="background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2);">A fazer</span>
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
    // Desenhar o primeiro passo NAO espera quadro de animacao: em aba fora de
    // foco o requestAnimationFrame nao dispara, e o cadastro abria vazio. Quem
    // precisa do quadro e so a transicao de entrada.
    // Sem nada pronto, comeca do comeco. Com o calendario tendo respondido
    // cliente e data, abre direto na primeira pergunta que falta — o passo
    // pulado continua no trilho do topo, a um clique de distancia.
    fcPasso = 0;
    if (inicio.client || inicio.veic || inicio.board) {
      const pendente = FC_PASSOS.findIndex((q) => !fcRespondido(q));
      fcPasso = pendente < 0 ? FC_PASSOS.length - 1 : pendente;
    }
    fcDesenharPasso();
    requestAnimationFrame(() => {
       overlay.classList.add('open');
       
       // Bind title input live update safely
       overlay.addEventListener('keydown', function(e) {
           if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
               e.preventDefault();
               fcSubmit();
           }
       });
       
       // Enter avanca; dentro do briefing ele quebra linha, como se espera.
       overlay.addEventListener('keydown', function(e) {
           if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
               e.preventDefault();
               fcAvancar();
           }
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
