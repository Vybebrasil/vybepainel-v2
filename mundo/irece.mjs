// Irecê em voxel: relevo real (Terrain Tiles), ruas e lugares reais (OpenStreetMap),
// casas e árvores em InstancedMesh. Unidade do mundo = 1 célula = 10 m.
import * as THREE from 'three';
import { materialVoxel, voxelizar } from './voxel.mjs';

export const ruido = (x, z) => (((Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)) >>> 0) % 1000) / 1000;
const COR = (h) => new THREE.Color(h);
const PASSO_M = 3;          // um degrau a cada 3 m de altitude
const ALTURA_DEGRAU = 0.28; // relevo um pouco exagerado (Irecê é quase plana; degrau alto riscava as ruas de marrom)
// Recorte: o Centro de Irecê com TODOS os clientes ativos (de ACE e Serra Grande ao sul até DiaLab ao norte,
// da Vybe a oeste até Lions e DiaCenter a leste). Menor que a cidade inteira para caber mais detalhe.
// Centro do disco: perto da Vybe (R. São Francisco), de modo que todos os clientes ativos caibam no raio.
export const CENTRO_RECORTE = { x: -36, z: 12 };
const RAIO = 126;           // raio do disco da maquete, em células (1 célula = 10 m)

export function construirIrece(motor, dados, { reservas = {}, comercios = [] } = {}) {
  const { w: GW, h: GH } = dados;
  const alt8 = Uint8Array.from(atob(dados.alt), (c) => c.charCodeAt(0));
  const cx = GW / 2, cz = GH / 2;
  const idx = (gx, gz) => gz * GW + gx;
  const dentro = (gx, gz) => gx >= 0 && gz >= 0 && gx < GW && gz < GH && (gx - cx - CENTRO_RECORTE.x) ** 2 + (gz - cz - CENTRO_RECORTE.z) ** 2 < RAIO * RAIO;

  // ----- Ruas: rasterizar as linhas com a largura de cada tipo -----
  const rua = new Uint8Array(GW * GH); // 0 nada, 1..4 largura
  for (const r of dados.ruas) {
    const raio = r.l * 0.42, peso = Math.min(4, Math.max(1, Math.round(r.l)));
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const [x0, z0, x1, z1] = [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3]];
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2) + 1;
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n;
        for (let gz = Math.floor(z - raio); gz <= Math.ceil(z + raio); gz++)
          for (let gx = Math.floor(x - raio); gx <= Math.ceil(x + raio); gx++) {
            if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) continue;
            if ((gx + .5 - x) ** 2 + (gz + .5 - z) ** 2 <= raio * raio + .2) rua[idx(gx, gz)] = Math.max(rua[idx(gx, gz)], peso);
          }
      }
    }
  }
  // ----- Áreas (praça, água, igreja, escola…) -----
  const area = new Uint8Array(GW * GH); // 1 praça, 2 água, 3 prédio público
  const TIPO = { praca: 1, agua: 2 };
  const lugares = [];
  for (const a of dados.areas) {
    const t = TIPO[a.t] || 3, xs = [], zs = [];
    for (let i = 0; i < a.p.length; i += 2) { xs.push(a.p[i]); zs.push(a.p[i + 1]); }
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    let cel = 0;
    for (let gz = Math.floor(z0); gz <= z1; gz++) for (let gx = Math.floor(x0); gx <= x1; gx++) {
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) continue;
      let in_ = false;
      for (let i = 0, j = xs.length - 1; i < xs.length; j = i++)
        if ((zs[i] > gz + .5) !== (zs[j] > gz + .5) && gx + .5 < (xs[j] - xs[i]) * (gz + .5 - zs[i]) / (zs[j] - zs[i]) + xs[i]) in_ = !in_;
      if (in_ && !rua[idx(gx, gz)]) { area[idx(gx, gz)] = t; cel++; }
    }
    if (a.n && cel > 2) lugares.push({ nome: a.n, tipo: a.t, x: (x0 + x1) / 2 - cx, z: (z0 + z1) / 2 - cz });
  }
  // ----- Mancha urbana: onde há rua por perto -----
  const somaRua = new Float32Array(GW * GH);
  const R = 6;
  { const linha = new Float32Array(GW * GH);
    for (let gz = 0; gz < GH; gz++) { let s = 0; for (let gx = -R; gx < GW; gx++) { if (gx + R < GW) s += rua[idx(gx + R, gz)] ? 1 : 0; if (gx - R - 1 >= 0) s -= rua[idx(gx - R - 1, gz)] ? 1 : 0; if (gx >= 0) linha[idx(gx, gz)] = s; } }
    for (let gx = 0; gx < GW; gx++) { let s = 0; for (let gz = -R; gz < GH; gz++) { if (gz + R < GH) s += linha[idx(gx, gz + R)]; if (gz - R - 1 >= 0) s -= linha[idx(gx, gz - R - 1)]; if (gz >= 0) somaRua[idx(gx, gz)] = s / ((2 * R + 1) ** 2); } } }
  const urbano = (gx, gz) => somaRua[idx(gx, gz)] > 0.075;

  // ----- Reservas: o terreno do Prédio da Vybe e os lotes dos clientes -----
  // Procura quadrados sem rua nem praça; o prédio o mais perto do centro, os
  // clientes em anéis à volta dele, no meio da cidade de verdade.
  const quadradoLivre = (gx0, gz0, r, folga = 0) => {
    for (let gz = gz0 - r - folga; gz <= gz0 + r + folga; gz++) for (let gx = gx0 - r - folga; gx <= gx0 + r + folga; gx++) {
      if (!dentro(gx, gz)) return false;
      const i = idx(gx, gz); if (rua[i] || area[i] || reservado0[i]) return false;
    }
    return true;
  };
  const reservado0 = new Uint8Array(GW * GH);
  const marcar = (gx0, gz0, r) => { for (let gz = gz0 - r; gz <= gz0 + r; gz++) for (let gx = gx0 - r; gx <= gx0 + r; gx++) reservado0[idx(gx, gz)] = 1; };
  // Terrenos dos marcos (Prefeitura, Catedral, Estádio…): reservados antes do prédio e dos lotes.
  for (const m of reservas.marcos || []) { const gx = Math.round(m.x + cx), gz = Math.round(m.z + cz); if (dentro(gx, gz)) marcar(gx, gz, m.r); }
  if (reservas.predio) {
    const p = reservas.predio; let achou = p.exato ? [Math.round(cx + p.x), Math.round(cz + p.z)] : null; // endereço conferido: fica exatamente lá
    for (let raio = 0; raio < 120 && !achou; raio++) for (let a = 0; a < Math.max(1, raio * 8) && !achou; a++) {
      const ang = a / Math.max(1, raio * 8) * Math.PI * 2, gx = Math.round(cx + p.x + Math.cos(ang) * raio), gz = Math.round(cz + p.z + Math.sin(ang) * raio);
      if (quadradoLivre(gx, gz, p.r)) achou = [gx, gz];
    }
    if (achou) { marcar(achou[0], achou[1], p.r); reservas.predio.achado = { x: achou[0] - cx, z: achou[1] - cz, r: p.r }; }
  }
  if (reservas.lotes) {
    const L = reservas.lotes, base = reservas.predio?.achado || { x: 0, z: 0 }, achados = [];
    for (let raio = L.raioMin; raio < L.raioMax && achados.length < L.quantos; raio += 2) {
      const passos = Math.floor(2 * Math.PI * raio / (L.r * 2 + 4));
      for (let a = 0; a < passos && achados.length < L.quantos; a++) {
        const ang = (a + (raio % 3) * .33) / passos * Math.PI * 2;
        const gx = Math.round(cx + base.x + Math.cos(ang) * raio), gz = Math.round(cz + base.z + Math.sin(ang) * raio);
        if (quadradoLivre(gx, gz, L.r, L.folga ?? 1)) { marcar(gx, gz, L.r); achados.push({ x: gx - cx, z: gz - cz, r: L.r, ang }); }
      }
    }
    reservas.lotes.achados = achados;
  }
  const lista = [...(reservas.predio?.achado ? [reservas.predio.achado] : []), ...(reservas.lotes?.achados || []), ...(reservas.marcos || [])];

  // ----- Alturas em degraus, com platôs nas reservas -----
  const nivel = new Int16Array(GW * GH);
  for (let i = 0; i < nivel.length; i++) nivel[i] = Math.round(alt8[i] / 255 * (dados.max - dados.min) / PASSO_M);
  const reservado = new Uint8Array(GW * GH);
  for (const r of lista) {
    const gx0 = Math.round(r.x + cx), gz0 = Math.round(r.z + cz), base = nivel[idx(gx0, gz0)];
    for (let gz = gz0 - r.r - 4; gz <= gz0 + r.r + 4; gz++) for (let gx = gx0 - r.r - 4; gx <= gx0 + r.r + 4; gx++) {
      if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) continue;
      const d = Math.max(Math.abs(gx - gx0), Math.abs(gz - gz0));
      if (d <= r.r) { nivel[idx(gx, gz)] = base; reservado[idx(gx, gz)] = 1; }
      else { const k = (d - r.r) / 4; nivel[idx(gx, gz)] = Math.round(base + (nivel[idx(gx, gz)] - base) * k); }
    }
  }
  let nivelMin = Infinity;
  for (let i = 0; i < nivel.length; i++) if (nivel[i] < nivelMin && dentro(i % GW, (i / GW) | 0)) nivelMin = nivel[i];
  // O chão do Prédio da Vybe é a altura zero do mundo (a câmera e o clique usam y = 0).
  const nivelBase = reservas.predio?.achado ? nivel[idx(Math.round(reservas.predio.achado.x + cx), Math.round(reservas.predio.achado.z + cz))] : nivelMin;
  const Y = (n) => (n - nivelBase) * ALTURA_DEGRAU;
  const FUNDO = Y(nivelMin) - 7;
  const alturaEm = (x, z) => { const gx = Math.round(x + cx), gz = Math.round(z + cz); return gx >= 0 && gz >= 0 && gx < GW && gz < GH ? Y(nivel[idx(gx, gz)]) : 0; };

  // ----- Cor de cada célula -----
  const C = {
    ruaGrande: COR('#8E8B85'), rua: COR('#ABA69C'), terraRua: COR('#CDB98F'), calcada: COR('#E9E1CC'), lote: COR('#E2D8C0'), quintal: COR('#C3CD93'), terra: COR('#D6C49B'),
    praca: COR('#79C267'), agua: COR('#3FB4C7'), publico: COR('#E9E1CF'), reserva: COR('#EFE8D8'),
    campos: ['#A8D27A', '#BBD98F', '#CFE3A0', '#C9B97C', '#8FBF63', '#B5CF7F', '#D6C68F'].map(COR),
    mata: COR('#6FB35C'), mataAlta: COR('#4F9A4E'),
  };
  const corCelula = (gx, gz) => {
    const i = idx(gx, gz), n = ruido(gx, gz);
    if (reservado[i]) return C.reserva;
    if (rua[i]) return urbano(gx, gz) ? C.calcada : C.terraRua;
    if (area[i] === 2) return C.agua;
    if (area[i] === 1) return C.praca;
    if (area[i] === 3) return C.publico;
    if (urbano(gx, gz)) { const q = ruido((gx >> 1) + 31, (gz >> 1) + 17); return q < .2 ? C.quintal : q < .28 ? C.terra : n < .12 ? C.calcada : C.lote; }
    const talhao = ruido(gx >> 4, gz >> 4) * C.campos.length | 0;
    if (ruido((gx >> 3) + 7, (gz >> 3) + 3) < .18) return n < .5 ? C.mata : C.mataAlta;
    return C.campos[talhao];
  };

  // ----- Chão em alta resolução (Paulo, 07/11/2026: "as ruas e detalhes muito longe do esperado") -----
  // Antes, 1 pixel = 10 m: lotes e ruas viravam manchas. Agora o disco da maquete é uma imagem de 8 pixels por célula
  // (1,25 m, o tamanho do cubinho): a cor de cada quadra embaixo e, por cima, as ruas no traçado real (calçada, meio-fio,
  // asfalto ou paralelepípedo, faixas e faixa de pedestre), os quintais e os telhados vistos de cima (a cidade de longe).
  const PX = 8;
  const bx0 = Math.max(0, Math.floor(cx + CENTRO_RECORTE.x - RAIO - 3)), bz0 = Math.max(0, Math.floor(cz + CENTRO_RECORTE.z - RAIO - 3));
  const bx1 = Math.min(GW, Math.ceil(cx + CENTRO_RECORTE.x + RAIO + 3)), bz1 = Math.min(GH, Math.ceil(cz + CENTRO_RECORTE.z + RAIO + 3));
  const BW = bx1 - bx0, BH = bz1 - bz0;
  const tela = document.createElement('canvas'); tela.width = BW * PX; tela.height = BH * PX;
  const g2 = tela.getContext('2d');
  const tmp = new THREE.Color();
  const nv = (gx, gz) => (dentro(gx, gz) ? nivel[idx(gx, gz)] : -9999);
  {
    const miuda = document.createElement('canvas'); miuda.width = BW; miuda.height = BH;
    const mc = miuda.getContext('2d'), im = mc.createImageData(BW, BH);
    for (let gz = bz0; gz < bz1; gz++) for (let gx = bx0; gx < bx1; gx++) {
      if (!dentro(gx, gz)) continue;
      const n0 = nivel[idx(gx, gz)];
      tmp.copy(corCelula(gx, gz)).offsetHSL(0, 0, (ruido(gx * 3, gz * 7) - .5) * .04);
      // Sombra do canto: quadra ao pé de um degrau mais alto fica mais escura.
      let alto = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (nv(gx + a, gz + b) > n0) alto++;
      const k = [1, .86, .76, .7, .66][alto], o = ((gz - bz0) * BW + gx - bx0) * 4;
      im.data[o] = Math.min(255, tmp.r * 255 * k); im.data[o + 1] = Math.min(255, tmp.g * 255 * k); im.data[o + 2] = Math.min(255, tmp.b * 255 * k); im.data[o + 3] = 255;
    }
    mc.putImageData(im, 0, 0);
    g2.imageSmoothingEnabled = false; g2.drawImage(miuda, 0, 0, BW * PX, BH * PX);
  }
  const imagem = new THREE.CanvasTexture(tela);
  imagem.flipY = false; imagem.magFilter = THREE.NearestFilter; imagem.minFilter = THREE.LinearMipmapLinearFilter; imagem.generateMipmaps = true;
  imagem.colorSpace = THREE.SRGBColorSpace; imagem.anisotropy = 8;
  // Mundo (x, z) → pixel da imagem; pintar uma célula; um retângulo girado (telhado, quintal) visto de cima.
  const PXx = (x) => (x + cx - bx0) * PX, PXz = (z) => (z + cz - bz0) * PX;
  const hex = (c) => '#' + c.getHexString();
  const pinta = (gx, gz, c, k = 1) => { g2.fillStyle = hex(tmp.copy(c).multiplyScalar(k)); g2.fillRect((gx - bx0) * PX, (gz - bz0) * PX, PX, PX); };
  const pintaRet = (x, z, w, d, rot, cor) => { g2.save(); g2.translate(PXx(x), PXz(z)); g2.rotate(-rot); g2.fillStyle = cor; g2.fillRect(-w / 2 * PX, -d / 2 * PX, w * PX, d * PX); g2.restore(); };
  g2.save(); g2.beginPath(); g2.arc(PXx(CENTRO_RECORTE.x), PXz(CENTRO_RECORTE.z), (RAIO - 1.2) * PX, 0, Math.PI * 2); g2.clip(); // nada passa da moldura

  const pos = [], uv = [], ind = [];
  const topo = (x0, z0, x1, z1, y) => { // retângulo plano (em células)
    const b = pos.length / 3;
    pos.push(x0 - cx, y, z0 - cz, x0 - cx, y, z1 - cz, x1 - cx, y, z1 - cz, x1 - cx, y, z0 - cz);
    uv.push((x0 - bx0) / BW, (z0 - bz0) / BH, (x0 - bx0) / BW, (z1 - bz0) / BH, (x1 - bx0) / BW, (z1 - bz0) / BH, (x1 - bx0) / BW, (z0 - bz0) / BH);
    ind.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // Retângulos gulosos por nível: anda na linha, estende para baixo enquanto a faixa inteira for do mesmo nível.
  const usado = new Uint8Array(GW * GH);
  for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
    const i0 = idx(gx, gz); if (usado[i0] || !dentro(gx, gz)) continue;
    const n0 = nivel[i0];
    let w = 1; while (gx + w < GW && !usado[idx(gx + w, gz)] && dentro(gx + w, gz) && nivel[idx(gx + w, gz)] === n0) w++;
    let h = 1, ok = true;
    while (ok && gz + h < GH) { for (let k = 0; k < w; k++) { const ii = idx(gx + k, gz + h); if (usado[ii] || !dentro(gx + k, gz + h) || nivel[ii] !== n0) { ok = false; break; } } if (ok) h++; }
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) usado[idx(gx + a, gz + b)] = 1;
    topo(gx, gz, gx + w, gz + h, Y(n0));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ind); geo.computeVertexNormals();
  const terreno = new THREE.Mesh(geo, voxelizar(new THREE.MeshStandardMaterial({ map: imagem, roughness: .92 }), { amp: .16, grade: .6, borda: false }));
  terreno.receiveShadow = true;
  motor.adicionar(terreno);
  // Paredes dos degraus em faixas: junta as quadras vizinhas com o mesmo degrau (cor de terra/pedra).
  {
    const pp = [], cc = [], ii = []; let v = 0;
    const terra = [COR('#C4A97E'), COR('#B99D72'), COR('#CDB287')], pedra = COR('#7F776C');
    const parede = (ax, az, bx, bz, ya, yb, c, sombra) => {
      pp.push(ax - cx, ya, az - cz, ax - cx, yb, az - cz, bx - cx, yb, bz - cz, bx - cx, ya, bz - cz);
      for (const k of [1, sombra, sombra, 1]) cc.push(c.r * k, c.g * k, c.b * k);
      ii.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    };
    // faces voltadas para +x/-x (varre colunas) e +z/-z (varre linhas)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const linhas = dx ? GW : GH, ao = dx ? GH : GW;
      for (let L = 0; L < linhas; L++) {
        let k = 0;
        while (k < ao) {
          const gx = dx ? L : k, gz = dx ? k : L;
          const n0 = nv(gx, gz), nb = nv(gx + dx, gz + dz);
          if (n0 === -9999 || nb >= n0 || nb === -9999) { k++; continue; } // borda externa: a moldura redonda cobre
          let fim = k + 1;
          while (fim < ao) { const gx2 = dx ? L : fim, gz2 = dx ? fim : L; if (nv(gx2, gz2) !== n0 || nv(gx2 + dx, gz2 + dz) !== nb) break; fim++; }
          const ya = Y(n0), yb = nb === -9999 ? FUNDO : Y(nb), cor2 = nb === -9999 ? pedra : terra[(L + k) % 3];
          if (dx === 1) parede(L + 1, fim, L + 1, k, ya, yb, cor2, .7);
          else if (dx === -1) parede(L, k, L, fim, ya, yb, cor2, .7);
          else if (dz === 1) parede(k, L + 1, fim, L + 1, ya, yb, cor2, .7);
          else parede(fim, L, k, L, ya, yb, cor2, .7);
          k = fim;
        }
      }
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    g2.setIndex(ii); g2.computeVertexNormals();
    const paredes = new THREE.Mesh(g2, voxelizar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide }), { amp: .16, grade: 1, borda: false }));
    paredes.receiveShadow = true; motor.adicionar(paredes);
    // De longe os degraus quase não aparecem: as paredes só entram com a câmera mais baixa.
    motor.animar(() => { const ver = motor.camera.position.y < 230, mudou = ver !== paredes.visible; paredes.visible = ver; return mudou; });
  }

  // Moldura da maquete: um aro liso em volta do disco (antes a borda era em degraus de 10 m, serrilhada).
  {
    const N = 480, Rin = RAIO - 1.2, Rout = RAIO + 1, hs = [];
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      let h = -Infinity; for (const r of [RAIO - 2, RAIO - 1.3, RAIO - .6, RAIO]) h = Math.max(h, alturaEm(CENTRO_RECORTE.x + c * r, CENTRO_RECORTE.z + s2 * r));
      hs.push(h);
    }
    const alto = hs.map((_, k) => Math.max(hs[(k + N - 1) % N], hs[k], hs[(k + 1) % N]) + .08);
    const pos = [], cor = [], ind = []; let v = 0;
    const borda = COR('#EFE7D6'), terraAlta = COR('#A97C4E'), terraBaixa = COR('#5E4532');
    for (let k = 0; k <= N; k++) {
      const a = k / N * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a), y = alto[k % N];
      const ix = CENTRO_RECORTE.x + c * Rin, iz = CENTRO_RECORTE.z + s2 * Rin, ox = CENTRO_RECORTE.x + c * Rout, oz = CENTRO_RECORTE.z + s2 * Rout;
      pos.push(ix, y, iz, ox, y, oz, ox, y, oz, ox, FUNDO, oz);
      for (const q of [borda, borda, terraAlta, terraBaixa]) cor.push(q.r, q.g, q.b);
      if (k) { const b = v - 4; ind.push(b, b + 4, b + 5, b, b + 5, b + 1, b + 2, b + 6, b + 7, b + 2, b + 7, b + 3); }
      v += 4;
    }
    const g3 = new THREE.BufferGeometry();
    g3.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g3.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    g3.setIndex(ind); g3.computeVertexNormals();
    const aro = new THREE.Mesh(g3, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide }));
    aro.receiveShadow = true; motor.adicionar(aro);
  }

  // Água "respirando".
  const matAgua = new THREE.MeshStandardMaterial({ color: '#3FB4C7', transparent: true, opacity: .82, roughness: .25, metalness: .1 });
  const celulasAgua = [];
  for (let i = 0; i < area.length; i++) if (area[i] === 2 && dentro(i % GW, (i / GW) | 0)) celulasAgua.push(i);
  if (celulasAgua.length) {
    const agua = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .2, 1), matAgua, celulasAgua.length);
    const m = new THREE.Matrix4();
    celulasAgua.forEach((i, k) => { const gx = i % GW, gz = (i / GW) | 0; m.makeTranslation(gx - cx + .5, Y(nivel[i]) + .12, gz - cz + .5); agua.setMatrixAt(k, m); });
    motor.adicionar(agua);
    motor.animar((t) => { matAgua.opacity = .78 + Math.sin(t * 1.4) * .05; return motor.emVista(agua); });
  }

  // ----- Ruas no chão, no traçado real do OpenStreetMap -----
  // Desenhadas em camadas sobre a imagem (calçada → meio-fio → leito → faixas), com pontas e juntas redondas: as esquinas
  // fecham limpas, sem os borrões das faixas sobrepostas de antes. Centro: asfalto; bairros: paralelepípedo; roça: terra.
  const CALCADA = .22;                                   // 2,2 m de calçada de cada lado
  const meiaRua = (r) => Math.max(.3, r.l * .4);          // meia largura do leito, em células
  const centroX = CENTRO_RECORTE.x, centroZ = CENTRO_RECORTE.z;
  const ruasNoDisco = dados.ruas.filter((r) => r.p.some((_, k) => k % 2 === 0 && dentro(Math.floor(r.p[k]), Math.floor(r.p[k + 1]))));
  const infoRua = (r) => {
    const m = Math.floor(r.p.length / 4) * 2, gx = Math.floor(r.p[m]), gz = Math.floor(r.p[m + 1]);
    const urb = dentro(gx, gz) && urbano(gx, gz), dc = Math.hypot(r.p[m] - cx - centroX, r.p[m + 1] - cz - centroZ);
    const tipo = !urb && r.l < 2.4 ? 'terra' : r.l >= 2.8 ? 'avenida' : r.l >= 2 || dc < 55 ? 'asfalto' : 'pedra';
    return { urb, tipo, hw: meiaRua(r) };
  };
  const infos = new Map(ruasNoDisco.map((r) => [r, infoRua(r)]));
  const linha = (r, larg, cor, tracejado = null) => {
    g2.beginPath();
    for (let i = 0; i + 1 < r.p.length; i += 2) { const X = (r.p[i] - bx0) * PX, Z = (r.p[i + 1] - bz0) * PX; if (i) g2.lineTo(X, Z); else g2.moveTo(X, Z); }
    g2.lineWidth = larg * PX; g2.strokeStyle = cor; g2.lineCap = tracejado ? 'butt' : 'round'; g2.lineJoin = 'round';
    g2.setLineDash(tracejado ? tracejado.map((v) => v * PX) : []); g2.stroke();
  };
  const LEITO = { avenida: '#55595D', asfalto: '#676B6F', pedra: '#8B847A', terra: '#C9AE80' };
  for (const [r, f] of infos) if (f.urb && f.tipo !== 'terra') linha(r, (f.hw + CALCADA) * 2, '#E3DBC7');        // calçada
  for (const [r, f] of infos) if (f.urb && f.tipo !== 'terra') linha(r, f.hw * 2 + .1, '#B9B1A0');                 // meio-fio
  for (const [r, f] of infos) linha(r, f.hw * 2, LEITO[f.tipo]);                                                    // leito
  for (const [r, f] of infos) {
    if (f.tipo === 'avenida' && r.l >= 3.4) { linha(r, .7, '#D9D2C2'); linha(r, .58, '#7DB35C'); }                  // canteiro central
    else if (f.tipo === 'avenida') { linha(r, .17, '#F2C230'); linha(r, .05, LEITO.avenida); }                       // faixa dupla amarela
    else if (f.tipo === 'asfalto' && r.l >= 1.5) linha(r, .05, '#ECEBE6', [.9, .8]);                                  // tracejado branco
  }
  g2.setLineDash([]);
  // Faixa de pedestre perto das esquinas do centro (onde duas ruas se encontram).
  {
    const pontas = new Map(), chave = (x, z) => Math.round(x * 4) + ',' + Math.round(z * 4);
    for (const r of ruasNoDisco) for (let i = 0; i < r.p.length; i += 2) { const k = chave(r.p[i], r.p[i + 1]); pontas.set(k, (pontas.get(k) || 0) + 1); }
    g2.fillStyle = '#F1EFE8';
    for (const [r, f] of infos) {
      if (!f.urb || f.tipo === 'terra' || f.tipo === 'pedra' || r.p.length < 4) continue;
      for (const ponta of [0, r.p.length - 2]) {
        if ((pontas.get(chave(r.p[ponta], r.p[ponta + 1])) || 0) < 2) continue;
        const viz = ponta ? ponta - 2 : 2, dx = r.p[viz] - r.p[ponta], dz = r.p[viz + 1] - r.p[ponta + 1], L = Math.hypot(dx, dz);
        if (L < 1.6 || Math.hypot(r.p[ponta] - cx - centroX, r.p[ponta + 1] - cz - centroZ) > 70) continue;
        const ux = dx / L, uz = dz / L, px = r.p[ponta] + ux * 1.05, pz = r.p[ponta + 1] + uz * 1.05;
        g2.save(); g2.translate((px - bx0) * PX, (pz - bz0) * PX); g2.rotate(Math.atan2(uz, ux));
        for (let k = -f.hw + .04; k < f.hw - .06; k += .17) g2.fillRect(-.16 * PX, k * PX, .32 * PX, .085 * PX);
        g2.restore();
      }
    }
  }
  // Índice dos trechos de rua por célula: casa, árvore e poste conferem a distância até o leito + calçada de verdade.
  const trechos = new Map(), chaveCel = (gx, gz) => gx * 4096 + gz;
  const distSeg = (px, pz, s) => { const dx = s.bx - s.ax, dz = s.bz - s.az, t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - s.ax - dx * t, pz - s.az - dz * t); };
  for (const [r, f] of infos) {
    const largo = f.hw + (f.urb && f.tipo !== 'terra' ? CALCADA : .06);
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const s = { ax: r.p[i] - cx, az: r.p[i + 1] - cz, bx: r.p[i + 2] - cx, bz: r.p[i + 3] - cz, largo };
      const x0 = Math.floor(Math.min(s.ax, s.bx) - largo - 1 + cx), x1 = Math.floor(Math.max(s.ax, s.bx) + largo + 1 + cx);
      const z0 = Math.floor(Math.min(s.az, s.bz) - largo - 1 + cz), z1 = Math.floor(Math.max(s.az, s.bz) + largo + 1 + cz);
      for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) { const k = chaveCel(gx, gz); let l = trechos.get(k); if (!l) trechos.set(k, l = []); l.push(s); }
    }
  }
  const naRua = (x, z, folga = 0) => { for (const s of trechos.get(chaveCel(Math.floor(x + cx), Math.floor(z + cz))) || []) if (distSeg(x, z, s) < s.largo + folga) return true; return false; };

  // ----- Quarteirões de Irecê: casas geminadas de frente para a calçada, no ângulo da rua -----
  // Cada rua da cidade ganha, dos dois lados, uma fileira de lotes de 8 a 13 m de frente (como no Centro e nos bairros),
  // colados uns nos outros, com quintal atrás. De longe valem o corpo e o telhado (e a imagem do chão);
  // porta, janelas com grade, barrado, caixa-d'água, toldo e placa só aparecem de perto.
  const casas = [], telhados = [], detalhes = [], luzes = [], troncos = [], copas = [], copasDet = [];
  const PORTAS = ['#6B4A2E', '#2E5E8C', '#3E7D4F', '#8A3B2E', '#5A6268', '#C8553D', '#7A5534'];
  const PAREDES = ['#F4EFE6', '#F6E3A1', '#BFE0EC', '#BFE6D6', '#F3C9C2', '#E9D5B4', '#F4EFE6', '#DCD6EE', '#F7D9A8', '#FFFFFF', '#E0EBD0', '#F1C7A6', '#FBE7C6', '#D5E8F2'];
  const FAIXAS = ['#C8553D', '#2E5E8C', '#3E7D4F', '#B07A45', '#8E4EC6', '#E2A11B', '#5A6268'];
  const TELHAS = ['#C8553D', '#B5462F', '#D9774E', '#C25E3A', '#B9583F'];
  const LAJES = ['#D9D4C8', '#CFC8B8', '#C4C9CC', '#E2DCCF', '#BDB6A6'];
  const TOLDOS = ['#E5484D', '#0D74CE', '#18A957', '#F7C948', '#FF7A2F', '#8E4EC6'];
  const CARROS = ['#E5484D', '#F4F1EA', '#2B2F33', '#0D74CE', '#C4C9CC', '#F7C948', '#8E857A', '#FFFFFF'];
  const QUINTAL = ['#B9C98A', '#C9B98C', '#A9C27C', '#D3C49A'];
  const pega = (l, a, b) => l[ruido(a, b) * l.length | 0];
  const SETOR_COR = { 'Comércio': '#FF7A2F', 'Serviços': '#0D74CE', 'Indústria': '#8E4EC6', 'Agropecuária': '#18A957', 'Construção': '#B07A45' };
  // Empresas da base de CNPJ: cada uma vira o comércio do lote onde cai o endereço dela.
  const empresasPorCel = new Map(), usadas = new Set(), construidas = new Set();
  for (const e of comercios) { if (e.x == null) continue; const k = chaveCel(Math.floor(e.x + cx), Math.floor(e.z + cz)); let l = empresasPorCel.get(k); if (!l) empresasPorCel.set(k, l = []); l.push(e); }
  const empresaPerto = (x, z, raio) => {
    let melhor = null, dm = raio;
    for (let gz = Math.floor(z + cz) - 1; gz <= Math.floor(z + cz) + 1; gz++) for (let gx = Math.floor(x + cx) - 1; gx <= Math.floor(x + cx) + 1; gx++)
      for (const e of empresasPorCel.get(chaveCel(gx, gz)) || []) { if (usadas.has(e)) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < dm) { dm = d; melhor = e; } }
    return melhor;
  };
  // Ocupação fina (2,5 m), para os lotes não se sobreporem nas esquinas e curvas (e encostarem no vizinho).
  const OC = 4, ocup = new Uint8Array(GW * OC * GH * OC);
  const oi = (x, z) => { const ox = Math.floor((x + cx) * OC), oz = Math.floor((z + cz) * OC); return ox < 0 || oz < 0 || ox >= GW * OC || oz >= GH * OC ? -1 : oz * GW * OC + ox; };
  const noDisco = (x, z, folga) => (x - centroX) ** 2 + (z - centroZ) ** 2 < (RAIO - folga) ** 2;
  // Retângulo (centro x,z; frente f = vetor para a rua; largura w ao longo da rua; fundo d) livre?
  const livreLote = (x, z, fx, fz, w, d) => {
    const lx = fz, lz = -fx; // ao longo da rua
    for (const a of [-.38, 0, .38]) for (const b of [-.42, -.15, .15, .42]) {
      const px = x + lx * a * w + fx * b * d, pz = z + lz * a * w + fz * b * d, gx = Math.floor(px + cx), gz = Math.floor(pz + cz);
      if (!dentro(gx, gz) || !noDisco(px, pz, 2.2)) return false;
      const i = idx(gx, gz);
      if (area[i] || reservado[i] || !urbano(gx, gz) || naRua(px, pz, .02)) return false;
      const o = oi(px, pz); if (o < 0 || ocup[o]) return false;
    }
    return true;
  };
  const ocupar = (x, z, fx, fz, w, d) => { const lx = fz, lz = -fx; for (let a = -.4; a <= .401; a += .1) for (let b = -.45; b <= .451; b += .15) { const o = oi(x + lx * a * w + fx * b * d, z + lz * a * w + fz * b * d); if (o >= 0) ocup[o] = 1; } };

  // Árvore de copa em cachos (o miolo de longe; os cachos, o tronco e as flores de perto).
  function arvore(x, z, s, jeito, sd) {
    const y = alturaEm(x, z);
    if (jeito === 'coqueiro') {
      troncos.push({ x, y, z, w: .12, d: .12, h: 1.8 * s, cor: '#9C7A55' });
      const t = y + 1.8 * s;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7], [-.7, .7]]) copasDet.push({ x: x + a * .38 * s, y: t - .05 - Math.abs(a * b) * .05, z: z + b * .38 * s, w: .2 + Math.abs(a) * .45 * s, h: .07, d: .2 + Math.abs(b) * .45 * s, cor: '#4E9A43' });
      copas.push({ x, y: t - .05, z, w: .45 * s, d: .45 * s, h: .2, cor: '#5FA34E' });
      return;
    }
    const verdes = jeito === 'ipe' ? [['#F2C230', '#F5D34F', '#E9B021'], ['#E87FB0', '#F09CC2', '#D9659C'], ['#B98AE0', '#C9A2EA', '#A574D3']][ruido(sd, 9) * 3 | 0]
      : jeito === 'seca' ? ['#7FA35A', '#8DAA5E', '#6E9A4B'] : jeito === 'nim' ? ['#3F8A3E', '#4E9A43', '#357A36'] : ['#5FA34E', '#4F9A4E', '#6FB35C', '#7DBB5E'];
    troncos.push({ x, y, z, w: .14 * s, d: .14 * s, h: .62 * s, cor: '#6E4B33' });
    copas.push({ x, y: y + .5 * s, z, w: .9 * s, d: .9 * s, h: .62 * s, cor: verdes[0] });
    for (const [a, b, c] of [[.36, 0, .1], [-.36, 0, 0], [0, .36, .05], [0, -.36, .12], [.2, .2, .32], [-.22, -.18, .28]])
      copasDet.push({ x: x + a * s, y: y + (.48 + c) * s, z: z + b * s, w: .5 * s, d: .5 * s, h: .46 * s, cor: verdes[(ruido(sd + a * 10, b * 10 + c) * verdes.length) | 0] });
    copasDet.push({ x, y: y + 1.02 * s, z, w: .46 * s, d: .46 * s, h: .26 * s, cor: verdes[1] });
    if (jeito === 'quintal' && ruido(sd, 23) < .6) for (const [a, b] of [[.4, .1], [-.2, .42], [.1, -.44]]) copasDet.push({ x: x + a * s, y: y + .75 * s, z: z + b * s, w: .09, h: .09, d: .09, cor: ruido(sd, 24) < .5 ? '#F76808' : '#E5484D' });
    pinta(Math.floor(x + cx), Math.floor(z + cz), tmp.set(verdes[0]), .92);
  }

  // Uma casa (ou loja, ou prediozinho). Coordenadas locais: x ao longo da rua, z para a rua (frente em z = +D/2).
  function casa(x, z, fx, fz, W, D, opc) {
    const rot = Math.atan2(fx, fz), ca = Math.cos(rot), sa = Math.sin(rot), y = alturaEm(x, z);
    const casaRef = { x, z, r: Math.hypot(W, D) / 2 + .1 };
    const add = (lista, lx, y0, lz, w, h, d, cor) => lista.push({ x: x + lx * ca + lz * sa, y: y0, z: z - lx * sa + lz * ca, w, h, d, cor, rot, casa: casaRef });
    const { tipo, andares, parede, semente: sd } = opc, F = D / 2;
    const H = andares === 1 ? .78 + ruido(sd, 3) * .14 : andares * .74 + .06;
    const laje = tipo === 'predio' || tipo === 'comercio' || ruido(sd, 11) < .55;
    // Corpo + telhado: o que se vê de longe.
    add(casas, 0, y, 0, W, H + (laje ? .12 : 0), D, parede);
    if (laje) {
      const corLaje = pega(LAJES, sd, 5);
      add(telhados, 0, y + H + .02, 0, W - .12, .11, D - .12, corLaje); // dentro da platibanda: a mureta aparece em volta
      pintaRet(x, z, W, D, rot, parede); pintaRet(x, z, W - .12, D - .12, rot, corLaje);
    } else {
      const telha = pega(TELHAS, sd, 2), telha2 = TELHAS[(TELHAS.indexOf(telha) + 1) % TELHAS.length];
      add(telhados, 0, y + H, 0, W + .14, .15, D + .14, telha);
      add(telhados, 0, y + H + .15, 0, W + .14, .13, (D + .14) * .56, telha2);
      add(telhados, 0, y + H + .28, 0, W + .14, .1, (D + .14) * .18, telha);
      pintaRet(x, z, W + .14, D + .14, rot, telha); pintaRet(x, z, W + .14, (D + .14) * .3, rot, telha2);
      // fileiras de telha (de perto) e a cumeeira escura
      for (let k = -2; k <= 2; k++) add(detalhes, 0, y + H + .15 - .005, k * (D + .14) * .19, W + .16, .02, .03, '#9E4630');
      add(detalhes, 0, y + H + .38, 0, W + .16, .04, .08, '#8E3A26');
    }
    // De perto: fachada.
    add(detalhes, 0, y, F + .006, W - .02, .13, .02, pega(FAIXAS, sd, 6));                        // barrado
    const portaX = (ruido(sd, 4) - .5) * (W - .5);
    if (tipo === 'comercio') {
      // loja: porta de enrolar larga, toldo listrado e placa na cor do setor
      const cor = opc.corLoja || pega(TOLDOS, sd, 8);
      add(detalhes, 0, y, F + .012, W * .78, .52, .02, ruido(sd, 9) < .5 ? '#9AA1A6' : '#3A3F44');
      for (let k = 0; k < 5; k++) add(detalhes, -W * .4 + W * .2 * (k + .5), y + .6, F + .16, W * .2, .05, .32, k % 2 ? '#FFFFFF' : cor);
      add(luzes, 0, y + H - .3, F + .02, W * .72, .2, .03, cor);
    } else {
      add(detalhes, portaX, y, F + .006, .32, .56, .015, '#EDE6D6');                                // batente
      add(detalhes, portaX, y, F + .012, .25, .5, .015, pega(PORTAS, sd, 1));                       // porta
      const grade = ruido(sd, 12) < .6, garagem = W > 1 && ruido(sd, 13) < .35;
      const lxj = portaX > 0 ? -W * .27 : W * .27;
      if (garagem) add(detalhes, lxj, y, F + .012, .48, .46, .02, ruido(sd, 14) < .5 ? '#5A6268' : '#7A5534');
      else {
        const acesa = ruido(sd, 7) < .18;
        add(detalhes, lxj, y + .24, F + .006, .38, .32, .015, '#F4F1EA');                            // moldura
        add(acesa ? luzes : detalhes, lxj, y + .27, F + .012, .3, .25, .015, acesa ? '#FFE2A8' : '#4E6A78');
        if (grade) for (const g of [-.1, 0, .1]) add(detalhes, lxj + g, y + .26, F + .022, .018, .28, .012, '#2F3438');
      }
    }
    for (let a = 1; a < andares; a++) for (const lxj of [-W * .26, W * .26]) {                       // andares de cima
      const acesa = ruido(sd + a, lxj > 0 ? 7 : 8) < .2;
      add(detalhes, lxj, y + .26 + a * .74, F + .006, .36, .32, .015, '#F4F1EA');
      add(acesa ? luzes : detalhes, lxj, y + .29 + a * .74, F + .012, .28, .25, .015, acesa ? '#FFE2A8' : '#4E6A78');
    }
    if (tipo === 'sobrado') { add(detalhes, 0, y + .74, F + .18, W * .8, .05, .36, '#D9D2C2'); add(detalhes, 0, y + .79, F + .35, W * .8, .22, .03, '#3A3F44'); }
    if (laje && ruido(sd, 15) < .6) {                                                                // caixa-d'água
      const lx = (ruido(sd, 16) < .5 ? 1 : -1) * (W / 2 - .3), lz = -F + .32;
      add(detalhes, lx, y + H + .13, lz, .36, .08, .36, '#B9B2A2'); add(detalhes, lx, y + H + .21, lz, .3, .22, .3, '#2F6FB0'); add(detalhes, lx, y + H + .43, lz, .24, .03, .24, '#5C93C8');
    }
    if (laje && ruido(sd, 17) < .22) add(detalhes, -(W / 2 - .35), y + H + .14, 0, .5, .03, .3, '#2B3A4A'); // aquecedor solar
    if (ruido(sd, 18) < .25) add(detalhes, W * .3, y + .62, F + .04, .16, .1, .06, '#ECEDEE');          // ar-condicionado
    // Quintal atrás da casa (na imagem do chão): grama ou terra batida, às vezes com uma frutífera.
    const qd = .7 + ruido(sd, 19) * .5, qx = x - fx * (F + qd / 2), qz = z - fz * (F + qd / 2);
    if (livreLote(qx, qz, fx, fz, W * .9, qd * .9)) {
      pintaRet(qx, qz, W, qd, rot, pega(QUINTAL, sd, 20)); ocupar(qx, qz, fx, fz, W, qd);
      if (ruido(sd, 21) < .3) arvore(qx, qz, .7 + ruido(sd, 22) * .3, 'quintal', sd);
    }
  }

  // Percorre cada rua urbana, dos dois lados, enchendo de lotes.
  let semente = 1;
  for (const [r, f] of infos) {
    if (!f.urb || f.tipo === 'terra') continue;
    const largaRua = r.l >= 2.4;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i] - cx, az = r.p[i + 1] - cz, bx = r.p[i + 2] - cx, bz = r.p[i + 3] - cz, L = Math.hypot(bx - ax, bz - az);
      if (L < .6) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const lado of [-1, 1]) {
        const fx = uz * lado, fz = -ux * lado; // frente da casa: aponta para a rua
        let t = .15;
        while (t < L - .3) {
          semente++;
          const W = .78 + ruido(semente, 1) * .5, D = 1.25 + ruido(semente, 2) * .75;
          const m = t + W / 2, off = f.hw + CALCADA + .03 + D / 2;
          const x = ax + ux * m - fx * off, z = az + uz * m - fz * off;
          if (!livreLote(x, z, fx, fz, W, D)) { t += .25; continue; }
          ocupar(x, z, fx, fz, W, D);
          const perto = Math.hypot(x - centroX, z - centroZ), empresa = empresaPerto(x, z, .9);
          if (empresa) { usadas.add(empresa); construidas.add(empresa.cnpj || empresa.nome); }
          const n = ruido(semente, 5);
          const tipo = empresa ? (empresa.porte === 'DEMAIS' ? 'predio' : 'comercio') : (largaRua && n < .55) || (perto < 38 && n < .3) ? 'comercio' : perto < 30 && n < .34 ? 'predio' : n < .5 ? 'sobrado' : 'casa';
          const andares = tipo === 'predio' ? 3 + (ruido(semente, 6) * 2 | 0) : tipo === 'sobrado' || (tipo === 'comercio' && n < .2) ? 2 : 1;
          if (ruido(semente, 7) < .07 && tipo === 'casa') { // lote murado com portão (terreno ou casa recuada)
            const rot = Math.atan2(fx, fz), F = D / 2, ca = Math.cos(rot), sa = Math.sin(rot), y = alturaEm(x, z);
            const p = (lx, lz) => [x + lx * ca + lz * sa, z - lx * sa + lz * ca], cas = { x, z, r: Math.hypot(W, D) / 2 };
            const corM = pega(PAREDES, semente, 9);
            for (const [lx, w] of [[-W * .3, W * .4], [W * .35, W * .3]]) { const [px, pz] = p(lx, F - .02); casas.push({ x: px, y, z: pz, w, h: .36, d: .06, cor: corM, rot, casa: cas }); }
            const [gx2, gz2] = p(W * .1, F - .02); detalhes.push({ x: gx2, y, z: gz2, w: W * .28, h: .38, d: .05, cor: pega(FAIXAS, semente, 3), rot, casa: cas });
            pintaRet(x, z, W, D, rot, pega(QUINTAL, semente, 4));
            if (ruido(semente, 8) < .6) arvore(x, z, .8, 'quintal', semente);
          } else casa(x, z, fx, fz, W, D, { tipo, andares, semente, parede: tipo === 'predio' ? pega(['#E8EEF0', '#F4EFE6', '#DCE7D9', '#EDE3CF'], semente, 10) : pega(PAREDES, semente, 9),
            corLoja: empresa ? SETOR_COR[empresa.setor] || '#FF7A2F' : null });
          // Na calçada: árvore de rua (nim, ipê ou coqueiro), poste e carro estacionado, de vez em quando.
          const cx2 = ax + ux * m - fx * (f.hw + CALCADA * .45), cz2 = az + uz * m - fz * (f.hw + CALCADA * .45);
          const q = ruido(semente, 30);
          if (q < .16 && !naRua(cx2, cz2, -CALCADA * .5 + .06)) arvore(cx2, cz2, .62 + ruido(semente, 31) * .25, q < .025 ? 'coqueiro' : q < .045 ? 'ipe' : 'nim', semente);
          else if (q > .9 && (largaRua || perto < 60)) { const y0 = alturaEm(cx2, cz2); detalhes.push({ x: cx2, y: y0, z: cz2, w: .06, h: 1.25, d: .06, cor: '#5A6268' }); luzes.push({ x: cx2 + fx * .18, y: y0 + 1.22, z: cz2 + fz * .18, w: .16, h: .06, d: .16, cor: '#FFF1C2' }); }
          if (ruido(semente, 32) < .09) {
            const px = ax + ux * m - fx * (f.hw - .2), pz = az + uz * m - fz * (f.hw - .2), rot = Math.atan2(ux, uz), y0 = alturaEm(px, pz);
            detalhes.push({ x: px, y: y0 + .05, z: pz, w: .36, h: .17, d: .72, cor: pega(CARROS, semente, 33), rot }, { x: px, y: y0 + .22, z: pz, w: .32, h: .13, d: .4, cor: '#BFD9E2', rot });
          }
          t += W;
        }
      }
    }
  }
  // ----- Praças (Paulo, 07/11/2026: "as áreas verdes e de terrenos tão bem pobres") -----
  // No chão: a grama no formato real da praça, calçada em volta, caminhos do centro até a borda, a roda calçada no meio,
  // canteiros com flores e manchas de grama. Em 3D: coreto (praça grande) ou fonte, bancos virados para o centro e postes.
  const pracas = [];
  for (const a of dados.areas) {
    if (a.t !== 'praca' || a.p.length < 6 || /est[aá]dio|campo|quadra|gin[aá]sio/i.test(a.n || '')) continue; // estádio e campo não ganham coreto
    const pts = []; for (let i = 0; i < a.p.length; i += 2) pts.push([a.p[i] - cx, a.p[i + 1] - cz]);
    const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, mz = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    if (!noDisco(mx, mz, 4)) continue;
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]), raio = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2;
    if (raio < .8) continue;
    pracas.push({ pts, mx, mz, raio, sd: Math.round(mx * 31 + mz * 17) });
  }
  const caminhoPraca = (pr, q) => { g2.beginPath(); g2.moveTo(PXx(pr.mx), PXz(pr.mz)); g2.lineTo(PXx(q[0]), PXz(q[1])); g2.stroke(); };
  for (const pr of pracas) {
    const anel = Math.min(1.4, pr.raio * .32);
    g2.save();
    g2.beginPath(); pr.pts.forEach((q, k) => (k ? g2.lineTo(PXx(q[0]), PXz(q[1])) : g2.moveTo(PXx(q[0]), PXz(q[1])))); g2.closePath();
    g2.fillStyle = '#7CC56A'; g2.fill();
    g2.lineWidth = .55 * PX; g2.strokeStyle = '#E3DBC7'; g2.lineJoin = 'round'; g2.stroke();     // calçada em volta
    g2.clip();
    for (let k = 0; k < 40; k++) { const t = ruido(pr.sd, k), u = ruido(k, pr.sd); g2.fillStyle = ['#6DB55C', '#8CCB75', '#74BD62'][k % 3]; g2.beginPath(); g2.arc(PXx(pr.mx + (t - .5) * pr.raio * 2.2), PXz(pr.mz + (u - .5) * pr.raio * 2.2), (.3 + ruido(k, 3) * .6) * PX, 0, Math.PI * 2); g2.fill(); }
    g2.lineCap = 'round'; g2.lineWidth = .32 * PX; g2.strokeStyle = '#E9DFC8';
    for (let k = 0; k < pr.pts.length; k += Math.max(1, Math.floor(pr.pts.length / 4))) { const q = pr.pts[k], q2 = pr.pts[(k + 1) % pr.pts.length]; caminhoPraca(pr, [(q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2]); }
    g2.fillStyle = '#E9DFC8'; g2.beginPath(); g2.arc(PXx(pr.mx), PXz(pr.mz), anel * PX, 0, Math.PI * 2); g2.fill();
    g2.lineWidth = .06 * PX; g2.strokeStyle = '#CFC4AA'; g2.beginPath(); g2.arc(PXx(pr.mx), PXz(pr.mz), (anel - .12) * PX, 0, Math.PI * 2); g2.stroke();
    // canteiros com flores
    for (let k = 0; k < Math.min(10, 2 + pr.raio * 2); k++) {
      const ang = ruido(pr.sd, k + 50) * Math.PI * 2, d = anel + .5 + ruido(k, pr.sd + 3) * (pr.raio - anel - .6), fx = pr.mx + Math.cos(ang) * d, fz = pr.mz + Math.sin(ang) * d;
      g2.fillStyle = '#4E8F45'; g2.beginPath(); g2.arc(PXx(fx), PXz(fz), .32 * PX, 0, Math.PI * 2); g2.fill();
      for (let j = 0; j < 7; j++) { g2.fillStyle = ['#E87FB0', '#F2C230', '#E5484D', '#FFFFFF'][(j + k) % 4]; g2.fillRect(PXx(fx + (ruido(j, k + 9) - .5) * .5) - 1, PXz(fz + (ruido(k + 9, j) - .5) * .5) - 1, 2, 2); }
    }
    g2.restore();
    // 3D: coreto ou fonte no meio, bancos e postes na roda
    const y = alturaEm(pr.mx, pr.mz);
    if (pr.raio > 2.2) { // coreto
      casas.push({ x: pr.mx, y, z: pr.mz, w: 1.3, h: .2, d: 1.3, cor: '#E9E4DA' });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.3], [0, 1.3], [-1.3, 0], [1.3, 0]]) detalhes.push({ x: pr.mx + a * .48, y: y + .2, z: pr.mz + b * .48, w: .07, h: .62, d: .07, cor: '#F4F1EA' });
      telhados.push({ x: pr.mx, y: y + .82, z: pr.mz, w: 1.5, h: .1, d: 1.5, cor: '#C8553D' }, { x: pr.mx, y: y + .92, z: pr.mz, w: 1.05, h: .1, d: 1.05, cor: '#B5462F' }, { x: pr.mx, y: y + 1.02, z: pr.mz, w: .55, h: .1, d: .55, cor: '#C8553D' });
      detalhes.push({ x: pr.mx, y: y + 1.12, z: pr.mz, w: .1, h: .22, d: .1, cor: '#E2A11B' });
    } else { // fonte
      for (const [a, b, w, d] of [[0, -.45, 1, .12], [0, .45, 1, .12], [-.45, 0, .12, 1], [.45, 0, .12, 1]]) casas.push({ x: pr.mx + a, y, z: pr.mz + b, w, h: .2, d, cor: '#D9D2C2' });
      detalhes.push({ x: pr.mx, y: y + .02, z: pr.mz, w: .8, h: .12, d: .8, cor: '#3FB4C7' }, { x: pr.mx, y, z: pr.mz, w: .16, h: .5, d: .16, cor: '#E9E4DA' });
      luzes.push({ x: pr.mx, y: y + .5, z: pr.mz, w: .22, h: .08, d: .22, cor: '#BDEFF7' });
    }
    const nb = Math.min(8, 4 + Math.floor(pr.raio));
    for (let k = 0; k < nb; k++) {
      const ang = k / nb * Math.PI * 2 + .3, bx = pr.mx + Math.cos(ang) * (anel + .28), bz = pr.mz + Math.sin(ang) * (anel + .28), rot = Math.atan2(Math.cos(ang), Math.sin(ang)), yb = alturaEm(bx, bz);
      if (k % 2) { detalhes.push({ x: bx, y: yb, z: bz, w: .05, h: 1.05, d: .05, cor: '#3A3F44' }); luzes.push({ x: bx, y: yb + 1.02, z: bz, w: .14, h: .1, d: .14, cor: '#FFF1C2' }); continue; }
      detalhes.push({ x: bx, y: yb + .14, z: bz, w: .5, h: .05, d: .16, cor: '#B98552', rot }, { x: bx, y: yb, z: bz, w: .44, h: .14, d: .1, cor: '#6E6A62', rot });
    }
    // mais árvores, deixando a roda do meio livre
    for (let k = 0; k < Math.min(26, pr.raio * pr.raio * 1.6); k++) {
      const ang = ruido(pr.sd + 7, k) * Math.PI * 2, d = anel + .9 + ruido(k, pr.sd + 11) * (pr.raio * 1.1 - anel - .9), tx = pr.mx + Math.cos(ang) * d, tz = pr.mz + Math.sin(ang) * d;
      const gx = Math.floor(tx + cx), gz = Math.floor(tz + cz);
      if (!dentro(gx, gz) || area[idx(gx, gz)] !== 1 || naRua(tx, tz, .1)) continue;
      const q = ruido(k, pr.sd + 21);
      arvore(tx, tz, .75 + ruido(pr.sd, k + 31) * .45, q < .15 ? 'coqueiro' : q < .32 ? 'ipe' : 'praca', pr.sd + k);
    }
  }

  // ----- Terrenos vazios dentro das quadras: terra batida, mato, arbustos e, às vezes, um monte de entulho -----
  for (let gz = bz0; gz < bz1; gz++) for (let gx = bx0; gx < bx1; gx++) {
    if (!dentro(gx, gz)) continue;
    const i = idx(gx, gz);
    if (rua[i] || area[i] || reservado[i] || !urbano(gx, gz)) continue;
    const x = gx - cx, z = gz - cz;
    let vazio = true;
    for (const [a, b] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75], [.5, .5]]) { const o = oi(x + a, z + b); if ((o >= 0 && ocup[o]) || naRua(x + a, z + b, .05)) { vazio = false; break; } }
    if (!vazio) continue;
    const n = ruido(gx * 3 + 1, gz * 5 + 2);
    // chão: terra batida com manchas de mato (pixel a pixel, no tamanho do cubinho)
    g2.fillStyle = n < .45 ? '#CDB68C' : n < .7 ? '#BFC48D' : '#D6C79F';
    g2.fillRect((gx - bx0) * PX, (gz - bz0) * PX, PX, PX);
    for (let k = 0; k < 9; k++) { g2.fillStyle = ['#9DBA6A', '#88A85A', '#B79F74', '#C9B48A', '#A3B873'][(k + gx) % 5]; g2.fillRect((gx - bx0) * PX + ruido(gx + k, gz) * (PX - 2), (gz - bz0) * PX + ruido(gz + k, gx) * (PX - 2), 2, 2); }
    const y = alturaEm(x + .5, z + .5);
    if (n < .35) { // arbustos baixos
      for (let k = 0; k < 2 + (ruido(gx, gz + 3) * 3 | 0); k++) { const s = .18 + ruido(gx + k, gz + 9) * .22; copasDet.push({ x: x + .2 + ruido(k, gx) * .6, y, z: z + .2 + ruido(gz, k) * .6, w: s, h: s * .8, d: s, cor: ['#6E9A4B', '#7FA35A', '#5E8C4A'][k % 3] }); }
    } else if (n < .4) { // mandacaru
      const v = '#5E8C4A'; copasDet.push({ x: x + .5, y, z: z + .5, w: .16, h: .9, d: .16, cor: v }, { x: x + .64, y: y + .4, z: z + .5, w: .12, h: .35, d: .12, cor: v }, { x: x + .38, y: y + .55, z: z + .5, w: .12, h: .3, d: .12, cor: v });
    } else if (n > .96) { // entulho
      for (let k = 0; k < 4; k++) detalhes.push({ x: x + .3 + ruido(k, gz) * .4, y, z: z + .3 + ruido(gx, k) * .4, w: .14 + ruido(k, gx) * .12, h: .06 + ruido(gz, k) * .1, d: .14, cor: ['#9A938A', '#B5AEA3', '#C8553D', '#7F776C'][k] });
    }
  }
  // Avenidas: canteiro central com grama, árvore e poste (as largas), e o nome no meio (as principais).
  const nomes = new Map();
  for (const r of dados.ruas) {
    if (r.l < 2.4) continue;
    let comp = 0; for (let i = 2; i < r.p.length; i += 2) comp += Math.hypot(r.p[i] - r.p[i - 2], r.p[i + 1] - r.p[i - 1]);
    if (r.n && /^(avenida|av\.?|rodovia|ba-|br-)/i.test(r.n)) { const q = nomes.get(r.n) || { comp: 0, r: null, maior: 0 }; q.comp += comp; if (comp > q.maior) { q.maior = comp; q.r = r; } nomes.set(r.n, q); }
    if (r.l < 3.4) continue;
    let anda = 0;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const [x0, z0, x1, z1] = [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3]], L = Math.hypot(x1 - x0, z1 - z0);
      for (let t = 0; t < L; t += .9) {
        const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L, gx = Math.floor(x), gz = Math.floor(z);
        if (!dentro(gx, gz) || !urbano(gx, gz)) { anda += .9; continue; }
        const y = Y(nivel[idx(gx, gz)]), wx = x - cx, wz = z - cz;
        detalhes.push({ x: wx, y, z: wz, w: .5, h: .1, d: .5, cor: '#7DB35C' });
        if ((anda | 0) % 5 === 0) detalhes.push({ x: wx, y: y + .1, z: wz, w: .1, h: .5, d: .1, cor: '#7A5534' }, { x: wx, y: y + .55, z: wz, w: .6, h: .5, d: .6, cor: '#4E9A43' });
        else if ((anda | 0) % 5 === 2) { detalhes.push({ x: wx, y: y + .1, z: wz, w: .07, h: 1.5, d: .07, cor: '#5A6268' }); luzes.push({ x: wx, y: y + 1.55, z: wz, w: .5, h: .07, d: .14, cor: '#FFF1C2' }); }
        anda += .9;
      }
    }
  }
  for (const [nome, q] of [...nomes].sort((a, b) => b[1].comp - a[1].comp).slice(0, 18)) {
    if (q.comp < 40 || !q.r) continue;
    const m = Math.floor(q.r.p.length / 4) * 2, gx = Math.floor(q.r.p[m]), gz = Math.floor(q.r.p[m + 1]);
    if (!dentro(gx, gz)) continue;
    motor.rotulo({ pos: new THREE.Vector3(q.r.p[m] - cx, Y(nivel[idx(gx, gz)]) + 1.2, q.r.p[m + 1] - cz), classe: 'rotulo-rua', html: nome.replace(/[<>&]/g, ''), distMax: 320, prioridade: -1 });
  }
  // Quadrantes: a cidade vai para a placa de vídeo em pedaços de 80×80 células. O que está fora da tela é
  // descartado pela câmera (frustum) e os detalhes miúdos (janelas, portas, luzes, plaquinhas) dos
  // quadrantes longe não são desenhados: de longe não se veem, e eram a maior parte dos triângulos.
  const LADO_Q = 80;
  const quadrantes = (lista, opcoes, detalhe) => {
    const grupos = new Map();
    for (const b of lista) { const k = Math.floor(b.x / LADO_Q) + ',' + Math.floor(b.z / LADO_Q); let g = grupos.get(k); if (!g) grupos.set(k, g = []); g.push(b); }
    return [...grupos].map(([k, l]) => { const m = blocos(l, opcoes); m.computeBoundingSphere(); const [qx, qz] = k.split(',').map(Number); return { m, l, cx: (qx + .5) * LADO_Q, cz: (qz + .5) * LADO_Q, detalhe }; });
  };
  const matLuz = new THREE.MeshBasicMaterial({ toneMapped: false });
  const pedacos = [...quadrantes(casas, { sombra: true }, false), ...quadrantes(telhados, { sombra: true }, false),
    ...quadrantes(detalhes, { sombra: false }, true), ...quadrantes(luzes, { sombra: false, material: matLuz }, true)];
  // Telhados vistos de cima, na imagem do chão: de longe a cidade é a imagem; de perto, o 3D.
  const malhas = pedacos.map((q) => [q.m, q.l]);
  for (const q of pedacos) motor.adicionar(q.m);
  // Nível de detalhe: só solicita desenho quando a visibilidade de um quadrante muda.
  const DIST_DETALHE = 230;
  motor.animar(() => {
    let mudou = false;
    const c = motor.camera.position;
    const alvo = motor.estado?.().alvo || { x: c.x, z: c.z };
    for (const q of pedacos) {
      const d = Math.hypot(alvo.x - q.cx, alvo.z - q.cz);
      // 3D só nos quadrantes perto de onde se olha; detalhes miúdos ainda mais perto.
      // No recorte do Centro, casas e telhados ficam sempre em 3D; janelas, portas e luzes de perto.
      // Longe do foco (beira do disco, já desfocada pelo tilt-shift) a cidade fica só na imagem do chão, com os telhados pintados.
      const ver = q.detalhe ? c.y < 150 && d < 95 + c.y * .2 : d < 150;
      mudou = mudou || q.m.visible !== ver; q.m.visible = ver;
    }
    return mudou;
  });
  // Abre espaço na cidade já montada (a sede de um cliente no endereço dele): some com o que estiver no quadrado.
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function limparArea(x, z, r) {
    for (const [m, lista] of malhas) {
      let mudou = false;
      lista.forEach((b, k) => { const c = b.casa || b, rr = r + (b.casa ? b.casa.r : 0); if (Math.abs(c.x - x) < rr && Math.abs(c.z - z) < rr) { m.setMatrixAt(k, zero); mudou = true; } });
      if (mudou) m.instanceMatrix.needsUpdate = true;
    }
    // O chão pintado (telhados e quintais vistos de cima) também some: fica o terreno liso do lote.
    g2.fillStyle = '#E2D8C0'; g2.fillRect(PXx(x - r), PXz(z - r), r * 2 * PX, r * 2 * PX); imagem.needsUpdate = true;
  }
  // Terreno livre mais perto de (x, z): quadrado de lado 2r+1 sem rua, área nem reserva. Marca como reservado.
  const terrenos = new Map();
  function achaTerreno(chave, x, z, r = 3) {
    if (terrenos.has(chave)) return terrenos.get(chave);
    const gx0 = Math.round(x + cx), gz0 = Math.round(z + cz);
    const livreQ = (gx, gz) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const X = gx + a, Z = gz + b; if (!dentro(X, Z)) return false; const i = idx(X, Z); if (rua[i] || area[i] || reservado[i]) return false; } return true; };
    for (let raio = 0; raio <= 16; raio++) for (let b = -raio; b <= raio; b++) for (let a = -raio; a <= raio; a++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== raio) continue;
      const gx = gx0 + a, gz = gz0 + b;
      if (!livreQ(gx, gz)) continue;
      for (let bb = -r; bb <= r; bb++) for (let aa = -r; aa <= r; aa++) reservado[idx(gx + aa, gz + bb)] = 1;
      const t = { x: gx - cx, z: gz - cz };
      // Frente para a rua mais próxima (para a sede olhar para a calçada do endereço).
      let melhor = null;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let d = r + 1; d <= r + 4; d++) { const i = idx(gx + dx * d, gz + dz * d); if (dentro(gx + dx * d, gz + dz * d) && rua[i]) { if (!melhor || d < melhor.d) melhor = { d, dx, dz }; break; } }
      t.giro = melhor ? Math.atan2(melhor.dx, melhor.dz) : null;
      limparArea(t.x, t.z, r + .6);
      terrenos.set(chave, t);
      return t;
    }
    terrenos.set(chave, null);
    return null;
  }

  // ----- Árvores -----
  // (troncos, copas e copasDet vêm das casas; aqui entram as das praças e da roça)
  for (let gz = 1; gz < GH - 1; gz++) for (let gx = 1; gx < GW - 1; gx++) {
    const i = idx(gx, gz);
    if (!dentro(gx, gz) || rua[i] || reservado[i] || area[i] === 2) continue;
    const n = ruido(gx * 5 + 11, gz * 3 + 7);
    // As árvores das praças agora vêm com a praça (acima); aqui ficam as da roça.
    const naPraca = false, noCampo = !urbano(gx, gz) && n < (ruido((gx >> 3) + 7, (gz >> 3) + 3) < .18 ? .3 : .012);
    const naRua = false; // na cidade, as árvores agora ficam na calçada e nos quintais (casas geminadas)
    if (!naPraca && !noCampo && !naRua) continue;
    const x = gx - cx + .5, z = gz - cz + .5, y = Y(nivel[i]), s = .7 + ruido(gz, gx) * .6;
    // Espécies do sertão de Irecê: na cidade, coqueiro e ipê (amarelo, rosa, roxo) entre as árvores de rua;
    // na roça, mandacaru, umbuzeiro de copa larga e árvores de verde mais seco.
    const esp = ruido(gx * 7 + 3, gz * 13 + 5);
    if (!noCampo && esp < .16) { arvore(x, z, s, 'coqueiro', gx * 7 + gz); continue; }          // coqueiro
    if (!noCampo && esp < .3) { arvore(x, z, s * .9, 'ipe', gx * 13 + gz); continue; }           // ipê florido
    if (noCampo && esp < .22) { // mandacaru
      const v = '#5E8C4A', a2 = .9 * s;
      copas.push({ x, y, z, w: .26, d: .26, h: 1.7 * s, cor: v }, { x: x + .3, y: y + a2 * .6, z, w: .2, d: .2, h: .7 * s, cor: v }, { x: x + .2, y: y + a2 * .55, z, w: .25, d: .18, h: .16, cor: v },
        { x: x - .28, y: y + a2 * .85, z, w: .2, d: .2, h: .55 * s, cor: v }, { x: x - .18, y: y + a2 * .8, z, w: .22, d: .18, h: .14, cor: v });
      continue;
    }
    if (noCampo && esp < .5) { // umbuzeiro: tronco curto, copa larga e baixa
      troncos.push({ x, y, z, w: .3, d: .3, h: .45 * s, cor: '#6E5640' });
      copas.push({ x, y: y + .4 * s, z, w: 1.9 * s, d: 1.7 * s, h: .55 * s, cor: ['#6E9A4B', '#7FA35A', '#8DAA5E'][ruido(gx, gz + 3) * 3 | 0] });
      continue;
    }
    arvore(x, z, s * 1.1, noCampo ? 'seca' : 'praca', gx * 31 + gz);
  }
  // Árvores também em quadrantes (descartadas fora da tela); troncos só de perto.
  {
    const qs = (lista, op, detalhe) => { const g = new Map(); for (const b of lista) { const k = Math.floor(b.x / 80) + ',' + Math.floor(b.z / 80); let l = g.get(k); if (!l) g.set(k, l = []); l.push(b); }
      return [...g].map(([k, l]) => { const m = blocos(l, op); m.computeBoundingSphere(); const [qx, qz] = k.split(',').map(Number); motor.adicionar(m); return { m, cx: (qx + .5) * 80, cz: (qz + .5) * 80, detalhe }; }); };
    g2.restore(); // fim da pintura do chão (a moldura do disco deixa de recortar)
    imagem.needsUpdate = true;
    const arv = [...qs(troncos, { sombra: false }, true), ...qs(copas, { sombra: true }, false), ...qs(copasDet, { sombra: false }, true)];
    motor.animar(() => { let mudou = false; const c = motor.camera.position, alvo = motor.estado?.().alvo || c; for (const q of arv) { const d = Math.hypot(alvo.x - q.cx, alvo.z - q.cz); const ver = q.detalhe ? c.y < 160 && d < 110 : d < 150; mudou = mudou || q.m.visible !== ver; q.m.visible = ver; } return mudou; });
  }

  // ----- Nuvens deslizando -----
  const nuvens = new THREE.Group();
  const matNuvem = new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: .9, roughness: 1 });
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group();
    const partes = 3 + (ruido(k, 1) * 4 | 0);
    for (let p = 0; p < partes; p++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(6 + ruido(k, p) * 8, 2 + ruido(p, k) * 2, 5 + ruido(k + p, 3) * 5), matNuvem);
      b.position.set(p * 5 - partes * 2.5, ruido(k, p + 9) * 1.5, (ruido(p + 4, k) - .5) * 6);
      b.castShadow = false; g.add(b); // sombra de nuvem obrigava a refazer a sombra da cidade inteira
    }
    g.position.set((ruido(k, 7) - .5) * 600, 70 + ruido(k, 8) * 30, (ruido(k, 9) - .5) * 600);
    g.userData.v = 1.5 + ruido(k, 10) * 2; g.userData.x0 = g.position.x;
    nuvens.add(g);
  }
  motor.adicionar(nuvens);
  motor.animar((t) => { let visivel = false; for (const g of nuvens.children) { g.position.x = ((g.userData.x0 + g.userData.v * t + 170) % 340) - 170; visivel = motor.emVista(g) || visivel; } return visivel; });

  // Caminho pelas ruas de verdade (busca em largura no raster de ruas), para a van da Vybe.
  function ruaMaisPerto(gx0, gz0) {
    for (let r = 0; r < 30; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const gx = gx0 + dx, gz = gz0 + dz;
      if (dentro(gx, gz) && rua[idx(gx, gz)]) return [gx, gz];
    }
    return null;
  }
  function caminho(x0, z0, x1, z1) {
    const a = ruaMaisPerto(Math.round(x0 + cx), Math.round(z0 + cz)), b = ruaMaisPerto(Math.round(x1 + cx), Math.round(z1 + cz));
    if (!a || !b) return null;
    const veio = new Int32Array(GW * GH).fill(-1), fila = new Int32Array(GW * GH);
    let ini = 0, fim = 0; const ia = idx(a[0], a[1]), ib = idx(b[0], b[1]);
    veio[ia] = ia; fila[fim++] = ia;
    while (ini < fim) {
      const i = fila[ini++]; if (i === ib) break;
      const gx = i % GW, gz = (i / GW) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, nz = gz + dz; if (!dentro(nx, nz)) continue;
        const j = idx(nx, nz); if (veio[j] !== -1 || !rua[j]) continue;
        veio[j] = i; fila[fim++] = j;
      }
    }
    if (veio[ib] === -1) return null;
    const pts = []; for (let i = ib; ; i = veio[i]) { pts.push([i % GW - cx + .5, ((i / GW) | 0) - cz + .5]); if (i === ia) break; }
    return pts.reverse().filter((_, k, l) => k % 2 === 0 || k === l.length - 1).map(([x, z]) => ({ x, z, y: alturaEm(x, z) }));
  }
  // Endereço → ponto: a rua do mapa (OpenStreetMap) com o nome mais parecido; o ponto é o meio dela.
  // Nada sai daqui para serviço de fora: só os nomes de rua que vieram com o mapa.
  const semAc = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(rua|r|avenida|av|travessa|tv|praca|pca|alameda|rodovia|ba|br)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const ruasComNome = dados.ruas.filter((r) => r.n).map((r) => ({ ...r, chave: semAc(r.n) }));
  function pontoDoEndereco(endereco) {
    const alvo = semAc(String(endereco || '').split(/[,\-–]/)[0]);
    if (alvo.length < 3) return null;
    const achada = ruasComNome.find((r) => r.chave === alvo) || ruasComNome.find((r) => r.chave.includes(alvo) || alvo.includes(r.chave) && r.chave.length > 4);
    if (!achada) return null;
    const m = Math.floor(achada.p.length / 4) * 2;
    return { x: achada.p[m] - cx, z: achada.p[m + 1] - cz, rua: achada.n };
  }
  const noRecorte = (x, z, folga = 4) => (x - CENTRO_RECORTE.x) ** 2 + (z - CENTRO_RECORTE.z) ** 2 < (RAIO - folga) ** 2;
  const naBorda = (x, z, folga = 6) => { const dx = x - CENTRO_RECORTE.x, dz = z - CENTRO_RECORTE.z, d = Math.hypot(dx, dz) || 1; return { x: CENTRO_RECORTE.x + dx / d * (RAIO - folga), z: CENTRO_RECORTE.z + dz / d * (RAIO - folga), dist: d }; };
  return { construidas, limparArea, achaTerreno, noRecorte, naBorda, pontoDoEndereco, caminho, alturaEm, lugares, cx, cz, GW, GH, livreParaLote: (x, z) => { const gx = Math.round(x + cx), gz = Math.round(z + cz); return dentro(gx, gz) && !rua[idx(gx, gz)] && !area[idx(gx, gz)]; },
    ehRua: (x, z) => { const gx = Math.round(x + cx), gz = Math.round(z + cz); return gx >= 0 && gz >= 0 && gx < GW && gz < GH && rua[idx(gx, gz)] > 0; } };
}

// Muitas caixas = uma chamada de desenho.
export function blocos(lista, { sombra = true, material = null } = {}) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material || materialVoxel(), Math.max(1, lista.length));
  const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), e = new THREE.Vector3();
  lista.forEach((b, k) => {
    // rot: giro em torno do eixo vertical (casas e carros no ângulo da rua)
    if (b.rot) m.compose(p.set(b.x, b.y + b.h / 2, b.z), q.setFromAxisAngle(eixo, b.rot), e.set(b.w, b.h, b.d));
    else { m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.y + b.h / 2, b.z); }
    mesh.setMatrixAt(k, m); mesh.setColorAt(k, c.set(b.cor));
  });
  mesh.count = lista.length;
  mesh.castShadow = sombra; mesh.receiveShadow = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// Ponto de uma rua pelo nome, sem montar a cidade (usado para reservar o terreno da Vybe antes).
construirIrece.pontoSemMontar = (dados, endereco) => {
  const semAc = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(rua|r|avenida|av|travessa|tv|praca|pca|alameda|rodovia|ba|br)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const alvo = semAc(String(endereco || '').split(/[,\-–]/)[0]); if (alvo.length < 3) return null;
  const r = dados.ruas.find((x) => x.n && semAc(x.n) === alvo) || dados.ruas.find((x) => x.n && semAc(x.n).includes(alvo));
  if (!r) return null;
  const m = Math.floor(r.p.length / 4) * 2;
  return { x: r.p[m] - dados.w / 2, z: r.p[m + 1] - dados.h / 2 };
};
