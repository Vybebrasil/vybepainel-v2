// vybe-escritorio-animadas.js — roupas que mexem (Paulo, 21/10/2026: "só se
// algum objeto, acessório tiver [animação], como o darkaura"). O imager do
// Habbo desenha cada peça parada; para as peças do acervo que têm quadros
// (roupas_animadas.json, gerado por scripts/escritorio-roupas-animadas.mjs), o
// boneco vem do imager SEM a peça e uma tela por cima desenha os quadros, com a
// cor escolhida. Postura em pé, acenando ou andando; sentado e deitado ficam
// com a peça parada do imager. "Reduzir movimento" mostra só o primeiro quadro.
const ANIMADAS = { dados: null, cores: null, promessa: null, folhas: new Map(), tingidas: new Map(), telas: new Set(), relogio: 0 };
const ANIMADAS_POSTURAS = new Set(["std", "wav", "wlk", "spk"]);
// Direções 4, 5 e 6 são o espelho de 2, 1 e 0 (como no Habbo).
const ANIMADAS_ESPELHO = { 4: 2, 5: 1, 6: 0 };
// Origem do desenho no boneco "h" (64×110): conferida pixel a pixel contra o
// imager. Cada camada traz as direções em que vai atrás do boneco ("a").
const ANIMADAS_ORIGEM_Y = 100;
// Margem da tela em volta do boneco (64×110): efeitos grandes (guarda-chuva
// com nuvem, auras) passam do quadro do boneco e eram cortados na borda. A
// margem sai dos quadros das peças vestidas, em todas as direções (com espelho).
function animadasMargem(info) {
  const m = { x: 0, cima: 0, baixo: 0 };
  for (const a of info.achadas) for (const c of ANIMADAS.dados[a.chave].camadas) for (const qs of Object.values(c.d)) for (const [, , w, h, ax, ay] of qs) {
    const topo = ANIMADAS_ORIGEM_Y - ay;
    m.x = Math.max(m.x, ax, ax + w - 64, w - 64 - ax, -ax + w - 64);
    m.cima = Math.max(m.cima, -topo); m.baixo = Math.max(m.baixo, topo + h - 110);
  }
  return { x: Math.ceil(m.x + 2), cima: Math.ceil(m.cima + 2), baixo: Math.ceil(m.baixo + 2) };
}

function animadasCarregar() {
  if (ANIMADAS.promessa) return ANIMADAS.promessa;
  ANIMADAS.promessa = (async () => {
    try {
      const [d, f] = await Promise.all([
        fetch(mapaArquivo("roupas_animadas.json"), { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : {})),
        fetch(mapaArquivo("figuras.json"), { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      ANIMADAS.dados = d || {};
      ANIMADAS.cores = f;
    } catch { ANIMADAS.dados = {}; }
    return ANIMADAS.dados;
  })();
  return ANIMADAS.promessa;
}
// Peça com partes paradas (mão segurando o guarda-chuva, braço): o imager do
// Habbo desenha a peça inteira, com a mão certa e na ordem certa em volta do
// corpo, e a tela só anima as camadas que têm mais de um quadro (Paulo,
// 21/10/2026: "o guarda-chuva parecia na frente e atrás, a mão levantada e
// abaixada"). Peça toda animada (aura, bichinho) sai do imager e a tela desenha tudo.
// Só para peças que trocam a mão ou o braço (mcl/mcr): nas outras o quadro
// parado do imager ficaria embaixo do animado (o gatinho do chapéu em dobro).
function animadasParcial(chave) {
  const camadas = ANIMADAS.dados[chave].camadas;
  return camadas.some((c) => ["mcl", "mcr"].includes(c.p)) && camadas.some((c) => Object.values(c.d).some((q) => q.length <= 1));
}
// "mc-6562-1408" → partes animadas da figura e a figura que o imager desenha.
function animadasDaFigura(figura) {
  const d = ANIMADAS.dados;
  if (!d || !figura) return null;
  const partes = String(figura).split("."), achadas = [];
  for (const p of partes) { const [t, id, ...cores] = p.split("-"); if (d[`${t}-${id}`]) achadas.push({ chave: `${t}-${id}`, tipo: t, cores: cores.map(Number), parcial: animadasParcial(`${t}-${id}`) }); }
  if (!achadas.length) return null;
  const inteiras = new Set(achadas.filter((a) => !a.parcial).map((a) => a.chave));
  return { base: partes.filter((p) => !inteiras.has(p.split("-").slice(0, 2).join("-"))).join("."), achadas };
}
function animadasHex(tipo, corId) {
  const c = ANIMADAS.cores;
  const pal = c?.tipos?.[tipo]?.p !== undefined ? c.pal?.[c.tipos[tipo].p] : null;
  const hex = (pal || []).find((x) => x[0] === corId)?.[1];
  return hex ? "#" + hex : null;
}
function animadasFolha(nome) {
  let img = ANIMADAS.folhas.get(nome);
  if (!img) { img = new Image(); img.src = mapaArquivo(nome); ANIMADAS.folhas.set(nome, img); }
  return img.complete && img.naturalWidth ? img : null;
}
// Folha pintada na cor (multiplica, como o Habbo pinta as peças coloríveis).
function animadasTingida(nome, hex) {
  const chave = nome + hex;
  if (ANIMADAS.tingidas.has(chave)) return ANIMADAS.tingidas.get(chave);
  const img = animadasFolha(nome);
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "multiply"; g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in"; g.drawImage(img, 0, 0);
  ANIMADAS.tingidas.set(chave, c);
  return c;
}
function animadasDesenhar(tela) {
  const { info, dir, escala, atras, margem } = tela.animada, frente = tela.getContext("2d"), fundo = atras.getContext("2d");
  for (const g of [frente, fundo]) { g.clearRect(0, 0, tela.width, tela.height); g.imageSmoothingEnabled = false; }
  const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  for (const a of info.achadas) {
    const dado = ANIMADAS.dados[a.chave];
    for (const camada of dado.camadas) {
      const espelho = camada.d[dir] ? null : ANIMADAS_ESPELHO[dir];
      const quadros = camada.d[espelho ?? dir];
      // Peça parcial: a mão e o parado ficam com o imager; só o resto se mexe.
      if (!quadros || (a.parcial && (quadros.length <= 1 || ["mcl", "mcr"].includes(camada.p)))) continue;
      const q = quadros[parado ? 0 : ANIMADAS.relogio % quadros.length];
      const hex = camada.cor ? animadasHex(a.tipo, a.cores[camada.cor - 1]) : null;
      const folha = hex ? animadasTingida(dado.folha, hex) : animadasFolha(dado.folha);
      if (!folha) continue;
      const [x, y, w, h, ax, ay, giro] = q, virar = Boolean(espelho !== undefined && espelho !== null) !== Boolean(giro);
      const g = camada.a?.includes(dir) ? fundo : frente;
      const esq = virar ? 64 + ax - w : -ax, topo = ANIMADAS_ORIGEM_Y - ay;
      g.save();
      g.scale(escala, escala);
      g.translate(margem.x, margem.cima);
      if (virar) { g.translate(esq + w, topo); g.scale(-1, 1); g.drawImage(folha, x, y, w, h, 0, 0, w, h); }
      else g.drawImage(folha, x, y, w, h, esq, topo, w, h);
      g.restore();
    }
  }
}
// Um relógio só para todas as telas, 8 quadros por segundo; para sozinho
// quando não há tela ou a aba está escondida.
function animadasLaco() {
  if (ANIMADAS.timer) return;
  ANIMADAS.timer = setInterval(() => {
    for (const t of ANIMADAS.telas) if (!t.isConnected) ANIMADAS.telas.delete(t);
    if (!ANIMADAS.telas.size) { clearInterval(ANIMADAS.timer); ANIMADAS.timer = 0; return; }
    if (document.hidden) return;
    ANIMADAS.relogio++;
    for (const t of ANIMADAS.telas) if (!t.hidden) animadasDesenhar(t);
  }, 125);
}
// Põe (ou tira) a tela animada sobre a <img> do boneco. Devolve a figura que a
// <img> deve pedir ao imager (sem as peças animadas quando há tela).
function animadasSobre(img, figura, dir, { escala = 1, postura = "std" } = {}) {
  if (!ANIMADAS.dados) { animadasCarregar(); return figura; }
  let tela = img.nextElementSibling?.classList?.contains("ofc-animada") ? img.nextElementSibling : null;
  let atras = img.previousElementSibling?.classList?.contains("ofc-animada") ? img.previousElementSibling : null;
  const info = ANIMADAS_POSTURAS.has(postura) ? animadasDaFigura(figura) : null;
  if (!info) { if (tela) tela.hidden = true; if (atras) atras.hidden = true; return figura; }
  if (!tela) {
    // Duas telas: atrás da <img> (partes que passam por trás do corpo) e na frente.
    tela = document.createElement("canvas"); tela.className = "ofc-animada frente"; tela.setAttribute("aria-hidden", "true"); img.after(tela);
    atras = document.createElement("canvas"); atras.className = "ofc-animada atras"; atras.setAttribute("aria-hidden", "true"); img.before(atras);
    img.classList.add("ofc-com-animada");
  }
  // Redimensionar apaga a tela: só quando muda (o mapa chama isto a cada passo).
  const M = animadasMargem(info), larg = (64 + 2 * M.x) * escala, alt = (110 + M.cima + M.baixo) * escala;
  for (const t of [tela, atras]) if (t.width !== larg || t.height !== alt) { t.width = larg; t.height = alt; }
  tela.hidden = atras.hidden = false;
  // A tela cobre a <img> e a margem em volta (mesma escala da <img> na página).
  const encaixar = () => {
    const k = img.offsetWidth / 64;
    for (const t of [tela, atras]) { t.style.left = img.offsetLeft - M.x * k + "px"; t.style.top = img.offsetTop - M.cima * k + "px"; t.style.width = (64 + 2 * M.x) * k + "px"; t.style.height = (110 + M.cima + M.baixo) * k + "px"; }
  };
  encaixar();
  if (!img.offsetWidth) requestAnimationFrame(encaixar);
  tela.animada = { info, dir: Number(dir) || 0, escala, atras, margem: M };
  ANIMADAS.telas.add(tela);
  animadasDesenhar(tela);
  animadasLaco();
  return info.base;
}
