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
  if (!possoMexerNaAtualizacao(update)) return '';
  const id = safeText(String(update.update_id));
  return `<span class="workspace-update-tools">
      <button type="button" onclick="corrigirAtualizacao('${id}')" title="Corrigir este texto">Corrigir</button>
      <button type="button" class="perigo" onclick="apagarAtualizacao('${id}')" title="Apagar esta atualização">Apagar</button>
    </span>`;
}

function workspaceTimelineEvent(update){ const body=workspacePlainText(update?.body||'') || 'Atualização sem texto.'; const type=workspaceTimelineType(body); const editado=update?.editado_em?'<span class="workspace-update-editado">editado</span>':''; return `<div class="workspace-update workspace-timeline-event" data-update="${safeText(String(update?.update_id||''))}"><div class="workspace-update-meta"><span class="workspace-timeline-type">${type}</span>${safeText(update?.creator?.name||'Equipe Vybe')} · ${safeText((update?.created_at||'').replace('T',' ').slice(0,16))}${editado}${ferramentasDaAtualizacaoHtml(update)}</div><div class="workspace-update-body">${safeText(body)}</div></div>`; }

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
  if(!decisive.length) return '<section class="workspace-section workspace-executive-history"><div class="workspace-section-head">Memória executiva</div><div class="workspace-section-body"><div class="workspace-empty">Ainda não há decisão estruturada registrada nesta demanda.</div></div></section>';
  return `<section class="workspace-section workspace-executive-history"><div class="workspace-section-head">Memória executiva</div><div class="workspace-section-body"><p class="workspace-note">Somente decisões que mudam a próxima etapa, o responsável, o prazo ou a direção entram nesta leitura.</p>${decisive.map(update=>{const text=workspacePlainText(update?.body||''); const type=workspaceTimelineType(text); return `<div class="workspace-decision-memory"><span>${safeText(type)}</span><div><b>${safeText((update?.created_at||'').replace('T',' ').slice(0,16))}</b><p>${safeText(text)}</p></div></div>`;}).join('')}</div></section>`;
}

  function formatDuration(ms) {
    if (!ms || ms < 0) return 'agora';
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
  
  function workspaceHistoryHtml(detail, item) {
    if (!detail.activity_logs) return '';
    const logs = [...detail.activity_logs].sort((a,b) => Number(b.created_at) - Number(a.created_at));
    const history = [];
    let endTime = Date.now();
    let expectedTo = item.status;
    
    for (const entry of logs) {
        if (entry.event !== 'update_column_value') continue;
        try {
            const data = JSON.parse(entry.data);
            const fromStatus = data.previous_value?.label?.text || '-';
            const toStatus = data.value?.label?.text || '-';
            const timestamp = Math.floor(Number(entry.created_at) / 10000);
            
            history.push({ status: toStatus, durationMs: endTime - timestamp });
            endTime = timestamp;
            expectedTo = fromStatus;
        } catch(e) {}
    }
    
    const createdTime = detail.created_at ? new Date(detail.created_at).getTime() : null;
    if (createdTime) {
        history.push({ status: expectedTo, durationMs: endTime - createdTime });
    }
    
    const totals = {};
    for (const h of history) {
        if (h.status === '-' || !h.status) continue;
        if (h.durationMs) {
            totals[h.status] = (totals[h.status] || 0) + h.durationMs;
        }
    }
    
    const lines = Object.entries(totals)
        .sort((a,b) => b[1] - a[1])
        .map(([st, ms]) => `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">${pillHtml(st)}</div>
          <strong style="color:#b8d7df;font:700 12px var(--mac-mono, monospace);letter-spacing:0.5px;">${formatDuration(ms)}</strong>
        </div>`);
        
    if (lines.length === 0) return '';
    return `<section class="workspace-section"><div class="workspace-section-head">Tempo em cada etapa</div><div class="workspace-section-body">${lines.join('')}</div></section>`;
  }
