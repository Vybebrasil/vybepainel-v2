// vybe-grupos.js — os grupos de cada quadro vêm do banco, e quem administra
// cria, renomeia, troca a cor, reordena e apaga pelo próprio painel.
//
// Nome, cor e ordem estavam escritos em oito lugares do código (visão por grupo,
// Solicitações, cadastro, ficha, automações). Em vez de reescrever cada tela,
// este arquivo lê a lista do servidor e atualiza essas MESMAS estruturas no
// lugar — as telas continuam lendo de onde sempre leram, e deixam de discordar
// entre si. Sem resposta do servidor, fica o que já estava no código.

const GRUPOS_DO_PAINEL = { lista: [], cores: [], pronto: false, carregado: false, carregando: null };

const QUADRO_ID = () => ({ producao: typeof BOARD_ID !== 'undefined' ? BOARD_ID : 7829537690,
  demandas: typeof BOARD_DEMANDAS_ID !== 'undefined' ? BOARD_DEMANDAS_ID : 8385559107 });
const quadroDoBoard = (boardId) => (Number(boardId) === Number(QUADRO_ID().demandas) ? 'demandas' : 'producao');

// Nomes das cores para o leitor de tela e para quem passa o mouse: a cor sozinha
// não diz nada a quem não a vê.
const NOMES_DAS_CORES = {
  '#579bfc': 'Azul', '#66ccff': 'Azul-claro', '#a25ddc': 'Roxo', '#9d50dd': 'Violeta',
  '#ff5ac4': 'Rosa', '#e2445c': 'Vermelho', '#ff642e': 'Laranja', '#fdab3d': 'Amarelo',
  '#cab641': 'Mostarda', '#00c875': 'Verde', '#037f4c': 'Verde-escuro', '#7c8797': 'Cinza',
};

function gruposDoQuadroNaTela(quadro) {
  const board = Number(QUADRO_ID()[quadro]);
  return GRUPOS_DO_PAINEL.lista.filter((g) => Number(g.board_id) === board);
}

// Usado pelo cadastro (FC_QUADROS): a lista de grupos para escolher o destino.
function gruposParaCadastro(quadro) {
  const lista = gruposDoQuadroNaTela(quadro);
  return lista.length ? lista.map((g) => ({ val: g.grupo_id, label: g.titulo })) : null;
}

function substituirNoLugar(lista, novos) {
  if (!Array.isArray(lista)) return;
  lista.splice(0, lista.length, ...novos);
}

function aplicarGruposNaTela(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  GRUPOS_DO_PAINEL.lista = lista;
  const producao = gruposDoQuadroNaTela('producao');
  const demandas = gruposDoQuadroNaTela('demandas');

  if (typeof ORDEM_DOS_GRUPOS !== 'undefined') substituirNoLugar(ORDEM_DOS_GRUPOS, producao.map((g) => g.grupo_id));
  if (typeof GRUPOS_DE_DEMANDAS !== 'undefined') substituirNoLugar(GRUPOS_DE_DEMANDAS, demandas.map((g) => g.grupo_id));
  if (typeof DEMANDAS_GROUP_ORDER !== 'undefined') substituirNoLugar(DEMANDAS_GROUP_ORDER, demandas.map((g) => g.titulo));
  if (typeof GRUPOS_DA_PRODUCAO !== 'undefined') substituirNoLugar(GRUPOS_DA_PRODUCAO, producao.map((g) => [g.grupo_id, g.titulo]));
  producao.forEach((g) => {
    if (typeof CORES_DOS_GRUPOS !== 'undefined') CORES_DOS_GRUPOS[g.grupo_id] = g.cor;
    if (typeof GROUP_MAP !== 'undefined') GROUP_MAP[g.grupo_id] = g.titulo;
    if (typeof GRUPOS_NOME !== 'undefined') GRUPOS_NOME[g.grupo_id] = g.titulo;
  });
  demandas.forEach((g) => {
    if (typeof CORES_GRUPOS_DEMANDAS !== 'undefined') CORES_GRUPOS_DEMANDAS[g.grupo_id] = g.cor;
    if (typeof DEMANDAS_GROUP_MAP !== 'undefined') DEMANDAS_GROUP_MAP[g.grupo_id] = g.titulo;
  });
  lista.forEach((g) => { if (typeof TITULO_DOS_GRUPOS !== 'undefined') TITULO_DOS_GRUPOS[g.grupo_id] = g.titulo; });

  // O nome do grupo também foi copiado para cada atividade na leitura. Sem
  // refazer aqui, a tabela mudava o cabeçalho e as linhas diziam o nome antigo.
  const nomeDe = new Map(lista.map((g) => [g.grupo_id, g.titulo]));
  const listas = [typeof DADOS !== 'undefined' ? DADOS : [], typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : [],
    typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []];
  listas.forEach((itens) => (itens || []).forEach((item) => {
    const nome = nomeDe.get(String(item.group_id || ''));
    if (nome) item.grupo = nome;
  }));
}

function redesenharGrupos() {
  if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
  if (typeof renderDemandas === 'function' && typeof activeBoard !== 'undefined' && activeBoard === 'demandas') renderDemandas();
}

async function carregarGruposDoPainel({ forcar = false } = {}) {
  if (GRUPOS_DO_PAINEL.carregando) return GRUPOS_DO_PAINEL.carregando;
  if (GRUPOS_DO_PAINEL.carregado && !forcar) return GRUPOS_DO_PAINEL;
  GRUPOS_DO_PAINEL.carregando = (async () => {
    try {
      const r = await fetch('/api/painel?area=grupos', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(d.grupos)) return GRUPOS_DO_PAINEL;
      GRUPOS_DO_PAINEL.pronto = Boolean(d.pronto);
      GRUPOS_DO_PAINEL.cores = Array.isArray(d.cores) ? d.cores : [];
      GRUPOS_DO_PAINEL.carregado = true;
      aplicarGruposNaTela(d.grupos);
      redesenharGrupos();
    } catch { /* sem rede: ficam os grupos que já estavam na tela */ }
    finally { GRUPOS_DO_PAINEL.carregando = null; }
    return GRUPOS_DO_PAINEL;
  })();
  return GRUPOS_DO_PAINEL.carregando;
}

// A visão por grupo chama isto ao desenhar: a primeira vez busca a lista, e as
// seguintes não fazem nada.
function garantirGruposDoPainel() {
  if (!GRUPOS_DO_PAINEL.carregado && !GRUPOS_DO_PAINEL.carregando) carregarGruposDoPainel();
}

// ── Menu do grupo ──────────────────────────────────────────────────────────────
function podeEditarGrupos() {
  return typeof podeAdministrar === 'function' && podeAdministrar();
}

function botaoDoMenuDoGrupo(quadro, grupoId, nome) {
  if (!podeEditarGrupos() || !gruposDoQuadroNaTela(quadro).some((g) => g.grupo_id === grupoId)) return '';
  return `<button type="button" class="grupo-menu-btn" onclick="abrirMenuDoGrupo(event,'${quadro}','${safeText(grupoId)}')"
    aria-label="Opções do grupo ${safeText(nome)}" aria-haspopup="menu" title="Renomear, cor, ordem">
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg></button>`;
}

function paletaDoGrupoHtml(grupo) {
  const cores = GRUPOS_DO_PAINEL.cores.length ? GRUPOS_DO_PAINEL.cores : Object.keys(NOMES_DAS_CORES);
  return `<div class="grupo-menu-cores" role="group" aria-label="Cor do grupo">${cores.map((c) => `
      <button type="button" class="grupo-menu-cor${c === grupo.cor ? ' atual' : ''}" data-cor="${c}"
        style="--cor:${c}" aria-label="${NOMES_DAS_CORES[c] || c}${c === grupo.cor ? ' (atual)' : ''}"
        title="${NOMES_DAS_CORES[c] || c}"></button>`).join('')}</div>`;
}

function fecharMenuDoGrupo() {
  document.getElementById('grupo-menu-fundo')?.remove();
  document.getElementById('grupo-menu')?.remove();
}

function abrirMenuDoGrupo(event, quadro, grupoId) {
  event.preventDefault();
  event.stopPropagation();
  fecharMenuDoGrupo();
  const grupos = gruposDoQuadroNaTela(quadro);
  const i = grupos.findIndex((g) => g.grupo_id === grupoId);
  const grupo = grupos[i];
  if (!grupo) return;
  const origem = event.currentTarget;
  const rect = origem.getBoundingClientRect();
  const fundo = document.createElement('div');
  fundo.id = 'grupo-menu-fundo';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharMenuDoGrupo;
  const menu = document.createElement('div');
  menu.id = 'grupo-menu';
  menu.className = 'status-editor grupo-menu';
  menu.setAttribute('role', 'menu');
  const item = (rotulo, acao, { desligado = false, perigo = false } = {}) =>
    `<button type="button" role="menuitem" class="status-editor-option${perigo ? ' perigo' : ''}" data-acao="${acao}" ${desligado ? 'disabled' : ''}>${rotulo}</button>`;
  menu.innerHTML = `<div class="status-editor-head">${safeText(grupo.titulo)}</div>
    ${item('Renomear…', 'renomear')}
    ${paletaDoGrupoHtml(grupo)}
    ${item('Mover para cima', 'subir', { desligado: i === 0 })}
    ${item('Mover para baixo', 'descer', { desligado: i === grupos.length - 1 })}
    ${item('Novo grupo abaixo…', 'novo')}
    ${item('Apagar grupo…', 'apagar', { perigo: true })}`;
  menu.onclick = (e) => {
    const cor = e.target.closest('[data-cor]')?.dataset.cor;
    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!cor && !acao) return;
    fecharMenuDoGrupo();
    if (cor) return void (cor !== grupo.cor && mudarGrupo(quadro, { acao: 'editar', grupo_id: grupoId, cor }, 'Cor do grupo trocada.'));
    if (acao === 'renomear') return void renomearGrupo(quadro, grupo);
    if (acao === 'subir' || acao === 'descer') {
      return void mudarGrupo(quadro, { acao: 'mover', grupo_id: grupoId, direcao: acao === 'subir' ? -1 : 1 }, null);
    }
    if (acao === 'novo') return void novoGrupo(quadro, grupo);
    if (acao === 'apagar') return void apagarGrupoDoQuadro(quadro, grupo);
  };
  menu.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); fecharMenuDoGrupo(); origem.focus(); } };
  document.body.append(fundo, menu);
  if (typeof ancorarPopover === 'function') ancorarPopover(menu, rect);
  menu.querySelector('button:not([disabled])')?.focus();
}

async function mudarGrupo(quadro, corpo, aviso) {
  try {
    const r = await fetch('/api/painel?area=grupos', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: QUADRO_ID()[quadro], ...corpo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Não foi possível salvar (${r.status}).`);
    aplicarGruposNaTela(d.grupos);
    redesenharGrupos();
    if (aviso) showToast(aviso, 'ok', 3000);
    return d.resultado;
  } catch (erro) {
    showToast(erro.message, 'err', 7000);
    return null;
  }
}

async function renomearGrupo(quadro, grupo) {
  const nome = await perguntarNoPainel({ titulo: 'Renomear grupo', confirmar: 'Renomear',
    texto: 'As atividades continuam no grupo; só o nome muda.',
    campo: { valor: grupo.titulo, dica: 'Nome do grupo' } });
  if (!nome || nome === grupo.titulo) return;
  await mudarGrupo(quadro, { acao: 'editar', grupo_id: grupo.grupo_id, titulo: nome }, `Grupo renomeado para "${nome}".`);
}

async function novoGrupo(quadro, depoisDe) {
  const nome = await perguntarNoPainel({ titulo: 'Novo grupo', confirmar: 'Criar grupo',
    texto: `Entra logo abaixo de "${depoisDe.titulo}". A cor dá para trocar depois, clicando na faixa colorida à esquerda do grupo.`,
    campo: { valor: '', dica: 'Nome do grupo' } });
  if (!nome) return;
  // Uma cor que o quadro ainda não usa, para o grupo novo não se confundir com
  // o vizinho.
  const usadas = new Set(gruposDoQuadroNaTela(quadro).map((g) => g.cor));
  const cores = GRUPOS_DO_PAINEL.cores.length ? GRUPOS_DO_PAINEL.cores : Object.keys(NOMES_DAS_CORES);
  const cor = cores.find((c) => !usadas.has(c)) || '#7c8797';
  await mudarGrupo(quadro, { acao: 'criar', titulo: nome, cor, depois_de: depoisDe.grupo_id }, `Grupo "${nome}" criado.`);
}

async function apagarGrupoDoQuadro(quadro, grupo) {
  const ok = await perguntarNoPainel({ titulo: `Apagar "${grupo.titulo}"?`, confirmar: 'Apagar grupo', perigo: true,
    texto: 'Só dá para apagar grupo vazio. Se houver atividades nele, mova-as antes para outro grupo.' });
  if (!ok) return;
  await mudarGrupo(quadro, { acao: 'apagar', grupo_id: grupo.grupo_id }, `Grupo "${grupo.titulo}" apagado.`);
}

// ── Direto na lista: faixa de cor, alça de arrastar, novo grupo no fim ──────────
// O menu ⋯ fazia tudo, mas escondido. Quem arruma o quadro quer mexer onde vê:
// a faixa colorida troca a cor, a alça muda a ordem, o fim da lista cria grupo.
function grupoEditavelNaTela(quadro, grupoId) {
  return podeEditarGrupos() && gruposDoQuadroNaTela(quadro).some((g) => g.grupo_id === grupoId);
}

function controlesDoGrupo(quadro, grupoId, nome) {
  if (!grupoEditavelNaTela(quadro, grupoId)) return '';
  const id = safeText(grupoId);
  return `<button type="button" class="grupo-cor-btn" onclick="abrirPaletaDoGrupo(event,'${quadro}','${id}')"
      aria-label="Trocar a cor do grupo ${safeText(nome)}" title="Trocar cor"></button>
    <button type="button" class="grupo-alca" draggable="true" data-alca-grupo="${id}" data-quadro="${quadro}"
      onkeydown="teclaNaAlcaDoGrupo(event,'${quadro}','${id}')"
      aria-label="Mover o grupo ${safeText(nome)}: arraste, ou use as setas para cima e para baixo"
      title="Arraste para mudar a ordem"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
      <circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/>
      <circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/></svg></button>`;
}

function botaoNovoGrupoNoFim(quadro) {
  if (!podeEditarGrupos() || !gruposDoQuadroNaTela(quadro).length) return '';
  return `<button type="button" class="grupo-novo-fim" onclick="novoGrupoNoFim('${quadro}')">+ Novo grupo</button>`;
}

function novoGrupoNoFim(quadro) {
  const grupos = gruposDoQuadroNaTela(quadro);
  if (grupos.length) novoGrupo(quadro, grupos[grupos.length - 1]);
}

function renomearGrupoPeloNome(event, quadro, grupoId) {
  if (!grupoEditavelNaTela(quadro, grupoId)) return;
  event.preventDefault();
  event.stopPropagation();
  const grupo = gruposDoQuadroNaTela(quadro).find((g) => g.grupo_id === grupoId);
  if (grupo) renomearGrupo(quadro, grupo);
}

function abrirPaletaDoGrupo(event, quadro, grupoId) {
  event.preventDefault();
  event.stopPropagation();
  fecharMenuDoGrupo();
  const grupo = gruposDoQuadroNaTela(quadro).find((g) => g.grupo_id === grupoId);
  if (!grupo) return;
  const origem = event.currentTarget;
  const fundo = document.createElement('div');
  fundo.id = 'grupo-menu-fundo';
  fundo.className = 'status-editor-backdrop';
  fundo.onclick = fecharMenuDoGrupo;
  const menu = document.createElement('div');
  menu.id = 'grupo-menu';
  menu.className = 'status-editor grupo-menu';
  menu.innerHTML = `<div class="status-editor-head">Cor de ${safeText(grupo.titulo)}</div>${paletaDoGrupoHtml(grupo)}`;
  menu.onclick = (e) => {
    const cor = e.target.closest('[data-cor]')?.dataset.cor;
    if (!cor) return;
    fecharMenuDoGrupo();
    if (cor !== grupo.cor) mudarGrupo(quadro, { acao: 'editar', grupo_id: grupoId, cor }, null);
    origem.focus?.();
  };
  menu.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); fecharMenuDoGrupo(); origem.focus(); } };
  document.body.append(fundo, menu);
  if (typeof ancorarPopover === 'function') ancorarPopover(menu, origem.getBoundingClientRect());
  menu.querySelector('.grupo-menu-cor.atual, .grupo-menu-cor')?.focus();
}

async function teclaNaAlcaDoGrupo(event, quadro, grupoId) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  const ids = gruposDoQuadroNaTela(quadro).map((g) => g.grupo_id);
  const i = ids.indexOf(grupoId);
  const j = i + (event.key === 'ArrowUp' ? -1 : 1);
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await reordenarGrupos(quadro, ids);
  document.querySelector(`[data-alca-grupo="${grupoId}"]`)?.focus();
}

// A tela muda na hora (quem arrasta espera ver o grupo onde soltou) e volta se
// o servidor recusar — nunca fica mostrando uma ordem que não foi gravada.
async function reordenarGrupos(quadro, ids) {
  const antes = GRUPOS_DO_PAINEL.lista.map((g) => ({ ...g }));
  const board = Number(QUADRO_ID()[quadro]);
  const posicao = new Map(ids.map((id, k) => [id, k + 1]));
  const nova = antes.map((g) => (Number(g.board_id) === board && posicao.has(g.grupo_id)
    ? { ...g, ordem: posicao.get(g.grupo_id) } : g))
    .sort((a, b) => Number(a.board_id) - Number(b.board_id) || a.ordem - b.ordem);
  aplicarGruposNaTela(nova);
  redesenharGrupos();
  const ok = await mudarGrupo(quadro, { acao: 'ordenar', ordem: ids }, null);
  if (!ok) { aplicarGruposNaTela(antes); redesenharGrupos(); }
}

const ARRASTO_DE_GRUPO = { quadro: '', id: '' };
function limparMarcasDeArrasto() {
  document.querySelectorAll('.grupo-bloco.soltar-antes, .grupo-bloco.soltar-depois, .grupo-bloco.arrastando')
    .forEach((el) => el.classList.remove('soltar-antes', 'soltar-depois', 'arrastando'));
}
function blocoDeDestino(event) {
  const bloco = event.target.closest?.('.grupo-bloco[data-grupo]');
  if (!bloco || !ARRASTO_DE_GRUPO.id || bloco.dataset.quadro !== ARRASTO_DE_GRUPO.quadro) return null;
  if (!gruposDoQuadroNaTela(ARRASTO_DE_GRUPO.quadro).some((g) => g.grupo_id === bloco.dataset.grupo)) return null;
  const r = bloco.getBoundingClientRect();
  // Recolhido, o bloco é só o cabeçalho; aberto, a metade de cima do cabeçalho
  // já conta como "antes" — medir pelo bloco inteiro exigiria arrastar até o
  // meio de uma tabela de cinquenta linhas.
  const cabeca = bloco.querySelector('.grupo-cabecalho')?.getBoundingClientRect() || r;
  const antes = event.clientY < cabeca.top + cabeca.height / 2;
  return { bloco, antes };
}
document.addEventListener('dragstart', (event) => {
  const alca = event.target.closest?.('.grupo-alca');
  if (!alca) return;
  ARRASTO_DE_GRUPO.quadro = alca.dataset.quadro;
  ARRASTO_DE_GRUPO.id = alca.dataset.alcaGrupo;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', ARRASTO_DE_GRUPO.id);
  const bloco = alca.closest('.grupo-bloco');
  const cabecalho = bloco?.querySelector('.grupo-cabecalho');
  if (cabecalho) event.dataTransfer.setDragImage(cabecalho, 24, 20);
  requestAnimationFrame(() => bloco?.classList.add('arrastando'));
});
document.addEventListener('dragover', (event) => {
  const alvo = blocoDeDestino(event);
  if (!alvo) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.grupo-bloco.soltar-antes, .grupo-bloco.soltar-depois').forEach((el) => {
    if (el !== alvo.bloco) el.classList.remove('soltar-antes', 'soltar-depois');
  });
  alvo.bloco.classList.toggle('soltar-antes', alvo.antes);
  alvo.bloco.classList.toggle('soltar-depois', !alvo.antes);
});
document.addEventListener('drop', (event) => {
  const alvo = blocoDeDestino(event);
  if (!alvo) return;
  event.preventDefault();
  const { quadro, id } = ARRASTO_DE_GRUPO;
  limparMarcasDeArrasto();
  const atuais = gruposDoQuadroNaTela(quadro).map((g) => g.grupo_id);
  const ids = atuais.filter((x) => x !== id);
  const k = ids.indexOf(alvo.bloco.dataset.grupo);
  if (k < 0) return;
  ids.splice(alvo.antes ? k : k + 1, 0, id);
  if (ids.join('|') !== atuais.join('|')) reordenarGrupos(quadro, ids);
});
document.addEventListener('dragend', () => {
  ARRASTO_DE_GRUPO.quadro = '';
  ARRASTO_DE_GRUPO.id = '';
  limparMarcasDeArrasto();
});
