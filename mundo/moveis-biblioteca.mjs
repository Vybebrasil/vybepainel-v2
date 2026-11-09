// Biblioteca de móveis dos quartos da equipe, modelados um a um olhando a arte de cada um no Habbo (Paulo,
// 09/11/2026: "objetos e cenário MUITO BEM FEITO", com as referências de quarto voxel). Vale antes da receita do
// tipo (moveis-voxel.mjs). Mesma convenção: frente +z, centro da pegada em 0, base 0, grade de 1/16 de ladrilho.
// As cores são as do desenho do Habbo; as formas, as do estilo das referências (limpas, com detalhe de verdade).
// Estátuas e figuras (patinador, coelho, árvore mística) continuam esculpidas: são formas orgânicas.
// Recebe as ferramentas do motor (C caixa, L luz, G grade, tom, gaveta, LIVROS, RECEITAS, METAL) para não haver
// importação circular.
export function biblioteca({ C, L, G, tom, gaveta, LIVROS, RECEITAS, METAL }) {
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
  };
}
