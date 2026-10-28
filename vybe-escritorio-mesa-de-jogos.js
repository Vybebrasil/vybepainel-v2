// Mesa de Jogos do Escritório (pedido do Paulo, 27/10/2026): a mesa que era
// só do dominó agora abre a escolha entre dominó, dama, jogo da velha e
// truco. Convite e aposta são as telas do xadrez; a moldura da partida é a
// das mesas (vybe-escritorio-mesas.js); as regras ficam no servidor
// (server/escritorio-dama.js, escritorio-velha.js, escritorio-truco.js).
// Avisos pelo balão de comando: dam=, vlh=, trc= (<id>:<para>:<c|l>).
const DAMA_CFG = registrarMesaEscritorio({
  som: (j, antes) => ((j.mesa?.pecas?.brancas ?? 0) + (j.mesa?.pecas?.pretas ?? 0) < (antes?.mesa?.pecas?.brancas ?? 0) + (antes?.mesa?.pecas?.pretas ?? 0) ? "peca2" : "peca"),
  nome: "Dama", artigo: "a dama", extra: { jogo: "dama" }, sinal: "dam",
  nota: "Dama brasileira: captura obrigatória, a maior captura vale e a dama voa. As cores são sorteadas.", desenhar: (j, s) => desenharDama(j, s),
});
const VELHA_CFG = registrarMesaEscritorio({
  som: () => "peca2",
  nome: "Jogo da velha", artigo: "o jogo da velha", extra: { jogo: "velha" }, sinal: "vlh",
  nota: "Melhor de 5: ganha quem fizer 3 rodadas primeiro.", desenhar: (j, s) => desenharVelha(j, s),
});
const TRUCO_CFG = registrarMesaEscritorio({
  som: (j) => (j.mesa?.ultimo?.acao === "jogou" ? "carta" : "ficha"),
  nome: "Truco", artigo: "o truco", extra: { jogo: "truco" }, sinal: "trc",
  nota: "Truco paulista para dois, até 12 pontos, com vira e manilha.", desenhar: (j, s) => desenharTruco(j, s),
});
const MESA_DE_JOGOS = ["dmn", "dam", "vlh", "trc"];
const MESA_DE_JOGOS_ICONES = { dmn: "▣", dam: "⛂", vlh: "#", trc: "♣" };

// Clicou na Mesa de Jogos: a partida que estiver rolando (minha ou nesta
// mesa), o convite recebido, ou a escolha do jogo.
async function abrirMesaDeJogosEscritorio(m) {
  if (escritorio.base?.demo) return escritorioAviso("A demonstração não tem partidas.");
  const mesa = { camada: escritorio.quarto || "praca", movel: escritorio.mapa.chaveMovel(m) };
  let d;
  try { d = await escritorioApi("mesa", null, { ...mesa, jogo: "todos" }); } catch (e) { return escritorioAviso(e.message); }
  if (!d.disponivel) return escritorioAviso("A Mesa de Jogos aguarda a migração do banco.");
  xadrezPoeSprite();
  const x = escritorioXadrez();
  x.mesa = mesa;
  const cfgDe = (j) => MESA_DE_JOGOS.map((k) => ESCRITORIO_MESAS[k]).find((c) => c.extra.jogo === j.jogo);
  const daqui = (l) => l.filter((j) => cfgDe(j));
  const meu = daqui(d.jogos)[0];
  if (meu) return cfgDe(meu).abrir(meu);
  // O lobby da mesa, com os quatro jogos: convites, espera, o que está rolando aqui.
  const filtrar = (v) => ({ ...v, convites: daqui(v.convites || []), aguardando: daqui(v.aguardando || []), enviados: daqui(v.enviados || []), mesa: v.mesa && cfgDe(v.mesa) ? v.mesa : null });
  const lobby = { nome: "Mesa de Jogos", artigo: "um jogo", nota: "Dominó, dama, jogo da velha e truco: chame alguém e escolha o jogo.", lista: "mesa", extra: { jogo: "todos" }, responder: "mesa-responder",
    escolher: true, filtrar, abrir: (j) => cfgDe(j).abrir(j) };
  desenharSalaMesa(filtrar(d), lobby);
}
function escolherJogoDaMesa() {
  const botoes = MESA_DE_JOGOS.map((k) => {
    const c = ESCRITORIO_MESAS[k];
    return `<button type="button" onclick="jogoDaMesaEscolhido('${k}')"><i aria-hidden="true">${MESA_DE_JOGOS_ICONES[k]}</i><b>${c.nome}</b><small>${safeText(c.nota)}</small></button>`;
  }).join("");
  xadrezModal(`<div class="workflow-kicker">Mesa de Jogos<button type="button" class="workflow-close" aria-label="Fechar" onclick="xadrezFechar()">×</button></div>
<h2 class="workflow-title">O que vamos jogar?</h2><div class="mesa-escolha">${botoes}</div>
<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="abrirSalaMesa()">Voltar</button></div>`, "ofc-xdz-escolha");
}
function jogoDaMesaEscolhido(chave) {
  const x = escritorioXadrez(), cfg = ESCRITORIO_MESAS[chave];
  x.cfg = cfg;
  // O lobby do jogo escolhido: chamar gente, os Desafios (bots) e a Temporada.
  x.extras = null;
  desenharSalaMesa({ convites: [], aguardando: [], enviados: [], mesa: null }, cfg);
}

// --- Jogo da velha ---------------------------------------------------------
function desenharVelha(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const detalhe = (l) => `${m.simbolos[l]} · ${m.placar[l]} de ${m.alvo}`;
  const minha = j.estado === "jogando" && m.pode_marcar && !(m.anterior && s.rodadaVista !== undefined && s.rodadaVista !== m.anterior.rodada && m.tab.every((c) => !c));
  // No fim da partida o tabuleiro mostrado é o da última rodada, com a linha que fechou.
  // Rodada que acabou de fechar (no meio da partida): o tabuleiro dela fica na
  // tela por 2 s com a linha acesa e o aviso de quem fez, antes de limpar.
  const a0 = m.anterior, replay = j.estado === "jogando" && a0 && s.rodadaVista !== undefined && s.rodadaVista !== a0.rodada && m.tab.every((c) => !c);
  if (s.rodadaVista === undefined || (!replay && a0)) s.rodadaVista = a0?.rodada ?? null;
  if (replay) { clearTimeout(s.replayTimer); s.replayTimer = setTimeout(() => { s.rodadaVista = a0.rodada; if (escritorioMesa("vlh").jogo?.id === j.id) desenharJogoMesa("vlh"); }, 2000); }
  const tab = (j.estado === "fim" || replay) && m.anterior ? m.anterior.tab : m.tab, linha = new Set(j.estado === "fim" || replay ? m.anterior?.linha || [] : []);
  const casas = tab.map((c, i) => `<button type="button" class="vlh-casa${c ? " " + c.toLowerCase() : ""}${m.ultimo?.casa === i && c ? " ultima" : ""}${linha.has(i) ? " linha" : ""}" ${minha && !c ? `onclick="lanceMesaEscritorio('vlh',{tipo:'marcar',casa:${i}},this)"` : "disabled"} aria-label="Casa ${i + 1}${c ? ", " + c : ""}">${c || ""}</button>`).join("");
  const a = m.anterior, nome = (l) => (l === eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : minha ? `Sua vez: você é ${m.simbolos[eu]}.` : `Vez de ${xadrezPrimeiroNome(j[outro])}.`;
  return {
    status,
    // Quadro de neon: placar grande, o meu símbolo aparece de leve na casa livre ao passar o mouse.
    mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}<div class="vlh-mesa"><div class="vlh-placar"><b class="${m.simbolos[cima].toLowerCase()}">${m.simbolos[cima]}</b><span>${m.placar[cima]} × ${m.placar[baixo]}</span><b class="${m.simbolos[baixo].toLowerCase()}">${m.simbolos[baixo]}</b></div><small>Rodada ${m.rodada} · melhor de ${m.alvo * 2 - 1}</small><div class="vlh-tab${replay ? " replay" : ""}"${minha && eu ? ` data-meu="${m.simbolos[eu]}"` : ""}>${casas}${replay ? `<p class="vlh-aviso">${safeText(a0.vencedor === "empate" ? "Deu velha!" : `${nome(a0.vencedor)} fez a linha!`)}</p>` : ""}</div></div>${mesaJogadorHtml(j, baixo, detalhe(baixo))}`,
    painel: a ? `<p class="ofc-nota">${safeText(a.vencedor === "empate" ? `Rodada ${a.rodada}: deu velha.` : `Rodada ${a.rodada}: ${nome(a.vencedor)} fez a linha.`)}</p>` : "",
  };
}

// --- Dama ------------------------------------------------------------------
function desenharDama(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const minhaCor = eu ? m.cores[eu] : "brancas", invertido = minhaCor === "pretas";
  const minhaVez = j.estado === "jogando" && eu && j.vez === eu;
  const alvos = new Map((s.sel != null ? m.legais[s.sel] || [] : []).map((l) => [l.para, l]));
  const ultimo = new Set(m.ultimo ? [m.ultimo.de, ...m.ultimo.caminho] : []);
  const ordem = [...Array(64).keys()];
  if (invertido) ordem.reverse();
  const casas = ordem.map((i) => {
    const r = Math.floor(i / 8), c = i % 8, escura = (r + c) % 2 === 1, p = m.tab[i];
    const pode = minhaVez && m.legais[i];
    const cls = ["dam-casa", escura ? "escura" : "clara", s.sel === i ? "sel" : "", alvos.has(i) ? "alvo" : "", ultimo.has(i) ? "ultimo" : "", pode ? "minha" : ""].filter(Boolean).join(" ");
    const peca = p ? `<span class="dam-peca ${p.toLowerCase() === "b" ? "branca" : "preta"}${p === "B" || p === "P" ? " dama" : ""}" aria-hidden="true"></span>` : "";
    const arrasta = pode ? ` onpointerdown="tabuleiroArrastar(event,${i},(c)=>{if(escritorioMesa('dam').sel!==c)casaDama(c)},(c)=>casaDama(Number(c)))"` : "";
    return `<button type="button" class="${cls}" data-casa="${i}" ${escura ? `onclick="casaDama(${i})"` : "disabled"}${arrasta} aria-label="Casa ${"abcdefgh"[c]}${8 - r}${p ? (p.toLowerCase() === "b" ? ", branca" : ", preta") + (p === "B" || p === "P" ? " dama" : "") : ""}">${peca}</button>`;
  }).join("");
  const detalhe = (l) => `${m.cores[l] === "brancas" ? "Brancas" : "Pretas"} · ${m.pecas[m.cores[l]]} peças`;
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const deve = minhaVez ? Math.max(0, ...Object.values(m.legais).flat().map((l) => l.capturas)) : 0;
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : !minhaVez ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : deve ? `Captura obrigatória: tome ${deve} ${deve === 1 ? "peça" : "peças"}.` : "Sua vez. Toque numa peça e depois na casa.";
  // Lance novo (meu ou do outro): a peça pula casa por casa e as tomadas somem no pulo.
  const chave = j.id + ":" + j.n, anima = s.damVisto && s.damVisto.split(":")[0] === j.id && s.damVisto !== chave && m.ultimo;
  s.damVisto = chave;
  if (anima) setTimeout(() => damaAnimar(m.ultimo));
  // O tabuleiro fica em cima da mesa da arte (assets/jogos/tabuleiro-dama.webp):
  // as casas são transparentes e a arte mostra as cores; seleção, alvo e último
  // lance continuam por cima.
  return { status, mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}<div class="dam-mesa"><div class="dam-tabuleiro${minhaVez ? " vez" : ""}">${casas}</div></div>${mesaJogadorHtml(j, baixo, detalhe(baixo))}` };
}
// O último lance da dama animado: uma cópia da peça sai da casa de origem e
// pula por cada casa do caminho (com arco); cada peça tomada fica na tela até
// a peça passar por cima dela e some girando. A peça de verdade só aparece no fim.
function damaAnimar(u) {
  const tab = document.querySelector(".ofc-dam-jogo .dam-tabuleiro");
  if (!tab || !u || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const casa = (i) => tab.querySelector(`[data-casa="${i}"]`)?.getBoundingClientRect();
  const final = tab.querySelector(`[data-casa="${u.para}"] .dam-peca`), r0 = casa(u.de);
  if (!final || !r0) return;
  const PULO = 280, passos = [u.de, ...u.caminho].map(casa);
  const fantasma = final.cloneNode(true), lado = r0.width;
  Object.assign(fantasma.style, { position: "fixed", left: "0", top: "0", width: lado * 0.8 + "px", height: lado * 0.8 + "px", zIndex: 10000, pointerEvents: "none" });
  document.body.append(fantasma);
  final.style.visibility = "hidden";
  const centro = (r) => [r.left + r.width * 0.1, r.top + r.height * 0.1];
  const quadros = [];
  passos.forEach((r, k) => {
    const [x, y] = centro(r);
    if (k) { const [x0, y0] = centro(passos[k - 1]); quadros.push({ transform: `translate(${(x + x0) / 2}px,${(y + y0) / 2 - lado * 0.45}px) scale(1.18)`, offset: (k - 0.5) / (passos.length - 1) }); }
    quadros.push({ transform: `translate(${x}px,${y}px) scale(1)`, offset: passos.length > 1 ? k / (passos.length - 1) : 1 });
  });
  const total = PULO * Math.max(1, passos.length - 1);
  fantasma.animate(quadros, { duration: total, easing: "linear", fill: "forwards" }).finished.then(() => { fantasma.remove(); final.style.visibility = ""; jogosSom("peca"); }).catch(() => { fantasma.remove(); final.style.visibility = ""; });
  // As tomadas: cópia da peça do outro na casa, some quando a peça passa por cima.
  const cor = final.classList.contains("branca") ? "preta" : "branca";
  (u.capturadas || []).forEach((c, k) => {
    const r = casa(c);
    if (!r) return;
    const t = document.createElement("span");
    t.className = `dam-peca ${cor} dam-tomada`;
    Object.assign(t.style, { position: "fixed", left: r.left + r.width * 0.1 + "px", top: r.top + r.height * 0.1 + "px", width: r.width * 0.8 + "px", height: r.height * 0.8 + "px", zIndex: 9999, pointerEvents: "none" });
    document.body.append(t);
    const quando = PULO * (k + 0.55);
    t.animate([{ transform: "none", opacity: 1 }, { transform: "none", opacity: 1, offset: quando / (quando + 320) }, { transform: "scale(.2) rotate(140deg)", opacity: 0 }], { duration: quando + 320, fill: "forwards" })
      .finished.then(() => t.remove()).catch(() => t.remove());
    setTimeout(() => jogosSom("peca2", 0.8), quando);
  });
}
function casaDama(i) {
  const s = escritorioMesa("dam"), j = s.jogo;
  if (!j || j.estado !== "jogando" || j.vez !== j.eu || s.enviando) return;
  const lance = s.sel != null ? (j.mesa.legais[s.sel] || []).find((l) => l.para === i) : null;
  if (lance) return lanceMesaEscritorio("dam", { tipo: "mover", de: s.sel, para: i, caminho: lance.caminho });
  s.sel = j.mesa.legais[i] && s.sel !== i ? i : null;
  desenharJogoMesa("dam");
}

// --- Truco -----------------------------------------------------------------
// Tentos em palitos de fósforo: grupos de cinco (quatro em pé, o quinto
// atravessado), como na lousa do bar. `antes` = tentos já vistos: os novos caem acesos.
function trucoTentosHtml(n, antes = n) {
  const palito = (k, x, y, ang) => `<g class="${k >= antes ? "novo" : ""}" style="--k:${Math.max(0, k - antes)}" transform="translate(${x} ${y}) rotate(${ang})"><rect x="-1.1" y="-10" width="2.2" height="20" rx="1" fill="#f1d7a1"/><ellipse cx="0" cy="-10" rx="1.9" ry="2.6" fill="#d23a2a"/></g>`;
  let svg = "", k = 0;
  for (let g = 0; g * 5 < Math.max(n, 1) && g < 3; g++) {
    const x0 = 6 + g * 30;
    for (let i = 0; i < 4; i++, k++) svg += k < n ? palito(k, x0 + i * 5, 14, 0) : `<rect x="${x0 + i * 5 - 1}" y="5" width="2" height="18" rx="1" fill="#ffffff14"/>`;
    svg += k < n ? palito(k, x0 + 7.5, 14, 62) : "";
    k++;
  }
  return `<svg viewBox="0 0 96 28" width="96" height="28" aria-hidden="true">${svg}</svg>`;
}
// Cartas do truco ('4o') no desenho das cartas do pôquer ('4d').
const TRUCO_NAIPE = { o: "d", e: "s", c: "h", p: "c" };
const trucoCartaHtml = (c, cls) => pokerCartaHtml(c ? c[0] + TRUCO_NAIPE[c[1]] : null, cls);
// Mesa de truco no jeito dos trucos online (Paulo, 27/10/2026: "deixa todos
// os jogos foda"): feltro, as cartas do outro em leque em cima, as minhas
// grandes em leque embaixo, as jogadas no meio, a vira com a manilha, placar
// grande com o valor da mão e as rodadas, e o pedido de truco em faixa.
function desenharTruco(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null, a = m.acoes || {};
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const nome = (l) => (l === eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const minhas = eu && m.minhas ? m.minhas.map((c, i) => `<button type="button" class="trc-carta" style="--i:${i - (m.minhas.length - 1) / 2}" ${a.jogar ? `onclick="lanceMesaEscritorio('trc',{tipo:'jogar',carta:'${c}'},this)"` : "disabled"} aria-label="Jogar ${c}">${trucoCartaHtml(c, "grande")}</button>`).join("") : "";
  const qtd = eu ? m.dele : m.pecas[cima];
  const dele = Array.from({ length: qtd }, (_, i) => `<span class="trc-costas" style="--i:${i - (qtd - 1) / 2}">${trucoCartaHtml(null, "media")}</span>`).join("");
  const rodadas = [0, 1, 2].map((i) => { const r = m.rodadas[i]; return `<i class="trc-rodada${r ? (r.vencedor === "empate" ? " empate" : r.vencedor === baixo ? " minha" : " dele") : ""}" title="Rodada ${i + 1}"></i>`; }).join("");
  const naMesa = (l) => (m.naMesa[l] ? `<span class="trc-jogada">${trucoCartaHtml(m.naMesa[l], "grande")}</span>` : '<span class="pkr-carta grande vaga" aria-hidden="true"></span>');
  const p = m.pendente;
  const pedido = !eu || j.estado !== "jogando" ? "" : a.responder
    ? `<div class="trc-faixa"><b>${xadrezPrimeiroNome(j[p.de])} pediu ${safeText(p.nome)}!</b><div><button type="button" class="sala-botao verde" onclick="lanceMesaEscritorio('trc',{tipo:'aceitar'},this)">Aceitar (${p.valor})</button>${a.aumentar ? `<button type="button" class="sala-botao laranja trc-grito" onclick="lanceMesaEscritorio('trc',{tipo:'aumentar'},this)">${safeText(a.aumentar)}!</button>` : ""}<button type="button" class="sala-botao cinza" onclick="lanceMesaEscritorio('trc',{tipo:'correr'},this)">Correr</button></div></div>`
    : a.esperando ? `<div class="trc-faixa espera"><b>Você pediu ${safeText(p?.nome || "truco")}!</b><small>Esperando ${xadrezPrimeiroNome(j[outro])} responder…</small></div>` : "";
  const grito = eu && j.estado === "jogando" && a.truco && !a.responder ? `<button type="button" class="sala-botao vermelho trc-grito" onclick="lanceMesaEscritorio('trc',{tipo:'truco'},this)">${safeText(a.truco)}!</button>` : "";
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : a.esperando ? `Esperando ${xadrezPrimeiroNome(j[outro])} responder o ${p?.nome}.`
    : a.responder ? "Responda o pedido." : a.jogar ? "Sua vez: jogue uma carta." : `Vez de ${xadrezPrimeiroNome(j[outro])}.`;
  const ant = m.anterior;
  const anterior = ant ? `<p class="ofc-nota">${safeText(ant.vencedor === "empate" ? `Mão ${ant.mao}: empatou, ninguém pontuou.` : `Mão ${ant.mao}: ${nome(ant.vencedor)} levou ${ant.valor} ${ant.valor === 1 ? "ponto" : "pontos"}${ant.motivo === "correu" ? " (o outro correu)" : ""}.`)}</p>` : "";
  // Placar de tentos de bar: palitos de fósforo em grupos de cinco (quatro em pé
  // e um atravessado), um quadro de cada um, até 12. O tento novo cai aceso.
  const tentosVistos = s.tentos?.id === j.id ? s.tentos : { id: j.id, [baixo]: m.pontos[baixo], [cima]: m.pontos[cima] };
  const linhaTentos = (l) => `<div class="trc-tentos-linha"><small>${nome(l)}</small><span class="trc-tentos" aria-label="${m.pontos[l]} ${m.pontos[l] === 1 ? "tento" : "tentos"}">${trucoTentosHtml(m.pontos[l], tentosVistos[l])}</span><b>${m.pontos[l]}</b></div>`;
  const placar = `<div class="trc-placar tentos">${linhaTentos(cima)}${linhaTentos(baixo)}<em>até ${m.alvo}</em></div>`;
  s.tentos = { id: j.id, [baixo]: m.pontos[baixo], [cima]: m.pontos[cima] };
  // Grito novo (truco, seis, nove, doze, aceitou, correu): balão em cima de
  // quem gritou, a mesa dá um tranco e o som de tapa na mesa. Uma vez por jogada.
  const u = m.ultimo, chaveGrito = j.id + ":" + j.n, gritoNovo = u && ["pediu", "aceitou", "correu"].includes(u.acao) && s.gritoVisto !== undefined && s.gritoVisto !== chaveGrito;
  s.gritoVisto = chaveGrito;
  const GRITOS = { 3: "TRUCO!", 6: "SEIS!", 9: "NOVE!", 12: "DOZE!" };
  const textoGrito = !gritoNovo ? "" : u.acao === "pediu" ? GRITOS[u.valor] || "TRUCO!" : u.acao === "aceitou" ? (u.valor >= 12 ? "DESCE O DOZE!" : "CAI DENTRO!") : "CORRI!";
  if (gritoNovo) { jogosSom("tabela", u.acao === "pediu" ? 1 : 0.6); if (u.acao === "pediu") setTimeout(() => jogosSom("tabela", 0.8), 140); }
  const balao = gritoNovo ? `<p class="trc-balao ${u.lado === baixo ? "baixo" : "cima"} ${u.acao}${u.valor >= 9 ? " forte" : ""}" aria-live="assertive">${textoGrito}</p>` : "";
  return {
    status,
    mesa: `<div class="trc-salao">${mesaJogadorHtml(j, cima, `${m.pecas[cima]} ${m.pecas[cima] === 1 ? "carta" : "cartas"}${m.pe === cima ? " · pé" : ""}`)}
<div class="trc-feltro${gritoNovo && u.acao === "pediu" ? " tranco" : ""}">${balao}<div class="trc-dele">${dele}</div>
<div class="trc-meio"><div class="trc-vira"><small>Vira</small>${trucoCartaHtml(m.vira, "media")}<small>Manilha <b>${safeText(m.manilha)}</b></small></div>
<div class="trc-jogadas">${naMesa(cima)}${naMesa(baixo)}</div>
<div class="trc-info">${placar}<b class="trc-vale">Vale ${m.vale}</b>${m.mao_de_onze ? "<small>Mão de onze</small>" : ""}<span class="trc-rodadas">${rodadas}</span><small>Mão ${m.mao}</small></div></div>
${pedido}</div>
${mesaJogadorHtml(j, baixo, `${m.pe === baixo ? "Pé" : "Mão"}`)}<div class="trc-minhas">${minhas}</div><div class="trc-botoes">${grito}</div></div>`,
    painel: anterior,
  };
}
