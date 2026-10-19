// Academia: moderna, de tijolo vermelho e vidro (plano do Paulo, 18/10/2026).
// Parede de tijolo oficial do Habbo, com janelas altas, ventiladores e
// arandelas; no patamar do fundo, a fileira de esteiras; à esquerda, o
// canto dos pesos com espelhos; no meio, os colchonetes; à direita, o bar
// de sucos; perto da porta, os armários. Luz fria de academia, do teto.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  corredora: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  maromba: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  yoga: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  suco: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
};

export default function academia() {
  const s = novaCena("academia");
  s.colecao({ esteira: "olympics_c16_treadmill", halteres: "olympics_c16_weightrack", supino: "uni_wobench",
    colchonete: "olympics_c16_softmat", balcao: "olympics_c16_counter", banqueta: "olympics_c16_chair", armario: "school_locker_b_nosale",
    luz: "army_c15_light", vidro: "darkmodern_c20_glassblockwall" }, {
    acentos: ["xmas_c16_woodtile", "window_skyscraper", "industrialfan", "hs_wlight", "pixel_clock_red", "wallmirror", "uni_dumbells",
      "track12_weight", "school_c22_equipment", "olympics_c16_trampoline", "olympics_c16_saladbar", "olympics_c16_emptrack", "olympics_c16_merchdisplay",
      "olympics_c16_table", "olympics_c16_sofa", "olympics_c16_plantdvdr", "school_locker_r_nosale", "matic_water_dispenser", "olympics_c16_rug",
      "classic2_drinkcup", "doormat_plain"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Parede de tijolo (a parede oficial de tijolo do Habbo, na planta),
  // com janelas altas, ventilador industrial e arandelas ---
  s.canto("parede de tijolo", { funcao: "luz de janela e ventilação no fundo", destaque: "window_skyscraper" });
  for (const de of [1, 6, 11, 16]) s.parede("fundo", { de, ate: de + 2, altura: 1.4 }, ["window_skyscraper"]);
  for (const de of [3.5, 13.5]) s.parede("fundo", { de, ate: de + 2.2, altura: 2.2 }, ["industrialfan"]);
  for (const de of [0, 8.5, 18.5]) s.parede("fundo", { de, ate: de + 1, altura: 2.4 }, ["hs_wlight"]);

  // --- Esteiras no patamar, viradas para a sala ---
  s.canto("esteiras", { funcao: "correr e caminhar", destaque: "olympics_c16_treadmill" });
  for (const x of [3, 4, 9, 10, 15, 16]) s.por("olympics_c16_treadmill", x, 2, { olha: [x, 8] });
  s.figurante({ figura: FIGURAS.corredora, x: 9, y: 2, dir: 4 });
  s.por("matic_water_dispenser", 7, 2, { dir: 4 });

  // --- Canto dos pesos, à esquerda, com espelhos ---
  s.canto("pesos", { funcao: "treinar com pesos", destaque: "olympics_c16_weightrack" });
  s.por("olympics_c16_weightrack", 0, 5, { olha: [4, 5] });
  s.por("olympics_c16_weightrack", 0, 6, { olha: [4, 6] });
  s.parede("esquerda", { de: 4, ate: 10, altura: 1.4 }, ["wallmirror", "wallmirror", "wallmirror", "wallmirror", "wallmirror"]);
  s.por("uni_wobench", 3, 5, { olha: [6, 5] });
  s.figurante({ figura: FIGURAS.maromba, x: 2, y: 7, dir: 2 });
  s.por("uni_dumbells", 1, 9);
  s.por("track12_weight", 1, 10);
  s.por("school_c22_equipment", 5, 9, { olha: [5, 12] });

  // --- Colchonetes no meio ---
  s.canto("colchonetes", { funcao: "alongar, fazer ioga e luta", destaque: "olympics_c16_softmat" });
  s.por("olympics_c16_softmat", 8, 7);
  s.por("olympics_c16_softmat", 10, 7);
  s.figurante({ figura: FIGURAS.yoga, x: 9, y: 8, dir: 4 });
  s.por("olympics_c16_trampoline", 13, 7);

  // --- Bar de sucos, à direita ---
  s.canto("bar de sucos", { funcao: "tomar um suco depois do treino", destaque: "olympics_c16_counter" });
  s.por("olympics_c16_saladbar", 16, 6, { olha: [16, 9] });
  s.por("olympics_c16_counter", 16, 10, { olha: [16, 13] });
  s.emCima(16, 10, "classic2_drinkcup");
  for (const x of [16, 17]) s.assento("olympics_c16_chair", x, 11, [x, 10]);
  s.figurante({ figura: FIGURAS.suco, sentado: null, x: 17, y: 9, dir: 4 });

  // --- Vestiário perto da porta: armários e banco ---
  s.canto("vestiário", { funcao: "trocar de roupa e guardar as coisas", destaque: "school_locker_b_nosale" });
  for (const y of [11, 12, 13, 14]) s.por(y % 2 ? "school_locker_b_nosale" : "school_locker_r_nosale", 0, y, { olha: [4, y] });
  s.assento("olympics_c16_sofa", 3, 12, [0, 12]);
  // Divisória de blocos de vidro entre o vestiário e o salão.
  s.por("darkmodern_c20_glassblockwall", 4, 10, { olha: [4, 14] });

  // --- Luz fria do teto, em fileiras ---
  s.canto("luz do teto", { funcao: "iluminar os aparelhos", destaque: "army_c15_light" });
  for (const [x, y] of [[6, 6], [12, 6], [9, 10], [15, 10], [6, 13], [13, 13], [6, 9], [17, 13]]) s.pendente("army_c15_light", x, y, { dir: 2 });
  s.parede("esquerda", { de: 1, ate: 3.2, altura: 2.2 }, ["industrialfan"]);
  for (const de of [0, 10, 15]) s.parede("esquerda", { de, ate: de + 1, altura: 2.4 }, ["hs_wlight"]);

  s.canto("entrada", { funcao: "chegar à academia", destaque: "doormat_plain" });
  s.por("doormat_plain", 9, 14);
  s.por("doormat_plain", 10, 14);
  return s.fechar();
}
