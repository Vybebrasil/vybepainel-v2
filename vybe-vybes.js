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
// não atende o próprio microfone: nada é feito duas vezes. Aba do VYBES fechada: o ser aparece e fala (tocar nele abre; o navegador
// não deixa abrir aba sem um clique). O boneco do VYBES aparece ao lado de quem chamou, só na tela de quem chamou.
// O nome como a transcrição escreve: a mesma lista que o Paulo ensinou ao VYBES (NOMES_FALADOS em chamadas.js, na
// central). Mudou lá, muda aqui. As trocas de nomes de clientes ("copy recê") a central corrige ao receber o pedido.
const VYBES_NOME = /\b(?:jarvis|jarves|v[iy]bes?|v[aá]ib(?:e|es|is|io)?|v[aá]ipe|vibi|vai\s?bes?)\b/i;
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
// Central fechada (Paulo, 04/11/2026: "apareceu só a mensagem… o VYBES não deveria falar? ser prestativo?… no lugar do
// box, o ser bonito no meio da tela"): o ser aparece no meio da tela e responde na voz do VYBES (áudios gerados da
// SALA de core/frases.js, em assets/vybes-fala). Com pergunta, ele responde ali mesmo (perguntarVybes, a central pelo túnel).
// Tocar nele abre a central, já com o pedido quando houve um; "sim"
// lembra que é só tocar (o navegador não abre aba pela voz); "não" o dispensa. Some sozinho em 25 s.
let vybesFalas = null;
async function vybesFalar(tipo) {
  try {
    // A lista é sempre reconferida (/assets fica guardado por um ano); os áudios têm a impressão do texto no nome.
    vybesFalas ||= await fetch('/assets/vybes-fala/falas.json', { cache: 'no-cache' }).then((r) => r.json());
    const lista = vybesFalas[tipo] || []; if (!lista.length) return null;
    const f = lista[Math.floor(Math.random() * lista.length)];
    const a = new Audio('/assets/vybes-fala/' + f.arquivo);
    vybesSala.fala?.pause(); vybesSala.fala = a;
    // Enquanto ele fala, o que o microfone ouve é a voz dele: não vira pedido.
    vybesSala.falandoAte = Date.now() + 6000;
    a.onended = () => { vybesSala.falandoAte = Date.now() + 300; vybesSala.serEl?.classList.remove('falando'); };
    vybesSala.serEl?.classList.add('falando');
    a.play().catch(() => { vybesSala.serEl?.classList.remove('falando'); });
    return f.texto;
  } catch { return null; }
}
// O que sobra da frase sem o nome, a saudação e o chamado ("bora", "acorda"): vazio é só chamado; o resto é pedido.
const vybesResto = (t) => String(t).replace(new RegExp(VYBES_NOME.source, 'gi'), ' ').replace(/\b(?:oi|ei|ola|olá|e a[ií]|fala|bom dia|boa tarde|boa noite|bora|acorda|vamos|simbora|pai|porra|desgra[cç]a)\b/gi, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function vybesSerFechar() {
  const el = vybesSala.serEl; vybesSala.serEl = null; vybesSala.pedido = '';
  if (!el) return;
  el.classList.add('saindo'); setTimeout(() => el.remove(), 400);
}
async function vybesCartaoAbrir(texto) {
  const pedido = vybesResto(texto) ? texto : '';
  vybesSala.pedido = pedido || vybesSala.pedido || '';
  let el = vybesSala.serEl;
  if (!el) {
    el = document.createElement('div');
    el.className = 'vybes-sala-ser'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'VYBES');
    el.innerHTML = '<button type="button" class="vybes-sala-orbe" aria-label="Abrir a central do VYBES"><i></i><i></i></button><p class="vybes-sala-fala"></p><small>Toque no VYBES para abrir a central · Esc fecha</small>';
    el.querySelector('button').onclick = () => { const p = vybesSala.pedido; vybesSerFechar(); chooseVybesMode(p ? { pedido: p } : undefined); };
    document.body.appendChild(el); vybesSala.serEl = el;
    const esc = (e) => { if (e.key === 'Escape' && vybesSala.serEl === el) { vybesSerFechar(); removeEventListener('keydown', esc); } };
    addEventListener('keydown', esc);
  }
  clearTimeout(vybesSala.serTempo); vybesSala.serTempo = setTimeout(() => { if (vybesSala.serEl === el) vybesSerFechar(); }, 25e3);
  const mostra = (t) => { if (vybesSala.serEl === el) el.querySelector('.vybes-sala-fala').textContent = t; };
  if (!pedido) { mostra(await vybesFalar('chamado') || 'Toque em mim para abrir a central.'); return; }
  // Com pergunta, ele responde ali mesmo (Paulo, 04/11/2026): "deixa eu ver", a central responde pela sala, e a resposta
  // sai na voz dela. Sem resposta, o convite de sempre: tocar nele abre a central já com a pergunta.
  mostra(await vybesFalar('olhando') || 'Deixa eu ver…'); el.classList.add('pensando');
  const vez = (vybesSala.pergunta = (vybesSala.pergunta || 0) + 1);
  try {
    const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'perguntar', texto: pedido }) });
    const d = await r.json().catch(() => ({}));
    if (vez !== vybesSala.pergunta || vybesSala.serEl !== el) return;
    el.classList.remove('pensando');
    if (!r.ok || !d.fala) throw new Error();
    mostra(d.fala);
    clearTimeout(vybesSala.serTempo); vybesSala.serTempo = setTimeout(() => { if (vybesSala.serEl === el) vybesSerFechar(); }, 30e3);
    if (d.audio) {
      const bytes = Uint8Array.from(atob(d.audio), (c) => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: d.tipo || 'audio/mpeg' }));
      const a = new Audio(url); vybesSala.fala?.pause(); vybesSala.fala = a;
      vybesSala.falandoAte = Date.now() + 30000; el.classList.add('falando');
      a.onended = () => { vybesSala.falandoAte = Date.now() + 300; el.classList.remove('falando'); URL.revokeObjectURL(url); vybesSala.conversaAte = Date.now() + 30e3; };
      a.onloadedmetadata = () => { vybesSala.falandoAte = Date.now() + (a.duration || 20) * 1000 + 300; };
      a.play().catch(() => el.classList.remove('falando'));
    }
  } catch {
    if (vez !== vybesSala.pergunta || vybesSala.serEl !== el) return;
    el.classList.remove('pensando');
    mostra(await vybesFalar('pedido') || 'Toque em mim que eu abro a central com isso.');
  }
}
// Com o ser na tela, a resposta curta é com ele: "sim" (tocar), "não" (dispensa) ou um pedido novo.
function vybesSerResponder(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/^(?:nao|agora nao|deixa|depois|nada|esquece|pode fechar)\b/.test(t)) { vybesFalar('dispensa'); setTimeout(vybesSerFechar, 2500); return true; }
  if (/^(?:sim|quero|pode|abre|abrir|claro|bora|isso|ok|beleza|manda)\b/.test(t) && t.split(' ').length <= 4) {
    vybesFalar('toque').then((d) => { if (d && vybesSala.serEl) vybesSala.serEl.querySelector('.vybes-sala-fala').textContent = d; });
    clearTimeout(vybesSala.serTempo); vybesSala.serTempo = setTimeout(vybesSerFechar, 25e3); return true;
  }
  return false;
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
      if (Date.now() < (vybesSala.falandoAte || 0)) continue; // a própria voz dele voltando pelo microfone
      // Com o ser na tela, a resposta curta fica com ele (sem o nome também vale).
      if (vybesSala.serEl && !VYBES_NOME.test(texto) && vybesSerResponder(texto)) continue;
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
