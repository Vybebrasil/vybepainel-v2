// Academia: moderna, de tijolo vermelho e vidro (plano do Paulo, 18/10/2026).
// Parede de tijolo oficial do Habbo, com janelas altas, ventiladores e
// arandelas; no patamar do fundo, as esteiras em fileira; à esquerda, o
// canto dos pesos com espelhos; no meio, os colchonetes; à direita, o bar
// de sucos; perto da porta, os armários. Luz das janelas e das arandelas.
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
    luz: "army_c15_light" }, {
    acentos: ["xmas_c16_woodtile", "window_skyscraper", "industrialfan", "hs_wlight", "pixel_clock_red", "wallmirror", "uni_dumbells",
      "track12_weight", "school_c22_equipment", "olympics_c16_trampoline", "olympics_c16_saladbar", "olympics_c16_emptrack", "olympics_c16_merchdisplay",
      "olympics_c16_table", "olympics_c16_sofa", "olympics_c16_plantdvdr", "school_locker_r_nosale", "matic_water_dispenser", "olympics_c16_rug",
      "classic2_drinkcup", "doormat_plain"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // Sala de 14 × 12 (Paulo, 19/10/2026: a de 20 × 16 ficava com metade
  // vazia). Patamar do fundo com as esteiras em fileira.

  // --- Parede de tijolo com janelas altas, ventilador e arandelas ---
  s.canto("parede de tijolo", { funcao: "luz de janela e ventilação no fundo", destaque: "window_skyscraper" });
  for (const de of [0.5, 8.5]) s.parede("fundo", { de, ate: de + 2, altura: 1.4 }, ["window_skyscraper"]);
  s.parede("fundo", { de: 11, ate: 13.2, altura: 2.2 }, ["industrialfan"]);
  // Arandelas no trecho do meio, sobre o bebedouro.
  for (const de of [3, 5, 7]) s.parede("fundo", { de, ate: de + 1, altura: 2.4 }, ["hs_wlight"]);

  // --- Esteiras no patamar, em duas fileiras de quatro, viradas para a sala ---
  s.canto("esteiras", { funcao: "correr e caminhar", destaque: "olympics_c16_treadmill" });
  for (const x of [1, 2, 3, 4, 9, 10, 11, 12]) s.por("olympics_c16_treadmill", x, 1, { olha: [x, 8] });
  s.figurante({ figura: FIGURAS.corredora, x: 3, y: 1, dir: 4 });
  s.por("matic_water_dispenser", 7, 1, { dir: 4 });

  // --- Canto dos pesos, à esquerda, com espelhos ---
  s.canto("pesos", { funcao: "treinar com pesos", destaque: "olympics_c16_weightrack" });
  s.por("olympics_c16_weightrack", 0, 3, { olha: [4, 3] });
  s.por("olympics_c16_weightrack", 0, 4, { olha: [4, 4] });
  s.parede("esquerda", { de: 2.8, ate: 6.4, altura: 1.4 }, ["wallmirror", "wallmirror", "wallmirror"]);
  s.parede("esquerda", { de: 6.6, ate: 7.9, altura: 2.2 }, ["pixel_clock_red"]);
  s.por("uni_wobench", 3, 4, { olha: [6, 4] });
  s.figurante({ figura: FIGURAS.maromba, x: 2, y: 6, dir: 2 });
  s.por("uni_dumbells", 1, 6);
  s.por("track12_weight", 1, 7);

  // --- Colchonetes no meio ---
  s.canto("colchonetes", { funcao: "alongar, fazer ioga e luta", destaque: "olympics_c16_softmat" });
  s.por("olympics_c16_softmat", 5, 5);
  s.por("olympics_c16_softmat", 7, 5);
  s.figurante({ figura: FIGURAS.yoga, x: 6, y: 6, dir: 4 });
  s.por("olympics_c16_trampoline", 9, 5);

  // --- Bar de sucos, à direita ---
  s.canto("bar de sucos", { funcao: "tomar um suco depois do treino", destaque: "olympics_c16_counter" });
  s.por("olympics_c16_saladbar", 12, 4, { olha: [12, 7] });
  s.por("olympics_c16_counter", 12, 8, { olha: [12, 11] });
  s.emCima(12, 8, "classic2_drinkcup");
  for (const x of [12, 13]) s.assento("olympics_c16_chair", x, 9, [x, 8]);
  s.figurante({ figura: FIGURAS.suco, sentado: null, x: 13, y: 7, dir: 4 });

  // --- Vestiário perto da porta: armários e banco ---
  s.canto("vestiário", { funcao: "trocar de roupa e guardar as coisas", destaque: "school_locker_b_nosale" });
  for (const y of [8, 9, 10, 11]) s.por(y % 2 ? "school_locker_b_nosale" : "school_locker_r_nosale", 0, y, { olha: [4, y] });
  s.assento("olympics_c16_sofa", 3, 9, [0, 9]);
  s.parede("esquerda", { de: 0.5, ate: 2.7, altura: 2.2 }, ["industrialfan"]);
  // Luz industrial pendurada só sobre os pontos de uso (pesos, colchonetes,
  // cama elástica e bar), em vez de uma grade de hastes pela sala inteira.
  s.canto("luz do teto", { funcao: "iluminar os aparelhos", destaque: "army_c15_light" });
  for (const [x, y] of [[3, 6], [6, 6], [10, 6], [12, 10]]) s.pendente("army_c15_light", x, y, { dir: 2 });

  s.canto("entrada", { funcao: "chegar à academia", destaque: "doormat_plain" });
  s.por("doormat_plain", 6, 10);
  s.por("doormat_plain", 7, 10);
  return s.fechar();
}
