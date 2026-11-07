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
  arvore(x, y, z, { s = 1, cor = '#5FA34E', fruta = null } = {}) {
    this.caixa(x, y, z, .18 * s, .7 * s, .18 * s, '#7A5534');
    this.caixa(x, y + .55 * s, z, .9 * s, .6 * s, .9 * s, cor);
    this.caixa(x, y + 1.1 * s, z, .55 * s, .35 * s, .55 * s, cor);
    if (fruta) for (const [a, b] of [[.3, .46], [-.46, .1], [.1, -.46]]) this.caixa(x + a * s, y + .85 * s, z + b * s, .1, .1, .1, fruta);
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
    unir(this.solidos, new THREE.MeshStandardMaterial({ roughness: .82 }), sombra);
    unir(this.luzes, new THREE.MeshBasicMaterial({ toneMapped: false }), false);
    return raiz;
  }
}
