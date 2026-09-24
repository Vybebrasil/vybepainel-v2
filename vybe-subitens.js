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
  const iso = (v) => { const t = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; };
  const equipe = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const donos = (s) => {
    const ids = (s.responsavel_ids || []).map(String);
    const pessoas = ids.map((id) => equipe.find((u) => String(u.id) === id)).filter(Boolean);
    const conteudo = pessoas.length
      ? `<span class="owner-avatar-stack">${pessoas.slice(0, 3).map((u) => ownerAvatarHtml(u)).join('')}${
          pessoas.length > 3 ? `<span class="owner-avatar-fallback" style="background:#465363">+${pessoas.length - 3}</span>` : ''}</span>`
      : '<span class="owner-avatar-add">+</span>';
    return `<button type="button" class="subitem-donos owner-editor-trigger"
      title="${pessoas.length ? safeText(pessoas.map((u) => u.name).join(', ')) : 'Sem responsável'} — clique para escolher"
      aria-label="Responsáveis da subdemanda"
      onclick="abrirDonosDaSubdemanda(event,'${safeText(s.ref || '')}','${safeText(item.id)}')">${conteudo}</button>`;
  };
  const linhas = itens.map((s) => `
    <li class="subitem" data-subitem="${safeText(s.ref)}" data-donos="${safeText((s.responsavel_ids || []).join(','))}">
      <button type="button" class="subitem-marca" style="--cor:${s.status_cor || '#7c8797'}"
        title="Trocar status desta subdemanda"
        onclick="abrirStatusDaTarefa(event,'${safeText(s.ref || '')}','${safeText(item.id)}')"></button>
      <span class="subitem-corpo">
        <b title="Clique para renomear"
           onclick="renomearTarefa('${safeText(s.ref || '')}','${safeText(item.id)}',this)">${safeText(s.titulo)}</b>
        <small>${[s.status, s.tipo, s.prioridade].filter(Boolean).map(safeText).join(' · ') || 'sem status'}</small>
      </span>
      ${donos(s)}
      <label class="subitem-prazo" title="Prazo desta subdemanda">
        <input type="date" value="${safeText(iso(s.prazo))}"
          onchange="mudarPrazoDaSubdemanda('${safeText(s.ref || '')}','${safeText(item.id)}',this)"
          aria-label="Prazo da subdemanda ${safeText(s.titulo)}"></label>
      <button type="button" class="subitem-tirar" title="Remover subdemanda"
        onclick="removerTarefa('${safeText(s.ref || '')}','${safeText(item.id)}','${safeText(s.titulo).replace(/'/g, "\\'")}')">×</button>
    </li>`).join('');
  return `<section class="workspace-section">
    <div class="workspace-section-head">Subdemandas
      ${itens.length ? `<span class="subitem-contagem">${feitos} de ${itens.length}</span>` : ''}</div>
    <div class="workspace-section-body">
      <ul class="subitem-lista">${linhas || '<li class="workspace-empty">Nenhuma subdemanda ainda.</li>'}</ul>
      <div class="subitem-nova">
        <input id="subitem-nova-${safeText(item.id)}" class="workspace-input" type="text"
               placeholder="Nova subdemanda…" maxlength="255"
               onkeydown="if(event.key==='Enter'){event.preventDefault();criarTarefa('${safeText(item.id)}')}">
        <button type="button" class="workspace-action" onclick="criarTarefa('${safeText(item.id)}')">Adicionar</button>
      </div>
    </div>
  </section>`;
}

// Prazo e responsáveis da subdemanda passam pelo MESMO caminho de gravação das
// outras mudanças dela (mexerNaTarefa): um lugar para salvar, um para repintar.
async function mudarPrazoDaSubdemanda(ref, itemId, campo) {
  const data = String(campo?.value || '');
  campo.disabled = true;
  const d = await mexerNaTarefa({ operacao: 'prazo', subitem: ref, data }, itemId);
  if (campo?.isConnected) campo.disabled = false;
  if (d) showToast(data ? `✓ Prazo da subdemanda: ${planningDateBr(data)}` : '✓ Subdemanda sem prazo', 'ok', 3000);
}

function abrirDonosDaSubdemanda(event, ref, itemId) {
  event.preventDefault();
  event.stopPropagation();
  document.getElementById('subitem-donos-menu')?.remove();
  document.getElementById('subitem-donos-fundo')?.remove();
  const linha = event.currentTarget.closest('.subitem');
  const atuais = new Set(String(linha?.dataset.donos || '').split(',').filter(Boolean));
  const equipe = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
  const fundo = document.createElement('div');
  fundo.id = 'subitem-donos-fundo';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = () => { fundo.remove(); document.getElementById('subitem-donos-menu')?.remove(); };
  const menu = document.createElement('div');
  menu.id = 'subitem-donos-menu';
  menu.className = 'status-editor';
  menu.innerHTML = `<div class="status-editor-head">Responsáveis da subdemanda</div>${equipe.map((u) => `
    <button type="button" class="status-editor-option${atuais.has(String(u.id)) ? ' current' : ''}" data-pessoa="${safeText(String(u.id))}">
      ${ownerAvatarHtml(u)}<span>${safeText(firstName(u.name))}</span>${atuais.has(String(u.id)) ? '<span class="status-editor-check">✓</span>' : ''}</button>`).join('')}`;
  menu.onclick = async (e) => {
    const id = e.target.closest('[data-pessoa]')?.dataset.pessoa;
    if (!id) return;
    // Clicar soma ou tira; a lista inteira vai junto, que é como o servidor grava.
    if (atuais.has(id)) atuais.delete(id); else atuais.add(id);
    fundo.remove(); menu.remove();
    await mexerNaTarefa({ operacao: 'responsaveis', subitem: ref, pessoas: [...atuais] }, itemId);
  };
  document.body.append(fundo, menu);
  if (typeof ancorarPopover === 'function') ancorarPopover(menu, event.currentTarget.getBoundingClientRect());
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
    // A lista de subdemandas vive em dois lugares: na gaveta e no cartão rápido.
    // Repinta quem estiver aberto — repintar a gaveta fechada não devolve nada.
    const atual = findOperationalItem(itemId) || (typeof normalizeRequestForOperational === 'function'
      && (DADOS_DEMANDAS || []).find((x) => String(x.id) === String(itemId))
      && normalizeRequestForOperational((DADOS_DEMANDAS || []).find((x) => String(x.id) === String(itemId))));
    const detalhe = await fetchWorkspaceItem(itemId);
    const noCartao = document.getElementById(`cr-subs-${itemId}`);
    if (noCartao && atual) noCartao.innerHTML = subitensHtml(detalhe, atual);
    const gaveta = document.getElementById('workspace-drawer');
    if (atual && gaveta && gaveta.getClientRects().length) renderWorkspaceDrawer(detalhe, atual);
    return d;
  } catch (erro) {
    showToast(`Não foi possível salvar a subdemanda: ${erro.message}`, 'err', 7000);
    return null;
  }
}

async function criarTarefa(itemId) {
  const campo = document.getElementById(`subitem-nova-${itemId}`);
  const titulo = String(campo?.value || '').trim();
  if (!titulo) return campo?.focus();
  campo.disabled = true;
  const d = await mexerNaTarefa({ operacao: 'criar', item: String(itemId), titulo }, itemId);
  if (d) showToast(`✓ Subdemanda "${titulo}" adicionada`, 'ok');
  else if (campo) { campo.disabled = false; campo.focus(); }
}

async function renomearTarefa(subitemId, itemId, alvo) {
  const atual = alvo?.textContent || '';
  const novo = window.prompt('Nome da subdemanda:', atual);
  if (novo === null || novo.trim() === atual.trim()) return;
  await mexerNaTarefa({ operacao: 'titulo', subitem: subitemId, titulo: novo.trim() }, itemId);
}

async function removerTarefa(subitemId, itemId, titulo) {
  if (!window.confirm(`Remover a subdemanda "${titulo}"?`)) return;
  const d = await mexerNaTarefa({ operacao: 'remover', subitem: subitemId }, itemId);
  if (d) showToast('✓ Subdemanda removida', 'ok');
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
