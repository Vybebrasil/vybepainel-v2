// vybe-risco.js — radar de risco e SLA operacional
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
function getTomorrowIso() { const dt = new Date((HOJE_ISO || new Date().toISOString().slice(0,10)) + 'T12:00:00'); dt.setDate(dt.getDate()+1); return dt.toISOString().slice(0,10); }

// ─── Radar de Risco e SLA operacional ────────────────────────────────────────
const RISK_READY_STATUSES = new Set(['Finalizado','Feito','Para agendar','Agendado']);
const SLA_STATUS_HOURS = Object.freeze({
  'Para aprovação': 24,
  'Ag. Aprovação Cliente': 24,
  'Ag. Interno': 24,
  'Falta Info': 24,
  'Ag. Info Cliente': 24,
  'Aguardo': 24,
  'Alteração': 24,
  'Falta D.A': 24,
  'Agendando Cap': 24,
  'Cap. Agendada': 48,
  'Falta OFF': 24,
  'Aguardo Redação': 24,
  'Segurar Post': 72
});
function riskStatusEvent(d) {
  const events = window.ACTIVITY_LOGS?.statusEvents?.[String(d.id)] || [];
  for (let i = events.length - 1; i >= 0; i--) if (events[i].status === d.status) return events[i];
  return null;
}
function formatRiskDuration(hours) {
  if (!Number.isFinite(hours) || hours < 0) return '';
  if (hours < 24) return `${Math.max(1,Math.floor(hours))}h na etapa`;
  const days = Math.floor(hours / 24), rest = Math.floor(hours % 24);
  return `${days}d${rest ? ` ${rest}h` : ''} na etapa`;
}
function getOperationalRisk(d) {
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const tomorrow = getTomorrowIso();
  const due = getReferenceDate(d);
  const flowStatus = operationalFlowStatus(d);
  if (RISK_READY_STATUSES.has(flowStatus)) return { level:'safe', label:'Pronto', score:99, reason:'Etapa concluída para a operação', sla_label:'' };
  const event = riskStatusEvent(d);
  const hoursInStatus = event ? Math.max(0, (Date.now() - Number(event.tsMs || 0)) / 3600000) : null;
  const slaHours = SLA_STATUS_HOURS[flowStatus] || 0;
  const isBlocked = Boolean(slaHours);
  const slaLabel = isBlocked && hoursInStatus !== null ? formatRiskDuration(hoursInStatus) : '';
  const slaBreached = isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours;
  const slaCritical = isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours * 2;
  if (due && due < today) return { level:'critical', label:'Prazo vencido', score:0, reason:isBlocked ? 'Prazo vencido e dependência sem resolução' : 'Prazo de entrega vencido', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (slaCritical) return { level:'critical', label:'SLA estourado', score:1, reason:`${flowStatus} excedeu ${Math.round(hoursInStatus)}h`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (due === today && !RISK_READY_STATUSES.has(flowStatus)) return { level:'high', label:'Prazo hoje', score:2, reason:isBlocked ? 'Depende de resolução ainda hoje' : 'Precisa avançar hoje', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (slaBreached) return { level:'high', label:'SLA vencido', score:3, reason:`${flowStatus} ultrapassou o SLA de ${slaHours}h`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (due === tomorrow && ['A Fazer','Pode Fazer','Falta D.A','Falta Info','Aguardo','Alteração'].includes(flowStatus)) return { level:'attention', label:'Prazo amanhã', score:4, reason:'Ainda precisa avançar antes do próximo prazo', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  if (isBlocked && hoursInStatus !== null && hoursInStatus >= slaHours * .5) return { level:'attention', label:'SLA em curso', score:5, reason:`${flowStatus} já consumiu metade do SLA`, sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
  return { level:'safe', label:'No prazo', score:99, reason:'Sem sinal crítico nas regras atuais', sla_label:slaLabel, hours_in_status:hoursInStatus, sla_hours:slaHours };
}
function applyOperationalRisk(items) {
  (items || []).forEach(d => { d.operational_risk = getOperationalRisk(d); });
  return items;
}

// Toda sinalização crítica passa a indicar quem tem a próxima ação de destrava.
function riskActionOwner(d) {
  const status = String(d?.status || '');
  const requester = String(d?.status_context?.requester || '').trim();
  const responsible = (assignedIds(d).map(id => TEAM_USERS.find(u => String(u.id) === String(id))).filter(Boolean)[0]?.name || String(d?.responsavel || '')).trim();
  if (!assignedIds(d).length) return { owner:'Operação', source:'cadastro', action:'atribuir um responsável antes de seguir' };
  if (['Falta Info','Ag. Info Cliente','Aguardo','Ag. Aprovação Cliente'].includes(status)) return { owner:requester || 'Atendimento / Cliente', source:'cliente', action:'cobrar o retorno ou material pendente' };
  if (status === 'Falta D.A') return { owner:'Deivid · D.A.', source:'direção', action:'definir a direção visual necessária' };
  if (status === 'Alteração') return { owner:requester || responsible || 'Responsável atual', source:'revisão', action:'alinhar o ajuste e devolver o próximo passo' };
  if (status === 'Ag. Interno') return { owner:requester || 'Operação', source:'interno', action:'definir quem valida e liberar a próxima etapa' };
  if (status === 'Em andamento') return { owner:responsible || 'Responsável atual', source:'execução', action:'registrar avanço ou sinalizar uma trava' };
  return { owner:responsible || 'Responsável atual', source:'execução', action:'confirmar início e proteger o prazo' };
}
function riskSeverityLabel(d) {
  const risk = d?.operational_risk || getOperationalRisk(d || {});
  if (risk.level === 'critical') return 'ESCALAÇÃO';
  if (risk.level === 'high') return 'AÇÃO HOJE';
  if (risk.level === 'attention') return 'ATENÇÃO';
  return 'INFORMATIVO';
}
function riskActionHtml(d, compact=false) {
  const next = riskActionOwner(d);
  return `<span class="risk-action-owner ${compact ? 'compact' : ''}" title="Próxima ação: ${safeText(next.action)}"><b>${safeText(riskSeverityLabel(d))}</b><span>→ ${safeText(next.owner)}</span></span>`;
}
function riskBadgeHtml(d, compact=false) {
  const risk = d?.operational_risk || getOperationalRisk(d || {});
  if (!risk || risk.level === 'safe') return '';
  const label = compact ? risk.label.replace('Prazo ','') : risk.label;
  return `<span class="risk-level ${risk.level}" title="${safeText(risk.reason || risk.label)}">${risk.level === 'critical' ? '⚑' : risk.level === 'high' ? '!' : '◌'} ${safeText(label)}</span>`;
}
function priorityData(d) {
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const tomorrow = getTomorrowIso();
  const due = getReferenceDate(d);
  const statusWeight = {'Falta Info':0,'Alteração':0,'Falta D.A':1,'A Fazer':2,'Pode Fazer':3,'Aguardo':4,'Para aprovação':5,'Ag. Aprovação Cliente':5,'Para agendar':6,'Agendado':7};
  let dateWeight = 3;
  if (due && due < today) dateWeight = 0;
  else if (due === today) dateWeight = 1;
  else if (due === tomorrow) dateWeight = 2;
  return { score: dateWeight * 10 + (statusWeight[d.status] ?? 8), dateWeight, due };
}
function priorityColor(d) {
  const p = priorityData(d);
  if (p.dateWeight === 0 || ['Falta Info','Alteração'].includes(d.status)) return '#ff4d6d';
  if (p.dateWeight <= 2 || ['Falta D.A','A Fazer'].includes(d.status)) return '#ffe600';
  if (['Para agendar','Agendado'].includes(d.status)) return '#00ff88';
  return '#ff6b00';
}

// No Modo Foco, prazo é a referência de trabalho. Tainara opera por veiculação/publicação.
const TAINARA_USER_ID = PESSOAS.TAINARA;
function focusUsesVeiculacao(user) { return String(user?.id || '') === TAINARA_USER_ID; }
function focusReferenceDate(d, user=focusUser()) { return focusUsesVeiculacao(user) ? (d.veiculacao_iso || '') : (d.prazo_iso || ''); }
function focusReferenceLabel(d, user=focusUser()) { return focusUsesVeiculacao(user) ? (d.veiculacao || 'Sem veiculação') : (d.prazo || 'Sem prazo'); }
function focusSort(items, user) {
  return [...items].sort((a,b) => {
    const da = focusReferenceDate(a,user) || '9999-12-31';
    const db = focusReferenceDate(b,user) || '9999-12-31';
    return da.localeCompare(db) || safeText(a.cliente).localeCompare(safeText(b.cliente));
  });
}
function focusStatusExplanation(status) {
  const map = {
    'Em andamento':'Em execução por você',
    'Pode Fazer':'Pronto para você executar',
    'A Fazer':'Conteúdo ainda não iniciado',
    'Para aprovação':'Entregue por você; aguardando aprovação',
    'Ag. Aprovação Cliente':'Entregue; aguardando aprovação do cliente',
    'Ag. Interno':'Entregue; aguardando retorno interno',
    'Falta Info':'Aguardando informação ou material',
    'Ag. Info Cliente':'Aguardando informação do cliente',
    'Aguardo':'Aguardando retorno para seguir',
    'Falta D.A':'Aguardando Direção de Arte',
    'Cap. Agendada':'Captação já está agendada',
    'Agendando Cap':'Captação ainda está sendo organizada',
    'Falta OFF':'Aguardando a etapa OFF',
    'Aguardo Redação':'Aguardando redação',
    'Segurar Post':'Publicação pausada',
    'Para agendar':'Pronto para agendar',
    'Agendado':'Já agendado'
  };
  return map[status] || '';
}
function focusTaskTone(status) {
  if (status === 'Em andamento' || status === 'Em execução') return '#ff6b00';
  if (['Pode Fazer','A Fazer'].includes(status)) return '#ffbd2e';
  if (['Para aprovação','Ag. Aprovação Cliente','Ag. Interno'].includes(status)) return '#579bfc';
  if (['Falta Info','Ag. Info Cliente','Aguardo','Aguardo Redação','Falta OFF'].includes(status)) return '#9d50dd';
  if (['Falta D.A','Cap. Agendada','Agendando Cap','Segurar Post'].includes(status)) return '#ff4d6d';
  return '#a58c79';
}
function focusStatusButtonHtml(d) {
  return `<button type="button" class="focus-status-btn" onclick="openStatusEditor(event,'${d.id}')" title="Atualizar status no Vybe OS">${pillHtml(d.status,d.status_color,d.status_border)}</button>`;
}
function operationalOriginTag(item={}) { const request=isRequestItem(item); return `<span class="operational-origin-tag ${request?'request':'content'}" title="Origem operacional: ${request?'Solicitação de Demandas':'Produção de Conteúdo'}">${request?'SOLICITAÇÃO':'CONTEÚDO'}</span>`; }
// AS DUAS DATAS, COM NOME.
//
// A linha mostrava uma data so, nua. E nao era sempre a mesma: a fila usa prazo
// para quase todo mundo e veiculacao para quem trabalha por data de publicacao —
// entao a mesma tela mostrava coisas diferentes para pessoas diferentes, sem
// dizer qual. Quem olha nao tem como saber se aquele 31/08 e o dia de entregar
// ou o dia de ir ao ar.
//
// Agora aparecem as duas, cada uma com o proprio nome, e a que MANDA na fila
// daquela pessoa fica em destaque. Em solicitacao a segunda data chama
// "Conclusao"; em conteudo, "Veiculacao" — o mesmo vocabulario da tabela.
function focusDatasHtml(d, user = focusUser()) {
  const ehPedido = typeof isRequestItem === 'function' && isRequestItem(d);
  const porVeiculacao = focusUsesVeiculacao(user);
  const nomeDaSegunda = ehPedido ? 'Conclusão' : 'Veiculação';
  const dia = (iso, texto) => {
    const bruto = String(texto || '').trim();
    if (bruto) return bruto;
    const limpo = String(iso || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? limpo.split('-').reverse().join('/') : '';
  };
  const prazo = dia(d.prazo_iso, d.prazo);
  const segunda = dia(d.veiculacao_iso, d.veiculacao);
  const atrasado = d.prazo_iso && d.prazo_iso < (HOJE_ISO || '');
  const marca = (rotulo, valor, manda, alerta) => valor
    ? `<span class="focus-data ${manda ? 'manda' : ''} ${alerta ? 'atrasada' : ''}"><b>${rotulo}</b>${safeText(valor)}</span>`
    : '';
  // Duas datas iguais nao sao duas informacoes. "PRAZO 01/09 VEICULAÇÃO 01/09"
  // ocupa o dobro do espaco para dizer uma coisa so — e a linha inteira fica
  // parecendo cheia de numero. Quando coincidem, aparece uma, com os dois nomes.
  const mesmaData = prazo && segunda && prazo === segunda;
  const partes = mesmaData
    ? [marca(`Prazo e ${nomeDaSegunda.toLowerCase()}`, prazo, true, atrasado)]
    : [
        marca('Prazo', prazo, !porVeiculacao, atrasado),
        marca(nomeDaSegunda, segunda, porVeiculacao, false),
      ].filter(Boolean);
  if (!partes.length) return '<span class="focus-data vazia">sem data</span>';
  return `<span class="focus-datas">${partes.join('')}</span>`;
}

// AS DATAS SAO O BOTAO DE EDITAR AS DATAS.
//
// Havia um glifo de relogio solto em cada linha, ao lado delas, sem rotulo
// visivel — nove pontinhos misteriosos numa tela de nove linhas, e o rotulo so
// aparecia parando o mouse em cima. Ele abria o editor de prazo e veiculacao,
// que e exatamente o que as datas ao lado dizem. Entao sao elas que abrem.
// ─── ENTREGAR DA PRÓPRIA LINHA ───────────────────────────────────────────────
//
// Entregar exigia abrir a peca inteira, rolar ate "Entregar" e so entao
// escolher entre arquivo e link. Para quem acabou de exportar um card, isso e
// tres passos antes do primeiro passo.
//
// O botao na linha abre as MESMAS duas saidas da gaveta — arquivo pronto ou
// link do material — chamando as mesmas funcoes de entrega, agora que elas
// sabem de qual peca se trata.
// PECA JA ENTREGUE NAO PEDE ENTREGA, PEDE CONFERENCIA.
//
// Paulo: "o que ja ta no azul, para aprovacao, no lugar do botao de entrega,
// nao devia aparecer um ver previa? pq ja tem material". Exato — oferecer
// "Entregar" a quem ja entregou convida a mandar de novo por engano.
//
// Nestes estados o material ja saiu da mao de quem produz: a linha mostra
// "Previa", e trocar o arquivo continua possivel de dentro dela.
const STATUS_JA_ENTREGUE = new Set(['para aprovação','para aprovacao','em aprovação','em aprovacao',
  'aguardando aprovação','aguardando aprovacao','ag. aprovação cliente','ag. interno','aprovado',
  'para agendar','agendado','finalizado','feito']);
// O OLHO DA PREVIA NUMA LINHA DE LISTA.
//
// O cartao da mesa ja tinha este botao; as listas por dia, nao — e e nelas que
// se confere o que foi entregue no dia. E o MESMO botao: mesma funcao, mesma
// previa, mesmo comportamento quando nao ha arquivo. Uma segunda versao
// divergiria da primeira no primeiro conserto.
//
// A linha nao sabe se existe arquivo, so o status. Por isso o destino de quem
// clica sem material nao e um beco: abre o link se houver, e abre a caixa de
// entrega se nao houver nada.
function botaoDePreviaNaLinha(item, classe = 'linha-previa') {
  if (!item || !jaTemMaterial(item)) return '';
  return `<button type="button" class="${classe}"
    onclick="event.stopPropagation();abrirPreviaDaEntrega('${safeText(String(item.id))}',this)"
    title="Ver o material entregue" aria-label="Ver prévia de ${safeText(item.nome || 'atividade')}">👁</button>`;
}

function jaTemMaterial(item) {
  return STATUS_JA_ENTREGUE.has(normalizedWorkflowStatus(operationalFlowStatus(item)));
}
async function abrirPreviaDaEntrega(itemId, gatilho) {
  if (gatilho) { gatilho.disabled = true; gatilho.classList.add('carregando'); }
  let detail = null;
  try { detail = await fetchWorkspaceItem(itemId); }
  catch (erro) { showToast(`Não foi possível abrir a prévia: ${erro.message}`, 'err', 7000); return; }
  finally { if (gatilho) { gatilho.disabled = false; gatilho.classList.remove('carregando'); } }
  const artes = statusContextPreviewAssets(detail) || [];
  if (artes.length) {
    PREVIA_MATERIAL = artes;
    PREVIA_DA_PECA = String(itemId);
    return abrirPreviaGrande(0);
  }
  // Sem imagem, pode haver link — e o link e material tanto quanto o arquivo.
  const entrega = typeof workspaceDeliveryInfo === 'function' ? workspaceDeliveryInfo(detail) : null;
  if (entrega?.url) {
    showToast('O material desta atividade é um link. Abrindo…', 'info', 4000);
    window.open(entrega.url, '_blank', 'noopener');
    return;
  }
  // O status diz que foi entregue e nao ha material: isso e um aviso, nao um
  // beco — a entrega abre logo em seguida.
  showToast('Esta atividade está marcada como entregue, mas não há arquivo nem link registrado.', 'info', 7000);
  abrirEntregaRapida(itemId, { currentTarget: gatilho, stopPropagation() {} });
}

function fecharEntregaRapida() {
  document.getElementById('entrega-rapida-backdrop')?.remove();
  document.getElementById('entrega-rapida')?.remove();
}
function abrirEntregaRapida(itemId, event) {
  event?.stopPropagation?.();
  fecharEntregaRapida();
  const rect = (event?.currentTarget || event?.target)?.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'entrega-rapida-backdrop'; fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharEntregaRapida;
  const menu = document.createElement('div');
  menu.id = 'entrega-rapida'; menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">Entregar</div>
    <button type="button" class="status-editor-option" onclick="escolherArquivoDaEntrega('${safeText(String(itemId))}')">
      <span class="status-editor-dot" style="background:#3de8a2;color:#3de8a2"></span>
      <span>Enviar arquivo <small>card, arte ou PDF</small></span></button>
    <button type="button" class="status-editor-option" onclick="colarLinkDaEntrega('${safeText(String(itemId))}')">
      <span class="status-editor-dot" style="background:#579bfc;color:#579bfc"></span>
      <span>Colar link <small>vídeo, ou arquivo grande demais</small></span></button>`;
  document.body.append(fundo, menu);
  if (rect) ancorarPopover(menu, rect);
}
function escolherArquivoDaEntrega(itemId) {
  fecharEntregaRapida();
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true;
  input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
  input.onchange = () => uploadWorkspaceFile(input, itemId);
  input.click();
}
async function colarLinkDaEntrega(itemId) {
  fecharEntregaRapida();
  const url = await perguntarNoPainel({
    titulo: 'Link do material',
    texto: 'Cole o link do Drive, Frame.io ou Canva. Ele fica no histórico da atividade, com quem registrou e quando.',
    campo: { valor: '', dica: 'https://…' },
    confirmar: 'Registrar link' });
  if (url) await registrarLinkDeEntrega(url, itemId);
}

function datasEditaveisHtml(d, user) {
  const gap = goldenDeadlineGap(d?.prazo_iso, d?.veiculacao_iso);
  const risco = gap !== null && gap < PRAZO_OURO_DIAS;
  const titulo = `Editar prazo e veiculação · Prazo de Ouro: ${PRAZO_OURO_DIAS} dias antes da veiculação${gap === null ? '' : ` · atual: ${gap} dias`}`;
  return `<button type="button" class="focus-task-datas ${risco ? 'gold-risk' : ''}"
    onclick="event.stopPropagation();openPlanningEditor('${d.id}')"
    title="${safeText(titulo)}" aria-label="${safeText(titulo)}">${focusDatasHtml(d, user)}</button>`;
}
function focusTaskHtml(d, contextText='', opcoes={}) {
  const user = focusUser();
  const deadline = focusReferenceDate(d, user);
  const dateLabel = focusReferenceLabel(d, user);
  const flowStatus = operationalFlowStatus(d);
  const color = focusTaskTone(flowStatus);
  const late = deadline && deadline < (HOJE_ISO || '');
  const risk = d.operational_risk || getOperationalRisk(d);
  const isRunning = flowStatus === 'Em andamento';
    const timerHtml = isRunning && d.status_updated_at ? `<span class="live-timer" data-start="${d.status_updated_at}" style="margin-left:8px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.06);color:#a6f8ff;font:700 11px var(--mac-mono, monospace);letter-spacing:1px;border:1px solid rgba(0,240,255,0.2);display:inline-block;vertical-align:middle;">00:00:00</span>` : '';
    // O texto de contexto e do GRUPO — 'Pronto para voce executar' aparecia
    // igual nas cinco linhas. Fica so na primeira, como quem diz a regra uma
    // vez; nas outras sobra o que de fato muda.
    const baseMeta = [late ? '⚠️ Atrasado' : '', risk.sla_label || ''].filter(Boolean).join(' • ');
    // As duas datas saem do meio da frase e viram coluna propria, encostada na
    // direita. Medindo a linha antes: o titulo tinha 379px e esta faixa de apoio
    // 475 — o secundario com mais espaco que o principal, e os numeros mudando
    // de lugar a cada linha conforme o texto ao lado fosse maior ou menor.
    const finalMetaHtml = safeText(baseMeta) + timerHtml;
  return `<div class="focus-task ${opcoes.primeira ? 'primeira' : ''}" style="--priority-color:${color}">
    <span class="focus-task-priority"></span>
    <div class="focus-task-title"><div class="focus-task-name">${d.cliente ? `<span class="focus-task-client" title="Cliente: ${safeText(d.cliente)}">${safeText(d.cliente)}</span>` : ''}<button type="button" class="focus-task-open" onclick="openItemWorkspace('${d.id}')">${safeText(d.nome)}</button>${opcoes.origemVaria === false ? '' : operationalOriginTag(d)}${opcoes.riscoVaria === false ? '' : (riskBadgeHtml(d,true) ? `<span class="focus-risk">${riskBadgeHtml(d,true)}</span>` : '')}</div></div>
    <div class="focus-task-meta">${finalMetaHtml}</div>
    ${datasEditaveisHtml(d, user)}
    <div style="display:flex;align-items:center;gap:7px;justify-content:flex-end;"><button type="button" class="focus-brief-btn" onclick="event.stopPropagation();abrirBriefing('${safeText(String(d.id))}',this)" title="Ler o briefing desta atividade sem abrir a peça" aria-label="Ver briefing">📄<span>Briefing</span></button>${botaoDeMaterialBrutoHtml(d)}${jaTemMaterial(d)
      ? `<button type="button" class="focus-brief-btn previa" onclick="event.stopPropagation();abrirPreviaDaEntrega('${safeText(String(d.id))}',this)" title="Ver o material entregue · dá para trocar por dentro" aria-label="Ver prévia">👁<span>Prévia</span></button>`
      : `<button type="button" class="focus-brief-btn entregar" onclick="abrirEntregaRapida('${safeText(String(d.id))}',event)" title="Enviar o arquivo pronto ou colar o link do material" aria-label="Entregar">⤓<span>Entregar</span></button>`}${opcoes.donoVaria === false ? '' : ownerEditorTrigger(d,'focus-owner-trigger')}${focusStatusButtonHtml(d)}</div>
  </div>`;
}

const outboundItemPatchQueue = new Map();
function outboundPatchFields(patch={}) { return Object.entries(patch).filter(([,value])=>value!==undefined && value!==null); }
// O vermelho da data sai de item.prazo_atrasado, que era calculado UMA vez, na
// leitura dos dados, e nunca mais. Mudar o prazo de 31/08 para 06/09 gravava a
// data nova e deixava o atraso antigo: a peca ficava vermelha com prazo no
// futuro. Vale para o caminho contrario tambem — finalizar uma peca vencida
// tinha de tirar o vermelho, e nao tirava.
//
// Aqui e o funil por onde toda mudanca de peca passa, entao e aqui que a conta
// se refaz, e nao em cada tela que mostra data.
// "Hoje" aqui NAO pode ser o HOJE_ISO: ele vem do META, o META vem do cache, e
// um painel aberto desde ontem carrega a data de ontem — o cabecalho do Paulo
// mostrava "Hoje: 22/08" com o relogio em 03/09. Para responder "esse prazo
// venceu?" a verdade e o relogio.
//
// E a data sai dos campos locais, nao de toISOString: em Irece (UTC-3) o
// toISOString depois das 21h ja devolve o dia seguinte, e uma peca que vence
// hoje apareceria vencida a noite.
function hojeDeVerdade() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function recalcularAtrasoDoItem(item) {
  const hoje = hojeDeVerdade();
  const prazo = String(item?.prazo_iso || '');
  const fechada = typeof isFinishedItem === 'function' ? isFinishedItem(item) : false;
  item.prazo_atrasado = !!(prazo && prazo < hoje && !fechada);
}

function applyOutboundItemPatch(itemId, patch={}, label='alteração', options={}) {
  const renderizar=options?.render!==false;
  if (patch.status && !patch.status_updated_at) patch.status_updated_at = new Date().toISOString(); const key=String(itemId); const now=new Date().toISOString(); const fields=outboundPatchFields(patch);
  [DADOS,DADOS_ALL].forEach(list=>(list||[]).forEach(item=>{
    if(String(item.id)!==key) return;
    fields.forEach(([field,value])=>{ item[field]=Array.isArray(value)?[...value]:value; });
    if(patch.prazo_iso) item.prazo=planningDateBr(patch.prazo_iso);
    if(patch.veiculacao_iso) item.veiculacao=planningDateBr(patch.veiculacao_iso);
    item.updated_at=now;
    recalcularAtrasoDoItem(item);
    item.operational_risk=getOperationalRisk(item);
  }));
  // Em lote, guardar o cache a cada peca serializa a base inteira no navegador
  // uma vez por item — com sessenta prazos isso e sessenta gravacoes de tudo, e
  // era o que fazia a barra de progresso andar de dois em dois. Quem chama em
  // lote guarda UMA vez no fim.
  if(options?.cache!==false) saveProductionCache();
  if(renderizar) renderOutboundItemPatch(label);
  queueOutboundItemReconciliation(key,patch,label);
}
function renderOutboundItemPatch(label='alteração') {
  const previousScroll=window.scrollY;
  // A ficha do cliente mostra as mesmas atividades, na mesma tabela: mudar o
  // status de uma peca por la tem de repintar a ficha, senao a linha continua
  // dizendo o valor antigo ate alguem sair e voltar.
  if(typeof redesenharListasDoCliente==='function') redesenharListasDoCliente();
  renderCompactSummary(); renderOperationalTools(); renderIdentityOperationalPulse();
  if(panelMode==='foco') renderFocusDashboard();
  else if(panelMode==='controler') renderDaController();
  else { renderKPIs(); for(let n=1;n<=(META?.weeks?.length||0);n++) renderWeek(n,currentFilter,currentDayFilter); renderManagerIntelligence(); }
  // AS OUTRAS TRES TELAS QUE MOSTRAM A MESMA PECA.
  //
  // Existiam duas funcoes para repintar depois de uma mudanca: esta, que so
  // sabia das semanas e dos KPIs, e a redesenharAposMudanca, que sabia de tudo.
  // Trocar o status passava pela incompleta — entao a fileira de Grupos, o
  // calendario e a esteira de Solicitacoes continuavam com o valor antigo, e a
  // pessoa concluia que so recarregando a pagina resolvia. Era exatamente isso.
  //
  // As tres tem guarda propria e nao fazem nada quando a tela nao esta aberta,
  // entao chamar sempre custa quase nada e nao deixa mais nenhuma delas para
  // tras. A redesenharAposMudanca passa a delegar para ca: uma verdade so.
  if(typeof repintarCartaoRapido==='function') repintarCartaoRapido();
  if(typeof repintarMesaDePlanejamento==='function') repintarMesaDePlanejamento();
  if(typeof renderVisaoDeGrupos==='function') renderVisaoDeGrupos();
  if(typeof renderManagerCalendar==='function') renderManagerCalendar();
  if(typeof renderDemandas==='function' && typeof activeBoard!=='undefined' && activeBoard==='demandas') renderDemandas();
  requestAnimationFrame(()=>window.scrollTo({top:previousScroll,behavior:'instant'}));
  const dominioAtivo = typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio';
  cacheSyncLabel(dominioAtivo ? 'Alteração confirmada no banco Vybe.' : 'Alteração local aplicada · confirmando contingência…');
  setSyncHealth(dominioAtivo ? 'healthy' : 'checking', dominioAtivo ? 'Banco Vybe confirmou a alteração.' : 'Alteração enviada · confirmando contingência…');
}
function outboundPatchMatches(item,patch={}) {
  return outboundPatchFields(patch).every(([field,value])=>{
    const remote=item?.[field];
    return Array.isArray(value) ? JSON.stringify((remote||[]).map(String).sort())===JSON.stringify(value.map(String).sort()) : String(remote??'')===String(value??'');
  });
}
function queueOutboundItemReconciliation(itemId, patch={}, label='alteração', attempt=0) {
  const key=String(itemId); const previous=outboundItemPatchQueue.get(key); if(previous?.timer) clearTimeout(previous.timer);
  if (typeof fonteDeLeitura === 'function' && fonteDeLeitura() === 'dominio') {
    outboundItemPatchQueue.delete(key);
    cacheSyncLabel('Alteração confirmada no banco Vybe · réplica externa em fila de contingência.');
    setSyncHealth('healthy', `Banco Vybe confirmou a alteração às ${syncHealthClock(Date.now())}`);
    return;
  }
  const timer=setTimeout(async()=>{
    try {
      const raw=(await fetchItemsByIds([key]))[0];
      if(!raw) throw new Error('Demanda não encontrada no retorno do Monday.');
      const remote=processItemsAll([raw],calcWeeks())[0];
      if(!remote) throw new Error('Retorno da demanda inválido.');
      const confirmed=outboundPatchMatches(remote,patch);
      if(!confirmed && attempt<3) { queueOutboundItemReconciliation(key,patch,label,attempt+1); return; }
      if(!confirmed) {
        outboundItemPatchQueue.delete(key);
        setSyncHealth('degraded', 'Alteração local mantida · confirmação do Monday pendente.');
        cacheSyncLabel('Alteração local mantida · confirmação do Monday ainda pendente.');
        showToast('A alteração continua aplicada no painel; o Monday ainda não confirmou o item.', 'info', 5200);
        return;
      }
      const merged=new Map((DADOS_ALL||[]).map(item=>[String(item.id),item]));
      merged.set(key,remote);
      // Reconciliação de saída: atualiza a base local sem reposicionar semana, filtros, rolagem ou modo ativo.
      DADOS_ALL=[...merged.values()];
      DADOS=visibleProductionItems(DADOS_ALL,META);
      recalcSemanas(); applyOperationalRisk(DADOS); applyOperationalRisk(DADOS_ALL);
      syncStatusLegendColors('#status-legend',DADOS_ALL);
      renderOutboundItemPatch(label);
      saveProductionCache(); outboundItemPatchQueue.delete(key);
      cacheSyncLabel(`Alteração confirmada no Monday · somente 1 demanda reconciliada`);
      setSyncHealth('healthy', `Monday confirmou 1 alteração às ${syncHealthClock(Date.now())}`);
    } catch(error) {
      console.warn('Reconciliação individual pendente:',error);
      if(attempt<3) { queueOutboundItemReconciliation(key,patch,label,attempt+1); return; }
      outboundItemPatchQueue.delete(key);
      setSyncHealth('degraded', `Alteração local mantida · confirmação do Monday pendente.`);
      showToast(`A alteração foi mantida no painel; a confirmação do Monday será repetida em segundo plano.`, 'info', 5200);
    }
  },attempt?Math.min(1400*(attempt+1),5000):900);
  outboundItemPatchQueue.set(key,{timer,patch,label,attempt});
}
