// Motor do mundo voxel: renderizador, luz, câmera de maquete, controles de mapa,
// efeito tilt-shift e rótulos em HTML. Sem dados da Vybe aqui: só o palco.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { ESTILO, prepararRenderer, luzDoEstilo, acabamentoDeMaquete } from './estilo.mjs';

const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (t) => 1 - Math.pow(1 - t, 3);

// Em repouso só confere relógios/visibilidade duas vezes por segundo; nenhum quadro é desenhado.
export function criarAgendadorQuadros(passo, { frame = requestAnimationFrame, cancelarFrame = cancelAnimationFrame, timer = setTimeout, cancelarTimer = clearTimeout, agora = () => performance.now() } = {}) {
  let raf = null, espera = null, encerrado = false;
  function acordar() {
    if (encerrado) return;
    if (espera !== null) { cancelarTimer(espera); espera = null; }
    if (raf === null) raf = frame(executar);
  }
  function executar(t) {
    raf = null;
    if (encerrado) return;
    const continuar = passo(t);
    if (encerrado) return;
    // Uma atualização dentro de passo pode ter pedido o próximo RAF; não deixe um timer paralelo.
    if (continuar || raf !== null) acordar();
    else espera = timer(() => { espera = null; executar(agora()); }, 500);
  }
  return { acordar, destruir() { encerrado = true; if (raf !== null) cancelarFrame(raf); if (espera !== null) cancelarTimer(espera); raf = espera = null; } };
}

// Recursos compartilhados entre malhas são liberados uma só vez, inclusive texturas de uniforms.
export function liberarCena(cena) {
  const recursos = new Set();
  const textura = (v) => { if (v?.isTexture) recursos.add(v); else if (Array.isArray(v)) v.forEach(textura); };
  const material = (m) => { if (!m || recursos.has(m)) return; recursos.add(m); Object.values(m).forEach(textura); for (const u of Object.values(m.uniforms || {})) textura(u.value); };
  textura(cena.background); textura(cena.environment);
  cena.traverse((o) => {
    if (o.geometry) recursos.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(material);
    if (o.isInstancedMesh) recursos.add(o);
    if (o.shadow) recursos.add(o.shadow);
  });
  for (const recurso of recursos) recurso.dispose?.();
  cena.clear();
}

export function criarMotor(canvas, { reduzirMovimento = false } = {}) {
  const eventos = new AbortController();
  const ouvir = (alvo, nome, fn, opcoes = {}) => alvo.addEventListener(nome, fn, { ...opcoes, signal: eventos.signal });
  let ciclo, destruido = false, contextoPerdido = false;
  function invalidar() { if (destruido) return; sujo = true; ciclo?.acordar(); }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // 1,5× já é nítido no Retina e desenha ~44% menos pixels que 2×.
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  prepararRenderer(renderer); // acabamento do padrão voxel (estilo.mjs)
  // Sombra só é recalculada quando a câmera (ou a área iluminada) muda: o sol é parado e a cidade também.
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false; // o composer desenha várias passadas: zera uma vez por quadro, para medir o quadro inteiro

  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog(0xcfe2e6, 900, 2200);

  // Luz do padrão voxel (estilo.mjs): céu, sol com sombra, preenchimento frio e o contorno quente por trás. O sol do
  // mundo vem do alto à esquerda e acompanha o que se olha (posicionarCamera).
  const luz = luzDoEstilo(cena, { raio: 140, sombra: { mapa: 4096, lado: 140, longe: 600, bias: -0.0004, normalBias: 0.4 } });
  const { sol, preenche, contorno } = luz;
  sol.position.set(-110, 160, 70);
  const sc = sol.shadow.camera; sc.near = 10; sc.updateProjectionMatrix();
  preenche.position.set(120, 80, -90);
  contorno.position.set(110, 70, -120); contorno.target.position.set(0, 0, 0);

  const camera = new THREE.PerspectiveCamera(22, 1, 1, 6000);
  const orb = { alvo: new THREE.Vector3(0, 0, 0), dist: 420, giro: -0.75, incl: 0.92 };
  const quer = { alvo: orb.alvo.clone(), dist: orb.dist, giro: orb.giro, incl: orb.incl };
  const LIM = { dist: [18, 460], incl: [0.35, 1.25], raio: 150 };

  function posicionarCamera() {
    const { alvo, dist, giro, incl } = orb;
    camera.position.set(alvo.x + dist * Math.cos(incl) * Math.sin(giro), alvo.y + dist * Math.sin(incl), alvo.z + dist * Math.cos(incl) * Math.cos(giro));
    camera.lookAt(alvo);
    // Profundidade (Paulo, 08/11/2026: "a luz meio bugando"): com o corte perto fixo em 1 e a cena vista de até 460,
    // a profundidade perdia precisão e faces vizinhas brigavam (piscavam). O corte acompanha a distância.
    const perto = limitar(dist * 0.12, 0.5, 40), longe = dist * 6 + 900;
    if (Math.abs(camera.near - perto) > perto * 0.05 || Math.abs(camera.far - longe) > longe * 0.05) { camera.near = perto; camera.far = longe; camera.updateProjectionMatrix(); }
    // A sombra acompanha o que se olha. A área anda em degraus (não muda a cada pixel de zoom) e o centro da sombra
    // encaixa na grade dos pixels dela: a borda da sombra não "nada" quando a câmera anda. O desvio é medido pelo
    // tamanho do pixel da sombra (antes era fixo e alto, com sombra vazando e listras em peças finas).
    const lado = limitar(40 * Math.pow(1.25, Math.round(Math.log(Math.max(1, dist * 0.42) / 40) / Math.log(1.25))), 40, 260);
    const texel = (2 * lado) / sol.shadow.mapSize.x;
    const passo = texel * 4, ax = Math.round(alvo.x / passo) * passo, az = Math.round(alvo.z / passo) * passo;
    const chave = `${ax.toFixed(2)},${az.toFixed(2)},${lado.toFixed(1)}`;
    if (chave !== posicionarCamera.ultima) { posicionarCamera.ultima = chave; sombraPendente = true; solQuer = { ax, az, y: alvo.y, lado, texel }; }
  }
  // O sol e a área da sombra só mudam no quadro em que o mapa de sombra é refeito: antes o sol andava na hora e o
  // mapa velho ficava até 150 ms aplicado com o sol novo (a borda das sombras pulava e serrilhava ao mexer o mapa).
  let solQuer = null;
  function aplicarSol() {
    if (!solQuer) return;
    const { ax, az, y, lado, texel } = solQuer; solQuer = null;
    if (sc.right !== lado) { sc.left = -lado; sc.right = lado; sc.top = lado; sc.bottom = -lado; sc.updateProjectionMatrix(); }
    sol.shadow.bias = -0.0002; sol.shadow.normalBias = Math.max(0.02, texel * 1.4);
    sol.position.set(ax - 110, 160, az + 70); sol.target.position.set(ax, y, az); sol.target.updateMatrixWorld();
  }
  // Refazer a sombra é o mais caro do quadro: com a câmera andando, no máximo a cada 150 ms; parou, refaz a última.
  let sombraPendente = true, ultimaSombra = 0;
  function atualizarSombra(t, movendo) {
    if (!sombraPendente) return;
    if (movendo && t - ultimaSombra < 150) return;
    sombraPendente = false; ultimaSombra = t; aplicarSol(); renderer.shadowMap.needsUpdate = true;
  }

  // Acabamento de maquete do padrão (estilo.mjs: oclusão nos cantos e brilho no que acende, como no quarto) e, por
  // cima, o tilt-shift: desfoca o alto e o baixo da imagem, como foto de maquete.
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
  const acabamento = acabamentoDeMaquete(renderer, cena, camera, { passes: [tiltH, tiltV] });
  const composer = { render: () => acabamento.render(), setSize: (w, h) => acabamento.tamanho(w, h) };

  // Área livre: os painéis cobrem parte da tela; a cena centraliza no resto.
  const livre = { esq: 0, dir: 0, baixo: 0, atual: { esq: 0, dir: 0, baixo: 0 } };
  let W = 1, H = 1;
  function medir() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); composer.setSize(W, H);
    camera.aspect = W / H;
    const forca = 2.2 / Math.max(W, H);
    tiltH.uniforms.h.value = forca; tiltV.uniforms.v.value = forca;
    aplicarDeslocamento(); camera.updateProjectionMatrix(); invalidar();
    // Mudar o tamanho apaga o canvas: parado (módulo aberto, aba escondida), redesenha uma vez.
    if (typeof pausado !== 'undefined' && (pausado || !visivel)) { try { posicionarCamera(); composer.render(); } catch { /* ainda montando */ } }
  }
  function aplicarDeslocamento() {
    const a = livre.atual;
    const dx = (a.esq - a.dir) / 2, dy = a.baixo / 2;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5) camera.clearViewOffset();
    else camera.setViewOffset(W, H, -dx, dy, W, H);
  }

  // ---------- Controles ----------
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pontoNoChao(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(chao, p) ? p : null;
  }
  const vel = new THREE.Vector2();
  let arrasto = null, ultimoGesto = performance.now();
  const ponteiros = new Map();
  let pinca = null;
  const ouvintes = { clique: [], passar: [], mexeu: [] };

  function prender(alvo) {
    const d = Math.hypot(alvo.x, alvo.z);
    if (d > LIM.raio) alvo.multiplyScalar(LIM.raio / d);
  }
  function arrastar(dxPx, dyPx) {
    // Anda pelo chão na escala certa: 1 px = quanto o chão anda naquela distância.
    const escala = (2 * orb.dist * Math.tan((camera.fov * Math.PI) / 360)) / H;
    const s = Math.sin(orb.giro), c = Math.cos(orb.giro);
    const kz = 1 / Math.max(0.35, Math.sin(orb.incl));
    quer.alvo.x -= (dxPx * c + dyPx * s * kz) * escala;
    quer.alvo.z -= (-dxPx * s + dyPx * c * kz) * escala;
    prender(quer.alvo);
    orb.alvo.copy(quer.alvo);
  }
  for (const nome of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'dblclick']) ouvir(canvas, nome, () => ciclo?.acordar(), { passive: true });
  ouvir(document, 'visibilitychange', () => { if (!document.hidden) invalidar(); });
  ouvir(canvas, 'webglcontextlost', (e) => { e.preventDefault(); contextoPerdido = true; });
  ouvir(canvas, 'webglcontextrestored', () => { contextoPerdido = false; medir(); invalidar(); });
  ouvir(canvas, 'contextmenu', (e) => e.preventDefault());
  ouvir(canvas, 'pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    ultimoGesto = performance.now();
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), dist: quer.dist, giro: quer.giro };
      arrasto = null; return;
    }
    arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, girar: e.button === 2 || e.shiftKey, t: performance.now() };
    vel.set(0, 0); cancelarVoo();
  });
  ouvir(canvas, 'pointermove', (e) => {
    if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      quer.dist = limitar(pinca.dist * (pinca.d / d), ...LIM.dist);
      quer.giro = pinca.giro - (ang - pinca.ang);
      sujo = true; return;
    }
    if (!arrasto) { emitirPassar(e); return; }
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    arrasto.x = e.clientX; arrasto.y = e.clientY;
    if (arrasto.girar) {
      quer.giro -= dx * 0.006; quer.incl = limitar(quer.incl + dy * 0.004, ...LIM.incl);
    } else { arrastar(dx, dy); vel.set(dx, dy); }
    ultimoGesto = performance.now(); sujo = true;
    for (const f of ouvintes.mexeu) f();
  });
  function soltar(e) {
    ponteiros.delete(e.pointerId);
    if (ponteiros.size < 2) pinca = null;
    if (!arrasto) return;
    const parado = Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 5 && performance.now() - arrasto.t < 400;
    if (parado && e.button === 0) emitirClique(e);
    if (performance.now() - ultimoGesto > 60) vel.set(0, 0);
    arrasto = null;
  }
  ouvir(canvas, 'pointerup', soltar);
  ouvir(canvas, 'pointercancel', soltar);
  ouvir(canvas, 'wheel', (e) => {
    e.preventDefault(); cancelarVoo();
    const k = e.ctrlKey ? 0.012 : 0.0015; // trackpad (pinça) tem escala própria
    const novo = limitar(quer.dist * Math.exp(e.deltaY * k), ...LIM.dist);
    // Zoom em direção ao cursor.
    const p = pontoNoChao(e.clientX, e.clientY);
    if (p) { const f = 1 - novo / quer.dist; quer.alvo.x += (p.x - quer.alvo.x) * f; quer.alvo.z += (p.z - quer.alvo.z) * f; prender(quer.alvo); }
    quer.dist = novo; sujo = true;
  }, { passive: false });
  ouvir(canvas, 'dblclick', (e) => {
    const p = pontoNoChao(e.clientX, e.clientY);
    if (p) voar({ alvo: p, dist: Math.max(LIM.dist[0], quer.dist * 0.5) });
  });

  // Picking: quem se registra recebe o objeto sob o cursor.
  const clicaveis = [];
  function alvoSob(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(clicaveis, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.alvo && !o.userData.alvoPorInstancia) o = o.parent;
      if (!o) continue;
      if (o.userData.alvoPorInstancia) { const a = o.userData.alvoPorInstancia(h.instanceId); if (a) return a; continue; }
      return o.userData.alvo;
    }
    return null;
  }
  function emitirClique(e) { const a = alvoSob(e); for (const f of ouvintes.clique) f(a, e); }
  let ultimoPassar = 0;
  function emitirPassar(e) {
    const t = performance.now(); if (t - ultimoPassar < 50) return; ultimoPassar = t;
    const a = alvoSob(e); canvas.style.cursor = a ? 'pointer' : 'grab';
    for (const f of ouvintes.passar) f(a, e);
  }

  // Voo de câmera (focar um prédio, ver a região toda).
  let voo = null;
  function cancelarVoo() { voo = null; }
  function voar(destino, ms = 1100) {
    acordarDaFoto(); // voo de câmera (clicar num cliente, numa vista) conta como mexida
    const de = { alvo: quer.alvo.clone(), dist: quer.dist, giro: quer.giro, incl: quer.incl };
    const para = { alvo: destino.alvo ? new THREE.Vector3(destino.alvo.x, destino.alvo.y ?? 0, destino.alvo.z) : de.alvo, dist: destino.dist ?? de.dist,
      giro: destino.giro ?? de.giro, incl: destino.incl ?? de.incl };
    let dg = para.giro - de.giro; dg = Math.atan2(Math.sin(dg), Math.cos(dg)); para.giro = de.giro + dg;
    voo = { de, para, t0: performance.now(), ms: reduzirMovimento ? 1 : ms };
    invalidar();
  }

  // ---------- Rótulos em HTML ----------
  const camadaRotulos = document.createElement('div');
  camadaRotulos.className = 'mundo-rotulos';
  canvas.parentElement.appendChild(camadaRotulos);
  const rotulos = [];
  function rotulo({ pos, html, classe = '', distMax = Infinity, aoClicar = null, prioridade = 0, fixo = false }) {
    const el = document.createElement(aoClicar ? 'button' : 'div');
    if (aoClicar) { el.type = 'button'; el.addEventListener('click', (e) => { e.stopPropagation(); aoClicar(e); }); }
    el.className = 'mundo-rotulo ' + classe; el.innerHTML = html;
    camadaRotulos.appendChild(el);
    el.classList.add('escondido');
    const r = { el, pos: pos.clone(), distMax, prioridade, desce: 0, visivel: false, fixo };
    rotulos.push(r); invalidar(); return r;
  }
  function removerRotulo(r) { invalidar(); r.el.remove(); const i = rotulos.indexOf(r); if (i >= 0) rotulos.splice(i, 1); }
  const v3 = new THREE.Vector3();
  let quadro = 0;
  function posicionarRotulos() {
    const caixas = [];
    for (const r of rotulos) {
      v3.copy(r.pos).project(camera);
      const longe = camera.position.distanceTo(r.pos) > r.distMax;
      const fora = v3.z > 1 || v3.x < -1.1 || v3.x > 1.1 || v3.y < -1.1 || v3.y > 1.1;
      const mostra = !longe && !fora && !r.el.hidden;
      if (mostra !== r.visivel) { r.visivel = mostra; r.el.classList.toggle('escondido', !mostra); }
      if (!mostra) continue;
      r.x = (v3.x * 0.5 + 0.5) * W; r.y = (-v3.y * 0.5 + 0.5) * H;
      caixas.push(r);
    }
    // A cada 4 quadros resolve as colisões, sem empilhar nome em cima de nome:
    // pino fixo (cliente) que encosta noutro pino junta-se a ele ("+N"); nome comum que encosta some.
    if (quadro % 4 === 0) {
      caixas.sort((a, b) => (b.fixo - a.fixo) || b.prioridade - a.prioridade || a.y - b.y);
      const postos = [];
      for (const r of caixas) {
        const w = r.el.offsetWidth, h = r.el.offsetHeight;
        r.junto = 0; r.oculto = false; r.desce = 0;
        if (!w || !h) { r.oculto = true; continue; } // escondido pela vista (CSS): não ocupa lugar
        const bate = postos.find((p) => Math.abs(p.x - r.x) < (p.w + w) / 2 - 2 && Math.abs(p.y - r.y) < (p.h + h) / 2 - 1);
        if (bate) { r.oculto = true; if (r.fixo && bate.r.fixo) bate.r.junto++; continue; }
        postos.push({ x: r.x, y: r.y, w, h, r });
      }
      for (const r of caixas) {
        r.el.classList.toggle('colide', r.oculto);
        if (r.junto) r.el.dataset.mais = '+' + r.junto; else delete r.el.dataset.mais;
      }
    }
    for (const r of caixas) r.el.style.transform = `translate(-50%,-100%) translate(${r.x.toFixed(1)}px,${(r.y + r.desce).toFixed(1)}px)`;
  }

  const frustum = new THREE.Frustum(), projecao = new THREE.Matrix4(), esferaVista = new THREE.Sphere();
  const limites = new WeakMap();
  function emVista(o) {
    if (!o) return false;
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    o.updateWorldMatrix(true, false);
    let esfera = o.isInstancedMesh && o.boundingSphere ? o.boundingSphere : limites.get(o);
    if (!esfera) {
      esfera = new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere());
      esfera.applyMatrix4(new THREE.Matrix4().copy(o.matrixWorld).invert()); limites.set(o, esfera);
    }
    if (esfera.isEmpty()) return false;
    esferaVista.copy(esfera).applyMatrix4(o.matrixWorld);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projecao.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return frustum.intersectsSphere(esferaVista);
  }

  // ---------- Laço ----------
  let sujo = true, pausado = false, ultimo = performance.now(), visivel = true, ultimaAcao = performance.now(), estacionado = false;
  // Qualquer mexida na página (mouse, toque, roda, tecla) tira a cidade do modo "foto".
  const acordarDaFoto = () => { ultimaAcao = performance.now(); if (estacionado) { estacionado = false; ciclo?.acordar(); } };
  if (typeof window.addEventListener === 'function') for (const nome of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart']) ouvir(window, nome, acordarDaFoto, { passive: true, capture: true });
  const animadores = [];
  const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) invalidar(); }, { threshold: 0.01 });
  io.observe(canvas);
  function passo(t) {
    if (destruido || pausado || contextoPerdido || !visivel || document.hidden) return false;
    const interagindo = arrasto || pinca || voo || vel.lengthSq() > 0.01;
    // Mexendo: todo quadro. Parado, a cidade vira "foto" aos poucos (Paulo, 07/11/2026: "não ficar renderizando a cidade
    // toda o tempo todo"): o que só enfeita (nuvem, água, o V girando) cai para 30 qps, depois de 6 s para 15, depois de
    // 20 s para 4, e depois de 1 min o mapa para de ser desenhado até alguém mexer (ou um dado novo chegar: invalidar).
    const parado = performance.now() - ultimaAcao;
    if (!interagindo && !sujo && parado > 60000) { estacionado = true; return false; }
    if (!interagindo && t - ultimo < (parado > 20000 ? 250 : parado > 6000 ? 80 : 50)) return true;
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t; quadro++;
    // Inércia ao soltar o arrasto.
    if (!arrasto && vel.lengthSq() > 0.01) { arrastar(vel.x, vel.y); vel.multiplyScalar(0.92); sujo = true; }
    if (voo) {
      const k = suave(limitar((t - voo.t0) / voo.ms, 0, 1));
      quer.alvo.lerpVectors(voo.de.alvo, voo.para.alvo, k);
      quer.dist = voo.de.dist + (voo.para.dist - voo.de.dist) * k;
      quer.giro = voo.de.giro + (voo.para.giro - voo.de.giro) * k;
      quer.incl = voo.de.incl + (voo.para.incl - voo.de.incl) * k;
      if (k >= 1) voo = null;
    }
    const movendo = orb.alvo.distanceToSquared(quer.alvo) > 1e-6 || Math.abs(orb.dist - quer.dist) > .001 || Math.abs(orb.giro - quer.giro) > .00001 || Math.abs(orb.incl - quer.incl) > .00001;
    const f = 1 - Math.pow(0.0001, dt); // aproxima sem degrau
    orb.alvo.lerp(quer.alvo, f); orb.dist += (quer.dist - orb.dist) * f;
    orb.giro += (quer.giro - orb.giro) * f; orb.incl += (quer.incl - orb.incl) * f;
    const a = livre.atual; let mudouLivre = false;
    for (const k2 of ['esq', 'dir', 'baixo']) { const d = livre[k2] - a[k2]; if (Math.abs(d) > 0.5) { a[k2] += d * f; mudouLivre = true; } else a[k2] = livre[k2]; }
    if (mudouLivre) { aplicarDeslocamento(); camera.updateProjectionMatrix(); }
    posicionarCamera();
    let animando = false;
    for (const fn of animadores) animando = (fn(t / 1000, dt) === true) || animando;
    // Oclusão nos cantos só com a câmera parada: mexendo, ela tremulava (serrilhado) e era a passada mais cara (travava).
    // O raio acompanha a distância: de longe, cantos maiores; de perto, os do quarto.
    const quieta = !(movendo || interagindo || mudouLivre);
    if (quieta !== ultimaQuieta) { ultimaQuieta = quieta; if (qualidade > 1) { acabamento.oclusao(quieta); if (quieta) sujo = true; } }
    if (quieta) { const r = limitar(orb.dist * 0.006, 0.3, 2.4); if (Math.abs(r - raioAo) > raioAo * 0.1) { raioAo = r; acabamento.raioOclusao(r); sujo = true; } }
    const precisa = sujo || movendo || interagindo || mudouLivre || animando;
    if (!precisa) return false;
    // Sombra da cidade inteira só se refaz com a câmera (posicionarCamera) ou, com algo andando, a cada 12 s de uso.
    if (animando && parado < 6000 && t - (passo.sombra || 0) > 12000) { passo.sombra = t; renderer.shadowMap.needsUpdate = true; }
    atualizarSombra(t, movendo || interagindo);
    renderer.info.reset();
    const t0 = performance.now();
    composer.render();
    medida.ms = medida.ms * .9 + (performance.now() - t0) * .1; medida.quadros++;
    conferirQualidade(t, interagindo || movendo);
    posicionarRotulos();
    sujo = false;
    return Boolean(movendo || interagindo || mudouLivre || animando);
  }
  // Qualidade automática (Paulo, 08/11/2026: "não pode pesar nem esquentar o PC"): mexendo na cena, se os quadros
  // ficam lentos (menos de ~35 por segundo ou mais de 6 ms de trabalho por quadro) por uns 3 s seguidos, a cena
  // baixa um degrau: primeiro a nitidez (1×) e o desfoque de maquete, depois a sombra para 2048. Não volta sozinha
  // na mesma sessão (evita ficar trocando).
  let qualidade = 2, lentos = 0, ultimoQ = 0, ultimaQuieta = null, raioAo = 0;
  function conferirQualidade(t, mexendo) {
    if (!mexendo || qualidade === 0) { ultimoQ = t; return; }
    const intervalo = t - ultimoQ; ultimoQ = t;
    if (intervalo > 200) return; // voltou de uma pausa: não conta
    lentos = intervalo > 28 || medida.ms > 6 ? lentos + 1 : Math.max(0, lentos - 2);
    if (lentos < 90) return;
    lentos = 0; qualidade--;
    if (qualidade === 1) { renderer.setPixelRatio(1); tiltH.enabled = tiltV.enabled = false; acabamento.oclusao(false); medir(); }
    else { sol.shadow.mapSize.set(2048, 2048); sol.shadow.map?.dispose(); sol.shadow.map = null; renderer.shadowMap.needsUpdate = true; }
    invalidar();
  }
  const ro = new ResizeObserver(medir); ro.observe(canvas);
  const medida = { ms: 0, quadros: 0 };
  ciclo = criarAgendadorQuadros(passo);
  medir(); posicionarCamera(); ciclo.acordar();
  return {
    THREE, cena, camera, renderer, LIM,
    qualidade: () => qualidade,
    desempenho: () => ({ chamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, msPorQuadro: Math.round(medida.ms * 10) / 10, quadros: medida.quadros, pixelRatio: renderer.getPixelRatio(), laco: { pausado, visivel, estacionado, paradoMs: Math.round(performance.now() - ultimaAcao), sujo } }),
    adicionar: (o) => { cena.add(o); invalidar(); },
    invalidar, emVista,
    clicavel: (o) => clicaveis.push(o),
    naoClicavel: (o) => { const i = clicaveis.indexOf(o); if (i >= 0) clicaveis.splice(i, 1); },
    // true = a animação alterou algo visível; false/undefined = manutenção sem novo desenho.
    animar: (fn) => { animadores.push(fn); invalidar(); },
    reduzirMovimento: Boolean(reduzirMovimento),
    // Dia e noite (0 = dia, 1 = noite): o céu escurece, o sol vira luar e o que brilha (janelas, postes, letreiros)
    // passa a se destacar sozinho, porque não depende da luz.
    ambiente(noite = 0) {
      const k = limitar(Number(noite) || 0, 0, 1);
      luz.hora(k);
      renderer.toneMappingExposure = ESTILO.exposicao + (ESTILO.noite.exposicao - ESTILO.exposicao) * k;
      cena.background = k > 0 ? new THREE.Color(0xcfe2e6).lerp(new THREE.Color(0x26345e), k) : null;
      cena.fog.color.set(0xcfe2e6).lerp(new THREE.Color(0x26345e), k);
      renderer.shadowMap.needsUpdate = true; invalidar();
    },
    rotulo, removerRotulo,
    aoClicar: (f) => ouvintes.clique.push(f),
    emitirClique: (alvo) => { for (const f of ouvintes.clique) f(alvo, null); },
    aoPassar: (f) => ouvintes.passar.push(f),
    aoMexer: (f) => ouvintes.mexeu.push(f),
    voar,
    zoom: (fator) => { cancelarVoo(); quer.dist = limitar(quer.dist * fator, ...LIM.dist); ultimoGesto = performance.now(); acordarDaFoto(); invalidar(); },
    girar90: () => voar({ giro: Math.round((quer.giro + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2) - 0.75 + 0.75 }, 700),
    areaLivre: (esq = 0, dir = 0, baixo = 0) => { if (livre.esq === esq && livre.dir === dir && livre.baixo === baixo) return; livre.esq = esq; livre.dir = dir; livre.baixo = baixo; ultimoGesto = performance.now(); invalidar(); },
    pausar: (sim) => { const antes = pausado; pausado = !!sim; if (!sim && antes) { ultimo = performance.now(); invalidar(); } else if (sim && !antes) { try { composer.render(); } catch { /* sem quadro ainda */ } } },
    estado: () => ({ alvo: orb.alvo.clone(), dist: orb.dist, giro: orb.giro, incl: orb.incl, W, H, vo: camera.view && { ...camera.view }, aspect: camera.aspect }),
    projetar: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H]; },
    destruir: () => {
      if (destruido) return;
      destruido = true; pausado = true; ciclo.destruir(); eventos.abort(); io.disconnect(); ro.disconnect();
      liberarCena(cena);
      acabamento.destruir(); renderer.renderLists.dispose(); renderer.dispose();
      animadores.length = clicaveis.length = rotulos.length = 0;
      for (const lista of Object.values(ouvintes)) lista.length = 0;
      camadaRotulos.remove();
    },
  };
}
