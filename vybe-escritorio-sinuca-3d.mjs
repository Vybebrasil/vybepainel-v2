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
  PointLight, Mesh, Group, Shape, Path, ExtrudeGeometry, BackSide, PlaneGeometry, BoxGeometry, SphereGeometry, CylinderGeometry, RingGeometry, CircleGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, TextureLoader, SRGBColorSpace, RepeatWrapping, PCFSoftShadowMap,
  Vector3, Quaternion, BufferGeometry, Float32BufferAttribute, LineDashedMaterial, Line, Raycaster, Vector2, Plane, MathUtils,
  ACESFilmicToneMapping, PMREMGenerator,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function criarCena3d(alvo, { mesa: geo, raio, visual: visualInicial, tacoDesenhar }) {
  let visual = visualInicial;
  const MY = geo.metricaY, A = geo.arte, P = A.pano;
  const ux = P.largura / 100, uy = P.altura / 50;                  // px da arte por unidade
  const arteX0 = -P.x / ux, arteX1 = (A.largura - P.x) / ux;        // a arte inteira em unidades
  const arteY0 = -P.y / uy, arteY1 = (A.altura - P.y) / uy;
  const mundo = (x, y) => [x, y * MY];                               // Z métrico, como a física
  const R = raio;
  const renderer = new WebGLRenderer({ canvas: alvo, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
  let razao = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(razao);
  const cena = new Scene();
  cena.background = new Color(0x0b0b0e); cena.fog = new Fog(0x0b0b0e, 150, 320);
  // Reflexo de ambiente (uma sala neutra pré-calculada uma vez): dá o brilho de
  // resina nas bolas e no verniz da madeira, sem custo por quadro.
  const pmrem = new PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; cena.environmentIntensity = 0.35;
  pmrem.dispose();
  const cx = 50, cz = 25 * MY;

  // --- Luz de bar: o lustre forte sobre a mesa, o resto escuro ---------------
  cena.add(new AmbientLight(0xffffff, 0.3));
  cena.add(new HemisphereLight(0xfff1d6, 0x0b1a12, 0.35));
  const lustre = new SpotLight(0xffe2b0, 5200, 0, MathUtils.degToRad(48), 0.55, 1.6);
  lustre.position.set(cx, 62, cz); lustre.target.position.set(cx, 0, cz);
  lustre.castShadow = true; lustre.shadow.mapSize.set(1024, 1024); lustre.shadow.bias = -0.0004; lustre.shadow.radius = 4;
  lustre.shadow.camera.near = 30; lustre.shadow.camera.far = 80;
  cena.add(lustre, lustre.target);
  const brilho = new PointLight(0xfff0d0, 120, 120, 2); brilho.position.set(cx - 30, 40, cz - 10); cena.add(brilho);

  // --- Mesa: o pano (a arte) e a madeira, as borrachas e as bocas em volume ---
  const carregador = new TextureLoader();
  const texMesa = carregador.load(A.arquivo, () => pedir());
  texMesa.colorSpace = SRGBColorSpace; texMesa.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [ax0, az0] = mundo(arteX0, arteY0), [ax1, az1] = mundo(arteX1, arteY1);
  const pano = new Mesh(new PlaneGeometry(ax1 - ax0, az1 - az0), new MeshStandardMaterial({ map: texMesa, roughness: 0.92, metalness: 0 }));
  pano.rotation.x = -Math.PI / 2; pano.position.set((ax0 + ax1) / 2, 0, (az0 + az1) / 2); pano.receiveShadow = true;
  cena.add(pano);
  const texMadeira = carregador.load('/assets/jogos/boteco-madeira.webp', () => pedir());
  texMadeira.colorSpace = SRGBColorSpace; texMadeira.wrapS = texMadeira.wrapT = RepeatWrapping; texMadeira.repeat.set(6, 1);
  const madeira = new MeshStandardMaterial({ map: texMadeira, color: 0x8a4a2a, roughness: 0.45, metalness: 0.05 });
  const verde = new MeshStandardMaterial({ color: 0x1d6a47, roughness: 0.9 });
  // O bar em volta: chão de tábua escura e a parede ao fundo, na penumbra.
  const texChao = carregador.load('/assets/jogos/boteco-madeira.webp', () => pedir());
  texChao.colorSpace = SRGBColorSpace; texChao.wrapS = texChao.wrapT = RepeatWrapping; texChao.repeat.set(10, 10);
  const piso = new Mesh(new PlaneGeometry(600, 600), new MeshStandardMaterial({ map: texChao, color: 0x4a3426, roughness: 0.8 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(cx, -22, cz); piso.receiveShadow = true; cena.add(piso);
  const texParede = carregador.load('/assets/jogos/boteco-ambiente.webp', () => pedir()); texParede.colorSpace = SRGBColorSpace;
  const parede = new Mesh(new PlaneGeometry(420, 236), new MeshStandardMaterial({ map: texParede, color: 0x3a3a3a, roughness: 0.95 }));
  parede.position.set(cx, 70, cz - 150); cena.add(parede);
  const pes = new MeshStandardMaterial({ color: 0x2a160b, roughness: 0.5 });
  for (const [px, pz] of [[ax0 + 6, az0 + 6], [ax1 - 6, az0 + 6], [ax0 + 6, az1 - 6], [ax1 - 6, az1 - 6]]) { const p = new Mesh(new BoxGeometry(5, 15, 5), pes); p.position.set(px, -14.5, pz); cena.add(p); }
  // A saia da mesa embaixo do tampo.
  const saia = new Mesh(new BoxGeometry(ax1 - ax0, 7, az1 - az0), madeira);
  saia.position.set((ax0 + ax1) / 2, -3.51, (az0 + az1) / 2); cena.add(saia);
  // Tabela de madeira com o recorte redondo de cada boca (Paulo, 04/11/2026: a
  // boca parecia uma cartola flutuando): ladrilhos de meia unidade num desenho
  // só (InstancedMesh), pulando os que caem dentro de uma boca.
  const H = 1.9, costas = 2.15;                                     // altura e fundo das borrachas (unidades)
  const [ix0, iz0] = mundo(-costas, -costas / MY), [ix1, iz1] = mundo(100 + costas, 50 + costas / MY);
  const bocas = geo.buracos.map(([bx, by, br]) => { const [x, z] = mundo(bx, by); return { x, z, r: br * MY }; });
  // A forma do furo: o retângulo das costas das borrachas unido aos círculos das
  // bocas, contornado a partir do centro (a união é "estrelada" vista do meio).
  const dentroFuro = (x, z) => (x >= ix0 && x <= ix1 && z >= iz0 && z <= iz1) || bocas.some((b) => (x - b.x) ** 2 + (z - b.z) ** 2 <= (b.r * 1.02) ** 2);
  const furo = new Path();
  for (let k = 0; k <= 1440; k++) {
    const a = (k / 1440) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let t = 0; while (t < 200 && dentroFuro(cx + dx * (t + 0.05), cz + dz * (t + 0.05))) t += 0.05;
    const x = cx + dx * t, z = cz + dz * t; if (k) furo.lineTo(x, -z); else furo.moveTo(x, -z);
  }
  const contorno = new Shape(); contorno.moveTo(ax0, -az0); contorno.lineTo(ax1, -az0); contorno.lineTo(ax1, -az1); contorno.lineTo(ax0, -az1); contorno.lineTo(ax0, -az0);
  contorno.holes.push(furo);
  const tabelaGeo = new ExtrudeGeometry(contorno, { depth: H, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 4 });
  tabelaGeo.rotateX(-Math.PI / 2);
  const madeiraTex = texMadeira.clone(); madeiraTex.repeat.set(0.08, 0.08); madeiraTex.needsUpdate = true;
  const tabela = new Mesh(tabelaGeo, new MeshStandardMaterial({ map: madeiraTex, color: 0x7a4222, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.8 }));
  tabela.receiveShadow = true; cena.add(tabela);
  // Borrachas: do nariz (o que a física usa) até as costas, com a quina de cima clara.
  for (const [x1, y1, x2, y2] of geo.paredes.slice(0, 6)) {
    const [a, b] = mundo(x1, y1), [c, d] = mundo(x2, y2), len = Math.hypot(c - a, d - b);
    const fora = { x: (a + c) / 2 - cx, z: (b + d) / 2 - cz }, nx = -(d - b) / len, nz = (c - a) / len, s = Math.sign(nx * fora.x + nz * fora.z) || 1;
    const m = new Mesh(new BoxGeometry(len, H * 0.92, costas), verde);
    m.position.set((a + c) / 2 + nx * s * costas / 2, H * 0.46, (b + d) / 2 + nz * s * costas / 2);
    m.rotation.y = -Math.atan2(d - b, c - a); m.receiveShadow = true; cena.add(m);
  }
  // Bocas: o buraco no nível do pano, a parede interna atravessando a tabela e a
  // borda de couro em cima.
  const preto = new MeshBasicMaterial({ color: 0x020202 });
  const couro = new MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7, side: BackSide });
  for (const b of bocas) {
    const furo = new Mesh(new CircleGeometry(b.r, 40), preto); furo.rotation.x = -Math.PI / 2; furo.position.set(b.x, 0.03, b.z); cena.add(furo);
    // A parede desce do pano para dentro (nada sobe acima da mesa).
    const parede = new Mesh(new CylinderGeometry(b.r, b.r * 0.85, 6, 40, 1, true), couro); parede.position.set(b.x, -3, b.z); cena.add(parede);
  }
  // Diamantes de madrepérola nas tabelas.
  const perola = new MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.3, metalness: 0.2 });
  const diamante = (x, z) => { const m = new Mesh(new BoxGeometry(0.7, 0.05, 0.7), perola); m.rotation.y = Math.PI / 4; m.position.set(x, H + 0.03, z); cena.add(m); };
  const meioRegua = (iz0 + az0) / 2, meioRegua2 = (iz1 + az1) / 2, meioLado = (ix0 + ax0) / 2, meioLado2 = (ix1 + ax1) / 2; // meio da madeira
  for (const k of [1, 2, 3, 5, 6, 7]) { diamante(100 * k / 8, meioRegua); diamante(100 * k / 8, meioRegua2); }
  for (const k of [1, 2, 3]) { diamante(meioLado, 50 * MY * k / 4); diamante(meioLado2, 50 * MY * k / 4); }
  // O lustre de bar: cúpula verde e lâmpada acesa (aparece na câmera baixa).
  const cupula = new Mesh(new CylinderGeometry(6, 16, 7, 40, 1, true), new MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.5, side: 2 }));
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
    const m = new Mesh(esfera, new MeshStandardMaterial({ map: texturaBola(n), roughness: 0.12, metalness: 0.0, envMapIntensity: 1.4 }));
    m.castShadow = true; m.visible = false; m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    cena.add(m); bolas.push(m); giro.push(null);
  }
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
    const [x, z] = mundo(b[0], b[1]), ponta = new Vector3(x, R, z).add(atras.clone().multiplyScalar(R + 0.15 + recuo))
      .addScaledVector(lado, giro * R * 0.5).add(new Vector3(0, efeito * R * 0.5, 0));
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
  const camDe = (tipo, branca, ang) => {
    if (tipo === 'alto') return { pos: new Vector3(cx, 120, cz + 46), olha: new Vector3(cx, 0, cz + 2) };
    const [x, z] = mundo(branca[0], branca[1]), dir = new Vector3(Math.cos(ang), 0, Math.sin(ang) * MY).normalize();
    return { pos: new Vector3(x, 0, z).addScaledVector(dir, -62).add(new Vector3(0, 36, 0)), olha: new Vector3(x, R, z).addScaledVector(dir, 24) };
  };

  // --- Tamanho, pedido de quadro e desenho ---------------------------------
  let largura = 0, altura = 0, pedido = false, ultimo = null, mede = [];
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
      if (!p || (n === 0 && d.esconderBranca)) { m.visible = false; giro[n] = null; return; }
      const [x, z] = mundo(p[0], p[1]), h = (d.z?.[n] || 0);
      m.visible = true; m.scale.setScalar(1); m.position.set(x, R + h, z); rolar(n, x, z);
    });
    for (const c of d.caindo || []) { const m = bolas[c.n], [x, z] = mundo(c.x, c.y); m.visible = true; m.position.set(x, R - (1 - c.escala) * 2.6 * R, z); m.scale.setScalar(Math.max(0.4, c.escala)); }
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
      const alvoCam = d.animando || !branca ? camDe('alto') : camDe('taco', branca, ang);
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
    mede.push(performance.now() - t0); if (mede.length > 20) mede.shift();
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
    // Outra modalidade (bola da vez): refaz o desenho das bolas.
    trocarVisual(v) { visual = v; bolas.forEach((m, n) => { m.material.map?.dispose(); m.material.map = texturaBola(n); m.material.needsUpdate = true; }); pedir(); },
    get modo() { return modo; }, set modo(m) { modo = m; camAtual = null; pedir(); },
    destruir() { obs?.disconnect(); renderer.dispose(); },
  };
}
