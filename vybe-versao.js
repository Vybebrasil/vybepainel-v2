// vybe-versao.js — mantém todo mundo na versão publicada.
//
// O index.html já é revalidado a cada carga, mas quem deixa a aba aberta por
// dias (ou o navegador que restaura a aba) continua com o código antigo: era o
// "abre e fica preto" e o "não aparece o ícone Clientes". O build grava a
// versão em /versao.json; aqui conferimos de tempos em tempos e ao voltar para
// a aba. Versão nova: recarrega sozinho se ninguém está no meio de algo
// (conversa por voz, formulário aberto, editor do mapa); senão mostra um aviso
// com o botão Atualizar.
const VERSAO_PAINEL = document.querySelector('meta[name="vybe-versao"]')?.content || '';
let versaoAvisada = false;

function painelOcupado() {
  const esc = typeof escritorio !== 'undefined' ? escritorio : null;
  if (esc?.chamada || esc?.edicao) return true;
  if (document.querySelector('.workflow-modal, #ofc-abertura .cri, dialog[open]')) return true;
  const foco = document.activeElement;
  return Boolean(foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) && foco.value);
}

function avisarVersaoNova() {
  if (versaoAvisada) return;
  versaoAvisada = true;
  const aviso = document.createElement('div');
  aviso.className = 'versao-nova';
  aviso.setAttribute('role', 'status');
  aviso.innerHTML = '<span>Saiu uma versão nova do painel.</span><button type="button" onclick="location.reload()">Atualizar agora</button>';
  document.body.append(aviso);
}

async function conferirVersaoPainel() {
  if (!VERSAO_PAINEL) return; // ambiente local, sem build
  try {
    const r = await fetch('/versao.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const { versao } = await r.json();
    if (!versao || versao === VERSAO_PAINEL) return;
    if (document.visibilityState === 'hidden' || !painelOcupado()) location.reload();
    else avisarVersaoNova();
  } catch { /* sem rede: tenta de novo depois */ }
}

if (typeof document.addEventListener === 'function') {
  setInterval(() => { if (typeof painelDeveConsultar !== 'function' || painelDeveConsultar()) conferirVersaoPainel(); }, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferirVersaoPainel(); });
  setTimeout(conferirVersaoPainel, 15000);
}
