// O Escritório em voxel (Paulo, 06/11/2026: "o Habbo vai virar o voxel"): o andar por
// dentro, no estilo de maquete (paredes, piso em ladrilhos, móveis detalhados) com as
// pessoas que estão nele. Cada zona do Escritório é uma sala do andar.
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { ruido } from './irece.mjs';
import { pecaDaClasse, obraDaPeca } from './catalogo.mjs';
import { tipoDoMovel } from './avatar.mjs';

const ROUPA = { laranja: '#FF9548', azul: '#78AAFF', verde: '#72CCAC', roxo: '#AC9BFF', rosa: '#EF9FBC', grafite: '#64738A' };
const MESA = { grafite: '#4A5056', azul: '#3E6FB0', verde: '#3E8F6B', roxo: '#6B55B8', laranja: '#D9773E' };
const PELE = { clara: '#F1C9A5', media: '#C68E6A', morena: '#9A6646', escura: '#6B4430' };

function paredes(o, W, D, H, { parede, rodape, tijolo }) {
  for (let x = 0; x < W; x += .5) for (let y = 0; y < H; y += .5) {
    const k = ruido(x * 7, y * 11);
    o.caixa(x + .25, y, -.15, .5, .5, .3, k < .12 ? tijolo : parede);
  }
  for (let z = 0; z < D; z += .5) for (let y = 0; y < H; y += .5) {
    const k = ruido(z * 5 + 3, y * 13);
    o.caixa(-.15, y, z + .25, .3, .5, .5, k < .12 ? tijolo : parede);
  }
  o.caixa(W / 2, 0, .02, W, .18, .06, rodape).caixa(.02, 0, D / 2, .06, .18, D, rodape);
  o.caixa(W / 2, H, -.15, W + .3, .12, .34, rodape).caixa(-.15, H, D / 2, .34, .12, D + .3, rodape);
}
function piso(o, W, D, a, b) {
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) o.caixa(x + .5, -.12, z + .5, .98, .12, .98, (x + z) % 2 ? a : b);
  o.caixa(W / 2, -.5, D / 2, W + .3, .38, D + .3, '#1E2124');
}
function janela(o, x, W) {
  o.caixa(x, .9, .02, 1.8, 1.3, .08, '#2B3A40').luz(x, .98, .06, 1.6, 1.14, .02, '#9FD6E3');
  o.caixa(x, 1.5, .1, 1.6, .06, .04, '#E8EEF0').caixa(x, .98, .1, .06, 1.14, .04, '#E8EEF0');
  o.caixa(x - 1.05, .7, .18, .3, 1.75, .14, '#2E7D4F').caixa(x + 1.05, .7, .18, .3, 1.75, .14, '#2E7D4F').caixa(x, 2.42, .16, 2.5, .12, .16, '#E8EEF0');
}
function porta(o, z) {
  o.caixa(.03, 0, z, .08, 2.1, 1.1, '#A0603A');
  for (const [a, b] of [[.5, .35], [1.3, .35], [.5, -.25], [1.3, -.25]]) o.caixa(.08, a, z + b * .9, .03, .6, .38, '#8E5232');
  o.caixa(.1, 1, z - .38, .06, .06, .14, '#D9D4C8').caixa(.03, 2.1, z, .1, .1, 1.24, '#7A4528');
}
function quadro(o, x, y, cor, fundo = '#1F1D1A') { o.caixa(x, y, .04, .9, .7, .05, fundo).luz(x, y + .12, .07, .72, .5, .02, cor); }
function estante(o, x, z, girar = false) {
  const [w, d] = girar ? [.4, 1.2] : [1.2, .4];
  o.caixa(x, 0, z, w, 2, d, '#F4F1EA');
  for (let k = 0; k < 4; k++) {
    o.caixa(x, .45 + k * .45, z, w * .95, .04, d * .95, '#E3D8C4');
    for (let l = 0; l < 5; l++) { const off = -.45 + l * .2; o.caixa(x + (girar ? 0 : off), .5 + k * .45, z + (girar ? off : 0), girar ? .28 : .14, .32, girar ? .14 : .28, ['#3E6FB0', '#E5484D', '#F7C948', '#2E7D4F', '#8E4EC6'][(l + k) % 5]); }
  }
}
function sofa(o, x, z, cor = '#E8A848', girar = false) {
  const [w, d] = girar ? [.9, 2] : [2, .9];
  o.caixa(x, .1, z, w, .4, d, cor).caixa(x + (girar ? -.35 : 0), .5, z + (girar ? 0 : -.35), girar ? .2 : w, .5, girar ? d : .2, cor);
  for (const s of [-1, 1]) o.caixa(x + (girar ? 0 : s * (w / 2 - .1)), .5, z + (girar ? s * (d / 2 - .1) : 0), girar ? w : .2, .25, girar ? .2 : d, cor);
  o.caixa(x, 0, z, w * .9, .1, d * .9, '#6B4A2E');
}
function planta(o, x, z, s = 1) { o.caixa(x, 0, z, .45 * s, .45 * s, .45 * s, '#B5462F'); for (let k = 0; k < 5; k++) o.caixa(x + (ruido(k, 3) - .5) * .3, .45 * s, z + (ruido(k, 9) - .5) * .3, .1, (.6 + ruido(k, 1) * .7) * s, .1, '#3E8F4E'); }
function luminaria(o, x, z) { o.caixa(x, 0, z, .45, .45, .45, '#FFFFFF').caixa(x, .45, z, .06, .4, .06, '#9AA3A8').luz(x, .85, z, .4, .35, .4, '#FFE7A3'); }
function tapete(o, x, z, w, d, cor) { o.caixa(x, 0, z, w, .025, d, '#3A3F44'); o.caixa(x, .006, z, w - .24, .025, d - .24, cor); for (let k = 1; k < 4; k++) o.caixa(x, .012, z - d / 2 + k * d / 4, w - .5, .025, .06, '#FFFFFF'); }
function mesaTrabalho(o, x, z, cor, { objeto = 'planta' } = {}) {
  o.caixa(x, .72, z, 1.8, .08, .8, cor); for (const [a, b] of [[-.8, -.32], [.8, -.32], [-.8, .32], [.8, .32]]) o.caixa(x + a, 0, z + b, .08, .72, .08, '#2B2F33');
  o.caixa(x, .8, z - .2, .9, .55, .06, '#1F1D1A').luz(x, .85, z - .16, .82, .45, .02, '#9FF0C8').caixa(x, .8, z - .25, .1, .2, .1, '#2B2F33');
  o.caixa(x + .1, .8, z + .15, .55, .03, .2, '#E8EEF0').caixa(x + .6, .8, z + .1, .12, .14, .12, '#FFFFFF');
  if (objeto === 'planta') planta(o, x - .7, z - .2, .5); else if (objeto === 'livros') o.caixa(x - .7, .8, z - .1, .3, .3, .2, '#E5484D'); else o.luz(x - .7, .8, z - .1, .2, .3, .2, '#FFE7A3');
  o.caixa(x, 0, z + .75, .55, .45, .55, '#3A3F44').caixa(x, .45, z + 1.0, .55, .55, .1, '#3A3F44');
}
function fliperama(o, x, z) {
  o.caixa(x, 0, z, .8, 1.9, .7, '#1F1D1A').luz(x, 1.05, z + .3, .6, .5, .04, '#5BD1FF').luz(x, 1.7, z + .33, .7, .18, .02, '#FF7A2F');
  o.caixa(x, .8, z + .4, .7, .1, .3, '#2B2F33').caixa(x - .15, .9, z + .45, .08, .1, .08, '#E5484D').caixa(x + .15, .9, z + .45, .08, .08, .08, '#F7C948');
  for (const s of [-1, 1]) o.luz(x + s * .42, .1, z, .03, 1.8, .7, '#38D9C5');
}
function sinuca(o, x, z) { o.caixa(x, 0, z, 2.6, .7, 1.5, '#5A3A22').caixa(x, .7, z, 2.4, .06, 1.3, '#1F8A4C'); for (const [a, b, c] of [[-.5, 0, '#FFFFFF'], [.3, .2, '#E5484D'], [.5, -.1, '#F7C948'], [.6, .25, '#1F1D1A']]) o.caixa(x + a, .76, z + b, .08, .08, .08, c); }

// O que cada sala tem, pela zona do Escritório.
function mobiliar(o, tipo, W, D, dono) {
  const cx = W / 2, cz = D / 2;
  if (tipo === 'pessoal') {
    mesaTrabalho(o, W - 2.2, 1.4, MESA[dono?.mesa] || '#C99A6B', { objeto: dono?.objeto });
    estante(o, .5, D - 1.6, true); sofa(o, cx - .4, D - 1.2, ROUPA[dono?.roupa] || '#E8A848'); tapete(o, cx, cz + .4, 3, 2, ROUPA[dono?.roupa] || '#FF7A2F');
    luminaria(o, cx - 2, D - 1.2); planta(o, W - .6, D - .6);
    o.caixa(cx + .9, 0, D - 2.3, .8, .42, .6, '#F4F1EA');
  } else if (tipo === 'jogos') {
    sinuca(o, cx, cz); fliperama(o, W - .8, .7); fliperama(o, W - 1.8, .7); sofa(o, 1.2, D - 1, '#8E4EC6');
    // Xadrez: mesa com tabuleiro; pôquer: mesa redonda verde com fichas.
    o.caixa(1.3, 0, 1.4, .1, .7, .1, '#2B2F33').caixa(1.3, .7, 1.4, 1, .06, 1, '#6B4A2E');
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) o.caixa(1.3 - .33 + a * .22, .76, 1.4 - .33 + b * .22, .22, .02, .22, (a + b) % 2 ? '#1F1D1A' : '#F4F1EA');
    o.caixa(W - 1.6, 0, D - 2.4, .3, .7, .3, '#2B2F33').caixa(W - 1.6, .7, D - 2.4, 1.5, .08, 1.5, '#1F6B44').caixa(W - 1.6, .7, D - 2.4, 1.6, .06, 1.6, '#6B4A2E');
    for (const [a, b, c] of [[-.3, .2, '#E5484D'], [.2, -.3, '#F7C948'], [.3, .3, '#0D74CE']]) o.caixa(W - 1.6 + a, .78, D - 2.4 + b, .14, .08, .14, c);
  }
  else if (tipo === 'cafe') {
    o.caixa(2, 0, .8, 3.2, .95, .7, '#6B4A2E').caixa(2, .95, .8, 3.3, .08, .8, '#E8E1D3').caixa(1, 1.03, .7, .5, .55, .4, '#9AA3A8').luz(1, 1.4, .92, .2, .1, .02, '#E5484D');
    for (const [a, b] of [[cx + 1, cz], [cx - 1, cz + 1.5], [cx + 1.6, cz + 2]]) { o.caixa(a, 0, b, .08, .72, .08, '#2B2F33').caixa(a, .72, b, .9, .06, .9, '#FFFFFF'); o.caixa(a + .6, 0, b, .4, .45, .4, '#E5484D').caixa(a - .6, 0, b, .4, .45, .4, '#E5484D'); }
    planta(o, W - .6, .6);
  } else if (tipo === 'lounge') { sofa(o, cx, D - 1.1, '#8E4EC6'); sofa(o, 1, cz, '#8E4EC6', true); tapete(o, cx, cz, 3, 2.4, '#8E4EC6'); o.caixa(W - .8, 0, .7, .9, 1.6, .6, '#3A3F44').luz(W - .8, 1.1, 1.01, .7, .3, .02, '#FF7A2F'); luminaria(o, W - .7, D - .7); }
  else if (tipo === 'academia') { for (const k of [0, 1]) { o.caixa(2 + k * 2.5, 0, cz, .5, .45, 1.6, '#2B2F33'); o.caixa(2 + k * 2.5, .75, cz - .7, 1.6, .05, .05, '#9AA3A8'); } o.luz(cx, .3, .06, W - 1, 1.8, .02, '#CFE6EC'); tapete(o, cx, cz + 1.5, W - 1.5, 1.6, '#2B2F33'); }
  else if (tipo === 'reuniao' || tipo === 'auditorio') {
    if (tipo === 'reuniao') { o.caixa(cx, .72, cz, 3.4, .08, 1.4, '#FFFFFF').caixa(cx, 0, cz, .3, .72, .3, '#2B2F33'); for (const a of [-1.2, 0, 1.2]) for (const s of [-1, 1]) o.caixa(cx + a, 0, cz + s * 1.05, .5, .45, .5, '#2B2F33'); }
    else for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) o.caixa(cx + c * .9, r * .2, cz + r * 1.1, .7, .45, .6, '#B5462F');
    o.caixa(cx, 1, .06, 3, 1.6, .06, '#1F1D1A').luz(cx, 1.08, .1, 2.8, 1.44, .02, '#BFE3EA');
  } else if (tipo === 'producao') {
    o.luz(cx, 0, .12, W - 2, 2.6, .04, '#3DDC84');
    for (const a of [-1.5, 1.5]) { o.caixa(cx + a, 0, cz, .06, 1.6, .06, '#2B2F33').luz(cx + a, 1.6, cz, .6, .45, .2, '#FFF1D2'); }
    o.caixa(cx, 0, cz + 1.5, .06, 1.2, .06, '#2B2F33').caixa(cx, 1.2, cz + 1.5, .45, .3, .35, '#1F1D1A').luz(cx, 1.3, cz + 1.3, .14, .1, .02, '#E5484D');
  } else if (tipo === 'operacao') {
    for (let k = 0; k < 4; k++) o.caixa(1.2 + k * 1.6, 1, .06, 1.4, .9, .06, '#1F1D1A').luz(1.2 + k * 1.6, 1.05, .1, 1.3, .8, .02, ['#9FF0C8', '#BFE3EA', '#FFD6A8', '#C9B6F2'][k]);
    for (let k = 0; k < 3; k++) mesaTrabalho(o, 1.6 + k * 2.2, cz + .6, '#4A5056', { objeto: 'luminaria' });
  } else if (tipo === 'foco') { mesaTrabalho(o, cx, cz, '#E8E1D3'); planta(o, .7, .7); planta(o, W - .7, .7); estante(o, W - .5, D - 1.5, true); }
  else { // Convivência
    sofa(o, cx - 1.2, D - 1.2, '#FF7A2F'); sofa(o, 1, cz, '#E8A848', true); tapete(o, cx, cz, 3.4, 2.6, '#FF7A2F'); o.caixa(cx, 0, cz, 1.2, .42, .7, '#C99A6B');
    planta(o, W - .7, .7); planta(o, .7, D - .7); luminaria(o, W - .7, D - .8);
  }
}

// O andar por dentro (Paulo, 06/11/2026: "todos se veem ali no andar; a voz só funciona
// quando entra na sala da pessoa"). Escritório aberto: cada zona do Escritório é uma
// sala de vidro baixo no andar; todo mundo do andar aparece; entrar numa sala liga a
// voz daquela zona (o motor do Escritório cuida da voz, das trancas e da presença).
const LADO_SALA = 7, CORREDOR = 2;
export function abrirAndar(canvas, { zonas = [], titulo = '' } = {}) {
  const porLinha = Math.min(3, Math.max(1, zonas.length <= 4 ? 2 : 3));
  const linhas = Math.ceil(zonas.length / porLinha);
  const W = porLinha * LADO_SALA, D = linhas * LADO_SALA + (linhas - 1) * CORREDOR, H = 3;
  const salas = zonas.map((z, i) => ({ ...z, ox: (i % porLinha) * LADO_SALA, oz: Math.floor(i / porLinha) * (LADO_SALA + CORREDOR) }));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight('#F3F7FF', '#4A3B2C', 1.1));
  const sol = new THREE.DirectionalLight('#FFF1D8', 1.8); sol.position.set(W + 8, 18, D + 10); sol.target.position.set(W / 2, 0, D / 2);
  sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096); const s = Math.max(W, D); Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 80 }); sol.shadow.bias = -.0005;
  cena.add(sol, sol.target);

  // Casca do andar: piso do corredor, as duas paredes de fora (maquete) e a fachada ripada.
  const casca = new Obra();
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) casca.caixa(x + .5, -.14, z + .5, .98, .1, .98, (x + z) % 2 ? '#D9D2C2' : '#E3DCCD');
  casca.caixa(W / 2, -.55, D / 2, W + .4, .4, D + .4, '#1C1C1F');
  paredes(casca, W, D, H, { parede: '#2A2A2E', rodape: '#1C1C1F', tijolo: '#202024' });
  for (let x = 1.5; x < W; x += 3.5) casca.luz(x, .2, .03, .06, H - .4, .02, '#FF9A4A');
  for (let z = 1.5; z < D; z += 3.5) casca.luz(.03, .2, z, .02, H - .4, .06, '#FF9A4A');
  casca.caixa(W - .02, 0, D / 2, .04, .1, D, '#FF7A2F').caixa(W / 2, 0, D - .02, W, .1, .04, '#FF7A2F');
  cena.add(casca.montar());

  // Cada sala: piso próprio, divisória de vidro baixo com vão de porta, placa e móveis.
  const vidro = new THREE.MeshStandardMaterial({ color: '#BFE3EA', transparent: true, opacity: .35, roughness: .1, depthWrite: false });
  const etiquetas = [], alvosJogo = [];
  for (const sl of salas) {
    const o = new Obra(), pessoal = Boolean(sl.dono);
    for (let x = 0; x < LADO_SALA; x++) for (let z = 0; z < LADO_SALA; z++) o.caixa(x + .5, -.09, z + .5, .98, .08, .98, pessoal ? ((x + z) % 2 ? '#B98A5C' : '#C99A6B') : ((x + z) % 2 ? '#2E6F7A' : '#357D88'));
    // Sala decorada pela pessoa: os móveis salvos (classe, x, y, direção), cada um como a peça voxel dele.
    const decorada = Array.isArray(sl.itens) && sl.itens.length && sl.L;
    if (!decorada) mobiliar(o, sl.tipo, LADO_SALA, LADO_SALA, sl.perfil);
    // Divisórias: frente e lado direito de vidro baixo (todo mundo se vê), com vão de porta.
    for (const [x, z, w, d] of [[LADO_SALA - .05, LADO_SALA / 2 - 1.5, .1, LADO_SALA - 3], [LADO_SALA / 2 - 1.5, LADO_SALA - .05, LADO_SALA - 3, .1]]) o.caixa(x, 0, z, w, .25, d, '#1C1C1F');
    const g = o.montar(); g.position.set(sl.ox, 0, sl.oz); cena.add(g);
    if (sl.tipo === 'jogos' && !decorada) for (const [jogo, x, z, w, d] of [['sinuca', LADO_SALA / 2, LADO_SALA / 2, 2.8, 1.7], ['xadrez', 1.3, 1.4, 1.2, 1.2], ['poker', LADO_SALA - 1.6, LADO_SALA - 2.4, 1.8, 1.8], ['mesa', LADO_SALA - 1.3, .7, 2, .8]]) {
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(sl.ox + x, .7, sl.oz + z); caixa.userData = { jogo, zona: sl.id }; cena.add(caixa); alvosJogo.push(caixa);
    }
    if (decorada) for (const it of sl.itens) {
      const [classe, ix, iy, dir] = it; if (!classe || !Number.isFinite(ix)) continue;
      const peca = pecaDaClasse(classe, tipoDoMovel(classe)), m = obraDaPeca(peca.desenho, peca.cor).montar();
      m.position.set(sl.ox + (ix + .5) / sl.L.w * LADO_SALA, 0, sl.oz + (iy + .5) / sl.L.d * LADO_SALA);
      m.rotation.y = -(Number(dir) || 0) / 2 * Math.PI / 2; cena.add(m);
    }
    for (const [x, z, w, d] of [[LADO_SALA - .05, LADO_SALA / 2 - 1.5, .06, LADO_SALA - 3], [LADO_SALA / 2 - 1.5, LADO_SALA - .05, LADO_SALA - 3, .06]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), vidro); m.position.set(sl.ox + x, .8, sl.oz + z); m.renderOrder = 2; cena.add(m);
    }
    const el = document.createElement('div'); el.className = 'sala-placa' + (pessoal ? ' pessoal' : '');
    el.innerHTML = `<b>${String(sl.nome).replace(/[<>&]/g, '')}</b><span></span>`;
    canvas.parentElement.appendChild(el);
    etiquetas.push({ el, sl });
  }

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  const alvo = new THREE.Vector3(W / 2, .5, D / 2);
  let giro = .78, incl = .82, dist = Math.max(W, D) * 2.1; const quer = { giro, incl, dist, alvo: alvo.clone() };
  function posicionar() { camera.position.set(alvo.x + dist * Math.cos(incl) * Math.sin(giro), alvo.y + dist * Math.sin(incl), alvo.z + dist * Math.cos(incl) * Math.cos(giro)); camera.lookAt(alvo); }
  function medir() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(medir); ro.observe(canvas); medir();

  // Pessoas do andar inteiro, cada uma na sua sala (posição local da presença, na escala da sala).
  const pessoas = new Map();
  function boneco(p) {
    const g = new THREE.Group(), ob = new Obra(), roupa = ROUPA[p.roupa] || p.roupa || '#FF7A2F';
    ob.caixa(-.11, 0, 0, .16, .5, .2, '#2B2F33').caixa(.11, 0, 0, .16, .5, .2, '#2B2F33');
    ob.caixa(0, .5, 0, .46, .55, .28, roupa).caixa(-.3, .55, 0, .12, .45, .14, roupa).caixa(.3, .55, 0, .12, .45, .14, roupa);
    ob.caixa(0, 1.05, 0, .34, .34, .34, PELE[p.pele] || '#C68E6A').caixa(0, 1.33, -.02, .38, .12, .4, p.cabelo === 'longo' ? '#4A2E1A' : '#2B1D14');
    if (p.cabelo === 'longo') ob.caixa(0, .95, -.16, .38, .4, .08, '#4A2E1A');
    ob.caixa(-.08, 1.18, .17, .05, .05, .02, '#1F1D1A').caixa(.08, 1.18, .17, .05, .05, .02, '#1F1D1A');
    if (p.eu) ob.luz(0, .01, 0, .9, .02, .9, '#FF7A2F');
    g.add(ob.montar()); cena.add(g);
    const el = document.createElement('div'); el.className = 'sala-nome' + (p.eu ? ' eu' : '');
    canvas.parentElement.appendChild(el);
    return { g, el, x: 0, z: 0, alvo: { x: 0, z: 0 }, novo: true };
  }
  function definirPessoas(lista, minhaZona) {
    const vistos = new Set();
    const porSala = new Map();
    for (const p of lista) { const sl = salas.find((x) => x.id === p.zona); if (!sl) continue; if (!porSala.has(sl.id)) porSala.set(sl.id, []); porSala.get(sl.id).push(p); }
    for (const [id, gente] of porSala) {
      const sl = salas.find((x) => x.id === id);
      gente.forEach((p, i) => {
        vistos.add(p.id);
        let b = pessoas.get(p.id); if (!b) { b = boneco(p); pessoas.set(p.id, b); }
        const temPos = Number.isFinite(p.x) && Number.isFinite(p.y) && p.L;
        const lx = temPos ? p.x / p.L.w * LADO_SALA : 2 + (i % 3) * 1.4, lz = temPos ? p.y / p.L.d * LADO_SALA : 3.6 + Math.floor(i / 3) * 1.2;
        b.alvo = { x: sl.ox + Math.max(.5, Math.min(LADO_SALA - .5, lx)), z: sl.oz + Math.max(.5, Math.min(LADO_SALA - .5, lz)) };
        if (b.novo) { b.x = b.alvo.x; b.z = b.alvo.z; b.novo = false; }
        const comVoz = minhaZona && p.zona === minhaZona && !p.eu;
        b.el.innerHTML = `${comVoz ? '<i>🎙</i>' : ''}${String(p.nome || '').split(' ')[0].replace(/[<>&]/g, '')}`;
      });
    }
    for (const [id, b] of pessoas) if (!vistos.has(id)) { cena.remove(b.g); b.el.remove(); pessoas.delete(id); }
    for (const e of etiquetas) { const n = porSala.get(e.sl.id)?.length || 0; e.el.querySelector('span').textContent = n ? `${n} aqui` : ''; e.el.classList.toggle('minha', e.sl.id === minhaZona); }
  }

  // Controles: arrastar gira a maquete, roda aproxima, clique numa sala entra nela (e na voz dela).
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let arrasto = null, aoSala = null;
  canvas.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    quer.giro = Math.max(.1, Math.min(1.45, quer.giro - (e.clientX - arrasto.x) * .005));
    quer.incl = Math.max(.35, Math.min(1.3, quer.incl + (e.clientY - arrasto.y) * .004));
    arrasto.x = e.clientX; arrasto.y = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    const parado = arrasto && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 5; arrasto = null;
    if (!parado || !aoSala) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const p = new THREE.Vector3();
    const jogo = ray.intersectObjects(alvosJogo, false)[0]?.object?.userData;
    if (jogo) { aoSala(jogo.zona, .5, .5, jogo.jogo); return; }
    if (!ray.ray.intersectPlane(chao, p)) return;
    const sl = salas.find((x) => p.x >= x.ox && p.x < x.ox + LADO_SALA && p.z >= x.oz && p.z < x.oz + LADO_SALA);
    if (sl) aoSala(sl.id, (p.x - sl.ox) / LADO_SALA, (p.z - sl.oz) / LADO_SALA);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (arrasto) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); canvas.style.cursor = ray.intersectObjects(alvosJogo, false).length ? 'pointer' : '';
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); quer.dist = Math.max(Math.max(W, D) * .9, Math.min(Math.max(W, D) * 3, quer.dist * Math.exp(e.deltaY * .0012))); }, { passive: false });

  let vivo = true, ultimo = performance.now();
  const v = new THREE.Vector3();
  function rotular(el, x, y, z, r) { v.set(x, y, z).project(camera); el.style.transform = `translate(-50%,-100%) translate(${((v.x * .5 + .5) * r.width).toFixed(1)}px,${((-v.y * .5 + .5) * r.height).toFixed(1)}px)`; }
  function passo(t) {
    if (!vivo) return; requestAnimationFrame(passo);
    if (document.hidden) return;
    const dt = Math.min(.05, (t - ultimo) / 1000); ultimo = t;
    const f = 1 - Math.pow(.001, dt);
    giro += (quer.giro - giro) * f; incl += (quer.incl - incl) * f; dist += (quer.dist - dist) * f; alvo.lerp(quer.alvo, f);
    posicionar();
    const r = canvas.getBoundingClientRect();
    for (const b of pessoas.values()) {
      const dx = b.alvo.x - b.x, dz = b.alvo.z - b.z, anda = Math.hypot(dx, dz) > .02;
      b.x += dx * Math.min(1, dt * 3); b.z += dz * Math.min(1, dt * 3);
      if (anda) b.g.rotation.y = Math.atan2(dx, dz);
      b.g.position.set(b.x, anda ? Math.abs(Math.sin(t / 90)) * .06 : 0, b.z);
      rotular(b.el, b.x, 1.8, b.z, r);
    }
    for (const e of etiquetas) rotular(e.el, e.sl.ox + LADO_SALA / 2, H + .3, e.sl.oz + .4, r);
    renderer.render(cena, camera);
  }
  requestAnimationFrame(passo);
  return {
    W, D, titulo,
    pessoas: definirPessoas,
    aoClicarSala: (f) => { aoSala = f; },
    focarSala(id) { const sl = salas.find((x) => x.id === id); if (sl) { quer.alvo.set(sl.ox + LADO_SALA / 2, .5, sl.oz + LADO_SALA / 2); quer.dist = LADO_SALA * 2.6; } },
    verAndar() { quer.alvo.set(W / 2, .5, D / 2); quer.dist = Math.max(W, D) * 2.1; },
    destruir() { vivo = false; ro.disconnect(); for (const b of pessoas.values()) b.el.remove(); for (const e of etiquetas) e.el.remove(); renderer.dispose(); },
  };
}
