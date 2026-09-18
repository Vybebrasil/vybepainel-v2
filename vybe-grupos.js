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
  const cores = (GRUPOS_DO_PAINEL.cores.length ? GRUPOS_DO_PAINEL.cores : Object.keys(NOMES_DAS_CORES));
  menu.innerHTML = `<div class="status-editor-head">${safeText(grupo.titulo)}</div>
    ${item('Renomear…', 'renomear')}
    <div class="grupo-menu-cores" role="group" aria-label="Cor do grupo">${cores.map((c) => `
      <button type="button" class="grupo-menu-cor${c === grupo.cor ? ' atual' : ''}" data-cor="${c}"
        style="--cor:${c}" aria-label="${NOMES_DAS_CORES[c] || c}${c === grupo.cor ? ' (atual)' : ''}"
        title="${NOMES_DAS_CORES[c] || c}"></button>`).join('')}</div>
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
    texto: `Entra logo abaixo de "${depoisDe.titulo}". A cor dá para trocar depois, no mesmo menu.`,
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
