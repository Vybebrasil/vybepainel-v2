// vybe-portoes.js — o que o painel pergunta antes de deixar a peça seguir.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// Um assunto só, apesar do tamanho: quais status exigem conferência, qual
// conferência cada um exige, a caixa que faz a pergunta e o registro do que foi
// respondido. O checklist de qualidade, a conferência do material, a conferência
// visual da arte e a passagem de bastão são quatro perguntas com a mesma forma —
// e é por isso que dividem a mesma caixa.
//
// Carrega DEPOIS de vybe-risco.js: lê HOJE_ISO, DADOS, findOperationalItem e
// chama commitStatusChange e updateLocalStatus, declarados lá.

const HANDOFF_TARGET_STATUSES = new Set(['ag. aprovação cliente']);
// 'para agendar' saiu daqui: entrar nesse status e dizer "a peca esta pronta,
// falta marcar a hora" — nao e a entrega em si, e o checklist de qualidade antes
// dele virava pedagio. 'agendado' fica, mas na pratica quem manda nele e a
// revisao de material, que roda antes desta.
const QUALITY_TARGET_STATUSES = new Set(['agendado']);
const MATERIAL_REVIEW_TARGET_STATUSES = new Set(['agendado','finalizado','feito']);
// Status que nao pedem justificativa escrita para entrar.
//
// 'Pode Fazer' e o mais comum de todos: e o que significa "o briefing esta de pe,
// pode comecar". Nao e uma volta nem um bloqueio — nao ha o que justificar, e
// obrigar a escrever um motivo em cada peca liberada era um pedagio na parte
// mais repetida do dia.
//
// 'Finalizado' entra pelo mesmo motivo: ali a trava que importa e a conferencia
// visual do material, nao o texto.
// 'para agendar' precisa entrar AQUI junto com a saida do checklist. Sem isso, o
// portao nao some — troca de nome: statusNeedsContext e "nao esta livre e nenhum
// outro portao pegou", entao tirar de um so empurra a peca para o outro.
const CONTEXT_FREE_STATUSES = new Set(['em andamento','em execução','em execucao',
  'finalizado','feito','pode fazer','a fazer','para agendar',
  // Esperar o texto ou o audio chegar nao e uma decisao a justificar: nada foi
  // decidido, so ainda nao chegou. Pedir motivo aqui e pedagio.
  'aguardo redação','aguardo redacao','falta off']);
// Mandar para aprovacao nao e prestar contas — e mostrar o que ficou pronto.
//
// O portao antigo pedia motivo escrito, proxima pessoa e link de referencia
// antes de deixar a peca entrar em "Aguardando Aprovacao". Isso faz sentido
// quando a mudanca precisa de justificativa (uma volta, um bloqueio); aqui nao:
// quem terminou quer olhar a arte uma ultima vez e mandar. O texto obrigatorio
// virava um pedagio, e pedagio na hora de entregar e o jeito mais rapido de o
// time parar de usar o painel.
//
// Entao estas passam a abrir a arte no centro da tela, com voltar e confirmar —
// e nada mais.
const CONFERENCIA_VISUAL_STATUSES = new Set([
  'para aprovação', 'para aprovacao',
  // Os dois nomes antigos ficam ate a juncao ser feita em todos os ambientes.
  'aguardando aprovação', 'aguardando aprovacao',
  'em aprovação', 'em aprovacao',
]);
function statusNeedsConferenciaVisual(option) {
  return Boolean(option) && CONFERENCIA_VISUAL_STATUSES.has(normalizedWorkflowStatus(option.label));
}
let pendingWorkflowChange = null;
function normalizedWorkflowStatus(status='') { return String(status).trim().toLowerCase(); }
function statusNeedsHandoff(item, option) { return item && option && HANDOFF_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && normalizedWorkflowStatus(item.status) !== normalizedWorkflowStatus(option.label); }
// FINALIZADO NO MEIO DA ESTEIRA NAO E ENTREGA.
//
// A conferencia final pergunta se o material foi entregue ou publicado e se o
// destino final confere. Em Producao e em Redacao isso nao existe: quem captou a
// foto nao publicou nada, quem escreveu o roteiro tambem nao. "Finalizado" ali
// quer dizer "a minha etapa acabou, segue" — e o proprio motor de automacoes ja
// trata assim, movendo a peca para a etapa seguinte.
//
// O portao pedia conferencia de uma entrega que ainda nem existe. Tres caixas
// que so podem ser marcadas no automatico sao o pior estado possivel para uma
// trava: ensinam a clicar sem ler, e no dia em que a conferencia importa de
// verdade — no fim da esteira — ela ja virou reflexo.
const GRUPOS_SEM_CONFERENCIA_FINAL = new Set(['novo_grupo57911__1', 'group_title']);
// O id do grupo tem tres nomes diferentes no painel conforme quem montou o item:
// 'group_id' no processItemsAll, 'grupo_id' na gaveta e no banco. Ate isso ser
// unificado, ler os dois e a unica leitura que funciona nos dois caminhos.
const grupoDaPeca = (item) => String(item?.group_id || item?.grupo_id || '');
function conferenciaFinalDispensada(item, option) {
  const alvo = normalizedWorkflowStatus(option?.label);
  if (alvo !== 'finalizado' && alvo !== 'feito') return false;
  return GRUPOS_SEM_CONFERENCIA_FINAL.has(grupoDaPeca(item));
}
// A pergunta que os portoes fazem passa a considerar ONDE a peca esta, e nao so
// para onde ela vai.
function precisaDeConferenciaFinal(item, option) {
  return statusNeedsMaterialReview(option) && !conferenciaFinalDispensada(item, option);
}
function statusNeedsMaterialReview(option) { return option && MATERIAL_REVIEW_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)); }
function statusNeedsQuality(option) { return option && QUALITY_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && !statusNeedsMaterialReview(option); }
function statusNeedsContext(option) {
  const status = normalizedWorkflowStatus(option?.label);
  // Finalizado não exige justificativa: a única trava é a conferência visual do material.
  return Boolean(status) && !CONTEXT_FREE_STATUSES.has(status) && !statusNeedsQuality(option)
    && !statusNeedsMaterialReview(option) && !statusNeedsConferenciaVisual(option);
}
function workflowItemHtml(item, target='') { return `<div class="workflow-item"><span class="workflow-item-client">${safeText(item.cliente || 'Cliente não informado')}</span><span class="workflow-item-name">${safeText(item.nome)}${target ? ` <small style="color:#ffb850">→ ${safeText(target)}</small>` : ''}</span></div>`; }
function closeWorkflowModal() { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); pendingWorkflowChange = null; }
function openWorkflowModal(html) { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); const back=document.createElement('div'); back.id='workflow-backdrop'; back.className='workflow-backdrop'; back.onclick=closeWorkflowModal; const modal=document.createElement('section'); modal.id='workflow-modal'; modal.className='workflow-modal'; modal.innerHTML=html; document.body.append(back,modal); }
// Todo registro de histórico do painel passa por aqui — checklist de qualidade,
// troca de responsáveis, ajuste de prazo. Ligando esta função, o histórico
// inteiro passa a nascer no banco da Vybe em vez de nascer no Monday.
// A NOTA NUNCA SEGURA O TRABALHO.
//
// Isto aqui grava a nota no historico da peca — "fulano mudou de X para Y, e o
// motivo foi este". Toda troca de status passa por ela ANTES de a troca
// acontecer, e ela estava deixando o erro subir. Resultado: se a nota falhasse
// por qualquer razao, a troca de status era abortada e a pessoa via so um erro
// vermelho. Foi o que o time viu tentando mudar para "Agendar".
//
// A ordem estava certa (registrar antes de mexer), a consequencia e que estava
// errada: o que a pessoa PEDIU foi trocar o status; a nota e efeito colateral.
// Agora, se a nota nao entrar, ela avisa e devolve false — e quem chamou segue
// em frente. Melhor uma peca certa com o historico incompleto do que uma peca
// parada com o historico limpo.
async function postItemUpdate(itemId, body) {
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null) || { id: itemId };
  try {
    const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'comentario', item:String(itemId), texto:String(body) });
    if (pelaEscritaDupla) return true;
    const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
    return await mondayQuery(mutation, { item:String(itemId), body:String(body) });
  } catch (erro) {
    console.warn('Nota de histórico não gravada:', erro);
    showToast('A alteração foi feita. A nota no histórico não pôde ser gravada.', 'info', 6000);
    return false;
  }
}
function qualityChecklistFor(item) { const fmt = String(item.formato || item.tipo || '').toLowerCase(); const common=['Arquivo final correto e sem versão provisória','Copy, legenda e CTA revisados','Cliente e responsável pela publicação confirmados']; if (/reels|vídeo|video|motion|fotografia/.test(fmt)) return [...common,'Capa, áudio e proporção validados','Link de entrega ou arquivo final disponível']; if (/carrossel/.test(fmt)) return [...common,'Sequência das páginas revisada','Capa e última página com CTA confirmadas']; return [...common,'Dimensões e identidade visual conferidas','Link ou arquivo final disponível']; }
function updateQualityGateState() { const form=document.getElementById('quality-checklist-form'); const button=document.getElementById('quality-submit'); if (!form || !button) return; button.disabled=[...form.querySelectorAll('input[type=checkbox]')].some(input => !input.checked); }
function openQualityGate(item, option) { if(precisaDeConferenciaFinal(item,option)) return openMaterialReviewGate(item,option); pendingWorkflowChange={item,option,manual:false}; const checks=qualityChecklistFor(item); openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Qualidade antes da publicação</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Checklist de qualidade</h2><p class="workflow-copy">Antes de enviar este conteúdo para ${safeText(option.label)}, confira a prévia e confirme os pontos essenciais. O registro fica no histórico da peça.</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout material-review-layout"><div class="status-context-main"><form id="quality-checklist-form" class="workflow-checks" onchange="updateQualityGateState()">${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" name="check-${index}"><span>${safeText(check)}</span></label>`).join('')}</form><p class="workflow-hint">Este controle vale para mudanças feitas dentro da Vybe OS. Alterações diretas no Monday não passam por este fluxo.</p></div><aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia para conferência</b><small>arquivo vinculado</small></div><div id="material-review-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside></div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="quality-submit" type="button" class="workflow-primary" disabled onclick="submitQualityChecklist()">Validar e continuar →</button></div>`); document.getElementById('workflow-modal')?.classList.add('status-context-split','material-review-modal'); loadMaterialReviewPreview(item.id); }
async function submitQualityChecklist() { const flow=pendingWorkflowChange; const form=document.getElementById('quality-checklist-form'); if (!flow || !form) return; const checks=[...form.querySelectorAll('label')].map(label=>label.textContent.trim()).filter(Boolean); const button=document.getElementById('quality-submit'); if (button) button.disabled=true; try { await postItemUpdate(flow.item.id, `[Vybe OS · Checklist de qualidade]\nDestino: ${flow.option.label}\nFormato: ${flow.item.formato || flow.item.tipo || 'Conteúdo'}\nValidado: ${checks.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if (statusNeedsHandoff(item,option)) openHandoffGate(item,option); else await commitStatusChange(item,option); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o checklist: ${e.message}`,'err',7000); } }
function materialReviewChecklistFor(item, option) { const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const format=String(item?.formato||item?.tipo||'conteúdo'); return scheduled ? [`Conferi a prévia final de ${format} antes do agendamento`,`Confirmei que legenda, CTA, canal e data de publicação estão corretos`,`O arquivo ou link aberto corresponde a esta demanda`] : [`Conferi a prévia do material entregue ou publicado`,`Confirmei que o destino final corresponde a esta demanda`,`Não há pendência de publicação ou material incorreto antes de finalizar`]; }
function updateMaterialReviewState(){ const checks=[...document.querySelectorAll('input[data-material-review-check]')]; const button=document.getElementById('material-review-submit'); if(button) button.disabled=!checks.length||checks.some(check=>!check.checked); }
function materialReviewPreviewFailed(image){ const fallback=String(image?.dataset?.fallbackSrc||''); if(fallback&&image.dataset.fallbackTried!=='true'){ image.dataset.fallbackTried='true'; image.src=fallback; return; } const holder=image.closest('.status-context-preview-media'); if(holder) holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Abra o material vinculado para conferir o arquivo final.</div>'; }
async function loadMaterialReviewPreview(itemId){
  const holder=document.getElementById('material-review-preview');
  if(!holder) return;
  try {
    const detail=await fetchWorkspaceItem(itemId);
    const assets=statusContextPreviewAssets(detail);
    const delivery=workspaceDeliveryInfo(detail);
    const open=delivery?.url?`<a class="material-review-open" href="${safeText(delivery.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a>`:'';
    PREVIA_MATERIAL=assets; PREVIA_DA_PECA='';
    PREVIA_GRANDE_INDICE=0;
    if(!assets.length){
      holder.innerHTML=`<div class="status-context-preview-empty"><b>Sem prévia visual</b>${delivery?.url?'Há um material vinculado. Abra-o antes de confirmar a conferência.':'Nenhum arquivo ou link final foi localizado nesta demanda.'}${open}</div>`;
      return;
    }
    const primeira=assets[0];
    const fonte=primeira.url_thumbnail||primeira.public_url||primeira.url||'';
    if(!fonte){
      holder.innerHTML=`<div class="status-context-preview-empty"><b>Arquivo sem prévia</b>${delivery?.url?'Abra o material vinculado para conferir o arquivo final.':'O item não disponibiliza imagem de visualização.'}${open}</div>`;
      return;
    }
    // Com mais de uma arte, as demais viram miniaturas clicáveis — conferir só a
    // primeira e aprovar seria aprovar no escuro o resto do carrossel.
    const tira=assets.length>1
      ? `<div id="material-review-strip" class="material-review-strip">${assets.map((a,i)=>`<button type="button" class="${i===0?'ativa':''}" title="${safeText(a.name||'')}" onclick="trocarPreviaMaterial(${i})"><img src="${safeText(a.url_thumbnail||a.public_url||a.url||'')}" alt=""></button>`).join('')}</div>`
      : '';
    holder.innerHTML=`<img id="material-review-img" src="${safeText(fonte)}" alt="Prévia de ${safeText(primeira.name||'material')}" loading="eager" title="Clique para ver em tamanho grande" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)" onerror="materialReviewPreviewFailed(this)"><small id="material-review-caption" class="status-context-preview-caption">${assets.length>1?`(1/${assets.length}) `:''}${safeText(primeira.name||'Prévia vinculada ao item')}</small><button type="button" class="previa-grande-abrir" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)">CONFERIR EM TAMANHO GRANDE ⤢</button>${tira}${open}`;
  } catch(error){
    holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. Feche e tente novamente antes de confirmar.</div>';
  }
}
function openMaterialReviewGate(item,option){ const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const checks=materialReviewChecklistFor(item,option); pendingWorkflowChange={item,option,manual:false}; const title=scheduled?'Conferir antes de agendar':'Conferir antes de finalizar'; const copy=scheduled?'Antes de liberar o agendamento, confira a prévia e valide que o material, a publicação e o canal correspondem a esta demanda.':'Antes de marcar como finalizado, confira a prévia do material postado ou entregue. Não é necessário explicar o motivo do encerramento.'; const action=scheduled?'CONFIRMAR E AGENDAR →':'CONFIRMAR E FINALIZAR →'; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Conferência final</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">${title}</h2><p class="workflow-copy">${copy}</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout material-review-layout"><div class="status-context-main"><form id="material-review-form" class="workflow-checks" onchange="updateMaterialReviewState()">${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" data-material-review-check name="material-review-${index}"><span>${safeText(check)}</span></label>`).join('')}</form><p class="workflow-hint">Esta conferência é registrada no histórico da peça junto com a mudança de status. Nenhuma justificativa é exigida para finalizar.</p></div><aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia para conferência</b><small>arquivo vinculado</small></div><div id="material-review-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside></div><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="material-review-submit" type="button" class="workflow-primary" disabled onclick="submitMaterialReview()">${action}</button></div>`); document.getElementById('workflow-modal')?.classList.add('status-context-split','material-review-modal'); loadMaterialReviewPreview(item.id); updateMaterialReviewState(); }
async function submitMaterialReview(){ const flow=pendingWorkflowChange; const checks=[...document.querySelectorAll('input[data-material-review-check]')]; if(!flow||!checks.length) return; if(checks.some(check=>!check.checked)) return showToast('Confirme a conferência visual antes de continuar.','info'); const button=document.getElementById('material-review-submit'); if(button){button.disabled=true;button.textContent='Registrando...';} try { const checked=checks.map(check=>check.parentElement.textContent.trim()).filter(Boolean); await postItemUpdate(flow.item.id,`[Vybe OS · Conferência final]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMaterial conferido: ${checked.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); await commitStatusChange(item,option); } catch(error){ if(button){button.disabled=false;button.textContent=normalizedWorkflowStatus(flow?.option?.label)==='agendado'?'CONFIRMAR E AGENDAR →':'CONFIRMAR E FINALIZAR →';} showToast(`Não foi possível registrar a conferência: ${error.message}`,'err',7000); } }
// ── conferencia visual ────────────────────────────────────────────────────────
// A arte no centro, e duas saidas: voltar ou mandar. Sem campo obrigatorio, sem
// checklist, sem trava. Se a peca tiver mais de um arquivo, da para passar entre
// eles — quem confere quer ver o que vai ser aprovado, nao so o primeiro.
let CONFERENCIA_INDICE = 0;
function abrirConferenciaVisual(item, option) {
  pendingWorkflowChange = { item, option, manual: false };
  CONFERENCIA_INDICE = 0;
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Confira antes de mandar</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${safeText(item.nome || 'Esta peça')}</h2>
    <p class="workflow-copy">${safeText(item.cliente || 'Cliente não informado')} · vai para
      <b>${safeText(option.label)}</b>.</p>
    <div class="conferencia-palco" id="conferencia-palco">
      <div class="status-context-preview-loading">Buscando a arte…</div>
    </div>
    <div class="workflow-actions">
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">← Voltar</button>
      <button type="button" class="workflow-primary" onclick="confirmarConferenciaVisual()">Confirmar ✓</button>
    </div>`);
  document.getElementById('workflow-modal')?.classList.add('conferencia-visual');
  carregarArteDaConferencia(item.id);
}

async function carregarArteDaConferencia(itemId) {
  const palco = document.getElementById('conferencia-palco');
  if (!palco) return;
  try {
    const detail = await fetchWorkspaceItem(itemId);
    const artes = statusContextPreviewAssets(detail) || [];
    const entrega = workspaceDeliveryInfo(detail);
    PREVIA_MATERIAL = artes; PREVIA_DA_PECA = '';
    const abrir = entrega?.url
      ? `<a class="material-review-open" href="${safeText(entrega.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a>`
      : '';
    if (!artes.length) {
      palco.innerHTML = `<div class="status-context-preview-empty"><b>Nenhuma arte anexada</b>
        ${entrega?.url ? 'Há um material vinculado — abra antes de confirmar.'
          : 'Esta peça não tem arquivo para conferir. Você ainda pode mandar para aprovação.'}${abrir}</div>`;
      return;
    }
    // Quantos arquivos existem, dito em voz alta.
    //
    // Um carrossel tem varias paginas, e a tela mostrava a primeira sem dizer
    // que era a primeira DE UMA. Quem conferia nao sabia distinguir "so tem
    // esta" de "o resto nao aparece" — e as duas coisas se resolvem de jeitos
    // opostos: uma e anexar o que falta, a outra e um defeito. Agora a conta
    // aparece sempre, e com um so arquivo ela diz isso com todas as letras.
    const varias = artes.length > 1;
    const conta = varias
      ? `<span class="conferencia-conta"><b id="conferencia-n">1</b> de ${artes.length} arquivos</span>`
      : '<span class="conferencia-conta unica">1 arquivo anexado nesta peça</span>';
    const setas = varias ? `
      <button type="button" class="conferencia-seta" onclick="passarArteDaConferencia(-1)" aria-label="Arte anterior">‹</button>
      <button type="button" class="conferencia-seta" onclick="passarArteDaConferencia(1)" aria-label="Próxima arte">›</button>` : '';
    palco.innerHTML = `<figure class="conferencia-arte ${varias ? 'tem-setas' : ''}">
        ${setas}
        <img id="conferencia-img" src="" alt="" title="Clique para ver em tamanho grande"
          onclick="abrirPreviaGrande(CONFERENCIA_INDICE)">
        <figcaption id="conferencia-legenda"></figcaption>
      </figure>
      ${conta}${abrir}`;
    // A fileira numerada saiu. Com as setas e o "N de M" sempre a vista, ela era
    // uma terceira forma de fazer a mesma coisa — e, numa janela mais baixa,
    // ficava fora do campo de visao, empurrando a conta para a rolagem. Duas
    // navegacoes, uma delas escondida, e pior que uma que sempre aparece.
    trocarArteDaConferencia(0);
  } catch (erro) {
    palco.innerHTML = `<div class="status-context-preview-empty"><b>Não deu para carregar a arte</b>
      ${safeText(erro.message || '')} — você ainda pode confirmar.</div>`;
  }
}

// Setas alem dos numeros: numero e preciso, seta e obvio. Quem esta conferindo
// cinco paginas de um carrossel nao quer mirar em quadradinhos de 26px.
function passarArteDaConferencia(passo) {
  if (!PREVIA_MATERIAL.length) return;
  const total = PREVIA_MATERIAL.length;
  trocarArteDaConferencia((CONFERENCIA_INDICE + passo + total) % total);
}

function trocarArteDaConferencia(indice) {
  const arte = PREVIA_MATERIAL[indice];
  if (!arte) return;
  CONFERENCIA_INDICE = indice;
  const img = document.getElementById('conferencia-img');
  const legenda = document.getElementById('conferencia-legenda');
  if (img) {
    img.src = arte.public_url || arte.url_thumbnail || arte.url || '';
    img.alt = `Prévia de ${arte.name || 'material'}`;
  }
  if (legenda) {
    legenda.textContent = PREVIA_MATERIAL.length > 1
      ? `(${indice + 1}/${PREVIA_MATERIAL.length}) ${arte.name || ''}`
      : (arte.name || '');
  }
  document.querySelectorAll('#conferencia-tiras button')
    .forEach((b, i) => b.classList.toggle('ativa', i === indice));
  const n = document.getElementById('conferencia-n');
  if (n) n.textContent = String(indice + 1);
}

async function confirmarConferenciaVisual() {
  const fluxo = pendingWorkflowChange;
  if (!fluxo) return;
  const botao = document.querySelector('#workflow-modal .workflow-primary');
  if (botao) { botao.disabled = true; botao.textContent = 'Mandando…'; }
  const { item, option } = fluxo;
  // A nota de historico nao segura a troca — a mesma regra de todos os portoes.
  void postItemUpdate(item.id, `[Vybe OS · Conferência visual]\nEtapa: ${item.status} → ${option.label}`);
  closeWorkflowModal();
  await commitStatusChange(item, option);
}

function openHandoffGate(item, option=null) { pendingWorkflowChange={item,option,manual:!option}; const target=option?.label || 'próxima pessoa ou etapa'; openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Passagem de bastão</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Deixe a próxima etapa pronta</h2><p class="workflow-copy">Registre o contexto mínimo para que o trabalho siga sem perda de informação.</p>${workflowItemHtml(item,target)}<label class="workflow-field"><span>O que foi concluído?</span><textarea id="handoff-done" rows="3" placeholder="Ex.: Arte revisada, versão final aprovada internamente e arquivo anexado."></textarea></label><label class="workflow-field"><span>O que precisa acontecer agora?</span><textarea id="handoff-next" rows="3" placeholder="Ex.: Tainara deve conferir a legenda e agendar para segunda-feira."></textarea></label><label class="workflow-field"><span>Link ou arquivo de referência (opcional)</span><input id="handoff-link" type="url" placeholder="https://drive.google.com/... ou link do arquivo"></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitHandoff()">REGISTRAR E ${option ? 'ATUALIZAR STATUS' : 'SALVAR'} →</button></div>`); }
function openManualHandoff(itemId) { const item=findOperationalItem(itemId); if (item) openHandoffGate(item,null); }
