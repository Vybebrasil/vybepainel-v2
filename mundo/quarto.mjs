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
import { ESTILO, prepararRenderer, luzDoEstilo, baseDeMaquete, acabamentoDeMaquete } from './estilo.mjs';
import { pecaDaClasse, obraDaPeca } from './catalogo.mjs';
import { tipoDoMovel, desenharBoneco, figuraDaPessoa } from './avatar.mjs';
import { pegada, giroDaDirecao, definirMedida, encaixar, cabeNaSala, sobrepoe, proximaDirecao, medidaDaPeca, moverItem, girarItem, guardarItem, porItem } from './sala.mjs';
import { NIVEL_HABBO, moveisDoHabbo, placaDoHabbo, figuraDoHabbo, corDoRevestimento, paletaDoHabbo } from './moveis-habbo.mjs';
import { tipoModelado, montarMovel, coresDaPaleta, carregarCatalogo } from './moveis-voxel.mjs';
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
  prepararRenderer(renderer); renderer.shadowMap.autoUpdate = false;
  const cena = new THREE.Scene();
  // Luz e sombra do padrão voxel (estilo.mjs), em modo interior; normalBias tira o serrilhado das faces grandes.
  const raioLuz = Math.max(W, D);
  const luz = luzDoEstilo(cena, { centro: [W / 2, 0, D / 2], raio: raioLuz, interior: true, sombra: { mapa: 2048, lado: raioLuz + 4, longe: 80 } });
  const { sol } = luz;
  // Luz do quarto: a que o dono escolheu no Escritório (sala_luz) e o dia e a noite pela hora da Bahia, ou pela hora
  // que a pessoa escolheu no mundo (vybe.mundo.hora). À noite, os móveis que acendem no Habbo (camada de brilho)
  // ganham uma luz quente. Muda só quando a hora muda (a cada minuto), sem laço de animação.
  const corDaLuz = (() => { try { const l = typeof ESCRITORIO_LUZES_SALA !== 'undefined' ? ESCRITORIO_LUZES_SALA.find(([id]) => id === (amb?.luz || '')) : null; return l && l[0] ? l[2] : null; } catch { return null; } })();
  const horaAgora = () => { try { const v = localStorage.getItem('vybe.mundo.hora'); if (v !== null && v !== 'auto' && Number.isFinite(Number(v))) return Number(v); } catch { /* sem armazenamento */ } return relogioBahia().minutos / 60; };
  let noite = 0, gLuzes = null, luzes = [];
  function acenderLuzes() {
    if (gLuzes) { cena.remove(gLuzes); gLuzes = null; }
    if (noite < .3 || !luzes.length) return;
    gLuzes = new THREE.Group();
    for (const l of luzes.slice(0, 6)) { const p = new THREE.PointLight(ESTILO.luzMovel, 1.6 * noite, 4.5, 1.6); p.position.set(l.x, l.y, l.z); gLuzes.add(p); }
    cena.add(gLuzes); sujar(true);
  }
  function aplicarLuz() {
    // Quarto é interior, como no Habbo: nunca escurece. À noite a luz só esquenta um pouco (lâmpada em vez de sol) e
    // as luminárias acendem; a cor escolhida pelo dono tinge de leve.
    noite = noiteDaHora(horaAgora() * 60);
    luz.hora(noite, corDaLuz);
    acenderLuzes(); sujar(true);
  }
  const liberar = (g) => g?.traverse?.((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); });

  // ---------- casca: piso em ladrilhos com os níveis da planta, base e paredes ----------
  let pisoAtual = piso, pisoPintado = pisoEm, corParedeAtual = corParede, gCasca = null;
  // Madeira: tom quente (vermelho > verde > azul) e com cor; mármore, cimento e pisos coloridos ficam em ladrilhos.
  const madeira = (c) => { const k = new THREE.Color(c), hsl = k.getHSL({}); return k.r > k.g && k.g > k.b && hsl.s > .2 && hsl.h < .12; };
  function montarPiso() {
  if (gCasca) { cena.remove(gCasca); liberar(gCasca); }
  const casca = new Obra();
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const n = P.grade[y][x]; if (n < 0) continue;
    const topo = n * NIVEL, [a, b] = pisoPintado(x, y) || pisoAtual;
    // Como no Habbo: o topo do ladrilho na cor do piso e a lateral de um patamar no mesmo piso, mais escuro (sem faixa
    // de realce). Embaixo do chão, a base de maquete do padrão (terra em camadas, estilo.mjs).
    if (topo > 0) casca.caixa(x + .5, -.12, y + .5, 1, topo, 1, misturar(a, '#1F1D1A', .32));
    if (!madeira(a)) { casca.caixa(x + .5, topo - .12, y + .5, 1, .12, 1, (x + y) % 2 ? a : b); continue; }
    // Piso de madeira em tábuas (referências de 09/11/2026): 4 tábuas por ladrilho, emendas desencontradas, cada
    // tábua num tom e a fresta escura entre elas.
    casca.caixa(x + .5, topo - .12, y + .5, 1, .1, 1, misturar(a, '#1F1D1A', .45));
    for (let k = 0; k < 4; k++) {
      const z = y + k * .25 + .125, corte = ((x * 7 + y * 4 + k * 3) % 4) * .25, t = ((x * 13 + y * 7 + k * 5) % 5) / 5;
      const cor = misturar(a, t < .4 ? b : '#FFFFFF', t < .4 ? .5 : .08 * t);
      for (const [x0, x1] of corte ? [[0, corte], [corte, 1]] : [[0, 1]]) casca.caixa(x + (x0 + x1) / 2, topo - .02, z, x1 - x0 - .03, .02, .25 - .03, cor);
    }
  }
  baseDeMaquete(casca, { W, D, ladrilhos: (x, y) => (P.grade[y]?.[x] ?? -1) >= 0, topo: -.12, fundo: -1.15 });
  gCasca = casca.montar(); cena.add(gCasca); sujar(true);
  }

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
      const corBase = ehCor(est?.cor) ? est.cor : corParedeAtual, cor = classe && revestimentos.get(classe) ? revestimentos.get(classe) : corBase;
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
    if (x0 >= 0) o.caixa(x0 - ESPESSURA / 2, P.grade[y0][x0] * NIVEL - .62, y0 - ESPESSURA / 2, ESPESSURA, H - P.grade[y0][x0] * NIVEL + .72, ESPESSURA, misturar(corParedeAtual, '#FFFFFF', .55));
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
    // Motor de móveis modelados (moveis-voxel.mjs): móvel de tipo conhecido é montado em voxel limpo, no estilo das
    // referências, com o tamanho e as cores da arte do Habbo; o resto continua esculpido.
    const tipo = tipoModelado(classe, fichaDe(classe), (await carregarCatalogo()).get(classe));
    if (tipo) {
      const info = await paletaDoHabbo(classe, d, estado);
      const o = info && montarMovel(tipo, { w: info.dim.x, d: info.dim.y, cores: coresDaPaleta(info.paleta), classe });
      if (o) {
        const m = o.montar(), p = pegada(classe, d);
        m.position.set(x + p.w / 2, baseDoLadrilho(x, y) + Math.max(0, Number(altura) || 0) * NIVEL, y + p.h / 2); m.rotation.y = giroDaDirecao(d);
        if (tipo === 'luminaria' || tipo === 'tela') luzes.push({ x: x + p.w / 2, y: m.position.y + (tipo === 'luminaria' ? 1.1 : .5), z: y + p.h / 2 });
        return m;
      }
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
  let gVis = []; // índice do item → malha (para escolher e arrastar no modo decorar)
  function montarItens(itens, { junto = false } = {}) {
    // Os móveis esperam a ficha do Habbo (é ela que diz o que é de parede, assento ou cama).
    if (!fisica) { quarto.itens = itens; fisicaPronta.then(() => { if (vivo) montarItens(quarto.itens, { junto }); }); return; }
    const geracao = ++geracaoItens;
    luzes = []; lerFisica(itens); quarto.itens = itens;
    const grupo = new THREE.Group(), vis = [], antigo = gItens;
    // Na edição, a sala nova só entra pronta (sem piscar); na abertura, cada peça entra quando chega.
    if (!junto || !antigo) { if (antigo) { cena.remove(antigo); liberar(antigo); } gItens = grupo; gVis = vis; cena.add(grupo); sujar(true); }
    const promessas = (Array.isArray(itens) ? itens : []).map((it, i) => {
      const [classe, ix, iy, dir, estado, altura] = Array.isArray(it) ? it : [];
      if (!classe || !Number.isFinite(Number(ix)) || !Number.isFinite(Number(iy))) return null;
      const x = Number(ix), y = Number(iy), d = Number(dir) || 0, parede = ehDeParede(classe) || /^vybeimg_\d+$/.test(String(classe));
      return pecaDoHabbo(String(classe), x, y, d, Number(estado) || 0, altura, parede)
        .catch(() => null)
        .then((m) => {
          if (!vivo || geracao !== geracaoItens) { if (m) liberar(m); return; }
          if (!m && !/^vybeimg_\d+$/.test(String(classe))) m = pecaGenerica(String(classe), x, y, d, altura, parede);
          if (!m) return;
          m.userData.item = i; vis[i] = m; grupo.add(m);
          if (gItens === grupo) { acenderLuzes(); sujar(true); }
        });
    });
    if (junto && antigo) Promise.allSettled(promessas).then(() => {
      if (!vivo || geracao !== geracaoItens) { liberar(grupo); return; }
      cena.remove(antigo); liberar(antigo); gItens = grupo; gVis = vis; cena.add(grupo);
      acenderLuzes(); if (ed) marcarSelecao(); sujar(true);
    });
  }

  // ---------- câmera ----------
  // A câmera do Habbo (Paulo, 09/11/2026: "fiel como era o quarto da pessoa mesmo"): sem perspectiva, olhando a
  // diagonal de cima, a 30° (a projeção 2:1 do Habbo, ladrilho 64 × 32). Não gira, como no Habbo: é desse ângulo que
  // cada pixel do desenho vira um bloco no lugar certo. Arrastar move a sala; roda, pinça e clique duplo aproximam.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 30, 100);
  // Acabamento de maquete do padrão (oclusão nos cantos e brilho no que acende): o quarto como nas referências.
  const acabamento = acabamentoDeMaquete(renderer, cena, camera);
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
  function medir() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); acabamento.tamanho(r.width, r.height); aspecto = r.width / Math.max(1, r.height); posicionar(); sujar(); }

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
      // Óculos, chapéu e máscara vêm esculpidos da arte (acessorio): os de blocos do boneco saem.
      trocarPoses(b, poses({ ...base, ...c, chapeu: h.acessorio ? null : base.chapeu, oculos: h.acessorio ? false : base.oculos, acessorio: h.acessorio, cabeloHabbo: h.cabeloHabbo })); sujar(true);
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

  // ---------- Decorar (vybe-mundo-decorar.js): a mesma interface de cena do andar antigo (mundo/sala.mjs) ----------
  // Só a sala em edição responde. Arrastar uma peça a muda de lugar encaixando na grade (peça de parede corre pela
  // parede, pelo lugarParede do painel); R gira pelas direções que o móvel tem no Habbo; Delete guarda (volta ao
  // inventário ao salvar); Esc larga; G mostra a grade; as setas empurram 1 ladrilho. Sobrepor é livre (Paulo,
  // 28/10/2026), só o marcador fica âmbar. As mudanças saem por aoMudar(itens) no formato do Escritório; quem grava é
  // o painel, pela rota do editor (o servidor confere dono, inventário, planta e versão).
  const COR_OK = '#18A957', COR_SOBRE = '#E2A11B', COR_FORA = '#E5484D';
  const L = { w: W, d: D };
  let ed = null;
  const copiaItens = (itens) => (itens || []).filter(Array.isArray).map((it) => [...it]);
  function raioDe(e) { camera.updateMatrixWorld(); const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  const planoChao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pChao = new THREE.Vector3();
  function noChaoDaSala(e, livre = false) {
    raioDe(e); if (!ray.ray.intersectPlane(planoChao, pChao)) return null;
    if (!livre && (pChao.x < 0 || pChao.z < 0 || pChao.x >= W || pChao.z >= D)) return null;
    return { tx: pChao.x, ty: pChao.z };
  }
  function pecaSob(e) {
    if (!gItens) return null;
    gItens.updateMatrixWorld(true); // a posição de cada peça, mesmo sem quadro desenhado desde a última mudança
    raioDe(e); let o = ray.intersectObjects(gItens.children, true)[0]?.object;
    while (o && o.userData?.item == null) o = o.parent;
    return o ? o.userData.item : null;
  }
  const ehParedeNaEdicao = (classe) => ed?.tipoDeParede?.(classe) === 'parede' || ehDeParede(classe);
  const ignorarSobre = (o) => Number(o[5]) > 0 || tipoDoMovel(o[0]) === 'tapete' || ehParedeNaEdicao(o[0]);
  function corDe(i, x, y, p, classe) {
    if (!cabeNaSala(x, y, p, L)) return COR_FORA;
    return !ignorarSobre([classe]) && sobrepoe(ed.itens, i, x, y, p, ignorarSobre) ? COR_SOBRE : COR_OK;
  }
  function marcar(x, y, p, cor) {
    const m = ed.marcador; m.visible = true; m.scale.set(p.w, p.h, 1);
    m.position.set(x + p.w / 2, baseDoLadrilho(x, y) + .03, y + p.h / 2); m.material.color.set(cor); sujar();
  }
  function marcarSelecao() {
    if (!ed) return;
    const it = ed.itens[ed.sel];
    if (!it) { ed.marcador.visible = false; sujar(); return; }
    const p = ehParedeNaEdicao(it[0]) ? { w: 1, h: 1 } : pegada(it[0], it[3]);
    marcar(Math.floor(Number(it[1])), Math.floor(Number(it[2])), p, corDe(ed.sel, Number(it[1]), Number(it[2]), p, it[0]));
  }
  function mostrarGrade(sim) { if (ed) { ed.grade = Boolean(sim); ed.grade3d.visible = ed.grade; sujar(); } }
  function selecionarItem(i) {
    if (!ed) return;
    ed.sel = Number.isInteger(i) && ed.itens[i] ? i : null;
    marcarSelecao(); ed.aoSelecionar?.(ed.sel, ed.sel == null ? null : [...ed.itens[ed.sel]]);
  }
  function mudar(novos, info) {
    ed.itens = novos; montarItens(novos, { junto: true });
    if (ed.sel != null && !ed.itens[ed.sel]) ed.sel = null;
    marcarSelecao(); ed.aoMudar?.(novos.map((it) => [...it]), info);
  }
  // Fantasma: a peça da mão, meio transparente, já encaixada na grade (a do catálogo enquanto a do Habbo não chega).
  function fantasmaDe(classe, dir) {
    const peca = pecaDaClasse(classe, tipoDoMovel(classe)), g = obraDaPeca(peca.desenho, peca.cor).montar({ sombra: false });
    g.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .55; o.material.depthWrite = false; } });
    g.rotation.y = giroDaDirecao(dir); g.visible = false;
    return g;
  }
  function dirInicial(classe) { const d = medidaDaPeca(classe).direcoes; return !d || d.includes(2) ? 2 : d[0]; }
  function segurarPeca(classe) {
    if (!ed) return;
    if (ed.fantasma) { ed.camada.remove(ed.fantasma); liberar(ed.fantasma); ed.fantasma = null; }
    ed.novo = classe ? { classe: String(classe), dir: dirInicial(String(classe)) } : null;
    if (ed.novo) { selecionarItem(null); ed.fantasma = fantasmaDe(ed.novo.classe, ed.novo.dir); ed.camada.add(ed.fantasma); mostrarGrade(true); }
    else marcarSelecao();
    canvas.style.cursor = ed.novo ? 'crosshair' : '';
    ed.aoSegurar?.(ed.novo?.classe || null); sujar();
  }
  function lugarDoNovo(p) {
    const { classe, dir } = ed.novo;
    if (ehParedeNaEdicao(classe)) {
      const l = ed.lugarParede?.(Math.floor(p.tx), Math.floor(p.ty), p.tx, p.ty);
      return l ? { x: l.lx, y: l.ly, dir: l.dir, ok: true, parede: true } : { x: Math.floor(p.tx), y: Math.floor(p.ty), dir, ok: false, parede: true };
    }
    const pg = pegada(classe, dir);
    return { ...encaixar(p.tx - pg.w / 2, p.ty - pg.h / 2, pg, L), dir, ok: true, parede: false };
  }
  function moverFantasma(e) {
    const p = noChaoDaSala(e);
    if (!p) { ed.fantasma.visible = false; ed.marcador.visible = false; sujar(); return; }
    const l = lugarDoNovo(p), pg = l.parede ? { w: 1, h: 1 } : pegada(ed.novo.classe, l.dir);
    ed.fantasma.visible = true; ed.fantasma.position.set(l.x + pg.w / 2, baseDoLadrilho(l.x, l.y), l.y + pg.h / 2); ed.fantasma.rotation.y = giroDaDirecao(l.dir);
    marcar(l.x, l.y, pg, l.ok ? corDe(-1, l.x, l.y, pg, ed.novo.classe) : COR_FORA);
  }
  function porNovo(p) {
    const l = lugarDoNovo(p), classe = ed.novo.classe;
    if (!l.ok) { ed.aoAviso?.('Itens de parede vão encostados numa parede: clique no piso junto dela.'); return; }
    segurarPeca(null);
    const novos = porItem(ed.itens, classe, l.x, l.y, l.dir, { parede: l.parede });
    mudar(novos, { tipo: 'por', i: novos.length - 1, classe });
    selecionarItem(novos.length - 1);
  }
  function pairar(e) {
    if (ed.novo) { moverFantasma(e); return; }
    canvas.style.cursor = pecaSob(e) != null ? 'grab' : '';
  }
  function comecarArrasto(e) {
    if (ed.novo || (e.pointerType === 'mouse' && e.button !== 0)) return false;
    const i = pecaSob(e);
    if (i == null) return false;
    selecionarItem(i);
    const it = ed.itens[i], tipo = ed.tipoDeParede?.(it[0]) || (ehDeParede(it[0]) ? 'parede' : '');
    if (tipo === 'imagem') { ed.aoAviso?.('A imagem da equipe fica onde está; dá para guardar (Delete).'); return true; }
    const p = noChaoDaSala(e, true);
    ed.arrasto = { i, x0: e.clientX, y0: e.clientY, moveu: false, dx: p ? p.tx - Number(it[1]) : 0, dy: p ? p.ty - Number(it[2]) : 0, alvo: null, parede: tipo === 'parede' };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    canvas.style.cursor = 'grabbing';
    return true;
  }
  function arrastar(e) {
    const a = ed.arrasto;
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 4) return;
    a.moveu = true;
    const p = noChaoDaSala(e, true), it = ed.itens[a.i];
    if (!p || !it) return;
    const m = gVis[a.i];
    if (a.parede) {
      const l = ed.lugarParede?.(Math.floor(p.tx), Math.floor(p.ty), p.tx, p.ty);
      a.alvo = l ? { x: l.lx, y: l.ly, dir: l.dir } : null;
      if (m) m.visible = false; // a peça de parede reaparece no lugar novo ao soltar
      marcar(l ? l.lx : Math.max(0, Math.floor(p.tx)), l ? l.ly : Math.max(0, Math.floor(p.ty)), { w: 1, h: 1 }, l ? COR_OK : COR_FORA);
      return;
    }
    const pg = pegada(it[0], it[3]);
    a.alvo = { ...encaixar(p.tx - a.dx, p.ty - a.dy, pg, L), dir: it[3] };
    if (m) { m.position.x = a.alvo.x; m.position.z = a.alvo.y; m.position.y = baseDoLadrilho(a.alvo.x, a.alvo.y) + Math.max(0, Number(it[5]) || 0) * NIVEL; sombraSuja = true; }
    marcar(a.alvo.x, a.alvo.y, pg, corDe(a.i, a.alvo.x, a.alvo.y, pg, it[0]));
  }
  function soltarArrasto(cancelar = false) {
    const a = ed.arrasto, it = ed.itens[a.i]; ed.arrasto = null; canvas.style.cursor = '';
    if (!cancelar && it && a.moveu && a.alvo && (a.alvo.x !== Number(it[1]) || a.alvo.y !== Number(it[2]) || a.alvo.dir !== it[3])) {
      mudar(moverItem(ed.itens, a.i, a.alvo.x, a.alvo.y, { dir: a.parede ? a.alvo.dir : null, ehParede: ehParedeNaEdicao }), { tipo: 'mover', i: a.i });
      return;
    }
    // Não mudou (ou soltou longe da parede): a peça volta para onde estava.
    const m = gVis[a.i];
    if (m && it) { m.visible = true; if (!a.parede) { m.position.x = Number(it[1]); m.position.z = Number(it[2]); m.position.y = baseDoLadrilho(it[1], it[2]) + Math.max(0, Number(it[5]) || 0) * NIVEL; } sombraSuja = true; }
    marcarSelecao();
    if (!cancelar && a.moveu && a.parede && !a.alvo) ed.aoAviso?.('Solte junto de uma parede.');
  }
  function cliqueNaEdicao(e) {
    const p = noChaoDaSala(e);
    if (ed.novo) { if (p) porNovo(p); else ed.aoAviso?.('Ponha dentro da sua sala.'); return; }
    selecionarItem(null);
    if (p) mostrarGrade(true);
  }
  function girarPeca() {
    if (!ed) return;
    if (ed.novo) {
      const prox = proximaDirecao(ed.novo.dir, medidaDaPeca(ed.novo.classe).direcoes);
      if (prox == null || ehParedeNaEdicao(ed.novo.classe)) { ed.aoAviso?.(ehParedeNaEdicao(ed.novo.classe) ? 'Peça de parede segue a parede.' : 'Esse móvel não gira no Habbo.'); return; }
      ed.novo.dir = prox; if (ed.fantasma) ed.fantasma.rotation.y = giroDaDirecao(prox); sujar();
      return;
    }
    const it = ed.itens[ed.sel];
    if (!it) return;
    if (ehParedeNaEdicao(it[0])) { ed.aoAviso?.('Peça de parede segue a parede: arraste para a outra parede.'); return; }
    const prox = proximaDirecao(it[3], medidaDaPeca(it[0]).direcoes);
    if (prox == null) { ed.aoAviso?.('Esse móvel não gira no Habbo.'); return; }
    if (!cabeNaSala(Number(it[1]), Number(it[2]), pegada(it[0], prox), L)) { ed.aoAviso?.('Girado, ele sairia da sala. Arraste para um lugar livre e gire de novo.'); return; }
    mudar(girarItem(ed.itens, ed.sel, prox), { tipo: 'girar', i: ed.sel });
  }
  function guardarPeca() {
    if (!ed || ed.sel == null) return;
    const r = guardarItem(ed.itens, ed.sel);
    ed.sel = null; mudar(r.itens, { tipo: 'guardar', item: r.item }); ed.aoSelecionar?.(null, null);
  }
  function empurrar(dx, dy) {
    const it = ed.itens[ed.sel];
    if (!it) return;
    if (ehParedeNaEdicao(it[0])) { ed.aoAviso?.('Peça de parede: arraste para outro trecho da parede.'); return; }
    const a = encaixar(Number(it[1]) + dx, Number(it[2]) + dy, pegada(it[0], it[3]), L);
    if (a.x !== Number(it[1]) || a.y !== Number(it[2])) mudar(moverItem(ed.itens, ed.sel, a.x, a.y, { ehParede: ehParedeNaEdicao }), { tipo: 'mover', i: ed.sel });
  }
  // As setas da tela do Habbo: cima/baixo andam no y do quarto e esquerda/direita no x (como no editor do Escritório).
  const SETAS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function teclaEdicao(e) {
    if (!ed || e.ctrlKey || e.metaKey || e.target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
    if (document.querySelector?.('dialog[open], #cli-pergunta')) return;
    const k = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'r') girarPeca();
    else if (k === 'Delete' || k === 'Backspace') { if (ed.sel == null) return; guardarPeca(); }
    else if (k === 'Escape') { if (ed.novo) segurarPeca(null); else if (ed.sel != null) selecionarItem(null); else ed.aoSair?.(); }
    else if (k === 'g') mostrarGrade(!ed.grade);
    else if (SETAS[k] && ed.sel != null && !e.altKey) empurrar(...SETAS[k]);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  function iniciarEdicao({ sala, itens, aoMudar, aoSelecionar, aoSegurar, aoAviso, aoSair, tipoDeParede, lugarParede } = {}) {
    if (sala !== quarto.id) return false;
    if (ed) pararEdicao();
    const linhas = [];
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
      if (P.nivel(x, y) < 0) continue;
      const h = baseDoLadrilho(x, y) + .02;
      linhas.push(x, h, y, x + 1, h, y, x, h, y, x, h, y + 1, x + 1, h, y, x + 1, h, y + 1, x, h, y + 1, x + 1, h, y + 1);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(linhas, 3));
    const grade3d = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: COR_OK, transparent: true, opacity: .45, depthWrite: false }));
    const marcador = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: COR_OK, transparent: true, opacity: .35, depthWrite: false }));
    marcador.rotation.x = -Math.PI / 2; marcador.visible = false; marcador.renderOrder = 3;
    const camada = new THREE.Group(); camada.add(grade3d, marcador); cena.add(camada);
    ed = { itens: copiaItens(Array.isArray(itens) ? itens : quarto.itens), sel: null, novo: null, arrasto: null, grade: true, grade3d, marcador, camada, fantasma: null,
      aoMudar, aoSelecionar, aoSegurar, aoAviso, aoSair, tipoDeParede, lugarParede };
    montarItens(ed.itens, { junto: true });
    window.addEventListener('keydown', teclaEdicao, true);
    sujar(true);
    return true;
  }
  function pararEdicao() {
    if (!ed) return;
    window.removeEventListener('keydown', teclaEdicao, true);
    cena.remove(ed.camada); liberar(ed.camada);
    for (const m of gVis) if (m) m.visible = true;
    ed = null; canvas.style.cursor = ''; sujar(true);
  }
  // Acabamento escolhido no painel (piso: as duas cores do ladrilho; parede: a cor). Escolher o piso tira a pintura
  // ladrilho a ladrilho, como no editor; null volta ao do quarto.
  function definirAcabamento(sala, { piso: novoPiso = null, parede: novaParede = null } = {}) {
    if (sala !== quarto.id) return;
    pisoAtual = Array.isArray(novoPiso) && novoPiso.length === 2 && novoPiso.every(ehCor) ? [...novoPiso] : piso;
    pisoPintado = novoPiso ? () => null : pisoEm;
    corParedeAtual = ehCor(novaParede) ? novaParede : corParede;
    montarPiso(); montarParedes();
  }

  // ---------- desenho sob demanda ----------
  let vivo = true, pedido = 0, ultimo = 0, sombraSuja = true, visivel = true;
  function sujar(sombra = false) { if (sombra) sombraSuja = true; if (!pedido && vivo && visivel && !document.hidden) pedido = requestAnimationFrame(passo); }
  const v = new THREE.Vector3();
  const etiquetas = [];
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
      v.set(b.x, b.y + (a?.deita ? .9 : a ? b.alto * .8 : b.alto) + .15, b.z).project(camera); etiquetas.push({ el: b.el, x: (v.x * .5 + .5) * r.width, y: (-v.y * .5 + .5) * r.height });
      if (seguir && b.eu && anda) { quer.alvo.x = b.x; quer.alvo.z = b.z; }
    }
    // Nomes de quem está perto não se encavalam: de cima para baixo, quem ficaria por cima de outro sobe uma linha.
    etiquetas.sort((p, q) => q.y - p.y);
    for (let i = 0; i < etiquetas.length; i++) for (let k = 0; k < i; k++) {
      const p = etiquetas[i], q = etiquetas[k];
      if (Math.abs(p.x - q.x) < 64 && Math.abs(p.y - q.y) < 18) p.y = q.y - 20;
    }
    for (const e of etiquetas) e.el.style.transform = `translate(-50%,-100%) translate(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px)`;
    etiquetas.length = 0;
    if (sombraSuja) { renderer.shadowMap.needsUpdate = true; sombraSuja = false; }
    acabamento.render();
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
    if (ed && toques.size === 0 && comecarArrasto(e)) return; // decorando: a peça clicada é pega; o resto move a sala
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = Math.hypot(a.x - b.x, a.y - b.y); arrasto = null; }
    else arrasto = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ed?.arrasto) { arrastar(e); return; }
    if (ed && !arrasto) pairar(e);
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
  canvas.addEventListener('pointercancel', (e) => { soltar(e); arrasto = null; if (ed?.arrasto) soltarArrasto(true); });
  canvas.addEventListener('pointerup', (e) => {
    soltar(e); // sempre: um toque esquecido impedia o próximo arrasto
    if (ed?.arrasto) { soltarArrasto(); return; }
    const parado = arrasto && Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 5; arrasto = null;
    // Decorando: o clique é da edição (pôr a peça da mão, largar a seleção, mostrar a grade); não anda.
    if (ed) { if (parado) cliqueNaEdicao(e); return; }
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

  // WASD e setas (Paulo, 09/11/2026: "andar no quarto clicando, no WASD... como tinha no legado"): o mesmo movimento
  // do Escritório (tecladoEscritorio), que respeita os móveis e manda a posição para todos. Só com você nesta sala,
  // fora do modo decorar e fora de campos de texto; a câmera acompanha.
  const naSala = () => { try { return typeof escritorio !== 'undefined' && escritorio?.zona === quarto.id && (escritorio.conectado || escritorio.base?.demo); } catch { return false; } };
  const visivelAgora = () => canvas.isConnected && canvas.getBoundingClientRect().width > 0;
  function teclaAndar(e) {
    if (ed || !naSala() || !visivelAgora() || document.querySelector?.('dialog[open], .workflow-modal, #vv-decorar')) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    const antes = e.defaultPrevented;
    try { if (typeof escritorio !== 'undefined') escritorio.correndo = e.shiftKey; globalThis.tecladoEscritorio?.(e); } catch { /* sem o motor do Escritório */ }
    if (e.defaultPrevented && !antes) { seguir = true; sujar(); }
  }
  function soltarAndar(e) { try { globalThis.soltarTeclaEscritorio?.(e); } catch { /* sem o motor */ } }
  window.addEventListener('keydown', teclaAndar);
  window.addEventListener('keyup', soltarAndar);

  montarPiso();
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
    // A decoração mudou fora daqui (salvou pelo editor do Escritório): o quarto acompanha, menos durante a edição.
    itens: (lista) => { if (!ed) montarItens(lista); },
    // Modo decorar (vybe-mundo-decorar.js): a mesma interface do andar antigo (mundo/sala.mjs).
    iniciarEdicao, pararEdicao,
    editando: () => (ed ? quarto.id : ''),
    selecionar: (i) => selecionarItem(i),
    segurar: (classe) => segurarPeca(classe),
    girar: () => girarPeca(),
    guardar: () => guardarPeca(),
    grade: (sim) => mostrarGrade(sim),
    definirItens(itens, sala = quarto.id) {
      if (sala !== quarto.id) return;
      const lista = copiaItens(itens);
      if (ed) { ed.itens = lista; ed.sel = null; montarItens(lista, { junto: true }); marcarSelecao(); ed.aoSelecionar?.(null, null); return; }
      montarItens(lista);
    },
    definirAcabamento,
    // Medidas do Habbo: só a peça de reserva (catálogo) usa; a esculpida já sai do tamanho do móvel.
    medidas(lista) { for (const [classe, m] of lista || []) definirMedida(classe, m); },
    // Onde um ponto do quarto (ladrilhos e altura do mundo) aparece na tela, em pixels da página.
    naTela(x, y = 0, z = 0) { posicionar(); const r = canvas.getBoundingClientRect(), q = new THREE.Vector3(x, y, z).project(camera); return { x: r.left + (q.x * .5 + .5) * r.width, y: r.top + (-q.y * .5 + .5) * r.height }; },
    verTudo() { quer.alvo.copy(alvo.set(W / 2, .6 + nivelMax * NIVEL / 2, D / 2)); quer.dist = longe; sujar(); },
    destruir() {
      vivo = false; if (pedido) cancelAnimationFrame(pedido); pedido = 0; clearInterval(relogio); pararEdicao();
      window.removeEventListener('keydown', teclaAndar); window.removeEventListener('keyup', soltarAndar); try { globalThis.escritorioPararTeclado?.(); } catch { /* sem o motor */ }
      ro.disconnect(); io?.disconnect(); document.removeEventListener('visibilitychange', aoVoltarAba);
      for (const b of pessoas.values()) b.el.remove(); pessoas.clear();
      liberar(cena); acabamento.destruir(); renderer.dispose();
    },
  };
}
