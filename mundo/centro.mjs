// Centro comercial da Vybe (Paulo, 08/11/2026): no lugar de Irecê inteira, uma maquete pequena flutuando no céu,
// com o Prédio da Vybe no meio, um jardim em volta e uma loja por cliente ativo no anel de fora, de frente para o
// prédio. Em cima de cada loja, o nome e as bolinhas de status na cor do painel (ex.: azul 1 = em aprovação).
//
// Voxel do jeito certo: cada bloco é um bloco. O chão, a terra e a pedra são poucas caixas grandes; a grade de
// 1 bloco e a variação de tom vêm do shader (voxelizar), sem milhares de cubinhos de 10 cm. Tudo que é sólido sai
// em uma InstancedMesh (Obra) e tudo que brilha em outra: o centro inteiro custa poucas chamadas de desenho.
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { ruido } from './irece.mjs';
import { NICHOS, nichoDoCliente, identidadeDoCliente, paletaDaLoja } from './nichos.mjs';
import { desenharBoneco, figuraDaPessoa, lerFigura } from './avatar.mjs';

export const PASSO = 6;          // distância entre lojas vizinhas
const LW = 5, LD = 4.6;          // largura e fundo de cada loja
const CHAO = 0.12;               // altura das calçadas sobre a grama
const PASTEIS = ['#F6E7C8', '#DCEFE3', '#FBDCCB', '#D8E8F5', '#E9DDF4', '#F7D9E3', '#E3F0C8', '#FDEBB5'];
const TOLDOS = ['#FF7A2F', '#18A957', '#0D74CE', '#8E4EC6', '#D6409F', '#E2A11B', '#12A594', '#E5484D'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tamanho da maquete pelo número de clientes: no mínimo 8 lojas por lado.
export function layoutDoCentro(n = 0) {
  const porLado = Math.max(8, Math.ceil(n / 4));
  const meio = (porLado * PASSO) / 2;
  const R = meio + 4.5;            // do centro até a fachada das lojas
  const S = R + LD + 7;            // meia largura da maquete
  return { porLado, meio, R, S };
}

// Vaga de cada loja: posição do centro da loja, lado (0 norte, 1 leste, 2 sul, 3 oeste) e a frente olhando para o meio.
export function vagasDoCentro(n) {
  const L = layoutDoCentro(n), lista = [], c = L.R + LD / 2;
  const slots = Array.from({ length: L.porLado }, (_, j) => -L.meio + PASSO * (j + .5)).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  for (let i = 0; i < n; i++) {
    const lado = i % 4, k = Math.floor(i / 4);
    // Distribui do meio de cada lado para as pontas: as primeiras lojas ficam de frente para o prédio.
    const t = slots[k];
    const [x, z] = [[t, -c], [c, t], [-t, c], [-c, -t]][lado];
    const [fx, fz] = [[t, -L.R], [L.R, t], [-t, L.R], [-L.R, -t]][lado];
    lista.push({ x, z, lado, frente: { x: fx, z: fz } });
  }
  return lista;
}

// Coordenada local da loja (lx ao longo da fachada, lz para a frente) para o mundo, girando de 90 em 90 graus.
function paraMundo(v, lx, lz, w, d) {
  const [x, z, W, D] = [[lx, lz, w, d], [-lz, lx, d, w], [-lx, -lz, w, d], [lz, -lx, d, w]][v.lado];
  return { x: v.x + x, z: v.z + z, w: W, d: D };
}

export function construirCentro(motor, { quantos = 32 } = {}) {
  const T = motor.THREE || THREE;
  let L = layoutDoCentro(quantos);
  let postes = [], finoMalha = null;
  let chao = null, lojas = null, rotulos = [], alvos = [], posicoes = [], ilhotas = [], nuvensMalha = null, estadosDasLojas = [], cachoeira = null, chafariz = null;

  function montarChao() {
    if (chao) { motor.cena.remove(chao); chao.traverse((o) => { o.geometry?.dispose?.(); }); }
    const { S, R } = L, o = new Obra(), g = new T.Group(); postes = [];
    // A maquete é uma ilha flutuante (Paulo, 08/11/2026: "o acabamento reto todo igual flutuando"): o gramado em cima e,
    // embaixo, colunas de terra e pedra que afundam mais para o meio, como um cone irregular em degraus, com faixas de
    // terra em tons diferentes, pedra escurecendo com a profundidade e pedras penduradas. Colunas de 3 × 3.
    o.caixa(0, -1, 0, 2 * S, 1, 2 * S, '#74B95A');
    const fino = new Obra(), CEL = 4, n = Math.ceil(2 * S / CEL), TERRA = ['#8A5A3B', '#7E5135', '#946240'], PEDRA = ['#8E8A84', '#827E78', '#77736E', '#6B6762'];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = -S + i * CEL, z0 = -S + j * CEL, w = Math.min(CEL, S - x0), d = Math.min(CEL, S - z0), cx = x0 + w / 2, cz = z0 + d / 2;
      const borda = Math.min(S - Math.abs(cx), S - Math.abs(cz)), centro = Math.max(0, 1 - Math.hypot(cx, cz) / (S * 1.25));
      const k = ruido(i * 3.1 + 5, j * 2.7 + 1), prof = 1.6 + Math.pow(centro, .75) * 17 + Math.min(borda, 6) * .35 + k * 2.6;
      const terra = Math.min(prof, 2 + k * 1.2);
      fino.caixa(cx, -1 - terra, cz, w, terra, d, TERRA[Math.floor(k * 3) % 3]);
      if (terra > 1.6) fino.caixa(cx, -1.8 - k * .3, cz, w + .02, .22, d + .02, '#6E4730'); // veio escuro na terra
      const pedra = prof - terra;
      if (pedra > .2) fino.caixa(cx, -1 - prof, cz, w - .02, pedra, d - .02, PEDRA[Math.min(3, Math.floor(prof / 5))]);
      // Pedra pendurada embaixo de algumas colunas.
      if (k > .82) fino.caixa(cx + (k - .9) * 2, -1 - prof - (1 + k * 2), cz, w * .5, 1 + k * 2, d * .5, PEDRA[3]);
    }
    // Franja de grama caindo pela borda e alguns blocos de pedra soltos embaixo.
    for (let i = -S + .5; i < S; i += 1) for (const [a, b] of [[i, -S + .5], [i, S - .5], [-S + .5, i], [S - .5, i]]) {
      const k = ruido(a * 3 + 7, b * 5 + 11);
      if (k > .55) o.caixa(a, -1 - .35 - k * .3, b, 1.02, .5 + k * .5, 1.02, k > .8 ? '#5E9E47' : '#6AAE51');
    }
    // Calçada do anel das lojas, a praça do prédio e as quatro alamedas em cruz.
    const anelI = R - 3.2;
    for (const [x, z, w, d] of [[0, -(R - 1.6), 2 * R, 3.2], [0, R - 1.6, 2 * R, 3.2], [-(R - 1.6), 0, 3.2, 2 * R - 6.4], [R - 1.6, 0, 3.2, 2 * R - 6.4]]) o.caixa(x, 0, z, w, CHAO, d, '#DCD3C2');
    o.caixa(0, 0, 0, 26, CHAO, 26, '#E8E0D0');
    const alamedas = [[0, -(13 + anelI) / 2, 4, anelI - 13], [0, (13 + anelI) / 2, 4, anelI - 13], [-(13 + anelI) / 2, 0, anelI - 13, 4], [(13 + anelI) / 2, 0, anelI - 13, 4]];
    for (const [x, z, w, d] of alamedas) o.caixa(x, 0, z, w, CHAO, d, '#E2D9C8');
    // Piso de pedra (referências de 09/11/2026): a praça em ladrilhos com anéis de tom em volta do prédio, as
    // alamedas e a calçada do anel em ladrilhos com a guia mais escura nas bordas. Só a camada fina (sem sombra).
    const PEDRAS = ['#E8E0D0', '#DED4C2', '#F0E9DC', '#D6CBB8'];
    const ladrilhos = (x0, z0, w, d, cor) => {
      for (let i = 0; i < Math.round(w); i++) for (let j = 0; j < Math.round(d); j++) {
        const cx = x0 + i + .5, cz = z0 + j + .5;
        fino.caixa(cx, CHAO, cz, .9, .025, .9, cor(cx, cz, i, j));
      }
    };
    ladrilhos(-13, -13, 26, 26, (cx, cz) => { const anel = Math.floor(Math.max(Math.abs(cx), Math.abs(cz))); const k = ruido(cx * 1.3 + 2, cz * 1.7 + 5); return anel % 4 === 3 ? '#CDBFA8' : PEDRAS[k > .8 ? 2 : k > .45 ? 0 : 1]; });
    for (const [x, z, w, d] of alamedas) ladrilhos(x - w / 2, z - d / 2, w, d, (cx, cz, i, j) => {
      const borda = w < d ? i === 0 || i === Math.round(w) - 1 : j === 0 || j === Math.round(d) - 1;
      return borda ? '#C9BCA6' : PEDRAS[Math.floor(ruido(cx * 2.1, cz * 1.9) * 3) % 3 + 1];
    });
    // Fundo das lojas: um bosque em grupos (não mais uma fila de árvores iguais): espécies, alturas e verdes misturados,
    // clareiras de vez em quando e arbustos entre as árvores.
    for (let i = -S + 2.5; i <= S - 2.5; i += 3.1) for (const [lado, a, b] of [[0, i, -(S - 3.4)], [1, i, S - 3.4], [2, -(S - 3.4), i], [3, S - 3.4, i]]) {
      const k = ruido(a * .7 + lado * 13, b * .7 + 31);
      if (k < .2) continue; // clareira
      if (lado === 2 && Math.abs(b - (-S + 7.5)) < 2.6) continue; // o laguinho da cachoeira
      const fora = (ruido(b + 3, a) - .5) * 2.2, [px, pz] = lado < 2 ? [a + (k - .5) * 1.2, b + fora] : [a + fora, b + (k - .5) * 1.2];
      if (k < .36) o.arvore(px, 0, pz, { s: 1.4 + k, tipo: 'arbusto', cor: ['#5FA34E', '#6BAF52', '#4F9A4E'][Math.floor(k * 30) % 3], fruta: k > .3 ? '#E5484D' : null });
      else o.arvoreVariada(px, 0, pz, Math.round(a * 31 + b * 17), { s: 2.3 });
    }
    jardins(o, anelI, fino);
    // Postes na calçada do anel, com a luz acesa.
    for (let i = -L.meio + PASSO; i < L.meio; i += PASSO * 2) for (const [a, b] of [[i, -(R - 3.4)], [i, R - 3.4], [-(R - 3.4), i], [R - 3.4, i]]) {
      o.caixa(a, CHAO, b, .22, 3, .22, '#4A4F55'); o.luz(a, CHAO + 3, b, .5, .35, .5, '#FFE7B0'); postes.push({ x: a, z: b });
    }
    detalhes(o, L, fino);
    g.add(o.montar({ pedacos: 3 }));
    // Ilha, sebes, tufos e manchas recebem sombra mas não projetam: ficam fora do cálculo da sombra (desempenho).
    finoMalha = fino.montar({ sombra: false, pedacos: 3 }); g.add(finoMalha);
    // Ilhotas flutuando em volta da maquete (Paulo, 08/11/2026: "mais vivo, detalhado"); a vida (vida.mjs) as balança.
    ilhotas = [[S + 13, 3, -S * .35, 1], [-S * .45, -2.5, S + 12, .8]].map(([ix, iy, iz, k]) => {
      const q = new Obra(), w = 6 * k;
      q.caixa(0, -.6, 0, w, .6, w, '#74B95A').caixa(0, -1.8, 0, w - .4, 1.2, w - .4, '#8A5A3B').caixa(0, -3, 0, w - 2, 1.2, w - 2, '#8E8A84').caixa(0, -3.8, 0, w - 3.6, .8, w - 3.6, '#7E7A75');
      q.arvore(-w * .18, 0, -w * .1, { s: 1.5 * k, cor: '#5FA34E', fruta: '#F2A33A' });
      q.caixa(w * .2, 0, w * .18, 1.2 * k, .3, .5 * k, '#C99A6B').caixa(w * .2, .3, w * .18 - .2 * k, 1.2 * k, .35, .1, '#C99A6B');
      for (const [a, b, c] of [[.3, -.3, '#E5484D'], [-.3, .3, '#F2C14E'], [.1, .35, '#FFFFFF']]) q.caixa(a * w, 0, b * w, .25, .25, .25, c);
      const m = q.montar(); m.position.set(ix, iy, iz); m.userData.y0 = iy; g.add(m);
      return m;
    });
    // Nuvens de blocos paradas no céu (não animam: o centro só redesenha quando algo muda).
    const nuvem = new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .92 });
    const cubo = new T.BoxGeometry(1, 1, 1), nuvens = [];
    for (let k = 0; k < 7; k++) {
      // Em volta da maquete, nunca por cima dela (não tapam as lojas em nenhuma vista).
      const ang = k / 7 * Math.PI * 2 + ruido(k, 41) * .6, raio = S * (1.35 + ruido(41, k) * .35);
      const cx = Math.cos(ang) * raio, cz = Math.sin(ang) * raio, cy = 4 + ruido(k, k + 3) * 10;
      const larg = 9 + ruido(k, 5) * 7;
      nuvens.push([cx, cy, cz, larg, 1.2, larg * .55]);
      for (let p = 0; p < 4; p++) { const r = ruido(p + k, k), tam = 2.4 + r * 3.2; nuvens.push([cx + (p - 1.5) * larg * .24, cy + 1 + r * .8, cz + (ruido(k, p) - .5) * 2, tam, tam * .8, tam]); }
      nuvens.push([cx - larg * .1, cy + 2.6, cz, larg * .3, 1.6, larg * .25]);
    }
    const inst = new T.InstancedMesh(cubo, nuvem, nuvens.length), m4 = new T.Matrix4();
    nuvens.forEach(([x, y, z, w, h, d], i) => { m4.makeScale(w, h, d).setPosition(x, y, z); inst.setMatrixAt(i, m4); });
    inst.computeBoundingSphere(); g.add(inst); nuvensMalha = inst;
    chao = g; motor.adicionar(g);
  }

  // Os quatro jardins entre as alamedas (Paulo, 08/11/2026: "as áreas verdes tão muito pobres"). Cada um é um L em volta
  // da praça: sebes contornando os caminhos (com passagens), fileiras de árvores nos braços e, na quina grande, um
  // lugar diferente em cada jardim: o lago com deque, o parquinho, o coreto e o piquenique. Antes as árvores e o lago
  // caíam embaixo da praça do prédio e não apareciam.
  function jardins(o, anelI, fino = o) {
    const FLORES = ['#E5484D', '#F2C14E', '#D6409F', '#FFFFFF', '#8E4EC6', '#FF7A2F'];
    const fim = anelI - .6, meio = (13 + anelI) / 2;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], q) => {
      // (u, w): distância do eixo em x e em z, sempre positiva; vira mundo pelo sinal do jardim.
      const C = (u, y, w, du, h, dw, cor) => o.caixa(sx * u, y, sz * w, du, h, dw, cor);
      const arvore = (u, w, k) => o.arvoreVariada(sx * u, 0, sz * w, Math.round(u * 13 + w * 7 + q * 101 + k), { s: 1.9 });
      // Sebes baixas contornando o jardim, com uma passagem a cada 6 blocos.
      const sebe = (u0, w0, u1, w1) => {
        const n = Math.round(Math.hypot(u1 - u0, w1 - w0));
        for (let k = 0; k <= n; k++) {
          if (k % 6 === 3) continue;
          const u = u0 + (u1 - u0) * k / Math.max(1, n), w = w0 + (w1 - w0) * k / Math.max(1, n);
          fino.caixa(sx * u, 0, sz * w, 1, .5 + (k % 3 === 0 ? .08 : 0), 1, k % 2 ? '#4C8F3F' : '#55993F');
          if (k % 4 === 1) fino.caixa(sx * u, .5, sz * w, .22, .18, .22, FLORES[(k + q) % FLORES.length]);
        }
      };
      sebe(2.6, 13.6, 2.6, fim); sebe(13.6, 2.6, fim, 2.6);       // ao longo das alamedas
      sebe(2.6, 13.6, 12.4, 13.6); sebe(13.6, 2.6, 13.6, 12.4);   // ao longo da praça
      sebe(fim, 3.2, fim, fim); sebe(3.2, fim, fim - .6, fim);     // ao longo do anel das lojas
      // Braços do L: fileira de árvores, faixa de flores e um par de bancos.
      for (const [k, u] of [4.6, 8.2, 11.6].entries()) { arvore(u, meio + (k % 2 ? 1.6 : -1.4), k); arvore(meio + (k % 2 ? -1.4 : 1.6), u, k + 1); }
      for (let k = 0; k < 8; k++) { C(3.6 + k * 1.1, 0, meio + 3.2, .5, .18, .5, '#7A5236'); C(3.6 + k * 1.1, .18, meio + 3.2, .32, .26, .32, FLORES[(k + q) % FLORES.length]); }
      for (let k = 0; k < 8; k++) { C(meio - 3.4, 0, 3.6 + k * 1.1, .5, .18, .5, '#7A5236'); C(meio - 3.4, .18, 3.6 + k * 1.1, .32, .26, .32, FLORES[(k + q + 2) % FLORES.length]); }
      // Quina grande: um lugar diferente por jardim.
      const cu = meio + 1.2, cw = meio + 1.2;
      if (q === 0) {
        // Lago com borda de pedra, deque de madeira, vitórias-régias, patinhos e taboas.
        C(cu, -.2, cw, 6.4, .3, 5.2, '#B9B2A6'); o.agua(sx * cu, -.15, sz * cw, 5.6, .3, 4.4, '#4FB6E3');
        C(cu - 2.6, .1, cw, 2.4, .12, 1.2, '#B98552'); for (const k of [-.9, .9]) C(cu - 2.6 + k, -.3, cw + .5, .14, .45, .14, '#8E6440');
        for (const [du, dw] of [[.8, -1], [1.8, .6], [-.4, 1.2]]) C(cu + du, .12, cw + dw, .7, .05, .7, '#7FCB6A');
        for (const [du, dw] of [[.4, .2], [1.2, -.4]]) { C(cu + du, .12, cw + dw, .32, .22, .45, '#FFFFFF'); C(cu + du, .3, cw + dw + .18, .2, .2, .2, '#FFFFFF'); C(cu + du, .36, cw + dw + .3, .1, .06, .1, '#F2A33A'); }
        for (let k = 0; k < 6; k++) C(cu + 2.9, 0, cw - 2 + k * .7, .12, .7 + (k % 3) * .2, .12, '#6E8B3D');
      } else if (q === 1) {
        // Parquinho: piso emborrachado, escorregador, balanço, gangorra e caixa de areia.
        C(cu, 0, cw, 6.4, .06, 6, '#F2A07A');
        C(cu - 1.6, 0, cw - 1.4, 1, 1.6, 1, '#0D74CE'); C(cu - 1.6, 1.6, cw - 1.4, 1.2, .12, 1.2, '#F2C14E');
        for (let k = 0; k < 6; k++) C(cu - 1.6, 1.4 - k * .26, cw - .6 + k * .32, .8, .12, .34, '#E5484D');
        for (const k of [-1, 1]) C(cu + 1.6 + k * 1.1, 0, cw - 1.6, .14, 1.8, .14, '#4A4F55'); C(cu + 1.6, 1.8, cw - 1.6, 2.4, .14, .14, '#4A4F55');
        for (const k of [-.5, .5]) { C(cu + 1.6 + k, .7, cw - 1.6, .05, 1.1, .05, '#9AA3A8'); C(cu + 1.6 + k, .6, cw - 1.6, .5, .08, .3, '#18A957'); }
        C(cu + 1.4, .3, cw + 1.6, 2.8, .12, .3, '#8E4EC6'); C(cu + 1.4, 0, cw + 1.6, .3, .3, .3, '#4A4F55');
        C(cu - 1.6, 0, cw + 1.6, 2.2, .25, 2.2, '#B98552'); C(cu - 1.6, .1, cw + 1.6, 1.9, .2, 1.9, '#F2DDA4');
      } else if (q === 2) {
        // Coreto: base de pedra com degrau, colunas brancas, telhado laranja em degraus e bancos em volta.
        C(cu, 0, cw, 5, .3, 5, '#E8E0D0'); C(cu, .3, cw, 4.4, .12, 4.4, '#F4F1EA');
        for (const [du, dw] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9], [0, -1.9], [0, 1.9], [-1.9, 0], [1.9, 0]]) C(cu + du, .42, cw + dw, .26, 2.2, .26, '#FFFFFF');
        for (const [w, y] of [[5, 2.62], [3.8, 2.92], [2.4, 3.2], [1, 3.46]]) C(cu, y, cw, w, .3, w, '#FF7A2F');
        C(cu, 3.76, cw, .3, .4, .3, '#F2C14E');
        for (const [du, dw] of [[-3.2, 0], [3.2, 0], [0, 3.2]]) C(cu + du, 0, cw + dw, du ? .5 : 2, .45, du ? 2 : .5, '#B98552');
      } else {
        // Piquenique: mesas com bancos, toalhas xadrez, cesta e guarda-sol.
        for (const [du, dw] of [[-1.6, -1.2], [1.6, 1.2]]) {
          C(cu + du, .62, cw + dw, 2, .1, 1, '#B98552'); for (const k of [-.7, .7]) C(cu + du + k, 0, cw + dw, .12, .62, .9, '#8E6440');
          for (const k of [-1, 1]) C(cu + du, .38, cw + dw + k * .85, 2, .08, .32, '#B98552');
          for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) C(cu + du - .6 + i * .4, .72, cw + dw - .2 + j * .4, .4, .02, .4, (i + j) % 2 ? '#E5484D' : '#FFFFFF');
          C(cu + du + .5, .74, cw + dw, .32, .22, .24, '#C9773E');
          C(cu + du, 0, cw + dw, .08, 2.2, .08, '#4A4F55'); C(cu + du, 2.2, cw + dw, 2, .1, 2, q % 2 ? '#38D9C5' : '#F2C14E'); C(cu + du, 2.3, cw + dw, 1.1, .1, 1.1, '#FFFFFF');
        }
      }
      // Árvores grandes nas pontas da quina e um caminho de pedras até ela.
      for (const [du, dw, k] of [[3.6, -3.4, 0], [-3.4, 3.6, 1], [3.8, 3.8, 2]]) if (cu + du < fim - .8 && cw + dw < fim - .8) arvore(cu + du, cw + dw, k);
      for (let k = 0; k < 5; k++) C(13.9 + k * 1.05, .0, 13.9 + k * 1.05, .7, .1, .7, '#CFC6B4');
    });
  }

  // Detalhe do diorama: tufos, flores e pedrinhas na grama, lixeiras e bandeirolas no anel, o chafariz e o food
  // truck na praça, o laguinho com a cachoeira caindo da borda e raízes penduradas embaixo da maquete.
  function detalhes(o, L, fino = o) {
    const { S, R } = L, anelI = R - 3.2, borda = R + LD + .6;
    const grama = (x, z) => {
      const ax = Math.abs(x), az = Math.abs(z);
      if (ax > S - 1 || az > S - 1) return false;
      if (ax < anelI - .6 && az < anelI - .6) return !(ax < 13.6 && az < 13.6) && ax > 2.7 && az > 2.7 && !(ax > 13 && ax < 18 && az > 13 && az < 18);
      return ax > borda || az > borda;
    };
    // Manchas de grama em outros tons (o gramado não é uma cor só).
    for (let x = -S + 3; x < S - 3; x += 4.3) for (let z = -S + 3; z < S - 3; z += 4.3) {
      const k = ruido(x * .37 + 11, z * .41 + 2), px = x + (k - .5) * 2, pz = z + (ruido(z, x + 4) - .5) * 2;
      if (k < .45 || !grama(px, pz)) continue;
      fino.caixa(px, 0, pz, 2 + k * 2.4, .03, 1.6 + k * 2, k > .75 ? '#86C46A' : k > .6 ? '#68AD50' : '#7DBE60');
    }
    for (let x = -S + 1; x < S - 1; x += 1.55) for (let z = -S + 1; z < S - 1; z += 1.55) {
      const k = ruido(x * 1.7 + 3, z * 2.3 + 9), px = x + (ruido(z, x) - .5) * .8, pz = z + (ruido(x + 5, z) - .5) * .8;
      if (k < .5 || !grama(px, pz)) continue;
      if (k < .78) fino.caixa(px, 0, pz, .36, .14 + k * .1, .36, k < .64 ? '#5E9E47' : '#86C46A');
      else if (k < .93) { fino.caixa(px, 0, pz, .05, .22, .05, '#4F8F3E'); fino.caixa(px, .22, pz, .16, .14, .16, ['#E5484D', '#F2C14E', '#FFFFFF', '#D6409F', '#8E4EC6'][Math.floor(k * 97) % 5]); }
      else fino.caixa(px, 0, pz, .42, .18, .32, '#A8A29A');
    }
    // Lixeiras ao lado dos postes e bandeirolas entre eles.
    const cores = ['#FF7A2F', '#F2C14E', '#18A957', '#0D74CE', '#D6409F', '#FFFFFF'];
    for (let i = -L.meio + PASSO; i < L.meio; i += PASSO * 2) for (const [a, b, eixoX] of [[i, -(R - 3.4), 1], [i, R - 3.4, 1], [-(R - 3.4), i, 0], [R - 3.4, i, 0]]) {
      const [lx, lz] = eixoX ? [a + .5, b] : [a, b + .5];
      o.caixa(lx, CHAO, lz, .32, .5, .32, '#3E8F4E').caixa(lx, CHAO + .5, lz, .38, .06, .38, '#2E6B3A');
      if (i + PASSO * 2 < L.meio) for (let f = 1; f < 15; f++) {
        const d = f / 15 * PASSO * 2, cai = Math.sin(f / 15 * Math.PI) * .45;
        const [fx, fz] = eixoX ? [a + d, b] : [a, b + d];
        o.caixa(fx, CHAO + 2.75 - cai, fz, .05, .03, .05, '#4A4F55');
        if (f % 2) o.caixa(fx, CHAO + 2.42 - cai, fz, eixoX ? .32 : .04, .32, eixoX ? .04 : .32, cores[(f + Math.round(i)) % cores.length]);
      }
    }
    // Chafariz da praça: bacia de pedra, água, coluna e a taça de cima (o jato anima em vida.mjs).
    const [cx, cz] = [10.5, 10.5];
    o.caixa(cx, CHAO, cz, 3.4, .5, 3.4, '#CFC6B4').caixa(cx, CHAO + .5, cz, 3.6, .1, 3.6, '#E8E0D0');
    o.agua(cx, CHAO + .3, cz, 2.8, .22, 2.8, '#6CC6EA');
    o.caixa(cx, CHAO + .5, cz, .5, 1, .5, '#E8E0D0').caixa(cx, CHAO + 1.5, cz, 1.3, .2, 1.3, '#E8E0D0');
    o.agua(cx, CHAO + 1.62, cz, 1, .1, 1, '#8ED6F0');
    chafariz = { x: cx, y: CHAO + 1.7, z: cz };
    // Food truck laranja da Vybe com toldo, balcão e mesinha com guarda-sol.
    const [tx, tz] = [-10.5, 10.6];
    o.caixa(tx, CHAO + .35, tz, 3.2, 1.6, 1.6, '#FF7A2F').caixa(tx, CHAO + 1.95, tz, 3.1, .25, 1.5, '#FFFFFF');
    o.luz(tx + .2, CHAO + .95, tz + .81, 1.8, .7, .02, '#FFE2B0').caixa(tx + .2, CHAO + .9, tz + .95, 2, .08, .3, '#FFFFFF');
    for (let f = 0; f < 6; f++) o.caixa(tx - .8 + f * .4 + .2, CHAO + 1.72, tz + 1.1, .4, .08, .6, f % 2 ? '#FFFFFF' : '#E5484D');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.caixa(tx + a * 1.1, CHAO, tz + b * .7, .4, .4, .2, '#1F1D1A');
    o.letreiro('CAFE', { x: tx - 1.61, y: CHAO + 1.1, z: tz, px: .09, cor: '#FFFFFF' });
    o.caixa(tx + 3.1, CHAO, tz - .2, .08, .7, .08, '#4A4F55').caixa(tx + 3.1, CHAO + .7, tz - .2, .8, .06, .8, '#FFFFFF');
    o.caixa(tx + 3.1, CHAO, tz - .2, .06, 1.9, .06, '#4A4F55').caixa(tx + 3.1, CHAO + 1.9, tz - .2, 1.6, .1, 1.6, '#F2C14E').caixa(tx + 3.1, CHAO + 2, tz - .2, .9, .1, .9, '#FFFFFF');
    for (const s2 of [-1, 1]) o.caixa(tx + 3.1, CHAO, tz - .2 + s2 * .7, .36, .4, .36, '#5CC8B8');
    // Laguinho no fundo do anel, com a água caindo pela borda da maquete (as gotas animam em vida.mjs).
    const lz = -S + 4 + 3.5, lx = -(S - 1.6);
    o.caixa(lx, -.2, lz, 2.6, .3, 3.4, '#B9B2A6').caixa(lx - .3, -.2, lz, 2.4, .05, 2.6, '#4FB6E3'); o.agua(lx - .3, -.14, lz, 2.4, .3, 2.6, '#4FB6E3');
    o.luz(-S - .06, -9, lz, .1, 8.86, 2.2, '#8FD6F2').luz(-S - .1, -9, lz, .06, 8.86, 1.2, '#C9EEFA');
    o.caixa(-S - .4, -9.4, lz, 1.2, .5, 3.2, '#D9F3FB'); // a água se desfaz em névoa no ar
    cachoeira = { x: -S - .2, z: lz, topo: -.2, base: -9.2 };
  }

  // Uma loja: piso, corpo pastel, platibanda, vitrine, porta, toldo listrado na cor da loja e vasos.
  function loja(o, v, k) {
    const parede = PASTEIS[k % PASTEIS.length], toldo = TOLDOS[(k * 3) % TOLDOS.length];
    const C = (lx, y, lz, w, h, d, cor, luz = false) => { const p = paraMundo(v, lx, lz, w, d); (luz ? o.luz : o.caixa).call(o, p.x, y, p.z, p.w, h, p.d, cor); };
    C(0, 0, 0, LW + .6, CHAO, LD + .2, '#CFC6B4');
    C(0, CHAO, -.35, LW, 3.1, LD - .7, parede);
    C(0, 3.2, -.35, LW + .25, .32, LD - .45, '#FFFFFF');
    C(0, 3.52, LD / 2 - .95, LW - .4, .75, .22, '#FFFFFF');
    C(0, 3.56, LD / 2 - .82, LW - .7, .08, .02, toldo);
    C(-.75, .45, LD / 2 - .7, LW - 2.6, 1.7, .08, '#BFE0EC', true);
    C(-.75, .38, LD / 2 - .66, LW - 2.4, .1, .12, '#FFFFFF');
    C(LW / 2 - 1.05, CHAO, LD / 2 - .7, .95, 2.05, .1, '#6B4E3A');
    C(LW / 2 - .7, 1.1, LD / 2 - .6, .1, .1, .1, '#F2C14E');
    const faixas = 7, fw = LW / faixas;
    for (let f = 0; f < faixas; f++) C(-LW / 2 + fw * (f + .5), 2.38, LD / 2 - .2, fw, .16, 1.15, f % 2 ? '#FFFFFF' : toldo);
    for (const s of [-1, 1]) { C(s * (LW / 2 + .05), CHAO, LD / 2 + .05, .5, .45, .5, '#B5462F'); C(s * (LW / 2 + .05), CHAO + .45, LD / 2 + .05, .6, .6, .6, '#5FA34E'); }
  }

  // Vaga sem cliente (Paulo, 08/11/2026: "o mundo tá muito pobre"): tapume listrado laranja e branco da Vybe com a
  // placa "VAGA", um cone e um vaso; o anel fica completo e convida o Comercial a ocupar.
  function lojaFechada(o, v, k) {
    const C = (lx, y, lz, w, h, d, cor) => { const p = paraMundo(v, lx, lz, w, d); o.caixa(p.x, y, p.z, p.w, h, p.d, cor); };
    C(0, 0, 0, LW + .6, CHAO, LD + .2, '#CFC6B4');
    C(0, CHAO, -.6, LW - .4, 2.4, LD - 1.4, PASTEIS[(k + 3) % PASTEIS.length]);
    C(0, CHAO + 2.4, -.6, LW - .2, .2, LD - 1.2, '#FFFFFF');
    const faixas = 8, fw = (LW + .2) / faixas;
    for (let f = 0; f < faixas; f++) C(-(LW + .2) / 2 + fw * (f + .5), CHAO, LD / 2 - .3, fw, 1.6, .1, f % 2 ? '#FFFFFF' : '#FF7A2F');
    C(0, CHAO + 1.6, LD / 2 - .3, LW + .3, .1, .14, '#E8601E');
    C(0, CHAO + .55, LD / 2 - .2, 1.7, .7, .06, '#FFFFFF');
    // O letreiro nasce de frente para +z numa obra à parte e cada bloco gira com o lado da vaga.
    const placa = new Obra(); placa.letreiro('VAGA', { x: 0, y: CHAO + .9, z: 0, px: .1, cor: '#FF7A2F' });
    for (const b of placa.solidos) C(b.x, b.y, LD / 2 - .15 + b.z, b.w, b.h, b.d, b.cor);
    C(LW / 2 - .5, CHAO, LD / 2 + .1, .34, .1, .34, '#FFFFFF'); C(LW / 2 - .5, CHAO + .1, LD / 2 + .1, .24, .36, .24, '#FF7A2F'); C(LW / 2 - .5, CHAO + .3, LD / 2 + .1, .26, .06, .26, '#FFFFFF');
    C(-LW / 2 + .4, CHAO, LD / 2 + .1, .4, .36, .4, '#C9773E'); C(-LW / 2 + .4, CHAO + .36, LD / 2 + .1, .5, .44, .5, '#5FA34E');
  }
  const carregador = new T.TextureLoader();
  function logoNaPlaca(g, v, url, placa) {
    const mat = new T.MeshBasicMaterial({ transparent: true, toneMapped: false, color: '#FFFFFF' });
    const m = new T.Mesh(new T.PlaneGeometry(placa.w, placa.h), mat);
    const q = paraMundo(v, 0, placa.z + .01, 0, 0);
    m.position.set(q.x, placa.y, q.z); m.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][v.lado];
    m.visible = false; g.add(m);
    carregador.load(url, (tx) => {
      tx.colorSpace = T.SRGBColorSpace;
      // Mantém a proporção da logo dentro da placa.
      const a = tx.image.width / Math.max(1, tx.image.height), w = Math.min(placa.w, placa.h * a), h = w / a;
      m.scale.set(w / placa.w, h / placa.h, 1); mat.map = tx; mat.needsUpdate = true; m.visible = true;
      // Logo clara (branca, creme) sumia na placa branca: medida a claridade dos pixels que aparecem, ganha um
      // fundo grafite atrás dela.
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(tx.image, 0, 0, 24, 24); const px = x.getImageData(0, 0, 24, 24).data; let soma = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { soma += (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 255; n++; }
        if (n > 20 && soma / n > .8) {
          const fundo = new T.Mesh(new T.PlaneGeometry(placa.w + .06, placa.h + .06), new T.MeshBasicMaterial({ color: '#2B2F33', toneMapped: false }));
          fundo.position.copy(m.position); fundo.rotation.copy(m.rotation); fundo.translateZ(-.005); g.add(fundo);
        }
      } catch { /* imagem de outra origem sem permissão de leitura: fica como está */ }
      motor.invalidar();
    }, undefined, () => { g.remove(m); m.geometry.dispose(); mat.dispose(); });
  }
  function bolinhasHtml(c) {
    const st = (c.status || []).filter((s) => s.n > 0).slice(0, 5);
    if (!st.length) return '<span class="loja-bolinhas vazia"><i style="--c:#18A957" title="Em dia">✓</i></span>';
    return `<span class="loja-bolinhas">${st.map((s) => `<i style="--c:${esc(s.cor)}" title="${esc(s.n + ' · ' + s.nome)}">${s.n > 99 ? '99+' : s.n}</i>`).join('')}</span>`;
  }

  function definir(lista = [], { aoClicar = null } = {}) {
    const ordem = [...lista].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const novo = layoutDoCentro(ordem.length);
    if (!chao || novo.porLado !== L.porLado) { L = novo; montarChao(); }
    if (lojas) { motor.cena.remove(lojas); lojas.traverse((o) => o.geometry?.dispose?.()); }
    for (const r of rotulos) motor.removerRotulo(r);
    for (const a of alvos) motor.naoClicavel(a);
    rotulos = []; alvos = []; estadosDasLojas = [];
    const vagas = vagasDoCentro(ordem.length), o = new Obra(), gente = new Obra(), g = new T.Group(), invisivel = new T.MeshBasicMaterial({ visible: false });
    posicoes = ordem.map((c, k) => {
      const v = vagas[k];
      // Cliente com fachada própria (desenhada a partir da foto do lugar, mundo/sedes.mjs): a loja é a cara dele.
      // Fachada conceito pelo nicho do cliente, com a cor da marca e a logo na placa (a foto real substitui depois).
      const ident = identidadeDoCliente(c.nome), nicho = nichoDoCliente(c.nome, c.segmento);
      const P = paletaDaLoja(ident?.paleta || [], TOLDOS[(k * 3) % TOLDOS.length]), cor = P.marca;
      const C = (lx, y, lz, w, h, d, cr, luz = false) => { const q = paraMundo(v, lx, lz, w, d); (luz ? o.luz : o.caixa).call(o, q.x, y, q.z, q.w, h, q.d, cr); };
      C(0, 0, 0, LW + .6, CHAO, LD + .2, '#CFC6B4');
      const { placa } = (NICHOS[nicho] || NICHOS.loja)(C, cor, P);
      // Placa: fundo branco no bloco e a logo como imagem por cima (só aparece se o cliente tiver logo no Drive).
      C(0, placa.y - placa.h / 2 - .06, placa.z - .08, placa.w + .12, placa.h + .12, .1, '#FFFFFF');
      if (c.logo) logoNaPlaca(g, v, c.logo, placa);
      // O dono na porta (Paulo, 08/11/2026: lojas com alma): o personagem do cliente, quando o cadastro tem um; senão
      // um boneco fixo por cliente. De frente para a praça, com a sombra de contato no chão.
      const fig = c.personagem ? lerFigura(c.personagem) : figuraDaPessoa({ id: 'loja:' + c.nome }), pd = paraMundo(v, -LW / 2 + .9, LD / 2 + .55, 0, 0);
      desenharBoneco(gente, fig, { x: pd.x, y: CHAO, z: pd.z, s: .8, giro: (4 - v.lado) % 4 }); gente.sombra(pd.x, pd.z, .5, CHAO);
      const alvo = new T.Mesh(new T.BoxGeometry(v.lado % 2 ? LD : LW, 4.4, v.lado % 2 ? LW : LD), invisivel);
      alvo.position.set(v.x, 2.2, v.z); alvo.userData.alvo = { tipo: 'cliente', nome: c.nome }; g.add(alvo); motor.clicavel(alvo); alvos.push(alvo);
      const atrasada = c.situacao === 'atrasada';
      rotulos.push(motor.rotulo({ pos: new T.Vector3(v.x, 5.1, v.z), classe: 'rotulo-loja' + (atrasada ? ' atrasada' : ''), prioridade: 5 + (c.peso || 0), fixo: true,
        html: `<b class="loja-nome">${esc(c.nome)}</b>${bolinhasHtml(c)}`, aoClicar: () => aoClicar?.({ tipo: 'cliente', nome: c.nome }) }));
      estadosDasLojas.push({ nome: c.nome, x: v.x, z: v.z, frente: v.frente, lado: v.lado, atrasada, atrasadas: c.por?.atrasada || 0, prontas: c.por?.pronta || 0, hoje: c.por?.hoje || 0 });
      return { nome: c.nome, x: v.frente.x, z: v.frente.z, lado: v.lado, loja: { x: v.x, z: v.z } };
    });
    // Vagas sem cliente: loja fechada, sem nome (o anel fica sempre completo).
    const todas = vagasDoCentro(L.porLado * 4);
    for (let k = ordem.length; k < todas.length; k++) lojaFechada(o, todas[k], k);
    g.add(o.montar()); g.add(gente.montar({ sombra: false })); lojas = g; motor.adicionar(g);
    return posicoes;
  }

  // Caminho a pé (para as vans das captações): do prédio pela alameda do lado da loja e depois pela calçada.
  function caminho(x0, z0, x1, z1) {
    const y = CHAO, R = L.R - 1.6, p = [{ x: x0, y, z: z0 }];
    if (Math.abs(z1) >= Math.abs(x1)) { const s = Math.sign(z1) || 1; p.push({ x: 0, y, z: 9 * s }, { x: 0, y, z: R * s }, { x: x1, y, z: R * s }); }
    else { const s = Math.sign(x1) || 1; p.push({ x: 9 * s, y, z: 0 }, { x: R * s, y, z: 0 }, { x: R * s, y, z: z1 }); }
    p.push({ x: x1, y, z: z1 });
    return p;
  }

  montarChao();
  return {
    definir, caminho,
    alturaEm: () => CHAO, noRecorte: () => true, pontoDoEndereco: () => null, lugares: [],
    tamanho: () => L.S, posicoes: () => posicoes,
    // Para a vida do mundo (vida.mjs): lojas com o estado, ilhotas, nuvens, cachoeira, chafariz e o tamanho.
    lojasVivas: () => estadosDasLojas, postes: () => postes, detalheFino: () => finoMalha, ilhotas: () => ilhotas, nuvens: () => nuvensMalha, cachoeira: () => cachoeira, chafariz: () => chafariz, layout: () => L, LD,
  };
}
