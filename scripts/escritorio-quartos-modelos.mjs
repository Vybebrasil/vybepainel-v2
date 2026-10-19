// Posição dos modelos iniciais em cada planta dos quartos pessoais.
// node scripts/escritorio-quartos-modelos.mjs  (reescreve "ancoras" em
// assets/escritorio/habbo/quartos.json; --conferir só confere)
//
// Como um designer de interiores faria: a mesa vai encostada na parede do
// fundo (ou na frente do mezanino), num só patamar, longe da porta e da
// escada, e a porta precisa chegar a todas as cadeiras andando (regra do
// Arcturus: sobe até 1,5 por passo, desce livre). Antes os modelos iam todos
// para o canto da frente, soltos no meio do piso, longe de qualquer parede.
import { readFileSync, writeFileSync } from "node:fs";

const ARQ = new URL("../assets/escritorio/habbo/quartos.json", import.meta.url);
const texto = readFileSync(ARQ, "utf8");
const catalogo = JSON.parse(texto);
const fisica = JSON.parse(readFileSync(new URL("../assets/escritorio/habbo/fisica.json", import.meta.url), "utf8"));
const dimDe = (c) => JSON.parse(readFileSync(new URL(`../assets/escritorio/habbo/${c}.json`, import.meta.url), "utf8")).logic?.model?.dimensions || { x: 1, y: 1 };
const PISA = 1, SENTA = 2;

// Ladrilhos ocupados por um item [classe, x, y, dir, ...] (giro 2/6 troca os lados).
function pegada([c, x, y, dir], dims) {
  const d = dims.get(c), w = dir === 2 || dir === 6 ? d.y : d.x, h = dir === 2 || dir === 6 ? d.x : d.y, r = [];
  for (let i = Math.floor(x); i < Math.ceil(x + w); i++) for (let j = Math.floor(y); j < Math.ceil(y + h); j++) r.push([i, j]);
  return r;
}
// Itens apoiados em outro (computador na mesa) não ocupam o chão.
const apoiado = (it) => (it[5] || 0) > 0;

export function ancorarModelo(planta, modelo, dims) {
  const { celdas } = planta, h = celdas.length, w = celdas[0].length;
  const nivel = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : celdas[y][x]);
  const escada = new Set((planta.escada || []).map(([x, y]) => x + "," + y));
  const porta = [];
  for (const d of [0, 1]) {
    porta.push([planta.portas.baixo + d, h - 1], [planta.portas.baixo + d, h - 2]);
    if (planta.portas.direita != null) porta.push([w - 1, planta.portas.direita + d], [w - 2, planta.portas.direita + d]);
  }
  // A porta usada depende da sala (baixo ou direita): as duas ficam livres.
  const reservado = new Set([...escada, ...porta.filter((_, i) => i % 2 === 0).map(([x, y]) => x + "," + y)]);
  // O pé e o alto da escada ficam livres (nada encostado na subida).
  // No sentido da descida, dois ladrilhos de folga (chegar e virar).
  for (const [ex, ey] of planta.escada || []) for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = nivel(ex + vx, ey + vy);
    if (n >= 0) reservado.add(ex + vx + "," + (ey + vy));
    if (n >= 0 && n < nivel(ex, ey) && nivel(ex + 2 * vx, ey + 2 * vy) === n) reservado.add(ex + 2 * vx + "," + (ey + 2 * vy));
  }
  const itens = modelo.itens;
  if (!itens.length) return [0, 0];
  const x0 = Math.min(...itens.map((i) => Math.floor(i[1]))), y0 = Math.min(...itens.map((i) => Math.floor(i[2])));
  const mesa = itens.find((i) => i[0] === "exe_table") || itens[0];
  const candidatos = [];
  for (let dy = -y0; dy < h; dy++) for (let dx = -x0; dx < w; dx++) {
    const ocupados = new Map(); let ok = true, nv = null;
    for (const it of itens) {
      if (apoiado(it)) continue;
      for (const [x, y] of pegada([it[0], it[1] + dx, it[2] + dy, it[3]], dims)) {
        const n = nivel(x, y);
        if (n < 0 || reservado.has(x + "," + y) || (nv !== null && n !== nv)) { ok = false; break; }
        nv = n;
        const bits = fisica[it[0]]?.[0] || 0;
        // Tapete e cadeira deixam passar; o resto bloqueia o caminho.
        if (!(bits & (PISA | SENTA))) ocupados.set(x + "," + y, true);
      }
      if (!ok) break;
    }
    if (!ok) continue;
    // Encostada: atrás da linha do fundo da mesa há parede, vão ou patamar mais alto.
    const fundo = pegada([mesa[0], mesa[1] + dx, mesa[2] + dy, mesa[3]], dims);
    const yf = Math.min(...fundo.map(([, y]) => y));
    // Sem parede possível (planta estreita no fundo), ainda vale, mas por último.
    const encostada = fundo.filter(([, y]) => y === yf).every(([x, y]) => nivel(x, y - 1) < 0 || nivel(x, y - 1) > nv);
    // A porta alcança todas as cadeiras.
    const cadeiras = itens.filter((i) => (fisica[i[0]]?.[0] || 0) & SENTA).map((i) => [i[1] + dx, i[2] + dy]);
    // Cada porta (a sala usa uma delas) chega, andando, a todas as cadeiras.
    const alcance = (inicio) => {
      const visto = new Set([inicio.join(",")]), fila = [inicio];
      while (fila.length) {
        const [x, y] = fila.shift();
        for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + vx, ny = y + vy, k = nx + "," + ny, a = nivel(x, y), b = nivel(nx, ny);
          if (b < 0 || visto.has(k) || ocupados.has(k) || b - a > 1.5) continue;
          visto.add(k); fila.push([nx, ny]);
        }
      }
      return visto;
    };
    const entradas = porta.filter((p, i) => i % 2 === 0 && nivel(...p) >= 0).map(alcance);
    // …e a todo o resto do quarto: a decoração não isola nenhum canto
    // (nem o mezanino, pela escada).
    const destinos = [...cadeiras];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (nivel(x, y) >= 0 && !ocupados.has(x + "," + y)) destinos.push([x, y]);
    if (!entradas.every((visto) => destinos.every(([x, y]) => visto.has(x + "," + y)))) continue;
    // Preferência: patamar principal (o mais baixo), mais ao fundo, mesa
    // centrada na parede e longe da porta.
    const cx = mesa[1] + dx + 1.5, dist = Math.min(...porta.map(([px, py]) => Math.abs(px - cx) + Math.abs(py - (mesa[2] + dy))));
    candidatos.push({ dx, dy, nota: (encostada ? 0 : 1000) + nv * 100 + yf * 10 + Math.abs(cx - w / 2) - dist * 0.5 });
  }
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => a.nota - b.nota);
  return [candidatos[0].dx, candidatos[0].dy];
}

const dims = new Map();
for (const m of catalogo.modelos) for (const [c] of m.itens) if (!dims.has(c)) dims.set(c, dimDe(c));
let mudou = false;
for (const p of catalogo.plantas) {
  const ancoras = {};
  for (const m of catalogo.modelos) {
    const a = ancorarModelo(p, m, dims);
    if (a) ancoras[m.id] = a; else if (!process.argv.includes("--conferir")) console.warn(`Modelo ${m.id} não cabe em ${p.id}: não é oferecido nessa planta.`);
  }
  if (JSON.stringify(ancoras) !== JSON.stringify(p.ancoras)) { p.ancoras = ancoras; mudou = true; }
}
if (process.argv.includes("--conferir")) {
  if (mudou) { console.error("Âncoras desatualizadas: rode node scripts/escritorio-quartos-modelos.mjs"); process.exit(1); }
  console.log("Âncoras dos modelos conferidas.");
} else if (mudou) {
  writeFileSync(ARQ, JSON.stringify(catalogo, null, 2) + (texto.endsWith("\n") ? "\n" : ""));
  console.log("Âncoras gravadas em quartos.json.");
} else console.log("Nada a mudar.");
