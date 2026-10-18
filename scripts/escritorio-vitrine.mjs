// Vitrine para conferir a frente das peças vendo a arte (18/10/2026).
// 1. node scripts/escritorio-vitrine.mjs [classe ...]
//    (sem classes: todas as usadas nas cenas compostas). Grava a lista com a
//    frente que o motor calcula em assets/escritorio/habbo/_vitrine.json
//    (ignorado pelo git; apague depois).
// 2. npm run dev, abra o painel e cole no console o trecho que este script
//    imprime: cada peça aparece em cada direção, com o ladrilho que ocupa e
//    uma seta vermelha no chão para onde o motor acha que fica a frente.
// 3. Onde a seta não bate com a arte, anote o mapa certo em
//    assets/escritorio/habbo/frentes.json; onde bate, "regra". O motor recusa
//    usar a frente de peça que não está lá.
import { readFileSync, writeFileSync } from "node:fs";
import { peca, frente } from "./escritorio-construcao.mjs";

let classes = process.argv.slice(2);
if (!classes.length) {
  const t = readFileSync("vybe-escritorio-planta.js", "utf8");
  const bloco = t.slice(t.indexOf("// <cenas-compostas>"), t.indexOf("// </cenas-compostas>"));
  classes = [...new Set([...bloco.matchAll(/\["([a-z0-9_]+)",/g)].map((m) => m[1]))];
}
const lista = {};
for (const c of classes) {
  const p = peca(c);
  if (p.parede || p.plana || p.revestimento) continue;
  lista[c] = { dirs: p.dirs, d: [p.d.x, p.d.y], frentes: Object.fromEntries(p.dirs.map((d) => [d, frente(p, d)])) };
}
writeFileSync("assets/escritorio/habbo/_vitrine.json", JSON.stringify(lista));
console.log(`${Object.keys(lista).length} peças. Cole no console do painel (página de 14 em 14: vitrine(0), vitrine(14), ...):\n`);
console.log(`window.vitrine = async (de = 0, n = 14) => {
  const lista = await (await fetch(mapaArquivo("_vitrine.json"))).json();
  const nomes = Object.keys(lista).slice(de, de + n);
  document.getElementById("vitrine")?.remove();
  const W = innerWidth, cols = 6, CW = W / cols, CH = 175, s = 0.75;
  const linhas = []; for (const k of nomes) linhas.push(...lista[k].dirs.map((d) => [k, d]));
  const cv = document.createElement("canvas"); cv.id = "vitrine"; cv.width = W; cv.height = Math.max(innerHeight, Math.ceil(linhas.length / cols) * CH + 10);
  Object.assign(cv.style, { position: "fixed", left: "0", top: "0", zIndex: 999999 });
  cv.onclick = () => cv.remove();
  const g = cv.getContext("2d"); g.fillStyle = "#2a2a2e"; g.fillRect(0, 0, cv.width, cv.height);
  for (let k = 0; k < linhas.length; k++) {
    const [c, d] = linhas[k], L = lista[c], col = k % cols, lin = Math.floor(k / cols);
    const cx = col * CW + CW / 2, cy = lin * CH + 105;
    const [pw, ph] = d === 2 || d === 6 ? [Math.max(1, L.d[1] | 0), Math.max(1, L.d[0] | 0)] : [Math.max(1, L.d[0] | 0), Math.max(1, L.d[1] | 0)];
    const tela = (x, y) => [cx + (x - y) * 32 * s, cy + (x + y) * 16 * s];
    g.strokeStyle = "#666"; g.fillStyle = "#3a3a40";
    for (let x = 0; x < pw; x++) for (let y = 0; y < ph; y++) { const [a, b] = tela(x, y); g.beginPath(); g.moveTo(a, b); g.lineTo(a + 32 * s, b + 16 * s); g.lineTo(a, b + 32 * s); g.lineTo(a - 32 * s, b + 16 * s); g.closePath(); g.fill(); g.stroke(); }
    try { const r = mapaDesenharMovel(await mapaCarregarMovel(c), d, 0, 0); if (r) g.drawImage(r.canvas, cx + r.ox * s, cy + r.oy * s, r.canvas.width * s, r.canvas.height * s); } catch {}
    const f = L.frentes[d];
    if (f) { const [a, b] = tela(pw / 2, ph / 2); g.strokeStyle = g.fillStyle = "#ff3b30"; g.lineWidth = 3; g.beginPath(); g.moveTo(a, b); const ex = a + (f[0] - f[1]) * 45 * s, ey = b + (f[0] + f[1]) * 22 * s; g.lineTo(ex, ey); g.stroke(); g.beginPath(); g.arc(ex, ey, 4, 0, 7); g.fill(); g.lineWidth = 1; }
    g.fillStyle = "#fff"; g.font = "10px sans-serif"; g.fillText(k + ". " + c.slice(0, 20) + " d" + d, col * CW + 3, lin * CH + 170);
  }
  document.body.appendChild(cv); return linhas.length;
};
await vitrine(0);`);
