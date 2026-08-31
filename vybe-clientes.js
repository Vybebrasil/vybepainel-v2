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
// Aproximacao entre nomes so vale quando OS DOIS lados sao longos.
//
// A regra antiga exigia 6 letras so do candidato. Com isso "ACE" caia dentro de
// "diACEnter" e herdava a ficha inteira da DiaCenter — head, segmento, painel —
// como se fosse a mesma conta. "CMO" fazia o mesmo com qualquer nome que
// tivesse "cmo" no meio. Nome curto agora so casa exato; "Brussolo" dentro de
// "Restaurante Brussolo", que e o caso que a aproximacao existe para resolver,
// continua casando.
const LETRAS_PARA_APROXIMAR = 6;
function nomesSeAproximam(chaveA, chaveB) {
  if(!chaveA || !chaveB) return false;
  if(chaveA.length < LETRAS_PARA_APROXIMAR || chaveB.length < LETRAS_PARA_APROXIMAR) return false;
  return chaveA.includes(chaveB) || chaveB.includes(chaveA);
}
function clientMasterFind(rows, clientName, mapper=x=>x) {
  const key=normalizeClientKey(clientName);
  if(!key) return null;
  const exact=rows.find(row=>normalizeClientKey(mapper(row))===key);
  if(exact) return exact;
  return rows.find(row=>nomesSeAproximam(normalizeClientKey(mapper(row)), key)) || null;
}
async function ensureClientMasterSources(force=false) {
  if(CLIENT_MASTER_LOADING || (CLIENT_MASTER_LOADED && !force)) return;
  CLIENT_MASTER_LOADING=true;
  CLIENT_MASTER_ERROR='';
  try {
    const resposta=await fetch('/api/painel?area=clientes',{credentials:'same-origin',cache:'no-store'});
    const corpo=await resposta.json();
    if(!resposta.ok) throw new Error(corpo?.error || `Cadastro mestre indisponível (${resposta.status})`);
    CADASTRO_CLIENTES=corpo.clientes || [];
    CLIENT_MASTER_HEADS=CADASTRO_CLIENTES.map(row=>({
      id:String(row.id),name:String(row.nome||'').trim(),url:'',updated_at:'',
      people:row.heads||row.responsavel||'',status:row.status||(row.ativo?'Ativo':'Inativo'),
      planning:row.planejamento_url||'',nextMeeting:row.proxima_reuniao||'',
      dashboard:row.dashboard||'',plan:row.plano||'',segment:row.segmento||''
    }));
    CLIENT_MASTER_ACESSOS=(corpo.acessos||[]).map(row=>({
      id:String(row.id),name:String(row.cliente||clientMasterClientNameFromAccess(row.nome||'')).trim(),
      url:'',updated_at:row.atualizado_em||'',doc:row.documento?'Documento migrado':'',
      drive:row.drive||'',manus:row.manus?'Disponível':'',link:row.link||''
    }));
    CLIENT_MASTER_LOADED=true;
  } catch(error) {
    CLIENT_MASTER_ERROR=error?.message || 'Não foi possível consultar o cadastro mestre Vybe.';
    CLIENT_MASTER_LOADED=false;
    console.warn('Cadastro mestre próprio indisponível:',error);
  } finally {
    CLIENT_MASTER_LOADING=false;
    renderClientMasterOverview();
    if(CLIENT_MASTER_LOADED) renderClientesBoard();
    const current=document.getElementById('cliente-detalhe-nome')?.textContent?.trim();
    if(current) renderClientMasterDetail(current);
  }
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
  const fuzzy=sources.find(row=>nomesSeAproximam(normalizeClientKey(row.name), key));
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
    {value:records.length,label:'Clientes encontrados',sub:'cadastro mestre do Vybe OS'},
    {value:active,label:'Contas com operação ativa',sub:'com itens ainda abertos'},
    {value:content,label:'Conteúdos vinculados',sub:'Produção de Conteúdo'},
    {value:requests,label:'Solicitações vinculadas',sub:`${activeRequests} ainda abertas`}
  ].map(item=>`<div class="client-master-kpi"><b>${item.value}</b><span>${item.label}</span><small>${item.sub}</small></div>`).join('');
  const rail=document.getElementById('client-master-source-rail');
  if(rail) { const headsState=CLIENT_MASTER_ERROR?'ERRO NA BASE':CLIENT_MASTER_LOADING?'CARREGANDO...':CLIENT_MASTER_LOADED?`${CLIENT_MASTER_HEADS.length} CONTAS NO VYBE`:'AGUARDANDO CARGA'; const accessState=CLIENT_MASTER_ERROR?'ERRO NA BASE':CLIENT_MASTER_LOADING?'CARREGANDO...':CLIENT_MASTER_LOADED?`${CLIENT_MASTER_ACESSOS.length} REGISTROS NO VYBE`:'AGUARDANDO CARGA'; rail.innerHTML=`<div class="client-source-card connected"><div><b>Operação</b><span>Produção + Solicitações integradas</span></div><em>● BANCO VYBE</em></div><div class="client-source-card ${CLIENT_MASTER_LOADED&&!CLIENT_MASTER_ERROR?'connected':''}"><div><b>GESTÃO DE CLIENTES (HEADS)</b><span>Status, heads, plano, segmento e reuniões</span></div><em>${headsState}</em></div><div class="client-source-card ${CLIENT_MASTER_LOADED&&!CLIENT_MASTER_ERROR?'connected':''}"><div><b>Dados & acessos</b><span>Drive, documentos e referências operacionais</span></div><em>${accessState}</em></div>`; }
}
function renderClientMasterDetail(cli) {
  const record=clientMasterRecords().find(item=>item.name===cli || normalizeClientKey(item.name)===normalizeClientKey(cli));
  const node=document.getElementById('client-master-detail');
  if(!node || !record) return;
  const meta=record.meta || {};
  const sourceNote=CLIENT_MASTER_ERROR?'O cadastro mestre não respondeu; os dados operacionais continuam disponíveis.':CLIENT_MASTER_LOADED?'Dados servidos pelo cadastro mestre do Vybe OS.':'Carregando Heads e Acessos do banco Vybe...';
  node.innerHTML=`<div class="client-master-detail-card"><h3>${safeText(record.name)}</h3><p>Ficha mestre da conta · ${sourceNote}</p><div class="client-master-detail-grid"><div class="client-master-detail-field"><small>Status da conta</small><b>${clientMasterValue(meta.status || (record.activeCount ? 'Ativa na operação' : 'Sem itens ativos'))}</b></div><div class="client-master-detail-field"><small>Head / responsável</small><b>${clientMasterValue(meta.head)}</b></div><div class="client-master-detail-field"><small>Segmento</small><b>${clientMasterValue(meta.segment)}</b></div><div class="client-master-detail-field"><small>Plano</small><b>${clientMasterValue(meta.plan)}</b></div></div></div><div class="client-master-detail-card"><h3>Dados da conta</h3><p>Referências operacionais vinculadas ao cliente, sem expor credenciais diretamente na interface.</p><div class="client-master-detail-grid"><div class="client-master-detail-field"><small>Dashboard</small><b>${clientMasterValue(meta.dashboard)}</b></div><div class="client-master-detail-field"><small>Próxima reunião</small><b>${clientMasterValue(meta.nextMeeting)}</b></div><div class="client-master-detail-field"><small>Drive / documentos</small><b>${clientMasterValue(meta.drive || meta.doc)}</b></div><div class="client-master-detail-field"><small>Manus / link operacional</small><b>${clientMasterValue(meta.link || (meta.manus ? 'Disponível' : ''))}</b></div></div></div>`;
}
// ── ficha do cliente ─────────────────────────────────────────────────────────
//
// Contato, CNPJ, plano, segmento, valor e head vinham do board "Gestão de
// Clientes" e só existiam no Monday. Agora estão no nosso banco, e a tela que já
// mostrava a operação de cada cliente passa a mostrar quem ele é.
let CADASTRO_CLIENTES = [];

async function carregarCadastroClientes() {
  await ensureClientMasterSources();
}

function fichaDoCliente(nome) {
  const alvo = String(nome || '').toLowerCase();
  return CADASTRO_CLIENTES.find((c) => String(c.nome).toLowerCase() === alvo) || null;
}

function fichaClienteHtml(nome) {
  const f = fichaDoCliente(nome);
  if (!f) return '';
  const brl = (v) => (v === null || v === undefined ? null
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)));
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : null; };
  const linhas = [
    ['Plano', f.plano], ['Segmento', f.segmento], ['Head', f.heads],
    ['Responsável', f.responsavel], ['Valor', brl(f.valor)],
    ['Próx. reunião', dataBr(f.proxima_reuniao)],
    ['E-mail', f.email], ['Telefone', f.telefone], ['CNPJ', f.cnpj], ['Endereço', f.endereco],
  ].filter(([, v]) => v);
  const planejamentoBruto = String(f.planejamento_url || '').trim();
  let planejamentoUrl = '';
  try {
    const analisada = new URL(planejamentoBruto);
    if (['http:', 'https:'].includes(analisada.protocol) && analisada.hostname && analisada.hostname.includes('.')) {
      planejamentoUrl = analisada.href;
    }
  } catch (_) {}
  // Ativo/inativo, painel e onde estao os acessos — as tres perguntas que se faz
  // olhando a lista, e que so tinham resposta abrindo o cliente ou o Monday.
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const selos = [
    ['Drive', ligado.drive],
    ['Acessos', ligado.link],
    ['Planejamento', planejamentoUrl || ligado.planning],
  ].map(([rotulo, valor]) => [rotulo, linkDeCliente(valor)]).filter(([, url]) => url);
  // O painel do cliente e estado, nao endereco: "Atualizado" ou "Desatualizado".
  const painel = String(f.dashboard || ligado.dashboard || '').trim();
  const situacao = String(ligado.status || '').trim();
  const cabecaDeSelos = (situacao || painel || selos.length || ligado.doc) ? `<div class="cliente-selos">${
      situacao ? `<span class="cliente-situacao ${/inativ/i.test(situacao) ? 'inativo' : 'ativo'}">${safeText(situacao)}</span>` : ''
    }${painel ? `<span class="cli-painel ${/desatualiz/i.test(painel) ? 'velho' : 'novo'}"
        title="Estado do painel do cliente">Painel: ${safeText(painel)}</span>` : ''
    }${selos.map(([rotulo, url]) => `<a class="cliente-selo" href="${safeText(url)}" target="_blank"
        rel="noopener" onclick="event.stopPropagation()" title="Abrir ${safeText(rotulo)} deste cliente">${safeText(rotulo)} ↗</a>`).join('')
    }${ligado.doc ? `<span class="cliente-selo quieto" title="Documento de acessos migrado para o Vybe">Documento</span>` : ''}</div>` : '';

  if (!linhas.length && !cabecaDeSelos) return '';
  return `${cabecaDeSelos}<div class="cliente-ficha">${
    linhas.map(([r, v]) => `<div><span>${safeText(r)}</span><b>${safeText(v)}</b></div>`).join('')
  }</div>`;
}

// So vira link o que e endereco de verdade. Campo com "sim", "ok" ou o nome de
// uma pasta viraria um link quebrado, e link quebrado e pior que campo vazio:
// promete uma resposta e devolve erro.
function linkDeCliente(valor) {
  const bruto = String(valor || '').trim();
  if (!bruto) return '';
  try {
    const url = new URL(bruto);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (!url.hostname || !url.hostname.includes('.')) return '';
    return url.href;
  } catch { return ''; }
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
  if (!CADASTRO_CLIENTES.length) { carregarCadastroClientes().then(() => renderClientesLista(clientMasterRecords().map((r) => r.name))); }
  const todosClientes = clientMasterRecords().map(record=>record.name);
  // KPIs
  // "Ativos" e o que o cadastro diz, nao a soma de todo nome que ja apareceu.
  const ativosNoCadastro = CADASTRO_CLIENTES.filter((c) =>
    String(c.status || '').trim() && !/inativ/i.test(c.status)).length;
  document.getElementById('kpi-grid-clientes').innerHTML = [
    {label:'Clientes Ativos', value:ativosNoCadastro || todosClientes.length, sub:'no cadastro', cls:'purple'},
    {label:'Produção', value:DADOS.length, sub:'conteúdos', cls:'green'},
    {label:'Demandas', value:DADOS_DEMANDAS.length, sub:'solicitações', cls:'blue'},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');
  // Renderizar lista
  renderClientesLista(todosClientes);
}

// A tabela de clientes, como no Monday que o time conhece: Ativos e Inativos
// separados, e numa linha so o que se pergunta olhando a lista — head, status,
// se o painel esta atualizado, planejamento, proxima reuniao, plano, segmento e
// as portas do Dados & Acessos.
//
// O cartao continua para quem prefere; a escolha fica guardada no navegador.
function visaoDeClientes() {
  try { return localStorage.getItem('vybe_clientes_visao') === 'fichas' ? 'fichas' : 'tabela'; }
  catch { return 'tabela'; }
}
function trocarVisaoDeClientes(qual) {
  try { localStorage.setItem('vybe_clientes_visao', qual); } catch { /* sem armazenamento */ }
  renderClientesBoard();
}

function selosDeVisaoDeClientes() {
  const alvo = document.getElementById('clientes-visao');
  if (!alvo) return;
  const atual = visaoDeClientes();
  alvo.innerHTML = [['tabela', 'Tabela'], ['fichas', 'Fichas']].map(([id, rotulo]) =>
    `<button type="button" class="clientes-visao-btn ${atual === id ? 'ativo' : ''}"
      onclick="trocarVisaoDeClientes('${id}')">${rotulo}</button>`).join('')
    + (podeEditarClientes() ? `<button type="button" class="clientes-visao-btn novo"
        title="Cadastrar um cliente novo" onclick="novoClienteNoPainel()">+ Cliente</button>` : '');
}

// "Dashboard" no cadastro NAO e endereco: e o estado do painel do cliente,
// "Atualizado" ou "Desatualizado", igual ao Monday. Eu tinha tratado como link
// no cartao — ficava invisivel, porque texto nunca vira URL valida.
//
// A segunda armadilha foi escrita: metade dos cadastros veio do Monday com
// "Dasatualizado", com A. Procurar por "desatualiz" nao achava, e esses
// clientes apareciam VERDES — o oposto do que dizia o cadastro. Aqui o verde
// so acontece quando o texto realmente comeca por "atualizado".
function painelEstaEmDia(valor) {
  const limpo = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /^atualizad/.test(limpo) || /(em dia|ok)$/.test(limpo);
}
function paineldoClienteHtml(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '<span class="cli-vazio">—</span>';
  return `<span class="cli-painel ${painelEstaEmDia(texto) ? 'novo' : 'velho'}">${safeText(texto)}</span>`;
}

// ── Minimizar os blocos ───────────────────────────────────────────────────────
// Sao 47 ativos e 24 inativos: aberto de uma vez, para chegar aos inativos era
// preciso rolar a lista inteira. Agora cada bloco fecha, e o painel lembra como
// estava — os inativos ja nascem fechados, porque quase nunca sao o que se
// procura.
function blocosFechadosDeClientes() {
  try { return new Set(JSON.parse(localStorage.getItem('vybe_clientes_blocos') || '["inativos"]')); }
  catch { return new Set(['inativos']); }
}
function alternarBlocoDeClientes(id, botao) {
  const bloco = botao?.closest('.cli-bloco');
  if (!bloco) return;
  const fechado = bloco.classList.toggle('fechado');
  botao.setAttribute('aria-expanded', fechado ? 'false' : 'true');
  const guardados = blocosFechadosDeClientes();
  if (fechado) guardados.add(id); else guardados.delete(id);
  try { localStorage.setItem('vybe_clientes_blocos', JSON.stringify([...guardados])); }
  catch { /* sem armazenamento */ }
}

// Quem edita cliente e quem administra — o servidor recusa o resto de qualquer
// forma, entao o botao nem aparece para os outros.
function podeEditarClientes() {
  return typeof podeAdministrar === 'function' ? podeAdministrar() : false;
}

// O cadastro e a tabela nem sempre chamam o cliente pelo mesmo nome: a tabela
// mostra o nome canonico, e o cadastro guarda como foi digitado. Comparar as
// duas pontas pela mesma regra e o que faz a linha achar a ficha dela.
function chaveDeCliente(nome) {
  const canonico = typeof clientMasterResolveName === 'function' ? clientMasterResolveName(nome) : nome;
  return typeof normalizeClientKey === 'function' ? normalizeClientKey(canonico) : String(canonico || '').toLowerCase();
}
function cadastroDoCliente(nome) {
  const exato = fichaDoCliente(nome);
  if (exato) return exato;
  const chave = chaveDeCliente(nome);
  return chave ? CADASTRO_CLIENTES.find((c) => chaveDeCliente(c.nome) === chave) || null : null;
}
function idDoCliente(nome) {
  const c = cadastroDoCliente(nome);
  return c?.id ? String(c.id) : '';
}

function linhaDeClienteHtml(nome, semCadastro) {
  const f = cadastroDoCliente(nome) || {};
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const registros = clientMasterRecords();
  const record = registros.find((item) => item.name === nome) || { content: [], requests: [] };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas'];
  const abertos = record.content.filter((d) => !CONCLUIDO.includes(d.status)).length;
  const demandas = record.requests.filter((d) => !CONCLUIDO.includes(d.status)).length;
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const porta = (rotulo, valor) => { const url = linkDeCliente(valor);
    return url ? `<a class="cli-porta" href="${safeText(url)}" target="_blank" rel="noopener"
      onclick="event.stopPropagation()" title="Abrir ${safeText(rotulo)}">${safeText(rotulo)} ↗</a>` : ''; };
  const portas = [porta('Drive', ligado.drive), porta('Acessos', ligado.link),
                  porta('Planejamento', f.planejamento_url || ligado.planning)]
                 .filter(Boolean).join('') || '<span class="cli-vazio">—</span>';
  const aspas = String(nome).replace(/'/g, "\\'");
  const lapis = !podeEditarClientes() ? ''
    : semCadastro
      ? `<button type="button" class="cli-lapis criar" title="Criar a ficha de ${safeText(nome)} no cadastro"
          onclick="event.stopPropagation();cadastrarClienteDaOperacao('${aspas}')">Cadastrar</button>`
      : `<button type="button" class="cli-lapis" title="Editar o cadastro de ${safeText(nome)}"
          onclick="event.stopPropagation();abrirFichaDeCliente('${aspas}')">Editar</button>`;
  return `<tr onclick="abrirClienteDetalhe('${aspas}')" title="Abrir ${safeText(nome)}">
    <td class="cli-nome">${safeText(nome)}</td>
    <td>${safeText(f.heads || ligado.head || '') || '<span class="cli-vazio">—</span>'}</td>
    <td>${paineldoClienteHtml(f.dashboard || ligado.dashboard)}</td>
    <td>${dataBr(f.proxima_reuniao || ligado.nextMeeting) || '<span class="cli-vazio">—</span>'}</td>
    <td>${safeText(f.plano || ligado.plan || '') || '<span class="cli-vazio">—</span>'}</td>
    <td>${safeText(f.segmento || ligado.segment || '') || '<span class="cli-vazio">—</span>'}</td>
    <td><div class="cli-portas">${portas}${ligado.doc ? '<span class="cli-porta quieto" title="Documento de acessos guardado no Vybe">Documento</span>' : ''}</div></td>
    <td><div class="cli-numeros"><span title="Conteúdos em aberto">${abertos}</span><span title="Solicitações em aberto" class="${demandas ? 'atencao' : ''}">${demandas}</span></div></td>
    <td class="cli-acoes">${lapis}</td>
  </tr>`;
}

// Ativo e inativo sao o que o CADASTRO diz — nada mais.
//
// Ter uma linha em vybe_clientes nao quer dizer estar cadastrado: a importacao
// dos quadros de conteudo cria uma linha para todo nome que aparece numa peca,
// so com o nome (`INSERT INTO vybe_clientes (nome)`). Essas linhas nascem com
// ativo=true e status vazio, e era por isso que a lista dizia 36 ativos onde o
// quadro de Heads tem 17: ACE, CMO, Freela, feijao panela de ouro — nomes que a
// operacao criou sozinha, nunca cadastrados por ninguem.
//
// O que separa os dois e o STATUS preenchido: quem veio do quadro de Heads tem
// "Ativo" ou "Inativo" escrito, e a partir de agora quem for cadastrado aqui
// tambem. Linha sem status e so um nome — vai para "So na operacao", que e
// exatamente a lista do que falta cadastrar, com um botao para fazer isso.
function tabelaDeClientesHtml(clientes) {
  const nomeVale = (nome) => /[a-z0-9]/i.test(String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const situacao = (nome) => {
    const f = cadastroDoCliente(nome);
    if (!f) return 'sem';
    const texto = String(f.status || '').trim();
    if (texto) return /inativ/i.test(texto) ? 'inativos' : 'ativos';
    // Sem status: linha criada pela importacao. So conta como inativo se alguem
    // tirou do painel de proposito; fora isso, nunca foi cadastrada.
    return f.ativo === false ? 'inativos' : 'sem';
  };
  const caixas = { ativos: [], inativos: [], sem: [] };
  clientes.filter(nomeVale).forEach((nome) => caixas[situacao(nome)].push(nome));
  const fechados = blocosFechadosDeClientes();
  const bloco = (titulo, lista, classe, recado) => !lista.length ? '' : `
    <section class="cli-bloco ${classe}${fechados.has(classe) ? ' fechado' : ''}">
      <button type="button" class="cli-bloco-cabeca" aria-expanded="${fechados.has(classe) ? 'false' : 'true'}"
        onclick="alternarBlocoDeClientes('${classe}', this)"
        title="${fechados.has(classe) ? 'Abrir' : 'Minimizar'} a lista de ${titulo.toLowerCase()}">
        <span class="cli-seta" aria-hidden="true">▾</span>
        <b>${titulo}</b><small>${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}</small>
        ${recado ? `<em class="cli-recado">${recado}</em>` : ''}
      </button>
      <div class="cli-bloco-corpo"><div class="grupo-tabela-rolagem"><table class="grupo-tabela cli-tabela"><thead><tr>
        <th>Cliente</th><th>Head</th><th>Dashboard</th><th>Próx. reunião</th>
        <th>Plano</th><th>Segmento</th><th>Dados &amp; acessos</th><th>Aberto</th><th></th>
      </tr></thead><tbody>${lista.map((n) => linhaDeClienteHtml(n, classe === 'sem')).join('')}</tbody></table></div></div>
    </section>`;
  return bloco('Ativos', caixas.ativos, 'ativos')
    + bloco('Inativos', caixas.inativos, 'inativos')
    + bloco('Só na operação', caixas.sem, 'sem',
        'aparecem em conteúdos, solicitações ou no Drive, mas não têm ficha no cadastro')
    || '<div class="grupos-vazio">Nenhum cliente encontrado.</div>';
}

// ── Editar e adicionar cliente ────────────────────────────────────────────────
// O servidor ja aceitava "criar" e "ficha" desde a saida do Monday; faltava a
// tela. Ate aqui o cadastro so podia ser corrigido no Monday — exatamente o que
// queriamos deixar de fazer.
async function gravarCadastroDeCliente(corpo, feito) {
  const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
  showToast(feito, 'success', 4000);
  await ensureClientMasterSources(true);
  return d;
}

function novoClienteNoPainel() {
  if (!podeEditarClientes()) return showToast('Só quem administra cria cliente.', 'warning', 4000);
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Cadastro de clientes</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Novo cliente</h2>
    <p class="workflow-copy">O nome é o que aparece no painel inteiro — calendário, produção e solicitações.
      Escreva exatamente como o time chama o cliente.</p>
    <div class="cli-form"><label class="cli-campo largo"><span>Nome do cliente</span>
      <input id="cli-novo-nome" type="text" autocomplete="off" placeholder="Ex.: Padaria do Zé"></label></div>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="salvarNovoCliente()">Criar cliente →</button></div>`);
  setTimeout(() => document.getElementById('cli-novo-nome')?.focus(), 30);
}

async function salvarNovoCliente() {
  const nome = String(document.getElementById('cli-novo-nome')?.value || '').trim();
  if (!nome) return showToast('Escreva o nome do cliente.', 'warning', 3500);
  try {
    const d = await gravarCadastroDeCliente({ acao:'criar', nome },
      'Cliente criado. Ele já aparece nas telas.');
    closeWorkflowModal();
    if (d?.reativado) showToast('Esse cliente já existia e voltou para o painel.', 'success', 4500);
  } catch (e) { showToast(e.message, 'error', 5000); }
}

// Cadastrar quem ja esta na operacao: o nome ja existe, so falta a ficha.
async function cadastrarClienteDaOperacao(nome) {
  if (!podeEditarClientes()) return showToast('Só quem administra cria cliente.', 'warning', 4000);
  if (!confirm(`Criar a ficha de "${nome}" no cadastro?\n\nEle sai de "Só na operação" e passa a contar como cliente ativo.`)) return;
  try {
    await gravarCadastroDeCliente({ acao:'criar', nome }, `${nome} entrou no cadastro.`);
  } catch (e) { showToast(e.message, 'error', 5000); }
}

const CAMPOS_DA_FICHA = [
  ['plano', 'Plano', 'text'], ['segmento', 'Segmento', 'text'],
  ['responsavel', 'Responsável', 'text'], ['proxima_reuniao', 'Próxima reunião', 'date'],
  ['planejamento_url', 'Link do planejamento', 'url'], ['valor', 'Valor do contrato (R$)', 'number'],
  ['email', 'E-mail', 'text'], ['telefone', 'Telefone', 'text'],
  ['cnpj', 'CNPJ', 'text'], ['endereco', 'Endereço', 'text'],
];

function abrirFichaDeCliente(nome) {
  if (!podeEditarClientes()) return showToast('Só quem administra edita cliente.', 'warning', 4000);
  const id = idDoCliente(nome);
  if (!id) return showToast('Este cliente ainda não tem cadastro próprio para editar.', 'warning', 5000);
  const f = fichaDoCliente(nome) || CADASTRO_CLIENTES.find((c) => String(c.id) === id) || {};
  const painel = String(f.dashboard || '').trim();
  const campo = ([chave, rotulo, tipo]) => {
    const bruto = f[chave];
    const valor = tipo === 'date' ? String(bruto || '').slice(0, 10) : (bruto ?? '');
    return `<label class="cli-campo${chave === 'planejamento_url' || chave === 'endereco' ? ' largo' : ''}">
      <span>${rotulo}</span>
      <input id="cli-f-${chave}" type="${tipo === 'number' ? 'number' : tipo === 'date' ? 'date' : 'text'}"
        ${tipo === 'number' ? 'step="0.01"' : ''} value="${safeText(String(valor))}"></label>`;
  };
  const ativoAgora = f.ativo !== false && !/inativ/i.test(String(f.status || ''));
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Cadastro de clientes</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${safeText(nome)}</h2>
    <p class="workflow-copy">O que estiver em branco fica como está. Head é definido pelas pessoas ligadas ao
      cliente, em Conta &amp; Equipe.</p>
    <input type="hidden" id="cli-f-id" value="${safeText(id)}">
    <input type="hidden" id="cli-f-nome" value="${safeText(nome)}">
    <div class="cli-form">
      <label class="cli-campo"><span>Painel do cliente</span>
        <select id="cli-f-dashboard">
          <option value=""${painel ? '' : ' selected'}>— sem informação —</option>
          <option value="Atualizado"${painelEstaEmDia(painel) ? ' selected' : ''}>Atualizado</option>
          <option value="Desatualizado"${painel && !painelEstaEmDia(painel) ? ' selected' : ''}>Desatualizado</option>
        </select></label>
      ${CAMPOS_DA_FICHA.map(campo).join('')}
    </div>
    <div class="workflow-actions cli-acoes-modal">
      <button type="button" class="workflow-secondary quieto"
        onclick="alternarAtivoDoCliente('${safeText(id)}', ${ativoAgora})">${ativoAgora ? 'Tirar do painel' : 'Voltar ao painel'}</button>
      <span class="cli-espaco"></span>
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="salvarFichaDeCliente()">Salvar cadastro →</button>
    </div>`);
}

async function salvarFichaDeCliente() {
  const id = String(document.getElementById('cli-f-id')?.value || '');
  if (!id) return;
  const campos = {};
  const pegar = (chave) => String(document.getElementById(`cli-f-${chave}`)?.value ?? '').trim();
  CAMPOS_DA_FICHA.forEach(([chave]) => { const v = pegar(chave); if (v) campos[chave] = v; });
  const painel = pegar('dashboard');
  if (painel) campos.dashboard = painel;
  if (!Object.keys(campos).length) { closeWorkflowModal(); return; }
  try {
    await gravarCadastroDeCliente({ acao:'ficha', id, campos }, 'Cadastro do cliente salvo.');
    closeWorkflowModal();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

async function alternarAtivoDoCliente(id, estaAtivo) {
  if (estaAtivo && !confirm('Tirar este cliente do painel?\n\nO histórico dele continua guardado; ele só deixa de aparecer nas telas e não pode receber conteúdo novo.')) return;
  try {
    await gravarCadastroDeCliente({ acao: estaAtivo ? 'desativar' : 'ativar', id },
      estaAtivo ? 'Cliente fora do painel.' : 'Cliente de volta ao painel.');
    closeWorkflowModal();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

function renderClientesLista(clientes) {
  const grid = document.getElementById('grid-clientes-lista');
  selosDeVisaoDeClientes();
  if (visaoDeClientes() === 'tabela') {
    grid.classList.add('em-tabela');
    grid.innerHTML = tabelaDeClientesHtml(clientes);
    return;
  }
  grid.classList.remove('em-tabela');
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
          <span class="posts-count ok" title="Conteúdos de produção">${nProd}</span>
          <span class="posts-count ${atrasadas>0?'empty':'ok'}" title="Demandas">${nDem}</span>
        </div>
      </div>
      ${fichaClienteHtml(cli)}
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
        <div class="demanda-group-header"><div class="demanda-group-title">${g.label}</div><span class="posts-count ok">${g.items.length}</span></div>
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

