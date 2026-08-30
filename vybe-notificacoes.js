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

async function carregarNotificacoes() {
  try {
    const resposta = await fetch(NOTIFICACOES_API, { credentials: 'same-origin' });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    notificacoes = dados.notificacoes || [];
    pintarSino(dados.nao_lidas || 0);
    if (notificacoesAbertas) pintarListaNotificacoes();
  } catch { /* sino ausente não pode atrapalhar o painel */ }
}

function pintarSino(naoLidas) {
  const marca = document.getElementById('notif-contador');
  if (!marca) return;
  marca.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
  marca.style.display = naoLidas ? 'flex' : 'none';
}

function quandoFoi(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 60) return `${Math.max(minutos, 0)} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h`;
  return `${Math.floor(minutos / 1440)} d`;
}

function pintarListaNotificacoes() {
  const lista = document.getElementById('notif-lista');
  if (!lista) return;
  if (!notificacoes.length) {
    lista.innerHTML = '<div class="notif-vazio">Nada por aqui. Quando uma entrega sua estiver perto do prazo, o aviso aparece neste sino.</div>';
    document.getElementById('notif-caixa')?.classList.remove('tem-mais');
    return;
  }
  lista.innerHTML = notificacoes.map((n) => `
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
    pintarSino(0);
    pintarListaNotificacoes();
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
  if (alvo) alvo.lida_em = new Date().toISOString();
  pintarSino(notificacoes.filter((n) => !n.lida_em).length);
  pintarListaNotificacoes();
  if (typeof openSearchItem === 'function') openSearchItem(itemId);
  alternarNotificacoes();
}

function iniciarNotificacoes() {
  carregarNotificacoes();
  setInterval(carregarNotificacoes, INTERVALO_NOTIFICACOES);
  document.addEventListener('click', (evento) => {
    if (!notificacoesAbertas) return;
    if (evento.target.closest('#notif-caixa') || evento.target.closest('#notif-sino')) return;
    alternarNotificacoes();
  });
}
