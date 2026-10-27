// Dominó na mesa de jogo do Escritório (pedido do Paulo, 27/10/2026): clicar
// na mesa chama alguém que está online para um dominó de compra, de graça ou
// valendo VybeCoins e móveis/roupas. Convite e aposta são as telas do xadrez;
// a moldura da partida é a das mesas (vybe-escritorio-mesas.js). Regras, mãos
// e prêmio ficam no servidor (server/escritorio-domino.js e escritorio-mesas.js);
// aqui só se desenha a mesa e se pede a jogada. O aviso de "a partida mudou"
// vai pelo balão de comando (dmn=<id>:<para>:<c|l>).
const ESCRITORIO_DOMINO = /gamingtable/;
const DOMINO_CFG = registrarMesaEscritorio({
  nome: "Dominó", artigo: "o dominó", extra: { jogo: "domino" }, sinal: "dmn",
  nota: "Começa quem tem a maior carroça.", desenhar: (j, s) => desenharDomino(j, s),
});
// Pontos de cada metade numa grade 3×3 (0 = canto de cima à esquerda).
const DOMINO_PONTOS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

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

function dominoLinhaHtml(j, s) {
  const m = j.mesa;
  if (!m.linha.length) {
    const quem = j.vez === j.eu ? "Você abre" : `${xadrezPrimeiroNome(j[j.vez])} abre`;
    return `<div class="dmn-linha vazia"><span>${m.abertura ? `${quem} com a ${m.abertura[0]}|${m.abertura[1]}` : "Mesa vazia"}</span></div>`;
  }
  const escolher = s.sel ? (m.jogaveis.find((o) => dominoMesma(o.peca, s.sel))?.pontas || []) : [];
  const ponta = (lado, rotulo) => escolher.includes(lado) ? `<button type="button" class="dmn-ponta" onclick="jogarDominoEscritorio('${lado}')">${rotulo}</button>` : "";
  const ultimo = m.ultimo?.acao === "jogou" ? m.ultimo.peca : null;
  const pecas = m.linha.map((p, i) => dominoPecaHtml(p, `${p[0] === p[1] ? "carroca" : "deitada"}${ultimo && dominoMesma(p, ultimo) && (i === 0 || i === m.linha.length - 1) ? " nova" : ""}`)).join("");
  return `<div class="dmn-linha">${ponta("esq", "◀ Aqui")}${pecas}${ponta("dir", "Aqui ▶")}</div>`;
}
function dominoMaoHtml(j, s) {
  const m = j.mesa;
  // No fim as duas mãos aparecem no painel (dominoReveladoHtml).
  if (!m.mao || j.estado !== "jogando") return "";
  const minhaVez = j.vez === j.eu;
  const pecas = m.mao.map((p) => {
    const pode = minhaVez && m.jogaveis.some((o) => dominoMesma(o.peca, p)), sel = s.sel && dominoMesma(s.sel, p);
    return `<button type="button" class="dmn-mao-peca${pode ? " pode" : ""}${sel ? " sel" : ""}" ${pode ? `onclick="escolherPecaDomino(${p[0]},${p[1]})"` : "disabled"} aria-label="Peça ${p[0]} e ${p[1]}${pode ? ", pode jogar" : ""}">${dominoPecaHtml(p)}</button>`;
  }).join("");
  const botoes = !minhaVez ? "" : m.pode_comprar ? `<button type="button" class="workflow-primary" onclick="lanceMesaEscritorio('dmn',{tipo:'comprar'},this)">Comprar do monte</button>`
    : m.pode_passar ? `<button type="button" class="workflow-primary" onclick="lanceMesaEscritorio('dmn',{tipo:'passar'},this)">Passar a vez</button>` : "";
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
function desenharDomino(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const pecas = (l) => `${m.pecas[l]} ${m.pecas[l] === 1 ? "peça" : "peças"}`;
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : s.sel ? "Escolha a ponta onde a peça entra." : m.pode_comprar ? "Nenhuma peça encaixa: compre do monte." : m.pode_passar ? "Nenhuma peça encaixa e o monte acabou: passe a vez." : "Sua vez. Toque numa peça que encaixa.";
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const ultimo = dominoUltimoTexto(j);
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, pecas(cima))}
<div class="dmn-mesa"><div class="dmn-monte" title="Peças no monte"><span class="dmn-costas"></span><b>${m.monte}</b><small>no monte</small></div>${dominoLinhaHtml(j, s)}</div>
${mesaJogadorHtml(j, baixo, pecas(baixo))}${dominoMaoHtml(j, s)}`,
    painel: `${ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : ""}${dominoReveladoHtml(j)}`,
  };
}
// Tocou numa peça: se só cabe numa ponta (ou as duas pontas são iguais), joga;
// senão, mostra as duas pontas para escolher.
function escolherPecaDomino(a, b) {
  const s = escritorioMesa("dmn"), j = s.jogo;
  if (!j || j.estado !== "jogando" || j.vez !== j.eu || s.enviando) return;
  const p = [a, b], op = j.mesa.jogaveis.find((o) => dominoMesma(o.peca, p));
  if (!op) return;
  const pontas = j.mesa.pontas;
  if (op.pontas.length === 1 || (pontas && pontas[0] === pontas[1])) return lanceMesaEscritorio("dmn", { tipo: "jogar", peca: p, ponta: op.pontas[op.pontas.length - 1] });
  s.sel = s.sel && dominoMesma(s.sel, p) ? null : p;
  desenharJogoMesa("dmn");
}
function jogarDominoEscritorio(ponta) {
  const s = escritorioMesa("dmn");
  if (s.sel) lanceMesaEscritorio("dmn", { tipo: "jogar", peca: s.sel, ponta });
}
