// Economia de energia (Paulo, 26/10/2026: "meu Mac ainda esquenta com o sistema
// aberto muito tempo"). O painel fica aberto o dia todo e qualquer animação
// infinita na tela (há dezenas no CSS) mantém o navegador redesenhando sem
// parar. Depois de um tempo sem mexer no mouse, no teclado ou no toque, as
// animações CSS pausam (html.vb-ocioso) e o mapa do Escritório anima em ritmo
// baixo; o primeiro movimento devolve tudo. Voz e vídeo não dependem disto.
const VB_OCIOSO_MS = 30000;
let vbOciosoTimer = null;
function vbOcioso() { return document.documentElement.classList.contains("vb-ocioso"); }
// Só as animações infinitas pausam (são elas que mantêm o navegador redesenhando). Entradas e saídas terminam: antes a
// pausa era de tudo (CSS) e o que entrava com a pessoa parada congelava no primeiro quadro, transparente (08/11/2026).
const vbPausadas = new Set();
let vbVarredura = null;
function vbPausarLacos() {
  if (typeof document.getAnimations !== "function") return;
  for (const a of document.getAnimations()) {
    try { if (a.playState === "running" && a.effect?.getTiming?.().iterations === Infinity) { a.pause(); vbPausadas.add(a); } } catch { /* animação já removida */ }
  }
}
function vbAcordar() {
  if (vbOcioso()) {
    document.documentElement.classList.remove("vb-ocioso");
    clearInterval(vbVarredura); vbVarredura = null;
    for (const a of vbPausadas) { try { a.play(); } catch { /* elemento saiu da tela */ } }
    vbPausadas.clear();
  }
  clearTimeout(vbOciosoTimer);
  vbOciosoTimer = setTimeout(() => {
    document.documentElement.classList.add("vb-ocioso");
    vbPausarLacos(); vbVarredura = setInterval(vbPausarLacos, 5000); // laços que começarem depois também param
  }, VB_OCIOSO_MS);
}
if (typeof window !== "undefined" && typeof document?.addEventListener === "function") {
  let ultimo = 0;
  const mexeu = () => { const agora = Date.now(); if (agora - ultimo < 250 && !vbOcioso()) return; ultimo = agora; vbAcordar(); };
  for (const tipo of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) window.addEventListener(tipo, mexeu, { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) vbAcordar(); });
  vbAcordar();
}
