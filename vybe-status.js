// vybe-status.js — trocar o status de uma peça, do seletor até a gravação.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// O caminho inteiro num lugar só: a pastilha que abre a lista, o contexto que
// certos status exigem antes de entrar, quem o painel pré-atribui pelo histórico,
// o efeito das automações que respondem à mudança e a gravação no banco.
//
// Vem junto o ancorarPopover, o posicionador de popover que nasceu aqui e hoje
// serve também o seletor de escolha e o menu de lote. Fica neste arquivo por ser
// onde foi escrito; movê-lo para um arquivo de utilidades é decisão para quando
// houver mais de um caso assim.
//
// Carrega DEPOIS de vybe-risco.js e de vybe-portoes.js: lê DADOS, HOJE_ISO,
// findOperationalItem e pendingWorkflowChange, e chama os portões.

let statusEditorItemId = '';
function closeStatusEditor() {
  document.getElementById('status-editor-backdrop')?.remove();
  document.getElementById('status-editor')?.remove();
  statusEditorItemId = '';
}
// Popover ancorado no controle que o abriu. O cálculo antigo alinhava a BORDA
// DIREITA do painel com a borda direita da pílula, então um painel de 310px
// pendurava 300px para a esquerda de um controle de 90px e parecia solto na
// tela. Alinha pela esquerda, sobe quando não cabe embaixo e nunca vaza da
// janela — e mede depois de entrar no DOM, senão a altura é um chute.
function ancorarPopover(menu, rect) {
  const margem = 10;
  menu.style.visibility = 'hidden';
  menu.style.top = '0px';
  menu.style.left = '0px';
  const { width, height } = menu.getBoundingClientRect();
  const cabeAbaixo = rect.bottom + 6 + height <= window.innerHeight - margem;
  const desejado = cabeAbaixo ? rect.bottom + 6 : rect.top - 6 - height;
  // O popover nunca sai da tela, mesmo quando o que o ancora esta fora dela.
  // Acontecia ao abrir o cartao de uma peca listada dentro de outro popover: a
  // ficha clicada ficava abaixo da dobra, e o cartao nascia com metade cortada.
  // Sem teto, so o topo era protegido; agora o rodape tambem.
  const limite = window.innerHeight - height - margem;
  const top = height + margem * 2 >= window.innerHeight ? margem
    : Math.min(Math.max(margem, desejado), Math.max(margem, limite));
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(Math.min(Math.max(margem, rect.left), Math.max(margem, window.innerWidth - width - margem)))}px`;
  menu.style.visibility = '';
}

// O conserto onde a duvida nasce.
//
// A juncao dos dois nomes de aprovacao morava num botao na tela de Demandas. So
// que a duvida — "qual a diferenca entre estes dois?" — nasce AQUI, com a lista
// aberta. Fazer a pessoa sair da tela, achar outra tela e achar um botao para
// resolver o que esta na frente dela e um jeito de garantir que nao vai ser
// resolvido. Entao a saida aparece junto do problema, so para quem administra e
// so enquanto os dois existirem.
function juntarAprovacaoNoSeletorHtml(item) {
  if (typeof isRequestItem !== 'function' || !isRequestItem(item)) return '';
  if (typeof podeAdministrar !== 'function' || !podeAdministrar()) return '';
  if (typeof aprovacoesParaAbsorver !== 'function') return '';
  const sobrando = aprovacoesParaAbsorver();
  const juntar = sobrando.length ? `<button type="button" class="status-editor-arrumar"
    onclick="closeStatusEditor();juntarAprovacoes()"
    title="${safeText(sobrando.join(' · '))} deixam de existir; tudo passa a ser Para Aprovação">
    juntar “${safeText(sobrando[0])}” em “Para Aprovação”</button>` : '';
  // Acrescentar mora ao lado de juntar: as duas sao a mesma pergunta — "esta
  // lista esta certa?" — e ela nasce aqui, com a lista aberta na frente.
  // Criar e reordenar saem daqui: viraram o rodape que TODO menu de etiqueta
  // tem. Sobra o que e so daqui — juntar dois nomes de aprovacao.
  return juntar;
}

// O rotulo vai dentro de um onclick, entre aspas simples. Escapar antes do
// safeText e a ordem que funciona: a barra sobrevive ao escape de HTML e o
// navegador devolve a aspa ja neutralizada para o JavaScript.
function paraAtributo(texto) { return safeText(String(texto ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
function mesmoStatus(a, b) {
  return typeof chaveDeStatus === 'function'
    ? chaveDeStatus(a) === chaveDeStatus(b)
    : String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
function openStatusEditor(event, itemId) {
  event.preventDefault();
  event.stopPropagation();
  closeStatusEditor();
  const item = findOperationalItem(itemId);
  if (!item) return showToast('Item não encontrado para atualização.', 'err');
  const statusOptions = operationalStatusOptions(item);
  if (!statusOptions.length) return showToast('As opções de status ainda estão carregando.', 'info');
  statusEditorItemId = String(itemId);
  const rect = event.currentTarget.getBoundingClientRect();
  const backdrop = document.createElement('div');
  backdrop.id = 'status-editor-backdrop';
  backdrop.className = 'status-editor-backdrop';
  backdrop.onclick = closeStatusEditor;
  const menu = document.createElement('div');
  menu.id = 'status-editor';
  menu.className = 'status-editor';
  // O menu de status e uma lista de etiquetas como as outras, e por muito tempo
  // foi a unica sem as ferramentas delas: dava para renomear, recolorir, apagar
  // e reordenar uma etiqueta de Formato, e nada disso em Status. Agora chama as
  // mesmas funcoes — nao uma copia parecida.
  const colunaDoStatus = `status:${isRequestItem(item) ? BOARD_DEMANDAS_ID : BOARD_ID}`;
  const nomeDoCampo = isRequestItem(item) ? 'Status da solicitação' : 'Status do conteúdo';
  const comFerramentas = typeof ferramentasDaEtiquetaHtml === 'function';
  menu.innerHTML = `<div class="status-editor-head">${isRequestItem(item)?'Solicitação':'Status'}</div>${statusOptions.map(o => {
    const atual = mesmoStatus(o.label, item.status);
    const linha = `<button type="button" class="status-editor-option ${atual ? 'current' : ''}" onclick="updateFocusStatus('${item.id}','${paraAtributo(o.label)}')"><span class="status-editor-dot" style="background:${o.color};color:${o.color}"></span><span>${safeText(o.label)}${o.ativa === false ? ' (desligada)' : ''}</span>${atual ? '<span class="status-editor-check">✓</span>' : ''}</button>`;
    if (!comFerramentas || !o.chave) return linha;
    const etiqueta = { chave: o.chave, rotulo: o.label, cor: o.color, ativa: o.ativa !== false };
    return `<div class="etiqueta-linha ${o.ativa === false ? 'desligada' : ''}">${linha}${ferramentasDaEtiquetaHtml(colunaDoStatus, 'status', etiqueta)}${chaveDaEtiquetaHtml(colunaDoStatus, 'status', etiqueta)}</div>`;
  }).join('')}${juntarAprovacaoNoSeletorHtml(item)}${comFerramentas ? rodapeDeEtiquetasHtml(colunaDoStatus, 'status', nomeDoCampo) : ''}`;
  document.body.append(backdrop, menu);
  ancorarPopover(menu, rect);
}
function updateLocalStatus(itemId, option) {
  const logs = window.ACTIVITY_LOGS || (window.ACTIVITY_LOGS = {moveEvents:{}, prazoEvents:{}, statusEvents:{}});
  logs.statusEvents = logs.statusEvents || {};
  const key = String(itemId);
  logs.statusEvents[key] = logs.statusEvents[key] || [];
  logs.statusEvents[key].push({ status: option.label, previousStatus: '', date: HOJE_ISO || '', tsMs: Date.now() });
  [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach(list => (list || []).forEach(d => {
    if (String(d.id) !== key) return;
    d.status = option.label;
    d.status_color = option.color;
    d.status_border = option.border;
    d.status_index = option.index;
    d.operational_risk = getOperationalRisk(d);
  }));
}

function openDaDirectionModal(itemId) { const item=findOperationalItem(itemId); if(!item) return showToast('Demanda não encontrada.', 'err'); pendingDaDirectionItemId=String(itemId); const owners=daControllerTeam().map(user=>`<option value="${user.id}">${safeText(firstName(user.name))}</option>`).join(''); openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Direcionamento de arte</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Direcionar esta demanda</h2><p class="workflow-copy">Registre a decisão visual no histórico da peça para que o time execute sem depender do WhatsApp.</p>${workflowItemHtml(item,item.status)}<label class="workflow-field"><span>Qual é a direção objetiva?</span><textarea id="da-direction-text" rows="4" placeholder="Ex.: Ajustar a hierarquia do título, trocar a imagem principal e usar a referência enviada pelo cliente."></textarea></label><label class="workflow-field"><span>Quem precisa agir agora?</span><select id="da-direction-owner"><option value="">Manter responsável atual</option>${owners}</select></label><label class="workflow-field"><span>Próximo passo esperado</span><input id="da-direction-next" type="text" placeholder="Ex.: Nova versão para validação interna até amanhã."></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitDaDirection()">Registrar direção →</button></div>`); }
async function submitDaDirection() { const item=findOperationalItem(pendingDaDirectionItemId); const direction=String(document.getElementById('da-direction-text')?.value||'').trim(); const next=String(document.getElementById('da-direction-next')?.value||'').trim(); const ownerId=String(document.getElementById('da-direction-owner')?.value||''); if(!item || !direction) return showToast('Descreva a direção antes de registrar.', 'info'); const owner=daControllerTeam().find(user=>user.id===ownerId); try { await postItemUpdate(item.id,`[Vybe OS · Direcionamento de D.A.]\nDireção: ${direction}${owner?`\nQuem executa: ${owner.name}`:''}${next?`\nPróximo passo: ${next}`:''}`); item.status_context={reason:direction,next:next||item.status_context?.next||'',created_at:new Date().toISOString()}; closeWorkflowModal(); pendingDaDirectionItemId=''; showToast('✓ Direcionamento registrado no Vybe OS','ok'); renderDaController(); if(activeWorkspaceItemId===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id),item); } catch(e) { showToast(`Não foi possível registrar o direcionamento: ${e.message}`,'err',7000); } }
async function submitHandoff() { const flow=pendingWorkflowChange; const done=String(document.getElementById('handoff-done')?.value||'').trim(); const next=String(document.getElementById('handoff-next')?.value||'').trim(); const link=String(document.getElementById('handoff-link')?.value||'').trim(); if (!flow || !done || !next) return showToast('Preencha o que foi concluído e o próximo passo.','info'); if (link && !/^https?:\/\//i.test(link)) return showToast('Use um link válido começando com https:// ou deixe o campo em branco.','info'); try { await postItemUpdate(flow.item.id, `[Vybe OS · Passagem de bastão]\n${flow.option ? `Etapa: ${flow.item.status} → ${flow.option.label}\n` : ''}Concluído: ${done}\nPróximo passo: ${next}${link ? `\nReferência: ${link}` : ''}`); const {item,option,manual}=flow; closeWorkflowModal(); if (manual) { showToast('✓ Passagem de bastão registrada no Vybe OS','ok'); if (activeWorkspaceItemId) renderWorkspaceDrawer(await fetchWorkspaceItem(activeWorkspaceItemId),item); } else await commitStatusChange(item,option); } catch(e) { showToast(`Não foi possível registrar a passagem: ${e.message}`,'err',7000); } }
// As automações rodam no servidor depois da gravação e podem trocar o dono e o
// grupo da peça — é o caso de "Para agendar", que passa a peça para a Tainara em
// Gestão de publicações. A resposta traz o estado final; sem escrevê-lo aqui, a
// linha continuava mostrando quem mudou o status, e quem mudou concluía que a
// regra não tinha rodado. Ela tinha: só não aparecia.
function aplicarEfeitoDaAutomacao(item, resposta) {
  const depois = resposta && typeof resposta === 'object' ? resposta.depois : null;
  const regras = (resposta && resposta.automacoes) || [];
  if (!depois) return '';
  const donosAntes = assignedIds(item).map(String).sort().join(',');
  const donosDepois = (depois.responsavel_ids || []).map(String).sort().join(',');
  const remendo = {};
  // LISTA VAZIA E UMA RESPOSTA, NAO A FALTA DE UMA.
  //
  // A condicao era `if (donosDepois && ...)`, e string vazia e falsa: quando a
  // automacao TIRAVA o responsavel — o que a regra de Finalizados faz — o
  // remendo nunca era aplicado e a tela continuava mostrando o dono antigo. O
  // servidor so manda 'depois' quando alguma regra rodou, entao aqui uma lista
  // vazia significa "ficou sem ninguem", e nao "nao sei".
  if (donosDepois !== donosAntes) remendo.responsavel_ids = (depois.responsavel_ids || []).map(String);
  if (depois.grupo_id && String(depois.grupo_id) !== String(item.grupo_id || '')) {
    remendo.grupo_id = depois.grupo_id;
    if (depois.grupo) remendo.grupo = depois.grupo;
  }
  if (!Object.keys(remendo).length) return '';
  applyOutboundItemPatch(item.id, remendo, 'automação após troca de status');
  const nomes = (remendo.responsavel_ids || []).map((id) =>
    firstName((TEAM_USERS || []).find((u) => String(u.id) === String(id))?.name || '')).filter(Boolean);
  const quem = nomes.length ? ` · agora com ${nomes.join(' e ')}`
    : (remendo.responsavel_ids ? ' · e saiu da fila de quem estava com ela' : '');
  const onde = remendo.grupo ? ` em ${remendo.grupo}` : '';
  const regra = regras[0]?.nome ? ` (${regras[0].nome})` : '';
  return `✓ ${item.nome || 'Peça'} seguiu pela automação${quem}${onde}${regra}`;
}

async function commitStatusChange(item, option) { const mutation=`mutation ($board: ID!, $item: ID!, $value: JSON!) { change_column_value(board_id: $board, item_id: $item, column_id: "status", value: $value) { id } }`; armOutboundMutationGuard('status'); try { const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'status', item:String(item.id), para:chaveDeStatus(option.label), _devolve:true }); if (!pelaEscritaDupla) await mondayQuery(mutation,{board:String(item.board_id || (isRequestItem(item)?BOARD_DEMANDAS_ID:BOARD_ID)),item:String(item.id),value:JSON.stringify(Number.isFinite(Number(option.index))&&option.index!==null?{index:Number(option.index)}:{label:String(option.label)})}); updateLocalStatus(item.id,option); const efeito=aplicarEfeitoDaAutomacao(item, pelaEscritaDupla); if(isRequestItem(item)){ const request=(DADOS_DEMANDAS||[]).find(d=>String(d.id)===String(item.id)); if(request) { request.status=option.label; request.status_color=option.color; request.status_border=option.border; request.status_index=option.index; request.status_updated_at=new Date().toISOString(); } renderIntegratedOperationalViews(); } else applyOutboundItemPatch(item.id,{status:option.label,status_color:option.color,status_border:option.border,status_index:option.index},'status'); closeStatusEditor(); if(String(activeWorkspaceItemId)===String(item.id)) renderWorkspaceDrawer(await fetchWorkspaceItem(item.id), findOperationalItem(item.id) || item); renderFocusUserPicker(); showToast(efeito || `✓ Status atualizado para ${option.label} · tela mantida no contexto atual`,'ok', efeito ? 9000 : 4200); } catch(e) { showToast(recadoDeStatusRecusado(e, option),'err',9000); } }
// O servidor recusa um status que o quadro nao tem, e a mensagem dele e para
// quem escreveu o banco. Quem esta na tela precisa saber o que FAZER — e a
// resposta ja existe: e o botao de juntar os nomes de aprovacao, em Demandas.
function recadoDeStatusRecusado(erro, option) {
  const texto = String(erro?.message || '');
  const desconhecido = /Status desconhecido|não existe nas solicitações|nao existe nas solicitacoes/i.test(texto);
  if (!desconhecido) return `Não foi possível atualizar no Vybe OS: ${texto}`;
  return `O status "${option?.label || ''}" ainda não existe na lista das solicitações. `
    + 'Abra o menu de status de qualquer solicitação e use "＋ nova etiqueta" para criá-lo.';
}
const STATUS_CONTEXT_RULES = Object.freeze({
  'alteração': { question:'Qual alteração foi solicitada?', helper:'Descreva o ajuste com objetividade para que a equipe não precise recuperar o contexto no WhatsApp.', requester:true, source:true },
  'falta info': { question:'O que está faltando para avançar?', helper:'Informe qual material, informação ou aprovação é necessária e de quem ela depende.', requester:true, source:true },
  'ag. info cliente': { question:'Qual informação está sendo aguardada?', helper:'Registre exatamente o que foi pedido ao cliente e o que fica bloqueado até o retorno.', requester:true, source:true },
  'aguardo': { question:'O que está sendo aguardado?', helper:'Explique o retorno, a decisão ou o material que impede a próxima etapa.', requester:true, source:true },
  'ag. aprovação cliente': { question:'Que aprovação ainda falta?', helper:'Registre qual ponto espera validação e de quem precisa vir o retorno.', requester:true, source:true, completed:true },
  'ag. interno': { question:'O que precisa de validação interna?', helper:'Especifique a decisão e a área ou pessoa que precisa validar.', requester:true, source:true },
  'falta d.a': { question:'Que direção de arte ou referência falta?', helper:'Descreva o ponto visual que precisa ser definido antes da produção.', requester:true, source:true },
  'finalizado': { question:'O que foi concluído e entregue?', helper:'Registre a entrega final, o destino e qualquer pendência residual.', completed:true },
  // Segurar um post e uma decisao, e decisao sem motivo escrito vira peca
  // parada que ninguem sabe por que parou. Tinha a pergunta generica; ganha a
  // sua, com o que precisa ser respondido para ela voltar a andar.
  'segurar post': { question:'Por que a publicação está sendo segurada?', helper:'Diga quem pediu para segurar e o que precisa acontecer para liberar.', requester:true }
});
function contextRuleFor(option) { return STATUS_CONTEXT_RULES[normalizedWorkflowStatus(option?.label)] || { question:`Por que esta demanda entra em ${option?.label || 'esta etapa'}?`, helper:'Registre o motivo da mudança e o próximo passo necessário.' }; }
function updateStatusContextState() { const form=document.getElementById('status-context-form'); const button=document.getElementById('status-context-submit'); if(!form || !button) return; const checks=[...form.querySelectorAll('input[data-quality-check]')]; button.disabled=checks.some(check=>!check.checked); }
function statusContextIsCard(item){ return /card/i.test(String(daTacticalFormat(item)||item?.formato||'')) || /(^|\W)card\b/i.test(String(item?.nome||'')); }
// Escolher responsavel e sempre pela bolinha com foto, como no resto do painel.
// Antes era um <select> de texto: a lista abria com a fonte do sistema, sem
// rosto nenhum, e a pessoa lia "Deivid · Design" onde em toda outra tela ela
// reconhece a foto antes do nome.
//
// Um <select> nao aceita imagem — entao deixa de ser select. Vira uma fileira de
// fichas, e um campo escondido guarda o escolhido para quem le o formulario nao
// precisar saber que a tela mudou.
// QUEM EXECUTOU A PECA, SEGUNDO O HISTORICO.
//
// Paulo: "nao da pra puxar do historico? quem tinha colocado de pode fazer para
// em andamento e depois colocou para aprovacao? pra quando voltar para
// alteracao ja pre atribuir essa pessoa automatico". Da — o banco sempre soube
// quem fez cada troca de status; a resposta e que nao mandava.
//
// Quem trabalhou na peca e quem a colocou EM EXECUCAO, ou quem a mandou para
// aprovacao. Entre os dois vale o mais recente: e a ultima vez que alguem pos a
// mao nela. Se ninguem aparecer, fica quem esta com a peca hoje.
const ENTROU_EM_TRABALHO = /^(em andamento|em execu|para aprova|em aprova|aguardando aprova|ag\. aprova)/i;
function quemExecutouSegundoOHistorico(detail) {
  const eventos = Array.isArray(detail?.activity_logs) ? detail.activity_logs : [];
  const acerto = eventos.find((e) => {
    if (!e?.autor_id) return false;
    let para = '';
    try { para = JSON.parse(e.data || '{}')?.value?.label?.text || ''; } catch { return false; }
    return ENTROU_EM_TRABALHO.test(String(para).trim());
  });
  if (!acerto) return null;
  return (TEAM_USERS || []).find((u) => String(u.id) === String(acerto.autor_id))
    || { id: acerto.autor_id, name: acerto.autor || 'Equipe' };
}

// Marcar depois que a caixa ja esta na tela: o historico chega do servidor e nao
// pode segurar a abertura do portao.
async function preAtribuirQuemExecutou(itemId) {
  const campo = document.getElementById('status-context-next-owner');
  if (!campo) return;
  // So substitui enquanto ninguem tiver clicado: o valor ainda e o padrao.
  const aindaNoPadrao = String(campo.value || '') === String(campo.dataset.padrao || '');
  if (!aindaNoPadrao) return;
  let detail = DETALHE_DA_GAVETA;
  if (!detail || String(detail.id ?? '') !== String(itemId)) {
    try { detail = await fetchWorkspaceItem(itemId); } catch { return; }
  }
  const quem = quemExecutouSegundoOHistorico(detail);
  const vivo = document.getElementById('status-context-next-owner');
  if (!quem || !vivo) return;
  if (String(vivo.value || '') !== String(vivo.dataset.padrao || '')) return;
  if (String(quem.id) === String(vivo.value || '')) return;
  vivo.value = '';
  document.querySelectorAll('#status-context-donos .dono-ficha').forEach(b => b.classList.remove('marcada'));
  escolherResponsavelDoStatus(String(quem.id));
  vivo.dataset.padrao = String(quem.id);
  const ficha = document.querySelector(`#status-context-donos .dono-ficha[data-dono="${CSS.escape(String(quem.id))}"] small`);
  if (ficha) ficha.textContent = 'Executou esta peça';
  if (typeof updateStatusContextState === 'function') updateStatusContextState();
}

// QUEM ESTA EXECUTANDO VEM PRIMEIRO, E QUALQUER UM PODE SER ESCOLHIDO.
//
// A lista era filtrada pela disciplina elegivel para o status ATUAL da peca —
// numa peca que ia para "Alteracao" apareciam Paulo, Vinicius e Tainara, que
// sao publicacao, e nao quem tinha acabado de trabalhar nela. Devolver uma
// alteracao para quem nao fez a peca nao e uma regra, e um engano.
//
// Agora quem esta com a peca vem primeiro e ja marcado, e o time inteiro fica
// disponivel — a mesma decisao que ja tinha sido tomada nos outros seletores de
// responsavel do painel.
// EM QUE GRUPO ELA FICA DEPOIS.
//
// Uma peca que volta para "Alteracao" precisa voltar para Design & Edicao — e
// isso era feito na mao, depois, quando alguem lembrava. O portao passa a
// perguntar, ja apontando o destino certo: o grupo atual, ou Design & Edicao
// quando a peca esta indo para alteracao e ainda nao esta la.
function grupoSugeridoPara(item, option) {
  const atual = String(item.group_id || '');
  const volta = /altera/i.test(String(option?.label || ''));
  if (!volta) return atual;
  const design = (typeof gruposDoItem === 'function' ? gruposDoItem(item) : [])
    .find((id) => /design/i.test(String(tituloDoGrupo(id) || '')));
  return design || atual;
}
function statusContextGrupoHtml(item, option) {
  if (typeof gruposDoItem !== 'function') return '';
  const grupos = gruposDoItem(item) || [];
  if (!grupos.length) return '';
  const atual = String(item.group_id || '');
  const sugerido = grupoSugeridoPara(item, option);
  const mudou = sugerido && sugerido !== atual;
  return `<label class="workflow-field"><span>Em que grupo ela fica depois?</span>
    <select id="status-context-grupo">${grupos.map((id) => `<option value="${safeText(id)}" ${id === sugerido ? 'selected' : ''}>${safeText(tituloDoGrupo(id))}</option>`).join('')}</select>
    ${mudou ? `<small class="workflow-hint">Estava em <b>${safeText(tituloDoGrupo(atual) || 'sem grupo')}</b>; voltar para alteração devolve a peça ao design.</small>` : ''}</label>`;
}

function statusContextResponsibleOptions(item){
  const rule=ownerEligibility(item);
  const current=new Set(assignedIds(item));
  const eligible=(rule?.users||[]).filter(user=>user?.id);
  const currentUsers=(TEAM_USERS||[]).filter(user=>current.has(String(user.id)));
  const resto=(TEAM_USERS||[]).filter(user=>user?.id && !current.has(String(user.id)));
  const users=[...new Map([...currentUsers,...eligible,...resto].map(user=>[String(user.id),user])).values()];
  const escolhido=users.find(u=>current.has(String(u.id)));
  const fichas=users.map(user=>{
    const id=String(user.id);
    const naRegra=eligible.some(c=>String(c.id)===id);
    const papel=current.has(id)?'Está com a peça':naRegra?(rule?.label||'Equipe'):(user.role||'Equipe');
    return `<button type="button" class="dono-ficha ${current.has(id)?'marcada':''}" data-dono="${safeText(id)}"
      onclick="escolherResponsavelDoStatus('${safeText(id)}')" title="${safeText(user.name)} · ${safeText(papel)}">
      ${ownerAvatarHtml(user)}<span><b>${safeText(firstName(user.name))}</b><small>${safeText(papel)}</small></span></button>`;
  }).join('');
  // O dono atual entra como PADRAO, nao como escolha: o historico chega logo
  // depois e pode ter uma resposta melhor — quem de fato executou a peca.
  return `<input type="hidden" id="status-context-next-owner" value="${safeText(escolhido?String(escolhido.id):'')}" data-padrao="${safeText(escolhido?String(escolhido.id):'')}">
    <div class="dono-fichas" id="status-context-donos">${fichas
      || '<span class="workflow-hint">Nenhuma pessoa elegível para esta etapa.</span>'}</div>`;
}

// Uma pessoa por vez: clicar em outra troca. Clicar na marcada desmarca, porque
// nem toda passagem de status tem um dono definido do outro lado.
// Passar uma peca para DUAS pessoas era impossivel aqui: cada clique
// substituia o anterior. A peca pode ter mais de um dono no resto do painel;
// so este campo insistia em um.
function escolherResponsavelDoStatus(id){
  const campo=document.getElementById('status-context-next-owner');
  if(!campo) return;
  const alvo=String(id);
  const atuais=String(campo.value||'').split(',').map(x=>x.trim()).filter(Boolean);
  const jaEra=atuais.includes(alvo);
  const depois=jaEra?atuais.filter(x=>x!==alvo):[...atuais,alvo];
  campo.value=depois.join(',');
  document.querySelectorAll('#status-context-donos .dono-ficha').forEach(b=>{
    b.classList.toggle('marcada', depois.includes(String(b.dataset.dono||'')));
  });
}
// Todas as imagens da peça, não só a primeira: uma demanda com cinco artes
// mostrava uma e escondia quatro, sem dizer que existiam.
function statusContextPreviewAssets(detail){ const updates=(detail?.updates||[]).flatMap(update=>update?.assets||[]); const assets=[...(detail?.assets||[]),...updates]; return assets.filter(asset=>asset?.url_thumbnail || /^\.?(png|jpe?g|webp|gif|avif)$/i.test(String(asset?.file_extension||''))); }
function statusContextPreviewAsset(detail){ return statusContextPreviewAssets(detail)[0] || null; }
async function loadStatusContextCardPreview(itemId){ const holder=document.getElementById('status-context-card-preview'); if(!holder) return; try{ const detail=await fetchWorkspaceItem(itemId); const asset=statusContextPreviewAsset(detail); if(!asset){ holder.innerHTML='<div class="status-context-preview-empty"><b>Sem arte disponível</b>Não há imagem anexada à demanda ou às atualizações carregadas. O briefing continua sendo a fonte de orientação até que uma prévia seja vinculada.</div>'; return; } const source=asset.public_url||asset.url_thumbnail||asset.url||''; if(!source){ holder.innerHTML='<div class="status-context-preview-empty"><b>Arquivo sem prévia</b>O item possui um arquivo, mas ele não disponibiliza imagem de visualização.</div>'; return; } holder.innerHTML=`<img src="${safeText(source)}" alt="Prévia de ${safeText(asset.name||'Card')}"><small class="status-context-preview-caption">${safeText(asset.name||'Prévia vinculada ao item')}</small>`; }catch(error){ holder.innerHTML='<div class="status-context-preview-empty"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. O restante do fluxo permanece disponível.</div>'; } }
function openStatusContextGate(item, option) {
  const rule=contextRuleFor(option); const requiresQuality=statusNeedsQuality(option); const requiresHandoff=statusNeedsHandoff(item,option); const checks=requiresQuality ? qualityChecklistFor(item) : []; const isCard=statusContextIsCard(item);
  // Quem esta com o painel aberto e, quase sempre, quem esta pedindo a
  // mudanca. O campo ja vem com o nome dele — continua editavel, para o caso
  // de o pedido ter vindo do cliente ou de outra pessoa.
  const euAgora = (typeof sessaoAtual === 'function' ? sessaoAtual()?.nome : '') || '';
  const requesterFields = rule.requester ? `<label class="workflow-field"><span>De quem veio ou depende esta decisão?</span><input id="status-context-requester" type="text" value="${safeText(euAgora)}" placeholder="Ex.: Cliente, Paulo, aprovação interna..."></label>` : '';
  const sourceFields = rule.source ? `<label class="workflow-field"><span>Onde está a referência?</span><select id="status-context-source"><option value="WhatsApp">WhatsApp</option><option value="Monday">Monday.com</option><option value="Reunião">Reunião</option><option value="E-mail">E-mail</option><option value="Outro">Outro</option></select></label>` : '';
  const completedField = (rule.completed || requiresHandoff) ? `<label class="workflow-field"><span>O que foi concluído antes desta etapa?</span><textarea id="status-context-completed" rows="3" placeholder="Ex.: Versão final revisada, arquivo anexado e copy conferida."></textarea></label>` : '';
  const checklist = requiresQuality ? `<div class="workflow-checks"><span class="workflow-field"><span>Checklist de qualidade</span></span>${checks.map((check,index)=>`<label class="workflow-check"><input type="checkbox" data-quality-check name="quality-${index}"><span>${safeText(check)}</span></label>`).join('')}</div>` : '';
  const responsible=`<div class="status-context-responsible"><div class="workflow-field"><span>Quem executará a próxima ação?</span>${statusContextResponsibleOptions(item)}</div><small class="status-context-responsible-hint"><b>Responsável da próxima ação:</b> quem está com a peça vem marcado; a escolha passa a valer de verdade — a peça é reatribuída ao confirmar.</small></div>${statusContextGrupoHtml(item, option)}`;
  const form=`<form id="status-context-form" onchange="updateStatusContextState()"><label class="workflow-field"><span>${safeText(rule.question)}</span><textarea id="status-context-reason" rows="3" placeholder="Descreva o motivo desta mudança de status."></textarea></label>${completedField}${requesterFields}${sourceFields}${responsible}<label class="workflow-field"><span>Link ou arquivo de referência (opcional)</span><input id="status-context-link" type="url" placeholder="https://drive.google.com/... ou link da referência"></label>${checklist}</form>`;
  const preview=isCard?`<aside class="status-context-preview"><div class="status-context-preview-head"><b>Prévia do card</b><small>arquivo vinculado</small></div><div id="status-context-card-preview" class="status-context-preview-media"><div class="status-context-preview-loading">Carregando prévia...</div></div></aside>`:'';
  pendingWorkflowChange={item,option,manual:false};
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Contexto de status</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Antes de entrar em “${safeText(option.label)}”</h2><p class="workflow-copy">${safeText(rule.helper)}</p>${workflowItemHtml(item,option.label)}<div class="status-context-layout"><div class="status-context-main">${form}</div>${preview}</div><p class="workflow-hint">A Vybe OS registra este contexto e quem executará a próxima ação no histórico da peça, junto com a mudança de etapa.</p><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button id="status-context-submit" type="button" class="workflow-primary" onclick="submitStatusContext()">Registrar e atualizar →</button></div>`);
  if(isCard){ document.getElementById('workflow-modal')?.classList.add('status-context-split'); loadStatusContextCardPreview(item.id); }
  updateStatusContextState();
  preAtribuirQuemExecutou(item.id);
}
async function submitStatusContext() {
  const flow=pendingWorkflowChange; if(!flow) { showToast('O contexto desta mudança expirou. Feche e abra a alteração novamente.','err',7000); return; } const reason=String(document.getElementById('status-context-reason')?.value||'').trim(); const nextOwnerId=String(document.getElementById('status-context-next-owner')?.value||'').trim(); const nextOwners=String(nextOwnerId||'').split(',').map(x=>x.trim()).filter(Boolean)
    .map(id=>(TEAM_USERS||[]).find(user=>String(user.id)===id)).filter(Boolean);
  const nextOwner=nextOwners[0]||null; const next=nextOwner?`${nextOwner.name} executará a próxima ação.`:''; const completed=String(document.getElementById('status-context-completed')?.value||'').trim(); const requester=String(document.getElementById('status-context-requester')?.value||'').trim(); const source=String(document.getElementById('status-context-source')?.value||'').trim(); const link=String(document.getElementById('status-context-link')?.value||'').trim(); const rule=contextRuleFor(flow.option);
  if(!reason || !nextOwner) return showToast('Explique o motivo e selecione quem executará a próxima ação.','info'); if((rule.requester && !requester) || (rule.completed && !completed)) return showToast('Preencha os campos de contexto obrigatórios desta etapa.','info'); if(link && !/^https?:\/\//i.test(link)) return showToast('Use um link válido começando com https:// ou deixe o campo em branco.','info'); const quality=[...document.querySelectorAll('input[data-quality-check]')]; if(quality.some(check=>!check.checked)) return showToast('Conclua o checklist de qualidade para continuar.','info'); const button=document.getElementById('status-context-submit'); const idleLabel=button?.textContent||'REGISTRAR E ATUALIZAR →'; if(button){button.disabled=true;button.textContent='Registrando...';}
  try { const qualityText=quality.length ? `\nChecklist de qualidade: ${quality.map(check=>check.parentElement.textContent.trim()).join(' | ')}` : ''; const body=`[Vybe OS · Contexto de status]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMotivo: ${reason}${completed ? `\nConcluído: ${completed}` : ''}${requester ? `\nSolicitante/Dependência: ${requester}` : ''}${source ? `\nOrigem: ${source}` : ''}\nResponsável pela próxima ação: ${nextOwners.map(u=>u.name).join(', ')}${link ? `\nReferência: ${link}` : ''}${qualityText}`; await postItemUpdate(flow.item.id,body); [DADOS,DADOS_ALL,DADOS_DEMANDAS].forEach(list=>(list||[]).forEach(d=>{if(String(d.id)===String(flow.item.id)) d.status_context={target:flow.option.label,reason,next,requester,source,completed,link,next_owner_id:nextOwner.id,next_owner_name:nextOwner.name,created_at:new Date().toISOString()};})); const {item,option}=flow;
    // O QUE SE ESCOLHE AQUI PASSA A ACONTECER.
    //
    // Ate aqui o responsavel e o grupo eram so texto no historico: a pessoa
    // escolhia Tainara, lia "Responsavel pela proxima acao: Tainara" na nota, e
    // a peca continuava com quem estava. Agora as duas escolhas sao aplicadas,
    // pelas mesmas funcoes que o resto do painel usa.
    const grupoEscolhido=String(document.getElementById('status-context-grupo')?.value||'');
    const donoAtual=(assignedIds(item)||[]).map(String);
    closeWorkflowModal();
    await commitStatusChange(item,option);
    try {
      if (grupoEscolhido && grupoEscolhido !== String(item.group_id||'') && typeof gravarGrupoDaPeca === 'function') {
        await gravarGrupoDaPeca(item, grupoEscolhido);
      }
      const escolhidos=nextOwners.map(u=>String(u.id));
      const mudouODono=escolhidos.length
        && (escolhidos.length!==donoAtual.length || escolhidos.some(id=>!donoAtual.includes(id)));
      if (mudouODono && typeof gravarResponsaveisDaPeca === 'function') {
        await gravarResponsaveisDaPeca(item, escolhidos);
      }
      if (typeof renderOutboundItemPatch === 'function') renderOutboundItemPatch('contexto de status');
    } catch (erro) {
      // A troca de status ja aconteceu: isto e o acabamento dela, e falhar no
      // acabamento nao pode parecer que nada foi feito.
      showToast(`Status atualizado, mas o responsável ou o grupo não foram aplicados: ${erro.message}`,'err',9000);
    } } catch(e) { if(button){button.disabled=false;button.textContent=idleLabel;} showToast(`Não foi possível registrar o contexto: ${e.message}`,'err',7000); }
}
async function updateFocusStatus(itemId, escolha) { const item=findOperationalItem(itemId); const opcoes=operationalStatusOptions(item);
  // O rotulo e a identidade do status; o indice e so o numero que o quadro usa
  // para guarda-lo, e nem todo status tem um. Numero ainda e aceito porque
  // chamadas antigas mandam indice.
  const option = typeof escolha === 'number' || /^-?\d+$/.test(String(escolha ?? ''))
    ? opcoes.find(o=>o.index!==null&&o.index!==undefined&&Number(o.index)===Number(escolha))
    : opcoes.find(o=>mesmoStatus(o.label, escolha));
  if(!item || !option || mesmoStatus(option.label, item.status)) return closeStatusEditor(); const needsGate=statusNeedsConferenciaVisual(option)||precisaDeConferenciaFinal(item,option)||statusNeedsQuality(option)||statusNeedsContext(option)||statusNeedsHandoff(item,option); closeStatusEditor(); if(needsGate){ /* Um respiro para o seletor sair da tela antes de o portao entrar.
   Era requestAnimationFrame, que NAO dispara em aba de fundo: se a pessoa
   clicasse e trocasse de aba, a troca de status ficava parada para sempre,
   esperando um quadro que nunca vem. */
  await new Promise(resolve=>setTimeout(resolve,0)); if(statusNeedsConferenciaVisual(option)) return abrirConferenciaVisual(item,option); if(precisaDeConferenciaFinal(item,option)) return openMaterialReviewGate(item,option); if(statusNeedsQuality(option)) return openQualityGate(item,option); if(statusNeedsContext(option)) return openStatusContextGate(item,option); return openHandoffGate(item,option); } return commitStatusChange(item,option); }
