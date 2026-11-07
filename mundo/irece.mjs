// Irecê em voxel: relevo real (Terrain Tiles), ruas e lugares reais (OpenStreetMap),
// casas e árvores em InstancedMesh. Unidade do mundo = 1 célula = 10 m.
import * as THREE from 'three';

export const ruido = (x, z) => (((Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)) >>> 0) % 1000) / 1000;
const COR = (h) => new THREE.Color(h);
const PASSO_M = 3;          // um degrau a cada 3 m de altitude
const ALTURA_DEGRAU = 0.45; // relevo 1,5× exagerado: a maquete precisa mostrar
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

  // ----- Terreno leve: a cor de cada quadra numa IMAGEM (1 pixel = 10 m) e o relevo em retângulos grandes -----
  // Antes: 2 triângulos por quadra + paredes de cada degrau (~900 mil triângulos). Agora: as áreas planas
  // do mesmo nível viram poucos retângulos (gulosos), as paredes dos degraus viram faixas, e a cor
  // (lotes, ruas, praças, roças e, depois, telhados e copas vistos de cima) vem da imagem.
  const tex = new Uint8Array(GW * GH * 4);
  const pinta = (gx, gz, c, k = 1) => { if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return; const o = (gz * GW + gx) * 4; tex[o] = Math.min(255, c.r * 255 * k); tex[o + 1] = Math.min(255, c.g * 255 * k); tex[o + 2] = Math.min(255, c.b * 255 * k); tex[o + 3] = 255; };
  const tmp = new THREE.Color();
  const nv = (gx, gz) => (dentro(gx, gz) ? nivel[idx(gx, gz)] : -9999);
  for (let gz = 0; gz < GH; gz++) for (let gx = 0; gx < GW; gx++) {
    if (!dentro(gx, gz)) continue;
    const n0 = nivel[idx(gx, gz)];
    tmp.copy(corCelula(gx, gz)).offsetHSL(0, 0, (ruido(gx * 3, gz * 7) - .5) * .04);
    // Sombra do canto: quadra ao pé de um degrau mais alto fica mais escura (como a oclusão de antes).
    let alto = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (nv(gx + a, gz + b) > n0) alto++;
    pinta(gx, gz, tmp, [1, .86, .76, .7, .66][alto]);
  }
  const imagem = new THREE.DataTexture(tex, GW, GH, THREE.RGBAFormat);
  imagem.magFilter = THREE.NearestFilter; imagem.minFilter = THREE.LinearMipmapLinearFilter; imagem.generateMipmaps = true;
  imagem.colorSpace = THREE.SRGBColorSpace; imagem.anisotropy = 4; imagem.needsUpdate = true;

  const pos = [], uv = [], ind = [];
  const topo = (x0, z0, x1, z1, y) => { // retângulo plano (em células)
    const b = pos.length / 3;
    pos.push(x0 - cx, y, z0 - cz, x0 - cx, y, z1 - cz, x1 - cx, y, z1 - cz, x1 - cx, y, z0 - cz);
    uv.push(x0 / GW, z0 / GH, x0 / GW, z1 / GH, x1 / GW, z1 / GH, x1 / GW, z0 / GH);
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
  const terreno = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: imagem, roughness: .92 }));
  terreno.receiveShadow = true;
  motor.adicionar(terreno);
  // Paredes dos degraus em faixas: junta as quadras vizinhas com o mesmo degrau (cor de terra/pedra).
  {
    const pp = [], cc = [], ii = []; let v = 0;
    const terra = [COR('#9A6E45'), COR('#86603C'), COR('#A97C4E')], pedra = COR('#7F776C');
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
    const paredes = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide }));
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

  // ----- Casas: lotes de 2×2 células (20 m), com cinco tipos e as cores das cidades do interior da Bahia -----
  // Tudo em InstancedMesh (paredes, telhados, detalhes, luzes): milhares de casas, poucas chamadas de desenho.
  const casas = [], telhados = [], detalhes = [], luzes = [];
  const PORTAS = ['#6B4A2E', '#2E5E8C', '#3E7D4F', '#8A3B2E', '#5A6268', '#C8553D'];
  const PAREDES = ['#F4EFE6', '#F6E3A1', '#BFE0EC', '#BFE6D6', '#F3C9C2', '#E9D5B4', '#F4EFE6', '#DCD6EE', '#F7D9A8', '#FFFFFF', '#E0EBD0', '#F1C7A6'];
  const FAIXAS = ['#C8553D', '#2E5E8C', '#3E7D4F', '#B07A45', '#8E4EC6', '#E2A11B'];
  const TELHAS = ['#C8553D', '#B5462F', '#D9774E', '#C25E3A', '#B9583F'];
  const LAJES = ['#D9D4C8', '#CFC8B8', '#C4C9CC', '#E2DCCF', '#BDB6A6'];
  const TOLDOS = ['#E5484D', '#0D74CE', '#18A957', '#F7C948', '#FF7A2F', '#8E4EC6'];
  const CARROS = ['#E5484D', '#F4F1EA', '#2B2F33', '#0D74CE', '#C4C9CC', '#F7C948', '#8E857A'];
  const pega = (l, a, b) => l[ruido(a, b) * l.length | 0];
  const ruaGrandePerto = (gx, gz) => { for (const [a, b] of [[0, 3], [0, -2], [3, 0], [-2, 0]]) { const i = idx(Math.min(GW - 1, Math.max(0, gx + a)), Math.min(GH - 1, Math.max(0, gz + b))); if (rua[i] >= 3) return true; } return false; };
  // Empresas da base de CNPJ: cada uma vai para o lote do endereço dela (o lote 2x2 onde cai o ponto da rua).
  const SETOR_COR = { 'Comércio': '#FF7A2F', 'Serviços': '#0D74CE', 'Indústria': '#8E4EC6', 'Agropecuária': '#18A957', 'Construção': '#B07A45' };
  const porLote = new Map(), construidas = new Set();
  for (const e of comercios) {
    if (e.x == null) continue;
    const gx = Math.round(e.x + cx) & ~1, gz = Math.round(e.z + cz) & ~1, k = gx + ',' + gz;
    const ja = porLote.get(k); if (!ja || (e.porte === 'DEMAIS' && ja.porte !== 'DEMAIS') || (e.ace && !ja.ace)) porLote.set(k, e);
  }
  // Empresa cujo lote é rua/praça: tenta o lote vizinho livre mais perto (fica do lado da rua dela).
  const lotesEmpresa = new Map();
  const loteLivre = (gx, gz) => { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = idx(gx + a, gz + b); if (!dentro(gx + a, gz + b) || rua[i] || area[i] || reservado[i]) return false; } return true; };
  for (const [k, e] of porLote) {
    const [gx, gz] = k.split(',').map(Number);
    let achou = null;
    for (const [a, b] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const kk = (gx + a) + ',' + (gz + b); if (lotesEmpresa.has(kk)) continue;
      if (gx + a >= 0 && gz + b >= 0 && gx + a < GW - 1 && gz + b < GH - 1 && loteLivre(gx + a, gz + b)) { achou = kk; break; }
    }
    if (achou) lotesEmpresa.set(achou, e);
  }
  for (let gz = 0; gz < GH - 1; gz += 2) for (let gx = 0; gx < GW - 1; gx += 2) {
    const empresa = lotesEmpresa.get(gx + ',' + gz) || null;
    let livre = true;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = idx(gx + a, gz + b);
      if (!dentro(gx + a, gz + b) || rua[i] || area[i] || reservado[i] || (!empresa && !urbano(gx + a, gz + b))) { livre = false; break; }
    }
    if (!livre) continue;
    const n = ruido(gx, gz), x = gx - cx + 1, z = gz - cz + 1, y = Y(nivel[idx(gx, gz)]);
    // Frente para a rua mais próxima.
    let fx = 0, fz = 1;
    for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const gg = idx(Math.min(GW - 1, Math.max(0, gx + a * 2 + (a > 0 ? 1 : 0))), Math.min(GH - 1, Math.max(0, gz + b * 2 + (b > 0 ? 1 : 0)))); if (rua[gg]) { fx = a; fz = b; break; } }
    const lado = fz ? [1, 0] : [0, 1];
    // Na frente (f) e ao longo da fachada (l): converte para x/z.
    const em = (f, l) => [x + fx * f + lado[0] * l, z + fz * f + lado[1] * l];
    const faceW = (w) => (fz ? w : .05), faceD = (w) => (fz ? .05 : w);
    if (!empresa && n > .86) { // quintal com árvore frutífera
      detalhes.push({ x, y, z, w: 1.8, h: .04, d: 1.8, cor: '#9CCB7A' });
      detalhes.push({ x, y, z, w: .14, h: .55, d: .14, cor: '#7A5534' }, { x, y: y + .5, z, w: .9, h: .7, d: .9, cor: '#5FA34E' }, { x: x + .2, y: y + .8, z: z + .3, w: .1, h: .1, d: .1, cor: '#F76808' });
      continue;
    }
    // Com empresa no lote: comércio com a cor do setor (médio/grande porte vira prédio ou galpão).
    // Sem empresa: a casa de bairro de sempre (na rua grande, sem cadastro, continua podendo ser lojinha).
    const galpao = empresa && (empresa.setor === 'Indústria' || /atacad|distribuid|galp/i.test(empresa.nome + ' ' + (empresa.endereco || '')));
    const comercio = empresa ? true : ruaGrandePerto(gx, gz) && n < .3;
    const perto = Math.hypot(gx - cx, gz - cz);
    const tipo = empresa ? (empresa.porte === 'DEMAIS' && !galpao ? 'predio' : 'comercio') : comercio ? 'comercio' : perto < 45 && n < .05 ? 'predio' : n < .22 ? 'sobrado' : n < .42 ? 'muro' : 'casa';
    if (empresa) construidas.add(empresa.cnpj || empresa.nome);
    const andares = tipo === 'predio' ? (empresa ? 3 : 3 + (ruido(gz, gx) * 2 | 0)) : tipo === 'sobrado' || (tipo === 'comercio' && (empresa ? empresa.porte === 'EPP' : n < .25)) ? 2 : 1;
    const h = andares === 1 ? .95 : andares * .8 + .1;
    const lw = 1.55 + ruido(gx + 1, gz) * .3, ld = 1.55 + ruido(gx, gz + 1) * .3;
    const parede = tipo === 'predio' ? pega(['#E8EEF0', '#F4EFE6', '#DCE7D9', '#EDE3CF'], gx, gz) : pega(PAREDES, gx + 3, gz + 9);
    casas.push({ x, y, z, w: lw, d: ld, h, cor: parede });
    // Faixa colorida no rodapé (barrado), como nas casas do interior.
    if (tipo !== 'predio' && n < .7) { const [bx, bz] = em(lw / 2 + .01, 0); detalhes.push({ x: bx, y, z: bz, w: faceW(lw), h: .16, d: faceD(lw), cor: pega(FAIXAS, gx + 6, gz) }); }
    // Porta e janelas (com moldura clara).
    const [dx, dz] = em((fz ? ld : lw) / 2 + .02, -.3);
    detalhes.push({ x: dx, y, z: dz, w: faceW(.32), h: .58, d: faceD(.32), cor: pega(PORTAS, gx + 1, gz + 4) });
    for (let a = 0; a < andares; a++) for (const l of a ? [-.35, .35] : [.38]) {
      const [wx, wz] = em((fz ? ld : lw) / 2 + .03, l);
      detalhes.push({ x: wx, y: y + .26 + a * .8, z: wz, w: faceW(.4), h: .34, d: faceD(.4), cor: '#F4F1EA' });
      const [px2, pz2] = em((fz ? ld : lw) / 2 + .07, l); detalhes.push({ x: px2, y: y + .24 + a * .8, z: pz2, w: fz ? .44 : .08, h: .04, d: fz ? .08 : .44, cor: '#D9D2C2' });
      ((a + gx + gz) % 5 === 0 ? luzes : detalhes).push({ x: wx + fx * .01, y: y + .31 + a * .8, z: wz + fz * .01, w: faceW(.28), h: .24, d: faceD(.28), cor: (a + gx + gz) % 5 === 0 ? '#FFE2A8' : '#4E6A78' });
    }
    if (tipo === 'sobrado') { // varanda com guarda-corpo no segundo andar
      const [vx, vz] = em((fz ? ld : lw) / 2 + .3, 0);
      detalhes.push({ x: vx, y: y + .78, z: vz, w: fz ? lw * .8 : .6, h: .06, d: fz ? .6 : lw * .8, cor: '#D9D2C2' }, { x: vx + fx * .27, y: y + .84, z: vz + fz * .27, w: fz ? lw * .8 : .05, h: .28, d: fz ? .05 : lw * .8, cor: '#3A3F44' });
    }
    if (tipo === 'comercio') { // toldo listrado e placa
      const cor = (empresa && SETOR_COR[empresa.setor]) || pega(TOLDOS, gx + 2, gz + 8), [tx, tz] = em((fz ? ld : lw) / 2 + .28, 0);
      for (let k = 0; k < 4; k++) { const [sx, sz] = em((fz ? ld : lw) / 2 + .28, -lw / 2 + .2 + k * (lw - .4) / 3); detalhes.push({ x: sx, y: y + .72, z: sz, w: fz ? (lw - .3) / 4 : .55, h: .08, d: fz ? .55 : (lw - .3) / 4, cor: k % 2 ? '#FFFFFF' : cor }); }
      const [px, pz] = em((fz ? ld : lw) / 2 + .03, 0); detalhes.push({ x: px, y: y + h - .3, z: pz, w: faceW(lw * .8), h: .22, d: faceD(lw * .8), cor });
      luzes.push({ x: tx, y: y + .05, z: tz, w: fz ? lw * .5 : .04, h: .45, d: fz ? .04 : lw * .5, cor: '#FFF1D2' });
    }
    if (tipo === 'predio' && empresa) { // placa no alto da fachada, na cor do setor
      const [px, pz] = em((fz ? ld : lw) / 2 + .04, 0); luzes.push({ x: px, y: y + h - .35, z: pz, w: faceW(lw * .7), h: .26, d: faceD(lw * .7), cor: SETOR_COR[empresa.setor] || '#FF7A2F' });
    }
    if (tipo === 'muro') { // muro com portão colorido
      const [mx, mz] = em((fz ? ld : lw) / 2 + .45, 0);
      detalhes.push({ x: mx, y, z: mz, w: fz ? 1.95 : .08, h: .38, d: fz ? .08 : 1.95, cor: pega(PAREDES, gx + 9, gz + 1) });
      const [gx2, gz2] = em((fz ? ld : lw) / 2 + .46, .45); detalhes.push({ x: gx2, y, z: gz2, w: fz ? .5 : .09, h: .42, d: fz ? .09 : .5, cor: pega(FAIXAS, gx, gz + 3) });
    }
    if (tipo === 'casa' && ruido(gx + 21, gz + 5) < .62) {
      const f0 = (fz ? ld : lw) / 2 + .42, corMuro = pega(PAREDES, gx + 9, gz + 1);
      for (const [l0, l1] of [[-1, -.08], [.52, 1]]) { const [mx, mz] = em(f0, (l0 + l1) / 2); const w = (l1 - l0); detalhes.push({ x: mx, y, z: mz, w: fz ? w : .08, h: .34, d: fz ? .08 : w, cor: corMuro }); }
      const [gx2, gz2] = em(f0, .22); detalhes.push({ x: gx2, y, z: gz2, w: fz ? .58 : .06, h: .36, d: fz ? .06 : .58, cor: pega(['#3A3F44', '#2E5E8C', '#3E7D4F', '#7A5534'], gx + 4, gz) });
      const [px3, pz3] = em(f0 - .22, -.6); detalhes.push({ x: px3, y, z: pz3, w: .2, h: .32, d: .2, cor: '#5FA34E' });
    }
    // Telhado: duas águas em degraus (telha) ou laje com platibanda e caixa d'água.
    const laje = tipo === 'predio' || tipo === 'comercio' || ruido(gx + 7, gz + 11) < .35;
    if (laje) {
      const corLaje = pega(LAJES, gx + 2, gz + 5);
      telhados.push({ x, y: y + h, z, w: lw + .06, d: ld + .06, h: .14, cor: corLaje });
      // platibanda: mureta na borda da laje, na cor da parede
      for (const [ox, oz, w, d] of [[0, ld / 2, lw + .06, .06], [0, -ld / 2, lw + .06, .06], [lw / 2, 0, .06, ld + .06], [-lw / 2, 0, .06, ld + .06]]) detalhes.push({ x: x + ox, y: y + h + .14, z: z + oz, w, h: .12, d, cor: parede });
      if (ruido(gx + 9, gz + 4) < .45) { // caixa d'água azul sobre base de concreto, com tampa
        const tx = x + (lw / 2 - .35) * (ruido(gx, gz + 3) < .5 ? 1 : -1), tz = z - (ld / 2 - .35);
        detalhes.push({ x: tx, y: y + h + .14, z: tz, w: .44, h: .1, d: .44, cor: '#B9B2A2' }, { x: tx, y: y + h + .24, z: tz, w: .38, h: .26, d: .38, cor: '#2F6FB0' }, { x: tx, y: y + h + .5, z: tz, w: .3, h: .04, d: .3, cor: '#5C93C8' });
      }
    } else {
      const telha = pega(TELHAS, gx + 5, gz + 2), passos = 3, aoLongo = ruido(gx, gz + 7) < .5;
      for (let k = 0; k < passos; k++) {
        const enc = 1 - k / passos;
        telhados.push({ x, y: y + h + k * .13, z, w: aoLongo ? lw + .16 : (lw + .16) * enc, h: .14, d: aoLongo ? (ld + .16) * enc : ld + .16, cor: k % 2 ? telha : TELHAS[(TELHAS.indexOf(telha) + 1) % TELHAS.length] });
      }
      // cumeeira escura no topo e beiral claro na borda (de perto)
      detalhes.push({ x, y: y + h + passos * .13, z, w: aoLongo ? lw + .18 : .12, h: .05, d: aoLongo ? .12 : ld + .18, cor: '#8E3A26' });
      detalhes.push({ x, y: y + h - .04, z, w: lw + .22, h: .05, d: ld + .22, cor: '#F2ECE0' });
    }
    // Carro estacionado na rua em frente, de vez em quando.
    if (ruido(gx + 11, gz + 13) < .09) {
      const [cxr, czr] = em((fz ? ld : lw) / 2 + 1.05, .2), cor = pega(CARROS, gx, gz + 5), comprido = fz ? [.75, .38] : [.38, .75];
      detalhes.push({ x: cxr, y: y + .06, z: czr, w: comprido[0], h: .2, d: comprido[1], cor }, { x: cxr, y: y + .26, z: czr, w: comprido[0] * .6, h: .16, d: comprido[1] * .9, cor: '#BFD9E2' });
    }
  }
  // Postes de luz ao longo das avenidas.
  for (let gz = 0; gz < GH; gz += 6) for (let gx = 0; gx < GW; gx += 6) {
    const i = idx(gx, gz); if (!dentro(gx, gz) || rua[i] < 3) continue;
    const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, b]) => dentro(gx + a, gz + b) && !rua[idx(gx + a, gz + b)]);
    if (!viz) continue;
    const x = gx - cx + .5 + viz[0] * .8, z = gz - cz + .5 + viz[1] * .8, y = Y(nivel[i]);
    detalhes.push({ x, y, z, w: .08, h: 1.6, d: .08, cor: '#5A6268' }); luzes.push({ x, y: y + 1.55, z, w: .22, h: .1, d: .22, cor: '#FFF1C2' });
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
  // ----- Ruas como faixas contínuas, no traçado real do OpenStreetMap -----
  // (o chão em quadrados de 10 m deixava as diagonais serrilhadas: Irecê não aparecia)
  {
    const pos = [], cor = [], ind = []; let v = 0;
    const ASF = new THREE.Color('#6F7377'), AV = new THREE.Color('#5E6266'), TERRA = new THREE.Color('#C9AE80'), FAIXA = new THREE.Color('#F2C230'), BRANCO = new THREE.Color('#ECEBE6');
    const quad = (ax, az, bx, bz, w, alt, c) => {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < .01) return;
      const ux = dx / L, uz = dz / L, nx = -uz * w, nz = ux * w, ex = ux * w * .9, ez = uz * w * .9; // estende um pouco para fechar as juntas
      const P = [[ax - ex + nx, az - ez + nz], [ax - ex - nx, az - ez - nz], [bx + ex - nx, bz + ez - nz], [bx + ex + nx, bz + ez + nz]];
      for (const [x, z] of P) { pos.push(x, alturaEm(x, z) + alt, z); cor.push(c.r, c.g, c.b); }
      ind.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    };
    // Recorta o trecho [a,b] no disco da maquete (raio um pouco menor, para não passar da moldura).
    const recortar = (ax, az, bx, bz) => {
      const R = RAIO - 1.4, px = ax - CENTRO_RECORTE.x, pz = az - CENTRO_RECORTE.z, dx = bx - ax, dz = bz - az;
      const A = dx * dx + dz * dz, B = 2 * (px * dx + pz * dz), Cq = px * px + pz * pz - R * R;
      if (A < 1e-9) return Cq < 0 ? [ax, az, bx, bz] : null;
      const D = B * B - 4 * A * Cq; if (D <= 0) return null;
      const t0 = Math.max(0, (-B - Math.sqrt(D)) / (2 * A)), t1 = Math.min(1, (-B + Math.sqrt(D)) / (2 * A));
      if (t1 <= t0) return null;
      return [ax + dx * t0, az + dz * t0, ax + dx * t1, az + dz * t1];
    };
    for (const r of dados.ruas) {
      const m = Math.floor(r.p.length / 4) * 2, gm = [Math.floor(r.p[m]), Math.floor(r.p[m + 1])];
      if (!dentro(gm[0], gm[1]) && !r.p.some((_, k) => k % 2 === 0 && dentro(Math.floor(r.p[k]), Math.floor(r.p[k + 1])))) continue;
      const urb = urbano(gm[0], gm[1]), larga = r.l >= 2.8;
      const w = Math.max(.32, r.l * .4), c = !urb && r.l < 2.4 ? TERRA : larga ? AV : ASF;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        let ax = r.p[i] - cx, az = r.p[i + 1] - cz, bx = r.p[i + 2] - cx, bz = r.p[i + 3] - cz;
        const corte = recortar(ax, az, bx, bz); if (!corte) continue;
        [ax, az, bx, bz] = corte;
        quad(ax, az, bx, bz, w, .07, c);
        if (larga && r.l < 3.4) quad(ax, az, bx, bz, .045, .09, FAIXA);           // faixa amarela no meio
        else if (larga) { quad(ax, az, bx, bz, w * .92, .085, AV); }               // avenida com canteiro: o canteiro vem por cima
        if (urb && larga) { // meio-fio claro só nas avenidas (nas ruas pequenas a calçada da imagem já marca a borda)
          const L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
          for (const sgn of [-1, 1]) quad(ax + nx * w * sgn, az + nz * w * sgn, bx + nx * w * sgn, bz + nz * w * sgn, .05, .08, BRANCO);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    geo.setIndex(ind); geo.computeVertexNormals();
    const ruas = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide }));
    ruas.receiveShadow = true;
    motor.adicionar(ruas);
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
  const pintaBloco = (b) => { const x0 = Math.floor(b.x - b.w / 2 + cx), x1 = Math.ceil(b.x + b.w / 2 + cx), z0 = Math.floor(b.z - b.d / 2 + cz), z1 = Math.ceil(b.z + b.d / 2 + cz); tmp.set(b.cor); for (let gz = z0; gz < z1; gz++) for (let gx = x0; gx < x1; gx++) pinta(gx, gz, tmp); };
  for (const b of casas) pintaBloco(b);
  for (const b of telhados) if (b.w > .8) pintaBloco(b);
  imagem.needsUpdate = true;
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
      const ver = q.detalhe ? c.y < 150 && d < 95 + c.y * .2 : true;
      mudou = mudou || q.m.visible !== ver; q.m.visible = ver;
    }
    return mudou;
  });
  // Abre espaço na cidade já montada (a sede de um cliente no endereço dele): some com o que estiver no quadrado.
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function limparArea(x, z, r) {
    for (const [m, lista] of malhas) {
      let mudou = false;
      lista.forEach((b, k) => { if (Math.abs(b.x - x) < r && Math.abs(b.z - z) < r) { m.setMatrixAt(k, zero); mudou = true; } });
      if (mudou) m.instanceMatrix.needsUpdate = true;
    }
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
  const troncos = [], copas = [];
  const VERDES = ['#5FA34E', '#4F9A4E', '#6FB35C', '#7DBB5E', '#548F43'];
  for (let gz = 1; gz < GH - 1; gz++) for (let gx = 1; gx < GW - 1; gx++) {
    const i = idx(gx, gz);
    if (!dentro(gx, gz) || rua[i] || reservado[i] || area[i] === 2) continue;
    const n = ruido(gx * 5 + 11, gz * 3 + 7);
    const naPraca = area[i] === 1 && n < .22, noCampo = !urbano(gx, gz) && n < (ruido((gx >> 3) + 7, (gz >> 3) + 3) < .18 ? .3 : .012);
    const naRua = urbano(gx, gz) && !area[i] && n < .028;
    if (!naPraca && !noCampo && !naRua) continue;
    const x = gx - cx + .5, z = gz - cz + .5, y = Y(nivel[i]), s = .7 + ruido(gz, gx) * .6;
    // Espécies do sertão de Irecê: na cidade, coqueiro e ipê (amarelo, rosa, roxo) entre as árvores de rua;
    // na roça, mandacaru, umbuzeiro de copa larga e árvores de verde mais seco.
    const esp = ruido(gx * 7 + 3, gz * 13 + 5);
    if (!noCampo && esp < .16) { // coqueiro
      troncos.push({ x, y, z, w: .14, d: .14, h: 1.9 * s, cor: '#9C7A55' });
      const t = y + 1.9 * s, v = '#4E9A43';
      copas.push({ x, y: t, z, w: 1.5 * s, d: .22, h: .14, cor: v }, { x, y: t, z, w: .22, d: 1.5 * s, h: .14, cor: v }, { x, y: t + .1, z, w: .5, d: .5, h: .22, cor: '#5FA34E' });
      continue;
    }
    if (!noCampo && esp < .3) { // ipê florido
      const flor = ['#F2C230', '#E87FB0', '#B98AE0'][ruido(gx + 9, gz + 4) * 3 | 0];
      troncos.push({ x, y, z, w: .2, d: .2, h: .8 * s, cor: '#6E4B33' });
      copas.push({ x, y: y + .7 * s, z, w: 1.15 * s, d: 1.15 * s, h: .75 * s, cor: flor }, { x, y: y + 1.4 * s, z, w: .65 * s, d: .65 * s, h: .35 * s, cor: flor });
      continue;
    }
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
    const verdes = noCampo ? ['#7FA35A', '#8DAA5E', '#6E9A4B', '#5FA34E'] : VERDES;
    troncos.push({ x, y, z, w: .22, d: .22, h: .7 * s, cor: '#7A5534' });
    copas.push({ x, y: y + .6 * s, z, w: 1.05 * s, d: 1.05 * s, h: .9 * s, cor: verdes[ruido(gx, gz * 2) * verdes.length | 0] });
    if (s > 1.05) copas.push({ x, y: y + 1.45 * s, z, w: .6 * s, d: .6 * s, h: .45 * s, cor: verdes[(ruido(gx * 2, gz) * verdes.length) | 0] });
  }
  // Árvores também em quadrantes (descartadas fora da tela); troncos só de perto.
  {
    const qs = (lista, op, detalhe) => { const g = new Map(); for (const b of lista) { const k = Math.floor(b.x / 80) + ',' + Math.floor(b.z / 80); let l = g.get(k); if (!l) g.set(k, l = []); l.push(b); }
      return [...g].map(([k, l]) => { const m = blocos(l, op); m.computeBoundingSphere(); const [qx, qz] = k.split(',').map(Number); motor.adicionar(m); return { m, cx: (qx + .5) * 80, cz: (qz + .5) * 80, detalhe }; }); };
    for (const b of copas) { const gx = Math.round(b.x + cx - .5), gz = Math.round(b.z + cz - .5); tmp.set(b.cor); pinta(gx, gz, tmp, .92); }
    imagem.needsUpdate = true;
    const arv = [...qs(troncos, { sombra: false }, true), ...qs(copas, { sombra: true }, false)];
    motor.animar(() => { let mudou = false; const c = motor.camera.position, alvo = motor.estado?.().alvo || c; for (const q of arv) { const d = Math.hypot(alvo.x - q.cx, alvo.z - q.cz); const ver = q.detalhe ? c.y < 160 && d < 110 : true; mudou = mudou || q.m.visible !== ver; q.m.visible = ver; } return mudou; });
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
      b.castShadow = true; g.add(b);
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
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material || new THREE.MeshStandardMaterial({ roughness: .85 }), Math.max(1, lista.length));
  const m = new THREE.Matrix4(), c = new THREE.Color();
  lista.forEach((b, k) => {
    m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.y + b.h / 2, b.z);
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
