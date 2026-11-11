// Motor de móveis modelados (Paulo, 09/11/2026, com as referências de quarto voxel: "faz um motor pra fazer foda
// igual as referências"). O pixel art do Habbo esculpido não chega nesse visual: cada móvel do quarto é reconhecido
// pelo tipo (cadeira, sofá, mesa, cama, estante, armário, planta, luminária, tela, troféu, tapete, som, máquina) e
// MONTADO em voxel limpo, como nas referências: tampo com borda, pernas, gavetas com puxador, ripas, almofadas,
// livros, vaso com borda. Do Habbo vêm o tamanho (pegada), o assento/cama (ficha) e as cores da arte do próprio
// móvel. O que o motor não reconhece sai num volume liso pelo tamanho da peça (receita 'generico'); peça de parede
// tem as receitas dela (montarDeParede). A escultura da arte (moveis-habbo.mjs) só fica se a medida não chegar.
// Tudo na grade de 1/16 de ladrilho (o grão do padrão): medidas e posições caem nela.
import { Obra } from './voxel.mjs';
import { biblioteca } from './moveis-biblioteca.mjs';
import { familias, TIPOS_FAMILIAS, tipoPeloNucleo, paredeFamilias, TIPOS_PAREDE_FAMILIAS } from './moveis-familias.mjs';

const G = 1 / 16;
// Encaixe fino (1/64): o grão do desenho é G, mas detalhe de meia grade (fresta, puxador, botão) existe de verdade.
// Antes o encaixe era G com mínimo G: a peça de meia grade crescia, ficava com a face no mesmo plano de outra e as
// duas brigavam na tela ("serrilhando quando mexo", Paulo, 09/11/2026).
const Q = G / 4;
const q = (v) => Math.round(v / Q) * Q;
// Uma caixa na grade do padrão: centro (x, z), base y, tamanho w × h × d.
const C = (o, x, y, z, w, h, d, cor) => o.caixa(q(x), q(y), q(z), Math.max(Q, q(w)), Math.max(Q, q(h)), Math.max(Q, q(d)), cor);
const L = (o, x, y, z, w, h, d, cor) => o.luz(q(x), q(y), q(z), Math.max(Q, q(w)), Math.max(Q, q(h)), Math.max(Q, q(d)), cor);

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0);
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const tom = (cor, t) => { const c = hexRgb(cor), alvo = t < 0 ? [24, 22, 20] : [255, 255, 255]; return rgbHex(c.map((v, i) => v + (alvo[i] - v) * Math.abs(t))); };
const lum = (cor) => { const [r, g, b] = hexRgb(cor); return (r * .3 + g * .59 + b * .11) / 255; };
const sat = (cor) => { const c = hexRgb(cor); return (Math.max(...c) - Math.min(...c)) / 255; };

// ---------- quem é quem: o tipo pelo nome da classe e pela ficha do Habbo ----------
// Vale para a classe e para o nome do catálogo da Loja (assets/escritorio/habbo/catalogo.json, em inglês ou
// português): "Three Seat Sofa", "Árvore de Natal Nevada", "Temple Fountain".
const TIPOS = [
  // Objetos pequenos de mesa e de canto (redesign r2, quadro 34: o que ainda saía esculpido da arte do Habbo).
  ['telefone', /telephone|(^|[_ ])phone($|[_ ])|telefone/],
  ['impressora', /printer|copier|(^|[_ ])fax($|[_ ])|impressora|copiadora/],
  ['globo', /globe|globo/],
  ['lixeira', /trash|(^|[_ ])bin($|[_ ])|garbage|wastebasket|lixeira|lixo/],
  ['louca', /teapot|(^|[_ ])tea($|[_ ])|kettle|(^|[_ ])mug($|[_ ])|bule|chaleira|caneca/],
  ['letreiro', /neon_?sign|(^|[_ ])sign($|[_ ]|\d)|letreiro/],
  ['lareira', /fireplace|lareira/],
  ['tapete', /rug|carpet|(^|[_ ])mat($|[_ ])|tapete/],
  ['cama', /(^|[_ ])bed|futon|bunk|hammock|cama|beliche|rede/],
  ['trofeu', /troph|prize|(^|[_ ])cup($|[_ ])|award|medal|troféu|trofeu|taça|medalha/],
  ['fonte', /fountain|fonte|chafariz/],
  ['arvore', /(^|[_ ])tree|árvore|arvore|pinheiro|xmas.*tree|festivetree/],
  ['planta', /plant|flower|bush|cactus|palm|fern|bonsai|bamboo|rose|tulip|sunflower|hedge|planta|flor|vaso|cacto|samambaia|bambu/],
  ['luminaria', /lamp|(^|[_ ])light|lantern|torch|candle|chandelier|luminária|luminaria|abajur|lustre|lampião|vela/],
  ['sinuca', /pool_?table|pooltable|billiard|snooker|sinuca|bilhar/],
  ['tela', /(^|[_ ])tv|telly|television|computer|(^|[_ ])comp($|[_ ])|laptop|(^|[_ ])pc($|[_ ])|monitor|screen|console|arcade|gaming_c\d+_rig|televis|computador|notebook|tablet|tela/],
  ['som', /stereo|speaker|jukebox|radio|hifi|boombox|turntable|(^|[_ ])dj|estéreo|estereo|caixa de som|rádio/],
  ['maquina', /fridge|freezer|vending|drinksmachine|drinks machine|machine|oven|cooker|stove|microwave|washer|geladeira|fogão|forno|máquina|maquina/],
  ['sofa', /sofa|couch|lounger|loveseat|settee|sofá/],
  ['poltrona', /armchair|(^|[_ ])easy_?chair|recliner|throne|poltrona|trono/],
  ['cadeira', /chair|stool|(^|[_ ])seat|bench|cadeira|banco|banqueta/],
  ['estante', /shelf|shelves|bookcase|book_?shelf|mantelbooks|library|estante|prateleira/],
  ['livros', /book|(^|[_ ])reads($|[_ ])|folder|magazine|livro|revista|fichário/],
  ['armario', /cabinet|wardrobe|closet|drawer|dresser|cupboard|locker|sideboard|nightstand|commode|armário|armario|gaveteiro|cômoda|criado/],
  ['mesa', /table|desk|counter|(^|[_ ])bar($|[_ ])|workbench|mesa|balcão|escrivaninha/],
  ['caixa', /(^|[_ ])box($|[_ ]|\d)|crate|(^|[_ ])chest($|[_ ]|\d)|(^|[_ ])gift|present|caixa|baú|arca|presente/],
];
// A categoria da Loja desempata quando o nome não diz.
const BLOCOS = new Set(['Pisos do acervo', 'Blocos e materiais', 'Acabamentos', 'Divisórias']);
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
  // Peça de construção (piso, bloco, divisória): um bloco na paleta, com o desenho do material.
  if (BLOCOS.has(info?.categoria)) return 'bloco';
  // O substantivo principal do nome do catálogo manda ("Pia de Limo" é pia); só sem ele valem as palavras soltas.
  let t = tipoPeloNucleo(info?.nome) || (TIPOS.find(([, r]) => r.test(c)) || [null])[0];
  if (!t && info?.categoria) t = POR_CATEGORIA[info.categoria] || null;
  // Famílias que antes caíam no volume liso (redesign r4): só para quem nenhuma regra acima reconheceu.
  if (!t) t = (TIPOS_FAMILIAS.find(([, r]) => r.test(c)) || [null])[0];
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
    if (/tablet/.test(classe)) { // mesa digitalizadora: tela inclinada num pé, caneta ao lado
      const c = lum(cor.principal) < .45 ? cor.principal : '#2B2F33';
      C(o, 0, 0, 0, G * 9, G, G * 6, tom(c, -.15)); C(o, 0, G, -G * 2, G * 2, G * 2, G * 2, c);
      const brilho = cor.acento !== c && sat(cor.acento) > .25 ? tom(cor.acento, .35) : '#9FD8F5';
      for (let k = 0; k < 4; k++) { // a tela inclinada para trás, em degraus, cada degrau aceso em cima
        C(o, 0, G * 2 + k * G, G * 1.5 - k * G * 1.2, G * 10, G, G * 1.4, c);
        L(o, 0, G * 3 + k * G, G * 1.5 - k * G * 1.2, G * 8, G / 4, G * 1.1, brilho);
      }
      C(o, G * 6, 0, G * 1.5, G / 2, G * 4, G / 2, '#1F1D1A'); C(o, G * 6, G * 4, G * 1.5, G, G / 2, G, cor.acento);
      return;
    }
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
  bloco(o, { w, d, cor, classe, alto = 0 }) {
    const h = Math.max(G, q(alto) || G), c = cor.principal, nome = classe;
    if (/water|shallow|pool|água|agua/.test(nome)) { C(o, 0, 0, 0, w, Math.max(G, h - G), d, tom(c, -.2)); L(o, 0, Math.max(G, h - G), 0, w - G / 2, G / 2, d - G / 2, '#7FC8E8'); return; }
    const madeira = /wood|madeira|log|plank|tábua|tabua/.test(nome);
    // A base é a cor da fresta (madeira) ou do rejunte; as placas e tábuas ficam por cima, sem face no mesmo plano.
    C(o, 0, 0, 0, w, h, d, madeira ? tom(c, -.35) : tom(c, -.08));
    if (madeira) { // tábuas com a fresta escura e as emendas desencontradas
      const n = Math.max(4, Math.round(d * 4)); for (let k = 0; k < n; k++) { const corte = ((k * 3) % 4) / 4 * w; for (const [a, b] of corte ? [[-w / 2, -w / 2 + corte], [-w / 2 + corte, w / 2]] : [[-w / 2, w / 2]]) C(o, (a + b) / 2, h - G / 4, -d / 2 + (k + .5) * d / n, b - a - G / 4, G / 2, d / n - G / 4, k % 3 === 0 ? tom(c, .1) : k % 3 === 1 ? c : tom(c, -.06)); }
      return; }
    if (/grass|grama|leaf|folha/.test(nome)) { C(o, 0, h - G / 4, 0, w, G / 2, d, '#5FA34E'); for (let k = 0; k < 6; k++) C(o, -w / 2 + G * 2 + (k * 5 % 12) * w / 13, h + G / 4, -d / 2 + G * 2 + (k * 7 % 12) * d / 13, G, G, G, k % 2 ? '#7DBB5E' : '#4F9A4E'); return; }
    // Ladrilho: o topo em quatro placas com a junta fina (mármore, cerâmica, concreto).
    for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * w / 4, h - G / 4, b * d / 4, w / 2 - G / 2, G / 2, d / 2 - G / 2, (a * b > 0) ? c : tom(c, .06));
  },
  sinuca(o, { w, d, cor }) {
    const madeira = lum(cor.segunda) < .6 ? cor.segunda : MADEIRA_ESC, feltro = sat(cor.principal) > .15 ? cor.principal : '#2E8B57', tw = w - G * 2, td = d - G * 2, h = .72;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { C(o, a * (tw / 2 - G * 3), 0, b * (td / 2 - G * 3), G * 3, h - G * 4, G * 3, madeira); C(o, a * (tw / 2 - G * 3), 0, b * (td / 2 - G * 3), G * 4, G, G * 4, tom(madeira, -.2)); }
    C(o, 0, h - G * 5, 0, tw - G * 2, G * 3, td - G * 2, madeira);
    C(o, 0, h - G * 2, 0, tw - G * 4, G * 2, td - G * 4, feltro); // feltro
    // Trilhos da borda em volta do feltro, um pouco mais altos que ele.
    for (const s of [-1, 1]) { C(o, 0, h - G * 2, s * (td / 2 - G), tw, G * 3, G * 2, tom(madeira, .1)); C(o, s * (tw / 2 - G), h - G * 2, 0, G * 2, G * 3, td - G * 4, tom(madeira, .1)); }
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
  // ---- objetos pequenos (redesign r2, quadro 34): antes esculpidos da arte, agora montados no mesmo grão ----
  telefone(o, { cor }) {
    const c = lum(cor.principal) < .7 ? cor.principal : '#3A3F44';
    C(o, 0, 0, 0, G * 7, G * 2, G * 6, c); C(o, 0, G * 2, -G, G * 7, G, G * 4, tom(c, .08)); // corpo em degrau
    for (let k = 0; k < 9; k++) C(o, -G * 1.5 + (k % 3) * G * 1.5, G * 2, G * 1.5 + Math.floor(k / 3) * G * .9 - G * .9, G, G / 2, G / 2, tom(c, .4)); // teclas
    C(o, 0, G * 3, -G, G * 7, G, G * 2, '#1F1D1A'); for (const a of [-1, 1]) C(o, a * G * 3, G * 3, -G, G * 2, G * 1.5, G * 2.5, tom(c, -.1)); // fone
    L(o, G * 2.5, G * 2, G * 2.4, G * 1.5, G / 2, G / 2, cor.acento !== c ? cor.acento : '#7FE08A'); // luz de linha
  },
  impressora(o, { cor }) {
    const c = lum(cor.principal) > .35 ? cor.principal : '#D6D3CC', esc = tom(c, -.3);
    C(o, 0, 0, 0, G * 11, G * 5, G * 8, c); C(o, 0, G * 5, -G, G * 11, G, G * 6, tom(c, .08)); // corpo e tampa
    C(o, 0, G * 6, -G * 3, G * 7, G * 2, G * 1.5, esc); C(o, 0, G * 6, -G * 3.6, G * 6, G * 3, G / 2, BRANCO); // bandeja de papel atrás
    C(o, 0, G * 2, G * 4, G * 8, G, G * 2, esc); C(o, 0, G * 3, G * 4.2, G * 6, G / 2, G * 1.5, BRANCO); // saída na frente
    C(o, G * 4, G * 6, G * 1.5, G * 2, G / 2, G * 1.5, '#1F1D1A'); L(o, G * 3, G * 6.2, G * 2.4, G / 2, G / 2, G / 2, '#7FE08A');
  },
  globo(o, { cor }) {
    const metal = lum(cor.segunda) > .3 && sat(cor.segunda) < .5 ? cor.segunda : '#D9B45A', mar = hexRgb(cor.principal)[2] > hexRgb(cor.principal)[0] ? cor.principal : '#3C7DC4';
    const terra = sat(cor.acento) > .2 && cor.acento !== mar ? cor.acento : '#6BBF5E';
    C(o, 0, 0, 0, G * 6, G, G * 6, tom(metal, -.25)); C(o, 0, G, 0, G * 2, G * 3, G * 2, metal); // pé
    esfera(o, 0, G * 4, 0, G * 4.5, mar);
    for (let k = 0; k < 7; k++) { const a = k * 2.3, b = (r(k, 7) - .5) * 2.2; C(o, Math.cos(a) * G * 4.2 * Math.cos(b * .6), G * 8.5 + Math.sin(b * .6) * G * 3.5, Math.sin(a) * G * 4.2 * Math.cos(b * .6), G * 2, G * 1.5, G * 2, terra); } // continentes
    for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + k * Math.PI / 8; C(o, Math.cos(a) * G * 5.5, G * 8.5 + Math.sin(a) * G * 5.5, 0, G, G, G, metal); } // meridiano
  },
  livros(o, { cor, classe, alto }) {
    const base = (k) => [cor.principal, cor.acento, cor.segunda, ...LIVROS][k % (3 + LIVROS.length)];
    if (/folder|pasta|fichário|magazine|revista/.test(classe)) { // porta-revistas com pastas saindo
      for (let k = 0; k < 3; k++) {
        const x = (k - 1) * G * 4.5, c = k % 2 ? tom(PRETO, .1) : PRETO;
        C(o, x, 0, 0, G * 4, G * 8, G * 7, c); C(o, x, G * 6, G * 3.6, G * 4, G * 2, G / 2, c); // caixa com o recorte na frente
        for (let p = 0; p < 3; p++) C(o, x - G + p * G, G * 2, -G * .5, G * .8, G * (7 + (k + p) % 3), G * 5, base(k * 3 + p));
      }
      return;
    }
    if (alto > 0 && alto < .25) { // um livro deitado (a ficha diz que é baixinho), com as páginas aparecendo
      C(o, 0, 0, 0, G * 9, G * 1.5, G * 7, base(0)); C(o, G / 2, G / 4, 0, G * 8, G, G * 7.25, BRANCO); C(o, -G * 2, G * 1.5, G, G * 1.5, G / 4, G * 5, base(1));
      return;
    }
    if (/pile|stack|pilha|(^|_)books_\d/.test(classe)) { // pilha de livros deitados
      for (let k = 0; k < 5; k++) { const lw = G * (9 - (k % 3)), ld = G * (6 - (k % 2)); C(o, (r(k, 3) - .5) * G * 2, k * G * 1.6, (r(k, 5) - .5) * G * 2, lw, G * 1.5, ld, base(k)); C(o, (r(k, 3) - .5) * G * 2 + G / 2, k * G * 1.6 + G / 4, (r(k, 5) - .5) * G * 2, lw - G, G, ld + G / 4, BRANCO); }
      return;
    }
    // Livros em pé entre dois apoios, com um deitado em cima (os livros soltos das referências).
    const apoio = lum(cor.segunda) < .5 ? cor.segunda : MADEIRA_ESC;
    for (const a of [-1, 1]) { C(o, a * G * 6, 0, 0, G, G * 7, G * 5, apoio); C(o, a * G * 5, 0, 0, G * 2, G, G * 5, apoio); }
    let x = -G * 5;
    for (let k = 0; x < G * 5 - G / 2; k++) { const lw = G * (1 + (k % 2)), lh = G * (5 + (k * 3) % 3); C(o, x + lw / 2, 0, 0, lw - G / 8, lh, G * 4.5, base(k)); x += lw; }
    C(o, -G * 2, G * 7, 0, G * 6, G * 1.5, G * 4, base(4));
  },
  lixeira(o, { cor }) {
    const c = lum(cor.principal) > .2 ? cor.principal : '#8D949A';
    octogono(o, 0, 0, 0, G * 3, G * 8, tom(c, -.1)); octogono(o, 0, G * 8, 0, G * 3.5, G, tom(c, .12)); // corpo e borda
    octogono(o, 0, G * 7.6, 0, G * 2.5, G / 2, '#2B2F33'); // o fundo escuro aparecendo
    C(o, G, G * 8.2, 0, G * 2, G * 2, G * 2, BRANCO); C(o, -G, G * 8, G, G * 1.5, G * 1.5, G * 1.5, '#E9DFC8'); // papel amassado
  },
  louca(o, { cor }) {
    const c = lum(cor.principal) > .25 ? cor.principal : BRANCO, d = tom(c, -.15);
    octogono(o, 0, 0, 0, G * 2.5, G / 2, d); octogono(o, 0, G / 2, 0, G * 3, G * 4, c); octogono(o, 0, G * 4.5, 0, G * 2.2, G, d); // corpo
    C(o, 0, G * 5.5, 0, G * 3, G / 2, G * 3, c); C(o, 0, G * 6, 0, G, G, G, cor.acento); // tampa e botão
    for (let k = 0; k < 3; k++) C(o, G * (3 + k), G * (2 + k), 0, G, G, G, c); // bico subindo
    C(o, -G * 3.5, G * 1.5, 0, G, G * 3, G, c); C(o, -G * 3, G * 4, 0, G * 1.5, G, G, c); C(o, -G * 3, G * 1, 0, G * 1.5, G, G, c); // alça
    C(o, 0, G * 2.5, G * 2.8, G * 3, G, G / 2, cor.acento); // faixa pintada
  },
  letreiro(o, { cor, alto }) {
    // Letreiro de neon pendurado (o neon de Tóquio): moldura escura, correntes e o desenho em tubos acesos.
    const neon = sat(cor.acento) > .3 ? tom(cor.acento, .2) : '#FF7A2F', y0 = Math.max(G * 3, q(alto) || 0) + G * 2;
    for (const a of [-1, 1]) for (let k = 0; k < 4; k++) C(o, a * G * 4, y0 + G * 9 + k * G, 0, G / 2, G / 2 + G / 4, G / 2, '#3A3F44'); // correntes
    C(o, 0, y0 + G * 13, 0, G * 10, G / 2, G / 2, '#3A3F44');
    C(o, 0, y0, -G / 2, G * 11, G * 9, G, '#1F1D1A'); // fundo
    const traco = [[-3, 1, 6, 1], [-3, 4, 6, 1], [-3, 7, 6, 1], [-3, 1, 1, 7], [2, 1, 1, 7], [-1, 4, 1, 4]]; // o desenho em tubos
    for (const [x, y, tw, th] of traco) L(o, (x + tw / 2) * G, y0 + y * G, G * .25, tw * G, th * G, G / 2, neon);
    if (y0 > G * 4) { C(o, 0, 0, 0, G * 6, G, G * 4, '#3A3F44'); C(o, 0, G, -G / 2, G, y0 - G, G, '#3A3F44'); } // pé quando fica de pé
  },
  lareira(o, { w, cor }) {
    const pedra = lum(cor.principal) > .3 ? cor.principal : '#B9A48A', lw = Math.min(w, 2) - G * 2;
    C(o, 0, 0, -G * 3, lw, G * 14, G * 6, pedra); C(o, 0, G * 14, -G * 2.5, lw + G * 2, G * 2, G * 8, tom(pedra, .12)); // corpo e consolo
    C(o, 0, G, G * 0.5, lw * .55, G * 8, G, '#2B1D14'); // boca
    L(o, 0, G * 1.5, 0, lw * .4, G * 3, G * 2, '#FF9D4D'); L(o, -G, G * 3, 0, G * 2, G * 2, G * 1.5, '#FFD27A'); // fogo
    C(o, 0, 0, G * 1.5, lw + G * 2, G, G * 3, tom(pedra, -.15)); // soleira
  },
  caixa(o, { w, d, cor, classe }) {
    const s = Math.min(w, d, 1) * .55, c = cor.principal, presente = /gift|present|presente/.test(classe);
    C(o, 0, 0, 0, s, s * .8, s, presente ? c : tom(c, -.05)); C(o, 0, s * .8, 0, s + G, G * 1.5, s + G, tom(c, .1)); // caixa e tampa
    if (presente) { const f = cor.acento !== c ? cor.acento : '#E5484D'; C(o, 0, 0, 0, G * 1.5, s * .8 + G * 1.6, s + G * 1.1, f); C(o, 0, 0, 0, s + G * 1.1, s * .8 + G * 1.6, G * 1.5, f); for (const a of [-1, 1]) C(o, a * G * 1.5, s * .8 + G * 1.5, 0, G * 2, G * 2, G, f); return; }
    for (const a of [-1, 1]) C(o, a * (s / 2 - G * 1.5), G, s / 2, G, s * .8 - G * 2, G / 2, tom(c, -.2)); // ripas
    C(o, 0, s * .4, s / 2, s - G * 2, G, G / 2, tom(c, -.2));
  },
  // Peça sem receita própria (estátua, brinquedo, enfeite): em vez da escultura da arte, um volume liso em degraus
  // pelo tamanho dela. A arte só dá medidas (moveis-habbo.mjs, perfilDaVista): a altura, quanto da pegada a peça
  // ocupa em cada faixa de altura e a cor da faixa. Sem a medida, um pedestal com o enfeite em cima.
  generico(o, { w, d, cor, perfil = null, altoArte = 0 }) {
    const lw = w - G * 2, ld = d - G * 2;
    const faixas = (perfil || []).filter((p) => p.f > 0);
    if (faixas.length && altoArte <= G * 2.5) { // peça rasteira (adesivo de chão, placa): uma chapa com a borda
      C(o, 0, 0, 0, lw, G / 2, ld, cor.segunda); C(o, 0, G / 4, 0, lw - G * 2, G / 2, ld - G * 2, faixas[0].cor || cor.principal);
      C(o, 0, G / 2, 0, Math.max(G, lw - G * 6), G / 2, Math.max(G, ld - G * 6), cor.acento);
      return;
    }
    const lista = faixas.length ? faixas : [{ f: .8, cor: cor.segunda }, { f: .62, cor: cor.principal }, { f: .62, cor: cor.principal }, { f: .4, cor: cor.acento }];
    const total = faixas.length ? altoArte : .62, hb = Math.max(G, q(total / lista.length));
    let antes = null;
    lista.forEach((p, k) => {
      const bw = Math.max(G * 2, q(p.f * lw)), bd = Math.max(G * 2, q(p.f * ld)), c = p.cor || cor.principal;
      // Faixa igual à de baixo (mesma largura) ganha um friso de meia grade a menos: o volume não vira um caixote liso.
      const igual = antes && antes.bw === bw && antes.c === c;
      C(o, 0, k * hb, 0, igual ? bw - G / 2 : bw, hb, igual ? bd - G / 2 : bd, k % 2 ? tom(c, -.05) : c);
      antes = { bw, c };
    });
    const topo = lista[lista.length - 1], tw = Math.max(G * 2, q(topo.f * lw)), td = Math.max(G * 2, q(topo.f * ld));
    C(o, 0, lista.length * hb, 0, Math.max(G, tw - G * 2), G / 2, Math.max(G, td - G * 2), tom(topo.cor || cor.principal, .14)); // topo pegando luz
    C(o, 0, 0, 0, Math.min(lw, Math.max(G * 3, q(lista[0].f * lw)) + G), G, Math.min(ld, Math.max(G * 3, q(lista[0].f * ld)) + G), tom(lista[0].cor || cor.segunda, -.22)); // rodapé
  },
};

// ---------- peças de parede (redesign r2, quadro 34): antes uma placa com o desenho do Habbo pixel a pixel ----------
// Agora montadas como os móveis do chão. Convenção: x ao longo da parede (centro em 0), y para cima (base em 0),
// z saindo da parede (a parede em z = 0). w × h: o retângulo que a peça ocupa na parede, medido da arte dela.
const TIPOS_PAREDE = [
  ['relogio', /clock|relógio|relogio/],
  ['janela', /window|wndw|(^|[_ ])wdw|skyline|janela|vitral|st_glass/],
  ['espelho', /mirror|espelho/],
  ['arandela', /lamp|light|lantern|torch|candle|sconce|dimmer|luminária|luminaria|arandela|tocha|lanterna|vela/],
  ['prateleira', /shelf|shelves|shrack|clrack|(^|[_ ])rack|cabinet|cabnt|prateleira|armário|armario/],
  ['bandeira', /flag|bunting|banner|bandeira|faixa/],
  ['letreiro', /neon|(^|[_ ])sign($|[_ ]|\d)|logo|letreiro/],
  ['mapa', /(^|[_ ])map($|[_ ]|\d)|mapa/],
  ['lousa', /chalkboard|blackboard|whiteboard|noticeboard|(^|[_ ])board|lousa/],
  ['planta', /plant|plnt|flower|(^|[_ ])ivy|vine|garden|jngl|forest|planta|flor|trepadeira/],
  ['disco', /vinyl|record|(^|[_ ])disc($|[_ ])|vinil/],
  ['quadro', /paint|poster|pstr|picture|photo|frame|portrait|(^|[_ ])art($|[_ ])|canvas|decal|sticker|(^|[_ ])tag\d*($|[_ ])|xray|chart|quadro|pôster|foto|retrato|adesivo/],
];
export function tipoDeParede(classe, info = null) {
  const c = (String(classe || '') + ' ' + String(info?.nome || '')).toLowerCase();
  // As famílias de parede do redesign r4 só valem para quem as regras acima não reconhecem; o resto é o painel.
  return (TIPOS_PAREDE.find(([, r]) => r.test(c)) || TIPOS_PAREDE_FAMILIAS.find(([, r]) => r.test(c)) || ['painel'])[0];
}
const CLARO = '#F7F2E8';
// Moldura em quatro réguas (o miolo fica livre para o que vai dentro) e o fundo um passo atrás.
function moldura(o, w, h, cor, fundo, t = G) {
  C(o, 0, 0, G / 2, w, t, G, cor); C(o, 0, h - t, G / 2, w, t, G, cor);
  for (const a of [-1, 1]) C(o, a * (w / 2 - t / 2), t, G / 2, t, h - t * 2, G, cor);
  if (fundo) C(o, 0, t, G / 4, w - t * 2, h - t * 2, G / 2, fundo);
}
const madeiraDe = (cor) => (lum(cor.segunda) < .55 && sat(cor.segunda) > .12 ? cor.segunda : MADEIRA_ESC);
const RECEITAS_PAREDE = {
  janela(o, { w, h, cor }) {
    const m = lum(cor.principal) > .6 || sat(cor.principal) < .12 ? CLARO : cor.principal, vidros = Math.max(1, Math.round(w / .7));
    moldura(o, w, h, m, null, G * 1.5);
    C(o, 0, G * 1.5, G / 4, w - G * 3, h - G * 3, G / 2, '#BFE6F2'); // o céu no vidro (liso: aceso, o brilho apagava a moldura)
    for (let k = 0; k < vidros; k++) for (let i = 0; i < 2; i++) C(o, -w / 2 + (w / vidros) * (k + .3) + i * G * 1.5, h * .58 + i * G * 1.5, G / 2, G * 1.5, G, G / 4, '#F4FBFF'); // reflexo em degraus
    for (let k = 1; k < vidros; k++) C(o, -w / 2 + (w / vidros) * k, G * 1.5, G / 2, G, h - G * 3, G / 2, m); // montantes
    C(o, 0, h / 2 - G / 2, G / 2, w - G * 3, G, G / 2, m); // travessa
    C(o, 0, -G, G * 1.5, w + G * 2, G, G * 3, tom(m, .06)); // peitoril
  },
  arandela(o, { w, h, cor }) {
    const metal = lum(cor.segunda) > .3 && sat(cor.segunda) < .6 ? cor.segunda : '#D9B45A', cupula = lum(cor.principal) > .5 ? cor.principal : '#FFF4D6';
    const cx = Math.min(G * 7, w), y = Math.max(0, h / 2 - G * 4);
    C(o, 0, y, G / 2, G * 3, G * 5, G, tom(metal, -.2)); // espelho na parede
    C(o, 0, y + G * 2, G * 2, G, G, G * 3, metal); C(o, 0, y + G * 2, G * 3.5, G, G * 2, G, metal); // braço
    C(o, 0, y + G * 4, G * 3.5, cx - G * 2, G, G * 4, tom(cupula, -.08)); C(o, 0, y + G * 5, G * 3.5, cx - G, G * 3, G * 5, cupula); C(o, 0, y + G * 8, G * 3.5, cx - G * 3, G, G * 3, tom(cupula, -.06)); // cúpula
    L(o, 0, y + G * 3.6, G * 3.5, cx - G * 3, G / 2, G * 3, '#FFE7A3'); // a luz por baixo
  },
  relogio(o, { w, h, cor, classe }) {
    const s = Math.max(G * 6, Math.min(w, h)), caixa = lum(cor.principal) < .6 ? cor.principal : PRETO, y0 = (h - s) / 2;
    if (/pixel|digital|led/.test(classe)) { // relógio digital: caixa escura e os números acesos
      const lw = Math.max(s, Math.min(w, s * 1.6)), aceso = sat(cor.acento) > .3 ? tom(cor.acento, .25) : '#7FE08A';
      C(o, 0, y0, G / 2, lw, s, G, caixa); C(o, 0, y0 + G, G, lw - G * 2, s - G * 2, G / 2, '#1F1D1A');
      const dw = (lw - G * 5) / 4, dh = s - G * 4;
      for (let k = 0; k < 4; k++) { // quatro dígitos em tubos e os dois pontos no meio
        const x = -lw / 2 + G * 2 + dw * (k + .5) + (k > 1 ? G : 0);
        for (const yy of [0, dh / 2 - G / 4, dh - G / 2]) if (!(k === 1 && yy === 0)) L(o, x, y0 + G * 2 + yy, G * 1.25, dw - G, G / 2, G / 4, aceso);
        L(o, x + (dw - G) / 2 - G / 4, y0 + G * 2, G * 1.25, G / 2, k % 2 ? dh : dh / 2, G / 4, aceso);
        if (k !== 2) L(o, x - (dw - G) / 2 + G / 4, y0 + G * 2 + (k ? dh / 2 : 0), G * 1.25, G / 2, dh / 2, G / 4, aceso);
      }
      for (const yy of [.33, .66]) L(o, G / 2, y0 + G * 2 + dh * yy - G / 4, G * 1.25, G / 2, G / 2, G / 4, aceso);
      return;
    }
    C(o, 0, y0 + G, G / 2, s, s - G * 2, G, caixa); C(o, 0, y0, G / 2, s - G * 2, s, G, caixa); // caixa de cantos chanfrados
    C(o, 0, y0 + G * 1.5, G, s - G * 2, s - G * 3, G / 2, CLARO); C(o, 0, y0 + G, G, s - G * 3, s - G * 2, G / 2, CLARO); // mostrador
    for (const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) C(o, a * (s / 2 - G * 1.75), y0 + s / 2 - G / 4 + b * (s / 2 - G * 1.75), G * 1.4, G / 2, G / 2, G / 4, caixa); // 12, 3, 6, 9
    C(o, 0, y0 + s / 2 - G / 4, G * 1.5, G / 2, s / 2 - G * 2, G / 4, '#1F1D1A'); C(o, s / 8, y0 + s / 2 - G / 4, G * 1.5, s / 4, G / 2, G / 4, '#1F1D1A'); // ponteiros
    C(o, 0, y0 + s / 2 - G / 2, G * 1.6, G, G, G / 4, cor.acento !== caixa ? cor.acento : '#E5484D');
  },
  espelho(o, { w, h, cor }) {
    const m = lum(cor.principal) < .75 ? cor.principal : '#D9B45A';
    moldura(o, w, h, m, '#BFE6F2', G * 1.5);
    for (let k = 0; k < 3; k++) C(o, -w / 4 + k * G * 1.5, h * .55 + k * G * 1.5, G / 2, G * 2, G, G / 4, '#F4FBFF'); // o reflexo, em degraus
    C(o, 0, h - G / 2, G, Math.max(G * 2, w * .4), G, G * 1.5, tom(m, .14));
  },
  prateleira(o, { w, h, cor }) {
    const m = lum(cor.principal) > .2 ? cor.principal : MADEIRA, n = Math.max(1, Math.round(h / .5));
    for (let k = 0; k < n; k++) {
      const y = k * (h / n);
      C(o, 0, y, G * 2, w, G, G * 4, m); for (const a of [-1, 1]) C(o, a * (w / 2 - G * 2), Math.max(0, y - G * 2), G, G, G * 2, G * 2, tom(m, -.25)); // tábua e mãos-francesas
      let x = -w / 2 + G * 2; const alt = Math.max(G * 2, h / n - G * 3);
      for (let i = 0; x < w / 2 - G * 5; i++) { const lw = G * (1 + (i % 2)); C(o, x + lw / 2, y + G, G * 2, lw - G / 8, Math.min(alt, G * (3 + (i * 3 + k) % 3)), G * 3, LIVROS[(i + k * 2) % LIVROS.length]); x += lw; }
      C(o, w / 2 - G * 3, y + G, G * 2, G * 2, Math.min(alt, G * 2), G * 2, cor.acento); // um enfeite na ponta
    }
  },
  bandeira(o, { w, h, cor }) {
    const faixas = [cor.principal, cor.segunda, cor.acento].filter((c, i, l) => l.indexOf(c) === i), bw = w - G * 2, alto = Math.min(h - G, bw * .7);
    C(o, -w / 2 + G / 2, 0, G, G, h, G, METAL); C(o, -w / 2 + G / 2, h, G, G * 1.5, G, G * 1.5, '#D9B45A'); // mastro
    faixas.forEach((c, k) => C(o, G / 2, h - G - alto + (faixas.length - 1 - k) * (alto / faixas.length), G / 2 + (k % 2) * G / 4, bw, alto / faixas.length, G / 2, c));
  },
  letreiro(o, { w, h, cor }) {
    const neon = sat(cor.acento) > .3 ? tom(cor.acento, .2) : '#FF7A2F', outro = sat(cor.principal) > .3 && cor.principal !== cor.acento ? tom(cor.principal, .25) : '#7FD3FF';
    C(o, 0, 0, G / 4, w, h, G / 2, '#1F1D1A');
    for (const [y, c] of [[G, neon], [h - G * 1.5, neon]]) L(o, 0, y, G * .75, w - G * 2, G / 2, G / 2, c); // tubos da borda
    for (const a of [-1, 1]) L(o, a * (w / 2 - G * 1.25), G, G * .75, G / 2, h - G * 2, G / 2, neon);
    const n = Math.max(2, Math.round((w - G * 6) / (G * 3)));
    for (let k = 0; k < n; k++) L(o, -(w - G * 6) / 2 + (k + .5) * (w - G * 6) / n, G * 3, G * .75, G, Math.max(G, (h - G * 6) * (.5 + .5 * r(k, 9))), G / 2, k % 2 ? outro : neon); // o desenho em tubos
  },
  mapa(o, { w, h, cor }) {
    const mar = hexRgb(cor.principal)[2] >= hexRgb(cor.principal)[0] ? cor.principal : '#6BAED6', terra = sat(cor.acento) > .2 && cor.acento !== mar ? cor.acento : '#8FBF6B';
    moldura(o, w, h, madeiraDe(cor), mar);
    const iw = w - G * 4, ih = h - G * 4; // continentes em manchas de blocos
    for (const [x, y, a, b] of [[-.3, .55, .3, .3], [-.22, .2, .16, .3], [.12, .5, .34, .36], [.3, .2, .14, .16], [.02, .78, .18, .1]]) C(o, x * iw, G * 2 + y * ih, G / 2, Math.max(G, a * iw), Math.max(G, b * ih), G / 4, terra);
    C(o, .12 * iw, G * 2 + .62 * ih, G * .6, G, G, G / 4, '#E5484D'); // o alfinete
  },
  lousa(o, { w, h, cor }) {
    const quadro = lum(cor.principal) < .5 ? cor.principal : '#3F6B55';
    moldura(o, w, h, madeiraDe(cor), quadro, G);
    for (let k = 0; k < 3; k++) C(o, -w / 6 + (k % 2) * G, h - G * 4 - k * G * 2.5, G / 2, Math.max(G * 2, w * (.5 - k * .1)), G / 2, G / 4, CLARO); // linhas de giz
    C(o, 0, 0, G * 1.5, w - G * 2, G / 2, G * 2, madeiraDe(cor)); C(o, w / 4, G / 2, G * 1.5, G * 2, G / 2, G / 2, CLARO); // calha com o giz
  },
  planta(o, { w, h, cor }) {
    const verde = sat(cor.principal) > .2 && hexRgb(cor.principal)[1] > hexRgb(cor.principal)[0] ? cor.principal : VERDES[0], folhas = [verde, tom(verde, -.18), tom(verde, .15)];
    const vaso = sat(cor.acento) > .25 && hexRgb(cor.acento)[1] <= hexRgb(cor.acento)[0] ? cor.acento : '#D9774B', pv = Math.min(w, G * 7);
    const topo = Math.max(G * 5, h - G * 3); // o vaso preso no alto, com as folhas cabendo acima dele
    C(o, 0, topo - G * 5, G * 2, pv, G * 4, G * 4, vaso); C(o, 0, topo - G, G * 2.25, pv + G, G, G * 4.5, tom(vaso, .12));
    for (let k = 0; k < 4; k++) C(o, (r(k, 2) - .5) * (pv - G * 2), topo + (k % 2) * G, G * 2.25, G * 2.5, G * 2, G * 2.5, folhas[k % 3]);
    const n = Math.max(2, Math.round(w / (G * 3))), pe = topo - G * 5; // ramos caindo, cada um com um comprimento
    for (let k = 0; k < n; k++) { const x = -w / 2 + G * 1.5 + (k + .5) * (w - G * 3) / n, comp = pe * (.35 + .65 * r(k, 4)); for (let y = 0; y + G * 2 <= comp; y += G * 2) C(o, x + (r(k, y * 9) - .5) * G, pe - y - G * 2, G * 1.5 + (k % 2) * G, G * 2, G * 2, G * 1.5, folhas[(k + Math.round(y / G)) % 3]); }
  },
  disco(o, { w, h, cor }) {
    const s = Math.max(G * 6, Math.min(w, h)), y0 = (h - s) / 2, selo = sat(cor.acento) > .25 ? cor.acento : '#E5484D';
    C(o, 0, y0 + G * 1.5, G / 4, s, s - G * 3, G / 2, '#1F1D1A'); C(o, 0, y0, G / 4, s - G * 3, s, G / 2, '#1F1D1A'); C(o, 0, y0 + G * .75, G / 4, s - G * 1.5, s - G * 1.5, G / 2, '#1F1D1A'); // o disco, em octógono
    C(o, 0, y0 + s / 2 - s / 3, G / 2, s * .66, s * .66, G / 4, '#2B2F33'); // sulcos
    C(o, 0, y0 + s / 2 - G * 1.5, G * .75, G * 3, G * 3, G / 4, selo); C(o, 0, y0 + s / 2 - G / 4, G, G / 2, G / 2, G / 4, CLARO); // selo e furo
  },
  quadro(o, { w, h, cor, classe }) {
    const papel = /poster|pstr|decal|sticker|adesivo|pôster/.test(classe), ceu = lum(cor.principal) > .35 ? cor.principal : tom(cor.principal, .45);
    if (papel) C(o, 0, 0, G / 4, w, h, G / 2, ceu); else moldura(o, w, h, madeiraDe(cor), ceu, G * 1.5);
    const b = papel ? G : G * 1.5, iw = w - b * 2, ih = h - b * 2, z = G / 2;
    // A pintura em manchas lisas: chão, morro e o sol (as cores são as da arte da peça).
    C(o, 0, b, z, iw, ih * .3, G / 4, cor.segunda); C(o, -iw / 5, b + ih * .3, z, iw * .45, ih * .22, G / 4, tom(cor.segunda, .15));
    C(o, iw / 4, b + ih * .3, z, iw * .3, ih * .12, G / 4, tom(cor.segunda, -.12));
    C(o, iw / 5, b + ih * .62, z + G / 8, Math.min(iw, ih) * .26, Math.min(iw, ih) * .26, G / 4, cor.acento);
  },
  painel(o, { w, h, cor }) {
    // Peça de parede sem receita própria: um painel liso com a faixa e o detalhe nas cores da arte.
    C(o, 0, 0, G / 4, w, h, G / 2, tom(cor.principal, -.18)); C(o, 0, G, G / 2, w - G * 2, h - G * 2, G / 2, cor.principal);
    C(o, 0, G * 2, G * .75, w - G * 4, Math.max(G, (h - G * 4) * .3), G / 4, cor.segunda);
    C(o, w / 5, h * .6, G * .75, Math.max(G, Math.min(w, h) * .25), Math.max(G, Math.min(w, h) * .25), G / 4, cor.acento);
  },
};
Object.assign(RECEITAS_PAREDE, paredeFamilias({ C, L, G, tom, lum, sat, hexRgb, moldura, madeiraDe, LIVROS, METAL }));
export const TIPOS_DE_PAREDE = Object.keys(RECEITAS_PAREDE);
// Monta a peça de parede: devolve a Obra (centro em x = 0, base em y = 0, encostada na parede em z = 0, frente +z).
export function montarDeParede(tipo, { w = 1, h = 1, cores, classe = '' } = {}) {
  const f = RECEITAS_PAREDE[tipo] || RECEITAS_PAREDE.painel, o = new Obra();
  f(o, { w: Math.max(G * 4, q(w)), h: Math.max(G * 4, q(h)), cor: cores || coresDaPaleta([]), classe: String(classe).toLowerCase() });
  [...o.solidos, ...o.luzes].forEach((b, i) => { const e = (i + 1) * .00006; b.w += e; b.h += e; b.d += e; b.y -= e / 2; });
  return o;
}
// Peças redondas na grade: octógono (duas caixas cruzadas) e esfera em fatias de octógono.
function octogono(o, x, y, z, raio, h, cor) { C(o, x, y, z, raio * 2, h, raio * 1.2, cor); C(o, x, y, z, raio * 1.2, h, raio * 2, cor); }
function esfera(o, x, y, z, raio, cor) {
  const n = Math.max(3, Math.round(raio / G));
  for (let k = 0; k < n * 2; k++) {
    const yc = -raio + (k + .5) * G, rr = Math.sqrt(Math.max(0, raio * raio - yc * yc)); if (rr < G / 2) continue;
    for (const [a, b] of [[rr * 2, rr * 1.2], [rr * 1.2, rr * 2]]) C(o, x, y + raio + yc - G / 2, z, a, G, b, cor);
  }
}

// As famílias novas (moveis-familias.mjs) entram como receitas do motor, com as mesmas ferramentas.
Object.assign(RECEITAS, familias({ C, L, G, tom, lum, sat, hexRgb, esfera, octogono, pernas, LIVROS, METAL }));

// Móveis modelados um a um (moveis-biblioteca.mjs), com as ferramentas deste motor.
let BIBLIOTECA = null;
const modelos = () => (BIBLIOTECA ||= biblioteca({ C, L, G, tom, gaveta, pernas, LIVROS, RECEITAS, METAL }));
export const temModelo = (classe) => Object.prototype.hasOwnProperty.call(modelos(), String(classe));

// Monta o móvel: devolve a Obra (centro da pegada em 0, base 0, frente +z) ou null (tipo sem receita).
// perfil e altoArte: as medidas da arte para a peça sem receita própria (tipo 'generico').
// w e d: pegada em ladrilhos na direção 4 (a de frente). cores: { principal, segunda, acento }.
export function montarMovel(tipo, { w = 1, d = 1, cores, classe = '', alto = 0, perfil = null, altoArte = 0 } = {}) {
  const f = modelos()[classe] || RECEITAS[tipo]; if (!f) return null;
  const o = new Obra();
  f(o, { w: Math.max(.5, w), d: Math.max(.5, d), cor: cores || coresDaPaleta([]), classe: String(classe).toLowerCase(), alto, perfil, altoArte });
  // Sem empate de faces: cada peça desenhada depois (o detalhe) cresce um fio a mais que a anterior (o corpo), então
  // duas faces no mesmo plano nunca brigam na tela ao mover a câmera. 0,00006 por peça: invisível no tamanho.
  [...o.solidos, ...o.luzes].forEach((b, i) => { const e = (i + 1) * .00006; b.w += e; b.h += e; b.d += e; b.y -= e / 2; });
  if (tipo !== 'bloco') o.sombra(0, 0, Math.max(w, d) * .55, .005);
  return o;
}
export const TIPOS_MODELADOS = Object.keys(RECEITAS);
