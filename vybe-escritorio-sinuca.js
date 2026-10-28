// Sinuca na mesa de bilhar do Escritório (pedido do Paulo, 27/10/2026): bola 8
// para dois, de graça ou valendo VybeCoins e móveis/roupas. Convite e aposta
// são as telas do xadrez; a moldura da partida é a das mesas
// (vybe-escritorio-mesas.js). A física roda no servidor
// (server/escritorio-sinuca.js): aqui se mira, escolhe a força, põe a branca
// quando tem bola na mão e anima os quadros que o servidor devolveu. Aviso
// pelo balão de comando (snc=<id>:<para>:<c|l>).
//
// Controles no jeito do 8 Ball Pool na web (Paulo, 27/10/2026: "tá impossível
// de jogar"; antes a mira seguia o mouse até o botão de tacar e mudava no
// caminho): os dois jogadores em cima com as bolas de cada grupo; a mira segue
// o mouse; segurar o botão na mesa e puxar o mouse para trás dá a força, e
// soltar taca (soltar sem puxar trava ou solta a mira). No celular o dedo
// mira e a força é a barra ao lado da mesa, puxada para baixo como o taco. O
// efeito se escolhe no ponto da bolinha branca (em cima segue, embaixo puxa,
// dos lados abre na tabela), e o botão Tacar usa a última força. As guias
// mostram para onde vão a bola acertada e a branca, e marcam com X a bola que
// não pode ser tocada primeiro.
const ESCRITORIO_SINUCA = /pooltable/;
const SINUCA_CFG = registrarMesaEscritorio({
  nome: "Sinuca", artigo: "a sinuca", extra: { jogo: "sinuca" }, sinal: "snc",
  // A tacada já toca os sons dela na animação.
  som: () => null,
  nota: "Par ou ímpar, como no bar: a mesa começa aberta e quem encaçapar primeiro fica com o grupo da bola que matou: par (as lisas) ou ímpar (as listradas). Limpe as suas e encaçape a 1 para ganhar.", desenhar: (j, s) => desenharSinuca(j, s),
});
// Mesa de 100 × 50 (o pano, 1,90 m × 0,95 m) com 8 de moldura em volta; 10 px
// por unidade no canvas. A moldura é a da arte da mesa de bar
// (assets/jogos/mesa-bar.webp, recortada com o pano a 8 unidades de cada borda).
const SINUCA_L = 100, SINUCA_A = 50, SINUCA_B = 8, SINUCA_PX = 10;
const SINUCA_MESA = typeof Image === "function" ? Object.assign(new Image(), { src: "/assets/jogos/mesa-bar.webp" }) : null;
SINUCA_MESA?.addEventListener?.("load", () => sinucaPintar());
const SINUCA_CORES = ["#f7f4ea", "#f2c12e", "#1f5fbf", "#d23a2a", "#6a3fa0", "#f07a1a", "#1e8a4a", "#8a2a1e", "#151515"];
// Jogo de bolas do par ou ímpar (Paulo, 28/10/2026: "par (bolas preenchidas) ou
// ímpar (bola com listra branca)"; "bola par com listra também, faz direito"):
// as pares são lisas, as ímpares listradas, e a 1 é lisa amarela (a bola
// final). Cores diferentes dentro de cada grupo. Na bola 8, o jogo americano.
const SINUCA_PARIMPAR = { 1: "#f2c12e", 2: "#1f5fbf", 4: "#6a3fa0", 6: "#1e8a4a", 8: "#151515", 10: "#f07a1a", 12: "#8a2a1e", 14: "#d23a2a",
  3: "#d23a2a", 5: "#f07a1a", 7: "#8a2a1e", 9: "#f2c12e", 11: "#1f5fbf", 13: "#6a3fa0", 15: "#1e8a4a" };
// Cor e listra de cada bola no jogo da partida.
function sinucaVisual(modo, n) {
  if (modo === "parimpar") return { cor: n ? SINUCA_PARIMPAR[n] : SINUCA_CORES[0], listra: n % 2 === 1 && n !== 1 };
  return { cor: SINUCA_CORES[n > 8 ? n - 8 : n], listra: n > 8 };
}
const SINUCA_DICA = { livre: "Sua vez: mire com o mouse. Segure o botão na mesa, puxe o mouse para trás e solte para tacar.",
  travada: "Mira travada. Segure na mesa, puxe para trás e solte (ou use a barra de força). Clique sem puxar para soltar a mira." };
// Quanto puxar o mouse (em unidades da mesa) para a força toda.
const SINUCA_PUXADA = 26;
const sinucaRaio = (j) => j?.mesa?.r || 1.15;
// Bolas desenhadas (8-Ball pool assets, CC0; assets/jogos/bolas.webp): folha
// com a branca e as 15 numeradas, 96 px cada, na ordem do número.
const SINUCA_BOLAS = typeof Image === "function" ? Object.assign(new Image(), { src: "/assets/jogos/bolas.webp" }) : null;
SINUCA_BOLAS?.addEventListener?.("load", () => sinucaPintar());

function abrirSinucaEscritorio(m) {
  return abrirMesaEscritorio(m, SINUCA_CFG);
}
function sinucaSinalEscritorio(de, v) {
  mesaSinalEscritorio(SINUCA_CFG, de, v);
}
function sinucaEstado() {
  return escritorioMesa("snc");
}
const sinucaMinhaVez = (j) => j?.estado === "jogando" && j.eu && j.vez === j.eu && j.mesa.pode_tacar;
const sinucaPondo = (j, s) => sinucaMinhaVez(j) && (j.mesa.bolaNaMao || !j.mesa.bolas[0]) && !s.branca;
// A branca de onde sai a tacada: a da mesa ou a que a pessoa acabou de pôr.
function sinucaBranca(j, s) {
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) return s.branca ? [s.branca.x, s.branca.y] : null;
  return j.mesa.bolas[0];
}
// Bola que eu posso tocar primeiro: do meu grupo (a 8 com o grupo limpo); mesa aberta, qualquer uma menos a 8.
const SINUCA_GRUPOS = { lisas: [1, 2, 3, 4, 5, 6, 7], listradas: [9, 10, 11, 12, 13, 14, 15], pares: [2, 4, 6, 8, 10, 12, 14], impares: [3, 5, 7, 9, 11, 13, 15] };
// No bar, "par" são as lisas e "ímpar" as listradas (Paulo, 28/10/2026).
const SINUCA_NOME_GRUPO = { lisas: "Lisas", listradas: "Listradas", pares: "Par (lisas)", impares: "Ímpar (listradas)" };
// A bola final: a 8 na bola 8 (a partida nova), a 1 no par ou ímpar com as 15.
const sinucaFinal = (j) => (j.mesa.modo === "parimpar" ? (j.mesa.bola1 ? 1 : null) : 8);
function sinucaPodeTocar(j, n) {
  const g = j.mesa.grupos?.[j.eu];
  // Mesa aberta (ninguém encaçapou ainda): vale qualquer bola menos a 1.
  if (j.mesa.modo === "parimpar") return !g ? n !== 1 : j.mesa.bola1 && !j.mesa.restam?.[g] ? n === 1 : SINUCA_GRUPOS[g]?.includes(n);
  if (!g) return n !== 8 || !j.mesa.tacadas;
  if (n === 8) return !j.mesa.restam?.[g];
  return g === "lisas" ? n < 8 : n > 8;
}

function sinucaUltimoTexto(j, u = j.mesa?.ultimo) {
  if (!u) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  if (u.falta === "tempo") return `${quem} deixou o tempo acabar: falta, bola na mão para o outro.`;
  const caiu = u.caiu.filter((n) => n !== 0);
  const falta = { branca: "a branca caiu", nenhuma: "não tocou em nenhuma bola", errada: "tocou primeiro a bola errada" }[u.falta];
  const grupo = u.grupo ? ` e ficou com ${{ pares: "o par (as lisas)", impares: "o ímpar (as listradas)" }[u.grupo] || `as ${SINUCA_NOME_GRUPO[u.grupo].toLowerCase()}`}` : "";
  return `${quem} tacou${caiu.length ? ` e encaçapou ${caiu.length > 1 ? "as bolas" : "a"} ${caiu.join(", ")}` : " e não encaçapou nada"}${grupo}${falta ? `: falta, ${falta}` : ""}.`;
}
// Jogador no placar de cima: cabeça, nome, de quem é a vez e as bolas do grupo
// (as que já caíram ficam apagadas).
function sinucaJogadorHtml(j, lado) {
  const p = j[lado], u = mesaCabecaUrl(j, p), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado, g = j.mesa.grupos[lado];
  // Com as 15 bolas, a 1 vem no fim da fila: é a bola final de cada um.
  const nums = g ? [...SINUCA_GRUPOS[g], ...(j.mesa.bola1 ? [1] : j.mesa.modo === "parimpar" ? [] : [8])] : [];
  const bolas = nums.length ? nums.map((n) => { const v = sinucaVisual(j.mesa.modo, n); return `<i class="${j.mesa.bolas[n] ? "" : "caiu"}${v.listra ? " listra" : ""}${n === sinucaFinal(j) ? " final" : ""}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`; }).join("")
    : `<small>${j.mesa.modo === "parimpar" ? "Mesa aberta: quem matar primeiro fica com par (lisas) ou ímpar (listradas)" : "Mesa aberta"}</small>`;
  return `<div class="snc-jogador${vez ? " vez" : ""}${lado === "desafiado" ? " direita" : ""}">${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : "<i class=\"snc-sem\"></i>"}
${vez ? mesaPrazoVezHtml(j) : ""}<div><b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><span class="snc-grupo" aria-label="${g ? `${SINUCA_NOME_GRUPO[g]}, faltam ${j.mesa.restam[g]}` : "Mesa aberta"}">${g ? `<small>${SINUCA_NOME_GRUPO[g]}</small>` : ""}${bolas}</span></div></div>`;
}
function desenharSinuca(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const chave = j.id + ":" + j.n;
  // Tacadas novas (minhas ou do outro) entram na fila da animação, uma depois
  // da outra (Paulo, 28/10/2026: "quando o Vinícius dá uma tacada eu não vejo o
  // que ele fez"): o taco dele puxa e bate, as bolas andam e a faixa diz o que
  // aconteceu. Quem encaçapa continua, e entre uma consulta e outra podem ter
  // passado várias tacadas: o servidor manda as recentes com o número de cada.
  const nMesa = m.n ?? 0;
  if (s.vistoJogo !== j.id) { s.vistoJogo = j.id; s.vistoN = nMesa; s.anim = null; }
  else if (nMesa > s.vistoN) {
    const novas = (m.recentes || []).filter((t) => t.n > s.vistoN && !s.anim?.fila.some((x) => x.n === t.n));
    if (novas.length) { if (s.anim) s.anim.fila.push(...novas); else s.anim = { fila: novas, k: 0, inicio: 0 }; }
    s.vistoN = nMesa;
  }
  if (s.visto !== chave) { s.visto = chave; s.branca = null; s.travada = false; s.puxando = null; s.forcaAgora = null; }
  const minha = sinucaMinhaVez(j), poe = sinucaPondo(j, s);
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : poe ? "Bola na mão: toque na mesa onde quer pôr a branca." : SINUCA_DICA[s.travada ? "travada" : "livre"];
  const efeito = s.efeito || 0, giro = s.giro || 0, ativo = minha && !poe;
  const forca = `<div class="snc-forca${ativo ? "" : " parada"}" role="slider" tabindex="${ativo ? 0 : -1}" aria-label="Força da tacada: puxe para baixo e solte para tacar" aria-valuemin="5" aria-valuemax="100" aria-valuenow="${Math.round((s.forca ?? 0.5) * 100)}"
 onpointerdown="sinucaForcaComeca(event)" onpointermove="sinucaForcaMove(event)" onpointerup="sinucaForcaSolta(event)" onpointercancel="sinucaForcaCancela()" onkeydown="sinucaForcaTecla(event)"><b style="height:0%"></b><span>Força</span></div>`;
  const lado = `<div class="snc-lado">
<button type="button" class="snc-efeito-bola" onclick="sinucaEfeito(event)" ${ativo ? "" : "disabled"} aria-label="Efeito: ${sinucaEfeitoNome(efeito, giro)}"><i style="top:${50 - efeito * 34}%;left:${50 + giro * 34}%"></i></button><small>Efeito</small>
<div class="snc-mira-fina" role="group" aria-label="Ajuste fino da mira"><button type="button" onclick="sinucaGirar(-1)" ${ativo ? "" : "disabled"} aria-label="Mira um pouco para um lado">↺</button><button type="button" onclick="sinucaGirar(1)" ${ativo ? "" : "disabled"} aria-label="Mira um pouco para o outro lado">↻</button></div>
<button type="button" class="snc-tacar" onclick="tacarSinuca()" ${ativo ? "" : "disabled"}>Tacar</button>
<div class="snc-tubo" aria-label="Bolas encaçapadas">${m.bolas.map((p, n) => (!p && n ? n : null)).filter((n) => n !== null).map((n) => { const v = sinucaVisual(m.modo, n); return `<i class="${v.listra ? "listra" : ""}" style="--c:${v.cor};--n:${n}" title="Bola ${n}">${n}</i>`; }).join("")}</div>
${m.bolaNaMao && s.branca && minha ? `<button type="button" class="snc-mudar" onclick="sinucaEstado().branca=null;desenharJogoMesa('snc')">Mudar a branca</button>` : ""}</div>`;
  const ultimo = sinucaUltimoTexto(j);
  // Pinta logo que o canvas entra na tela (rAF não roda com a aba escondida).
  setTimeout(() => sinucaPintar());
  return {
    status,
    mesa: `<div class="snc-placar">${sinucaJogadorHtml(j, "desafiante")}<span class="snc-x">×</span>${sinucaJogadorHtml(j, "desafiado")}</div>
<div class="snc-area">${forca}<canvas id="snc-canvas" class="snc-canvas${minha ? " vez" : ""}${s.travada ? " travada" : ""}" width="${(SINUCA_L + 2 * SINUCA_B) * SINUCA_PX}" height="${(SINUCA_A + 2 * SINUCA_B) * SINUCA_PX}" role="img" aria-label="Mesa de sinuca"
 onpointermove="sinucaPonteiro(event,'move')" onpointerdown="sinucaPonteiro(event,'down')" onpointerup="sinucaPonteiro(event,'up')" onclick="sinucaPonteiro(event,'clique')"></canvas>${lado}</div>`,
    painel: ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : "",
  };
}

// Ponteiro na mesa. Bola na mão: o toque põe a branca. Mouse: passar mira,
// clicar trava/solta. Dedo: tocar e arrastar mira (a mira fica onde soltou).
function sinucaPonteiro(ev, tipo) {
  const s = sinucaEstado(), j = s.jogo, c = ev.currentTarget;
  // Animação da tacada que ficou presa (aba escondida, tela fechada no meio)
  // não pode travar a mesa: passado o tempo dela, acabou (Paulo, 27/10/2026:
  // "Vinícius não conseguiu colocar a bola branca em lugar nenhum").
  if (s.anim && s.anim.inicio && performance.now() - s.anim.inicio > sinucaAnimDuracao(s.anim.fila[s.anim.k] || {}, j) + 1500) { s.anim = null; sinucaPintar(); }
  if (!sinucaMinhaVez(j) || s.anim) return;
  const R = sinucaRaio(j), r = c.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * (SINUCA_L + 2 * SINUCA_B) - SINUCA_B, y = (ev.clientY - r.top) / r.height * (SINUCA_A + 2 * SINUCA_B) - SINUCA_B;
  if (sinucaPondo(j, s)) {
    const px = Math.min(SINUCA_L - R, Math.max(R, x)), py = Math.min(SINUCA_A - R, Math.max(R, y));
    const livre = j.mesa.bolas.every((b, n) => !b || n === 0 || Math.hypot(b[0] - px, b[1] - py) >= 2 * R + 0.1);
    s.fantasma = { x: px, y: py, livre };
    // Põe ao soltar o dedo/botão ou no clique (no celular o toque às vezes só chega como clique).
    if (tipo === "up" || tipo === "clique") {
      if (!livre) { escritorioAviso("Aí a branca encosta noutra bola: toque num lugar livre."); sinucaPintar(); return; }
      s.branca = { x: Math.round(px * 100) / 100, y: Math.round(py * 100) / 100 }; s.fantasma = null;
      desenharJogoMesa("snc");
      return;
    }
    sinucaPintar();
    return;
  }
  if (tipo === "clique") return;
  const b = sinucaBranca(j, s);
  if (!b) return;
  // Bola na mão já posta: pegar a branca (tocar nela) e arrastar para outro lugar.
  if (tipo === "down" && s.branca && Math.hypot(x - b[0], y - b[1]) < R * 1.6) {
    s.branca = null; s.fantasma = { x: b[0], y: b[1], livre: true }; c.setPointerCapture?.(ev.pointerId);
    sinucaPintar();
    return;
  }
  if (ev.pointerType !== "mouse") {
    if (tipo === "down") { s.dedo = true; c.setPointerCapture?.(ev.pointerId); }
    if (!s.dedo) return;
    if (tipo === "up") s.dedo = false;
  } else {
    // Mouse: segurar e puxar para trás (contra a mira) é a força; soltar taca.
    if (tipo === "down") { s.puxada = { x, y }; c.setPointerCapture?.(ev.pointerId); return; }
    if (s.puxada) {
      const ang = s.angulo ?? 0, puxou = -((x - s.puxada.x) * Math.cos(ang) + (y - s.puxada.y) * Math.sin(ang));
      const v = Math.max(0, Math.min(1, puxou / SINUCA_PUXADA));
      if (tipo === "move") { sinucaForcaMostrar(v, true); return; }
      s.puxada = null;
      if (v >= 0.05) { s.forca = v; tacarSinuca(); return; }
      sinucaForcaCancela();
      // Clique sem puxar: trava ou solta a mira.
      s.travada = !s.travada;
      c.classList.toggle("travada", s.travada);
      const st = document.querySelector(".ofc-snc-jogo .xdz-status");
      if (st) st.textContent = SINUCA_DICA[s.travada ? "travada" : "livre"];
      if (s.travada) return;
    } else if (s.travada || tipo !== "move") return;
  }
  if (Math.hypot(x - b[0], y - b[1]) < 0.5) return;
  s.angulo = Math.atan2(y - b[1], x - b[0]);
  sinucaPintar();
}
// Ajuste fino da mira (no celular o dedo erra): um quarto de grau por toque.
function sinucaGirar(lado) {
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim) return;
  s.angulo = (s.angulo ?? 0) + lado * (Math.PI / 720);
  sinucaPintar();
}
// Efeito: o ponto da bolinha onde o taco bate. Em cima segue, embaixo puxa,
// dos lados a branca abre para aquele lado na tabela (no centro, nenhum).
function sinucaEfeitoNome(e, g) {
  const v = e > 0 ? "seguir" : e < 0 ? "puxar" : "", h = g > 0 ? "abrir para a direita" : g < 0 ? "abrir para a esquerda" : "";
  return [v, h].filter(Boolean).join(" e ") || "no centro";
}
function sinucaEfeito(ev) {
  const s = sinucaEstado(), el = ev.currentTarget, r = el.getBoundingClientRect();
  let vy = -((ev.clientY - r.top) / r.height - 0.5) / 0.34, vx = ((ev.clientX - r.left) / r.width - 0.5) / 0.34;
  const d = Math.hypot(vx, vy);
  if (d > 1) { vx /= d; vy /= d; }
  s.efeito = Math.abs(vy) < 0.2 ? 0 : Math.round(vy * 10) / 10;
  s.giro = Math.abs(vx) < 0.2 ? 0 : Math.round(vx * 10) / 10;
  const i = el.querySelector("i");
  i.style.top = `${50 - s.efeito * 34}%`; i.style.left = `${50 + s.giro * 34}%`;
  el.setAttribute("aria-label", `Efeito: ${sinucaEfeitoNome(s.efeito, s.giro)}`);
}

// Barra de força ao lado da mesa: puxa-se para baixo, como o taco; a altura
// puxada é a força e soltar taca. Soltar em cima (menos de 5%) desiste.
function sinucaForcaDe(ev) {
  const r = ev.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
}
function sinucaForcaMostrar(v, naMesa) {
  const s = sinucaEstado(), el = document.querySelector(".snc-forca");
  s.forcaAgora = v;
  if (el) {
    el.querySelector("b").style.height = `${Math.round(v * 100)}%`;
    el.querySelector("span").textContent = v < 0.05 ? (naMesa ? "Puxe para trás" : "Solte: desiste") : `${Math.round(v * 100)}%`;
    el.setAttribute("aria-valuenow", String(Math.round(v * 100)));
  }
  sinucaPintar();
}
function sinucaForcaComeca(ev) {
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim || sinucaPondo(s.jogo, s)) return;
  ev.currentTarget.setPointerCapture?.(ev.pointerId);
  s.puxando = true;
  sinucaForcaMostrar(sinucaForcaDe(ev));
}
function sinucaForcaMove(ev) {
  if (sinucaEstado().puxando) sinucaForcaMostrar(sinucaForcaDe(ev));
}
function sinucaForcaSolta(ev) {
  const s = sinucaEstado();
  if (!s.puxando) return;
  s.puxando = null;
  const v = sinucaForcaDe(ev);
  if (v < 0.05) return sinucaForcaCancela();
  s.forca = v;
  tacarSinuca();
}
function sinucaForcaCancela() {
  const s = sinucaEstado();
  s.puxando = null; s.forcaAgora = null;
  const el = document.querySelector(".snc-forca");
  if (el) { el.querySelector("b").style.height = "0%"; el.querySelector("span").textContent = "Força"; }
  sinucaPintar();
}
// Teclado na barra: setas mudam a força, Enter ou espaço taca.
function sinucaForcaTecla(ev) {
  const s = sinucaEstado();
  if (["ArrowDown", "ArrowUp"].includes(ev.key)) {
    ev.preventDefault();
    s.forca = Math.max(0.05, Math.min(1, (s.forca ?? 0.5) + (ev.key === "ArrowDown" ? 0.05 : -0.05)));
    sinucaForcaMostrar(s.forca);
  } else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tacarSinuca(); }
}
function tacarSinuca() {
  const s = sinucaEstado(), j = s.jogo;
  if (!sinucaMinhaVez(j) || s.anim) return;
  const pedido = { tipo: "tacar", angulo: Math.round((s.angulo ?? 0) * 10000) / 10000, forca: Math.max(0.05, Math.min(1, Math.round((s.forca ?? 0.5) * 100) / 100)), efeito: s.efeito || 0, lado: s.giro || 0 };
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) pedido.branca = s.branca;
  lanceMesaEscritorio("snc", pedido);
}

// Onde a mira bate primeiro: na bola (centro da "bola fantasma") ou na tabela.
function sinucaMira(bolas, b, ang, R) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t = Infinity, alvo = null;
  bolas.forEach((p, n) => {
    if (!p || n === 0) return;
    const ox = p[0] - b[0], oy = p[1] - b[1], proj = ox * dx + oy * dy, perp = Math.abs(ox * dy - oy * dx);
    if (proj <= 0 || perp >= 2 * R) return;
    const tt = proj - Math.sqrt(4 * R * R - perp * perp);
    if (tt < t) { t = tt; alvo = n; }
  });
  const parede = Math.min(dx > 0 ? (SINUCA_L - R - b[0]) / dx : dx < 0 ? (R - b[0]) / dx : Infinity,
    dy > 0 ? (SINUCA_A - R - b[1]) / dy : dy < 0 ? (R - b[1]) / dy : Infinity);
  // Qual tabela: 'x' (esquerda/direita) ou 'y' (cima/baixo), para a mira mostrar a volta.
  const tx = dx > 0 ? (SINUCA_L - R - b[0]) / dx : dx < 0 ? (R - b[0]) / dx : Infinity;
  if (parede < t) { t = parede; alvo = null; }
  return { x: b[0] + dx * t, y: b[1] + dy * t, alvo, tabela: alvo === null ? (Math.abs(tx - t) < 1e-6 ? "x" : "y") : null };
}
const sinucaPx = (v) => (v + SINUCA_B) * SINUCA_PX;
// A BOLA ROLA (Paulo, 27/10/2026: "as bolas nem giram, saem deslizando"): cada
// bola guarda a sua orientação (uma matriz 3x3) e, a cada quadro, gira em torno
// do eixo deitado perpendicular ao caminho, de distância / raio. A bola é pintada
// ponto a ponto como esfera: a faixa da listrada e o círculo do número andam com
// o giro, e o número aparece dos dois lados, como na bola de verdade.
const SINUCA_GIRO = new Map();
function sinucaRolarBola(n, x, y, R) {
  let o = SINUCA_GIRO.get(n);
  if (!o) { o = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], x, y }; SINUCA_GIRO.set(n, o); return o; }
  const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
  o.x = x; o.y = y;
  // Parada ou pulo (bola que voltou à mesa, partida nova): não gira.
  if (!d || d > 8 * R) return o;
  const kx = -dy / d, ky = dx / d, a = d / R, c = Math.cos(a), sn = Math.sin(a), t = 1 - c;
  const G = [t * kx * kx + c, t * kx * ky, sn * ky, t * kx * ky, t * ky * ky + c, -sn * kx, -sn * ky, sn * kx, c];
  const m = o.m, r = new Array(9);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) r[i * 3 + k] = G[i * 3] * m[k] + G[i * 3 + 1] * m[3 + k] + G[i * 3 + 2] * m[6 + k];
  o.m = r;
  return o;
}
const sinucaCorRgb = (hex) => { const h = String(hex || "#888").replace("#", ""); const v = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h.slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
let SINUCA_TELA_BOLA = null;
function sinucaEsferaPintar(g, px, py, r, cor, listra, m, numero) {
  const lado = Math.max(4, Math.ceil(r * 2));
  if (!SINUCA_TELA_BOLA) SINUCA_TELA_BOLA = document.createElement("canvas");
  const tela = SINUCA_TELA_BOLA;
  if (tela.width !== lado) { tela.width = lado; tela.height = lado; }
  const tg = tela.getContext("2d"), img = tg.createImageData(lado, lado), d = img.data;
  const [cr, cg, cb] = sinucaCorRgb(cor), branco = [247, 244, 234];
  const rr = lado / 2;
  for (let yy = 0; yy < lado; yy++) for (let xx = 0; xx < lado; xx++) {
    const nx = (xx + 0.5 - rr) / rr, ny = (yy + 0.5 - rr) / rr, q = nx * nx + ny * ny;
    if (q > 1) continue;
    const nz = Math.sqrt(1 - q);
    // O ponto no corpo da bola: transposta da orientação vezes a normal.
    const by = m[1] * nx + m[4] * ny + m[7] * nz, bz = m[2] * nx + m[5] * ny + m[8] * nz;
    let c = listra ? (Math.abs(by) < 0.5 ? [cr, cg, cb] : branco) : [cr, cg, cb];
    if (numero && Math.abs(bz) > 0.86) c = [251, 248, 239];
    // Luz de cima à esquerda, um pouco de brilho e a borda mais escura.
    const luz = Math.max(0, -0.45 * nx - 0.5 * ny + 0.74 * nz), f = 0.42 + 0.68 * luz, esp = Math.pow(luz, 28) * 210;
    const i = (yy * lado + xx) * 4, borda = q > 0.86 ? (1 - q) / 0.14 : 1;
    d[i] = Math.min(255, c[0] * f + esp); d[i + 1] = Math.min(255, c[1] * f + esp); d[i + 2] = Math.min(255, c[2] * f + esp); d[i + 3] = 255 * Math.min(1, borda * 1.6);
  }
  tg.putImageData(img, 0, 0);
  g.drawImage(tela, px - r, py - r, 2 * r, 2 * r);
  // O número no círculo branco do lado que está para cima (o que encara a luz).
  if (numero) {
    const lados = [[m[6], m[7], m[8]], [-m[6], -m[7], -m[8]]];
    for (const [zx, zy, zz] of lados) {
      if (zz < 0.35) continue;
      g.save();
      g.translate(px + zx * r, py + zy * r);
      const ang = Math.atan2(zy, zx);
      g.rotate(ang); g.scale(zz, 1); g.rotate(-ang);
      g.fillStyle = "#111"; g.globalAlpha *= Math.min(1, (zz - 0.35) / 0.35);
      g.font = `800 ${Math.round(r * (numero > 9 ? 0.5 : 0.62))}px system-ui,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(numero), 0, r * 0.04);
      g.restore();
    }
  }
}
function sinucaBolaPintar(g, n, x, y, R, transparente, escala = 1) {
  const px = sinucaPx(x), py = sinucaPx(y), r = R * SINUCA_PX * escala;
  g.save();
  if (transparente) g.globalAlpha = typeof transparente === "number" ? transparente : 0.55;
  // Sombra no pano e a bola como esfera que rola.
  g.beginPath(); g.ellipse(px + r * 0.2, py + r * 0.3, r * 0.95, r * 0.8, 0, 0, Math.PI * 2); g.fillStyle = "#00000045"; g.fill();
  const modo = sinucaEstado().jogo?.mesa?.modo || "bola8", v = sinucaVisual(modo, n);
  const o = transparente === true ? { m: [1, 0, 0, 0, 1, 0, 0, 0, 1] } : sinucaRolarBola(n, x, y, R);
  if (typeof document !== "undefined") { sinucaEsferaPintar(g, px, py, r, v.cor, v.listra, o.m, n); g.restore(); return; }
  // Sem tela (testes): a bola chapada de antes.
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
  g.fillStyle = v.listra ? "#f7f4ea" : v.cor; g.fill();
  // Volume: sombra embaixo à direita e o brilho da luz em cima à esquerda.
  const brilho = g.createRadialGradient(px - r * 0.38, py - r * 0.42, r * 0.04, px - r * 0.1, py - r * 0.1, r * 1.08);
  brilho.addColorStop(0, "#ffffffd0"); brilho.addColorStop(0.18, "#ffffff30"); brilho.addColorStop(0.6, "#00000000"); brilho.addColorStop(1, "#00000070");
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fillStyle = brilho; g.fill();
  g.restore();
}
function sinucaLinha(g, a, b, cor, traco, largura = 2) {
  g.setLineDash(traco); g.strokeStyle = cor; g.lineWidth = largura;
  g.beginPath(); g.moveTo(sinucaPx(a[0]), sinucaPx(a[1])); g.lineTo(sinucaPx(b[0]), sinucaPx(b[1])); g.stroke();
  g.setLineDash([]);
}
// Caçapas medidas na arte da mesa, as mesmas da física (CANTO e MEIO em
// server/escritorio-sinuca.js): a borracha acaba a 4,17 do canto e a 4,1 do
// meio; o buraco do canto tem raio 3,58 com o centro 1,37 para fora nas duas
// direções, e o do meio raio 3,36 com o centro 2,92 atrás da tabela.
const SINUCA_BOCA_CANTO = 4.17, SINUCA_BOCA_MEIO = 4.1;
function sinucaBuracos() {
  const L = SINUCA_L, A = SINUCA_A, c = 1.37, cr = 3.58, f = 2.92, mr = 3.36;
  return [[-c, -c, cr], [50, -f, mr], [L + c, -c, cr], [-c, A + c, cr], [50, A + f, mr], [L + c, A + c, cr]].map(([x, y, r]) => ({ x, y, r }));
}
// A mesa é a arte (a de bar, com o pano gasto); sem ela carregada, a desenhada.
function sinucaMesaPintar(g, W, H, R) {
  if (SINUCA_MESA?.complete && SINUCA_MESA.naturalWidth) { g.drawImage(SINUCA_MESA, 0, 0, W, H); return; }
  const P = SINUCA_PX, B = SINUCA_B, L = SINUCA_L, A = SINUCA_A, K = 1.5;
  const m = SINUCA_BOCA_CANTO, h = SINUCA_BOCA_MEIO;
  const X = (v) => (v + B) * P;
  const poli = (pts, cor) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), X(y)) : g.moveTo(X(x), X(y)))); g.closePath(); g.fillStyle = cor; g.fill(); };
  // Madeira da tabela, clara como a do jogo, com o filete escuro por dentro.
  const madeira = g.createLinearGradient(0, 0, 0, H);
  madeira.addColorStop(0, "#d99a52"); madeira.addColorStop(0.5, "#b8742f"); madeira.addColorStop(1, "#8f5520");
  g.fillStyle = madeira; g.beginPath(); g.roundRect(0, 0, W, H, 2.4 * P); g.fill();
  g.strokeStyle = "#00000040"; g.lineWidth = 2; g.beginPath(); g.roundRect(P * 0.5, P * 0.5, W - P, H - P, 2 * P); g.stroke();
  // Diamantes no meio da madeira.
  const losango = (x, y) => { const d = P * 0.45; g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d * 0.7, y); g.lineTo(x, y + d); g.lineTo(x - d * 0.7, y); g.closePath(); g.fillStyle = "#fff4d8"; g.fill(); };
  const yd = K + (B - K) / 2;
  for (let k = 1; k < 8; k++) if (k !== 4) for (const yy of [-yd, A + yd]) losango(X(k * 12.5), X(yy));
  for (let k = 1; k < 4; k++) for (const xx of [-yd, L + yd]) losango(X(xx), X(k * 12.5));
  // Pano: verde vivo, mais claro no meio; linha de saída e marca.
  const pano = g.createRadialGradient(X(L / 2), X(A / 2), P * 2, X(L / 2), X(A / 2), L * P * 0.6);
  pano.addColorStop(0, "#1fc463"); pano.addColorStop(0.6, "#14a24f"); pano.addColorStop(1, "#0d7f3c");
  // A faixa da borracha em verde-escuro (aparece na garganta das caçapas) e o pano por dentro.
  g.fillStyle = "#0a5a2a"; g.fillRect(X(-K), X(-K), (L + 2 * K) * P, (A + 2 * K) * P);
  g.fillStyle = pano; g.fillRect(X(0), X(0), L * P, A * P);
  g.strokeStyle = "#ffffff30"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(25), X(0)); g.lineTo(X(25), X(A)); g.stroke();
  g.beginPath(); g.arc(X(75), X(25), P * 0.3, 0, Math.PI * 2); g.fillStyle = "#ffffff50"; g.fill();
  // Caçapas: o buraco (com a sombra da boca) por baixo da borracha.
  for (const b of sinucaBuracos()) {
    const fundo = g.createRadialGradient(X(b.x), X(b.y) + b.r * P * 0.25, 0, X(b.x), X(b.y), b.r * P);
    fundo.addColorStop(0, "#000"); fundo.addColorStop(0.7, "#0b0303"); fundo.addColorStop(1, "#3a1208");
    g.beginPath(); g.arc(X(b.x), X(b.y), b.r * P, 0, Math.PI * 2); g.fillStyle = fundo; g.fill();
    g.strokeStyle = "#e0b45c"; g.lineWidth = 1.5; g.stroke();
  }
  // Borracha: seis pedaços entre as caçapas, a ponta cortada para o buraco.
  const kc = 0.77 * K, km = 0.22 * K;
  const borrachas = [
    [[m, 0], [50 - h, 0], [50 - h + km, -K], [m - kc, -K]], [[50 + h, 0], [L - m, 0], [L - m + kc, -K], [50 + h - km, -K]],
    [[m, A], [50 - h, A], [50 - h + km, A + K], [m - kc, A + K]], [[50 + h, A], [L - m, A], [L - m + kc, A + K], [50 + h - km, A + K]],
    [[0, m], [0, A - m], [-K, A - m + kc], [-K, m - kc]], [[L, m], [L, A - m], [L + K, A - m + kc], [L + K, m - kc]],
  ];
  for (const b of borrachas) {
    poli(b, "#0f7a3b");
    g.strokeStyle = "#3ff08a"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X(b[0][0]), X(b[0][1])); g.lineTo(X(b[1][0]), X(b[1][1])); g.stroke();
    g.strokeStyle = "#00000055"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(b[2][0]), X(b[2][1])); g.lineTo(X(b[3][0]), X(b[3][1])); g.stroke();
  }
}
// Desenha a mesa, as bolas (ou o quadro da animação) e a mira.
function sinucaPintar(agora) {
  const s = sinucaEstado(), j = s.jogo, c = document.getElementById("snc-canvas");
  if (!j || !c) return;
  const g = c.getContext("2d"), W = c.width, H = c.height, P = SINUCA_PX, R = sinucaRaio(j);
  g.clearRect(0, 0, W, H);
  sinucaMesaPintar(g, W, H, R);
  let bolas = j.mesa.bolas, cena = null;
  if (s.anim) {
    cena = sinucaAnimQuadro(s, j, agora || performance.now(), R);
    if (cena) bolas = cena.bolas;
  }
  const branca = !s.anim && sinucaMinhaVez(j) ? sinucaBranca(j, s) : null;
  bolas.forEach((p, n) => { if (p && !(n === 0 && branca && s.branca)) sinucaBolaPintar(g, n, p[0], p[1], R); });
  // Bola caindo na caçapa: escorrega para o buraco, diminui e some.
  for (const c of cena?.caindo || []) sinucaBolaPintar(g, c.n, c.x, c.y, R, Math.max(0.15, c.escala), c.escala);
  // As minhas bolas ganham um anel (verde; a 1, dourado, quando é a vez dela):
  // dá para ver de longe quais são as pares e quais são as ímpares.
  if (j.eu && j.mesa.grupos?.[j.eu]) bolas.forEach((p, n) => {
    if (!p || !n || !sinucaPodeTocar(j, n)) return;
    g.beginPath(); g.arc(sinucaPx(p[0]), sinucaPx(p[1]), R * P + 2.5, 0, Math.PI * 2);
    g.strokeStyle = n === sinucaFinal(j) ? "#ffd35c" : "#5ef08f"; g.lineWidth = 3; g.stroke();
  });
  if (s.anim) { if (cena) sinucaCenaPintar(g, W, cena, R, P); return; }
  if (sinucaPondo(j, s) && s.fantasma) sinucaBolaPintar(g, 0, s.fantasma.x, s.fantasma.y, R, true);
  if (!branca) return;
  if (s.branca) sinucaBolaPintar(g, 0, branca[0], branca[1], R);
  // Mira como na referência do Paulo (28/10/2026, a tela do "Boteco"): a linha
  // da branca até onde ela encosta na primeira bola (ou na tabela) e o círculo
  // da bola fantasma nesse ponto. Para onde a bola acertada e a branca vão
  // depois continua por conta de quem joga, como no bar.
  const ang = s.angulo ?? 0, dx = Math.cos(ang), dy = Math.sin(ang), alvo = sinucaMira(j.mesa.bolas, branca, ang, R);
  g.save();
  sinucaLinha(g, [branca[0] + dx * (R + 0.4), branca[1] + dy * (R + 0.4)], [alvo.x - dx * R, alvo.y - dy * R], "#ffffffb0", [], 1.6);
  g.beginPath(); g.arc(sinucaPx(alvo.x), sinucaPx(alvo.y), R * P, 0, Math.PI * 2);
  g.strokeStyle = alvo.alvo !== null && !sinucaPodeTocar(j, alvo.alvo) ? "#ff6a5a" : "#ffffffd0"; g.lineWidth = 1.6; g.stroke();
  // Na bola que não pode ser tocada primeiro, um X.
  if (alvo.alvo !== null && !sinucaPodeTocar(j, alvo.alvo)) {
    const cx = sinucaPx(alvo.x), cy = sinucaPx(alvo.y), d = R * P * 0.5;
    g.beginPath(); g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d); g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d); g.stroke();
  }
  g.restore();
  sinucaTacoPintar(g, branca, dx, dy, (R + 0.5 + 10 * (s.forcaAgora ?? 0)) * P, P);
}
// --- Animação das tacadas (a fila de s.anim) --------------------------------
// Cada tacada tem três tempos: o taco (puxa e bate; do outro, devagar, para dar
// para ver de onde e para onde ele mirou), as bolas andando (os quadros do
// servidor, a 30 por segundo) e a faixa com o que aconteceu.
const SINUCA_QPS = 30;
function sinucaAnimTempos(t, j) {
  const taco = t.falta === "tempo" ? 0 : t.lado === j.eu ? 180 : 1100;
  const bolas = (t.quadros?.length || 0) * (1000 / SINUCA_QPS);
  return { taco, bolas, faixa: t.lado === j.eu ? 1200 : 1700 };
}
function sinucaAnimDuracao(t, j) {
  const d = sinucaAnimTempos(t, j);
  return d.taco + d.bolas + d.faixa;
}
const sinucaQuadroBolas = (q) => Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : [q[2 * n] / 10, q[2 * n + 1] / 10]));
// Monta a cena da hora `agora`: as bolas, as que estão caindo, o taco e a faixa.
// Devolve null quando a fila acabou (a mesa volta para o estado de verdade).
function sinucaAnimQuadro(s, j, agora, R) {
  const a = s.anim;
  let t = a.fila[a.k];
  a.inicio ||= agora;
  while (t && agora - a.inicio >= sinucaAnimDuracao(t, j)) { a.inicio += sinucaAnimDuracao(t, j); t = a.fila[++a.k]; a.som = undefined; }
  if (!t) { s.anim = null; setTimeout(() => { sinucaPintar(); if (escritorioMesa("snc").jogo?.id === j.id) desenharJogoMesa("snc"); }); return null; }
  requestAnimationFrame(sinucaPintar);
  const d = sinucaAnimTempos(t, j), e = agora - a.inicio, quadros = t.quadros?.length ? t.quadros : null;
  const quem = t.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[t.lado]);
  if (!quadros) return { bolas: j.mesa.bolas, faixa: sinucaUltimoTexto(j, t), ruim: true };
  const ini = sinucaQuadroBolas(quadros[0]);
  if (e < d.taco) {
    // O taco recua devagar (até a força da tacada) e bate rápido.
    const p = e / d.taco, recuo = p < 0.78 ? Math.sin((p / 0.78) * Math.PI / 2) : 1 - (p - 0.78) / 0.22;
    return { bolas: ini, taco: { b: ini[0], ang: t.angulo ?? 0, recuo: Math.max(0, recuo) * (0.15 + (t.forca ?? 0.5)) }, mira: t.lado !== j.eu, faixa: t.lado === j.eu ? "" : `${quem} vai tacar` };
  }
  if (a.som === undefined) { a.som = 0; jogosSom("taco", 0.4 + 0.6 * (t.forca ?? 0.5)); }
  const f = Math.min(quadros.length - 1, (e - d.taco) / (1000 / SINUCA_QPS)), i = Math.floor(f), k = f - i;
  const q = quadros[i], q2 = quadros[Math.min(quadros.length - 1, i + 1)];
  const bolas = Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : q2[2 * n] < 0 ? [q[2 * n] / 10, q[2 * n + 1] / 10]
    : [(q[2 * n] + (q2[2 * n] - q[2 * n]) * k) / 10, (q[2 * n + 1] + (q2[2 * n + 1] - q[2 * n + 1]) * k) / 10]));
  // Som dos eventos que já passaram: choque entre bolas, tabela, caçapa.
  while (a.som < (t.eventos || []).length && t.eventos[a.som].q <= i) {
    const ev = t.eventos[a.som++];
    if (ev.t === "bola") jogosSom("bola", 0.3 + 0.7 * ev.f);
    else if (ev.t === "tabela") jogosSom("tabela", 0.2 + 0.5 * ev.f);
    else if (ev.t === "caiu") jogosSom("cacapa", 0.8);
  }
  // As que sumiram há pouco (até 7 quadros) aparecem escorregando para o buraco.
  const caindo = [], buracos = sinucaBuracos();
  for (let n = 0; n < 16; n++) {
    if (bolas[n]) continue;
    let fq = -1;
    for (let z = Math.min(i, quadros.length - 1); z >= Math.max(0, i - 7); z--) if (quadros[z][2 * n] >= 0) { fq = z; break; }
    if (fq < 0) continue;
    const x0 = quadros[fq][2 * n] / 10, y0 = quadros[fq][2 * n + 1] / 10, p = Math.min(1, (f - fq) / 7);
    const b = buracos.reduce((m, h) => (Math.hypot(h.x - x0, h.y - y0) < Math.hypot(m.x - x0, m.y - y0) ? h : m));
    caindo.push({ n, x: x0 + (b.x - x0) * Math.min(1, p * 1.6), y: y0 + (b.y - y0) * Math.min(1, p * 1.6), escala: 1 - 0.65 * p });
  }
  const acabou = e >= d.taco + d.bolas;
  return { bolas, caindo, faixa: acabou ? sinucaUltimoTexto(j, t) : t.lado === j.eu ? "" : `${quem} tacou`, ruim: acabou && Boolean(t.falta) };
}
// O taco da tacada que está saindo, a mira do outro e a faixa de cima.
function sinucaCenaPintar(g, W, cena, R, P) {
  if (cena.taco) {
    const { b, ang, recuo } = cena.taco, dx = Math.cos(ang), dy = Math.sin(ang);
    // A mira do outro: um traço curto na direção do taco.
    if (cena.mira) sinucaLinha(g, [b[0] + dx * (R + 0.6), b[1] + dy * (R + 0.6)], [b[0] + dx * (R + 9), b[1] + dy * (R + 9)], "#ffffff70", [P * 0.5, P * 0.5], 1.5);
    sinucaTacoPintar(g, b, dx, dy, (R + 0.4 + 10 * recuo) * P, P);
  }
  if (!cena.faixa) return;
  g.save();
  g.font = `800 ${Math.round(P * 2.3)}px system-ui,sans-serif`;
  const w = Math.min(W - 40, g.measureText(cena.faixa).width + P * 4), h = P * 4.2, x = (W - w) / 2, y = P * 5.5;
  g.fillStyle = cena.ruim ? "#3a0d0ce6" : "#0d1a12e6"; g.strokeStyle = cena.ruim ? "#ff6a5a" : "#7ef0a8"; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(cena.faixa, W / 2, y + h / 2 + 1, w - P * 2);
  g.restore();
}
// Taco: ponteira, anel e madeira escurecendo até o cabo.
function sinucaTacoPintar(g, branca, dx, dy, recuo, P) {
  const cx = sinucaPx(branca[0]) - dx * recuo, cy = sinucaPx(branca[1]) - dy * recuo, ex = cx - dx * 48 * P, ey = cy - dy * 48 * P;
  const taco = g.createLinearGradient(cx, cy, ex, ey);
  taco.addColorStop(0, "#5ab0ff"); taco.addColorStop(0.012, "#f4efe2"); taco.addColorStop(0.03, "#f4efe2"); taco.addColorStop(0.035, "#1b1b1b");
  taco.addColorStop(0.045, "#e8cd96"); taco.addColorStop(0.62, "#c08a4a"); taco.addColorStop(0.64, "#2a1a0c"); taco.addColorStop(1, "#160d05");
  g.save();
  g.strokeStyle = "#00000040"; g.lineWidth = P * 0.95; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx + 3, cy + 5); g.lineTo(ex + 3, ey + 5); g.stroke();
  g.strokeStyle = taco; g.lineWidth = P * 0.8;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
  g.restore();
}
// Setas do teclado ajustam a mira enquanto a sinuca está aberta (Shift: mais fino).
document.addEventListener?.("keydown", (ev) => {
  if (!document.querySelector("#workflow-modal.ofc-snc-jogo") || ev.target?.closest?.("input,textarea,.snc-forca")) return;
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim) return;
  ev.preventDefault();
  s.angulo = (s.angulo ?? 0) + (ev.key === "ArrowLeft" ? -1 : 1) * (ev.shiftKey ? Math.PI / 1440 : Math.PI / 360);
  sinucaPintar();
});
