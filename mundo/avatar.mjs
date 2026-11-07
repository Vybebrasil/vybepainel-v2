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

export function lerFigura(figura = '') {
  const partes = {};
  for (const p of String(figura).split('.')) { const [t, id, c1, c2] = p.split('-'); if (t) partes[t] = { id: Number(id) || 0, c: Number(c1) || 0, c2: Number(c2) || 0 }; }
  const cabelo = partes.hr, cabeca = partes.hd, camisa = partes.ch, calca = partes.lg, chapeu = partes.ha, casaco = partes.cc, oculos = partes.ea;
  return {
    pele: pega(PELE, cabeca ? cabeca.c : h(figura)),
    cabelo: cabelo ? pega(CABELO, cabelo.c + cabelo.id) : null,
    longo: cabelo ? cabelo.id % 3 === 0 || [500, 515, 545, 836, 890].includes(cabelo.id) : false,
    roupa: pega(ROUPA, camisa ? camisa.c + camisa.id : h(figura) + 3),
    casaco: casaco ? pega(ROUPA, casaco.c + 5) : null,
    calca: pega(CALCA, calca ? calca.c + calca.id : h(figura) + 7),
    chapeu: chapeu ? pega(ROUPA, chapeu.c + 2) : null,
    oculos: Boolean(oculos),
  };
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

function boneco(f) {
  const o = new Obra();
  o.caixa(-.13, 0, 0, .2, .62, .24, f.calca).caixa(.13, 0, 0, .2, .62, .24, f.calca);
  o.caixa(-.13, 0, .03, .22, .1, .3, '#1F1D1A').caixa(.13, 0, .03, .22, .1, .3, '#1F1D1A');
  o.caixa(0, .62, 0, .56, .64, .32, f.roupa);
  if (f.casaco) { o.caixa(-.2, .62, .02, .18, .64, .34, f.casaco).caixa(.2, .62, .02, .18, .64, .34, f.casaco); }
  o.caixa(-.36, .7, 0, .14, .52, .16, f.casaco || f.roupa).caixa(.36, .7, 0, .14, .52, .16, f.casaco || f.roupa);
  o.caixa(-.36, .6, 0, .13, .12, .14, f.pele).caixa(.36, .6, 0, .13, .12, .14, f.pele);
  o.caixa(0, 1.26, 0, .44, .44, .42, f.pele);
  o.caixa(-.1, 1.44, .215, .07, .07, .02, '#1F1D1A').caixa(.1, 1.44, .215, .07, .07, .02, '#1F1D1A');
  o.caixa(0, 1.34, .215, .14, .03, .02, '#8A3B2E');
  if (f.oculos) o.caixa(0, 1.42, .225, .36, .1, .02, '#1F1D1A');
  if (f.cabelo) { o.caixa(0, 1.62, -.02, .48, .14, .48, f.cabelo).caixa(0, 1.3, -.2, .48, .34, .1, f.cabelo); if (f.longo) o.caixa(0, .98, -.2, .48, .42, .1, f.cabelo).caixa(-.23, 1.1, 0, .06, .5, .36, f.cabelo).caixa(.23, 1.1, 0, .06, .5, .36, f.cabelo); }
  if (f.chapeu) o.caixa(0, 1.7, 0, .52, .16, .5, f.chapeu).caixa(0, 1.7, .26, .52, .05, .16, f.chapeu);
  return o.montar();
}

// Imagem (data URL) do avatar. so a cabeça quando "cabeca" (miniaturas).
export function avatarVoxel(figura, { cabeca = false, direcao = 2 } = {}) {
  const chave = figura + '|' + cabeca + '|' + direcao;
  if (cache.has(chave)) return cache.get(chave);
  preparar();
  const g = boneco(lerFigura(figura));
  g.rotation.y = [-.6, -.3, .3, .6, 2.6, 3, -2.6, -3][Number(direcao) % 8] ?? .3;
  cena.add(g);
  if (cabeca) { camera.position.set(0, 1.35, 2.2); camera.lookAt(0, 1.3, 0); }
  else { camera.position.set(0, 1.05, 4.6); camera.lookAt(0, .9, 0); }
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
  cam.position.set(0, 1.05, 4.6); cam.lookAt(0, .9, 0);
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
