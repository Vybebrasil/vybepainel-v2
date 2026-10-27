// Pôquer na mesa do saloon do Escritório (pedido do Paulo, 27/10/2026): Texas
// Hold'em para dois, até um ficar com todas as fichas, de graça ou valendo
// VybeCoins e móveis/roupas. Convite e aposta são as telas do xadrez; a moldura
// da partida é a das mesas (vybe-escritorio-mesas.js). Baralho, cartas e
// fichas ficam no servidor (server/escritorio-poker.js); aqui só se desenha a
// mesa e se pede a jogada. Aviso pelo balão de comando (pkr=<id>:<para>:<c|l>).
const ESCRITORIO_POKER = /^wildwest_table$/;
const POKER_CFG = registrarMesaEscritorio({
  nome: "Pôquer", artigo: "o pôquer", extra: { jogo: "poker" }, sinal: "pkr",
  nota: "Texas Hold'em: cada um começa com 1.000 fichas e ganha quem ficar com todas.", desenhar: (j, s) => desenharPoker(j, s),
});
const POKER_NAIPES = { s: ["♠", "espadas"], h: ["♥", "copas"], d: ["♦", "ouros"], c: ["♣", "paus"] };
const POKER_FASES = { preflop: "Antes do flop", flop: "Flop", turn: "Turn", river: "River" };

function abrirPokerEscritorio(m) {
  return abrirMesaEscritorio(m, POKER_CFG);
}
function pokerSinalEscritorio(de, v) {
  mesaSinalEscritorio(POKER_CFG, de, v);
}
function pokerCartaHtml(c, cls = "") {
  if (!c) return `<span class="pkr-carta costas ${cls}" role="img" aria-label="Carta virada"></span>`;
  const valor = c[0] === "T" ? "10" : c[0], [naipe, nome] = POKER_NAIPES[c[1]];
  return `<span class="pkr-carta${c[1] === "h" || c[1] === "d" ? " verm" : ""} ${cls}" role="img" aria-label="${valor} de ${nome}"><b>${valor}</b><i>${naipe}</i></span>`;
}
const pokerFichas = (n) => Number(n || 0).toLocaleString("pt-BR");

function pokerUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u || u.mao !== j.mesa.mao) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  return { largou: `${quem} largou.`, mesa: `${quem} passou.`, pagou: `${quem} pagou ${pokerFichas(u.valor)}.`, apostou: `${quem} apostou ${pokerFichas(u.valor)}.`,
    aumentou: `${quem} aumentou para ${pokerFichas(u.valor)}.`, "all-in": `${quem} foi all-in.` }[u.acao] || "";
}
// A mão que acabou de fechar: quem levou o pote e, no showdown, as cartas.
function pokerAnteriorHtml(j) {
  const a = j.mesa?.anterior;
  if (!a) return "";
  const nome = (l) => (l === j.eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const titulo = a.vencedor === "empate" ? `Mão ${a.mao}: empate, pote dividido` : `Mão ${a.mao}: ${nome(a.vencedor)} levou ${pokerFichas(a.pote)} fichas`;
  const maos = a.maos ? ["desafiante", "desafiado"].map((l) => `<div class="pkr-showdown"><span>${nome(l)} · ${safeText(a.maos[l].nome)}</span><div>${a.maos[l].cartas.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>`).join("")
    + `<div class="pkr-showdown"><span>Mesa</span><div>${a.comunitarias.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>` : '<p class="ofc-nota">Sem showdown: a outra pessoa largou.</p>';
  return `<h3 class="xdz-sub">${titulo}</h3>${maos}`;
}
function pokerAcoesHtml(j, s) {
  const a = j.mesa.acoes;
  if (!a || j.estado !== "jogando") return "";
  const maior = Math.max(j.mesa.rodada.desafiante, j.mesa.rodada.desafiado);
  // A cada jogada nova o valor volta ao mínimo; enquanto a pessoa escolhe, fica.
  if (a.aumentar && s.valorDe !== j.id + ":" + j.n) { s.valor = a.aumentar.min; s.valorDe = j.id + ":" + j.n; }
  if (a.aumentar) s.valor = Math.min(a.aumentar.max, Math.max(a.aumentar.min, Number(s.valor) || a.aumentar.min));
  const aumentar = !a.aumentar ? "" : `<div class="pkr-aumentar"><input type="range" min="${a.aumentar.min}" max="${a.aumentar.max}" step="${j.mesa.blind / 2}" value="${s.valor}" aria-label="Quanto apostar" oninput="valorPoker(this.value)">
<input type="number" min="${a.aumentar.min}" max="${a.aumentar.max}" value="${s.valor}" aria-label="Fichas" oninput="valorPoker(this.value)">
${[["½ pote", 0.5], ["Pote", 1]].map(([rotulo, f]) => { const v = Math.round(maior + f * (j.mesa.pote + a.pagar)); return v > a.aumentar.min && v < a.aumentar.max ? `<button type="button" class="workflow-secondary" onclick="valorPoker(${v})">${rotulo}</button>` : ""; }).join("")}
${a.aumentar.max > a.aumentar.min ? `<button type="button" class="workflow-secondary" onclick="valorPoker(${a.aumentar.max});aumentarPoker(this)">All-in (${pokerFichas(a.aumentar.max)})</button>` : ""}
<button type="button" class="workflow-primary" id="pkr-aumentar" onclick="aumentarPoker(this)">${s.valor >= a.aumentar.max ? "All-in" : maior ? "Aumentar para " + pokerFichas(s.valor) : "Apostar " + pokerFichas(s.valor)}</button></div>`;
  return `<div class="pkr-acoes"><button type="button" class="workflow-secondary" onclick="lanceMesaEscritorio('pkr',{tipo:'largar'},this)">Largar</button>
${a.mesa ? `<button type="button" class="workflow-primary" onclick="lanceMesaEscritorio('pkr',{tipo:'mesa'},this)">Passar</button>` : `<button type="button" class="workflow-primary" onclick="lanceMesaEscritorio('pkr',{tipo:'pagar'},this)">Pagar ${pokerFichas(a.pagar)}</button>`}</div>${aumentar}`;
}
function desenharPoker(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const detalhe = (l) => `${pokerFichas(m.fichas[l])} fichas${m.botao === l ? " · botão" : ""}${m.rodada[l] ? ` · ${pokerFichas(m.rodada[l])} na mesa` : ""}`;
  const minhas = eu && m.minhas ? m.minhas.map((c) => pokerCartaHtml(c, "grande")).join("") : pokerCartaHtml(null, "grande") + pokerCartaHtml(null, "grande");
  const mesa = [0, 1, 2, 3, 4].map((i) => (m.comunitarias[i] ? pokerCartaHtml(m.comunitarias[i]) : '<span class="pkr-carta vaga" aria-hidden="true"></span>')).join("");
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : m.acoes?.mesa ? "Sua vez: passe, aposte ou largue." : `Sua vez: pague ${pokerFichas(m.acoes?.pagar)}, aumente ou largue.`;
  const ultimo = pokerUltimoTexto(j);
  // Mão nova: as cartas entram com animação uma vez (a tela relê a cada 4 s).
  const nova = s.maoVista !== undefined && s.maoVista !== j.id + ":" + m.mao;
  s.maoVista = j.id + ":" + m.mao;
  if (nova) escritorioTocar(700, 0.05, 0.04);
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, detalhe(cima))}
<div class="pkr-mesa"><div class="pkr-dele">${pokerCartaHtml(null, "mini")}${pokerCartaHtml(null, "mini")}</div>
<div class="pkr-centro"><div class="pkr-comunitarias">${mesa}</div><p class="pkr-pote">Pote <b>${pokerFichas(m.pote)}</b></p>
<small>Mão ${m.mao} · ${POKER_FASES[m.fase] || ""} · blinds ${pokerFichas(m.blind / 2)}/${pokerFichas(m.blind)}</small></div></div>
${mesaJogadorHtml(j, baixo, detalhe(baixo))}<div class="pkr-minhas${nova ? " nova" : ""}">${minhas}</div>${m.minha_mao ? `<p class="pkr-tenho">Você tem: <b>${safeText(m.minha_mao)}</b>${nova ? ` · <span>Mão ${m.mao}</span>` : ""}</p>` : ""}${eu ? pokerAcoesHtml(j, s) : ""}`,
    painel: `${ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : ""}${pokerAnteriorHtml(j)}`,
  };
}
// O valor da aposta muda sem redesenhar a mesa (só os campos e o botão).
function valorPoker(v) {
  const s = escritorioMesa("pkr"), a = s.jogo?.mesa?.acoes?.aumentar;
  if (!a) return;
  s.valor = Math.min(a.max, Math.max(a.min, Math.floor(Number(v) || a.min)));
  document.querySelectorAll(".pkr-aumentar input").forEach((el) => { if (document.activeElement !== el) el.value = s.valor; });
  const b = document.getElementById("pkr-aumentar"), maior = Math.max(s.jogo.mesa.rodada.desafiante, s.jogo.mesa.rodada.desafiado);
  if (b) b.textContent = s.valor >= a.max ? "All-in" : maior ? "Aumentar para " + pokerFichas(s.valor) : "Apostar " + pokerFichas(s.valor);
}
function aumentarPoker(botao) {
  const s = escritorioMesa("pkr");
  lanceMesaEscritorio("pkr", { tipo: "aumentar", valor: s.valor }, botao);
}
