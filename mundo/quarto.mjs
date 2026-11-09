// Minha sala (Paulo, 09/11/2026: "junto ao Prédio e ao Centro vai ter o MINHA SALA, como a gente fazia com o Habbo...
// pode copiar literalmente o quarto de cada um como estava no Habbo e refazer tudo no estilo voxel do nosso mundo").
//
// O quarto do Escritório inteiro, ladrilho por ladrilho, na escala do mundo: 1 ladrilho = 1 unidade e 1 nível da
// planta do Habbo = NIVEL de altura. Tudo vem do que já está salvo (planta, acabamento e a camada sala-N); aqui só se
// desenha, nada é gravado. Os bonecos de quem está na sala saem de desenharBoneco, o mesmo do mundo.
//
// Só desenha quando algo muda (câmera, alguém andando, dados novos): parado, nenhum quadro; fora de vista ou com a aba
// escondida, nem o pedido de quadro fica pendente.
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { pecaDaClasse, obraDaPeca } from './catalogo.mjs';
import { tipoDoMovel, desenharBoneco, figuraDaPessoa } from './avatar.mjs';
import { pegada, giroDaDirecao, definirMedida } from './sala.mjs';

export const NIVEL = .5; // altura de 1 nível da planta (no Habbo, meio ladrilho)
const ALTURA_PAREDE = 2.6, ESPESSURA = .3;
const PISO_PADRAO = ['#E9DCC4', '#F2E7D3'];
const ehCor = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
const misturar = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const limpo = (s) => String(s || '').replace(/[<>&"]/g, '');

// Planta normalizada: celdas[y][x] = nível (>= 0) ou -1 sem piso. Aceita a grade de números ou a função nivelEm.
export function plantaDoQuarto({ w, h, celdas = null, nivelEm = null } = {}) {
  const W = Math.max(1, Math.min(24, Math.round(Number(w) || 0) || (celdas?.[0]?.length || 8)));
  const D = Math.max(1, Math.min(24, Math.round(Number(h) || 0) || (celdas?.length || 8)));
  const grade = Array.from({ length: D }, (_, y) => Array.from({ length: W }, (_, x) => {
    const n = Array.isArray(celdas) ? celdas[y]?.[x] : typeof nivelEm === 'function' ? nivelEm(x, y) : 0;
    return Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.min(35, Number(n)) : -1;
  }));
  return { W, D, grade, nivel: (x, y) => grade[Math.floor(y)]?.[Math.floor(x)] ?? -1 };
}

// Onde cada parede fica: como no Habbo, no fundo (lado de y menor) e à esquerda (lado de x menor) de cada ladrilho da
// borda de cima e da esquerda da planta. Devolve [{ x, y, eixo: 'x' | 'y' }] (eixo 'x' = parede do fundo).
export function paredesDaPlanta(p) {
  const lista = [];
  for (let x = 0; x < p.W; x++) { const y = p.grade.findIndex((l) => l[x] >= 0); if (y >= 0) lista.push({ x, y, eixo: 'x' }); }
  for (let y = 0; y < p.D; y++) { const x = p.grade[y].findIndex((n) => n >= 0); if (x >= 0) lista.push({ x, y, eixo: 'y' }); }
  return lista;
}

export function abrirQuarto(canvas, { quarto = {} } = {}) {
  const P = plantaDoQuarto(quarto), { W, D } = P;
  const nivelMax = Math.max(0, ...P.grade.flat());
  const piso = Array.isArray(quarto.piso) && quarto.piso.length === 2 && quarto.piso.every(ehCor) ? quarto.piso : PISO_PADRAO;
  const corParede = ehCor(quarto.parede) ? quarto.parede : '#EFE4CF';
  const pisoEm = typeof quarto.pisoEm === 'function' ? quarto.pisoEm : () => null;
  const ehDeParede = typeof quarto.ehDeParede === 'function' ? quarto.ehDeParede : () => false;
  for (const [classe, m] of quarto.medidas || []) definirMedida(classe, m);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight('#F6FAFF', '#8A7A62', 1.25));
  const sol = new THREE.DirectionalLight('#FFF1D8', 1.9); sol.position.set(W + 8, 16, D + 10); sol.target.position.set(W / 2, 0, D / 2);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  const s = Math.max(W, D) + 4; Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 80 }); sol.shadow.bias = -.0005;
  const preenche = new THREE.DirectionalLight('#CFE4FF', .45); preenche.position.set(-10, 12, D + 6);
  cena.add(sol, sol.target, preenche);
  const liberar = (g) => g?.traverse?.((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); });

  // ---------- casca: piso em ladrilhos com os níveis da planta, base e paredes ----------
  const casca = new Obra();
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const n = P.grade[y][x]; if (n < 0) continue;
    const topo = n * NIVEL, [a, b] = pisoEm(x, y) || piso;
    casca.caixa(x + .5, -.62, y + .5, 1, .5 + topo, 1, '#C9C1B2'); // a base de concreto aparece nas bordas
    casca.caixa(x + .5, -.12, y + .5, 1, .12 + topo, 1, (x + y) % 2 ? a : b);
    // Degrau: o ladrilho mais alto que o vizinho da frente ganha a borda clara (lê-se a escada de longe).
    if (n > 0 && (P.nivel(x, y + 1) < n || P.nivel(x + 1, y) < n)) casca.caixa(x + .5, topo - .02, y + .5, 1.002, .04, 1.002, misturar(a, '#FFFFFF', .35));
  }
  if (quarto.semParedes !== true) {
    const H = ALTURA_PAREDE + nivelMax * NIVEL, topoParede = misturar(corParede, '#FFFFFF', .55), rodape = misturar(corParede, '#1F1D1A', .18);
    for (const { x, y, eixo } of paredesDaPlanta(P)) {
      const base = P.grade[y][x] * NIVEL, alto = H - base;
      if (eixo === 'x') {
        casca.caixa(x + .5, base - .62, y - ESPESSURA / 2, 1, alto + .62, ESPESSURA, (x % 2) ? corParede : misturar(corParede, '#1F1D1A', .04));
        casca.caixa(x + .5, base + alto, y - ESPESSURA / 2, 1, .1, ESPESSURA + .04, topoParede);
        casca.caixa(x + .5, base, y + .01, 1, .14, .04, rodape);
      } else {
        casca.caixa(x - ESPESSURA / 2, base - .62, y + .5, ESPESSURA, alto + .62, 1, (y % 2) ? misturar(corParede, '#1F1D1A', .08) : misturar(corParede, '#1F1D1A', .12));
        casca.caixa(x - ESPESSURA / 2, base + alto, y + .5, ESPESSURA + .04, .1, 1, topoParede);
        casca.caixa(x + .01, base, y + .5, .04, .14, 1, rodape);
      }
    }
    // O canto do fundo à esquerda fecha a quina.
    const y0 = P.grade.findIndex((l) => l.some((n) => n >= 0)), x0 = y0 >= 0 ? P.grade[y0].findIndex((n) => n >= 0) : -1;
    if (x0 >= 0) casca.caixa(x0 - ESPESSURA / 2, P.grade[y0][x0] * NIVEL - .62, y0 - ESPESSURA / 2, ESPESSURA, H - P.grade[y0][x0] * NIVEL + .72, ESPESSURA, topoParede);
  }
  const gCasca = casca.montar(); cena.add(gCasca);

  // ---------- móveis da camada salva: cada peça voxel no ladrilho dela, na altura do piso e do empilhamento ----------
  let gItens = null;
  function montarItens(itens) {
    if (gItens) { cena.remove(gItens); liberar(gItens); }
    gItens = new THREE.Group();
    for (const it of Array.isArray(itens) ? itens : []) {
      const [classe, ix, iy, dir, , altura] = Array.isArray(it) ? it : [];
      if (!classe || !Number.isFinite(Number(ix)) || !Number.isFinite(Number(iy))) continue;
      if (/^vybeimg_\d+$/.test(String(classe))) continue; // imagem da equipe: arte do Habbo, sem peça voxel
      const peca = pecaDaClasse(classe, tipoDoMovel(classe)), m = obraDaPeca(peca.desenho, peca.cor).montar();
      const x = Number(ix), y = Number(iy), d = Number(dir) || 0;
      if (ehDeParede(classe)) {
        // Pendurada: encostada na parede do fundo (direção 4) ou na da esquerda (2), acima do piso daquele ladrilho.
        const base = Math.max(0, P.nivel(x, y)) * NIVEL + 1.05;
        if (d === 2) m.position.set(Math.max(0, x) + .14, base, y + .5); else m.position.set(x + .5, base, Math.max(0, y) + .14);
        m.rotation.y = giroDaDirecao(d === 2 ? 2 : 4);
      } else {
        const p = pegada(classe, d), cx = x + p.w / 2, cz = y + p.h / 2;
        const n = Math.max(0, P.nivel(Math.min(W - 1, Math.max(0, Math.floor(x))), Math.min(D - 1, Math.max(0, Math.floor(y)))));
        m.position.set(cx, n * NIVEL + Math.max(0, Number(altura) || 0) * NIVEL, cz); m.rotation.y = giroDaDirecao(d);
      }
      gItens.add(m);
    }
    cena.add(gItens); sujar(true);
  }

  // ---------- câmera ----------
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  const alvo = new THREE.Vector3(W / 2, .6 + nivelMax * NIVEL / 2, D / 2);
  const longe = Math.max(W, D) * 1.9 + 4;
  let giro = .78, incl = .8, dist = longe; const quer = { giro, incl, dist, alvo: alvo.clone() };
  function posicionar() { const d = dist * Math.max(1, 1.3 / Math.max(.2, camera.aspect)); camera.position.set(alvo.x + d * Math.cos(incl) * Math.sin(giro), alvo.y + d * Math.sin(incl), alvo.z + d * Math.cos(incl) * Math.cos(giro)); camera.lookAt(alvo); }
  function medir() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); sujar(); }

  // ---------- pessoas na sala ----------
  const pessoas = new Map();
  function boneco(p) {
    const g = new THREE.Group(), ob = new Obra();
    desenharBoneco(ob, figuraDaPessoa(p), { s: .8 });
    if (p.eu) ob.luz(0, .01, 0, .8, .02, .8, '#FF7A2F');
    g.add(ob.montar()); cena.add(g);
    const el = document.createElement('div'); el.className = 'sala-nome' + (p.eu ? ' eu' : '');
    canvas.parentElement.appendChild(el);
    return { g, el, x: 0, z: 0, y: 0, alvo: { x: 0, z: 0, y: 0 }, novo: true, assin: '' };
  }
  function definirPessoas(lista = [], minhaZona = '') {
    const vistos = new Set(), aqui = (lista || []).filter((p) => p && p.zona === quarto.id);
    aqui.forEach((p, i) => {
      vistos.add(String(p.id));
      let b = pessoas.get(String(p.id)); if (!b) { b = boneco(p); pessoas.set(String(p.id), b); }
      const temPos = Number.isFinite(p.x) && Number.isFinite(p.y);
      const tx = temPos ? Math.max(0, Math.min(W - 1, p.x)) : Math.min(W - 1, 1 + (i % 3)), ty = temPos ? Math.max(0, Math.min(D - 1, p.y)) : Math.min(D - 1, D - 2 - Math.floor(i / 3));
      const alvoNovo = { x: tx + .5, z: ty + .5, y: Math.max(0, P.nivel(tx, ty)) * NIVEL };
      if (alvoNovo.x !== b.alvo.x || alvoNovo.z !== b.alvo.z) { b.alvo = alvoNovo; sujar(true); }
      if (b.novo) { b.x = b.alvo.x; b.z = b.alvo.z; b.y = b.alvo.y; b.novo = false; }
      const comVoz = minhaZona === quarto.id && !p.eu;
      const html = `${comVoz ? '<i aria-hidden="true">●</i>' : ''}${limpo(String(p.nome || '').split(' ')[0])}`;
      if (html !== b.assin) { b.assin = html; b.el.innerHTML = html; sujar(); }
    });
    for (const [id, b] of pessoas) if (!vistos.has(id)) { cena.remove(b.g); liberar(b.g); b.el.remove(); pessoas.delete(id); sujar(true); }
  }

  // ---------- desenho sob demanda ----------
  let vivo = true, pedido = 0, ultimo = 0, sombraSuja = true, visivel = true;
  function sujar(sombra = false) { if (sombra) sombraSuja = true; if (!pedido && vivo && visivel && !document.hidden) pedido = requestAnimationFrame(passo); }
  const v = new THREE.Vector3();
  function rotular(el, x, y, z, r) { v.set(x, y, z).project(camera); el.style.transform = `translate(-50%,-100%) translate(${((v.x * .5 + .5) * r.width).toFixed(1)}px,${((-v.y * .5 + .5) * r.height).toFixed(1)}px)`; }
  function passo(t) {
    pedido = 0; if (!vivo) return;
    const dt = Math.min(.05, ultimo ? (t - ultimo) / 1000 : .016); ultimo = t;
    const f = 1 - Math.pow(.001, dt);
    let mexe = Math.abs(quer.giro - giro) > 1e-4 || Math.abs(quer.incl - incl) > 1e-4 || Math.abs(quer.dist - dist) > 1e-3 || alvo.distanceToSquared(quer.alvo) > 1e-6;
    giro += (quer.giro - giro) * f; incl += (quer.incl - incl) * f; dist += (quer.dist - dist) * f; alvo.lerp(quer.alvo, f);
    posicionar();
    const r = canvas.getBoundingClientRect();
    for (const b of pessoas.values()) {
      const dx = b.alvo.x - b.x, dz = b.alvo.z - b.z, anda = Math.hypot(dx, dz) > .02;
      if (anda) { mexe = true; sombraSuja = true; b.x += dx * Math.min(1, dt * 3); b.z += dz * Math.min(1, dt * 3); b.g.rotation.y = Math.atan2(dx, dz); } else { b.x = b.alvo.x; b.z = b.alvo.z; }
      b.y += (b.alvo.y - b.y) * Math.min(1, dt * 6);
      b.g.position.set(b.x, b.y + (anda ? Math.abs(Math.sin(t / 90)) * .06 : 0), b.z);
      rotular(b.el, b.x, b.y + 1.8, b.z, r);
    }
    if (sombraSuja) { renderer.shadowMap.needsUpdate = true; sombraSuja = false; }
    renderer.render(cena, camera);
    if (mexe) sujar();
  }
  const ro = new ResizeObserver(medir); ro.observe(canvas);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { visivel = Boolean(e?.isIntersecting); if (visivel) sujar(true); }) : null;
  io?.observe(canvas);
  const aoVoltarAba = () => { if (!document.hidden) sujar(true); };
  document.addEventListener('visibilitychange', aoVoltarAba);

  // ---------- controles: arrastar gira, roda e pinça aproximam, clique no piso leva o boneco ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const toques = new Map(); let arrasto = null, pinca = 0, aoPiso = null;
  const perto = Math.max(4, Math.max(W, D) * .7), maxDist = longe * 1.8;
  canvas.addEventListener('pointerdown', (e) => {
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = Math.hypot(a.x - b.x, a.y - b.y); arrasto = null; }
    else arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2 && pinca) {
      const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) { quer.dist = Math.max(perto, Math.min(maxDist, quer.dist * pinca / d)); pinca = d; sujar(); }
      return;
    }
    if (!arrasto) return;
    quer.giro = Math.max(-.4, Math.min(1.95, quer.giro - (e.clientX - arrasto.x) * .005));
    quer.incl = Math.max(.35, Math.min(1.3, quer.incl + (e.clientY - arrasto.y) * .004));
    arrasto.x = e.clientX; arrasto.y = e.clientY; sujar();
  });
  const soltar = (e) => { toques.delete(e.pointerId); if (toques.size < 2) pinca = 0; };
  canvas.addEventListener('pointercancel', (e) => { soltar(e); arrasto = null; });
  canvas.addEventListener('pointerup', (e) => {
    soltar(e);
    const parado = arrasto && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 5; arrasto = null;
    if (!parado || !aoPiso) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(gCasca, true).find((h) => h.face && h.face.normal.y > .5 && h.object.isInstancedMesh !== false);
    if (!hit) return;
    const tx = Math.floor(hit.point.x), ty = Math.floor(hit.point.z);
    if (P.nivel(tx, ty) >= 0) aoPiso(tx, ty);
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); quer.dist = Math.max(perto, Math.min(maxDist, quer.dist * Math.exp(e.deltaY * .0012))); sujar(); }, { passive: false });

  montarItens(quarto.itens);
  medir();

  return {
    W, D, id: quarto.id,
    pessoas: definirPessoas,
    // Clique num ladrilho do piso: (x, y) em ladrilhos do quarto, como as coordenadas do Escritório.
    aoClicarPiso: (f) => { aoPiso = f; },
    itens: (lista) => montarItens(lista),
    medidas(lista) { for (const [classe, m] of lista || []) definirMedida(classe, m); montarItens(quarto.itens); },
    verTudo() { quer.alvo.copy(alvo.set(W / 2, .6 + nivelMax * NIVEL / 2, D / 2)); quer.giro = .78; quer.incl = .8; quer.dist = longe; sujar(); },
    destruir() {
      vivo = false; if (pedido) cancelAnimationFrame(pedido); pedido = 0;
      ro.disconnect(); io?.disconnect(); document.removeEventListener('visibilitychange', aoVoltarAba);
      for (const b of pessoas.values()) b.el.remove(); pessoas.clear();
      liberar(cena); renderer.dispose();
    },
  };
}
