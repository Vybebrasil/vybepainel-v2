// vybe-peca.js — o que se faz com a peça inteira: renomear, arquivar, mover.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global,
// mesma ordem de carregamento, mesmos nomes.
//
// Ações que valem para a peça toda, e não para um campo dela. Arquivar não
// apaga: a peça sai das listas e volta do Arquivo por quinze dias.
//
// Vêm junto podeAdministrar e podeVerMonday, que guardam justamente as ações
// destrutivas daqui. São gerais o bastante para um dia morarem com a sessão;
// ficam onde foram escritas até haver mais de um caso assim.

// Renomear no proprio titulo, e nao numa caixa por cima dele. A caixa do
// navegador tapava o cartao — quem estava renomeando perdia de vista a peca
// que estava renomeando — e ainda era a unica coisa branca num painel escuro.
//
// Uma implementacao so: a miniatura e a gaveta chamam a mesma funcao, passando
// o proprio elemento do titulo. Sem elemento (chamada de outro lugar) ela cai
// na caixa de pergunta do painel, que ao menos e do painel.
function renomearPeca(itemId, evento) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  const alvo = evento?.currentTarget;
  if (alvo && alvo.isConnected) return editarTituloNoLugar(alvo, itemId, item.nome || '');
  return renomearPelaCaixa(itemId, item.nome || '');
}

function editarTituloNoLugar(elemento, itemId, original) {
  if (elemento.dataset.editando === '1') return;
  elemento.dataset.editando = '1';
  elemento.classList.add('editando');
  // plaintext-only evita colar HTML formatado dentro do titulo; nem todo
  // navegador aceita, e ai vale o contenteditable comum.
  try { elemento.contentEditable = 'plaintext-only'; }
  catch { elemento.contentEditable = 'true'; }
  if (elemento.contentEditable !== 'plaintext-only') elemento.contentEditable = 'true';
  elemento.spellcheck = false;
  elemento.focus();
  const selecao = window.getSelection();
  const faixa = document.createRange();
  faixa.selectNodeContents(elemento);
  selecao.removeAllRanges();
  selecao.addRange(faixa);

  const encerrar = (salvar) => {
    if (elemento.dataset.editando !== '1') return;
    delete elemento.dataset.editando;
    elemento.classList.remove('editando');
    elemento.contentEditable = 'false';
    elemento.removeEventListener('keydown', tecla);
    elemento.removeEventListener('blur', aoSair);
    // Uma linha so: Enter salva, e colar texto com quebra nao pode virar
    // titulo de duas linhas.
    const texto = String(elemento.textContent || '').replace(/\s+/g, ' ').trim();
    if (!salvar || !texto || texto === original) { elemento.textContent = original; return; }
    elemento.textContent = texto;
    gravarNovoTitulo(itemId, texto, elemento, original);
  };
  const tecla = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); encerrar(true); }
    else if (e.key === 'Escape') { e.preventDefault(); encerrar(false); }
  };
  const aoSair = () => encerrar(true);
  elemento.addEventListener('keydown', tecla);
  elemento.addEventListener('blur', aoSair);
}

async function renomearPelaCaixa(itemId, original) {
  const novo = typeof perguntarNoPainel === 'function'
    ? await perguntarNoPainel({ titulo: 'Renomear a peça', confirmar: 'Salvar',
        campo: { valor: original, dica: 'Título da peça' } })
    : prompt('Novo título da peça:', original);
  if (novo === null) return;
  const limpo = String(novo).trim();
  if (!limpo || limpo === original) return;
  return gravarNovoTitulo(itemId, limpo);
}

async function gravarNovoTitulo(itemId, limpo, elemento, original) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'titulo', item: String(itemId), titulo: limpo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível renomear.');
    // Atualiza as listas em memória para o card não voltar com o nome antigo.
    [DADOS, DADOS_ALL].forEach((lista) => (lista || []).forEach((x) => {
      if (String(x.id) === String(itemId)) x.nome = limpo;
    }));
    saveProductionCache();
    showToast(String(d.replica_monday || '').startsWith('falhou')
      ? '✓ Renomeado no Vybe · o Monday não recebeu a cópia' : '✓ Renomeado', 'ok', 4000);
    renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), findOperationalItem(itemId) || item);
    redesenharAposMudanca('renome');
  } catch (erro) {
    // Falhou: o titulo volta ao que era na tela, para ninguem sair achando que
    // renomeou.
    if (elemento?.isConnected && original !== undefined) elemento.textContent = original;
    showToast(`Não foi possível renomear: ${erro.message}`, 'err', 7000);
  }
}

// Remover a peça. Sai das telas e vai para a lixeira do Monday; aqui a linha
// fica, com quem removeu e quando — histórico apagado não volta, e remover por
// engano é o motivo de a operação existir.
// Devolve true so quando a peca saiu de verdade. Quem chama da fila precisa
// saber: fechar a lista sem ter excluido nada seria mentir sobre o que houve.
async function removerPeca(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return false;
  // Uma caixa so, com o motivo dentro: eram duas janelas cinzas do navegador em
  // sequencia, e a segunda pedindo texto num prompt. Agora que apagar e de todo
  // o time, a pergunta pesa mais — e ela precisa parecer com o resto do painel.
  const motivo = await perguntarNoPainel({
    titulo: `Arquivar “${item.nome}”?`,
    texto: `Ela sai das listas e fica no arquivo por ${DIAS_NO_ARQUIVO} dias, de onde volta com um clique. Depois disso o caminho de volta é a lixeira do Monday.`,
    confirmar: 'Arquivar', perigo: true,
    campo: { valor: '', dica: 'Por que está arquivando? (opcional, fica no histórico)' },
  });
  if (motivo === null) return false;

  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'remover', item: String(itemId), motivo }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível remover.');
    // Solicitacoes vivem numa terceira lista. Sem tira-la de la, a atividade
    // sumia da tabela de Producao e continuava na de Demandas e no calendario.
    [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach((lista) => {
      const pos = (lista || []).findIndex((x) => String(x.id) === String(itemId));
      if (pos >= 0) lista.splice(pos, 1);
    });
    saveProductionCache();
    closeItemWorkspace();
    // O botao agora tambem vive no cartao rapido, que fica por cima do calendario.
    if (typeof fecharCartaoRapido === 'function') fecharCartaoRapido();
    redesenharAposMudanca('exclusão');
    // O arrependimento chega em segundos, nao em dias: o desfazer fica no proprio
    // aviso, sem obrigar ninguem a saber que existe uma tela de arquivo.
    mostrarDesfazerArquivamento(item);
    return true;
  } catch (erro) { showToast(`Não foi possível arquivar: ${erro.message}`, 'err', 7000); return false; }
}

const DIAS_NO_ARQUIVO = 15;

function mostrarDesfazerArquivamento(item) {
  return mostrarDesfazerArquivamentoEmLote([item]);
}

// Uma barra so, saiba ela de uma peca ou de vinte. Duas implementacoes acabariam
// divergindo — e a que ninguem testa e a que fica errada.
function mostrarDesfazerArquivamentoEmLote(pecas) {
  const lista = (pecas || []).filter(Boolean);
  if (!lista.length) return;
  document.getElementById('desfazer-arquivo')?.remove();
  const ids = lista.map((p) => String(p.id)).join(',');
  const dito = lista.length === 1
    ? `<b>${safeText(lista[0].nome)}</b> foi para o arquivo.`
    : `<b>${lista.length} atividades</b> foram para o arquivo.`;
  const barra = document.createElement('div');
  barra.id = 'desfazer-arquivo';
  barra.className = 'desfazer-arquivo';
  barra.innerHTML = `<span>${dito}</span>
    <button type="button" onclick="restaurarVarias('${safeText(ids)}',this)">Desfazer</button>
    <button type="button" class="fechar" onclick="this.parentElement.remove()" aria-label="Fechar">×</button>`;
  document.body.append(barra);
  // setTimeout e nao requestAnimationFrame: rAF nao dispara em aba fora de foco,
  // e quem arquiva costuma trocar de janela em seguida. A barra ficaria com
  // opacidade zero, some sozinha em 12s, e o desfazer nunca teria existido.
  setTimeout(() => barra.classList.add('aberta'), 0);
  setTimeout(() => barra.remove(), 12000);
}

// Desfaz um arquivamento inteiro. Recarrega os dados UMA vez no fim, e nao a
// cada peca: vinte recargas seguidas travariam a tela justamente quando alguem
// esta com pressa de consertar.
async function restaurarVarias(idsJuntos, botao) {
  const ids = String(idsJuntos || '').split(',').filter(Boolean);
  if (!ids.length) return;
  if (botao) { botao.disabled = true; botao.textContent = 'Voltando…'; }
  let ok = 0; const falhas = [];
  for (const id of ids) {
    try {
      const r = await fetch('/api/conteudo', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'restaurar', item: String(id) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`);
      ok += 1;
    } catch (erro) { falhas.push(id); console.warn('não voltou', id, erro); }
  }
  document.getElementById('desfazer-arquivo')?.remove();
  showToast(falhas.length
    ? `${ok} de volta · ${falhas.length} não deu`
    : `✓ ${ok === 1 ? 'Voltou' : `${ok} voltaram`} para as listas`, falhas.length ? 'info' : 'ok', 6000);
  if (typeof refreshData === 'function') await refreshData();
  if (document.getElementById('arquivadas-lista')) carregarArquivadas();
}

// Traz UMA peca de volta. Serve a lista do arquivo, onde cada linha tem o
// proprio botao — os dois caminhos falam com a mesma acao do servidor.
async function restaurarPeca(itemId, botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Voltando…'; }
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'restaurar', item: String(itemId) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível restaurar.');
    document.getElementById('desfazer-arquivo')?.remove();
    // A peca voltou no banco; a tela so sabe disso recarregando os dados.
    showToast(`✓ “${d.titulo || 'Atividade'}” voltou para as listas`, 'ok', 6000);
    if (typeof refreshData === 'function') await refreshData();
    if (document.getElementById('arquivadas-lista')) carregarArquivadas();
    return true;
  } catch (erro) {
    if (botao) { botao.disabled = false; botao.textContent = 'Desfazer'; }
    showToast(`Não foi possível restaurar: ${erro.message}`, 'err', 7000);
    return false;
  }
}

// Mover entre Produção e Demandas. Demandas nunca entrou no nosso banco — é lido
// direto do Monday — então esta é uma das poucas operações que ainda depende
// dele de verdade, e a peça sai das nossas telas ao ir para lá.
async function moverPecaDeBoard(itemId) {
  const item = findOperationalItem(itemId);
  if (!item) return;
  if (!confirm(`Mover “${item.nome}” para o board de Demandas?\n\nEla sai do painel de Produção. Demandas ainda é lido do Monday, então a peça passa a viver lá.`)) return;
  try {
    const r = await fetch('/api/conteudo', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'mover_board', item: String(itemId), destino: '8385559107' }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível mover.');
    [DADOS, DADOS_ALL].forEach((lista) => {
      const pos = (lista || []).findIndex((x) => String(x.id) === String(itemId));
      if (pos >= 0) lista.splice(pos, 1);
    });
    saveProductionCache();
    closeItemWorkspace();
    redesenharAposMudanca('mudança de board');
    showToast(`✓ Movida para ${d.para}. ${d.aviso || ''}`, 'ok', 7000);
  } catch (erro) { showToast(`Não foi possível mover: ${erro.message}`, 'err', 7000); }
}

// Quem administra. Sobrou para o que muda a operacao de outras pessoas — mover
// uma peca de quadro, mexer no cadastro de clientes, nas etiquetas. Excluir
// peca SAIU daqui em 01/09/2026: quem cria e quem descobre que nasceu errada, e
// esperar um administrador para limpar a propria bagunca custava mais que o
// risco de um engano que a lixeira desfaz.
//
// Existia so o podeVerMonday, e ele deixou de significar "e administrador":
// passou a exigir tambem a chave de contingencia do Monday, ligada a mao num
// incidente. Como os botoes de excluir estavam pendurados nele, sumiram da tela
// de todo mundo — inclusive de quem administra. Quem e do Monday continua no
// portao do Monday; o resto vem para ca.
function podeAdministrar() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

function podeVerMonday() {
  if (!(typeof sessaoAtual === 'function' && sessaoAtual()?.admin)) return false;
  try { return localStorage.getItem('vybe_monday_contingency_ui_v1') === 'ativa'; }
  catch { return false; }
}
