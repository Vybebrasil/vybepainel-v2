// Confere a planta do escritório sem abrir o navegador: móveis sobrepostos,
// móvel atravessando divisória, apoiado no vazio, assento sem acesso e porta
// bloqueada. node scripts/escritorio-auditar.mjs  (sai com erro se achar algo)
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8") + "\n;globalThis.__P = ESCRITORIO_PLANTA; globalThis.__sala = escritorioMoveisDaSala;", ctx);
const P = ctx.__P;
const arte = (c) => {
  const f = `assets/escritorio/habbo/${c}.json`;
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const v = j.visualizations.find((v) => v.size === 64);
  // Altura do desenho (maior quadro), para a mesma regra de "rente ao piso" do mapa.
  const alto = Math.max(0, ...Object.values(j.spritesheet?.frames || {}).filter((_, i) => i < 400).map((f) => f.frame?.h || 0));
  return { d: j.logic?.model?.dimensions || { x: 1, y: 1, z: 1 }, dirs: Object.keys(v?.directions || {}).map(Number), alto };
};
// Mesma lista de assentos do mapa (lida do código, para não divergir).
const fonteMapa = readFileSync("vybe-escritorio-mapa.js", "utf8");
const ASSENTOS_LISTA = new Set(JSON.parse(fonteMapa.match(/MAPA_ASSENTOS = new Set\((\[[^\]]*\])/)[1].replace(/\s+/g, " ")));
const ASSENTOS = { test: (c) => ASSENTOS_LISTA.has(c) };
const moveis = [...P.moveis];
for (const a of P.ambientes) if (a.pessoal) moveis.push(...ctx.__sala(a).map((m) => [...m.slice(0, 6), a.id]));
const problemas = [], avisos = [], ocup = new Map();
const parede = new Set();
for (const [x0, y0, x1, y1] of P.divisorias) {
  if (y0 === y1) for (let x = x0; x < x1; x++) parede.add(`${x},${y0 - 1}|${x},${y0}`);
  else for (let y = y0; y < y1; y++) parede.add(`${x0 - 1},${y}|${x0},${y}`);
}
const temParede = (ax, ay, bx, by) => parede.has(`${ax},${ay}|${bx},${by}`) || parede.has(`${bx},${by}|${ax},${ay}`);
const itens = [];
for (const m of moveis) {
  const [classe, x, y, dir0, , altura = 0, camada = "geral"] = m;
  const a = arte(classe);
  if (!a) { problemas.push(`${classe} (${x},${y}) sem arte no painel`); continue; }
  let dir = dir0;
  if (a.dirs.length && !a.dirs.includes(dir)) {
    dir = a.dirs.includes((dir + 4) % 8) ? (dir + 4) % 8 : a.dirs[0];
    avisos.push(`${classe} (${x},${y}) pedido na direção ${dir0}, desenhado na ${dir}`);
  }
  const w = Math.max(1, dir === 2 || dir === 6 ? a.d.y : a.d.x), h = Math.max(1, dir === 2 || dir === 6 ? a.d.x : a.d.y);
  const plano = !(a.d.z > 0.05) && a.alto <= (w + h) * 16 + 12;
  const it = { classe, x: Math.floor(x), y: Math.floor(y), w: Math.round(w) || 1, h: Math.round(h) || 1, dir, altura, plano, camada, assento: ASSENTOS.test(classe) };
  itens.push(it);
  const nome = `${classe} (${it.x},${it.y})${camada !== "geral" ? " em " + camada : ""}`;
  if (it.x < 0 || it.y < 0 || it.x + it.w > P.W || it.y + it.h > P.H) problemas.push(`${nome} sai do mapa`);
  for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
    const tx = it.x + i, ty = it.y + j;
    if (i + 1 < it.w && temParede(tx, ty, tx + 1, ty)) problemas.push(`${nome} atravessa a divisória`);
    if (j + 1 < it.h && temParede(tx, ty, tx, ty + 1)) problemas.push(`${nome} atravessa a divisória`);
    if (plano || altura) continue;
    const k = `${tx},${ty}`;
    if (ocup.has(k)) problemas.push(`${nome} em cima de ${ocup.get(k)}`);
    else ocup.set(k, nome);
  }
}
// Apoiado: o que tem altura precisa de um móvel embaixo.
for (const it of itens) if (it.altura && !ocup.has(`${it.x},${it.y}`)) problemas.push(`${it.classe} (${it.x},${it.y}) flutuando`);
// Assento: precisa de um ladrilho livre ao lado, sem parede no meio, para chegar.
const livre = (x, y) => x >= 0 && y >= 0 && x < P.W && y < P.H && !ocup.has(`${x},${y}`);
for (const it of itens) {
  if (!it.assento || it.w > 1 || it.h > 1) continue;
  const acesso = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => livre(it.x + dx, it.y + dy) && !temParede(it.x, it.y, it.x + dx, it.y + dy));
  if (!acesso) problemas.push(`${it.classe} (${it.x},${it.y}) assento sem acesso`);
}
// Portas: os dois ladrilhos de cada vão ficam livres dos dois lados.
for (const a of P.ambientes) for (const [y, dy] of [[a.y0, -1], [a.y1, 1]]) {
  const meio = Math.floor((a.x0 + a.x1) / 2);
  if (y <= P.PREDIO.y0 || y >= P.PREDIO.y1) continue; // parede do prédio, sem porta
  for (const x of [meio - 1, meio]) {
    if (temParede(x, y - 1, x, y)) continue;
    const dentro = dy < 0 ? y : y - 1;
    if (dentro < a.y0 || dentro >= a.y1) continue;
    if (!livre(x, dentro) && !ocup.get(`${x},${dentro}`)?.startsWith("hygge_c25_carpet")) problemas.push(`porta de ${a.nome} (${x},${dentro}) bloqueada por ${ocup.get(`${x},${dentro}`)}`);
  }
}
// Circulação: a partir da recepção, andando como o boneco (8 direções, sem
// cortar quina, sem passar por móvel sólido nem por assento).
const solido = new Set(), assento = new Set();
for (const it of itens) {
  if (it.plano || it.altura) continue;
  for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) (it.assento ? assento : solido).add(`${it.x + i},${it.y + j}`);
}
const pi = P.piscina;
for (let x = pi.x0; x < pi.x1; x++) for (let y = pi.y0; y < pi.y1; y++) solido.add(`${x},${y}`);
const anda = (x, y) => x >= 0 && y >= 0 && x < P.W && y < P.H && !solido.has(`${x},${y}`) && !assento.has(`${x},${y}`);
const passo = (x, y, dx, dy) => {
  if (!anda(x + dx, y + dy)) return false;
  if (dx && dy) return passo(x, y, dx, 0) && passo(x + dx, y, 0, dy) && passo(x, y, 0, dy) && passo(x, y + dy, dx, 0);
  return !temParede(x, y, x + dx, y + dy);
};
const chega = new Set(["36,5"]), fila = [[36, 5]];
while (fila.length) {
  const [x, y] = fila.shift();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const k = `${x + dx},${y + dy}`;
    if (!chega.has(k) && passo(x, y, dx, dy)) { chega.add(k); fila.push([x + dx, y + dy]); }
  }
}
const alcancavel = (it) => {
  for (let x = it.x - 1; x <= it.x + it.w; x++) for (let y = it.y - 1; y <= it.y + it.h; y++)
    if (chega.has(`${x},${y}`)) return true;
  return false;
};
for (const a of P.ambientes) {
  let ok = false;
  for (let x = a.x0; x < a.x1 && !ok; x++) for (let y = a.y0; y < a.y1 && !ok; y++) ok = chega.has(`${x},${y}`);
  if (!ok) problemas.push(`não dá para chegar em ${a.nome || a.id}`);
}
for (const a of P.ambientes) if (a.pessoal) {
  const porta = { x: a.x0 + 5, y: a.porta === "cima" ? a.y0 + 1 : a.y0 + 8 };
  if (!chega.has(`${porta.x},${porta.y}`)) problemas.push(`a entrada de ${a.id} (${porta.x},${porta.y}) não tem caminho`);
}
// Assentos e móveis com ação do E precisam de um ladrilho alcançável ao lado.
const INTERATIVOS = /coffee|fridge|water_dispenser|minibar|stove|microwave|school_c22_cafe|treadmill|bicycle|jukebox|hc25_6|pinball|arcade|retrogames|fireplace|floorlight|pooltable|projector|largescreen|_tv$|exe_table/;
for (const it of itens) {
  if (!(it.assento || INTERATIVOS.test(it.classe))) continue;
  if (!alcancavel(it)) problemas.push(`${it.classe} (${it.x},${it.y})${it.camada !== "geral" ? " em " + it.camada : ""} sem acesso a pé`);
}
// Assento virado para algo: na frente dele (até 5 ladrilhos, na direção em que
// ele olha) precisa haver mesa, TV/telão, púlpito, palco, lareira ou outro
// assento virado de volta. Pega "sofá virado para a parede / para o nada".
const FOCO = /table|desk|tv|screen|lectern|stage|fireplace|projector|pooltable|footballtable|bardesk|bartable|counter|whiteboard|dj|hc25_6|jukebox|hc26_3|hc25_12|lowtable|coffeetable|arcade|retrogames|pinball|console|studio_camera|mixingdesk/;
const OLHA = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };
const SEM_FOCO_OK = /lounger|stonebench|bench|hangingchair|barstool|treadmill/;
for (const it of itens) {
  if (!it.assento || SEM_FOCO_OK.test(it.classe)) continue;
  const [dx, dy] = OLHA[it.dir] || [0, 0];
  let achou = false;
  for (let k = 1; k <= 5 && !achou; k++) {
    // De longe vale olhar um pouco de lado (plateia para o palco/telão).
    const lado = k >= 3 ? 2 : 0;
    for (let i = 0; i < it.w && !achou; i++) for (let j = 0; j < it.h && !achou; j++) for (let l = -lado; l <= lado && !achou; l++) {
      const x = it.x + i + dx * k + (dy ? l : 0), y = it.y + j + dy * k + (dx ? l : 0);
      if (k > 1 && temParede(x - dx, y - dy, x, y)) continue;
      const alvo = itens.find((o) => o !== it && !o.plano && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
      if (alvo && (FOCO.test(alvo.classe) || (alvo.assento && OLHA[alvo.dir] && ((OLHA[alvo.dir][0] === -dx && OLHA[alvo.dir][1] === -dy) || alvo.dir === it.dir)))) achou = true;
    }
  }
  if (!achou) problemas.push(`${it.classe} (${it.x},${it.y})${it.camada !== "geral" ? " em " + it.camada : ""} virado para o nada (direção ${it.dir})`);
}
const unicos = [...new Set(problemas)];
if (process.argv.includes("--direcoes")) console.log([...new Set(avisos)].join("\n"));
console.log(unicos.length ? unicos.join("\n") : "Planta sem problemas.");
process.exitCode = unicos.length ? 1 : 0;
