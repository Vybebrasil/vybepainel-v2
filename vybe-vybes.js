// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "é o nosso VYBES dentro lá, não uma interface nova").
// O cartão VYBES da tela de módulos abre a central de verdade (a que roda no PC do Paulo) com o crachá de quem está
// logado: Paulo, Vinícius, Ewerton e Deivid veem e agem; o resto só vê. Regras no servidor (server/vybes.js) e na central.
let vybesAbrindo = false;
async function chooseVybesMode(opcoes) {
  const pedido = typeof opcoes?.pedido === 'string' ? opcoes.pedido.slice(0, 400) : '';
  if (vybesAbrindo) return;
  vybesAbrindo = true;
  // A janela abre já no clique (senão o navegador bloqueia) e recebe o endereço quando o crachá chega.
  const janela = window.open('', 'vybes');
  try {
    const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'entrar' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || 'Não foi possível abrir o VYBES agora.');
    // Chamado da sala com a aba fechada: o pedido vai junto e a central atende ao abrir.
    const url = pedido ? d.url + (d.url.includes('?') ? '&' : '?') + 'pedido=' + encodeURIComponent(pedido) : d.url;
    if (janela) janela.location.href = url; else location.href = url;
    window.vybesOrigem = new URL(d.url).origin;
    // O Escritório pausa enquanto esta janela estiver aberta e em uso (mapaForaDeVista).
    window.vybesJanela = janela || null;
  } catch (erro) {
    if (janela) janela.close();
    showToast(erro.message, 'error', 6000);
  } finally { vybesAbrindo = false; }
}

// A linha de baixo do cartão: se a central está no ar e o que quem olha pode fazer nela. Só pergunta com a tela de
// módulos aberta, e no máximo a cada 2 min (o bot republica o túnel a cada 3). Sem resposta, a linha fica vazia.
let vybesConferidoEm = 0;
async function conferirCartaoVybes(forcar = false) {
  const cartao = document.getElementById('station-vybes'), linha = document.getElementById('metrica-vybes');
  const gate = document.getElementById('mode-gate');
  if (!cartao || !linha || !gate || getComputedStyle(gate).display === 'none' || document.hidden) return;
  if (!forcar && Date.now() - vybesConferidoEm < 120e3) return;
  vybesConferidoEm = Date.now();
  try {
    const r = await fetch('/api/painel?area=vybes', { credentials: 'same-origin' });
    if (!r.ok) throw new Error();
    const { noAr, agir } = await r.json();
    cartao.classList.toggle('fora', !noAr);
    linha.innerHTML = noAr ? `<b>Ao vivo</b><span>${agir ? 'você vê e pede ações' : 'você acompanha tudo'}</span>`
      : '<b>Fora do ar</b><span>volta quando o PC do Paulo ligar</span>';
  } catch { cartao.classList.remove('fora'); linha.textContent = ''; vybesConferidoEm = Date.now() - 105e3; } // tenta de novo em 15 s
}
setInterval(conferirCartaoVybes, 10e3);
document.addEventListener('visibilitychange', () => conferirCartaoVybes());
conferirCartaoVybes(true);

// O VYBES ouve pela sala (Paulo, 04/11/2026: "não devia ser 1 microfone só? pra inclusive se chamar da sala funcionar").
// Quem age no VYBES, na chamada do Escritório com o microfone ligado e com esta aba na frente, chama "Vybes, …": o
// reconhecimento de voz do próprio navegador (Paulo escolheu: rápido, sem custo) ouve a frase e ela vai para a aba do
// VYBES, que decide com as mesmas regras do microfone dela (despertar.js na central). Enquanto a sala ouve, a aba do VYBES
// não atende o próprio microfone: nada é feito duas vezes. Aba do VYBES fechada: um cartão abre com o pedido (o navegador
// não deixa abrir aba sem um clique). O boneco do VYBES aparece ao lado de quem chamou, só na tela de quem chamou.
const VYBES_NOME = /\b(?:v[iy]bes?|v[aá]ib(?:e|es|is)?|vai bes|jarvis|jarves)\b/i;
const vybesSala = { rec: null, ouvindo: false, querParar: false, bloqueado: false, conversaAte: 0, agir: null, agirEm: 0, aqui: 0, fala: null, cartao: null };
const vybesReconhecedor = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
async function vybesPodeAgir() {
  if (Date.now() - vybesSala.agirEm < 120e3) return vybesSala.agir;
  vybesSala.agirEm = Date.now();
  try { const r = await fetch('/api/painel?area=vybes', { credentials: 'same-origin' }); const d = r.ok ? await r.json() : {}; vybesSala.agir = Boolean(d.noAr && d.agir); }
  catch { vybesSala.agir = false; }
  return vybesSala.agir;
}
function vybesJanelaAberta() { return Boolean(window.vybesJanela && !window.vybesJanela.closed && window.vybesOrigem); }
function vybesAvisarJanela(ouvindo) { if (vybesJanelaAberta()) try { window.vybesJanela.postMessage({ tipo: 'vybes-sala', ouvindo }, window.vybesOrigem); } catch {} }
// O pedido vai para a aba aberta; sem confirmação dela em 2 s (fechada, de outra sessão), o cartão oferece abrir.
function vybesEnviar(texto) {
  vybesSala.aqui = Date.now();
  if (typeof atualizarPessoasEscritorio === 'function') atualizarPessoasEscritorio();
  if (!vybesJanelaAberta()) return vybesCartaoAbrir(texto);
  let ok = false; const recebeu = (e) => { if (e.source === window.vybesJanela && e.data?.tipo === 'vybes-recebi') ok = true; };
  addEventListener('message', recebeu);
  try { window.vybesJanela.postMessage({ tipo: 'vybes-pedido', texto }, window.vybesOrigem); } catch {}
  setTimeout(() => { removeEventListener('message', recebeu); if (!ok) vybesCartaoAbrir(texto); }, 2000);
}
function vybesCartaoAbrir(texto) {
  vybesSala.cartao?.remove();
  const c = document.createElement('div');
  c.className = 'vybes-chamado vb-jogo-cartao'; c.setAttribute('role', 'alertdialog'); c.setAttribute('aria-label', 'Abrir o VYBES');
  c.innerHTML = `<span class="vb-jogo-rotulo">VYBES · chamado da sala</span><p>“${safeText(texto.slice(0, 120))}”</p><div><button type="button" class="vb-jogo-botao" data-abrir>Abrir o VYBES com o pedido</button><button type="button" class="vybes-chamado-fechar" data-fechar aria-label="Fechar">×</button></div>`;
  c.querySelector('[data-abrir]').onclick = () => { c.remove(); chooseVybesMode({ pedido: texto }); };
  c.querySelector('[data-fechar]').onclick = () => c.remove();
  document.body.appendChild(c); vybesSala.cartao = c;
  setTimeout(() => { if (vybesSala.cartao === c) c.remove(); }, 45e3);
}
// Ligado só quando faz sentido: quem age, na chamada, microfone ligado, esta aba na frente.
async function vybesSalaConferir() {
  const Rec = vybesReconhecedor();
  const naChamada = typeof escritorio !== 'undefined' && escritorio.conectado && escritorio.chamada?.self?.audioEnabled;
  const quer = Boolean(Rec && !vybesSala.bloqueado && naChamada && document.visibilityState === 'visible' && await vybesPodeAgir());
  if (quer && !vybesSala.ouvindo) vybesSalaLigar(Rec);
  else if (!quer && vybesSala.ouvindo) vybesSalaDesligar();
  if (vybesSala.ouvindo) vybesAvisarJanela(true);
}
function vybesSalaLigar(Rec) {
  const rec = new Rec(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      const texto = String(e.results[i][0]?.transcript || '').trim(); if (!texto) continue;
      // Com o nome, ou logo depois de uma conversa com ele (a resposta "sim", "próximo"); o resto é conversa da sala.
      if (VYBES_NOME.test(texto) || Date.now() < vybesSala.conversaAte) { vybesSala.conversaAte = Date.now() + 30e3; vybesEnviar(texto); }
    }
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { vybesSala.bloqueado = true; if (typeof escritorioAviso === 'function') escritorioAviso('O navegador não deixou o VYBES ouvir pela sala.'); } };
  // O navegador encerra o reconhecimento depois de um silêncio: enquanto deve ouvir, ele volta.
  rec.onend = () => { if (vybesSala.rec !== rec) return; vybesSala.rec = null; vybesSala.ouvindo = false; if (!vybesSala.querParar && !vybesSala.bloqueado) setTimeout(vybesSalaConferir, 400); };
  try { rec.start(); } catch { return; }
  vybesSala.rec = rec; vybesSala.ouvindo = true; vybesSala.querParar = false;
  vybesAvisarJanela(true);
  if (typeof escritorioAviso === 'function' && !vybesSala.avisou) { vybesSala.avisou = true; escritorioAviso('VYBES ouvindo pela sala: diga “Vybes, …”.'); }
}
function vybesSalaDesligar() {
  vybesSala.querParar = true; const rec = vybesSala.rec; vybesSala.rec = null; vybesSala.ouvindo = false;
  try { rec?.stop(); } catch {}
  vybesAvisarJanela(false);
}
setInterval(vybesSalaConferir, 4000);
document.addEventListener('visibilitychange', () => vybesSalaConferir());
// O que o VYBES diz volta para o balão do boneco dele.
addEventListener('message', (e) => {
  if (!vybesJanelaAberta() || e.source !== window.vybesJanela || e.origin !== window.vybesOrigem) return;
  if (e.data?.tipo === 'vybes-fala' && typeof e.data.texto === 'string') {
    vybesSala.aqui = Date.now();
    if (typeof atualizarPessoasEscritorio === 'function') atualizarPessoasEscritorio();
    setTimeout(() => escritorio?.mapa?.balao?.('vybes', e.data.texto.slice(0, 140)), 60);
  }
});
// O boneco do VYBES: ao lado de quem chamou, por 45 s depois da última conversa (roupa roxa, a cor do VYBES).
const VYBES_FIGURA = 'hd-180-1.ch-255-92.lg-280-110.sh-305-62.hr-828-61';
function vybesNaSala() {
  if (typeof escritorio === 'undefined' || !escritorio.mapa || !escritorio.conectado || Date.now() - vybesSala.aqui > 45e3) return [];
  const de = escritorioPosicao(escritorio.perfil || {}), x0 = Math.round(de.x), y0 = Math.round(de.y);
  let pos = { x: x0 + 1, y: y0 };
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
    if (escritorio.mapa.assentoEm(x0 + dx, y0 + dy) !== undefined) continue;
    if (escritorio.mapa.caminho(de, { x: x0 + dx, y: y0 + dy }, escritorioEvitarNoCaminho)) { pos = { x: x0 + dx, y: y0 + dy }; break; }
  }
  return [{ id: 'vybes', nome: 'VYBES', perfil: { figura: VYBES_FIGURA }, status: 'disponivel', corStatus: '#a896ff', titulo: null, campeao: '',
    rotulo: 'VYBES · atendendo você', statusTexto: '', x: pos.x, y: pos.y, acao: 'std', mao: '', dir: undefined, local: false,
    aoPassar: null, aoClicar: () => { if (vybesJanelaAberta()) window.vybesJanela.focus(); else chooseVybesMode(); } }];
}
