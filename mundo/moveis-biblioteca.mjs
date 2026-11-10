// Biblioteca de móveis dos quartos da equipe, modelados um a um olhando a arte de cada um no Habbo (Paulo,
// 09/11/2026: "objetos e cenário MUITO BEM FEITO", com as referências de quarto voxel). Vale antes da receita do
// tipo (moveis-voxel.mjs). Mesma convenção: frente +z, centro da pegada em 0, base 0, grade de 1/16 de ladrilho.
// As cores são as do desenho do Habbo; as formas, as do estilo das referências (limpas, com detalhe de verdade).
// Estátuas e figuras (patinador, coelho, árvore mística) continuam esculpidas: são formas orgânicas.
// Recebe as ferramentas do motor (C caixa, L luz, G grade, tom, gaveta, LIVROS, RECEITAS, METAL) para não haver
// importação circular.
export function biblioteca({ C, L, G, tom, gaveta, pernas, LIVROS, RECEITAS, METAL }) {
  // Peças que vários modelos repetem com cores diferentes (sofá moderno, chesterfield, cama).
  const BIBLIOTECA_UTIL = {
    sofaModerno(o, { w, d, tecido, lado }) {
      const sw = w - G * 2, sd = Math.min(d, 1) - G * 2, n = Math.max(1, Math.round(sw)), lw = G * 3, cw = (sw - lw * 2) / n;
      C(o, 0, 0, 0, sw - G * 2, G * 2, sd - G * 2, '#1F1D1A');
      C(o, 0, G * 2, 0, sw - lw * 2, G * 4, sd, tom(tecido, -.08));
      for (let k = 0; k < n; k++) { const x = -sw / 2 + lw + cw * (k + .5); C(o, x, G * 6, G, cw - G / 2, G * 2.5, sd - G * 5, tecido); C(o, x, G * 6, -(sd / 2 - G * 2.5), cw - G / 2, G * 7, G * 4, tecido); }
      for (const a of [-1, 1]) C(o, a * (sw / 2 - lw / 2), 0, 0, lw, G * 10, sd, lado);
    },
    chesterfield(o, { w, d, cor }) {
      const c = cor, e = tom(c, -.18), cl = tom(c, .1), sw = w - G * 2, sd = Math.min(d, 1) - G * 2;
      for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * (sw / 2 - G * 2), 0, b * (sd / 2 - G * 2), G * 2, G * 2, G * 2, '#2B1D14');
      C(o, 0, G * 2, 0, sw, G * 5, sd, e);
      const n = Math.max(1, Math.round(sw - .3)), cw = (sw - G * 8) / n;
      for (let k = 0; k < n; k++) C(o, -sw / 2 + G * 4 + cw * (k + .5), G * 7, G, cw - G / 2, G * 2, sd - G * 6, c);
      C(o, 0, G * 7, -(sd / 2 - G * 2), sw, G * 7, G * 4, c);
      for (let x = -sw / 2 + G * 3; x < sw / 2 - G * 2; x += G * 2) for (let y = G * 9; y < G * 14; y += G * 2) C(o, x, y, -(sd / 2 - G * 4.1), G / 2, G / 2, G / 4, e);
      for (const a of [-1, 1]) { C(o, a * (sw / 2 - G * 2), G * 7, 0, G * 4, G * 6, sd, c); C(o, a * (sw / 2 - G * 2), G * 13, 0, G * 5, G * 1.5, sd, cl); }
    },
    poltrona(o, { estofado, pes, alto = 1 }) {
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(o, a * G * 4, 0, b * G * 4, G * 1.5, G * 2, G * 1.5, pes);
      C(o, 0, G * 2, 0, G * 11, G * 5, G * 10, estofado); C(o, 0, G * 7, G, G * 8, G * 1.5, G * 7, tom(estofado, .1));
      C(o, 0, G * 7, -G * 4, G * 11, G * 11 * alto, G * 2.5, estofado); for (const a of [-1, 1]) C(o, a * G * 5, G * 7, 0, G * 1.5, G * 4, G * 10, tom(estofado, -.05));
    },
    cristaleira(o, { w, madeira, vidro, alto }) {
      const s = Math.max(.9, w - G * 2), m = madeira;
      C(o, 0, 0, -G * 2, s, alto, G * 7, m); C(o, 0, alto, -G * 2, s + G, G, G * 7.5, tom(m, .12));
      const n = Math.max(2, Math.round(s / .45)), pw = (s - G * 2) / n;
      for (let k = 0; k < n; k++) {
        const x = -s / 2 + G + pw * (k + .5);
        L(o, x, G * 2, G * 1.6, pw - G * 1.5, alto - G * 4, G / 2, vidro);
        for (let r = 0; r < 3; r++) for (let j = 0; j < 2; j++) C(o, x - G + j * G * 2, G * 3 + r * (alto - G * 5) / 3, G * .8, G, G * 2.5, G, LIVROS[(k + r + j) % LIVROS.length]);
        C(o, x + pw / 2 - G * 1.5, alto / 2, G * 1.9, G / 2, G * 2, G / 2, '#C9A34A');
      }
    },
    cama(o, { w, d, madeira, manta, lencol, travesseiro }) {
      const bw = w - G * 2, bd = d - G * 2;
      C(o, 0, 0, 0, bw, G * 5, bd, madeira);
      C(o, 0, G * 5, 0, bw - G * 2, G * 3, bd - G * 2, lencol);
      C(o, 0, G * 8, G * 2, bw - G, G * 1.5, bd * .62, manta); C(o, 0, G * 6, bd * .31 + G * 2, bw - G, G * 3.5, G, tom(manta, -.12));
      const n = Math.max(1, Math.round(bw / .8)); for (let k = 0; k < n; k++) C(o, -bw / 2 + bw / n * (k + .5), G * 8, -bd / 2 + G * 4, bw / n - G * 2, G * 3, G * 4, travesseiro);
      C(o, 0, 0, -bd / 2 + G, bw, G * 15, G * 2, madeira); C(o, 0, G * 15, -bd / 2 + G, bw + G, G, G * 3, tom(madeira, .12));
      C(o, 0, 0, bd / 2 - G, bw, G * 9, G * 2, madeira);
    },
  };
  return {
    // Cadeira executiva: estrela de 5 pés com rodinhas, coluna cromada, couro preto em gomos, braços de madeira.
    exe_chair2(o) {
      const couro = '#2F3438', claro = '#454C52', madeira = '#8A5A3C';
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .3; C(o, Math.cos(a) * G * 3.5, G, Math.sin(a) * G * 3.5, G * 2.5, G, G * 2.5, '#3A3F44'); C(o, Math.cos(a) * G * 5.5, 0, Math.sin(a) * G * 5.5, G * 1.5, G, G * 1.5, '#1F1D1A'); }
      C(o, 0, G * 2, 0, G * 1.5, G * 4, G * 1.5, METAL);
      C(o, 0, G * 6, G, G * 9, G * 2, G * 9, couro); C(o, 0, G * 8, G * 1.5, G * 8, G, G * 7, claro);
      C(o, 0, G * 8, -G * 4, G * 9, G * 12, G * 2, couro);
      for (let k = 0; k < 3; k++) C(o, 0, G * 9.5 + k * G * 3.3, -G * 2.8, G * 7, G * 2.5, G / 2, claro);
      C(o, 0, G * 20, -G * 4, G * 7, G, G * 2, claro);
      for (const a of [-1, 1]) { C(o, a * G * 5, G * 8, G, G, G * 3, G, '#3A3F44'); C(o, a * G * 5, G * 11, G * .5, G * 1.5, G, G * 6, madeira); }
    },
    // Rack escandinavo de madeira clara com ripas verticais, TV grande de borda fina e o videogame roxo.
    hygge_c25_tv(o, { w }) {
      const mad = '#D9B48A', ripa = '#C79E72', tw = Math.max(1.4, w - G * 2);
      C(o, 0, 0, -G * 3, tw, G, G * 8, '#6E4B33');
      C(o, 0, G, -G * 3, tw, G * 7, G * 8, mad);
      for (let x = -tw / 2 + G * 1.5; x < tw / 2 - G; x += G * 2) C(o, x, G * 1.5, G * 1.1, G, G * 6, G / 2, ripa);
      C(o, 0, G * 8, -G * 3, tw + G, G, G * 8.5, tom(mad, .1));
      C(o, 0, G * 9, -G * 5, G * 4, G, G * 3, '#1F1D1A'); C(o, 0, G * 10, -G * 5.5, G * 1.5, G * 2, G, '#1F1D1A');
      C(o, 0, G * 11, -G * 5.5, tw - G * 4, G * 13, G, '#17181A'); L(o, 0, G * 11.6, -G * 4.9, tw - G * 5, G * 11.8, G / 2, '#4D6B8A');
      C(o, tw / 2 - G * 5, G * 9, -G * .5, G * 3, G * 1.5, G * 3, '#8E4EC6'); C(o, tw / 2 - G * 5, G * 10.5, -G * .5, G * 2, G / 2, G * 2, '#B48CE0');
    },
    // Mesa executiva: tampo verde-escuro com borda, laterais de madeira escura, painel de fundo e gaveteiro.
    exe_table(o, { w, d }) {
      const tampo = '#3B4A47', mad = '#5A3E2B', tw = w - G * 2, td = d - G * 2, h = .74;
      C(o, 0, h - G * 2, 0, tw, G * 2, td, tampo); C(o, 0, h - G / 2, 0, tw - G * 2, G / 2, td - G * 2, tom(tampo, .1));
      for (const a of [-1, 1]) C(o, a * (tw / 2 - G * 2), 0, 0, G * 3, h - G * 2, td - G * 3, mad);
      C(o, 0, G * 3, -(td / 2 - G * 2.5), tw - G * 4, h - G * 6, G, tom(mad, -.1));
      for (let k = 0; k < 3; k++) gaveta(o, tw / 2 - G * 2, G * 2 + k * G * 3.6, td / 2 - G * 1.5, G * 2.5, G * 3, mad, '#C9A34A');
    },
    // Notebook prateado aberto.
    uni_laptop(o) {
      const c = '#C9CED3';
      C(o, 0, 0, G, G * 7, G / 2, G * 5, c); for (let k = 0; k < 5; k++) C(o, -G * 2.6 + k * G * 1.3, G / 2, G * .8, G, G / 4, G * 2.5, '#8E959B');
      C(o, 0, 0, -G * 1.8, G * 7, G * 5, G / 2, c); L(o, 0, G * .6, -G * 1.5, G * 6, G * 3.8, G / 4, '#7FD3FF');
    },
    // Taça de prata grande com alças, em base preta com faixa dourada.
    ads_aftv_trophy2(o) {
      const prata = '#D7DCE0';
      C(o, 0, 0, 0, G * 6, G * 3, G * 6, '#232629'); C(o, 0, G * 3, 0, G * 5, G / 2, G * 5, '#B48A3A');
      C(o, 0, G * 3.5, 0, G * 3, G, G * 3, prata); C(o, 0, G * 4.5, 0, G, G * 3, G, prata);
      C(o, 0, G * 7.5, 0, G * 3, G, G * 3, prata); C(o, 0, G * 8.5, 0, G * 5, G * 4, G * 5, prata); C(o, 0, G * 12.5, 0, G * 6, G, G * 6, tom(prata, .3));
      for (const a of [-1, 1]) { C(o, a * G * 3.5, G * 9, 0, G, G * 3, G, prata); C(o, a * G * 3, G * 12, 0, G, G, G, prata); C(o, a * G * 3, G * 8.5, 0, G, G, G, prata); }
    },
    // Bola de bronze com asas, em coluna.
    trophy_fball_c26_wingedbronze(o) {
      const br = '#C2763A';
      C(o, 0, 0, 0, G * 5, G * 2, G * 5, '#5A3E2B'); C(o, 0, G * 2, 0, G * 2, G * 5, G * 2, br);
      C(o, 0, G * 7, 0, G * 4, G * 4, G * 4, br); C(o, 0, G * 8, G * 1.6, G * 2, G * 2, G, '#E09A5A');
      for (const a of [-1, 1]) { C(o, a * G * 3, G * 10, 0, G * 2, G * 4, G, tom(br, .1)); C(o, a * G * 4, G * 13, 0, G * 2, G * 3, G, tom(br, .2)); C(o, a * G * 4.5, G * 15.5, 0, G, G * 2, G, tom(br, .3)); }
    },
    // Estante baixa de madeira com livros em pé e deitados e um vaso verde em cima.
    recycler_mantelbooks(o, { w }) {
      const mad = '#7A4A2E', ew = Math.max(.9, w - G * 2);
      C(o, 0, 0, -G * 4, ew, G * 9, G * 6, mad); C(o, 0, G * 9, -G * 4, ew + G * 2, G, G * 7, tom(mad, .15));
      C(o, 0, G, -G * 2.5, ew - G * 2, G * 7, G / 2, tom(mad, -.3));
      let x = -ew / 2 + G * 2; for (let k = 0; x < ew / 2 - G * 2; k++) { const lw = G * (1 + (k % 2)); C(o, x + lw / 2, G * 1.5, -G * 3, lw, G * (4 + (k * 3) % 3), G * 4, LIVROS[k % LIVROS.length]); x += lw; }
      for (let k = 0; k < 3; k++) C(o, ew / 4, G * 10 + k * G, -G * 4, G * 5, G, G * 4, LIVROS[(k + 2) % LIVROS.length]);
      C(o, -ew / 4, G * 10, -G * 4, G * 3, G * 3, G * 3, '#2E7D6B'); C(o, -ew / 4, G * 13, -G * 4, G * 2, G * 2, G * 2, '#4FA35A'); C(o, -ew / 4 + G, G * 15, -G * 4, G * 1.5, G * 1.5, G * 1.5, '#6BBF5E');
    },
    // Cacto de braços em vaso quadrado cinza, com a flor rosa.
    plant_small_cactus(o) {
      const v = '#8E959B', c = '#3E9A4E';
      C(o, 0, 0, 0, G * 5, G * 4, G * 5, v); C(o, 0, G * 4, 0, G * 6, G, G * 6, tom(v, .2)); C(o, 0, G * 4.5, 0, G * 4, G / 2, G * 4, '#5A3E2B');
      C(o, 0, G * 5, 0, G * 2.5, G * 9, G * 2.5, c); for (let k = 0; k < 4; k++) C(o, 0, G * 6 + k * G * 2, G * 1.3, G / 2, G / 2, G / 2, '#CFE8B0');
      C(o, -G * 2, G * 8, 0, G * 2, G, G * 2, c); C(o, -G * 2.5, G * 9, 0, G * 1.5, G * 3, G * 1.5, c);
      C(o, G * 2, G * 9.5, 0, G * 2, G, G * 2, c); C(o, G * 2.5, G * 10.5, 0, G * 1.5, G * 2.5, G * 1.5, c);
      C(o, 0, G * 14, 0, G * 1.5, G, G * 1.5, '#F06EA0'); C(o, 0, G * 15, 0, G / 2, G / 2, G / 2, '#FFD34D');
    },
    // Jukebox clássica: arco no alto, colunas de luz coloridas, painel dos discos e a grade da caixa de som.
    disco_c26_jukebox(o) {
      const corpo = '#5A2E6E', cromo = '#D7DCE0';
      C(o, 0, 0, 0, G * 12, G * 2, G * 9, '#2B2F33');
      C(o, 0, G * 2, 0, G * 11, G * 13, G * 8, corpo);
      C(o, 0, G * 15, 0, G * 10, G * 2, G * 8, corpo); C(o, 0, G * 17, 0, G * 8, G * 2, G * 8, corpo); C(o, 0, G * 19, 0, G * 5, G, G * 8, corpo);
      for (const a of [-1, 1]) { L(o, a * G * 4.6, G * 3, G * 4.2, G, G * 13, G / 2, '#FF7FC8'); L(o, a * G * 3.8, G * 16, G * 4.2, G, G * 3, G / 2, '#7FE3FF'); }
      L(o, 0, G * 16.5, G * 4.2, G * 5, G * 2, G / 2, '#FFE38A');
      C(o, 0, G * 9, G * 4.1, G * 7, G * 5, G / 2, '#1F1D1A'); L(o, 0, G * 9.5, G * 4.3, G * 6, G * 4, G / 4, '#FFC977');
      for (let k = 0; k < 4; k++) C(o, 0, G * 3 + k * G * 1.4, G * 4.2, G * 7, G / 2, G / 2, cromo);
    },
    // Luminária de pé com cúpula verde em degraus (tiffany), haste preta e pé quadrado.
    mm_lamp(o) {
      C(o, 0, 0, 0, G * 5, G, G * 5, '#2B2F33'); C(o, 0, G, 0, G * 3, G, G * 3, '#3A3F44');
      C(o, 0, G * 2, 0, G, G * 19, G, '#2B2F33');
      C(o, 0, G * 21, 0, G * 9, G * 1.5, G * 9, '#5E7F3A'); C(o, 0, G * 22.5, 0, G * 7, G * 1.5, G * 7, '#7FA34A'); C(o, 0, G * 24, 0, G * 5, G * 1.5, G * 5, '#9CBF5E'); C(o, 0, G * 25.5, 0, G * 2, G, G * 2, '#2B2F33');
      for (const a of [-1, 1]) C(o, a * G * 4.6, G * 21, 0, G / 2, G * 1.5, G * 9, '#C9A34A');
      L(o, 0, G * 20.5, 0, G * 6, G / 2, G * 6, '#FFE7A3');
    },
    // Estante de cubos (2 × 2) de madeira com caixas coloridas e um porta-retrato.
    hygge_c18_shelf(o) {
      const mad = '#B98A55', s = G * 12;
      C(o, 0, 0, -G * 2, s, s, G * 7, mad);
      for (const [a, b, cor] of [[-1, 0, '#E5484D'], [1, 0, '#F4EFE6'], [-1, 1, '#2E7D6B'], [1, 1, '#F2C230']]) {
        const x = a * G * 2.75, y = G + b * G * 5.5;
        C(o, x, y, G * .2, G * 5, G * 4.5, G * 3, tom(mad, -.35));
        if (cor === '#F4EFE6') { C(o, x, y, G * 1.2, G * 3, G * 3.5, G / 2, cor); C(o, x, y + G * .5, G * 1.5, G * 2, G * 2.5, G / 4, '#7FB7D9'); }
        else C(o, x, y, G * 1.3, G * 4, G * 3, G * 2, cor);
      }
      C(o, 0, s, -G * 2, s + G, G, G * 7.5, tom(mad, .12));
    },
    // Sinuca de luxo: moldura dourada, feltro vermelho.
    bling15_pooltable(o, { w, d }) { RECEITAS.sinuca(o, { w, d, cor: { principal: '#B3262C', segunda: '#B8862E', acento: '#F2C230' } }); },
    // Sofá chesterfield: couro vinho capitonê com botões, braços enrolados altos, pés escuros.
    xmas11_luxsofa2(o, { w, d }) {
      const c = '#7A2E2A', e = tom(c, -.25), cl = tom(c, .12), sw = w - G * 2, sd = Math.min(d, 1) - G * 2;
      for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * (sw / 2 - G * 2), 0, b * (sd / 2 - G * 2), G * 2, G * 2, G * 2, '#2B1D14');
      C(o, 0, G * 2, 0, sw, G * 5, sd, e);
      const n = Math.max(2, Math.round(sw)), cw = (sw - G * 8) / n;
      for (let k = 0; k < n; k++) C(o, -sw / 2 + G * 4 + cw * (k + .5), G * 7, G, cw - G / 2, G * 2, sd - G * 6, c);
      C(o, 0, G * 7, -(sd / 2 - G * 2), sw, G * 7, G * 4, c);
      for (let x = -sw / 2 + G * 3; x < sw / 2 - G * 2; x += G * 2) for (let y = G * 9; y < G * 14; y += G * 2) C(o, x, y, -(sd / 2 - G * 4.1), G / 2, G / 2, G / 4, e);
      for (const a of [-1, 1]) { C(o, a * (sw / 2 - G * 2), G * 7, 0, G * 4, G * 6, sd, c); C(o, a * (sw / 2 - G * 2), G * 13, 0, G * 5, G * 1.5, sd, cl); }
    },
    // Computador de mesa: monitor preto de tela azul, teclado e mouse.
    computer_flatscreen(o) {
      C(o, 0, 0, -G * 2, G * 3, G / 2, G * 2, '#2B2F33'); C(o, 0, G / 2, -G * 2, G, G * 2, G, '#2B2F33');
      C(o, 0, G * 2.5, -G * 2, G * 8, G * 5.5, G, '#1F1D1A'); L(o, 0, G * 3, -G * 1.4, G * 7, G * 4.5, G / 4, '#4F9BE0');
      C(o, -G, 0, G * 2, G * 6, G / 2, G * 2, '#3A3F44'); for (let k = 0; k < 4; k++) C(o, -G * 3 + k * G * 1.4, G / 2, G * 2, G, G / 4, G * 1.5, '#8E959B');
      C(o, G * 3.5, 0, G * 2, G, G / 2, G * 1.5, '#3A3F44');
    },
    // Coluna alta e fina de pedra verde com anéis e a água descendo (fonte do templo).
    lt_c26_stonefountain(o) {
      const p = '#3E8A78', c = tom(p, .2);
      C(o, 0, 0, 0, G * 9, G * 3, G * 9, tom(p, -.2)); L(o, 0, G * 2, 0, G * 7, G, G * 7, '#7FC8E8');
      C(o, 0, G * 3, 0, G * 4, G * 26, G * 4, p); for (let k = 0; k < 6; k++) C(o, 0, G * 5 + k * G * 4, 0, G * 5, G, G * 5, c);
      C(o, 0, G * 29, 0, G * 7, G * 2, G * 7, c); L(o, 0, G * 30, 0, G * 5, G, G * 5, '#9AD8F0');
      L(o, G * 2.6, G * 5, 0, G / 2, G * 24, G * 2, '#BFE6F2');
    },
    // Totem de informação: base, coluna azul-clara e a tela no alto.
    info_terminal(o) {
      const c = '#9FD3E6';
      C(o, 0, 0, 0, G * 7, G, G * 6, '#5A6268'); C(o, 0, G, -G, G * 5, G * 18, G * 3, c);
      C(o, 0, G * 19, -G * .5, G * 6, G * 6, G * 3, tom(c, .1)); L(o, 0, G * 19.5, G * 1.1, G * 4.5, G * 4.5, G / 2, '#E8F7FF');
      C(o, 0, G * 9, G * .6, G * 3, G * 3, G / 2, '#FFFFFF'); C(o, 0, G * 10, G * .9, G * 1.5, G, G / 4, '#4F9BE0');
    },
    // Mesa gamer: tampo de vidro escuro com quadro de metal grafite, pernas em L e fita de LED.
    gaming_c18_rigpro(o, { w, d }) {
      const metal = '#3A3F55', tw = w - G * 2, td = d - G * 2, h = .72;
      C(o, 0, h - G * 2, 0, tw, G, td, metal); L(o, 0, h - G, 0, tw - G * 2, G / 2, td - G * 2, '#5C6E9E');
      for (const a of [-1, 1]) { C(o, a * (tw / 2 - G), 0, 0, G * 1.5, h - G * 2, G * 1.5, metal); C(o, a * (tw / 2 - G), 0, 0, G * 1.5, G, td - G * 2, metal); }
      C(o, 0, h - G * 4, -(td / 2 - G), tw - G * 2, G, G, metal);
      L(o, 0, h - G * 2.5, td / 2 - G, tw - G * 2, G / 2, G / 2, '#FF4FD8');
    },
    // Poltrona lounge azul em base laranja.
    ads_capri_chair(o) {
      const az = '#2F7FD6', la = '#F07A2A';
      C(o, 0, 0, 0, G * 11, G * 3, G * 11, la); C(o, 0, G * 3, 0, G * 10, G * 3, G * 10, az); C(o, 0, G * 6, G, G * 8, G, G * 7, tom(az, .15));
      C(o, 0, G * 6, -G * 4, G * 10, G * 9, G * 2, az); for (const a of [-1, 1]) C(o, a * G * 4.5, G * 6, 0, G, G * 4, G * 9, tom(az, -.1));
      C(o, 0, G * 14.5, -G * 4, G * 9, G, G * 2, tom(az, .2));
    },
    // Estéreo: duas caixas brancas altas com cones pretos e o aparelho preto no meio.
    hc3_stereo(o, { w }) {
      const br = '#F1EFEA', s = Math.min(w, 2);
      for (const a of [-1, 1]) {
        const x = a * (s / 2 - G * 4);
        C(o, x, 0, -G, G * 6, G * 17, G * 6, br);
        for (const [y, t] of [[G * 2, 4.5], [G * 8, 3.5], [G * 13, 2]]) { C(o, x, y, G * 2.1, G * t, G * t, G / 2, '#2B2F33'); C(o, x, y + G, G * 2.4, G * (t - 2), G * (t - 2), G / 2, '#5A6268'); }
      }
      C(o, 0, 0, -G, G * 8, G * 3, G * 5, '#1F1D1A'); C(o, 0, G * 3, -G, G * 8, G * 3, G * 5, '#2B2F33'); C(o, 0, G * 6, -G, G * 7, G * 2, G * 5, '#1F1D1A');
      L(o, -G, G * 4, G * 1.6, G * 4, G, G / 2, '#7FE3FF'); C(o, G * 2.5, G * 4, G * 1.6, G, G, G / 2, '#E5484D');
    },
    // Árvore de Natal nevada: camadas azul-gelo com neve, bolas coloridas e a estrela.
    xmas_c22_festivetree2(o, { w, d }) {
      const s = Math.min(w, d), az = '#4A8FC9';
      C(o, 0, 0, 0, G * 5, G * 3, G * 5, '#E9EEF2'); C(o, 0, G * 3, 0, G * 2, G * 3, G * 2, '#6E4B33');
      for (let k = 0; k < 6; k++) {
        const lado = s * (.92 - k * .14), y = G * 6 + k * G * 4;
        C(o, 0, y, 0, lado, G * 3.5, lado, k % 2 ? tom(az, -.1) : az); C(o, 0, y + G * 3, 0, lado - G * 2, G, lado - G * 2, '#F4F8FB');
        for (let b = 0; b < 4; b++) { const a = b * 1.57 + k * .7; C(o, Math.cos(a) * lado / 2, y + G, Math.sin(a) * lado / 2, G * 1.5, G * 1.5, G * 1.5, ['#E5484D', '#F2C230', '#FFFFFF', '#D6409F'][(k + b) % 4]); }
      }
      C(o, 0, G * 30, 0, G * 3, G, G * 3, '#F2C230'); L(o, 0, G * 31, 0, G * 2, G * 2, G * 2, '#FFE38A');
    },
    // Máquina de bebidas coreana: corpo preto, vitrine acesa com as latas, painel lateral e a saída.
    skorea_c22_drinksmachine(o) {
      const c = '#22262B';
      C(o, 0, 0, -G, G * 12, G * 30, G * 10, c); C(o, 0, G * 30, -G, G * 12.5, G, G * 10.5, '#3A3F44');
      L(o, -G, G * 12, G * 4.1, G * 8, G * 15, G / 2, '#DCEBFF');
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) C(o, -G * 4 + k * G * 2, G * 14 + r * G * 4.5, G * 4.4, G * 1.5, G * 3, G / 2, ['#E5484D', '#18A957', '#F2C230', '#0D74CE'][(r + k) % 4]);
      C(o, G * 4.5, G * 14, G * 4.2, G * 2, G * 10, G / 2, '#3A3F44'); L(o, G * 4.5, G * 21, G * 4.5, G * 1.5, G, G / 4, '#4FE07A');
      C(o, -G, G * 3, G * 4.2, G * 8, G * 4, G / 2, '#111315');
    },

    // ---------- lote 2 (quartos de Paulo, Ewerton, Bia, Jady, Mizinho, Taynara e Reriston) ----------
    // Cadeira moderna: pés pretos finos, assento e encosto curvo estofados em bege-rosado.
    hc26_10(o) {
      const c = '#D9C3B5';
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(o, a * G * 3, 0, b * G * 3, G, G * 7, G, '#2B2F33');
      C(o, 0, G * 7, 0, G * 8, G * 2, G * 8, c); C(o, 0, G * 9, G / 2, G * 7, G / 2, G * 6, tom(c, .12));
      C(o, 0, G * 9, -G * 3.5, G * 8, G * 7, G * 1.5, c); C(o, 0, G * 16, -G * 3, G * 7, G, G * 2, tom(c, .1));
    },
    // Cadeira neon: disco amarelo no chão, haste cromada e a cuba de acrílico azul-gelo.
    party_chair(o) {
      C(o, 0, 0, 0, G * 7, G, G * 7, '#F2C230'); C(o, 0, G, 0, G * 5, G / 2, G * 5, tom('#F2C230', .2));
      C(o, 0, G * 1.5, 0, G, G * 5, G, METAL);
      C(o, 0, G * 6.5, 0, G * 8, G * 2, G * 8, '#BFE6F2'); C(o, 0, G * 8.5, 0, G * 9, G * 6, G * 2, '#D6F1F8');
      C(o, 0, G * 8.5, -G * 3.5, G * 9, G * 6, G * 2, '#BFE6F2'); for (const a of [-1, 1]) C(o, a * G * 4, G * 8.5, 0, G, G * 4, G * 8, '#D6F1F8');
      C(o, 0, G * 8.5, 0, G * 7, G / 2, G * 6, '#FFFFFF');
    },
    // Cadeira de madeira de encosto em escada (três travessas).
    waasa_chair_wood(o) {
      const m = '#D9A45E', e = tom(m, -.2);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(o, a * G * 3, 0, b * G * 3, G * 1.5, G * 7, G * 1.5, e);
      C(o, 0, G * 7, 0, G * 8, G, G * 8, m);
      for (const a of [-1, 1]) C(o, a * G * 3, G * 8, -G * 3, G * 1.5, G * 10, G * 1.5, e);
      for (let k = 0; k < 3; k++) C(o, 0, G * 10.5 + k * G * 2.5, -G * 3, G * 6, G, G, m);
    },
    // Cadeira de escritório preta de tela, com estrela de rodinhas.
    ads_idol_ch(o) {
      const c = '#2B2F33';
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; C(o, Math.cos(a) * G * 3.5, G, Math.sin(a) * G * 3.5, G * 2.5, G / 2, G * 2.5, '#3A3F44'); C(o, Math.cos(a) * G * 5, 0, Math.sin(a) * G * 5, G, G, G, '#1F1D1A'); }
      C(o, 0, G * 1.5, 0, G, G * 5, G, METAL);
      C(o, 0, G * 6.5, G / 2, G * 8, G * 1.5, G * 8, c); C(o, 0, G * 8, -G * 3.5, G * 8, G * 9, G, c);
      for (let k = 0; k < 4; k++) C(o, 0, G * 9 + k * G * 2, -G * 2.9, G * 6, G / 2, G / 4, '#454C52');
      for (const a of [-1, 1]) { C(o, a * G * 4, G * 8, 0, G / 2, G * 2.5, G / 2, '#3A3F44'); C(o, a * G * 4, G * 10.5, 0, G, G / 2, G * 4, '#3A3F44'); }
    },
    // Mesa de reunião: tampo de madeira avermelhada com borda e um bloco escuro de base.
    army_c15_contable(o, { w, d }) {
      const t = '#8A3A2A', tw = w - G * 2, td = d - G * 2, h = .74;
      C(o, 0, G, 0, tw - G * 6, h - G * 3, td - G * 6, '#2F3438'); C(o, 0, 0, 0, tw - G * 4, G, td - G * 4, '#1F2326');
      C(o, 0, h - G * 2, 0, tw, G * 2, td, t); C(o, 0, h - G / 2, 0, tw - G * 2, G / 2, td - G * 2, tom(t, .15));
    },
    // Prateleira baixa branca com livros e a planta caindo em cascata.
    art_c20_shelves(o, { w }) {
      const b = '#F4EFE6', ew = Math.max(.9, w - G * 2);
      for (const y of [0, G * 6]) C(o, 0, y, -G * 3, ew, G, G * 5, b);
      for (const a of [-1, 1]) C(o, a * (ew / 2 - G / 2), 0, -G * 3, G, G * 7, G * 5, b);
      let x = ew * .05; for (let k = 0; x < ew / 2 - G * 2; k++) { const lw = G * (1 + k % 2); C(o, x + lw / 2, G * 7, -G * 3, lw, G * (4 + k % 3), G * 4, LIVROS[k % LIVROS.length]); x += lw; }
      C(o, -ew / 4, G * 7, -G * 3, G * 3, G * 2, G * 3, '#F2C230');
      for (let k = 0; k < 7; k++) C(o, -ew / 4 + (k % 3 - 1) * G * 1.5, G * (9 - k * 1.3), -G * 1 + (k % 2) * G, G * 1.5, G * 1.5, G * 1.5, ['#3E8F4E', '#4FA35A', '#6BBF5E'][k % 3]);
    },
    // Balcão longo preto com tampo de vidro esverdeado.
    public_x_counter4(o, { w, d }) {
      const tw = w - G * 2, td = Math.min(d, 1) - G * 4;
      C(o, 0, 0, 0, tw, G * 13, td, '#2B2F33'); C(o, 0, G, td / 2, tw - G * 2, G * 11, G / 2, '#3A3F44');
      C(o, 0, G * 13, 0, tw + G, G, td + G, '#9FC9C0'); C(o, 0, G * 13.5, 0, tw - G, G / 2, td - G, '#BFE3DA');
    },
    // Sofá baunilha moderno: almofadas creme e laterais de madeira escura.
    js_exe_sofa(o, { w, d }) { BIBLIOTECA_UTIL.sofaModerno(o, { w, d, tecido: '#EFE6D6', lado: '#4A3427' }); },
    exe_sofa(o, { w, d }) { BIBLIOTECA_UTIL.sofaModerno(o, { w, d, tecido: '#2F3438', lado: '#8A5A3C' }); },
    // Escrivaninha de madeira clara com gaveteiro à esquerda.
    uni_desk(o, { w, d }) {
      const m = '#D9A45E', tw = w - G * 2, td = d - G * 2, h = .72;
      C(o, 0, h - G * 2, 0, tw, G * 2, td, m);
      C(o, -tw / 2 + G * 4, 0, 0, G * 7, h - G * 2, td - G * 2, tom(m, -.05));
      for (let k = 0; k < 3; k++) gaveta(o, -tw / 2 + G * 4, G + k * G * 3.7, td / 2 - G, G * 6, G * 3, m, '#8E959B');
      C(o, tw / 2 - G * 1.5, 0, 0, G * 2, h - G * 2, td - G * 2, tom(m, -.1));
    },
    // Notebook preto aberto de tela laranja.
    computer_laptop(o) {
      C(o, 0, 0, G, G * 7, G / 2, G * 5, '#2B2F33'); for (let k = 0; k < 5; k++) C(o, -G * 2.6 + k * G * 1.3, G / 2, G * .8, G, G / 4, G * 2.5, '#5A6268');
      C(o, 0, 0, -G * 1.8, G * 7, G * 5, G / 2, '#2B2F33'); L(o, 0, G * .6, -G * 1.5, G * 6, G * 3.8, G / 4, '#FFB46B');
    },
    // Chesterfield branco (o sofá luxuoso de 1 lugar ou mais).
    xmas11_luxsofa1(o, { w, d }) { BIBLIOTECA_UTIL.chesterfield(o, { w, d, cor: '#E9EEE9' }); },
    // Estante de nichos em zigue-zague de madeira escura.
    darkmodern_c20_shelf(o) {
      const m = '#5A3427', i = tom(m, -.3);
      for (const [x, y] of [[-G * 2, 0], [G * 2, G * 5], [-G * 2, G * 10], [G * 2, G * 15]]) { C(o, x, y, -G * 2, G * 8, G * 5, G * 6, m); C(o, x, y + G, -G * 1.6, G * 6, G * 3, G * 5, i); }
      C(o, -G * 2, G * 11, -G, G * 2, G * 2, G * 2, '#F2C230'); C(o, G * 2, G * 6, -G, G * 3, G * 2, G * 2, '#3D7DD8');
    },
    // TV grande preta num pé fino.
    modern_c17_tv(o) {
      C(o, 0, 0, -G * 2, G * 5, G / 2, G * 3, '#2B2F33'); C(o, 0, G / 2, -G * 2, G, G * 4, G, '#2B2F33');
      C(o, 0, G * 4.5, -G * 2, G * 15, G * 10, G, '#17181A'); L(o, 0, G * 5, -G * 1.4, G * 14, G * 9, G / 4, '#3A4A5E');
      C(o, G * 4, G * 10, -G * 1.2, G * 4, G / 2, G / 8, '#5C7090');
    },
    // Luminária de arco: base redonda, haste curvada e a cúpula cinza.
    modern_c17_floorlamp(o) {
      const c = '#9AA3A8';
      C(o, 0, 0, 0, G * 5, G, G * 5, '#5A6268'); C(o, 0, G, 0, G, G * 18, G, c);
      for (let k = 0; k < 5; k++) C(o, G * (k + 1), G * (19 + Math.min(k, 2) * .5), 0, G, G, G, c);
      C(o, G * 6, G * 16, 0, G * 4, G * 3, G * 4, c); C(o, G * 6, G * 19, 0, G * 2, G, G * 2, tom(c, -.2));
      L(o, G * 6, G * 15.5, 0, G * 3, G / 2, G * 3, '#FFE7A3');
    },
    // Cama moderna escura: manta azul, travesseiros cinza.
    darkmodern_c20_bed(o, { w, d }) { BIBLIOTECA_UTIL.cama(o, { w, d, madeira: '#3B2A22', manta: '#4F6E9E', lencol: '#E2E6EA', travesseiro: '#9AA3A8' }); },
    // Cama viking: madeira rústica, pele marrom por cima.
    vikings_bed(o, { w, d }) {
      BIBLIOTECA_UTIL.cama(o, { w, d, madeira: '#6E4B33', manta: '#8A5E3C', lencol: '#D9C3A0', travesseiro: '#C9AE84' });
      for (let k = 0; k < 8; k++) C(o, (k % 4 - 1.5) * G * 3, G * 10, (Math.floor(k / 4) - .5) * G * 5, G * 2, G, G * 2, k % 2 ? '#5E4030' : '#A87A52'); // pelagem
    },
    // Criado-mudo de madeira com gaveta e o abajur de cúpula creme.
    xmas11_nghtstnd(o) {
      const m = '#9A5E34';
      C(o, 0, 0, 0, G * 9, G * 8, G * 8, m); gaveta(o, 0, G * 4, G * 4, G * 7, G * 3, m, '#F2C230'); C(o, 0, G * 8, 0, G * 10, G, G * 9, tom(m, .12));
      C(o, -G, G * 9, -G, G * 3, G, G * 3, '#C9A34A'); C(o, -G, G * 10, -G, G, G * 4, G, '#C9A34A');
      C(o, -G, G * 14, -G, G * 5, G * 3, G * 5, '#F0DFB0'); L(o, -G, G * 13.5, -G, G * 3, G / 2, G * 3, '#FFE7A3');
    },
    // Luminária de mesa preta fina.
    modern_c17_lamp(o) {
      C(o, 0, 0, 0, G * 3, G / 2, G * 3, '#2B2F33'); C(o, 0, G / 2, 0, G / 2, G * 12, G / 2, '#2B2F33');
      C(o, G, G * 12, 0, G * 3, G * 1.5, G * 2, '#2B2F33'); L(o, G * 1.5, G * 11.5, 0, G * 2, G / 2, G * 1.5, '#FFE7A3');
    },
    // Cama de casal com colunas de latão, lençol branco e manta marrom.
    bed_armas_two(o, { w, d }) {
      BIBLIOTECA_UTIL.cama(o, { w, d, madeira: '#C9A34A', manta: '#7A4A2E', lencol: '#F4EFE6', travesseiro: '#FFFFFF' });
      const bw = w - G * 2, bd = d - G * 2;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { C(o, a * (bw / 2 - G), 0, b * (bd / 2 - G), G * 1.5, b < 0 ? G * 20 : G * 12, G * 1.5, '#C9A34A'); C(o, a * (bw / 2 - G), b < 0 ? G * 20 : G * 12, b * (bd / 2 - G), G * 2, G * 1.5, G * 2, '#E6C46A'); }
    },
    // Duas caixinhas de som cinza em forma de ovo.
    modern_c17_speakers(o) {
      for (const a of [-1, 1]) { const x = a * G * 3; C(o, x, 0, 0, G * 3, G * 5, G * 3, '#9AA3A8'); C(o, x, G, 0, G * 3.5, G * 3, G * 3.5, '#9AA3A8'); C(o, x, G * 2, G * 1.6, G * 1.5, G * 1.5, G / 2, '#2B2F33'); }
    },
    // Tapete neutro bege com borda mais escura.
    hygge_c25_carpet(o, { w, d }) {
      C(o, 0, 0, 0, w - G * 2, G / 2, d - G * 2, '#B88C62'); C(o, 0, G / 4, 0, w - G * 4, G / 2, d - G * 4, '#E2C79E');
      for (let k = 0; k < Math.floor((d - G * 6) / (G * 3)); k++) C(o, 0, G / 2, -d / 2 + G * 4 + k * G * 3, w - G * 6, G / 4, G / 2, '#D2B48A');
    },
    // Planta pendente num vaso de macramê, folhas caindo.
    recycler_bottleplant(o) {
      for (const a of [-1, 1]) C(o, a * G * 1.5, G * 8, 0, G / 4, G * 16, G / 4, '#C9A983');
      C(o, 0, G * 6, 0, G * 4, G * 3, G * 4, '#E9DCC4');
      for (let k = 0; k < 10; k++) { const a = k * 2.2; C(o, Math.cos(a) * G * 2.5, G * (9 - (k % 4) * 1.5), Math.sin(a) * G * 2.5, G * 1.5, G * 2, G * 1.5, ['#3E8F4E', '#4FA35A', '#6BBF5E'][k % 3]); }
    },
    // Pilha de toras de cabana: toras deitadas com o anel claro na ponta.
    xmas_c22_roofblock(o, { w, d }) {
      const s = Math.min(w, d) - G, c = '#8A5A3C';
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) {
        const z = -s / 2 + G * 3 + k * G * 5 + (r === 2 ? G * 2.5 : 0), y = r * G * 4.5;
        C(o, 0, y, z, s, G * 4.5, G * 4.5, r % 2 ? tom(c, -.08) : c);
        C(o, s / 2, y + G, z, G / 2, G * 2.5, G * 2.5, '#D9B48A'); C(o, s / 2 + G / 4, y + G * 1.8, z, G / 4, G, G, '#B98A55');
      }
    },
    // Parede de toras: toras horizontais empilhadas, finas.
    wintercabin_c19_wall(o, { w }) {
      const c = '#8A5A3C';
      for (let k = 0; k < 10; k++) C(o, 0, k * G * 3.2, -G * 6, w, G * 3.2, G * 3, k % 2 ? tom(c, -.1) : c);
    },
    // Divisória de vidro: dois postes de metal e o painel azul-gelo.
    olympics_c16_glssdvdr(o, { w }) {
      const s = Math.max(.9, w - G * 2);
      for (const a of [-1, 1]) C(o, a * s / 2, 0, 0, G * 1.5, G * 16, G * 1.5, METAL);
      L(o, 0, G, 0, s - G * 2, G * 14, G / 2, '#CDEBF5');
    },

    // Fogueira viking: moldura de toras no chão, lenha, fogo aceso, tripé de galhos e o caldeirão pendurado.
    vikings_indoorstove(o, { w, d }) {
      const s = Math.min(w, d) - G * 2, mad = '#6E4B33';
      for (const a of [-1, 1]) { C(o, a * (s / 2 - G), 0, 0, G * 2, G * 2, s, mad); C(o, 0, 0, a * (s / 2 - G), s, G * 2, G * 2, tom(mad, -.1)); }
      C(o, 0, 0, 0, s - G * 4, G / 2, s - G * 4, '#4A403A');
      for (let k = 0; k < 4; k++) C(o, (k - 1.5) * G * 1.6, G / 2, 0, G * 1.2, G, G * 5, k % 2 ? '#5E4030' : '#8A5A3C');
      L(o, 0, G * 1.5, 0, G * 3, G * 3, G * 3, '#FF8A2B'); L(o, 0, G * 3, 0, G * 2, G * 2, G * 2, '#FFC64D'); L(o, G / 2, G * 4.5, 0, G, G * 1.5, G, '#FFE38A');
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (let k = 0; k < 8; k++) C(o, a * (G * 5 - k * G * .55), k * G * 1.6, b * G * 1.5, G, G * 1.8, G, '#7A5534'); // galhos do tripé
      C(o, 0, G * 13, 0, G * 7, G, G, '#7A5534');
      C(o, 0, G * 9, 0, G / 4, G * 4, G / 4, '#3A3F44');
      C(o, 0, G * 6, 0, G * 4, G * 3, G * 4, '#2B2F33'); L(o, 0, G * 9, 0, G * 3, G / 2, G * 3, '#E5703A');
    },
    // Tapete de urso polar: pele branca com as quatro patas abertas e a cabeça com orelhas e focinho.
    carpet_polar(o, { w, d }) {
      const b = '#F7F5F0', s = '#E2DED4', L2 = Math.min(w, d);
      C(o, 0, 0, 0, L2 * .55, G / 2, L2 * .75, b); C(o, 0, G / 4, 0, L2 * .45, G / 2, L2 * .6, s);
      for (const a of [-1, 1]) for (const c of [-1, 1]) C(o, a * L2 * .33, 0, c * L2 * .25, L2 * .2, G / 2, G * 3, b);
      C(o, 0, 0, L2 * .43, G * 6, G * 2, G * 5, b); C(o, 0, G * 2, L2 * .43, G * 5, G, G * 4, s);
      for (const a of [-1, 1]) { C(o, a * G * 2.5, G * 2, L2 * .43 - G * 1.5, G * 1.5, G * 1.5, G, b); C(o, a * G * 1.3, G * 2, L2 * .43 + G * 1.2, G / 2, G / 2, G / 4, '#2B2F33'); }
      C(o, 0, G, L2 * .43 + G * 2.6, G * 2, G, G, s); C(o, 0, G * 1.5, L2 * .43 + G * 3.1, G, G / 2, G / 4, '#2B2F33');
    },
    // Barril de madeira com cintas de metal e água em cima.
    st_wildwest_barrel(o) {
      const m = '#9A6A3E';
      C(o, 0, 0, 0, G * 7, G * 2, G * 7, tom(m, -.1)); C(o, 0, G * 2, 0, G * 8, G * 8, G * 8, m); C(o, 0, G * 10, 0, G * 7, G * 2, G * 7, tom(m, -.1));
      for (const y of [G * 1.5, G * 5.5, G * 10]) C(o, 0, y, 0, G * 8.4, G / 2, G * 8.4, '#5A6268');
      for (let k = 0; k < 4; k++) C(o, -G * 3 + k * G * 2, G * 2, G * 4.1, G / 4, G * 8, G / 4, tom(m, -.25));
      L(o, 0, G * 11.5, 0, G * 6, G / 2, G * 6, '#7FC8E8');
    },
    // Banquinho viking: três pés grossos de madeira escura e o assento rústico.
    vikings_stool(o) {
      const m = '#5E4030';
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; C(o, Math.cos(a) * G * 2.5, 0, Math.sin(a) * G * 2.5, G * 1.5, G * 6, G * 1.5, m); }
      C(o, 0, G * 6, 0, G * 7, G * 1.5, G * 6, tom(m, .1)); C(o, G, G * 7.5, G / 2, G * 3, G / 4, G * 2, tom(m, .2));
    },
    // Mesa cyberpunk: tampo preto, painéis laterais em ângulo e o filete de luz azul-esverdeada.
    cpunk_c15_table(o, { w, d }) {
      const tw = w - G * 2, td = d - G * 2, h = .72;
      C(o, 0, h - G * 2, 0, tw, G * 2, td, '#1F2326'); L(o, 0, h - G * 2.5, td / 2 - G / 2, tw, G / 2, G / 2, '#3FE0C8');
      for (const a of [-1, 1]) { C(o, a * (tw / 2 - G * 2), 0, 0, G * 2, h - G * 2, td - G * 2, '#2B3035'); L(o, a * (tw / 2 - G * 2.6), G * 2, 0, G / 4, h - G * 6, G / 2, '#3FE0C8'); }
    },
    // Churrasqueira de bola: três pés, a bola preta e a tampa com o puxador.
    hblooza_bbq(o) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; for (let j = 0; j < 4; j++) C(o, Math.cos(a) * G * (3 - j * .5), j * G * 2, Math.sin(a) * G * (3 - j * .5), G / 2, G * 2, G / 2, '#3A3F44'); }
      C(o, 0, G * 8, 0, G * 7, G * 3, G * 7, '#22262B'); C(o, 0, G * 11, 0, G * 7.4, G / 2, G * 7.4, '#5A6268');
      C(o, 0, G * 11.5, 0, G * 6, G * 2, G * 6, '#2B2F33'); C(o, 0, G * 13.5, 0, G * 4, G, G * 4, '#2B2F33'); C(o, 0, G * 14.5, 0, G * 2, G / 2, G / 2, METAL);
    },
    // Porta de cabana de toras com a janelinha azul.
    xmas_c22_door(o, { w }) {
      const m = '#8A5A3C', s = Math.max(.8, w - G * 2);
      for (let k = 0; k < 5; k++) C(o, -s / 2 + s / 10 + k * s / 5, 0, -G * 6, s / 5 - G / 4, G * 30, G * 2, k % 2 ? tom(m, -.08) : m);
      C(o, 0, G * 30, -G * 6, s + G, G * 1.5, G * 3, tom(m, -.2));
      L(o, s / 5, G * 20, -G * 4.9, G * 4, G * 5, G / 4, '#9AD8F0'); C(o, s / 5, G * 22.5, -G * 4.8, G * 4, G / 2, G / 4, m);
      C(o, -s / 4, G * 14, -G * 4.8, G, G, G, '#C9A34A');
    },

    // ---------- lote 3 (Mizinho, Reriston, Ewerton e Taynara) ----------
    // Cabine de DJ: corpo preto com painel roxo aceso e estrelas, duas pick-ups em cima.
    classic7_djbooth(o, { w }) {
      const s = Math.max(1.2, w - G * 2);
      C(o, 0, 0, -G * 2, s, G * 13, G * 8, '#22262B'); L(o, 0, G * 2, G * 2.1, s - G * 3, G * 9, G / 2, '#B45CE0');
      for (let k = 0; k < 3; k++) L(o, -s / 3 + k * s / 3, G * 5, G * 2.5, G * 2, G * 2, G / 2, '#7FE3FF');
      C(o, 0, G * 13, -G * 2, s + G, G, G * 8.5, '#3A3F44');
      for (const a of [-1, 1]) { C(o, a * s / 4, G * 14, -G * 2, G * 5, G, G * 5, '#1F1D1A'); C(o, a * s / 4, G * 15, -G * 2, G * 3.5, G / 2, G * 3.5, '#5A6268'); C(o, a * s / 4, G * 15.5, -G * 2, G, G / 2, G, '#E5484D'); }
      C(o, 0, G * 14, -G * 2, G * 3, G, G * 4, '#2B2F33'); for (let k = 0; k < 3; k++) L(o, -G + k * G, G * 15, -G * .5, G / 2, G / 2, G / 2, LIVROS[k]);
    },
    // Grua de câmera de estúdio: tripé, braço comprido e a câmera na ponta.
    studio_camera(o) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; for (let j = 0; j < 4; j++) C(o, Math.cos(a) * G * (3 - j * .6), j * G * 2, Math.sin(a) * G * (3 - j * .6), G, G * 2, G, '#3A3F44'); }
      C(o, 0, G * 8, 0, G * 2, G * 4, G * 2, '#2B2F33');
      for (let k = 0; k < 8; k++) C(o, -G * 4 + k * G * 2, G * 12 + k * G * 1.2, 0, G * 2.2, G, G, '#9AA3A8');
      C(o, -G * 5, G * 10.5, 0, G * 3, G * 3, G * 3, '#5A6268'); // contrapeso
      C(o, G * 12, G * 20, 0, G * 4, G * 3, G * 3, '#1F1D1A'); C(o, G * 14.5, G * 20.5, 0, G * 1.5, G * 2, G * 2, '#3A3F44'); L(o, G * 15.3, G * 21, 0, G / 2, G, G, '#7FC8E8');
    },
    // Câmera no tripé.
    runway_camera(o) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; for (let j = 0; j < 6; j++) C(o, Math.cos(a) * G * (4 - j * .6), j * G * 2, Math.sin(a) * G * (4 - j * .6), G, G * 2, G, '#2B2F33'); }
      C(o, 0, G * 12, 0, G * 2, G * 2, G * 2, '#3A3F44');
      C(o, 0, G * 14, 0, G * 5, G * 4, G * 3, '#1F1D1A'); C(o, 0, G * 15, G * 2, G * 2.5, G * 2.5, G * 2, '#3A3F44'); L(o, 0, G * 15.5, G * 3, G * 1.5, G * 1.5, G / 2, '#7FC8E8');
      C(o, 0, G * 18, -G * .5, G * 2, G, G * 2, '#3A3F44'); L(o, G * 2, G * 17, -G, G / 2, G / 2, G / 2, '#E5484D');
    },
    // Banqueta de palco: pés cromados com aro e assento preto redondo.
    studio_stool(o) {
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(o, a * G * 2.5, 0, b * G * 2.5, G, G * 10, G, METAL);
      C(o, 0, G * 4, 0, G * 6, G / 2, G * 6, METAL); C(o, 0, G * 4, 0, G * 5, G / 2, G * 5, '#FFFFFF');
      C(o, 0, G * 10, 0, G * 7, G * 2, G * 7, '#1F1D1A'); C(o, 0, G * 12, 0, G * 6, G / 2, G * 6, '#3A3F44');
    },
    // Poltrona de cinema preta, encosto alto e pés de madeira.
    theatre_seat_b(o) { BIBLIOTECA_UTIL.poltrona(o, { estofado: '#22262B', pes: '#8A5A3C', alto: 1.1 }); },
    // Banco de rua de Miami: armação lilás curva e assentos azuis vazados.
    vwave_c21_bench(o, { w }) {
      const s = Math.max(1.4, w - G * 2), az = '#2FA7C8';
      for (const a of [-1, 1]) { C(o, a * (s / 2 - G), 0, 0, G, G * 7, G * 7, '#C88CE0'); C(o, a * (s / 2 - G), G * 7, -G * 3, G, G * 7, G, '#C88CE0'); }
      for (const a of [-.25, .25]) { const x = a * s; C(o, x, G * 6, 0, s / 2 - G * 2, G, G * 6, az); C(o, x, G * 7, -G * 3, s / 2 - G * 2, G * 6, G, az); for (let k = 0; k < 4; k++) C(o, x - s / 6 + k * s / 18, G * 7, -G * 2.9, G / 2, G * 5, G / 4, tom(az, -.3)); }
    },
    // Mesa de bar de Miami: base vinho arredondada, tampo preto e o friso dourado.
    vwave_c21_bartable(o, { w, d }) {
      const tw = w - G * 2, td = d - G * 2, h = .9;
      C(o, 0, 0, 0, tw - G * 2, h - G * 2, td - G * 2, '#5A1E2A'); for (const a of [-1, 1]) C(o, a * (tw / 2 - G * 2), 0, 0, G * 3, h - G * 2, td - G * 4, '#4A1822');
      C(o, 0, h - G * 2.5, 0, tw, G / 2, td, '#C9A34A'); C(o, 0, h - G * 2, 0, tw, G * 2, td, '#1F1D1A'); C(o, 0, h - G / 2, 0, tw - G * 2, G / 2, td - G * 2, '#3A3F44');
    },
    // Cristaleira da mansão: madeira escura, portas de vidro aceso com garrafas coloridas.
    mafia_c26_drinkcabinet(o, { w }) { BIBLIOTECA_UTIL.cristaleira(o, { w, madeira: '#4A2A1E', vidro: '#F4E3B0', alto: 1.5 }); },
    // Adega de titânio: corpo cinza-metal, vidro aceso e garrafas.
    js_c16_drkcab(o, { w }) { BIBLIOTECA_UTIL.cristaleira(o, { w, madeira: '#5A6268', vidro: '#DCEFFF', alto: 1.1 }); },
    // Cama criogênica: base escura com luzes azuis, cápsula de vidro e tanques nas pontas.
    scifi_r17_bed(o, { w, d }) {
      const bw = w - G * 4, bd = d - G * 2;
      C(o, 0, 0, 0, bw, G * 5, bd, '#2B2F33'); L(o, 0, G * 2, bd / 2, bw - G * 2, G, G / 2, '#3FC8F0');
      C(o, 0, G * 5, 0, bw - G * 2, G * 2, bd - G * 4, '#E2E6EA'); L(o, 0, G * 7, 0, bw - G * 3, G * 3, bd - G * 6, '#BFE6F2');
      for (const b of [-1, 1]) { C(o, 0, G * 5, b * (bd / 2 - G * 2), bw, G * 6, G * 3, '#3A3F44'); L(o, 0, G * 11, b * (bd / 2 - G * 2), G * 4, G * 2, G * 2, '#3FC8F0'); }
      C(o, bw / 2 - G * 2, G * 11, -bd / 2 + G * 2, G * 3, G * 4, G * 3, '#9AA3A8');
    },
    // Rede entre dois postes de galho com trepadeira, almofadas coloridas.
    easter_c23_cosyhammock(o, { w, d }) {
      const s = Math.max(1.2, Math.max(w, d) - G * 2);
      for (const a of [-1, 1]) { C(o, a * s / 2, 0, 0, G * 2, G * 22, G * 2, '#7A5534'); for (let k = 0; k < 4; k++) C(o, a * s / 2 + G, G * (6 + k * 4), G, G, G * 1.5, G, '#4FA35A'); }
      for (let k = 0; k < 8; k++) { const t = (k + .5) / 8, x = -s / 2 + t * s, y = G * 10 - Math.sin(t * Math.PI) * G * 5; C(o, x, y, 0, s / 8 + G / 2, G, G * 7, '#E9DCC4'); }
      C(o, -s / 6, G * 7, 0, G * 4, G * 2, G * 4, '#F06EA0'); C(o, s / 8, G * 6.5, G, G * 3, G * 2, G * 3, '#4FA35A');
      for (const a of [-1, 1]) C(o, a * (s / 2 - G * 2), G * 11, 0, G * 3, G / 2, G / 2, '#C9A983');
    },
    // Ofurô: tina redonda de madeira com cintas, água azul e as toalhas na borda.
    val15_hottub(o, { w, d }) {
      const s = Math.min(w, d) - G * 2, m = '#9A6A3E';
      C(o, 0, 0, 0, s, G * 9, s * .82, m); C(o, 0, 0, 0, s * .82, G * 9, s, m);
      for (const y of [G * 2, G * 7]) { C(o, 0, y, 0, s + G / 2, G / 2, s * .82 + G / 2, '#5A6268'); C(o, 0, y, 0, s * .82 + G / 2, G / 2, s + G / 2, '#5A6268'); }
      L(o, 0, G * 8, 0, s * .72, G, s * .72, '#5FC8E0');
      C(o, -s / 4, G * 9, s / 2 - G, G * 6, G * 2, G * 3, '#F4B9A0'); C(o, s / 6, G * 9, s / 2 - G, G * 4, G * 1.5, G * 3, '#F7F2E8');
    },
    // Chuveiro de praia: base de pedra, cano prata em L e o chuveiro.
    bw_shower(o) {
      C(o, 0, 0, 0, G * 8, G, G * 8, '#B8AE9F'); C(o, 0, G, 0, G * 6, G / 2, G * 6, '#7FC8E8');
      C(o, -G * 2, G, -G * 2, G, G * 24, G, METAL); C(o, 0, G * 24, -G * 2, G * 5, G, G, METAL); C(o, G * 2, G * 22.5, -G * 2, G * 3, G * 1.5, G * 3, '#D7DCE0');
      C(o, -G * 2, G * 10, -G * 1.4, G * 1.5, G * 1.5, G / 2, '#E5484D');
    },
    // Bebedouro: corpo branco e cinza, galão azul em cima e as duas torneiras.
    matic_water_dispenser(o) {
      C(o, 0, 0, 0, G * 6, G * 14, G * 6, '#E9EEF2'); C(o, 0, 0, 0, G * 6.2, G * 3, G * 6.2, '#9AA3A8');
      C(o, 0, G * 7, G * 3, G * 4, G * 3, G / 2, '#3A3F44'); C(o, -G, G * 8, G * 3.4, G, G, G, '#3D7DD8'); C(o, G, G * 8, G * 3.4, G, G, G, '#E5484D');
      L(o, 0, G * 14, 0, G * 5, G * 8, G * 5, '#9AD8F0'); C(o, 0, G * 22, 0, G * 3, G, G * 3, '#3D7DD8');
    },
    // Tabuleiro de xadrez dourado no chão, com as peças.
    CF_250_goldenchessboard(o, { w, d }) {
      const s = Math.min(w, d) - G * 2, n = 8, c = s / n;
      C(o, 0, 0, 0, s + G, G, s + G, '#8A5A2E');
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) C(o, -s / 2 + c * (i + .5), G, -s / 2 + c * (j + .5), c, G / 2, c, (i + j) % 2 ? '#F2C230' : '#C9862E');
      for (let k = 0; k < 8; k++) for (const lado of [0, 7]) { const x = -s / 2 + c * (k + .5), z = -s / 2 + c * (lado + .5), cor = lado ? '#FFF2C8' : '#8A5A2E', h = k === 3 || k === 4 ? G * 4 : k === 0 || k === 7 ? G * 2.5 : G * 3; C(o, x, G * 1.5, z, c * .55, h, c * .55, cor); C(o, x, G * 1.5 + h, z, c * .35, G, c * .35, tom(cor, .15)); }
      for (let k = 0; k < 8; k++) for (const lado of [1, 6]) C(o, -s / 2 + c * (k + .5), G * 1.5, -s / 2 + c * (lado + .5), c * .4, G * 2, c * .4, lado === 6 ? '#FFF2C8' : '#8A5A2E');
    },
    // Mesa de centro clássica: madeira avermelhada, tampo com painel e pés quadrados.
    classic1_table2(o, { w, d }) {
      const m = '#8A2E22', tw = w - G * 2, td = d - G * 2, h = .42;
      pernas(o, tw - G * 2, td - G * 2, h - G * 2, tom(m, -.2), G * 1.5);
      C(o, 0, h - G * 2, 0, tw, G * 2, td, m); C(o, 0, h - G / 2, 0, tw - G * 4, G / 2, td - G * 4, tom(m, -.12));
      C(o, 0, h - G * 4, 0, tw - G * 2, G * 2, td - G * 2, tom(m, -.1));
    },
    // Mesa de reunião de mogno: corpo fechado com painéis, tampo com vidros e o friso dourado.
    army15_ltddesk(o, { w, d }) {
      const m = '#5A2E1E', tw = w - G * 2, td = d - G * 2, h = .76;
      C(o, 0, 0, 0, tw, h - G * 2, td, m);
      for (let k = 0; k < 3; k++) { C(o, -tw / 3 + k * tw / 3, G * 2, td / 2, tw / 3 - G * 2, h - G * 6, G / 2, tom(m, .12)); C(o, -tw / 3 + k * tw / 3, h / 2, td / 2 + G / 2, G * 2, G, G / 2, '#C9A34A'); }
      C(o, 0, h - G * 2, 0, tw + G, G * 2, td + G, tom(m, .1));
      for (let k = 0; k < 3; k++) L(o, -tw / 3 + k * tw / 3, h - G / 2, 0, tw / 3 - G * 3, G / 2, td - G * 4, '#7FA9A0');
    },
    // Estante de brechó: madeira escura, livros, uma planta pendente e a coroa de flores.
    easter_c23_bookshelf(o) {
      const m = '#6E3F2A';
      C(o, 0, 0, -G * 2, G * 10, G * 22, G * 7, m);
      for (let k = 0; k < 3; k++) { const y = G * 3 + k * G * 6.5; C(o, 0, y, -G * 1, G * 8, G * 5, G * 4, tom(m, -.35)); for (let j = 0; j < 5; j++) C(o, -G * 3 + j * G * 1.6, y, G * .5, G * 1.2, G * (3 + (j * 7 + k) % 3), G * 3, LIVROS[(j + k * 2) % LIVROS.length]); }
      C(o, 0, G * 22, -G * 2, G * 11, G, G * 8, tom(m, .12));
      C(o, G * 2, G * 23, -G * 2, G * 3, G * 2, G * 3, '#D9774B'); for (let k = 0; k < 6; k++) C(o, G * 2 + (k % 2 ? G : -G), G * (25 - k * 2.2), -G + k % 3 * G / 2, G * 1.5, G * 1.5, G * 1.5, ['#3E8F4E', '#4FA35A', '#6BBF5E'][k % 3]);
    },
    // Frigobar esportivo: preto com a porta vermelha e o puxador.
    ads_drsports_fridge(o) {
      C(o, 0, 0, -G, G * 9, G * 11, G * 8, '#22262B'); C(o, -G / 2, G, G * 3.1, G * 7, G * 9, G, '#C8302C'); C(o, G * 2.8, G * 3, G * 3.8, G / 2, G * 5, G / 2, '#D7DCE0');
      C(o, 0, G * 11, -G, G * 9.5, G, G * 8.5, '#3A3F44');
    },
    // Geladeira de bebidas azul com a porta de vidro aceso e o raio amarelo.
    habbo25_sc25_drinksdispenser(o) {
      C(o, 0, 0, -G, G * 10, G * 14, G * 9, '#3D55C8'); L(o, -G / 2, G * 2, G * 3.6, G * 7, G * 10, G / 2, '#BFE6F2');
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) C(o, -G * 2.5 + k * G * 2, G * 3 + r * G * 3, G * 3.8, G * 1.2, G * 2, G / 2, ['#F2C230', '#E5484D', '#4FA35A'][(r + k) % 3]);
      C(o, G * 4, G * 5, G * 3.7, G, G * 4, G / 2, '#F2C230'); C(o, 0, G * 14, -G, G * 10.5, G, G * 9.5, '#2E40A0');
    },
    // Violão no suporte.
    studio_guitar(o) {
      C(o, 0, 0, 0, G * 4, G / 2, G * 3, '#2B2F33'); C(o, 0, G / 2, -G, G / 2, G * 6, G / 2, '#2B2F33');
      C(o, 0, G, 0, G * 6, G * 5, G * 2, '#D9A45E'); C(o, 0, G * 6, 0, G * 5, G * 4, G * 2, '#D9A45E'); C(o, 0, G * 4, G * 1.1, G * 1.5, G * 1.5, G / 4, '#3A2A1E');
      C(o, 0, G * 10, 0, G, G * 9, G, '#6E4B33'); C(o, 0, G * 19, 0, G * 1.5, G * 2.5, G, '#3A2A1E');
    },
    // Setup gamer: mesa preta em L com três monitores, teclado azul aceso e mouse.
    gaming_c18_setuppro(o, { w, d }) {
      const tw = w - G * 2, td = d - G * 2, h = .72;
      C(o, 0, h - G * 2, 0, tw, G * 2, td, '#1F2326'); for (const a of [-1, 1]) C(o, a * (tw / 2 - G * 2), 0, 0, G * 2, h - G * 2, td - G * 2, '#2B2F33');
      for (const a of [-1, 0, 1]) { const x = a * G * 8; C(o, x, h, -td / 2 + G * 3, G * 2, G * 2, G * 2, '#2B2F33'); C(o, x, h + G * 2, -td / 2 + G * 3 + (a ? G : 0), G * 8, G * 5, G, '#17181A'); L(o, x, h + G * 2.5, -td / 2 + G * 3.6 + (a ? G : 0), G * 7, G * 4, G / 4, '#3A5A9E'); }
      C(o, -G, h, G * 2, G * 9, G / 2, G * 3, '#22262B'); L(o, -G, h + G / 2, G * 2, G * 8, G / 4, G * 2, '#3D7DD8'); C(o, G * 6, h, G * 2, G * 1.5, G / 2, G * 2, '#22262B');
    },
    // Poltrona luxuosa: chesterfield verde-água de um lugar.
    xmas11_luxchair1(o, { w, d }) { BIBLIOTECA_UTIL.chesterfield(o, { w, d, cor: '#CFE8DA' }); },
    // Sofá público: estrutura preta e almofadas turquesa.
    public_x_sofa(o, { w, d }) { BIBLIOTECA_UTIL.sofaModerno(o, { w, d, tecido: '#5FD3C3', lado: '#22262B' }); },
    // Cronômetro: barra preta comprida com o visor laranja.
    bb_counter(o, { w }) {
      const s = Math.max(1, w - G * 2); C(o, 0, 0, 0, s, G * 2, G * 3, '#22262B'); C(o, 0, G * 2, 0, s, G / 2, G * 3, '#3A3F44');
      L(o, -s / 2 + G * 3, G * .5, G * 1.6, G * 2, G, G / 4, '#FF8A2B');
    },
    // Presentes de Natal: três caixas com laço.
    xmas_c18_presents(o) {
      for (const [x, z, s, cor, laco] of [[-G * 2, G, G * 5, '#E5484D', '#FFFFFF'], [G * 3, -G * 2, G * 6, '#4FA35A', '#F2C230'], [G * 2.5, G * 3, G * 4, '#3D7DD8', '#F2C230']]) {
        C(o, x, 0, z, s, s, s, cor); C(o, x, 0, z, G, s + G / 4, s + G / 4, laco); C(o, x, 0, z, s + G / 4, s + G / 4, G, laco); C(o, x, s, z, G * 2, G, G, laco);
      }
    },
    // Sacola de presente azul com bolinhas e o coração.
    val15_gift3(o) {
      C(o, 0, 0, 0, G * 6, G * 7, G * 4, '#5FB0E0'); for (let k = 0; k < 6; k++) C(o, -G * 2 + (k % 3) * G * 2, G * 1.5 + Math.floor(k / 3) * G * 3, G * 2.05, G, G, G / 4, '#F7F2E8');
      C(o, 0, G * 7, 0, G * 4, G * 2, G / 2, '#F4EFE6'); C(o, -G, G * 7, -G, G * 3, G * 3, G, '#E5484D'); C(o, G * 2, G * 7, G / 2, G / 2, G * 3, G / 2, '#4FA35A');
    },
    // Caixa de presente rosa com laço vermelho.
    giftbox_c25_crackable5(o) {
      C(o, 0, 0, 0, G * 9, G * 8, G * 9, '#F06E8C'); C(o, 0, G * 8, 0, G * 9.5, G * 1.5, G * 9.5, '#F48BA4');
      C(o, 0, 0, 0, G * 1.5, G * 9.8, G * 9.7, '#C8302C'); C(o, 0, 0, 0, G * 9.7, G * 9.8, G * 1.5, '#C8302C');
      for (const a of [-1, 1]) C(o, a * G * 2, G * 9.5, 0, G * 3, G * 2, G * 2, '#E5484D');
      C(o, 0, G * 3, G * 4.6, G * 2.5, G * 2.5, G / 4, '#F2C230');
    },
    // Suporte de armas: base de madeira com encaixes e as peças cinza.
    mafia_c26_gunrack(o, { w }) {
      const s = Math.max(1, w - G * 2);
      for (const a of [-1, 1]) C(o, a * (s / 2 - G * 2), 0, 0, G * 3, G * 7, G * 6, '#6E3F2A');
      C(o, 0, G * 3, 0, s - G * 4, G, G * 5, '#5A2E1E');
      for (let k = 0; k < 4; k++) C(o, -s / 2 + G * 5 + k * (s - G * 10) / 3, G * 4, 0, G * 1.5, G * 2, G * 6, k % 2 ? '#5A6268' : '#3A3F44');
    },
    // Aquário da tartaruga: vidro, água, pedras e a tartaruga.
    virus_r16_turttank(o, { w, d }) {
      const s = Math.min(w, d) - G * 2;
      C(o, 0, 0, 0, s, G, s, '#5A6268'); C(o, 0, G, 0, s - G, G, s - G, '#C9B48A');
      L(o, 0, G * 2, 0, s - G * 1.5, G * 7, s - G * 1.5, '#9AD8F0');
      for (let k = 0; k < 4; k++) C(o, -s / 4 + (k % 2) * s / 3, G * 2, -s / 4 + Math.floor(k / 2) * s / 3, G * 2, G * 1.5, G * 2, '#8E959B');
      C(o, s / 6, G * 2, s / 6, G * 4, G * 2, G * 3, '#4FA35A'); C(o, s / 6, G * 4, s / 6, G * 3, G, G * 2, '#3E8F4E'); C(o, s / 6 + G * 2.5, G * 2.5, s / 6, G * 1.5, G * 1.5, G * 1.5, '#7DBB5E');
    },
    // Lampião do galho: tronco retorcido com folhas e a lanterna verde acesa pendurada.
    hween12_lantern(o, { w }) {
      const s = Math.max(1, w - G * 2);
      for (let k = 0; k < 10; k++) C(o, -s / 2 + G * 2 + k * G * 1.6, G * (k < 3 ? k * 3 : 9 + Math.sin(k) * 1.5), 0, G * 2.5, G * 2.5, G * 2.5, '#5E4030');
      for (let k = 0; k < 6; k++) C(o, -s / 2 + G * 4 + k * G * 2.5, G * 12 + (k % 2) * G, (k % 3 - 1) * G * 2, G * 3, G * 2, G * 3, ['#3E8F4E', '#4FA35A', '#2E6B3A'][k % 3]);
      C(o, s / 4, G * 6, 0, G / 4, G * 4, G / 4, '#3A3F44'); C(o, s / 4, G * 2, 0, G * 3, G * 4, G * 3, '#2E3A2A'); L(o, s / 4, G * 2.5, 0, G * 2, G * 3, G * 2, '#9CFF7A');
    },
    // Fio de lâmpadas pendurado entre dois postes.
    circus_c24_hanginglights(o, { w }) {
      const s = Math.max(1, w - G * 2);
      for (const a of [-1, 1]) C(o, a * s / 2, 0, 0, G, G * 26, G, '#3A3F44');
      for (let k = 0; k <= 10; k++) { const t = k / 10, x = -s / 2 + t * s, y = G * 26 - Math.sin(t * Math.PI) * G * 6; C(o, x, y, 0, s / 10, G / 4, G / 4, '#2B2F33'); if (k % 2) { C(o, x, y - G, 0, G / 2, G, G / 2, '#3A3F44'); L(o, x, y - G * 2.5, 0, G * 1.5, G * 1.5, G * 1.5, '#FFD27A'); } }
    },
    // Mesa redonda de madeira entalhada sobre um pé de barril.
    bubblejuice_c21_table(o, { w, d }) {
      const s = Math.min(w, d) - G * 2, m = '#9A5E34';
      C(o, 0, 0, 0, G * 6, G * 10, G * 6, tom(m, -.15)); for (const y of [G * 2, G * 7]) C(o, 0, y, 0, G * 6.4, G / 2, G * 6.4, '#5A6268');
      C(o, 0, G * 10, 0, s, G * 1.5, s * .8, m); C(o, 0, G * 10, 0, s * .8, G * 1.5, s, m);
      C(o, 0, G * 11.5, 0, s * .5, G / 4, s * .4, tom(m, -.2)); C(o, 0, G * 11.5, 0, s * .2, G / 4, s * .5, tom(m, -.2));
    },
    // Tapetes: escuro moderno, felpudo branco e o persa antigo com borda e franja.
    darkmodern_c20_rug(o, { w, d }) { C(o, 0, 0, 0, w - G * 2, G / 2, d - G * 2, '#7A6E66'); for (let k = 0; k < 20; k++) C(o, -w / 2 + G * 2 + ((k * 7) % 19) * (w - G * 4) / 19, G / 2, -d / 2 + G * 2 + ((k * 11) % 17) * (d - G * 4) / 17, G, G / 4, G, '#8E827A'); },
    kuurna_mat(o, { w, d }) { C(o, 0, 0, 0, w - G * 2, G, d - G * 2, '#F4F1EA'); for (let k = 0; k < 30; k++) C(o, -w / 2 + G * 2 + ((k * 7) % 23) * (w - G * 4) / 23, G, -d / 2 + G * 2 + ((k * 13) % 19) * (d - G * 4) / 19, G / 2, G / 2, G / 2, '#FFFFFF'); },
    attic15_carpet(o, { w, d }) {
      C(o, 0, 0, 0, w - G * 2, G / 2, d - G * 2, '#8A2E2A'); C(o, 0, G / 4, 0, w - G * 5, G / 2, d - G * 5, '#B2443A');
      C(o, 0, G / 2, 0, (w - G * 5) * .4, G / 4, (d - G * 5) * .4, '#E8C27A'); C(o, 0, G * .6, 0, (w - G * 5) * .2, G / 4, (d - G * 5) * .2, '#2E5A8A');
      for (let k = 0; k < Math.floor((w - G * 2) / G / 2); k++) for (const b of [-1, 1]) C(o, -w / 2 + G * 2 + k * G * 2, 0, b * (d / 2 - G / 2), G / 2, G / 4, G, '#F4EFE6');
    },
  };
}
