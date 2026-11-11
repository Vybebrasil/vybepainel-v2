// Móveis da Minha sala esculpidos na arte do Habbo (Paulo, 09/11/2026: "era pra entrar na sala de cada um como era
// no Habbo, olhar móvel a móvel, detalhe a detalhe, e copiar exatamente igual... mas no estilo voxel").
//
// Nada é desenhado à mão: cada móvel vira voxels a partir do PRÓPRIO desenho do Habbo que o Escritório já mostra.
// Cada direção desenhada (0, 2, 4, 6) é uma foto do móvel girado; juntas, são fotos de lados diferentes do mesmo
// objeto. Um bloquinho só fica se aparece cheio em todas as fotos (escultura pela silhueta) e a cor de cada bloco
// visível é a do pixel que a foto mostra ali. Forma, cores (inclusive a cor escolhida no estado), tamanho no chão,
// altura e direção saem do móvel, não de um catálogo.
//
// Projeção do Habbo (a mesma de vybe-escritorio-mapa.js): ladrilho 64 × 32 e 1 nível = 32 px. O ponto de registro
// do desenho é o centro do ladrilho de origem (o canto de menor x e y da peça), na altura do apoio.

// 32 px de altura no Habbo, em ladrilhos do mundo: a projeção 2:1 tem a câmera a 30°, e o lado do ladrilho
// projeta 45,25 px na diagonal; um nível (32 px na vertical) mede 32 / (45,25 · cos 30°) ≈ 0,816 ladrilho.
export const NIVEL_HABBO = 0.816;

// Ponto (u, v, h) em relação ao centro do ladrilho de origem (u, v em ladrilhos; h em níveis) → pixel do desenho.
export const projetar = (u, v, h) => ({ x: (u - v) * 32, y: (u + v) * 16 - h * 32 });

// Giro de um quarto de volta no chão (Habbo: a direção 2 olha para +x e a 4 para +y).
const girar = (x, y, vezes, sinal) => { for (let k = 0; k < vezes; k++) [x, y] = sinal > 0 ? [-y, x] : [y, -x]; return [x, y]; };

// Uma vista: { dir, w, h, ox, oy, alfa(px, py) → 0..255, cor(px, py) → [r, g, b] }.
// Esculpe a peça na direção `dir` com pegada W × D ladrilhos. N blocos por ladrilho.
export function esculpir({ W, D, dir, vistas, N = 8, alturaMax = null, limiar = 40, cores = 12, passoFino = 0 }) {
  const s = 1 / N, nx = Math.max(1, Math.round(W * N)), nz = Math.max(1, Math.round(D * N));
  // Altura: até onde o desenho sobe, visto do canto do fundo do ladrilho de origem (u + v = −1).
  let topo = 0.04; // tapete e piso decorado: uma camada só
  for (const v of vistas) topo = Math.max(topo, (-16 - v.oy) / 32);
  // A altura vem do desenho: a ficha do Habbo tem altura errada em muita peça decorativa (a TV hygge_c25_tv diz 0,1).
  void alturaMax;
  topo = Math.min(10, topo);
  const ny = Math.max(1, Math.ceil(topo * NIVEL_HABBO * N));
  const total = nx * ny * nz;
  // Cada vista vista do jeito certo: quantos quartos de volta separam a foto da peça como está posta.
  const opaco = (v, x, y) => {
    const px = Math.floor(x - v.ox), py = Math.floor(y - v.oy);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (v.alfa(px + dx, py + dy) > limiar) return true;
    return false;
  };
  const posicao = (v, a, b, sinal) => {
    const r = ((((v.dir - dir) / 2) % 4) + 4) % 4, [Wv, Dv] = r % 2 ? [D, W] : [W, D];
    const [qx, qy] = girar(a - W / 2, b - D / 2, r, sinal);
    return { u: qx + Wv / 2 - 0.5, v: qy + Dv / 2 - 0.5 };
  };
  function carvar(sinal) {
    const cheio = new Uint8Array(total);
    let n = 0;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const a = (i + 0.5) * s, b = (k + 0.5) * s;
      const pos = vistas.map((v) => posicao(v, a, b, sinal));
      for (let j = 0; j < ny; j++) {
        const h = ((j + 0.5) * s) / NIVEL_HABBO;
        let ok = true;
        for (let q = 0; q < vistas.length && ok; q++) { const p = projetar(pos[q].u, pos[q].v, h); ok = opaco(vistas[q], p.x, p.y); }
        if (ok) { cheio[(i * ny + j) * nz + k] = 1; n++; }
      }
    }
    return { cheio, n };
  }
  // O sentido do giro entre as fotos: o certo é o que guarda mais da peça (com uma vista só, tanto faz).
  let melhor = carvar(1), sinal = 1;
  if (vistas.some((v) => v.dir !== dir)) { const outro = carvar(-1); if (outro.n > melhor.n) { melhor = outro; sinal = -1; } }
  const { cheio } = melhor;
  const idx = (i, j, k) => (i * ny + j) * nz + k;
  const tem = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && cheio[idx(i, j, k)] === 1;
  // Cor: em cada foto, o bloco mais perto da câmera em cada ponto da imagem leva a cor daquele pixel.
  const soma = new Float32Array(total * 3), conta = new Uint16Array(total);
  for (const v of vistas) {
    const frente = new Map();
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const a = (i + 0.5) * s, b = (k + 0.5) * s, pos = posicao(v, a, b, sinal);
      for (let j = 0; j < ny; j++) {
        if (!cheio[idx(i, j, k)]) continue;
        const h = ((j + 0.5) * s) / NIVEL_HABBO, p = projetar(pos.u, pos.v, h);
        const chave = Math.floor((p.x - v.ox) / 2) + ',' + Math.floor((p.y - v.oy) / 2), prof = pos.u + pos.v + h;
        const atual = frente.get(chave);
        if (!atual || prof > atual.prof) frente.set(chave, { prof, n: idx(i, j, k), x: p.x - v.ox, y: p.y - v.oy });
      }
    }
    for (const { n, x, y } of frente.values()) {
      const c = v.cor(Math.floor(x), Math.floor(y)); if (!c) continue;
      soma[n * 3] += c[0]; soma[n * 3 + 1] += c[1]; soma[n * 3 + 2] += c[2]; conta[n]++;
    }
  }
  // Só a casca aparece (o miolo não se vê); blocos da casca sem foto pegam a cor dos vizinhos.
  const casca = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (!tem(i, j, k)) continue;
    if (tem(i + 1, j, k) && tem(i - 1, j, k) && tem(i, j + 1, k) && tem(i, j - 1, k) && tem(i, j, k + 1) && tem(i, j, k - 1)) continue;
    casca.push([i, j, k]);
  }
  const cor = new Map();
  for (const [i, j, k] of casca) { const n = idx(i, j, k); if (conta[n]) cor.set(n, [soma[n * 3] / conta[n], soma[n * 3 + 1] / conta[n], soma[n * 3 + 2] / conta[n]]); }
  for (let passo = 0; passo < 6; passo++) {
    let faltou = false;
    for (const [i, j, k] of casca) {
      const n = idx(i, j, k); if (cor.has(n)) continue;
      const viz = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([a, b, c]) => cor.get(idx(i + a, j + b, k + c))).filter((x) => x && tem(i, j, k));
      if (viz.length) cor.set(n, viz.reduce((m, c) => [m[0] + c[0] / viz.length, m[1] + c[1] / viz.length, m[2] + c[2] / viz.length], [0, 0, 0])); else faltou = true;
    }
    if (!faltou) break;
  }
  const hex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  // Cores chapadas como no mundo, sem perder detalhe: a peça fica com as 12 cores principais dela (a paleta do móvel)
  // e cada bloco pega a mais próxima. Some o chiado do sombreado pixel a pixel; ficam as partes e os detalhes.
  const paleta = paletaCurta(casca.map(([i, j, k]) => cor.get(idx(i, j, k))).filter(Boolean), cores);
  const blocos = casca.map(([i, j, k]) => { const c = cor.get(idx(i, j, k)); return { x: (i + 0.5) * s, y: j * s, z: (k + 0.5) * s, cor: hex(c ? maisPerto(paleta, c) : paleta[0] || [150, 150, 150]) }; });
  // ---------- casca fina: o desenho do Habbo pixel a pixel, na profundidade certa ----------
  // O miolo acima dá o volume; por cima, um bloco pequeno a cada `passoFino` pixels da foto da própria direção da
  // peça, no ponto em que o raio da câmera do Habbo toca o miolo. A câmera da Minha sala é a do Habbo, então da
  // tela cada pixel do desenho cai exatamente no lugar dele. Pixel cujo raio não toca o miolo (haste, fio, folha fina)
  // fica na profundidade do pixel vizinho mais perto que tocou: preso à peça, nunca solto no ar.
  const foto = vistas.find((v) => v.dir === dir && typeof v.pixel === 'function');
  const finos = [];
  let ladoFino = 0;
  if (foto && passoFino > 0) {
    ladoFino = (passoFino / 32) * 1.15;
    const ocupado = (a, b, hNivel) => { const i = Math.floor(a / s), k = Math.floor(b / s), j = Math.floor((hNivel * NIVEL_HABBO) / s); return tem(i, j, k); };
    const passoT = s / 3, tMin = -1, tMax = W + D - 1;
    const colunas = Math.ceil(foto.w / passoFino), linhas = Math.ceil(foto.h / passoFino);
    const fundo = new Float32Array(colunas * linhas).fill(NaN), pixels = [];
    // Grão do mundo (Paulo, 09/11/2026: "os quartos e o mundo parecem nem pertencer ao mesmo criador"): cada bloco
    // da casca cobre passoFino × passoFino pixels; entra se a célula estiver ao menos meio cheia, com a cor da célula
    // sem o contorno preto do Habbo (corSemContorno), e depois cai na paleta curta da peça (cores chapadas).
    const celula = (px, py) => {
      let n = 0, r = 0, g = 0, b = 0;
      for (let y = py; y < Math.min(foto.h, py + passoFino); y++) for (let x = px; x < Math.min(foto.w, px + passoFino); x++) {
        const c = foto.cor ? foto.cor(x, y) : foto.pixel(x, y); if (!c) continue; n++; r += c[0]; g += c[1]; b += c[2];
      }
      return n * 2 >= passoFino * passoFino ? [r / n, g / n, b / n] : null;
    };
    for (let py = 0, ly = 0; py < foto.h; py += passoFino, ly++) for (let px = 0, lx = 0; px < foto.w; px += passoFino, lx++) {
      const c = celula(px, py); if (!c) continue;
      const sx = px + passoFino / 2 + foto.ox, sy = py + passoFino / 2 + foto.oy;
      // Raio da câmera do Habbo por este pixel: u − v fixo, e h sobe com u + v (t). Vem da frente (t alto) para trás.
      for (let t = tMax; t >= tMin; t -= passoT) {
        const u = (t + sx / 32) / 2, v = (t - sx / 32) / 2, h = (t * 16 - sy) / 32, a = u + .5, b = v + .5;
        if (a < 0 || b < 0 || a > W || b > D || h < 0) continue;
        if (ocupado(a, b, h)) { fundo[ly * colunas + lx] = t + passoT * .6; break; } // um passo para a frente: por fora do miolo
      }
      pixels.push({ lx, ly, sx, sy, c });
    }
    // Quem não tocou herda a profundidade do vizinho que tocou, procurando em anéis cada vez maiores.
    const profundidade = (lx, ly) => {
      const t0 = fundo[ly * colunas + lx]; if (!Number.isNaN(t0)) return t0;
      for (let r = 1; r < 24; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = lx + dx, y = ly + dy; if (x < 0 || y < 0 || x >= colunas || y >= linhas) continue;
        const t = fundo[y * colunas + x]; if (!Number.isNaN(t)) return t;
      }
      return NaN;
    };
    // Profundidade de um pixel sempre dentro da pegada da peça (nunca entra na parede de trás nem sai pela frente):
    // a = (t + sx/32)/2 + 0,5 entre 0 e W e b = (t − sx/32)/2 + 0,5 entre 0 e D. Sem vizinho que tocou o miolo, o
    // plano do meio da peça (a + b = (W + D)/2).
    const dentro = (t, sx) => { const lo = Math.max(-1 - sx / 32, -1 + sx / 32) + .02, hi = Math.min(2 * W - 1 - sx / 32, 2 * D - 1 + sx / 32) - .02; return lo <= hi ? Math.min(hi, Math.max(lo, t)) : (lo + hi) / 2; };
    for (const q of pixels) {
      let t = profundidade(q.lx, q.ly); if (Number.isNaN(t)) t = (W + D) / 2 - 1;
      t = dentro(t, q.sx);
      const a = (t + q.sx / 32) / 2 + .5, b = (t - q.sx / 32) / 2 + .5, h = (t * 16 - q.sy) / 32;
      if (h < -.02) continue;
      finos.push({ x: a, y: Math.max(0, h * NIVEL_HABBO - ladoFino / 2), z: b, c: q.c, lx: q.lx, ly: q.ly });
    }
    chapar(finos, Math.min(cores, 7));
    for (const f of finos) { delete f.lx; delete f.ly; }
  }
  return { W, D, lado: s, blocos, finos, ladoFino, altura: ny * s, sinal };
}

// Cores chapadas (referências de 09/11/2026: faces lisas, poucas cores): a peça fica com até n cores e cada bloco
// pega a cor que mais aparece em volta dele no desenho (3 × 3), o que tira o sombreado pontilhado do pixel art.
// Recebe [{ c: [r,g,b], lx, ly }] (posição na grade do desenho) e escreve .cor em cada um.
export function chapar(lista, n = 7) {
  const pal = paletaCurta(lista.map((q) => q.c), n), mapa = new Map();
  for (const q of lista) { q.k = pal.indexOf(maisPerto(pal, q.c)); mapa.set(q.lx + ',' + q.ly, q.k); }
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  for (const q of lista) {
    const conta = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = mapa.get((q.lx + dx) + ',' + (q.ly + dy)); if (k !== undefined) conta.set(k, (conta.get(k) || 0) + (dx || dy ? 1 : 2)); }
    let melhor = q.k, m = 0; for (const [k, c] of conta) if (c > m) { m = c; melhor = k; }
    q.cor = hex(pal[melhor] || q.c); delete q.c; delete q.k;
  }
  return lista;
}
// Paleta curta: agrupa as cores em caixas de 40 em cada canal, fica com as `n` caixas mais cheias (a média de cada uma)
// e junta cores distantes demais de todas só se forem muitas (um detalhe colorido de verdade, como uma flor).
export function paletaCurta(lista, n = 6) {
  const caixas = new Map();
  for (const c of lista) { const k = c.map((v) => Math.floor(v / 40)).join(','); const b = caixas.get(k) || { s: [0, 0, 0], n: 0 }; b.s[0] += c[0]; b.s[1] += c[1]; b.s[2] += c[2]; b.n++; caixas.set(k, b); }
  return [...caixas.values()].sort((a, b) => b.n - a.n).slice(0, Math.max(1, n)).map((b) => b.s.map((v) => v / b.n));
}
export const maisPerto = (paleta, c) => paleta.reduce((m, p) => ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 < (m[0] - c[0]) ** 2 + (m[1] - c[1]) ** 2 + (m[2] - c[2]) ** 2 ? p : m), paleta[0]);

// ---------- Ligação com a arte que o Escritório já carrega (navegador) ----------
// Vista de uma direção: o desenho do móvel inteiro, quadro 0 do estado salvo, como o mapa do Escritório o compõe
// (camadas por z, ponto de registro, espelho, camada recolorível tingida pela cor do estado), sem a sombra e sem as
// camadas de luz "ADD". Composto aqui, direto da planilha do Habbo: com o mundo ligado, mapaDesenharMovel passa a
// devolver o ícone voxel genérico (vybe-mundo.js, ligarIconesVoxel), e esculpir esse ícone foi o que deu as caixas.
function comporDesenho({ dados, imagem }, dir, estadoSalvo) {
  const v = dados?.visualizations?.find?.((x) => x.size === 64); if (!v || !imagem) return null;
  const corDoEstado = globalThis.mapaCorDoEstado;
  let estado = Number(estadoSalvo) || 0, cor = null;
  try { if (typeof corDoEstado === 'function') ({ estado, cor } = corDoEstado(dados, estado)); } catch { /* sem tinta */ }
  const nome = dados.name, partes = [];
  for (let i = 0; i < (v.layerCount || 1); i++) {
    const L = { ...(v.layers?.[i] || {}), ...(v.directions?.[dir]?.layers?.[i] || {}) };
    if (L.ink === 'ADD') continue;
    const seq = v.animations?.[estado]?.layers?.[i]?.frameSequences;
    const quadros = seq ? Object.values(Object.values(seq)[0]?.frames || {}) : [];
    const id = quadros.length ? quadros[0].id : 0;
    const asset = `${nome}_64_${String.fromCharCode(97 + i)}_${dir}_${id}`, a = dados.assets?.[asset];
    if (!a) continue;
    const f = dados.spritesheet?.frames?.[`${nome}_${a.source || asset}`]?.frame; if (!f) continue;
    partes.push({ f, x: a.flipH ? a.x - f.w : -a.x, y: -a.y, flip: Boolean(a.flipH), z: L.z || 0, ordem: i, alpha: L.alpha != null ? L.alpha / 255 : 1, cor: L.tag === 'recolorable' ? cor : null });
  }
  if (!partes.length) return null;
  partes.sort((p, q) => p.z - q.z || p.ordem - q.ordem);
  const minX = Math.min(...partes.map((p) => p.x)), minY = Math.min(...partes.map((p) => p.y));
  const w = Math.max(1, Math.max(...partes.map((p) => p.x + p.f.w)) - minX), h = Math.max(1, Math.max(...partes.map((p) => p.y + p.f.h)) - minY);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
  const tinta = document.createElement('canvas'), tg = tinta.getContext('2d');
  for (const p of partes) {
    let fonte = imagem, sx = p.f.x, sy = p.f.y;
    if (p.cor) {
      tinta.width = p.f.w; tinta.height = p.f.h; tg.imageSmoothingEnabled = false;
      tg.drawImage(imagem, sx, sy, p.f.w, p.f.h, 0, 0, p.f.w, p.f.h);
      tg.globalCompositeOperation = 'multiply'; tg.fillStyle = p.cor; tg.fillRect(0, 0, p.f.w, p.f.h);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(imagem, sx, sy, p.f.w, p.f.h, 0, 0, p.f.w, p.f.h);
      tg.globalCompositeOperation = 'source-over'; fonte = tinta; sx = 0; sy = 0;
    }
    g.save(); g.globalAlpha = p.alpha;
    const dx = p.x - minX, dy = p.y - minY;
    if (p.flip) { g.translate(dx + p.f.w, dy); g.scale(-1, 1); g.drawImage(fonte, sx, sy, p.f.w, p.f.h, 0, 0, p.f.w, p.f.h); }
    else g.drawImage(fonte, sx, sy, p.f.w, p.f.h, dx, dy, p.f.w, p.f.h);
    g.restore();
  }
  return { canvas, ox: minX, oy: minY };
}
function vistaDaDirecao(movel, dir, estado) {
  let d = null;
  try { d = comporDesenho(movel, dir, estado); } catch { return null; }
  if (!d?.canvas?.width) return null;
  const { width: w, height: h } = d.canvas;
  const px = d.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const dentro = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  return { dir, w, h, ox: d.ox, oy: d.oy,
    alfa: (x, y) => (dentro(x, y) ? px[(y * w + x) * 4 + 3] : 0),
    cor: (x, y) => corSemContorno(px, w, h, x, y),
    // O pixel como está no desenho (com o contorno): é o que a casca fina repete.
    pixel: (x, y) => (dentro(x, y) && px[(y * w + x) * 4 + 3] > 40 ? [px[(y * w + x) * 4], px[(y * w + x) * 4 + 1], px[(y * w + x) * 4 + 2]] : null) };
}
// Cor do bloco: a do pixel, mas o contorno preto de 1 px do Habbo não vira bloco preto: no 3×3 em volta, a média dos
// pixels que não são contorno (se houver), senão o próprio pixel.
function corSemContorno(px, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h || px[(y * w + x) * 4 + 3] <= 40) return null;
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const i = (yy * w + xx) * 4; if (px[i + 3] <= 40) continue;
    const lum = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; if (lum < 34) continue;
    const peso = dx === 0 && dy === 0 ? 4 : 1; r += px[i] * peso; g += px[i + 1] * peso; b += px[i + 2] * peso; n += peso;
  }
  const i = (y * w + x) * 4;
  return n ? [r / n, g / n, b / n] : [px[i], px[i + 1], px[i + 2]];
}
// Direções desenhadas. O espelho do Habbo conta como foto: quando a direção 4 é a 2 espelhada, o Habbo está dizendo
// que o móvel é simétrico, e o espelho é exatamente como ele se vê daquele lado.
function direcoesDesenhadas(dados) {
  const v = dados?.visualizations?.find?.((x) => x.size === 64); if (!v) return [];
  const nome = dados.name, assets = dados.assets || {};
  return [0, 2, 4, 6].filter((d) => Object.keys(assets).some((k) => k.startsWith(`${nome}_64_`) && !/_sd_/.test(k) && k.endsWith(`_${d}_0`)));
}
const CACHE = new Map();
// Peça esculpida para (classe, direção, estado), guardada: as salas repetem o mesmo móvel.
// Peças já esculpidas ficam guardadas no navegador (IndexedDB, por móvel, direção, estado e versão da arte): a
// segunda vez que a sala abre, nada é esculpido de novo. Sem IndexedDB (aba anônima, bloqueado), esculpe sempre.
const VERSAO_ESCULTURA = 'e9';
export const guardado = (() => {
  let banco = null;
  const abrir = () => banco || (banco = new Promise((ok) => {
    try {
      const r = indexedDB.open('vybe-minha-sala', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pecas');
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch { ok(null); }
  }));
  const chaveDe = (k) => VERSAO_ESCULTURA + '|' + ((typeof ESCRITORIO_ARTE_VERSAO !== 'undefined' ? ESCRITORIO_ARTE_VERSAO : '')) + '|' + k;
  return {
    async ler(k) { const db = await abrir(); if (!db) return null; return new Promise((ok) => { try { const r = db.transaction('pecas').objectStore('pecas').get(chaveDe(k)); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); } catch { ok(null); } }); },
    async gravar(k, v) { const db = await abrir(); if (!db) return; try { db.transaction('pecas', 'readwrite').objectStore('pecas').put(v, chaveDe(k)); } catch { /* cheio ou bloqueado: segue sem guardar */ } },
  };
})();
// Uma escultura por vez, cedendo a vez ao navegador entre elas: a sala aparece aos poucos sem travar a tela.
let fila = Promise.resolve();
const naFila = (f) => (fila = fila.then(() => new Promise((ok) => setTimeout(ok, 0))).then(f, f));
// O móvel acende (luminária, abajur, lareira, tela): o Habbo desenha o brilho como camada "ADD".
const temBrilho = (dados) => Boolean(dados?.visualizations?.find?.((v) => v.size === 64) && Object.values(dados.visualizations.find((v) => v.size === 64).layers || {}).some((l) => l?.ink === 'ADD'));
export function moveisDoHabbo(classe, dir, estado = 0) {
  const chave = classe + '|' + dir + '|' + (Number(estado) || 0);
  if (!CACHE.has(chave)) CACHE.set(chave, (async () => {
    const salvo = await guardado.ler(chave);
    if (salvo?.blocos?.length) return salvo;
    const carregar = globalThis.mapaCarregarMovel; if (typeof carregar !== 'function') return null;
    const movel = await carregar(classe);
    const dados = movel?.dados; if (!dados) return null;
    const dim = dados.logic?.model?.dimensions || { x: 1, y: 1, z: 1 };
    const deLado = dir === 2 || dir === 6, W = Math.max(1, Number(deLado ? dim.y : dim.x) || 1), D = Math.max(1, Number(deLado ? dim.x : dim.y) || 1);
    const dirs = direcoesDesenhadas(dados);
    const fotos = new Map(dirs.map((d) => [d, vistaDaDirecao(movel, d, estado)]).filter(([, v]) => v));
    if (!fotos.size) return null;
    // Móvel de uma direção só (planta, tapete, globo, luminária): o Habbo o desenha igual de todos os lados, então a
    // mesma foto vale para as quatro voltas. Com várias, cada uma vale para a direção dela.
    const vistas = fotos.size === 1 ? [0, 2, 4, 6].map((d) => ({ ...[...fotos.values()][0], dir: d })) : [...fotos.values()];
    const base = fotos.get(dir) || null;
    const dirPeca = base ? dir : fotos.size === 1 ? dir : [...fotos.keys()][0];
    // No grão do motor de móveis (1/16 de ladrilho; 1/12 e 1/8 nas peças grandes), sem a casca fina: a casca de
    // cubinhos de 2 px parecia pixel art e fazia listras de luz ao aproximar (Paulo, 09/11/2026).
    const N = W * D > 9 ? 8 : W * D > 4 ? 12 : 16;
    // Casca no grão do mundo: um bloco a cada 2 px do Habbo (1/16 de ladrilho), em todas as peças.
    const e = await naFila(() => esculpir({ W, D, dir: dirPeca, vistas, N, alturaMax: Number(dim.z) || null, passoFino: 0, cores: 7 }));
    if (!e?.blocos?.length) return e;
    const r = { ...e, brilha: temBrilho(dados) };
    guardado.gravar(chave, r);
    return r;
  })().catch(() => null));
  return CACHE.get(chave);
}
// Para o motor de móveis modelados (moveis-voxel.mjs): as cores da arte do móvel (da mais usada para a menos
// usada, sem o contorno) e o tamanho dele no Habbo (x, y na direção 0/4; z, a altura). Sem montar escultura.
export function paletaDoHabbo(classe, dir = 4, estado = 0) {
  const chave = 'paleta|' + classe + '|' + dir + '|' + (Number(estado) || 0);
  if (!CACHE.has(chave)) CACHE.set(chave, (async () => {
    const carregar = globalThis.mapaCarregarMovel; if (typeof carregar !== 'function') return null;
    const movel = await carregar(classe); const dados = movel?.dados; if (!dados) return null;
    const dirs = direcoesDesenhadas(dados), v = vistaDaDirecao(movel, dirs.includes(dir) ? dir : dirs[0], estado); if (!v) return null;
    const lista = []; for (let y = 0; y < v.h; y += 2) for (let x = 0; x < v.w; x += 2) { const c = v.cor(x, y); if (c) lista.push(c); }
    const hex = (c) => '#' + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
    const dim = dados.logic?.model?.dimensions || { x: 1, y: 1, z: 1 };
    const W = Math.max(1, Number(dim.x) || 1), D = Math.max(1, Number(dim.y) || 1);
    return { paleta: paletaCurta(lista, 6).map(hex), dim: { x: W, y: D, z: Number(dim.z) || 1 }, ...perfilDaVista(v, W, D, hex) };
  })().catch(() => null));
  return CACHE.get(chave);
}
// Para a peça sem receita (moveis-voxel.mjs, "generico"): a altura que o desenho alcança e, em faixas do chão ao topo,
// quanto da pegada a peça ocupa naquela altura e a cor que mais aparece ali. Só medidas: nenhum pixel vira bloco.
// A peça de lado s × s ladrilhos projeta 64·s px de largura; o eixo dela fica em y = (W + D − 2)·8 px.
function perfilDaVista(v, W, D, hex) {
  const altura = Math.max(1 / 16, Math.min(10, (-16 - v.oy) / 32) * NIVEL_HABBO);
  const n = Math.max(1, Math.min(8, Math.round(altura / (3 / 16)))), eixo = (W + D - 2) * 8, larguraCheia = (W + D) * 32;
  const perfil = [];
  for (let k = 0; k < n; k++) {
    const y1 = Math.round(eixo - (k * altura / n / NIVEL_HABBO) * 32 - v.oy), y0 = Math.round(eixo - ((k + 1) * altura / n / NIVEL_HABBO) * 32 - v.oy);
    let x0 = Infinity, x1 = -1; const cores = [];
    for (let y = Math.max(0, y0); y < Math.min(v.h, Math.max(y1, y0 + 1)); y++) for (let x = 0; x < v.w; x++) {
      if (v.alfa(x, y) <= 40) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (!(x & 1) && !(y & 1)) { const c = v.cor(x, y); if (c) cores.push(c); }
    }
    const [c] = paletaCurta(cores, 1);
    perfil.push({ f: x1 < 0 ? 0 : Math.max(.12, Math.min(1, (x1 - x0 + 1) / larguraCheia)), cor: c ? hex(c) : null });
  }
  return { altura, perfil };
}
// Para a peça de parede montada pelo motor: o retângulo que o desenho ocupa no plano da parede (a ao longo dela a
// partir do apoio, em ladrilhos; h em níveis do Habbo) e as cores dele, da mais usada para a menos usada.
export function medidaDaPlaca(pl) {
  if (!pl?.blocos?.length) return null;
  let a0 = Infinity, a1 = -Infinity, h0 = Infinity, h1 = -Infinity; const conta = new Map();
  for (const b of pl.blocos) { a0 = Math.min(a0, b.a); a1 = Math.max(a1, b.a); h0 = Math.min(h0, b.h); h1 = Math.max(h1, b.h); conta.set(b.cor, (conta.get(b.cor) || 0) + 1); }
  return { a0: a0 - pl.lado / 2, a1: a1 + pl.lado / 2, h0: h0 - pl.lado / 2, h1: h1 + pl.lado / 2, paleta: [...conta].sort((x, y) => y[1] - x[1]).map(([c]) => c) };
}
// Cor que mais aparece num revestimento de parede do Habbo (a arte do móvel de parede), para a parede do quarto.
export function corDoRevestimento(classe) {
  const chave = 'revestimento|' + classe;
  if (!CACHE.has(chave)) CACHE.set(chave, (async () => {
    const carregar = globalThis.mapaCarregarMovel; if (typeof carregar !== 'function') return null;
    const v = vistaDaDirecao(await carregar(classe), 4, 0) || vistaDaDirecao(await carregar(classe), 2, 0); if (!v) return null;
    const lista = [];
    for (let y = 0; y < v.h; y += 2) for (let x = 0; x < v.w; x += 2) { const c = v.cor(x, y); if (c) lista.push(c); }
    const [c] = paletaCurta(lista, 1); if (!c) return null;
    return '#' + c.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  })().catch(() => null));
  return CACHE.get(chave);
}

// Peça de parede (quadro, janela, luminária de parede): o desenho vira uma placa fina de voxels no plano da parede.
// dir 4 = parede do fundo (plano de y fixo: o pixel anda (32, 16) por ladrilho ao longo dela); dir 2 = parede da
// esquerda (plano de x fixo: (−32, 16)). Subir 1 nível = 32 px para cima. Devolve blocos { a, h, cor } com a ao longo
// da parede e h para cima, em ladrilhos do mundo, já centrados em a e com a base em h = 0.
export function placaDaParede(vista, N = 12) {
  const s = 1 / N, lado = vista.dir === 2 ? -1 : 1, blocos = [];
  const tela = (a, h) => ({ x: lado * a * 32 - vista.ox, y: a * 16 - (h / NIVEL_HABBO) * 32 - vista.oy });
  // Limites: os quatro cantos do desenho voltam para o plano da parede.
  const as = [vista.ox, vista.ox + vista.w].map((x) => (lado * x) / 32);
  const a0 = Math.min(...as), a1 = Math.max(...as);
  const hs = [];
  for (const a of [a0, a1]) for (const y of [vista.oy, vista.oy + vista.h]) hs.push(((a * 16 - y) / 32) * NIVEL_HABBO);
  const h0 = Math.min(...hs), h1 = Math.max(...hs);
  for (let a = a0; a < a1; a += s) for (let h = h0; h < h1; h += s) {
    const p = tela(a + s / 2, h + s / 2), c = vista.cor(Math.floor(p.x), Math.floor(p.y));
    if (c) blocos.push({ a: a + s / 2, h: h + s / 2, cor: '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') });
  }
  if (!blocos.length) return null;
  const ma = blocos.reduce((m, b) => m + b.a, 0) / blocos.length, mh = Math.min(...blocos.map((b) => b.h));
  for (const b of blocos) { b.a -= ma; b.h -= mh; }
  return { lado: s, blocos, altura: Math.max(...blocos.map((b) => b.h)) + s };
}
// Peça de parede no lugar exato, pela mesma conta do mapa do Escritório (mapaAncoraParede e mapaTopoItemParede em
// vybe-escritorio-mapa.js): o desenho encosta no pé da parede no meio do ladrilho (parede do fundo: x + 0,5 na linha
// y; da esquerda: y + 0,5 na coluna x), sobe 46 px, não passa do teto da parede (altura da parede − 4 px) nem desce
// abaixo de 2 px do chão, e a altura escolhida pela pessoa sobe 32 px por unidade. Cada pixel vira um bloco no plano
// da parede: no fundo, andar 1 ladrilho move (32, 16) px; na esquerda, (−32, 16); subir 1 nível, 32 px.
// Devolve blocos { a, h, cor }: a ao longo da parede a partir do ponto de apoio (ladrilhos) e h em níveis do Habbo.
export function placaExata(vista, { altura = 0, alturaParede = 118, passo = 2 } = {}) {
  const lado = vista.dir === 2 ? -1 : 1, teto = -alturaParede + 4;
  let topo = Math.max(teto, vista.oy - 46);
  if (topo + vista.h > 2) topo = Math.max(teto, 2 - vista.h);
  topo -= (Number(altura) || 0) * 32;
  // No grão do mundo: um bloco a cada `passo` px, a cor da célula sem o contorno, na paleta curta da peça.
  const brutos = [];
  for (let py = 0; py < vista.h; py += passo) for (let px = 0; px < vista.w; px += passo) {
    let n = 0, r = 0, g = 0, b = 0;
    for (let y = py; y < Math.min(vista.h, py + passo); y++) for (let x = px; x < Math.min(vista.w, px + passo); x++) { const c = vista.cor(x, y); if (!c) continue; n++; r += c[0]; g += c[1]; b += c[2]; }
    if (n * 2 < passo * passo) continue;
    const sx = vista.ox + px + passo / 2, sy = topo + py + passo / 2;
    const a = (lado * sx) / 32, h = (a * 16 - sy) / 32;
    brutos.push({ a, h, c: [r / n, g / n, b / n], lx: px / passo, ly: py / passo });
  }
  chapar(brutos, 7);
  const blocos = brutos.map((q) => ({ a: q.a, h: q.h, cor: q.cor }));
  return { blocos, lado: passo / 32 };
}
export function placaDoHabbo(classe, dir, estado = 0, altura = 0, alturaParede = 118) {
  const chave = 'parede|' + classe + '|' + dir + '|' + (Number(estado) || 0) + '|' + altura + '|' + alturaParede;
  if (!CACHE.has(chave)) CACHE.set(chave, (async () => {
    const carregar = globalThis.mapaCarregarMovel; if (typeof carregar !== 'function') return null;
    const movel = await carregar(classe);
    const v = vistaDaDirecao(movel, dir === 2 ? 2 : 4, estado);
    return v ? placaExata(v, { altura, alturaParede }) : null;
  })().catch(() => null));
  return CACHE.get(chave);
}

// ---------- Boneco: o NOSSO boneco (desenharBoneco), vestido como o Habbo de cada pessoa ----------
// (Paulo, 09/11/2026: "os personagens de cada um têm que ser iguais ao Habbo, ex.: Vinícius com cabeça de cavalo...
// só que seguindo nosso estilo artístico".) O corpo é sempre o boneco voxel da Vybe; do Habbo vêm as cores e os
// acessórios de cabeça. O servidor já guarda o boneco do Habbo de cada figura (area=escritorio&acao=boneco).
// No desenho do Habbo (64 × 110, direção 2) as partes ficam em faixas fixas contadas a partir do pé (a última linha
// com pixel): rosto até 50 px acima do pé, camisa de 44 a 28, calça de 22 a 12, sapato de 7 a 2. O cabelo é o topo
// da cabeça no desenho SEM chapéu nem máscara (figura sem ha, he e fa).
const urlBoneco = (figura, dir) => '/api/painel?' + new URLSearchParams({ area: 'escritorio', acao: 'boneco', figura, dir: String(dir) });
const FIGURA = /^[a-z]{2}-\d+(-\d+){0,2}(\.[a-z]{2}-\d+(-\d+){0,2})*$/;
// Acessórios de cabeça: chapéu (ha), enfeite (he), máscara/rosto (fa) e óculos (ea), esculpidos da arte.
const ACESSORIOS = /^(ha|he|fa|ea)-/;
async function pixelsDoBoneco(figura, dir) {
  const img = new Image(); img.src = urlBoneco(figura, dir);
  await new Promise((ok, falha) => { img.onload = ok; img.onerror = () => falha(new Error('sem boneco')); });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, px: g.getImageData(0, 0, c.width, c.height).data };
}
const linhaDoPe = ({ w, h, px }) => { for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 40) return y; return -1; };
const linhaDoTopo = ({ w, h, px }) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 40) return y; return -1; };
// A cor que mais aparece numa faixa (sem o contorno escuro e sem o brilho branco), em hex.
export function corDaFaixa({ w, px }, y0, y1, x0 = 0, x1 = w) {
  const conta = new Map();
  for (let y = Math.max(0, y0); y <= y1; y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
    const i = (y * w + x) * 4; if (px[i + 3] <= 40) continue;
    const lum = px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11; if (lum < 30) continue;
    const k = '#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    conta.set(k, (conta.get(k) || 0) + 1);
  }
  let melhor = null, n = 0; for (const [k, c] of conta) if (c > n) { melhor = k; n = c; }
  return melhor;
}
// Só o acessório: o que o desenho com ele tem de diferente do desenho sem ele, na altura da cabeça.
function soAcessorio(com, sem, ate) {
  const px = new Uint8ClampedArray(com.px.length);
  for (let y = 0; y <= ate; y++) for (let x = 0; x < com.w; x++) {
    const i = (y * com.w + x) * 4; if (com.px[i + 3] <= 40) continue;
    const j = (y * sem.w + x) * 4;
    const igual = sem.px[j + 3] > 40 && Math.abs(com.px[i] - sem.px[j]) + Math.abs(com.px[i + 1] - sem.px[j + 1]) + Math.abs(com.px[i + 2] - sem.px[j + 2]) < 24;
    if (!igual) { px[i] = com.px[i]; px[i + 1] = com.px[i + 1]; px[i + 2] = com.px[i + 2]; px[i + 3] = 255; }
  }
  return { w: com.w, h: com.h, px };
}
// Braços (direção 2, 64 px de largura, corpo no meio): a faixa de fora do tronco, em cima (manga) e embaixo
// (antebraço). Igual à pele = braço de fora (manga curta ou regata); senão a cor da manga.
const perto = (a, b) => { if (!a || !b) return false; const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const [x, y] = [n(a), n(b)]; return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 60; };
export function bracosDoBoneco(img, pe, pele) {
  const lado = (y0, y1) => corDaFaixa(img, y0, y1, 12, 21) || corDaFaixa(img, y0, y1, 43, 52);
  const cima = lado(pe - 44, pe - 37), baixo = lado(pe - 34, pe - 27);
  return { manga: cima && !perto(cima, pele) ? cima : pele || null, antebraco: baixo && !perto(baixo, pele) ? baixo : pele || null };
}
export function figuraDoHabbo(figura) {
  const chave = 'figura|' + figura;
  if (!CACHE.has(chave)) CACHE.set(chave, (async () => {
    if (!FIGURA.test(String(figura || ''))) return null;
    const partes = String(figura).split('.');
    const semAcessorio = partes.filter((p) => !ACESSORIOS.test(p)).join('.');
    const temAcessorio = semAcessorio !== String(figura);
    const frente = await pixelsDoBoneco(figura, 2), nu = temAcessorio ? await pixelsDoBoneco(semAcessorio, 2) : frente;
    const pe = linhaDoPe(nu), topo = linhaDoTopo(nu), queixo = pe - 49; if (pe < 0 || topo < 0) return null;
    // Cada parte da figura vira a parte do boneco (Paulo, 09/11/2026: "trocar a cabeça, corpo, pernas, braços,
    // acessórios... cor da pele, cabelo"): pele (hd), cabelo (hr, cor e forma), camisa (ch), casaco (cc), mangas e
    // braços (o que a camisa/casaco cobre do braço), calça (lg), sapato (sh) e os acessórios de cabeça.
    const temCabelo = partes.some((p) => p.startsWith('hr-')), temCasaco = partes.some((p) => p.startsWith('cc-'));
    const pele = corDaFaixa(nu, queixo - 12, queixo - 2, 22, 44);
    const semCasaco = temCasaco ? await pixelsDoBoneco(partes.filter((p) => !/^cc-/.test(p) && !ACESSORIOS.test(p)).join('.'), 2).catch(() => null) : null;
    const cores = {
      pele,
      cabelo: temCabelo ? corDaFaixa(nu, topo, topo + 10, 16, 48) : null,
      roupa: corDaFaixa(semCasaco || frente, pe - 44, pe - 28, 26, 38) || corDaFaixa(frente, pe - 44, pe - 28, 20, 44),
      casaco: temCasaco ? corDaFaixa(frente, pe - 44, pe - 28, 18, 28) : null,
      calca: corDaFaixa(frente, pe - 22, pe - 12, 22, 42),
      tenis: corDaFaixa(frente, pe - 7, pe - 2, 22, 44),
      ...bracosDoBoneco(frente, pe, pele),
    };
    // Forma do cabelo: o que a figura tem a mais que a mesma figura careca, de frente e de perfil, como os acessórios.
    let cabeloHabbo = null;
    if (temCabelo) {
      try {
        const careca = partes.filter((p) => !/^hr-/.test(p) && !ACESSORIOS.test(p)).join('.');
        const [cf, cs, pf, ps] = await Promise.all([pixelsDoBoneco(semAcessorio, 3), pixelsDoBoneco(careca, 3), pixelsDoBoneco(semAcessorio, 1), pixelsDoBoneco(careca, 1)]);
        const ate = (nu2) => linhaDoPe(nu2) - 22; // até o peito: cabelo comprido desce pelos ombros
        cabeloHabbo = acessorioDeFrenteEPerfil({ frente: soAcessorio(cf, cs, ate(cs)), frenteNu: cs, perfil: soAcessorio(pf, ps, ate(ps)), perfilNu: ps }, 2, { escala: .74 * 1.08 });
      } catch { /* sem as fotos: o cabelo de blocos do boneco */ }
    }
    let acessorio = null;
    if (temAcessorio) {
      try {
        const [fc, fs, sc, ss] = await Promise.all([pixelsDoBoneco(figura, 3), pixelsDoBoneco(semAcessorio, 3), pixelsDoBoneco(figura, 1), pixelsDoBoneco(semAcessorio, 1)]);
        acessorio = acessorioDeFrenteEPerfil({ frente: soAcessorio(fc, fs, linhaDoPe(fs) - 46), frenteNu: fs, perfil: soAcessorio(sc, ss, linhaDoPe(ss) - 46), perfilNu: ss });
      } catch { /* sem as fotos: boneco sem o acessório */ }
    }
    return { cores, acessorio, cabeloHabbo };
  })().catch(() => null));
  return CACHE.get(chave);
}

// Acessório de cabeça em voxels, na escala da NOSSA cabeça (largura 0,78, altura 0,74, queixo em 0,92, frente em +z).
// Da foto de frente (direção 3) saem x e y; da de perfil (direção 1, olhando para a direita da imagem) saem z e y.
// Fica o bloco que aparece nas duas; a cor é a da frente na face da frente e a do perfil nos lados.
export function acessorioDeFrenteEPerfil({ frente, frenteNu, perfil, perfilNu }, passo = 2, { escala = 0 } = {}) {
  const caixa = (img) => { let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return x1 < 0 ? null : { x0, x1, y0, y1 }; };
  const cabecaDe = (nu) => { const pe = linhaDoPe(nu), topo = linhaDoTopo(nu), queixo = pe - 49; let x0 = Infinity, x1 = -1; for (let y = topo; y <= queixo; y++) for (let x = 0; x < nu.w; x++) if (nu.px[(y * nu.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } return { topo, queixo, cx: (x0 + x1) / 2, largura: Math.max(8, x1 - x0 + 1) }; };
  const cf = cabecaDe(frenteNu), cp = cabecaDe(perfilNu), af = caixa(frente), ap = caixa(perfil);
  if (!af || !ap) return null;
  // A cabeça do Habbo com o cabelo cabe na nossa com o cabelo (largura 0,86, profundidade 0,8, do queixo 0,92 ao topo
  // do cabelo 1,82), com 8% de folga para o acessório ficar por fora dela.
  // Uma escala só nos três eixos (o pixel do Habbo é quadrado), pela altura da cabeça: o acessório mantém a forma
  // (um focinho comprido continua comprido, sem esticar para caber na nossa cabeça quadrada).
  // Máscara (cobre quase toda a cabeça, como a de cavalo) entra NO LUGAR da cabeça: vai do tamanho da cabeça sem o
  // cabelo (0,74). Chapéu e enfeite ficam por cima do cabelo: cabeça com cabelo (0,9) e 8% de folga.
  const alfa0 = (img, x, y) => (x >= 0 && y >= 0 && x < img.w && y < img.h ? img.px[(y * img.w + x) * 4 + 3] : 0);
  let n0 = 0, c0 = 0;
  for (let y = cf.topo; y <= cf.queixo; y++) for (let x = 0; x < frenteNu.w; x++) if (alfa0(frenteNu, x, y) > 40) { n0++; if (alfa0(frente, x, y) > 40) c0++; }
  const cobre = n0 ? c0 / n0 : 0, mascara = cobre > .55;
  // escala: medida fixa (o cabelo vai do tamanho da cabeça careca, com folga para ficar por fora dela).
  const ky = (escala || (mascara ? .74 : .9 * 1.08)) / Math.max(10, cf.queixo - cf.topo), kx = ky, kz = ky;
  const alfa = (img, x, y) => (x >= 0 && y >= 0 && x < img.w && y < img.h ? img.px[(y * img.w + x) * 4 + 3] : 0);
  const cor = (img, x, y) => corSemContorno(img.px, img.w, img.h, x, y);
  // Linha da foto → altura no boneco: o queixo de cada foto vai para 0,92.
  const blocos = [], cheio = new Set(), chave = (i, j, l) => i + ',' + j + ',' + l;
  const lista = [];
  for (let y = Math.min(af.y0, ap.y0); y <= Math.max(af.y1, ap.y1); y += passo) {
    // A mesma altura nas duas fotos: o perfil é lido na linha que corresponde à mesma altura.
    const yp = Math.round(cp.queixo - (cf.queixo - y));
    for (let x = af.x0; x <= af.x1; x += passo) {
      if (alfa(frente, x, y) <= 40) continue;
      for (let z = ap.x0; z <= ap.x1; z += passo) {
        if (alfa(perfil, z, yp) <= 40) continue;
        const i = Math.round((x - cf.cx) / passo), j = Math.round((cf.queixo - y) / passo), l = Math.round((z - cp.cx) / passo);
        cheio.add(chave(i, j, l)); lista.push({ i, j, l, x, y, z, yp });
      }
    }
  }
  if (lista.length < 4) return null;
  const tem = (i, j, l) => cheio.has(chave(i, j, l));
  const lmax = new Map(); for (const q of lista) { const c = q.i + ',' + q.j; lmax.set(c, Math.max(lmax.get(c) ?? -Infinity, q.l)); }
  for (const q of lista) {
    const { i, j, l } = q;
    if (tem(i + 1, j, l) && tem(i - 1, j, l) && tem(i, j + 1, l) && tem(i, j - 1, l) && tem(i, j, l + 1) && tem(i, j, l - 1)) continue;
    const naFrente = l >= lmax.get(i + ',' + j) - 1;
    const c = (naFrente ? cor(frente, q.x, q.y) : cor(perfil, q.z, q.yp)) || cor(frente, q.x, q.y) || cor(perfil, q.z, q.yp) || [128, 128, 128];
    blocos.push({ x: i * passo * kx, y: .92 + j * passo * ky - passo * ky / 2, z: l * passo * kz, cor: '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') });
  }
  return { lado: passo * Math.max(kx, ky, kz), lados: [passo * kx, passo * ky, passo * kz], cobre, blocos };
}
