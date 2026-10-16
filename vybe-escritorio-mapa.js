// Motor do mapa do escritório no estilo Habbo: piso e paredes num canvas de
// fundo; cada móvel, divisória e personagem é um elemento com z-index pela
// profundidade, para um boneco atrás da mesa ficar escondido por ela.
// Móveis: assets/escritorio/habbo (formato nitro). Bonecos: imager do Habbo.
// Animação só com o escritório visível e sem prefers-reduced-motion.
const MAPA_TW = 64, MAPA_TH = 32, MAPA_PAREDE = 118;
// A arte do Habbo tem o ponto de registro no centro do ladrilho; mapaTela dá o
// vértice de cima. Sem esta meia altura, todo móvel ficava meio ladrilho para
// trás (flutuando) em relação ao piso, à grade de colisão e aos bonecos.
const MAPA_MOVEL_Y = MAPA_TH / 2;
const MAPA_MOVEIS = new Map(); // classe → Promise<{dados, imagem}>
const MAPA_BASE = "/api/painel?area=escritorio&acao=arte&arquivo=";

// A arte só sai pela API, para quem está logado. No build, a versão da pasta
// de arte entra no endereço, para o cache do navegador renovar.
function mapaArquivo(nome) {
  const versao = typeof ESCRITORIO_ARTE_VERSAO !== "undefined" && ESCRITORIO_ARTE_VERSAO;
  return MAPA_BASE + encodeURIComponent(nome) + (versao ? "&v=" + versao : "");
}
function mapaCarregarMovel(classe) {
  if (!MAPA_MOVEIS.has(classe))
    MAPA_MOVEIS.set(classe, (async () => {
      const r = await fetch(mapaArquivo(classe + ".json"), { credentials: "same-origin" });
      if (!r.ok) throw new Error("Móvel indisponível: " + classe);
      const dados = await r.json();
      const imagem = new Image();
      imagem.src = mapaArquivo(classe + ".png");
      await imagem.decode();
      return { dados, imagem };
    })());
  return MAPA_MOVEIS.get(classe);
}
// Ladrilho → tela: vértice de cima do ladrilho.
function mapaTela(x, y, origem) {
  return { x: origem.x + (x - y) * (MAPA_TW / 2), y: origem.y + (x + y) * (MAPA_TH / 2) };
}
function mapaLadrilho(sx, sy, origem) {
  const a = (sx - origem.x) / (MAPA_TW / 2), b = (sy - origem.y) / (MAPA_TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
// Dimensões no chão conforme a direção: valem para 0 e 4; 2 e 6 giram o móvel.
function mapaDimensoes(dados, dir) {
  const d = dados.logic?.model?.dimensions || { x: 1, y: 1 };
  return dir === 2 || dir === 6 ? { x: d.y || 1, y: d.x || 1, z: d.z } : { x: d.x || 1, y: d.y || 1, z: d.z };
}
function mapaDirecaoValida(dados, dir) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const dirs = Object.keys(v?.directions || {}).map(Number);
  if (!dirs.length || dirs.includes(dir)) return dir;
  return dirs.includes((dir + 4) % 8) ? (dir + 4) % 8 : dirs[0];
}
// Quantos quadros a animação do estado tem (o maior entre as camadas).
function mapaQuadros(dados, estado) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const camadas = v?.animations?.[estado]?.layers || {};
  let n = 1;
  for (const c of Object.values(camadas)) n = Math.max(n, Object.keys(c.frameSequences?.[0]?.frames || {}).length);
  return n;
}
// Desenha um móvel num canvas próprio; devolve o deslocamento até o vértice
// de cima do ladrilho de origem.
function mapaDesenharMovel({ dados, imagem }, dir, estado, quadro) {
  const v = dados.visualizations.find((v) => v.size === 64);
  const nome = dados.name;
  const partes = [];
  const sombra = `${nome}_64_sd_${dir}_0`;
  if (dados.assets[sombra]) partes.push({ asset: sombra, z: -1e6, alpha: 0.18 });
  for (let i = 0; i < (v.layerCount || 1); i++) {
    const L = { ...(v.layers?.[i] || {}), ...(v.directions?.[dir]?.layers?.[i] || {}) };
    const seq = v.animations?.[estado]?.layers?.[i]?.frameSequences?.[0]?.frames;
    const lista = seq ? Object.values(seq) : null;
    const id = lista ? lista[quadro % lista.length].id : 0;
    const asset = `${nome}_64_${String.fromCharCode(97 + i)}_${dir}_${id}`;
    if (!dados.assets[asset]) continue;
    partes.push({ asset, z: L.z || 0, ink: L.ink, alpha: L.alpha != null ? L.alpha / 255 : 1, ordem: i });
  }
  partes.sort((a, b) => a.z - b.z || (a.ordem || 0) - (b.ordem || 0));
  const caixas = partes.map((p) => {
    const a = dados.assets[p.asset];
    const fonte = a.source || p.asset;
    const f = dados.spritesheet.frames[`${nome}_${fonte}`]?.frame;
    if (!f) return null;
    // Ponto de registro: sem espelho, (−x, −y); espelhado, o x conta da direita.
    const x = a.flipH ? a.x - f.w : -a.x;
    return { ...p, f, flip: Boolean(a.flipH), x, y: -a.y };
  }).filter(Boolean);
  if (!caixas.length) return null;
  const minX = Math.min(...caixas.map((c) => c.x)), minY = Math.min(...caixas.map((c) => c.y));
  const maxX = Math.max(...caixas.map((c) => c.x + c.f.w)), maxY = Math.max(...caixas.map((c) => c.y + c.f.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, maxX - minX);
  canvas.height = Math.max(1, maxY - minY);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  for (const c of caixas) {
    g.save();
    g.globalAlpha = c.alpha;
    if (c.ink === "ADD") g.globalCompositeOperation = "lighter";
    const dx = c.x - minX, dy = c.y - minY;
    if (c.flip) {
      g.translate(dx + c.f.w, dy);
      g.scale(-1, 1);
      g.drawImage(imagem, c.f.x, c.f.y, c.f.w, c.f.h, 0, 0, c.f.w, c.f.h);
    } else g.drawImage(imagem, c.f.x, c.f.y, c.f.w, c.f.h, dx, dy, c.f.w, c.f.h);
    g.restore();
  }
  return { canvas, ox: minX, oy: minY };
}
// Piso, borda do prédio, paredes do fundo e textos/logo pintados nelas.
function mapaDesenharFundo(canvas, planta, origem, logo, ceu = "noite") {
  const dia = ceu === "manha" || ceu === "tarde";
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const losango = (x, y, w = 1, h = 1) => {
    const a = mapaTela(x, y, origem), b = mapaTela(x + w, y, origem), c = mapaTela(x + w, y + h, origem), d = mapaTela(x, y + h, origem);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
  };
  const cor = (piso, x, y) => { const p = planta.PISO[piso] || planta.PISO.corredor; return p[(Math.floor(x) + Math.floor(y)) % 2]; };
  const P = planta.PREDIO;
  // Vybelândia: a cidade ao fundo, com janelas acesas, atrás das paredes.
  const topoEsq = mapaTela(0, P.y1, origem), topoMeio = mapaTela(0, 0, origem), topoDir = mapaTela(P.x1, 0, origem);
  let semente = 7;
  const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let x = topoEsq.x - 120; x < topoDir.x + 160; x += 34 + sorte() * 40) {
    const t = x < topoMeio.x ? (x - topoEsq.x) / (topoMeio.x - topoEsq.x) : (topoDir.x - x) / (topoDir.x - topoMeio.x);
    const base = topoMeio.y - MAPA_PAREDE + (1 - Math.max(0, Math.min(1, t))) * (topoEsq.y - topoMeio.y) + 40;
    const w = 30 + sorte() * 46, h = 120 + sorte() * 260;
    // De dia, prédios azulados com vidros claros; à noite, escuros e acesos.
    g.fillStyle = dia ? (sorte() > 0.5 ? "#4a5a78" : "#5a6a88") : sorte() > 0.5 ? "#15121a" : "#1c1720";
    g.fillRect(x, base - h, w, h + 40);
    for (let wy = base - h + 10; wy < base - 8; wy += 14) for (let wx = x + 6; wx < x + w - 6; wx += 10) {
      const acesa = sorte() > 0.55, quente = sorte() > 0.3, alfa = 0.55 + sorte() * 0.45;
      if (dia) { if (acesa) { g.fillStyle = "#cfe3ff"; g.globalAlpha = 0.35 + alfa * 0.3; g.fillRect(wx, wy, 4, 6); g.globalAlpha = 1; } }
      else if (acesa) { g.fillStyle = quente ? "#ffb35c" : "#ff7a1a"; g.globalAlpha = alfa; g.fillRect(wx, wy, 4, 6); g.globalAlpha = 1; }
    }
  }
  if (dia) {
    // Nuvens leves no céu do dia.
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 7; i++) {
      const cx = topoEsq.x + sorte() * (topoDir.x - topoEsq.x), cy = topoMeio.y - MAPA_PAREDE - 260 - sorte() * 220;
      g.globalAlpha = 0.5 + sorte() * 0.3;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * 34, cy + (k % 2) * 8, 46, 20, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  // Praça escura em volta (como as calçadas da Vybelândia), com gramados nos cantos.
  for (let x = 0; x < planta.W; x++) for (let y = 0; y < planta.H; y++) {
    const gramado = (x >= P.x1 + 3 && y > P.y1) || (y >= P.y1 + 7 && x < 22);
    losango(x, y); g.fillStyle = gramado ? cor("grama", x, y) : (x + y) % 6 === 0 ? "#34323a" : cor("praca", x, y); g.fill();
  }
  for (let x = P.x0; x < P.x1; x++) for (let y = P.y0; y < P.y1; y++) {
    const a = escritorioAmbienteEm(x + 0.5, y + 0.5);
    losango(x, y); g.fillStyle = cor(a ? a.piso : "corredor", x, y); g.fill();
    g.strokeStyle = "#0000001a"; g.lineWidth = 1; g.stroke();
  }
  // Faixa laranja no meio dos corredores, como as ruas da Vybelândia.
  g.strokeStyle = "#ff7a1a55"; g.lineWidth = 2; g.setLineDash([10, 8]);
  for (const y of planta.corredores || []) { const a = mapaTela(P.x0, y, origem), b = mapaTela(P.x1, y, origem); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
  g.setLineDash([]);
  const pi = planta.piscina;
  for (let x = pi.x0 - 1; x < pi.x1 + 1; x++) for (let y = pi.y0 - 1; y < pi.y1 + 2; y++) { losango(x, y); g.fillStyle = cor("deck", x, y); g.fill(); }
  // Água da piscina: azul com reflexos e a borda interna mais escura.
  losango(pi.x0, pi.y0, pi.x1 - pi.x0, pi.y1 - pi.y0);
  const ag = mapaTela(pi.x0, pi.y0, origem), ab = mapaTela(pi.x1, pi.y1, origem);
  const grad = g.createLinearGradient(ag.x, ag.y, ab.x, ab.y);
  grad.addColorStop(0, "#1f8fd6"); grad.addColorStop(1, "#4cc3f0");
  g.fillStyle = grad; g.fill();
  g.strokeStyle = "#0e5f96"; g.lineWidth = 4; g.stroke();
  g.strokeStyle = "#ffffff55"; g.lineWidth = 2;
  for (let i = 1; i < pi.x1 - pi.x0; i += 2) {
    const a = mapaTela(pi.x0 + i, pi.y0 + 0.6, origem), b = mapaTela(pi.x0 + i + 0.8, pi.y0 + 0.6, origem);
    g.beginPath(); g.moveTo(a.x, a.y + 6); g.lineTo(b.x, b.y + 6); g.stroke();
  }
  // Espessura do piso do prédio nas bordas da frente
  const borda = (x0, y0, x1, y1, tom) => {
    const a = mapaTela(x0, y0, origem), b = mapaTela(x1, y1, origem);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.x, b.y + 10); g.lineTo(a.x, a.y + 10); g.closePath();
    g.fillStyle = tom; g.fill();
  };
  borda(P.x0, P.y1, P.x1, P.y1, "#1b1c20"); borda(P.x1, P.y0, P.x1, P.y1, "#25262b");
  // Paredes do fundo: eixo x (cima-direita) e eixo y (cima-esquerda)
  const parede = (x0, y0, x1, y1, tom) => {
    const a = mapaTela(x0, y0, origem), b = mapaTela(x1, y1, origem);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.x, b.y - MAPA_PAREDE); g.lineTo(a.x, a.y - MAPA_PAREDE); g.closePath();
    g.fillStyle = tom; g.fill();
  };
  parede(P.x0, P.y0, P.x1, P.y0, "#1d1e23"); parede(P.x0, P.y0, P.x0, P.y1, "#16171b");
  const topo = (x0, y0, x1, y1) => {
    const a = mapaTela(x0, y0, origem), b = mapaTela(x1, y1, origem);
    g.fillStyle = "#3a3c44";
    g.beginPath(); g.moveTo(a.x, a.y - MAPA_PAREDE); g.lineTo(b.x, b.y - MAPA_PAREDE); g.lineTo(b.x, b.y - MAPA_PAREDE - 6); g.lineTo(a.x, a.y - MAPA_PAREDE - 6); g.closePath(); g.fill();
  };
  topo(P.x0, P.y0, P.x1, P.y0); topo(P.x0, P.y0, P.x0, P.y1);
  // Faixa laranja da Vybe no rodapé
  g.strokeStyle = "#ff6b1a"; g.lineWidth = 3;
  for (const [x0, y0, x1, y1] of [[P.x0, P.y0, P.x1, P.y0], [P.x0, P.y0, P.x0, P.y1]]) {
    const a = mapaTela(x0, y0, origem), b = mapaTela(x1, y1, origem);
    g.beginPath(); g.moveTo(a.x, a.y - 4); g.lineTo(b.x, b.y - 4); g.stroke();
  }
  for (const q of planta.quadros) {
    const a = q.parede === "x" ? mapaTela(q.de, 0, origem) : mapaTela(0, q.de, origem);
    const b = q.parede === "x" ? mapaTela(q.ate, 0, origem) : mapaTela(0, q.ate, origem);
    const largura = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save();
    g.translate(a.x, a.y - MAPA_PAREDE * 0.62);
    // Inclinação da parede sem girar o texto na vertical
    g.transform(1, Math.tan(ang), 0, 1, 0, 0);
    const largX = largura * Math.cos(ang) * (q.parede === "x" ? 1 : -1);
    if (q.tipo === "logo" && logo?.complete) {
      const h = 44, w = (logo.naturalWidth / logo.naturalHeight) * h;
      g.filter = "drop-shadow(0 0 6px #ff6b1aaa)";
      g.drawImage(logo, (largX - w) / 2, -h / 2, w, h);
    } else if (q.tipo === "texto") {
      g.font = "700 22px 'Arial Black', Arial, sans-serif";
      g.fillStyle = q.cor; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = q.cor; g.shadowBlur = 8;
      g.fillText(q.texto, largX / 2, 0, Math.abs(largX) - 8);
    }
    g.restore();
  }
  // Postes com luz laranja na praça.
  for (const [x, y] of planta.postes || []) {
    const t = mapaTela(x + 0.5, y + 0.5, origem);
    const brilho = g.createRadialGradient(t.x, t.y, 4, t.x, t.y, 120);
    brilho.addColorStop(0, "#ffb05c66"); brilho.addColorStop(1, "#ff7a1a00");
    g.fillStyle = brilho; g.beginPath(); g.ellipse(t.x, t.y, 120, 60, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1b1b20"; g.fillRect(t.x - 2, t.y - 92, 4, 92);
    g.fillStyle = "#ffd29a"; g.shadowColor = "#ff8a2a"; g.shadowBlur = 18; g.beginPath(); g.arc(t.x, t.y - 96, 6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
  }
  // Letreiro em neon sobre a parede do fundo.
  if (planta.letreiro) {
    const a = mapaTela(planta.letreiro.de, 0, origem), b = mapaTela(planta.letreiro.ate, 0, origem);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    g.save();
    g.translate(a.x, a.y - MAPA_PAREDE - 58);
    g.transform(1, Math.tan(ang), 0, 1, 0, 0);
    const larg = (b.x - a.x);
    g.fillStyle = "#121116"; g.fillRect(-10, -44, larg + 20, 66);
    g.font = "900 46px 'Arial Black', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "#ff7a1a"; g.shadowBlur = 22; g.fillStyle = "#ff8a2a";
    g.fillText(planta.letreiro.texto, larg / 2, -10, larg);
    g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = "#ffd29a"; g.strokeText(planta.letreiro.texto, larg / 2, -10, larg);
    g.restore();
  }
}
// Divisória entre ambientes: um bloco escuro baixo por ladrilho de aresta.
function mapaDivisoria(x, y, eixo) {
  const c = document.createElement("canvas");
  const alt = 46;
  c.width = MAPA_TW / 2 + 6; c.height = MAPA_TH / 2 + alt + 6;
  const g = c.getContext("2d");
  // eixo "x": a aresta vai para baixo-direita; "y": para baixo-esquerda
  const sobe = eixo === "x";
  const p0 = sobe ? { x: 0, y: alt } : { x: MAPA_TW / 2, y: alt };
  const p1 = sobe ? { x: MAPA_TW / 2, y: alt + MAPA_TH / 2 } : { x: 0, y: alt + MAPA_TH / 2 };
  g.fillStyle = sobe ? "#1c1d22" : "#131418";
  g.beginPath(); g.moveTo(p0.x + 3, p0.y); g.lineTo(p1.x + 3, p1.y); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p0.x + 3, p0.y - alt); g.closePath(); g.fill();
  g.fillStyle = "#4a4d57";
  g.beginPath(); g.moveTo(p0.x + 3, p0.y - alt); g.lineTo(p1.x + 3, p1.y - alt); g.lineTo(p1.x + 3, p1.y - alt - 3); g.lineTo(p0.x + 3, p0.y - alt - 3); g.closePath(); g.fill();
  return { canvas: c, ox: sobe ? -3 : -MAPA_TW / 2 - 3, oy: -alt };
}
const MAPA_FIGURA_PELE = { clara: 1, media: 8, escura: 14 };
const MAPA_FIGURA_ROUPA = { laranja: 1408, azul: 82, verde: 1335, roxo: 92, rosa: 1321, grafite: 64 };
// Figura do Habbo a partir das escolhas do perfil, ou a figura que a pessoa colou.
function mapaFigura(perfil = {}) {
  if (perfil.figura && /^[a-z]{2}-\d+(-\d+){0,2}(\.[a-z]{2}-\d+(-\d+){0,2})*$/.test(perfil.figura)) return perfil.figura;
  const pele = MAPA_FIGURA_PELE[perfil.pele] || 8;
  const roupa = MAPA_FIGURA_ROUPA[perfil.roupa] || 1408;
  const cabelo = { curto: "hr-828-61", longo: "hr-515-45", cacheado: "hr-3163-45", sem: "" }[perfil.cabelo || "curto"] ?? "hr-828-61";
  const corpo = perfil.cabelo === "longo" ? `hd-600-${pele}.ch-665-${roupa}.lg-700-82.sh-725-62` : `hd-180-${pele}.ch-255-${roupa}.lg-280-110.sh-305-62`;
  return [corpo, cabelo].filter(Boolean).join(".");
}
function mapaBonecoGuardado(figura, dir) {
  return "/api/painel?" + new URLSearchParams({ area: "escritorio", acao: "boneco", figura, dir });
}
// Garante a cópia das 8 direções de um boneco (uma por vez, sem pressa).
async function mapaGuardarBoneco(figura) {
  for (let dir = 0; dir < 8; dir++) {
    try { await fetch(mapaBonecoGuardado(figura, dir), { credentials: "same-origin" }); } catch {}
  }
}
// acao: std/wlk/sit/lay/wav; mao: algo na mão ("crr=6" é a caneca de café).
// Selos de status (SVG, sem emoji): fone para "Em foco", balão para "Em reunião".
const MAPA_SELOS = {
  foco: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  reuniao: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
};
// quadro: andando, o Habbo tem 4 quadros de passo (frame_num 0–3).
function mapaAvatarUrl(figura, dir, acao, mao, quadro) {
  const q = new URLSearchParams({ figure: figura, direction: dir, head_direction: dir, action: mao ? `${acao},${mao}` : acao, gesture: "sml", size: "n" });
  if (acao === "wlk") q.set("frame_num", String(quadro || 0));
  return "https://www.habbo.com/habbo-imaging/avatarimage?" + q;
}
// Quadros já baixados: a troca só acontece com a imagem pronta, sem piscar.
const MAPA_BONECOS = new Map();
function mapaBonecoPronto(url, aoCarregar) {
  let img = MAPA_BONECOS.get(url);
  if (!img) {
    img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = url;
    MAPA_BONECOS.set(url, img);
    if (MAPA_BONECOS.size > 600) MAPA_BONECOS.delete(MAPA_BONECOS.keys().next().value);
  }
  if (img.complete && img.naturalWidth) return true;
  img.addEventListener("load", aoCarregar, { once: true });
  return false;
}
const MAPA_QUADRO_PASSO = 85; // ms por quadro de passo, no ritmo da velocidade normal
// Direção do Habbo (0–7) para um passo na grade.
function mapaDirecaoDoPasso(dx, dy) {
  const a = Math.atan2(dy, dx);
  const oito = Math.round(a / (Math.PI / 4));
  return { 0: 2, 1: 3, 2: 4, 3: 5, 4: 6, "-4": 6, "-3": 7, "-2": 0, "-1": 1 }[oito] ?? 2;
}

// Mecânica do Habbo: anda de ladrilho em ladrilho, desvia de paredes e móveis
// e senta quando para num assento. A grade marca o que bloqueia; paredes são
// arestas entre ladrilhos vizinhos.
const MAPA_ASSENTOS = new Set(["hc26_10", "army_c15_leatherchr", "mafia_c26_armchair_dark", "hygge_c25_armchair",
  "hygge_c25_barstool", "vwave_c21_barstool", "hc26_5", "mafia_c26_sofa_dark", "js_c16_lounger", "br_c25_stonebench", "hygge_c25_hangingchair",
  "modern_c17_sofa", "modern_c17_chair", "mafia_c26_armchair_white", "cubie_beanbag_b", "cubie_beanbag_p", "classic9_chair", "studio_chair", "hc23_6", "ducket_c26_seachair"]);
function mapaMontarGrade(P, moveis) {
  const W = P.W, H = P.H;
  const bloqueado = new Uint8Array(W * H);
  const assento = new Map(); // índice → direção de quem senta
  const profAssento = new Map(); // índice → profundidade do assento (quem senta fica à frente)
  const paredes = new Set(); // "x,y|x,y" entre vizinhos
  const ind = (x, y) => y * W + x;
  const aresta = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  for (const [x0, y0, x1, y1] of P.divisorias) {
    if (y0 === y1) for (let x = x0; x < x1; x++) paredes.add(aresta(ind(x, y0 - 1), ind(x, y0)));
    else for (let y = y0; y < y1; y++) paredes.add(aresta(ind(x0 - 1, y), ind(x0, y)));
  }
  const pi = P.piscina;
  if (pi) for (let x = pi.x0; x < pi.x1; x++) for (let y = pi.y0; y < pi.y1; y++) bloqueado[ind(x, y)] = 1;
  for (const m of moveis) {
    if (m.altura || m.plano) continue; // em cima de mesa ou rente ao piso
    const senta = MAPA_ASSENTOS.has(m.classe);
    for (let dx = 0; dx < m.dim.x; dx++) for (let dy = 0; dy < m.dim.y; dy++) {
      const x = Math.floor(m.x) + dx, y = Math.floor(m.y) + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (senta) { assento.set(ind(x, y), m.dir); profAssento.set(ind(x, y), m.prof); }
      else bloqueado[ind(x, y)] = 1;
    }
  }
  return { W, H, bloqueado, assento, profAssento, paredes, ind, aresta };
}
// Pode ir de (x,y) para o vizinho (x+dx,y+dy)? Diagonal só se os dois
// caminhos retos também passam (não corta quina de parede).
function mapaPassa(g, x, y, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H || g.bloqueado[g.ind(nx, ny)]) return false;
  if (dx && dy) return mapaPassa(g, x, y, dx, 0) && mapaPassa(g, x + dx, y, 0, dy) && mapaPassa(g, x, y, 0, dy) && mapaPassa(g, x, y + dy, dx, 0);
  return !g.paredes.has(g.aresta(g.ind(x, y), g.ind(nx, ny)));
}
// A* em 8 direções. Devolve os ladrilhos do caminho (sem o de partida) ou null.
function mapaCaminho(g, de, para) {
  const sx = Math.round(de.x), sy = Math.round(de.y), tx = Math.floor(para.x), ty = Math.floor(para.y);
  if (tx < 0 || ty < 0 || tx >= g.W || ty >= g.H || g.bloqueado[g.ind(tx, ty)]) return null;
  if (sx === tx && sy === ty) return [];
  const inicio = g.ind(Math.max(0, Math.min(g.W - 1, sx)), Math.max(0, Math.min(g.H - 1, sy))), alvo = g.ind(tx, ty);
  const custo = new Map([[inicio, 0]]), veio = new Map(), aberto = [[0, inicio]], fechado = new Set();
  const h = (i) => { const dx = Math.abs((i % g.W) - tx), dy = Math.abs(Math.floor(i / g.W) - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  while (aberto.length) {
    let k = 0;
    for (let i = 1; i < aberto.length; i++) if (aberto[i][0] < aberto[k][0]) k = i;
    const [, atual] = aberto.splice(k, 1)[0];
    if (atual === alvo) break;
    if (fechado.has(atual)) continue;
    fechado.add(atual);
    const x = atual % g.W, y = Math.floor(atual / g.W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!mapaPassa(g, x, y, dx, dy)) continue;
      const viz = g.ind(x + dx, y + dy);
      // Assento só serve de destino: ninguém atravessa sofá ou cadeira.
      if (g.assento.has(viz) && viz !== alvo) continue;
      const c = custo.get(atual) + (dx && dy ? 1.414 : 1);
      if (c < (custo.get(viz) ?? Infinity)) { custo.set(viz, c); veio.set(viz, atual); aberto.push([c + h(viz), viz]); }
    }
  }
  if (!veio.has(alvo)) return null;
  const passos = [];
  for (let i = alvo; i !== inicio; i = veio.get(i)) passos.unshift({ x: i % g.W, y: Math.floor(i / g.W) });
  return passos;
}

// Quem fica atrás de quem (caixas no piso, como no Habbo): A está atrás de B
// se termina antes de B começar no x ou no y. Em cima de mesa fica à frente
// da mesa. Sem separação (casos raros), decide a soma dos centros.
function mapaAtras(a, b) {
  const ax = a.x1 <= b.x0, bx = b.x1 <= a.x0, ay = a.y1 <= b.y0, by = b.y1 <= a.y0;
  if ((ax || ay) && !(bx || by)) return true;
  if ((bx || by) && !(ax || ay)) return false;
  if (!(ax || ay || bx || by) && (a.altura || 0) !== (b.altura || 0)) return (a.altura || 0) < (b.altura || 0);
  return a.x0 + a.x1 + a.y0 + a.y1 < b.x0 + b.x1 + b.y0 + b.y1;
}
function mapaDiagonal(a, b) {
  return (a.x1 <= b.x0 || a.y1 <= b.y0) && (b.x1 <= a.x0 || b.y1 <= a.y0);
}
// Ordena paredes e móveis que se cruzam na tela (ordem topológica) e dá a
// cada um uma profundidade com folga de 10, para os bonecos caberem entre eles.
// A fórmula antiga (soma do canto da frente) empatava ou invertia móveis
// compridos com os vizinhos: mesa e cadeira, sofá e mesinha.
function mapaOrdenar(objetos) {
  const n = objetos.length, depois = Array.from({ length: n }, () => []), grau = new Array(n).fill(0);
  // Folga do tamanho de um boneco: dois móveis que um boneco pode cruzar ao
  // mesmo tempo também ganham ordem entre si (senão ele não cabe entre eles).
  const ret = objetos.map((o) => ({ l: parseFloat(o.no.style.left) - 24, t: parseFloat(o.no.style.top) - 60, r: parseFloat(o.no.style.left) + o.no.width + 24, b: parseFloat(o.no.style.top) + o.no.height + 20 }));
  const ordem = [...objetos.keys()].sort((i, j) => ret[i].l - ret[j].l);
  for (let k = 0; k < n; k++) {
    const i = ordem[k];
    for (let q = k + 1; q < n; q++) {
      const j = ordem[q];
      if (ret[j].l >= ret[i].r) break;
      if (ret[j].t >= ret[i].b || ret[j].b <= ret[i].t) continue;
      if (mapaDiagonal(objetos[i].caixa, objetos[j].caixa) && !(ret[j].l < ret[i].r - 48 && ret[j].t < ret[i].b - 80 && ret[j].b > ret[i].t + 80)) continue;
      if (mapaAtras(objetos[i].caixa, objetos[j].caixa)) { depois[i].push(j); grau[j]++; }
      else { depois[j].push(i); grau[i]++; }
    }
  }
  // Kahn, escolhendo sempre o mais ao fundo; ciclo (raro) quebra pelo mais ao fundo.
  const chave = (i) => objetos[i].caixa.x0 + objetos[i].caixa.y0 + (objetos[i].caixa.altura || 0) * 0.01;
  const feito = new Array(n).fill(false);
  let livres = [...objetos.keys()].filter((i) => !grau[i]), rank = 0;
  for (let cont = 0; cont < n; cont++) {
    if (!livres.length) livres = [[...objetos.keys()].filter((i) => !feito[i]).sort((a, b) => chave(a) - chave(b))[0]];
    let m = 0;
    for (let k = 1; k < livres.length; k++) if (chave(livres[k]) < chave(livres[m])) m = k;
    const i = livres.splice(m, 1)[0];
    if (feito[i]) { cont--; continue; }
    feito[i] = true;
    objetos[i].prof = 10 + (rank++) * 10;
    objetos[i].no.style.zIndex = objetos[i].prof;
    for (const j of depois[i]) if (--grau[j] === 0 && !feito[j]) livres.push(j);
  }
}

// Cria o mapa dentro de `el`. Devolve controles para pessoas, câmera e zoom.
function criarMapaEscritorio(el, { planta, logo, aoClicar, aoPassar, eu }) {
  const P = planta;
  const largura = (P.W + P.H) * (MAPA_TW / 2) + 80;
  const altura = (P.W + P.H) * (MAPA_TH / 2) + MAPA_PAREDE + 140;
  const origem = { x: P.H * (MAPA_TW / 2) + 40, y: MAPA_PAREDE + 60 };
  const palco = document.createElement("div");
  palco.className = "mapa-palco";
  // Céu no horário de Irecê (UTC−3): madrugada, manhã, tarde, pôr do sol, noite.
  let fundoPronto = null;
  const ceu = () => {
    const h = new Date(Date.now() - 3 * 3600e3).getUTCHours();
    const agora = h < 5 ? "madrugada" : h < 11 ? "manha" : h < 16 ? "tarde" : h < 19 ? "por-do-sol" : "noite";
    if (el.dataset.ceu === agora) return;
    el.dataset.ceu = agora;
    fundoPronto?.(); // redesenha a cidade (dia claro / noite acesa)
  };
  ceu();
  const relogioCeu = setInterval(ceu, 5 * 60e3);
  palco.style.width = largura + "px";
  palco.style.height = altura + "px";
  const fundo = document.createElement("canvas");
  fundo.width = largura; fundo.height = altura; fundo.className = "mapa-fundo";
  palco.append(fundo);
  // Zona onde a pessoa está: piso destacado com a cor da área e contorno.
  const zonaCanvas = document.createElement("canvas");
  zonaCanvas.width = largura; zonaCanvas.height = altura; zonaCanvas.className = "mapa-zona";
  palco.append(zonaCanvas);
  function marcarZona(a) {
    const g = zonaCanvas.getContext("2d");
    g.clearRect(0, 0, largura, altura);
    if (!a) return;
    const cor = (typeof ESCRITORIO_COR_SALA !== "undefined" && ESCRITORIO_COR_SALA[a.sala]) || "#ff8a35";
    const pts = [mapaTela(a.x0, a.y0, origem), mapaTela(a.x1, a.y0, origem), mapaTela(a.x1, a.y1, origem), mapaTela(a.x0, a.y1, origem)];
    g.beginPath(); pts.forEach((t, i) => (i ? g.lineTo(t.x, t.y) : g.moveTo(t.x, t.y))); g.closePath();
    g.fillStyle = cor + "3d"; g.fill();
    g.shadowColor = cor; g.shadowBlur = 14;
    g.setLineDash([16, 8]); g.lineWidth = 5; g.strokeStyle = cor; g.stroke();
    g.shadowBlur = 0;
  }
  el.replaceChildren(palco);
  const imgLogo = new Image();
  imgLogo.src = logo;
  const pintarFundo = () => { fundo.getContext("2d").clearRect(0, 0, fundo.width, fundo.height); mapaDesenharFundo(fundo, P, origem, imgLogo, el.dataset.ceu); };
  pintarFundo();
  fundoPronto = pintarFundo;
  imgLogo.onload = pintarFundo;

  const colocar = (no, x, y, desenho, prof) => {
    const t = mapaTela(x, y, origem);
    no.style.left = t.x + desenho.ox + "px";
    no.style.top = t.y + desenho.oy + "px";
    no.style.zIndex = prof;
  };
  // Divisórias. Parede na frente de alguém fica transparente (recorte), para
  // ninguém sumir atrás dela.
  const muros = [];
  const recortar = (id, l, t, r, b, prof) => {
    for (const m of muros) {
      const cobre = m.prof > prof && m.l < r && m.r > l && m.t < b && m.b > t;
      if (cobre === m.quem.has(id)) continue;
      cobre ? m.quem.add(id) : m.quem.delete(id);
      m.no.classList.toggle("recortado", m.quem.size > 0);
    }
  };
  for (const [x0, y0, x1, y1] of P.divisorias) {
    const eixo = y0 === y1 ? "x" : "y";
    const n = eixo === "x" ? x1 - x0 : y1 - y0;
    for (let i = 0; i < n; i++) {
      const x = eixo === "x" ? x0 + i : x0, y = eixo === "x" ? y0 : y0 + i;
      const d = mapaDivisoria(x, y, eixo);
      d.canvas.className = "mapa-obj mapa-muro";
      const prof = Math.round((x + y) * 10) + 2;
      colocar(d.canvas, x, y, d, prof);
      palco.append(d.canvas);
      const t = mapaTela(x, y, origem), l = t.x + d.ox, tp = t.y + d.oy;
      const caixa = eixo === "x" ? { x0: x, x1: x + 1, y0: y, y1: y } : { x0: x, x1: x, y0: y, y1: y + 1 };
      muros.push({ no: d.canvas, prof, caixa, l, t: tp, r: l + d.canvas.width, b: tp + d.canvas.height, quem: new Set() });
    }
  }
  // Móveis (animados ficam numa lista para trocar de quadro)
  const animados = [];
  const moveis = [];
  const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Móveis ligados/desligados pela equipe ("classe@x,y" → estado), inclusive
  // os que chegam antes de o móvel terminar de carregar.
  const estadosForcados = new Map();
  const chaveMovel = (m) => `${m.classe}@${Math.floor(m.x)},${Math.floor(m.y)}`;
  const aplicarEstado = (item, estado) => {
    if (item.estado === estado) return;
    const d = mapaDesenharMovel(item.m, item.dir, estado, 0);
    if (!d) return;
    item.ligadoPadrao ??= item.estado || 1;
    item.estado = estado;
    item.quadros = mapaQuadros(item.m.dados, estado);
    item.no.width = d.canvas.width; item.no.height = d.canvas.height;
    item.no.getContext("2d").drawImage(d.canvas, 0, 0);
    colocar(item.no, item.x, item.y, { ...d, oy: d.oy + MAPA_MOVEL_Y - item.altura * 32 }, item.prof);
    const i = animados.indexOf(item);
    if (i >= 0) animados.splice(i, 1);
    if (item.quadros > 1 && !reduzido) animados.push(item);
  };
  function estadosMoveis(lista) {
    for (const [chave, estado] of lista || []) {
      estadosForcados.set(chave, estado);
      for (const m of moveis) if (chaveMovel(m) === chave) aplicarEstado(m, estado);
    }
  }
  // altura: em unidades do Habbo (1 = 32 px), para o que fica em cima de mesas.
  const montar = async ([classe, x, y, dir, estado, altura = 0, origemItem = null]) => {
    try {
      const m = await mapaCarregarMovel(classe);
      const d0 = mapaDirecaoValida(m.dados, dir);
      const desenho = mapaDesenharMovel(m, d0, estado, 0);
      if (!desenho) return;
      const dim = mapaDimensoes(m.dados, d0);
      // Rente ao piso (tapete): altura zero E desenho baixo. Muita arte do Habbo
      // declara altura zero mesmo sendo alta (sinuca, TV, bebedouro): essa é sólida.
      // Em cima de mesa nunca é "rente ao piso" (notebook, papéis).
      const plano = !altura && !(dim.z > 0.05) && desenho.canvas.height <= (dim.x + dim.y) * (MAPA_TH / 2) + 12;
      // Em cima de uma mesa (até 3×3), fica à frente dela: a mesa termina até
      // 4 ladrilhos (40 de profundidade) adiante da peça apoiada.
      const prof = plano ? 1 : Math.round((x + dim.x - 1 + y + dim.y - 1) * 10) + 4 + (altura ? 45 : 0);
      desenho.canvas.className = "mapa-obj";
      desenho.canvas.dataset.classe = classe;
      colocar(desenho.canvas, x, y, { ...desenho, oy: desenho.oy + MAPA_MOVEL_Y - altura * 32 }, prof);
      palco.append(desenho.canvas);
      const caixa = { x0: Math.floor(x), x1: Math.floor(x) + Math.max(1, Math.round(dim.x)), y0: Math.floor(y), y1: Math.floor(y) + Math.max(1, Math.round(dim.y)), altura };
      const item = { classe, x, y, dir: d0, estado, m, no: desenho.canvas, quadros: mapaQuadros(m.dados, estado), dim, altura, plano, prof, caixa, origem: origemItem };
      moveis.push(item);
      if (item.quadros > 1 && !reduzido) animados.push(item);
      if (estadosForcados.has(chaveMovel(item))) aplicarEstado(item, estadosForcados.get(chaveMovel(item)));
    } catch (e) {
      console.warn(e.message);
    }
  };
  let grade = null, selecionado = null;
  // Profundidade de paredes e móveis (os tapetes ficam rente ao piso, embaixo).
  const ordenar = () => {
    mapaOrdenar([...muros, ...moveis.filter((m) => !m.plano)]);
    for (const m of muros) m.prof = Number(m.no.style.zIndex);
  };
  // Depois de ordenar, quem já estava no mapa ganha a profundidade nova (sem
  // isso, quem chegou antes dos móveis carregarem ficava atrás das paredes).
  const prontos = Promise.all(P.moveis.map(montar)).then(() => { ordenar(); grade = mapaMontarGrade(P, moveis); for (const p of pessoas.values()) posicionarPessoa(p); });
  // Editor: troca toda a mobília (os modelos já carregados vêm do cache).
  async function definirMoveis(lista) {
    for (const item of moveis) item.no.remove();
    moveis.length = 0;
    animados.length = 0;
    await Promise.all(lista.map(montar));
    ordenar();
    grade = mapaMontarGrade(P, moveis);
    for (const p of pessoas.values()) posicionarPessoa(p);
    destacar(selecionado);
  }
  // Móveis que ocupam o ladrilho, do mais à frente para o mais atrás.
  function moveisEm(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    return moveis.filter((m) => tx >= Math.floor(m.x) && tx < Math.floor(m.x) + m.dim.x && ty >= Math.floor(m.y) && ty < Math.floor(m.y) + m.dim.y)
      .sort((a, b) => b.prof - a.prof);
  }
  function destacar(origem) {
    selecionado = origem;
    for (const m of moveis) m.no.classList.toggle("mapa-selecionado", Boolean(origem) && m.origem?.camada === origem.camada && m.origem?.i === origem.i);
  }
  // Medidas no chão de um móvel numa direção (carrega o modelo se precisar).
  // Prévia do editor: o móvel meio transparente no ladrilho do mouse (verde
  // se cabe, vermelho se não). null tira a prévia.
  let previaNo = null, previaChave = "";
  async function previa(classe, x, y, dir, cabe = true) {
    const chave = classe ? `${classe}|${x}|${y}|${dir}|${cabe}` : "";
    if (chave === previaChave) return;
    previaChave = chave;
    if (!classe) { previaNo?.remove(); previaNo = null; return; }
    try {
      const m = await mapaCarregarMovel(classe);
      if (previaChave !== chave) return;
      const d0 = mapaDirecaoValida(m.dados, dir);
      const desenho = mapaDesenharMovel(m, d0, 0, 0);
      if (!desenho) return;
      previaNo?.remove();
      previaNo = desenho.canvas;
      previaNo.className = "mapa-obj mapa-previa" + (cabe ? "" : " nao-cabe");
      colocar(previaNo, x, y, { ...desenho, oy: desenho.oy + MAPA_MOVEL_Y }, 99990);
      palco.append(previaNo);
    } catch {}
  }
  async function medidas(classe, dir) {
    const m = await mapaCarregarMovel(classe);
    const d = mapaDirecaoValida(m.dados, dir);
    return { ...mapaDimensoes(m.dados, d), dir: d, direcoes: Object.keys(m.dados.visualizations.find((v) => v.size === 64)?.directions || { 0: 1 }).map(Number) };
  }

  // Rótulos dos ambientes
  for (const a of P.ambientes) {
    // Sala individual: letreiro na porta (a faixa que fica sempre livre), sem
    // cobrir os móveis do fundo; espaços comuns: no centro.
    const t = a.pessoal ? mapaTela((a.x0 + a.x1) / 2, a.porta === "baixo" ? a.y1 - 0.4 : a.y0 + 0.4, origem) : mapaTela((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, origem);
    const r = document.createElement("span");
    // Sala individual: letreiro em neon (cor da sala) no fundo dela.
    r.className = "mapa-rotulo" + (a.pessoal ? " neon" : "");
    if (a.pessoal && a.cor) r.style.setProperty("--neon", a.cor);
    r.dataset.ambiente = a.id;
    r.textContent = a.nome;
    r.style.left = t.x + "px"; r.style.top = t.y + "px";
    palco.append(r);
  }

  // Personagens
  const pessoas = new Map(); // id → {no, img, x, y, dir, acao, figura}
  // Bonecos no mesmo vão de profundidade: o mais ao fundo primeiro (o de trás
  // nunca cobre o da frente). Antes um resto de divisão embaralhava a ordem.
  const ordenarPessoas = () => {
    const vaos = new Map();
    for (const q of pessoas.values()) {
      if (!q.vao) continue;
      const k = q.vao[0];
      if (!vaos.has(k)) vaos.set(k, []);
      vaos.get(k).push(q);
    }
    for (const lista of vaos.values()) {
      lista.sort((a, b) => a.frente - b.frente);
      const [ini, fim] = lista[0].vao, passo = Math.max(1, Math.floor((Math.max(ini, fim) - ini + 1) / Math.max(1, lista.length)));
      lista.forEach((q, i) => { q.no.style.zIndex = Math.min(Math.max(ini, fim), ini + i * passo); });
    }
  };
  const posicionarPessoa = (p) => {
    const t = mapaTela(p.x, p.y, origem);
    p.no.style.left = t.x + "px";
    p.no.style.top = t.y + MAPA_TH / 2 + "px";
    // Sentado, fica à frente do assento (sofá longo tem profundidade maior).
    const sobre = p.acao === "sit" && grade ? grade.profAssento.get(grade.ind(Math.round(p.x), Math.round(p.y))) : undefined;
    // Ladrilho em que está (o arredondado) e a regra das caixas isométricas:
    // à frente de um móvel se passou do lado de baixo ou da direita dele;
    // atrás se está antes dele. Assim sofá e mesa compridos não cobrem quem
    // está do lado (a profundidade do móvel é a do canto mais à frente).
    // Mesma regra das caixas, só com o que cruza o desenho do boneco. Fica
    // logo à frente do mais alto que está atrás dele, e atrás do resto.
    const rx = Math.round(p.x), ry = Math.round(p.y);
    const pe = t.y + MAPA_TH / 2 + 8, l = t.x - 22, r = t.x + 22, topo = pe - 104;
    const eu = { x0: rx, x1: rx + 1, y0: ry, y1: ry + 1 };
    let min = Infinity, max = 0;
    for (const m of sobre === undefined ? [...moveis, ...muros] : []) {
      if (m.plano || !m.caixa) continue;
      if (Math.abs(m.caixa.x0 - rx) > 6 || Math.abs(m.caixa.y0 - ry) > 6) continue;
      const ml = parseFloat(m.no.style.left), mt = parseFloat(m.no.style.top);
      if (ml > r || ml + m.no.width < l || mt > pe || mt + m.no.height < topo) continue;
      // Na diagonal (separado num eixo para cada lado) não há quem tape quem: não conta.
      if (mapaDiagonal(m.caixa, eu)) continue;
      // Em cima do móvel (esteira, bicicleta): o boneco fica à frente dele.
      const dentro = rx >= m.caixa.x0 && rx < m.caixa.x1 && ry >= m.caixa.y0 && ry < m.caixa.y1;
      if (dentro || mapaAtras(m.caixa, eu)) max = Math.max(max, m.prof); else min = Math.min(min, m.prof);
    }
    // Entre os móveis o boneco vai para o vão (max, min). A ordem entre bonecos
    // no mesmo vão é feita depois, por quem está mais à frente (x+y).
    p.vao = sobre !== undefined ? [sobre + 1, sobre + 9] : [max + 1, min < Infinity ? Math.max(max + 1, min - 1) : max + 9];
    p.frente = p.x + p.y;
    ordenarPessoas();
    const z = Number(p.no.style.zIndex);
    // Área do boneco (de pé, ~100 px acima dos pés) para recortar paredes.
    recortar(p.id, t.x - 20, pe - 100, t.x + 20, pe, z);
  };
  const trocarImagem = (p) => {
    const quadro = p.acao === "wlk" ? Math.floor(performance.now() / MAPA_QUADRO_PASSO) % 4 : 0;
    const url = mapaAvatarUrl(p.figura, p.dir, p.acao, p.mao, quadro);
    if (p.img.dataset.url === url) return;
    p.img.dataset.url = url;
    const aplicar = () => { if (p.img.dataset.url === url) { delete p.img.dataset.reserva; p.img.src = url; } };
    // Primeira imagem (ou quadro que falhou) entra direto; as outras esperam
    // estar baixadas para trocar, e os 4 passos da direção já vão sendo pedidos.
    if (!p.img.getAttribute("src") || mapaBonecoPronto(url, aplicar)) aplicar();
    if (p.acao === "wlk") for (let i = 0; i < 4; i++) mapaBonecoPronto(mapaAvatarUrl(p.figura, p.dir, "wlk", p.mao, i), () => {});
  };
  const caminhar = (p, alvo) => {
    cancelAnimationFrame(p.passo);
    clearTimeout(p.parar);
    const de = { x: p.x, y: p.y }, dist = Math.hypot(alvo.x - de.x, alvo.y - de.y);
    if (dist < 0.05) { p.acao = alvo.acao || "std"; if (alvo.dir != null) p.dir = alvo.dir; trocarImagem(p); posicionarPessoa(p); return; }
    p.dir = mapaDirecaoDoPasso(alvo.x - de.x, alvo.y - de.y);
    p.acao = "wlk"; trocarImagem(p);
    // Passos curtos (vindos da presença a cada 150 ms) emendam sem trancos.
    const dur = Math.min(4000, dist < 1.5 ? 150 : dist * 172), ini = performance.now();
    const passo = (agora) => {
      const k = Math.min(1, (agora - ini) / dur);
      p.x = de.x + (alvo.x - de.x) * k; p.y = de.y + (alvo.y - de.y) * k;
      trocarImagem(p); posicionarPessoa(p);
      if (k < 1) p.passo = requestAnimationFrame(passo);
      else {
        // Entre um passo e outro o boneco continua andando; só para (ou senta)
        // se não chegar outro passo logo em seguida.
        const fim = () => { p.acao = alvo.acao || "std"; if (alvo.dir != null) p.dir = alvo.dir; trocarImagem(p); posicionarPessoa(p); };
        if ((alvo.acao || "std") === "wlk") return;
        p.parar = setTimeout(fim, 140);
      }
    };
    p.passo = requestAnimationFrame(passo);
  };
  function atualizarPessoas(lista) {
    const vistos = new Set();
    for (const q of lista) {
      vistos.add(q.id);
      let p = pessoas.get(q.id);
      const figura = mapaFigura(q.perfil);
      if (!p) {
        const no = document.createElement("button");
        no.type = "button";
        no.className = "mapa-pessoa" + (q.id === eu ? " voce" : "");
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        img.referrerPolicy = "no-referrer";
        // Sem o imager do Habbo, a cópia guardada no nosso banco (em pé).
        img.onerror = () => { if (!img.dataset.reserva) { img.dataset.reserva = "1"; img.src = mapaBonecoGuardado(p.figura, p.dir); } };
        const etiqueta = document.createElement("span");
        etiqueta.className = "mapa-etiqueta";
        no.append(etiqueta, img);
        no.addEventListener("click", (e) => { e.stopPropagation(); q.aoClicar?.(q.id); });
        palco.append(no);
        p = { id: q.id, no, img, etiqueta, x: q.x, y: q.y, dir: q.dir ?? 2, acao: q.acao || "std", figura };
        pessoas.set(q.id, p);
        posicionarPessoa(p);
        trocarImagem(p);
        // O próprio boneco: os passos das 8 direções já ficam baixados.
        if (q.id === eu) for (let d = 0; d < 8; d++) for (let i = 0; i < 4; i++) mapaBonecoPronto(mapaAvatarUrl(figura, d, "wlk", q.mao || "", i), () => {});
      }
      p.figura = figura;
      p.mao = q.mao || "";
      // Status escrito quando não está disponível; em foco ou ausente, o
      // boneco fica meio transparente (não é hora de chamar).
      p.etiqueta.innerHTML = `<i class="ofc-ponto" style="--st:${q.corStatus}"></i><b></b>${q.statusTexto ? "<small></small>" : ""}`;
      // Selo de status sobre a cabeça, visível de longe (foco: fone; reunião: balão).
      let selo = p.no.querySelector(".mapa-selo");
      const icone = MAPA_SELOS[q.status];
      if (!icone) selo?.remove();
      else {
        if (!selo) { selo = document.createElement("span"); selo.className = "mapa-selo"; selo.setAttribute("aria-hidden", "true"); p.no.append(selo); }
        if (selo.dataset.status !== q.status) { selo.dataset.status = q.status; selo.innerHTML = icone; }
      }
      p.etiqueta.querySelector("b").textContent = q.nome;
      if (q.statusTexto) p.etiqueta.querySelector("small").textContent = q.statusTexto;
      p.no.classList.toggle("distante", q.status === "foco" || q.status === "ausente");
      p.no.setAttribute("aria-label", q.rotulo || q.nome);
      p.no.dataset.status = q.status || "";
      // O próprio boneco, enquanto este navegador o guia, não é puxado pela
      // posição (atrasada) que volta do servidor.
      if (q.local && performance.now() - (p.guiado || 0) < 400) { trocarImagem(p); continue; }
      if (Math.abs(p.x - q.x) > 0.01 || Math.abs(p.y - q.y) > 0.01 || p.acao !== (q.acao || "std")) caminhar(p, q);
      else trocarImagem(p);
    }
    for (const [id, p] of pessoas) if (!vistos.has(id)) { cancelAnimationFrame(p.passo); p.no.remove(); pessoas.delete(id); recortar(id, 0, 0, 0, 0, Infinity); }
  }

  // Câmera suave: um alvo (posição e zoom) e um único quadro de animação que
  // aproxima a câmera dele com amortecimento exponencial (independe da taxa de
  // quadros). Roda do mouse e pinça do trackpad dão zoom contínuo no ponto do
  // cursor; arrastar segue o dedo na hora e solta com inércia; acompanhar a
  // pessoa só muda o alvo. Sem movimento de sobra, o laço para.
  let zoom = 1, cam = { x: 0, y: 0 };
  const alvo = { x: 0, y: 0, z: 1 };
  let inercia = null, quadroCam = null, ultimoCam = 0, seguindo = true;
  const reduzMov = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Sem will-change/translate3d: o palco tem ~4500×2400 px e virar uma camada
  // de GPU inteira deixava trechos pretos e bonecos sumindo em placas fracas.
  // Letreiros com tamanho mínimo na tela: abaixo de ~0,9 de zoom crescem
  // na mesma proporção em que o mapa diminui.
  const aplicar = () => {
    palco.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${zoom})`;
    palco.style.setProperty("--contra", Math.max(1, 0.9 / zoom).toFixed(3));
  };
  const animarCam = (agora) => {
    quadroCam = null;
    const dt = Math.min(64, agora - (ultimoCam || agora - 16)); ultimoCam = agora;
    if (inercia) {
      alvo.x += inercia.vx * dt; alvo.y += inercia.vy * dt;
      const atrito = Math.exp(-dt / 220);
      inercia.vx *= atrito; inercia.vy *= atrito;
      if (Math.hypot(inercia.vx, inercia.vy) < 0.02) inercia = null;
    }
    const k = reduzMov ? 1 : 1 - Math.exp(-dt / 85);
    zoom += (alvo.z - zoom) * k;
    cam.x += (alvo.x - cam.x) * k; cam.y += (alvo.y - cam.y) * k;
    const parado = !inercia && Math.abs(alvo.z - zoom) < 0.0005 && Math.hypot(alvo.x - cam.x, alvo.y - cam.y) < 0.3;
    if (parado) { zoom = alvo.z; cam.x = alvo.x; cam.y = alvo.y; }
    aplicar();
    if (!parado) quadroCam = requestAnimationFrame(animarCam);
    else ultimoCam = 0;
  };
  const mexerCam = () => { if (!quadroCam) quadroCam = requestAnimationFrame(animarCam); };
  function centralizar(x, y) {
    const t = mapaTela(x, y, origem), r = el.getBoundingClientRect();
    alvo.x = cam.x = r.width / 2 - t.x * alvo.z; alvo.y = cam.y = r.height / 2 - t.y * alvo.z;
    zoom = alvo.z; inercia = null;
    aplicar();
  }
  // Zoom em volta de um ponto da tela (o cursor; sem ponto, o centro).
  function mudarZoom(fator, cx, cy) {
    const r = el.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const novo = Math.max(0.35, Math.min(2.2, alvo.z * fator));
    alvo.x = cx - ((cx - alvo.x) / alvo.z) * novo; alvo.y = cy - ((cy - alvo.y) / alvo.z) * novo;
    alvo.z = novo;
    mexerCam();
  }
  let arrasto = null;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    inercia = null;
    // Pega a câmera de onde ela está agora (mesmo no meio de uma animação).
    alvo.x = cam.x; alvo.y = cam.y; alvo.z = zoom;
    arrasto = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moveu: false, ult: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!arrasto) {
      // Mouse passando (sem arrastar): avisa o ladrilho, para o cartão da mesa.
      if (aoPassar && e.pointerType !== "touch") {
        const r = palco.getBoundingClientRect();
        const t = mapaLadrilho((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, origem);
        aoPassar(Math.floor(t.x), Math.floor(t.y), e.clientX, e.clientY);
      }
      return;
    }
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (Math.hypot(dx, dy) > 4) arrasto.moveu = true;
    if (!arrasto.moveu) return;
    seguindo = false;
    alvo.x = cam.x = arrasto.cx + dx; alvo.y = cam.y = arrasto.cy + dy;
    aplicar();
    const agora = performance.now();
    arrasto.ult.push({ t: agora, x: e.clientX, y: e.clientY });
    while (arrasto.ult.length > 2 && agora - arrasto.ult[0].t > 90) arrasto.ult.shift();
  });
  el.addEventListener("pointerup", (e) => {
    const a = arrasto; arrasto = null;
    if (!a) return;
    if (a.moveu) {
      // Solta com a velocidade dos últimos ~90 ms e desliza até parar.
      const p0 = a.ult[0], p1 = a.ult[a.ult.length - 1], dt = Math.max(1, p1.t - p0.t);
      if (!reduzMov && performance.now() - p1.t < 60) { inercia = { vx: (p1.x - p0.x) / dt, vy: (p1.y - p0.y) / dt }; mexerCam(); }
      return;
    }
    const r = palco.getBoundingClientRect();
    const t = mapaLadrilho((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, origem);
    if (t.x >= 0 && t.y >= 0 && t.x < P.W && t.y < P.H) aoClicar?.(t.x, t.y);
  });
  el.addEventListener("pointerleave", () => aoPassar?.(-1, -1));
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect();
    // Trackpad manda passos pequenos (e ctrl na pinça); roda, passos grandes.
    const passo = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const fator = Math.exp(-Math.max(-60, Math.min(60, passo)) * (e.ctrlKey ? 0.012 : 0.0022));
    mudarZoom(fator, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  // Leva a câmera, suave, até um ponto com outro zoom (atalhos de área).
  function olhar(x, y, z) {
    const r = el.getBoundingClientRect(), t = mapaTela(x, y, origem);
    alvo.z = Math.max(0.35, Math.min(2.2, z || alvo.z));
    alvo.x = r.width / 2 - t.x * alvo.z; alvo.y = r.height / 2 - t.y * alvo.z;
    seguindo = false; inercia = null;
    mexerCam();
  }
  // Câmera que acompanha a pessoa: só muda o alvo; arrastar o mapa solta,
  // voltar a andar prende de novo.
  function seguir(x, y, retomar) {
    if (retomar) seguindo = true;
    if (!seguindo) return;
    const t = mapaTela(x, y, origem), r = el.getBoundingClientRect();
    alvo.x = r.width / 2 - t.x * alvo.z; alvo.y = r.height / 2 - t.y * alvo.z;
    inercia = null;
    mexerCam();
  }
  // Móveis a até `raio` ladrilhos da posição (pela borda do móvel).
  function moveisPerto(x, y, raio) {
    // Pela caixa no piso (móvel fino, como telão de 0,2 ladrilho, ocupa 1).
    return moveis.filter((m) => {
      const w = Math.max(1, Math.round(m.dim.x)), h = Math.max(1, Math.round(m.dim.y));
      const dx = Math.max(Math.floor(m.x) - x, 0, x - (Math.floor(m.x) + w - 1));
      const dy = Math.max(Math.floor(m.y) - y, 0, y - (Math.floor(m.y) + h - 1));
      return Math.max(dx, dy) <= raio;
    });
  }
  let realcado = null;
  function realcar(item) {
    if (realcado === item) return;
    realcado?.no.classList.remove("mapa-interativo");
    realcado = item;
    item?.no.classList.add("mapa-interativo");
  }
  function posicoes() { return [...pessoas].map(([id, p]) => ({ id, x: p.x, y: p.y })); }
  // Balão de fala sobre a cabeça (some sozinho).
  function balao(id, texto) {
    const p = pessoas.get(String(id));
    if (!p) return;
    p.no.querySelector(".mapa-balao")?.remove();
    const b = document.createElement("span");
    b.className = "mapa-balao";
    b.textContent = texto;
    p.no.append(b);
    setTimeout(() => b.remove(), Math.min(9000, 3500 + texto.length * 60));
  }
  // Reação rápida: sobe e some acima do boneco.
  const REACAO = { aplauso: "👏", coracao: "❤️", risada: "😂", joinha: "👍", fogo: "🔥", festa: "🎉" };
  function reagir(id, tipo) {
    const p = pessoas.get(id);
    if (!p || !REACAO[tipo]) return;
    const r = document.createElement("span");
    r.className = "mapa-reacao";
    r.textContent = REACAO[tipo];
    r.style.left = 20 + Math.random() * 24 + "px";
    p.no.append(r);
    setTimeout(() => r.remove(), 2400);
  }
  // Vídeo da pessoa numa bolha acima do boneco (null tira).
  // Móvel com aviso (o computador da mesa quando há avisos novos): brilha.
  function marcarAviso(x, y, ligado) {
    for (const m of moveis) m.no.classList.remove("mapa-aviso");
    if (!ligado) return;
    const alvo = moveis.find((m) => /computer|flatscreen/.test(m.classe) && Math.floor(m.x) === x && Math.floor(m.y) === y)
      || moveisPerto(x, y, 1).find((m) => /computer|flatscreen/.test(m.classe));
    alvo?.no.classList.add("mapa-aviso");
  }
  // Quem está falando na conversa ganha um anel verde nos pés.
  // e o nome dele acende em verde com ondas piscando.
  function marcarFalando(id, falando) {
    const p = pessoas.get(String(id));
    if (!p) return;
    p.no.classList.toggle("falando", Boolean(falando));
    if (falando && !p.etiqueta.querySelector(".mapa-fala")) {
      const f = document.createElement("span");
      f.className = "mapa-fala";
      f.setAttribute("aria-hidden", "true");
      f.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>';
      p.etiqueta.append(f);
    }
  }
  function anexarVideo(id, stream) {
    const p = pessoas.get(id);
    if (!p) return;
    let v = p.no.querySelector(".mapa-video");
    if (!stream) { v?.remove(); return; }
    if (!v) {
      v = document.createElement("video");
      v.className = "mapa-video"; v.autoplay = true; v.muted = true; v.playsInline = true;
      p.no.append(v);
    }
    if (v.srcObject?.getVideoTracks?.()[0] !== stream.getVideoTracks()[0]) v.srcObject = stream;
  }
  function idsNoMapa() { return [...pessoas.keys()]; }
  // Salas trancadas: cadeado no nome da sala.
  function marcarTrancas(zonas) {
    for (const r of palco.querySelectorAll(".mapa-rotulo")) r.classList.toggle("trancada", zonas.has(r.dataset.ambiente));
  }

  // Posiciona direto (movimento contínuo guiado por este navegador).
  function mover(id, x, y, dir, acao) {
    const p = pessoas.get(id);
    if (!p) return;
    cancelAnimationFrame(p.passo); clearTimeout(p.parar);
    p.guiado = performance.now();
    p.x = x; p.y = y; p.dir = dir; p.acao = acao;
    trocarImagem(p); posicionarPessoa(p);
  }

  // Animação dos móveis: 8 quadros/s, só com o mapa visível na tela.
  let quadro = 0, relogio = null;
  const animar = () => {
    if (document.hidden || !el.isConnected || !el.offsetParent) return;
    quadro++;
    // Quem está andando troca o quadro do passo mesmo entre um passo e outro.
    for (const p of pessoas.values()) if (p.acao === "wlk") trocarImagem(p);
    for (const item of animados) {
      const d = mapaDesenharMovel(item.m, item.dir, item.estado, quadro);
      if (!d) continue;
      const g = item.no.getContext("2d");
      if (item.no.width !== d.canvas.width || item.no.height !== d.canvas.height) { item.no.width = d.canvas.width; item.no.height = d.canvas.height; }
      else g.clearRect(0, 0, item.no.width, item.no.height);
      g.drawImage(d.canvas, 0, 0);
    }
  };
  prontos.then(() => { relogio = setInterval(animar, 125); });

  return {
    origem, prontos, atualizarPessoas, centralizar, mudarZoom, definirMoveis, moveisEm, destacar, medidas, mover, seguir, marcarZona,
    balao, reagir, anexarVideo, marcarFalando, marcarAviso, previa, olhar, idsNoMapa, marcarTrancas, moveisPerto, realcar, posicoes, estadosMoveis, chaveMovel,
    caminho: (de, para) => (grade ? mapaCaminho(grade, de, para) : null),
    podePassar: (x, y, dx, dy) => Boolean(grade) && mapaPassa(grade, x, y, dx, dy),
    assentoEm: (x, y) => (grade ? grade.assento.get(grade.ind(Math.round(x), Math.round(y))) : undefined),
    tela: (x, y) => mapaTela(x, y, origem),
    destruir() { clearInterval(relogio); clearInterval(relogioCeu); if (quadroCam) cancelAnimationFrame(quadroCam); for (const p of pessoas.values()) cancelAnimationFrame(p.passo); el.replaceChildren(); },
  };
}
