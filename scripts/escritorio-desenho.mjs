// Desenho dos móveis para o verificador (sem navegador): a mesma escolha de
// camadas e o mesmo ponto de registro de mapaDesenharMovel, mas só a
// silhueta (pixels opacos), lida do PNG da arte do Habbo. Serve para
// conferir o que um móvel cobre do outro na tela, coisa que a grade de
// ladrilhos não mostra: no Habbo a arte passa do próprio ladrilho.
import { readFileSync, existsSync } from "node:fs";
import { inflateSync } from "node:zlib";

// PNG de 8 bits por canal, sem entrelaçamento (o formato das folhas da arte).
function lerPng(buf) {
  let p = 8, w = 0, h = 0, tipo = 0, paleta = null, transp = null;
  const dados = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), nome = buf.toString("ascii", p + 4, p + 8), corpo = buf.subarray(p + 8, p + 8 + n);
    if (nome === "IHDR") { w = corpo.readUInt32BE(0); h = corpo.readUInt32BE(4); tipo = corpo[9]; if (corpo[8] !== 8 || corpo[12]) return null; }
    else if (nome === "PLTE") paleta = corpo;
    else if (nome === "tRNS") transp = corpo;
    else if (nome === "IDAT") dados.push(corpo);
    else if (nome === "IEND") break;
    p += 12 + n;
  }
  const canais = { 6: 4, 2: 3, 3: 1, 4: 2, 0: 1 }[tipo];
  if (!canais) return null;
  const cru = inflateSync(Buffer.concat(dados)), linha = w * canais, px = Buffer.alloc(linha * h);
  for (let y = 0; y < h; y++) {
    const f = cru[y * (linha + 1)], de = y * (linha + 1) + 1;
    for (let i = 0; i < linha; i++) {
      const a = i >= canais ? px[y * linha + i - canais] : 0, b = y ? px[(y - 1) * linha + i] : 0, c = y && i >= canais ? px[(y - 1) * linha + i - canais] : 0;
      let v = cru[de + i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * linha + i] = v & 255;
    }
  }
  const alfa = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (tipo === 6) alfa[i] = px[i * 4 + 3];
    else if (tipo === 4) alfa[i] = px[i * 2 + 1];
    else if (tipo === 3) alfa[i] = transp && px[i] < transp.length ? transp[px[i]] : 255;
    else alfa[i] = 255;
  }
  return { w, h, alfa };
}

const folhas = new Map(), mascaras = new Map();
function folha(classe) {
  if (!folhas.has(classe)) {
    const base = `assets/escritorio/habbo/${classe}`;
    folhas.set(classe, existsSync(base + ".json") && existsSync(base + ".png")
      ? { dados: JSON.parse(readFileSync(base + ".json", "utf8")), png: lerPng(readFileSync(base + ".png")) } : null);
  }
  return folhas.get(classe);
}

// Silhueta do móvel na direção e no estado dados, com a origem no ponto de
// registro (como ox/oy do mapa). Sem sombra nem camada de luz (ADD) e sem
// camada quase transparente: só o que tapa de verdade (com comLuz, a luz e
// o vidro contam: na lâmpada pendurada é o que mais aparece).
export function silhueta(classe, dir, estado = 0, comLuz = false) {
  const chave = `${classe}|${dir}|${estado}|${comLuz}`;
  if (mascaras.has(chave)) return mascaras.get(chave);
  let r = null;
  const f0 = folha(classe);
  if (f0?.png) {
    const { dados, png } = f0, nome = dados.name, v = dados.visualizations.find((x) => x.size === 64);
    const anim = v?.animations?.[estado] ? estado : 0;
    const caixas = [];
    for (let i = 0; i < (v?.layerCount || 1); i++) {
      const L = { ...(v?.layers?.[i] || {}), ...(v?.directions?.[dir]?.layers?.[i] || {}) };
      if ((L.ink === "ADD" && !comLuz) || (L.alpha != null && L.alpha < 128 && !comLuz)) continue;
      const seq = Object.values(v?.animations?.[anim]?.layers?.[i]?.frameSequences || {})[0]?.frames;
      const id = seq ? Object.values(seq)[0]?.id ?? 0 : 0;
      const asset = `${nome}_64_${String.fromCharCode(97 + i)}_${dir}_${id}`, a = dados.assets[asset];
      if (!a) continue;
      const f = dados.spritesheet.frames[`${nome}_${a.source || asset}`]?.frame;
      if (!f) continue;
      caixas.push({ f, flip: Boolean(a.flipH), x: a.flipH ? a.x - f.w : -a.x, y: -a.y });
    }
    if (caixas.length) {
      const x0 = Math.min(...caixas.map((c) => c.x)), y0 = Math.min(...caixas.map((c) => c.y));
      const w = Math.max(...caixas.map((c) => c.x + c.f.w)) - x0, h = Math.max(...caixas.map((c) => c.y + c.f.h)) - y0;
      const m = new Uint8Array(w * h);
      for (const c of caixas) for (let j = 0; j < c.f.h; j++) for (let i = 0; i < c.f.w; i++) {
        const sx = c.f.x + (c.flip ? c.f.w - 1 - i : i), sy = c.f.y + j;
        if (sx >= png.w || sy >= png.h || png.alfa[sy * png.w + sx] < 128) continue;
        m[(c.y - y0 + j) * w + (c.x - x0 + i)] = 1;
      }
      let n = 0;
      for (const b of m) n += b;
      r = { x: x0, y: y0, w, h, m, n };
    }
  }
  mascaras.set(chave, r);
  return r;
}

// Pixels opacos em comum entre duas silhuetas já postas na tela ({sx, sy}).
export function emComum(a, b) {
  a = { ...a, sx: Math.round(a.sx), sy: Math.round(a.sy) }; b = { ...b, sx: Math.round(b.sx), sy: Math.round(b.sy) };
  const x0 = Math.max(a.sx, b.sx), y0 = Math.max(a.sy, b.sy);
  const x1 = Math.min(a.sx + a.s.w, b.sx + b.s.w), y1 = Math.min(a.sy + a.s.h, b.sy + b.s.h);
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    if (a.s.m[(y - a.sy) * a.s.w + (x - a.sx)] && b.s.m[(y - b.sy) * b.s.w + (x - b.sx)]) n++;
  return n;
}

// Cada camada do desenho com a sua máscara e o z da arte (para a foto da
// cena, que põe camada por camada na profundidade do mapa). Mesma escolha
// de quadro e de ponto de registro da silhueta. A sombra fica de fora; a
// luz (ADD) e o que é quase transparente vêm marcados, para não taparem.
const camadasCache = new Map();
export function camadasDesenho(classe, dir, estado = 0) {
  const chave = `${classe}|${dir}|${estado}`;
  if (camadasCache.has(chave)) return camadasCache.get(chave);
  const r = [];
  const f0 = folha(classe);
  if (f0?.png) {
    const { dados, png } = f0, nome = dados.name, v = dados.visualizations.find((x) => x.size === 64);
    const anim = v?.animations?.[estado] ? estado : 0;
    for (let i = 0; i < (v?.layerCount || 1); i++) {
      const L = { ...(v?.layers?.[i] || {}), ...(v?.directions?.[dir]?.layers?.[i] || {}) };
      const seq = Object.values(v?.animations?.[anim]?.layers?.[i]?.frameSequences || {})[0]?.frames;
      const id = seq ? Object.values(seq)[0]?.id ?? 0 : 0;
      const asset = `${nome}_64_${String.fromCharCode(97 + i)}_${dir}_${id}`, a = dados.assets[asset];
      if (!a) continue;
      const f = dados.spritesheet.frames[`${nome}_${a.source || asset}`]?.frame;
      if (!f) continue;
      const flip = Boolean(a.flipH), x = flip ? a.x - f.w : -a.x, y = -a.y;
      const m = new Uint8Array(f.w * f.h);
      let n = 0;
      for (let j = 0; j < f.h; j++) for (let k = 0; k < f.w; k++) {
        const sx = f.x + (flip ? f.w - 1 - k : k), sy = f.y + j;
        if (sx >= png.w || sy >= png.h || png.alfa[sy * png.w + sx] < 128) continue;
        m[j * f.w + k] = 1; n++;
      }
      if (n) r.push({ i, z: L.z || 0, luz: L.ink === "ADD" || (L.alpha != null && L.alpha < 128), x, y, w: f.w, h: f.h, m, n });
    }
  }
  camadasCache.set(chave, r);
  return r;
}

// Para onde a frente da peça olha (vetor no piso), uma regra só para o motor
// de construção e o verificador. Arte de quatro direções: 0 → −y, 2 → +x,
// 4 → +y, 6 → −x. De duas: peça comprida olha perpendicular ao lado
// comprido, para quem vê a sala (+x ou +y), como a estante e a lareira da
// cabana; peça quadrada depende da família da arte (a outra direção é o
// espelho): na "0 e 2" a 0 olha para +x e a 2 para +y; na "2 e 4", a 2 olha
// para +x e a 4 para +y (conferido no fliperama pichado, 18/10/2026).
const OLHA = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };
export function frenteDaPeca(dirs, w, h, dir) {
  // "0 e 6" (divisória, banqueta de corrida) segue a rosa de quatro direções.
  if (dirs.length >= 4 || dirs.includes(6)) return OLHA[dir];
  if (w > h) return [0, 1];
  if (h > w) return [1, 0];
  return (dirs.includes(0) ? { 0: [1, 0], 2: [0, 1] } : { 2: [1, 0], 4: [0, 1] })[dir];
}
