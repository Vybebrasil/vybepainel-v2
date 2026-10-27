// Jogos: o salão de jogos do Escritório, refeito no padrão das salas ricas
// (Paulo, 27/10/2026: "achar um padrão de construir que deixa a sala rica,
// como as referências do Habbo; parede só com objeto solto pendurado está
// ruim"). O padrão, o mesmo do Café e do Lounge:
// - piso de verdade (peça com textura) em cada ala, não a textura lisa;
// - parede revestida por ala (azulejo, lambri, papel de saloon) e vestida
//   por móveis encostados (máquinas, estantes, banco, balcão), com os quadros
//   e arandelas por cima, em ritmo;
// - altura: o saloon do pôquer num tablado, com degraus;
// - toda superfície com uso (tabuleiro sobre mesinha, copos e dados nas
//   mesas, garrafas e caixa no balcão) e gente jogando.
// Alas: fliperama (fundo à esquerda), sinuca e pebolim (fundo no meio),
// saloon do pôquer no tablado (fundo à direita), clube do xadrez (frente à
// esquerda), Mesas de Jogos (frente à direita) e o corredor da porta.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  jogador1: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  jogador2: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  torcedor: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  enxadrista: "hr-515-61.hd-600-1.ch-665-1323.lg-700-110.sh-725-110",
  cowboy: "hr-893-45.hd-180-2.ch-3030-1408.lg-280-1408.sh-305-62",
  barman: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62",
};

export default function jogos() {
  const s = novaCena("jogos");
  s.colecao({ fliperama: "tokyo_c18_retroarcade", sinuca: "bling15_pooltable", pebolim: "ads_aftv_footballtable", tabuleiro: "CF_250_goldenchessboard",
    mesaDeJogos: "hobbies_c26_gamingtable", poquer: "wildwest_table", banco: "lodge_dark_barrelstool", poltrona: "classic9_chair",
    cadeiraMesa: "modern_c17_chair", mesinha: "rainyday_c20_woodentable" }, {
    acentos: ["xmas_c16_woodtile", "disco_c26_floor", "hs_carpet", "wildwest_floor", "rainyday_c20_woodenfloor", "classic9_floor2", "xmas_c22_woodenfloor",
      "hygge_c25_wallpaper1", "hygge_c25_wallpaper2", "wildwest_wallpaper", "hween_c20_porchstairs",
      "arcade_c23_space", "arcade_c23_cyberpunk", "arcade_c23_pinball", "graffiti_r24_arcademachine", "vwave_r21_jukebox", "pixel_painting_blue",
      "pixel_painting_red", "pixel_poster2", "cubie_decklight_p", "neonpunk_c20_lights", "grungelamp", "army_c15_light", "cine_light2", "pixel_clock_red",
      "fball_score_b", "fball_score_r", "cine_bench", "wildwest_cabinet", "wildwest_desk", "wildwest_till", "pirate_bottle_1", "pirate_bottle_3",
      "xmas_c24_mugs", "classic2_drinkcup", "edice", "wildwest_light", "mafia_c26_walllamp_dark", "st_wildwest_wallskull", "hween_c26_bookshelf",
      "antique_c21_books", "antique_c21_lamp", "attic15_painting", "mafia_c26_walllamp_white", "classic9_plant", "carpet_standard"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Pisos de verdade, um por ala ---
  s.piso("disco_c26_floor", { x0: 0, y0: 0, x1: 6, y1: 6 });
  s.piso("hs_carpet", { x0: 6, y0: 0, x1: 14, y1: 6 });
  s.piso("wildwest_floor", { x0: 14, y0: 0, x1: 22, y1: 4 });
  s.piso("rainyday_c20_woodenfloor", { x0: 14, y0: 4, x1: 22, y1: 6 });
  s.piso("classic9_floor2", { x0: 0, y0: 6, x1: 6, y1: 14 });
  s.piso("rainyday_c20_woodenfloor", { x0: 6, y0: 6, x1: 14, y1: 14 });
  s.piso("xmas_c22_woodenfloor", { x0: 14, y0: 6, x1: 22, y1: 14 });

  // --- Paredes revestidas por ala ---
  // Revestimento que é textura de ponta a ponta (Paulo, 27/10/2026: "as
  // texturas não tão meio bugadas?"): o pixel_wall é branco com blocos só no
  // alto e o exe_c15_wall é janela com prédios, e os dois pareciam defeito.
  // A parede tem 8,6 níveis (o tablado sobe a cornija) e o papel cobre 4,2:
  // vai em duas faixas, uma em cima da outra, até a cornija.
  for (const altura of [0, 4.2]) {
    s.revestir("fundo", { de: 0, ate: 6, altura, classe: "hygge_c25_wallpaper2", estado: 0 });
    s.revestir("esquerda", { de: 0, ate: 6, altura, classe: "hygge_c25_wallpaper2", estado: 0 });
    s.revestir("fundo", { de: 6, ate: 14, altura, classe: "hygge_c25_wallpaper1", estado: 3 });
    s.revestir("esquerda", { de: 6, ate: 14, altura, classe: "hygge_c25_wallpaper1", estado: 1 });
  }
  s.revestir("fundo", { de: 14, ate: 22, classe: "wildwest_wallpaper", estado: 1 });

  // --- Fliperama: máquinas na parede, banquinhos, pinballs na lateral ---
  s.canto("fliperama", { funcao: "jogar nas máquinas", destaque: "tokyo_c18_retroarcade" });
  for (const [x, c] of [[1, "tokyo_c18_retroarcade"], [3, "arcade_c23_space"], [5, "graffiti_r24_arcademachine"]]) s.por(c, x, 0, { olha: [x, 4] });
  // Fliperama se joga em pé, de frente para a máquina.
  s.figurante({ figura: FIGURAS.jogador1, x: 1, y: 1, dir: 0 });
  // Pinball se joga pela ponta: a cabeceira (o painel alto com a arte) vai
  // encostada na parede e o jogador fica na outra ponta, de frente para ela
  // (Paulo, 27/10/2026: "isso não se joga de lado").
  for (const y of [2, 4]) s.por("arcade_c23_pinball", 0, y, { olha: [4, y] });
  s.figurante({ figura: FIGURAS.jogador2, x: 2, y: 4, dir: 6 });
  s.parede("fundo", { de: 0, ate: 6, altura: 3.2 }, ["pixel_painting_blue", "pixel_painting_red"]);
  s.parede("esquerda", { de: 0, ate: 6, altura: 2.8 }, ["cubie_decklight_p", "pixel_clock_red"]);
  for (const [x, y] of [[4, 3], [5, 1]]) s.pendente("grungelamp", x, y, { estado: 1 });

  // --- Sinuca e pebolim: banco da plateia na parede, placares, luz baixa ---
  s.canto("sinuca", { funcao: "jogar sinuca e pebolim com plateia", destaque: "bling15_pooltable" });
  s.por("bling15_pooltable", 8, 3, { dir: 4 });
  s.pendente("neonpunk_c20_lights", 8, 3);
  s.por("ads_aftv_footballtable", 11, 3);
  s.pendente("neonpunk_c20_lights", 11, 4);
  const plateia = s.assento("cine_bench", 7, 0, [8, 3]);
  s.figurante({ figura: FIGURAS.torcedor, sentado: plateia });
  s.por("fball_score_b", 10, 0, { dir: 4 });
  s.por("fball_score_r", 12, 0, { dir: 4 });
  s.por("vwave_r21_jukebox", 13, 0, { olha: [13, 4] });
  s.parede("fundo", { de: 6, ate: 9.6, altura: 2.6 }, ["cine_light2", "pixel_clock_red", "cine_light2"]);
  s.figurante({ figura: FIGURAS.jogador2, x: 10, y: 2, dir: 6 });

  // --- Saloon do pôquer no tablado: balcão, armário, mesas de barril ---
  s.canto("saloon do pôquer", { funcao: "jogar pôquer no tablado", destaque: "wildwest_table" });
  s.por("wildwest_cabinet", 15, 0, { dir: 4 });
  s.por("wildwest_desk", 19, 0, { dir: 4 });
  s.emCima(19, 0, "wildwest_till", { olha: [19, 3] });
  s.emCima(20, 0, ["pirate_bottle_1"]);
  s.figurante({ figura: FIGURAS.barman, x: 21, y: 0, dir: 4 });
  for (const x of [16, 19]) {
    s.por("wildwest_table", x, 2);
    s.emCima(x, 2, ["classic2_drinkcup"]);
    // Mesa de pôquer com banco nos quatro lados (o jogo é mano a mano; os
    // outros dois são de quem senta para assistir a mão).
    s.assento("lodge_dark_barrelstool", x - 1, 2, [x, 2]);
    s.assento("lodge_dark_barrelstool", x, 1, [x, 2]);
    s.assento("lodge_dark_barrelstool", x, 3, [x, 2]);
    const b = s.assento("lodge_dark_barrelstool", x + 1, 2, [x, 2]);
    if (x === 19) s.figurante({ figura: FIGURAS.cowboy, sentado: b });
    s.pendente("army_c15_light", x, 2, { dir: 2 });
  }
  s.por("wildwest_light", 14, 3);
  s.parede("fundo", { de: 14, ate: 22, altura: 2.4 }, ["mafia_c26_walllamp_dark", "st_wildwest_wallskull", "mafia_c26_walllamp_dark"]);
  s.escada("hween_c20_porchstairs", 17, 4, [0, -1]);

  // --- Clube do xadrez: estantes de livros, tabuleiros sobre mesinhas ---
  s.canto("clube do xadrez", { funcao: "jogar xadrez em silêncio", destaque: "CF_250_goldenchessboard" });
  s.por("hween_c26_bookshelf", 0, 6, { olha: [3, 6] });
  s.por("hween_c26_bookshelf", 0, 12, { olha: [3, 12] });
  for (const y of [8, 11]) {
    s.por("rainyday_c20_woodentable", 3, y);
    s.emCima(3, y, "CF_250_goldenchessboard");
    // Xadrez se joga frente a frente, uma cadeira de cada lado do tabuleiro
    // (Paulo, 27/10/2026: "quem joga xadrez de lado um pro outro?").
    s.assento("classic9_chair", 2, y, [3, y]);
    const c = s.assento("classic9_chair", 4, y, [3, y]);
    if (y === 8) s.figurante({ figura: FIGURAS.enxadrista, sentado: c });
    s.pendente("grungelamp", 3, y, { estado: 1 });
  }
  s.por("antique_c21_lamp", 5, 13);
  s.parede("esquerda", { de: 7.5, ate: 11.6, altura: 1.8 }, ["mafia_c26_walllamp_white", "attic15_painting", "mafia_c26_walllamp_white"]);

  // --- Mesas de Jogos (dominó, dama, velha e truco) ---
  s.canto("mesas de jogos", { funcao: "jogar dominó, dama, velha e truco", destaque: "hobbies_c26_gamingtable" });
  for (const x of [15, 19]) {
    s.por("hobbies_c26_gamingtable", x, 8, { dir: 2 });
    s.emCima(x, 8, [x === 15 ? "edice" : "classic2_drinkcup"]);
    // Jogo de dois: uma cadeira de cada lado da mesa, frente a frente.
    s.assento("modern_c17_chair", x + 1, 7, [x + 1, 8]);
    s.assento("modern_c17_chair", x + 1, 10, [x + 1, 9]);
    s.pendente("army_c15_light", x + 1, 9, { dir: 2 });
  }
  s.por("classic9_plant", 14, 13);

  // --- Corredor da porta ---
  s.canto("corredor", { funcao: "chegar às alas pelo meio", destaque: "carpet_standard" });
  s.tapete("carpet_standard", 9, 8, 11, 12);
  for (const y of [7, 11]) s.pendente("army_c15_light", 10, y, { dir: 2 });
  return s.fechar();
}
