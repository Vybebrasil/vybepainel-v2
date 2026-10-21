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
// "mc-6562-1408" → partes animadas da figura e a figura sem elas.
function animadasDaFigura(figura) {
  const d = ANIMADAS.dados;
  if (!d || !figura) return null;
  const partes = String(figura).split("."), achadas = [];
  for (const p of partes) { const [t, id, ...cores] = p.split("-"); if (d[`${t}-${id}`]) achadas.push({ chave: `${t}-${id}`, tipo: t, cores: cores.map(Number) }); }
  if (!achadas.length) return null;
  return { base: partes.filter((p) => !d[p.split("-").slice(0, 2).join("-")]).join("."), achadas };
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
  const { info, dir, escala, atras } = tela.animada, frente = tela.getContext("2d"), fundo = atras.getContext("2d");
  for (const g of [frente, fundo]) { g.clearRect(0, 0, tela.width, tela.height); g.imageSmoothingEnabled = false; }
  const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  for (const a of info.achadas) {
    const dado = ANIMADAS.dados[a.chave];
    for (const camada of dado.camadas) {
      const espelho = camada.d[dir] ? null : ANIMADAS_ESPELHO[dir];
      const quadros = camada.d[espelho ?? dir];
      if (!quadros) continue;
      const q = quadros[parado ? 0 : ANIMADAS.relogio % quadros.length];
      const hex = camada.cor ? animadasHex(a.tipo, a.cores[camada.cor - 1]) : null;
      const folha = hex ? animadasTingida(dado.folha, hex) : animadasFolha(dado.folha);
      if (!folha) continue;
      const [x, y, w, h, ax, ay, giro] = q, virar = Boolean(espelho !== undefined && espelho !== null) !== Boolean(giro);
      const g = camada.a?.includes(dir) ? fundo : frente;
      const esq = virar ? 64 + ax - w : -ax, topo = ANIMADAS_ORIGEM_Y - ay;
      g.save();
      g.scale(escala, escala);
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
  for (const t of [tela, atras]) if (t.width !== 64 * escala) { t.width = 64 * escala; t.height = 110 * escala; }
  tela.hidden = atras.hidden = false;
  // A tela cobre a <img> exatamente (mesmo lugar e tamanho na página).
  const encaixar = () => { for (const t of [tela, atras]) { t.style.left = img.offsetLeft + "px"; t.style.top = img.offsetTop + "px"; t.style.width = img.offsetWidth + "px"; t.style.height = img.offsetHeight + "px"; } };
  encaixar();
  if (!img.offsetWidth) requestAnimationFrame(encaixar);
  tela.animada = { info, dir: Number(dir) || 0, escala, atras };
  ANIMADAS.telas.add(tela);
  animadasDesenhar(tela);
  animadasLaco();
  return info.base;
}
