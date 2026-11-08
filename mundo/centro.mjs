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
import { construirSede, idDaSede } from './sedes.mjs';

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
  let chao = null, lojas = null, rotulos = [], alvos = [], posicoes = [];

  function montarChao() {
    if (chao) { motor.cena.remove(chao); chao.traverse((o) => { o.geometry?.dispose?.(); }); }
    const { S, R } = L, o = new Obra(), g = new T.Group();
    // A maquete: grama, terra e pedra, como um bloco tirado do chão (as referências do Paulo).
    o.caixa(0, -4.4, 0, 2 * S - 1, 1.4, 2 * S - 1, '#8E8A84');
    o.caixa(0, -3, 0, 2 * S, 2, 2 * S, '#8A5A3B');
    o.caixa(0, -1, 0, 2 * S, 1, 2 * S, '#74B95A');
    // Franja de grama caindo pela borda e alguns blocos de pedra soltos embaixo.
    for (let i = -S + .5; i < S; i += 1) for (const [a, b] of [[i, -S + .5], [i, S - .5], [-S + .5, i], [S - .5, i]]) {
      const k = ruido(a * 3 + 7, b * 5 + 11);
      if (k > .55) o.caixa(a, -1 - .35 - k * .3, b, 1.02, .5 + k * .5, 1.02, k > .8 ? '#5E9E47' : '#6AAE51');
    }
    for (let i = 0; i < 18; i++) { const a = (ruido(i, 3) - .5) * (2 * S - 8), b = (ruido(3, i) - .5) * (2 * S - 8); o.caixa(a, -5.4 - ruido(i, i) * 1.4, b, 3 + ruido(i, 9) * 4, 1.2, 3 + ruido(9, i) * 4, '#7E7A75'); }
    // Calçada do anel das lojas, a praça do prédio e as quatro alamedas em cruz.
    const anelI = R - 3.2;
    for (const [x, z, w, d] of [[0, -(R - 1.6), 2 * R, 3.2], [0, R - 1.6, 2 * R, 3.2], [-(R - 1.6), 0, 3.2, 2 * R - 6.4], [R - 1.6, 0, 3.2, 2 * R - 6.4]]) o.caixa(x, 0, z, w, CHAO, d, '#DCD3C2');
    o.caixa(0, 0, 0, 26, CHAO, 26, '#E8E0D0');
    for (const [x, z, w, d] of [[0, -(13 + anelI) / 2, 4, anelI - 13], [0, (13 + anelI) / 2, 4, anelI - 13], [-(13 + anelI) / 2, 0, anelI - 13, 4], [(13 + anelI) / 2, 0, anelI - 13, 4]]) o.caixa(x, 0, z, w, CHAO, d, '#E2D9C8');
    // Fundo das lojas: um passeio estreito e árvores grandes em fila, como um muro verde.
    for (let i = -S + 4; i <= S - 4; i += 7) for (const [a, b] of [[i, -(S - 3.2)], [i, S - 3.2], [-(S - 3.2), i], [S - 3.2, i]]) {
      const k = ruido(a + 31, b + 17);
      o.arvore(a + (k - .5) * 1.5, 0, b + (k - .5) * 1.5, { s: 2.1 + k * .9, cor: k > .66 ? '#4F9A4E' : k > .33 ? '#5FA34E' : '#6BAF52', fruta: k > .82 ? '#F2A33A' : null });
    }
    // Jardim: os quatro canteiros entre as alamedas, com árvores, flores, bancos e um lago.
    const meioJ = (13 + anelI) / 2, larg = anelI - 13 - 4;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], q) => {
      const cx = sx * (2 + larg / 2 + 0.5), cz = sz * (2 + larg / 2 + 0.5);
      if (q === 0 && larg > 9) {
        // Lago com borda de pedra (água levemente afundada, no tom das referências).
        o.caixa(cx, -.18, cz, larg * .62 + 1.2, .3, larg * .5 + 1.2, '#B9B2A6');
        o.caixa(cx, -.12, cz, larg * .62, .3, larg * .5, '#4FB6E3');
        for (let k = 0; k < 4; k++) o.caixa(cx - larg * .2 + k * 1.6, .12, cz + (k % 2 ? .6 : -.5), .9, .08, .9, '#7FCB6A');
      } else {
        for (let k = 0; k < 6; k++) {
          const a = cx + (ruido(q * 7 + k, 5) - .5) * larg * .8, b = cz + (ruido(5, q * 7 + k) - .5) * larg * .8, r = ruido(k, q);
          o.arvore(a, 0, b, { s: 1.6 + r * 1.1, cor: ['#5FA34E', '#6BAF52', '#4F9A4E'][k % 3], fruta: r > .7 ? '#F2C14E' : null });
        }
      }
      // Canteiro de flores na quina que dá para a praça.
      const fx = sx * 15.5, fz = sz * 15.5;
      o.caixa(fx, 0, fz, 4, .3, 4, '#7A5236');
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) o.caixa(fx - 1.2 + a * 1.2, .3, fz - 1.2 + b * 1.2, .55, .45, .55, ['#E5484D', '#F2C14E', '#D6409F', '#FFFFFF', '#8E4EC6'][(a * 3 + b + q) % 5]);
      // Banco virado para o prédio.
      const bx = sx * 14.2, bz = sz * 9;
      o.caixa(bx, CHAO, bz, .4, .45, 2.2, '#7A5236').caixa(bx + sx * .25, CHAO + .45, bz, .12, .5, 2.2, '#8E6440');
    });
    // Postes na calçada do anel, com a luz acesa.
    for (let i = -L.meio + PASSO; i < L.meio; i += PASSO * 2) for (const [a, b] of [[i, -(R - 3.4)], [i, R - 3.4], [-(R - 3.4), i], [R - 3.4, i]]) {
      o.caixa(a, CHAO, b, .22, 3, .22, '#4A4F55'); o.luz(a, CHAO + 3, b, .5, .35, .5, '#FFE7B0');
    }
    g.add(o.montar());
    // Nuvens de blocos paradas no céu (não animam: o centro só redesenha quando algo muda).
    const nuvem = new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .92 });
    const cubo = new T.BoxGeometry(1, 1, 1), nuvens = [];
    for (let k = 0; k < 7; k++) {
      // Em volta da maquete, nunca por cima dela (não tapam as lojas em nenhuma vista).
      const ang = k / 7 * Math.PI * 2 + ruido(k, 41) * .6, raio = S * (1.35 + ruido(41, k) * .35);
      const cx = Math.cos(ang) * raio, cz = Math.sin(ang) * raio, cy = 4 + ruido(k, k + 3) * 10;
      for (let p = 0; p < 4; p++) nuvens.push([cx + (p - 1.5) * 3.2, cy + (p % 2) * 1.1, cz + ruido(p, k) * 3, 5 + ruido(k, p) * 4, 2 + (p % 2), 4 + ruido(p, p + k) * 3]);
    }
    const inst = new T.InstancedMesh(cubo, nuvem, nuvens.length), m4 = new T.Matrix4();
    nuvens.forEach(([x, y, z, w, h, d], i) => { m4.makeScale(w, h, d).setPosition(x, y, z); inst.setMatrixAt(i, m4); });
    inst.computeBoundingSphere(); g.add(inst);
    chao = g; motor.adicionar(g);
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

  function lojaFechada(o, v, k) {
    const C = (lx, y, lz, w, h, d, cor) => { const p = paraMundo(v, lx, lz, w, d); o.caixa(p.x, y, p.z, p.w, h, p.d, cor); };
    C(0, 0, 0, LW + .6, CHAO, LD + .2, '#CFC6B4');
    C(0, CHAO, -.35, LW, 2.8, LD - .7, k % 2 ? '#EDE6DA' : '#E6DFD2');
    C(0, 2.9, -.35, LW + .2, .25, LD - .5, '#FFFFFF');
    C(0, .3, LD / 2 - .68, LW - 1, 2.1, .08, '#B9B2A6');
    for (let f = 0; f < 6; f++) C(0, .45 + f * .33, LD / 2 - .62, LW - 1.1, .05, .06, '#A39C90');
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
    rotulos = []; alvos = [];
    const vagas = vagasDoCentro(ordem.length), o = new Obra(), g = new T.Group(), invisivel = new T.MeshBasicMaterial({ visible: false });
    posicoes = ordem.map((c, k) => {
      const v = vagas[k];
      // Cliente com fachada própria (desenhada a partir da foto do lugar, mundo/sedes.mjs): a loja é a cara dele.
      const id = idDaSede(c.nome);
      if (id) {
        const sede = construirSede({ id, nome: c.nome, tipo: c.segmento || '' }).malha;
        sede.position.set(v.x, 0, v.z); sede.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][v.lado];
        sede.scale.set(.76, 1.2, .76); g.add(sede);
      } else loja(o, v, k);
      const alvo = new T.Mesh(new T.BoxGeometry(v.lado % 2 ? LD : LW, 4.4, v.lado % 2 ? LW : LD), invisivel);
      alvo.position.set(v.x, 2.2, v.z); alvo.userData.alvo = { tipo: 'cliente', nome: c.nome }; g.add(alvo); motor.clicavel(alvo); alvos.push(alvo);
      const atrasada = c.situacao === 'atrasada';
      rotulos.push(motor.rotulo({ pos: new T.Vector3(v.x, 5.1, v.z), classe: 'rotulo-loja' + (atrasada ? ' atrasada' : ''), prioridade: 5 + (c.peso || 0), fixo: true,
        html: `<b class="loja-nome">${esc(c.nome)}</b>${bolinhasHtml(c)}`, aoClicar: () => aoClicar?.({ tipo: 'cliente', nome: c.nome }) }));
      return { nome: c.nome, x: v.frente.x, z: v.frente.z, lado: v.lado, loja: { x: v.x, z: v.z } };
    });
    // Vagas sem cliente: loja fechada, sem nome (o anel fica sempre completo).
    const todas = vagasDoCentro(L.porLado * 4);
    for (let k = ordem.length; k < todas.length; k++) lojaFechada(o, todas[k], k);
    g.add(o.montar()); lojas = g; motor.adicionar(g);
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
  };
}
