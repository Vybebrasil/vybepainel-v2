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
import { NIVEL_HABBO, moveisDoHabbo, placaDoHabbo, figuraDoHabbo, corDoRevestimento } from './moveis-habbo.mjs';
import { relogioBahia } from './captacoes.mjs';
import { noiteDaHora } from './vida.mjs';

export const NIVEL = NIVEL_HABBO; // 1 nível da planta do Habbo (32 px) na escala do ladrilho: ~0,82
const ALTURA_PAREDE = (118 / 32) * NIVEL_HABBO, ESPESSURA = .3; // a parede do Habbo tem 118 px
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
  // Peça de parede: a ficha oficial do Habbo decide (marca 16, como mapaEhDeParede no Escritório); o catálogo da loja
  // não tem todas (a janela ficava solta na frente da parede).
  const ehDeParedeCatalogo = typeof quarto.ehDeParede === 'function' ? quarto.ehDeParede : () => false;
  const ehDeParede = (classe) => { const f = fisica?.[classe]; return f ? Boolean(f[0] & 16) : ehDeParedeCatalogo(classe); };
  for (const [classe, m] of quarto.medidas || []) definirMedida(classe, m);
  // O quarto como o Escritório o guarda (pintura de cada trecho de parede, luz, porta): só leitura, pelo próprio
  // Escritório (escritorioAmbienteDoQuarto). Sem ele, o quarto sai com a cor única da parede.
  const amb = (() => { try { return globalThis.escritorioAmbienteDoQuarto?.(quarto.id) || null; } catch { return null; } })();

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
  // Luz do quarto: a que o dono escolheu no Escritório (sala_luz) e o dia e a noite pela hora da Bahia, ou pela hora
  // que a pessoa escolheu no mundo (vybe.mundo.hora). À noite, os móveis que acendem no Habbo (camada de brilho)
  // ganham uma luz quente. Muda só quando a hora muda (a cada minuto), sem laço de animação.
  const hemi = cena.children.find((o) => o.isHemisphereLight);
  const corDaLuz = (() => { try { const l = typeof ESCRITORIO_LUZES_SALA !== 'undefined' ? ESCRITORIO_LUZES_SALA.find(([id]) => id === (amb?.luz || '')) : null; return l && l[0] ? l[2] : null; } catch { return null; } })();
  const horaAgora = () => { try { const v = localStorage.getItem('vybe.mundo.hora'); if (v !== null && v !== 'auto' && Number.isFinite(Number(v))) return Number(v); } catch { /* sem armazenamento */ } return relogioBahia().minutos / 60; };
  let noite = 0, gLuzes = null, luzes = [];
  function acenderLuzes() {
    if (gLuzes) { cena.remove(gLuzes); gLuzes = null; }
    if (noite < .3 || !luzes.length) return;
    gLuzes = new THREE.Group();
    for (const l of luzes.slice(0, 6)) { const p = new THREE.PointLight('#FFC77A', 1.6 * noite, 4.5, 1.6); p.position.set(l.x, l.y, l.z); gLuzes.add(p); }
    cena.add(gLuzes); sujar(true);
  }
  function aplicarLuz() {
    noite = noiteDaHora(horaAgora() * 60);
    const tinta = new THREE.Color('#FFFFFF').lerp(new THREE.Color(corDaLuz || '#FFFFFF'), corDaLuz ? .35 : 0);
    if (hemi) { hemi.intensity = 1.25 * (1 - .55 * noite); hemi.color.set('#F6FAFF').lerp(new THREE.Color('#7A8CC8'), .6 * noite).multiply(tinta); }
    sol.intensity = 1.9 * (1 - .8 * noite); sol.color.set('#FFF1D8').lerp(new THREE.Color('#8FA6E8'), noite).multiply(tinta);
    preenche.intensity = .45 * (1 - .4 * noite);
    acenderLuzes(); sujar(true);
  }
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
  const gCasca = casca.montar(); cena.add(gCasca);

  // ---------- paredes: cada trecho com a pintura que o dono escolheu (cor, revestimento e altura) ----------
  // No Escritório cada trecho é guardado pela chave do canto do quarto: fundo "x:<coluna>,0" e esquerda "y:0,<linha>"
  // (escritorioChaveTrecho). Revestimento (papel de parede, lambri) vira a cor que mais aparece na arte dele; parede
  // baixa (46 ou 82 px no Habbo, de 118) fica baixa aqui também.
  const trechoDe = (x, y, eixo) => { const m = amb?.pintura?.paredes; if (!(m instanceof Map)) return null; return m.get(eixo === 'x' ? `x:${x},0` : `y:0,${y}`) || m.get(`${eixo}:${x},${y}`) || null; };
  const ESTILO_REVESTIMENTO = { c: 'urban_wall', d: 'gardenshed_wall', e: 'sb_wall', f: 'exe_c15_wall', g: 'hygge_c25_wallpaper1', h: 'bathroom_wall4' };
  const revestimentos = new Map(); // classe → cor (quando a arte chega)
  let gParedes = null;
  function montarParedes() {
    if (gParedes) { cena.remove(gParedes); liberar(gParedes); gParedes = null; }
    if (quarto.semParedes === true || amb?.semParedes === true) return;
    const o = new Obra(), H = ALTURA_PAREDE + nivelMax * NIVEL;
    for (const { x, y, eixo } of paredesDaPlanta(P)) {
      const est = trechoDe(x, y, eixo), classe = est?.textura || ESTILO_REVESTIMENTO[est?.estilo] || null;
      const corBase = ehCor(est?.cor) ? est.cor : corParede, cor = classe && revestimentos.get(classe) ? revestimentos.get(classe) : corBase;
      const base = P.grade[y][x] * NIVEL, alto = Number(est?.alt) > 0 ? Math.max(.5, (Number(est.alt) / 118) * ALTURA_PAREDE) : H - base;
      const topoParede = misturar(cor, '#FFFFFF', .55), rodape = misturar(cor, '#1F1D1A', .18);
      if (eixo === 'x') {
        o.caixa(x + .5, base - .62, y - ESPESSURA / 2, 1, alto + .62, ESPESSURA, (x % 2) ? cor : misturar(cor, '#1F1D1A', .04));
        o.caixa(x + .5, base + alto, y - ESPESSURA / 2, 1, .1, ESPESSURA + .04, topoParede);
        o.caixa(x + .5, base, y + .01, 1, .14, .04, rodape);
      } else {
        o.caixa(x - ESPESSURA / 2, base - .62, y + .5, ESPESSURA, alto + .62, 1, (y % 2) ? misturar(cor, '#1F1D1A', .08) : misturar(cor, '#1F1D1A', .12));
        o.caixa(x - ESPESSURA / 2, base + alto, y + .5, ESPESSURA + .04, .1, 1, topoParede);
        o.caixa(x + .01, base, y + .5, .04, .14, 1, rodape);
      }
    }
    const y0 = P.grade.findIndex((l) => l.some((n) => n >= 0)), x0 = y0 >= 0 ? P.grade[y0].findIndex((n) => n >= 0) : -1;
    if (x0 >= 0) o.caixa(x0 - ESPESSURA / 2, P.grade[y0][x0] * NIVEL - .62, y0 - ESPESSURA / 2, ESPESSURA, H - P.grade[y0][x0] * NIVEL + .72, ESPESSURA, misturar(corParede, '#FFFFFF', .55));
    gParedes = o.montar(); cena.add(gParedes); sujar(true);
  }
  {
    const classes = new Set();
    for (const { x, y, eixo } of paredesDaPlanta(P)) { const est = trechoDe(x, y, eixo); const c = est?.textura || ESTILO_REVESTIMENTO[est?.estilo]; if (c) classes.add(c); }
    for (const c of classes) corDoRevestimento(c).then((cor) => { if (cor && vivo) { revestimentos.set(c, cor); montarParedes(); } });
  }

  // ---------- móveis da camada salva, esculpidos na arte do Habbo (mundo/moveis-habbo.mjs) ----------
  // Cada móvel sai do próprio desenho dele (forma, cores, estado, pegada, direção e altura). Enquanto a arte chega,
  // nada aparece no lugar; só se a arte do Habbo não carregar fica a peça voxel do catálogo, para a sala não sumir.
  let gItens = null, geracaoItens = 0;
  const baseDoLadrilho = (x, y) => Math.max(0, P.nivel(Math.min(W - 1, Math.max(0, Math.floor(x))), Math.min(D - 1, Math.max(0, Math.floor(y))))) * NIVEL;
  // A parede encostada num ladrilho: a do fundo fica no primeiro ladrilho da coluna; a da esquerda, no da linha.
  const paredeFundo = (x) => { const c = Math.min(W - 1, Math.max(0, Math.floor(x))), y = P.grade.findIndex((l) => l[c] >= 0); return Math.max(0, y); };
  const paredeEsquerda = (y) => { const l = P.grade[Math.min(D - 1, Math.max(0, Math.floor(y)))] || []; return Math.max(0, l.findIndex((n) => n >= 0)); };
  function obraDeBlocos(blocos, lado, finos = [], ladoFino = 0) {
    const o = new Obra();
    for (const b of blocos) o.caixa(b.x, b.y, b.z, lado * 1.002, lado * 1.002, lado * 1.002, b.cor);
    for (const b of finos) o.caixa(b.x, b.y, b.z, ladoFino, ladoFino, ladoFino, b.cor);
    return o.montar();
  }
  function pecaGenerica(classe, x, y, d, altura, parede) {
    const peca = pecaDaClasse(classe, tipoDoMovel(classe)), m = obraDaPeca(peca.desenho, peca.cor).montar();
    if (parede) {
      const base = baseDoLadrilho(x, y) + 1.05;
      if (d === 2) m.position.set(paredeEsquerda(y) + .14, base, y + .5); else m.position.set(x + .5, base, paredeFundo(x) + .14);
      m.rotation.y = giroDaDirecao(d === 2 ? 2 : 4);
    } else {
      const p = pegada(classe, d);
      m.position.set(x + p.w / 2, baseDoLadrilho(x, y) + Math.max(0, Number(altura) || 0) * NIVEL, y + p.h / 2); m.rotation.y = giroDaDirecao(d);
    }
    return m;
  }
  async function pecaDoHabbo(classe, x, y, d, estado, altura, parede) {
    if (parede) {
      // Pela conta do mapa do Escritório: apoio no pé da parede, no meio do ladrilho, e cada pixel no plano dela.
      const est = trechoDe(Math.floor(x), Math.floor(y), d === 2 ? 'y' : 'x');
      const alturaParede = Number(est?.alt) > 0 ? Number(est.alt) : 118;
      const pl = await placaDoHabbo(classe, d, estado, Number(altura) || 0, alturaParede); if (!pl?.blocos?.length) return null;
      const chao = baseDoLadrilho(x, y), l = pl.lado * 1.15;
      const blocos = pl.blocos.map((b) => (d === 2
        ? { x: Math.floor(x) + .02 + l / 2, y: chao + b.h * NIVEL - l / 2, z: y + .5 + b.a, cor: b.cor }
        : { x: x + .5 + b.a, y: chao + b.h * NIVEL - l / 2, z: Math.floor(y) + .02 + l / 2, cor: b.cor }));
      return obraDeBlocos([], 0, blocos, l);
    }
    const e = await moveisDoHabbo(classe, d, estado); if (!e?.blocos?.length) return null;
    const m = obraDeBlocos(e.blocos, e.lado, e.finos || [], e.ladoFino || 0);
    m.position.set(x, baseDoLadrilho(x, y) + Math.max(0, Number(altura) || 0) * NIVEL, y);
    if (e.brilha) luzes.push({ x: x + e.W / 2, y: m.position.y + (e.altura || 1) * .85, z: y + e.D / 2 });
    return m;
  }
  // Onde se senta, deita ou não se pisa, pela ficha oficial do Habbo (fisica.json, a mesma do Escritório).
  let fisica = null, assentos = new Map(), bloqueados = new Set();
  const fichaDe = (classe) => { const f = fisica?.[classe]; return f ? { pisa: Boolean(f[0] & 1), senta: Boolean(f[0] & 2), deita: Boolean(f[0] & 4), altura: Number(f[1]) || 0 } : null; };
  function lerFisica(itens) {
    assentos = new Map(); bloqueados = new Set();
    for (const it of Array.isArray(itens) ? itens : []) {
      const [classe, ix, iy, dir, , altura] = Array.isArray(it) ? it : [];
      const f = fichaDe(classe); if (!f || ehDeParede(classe)) continue;
      const d = Number(dir) || 0, p = pegada(classe, d), x0 = Math.floor(Number(ix)), y0 = Math.floor(Number(iy));
      for (let a = 0; a < p.w; a++) for (let b = 0; b < p.h; b++) {
        const k = (x0 + a) + ',' + (y0 + b);
        if (f.senta || f.deita) assentos.set(k, { dir: d, deita: f.deita, topo: (Math.max(0, Number(altura) || 0) + f.altura) });
        else if (!f.pisa) bloqueados.add(k);
      }
    }
  }
  const carregarFisica = globalThis.mapaCarregarFisica;
  const fisicaPronta = (typeof carregarFisica === 'function' ? carregarFisica() : Promise.resolve({})).then((f) => { fisica = f || {}; }).catch(() => { fisica = {}; });
  function montarItens(itens) {
    // Os móveis esperam a ficha do Habbo (é ela que diz o que é de parede, assento ou cama).
    if (!fisica) { quarto.itens = itens; fisicaPronta.then(() => { if (vivo) montarItens(quarto.itens); }); return; }
    const geracao = ++geracaoItens;
    luzes = []; if (fisica) lerFisica(itens); quarto.itens = itens;
    if (gItens) { cena.remove(gItens); liberar(gItens); }
    gItens = new THREE.Group(); const grupo = gItens;
    cena.add(grupo); sujar(true);
    for (const it of Array.isArray(itens) ? itens : []) {
      const [classe, ix, iy, dir, estado, altura] = Array.isArray(it) ? it : [];
      if (!classe || !Number.isFinite(Number(ix)) || !Number.isFinite(Number(iy))) continue;
      const x = Number(ix), y = Number(iy), d = Number(dir) || 0, parede = ehDeParede(classe) || /^vybeimg_\d+$/.test(String(classe));
      pecaDoHabbo(String(classe), x, y, d, Number(estado) || 0, altura, parede)
        .catch(() => null)
        .then((m) => {
          if (!vivo || geracao !== geracaoItens) { if (m) liberar(m); return; }
          if (!m && !/^vybeimg_\d+$/.test(String(classe))) m = pecaGenerica(String(classe), x, y, d, altura, parede);
          if (m) { grupo.add(m); acenderLuzes(); sujar(true); }
        });
    }
  }

  // ---------- câmera ----------
  // A câmera do Habbo (Paulo, 09/11/2026: "fiel como era o quarto da pessoa mesmo"): sem perspectiva, olhando a
  // diagonal de cima, a 30° (a projeção 2:1 do Habbo, ladrilho 64 × 32). Não gira, como no Habbo: é desse ângulo que
  // cada pixel do desenho vira um bloco no lugar certo. Arrastar move a sala; roda, pinça e clique duplo aproximam.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400);
  const alvo = new THREE.Vector3(W / 2, .6 + nivelMax * NIVEL / 2, D / 2);
  const GIRO = Math.PI / 4, INCL = Math.asin(.5);
  // Meia altura da vista (em unidades do mundo) com a sala inteira: largura da diagonal e altura das paredes.
  const longe = Math.max((W + D) * .24, ((W + D) * .3 + ALTURA_PAREDE * .9) / 3.4) + .3;
  let giro = GIRO, incl = INCL, dist = longe, aspecto = 1; const quer = { giro, incl, dist, alvo: alvo.clone() };
  function posicionar() {
    const meia = dist * Math.max(1, 1.25 / Math.max(.2, aspecto));
    Object.assign(camera, { left: -meia * aspecto, right: meia * aspecto, top: meia, bottom: -meia }); camera.updateProjectionMatrix();
    const d = 60; camera.position.set(alvo.x + d * Math.cos(incl) * Math.sin(giro), alvo.y + d * Math.sin(incl), alvo.z + d * Math.cos(incl) * Math.cos(giro)); camera.lookAt(alvo);
  }
  function medir() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); aspecto = r.width / Math.max(1, r.height); posicionar(); sujar(); }

  // ---------- pessoas na sala ----------
  // O corpo de quem está na sala: sempre o boneco voxel da Vybe (desenharBoneco), vestido como o Habbo da pessoa:
  // cores de pele, cabelo, camisa, calça e tênis e o acessório de cabeça (chapéu, máscara) tirados do boneco do Habbo
  // dela (figuraDoHabbo). Cada boneco tem as poses prontas: parado, as duas passadas (anda de verdade, alternando) e
  // sentado. Senta parado num assento e deita numa cama, como no Escritório (ficha do Habbo); vira para onde anda.
  // Quem fala acende (anel verde no chão e o nome com contorno verde); quem chega depois de a sala abrir entra pela
  // porta e anda até o lugar.
  const ESCALA_BONECO = 1.05; // altura de ~1,8: o tamanho do boneco do Habbo ao lado dos móveis
  const pessoas = new Map();
  let primeiraLeva = true;
  const porta = (() => { try { return amb && globalThis.escritorioPortaQuarto?.(amb); } catch { return null; } })();
  function poses(f) {
    const corpo = (op) => { const ob = new Obra(); desenharBoneco(ob, f, { s: ESCALA_BONECO, ...op }); return ob.montar(); };
    return { parado: corpo({}), a: corpo({ passo: 1 }), b: corpo({ passo: -1 }), sentado: corpo({ sentado: true }) };
  }
  function mostrarPose(b, nome) { if (b.pose === nome) return; for (const [k, m] of Object.entries(b.poses)) m.visible = k === nome; b.pose = nome; sujar(); }
  function trocarPoses(b, novas) {
    for (const m of Object.values(b.poses || {})) { b.inner.remove(m); liberar(m); }
    b.poses = novas; for (const m of Object.values(novas)) { m.visible = false; b.inner.add(m); }
    b.pose = ''; mostrarPose(b, 'parado');
  }
  const materialAnel = (cor) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .85, depthWrite: false });
  function boneco(p) {
    const g = new THREE.Group(), inner = new THREE.Group(), base = figuraDaPessoa(p);
    g.add(inner); cena.add(g);
    // Anel no chão: o seu, sempre (laranja); o de quem está falando, verde.
    const anel = new THREE.Mesh(new THREE.RingGeometry(.34, .46, 24), materialAnel('#FF7A2F'));
    anel.rotation.x = -Math.PI / 2; anel.position.y = .02; anel.visible = Boolean(p.eu); g.add(anel);
    const el = document.createElement('div'); el.className = 'sala-nome' + (p.eu ? ' eu' : '');
    canvas.parentElement.appendChild(el);
    const b = { g, inner, anel, el, x: 0, z: 0, y: 0, alvo: { x: 0, z: 0, y: 0 }, novo: true, assin: '', alto: 1.75 * ESCALA_BONECO, eu: Boolean(p.eu), giro: 0, poses: null, pose: '', assento: null };
    trocarPoses(b, poses(base));
    if (p.figura) figuraDoHabbo(p.figura).then((h) => {
      if (!h || !vivo || !g.parent) return;
      const c = Object.fromEntries(Object.entries(h.cores || {}).filter(([, v]) => v));
      trocarPoses(b, poses({ ...base, ...c, chapeu: h.acessorio ? null : base.chapeu, acessorio: h.acessorio })); sujar(true);
    }).catch(() => {});
    return b;
  }
  function definirPessoas(lista = [], minhaZona = '') {
    const vistos = new Set(), aqui = (lista || []).filter((p) => p && p.zona === quarto.id);
    let falando = new Set(); try { falando = new Set([...(globalThis.escritorioPessoasFalando?.() || [])].map(String)); } catch { /* sem voz */ }
    let mudo = false; try { mudo = typeof escritorio !== 'undefined' && Boolean(escritorio?.chamada?.self) && !escritorio.chamada.self.audioEnabled; } catch { /* sem chamada */ }
    // Duas pessoas no mesmo ladrilho (quem está fora da chamada chega com a posição padrão) ficam lado a lado, e
    // ninguém fica dentro de um móvel em que não se pisa (mesa, estante): vai para o ladrilho livre mais perto.
    const ocupado = new Set();
    const livre = (nx, ny) => nx >= 0 && ny >= 0 && nx < W && ny < D && P.nivel(nx, ny) >= 0 && !ocupado.has(nx + ',' + ny) && !bloqueados.has(nx + ',' + ny);
    const livreMaisPerto = (x, y) => {
      for (let r = 0; r < Math.max(W, D); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = Math.round(x) + dx, ny = Math.round(y) + dy;
        if (!livre(nx, ny)) continue;
        return r ? { x: nx, y: ny } : { x, y }; // livre onde já está: fica na posição exata (andando, sem pulo)
      }
      return { x, y };
    };
    aqui.forEach((p, i) => {
      const id = String(p.id); vistos.add(id);
      let b = pessoas.get(id); if (!b) { b = boneco(p); pessoas.set(id, b); }
      const temPos = Number.isFinite(p.x) && Number.isFinite(p.y);
      const tx = temPos ? Math.max(0, Math.min(W - 1, p.x)) : Math.min(W - 1, 1 + (i % 3)), ty = temPos ? Math.max(0, Math.min(D - 1, p.y)) : Math.min(D - 1, D - 2 - Math.floor(i / 3));
      const lugar = livreMaisPerto(tx, ty); ocupado.add(Math.round(lugar.x) + ',' + Math.round(lugar.y));
      const alvoNovo = { x: lugar.x + .5, z: lugar.y + .5, y: Math.max(0, P.nivel(lugar.x, lugar.y)) * NIVEL };
      b.assento = assentos.get(Math.round(lugar.x) + ',' + Math.round(lugar.y)) || null;
      if (alvoNovo.x !== b.alvo.x || alvoNovo.z !== b.alvo.z) { b.alvo = alvoNovo; sujar(true); }
      if (b.novo) {
        // Quem chega depois de a sala abrir entra pela porta e anda até o lugar; quem já estava aparece no lugar.
        const pt = !primeiraLeva && porta && P.nivel(porta.x, porta.y) >= 0 ? porta : null;
        b.x = pt ? pt.x + .5 : b.alvo.x; b.z = pt ? pt.y + .5 : b.alvo.z; b.y = b.alvo.y; b.novo = false;
      }
      const fala = falando.has(id);
      b.anel.visible = fala || b.eu; b.anel.material.color.set(fala ? '#18A957' : '#FF7A2F');
      const html = `${fala ? '<i aria-hidden="true">●</i>' : ''}${limpo(String(p.nome || '').split(' ')[0])}${p.eu && mudo ? ' <small>· mudo</small>' : ''}`;
      if (html !== b.assin) { b.assin = html; b.el.innerHTML = html; b.el.style.boxShadow = fala ? '0 0 0 2px #18A957' : ''; sujar(); }
    });
    primeiraLeva = false;
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
      const dx = b.alvo.x - b.x, dz = b.alvo.z - b.z, dist = Math.hypot(dx, dz), anda = dist > .02;
      // Anda em velocidade de passo (sem deslizar em salto) e alterna as duas passadas.
      if (anda) { mexe = true; sombraSuja = true; const vel = Math.min(dist, dt * 2.6); b.x += (dx / dist) * vel; b.z += (dz / dist) * vel; b.giro = Math.atan2(dx, dz); } else { b.x = b.alvo.x; b.z = b.alvo.z; }
      const a = !anda && b.assento ? b.assento : null;
      let y = b.alvo.y, inclina = 0;
      if (a?.deita) { mostrarPose(b, 'parado'); inclina = -Math.PI / 2; y = b.alvo.y + Math.max(.2, a.topo * NIVEL * .7); b.giro = giroDaDirecao(a.dir); }
      else if (a) { mostrarPose(b, 'sentado'); y = b.alvo.y + Math.max(.25, (a.topo - .45) * NIVEL) - .38 * ESCALA_BONECO; b.giro = giroDaDirecao(a.dir); }
      else mostrarPose(b, anda ? (Math.floor(t / 170) % 2 ? 'a' : 'b') : 'parado');
      if (b.inner.rotation.x !== inclina) { b.inner.rotation.x = inclina; b.inner.position.set(0, 0, inclina ? .85 : 0); sombraSuja = true; }
      b.y += (y - b.y) * Math.min(1, dt * 8);
      if (Math.abs(y - b.y) > .005) mexe = true;
      b.g.rotation.y = b.giro;
      b.g.position.set(b.x, b.y, b.z);
      b.anel.position.y = .02 + (b.alvo.y - b.y);
      rotular(b.el, b.x, b.y + (a?.deita ? .9 : a ? b.alto * .8 : b.alto) + .15, b.z, r);
      if (seguir && b.eu && anda) { quer.alvo.x = b.x; quer.alvo.z = b.z; }
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
  const toques = new Map(); let arrasto = null, pinca = 0, aoPiso = null, seguir = false;
  const perto = Math.max(1.2, longe * .3), maxDist = longe * 2;
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
    seguir = false; // arrastar solta a câmera de você
    // Arrastar move a sala na tela: para o lado, pela direita da câmera; para cima, pelo chão (que a câmera a 30°
    // encurta pela metade).
    const r0 = canvas.getBoundingClientRect(), k = (2 * (camera.top - camera.bottom) / 2) / Math.max(1, r0.height);
    const dx = (e.clientX - arrasto.x) * k, dy = (e.clientY - arrasto.y) * k * 2;
    quer.alvo.x += (-dx - dy) * Math.SQRT1_2; quer.alvo.z += (dx - dy) * Math.SQRT1_2;
    quer.alvo.x = Math.max(-1, Math.min(W + 1, quer.alvo.x)); quer.alvo.z = Math.max(-1, Math.min(D + 1, quer.alvo.z));
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
    if (P.nivel(tx, ty) >= 0) { seguir = true; aoPiso(tx, ty); } // andar pelo piso: a câmera acompanha você
  });
  // Clique duplo aproxima a câmera do ponto (outro clique duplo no mesmo lugar volta à sala inteira).
  canvas.addEventListener('dblclick', (e) => {
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([gCasca, ...(gItens ? [gItens] : [])], true)[0];
    if (!hit) return;
    if (quer.dist <= perto * 1.35 && quer.alvo.distanceTo(hit.point) < 1) { quer.alvo.set(W / 2, .6 + nivelMax * NIVEL / 2, D / 2); quer.dist = longe; }
    else { quer.alvo.set(hit.point.x, Math.max(.5, hit.point.y), hit.point.z); quer.dist = perto * 1.3; }
    sujar();
  });
  // A roda aproxima em direção ao ponto sob o cursor (como num mapa), não ao meio da tela.
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), noChao = new THREE.Vector3();
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const antes = quer.dist, depois = Math.max(perto, Math.min(maxDist, antes * Math.exp(e.deltaY * .0012)));
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(chao, noChao)) { const k = 1 - depois / antes; quer.alvo.x += (noChao.x - quer.alvo.x) * k; quer.alvo.z += (noChao.z - quer.alvo.z) * k; }
    quer.dist = depois; seguir = false; sujar();
  }, { passive: false });

  montarParedes();
  montarItens(quarto.itens);
  aplicarLuz();
  const relogio = setInterval(aplicarLuz, 60000);
  medir();

  return {
    W, D, id: quarto.id,
    pessoas: definirPessoas,
    // Clique num ladrilho do piso: (x, y) em ladrilhos do quarto, como as coordenadas do Escritório.
    aoClicarPiso: (f) => { aoPiso = f; },
    itens: (lista) => montarItens(lista),
    // Medidas do Habbo: só a peça de reserva (catálogo) usa; a esculpida já sai do tamanho do móvel.
    medidas(lista) { for (const [classe, m] of lista || []) definirMedida(classe, m); },
    verTudo() { quer.alvo.copy(alvo.set(W / 2, .6 + nivelMax * NIVEL / 2, D / 2)); quer.dist = longe; sujar(); },
    destruir() {
      vivo = false; if (pedido) cancelAnimationFrame(pedido); pedido = 0; clearInterval(relogio);
      ro.disconnect(); io?.disconnect(); document.removeEventListener('visibilitychange', aoVoltarAba);
      for (const b of pessoas.values()) b.el.remove(); pessoas.clear();
      liberar(cena); renderer.dispose();
    },
  };
}
