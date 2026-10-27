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
  nota: "Até 100 pontos, em várias mãos; começa quem tem a maior carroça.", desenhar: (j, s) => desenharDomino(j, s),
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
// Peças desenhadas (Domino Pack do Kenney, CC0; assets/jogos/domino.webp): a
// folha tem as 28 peças em pé (menor em cima), 7 por linha, e o verso. A peça
// gira para mostrar o primeiro número no começo da fileira (à esquerda ou em cima).
const DOMINO_INDICE = (() => { const m = {}; let k = 0; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) m[a + "_" + b] = k++; return m; })();
function dominoPecaHtml([a, b], cls = "") {
  const lo = Math.min(a, b), hi = Math.max(a, b), k = DOMINO_INDICE[lo + "_" + hi], deitada = /deitada/.test(cls);
  const giro = deitada ? (a === lo ? -90 : 90) : (a === lo ? 0 : 180);
  return `<span class="dmn-peca img ${cls}" role="img" aria-label="${a} e ${b}"><i style="--cx:${k % 7};--cy:${Math.floor(k / 7)};--giro:${giro}deg"></i></span>`;
}

// A fileira no jeito dos dominós online (Paulo, 27/10/2026, com a
// referência): as peças correm deitadas; na borda a fileira vira para baixo
// com duas peças em pé e volta no sentido contrário. Carroça fica atravessada.
// Posições em unidades (meia peça = 1); a mesa tem DOMINO_LARGURA de largura.
const DOMINO_LARGURA = 26;
function dominoCobra(linha) {
  const pos = [];
  let x = 0, yc = 1, dir = 1, curva = 0, cy = 0, coluna = 0;
  for (const p of linha) {
    const dupla = p[0] === p[1];
    if (curva) {
      // Descendo pela coluna da curva: em pé (a carroça atravessada).
      const h = dupla ? 1 : 2, w = dupla ? 2 : 1;
      pos.push({ p, x: coluna + 0.5 - w / 2, y: cy, w, h, o: dupla ? "h" : "v", ordem: [p[0], p[1]] });
      cy += h;
      // Fim da curva: a fileira volta encostada na última peça dela.
      if (--curva === 0) { const u = pos[pos.length - 1]; yc = cy - 0.5; dir = -dir; x = dir < 0 ? u.x : u.x + u.w; }
      continue;
    }
    const w = dupla ? 1 : 2, h = dupla ? 2 : 1;
    // Não cabe mais nesta fileira: começa a curva (reserva a coluna da borda).
    if (dir > 0 ? x + w > DOMINO_LARGURA - 1 : x - w < 1) {
      coluna = dir > 0 ? x : x - 1;
      cy = yc - 0.5; curva = 2;
      const hh = dupla ? 1 : 2, ww = dupla ? 2 : 1;
      pos.push({ p, x: coluna + 0.5 - ww / 2, y: cy, w: ww, h: hh, o: dupla ? "h" : "v", ordem: [p[0], p[1]] });
      cy += hh; curva--;
      continue;
    }
    const x0 = dir > 0 ? x : x - w;
    pos.push({ p, x: x0, y: yc - h / 2, w, h, o: dupla ? "v" : "h", ordem: dir > 0 ? [p[0], p[1]] : [p[1], p[0]] });
    x = dir > 0 ? x + w : x - w;
  }
  return pos;
}
function dominoLinhaHtml(j, s) {
  const m = j.mesa;
  if (!m.linha.length) {
    const quem = j.vez === j.eu ? "Você abre" : `${xadrezPrimeiroNome(j[j.vez])} abre`;
    return `<div class="dmn-linha vazia"><span>${m.abertura ? `${quem} com a ${m.abertura[0]}|${m.abertura[1]}` : "Mesa vazia"}</span></div>`;
  }
  const escolher = s.sel ? (m.jogaveis.find((o) => dominoMesma(o.peca, s.sel))?.pontas || []) : [];
  const ultimo = m.ultimo?.acao === "jogou" ? m.ultimo.peca : null;
  const pos = dominoCobra(m.linha), alto = Math.max(...pos.map((q) => q.y + q.h));
  // A fileira fica no meio da mesa (antes começava grudada na borda esquerda).
  const de = Math.min(...pos.map((q) => q.x)), ate = Math.max(...pos.map((q) => q.x + q.w)), desloca = Math.max(0, (DOMINO_LARGURA - (ate - de)) / 2) - de;
  for (const q of pos) q.x += desloca;
  const pecas = pos.map((q, i) => {
    const ponta = i === 0 ? "esq" : i === pos.length - 1 ? "dir" : null, alvo = ponta && escolher.includes(ponta);
    const nova = ultimo && dominoMesma(q.p, ultimo) && ponta;
    const estilo = `left:calc(${q.x} * var(--u));top:calc(${q.y} * var(--u));width:calc(${q.w} * var(--u));height:calc(${q.h} * var(--u))`;
    const peca = dominoPecaHtml(q.ordem, `${q.o === "h" ? "deitada" : "empe"}${nova ? " nova" : ""}`);
    return alvo ? `<button type="button" class="dmn-lugar alvo" data-ponta="${ponta}" style="${estilo}" onclick="jogarDominoEscritorio('${ponta}')" aria-label="Jogar na ponta do ${ponta === "esq" ? m.pontas[0] : m.pontas[1]}">${peca}</button>`
      : `<span class="dmn-lugar" style="${estilo}">${peca}</span>`;
  }).join("");
  const botoes = escolher.length > 1 ? `<div class="dmn-escolher">${escolher.map((p) => `<button type="button" class="workflow-primary" onclick="jogarDominoEscritorio('${p}')">Na ponta do ${p === "esq" ? m.pontas[0] : m.pontas[1]}</button>`).join("")}</div>` : "";
  return `<div class="dmn-linha tabuleiro"><div class="dmn-cobra" style="--alto:${alto}">${pecas}</div></div>${botoes}`;
}
// As peças do outro, viradas, em cima da mesa.
function dominoDoOutroHtml(n) {
  return `<div class="dmn-outro" aria-label="${n} ${n === 1 ? "peça" : "peças"} na mão">${Array.from({ length: Math.min(n, 14) }, () => '<span class="dmn-virada"></span>').join("")}</div>`;
}
function dominoMaoHtml(j, s) {
  const m = j.mesa;
  // No fim as duas mãos aparecem no painel (dominoReveladoHtml).
  if (!m.mao || j.estado !== "jogando") return "";
  const minhaVez = j.vez === j.eu;
  const pecas = m.mao.map((p) => {
    const pode = minhaVez && m.jogaveis.some((o) => dominoMesma(o.peca, p)), sel = s.sel && dominoMesma(s.sel, p);
    return `<button type="button" class="dmn-mao-peca${pode ? " pode" : ""}${sel ? " sel" : ""}" ${pode ? `onclick="escolherPecaDomino(${p[0]},${p[1]})" onpointerdown="dominoArrastar(event,${p[0]},${p[1]})"` : "disabled"} aria-label="Peça ${p[0]} e ${p[1]}${pode ? ", pode jogar" : ""}">${dominoPecaHtml(p, "empe")}</button>`;
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
// A mão que acabou (partida até 100): quem levou e quantos pontos.
function dominoAnteriorHtml(j) {
  const a = j.mesa?.anterior;
  if (!a || j.estado !== "jogando") return "";
  const nome = (l) => (l === j.eu ? "Você" : xadrezPrimeiroNome(j[l]));
  const texto = a.vencedor === "empate" ? `Mão ${a.mao}: trancou empatado, ninguém pontuou.`
    : `Mão ${a.mao}: ${nome(a.vencedor)} ${a.motivo === "batida" ? "bateu" : "ganhou no trancado"} e fez ${a.ganho} ${a.ganho === 1 ? "ponto" : "pontos"}.`;
  return `<p class="ofc-nota">${safeText(texto)}</p>`;
}
function desenharDomino(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const pecas = (l) => `${m.pecas[l]} ${m.pecas[l] === 1 ? "peça" : "peças"}${m.alvo ? ` · ${m.placar[l]} de ${m.alvo} pts` : ""}`;
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : s.sel ? "A peça cabe nas duas pontas: toque na ponta acesa da mesa." : m.pode_comprar ? "Nenhuma peça encaixa: compre do monte." : m.pode_passar ? "Nenhuma peça encaixa e o monte acabou: passe a vez." : "Sua vez. Toque numa peça que encaixa.";
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const ultimo = dominoUltimoTexto(j);
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, pecas(cima))}
<div class="dmn-mesa">${dominoDoOutroHtml(m.pecas[cima])}${m.alvo ? `<div class="dmn-rodada">Mão ${m.numero_mao} · até ${m.alvo} pontos</div>` : ""}<div class="dmn-monte" title="Peças no monte"><span class="dmn-costas"></span><b>${m.monte}</b><small>no monte</small></div>${dominoLinhaHtml(j, s)}</div>
${mesaJogadorHtml(j, baixo, pecas(baixo))}${dominoMaoHtml(j, s)}`,
    painel: `${ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : ""}${dominoAnteriorHtml(j)}${dominoReveladoHtml(j)}`,
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
// Arrastar a peça da mão até a mesa (como nos dominós online): ao pegar, as
// pontas onde ela encaixa piscam; solta perto de uma ponta e a peça vai para
// ela (com uma ponta só, solta em qualquer lugar da mesa). Fora da mesa, volta.
function dominoArrastar(ev, a, b) {
  const s = escritorioMesa("dmn"), j = s.jogo;
  if (ev.button > 0 || !j || j.vez !== j.eu || s.enviando) return;
  const p = [a, b], op = j.mesa.jogaveis.find((o) => dominoMesma(o.peca, p)), peca = ev.currentTarget.querySelector(".dmn-peca");
  if (!op || !peca) return;
  const x0 = ev.clientX, y0 = ev.clientY;
  let fantasma = null;
  const mover = (e) => {
    if (!fantasma) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
      const r = peca.getBoundingClientRect();
      fantasma = peca.cloneNode(true);
      fantasma.classList.add("tab-fantasma");
      Object.assign(fantasma.style, { width: r.width + "px", height: r.height + "px" });
      document.body.append(fantasma);
      s.sel = p; desenharJogoMesa("dmn");
    }
    fantasma.style.transform = `translate(${e.clientX - fantasma.offsetWidth / 2}px,${e.clientY - fantasma.offsetHeight / 2}px) rotate(${Math.max(-12, Math.min(12, (e.clientX - x0) / 20))}deg)`;
  };
  const fim = (e) => {
    document.removeEventListener("pointermove", mover);
    document.removeEventListener("pointerup", fim);
    if (!fantasma) return;
    fantasma.remove();
    const solto = document.elementFromPoint(e.clientX, e.clientY);
    const engole = (c) => { c.stopPropagation(); c.preventDefault(); };
    document.addEventListener("click", engole, true);
    setTimeout(() => document.removeEventListener("click", engole, true), 60);
    if (!solto?.closest(".dmn-mesa")) { s.sel = null; desenharJogoMesa("dmn"); return; }
    // A ponta mais perto de onde soltou (ou a única que serve).
    let ponta = solto.closest("[data-ponta]")?.dataset.ponta;
    if (!ponta) {
      const alvos = [...document.querySelectorAll(".dmn-lugar.alvo[data-ponta]")].map((el) => { const r = el.getBoundingClientRect(); return [el.dataset.ponta, Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY)]; });
      ponta = alvos.sort((u, v) => u[1] - v[1])[0]?.[0] || op.pontas[op.pontas.length - 1];
    }
    lanceMesaEscritorio("dmn", { tipo: "jogar", peca: p, ponta });
  };
  document.addEventListener("pointermove", mover);
  document.addEventListener("pointerup", fim);
}
function jogarDominoEscritorio(ponta) {
  const s = escritorioMesa("dmn");
  if (s.sel) lanceMesaEscritorio("dmn", { tipo: "jogar", peca: s.sel, ponta });
}
