// Economia de energia (Paulo, 26/10/2026: "meu Mac ainda esquenta com o sistema
// aberto muito tempo"). O painel fica aberto o dia todo e qualquer animação
// infinita na tela (há dezenas no CSS) mantém o navegador redesenhando sem
// parar. Depois de um tempo sem mexer no mouse, no teclado ou no toque, as
// animações CSS pausam (html.vb-ocioso) e o mapa do Escritório anima em ritmo
// baixo; o primeiro movimento devolve tudo. Voz e vídeo não dependem disto.
const VB_OCIOSO_MS = 30000;
let vbOciosoTimer = null;
function vbOcioso() { return document.documentElement.classList.contains("vb-ocioso"); }
function vbAcordar() {
  if (vbOcioso()) document.documentElement.classList.remove("vb-ocioso");
  clearTimeout(vbOciosoTimer);
  vbOciosoTimer = setTimeout(() => document.documentElement.classList.add("vb-ocioso"), VB_OCIOSO_MS);
}
if (typeof window !== "undefined" && typeof document?.addEventListener === "function") {
  let ultimo = 0;
  const mexeu = () => { const agora = Date.now(); if (agora - ultimo < 250 && !vbOcioso()) return; ultimo = agora; vbAcordar(); };
  for (const tipo of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) window.addEventListener(tipo, mexeu, { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) vbAcordar(); });
  vbAcordar();
}
