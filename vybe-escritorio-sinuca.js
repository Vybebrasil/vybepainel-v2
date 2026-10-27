// Sinuca na mesa de bilhar do Escritório (pedido do Paulo, 27/10/2026): bola 8
// para dois, de graça ou valendo VybeCoins e móveis/roupas. Convite e aposta
// são as telas do xadrez; a moldura da partida é a das mesas
// (vybe-escritorio-mesas.js). A física roda no servidor
// (server/escritorio-sinuca.js): aqui se mira, escolhe a força, põe a branca
// quando tem bola na mão e anima os quadros que o servidor devolveu. Aviso
// pelo balão de comando (snc=<id>:<para>:<c|l>).
const ESCRITORIO_SINUCA = /pooltable/;
const SINUCA_CFG = registrarMesaEscritorio({
  nome: "Sinuca", artigo: "a sinuca", extra: { jogo: "sinuca" }, sinal: "snc",
  nota: "Bola 8: quem sai é sorteado, lisas contra listradas.", desenhar: (j, s) => desenharSinuca(j, s),
});
// Mesa de 100 × 50 com 4 de tabela em volta; 10 px por unidade no canvas.
const SINUCA_L = 100, SINUCA_A = 50, SINUCA_B = 4, SINUCA_R = 1.15, SINUCA_PX = 10;
const SINUCA_CORES = ["#f7f4ea", "#f2c12e", "#1f5fbf", "#d23a2a", "#6a3fa0", "#f07a1a", "#1e8a4a", "#8a2a1e", "#151515"];
const SINUCA_CACAPAS = [[0, 0, 2.6], [50, -0.6, 2.2], [100, 0, 2.6], [0, 50, 2.6], [50, 50.6, 2.2], [100, 50, 2.6]];

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
// A branca de onde sai a tacada: a da mesa ou a que a pessoa acabou de pôr.
function sinucaBranca(j, s) {
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) return s.branca ? [s.branca.x, s.branca.y] : null;
  return j.mesa.bolas[0];
}

function sinucaUltimoTexto(j) {
  const u = j.mesa?.ultimo;
  if (!u) return "";
  const quem = u.lado === j.eu ? "Você" : xadrezPrimeiroNome(j[u.lado]);
  const caiu = u.caiu.filter((n) => n !== 0);
  const falta = { branca: "a branca caiu", nenhuma: "não tocou em nenhuma bola", errada: "tocou primeiro a bola errada" }[u.falta];
  return `${quem} tacou${caiu.length ? ` e encaçapou ${caiu.join(", ")}` : ""}${falta ? `: falta, ${falta}` : ""}.`;
}
function desenharSinuca(j, s) {
  const m = j.mesa, eu = j.eu, outro = eu ? mesaOutro(eu) : null;
  const chave = j.id + ":" + j.n;
  // Tacada nova (minha ou do outro): anima os quadros antes de mostrar a mesa parada.
  if (s.visto !== chave) {
    if (s.visto && s.visto.split(":")[0] === j.id && m.ultimo?.quadros?.length) s.anim = { quadros: m.ultimo.quadros, eventos: m.ultimo.eventos || [], inicio: 0 };
    s.visto = chave; s.branca = null;
  }
  const grupo = (l) => (m.grupos[l] ? `${m.grupos[l] === "lisas" ? "Lisas" : "Listradas"} · faltam ${m.restam[m.grupos[l]]}` : "Mesa aberta");
  const cima = outro || "desafiado", baixo = eu || "desafiante";
  const minha = sinucaMinhaVez(j), poe = minha && (m.bolaNaMao || !m.bolas[0]) && !s.branca;
  const status = j.estado !== "jogando" ? "" : !eu ? "Você está assistindo." : j.vez !== eu ? `Vez de ${xadrezPrimeiroNome(j[outro])}.`
    : poe ? "Bola na mão: toque na mesa onde quer pôr a branca." : "Sua vez: mire tocando na mesa, escolha a força e tacar.";
  const efeito = Math.round((s.efeito || 0) * 100);
  const controles = !minha ? "" : `<div class="snc-controles"><label><span>Força</span><input type="range" min="5" max="100" value="${Math.round((s.forca || 0.5) * 100)}" oninput="sinucaEstado().forca=this.value/100;sinucaPintar()" aria-label="Força da tacada"></label>
<label class="snc-efeito"><span>Puxar</span><input type="range" min="-100" max="100" step="10" value="${efeito}" oninput="sinucaEstado().efeito=this.value/100" aria-label="Efeito na branca: puxar ou seguir"><span>Seguir</span></label>
<div class="snc-mira-fina" role="group" aria-label="Ajuste fino da mira"><button type="button" class="workflow-secondary" onclick="sinucaGirar(-1)" aria-label="Mira meio grau para um lado">◀</button><button type="button" class="workflow-secondary" onclick="sinucaGirar(1)" aria-label="Mira meio grau para o outro lado">▶</button></div>
${m.bolaNaMao && s.branca ? `<button type="button" class="workflow-secondary" onclick="sinucaEstado().branca=null;desenharJogoMesa('snc')">Mudar a branca</button>` : ""}
<button type="button" class="workflow-primary" onclick="tacarSinuca(this)" ${poe ? "disabled" : ""}>Tacar</button></div>`;
  const ultimo = sinucaUltimoTexto(j);
  // Pinta logo que o canvas entra na tela (rAF não roda com a aba escondida).
  setTimeout(() => sinucaPintar());
  return {
    status,
    mesa: `${mesaJogadorHtml(j, cima, grupo(cima))}
<canvas id="snc-canvas" class="snc-canvas${minha ? " vez" : ""}" width="${(SINUCA_L + 2 * SINUCA_B) * SINUCA_PX}" height="${(SINUCA_A + 2 * SINUCA_B) * SINUCA_PX}" role="img" aria-label="Mesa de sinuca" onpointermove="sinucaPonteiro(event,false)" onclick="sinucaPonteiro(event,true)"></canvas>
${mesaJogadorHtml(j, baixo, grupo(baixo))}${controles}`,
    painel: ultimo ? `<p class="ofc-nota">${safeText(ultimo)}</p>` : "",
  };
}

// Ponteiro na mesa: com bola na mão, o clique põe a branca; senão, mira.
function sinucaPonteiro(ev, clicou) {
  const s = sinucaEstado(), j = s.jogo, c = ev.currentTarget;
  if (!sinucaMinhaVez(j) || s.anim) return;
  const r = c.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * (SINUCA_L + 2 * SINUCA_B) - SINUCA_B, y = (ev.clientY - r.top) / r.height * (SINUCA_A + 2 * SINUCA_B) - SINUCA_B;
  const poe = (j.mesa.bolaNaMao || !j.mesa.bolas[0]) && !s.branca;
  if (poe) {
    const px = Math.min(SINUCA_L - SINUCA_R, Math.max(SINUCA_R, x)), py = Math.min(SINUCA_A - SINUCA_R, Math.max(SINUCA_R, y));
    const livre = j.mesa.bolas.every((b, n) => !b || n === 0 || Math.hypot(b[0] - px, b[1] - py) >= 2 * SINUCA_R + 0.1);
    s.fantasma = { x: px, y: py, livre };
    if (clicou && livre) { s.branca = { x: Math.round(px * 100) / 100, y: Math.round(py * 100) / 100 }; s.fantasma = null; desenharJogoMesa("snc"); return; }
    sinucaPintar();
    return;
  }
  const b = sinucaBranca(j, s);
  if (!b || (!clicou && ev.pointerType === "touch")) return;
  s.angulo = Math.atan2(y - b[1], x - b[0]);
  sinucaPintar();
}
// Ajuste fino da mira (no celular o dedo erra): meio grau por toque.
function sinucaGirar(lado) {
  const s = sinucaEstado();
  if (!sinucaMinhaVez(s.jogo) || s.anim) return;
  s.angulo = (s.angulo ?? 0) + lado * (Math.PI / 360);
  sinucaPintar();
}
function tacarSinuca(botao) {
  const s = sinucaEstado(), j = s.jogo;
  if (!sinucaMinhaVez(j) || s.anim) return;
  const pedido = { tipo: "tacar", angulo: Math.round((s.angulo ?? 0) * 10000) / 10000, forca: s.forca || 0.5, efeito: s.efeito || 0 };
  if (j.mesa.bolaNaMao || !j.mesa.bolas[0]) pedido.branca = s.branca;
  lanceMesaEscritorio("snc", pedido, botao);
}

// Onde a mira bate primeiro: na bola (centro da "bola fantasma") ou na tabela.
function sinucaMira(bolas, b, ang) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t = Infinity, alvo = null;
  bolas.forEach((p, n) => {
    if (!p || n === 0) return;
    const ox = p[0] - b[0], oy = p[1] - b[1], proj = ox * dx + oy * dy, perp = Math.abs(ox * dy - oy * dx);
    if (proj <= 0 || perp >= 2 * SINUCA_R) return;
    const tt = proj - Math.sqrt(4 * SINUCA_R * SINUCA_R - perp * perp);
    if (tt < t) { t = tt; alvo = n; }
  });
  const parede = Math.min(dx > 0 ? (SINUCA_L - SINUCA_R - b[0]) / dx : dx < 0 ? (SINUCA_R - b[0]) / dx : Infinity,
    dy > 0 ? (SINUCA_A - SINUCA_R - b[1]) / dy : dy < 0 ? (SINUCA_R - b[1]) / dy : Infinity);
  if (parede < t) { t = parede; alvo = null; }
  return { x: b[0] + dx * t, y: b[1] + dy * t, alvo };
}
function sinucaBolaPintar(g, n, x, y, transparente) {
  const px = (x + SINUCA_B) * SINUCA_PX, py = (y + SINUCA_B) * SINUCA_PX, r = SINUCA_R * SINUCA_PX;
  g.save();
  if (transparente) g.globalAlpha = 0.55;
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
  g.fillStyle = n > 8 ? "#f7f4ea" : SINUCA_CORES[n]; g.fill();
  if (n > 8) { g.save(); g.clip(); g.fillStyle = SINUCA_CORES[n - 8]; g.fillRect(px - r, py - r * 0.55, 2 * r, r * 1.1); g.restore(); }
  if (n) {
    g.beginPath(); g.arc(px, py, r * 0.48, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
    g.fillStyle = "#111"; g.font = `700 ${Math.round(r * 0.62)}px system-ui,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(n), px, py + 0.5);
  }
  g.beginPath(); g.arc(px - r * 0.35, py - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fillStyle = "#ffffff55"; g.fill();
  g.restore();
}
// Desenha a mesa: tabela, pano, caçapas, bolas (ou o quadro da animação) e a mira.
function sinucaPintar(agora) {
  const s = sinucaEstado(), j = s.jogo, c = document.getElementById("snc-canvas");
  if (!j || !c) return;
  const g = c.getContext("2d"), W = c.width, H = c.height, P = SINUCA_PX, B = SINUCA_B;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#5a3416"; g.beginPath(); g.roundRect(0, 0, W, H, 3 * P); g.fill();
  g.fillStyle = "#1f7a4d"; g.fillRect(B * P, B * P, SINUCA_L * P, SINUCA_A * P);
  g.strokeStyle = "#ffffff22"; g.beginPath(); g.moveTo((B + 25) * P, B * P); g.lineTo((B + 25) * P, (B + SINUCA_A) * P); g.stroke();
  for (const [x, y, r] of SINUCA_CACAPAS) { g.beginPath(); g.arc((x + B) * P, (y + B) * P, r * P, 0, Math.PI * 2); g.fillStyle = "#0b0b0b"; g.fill(); }
  let bolas = j.mesa.bolas;
  if (s.anim) {
    const a = s.anim, t = agora || performance.now();
    a.inicio ||= t;
    const i = Math.min(a.quadros.length - 1, Math.floor((t - a.inicio) / (1000 / 30)));
    const q = a.quadros[i];
    bolas = Array.from({ length: 16 }, (_, n) => (q[2 * n] < 0 ? null : [q[2 * n] / 10, q[2 * n + 1] / 10]));
    // Som dos eventos que já passaram: taco, choque entre bolas, tabela, caçapa.
    if (a.som === undefined) { a.som = 0; escritorioTocar(180, 0.05, 0.05); }
    while (a.som < (a.eventos || []).length && a.eventos[a.som].q <= i) {
      const e = a.eventos[a.som++];
      if (e.t === "bola") escritorioTocar(1200 + 400 * e.f, 0.03, 0.03 + 0.05 * e.f);
      else if (e.t === "tabela") escritorioTocar(140, 0.06, 0.02 + 0.04 * e.f);
      else if (e.t === "caiu") escritorioTocar(90, 0.18, 0.07);
    }
    if (i >= a.quadros.length - 1) { s.anim = null; bolas = j.mesa.bolas; } else requestAnimationFrame(sinucaPintar);
  }
  const branca = !s.anim && sinucaMinhaVez(j) ? sinucaBranca(j, s) : null;
  bolas.forEach((p, n) => { if (p && !(n === 0 && branca && s.branca)) sinucaBolaPintar(g, n, p[0], p[1]); });
  if (s.anim) return;
  if (sinucaMinhaVez(j) && s.fantasma && !s.branca && (j.mesa.bolaNaMao || !j.mesa.bolas[0])) sinucaBolaPintar(g, 0, s.fantasma.x, s.fantasma.y, true);
  if (!branca) return;
  if (s.branca) sinucaBolaPintar(g, 0, branca[0], branca[1]);
  // Mira: linha até a primeira bola (com a bola fantasma) e o taco atrás da branca.
  const ang = s.angulo ?? 0, alvo = sinucaMira(bolas.map((p, n) => (n === 0 ? null : p)), branca, ang);
  g.save();
  g.setLineDash([P * 0.8, P * 0.6]); g.strokeStyle = "#ffffffaa"; g.lineWidth = 2;
  g.beginPath(); g.moveTo((branca[0] + B) * P, (branca[1] + B) * P); g.lineTo((alvo.x + B) * P, (alvo.y + B) * P); g.stroke();
  g.setLineDash([]);
  if (alvo.alvo !== null) {
    g.beginPath(); g.arc((alvo.x + B) * P, (alvo.y + B) * P, SINUCA_R * P, 0, Math.PI * 2); g.strokeStyle = "#ffffffcc"; g.stroke();
    // Para onde vai a bola acertada: do centro da bola fantasma ao centro dela, até a tabela.
    const ob = bolas[alvo.alvo], ox = ob[0] - alvo.x, oy = ob[1] - alvo.y, d = Math.hypot(ox, oy) || 1;
    const fim = sinucaMira([], ob, Math.atan2(oy / d, ox / d));
    g.setLineDash([P * 0.5, P * 0.5]); g.strokeStyle = "#ffe08aaa"; g.lineWidth = 2;
    g.beginPath(); g.moveTo((ob[0] + B) * P, (ob[1] + B) * P); g.lineTo((fim.x + B) * P, (fim.y + B) * P); g.stroke();
    g.setLineDash([]);
  }
  const recuo = (2 + 8 * (s.forca || 0.5)) * P, cx = (branca[0] + B) * P - Math.cos(ang) * recuo, cy = (branca[1] + B) * P - Math.sin(ang) * recuo;
  g.strokeStyle = "#d9b57a"; g.lineWidth = P * 0.7; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - Math.cos(ang) * 40 * P, cy - Math.sin(ang) * 40 * P); g.stroke();
  g.restore();
}
