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
// No celular a barra de baixo fica à vista por cima da gaveta (quadro 28): tocar nela fecha a gaveta antes de a barra
// fazer o que faz, para a tela escolhida não abrir escondida atrás dela.
if (typeof document !== 'undefined') document.addEventListener('click', (evento) => {
  if (!document.getElementById('workspace-drawer')) return;
  if (evento.target instanceof Element && evento.target.closest('#mundo-hud .vv-trilho')) closeItemWorkspace();
}, true);

function closeItemWorkspace() {
  if (typeof fecharLogDaPeca === 'function') fecharLogDaPeca();
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
// Rótulo em texto normal: "ATUALIZAÇÃO" em caixa gritava mais que o próprio registro.
function workspaceTimelineType(body){ const text=String(body||''); if(/Check-in/i.test(text)) return 'Check-in'; if(/Planejamento/i.test(text)) return 'Planejamento'; if(/Direcionamento D\.A/i.test(text)) return 'Direção de arte'; if(/Passagem de bastão/i.test(text)) return 'Passagem de bastão'; if(/Link de entrega/i.test(text)) return 'Entrega'; if(/Bloqueio/i.test(text)) return 'Bloqueio'; return 'Atualização'; }
function workspaceUrlFromText(value=''){ const match=String(value||'').match(/https?:\/\/[^\s<>"']+/i); return match ? match[0].replace(/[),.;]+$/,'') : ''; }
function workspaceDeliveryInfo(detail={}){ const updates=detail?.updates||[]; const tagged=updates.map(update=>({update,url:workspaceUrlFromText(workspacePlainText(update?.body||''))})).find(entry=>entry.url && /Link de entrega|Link final|Entrega final/i.test(workspacePlainText(entry.update?.body||''))); if(tagged) return {url:tagged.url,label:'LINK DE ENTREGA REGISTRADO',name:'Material pronto para abrir e postar',creator:tagged.update?.creator?.name||'Equipe Vybe',created_at:tagged.update?.created_at||'',source:'Atualização de entrega'}; const assets=[...(detail?.assets||[]),...updates.flatMap(update=>update?.assets||[])]; const asset=assets.find(entry=>entry?.public_url||entry?.url); if(asset) return {url:asset.public_url||asset.url,label:'ARQUIVO ANEXADO À DEMANDA',name:asset.name||'Material anexado',creator:'Equipe Vybe',created_at:asset.created_at||'',source:'Arquivo do item'}; return null; }
function workspaceCopyFallback(text){ const input=document.createElement('textarea'); input.value=text; input.setAttribute('readonly',''); input.style.cssText='position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(input); input.select(); const copied=document.execCommand('copy'); input.remove(); if(!copied) throw new Error('Cópia manual indisponível'); }
function showWorkspaceDeliveryCopySheet(text){ document.getElementById('workspace-delivery-copy-sheet')?.remove(); const sheet=document.createElement('section'); sheet.id='workspace-delivery-copy-sheet'; sheet.className='workspace-delivery-copy-sheet'; sheet.innerHTML=`<b>Link pronto para copiar</b><small>Seu navegador bloqueou a cópia automática. O endereço abaixo já está selecionado: use Ctrl/Cmd + C.</small><input id="workspace-delivery-copy-value" readonly value="${safeText(text)}"><button type="button" onclick="document.getElementById('workspace-delivery-copy-sheet')?.remove()">Fechar</button>`; document.body.appendChild(sheet); const input=sheet.querySelector('input'); input?.focus(); input?.select(); }
async function copyWorkspaceDeliveryLink(url){ const text=String(url||'').trim(); if(!text) return showToast('Nenhum material disponível para copiar.','info'); try{ if(navigator.clipboard?.writeText){ await Promise.race([navigator.clipboard.writeText(text),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de cópia excedido')),1200))]); } else workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(error){ try{ workspaceCopyFallback(text); showToast('✓ Link de entrega copiado para a Tainara','ok'); }catch(fallbackError){ showWorkspaceDeliveryCopySheet(text); showToast('Link aberto para cópia manual.','info',7000); } } }
function focusWorkspaceDeliveryInput(){ gavetaAba('arquivos'); const input=document.getElementById('workspace-link-input'); if(!input) return; input.scrollIntoView({behavior:'smooth',block:'center'}); input.focus(); showToast('Cole aqui o link final para liberar a postagem.','info'); }
function workspaceDeliveryDock(detail,item){ const delivery=workspaceDeliveryInfo(detail); // Sem material, a faixa só avisava e levava para a caixa de link logo abaixo.
  // A entrega passou a ser uma seção só: o estado vira a primeira linha dela.
  if(!delivery) return `<div class="entrega-estado faltando"><b>Material ainda não enviado</b><small>Quem publica precisa do arquivo final ou do link antes de a peça ir para publicação.</small></div>`; const when=delivery.created_at?new Date(delivery.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'sem horário disponível'; return `<section class="workspace-delivery-dock"><div class="workspace-delivery-copy"><span class="workspace-delivery-kicker">Entrega pronta para postar</span><b>${safeText(delivery.name)}</b><small>${safeText(delivery.source)} · enviado por ${safeText(delivery.creator)} · ${safeText(when)}</small></div><div class="workspace-delivery-actions"><a class="workspace-delivery-open" href="${safeText(delivery.url)}" target="_blank" rel="noopener">ABRIR MATERIAL ↗</a><button type="button" class="workspace-delivery-copy-btn" onclick="copyWorkspaceDeliveryLink('${safeText(delivery.url)}')">Copiar link</button></div></section>`; }

// ARQUIVO OU LINK: UMA ESCOLHA, NÃO DOIS CARTÕES.
//
// Os dois caminhos ficavam lado a lado, cada um com título, instrução e botão, e
// "Registrar link da entrega" era laranja mesmo para quem ia arrastar um card.
// Agora a pessoa escolhe o caminho e vê só o dele. Vídeo abre em Link, porque
// arquivo de vídeo passa do limite do upload; o resto abre em Arquivo.
function caminhoInicialDeEntrega(item) {
  return /reels|v[ií]deo|audiovisual|motion/i.test(String(item?.formato || item?.tipo || '')) ? 'link' : 'arquivo';
}
function workspaceRegistrosPendentesHtml() {
  return `<div id="workspace-registros-pendentes">${pendenciasDeArquivoHtml(activeWorkspaceItemId)}</div>`;
}
function workspaceUploadHtml(mostrarPendencias = true) {
  return `${mostrarPendencias ? workspaceRegistrosPendentesHtml() : ''}<input id="workspace-file-input" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,application/pdf" onchange="uploadWorkspaceFile(this)">
          <div class="workspace-dropzone" role="button" tabindex="0" aria-label="Adicionar arquivos" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('workspace-file-input').click()}" onclick="document.getElementById('workspace-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleWorkspaceDrop(event)"><div><strong>Arraste o arquivo aqui ou clique</strong>Card, arte ou PDF · PNG, JPG, WEBP ou PDF · até 200 MB</div></div>
          <p class="workspace-note">Vai para a pasta do cliente no Drive da Vybe e aparece em “Arquivos”.</p>`;
}
function escolherCaminhoDeEntrega(qual) {
  const caixa = document.querySelector('#workspace-drawer .entrega-caminhos');
  if (!caixa) return;
  caixa.querySelectorAll('[data-entrega]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.entrega === qual)));
  caixa.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== qual; });
}

// AÇÃO QUE APAGA NÃO FICA SOLTA NO MEIO DO CONTEÚDO.
//
// "Arquivar atividade" morava numa barra grudada no rodapé da gaveta, no meio das
// seções. Com o fundo dela quase transparente, ela flutuava por cima da ficha e
// da entrega, com os textos um sobre o outro. No Mac a ação destrutiva fica num
// menu, ao lado do fechar — e é onde ela está agora.
// O mesmo menu serve à gaveta e ao cartão de resumo: o Arquivar mora num lugar
// só, do mesmo jeito. 'mover' é falso para solicitação, que não muda de quadro.
// linkELog: na gaveta, "Copiar link" e "Log de atividade" também moram no menu; no celular os ícones da barra saem
// e ficam só aqui (quadro 28 do redesign: as ações secundárias no "⋯").
function menuDeAcoesDaPecaHtml(item, { mover = true, linkELog = false } = {}) {
  const id = safeText(String(item.id));
  const monday = podeVerMonday();
  return `<details class="workspace-mais">
    <summary aria-label="Mais ações" title="Mais ações">${ICONE_LINHA.mais}</summary>
    <div class="workspace-mais-menu" role="menu">
      ${linkELog ? `<button type="button" role="menuitem" class="workspace-mais-cel" onclick="fecharMenusDaGaveta();copiarLinkDaAtividade('${id}')">Copiar link</button>
      <button type="button" role="menuitem" onclick="fecharMenusDaGaveta();abrirLogDaPeca('${id}')">Log de atividade</button><hr>` : ''}
      ${monday && mover ? `<button type="button" role="menuitem" onclick="fecharMenusDaGaveta();moverPecaDeBoard('${id}')">Mover para Demandas</button>` : ''}
      ${monday && item.url ? `<a role="menuitem" data-external-monday="true" href="${safeText(item.url)}" target="_blank" rel="noopener" onclick="fecharMenusDaGaveta()">Abrir no Monday ↗</a>` : ''}
      ${monday ? '<hr>' : ''}
      <button type="button" role="menuitem" class="perigo" onclick="fecharMenusDaGaveta();removerPeca('${id}')">Arquivar atividade</button>
    </div>
  </details>`;
}
function fecharMenusDaGaveta() {
  let fechou = false;
  document.querySelectorAll('details.workspace-mais[open]').forEach((d) => { d.open = false; fechou = true; });
  return fechou;
}
document.addEventListener('click', (e) => { if (!e.target.closest?.('details.workspace-mais')) fecharMenusDaGaveta(); });

// A gaveta aberta agora. O botao de conteudo abre a leitura sem ir a rede de
// novo: o briefing ja veio junto com o resto do contexto.
let DETALHE_DA_GAVETA = null;
// A GAVETA PELO QUADRO DO PADRÃO V2 (moodboard, "Gaveta da demanda").
//
// De cima para baixo, como no quadro: a linha "Conteúdo · nº" com três ícones (copiar link, mais ações, fechar),
// o título, a linha do cliente com o status em pílula e o objetivo, o bloco das duas datas e do responsável,
// quatro abas (Resumo, Arquivos, Conversa, Histórico) e o pé fixo com a atualização rápida e o próximo passo.
// Nada do que a gaveta antiga fazia saiu: o que não está no Resumo mora numa das outras abas.
const GAVETA_ICONE = {
  fechar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  seta: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  sobe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>',
  visto: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
};
const GAVETA_ABAS = ['resumo', 'arquivos', 'conversa', 'historico'];
const GAVETA_OBJETIVOS = { atracao: 'Atração', educacao: 'Educação', conversao: 'Conversão' };
let ABA_DA_GAVETA = 'resumo';
function gavetaAba(qual) {
  if (!GAVETA_ABAS.includes(qual)) return;
  ABA_DA_GAVETA = qual;
  const caixa = document.querySelector('#workspace-drawer .gv2');
  if (!caixa) return;
  caixa.querySelectorAll('[data-gv-aba]').forEach((b) => { const on = b.dataset.gvAba === qual; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  caixa.querySelectorAll('[data-gv-painel]').forEach((p) => { p.hidden = p.dataset.gvPainel !== qual; });
  const corpo = caixa.querySelector('.gv2-corpo');
  if (corpo) corpo.scrollTop = 0;
}
function gavetaTeclaNaAba(evento) {
  const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
  if (!passo) return;
  evento.preventDefault();
  const n = (GAVETA_ABAS.indexOf(ABA_DA_GAVETA) + passo + GAVETA_ABAS.length) % GAVETA_ABAS.length;
  gavetaAba(GAVETA_ABAS[n]);
  document.querySelector(`#workspace-drawer [data-gv-aba="${GAVETA_ABAS[n]}"]`)?.focus();
}
// O próximo passo segue o fluxo do quadro (Paulo, 13/11/2026; servidor em server/fluxo-status.js): por padrão, o status
// seguinte na ordem do catálogo (a mesma ordem do seletor); no modo próprio, o próximo escolhido para o status atual;
// em "perguntar", nenhum. Sem próximo (último status, status fora do catálogo ou "perguntar"), o botão abre o seletor.
// O fluxo é lido uma vez; enquanto não chega, vale a ordem da lista, e quando chega a gaveta aberta se redesenha.
function proximoStatusDaPeca(item) {
  carregarFluxoStatus();
  const fluxo = fluxoDoQuadro(quadroDaPeca(item));
  if (fluxo.modo === 'perguntar') return null;
  const opcoes = (typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : []).filter((o) => o && o.ativa !== false);
  const igual = (a, b) => (typeof mesmoStatus === 'function' ? mesmoStatus(a, b) : String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase());
  const atual = opcoes.findIndex((o) => igual(o.label, item?.status));
  if (atual < 0) return null;
  if (fluxo.modo === 'proprio') {
    const escolha = fluxo.proximo[opcoes[atual].chave];
    if (escolha === '-') return null;
    const o = escolha ? opcoes.find((x) => x.chave === escolha) : null;
    if (o) return o;
  }
  return atual < opcoes.length - 1 ? opcoes[atual + 1] : null;
}
let FLUXO_STATUS = null, FLUXO_STATUS_LENDO = false;
function quadroDaPeca(item) {
  const pedido = typeof isRequestItem === 'function' && isRequestItem(item);
  return String(pedido ? (typeof BOARD_DEMANDAS_ID !== 'undefined' ? BOARD_DEMANDAS_ID : '') : (typeof BOARD_ID !== 'undefined' ? BOARD_ID : ''));
}
function fluxoDoQuadro(board) {
  const cfg = FLUXO_STATUS?.boards?.[String(board)];
  return { modo: ['ordem', 'proprio', 'perguntar'].includes(cfg?.modo) ? cfg.modo : 'ordem', proximo: cfg?.proximo || {} };
}
function carregarFluxoStatus(forcar = false) {
  if ((FLUXO_STATUS && !forcar) || FLUXO_STATUS_LENDO || typeof fetch !== 'function') return;
  FLUXO_STATUS_LENDO = true;
  fetch('/api/painel?area=opcoes&fluxo=1', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const antes = JSON.stringify(FLUXO_STATUS);
      FLUXO_STATUS = d?.fluxo?.boards ? d.fluxo : { boards: {} };
      if (antes === JSON.stringify(FLUXO_STATUS) || typeof document === 'undefined') return;
      const aberta = document.getElementById('workspace-drawer');
      const id = typeof activeWorkspaceItemId !== 'undefined' ? activeWorkspaceItemId : null;
      if (aberta && id && typeof DETALHE_DA_GAVETA !== 'undefined' && DETALHE_DA_GAVETA && typeof findOperationalItem === 'function') {
        const item = findOperationalItem(id);
        if (item) renderWorkspaceDrawer(DETALHE_DA_GAVETA, item);
      }
    })
    .catch(() => { FLUXO_STATUS = FLUXO_STATUS || { boards: {} }; })
    .finally(() => { FLUXO_STATUS_LENDO = false; });
}
// O status na pílula do padrão: fundo claro e texto escuro tirados da cor que o status tem no quadro.
function gavetaPilulaHtml(status, cor, seta = '') {
  const doCatalogo = cor ? null : (typeof corDeStatus === 'function' ? corDeStatus(status) : null);
  const c = /^#[0-9a-f]{3,8}$/i.test(String(cor || doCatalogo?.cor || '')) ? (cor || doCatalogo.cor) : '#8A847A';
  // Direção 3: pílula clara com a bolinha na cor do catálogo; cheia só em Alteração, Atrasada e Finalizado.
  const s = String(status || '');
  const cheia = /altera/i.test(s) ? ' a' : /atrasad/i.test(s) ? ' r' : /finaliz/i.test(s) ? ' g' : '';
  return `<span class="gv2-st${cheia}" style="--c:${c}">${safeText(status || 'Sem status')}${seta}</span>`;
}
function gavetaObjetivoHtml(item) {
  const vc = typeof window !== 'undefined' ? window.VybeConteudo : null;
  if (!vc?.campoObjetivoHtml || (typeof isRequestItem === 'function' && isRequestItem(item))) return '';
  const atual = typeof vc.objetivoDe === 'function' ? vc.objetivoDe(item.id) : '';
  return `<span class="gv2-obj-grupo"><details class="gv2-obj"><summary class="gv2-pill ${atual ? 'b' : 'n'}" title="Objetivo da peça · clique para trocar"><span data-gv-objetivo>${safeText(GAVETA_OBJETIVOS[atual] || 'Definir')}</span></summary>
      <div class="gv2-obj-menu">${vc.campoObjetivoHtml(item)}</div></details><span class="gv2-sub">objetivo</span></span>`;
}
if (typeof document !== 'undefined') document.addEventListener('click', (evento) => {
  const alvo = evento.target?.closest ? evento.target : null;
  if (!alvo) return;
  const aberto = document.querySelector('#workspace-drawer details.gv2-obj[open]');
  if (aberto && !alvo.closest('details.gv2-obj')) aberto.open = false;
  if (!alvo.closest('#workspace-drawer [data-vc-objetivo]')) return;
  // O campo de objetivo se redesenha sozinho; a pílula acompanha logo depois.
  setTimeout(() => {
    const caixa = document.querySelector('#workspace-drawer details.gv2-obj');
    const rotulo = caixa?.querySelector('[data-gv-objetivo]');
    if (!rotulo) return;
    const atual = window.VybeConteudo?.objetivoDe?.(activeWorkspaceItemId) || '';
    rotulo.textContent = GAVETA_OBJETIVOS[atual] || 'Definir';
    caixa.querySelector('summary').className = `gv2-pill ${atual ? 'b' : 'n'}`;
    caixa.open = false;
  }, 0);
});
// O botão preto do pé conta o estado: gira enquanto grava e fica verde quando a peça chegou no status novo.
// A gravação é a de sempre (updateFocusStatus, com os portões); portão cancelado devolve o botão ao que era.
let GAVETA_AVANCANDO = false;
async function gavetaAvancar(itemId, botao) {
  if (GAVETA_AVANCANDO) return;
  const item = findOperationalItem(itemId);
  const proximo = item ? proximoStatusDaPeca(item) : null;
  if (!item || !proximo || typeof updateFocusStatus !== 'function') return;
  GAVETA_AVANCANDO = true;
  if (botao) botao.dataset.estado = 'indo';
  try { await updateFocusStatus(String(itemId), proximo.label); }
  catch (e) { showToast(`Não foi possível trocar o status: ${e.message}`, 'err', 7000); }
  finally { GAVETA_AVANCANDO = false; }
  const depois = findOperationalItem(itemId);
  const chegou = depois && (typeof mesmoStatus === 'function' ? mesmoStatus(depois.status, proximo.label) : depois.status === proximo.label);
  if (!botao?.isConnected) return;
  if (!chegou) { delete botao.dataset.estado; return; }
  botao.dataset.estado = 'feito';
  const texto = botao.querySelector('.gv2-avancar-texto');
  if (texto) texto.innerHTML = `${GAVETA_ICONE.visto}Agora em ${safeText(proximo.label)}`;
  setTimeout(() => {
    if (String(activeWorkspaceItemId) !== String(itemId) || !DETALHE_DA_GAVETA || !document.getElementById('workspace-drawer')) return;
    renderWorkspaceDrawer(DETALHE_DA_GAVETA, findOperationalItem(itemId) || depois);
  }, 1400);
}
function gavetaEsqueletoHtml(rotulo) {
  const l = (w, h = 12, r = 6) => `<i class="gv2-sk" style="width:${w};height:${h}px;border-radius:${r}px"></i>`;
  return `<div class="gv2 gv2-carregando" aria-busy="true" aria-label="${rotulo}">${gavetaPegaHtml()}
    <div class="gv2-topo"><p class="gv2-sub gv2-onde">${rotulo}</p><button type="button" class="gv2-ic gv2-fechar" onclick="closeItemWorkspace()" aria-label="Fechar" title="Fechar (Esc)">${GAVETA_ICONE.fechar}</button></div>
    ${l('72%', 26, 8)}${l('46%', 22, 999)}${l('100%', 66, 14)}${l('64%', 38, 999)}${l('100%', 12)}${l('88%', 12)}${l('70%', 12)}${l('100%', 46, 14)}</div>`;
}
// A GAVETA NO CELULAR (quadro "No celular", Demanda aberta em folha).
//
// Abaixo de 600 px a gaveta sobe de baixo para cima como folha: o puxador, o atraso, o título, o cliente com a data e quem
// responde, a prévia da arte, as quatro etapas em texto com a atual em negrito, a lista do que falta e, no pé, Pedir
// alteração e Aprovar. O resto da peça (datas, briefing, arquivos, conversa, histórico, comentário, passar bastão) continua
// na mesma gaveta, a um toque: "ver a peça inteira" estica a folha e mostra tudo como antes.
const GAVETA_ETAPAS = ['Criação', 'aprovação interna', 'cliente', 'pronta'];
function etapaDaPeca(item) {
  const s = String((typeof operationalFlowStatus === 'function' ? operationalFlowStatus(item) : item?.status) || item?.status || '').trim().toLowerCase();
  if (/finaliz|agendad|para agendar|publicad|postad|entregue|conclu/.test(s)) return 3;
  if (/cliente/.test(s)) return 2;
  if (/aprova|ag\. interno|revis/.test(s)) return 1;
  return 0;
}
function gavetaHojeIso() {
  return (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
}
function gavetaAtrasoHtml(item) {
  const p = String(item?.prazo_iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p) || etapaDaPeca(item) === 3) return '';
  const dias = Math.round((Date.parse(gavetaHojeIso()) - Date.parse(p)) / 864e5);
  if (dias > 0) return `<span class="gv2-cel-pill r">Atrasada ${dias} ${dias === 1 ? 'dia' : 'dias'}</span>`;
  return dias === 0 ? '<span class="gv2-cel-pill a">Prazo hoje</span>' : '';
}
// Aprovar e Pedir alteração só aparecem na aprovação interna e quando o quadro da peça tem os dois status de destino;
// os dois abrem os portões de sempre (os mesmos do "Para você decidir" do Hoje), nada grava direto daqui.
function gavetaDecisaoDaPeca(item) {
  const st = String(item?.status || '');
  if (!/aprova/i.test(st) || /cliente/i.test(st)) return null;
  const opcoes = typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : [];
  const achar = (alvo) => opcoes.find((o) => String(o?.label || '').trim().toLowerCase() === alvo) || null;
  // Aprovar leva a "Para agendar"; o quadro que não tem esse status aprova mandando para o status seguinte ao atual.
  const seguinte = proximoStatusDaPeca(item);
  const aprovar = achar('para agendar') || (seguinte && !/altera/i.test(seguinte.label) ? seguinte : null), alterar = achar('alteração');
  return aprovar && alterar ? { aprovar, alterar } : null;
}
function gavetaDecidir(itemId, acao) {
  const item = findOperationalItem(itemId);
  const d = item ? gavetaDecisaoDaPeca(item) : null;
  const portao = acao === 'aprovar' ? globalThis.openQualityGate : globalThis.openStatusContextGate;
  if (!d || typeof portao !== 'function') return showToast('Esta peça não está em aprovação interna.', 'info');
  portao(item, acao === 'aprovar' ? d.aprovar : d.alterar);
}
function gavetaInteira(sim) {
  const drawer = document.getElementById('workspace-drawer');
  if (!drawer) return;
  drawer.classList.toggle('gv2-folha-inteira', !!sim);
  drawer.querySelector('.gv2-corpo')?.scrollTo?.(0, 0);
}
// O puxador: arrastar para baixo fecha, para cima estica; um toque alterna entre a folha e a peça inteira.
function gavetaPuxar(evento) {
  const pega = evento.currentTarget;
  const y0 = evento.clientY;
  let dy = 0;
  const mexe = (e) => { dy = e.clientY - y0; };
  const solta = () => {
    pega.removeEventListener('pointermove', mexe); pega.removeEventListener('pointerup', solta); pega.removeEventListener('pointercancel', solta);
    const drawer = document.getElementById('workspace-drawer');
    if (dy > 70) closeItemWorkspace();
    else if (dy < -40) gavetaInteira(true);
    else if (Math.abs(dy) < 8) gavetaInteira(!drawer?.classList.contains('gv2-folha-inteira'));
  };
  pega.setPointerCapture?.(evento.pointerId);
  pega.addEventListener('pointermove', mexe); pega.addEventListener('pointerup', solta); pega.addEventListener('pointercancel', solta);
}
function gavetaPegaHtml() {
  return '<span class="gv2-pega" role="button" tabindex="0" aria-label="Puxador: arraste para baixo para fechar, toque para ver a peça inteira" onpointerdown="gavetaPuxar(event)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();gavetaInteira(!this.closest(\'#workspace-drawer\')?.classList.contains(\'gv2-folha-inteira\'))}"><i aria-hidden="true"></i></span>';
}
function gavetaCelularHtml(detail, item, assets) {
  const id = safeText(String(item.id));
  const ehPedido = typeof isRequestItem === 'function' ? isRequestItem(item) : false;
  const clientes = (typeof clientesDoItem === 'function' ? clientesDoItem(item) : [item.cliente]).filter(Boolean);
  const data = ehPedido ? item.conclusao || item.veiculacao : item.veiculacao;
  const quando = data && data !== '—' ? `${ehPedido ? 'conclusão' : 'veicula'} ${safeText(data)}` : (ehPedido ? 'sem data de conclusão' : 'sem veiculação');
  const imagem = (assets || []).find((a) => (a?.public_url || a?.url) && /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(String(a.name || a.file_extension || a.public_url || a.url || '')));
  const previa = imagem
    ? `<a class="gv2-cel-arte" href="${safeText(imagem.public_url || imagem.url)}" target="_blank" rel="noopener"><img src="${safeText(imagem.public_url || imagem.url)}" alt="Prévia da arte de ${safeText(item.nome)}" loading="lazy"></a>`
    : `<span class="gv2-cel-arte vazia" role="button" tabindex="0" onclick="document.getElementById('workspace-file-input').click()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">Sem arte anexada · toque para enviar</span>`;
  const etapa = etapaDaPeca(item);
  const texto = GAVETA_ETAPAS.map((e, k) => (k === etapa ? `<b>${safeText(e)}</b>` : safeText(e))).join(', ');
  const marca = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const linha = (estado, rotulo, sub = '') => `<div class="gv2-cel-lin"><i class="gv2-cel-cx ${estado}">${estado === 'vazio' ? '' : marca}</i><p>${rotulo}</p>${sub ? `<span class="gv2-sub">${sub}</span>` : ''}</div>`;
  const subitens = detail?.subitens || [];
  const maiusc = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lista = subitens.length
    ? subitens.slice(0, 4).map((s) => linha(/^(feito|conclu|aprovado)/i.test(String(s.status || '')) ? 'ok' : 'vazio', safeText(s.titulo || 'Subdemanda'), safeText(s.status || ''))).join('')
      + (subitens.length > 4 ? `<p class="gv2-sub gv2-cel-mais">+ ${subitens.length - 4} na peça inteira</p>` : '')
    : GAVETA_ETAPAS.map((e, k) => linha(k < etapa ? 'ok' : k === etapa ? 'vivo' : 'vazio', safeText(maiusc(e)), k === etapa ? safeText(item.status || '') : '')).join('');
  const decisao = gavetaDecisaoDaPeca(item);
  const proximo = proximoStatusDaPeca(item);
  const pe = decisao
    ? `<button type="button" class="gv2-cel-btn" onclick="gavetaDecidir('${id}','alterar')">Pedir alteração</button><button type="button" class="gv2-cel-btn k principal" onclick="gavetaDecidir('${id}','aprovar')">Aprovar</button>`
    : proximo
      ? `<button type="button" class="gv2-cel-btn k principal v2-estado" onclick="gavetaAvancar('${id}',this)"><span class="gv2-avancar-texto">${safeText(/^para\s/i.test(proximo.label) ? `Enviar ${proximo.label.charAt(0).toLowerCase()}${proximo.label.slice(1)}` : `Enviar para ${proximo.label}`)}</span></button>`
      : `<button type="button" class="gv2-cel-btn k principal" onclick="openStatusEditor(event,'${id}')">Trocar status</button>`;
  return `<div class="gv2-cel">
      <div class="gv2-cel-topo">${gavetaAtrasoHtml(item)}<span class="gv2-cel-st" role="button" tabindex="0" aria-label="Status: ${safeText(item.status)}. Trocar" onclick="openStatusEditor(event,'${id}')" onkeydown="if(event.key==='Enter'||event.key===' ')openStatusEditor(event,'${id}')">${gavetaPilulaHtml(item.status, item.status_color, GAVETA_ICONE.seta)}</span><span class="gv2-cel-vao"></span>
        ${menuDeAcoesDaPecaHtml(item, { linkELog: true })}<button type="button" class="gv2-cel-ic" onclick="closeItemWorkspace()" aria-label="Fechar">${GAVETA_ICONE.fechar}</button></div>
      <h2 class="gv2-cel-titulo">${safeText(item.nome)}</h2>
      <p class="gv2-sub gv2-cel-cli"><span class="gv2-clientes">${clientes.map(cliCor).join(' ') || 'Cliente não informado'}</span><span>${quando}</span>${typeof ownerEditorTrigger === 'function' ? ownerEditorTrigger(item, 'gv2-cel-dono') : ''}</p>
      ${previa}
      <div class="gv2-cel-etapas"><span class="v2-barra" style="--v:${(etapa + 1) * 25}%;--c:#1F1D1A"><i></i></span><p class="gv2-sub">${texto}</p></div>
      <div class="gv2-cel-lista">${lista}</div>
      <p class="gv2-sub gv2-cel-tudo" title="Datas, briefing, arquivos, conversa e histórico"><span class="gv2-lk" role="button" tabindex="0" onclick="gavetaInteira(true)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gavetaInteira(true)}">ver a peça inteira</span></p>
      <div class="gv2-cel-pe">${pe}</div>
    </div>`;
}
// DIREÇÃO 3 (quadro D3-Gaveta): as quatro etapas em barra logo abaixo do título, a etapa atual em negrito.
function gavetaEtapasHtml(item) {
  const etapa = etapaDaPeca(item);
  const nomes = ['Criação', 'Aprovação interna', 'Cliente', 'Pronta'];
  return `<div class="gv2-etapas" role="img" aria-label="Etapa: ${safeText(nomes[etapa])}">
      <span class="gv2-etapas-barra">${nomes.map((_, k) => `<i class="${k <= etapa ? 'on' : ''}" style="--k:${k}"></i>`).join('')}</span>
      <span class="gv2-etapas-nomes">${nomes.map((n, k) => (k === etapa ? `<b>${safeText(n)}</b>` : `<span>${safeText(n)}</span>`)).join('')}</span></div>`;
}
// A data que já passou fica em vermelho (só o que venceu é vermelho); peça pronta não vence.
function gavetaDataVencida(iso, item) {
  const d = String(iso || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && etapaDaPeca(item) !== 3 && d < gavetaHojeIso();
}
// A pílula de atraso no canto da linha do cliente (a mesma conta da folha do celular).
function gavetaAtrasoDesktopHtml(item) {
  return gavetaAtrasoHtml(item).replace('gv2-cel-pill', 'gv2-atraso');
}
// Ficha em bloco: grupo, formato, captação e prioridade à vista; um toque abre a ficha inteira (editável) no lugar.
function gavetaFichaResumoHtml(detail, item) {
  const fichaInteira = typeof workspaceFichaHtml === 'function' ? workspaceFichaHtml(detail, item.id) : '';
  if (!fichaInteira) return '';
  const f = detail.ficha || {};
  const cat = detail.catalogos || {};
  const rotulo = (lista, chave) => (lista || []).find((o) => String(o.chave) === String(chave))?.rotulo || '';
  const daColuna = (coluna, chave) => rotulo((cat.opcoes || []).filter((o) => o.coluna_id === coluna), chave);
  const grupos = typeof GRUPOS_DA_PRODUCAO !== 'undefined' ? GRUPOS_DA_PRODUCAO : [];
  const grupo = (grupos.find(([v]) => String(v) === String(f.grupo_id || '')) || [])[1] || '';
  const prioridade = daColuna('color_mm164yv8', f.prioridade_chave);
  const campos = [
    ['Grupo', grupo],
    ['Formato', daColuna('lista_suspensa0__1', (f.formato_chaves || [])[0])],
    ['Captação', rotulo(cat.captacao, f.captacao_chave)],
    ['Prioridade', prioridade, /alta|urgente|crític/i.test(prioridade) ? 'a' : ''],
  ];
  return `<details class="gv2-ficha"><summary aria-label="Ficha da peça: abrir todos os campos">${campos.map(([r, v, tom]) => `<span><small>${r}</small><b class="${tom || ''}${v ? '' : ' vazio'}">${safeText(v || '—')}</b></span>`).join('')}</summary>
      <div class="gv2-ficha-inteira">${fichaInteira}</div></details>`;
}
// Coluna da direita do Resumo: arquivos, conversa e histórico em prévia; cada um leva à aba inteira.
function gavetaIniciais(nome) {
  return String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
}
function gavetaArquivosPreviaHtml(assets, entrega) {
  const ehImagem = (a) => /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(String(a?.name || a?.file_extension || a?.public_url || a?.url || ''));
  const extensao = (a) => (String(a?.file_extension || a?.name || '').match(/([a-z0-9]{2,5})$/i)?.[1] || 'arquivo').toLowerCase();
  const tons = ['#FBE3D2', '#DCE7FA', '#E8F5EC', '#EEEAFB'];
  const mini = assets.slice(0, 2).map((a, k) => {
    const url = a?.public_url || a?.url || '';
    const capa = a?.url_thumbnail || (ehImagem(a) ? url : '');
    const fundo = capa ? `background-color:${tons[k % tons.length]};background-image:url('${safeText(capa)}')` : `background-color:${tons[k % tons.length]}`;
    return `<a class="gv2-arq" href="${safeText(url || '#')}" target="_blank" rel="noopener" style="${fundo}" title="${safeText(a?.name || 'Arquivo')}"><span>v${k + 1} · ${safeText(extensao(a))}</span></a>`;
  }).join('');
  const abre = "document.getElementById('workspace-file-input').click()";
  return `<section class="gv2-sec" aria-label="Arquivos"><div class="gv2-sec-topo"><h3>Arquivos</h3>${assets.length > 2
      ? `<span class="gv2-lk" role="button" tabindex="0" onclick="gavetaAba('arquivos')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gavetaAba('arquivos')}">ver ${assets.length}</span>`
      : '<span class="gv2-sub">Drive do cliente</span>'}</div>
      <div class="gv2-arqs">${mini}
        <div class="gv2-arq gv2-entrega" role="button" tabindex="0" aria-label="Entrega: adicionar arquivo" onclick="${abre}"
          onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();${abre}}"
          ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="this.classList.remove('dragover');handleWorkspaceDrop(event)">
          ${GAVETA_ICONE.sobe}<b>${entrega ? 'Entregue' : 'Entrega'}</b>${entrega
            ? `<a class="gv2-sub" href="${safeText(entrega.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${safeText(entrega.name)}">abrir</a>`
            : `<span class="gv2-sub">arquivo ou <span class="gv2-lk" role="button" tabindex="0" onclick="event.stopPropagation();focusWorkspaceDeliveryInput()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();focusWorkspaceDeliveryInput()}">link</span></span>`}</div></div></section>`;
}
function gavetaConversaPreviaHtml(updates) {
  // O registro de troca de status já aparece no bloco de contexto; a prévia mostra a conversa.
  const ultimas = updates.filter((u) => !String(u?.body || '').includes('Vybe OS · Contexto de status')).slice(0, 3);
  const linha = (u) => {
    const nome = u?.creator?.name || 'Equipe Vybe';
    const texto = (typeof workspacePlainText === 'function' ? workspacePlainText(u?.body || '') : String(u?.body || '')).replace(/\s+/g, ' ').trim();
    const quando = typeof quandoNaBahia === 'function' ? quandoNaBahia(u?.created_at) : String(u?.created_at || '').replace('T', ' ').slice(0, 16);
    return `<div class="gv2-msg"><span class="gv2-av" aria-hidden="true">${safeText(gavetaIniciais(nome))}</span><p><b>${safeText(nome)}</b> <span class="gv2-sub">${safeText(quando || '')}</span><span class="gv2-msg-txt">${safeText(texto || 'Atualização sem texto.')}</span></p></div>`;
  };
  return `<section class="gv2-sec" aria-label="Conversa"><div class="gv2-sec-topo"><h3>Conversa</h3>${updates.length
      ? `<span class="gv2-lk" role="button" tabindex="0" onclick="gavetaAba('conversa')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gavetaAba('conversa')}">${updates.length}</span>`
      : ''}</div>${ultimas.length ? ultimas.map(linha).join('') : '<p class="gv2-vazio">Sem conversa ainda.</p>'}</section>`;
}
function gavetaLinkHtml() {
  return `<div class="entrega-link gv2-link"><label class="gv2-fora" for="workspace-link-input">Link do material</label><input id="workspace-link-input" class="workspace-input gv2-campo" type="url" placeholder="Cole o link do Drive, Frame.io ou Canva" onkeydown="if(event.key==='Enter'){event.preventDefault();saveWorkspaceLink()}">
      <button type="button" class="gv2-btn" onclick="saveWorkspaceLink()">Registrar link</button></div>
    <p class="gv2-sub">Para vídeo ou arquivo grande. Fica no histórico, com quem registrou e quando.</p>`;
}
  function renderWorkspaceDrawer(detail, item) {
  const drawer = document.getElementById('workspace-drawer');
  if (!drawer || !detail) return;
  DETALHE_DA_GAVETA = detail;
  const assets = workspaceAssetsForDetail(detail);
  activeWorkspaceAssets = assets;
  const updates = detail.updates || [];
  ATUALIZACOES_DA_GAVETA = updates;
  const id = safeText(String(item.id));
  const ehPedido = typeof isRequestItem === 'function' ? isRequestItem(item) : false;
  const data = (v) => (v && v !== '—' ? v : '');
  const clientes = (typeof clientesDoItem === 'function' ? clientesDoItem(item) : [item.cliente]).filter(Boolean);
  const briefing = typeof briefingDaPeca === 'function' ? briefingDaPeca(detail) : null;
  const contexto = latestStatusContext({ updates });
  const entrega = workspaceDeliveryInfo(detail);
  const proximo = proximoStatusDaPeca(item);
  const etapas = workspaceHistoryHtml(detail, item);
  const aba = (qual, rotulo, n) => `<span role="radio" class="gv2-aba" data-gv-aba="${qual}" aria-checked="${ABA_DA_GAVETA === qual}" tabindex="${ABA_DA_GAVETA === qual ? 0 : -1}"
      onclick="gavetaAba('${qual}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gavetaAba('${qual}')}else gavetaTeclaNaAba(event)">${rotulo}${n ? ` · ${n}` : ''}</span>`;
  const painel = (qual, html) => `<div class="gv2-painel" data-gv-painel="${qual}"${ABA_DA_GAVETA === qual ? '' : ' hidden'}>${html}</div>`;
  const lk = (rotulo, acao) => `<span class="gv2-lk" role="button" tabindex="0" onclick="${acao}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${acao}}">${rotulo}</span>`;
  const chamada = briefing ? briefing.texto.replace(/\s*\n+\s*/g, ' ').trim() : '';
  // Direção 3: o Resumo em duas colunas. À esquerda o que orienta o trabalho (briefing, contexto da etapa, checklist e
  // ficha); à direita a prévia de arquivos (com a entrega), conversa e histórico, cada uma levando à sua aba.
  const quandoCtx = contexto ? (quandoNaBahia(contexto.created_at) || (contexto.created_at || '').replace('T', ' ').slice(0, 16)) : '';
  const resumo = `<div class="gv2-resumo"><div class="gv2-col">
      <section class="gv2-sec"><div class="gv2-sec-topo"><h3>Briefing</h3>${briefing
        ? `${lk('abrir', `abrirBriefing('${id}')`)}${lk('editar', `editarBriefing('${id}')`)}`
        : lk('+ adicionar', `editarBriefing('${id}')`)}</div>
        ${briefing ? `<p class="gv2-texto">${safeText(chamada.slice(0, 260))}${chamada.length > 260 ? '…' : ''}</p>`
          : '<p class="gv2-texto vazio">Sem briefing.</p>'}</section>
      ${faixaDeMaterialBrutoHtml(detail, item)}
      ${contexto ? `<section class="gv2-contexto" aria-label="Contexto da etapa atual"><div class="gv2-ctx-topo">${contexto.target ? gavetaPilulaHtml(contexto.target) : ''}<span class="gv2-sub">${safeText([contexto.creator || 'Equipe Vybe', quandoCtx].filter(Boolean).join(' · '))}</span></div>
        <p class="gv2-texto">${safeText(contexto.reason || contexto.text)}</p>${contexto.next ? `<p class="gv2-ctx-prox"><span class="gv2-sub">Próximo</span><b>${safeText(contexto.next)}</b></p>` : ''}</section>` : ''}
      ${subitensHtml(detail, item)}
      ${gavetaFichaResumoHtml(detail, item)}
    </div><div class="gv2-col">
      ${gavetaArquivosPreviaHtml(assets, entrega)}
      ${gavetaConversaPreviaHtml(updates)}
      <section class="gv2-sec gv2-hist" aria-label="Histórico"><div class="gv2-sec-topo"><h3>Histórico</h3>${lk('log', `abrirLogDaPeca('${id}')`)}</div>${etapas || '<p class="gv2-vazio">Sem troca de etapa ainda.</p>'}</section>
    </div></div>`;
  const arquivos = `
      ${workspaceDeliveryDock(detail, item)}
      ${workspaceRegistrosPendentesHtml()}
      <div class="workspace-dropzone gv2-solta alta" role="button" tabindex="0" aria-label="Adicionar arquivos" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('workspace-file-input').click()}" onclick="document.getElementById('workspace-file-input').click()" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleWorkspaceDrop(event)">${GAVETA_ICONE.sobe}<div><strong>Arraste o arquivo aqui ou clique</strong>Card, arte ou PDF · PNG, JPG, WEBP ou PDF · até 200 MB</div></div>
      <p class="gv2-sub">Vai para a pasta do cliente no Drive da Vybe.</p>
      ${gavetaLinkHtml()}
      ${assets.length ? `<div class="workspace-assets">${assets.map(workspaceAssetCard).join('')}</div>` : '<p class="gv2-vazio">Nenhum arquivo anexado ainda.</p>'}`;
  const conversa = `${workspaceExecutiveHistoryHtml(updates)}
      <div class="gv2-conversa">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<p class="gv2-vazio">Sem atualizações ainda. Escreva a primeira no campo aqui embaixo.</p>'}</div>`;
  const historico = `${etapas || '<p class="gv2-vazio">Ainda não há troca de etapa registrada.</p>'}
      <div class="gv2-log">${botaoDoLogHtml(item.id)}<span class="gv2-sub">quem fez o quê nesta peça, com dia e hora</span></div>`;
  drawer.classList.add('gv2-folha');
  drawer.innerHTML = `<div class="gv2 gv2-tem-cel">
      ${gavetaPegaHtml()}${gavetaCelularHtml(detail, item, assets)}
      <input id="workspace-file-input" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,application/pdf" onchange="uploadWorkspaceFile(this)">
      <div class="gv2-topo"><button type="button" class="workspace-voltar" onclick="closeItemWorkspace()" aria-label="Voltar" title="Voltar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <p class="gv2-sub gv2-onde">${ehPedido ? 'Solicitação' : 'Conteúdo'} · <span class="gv2-id" role="button" tabindex="0" onclick="copiarId('${id}')" onkeydown="if(event.key==='Enter')copiarId('${id}')" title="ID da atividade · clique para copiar">nº ${safeText(String(item.id).replace(/^vybe:/, ''))}</span></p>
        ${botaoDeLinkHtml(item, { icone: true })}${menuDeAcoesDaPecaHtml(item, { linkELog: true })}<button class="gv2-ic gv2-fechar" type="button" onclick="closeItemWorkspace()" aria-label="Fechar" title="Fechar (Esc)">${GAVETA_ICONE.fechar}</button></div>
      <div class="gv2-cab">
        <h2 class="gv2-titulo" id="workspace-titulo" title="Clique para renomear" onclick="renomearPeca('${item.id}',event)">${safeText(item.nome)}</h2>
        <div class="gv2-linha"><span class="gv2-clientes">${clientes.map(cliCor).join(' ') || 'Cliente não informado'}</span>
          <span class="gv2-status" role="button" tabindex="0" title="Trocar status" aria-label="Status: ${safeText(item.status)}. Trocar" onclick="openStatusEditor(event,'${id}')"
            onkeydown="if(event.key==='Enter'||event.key===' ')openStatusEditor(event,'${id}')">${gavetaPilulaHtml(item.status, item.status_color, GAVETA_ICONE.seta)}</span>
          ${gavetaObjetivoHtml(item)}<span class="gv2-vao"></span>${gavetaAtrasoDesktopHtml(item)}</div>
      </div>
      ${gavetaEtapasHtml(item)}
      <div class="gv2-bloco">
        <div class="gv2-cmp"><small>Prazo interno</small><span class="gv2-dado${gavetaDataVencida(item.prazo_iso, item) ? ' r' : ''}" role="button" tabindex="0" onclick="openPlanningEditor('${id}')" onkeydown="if(event.key==='Enter')openPlanningEditor('${id}')" title="Editar prazo e veiculação">${safeText(data(item.prazo) || '—')}</span></div>
        <div class="gv2-cmp"><small>${ehPedido ? 'Conclusão' : 'Veiculação'}</small><span class="gv2-dado${gavetaDataVencida(item.veiculacao_iso, item) ? ' r' : ''}" role="button" tabindex="0" onclick="openPlanningEditor('${id}')" onkeydown="if(event.key==='Enter')openPlanningEditor('${id}')" title="Editar prazo e veiculação">${safeText(data(item.veiculacao) || '—')}</span></div>
        <div class="gv2-cmp"><small>Responsável</small>${typeof ownerEditorTrigger === 'function' ? ownerEditorTrigger(item, 'gv2-dono', { comNome: true }) : ''}</div>
      </div>
      <div class="gv2-seg" role="radiogroup" aria-label="Partes da peça">${aba('resumo', 'Resumo')}${aba('arquivos', 'Arquivos', assets.length)}${aba('conversa', 'Conversa', updates.length)}${aba('historico', 'Histórico')}</div>
      <div class="gv2-corpo">${painel('resumo', resumo)}${painel('arquivos', arquivos)}${painel('conversa', conversa)}${painel('historico', historico)}</div>
      <div class="gv2-pe">
        <div class="gv2-pe-linha"><label class="gv2-fora" for="workspace-comment-input">Atualização rápida</label>
          <input id="workspace-comment-input" class="gv2-campo" type="text" placeholder="Atualização rápida para a equipe" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();saveWorkspaceComment()}">
          <button type="button" class="gv2-btn" onclick="saveWorkspaceComment()">Comentar</button>
          <button type="button" class="gv2-btn" onclick="openManualHandoff('${item.id}')">Passar bastão</button></div>
        ${proximo
          ? `<button type="button" class="gv2-avancar principal v2-estado" onclick="gavetaAvancar('${id}',this)"><span class="gv2-avancar-texto">${safeText(/^para\s/i.test(proximo.label) ? `Enviar ${proximo.label.charAt(0).toLowerCase()}${proximo.label.slice(1)}` : `Enviar para ${proximo.label}`)}</span></button>`
          : `<button type="button" class="gv2-avancar principal" onclick="openStatusEditor(event,'${id}')"><span class="gv2-avancar-texto">Trocar status</span></button>`}
      </div></div>`;
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
  drawer.id = 'workspace-drawer'; drawer.className = 'gv2-gaveta gv2-folha'; drawer.innerHTML = gavetaEsqueletoHtml('Carregando a peça');
  ABA_DA_GAVETA = 'resumo';
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    if(document.getElementById('workspace-drawer') !== drawer) return;
    if (!detail) throw new Error('A atividade não foi encontrada no banco Vybe.');
    if (!item) item = { id:String(itemId), nome:detail.name || 'Demanda', cliente:'Cliente não informado', status:'—', status_color:'#8f8f8f', status_border:'#8f8f8f', prazo_iso:'', veiculacao_iso:'', formato:'Conteúdo', url:'' };
    renderWorkspaceDrawer(detail, item);
  } catch (e) { drawer.innerHTML = `<div class="gv2"><div class="gv2-topo"><p class="gv2-sub gv2-onde">Conteúdo</p><button class="gv2-ic gv2-fechar" type="button" onclick="closeItemWorkspace()" aria-label="Fechar" title="Fechar (Esc)">${GAVETA_ICONE.fechar}</button></div><p class="gv2-texto"><b>Não foi possível carregar a peça.</b> ${safeText(e.message)}</p><button type="button" class="gv2-btn" style="align-self:flex-start" onclick="openItemWorkspace('${safeText(String(itemId))}')">Tentar de novo</button></div>`; }
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
  drawer.id = 'workspace-drawer'; drawer.className = 'gv2-gaveta gv2-folha gv2-folha-inteira';
  drawer.innerHTML = gavetaEsqueletoHtml('Carregando a solicitação');
  document.body.append(backdrop, drawer);
  try {
    const detail = await fetchWorkspaceItem(itemId);
    if(document.getElementById('workspace-drawer') !== drawer) return;
    renderDemandaWorkspace(detail, item);
  } catch (e) {
    drawer.innerHTML = `<div class="gv2"><div class="gv2-topo"><p class="gv2-sub gv2-onde">Solicitação</p><button class="gv2-ic gv2-fechar" type="button" onclick="closeItemWorkspace()" aria-label="Fechar" title="Fechar (Esc)">${GAVETA_ICONE.fechar}</button></div><p class="gv2-texto"><b>Não foi possível carregar a solicitação.</b> ${safeText(e.message)}</p></div>`;
  }
}

function renderDemandaWorkspace(detail, item) {
  const drawer = document.getElementById('workspace-drawer');
  if (!drawer || !detail) return;
    DETALHE_DA_GAVETA = detail;
    const assets = workspaceAssetsForDetail(detail);
    activeWorkspaceAssets = assets;
    activeWorkspaceItemId = String(item.id);
    const updates = detail?.updates || [];
    ATUALIZACOES_DA_GAVETA = updates;
    const fechar = typeof GAVETA_ICONE !== 'undefined' ? GAVETA_ICONE.fechar : '×';
    const cliente = item.cliente ? (typeof cliCor === 'function' ? cliCor(item.cliente) : safeText(item.cliente)) : 'Cliente não informado';
    const pega = typeof gavetaPegaHtml === 'function' ? gavetaPegaHtml() : '';
    drawer.innerHTML = `<div class="gv2 gv2-sol">${pega}
      <div class="gv2-topo"><p class="gv2-sub gv2-onde">Solicitação · nº ${safeText(String(item.id).replace(/^vybe:/, ''))}</p>${botaoDeLinkHtml(item, { icone: true })}${botaoDoLogHtml(item.id, { demanda: true, icone: true })}<button class="gv2-ic gv2-fechar" type="button" onclick="closeItemWorkspace()" aria-label="Fechar" title="Fechar (Esc)">${fechar}</button></div>
      <div class="gv2-cab"><h2 class="gv2-titulo">${safeText(item.nome)}</h2>
        <div class="gv2-linha"><span class="gv2-clientes">${cliente}</span>${pillHtmlDemanda(item.status,item.status_color,item.status_border)}<span class="gv2-sub">${safeText(item.tipo || 'Solicitação')}</span></div></div>
      <div class="gv2-bloco">
        <div class="gv2-cmp"><small>Prazo</small><b>${safeText(item.prazo || 'não definido')}</b></div>
        <div class="gv2-cmp"><small>Conclusão</small><b>${safeText(item.conclusao || 'não definida')}</b></div>
        <div class="gv2-cmp"><small>Responsável</small><b>${safeText(item.responsavel || 'não definido')}</b></div>
      </div>
      <div class="gv2-corpo"><div class="gv2-painel">
        ${blocoDoBriefingHtml(detail, item)}
        <section class="gv2-sec"><div class="gv2-sec-topo"><h3>Contexto da solicitação</h3></div><p class="gv2-texto">Esta solicitação pertence à Central de Demandas. A atualização completa permanece no fluxo próprio dela.</p></section>
        <section class="gv2-sec"><div class="gv2-sec-topo"><h3>Arquivos</h3></div>${workspaceUploadHtml()}<div class="workspace-assets">${assets.length ? assets.map(workspaceAssetCard).join('') : '<p class="gv2-vazio">Nenhum arquivo anexado ainda.</p>'}</div></section>
        <section class="gv2-sec"><div class="gv2-sec-topo"><h3>Histórico recente</h3></div><div class="gv2-conversa">${updates.length ? updates.map(workspaceTimelineEvent).join('') : '<p class="gv2-vazio">Sem atualizações registradas ainda.</p>'}</div></section>
        ${podeVerMonday() ? `<a class="gv2-lk" data-external-monday="true" href="${item.url}" target="_blank" rel="noopener">Abrir no Monday</a>` : ''}
      </div></div></div>`;
}

// Regra Vybe OS: clique em atividade abre contexto interno; Monday é um atalho deliberado dentro do workspace.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  // Esc fecha a camada de cima: com o menu "…" aberto, fecha o menu, não a gaveta.
  // stopImmediatePropagation porque o cartão de resumo tem o próprio ouvinte de
  // Esc, registrado depois: sem isto, o mesmo Esc fecharia o menu e o cartão.
  if (fecharMenusDaGaveta()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  // A caixa de fluxo (datas, checklist, troca de status) abre por cima da gaveta
  // e do cartão de resumo. Esc fecha só ela — o mesmo que Cancelar — e para aqui,
  // para não levar junto o que está embaixo.
  if (document.getElementById('workflow-modal')) { event.preventDefault(); event.stopImmediatePropagation(); closeWorkflowModal(); return; }
  // Com o log aberto, Esc volta para a peça — como o "‹ Voltar" dele.
  if (typeof fecharLogDaPeca === 'function' && fecharLogDaPeca()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
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
async function postWorkspaceUpdate(body, successMessage, itemId, campoEnviado) {
  const alvo = String(itemId || activeWorkspaceItemId || '');
  if (!alvo) return;
  const text = String(body || '').trim();
  if (!text) return showToast('Escreva uma atualização antes de enviar.', 'info');
  const drawer=document.getElementById('workspace-drawer');
  const item = findOperationalItem(alvo) || { id: alvo };
  await tentarEscritaDupla(item, { acao:'comentario', item:alvo, texto:text });
  showToast(successMessage, 'ok');
  const continuaAberta=()=>drawer && document.getElementById('workspace-drawer')===drawer && String(activeWorkspaceItemId)===alvo;
  if(!continuaAberta()) return;
  const enviado=campoEnviado && document.getElementById(campoEnviado.id);
  if(enviado && enviado.value===campoEnviado.valor) enviado.value='';
  const atualizado = findOperationalItem(alvo);
  if(!atualizado) return;
  let detail;
  try { detail=await fetchWorkspaceItem(alvo); }
  catch(e) {
    // A escrita já foi confirmada: não sugerir um reenvio que duplicaria o registro.
    if(continuaAberta()) showToast('Registro salvo. Não foi possível atualizar o histórico; reabra a atividade para conferir.', 'info', 7000);
    return;
  }
  if(!continuaAberta()) return;
  const rascunhos=['workspace-comment-input','workspace-link-input'].map(id=>({id,valor:document.getElementById(id)?.value || ''}));
  renderWorkspaceDrawer(detail, atualizado);
  rascunhos.forEach(({id,valor})=>{const campo=document.getElementById(id);if(campo) campo.value=valor;});
}
// Um clique a mais durante a gravação registrava o mesmo comentário duas vezes
// — o botão continuava ativo enquanto o servidor respondia. E o "[Vybe OS] " da
// frente fazia a caixa vazia passar pela conferência de texto em branco.
let COMENTARIO_ENVIANDO = false;
async function saveWorkspaceComment() {
  const input = document.getElementById('workspace-comment-input');
  if (COMENTARIO_ENVIANDO) return;
  if (!String(input?.value || '').trim()) return showToast('Escreva uma atualização antes de enviar.', 'info');
  const botao = document.querySelector('[onclick="saveWorkspaceComment()"]');
  COMENTARIO_ENVIANDO = true;
  if (botao) botao.disabled = true;
  try { await postWorkspaceUpdate(`[Vybe OS] ${input?.value || ''}`, '✓ Atualização registrada no Vybe OS', activeWorkspaceItemId, {id:'workspace-comment-input',valor:input.value}); }
  catch (e) { showToast(`Não foi possível registrar: ${e.message}`, 'err', 7000); }
  finally {
    COMENTARIO_ENVIANDO = false;
    const atual = document.querySelector('[onclick="saveWorkspaceComment()"]');
    if (atual) atual.disabled = false;
  }
}
// O registro do link vira uma funcao que recebe o endereco e a peca; a caixa da
// gaveta so entrega o que digitaram nela.
const LINKS_EM_ENVIO = new Set();
async function registrarLinkDeEntrega(url, itemId, campoEnviado) {
  const limpo = String(url || '').trim();
  if (!/^https?:\/\//i.test(limpo)) return showToast('Cole um link válido começando com https://', 'info');
  const alvo=String(itemId || activeWorkspaceItemId || '');
  if(!alvo || LINKS_EM_ENVIO.has(alvo)) return;
  LINKS_EM_ENVIO.add(alvo);
  try {
    await postWorkspaceUpdate(`[Vybe OS · Link de entrega] ${limpo}`,
      '✓ Link de entrega registrado no Vybe OS', alvo, campoEnviado);
  } catch (e) { showToast(`Não foi possível registrar o link: ${e.message}`, 'err', 7000); }
  finally { LINKS_EM_ENVIO.delete(alvo); }
}
async function saveWorkspaceLink() {
  const input=document.getElementById('workspace-link-input');
  const botao=document.querySelector('[onclick="saveWorkspaceLink()"]');
  if(botao?.disabled) return;
  if(botao) botao.disabled=true;
  try { return await registrarLinkDeEntrega(input?.value, activeWorkspaceItemId, {id:'workspace-link-input',valor:input?.value}); }
  finally { if(botao) botao.disabled=false; }
}
