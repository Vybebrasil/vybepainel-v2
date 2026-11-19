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
  // Captação agendada e espera simples seguem direto, sem formulário obrigatório.
  'cap. agendada','aguardo',
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
// A peça no alto de toda janela de troca de status, como na direção de arte:
// ícone do formato, cliente e formato em cima, o nome embaixo e, à direita, o
// status de agora → o de destino em duas pílulas. `target` que não é status
// ("sinalizar bloqueio") aparece só como a pílula de destino.
function workflowItemHtml(item, target='') {
  const formato = String(item.formato || '').trim();
  const de = item.status ? (typeof pillHtml === 'function' ? pillHtml(item.status, item.status_color, item.status_border) : `<span class="pill">${safeText(item.status)}</span>`) : '';
  const para = target && target !== item.status ? `<span class="pill workflow-item-destino"><span class="pill-dot"></span>${safeText(target)}</span>` : '';
  return `<div class="workflow-item"><span class="workflow-item-ic" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M3 8h14"/></svg></span><span class="workflow-item-texto"><span class="workflow-item-client">${safeText(item.cliente || 'Cliente não informado')}${formato ? ` · ${safeText(formato)}` : ''}</span><span class="workflow-item-name">${safeText(item.nome)}</span></span>${de || para ? `<span class="workflow-item-fluxo">${de}${de && para ? '<i aria-hidden="true">→</i>' : ''}${para}</span>` : ''}</div>`;
}
// Etapas do portão em pílula (família Formulário do padrão v2): conferir é a 1, a troca de status é a 2.
function etapasDoPortao(destino) { return typeof vbEtapasHtml === 'function' ? vbEtapasHtml(['Conferir', `Mudar para ${destino || 'o status novo'}`], 0) : ''; }
function closeWorkflowModal() { const origem=document.getElementById('workflow-modal')?.returnFocus; document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); pendingWorkflowChange = null; if(origem?.isConnected) origem.focus(); }
function openWorkflowModal(html) { document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); const back=document.createElement('div'); back.id='workflow-backdrop'; back.className='workflow-backdrop'; back.onclick=closeWorkflowModal; const modal=document.createElement('section'); modal.id='workflow-modal'; modal.className='workflow-modal'; modal.innerHTML=html; if(janelaV2DoPortao(html)) modal.classList.add('d3-tema'); document.body.append(back,modal); }
// Portão da peça (o cartão da peça de workflowItemHtml no topo): a janela é toda escrita com os tokens V2
// (padrao-v2/zm-h-1-janelas.css), então leva d3-tema e escurece junto no tema Escuro. As outras janelas ficam folha clara.
function janelaV2DoPortao(html) { return /class="workflow-item"/.test(String(html||'')); }
// ── PEÇAS COMUNS DAS JANELAS V2-S (pranchas V2-S-Datas-da-Peca, V2-S-Conferir-Status, V2-S-Pergunta e
// V2-S-Previa-Grande, 19/11/2026) ─────────────────────────────────────────────────────────────────────────
// Uma janela só: vidro fumê de canto 20, título de 20 com a frase embaixo (e o avatar do cliente quando a janela é
// de uma peça), o fechar de 34 à direita e o pé com a nota à esquerda e os botões de 34 à direita. O desenho mora em
// padrao-v2/s-b.css (classes vbj-*), só com tokens: os três temas saem de lá.
const VBJ_ICONES = {
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  dir: '<path d="M9 6l6 6-6 6"/>',
  esq: '<path d="M15 6l-6 6 6 6"/>',
  certo: '<path d="M5 12l5 5 9-10"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
function vbjIcone(nome, tamanho = 14) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VBJ_ICONES[nome] || ''}</svg>`;
}
// Sigla do cliente no avatar: as iniciais das duas primeiras palavras (Academia Lions → AL) ou as duas primeiras
// letras quando o nome é uma palavra só (Hebravet → HE). A cor é a da carteira (corDoClienteV2), sob um véu escuro.
function vbjSiglaDoCliente(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
}
function vbjAvatarHtml(nome, classe = 'vbj-av') {
  const cor = typeof corDoClienteV2 === 'function' ? corDoClienteV2(nome) : '#6B665E';
  return `<span class="${classe}" style="--c:${safeText(cor)}" aria-hidden="true">${safeText(vbjSiglaDoCliente(nome))}</span>`;
}
// Status com o ponto na cor do quadro (a mesma cor do menu de status).
function vbjStatusHtml(rotulo, cor = '') {
  if (!rotulo) return '';
  const c = cor || (typeof corDeStatus === 'function' ? corDeStatus(rotulo)?.cor : '') || '';
  return `<span class="vbj-st"${c ? ` style="--st:${safeText(c)}"` : ''}><i></i>${safeText(rotulo)}</span>`;
}
function vbjTopoHtml({ titulo = '', sub = '', av = '', fechar = 'closeWorkflowModal()', idTitulo = 'vbj-titulo' } = {}) {
  return `<div class="vbj-topo"><div class="vbj-cab">${av}<div class="vbj-tit"><h2 class="vbj-titulo" id="${idTitulo}">${safeText(titulo)}</h2>${sub ? `<span class="vbj-sub">${safeText(sub)}</span>` : ''}</div></div>
    <button type="button" class="vbj-x" aria-label="Fechar" title="Fechar" onclick="${fechar}">${vbjIcone('x', 16)}</button></div>`;
}
// Abre a janela V2 no #workflow-modal de sempre (o tutorial já espera ele fechar, PR #729) com a casca vbj.
function abrirJanelaV2(html, classes = '') {
  openWorkflowModal(html);
  const janela = document.getElementById('workflow-modal');
  if (!janela) return null;
  janela.classList.add('vbj', 'd3-tema', ...String(classes).split(/\s+/).filter(Boolean));
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-modal', 'true');
  if (janela.querySelector('#vbj-titulo')) janela.setAttribute('aria-labelledby', 'vbj-titulo');
  return janela;
}
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
// A conta "x de N" das caixas da conferência. Na janela V2-S (.vbc) ela mora no cabeçalho da lista, com a barrinha;
// nas outras (direção de arte) segue a barra "x de N conferidos" em cima da lista.
function pintarConferidos(form) {
  if (!form) return;
  const caixas = [...form.querySelectorAll('input[type=checkbox]')], feitas = caixas.filter((c) => c.checked).length;
  const pct = caixas.length ? Math.round(feitas / caixas.length * 100) : 0;
  const conta = form.closest('.vbc')?.querySelector('.vbc-conta');
  if (conta) {
    const n = conta.querySelector('b'); if (n) n.textContent = `${feitas} de ${caixas.length}`;
    conta.style.setProperty('--p', `${pct}%`);
  } else {
    let barra = form.previousElementSibling?.classList?.contains('workflow-conferidos') ? form.previousElementSibling : null;
    if (!barra) { barra = document.createElement('div'); barra.className = 'workflow-conferidos'; form.before(barra); }
    barra.innerHTML = `<span><b>${feitas} de ${caixas.length}</b> conferidos</span><i style="--p:${pct}%"></i>`;
  }
  caixas.forEach((c) => c.closest('label')?.classList.toggle('feito', c.checked));
}
function updateQualityGateState() { pintarConferidos(document.getElementById('quality-checklist-form')); const form=document.getElementById('quality-checklist-form'); const button=document.getElementById('quality-submit'); if (!form || !button) return; button.disabled=[...form.querySelectorAll('input[type=checkbox]')].some(input => !input.checked); }

// ── CONFERIR ANTES DE TROCAR O STATUS (prancha V2-S-Conferir-Status) ──────────────────────────────────────────
// As três conferências (qualidade, material e a visual de "Para aprovação") são a mesma janela: a peça com o de → para
// no alto, as caixas reais com a conta "x de N" e a prévia ao lado com Ver grande, Abrir e Trocar. "Confirmar" fica
// apagado até tudo estar marcado (a conferência visual não tem caixa e já nasce liberada). O que cada uma grava no
// histórico e a ordem do bastão não mudam: só a janela.
function janelaDeConferenciaHtml({ item, option, titulo, sub, cab, idForm = '', mudar = '', checks = [], marca = '', nota, idBotao, onclick, acao, desligado = true }) {
  const formato = String(item.formato || item.tipo || '').trim();
  const veic = /^\d{4}-\d{2}-\d{2}/.test(String(item.veiculacao_iso || '')) ? ` · veiculação ${item.veiculacao_iso.slice(8, 10)}/${item.veiculacao_iso.slice(5, 7)}` : '';
  const destino = option?.label || '';
  const caixas = checks.length
    ? `<div class="vbc-lista-cab"><b>${safeText(cab)}</b><span class="vbc-conta" style="--p:0%"><b>0 de ${checks.length}</b><span class="vbc-barra" aria-hidden="true"><i></i></span></span></div>
      <form id="${idForm}" class="vbc-checks" onchange="${mudar}">${checks.map((check, i) => `<label class="vbc-check"><input type="checkbox" ${marca} name="${idForm}-${i}"><span class="vbc-caixa" aria-hidden="true">${vbjIcone('certo', 12)}</span><span class="vbc-check-txt">${safeText(check)}</span></label>`).join('')}</form>`
    : `<div class="vbc-lista-cab"><b>${safeText(cab)}</b></div>`;
  return `${vbjTopoHtml({ titulo, sub })}
    <div class="vbc-grade">
      <div class="vbc-esq">
        <div class="vbc-peca">${vbjAvatarHtml(item.cliente)}<span class="vbc-peca-txt"><b>${safeText(item.nome || 'Sem título')}</b><span>${safeText([item.cliente || 'Cliente não informado', formato].filter(Boolean).join(' · '))}${safeText(veic)}</span></span>
          <span class="vbc-de-para">${vbjStatusHtml(item.status, item.status_color)}${item.status && destino ? vbjIcone('dir', 14) : ''}${vbjStatusHtml(destino !== item.status ? destino : '', option?.color)}</span></div>
        ${caixas}
        <p class="vbc-nota">${safeText(nota)}</p>
      </div>
      <div class="vbc-dir">
        <div class="vbc-prev-cab"><b>Prévia para conferir</b><span id="vbc-prev-info">arquivo vinculado</span></div>
        <div id="material-review-preview" class="vbc-palco"><div class="vbc-vazio">Carregando a prévia…</div></div>
        <div id="vbc-prev-acoes" class="vbc-prev-acoes"></div>
      </div>
    </div>
    <div class="vbj-pe"><span class="vbj-passos"><span class="vbj-tracos" aria-hidden="true"><i class="on"></i><i></i></span>1 de 2 · conferir, depois mudar para ${safeText(destino || 'o status novo')}</span>
      <button type="button" class="vbj-btn" onclick="closeWorkflowModal()">Cancelar</button>
      <button id="${idBotao}" type="button" class="vbj-btn k"${desligado ? ' disabled' : ''} onclick="${onclick}">${safeText(acao)}</button></div>`;
}
function openQualityGate(item, option) {
  if (precisaDeConferenciaFinal(item, option)) return openMaterialReviewGate(item, option);
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option, titulo: 'Checklist de qualidade', sub: 'confira a prévia e os pontos essenciais antes da publicação',
    cab: `Antes de mandar para ${option.label}`, idForm: 'quality-checklist-form', mudar: 'updateQualityGateState()', checks: qualityChecklistFor(item),
    nota: 'O registro fica no histórico da peça. Alterações diretas no Monday não passam por esta conferência.',
    idBotao: 'quality-submit', onclick: 'submitQualityChecklist()', acao: 'Continuar' }), 'vbc');
  loadMaterialReviewPreview(item.id);
  updateQualityGateState();
}
async function submitQualityChecklist() { const flow=pendingWorkflowChange; const form=document.getElementById('quality-checklist-form'); if (!flow || !form) return; const checks=[...form.querySelectorAll('label')].map(label=>label.textContent.trim()).filter(Boolean); const button=document.getElementById('quality-submit'); if (button) button.disabled=true; try { await postItemUpdate(flow.item.id, `[Vybe OS · Checklist de qualidade]\nDestino: ${flow.option.label}\nFormato: ${flow.item.formato || flow.item.tipo || 'Conteúdo'}\nValidado: ${checks.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if (statusNeedsHandoff(item,option)) openHandoffGate(item,option); else await commitStatusChange(item,option); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o checklist: ${e.message}`,'err',7000); } }
function materialReviewChecklistFor(item, option) { const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const format=String(item?.formato||item?.tipo||'conteúdo'); return scheduled ? [`Conferi a prévia final de ${format} antes do agendamento`,`Confirmei que legenda, CTA, canal e data de publicação estão corretos`,`O arquivo ou link aberto corresponde a esta demanda`] : [`Conferi a prévia do material entregue ou publicado`,`Confirmei que o destino final corresponde a esta demanda`,`Não há pendência de publicação ou material incorreto antes de finalizar`]; }
function updateMaterialReviewState(){ pintarConferidos(document.getElementById('material-review-form')); const checks=[...document.querySelectorAll('input[data-material-review-check]')]; const button=document.getElementById('material-review-submit'); if(button) button.disabled=!checks.length||checks.some(check=>!check.checked); }
function materialReviewPreviewFailed(image){ const fallback=String(image?.dataset?.fallbackSrc||''); if(fallback&&image.dataset.fallbackTried!=='true'){ image.dataset.fallbackTried='true'; image.src=fallback; return; } const holder=image.closest('.vbc-palco'); if(holder) holder.innerHTML='<div class="vbc-vazio"><b>Prévia indisponível</b>Abra o material vinculado para conferir o arquivo final.</div>'; }
// A prévia ao lado das caixas. Com mais de uma arte, as setas do palco passam entre elas e o cabeçalho diz "1 de 3":
// conferir só a primeira e aprovar seria aprovar no escuro o resto do carrossel. Embaixo, Ver grande (a Prévia grande
// com todas), Abrir (o link de entrega ou o próprio arquivo) e Trocar (fecha e abre a peça para anexar outro).
function acoesDaPreviaDaConferencia({ temArte = false, abrir = '' } = {}) {
  const acoes = document.getElementById('vbc-prev-acoes');
  if (!acoes) return;
  acoes.innerHTML = `${temArte ? `<button type="button" class="vbj-btn" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)">${vbjIcone('olho', 14)}Ver grande</button>` : ''}${abrir ? `<a class="vbj-btn" href="${safeText(abrir)}" target="_blank" rel="noopener">${vbjIcone('link', 14)}Abrir</a>` : ''}<button type="button" class="vbj-btn vbj-txt" onclick="const f=pendingWorkflowChange;closeWorkflowModal();if(f?.item)openItemWorkspace(f.item.id)">${temArte || abrir ? 'Trocar' : 'Anexar material'}</button>`;
}
async function loadMaterialReviewPreview(itemId){
  const holder=document.getElementById('material-review-preview');
  if(!holder) return;
  const info=document.getElementById('vbc-prev-info');
  try {
    const detail=await fetchWorkspaceItem(itemId);
    const assets=statusContextPreviewAssets(detail);
    const delivery=workspaceDeliveryInfo(detail);
    PREVIA_MATERIAL=assets; PREVIA_DA_PECA='';
    PREVIA_GRANDE_INDICE=0;
    if(!document.body.contains(holder)) return;
    if(!assets.length){
      holder.innerHTML=`<div class="vbc-vazio"><b>Sem prévia visual</b>${delivery?.url?'Há um material vinculado. Abra-o antes de confirmar a conferência.':'Nenhum arquivo ou link final foi localizado nesta peça.'}</div>`;
      if(info) info.textContent=delivery?.url?'link de entrega':'sem arquivo';
      acoesDaPreviaDaConferencia({ abrir: delivery?.url || '' });
      return;
    }
    const primeira=assets[0];
    const fonte=primeira.url_thumbnail||primeira.public_url||primeira.url||'';
    if(!fonte){
      holder.innerHTML=`<div class="vbc-vazio"><b>Arquivo sem prévia</b>${delivery?.url?'Abra o material vinculado para conferir o arquivo final.':'O item não disponibiliza imagem de visualização.'}</div>`;
      acoesDaPreviaDaConferencia({ abrir: delivery?.url || primeira.public_url || primeira.url || '' });
      return;
    }
    const setas=assets.length>1
      ? `<button type="button" class="vbj-ic vbc-seta antes" aria-label="Arquivo anterior" title="Arquivo anterior" onclick="passarPreviaDaConferencia(-1)">${vbjIcone('esq',16)}</button><button type="button" class="vbj-ic vbc-seta depois" aria-label="Próximo arquivo" title="Próximo arquivo" onclick="passarPreviaDaConferencia(1)">${vbjIcone('dir',16)}</button>`
      : '';
    holder.innerHTML=`<img id="material-review-img" src="${safeText(fonte)}" alt="Prévia de ${safeText(primeira.name||'material')}" loading="eager" title="Clique para ver em tamanho grande" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)" onerror="materialReviewPreviewFailed(this)">${setas}<small id="material-review-caption" class="vbc-legenda">${safeText(primeira.name||'Prévia vinculada ao item')}</small>`;
    if(info) info.textContent=`arquivo vinculado · 1 de ${assets.length}`;
    acoesDaPreviaDaConferencia({ temArte: true, abrir: delivery?.url || primeira.public_url || primeira.url || '' });
  } catch(error){
    holder.innerHTML='<div class="vbc-vazio"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. Feche e tente novamente antes de confirmar.</div>';
    acoesDaPreviaDaConferencia({});
  }
}
function passarPreviaDaConferencia(passo) {
  const total = PREVIA_MATERIAL.length;
  if (total < 2) return;
  trocarPreviaMaterial((PREVIA_GRANDE_INDICE + passo + total) % total);
}
function openMaterialReviewGate(item, option) {
  const scheduled = normalizedWorkflowStatus(option?.label) === 'agendado';
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option,
    titulo: scheduled ? 'Conferir antes de agendar' : 'Conferir antes de finalizar',
    sub: scheduled ? 'a peça só muda para Agendado depois da conferência' : 'confira o material postado ou entregue antes de encerrar',
    cab: scheduled ? 'Antes de liberar o agendamento' : 'Antes de marcar como finalizado',
    idForm: 'material-review-form', mudar: 'updateMaterialReviewState()', checks: materialReviewChecklistFor(item, option), marca: 'data-material-review-check',
    nota: scheduled ? 'A conferência fica no histórico da peça junto com a troca de status. Não é preciso justificar.'
      : 'A conferência fica no histórico da peça junto com a troca de status. Nenhuma justificativa é exigida para finalizar.',
    idBotao: 'material-review-submit', onclick: 'submitMaterialReview()', acao: scheduled ? 'Confirmar e agendar' : 'Confirmar e finalizar' }), 'vbc');
  loadMaterialReviewPreview(item.id);
  updateMaterialReviewState();
}
async function submitMaterialReview(){ const flow=pendingWorkflowChange; const checks=[...document.querySelectorAll('input[data-material-review-check]')]; if(!flow||!checks.length) return; if(checks.some(check=>!check.checked)) return showToast('Confirme a conferência visual antes de continuar.','info'); const button=document.getElementById('material-review-submit'); if(button){button.disabled=true;button.textContent='Registrando...';} try { const checked=checks.map(check=>check.parentElement.textContent.trim()).filter(Boolean); await postItemUpdate(flow.item.id,`[Vybe OS · Conferência final]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMaterial conferido: ${checked.join(' | ')}`); const {item,option}=flow; closeWorkflowModal(); await commitStatusChange(item,option); } catch(error){ if(button){button.disabled=false;button.textContent=normalizedWorkflowStatus(flow?.option?.label)==='agendado'?'Confirmar e agendar':'Confirmar e finalizar';} showToast(`Não foi possível registrar a conferência: ${error.message}`,'err',7000); } }
// ── conferencia visual ────────────────────────────────────────────────────────
// A arte ao lado, e duas saidas: voltar ou mandar. Sem campo obrigatorio, sem
// checklist, sem trava. Se a peca tiver mais de um arquivo, as setas do palco
// passam entre eles e o cabecalho diz "1 de N" — quem confere quer ver o que
// vai ser aprovado, nao so o primeiro. Mesma janela das outras conferencias
// (prancha V2-S-Conferir-Status), so que sem caixas: Confirmar ja nasce ligado.
function abrirConferenciaVisual(item, option) {
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option, titulo: 'Confira antes de mandar', sub: `a arte vai para ${option.label}`,
    cab: 'A arte que vai para aprovação', nota: 'Sem campo obrigatório: olhe a arte e confirme. A troca fica no histórico da peça.',
    idBotao: 'conferencia-confirmar', onclick: 'confirmarConferenciaVisual()', acao: 'Confirmar', desligado: false }), 'vbc conferencia-visual');
  loadMaterialReviewPreview(item.id);
}

async function confirmarConferenciaVisual() {
  const fluxo = pendingWorkflowChange;
  if (!fluxo) return;
  const botao = document.getElementById('conferencia-confirmar');
  if (botao) { botao.disabled = true; botao.textContent = 'Mandando…'; }
  const { item, option } = fluxo;
  // A nota de historico nao segura a troca — a mesma regra de todos os portoes.
  void postItemUpdate(item.id, `[Vybe OS · Conferência visual]\nEtapa: ${item.status} → ${option.label}`);
  closeWorkflowModal();
  await commitStatusChange(item, option);
}

// Uma pergunta por vez: o que ficou pronto vira botões que escrevem o
// "concluído", o próximo passo já vem sugerido pela etapa de destino e o link
// da entrega da peça entra sozinho quando existe. Os campos mantêm os ids que
// submitHandoff lê.
const BASTAO_PRONTOS = ['Arte final', 'Legenda revisada', 'Arquivo anexado', 'Aprovado internamente', 'Vídeo editado', 'Roteiro pronto'];
function facilitarPassagemDeBastao(item, option) {
  const feito = document.getElementById('handoff-done');
  const proximo = document.getElementById('handoff-next');
  const link = document.getElementById('handoff-link');
  if (!feito) return;
  feito.insertAdjacentHTML('beforebegin', `<div class="pv-sugestoes" id="handoff-prontos">${BASTAO_PRONTOS.map((p) => `<button type="button" onclick="alternarProntoDoBastao(this)">${safeText(p)}</button>`).join('')}</div>`);
  feito.rows = 2;
  if (proximo && !proximo.value && option?.label) proximo.value = `Segue para ${option.label}.`;
  const entrega = String(item?.link_entrega || item?.entrega_link || item?.link || '').trim();
  if (link && !link.value && /^https?:\/\//i.test(entrega)) link.value = entrega;
}
function alternarProntoDoBastao(botao) {
  botao.classList.toggle('on');
  const marcados = [...document.querySelectorAll('#handoff-prontos button.on')].map((b) => b.textContent);
  const feito = document.getElementById('handoff-done');
  if (feito) feito.value = marcados.join(' · ');
}
// Rodada S (frente e): a passagem de bastão na casca das janelas V2 (vbj, padrao-v2/s-b.css), como os portões da rodada
// R (prancha V2-R-Janelas-Temas): no vidro o nome do pedido, "1 de 3 · entregou" e o fechar; numa folha a peça com o
// de → para, as etapas com nome e a pergunta da vez; no pé, no vidro, os traços, "Nada muda até você confirmar." e os
// botões. Os ids que submitHandoff e passoDoBastao leem são os mesmos; o desenho mora em padrao-v2/s-e.css (vbb-*),
// só com tokens, e sai nos três temas.
const BASTAO_ETAPAS = ['Entregou', 'Próximo', 'Confirmar'];
function openHandoffGate(item, option=null) {
  pendingWorkflowChange={item,option,manual:!option};
  const target=option?.label || '';
  const formato=String(item.formato || item.tipo || '').trim();
  const html=`${vbjTopoHtml({ titulo: 'Passar o bastão', sub: `1 de ${BASTAO_ETAPAS.length} · ${BASTAO_ETAPAS[0].toLowerCase()}`, idTitulo: 'bastao-titulo' })}
<div class="vbb-folha">
<div class="vbc-peca vbb-peca">${vbjAvatarHtml(item.cliente)}<span class="vbc-peca-txt"><b>${safeText(item.nome || 'Sem título')}</b><span>${safeText([item.cliente || 'Cliente não informado', formato].filter(Boolean).join(' · '))}</span></span><span class="vbc-de-para">${vbjStatusHtml(item.status, item.status_color)}${item.status ? vbjIcone('dir', 14) : ''}${target && target !== item.status ? vbjStatusHtml(target, option?.color) : `<span class="vbb-alvo">${safeText(target || 'próxima pessoa ou etapa')}</span>`}</span></div>
<div class="vbb-etapas" aria-hidden="true">${BASTAO_ETAPAS.map((nome, i) => `<span data-bastao-passo="${i}"${i ? '' : ' class="atual"'}>${nome}</span>`).join('')}</div>
<div class="vbb-corpo">
<section data-bastao="0"><p class="vbb-q">O que você deixou pronto?</p><label class="vbb-campo"><span class="vbb-rot">Marque ou escreva</span><textarea id="handoff-done" rows="3" placeholder="Ex.: Arte revisada, versão final aprovada internamente e arquivo anexado."></textarea></label><label class="vbb-campo"><span class="vbb-rot">Link ou arquivo de referência (opcional)</span><input id="handoff-link" type="url" placeholder="https://drive.google.com/... ou link do arquivo"></label></section>
<section data-bastao="1" hidden><p class="vbb-q">O que precisa acontecer agora?</p><label class="vbb-campo"><span class="vbb-rot">O próximo passo, para quem pega</span><textarea id="handoff-next" rows="3" placeholder="Ex.: Tainara deve conferir a legenda e agendar para segunda-feira."></textarea></label></section>
<section data-bastao="2" hidden><p class="vbb-q">Confira antes de registrar</p><dl id="bastao-revisao" class="bastao-revisao vbb-revisao"></dl></section>
</div></div>
<div class="vbj-pe"><span class="vbj-passos"><span class="vbj-tracos" aria-hidden="true">${BASTAO_ETAPAS.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span><span><span id="bastao-onde">1 de ${BASTAO_ETAPAS.length}</span> · nada muda até você confirmar.</span></span><button type="button" id="bastao-voltar" class="vbj-btn" onclick="passoDoBastao(-1)">Cancelar</button><button type="button" id="bastao-seguir" class="vbj-btn k" onclick="passoDoBastao(1)">Continuar</button></div>`;
  if (typeof abrirJanelaV2 === 'function') abrirJanelaV2(html, 'vbb'); else openWorkflowModal(html);
  facilitarPassagemDeBastao(item, option); BASTAO_FIM = `Registrar e ${option ? 'atualizar o status' : 'salvar'}`;
}
// Uma pergunta por vez (direção de arte): Entregou → Próximo → Confirmar. Os
// campos são os mesmos (submitHandoff lê handoff-done, handoff-next e
// handoff-link); só um passo fica à vista e o último mostra o resumo.
let BASTAO_FIM = 'Registrar';
function passoDoBastao(dir) {
  const modal = document.getElementById('workflow-modal'); if (!modal) return;
  const secoes = [...modal.querySelectorAll('[data-bastao]')];
  const atual = secoes.findIndex((x) => !x.hidden), ir = atual + dir;
  if (ir < 0) return closeWorkflowModal();
  if (ir >= secoes.length) return submitHandoff();
  secoes.forEach((x, i) => { x.hidden = i !== ir; });
  modal.querySelectorAll('[data-bastao-passo]').forEach((li) => { const n = Number(li.dataset.bastaoPasso); li.classList.toggle('atual', n === ir); li.classList.toggle('feito', n < ir); });
  const v = (id) => String(document.getElementById(id)?.value || '').trim();
  if (ir === secoes.length - 1) { const rev = document.getElementById('bastao-revisao'); if (rev) rev.innerHTML = [['Pronto', v('handoff-done')], ['Próximo passo', v('handoff-next')], ['Link', v('handoff-link')]].map(([k, x]) => `<div><dt>${k}</dt><dd>${safeText(x || '—')}</dd></div>`).join(''); }
  document.getElementById('bastao-onde').textContent = `${ir + 1} de ${secoes.length}`;
  modal.querySelectorAll('.vbj-tracos i').forEach((t, i) => t.classList.toggle('on', i <= ir));
  const sub = modal.classList.contains('vbb') ? modal.querySelector('.vbj-sub') : null;
  if (sub) sub.textContent = `${ir + 1} de ${secoes.length} · ${String(BASTAO_ETAPAS[ir] || '').toLowerCase()}`;
  document.getElementById('bastao-voltar').textContent = ir ? 'Voltar' : 'Cancelar';
  document.getElementById('bastao-seguir').textContent = ir === secoes.length - 1 ? BASTAO_FIM : 'Continuar';
  secoes[ir].querySelector('textarea,input')?.focus();
}
// A passagem de bastão leva a peça à etapa seguinte (Paulo, 16/11/2026: "de EM ANDAMENTO precisa ir PARA APROVAÇÃO...
// e de PARA APROVAÇÃO para PARA AGENDAR"). Antes o botão "Passar bastão" só registrava o comentário e a peça ficava
// onde estava. O mapa é por chave do rótulo (sem acento, minúsculas, '_'), a mesma de chaveDeStatus, para valer com
// "Para Aprovação" ou "Para aprovação". Status fora do mapa (ou destino que o quadro não tem) seguem como antes:
// só o registro, sem trocar o status.
const BASTAO_PROXIMA_ETAPA = Object.freeze({ em_andamento: 'para_aprovacao', para_aprovacao: 'para_agendar' });
const chaveDoBastao = (rotulo) => String(rotulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function destinoDoBastao(item) {
  const alvo = BASTAO_PROXIMA_ETAPA[chaveDoBastao(item?.status)];
  if (!alvo) return null;
  const opcoes = typeof operationalStatusOptions === 'function' ? (operationalStatusOptions(item) || []) : [];
  return opcoes.find((o) => o && o.ativa !== false && chaveDoBastao(o.label) === alvo) || null;
}
// Depois do registro, a troca passa pelos portões de sempre: Para aprovação pela conferência visual (updateFocusStatus);
// sair de Para aprovação é aprovar, e aprovar abre o checklist de qualidade, como o botão Aprovar da gaveta.
function seguirDepoisDoBastao(item, option) {
  if (chaveDoBastao(item?.status) === 'para_aprovacao' && typeof openQualityGate === 'function') return openQualityGate(item, option);
  return updateFocusStatus(String(item.id), option.label);
}
function openManualHandoff(itemId) { const item=findOperationalItem(itemId); if (!item) return; const destino=destinoDoBastao(item); openHandoffGate(item,destino); if (destino && pendingWorkflowChange) pendingWorkflowChange.bastao=true; }
