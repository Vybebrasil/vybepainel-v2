// vybe-foco.js — Modo Foco: a tela "Meu Dia" de cada pessoa.
//
// Este arquivo era vybe-jarvis.js e comecava com 357 linhas de assistente por
// voz e texto, que falavam com Claude, GPT e Gemini a cada comando. Saiu inteiro:
// gastava token por pergunta e ninguem operava por ele. O que ficou e o que a
// equipe usa todo dia — a fila de cada um, o proximo item, o fechamento de turno.

function focusOwnItems(user=focusUser()) { const source=unifiedOperationalItems(); return user ? source.filter(d => ((d.responsavel_ids || []).map(String).includes(String(user.id)) || String(d.responsavel_id || '') === String(user.id)) && !isFinishedItem(d)) : []; }
function focusIsNextReady(d) { return ['Pode Fazer','A Fazer'].includes(operationalFlowStatus(d)); }

// ── a lente da tela: tudo, so conteudo, ou so solicitacao ────────────────────
//
// O Modo Foco junta as duas origens numa fila so, o que e certo para "o que eu
// faco agora" — mas nao para quem senta para dar conta de uma frente inteira.
// Quem vai fechar as solicitacoes do dia nao quer ler as pecas de conteudo no
// meio, e vice-versa.
//
// A escolha fica guardada no navegador da pessoa: e uma preferencia de trabalho,
// nao um estado da sessao, e reabrir a tela no recorte errado desfaz a intencao.
const FOCO_ORIGEM_CHAVE = 'vybe_foco_origem';
let FOCO_ORIGEM = (() => {
  try { const g = localStorage.getItem(FOCO_ORIGEM_CHAVE);
    return ['tudo', 'conteudo', 'solicitacoes'].includes(g) ? g : 'tudo'; }
  catch (erro) { return 'tudo'; }
})();

function filtrarPorOrigemDoFoco(itens) {
  if (FOCO_ORIGEM === 'conteudo') return itens.filter((d) => !isRequestItem(d));
  if (FOCO_ORIGEM === 'solicitacoes') return itens.filter((d) => isRequestItem(d));
  return itens;
}

function escolherOrigemDoFoco(qual) {
  FOCO_ORIGEM = ['tudo', 'conteudo', 'solicitacoes'].includes(qual) ? qual : 'tudo';
  try { localStorage.setItem(FOCO_ORIGEM_CHAVE, FOCO_ORIGEM); } catch (erro) { /* modo anonimo */ }
  renderFocusDashboard();
}

// As contas vem de TODOS os itens da pessoa, nunca do recorte ativo: um botao
// que mostra zero e um botao que a pessoa sabe que nao vale a pena clicar.
// CONTROLE NAO SE TELEPORTA.
//
// O seletor sumia quando havia uma origem so na fila, com a ideia de que ali ele
// nao decidia nada. Na pratica um controle que desaparece nao parece economia:
// parece defeito — a pessoa procura e nao acha, e foi exatamente o que
// aconteceu no dia em que a unica solicitacao da fila saiu.
//
// E havia um beco sem saida: filtrando por "Solicitacoes", se a ultima delas
// fosse concluida, a fila ficava vazia, o seletor sumia junto e a mensagem
// mandava "veja Tudo" — apontando para um botao que nao estava mais na tela. So
// dava para sair trocando de modo ou recarregando.
//
// Agora ele fica, com os numeros de verdade. Zero e uma resposta: "hoje voce
// nao tem nenhuma". E continua clicavel, entao nao existe beco.
function seletorDeOrigemHtml(todos) {
  const conteudo = todos.filter((d) => !isRequestItem(d)).length;
  const solicitacoes = todos.filter((d) => isRequestItem(d)).length;
  if (!todos.length) return '';
  const opcao = (chave, rotulo, quantos) => `<button type="button"
    class="focus-lente-opcao ${FOCO_ORIGEM === chave ? 'ativa' : ''} ${quantos ? '' : 'vazia'}"
    onclick="escolherOrigemDoFoco('${chave}')" aria-pressed="${FOCO_ORIGEM === chave}"
    >${rotulo}<span>${quantos}</span></button>`;
  return `<div class="focus-lente" role="group" aria-label="O que aparece na fila">
      ${opcao('tudo', 'Tudo', todos.length)}
      ${opcao('conteudo', 'Produção de conteúdo', conteudo)}
      ${opcao('solicitacoes', 'Solicitações', solicitacoes)}
    </div>`;
}
// A PROXIMA E A QUE VAI AO AR PRIMEIRO.
//
// Antes a ordem era: risco, depois estado, depois a data de referencia — que
// para quase todo mundo e o PRAZO. Prazo e um combinado interno, e move: se
// alguem empurra o prazo, a peca desce na fila mesmo que a veiculacao continue
// amanha. Veiculacao e a data que o cliente ve; ela nao se negocia, e por isso
// e ela que decide quem vem primeiro.
//
// Em solicitacao esse campo carrega a data de CONCLUSAO — o normalizador ja faz
// essa ponte, entao a mesma regra serve para os dois quadros.
function focusActionPriority(d,user=focusUser()) {
  const dia = (v) => String(v || '').slice(0, 10).replace(/-/g, '') || '';
  // Sem veiculacao, o prazo entra no lugar dela; sem nenhuma das duas, vai para
  // o fim da fila em vez de fingir urgencia.
  const quandoVai = dia(d.veiculacao_iso) || dia(d.prazo_iso) || '99991231';
  const state={'Pode Fazer':0,'A Fazer':1}[operationalFlowStatus(d)] ?? 8;
  return Number(quandoVai) * 100 + state * 10 + (dia(d.prazo_iso) ? 0 : 1);
}
function getFocusNextAction(items=focusOwnItems(),user=focusUser()) {
  const nextReady=items.filter(focusIsNextReady).sort((a,b)=>focusActionPriority(a,user)-focusActionPriority(b,user));
  if (nextReady.length) return { item:nextReady[0], mode:'next' };
  const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(operationalFlowStatus(d))).sort((a,b)=>focusActionPriority(a,user)-focusActionPriority(b,user));
  return blocked[0] ? { item:blocked[0], mode:'unblock' } : null;
}
function focusWorkflowProfile(item,user=focusUser()) {
  const name=String(user?.name || '').toLowerCase();
  if (name.includes('reriston')) return { labels:['Briefing','Edição','Entrega','Aprovação','Publicação'], execution:1, approval:3, publication:4, briefing:0 };
  if (['deivid','beatriz','bia','jady'].some(person=>name.includes(person))) return { labels:['Briefing','Criação','Aprovação interna','Entrega','Publicação'], execution:1, approval:2, publication:4, briefing:0 };
  if (name.includes('tainara')) return { labels:['Recebimento','Conferência','Agendamento','Publicação'], execution:1, approval:1, publication:2, briefing:0 };
  return { labels:['Briefing','Produção','Revisão','Entrega','Aprovação','Publicação'], execution:1, approval:4, publication:5, briefing:0 };
}
function focusTrailIndex(item, profile=focusWorkflowProfile(item)) {
  const key=String(operationalFlowStatus(item) || '').toLowerCase();
  if (key === 'finalizado') return profile.labels.length - 1;
  if (['para agendar','agendado'].includes(key)) return profile.publication;
  if (['para aprovação','ag. aprovação cliente','ag. interno'].includes(key)) return profile.approval;
  if (['em andamento','alteração'].includes(key)) return profile.execution;
  return profile.briefing;
}
function focusTrailHtml(item) {
  const profile=focusWorkflowProfile(item); const active=focusTrailIndex(item,profile); const current=profile.labels[active];
  return `<div class="focus-production-trail" aria-label="Trilha operacional · ${safeText(item.status)}"><span class="focus-trail-current focus-oculto-visual">ETAPA: ${safeText(current).toUpperCase()} · ${safeText(item.status).toUpperCase()}</span><div class="focus-trail-steps">${profile.labels.map((label,index)=>`<span class="focus-trail-step ${index<active?'done':index===active?'active':''}">${safeText(label)}</span>${index<profile.labels.length-1?'<span class="focus-trail-arrow">›</span>':''}`).join('')}</div></div>`;
}
function focusNextActionHtml(data) {
  if(!data) return `<div class="focus-next-action"><div class="focus-next-kicker">Próxima melhor ação</div><div class="focus-next-name">Sua fila está limpa por agora.</div><div class="focus-next-reason">Não há itens de produção ou bloqueios atribuídos a você neste momento.</div></div>`;
  const {item,mode}=data; const risk=item.operational_risk || getOperationalRisk(item); const user=focusUser();
  const title=mode==='next' ? 'PRÓXIMA DEMANDA' : 'DESTRAVE ESTA DEMANDA';
  // O motivo agora e a data que decide a fila. Antes vinha a frase de risco e a
  // data de referencia no fim, sem dizer qual data era.
  const reason=mode==='next'
    ? (risk.reason || 'É a próxima da sua fila ainda não iniciada')
    : (focusStatusExplanation(operationalFlowStatus(item)) || 'Esta atividade depende de outra etapa para seguir');
  const primary=mode==='next' ? 'Abrir e produzir' : 'VER BLOQUEIO';
  const primaryAction=mode==='next' ? `openFocusPriorityWorkspace('${item.id}')` : `openItemWorkspace('${item.id}')`;
  const statusControl=mode==='next' ? `<button type="button" class="focus-next-btn status" style="border-color:${item.status_color||'#00f0ff'} !important; background:color-mix(in srgb, ${item.status_color||'#00f0ff'} 12%, transparent) !important; color:${item.status_color||'#a6f8ff'} !important;" onclick="openStatusEditor(event,'${item.id}')">Status: ${safeText(item.status)}</button>` : '';
  // "Iniciar bloco" existia so para rolar ate o Check-in de execucao da gaveta, e
  // esse bloco saiu — dois usos em duzentas pecas. Sem ele, o botao levaria a
  // uma secao que nao existe mais.
  const checkinControl='';
  // Na proxima demanda o botao de bloqueio saiu: quem ainda nao comecou nao tem
  // o que destravar. No cartao de bloqueio ele continua, que e o lugar dele.
  const secondary=mode==='next' ? '' : `<button type="button" class="focus-next-btn" onclick="openFocusBlocker('${item.id}')">Registrar contexto</button>`
  // Instrucao que se le uma vez na vida nao merece uma faixa permanente. Vira
  // uma nota discreta — continua ali para quem precisar, sem ocupar uma linha
  // inteira do bloco mais importante da tela todo dia.
  const controlNote=mode==='next' ? `<div class="focus-priority-control-note">ao mudar para <b>Em andamento</b>, esta demanda entra na fila de execução</div>` : '';
  // A data que decide a fila vira o ancoradouro do bloco: numero grande a
  // esquerda, com o nome embaixo. Era uma frase no meio de outras, do mesmo
  // tamanho da explicacao — e e ela que responde "por que esta e a proxima?".
  const ehPedido = typeof isRequestItem === 'function' && isRequestItem(item);
  const diaBr = (iso) => { const limpo = String(iso || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? limpo.split('-').reverse().join('/') : ''; };
  const noAr = diaBr(item.veiculacao_iso);
  const hoje = HOJE_ISO || new Date().toISOString().slice(0, 10);
  const faltam = item.veiculacao_iso
    ? Math.round((new Date(`${item.veiculacao_iso}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000) : null;
  const quando = !item.veiculacao_iso ? 'sem data'
    : faltam < 0 ? 'já passou'
    : faltam === 0 ? 'é hoje'
    : faltam === 1 ? 'amanhã'
    : `em ${faltam} dias`;
  // No selo o ano e ruido: quem olha quer o dia, e o ano so muda a conversa em
  // dezembro. Ele continua no balao, para quem precisar conferir.
  const selo = `<div class="focus-next-quando ${item.veiculacao_iso && item.veiculacao_iso === hoje ? 'urgente' : ''} ${item.veiculacao_iso && item.veiculacao_iso < hoje ? 'vencida' : ''}"
      title="${safeText(noAr || 'sem data')}">
      <b>${safeText(noAr.slice(0, 5) || '—')}</b>
      <span>${ehPedido ? 'conclusão' : 'veiculação'} · ${safeText(quando)}</span>
    </div>`;
  const prazoBr = diaBr(item.prazo_iso);
  const prazoHtml = prazoBr
    ? `<span class="focus-next-prazo ${item.prazo_iso < hoje ? 'vencido' : ''}"
        title="Prazo de produção${item.prazo_iso < hoje ? ' — vencido' : ''}"><b>Prazo</b>${prazoBr.slice(0, 5)}</span>` : '';
  return `<section class="focus-next-action ${mode === 'next' ? 'e-a-proxima' : 'e-bloqueio'}">
    <div class="focus-next-kicker">${title} · QUEM VAI AO AR PRIMEIRO</div>
    <div class="focus-next-main">
      ${selo}
      <div class="focus-next-corpo">
        <div class="focus-next-client">${safeText(item.cliente || 'Cliente não informado')}</div>
        <div class="focus-next-name">${safeText(item.nome)}</div>
        <div class="focus-next-reason">${safeText(reason)}${prazoHtml}</div>
        ${focusTrailHtml(item)}${controlNote}
      </div>
      <div class="focus-next-tools">
        <button type="button" class="focus-next-btn primary" onclick="${primaryAction}">${primary} →</button>
        ${statusControl}${checkinControl}${secondary}
      </div>
    </div></section>`;
}
function openFocusBlocker(itemId) {
  const item=findOperationalItem(itemId); if(!item) return showToast('Demanda não encontrada.','err');
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Bloqueio inteligente</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">O que está impedindo o avanço?</h2><p class="workflow-copy">Este registro cria contexto, muda a demanda para a etapa adequada e avisa a Mesa de Comando sobre o bloqueio.</p>${workflowItemHtml(item,'sinalizar bloqueio')}<label class="workflow-field"><span>Tipo de bloqueio</span><select id="focus-blocker-type"><option value="info">Informação ou material pendente</option><option value="feedback">Feedback, aprovação ou decisão pendente</option><option value="direction">Direção de arte ou referência visual</option><option value="dependency">Outra etapa ou área ainda precisa agir</option></select></label><label class="workflow-field"><span>O que está faltando ou precisa ser resolvido?</span><textarea id="focus-blocker-reason" rows="3" placeholder="Ex.: Cliente ainda não enviou as fotos do produto solicitadas no briefing."></textarea></label><label class="workflow-field"><span>De quem depende?</span><input id="focus-blocker-owner" type="text" placeholder="Ex.: Cliente, Paulo, Direção de Arte..."/></label><label class="workflow-field"><span>Qual é o próximo passo?</span><textarea id="focus-blocker-next" rows="3" placeholder="Ex.: Atendimento cobra as fotos; assim que chegarem, retomo a arte."></textarea></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button><button type="button" class="workflow-primary" onclick="submitFocusBlocker('${item.id}')">Registrar bloqueio →</button></div>`);
}
async function submitFocusBlocker(itemId) {
  const item=findOperationalItem(itemId); const type=String(document.getElementById('focus-blocker-type')?.value||''); const reason=String(document.getElementById('focus-blocker-reason')?.value||'').trim(); const owner=String(document.getElementById('focus-blocker-owner')?.value||'').trim(); const next=String(document.getElementById('focus-blocker-next')?.value||'').trim();
  if(!item || !reason || !owner || !next) return showToast('Descreva o bloqueio, de quem depende e o próximo passo.','info');
  const targets=isRequestItem(item)?{info:'Aguardando Info.',feedback:'Aguardando Aprovação',direction:'Aguardando Aprovação',dependency:'Aguardando Info.'}:{info:'Falta Info',feedback:'Aguardo',direction:'Falta D.A',dependency:'Aguardo'}; const option=operationalStatusOptions(item).find(o=>o.label===targets[type]) || STATUS_OPTIONS.find(o=>o.label===targets[type]); if(!option) return showToast('O status necessário ainda não carregou.','info');
  const button=document.querySelector('#workflow-modal .workflow-primary'); if(button) button.disabled=true;
  try { const body=`[Vybe OS · Contexto de status]\nEtapa: ${item.status} → ${option.label}\nMotivo: ${reason}\nSolicitante/Dependência: ${owner}\nOrigem: Modo Foco · Bloqueio inteligente\nPróximo passo: ${next}`; await postItemUpdate(item.id,body); [DADOS,DADOS_ALL,DADOS_DEMANDAS].forEach(list=>(list||[]).forEach(d=>{if(String(d.id)===String(item.id)) d.status_context={target:option.label,reason,next,requester:owner,source:'Modo Foco · Bloqueio inteligente',created_at:new Date().toISOString()};})); closeWorkflowModal(); await commitStatusChange(item,option); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o bloqueio: ${e.message}`,'err',7000); }
}
// "Abrir e produzir" so abria. Quem clica esta comecando a produzir agora — e
// tinha de trocar o status a mao logo depois, no botao do lado. O botao passa a
// fazer as duas coisas: poe em execucao e abre.
//
// O nome do status depende do quadro: Producao chama "Em andamento", Solicitacoes
// chamam "Em execucao". Em vez de decidir aqui, procura na lista de status que o
// proprio quadro oferece — quem responde qual e o nome continua sendo o catalogo.
async function openFocusPriorityWorkspace(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return openItemWorkspace(itemId);
  const chave = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const emExecucao = ['em andamento', 'em execucao'];
  const opcoes = (typeof operationalStatusOptions === 'function' ? operationalStatusOptions(item) : []) || [];
  const alvo = opcoes.find((o) => emExecucao.includes(chave(o.label)));
  // Ja esta em execucao, ou o quadro nao tem esse status: abre e nao inventa nada.
  if (alvo && !emExecucao.includes(chave(item.status))) {
    try { await commitStatusChange(item, alvo); }
    catch (erro) { showToast(`Aberta, mas o status não mudou: ${erro.message}`, 'info', 7000); }
  }
  openItemWorkspace(itemId);
}
function openFocusDelivery(itemId) { openItemWorkspace(itemId); setTimeout(()=>{ document.getElementById('workspace-link-input')?.scrollIntoView({behavior:'smooth',block:'center'}); },320); }
function focusContinuityHtml(items,user) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10); const next=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>today && !['Agendado','Finalizado'].includes(d.status);}),user).slice(0,3); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)).length;
  const nextText=next.length ? next.map(d=>`${d.nome} (${focusReferenceLabel(d,user)})`).join(' · ') : 'Nenhuma prioridade futura com prazo informado';
  return `<section class="focus-continuity"><div class="focus-continuity-head"><span>⌁ CONTINUIDADE DE TURNO</span><span>${blocked ? `${blocked} bloqueio${blocked===1?'':'s'} para acompanhar` : 'fila sem bloqueios ativos'}</span></div><div class="focus-continuity-body">Sua próxima linha de continuidade: <b>${safeText(nextText)}</b><div class="focus-continuity-actions"><button type="button" class="focus-command-btn" onclick="copyFocusContinuity()">Copiar resumo</button></div></div></section>`;
}
async function copyFocusContinuity() { const user=focusUser(); const items=focusOwnItems(user); const action=getFocusNextAction(items,user); const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)); const text=`[Vybe OS · Continuidade] ${user?.name || 'Operador'}\nPróxima prioridade: ${action?.item ? `${action.item.nome} · ${action.item.cliente}` : 'Sem item prioritário aberto'}\nBloqueios ativos: ${blocked.length}${blocked.length ? ` · ${blocked.slice(0,3).map(d=>d.nome).join(' | ')}` : ''}\nGerado em: ${new Date().toLocaleString('pt-BR')}`; try { await navigator.clipboard.writeText(text); showToast('✓ Resumo de continuidade copiado','ok'); } catch(e) { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); showToast('✓ Resumo de continuidade copiado','ok'); } }

function focusDailyPlanHtml(items,user,nextAction) {
  const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const inProgress=focusSort(items.filter(d=>d.status==='Em andamento'),user);
  const blocked=focusSort(items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status)),user);
  const dueByFriday=focusSort(items.filter(d=>{const due=focusReferenceDate(d,user); return due && due>=today && due<=getFridayIso(today) && !isFinishedItem(d);}),user);
  const next=nextAction?.item;
  const row=(label,item,empty)=>item ? `<div class="focus-daily-plan-row"><span>${safeText(label)}</span><button type="button" onclick="openItemWorkspace('${item.id}')">${safeText(item.nome)}</button><small>${safeText(item.status)} · ${safeText(focusReferenceLabel(item,user))}</small></div>` : `<div class="focus-daily-plan-row muted"><span>${safeText(label)}</span><em>${safeText(empty)}</em></div>`;
  return `<section class="focus-daily-plan"><div class="focus-daily-plan-head"><div><span>Plano do dia</span></div><button type="button" class="focus-command-btn" onclick="openFocusShiftClose()">Fechar turno</button></div><div class="focus-daily-plan-grid">${row('AGORA',inProgress[0] || next,'sem execução registrada')}${''/* "PRÓXIMA" saiu daqui: o bloco grande logo abaixo E a proxima, com o mesmo
        nome, a dois centimetros. Repetir nao reforca — divide a atencao e faz a
        pessoa conferir se sao a mesma coisa. */}${row('DESTRAVAR',blocked[0], 'sem bloqueio ativo')}${row('ATÉ SEXTA',dueByFriday.filter(d=>String(d.id)!==String(inProgress[0]?.id||'') && String(d.id)!==String(next?.id||''))[0], 'sem outro prazo nesta semana')}</div></section>`;
}
function getFridayIso(base) { const d=new Date(`${base}T12:00:00`); const weekday=d.getDay(); d.setDate(d.getDate()+((5-weekday+7)%7)); return d.toISOString().slice(0,10); }
function focusShiftSummary(user=focusUser()) {
  const items=focusOwnItems(user); const today=HOJE_ISO || new Date().toISOString().slice(0,10);
  const executed=items.filter(d=>d.status==='Em andamento');
  const blocked=items.filter(d=>['Falta Info','Ag. Info Cliente','Aguardo','Alteração','Falta D.A','Ag. Interno','Cap. Agendada','Agendando Cap','Falta OFF','Aguardo Redação','Segurar Post'].includes(d.status));
  const tomorrow=focusSort(items.filter(d=>focusReferenceDate(d,user)>today),user).slice(0,3);
  return {items,executed,blocked,tomorrow};
}
function openFocusShiftClose() {
  const user=focusUser(); if(!user) return;
  const data=focusShiftSummary(user);
  const active=data.executed[0] || getFocusNextAction(data.items,user)?.item || data.items[0];
  const tomorrow=data.tomorrow.map(d=>d.nome).join(' · ') || 'Nenhuma prioridade futura com data registrada';
  openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Encerramento de turno</span><button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">Fechar o dia de ${safeText(firstName(user.name))}</h2><p class="workflow-copy">Registre somente o contexto que precisa atravessar para amanhã. O resumo é calculado pela fila real e pode ser salvo no item que ficou em execução.</p><div class="focus-shift-summary"><span><b>${data.executed.length}</b> em execução</span><span><b>${data.blocked.length}</b> bloqueio${data.blocked.length===1?'':'s'}</span><span><b>${data.items.length}</b> aberto${data.items.length===1?'':'s'}</span></div><label class="workflow-field"><span>O que avançou hoje?</span><textarea id="focus-shift-progress" rows="3" placeholder="Ex.: Estruturei a primeira versão e deixei a capa pronta para revisão."></textarea></label><label class="workflow-field"><span>O que precisa continuar amanhã?</span><textarea id="focus-shift-next" rows="3" placeholder="Próximas prioridades: ${safeText(tomorrow)}"></textarea></label><label class="workflow-field"><span>Registrar no item em execução</span><select id="focus-shift-item">${data.items.map(d=>`<option value="${d.id}" ${String(d.id)===String(active?.id)?'selected':''}>${safeText(d.nome)} · ${safeText(d.status)}</option>`).join('')}</select></label><div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="copyFocusShiftClose()">Copiar resumo</button><button type="button" class="workflow-primary" onclick="submitFocusShiftClose()">Registrar no Vybe OS →</button></div>`);
}
function focusShiftText() { const user=focusUser(); const data=focusShiftSummary(user); const progress=String(document.getElementById('focus-shift-progress')?.value||'').trim(); const next=String(document.getElementById('focus-shift-next')?.value||'').trim(); return `[Vybe OS · Encerramento de turno]\nOperador: ${user?.name || 'Não identificado'}\nEm execução: ${data.executed.map(d=>d.nome).join(' | ') || 'Nenhuma'}\nBloqueios: ${data.blocked.map(d=>d.nome).join(' | ') || 'Nenhum'}\nAvanço: ${progress || 'Não informado'}\nAmanhã: ${next || 'Não informado'}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`; }
async function copyFocusShiftClose() { const text=focusShiftText(); try { await navigator.clipboard.writeText(text); showToast('✓ Encerramento copiado','ok'); } catch(e) { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); showToast('✓ Encerramento copiado','ok'); } }
async function submitFocusShiftClose() { const itemId=String(document.getElementById('focus-shift-item')?.value||''); if(!itemId) return showToast('Escolha o item que continuará no próximo turno.','info'); const button=document.querySelector('#workflow-modal .workflow-primary'); if(button) button.disabled=true; try { await postItemUpdate(itemId,focusShiftText()); closeWorkflowModal(); showToast('✓ Encerramento registrado no Vybe OS','ok'); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o encerramento: ${e.message}`,'err',7000); } }

function renderFocusDashboard() {
  const dash = document.getElementById('focus-dashboard');
  const user = focusUser();
  if (!dash || !user) return;
  const today = HOJE_ISO || new Date().toISOString().slice(0,10);
  const referenceLabel = focusUsesVeiculacao(user) ? 'veiculação' : 'prazo';
  const todosOsMeus = focusOwnItems(user);
  const mine = filtrarPorOrigemDoFoco(todosOsMeus);
  const inProgress = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Em andamento'), user);
  const toProduceToday = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Pode Fazer' && focusReferenceDate(d,user) && focusReferenceDate(d,user) <= today), user);
  const toStart = focusSort(mine.filter(d => operationalFlowStatus(d) === 'A Fazer'), user);
  const awaitingApproval = focusSort(mine.filter(d => ['Para aprovação','Ag. Aprovação Cliente','Ag. Interno'].includes(operationalFlowStatus(d))), user);
  const inRevision = focusSort(mine.filter(d => operationalFlowStatus(d) === 'Alteração'), user);
  // "Aguardo Redação" e "Falta OFF" moravam em "Bloqueadas por outra etapa".
  // Paulo em 02/09/2026: elas nao travam a peca — o texto e o audio chegam sem
  // impedir o resto de andar. Sao espera, como as outras tres: a peca segue
  // viva, so falta uma peca de material. "Bloqueada" fica para o que realmente
  // para a fila.
  const awaitingInfo = focusSort(mine.filter(d => ['Falta Info','Ag. Info Cliente','Aguardo','Aguardo Redação','Falta OFF'].includes(operationalFlowStatus(d))), user);
  const blocked = focusSort(mine.filter(d => ['Falta D.A','Cap. Agendada','Agendando Cap','Segurar Post'].includes(operationalFlowStatus(d))), user);
  const classified = new Set([...inProgress,...toProduceToday,...toStart,...awaitingApproval,...inRevision,...awaitingInfo,...blocked].map(d => String(d.id)));
  const nextDeadlines = focusSort(mine.filter(d => !classified.has(String(d.id)) && focusReferenceDate(d,user) > today), user);
  // NADA DA PESSOA PODE SUMIR DESTA TELA.
  //
  // Os grupos acima sao listas por estado, e "Proximos prazos" so recolhe o que
  // sobrou COM DATA FUTURA. Quem nao caisse em nenhum estado e estivesse com a
  // data no passado — ou sem data — simplesmente nao aparecia em lugar nenhum:
  // a peca continuava na fila da pessoa e ela nao tinha como saber. Foi o que
  // aconteceu com a "Capa destaque paes" da Jady, num status que nao estava
  // mapeado.
  //
  // Consertar o mapa resolve aquele caso. Este grupo resolve a CLASSE do
  // problema: qualquer estado novo que apareca amanha cai aqui, visivel, em vez
  // de virar um buraco. O nome diz o que e — nao sei classificar, mas e seu.
  const finalizados = new Set(['Finalizado', 'Feito', 'Concluídas', 'Publicado']);
  const emOutroEstado = focusSort(mine.filter((d) => !classified.has(String(d.id))
    && !finalizados.has(operationalFlowStatus(d))
    && !(focusReferenceDate(d, user) > today)), user);
  const late = mine.filter(d => { const due=focusReferenceDate(d,user); return due && due < today; }).length;
  const todayCount = mine.filter(d => focusReferenceDate(d,user) === today).length;
  const ready = mine.filter(d => ['Para agendar','Agendado'].includes(operationalFlowStatus(d))).length;
  const renderGroup = (label, subtitle, items, contextText, tone, icon='') => {
    if (!items.length) return '';
    const displayed = focusShowAll ? items : items.slice(0,5);
    const more = items.length > 5 ? `<button class="search-result-action" onclick="toggleFocusShowAll()">${focusShowAll?'Mostrar menos':`Ver mais (${items.length-5})`}</button>` : '';
    // A etiqueta de origem so informa quando ha as DUAS na tela. Com a fila
    // inteira sendo conteudo, ela virava a mesma palavra repetida em cada
    // cabecalho — e o seletor la em cima ja diz o que se esta vendo.
    const origensNaTela = new Set(mine.map(d => isRequestItem(d) ? 'req' : 'con'));
    const origensAqui = new Set(displayed.map(d => isRequestItem(d) ? 'req' : 'con'));
    const selo = origensNaTela.size > 1 && origensAqui.size === 1
      ? ` ${operationalOriginTag(displayed[0])}` : '';
    // O contexto ("Pronto para voce executar") vale para o grupo inteiro. Ele
    // saia impresso na primeira linha, flutuando no meio dela sem nada em volta;
    // aqui ele fica onde a regra vale, e vale para todas.
    const dica = contextText || '';
    return `<section class="focus-section" style="--focus-group-color:${tone}"><div class="focus-section-head"><span>${icon ? `${icon} ` : ''}${label} <b>${items.length}</b>${selo}</span><span class="focus-section-fim" title="${safeText(subtitle)}">${dica ? `<em class="focus-section-dica">${safeText(dica)}</em>` : ''}${more}</span></div><div class="focus-list">${(() => {
        const origens = new Set(displayed.map(d => isRequestItem(d) ? 'req' : 'con'));
        const donos = new Set(displayed.map(d => (d.responsavel_ids || [d.responsavel_id]).join(',')));
        const riscos = new Set(displayed.map(d => String(riskBadgeHtml(d, true) || '')));
        return displayed.map((d, n) => focusTaskHtml(d, contextText, {
          primeira: n === 0, origemVaria: origens.size > 1, donoVaria: donos.size > 1,
          riscoVaria: riscos.size > 1,
        })).join('');
      })()}</div></section>`;
  };
  const nextAction=getFocusNextAction(mine,user);
  const primaryId=String(nextAction?.item?.id || '');
  const withoutPrimary=(items=[])=>primaryId ? items.filter(d=>String(d.id)!==primaryId) : items;
  const groups = [
    renderGroup('Em execução hoje','todas as demandas já iniciadas; acompanhe e atualize sem misturar com a próxima a começar',inProgress,'Em execução por você','#ff6b00','◉'),
    renderGroup('Para produzir hoje',`itens com ${referenceLabel} vencido ou para hoje`,withoutPrimary(toProduceToday),'Pronto para você executar','#ffbd2e','→'),
    renderGroup('Conteúdos a iniciar','ainda não tiveram produção iniciada',withoutPrimary(toStart),'Conteúdo ainda não iniciado','#ffbd2e','＋'),
    renderGroup('Entregue por mim — aguardando aprovação','o que já saiu da sua execução',withoutPrimary(awaitingApproval),'Entregue por você; aguardando aprovação','#579bfc','✓'),
    renderGroup('Em alteração','ajustes solicitados que precisam ser resolvidos antes da próxima entrega',withoutPrimary(inRevision),'Ajuste solicitado; abra o contexto para conferir o que mudar','#ff637a','↻'),
    renderGroup('Aguardando informação','não avança sem resposta, material ou contexto',withoutPrimary(awaitingInfo),'Aguardando informação ou material','#9d50dd','?'),
    renderGroup('Bloqueadas por outra etapa','dependem de outra área para seguir',withoutPrimary(blocked),'Dependência de outra etapa','#ff4d6d','⚠'),
    renderGroup('Próximos prazos',`itens futuros organizados por ${referenceLabel}`,withoutPrimary(nextDeadlines),'Próximo prazo','#a58c79','›'),
    renderGroup('Em outro estado','continuam na sua fila; o status delas não se encaixa nos grupos acima',
      withoutPrimary(emOutroEstado),'Na sua fila','#8f98a9','•')
  ].join('');
  const commandStrip = '';
  dash.innerHTML = `<div class="focus-hero"><div><h2 class="focus-hero-title">Meu Dia, ${safeText(firstName(user.name))}</h2><p class="focus-hero-text">${focusUsesVeiculacao(user) ? 'Sua fila usa a data de veiculação para organizar a publicação.' : 'Sua fila usa o prazo de entrega para organizar o trabalho.'}</p></div><div class="focus-hero-lado"><div class="focus-metrics"><div class="focus-metric ${late ? 'is-alerta' : 'calado'}" style="--focus-color:#ff4d6d"><strong>${late}</strong><span>atrasados</span></div><div class="focus-metric ${todayCount ? '' : 'calado'}" style="--focus-color:#ffe600"><strong>${todayCount}</strong><span>hoje</span></div><div class="focus-metric ${mine.length ? '' : 'calado'}" style="--focus-color:#ff6b00"><strong>${mine.length}</strong><span>abertos</span></div><div class="focus-metric ${ready ? '' : 'calado'}" style="--focus-color:#00ff88"><strong>${ready}</strong><span>prontos</span></div></div></div></div>${seletorDeOrigemHtml(todosOsMeus)}${commandStrip}${focusDailyPlanHtml(mine,user,nextAction)}${focusNextActionHtml(nextAction)}${groups || `<div class="focus-empty">✓ ${FOCO_ORIGEM === 'tudo'
    ? 'Nenhuma demanda aberta neste momento.'
    : `Nada aberto em ${FOCO_ORIGEM === 'conteudo' ? 'produção de conteúdo' : 'solicitações'}. Veja “Tudo” para a fila inteira.`}</div>`}${focusContinuityHtml(mine,user)}`;
}
function toggleFocusShowAll() { focusShowAll = !focusShowAll; renderFocusDashboard(); }
function managerRow(d, meta) { return `<div class="manager-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}</button>${pillHtml(d.status,d.status_color,d.status_border)}<span class="manager-meta">${safeText(meta || d.prazo || d.veiculacao || '')}</span></div>`; }
function managerRiskRow(d) {
  const risk = d.operational_risk || getOperationalRisk(d);
  const meta = risk.sla_label || (getReferenceDate(d) ? `Prazo ${d.prazo || d.veiculacao}` : 'Sem prazo informado');
  return `<div class="manager-row manager-risk-row"><span class="manager-client">${safeText(d.cliente)}</span><button type="button" class="manager-name manager-workspace-link" onclick="openItemWorkspace('${d.id}')" title="Abrir contexto da demanda">${safeText(d.nome)}<span class="risk-sla">${safeText(meta)}</span></button><div class="manager-risk-meta">${riskBadgeHtml(d)}${riskActionHtml(d,true)}${pillHtml(d.status,d.status_color,d.status_border)}</div></div>`;
}

