// vybe-datas.js — as duas datas da peça e a margem entre elas.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// Prazo é quando a peça precisa estar pronta; veiculação é quando ela vai ao ar.
// A distância entre as duas é o Prazo de Ouro — sete dias — e é aviso, não trava.
// Aqui moram o botão de data de cada linha, a caixa que edita as duas juntas e a
// leitura da margem.
//
// Carrega DEPOIS de vybe-risco.js: lê findOperationalItem e chama
// applyOutboundItemPatch e queueOutboundItemReconciliation, declarados lá.

function planningDateBr(iso='') { return /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}` : 'não definido'; }
const PRAZO_OURO_DIAS = 7;
function goldenDeadlineIso(veiculacao='') { if(!/^\d{4}-\d{2}-\d{2}$/.test(String(veiculacao))) return ''; const date=new Date(`${veiculacao}T12:00:00`); date.setDate(date.getDate()-PRAZO_OURO_DIAS); return date.toISOString().slice(0,10); }
function goldenDeadlineGap(prazo='',veiculacao='') { if(!prazo || !veiculacao) return null; const from=new Date(`${prazo}T12:00:00`); const to=new Date(`${veiculacao}T12:00:00`); return Math.round((to-from)/86400000); }
function quickDateTrigger(item, className='') { const gap=goldenDeadlineGap(item?.prazo_iso,item?.veiculacao_iso); const risk=gap!==null&&gap<PRAZO_OURO_DIAS; const title=`Editar prazo e veiculação · Prazo de Ouro: ${PRAZO_OURO_DIAS} dias antes da veiculação${gap===null?'':` · atual: ${gap} dias`}`; return `<button type="button" class="quick-date-trigger ${risk?'gold-risk':''} ${className}" onclick="openPlanningEditor('${item.id}')" title="${safeText(title)}" aria-label="${safeText(title)}">◷</button>`; }
function quickDateDaTrigger(item) { const gap=goldenDeadlineGap(item?.prazo_iso,item?.veiculacao_iso); const risk=gap!==null&&gap<PRAZO_OURO_DIAS; const title=`Editar datas · Prazo de Ouro: ${PRAZO_OURO_DIAS} dias antes da veiculação`; return `<span class="quick-date-da ${risk?'gold-risk':''}" role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();openPlanningEditor('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openPlanningEditor('${item.id}')}" title="${safeText(title)}">◷</span>`; }
// ── Datas rápidas ────────────────────────────────────────────────────────────
//
// A caixa dizia tudo o tempo todo: um paragrafo de explicacao no topo, dois
// campos com titulo e legenda cada, uma faixa laranja com a conta da margem
// espremida numa linha, um campo de motivo SEMPRE aberto — mesmo quando o prazo
// estava no padrao e nao havia excecao nenhuma para justificar — e um rodape
// explicando que o sistema guarda historico.
//
// Aqui a tela responde a uma pergunta so: as duas datas estao certas? Entao ela
// mostra as duas datas, o que a regra acha delas, e some com o resto. O motivo
// da excecao nasce fechado e SO APARECE quando o prazo sai do padrao — que e
// exatamente quando ele passa a ser obrigatorio.
function leituraDoPrazoDeOuro(prazo, veic) {
  const alvo = goldenDeadlineIso(veic);
  const gap = goldenDeadlineGap(prazo, veic);
  if (!veic) return { estado: 'pendente', titulo: 'Falta a veiculação',
    texto: 'Sem a data de publicação não dá para medir a antecedência.', alvo: '' };
  if (!prazo) return { estado: 'pendente', titulo: `Sugerido: ${planningDateBr(alvo)}`,
    texto: `${PRAZO_OURO_DIAS} dias antes do ar.`, alvo };
  if (prazo === alvo) return { estado: 'ok', titulo: 'No padrão',
    texto: `${PRAZO_OURO_DIAS} dias completos de antecedência.`, alvo };
  if (gap > PRAZO_OURO_DIAS) return { estado: 'folga', titulo: `${gap} dias de antecedência`,
    texto: `${gap - PRAZO_OURO_DIAS} a mais que o padrão.`, alvo };
  return { estado: 'risco', titulo: `${Math.max(0, gap)} dia${gap === 1 ? '' : 's'} de antecedência`,
    texto: `${PRAZO_OURO_DIAS - gap} abaixo do padrão · ideal ${planningDateBr(alvo)}.`, alvo };
}

function painelDoPrazoDeOuro(prazo, veic) {
  const l = leituraDoPrazoDeOuro(prazo, veic);
  const forade = l.estado === 'risco' || l.estado === 'folga';
  return `<div class="dr-regra dr-${l.estado}">
      <span class="dr-regra-marca" aria-hidden="true"></span>
      <span class="dr-regra-copy"><b>${safeText(l.titulo)}</b><small>${safeText(l.texto)}</small></span>
      ${l.alvo && l.estado !== 'ok'
        ? `<button type="button" class="dr-aplicar" onclick="applyGoldenDeadline()">Usar ${planningDateBr(l.alvo)}</button>`
        : ''}
    </div>
    <label class="dr-motivo ${forade ? 'aberto' : ''}">
      <span>Por que fora do padrão? <em>fica no histórico da peça</em></span>
      <textarea id="planning-reason" rows="2"
        placeholder="Ex.: urgência aprovada; o cliente mudou a campanha."></textarea>
    </label>`;
}

function updateGoldenDeadlineState() {
  const veic = String(document.getElementById('planning-veiculacao')?.value || '');
  const prazo = String(document.getElementById('planning-prazo')?.value || '');
  const caixa = document.getElementById('planning-golden-state');
  if (!caixa) return;
  // O motivo ja digitado nao pode se perder quando a pessoa mexe numa data.
  const escrito = document.getElementById('planning-reason')?.value || '';
  caixa.innerHTML = painelDoPrazoDeOuro(prazo, veic);
  const campo = document.getElementById('planning-reason');
  if (campo && escrito) campo.value = escrito;
}

function applyGoldenDeadline() {
  const veic = String(document.getElementById('planning-veiculacao')?.value || '');
  const prazo = document.getElementById('planning-prazo');
  const golden = goldenDeadlineIso(veic);
  if (!golden) return showToast('Informe a veiculação antes de aplicar o Prazo de Ouro.', 'info');
  if (prazo) prazo.value = golden;
  updateGoldenDeadlineState();
}

function openPlanningEditor(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Demanda não encontrada.', 'err');
  const prazo = item.prazo_iso || '';
  const veiculacao = item.veiculacao_iso || '';
  openWorkflowModal(`<div class="dr-topo">
      <div><span class="dr-kicker">${safeText(item.cliente || 'Sem cliente')}</span>
        <h2 class="dr-titulo">${safeText(item.nome || 'Sem título')}</h2></div>
      <button class="dr-fechar" type="button" onclick="closeWorkflowModal()" aria-label="Fechar">×</button>
    </div>
    <div class="dr-datas">
      <label class="dr-campo">
        <span>Prazo de produção</span>
        <input id="planning-prazo" type="date" value="${prazo}" onchange="updateGoldenDeadlineState()">
      </label>
      <span class="dr-seta" aria-hidden="true">→</span>
      <label class="dr-campo">
        <span>Veiculação</span>
        <input id="planning-veiculacao" type="date" value="${veiculacao}" onchange="updateGoldenDeadlineState()">
      </label>
    </div>
    <div id="planning-golden-state">${painelDoPrazoDeOuro(prazo, veiculacao)}</div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button id="planning-save" type="button" class="workflow-primary" onclick="savePlanningDates('${item.id}')">Salvar</button>
    </div>`);
}

async function savePlanningDates(itemId) {
  const item=findOperationalItem(itemId);
  const prazo=String(document.getElementById('planning-prazo')?.value||'');
  const veiculacao=String(document.getElementById('planning-veiculacao')?.value||'');
  const reason=String(document.getElementById('planning-reason')?.value||'').trim();
  if(!item) return showToast('Demanda não encontrada.', 'err');
  if(!prazo || !veiculacao) return showToast('Preencha Prazo e Veiculação para manter o planejamento completo.', 'info');
  // Deixou de barrar: quem esta replanejando sabe o que quer, e recusar no meio
  // so devolve o formulario. Avisa e segue — a mesma decisao ja tomada para o
  // Prazo de Ouro. O aviso e forte porque a combinacao e mesmo estranha:
  // produzir depois de publicar.
  const prazoDepois = prazo > veiculacao;
  const golden=goldenDeadlineIso(veiculacao);
  const followsGolden=prazo===golden;
  if(!followsGolden && !reason) return showToast(`O Prazo de Ouro é ${PRAZO_OURO_DIAS} dias antes da veiculação. Aplique o padrão ou registre o motivo da exceção.`, 'info');
  const prazoChanged=prazo!==String(item.prazo_iso||'');
  const veicChanged=veiculacao!==String(item.veiculacao_iso||'');
  if(!prazoChanged && !veicChanged) return closeWorkflowModal();
  const values={}; if(prazoChanged) values.data={date:prazo}; if(veicChanged) values[isRequestItem(item)?COLUNAS.demandas.veiculacao:COLUNAS.producao.veiculacao]={date:veiculacao};
  const button=document.getElementById('planning-save'); if(button) button.disabled=true;
  armOutboundMutationGuard(veicChanged?'veiculação':'prazo');
  try {
    const pelaEscritaPropria=await tentarEscritaDupla(item,{ acao:'datas', item:String(item.id), prazo, veiculacao });
    if(!pelaEscritaPropria){
      const mutation=`mutation($board:ID!,$item:ID!,$values:JSON!){ change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){ id } }`;
      await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),values:JSON.stringify(values)});
    }
    const changes=[]; if(prazoChanged) changes.push(`Prazo: ${planningDateBr(item.prazo_iso)} → ${planningDateBr(prazo)}`); if(veicChanged) changes.push(`Veiculação: ${planningDateBr(item.veiculacao_iso)} → ${planningDateBr(veiculacao)}`);
    try { await postItemUpdate(item.id,`[Vybe OS · Planejamento atualizado]\n${changes.join('\n')}\nRegra: ${followsGolden?`Prazo de Ouro respeitado (${PRAZO_OURO_DIAS} dias antes da veiculação)`:`Exceção ao Prazo de Ouro (${(()=>{const d=goldenDeadlineGap(prazo,veiculacao);return d===1?'1 dia':`${d} dias`;})()} de antecedência)`}${reason ? `\nMotivo: ${reason}` : ''}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`); } catch(logError) { console.warn('Datas atualizadas, mas o log não foi registrado.',logError); }
    if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(row=>String(row.id)===String(item.id)); if(request){ if(prazoChanged){request.prazo_iso=prazo;request.prazo=planningDateBr(prazo).slice(0,5);} if(veicChanged){request.conclusao_iso=veiculacao;request.conclusao=planningDateBr(veiculacao).slice(0,5);request.veiculacao_iso=veiculacao;request.veiculacao=planningDateBr(veiculacao).slice(0,5);} } outboundMutationGuardUntil=0; renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{...(prazoChanged?{prazo_iso:prazo}:{}),...(veicChanged?{veiculacao_iso:veiculacao}:{})},'planejamento');
    closeWorkflowModal();
    if(activeWorkspaceItemId===String(item.id)) { const refreshed=findOperationalItem(item.id)||item; renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),refreshed); }
    showToast(prazoDepois
      ? '✓ Planejamento atualizado · atenção: o prazo ficou DEPOIS da veiculação'
      : '✓ Planejamento atualizado no Vybe OS · painel mantido no contexto atual',
      prazoDepois ? 'info' : 'ok', prazoDepois ? 8000 : undefined);
  } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível atualizar o planejamento: ${e.message}`,'err',7000); }
}
