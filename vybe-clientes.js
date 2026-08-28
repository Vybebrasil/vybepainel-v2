// vybe-clientes.js — painel de clientes e cadastro mestre
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Painel Clientes · cadastro mestre integrado ───────────────────────────────────────
function normalizeClientKey(value='') { return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/dados\s*&\s*acessos\s*[-–—:]?\s*/g,'').replace(/[^a-z0-9]/g,''); }
const CLIENT_NAME_ALIASES=Object.freeze({
  acquavile:'Acquaville',
  acquaville:'Acquaville',
  vilareal:'Villa Real',
  villareal:'Villa Real',
  aceassociacaocomercial:'ACE - Associação Comercial de Irecê (ACE)',
  aceassociacaocomercialdeireceace:'ACE - Associação Comercial de Irecê (ACE)',
  associacaocomercial:'ACE - Associação Comercial de Irecê (ACE)',
  prefeituracanarana:'Prefeitura Canarana/BA',
  depjoaobacelar:'João Bacelar',
  joaobacelar:'João Bacelar',
  meninadosoculos:'Óticas Menina dos Óculos',
  oticasmeninadosoculos:'Óticas Menina dos Óculos',
  mangabaai:'Mangaba AI',
  debull:'De Bull',
  diacenter:'DiaCenter',
  dialab:'DiaLab',
  conectasim:'ConectaSim',
  copirece:'Copirecê',
  irecemodas:'Irecê Modas',
  camarotesertao:'Camarote Sertão',
  serragrande:'Serra Grande Bebidas',
  gruposerragrande:'Serra Grande Bebidas',
  experimente:'Experimente Papelaria'
});
function clientMasterCanonicalName(value='') { const original=String(value||'').trim(); return CLIENT_NAME_ALIASES[normalizeClientKey(original)] || original; }
function clientMasterCellText(cell) {
  if(cell==null) return '';
  if(typeof cell==='string') return cell.trim();
  if(cell.text) return String(cell.text).trim();
  if(cell.value) { try { const parsed=JSON.parse(cell.value); return String(parsed?.text || parsed?.url || parsed?.date || parsed?.label || cell.value).trim(); } catch { return String(cell.value).trim(); } }
  return '';
}
function clientMasterRowMap(row) {
  const cols={};
  (row?.column_values||[]).forEach(cell=>{ cols[cell.id]=clientMasterCellText(cell); });
  return cols;
}
function clientMasterClientNameFromAccess(name='') { return String(name).replace(/^dados\s*&\s*acessos\s*[-–—:]?\s*/i,'').trim(); }
function clientMasterFind(rows, clientName, mapper=x=>x) {
  const key=normalizeClientKey(clientName);
  if(!key) return null;
  const exact=rows.find(row=>normalizeClientKey(mapper(row))===key);
  if(exact) return exact;
  return rows.find(row=>{ const candidate=normalizeClientKey(mapper(row)); return candidate.length>=6 && (candidate.includes(key) || key.includes(candidate)); }) || null;
}
async function fetchClientMasterBoard(boardId, columnIds) {
  const query=`{ boards(ids: [${boardId}]) { items_page(limit: 100) { cursor items { id name url created_at updated_at column_values(ids: [${columnIds.map(id=>`"${id}"`).join(',')}]) { id text value } } } } }`;
  const data=await mondayQuery(query,{});
  return data?.boards?.[0]?.items_page?.items || [];
}
async function ensureClientMasterSources(force=false) {
  if(CLIENT_MASTER_LOADING || (CLIENT_MASTER_LOADED && !force)) return;
  CLIENT_MASTER_LOADING=true;
  CLIENT_MASTER_ERROR='';
  try {
    const [heads,accesses]=await Promise.all([fetchClientMasterBoard(BOARD_CLIENTES_ID,CLIENTES_HEADS_COLUMNS),fetchClientMasterBoard(BOARD_ACESSOS_ID,CLIENTES_ACESSOS_COLUMNS)]);
    CLIENT_MASTER_HEADS=heads.map(row=>{ const c=clientMasterRowMap(row); return {id:String(row.id),name:String(row.name||'').trim(),url:row.url||'',updated_at:row.updated_at||'',people:c.multiple_person_mm35kefy,status:c.status,planning:c.link_mkzdvjjs,nextMeeting:c.date_mm35wp7q,createDashboard:c.boolean_mkzkvh6r,dashboard:c.color_mkzkgn5c,plan:c.lista_suspensa9__1,segment:c.dropdown_mkw9njy6}; });
    CLIENT_MASTER_ACESSOS=accesses.map(row=>{ const c=clientMasterRowMap(row); return {id:String(row.id),name:clientMasterClientNameFromAccess(row.name||''),url:row.url||'',updated_at:row.updated_at||'',doc:c.monday_doc__1,drive:c.link6__1,manus:c.boolean_mm3248x2,link:c.link_mm3fwkja}; });
    CLIENT_MASTER_LOADED=true;
  } catch(error) { CLIENT_MASTER_ERROR=error?.message || 'Não foi possível consultar as fontes mestre.'; CLIENT_MASTER_LOADED=false; console.warn('Fontes mestre de CLIENTES indisponíveis:',error); }
  finally { CLIENT_MASTER_LOADING=false; renderClientMasterOverview(); if(CLIENT_MASTER_LOADED) renderClientesBoard(); const current=document.getElementById('cliente-detalhe-nome')?.textContent?.trim(); if(current) renderClientMasterDetail(current); }
}
function clientMasterLinkedData(clientName) {
  const head=clientMasterFind(CLIENT_MASTER_HEADS,clientName,row=>row.name);
  const access=clientMasterFind(CLIENT_MASTER_ACESSOS,clientName,row=>row.name);
  return {head:head?.people||'',status:head?.status||'',segment:head?.segment||'',plan:head?.plan||'',dashboard:head?.dashboard||'',nextMeeting:head?.nextMeeting||'',planning:head?.planning||'',headUrl:head?.url||'',doc:access?.doc||'',drive:access?.drive||'',manus:access?.manus||'',link:access?.link||'',accessUrl:access?.url||''};
}
function clientMasterResolveName(value='') {
  const original=String(value||'').trim();
  const canonical=clientMasterCanonicalName(original);
  const key=normalizeClientKey(canonical);
  if(!key) return original;
  if(CLIENT_NAME_ALIASES[normalizeClientKey(original)]) return canonical;
  const sources=[...CLIENT_MASTER_HEADS,...CLIENT_MASTER_ACESSOS];
  const exact=sources.find(row=>normalizeClientKey(row.name)===key);
  if(exact) return exact.name;
  const fuzzy=sources.find(row=>{ const candidate=normalizeClientKey(row.name); return candidate.length>=6 && (candidate.includes(key) || key.includes(candidate)); });
  return fuzzy?.name || canonical;
}
function clientMasterRecords() {
  const rawItems=typeof unifiedOperationalItems==='function' ? unifiedOperationalItems() : [...(DADOS_ALL?.length ? DADOS_ALL : DADOS || []), ...(DADOS_DEMANDAS || [])];
  const items=rawItems.map(item=>({...item,__clientMasterName:clientMasterResolveName(item.cliente)}));
  const names=[...new Set([...items.map(item=>item.__clientMasterName),...CLIENT_MASTER_HEADS.map(row=>clientMasterResolveName(row.name)),...CLIENT_MASTER_ACESSOS.map(row=>clientMasterResolveName(row.name))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const done=['Feito','Finalizado','feito','finalizado','Concluídas','concluída'];
  return names.map(name=>{
    const clientItems=items.filter(item=>item.__clientMasterName===name);
    const content=clientItems.filter(item=>!isRequestItem(item));
    const requests=clientItems.filter(item=>isRequestItem(item));
    const active=clientItems.filter(item=>!done.includes(String(item.status||'')));
    const meta=clientMasterLinkedData(name);
    return {name,items:clientItems,content,requests,active,activeCount:active.length,meta};
  });
}
function clientMasterValue(value,fallback='Pendente de sincronização') { return value ? safeText(value) : `<span class="pending">${fallback}</span>`; }
function renderClientMasterOverview() {
  const records=clientMasterRecords();
  const active=records.filter(record=>record.activeCount>0).length;
  const content=records.reduce((sum,record)=>sum+record.content.length,0);
  const requests=records.reduce((sum,record)=>sum+record.requests.length,0);
  const activeRequests=records.reduce((sum,record)=>sum+record.requests.filter(item=>!['Feito','Finalizado','feito','finalizado','Concluídas'].includes(String(item.status||''))).length,0);
  const kpi=document.getElementById('client-master-kpis');
  if(kpi) kpi.innerHTML=[
    {value:records.length,label:'Clientes encontrados',sub:'derivados das fontes operacionais'},
    {value:active,label:'Contas com operação ativa',sub:'com itens ainda abertos'},
    {value:content,label:'Conteúdos vinculados',sub:'Produção de Conteúdo'},
    {value:requests,label:'Solicitações vinculadas',sub:`${activeRequests} ainda abertas`}
  ].map(item=>`<div class="client-master-kpi"><b>${item.value}</b><span>${item.label}</span><small>${item.sub}</small></div>`).join('');
  const rail=document.getElementById('client-master-source-rail');
  if(rail) { const headsState=CLIENT_MASTER_ERROR?'ERRO NA FONTE':CLIENT_MASTER_LOADING?'CARREGANDO...':CLIENT_MASTER_LOADED?`${CLIENT_MASTER_HEADS.length} CONTAS SINCRONIZADAS`:'AGUARDANDO CARGA'; const accessState=CLIENT_MASTER_ERROR?'ERRO NA FONTE':CLIENT_MASTER_LOADING?'CARREGANDO...':CLIENT_MASTER_LOADED?`${CLIENT_MASTER_ACESSOS.length} REGISTROS SINCRONIZADOS`:'AGUARDANDO CARGA'; rail.innerHTML=`<div class="client-source-card connected"><div><b>OPERAÇÃO</b><span>Produção + Solicitações integradas</span></div><em>● CONECTADA</em></div><div class="client-source-card ${CLIENT_MASTER_LOADED&&!CLIENT_MASTER_ERROR?'connected':''}"><div><b>GESTÃO DE CLIENTES (HEADS)</b><span>Status, heads, plano, segmento e reuniões</span></div><em>${headsState}</em></div><div class="client-source-card ${CLIENT_MASTER_LOADED&&!CLIENT_MASTER_ERROR?'connected':''}"><div><b>DADOS & ACESSOS</b><span>Drive, documentos e referências operacionais</span></div><em>${accessState}</em></div>`; }
}
function renderClientMasterDetail(cli) {
  const record=clientMasterRecords().find(item=>item.name===cli || normalizeClientKey(item.name)===normalizeClientKey(cli));
  const node=document.getElementById('client-master-detail');
  if(!node || !record) return;
  const meta=record.meta || {};
  const sourceNote=CLIENT_MASTER_ERROR?'A fonte mestre não respondeu; os dados operacionais continuam disponíveis.':CLIENT_MASTER_LOADED?'Dados conectados aos boards oficiais do Monday.':'Carregando as fontes oficiais de Heads e Acessos...';
  node.innerHTML=`<div class="client-master-detail-card"><h3>${safeText(record.name)}</h3><p>Ficha mestre da conta · ${sourceNote}</p><div class="client-master-detail-grid"><div class="client-master-detail-field"><small>Status da conta</small><b>${clientMasterValue(meta.status || (record.activeCount ? 'Ativa na operação' : 'Sem itens ativos'))}</b></div><div class="client-master-detail-field"><small>Head / responsável</small><b>${clientMasterValue(meta.head)}</b></div><div class="client-master-detail-field"><small>Segmento</small><b>${clientMasterValue(meta.segment)}</b></div><div class="client-master-detail-field"><small>Plano</small><b>${clientMasterValue(meta.plan)}</b></div></div></div><div class="client-master-detail-card"><h3>Dados da conta</h3><p>Referências operacionais vinculadas ao cliente, sem expor credenciais diretamente na interface.</p><div class="client-master-detail-grid"><div class="client-master-detail-field"><small>Dashboard</small><b>${clientMasterValue(meta.dashboard)}</b></div><div class="client-master-detail-field"><small>Próxima reunião</small><b>${clientMasterValue(meta.nextMeeting)}</b></div><div class="client-master-detail-field"><small>Drive / documentos</small><b>${clientMasterValue(meta.drive || meta.doc)}</b></div><div class="client-master-detail-field"><small>Manus / link operacional</small><b>${clientMasterValue(meta.link || (meta.manus ? 'Disponível' : ''))}</b></div></div></div>`;
}
function renderClientesBoard() {
  // Garantir que ambos os dados estejam carregados
  if (DADOS_DEMANDAS.length === 0) {
    refreshDemandas().then(() => renderClientesBoard());
    return;
  }
  // O cadastro mestre é derivado das duas fontes operacionais e mantém cada origem explícita.
  renderClientMasterOverview();
  void ensureClientMasterSources();
  const todosClientes = clientMasterRecords().map(record=>record.name);
  // KPIs
  document.getElementById('kpi-grid-clientes').innerHTML = [
    {label:'Clientes Ativos', value:todosClientes.length, sub:'com dados', cls:'purple'},
    {label:'Produção', value:DADOS.length, sub:'conteúdos', cls:'green'},
    {label:'Demandas', value:DADOS_DEMANDAS.length, sub:'solicitações', cls:'blue'},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');
  // Renderizar lista
  renderClientesLista(todosClientes);
}

function renderClientesLista(clientes) {
  const grid = document.getElementById('grid-clientes-lista');
  const registros = clientMasterRecords();
  grid.innerHTML = clientes.map(cli => {
    const record=registros.find(item=>item.name===cli) || {content:[],requests:[]};
    const nProd = record.content.filter(d => d.status !== 'Finalizado' && d.status !== 'finalizado').length;
    const STATUS_CONCLUIDO = ['Feito','Finalizado','feito','finalizado','Concluídas'];
    const demandasAtivas = record.requests.filter(d => !STATUS_CONCLUIDO.includes(d.status));
    const nDem  = demandasAtivas.length;
    const atrasadas = demandasAtivas.filter(d => d.prazo_atrasado).length;
    const alertCls = atrasadas > 0 ? 'alert-low' : nProd > 0 ? 'alert-ok' : 'alert-empty';
    return `<div class="client-card ${alertCls}" style="cursor:pointer;" onclick="abrirClienteDetalhe('${cli.replace(/'/g,"\\'")}')">  
      <div class="client-header">
        <div class="client-name">${cli}</div>
        <div class="client-meta">
          <span class="posts-count ok" title="Conteúdos de produção">📸 ${nProd}</span>
          <span class="posts-count ${atrasadas>0?'empty':'ok'}" title="Demandas">📋 ${nDem}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterClientesList(query) {
  const clientesAtivos = clientMasterRecords().map(record=>record.name);
  const clientes = clientesAtivos.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  renderClientesLista(clientes);
}

function abrirClienteDetalhe(cli) {
  document.getElementById('panel-clientes-lista').style.display  = 'none';
  document.getElementById('panel-cliente-detalhe').style.display = '';
  document.getElementById('cliente-detalhe-nome').textContent    = cli;
  renderClientMasterDetail(cli);
  const registros=clientMasterRecords();
  const record=registros.find(item=>item.name===cli) || {content:[],requests:[]};
  // Produção
  // Usar DADOS_ALL para mostrar todos os conteúdos, não apenas os da semana atual
  const prodItems = record.content.filter(d => d.status !== 'Finalizado' && d.status !== 'finalizado');
  const gridProd = document.getElementById('grid-cliente-producao');
  if (prodItems.length === 0) {
    gridProd.innerHTML = '<div style="color:var(--text-muted);padding:12px 0;">Nenhum conteúdo de produção.</div>';
  } else {
    // Agrupar por mês/ano de veiculacao
    const byMonth = {};
    const semData = [];
    prodItems.forEach(d => {
      if (!d.veiculacao_iso) { semData.push(d); return; }
      const key = d.veiculacao_iso.slice(0,7); // YYYY-MM
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    });
    const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const sortedMonths = Object.keys(byMonth).sort(); // mais antigo primeiro (crescente)
    const allGroups = sortedMonths.map(k => {
      const [y,m] = k.split('-');
      const label = `${MESES[parseInt(m)-1]} ${y}`;
      const isCurrentWeek = byMonth[k].some(d => d.semana === 1 || d.semana === 2);
      return { label: isCurrentWeek ? `★ ${label} (Esta semana)` : label, items: byMonth[k].sort((a,b)=>(a.veiculacao_iso||'').localeCompare(b.veiculacao_iso||'')) };
    });
    if (semData.length > 0) allGroups.push({ label: 'Sem data de veiculação', items: semData });
    gridProd.innerHTML = allGroups.map(g => `
      <div class="demanda-group-card">
        <div class="demanda-group-header"><div class="demanda-group-title">📅 ${g.label}</div><span class="posts-count ok">${g.items.length}</span></div>
        <div class="item-list">${g.items.map(d => `
          <div class="item-row">
            ${fmtHtml(d.formato)}
            <button type="button" class="item-name item-workspace-link" style="flex:1;" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}</button>
            <span class="item-date">${d.veiculacao||'—'}</span>
            ${pillHtml(d.status, d.status_color, d.status_border)}
            <span class="item-resp">${firstName(d.responsavel)}</span>
          </div>`).join('')}</div>
      </div>`).join('');
  }
  // Demandas
  const STATUS_CONCLUIDO = ['Feito','Finalizado','feito','finalizado'];
  const demItems = sortDemandas(record.requests.filter(d => !STATUS_CONCLUIDO.includes(d.status)));
  const gridDem = document.getElementById('grid-cliente-demandas');
  if (demItems.length === 0) {
    gridDem.innerHTML = '<div style="color:var(--text-muted);padding:12px 0;">Nenhuma demanda.</div>';
  } else {
    gridDem.innerHTML = `<div class="demanda-group-card"><div class="item-list">${demItems.map(d=>demandaItemRow(d,false)).join('')}</div></div>`;
  }
}

function voltarClientesLista() {
  document.getElementById('panel-clientes-lista').style.display  = '';
  document.getElementById('panel-cliente-detalhe').style.display = 'none';
}

// ─── Filtros de demandas ────────────────────────────────────────────────────────────────────
// Filtro por status via legenda (toggle)
function filterDemandaByStatusLegend(status, pill) {
  if (currentDemandaStatusFilter === status) {
    // Toggle off
    currentDemandaStatusFilter = 'all';
    document.querySelectorAll('#demanda-status-legend .pill').forEach(p => p.classList.remove('active-legend'));
  } else {
    currentDemandaStatusFilter = status;
    document.querySelectorAll('#demanda-status-legend .pill').forEach(p => p.classList.remove('active-legend'));
    pill.classList.add('active-legend');
  }
  renderDemandas();
}

function filterDemandaByPerson(personId, wrap) {
  currentDemandaPersonFilter = personId;
  document.querySelectorAll('#person-filter-bar-demandas .person-chip').forEach(c => c.classList.remove('active'));
  const chip = wrap.querySelector('.person-chip');
  if (chip) chip.classList.add('active');
  renderDemandas();
}

function clearDemandaFilters() {
  currentDemandaStatusFilter = 'all';
  currentDemandaPersonFilter = 'all';
  currentDemandaDayFilter = '';
  document.querySelectorAll('#demanda-status-legend .pill').forEach(p => p.classList.remove('active-legend'));
  document.querySelectorAll('#person-filter-bar-demandas .person-chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('#person-all-demandas .person-chip');
  if (allChip) allChip.classList.add('active');
  const sel = document.getElementById('day-select-demandas');
  if (sel) sel.value = '';
  renderDemandas();
}

function buildDemandaPersonFilter() {
  const bar = document.getElementById('person-filter-bar-demandas');
  const activePeople = new Set();
  DADOS_DEMANDAS.forEach(d => {
    if (d.responsavel_ids && d.responsavel_ids.length > 0) d.responsavel_ids.forEach(id => activePeople.add(id));
    else if (d.responsavel_id) activePeople.add(d.responsavel_id);
  });
  const existing = bar.querySelectorAll('.person-wrap:not(#person-all-demandas)');
  existing.forEach(e => e.remove());
  TEAM_USERS.forEach(u => {
    if (!activePeople.has(u.id)) return;
    const wrap = document.createElement('div');
    wrap.className = 'person-wrap';
    wrap.title = u.name;
    wrap.onclick = () => filterDemandaByPerson(u.id, wrap);
    const chip = document.createElement('span');
    chip.className = 'person-chip';
    chip.style.background = u.color;
    chip.style.color = '#fff';
    chip.textContent = u.name;
    wrap.appendChild(chip);
    bar.appendChild(wrap);
  });
}

// Dispatcher unificado — chamado pelo botão Atualizar Dados
function refreshData() {
  if (activeBoard === 'demandas') {
    // Sempre recarregar Produção também (necessário para o Diário e Clientes)
    DADOS_DEMANDAS = [];
    Promise.all([refreshProducao({force:true,source:'manual'}), refreshDemandas()]);
  } else if (activeBoard === 'clientes') {
    DADOS = []; DADOS_DEMANDAS = [];
    Promise.all([refreshProducao({force:true,source:'manual'}), refreshDemandas()]).then(() => renderClientesBoard());
  } else if (activeBoard === 'diario') {
    // O Diário precisa de dados de Produção atualizados
    refreshProducao({force:true,source:'manual'});
  } else {
    refreshProducao({force:true,source:'manual'});
  }
}

