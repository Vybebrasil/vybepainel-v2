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
  const renderer = new WebGLRenderer({ canvas: alvo, antialias: true, alpha: false, powerPreference: 'default' });   // 'high-performance' ligava a placa dedicada e esquentava notebook
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
  let razao = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(razao);
  const cena = new Scene();
  // Boteco de esquina (Paulo, 09/11/2026): luz fluorescente e parede caiada, não penumbra de cassino.
  cena.background = new Color(0xd9d1bc); cena.fog = new Fog(0xd9d1bc, 230, 520);
  // Reflexo de ambiente (uma sala neutra pré-calculada uma vez): dá o brilho de
  // resina nas bolas e no verniz da madeira, sem custo por quadro.
  const pmrem = new PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; cena.environmentIntensity = 0.35;
  pmrem.dispose();
  const cx = 50, cz = 25 * MY;

  // --- Luz de bar: o lustre forte sobre a mesa, o resto escuro ---------------
  // Luz de bar: um lustre forte com cone suave (o pano cai de luz nas bordas) e
  // pouco preenchimento, para ter contraste. Uma luz com sombra só: leve.
  cena.add(new AmbientLight(0xf4f8ff, 0.3));
  cena.add(new HemisphereLight(0xf2f6ff, 0x6b6458, 0.42));
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
  const madeira = new MeshPhysicalMaterial({ map: texNogueira, color: 0xd8a070, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.12 });
  const feltro = new MeshStandardMaterial({ map: texFeltro, color: 0xffffff, roughness: 0.9, side: 2, envMapIntensity: 0.15 });
  // --- O salão em volta: piso de tábua na penumbra e a parede do bar ao fundo ---
  // Chão de cimento queimado (pintado aqui: pontinhos e manchas).
  // Chão de ladrilho hidráulico vermelho e creme (o piso clássico de boteco).
  const texChao = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), q = 64;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#9a6556' : '#d6ccb6'; g.fillRect(x * q, y * q, q, q);
      g.fillStyle = (x + y) % 2 ? '#d6ccb6' : '#9a6556'; g.beginPath(); g.moveTo(x * q + q / 2, y * q + 12); g.lineTo(x * q + q - 12, y * q + q / 2); g.lineTo(x * q + q / 2, y * q + q - 12); g.lineTo(x * q + 12, y * q + q / 2); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(60,40,30,.35)'; g.lineWidth = 2; for (let i = 0; i <= 256; i += q) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(40,30,20,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    const tx = new CanvasTexture(c); tx.colorSpace = SRGBColorSpace; tx.wrapS = tx.wrapT = RepeatWrapping; tx.repeat.set(30, 30); tx.anisotropy = 16; return tx;
  })();
  const piso = new Mesh(new PlaneGeometry(700, 700), new MeshStandardMaterial({ map: texChao, color: 0xffffff, roughness: 0.85 }));
  piso.rotation.x = -Math.PI / 2; piso.position.set(cx, -24, cz); piso.receiveShadow = true; cena.add(piso);
  // O SALÃO DO BOTECO (Paulo, 09/11/2026: "o cenário de boteco tá pobre, vazio e aleatório... pesquisa
  // referências" e depois "não dá pra ler a placa de giz com o rank... tem parede branca... tem parede toda
  // preta... trabalha como diretor de arte"). Composição pelas referências (as fotos do Paulo e botecos de
  // Rio, SP e BH): um salão fechado de quatro paredes, meia-parede de azulejo verde-água com a faixa, caiado
  // em cima, chão de ladrilho, e cada parede com função. A câmera de jogo vê só a faixa baixa da parede atrás
  // da mesa, então o que importa (a lousa do ranking, a taqueira, o balcão, a porta) fica nessa altura.
  //  - Fundo: letreiro no alto, a lousa do RANKING DO SALÃO no meio (com o ranking de verdade), a taqueira
  //    à esquerda, a prateleira de troféus e a flâmula à direita, a TV no canto.
  //  - Esquerda: balcão de fórmica com tampo de inox, estufa, banquetas, prateleira de cachaça e freezer.
  //  - Direita: a porta de aço meio aberta para a rua de noite, as mesas amarelas e os engradados.
  //  - Frente: relógio, calendário e os cartazes de cartolina.
  const pisoY = -24, fundoZ = az0 - 92, frenteZ = az1 + 84, esqX = ax0 - 96, dirX = ax1 + 96, altoP = 170;
  const largX = dirX - esqX, largZ = frenteZ - fundoZ, meioX = (esqX + dirX) / 2, meioZ = (fundoZ + frenteZ) / 2;
  const PX = 5; // pixels de textura por unidade
  const tela = (w, h, pinta) => { const c = document.createElement('canvas'); c.width = w; c.height = h; pinta(c.getContext('2d'), w, h); const tx = new CanvasTexture(c); tx.colorSpace = SRGBColorSpace; tx.anisotropy = 8; return tx; };
  const mat = (cor, o = {}) => new MeshStandardMaterial({ color: cor, roughness: 0.6, ...o });
  const peca = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const p = new Mesh(geo, m); p.position.set(x, y, z); p.rotation.set(rx, ry, rz); p.matrixAutoUpdate = false; p.updateMatrix(); cena.add(p); return p; };
  // Parede: caiada com manchas, a meia-parede de azulejo verde-água (1,5 m) com a faixa e o rodapé.
  const paredeTex = (larg, extra) => tela(Math.round(larg * PX), altoP * PX, (g, w, h) => {
    g.fillStyle = '#ebe3cf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w / 90; i++) { const r = g.createRadialGradient(0, 0, 0, 0, 0, 40 + Math.random() * 110); r.addColorStop(0, 'rgba(160,140,100,.20)'); r.addColorStop(1, 'rgba(160,140,100,0)'); g.save(); g.translate(Math.random() * w, Math.random() * h * 0.6); g.fillStyle = r; g.fillRect(-160, -160, 320, 320); g.restore(); }
    const topoAz = h - 62 * PX, lado = 6 * PX;
    g.fillStyle = '#9fcdbb'; g.fillRect(0, topoAz, w, h - topoAz);
    for (let y = topoAz; y < h; y += lado) for (let x = 0; x < w; x += lado) { g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`; g.fillRect(x + 2, y + 2, lado - 4, lado - 4); }
    g.strokeStyle = '#7fae9c'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += lado) { g.beginPath(); g.moveTo(x, topoAz); g.lineTo(x, h); g.stroke(); }
    for (let y = topoAz; y <= h; y += lado) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Barra de azulejo português (azul e branco) no alto da meia-parede.
    for (let x = 0; x < w; x += lado) { const y = topoAz; g.fillStyle = '#f2f4f8'; g.fillRect(x, y, lado, lado); g.fillStyle = '#1f4fa0'; g.beginPath(); g.moveTo(x + lado / 2, y + 3); g.lineTo(x + lado - 3, y + lado / 2); g.lineTo(x + lado / 2, y + lado - 3); g.lineTo(x + 3, y + lado / 2); g.closePath(); g.fill(); g.fillStyle = '#f2f4f8'; g.beginPath(); g.arc(x + lado / 2, y + lado / 2, lado / 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#7fae9c'; g.strokeRect(x, y, lado, lado); }
    g.fillStyle = '#1f6f63'; g.fillRect(0, topoAz - 3 * PX, w, 3 * PX); g.fillStyle = '#163f39'; g.fillRect(0, topoAz - 3 * PX, w, 4);
    g.fillStyle = '#5a4636'; g.fillRect(0, h - 3 * PX, w, 3 * PX);
    if (extra) extra(g, w, h, topoAz);
  });
  const cartaz = (g, x, y, w, h, cor, linhas, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-w / 2 + 4, -h / 2 + 5, w, h); g.fillStyle = cor; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = '#1d1b17'; g.textAlign = 'center'; linhas.forEach(([t, px], i) => { g.font = `700 ${px}px "Comic Sans MS", cursive`; g.fillText(t, 0, -h / 2 + 10 + px + i * (px + 6)); }); g.fillStyle = 'rgba(233,220,174,.9)'; g.fillRect(-18, -h / 2 - 8, 36, 14); g.restore(); };
  const parede = (tex, x, z, ry, larg) => { const m = new Mesh(new PlaneGeometry(larg, altoP), new MeshStandardMaterial({ map: tex, roughness: 0.95 })); m.position.set(x, pisoY + altoP / 2, z); m.rotation.y = ry; m.receiveShadow = true; cena.add(m); return m; };
  // Fundo: letreiro no alto.
  parede(paredeTex(largX, (g, w) => {
    g.save(); g.translate(w / 2, 26 * PX); g.rotate(-0.02); g.textAlign = 'center';
    g.font = `900 ${10 * PX}px Georgia, serif`; g.fillStyle = '#1d1b17'; g.fillText('CLUBE DE BILHAR', 6, 6); g.fillStyle = '#c8261d'; g.fillText('CLUBE DE BILHAR', 0, 0);
    g.font = `700 ${4 * PX}px Georgia, serif`; g.fillStyle = '#1d1b17'; g.fillText('VYBE · DESDE 2026', 0, 7 * PX); g.restore();
  }), meioX, fundoZ, 0, largX);
  // Esquerda (atrás do balcão): cartaz de preço.
  parede(paredeTex(largZ, (g, w) => { cartaz(g, w * 0.78, 40 * PX, 34 * PX, 22 * PX, '#fbee4b', [['PASTEL R$ 6', 3.2 * PX], ['COXINHA R$ 5', 3.2 * PX]], -0.04); }), esqX, meioZ, Math.PI / 2, largZ);
  // Direita: a parede com a porta (a porta é um recorte por cima).
  parede(paredeTex(largZ, (g, w) => { cartaz(g, w * 0.2, 44 * PX, 30 * PX, 18 * PX, '#ff86bd', [['NÃO SENTE', 3 * PX], ['NA MESA', 3 * PX]], 0.05); }), dirX, meioZ, -Math.PI / 2, largZ);
  // Frente: relógio, calendário e cartazes.
  parede(paredeTex(largX, (g, w) => {
    cartaz(g, w * 0.3, 52 * PX, 36 * PX, 20 * PX, '#b8f14c', [['GIZ É DE GRAÇA', 3.4 * PX], ['O TACO NÃO', 2.6 * PX]], -0.05);
    cartaz(g, w * 0.72, 50 * PX, 34 * PX, 20 * PX, '#fbee4b', [['FIADO SÓ', 3.4 * PX], ['AMANHÃ', 3.4 * PX]], 0.04);
    g.save(); g.translate(w * 0.5, 34 * PX); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 9 * PX, 0, Math.PI * 2); g.fill(); g.lineWidth = PX; g.strokeStyle = '#c8261d'; g.stroke(); g.strokeStyle = '#1d1b17'; g.lineWidth = 0.8 * PX; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -6 * PX); g.moveTo(0, 0); g.lineTo(4 * PX, 2 * PX); g.stroke(); g.restore();
  }), meioX, frenteZ, Math.PI, largX);
  // --- Fundo: a lousa do RANKING DO SALÃO na altura que a câmera vê ---
  const lousaCanvas = document.createElement('canvas'); lousaCanvas.width = 768; lousaCanvas.height = 480;
  const texLousa = new CanvasTexture(lousaCanvas); texLousa.colorSpace = SRGBColorSpace; texLousa.anisotropy = 8;
  let lousaChave = '';
  const pintarLousa = (linhas) => {
    const g = lousaCanvas.getContext('2d'), w = 768, h = 480;
    g.fillStyle = '#22302a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 60 + Math.random() * 120, 20 + Math.random() * 40); }
    g.fillStyle = '#ffe98a'; g.font = 'bold 60px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'center'; g.fillText('RANKING DO SALÃO', w / 2, 74);
    g.strokeStyle = '#ffe98a'; g.lineWidth = 3; g.beginPath(); g.moveTo(120, 92); g.lineTo(w - 120, 92); g.stroke();
    g.fillStyle = '#f4f4ee'; g.font = 'bold 60px "Comic Sans MS", "Segoe Print", cursive';
    (linhas.length ? linhas : [['—', 'ninguém ganhou ainda']]).slice(0, 4).forEach(([nome, v], i) => {
      const y = 170 + i * 78; g.textAlign = 'left'; g.fillText(`${i + 1}º ${nome}`, 60, y); g.textAlign = 'right'; g.fillText(String(v), w - 60, y);
    });
    texLousa.needsUpdate = true;
  };
  pintarLousa([]);
  peca(new BoxGeometry(70, 46, 2.4), mat(0x5e3a18), cx, pisoY + 40, fundoZ + 1.3);
  // A lousa da parede é o cardápio (o ranking fica só no cavalete, para não repetir).
  const texCardapio = tela(768, 480, (g, w, h) => {
    g.fillStyle = '#22302a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 60 + Math.random() * 120, 20 + Math.random() * 40); }
    g.fillStyle = '#ffe98a'; g.font = 'bold 62px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'center'; g.fillText('CARDÁPIO', w / 2, 74);
    g.strokeStyle = '#ffe98a'; g.lineWidth = 3; g.beginPath(); g.moveTo(200, 92); g.lineTo(w - 200, 92); g.stroke();
    g.fillStyle = '#f4f4ee'; g.font = 'bold 44px "Comic Sans MS", "Segoe Print", cursive';
    [['Cerveja 600', '12'], ['Pinga da casa', '4'], ['Pastel', '6'], ['Torresmo', '15'], ['Ficha da mesa', '2']].forEach(([n, v], i) => { const y = 152 + i * 64; g.textAlign = 'left'; g.fillText(n, 60, y); g.textAlign = 'right'; g.fillText(`R$ ${v}`, w - 60, y); });
  });
  peca(new PlaneGeometry(64, 40), new MeshStandardMaterial({ map: texCardapio, roughness: 0.9 }), cx, pisoY + 40, fundoZ + 2.6);
  peca(new BoxGeometry(66, 1.6, 4), mat(0x5e3a18), cx, pisoY + 16.6, fundoZ + 3.2);
  for (let i = 0; i < 4; i++) peca(new BoxGeometry(2.4, 1, 1), mat(0xf2f2ea), cx - 20 + i * 5, pisoY + 17.8, fundoZ + 3.6);
  // A lousa de cavalete no chão, entre a mesa e a parede do fundo (a câmera de jogo olha para baixo e só
  // pega a base das paredes): o RANKING DO SALÃO de verdade, legível quando a mira aponta para o fundo.
  const cavalete = new Group(), madeiraCav = mat(0x6e4420), AB = 0.2, FH = 36, FW = 48;
  const folha = (comLousa, lado) => {
    const g = new Group();
    const fundo = new Mesh(new BoxGeometry(FW, FH, 1.2), madeiraCav); g.add(fundo);
    if (comLousa) {
      const face = new Mesh(new PlaneGeometry(FW - 5, FH - 5), new MeshStandardMaterial({ map: texLousa, roughness: 0.9 })); face.position.z = 0.75; g.add(face);
      // Moldura: ripas que se encontram nos cantos (nada cruzando).
      for (const [w, h, x, y] of [[FW, 2.5, 0, FH / 2 - 1.25], [FW, 2.5, 0, -FH / 2 + 1.25], [2.5, FH - 5, -FW / 2 + 1.25, 0], [2.5, FH - 5, FW / 2 - 1.25, 0]]) { const r = new Mesh(new BoxGeometry(w, h, 1.6), madeiraCav); r.position.set(x, y, 0.8); g.add(r); }
      const bandeja = new Mesh(new BoxGeometry(FW - 6, 1, 2.4), madeiraCav); bandeja.position.set(0, -FH / 2 + 3, 1.9); g.add(bandeja);
      for (let n = 0; n < 3; n++) { const giz = new Mesh(new BoxGeometry(2.2, 0.8, 0.8), mat(0xf2f2ea)); giz.position.set(-10 + n * 6, -FH / 2 + 3.9, 2.2); g.add(giz); }
    }
    g.position.set(0, (FH / 2) * Math.cos(AB), lado * (FH / 2) * Math.sin(AB)); g.rotation.x = -lado * AB; cavalete.add(g);
  };
  folha(true, 1); folha(false, -1);
  const dobradica = new Mesh(new CylinderGeometry(0.7, 0.7, FW - 4, 10), mat(0x8a8f96, { metalness: 0.8, roughness: 0.35 })); dobradica.rotation.z = Math.PI / 2; dobradica.position.set(0, FH * Math.cos(AB), 0); cavalete.add(dobradica);
  for (const s of [-1, 1]) { const corrente = new Mesh(new BoxGeometry(0.4, 0.4, FH * Math.sin(AB) * 1.6), mat(0x8a8f96, { metalness: 0.8 })); corrente.position.set(s * (FW / 2 - 4), FH * 0.4, 0); cavalete.add(corrente); }
    cavalete.scale.setScalar(0.78); cavalete.position.set(cx - 6, pisoY, az0 - 52); cena.add(cavalete);
  // Taqueira à esquerda da lousa: tábua com os tacos em pé.
  const madeiraClara = mat(0x9a6a3a), tacoMat = [mat(0xc89a5a), mat(0x7a4a22), mat(0x2b2b2b), mat(0xb5793c), mat(0x5a3418)];
  const tqX = cx - 78;
  peca(new BoxGeometry(44, 5, 5), madeiraClara, tqX, pisoY + 10, fundoZ + 3);
  peca(new BoxGeometry(44, 4, 3), madeiraClara, tqX, pisoY + 60, fundoZ + 2);
  for (let i = 0; i < 6; i++) { const x = tqX - 18 + i * 7.2; peca(new CylinderGeometry(0.45, 0.85, 62, 8), tacoMat[i % tacoMat.length], x, pisoY + 40, fundoZ + 3.5, 0.04, 0, (i % 2 ? 1 : -1) * 0.02); peca(new CylinderGeometry(0.5, 0.5, 1.2, 8), mat(0x1f6fd6), x, pisoY + 71.6, fundoZ + 3.6); }
  // Troféus e flâmula à direita da lousa.
  const ouro = mat(0xd8a62a, { metalness: 0.85, roughness: 0.3 }), prata = mat(0xc9ccd2, { metalness: 0.85, roughness: 0.3 });
  const trX = cx + 78;
  peca(new BoxGeometry(50, 1.6, 8), madeiraClara, trX, pisoY + 40, fundoZ + 4);
  const topoPrat = pisoY + 40 + 0.8;
  [[-18, ouro, 1.3], [-6, prata, 1], [6, ouro, 1.7], [18, prata, 0.9]].forEach(([dx, m, k]) => {
    const x = trX + dx, z = fundoZ + 4;
    peca(new BoxGeometry(4.4 * k, 2 * k, 4.4 * k), mat(0x2b2118, { roughness: 0.35 }), x, topoPrat + k, z);
    peca(new BoxGeometry(2.6 * k, 0.8 * k, 0.2), ouro, x, topoPrat + k, z + 2.2 * k + 0.1);
    peca(new CylinderGeometry(1.4 * k, 1.8 * k, 0.8 * k, 14), m, x, topoPrat + 2.4 * k, z);
    peca(new CylinderGeometry(0.5 * k, 0.7 * k, 3.4 * k, 10), m, x, topoPrat + 4.5 * k, z);
    peca(new CylinderGeometry(3 * k, 1 * k, 5 * k, 18), m, x, topoPrat + 8.7 * k, z);
    for (const s of [-1, 1]) peca(new BoxGeometry(0.5 * k, 2.6 * k, 0.5 * k), m, x + s * 3.3 * k, topoPrat + 9 * k, z);
  });
  // Suportes da prateleira (mão-francesa) para ela não flutuar.
  for (const s of [-1, 1]) peca(new BoxGeometry(1.4, 6, 6), madeiraClara, trX + s * 21, pisoY + 36.4, fundoZ + 3.5);
  const flamula = new BufferGeometry(); flamula.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, -16, 0, 32, -8, 0], 3)); flamula.computeVertexNormals();
  peca(flamula, new MeshStandardMaterial({ color: 0xc8261d, side: 2, roughness: 0.8 }), trX - 16, pisoY + 82, fundoZ + 1.5);
  // TV no canto do fundo com a direita, passando futebol.
  const texTV = tela(256, 150, (g, w, h) => { g.fillStyle = '#2f8a3e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8f5e8'; g.lineWidth = 3; g.strokeRect(12, 12, w - 24, h - 24); g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 12); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 22, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#111'; g.fillRect(8, 8, 96, 20); g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.fillText('FLA 1 x 0 VAS', 12, 23); });
  const tv = new Group();
  tv.add(new Mesh(new BoxGeometry(36, 22, 3), mat(0x151515, { roughness: 0.4 })));
  const telaTV = new Mesh(new PlaneGeometry(33, 19), new MeshBasicMaterial({ map: texTV })); telaTV.position.z = 1.6; tv.add(telaTV);
  tv.position.set(dirX - 16, pisoY + 104, fundoZ + 16); tv.rotation.y = -0.6; cena.add(tv);
  peca(new BoxGeometry(3, 3, 14), mat(0x333333), dirX - 10, pisoY + 104, fundoZ + 6);
  // --- Esquerda: o balcão ---
  const formica = mat(0x9c3b1e, { roughness: 0.4 }), inox = mat(0xd5d8dc, { metalness: 0.9, roughness: 0.28 });
  const balX = esqX + 16, balZ0 = az0 - 20, balZ1 = az1 + 10, balL = balZ1 - balZ0, balZ = (balZ0 + balZ1) / 2;
  peca(new BoxGeometry(16, 40, balL), formica, balX, pisoY + 20, balZ);
  peca(new BoxGeometry(19, 1.6, balL + 2), inox, balX, pisoY + 40.8, balZ);
  peca(new BoxGeometry(1, 3, balL), mat(0xf2bd14), balX + 8.1, pisoY + 30, balZ);
  peca(new BoxGeometry(14, 10, 20), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }), balX, pisoY + 46.6, balZ - 18);
  for (let i = 0; i < 6; i++) peca(new SphereGeometry(1.6, 10, 8), mat(i % 2 ? 0xd88a2a : 0xe8b04a), balX - 3 + (i % 3) * 3, pisoY + 43.6, balZ - 24 + Math.floor(i / 3) * 6);
  for (const dz of [-30, -6, 18]) { peca(new CylinderGeometry(0.9, 1.2, 30, 8), inox, balX + 15, pisoY + 15, balZ + dz); peca(new CylinderGeometry(5, 5, 2.4, 18), mat(0xd8261c, { roughness: 0.45 }), balX + 15, pisoY + 31, balZ + dz); }
  // Caixa registradora e porta-guardanapo no balcão.
  const topoBal = pisoY + 41.6;
  peca(new BoxGeometry(12, 6, 12), mat(0x3a3f47, { roughness: 0.4 }), balX - 1, topoBal + 3, balZ + 22);
  peca(new BoxGeometry(10, 5, 2), mat(0x2b2f36), balX - 1, topoBal + 8, balZ + 17, -0.5);
  peca(new BoxGeometry(6, 0.6, 3), mat(0x7cf28a, { emissive: 0x2a8a3a, emissiveIntensity: 0.6 }), balX - 1, topoBal + 10.3, balZ + 16.4, -0.5);
  peca(new BoxGeometry(5, 4, 2), mat(0xd8d8d8, { metalness: 0.7, roughness: 0.3 }), balX + 2, topoBal + 2, balZ + 4);
  peca(new BoxGeometry(4.4, 3, 1.6), mat(0xffffff), balX + 2, topoBal + 4.6, balZ + 4);
  const garrafa = [0x6b3a0a, 0x2f5d1e, 0xd8c79a, 0x8a1c14, 0x3a2a6a, 0xe0a030];
  for (const y of [70, 88]) {
    peca(new BoxGeometry(8, 1.4, balL - 20), madeiraClara, esqX + 4, pisoY + y, balZ);
    for (let i = 0; i < 9; i++) { const z = balZ - (balL - 30) / 2 + i * ((balL - 30) / 8), c = garrafa[(i + y) % garrafa.length]; peca(new CylinderGeometry(1.5, 1.5, 9, 10), new MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }), esqX + 4, pisoY + y + 5.2, z); peca(new CylinderGeometry(0.5, 1.4, 3, 8), mat(c), esqX + 4, pisoY + y + 11, z); }
  }
  peca(new BoxGeometry(22, 26, 36), mat(0xf4f4f0, { roughness: 0.35 }), balX - 2, pisoY + 13, balZ1 + 26);
  peca(new BoxGeometry(22.2, 6, 36.2), mat(0xc8261d, { roughness: 0.35 }), balX - 2, pisoY + 20, balZ1 + 26);
  // Luminárias fluorescentes nas paredes (a luz branca do boteco) e o ventilador de parede.
  const tubo = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.2 }), calha = mat(0xe8e8e2, { roughness: 0.4 });
  const luminaria = (x, y, z, ry) => { const g = new Group(); const c = new Mesh(new BoxGeometry(44, 2.4, 3), calha); g.add(c); const tb = new Mesh(new CylinderGeometry(0.8, 0.8, 40, 10), tubo); tb.rotation.z = Math.PI / 2; tb.position.set(0, -1.4, 0.6); g.add(tb); g.position.set(x, y, z); g.rotation.y = ry; cena.add(g); };
  luminaria(cx - 40, pisoY + 118, fundoZ + 2, 0); luminaria(cx + 40, pisoY + 118, fundoZ + 2, 0);
  luminaria(esqX + 2, pisoY + 118, cz, Math.PI / 2); luminaria(dirX - 2, pisoY + 118, cz - 70, -Math.PI / 2);
  const vent = new Group(), grade = mat(0x2b2f36, { metalness: 0.5, roughness: 0.4 });
  const aro = new Mesh(new CylinderGeometry(12, 12, 1.2, 28, 1, true), grade); aro.rotation.x = Math.PI / 2; vent.add(aro);
  for (let n = 0; n < 3; n++) { const pa = new Mesh(new BoxGeometry(3.4, 10, 0.4), mat(0x9aa3ad)); pa.position.set(Math.cos(n * 2.1) * 5, Math.sin(n * 2.1) * 5, 0); pa.rotation.z = n * 2.1 + Math.PI / 2; vent.add(pa); }
  const miolo = new Mesh(new CylinderGeometry(2.2, 2.2, 3, 14), grade); miolo.rotation.x = Math.PI / 2; vent.add(miolo);
  const braco = new Mesh(new BoxGeometry(1.4, 1.4, 10), grade); braco.position.z = -5; vent.add(braco);
  vent.position.set(esqX + 9, pisoY + 104, fundoZ + 26); vent.rotation.y = Math.PI / 2 - 0.5; vent.rotation.x = 0.25; cena.add(vent);
  // --- Direita: a porta de aço meio aberta para a rua de noite ---
  const portaZ = cz - 6, portaL = 64, portaA = 84;
  const texRua = tela(512, 672, (g, w, h) => {
    const ceu = g.createLinearGradient(0, 0, 0, h * 0.6); ceu.addColorStop(0, '#0b1230'); ceu.addColorStop(1, '#1f2c55'); g.fillStyle = ceu; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2f3a'; g.fillRect(40, 150, w - 80, h * 0.55);
    for (const [x, y] of [[90, 200], [220, 200], [350, 200], [90, 300], [350, 300]]) { g.fillStyle = Math.random() < 0.7 ? '#f5c86a' : '#3a3f4c'; g.fillRect(x, y, 70, 60); }
    const luz = g.createRadialGradient(w * 0.82, 120, 4, w * 0.82, 120, 170); luz.addColorStop(0, 'rgba(255,190,90,.95)'); luz.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = luz; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16181d'; g.fillRect(w * 0.82 - 4, 120, 8, h * 0.6);
    g.fillStyle = '#5b5f66'; g.fillRect(0, h * 0.74, w, h * 0.26);
    g.strokeStyle = '#1d1f24'; g.lineWidth = 6; for (let y = h * 0.78; y < h; y += 28) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 30) * 8); g.stroke(); }
    g.fillStyle = '#8f949b'; g.fillRect(0, h * 0.72, w, 16);
  });
  peca(new PlaneGeometry(portaL, portaA), new MeshBasicMaterial({ map: texRua }), dirX - 0.6, pisoY + portaA / 2, portaZ, 0, -Math.PI / 2);
  const texAco = tela(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#a3a9b1' : '#858b93'; g.fillRect(0, y, w, 8); } });
  texAco.wrapS = texAco.wrapT = RepeatWrapping; texAco.repeat.set(1, 3);
  peca(new BoxGeometry(1.6, 34, portaL + 2), new MeshStandardMaterial({ map: texAco, metalness: 0.6, roughness: 0.45 }), dirX - 1.4, pisoY + portaA - 17, portaZ);
  peca(new BoxGeometry(2, 4, portaL + 6), mat(0x4a4f57, { metalness: 0.5 }), dirX - 1.6, pisoY + portaA + 1, portaZ);
  for (const s of [-1, 1]) peca(new BoxGeometry(2.2, portaA + 2, 3), mat(0x4a4f57, { metalness: 0.5 }), dirX - 1.6, pisoY + portaA / 2, portaZ + s * (portaL / 2 + 1.5));
  // As mesas amarelas e as cadeiras de plástico.
  const amarelo = mat(0xf2bd14, { roughness: 0.45 }), vermelho = mat(0xd8261c, { roughness: 0.45 });
  const cadeira = (x, z, giro) => {
    const g = new Group(), pe = new CylinderGeometry(0.7, 0.9, 17, 8);
    for (const [px, pz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { const m = new Mesh(pe, vermelho); m.position.set(px, pisoY + 8.5, pz); g.add(m); }
    const s = new Mesh(new BoxGeometry(17, 1.4, 17), vermelho); s.position.set(0, pisoY + 17.5, 0); g.add(s);
    const b = new Mesh(new BoxGeometry(17, 15, 1.2), vermelho); b.position.set(0, pisoY + 25, -8.2); b.rotation.x = -0.12; g.add(b);
    g.position.set(x, 0, z); g.rotation.y = giro; cena.add(g);
  };
  const vidro = new MeshStandardMaterial({ color: 0x5a3208, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }), rotulo = mat(0xf5f0e0), tampa = mat(0xc9c9c9, { metalness: 0.8, roughness: 0.3 });
  const garrafaCerveja = (x, y, z) => { peca(new CylinderGeometry(1.7, 1.7, 9, 12), vidro, x, y + 4.5, z); peca(new CylinderGeometry(1.75, 1.75, 3, 12), rotulo, x, y + 4, z); peca(new CylinderGeometry(0.6, 1.5, 4, 10), vidro, x, y + 11, z); peca(new CylinderGeometry(0.7, 0.7, 0.6, 10), tampa, x, y + 13.2, z); };
  const mesaBar = (x, z, garrafas) => {
    for (const [px, pz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) peca(new CylinderGeometry(0.8, 1, 26, 8), amarelo, x + px, pisoY + 13, z + pz);
    peca(new BoxGeometry(28, 1.6, 28), amarelo, x, pisoY + 26.8, z);
    garrafas.forEach(([bx, bz]) => garrafaCerveja(x + bx, pisoY + 27.6, z + bz));
    peca(new CylinderGeometry(2.2, 1.8, 6, 12), new MeshStandardMaterial({ color: 0xf6c34a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }), x - 2, pisoY + 30.6, z + 6);
  };
  const m1 = [ax1 + 48, az0 - 22], m2 = [ax1 + 52, az1 + 34];
  mesaBar(m1[0], m1[1], [[-5, -3], [4, 5]]); cadeira(m1[0] - 20, m1[1], Math.PI / 2); cadeira(m1[0], m1[1] - 20, 0);
  mesaBar(m2[0], m2[1], [[3, -4], [-5, 2], [6, 6]]); cadeira(m2[0] - 20, m2[1] + 3, Math.PI / 2 + 0.2); cadeira(m2[0], m2[1] + 20, Math.PI);
  // Engradados de verdade: vazados nas laterais, com as garrafas aparecendo no de cima.
  const texEngradado = {};
  const matEngradado = (cor) => (texEngradado[cor] ||= new MeshStandardMaterial({ roughness: 0.5, map: tela(128, 72, (g, w, h) => {
    g.fillStyle = `#${cor.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.55)'; for (let x = 8; x < w - 8; x += 15) g.fillRect(x, 18, 9, 32);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(w / 2 - 18, 6, 36, 8);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 4, w, 4);
  }) }));
  const engradado = (x, z, cores, giro = 0) => cores.forEach((cor, i) => {
    peca(new BoxGeometry(20, 11, 14), matEngradado(cor), x, pisoY + 5.5 + i * 11.2, z, 0, giro);
    if (i === cores.length - 1) for (let gx = -7.5; gx <= 7.5; gx += 5) for (let gz = -4; gz <= 4; gz += 4) {
      const ox = x + gx * Math.cos(giro) + gz * Math.sin(giro), oz = z - gx * Math.sin(giro) + gz * Math.cos(giro), topo = pisoY + 11 + i * 11.2;
      peca(new CylinderGeometry(0.6, 1.3, 4, 8), vidro, ox, topo + 2, oz); peca(new CylinderGeometry(0.65, 0.65, 0.5, 8), tampa, ox, topo + 4.2, oz);
    }
  });
  engradado(dirX - 14, fundoZ + 14, [0xc8261d, 0x1f7a46, 0xc8261d, 0xf2bd14], 0.1);
  engradado(dirX - 14, fundoZ + 32, [0x1f7a46, 0xc8261d], -0.05);
  engradado(dirX - 36, fundoZ + 12, [0xf2bd14, 0xf2bd14, 0x1f7a46], 0.2);
  engradado(esqX + 14, balZ1 + 54, [0xc8261d, 0xc8261d], 0.15);
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
    const c = document.createElement('canvas'); c.width = 2048; c.height = 128; const g = c.getContext('2d');
    g.translate(0, 64); tacoDesenhar(g, 2048, 128, modelo, 0, false, true);   // a volta inteira, sem volume pintado
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return (tacoTex[modelo] = t);
  };
  const LT = 52, tacoGeo = new CylinderGeometry(0.62, 0.33, LT, 24, 1);          // cabo grosso em cima, ponta fina embaixo
  tacoGeo.translate(0, LT / 2, 0);                                   // a ponta na origem, o cabo para +y
  // O desenho do taco corre ao longo do cilindro (u do canvas = comprimento).
  const uv = tacoGeo.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
  const tacos = [0, 1].map(() => { const m = new Mesh(tacoGeo, new MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 })); m.castShadow = true; m.visible = false; cena.add(m); return m; });
  const cima = new Vector3(0, 1, 0);
  const porTaco = (m, b, ang, recuo, elev, modelo, efeito = 0, giro = 0) => {
    m.material.map = texTaco(modelo || 'casa'); m.material.needsUpdate = true;
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
  let modo = 'taco', camAlvo = null, camAtual = null, transicao = 0, camUsada = persp;
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
    if (w && h && (w !== largura || h !== altura)) {
      largura = w; altura = h; renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
      // Mesa de borda a borda (Paulo, 09/11/2026): a tela pode ter qualquer proporção; a vista de cima
      // mostra a mesa inteira sem esticar e sobra pano escuro dos lados (ou em cima e embaixo).
      const mx = (ax0 + ax1) / 2, mz = (az0 + az1) / 2, a = w / h, lw = ax1 - ax0, lh = az1 - az0;
      const hw = a > lw / lh ? (lh * a) / 2 : lw / 2, hh = a > lw / lh ? lh / 2 : lw / a / 2;
      orto.left = mx - hw; orto.right = mx + hw; orto.top = -(mz - hh); orto.bottom = -(mz + hh); orto.updateProjectionMatrix();
    }
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

    tacos.forEach((m, i) => { const t = d.tacos?.[i]; if (t) { const pt = porTaco(m, t.b, t.ang, t.recuo, t.elev, t.modelo, t.efeito, t.giro); void pt; } else m.visible = false; });
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
    camUsada = persp;
    const querCima = modo === 'cima', branca = d.camera?.b, ang = d.camera?.ang ?? 0;
    if ((querCima || d.forcarCima) && !d.animando) { cam = orto; camUsada = orto; }
    else {
      const alvoCam = d.animando || !branca ? camDe('alto') : camDe('taco', branca, ang, d.tacos?.[0]?.elev || 0);
      if (!camAtual) camAtual = { pos: alvoCam.pos.clone(), olha: alvoCam.olha.clone() };
      const k = d.animando ? 0.06 : d.suave ? 0.18 : 1;
      camAtual.pos.lerp(alvoCam.pos, k); camAtual.olha.lerp(alvoCam.olha, k);
      persp.position.copy(camAtual.pos); persp.lookAt(camAtual.olha);
      if (camAtual.pos.distanceTo(alvoCam.pos) > 0.05) pedir();
    }
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
    raio3.setFromCamera(v, camUsada);
    return raio3.ray.intersectPlane(chao, ponto) ? [ponto.x, ponto.z / MY] : null;
  }
  return {
    desenhar, pedir, mesaNoPonteiro,
    // A lousa do RANKING DO SALÃO na parede do fundo: [[nome, vitórias], ...] (só repinta quando muda).
    lousa(linhas) { const k = JSON.stringify(linhas || []); if (k === lousaChave) return; lousaChave = k; pintarLousa(linhas || []); pedir(); },
    // Zoom e altura da câmera escolhidos pelo jogador (roda do mouse e controles).
    ajustarVista(dz = 0, da = 0) { vista.zoom = MathUtils.clamp(vista.zoom * (1 + dz), 0.55, 1.8); vista.altura = MathUtils.clamp(vista.altura + da, -1, 1); pedir(); return { ...vista }; },
    get vista() { return { ...vista }; }, get custo() { return { ms: ultimoCusto, razao, chamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles }; },
    // Outra modalidade (bola da vez): refaz o desenho das bolas.
    trocarVisual(v) { visual = v; bolas.forEach((m, n) => { m.material.map?.dispose(); m.material.map = texturaBola(n); m.material.needsUpdate = true; }); pedir(); },
    get modo() { return modo; }, set modo(m) { modo = m; camAtual = null; pedir(); },
    destruir() { obs?.disconnect(); renderer.dispose(); },
  };
}
