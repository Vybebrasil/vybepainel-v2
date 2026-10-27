// Jogos: o salão de jogos do Escritório, refeito por alas (Paulo, 27/10/2026:
// "ter todos esses jogos na sala de jogos, dividido por ala; está escura,
// feia, objetos largados"). Luz quente, piso diferente em cada ala (texturas
// da planta) e um corredor da porta até o fundo:
// - fundo à esquerda: fliperama (máquinas na parede e pinballs na lateral);
// - fundo no meio: sinuca e pebolim sob as luzes;
// - fundo à direita: o saloon do pôquer (mesas de barril e bancos de sela);
// - meio à esquerda: os tabuleiros de xadrez;
// - meio à direita: as Mesas de Jogos (dominó, dama, velha e truco);
// - frente: videogame à esquerda e lanchonete à direita da porta.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  jogador1: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  jogador2: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  sofa: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  xadrez: "hr-515-61.hd-600-1.ch-665-1323.lg-700-110.sh-725-110",
  cowboy: "hr-893-45.hd-180-2.ch-3030-1408.lg-280-1408.sh-305-62",
};

export default function jogos() {
  const s = novaCena("jogos");
  s.colecao({ fliperama: "tokyo_c18_retroarcade", sinuca: "bling15_pooltable", pebolim: "ads_aftv_footballtable", tabuleiro: "CF_250_goldenchessboard",
    mesaDeJogos: "hobbies_c26_gamingtable", poquer: "wildwest_table", banco: "lodge_dark_barrelstool", cadeira: "elegant_c17_chair", cadeiraMesa: "modern_c17_chair", pufe: "cubie_beanbag_p",
    poltrona: "cubie_sofaseat_p", mesa: "cubie_bigtable_b", banqueta: "cubie_stool_b", abajur: "cubie_lamp_p" }, {
    acentos: ["xmas_c16_woodtile", "arcade_c23_space", "arcade_c23_cyberpunk", "arcade_c23_pinball", "graffiti_r24_arcademachine",
      "vwave_r21_jukebox", "rainyday_c20_retrogames", "cubie_beanbag_b", "cubie_lamp_b", "neonpunk_c20_carpet", "neonpunk_c20_lights", 
      "disco_c26_donutlight", "pixel_poster2", "pixel_painting_blue", "pixel_painting_red", "cubie_decal_2_p",
      "olympics_r16_vendingmchn", "tokyo_c18_drinksmachine", "classic2_drinkcup", "doormat_plain", "wildwest_cabinet", "wildwest_light", "wildwest_crate",
      "classic9_plant", "grungelamp", "army_c15_light", "cine_light2", "mafia_c26_walllamp_white", "mafia_c26_walllamp_dark", "pixel_clock_red", "pixel_clock_black",
      "st_wildwest_wallskull", "attic15_painting", "waasa_wall_shelf1", "cubie_decklight_p",
      "tokyo_c18_railing", "lodge_dark_divider", "exe_rug", "carpet_standard", "exe_sofa", "fball_score_b", "fball_score_r",
      "modern_c17_sofa", "hc26_3", "hc26_10", "bazaar_c17_rug"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Fliperama: fundo à esquerda ---
  s.canto("fliperama", { funcao: "jogar nas máquinas", destaque: "tokyo_c18_retroarcade" });
  for (const [x, c] of [[1, "tokyo_c18_retroarcade"], [3, "arcade_c23_space"], [5, "arcade_c23_cyberpunk"], [7, "graffiti_r24_arcademachine"]]) s.por(c, x, 0, { olha: [x, 4] });
  s.por("arcade_c23_pinball", 0, 2, { olha: [4, 2] });
  s.por("disco_c26_donutlight", 0, 4, { dir: 0 });
  s.por("arcade_c23_pinball", 0, 5, { olha: [4, 5] });
  s.figurante({ figura: FIGURAS.jogador1, x: 2, y: 1, dir: 0 });
  s.parede("fundo", { de: 0, ate: 8, altura: 3.4 }, ["pixel_painting_blue", "pixel_poster2", "pixel_painting_red"]);
  s.parede("esquerda", { de: 0, ate: 6.5, altura: 2.4 }, ["cubie_decklight_p", "waasa_wall_shelf1"]);
  s.por("tokyo_c18_railing", 8, 1, { dir: 2 });
  s.por("tokyo_c18_railing", 8, 4, { dir: 2 });
  s.pendente("grungelamp", 3, 3);

  // --- Sinuca e pebolim: fundo no meio ---
  s.canto("sinuca", { funcao: "jogar sinuca e pebolim", destaque: "bling15_pooltable" });
  s.por("bling15_pooltable", 10, 3, { dir: 4 });
  s.pendente("neonpunk_c20_lights", 10, 3);
  s.por("ads_aftv_footballtable", 14, 2);
  s.pendente("neonpunk_c20_lights", 14, 3);
  s.por("vwave_r21_jukebox", 9, 0, { olha: [9, 4] });
  s.figurante({ figura: FIGURAS.jogador2, x: 12, y: 5, dir: 0 });
  s.parede("fundo", { de: 8, ate: 17, altura: 2.6 }, ["cine_light2", "pixel_clock_red", "cine_light2"]);
  s.por("fball_score_b", 13, 1, { dir: 4 });
  s.por("fball_score_r", 16, 1, { dir: 4 });
  s.assento("exe_sofa", 9, 6, [10, 3]);

  // --- Saloon do pôquer: fundo à direita ---
  s.canto("saloon do pôquer", { funcao: "jogar pôquer", destaque: "wildwest_table" });
  s.por("wildwest_cabinet", 19, 0, { dir: 4 });
  s.por("wildwest_crate", 23, 0);
  s.por("wildwest_crate", 25, 0);
  for (const x of [20, 23]) {
    s.por("wildwest_table", x, 3);
    s.assento("lodge_dark_barrelstool", x - 1, 3, [x, 3]);
    if (x === 20) s.assento("lodge_dark_barrelstool", x + 1, 3, [x, 3]);
    else s.figurante({ figura: FIGURAS.cowboy, sentado: s.assento("lodge_dark_barrelstool", x + 1, 3, [x, 3]) });
    s.pendente("army_c15_light", x, 3, { dir: 2 });
  }
  s.parede("fundo", { de: 17, ate: 26, altura: 2.4 }, ["mafia_c26_walllamp_dark", "st_wildwest_wallskull", "mafia_c26_walllamp_dark"]);
  s.por("lodge_dark_divider", 17, 1, { dir: 6 });
  s.por("lodge_dark_divider", 17, 4, { dir: 6 });
  s.por("wildwest_light", 18, 2);
  s.por("wildwest_light", 22, 0);

  // --- Tabuleiros de xadrez: meio à esquerda ---
  s.canto("tabuleiros", { funcao: "jogar xadrez", destaque: "CF_250_goldenchessboard" });
  for (const x of [2, 6]) {
    s.tapete("exe_rug", x - 1, 9, x + 1, 11);
    s.por("CF_250_goldenchessboard", x, 10);
    // Cadeiras atrás do tabuleiro (à esquerda e ao fundo): na frente, taparia o jogo.
    s.assento("elegant_c17_chair", x - 1, 10, [x, 10]);
    const cad = s.assento("elegant_c17_chair", x, 9, [x, 10]);
    if (x === 2) s.figurante({ figura: FIGURAS.xadrez, sentado: cad });
    s.pendente("grungelamp", x, 10);
  }
  s.parede("esquerda", { de: 8, ate: 12.5, altura: 2.2 }, ["mafia_c26_walllamp_white", "attic15_painting", "pixel_clock_black"]);
  s.por("classic9_plant", 0, 8);
  s.por("classic9_plant", 8, 8);

  // --- Mesas de Jogos (dominó, dama, velha e truco): meio à direita ---
  s.canto("mesas de jogos", { funcao: "jogar dominó, dama, velha e truco", destaque: "hobbies_c26_gamingtable" });
  for (const x of [18, 22]) {
    s.por("hobbies_c26_gamingtable", x, 9);
    // Cadeiras na lateral e na frente da mesa: atrás dela ficariam tapadas.
    s.assento("modern_c17_chair", x + 2, 10, [x + 1, 10]);
    s.assento("modern_c17_chair", x, 12, [x, 10]);
    s.pendente("army_c15_light", x, 10, { dir: 2 });
  }
  s.por("classic9_plant", 25, 8);

  // --- Videogame: frente à esquerda ---
  s.canto("videogame", { funcao: "jogar videogame no sofá", destaque: "rainyday_c20_retrogames" });
  s.tapete("neonpunk_c20_carpet", 1, 14, 4, 17);
  s.por("rainyday_c20_retrogames", 0, 15, { olha: [3, 15] });
  const pufe = s.assento("cubie_beanbag_p", 3, 14, [0, 15]);
  s.assento("cubie_sofaseat_p", 3, 15, [0, 15]);
  s.assento("cubie_beanbag_b", 3, 16, [0, 15]);
  s.figurante({ figura: FIGURAS.sofa, sentado: pufe });
  s.por("cubie_lamp_p", 0, 13);
  s.por("cubie_lamp_p", 0, 17);
  s.parede("esquerda", { de: 13, ate: 17, altura: 2 }, ["cubie_decal_2_p"]);

  // --- Torcida: frente, entre o videogame e o corredor ---
  s.canto("torcida", { funcao: "esperar a vez e assistir as partidas", destaque: "modern_c17_sofa" });
  s.estar({ x: 6, y: 14, olha: "direita", sofa: "modern_c17_sofa", mesa: "hc26_3", poltrona: "hc26_10", sobreMesa: ["classic2_drinkcup"] });
  s.pendente("army_c15_light", 8, 15, { dir: 2 });

  // --- Lanchonete: frente à direita ---
  s.canto("lanchonete", { funcao: "lanchar entre uma partida e outra", destaque: "cubie_bigtable_b" });
  s.por("olympics_r16_vendingmchn", 24, 13, { olha: [24, 17] });
  s.por("tokyo_c18_drinksmachine", 21, 13, { olha: [21, 17] });
  s.mesa({ x: 19, y: 15, tampo: "cubie_bigtable_b", cadeira: "cubie_stool_b", lados: ["esquerda", "direita"], sobre: ["classic2_drinkcup"] });
  s.por("cubie_lamp_b", 22, 17);

  // --- Entrada ---
  s.canto("entrada", { funcao: "chegar ao salão de jogos pelo corredor", destaque: "carpet_standard" });
  s.tapete("carpet_standard", 11, 8, 13, 12);
  s.tapete("carpet_standard", 11, 13, 13, 17);
  for (const y of [8, 12]) s.pendente("army_c15_light", 12, y, { dir: 2 });
  return s.fechar();
}
