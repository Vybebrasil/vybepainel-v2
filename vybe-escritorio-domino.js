// Dominó na mesa de jogo do Escritório (pedido do Paulo, 27/10/2026): clicar
// na mesa chama alguém que está online para um dominó de compra, de graça ou
// valendo VybeCoins e móveis/roupas. Convite, aposta e aviso são as telas do
// xadrez (vybe-escritorio-xadrez.js) com a configuração abaixo; regras, mãos
// e prêmio ficam no servidor (server/escritorio-domino.js e escritorio-mesas.js).
// Aqui só se desenha a mesa e se pede a jogada. O aviso de "a partida mudou"
// vai pelo balão de comando (dmn=<id>:<para>:<c|l>).
const ESCRITORIO_DOMINO = /gamingtable/;
const DOMINO_CFG = {
  nome: "Dominó", artigo: "o dominó", lista: "mesa", desafiar: "mesa-desafiar", responder: "mesa-responder", extra: { jogo: "domino" },
  sinal: "dmn", nota: "Começa quem tem a maior carroça.", abrir: (j) => abrirJogoDomino(j),
  aberto: (id) => (escritorioDomino().jogo?.id === id ? (recarregarJogoDomino(), true) : false),
};
// Pontos de cada metade numa grade 3×3 (0 = canto de cima à esquerda).
const DOMINO_PONTOS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function escritorioDomino() {
  return (escritorio.domino ||= { jogo: null, sel: null, timer: null });
}
function abrirDominoEscritorio(m) {
  return abrirMesaEscritorio(m, DOMINO_CFG);
}
function dominoSinalEscritorio(de, v) {
  mesaSinalEscritorio(DOMINO_CFG, de, v);
}
const dominoMesma = (p, q) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);

function dominoMetadeHtml(n) {
  return `<span class="dmn-meia">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i${DOMINO_PONTOS[n].includes(i) ? ' class="p"' : ""}></i>`).join("")}</span>`;
}
function dominoPecaHtml([a, b], cls = "") {
  return `<span class="dmn-peca ${cls}" role="img" aria-label="${a} e ${b}">${dominoMetadeHtml(a)}<b></b>${dominoMetadeHtml(b)}</span>`;
}

// --- Partida ---------------------------------------------------------------
function abrirJogoDomino(j) {
  const d = escritorioDomino();
  d.jogo = j; d.sel = null;
  escritorioXadrez().nova = null;
  desenharJogoDomino();
  clearInterval(d.timer);
  d.timer = setInterval(() => {
    if (!document.querySelector("#workflow-modal.ofc-dmn-jogo")) { clearInterval(d.timer); d.timer = null; d.jogo = null; return; }
    if (d.jogo?.estado === "jogando" && !document.hidden) recarregarJogoDomino();
  }, 4000);
}
function dominoFechar() {
  const d = escritorioDomino();
  clearInterval(d.timer);
  d.timer = null; d.jogo = null; d.sel = null;
  xadrezFechar();
}
async function recarregarJogoDomino() {
  const d = escritorioDomino(), j = d.jogo;
  if (!j || d.carregando) return;
  d.carregando = true;
  try {
    const r = await escritorioApi("mesa", null, { id: j.id });
    if (d.jogo?.id !== j.id) return;
    const mudou = r.jogo.n !== j.n || r.jogo.estado !== j.estado || r.jogo.empate_de !== j.empate_de || r.jogo.pode_reivindicar !== j.pode_reivindicar;
    d.jogo = r.jogo;
    if (mudou) {
      if (r.jogo.n !== j.n) { d.sel = null; escritorioTocar(r.jogo.vez === r.jogo.eu ? 660 : 440, 0.06, 0.05); }
      if (r.jogo.estado === "fim" && j.estado !== "fim") xadrezAcabou(r.jogo);
      desenharJogoDomino();
    }
  } catch { /* tenta de novo no próximo ciclo */ } finally { d.carregando = false; }
}
function dominoOutro(lado) {
  return lado === "desafiante" ? "desafiado" : "desafiante";
}
function dominoJogadorHtml(j, lado) {
  const p = j[lado], u = escritorioCabecaUrl(p.id), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado;
  const n = j.mesa?.pecas?.[lado] ?? 0;
  return `<div class="xdz-jogador dmn-jogador${vez ? " vez" : ""}">${u ? `<img src="${safeText(u)}" alt="" width="36" height="36">` : "<i></i>"}<b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><small>${vez ? (eu ? "Sua vez" : "Pensando…") : `${n} ${n === 1 ? "peça" : "peças"}`}</small></div>`;
}
function dominoLinhaHtml(j) {
  const m = j.mesa, d = escritorioDomino();
  if (!m.linha.length) {
    const quem = j.vez === j.eu ? "Você abre" : `${xadrezPrimeiroNome(j[j.vez])} abre`;
    return `<div class="dmn-linha vazia"><span>${m.abertura ? `${quem} com a ${m.abertura[0]}|${m.abertura[1]}` : "Mesa vazia"}</span></div>`;
  }
  const escolher = d.sel ? (j.mesa.jogaveis.find((o) => dominoMesma(o.peca, d.sel))?.pontas || []) : [];
  const ponta = (lado, rotulo) => escolher.includes(lado) ? `<button type="button" class="dmn-ponta" onclick="jogarDominoEscritorio('${lado}')">${rotulo}</button>` : "";
  const ultimo = m.ultimo?.acao === "jogou" ? m.ultimo.peca : null;
  const pecas = m.linha.map((p, i) => dominoPecaHtml(p, `${p[0] === p[1] ? "carroca" : "deitada"}${ultimo && dominoMesma(p, ultimo) && (i === 0 || i === m.linha.length - 1) ? " nova" : ""}`)).join("");
  return `<div class="dmn-linha">${ponta("esq", "◀ Aqui")}${pecas}${ponta("dir", "Aqui ▶")}</div>`;
}
function dominoMaoHtml(j) {
  const m = j.mesa, d = escritorioDomino();
  // No fim as duas mãos aparecem no painel (dominoReveladoHtml).
  if (!m.mao || j.estado !== "jogando") return "";
  const minhaVez = j.estado === "jogando" && j.vez === j.eu;
  const pecas = m.mao.map((p) => {
    const pode = minhaVez && m.jogaveis.some((o) => dominoMesma(o.peca, p)), sel = d.sel && dominoMesma(d.sel, p);
    return `<button type="button" class="dmn-mao-peca${pode ? " pode" : ""}${sel ? " sel" : ""}" ${pode ? `onclick="escolherPecaDomino(${p[0]},${p[1]})"` : "disabled"} aria-label="Peça ${p[0]} e ${p[1]}${pode ? ", pode jogar" : ""}">${dominoPecaHtml(p)}</button>`;
  }).join("");
  const botoes = !minhaVez ? "" : m.pode_comprar ? `<button type="button" class="workflow-primary" onclick="lanceDominoEscritorio({tipo:'comprar'},this)">Comprar do monte</button>`
    : m.pode_passar ? `<button type="button" class="workflow-primary" onclick="lanceDominoEscritorio({tipo:'passar'},this)">Passar a vez</button>` : "";
  return `<div class="dmn-mao${minhaVez ? " vez" : ""}">${pecas}</div>${botoes ? `<div class="dmn-botoes">${botoes}</div>` : ""}`;
}
function dominoUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  return u.acao === "jogou" ? `${quem} jogou ${u.peca[0]}|${u.peca[1]}.` : u.acao === "comprou" ? `${quem} comprou do monte.` : `${quem} passou a vez.`;
}
function dominoReveladoHtml(j) {
  const r = j.mesa?.revelado;
  if (!r) return "";
  const lado = (l) => `<div class="dmn-revelado"><span>${xadrezPrimeiroNome(j[l])} · ${r.pontos[l]} ${r.pontos[l] === 1 ? "ponto" : "pontos"}</span><div>${r.maos[l].length ? r.maos[l].map((p) => dominoPecaHtml(p, "mini")).join("") : "<small>Bateu</small>"}</div></div>`;
  return `<h3 class="xdz-sub">Mãos no fim</h3>${lado("desafiante")}${lado("desafiado")}`;
}
function desenharJogoDomino() {
  const j = escritorioDomino().jogo;
  if (!j) return;
  const jogando = j.estado === "jogando", eu = j.eu, outro = eu ? dominoOutro(eu) : null;
  const empateMeu = j.empate_de && j.empate_de === String(escritorio.base?.eu), empateDele = j.empate_de && !empateMeu;
  const m = j.mesa;
  const status = !jogando ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : escritorioDomino().sel ? "Escolha a ponta onde a peça entra." : m.pode_comprar ? "Nenhuma peça encaixa: compre do monte." : m.pode_passar ? "Nenhuma peça encaixa e o monte acabou: passe a vez." : "Sua vez. Toque numa peça que encaixa.";
  const acoes = !jogando || !eu ? "" : `<div class="xdz-acoes">
${empateDele ? `<div class="xdz-empate"><span>${xadrezPrimeiroNome(j[outro])} propôs empate.</span><button type="button" class="workflow-primary" onclick="acaoDominoEscritorio('aceitar-empate',this)">Aceitar</button><button type="button" class="workflow-secondary" onclick="acaoDominoEscritorio('recusar-empate',this)">Recusar</button></div>` : ""}
${j.pode_reivindicar ? `<button type="button" class="workflow-primary" onclick="acaoDominoEscritorio('reivindicar',this)">${xadrezPrimeiroNome(j[outro])} sumiu: ganhar por tempo</button>` : ""}
<button type="button" class="workflow-secondary" onclick="acaoDominoEscritorio('empate',this)" ${j.empate_de ? "disabled" : ""}>${empateMeu ? "Empate proposto" : "Propor empate"}</button>
<button type="button" class="workflow-secondary xdz-desistir" onclick="desistirDomino(this)">Desistir</button></div>`;
  const cima = eu ? outro : "desafiado", baixo = eu || "desafiante";
  const perspectiva = eu ? (String(j.desafiante.id) === String(escritorio.base?.eu) ? "desafiante" : "desafiado") : null;
  xadrezModal(`<div class="workflow-kicker">Dominó${!eu ? " · assistindo" : ""}<button type="button" class="workflow-close" aria-label="Fechar" onclick="dominoFechar()">×</button></div>
<div class="xdz-jogo dmn-jogo"><div class="dmn-lado-mesa">${dominoJogadorHtml(j, cima)}
<div class="dmn-mesa"><div class="dmn-monte" title="Peças no monte"><span class="dmn-costas"></span><b>${m.monte}</b><small>no monte</small></div>${dominoLinhaHtml(j)}</div>
${dominoJogadorHtml(j, baixo)}${dominoMaoHtml(j)}</div>
<aside class="xdz-painel">${xadrezResultadoHtml(j)}${status ? `<p class="xdz-status" aria-live="polite">${status}</p>` : ""}
${dominoUltimoTexto(j) ? `<p class="ofc-nota">${safeText(dominoUltimoTexto(j))}</p>` : ""}
${xadrezApostaHtml(j, perspectiva)}${dominoReveladoHtml(j)}${acoes}<p class="ofc-erro" id="xdz-erro" role="alert"></p>
${!jogando ? `<div class="workflow-actions"><button type="button" class="workflow-primary" onclick="dominoFechar()">Fechar</button></div>` : ""}</aside></div>`, "ofc-dmn-jogo");
}
// Tocou numa peça: se só cabe numa ponta (ou as duas pontas são iguais), joga;
// senão, mostra as duas pontas para escolher.
function escolherPecaDomino(a, b) {
  const d = escritorioDomino(), j = d.jogo;
  if (!j || j.estado !== "jogando" || j.vez !== j.eu || d.enviando) return;
  const p = [a, b], op = j.mesa.jogaveis.find((o) => dominoMesma(o.peca, p));
  if (!op) return;
  const pontas = j.mesa.pontas;
  if (op.pontas.length === 1 || (pontas && pontas[0] === pontas[1])) return lanceDominoEscritorio({ tipo: "jogar", peca: p, ponta: op.pontas[op.pontas.length - 1] });
  d.sel = d.sel && dominoMesma(d.sel, p) ? null : p;
  desenharJogoDomino();
}
function jogarDominoEscritorio(ponta) {
  const d = escritorioDomino();
  if (d.sel) lanceDominoEscritorio({ tipo: "jogar", peca: d.sel, ponta });
}
async function lanceDominoEscritorio(pedido, botao) {
  const d = escritorioDomino(), j = d.jogo;
  if (!j || d.enviando) return;
  d.enviando = true;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("mesa-lance", { id: j.id, n: j.n, ...pedido });
    d.jogo = r.jogo; d.sel = null;
    if (r.economia) xadrezEconomia(r.economia);
    escritorioTocar(pedido.tipo === "jogar" ? 520 : 380, 0.06, 0.05);
    mesaSinal(DOMINO_CFG, j.id, j[dominoOutro(j.eu)].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
  } catch (e) {
    d.sel = null;
    escritorioAviso(e.message);
    recarregarJogoDomino();
  } finally { d.enviando = false; }
  desenharJogoDomino();
}
function desistirDomino(botao) {
  if (botao.dataset.certeza !== "1") { botao.dataset.certeza = "1"; botao.textContent = "Desistir mesmo?"; setTimeout(() => { if (botao.isConnected) { botao.dataset.certeza = ""; botao.textContent = "Desistir"; } }, 4000); return; }
  acaoDominoEscritorio("desistir", botao);
}
async function acaoDominoEscritorio(acao, botao) {
  const d = escritorioDomino(), j = d.jogo;
  if (!j) return;
  if (botao) botao.disabled = true;
  try {
    const r = await escritorioApi("mesa-acao", { id: j.id, acao });
    d.jogo = r.jogo;
    if (r.economia) xadrezEconomia(r.economia);
    mesaSinal(DOMINO_CFG, j.id, j[dominoOutro(j.eu)].id, "l");
    if (r.jogo.estado === "fim") xadrezAcabou(r.jogo);
    desenharJogoDomino();
  } catch (e) {
    if (botao) botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message;
  }
}
