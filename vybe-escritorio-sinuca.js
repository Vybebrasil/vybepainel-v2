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
  nota: "Par ou ímpar, como no bar: 14 bolas (sem a 1), cada um com as suas, sorteadas na saída. Ganha quem encaçapar todas primeiro.", desenhar: (j, s) => desenharSinuca(j, s),
});
// Mesa de 100 × 50 com 4 de tabela em volta; 10 px por unidade no canvas.
const SINUCA_L = 100, SINUCA_A = 50, SINUCA_B = 4, SINUCA_PX = 10;
const SINUCA_CORES = ["#f7f4ea", "#f2c12e", "#1f5fbf", "#d23a2a", "#6a3fa0", "#f07a1a", "#1e8a4a", "#8a2a1e", "#151515"];
// Caçapas (x, y, boca em raios de bola), como no servidor.
const SINUCA_CACAPAS = [[0, 0, 2.43], [50, -0.3, 2], [100, 0, 2.43], [0, 50, 2.43], [50, 50.3, 2], [100, 50, 2.43]];
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
const SINUCA_NOME_GRUPO = { lisas: "Lisas", listradas: "Listradas", pares: "Pares", impares: "Ímpares" };
function sinucaPodeTocar(j, n) {
  const g = j.mesa.grupos?.[j.eu];
  if (j.mesa.modo === "parimpar") return SINUCA_GRUPOS[g]?.includes(n);
  if (!g) return n !== 8 || !j.mesa.tacadas;
  if (n === 8) return !j.mesa.restam?.[g];
  return g === "lisas" ? n < 8 : n > 8;
}

function sinucaUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  const caiu = u.caiu.filter((n) => n !== 0);
  const falta = { branca: "a branca caiu", nenhuma: "não tocou em nenhuma bola", errada: "tocou primeiro a bola errada" }[u.falta];
  return `${quem} tacou${caiu.length ? ` e encaçapou ${caiu.join(", ")}` : ""}${falta ? `: falta, ${falta}` : ""}.`;
}
// Jogador no placar de cima: cabeça, nome, de quem é a vez e as bolas do grupo
// (as que já caíram ficam apagadas).
function sinucaJogadorHtml(j, lado) {
  const p = j[lado], u = escritorioCabecaUrl(p.id), vez = j.estado === "jogando" && j.vez === lado, eu = j.eu === lado, g = j.mesa.grupos[lado];
  const nums = SINUCA_GRUPOS[g] || [];
  const bolas = nums.length ? nums.map((n) => `<i class="${j.mesa.bolas[n] ? "" : "caiu"}${n > 8 ? " listra" : ""}" style="--c:${SINUCA_CORES[n > 8 ? n - 8 : n]};--n:${n}">${n}</i>`).join("")
    : '<small>Mesa aberta</small>';
  return `<div class="snc-jogador${vez ? " vez" : ""}${lado === "desafiado" ? " direita" : ""}">${u ? `<img src="${safeText(u)}" alt="" width="40" height="40">` : "<i class=\"snc-sem\"></i>"}
${vez ? mesaPrazoVezHtml(j) : ""}<div><b>${xadrezPrimeiroNome(p)}${eu ? " (você)" : ""}</b><span class="snc-grupo" aria-label="${g ? `${SINUCA_NOME_GRUPO[g]}, faltam ${j.mesa.restam[g]}` : "Mesa aberta"}">${g ? `<small>${SINUCA_NOME_GRUPO[g]}</small>` : ""}${bolas}</span></div></div>`;
}
function desenharSinuca(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const chave = j.id + ":" + j.n;
  // Tacada nova (minha ou do outro): anima os quadros antes de mostrar a mesa parada.
  if (s.visto !== chave) {
    if (s.visto && s.visto.split(":")[0] === j.id && m.ultimo?.quadros?.length) s.anim = { quadros: m.ultimo.quadros, eventos: m.ultimo.eventos || [], inicio: 0 };
    s.visto = chave; s.branca = null; s.travada = false; s.puxando = null; s.forcaAgora = null;
  }
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
  if (s.anim && s.anim.inicio && performance.now() - s.anim.inicio > s.anim.quadros.length * (1000 / 30) + 1500) { s.anim = null; sinucaPintar(); }
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
  if (parede < t) { t = parede; alvo = null; }
  return { x: b[0] + dx * t, y: b[1] + dy * t, alvo };
}
const sinucaPx = (v) => (v + SINUCA_B) * SINUCA_PX;
function sinucaBolaPintar(g, n, x, y, R, transparente) {
  const px = sinucaPx(x), py = sinucaPx(y), r = R * SINUCA_PX;
  g.save();
  if (transparente) g.globalAlpha = 0.55;
  // Sombra no pano, a bola, a faixa da listrada, o número e o brilho.
  g.beginPath(); g.ellipse(px + r * 0.2, py + r * 0.3, r * 0.95, r * 0.8, 0, 0, Math.PI * 2); g.fillStyle = "#00000045"; g.fill();
  // Com a folha carregada, a bola desenhada; antes dela, a feita à mão.
  if (SINUCA_BOLAS?.complete && SINUCA_BOLAS.naturalWidth) { g.drawImage(SINUCA_BOLAS, n * 96, 0, 96, 96, px - r, py - r, 2 * r, 2 * r); g.restore(); return; }
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
  g.fillStyle = n > 8 ? "#f7f4ea" : SINUCA_CORES[n]; g.fill();
  if (n > 8) { g.save(); g.clip(); g.fillStyle = SINUCA_CORES[n - 8]; g.fillRect(px - r, py - r * 0.55, 2 * r, r * 1.1); g.restore(); }
  if (n) {
    g.beginPath(); g.arc(px, py, r * 0.5, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    g.fillStyle = "#111"; g.font = `700 ${Math.round(r * 0.66)}px system-ui,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n), px, py + 0.5);
  }
  const brilho = g.createRadialGradient(px - r * 0.4, py - r * 0.45, r * 0.05, px - r * 0.15, py - r * 0.15, r * 1.1);
  brilho.addColorStop(0, "#ffffffc0"); brilho.addColorStop(0.22, "#ffffff22"); brilho.addColorStop(1, "#00000055");
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fillStyle = brilho; g.fill();
  g.restore();
}
function sinucaLinha(g, a, b, cor, traco, largura = 2) {
  g.setLineDash(traco); g.strokeStyle = cor; g.lineWidth = largura;
  g.beginPath(); g.moveTo(sinucaPx(a[0]), sinucaPx(a[1])); g.lineTo(sinucaPx(b[0]), sinucaPx(b[1])); g.stroke();
  g.setLineDash([]);
}
// A mesa: tabela de madeira com os diamantes, borracha, pano com luz no meio e as caçapas.
function sinucaMesaPintar(g, W, H, R) {
  const P = SINUCA_PX, B = SINUCA_B;
  const madeira = g.createLinearGradient(0, 0, 0, H);
  madeira.addColorStop(0, "#8a5426"); madeira.addColorStop(0.5, "#6b3c18"); madeira.addColorStop(1, "#4a280e");
  g.fillStyle = madeira; g.beginPath(); g.roundRect(0, 0, W, H, 3.2 * P); g.fill();
  g.strokeStyle = "#00000055"; g.lineWidth = 2; g.beginPath(); g.roundRect(P * 0.6, P * 0.6, W - P * 1.2, H - P * 1.2, 2.6 * P); g.stroke();
  g.fillStyle = "#13583a"; g.fillRect((B - 1.1) * P, (B - 1.1) * P, (SINUCA_L + 2.2) * P, (SINUCA_A + 2.2) * P);
  const pano = g.createRadialGradient(W / 2, H / 2, P * 4, W / 2, H / 2, W * 0.62);
  pano.addColorStop(0, "#2fae6c"); pano.addColorStop(0.6, "#21894f"); pano.addColorStop(1, "#176a3d");
  g.fillStyle = pano; g.fillRect(B * P, B * P, SINUCA_L * P, SINUCA_A * P);
  g.strokeStyle = "#ffffff26"; g.lineWidth = 1.5; g.beginPath(); g.moveTo((B + 25) * P, B * P); g.lineTo((B + 25) * P, (B + SINUCA_A) * P); g.stroke();
  g.beginPath(); g.arc((B + 75) * P, (B + 25) * P, P * 0.35, 0, Math.PI * 2); g.fillStyle = "#ffffff40"; g.fill();
  g.fillStyle = "#f1dfb0";
  for (let k = 1; k < 8; k++) if (k !== 4) for (const yy of [B / 2, B + SINUCA_A + B / 2]) { g.beginPath(); g.arc((B + k * 12.5) * P, yy * P, P * 0.38, 0, Math.PI * 2); g.fill(); }
  for (let k = 1; k < 4; k++) for (const xx of [B / 2, B + SINUCA_L + B / 2]) { g.beginPath(); g.arc(xx * P, (B + k * 12.5) * P, P * 0.38, 0, Math.PI * 2); g.fill(); }
  for (const [x, y, k] of SINUCA_CACAPAS) {
    const cx = (x + B) * P, cy = (y + B) * P, rr = k * R * 0.92 * P;
    g.beginPath(); g.arc(cx, cy, rr + P * 0.45, 0, Math.PI * 2); g.fillStyle = "#2b1606"; g.fill();
    const fundo = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    fundo.addColorStop(0, "#000"); fundo.addColorStop(1, "#151515");
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fillStyle = fundo; g.fill();
  }
}
// Desenha a mesa, as bolas (ou o quadro da animação) e a mira.
function sinucaPintar(agora) {
  const s = sinucaEstado(), j = s.jogo, c = document.getElementById("snc-canvas");
  if (!j || !c) return;
  const g = c.getContext("2d"), W = c.width, H = c.height, P = SINUCA_PX, R = sinucaRaio(j);
  g.clearRect(0, 0, W, H);
  sinucaMesaPintar(g, W, H, R);
  let bolas = j.mesa.bolas;
  if (s.anim) {
    const a = s.anim, t = agora || performance.now();
    a.inicio ||= t;
    // Quadros a 30 por segundo, com as posições entre um quadro e outro interpoladas.
    const f = (t - a.inicio) / (1000 / 30), i = Math.min(a.quadros.length - 1, Math.floor(f)), k = Math.min(1, f - i);
    const q = a.quadros[i], q2 = a.quadros[Math.min(a.quadros.length - 1, i + 1)];
    bolas = Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : q2[2 * n] < 0 ? [q[2 * n] / 10, q[2 * n + 1] / 10]
      : [(q[2 * n] + (q2[2 * n] - q[2 * n]) * k) / 10, (q[2 * n + 1] + (q2[2 * n + 1] - q[2 * n + 1]) * k) / 10]));
    // Som dos eventos que já passaram: taco, choque entre bolas, tabela, caçapa.
    if (a.som === undefined) { a.som = 0; jogosSom("taco", 0.8); }
    while (a.som < (a.eventos || []).length && a.eventos[a.som].q <= i) {
      const e = a.eventos[a.som++];
      if (e.t === "bola") jogosSom("bola", 0.3 + 0.7 * e.f);
      else if (e.t === "tabela") jogosSom("tabela", 0.2 + 0.5 * e.f);
      else if (e.t === "caiu") jogosSom("cacapa", 0.8);
    }
    if (i >= a.quadros.length - 1) { s.anim = null; bolas = j.mesa.bolas; } else requestAnimationFrame(sinucaPintar);
  }
  const branca = !s.anim && sinucaMinhaVez(j) ? sinucaBranca(j, s) : null;
  bolas.forEach((p, n) => { if (p && !(n === 0 && branca && s.branca)) sinucaBolaPintar(g, n, p[0], p[1], R); });
  if (s.anim) return;
  if (sinucaPondo(j, s) && s.fantasma) sinucaBolaPintar(g, 0, s.fantasma.x, s.fantasma.y, R, true);
  if (!branca) return;
  if (s.branca) sinucaBolaPintar(g, 0, branca[0], branca[1], R);
  // Mira: linha até a primeira bola (com a bola fantasma), o caminho da bola
  // acertada, o desvio da branca e o taco atrás dela, recuado pela força.
  const ang = s.angulo ?? 0, dx = Math.cos(ang), dy = Math.sin(ang), alvo = sinucaMira(bolas.map((p, n) => (n === 0 ? null : p)), branca, ang, R);
  g.save();
  sinucaLinha(g, branca, [alvo.x, alvo.y], "#ffffffdd", [], 2);
  if (alvo.alvo !== null) {
    const certa = sinucaPodeTocar(j, alvo.alvo), cx = sinucaPx(alvo.x), cy = sinucaPx(alvo.y);
    g.beginPath(); g.arc(cx, cy, R * P, 0, Math.PI * 2); g.strokeStyle = certa ? "#ffffff" : "#ff5a4a"; g.lineWidth = 2.5; g.stroke();
    if (!certa) {
      const d = R * P * 0.55;
      g.strokeStyle = "#ff5a4a"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d); g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d); g.stroke();
    } else {
      // Bola acertada sai na linha dos centros; a branca, na tangente.
      const ob = bolas[alvo.alvo], ox = ob[0] - alvo.x, oy = ob[1] - alvo.y, d = Math.hypot(ox, oy) || 1, nx = ox / d, ny = oy / d;
      const cheia = dx * nx + dy * ny, alcance = 6 + 22 * cheia;
      sinucaLinha(g, ob, [ob[0] + nx * alcance, ob[1] + ny * alcance], "#ffffffcc", [], 2);
      const tx = dx - cheia * nx, ty = dy - cheia * ny, tl = Math.hypot(tx, ty);
      if (tl > 0.05) sinucaLinha(g, [alvo.x, alvo.y], [alvo.x + tx / tl * (6 + 16 * tl), alvo.y + ty / tl * (6 + 16 * tl)], "#ffffff66", [P * 0.4, P * 0.4], 1.5);
    }
  }
  const forca = s.forcaAgora ?? 0, recuo = (R + 0.5 + 10 * forca) * P;
  const cx = sinucaPx(branca[0]) - dx * recuo, cy = sinucaPx(branca[1]) - dy * recuo, ex = cx - dx * 48 * P, ey = cy - dy * 48 * P;
  // Taco: ponteira, anel e madeira escurecendo até o cabo.
  const taco = g.createLinearGradient(cx, cy, ex, ey);
  taco.addColorStop(0, "#5ab0ff"); taco.addColorStop(0.012, "#f4efe2"); taco.addColorStop(0.03, "#f4efe2"); taco.addColorStop(0.035, "#1b1b1b");
  taco.addColorStop(0.045, "#e8cd96"); taco.addColorStop(0.62, "#c08a4a"); taco.addColorStop(0.64, "#2a1a0c"); taco.addColorStop(1, "#160d05");
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
