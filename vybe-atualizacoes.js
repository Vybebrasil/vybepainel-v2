// vybe-atualizacoes.js — o histórico escrito da peça e quem pode mexer nele.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// Quem escreveu pode corrigir e apagar o que escreveu; o registro do SISTEMA —
// troca de status, checklist, automação — não, porque ele é a prova do que
// aconteceu. A diferença mora no separador: a nota da pessoa sai como
// "[Vybe OS] o texto dela"; a do sistema, como "[Vybe OS · Checklist]".
//
// Aqui também mora a leitura do tempo em cada etapa, que sai das mesmas
// atualizações.
//
// Carrega DEPOIS de vybe-risco.js: chama fetchWorkspaceItem e
// renderWorkspaceDrawer, declarados lá.

// Quem escreveu pode corrigir e apagar o que escreveu. O registro do SISTEMA —
// troca de status, checklist, automacao — nao: ele e a prova do que aconteceu.
// A diferenca esta no separador, e e assim que o painel sempre escreveu: a nota
// da pessoa sai como "[Vybe OS] o texto dela"; a do sistema, como
// "[Vybe OS · Checklist de qualidade]".
//
// Esta funcao so decide se o botao APARECE. Quem autoriza de verdade e o
// servidor, que confere o autor_id de novo antes de gravar.
function atualizacaoDoSistema(update) {
  const corpo = String(update?.body || '');
  if (/^\s*(<p>)?\s*\[Vybe OS\s*[\u00b7\u2022\u30fb-]/i.test(corpo)) return true;
  return /^(automa|vybe os$|sistema$)/i.test(String(update?.creator?.name || '').trim());
}

function possoMexerNaAtualizacao(update) {
  if (!update?.update_id || atualizacaoDoSistema(update)) return false;
  const eu = typeof pessoaLogada === 'function' ? pessoaLogada() : null;
  if (!eu) return false;
  if (eu.admin) return true;
  const meu = String(eu.nome || '').trim().toLowerCase();
  return !!meu && meu === String(update?.creator?.name || '').trim().toLowerCase();
}

function ferramentasDaAtualizacaoHtml(update) {
  // Qualquer pessoa do time pode transformar um comentário no briefing: é o
  // conserto de quem escreveu o briefing no lugar errado, e fica no log.
  const comoBriefing = update?.update_id && !atualizacaoDoSistema(update)
    && workspacePlainText(String(update.body || '')).length >= 40
    ? `<button type="button" onclick="usarComentarioComoBriefing('${safeText(String(update.update_id))}')"
        title="Guardar este texto como o briefing da peça">Usar como briefing</button>` : '';
  if (!possoMexerNaAtualizacao(update)) return comoBriefing ? `<span class="workspace-update-tools">${comoBriefing}</span>` : '';
  const id = safeText(String(update.update_id));
  return `<span class="workspace-update-tools">${comoBriefing}
      <button type="button" onclick="corrigirAtualizacao('${id}')" title="Corrigir este texto">Corrigir</button>
      <button type="button" class="perigo" onclick="apagarAtualizacao('${id}')" title="Apagar esta atualização">Apagar</button>
    </span>`;
}

function workspaceTimelineEvent(update){ const body=workspacePlainText(update?.body||'') || 'Atualização sem texto.'; const type=workspaceTimelineType(body); const editado=update?.editado_em?'<span class="workspace-update-editado">editado</span>':''; return `<div class="workspace-update workspace-timeline-event" data-update="${safeText(String(update?.update_id||''))}"><div class="workspace-update-meta"><span class="workspace-timeline-type">${type}</span>${safeText(update?.creator?.name||'Equipe Vybe')} · ${safeText(quandoNaBahia(update?.created_at) || (update?.created_at||'').replace('T',' ').slice(0,16))}${editado}${ferramentasDaAtualizacaoHtml(update)}</div><div class="workspace-update-body">${safeText(body)}</div></div>`; }

// Guarda o que a gaveta leu, para corrigir e apagar acharem o texto atual sem
// uma segunda ida ao servidor.
let ATUALIZACOES_DA_GAVETA = [];

async function corrigirAtualizacao(updateId) {
  const alvo = ATUALIZACOES_DA_GAVETA.find((u) => String(u.update_id) === String(updateId));
  if (!alvo) return showToast('Não encontrei esta atualização. Reabra a atividade.', 'info');
  // O "[Vybe OS] " da frente e carimbo do sistema, nao texto de ninguem: some
  // para editar e volta na hora de salvar, senao ele sumiria do registro.
  const bruto = String(alvo.body || '');
  const carimbo = bruto.match(/^\s*\[Vybe OS\]\s*/i)?.[0] || '';
  const novo = await perguntarNoPainel({
    titulo: 'Corrigir atualização',
    texto: 'O texto corrigido substitui o anterior no histórico, marcado como editado.',
    confirmar: 'Salvar',
    campo: { valor: bruto.slice(carimbo.length), dica: 'O que ficou registrado', linhas: 6 },
  });
  if (novo === null || !String(novo).trim()) return;
  await mandarMexerNaAtualizacao('comentario_editar', updateId, { texto: `${carimbo}${novo}` },
    '✓ Atualização corrigida');
}

async function apagarAtualizacao(updateId) {
  const alvo = ATUALIZACOES_DA_GAVETA.find((u) => String(u.update_id) === String(updateId));
  const trecho = workspacePlainText(String(alvo?.body || '')).slice(0, 120);
  const sim = await perguntarNoPainel({
    titulo: 'Apagar esta atualização?',
    texto: `${trecho}${trecho.length >= 120 ? '…' : ''}\n\nO texto sai do histórico. Fica registrado que existiu e foi apagado, e por quem.`,
    confirmar: 'Apagar', perigo: true,
  });
  if (!sim) return;
  await mandarMexerNaAtualizacao('comentario_apagar', updateId, {}, '✓ Atualização apagada');
}

async function mandarMexerNaAtualizacao(acao, updateId, extra, recado) {
  const alvo = String(activeWorkspaceItemId || '');
  if (!alvo) return;
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, item: alvo, update: updateId, ...extra }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `Não deu certo (${r.status})`);
    showToast(recado, 'ok');
    const atual = findOperationalItem(alvo);
    if (atual && document.getElementById('workspace-drawer')) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(alvo), atual);
    }
  } catch (erro) {
    showToast(erro.message, 'err', 8000);
  }
}
function workspaceExecutiveHistoryHtml(updates=[]) {
  const decisive=(updates||[]).filter(update=>/Direcionamento D\.A|Contexto de status|Passagem de bastão|Planejamento atualizado|Check-in/i.test(workspacePlainText(update?.body||''))).slice(0,5);
  // Seção vazia ocupava um cartão inteiro para dizer "nada". Recolhida, fica o
  // nome e a contagem — como no Mac —, e abre para quem quiser conferir.
  if(!decisive.length) return '<details class="workspace-section workspace-recolhida workspace-executive-history"><summary>Memória executiva<small>nenhuma decisão</small></summary><div class="workspace-section-body"><div class="workspace-empty">Ainda não há decisão estruturada registrada nesta demanda.</div></div></details>';
  return `<section class="workspace-section workspace-executive-history"><div class="workspace-section-head">Memória executiva</div><div class="workspace-section-body"><p class="workspace-note">Somente decisões que mudam a próxima etapa, o responsável, o prazo ou a direção entram nesta leitura.</p>${decisive.map(update=>{const text=workspacePlainText(update?.body||''); const type=workspaceTimelineType(text); return `<div class="workspace-decision-memory"><span>${safeText(type)}</span><div><b>${safeText(quandoNaBahia(update?.created_at) || (update?.created_at||'').replace('T',' ').slice(0,16))}</b><p>${safeText(text)}</p></div></div>`;}).join('')}</div></section>`;
}

  function formatDuration(ms) {
    // "0m" parecia defeito numa etapa que acabou de começar.
    if (!ms || ms < 60000) return 'menos de 1 min';
    const totalMins = Math.floor(ms / 60000);
    if (totalMins < 60) return `${totalMins}m`;
    const hours = Math.floor(totalMins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        const remH = hours % 24;
        return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
    }
    const remM = totalMins % 60;
    return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`;
  }

  // TEMPO EM CADA ETAPA, NA ORDEM EM QUE ACONTECEU.
  //
  // Era ordenado pela duração, e a etapa atual — que começou há pouco — ia para o
  // fim da lista com "0m", sem dizer que ainda estava correndo nem desde quando.
  // Quem olhava não tinha como saber se o número estava certo. Agora as etapas
  // seguem a ordem do tempo, e a atual diz "agora · desde 17/09 às 09:12".
  function etapasDaPeca(detail, item, agora = Date.now()) {
    const logs = [...(detail?.activity_logs || [])].sort((a,b) => Number(b.created_at) - Number(a.created_at));
    const trechos = [];
    let fim = agora;
    let anterior = item?.status;
    let primeiro = true;
    for (const entry of logs) {
      if (entry.event !== 'update_column_value') continue;
      let data;
      try { data = JSON.parse(entry.data); } catch (e) { continue; }
      const para = data.value?.label?.text || '-';
      const inicio = Math.floor(Number(entry.created_at) / 10000);
      if (!Number.isFinite(inicio)) continue;
      // Registro com horário no futuro não pode virar duração negativa.
      trechos.push({ status: para, inicio, ms: Math.max(0, fim - inicio), atual: primeiro });
      primeiro = false;
      fim = Math.min(fim, inicio);
      anterior = data.previous_value?.label?.text || '-';
    }
    const criado = detail?.created_at ? new Date(detail.created_at).getTime() : null;
    if (criado && Number.isFinite(criado)) {
      trechos.push({ status: anterior, inicio: criado, ms: Math.max(0, fim - criado), atual: primeiro });
    }
    // Uma etapa pode se repetir (vai e volta de alteração): soma, e guarda a vez
    // mais antiga para a ordem e a mais recente para dizer desde quando.
    const porStatus = new Map();
    for (const t of trechos) {
      if (!t.status || t.status === '-') continue;
      const e = porStatus.get(t.status) || { status: t.status, ms: 0, primeiroInicio: t.inicio, ultimoInicio: t.inicio, atual: false };
      e.ms += t.ms;
      e.primeiroInicio = Math.min(e.primeiroInicio, t.inicio);
      e.ultimoInicio = Math.max(e.ultimoInicio, t.inicio);
      if (t.atual) e.atual = true;
      porStatus.set(t.status, e);
    }
    return [...porStatus.values()].sort((a, b) => a.primeiroInicio - b.primeiroInicio);
  }

  function workspaceHistoryHtml(detail, item) {
    if (!detail.activity_logs) return '';
    const etapas = etapasDaPeca(detail, item);
    if (!etapas.length) return '';
    const linhas = etapas.map((e) => `<div class="etapa-tempo${e.atual ? ' atual' : ''}">
          <div class="etapa-tempo-nome">${pillHtml(e.status)}${e.atual ? `<small>agora · desde ${safeText(quandoNaBahia(e.ultimoInicio))}</small>` : ''}</div>
          <strong>${formatDuration(e.ms)}</strong>
        </div>`);
    return `<section class="workspace-section"><div class="workspace-section-head">Tempo em cada etapa</div><div class="workspace-section-body">${linhas.join('')}</div></section>`;
  }
