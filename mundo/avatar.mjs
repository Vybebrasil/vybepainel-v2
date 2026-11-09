// Avatar voxel de cada pessoa (Paulo, 06/11/2026: "acabou o que for do Habbo").
// Lê a figura do Habbo que o perfil já guarda (ex.: "hr-100-61.hd-180-1.ch-210-66.lg-270-82")
// e monta o mesmo boneco em voxel: cada parte e cor da figura vira sempre a mesma cor aqui,
// então a pessoa é reconhecível e ninguém perde a escolha que fez. Desenhado uma vez num
// renderizador fora da tela e guardado como imagem (como as poses do robô do Vale).
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { pecaDaClasse, obraDaPeca } from './catalogo.mjs';

const PELE = ['#F6D3B5', '#EDC09A', '#D9A47C', '#C68E6A', '#A8714E', '#8A5A3C', '#6B4430'];
const CABELO = ['#1F1612', '#2B1D14', '#4A2E1A', '#6B4A2E', '#8A5A2E', '#C99A3C', '#E3C27A', '#B5462F', '#7A7268', '#2E3A5C'];
const ROUPA = ['#FF7A2F', '#0D74CE', '#18A957', '#8E4EC6', '#E5484D', '#F7C948', '#D6409F', '#1F1D1A', '#F4F1EA', '#38D9C5', '#64738A', '#B07A45'];
const CALCA = ['#2B2F33', '#3E4A5C', '#1F2A44', '#5A4636', '#6B7A72', '#1F1D1A', '#8E857A'];
const pega = (lista, n) => lista[Math.abs(Number(n) || 0) % lista.length];
const h = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };

const TENIS = ['#FF7A2F', '#0D74CE', '#E5484D', '#18A957', '#F7C948', '#8E4EC6', '#38D9C5', '#F4F1EA', '#D6409F'];
const ESTAMPAS = ['faixa', 'bolso', 'logo', 'listras', 'gola'];
// Estilo do cabelo pela peça da figura ("longo" segue a regra de sempre, a do criador de personagem).
const ESTILOS_CURTOS = ['curto', 'topete', 'cacheado', 'curto', 'franja'];

export function lerFigura(figura = '') {
  const partes = {};
  for (const p of String(figura).split('.')) { const [t, id, c1, c2] = p.split('-'); if (t) partes[t] = { id: Number(id) || 0, c: Number(c1) || 0, c2: Number(c2) || 0 }; }
  const cabelo = partes.hr, cabeca = partes.hd, camisa = partes.ch, calca = partes.lg, chapeu = partes.ha, casaco = partes.cc, oculos = partes.ea, sapato = partes.sh;
  const longo = cabelo ? cabelo.id % 3 === 0 || [500, 515, 545, 836, 890].includes(cabelo.id) : false;
  const roupa = pega(ROUPA, camisa ? camisa.c + camisa.id : h(figura) + 3);
  return {
    pele: pega(PELE, cabeca ? cabeca.c : h(figura)),
    cabelo: cabelo ? pega(CABELO, cabelo.c + cabelo.id) : null,
    longo,
    estilo: !cabelo ? null : longo ? (cabelo.id % 2 ? 'coque' : 'longo') : pega(ESTILOS_CURTOS, Math.floor(cabelo.id / 3)),
    roupa,
    casaco: casaco ? pega(ROUPA, casaco.c + 5) : null,
    calca: pega(CALCA, calca ? calca.c + calca.id : h(figura) + 7),
    chapeu: chapeu ? pega(ROUPA, chapeu.c + 2) : null,
    oculos: Boolean(oculos),
    // Tênis e estampa: do sapato e da camisa da figura (sem sapato, fixos pelo rosto e cabelo: trocar a roupa não troca o tênis).
    tenis: pega(TENIS, sapato ? sapato.c + sapato.id : h(String(figura).split('.').filter((p) => /^(hd|hr)-/.test(p)).join('.')) + 11),
    estampa: pega(ESTAMPAS, camisa ? camisa.id + camisa.c2 : h(figura) + 5),
  };
}

// Presença do Escritório sem figura (só as escolhas antigas do perfil: roupa, pele e cabelo por nome):
// o mesmo boneco, com o resto fixo pelo id da pessoa.
const ROUPA_NOME = { laranja: '#FF9548', azul: '#78AAFF', verde: '#72CCAC', roxo: '#AC9BFF', rosa: '#EF9FBC', grafite: '#64738A' };
const PELE_NOME = { clara: '#F1C9A5', media: '#C68E6A', morena: '#9A6646', escura: '#6B4430' };
export function figuraDaPessoa(p = {}) {
  if (p.figura) return lerFigura(p.figura);
  const k = h(p.id || p.nome || '');
  return {
    pele: PELE_NOME[p.pele] || pega(PELE, k), cabelo: pega(CABELO.slice(0, 5), k >> 2), longo: p.cabelo === 'longo',
    estilo: p.cabelo === 'longo' ? 'longo' : pega(ESTILOS_CURTOS, k >> 3), roupa: ROUPA_NOME[p.roupa] || (/^#[0-9a-f]{6}$/i.test(p.roupa || '') ? p.roupa : pega(ROUPA, k)),
    casaco: null, calca: pega(CALCA, k >> 1), chapeu: null, oculos: k % 5 === 0, tenis: pega(TENIS, k >> 4), estampa: pega(ESTAMPAS, k >> 5),
  };
}
// Agente (o VYBES num setor): boneco próprio pelo nome, roupa de agente e a cor do setor no visor, no fone e no crachá.
export function figuraDoAgente(nome = '', cor = '#FF7A2F') {
  const k = Math.imul(h(nome) ^ 0x5bd1e995, 2654435761) >>> 0; // mistura bem: nomes parecidos dão bonecos diferentes
  return { pele: pega(PELE, k % 101), cabelo: pega(CABELO.slice(0, 8), (k >>> 7) % 97), longo: false, estilo: pega(['curto', 'topete', 'cacheado', 'franja', 'coque'], (k >>> 13) % 89),
    roupa: '#F4F1EA', casaco: misturar(cor, '#1F1D1A', .3), calca: '#2B2F33', chapeu: null, oculos: false, tenis: '#F4F1EA', estampa: 'logo', agente: cor };
}

const misturar = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
// O boneco voxel da Vybe (Paulo, 08/11/2026: bonecos de cabeça grande, cabelo em blocos com volume, óculos e boné,
// camiseta com estampa, tênis coloridos; agentes com visor e fone na cor do setor). Altura ~1,7 com a cabeça de
// 0,74 (cabeça e corpo quase 1:1). Desenha numa Obra que já existe (várias pessoas = uma malha só): (x, y, z) é o
// pé, s a escala e giro o número de quartos de volta (0 = de frente para +z). Devolve o índice, nas luzes da Obra,
// da antena do agente (a cor dela é o estado; -1 sem antena).
// passo (-1..1): pose de passada, com a perna de um lado à frente e o braço do outro (as duas poses alternadas
// fazem o boneco andar de verdade, sem malha a mais por quadro).
// sentado: as coxas vão para a frente na altura do quadril (y 0,44) e as canelas descem até o chão; quem desenha
// põe o quadril no assento (Minha sala, mundo/quarto.mjs). O resto do boneco não muda.
export function desenharBoneco(o, f, { x = 0, y = 0, z = 0, s = 1, giro = 0, passo = 0, sentado = false } = {}) {
  const pz = (lado) => passo * Math.sign(lado) * .09;
  const g = ((Math.round(giro) % 4) + 4) % 4;
  const P = (lx, lz) => [[lx, lz], [lz, -lx], [-lx, -lz], [-lz, lx]][g];
  const C = (lx, ly, lz, w, hh, d, cor, luz = false) => {
    const [a, b] = P(lx, lz), [ww, dd] = g % 2 ? [d, w] : [w, d];
    (luz ? o.luz : o.caixa).call(o, x + a * s, y + ly * s, z + b * s, ww * s, hh * s, dd * s, cor);
  };
  const escuro = (c, t = .35) => misturar(c, '#1F1D1A', t), claro = (c, t = .4) => misturar(c, '#FFFFFF', t);
  // Tênis: sola branca, cabedal colorido, bico claro e cadarço. Sentado, os pés ficam meia perna à frente.
  if (sentado) passo = 0;
  const pe = sentado ? .38 : 0;
  for (const sx of [-.13, .13]) {
    const q = pz(sx) + pe;
    C(sx, 0, .03 + q, .25, .07, .36, '#F4F1EA');
    C(sx, .07, .02 + q, .23, .11, .32, f.tenis);
    C(sx, .07, .17 + q, .23, .06, .04, claro(f.tenis, .55));
    C(sx, .18, q, .21, .03, .2, '#FFFFFF');
  }
  // Pernas e cinto.
  if (sentado) for (const sx of [-.13, .13]) { C(sx, .3, .19, .22, .16, .42, f.calca); C(sx, .2, .38, .21, .14, .22, f.calca); }
  else for (const sx of [-.13, .13]) C(sx, .2, pz(sx) * .6, .22, .27, .24, f.calca);
  C(0, .44, 0, .56, .06, .3, escuro(f.calca, .25));
  // Tronco com a estampa na frente.
  const tronco = f.roupa, est = new THREE.Color(tronco).getHSL({}).l > .62 ? escuro(tronco, .55) : '#FFFFFF';
  C(0, .5, 0, .56, .42, .3, tronco);
  if (f.agente) { C(0, .64, .155, .2, .16, .02, '#FFFFFF'); C(0, .68, .165, .12, .08, .02, f.agente, true); }
  else if (f.estampa === 'faixa') C(0, .66, .155, .56, .08, .02, est);
  else if (f.estampa === 'bolso') { C(.14, .7, .155, .12, .12, .02, escuro(tronco, .2)); C(.14, .8, .16, .12, .02, .02, est); }
  else if (f.estampa === 'logo') { C(0, .6, .155, .2, .2, .02, est); C(0, .65, .165, .1, .1, .02, tronco); }
  else if (f.estampa === 'listras') for (const yy of [.56, .66, .76]) C(0, yy, .155, .56, .04, .02, est);
  else C(0, .86, .155, .24, .06, .02, est);
  // Casaco aberto (o meio da camiseta aparece) e braços.
  const manga = f.casaco || tronco;
  if (f.casaco) for (const sx of [-1, 1]) C(sx * .2, .5, .005, .17, .42, .31, f.casaco);
  for (const sx of [-1, 1]) {
    const qb = -pz(sx);
    C(sx * .37, .72, qb * .4, .17, .2, .2, manga);
    C(sx * .37, .52, qb, .14, .2, .16, f.casaco || f.pele);
    C(sx * .37, .44, qb * 1.2, .15, .1, .17, f.pele);
  }
  // Cabeça grande. Com máscara do Habbo (cabeça de cavalo e afins: f.acessorio cobre quase toda a cabeça), a cabeça,
  // o rosto e o cabelo dão lugar ao acessório.
  const yc = .92, H = .74, W = .78, D = .72, fr = D / 2, topo = yc + H;
  const mascara = Boolean(f.acessorio && f.acessorio.cobre > .55);
  const ct = f.cabelo, bone = Boolean(f.chapeu); // também usados pelo fone do agente, depois da cabeça
  if (!mascara) {
  C(0, yc - .02, 0, .22, .04, .22, f.pele);
  C(0, yc, 0, W, H, D, f.pele);
  for (const sx of [-1, 1]) C(sx * (W / 2 + .02), yc + .26, 0, .05, .14, .14, escuro(f.pele, .08));
  // Rosto: olhos com brilho, sobrancelhas, bochechas e boca; agente tem visor no lugar dos olhos.
  const yo = yc + .3;
  if (f.agente) {
    C(0, yo - .05, fr + .01, W + .04, .2, .04, escuro(f.agente, .5));
    C(0, yo - .03, fr + .03, W - .06, .16, .02, f.agente, true);
    for (const sx of [-.17, .17]) C(sx, yo + .01, fr + .045, .12, .06, .01, '#FFFFFF', true);
  } else {
    for (const sx of [-.17, .17]) { C(sx, yo, fr + .005, .1, .15, .02, '#1F1D1A'); C(sx + .025, yo + .09, fr + .015, .04, .04, .01, '#FFFFFF'); }
    if (f.cabelo) for (const sx of [-.17, .17]) C(sx, yo + .2, fr + .005, .15, .035, .02, escuro(f.cabelo, .1));
  }
  for (const sx of [-.28, .28]) C(sx, yc + .19, fr + .005, .1, .05, .02, misturar(f.pele, '#F0707A', .45));
  C(0, yc + .14, fr + .005, .14, .04, .02, misturar(f.pele, '#7A2E2A', .65));
  if (f.oculos && !f.agente) {
    for (const sx of [-.17, .17]) {
      C(sx, yo - .05, fr + .02, .22, .03, .02, '#1F1D1A'); C(sx, yo + .17, fr + .02, .22, .03, .02, '#1F1D1A');
      C(sx - .1, yo - .05, fr + .02, .03, .25, .02, '#1F1D1A'); C(sx + .1, yo - .05, fr + .02, .03, .25, .02, '#1F1D1A');
    }
    C(0, yo + .08, fr + .02, .1, .03, .02, '#1F1D1A');
    for (const sx of [-1, 1]) C(sx * (W / 2 + .01), yo + .1, .1, .02, .03, .5, '#1F1D1A');
  }
  // Cabelo em blocos, com volume (mais largo que a cabeça) e mechas na franja.
  if (ct) {
    const cs = escuro(ct, .18), cl = claro(ct, .14);
    if (!bone) C(0, topo - .02, -.02, W + .08, .16, D + .06, ct);
    C(0, yc + .12, -fr - .03, W + .08, H - .1, .1, cs);
    for (const sx of [-1, 1]) C(sx * (W / 2 + .03), yc + .34, -.08, .06, .4, D - .14, ct);
    if (!bone) {
      if (f.estilo === 'franja') C(0, topo - .2, fr + .02, W + .04, .2, .08, ct);
      else { C(-.2, topo - .16, fr + .02, .38, .16, .08, ct); C(.18, topo - .1, fr + .02, .42, .1, .08, ct); C(.28, topo - .18, fr + .02, .16, .1, .07, cs); }
      if (f.estilo === 'topete') { C(.05, topo + .12, .1, .5, .16, .42, ct); C(.05, topo + .2, .2, .36, .08, .26, cl); }
      if (f.estilo === 'cacheado') {
        for (const [a, b, c] of [[-.3, .14, .2], [0, .18, -.05], [.3, .14, .15], [-.2, .12, -.3], [.22, .12, -.28], [0, .14, .25]]) C(a, topo + .04, c, .3, b, .3, a > 0 ? cl : ct);
        for (const sx of [-1, 1]) C(sx * (W / 2 + .08), yc + .3, 0, .14, .38, .5, ct);
      }
      if (f.estilo === 'coque') { C(0, topo + .1, -.22, .3, .26, .3, ct); C(0, topo + .1, -.08, .32, .05, .05, f.agente || '#E5484D'); }
      if (f.estilo === 'curto') C(-.1, topo + .14, 0, .3, .06, .3, cl);
    }
    if (f.estilo === 'longo') {
      C(0, .56, -fr - .04, W + .1, .5, .12, cs);
      for (const sx of [-1, 1]) C(sx * (W / 2 + .04), .66, -.04, .08, .5, D - .2, ct);
    }
  }
  // Boné com aba.
  if (bone) {
    C(0, topo - .06, -.02, W + .08, .2, D + .06, f.chapeu);
    C(0, topo - .06, fr + .16, W + .02, .05, .32, escuro(f.chapeu, .15));
    C(0, topo + .14, -.02, .1, .04, .1, claro(f.chapeu, .5));
  }
  }
  // Acessório de cabeça do Habbo (chapéu, máscara, enfeite), em voxels na escala da nossa cabeça (figuraDoHabbo).
  if (f.acessorio?.blocos?.length) { const [lx, ly, lz] = (f.acessorio.lados || [f.acessorio.lado, f.acessorio.lado, f.acessorio.lado]).map((v) => v * 1.002); for (const k of f.acessorio.blocos) C(k.x, k.y, k.z, lx, ly, lz, k.cor); }
  let antena = -1;
  if (f.agente) {
    // Fone: arco por cima, conchas nas orelhas com o anel do setor e o microfone até a boca.
    const arco = topo + (ct && !bone ? .14 : 0);
    C(0, arco, 0, W + .2, .06, .12, '#2B2F33');
    for (const sx of [-1, 1]) {
      C(sx * (W / 2 + .07), yc + .4, 0, .06, arco - yc - .4, .12, '#2B2F33');
      C(sx * (W / 2 + .08), yc + .18, 0, .1, .26, .26, '#2B2F33');
      C(sx * (W / 2 + .14), yc + .22, 0, .02, .18, .18, f.agente, true);
    }
    C(-(W / 2 + .1), yc + .12, .2, .04, .04, .3, '#2B2F33');
    C(-.26, yc + .1, fr + .04, .1, .06, .06, f.agente, true);
    // Antena do estado: cinza sem leitura da central; a cor do estado quando há leitura.
    C(.26, arco + .06, -.12, .03, .26, .03, '#5A6268');
    antena = o.luzes.length;
    C(.26, arco + .32, -.12, .11, .11, .11, '#9AA3A8', true);
  }
  return antena;
}

let renderer = null, cena = null, camera = null;
const cache = new Map();
function preparar() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(128, 160, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight('#F3F7FF', '#4A3B2C', 1.3));
  const sol = new THREE.DirectionalLight('#FFF1D8', 1.6); sol.position.set(3, 5, 4); cena.add(sol);
  const contorno = new THREE.DirectionalLight('#FFB27A', 1.2); contorno.position.set(-3, 2, -3); cena.add(contorno);
  camera = new THREE.PerspectiveCamera(26, 128 / 160, .1, 50);
}

function boneco(f) { const o = new Obra(); desenharBoneco(o, f); return o.montar(); }

// Retrato (data URL) do agente de um setor: o mesmo boneco de agente do prédio (visor e fone na cor do setor).
export function avatarDoAgente(nome, cor = '#FF7A2F', { cabeca = false } = {}) {
  const chave = 'agente|' + nome + '|' + cor + '|' + cabeca;
  if (cache.has(chave)) return cache.get(chave);
  preparar();
  const g = boneco(figuraDoAgente(nome, cor)); g.rotation.y = .3; cena.add(g);
  if (cabeca) { camera.position.set(0, 1.36, 2.7); camera.lookAt(0, 1.3, 0); }
  else { camera.position.set(0, 1.1, 5); camera.lookAt(0, .93, 0); }
  renderer.render(cena, camera);
  const url = renderer.domElement.toDataURL('image/png');
  cena.remove(g); g.traverse((x) => x.geometry?.dispose?.());
  cache.set(chave, url);
  return url;
}

// Imagem (data URL) do avatar. so a cabeça quando "cabeca" (miniaturas).
export function avatarVoxel(figura, { cabeca = false, direcao = 2 } = {}) {
  const chave = figura + '|' + cabeca + '|' + direcao;
  if (cache.has(chave)) return cache.get(chave);
  preparar();
  const g = boneco(lerFigura(figura));
  g.rotation.y = [-.6, -.3, .3, .6, 2.6, 3, -2.6, -3][Number(direcao) % 8] ?? .3;
  cena.add(g);
  if (cabeca) { camera.position.set(0, 1.36, 2.7); camera.lookAt(0, 1.3, 0); }
  else { camera.position.set(0, 1.1, 5); camera.lookAt(0, .93, 0); }
  renderer.render(cena, camera);
  const url = renderer.domElement.toDataURL('image/png');
  cena.remove(g); g.traverse((x) => x.geometry?.dispose?.());
  cache.set(chave, url);
  return url;
}

// Prévia ao vivo do criador de personagem do Irecity (vybe-mundo-personagem.js, 07/11/2026): o MESMO
// boneco do avatarVoxel (boneco(lerFigura(figura)), mesma luz, mesma câmera de corpo inteiro), num canvas
// da própria janela, que gira com o arrasto. Desenha só quando algo muda (figura, giro, tamanho).
// Devolve { trocar(figura), girar(delta), angulo(), destruir() }.
export function desenharPreviaAvatar(canvas, figura = '', { angulo = .3 } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  const c = new THREE.Scene();
  c.add(new THREE.HemisphereLight('#F3F7FF', '#4A3B2C', 1.3)); // mesma luz do preparar()
  const sol = new THREE.DirectionalLight('#FFF1D8', 1.6); sol.position.set(3, 5, 4); c.add(sol);
  const contorno = new THREE.DirectionalLight('#FFB27A', 1.2); contorno.position.set(-3, 2, -3); c.add(contorno);
  const cam = new THREE.PerspectiveCamera(26, 128 / 160, .1, 50);
  cam.position.set(0, 1.1, 5); cam.lookAt(0, .93, 0);
  let g = null, atual = null, giro = Number(angulo) || 0, quadro = 0, vivo = true;
  const pedir = () => { if (vivo && !quadro) quadro = requestAnimationFrame(desenhar); };
  // A Obra cria geometria e material para cada boneco: os dois saem juntos.
  const soltar = (o) => o.traverse((x) => { x.geometry?.dispose?.(); x.material?.dispose?.(); });
  function desenhar() {
    quadro = 0;
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (!vivo || !w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    if (g) g.rotation.y = giro;
    r.render(c, cam);
  }
  function trocar(f) {
    const nova = String(f || '');
    if (!vivo || nova === atual) return;
    atual = nova;
    if (g) { c.remove(g); soltar(g); }
    g = boneco(lerFigura(nova)); c.add(g); pedir();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(pedir) : null;
  ro?.observe(canvas);
  trocar(figura);
  return {
    trocar,
    girar(delta) { giro += Number(delta) || 0; pedir(); },
    angulo: () => giro,
    destruir() {
      if (!vivo) return;
      vivo = false; ro?.disconnect(); if (quadro) cancelAnimationFrame(quadro);
      if (g) soltar(g);
      r.dispose(); r.forceContextLoss?.();
    },
  };
}

// ---------- Ícones voxel dos móveis (no lugar da arte do Habbo) ----------
// A classe do móvel do Habbo (ex.: "shelves_norja", "bling_sofa_mu", "hc3_stereo") diz o tipo;
// o ícone voxel é desse tipo, numa cor fixa pela classe. Mesmo tamanho do desenho antigo.
const CORES_MOVEL = ['#FF7A2F', '#0D74CE', '#18A957', '#8E4EC6', '#E5484D', '#F7C948', '#D6409F', '#38D9C5', '#B07A45', '#64738A'];
export function tipoDoMovel(classe = '') {
  const c = String(classe).toLowerCase();
  const T = [
    ['trofeu', /troph|prize|cup|award|medal|throne|crown|statue/], ['bau', /crate|chest|box|gift|present|bau/], ['cadeira', /chair|stool|seat|bench|throne/],
    ['sofa', /sofa|couch|lounger|armchair/], ['cama', /bed/], ['mesa', /table|desk|counter|bar_/], ['planta', /plant|tree|flower|bush|cactus|palm|fern/],
    ['luminaria', /lamp|light|torch|candle|lantern|neon/], ['estante', /shelf|shelves|book|cabinet|wardrobe|closet/], ['som', /stereo|jukebox|music|radio|speaker|disco|dj/],
    ['tela', /tv|computer|comp|laptop|screen|monitor|arcade|cine/], ['quadro', /poster|picture|painting|frame|window|wall/], ['tapete', /rug|carpet|mat/],
    ['maquina', /coffee|machine|fridge|oven|treadmill|camera/],
  ];
  return (T.find(([, r]) => r.test(c)) || ['caixa'])[0];
}
function obraDoMovel(tipo, cor) {
  const o = new Obra();
  if (tipo === 'trofeu') { o.caixa(0, 0, 0, .7, .2, .7, '#3A3F44').caixa(0, .2, 0, .2, .4, .2, '#E2A11B').caixa(0, .6, 0, .7, .5, .7, '#F7C948').caixa(-.42, .75, 0, .14, .3, .14, '#F7C948').caixa(.42, .75, 0, .14, .3, .14, '#F7C948'); }
  else if (tipo === 'bau') { o.caixa(0, 0, 0, 1, .55, .7, '#8A5A3C').caixa(0, .55, 0, 1.04, .22, .74, '#6B4A2E').caixa(0, .4, .36, .2, .26, .04, '#F7C948'); }
  else if (tipo === 'cadeira') { o.caixa(0, 0, 0, .7, .45, .7, '#3A3F44').caixa(0, .45, 0, .74, .12, .74, cor).caixa(0, .57, -.32, .74, .7, .12, cor); }
  else if (tipo === 'sofa') { o.caixa(0, .1, 0, 1.6, .35, .8, cor).caixa(0, .45, -.3, 1.6, .5, .2, cor).caixa(-.72, .45, 0, .2, .25, .8, cor).caixa(.72, .45, 0, .2, .25, .8, cor).caixa(0, 0, 0, 1.4, .1, .7, '#6B4A2E'); }
  else if (tipo === 'cama') { o.caixa(0, 0, 0, 1, .35, 1.6, '#C99A6B').caixa(0, .35, .1, .94, .18, 1.4, '#F4F1EA').caixa(0, .53, -.5, .7, .14, .3, '#FFFFFF').caixa(0, .45, .35, .96, .1, .8, cor); }
  else if (tipo === 'mesa') { o.caixa(0, .7, 0, 1.4, .1, .9, cor); for (const [a, b] of [[-.6, -.35], [.6, -.35], [-.6, .35], [.6, .35]]) o.caixa(a, 0, b, .1, .7, .1, '#2B2F33'); }
  else if (tipo === 'planta') { o.caixa(0, 0, 0, .55, .45, .55, '#B5462F'); for (let k = 0; k < 6; k++) o.caixa(Math.sin(k) * .18, .45, Math.cos(k * 2) * .18, .14, .5 + (k % 3) * .25, .14, '#3E8F4E'); o.caixa(0, 1, 0, .5, .3, .5, '#5FA34E'); }
  else if (tipo === 'luminaria') { o.caixa(0, 0, 0, .5, .1, .5, '#2B2F33').caixa(0, .1, 0, .08, 1, .08, '#9AA3A8').luz(0, 1.1, 0, .55, .4, .55, '#FFE7A3'); }
  else if (tipo === 'estante') { o.caixa(0, 0, 0, 1, 1.6, .4, '#F4F1EA'); for (let k = 0; k < 3; k++) for (let l = 0; l < 4; l++) o.caixa(-.33 + l * .22, .15 + k * .5, .02, .16, .34, .3, CORES_MOVEL[(k * 4 + l) % 10]); }
  else if (tipo === 'som') { o.caixa(0, 0, 0, .9, 1.2, .5, '#2B2F33').luz(0, .85, .26, .6, .2, .02, cor); for (const y of [.25, .55]) o.caixa(0, y, .26, .32, .32, .02, '#9AA3A8'); }
  else if (tipo === 'tela') { o.caixa(0, 0, 0, .3, .5, .3, '#2B2F33').caixa(0, .5, 0, 1.3, .8, .1, '#1F1D1A').luz(0, .56, .06, 1.18, .68, .02, cor); }
  else if (tipo === 'quadro') { o.caixa(0, .2, 0, 1.1, .9, .08, '#6B4A2E').luz(0, .28, .05, .94, .74, .02, cor); }
  else if (tipo === 'tapete') { o.caixa(0, 0, 0, 1.6, .06, 1.1, cor).caixa(0, .01, 0, 1.3, .06, .8, '#F4F1EA'); }
  else if (tipo === 'maquina') { o.caixa(0, 0, 0, .8, 1.1, .6, '#9AA3A8').luz(0, .7, .31, .4, .2, .02, cor).caixa(0, .3, .31, .3, .2, .1, '#2B2F33'); }
  else { o.caixa(0, 0, 0, .9, .9, .9, cor).caixa(0, .9, 0, .96, .14, .96, '#FFFFFF').caixa(0, 0, .46, .14, 1.04, .02, '#FFFFFF'); }
  return o.montar();
}
const cacheIcone = new Map();
// Canvas 2D (w × h) com o ícone voxel do móvel, centralizado e apoiado embaixo.
export function iconeMovel(classe, w = 64, h = 64) {
  const chave = classe + '|' + w + '|' + h;
  if (cacheIcone.has(chave)) return cacheIcone.get(chave);
  preparar();
  const peca = pecaDaClasse(classe, tipoDoMovel(classe));
  const g = obraDaPeca(peca.desenho, peca.cor).montar();
  g.rotation.y = -.6; cena.add(g);
  // Enquadra pela caixa da peça: um quadro de parede e um fundo verde cabem igual a um pufe.
  const caixa = new THREE.Box3().setFromObject(g), centro = caixa.getCenter(new THREE.Vector3()), tam = caixa.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(24, 1, .1, 80), dist = tam / (2 * Math.tan(12 * Math.PI / 180)) * 1.08;
  cam.position.copy(centro).add(new THREE.Vector3(.5, .45, .74).normalize().multiplyScalar(dist)); cam.lookAt(centro);
  renderer.setSize(128, 128, false); renderer.render(cena, cam);
  const lado = Math.max(8, Math.min(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
  c.getContext('2d').drawImage(renderer.domElement, (w - lado) / 2, h - lado, lado, lado);
  renderer.setSize(128, 160, false);
  cena.remove(g); g.traverse((o) => o.geometry?.dispose?.());
  cacheIcone.set(chave, c);
  return c;
}
