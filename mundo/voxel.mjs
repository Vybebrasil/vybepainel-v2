// Caixa de ferramentas voxel: uma "obra" junta milhares de blocos em duas
// InstancedMesh (peças com luz e sombra + peças que brilham), com letreiro em
// letras de blocos. Assim cada sede tem detalhe fino sem pesar.
import * as THREE from 'three';

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
export function voxelizar(material, { tam = 0.1, amp = 0.22, grade = 1, borda = true } = {}) {
  material.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVxPos; varying vec3 vVxNor; varying vec3 vVxLoc; varying vec3 vVxEsc;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_INSTANCING
  mat4 vxM = modelMatrix * instanceMatrix;
#else
  mat4 vxM = modelMatrix;
#endif
  vVxPos = (vxM * vec4(transformed, 1.0)).xyz;
  vVxNor = normalize(mat3(vxM) * objectNormal);
  vVxLoc = position;
  vVxEsc = vec3(length(vxM[0].xyz), length(vxM[1].xyz), length(vxM[2].xyz));`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVxPos; varying vec3 vVxNor; varying vec3 vVxLoc; varying vec3 vVxEsc;')
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
${borda ? `  vec3 vxL = (0.5 - abs(vVxLoc)) * vVxEsc;
  float vxE = 1e3;
  if (vxA.x < 0.5) vxE = min(vxE, vxL.x);
  if (vxA.y < 0.5) vxE = min(vxE, vxL.y);
  if (vxA.z < 0.5) vxE = min(vxE, vxL.z);
  float vxQ = smoothstep(0.0, 0.03 + fwidth(vxE), vxE);
  diffuseColor.rgb *= mix(0.74, 1.0, vxQ) * (1.0 + step(0.5, vxN.y) * 0.05);
  float vxB = (vVxLoc.y + 0.5) * vVxEsc.y;
  diffuseColor.rgb *= mix(0.8, 1.0, clamp(smoothstep(0.0, 0.2, vxB) + step(0.5, vxA.y), 0.0, 1.0));` : ''}
}`);
  };
  material.customProgramCacheKey = () => `voxel:${tam}:${amp}:${grade}:${borda}`;
  return material;
}
// Material único das caixas do mundo (uma compilação só para casas, árvores, sedes, prédio e salas).
let matCaixa = null;
// Centro comercial (08/11/2026): a grade é de 1 bloco (antes 10 cm, o que virava "500 quadradinhos" em cada face).
export const materialVoxel = () => (matCaixa ||= voxelizar(new THREE.MeshStandardMaterial({ roughness: .82 }), { tam: 1, amp: .16, grade: .55 }));

export class Obra {
  constructor() { this.solidos = []; this.luzes = []; }
  caixa(x, y, z, w, h, d, cor) { this.solidos.push({ x, y, z, w, h, d, cor }); return this; }
  luz(x, y, z, w, h, d, cor) { this.luzes.push({ x, y, z, w, h, d, cor }); return this; }
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
  // Árvore em blocos (copa em dois andares, frutinhas opcionais).
  // Copa em cachos (miolo + seis cachos + topo, em três verdes), como nas árvores da cidade.  
  arvore(x, y, z, { s = 1, cor = '#5FA34E', fruta = null } = {}) {
    const c0 = new THREE.Color(cor), tons = [c0, c0.clone().offsetHSL(.02, .05, -.07), c0.clone().offsetHSL(-.02, 0, .06)].map((c) => '#' + c.getHexString());
    this.caixa(x, y, z, .18 * s, .75 * s, .18 * s, '#6E4B33');
    this.caixa(x, y + .55 * s, z, .95 * s, .62 * s, .95 * s, tons[0]);
    [[.4, 0, .1], [-.4, 0, 0], [0, .4, .05], [0, -.4, .14], [.24, .22, .34], [-.24, -.2, .3]].forEach(([a, b, c], k) => this.caixa(x + a * s, y + (.55 + c) * s, z + b * s, .52 * s, .48 * s, .52 * s, tons[k % 3]));
    this.caixa(x, y + 1.12 * s, z, .5 * s, .28 * s, .5 * s, tons[2]);
    if (fruta) for (const [a, b] of [[.3, .52], [-.52, .1], [.1, -.52]]) this.caixa(x + a * s, y + .85 * s, z + b * s, .1, .1, .1, fruta);
    return this;
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
  montar({ sombra = true } = {}) {
    const raiz = new THREE.Group();
    const unir = (lista, material, s) => {
      if (!lista.length) return;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, lista.length);
      const m = new THREE.Matrix4(), c = new THREE.Color();
      lista.forEach((b, k) => { m.makeScale(b.w, b.h, b.d); m.setPosition(b.x, b.y + b.h / 2, b.z); mesh.setMatrixAt(k, m); mesh.setColorAt(k, c.set(b.cor)); });
      mesh.castShadow = s; mesh.receiveShadow = true;
      raiz.add(mesh);
    };
    unir(this.solidos, materialVoxel(), sombra);
    unir(this.luzes, new THREE.MeshBasicMaterial({ toneMapped: false }), false);
    return raiz;
  }
}
