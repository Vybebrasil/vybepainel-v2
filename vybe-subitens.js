// vybe-subitens.js — as tarefas de dentro de uma solicitação.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global,
// mesma ordem de carregamento, mesmos nomes.
//
// Existem só no quadro de Demandas: em Produção a consulta volta vazia e a
// seção não aparece. Cada linha é editável — a bolinha troca o status, o nome
// renomeia, o × remove. Deixar isso só de leitura mandava a pessoa de volta ao
// Monday para marcar uma tarefa como feita.

// A lista de tarefas de dentro de uma solicitação. Existe só no board de
// Demandas — em Produção a consulta volta vazia e a seção não aparece.
//
// Cada linha é editável: a bolinha troca o status, o nome renomeia, o × remove.
// Deixar isso só de leitura mandava a pessoa de volta ao Monday para marcar uma
// tarefa como feita.
function subitensHtml(detail, item) {
  const itens = detail?.subitens || [];
  const ehDemanda = typeof isRequestItem === 'function' ? isRequestItem(item) : false;
  if (!itens.length && !ehDemanda) return '';
  const feitos = itens.filter((s) => /^(feito|conclu|aprovado)/i.test(String(s.status || ''))).length;
  const dataCurta = (v) => {
    const iso = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8,10)}/${iso.slice(5,7)}` : '';
  };
  const linhas = itens.map((s) => `
    <li class="subitem" data-subitem="${safeText(s.ref)}">
      <button type="button" class="subitem-marca" style="--cor:${s.status_cor || '#7c8797'}"
        title="Trocar status desta tarefa"
        onclick="abrirStatusDaTarefa(event,'${safeText(s.ref || '')}','${safeText(item.id)}')"></button>
      <span class="subitem-corpo">
        <b title="Clique para renomear"
           onclick="renomearTarefa('${safeText(s.ref || '')}','${safeText(item.id)}',this)">${safeText(s.titulo)}</b>
        <small>${[s.status, s.tipo, s.prioridade, s.responsaveis]
                  .filter(Boolean).map(safeText).join(' · ') || 'sem detalhe'}</small>
      </span>
      ${dataCurta(s.conclusao || s.prazo) ? `<span class="subitem-data">${dataCurta(s.conclusao || s.prazo)}</span>` : ''}
      <button type="button" class="subitem-tirar" title="Remover tarefa"
        onclick="removerTarefa('${safeText(s.ref || '')}','${safeText(item.id)}','${safeText(s.titulo).replace(/'/g, "\\'")}')">×</button>
    </li>`).join('');
  return `<section class="workspace-section">
    <div class="workspace-section-head">Tarefas da solicitação
      ${itens.length ? `<span class="subitem-contagem">${feitos} de ${itens.length}</span>` : ''}</div>
    <div class="workspace-section-body">
      <ul class="subitem-lista">${linhas || '<li class="workspace-empty">Nenhuma tarefa ainda.</li>'}</ul>
      <div class="subitem-nova">
        <input id="subitem-nova-${safeText(item.id)}" class="workspace-input" type="text"
               placeholder="Nova tarefa…" maxlength="255"
               onkeydown="if(event.key==='Enter'){event.preventDefault();criarTarefa('${safeText(item.id)}')}">
        <button type="button" class="workspace-action" onclick="criarTarefa('${safeText(item.id)}')">Adicionar</button>
      </div>
    </div>
  </section>`;
}

// Todas as escritas de tarefa passam por aqui: um caminho só para gravar, e um
// só lugar para redesenhar a gaveta depois.
async function mexerNaTarefa(corpo, itemId) {
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'subitem', ...corpo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    if (String(d.replica_monday || '').startsWith('falhou')) {
      showToast('✓ Salvo no Vybe · o Monday não recebeu a cópia, será reconciliada', 'info', 6000);
    }
    const atual = findOperationalItem(itemId);
    if (atual) renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), atual);
    return d;
  } catch (erro) {
    showToast(`Não foi possível salvar a tarefa: ${erro.message}`, 'err', 7000);
    return null;
  }
}

async function criarTarefa(itemId) {
  const campo = document.getElementById(`subitem-nova-${itemId}`);
  const titulo = String(campo?.value || '').trim();
  if (!titulo) return campo?.focus();
  campo.disabled = true;
  const d = await mexerNaTarefa({ operacao: 'criar', item: String(itemId), titulo }, itemId);
  if (d) showToast(`✓ Tarefa "${titulo}" adicionada`, 'ok');
  else if (campo) { campo.disabled = false; campo.focus(); }
}

async function renomearTarefa(subitemId, itemId, alvo) {
  const atual = alvo?.textContent || '';
  const novo = window.prompt('Nome da tarefa:', atual);
  if (novo === null || novo.trim() === atual.trim()) return;
  await mexerNaTarefa({ operacao: 'titulo', subitem: subitemId, titulo: novo.trim() }, itemId);
}

async function removerTarefa(subitemId, itemId, titulo) {
  if (!window.confirm(`Remover a tarefa "${titulo}"? Ela sai daqui e do Monday.`)) return;
  const d = await mexerNaTarefa({ operacao: 'remover', subitem: subitemId }, itemId);
  if (d) showToast('✓ Tarefa removida', 'ok');
}

// Mesmo seletor do status da peça: quem já sabe trocar um não aprende outro.
function abrirStatusDaTarefa(event, subitemId, itemId) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof fecharEscolha === 'function') fecharEscolha();
  document.getElementById('tarefa-editor-backdrop')?.remove();
  document.getElementById('tarefa-editor')?.remove();
  const opcoes = (typeof requestStatusOptions === 'function' ? requestStatusOptions({}) : []) || [];
  if (!opcoes.length) return showToast('As opções de status ainda estão carregando.', 'info');
  const rect = event.currentTarget.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'tarefa-editor-backdrop';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = () => { fundo.remove(); document.getElementById('tarefa-editor')?.remove(); };
  const menu = document.createElement('div');
  menu.id = 'tarefa-editor';
  menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">Status da tarefa</div>
    ${opcoes.map((o) => `<button type="button" class="status-editor-option"
        onclick="escolherStatusDaTarefa('${safeText(subitemId)}','${safeText(itemId)}','${safeText(chaveDeStatus(o.label))}')">
        <span class="status-editor-dot" style="background:${o.color};color:${o.color}"></span>
        <span>${safeText(o.label)}</span></button>`).join('')}`;
  document.body.append(fundo, menu);
  ancorarPopover(menu, rect);
}

async function escolherStatusDaTarefa(subitemId, itemId, chave) {
  document.getElementById('tarefa-editor-backdrop')?.remove();
  document.getElementById('tarefa-editor')?.remove();
  const d = await mexerNaTarefa({ operacao: 'status', subitem: subitemId, para: chave }, itemId);
  if (d?.rotulo) showToast(`✓ Tarefa em ${d.rotulo}`, 'ok');
}
