// Jogos: fliperama escuro com neon (plano do Paulo, 18/10/2026). Luz da
// noite e letreiros de neon. Fileira de máquinas na parede
// do fundo e na da esquerda, de frente para o salão; sinuca e pebolim no
// meio sob as luzes neon; canto do gamer no fundo à direita; sala do
// videogame com pufes na frente à esquerda; lanchonete perto da porta.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  jogador1: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  jogador2: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  gamer: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  sofa: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
};

export default function jogos() {
  const s = novaCena("jogos");
  s.colecao({ fliperama: "tokyo_c18_retroarcade", sinuca: "bling15_pooltable", pebolim: "ads_aftv_footballtable", pufe: "cubie_beanbag_p",
    poltrona: "cubie_sofaseat_p", mesa: "cubie_bigtable_b", banqueta: "cubie_stool_b", abajur: "cubie_lamp_p", tela: "computer_flatscreen" }, {
    acentos: ["xmas_c16_woodtile", "arcade_c23_space", "arcade_c23_cyberpunk", "arcade_c23_pinball", "arcade_c23_vrmachine",
      "graffiti_r24_arcademachine", "vwave_r21_jukebox", "rainyday_c20_retrogames", "gaming_c18_rigpro", "uni_gamershelf", "studio_chair", "cubie_beanbag_b",
      "cubie_lamp_b", "neonpunk_c20_carpet", "neonpunk_c20_lights", "tokyo_c18_neonsign1", "tokyo_c18_neonsign2", "vwave_c21_neonsigns",
      "darkmodern_c20_neonlight", "disco_c26_donutlight", "cubie_decklight_p", "pixel_poster2", "pixel_painting_blue", "pixel_painting_red", "cubie_wallshelf_b", "cubie_decal_2_p", "olympics_r16_vendingmchn",
      "tokyo_c18_drinksmachine", "edice", "classic2_drinkcup", "doormat_plain"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);
  // Luz da noite (planta): a sala escurece e o neon brilha.

  // --- Fileira de fliperamas na parede do fundo, com neon entre eles ---
  s.canto("fileira de fliperamas", { funcao: "jogar nas máquinas", destaque: "tokyo_c18_retroarcade" });
  for (const [x, c] of [[1, "tokyo_c18_retroarcade"], [3, "arcade_c23_space"], [5, "arcade_c23_cyberpunk"], [7, "graffiti_r24_arcademachine"], [10, "arcade_c23_vrmachine"]]) s.por(c, x, 0, { olha: [x, 5] });
  for (const [x, c] of [[4, "tokyo_c18_neonsign2"], [8, "darkmodern_c20_neonlight"]]) s.por(c, x, 0, { dir: 2 });
  s.figurante({ figura: FIGURAS.jogador1, x: 3, y: 1, dir: 0 });
  s.por("vwave_r21_jukebox", 12, 0, { olha: [12, 5] });

  // --- Pinballs na parede da esquerda ---
  s.canto("pinballs", { funcao: "jogar pinball", destaque: "arcade_c23_pinball" });
  s.por("arcade_c23_pinball", 0, 2, { olha: [5, 2] });
  s.por("disco_c26_donutlight", 0, 4, { dir: 0 });
  s.por("arcade_c23_pinball", 0, 5, { olha: [5, 5] });
  s.figurante({ figura: FIGURAS.jogador2, x: 2, y: 5, dir: 6 });

  // --- Sinuca e pebolim no meio, sob o neon ---
  s.canto("sinuca e pebolim", { funcao: "jogar em grupo", destaque: "bling15_pooltable" });
  s.por("bling15_pooltable", 5, 4, { dir: 4 });
  s.pendente("neonpunk_c20_lights", 5, 4);
  s.por("ads_aftv_footballtable", 9, 4);
  s.pendente("neonpunk_c20_lights", 9, 5);

  // --- Canto do gamer, no fundo à direita ---
  s.canto("canto do gamer", { funcao: "jogar no computador", destaque: "gaming_c18_rigpro" });
  s.por("gaming_c18_rigpro", 15, 0, { olha: [16, 5] });
  for (const x of [15, 17]) {
    const cad = s.assento("studio_chair", x, 1, [x, 0]);
    s.emCima(x, 0, "computer_flatscreen", { olha: [x, 1] });
    if (x === 15) s.figurante({ figura: FIGURAS.gamer, sentado: cad });
  }
  s.por("uni_gamershelf", 18, 0, { olha: [18, 5] });
  s.por("cubie_lamp_b", 14, 0);

  // --- Sala do videogame, na frente à esquerda ---
  s.canto("sala do videogame", { funcao: "jogar videogame no sofá", destaque: "rainyday_c20_retrogames" });
  s.tapete("neonpunk_c20_carpet", 1, 7, 4, 10);
  s.por("rainyday_c20_retrogames", 0, 9, { olha: [3, 9] });
  const pufe = s.assento("cubie_beanbag_p", 3, 8, [0, 9]);
  s.assento("cubie_sofaseat_p", 3, 9, [0, 9]);
  s.assento("cubie_beanbag_b", 3, 10, [0, 9]);
  s.figurante({ figura: FIGURAS.sofa, sentado: pufe });
  s.por("cubie_lamp_p", 0, 7);
  s.por("cubie_lamp_p", 0, 11);
  s.parede("esquerda", { de: 8, ate: 11, altura: 2 }, ["cubie_decal_2_p"]);

  // --- Lanchonete perto da porta, à direita ---
  s.canto("lanchonete", { funcao: "lanchar entre uma partida e outra", destaque: "cubie_bigtable_b" });
  s.por("olympics_r16_vendingmchn", 13, 6, { olha: [13, 10] });
  s.por("tokyo_c18_drinksmachine", 15, 6, { olha: [15, 10] });
  s.mesa({ x: 12, y: 8, tampo: "cubie_bigtable_b", cadeira: "cubie_stool_b", lados: ["esquerda", "direita"], sobre: ["classic2_drinkcup"] });
  s.por("cubie_lamp_b", 16, 7);

  // Parede do fundo: pôster e luz de neon perto do gamer.
  s.parede("fundo", { de: 13, ate: 15, altura: 2 }, ["pixel_poster2"]);
  // Quadrinhos de pixel e prateleira no alto, por cima das máquinas.
  s.parede("fundo", { de: 0, ate: 8, altura: 4.6 }, ["pixel_painting_blue", "cubie_wallshelf_b", "pixel_painting_red"]);
  s.parede("esquerda", { de: 0, ate: 2, altura: 2.2 }, ["cubie_decklight_p"]);
  s.parede("esquerda", { de: 6.5, ate: 8, altura: 2.4 }, ["pixel_poster2"]);

  s.canto("entrada", { funcao: "chegar ao fliperama", destaque: "doormat_plain" });
  s.por("doormat_plain", 9, 10);
  s.por("doormat_plain", 10, 10);
  return s.fechar();
}
