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
function clientMasterCanonicalName(value='') {
  const original=String(value||'').trim();
  const operacional=typeof normalizarCliente === 'function' ? normalizarCliente(original) : original;
  return CLIENT_NAME_ALIASES[normalizeClientKey(operacional)] || operacional;
}
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
  const key=normalizeClientKey(clientMasterCanonicalName(clientName));
  if(!key) return null;
  const exact=rows.find(row=>normalizeClientKey(clientMasterCanonicalName(mapper(row)))===key);
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
    if (corpo.cadastro_def) CADASTRO_DEF=corpo.cadastro_def;
    CLIENT_MASTER_HEADS=CADASTRO_CLIENTES.map(row=>({
      id:String(row.id),name:String(row.nome||'').trim(),url:'',updated_at:'',
      people:row.heads||'',status:row.status||(row.ativo?'Ativo':'Inativo'),
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
    atualizarCoresDasCarteiras();
    if (filtroCarteira !== 'all') atualizarVisoesDaCarteira();
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
  if(exact) return clientMasterCanonicalName(exact.name);
  const fuzzy=sources.find(row=>nomesSeAproximam(normalizeClientKey(row.name), key));
  return fuzzy ? clientMasterCanonicalName(fuzzy.name) : canonical;
}
function clientMasterRecords() {
  const rawItems=typeof unifiedOperationalItems==='function' ? unifiedOperationalItems() : [...(DADOS_ALL?.length ? DADOS_ALL : DADOS || []), ...(DADOS_DEMANDAS || [])];
  const items=rawItems.map(item=>({...item,__clientMasterNames:clientesDoItem(item).map(clientMasterResolveName)}));
  const names=[...new Set([...items.flatMap(item=>item.__clientMasterNames),...CLIENT_MASTER_HEADS.map(row=>clientMasterResolveName(row.name)),...CLIENT_MASTER_ACESSOS.map(row=>clientMasterResolveName(row.name))].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const done=['Feito','Finalizado','feito','finalizado','Concluídas','concluída'];
  return names.map(name=>{
    const clientItems=items.filter(item=>item.__clientMasterNames.includes(name));
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
  const conta = { ativos:0, inativos:0, sem:0, ignorados:0, conteudos:0, conteudosAbertos:0, demandas:0, demandasAbertas:0 };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const registros = clientMasterRecords();
  const vistosConteudos = new Set(), vistasDemandas = new Set();
  (nomes || []).forEach((nome) => {
    const f = cadastroDoCliente(nome);
    const texto = String(f?.status || '').trim();
    // Quem foi marcado como "não é cliente" não conta como ativo no título (a lista também não o mostra).
    if (f?.nao_e_cliente) conta.ignorados += 1;
    else if (!f || (!texto && f.ativo !== false)) conta.sem += 1;
    else if (texto ? /inativ/i.test(texto) : f.ativo === false) conta.inativos += 1;
    else conta.ativos += 1;
    const r = registros.find((item) => item.name === nome);
    if (!r) return;
    r.content.forEach(d => { if(vistosConteudos.has(String(d.id))) return; vistosConteudos.add(String(d.id)); conta.conteudos++; if(!CONCLUIDO.includes(String(d.status || ''))) conta.conteudosAbertos++; });
    r.requests.forEach(d => { if(vistasDemandas.has(String(d.id))) return; vistasDemandas.add(String(d.id)); conta.demandas++; if(!CONCLUIDO.includes(String(d.status || ''))) conta.demandasAbertas++; });
  });
  return conta;
}

function renderClientMasterOverview() {
  const records=clientMasterRecords();
  const active=records.filter(record=>record.activeCount>0).length;
  const content=new Set(records.flatMap(record=>record.content.map(item=>String(item.id)))).size;
  const requests=new Set(records.flatMap(record=>record.requests.map(item=>String(item.id)))).size;
  const activeRequests=new Set(records.flatMap(record=>record.requests.filter(item=>!['Feito','Finalizado','feito','finalizado','Concluídas'].includes(String(item.status||''))).map(item=>String(item.id)))).size;
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
// ── Peças do padrão v2 (quadros Clientes e Ficha do cliente do moodboard, 12/11/2026) ──
// A cor do cliente é a da carteira dele (Vinícius laranja, Ewerton azul); sem carteira, o texto neutro.
const V2F_CERTO = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
function corDoClienteV2(nome) {
  const c = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '';
  return c === 'vinicius' ? '#C2490C' : c === 'ewerton' ? '#3B5BA9' : '#6B665E';
}
function iniciaisV2(nome) {
  return (String(nome || '').trim().split(/\s+/)[0] || '?').slice(0, 2).toUpperCase();
}
function primeiroNomeV2(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}
function hojeIsoV2() {
  return (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
}
// A fala do agente dono da tela: bolinha lilás, "Nome · Papel", a frase e um botão.
function falaV2Html(quem, frase, botao = '') {
  return `<span class="v2f-ag" aria-hidden="true">${safeText(String(quem).slice(0, 1))}</span>
    <p class="v2f-fala-texto"><span class="v2f-quem">${safeText(quem)}</span>${frase}</p>${botao}`;
}
function tomDaSaudeV2(s) {
  if (!s || !Number.isFinite(Number(s.score))) return null;
  return s.risco === 'alto' ? { texto: '#B42318', barra: '#B42318' }
    : s.risco === 'medio' ? { texto: '#7A4A00', barra: '#E0A21B' } : { texto: '#11613A', barra: '#11613A' };
}
// Conteúdos em aberto do cliente, com a data que manda (a veiculação; sem ela, o prazo).
function conteudosAbertosV2(nome) {
  const record = clientMasterRecords().find((item) => item.name === nome) || { content: [] };
  return record.content.filter((d) => !CONCLUIDO_NA_LISTA.includes(d.status))
    .map((d) => ({ d, quando: String(d.veiculacao_iso || d.prazo_iso || '').slice(0, 10) }));
}
function vencidosDoCliente(nome) {
  const hoje = hojeIsoV2();
  return conteudosAbertosV2(nome).filter((x) => x.quando && x.quando < hoje).sort((a, b) => a.quando.localeCompare(b.quando));
}
function quandoVeiculaV2(iso) {
  if (!iso) return 'sem data';
  const hoje = hojeIsoV2();
  const dias = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 864e5);
  if (dias === 0) return 'veicula hoje';
  if (dias === 1) return 'veicula amanhã';
  if (dias > 1 && dias < 7) return `veicula ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(`${iso}T12:00:00Z`).getUTCDay()]}`;
  return `veicula ${iso.slice(8)}/${iso.slice(5, 7)}`;
}
function tomDoStatusV2(status) {
  const s = String(status || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/altera|ajuste|corre|info|falta/.test(s)) return 'a';
  if (/andamento|produ|aprova/.test(s)) return 'b';
  if (/pode fazer|pronta|liberad/.test(s)) return 'g';
  return 'n';
}
const MESES_V2 = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataPorExtensoV2(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${Number(m[3])} de ${MESES_V2[Number(m[2]) - 1]}` : '';
}

// Planejamentos do cliente para a ficha (a mesma leitura do cartão antigo, area=planejamentos). Fica guardada até a
// ficha ser aberta de novo.
const PLANEJAMENTOS_DA_FICHA = {};
function planejamentosDaFicha(id, nome) {
  if (!id || typeof pljPedir !== 'function') return { lista: [], podeCriar: false };
  const atual = PLANEJAMENTOS_DA_FICHA[id];
  if (atual) return atual.lendo ? null : atual;
  PLANEJAMENTOS_DA_FICHA[id] = { lendo: true };
  pljPedir(`cliente_id=${encodeURIComponent(id)}`)
    .then((d) => { const lista = d.disponivel ? (d.planejamentos || []) : [];
      PLANEJAMENTOS_DA_FICHA[id] = { lista, podeCriar: Boolean(d.disponivel) && (lista.some((p) => p.pode_editar) || podeEditorClientesNaFicha()) }; })
    .catch((e) => { PLANEJAMENTOS_DA_FICHA[id] = { lista: [], podeCriar: false, erro: e.message }; })
    .finally(() => { if (CLIENTE_ABERTO === nome && document.getElementById('panel-cliente-detalhe')?.style.display !== 'none') renderClientMasterDetail(nome); });
  return null;
}

// Quadro "Ficha do cliente" do moodboard (12/11/2026): uma linha só no alto, com Clientes (voltar), o nome na cor do
// cliente, a situação, segmento, plano e head, e à direita Editar cadastro e Nova demanda (a única ação cheia da tela).
// A ficha na prancha V2-M-Cliente-Ficha (16/11/2026): o alto fica no vidro, numa linha só (voltar, a foto, o nome com o
// segmento, o plano, o head e a situação, as abas, o lápis do cadastro e Nova demanda). As abas são postas por
// vybe-clientes-ficha.js em #ficha-abas-topo.
const FV2_IC = {
  volta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
};
function cabecaDaFichaHtml(nome, { f, meta, estado, podeMexer, aspas }) {
  const segmento = String(f.segmento || meta.segment || '').trim();
  const plano = String(f.plano || meta.plan || '').trim();
  const heads = String(f.heads || meta.head || '').split(',').map((n) => n.trim()).filter(Boolean);
  const meio = (texto, chamada, titulo) => podeMexer && chamada
    ? `<span class="clf-meta-item editavel" role="button" tabindex="0" title="${titulo}" onclick="${chamada}" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();this.click()}">${texto}</span>`
    : `<span class="clf-meta-item">${texto}</span>`;
  const headHtml = heads.length ? `head <span title="${safeText(heads.join(', '))}">${safeText(heads.map(primeiroNomeV2).join(', '))}</span>` : 'sem head';
  return `<div class="clf-cabeca-linha fv2-topo d3m-topo">
      <button type="button" class="d3m-ico clf-voltar" onclick="voltarClientesLista()" aria-label="Voltar para Clientes" title="Voltar para Clientes">${FV2_IC.volta}</button>
      ${fotoDoClienteCv2(nome, true)}
      <div class="d3m-tit fv2-tit"><h2 class="clf-nome fv2-nome">${safeText(nome)}</h2>
      <p class="clf-meta fv2-meta">${[
          meio(segmento ? safeText(segmento) : 'sem segmento', `abrirSegmentoDoCliente(event, '${aspas}')`, 'Trocar o segmento'),
          meio(plano ? safeText(plano) : 'sem plano', `editarCampoDaFicha(event, '${aspas}', 'plano')`, 'Editar o plano'),
          meio(headHtml, `abrirHeadsDoCliente(event, '${aspas}')`, 'Escolher o head'),
          // A situação na linha do cadastro: o mesmo botão de antes, sem a etiqueta colorida (a folha antiga força a cor dela).
          situacaoDoClienteHtml(nome, estado).replace('class="cli-situacao ', 'class="fv2-sit '),
        ].join('<i class="clf-ponto" aria-hidden="true">·</i>')}</p></div>
      <span class="fv2-abas-topo" id="ficha-abas-topo"></span>
      <span class="clf-acoes fv2-acoes">
        ${podeMexer ? `<button type="button" class="d3m-ico" onclick="abrirFichaDeCliente('${aspas}')" aria-label="Editar cadastro" title="Editar cadastro">${FV2_IC.lapis}</button>` : ''}
        <button type="button" class="cv2-novo" onclick="openCadastrosGoverned({ client: '${aspas}' })">${CV2_IC.novo}Nova demanda</button>
      </span>
    </div>`;
}
// A carteira lida para a ficha (GET area=carteira, só leitura): o clima do grupo, o onboarding e os sinais do servidor
// (NPS, reunião, contrato) que entram na nota. Lida uma vez ao abrir a ficha e guardada por 2 minutos; quando chega,
// a ficha que estiver aberta se redesenha.
const CARTEIRA_DA_FICHA = { dados: null, lendo: false, em: 0, saude: null };
function carteiraDaFicha(aoChegar) {
  const c = CARTEIRA_DA_FICHA;
  if (c.dados && Date.now() - c.em < 120000) return c.dados;
  if (!c.lendo && typeof fetch === 'function') {
    c.lendo = true;
    fetch('/api/painel?area=carteira', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { c.lendo = false; c.em = Date.now(); c.dados = d && typeof d === 'object' ? d : {}; c.saude = null; if (typeof aoChegar === 'function') aoChegar(); });
  }
  return c.dados;
}
// A nota do cliente com os pontos de cada motivo (a mesma conta da Carteira, com os sinais e o clima do servidor).
function saudeDaFicha(id, sv) {
  const S = typeof window !== 'undefined' ? window.VybeCarteiraSaude : null;
  if (!id || !S || !sv) return null;
  try {
    if (!CARTEIRA_DA_FICHA.saude) {
      const pecas = typeof unifiedOperationalItems === 'function' ? unifiedOperationalItems() || [] : typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : [];
      const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
      CARTEIRA_DA_FICHA.saude = S.calcular({ demandas: pecas, clientes: cad, sinais: sv.sinais || null, clima: sv.clima?.disponivel ? sv.clima : null, hoje: hojeIsoV2() });
    }
    return CARTEIRA_DA_FICHA.saude.clientes.find((x) => String(x.id) === String(id)) || null;
  } catch { return null; }
}
// O Resumo da ficha na prancha V2-M-Cliente-Ficha (16/11/2026), em três colunas na janela de vidro:
//   à esquerda (folhas): "Próximas entregas" em cartões da peça e "Depois das vencidas", o que pede ação em ordem;
//   no meio: o cartão laranja do Mateus com o mais grave da conta e a folha "As vencidas", a mais antiga primeiro;
//   à direita, direto no vidro: Saúde com os pontos de cada motivo, Última reunião, Dados e acessos, Planejamentos,
//   Clima do grupo e Onboarding (sem leitura, "Ainda sem dado").
// As listas completas (prazo, status e seleção de vários) ficam nas abas Conteúdo e Demandas.
function renderClientMasterDetail(cli) {
  const record=clientMasterRecords().find(item=>item.name===cli || normalizeClientKey(item.name)===normalizeClientKey(cli));
  const node=document.getElementById('client-master-detail');
  if(!node || !record) return;
  const nome = record.name;
  const meta = record.meta || {};
  const f = cadastroDoCliente(nome) || {};
  const aspas = jsArg(nome); // nome em argumento de onclick (auditoria 15/11/2026)
  const id = idDoCliente(nome);
  const podeMexer = Boolean(id) && podeEditorClientesNaFicha();
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const diaMes = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const vai = CV2_IC.vai;

  const situacao = String(f.status || '').trim();
  const estado = !situacao ? (f.ativo === false ? 'inativos' : 'sem')
    : /inativ/i.test(situacao) ? 'inativos' : 'ativos';
  const cabeca = document.getElementById('cliente-detalhe-cabeca');
  if (cabeca) cabeca.innerHTML = cabecaDaFichaHtml(nome, { f, meta, estado, podeMexer, aspas });

  const painel = String(f.dashboard || meta.dashboard || '').trim();
  const reuniao = dataBr(f.proxima_reuniao || meta.nextMeeting);
  const { conteudos, pedidos } = abertosDoCliente(nome);
  const abertos = conteudosAbertosV2(nome);
  const vencidas = vencidosDoCliente(nome);
  const hoje = hojeIsoV2();
  const s = id ? saudesDaCarteira()(nome) : null;
  const semConversa = id ? diasSemContato(f) : null;
  const completo = id && typeof completudeDoCadastro === 'function' ? completudeDoCadastro(f) : null;
  const repinta = () => { const aberto = document.getElementById('client-master-detail');
    if (aberto && aberto.dataset.cliente === nome && aberto.isConnected) renderClientMasterDetail(nome); };
  // A carteira lida do servidor (clima do grupo, onboarding e os sinais que entram na nota).
  const sv = id ? carteiraDaFicha(repinta) : null;
  const sd = saudeDaFicha(id, sv) || s;
  node.dataset.cliente = nome;
  // Nome da peça em duas partes: "Card - Dia do cliente" vira o tipo e o título.
  const partes = (d) => { const bruto = String(d.nome || d.formato || 'Peça'), m = /^(.*?)\s+-\s+(.*)$/.exec(bruto);
    return m ? [m[1], m[2]] : [String(d.formato || '').trim() || 'Peça', bruto]; };
  const quandoCurto = (iso) => (!iso ? 'sem data' : iso === hoje ? 'hoje' : diaMes(iso));
  const abrirPeca = (d) => `onclick="if(typeof openItemWorkspace==='function')openItemWorkspace('${jsArg(String(d.id))}')"`;
  const matiz = (t) => { let h = 7; for (const ch of String(t || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h % 360; };

  // ── Próximas entregas: os cartões da peça ──
  const proximas = abertos.filter((x) => !x.quando || x.quando >= hoje).sort((a, b) => (a.quando || '9999').localeCompare(b.quando || '9999'));
  const NA_FRENTE = 8;
  const cartaoPeca = (x) => { const [tipo, titulo] = partes(x.d);
    return `<button type="button" class="fv2-peca" style="--h:${matiz(tipo + titulo)}" title="Abrir ${safeText(x.d.nome || '')}" ${abrirPeca(x.d)}>
      <span class="fv2-peca-tipo">${safeText(tipo)} · ${quandoCurto(x.quando)}</span>
      <span class="fv2-peca-pe"><b>${safeText(titulo)}</b><span class="fv2-peca-st ${tomDoStatusV2(x.d.status)}"><i aria-hidden="true"></i>${safeText(x.d.status || 'Sem status')}</span></span></button>`; };
  const cartaoEntregas = `<section class="fv2-folha fv2-entregas" aria-label="Próximas entregas"><div class="cv2-cab"><h3>Próximas entregas</h3><span class="fv2-cab-lado">${plural(conteudos, 'em aberto', 'em aberto')}${pedidos ? ` · ${plural(pedidos, 'pedido', 'pedidos')}` : ''}
        <button type="button" class="cv2-chip" onclick="trocarAbaDaFicha('conteudo')">ver na aba Conteúdo</button></span></div>
      ${proximas.length ? `<div class="fv2-pecas">${proximas.slice(0, NA_FRENTE).map(cartaoPeca).join('')}</div>`
        : `<p class="d3v-estado"><b>${abertos.length ? 'Nenhuma entrega com data pela frente.' : 'Nenhum conteúdo em aberto.'}</b></p>`}</section>`;

  // ── Depois das vencidas: o que pede ação, na ordem ──
  const plj = planejamentosDaFicha(id, nome);
  const mesPlj = (p) => (typeof pljMes === 'function' ? pljMes(p.mes) : String(p.mes || ''));
  const linhaPede = (rotulo, tom, texto, botao) => `<div class="fv2-lin v2f-lin"><span class="fv2-lin-rot${tom ? ` ${tom}` : ''}">${rotulo}</span><p>${texto}</p>${botao}</div>`;
  const bt = (rotulo, attrs) => `<button type="button" class="d3v-btn sec s" ${attrs}>${rotulo}</button>`;
  const pede = [];
  if (!id && podeEditorClientesNaFicha()) pede.push(linhaPede('Sem ficha', 'a', '<b>Cadastro</b> · ainda não criado', bt('Criar a ficha', `onclick="cadastrarClienteDaOperacao('${aspas}')"`)));
  ((plj && plj.lista) || []).filter((p) => ['ajustes', 'revisar'].includes(p.estado)).forEach((p) => pede.push(
    linhaPede(p.estado === 'ajustes' ? 'Ajustes pedidos' : 'Para revisar', 'a', `<b>Planejamento de ${safeText(mesPlj(p).toLowerCase())}</b> · ${safeText(String(p.titulo || '').replace(/^planejamento de\s*/i, ''))}, versão ${safeText(p.versao)}`,
      bt('Abrir', `aria-label="Abrir o planejamento" onclick="abrirPlanejamento('${jsArg(p.id)}')"`))));
  if (id && !reuniao) pede.push(linhaPede('Sem data', 'a', `<b>Próxima reunião</b> · ${semConversa === null ? 'ainda sem reunião registrada' : semConversa === 0 ? 'a última foi hoje' : `a última foi há ${plural(semConversa, 'dia', 'dias')}`}`,
    podeMexer ? bt('Marcar reunião', `onclick="editarCampoDaFicha({ currentTarget: this.closest('.v2f-lin') }, '${aspas}', 'proxima_reuniao')"`) : ''));
  if (completo && completo.feitos < completo.total) pede.push(linhaPede(`${completo.feitos} de ${completo.total}`, '', `<b>Cadastro</b> · faltam ${safeText(completo.faltam.slice(0, 3).join(', ').toLowerCase())}${completo.faltam.length > 3 ? ` e mais ${completo.faltam.length - 3}` : ''}`,
    podeMexer ? bt('Completar', `onclick="abrirFichaDeCliente('${aspas}')"`) : bt('Ver', `onclick="trocarAbaDaFicha('cadastro')"`)));
  const urlDrive = linkDeCliente(meta.drive);
  const outroLink = linkDeCliente(meta.link);
  const temDoc = Boolean(meta.acessoId && meta.doc);
  const ehManus = /(^|\.)manus\.im$/i.test((() => { try { return new URL(outroLink).hostname; } catch { return ''; } })());
  const rotuloLink = ehManus || meta.temManus ? 'Manus' : 'Link do projeto';
  const faltamAcessos = id ? [urlDrive ? '' : 'Drive', temDoc ? '' : 'documento de acessos', outroLink ? '' : rotuloLink.toLowerCase()].filter(Boolean) : [];
  if (faltamAcessos.length) pede.push(linhaPede(faltamAcessos.length === 1 ? 'Falta 1' : `Faltam ${faltamAcessos.length}`, '', `<b>${safeText(faltamAcessos.join(', ').replace(/, ([^,]*)$/, ' e $1').replace(/^./, (l) => l.toUpperCase()))}</b>`,
    bt(faltamAcessos.length === 1 ? 'Colar o link' : 'Colar os links', `onclick="document.getElementById('fv2-dados')?.scrollIntoView({ block: 'nearest' });document.querySelector('#fv2-dados button')?.focus()"`)));
  const cartaoPede = `<section class="fv2-folha fv2-pede v2f-pede" aria-label="Pede ação"><div class="cv2-cab"><h3>${vencidas.length ? 'Depois das vencidas' : 'Pede ação'}</h3><span class="fv2-cab-lado">${pede.length ? `${plural(pede.length, 'coisa', 'coisas')}, na ordem` : 'nada agora'}</span></div>
      <div class="fv2-linhas">${pede.join('') || '<p class="d3v-estado"><b>Nada pede ação neste cliente agora.</b></p>'}</div></section>`;

  // ── O cartão laranja: o mais grave da conta ──
  const esperam = vencidas.filter((x) => /info/i.test(String(x.d.status || ''))).length;
  const laranja = ({ rotulo, n, titulo, apoio, botoes }) => `<section class="d3-acao d3m-laranja cv2-laranja fv2-laranja" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">M</span>Mateus · ${rotulo}</span>
      <span class="d3m-lar-txt">${n === '' ? '' : `<b class="d3m-lar-num">${n}</b>`}<span class="d3-acao-frase">${titulo}</span>${apoio ? `<small>${apoio}</small>` : ''}<span class="d3m-lar-bts">${botoes}</span></span></section>`;
  const verConta = window.VybeCarteira?.abrir ? `<button type="button" class="d3m-btn l s" onclick="window.VybeCarteira.abrir('saude', { abas: ['saude'] })" aria-label="Ver a conta da nota na Saúde da carteira">Ver a conta</button>` : '';
  const alto = !id ? laranja({ rotulo: 'sem ficha', n: '', titulo: 'Este nome ainda não tem ficha', apoio: 'Aparece na operação, mas não está no cadastro.',
      botoes: podeEditorClientesNaFicha() ? `<button type="button" class="d3m-btn l" onclick="cadastrarClienteDaOperacao('${aspas}')">Criar a ficha</button>` : '' })
    : vencidas.length ? laranja({ rotulo: 'o mais grave da conta', n: vencidas.length, titulo: vencidas.length === 1 ? 'peça passou da veiculação' : 'peças passaram da veiculação',
      apoio: `A mais antiga era para ${diaMes(vencidas[0].quando)}.${esperam ? ` ${esperam === 1 ? 'Uma espera' : `${esperam} esperam`} informação do cliente.` : ''}`,
      botoes: `<button type="button" class="d3m-btn l" title="Abre a aba Conteúdo, onde a data troca na linha" aria-label="Reagendar na aba Conteúdo" onclick="trocarAbaDaFicha('conteudo')">${vencidas.length === 1 ? 'Reagendar' : `Reagendar as ${vencidas.length}`}</button>${verConta}` })
    : semConversa === null || semConversa >= SEM_CONTATO_ATENCAO ? laranja({ rotulo: 'o mais grave da conta', n: semConversa === null ? '' : semConversa,
      titulo: semConversa === null ? 'Sem reunião registrada' : 'dias sem reunião', apoio: 'Nenhuma peça vencida. Eu começaria marcando a reunião.',
      botoes: `${podeMexer ? `<button type="button" class="d3m-btn l" onclick="abrirReuniao('${aspas}')">Nova reunião</button>` : ''}${verConta}` })
    : `<section class="fv2-calmo" aria-label="Leitura do Mateus"><b>A conta está em ordem.</b><span>Nenhuma peça vencida e a última reunião foi ${semConversa === 0 ? 'hoje' : `há ${plural(semConversa, 'dia', 'dias')}`}.</span>${window.VybeCarteira?.abrir ? `<button type="button" class="d3v-btn vidro s" onclick="window.VybeCarteira.abrir('saude', { abas: ['saude'] })">Ver a conta</button>` : ''}</section>`;

  // ── As vencidas: a mais antiga primeiro ──
  const linhaVencida = (x) => { const [tipo, titulo] = partes(x.d), espera = /info/i.test(String(x.d.status || ''));
    return `<button type="button" class="fv2-venc" title="Abrir ${safeText(x.d.nome || '')}" ${abrirPeca(x.d)}><i class="fv2-pt${espera ? ' a' : ''}" aria-hidden="true"></i><span class="fv2-venc-t"><b>${safeText(tipo)}</b> · ${safeText(titulo)}</span><span class="fv2-venc-q">era ${diaMes(x.quando)}</span>${
      x.d.responsavel ? `<i class="cv2-pes" title="${safeText(x.d.responsavel)}" aria-hidden="true">${safeText(iniciaisV2(x.d.responsavel))}</i>` : '<i class="cv2-pes vazio" aria-hidden="true"></i>'}</button>`; };
  const cartaoVencidas = `<section class="fv2-folha fv2-vencidas" aria-label="As vencidas"><div class="cv2-cab"><h3>As vencidas</h3><span class="fv2-cab-lado">${vencidas.length ? 'mais antiga primeiro' : ''}
        ${vencidas.length ? `<button type="button" class="cv2-chip" onclick="trocarAbaDaFicha('conteudo')">ver ${vencidas.length === 1 ? 'a peça' : `as ${vencidas.length}`}</button>` : ''}</span></div>
      <div class="fv2-linhas">${vencidas.map(linhaVencida).join('') || '<p class="d3v-estado"><b>Nenhuma peça vencida.</b>As entregas com data ficam em Próximas entregas.</p>'}</div>
      ${esperam ? '<p class="fv2-legenda"><i class="fv2-pt a" aria-hidden="true"></i>espera informação do cliente</p>' : ''}</section>`;

  // ── A coluna de consulta ──
  const bloco = (titulo, lado, dentro, attrs = '') => `<section class="d3m-cons"${attrs}><div class="d3m-cons-cab"><b>${titulo}</b><span>${lado}</span></div>${dentro}</section>`;
  const tom = tomDaNotaCv2(s);
  const pontos = (sd?.motivos || []).filter((m) => typeof m === 'object' && m.tom === 'ruim' && m.pontos);
  const C = 2 * Math.PI * 22;
  const anel = `<span class="fv2-nota ${tom}"${tom && typeof vbHumorAttr === 'function' ? vbHumorAttr(Number(s.score)) : ''}><svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="22"/><circle class="v" cx="28" cy="28" r="22" stroke-dasharray="${((tom ? Math.max(0, Math.min(100, Number(s.score))) : 0) / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 28 28)"/></svg><b>${tom ? Number(s.score) : '–'}</b></span>`;
  const motivosTxt = pontos.length ? pontos.slice(0, 3).map((m) => `<span class="fv2-mot" title="${safeText(m.texto)}"><b>${String(m.pontos).replace('-', '−')}</b>${safeText(String(m.texto).replace(/^grupo:.*/, 'clima do grupo'))}</span>`).join('')
    : ((s && s.motivos) || []).slice(0, 3).map((m) => `<span class="fv2-mot">${safeText(m)}</span>`).join('') || `<span class="fv2-mot">${tom ? 'nada puxando para baixo' : 'cliente inativo ou sem peças para medir'}</span>`;
  const saude = bloco('Saúde', tom ? ({ alto: 'risco alto', medio: 'risco médio', baixo: 'em dia' }[s.risco] || '') : 'sem nota',
    `<${window.VybeCarteira?.abrir ? `button type="button" onclick="window.VybeCarteira.abrir('saude', { abas: ['saude'] })" title="Ver a conta da nota na Saúde da carteira"` : 'div'} class="fv2-saude">${anel}<span class="fv2-mots">${motivosTxt}</span></${window.VybeCarteira?.abrir ? 'button' : 'div'}>`, ' aria-label="Saúde do cliente"');

  const reu = id && window.VybeReunioes?.dadosDe ? window.VybeReunioes.dadosDe(id) : null;
  const ultima = reu ? (reu.reunioes || []).filter((r) => r.data <= hoje)[0] || (reu.reunioes || [])[0] : null;
  const participantes = String(ultima?.participantes || '').split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const corpoReuniao = !id ? '<p class="d3m-vvazio">Crie a ficha para registrar reuniões.</p>'
    : !reu ? '<p class="d3m-vvazio">Lendo as reuniões…</p>'
    : !ultima ? `<p class="d3m-vvazio">Nenhuma reunião registrada ainda.</p>${reu.pode ? `<button type="button" class="d3m-vlin" onclick="abrirReuniao('${aspas}')"><span><b>Nova reunião</b> · registrar a conversa</span>${vai}</button>` : ''}`
    : `<button type="button" class="d3m-vlin" aria-label="Ver o resumo e as decisões da reunião" onclick="trocarAbaDaFicha('reunioes')">${participantes.slice(0, 2).map((p) => `<i class="d3m-pes" title="${safeText(p)}" aria-hidden="true">${safeText(iniciaisV2(p))}</i>`).join('')}<span><b>${safeText(ultima.titulo)}</b></span><em class="fv2-apoio">${ultima.ata ? 'ata' : ultima.transcricao ? 'transcrição' : 'sem ata'}</em>${vai}</button>`;
  const proxima = !id ? '' : reuniao ? `<div class="d3m-vlin fv2-campo v2f-lin"><span><b>Próxima</b> · ${safeText(reuniao)}</span>${podeMexer ? `<button type="button" class="fv2-mini" onclick="editarCampoDaFicha({ currentTarget: this.closest('.v2f-lin') }, '${aspas}', 'proxima_reuniao')">trocar a data</button>` : ''}</div>` : '';
  const cartaoReuniao = bloco('Última reunião', ultima ? `${dataPorExtensoV2(ultima.data)}${ultima.gravacao ? ' · gravada' : ''}` : '', corpoReuniao + proxima, ' aria-label="Última reunião"');

  // Dados e acessos: cada porta numa linha; o que falta diz "falta" e se guarda ali mesmo.
  const planejamentoUrl = linkDeCliente(f.planejamento_url || meta.planning);
  const porta = (tem, forte, apoio, acao) => `<div class="d3m-vlin fv2-campo client-master-detail-field"><i class="d3m-pt${tem ? ' g' : ' a'}" aria-hidden="true"></i><span><b>${forte}</b>${apoio ? ` · ${apoio}` : ''}</span>${acao}</div>`;
  const abrirLink = (url) => `<a class="fv2-mini" href="${safeText(url)}" target="_blank" rel="noopener" aria-label="Abrir o link numa aba nova">abrir</a>`;
  const guardar = (campo, rotulo) => (podeMexer ? `<button type="button" class="fv2-mini" onclick="editarAcessoDaFicha(event, '${aspas}', '${campo}')">${rotulo}</button>` : '');
  const docBotao = meta.acessoId || podeMexer
    ? `<button type="button" class="fv2-mini" onclick="abrirDocumentoDoCliente('${jsArg(String(meta.acessoId || ''))}', '${aspas}', '${jsArg(id)}')">${temDoc ? 'abrir' : 'escrever'}</button>` : '';
  const linhaAcesso = (rotulo, valorHtml, chamada, acao) => `<div class="clf-acesso client-master-detail-field">
      <small>${rotulo}</small><b>${valorHtml}</b>${podeMexer && chamada ? `<button type="button" class="fv2-mini" onclick="${chamada}">${acao}</button>` : ''}</div>`;
  const cartaoDados = bloco('Dados e acessos', 'senhas só para quem administra', `
      ${porta(urlDrive, 'Drive do cliente', urlDrive ? '' : 'falta', urlDrive ? abrirLink(urlDrive) : guardar('pasta_drive', 'colar o link'))}
      ${porta(temDoc, 'Documento de acessos', temDoc ? '' : 'falta', docBotao)}
      <button type="button" class="d3m-vlin" aria-expanded="false" aria-controls="v2f-acessos-lista" onclick="const l=document.getElementById('v2f-acessos-lista');l.hidden=!l.hidden;this.setAttribute('aria-expanded',String(!l.hidden))"><i class="d3m-pt g" aria-hidden="true"></i><span><b>Acessos</b> · links, senhas e painel</span>${vai}</button>
      <div class="clf-acessos-lista fv2-acessos" id="v2f-acessos-lista" hidden>
        ${linhaAcesso('Pasta do Drive', urlDrive ? `<a href="${safeText(urlDrive)}" target="_blank" rel="noopener">Abrir no Drive</a>` : 'Falta',
          `editarAcessoDaFicha(event, '${aspas}', 'pasta_drive')`, urlDrive ? 'trocar' : 'guardar o endereço')}
        ${linhaAcesso(rotuloLink, outroLink ? `<a href="${safeText(outroLink)}" target="_blank" rel="noopener">Abrir</a>` : meta.temManus ? 'Marcado no Manus, sem endereço' : 'Falta',
          `editarAcessoDaFicha(event, '${aspas}', 'link')`, outroLink ? 'trocar' : 'guardar o endereço')}
        ${linhaAcesso('Planejamento', planejamentoUrl ? `<a href="${safeText(planejamentoUrl)}" target="_blank" rel="noopener">Abrir</a>` : 'Falta',
          podeMexer ? `abrirFichaDeCliente('${aspas}')` : '', 'editar no cadastro')}
        ${linhaAcesso('Painel do cliente', paineldoClienteHtml(painel),
          `editarCampoDaFicha({ currentTarget: this.closest('.clf-acesso') }, '${aspas}', 'dashboard')`, 'trocar')}
      </div>
      ${porta(outroLink, rotuloLink, outroLink ? '' : 'falta', outroLink ? abrirLink(outroLink) : guardar('link', 'colar o link'))}`, ' id="fv2-dados" aria-label="Dados e acessos"');

  // Planejamentos: uma linha por mês e "Começar um planejamento".
  const estadoPlj = (p) => String((typeof PLJ_ESTADOS !== 'undefined' && PLJ_ESTADOS[p.estado]?.rotulo) || p.estado || '').toLowerCase();
  const linhasPlj = !id ? '' : !plj ? '<p class="d3m-vvazio">Buscando os planejamentos…</p>'
    : `${plj.lista.map((p) => `<button type="button" class="d3m-vlin" onclick="abrirPlanejamento('${jsArg(p.id)}')"><span><b>${safeText(mesPlj(p))}, versão ${safeText(p.versao)}</b>${estadoPlj(p) ? ` · ${safeText(estadoPlj(p))}` : ''}</span>${vai}</button>`).join('')}${
      plj.podeCriar && typeof novoPlanejamento === 'function' ? `<button type="button" class="d3m-vlin" onclick="novoPlanejamento('${jsArg(id)}', '${aspas}')"><span><b>Começar um planejamento</b></span>${vai}</button>` : ''}${
      !plj.lista.length && !plj.podeCriar ? `<p class="d3m-vvazio">${plj.erro ? safeText(plj.erro) : 'Nenhum planejamento ainda.'}</p>` : ''}`;
  const planejamentos = id ? bloco('Planejamentos', '', linhasPlj, ' aria-label="Planejamentos"') : '';

  // Clima do grupo e Onboarding: aparecem quando há leitura; sem nenhuma, um aviso curto.
  const cl = id && sv?.clima?.disponivel ? (sv.clima.porCliente || {})[String(id)] : null;
  const temClima = cl && Number.isFinite(Number(cl.pontos));
  const ob = id && sv?.onboarding?.disponivel ? (sv.onboarding.clientes || []).find((o) => String(o.cliente_id) === String(id)) : null;
  const sit = ob?.situacao;
  const totalItens = sit ? (sit.etapas || []).reduce((t, e) => t + (Number(e.total) || 0), 0) : 0;
  const feitosItens = sit ? (sit.etapas || []).reduce((t, e) => t + (Number(e.feitos) || 0), 0) : 0;
  const clima = temClima ? bloco('Clima do grupo', `${Number(cl.pontos) > 0 ? '+' : Number(cl.pontos) < 0 ? '−' : ''}${Math.abs(Number(cl.pontos))} pts`,
    `<p class="d3m-vvazio">${cl.motivo ? safeText(cl.motivo) : 'Leitura do grupo pelo VYBES.'}</p>`, ' aria-label="Clima do grupo"') : '';
  const onboarding = sit ? bloco('Onboarding', sit.concluido ? 'concluído' : 'em andamento',
    `<button type="button" class="d3m-vlin" onclick="trocarAbaDaFicha('onboarding')"><span><b>${feitosItens} de ${totalItens}</b>${sit.atual?.nome ? ` · ${safeText(sit.atual.nome)}` : ''}</span><span class="d3m-vbarra"><i style="--v:${totalItens ? Math.round((feitosItens / totalItens) * 100) : 0}%"></i></span>${vai}</button>`, ' aria-label="Onboarding"') : '';
  const semDado = id && !temClima && !sit ? bloco('Ainda sem dado', '', `<p class="cv2-nota fv2-semdado">${!sv ? 'Lendo o clima do grupo e o onboarding…' : 'Clima do grupo e onboarding aparecem aqui quando houver leitura. Hoje não há nada a mostrar.'}</p>`) : '';

  node.innerHTML = `<div class="v2f-corpo fv2-resumo"><div class="fv2-col">${cartaoEntregas}${cartaoPede}</div><div class="fv2-col fv2-meio"><div class="v2f-alto fv2-alto">${alto}</div>${cartaoVencidas}</div>
    <aside class="d3m-lado fv2-lado" aria-label="Consulta">${saude}${cartaoReuniao}${cartaoDados}${planejamentos}${clima}${onboarding}${semDado}</aside></div>`;
}
// Linha que abre no lugar (peça .v2-abre do padrão): o botão e o bloco contam o estado.
function alternarLinhaV2(botao) {
  const bloco = botao?.closest('.v2-abre');
  if (!bloco) return false;
  const aberto = bloco.getAttribute('aria-expanded') !== 'true';
  bloco.setAttribute('aria-expanded', String(aberto));
  bloco.querySelectorAll('[aria-expanded]').forEach((b) => { if (b.closest('.v2-abre') === bloco) b.setAttribute('aria-expanded', String(aberto)); });
  return aberto;
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
// Numero do topo que so informa vira decoracao. Estes dois recortam a lista.
let FOCO_DE_CLIENTES = 'todos';
function focarClientes(qual) {
  FOCO_DE_CLIENTES = FOCO_DE_CLIENTES === qual ? 'todos' : qual;
  renderClientesBoard();
}

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
    ['Responsável geral', descricaoCarteiraCliente(nome).replace('Responsável geral: ', '')],
    ['NPS', temNota(f.nps) ? `${f.nps}${f.nps_em ? ` · ${String(f.nps_em).slice(0,10).split('-').reverse().join('/')}` : ''}` : null],
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

// ── Clientes na prancha V2-M-Clientes (16/11/2026) ──────────────────────────────────────────────────────────────
// A tela é uma janela de vidro: o alto (título que troca de tela, a frase da carteira, Lista/Fichas/Cérebro, busca,
// Mais e Novo cliente), a folha da lista com a pior nota primeiro e o pé "De olho", e a coluna de consulta (o cartão
// laranja de quem precisa de você, a carteira, por head e Abrir como). Os números que eram cartões viraram a frase do
// alto e o pé; os recortes seguem em Mais > Filtros.
const CV2_IC = {
  vai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
  novo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  busca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
};
const LIMITE_PRECISA_DE_VOCE = 52;
// Quem precisa de você: a mesma regra da Saúde da carteira (risco alto ou nota abaixo do limite).
function clientePrecisaDeVoce(s) {
  if (!s || !Number.isFinite(Number(s.score))) return false;
  return typeof s.precisa === 'boolean' ? s.precisa : s.risco === 'alto' || Number(s.score) < LIMITE_PRECISA_DE_VOCE;
}
// O tom da nota na lista: vermelho em quem precisa de você, verde em quem está em dia e âmbar no meio.
function tomDaNotaCv2(s) {
  if (!s || !Number.isFinite(Number(s.score))) return '';
  return clientePrecisaDeVoce(s) ? 'r' : s.risco === 'baixo' ? 'g' : 'a';
}
// A logo do cliente (vybe-logo-cliente.js: cadastro → Instagram → Drive) ou as iniciais sobre a cor dele (matiz do nome).
function fotoDoClienteCv2(nome, grande = false) {
  const cls = `d3v-foto cv2-foto${grande ? ' g' : ''}`;
  let h = 7; for (const ch of String(nome || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  h %= 360;
  const partes = String(nome || '?').trim().split(/\s+/);
  const letras = (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase() || '?';
  if (nome && typeof logoDoClienteHtml === 'function') return logoDoClienteHtml(nome, { classe: cls, iniciais: letras, estilo: `--h:${h}` });
  return `<i class="${cls}" style="--h:${h}" aria-hidden="true">${safeText(letras)}</i>`;
}
function proximaReuniaoCv2(nome) {
  const f = cadastroDoCliente(nome) || {};
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const iso = String(f.proxima_reuniao || ligado.nextMeeting || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { iso: '', texto: 'sem data' };
  const dia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return { iso, texto: `${dia} ${iso.slice(8)}/${iso.slice(5, 7)}`, passou: iso < hojeIsoV2() };
}
// O foco escolhido (o cartão laranja, o pé "De olho" ou Mais > Filtros) recorta a lista inteira.
function clientePassaNoFoco(nome, foco = FOCO_DE_CLIENTES, saudeDe = null) {
  if (foco === 'todos') return true;
  const f = cadastroDoCliente(nome) || {};
  if (foco === 'sem-contato') { const d = diasSemContato(f); return d !== null && d >= SEM_CONTATO_ATENCAO; }
  if (foco === 'sem-registro') return diasSemContato(f) === null;
  if (foco === 'detratores') return temNota(f.nps) && Number(f.nps) <= 6;
  if (foco === 'painel-velho') { const p = String(f.dashboard || '').trim(); return Boolean(p) && !painelEstaEmDia(p); }
  if (foco === 'precisam') return clientePrecisaDeVoce((saudeDe || saudesDaCarteira())(nome));
  if (foco === 'sem-proxima') return !proximaReuniaoCv2(nome).iso;
  if (foco === 'cadastro-incompleto') { const c = typeof completudeDoCadastro === 'function' ? completudeDoCadastro(cadastroDoCliente(nome)) : null; return !c || c.feitos < c.total; }
  if (foco === 'com-nps') return temNota(f.nps);
  return true;
}
// O título troca de tela dentro de Clientes: as mesmas rotas do menu lateral (Saúde, Onboarding, Reuniões, Contratos e Churn).
function abrirTrocaDeClientes(gatilho) {
  const alvo = (id) => document.querySelector(`.vv-trilho [data-submodulo="${id}"], .vv-trilho [data-trilho="${id}"]`);
  const telas = [['', 'Clientes'], ['carteira', 'Saúde da carteira'], ['onboarding', 'Onboarding'], ['reunioes', 'Reuniões'], ['contratos', 'Contratos'], ['churn', 'Churn']]
    .filter(([id]) => !id || alvo(id));
  abrirListaDoPainel(gatilho, { titulo: 'Clientes', atual: '', opcoes: telas.map(([valor, rotulo]) => ({ valor, rotulo })),
    aoEscolher: (id) => { if (id) alvo(id)?.click(); } });
}
// "Mais": o que não cabe no alto da prancha fica a um clique (Cadastros, os filtros que eram chips e Limpar filtros).
function abrirMaisDeClientes(gatilho) {
  abrirListaDoPainel(gatilho, { titulo: 'Mais', atual: '', opcoes: [{ valor: 'cadastros', rotulo: 'Cadastros' }, { valor: 'filtros', rotulo: 'Filtros…' }, { valor: 'limpar', rotulo: 'Limpar filtros' }],
    aoEscolher: (valor) => {
      if (valor === 'cadastros') return typeof openCadastrosStation === 'function' ? openCadastrosStation() : undefined;
      if (valor === 'limpar') return limparFiltrosDeClientes();
      return abrirFiltrosDeClientes(document.getElementById('clientes-mais') || gatilho);
    } });
}
function filtrarClientesPorHead(chave) {
  FILTRO_CLIENTES.head = FILTRO_CLIENTES.head === chave ? '' : chave;
  renderClientesBoard();
}
function abrirSaudeDaCarteira() {
  if (window.VybeCarteira?.abrir) window.VybeCarteira.abrir('saude', { abas: ['saude'] });
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
  // Uma conta só de "quantos clientes?", com a mesma regra da lista logo abaixo.
  const numeros = contagemDeClientes(todosClientes);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  // Os recortes contam dentro do Head, da Carteira e do Segmento escolhidos: o número é o que a lista vai mostrar.
  const saudeDe = saudesDaCarteira();
  const nomesAtivos = todosClientes.filter((n) => situacaoDaLinhaDeCliente(n) === 'ativos');
  const noRecorte = nomesAtivos.filter((n) => passaNosFiltrosDeClientes(n, { semBusca: true, semSituacao: true }));
  const conta = (foco) => noRecorte.filter((n) => clientePassaNoFoco(n, foco, saudeDe)).length;
  const semContato = conta('sem-contato'), semRegistro = conta('sem-registro'), painelVelho = conta('painel-velho'), detratores = conta('detratores');
  const precisam = noRecorte.filter((n) => clientePrecisaDeVoce(saudeDe(n)))
    .sort((a, b) => Number(saudeDe(a).score) - Number(saudeDe(b).score) || String(a).localeCompare(String(b), 'pt-BR'));
  const semProxima = conta('sem-proxima'), incompletos = conta('cadastro-incompleto'), comNps = conta('com-nps');
  const vencidasNaCarteira = noRecorte.reduce((t, n) => t + vencidosDoCliente(n).length, 0);
  const recortes = [
    {label:'Precisam de você', value:precisam.length, foco:'precisam'},
    {label:'Sem contato', value:semContato, foco:'sem-contato'},
    {label:'Sem registro de reunião', value:semRegistro, foco:'sem-registro'},
    {label:'Sem próxima reunião', value:semProxima, foco:'sem-proxima'},
    {label:'Cadastro incompleto', value:incompletos, foco:'cadastro-incompleto'},
    {label:'Com NPS', value:comNps, foco:'com-nps'},
    {label:'Detratores', value:detratores, foco:'detratores'},
    {label:'Painel a atualizar', value:painelVelho, foco:'painel-velho'},
  ].map((k) => ({ ...k, acao: `focarClientes('${k.foco}')`, aceso: FOCO_DE_CLIENTES === k.foco }));
  const visao = visaoDeClientes(), noCerebro = visao === 'sinapses';
  // A nota média: a da Saúde da carteira; sem ela (a conta ainda não carregou), a média das notas que a lista tem.
  const resumo = (() => { try { return window.VybeCarteira?.resumo?.() || null; } catch { return null; } })();
  const notas = nomesAtivos.map((n) => saudeDe(n)).filter((s) => s && Number.isFinite(Number(s.score))).map((s) => Number(s.score));
  const media = resumo?.media ?? (notas.length ? Math.round(notas.reduce((t, x) => t + x, 0) / notas.length) : null);
  const limite = resumo?.limite || LIMITE_PRECISA_DE_VOCE;
  const porCarteira = {};
  nomesAtivos.forEach((n) => { const k = carteiraDaLinhaDeCliente(n); porCarteira[k] = (porCarteira[k] || 0) + 1; });
  const carteiras = ['vinicius', 'ewerton'].filter((k) => porCarteira[k]).map((k) => `${ROTULO_DA_CARTEIRA[k]} ${porCarteira[k]}`).join(', ');

  // O alto: a frase da carteira debaixo do título.
  const frase = document.getElementById('clientes-frase');
  if (frase) frase.textContent = noCerebro ? 'cérebro do VYBES · conhecimento, contexto e atividade de cada conta'
    : [plural(numeros.ativos, 'ativo', 'ativos'), carteiras, media == null ? 'ainda sem nota de saúde' : `nota média ${media} de 100`].filter(Boolean).join(' · ');
  const gradeKpi = document.getElementById('kpi-grid-clientes');
  if (gradeKpi) { gradeKpi.hidden = true; gradeKpi.innerHTML = ''; }
  const acoes = document.getElementById('clientes-acoes');
  if (acoes && noCerebro) acoes.innerHTML = `<span class="clientes-visao" id="clientes-visao-topo"></span><span class="cli-busca cv2-busca cv2c-busca${typeof CEREBRO_STATE !== 'undefined' && CEREBRO_STATE.buscaConhecimento ? ' aberta' : ''}"><button type="button" class="d3m-ico" aria-label="Buscar no conhecimento" title="Buscar no conhecimento" onclick="this.parentElement.classList.add('aberta');this.nextElementSibling.focus()">${CV2_IC.busca}</button><input id="cb-busca-conhecimento" type="search" placeholder="Ideia, regra, peça ou aprendizado" aria-label="Buscar no conhecimento" value="${safeText(typeof CEREBRO_STATE !== 'undefined' ? CEREBRO_STATE.buscaConhecimento : '')}" oninput="pesquisarConhecimentoCerebro(this)" onblur="if(!this.value)this.parentElement.classList.remove('aberta')"></span><button type="button" class="cv2-vidro" onclick="carregarAtividadeCerebro()">Atualizar a central</button>`;
  else if (acoes) acoes.innerHTML = `<span class="clientes-visao" id="clientes-visao-topo"></span><button type="button" class="d3m-ico" id="clientes-mais" aria-haspopup="listbox" aria-label="Mais: cadastros e filtros" title="Cadastros e filtros" onclick="abrirMaisDeClientes(this)">${CV2_IC.mais}</button>${
    podeEditarClientes() ? `<button type="button" class="cv2-novo d3f-novo" onclick="novoClienteNoPainel()">${CV2_IC.novo}Novo cliente</button>` : ''}`;

  // O cartão laranja do Mateus: quem precisa de você. Sem ninguém abaixo do limite, o que falta registrar; sem nada
  // a pedir, o cartão sai (laranja é só ação).
  const aviso = document.getElementById('clientes-aviso');
  if (aviso) {
    const focoPrecisam = FOCO_DE_CLIENTES === 'precisam', focoRegistro = FOCO_DE_CLIENTES === 'sem-registro';
    const cartao = ({ rotulo, n, titulo, apoio, botoes }) => `<section class="d3-acao d3m-laranja cv2-laranja" aria-label="${safeText(rotulo)}"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">M</span>Mateus · ${safeText(rotulo)}</span>
        <span class="d3m-lar-txt"><b class="d3m-lar-num">${n}</b><span class="d3-acao-frase">${safeText(titulo)}</span>${apoio ? `<small>${safeText(apoio)}</small>` : ''}<span class="d3m-lar-bts">${botoes}</span></span></section>`;
    let html = '';
    if (precisam.length) {
      const pior = precisam[0], s = saudeDe(pior), venc = vencidosDoCliente(pior).length;
      const abaixo = precisam.every((n) => Number(saudeDe(n).score) < limite);
      html = cartao({ rotulo: 'quem precisa de você', n: precisam.length,
        titulo: abaixo ? `${precisam.length === 1 ? 'cliente' : 'clientes'} com nota abaixo de ${limite}` : `${precisam.length === 1 ? 'cliente precisa' : 'clientes precisam'} de você`,
        apoio: `A pior nota é de ${pior}: ${Number(s.score)}${venc ? `, com ${plural(venc, 'vencida', 'vencidas')}` : ''}.`,
        botoes: `<button type="button" class="d3m-btn l cv2-abrir" title="Abrir a ficha de ${safeText(pior)}" onclick="abrirClienteDetalhe('${jsArg(pior)}')"><span>Abrir ${safeText(pior)}</span></button>${
          precisam.length > 1 || focoPrecisam ? `<button type="button" class="d3m-btn l s" role="switch" aria-checked="${focoPrecisam}" onclick="focarClientes('precisam')">${focoPrecisam ? 'Ver todos' : `Ver os ${precisam.length}`}</button>` : ''}` });
    } else if (semRegistro || focoRegistro) {
      html = cartao({ rotulo: 'o que falta registrar', n: semRegistro, titulo: `${semRegistro === 1 ? 'cliente' : 'clientes'} sem reunião registrada`,
        apoio: focoRegistro ? 'A lista mostra só quem não tem reunião registrada.' : 'Ninguém está abaixo da nota de alerta.',
        botoes: `<button type="button" class="d3m-btn l" role="switch" aria-checked="${focoRegistro}" onclick="focarClientes('sem-registro')">${focoRegistro ? 'Ver todos' : 'Completar cadastros'}</button>` });
    }
    aviso.className = 'cli-aviso cv2-aviso';
    aviso.hidden = !html || noCerebro;
    aviso.innerHTML = aviso.hidden ? '' : html;
  }

  // A coluna de consulta, direto no vidro: a carteira, por head e Abrir como.
  const consulta = document.getElementById('clientes-consulta');
  if (consulta) {
    const bloco = (titulo, lado, dentro) => `<section class="d3m-cons" aria-label="${safeText(titulo)}"><div class="d3m-cons-cab"><b>${safeText(titulo)}</b><span>${lado}</span></div>${dentro}</section>`;
    const linha = (forte, apoio, attrs, extra = '') => `<button type="button" class="d3m-vlin" ${attrs}>${extra}<span><b>${safeText(forte)}</b>${apoio ? ` · ${safeText(apoio)}` : ''}</span>${CV2_IC.vai}</button>`;
    const C = 2 * Math.PI * 17;
    const anel = `<svg class="cv2-anel-g" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17"/><circle class="v" cx="22" cy="22" r="17" stroke-dasharray="${(Math.max(0, Math.min(100, Number(media) || 0)) / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 22 22)"/></svg>`;
    const causa = resumo?.causa ? resumo.causa.replace(/^./, (l) => l.toUpperCase()) : '';
    const quem = resumo && resumo.clientesDaCausa >= resumo.total ? 'cada um' : resumo ? plural(resumo.clientesDaCausa, 'cliente', 'clientes') : '';
    const [forte, apoio] = !resumo ? [media == null ? 'Ainda sem nota' : `Nota média ${media}`, 'a conta da saúde ainda não carregou nesta tela']
      : !resumo.causa ? ['Ninguém perdeu ponto', 'nenhum sinal tirando nota da carteira']
      : resumo.deAtraso ? [`Resolvidas as vencidas, vai a ${resumo.semEla}`, `hoje são elas que tiram ${resumo.tiraIgual ? '' : 'até '}${resumo.tira} pontos de ${quem}`]
      : [`${causa}: resolvido, vai a ${resumo.semEla}`, `hoje tira ${resumo.tiraIgual ? '' : 'até '}${resumo.tira} pontos de ${quem}`];
    const carteira = bloco('A carteira', media == null ? 'sem nota' : `nota média ${media}`,
      `<button type="button" class="cv2-carteira" onclick="abrirSaudeDaCarteira()" title="Abrir a Saúde da carteira">${anel}<span><b>${safeText(forte)}</b><small>${safeText(apoio)}</small></span></button>`);
    // Por head: quantos clientes ativos cada head tem e a nota média deles; o clique recorta a lista.
    const heads = new Map();
    nomesAtivos.forEach((n) => headsDoClienteNaLista(n).forEach((h) => { const k = primeiroNomeDe(h), x = heads.get(k) || { rotulo: String(h).split(/\s+/)[0], n: 0, soma: 0, comNota: 0 };
      const s = saudeDe(n); x.n += 1; if (s && Number.isFinite(Number(s.score))) { x.soma += Number(s.score); x.comNota += 1; } heads.set(k, x); }));
    const porHead = heads.size ? bloco('Por head', 'clientes · nota', [...heads.entries()].sort((a, b) => b[1].n - a[1].n || a[1].rotulo.localeCompare(b[1].rotulo, 'pt-BR')).slice(0, 4)
      .map(([k, x]) => `<button type="button" class="d3m-vlin" role="switch" aria-checked="${FILTRO_CLIENTES.head === k}" title="Ver só os clientes de ${safeText(x.rotulo)}" onclick="filtrarClientesPorHead('${jsArg(k)}')"><i class="d3m-pes" aria-hidden="true">${safeText(iniciaisV2(x.rotulo))}</i><span><b>${safeText(x.rotulo)}</b> · ${plural(x.n, 'cliente', 'clientes')}</span><b class="d3m-vn">${x.comNota ? Math.round(x.soma / x.comNota) : '–'}</b>${CV2_IC.vai}</button>`).join('')) : '';
    const abrir = bloco(visao === 'tabela' ? 'Abrir como' : 'Abrir', '', [
      visao !== 'tabela' ? linha('Lista', 'a pior nota primeiro, em linhas', `onclick="trocarVisaoDeClientes('tabela')"`) : '',
      visao !== 'fichas' ? linha('Fichas', `${numeros.ativos === 1 ? 'o ativo em cartão' : `os ${numeros.ativos} em cartões`}, com a foto`, `onclick="trocarVisaoDeClientes('fichas')"`) : '',
      visao !== 'sinapses' ? linha('Cérebro', 'o que o VYBES sabe de cada um', `onclick="trocarVisaoDeClientes('sinapses')"`) : '',
      linha('Cadastros', numeros.sem ? `${numeros.sem} só na operação, sem ficha` : 'todos com ficha no cadastro', 'onclick="openCadastrosStation()"'),
      window.VybeCarteira?.abrir ? linha('Saúde mês a mês', 'como a nota é feita', 'onclick="abrirSaudeDaCarteira()"') : '',
    ].join(''));
    const notaFichas = visao === 'fichas' ? '<section class="d3m-cons"><div class="d3m-cons-cab"><b>O cartão abre a ficha</b><span></span></div><p class="cv2-nota">Drive, documento, CNPJ e endereço saíram do cartão e ficam na ficha, na aba Ecossistema e no cadastro.</p></section>' : '';
    consulta.hidden = noCerebro;
    consulta.innerHTML = noCerebro ? '' : (visao === 'fichas' ? notaFichas + porHead + abrir : carteira + porHead + abrir);
  }

  // O título da folha e o pé "De olho": quatro contas da carteira; o clique recorta a lista.
  const titulo = document.getElementById('clientes-conta');
  const sit = FILTRO_CLIENTES.situacao;
  const ROT_ORDEM = { saude: ['pior nota primeiro', 'melhor nota primeiro'], cliente: ['por nome', 'por nome, de trás para a frente'], head: ['por head', 'por head, de trás para a frente'],
    abertos: ['mais vencidas primeiro', 'menos vencidas primeiro'], reuniao: ['reunião mais próxima primeiro', 'reunião mais distante primeiro'], cadastro: ['cadastro mais vazio primeiro', 'cadastro mais cheio primeiro'] };
  const ordemTxt = (ROT_ORDEM[ORDEM_DE_CLIENTES.coluna] || ROT_ORDEM.saude)[ORDEM_DE_CLIENTES.sentido > 0 ? 0 : 1];
  const mostrados = todosClientes.filter((n) => passaNosFiltrosDeClientes(n) && clientePassaNoFoco(n, FOCO_DE_CLIENTES, saudeDe)).length;
  const oQue = sit === 'ativos' ? ['cliente ativo', 'clientes ativos'] : sit === 'inativos' ? ['cliente inativo', 'clientes inativos'] : sit === 'sem' ? ['só na operação', 'só na operação'] : sit === 'ignorados' ? ['que não é cliente', 'que não são clientes'] : ['cliente', 'clientes'];
  if (titulo) titulo.innerHTML = `${plural(mostrados, oQue[0], oQue[1])} <span>· ${visao === 'fichas' ? 'pior nota primeiro' : ordemTxt}</span>`;
  const pe = document.getElementById('clientes-pe');
  if (pe) {
    const ficha = (n, rotulo, tom, attrs) => `<button type="button" class="cv2-olho${tom ? ` ${tom}` : ''}" ${attrs}><b>${n}</b><small>${rotulo}</small></button>`;
    const foco = (id) => `role="switch" aria-checked="${FOCO_DE_CLIENTES === id}" onclick="focarClientes('${id}')"`;
    pe.hidden = visao !== 'tabela';
    pe.innerHTML = `<span class="d3m-olho-rot">De olho</span>${ficha(vencidasNaCarteira, vencidasNaCarteira === 1 ? 'peça vencida na carteira' : 'peças vencidas na carteira', vencidasNaCarteira ? 'r' : '', `title="Ordenar por quem tem mais vencidas" onclick="ordenarClientesPor('abertos')"`)
      }${ficha(semProxima, 'sem próxima reunião', semProxima ? 'a' : '', foco('sem-proxima'))}${ficha(incompletos, 'com cadastro incompleto', '', foco('cadastro-incompleto'))}${ficha(comNps, 'com NPS', '', foco('com-nps'))}`;
  }
  const corpo = document.getElementById('clientes-corpo');
  if (corpo) corpo.dataset.visao = visao;
  marcarTelaDeClientes();
  RECORTES_DE_CLIENTES = recortes;
  pintarFiltrosDeClientes(recortes);
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
  try {
    const v = localStorage.getItem('vybe_clientes_visao');
    return v === 'fichas' || v === 'sinapses' ? v : 'tabela';
  } catch { return 'tabela'; }
}
function trocarVisaoDeClientes(qual) {
  try { localStorage.setItem('vybe_clientes_visao', qual); } catch { /* sem armazenamento */ }
  renderClientesBoard();
}

function selosDeVisaoDeClientes() {
  // Lista/Fichas/Cérebro ficam no alto, no vidro; o lugar antigo (na folha) fica vazio.
  const antigo = document.getElementById('clientes-visao');
  const alvo = document.getElementById('clientes-visao-topo') || antigo;
  if (!alvo) return;
  if (antigo && antigo !== alvo) { antigo.innerHTML = ''; antigo.hidden = true; }
  const atual = visaoDeClientes();
  alvo.className = 'clientes-visao cv2-seg';
  alvo.setAttribute('role', 'radiogroup');
  alvo.setAttribute('aria-label', 'Como ver os clientes');
  alvo.innerHTML = [['tabela', 'Lista'], ['fichas', 'Fichas'], ['sinapses', 'Cérebro']].map(([id, rotulo]) =>
    `<button type="button" role="radio" aria-checked="${atual === id}"${id === 'sinapses' ? ' title="Cérebro VYBES"' : ''}
      onclick="trocarVisaoDeClientes('${id}')">${rotulo}</button>`).join('');
}

// ── Filtros da lista (quadro Clientes do moodboard): busca, Ativos, Inativos, Carteira, Head, Filtros e Colunas ──
// Valem para a tabela e para as fichas (o Cérebro tem o mapa inteiro). Ficam só nesta aba do navegador.
// A lista abre nos Ativos, como no quadro; tocar de novo em Ativos mostra todos.
const FILTRO_CLIENTES = { head: '', segmento: '', busca: '', situacao: 'ativos', carteira: '' };
let RECORTES_DE_CLIENTES = [];
const SEM_CARTEIRA = 'sem';
const ROTULO_DA_CARTEIRA = { vinicius: 'Vinícius', ewerton: 'Ewerton', [SEM_CARTEIRA]: 'Sem responsável' };
function carteiraDaLinhaDeCliente(nome) {
  return (typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '') || SEM_CARTEIRA;
}
// Colunas que a pessoa liga no menu "Colunas": na frente ficam as cinco do quadro (Cliente, Head, Saúde, Em aberto e
// Cadastro); plano, segmento, pedidos, status, Drive, documento e a seleção de vários entram por aqui. Fica só neste navegador.
const COLUNAS_OPCIONAIS_DE_CLIENTES = [['plano', 'Plano'], ['segmento', 'Segmento'], ['pedidos', 'Pedidos em aberto'],
  ['status', 'Status (ativo ou inativo)'], ['drive', 'Drive'], ['documento', 'Documento de acessos'], ['marcar', 'Selecionar vários (ações em lote)']];
const COLUNAS_PADRAO_DE_CLIENTES = { plano: false, segmento: false, pedidos: false, status: false, drive: false, documento: false, marcar: false };
function colunasDeClientes() {
  let salvas = {};
  try { salvas = JSON.parse(localStorage.getItem('vybe_clientes_colunas_v2') || '{}') || {}; } catch { salvas = {}; }
  const cols = { ...COLUNAS_PADRAO_DE_CLIENTES };
  Object.keys(cols).forEach((k) => { if (typeof salvas[k] === 'boolean') cols[k] = salvas[k]; });
  return cols;
}
function escolherColunasDeClientes(gatilho) {
  const cols = colunasDeClientes();
  const marca = (on) => `<span class="cli-col-marca${on ? ' on' : ''}" aria-hidden="true">${on
    ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span>`;
  abrirListaDoPainel(gatilho, {
    titulo: 'Colunas da tabela', atual: '',
    opcoes: COLUNAS_OPCIONAIS_DE_CLIENTES.map(([valor, rotulo]) => ({ valor,
      html: `<span class="cli-col-opcao">${marca(cols[valor])}${safeText(rotulo)}${cols[valor] ? '<span class="cli-oculto"> (ligada)</span>' : ''}</span>` })),
    aoEscolher: (valor) => {
      const atuais = colunasDeClientes();
      const novo = { ...atuais, [valor]: !atuais[valor] };
      try { localStorage.setItem('vybe_clientes_colunas_v2', JSON.stringify(novo)); } catch { /* sem armazenamento */ }
      if (valor === 'marcar' && !novo.marcar) CLIENTES_MARCADOS.clear();
      renderClientesBoard();
    },
  });
}
const SEM_HEAD = '—sem head—';
const primeiroNomeDe = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().split(/\s+/)[0] || '';
function headsDoClienteNaLista(nome) {
  const f = cadastroDoCliente(nome) || {};
  const l = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  return String(f.heads || l.head || '').split(',').map((n) => n.trim()).filter(Boolean);
}
function segmentoDoClienteNaLista(nome) {
  const f = cadastroDoCliente(nome) || {};
  const l = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  return String(f.segmento || l.segment || '').trim();
}
function passaNosFiltrosDeClientes(nome, { semBusca = false, semSituacao = false } = {}) {
  const { head, segmento, busca, situacao, carteira } = FILTRO_CLIENTES;
  if (busca && !semBusca && !String(nome).toLowerCase().includes(busca.toLowerCase())) return false;
  if (situacao && !semSituacao && situacaoDaLinhaDeCliente(nome) !== situacao) return false;
  if (carteira && carteiraDaLinhaDeCliente(nome) !== carteira) return false;
  if (head) {
    const heads = headsDoClienteNaLista(nome);
    if (head === SEM_HEAD ? heads.length : !heads.some((h) => primeiroNomeDe(h) === head)) return false;
  }
  if (segmento && segmentoDoClienteNaLista(nome).toLowerCase() !== segmento) return false;
  return true;
}
function opcoesDeFiltroDeClientes(qual) {
  const nomes = clientMasterRecords().map((r) => r.name);
  if (qual === 'carteira') {
    const conta = (c) => nomes.filter((n) => carteiraDaLinhaDeCliente(n) === c).length;
    return [{ valor: '', rotulo: 'Todas as carteiras' }, ...['vinicius', 'ewerton', SEM_CARTEIRA]
      .map((c) => ({ valor: c, rotulo: `${ROTULO_DA_CARTEIRA[c]} (${conta(c)})` }))];
  }
  const contas = new Map();
  let semHead = 0;
  nomes.forEach((nome) => {
    if (qual === 'head') {
      const heads = headsDoClienteNaLista(nome);
      if (!heads.length) semHead += 1;
      heads.forEach((h) => { const k = primeiroNomeDe(h); const v = contas.get(k);
        contas.set(k, { rotulo: v?.rotulo || String(h).split(/\s+/)[0], quantos: (v?.quantos || 0) + 1 }); });
    } else {
      const s = segmentoDoClienteNaLista(nome); if (!s) return;
      const k = s.toLowerCase(), v = contas.get(k);
      contas.set(k, { rotulo: v?.rotulo || s, quantos: (v?.quantos || 0) + 1 });
    }
  });
  const lista = [...contas.entries()].sort((a, b) => a[1].rotulo.localeCompare(b[1].rotulo, 'pt-BR'))
    .map(([valor, o]) => ({ valor, rotulo: `${o.rotulo} (${o.quantos})` }));
  if (qual === 'head' && semHead) lista.push({ valor: SEM_HEAD, rotulo: `Sem head (${semHead})` });
  return [{ valor: '', rotulo: qual === 'head' ? 'Todos os heads' : 'Todos os segmentos' }, ...lista];
}
function escolherFiltroDeClientes(qual, gatilho) {
  abrirListaDoPainel(gatilho, {
    titulo: qual === 'head' ? 'Filtrar por head' : qual === 'carteira' ? 'Filtrar por carteira' : 'Filtrar por segmento',
    opcoes: opcoesDeFiltroDeClientes(qual), atual: FILTRO_CLIENTES[qual],
    aoEscolher: (valor) => { FILTRO_CLIENTES[qual] = valor; renderClientesBoard(); },
  });
}
function limparFiltrosDeClientes() {
  Object.assign(FILTRO_CLIENTES, { head: '', segmento: '', busca: '', situacao: 'ativos', carteira: '' });
  FOCO_DE_CLIENTES = 'todos';
  const campo = document.getElementById('cliente-search'); if (campo) campo.value = '';
  renderClientesBoard();
}
function alternarSituacaoDeClientes(qual) {
  FILTRO_CLIENTES.situacao = FILTRO_CLIENTES.situacao === qual ? '' : qual;
  renderClientesBoard();
}
// "Filtros": o que não cabe na barra do quadro fica a um clique (segmento, os recortes que eram chips, quem está só
// na operação, quem foi marcado como não cliente e Limpar filtros).
function abrirFiltrosDeClientes(gatilho) {
  const nomes = clientMasterRecords().map((r) => r.name);
  const quantos = (sit) => nomes.filter((n) => situacaoDaLinhaDeCliente(n) === sit).length;
  const marca = (on) => (on ? ' · ligado' : '');
  const seg = FILTRO_CLIENTES.segmento ? opcoesDeFiltroDeClientes('segmento').find((o) => o.valor === FILTRO_CLIENTES.segmento) : null;
  const opcoes = [
    { valor: 'segmento', rotulo: seg ? `Segmento: ${String(seg.rotulo).replace(/ \(\d+\)$/, '')}` : 'Segmento…' },
    ...RECORTES_DE_CLIENTES.map((k) => ({ valor: `foco:${k.foco}`, rotulo: `${k.label} (${k.value})${marca(k.aceso)}` })),
    { valor: 'sit:sem', rotulo: `Só na operação, sem ficha (${quantos('sem')})${marca(FILTRO_CLIENTES.situacao === 'sem')}` },
    { valor: 'sit:ignorados', rotulo: `Não são clientes (${quantos('ignorados')})${marca(FILTRO_CLIENTES.situacao === 'ignorados')}` },
    { valor: 'limpar', rotulo: 'Limpar filtros' },
  ];
  abrirListaDoPainel(gatilho, { titulo: 'Filtros', opcoes, atual: '',
    aoEscolher: (valor) => {
      if (valor === 'segmento') return escolherFiltroDeClientes('segmento', document.querySelector('#clientes-filtros [data-v2f-filtros]') || gatilho);
      if (valor === 'limpar') return limparFiltrosDeClientes();
      if (valor.startsWith('foco:')) return focarClientes(valor.slice(5));
      return alternarSituacaoDeClientes(valor.slice(4));
    } });
}
function pintarFiltrosDeClientes(recortes = []) {
  const alvo = document.getElementById('clientes-filtros');
  if (!alvo) return;
  const NOME_DO_FILTRO = { head: 'Head', segmento: 'Segmento', carteira: 'Carteira' };
  const rotuloDe = (qual) => {
    const v = FILTRO_CLIENTES[qual];
    if (!v) return NOME_DO_FILTRO[qual];
    const o = opcoesDeFiltroDeClientes(qual).find((x) => x.valor === v);
    return `${NOME_DO_FILTRO[qual]}: ${safeText(String(o?.rotulo || v).replace(/ \(\d+\)$/, ''))}`;
  };
  const menu = (qual) => `<button type="button" class="cv2-chip" aria-haspopup="listbox" data-ligado="${Boolean(FILTRO_CLIENTES[qual])}"
      onclick="escolherFiltroDeClientes('${qual}', this)">${rotuloDe(qual)}</button>`;
  const nomes = clientMasterRecords().map((r) => r.name).filter((n) => passaNosFiltrosDeClientes(n, { semBusca: true, semSituacao: true }));
  const quantos = (sit) => nomes.filter((n) => situacaoDaLinhaDeCliente(n) === sit).length;
  const situacao = (sit, rotulo) => `<button type="button" class="cv2-chip" role="switch" aria-checked="${FILTRO_CLIENTES.situacao === sit}"
      title="Mostrar só os ${rotulo.toLowerCase()}" onclick="alternarSituacaoDeClientes('${sit}')">${rotulo} <span>${quantos(sit)}</span></button>`;
  // Os recortes moram em Mais > Filtros; com um deles ligado, a folha mostra qual é (e o clique abre os filtros).
  const outros = Boolean(FILTRO_CLIENTES.segmento) || FOCO_DE_CLIENTES !== 'todos' || FILTRO_CLIENTES.situacao === 'sem';
  const ligados = [FILTRO_CLIENTES.segmento ? rotuloDe('segmento') : '', ...recortes.filter((k) => k.aceso).map((k) => safeText(k.label)),
    FILTRO_CLIENTES.situacao === 'sem' ? 'Só na operação' : ''].filter(Boolean);
  // Quem foi marcado como "não é cliente" some de tudo; o chip é o caminho de volta e só aparece quando há alguém.
  const naoSao = quantos('ignorados') || FILTRO_CLIENTES.situacao === 'ignorados' ? situacao('ignorados', 'Não são clientes') : '';
  const filtros = outros ? `<button type="button" class="cv2-chip" data-v2f-filtros aria-haspopup="listbox" data-ligado="true" title="Segmento, sem contato, detratores, painel a atualizar e quem está só na operação"
      onclick="abrirFiltrosDeClientes(this)">${ligados.join(', ')}</button>` : '';
  const colunas = `<button type="button" class="cv2-chip" aria-haspopup="listbox" title="Escolher as colunas da lista"
      onclick="escolherColunasDeClientes(this)">Colunas</button>`;
  alvo.innerHTML = `<span class="cv2-chips">${situacao('ativos', 'Ativos')}${situacao('inativos', 'Inativos')}${naoSao}</span><i class="cv2-risco" aria-hidden="true"></i><span class="cv2-chips">${menu('carteira')}${menu('head')}${filtros}${
    visaoDeClientes() === 'tabela' ? colunas : ''}</span>`;
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
// O ROTULO E NOSSO, O DADO E DELES.
//
// O valor guardado vem com o erro de digitacao que veio do Monday —
// "Dasatualizado", com A — e em alguns clientes ele esta certo. Mostrar o texto
// cru repetia o erro em quinze linhas seguidas e ainda fazia a mesma coisa
// parecer duas coisas diferentes na mesma coluna.
//
// Consertar o dado no banco e outra conversa (e mexe no que o Monday devolve);
// consertar a LEITURA e aqui, e resolve o que a pessoa ve.
function paineldoClienteHtml(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '<span class="cli-vazio">—</span>';
  const emDia = painelEstaEmDia(texto);
  const rotulo = emDia ? 'Atualizado' : 'Desatualizado';
  return `<span class="cli-painel ${emDia ? 'novo' : 'velho'}"${
    rotulo === texto ? '' : ` title="No cadastro está escrito “${safeText(texto)}”"`
  }>${rotulo}</span>`;
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
// O navegador perguntava com caixinhas cinzas (confirm/prompt) no meio do
// painel escuro. As duas funções abaixo fazem a mesma pergunta na janela do
// painel: a primeira frase vira o título, o resto vira o texto, o botão leva o
// verbo da pergunta e fica vermelho quando a ação tira ou apaga algo.
// confirmarNoPainel devolve true/false; nomearNoPainel devolve o texto ou null,
// exatamente como confirm e prompt devolviam.
const VERBOS_DE_PERIGO = /^(Tirar|Apagar|Remover|Descartar|Sair sem salvar|Cancelar todos|Limpar|Mover o arquivo|Vender|Soltar)/i;
function partirPergunta(mensagem) {
  const linhas = String(mensagem || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return { titulo: linhas[0] || 'Confirmar?', texto: linhas.slice(1).join(' ') };
}
function confirmarNoPainel(mensagem, opcoes = {}) {
  const { titulo, texto } = partirPergunta(mensagem);
  const verbo = (titulo.match(/^(Comprar|Vender|Tirar|Apagar|Remover|Descartar|Guardar|Recuperar|Voltar|Mover|Vestir|Salvar|Reabrir|Aprovar|Limpar|Soltar|Fechar|Cancelar todos)/i) || [])[0];
  const confirmar = opcoes.confirmar || (verbo ? verbo.charAt(0).toUpperCase() + verbo.slice(1).toLowerCase() : 'Confirmar');
  const perigo = opcoes.perigo ?? VERBOS_DE_PERIGO.test(titulo);
  // O que apaga usa a janela única de apagar do padrão v2 (vbConfirmarApagar, vybe-core.js): Cancelar e o verbo em vermelho.
  if (perigo && typeof vbConfirmarApagar === 'function') return vbConfirmarApagar({ titulo, texto, rotulo: confirmar });
  return perguntarNoPainel({ titulo, texto, confirmar, perigo });
}
function nomearNoPainel(rotulo, valor = '') {
  const { titulo, texto } = partirPergunta(rotulo);
  return perguntarNoPainel({ titulo: titulo.replace(/:\s*$/, ''), texto, confirmar: 'Salvar', campo: { valor: valor ?? '', dica: '' } });
}
// A janela da pergunta é a peça V2-S-Pergunta (prancha de 19/11/2026): vidro fumê, título de 20 com a frase embaixo,
// o fechar de 34, o campo com rótulo em cima (curto ou longo) e o pé com a nota à esquerda e Cancelar e o verbo à
// direita. As três formas (confirmação, campo curto e texto longo) são a mesma janela; o que cada chamada devolve não
// mudou. `campo.rotulo` e `nota` são opcionais.
function perguntarNoPainel({ titulo, texto = '', confirmar = 'Confirmar', perigo = false, campo = null, imagem = null, larga = false, nota = '' }) {
  const focoAnterior = document.activeElement;
  return new Promise((resolve) => {
    document.getElementById('cli-pergunta')?.remove();
    const fundo = document.createElement('div');
    fundo.id = 'cli-pergunta';
    fundo.className = 'vbp-fundo';
    const longo = Boolean(campo?.linhas);
    const entradaHtml = !campo ? '' : longo
      // Corrigir uma atualizacao de tres linhas dentro de um campo de uma
      // linha e datilografar as cegas. Mesma caixa de pergunta, so que alta.
      ? `<textarea id="cli-pergunta-campo" rows="${Number(campo.linhas) || 5}"
          placeholder="${safeText(String(campo.dica || ''))}">${safeText(String(campo.valor || ''))}</textarea>`
      : `<input id="cli-pergunta-campo" type="text" value="${safeText(String(campo.valor || ''))}"
          placeholder="${safeText(String(campo.dica || ''))}">`;
    fundo.innerHTML = `<div class="vbj vbp d3-tema${larga ? ' larga' : ''}${longo ? ' longa' : ''}" role="dialog" aria-modal="true" aria-labelledby="cli-pergunta-titulo">
        ${vbjTopoHtml({ titulo, sub: texto, fechar: '', idTitulo: 'cli-pergunta-titulo' }).replace('class="vbj-x"', 'class="vbj-x" data-nao')}
        ${imagem ? `<figure class="vbp-previa"><img src="${safeText(imagem.url)}"
            alt="${safeText(imagem.nome || '')}"
            onerror="this.closest('figure')?.classList.add('sem-previa')">
          <figcaption>${safeText(imagem.nome || '')}</figcaption></figure>` : ''}
        ${campo ? (campo.rotulo ? `<label class="vbp-campo"><span>${safeText(campo.rotulo)}</span>${entradaHtml}</label>` : `<div class="vbp-campo">${entradaHtml}</div>`) : ''}
        ${nota ? `<p class="vbp-nota">${safeText(nota)}</p>` : ''}
        <div class="vbj-pe"><span class="vbj-esp"></span>
          <button type="button" class="vbj-btn" data-nao>Cancelar</button>
          <button type="button" class="vbj-btn k${perigo ? ' perigo' : ''}" data-sim>${safeText(confirmar)}</button>
        </div>
      </div>`;
    const entrada = () => document.getElementById('cli-pergunta-campo');
    const fechar = (resposta) => {
      document.removeEventListener('keydown', tecla, true);
      fundo.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus();
      resolve(resposta);
    };
    const dizerSim = () => fechar(campo ? String(entrada()?.value ?? '').trim() : true);
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(campo ? null : false); }
      // Num campo de varias linhas, Enter quebra linha — confirmar e no botao.
      if (e.key === 'Enter' && e.target?.tagName === 'INPUT') { e.preventDefault(); dizerSim(); }
      if (e.key === 'Tab') {
        const controles = [...fundo.querySelectorAll('button, input, textarea')].filter(el => !el.disabled);
        const primeiro = controles[0], ultimo = controles.at(-1);
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
      }
    };
    fundo.querySelectorAll('[data-nao]').forEach((b) => { b.onclick = () => fechar(campo ? null : false); });
    fundo.querySelector('[data-sim]').onclick = dizerSim;
    fundo.onclick = (e) => { if (e.target === fundo) fechar(campo ? null : false); };
    document.addEventListener('keydown', tecla, true);
    document.body.append(fundo);
    setTimeout(() => { const alvo = entrada() || fundo.querySelector(perigo ? '.vbj-pe [data-nao]' : '[data-sim]'); alvo?.focus(); entrada()?.select(); }, 30);
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
    <p class="workflow-copy">Ewerton L. como único head define a carteira azul; Vinícius define a laranja.
      Com vários heads ou outra pessoa, a carteira atual é mantida.</p>
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
    return `<button type="button" class="dono-pessoa ${escolhida ? 'selected' : ''}" aria-pressed="${escolhida}"
      onclick="escolherHeadDoCliente('${jsArg(String(p.id))}')"
      title="${safeText(p.nome)}">${ownerAvatarHtml(doTime)}<span>${safeText(p.nome)}</span><span class="owner-editor-person-check" aria-hidden="true">${escolhida ? '✓' : ''}</span></button>`;
  }).join('');
}
function escolherHeadDoCliente(pessoaId) {
  const chave = String(pessoaId);
  if (HEADS_ESCOLHIDOS.has(chave)) HEADS_ESCOLHIDOS.delete(chave); else HEADS_ESCOLHIDOS.add(chave);
  pintarHeadsDoCliente();
  document.querySelectorAll('#cli-heads-lista button').forEach(botao => {
    if (botao.getAttribute('onclick') === `escolherHeadDoCliente('${chave}')`) botao.focus();
  });
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
  // Quem foi marcado como "não é cliente": quem administra vê o botão de volta; o resto, só a etiqueta.
  if (estado === 'ignorados') {
    if (!podeEditarClientes()) return '<span class="cli-situacao ignorado">Não é cliente</span>';
    return `<button type="button" class="cli-voltar" title="Volta às listas, às metas e à saúde da carteira"
      onclick="event.stopPropagation();voltarASerCliente('${jsArg(nome)}')">Voltar a ser cliente</button>`;
  }
  const rotulo = estado === 'inativos' ? 'Inativo' : estado === 'sem' ? 'Sem cadastro' : 'Ativo';
  const classe = estado === 'inativos' ? 'inativo' : estado === 'sem' ? 'nenhum' : 'ativo';
  if (!podeEditarClientes()) return `<span class="cli-situacao ${classe}">${rotulo}</span>`;
  const aspas = jsArg(nome); // nome em argumento de onclick (auditoria 15/11/2026)
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
  // Prancha V2-S-Etiquetas-Cliente (19/11/2026): vidro fumê com a logo do cliente, "Segmento" e "uma etiqueta por
  // cliente"; cada etiqueta numa linha com o rádio (tocar aplica), renomear e apagar; criar nova, a regra do vocabulário
  // e, no pé, Deixar sem segmento, Fechar e Criar e aplicar. A pele é padrao-v2/s-c.css (#workflow-modal.seg-v2).
  const foto = typeof pv2Foto === 'function' ? pv2Foto(nome) : `<i class="d3v-foto" aria-hidden="true">${safeText(String(nome).trim().slice(0, 2).toUpperCase())}</i>`;
  openWorkflowModal(`<div class="seg-cab"><span class="seg-av" aria-hidden="true">${foto}</span>
      <div class="seg-cab-txt"><h2 class="workflow-title">Segmento</h2><p class="workflow-copy">${safeText(nome)} · uma etiqueta por cliente</p></div>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <div id="cli-seg-lista" class="seg-lista" role="radiogroup" aria-label="Segmento de ${safeText(nome)}"></div>
    <label class="seg-campo" for="cli-seg-nova"><span>Criar etiqueta nova</span>
      <input id="cli-seg-nova" type="text" placeholder="Ex.: Odontologia" autocomplete="off"
        onkeydown="if(event.key==='Enter'){event.preventDefault();criarSegmento();}"></label>
    <p class="seg-nota">Renomear e apagar valem para todos os clientes com esta etiqueta. Apagar pede confirmação.</p>
    <div class="workflow-actions seg-pe">
      <button type="button" class="workflow-secondary quieto seg-sem" onclick="aplicarSegmento('')">Deixar sem segmento</button>
      <span class="cli-espaco"></span>
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button>
      <button type="button" class="workflow-primary" onclick="criarSegmento()">Criar e aplicar</button>
    </div>`);
  document.getElementById('workflow-modal')?.classList.add('seg-v2', 'd3-tema');
  pintarSegmentos();
}
const SEG_LAPIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>';
const SEG_LIXO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
function pintarSegmentos() {
  const caixa = document.getElementById('cli-seg-lista');
  if (!caixa) return;
  const atual = String(SEGMENTO_DO_CLIENTE?.atual || '').toLowerCase();
  const lista = segmentosExistentes();
  caixa.innerHTML = !lista.length
    ? '<div class="auto-carregando">Nenhuma etiqueta ainda. Crie a primeira abaixo.</div>'
    : lista.map(({ rotulo, quantos }) => { const on = rotulo.toLowerCase() === atual;
      return `<div class="seg-linha${on ? ' ativa' : ''}">
        <button type="button" class="seg-escolher" role="radio" aria-checked="${on}"
          title="${on ? 'É o segmento de agora' : `Aplicar em ${safeText(SEGMENTO_DO_CLIENTE.nome)}`} · ${quantos} ${quantos === 1 ? 'cliente usa' : 'clientes usam'}"
          onclick="aplicarSegmento('${jsArg(rotulo)}')"><i class="seg-radio" aria-hidden="true"></i><span>${safeText(rotulo)}</span></button>
        <button type="button" class="seg-ic" title="Renomear em todos os clientes" aria-label="Renomear ${safeText(rotulo)}"
          onclick="renomearSegmento('${jsArg(rotulo)}')">${SEG_LAPIS}</button>
        <button type="button" class="seg-ic seg-apagar" title="Apagar de todos os clientes" aria-label="Apagar ${safeText(rotulo)}"
          onclick="apagarSegmento('${jsArg(rotulo)}')">${SEG_LIXO}</button>
      </div>`; }).join('');
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
  ultima_reuniao: { tipo:'data' },
  plano: { tipo:'texto' },
  nps: { tipo:'numero' },
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
  celula.innerHTML = `<input class="cli-celula" type="${
    regra.tipo === 'data' ? 'date' : regra.tipo === 'numero' ? 'number' : 'text'}"${
    regra.tipo === 'numero' ? ' step="0.01" min="0"' : ''} value="${safeText(valor)}">`;
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
    // Data e numero nao aceitam vazio na coluna; texto aceita, e e assim que se
    // apaga um valor errado.
    if (!novo && regra.tipo !== 'texto') { celula.innerHTML = antes; return; }
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
// Quanto tempo desde a ultima conversa.
//
// A data sozinha nao responde a pergunta que se faz olhando a lista — "faz
// quanto tempo?" — e obriga cada pessoa a fazer a conta de cabeca, todo dia,
// para trinta clientes. A conta e do painel.
const SEM_CONTATO_ATENCAO = 30;
const SEM_CONTATO_GRAVE = 60;
function diasSemContato(cliente) {
  const iso = String(cliente?.ultima_reuniao || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const hoje = (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  return Math.round((new Date(`${hoje}T12:00:00`) - new Date(`${iso}T12:00:00`)) / 86400000);
}
function selosDeContato(cliente) {
  const dias = diasSemContato(cliente);
  if (dias === null) return { classe: 'nunca', texto: 'sem registro' };
  if (dias >= SEM_CONTATO_GRAVE) return { classe: 'grave', texto: `há ${dias} dias` };
  if (dias >= SEM_CONTATO_ATENCAO) return { classe: 'atencao', texto: `há ${dias} dias` };
  return { classe: '', texto: dias <= 0 ? 'hoje' : `há ${dias} dia${dias === 1 ? '' : 's'}` };
}
// VALOR DE CONTRATO NAO MORA AQUI.
//
// Eu tinha sugerido e colocado uma coluna de valor e uma soma da carteira. Sao
// numeros de financeiro, e financeiro tem o VybeFinancas. Esta tela e de CUIDAR
// do cliente: como ele esta, ha quanto tempo nao se conversa, quanto ele
// demanda, o que ficou combinado. Misturar receita aqui muda a pergunta que a
// tela responde — e uma tela que responde duas perguntas nao responde nenhuma
// direito.
//
// No lugar entrou o NPS, que e do assunto: a nota que o cliente deu e quando.

// A leitura padrao de NPS, que e vocabulario e nao enfeite: 0-6 detrator,
// 7-8 neutro, 9-10 promotor.
// Number(null) e Number('') dao ZERO, e zero e uma nota valida de NPS — a pior
// delas. Sem esta guarda, todo cliente sem avaliacao aparecia como detrator nota
// 0, e a media e a conta de detratores vinham erradas junto.
function temNota(v) {
  return v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v));
}
function leituraDoNps(nota) {
  if (!temNota(nota)) return null;
  const n = Number(nota);
  if (n >= 9) return { classe:'promotor', texto:'promotor' };
  if (n >= 7) return { classe:'neutro', texto:'neutro' };
  return { classe:'detrator', texto:'detrator' };
}

// ── marcar varios clientes ────────────────────────────────────────────────────
// Duas listas do modulo so se resolvem em lote: os trinta nomes que a operacao
// criou sozinha e os catorze paineis desatualizados. Uma a uma, elas nunca
// zeram — e lista que nunca zera para de ser lida.
let CLIENTES_MARCADOS = new Set();
function alternarClienteMarcado(nome, marcado) {
  if (marcado) CLIENTES_MARCADOS.add(nome); else CLIENTES_MARCADOS.delete(nome);
  pintarDeckDeClientes();
}
function limparMarcadosDeClientes() { CLIENTES_MARCADOS.clear(); renderClientesBoard(); }
function marcarBlocoDeClientes(classe, marcar) {
  document.querySelectorAll('#grid-clientes-lista .v2f-linha[data-cliente]').forEach((tr) => {
    const nome = tr.dataset.cliente;
    if (marcar) CLIENTES_MARCADOS.add(nome); else CLIENTES_MARCADOS.delete(nome);
    const caixa = tr.querySelector('input[type=checkbox]');
    if (caixa) caixa.checked = marcar;
    tr.classList.toggle('marcada', marcar);
  });
  pintarDeckDeClientes();
}
function pintarDeckDeClientes() {
  document.getElementById('cli-deck')?.remove();
  if (!CLIENTES_MARCADOS.size || !podeEditarClientes()) return;
  const nomes = [...CLIENTES_MARCADOS];
  const semFicha = nomes.filter((n) => { const f = cadastroDoCliente(n);
    return !f || !String(f.status || '').trim(); }).length;
  const naoSao = nomes.filter((n) => situacaoDaLinhaDeCliente(n) === 'ignorados').length;
  const deck = document.createElement('div');
  deck.id = 'cli-deck';
  deck.className = 'grupos-lote';
  deck.innerHTML = `<span class="lote-conta"><b>${nomes.length}</b><small>${
      nomes.length === 1 ? 'marcado' : 'marcados'}</small></span>
    <span class="lote-risco" aria-hidden="true"></span>
    ${semFicha ? `<button type="button" class="lote-acao" onclick="loteCadastrarClientes()">Cadastrar ${semFicha}</button>` : ''}
    <button type="button" class="lote-acao" onclick="lotePainelDoCliente('Atualizado')">Painel atualizado</button>
    <button type="button" class="lote-acao" onclick="lotePainelDoCliente('Desatualizado')">Painel desatualizado</button>
    ${naoSao < nomes.length ? '<button type="button" class="lote-acao" onclick="loteNaoEhCliente()">Não é cliente</button>' : ''}
    ${naoSao ? `<button type="button" class="lote-acao" onclick="loteVoltarASerCliente()">Voltar a ser cliente${naoSao < nomes.length ? ` (${naoSao})` : ''}</button>` : ''}
    <span class="lote-risco" aria-hidden="true"></span>
    <button type="button" class="lote-limpar" onclick="limparMarcadosDeClientes()"
      title="Desmarcar todos" aria-label="Desmarcar todos">✕</button>`;
  document.body.appendChild(deck);
}

// Cada cliente e uma gravacao, como no resto do painel: se uma falhar, as outras
// seguem, e a conta no fim diz quantas passaram.
async function emLoteDeClientes(rotulo, fazer, { texto = 'A alteração vale para todos os marcados.', confirmar = 'Aplicar' } = {}) {
  const nomes = [...CLIENTES_MARCADOS];
  if (!nomes.length) return;
  const ok = await perguntarNoPainel({ titulo: `${rotulo} em ${nomes.length} cliente${nomes.length === 1 ? '' : 's'}?`,
    texto, confirmar });
  if (!ok) return;
  let feitas = 0; const falhas = [];
  for (const nome of nomes) {
    try { await fazer(nome); feitas += 1; }
    catch (e) { falhas.push(nome); console.warn('lote de clientes falhou em', nome, e); }
  }
  CLIENTES_MARCADOS.clear();
  showToast(falhas.length ? `${feitas} feito(s) · ${falhas.length} falhou(ram)` : `✓ ${feitas} cliente(s) atualizados`,
    falhas.length ? 'info' : 'ok', 6000);
  await ensureClientMasterSources(true);
}
function loteCadastrarClientes() {
  return emLoteDeClientes('Criar ficha', async (nome) => {
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ acao:'criar', nome }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'falhou');
  });
}
function lotePainelDoCliente(valor) {
  return emLoteDeClientes(`Marcar painel como ${valor}`, async (nome) => {
    const id = idDoCliente(nome);
    if (!id) throw new Error('sem cadastro');
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'ficha', id, campos:{ dashboard: valor } }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'falhou');
  });
}
// "Não é cliente" tira o nome de todas as listas, das metas e da saúde da carteira (o servidor só conta quem é
// ativo de verdade). Já sumiu cliente de verdade assim, sem caminho de volta (a Vybe, 20/11/2026): a pergunta diz o
// que acontece e onde desfazer, e a volta mora no chip "Não são clientes" da barra (e em Mais > Filtros).
const TEXTO_NAO_EH_CLIENTE = 'Some de todas as listas, metas e da saúde da carteira; dá para desfazer em Não são clientes.';
function loteNaoEhCliente() {
  [...CLIENTES_MARCADOS].filter((n) => situacaoDaLinhaDeCliente(n) === 'ignorados').forEach((n) => CLIENTES_MARCADOS.delete(n));
  return emLoteDeClientes('Marcar como "não é cliente"', async (nome) => {
    const id = idDoCliente(nome);
    if (!id) throw new Error('sem cadastro');
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ acao:'ignorar', id }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'falhou');
  }, { texto: TEXTO_NAO_EH_CLIENTE, confirmar: 'Marcar' });
}

// ── Voltar a ser cliente ──────────────────────────────────────────────────────
// A volta do "não é cliente" (ação 'reconhecer' do servidor, que já existia sem tela). Quem também está Inativo
// volta para "Inativos"; a janela seguinte oferece reativar junto, com o motivo (vai para a história do cliente).
function clienteTambemInativo(nome) {
  const f = cadastroDoCliente(nome);
  if (!f) return false;
  const texto = String(f.status || '').trim();
  return texto ? /inativ/i.test(texto) : f.ativo === false;
}
async function postarNoCadastroDeClientes(corpo) {
  const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'falhou');
  return r.json().catch(() => ({}));
}
// Pergunta uma vez (e, se algum estiver Inativo, mais uma: reativar junto?), grava cada um e devolve a conta.
// Uma falha não para as outras. Cancelar a primeira pergunta devolve null.
async function voltarASerClientes(nomes) {
  const lista = nomes.filter((n) => situacaoDaLinhaDeCliente(n) === 'ignorados' && idDoCliente(n));
  if (!lista.length) return { feitas: 0, reativados: 0, falhas: [] };
  const ok = await perguntarNoPainel({
    titulo: lista.length === 1 ? `"${lista[0]}" volta a ser cliente?` : `${lista.length} nomes voltam a ser clientes?`,
    texto: 'Volta às listas, às metas e à saúde da carteira, na situação em que estava (ativo ou inativo).',
    confirmar: 'Voltar a ser cliente' });
  if (!ok) return null;
  const inativos = lista.filter(clienteTambemInativo);
  let motivo = null;
  if (inativos.length) {
    motivo = await perguntarNoPainel({
      titulo: inativos.length === 1 ? `"${inativos[0]}" também está Inativo. Reativar junto?` : `${inativos.length} deles também estão Inativos. Reativar junto?`,
      texto: 'Reativar põe de volta nos ativos. Cancelar deixa como Inativo.',
      confirmar: 'Reativar', campo: { rotulo: 'Motivo', valor: 'Voltou a ser cliente', dica: 'Por que volta a ser ativo' } });
    if (motivo !== null && !String(motivo).trim()) motivo = 'Voltou a ser cliente';
  }
  let feitas = 0, reativados = 0; const falhas = [];
  for (const nome of lista) {
    const id = idDoCliente(nome);
    try {
      await postarNoCadastroDeClientes({ acao: 'reconhecer', id });
      feitas += 1;
      if (motivo !== null && inativos.includes(nome)) {
        await postarNoCadastroDeClientes({ acao: 'reativar', id, motivo });
        reativados += 1;
      }
    } catch (e) { falhas.push(nome); console.warn('voltar a ser cliente falhou em', nome, e); }
  }
  return { feitas, reativados, falhas };
}
async function avisarVoltaDeClientes(conta) {
  if (!conta) return;
  const { feitas, reativados, falhas } = conta;
  const extra = reativados ? ` · ${reativados} reativado${reativados === 1 ? '' : 's'}` : '';
  showToast(falhas.length ? `${feitas} voltou(aram)${extra} · ${falhas.length} falhou(ram)` : `✓ ${feitas} de volta como cliente${feitas === 1 ? '' : 's'}${extra}`,
    falhas.length ? 'info' : 'ok', 6000);
  await ensureClientMasterSources(true);
}
async function voltarASerCliente(nome) {
  if (!podeEditarClientes()) return showToast('Só quem administra muda isso.', 'warning', 3500);
  return avisarVoltaDeClientes(await voltarASerClientes([nome]));
}
async function loteVoltarASerCliente() {
  const conta = await voltarASerClientes([...CLIENTES_MARCADOS]);
  if (!conta) return;
  CLIENTES_MARCADOS.clear();
  return avisarVoltaDeClientes(conta);
}

// Redesign, quadro 50 (10/11/2026): saem as colunas que quase sempre ficavam vazias (Dashboard, Última reunião,
// NPS e Manus; cada uma continua na ficha do cliente: Dados e acessos, Reuniões e Cadastro) e entram a saúde (a
// nota da Saúde da carteira), o que está em aberto e o quanto o cadastro está completo. O head aparece com o
// retrato do personagem (a cabeça voxel no mundo) e o nome. Os recortes do topo (sem contato, detratores, painel)
// continuam pelos mesmos dados.
const CONCLUIDO_NA_LISTA = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas'];
function abertosDoCliente(nome) {
  const record = clientMasterRecords().find((item) => item.name === nome) || { content: [], requests: [] };
  return {
    conteudos: record.content.filter((d) => !CONCLUIDO_NA_LISTA.includes(d.status)).length,
    pedidos: record.requests.filter((d) => !CONCLUIDO_NA_LISTA.includes(d.status)).length,
  };
}
function abertosHtml({ conteudos, pedidos }) {
  const parte = (n, um, varios, classe = '') => `<span class="${n ? classe : 'zero'}"><b>${n}</b> ${n === 1 ? um : varios}</span>`;
  return `<span class="cli-abertos">${parte(conteudos, 'peça', 'peças')}<i aria-hidden="true">·</i>${
    parte(pedidos, 'pedido', 'pedidos', 'atencao')}</span>`;
}
// A nota da Saúde da carteira (vybe-carteira-saude.js pelo VybeCarteira.dados): a mesma conta da aba Saúde.
function saudesDaCarteira() {
  const lista = (() => { try { return window.VybeCarteira?.dados?.() || []; } catch { return []; } })();
  const porId = new Map(), porNome = new Map();
  lista.forEach((c) => {
    if (c.clienteId != null) porId.set(String(c.clienteId), c);
    if (c.cliente) porNome.set(normalizeClientKey(c.cliente), c);
  });
  return (nome) => porId.get(String(idDoCliente(nome) || '')) || porNome.get(normalizeClientKey(nome)) || null;
}
function saudeHtml(s) {
  if (!s || !Number.isFinite(Number(s.score))) return '<span class="cli-vazio" title="Sem nota: cliente inativo ou sem peças para medir">—</span>';
  const tom = s.risco === 'alto' ? 'ruim' : s.risco === 'medio' ? 'atencao' : 'ok';
  const rotulo = { alto: 'risco alto', medio: 'risco médio', baixo: 'em dia' }[s.risco] || '';
  const motivos = (s.motivos || []).slice(0, 3).join(' · ');
  return `<span class="cli-saude ${tom}" title="Nota ${s.score} de 100, ${rotulo}${motivos ? `: ${safeText(motivos)}` : ''}"><i aria-hidden="true"></i><b>${Number(s.score)}</b><small>${rotulo}</small></span>`;
}
function cadastroCompletoHtml(f) {
  const c = typeof completudeDoCadastro === 'function' ? completudeDoCadastro(f) : null;
  if (!c) return '<span class="cli-vazio">—</span>';
  const pct = Math.round((c.feitos / Math.max(1, c.total)) * 100);
  return `<span class="cli-completo${c.feitos === c.total ? ' cheio' : ''}" title="${c.feitos === c.total ? 'Cadastro completo' : `Faltam ${c.total - c.feitos}: ${safeText(c.faltam.join(', '))}`}">
    <span class="cli-completo-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${c.total}" aria-valuenow="${c.feitos}" aria-label="Cadastro"><i style="width:${pct}%"></i></span>
    <small>${c.feitos} de ${c.total}</small></span>`;
}
// Quadro 05 (10/11/2026): o head leva a cor da carteira do cliente (Vinícius laranja, Ewerton azul), na moldura do retrato
// e no nome, como a etiqueta do cliente; a carteira vem de carteiraDoCliente (vybe_clientes.responsavel), nunca do head.
function headComRetratoHtml(texto, carteira = '') {
  const nomes = String(texto || '').split(',').map((n) => n.trim()).filter(Boolean);
  if (!nomes.length) return '<span class="cli-head vazio">Sem head</span>';
  const dono = carteira === 'vinicius' ? 'Vinícius' : carteira === 'ewerton' ? 'Ewerton' : '';
  // Sem personagem escolhido, o boneco padrão do jogo (vira a cabeça voxel no mundo), nunca o círculo cinza.
  const padrao = typeof mapaCabecaUrl === 'function' ? mapaCabecaUrl({}) : null;
  const pessoas = nomes.map(pessoaPeloNome).map((p) => (p.photo || !padrao ? p : { ...p, photo: padrao }));
  return `<span class="cli-head"${carteira ? ` data-carteira="${carteira}"` : ''} title="${safeText(nomes.join(', '))}${dono ? ` · carteira de ${dono}` : ''}"><span class="owner-avatar-stack cli-retratos">${
    pessoas.slice(0, 3).map(ownerAvatarHtml).join('')}</span><span class="cli-head-nome">${
    safeText(pessoas.map((p) => (typeof firstName === 'function' ? firstName(p.name) : String(p.name).split(/\s+/)[0])).join(', '))}</span></span>`;
}

// Quadro "Clientes" do moodboard (12/11/2026): a linha mostra o essencial (cliente com segmento e plano, head, saúde
// com a barra, o que está em aberto com os vencidos em vermelho e quanto falta do cadastro) e abre no lugar com o
// porquê da nota, o que está em aberto, os itens do cadastro e os dois botões: Completar cadastro e Abrir a ficha.
// Head, plano e segmento se editam na ficha (cabeçalho) e nas colunas ligadas em "Colunas".
const CLIENTES_ABERTOS_NA_LISTA = new Set();
let ORDEM_DE_CLIENTES = { coluna: 'saude', sentido: 1 };
let LISTA_INTEIRA_DE_CLIENTES = false;
const CLIENTES_NA_FRENTE = 5;
function alternarLinhaDeCliente(botao) {
  const linha = botao?.closest('.v2f-linha');
  if (!linha) return;
  const aberto = alternarLinhaV2(botao);
  if (aberto) CLIENTES_ABERTOS_NA_LISTA.add(linha.dataset.cliente); else CLIENTES_ABERTOS_NA_LISTA.delete(linha.dataset.cliente);
}
function ordenarClientesPor(coluna) {
  ORDEM_DE_CLIENTES = ORDEM_DE_CLIENTES.coluna === coluna ? { coluna, sentido: -ORDEM_DE_CLIENTES.sentido } : { coluna, sentido: 1 };
  renderClientesBoard();
}
function mostrarListaInteiraDeClientes(inteira = true) {
  LISTA_INTEIRA_DE_CLIENTES = inteira;
  renderClientesLista(clientMasterRecords().map((record) => record.name));
}
function linhaDeClienteHtml(nome, semCadastro, estado, mostrar = {}, saudeDe = saudesDaCarteira(), grupo = '') {
  const f = cadastroDoCliente(nome) || {};
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const aspas = jsArg(nome); // nome em argumento de onclick (auditoria 15/11/2026)
  const idNoCadastro = semCadastro ? '' : idDoCliente(nome);
  const podeMexer = !semCadastro && podeEditarClientes();
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const vazio = '<span class="cli-vazio">—</span>';

  const segmento = String(f.segmento || ligado.segment || '').trim();
  const plano = String(f.plano || ligado.plan || '').trim();
  const heads = String(f.heads || ligado.head || '').split(',').map((n) => n.trim()).filter(Boolean);
  const s = semCadastro ? null : saudeDe(nome);
  const tom = tomDaNotaCv2(s);
  const { conteudos, pedidos } = abertosDoCliente(nome);
  const vencidos = vencidosDoCliente(nome).length;
  const c = semCadastro || typeof completudeDoCadastro !== 'function' ? null : completudeDoCadastro(f);
  const marcado = CLIENTES_MARCADOS.has(nome);
  const aberto = CLIENTES_ABERTOS_NA_LISTA.has(nome);
  const reuniao = proximaReuniaoCv2(nome);

  // Colunas ligadas em "Colunas": as mesmas edições de antes, na célula.
  const editavel = (campo, dentro, titulo = 'Clique para editar') => (podeMexer
    ? `<span class="cv2-extra cli-editavel" title="${titulo}" onclick="editarCelulaDoCliente(event, '${aspas}', '${campo}')">${dentro}</span>`
    : `<span class="cv2-extra">${dentro}</span>`);
  const urlDrive = linkDeCliente(ligado.drive);
  const extras = [
    mostrar.plano ? editavel('plano', safeText(plano) || vazio) : '',
    mostrar.segmento ? (podeMexer ? `<span class="cv2-extra cli-editavel" title="Clique para escolher a etiqueta" onclick="abrirSegmentoDoCliente(event, '${aspas}')">${safeText(segmento) || vazio}</span>` : `<span class="cv2-extra">${safeText(segmento) || vazio}</span>`) : '',
    mostrar.pedidos ? `<span class="cv2-extra">${pedidos ? plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido'}</span>` : '',
    mostrar.status ? `<span class="cv2-extra" onclick="event.stopPropagation()">${situacaoDoClienteHtml(nome, estado)}</span>` : '',
    mostrar.drive ? `<span class="cv2-extra" onclick="event.stopPropagation()">${urlDrive ? `<a class="cv2-link" href="${safeText(urlDrive)}" target="_blank" rel="noopener" title="${safeText(urlDrive)}">Abrir</a>`
      : podeMexer ? `<button type="button" class="cv2-link" onclick="editarAcessoDoCliente(event, '${aspas}', 'pasta_drive')">Colar o link</button>` : vazio}</span>` : '',
    mostrar.documento ? `<span class="cv2-extra" onclick="event.stopPropagation()">${ligado.acessoId || podeMexer
      ? `<button type="button" class="cv2-link" onclick="abrirDocumentoDoCliente('${jsArg(String(ligado.acessoId || ''))}', '${aspas}', '${jsArg(idNoCadastro)}')">${ligado.acessoId && ligado.doc ? 'Abrir' : 'Escrever'}</button>` : vazio}</span>` : '',
  ].join('');

  const caixa = mostrar.marcar && podeEditarClientes()
    ? `<input type="checkbox" class="v2f-marcar" ${marcado ? 'checked' : ''} aria-label="Marcar ${safeText(nome)}"
        onclick="event.stopPropagation();this.closest('.v2f-linha').classList.toggle('marcada',this.checked);alternarClienteMarcado('${aspas}',this.checked)">` : '';
  // Quem não é cliente não tem nota de saúde: a coluna Saúde vira a da situação. Na lista "Não são clientes" ela leva o
  // botão de volta (a coluna alarga para caber); misturado com os outros, só a etiqueta, na largura de sempre.
  const naoEhCliente = estado === 'ignorados';
  const soNaoClientes = FILTRO_CLIENTES.situacao === 'ignorados';
  const situacaoHtml = estado !== 'ativos' && !naoEhCliente && !mostrar.status ? `<span onclick="event.stopPropagation()">${situacaoDoClienteHtml(nome, estado)}</span>` : '';
  const voltaHtml = `<span class="cv2-sa cv2-volta" onclick="event.stopPropagation()">${soNaoClientes ? situacaoDoClienteHtml(nome, estado)
    : '<span class="cli-situacao ignorado" title="Para desfazer, abra Não são clientes">Não é cliente</span>'}</span>`;
  // O cadastro: o anel do quanto já está preenchido e "5/12"; completo fica verde; só na operação, "sem ficha".
  const C = 2 * Math.PI * 6;
  const anel = (feitos, total) => `<svg class="cv2-anel${feitos >= total ? ' cheio' : ''}" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><circle class="v" cx="8" cy="8" r="6" stroke-dasharray="${(feitos / Math.max(1, total) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 8 8)"/></svg>`;
  const cadastro = semCadastro ? '<span class="cv2-cd sem">sem ficha</span>'
    : !c ? `<span class="cv2-cd">${vazio}</span>`
    : `<span class="cv2-cd${c.feitos === c.total ? ' cheio' : ''}" title="${c.feitos === c.total ? 'Cadastro completo' : `Faltam: ${safeText(c.faltam.join(', '))}`}">${anel(c.feitos, c.total)}${c.feitos}/${c.total}</span>`;
  // "peça" é o nome da unidade em todo o sistema (acabamento 15/11), não "conteúdo".
  const emAberto = `${plural(conteudos, 'peça', 'peças')}${vencidos ? ` <b class="cv2-ruim">· ${plural(vencidos, 'vencida', 'vencidas')}</b>` : ''}`;
  const reuniaoHtml = podeMexer
    ? `<span class="cv2-re cli-editavel${reuniao.iso ? '' : ' sem'}" title="Próxima reunião: clique para mudar a data" onclick="editarCelulaDoCliente(event, '${aspas}', 'proxima_reuniao')">${reuniao.texto}</span>`
    : `<span class="cv2-re${reuniao.iso ? '' : ' sem'}" title="Próxima reunião">${reuniao.texto}</span>`;

  // O detalhe que abre no lugar.
  const feitos = c && typeof CADASTRO_DEF !== 'undefined' && CADASTRO_DEF
    ? CADASTRO_DEF.campos.filter((campo) => campo.obrigatorio && !c.faltam.includes(campo.rotulo)).map((campo) => campo.rotulo) : [];
  const itens = c ? [
      ...feitos.slice(0, 4).map((r) => `<span class="v2f-ck"><i class="v2f-cx ok">${V2F_CERTO}</i><span class="v2f-feito">${safeText(r)}</span></span>`),
      ...c.faltam.slice(0, 1).map((r) => `<span class="v2f-ck"><i class="v2f-cx"></i>${safeText(r)}</span>`),
      c.total - Math.min(4, feitos.length) - Math.min(1, c.faltam.length) > 0 ? `<span class="v2f-ck">+ ${c.total - Math.min(4, feitos.length) - Math.min(1, c.faltam.length)}</span>` : '',
    ].join('') : '';
  const botoes = semCadastro
    ? (podeEditarClientes() ? `<button type="button" class="d3v-btn sec s" onclick="cadastrarClienteDaOperacao('${aspas}')">Cadastrar</button>` : '')
    : (podeMexer ? `<button type="button" class="d3v-btn sec s" onclick="abrirFichaDeCliente('${aspas}')">Completar cadastro</button>` : '');
  const detalhe = `<div class="cv2-det"><div class="cv2-det-texto">
        <p><b>Saúde${tom ? ` ${Number(s.score)}` : ''}</b> · ${tom ? safeText((s.motivos || []).slice(0, 2).join(' · ') || 'sem nada puxando para baixo') : 'sem nota: cliente inativo ou sem peças para medir'}</p>
        <p><b>Em aberto</b> · ${plural(conteudos, 'peça', 'peças')}${vencidos ? `, ${vencidos} com a veiculação vencida` : ''} · ${pedidos ? plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido'}${plano ? ` · plano ${safeText(plano)}` : ''}</p>
        <p class="v2f-cad"><b>Cadastro${c ? ` ${c.feitos} de ${c.total}` : ''}</b>${c ? itens : ' · sem ficha no cadastro'}</p>
      </div>${botoes}<button type="button" class="d3v-btn s cv2-abrir-ficha" onclick="abrirClienteDetalhe('${aspas}')">Abrir a ficha</button></div>`;

  return `<div class="v2-abre v2f-linha cv2-linha${marcado ? ' marcada' : ''}${naoEhCliente ? ' cv2-nao-cliente' : ''}" data-cliente="${safeText(nome)}" aria-expanded="${aberto}">
    <div class="cv2-tr" onclick="alternarLinhaDeCliente(this.querySelector('.v2f-vai'))">
      <span class="cv2-grupo${grupo === 'Agora' ? ' r' : ''}">${grupo}</span>${caixa}${fotoDoClienteCv2(nome)}
      <p class="cv2-nome cli-nome"><b>${safeText(nome)}</b>${segmento ? ` <span>· ${safeText(segmento)}</span>` : ''}${situacaoHtml}</p>
      <span class="cv2-hd" title="${safeText(heads.join(', '))}">${heads.length ? `<i class="cv2-pes" aria-hidden="true">${safeText(iniciaisV2(heads[0]))}</i><span>${safeText(heads.map(primeiroNomeV2).join(', '))}</span>` : '<span class="cv2-apagado">sem head</span>'}</span>
      ${naoEhCliente ? voltaHtml : tom ? `<span class="cv2-sa ${tom}" title="Nota ${Number(s.score)} de 100"><b>${Number(s.score)}</b><span class="cv2-barra"><i style="--v:${Math.max(0, Math.min(100, Number(s.score)))}%"></i></span></span>` : `<span class="cv2-sa">${vazio}</span>`}
      <span class="cv2-ab">${emAberto}</span>
      ${reuniaoHtml}
      ${cadastro}
      ${extras}
      <button type="button" class="v2f-vai cv2-vai" aria-expanded="${aberto}" aria-label="Abrir a linha de ${safeText(nome)}" onclick="event.stopPropagation();alternarLinhaDeCliente(this)">${CV2_IC.vai}</button>
    </div>
    <div class="v2-mais"><div>${detalhe}</div></div>
  </div>`;
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

// Em que bloco da tabela o cliente cai: ativos, inativos, so na operacao (sem ficha) ou "nao sao clientes". Uma regra
// so para os blocos e para os chips Ativos/Inativos da barra (quadro 05).
function situacaoDaLinhaDeCliente(nome) {
  const f = cadastroDoCliente(nome);
  if (!f) return 'sem';
  if (f.nao_e_cliente) return 'ignorados';
  const texto = String(f.status || '').trim();
  if (texto) return /inativ/i.test(texto) ? 'inativos' : 'ativos';
  // Sem status: linha criada pela importacao. So conta como inativo se alguem
  // tirou do painel de proposito; fora isso, nunca foi cadastrada.
  return f.ativo === false ? 'inativos' : 'sem';
}

// A ordem da lista: quem precisa de você primeiro (a pior nota de saúde no alto); o título da coluna muda a ordem.
function ordenarNomesDeClientes(lista, saudeDe = saudesDaCarteira(), ordem = ORDEM_DE_CLIENTES) {
  const chave = {
    cliente: (n) => String(n).toLowerCase(),
    head: (n) => headsDoClienteNaLista(n).join(', ').toLowerCase() || '￿',
    saude: (n) => { const s = saudeDe(n); return s && Number.isFinite(Number(s.score)) ? Number(s.score) : 999; },
    abertos: (n) => -(vencidosDoCliente(n).length * 1000 + abertosDoCliente(n).conteudos),
    reuniao: (n) => proximaReuniaoCv2(n).iso || '9999',
    cadastro: (n) => { const c = typeof completudeDoCadastro === 'function' ? completudeDoCadastro(cadastroDoCliente(n)) : null; return c ? c.feitos / Math.max(1, c.total) : 2; },
  }[ordem.coluna] || ((n) => String(n).toLowerCase());
  const valores = new Map(lista.map((n) => [n, chave(n)]));
  return [...lista].sort((a, b) => { const x = valores.get(a), y = valores.get(b);
    return ((typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) || String(a).localeCompare(String(b), 'pt-BR')) * ordem.sentido; });
}
function clientesQueValem(clientes, saudeDe = saudesDaCarteira()) {
  const nomeVale = (nome) => /[a-z0-9]/i.test(String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return clientes.filter(nomeVale).filter((nome) => clientePassaNoFoco(nome, FOCO_DE_CLIENTES, saudeDe));
}
const VAZIO_DE_CLIENTES = '<p class="d3v-estado cv2-vazio"><b>Nenhum cliente com esses filtros.</b><button type="button" class="d3v-btn sec s cli-limpar" onclick="limparFiltrosDeClientes()">Limpar filtros</button></p>';

function tabelaDeClientesHtml(clientes) {
  const saudeDe = saudesDaCarteira(); // uma conta da carteira para a tabela inteira
  const lista = clientesQueValem(clientes, saudeDe);
  if (!lista.length) return VAZIO_DE_CLIENTES;
  // A lista inteira fica na folha, que rola por dentro: a prancha não corta em "+10 clientes".
  const ordenada = ordenarNomesDeClientes(lista, saudeDe);

  const cols = colunasDeClientes();
  const ROTULO_EXTRA = { plano: 'Plano', segmento: 'Segmento', pedidos: 'Pedidos', status: 'Status', drive: 'Drive', documento: 'Documento' };
  const extras = Object.keys(ROTULO_EXTRA).filter((k) => cols[k]);
  const titulo = (coluna, rotulo, dica = '') => { const ativa = ORDEM_DE_CLIENTES.coluna === coluna;
    return `<button type="button" class="cv2-th-b cv2-h-${coluna}" ${dica ? `title="${dica}" ` : ''}aria-sort="${ativa ? (ORDEM_DE_CLIENTES.sentido > 0 ? 'ascending' : 'descending') : 'none'}" onclick="ordenarClientesPor('${coluna}')">${rotulo}${ativa && coluna !== 'saude' ? `<i aria-hidden="true">${ORDEM_DE_CLIENTES.sentido > 0 ? '↑' : '↓'}</i>` : ativa && ORDEM_DE_CLIENTES.sentido < 0 ? '<i aria-hidden="true">↓</i>' : ''}</button>`; };
  const marcarTodos = cols.marcar && podeEditarClientes()
    ? `<input type="checkbox" class="v2f-marcar" aria-label="Marcar todos da lista" onclick="marcarBlocoDeClientes('', this.checked)">` : '';
  // "Agora" e "Depois": na ordem padrão (pior nota primeiro), o primeiro de cada grupo leva o rótulo na margem.
  const ordemPadrao = ORDEM_DE_CLIENTES.coluna === 'saude' && ORDEM_DE_CLIENTES.sentido > 0;
  let ultimo = '';
  const grupoDe = (n) => { if (!ordemPadrao) return '';
    const s = saudeDe(n), g = !s || !Number.isFinite(Number(s.score)) ? '' : clientePrecisaDeVoce(s) ? 'Agora' : 'Depois';
    if (!g || g === ultimo) return ''; ultimo = g; return g; };
  const soNaoClientes = FILTRO_CLIENTES.situacao === 'ignorados';
  return `<section class="cv2-tabela${cols.marcar && podeEditarClientes() ? ' com-marcar' : ''}${soNaoClientes ? ' so-nao-clientes' : ''}" aria-label="Clientes" style="--cv2-extras:${extras.length}">
      <div class="cv2-th"><span class="cv2-grupo"></span>${marcarTodos}<span class="cv2-th-foto"></span>${titulo('cliente', 'Cliente')}${titulo('head', 'Head')}${soNaoClientes ? '<span class="cv2-th-b cv2-h-saude">Situação</span>' : titulo('saude', 'Saúde', 'Nota de 0 a 100 da Saúde da carteira')}${titulo('abertos', 'Em aberto')}${titulo('reuniao', 'Reunião', 'Próxima reunião marcada')}${titulo('cadastro', 'Cadastro', 'Itens essenciais do cadastro preenchidos')}${
        extras.map((k) => `<span class="cv2-extra">${ROTULO_EXTRA[k]}</span>`).join('')}<span class="cv2-th-vai"></span></div>
      <div class="cv2-linhas">${ordenada.map((n) => { const estado = situacaoDaLinhaDeCliente(n); return linhaDeClienteHtml(n, estado === 'sem', estado, cols, saudeDe, grupoDe(n)); }).join('')}</div>
    </section>`;
}

// As fichas (prancha V2-M-Clientes-Fichas): um cartão por cliente, com a foto, a nota, o que está em aberto e o head.
// O cartão abre a ficha; Drive, documento, CNPJ e endereço ficam na ficha, na aba Ecossistema e no cadastro.
function fichasDeClientesHtml(clientes) {
  const saudeDe = saudesDaCarteira();
  const lista = clientesQueValem(clientes, saudeDe);
  if (!lista.length) return VAZIO_DE_CLIENTES;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  return `<div class="cv2-fichas">${ordenarNomesDeClientes(lista, saudeDe, { coluna: 'saude', sentido: 1 }).map((nome) => {
    const f = cadastroDoCliente(nome) || {};
    const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
    const segmento = String(f.segmento || ligado.segment || '').trim();
    const heads = String(f.heads || ligado.head || '').split(',').map((n) => n.trim()).filter(Boolean);
    const s = saudeDe(nome), tom = tomDaNotaCv2(s);
    const { conteudos } = abertosDoCliente(nome);
    const vencidos = vencidosDoCliente(nome).length;
    return `<button type="button" class="cv2-ficha" data-cliente="${safeText(nome)}" onclick="abrirClienteDetalhe('${jsArg(nome)}')" title="Abrir a ficha de ${safeText(nome)}">
      <span class="cv2-ficha-alto">${fotoDoClienteCv2(nome, true)}${tom ? `<span class="cv2-sa ${tom}" title="Nota ${Number(s.score)} de 100"><b>${Number(s.score)}</b><span class="cv2-barra"><i style="--v:${Math.max(0, Math.min(100, Number(s.score)))}%"></i></span></span>` : '<span class="cv2-sa cv2-apagado">sem nota</span>'}</span>
      <b class="cv2-ficha-nome">${safeText(nome)}</b><span class="cv2-ficha-seg">${safeText(segmento) || '&nbsp;'}</span>
      <span class="cv2-ficha-ab">${plural(conteudos, 'aberta', 'abertas')}${vencidos ? ` <b class="cv2-ruim">· ${plural(vencidos, 'vencida', 'vencidas')}</b>` : ''}</span>
      <span class="cv2-hd">${heads.length ? `<i class="cv2-pes" aria-hidden="true">${safeText(iniciaisV2(heads[0]))}</i><span>${safeText(heads.map(primeiroNomeV2).join(', '))}</span>` : '<span class="cv2-apagado">sem head</span>'}</span>
    </button>`; }).join('')}</div>`;
}

// ── Atas de reunião ───────────────────────────────────────────────────────────
// Gerir cliente e, em boa parte, lembrar do que foi combinado na ultima
// conversa. Isso morava na cabeca de quem participou, ou num documento solto que
// ninguem achava depois. Aqui fica ao lado do cliente, com data e autor, e a
// data da ultima reuniao se atualiza sozinha quando uma ata nova entra —
// registrar a conversa e depois lembrar de mexer na data seriam dois passos
// para um fato so.
let ATAS_DO_CLIENTE = null;
async function abrirAtasDoCliente(nome) {
  const id = idDoCliente(nome);
  if (!id) return showToast('Este cliente ainda não tem cadastro próprio.', 'warning', 5000);
  ATAS_DO_CLIENTE = { id, nome, lista: [] };
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Reuniões</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Atas de ${safeText(nome)}</h2>
    <p class="workflow-copy">O que ficou combinado, com data e quem escreveu. A última reunião do
      cadastro acompanha a ata mais recente.</p>
    <div id="cli-atas" class="cli-atas-lista"><div class="auto-carregando">Buscando…</div></div>`);
  await recarregarAtas();
}

async function recarregarAtas() {
  if (!ATAS_DO_CLIENTE) return;
  const caixa = document.getElementById('cli-atas');
  if (!caixa) return;
  try {
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'atas', id: ATAS_DO_CLIENTE.id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível buscar as atas.');
    ATAS_DO_CLIENTE.lista = d.atas || [];
    ATAS_DO_CLIENTE.eventos = d.eventos || [];
    pintarAtas();
  } catch (e) {
    caixa.innerHTML = `<div class="auto-carregando">Não foi possível buscar<br><small>${safeText(e.message)}</small></div>`;
  }
}

function pintarAtas() {
  const caixa = document.getElementById('cli-atas');
  if (!caixa || !ATAS_DO_CLIENTE) return;
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const podeEscrever = podeEditarClientes();
  const lista = ATAS_DO_CLIENTE.lista;
  const hoje = new Date().toISOString().slice(0, 10);
  const nova = podeEscrever ? `<form class="cli-ata-nova" onsubmit="event.preventDefault();salvarAta()">
      <div class="cli-form">
        <label class="cli-campo"><span>Data da reunião</span>
          <input id="cli-ata-data" type="date" value="${hoje}"></label>
      </div>
      <textarea id="cli-ata-texto" rows="4"
        placeholder="O que foi decidido, o que ficou pendente e com quem."></textarea>
      <div class="workflow-actions"><button type="submit" class="workflow-primary">Registrar ata →</button></div>
    </form>` : '';
  // A historia de entrada e saida vem junto das atas: quem abre as reunioes de um
  // cliente esta reconstruindo a relacao com ele, e "saiu em marco, voltou em
  // julho" faz parte dessa reconstrucao. Antes isso nao existia em lugar nenhum:
  // o cadastro guardava o estado de hoje e apagava a historia.
  const eventos = ATAS_DO_CLIENTE.eventos || [];
  const quando = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const historia = eventos.length ? `<div class="cli-historia">
      <b>Histórico</b>${eventos.map((e) => `<div class="cli-historia-linha">
        <span>${safeText(quando(e.em))}</span>
        <em>${safeText(e.de || '—')} → ${safeText(e.para || '—')}</em>
        ${e.motivo ? `<small>${safeText(e.motivo)}</small>` : ''}
        <i>${safeText(e.autor || '')}</i></div>`).join('')}</div>` : '';
  caixa.innerHTML = nova + historia + (lista.length
    ? `<div class="cli-atas-rolo">${lista.map((a) => `<article class="cli-ata">
        <header><b>${safeText(dataBr(a.data))}</b><small>${safeText(a.autor || '')}</small>${
          podeEscrever ? `<button type="button" class="cli-ata-apagar" title="Apagar esta ata"
            onclick="apagarAta(${Number(a.id)})">apagar</button>` : ''}</header>
        <p>${safeText(a.resumo)}</p></article>`).join('')}</div>`
    : '<div class="auto-carregando">Nenhuma ata registrada ainda.</div>');
}

async function salvarAta() {
  if (!ATAS_DO_CLIENTE) return;
  const data = String(document.getElementById('cli-ata-data')?.value || '').slice(0, 10);
  const resumo = String(document.getElementById('cli-ata-texto')?.value || '').trim();
  if (!resumo) return showToast('Escreva o que ficou combinado.', 'warning', 3500);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return showToast('Escolha a data da reunião.', 'warning', 3500);
  try {
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'ata-criar', id: ATAS_DO_CLIENTE.id, data, resumo }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível registrar.');
    showToast('Ata registrada.', 'success', 3500);
    const campo = document.getElementById('cli-ata-texto');
    if (campo) campo.value = '';
    await recarregarAtas();
    void ensureClientMasterSources(true);
  } catch (e) { showToast(e.message, 'error', 5000); }
}

async function apagarAta(ataId) {
  const ok = await perguntarNoPainel({ titulo: 'Apagar esta ata?',
    texto: 'O registro sai do cliente. Se ela era a mais recente, a data da última reunião volta para a anterior.',
    confirmar: 'Apagar', perigo: true });
  if (!ok) return;
  try {
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ acao:'ata-apagar', ata: ataId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível apagar.');
    showToast('Ata apagada.', 'success', 3500);
    await recarregarAtas();
    void ensureClientMasterSources(true);
  } catch (e) { showToast(e.message, 'error', 5000); }
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
  if (CLIENT_MASTER_ERROR) {
    showToast('Cadastro salvo, mas não foi possível atualizar a tela. Recarregue para conferir.', 'warning', 7000);
  } else {
    // Atualiza tags já visíveis sem desmontar formulários ou perder foco.
    atualizarCoresDasCarteiras();
  }
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
    await gravarCadastroDeCliente({ acao:'criar', nome }, `${nome} entrou no cadastro. Complete a ficha agora.`);
    if (typeof abrirCadastroCompleto === 'function') abrirCadastroCompleto(nome);
  } catch (e) { showToast(e.message, 'error', 5000); }
}

const CAMPOS_DA_FICHA = [
  ['plano', 'Plano', 'text'], ['segmento', 'Segmento', 'text'],
  ['responsavel', 'Responsável geral', 'carteira'], ['proxima_reuniao', 'Próxima reunião', 'date'],
  ['planejamento_url', 'Link do planejamento', 'url'], ['nps', 'NPS (0 a 10)', 'number'],
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
    if (tipo === 'carteira') {
      const atual = String(bruto || '');
      const padrao = carteiraDoCliente(nome);
      const rotuloPadrao = padrao === 'vinicius' ? 'Vinícius' : padrao === 'ewerton' ? 'Ewerton' : 'Sem responsável geral';
      const opcoes = [...new Set([atual, 'Vinícius', 'Ewerton', 'Sem responsável geral'])];
      return `<label class="cli-campo"><span>Responsável geral</span>
        <select id="cli-f-responsavel">${opcoes.map(v => `<option value="${safeText(v)}" ${v === atual ? 'selected' : ''}>${safeText(v || rotuloPadrao + ' (padrão atual)')}</option>`).join('')}</select>
        <small>Define a carteira e as cores. Não altera heads ou executores.${normalizarCliente(nome) === 'VOA' ? ' Site da VOA: Ewerton.' : ''}</small></label>`;
    }
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
    <p class="workflow-copy">Edite o cadastro e a carteira do cliente. Campos em branco permanecem como estão.</p>
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
        onclick="alternarAtivoDoCliente('${jsArg(id)}', ${ativoAgora})">${ativoAgora ? 'Tirar do painel' : 'Voltar ao painel'}</button>
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
  const visao = visaoDeClientes();
  // Os filtros e a busca recortam a lista e as fichas; o Cérebro mostra o mapa inteiro e esconde os dois.
  const noCerebro = visao === 'sinapses' && typeof renderCerebroVybesHtml === 'function';
  document.querySelectorAll('#clientes-filtros, #clientes-hero > .cli-busca, #clientes-conta').forEach((el) => { el.hidden = noCerebro; });
  const listaDoCerebro = document.getElementById('clientes-cerebro-lista');
  if (listaDoCerebro && !noCerebro) { listaDoCerebro.hidden = true; listaDoCerebro.innerHTML = ''; }
  const corpo = document.getElementById('clientes-corpo');
  if (corpo) corpo.dataset.visao = noCerebro ? 'sinapses' : visao === 'sinapses' ? 'tabela' : visao;
  if (!noCerebro) clientes = clientes.filter(passaNosFiltrosDeClientes);
  if (noCerebro) {
    grid.classList.remove('em-tabela');
    grid.classList.add('em-sinapses');
    if (typeof cerebroEntrarNaJanela === 'function') cerebroEntrarNaJanela();
    grid.innerHTML = renderCerebroVybesHtml();
    if (typeof cerebroPintarLados === 'function') cerebroPintarLados();
    if (typeof montarMapaCerebro === 'function') montarMapaCerebro(); else if (typeof iniciarMotorCanvasCerebro === 'function') iniciarMotorCanvasCerebro();
    return;
  }
  grid.classList.remove('em-sinapses');
  // em-tabela fica nas duas vistas: sem ela a folha antiga força a grade de cartões na casa da lista.
  if (visao === 'fichas') {
    grid.classList.add('em-tabela');
    grid.innerHTML = fichasDeClientesHtml(clientes);
    return;
  }
  grid.classList.add('em-tabela');
  grid.innerHTML = tabelaDeClientesHtml(clientes);
  pintarDeckDeClientes();
}

// A busca entra nos filtros da lista: recarregar o quadro (um cadastro salvo, um filtro novo) não a perde mais.
function filterClientesList(query) {
  FILTRO_CLIENTES.busca = String(query || '').trim();
  renderClientesLista(clientMasterRecords().map((record) => record.name));
}

// Os numeros do topo sao da LISTA — 71 clientes, 1668 conteudos. Com um cliente
// aberto eles nao respondem nada e ainda empurram a ficha dele para baixo da
// dobra. Somem enquanto se olha um cliente, e voltam no "Voltar".
// O que está na janela (a lista ou a ficha de um cliente): a folha de estilo da Direção V2 lê isto no body.
function marcarTelaDeClientes() {
  if (typeof document === 'undefined' || !document.body?.dataset) return;
  document.body.dataset.cv2 = document.getElementById('panel-cliente-detalhe')?.style?.display === 'none' ? 'lista' : 'ficha';
}
function numerosDaListaDeClientes(mostrar) {
  ['clientes-hero', 'client-master-kpis', 'client-master-source-rail', 'clientes-corpo']
    .forEach((id) => { const el = document.getElementById(id); if (!el) return;
      // O cabeçalho da lista usa hidden (vybe-padrao.css força display:flex nele); os outros, o display.
      if (id === 'clientes-hero') el.hidden = !mostrar; else el.style.display = mostrar ? '' : 'none'; });
  marcarTelaDeClientes();
}

let CLIENTE_ABERTO = '';
function abrirClienteDetalhe(cli) {
  document.getElementById('panel-clientes-lista').style.display  = 'none';
  document.getElementById('panel-cliente-detalhe').style.display = '';
  numerosDaListaDeClientes(false);
  document.getElementById('cliente-detalhe-nome').textContent    = cli;
  CLIENTE_ABERTO = cli;
  delete PLANEJAMENTOS_DA_FICHA[idDoCliente(cli)];
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
  // Pranchas V2-M-Cliente-Conteudo e V2-M-Cliente-Demandas (16/11/2026): as duas listas são abas da ficha, no esqueleto
  // próprio (conteudoDaFichaHtml e demandasDaFichaHtml, em vybe-clientes-ficha.js), com os mesmos editores da operação
  // (marcar vários, status e datas na linha, dono, prévia). Redesenhar as listas = repintar a aba que está aberta.
  if (typeof FICHA_ABA === 'string' && (FICHA_ABA === 'conteudo' || FICHA_ABA === 'demandas')) renderClientMasterDetail(cli);
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
    if (DEMANDA_CONCLUIDA.includes(status)) visaoRapidaDemandas = 'concluidas';
    else if (visaoRapidaDemandas === 'concluidas') visaoRapidaDemandas = 'abertas';
    document.querySelectorAll('#demanda-status-legend .pill').forEach(p => p.classList.remove('active-legend'));
    pill.classList.add('active-legend');
  }
  renderDemandas();
}

function filterDemandaByPerson(personId, wrap) {
  currentDemandaPersonFilter = personId;
  document.querySelectorAll('#person-filter-bar-demandas .person-wrap').forEach(el => el.setAttribute('aria-pressed', String(el === wrap)));
  document.querySelectorAll('#person-filter-bar-demandas .person-chip').forEach(c => c.classList.remove('active'));
  const chip = wrap.querySelector('.person-chip');
  if (chip) chip.classList.add('active');
  renderDemandas();
}

function clearDemandaFilters() {
  visaoRapidaDemandas = 'todas';
  filtroCarteira = 'all';
  pintarFiltroCarteira();
  buscaClienteDemandas='';
  clienteDemandasExato='';
  const busca=document.getElementById('busca-cliente-demandas'); if(busca) busca.value='';
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
    const wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.className = 'person-wrap';
    wrap.setAttribute('aria-label', u.name);
    wrap.setAttribute('aria-pressed', String(currentDemandaPersonFilter === u.id));
    wrap.title = u.name;
    wrap.onclick = () => filterDemandaByPerson(u.id, wrap);
    // Mesma regra da tela de Producao: bolinha com foto, nome no title.
    wrap.dataset.personId = u.id;
    wrap.style.setProperty('--person-color', u.color || '#00f0ff');
    const chip = document.createElement('span');
    chip.className = 'person-chip so-foto' + (currentDemandaPersonFilter === u.id ? ' active' : '');
    chip.innerHTML = typeof ownerAvatarHtml === 'function'
      ? ownerAvatarHtml(u)
      : `<span class="owner-avatar-fallback" style="background:${u.color}">${
          String(u.name || '').slice(0, 2).toUpperCase()}</span>`;
    wrap.appendChild(chip);
    bar.appendChild(wrap);
  });
}

// Dispatcher unificado — chamado pelo botão Atualizar Dados
function refreshData({ boardCriado } = {}) {
  const boardNaAtualizacao = activeBoard;
  const leituras = [refreshProducao({force:true,source:'manual'})];
  // Um cadastro pode criar uma demanda a partir do calendário de Produção.
  // Recarregue o quadro gravado mesmo que outra tela esteja aberta.
  if (boardNaAtualizacao === 'demandas' || boardNaAtualizacao === 'clientes' || boardCriado === 'demandas') {
    leituras.push(refreshDemandas());
  }
  return Promise.all(leituras).then(() => {
    if (boardNaAtualizacao === 'clientes' && activeBoard === 'clientes') renderClientesBoard();
  });
}
