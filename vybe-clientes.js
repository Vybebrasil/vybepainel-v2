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
    PESSOAS_DO_CADASTRO=corpo.pessoas || [];
    CLIENT_MASTER_HEADS=CADASTRO_CLIENTES.map(row=>({
      id:String(row.id),name:String(row.nome||'').trim(),url:'',updated_at:'',
      people:row.heads||row.responsavel||'',status:row.status||(row.ativo?'Ativo':'Inativo'),
      planning:row.planejamento_url||'',nextMeeting:row.proxima_reuniao||'',
      dashboard:row.dashboard||'',plan:row.plano||'',segment:row.segmento||''
    }));
    CLIENT_MASTER_ACESSOS=(corpo.acessos||[]).map(row=>({
      id:String(row.id),name:String(row.cliente||clientMasterClientNameFromAccess(row.nome||'')).trim(),
      url:'',updated_at:row.atualizado_em||'',doc:row.documento?'Documento migrado':'',
      drive:row.drive||'',manus:row.manus?'Disponível':'',link:row.link||'',
      // O id e o que abre o documento de senhas; sem ele a etiqueta "Documento"
      // so anuncia que existe um documento e nao leva a lugar nenhum.
      temManus:Boolean(row.manus)
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
  return {head:head?.people||'',status:head?.status||'',segment:head?.segment||'',plan:head?.plan||'',dashboard:head?.dashboard||'',nextMeeting:head?.nextMeeting||'',planning:head?.planning||'',headUrl:head?.url||'',doc:access?.doc||'',drive:access?.drive||'',manus:access?.manus||'',link:access?.link||'',accessUrl:access?.url||'',acessoId:access?.id||'',temManus:Boolean(access?.temManus)};
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
// Uma conta so, com a mesma regra que separa os blocos da tabela: quem tem
// status escrito e cliente do cadastro; quem nao tem, so aparece na operacao.
function contagemDeClientes(nomes) {
  const conta = { ativos:0, inativos:0, sem:0, conteudos:0, conteudosAbertos:0, demandas:0, demandasAbertas:0 };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const registros = clientMasterRecords();
  (nomes || []).forEach((nome) => {
    const f = cadastroDoCliente(nome);
    const texto = String(f?.status || '').trim();
    if (!f || (!texto && f.ativo !== false)) conta.sem += 1;
    else if (texto ? /inativ/i.test(texto) : f.ativo === false) conta.inativos += 1;
    else conta.ativos += 1;
    const r = registros.find((item) => item.name === nome);
    if (!r) return;
    conta.conteudos += r.content.length;
    conta.demandas += r.requests.length;
    conta.conteudosAbertos += r.content.filter((d) => !CONCLUIDO.includes(String(d.status || ''))).length;
    conta.demandasAbertas += r.requests.filter((d) => !CONCLUIDO.includes(String(d.status || ''))).length;
  });
  return conta;
}

function renderClientMasterOverview() {
  const records=clientMasterRecords();
  const active=records.filter(record=>record.activeCount>0).length;
  const content=records.reduce((sum,record)=>sum+record.content.length,0);
  const requests=records.reduce((sum,record)=>sum+record.requests.length,0);
  const activeRequests=records.reduce((sum,record)=>sum+record.requests.filter(item=>!['Feito','Finalizado','feito','finalizado','Concluídas'].includes(String(item.status||''))).length,0);
  // O primeiro bloco de numeros dizia as mesmas coisas que o de baixo, com
  // outros criterios e sem dizer quais. Ficou um so, e este espaco sai da tela.
  const kpi=document.getElementById('client-master-kpis');
  if(kpi) { kpi.innerHTML=''; kpi.style.display='none'; }
  // O trilho de fontes era da mudanca de casa: dizia se o Monday ja tinha sido
  // copiado para o nosso banco. Isso acabou. Ele so aparece agora quando ha
  // algo a dizer — carregando, ou deu erro —, porque ai a lista pode estar
  // incompleta e quem olha precisa saber disso antes de decidir qualquer coisa.
  const rail=document.getElementById('client-master-source-rail');
  if(rail) {
    if(CLIENT_MASTER_ERROR) {
      rail.style.display='';
      rail.innerHTML=`<div class="client-source-card"><div><b>Cadastro indisponível</b>
        <span>${safeText(CLIENT_MASTER_ERROR)} — a lista abaixo pode estar incompleta.</span></div>
        <em>SEM RESPOSTA</em></div>`;
    } else if(CLIENT_MASTER_LOADING || !CLIENT_MASTER_LOADED) {
      rail.style.display='';
      rail.innerHTML=`<div class="client-source-card"><div><b>Carregando o cadastro</b>
        <span>heads, planos, segmentos e acessos</span></div><em>UM INSTANTE...</em></div>`;
    } else {
      rail.style.display='none';
      rail.innerHTML='';
    }
  }
}

// A ficha que abre quando se clica no cliente.
//
// Ela dizia "Pendente de sincronizacao" em quase todo campo. Era verdade na
// epoca do Monday — o dado estava la e ainda nao tinha vindo. Hoje e mentira: o
// cadastro e este, e campo vazio quer dizer que ninguem preencheu. Pior, a
// frase parecia um aviso de sistema e fazia a pessoa esperar por algo que nunca
// ia acontecer. Agora campo vazio mostra um "+" e se preenche aqui mesmo, com
// os mesmos editores da tabela.
//
// Os enderecos apareciam como texto cru de 90 caracteres — nem clicaveis eram —
// e o documento de acessos, que e o que se procura ao abrir um cliente, nao
// tinha caminho nenhum nesta tela.
function renderClientMasterDetail(cli) {
  const record=clientMasterRecords().find(item=>item.name===cli || normalizeClientKey(item.name)===normalizeClientKey(cli));
  const node=document.getElementById('client-master-detail');
  if(!node || !record) return;
  const nome = record.name;
  const meta = record.meta || {};
  const f = cadastroDoCliente(nome) || {};
  const aspas = String(nome).replace(/'/g, "\\'");
  const id = idDoCliente(nome);
  const podeMexer = Boolean(id) && podeEditorClientesNaFicha();
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };

  const mais = (titulo, chamada) => podeMexer
    ? `<span class="cli-mais" title="${titulo}" onclick="${chamada}">+</span>`
    : '<span class="cli-vazio">—</span>';
  const campo = (rotulo, dentro, chamada, dica) => `<div class="client-master-detail-field${
    chamada && podeMexer ? ' editavel' : ''}"${chamada && podeMexer ? ` title="${dica}" onclick="${chamada}"` : ''}>
      <small>${rotulo}</small><b>${dentro}</b></div>`;

  const situacao = String(f.status || '').trim();
  const estado = !situacao ? (f.ativo === false ? 'inativos' : 'sem')
    : /inativ/i.test(situacao) ? 'inativos' : 'ativos';

  const painel = String(f.dashboard || meta.dashboard || '').trim();
  const reuniao = dataBr(f.proxima_reuniao || meta.nextMeeting);
  const plano = String(f.plano || meta.plan || '').trim();
  const segmento = String(f.segmento || meta.segment || '').trim();

  const porta = (rotulo, valor) => { const url = linkDeCliente(valor);
    return url ? `<a class="cli-porta" href="${safeText(url)}" target="_blank" rel="noopener"
      onclick="event.stopPropagation()" title="${safeText(url)}">${safeText(rotulo)} ↗</a>` : ''; };
  const driveHtml = porta('Abrir no Drive', meta.drive)
    || mais('Guardar o endereço do Drive', `editarAcessoDaFicha(event, '${aspas}', 'pasta_drive')`);
  const outroLink = linkDeCliente(meta.link);
  const ehManus = /(^|\.)manus\.im$/i.test((() => { try { return new URL(outroLink).hostname; } catch { return ''; } })());
  const manusHtml = outroLink ? porta(ehManus ? 'Abrir no Manus' : 'Abrir o link', meta.link)
    : mais('Guardar o endereço do Manus', `editarAcessoDaFicha(event, '${aspas}', 'link')`);
  const docHtml = meta.acessoId
    ? `<button type="button" class="cli-porta doc${meta.doc ? '' : ' quieto'}"
        title="${meta.doc ? 'Abrir o documento de acessos' : 'Ainda sem documento — abra para escrever o primeiro'}"
        onclick="abrirDocumentoDoCliente('${safeText(String(meta.acessoId))}', '${aspas}', '${safeText(id)}')">${
        meta.doc ? 'Documento de acessos ↗' : 'Escrever o documento'}</button>`
    : mais('Criar o documento de acessos deste cliente',
        `abrirDocumentoDoCliente('', '${aspas}', '${safeText(id)}')`);
  const planejamento = porta('Planejamento', f.planejamento_url || meta.planning);

  node.innerHTML = `<div class="client-master-detail-card">
      <div class="cli-ficha-topo"><h3>${safeText(nome)}</h3>${situacaoDoClienteHtml(nome, estado)}
        ${podeMexer ? `<button type="button" class="cli-lapis" title="Abrir o cadastro completo"
          onclick="abrirFichaDeCliente('${aspas}')">Editar cadastro</button>` : ''}</div>
      <p>Ficha mestre da conta · ${record.content.length} conteúdo(s) e ${record.requests.length} solicitação(ões) no histórico.</p>
      <div class="client-master-detail-grid">
        ${campo('Head / responsável', headsDoClienteHtml(f.heads || meta.head || ''),
          `abrirHeadsDoCliente(event, '${aspas}')`, 'Clique para escolher o head')}
        ${campo('Segmento', segmento ? `<span class="cli-tag-chip">${safeText(segmento)}</span>`
            : mais('Escolher o segmento', `abrirSegmentoDoCliente(event, '${aspas}')`),
          `abrirSegmentoDoCliente(event, '${aspas}')`, 'Clique para escolher a etiqueta')}
        ${campo('Plano', safeText(plano) || mais('Escrever o plano', `editarCampoDaFicha(event, '${aspas}', 'plano')`),
          `editarCampoDaFicha(event, '${aspas}', 'plano')`, 'Clique para editar')}
        ${campo('Próxima reunião', safeText(reuniao) || mais('Marcar a próxima reunião', `editarCampoDaFicha(event, '${aspas}', 'proxima_reuniao')`),
          `editarCampoDaFicha(event, '${aspas}', 'proxima_reuniao')`, 'Clique para editar')}
      </div>
    </div>
    <div class="client-master-detail-card">
      <div class="cli-ficha-topo"><h3>Dados &amp; acessos</h3>
        ${paineldoClienteHtml(painel)}</div>
      <p>Onde ficam as chaves desta conta. O documento só abre para quem administra.</p>
      <div class="cli-ficha-portas">
        ${driveHtml}${manusHtml}${planejamento}${docHtml}
      </div>
      <div class="client-master-detail-grid">
        ${campo('Painel do cliente', paineldoClienteHtml(painel),
          `editarCampoDaFicha(event, '${aspas}', 'dashboard')`, 'Clique para trocar')}
        ${campo('Solicitações em aberto', String(record.requests.filter((d) =>
          !['Feito','Finalizado','feito','finalizado','Concluídas'].includes(String(d.status||''))).length))}
      </div>
    </div>`;
}
// A ficha usa os mesmos editores da tabela; so precisa saber se quem olha pode
// mexer. Fica numa funcao propria porque a ficha e desenhada antes da tabela
// existir na tela.
function podeEditorClientesNaFicha() {
  return typeof podeEditarClientes === 'function' ? podeEditarClientes() : false;
}
// Reaproveita a edicao da celula: o campo da ficha e uma celula com outra
// moldura. Depois de gravar, a ficha se redesenha sozinha.
function editarCampoDaFicha(event, nome, campo) {
  const alvo = event.currentTarget;
  if (!alvo || alvo.querySelector('input')) return;
  const falso = { stopPropagation: () => {}, currentTarget: alvo.querySelector('b') || alvo };
  editarCelulaDoCliente(falso, nome, campo);
}
function editarAcessoDaFicha(event, nome, campo) {
  event.stopPropagation();
  const alvo = event.currentTarget.closest('.client-master-detail-field') || event.currentTarget.parentElement;
  editarAcessoDoCliente({ stopPropagation: () => {}, currentTarget: alvo }, nome, campo);
}

// ── ficha do cliente ─────────────────────────────────────────────────────────
//
// Contato, CNPJ, plano, segmento, valor e head vinham do board "Gestão de
// Clientes" e só existiam no Monday. Agora estão no nosso banco, e a tela que já
// mostrava a operação de cada cliente passa a mostrar quem ele é.
let CADASTRO_CLIENTES = [];
// Quem pode ser head. Vem junto do cadastro; o seletor precisa do id do banco,
// e a bolinha com foto vem do time, casada pelo id do Monday.
let PESSOAS_DO_CADASTRO = [];

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
  // A tela respondia "quantos clientes?" tres vezes, com tres numeros
  // diferentes: 71 encontrados, 61 contas no Vybe, 16 ativos. E "quantos
  // conteudos?" duas: 1668 e 472. Nenhum dos rotulos dizia qual era qual, entao
  // nenhum servia para decidir nada. Agora e uma conta so, com a mesma regra da
  // tabela logo abaixo — e cada numero e uma pergunta que alguem faz de verdade.
  const numeros = contagemDeClientes(todosClientes);
  const cartao = (k) => `<div class="kpi-card ${k.cls}${k.acao ? ' clicavel' : ''}"${
    k.acao ? ` onclick="${k.acao}" title="${k.dica}"` : ''}><div class="kpi-label">${k.label}</div>
    <div class="kpi-value">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`;
  document.getElementById('kpi-grid-clientes').innerHTML = [
    {label:'Clientes ativos', value:numeros.ativos, sub:'no cadastro', cls:'green'},
    {label:'Inativos', value:numeros.inativos, sub:'fora do painel', cls:'blue'},
    {label:'Só na operação', value:numeros.sem, sub:numeros.sem ? 'sem ficha — falta cadastrar' : 'todos com ficha',
      cls:numeros.sem ? 'yellow' : 'green',
      acao:numeros.sem ? "document.querySelector('.cli-bloco.sem')?.scrollIntoView({behavior:'smooth',block:'start'})" : '',
      dica:'Ver a lista de quem falta cadastrar'},
    {label:'Conteúdos em aberto', value:numeros.conteudosAbertos, sub:`${numeros.conteudos} no histórico`, cls:'purple'},
    {label:'Solicitações em aberto', value:numeros.demandasAbertas, sub:`${numeros.demandas} no histórico`,
      cls:numeros.demandasAbertas ? 'orange' : 'green'},
  ].map(cartao).join('');
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

// Head e pessoa, e pessoa no painel inteiro aparece como bolinha com foto.
// Estava escrito por extenso so aqui — "Ewerton Luis Souza da Silva" ocupando
// meia tabela — porque veio do banco como texto e eu o repassei como texto.
function pessoaPeloNome(nome) {
  const primeiro = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().split(/\s+/)[0];
  const alvo = primeiro(nome);
  const time = typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS;
  return time.find((u) => primeiro(u.name) === alvo) || { name: nome, photo: null, color: '#6b7280' };
}
function headsDoClienteHtml(texto) {
  const nomes = String(texto || '').split(',').map((n) => n.trim()).filter(Boolean);
  if (!nomes.length) return '<span class="cli-mais" title="Nenhum head — clique para escolher">+</span>';
  return `<div class="owner-avatar-stack cli-heads" title="${safeText(nomes.join(', '))}">${
    nomes.map((n) => ownerAvatarHtml(pessoaPeloNome(n))).join('')}</div>`;
}

// ── Perguntar sem sair do painel ──────────────────────────────────────────────
// As confirmacoes eram as caixas do proprio navegador — letra do sistema, botao
// azul, "OK" e "Cancelar". Funcionam, mas sao de outro programa: no meio de uma
// tela escura elas parecem um aviso de erro. Estas usam a mesma lingua do resto,
// e ficam por cima do painel de edicao em vez de substitui-lo — cancelar devolve
// a tela de onde a pessoa veio.
function perguntarNoPainel({ titulo, texto = '', confirmar = 'Confirmar', perigo = false, campo = null, imagem = null }) {
  return new Promise((resolve) => {
    document.getElementById('cli-pergunta')?.remove();
    const fundo = document.createElement('div');
    fundo.id = 'cli-pergunta';
    fundo.className = 'cli-pergunta';
    fundo.innerHTML = `<div class="cli-pergunta-caixa" role="dialog" aria-modal="true">
        <h3>${safeText(titulo)}</h3>
        ${imagem ? `<figure class="cli-pergunta-previa"><img src="${safeText(imagem.url)}"
            alt="${safeText(imagem.nome || '')}"
            onerror="this.closest('figure')?.classList.add('sem-previa')">
          <figcaption>${safeText(imagem.nome || '')}</figcaption></figure>` : ''}
        ${texto ? `<p>${safeText(texto)}</p>` : ''}
        ${campo ? `<input id="cli-pergunta-campo" type="text" value="${safeText(String(campo.valor || ''))}"
            placeholder="${safeText(String(campo.dica || ''))}">` : ''}
        <div class="cli-pergunta-acoes">
          <button type="button" class="workflow-secondary" data-nao>Cancelar</button>
          <button type="button" class="workflow-primary${perigo ? ' perigo' : ''}" data-sim>${safeText(confirmar)}</button>
        </div>
      </div>`;
    const entrada = () => document.getElementById('cli-pergunta-campo');
    const fechar = (resposta) => {
      document.removeEventListener('keydown', tecla, true);
      fundo.remove();
      resolve(resposta);
    };
    const dizerSim = () => fechar(campo ? String(entrada()?.value ?? '').trim() : true);
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(campo ? null : false); }
      if (e.key === 'Enter') { e.preventDefault(); dizerSim(); }
    };
    fundo.querySelector('[data-nao]').onclick = () => fechar(campo ? null : false);
    fundo.querySelector('[data-sim]').onclick = dizerSim;
    fundo.onclick = (e) => { if (e.target === fundo) fechar(campo ? null : false); };
    document.addEventListener('keydown', tecla, true);
    document.body.append(fundo);
    setTimeout(() => { const alvo = entrada() || fundo.querySelector('[data-sim]'); alvo?.focus(); entrada()?.select(); }, 30);
  });
}

// ── Quem e head deste cliente ─────────────────────────────────────────────────
// Head e vinculo com a equipe, nao um campo de texto: por isso nao entrava na
// edicao da celula junto com plano e segmento. Aqui ele ganha o seletor de
// sempre — bolinha com foto, clique para somar ou tirar.
let HEADS_ESCOLHIDOS = new Set();
let HEADS_DO_CLIENTE = null;
function abrirHeadsDoCliente(event, nome) {
  event.stopPropagation();
  if (!podeEditarClientes()) return showToast('Só quem administra muda o head.', 'warning', 3500);
  const id = idDoCliente(nome);
  if (!id) return showToast('Este cliente ainda não tem cadastro próprio.', 'warning', 5000);
  const f = cadastroDoCliente(nome) || {};
  HEADS_DO_CLIENTE = { id, nome };
  HEADS_ESCOLHIDOS = new Set((f.heads_ids || []).map(String));
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Cadastro de clientes</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Head de ${safeText(nome)}</h2>
    <p class="workflow-copy">Clique para somar ou tirar. Vale mais de uma pessoa; a ordem do clique
      é a ordem que aparece na lista.</p>
    <div id="cli-heads-lista" class="dono-pessoas"></div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="salvarHeadsDoCliente()">Salvar head →</button>
    </div>`);
  pintarHeadsDoCliente();
}
function pintarHeadsDoCliente() {
  const caixa = document.getElementById('cli-heads-lista');
  if (!caixa) return;
  if (!PESSOAS_DO_CADASTRO.length) {
    caixa.innerHTML = '<div class="auto-carregando">A equipe ainda não chegou. Recarregue a página.</div>';
    return;
  }
  caixa.innerHTML = PESSOAS_DO_CADASTRO.map((p) => {
    const escolhida = HEADS_ESCOLHIDOS.has(String(p.id));
    const doTime = (typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS)
      .find((u) => String(u.id) === String(p.monday_user_id)) || pessoaPeloNome(p.nome);
    return `<button type="button" class="dono-pessoa ${escolhida ? 'ativo' : ''}"
      onclick="escolherHeadDoCliente('${safeText(String(p.id))}')"
      title="${safeText(p.nome)}">${ownerAvatarHtml(doTime)}<span>${safeText(firstName(p.nome))}</span></button>`;
  }).join('');
}
function escolherHeadDoCliente(pessoaId) {
  const chave = String(pessoaId);
  if (HEADS_ESCOLHIDOS.has(chave)) HEADS_ESCOLHIDOS.delete(chave); else HEADS_ESCOLHIDOS.add(chave);
  pintarHeadsDoCliente();
}
async function salvarHeadsDoCliente() {
  if (!HEADS_DO_CLIENTE) return;
  try {
    await gravarCadastroDeCliente({ acao:'heads', id: HEADS_DO_CLIENTE.id, pessoas:[...HEADS_ESCOLHIDOS] },
      'Head do cliente salvo.');
    closeWorkflowModal();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

// ── Ativo ou inativo, de fora da ficha ────────────────────────────────────────
// Estava so dentro do "Editar", num botao chamado "Tirar do painel". Era a
// pergunta mais frequente da lista e a resposta mais escondida dela.
function situacaoDoClienteHtml(nome, estado) {
  const rotulo = estado === 'inativos' ? 'Inativo' : estado === 'sem' ? 'Sem cadastro' : 'Ativo';
  const classe = estado === 'inativos' ? 'inativo' : estado === 'sem' ? 'nenhum' : 'ativo';
  if (!podeEditarClientes()) return `<span class="cli-situacao ${classe}">${rotulo}</span>`;
  const aspas = String(nome).replace(/'/g, "\\'");
  // "Sem cadastro" nao era clicavel, entao o clique subia para a linha e abria o
  // cliente — justamente quando a pessoa queria era torna-lo ativo. Agora a
  // etiqueta faz o que promete: cadastra e ja deixa ativo.
  if (estado === 'sem') {
    return `<button type="button" class="cli-situacao ${classe}" title="Clique para cadastrar e deixar ativo"
      onclick="event.stopPropagation();cadastrarClienteDaOperacao('${aspas}')">${rotulo}</button>`;
  }
  return `<button type="button" class="cli-situacao ${classe}" title="Clique para trocar"
    onclick="event.stopPropagation();trocarSituacaoDoCliente('${aspas}', ${estado === 'inativos'})">${rotulo}</button>`;
}
async function trocarSituacaoDoCliente(nome, estaInativo) {
  const id = idDoCliente(nome);
  if (!id) return;
  if (!estaInativo && !await perguntarNoPainel({
    titulo: `Tirar "${nome}" do painel?`,
    texto: 'O histórico continua guardado; ele só deixa de aparecer nas telas e não recebe conteúdo novo.',
    confirmar: 'Tirar do painel', perigo: true })) return;
  try {
    await gravarCadastroDeCliente({ acao: estaInativo ? 'ativar' : 'desativar', id },
      estaInativo ? 'Cliente de volta ao painel.' : 'Cliente fora do painel.');
  } catch (e) { showToast(e.message, 'error', 5000); }
}

// ── Segmento como etiqueta, nao como texto solto ──────────────────────────────
// Digitando, "Varejo" e "varejo " viram duas coisas e o vocabulario se desfaz.
// O seletor mostra as etiquetas que ja existem; criar e um ato explicito, e
// renomear ou apagar vale para todos os clientes que usam aquela etiqueta.
function segmentosExistentes() {
  const vistos = new Map();
  CADASTRO_CLIENTES.forEach((c) => {
    const texto = String(c.segmento || '').trim();
    if (!texto) return;
    const chave = texto.toLowerCase();
    vistos.set(chave, { rotulo: vistos.get(chave)?.rotulo || texto, quantos: (vistos.get(chave)?.quantos || 0) + 1 });
  });
  return [...vistos.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
let SEGMENTO_DO_CLIENTE = null;
function abrirSegmentoDoCliente(event, nome) {
  event.stopPropagation();
  if (!podeEditarClientes()) return showToast('Só quem administra muda o segmento.', 'warning', 3500);
  const id = idDoCliente(nome);
  if (!id) return showToast('Este cliente ainda não tem cadastro próprio.', 'warning', 5000);
  const f = cadastroDoCliente(nome) || {};
  SEGMENTO_DO_CLIENTE = { id, nome, atual: String(f.segmento || '').trim() };
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Etiquetas de segmento</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Segmento de ${safeText(nome)}</h2>
    <p class="workflow-copy">Escolha uma etiqueta que já existe, ou crie a próxima. Renomear e apagar
      valem para todos os clientes que usam a etiqueta — é um vocabulário só.</p>
    <div id="cli-seg-lista" class="cli-tags"></div>
    <div class="cli-form"><label class="cli-campo largo"><span>Criar etiqueta nova</span>
      <input id="cli-seg-nova" type="text" placeholder="Ex.: Odontologia"
        onkeydown="if(event.key==='Enter'){event.preventDefault();criarSegmento();}"></label></div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary quieto" onclick="aplicarSegmento('')">Deixar sem segmento</button>
      <span class="cli-espaco"></span>
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button>
      <button type="button" class="workflow-primary" onclick="criarSegmento()">Criar e aplicar →</button>
    </div>`);
  pintarSegmentos();
}
function pintarSegmentos() {
  const caixa = document.getElementById('cli-seg-lista');
  if (!caixa) return;
  const atual = String(SEGMENTO_DO_CLIENTE?.atual || '').toLowerCase();
  const lista = segmentosExistentes();
  caixa.innerHTML = !lista.length
    ? '<div class="auto-carregando">Nenhuma etiqueta ainda. Crie a primeira abaixo.</div>'
    : lista.map(({ rotulo, quantos }) => `<div class="cli-tag ${rotulo.toLowerCase() === atual ? 'ativa' : ''}">
        <button type="button" class="cli-tag-nome" title="Aplicar em ${safeText(SEGMENTO_DO_CLIENTE.nome)}"
          onclick="aplicarSegmento('${safeText(rotulo.replace(/'/g, "\\'"))}')">${safeText(rotulo)}<small>${quantos}</small></button>
        <button type="button" class="cli-tag-acao" title="Renomear em todos os clientes"
          onclick="renomearSegmento('${safeText(rotulo.replace(/'/g, "\\'"))}')">renomear</button>
        <button type="button" class="cli-tag-acao apagar" title="Apagar de todos os clientes"
          onclick="apagarSegmento('${safeText(rotulo.replace(/'/g, "\\'"))}')">apagar</button>
      </div>`).join('');
}
async function aplicarSegmento(rotulo) {
  if (!SEGMENTO_DO_CLIENTE) return;
  try {
    await gravarCadastroDeCliente({ acao:'ficha', id: SEGMENTO_DO_CLIENTE.id, campos:{ segmento: rotulo } },
      rotulo ? `Segmento: ${rotulo}.` : 'Segmento removido deste cliente.');
    closeWorkflowModal();
  } catch (e) { showToast(e.message, 'error', 5000); }
}
async function criarSegmento() {
  const novo = String(document.getElementById('cli-seg-nova')?.value || '').trim();
  if (!novo) return showToast('Escreva o nome da etiqueta.', 'warning', 3500);
  await aplicarSegmento(novo);
}
async function renomearSegmento(de) {
  const para = await perguntarNoPainel({
    titulo: `Renomear "${de}"`,
    texto: 'O novo nome vale para todos os clientes que usam esta etiqueta.',
    confirmar: 'Renomear', campo: { valor: de, dica: 'Novo nome da etiqueta' } });
  if (para === null || !String(para).trim() || String(para).trim() === de) return;
  try {
    const d = await gravarCadastroDeCliente({ acao:'segmento-renomear', de, para: String(para).trim() },
      'Etiqueta renomeada.');
    showToast(`${d.clientes} cliente(s) atualizado(s).`, 'info', 4000);
    if (SEGMENTO_DO_CLIENTE && SEGMENTO_DO_CLIENTE.atual.toLowerCase() === de.toLowerCase()) {
      SEGMENTO_DO_CLIENTE.atual = String(para).trim();
    }
    pintarSegmentos();
  } catch (e) { showToast(e.message, 'error', 5000); }
}
async function apagarSegmento(de) {
  if (!await perguntarNoPainel({
    titulo: `Apagar a etiqueta "${de}"?`,
    texto: 'Ela sai de todos os clientes que a usam. Os clientes continuam; só ficam sem segmento.',
    confirmar: 'Apagar etiqueta', perigo: true })) return;
  try {
    const d = await gravarCadastroDeCliente({ acao:'segmento-apagar', de }, 'Etiqueta apagada.');
    showToast(`${d.clientes} cliente(s) ficaram sem segmento.`, 'info', 4000);
    if (SEGMENTO_DO_CLIENTE && SEGMENTO_DO_CLIENTE.atual.toLowerCase() === de.toLowerCase()) {
      SEGMENTO_DO_CLIENTE.atual = '';
    }
    pintarSegmentos();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

// ── Editar na propria celula ──────────────────────────────────────────────────
// No Monday se clica no campo e se digita. Aqui so dava para abrir a ficha
// inteira por um botao — pesado para trocar um segmento. Agora a celula vira
// campo no lugar: Enter grava, Esc desiste, sair do campo grava.
const CELULAS_EDITAVEIS = {
  dashboard: { tipo:'lista' },
  proxima_reuniao: { tipo:'data' },
  plano: { tipo:'texto' },
  segmento: { tipo:'texto' },
};
// A lista do sistema operacional nao pertence a esta tela: letra do sistema,
// fundo branco, nada da lingua do painel. Onde ha escolha entre estados, o
// painel ja usa o mesmo popover dos GRUPOS em PRODUCAO, com as etiquetas de
// verdade dentro. Aqui tambem.
function fecharListaDoPainel() {
  document.getElementById('cli-lista')?.remove();
  document.getElementById('cli-lista-backdrop')?.remove();
}
function abrirListaDoPainel(gatilho, { titulo, opcoes, atual, aoEscolher }) {
  fecharListaDoPainel();
  const rect = gatilho.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'cli-lista-backdrop';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharListaDoPainel;
  const menu = document.createElement('div');
  menu.id = 'cli-lista';
  menu.className = 'status-editor cli-lista';
  menu.innerHTML = `<div class="status-editor-head">${safeText(titulo)}</div>` + opcoes.map((o, i) =>
    `<button type="button" class="status-editor-option ${o.valor === atual ? 'current' : ''}"
      data-i="${i}">${o.html || safeText(o.rotulo)}</button>`).join('');
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
  menu.querySelectorAll('button[data-i]').forEach((b) => {
    b.onclick = () => { const o = opcoes[Number(b.dataset.i)]; fecharListaDoPainel(); aoEscolher(o.valor); };
  });
}

function editarCelulaDoCliente(event, nome, campo) {
  event.stopPropagation();
  const celula = event.currentTarget;
  if (celula.querySelector('input')) return;
  if (!podeEditarClientes()) return showToast('Só quem administra edita cliente.', 'warning', 3500);
  const id = idDoCliente(nome);
  if (!id) return showToast('Este cliente ainda não tem cadastro próprio para editar.', 'warning', 5000);
  const regra = CELULAS_EDITAVEIS[campo];
  const f = cadastroDoCliente(nome) || {};
  const bruto = f[campo];
  const valor = regra.tipo === 'data' ? String(bruto || '').slice(0, 10) : String(bruto ?? '');

  // "Dasatualizado" (o erro que veio do Monday) nao casa com nenhuma opcao pela
  // letra, mas e um painel desatualizado — a lista tem que abrir marcando isso,
  // senao um clique distraido apagaria o campo.
  if (regra.tipo === 'lista') {
    const atual = !valor ? '' : painelEstaEmDia(valor) ? 'Atualizado' : 'Desatualizado';
    return abrirListaDoPainel(celula, {
      titulo: 'Painel do cliente',
      atual,
      opcoes: [
        { valor:'Atualizado', html:'<span class="cli-painel novo">Atualizado</span>' },
        { valor:'Desatualizado', html:'<span class="cli-painel velho">Desatualizado</span>' },
        { valor:'', html:'<span class="cli-vazio">sem informação</span>' },
      ],
      aoEscolher: async (escolhido) => {
        if (escolhido === valor) return;
        celula.innerHTML = '<span class="cli-vazio">salvando…</span>';
        try { await gravarCadastroDeCliente({ acao:'ficha', id, campos:{ dashboard: escolhido } }, 'Cliente atualizado.'); }
        catch (e) { showToast(e.message, 'error', 5000); renderClientesBoard(); }
      },
    });
  }

  const antes = celula.innerHTML;
  celula.classList.add('em-edicao');
  celula.innerHTML = `<input class="cli-celula" type="${regra.tipo === 'data' ? 'date' : 'text'}" value="${safeText(valor)}">`;
  const campoEl = celula.firstElementChild;
  let encerrado = false;
  const encerrar = async (gravar) => {
    if (encerrado) return;
    encerrado = true;
    const novo = String(campoEl.value ?? '').trim();
    celula.classList.remove('em-edicao');
    if (!gravar || novo === valor) { celula.innerHTML = antes; return; }
    // Campo de data e de numero nao aceitam vazio no banco; texto aceita, e e
    // assim que se apaga um segmento errado.
    if (!novo && regra.tipo === 'data') { celula.innerHTML = antes; return; }
    celula.innerHTML = '<span class="cli-vazio">salvando…</span>';
    try { await gravarCadastroDeCliente({ acao:'ficha', id, campos:{ [campo]: novo } }, 'Cliente atualizado.'); }
    catch (e) { showToast(e.message, 'error', 5000); celula.innerHTML = antes; }
  };
  campoEl.focus();
  if (campoEl.select) try { campoEl.select(); } catch { /* select nao aceita */ }
  campoEl.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); encerrar(true); }
    if (e.key === 'Escape') { e.preventDefault(); encerrar(false); }
  };
  campoEl.onblur = () => encerrar(true);
}
function linhaDeClienteHtml(nome, semCadastro, estado) {
  const f = cadastroDoCliente(nome) || {};
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const registros = clientMasterRecords();
  const record = registros.find((item) => item.name === nome) || { content: [], requests: [] };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas'];
  const abertos = record.content.filter((d) => !CONCLUIDO.includes(d.status)).length;
  const demandas = record.requests.filter((d) => !CONCLUIDO.includes(d.status)).length;
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const aspas = String(nome).replace(/'/g, "\\'");
  const idNoCadastro = semCadastro ? '' : idDoCliente(nome);
  const podeMexer = !semCadastro && podeEditarClientes();

  // Drive, Manus e Documento viram colunas proprias — juntos numa celula so,
  // ninguem via quem estava sem qual. Cada uma abre o que tem, e quem nao tem
  // ganha um "+" que cria ali mesmo.
  const vazio = '<span class="cli-vazio">—</span>';
  const maisOuNada = (titulo, chamada) => podeMexer
    ? `<span class="cli-mais" title="${titulo}" onclick="event.stopPropagation();${chamada}">+</span>` : vazio;
  const linkOuMais = (rotulo, valor, campo) => {
    const url = linkDeCliente(valor);
    if (url) return `<a class="cli-porta" href="${safeText(url)}" target="_blank" rel="noopener"
      onclick="event.stopPropagation()" title="${safeText(url)}">${safeText(rotulo)} ↗</a>${
      podeMexer ? `<span class="cli-troca" title="Trocar o endereço"
        onclick="event.stopPropagation();editarAcessoDoCliente(event, '${aspas}', '${campo}')">✎</span>` : ''}`;
    return maisOuNada(`Guardar o endereço do ${rotulo}`,
      `editarAcessoDoCliente(event, '${aspas}', '${campo}')`);
  };
  const celulaDrive = `<td class="cli-liga">${linkOuMais('Drive', ligado.drive, 'pasta_drive')}</td>`;
  const outroLink = linkDeCliente(ligado.link);
  const ehManus = /(^|\.)manus\.im$/i.test((() => { try { return new URL(outroLink).hostname; } catch { return ''; } })());
  const celulaManus = `<td class="cli-liga">${
    outroLink ? linkOuMais(ehManus ? 'Manus' : 'Link', ligado.link, 'link')
    : ligado.temManus ? `<span class="cli-porta quieto" title="Marcado como tendo projeto no Manus, mas sem endereço guardado">Manus</span>${
        podeMexer ? `<span class="cli-troca" title="Guardar o endereço"
          onclick="event.stopPropagation();editarAcessoDoCliente(event, '${aspas}', 'link')">✎</span>` : ''}`
    : maisOuNada('Guardar o endereço do Manus', `editarAcessoDoCliente(event, '${aspas}', 'link')`)}</td>`;
  const celulaDoc = `<td class="cli-liga">${
    ligado.acessoId
      ? `<button type="button" class="cli-porta doc${ligado.doc ? '' : ' quieto'}"
          title="${ligado.doc ? 'Abrir o documento de acessos' : 'Ainda sem documento — abra para escrever o primeiro'}"
          onclick="event.stopPropagation();abrirDocumentoDoCliente('${safeText(String(ligado.acessoId))}', '${aspas}', '${safeText(idNoCadastro)}')">Documento ↗</button>`
      : maisOuNada('Criar o documento de acessos deste cliente',
          `abrirDocumentoDoCliente('', '${aspas}', '${safeText(idNoCadastro)}')`)}</td>`;

  const lapis = !podeEditarClientes() ? ''
    : semCadastro
      ? `<button type="button" class="cli-lapis criar" title="Criar a ficha de ${safeText(nome)} no cadastro"
          onclick="event.stopPropagation();cadastrarClienteDaOperacao('${aspas}')">Cadastrar</button>`
      : `<button type="button" class="cli-lapis" title="Editar o cadastro de ${safeText(nome)}"
          onclick="event.stopPropagation();abrirFichaDeCliente('${aspas}')">Editar</button>`;

  const editavel = (campo, dentro) => !podeMexer
    ? `<td>${dentro}</td>`
    : `<td class="cli-editavel" title="Clique para editar"
        onclick="editarCelulaDoCliente(event, '${aspas}', '${campo}')">${dentro}</td>`;
  const clicavel = (dentro, chamada, titulo) => !podeMexer
    ? `<td>${dentro}</td>`
    : `<td class="cli-editavel" title="${titulo}" onclick="${chamada}">${dentro}</td>`;

  const segmento = String(f.segmento || ligado.segment || '').trim();
  return `<tr onclick="abrirClienteDetalhe('${aspas}')" title="Abrir ${safeText(nome)}">
    <td class="cli-nome">${safeText(nome)}</td>
    ${clicavel(headsDoClienteHtml(f.heads || ligado.head || ''),
      `abrirHeadsDoCliente(event, '${aspas}')`, 'Clique para escolher o head')}
    <td>${situacaoDoClienteHtml(nome, estado)}</td>
    ${editavel('dashboard', paineldoClienteHtml(f.dashboard || ligado.dashboard))}
    ${editavel('proxima_reuniao', dataBr(f.proxima_reuniao || ligado.nextMeeting) || vazio)}
    ${editavel('plano', safeText(f.plano || ligado.plan || '') || vazio)}
    ${clicavel(segmento ? `<span class="cli-tag-chip">${safeText(segmento)}</span>` : maisOuNada('Escolher o segmento', `abrirSegmentoDoCliente(event, '${aspas}')`),
      `abrirSegmentoDoCliente(event, '${aspas}')`, 'Clique para escolher a etiqueta')}
    ${celulaDrive}${celulaManus}${celulaDoc}
    <td><div class="cli-numeros"><span title="Conteúdos em aberto">${abertos}</span><span title="Solicitações em aberto" class="${demandas ? 'atencao' : ''}">${demandas}</span></div></td>
    <td class="cli-acoes">${lapis}</td>
  </tr>`;
}

// Drive e Link moram na ficha de acessos, nao no cadastro do cliente: por isso
// nao passam pela mesma gravacao das outras celulas.
function editarAcessoDoCliente(event, nome, campo) {
  event.stopPropagation();
  // Serve a celula da tabela e o campo da ficha do cliente: sao a mesma edicao
  // em molduras diferentes.
  const celula = event.currentTarget.closest?.('td, .client-master-detail-field') || event.currentTarget;
  if (!celula || celula.querySelector('input')) return;
  if (!podeEditarClientes()) return showToast('Só quem administra edita acessos.', 'warning', 3500);
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const id = idDoCliente(nome);
  const acessoId = String(ligado.acessoId || '');
  if (!acessoId && !id) return showToast('Este cliente ainda não tem cadastro próprio.', 'warning', 5000);
  const valor = String((campo === 'pasta_drive' ? ligado.drive : ligado.link) || '');
  const antes = celula.innerHTML;
  celula.classList.add('em-edicao');
  celula.innerHTML = `<input class="cli-celula" type="text" value="${safeText(valor)}" placeholder="https://...">`;
  const campoEl = celula.firstElementChild;
  let encerrado = false;
  const encerrar = async (gravar) => {
    if (encerrado) return;
    encerrado = true;
    const novo = String(campoEl.value ?? '').trim();
    celula.classList.remove('em-edicao');
    if (!gravar || novo === valor) { celula.innerHTML = antes; return; }
    if (novo && !linkDeCliente(novo)) {
      showToast('Endereço inválido — precisa começar com http:// ou https://', 'error', 5000);
      celula.innerHTML = antes; return;
    }
    celula.innerHTML = '<span class="cli-vazio">salvando…</span>';
    const corpo = { [campo]: novo };
    if (acessoId) corpo.id = acessoId; else corpo.cliente = id;
    try {
      const r = await fetch('/api/painel?area=acessos', { method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
      showToast('Endereço salvo.', 'success', 3500);
      await ensureClientMasterSources(true);
    } catch (e) { showToast(e.message, 'error', 5000); celula.innerHTML = antes; }
  };
  campoEl.focus();
  try { campoEl.select(); } catch { /* sem selecao */ }
  campoEl.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); encerrar(true); }
    if (e.key === 'Escape') { e.preventDefault(); encerrar(false); }
  };
  campoEl.onblur = () => encerrar(true);
}

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
        <th>Cliente</th><th>Head</th><th>Status</th><th>Dashboard</th><th>Próx. reunião</th>
        <th>Plano</th><th>Segmento</th><th>Drive</th><th>Manus</th><th>Documento</th><th>Aberto</th><th></th>
      </tr></thead><tbody>${lista.map((n) => linhaDeClienteHtml(n, classe === 'sem', classe)).join('')}</tbody></table></div></div>
    </section>`;
  return bloco('Ativos', caixas.ativos, 'ativos')
    + bloco('Inativos', caixas.inativos, 'inativos')
    + bloco('Só na operação', caixas.sem, 'sem',
        'aparecem em conteúdos, solicitações ou no Drive, mas não têm ficha no cadastro')
    || '<div class="grupos-vazio">Nenhum cliente encontrado.</div>';
}

// ── O documento de acessos do cliente ─────────────────────────────────────────
// O documento com as senhas ja estava guardado no banco desde a saida do Monday,
// e ja havia endereco para busca-lo — mas so a tela de Conta & Equipe chamava.
// Na lista de clientes ele era uma etiqueta cinza que nao abria nada, e era isso
// que faltava para nao precisar mais do quadro Dados & Acessos.
//
// O conteudo so sai do servidor quando e pedido por id, e so para quem
// administra: a listagem nunca traz as senhas junto.
let DOCUMENTO_ABERTO = null;
async function abrirDocumentoDoCliente(acessoId, nome, clienteId) {
  DOCUMENTO_ABERTO = { acessoId: String(acessoId || ''), nome, clienteId: String(clienteId || ''), dados: null };
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Dados &amp; acessos</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${safeText(nome)}</h2>
    <div class="cli-doc"><div class="auto-carregando">Buscando o documento…</div></div>`);
  if (!acessoId) { DOCUMENTO_ABERTO.dados = {}; return pintarDocumentoDoCliente(true); }
  try {
    const r = await fetch(`/api/painel?area=acessos&id=${encodeURIComponent(acessoId)}`,
      { credentials:'same-origin', cache:'no-store' });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível abrir.');
    DOCUMENTO_ABERTO.dados = d.acesso || {};
    pintarDocumentoDoCliente(false);
  } catch (erro) {
    const caixa = document.querySelector('#workflow-modal .cli-doc');
    if (caixa) caixa.innerHTML = `<div class="auto-carregando">Não foi possível abrir<br>
      <small>${safeText(erro.message)}</small></div>`;
  }
}

// Ler e escrever no mesmo lugar. O texto e livre de proposito: e assim que ele
// vivia no documento do Monday, e reproduzir aqui uma estrutura de campos
// obrigaria a reescrever 43 documentos antes de qualquer um poder ser usado.
function pintarDocumentoDoCliente(editando) {
  const caixa = document.querySelector('#workflow-modal .cli-doc');
  if (!caixa || !DOCUMENTO_ABERTO?.dados) return;
  const a = DOCUMENTO_ABERTO.dados;
  const texto = String(a.doc_conteudo || '');
  const quando = String(a.doc_atualizado_em || '').slice(0, 10).split('-').reverse().join('/');
  const podeEditar = podeEditarClientes();
  const atalho = (rotulo, valor) => { const url = linkDeCliente(valor);
    return url ? `<a class="cli-porta" href="${safeText(url)}" target="_blank" rel="noopener">${safeText(rotulo)} ↗</a>` : ''; };
  if (!editando) {
    caixa.innerHTML = `<div class="cli-doc-topo">
        <div class="cli-portas">${atalho('Drive', a.pasta_drive)}${atalho('Link', a.link)}</div>
        ${quando ? `<small>documento de ${quando}</small>` : ''}
        ${texto.trim() ? '<button type="button" class="cli-porta" onclick="copiarDocumentoDoCliente()">Copiar tudo</button>' : ''}
        ${podeEditar ? '<button type="button" class="cli-porta editar" onclick="pintarDocumentoDoCliente(true)">Editar</button>' : ''}
      </div>
      ${texto.trim() ? `<pre id="cli-doc-texto">${safeText(texto)}</pre>`
        : `<div class="auto-carregando">Sem documento guardado.${
            podeEditar ? '<br><small>Use Editar para escrever o primeiro.</small>' : ''}</div>`}`;
    return;
  }
  caixa.innerHTML = `<div class="cli-form cli-doc-links">
      <label class="cli-campo"><span>Pasta no Drive</span>
        <input id="cli-doc-drive" type="text" value="${safeText(String(a.pasta_drive || ''))}" placeholder="https://drive.google.com/..."></label>
      <label class="cli-campo"><span>Link (Manus, planilha, o que for)</span>
        <input id="cli-doc-link" type="text" value="${safeText(String(a.link || ''))}" placeholder="https://..."></label>
    </div>
    <textarea id="cli-doc-editor" spellcheck="false"
      placeholder="Logins, senhas, telefones — do jeito que o time escreve.">${safeText(texto)}</textarea>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="pintarDocumentoDoCliente(false)">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="salvarDocumentoDoCliente()">Salvar documento →</button>
    </div>`;
  setTimeout(() => document.getElementById('cli-doc-editor')?.focus(), 30);
}

async function salvarDocumentoDoCliente() {
  if (!DOCUMENTO_ABERTO) return;
  const texto = String(document.getElementById('cli-doc-editor')?.value ?? '');
  const drive = String(document.getElementById('cli-doc-drive')?.value ?? '').trim();
  const link = String(document.getElementById('cli-doc-link')?.value ?? '').trim();
  const corpo = { texto, pasta_drive: drive, link };
  if (DOCUMENTO_ABERTO.acessoId) corpo.id = DOCUMENTO_ABERTO.acessoId;
  else corpo.cliente = DOCUMENTO_ABERTO.clienteId;
  try {
    const r = await fetch('/api/painel?area=acessos', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    if (d.id) DOCUMENTO_ABERTO.acessoId = String(d.id);
    DOCUMENTO_ABERTO.dados = { ...DOCUMENTO_ABERTO.dados, doc_conteudo: texto,
      pasta_drive: drive || DOCUMENTO_ABERTO.dados.pasta_drive,
      link: link || DOCUMENTO_ABERTO.dados.link,
      doc_atualizado_em: new Date().toISOString() };
    showToast('Acessos salvos.', 'success', 3500);
    pintarDocumentoDoCliente(false);
    void ensureClientMasterSources(true);
  } catch (e) { showToast(e.message, 'error', 5000); }
}
async function copiarDocumentoDoCliente() {
  const el = document.getElementById('cli-doc-texto');
  if (!el) return;
  try { await navigator.clipboard.writeText(el.textContent || '');
    showToast('Acessos copiados.', 'success', 3000); }
  catch { showToast('Não consegui copiar; selecione o texto na tela.', 'info', 5000); }
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
  if (!await perguntarNoPainel({
    titulo: `Criar a ficha de "${nome}"?`,
    texto: 'Ele sai de "Só na operação" e passa a contar como cliente ativo.',
    confirmar: 'Criar ficha' })) return;
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
        <div class="cli-escolha" id="cli-f-dashboard-escolha">${
          [['Atualizado', 'novo'], ['Desatualizado', 'velho'], ['', 'nenhum']].map(([v, cor]) => {
            const marcado = !painel ? !v : v === 'Atualizado' ? painelEstaEmDia(painel)
              : v === 'Desatualizado' ? !painelEstaEmDia(painel) : false;
            return `<button type="button" class="cli-escolha-btn ${cor} ${marcado ? 'ativo' : ''}"
              data-valor="${safeText(v)}" onclick="marcarPainelDoCliente(this)">${v || 'sem informação'}</button>`;
          }).join('')}</div>
        <input type="hidden" id="cli-f-dashboard" value="${safeText(painel && !painelEstaEmDia(painel) ? 'Desatualizado' : painel ? 'Atualizado' : '')}"></label>
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

function marcarPainelDoCliente(botao) {
  const caixa = document.getElementById('cli-f-dashboard-escolha');
  caixa?.querySelectorAll('.cli-escolha-btn').forEach((b) => b.classList.toggle('ativo', b === botao));
  const campo = document.getElementById('cli-f-dashboard');
  if (campo) campo.value = botao.dataset.valor || '';
}

async function salvarFichaDeCliente() {
  const id = String(document.getElementById('cli-f-id')?.value || '');
  if (!id) return;
  const campos = {};
  const pegar = (chave) => String(document.getElementById(`cli-f-${chave}`)?.value ?? '').trim();
  CAMPOS_DA_FICHA.forEach(([chave]) => { const v = pegar(chave); if (v) campos[chave] = v; });
  // O painel vai sempre, inclusive vazio: aqui a escolha e explicita — quem
  // clica em "sem informacao" esta pedindo para limpar, nao deixando em branco.
  campos.dashboard = pegar('dashboard');
  if (!Object.keys(campos).length) { closeWorkflowModal(); return; }
  try {
    await gravarCadastroDeCliente({ acao:'ficha', id, campos }, 'Cadastro do cliente salvo.');
    closeWorkflowModal();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

async function alternarAtivoDoCliente(id, estaAtivo) {
  if (estaAtivo && !await perguntarNoPainel({
    titulo: 'Tirar este cliente do painel?',
    texto: 'O histórico dele continua guardado; ele só deixa de aparecer nas telas e não pode receber conteúdo novo.',
    confirmar: 'Tirar do painel', perigo: true })) return;
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

// Os numeros do topo sao da LISTA — 71 clientes, 1668 conteudos. Com um cliente
// aberto eles nao respondem nada e ainda empurram a ficha dele para baixo da
// dobra. Somem enquanto se olha um cliente, e voltam no "Voltar".
function numerosDaListaDeClientes(mostrar) {
  ['client-master-kpis', 'client-master-source-rail', 'kpi-grid-clientes']
    .forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = mostrar ? '' : 'none'; });
}

let CLIENTE_ABERTO = '';
function abrirClienteDetalhe(cli) {
  document.getElementById('panel-clientes-lista').style.display  = 'none';
  document.getElementById('panel-cliente-detalhe').style.display = '';
  numerosDaListaDeClientes(false);
  document.getElementById('cliente-detalhe-nome').textContent    = cli;
  CLIENTE_ABERTO = cli;
  renderClientMasterDetail(cli);
  redesenharListasDoCliente();
}

// As duas listas do cliente passam pela MESMA tabela do resto do painel.
//
// Antes eram cartoes proprios, escritos antes das regras existirem: nao dava
// para trocar o status na linha, nem ordenar por coluna, nem ver prazo e
// veiculacao, e clicar nao abria a atividade. Nao faltava regra — faltava usar
// as que ja existem. Agora tudo que valer para a tabela de grupos vale aqui
// sozinho, sem ninguem ter de pedir de novo.
function redesenharListasDoCliente() {
  const cli = CLIENTE_ABERTO;
  if (!cli || document.getElementById('panel-cliente-detalhe')?.style.display === 'none') return;
  const record = clientMasterRecords().find((item) => item.name === cli) || { content: [], requests: [] };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const emAberto = (lista) => lista.filter((d) => !CONCLUIDO.includes(String(d.status || '')));

  const conteudos = emAberto(record.content);
  const gridProd = document.getElementById('grid-cliente-producao');
  if (gridProd) {
    gridProd.innerHTML = conteudos.length
      ? tabelaOperacionalHtml(conteudos, 'producao')
      : '<div class="grupos-vazio">Nenhum conteúdo em aberto.</div>';
  }

  // A lista crua de Solicitacoes fala outro idioma; o normalizador e o mesmo
  // que a tabela de grupos usa.
  const solicitacoes = emAberto(record.requests)
    .map((d) => (typeof normalizeRequestForOperational === 'function' ? normalizeRequestForOperational(d) : d));
  const gridDem = document.getElementById('grid-cliente-demandas');
  if (gridDem) {
    gridDem.innerHTML = solicitacoes.length
      ? deckDeLoteHtml('demandas') + tabelaOperacionalHtml(solicitacoes, 'demandas')
      : '<div class="grupos-vazio">Nenhuma solicitação em aberto.</div>';
  }
}


function voltarClientesLista() {
  document.getElementById('panel-clientes-lista').style.display  = '';
  document.getElementById('panel-cliente-detalhe').style.display = 'none';
  numerosDaListaDeClientes(true);
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
  // Os dois filtros novos entram aqui tambem: "limpar tudo" que deixa dois de
  // pe e pior que nao existir — a pessoa passa a nao confiar no botao.
  if (typeof currentDemandaTipoFilter !== 'undefined') currentDemandaTipoFilter = 'all';
  if (typeof currentDemandaAtrasadas !== 'undefined') currentDemandaAtrasadas = false;
  document.querySelectorAll('#demanda-status-legend .pill').forEach(p => p.classList.remove('active-legend'));
  document.querySelectorAll('#person-filter-bar-demandas .person-chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('#person-all-demandas .person-chip');
  if (allChip) allChip.classList.add('active');
  // O botao de dia se reescreve sozinho no renderDemandas; zerar o estado basta.
  currentDemandaDayFilter = '';
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
    // Mesma regra da tela de Producao: bolinha com foto, nome no title.
    wrap.dataset.personId = u.id;
    wrap.style.setProperty('--person-color', u.color || '#00f0ff');
    const chip = document.createElement('span');
    chip.className = 'person-chip so-foto';
    chip.innerHTML = typeof ownerAvatarHtml === 'function'
      ? ownerAvatarHtml(u)
      : `<span class="owner-avatar-fallback" style="background:${u.color}">${
          String(u.name || '').slice(0, 2).toUpperCase()}</span>`;
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

