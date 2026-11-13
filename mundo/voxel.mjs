// Caixa de ferramentas voxel: uma "obra" junta milhares de blocos em duas
// InstancedMesh (peças com luz e sombra + peças que brilham), com letreiro em
// letras de blocos. Assim cada sede tem detalhe fino sem pesar.
import * as THREE from 'three';
import { ESTILO } from './estilo.mjs';

// Fonte 3×5 (linhas de cima para baixo). Acentos caem na letra sem acento.
const F = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '&': '010101010101011', '-': '000000111000000', '.': '000000000000010', ' ': '000000000000000', "'": '010010000000000',
};
export const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Superfície "de cubinhos" (Paulo, 07/11/2026: "tudo muito bem detalhado, no nível da baleia"): toda face ganha a
// grade de voxels de 1 m (0,1 da unidade do mundo) com cada cubinho num tom levemente diferente, a quina de cada
// bloco escurecida e o pé das paredes mais escuro (oclusão de contato). Tudo no shader: nenhum triângulo a mais.
// De longe (cubinho menor que 1 pixel) a grade some sozinha, sem tremer.
// borda: só para caixas (BoxGeometry de 1×1×1 escalada), que sabem onde fica a quina de cada uma.
export function voxelizar(material, { tam = 0.1, amp = 0.22, grade = 1, borda = true, tomBloco = 0.07 } = {}) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVxPos; varying vec3 vVxNor; varying vec3 vVxLoc; varying vec3 vVxEsc; varying vec3 vVxOri;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
  mat4 vxM = modelMatrix * instanceMatrix;
#else
  mat4 vxM = modelMatrix;
#endif
  vVxPos = (vxM * vec4(transformed, 1.0)).xyz;
  vVxNor = normalize(mat3(vxM) * objectNormal);
  vVxLoc = position;
  vVxEsc = vec3(length(vxM[0].xyz), length(vxM[1].xyz), length(vxM[2].xyz));
  vVxOri = vxM[3].xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVxPos; varying vec3 vVxNor; varying vec3 vVxLoc; varying vec3 vVxEsc; varying vec3 vVxOri;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 vxN = normalize(vVxNor), vxA = abs(vxN);
  vec3 vxP = (vVxPos - vxN * 0.004) / ${tam.toFixed(4)};
  vec3 vxC = floor(vxP);
  float vxH = fract(sin(dot(vxC, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vec3 vxD = fwidth(vxP);
  float vxVis = 1.0 - smoothstep(0.3, 0.85, max(max(vxD.x, vxD.y), vxD.z));
  vec3 vxF = fract(vxP), vxM2 = min(vxF, 1.0 - vxF);
  float vxS = 1.0;
  if (vxA.x < 0.5) vxS = min(vxS, smoothstep(0.0, 0.11, vxM2.x));
  if (vxA.y < 0.5) vxS = min(vxS, smoothstep(0.0, 0.11, vxM2.y));
  if (vxA.z < 0.5) vxS = min(vxS, smoothstep(0.0, 0.11, vxM2.z));
  diffuseColor.rgb *= (1.0 + (vxH - 0.5) * ${amp.toFixed(3)} * vxVis) * mix(1.0, mix(0.8, 1.0, vxS), vxVis * ${grade.toFixed(2)});
  // Cada bloco com o próprio tom (padrão voxel, estilo.mjs): também nos blocos miúdos dos móveis e bonecos.
  float vxT = fract(sin(dot(floor(vVxOri * 97.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  diffuseColor.rgb *= 1.0 + (vxT - 0.5) * ${tomBloco.toFixed(3)};
${borda ? `  vec3 vxL = (0.5 - abs(vVxLoc)) * vVxEsc;
  float vxE = 1e3;
  if (vxA.x < 0.5) vxE = min(vxE, vxL.x);
  if (vxA.y < 0.5) vxE = min(vxE, vxL.y);
  if (vxA.z < 0.5) vxE = min(vxE, vxL.z);
  // A quina acompanha o tamanho do bloco e some quando o bloco tem poucos pixels na tela: bloco miúdo (móvel, boneco)
  // fica com a face limpa e a luz desenha as facetas, sem escurecer inteiro.
  // Tamanho do pixel no mundo pela posição (contínua na face toda). Antes era a derivada de vxE: vxE é o mínimo entre as
  // distâncias às bordas e quebra na diagonal da face, e a derivada saltava ali: cada ladrilho saía partido em dois
  // triângulos de tons diferentes, mudando com o zoom (Paulo, 13/11/2026: "parece todo quebrado").
  float vxPix = max(length(fwidth(vVxPos)) * 0.7071, 1e-5);
  float vxLado = min(min(vVxEsc.x, vVxEsc.y), vVxEsc.z), vxPx = vxLado / vxPix;
  float vxQ = smoothstep(0.0, min(0.03, vxLado * 0.16) + vxPix, vxE);
  diffuseColor.rgb *= mix(mix(mix(0.9, 0.74, smoothstep(0.15, 0.5, vxLado)), 1.0, vxQ), 1.0, 1.0 - smoothstep(4.0, 10.0, vxPx)) * (1.0 + step(0.5, vxN.y) * 0.05);
  float vxB = (vVxLoc.y + 0.5) * vVxEsc.y;
  diffuseColor.rgb *= mix(1.0, mix(0.8, 1.0, clamp(smoothstep(0.0, 0.2, vxB) + step(0.5, vxA.y), 0.0, 1.0)), smoothstep(0.15, 0.4, vVxEsc.y));` : ''}
}`);
  };
  material.customProgramCacheKey = () => `voxel3:${tam}:${amp}:${grade}:${borda}:${tomBloco}`;
  return material;
}
// Material único das caixas do mundo (uma compilação só para casas, árvores, sedes, prédio e salas).
let matCaixa = null;
// Centro comercial (08/11/2026): a grade é de 1 bloco (antes 10 cm, o que virava "500 quadradinhos" em cada face).
// Desde 09/11/2026 (referências de quarto voxel do Paulo: "o estilo ideal pra tudo") a superfície é lisa: sem a
// grade nem a quina de cada bloco; o volume vem da luz, da sombra macia e da oclusão (estilo.mjs).
export const materialVoxel = () => (matCaixa ||= voxelizar(new THREE.MeshStandardMaterial({ roughness: .86 }), { tam: 1, ...ESTILO.superficie }));

// Sombra de contato (Paulo, 08/11/2026: "tem que ficar FODA de bonito"): uma mancha macia no chão embaixo de cada
// árvore, bicho e boneco, que "assenta" a peça no chão. Uma textura só, um material só, sem entrar no cálculo da sombra.
let matSombra = null;
// Textura redonda que some para as bordas (alfa em três paradas: centro, meio e borda), gerada em memória: funciona
// também fora do navegador (testes) e não precisa de canvas.
export function texturaRadial([r, g, b], [a0, a1, a2], lado = 32) {
  const px = new Uint8Array(lado * lado * 4), m = (lado - 1) / 2;
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
    const d = Math.min(1, Math.hypot(x - m, y - m) / m), a = d < .55 ? a0 + (a1 - a0) * (d / .55) : a1 + (a2 - a1) * ((d - .55) / .45), i = (y * lado + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(Math.max(0, a) * 255);
  }
  const tx = new THREE.DataTexture(px, lado, lado); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true;
  return tx;
}
export function materialSombra() {
  if (matSombra) return matSombra;
  const tx = texturaRadial([20, 24, 18], [.55, .28, 0]);
  matSombra = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return matSombra;
}
// Água viva: a cor ondula pela posição e pelo tempo (só no shader), com reflexo claro nas cristas. O tempo é um uniform
// só, avançado pela vida do mundo (vida.mjs) quando está animando; parado, a água fica parada.
let matAgua = null;
export function materialAgua() {
  if (matAgua) return matAgua;
  const tempo = { value: 0 };
  matAgua = new THREE.MeshStandardMaterial({ roughness: .25, metalness: .05 });
  matAgua.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = tempo;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAgPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
  vAgPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vAgPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAgPos; uniform float uTempo;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float o1 = sin(vAgPos.x * 1.7 + uTempo * 1.3) * sin(vAgPos.z * 1.3 - uTempo * 1.1);
  float o2 = sin((vAgPos.x + vAgPos.z) * 2.9 - uTempo * 2.0);
  float onda = o1 * .5 + o2 * .25;
  diffuseColor.rgb *= 1.0 + onda * .1;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), smoothstep(.55, .75, onda) * .35);
}`);
  };
  matAgua.customProgramCacheKey = () => 'agua-v1';
  matAgua.userData.tempo = tempo;
  return matAgua;
}

export class Obra {
  constructor() { this.solidos = []; this.luzes = []; this.aguas = []; this.sombras = []; }
  caixa(x, y, z, w, h, d, cor) { this.solidos.push({ x, y, z, w, h, d, cor }); return this; }
  luz(x, y, z, w, h, d, cor) { this.luzes.push({ x, y, z, w, h, d, cor }); return this; }
  agua(x, y, z, w, h, d, cor = '#4FB6E3') { this.aguas.push({ x, y, z, w, h, d, cor }); return this; }
  // Mancha de sombra de contato no chão (y é a altura do chão naquele ponto), com raio r.
  sombra(x, z, r, y = 0) { this.sombras.push({ x, y, z, r }); return this; }
  // Grade de janelas numa face (eixo 'x' = face que olha para +z/-z; 'z' = face que olha para +x/-x).
  janelas({ x0, x1, y0, y1, z, eixo = 'x', passo = .5, w = .3, h = .34, cor = '#5D7884', acesa = 0, corLuz = '#FFE2A8', semente = 1 }) {
    let k = semente;
    for (let y = y0; y + h <= y1 + 1e-6; y += h + .22) for (let a = x0 + passo / 2; a < x1; a += passo) {
      k = (k * 9301 + 49297) % 233280;
      const ligada = k / 233280 < acesa;
      const [px, pz, ww, dd] = eixo === 'x' ? [a, z, w, .05] : [z, a, .05, w];
      (ligada ? this.luz.bind(this) : this.caixa.bind(this))(px, y, pz, ww, h, dd, ligada ? corLuz : cor);
    }
    return this;
  }
  // Letreiro: texto em blocos sobre um painel. Centro em (x, y, z); a frente olha para +z.
  letreiro(texto, { x = 0, y = 0, z = 0, px = .09, cor = '#FFFFFF', fundo = null, aceso = false, margem = .12, prof = .06 } = {}) {
    const t = semAcento(texto).slice(0, 18);
    const largura = t.length * 4 * px - px, altura = 5 * px;
    if (fundo) this.caixa(x, y - altura / 2 - margem, z - prof, largura + margem * 2, altura + margem * 2, prof, fundo);
    const put = aceso ? this.luz.bind(this) : this.caixa.bind(this);
    [...t].forEach((ch, i) => {
      const g = F[ch] || F[' '];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1')
        put(x - largura / 2 + (i * 4 + c) * px + px / 2, y + altura / 2 - (r + 1) * px, z + .01, px * .92, px * .92, .05, cor);
    });
    return { largura, altura };
  }
  // Árvore em blocos. tipo (Paulo, 08/11/2026: "as árvores tudo igual"): 'copa' (cachos em três verdes, a de
  // sempre), 'ipe' (copa larga florida, amarela ou rosa), 'coqueiro' (tronco curvo em gomos e folhas caídas),
  // 'pinheiro' (camadas que afinam), 'cipreste' (alto e estreito) e 'arbusto' (moita baixa). 'florida' muda a cor
  // da flor do ipê. Tudo em blocos da mesma escala, para conviverem lado a lado.
  arvore(x, y, z, { s = 1, cor = '#5FA34E', fruta = null, tipo = 'copa', florida = '#F2C230' } = {}) {
    this.sombra(x, z, ({ ipe: .95, coqueiro: .9, pinheiro: .7, cipreste: .42, arbusto: .55 }[tipo] || .75) * s, y);
    const c0 = new THREE.Color(cor), tom = (h, sat, l) => '#' + c0.clone().offsetHSL(h, sat, l).getHexString();
    const tons = [tom(0, 0, 0), tom(.02, .05, -.07), tom(-.02, 0, .06)], tronco = '#6E4B33';
    if (tipo === 'ipe') {
      const f = new THREE.Color(florida), ft = (l) => '#' + f.clone().offsetHSL(0, 0, l).getHexString();
      this.caixa(x, y, z, .2 * s, .9 * s, .2 * s, tronco).caixa(x + .18 * s, y + .7 * s, z, .34 * s, .1 * s, .12 * s, tronco);
      this.caixa(x, y + .85 * s, z, 1.3 * s, .42 * s, 1.2 * s, ft(0));
      [[.55, .1, .1], [-.5, -.1, 0], [.05, .5, .06], [0, -.52, .12], [.3, .3, .3], [-.32, -.25, .28]].forEach(([a2, b2, c], k) => this.caixa(x + a2 * s, y + (.82 + c) * s, z + b2 * s, .55 * s, .4 * s, .55 * s, ft([0, -.06, .07][k % 3])));
      this.caixa(x - .1 * s, y + 1.3 * s, z + .05 * s, .6 * s, .22 * s, .6 * s, ft(.08));
      for (const [a2, b2] of [[.7, .5], [-.6, .6], [.4, -.7]]) this.caixa(x + a2 * s, y, z + b2 * s, .2 * s, .03, .2 * s, ft(-.02));
      return this;
    }
    if (tipo === 'coqueiro') {
      for (let k = 0; k < 6; k++) this.caixa(x + Math.sin(k * .35) * .22 * s, y + k * .32 * s, z, (.2 - k * .01) * s, .3 * s, (.2 - k * .01) * s, k % 2 ? '#8A6A48' : '#7A5A3C');
      const tx = x + Math.sin(5 * .35) * .22 * s, ty = y + 1.92 * s;
      // Folhas em arco (referências voxel): oito folhas saindo do topo, cada uma em quatro gomos que vão afinando e
      // caindo, em dois verdes alternados, e o miolo claro por cima.
      for (let f = 0; f < 8; f++) {
        const a = f / 8 * Math.PI * 2 + .2, dx = Math.cos(a), dz = Math.sin(a), cor = f % 2 ? tons[0] : tons[1];
        [[.22, 0, .3], [.48, -.04, .26], [.72, -.16, .2], [.9, -.34, .14]].forEach(([r, h, larg]) =>
          this.caixa(tx + dx * r * s, ty + h * s, z + dz * r * s, (Math.abs(dx) > .5 ? .3 : larg) * s, .09 * s, (Math.abs(dz) > .5 ? .3 : larg) * s, cor));
      }
      this.caixa(tx, ty + .04 * s, z, .3 * s, .14 * s, .3 * s, tons[2]);
      this.caixa(tx, ty - .14 * s, z + .12 * s, .14 * s, .14 * s, .14 * s, '#7A5534').caixa(tx + .12 * s, ty - .16 * s, z - .08 * s, .14 * s, .14 * s, .14 * s, '#7A5534');
      return this;
    }
    if (tipo === 'pinheiro') {
      this.caixa(x, y, z, .2 * s, .5 * s, .2 * s, tronco);
      [[1.2, .4], [.95, .78], [.7, 1.12], [.42, 1.42]].forEach(([w, h], k) => this.caixa(x, y + h * s, z, w * s, .36 * s, w * s, tons[k % 2 ? 1 : 0]));
      this.caixa(x, y + 1.78 * s, z, .18 * s, .22 * s, .18 * s, tons[2]);
      return this;
    }
    if (tipo === 'cipreste') {
      this.caixa(x, y, z, .16 * s, .3 * s, .16 * s, tronco);
      this.caixa(x, y + .25 * s, z, .55 * s, 1.5 * s, .55 * s, tons[1]).caixa(x, y + .55 * s, z, .68 * s, .8 * s, .68 * s, tons[0]).caixa(x, y + 1.75 * s, z, .3 * s, .3 * s, .3 * s, tons[2]);
      return this;
    }
    if (tipo === 'arbusto') {
      this.caixa(x, y, z, .8 * s, .45 * s, .7 * s, tons[0]).caixa(x + .3 * s, y, z + .2 * s, .5 * s, .55 * s, .5 * s, tons[1]).caixa(x - .25 * s, y + .3 * s, z - .1 * s, .45 * s, .3 * s, .45 * s, tons[2]);
      if (fruta) this.caixa(x + .1 * s, y + .5 * s, z + .2 * s, .12, .12, .12, fruta);
      return this;
    }
    // Copa das referências voxel (Paulo, 09/11/2026: "rico em detalhe"): pé alargado, tronco com um galho e a copa
    // arredondada em camadas (mais escura embaixo, clara em cima), com tufos em volta e brotos claros no topo.
    const escuro = tom(.01, .04, -.12), claro = tom(-.03, -.02, .12);
    this.caixa(x, y, z, .3 * s, .1 * s, .3 * s, '#5E3F2B').caixa(x, y, z, .19 * s, .78 * s, .19 * s, tronco);
    this.caixa(x + .16 * s, y + .48 * s, z + .04 * s, .22 * s, .09 * s, .09 * s, tronco);
    this.caixa(x, y + .56 * s, z, 1.0 * s, .2 * s, .92 * s, escuro);
    this.caixa(x, y + .7 * s, z, 1.28 * s, .34 * s, 1.18 * s, tons[0]);
    this.caixa(x + .03 * s, y + 1.0 * s, z - .02 * s, 1.08 * s, .26 * s, 1.1 * s, tons[1]);
    this.caixa(x - .04 * s, y + 1.22 * s, z + .03 * s, .74 * s, .2 * s, .7 * s, tons[2]);
    [[.62, 0], [-.6, .08], [.06, .6], [-.04, -.6], [.44, .44], [-.46, -.4], [.42, -.44], [-.4, .46]].forEach(([a2, b2], k) =>
      this.caixa(x + a2 * s, y + (.64 + (k % 3) * .1) * s, z + b2 * s, .42 * s, .36 * s, .42 * s, k % 2 ? escuro : tons[k % 3]));
    for (const [a2, b2, h] of [[.2, .1, 1.4], [-.18, -.14, 1.36], [.02, -.24, 1.32]]) this.caixa(x + a2 * s, y + h * s, z + b2 * s, .26 * s, .14 * s, .26 * s, claro);
    if (fruta) for (const [a2, b2] of [[.3, .62], [-.66, .1], [.1, -.62], [.6, -.2]]) this.caixa(x + a2 * s, y + .9 * s, z + b2 * s, .1, .1, .1, fruta);
    return this;
  }
  // Árvore sorteada pela posição (sempre a mesma no mesmo lugar): mistura de espécies, tamanhos e verdes.
  arvoreVariada(x, y, z, k, { s = 1, tipos = ['copa', 'copa', 'ipe', 'coqueiro', 'pinheiro', 'cipreste', 'arbusto'] } = {}) {
    const r = (n) => { const v = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
    const tipo = tipos[Math.floor(r(1) * tipos.length)], verde = ['#5FA34E', '#6BAF52', '#4F9A4E', '#78B85A', '#5A9B47'][Math.floor(r(2) * 5)];
    return this.arvore(x, y, z, { s: s * (.75 + r(3) * .6), cor: verde, tipo, florida: r(4) > .5 ? '#F2C230' : '#E87FB0', fruta: tipo === 'copa' && r(5) > .8 ? '#F2A33A' : null });
  }
  pessoa(x, y, z, { roupa = '#3A6EA5', calca = '#2B2F33', pele = '#C68E6A', cabelo = '#2B1D14' } = {}) {
    this.caixa(x, y, z, .16, .26, .1, calca).caixa(x, y + .26, z, .2, .26, .12, roupa).caixa(x, y + .52, z, .14, .14, .14, pele).caixa(x, y + .64, z, .15, .05, .15, cabelo);
    return this;
  }
  carro(x, y, z, { cor = '#E5484D', girar = false } = {}) {
    const [w, d] = girar ? [.5, 1] : [1, .5];
    this.caixa(x, y + .08, z, w, .22, d, cor).caixa(x, y + .3, z, w * (girar ? 1 : .6), .18, d * (girar ? .6 : 1), '#BFD9E2');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.caixa(x + a * w * .32, y, z + b * d * .32, .14, .14, .14, '#1F1D1A');
    return this;
  }
  // Monta as duas malhas. 'raiz' recebe posição/rotação da sede inteira.
  // pedacos: divide os blocos numa grade de pedacos × pedacos pelo centro de cada um (só para obras grandes, como o
  // chão do Centro). Cada pedaço tem o próprio limite e a placa de vídeo pula os que estão fora da tela (de perto,
  // desenha só o pedaço à vista, inclusive na sombra).
  montar({ sombra = true, pedacos = 1 } = {}) {
    const raiz = new THREE.Group();
    const umaMalha = (lista, material, s) => {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, lista.length);
      const m = new THREE.Matrix4(), c = new THREE.Color();
      lista.forEach((b, k) => { m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.y + b.h / 2, b.z); mesh.setMatrixAt(k, m); mesh.setColorAt(k, c.set(b.cor)); });
      mesh.castShadow = s; mesh.receiveShadow = true; mesh.computeBoundingSphere();
      raiz.add(mesh);
    };
    const unir = (lista, material, s) => {
      if (!lista.length) return;
      if (pedacos < 2 || lista.length < 400) { umaMalha(lista, material, s); return; }
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const b of lista) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z); }
      const grupos = new Map(), passo = (v, a, b2) => Math.min(pedacos - 1, Math.floor((v - a) / Math.max(1e-6, b2 - a) * pedacos));
      for (const b of lista) { const k = passo(b.x, x0, x1) * pedacos + passo(b.z, z0, z1); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(b); }
      for (const g of grupos.values()) umaMalha(g, material, s);
    };
    unir(this.solidos, materialVoxel(), sombra);
    unir(this.luzes, new THREE.MeshBasicMaterial({ toneMapped: false }), false);
    unir(this.aguas, materialAgua(), false);
    if (this.sombras.length) {
      const pl = new THREE.PlaneGeometry(1, 1); pl.rotateX(-Math.PI / 2);
      const mesh = new THREE.InstancedMesh(pl, materialSombra(), this.sombras.length), m = new THREE.Matrix4();
      this.sombras.forEach((b, k) => { m.makeScale(b.r * 2.2, 1, b.r * 2.2); m.setPosition(b.x, b.y + .015, b.z); mesh.setMatrixAt(k, m); });
      mesh.renderOrder = 1; mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.sombraDeContato = true; raiz.add(mesh);
    }
    return raiz;
  }
}
