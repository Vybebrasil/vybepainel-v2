// vybe-ficha.js — a ficha da peça: os campos de catálogo e a gravação deles.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global,
// mesma ordem de carregamento, mesmos nomes.
//
// Os mesmos campos que o Monday mostrava ao abrir um item, editáveis no mesmo
// lugar. Antes o painel trazia formato, prazo e status; para ver ou mudar
// captação, OFF, tipo de conteúdo ou grupo era preciso abrir o Monday — que é
// justamente o que se deixou de fazer.

// A ficha da peça, com os mesmos campos que o Monday mostra ao abrir um item —
// e editáveis no mesmo lugar, como lá. Antes o drawer trazia formato, prazo e
// status; para ver ou mudar captação, OFF, tipo de conteúdo ou o grupo era
// preciso abrir o Monday, que é justamente o que estamos deixando de fazer.

const GRUPOS_DA_PRODUCAO = [
  ['novo_grupo57911__1', 'Produção ( Foto e Vídeo, à Captar )'],
  ['novo_grupo__1', 'Design & Edição'],
  ['group_title', 'Redação'],
  ['novo_grupo22352__1', 'Gestão de publicações'],
  ['novo_grupo31348__1', 'Finalizados'],
];

let FICHA_ITEM = null;

// Só oferece opção ativa no Monday. Opção desativada continua no catálogo dele e
// gravaria aqui, mas a réplica é recusada com "label has been deactivated" — a
// tela ofereceria uma escolha que não chega ao outro lado.
//
// A opção atual entra mesmo desativada: esconder o valor que a peça já tem faria
// o seletor mostrar "—" para um campo preenchido, e salvar sem querer o apagaria.
function fichaSelect(campo, opcoes, atual, itemId) {
  const escolhida = String(atual || '');
  const oferecidas = opcoes.filter(([v, , ativa]) => ativa !== false || String(v) === escolhida);
  return `<select class="workspace-ficha-select" onchange="salvarCampoDaFicha('${itemId}','${campo}',this.value,this)">
    <option value=""${escolhida ? '' : ' selected'}>—</option>
    ${oferecidas.map(([v, r, ativa]) => `<option value="${safeText(v)}"${String(v) === escolhida ? ' selected' : ''}>${safeText(r)}${ativa === false ? ' (desativada)' : ''}</option>`).join('')}
  </select>`;
}

// O Monday deixa de ser lugar para o time entrar: quem não administra não vê o
// atalho, senão ele abre uma tela de "sem acesso" e parece defeito do painel.
// Renomear a peça. Não existia: dava para criar, nunca para corrigir um título.
// Com o time fora do Monday, um erro de digitação viraria permanente.
// Redesenha o painel depois de uma mudanca feita aqui dentro.
//
// Estas tres acoes chamavam uma funcao de nome renderAll, que nunca existiu — o
// typeof engolia o erro e a tela so mudava no proximo refresh: a peca renomeada
// continuava com o nome antigo, a excluida continuava na lista. Quem sabe
// redesenhar tudo e o renderOutboundItemPatch, ja usado em toda alteracao
// local; a visao de grupos, o calendario e a tabela de Demandas ficam de fora
// dele e sao chamados aqui.
// Ficou sendo o mesmo que renderOutboundItemPatch. Continua existindo porque o
// nome diz a intencao no ponto de uso — mas nao repete a lista de telas, que era
// justamente o que fazia as duas divergirem.
function redesenharAposMudanca(motivo = 'alteração') {
  if (typeof renderOutboundItemPatch === 'function') renderOutboundItemPatch(motivo);
}

function workspaceFichaHtml(detail, itemId) {
  const f = detail?.ficha;
  if (!f) return '';
  FICHA_ITEM = itemId;
  const cat = detail.catalogos || { captacao: [], opcoes: [] };
  const por = (coluna) => (cat.opcoes || []).filter((o) => o.coluna_id === coluna).map((o) => [o.chave, o.rotulo, o.ativa]);
  const dataBr = (v) => { const iso = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : ''; };
  const texto = (v) => `<b class="${v ? '' : 'vazio'}">${safeText(v || '—')}</b>`;

  const linhas = [
    ['Grupo', fichaSelect('grupo', GRUPOS_DA_PRODUCAO, f.grupo_id, itemId)],
    ['Cliente', texto(f.cliente)],
    // Status, datas e responsáveis eram texto morto aqui, com um aviso dizendo
    // para usar os botões acima. Editar onde a informação está é a regra do
    // resto do painel; três botões deixam de ser necessários.
    ['Status', `<button type="button" class="grupo-pill-btn" onclick="openStatusEditor(event,'${itemId}')"
        title="Trocar status">${pillHtml(f.status || 'Sem status')}</button>`],
    ['Captação', fichaSelect('captacao', (cat.captacao || []).map((o) => [o.chave, o.rotulo, o.ativa]), f.captacao_chave, itemId)],
    ['OFF / áudio', fichaSelect('off_audio', por('color_mkynd7j8'), f.off_audio_chave, itemId)],
    ['Tipo de conteúdo', fichaSelect('tipo_conteudo', por('lista_suspensa__1'), (f.tipo_conteudo_chaves || [])[0], itemId)],
    ['Formato', fichaSelect('formato', por('lista_suspensa0__1'), (f.formato_chaves || [])[0], itemId)],
    ['Prioridade', fichaSelect('prioridade', por('color_mm164yv8'), f.prioridade_chave, itemId)],
    ['Prazo', `<input type="date" class="grupo-data-campo" value="${safeText(String(f.prazo || '').slice(0,10))}"
        onchange="salvarDataNaLinha('${itemId}','prazo',this)">`],
    ['Veiculação', `<input type="date" class="grupo-data-campo" value="${safeText(String(f.veiculacao || '').slice(0,10))}"
        onchange="salvarDataNaLinha('${itemId}','veiculacao',this)">`],
    ['Responsável', `<button type="button" class="ficha-dono" onclick="openOwnerEditor(event,'${itemId}')"
        title="Gerenciar responsáveis">${safeText(f.responsaveis || '—')}</button>`],
    ['Editor/Designer', texto(f.editores)],
  ];

  // Campo vazio aparece como "—" em vez de sumir: saber que a captação está em
  // branco é informação, e sumir com a linha esconde o que falta preencher.
  return `<section class="workspace-section"><div class="workspace-section-head">Ficha da peça</div><div class="workspace-section-body"><div class="workspace-ficha">${
    linhas.map(([r, v]) => `<div class="workspace-ficha-linha"><span>${safeText(r)}</span>${v}</div>`).join('')
  }</div></div></section>`;
}

// Grava e recarrega a peça. Status e datas continuam pelos botões próprios, que
// passam pelas conferências — mudar status por um seletor solto pularia o
// checklist de qualidade.
async function salvarCampoDaFicha(itemId, campo, valor, alvo) {
  const anterior = alvo ? alvo.value : null;
  if (alvo) alvo.disabled = true;
  try {
    const corpo = campo === 'grupo'
      ? { acao: 'grupo', item: String(itemId), grupo_id: valor }
      : { acao: campo, item: String(itemId), para: valor ? [valor] : [] };
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    if (String(d.replica_monday || '').startsWith('falhou')) {
      showToast('✓ Salvo no Vybe · o Monday não recebeu a cópia, será reconciliada', 'info', 6000);
    } else {
      showToast(`✓ ${campo.replace('_', ' ')} atualizado`, 'ok', 3500);
    }
    if ((d.automacoes || []).length) {
      showToast(`Automação: ${d.automacoes.map((a) => a.nome).join(' · ')}`, 'info', 7000);
    }
    const item = findOperationalItem(itemId);
    // Só redesenha a gaveta se for esta peça que está aberta. Chamado pela
    // tabela por grupo, um refetch por campo salvo seria ida à rede à toa.
    if (item && String(activeWorkspaceItemId) === String(itemId)) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), item);
    }
    if (alvo) alvo.disabled = false;
    return true;
  } catch (erro) {
    if (alvo) { alvo.disabled = false; alvo.value = anterior; }
    showToast(`Não foi possível salvar: ${erro.message}`, 'err', 7000);
    return false;
  }
}
