// vybe-gaveta.js — a gaveta da peça: abrir, montar, fechar e escrever nela.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global,
// mesma ordem de carregamento, mesmos nomes.
//
// O contexto inteiro de uma peça num painel lateral: quem responde, em que
// etapa está, o que já foi entregue e o que se escreveu ao longo do caminho.
// A montagem chama os outros arquivos — ficha, subitens, arquivos, briefing,
// material — e é por isso que carrega depois de todos eles.

let activeWorkspaceItemId = '';
let activeWorkspaceAssets = [];
function workspacePlainText(html='') {
  const temp = document.createElement('div');
  // Bloco vira quebra ANTES de extrair o texto: textContent de <p>A</p><p>B</p>
  // devolve "AB", sem separador — era assim que a memoria executiva saia com
  // tudo grudado, "atualizado]Veiculação: 28/08".
  temp.innerHTML = String(html).replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
                               .replace(/<br\s*\/?>/gi, '\n');
  return (temp.textContent || temp.innerText || '')
    .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}
function workspaceBytes(bytes=0) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function closeItemWorkspace() {
  document.getElementById('workspace-backdrop')?.remove();
  document.getElementById('workspace-drawer')?.remove();
  // A leitura do conteudo mora dentro da gaveta: fechada a gaveta, ela ficaria
  // sozinha na tela, sem nada atras para voltar.
  if (typeof fecharBriefing === 'function') fecharBriefing();
  activeWorkspaceItemId = '';
  activeWorkspaceAssets = [];
  if (typeof DETALHE_DA_GAVETA !== 'undefined') DETALHE_DA_GAVETA = null;
  // Quem veio da mesa de planejamento volta para ela, onde estava.
  if (typeof retomarMesaSeHavia === 'function') retomarMesaSeHavia();
}
async function fetchWorkspaceItem(itemId) {
  const r = await fetch(`/api/painel?area=peca&item=${encodeURIComponent(itemId)}`, { credentials:'same-origin', cache:'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.ok) throw new Error(d?.error || `Workspace indisponível (${r.status})`);
  return d;
}
function workspaceTimelineType(body){ const text=String(body||''); if(/Check-in/i.test(text)) return 'CHECK-IN'; if(/Planejamento/i.test(text)) return 'PLANEJAMENTO'; if(/Direcionamento D\.A/i.test(text)) return 'DIREÇÃO D.A.'; if(/Passagem de bastão/i.test(text)) return 'PASSAGEM'; if(/Link de entrega/i.test(text)) return 'ENTREGA'; if(/Bloqueio/i.test(text)) return 'BLOQUEIO'; return 'ATUALIZAÇÃO'; }
function workspaceUrlFromText(value=''){ const match=String(value||'').match(/https?:\/\/[^\s<>"']+/i); return match ? match[0].replace(/[),.;]+$/,'') : ''; }
function workspaceDeliveryInfo(detail={}){ const updates=detail?.updates||[]; const tagged=updates.map(update=>({update,url:workspaceUrlFromText(workspacePlainText(update?.body||''))})).find(entry=>entry.url && /Link de entrega|Link final|Entrega final/i.test(workspacePlainText(entry.update?.body||''))); if(tagged) return {url:tagged.url,label:'LINK DE ENTREGA REGISTRADO',name:'Material pronto para abrir e postar',creator:tagged.update?.creator?.name||'Equipe Vybe',created_at:tagged.update?.created_at||'',source:'Atualização de entrega'}; const assets=[...(detail?.assets||[]),...updates.flatMap(update=>update?.assets||[])]; const asset=assets.find(entry=>entry?.public_url||entry?.url); if(asset) return {url:asset.public_url||asset.url,label:'ARQUIVO ANEXADO À DEMANDA',name:asset.name||'Material anexado',creator:'Equipe Vybe',created_at:asset.created_at||'',source:'Arquivo do item'}; return null; }
function workspaceCopyFallback(text){ const input=document.createElement('textarea'); input.value=text; input.setAttribute('readonly',''); input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(input); input.select(); const copied=document.execCommand('copy'); input.remove(); if(!copied) throw new Error('Cópia manual indisponível'); }
function showWorkspaceDeliveryCopySheet(text){ document.getElementById('workspace-delivery-copy-sheet')?.remove(); const sheet=document.createElement('section'); sheet.id='workspace-delivery-copy-sheet'; sheet.className='workspace-delivery-copy-sheet'; sheet.innerHTML=`<b>Link pronto para copiar</b><small>Seu navegador bloqueou a cópia automática. O endereço abaixo já está selecionado: use Ctrl/Cmd + C.</small><input id="workspace-delivery-copy-value" readonly value="${safeText(text)}"><button type="button" onclick="document.getElementById('workspace-delivery-copy-sheet')?.remove()">Fechar</button>`; document.body.appendChild(sheet); const input=sheet.querySelector('input'); input?.focus(); input?.select(); }
async function copyWorkspaceDeliveryLink(url){ const text=String(url||'').trim(); if(!text) return showToast('Nenhum material disponível para copiar.','info'); try{ if(navigator.clipboard?.writeText){ await Promise.race([navigator.clipboard.writeText(text),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de cópia excedido')),1200))]); } else workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(error){ try{ workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(fallbackError){ showWorkspaceDeliveryCopySheet(text); showToast('Link aberto para cópia manual.','info',7000); } } }
function focusWorkspaceDeliveryInput(){ const input=document.getElementById('workspace-link-input'); if(!input) return; input.scrollIntoView({behavior:'smooth',block:'center'}); input.focus(); showToast('Cole aqui o link final para liberar a postagem.','info'); }
function workspaceDeliveryDock(detail,item){ const delivery=workspaceDeliveryInfo(detail); if(!delivery) return `<section class="workspace-delivery-dock missing"><div class="workspace-delivery-copy"><span class="workspace-delivery-kicker">Entrega para postagem</span><b>Material ainda não enviado</b><small>Quem publica não tem link nem arquivo final nesta demanda. Registre o material antes de mover para publicação.</small></div><div class="workspace-delivery-actions"><button type="button" class="workspace-delivery-focus" onclick="focusWorkspaceDeliveryInput()">REGISTRAR MATERIAL ↓</button></div></section>`; const when=delivery.created_at?new Date(delivery.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'sem horário disponível'; return `<section class="workspace-delivery-dock"><div class="workspace-delivery-copy"><span class="workspace-delivery-kicker">Entrega pronta para postar</span><b>${safeText(delivery.name)}</b><small>${safeText(delivery.source)} · enviado por ${safeText(delivery.creator)} · ${safeText(when)}</small></div><div class="workspace-delivery-actions"><a class="workspace-delivery-open" href="${safeText(delivery.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a><button type="button" class="workspace-delivery-copy-btn" onclick="copyWorkspaceDeliveryLink('${safeText(delivery.url)}')">Copiar link</button></div></section>`; }

// A gaveta aberta agora. O botao de conteudo abre a leitura sem ir a rede de
// novo: o briefing ja veio junto com o resto do contexto.
let DETALHE_DA_GAVETA = null;
  function renderWorkspaceDrawer(detail, item) {
  const drawer = document.getElementById('workspace-drawer');
  if (!drawer || !detail) return;
  DETALHE_DA_GAVETA = detail;
  const assets = workspaceAssetsForDetail(detail);
  activeWorkspaceAssets = assets;
  const updates = detail.updates || [];
  ATUALIZACOES_DA_GAVETA = updates;
  const deadline = focusReferenceDate(item, focusUser());
  const format = item.formato || item.tipo || item.formato_conteudo || 'Conteúdo';
  drawer.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:22px 24px 120px;box-sizing:border-box;width:100%;height:100%;">
      <div class="workspace-kicker"><span>Vybe OS · Workspace da demanda</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div>
    <div class="workspace-client">${safeText(item.cliente || 'Cliente não informado')}
      <button type="button" class="workspace-id" onclick="copiarId('${safeText(item.id)}')"
              title="ID da atividade · clique para copiar">#${safeText(item.id)}</button>${botaoDeLinkHtml(item)}</div>
    <h2 class="workspace-title" id="workspace-titulo" title="Clique para renomear" onclick="renomearPeca('${item.id}',event)">${safeText(item.nome)}</h2>
    <div class="workspace-meta"><span>${safeText(format)}</span><span>Prazo: ${safeText(deadline || 'não definido')}</span>${pillHtml(item.status,item.status_color,item.status_border)}</div>
    ${blocoDoBriefingHtml(detail, item)}
    ${faixaDeMaterialBrutoHtml(detail, item)}
    ${workspaceFichaHtml(detail, item.id)}
    ${subitensHtml(detail, item)}
    ${workspaceDeliveryDock(detail,item)}
    <div class="workspace-actions">${podeVerMonday() ? `<button type="button" class="workspace-action" onclick="moverPecaDeBoard('${item.id}')">Mover para Demandas</button>` : ''}<button type="button" class="workspace-action perigo" onclick="removerPeca('${item.id}')">Arquivar atividade</button>${podeVerMonday() ? `<a class="workspace-action" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">↗ Abrir no Monday</a>` : ''}</div>
    ${latestStatusContext({updates}) ? `<section class="workspace-section workspace-handoff"><div class="workspace-section-head">Contexto da etapa atual</div><div class="workspace-section-body"><div class="workspace-update-meta">${safeText(latestStatusContext({updates}).creator || 'Equipe Vybe')} · ${safeText((latestStatusContext({updates}).created_at || '').replace('T',' ').slice(0,16))}</div><div class="workspace-update-body">${safeText(latestStatusContext({updates}).reason || latestStatusContext({updates}).text)}</div>${latestStatusContext({updates}).next ? `<p class="workspace-note"><b>Próximo passo:</b> ${safeText(latestStatusContext({updates}).next)}</p>` : ''}</div></section>` : ''}
    <section class="workspace-section"><div class="workspace-section-head">Arquivos da demanda</div><div class="workspace-section-body"><div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<div class="workspace-empty">Nenhum arquivo anexado ainda.</div>'}</div></div></section>
    <section class="workspace-section"><div class="workspace-section-head">Entregar</div><div class="workspace-section-body">
      <p class="workspace-note">Duas formas, conforme o que você tem em mãos. Qualquer uma das duas registra a entrega na atividade.</p>
      <div class="entrega-caminhos">
        <div class="entrega-caminho">
          <div class="entrega-caminho-topo"><b>Arquivo pronto</b><small>card, arte ou PDF</small></div>
          <input id="workspace-file-input" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,application/pdf" onchange="uploadWorkspaceFile(this)">
          <div class="workspace-dropzone" onclick="document.getElementById('workspace-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleWorkspaceDrop(event)"><div><strong>Arraste aqui ou clique</strong>PNG, JPG, WEBP ou PDF · até 200 MB</div></div>
          <p class="workspace-note">Vai para a pasta do cliente no Drive da Vybe e aparece em “Arquivos da demanda”.</p>
        </div>
        <div class="entrega-caminho">
          <div class="entrega-caminho-topo"><b>Link do material</b><small>vídeo, ou arquivo grande demais</small></div>
          <input id="workspace-link-input" class="workspace-input" type="url" placeholder="Cole o link do Drive, Frame.io ou Canva">
          <button type="button" class="workspace-action primary" onclick="saveWorkspaceLink()">Registrar link da entrega</button>
          <p class="workspace-note">Fica no histórico da atividade, com quem registrou e quando.</p>
        </div>
      </div>
      <div class="entrega-depois"><span>Entregou? A próxima etapa precisa saber.</span><button type="button" class="workspace-action" onclick="openManualHandoff('${item.id}')">Passar bastão →</button></div>
    </div></section>
    
    <section class="workspace-section"><div class="workspace-section-head">Atualização rápida</div><div class="workspace-section-body"><textarea id="workspace-comment-input" class="workspace-textarea" placeholder="Ex.: Card finalizado e enviado para aprovação."></textarea><div class="workspace-form-row"><button type="button" class="workspace-action" onclick="saveWorkspaceComment()">Registrar atualização</button></div></div></section>
    

    ${workspaceExecutiveHistoryHtml(updates)}
      ${workspaceHistoryHtml(detail, item)}
    <details class="workspace-section workspace-recolhida"><summary>Todo o histórico<small>${updates.length} registro${updates.length===1?'':'s'}</small></summary><div class="workspace-section-body">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<div class="workspace-empty">Sem eventos registrados ainda.</div>'}</div></details></div>`;
}
async function openItemWorkspace(itemId) {
  closeItemWorkspace();
  // A gaveta e a mesa de planejamento nao convivem: a mesa cobre a tela inteira
  // e a gaveta abriria atras dela, invisivel. Quem pede o contexto completo esta
  // saindo da mesa — entao a mesa sai junto, venha o pedido de onde vier.
  // A mesa sai da frente, mas fica guardada: ao fechar esta gaveta ela volta
  // com as mesmas pessoas e na mesma altura de rolagem.
  if (typeof guardarMesaParaRetomar === 'function') guardarMesaParaRetomar();
  else if (typeof closeDaIndividualPlanningDesk === 'function'
      && document.getElementById('da-individual-planning-overlay')) closeDaIndividualPlanningDesk();
  let item = findOperationalItem(itemId);
  activeWorkspaceItemId = String(itemId);
  const backdrop = document.createElement('div');
  backdrop.id = 'workspace-backdrop'; backdrop.className = 'workspace-backdrop'; backdrop.onclick = closeItemWorkspace;
  const drawer = document.createElement('aside');
  drawer.id = 'workspace-drawer'; drawer.className = 'workspace-drawer'; drawer.innerHTML = '<div class="workspace-loading">Carregando contexto da demanda...</div>';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    if (!detail) throw new Error('A atividade não foi encontrada no banco Vybe.');
    if (!item) item = { id:String(itemId), nome:detail.name || 'Demanda', cliente:'Cliente não informado', status:'—', status_color:'#8f8f8f', status_border:'#8f8f8f', prazo_iso:'', veiculacao_iso:'', formato:'Conteúdo', url:'' };
    renderWorkspaceDrawer(detail, item);
  } catch (e) { drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Workspace</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-empty">Não foi possível carregar o contexto da demanda. ${safeText(e.message)}</div>`; }
}

// Workspace interno de Solicitações: leitura e contexto sem aplicar as automações do board de Produção.
async function openDemandaWorkspace(itemId) {
  closeItemWorkspace();
  // A gaveta da solicitacao esquecia de fechar a mesa. Ela abria — e abria ATRAS
  // da mesa, que cobre a tela inteira: clicar em "Abrir tudo" numa SOLICITACAO
  // parecia nao fazer nada. O conteudo fechava a mesa e a solicitacao nao; duas
  // portas para a mesma sala, so uma sabia disso.
  // A mesa sai da frente, mas fica guardada: ao fechar esta gaveta ela volta
  // com as mesmas pessoas e na mesma altura de rolagem.
  if (typeof guardarMesaParaRetomar === 'function') guardarMesaParaRetomar();
  else if (typeof closeDaIndividualPlanningDesk === 'function'
      && document.getElementById('da-individual-planning-overlay')) closeDaIndividualPlanningDesk();
  const item = (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []).find(d => String(d.id) === String(itemId));
  if (!item) return showToast('Solicitação não encontrada no contexto atual.', 'err');
  activeWorkspaceItemId = '';
  const backdrop = document.createElement('div');
  backdrop.id = 'workspace-backdrop'; backdrop.className = 'workspace-backdrop'; backdrop.onclick = closeItemWorkspace;
  const drawer = document.createElement('aside');
  drawer.id = 'workspace-drawer'; drawer.className = 'workspace-drawer';
  drawer.innerHTML = '<div class="workspace-loading">Carregando contexto da solicitação...</div>';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    DETALHE_DA_GAVETA = detail;
    const assets = detail?.assets || [];
    const updates = detail?.updates || [];
    ATUALIZACOES_DA_GAVETA = updates;
    drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Contexto da solicitação</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-client">${safeText(item.cliente || 'Cliente não informado')}${botaoDeLinkHtml(item)}</div><h2 class="workspace-title">${safeText(item.nome)}</h2><div class="workspace-meta"><span>${safeText(item.tipo || 'Solicitação')}</span><span>Prazo: ${safeText(item.prazo || 'não definido')}</span>${pillHtmlDemanda(item.status,item.status_color,item.status_border)}</div>${blocoDoBriefingHtml(detail, item)}<section class="workspace-section"><div class="workspace-section-head">Contexto operacional</div><div class="workspace-section-body"><p class="workspace-note">Esta solicitação pertence à Central de Demandas. A atualização completa permanece no fluxo próprio dela.</p><p class="workspace-note"><b>Conclusão:</b> ${safeText(item.conclusao || 'não definida')} · <b>Responsável:</b> ${safeText(item.responsavel || 'não definido')}</p></div></section><section class="workspace-section"><div class="workspace-section-head">Arquivos</div><div class="workspace-section-body"><div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<div class="workspace-empty">Nenhum arquivo anexado ainda.</div>'}</div></div></section><section class="workspace-section"><div class="workspace-section-head">Histórico recente</div><div class="workspace-section-body">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<div class="workspace-empty">Sem atualizações registradas ainda.</div>'}</div></section><div class="workspace-actions">${podeVerMonday() ? `<a class="workspace-action" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">↗ Abrir no Monday</a>` : ''}</div></div>`;
  } catch (e) {
    drawer.innerHTML = `<div class="workspace-kicker"><span>Vybe OS · Solicitação</span><button class="workspace-close" type="button" onclick="closeItemWorkspace()">×</button></div><div class="workspace-empty">Não foi possível carregar o contexto. ${safeText(e.message)}</div>`;
  }
}

// Regra Vybe OS: clique em atividade abre contexto interno; Monday é um atalho deliberado dentro do workspace.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('brief-overlay')) { fecharBriefing(); return; }
  // O organizador abre por cima do menu de etiquetas: o Esc fecha a camada de
  // cima, nao as duas.
  if (document.getElementById('etq-overlay')) { fecharOrganizador(); return; }
  if (document.getElementById('workspace-drawer')) closeItemWorkspace();
  if (typeof managerCommandDrawerOpen !== 'undefined' && managerCommandDrawerOpen) closeManagerCommandDrawer();
  document.getElementById('cadastros-preview-overlay')?.remove();
  if (document.getElementById('da-member-workload-overlay')) closeDaMemberWorkload();
});

document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href*="/pulses/"]');
  if (!link || link.dataset.externalMonday === 'true') return;
  const match = link.href.match(/\/pulses\/(\d+)/);
  if (!match) return;
  event.preventDefault();
  event.stopPropagation();
  openItemWorkspace(match[1]);
}, true);
async function postWorkspaceUpdate(body, successMessage, itemId) {
  const alvo = String(itemId || activeWorkspaceItemId || '');
  if (!alvo) return;
  const text = String(body || '').trim();
  if (!text) return showToast('Escreva uma atualização antes de enviar.', 'info');
  const item = findOperationalItem(alvo) || { id: alvo };
  await tentarEscritaDupla(item, { acao:'comentario', item:alvo, texto:text });
  showToast(successMessage, 'ok');
  const input = document.getElementById('workspace-comment-input'); if (input) input.value = '';
  const link = document.getElementById('workspace-link-input'); if (link) link.value = '';
  const atualizado = findOperationalItem(alvo);
  if (atualizado && String(activeWorkspaceItemId) === alvo && document.getElementById('workspace-drawer')) {
    renderWorkspaceDrawer(await fetchWorkspaceItem(alvo), atualizado);
  }
}
async function saveWorkspaceComment() {
  const input = document.getElementById('workspace-comment-input');
  try { await postWorkspaceUpdate(`[Vybe OS] ${input?.value || ''}`, '✓ Atualização registrada no Vybe OS'); }
  catch (e) { showToast(`Não foi possível registrar: ${e.message}`, 'err', 7000); }
}
// O registro do link vira uma funcao que recebe o endereco e a peca; a caixa da
// gaveta so entrega o que digitaram nela.
async function registrarLinkDeEntrega(url, itemId) {
  const limpo = String(url || '').trim();
  if (!/^https?:\/\//i.test(limpo)) return showToast('Cole um link válido começando com https://', 'info');
  try {
    await postWorkspaceUpdate(`[Vybe OS · Link de entrega] ${limpo}`,
      '✓ Link de entrega registrado no Vybe OS', itemId);
  } catch (e) { showToast(`Não foi possível registrar o link: ${e.message}`, 'err', 7000); }
}
async function saveWorkspaceLink() {
  return registrarLinkDeEntrega(document.getElementById('workspace-link-input')?.value);
}
