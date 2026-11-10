// vybe-notificacoes.js — o sino do painel.
//
// As automações por data avisam quem é responsável por uma entrega que vence
// amanhã, veicula hoje sem estar pronta, ou veiculou ontem e continua aberta.
// No Monday esses avisos iam por e-mail e ninguém lia. Aqui ficam onde a pessoa
// já está.
//
// O canal é um campo na tabela justamente para o WhatsApp entrar depois sem
// mexer nas regras que geram os avisos.

const NOTIFICACOES_API = '/api/painel?area=notificacoes';
const INTERVALO_NOTIFICACOES = 5 * 60 * 1000;

let notificacoes = [];
let notificacoesAbertas = false;
let notificacoesNaoLidas = 0; // total real (a lista traz no máximo 100)
let notificacoesVistas = null; // ids da última leitura (null: ainda não leu; a primeira leitura não avisa)

// Até dois avisos curtos por leitura; o resto fica no sino. Menção mostra a frase e leva direto à peça.
function avisarNotificacoesNovas(novas) {
  if (typeof mostrarAvisoCurto !== 'function' || !novas.length) return;
  for (const n of novas.slice(0, 2)) {
    const mencao = /mencion/i.test(n.texto || '');
    const acoes = [];
    if (n.conteudo_id) acoes.push({ rotulo: 'Abrir a peça', principal: true, fazer: () => abrirDoNotificacao(n.id, n.conteudo_id) });
    acoes.push({ rotulo: 'Ver avisos', fazer: () => document.querySelector('[data-ferr="avisos"]')?.click() });
    mostrarAvisoCurto({ chave: 'notif:' + n.id, icone: mencao ? 'mencao' : 'sino', titulo: n.conteudo_nome || (mencao ? 'Mencionaram você' : 'Aviso novo'), frase: n.texto || '', acoes, tempo: mencao ? 12000 : 8000 });
  }
  if (novas.length > 2) mostrarAvisoCurto({ chave: 'notif:mais', icone: 'sino', titulo: `Mais ${novas.length - 2} ${novas.length - 2 === 1 ? 'aviso novo' : 'avisos novos'}`, frase: 'Estão no sino, no topo.', acoes: [{ rotulo: 'Ver avisos', fazer: () => document.querySelector('[data-ferr="avisos"]')?.click() }] });
}

async function carregarNotificacoes() {
  try {
    const resposta = await fetch(NOTIFICACOES_API, { credentials: 'same-origin' });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    const antes = notificacoesVistas;
    notificacoes = dados.notificacoes || [];
    notificacoesNaoLidas = dados.nao_lidas || 0;
    notificacoesVistas = new Set(notificacoes.map((n) => String(n.id)));
    // Aviso novo desde a última leitura vira um aviso curto no mundo (fase 3d), com a peça a um clique.
    if (antes) avisarNotificacoesNovas(notificacoes.filter((n) => !n.lida_em && !antes.has(String(n.id))));
    pintarSino(notificacoesNaoLidas);
    if (notificacoesAbertas) pintarListaNotificacoes();
    if (typeof escritorioAvisos === 'function') escritorioAvisos(notificacoes);
  } catch { /* sino ausente não pode atrapalhar o painel */ }
}

// O número no sino (84) competia com tudo na barra. Aviso novo vira um ponto,
// como no Mac; a quantidade continua no nome do botão, para quem usa leitor de
// tela e para quem para o mouse em cima.
function pintarSino(naoLidas) {
  const marca = document.getElementById('notif-contador');
  const sino = document.getElementById('notif-sino');
  const rotulo = naoLidas ? `Avisos · ${naoLidas} não ${naoLidas === 1 ? 'lido' : 'lidos'}` : 'Avisos';
  if (sino) { sino.setAttribute('aria-label', rotulo); sino.title = rotulo; }
  if (!marca) return;
  marca.textContent = '';
  marca.classList.add('ponto');
  marca.style.display = naoLidas ? 'flex' : 'none';
}

function quandoFoi(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 60) return `${Math.max(minutos, 0)} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h`;
  return `${Math.floor(minutos / 1440)} d`;
}

// Abas do sino: Todos ou só os não lidos (a lista é a mesma, o filtro é na tela).
let AVISOS_SO_NAO_LIDOS = false;
function filtrarAvisos(botao, soNaoLidos) {
  AVISOS_SO_NAO_LIDOS = soNaoLidos;
  botao.parentElement.querySelectorAll('button').forEach((b) => { const on = b === botao; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  pintarListaNotificacoes();
}
function pintarListaNotificacoes() {
  const lista = document.getElementById('notif-lista');
  if (!lista) return;
  if (!notificacoes.length) {
    lista.innerHTML = '<div class="notif-vazio">Nada por aqui. Quando uma entrega sua estiver perto do prazo, o aviso aparece neste sino.</div>';
    document.getElementById('notif-caixa')?.classList.remove('tem-mais');
    return;
  }
  const visiveis = AVISOS_SO_NAO_LIDOS ? notificacoes.filter((n) => !n.lida_em) : notificacoes;
  if (!visiveis.length) { lista.innerHTML = '<div class="notif-vazio">Nenhum aviso não lido.</div>'; return; }
  lista.innerHTML = visiveis.map((n) => `
    <div class="notif-item ${n.lida_em ? '' : 'nao-lida'}" ${n.conteudo_id ? `onclick="abrirDoNotificacao('${n.id}','${n.conteudo_id}')"` : ''}>
      <div class="notif-texto">${safeText(n.texto)}</div>
      <div class="notif-meta">${safeText(n.conteudo_nome || '')}<span>${quandoFoi(n.criada_em)}</span></div>
    </div>`).join('');
  marcarSeTemMais(lista);
}

// O véu no pé só faz sentido quando existe algo abaixo dele. Sem esta checagem
// ele escurecia o último aviso mesmo com a lista inteira à vista, o que é
// justamente o efeito de "cortado" que a gente estava tentando tirar.
function marcarSeTemMais(lista) {
  const caixa = document.getElementById('notif-caixa');
  if (!caixa || !lista) return;
  const conferir = () => caixa.classList.toggle(
    'tem-mais', lista.scrollHeight - lista.clientHeight - lista.scrollTop > 4);
  requestAnimationFrame(conferir);
  lista.onscroll = conferir;
}

function alternarNotificacoes() {
  const caixa = document.getElementById('notif-caixa');
  if (!caixa) return;
  notificacoesAbertas = !notificacoesAbertas;
  caixa.style.display = notificacoesAbertas ? 'block' : 'none';
  if (notificacoesAbertas) { pintarListaNotificacoes(); carregarNotificacoes(); }
}

async function marcarNotificacoesLidas() {
  try {
    await fetch(NOTIFICACOES_API, { method: 'POST', credentials: 'same-origin' });
    notificacoes = notificacoes.map((n) => ({ ...n, lida_em: n.lida_em || new Date().toISOString() }));
    notificacoesNaoLidas = 0;
    pintarSino(0);
    pintarListaNotificacoes();
    if (typeof escritorioAvisos === 'function') escritorioAvisos(notificacoes);
  } catch { /* sem efeito visível se falhar */ }
}

// Abrir a peça é o motivo do aviso existir; marcar como lida é consequência.
// O id que abre o card é o do item, não o do conteúdo no banco — o painel indexa
// DADOS pelo id do item.
async function abrirDoNotificacao(id, itemId) {
  try {
    await fetch(`${NOTIFICACOES_API}&id=${encodeURIComponent(id)}`, { method: 'POST', credentials: 'same-origin' });
  } catch { /* segue mesmo assim */ }
  const alvo = notificacoes.find((n) => String(n.id) === String(id));
  if (alvo && !alvo.lida_em) notificacoesNaoLidas = Math.max(0, notificacoesNaoLidas - 1);
  if (alvo) alvo.lida_em = new Date().toISOString();
  pintarSino(notificacoesNaoLidas);
  pintarListaNotificacoes();
  if (typeof escritorioAvisos === 'function') escritorioAvisos(notificacoes);
  if (typeof openSearchItem === 'function') openSearchItem(itemId);
  // Do painel de avisos do mundo a caixa antiga está fechada: abrir a peça não a abre.
  if (notificacoesAbertas) alternarNotificacoes();
}

function iniciarNotificacoes() {
  carregarNotificacoes();
  setInterval(() => { if (typeof painelDeveConsultar !== 'function' || painelDeveConsultar()) carregarNotificacoes(); }, INTERVALO_NOTIFICACOES);
  addEventListener('vybe-retomou', () => carregarNotificacoes());
  document.addEventListener('click', (evento) => {
    if (!notificacoesAbertas) return;
    if (evento.target.closest('#notif-caixa') || evento.target.closest('#notif-sino')) return;
    alternarNotificacoes();
  });
}
