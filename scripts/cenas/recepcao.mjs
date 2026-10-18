// Convivência: saguão branco de mármore (referência aprovada pelo Paulo em
// 18/10/2026, sem enfeite de São João). Mezanino de mármore preto no fundo,
// raso (x 0–15, y 0–4), sobre colunas gregas: nada embaixo dele além das
// colunas, para o andar de cima não invadir o térreo. Escada de palco do
// salão até o vão do guarda-corpo, com pé e lados livres. Recepção de frente
// para a porta; estar na parede da esquerda; espera perto da porta; canteiro
// no meio; jogos e estar à direita; máquinas e teleporte da Praça no canto
// do fundo. Cada peça passa pelo motor (scripts/escritorio-construcao.mjs).
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  recepcionista: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  amiga: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  amigo: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  jogador: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
};

export default function recepcao() {
  const s = novaCena("recepcao");
  // Casca: cornija de plataforma branca no topo das paredes (fina, como a do Café).
  s.casca(null, 1, ["eleblock4", 0]);

  // Piso de mármore branco em placas no térreo.
  s.piso("val12_marble1", { x0: 0, y0: 0, x1: 16, y1: 18 });
  s.piso("val12_marble1", { x0: 16, y0: 0, x1: 20, y1: 14 });
  s.piso("val12_marble1", { x0: 16, y0: 14, x1: 18, y1: 16 });

  // Mezanino de mármore preto, guarda-corpo de bloco grego na frente e na
  // ponta direita, vão onde chega a escada, colunas gregas no térreo.
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 3, piso: "val12_marble2", guarda: "greek_block",
    coluna: "greek_corner", colunas: [1, 5, 8], lados: ["frente", "direita"], abertura: [12, 14] });
  s.escada("xmas_c18_stagestairs", 12, 9, [0, -1]);

  // --- Mezanino ---
  const arandela = { classe: "mafia_c26_walllamp_white", altura: 1.6 };
  // Parede do fundo: janelas duplas com arandelas entre elas.
  s.parede("fundo", { de: 2, ate: 15, nivel: 1, altura: 0.6 }, [{ ...arandela, altura: 1.4 }, "window_double_default", { ...arandela, altura: 1.4 }, "window_double_default", { ...arandela, altura: 1.4 }]);
  // Biblioteca no canto: estante na parede da esquerda, poltronas e mesinha.
  s.por("hween_c26_bookshelf", 0, 0, { nivel: 1, dir: 2 });
  s.parede("esquerda", { de: 2, ate: 4, nivel: 1, altura: 1.2 }, ["wallmirror"]);
  const leitura = s.mesa({ nivel: 1, x: 2, y: 2, tampo: "mafia_c26_sidetable_white", cadeira: "mafia_c26_armchair_white", lados: ["esquerda", "direita"], sobre: ["antique_c21_books", "wcandle"] });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura.esquerda });
  // Estar do mezanino: sofá de frente para a beira, mesa de centro, poltronas.
  const cima = s.estar({ nivel: 1, x: 5, y: 1, sofa: "mafia_c26_sofa_white", mesa: "mafia_c26_coffeetable_white", poltrona: "mafia_c26_armchair_white",
    poltronas: [],
    criado: "mafia_c26_sidetable_white", criados: ["depois"], sobreMesa: ["mafia_c26_magazinesb", "room_cof15_cup2"],
    sobreCriado: { depois: ["antique_c21_books", "wcandle"] } });
  s.figurante({ figura: FIGURAS.amiga, sentado: cima.sofa });
  // Mesinha de café perto da escada e plantas nos cantos.
  s.mesa({ nivel: 1, x: 11, y: 2, tampo: "mafia_c26_sidetable_white", cadeira: "mafia_c26_armchair_white", lados: ["esquerda", "tras"], sobre: ["antique_c21_books", "classic2_drinkcup"] });
  s.por("mafia_c26_planter_white", 14, 1, { nivel: 1 });
  s.por("mafia_c26_planter_white", 0, 3, { nivel: 1 });
  s.por("hc_bigvase", 14, 3, { nivel: 1 });
  s.por("room_info15_statue1", 1, 3, { nivel: 1 });
  s.por("hc_bigvase", 4, 3, { nivel: 1 });
  for (const y of [1, 3]) s.emCima(15, y, "wcandle", { nivel: 1 });
  for (const y of [0, 2]) s.emCima(15, y, "greek_c19_vase1", { nivel: 1 });
  s.por("mafia_c26_planter_white", 13, 1, { nivel: 1 });
  // Acabamento no guarda-corpo: vasos gregos e velas em cima dos blocos.
  for (const [x, c] of [[0, "greek_c19_vase1"], [2, "wcandle"], [4, "greek_c19_vase2"], [6, "wcandle"], [8, "greek_c19_vase1"], [10, "wcandle"], [14, "greek_c19_vase2"], [1, "plant_rose"], [5, "plant_rose"], [9, "plant_rose"], [3, "greek_c19_vase2"], [7, "greek_c19_vase2"], [11, "greek_c19_vase1"]]) s.emCima(x, 4, c, { nivel: 1 });

  // --- Canto do fundo à direita (pé-direito alto): máquinas e teleporte ---
  s.por("mafia_c26_teleport_dark", 16, 0, { dir: 4 });
  // Prateleira com vasos e relógio em cima, no canto, ao lado da máquina.
  s.parede("fundo", { de: 17, ate: 20, altura: 1.6 }, ["waasa_wall_shelf2", { classe: "pixel_clock_black", altura: 2.2 }]);
  // Mesinha de café no canto, com lareira de mármore ao lado.
  s.mesa({ x: 17, y: 3, tampo: "mafia_c26_sidetable_white", cadeira: "mafia_c26_armchair_white", sobre: ["antique_c21_books", "room_cof15_cup2"] });
  s.por("mafia_c26_firepit_white", 19, 3);

  // --- Recepção de frente para a porta ---
  s.por("room_info15_counter2", 8, 7, { olha: [9, 12] });
  s.emCima(8, 7, "computer_flatscreen");
  s.emCima(9, 7, "exe_c15_telephone");
  s.emCima(10, 7, "mafia_c26_ledger");
  s.figurante({ figura: FIGURAS.recepcionista, x: 9, y: 6, dir: 4 });
  s.por("room_info15_lamp1", 6, 7);
  s.por("room_info15_counter1", 10, 6);
  s.emCima(10, 6, "modern_c17_plant");
  s.emCima(10, 7, "magazines");
  s.por("elegant_c17_flowerpot", 12, 1, { nivel: 1 });

  // --- Estar na parede da esquerda ---
  const estar = s.estar({ x: 0, y: 7, olha: "direita", sofa: "mafia_c26_sofa_white", mesa: "mafia_c26_coffeetable_white", poltrona: "mafia_c26_armchair_white",
    criado: "mafia_c26_sidetable_white", criados: ["depois"], tapete: "js_exe_rug", sobreMesa: ["magazines", "wcandle"],
    sobreCriado: { depois: ["antique_c21_books", "wcandle"] } });
  s.figurante({ figura: FIGURAS.amigo, sentado: estar.antes });
  s.parede("esquerda", { de: 6, ate: 11, altura: 1.6 }, [arandela, { classe: "attic15_painting", altura: 1.9 }, arandela]);
  s.por("waasa_aquarium", 0, 12, { dir: 2 });
  s.por("mafia_c26_planter_white", 0, 14);
  s.por("hc_bigvase", 0, 16);
  s.parede("esquerda", { de: 14, ate: 16, altura: 2.8 }, ["attic15_painting"]);

  // --- Espera perto da porta ---
  const espera = s.estar({ x: 3, y: 13, sofa: "room_info15_sofa2", mesa: "mafia_c26_coffeetable_white", poltrona: "room_info15_sofa1",
    criado: "mafia_c26_sidetable_white", criados: ["depois"], tapete: "js_exe_rug", sobreMesa: ["mafia_c26_magazinesb", "classic2_drinkcup"],
    sobreCriado: { depois: ["antique_c21_books", "wcandle"] } });
  s.figurante({ figura: FIGURAS.amiga.replace("ch-3030-73", "ch-665-1323"), sentado: espera.sofa });
  s.por("hc_luggage", 2, 15);
  s.por("modern_c17_floorlamp", 6, 14);
  s.por("modern_c17_floorlamp", 1, 14);

  // --- Canteiro no meio, com bancos virados para ele ---
  // Árvores atrás, arbustos e rosas na frente (o mais baixo na frente).
  s.por("room_wl15_tree", 4, 9);
  s.por("room_wl15_tree", 6, 9);
  s.por("room_info15_shrub1", 4, 10);
  s.por("plant_rose", 5, 10);
  s.por("room_info15_shrub1", 6, 10);
  s.assento("greek_c15_bench", 8, 10, [5, 10]);
  s.por("mafia_c26_sidetable_white", 8, 9);
  s.emCima(8, 9, ["antique_c21_books", "wcandle"]);

  // Jardineiras baixas com rosas dos dois lados do corredor da porta.
  for (const x of [7, 11]) { s.por("room_cof15_planter", x, 13); s.emCima(x, 13, "plant_rose"); s.emCima(x + 1, 13, "plant_rose"); }

  // --- Jogos à direita ---
  for (const x of [16, 18]) s.por("tokyo_c18_retroarcade", x, 7, { dir: 4 });
  s.figurante({ figura: FIGURAS.jogador, x: 17, y: 8, dir: 0 });
  s.por("bling15_pooltable", 16, 10, { dir: 4 });
  s.assento("room_info15_bench", 18, 10, [16, 10]);
  s.por("mafia_c26_sidetable_white", 18, 12);
  s.emCima(18, 12, ["antique_c21_books", "classic2_drinkcup"]);
  s.pendente("gothic_c15_chandelier", 16, 10);
  s.por("modern_c17_floorlamp", 19, 9);

  // --- Estar da frente à direita ---
  s.estar({ x: 14, y: 12, sofa: "mafia_c26_sofa_white", mesa: "mafia_c26_coffeetable_white", poltrona: "mafia_c26_armchair_white",
    criado: "mafia_c26_sidetable_white", criados: ["depois"], tapete: "js_exe_rug", sobreMesa: ["mafia_c26_magazinesb", "room_cof15_cup2"],
    sobreCriado: { depois: ["antique_c21_books", "wcandle"] } });
  s.pendente("gothic_c15_chandelier", 15, 14);

  // --- Entrada: capacho na porta e jardineiras dos lados ---
  s.por("doormat_plain", 9, 16);
  s.por("doormat_plain", 10, 16);
  s.por("mafia_c26_planter_white", 8, 16);
  s.por("mafia_c26_planter_white", 11, 16);
  s.por("greek_c15_lamp", 7, 16, { dir: 2 });
  s.por("greek_c15_lamp", 12, 16, { dir: 2 });
  s.por("hc_lmpst", 13, 16);
  s.por("elegant_c17_walldecor", 0, 17, { dir: 0 });
  return s.fechar();
}
