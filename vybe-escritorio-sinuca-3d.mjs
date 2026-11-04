// Sinuca em 3D (Paulo, 04/11/2026: "câmera 3D atrás do taco... dá pra fazer bem
// feito sem deixar pesado?"). Só DESENHA: a física, a animação (os quadros e as
// trilhas do servidor), os sons e as regras continuam em vybe-escritorio-sinuca.js,
// que entrega aqui, a cada pintura, onde está cada bola, o taco e a mira.
// Leve de propósito: 16 esferas, a mesa, o taco e três luzes; sombra só das
// bolas; resolução com teto de 1,5x; desenha só quando algo mudou (parado, a
// placa de vídeo descansa). O build empacota este arquivo em
// /assets/jogos/sinuca-3d.js, que só carrega quando alguém abre a sinuca.
import {
  WebGLRenderer, Scene, Color, Fog, PerspectiveCamera, OrthographicCamera, AmbientLight, HemisphereLight, SpotLight,
  PointLight, Mesh, Group, Shape, Path, ExtrudeGeometry, ShapeGeometry, BackSide, PlaneGeometry, BoxGeometry, SphereGeometry, CylinderGeometry, RingGeometry, CircleGeometry,
  MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, TextureLoader, SRGBColorSpace, RepeatWrapping, PCFSoftShadowMap,
  Vector3, Quaternion, BufferGeometry, Float32BufferAttribute, LineDashedMaterial, Line, Raycaster, Vector2, Plane, MathUtils,
  ACESFilmicToneMapping, PMREMGenerator,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function criarCena3d(alvo, { mesa: geo, raio, raioBranca, visual: visualInicial, tacoDesenhar }) {
  let visual = visualInicial;
  const MY = geo.metricaY, A = geo.arte, P = A.pano;
  const ux = P.largura / 100, uy = P.altura / 50;                  // px da arte por unidade
  const arteX0 = -P.x / ux, arteX1 = (A.largura - P.x) / ux;        // a arte inteira em unidades
  const arteY0 = -P.y / uy, arteY1 = (A.altura - P.y) / uy;
  const mundo = (x, y) => [x, y * MY];                               // Z métrico, como a física
  const R = raio, RB = raioBranca || raio;                          // a branca de 57 mm é maior
  const renderer = new WebGLRenderer({ canvas: alvo, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
  let razao = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(razao);
  const cena = new Scene();
  cena.background = new Color(0x15100c); cena.fog = new Fog(0x15100c, 170, 380);
  // Reflexo de ambiente (uma sala neutra pré-calculada uma vez): dá o brilho de
  // resina nas bolas e no verniz da madeira, sem custo por quadro.
  const pmrem = new PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; cena.environmentIntensity = 0.35;
  pmrem.dispose();
  const cx = 50, cz = 25 * MY;

  // --- Luz de bar: o lustre forte sobre a mesa, o resto escuro ---------------
  // Luz de bar: um lustre forte com cone suave (o pano cai de luz nas bordas) e
  // pouco preenchimento, para ter contraste. Uma luz com sombra só: leve.
  cena.add(new AmbientLight(0xfff4e6, 0.12));
  cena.add(new HemisphereLight(0xfff1d6, 0x120c08, 0.22));
  const lustre = new SpotLight(0xffe6bf, 6200, 0, MathUtils.degToRad(56), 0.9, 1.7);
  lustre.position.set(cx, 70, cz); lustre.target.position.set(cx, 0, cz);
  lustre.castShadow = true; lustre.shadow.mapSize.set(2048, 2048); lustre.shadow.bias = -0.00015; lustre.shadow.normalBias = 0.02; lustre.shadow.radius = 2.5;
  lustre.shadow.camera.near = 40; lustre.shadow.camera.far = 90; lustre.shadow.camera.fov = 70;
  cena.add(lustre, lustre.target);
  // Um recorte fraco por trás (separa as bolas do fundo), sem sombra.
  const recorte = new PointLight(0xffd9a0, 60, 160, 2); recorte.position.set(cx, 30, cz - 70); cena.add(recorte);

  // --- Mesa: o pano (a arte) e a madeira, as borrachas e as bocas em volume ---
  const carregador = new TextureLoader();
  const texMesa = carregador.load(A.arquivo, () => pedir());
  texMesa.colorSpace = SRGBColorSpace; texMesa.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [ax0, az0] = mundo(arteX0, arteY0), [ax1, az1] = mundo(arteX1, arteY1);
  const pano = new Mesh(new PlaneGeometry(ax1 - ax0, az1 - az0), new MeshStandardMaterial({ map: texMesa, roughness: 0.88, metalness: 0, envMapIntensity: 0.15 }));
  pano.rotation.x = -Math.PI / 2; pano.position.set((ax0 + ax1) / 2, 0, (az0 + az1) / 2); pano.receiveShadow = true;
  cena.add(pano);
  // --- Materiais feitos aqui (sem esperar arquivo): nogueira envernizada e feltro ---
  // Nogueira: veios ondulados desenhados num canvas, com verniz (clearcoat).
  const texNogueira = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#5a2c14'; g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 140; i++) {
      const y0 = Math.random() * 256, amp = 2 + Math.random() * 6, f = 0.004 + Math.random() * 0.01, fase = Math.random() * 6;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '30,12,4' : '120,62,28'},${0.12 + Math.random() * 0.25})`; g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath(); for (let x = 0; x <= 1024; x += 8) { const y = y0 + Math.sin(x * f + fase) * amp + Math.sin(x * f * 3.1) * amp * 0.3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8; return t;
  })();
  const texFeltro = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const k = 0.94 + Math.random() * 0.1; img.data[i] = 28 * k; img.data[i + 1] = 104 * k; img.data[i + 2] = 70 * k; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(6, 6); return t;
  })();
  // Verniz acetinado: com brilho forte o reflexo rasante estourava a tabela de branco.
  const madeira = new MeshPhysicalMaterial({ map: texNogueira, color: 0xa86a48, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.12 });
  const feltro = new MeshStandardMaterial({ map: texFeltro, color: 0xffffff, roughness: 0.9, side: 2, envMapIntensity: 0.15 });
  // --- O salão em volta: piso de tábua na penumbra e a parede do bar ao fundo ---
  const texChao = carregador.load('/assets/jogos/boteco-madeira.webp', () => { texChao.needsUpdate = true; pedir(); });
  texChao.colorSpace = SRGBColorSpace; texChao.wrapS = texChao.wrapT = RepeatWrapping; texChao.repeat.set(12, 12);
  const piso = new Mesh(new PlaneGeometry(700, 700), new MeshStandardMaterial({ map: texChao, color: 0x8a6448, roughness: 0.75 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(cx, -24, cz); piso.receiveShadow = true; cena.add(piso);
  const texParede = carregador.load('/assets/jogos/boteco-ambiente.webp', () => pedir()); texParede.colorSpace = SRGBColorSpace;
  const parede = new Mesh(new PlaneGeometry(520, 292), new MeshStandardMaterial({ map: texParede, color: 0x6a6a6a, roughness: 0.95 }));
  parede.position.set(cx, 90, cz - 170); cena.add(parede);
  // Pés torneados e a saia da mesa.
  const H = 1.9, costas = 2.15;                                     // altura da tabela e fundo das borrachas (unidades)
  for (const [px, pz] of [[ax0 + 7, az0 + 7], [ax1 - 7, az0 + 7], [ax0 + 7, az1 - 7], [ax1 - 7, az1 - 7], [cx, az0 + 7], [cx, az1 - 7]]) {
    const p = new Mesh(new CylinderGeometry(2.6, 1.8, 17, 24), madeira); p.position.set(px, -15.5, pz); p.castShadow = true; cena.add(p);
  }
  const saiaGeo = new BoxGeometry(ax1 - ax0 - 1, 6, az1 - az0 - 1);
  const saia = new Mesh(saiaGeo, madeira); saia.position.set((ax0 + ax1) / 2, -7.2, (az0 + az1) / 2); cena.add(saia);
  // --- Tabela de madeira inteiriça, com o recorte redondo de cada boca ---------
  const [ix0, iz0] = mundo(-costas, -costas / MY), [ix1, iz1] = mundo(100 + costas, 50 + costas / MY);
  const bocas = geo.buracos.map(([bx, by, br]) => { const [x, z] = mundo(bx, by); return { x, z, r: br * MY }; });
  const dentroFuro = (x, z) => (x >= ix0 && x <= ix1 && z >= iz0 && z <= iz1) || bocas.some((b) => (x - b.x) ** 2 + (z - b.z) ** 2 <= (b.r * 1.02) ** 2);
  const furo = new Path();
  for (let k = 0; k <= 1440; k++) {
    const a = (k / 1440) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let t = 0; while (t < 200 && dentroFuro(cx + dx * (t + 0.05), cz + dz * (t + 0.05))) t += 0.05;
    const x = cx + dx * t, z = cz + dz * t; if (k) furo.lineTo(x, -z); else furo.moveTo(x, -z);
  }
  const contorno = new Shape(); contorno.moveTo(ax0, -az0); contorno.lineTo(ax1, -az0); contorno.lineTo(ax1, -az1); contorno.lineTo(ax0, -az1); contorno.lineTo(ax0, -az0);
  contorno.holes.push(furo);
  const tabelaGeo = new ExtrudeGeometry(contorno, { depth: H + 3.9, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.35, bevelSegments: 4, curveSegments: 4 });
  tabelaGeo.rotateX(-Math.PI / 2); tabelaGeo.translate(0, -4.2, 0);
  // Os veios correm ao longo de cada tabela: UV em unidades do mundo, 26 por placa.
  const uvT = tabelaGeo.attributes.uv; for (let i = 0; i < uvT.count; i++) uvT.setXY(i, uvT.getX(i) / 26, uvT.getY(i) / 26);
  const tabela = new Mesh(tabelaGeo, madeira); tabela.receiveShadow = true; tabela.castShadow = false; cena.add(tabela);
  // --- Borrachas com perfil de verdade: topo reto, nariz chanfrado a 63% da bola,
  // rebaixo embaixo do nariz e as pontas cortadas no ângulo dos cortes das bocas.
  const NARIZ_ALT = 0.63 * 2 * R;
  const perfil = [[0.28, 0], [0, NARIZ_ALT], [0.16, H], [1, H], [1, 0]];   // [fração do nariz às costas, altura]
  const dentes = geo.paredes.slice(6);
  const borracha = (nA, nB, oA, oB) => {
    const pos = [], ponto = (fim, [v, h]) => { const n = fim ? nB : nA, o = fim ? oB : oA; return [n[0] + (o[0] - n[0]) * v, h, n[1] + (o[1] - n[1]) * v]; };
    const tri = (a, b, c) => pos.push(...a, ...b, ...c);
    for (let i = 0; i < perfil.length - 1; i++) { const a0 = ponto(0, perfil[i]), a1 = ponto(0, perfil[i + 1]), b0 = ponto(1, perfil[i]), b1 = ponto(1, perfil[i + 1]); tri(a0, b0, b1); tri(a0, b1, a1); }
    for (const fim of [0, 1]) { const p = perfil.map((q) => ponto(fim, q)); for (let i = 1; i < p.length - 1; i++) tri(p[0], p[i], p[i + 1]); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const uvs = []; for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i] / 4, pos[i + 2] / 4); g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const m = new Mesh(g, feltro); m.receiveShadow = true; cena.add(m);
  };
  // A face do corte segue a linha do dente até encostar na borda do buraco mais
  // perto (o dente da física para antes; a madeira aparecia no meio).
  const ateBuraco = (n, o) => {
    const dx = o[0] - n[0], dz = o[1] - n[1];
    let melhor = o;
    for (const b of bocas) {
      const fx = n[0] - b.x, fz = n[1] - b.z, A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - b.r * b.r, disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t > 0.6 && t < 2.2) { melhor = [n[0] + dx * t, n[1] + dz * t]; break; }
    }
    return melhor;
  };
  for (const [a, b] of [[0, 8], [9, 1], [2, 10], [11, 3], [4, 5], [6, 7]]) {
    const da = dentes[a], db = dentes[b], nA = mundo(da[0], da[1]), nB = mundo(db[0], db[1]);
    borracha(nA, nB, ateBuraco(nA, mundo(da[2], da[3])), ateBuraco(nB, mundo(db[2], db[3])));
  }
  // --- Bocas de verdade (Paulo, 04/11/2026: "parece que tá furada e vazada"): o
  // pano ganha um furo redondo em cada boca, embaixo fica um bolsão de couro
  // fechado, e a parede cortada da madeira é forrada de couro só do lado de fora.
  const furado = new Shape(); furado.moveTo(ax0, -az0); furado.lineTo(ax1, -az0); furado.lineTo(ax1, -az1); furado.lineTo(ax0, -az1); furado.lineTo(ax0, -az0);
  for (const b of bocas) { const h = new Path(); h.absarc(b.x, -b.z, b.r, 0, Math.PI * 2, true); furado.holes.push(h); }
  const panoGeo = new ShapeGeometry(furado, 48); panoGeo.rotateX(-Math.PI / 2);
  const pp = panoGeo.attributes.position, uvP = panoGeo.attributes.uv;
  for (let i = 0; i < pp.count; i++) uvP.setXY(i, (pp.getX(i) - ax0) / (ax1 - ax0), 1 - (pp.getZ(i) - az0) / (az1 - az0));
  pano.geometry.dispose(); pano.geometry = panoGeo; pano.rotation.x = 0; pano.position.set(0, 0, 0);
  const couro = new MeshStandardMaterial({ color: 0x120c08, roughness: 0.8, side: 2, envMapIntensity: 0.1 });
  const bordaCouro = new MeshStandardMaterial({ color: 0x0f0a07, roughness: 0.7, side: 2, envMapIntensity: 0.2 });
  for (const b of bocas) {
    // O bolsão: meia esfera de couro, fechada, logo abaixo do pano.
    const bolsao = new Mesh(new SphereGeometry(b.r, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), couro);
    bolsao.scale.set(1, 1.1, 1); bolsao.position.set(b.x, 0, b.z); bolsao.receiveShadow = true; cena.add(bolsao);
    // A parede da madeira cortada, forrada só no arco de fora (onde há madeira).
    const canto = Math.abs(b.x - cx) > 30, abre = canto ? MathUtils.degToRad(210) : MathUtils.degToRad(180), fora = Math.atan2(b.z - cz, b.x - cx);
    const parede = new Mesh(new CylinderGeometry(b.r, b.r, H, 40, 1, true, Math.PI / 2 - fora - abre / 2, abre), couro);
    parede.position.set(b.x, H / 2, b.z); cena.add(parede);
    const borda = new Mesh(new RingGeometry(b.r * 0.99, b.r * 1.08, 48, 1, -fora - abre / 2, abre), bordaCouro);
    borda.rotation.x = -Math.PI / 2; borda.position.set(b.x, H + 0.02, b.z); cena.add(borda);
  }
  // --- Diamantes de madrepérola embutidos no meio da madeira --------------------
  const perola = new MeshPhysicalMaterial({ color: 0xf4efe2, roughness: 0.25, clearcoat: 1, iridescence: 0.6, envMapIntensity: 1 });
  const diamante = (x, z) => { const m = new Mesh(new CylinderGeometry(0.42, 0.42, 0.04, 4), perola); m.position.set(x, H + 0.01, z); cena.add(m); };
  const meioRegua = (iz0 + az0) / 2, meioRegua2 = (iz1 + az1) / 2, meioLado = (ix0 + ax0) / 2, meioLado2 = (ix1 + ax1) / 2;
  for (const k of [1, 2, 3, 5, 6, 7]) { diamante(100 * k / 8, meioRegua); diamante(100 * k / 8, meioRegua2); }
  for (const k of [1, 2, 3]) { diamante(meioLado, 50 * MY * k / 4); diamante(meioLado2, 50 * MY * k / 4); }
  // --- O lustre de bar: cúpula verde esmaltada e lâmpada acesa -----------------
  const cupula = new Mesh(new CylinderGeometry(6, 16, 7, 48, 1, true), new MeshPhysicalMaterial({ color: 0x1f5a3a, roughness: 0.3, clearcoat: 1, side: 2 }));
  cupula.position.set(cx, 58, cz); cena.add(cupula);
  const lampada = new Mesh(new SphereGeometry(3, 20, 12), new MeshBasicMaterial({ color: 0xfff1cf })); lampada.position.set(cx, 55.5, cz); cena.add(lampada);

  // --- Bolas: esferas com o desenho de cada uma (cor, listra, número) --------
  const texturaBola = (n) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const { cor, listra } = visual(n);
    g.fillStyle = listra || n === 0 ? '#f6f2e6' : cor; g.fillRect(0, 0, 512, 256);
    if (listra) { g.fillStyle = cor; g.fillRect(0, 70, 512, 116); }
    if (n) for (const u of [128, 384]) {
      g.fillStyle = '#fbf8ef'; g.beginPath(); g.ellipse(u, 128, 44, 40, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.font = `800 ${n > 9 ? 48 : 58}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), u, 131);
    }
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const esfera = new SphereGeometry(R, 40, 24);
  const bolas = [], giro = [];
  for (let n = 0; n < 16; n++) {
    const m = new Mesh(esfera, new MeshPhysicalMaterial({ map: texturaBola(n), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, envMapIntensity: 0.6 }));
    m.castShadow = true; m.visible = false; m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    cena.add(m); bolas.push(m); giro.push(null);
  }
  // Sombra de contato (as bolas pareciam flutuar): escura no meio, some na borda;
  // clareia quando a bola pula.
  const texSombra = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.2, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.4, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new CanvasTexture(c); })();
  const sombras = bolas.map(() => { const m = new Mesh(new PlaneGeometry(R * 2.7, R * 2.7), new MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; cena.add(m); return m; });
  const fantasma = new Mesh(esfera, new MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.3 }));
  fantasma.visible = false; cena.add(fantasma);
  // Rola de verdade: gira em volta do eixo deitado, perpendicular ao caminho, distância / raio.
  const eixo = new Vector3(), q = new Quaternion();
  const rolar = (n, x, z) => {
    const g = giro[n];
    if (g) { const dx = x - g[0], dz = z - g[1], d = Math.hypot(dx, dz); if (d > 1e-6 && d < 8 * R) { eixo.set(dz, 0, -dx).normalize(); q.setFromAxisAngle(eixo, d / R); bolas[n].quaternion.premultiply(q); } }
    giro[n] = [x, z];
  };

  // --- Taco: cilindro afinando com o desenho do taco da coleção ---------------
  const tacoTex = {};
  const texTaco = (modelo) => {
    if (tacoTex[modelo]) return tacoTex[modelo];
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
    g.translate(0, 32); tacoDesenhar(g, 1024, 64, modelo, 0, false);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return (tacoTex[modelo] = t);
  };
  const LT = 52, tacoGeo = new CylinderGeometry(0.62, 0.33, LT, 24, 1);          // cabo grosso em cima, ponta fina embaixo
  tacoGeo.translate(0, LT / 2, 0);                                   // a ponta na origem, o cabo para +y
  // O desenho do taco corre ao longo do cilindro (u do canvas = comprimento).
  const uv = tacoGeo.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
  const tacos = [0, 1].map(() => { const m = new Mesh(tacoGeo, new MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 })); m.castShadow = true; m.visible = false; cena.add(m); return m; });
  // Reflexo que corre pelos tacos nobres (Ouro e Lenda): uma capa transparente com
  // uma faixa de luz que anda ao longo do taco.
  const NOBRES = new Set(['ouro', 'lenda']);
  const faixa = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 4; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,245,220,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 4); const t = new CanvasTexture(c); t.wrapS = RepeatWrapping; return t; })();
  const capas = tacos.map((m) => { const c = new Mesh(tacoGeo, new MeshBasicMaterial({ map: faixa, transparent: true, depthWrite: false, blending: 2 })); c.scale.set(1.04, 1, 1.04); c.visible = false; m.add(c); return c; });
  const cima = new Vector3(0, 1, 0);
  const porTaco = (m, b, ang, recuo, elev, modelo, efeito = 0, giro = 0) => {
    m.material.map = texTaco(modelo || 'casa'); m.material.needsUpdate = true;
    capas[tacos.indexOf(m)].visible = NOBRES.has(modelo);
    const dir = new Vector3(Math.cos(ang), 0, Math.sin(ang) * MY).normalize();
    const e = MathUtils.degToRad(Math.max(4, elev || 0)), atras = dir.clone().multiplyScalar(-Math.cos(e)).add(new Vector3(0, Math.sin(e), 0)).normalize();
    const lado = new Vector3(-dir.z, 0, dir.x);
    const [x, z] = mundo(b[0], b[1]), ponta = new Vector3(x, RB, z).add(atras.clone().multiplyScalar(RB + 0.15 + recuo))
      .addScaledVector(lado, giro * RB * 0.5).add(new Vector3(0, efeito * RB * 0.5, 0));
    m.position.copy(ponta); m.quaternion.setFromUnitVectors(cima, atras); m.visible = true;
    return ponta;
  };
  // --- Efeitos: brilho na ponta (cresce com a força), clarão e anel no impacto ---
  const aditivo = (cor) => new MeshBasicMaterial({ color: cor, transparent: true, opacity: 0, depthWrite: false, blending: 2 });
  const pontaBrilho = new Mesh(new SphereGeometry(1, 20, 12), aditivo(0xffb36b)); pontaBrilho.visible = false; cena.add(pontaBrilho);
  const anelImpacto = new Mesh(new RingGeometry(0.8, 1, 48), aditivo(0xe8f4ff)); anelImpacto.rotation.x = -Math.PI / 2; anelImpacto.visible = false; cena.add(anelImpacto);
  const clarao = new PointLight(0xfff1dc, 0, 40, 2); cena.add(clarao);
  // --- Mira: a linha que some até onde a branca encosta ----------------------
  const miraGeo = new BufferGeometry(); miraGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  const mira = new Line(miraGeo, new LineDashedMaterial({ color: 0xffffff, dashSize: 0.9, gapSize: 0.7, transparent: true, opacity: 0.75 }));
  mira.visible = false; cena.add(mira);
  // Onde a branca vai encostar: a bola-fantasma translúcida, como nos simuladores.
  const contato = new Mesh(esfera, new MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false }));
  contato.visible = false; cena.add(contato);

  // --- Câmeras -------------------------------------------------------------
  // Lente mais fechada e de mais longe (Paulo: "a mesa tá pequena"): a mesa
  // fica comprida e grande na tela, sem a distorção da grande-angular.
  const persp = new PerspectiveCamera(26, 16 / 9, 1, 900);
  const orto = new OrthographicCamera(ax0, ax1, -az0, -az1, 1, 200);
  // Ortográfica exata de cima: o mesmo enquadramento da arte 2D (o clique na mesa vale igual).
  orto.left = ax0; orto.right = ax1; orto.top = -az0; orto.bottom = -az1; orto.position.set(0, 100, 0);
  orto.rotation.set(-Math.PI / 2, 0, 0); orto.updateProjectionMatrix();
  let modo = 'taco', camAlvo = null, camAtual = null, transicao = 0;
  // Zoom (0,55 a 1,8: menor é mais perto) e altura (-1 baixa a 1 alta), do jogador.
  const vista = { zoom: 1, altura: 0 };
  const camDe = (tipo, branca, ang, elev = 0) => {
    if (tipo === 'alto') {
      // A mesa inteira com margem: distância pela abertura da lente e pela proporção da tela.
      const meiaV = MathUtils.degToRad(persp.fov / 2), meiaH = Math.atan(Math.tan(meiaV) * persp.aspect);
      const precisaV = ((az1 - az0) / 2 + 6) / Math.tan(meiaV), precisaH = ((ax1 - ax0) / 2 + 6) / Math.tan(meiaH);
      const dist = Math.max(precisaV, precisaH) * vista.zoom, inclina = MathUtils.degToRad(68 + 14 * vista.altura);
      return { pos: new Vector3(cx, Math.sin(inclina) * dist, cz + Math.cos(inclina) * dist), olha: new Vector3(cx, 0, cz) };
    }
    const [x, z] = mundo(branca[0], branca[1]), dir = new Vector3(Math.cos(ang), 0, Math.sin(ang) * MY).normalize();
    // Atrás do taco: a altura acompanha o taco inclinado e o ajuste do jogador.
    const subir = Math.min(1, elev / 45) + vista.altura * 0.6, atras = 62 * vista.zoom * (1 - 0.25 * Math.max(0, subir)), alto = (36 + 40 * Math.max(-0.5, subir)) * vista.zoom;
    return { pos: new Vector3(x, 0, z).addScaledVector(dir, -atras).add(new Vector3(0, alto, 0)), olha: new Vector3(x, R, z).addScaledVector(dir, 24 * (1 - 0.4 * Math.max(0, subir))) };
  };

  // --- Tamanho, pedido de quadro e desenho ---------------------------------
  let largura = 0, altura = 0, pedido = false, ultimo = null, mede = [], ultimoCusto = 0;
  const ajustar = () => {
    const w = alvo.clientWidth, h = alvo.clientHeight;
    if (w && h && (w !== largura || h !== altura)) { largura = w; altura = h; renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix(); }
  };
  const pedir = () => { if (!pedido) { pedido = true; requestAnimationFrame(() => { pedido = false; if (ultimo) desenhar(ultimo); }); } };
  const obs = typeof ResizeObserver === 'function' ? new ResizeObserver(() => pedir()) : null; obs?.observe(alvo);

  function desenhar(d) {
    ultimo = d; ajustar();
    const t0 = performance.now();
    // Bolas
    d.bolas.forEach((p, n) => {
      const m = bolas[n];
      if (!p || (n === 0 && d.esconderBranca)) { m.visible = false; sombras[n].visible = false; giro[n] = null; return; }
      const [x, z] = mundo(p[0], p[1]), h = (d.z?.[n] || 0);
      const rr = n === 0 ? RB : R;
      m.visible = true; m.scale.setScalar(rr / R); m.position.set(x, rr + h, z); rolar(n, x, z);
      const sb = sombras[n]; sb.visible = true; // A penumbra escapa para longe do lustre (a luz vem do centro da mesa).
      const lx = x - cx, lz = z - cz, ld = Math.hypot(lx, lz) || 1, fuga = Math.min(0.45, ld / 120) * R; sb.position.set(x + lx / ld * fuga, 0.025, z + lz / ld * fuga); sb.material.opacity = Math.max(0.15, 1 - h / (3 * R)); sb.scale.setScalar(1 + h / (4 * R));
    });
    for (const c of d.caindo || []) { const m = bolas[c.n], [x, z] = mundo(c.x, c.y); m.visible = true; sombras[c.n].visible = false; m.position.set(x, R - (1 - c.escala) * 2.6 * R, z); m.scale.setScalar(Math.max(0.4, c.escala)); }
    if (d.fantasma) { const [x, z] = mundo(d.fantasma[0], d.fantasma[1]); fantasma.position.set(x, R, z); fantasma.visible = true; } else fantasma.visible = false;
    // Tacos (o meu e/ou o do outro, ou o da animação)
    let ponta0 = null;
    tacos.forEach((m, i) => { const t = d.tacos?.[i]; if (t) { const pt = porTaco(m, t.b, t.ang, t.recuo, t.elev, t.modelo, t.efeito, t.giro); if (i === 0) ponta0 = pt; } else m.visible = false; });
    // Brilho na ponta do taco: cresce e pulsa com a força escolhida.
    const f = d.forca || 0;
    if (ponta0 && f > 0.02) {
      const pulso = 0.85 + 0.15 * Math.sin(performance.now() / 90);
      pontaBrilho.position.copy(ponta0); pontaBrilho.scale.setScalar(0.35 + 0.7 * f); pontaBrilho.material.opacity = Math.min(0.45, 0.08 + 0.35 * f) * pulso;
      pontaBrilho.material.color.set(f > 0.8 ? 0xff6a3d : 0xffb36b); pontaBrilho.visible = true; pedir();
    } else pontaBrilho.visible = false;
    // Clarão da tacada: luz que acende na branca e anel que abre no pano.
    if (d.impacto) {
      const [x, z] = mundo(d.impacto.b[0], d.impacto.b[1]), p = d.impacto.p, k = Math.max(0.25, d.impacto.forca || 0.5);
      clarao.position.set(x, R * 2.5, z); clarao.intensity = 260 * (1 - p) * k;
      anelImpacto.position.set(x, 0.06, z); anelImpacto.scale.setScalar(R * (1.2 + 4 * p * k)); anelImpacto.material.opacity = 0.35 * (1 - p); anelImpacto.visible = true;
    } else { clarao.intensity = 0; anelImpacto.visible = false; }
    // Mira
    if (d.mira) {
      const [x, z] = mundo(d.mira.b[0], d.mira.b[1]), dir = new Vector3(Math.cos(d.mira.ang), 0, Math.sin(d.mira.ang) * MY).normalize();
      const fim = new Vector3(x, R * 0.3, z).addScaledVector(dir, Math.max(0, d.mira.dist * Math.hypot(Math.cos(d.mira.ang), Math.sin(d.mira.ang) * MY)));
      miraGeo.attributes.position.setXYZ(0, x, R * 0.3, z); miraGeo.attributes.position.setXYZ(1, fim.x, fim.y, fim.z); miraGeo.attributes.position.needsUpdate = true;
      mira.computeLineDistances(); mira.visible = true;
      if (d.mira.alvo) { contato.position.set(fim.x, R, fim.z); contato.visible = true; } else contato.visible = false;
    } else { mira.visible = false; contato.visible = false; }
    // Câmera: o modo escolhido; na animação, sobe para mostrar a jogada.
    let cam = persp;
    const querCima = modo === 'cima', branca = d.camera?.b, ang = d.camera?.ang ?? 0;
    if ((querCima || d.forcarCima) && !d.animando) cam = orto;
    else {
      const alvoCam = d.animando || !branca ? camDe('alto') : camDe('taco', branca, ang, d.tacos?.[0]?.elev || 0);
      if (!camAtual) camAtual = { pos: alvoCam.pos.clone(), olha: alvoCam.olha.clone() };
      const k = d.animando ? 0.06 : d.suave ? 0.18 : 1;
      camAtual.pos.lerp(alvoCam.pos, k); camAtual.olha.lerp(alvoCam.olha, k);
      persp.position.copy(camAtual.pos); persp.lookAt(camAtual.olha);
      if (camAtual.pos.distanceTo(alvoCam.pos) > 0.05) pedir();
    }
    // O reflexo dos tacos nobres anda: um quadro a cada ~42 ms enquanto aparece.
    if (capas.some((c, i) => c.visible && tacos[i].visible)) { faixa.offset.x = ((performance.now() / 1800) % 1.6) - 0.3; if (!pedido) setTimeout(pedir, 42); }
    cupula.visible = lampada.visible = cam !== orto && persp.position.y < 48; // de cima o lustre não tapa a mesa
    renderer.render(cena, cam);
    // Peso: se o quadro passar de ~20 ms, baixa a resolução (até 1x).
    mede.push(performance.now() - t0); ultimoCusto = mede[mede.length - 1]; if (mede.length > 20) mede.shift();
    if (mede.length === 20 && razao > 1 && mede.reduce((a, b) => a + b) / 20 > 20) { razao = 1; renderer.setPixelRatio(1); largura = 0; mede = []; }
  }
  // Ponto da mesa (unidades) sob o ponteiro, para mirar na câmera de cima.
  const raio3 = new Raycaster(), chao = new Plane(new Vector3(0, 1, 0), -R), ponto = new Vector3();
  function mesaNoPonteiro(px, py) {
    const r = alvo.getBoundingClientRect(), v = new Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    raio3.setFromCamera(v, modo === 'cima' ? orto : persp);
    return raio3.ray.intersectPlane(chao, ponto) ? [ponto.x, ponto.z / MY] : null;
  }
  return {
    desenhar, pedir, mesaNoPonteiro,
    // Zoom e altura da câmera escolhidos pelo jogador (roda do mouse e controles).
    ajustarVista(dz = 0, da = 0) { vista.zoom = MathUtils.clamp(vista.zoom * (1 + dz), 0.55, 1.8); vista.altura = MathUtils.clamp(vista.altura + da, -1, 1); pedir(); return { ...vista }; },
    get vista() { return { ...vista }; }, get custo() { return { ms: ultimoCusto, razao, chamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles }; },
    // Outra modalidade (bola da vez): refaz o desenho das bolas.
    trocarVisual(v) { visual = v; bolas.forEach((m, n) => { m.material.map?.dispose(); m.material.map = texturaBola(n); m.material.needsUpdate = true; }); pedir(); },
    get modo() { return modo; }, set modo(m) { modo = m; camAtual = null; pedir(); },
    destruir() { obs?.disconnect(); renderer.dispose(); },
  };
}
