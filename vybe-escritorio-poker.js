// Pôquer na mesa do saloon do Escritório (pedido do Paulo, 27/10/2026): Texas
// Hold'em de dois a oito, até um ficar com todas as fichas, de graça ou
// valendo VybeCoins (a dois, também móveis/roupas). Convite e aposta são as telas do xadrez; a moldura
// da partida é a das mesas (vybe-escritorio-mesas.js). Baralho, cartas e
// fichas ficam no servidor (server/escritorio-poker.js); aqui só se desenha a
// mesa e se pede a jogada. Aviso pelo balão de comando (pkr=<id>:<para>:<c|l>).
//
// Mesa no jeito das salas online (28/10/2026, Paulo: "tá bem ruim ainda,
// tudo"): até 8 lugares em volta do feltro (eu embaixo), as fichas de cada
// aposta na frente de quem apostou, indo para o pote quando a rodada fecha e
// do pote para quem ganhou; as cartas saem do centro para cada lugar na mão
// nova; o balão com a fala dos clientes (os bots, com as piadas sobre as
// demandas) e a barra de ações embaixo (largar, passar/pagar e aumentar com
// os atalhos de valor).
const ESCRITORIO_POKER = /^wildwest_table$/;
const POKER_CFG = registrarMesaEscritorio({
  nome: "Pôquer", artigo: "o pôquer", extra: { jogo: "poker" }, sinal: "pkr", grupo: 8,
  som: (j, antes) => (j.mesa?.mao !== antes?.mesa?.mao ? "embaralhar" : ["pagou", "apostou", "aumentou", "all-in"].includes(j.mesa?.ultimo?.acao) ? "fichas"
    : j.mesa?.comunitarias?.length !== antes?.mesa?.comunitarias?.length ? "carta" : j.mesa?.ultimo?.acao === "mesa" ? "ficha" : "carta"),
  nota: "Texas Hold'em de 2 a 8 na mesa: cada um começa com 1.000 fichas e ganha quem ficar com todas. Dá para chamar os clientes da Vybe para completar a mesa.", desenhar: (j, s) => desenharPoker(j, s),
});
const POKER_NAIPES = { s: ["♠", "espadas"], h: ["♥", "copas"], d: ["♦", "ouros"], c: ["♣", "paus"] };
const POKER_FASES = { preflop: "Pré-flop", flop: "Flop", turn: "Turn", river: "River" };

function abrirPokerEscritorio(m) {
  return abrirMesaEscritorio(m, POKER_CFG);
}
function pokerSinalEscritorio(de, v) {
  mesaSinalEscritorio(POKER_CFG, de, v);
}
// Cartas desenhadas (Boardgame Pack do Kenney, CC0; assets/jogos/cartas.webp):
// uma folha com 13 colunas (A, 2…10, J, Q, K) e as linhas espadas, copas,
// ouros e paus, mais a dos versos; o CSS recorta pela coluna e pela linha.
const POKER_COLUNA = { A: 0, T: 9, J: 10, Q: 11, K: 12 }, POKER_LINHA = { s: 0, h: 1, d: 2, c: 3 };
function pokerCartaHtml(c, cls = "") {
  if (!c) return `<span class="pkr-carta img costas ${cls}" style="--cx:0;--cy:4" role="img" aria-label="Carta virada"></span>`;
  const valor = c[0] === "T" ? "10" : c[0], [, nome] = POKER_NAIPES[c[1]];
  const coluna = POKER_COLUNA[c[0]] ?? Number(c[0]) - 1;
  return `<span class="pkr-carta img ${cls}" style="--cx:${coluna};--cy:${POKER_LINHA[c[1]]}" role="img" aria-label="${valor} de ${nome}"></span>`;
}
const pokerFichas = (n) => Number(n || 0).toLocaleString("pt-BR");
const pokerMaior = (m) => Math.max(0, ...Object.values(m.rodada || {}));
const pokerNome = (j, l) => (l === j.eu ? "Você" : xadrezPrimeiroNome(j[l]));

// Pilha de fichas para um valor (folha assets/jogos/fichas.webp, cinco cores
// da menor para a maior): uma ficha por casa decimal, a de cima na cor do valor.
function pokerPilhaHtml(v) {
  const n = Math.max(1, Math.min(5, String(Math.round(v)).length));
  return `<span class="pkr-pilha" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i style="--f:${k};--k:${k}"></i>`).join("")}</span>`;
}

function pokerUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u || u.mao !== j.mesa.mao) return "";
  const quem = pokerNome(j, u.lado);
  return { largou: `${quem} largou.`, mesa: `${quem} passou.`, pagou: `${quem} pagou ${pokerFichas(u.valor)}.`, apostou: `${quem} apostou ${pokerFichas(u.valor)}.`,
    aumentou: `${quem} aumentou para ${pokerFichas(u.valor)}.`, "all-in": `${quem} foi all-in.`, saiu: `${quem} saiu da mesa.` }[u.acao] || "";
}
// A mão que acabou de fechar: quem levou o pote e, no showdown, as cartas.
function pokerAnteriorHtml(j) {
  const a = j.mesa?.anterior;
  if (!a) return "";
  const nome = (l) => pokerNome(j, l);
  // Pote paralelo (all-in de valores diferentes): quem mais levou fichas.
  const outros = Object.entries(a.ganhos || {}).filter(([l]) => l !== a.vencedor);
  const titulo = a.vencedor === "empate" ? `Mão ${a.mao}: empate, pote dividido` : outros.length
    ? `Mão ${a.mao}: ${nome(a.vencedor)} levou ${pokerFichas(a.ganhos[a.vencedor])} fichas · ${outros.map(([l, v]) => `${nome(l)} ${pokerFichas(v)}`).join(" · ")} no pote paralelo`
    : `Mão ${a.mao}: ${nome(a.vencedor)} levou ${pokerFichas(a.pote)} fichas`;
  const maos = a.maos ? Object.keys(a.maos).map((l) => `<div class="pkr-showdown"><span>${nome(l)} · ${safeText(a.maos[l].nome)}</span><div>${a.maos[l].cartas.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>`).join("")
    + `<div class="pkr-showdown"><span>Mesa</span><div>${a.comunitarias.map((c) => pokerCartaHtml(c, "mini")).join("")}</div></div>` : `<p class="ofc-nota">Sem showdown: ${j.grupo ? "os outros largaram" : "a outra pessoa largou"}.</p>`;
  return `<h3 class="xdz-sub">${titulo}</h3>${maos}`;
}
// O que os clientes disseram (as últimas falas), no histórico embaixo da mesa.
function pokerFalasHtml(j) {
  const f = (j.falas || []).slice(-4).reverse();
  return f.length ? `<ul class="pkr-falas">${f.map((x) => `<li><b>${safeText(xadrezPrimeiroNome(j[x.lado]))}:</b> ${safeText(x.texto)}</li>`).join("")}</ul>` : "";
}

// Barra de ações (como nas salas online): Largar, Passar/Pagar e o bloco de
// aumentar com os atalhos (mínimo, ½ pote, pote, all-in), a barra e o valor.
function pokerAcoesHtml(j, s) {
  const a = j.mesa.acoes;
  if (!a || j.estado !== "jogando") return "";
  const maior = pokerMaior(j.mesa);
  // A cada jogada nova o valor volta ao mínimo; enquanto a pessoa escolhe, fica.
  if (a.aumentar && s.valorDe !== j.id + ":" + j.n) { s.valor = a.aumentar.min; s.valorDe = j.id + ":" + j.n; }
  if (a.aumentar) s.valor = Math.min(a.aumentar.max, Math.max(a.aumentar.min, Number(s.valor) || a.aumentar.min));
  const atalhos = !a.aumentar ? [] : [["Mín.", a.aumentar.min], ["½ pote", Math.round(maior + 0.5 * (j.mesa.pote + a.pagar))], ["Pote", Math.round(maior + j.mesa.pote + a.pagar)], ["All-in", a.aumentar.max]]
    .filter(([, v], i) => i === 0 || i === 3 || (v > a.aumentar.min && v < a.aumentar.max));
  const aumentar = !a.aumentar ? "" : `<div class="pkr-aumentar"><div class="pkr-atalhos">${atalhos.map(([r, v]) => `<button type="button" onclick="valorPoker(${v})">${r}</button>`).join("")}</div>
<div class="pkr-valor"><input type="range" min="${a.aumentar.min}" max="${a.aumentar.max}" step="${Math.max(1, j.mesa.blind / 2)}" value="${s.valor}" aria-label="Quanto apostar" oninput="valorPoker(this.value)">
<input type="number" min="${a.aumentar.min}" max="${a.aumentar.max}" value="${s.valor}" aria-label="Fichas" oninput="valorPoker(this.value)"></div></div>
<button type="button" class="pkr-botao aumentar" id="pkr-aumentar" onclick="aumentarPoker(this)">${pokerRotuloAumentar(s.valor, a, maior)}</button>`;
  return `<div class="pkr-barra"><button type="button" class="pkr-botao largar" onclick="lanceMesaEscritorio('pkr',{tipo:'largar'},this)">Largar</button>
${a.mesa ? `<button type="button" class="pkr-botao passar" onclick="lanceMesaEscritorio('pkr',{tipo:'mesa'},this)">Passar</button>` : `<button type="button" class="pkr-botao pagar" onclick="lanceMesaEscritorio('pkr',{tipo:'pagar'},this)">Pagar <b>${pokerFichas(a.pagar)}</b></button>`}
${aumentar}</div>`;
}
const pokerRotuloAumentar = (v, a, maior) => (v >= a.aumentar.max ? `All-in <b>${pokerFichas(v)}</b>` : `${maior ? "Aumentar para" : "Apostar"} <b>${pokerFichas(v)}</b>`);

// Lugares em volta do feltro: eu embaixo, os outros na ordem da mesa, no
// sentido horário. A posição (em % da mesa) do lugar, da aposta dele (entre
// o lugar e o centro) e do botão do dealer.
function pokerPosicoes(n) {
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n, cx = Math.cos(a), cy = Math.sin(a);
    return { x: 50 + 44 * cx, y: 50 + 40 * cy, bx: 50 + 29 * cx, by: 50 + 24 * cy, dx: 50 + 33 * cx + 7 * cy, dy: 50 + 28 * cy - 7 * cx };
  });
}
const POKER_ACOES = { largou: "Largou", mesa: "Passou", pagou: "Pagou", apostou: "Apostou", aumentou: "Aumentou", "all-in": "All-in", saiu: "Saiu" };
function pokerLugarHtml(j, l, p, revela, fala) {
  const m = j.mesa, pessoa = j[l], u = mesaCabecaUrl(j, pessoa), eu = l === j.eu, vez = j.estado === "jogando" && j.vez === l;
  const fora = (m.fora || []).includes(l), saiu = (m.saiu || []).includes(l), semFichas = !(m.na_mao || m.lados || []).includes(l);
  const a = m.anterior, ganhou = revela && a && (a.vencedor === l || (a.ganhos?.[l] && a.vencedor === "empate"));
  const show = revela && a?.maos?.[l];
  // Cartas: as minhas de frente; dos outros, viradas (ou as do showdown).
  const cartas = saiu || semFichas ? "" : show ? show.cartas.map((c) => pokerCartaHtml(c, eu ? "grande" : "media")).join("")
    : eu && m.minhas ? m.minhas.map((c) => pokerCartaHtml(c, "grande")).join("") : fora ? "" : pokerCartaHtml(null, "pequena") + pokerCartaHtml(null, "pequena");
  const u2 = m.ultimo, acao = u2 && u2.mao === m.mao && u2.lado === l ? u2.acao : null;
  const legenda = saiu ? "Saiu da mesa" : semFichas ? "Sem fichas" : ganhou ? `Vencedor${show?.nome ? " · " + safeText(show.nome) : ""}` : show ? safeText(show.nome)
    : acao ? `${POKER_ACOES[acao] || ""}${u2.valor && acao !== "largou" ? " " + pokerFichas(u2.valor) : ""}` : vez ? (eu ? "Sua vez" : "Pensando…") : "";
  const cabeca = pessoa?.cliente ? `<i class="pkr-cliente" style="--c:${safeText(pessoa.cor || "#555")}">${safeText(pessoa.iniciais || "?")}</i>`
    : u ? `<img src="${safeText(u)}" alt="" width="44" height="44">` : "<i class=\"pkr-sem\"></i>";
  return `<div class="pkr-lugar${vez ? " vez" : ""}${fora || saiu || semFichas ? " fora" : ""}${ganhou ? " ganhou" : ""}${eu ? " eu" : ""}${p.y < 50 ? " em-cima" : ""}" style="left:${p.x}%;top:${p.y}%">
${fala ? `<p class="pkr-fala">${safeText(fala)}</p>` : ""}<div class="pkr-cartas-lugar">${cartas}</div>
<div class="pkr-quem">${cabeca}<div><b title="${safeText(pessoa?.nome || "")}">${pessoa?.cliente ? safeText(pessoa.nome) : xadrezPrimeiroNome(pessoa)}${eu ? " (você)" : ""}</b><span>${pokerFichas(m.fichas?.[l])}</span></div>${vez ? mesaPrazoVezHtml(j) : ""}</div>
${legenda ? `<small class="pkr-legenda${acao ? " " + acao : ""}">${legenda}</small>` : ""}</div>`;
}
function desenharPoker(j, s) {
  const m = j.mesa, eu = j.eu, lados = m.lados || ["desafiante", "desafiado"];
  // Eu embaixo (quem assiste vê pelo primeiro); os outros na ordem da mesa depois de mim.
  const baixo = eu || lados[0], i = lados.indexOf(baixo), ordem = [baixo, ...lados.slice(i + 1), ...lados.slice(0, i)];
  const pos = Object.fromEntries(pokerPosicoes(ordem.length).map((p, k) => [ordem[k], p]));
  // A mão acabou de fechar e ninguém jogou a nova: mostra o showdown e o vencedor.
  const a = m.anterior, revela = Boolean(a) && (j.estado !== "jogando" || (a.mao === m.mao - 1 && (!m.ultimo || m.ultimo.mao !== m.mao)));
  const centro = revela && a.comunitarias?.length ? a.comunitarias : m.comunitarias;
  // Cartas da mesa que acabaram de sair (flop, turn, river) viram na hora; o pote que cresceu pulsa.
  const chaveMao = j.id + ":" + m.mao, vistas = s.mesaVista?.mao === chaveMao ? s.mesaVista.n : centro.length;
  const poteAgora = revela ? a.pote : m.pote, cresceu = s.poteVisto?.mao === chaveMao && poteAgora > s.poteVisto.v;
  s.mesaVista = { mao: chaveMao, n: centro.length }; s.poteVisto = { mao: chaveMao, v: poteAgora };
  if (centro.length > vistas) jogosSom("carta", 0.6);
  if (cresceu) jogosSom("fichas", 0.5);
  const cartasMesa = [0, 1, 2, 3, 4].map((k) => (centro[k] ? (k >= vistas ? `<span class="pkr-vira" style="--k:${k - vistas}">${pokerCartaHtml(centro[k])}</span>` : pokerCartaHtml(centro[k])) : '<span class="pkr-carta vaga" aria-hidden="true"></span>')).join("");
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : (m.saiu || []).includes(eu) ? "Você saiu da mesa: está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[j.vez])}.`
    : m.acoes?.mesa ? "Sua vez: passe, aposte ou largue." : `Sua vez: pague ${pokerFichas(m.acoes?.pagar)}, aumente ou largue.`;
  const ultimo = pokerUltimoTexto(j);
  // Mão nova: as cartas saem do centro para cada lugar, uma volta por vez.
  const nova = s.maoVista !== undefined && s.maoVista !== chaveMao;
  s.maoVista = chaveMao;
  if (nova) jogosSom("embaralhar", 0.5);
  // Fichas que voam: as apostas da rodada que fechou vão para o pote; o pote
  // da mão que fechou vai para quem ganhou (uma vez, quando aparece).
  const voos = [], rodadaAntes = s.rodadaVista?.mao === chaveMao ? s.rodadaVista : null;
  if (rodadaAntes && rodadaAntes.fase !== m.fase) for (const [l, v] of Object.entries(rodadaAntes.apostas)) if (v > 0 && pos[l]) voos.push({ de: [pos[l].bx, pos[l].by], para: [50, 58], v });
  s.rodadaVista = { mao: chaveMao, fase: m.fase, apostas: { ...(m.rodada || {}) } };
  const chaveFim = j.id + ":" + (a?.mao ?? "");
  if (revela && s.potePago !== undefined && s.potePago !== chaveFim) {
    for (const [l, v] of Object.entries(a.ganhos || {})) if (pos[l]) voos.push({ de: [50, 58], para: [pos[l].x, pos[l].y], v, ganho: true });
    jogosSom("fichas", 0.8);
  }
  if (revela || s.potePago === undefined) s.potePago = chaveFim;
  // As falas novas dos clientes aparecem em balão por cima do lugar (6 s).
  const agora = Date.now(), falas = j.falas || [];
  if (s.falaJogo !== j.id) { s.falaJogo = j.id; s.falaN = falas.length ? falas[falas.length - 1].n : -1; s.falas = {}; }
  for (const f of falas) if (f.n > s.falaN) { s.falas[f.lado] = { texto: f.texto, ate: agora + 6000 }; jogosSom("ficha", 0.25); }
  if (falas.length) s.falaN = Math.max(s.falaN, falas[falas.length - 1].n);
  const fala = (l) => (s.falas[l]?.ate > agora ? s.falas[l].texto : "");
  clearTimeout(s.falaTimer);
  const proxima = Math.min(...Object.values(s.falas).map((f) => f.ate).filter((t) => t > agora));
  if (Number.isFinite(proxima)) s.falaTimer = setTimeout(() => { if (escritorioMesa("pkr").jogo?.id === j.id) desenharJogoMesa("pkr"); }, proxima - agora + 50);
  const faixa = revela ? (a.vencedor === "empate" ? `Mão ${a.mao}: empate, pote dividido` : `${pokerNome(j, a.vencedor)} levou ${pokerFichas(a.ganhos?.[a.vencedor] ?? a.pote)}`) : "";
  const apostas = revela ? "" : ordem.filter((l) => m.rodada?.[l] > 0).map((l) => {
    const p = pos[l], novo = rodadaAntes?.fase === m.fase && (rodadaAntes.apostas?.[l] || 0) < m.rodada[l];
    return `<span class="pkr-aposta${novo ? " entrou" : ""}" style="left:${p.bx}%;top:${p.by}%;--dx:${(p.x - p.bx) * 7}px;--dy:${(p.y - p.by) * 5}px">${pokerPilhaHtml(m.rodada[l])}<b>${pokerFichas(m.rodada[l])}</b></span>`;
  }).join("");
  const dealer = pos[m.botao] ? `<span class="pkr-dealer" style="left:${pos[m.botao].dx}%;top:${pos[m.botao].dy}%" title="Botão">D</span>` : "";
  const naMao = ordem.filter((l) => (m.na_mao || []).includes(l));
  const dar = nova ? [0, 1].flatMap((c) => naMao.map((l, k) => `<span class="pkr-dando" style="--x:${pos[l].x - 50};--y:${pos[l].y - 50};--t:${(c * naMao.length + k) * 0.08}s"></span>`)).join("") : "";
  const voando = voos.map((v, k) => `<span class="pkr-voo${v.ganho ? " ganho" : ""}" style="left:${v.de[0]}%;top:${v.de[1]}%;--x:${v.para[0] - v.de[0]};--y:${v.para[1] - v.de[1]};--t:${k * 0.06}s">${pokerPilhaHtml(v.v)}</span>`).join("");
  return {
    status,
    mesa: `<div class="pkr-salao n${ordem.length}${nova ? " nova" : ""}"><div class="pkr-feltro"><span class="pkr-marca">VYBE</span></div>
<div class="pkr-centro">${revela ? `<p class="pkr-vencedor">${safeText(faixa)}</p>` : ""}<div class="pkr-comunitarias">${cartasMesa}</div>
<p class="pkr-pote${cresceu ? " cresceu" : ""}">${poteAgora ? pokerPilhaHtml(poteAgora) : ""}Pote <b>${pokerFichas(poteAgora)}</b></p>
<small>Mão ${m.mao} · ${POKER_FASES[m.fase] || ""} · blinds ${pokerFichas(m.blind / 2)}/${pokerFichas(m.blind)}</small></div>
${apostas}${dealer}${ordem.map((l) => pokerLugarHtml(j, l, pos[l], revela, fala(l))).join("")}${dar}${voando}</div>
${m.minha_mao && !revela ? `<p class="pkr-tenho">Você tem: <b>${safeText(m.minha_mao)}</b></p>` : ""}${eu ? pokerAcoesHtml(j, s) : ""}`,
    painel: `${pokerFalasHtml(j)}${ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : ""}${pokerAnteriorHtml(j)}`,
  };
}
// O valor da aposta muda sem redesenhar a mesa (só os campos e o botão).
function valorPoker(v) {
  const s = escritorioMesa("pkr"), a = s.jogo?.mesa?.acoes;
  if (!a?.aumentar) return;
  s.valor = Math.min(a.aumentar.max, Math.max(a.aumentar.min, Math.floor(Number(v) || a.aumentar.min)));
  document.querySelectorAll(".pkr-aumentar input").forEach((el) => { if (document.activeElement !== el) el.value = s.valor; });
  const b = document.getElementById("pkr-aumentar");
  if (b) b.innerHTML = pokerRotuloAumentar(s.valor, a, pokerMaior(s.jogo.mesa));
}
function aumentarPoker(botao) {
  const s = escritorioMesa("pkr");
  lanceMesaEscritorio("pkr", { tipo: "aumentar", valor: s.valor }, botao);
}

// --- Clientes na mesa (lobby do pôquer) ---------------------------------------
// Os clientes da Vybe como bots (Paulo, 28/10/2026): cada um com a carteira
// de VybeCoins dele e o jeito de jogar. Escolhe quem senta e joga na hora.
const POKER_NIVEL = { facil: "Joga solto", medio: "Joga sério", lendario: "Tubarão" };
function pokerClientesHtml(cfg) {
  const x = escritorioXadrez(), e = x.extras;
  if (cfg?.extra?.jogo !== "poker" || e?.jogo !== "poker" || !e.bots?.clientes?.length) return "";
  x.pkClientes ||= [];
  const saldo = Number(escritorio.base?.economia?.saldo || 0), valor = Math.min(saldo, Math.max(0, Number(x.pkValor) || 0));
  const escolhidos = new Set(x.pkClientes);
  const lista = e.bots.clientes.map((c) => {
    const sim = escolhidos.has(c.id), pobre = valor > c.saldo;
    return `<button type="button" class="pkr-cli${sim ? " sim" : ""}" aria-pressed="${sim}" onclick="pokerEscolherCliente('${safeText(c.id)}')" ${pobre && !sim ? "disabled" : ""}>
<i style="--c:${safeText(c.cor)}">${safeText(c.iniciais)}</i><b>${safeText(c.nome)}</b><small>${pokerFichas(c.saldo)} 🪙 · ${POKER_NIVEL[c.nivel] || ""}</small></button>`;
  }).join("");
  return `<section class="sala-mesa desafios pkr-clientes"><div class="sala-topo"><b>🃏 Jogar com os clientes</b><small class="desafio-teto">${x.pkClientes.length}/7 na mesa</small></div>
<p class="sala-dica">Cada cliente tem a própria carteira de VybeCoins (toda segunda, quem tem menos de 500 volta a 500) e solta umas piadas sobre as demandas no meio da partida.</p>
<div class="pkr-cli-lista">${lista}</div>
<div class="pkr-cli-rodape"><label>VybeCoins de cada um <input type="number" min="0" max="${saldo}" value="${valor}" oninput="escritorioXadrez().pkValor=Math.max(0,Math.min(${saldo},Math.floor(Number(this.value)||0)))" onchange="desenharSalaMesa(escritorioXadrez().sala||{},escritorioXadrez().salaCfg||escritorioXadrez().cfg)"></label>
<button type="button" class="sala-botao verde" onclick="pokerJogarComClientes(this)" ${x.pkClientes.length ? "" : "disabled"}>Sentar e jogar${x.pkClientes.length ? ` (${x.pkClientes.length + 1} na mesa)` : ""}</button></div></section>`;
}
function pokerEscolherCliente(id) {
  const x = escritorioXadrez();
  x.pkClientes ||= [];
  if (x.pkClientes.includes(id)) x.pkClientes = x.pkClientes.filter((c) => c !== id);
  else if (x.pkClientes.length < 7) x.pkClientes.push(id);
  else return escritorioAviso("A mesa é de até 8 lugares: você e mais 7.");
  desenharSalaMesa(x.sala || {}, x.salaCfg || x.cfg);
}
async function pokerJogarComClientes(botao) {
  const x = escritorioXadrez(), cfg = POKER_CFG;
  if (!x.pkClientes?.length) return;
  botao.disabled = true;
  try {
    const r = await escritorioApi(cfg.desafiar, { ...cfg.extra, clientes: x.pkClientes, ...(x.mesa || { camada: escritorio.quarto || "jogos", movel: "wildwest_table@0,0" }), moedas: Number(x.pkValor) || 0, chave: xadrezChave() });
    if (r.economia) xadrezEconomia(r.economia);
    x.cfg = cfg; x.extras = null; x.pkClientes = [];
    cfg.abrir(r.jogo);
  } catch (e) {
    botao.disabled = false;
    const el = document.getElementById("xdz-erro");
    if (el) el.textContent = e.message; else escritorioAviso(e.message);
  }
}
