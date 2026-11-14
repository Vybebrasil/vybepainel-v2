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
  const conta = { ativos:0, inativos:0, sem:0, conteudos:0, conteudosAbertos:0, demandas:0, demandasAbertas:0 };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const registros = clientMasterRecords();
  const vistosConteudos = new Set(), vistasDemandas = new Set();
  (nomes || []).forEach((nome) => {
    const f = cadastroDoCliente(nome);
    const texto = String(f?.status || '').trim();
    if (!f || (!texto && f.ativo !== false)) conta.sem += 1;
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
function cabecaDaFichaHtml(nome, { f, meta, estado, podeMexer, aspas }) {
  const segmento = String(f.segmento || meta.segment || '').trim();
  const plano = String(f.plano || meta.plan || '').trim();
  const heads = String(f.heads || meta.head || '').split(',').map((n) => n.trim()).filter(Boolean);
  const meio = (texto, chamada, titulo) => podeMexer && chamada
    ? `<span class="clf-meta-item editavel" role="button" tabindex="0" title="${titulo}" onclick="${chamada}" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();this.click()}">${texto}</span>`
    : `<span class="clf-meta-item">${texto}</span>`;
  const headHtml = heads.length
    ? `<span class="clf-meta-rot">head</span>${heads.slice(0, 3).map((h) => `<span class="v2f-av" aria-hidden="true">${safeText(iniciaisV2(h))}</span>`).join('')}<span title="${safeText(heads.join(', '))}">${safeText(heads.map(primeiroNomeV2).join(', '))}</span>`
    : 'Sem head';
  const cor = corDoClienteV2(nome);
  return `<div class="clf-cabeca-linha v2f-cabeca">
      <button type="button" class="v2f-btn s clf-voltar" onclick="voltarClientesLista()"><span aria-hidden="true">‹</span> Clientes</button>
      <h2 class="clf-nome v2f-nome" style="color:${cor === '#6B665E' ? '#1F1D1A' : cor}">${safeText(nome)}</h2>${situacaoDoClienteHtml(nome, estado)}
      <p class="clf-meta v2f-meta">${[
          meio(segmento ? safeText(segmento) : 'Sem segmento', `abrirSegmentoDoCliente(event, '${aspas}')`, 'Trocar o segmento'),
          meio(plano ? safeText(plano) : 'Sem plano', `editarCampoDaFicha(event, '${aspas}', 'plano')`, 'Editar o plano'),
          meio(headHtml, `abrirHeadsDoCliente(event, '${aspas}')`, 'Escolher o head'),
        ].join('<i class="clf-ponto" aria-hidden="true">·</i>')}</p>
      <span class="clf-acoes v2f-acoes">
        ${podeMexer ? `<button type="button" class="v2f-btn" onclick="abrirFichaDeCliente('${aspas}')">Editar cadastro</button>` : ''}
        <button type="button" class="v2f-btn p" onclick="openCadastrosGoverned({ client: '${aspas}' })">Nova demanda</button>
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
// Direção 3 (quadro D3-FichaCliente): a faixa de cima com três cartões, Saúde (número, linha e os motivos com os pontos),
// Clima do grupo e Onboarding. Sem dado, o cartão fica no lugar com um vazio curto.
function faixaDaFichaHtml({ id, s, sv, motivosTexto, serie = null }) {
  const tom = tomDaSaudeV2(s);
  const dataHora = (v) => { const d = new Date(v); if (!Number.isFinite(d.getTime())) return '';
    const dia = d.toISOString().slice(0, 10) === hojeIsoV2() ? 'hoje' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${dia} ${String(d.getHours()).padStart(2, '0')}h`; };
  // Saúde: os motivos com os pontos, quando a conta da Carteira está à mão; senão, os textos.
  const pontos = (s?.motivos || []).filter((m) => typeof m === 'object' && m.tom === 'ruim' && m.pontos);
  const pilulas = pontos.length
    ? pontos.slice(0, 3).map((m) => `<span class="v2f-pill d3f-mot" title="${safeText(m.texto)}"><b>${String(m.pontos).replace('-', '−')}</b>${safeText(String(m.texto).replace(/^grupo:.*/, 'grupo'))}</span>`).join('')
    : motivosTexto;
  // A nota guardada dia a dia (vybe_serie_diaria, série 'saude'); com menos de dois dias guardados, o vazio honesto.
  const pontosSaude = (serie?.saude?.pontos || []).filter((p) => p && p.valor != null);
  const valoresSaude = typeof d3SerieValores === 'function' ? d3SerieValores(serie?.saude) : null;
  const desdeSaude = pontosSaude.length ? pontosSaude[0].dia.slice(8, 10) + '/' + pontosSaude[0].dia.slice(5, 7) : '';
  const linha = valoresSaude && typeof d3LinhaSvg === 'function'
    ? `<div class="d3f-hist" title="Saúde guardada dia a dia desde ${desdeSaude}${(serie.saude.origens || []).includes('saude_mensal') ? ' (antes de 14/11, a nota de cada mês)' : ''}">${d3LinhaSvg(valoresSaude, { largura: 160, altura: 34, meta: 75, rotulo: `Saúde de ${valoresSaude.length} registros desde ${desdeSaude}` })}<small class="v2f-sub">desde ${desdeSaude}</small></div>`
    : '<p class="d3f-sem-hist">sem histórico ainda</p>';
  const saude = `<section class="v2f-card v2f-saude d3f-faixa-saude${tom ? ' v2-humor' : ''}"${tom ? (typeof vbHumorAttr === 'function' ? vbHumorAttr(Number(s.score)) : '') : ''} style="--c:${tom ? tom.barra : '#B5AFA5'}" aria-label="Saúde do cliente">
      <div class="d3f-faixa-num"><span class="v2f-sub">Saúde</span><b class="v2f-nota" style="color:${tom ? tom.texto : '#6B665E'}"><span class="v2-num">${tom ? Number(s.score) : '—'}</span></b>
        <span class="d3f-faixa-risco" style="color:${tom ? tom.texto : '#6B665E'}">${tom ? ({ alto: 'risco alto', medio: 'risco médio', baixo: 'em dia' }[s.risco] || '') : 'sem nota'}</span></div>
      <div class="d3f-faixa-meio">${linha}<p class="v2f-pills">${pilulas || '<span class="v2f-sub">nada puxando para baixo</span>'}</p></div>
    </section>`;
  // Clima do grupo (vybe_carteira_clima, o bot lê o grupo).
  const cl = id && sv?.clima?.disponivel ? (sv.clima.porCliente || {})[String(id)] : null;
  const clima = `<section class="v2f-card d3f-faixa-card" aria-label="Clima do grupo"><div class="d3f-faixa-topo"><b>Clima do grupo</b>${cl?.atualizado_em ? `<span class="v2f-sub d3f-faixa-quando"><span class="d3f-ag" aria-hidden="true">V</span>${safeText(dataHora(cl.atualizado_em))}</span>` : ''}</div>
      ${cl && Number.isFinite(Number(cl.pontos))
        ? `<b class="d3f-faixa-v"><span class="v2-num">${Number(cl.pontos) > 0 ? '+' : Number(cl.pontos) < 0 ? '−' : ''}${Math.abs(Number(cl.pontos))}</span><small> pts</small></b>
           <p class="v2f-pills">${cl.motivo ? `<span class="v2f-pill ${Number(cl.pontos) < 0 ? 'a' : 'g'}">${safeText(cl.motivo)}</span>` : ''}</p>`
        : `<p class="d3f-faixa-vazio">${!sv ? 'Lendo o grupo…' : 'Sem leitura do grupo ainda.'}</p>`}
    </section>`;
  // Onboarding: os itens feitos de todas as etapas, a barra e onde parou.
  const ob = id && sv?.onboarding?.disponivel ? (sv.onboarding.clientes || []).find((o) => String(o.cliente_id) === String(id)) : null;
  const sit = ob?.situacao;
  const totalItens = sit ? (sit.etapas || []).reduce((t, e) => t + (Number(e.total) || 0), 0) : 0;
  const feitosItens = sit ? (sit.etapas || []).reduce((t, e) => t + (Number(e.feitos) || 0), 0) : 0;
  const diaBr = (v) => { const iso = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8)}/${iso.slice(5, 7)}` : ''; };
  const pe = !sit ? '' : sit.concluido
    ? [diaBr(ob.encerrado_em), ob.iniciado_em && ob.encerrado_em ? `<b>${Math.max(0, Math.round((Date.parse(String(ob.encerrado_em).slice(0, 10)) - Date.parse(String(ob.iniciado_em).slice(0, 10))) / 864e5))} dias</b>` : ''].filter(Boolean).join(' · ')
    : [sit.atual?.nome ? safeText(sit.atual.nome) : '', sit.atual?.dias_parada ? `<b>parada há ${sit.atual.dias_parada} ${sit.atual.dias_parada === 1 ? 'dia' : 'dias'}</b>` : ''].filter(Boolean).join(' · ');
  const onboarding = `<section class="v2f-card d3f-faixa-card" aria-label="Onboarding"><div class="d3f-faixa-topo"><b>Onboarding</b>${sit ? `<span class="v2f-pill ${sit.concluido ? 'g' : 'a'}">${sit.concluido ? 'Concluído' : 'Em andamento'}</span>` : ''}</div>
      ${sit ? `<b class="d3f-faixa-v"><span class="v2-num">${feitosItens}</span><small> / ${totalItens}</small></b>
        <span class="d3-barra d3f-faixa-barra" style="--v:${totalItens ? Math.round((feitosItens / totalItens) * 100) : 0}%"><i></i></span>
        ${pe ? `<p class="d3f-faixa-pe">${pe}</p>` : ''}`
        : `<p class="d3f-faixa-vazio">${!sv ? 'Lendo o onboarding…' : 'Sem onboarding registrado.'}</p>`}
    </section>`;
  return `<div class="d3f-faixa">${saude}${clima}${onboarding}</div>`;
}

// O corpo da ficha pelo quadro: no alto, a nota de saúde com o porquê e a fala do Mateus (ficam em cima de todas as
// abas); no Resumo, "Pede ação" e "Próximas entregas" à esquerda, "Última reunião", "Dados e acessos" e os
// planejamentos à direita. As listas completas (com prazo, status e seleção de vários) ficam nas abas Conteúdo e Demandas.
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
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

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

  // ── No alto: a nota e a fala ──
  const s = id ? saudesDaCarteira()(nome) : null;
  const tom = tomDaSaudeV2(s);
  const semConversa = id ? diasSemContato(f) : null;
  const completo = id && typeof completudeDoCadastro === 'function' ? completudeDoCadastro(f) : null;
  const motivos = [
    ...((s && s.motivos) || []).slice(0, 2).map((m) => `<span class="v2f-pill ${/vencid|furo|atras/i.test(m) ? 'r' : 'a'}">${safeText(m)}</span>`),
    !id ? '' : semConversa === null ? '<span class="v2f-pill a">sem reunião registrada</span>'
      : `<span class="v2f-pill ${semConversa >= SEM_CONTATO_ATENCAO ? 'a' : 'n'}">reunião há ${plural(semConversa, 'dia', 'dias')}</span>`,
    completo ? `<button type="button" class="v2f-pill ${completo.feitos === completo.total ? 'g' : 'a'}" title="Ver o cadastro inteiro" onclick="trocarAbaDaFicha('cadastro')">cadastro ${completo.feitos} de ${completo.total}</button>` : '',
    !id ? '<span class="v2f-pill a">sem ficha no cadastro</span>' : '',
  ].filter(Boolean).join('');
  // 10 · Cor do humor: a nota de saúde pinta o cartão do alto da ficha.
  const nota = `<section class="v2f-card v2f-saude${tom ? ' v2-humor' : ''}"${tom ? (typeof vbHumorAttr === 'function' ? vbHumorAttr(Number(s.score)) : '') : ''} aria-label="Saúde do cliente">
      <div class="v2f-nota-caixa"><b class="v2f-nota" style="color:${tom ? tom.texto : '#6B665E'}"><span class="v2-num">${tom ? Number(s.score) : '—'}</span></b><p class="v2f-sub">saúde</p></div>
      <div class="v2f-porque"><p class="v2f-sub">${tom ? 'O porquê:' : 'Sem nota: cliente inativo ou sem peças para medir.'}</p><p class="v2f-pills">${motivos}</p></div>
    </section>`;
  const fraseReuniao = semConversa === null ? 'ainda não há reunião registrada' : semConversa === 0 ? 'a última reunião foi hoje' : `a última reunião foi há ${plural(semConversa, 'dia', 'dias')}`;
  const conselho = vencidas.length ? 'Eu começaria pelas vencidas.'
    : semConversa === null || semConversa >= SEM_CONTATO_ATENCAO ? 'Eu começaria marcando a reunião.' : 'A conta está em ordem.';
  const fraseFala = !id ? 'Este nome aparece na operação, mas ainda não tem ficha. Eu começaria criando a ficha.'
    : `${vencidas.length ? `<b>${vencidas.length === 1 ? '1 peça passou' : `${vencidas.length} peças passaram`} da veiculação</b> e ` : 'Nenhuma peça vencida e '}${fraseReuniao}. ${conselho}`;
  const verConta = window.VybeCarteira?.abrir
    ? `<button type="button" class="v2f-btn s" onclick="window.VybeCarteira.abrir('saude', { abas: ['saude'] })">Ver a conta</button>` : '';
  // Direção 3 (moodboard 3, 13/11/2026): no alto só o bloco de ação laranja, numa frase curta; as abas entram logo
  // depois dele e a nota com o porquê abre o Resumo.
  const fraseCurta = !id ? 'Sem ficha no cadastro ainda.'
    : `${vencidas.length ? `${vencidas.length === 1 ? '1 peça passou' : `${vencidas.length} peças passaram`} da veiculação.` : 'Nenhuma peça vencida.'} ${
      semConversa === null ? 'Sem reunião registrada.' : semConversa === 0 ? 'Última reunião hoje.' : `Última reunião há ${plural(semConversa, 'dia', 'dias')}.`}`;
  const alto = typeof d3AcaoHtml === 'function'
    ? `<div class="v2f-alto d3f-alto">${d3AcaoHtml({ frase: `<small class="d3c-quem">Mateus · Atendimento</small>${fraseCurta}`, agente: 'Mateus',
      botao: window.VybeCarteira?.abrir ? 'Ver a conta' : '', attrs: `onclick="window.VybeCarteira.abrir('saude', { abas: ['saude'] })"` })}</div>`
    : `<div class="v2f-alto">${nota}<section class="v2f-card v2f-fala" aria-label="Leitura do Mateus">${falaV2Html('Mateus · Atendimento ao cliente', fraseFala, verConta)}</section></div>`;
  // Direção 3: a faixa de três cartões (Saúde, Clima do grupo, Onboarding) no lugar da nota solta.
  const sv = id && typeof d3AcaoHtml === 'function' ? carteiraDaFicha(() => {
    const aberto = document.getElementById('client-master-detail');
    if (aberto && aberto.dataset.cliente === nome && aberto.isConnected) renderClientMasterDetail(nome);
  }) : null;
  // A linha da Saúde: a nota guardada dia a dia (server/series-historicas.js, GET area=series&para=cliente).
  const serieSaude = id && typeof d3Series === 'function' ? d3Series('cliente', () => {
    const aberto = document.getElementById('client-master-detail');
    if (aberto && aberto.dataset.cliente === nome && aberto.isConnected) renderClientMasterDetail(nome);
  }, 'id=' + encodeURIComponent(id)) : null;
  const notaNoCorpo = typeof d3AcaoHtml === 'function'
    ? faixaDaFichaHtml({ id, s: saudeDaFicha(id, sv) || s, sv, motivosTexto: motivos, serie: serieSaude }) : '';
  node.dataset.cliente = nome;

  // ── Pede ação ──
  const linhaVencida = (x) => `<p class="v2f-hist">${safeText(String(x.d.nome || x.d.formato || 'Peça').replace(/\s+-\s+/, ' · '))}, era para ${x.quando.slice(8)}/${x.quando.slice(5, 7)}${x.d.responsavel ? `, com ${safeText(primeiroNomeV2(x.d.responsavel))}` : ''}${/info/i.test(String(x.d.status || '')) ? ', espera informação do cliente' : ''}</p>`;
  const pede = [];
  if (!id && podeEditorClientesNaFicha()) pede.push(`<div class="v2f-lin"><span class="v2f-pill a">Sem ficha</span><p><b>Cadastro</b> ainda não criado</p><button type="button" class="v2f-btn s" onclick="cadastrarClienteDaOperacao('${aspas}')">Criar a ficha</button></div>`);
  if (vencidas.length) pede.push(`<div class="v2-abre v2f-abre" aria-expanded="false">
      <div class="v2f-lin"><span class="v2f-pill r">${plural(vencidas.length, 'vencida', 'vencidas')}</span>
        <p><button type="button" class="v2f-abrir" aria-expanded="false" onclick="alternarLinhaV2(this)">${vencidas.length === 1 ? 'Peça' : 'Peças'} com a <b>veiculação vencida</b></button></p>
        <button type="button" class="v2f-btn s" title="Abre a aba Conteúdo, onde a data troca na linha" onclick="trocarAbaDaFicha('conteudo')">Reagendar</button></div>
      <div class="v2-mais"><div>${vencidas.slice(0, 2).map(linhaVencida).join('')}
        ${vencidas.length > 2 ? `<p class="v2f-hist"><span>+ ${plural(vencidas.length - 2, 'peça', 'peças')} · <button type="button" class="v2f-link" onclick="trocarAbaDaFicha('conteudo')">ver todas</button></span></p>` : ''}</div></div>
    </div>`);
  const plj = planejamentosDaFicha(id, nome);
  const mesPlj = (p) => (typeof pljMes === 'function' ? pljMes(p.mes) : String(p.mes || ''));
  ((plj && plj.lista) || []).filter((p) => ['ajustes', 'revisar'].includes(p.estado)).forEach((p) => pede.push(
    `<div class="v2f-lin"><span class="v2f-pill a">${p.estado === 'ajustes' ? 'Ajustes pedidos' : 'Para revisar'}</span>
      <p><b>Planejamento de ${safeText(mesPlj(p).toLowerCase())}</b> · ${safeText(String(p.titulo || '').replace(/^planejamento de\s*/i, ''))}, versão ${safeText(p.versao)}</p>
      <button type="button" class="v2f-btn s" onclick="abrirPlanejamento('${safeText(p.id)}')">Abrir</button></div>`));
  if (id && !reuniao) pede.push(`<div class="v2f-lin"><span class="v2f-pill a">Sem data</span><p><b>Próxima reunião</b> ainda não marcada</p>${podeMexer
    ? `<button type="button" class="v2f-btn s" onclick="editarCampoDaFicha({ currentTarget: this.closest('.v2f-lin') }, '${aspas}', 'proxima_reuniao')">Marcar reunião</button>` : ''}</div>`);
  const cartaoPede = `<section class="v2f-card v2f-pede"><div class="v2f-card-topo"><h3>Pede ação</h3><span class="v2f-sub">${pede.length ? `${plural(pede.length, 'coisa', 'coisas')}, na ordem` : 'nada agora'}</span></div>
      ${pede.join('') || '<p class="v2f-vazio">Nada pede ação neste cliente agora.</p>'}</section>`;

  // ── Próximas entregas ──
  const proximas = abertos.filter((x) => !x.quando || x.quando >= hoje).sort((a, b) => (a.quando || '9999').localeCompare(b.quando || '9999'));
  const NA_FRENTE = 3;
  const olho = (d) => (typeof botaoDePreviaNaLinha === 'function' ? botaoDePreviaNaLinha(d, 'v2f-olho') : '');
  const entrega = (x) => `<div class="v2f-lin v2f-entrega" role="button" tabindex="0" title="Abrir ${safeText(x.d.nome || '')}" onclick="if(typeof openItemWorkspace==='function')openItemWorkspace('${safeText(String(x.d.id))}')" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();this.click()}">
      <span class="v2f-pill ${tomDoStatusV2(x.d.status)}">${safeText(x.d.status || 'Sem status')}</span><p><b>${safeText(String(x.d.nome || '').replace(/\s+-\s+/, ' · '))}</b></p>${olho(x.d)}
      <span class="v2f-sub">${quandoVeiculaV2(x.quando)}</span>${x.d.responsavel ? `<span class="v2f-av" title="${safeText(x.d.responsavel)}" aria-hidden="true">${safeText(iniciaisV2(x.d.responsavel))}</span>` : ''}</div>`;
  const restoEntregas = abertos.length - Math.min(NA_FRENTE, proximas.length);
  const cartaoEntregas = `<section class="v2f-card v2f-entregas"><div class="v2f-card-topo"><h3>Próximas entregas</h3><span class="v2f-sub">${plural(conteudos, 'conteúdo em aberto', 'conteúdos em aberto')} · ${pedidos ? plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido'}</span></div>
      ${proximas.slice(0, NA_FRENTE).map(entrega).join('') || `<p class="v2f-vazio">${abertos.length ? 'Nenhuma entrega com data pela frente.' : 'Nenhum conteúdo em aberto.'}</p>`}
      ${abertos.length ? `<p class="v2f-pe">${restoEntregas > 0 ? `+ ${plural(restoEntregas, 'conteúdo', 'conteúdos')} · ` : ''}<button type="button" class="v2f-link" onclick="trocarAbaDaFicha('conteudo')">mostrar</button> · prazo, status e seleção de vários ficam na aba Conteúdo</p>` : ''}</section>`;

  // ── Última reunião ──
  const reu = id && window.VybeReunioes?.dadosDe ? window.VybeReunioes.dadosDe(id) : null;
  const ultima = reu ? (reu.reunioes || []).filter((r) => r.data <= hoje)[0] || (reu.reunioes || [])[0] : null;
  const sugeridas = ultima?.sugestoes?.demandas || [];
  const jaCadastradas = ultima?.sugestoes?.cadastradas || [];
  const decisoes = sugeridas.slice(0, 3).map((d) => { const feita = jaCadastradas.some((c) => c.titulo === d.titulo);
    return `<p class="v2f-dec"><i class="v2f-cx${feita ? ' ok' : ''}">${feita ? V2F_CERTO : ''}</i><span class="v2-risca${feita ? ' feita' : ''}">${safeText(d.titulo)}</span></p>`; }).join('');
  const participantes = String(ultima?.participantes || '').split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const corpoReuniao = !id ? '<p class="v2f-vazio">Crie a ficha para registrar reuniões.</p>'
    : !reu ? '<p class="v2f-vazio">Lendo as reuniões…</p>'
    : !ultima ? `<p class="v2f-vazio">Nenhuma reunião registrada ainda.</p>${reu.pode ? `<p class="v2f-botoes"><button type="button" class="v2f-btn s" onclick="abrirReuniao('${aspas}')">Nova reunião</button></p>` : ''}`
    : `<p class="v2f-reu-linha">${participantes.length ? `<span class="v2f-avs" role="img" aria-label="Participantes: ${safeText(participantes.join(', '))}">${participantes.slice(0, 3).map((p) => `<span class="v2f-av">${safeText(iniciaisV2(p))}</span>`).join('')}</span>` : ''}${safeText(ultima.titulo)}</p>
      ${decisoes}${!decisoes && !ultima.ata ? '<p class="v2f-vazio">Ainda sem ata.</p>' : ''}
      <p class="v2f-botoes"><button type="button" class="v2f-btn s" onclick="trocarAbaDaFicha('reunioes')">Resumo e decisões</button>${ultima.transcricao ? `<button type="button" class="v2f-btn s" onclick="trocarAbaDaFicha('reunioes')">Transcrição</button>` : ''}</p>`;
  const cartaoReuniao = `<section class="v2f-card v2f-reuniao"><div class="v2f-card-topo"><h3>Última reunião</h3><span class="v2f-sub">${ultima ? `${dataPorExtensoV2(ultima.data)}${ultima.gravacao ? ' · gravada' : ''}` : ''}</span></div>
      ${corpoReuniao}
      ${reuniao ? `<p class="v2f-pe">Próxima reunião em <b>${safeText(reuniao)}</b>${podeMexer ? ` · <button type="button" class="v2f-link" onclick="editarCampoDaFicha({ currentTarget: this.closest('.v2f-pe') }, '${aspas}', 'proxima_reuniao')">trocar a data</button>` : ''}</p>` : ''}</section>`;

  // ── Dados e acessos: cada porta numa linha; o que falta diz "Falta" e se guarda ali mesmo. ──
  const urlDrive = linkDeCliente(meta.drive);
  const outroLink = linkDeCliente(meta.link);
  const ehManus = /(^|\.)manus\.im$/i.test((() => { try { return new URL(outroLink).hostname; } catch { return ''; } })());
  const planejamentoUrl = linkDeCliente(f.planejamento_url || meta.planning);
  const falta = '<span class="v2f-pill a">Falta</span>';
  const abrirLink = (url) => `<a class="v2f-btn s" href="${safeText(url)}" target="_blank" rel="noopener">Abrir</a>`;
  const guardar = (campo, rotulo) => (podeMexer ? `<button type="button" class="v2f-btn s" onclick="editarAcessoDaFicha(event, '${aspas}', '${campo}')">${rotulo}</button>` : '');
  const temDoc = Boolean(meta.acessoId && meta.doc);
  const docBotao = meta.acessoId || podeMexer
    ? `<button type="button" class="v2f-btn s" onclick="abrirDocumentoDoCliente('${safeText(String(meta.acessoId || ''))}', '${aspas}', '${safeText(id)}')">${temDoc ? 'Abrir' : 'Escrever'}</button>` : '';
  const linhaAcesso = (rotulo, valorHtml, chamada, acao) => `<div class="clf-acesso client-master-detail-field">
      <small>${rotulo}</small><b>${valorHtml}</b>${podeMexer && chamada ? `<button type="button" class="v2f-link" onclick="${chamada}">${acao}</button>` : ''}</div>`;
  const rotuloLink = ehManus || meta.temManus ? 'Manus' : 'Link do projeto';
  const cartaoDados = `<section class="v2f-card v2f-dados clf-dados"><div class="v2f-card-topo"><h3>Dados e acessos</h3><span class="v2f-sub">senhas só para quem administra</span></div>
      <div class="v2f-lin">${urlDrive ? '' : falta}<p><b>Drive</b> do cliente</p>${urlDrive ? abrirLink(urlDrive) : guardar('pasta_drive', 'Colar o link')}</div>
      <div class="v2f-lin">${temDoc ? '' : falta}<p><b>Documento de acessos</b></p>${docBotao}</div>
      <div class="v2f-lin"><p><b>Acessos</b> · links, senhas e painel</p><button type="button" class="v2f-btn s" aria-expanded="false" aria-controls="v2f-acessos-lista" onclick="const l=document.getElementById('v2f-acessos-lista');l.hidden=!l.hidden;this.setAttribute('aria-expanded',String(!l.hidden))">Ver acessos</button></div>
      <div class="clf-acessos-lista v2f-acessos-lista" id="v2f-acessos-lista" hidden>
        ${linhaAcesso('Pasta do Drive', urlDrive ? `<a href="${safeText(urlDrive)}" target="_blank" rel="noopener">Abrir no Drive</a>` : 'Falta',
          `editarAcessoDaFicha(event, '${aspas}', 'pasta_drive')`, urlDrive ? 'Trocar' : 'Guardar o endereço')}
        ${linhaAcesso(rotuloLink, outroLink ? `<a href="${safeText(outroLink)}" target="_blank" rel="noopener">Abrir</a>` : meta.temManus ? 'Marcado no Manus, sem endereço' : 'Falta',
          `editarAcessoDaFicha(event, '${aspas}', 'link')`, outroLink ? 'Trocar' : 'Guardar o endereço')}
        ${linhaAcesso('Planejamento', planejamentoUrl ? `<a href="${safeText(planejamentoUrl)}" target="_blank" rel="noopener">Abrir</a>` : 'Falta',
          podeMexer ? `abrirFichaDeCliente('${aspas}')` : '', 'Editar no cadastro')}
        ${linhaAcesso('Painel do cliente', paineldoClienteHtml(painel),
          `editarCampoDaFicha({ currentTarget: this.closest('.clf-acesso') }, '${aspas}', 'dashboard')`, 'Trocar')}
      </div>
      <div class="v2f-lin">${outroLink ? '' : falta}<p><b>${rotuloLink}</b></p>${outroLink ? abrirLink(outroLink) : guardar('link', 'Colar o link')}</div>
    </section>`;

  // ── Planejamentos: uma ficha por mês e "Começar um planejamento". ──
  const fichasPlj = !id ? '' : !plj ? '<span class="v2f-sub">buscando…</span>'
    : `${plj.lista.map((p) => `<button type="button" class="v2f-chip" title="${safeText((typeof PLJ_ESTADOS !== 'undefined' && PLJ_ESTADOS[p.estado]?.rotulo) || p.estado || '')}" onclick="abrirPlanejamento('${safeText(p.id)}')">${safeText(mesPlj(p))} · v${safeText(p.versao)}</button>`).join('')}${
      plj.podeCriar && typeof novoPlanejamento === 'function' ? `<button type="button" class="v2f-chip" onclick="novoPlanejamento('${safeText(id)}', '${aspas}')">Começar um planejamento</button>` : ''}${
      !plj.lista.length && !plj.podeCriar ? `<span class="v2f-sub">${plj.erro ? safeText(plj.erro) : 'nenhum ainda'}</span>` : ''}`;
  const planejamentos = id ? `<div class="v2f-plj"><span class="v2f-sub">Planejamentos:</span>${fichasPlj}</div>` : '';

  node.innerHTML = `${alto}<div class="v2f-corpo">${notaNoCorpo}<div class="v2f-dupla"><div class="v2f-col">${cartaoPede}${cartaoEntregas}</div><div class="v2f-col">${cartaoReuniao}${cartaoDados}${planejamentos}</div></div></div>`;
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
  const aceso = (k) => (k.acao || '').includes(`'${FOCO_DE_CLIENTES}'`);
  // NUMERO QUE NAO PEDE NADA RECUA.
  //
  // Os oito cartoes tinham o mesmo peso. Num dia real, tres deles diziam zero —
  // "Detratores 0", "Sem contato 0", "NPS médio —" — e disputavam o olho de
  // igual para igual com "Painel a atualizar 14" e "Só na operação 31", que sao
  // trabalho de verdade. Zero continua na tela, porque "nenhum detrator" e uma
  // boa noticia que vale ver; so para de gritar.
  // Dois numeros novos, e os dois sao fila de trabalho, nao estatistica: quem
  // esta sem conversa ha tempo demais, e quantos paineis precisam ser
  // atualizados. Clicar recorta a lista para eles.
  // Juntar "faz muito tempo que nao falo com ele" com "nunca registrei nada"
  // dava 15 de 15 no primeiro dia — um numero que diz que tudo esta errado nao
  // e sinal, e ruido, e ninguem olha duas vezes. Sao problemas diferentes: um e
  // de relacionamento, o outro e de preenchimento, e so o primeiro e urgente.
  // Os recortes contam dentro do Head e do Segmento escolhidos: o número do chip é o que a lista vai mostrar.
  const ativoDeVerdade = (c) => clienteAtivo(c) && String(c.status || '').trim()
    && passaNosFiltrosDeClientes(c.nome, { semBusca: true });
  const semContato = CADASTRO_CLIENTES.filter((c) => {
    if (!ativoDeVerdade(c)) return false;
    const d = diasSemContato(c);
    return d !== null && d >= SEM_CONTATO_ATENCAO;
  }).length;
  const semRegistro = CADASTRO_CLIENTES.filter((c) =>
    ativoDeVerdade(c) && diasSemContato(c) === null).length;
  const painelVelho = CADASTRO_CLIENTES.filter((c) => {
    if (!ativoDeVerdade(c)) return false;
    const p = String(c.dashboard || '').trim();
    return Boolean(p) && !painelEstaEmDia(p);
  }).length;
  // NPS medio de quem tem nota, e quantos detratores. Media sozinha esconde o
  // caso grave: seis notas 9 e uma 3 dao 8,1 — e ha um cliente para ligar hoje.
  // A média vai na frase do cabeçalho, que é da carteira inteira; os detratores (chip) seguem os filtros.
  const comNota = CADASTRO_CLIENTES.filter((c) => clienteAtivo(c) && String(c.status || '').trim() && temNota(c.nps));
  const npsMedio = comNota.length
    ? (comNota.reduce((soma, c) => soma + Number(c.nps), 0) / comNota.length).toFixed(1).replace('.', ',')
    : '—';
  const detratores = comNota.filter((c) => Number(c.nps) <= 6 && ativoDeVerdade(c)).length;
  // Quadro "Clientes" do moodboard (12/11/2026), nesta ordem: título com Tabela/Fichas/Cérebro, Cadastros e Novo
  // cliente; a fala do Mateus; três números; busca e filtros numa linha; a tabela num cartão. Os números que eram
  // frase e chips viram o texto pequeno dos três cartões; os recortes (sem contato, detratores, painel) seguem em Filtros.
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const recortes = [
    {label:'Sem contato', value:semContato, acao:"focarClientes('sem-contato')", foco:'sem-contato', zero:'ninguém sem contato',
      dica:`Só quem está há ${SEM_CONTATO_ATENCAO} dias ou mais sem reunião`},
    {label:'Sem registro de reunião', value:semRegistro, acao:"focarClientes('sem-registro')", foco:'sem-registro', zero:'todos com reunião registrada',
      dica:'Só quem ainda não tem nenhuma reunião anotada'},
    {label:'Detratores', value:detratores, acao:"focarClientes('detratores')", foco:'detratores', zero:'nenhum detrator',
      dica:'Só quem deu nota 6 ou menos no NPS'},
    {label:'Painel a atualizar', value:painelVelho, acao:"focarClientes('painel-velho')", foco:'painel-velho', zero:'nenhum painel a atualizar',
      dica:'Só quem está com o painel (dashboard) desatualizado'},
  ].map((k) => ({ ...k, aceso: aceso(k) }));
  const saudeDe = saudesDaCarteira();
  const nomesAtivos = todosClientes.filter((n) => situacaoDaLinhaDeCliente(n) === 'ativos');
  const riscos = { baixo: 0, medio: 0, alto: 0 };
  nomesAtivos.forEach((n) => { const s = saudeDe(n); if (s && riscos[s.risco] !== undefined) riscos[s.risco] += 1; });
  const porRisco = [riscos.baixo ? `${riscos.baixo} em dia` : '', riscos.medio ? `${riscos.medio} em risco médio` : '', riscos.alto ? `${riscos.alto} em risco alto` : ''].filter(Boolean);
  const frase = document.getElementById('clientes-frase');
  if (frase) frase.textContent = '';
  const gradeKpi = document.getElementById('kpi-grid-clientes');
  if (gradeKpi) {
    // Direção 3 (moodboard 3, 13/11/2026): quatro números; "Sem reunião registrada" mostra a barra do quanto falta.
    const numero = (titulo, valor, sub, atraso, { de = '', tom = '', barra = null } = {}) => `<div class="v2f-card v2f-kpi d3-num${tom ? ` ${tom}` : ''}"><small class="d3-num-rot">${titulo}</small><b class="d3-num-v"${atraso ? ` style="animation-delay:${atraso}"` : ''}>${valor}${de ? `<small>${de}</small>` : ''}</b>${
      barra == null ? '' : `<span class="d3-barra${tom === 'r' ? ' r' : ''}" style="--v:${Math.max(0, Math.min(100, Math.round(barra)))}%"><i></i></span>`}${sub ? `<small class="d3c-sub">${sub}</small>` : ''}</div>`;
    gradeKpi.className = 'kpi-grid v2f-kpis d3f-kpis';
    gradeKpi.hidden = visaoDeClientes() === 'sinapses';
    gradeKpi.innerHTML = numero('Ativos', numeros.ativos, [...porRisco, numeros.inativos ? plural(numeros.inativos, 'inativo', 'inativos') : ''].filter(Boolean).join(' · ') || 'sem nota ainda')
      + numero('Sem reunião registrada', semRegistro, '', '.12s',
        { de: numeros.ativos ? ` / ${numeros.ativos}` : '', tom: semRegistro ? 'r' : '', barra: numeros.ativos ? (semRegistro / numeros.ativos) * 100 : null })
      + numero('Com NPS', comNota.length, [comNota.length ? `média ${npsMedio}` : '', plural(detratores, 'detrator', 'detratores'), `${semContato} sem contato`].filter(Boolean).join(' · '), '.24s', { de: numeros.ativos ? ` / ${numeros.ativos}` : '' })
      + numero('Só na operação', numeros.sem || 0, `sem ficha · ${plural(painelVelho, 'painel', 'painéis')}`, '.36s');
  }
  // A fala do Mateus: como está a carteira, o item que mais falta no cadastro e quem está sem ficha. "Completar
  // cadastros" recorta a lista para quem não tem reunião registrada (o mesmo recorte do aviso antigo).
  const aviso = document.getElementById('clientes-aviso');
  if (aviso) {
    const focado = FOCO_DE_CLIENTES === 'sem-registro';
    const faltas = new Map();
    let comFicha = 0;
    nomesAtivos.forEach((n) => { const c = typeof completudeDoCadastro === 'function' ? completudeDoCadastro(cadastroDoCliente(n)) : null;
      if (!c) return; comFicha += 1; c.faltam.forEach((r) => faltas.set(r, (faltas.get(r) || 0) + 1)); });
    const candidatos = [...faltas.entries()].map(([rotulo, n]) => ({ rotulo, n, de: comFicha }));
    if (semRegistro) candidatos.push({ rotulo: 'Registro de reunião', n: semRegistro, de: numeros.ativos });
    const maisFalta = candidatos.sort((a, b) => b.n - a.n || (a.rotulo === 'Registro de reunião' ? -1 : 1))[0];
    const minuscula = (t) => (/^[A-ZÀ-Ú][a-zà-ú]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
    const partes = [
      !numeros.ativos ? '' : !porRisco.length ? `${plural(numeros.ativos, 'cliente ativo', 'clientes ativos')}, ainda sem nota de saúde.`
        : riscos.baixo ? `${riscos.baixo === 1 ? 'Um cliente está' : `${riscos.baixo} clientes estão`} em dia${porRisco.length > 1 ? ` e ${porRisco.slice(1).join(' e ')}` : ''}.`
        : `Nenhum cliente está em dia: ${porRisco.join(' e ')}.`,
      maisFalta ? `O que mais falta no cadastro é <b>${safeText(minuscula(maisFalta.rotulo))}</b>: ${maisFalta.n >= maisFalta.de ? `nenhum dos ${maisFalta.de} tem` : `${maisFalta.n} de ${maisFalta.de} não ${maisFalta.n === 1 ? 'tem' : 'têm'}`}.` : '',
      numeros.sem ? `E ${numeros.sem} ${numeros.sem === 1 ? 'está' : 'estão'} sem ficha.` : '',
    ].filter(Boolean);
    // Direção 3: a fala vira o bloco de ação laranja, numa frase curta (o risco da carteira está no cartão Ativos).
    const curta = [
      maisFalta ? `${maisFalta.n >= maisFalta.de ? `Nenhum dos ${maisFalta.de} tem` : `${maisFalta.n} de ${maisFalta.de} sem`} ${safeText(minuscula(maisFalta.rotulo))}.` : '',
      numeros.sem ? `${numeros.sem} ${numeros.sem === 1 ? 'está' : 'estão'} sem ficha.` : '',
    ].filter(Boolean).join(' ') || (partes.length ? partes[0] : '');
    const textoAviso = focado ? 'Só quem não tem reunião registrada.' : curta;
    const botaoAviso = semRegistro || focado ? (focado ? 'Ver todos' : 'Completar cadastros') : '';
    aviso.hidden = (!textoAviso && !focado) || visaoDeClientes() === 'sinapses';
    if (typeof d3AcaoHtml === 'function') {
      aviso.className = 'cli-aviso d3f-acao';
      aviso.innerHTML = aviso.hidden ? '' : d3AcaoHtml({ frase: `<small class="d3c-quem">Mateus · Atendimento</small>${textoAviso}`, agente: 'Mateus', botao: botaoAviso,
        attrs: `aria-pressed="${focado}" onclick="focarClientes('sem-registro')"` });
    } else {
      aviso.className = 'cli-aviso v2f-card v2f-fala';
      aviso.innerHTML = aviso.hidden ? '' : falaV2Html('Mateus · Atendimento ao cliente', focado ? 'Mostrando só quem não tem reunião registrada.' : partes.join(' '),
        botaoAviso ? `<button type="button" class="v2f-btn s cli-aviso-acao" aria-pressed="${focado}" onclick="focarClientes('sem-registro')">${botaoAviso}</button>` : '');
    }
  }
  // Direção 3 (quadro D3-GestaoClientes): o rótulo "Gestão" ao lado do título, em cinza, como a data do Hoje.
  const tituloClientes = document.querySelector('#clientes-hero h2');
  if (tituloClientes && !tituloClientes.nextElementSibling?.classList.contains('d3c-modo')) tituloClientes.insertAdjacentHTML('afterend', '<span class="d3c-modo">Gestão</span>');
  const acoes = document.getElementById('clientes-acoes');
  // Sem a classe antiga do cabeçalho (ela pinta de laranja o texto de todo botão dali); o id continua o mesmo.
  // Direção 3: "Novo cliente" é botão branco com o "+"; o único laranja cheio é o bloco de ação.
  if (acoes) acoes.className = 'v2f-topo-acoes';
  if (acoes) acoes.innerHTML = `<span class="clientes-visao" id="clientes-visao-topo"></span><button type="button" class="v2f-btn" onclick="openCadastrosStation()">Cadastros</button>${
    podeEditarClientes() ? '<button type="button" class="v2f-btn p d3f-novo" onclick="novoClienteNoPainel()">Novo cliente</button>' : ''}`;
  RECORTES_DE_CLIENTES = recortes;
  pintarFiltrosDeClientes(recortes);
  // "Conteúdos em aberto" e "Solicitações em aberto" sairam daqui: sao numeros
  // da operacao, e a operacao tem duas telas so dela. Nesta, cada numero tem de
  // ajudar a cuidar de um cliente.
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
  // No quadro, Tabela/Fichas/Cérebro ficam no cabeçalho, ao lado de Cadastros; o lugar antigo (na barra) fica vazio.
  // "v2f-seg-pill principal" tira o botão das regras gerais que pintam de preto todo botão selecionado: aqui a ligada é branca.
  const antigo = document.getElementById('clientes-visao');
  const alvo = document.getElementById('clientes-visao-topo') || antigo;
  if (!alvo) return;
  if (antigo && antigo !== alvo) { antigo.innerHTML = ''; antigo.hidden = true; }
  const atual = visaoDeClientes();
  alvo.className = 'clientes-visao v2f-seg';
  alvo.setAttribute('role', 'tablist');
  alvo.setAttribute('aria-label', 'Como ver os clientes');
  alvo.innerHTML = [['tabela', 'Tabela'], ['fichas', 'Fichas'], ['sinapses', 'Cérebro']].map(([id, rotulo]) =>
    `<button type="button" role="tab" aria-selected="${atual === id}" class="v2f-seg-pill principal${atual === id ? ' ativo' : ''}"${id === 'sinapses' ? ' title="Cérebro VYBES"' : ''}
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
const COLUNAS_OPCIONAIS_DE_CLIENTES = [['plano', 'Plano'], ['segmento', 'Segmento'], ['pedidos', 'Pedidos em aberto'], ['proxima_reuniao', 'Próxima reunião'],
  ['status', 'Status (ativo ou inativo)'], ['drive', 'Drive'], ['documento', 'Documento de acessos'], ['marcar', 'Selecionar vários (ações em lote)']];
const COLUNAS_PADRAO_DE_CLIENTES = { plano: false, segmento: false, pedidos: false, proxima_reuniao: false, status: false, drive: false, documento: false, marcar: false };
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
  const menu = (qual) => `<button type="button" class="v2f-chip" aria-haspopup="listbox" aria-pressed="${Boolean(FILTRO_CLIENTES[qual])}"
      onclick="escolherFiltroDeClientes('${qual}', this)">${rotuloDe(qual)}</button>`;
  const nomes = clientMasterRecords().map((r) => r.name).filter((n) => passaNosFiltrosDeClientes(n, { semBusca: true, semSituacao: true }));
  const quantos = (sit) => nomes.filter((n) => situacaoDaLinhaDeCliente(n) === sit).length;
  const situacao = (sit, rotulo) => `<button type="button" class="v2f-chip" aria-pressed="${FILTRO_CLIENTES.situacao === sit}"
      title="Mostrar só os ${rotulo.toLowerCase()}" onclick="alternarSituacaoDeClientes('${sit}')">${rotulo} <b>${quantos(sit)}</b></button>`;
  const outros = Boolean(FILTRO_CLIENTES.segmento) || FOCO_DE_CLIENTES !== 'todos' || ['sem', 'ignorados'].includes(FILTRO_CLIENTES.situacao);
  const ligados = [FILTRO_CLIENTES.segmento ? rotuloDe('segmento') : '', ...recortes.filter((k) => k.aceso).map((k) => safeText(k.label)),
    FILTRO_CLIENTES.situacao === 'sem' ? 'Só na operação' : FILTRO_CLIENTES.situacao === 'ignorados' ? 'Não são clientes' : ''].filter(Boolean);
  const filtros = `<button type="button" class="v2f-btn s" data-v2f-filtros aria-haspopup="listbox" aria-pressed="${outros}" title="Segmento, sem contato, detratores, painel a atualizar e quem está só na operação"
      onclick="abrirFiltrosDeClientes(this)">${outros ? `Filtros: ${ligados.join(', ')}` : 'Filtros'}</button>`;
  const colunas = `<button type="button" class="v2f-btn s" aria-haspopup="listbox" title="Escolher as colunas da tabela"
      onclick="escolherColunasDeClientes(this)">Colunas</button>`;
  alvo.innerHTML = situacao('ativos', 'Ativos') + situacao('inativos', 'Inativos') + menu('carteira') + menu('head') + filtros
    + (visaoDeClientes() === 'tabela' ? colunas : '');
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
function perguntarNoPainel({ titulo, texto = '', confirmar = 'Confirmar', perigo = false, campo = null, imagem = null, larga = false }) {
  const focoAnterior = document.activeElement;
  return new Promise((resolve) => {
    document.getElementById('cli-pergunta')?.remove();
    const fundo = document.createElement('div');
    fundo.id = 'cli-pergunta';
    fundo.className = 'cli-pergunta';
    fundo.innerHTML = `<div class="cli-pergunta-caixa${larga ? ' larga' : ''}" role="dialog" aria-modal="true" aria-labelledby="cli-pergunta-titulo">
        <h3 id="cli-pergunta-titulo">${safeText(titulo)}</h3>
        ${imagem ? `<figure class="cli-pergunta-previa"><img src="${safeText(imagem.url)}"
            alt="${safeText(imagem.nome || '')}"
            onerror="this.closest('figure')?.classList.add('sem-previa')">
          <figcaption>${safeText(imagem.nome || '')}</figcaption></figure>` : ''}
        ${texto ? `<p>${safeText(texto)}</p>` : ''}
        ${campo ? (campo.linhas
          // Corrigir uma atualizacao de tres linhas dentro de um campo de uma
          // linha e datilografar as cegas. Mesma caixa de pergunta, so que alta.
          ? `<textarea id="cli-pergunta-campo" rows="${Number(campo.linhas) || 5}"
              placeholder="${safeText(String(campo.dica || ''))}">${safeText(String(campo.valor || ''))}</textarea>`
          : `<input id="cli-pergunta-campo" type="text" value="${safeText(String(campo.valor || ''))}"
              placeholder="${safeText(String(campo.dica || ''))}">`) : ''}
        <div class="cli-pergunta-acoes">
          <button type="button" class="workflow-secondary" data-nao>Cancelar</button>
          <button type="button" class="workflow-primary${perigo ? ' perigo' : ''}" data-sim>${safeText(confirmar)}</button>
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
    fundo.querySelector('[data-nao]').onclick = () => fechar(campo ? null : false);
    fundo.querySelector('[data-sim]').onclick = dizerSim;
    fundo.onclick = (e) => { if (e.target === fundo) fechar(campo ? null : false); };
    document.addEventListener('keydown', tecla, true);
    document.body.append(fundo);
    setTimeout(() => { const alvo = entrada() || fundo.querySelector(perigo ? '[data-nao]' : '[data-sim]'); alvo?.focus(); entrada()?.select(); }, 30);
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
      onclick="escolherHeadDoCliente('${safeText(String(p.id))}')"
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
  const deck = document.createElement('div');
  deck.id = 'cli-deck';
  deck.className = 'grupos-lote';
  deck.innerHTML = `<span class="lote-conta"><b>${nomes.length}</b><small>${
      nomes.length === 1 ? 'marcado' : 'marcados'}</small></span>
    <span class="lote-risco" aria-hidden="true"></span>
    ${semFicha ? `<button type="button" class="lote-acao" onclick="loteCadastrarClientes()">Cadastrar ${semFicha}</button>` : ''}
    <button type="button" class="lote-acao" onclick="lotePainelDoCliente('Atualizado')">Painel atualizado</button>
    <button type="button" class="lote-acao" onclick="lotePainelDoCliente('Desatualizado')">Painel desatualizado</button>
    <button type="button" class="lote-acao" onclick="loteNaoEhCliente()">Não é cliente</button>
    <span class="lote-risco" aria-hidden="true"></span>
    <button type="button" class="lote-limpar" onclick="limparMarcadosDeClientes()"
      title="Desmarcar todos" aria-label="Desmarcar todos">✕</button>`;
  document.body.appendChild(deck);
}

// Cada cliente e uma gravacao, como no resto do painel: se uma falhar, as outras
// seguem, e a conta no fim diz quantas passaram.
async function emLoteDeClientes(rotulo, fazer) {
  const nomes = [...CLIENTES_MARCADOS];
  if (!nomes.length) return;
  const ok = await perguntarNoPainel({ titulo: `${rotulo} em ${nomes.length} cliente${nomes.length === 1 ? '' : 's'}?`,
    texto: 'A alteração vale para todos os marcados.', confirmar: 'Aplicar' });
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
function loteNaoEhCliente() {
  return emLoteDeClientes('Marcar como "não é cliente"', async (nome) => {
    const id = idDoCliente(nome);
    if (!id) throw new Error('sem cadastro');
    const r = await fetch('/api/painel?area=clientes', { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ acao:'ignorar', id }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'falhou');
  });
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
  return `<span class="cli-abertos">${parte(conteudos, 'conteúdo', 'conteúdos')}<i aria-hidden="true">·</i>${
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
  renderClientesLista(clientMasterRecords().map((record) => record.name));
}
function mostrarListaInteiraDeClientes(inteira = true) {
  LISTA_INTEIRA_DE_CLIENTES = inteira;
  renderClientesLista(clientMasterRecords().map((record) => record.name));
}
function linhaDeClienteHtml(nome, semCadastro, estado, mostrar = {}, saudeDe = saudesDaCarteira()) {
  const f = cadastroDoCliente(nome) || {};
  const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome) : {};
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const aspas = String(nome).replace(/'/g, "\\'");
  const idNoCadastro = semCadastro ? '' : idDoCliente(nome);
  const podeMexer = !semCadastro && podeEditarClientes();
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const vazio = '<span class="cli-vazio">—</span>';

  const segmento = String(f.segmento || ligado.segment || '').trim();
  const plano = String(f.plano || ligado.plan || '').trim();
  const heads = String(f.heads || ligado.head || '').split(',').map((n) => n.trim()).filter(Boolean);
  const s = semCadastro ? null : saudeDe(nome);
  const tom = tomDaSaudeV2(s);
  const { conteudos, pedidos } = abertosDoCliente(nome);
  const vencidos = vencidosDoCliente(nome).length;
  const c = semCadastro || typeof completudeDoCadastro !== 'function' ? null : completudeDoCadastro(f);
  const marcado = CLIENTES_MARCADOS.has(nome);
  const aberto = CLIENTES_ABERTOS_NA_LISTA.has(nome);

  // Colunas ligadas em "Colunas": as mesmas edições de antes, na célula.
  const editavel = (campo, dentro, titulo = 'Clique para editar') => (podeMexer
    ? `<span class="v2f-extra cli-editavel" title="${titulo}" onclick="editarCelulaDoCliente(event, '${aspas}', '${campo}')">${dentro}</span>`
    : `<span class="v2f-extra">${dentro}</span>`);
  const urlDrive = linkDeCliente(ligado.drive);
  const extras = [
    mostrar.plano ? editavel('plano', safeText(plano) || vazio) : '',
    mostrar.segmento ? (podeMexer ? `<span class="v2f-extra cli-editavel" title="Clique para escolher a etiqueta" onclick="abrirSegmentoDoCliente(event, '${aspas}')">${safeText(segmento) || vazio}</span>` : `<span class="v2f-extra">${safeText(segmento) || vazio}</span>`) : '',
    mostrar.pedidos ? `<span class="v2f-extra">${pedidos ? plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido'}</span>` : '',
    mostrar.proxima_reuniao ? editavel('proxima_reuniao', dataBr(f.proxima_reuniao || ligado.nextMeeting) || vazio) : '',
    mostrar.status ? `<span class="v2f-extra" onclick="event.stopPropagation()">${situacaoDoClienteHtml(nome, estado)}</span>` : '',
    mostrar.drive ? `<span class="v2f-extra" onclick="event.stopPropagation()">${urlDrive ? `<a class="v2f-link" href="${safeText(urlDrive)}" target="_blank" rel="noopener" title="${safeText(urlDrive)}">Abrir</a>`
      : podeMexer ? `<button type="button" class="v2f-link" onclick="editarAcessoDoCliente(event, '${aspas}', 'pasta_drive')">Colar o link</button>` : vazio}</span>` : '',
    mostrar.documento ? `<span class="v2f-extra" onclick="event.stopPropagation()">${ligado.acessoId || podeMexer
      ? `<button type="button" class="v2f-link" onclick="abrirDocumentoDoCliente('${safeText(String(ligado.acessoId || ''))}', '${aspas}', '${safeText(idNoCadastro)}')">${ligado.acessoId && ligado.doc ? 'Abrir' : 'Escrever'}</button>` : vazio}</span>` : '',
  ].join('');

  const caixa = mostrar.marcar && podeEditarClientes()
    ? `<input type="checkbox" class="v2f-marcar" ${marcado ? 'checked' : ''} aria-label="Marcar ${safeText(nome)}"
        onclick="event.stopPropagation();this.closest('.v2f-linha').classList.toggle('marcada',this.checked);alternarClienteMarcado('${aspas}',this.checked)">` : '';
  const situacaoHtml = estado !== 'ativos' && !mostrar.status ? `<span onclick="event.stopPropagation()">${situacaoDoClienteHtml(nome, estado)}</span>` : '';
  const cadastro = semCadastro ? '<span class="v2f-pill n">sem ficha</span>'
    : !c ? vazio
    : c.feitos === c.total ? '<span class="v2f-pill g">completo</span>'
    // Direção 3 (quadro D3-GestaoClientes): o cadastro é uma pílula clara com o que já está feito ("3 de 12").
    : `<span class="v2f-pill v2f-cad-n" title="Faltam: ${safeText(c.faltam.join(', '))}">${c.feitos} de ${c.total}</span>`;
  const emAberto = `${plural(conteudos, 'conteúdo', 'conteúdos')}${vencidos ? ` · <b class="v2f-ruim">${plural(vencidos, 'vencido', 'vencidos')}</b>` : ''}`;

  // O detalhe que abre no lugar.
  const feitos = c && typeof CADASTRO_DEF !== 'undefined' && CADASTRO_DEF
    ? CADASTRO_DEF.campos.filter((campo) => campo.obrigatorio && !c.faltam.includes(campo.rotulo)).map((campo) => campo.rotulo) : [];
  const itens = c ? [
      ...feitos.slice(0, 4).map((r) => `<span class="v2f-ck"><i class="v2f-cx ok">${V2F_CERTO}</i><span class="v2f-feito">${safeText(r)}</span></span>`),
      ...c.faltam.slice(0, 1).map((r) => `<span class="v2f-ck"><i class="v2f-cx"></i>${safeText(r)}</span>`),
      c.total - Math.min(4, feitos.length) - Math.min(1, c.faltam.length) > 0 ? `<span class="v2f-ck">+ ${c.total - Math.min(4, feitos.length) - Math.min(1, c.faltam.length)}</span>` : '',
    ].join('') : '';
  const botoes = semCadastro
    ? (podeEditarClientes() ? `<button type="button" class="v2f-btn s" onclick="cadastrarClienteDaOperacao('${aspas}')">Cadastrar</button>` : '')
    : (podeMexer ? `<button type="button" class="v2f-btn s" onclick="abrirFichaDeCliente('${aspas}')">Completar cadastro</button>` : '');
  const detalhe = `<div class="v2f-ficha"><div class="v2f-ficha-texto">
        <p><b>Saúde${tom ? ` ${Number(s.score)}` : ''}</b> · ${tom ? safeText((s.motivos || []).slice(0, 2).join(' · ') || 'sem nada puxando para baixo') : 'sem nota: cliente inativo ou sem peças para medir'}</p>
        <p><b>Em aberto</b> · ${plural(conteudos, 'conteúdo', 'conteúdos')}${vencidos ? `, ${vencidos} com a veiculação vencida` : ''} · ${pedidos ? plural(pedidos, 'pedido', 'pedidos') : 'nenhum pedido'}</p>
        <p class="v2f-cad"><b>Cadastro${c ? ` ${c.feitos} de ${c.total}` : ''}</b>${c ? itens : ' · sem ficha no cadastro'}</p>
      </div>${botoes}<button type="button" class="v2f-btn s k" onclick="abrirClienteDetalhe('${aspas}')">Abrir a ficha</button></div>`;

  return `<div class="v2-abre v2f-linha${marcado ? ' marcada' : ''}" data-cliente="${safeText(nome)}" aria-expanded="${aberto}">
    <div class="v2f-tr" onclick="alternarLinhaDeCliente(this.querySelector('.v2f-vai'))">
      <p class="v2f-c-nome cli-nome">${caixa}<span class="v2f-cli" style="--c:${corDoClienteV2(nome)}">${safeText(nome)}</span>${
        segmento || plano ? ` <span class="v2f-seg2">· ${safeText([segmento, plano].filter(Boolean).join(' · '))}</span>` : ''}${situacaoHtml}</p>
      <span class="v2f-hd" title="${safeText(heads.join(', '))}">${heads.length ? `<span class="v2f-av" aria-hidden="true">${safeText(iniciaisV2(heads[0]))}</span><span class="v2f-hd-nome">${safeText(heads.map(primeiroNomeV2).join(', '))}</span>` : '<span class="v2f-sub">Sem head</span>'}</span>
      ${tom ? `<div class="v2f-sa" title="Nota ${Number(s.score)} de 100"><b style="color:${tom.texto}">${Number(s.score)}</b><div class="v2-barra"><i style="--v:${Math.max(0, Math.min(100, Number(s.score)))}%;--c:${tom.barra}"></i></div></div>` : `<div class="v2f-sa">${vazio}</div>`}
      <span class="v2f-ab">${emAberto}</span>
      <span class="v2f-cd">${cadastro}</span>
      ${extras}
      <button type="button" class="v2f-vai" aria-expanded="${aberto}" aria-label="Abrir a linha de ${safeText(nome)}" onclick="event.stopPropagation();alternarLinhaDeCliente(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
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

function tabelaDeClientesHtml(clientes) {
  const nomeVale = (nome) => /[a-z0-9]/i.test(String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, ''));
  // O foco escolhido em Filtros (sem contato, sem registro, detratores, painel) recorta a lista inteira.
  const passaNoFoco = (nome) => {
    const f = cadastroDoCliente(nome) || {};
    if (FOCO_DE_CLIENTES === 'sem-contato') { const d = diasSemContato(f);
      return d !== null && d >= SEM_CONTATO_ATENCAO; }
    if (FOCO_DE_CLIENTES === 'sem-registro') return diasSemContato(f) === null;
    if (FOCO_DE_CLIENTES === 'detratores') return temNota(f.nps) && Number(f.nps) <= 6;
    if (FOCO_DE_CLIENTES === 'painel-velho') {
      const p = String(f.dashboard || '').trim();
      return Boolean(p) && !painelEstaEmDia(p);
    }
    return true;
  };
  const saudeDe = saudesDaCarteira(); // uma conta da carteira para a tabela inteira
  const lista = clientes.filter(nomeVale).filter((nome) => FOCO_DE_CLIENTES === 'todos' || passaNoFoco(nome));
  if (!lista.length) return '<div class="grupos-vazio v2f-card">Nenhum cliente com esses filtros. <button type="button" class="cli-limpar v2f-link" onclick="limparFiltrosDeClientes()">Limpar filtros</button></div>';

  // A ordem: quem precisa de você primeiro (a pior nota de saúde no alto); o título da coluna muda a ordem.
  const chave = {
    cliente: (n) => String(n).toLowerCase(),
    head: (n) => headsDoClienteNaLista(n).join(', ').toLowerCase() || '￿',
    saude: (n) => { const s = saudeDe(n); return s && Number.isFinite(Number(s.score)) ? Number(s.score) : 999; },
    abertos: (n) => -(vencidosDoCliente(n).length * 1000 + abertosDoCliente(n).conteudos),
    cadastro: (n) => { const c = typeof completudeDoCadastro === 'function' ? completudeDoCadastro(cadastroDoCliente(n)) : null; return c ? c.feitos / Math.max(1, c.total) : 2; },
  }[ORDEM_DE_CLIENTES.coluna] || ((n) => String(n).toLowerCase());
  const valores = new Map(lista.map((n) => [n, chave(n)]));
  const ordenada = [...lista].sort((a, b) => { const x = valores.get(a), y = valores.get(b);
    return ((typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) || String(a).localeCompare(String(b), 'pt-BR')) * ORDEM_DE_CLIENTES.sentido; });
  const semCorte = LISTA_INTEIRA_DE_CLIENTES || Boolean(FILTRO_CLIENTES.busca) || ordenada.length <= CLIENTES_NA_FRENTE + 1;
  const naFrente = semCorte ? ordenada : ordenada.slice(0, CLIENTES_NA_FRENTE);
  const resto = ordenada.length - naFrente.length;

  const cols = colunasDeClientes();
  const ROTULO_EXTRA = { plano: 'Plano', segmento: 'Segmento', pedidos: 'Pedidos', proxima_reuniao: 'Próx. reunião', status: 'Status', drive: 'Drive', documento: 'Documento' };
  const extras = Object.keys(ROTULO_EXTRA).filter((k) => cols[k]);
  const titulo = (coluna, rotulo, dica = '') => { const ativa = ORDEM_DE_CLIENTES.coluna === coluna;
    return `<button type="button" class="v2f-th-b v2f-h-${coluna}" ${dica ? `title="${dica}" ` : ''}aria-sort="${ativa ? (ORDEM_DE_CLIENTES.sentido > 0 ? 'ascending' : 'descending') : 'none'}" onclick="ordenarClientesPor('${coluna}')">${rotulo}${ativa ? `<i aria-hidden="true">${ORDEM_DE_CLIENTES.sentido > 0 ? '↑' : '↓'}</i>` : ''}</button>`; };
  const marcarTodos = cols.marcar && podeEditarClientes()
    ? `<input type="checkbox" class="v2f-marcar" aria-label="Marcar todos da lista" onclick="marcarBlocoDeClientes('', this.checked)">` : '';
  const ordemPadrao = ORDEM_DE_CLIENTES.coluna === 'saude' && ORDEM_DE_CLIENTES.sentido > 0;
  // Direção 3: o pé tem só o botão que conta o resto e quantos clientes cada carteira tem, sem frase explicativa
  // (a ordem continua no título de cada coluna; plano, segmento e pedidos em Colunas).
  const porCarteira = {};
  ordenada.forEach((n) => { const k = carteiraDaLinhaDeCliente(n); porCarteira[k] = (porCarteira[k] || 0) + 1; });
  const carteiras = Object.entries(porCarteira).filter(([k]) => k !== SEM_CARTEIRA).map(([k, q]) => `<span class="d3f-cart d3f-cart-${safeText(k)}">${safeText(ROTULO_DA_CARTEIRA[k] || k)} ${q}</span>`).join('');
  void ordemPadrao;
  const pe = `${resto > 0 ? `<button type="button" class="v2f-btn s d3f-mais" title="Quem precisa de você primeiro" onclick="mostrarListaInteiraDeClientes()">+${resto} ${resto === 1 ? 'cliente' : 'clientes'}</button>`
      : LISTA_INTEIRA_DE_CLIENTES && ordenada.length > CLIENTES_NA_FRENTE + 1 ? `<button type="button" class="v2f-btn s d3f-mais" onclick="mostrarListaInteiraDeClientes(false)">Mostrar menos</button>` : ''}<span class="d3f-espaco"></span>${carteiras}`;
  return `<section class="v2f-card v2f-tabela" aria-label="Clientes" style="--v2f-extras:${extras.map(() => '112px').join(' ')}">
      <div class="v2f-th">${`<span class="v2f-th-nome">${marcarTodos}${titulo('cliente', 'Cliente')}</span>`}${titulo('head', 'Head')}${titulo('saude', 'Saúde', 'Nota de 0 a 100 da Saúde da carteira')}${titulo('abertos', 'Em aberto')}${titulo('cadastro', 'Cadastro', 'Itens essenciais do cadastro preenchidos')}${
        extras.map((k) => `<span class="v2f-h-extra">${ROTULO_EXTRA[k]}</span>`).join('')}<span></span></div>
      ${naFrente.map((n) => { const estado = situacaoDaLinhaDeCliente(n); return linhaDeClienteHtml(n, estado === 'sem', estado, cols, saudeDe); }).join('')}
      <div class="v2f-pe d3f-pe">${pe}</div>
    </section>`;
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
  const visao = visaoDeClientes();
  // Os filtros e a busca recortam a tabela e as fichas; o Cérebro mostra o mapa inteiro e esconde os dois.
  const noCerebro = visao === 'sinapses' && typeof renderCerebroVybesHtml === 'function';
  document.querySelectorAll('#clientes-filtros, #panel-clientes-lista .cli-busca').forEach((el) => { el.hidden = noCerebro; });
  if (!noCerebro) clientes = clientes.filter(passaNosFiltrosDeClientes);
  if (noCerebro) {
    grid.classList.remove('em-tabela');
    grid.classList.add('em-sinapses');
    grid.innerHTML = renderCerebroVybesHtml();
    if (typeof montarMapaCerebro === 'function') montarMapaCerebro(); else if (typeof iniciarMotorCanvasCerebro === 'function') iniciarMotorCanvasCerebro();
    return;
  }
  grid.classList.remove('em-sinapses');
  if (visao === 'tabela') {
    grid.classList.add('em-tabela');
    grid.innerHTML = tabelaDeClientesHtml(clientes);
    pintarDeckDeClientes();
    return;
  }
  grid.classList.remove('em-tabela');
  if (!clientes.length) { grid.innerHTML = '<div class="grupos-vazio">Nenhum cliente com esses filtros. <button type="button" class="cli-limpar" onclick="limparFiltrosDeClientes()">Limpar filtros</button></div>'; return; }
  const registros = clientMasterRecords();
  grid.innerHTML = clientes.map(cli => {
    const record=registros.find(item=>item.name===cli) || {content:[],requests:[]};
    const nProd = record.content.filter(d => d.status !== 'Finalizado' && d.status !== 'finalizado').length;
    const STATUS_CONCLUIDO = ['Feito','Finalizado','feito','finalizado','Concluídas'];
    const demandasAtivas = record.requests.filter(d => !STATUS_CONCLUIDO.includes(d.status));
    const nDem  = demandasAtivas.length;
    const atrasadas = demandasAtivas.filter(d => d.prazo_atrasado).length;
    const alertCls = atrasadas > 0 ? 'alert-low' : nProd > 0 ? 'alert-ok' : 'alert-empty';
    // Ficha em cartão (Paulo, 08/11/2026: "tem painel que ainda tá uma merda"): o nome na cor da carteira e os números
    // com o que são (antes: nome cru e dois números soltos).
    return `<div class="client-card cli-ficha-card ${alertCls}" role="button" tabindex="0" onclick="abrirClienteDetalhe('${cli.replace(/'/g,"\\'")}')" onkeydown="if(event.key==='Enter')this.click()">
      <div class="client-header">
        <div class="client-name">${typeof cliCor === 'function' ? cliCor(cli) : safeText(cli)}</div>
      </div>
      <div class="cli-ficha-nums"><span><b>${nProd}</b> conteúdos abertos</span><span class="${atrasadas ? 'ruim' : ''}"><b>${atrasadas}</b> atrasada${atrasadas === 1 ? '' : 's'}</span><span><b>${nDem}</b> solicitaç${nDem === 1 ? 'ão' : 'ões'}</span></div>
      ${fichaClienteHtml(cli)}
    </div>`;
  }).join('');
}

// A busca entra nos filtros da lista: recarregar o quadro (um cadastro salvo, um filtro novo) não a perde mais.
function filterClientesList(query) {
  FILTRO_CLIENTES.busca = String(query || '').trim();
  renderClientesLista(clientMasterRecords().map((record) => record.name));
}

// Os numeros do topo sao da LISTA — 71 clientes, 1668 conteudos. Com um cliente
// aberto eles nao respondem nada e ainda empurram a ficha dele para baixo da
// dobra. Somem enquanto se olha um cliente, e voltam no "Voltar".
function numerosDaListaDeClientes(mostrar) {
  ['clientes-hero', 'client-master-kpis', 'client-master-source-rail', 'kpi-grid-clientes', 'clientes-aviso']
    .forEach((id) => { const el = document.getElementById(id); if (!el) return;
      // O cabeçalho da lista usa hidden (vybe-padrao.css força display:flex nele); os outros, o display.
      if (id === 'clientes-hero') el.hidden = !mostrar; else el.style.display = mostrar ? '' : 'none'; });
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
  const record = clientMasterRecords().find((item) => item.name === cli) || { content: [], requests: [] };
  const CONCLUIDO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const emAberto = (lista) => lista.filter((d) => !CONCLUIDO.includes(String(d.status || '')));

  const conteudos = emAberto(record.content);
  const gridProd = document.getElementById('grid-cliente-producao');
  if (gridProd) {
    gridProd.innerHTML = conteudos.length
      ? tabelaOperacionalHtml(conteudos, 'producao', { compacta: true })
      : '<div class="grupos-vazio">Nenhum conteúdo em aberto.</div>';
  }

  // A lista crua de Solicitacoes fala outro idioma; o normalizador e o mesmo
  // que a tabela de grupos usa.
  const solicitacoes = emAberto(record.requests)
    .map((d) => (typeof normalizeRequestForOperational === 'function' ? normalizeRequestForOperational(d) : d));
  const gridDem = document.getElementById('grid-cliente-demandas');
  if (gridDem) {
    gridDem.innerHTML = solicitacoes.length
      ? tabelaOperacionalHtml(solicitacoes, 'demandas', { compacta: true })
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
