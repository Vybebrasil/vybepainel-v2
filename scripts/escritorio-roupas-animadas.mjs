// Roupas animadas do Escritório (Paulo, 21/10/2026: "só se algum objeto,
// acessório tiver [animação], como o darkaura"). O imager do Habbo desenha
// cada peça parada (quadro 0); estas peças têm quadros de animação no acervo
// (.nitro). Este script tira do acervo só a folha de imagens e a posição de
// cada quadro (tamanho "h", postura "std") e grava em
// assets/escritorio/habbo/roupa_anim_<tipo>_<conjunto>.png + roupas_animadas.json
// (nomes simples: a rota de arte só serve [a-z0-9_] direto na pasta), que
// vybe-escritorio-animadas.js desenha por cima do boneco.
//
// Uso: node scripts/escritorio-roupas-animadas.mjs <pasta do acervo>/roupas
//
// Conjunto → partes e cor de cada parte: figuredata oficial do Habbo,
// conferido em 21/10/2026. Só tipos que ficam por cima do corpo (efeito,
// bichinho, chapéu, cabeça, rosto, cintura); camisa, casaco e asas passam por
// trás do corpo em algumas direções e ficam paradas.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const CONJUNTOS = {
  'ha-6273': [['ha', 7003, 1], ['ha', 7004, 2], ['ha', 7005, 0]], 'ha-6356': [['ha', 7175, 0], ['ha', 7176, 1]],
  'he-6094': [['he', 6697, 1], ['he', 6698, 0]], 'he-6173': [['he', 6822, 1], ['he', 6823, 0]], 'he-6236': [['he', 6933, 0], ['he', 6934, 0]],
  'he-6370': [['he', 7198, 1], ['he', 7199, 0], ['he', 7200, 2]], 'he-6373': [['he', 7203, 0]], 'he-6377': [['he', 7209, 0]],
  'he-6390': [['he', 7236, 0], ['he', 7237, 1]], 'he-6443': [['he', 7343, 0]], 'fa-6284': [['fa', 7022, 0]],
  'wa-6165': [['wa', 6800, 1], ['wa', 6801, 0], ['wa', 6802, 0]],
  'pt-6178': [['ptl', 6834, 1], ['pt', 6834, 1], ['ptr', 6834, 1], ['ptl', 6835, 0], ['pt', 6835, 0], ['ptr', 6835, 0]],
  'pt-6322': [['ptl', 7097, 0], ['pt', 7097, 0], ['ptr', 7097, 0]],
  'pt-6342': [['ptl', 7148, 0], ['pt', 7148, 0], ['ptr', 7148, 0], ['ptl', 7149, 0], ['pt', 7149, 0], ['ptr', 7149, 0]],
  'pt-6376': [['ptl', 7208, 0], ['pt', 7208, 0], ['ptr', 7208, 0]], 'pt-6487': [['ptl', 7425, 0], ['pt', 7425, 0], ['ptr', 7425, 0]],
  'pt-6512': [['ptl', 7474, 0], ['pt', 7474, 0], ['ptr', 7474, 0], ['ptl', 7475, 1], ['pt', 7475, 1], ['ptr', 7475, 1], ['ptl', 7476, 0], ['pt', 7476, 0], ['ptr', 7476, 0]],
  'pt-6539': [['ptl', 7525, 0], ['pt', 7525, 0], ['ptr', 7525, 0]],
  'pt-6553': [['ptl', 7554, 0], ['pt', 7554, 0], ['ptr', 7554, 0], ['ptl', 7555, 0], ['pt', 7555, 0], ['ptr', 7555, 0]],
  'pt-6565': [['ptl', 7587, 1], ['pt', 7587, 1], ['ptr', 7587, 1], ['ptl', 7588, 2], ['pt', 7588, 2], ['ptr', 7588, 2], ['ptl', 7589, 0], ['pt', 7589, 0], ['ptr', 7589, 0]],
  'pt-6618': [['ptl', 7712, 1], ['pt', 7712, 1], ['ptr', 7712, 1], ['ptl', 7713, 0], ['pt', 7713, 0], ['ptr', 7713, 0]],
  'mc-6251': [['mcl', 6968, 1], ['mc', 6968, 1], ['mcr', 6968, 1], ['mcl', 6969, 2], ['mc', 6969, 2], ['mcr', 6969, 2], ['mcl', 6970, 0], ['mc', 6970, 0], ['mcr', 6970, 0], ['he', 6970, 0]],
  'mc-6445': [['mcl', 7343, 0], ['mc', 7343, 0], ['mcr', 7343, 0]], 'mc-6448': [['mcl', 7347, 0], ['mc', 7347, 0], ['mcr', 7347, 0]],
  'mc-6449': [['mcl', 7348, 1], ['mc', 7348, 1], ['mcr', 7348, 1]],
  'mc-6452': [['mcl', 7352, 0], ['mc', 7352, 0], ['mcr', 7352, 0], ['mcl', 7353, 1], ['mc', 7353, 1], ['mcr', 7353, 1], ['mcl', 7354, 0], ['mc', 7354, 0], ['mcr', 7354, 0]],
  'mc-6527': [['mcl', 7501, 0], ['mc', 7501, 0], ['mcr', 7501, 0], ['mcl', 7502, 1], ['mc', 7502, 1], ['mcr', 7502, 1], ['mcl', 7503, 2], ['mc', 7503, 2], ['mcr', 7503, 2]],
  'mc-6548': [['mcl', 7542, 1], ['mc', 7542, 1], ['mcr', 7542, 1], ['mcl', 7543, 0], ['mc', 7543, 0], ['mcr', 7543, 0]],
  'mc-6562': [['mco', 7579, 1], ['mco', 7580, 0]],
  'mc-6571': [['mcl', 7601, 1], ['mc', 7601, 1], ['mcr', 7601, 1], ['mcl', 7602, 2], ['mc', 7602, 2], ['mcr', 7602, 2], ['mcl', 7603, 0], ['mc', 7603, 0], ['mcr', 7603, 0]],
};

// PNG RGBA de 8 bits sem entrelaçamento (o que o imager e o Nitro usam).
function lerPng(buf) {
  let o = 8, w, h, tipo, idat = [], pal = null, trns = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); tipo = d[9]; } else if (t === 'PLTE') pal = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const bpp = { 6: 4, 2: 3, 3: 1, 4: 2, 0: 1 }[tipo], raw = inflateSync(Buffer.concat(idat)), linha = w * bpp, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(linha), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], cur = Buffer.from(raw.subarray(p, p + linha)); p += linha;
    for (let i = 0; i < linha; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0, pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      cur[i] = (cur[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, s = x * bpp;
      if (tipo === 6) cur.copy(px, k, s, s + 4);
      else if (tipo === 3) { const i = cur[s]; px[k] = pal[i * 3]; px[k + 1] = pal[i * 3 + 1]; px[k + 2] = pal[i * 3 + 2]; px[k + 3] = trns && i < trns.length ? trns[i] : 255; }
      else { px[k] = cur[s]; px[k + 1] = cur[s + 1] ?? cur[s]; px[k + 2] = cur[s + 2] ?? cur[s]; px[k + 3] = tipo === 2 ? 255 : tipo === 4 ? cur[s + 1] : 255; }
    }
    prev = cur;
  }
  return { w, h, px };
}
// Origem do desenho no boneco "h" (64×110), conferida pixel a pixel contra o
// imager (100% num acessório de cabeça): x = -offset, y = 100 - offset.
const ORIGEM_Y = 100, ESPELHO = { 4: 2, 5: 1, 6: 0 };
const BASE = 'hd-180-1.ch-255-1.lg-280-110.sh-305-62';
const imager = async (fig, dir) => lerPng(Buffer.from(await (await fetch(`https://www.habbo.com/habbo-imaging/avatarimage?figure=${fig}&direction=${dir}&head_direction=${dir}&size=n&gesture=std`)).arrayBuffer()));
// Frente ou atrás do boneco: dos pixels da peça, quantos o imager mostra (o
// boneco com a peça difere do boneco sem ela). Menos da metade: vai atrás.
function medirFrente(folha, q, dir, espelhada, com, sem) {
  const [sx, sy, w, h, ax, ay] = q; let total = 0, vistos = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((sy + y) * folha.w + sx + x) * 4; if (folha.px[s + 3] < 200) continue;
    const tx = espelhada ? 64 + ax - w + (w - 1 - x) : -ax + x, ty = ORIGEM_Y - ay + y;
    if (tx < 0 || ty < 0 || tx >= 64 || ty >= 110) continue;
    total++; const k = (ty * 64 + tx) * 4;
    if (Math.abs(com.px[k] - sem.px[k]) + Math.abs(com.px[k + 1] - sem.px[k + 1]) + Math.abs(com.px[k + 2] - sem.px[k + 2]) + Math.abs(com.px[k + 3] - sem.px[k + 3]) > 30) vistos++;
  }
  return total ? vistos / total : 1;
}
function lerNitro(arquivo) {
  const b = readFileSync(arquivo); let o = 0; const n = b.readUInt16BE(o); o += 2; const saida = {};
  for (let i = 0; i < n; i++) {
    const l = b.readUInt16BE(o); o += 2; const nome = b.toString('utf8', o, o + l); o += l;
    const t = b.readUInt32BE(o); o += 4; saida[nome] = inflateSync(b.subarray(o, o + t)); o += t;
  }
  return saida;
}

const pasta = process.argv[2];
if (!pasta) { console.error('Uso: node scripts/escritorio-roupas-animadas.mjs <acervo>/roupas'); process.exit(1); }
const saida = 'assets/escritorio/habbo';
// Índice: em qual pacote está cada parte (tipo-id).
const pacotes = new Map();
for (const f of readdirSync(pasta)) {
  if (!f.endsWith('.nitro')) continue;
  let r; try { r = lerNitro(`${pasta}/${f}`); } catch { continue; }
  const j = Object.entries(r).find(([k]) => k.endsWith('.json'));
  if (!j) continue;
  for (const k of Object.keys(JSON.parse(j[1]).assets || {})) { const m = /^h_std_([a-z]+)_(\d+)_\d_\d+$/.exec(k); if (m && !pacotes.has(`${m[1]}-${m[2]}`)) pacotes.set(`${m[1]}-${m[2]}`, f); }
}
const indice = {};
for (const [chave, partes] of Object.entries(CONJUNTOS)) {
  const arquivo = partes.map(([t, id]) => pacotes.get(`${t}-${id}`)).find(Boolean);
  if (!arquivo) { console.warn('sem pacote', chave); continue; }
  const r = lerNitro(`${pasta}/${arquivo}`);
  const [nomeJson, bruto] = Object.entries(r).find(([k]) => k.endsWith('.json'));
  const j = JSON.parse(bruto), lib = nomeJson.replace(/\.json$/, '');
  const png = Object.entries(r).find(([k]) => k.endsWith('.png'))[1];
  const camadas = [];
  let animada = false;
  for (const [tipo, id, cor] of partes) {
    const d = {};
    for (let dir = 0; dir < 8; dir++) {
      const quadros = [];
      for (let q = 0; ; q++) {
        const nome = `h_std_${tipo}_${id}_${dir}_${q}`, a = j.assets[nome];
        if (!a) break;
        const fonte = a.source || nome, fr = j.spritesheet.frames[`${lib}_${fonte}`]?.frame;
        if (!fr) break;
        quadros.push([fr.x, fr.y, fr.w, fr.h, a.x, a.y, a.flipH ? 1 : 0]);
      }
      if (quadros.length) d[dir] = quadros;
      if (quadros.length > 1) animada = true;
    }
    if (Object.keys(d).length) camadas.push({ p: tipo, cor, d });
  }
  if (!animada || !camadas.length) continue;
  // Frente/atrás por direção (lista "a": direções em que a camada vai atrás).
  const folhaPx = lerPng(png);
  for (let dir = 0; dir < 8; dir++) {
    const [com, sem] = await Promise.all([imager(`${BASE}.${chave}`, dir), imager(BASE, dir)]);
    for (const c of camadas) {
      const esp = c.d[dir] ? null : ESPELHO[dir], q = c.d[esp ?? dir]?.[0];
      if (q && medirFrente(folhaPx, q, dir, esp !== undefined && esp !== null, com, sem) < 0.5) (c.a ||= []).push(dir);
    }
  }
  const folha = `roupa_anim_${chave.replace('-', '_')}.png`;
  writeFileSync(`${saida}/${folha}`, png);
  indice[chave] = { folha, camadas };
}
writeFileSync(`${saida}/roupas_animadas.json`, JSON.stringify(indice));
console.log(Object.keys(indice).length, 'conjuntos animados:', Object.keys(indice).join(' '));
