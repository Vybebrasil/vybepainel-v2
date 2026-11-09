// Identidade voxel única (Paulo, 09/11/2026: "tudo que é de voxel... precisa seguir uma identidade bem definida...
// deixa o motor inteligente pra seguir um padrão visual"). Um lugar só para a luz, a sombra, o acabamento do
// renderizador e a base de maquete: o mundo (motor.mjs), o andar (sala.mjs), o quarto (quarto.mjs) e os retratos dos
// bonecos (avatar.mjs) montam a cena por aqui. O acabamento de cada bloco (tom levemente diferente, quina, pé
// escurecido) fica no material único das caixas (materialVoxel em voxel.mjs). Mude o visual aqui, não em cada cena.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Referência: maquete voxel rica, luz quente de fim de tarde vinda do alto à esquerda, sombra macia, um contorno
// quente atrás das peças (as bordas "acendem") e céu claro. Interior (quarto, andar) é a mesma luz, mais cheia.
export const ESTILO = Object.freeze({
  exposicao: 1.05,
  dia: { ceu: '#EAF6FF', chao: '#7E6A4E', hemi: .9, sol: '#FFEBCB', forca: 2.15, preenche: '#CFE4FF', fPreenche: .35, contorno: '#FFB27A', fContorno: .55 },
  noite: { ceu: '#7083C4', chao: '#2A2A3A', hemi: .52, sol: '#A9BBFF', forca: .8, fPreenche: .15, fContorno: .25, exposicao: .85 },
  interior: { ceu: '#E9E2FF', chao: '#6A4A3A', hemi: .8, sol: '#FFD8A0', forca: 3.1, preenche: '#B8B4FF', fPreenche: .22, contorno: '#FFB070', fContorno: .55, lampada: '#FFE3C2', solNoite: '#FFD39A' },
  // Base de maquete (terra em camadas embaixo do piso), de cima para baixo.
  base: ['#8A6A4C', '#6E523A', '#54402E'],
  luzMovel: '#FFC77A',
  // Acabamento de maquete: oclusão nos cantos (raio em unidades do mundo) e brilho só no que acende.
  ao: { forca: 1.1, raio: .3 },
  brilho: { forca: .55, limiar: .85 },
  // Superfície: lisa como nas referências (sem grade nem quina de cada bloco); o volume vem da luz e da oclusão.
  superficie: { amp: .03, grade: 0, borda: false, tomBloco: .025 },
});

// Acabamento do renderizador: cor real, curva de cinema, sombra macia.
export function prepararRenderer(r, { sombra = true, exposicao = ESTILO.exposicao } = {}) {
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = exposicao;
  // Sombra macia de verdade (raio do PCF), como nas referências de 09/11/2026.
  if (sombra) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; }
  return r;
}

// As quatro luzes do padrão: céu (hemisfério), sol com sombra, preenchimento frio do lado oposto e o contorno quente
// por trás. centro/raio dizem onde a cena está (para apontar o sol e cobrir a sombra); interior = quarto e andar.
// Devolve as luzes e hora(noite, tinta) para o dia e a noite: fora, escurece para o luar; dentro, só esquenta.
export function luzDoEstilo(cena, { centro = [0, 0, 0], raio = 10, interior = false, sombra = null, alturaSol = 1.4 } = {}) {
  const E = interior ? ESTILO.interior : ESTILO.dia, [cx, cy, cz] = centro;
  const hemi = new THREE.HemisphereLight(E.ceu, E.chao, E.hemi);
  const sol = new THREE.DirectionalLight(E.sol, E.forca);
  // Alto à esquerda e à frente da câmera do Habbo (que olha de +x+z): as faces da frente acendem, a sombra cai atrás.
  sol.position.set(cx + raio * .75, cy + raio * alturaSol, cz + raio);
  sol.target.position.set(cx, cy, cz);
  if (sombra) {
    sol.castShadow = true; sol.shadow.mapSize.set(sombra.mapa || 2048, sombra.mapa || 2048);
    const s = sombra.lado || raio + 4;
    Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: .5, far: sombra.longe || raio * 6 });
    sol.shadow.bias = sombra.bias ?? -.0008; sol.shadow.normalBias = sombra.normalBias ?? .035; sol.shadow.radius = sombra.raio ?? 3;
  }
  const preenche = new THREE.DirectionalLight(E.preenche, E.fPreenche);
  preenche.position.set(cx - raio, cy + raio * 1.2, cz + raio * .6);
  const contorno = new THREE.DirectionalLight(E.contorno, E.fContorno);
  contorno.position.set(cx - raio * .8, cy + raio * .5, cz - raio);
  contorno.target.position.set(cx, cy, cz);
  cena.add(hemi, sol, sol.target, preenche, contorno, contorno.target);
  const branco = new THREE.Color('#FFFFFF');
  function hora(noite = 0, tinta = null) {
    const k = Math.min(1, Math.max(0, Number(noite) || 0)), t = tinta ? branco.clone().lerp(new THREE.Color(tinta), .35) : branco;
    if (interior) {
      const I = ESTILO.interior;
      hemi.intensity = I.hemi * (1 - .12 * k); hemi.color.set(I.ceu).lerp(new THREE.Color(I.lampada), .35 * k).multiply(t);
      sol.intensity = I.forca * (1 - .2 * k); sol.color.set(I.sol).lerp(new THREE.Color(I.solNoite), .5 * k).multiply(t);
      preenche.intensity = I.fPreenche * (1 - .2 * k); contorno.intensity = I.fContorno * (1 + .3 * k);
      return;
    }
    const D = ESTILO.dia, N = ESTILO.noite;
    hemi.intensity = D.hemi + (N.hemi - D.hemi) * k; hemi.color.set(D.ceu).lerp(new THREE.Color(N.ceu), k); hemi.groundColor.set(D.chao).lerp(new THREE.Color(N.chao), k);
    sol.intensity = D.forca + (N.forca - D.forca) * k; sol.color.set(D.sol).lerp(new THREE.Color(N.sol), k);
    preenche.intensity = D.fPreenche + (N.fPreenche - D.fPreenche) * k; contorno.intensity = D.fContorno + (N.fContorno - D.fContorno) * k;
  }
  return { hemi, sol, preenche, contorno, hora };
}

// Base de maquete: o chão de uma cena (quarto, ilha) apoiado num bloco de terra em camadas, com a beira irregular
// (cada coluna da borda desce um pouco diferente), como nas maquetes de referência. ladrilhos(x, z) diz onde há
// chão; fundo é até onde a base desce. Escreve na Obra recebida.
export function baseDeMaquete(obra, { W, D, ladrilhos = () => true, topo = -.12, fundo = -1.1, semente = 7 } = {}) {
  const r = (x, z, n) => { const v = Math.sin((x * 12.9898 + z * 78.233 + n * 37.719 + semente) * 1.3) * 43758.5453; return v - Math.floor(v); };
  const [c0, c1, c2] = ESTILO.base, altura = topo - fundo;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (!ladrilhos(x, z)) continue;
    const borda = !ladrilhos(x + 1, z) || !ladrilhos(x, z + 1) || !ladrilhos(x - 1, z) || !ladrilhos(x, z - 1);
    // Por dentro, um bloco só (ninguém vê); na borda, as três camadas com a divisa variando de coluna em coluna.
    if (!borda) { obra.caixa(x + .5, fundo, z + .5, 1, altura, 1, c1); continue; }
    const a = altura * (.28 + r(x, z, 1) * .1), b = altura * (.36 + r(x, z, 2) * .1), c = altura - a - b;
    obra.caixa(x + .5, topo - a, z + .5, 1, a, 1, c0);
    obra.caixa(x + .5, topo - a - b, z + .5, 1, b, 1, c1);
    obra.caixa(x + .5, fundo, z + .5, 1, c, 1, c2);
    // Pedrinhas soltas na face: o detalhe que a referência tem na beira da maquete.
    if (r(x, z, 3) > .5) {
      const fora = !ladrilhos(x + 1, z) ? [1, 0] : !ladrilhos(x, z + 1) ? [0, 1] : !ladrilhos(x - 1, z) ? [-1, 0] : [0, -1];
      const ao = .2 + r(x, z, 4) * .6, y = topo - a - b * (.2 + r(x, z, 5) * .7);
      obra.caixa(x + .5 + fora[0] * .52 + (fora[0] ? 0 : ao - .5), y, z + .5 + fora[1] * .52 + (fora[1] ? 0 : ao - .5), .14, .1, .14, r(x, z, 6) > .5 ? c2 : c0);
    }
  }
}

// Acabamento de maquete (Paulo, 09/11/2026, referências de quarto voxel: "esse é o estilo ideal pra tudo"): oclusão
// nos cantos e embaixo das peças (GTAO, o que dá o ar de render), e um brilho leve só no que acende (luminária,
// tela, janela). Devolve { render(), tamanho(w, h), ligar(sim), destruir() }; desligado, desenha direto.
export function acabamentoDeMaquete(renderer, cena, camera, { ao = true, brilho = true } = {}) {
  const tam = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(cena, camera));
  let gtao = null, bloom = null;
  if (ao) {
    gtao = new GTAOPass(cena, camera, Math.max(1, tam.x), Math.max(1, tam.y));
    gtao.output = GTAOPass.OUTPUT.Default; // com o filtro (pd) ligado: sem grão nem listras ao mover a câmera
    gtao.blendIntensity = ESTILO.ao.forca;
    gtao.updateGtaoMaterial({ radius: ESTILO.ao.raio, distanceExponent: 1.4, thickness: 1, scale: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(gtao);
  }
  if (brilho) { bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, tam.x), Math.max(1, tam.y)), ESTILO.brilho.forca, .5, ESTILO.brilho.limiar); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  let ligado = true;
  return {
    render() { if (ligado) composer.render(); else renderer.render(cena, camera); },
    tamanho(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(Math.max(1, w), Math.max(1, h)); },
    ligar(sim) { ligado = Boolean(sim); },
    destruir() { composer.dispose?.(); gtao?.dispose?.(); bloom?.dispose?.(); },
  };
}

// Paleta Vybe (Paulo, 09/11/2026: "pode reinterpretar"): o quarto de cada um é uma releitura no estilo das
// referências. Toda cor (piso, parede, móvel) cai no tom mais próximo desta paleta, que combina entre si: madeiras
// quentes, pastéis de parede, acentos vivos e neutros quentes. O móvel continua reconhecível; o quarto fica harmonioso.
export const PALETA = Object.freeze({
  parede: ['#8FD3C7', '#A9BE8E', '#F0D8A8', '#F4B9A0', '#BBA9E0', '#A2C8E8', '#EDE3D2', '#E9C46A'],
  madeira: ['#E0A36A', '#C9774A', '#B0623C', '#8A5A3C', '#5E4030'],
  acento: ['#FF7A2F', '#F2C230', '#E5484D', '#2FA7A0', '#3D7DD8', '#8E6CC9', '#4FA35A', '#F06EA0', '#7FC8E8'],
  neutro: ['#F7F2E8', '#E2D9C8', '#B8AE9F', '#857B70', '#4A403A', '#2E2824'],
});
const TODAS = [...PALETA.madeira, ...PALETA.acento, ...PALETA.neutro, ...PALETA.parede];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0);
// Distância "de olho": verde pesa mais, vermelho e azul menos (aproximação rápida da percepção).
const dist = (a, b) => { const r = (a[0] + b[0]) / 2, d = a.map((v, i) => v - b[i]); return (2 + r / 256) * d[0] ** 2 + 4 * d[1] ** 2 + (2 + (255 - r) / 256) * d[2] ** 2; };
const perto = (lista, cor) => { const c = rgb(cor); let m = lista[0], dm = Infinity; for (const p of lista) { const dd = dist(c, rgb(p)); if (dd < dm) { dm = dd; m = p; } } return m; };
const memo = new Map();
// Cor de móvel: o tom mais próximo de toda a paleta.
export function harmonizar(cor) {
  if (!/^#[0-9a-f]{6}$/i.test(String(cor))) return cor;
  const k = String(cor).toLowerCase(); if (!memo.has(k)) memo.set(k, perto(TODAS, k)); return memo.get(k);
}
// Parede: sempre um pastel claro da paleta (parede escura do Habbo vira o pastel do mesmo matiz; cinza vira creme).
export function corDeParede(cor) {
  const c = new THREE.Color(/^#[0-9a-f]{6}$/i.test(String(cor)) ? cor : '#EDE3D2'), hsl = c.getHSL({});
  if (hsl.s < .14) return hsl.l < .35 ? '#A9BE8E' : '#EDE3D2';
  const alvo = '#' + new THREE.Color().setHSL(hsl.h, .5, .72).getHexString();
  return perto(PALETA.parede, alvo);
}
// Piso: madeira quente (as referências), ou um neutro claro para pisos claros (mármore, cerâmica).
export function corDePiso(cor) {
  const c = new THREE.Color(/^#[0-9a-f]{6}$/i.test(String(cor)) ? cor : '#C9774A'), hsl = c.getHSL({});
  if (hsl.l > .72) return perto(PALETA.neutro.slice(0, 2), '#' + c.getHexString());
  if (hsl.l < .22) return PALETA.madeira[3];
  return perto(PALETA.madeira, '#' + c.getHexString());
}
