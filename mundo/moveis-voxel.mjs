// Motor de móveis modelados (Paulo, 09/11/2026, com as referências de quarto voxel: "faz um motor pra fazer foda
// igual as referências"). O pixel art do Habbo esculpido não chega nesse visual: cada móvel do quarto é reconhecido
// pelo tipo (cadeira, sofá, mesa, cama, estante, armário, planta, luminária, tela, troféu, tapete, som, máquina) e
// MONTADO em voxel limpo, como nas referências: tampo com borda, pernas, gavetas com puxador, ripas, almofadas,
// livros, vaso com borda. Do Habbo vêm o tamanho (pegada), o assento/cama (ficha) e as cores da arte do próprio
// móvel. O que o motor não reconhece continua esculpido (moveis-habbo.mjs).
// Tudo na grade de 1/16 de ladrilho (o grão do padrão): medidas e posições caem nela.
import { Obra } from './voxel.mjs';

const G = 1 / 16;
const q = (v) => Math.round(v / G) * G;
// Uma caixa na grade do padrão: centro (x, z), base y, tamanho w × h × d.
const C = (o, x, y, z, w, h, d, cor) => o.caixa(q(x * 2) / 2, q(y), q(z * 2) / 2, Math.max(G, q(w)), Math.max(G, q(h)), Math.max(G, q(d)), cor);
const L = (o, x, y, z, w, h, d, cor) => o.luz(q(x * 2) / 2, q(y), q(z * 2) / 2, Math.max(G, q(w)), Math.max(G, q(h)), Math.max(G, q(d)), cor);

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0);
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const tom = (cor, t) => { const c = hexRgb(cor), alvo = t < 0 ? [24, 22, 20] : [255, 255, 255]; return rgbHex(c.map((v, i) => v + (alvo[i] - v) * Math.abs(t))); };
const lum = (cor) => { const [r, g, b] = hexRgb(cor); return (r * .3 + g * .59 + b * .11) / 255; };
const sat = (cor) => { const c = hexRgb(cor); return (Math.max(...c) - Math.min(...c)) / 255; };

// ---------- quem é quem: o tipo pelo nome da classe e pela ficha do Habbo ----------
// Vale para a classe e para o nome do catálogo da Loja (assets/escritorio/habbo/catalogo.json, em inglês ou
// português): "Three Seat Sofa", "Árvore de Natal Nevada", "Temple Fountain".
const TIPOS = [
  ['tapete', /rug|carpet|(^|[_ ])mat($|[_ ])|tapete/],
  ['cama', /(^|[_ ])bed|futon|bunk|hammock|cama|beliche|rede/],
  ['trofeu', /troph|prize|(^|[_ ])cup($|[_ ])|award|medal|troféu|trofeu|taça|medalha/],
  ['fonte', /fountain|fonte|chafariz/],
  ['arvore', /(^|[_ ])tree|árvore|arvore|pinheiro|xmas.*tree|festivetree/],
  ['planta', /plant|flower|bush|cactus|palm|fern|bonsai|bamboo|rose|tulip|sunflower|hedge|planta|flor|vaso|cacto|samambaia|bambu/],
  ['luminaria', /lamp|(^|[_ ])light|lantern|torch|candle|chandelier|luminária|luminaria|abajur|lustre|lampião|vela/],
  ['sinuca', /pool_?table|pooltable|billiard|snooker|sinuca|bilhar/],
  ['tela', /(^|[_ ])tv|telly|television|computer|(^|[_ ])comp($|[_ ])|laptop|(^|[_ ])pc($|[_ ])|monitor|screen|console|arcade|gaming_c\d+_rig|televis|computador|notebook|tela/],
  ['som', /stereo|speaker|jukebox|radio|hifi|boombox|turntable|(^|[_ ])dj|estéreo|estereo|caixa de som|rádio/],
  ['maquina', /fridge|freezer|vending|drinksmachine|drinks machine|machine|oven|cooker|stove|microwave|washer|geladeira|fogão|forno|máquina|maquina/],
  ['sofa', /sofa|couch|lounger|loveseat|settee|sofá/],
  ['poltrona', /armchair|(^|[_ ])easy_?chair|recliner|throne|poltrona|trono/],
  ['cadeira', /chair|stool|(^|[_ ])seat|bench|cadeira|banco|banqueta/],
  ['estante', /shelf|shelves|bookcase|book_?shelf|mantelbooks|library|estante|prateleira/],
  ['armario', /cabinet|wardrobe|closet|drawer|dresser|cupboard|locker|sideboard|nightstand|commode|armário|armario|gaveteiro|cômoda|criado/],
  ['mesa', /table|desk|counter|(^|[_ ])bar($|[_ ])|workbench|mesa|balcão|escrivaninha/],
];
// A categoria da Loja desempata quando o nome não diz.
const POR_CATEGORIA = { 'Cadeiras e sofás': 'cadeira', Mesas: 'mesa', Estantes: 'estante', Luzes: 'luminaria', Tapetes: 'tapete', 'Troféus': 'trofeu', 'Música': 'som' };
let catalogo = null;
// O catálogo da Loja, uma vez (o mesmo arquivo do editor do Escritório). classe → { nome, categoria }.
export function carregarCatalogo() {
  if (catalogo) return catalogo;
  const url = typeof globalThis.mapaArquivo === 'function' ? globalThis.mapaArquivo('catalogo.json') : null;
  catalogo = (url ? fetch(url, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : [])) : Promise.resolve([]))
    .then((lista) => new Map((Array.isArray(lista) ? lista : []).map((i) => [i.classe, { nome: i.nome || '', categoria: i.categoria || '' }])))
    .catch(() => new Map());
  return catalogo;
}
// tipo, ou null (o motor não sabe: fica a escultura). ficha: { senta, deita, pisa } do Habbo.
export function tipoModelado(classe, ficha = null, info = null) {
  const c = (String(classe || '') + ' ' + String(info?.nome || '')).toLowerCase();
  let t = (TIPOS.find(([, r]) => r.test(c)) || [null])[0];
  if (!t && info?.categoria) t = POR_CATEGORIA[info.categoria] || null;
  if (ficha?.deita) return 'cama';
  if (ficha?.senta && !['sofa', 'poltrona', 'cadeira', 'cama'].includes(t)) return t === 'mesa' || t === 'estante' || t === 'armario' ? t : 'cadeira';
  return t;
}

// ---------- cores: a arte do Habbo diz a cor de cada parte ----------
// paleta: cores da arte do móvel, da mais usada para a menos usada (hex). Escolhe a principal (corpo), a segunda
// (detalhe) e o acento (a mais viva): no Habbo o contorno escuro e o brilho branco não contam.
export function coresDaPaleta(paleta = [], padrao = '#C08A5B') {
  const boas = paleta.filter((c) => lum(c) > .15 && lum(c) < .96);
  const principal = boas[0] || padrao;
  const segunda = boas.find((c) => c !== principal && Math.abs(lum(c) - lum(principal)) > .08) || tom(principal, -.25);
  const acento = [...boas].sort((a, b) => sat(b) - sat(a))[0] || segunda;
  return { principal, segunda, acento: acento === principal ? segunda : acento };
}

// ---------- receitas (frente para +z, centro em (0, 0), base em y = 0; w × d em ladrilhos) ----------
const MADEIRA = '#C08A5B', MADEIRA_ESC = '#8A5A3C', PRETO = '#2B2F33', BRANCO = '#F4EFE6', METAL = '#B9C0C6', VERDES = ['#4FA35A', '#3E8F4E', '#6BBF5E'];
const LIVROS = ['#E5484D', '#F2C230', '#0D74CE', '#18A957', '#F4EFE6', '#8E4EC6', '#FF7A2F'];
const r = (k, n) => { const v = Math.sin(k * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };

function puxador(o, x, y, z, cor) { C(o, x, y, z + G / 2, G * 2, G, G, cor); }
function gaveta(o, x, y, z, w, h, cor, acento) {
  C(o, x, y, z, w, h, G, tom(cor, .08)); // frente da gaveta, saltada
  C(o, x, y + h - G, z + G / 2, w, G, G / 2, tom(cor, .18)); // friso de cima pegando luz
  puxador(o, x, y + h / 2 - G / 2, z + G / 2, acento);
}
function tampo(o, w, d, y, cor) {
  C(o, 0, y, 0, w, G * 2, d, cor);
  C(o, 0, y - G, 0, w - G * 2, G, d - G * 2, tom(cor, -.22)); // sombra embaixo da borda
}
function pernas(o, w, d, h, cor, grossa = G * 2) {
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(o, a * (w / 2 - grossa), 0, b * (d / 2 - grossa), grossa, h, grossa, cor);
}

const RECEITAS = {
  mesa(o, { w, d, cor }) {
    const h = .74, tw = w - G * 2, td = d - G * 2;
    tampo(o, tw, td, h - G * 2, cor.principal);
    pernas(o, tw - G * 2, td - G * 2, h - G * 3, tom(cor.principal, -.2));
    // Saia com uma gaveta quando a mesa é larga (escrivaninha); travessa embaixo, como as das referências.
    C(o, 0, h - G * 6, -(td / 2 - G * 2), tw - G * 4, G * 3, G, tom(cor.principal, -.1));
    if (w >= 1.5) gaveta(o, tw / 4, h - G * 6, td / 2 - G * 2, tw / 3, G * 3, cor.principal, cor.acento);
    C(o, 0, G * 3, 0, tw - G * 6, G, G, tom(cor.principal, -.25));
  },
  cadeira(o, { w, d, cor }) {
    const s = Math.min(w, d) * .62, assento = .42, c = cor.principal;
    pernas(o, s, s, assento, tom(c, -.15), G * 1.5);
    C(o, 0, assento, 0, s, G * 2, s, c);
    C(o, 0, assento + G * 2, G / 2, s - G * 2, G, s - G * 3, tom(c, .12)); // almofada do assento
    // Encosto com ripas verticais e travessa em cima (a cadeira da referência).
    const yb = assento + G * 2, alto = .5, zb = -(s / 2 - G);
    for (const a of [-1, 1]) C(o, a * (s / 2 - G), yb, zb, G * 1.5, alto, G * 1.5, tom(c, -.08));
    C(o, 0, yb + alto - G * 3, zb, s, G * 3, G * 1.5, c);
    for (const a of [-.5, 0, .5]) C(o, a * (s / 3), yb + G, zb, G, alto - G * 4, G, tom(c, -.05));
  },
  poltrona(o, { w, d, cor }) { RECEITAS.sofa(o, { w: Math.max(w, 1), d, cor, lugares: 1 }); },
  sofa(o, { w, d, cor, lugares = 0 }) {
    const c = cor.principal, n = lugares || Math.max(1, Math.round(w)), sw = w - G * 2, sd = Math.min(d, 1) - G * 2;
    for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * (sw / 2 - G * 2), 0, b * (sd / 2 - G * 2), G * 2, G * 2, G * 2, PRETO); // pezinhos
    C(o, 0, G * 2, 0, sw, G * 4, sd, tom(c, -.12)); // base
    const braco = G * 3, livre = sw - braco * 2, cw = livre / n;
    for (let k = 0; k < n; k++) { // almofadas do assento, uma por lugar, com a costura entre elas
      const x = -livre / 2 + cw * (k + .5);
      C(o, x, G * 6, G, cw - G / 2, G * 3, sd - G * 5, c);
      C(o, x, G * 9, G * 2, cw - G * 2, G / 2, sd - G * 8, tom(c, .1));
      C(o, x, G * 6, -(sd / 2 - G * 2.5), cw - G / 2, G * 7, G * 4, tom(c, .04)); // encosto
    }
    for (const a of [-1, 1]) { // braços arredondados em degrau
      C(o, a * (sw / 2 - braco / 2), G * 6, 0, braco, G * 5, sd, tom(c, -.04));
      C(o, a * (sw / 2 - braco / 2), G * 11, 0, braco - G, G, sd - G * 2, tom(c, .08));
    }
    C(o, 0, G * 6, -(sd / 2 - G), sw, G * 9, G * 2, tom(c, -.08)); // costas
    if (cor.acento !== c) C(o, -livre / 2 + cw * .5 + G, G * 9, -(sd / 2 - G * 5), G * 4, G * 4, G * 2, cor.acento); // almofada solta
  },
  cama(o, { w, d, cor }) {
    const bw = w - G * 2, bd = d - G * 2, madeira = lum(cor.segunda) < .55 ? cor.segunda : MADEIRA, manta = cor.principal;
    C(o, 0, 0, 0, bw, G * 5, bd, madeira); // estrado
    gaveta(o, 0, G, bd / 2, bw * .5, G * 3, madeira, cor.acento); // gaveta embaixo, como a da referência
    C(o, 0, G * 5, 0, bw - G * 2, G * 3, bd - G * 2, BRANCO); // colchão
    C(o, 0, G * 8, G * 2, bw - G, G * 1.5, bd * .62, manta); // manta
    C(o, 0, G * 6, bd * .31 + G * 2, bw - G, G * 3.5, G, tom(manta, -.1)); // dobra da manta caindo na frente
    for (let k = 0; k < 6; k++) C(o, -bw / 3 + (k % 3) * bw / 3, G * 9.5, -G + Math.floor(k / 3) * bd / 4, G * 2, G / 2, G * 2, cor.acento); // estampa
    const nTr = Math.max(1, Math.round(bw / .8));
    for (let k = 0; k < nTr; k++) C(o, -bw / 2 + bw / nTr * (k + .5), G * 8, -bd / 2 + G * 4, bw / nTr - G * 2, G * 3, G * 4, '#FFFFFF'); // travesseiros
    C(o, 0, 0, -bd / 2 + G, bw, G * 16, G * 2, madeira); // cabeceira
    C(o, 0, G * 16, -bd / 2 + G, bw + G, G, G * 3, tom(madeira, .12));
    C(o, 0, G * 7, -bd / 2 + G * 2, bw - G * 4, G * 7, G / 2, tom(madeira, -.12)); // painel da cabeceira
    C(o, 0, 0, bd / 2 - G, bw, G * 9, G * 2, madeira); // pezeira
  },
  estante(o, { w, d, cor, h = 1.7 }) {
    const c = lum(cor.principal) > .2 ? cor.principal : BRANCO, ew = w - G * 2, ed = Math.min(.5, d - G * 2), z0 = -d / 2 + ed / 2 + G;
    C(o, 0, 0, z0, ew, G * 2, ed, tom(c, -.15)); // rodapé
    for (const a of [-1, 1]) C(o, a * (ew / 2 - G), G * 2, z0, G * 2, h - G * 2, ed, c);
    C(o, 0, G * 2, z0 - ed / 2 + G / 2, ew, h - G * 2, G, tom(c, -.1)); // fundo
    const n = Math.max(3, Math.round(h / .42));
    for (let k = 0; k <= n; k++) {
      const y = G * 2 + k * (h - G * 4) / n; C(o, 0, y, z0, ew, G, ed, tom(c, .06));
      if (k === n) { C(o, 0, h - G, z0 + G / 2, ew + G * 2, G * 2, ed + G, c); break; }
      // Livros em pé (cores vivas, alturas e espessuras variadas) e um objeto de vez em quando.
      let x = -ew / 2 + G * 3; const fim = ew / 2 - G * 3, alt = (h - G * 4) / n - G * 2;
      while (x < fim - G) {
        const s = r(k * 31 + x * 17, 1);
        if (s > .86 && x < fim - G * 4) { C(o, x + G * 1.5, y + G, z0, G * 3, G * 3, G * 3, cor.acento); x += G * 5; continue; }
        const lw = G * (1 + Math.floor(s * 2)), lh = Math.min(alt, G * (5 + Math.floor(r(k, x * 7) * 4)));
        C(o, x + lw / 2, y + G, z0 + G / 2, lw, lh, ed - G * 3, LIVROS[Math.floor(r(x * 13, k) * LIVROS.length)]);
        x += lw + (r(x, k * 3) > .8 ? G * 2 : 0);
      }
    }
  },
  armario(o, { w, d, cor, h = 0 }) {
    const c = cor.principal, aw = w - G * 2, ad = Math.min(.6, d - G * 2), z0 = -d / 2 + ad / 2 + G, alto = h || (w > 1.2 ? 1.6 : .9);
    for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * (aw / 2 - G * 2), 0, z0 + b * (ad / 2 - G * 2), G * 2, G * 2, G * 2, tom(c, -.3));
    C(o, 0, G * 2, z0, aw, alto - G * 4, ad, c);
    C(o, 0, alto - G * 2, z0, aw + G * 2, G * 2, ad + G * 2, tom(c, .08)); // tampo saltado
    const zf = z0 + ad / 2, portas = Math.max(2, Math.round(aw / .45)), pw = (aw - G * 2) / portas;
    // Gavetas em cima e portas com painel embaixo (o armário azul da referência).
    const yg = alto - G * 8;
    for (let k = 0; k < portas; k++) {
      const x = -aw / 2 + G + pw * (k + .5);
      gaveta(o, x, yg, zf, pw - G, G * 4, c, cor.acento);
      C(o, x, G * 4, zf, pw - G, yg - G * 6, G, tom(c, .06)); // porta
      C(o, x, G * 6, zf + G / 2, pw - G * 4, yg - G * 10, G / 2, cor.segunda === c ? tom(c, -.15) : cor.segunda); // painel
      puxador(o, x + (k % 2 ? -1 : 1) * (pw / 2 - G * 3), yg - G * 6, zf + G / 2, cor.acento);
    }
  },
  planta(o, { w, d, cor }) {
    const s = Math.min(w, d), vaso = sat(cor.acento) > .25 && hexRgb(cor.acento)[1] <= hexRgb(cor.acento)[0] ? cor.acento : '#D9774B', pv = s * .42;
    C(o, 0, 0, 0, pv - G * 2, G * 5, pv - G * 2, vaso);
    C(o, 0, G * 5, 0, pv, G * 2, pv, tom(vaso, .12)); // borda do vaso
    C(o, 0, G * 6.5, 0, pv - G * 2, G / 2, pv - G * 2, '#5A3E2B'); // terra
    const verde = sat(cor.principal) > .2 && hexRgb(cor.principal)[1] > hexRgb(cor.principal)[0] ? cor.principal : VERDES[0];
    const folhas = [verde, tom(verde, -.18), tom(verde, .15)];
    for (let k = 0; k < 9; k++) { // folhas em cachos subindo, como as plantinhas das referências
      const a = k * 2.4, raio = G * (1 + (k % 3)) * 1.5, y = G * 7 + k * G * 1.6;
      C(o, Math.cos(a) * raio, y, Math.sin(a) * raio, G * 3, G * 3, G * 3, folhas[k % 3]);
    }
    C(o, 0, G * 7 + 9 * G * 1.6, 0, G * 2, G * 2, G * 2, folhas[2]);
    if (cor.acento !== verde && sat(cor.acento) > .4) for (let k = 0; k < 3; k++) C(o, Math.cos(k * 2.1) * G * 3, G * 14 + k * G, Math.sin(k * 2.1) * G * 3, G * 1.5, G * 1.5, G * 1.5, cor.acento); // flores
  },
  luminaria(o, { cor }) {
    const metal = lum(cor.segunda) > .3 ? cor.segunda : '#D9B45A', cupula = lum(cor.principal) > .5 ? cor.principal : '#FFF4D6';
    C(o, 0, 0, 0, G * 6, G, G * 6, tom(metal, -.2)); C(o, 0, G, 0, G * 4, G, G * 4, metal);
    C(o, 0, G * 2, 0, G, 1.2, G, metal);
    C(o, 0, 1.2, 0, G * 7, G * 2, G * 7, cupula); C(o, 0, 1.2 + G * 2, 0, G * 6, G * 3, G * 6, cupula); C(o, 0, 1.2 + G * 5, 0, G * 5, G, G * 5, tom(cupula, -.06));
    L(o, 0, 1.2 - G / 2, 0, G * 5, G, G * 5, '#FFE7A3'); // a luz por baixo da cúpula (acende à noite: brilha)
  },
  tela(o, { w, d, cor, classe }) {
    const pc = /comp|laptop|pc|monitor|rig/.test(classe);
    if (/laptop|notebook/.test(classe)) { // notebook aberto em cima da mesa
      const c = lum(cor.principal) > .35 ? cor.principal : '#C9CED3';
      C(o, 0, 0, G, G * 7, G / 2, G * 5, c); for (let k = 0; k < 4; k++) C(o, -G * 2 + k * G * 1.4, G / 2, G * 1.5, G, G / 4, G * 2, tom(c, -.2));
      C(o, 0, 0, -G * 1.5, G * 7, G * 5, G / 2, c); L(o, 0, G * .6, -G * 1.2, G * 6, G * 3.8, G / 4, '#7FD3FF');
      return;
    }
    if (pc) { // computador como o da referência: corpo bege, tela verde, teclado
      const corpo = lum(cor.principal) > .55 ? cor.principal : '#E9DFC8';
      C(o, 0, 0, -G * 2, G * 10, G * 9, G * 9, corpo);
      C(o, 0, G * 2, G * 2.5, G * 7, G * 6, G, '#1F2A22'); L(o, 0, G * 3, G * 3, G * 5, G * 4, G / 2, '#4FE07A');
      C(o, 0, 0, G * 6, G * 9, G, G * 3, tom(corpo, .05));
      for (let k = 0; k < 6; k++) C(o, -G * 3.5 + k * G * 1.4, G, G * 6, G, G / 2, G * 2, tom(corpo, -.12));
      return;
    }
    const tw = Math.max(.8, w - G * 4), movel = lum(cor.segunda) < .5 ? cor.segunda : MADEIRA_ESC;
    C(o, 0, 0, -d / 2 + G * 5, tw, G * 6, G * 8, movel); // rack
    gaveta(o, -tw / 4, G, -d / 2 + G * 9, tw / 3, G * 3, movel, cor.acento); gaveta(o, tw / 4, G, -d / 2 + G * 9, tw / 3, G * 3, movel, cor.acento);
    C(o, 0, G * 6, -d / 2 + G * 4, G * 3, G, G * 3, PRETO);
    C(o, 0, G * 7, -d / 2 + G * 4, tw - G * 2, G * 10, G, '#1F1D1A');
    L(o, 0, G * 8, -d / 2 + G * 4.6, tw - G * 4, G * 8, G / 2, '#5BC8F5');
  },
  trofeu(o, { cor }) {
    const ouro = sat(cor.acento) > .2 ? cor.acento : '#F2C230';
    C(o, 0, 0, 0, G * 6, G * 2, G * 6, '#3A3F44'); C(o, 0, G * 2, 0, G * 4, G, G * 4, tom(ouro, -.2));
    C(o, 0, G * 3, 0, G, G * 3, G, ouro);
    C(o, 0, G * 6, 0, G * 4, G, G * 4, ouro); C(o, 0, G * 7, 0, G * 5, G * 3, G * 5, ouro); C(o, 0, G * 10, 0, G * 6, G, G * 6, tom(ouro, .2));
    for (const a of [-1, 1]) { C(o, a * G * 3.5, G * 8, 0, G, G * 2, G, ouro); C(o, a * G * 3, G * 9.5, 0, G, G, G, ouro); }
  },
  tapete(o, { w, d, cor }) {
    const c = cor.principal, b = cor.segunda;
    C(o, 0, 0, 0, w - G * 2, G / 2, d - G * 2, b);
    C(o, 0, G / 4, 0, w - G * 4, G / 2, d - G * 4, c);
    for (let k = 0; k < Math.floor((w - G * 8) / (G * 4)); k++) C(o, -w / 2 + G * 6 + k * G * 4, G / 2, 0, G * 2, G / 4, d - G * 8, k % 2 ? b : cor.acento);
  },
  sinuca(o, { w, d, cor }) {
    const madeira = lum(cor.segunda) < .6 ? cor.segunda : MADEIRA_ESC, feltro = sat(cor.principal) > .15 ? cor.principal : '#2E8B57', tw = w - G * 2, td = d - G * 2, h = .72;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { C(o, a * (tw / 2 - G * 3), 0, b * (td / 2 - G * 3), G * 3, h - G * 4, G * 3, madeira); C(o, a * (tw / 2 - G * 3), 0, b * (td / 2 - G * 3), G * 4, G, G * 4, tom(madeira, -.2)); }
    C(o, 0, h - G * 5, 0, tw - G * 2, G * 3, td - G * 2, madeira);
    C(o, 0, h - G * 2, 0, tw, G * 2, td, tom(madeira, .1)); // borda
    C(o, 0, h - G * 2, 0, tw - G * 4, G * 2.2, td - G * 4, feltro);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) C(o, a * (tw / 2 - G * 2), h - G * 2, b * (td / 2 - G * 2), G * 2, G * 2.4, G * 2, '#1F1D1A'); // caçapas
    for (let k = 0; k < 6; k++) C(o, tw / 5 + (k % 3) * G * 1.2, h, (Math.floor(k / 3) - .5) * G * 1.2, G, G, G, LIVROS[k]); // bolas
    C(o, -tw / 4, h, 0, G, G, G, '#FFFFFF');
    C(o, -G * 4, h + G / 2, td / 2 - G * 5, tw * .55, G / 2, G / 2, '#E3C08A'); // taco
  },
  arvore(o, { w, d, cor, classe }) {
    const s = Math.min(w, d), natal = /xmas|natal|festive|christmas|pinheiro/.test(classe), verde = sat(cor.principal) > .15 && hexRgb(cor.principal)[1] >= hexRgb(cor.principal)[0] ? cor.principal : '#3E8F4E';
    C(o, 0, 0, 0, G * 6, G * 4, G * 6, natal ? '#B5462F' : '#C08A5B'); C(o, 0, G * 4, 0, G * 7, G, G * 7, natal ? '#D9774B' : tom('#C08A5B', .15)); // vaso/caixote
    C(o, 0, G * 5, 0, G * 2, G * 4, G * 2, '#6E4B33');
    const andares = natal ? 5 : 4, base = G * 9;
    for (let k = 0; k < andares; k++) { // camadas que afinam, como as árvores das referências
      const lado = s * (.9 - k * .16), y = base + k * G * 4.5;
      C(o, 0, y, 0, lado, G * 4, lado, k % 2 ? tom(verde, -.12) : verde);
      C(o, 0, y + G * 3, 0, lado - G * 2, G, lado - G * 2, tom(verde, .1));
      if (natal) for (let b = 0; b < 4; b++) { const a = b * 1.57 + k; C(o, Math.cos(a) * lado / 2, y + G, Math.sin(a) * lado / 2, G * 1.5, G * 1.5, G * 1.5, LIVROS[(k + b) % LIVROS.length]); }
    }
    if (natal) { const y = base + andares * G * 4.5; C(o, 0, y, 0, G * 3, G, G * 3, '#F2C230'); C(o, 0, y + G, 0, G, G * 2, G, '#F2C230'); L(o, 0, y + G * .5, 0, G * 2, G * 2, G * 2, '#FFE38A'); }
    else C(o, 0, base + andares * G * 4.5, 0, s * .3, G * 3, s * .3, tom(verde, .15));
  },
  fonte(o, { w, d, cor }) {
    const s = Math.min(w, d) - G * 2, pedra = lum(cor.principal) > .45 ? cor.principal : '#CFC6B2';
    C(o, 0, 0, 0, s, G * 4, s, tom(pedra, -.1)); C(o, 0, G * 4, 0, s + G, G, s + G, pedra); // tanque
    L(o, 0, G * 3, 0, s - G * 2, G * 1.5, s - G * 2, '#7FC8E8'); // água
    C(o, 0, G * 4, 0, G * 3, G * 10, G * 3, pedra); // coluna
    C(o, 0, G * 14, 0, s * .5, G * 2, s * .5, pedra); L(o, 0, G * 15, 0, s * .5 - G * 2, G * 1.2, s * .5 - G * 2, '#9AD8F0');
    C(o, 0, G * 16, 0, G * 2, G * 4, G * 2, pedra); L(o, 0, G * 20, 0, G, G * 2, G, '#CDEFFF');
  },
  som(o, { w, cor, classe }) {
    if (/jukebox/.test(classe)) { // jukebox: corpo alto com arco aceso e grade
      const c = sat(cor.principal) > .15 ? cor.principal : '#8A2E2E';
      C(o, 0, 0, 0, G * 12, G * 4, G * 9, tom(c, -.2)); C(o, 0, G * 4, 0, G * 11, G * 14, G * 8, c);
      C(o, 0, G * 18, 0, G * 9, G * 2, G * 8, c); C(o, 0, G * 20, 0, G * 6, G, G * 7, c);
      L(o, 0, G * 12, G * 4.2, G * 7, G * 5, G / 2, '#FFC977'); L(o, 0, G * 17.5, G * 4.2, G * 7, G, G / 2, cor.acento);
      for (const a of [-1, 1]) L(o, a * G * 5, G * 4, G * 4.2, G, G * 14, G / 2, '#FF9D4D');
      for (let k = 0; k < 4; k++) C(o, 0, G * 5 + k * G * 1.5, G * 4.2, G * 7, G / 2, G / 2, tom(c, -.35));
      return;
    }
    const c = lum(cor.principal) < .5 ? cor.principal : '#2B2F33', s = Math.min(w, 1);
    for (const a of (s >= .9 ? [-1, 1] : [0])) {
      const x = a * s / 4;
      C(o, x, 0, 0, G * 7, G * 14, G * 6, c);
      for (const [y, t] of [[G * 3, 5], [G * 9, 3]]) { C(o, x, y, G * 3, G * t, G * t, G / 2, tom(c, .25)); C(o, x, y + G, G * 3.3, G * (t - 2), G * (t - 2), G / 2, tom(c, -.3)); }
    }
    if (s >= .9) { C(o, 0, 0, 0, G * 6, G * 5, G * 5, tom(c, .1)); L(o, 0, G * 3, G * 2.6, G * 4, G, G / 2, cor.acento); }
  },
  maquina(o, { w, cor }) {
    const c = cor.principal, mw = Math.min(w, 1) - G * 2;
    C(o, 0, 0, 0, mw, 1.35, G * 10, c);
    C(o, 0, G * 9, G * 5, mw - G * 2, 1.35 - G * 12, G / 2, tom(c, .1)); // porta
    L(o, -G * 2, G * 12, G * 5.3, mw - G * 8, G * 8, G / 2, '#BFE6F2'); // vitrine/visor
    C(o, mw / 2 - G * 2.5, G * 4, G * 5.3, G, G * 6, G, METAL);
    C(o, 0, 1.35, 0, mw + G, G, G * 11, tom(c, -.15));
  },
};

// Monta o móvel: devolve a Obra (centro da pegada em 0, base 0, frente +z) ou null (tipo sem receita).
// w e d: pegada em ladrilhos na direção 4 (a de frente). cores: { principal, segunda, acento }.
export function montarMovel(tipo, { w = 1, d = 1, cores, classe = '' } = {}) {
  const f = RECEITAS[tipo]; if (!f) return null;
  const o = new Obra();
  f(o, { w: Math.max(.5, w), d: Math.max(.5, d), cor: cores || coresDaPaleta([]), classe: String(classe).toLowerCase() });
  o.sombra(0, 0, Math.max(w, d) * .55, .005);
  return o;
}
export const TIPOS_MODELADOS = Object.keys(RECEITAS);
