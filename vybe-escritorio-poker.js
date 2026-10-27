// Pôquer na mesa do saloon do Escritório (pedido do Paulo, 27/10/2026): Texas
// Hold'em de dois a quatro, até um ficar com todas as fichas, de graça ou
// valendo VybeCoins (a dois, também móveis/roupas). Convite e aposta são as telas do xadrez; a moldura
// da partida é a das mesas (vybe-escritorio-mesas.js). Baralho, cartas e
// fichas ficam no servidor (server/escritorio-poker.js); aqui só se desenha a
// mesa e se pede a jogada. Aviso pelo balão de comando (pkr=<id>:<para>:<c|l>).
const ESCRITORIO_POKER = /^wildwest_table$/;
const POKER_CFG = registrarMesaEscritorio({
  nome: "Pôquer", artigo: "o pôquer", extra: { jogo: "poker" }, sinal: "pkr", grupo: 4,
  nota: "Texas Hold'em de 2 a 4 na mesa: cada um começa com 1.000 fichas e ganha quem ficar com todas.", desenhar: (j, s) => desenharPoker(j, s),
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
const pokerMaior = (m) => Math.max(0, ...Object.values(m.rodada || {}));

function pokerUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u || u.mao !== j.mesa.mao) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  return { largou: `${quem} largou.`, mesa: `${quem} passou.`, pagou: `${quem} pagou ${pokerFichas(u.valor)}.`, apostou: `${quem} apostou ${pokerFichas(u.valor)}.`,
    aumentou: `${quem} aumentou para ${pokerFichas(u.valor)}.`, "all-in": `${quem} foi all-in.`, saiu: `${quem} saiu da mesa.` }[u.acao] || "";
}
// A mão que acabou de fechar: quem levou o pote e, no showdown, as cartas.
function pokerAnteriorHtml(j) {
  const a = j.mesa?.anterior;
  if (!a) return "";
  const nome = (l) => (l === j.eu ? "Você" : xadrezPrimeiroNome(j[l]));
  // Pote paralelo (all-in de valores diferentes): quem mais levou fichas.
  const outros = Object.entries(a.ganhos || {}).filter(([l]) => l !== a.vencedor);
  const titulo = a.vencedor === "empate" ? `Mão ${a.mao}: empate, pote dividido` : outros.length
    ? `Mão ${a.mao}: ${nome(a.vencedor)} levou ${pokerFichas(a.ganhos[a.vencedor])} fichas · ${outros.map(([l, v]) => `${nome(l)} ${pokerFichas(v)}`).join(" · ")} no pote paralelo`
    : `Mão ${a.mao}: ${nome(a.vencedor)} levou ${pokerFichas(a.pote)} fichas`;
  const maos = a.maos ? Object.keys(a.maos).map((l) => `<div class="pkr-showdown"><span>${nome(l)} · ${safeText(a.maos[l].nome)}</span><div>${a.maos[l].cartas.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>`).join("")
    + `<div class="pkr-showdown"><span>Mesa</span><div>${a.comunitarias.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>` : `<p class="ofc-nota">Sem showdown: ${j.grupo ? "os outros largaram" : "a outra pessoa largou"}.</p>`;
  return `<h3 class="xdz-sub">${titulo}</h3>${maos}`;
}
function pokerAcoesHtml(j, s) {
  const a = j.mesa.acoes;
  if (!a || j.estado !== "jogando") return "";
  const maior = pokerMaior(j.mesa);
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
// Mesa oval no jeito das salas de pôquer online (Paulo, 27/10/2026, com as
// referências): eu embaixo, os outros em volta na ordem da mesa (à esquerda,
// em cima, à direita), cada um com cabeça, nome, fichas, cartas, a aposta da
// rodada na frente e o botão "D". Quando a mão fecha, a mesa mostra as cartas
// de quem foi ao showdown e marca o vencedor até alguém jogar a mão nova.
const POKER_LUGARES = { 1: ["topo"], 2: ["esq-topo", "dir-topo"], 3: ["esq", "topo", "dir"] };
const POKER_ACOES = { largou: "Largou", mesa: "Passou", pagou: "Pagou", apostou: "Apostou", aumentou: "Aumentou", "all-in": "All-in", saiu: "Saiu" };
function pokerLugarHtml(j, l, pos, revela) {
  const m = j.mesa, p = j[l], u = escritorioCabecaUrl(p.id), eu = l === j.eu, vez = j.estado === "jogando" && j.vez === l;
  const fora = (m.fora || []).includes(l), saiu = (m.saiu || []).includes(l), semFichas = !(m.na_mao || m.lados || []).includes(l);
  const a = m.anterior, ganhou = revela && a && (a.vencedor === l || (a.ganhos?.[l] && a.vencedor === "empate"));
  const show = revela && a?.maos?.[l];
  // Cartas: as minhas de frente; dos outros, viradas (ou as do showdown).
  const cartas = saiu || semFichas ? "" : show ? show.cartas.map((c) => pokerCartaHtml(c, eu ? "grande" : "media")).join("")
    : eu && m.minhas ? m.minhas.map((c) => pokerCartaHtml(c, "grande")).join("") : fora ? "" : pokerCartaHtml(null, "media") + pokerCartaHtml(null, "media");
  const u2 = m.ultimo, acao = u2 && u2.mao === m.mao && u2.lado === l ? `${POKER_ACOES[u2.acao] || ""}${u2.valor && u2.acao !== "largou" ? " " + pokerFichas(u2.valor) : ""}` : "";
  const aposta = m.rodada?.[l] ? `<span class="pkr-aposta"><i aria-hidden="true"></i>${pokerFichas(m.rodada[l])}</span>` : "";
  const legenda = saiu ? "Saiu da mesa" : semFichas ? "Sem fichas" : ganhou ? `Vencedor · ${safeText(show?.nome || "")}`.replace(/ · $/, "") : show ? safeText(show.nome) : acao || (vez ? (eu ? "Sua vez" : "Pensando…") : "");
  return `<div class="pkr-lugar ${pos}${vez ? " vez" : ""}${fora || saiu || semFichas ? " fora" : ""}${ganhou ? " ganhou" : ""}${eu ? " eu" : ""}">
<div class="pkr-cartas-lugar">${cartas}</div>
<div class="pkr-quem">${u ? `<img src="${safeText(u)}" alt="" width="48" height="48">` : "<i class=\"pkr-sem\"></i>"}${m.botao === l ? '<span class="pkr-dealer" title="Botão">D</span>' : ""}
<div><b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><span>${pokerFichas(m.fichas?.[l])}</span></div></div>
${legenda ? `<small class="pkr-legenda">${legenda}</small>` : ""}${vez ? mesaPrazoVezHtml(j) : ""}${aposta}</div>`;
}
function desenharPoker(j, s) {
  const m = j.mesa, eu = j.eu, lados = m.lados || ["desafiante", "desafiado"];
  // Eu embaixo (quem assiste vê pelo primeiro); os outros na ordem da mesa depois de mim.
  const baixo = eu || lados[0], i = lados.indexOf(baixo), outros = [...lados.slice(i + 1), ...lados.slice(0, i)];
  const pos = POKER_LUGARES[outros.length] || POKER_LUGARES[3];
  // A mão acabou de fechar e ninguém jogou a nova: mostra o showdown e o vencedor.
  const a = m.anterior, revela = Boolean(a) && (j.estado !== "jogando" || (a.mao === m.mao - 1 && (!m.ultimo || m.ultimo.mao !== m.mao)));
  const centro = revela && a.comunitarias?.length ? a.comunitarias : m.comunitarias;
  const mesa = [0, 1, 2, 3, 4].map((k) => (centro[k] ? pokerCartaHtml(centro[k]) : '<span class="pkr-carta vaga" aria-hidden="true"></span>')).join("");
  const nome = (l) => (l === eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : (m.saiu || []).includes(eu) ? "Você saiu da mesa: está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[j.vez])}.`
    : m.acoes?.mesa ? "Sua vez: passe, aposte ou largue." : `Sua vez: pague ${pokerFichas(m.acoes?.pagar)}, aumente ou largue.`;
  const ultimo = pokerUltimoTexto(j);
  // Mão nova: as cartas entram com animação uma vez (a tela relê a cada 4 s).
  const nova = s.maoVista !== undefined && s.maoVista !== j.id + ":" + m.mao;
  s.maoVista = j.id + ":" + m.mao;
  if (nova) escritorioTocar(700, 0.05, 0.04);
  const faixa = revela ? (a.vencedor === "empate" ? `Mão ${a.mao}: empate, pote dividido` : `${nome(a.vencedor)} levou ${pokerFichas(a.ganhos?.[a.vencedor] ?? a.pote)}`) : "";
  return {
    status,
    mesa: `<div class="pkr-salao${nova ? " nova" : ""}"><div class="pkr-feltro"><div class="pkr-centro">
${revela ? `<p class="pkr-vencedor">${safeText(faixa)}</p>` : ""}<div class="pkr-comunitarias">${mesa}</div>
<p class="pkr-pote"><i aria-hidden="true"></i>Total do pote: <b>${pokerFichas(revela ? a.pote : m.pote)}</b></p>
<small>Mão ${m.mao} · ${POKER_FASES[m.fase] || ""} · blinds ${pokerFichas(m.blind / 2)}/${pokerFichas(m.blind)}</small></div></div>
${outros.map((l, k) => pokerLugarHtml(j, l, pos[k], revela)).join("")}${pokerLugarHtml(j, baixo, "baixo", revela)}</div>
${m.minha_mao && !revela ? `<p class="pkr-tenho">Você tem: <b>${safeText(m.minha_mao)}</b></p>` : ""}${eu ? pokerAcoesHtml(j, s) : ""}`,
    painel: `${ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : ""}${pokerAnteriorHtml(j)}`,
  };
}
// O valor da aposta muda sem redesenhar a mesa (só os campos e o botão).
function valorPoker(v) {
  const s = escritorioMesa("pkr"), a = s.jogo?.mesa?.acoes?.aumentar;
  if (!a) return;
  s.valor = Math.min(a.max, Math.max(a.min, Math.floor(Number(v) || a.min)));
  document.querySelectorAll(".pkr-aumentar input").forEach((el) => { if (document.activeElement !== el) el.value = s.valor; });
  const b = document.getElementById("pkr-aumentar"), maior = pokerMaior(s.jogo.mesa);
  if (b) b.textContent = s.valor >= a.max ? "All-in" : maior ? "Aumentar para " + pokerFichas(s.valor) : "Apostar " + pokerFichas(s.valor);
}
function aumentarPoker(botao) {
  const s = escritorioMesa("pkr");
  lanceMesaEscritorio("pkr", { tipo: "aumentar", valor: s.valor }, botao);
}
