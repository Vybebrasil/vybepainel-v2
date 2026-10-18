// Convivência: saguão branco de mármore (referência aprovada pelo Paulo em
// 18/10/2026, sem enfeite de São João). Mezanino de construtor no fundo,
// sobre colunas gregas, com biblioteca, café e sofá; recepção no térreo sob
// a beira, de frente para a porta; teleportes e máquinas no canto do fundo
// à direita; estar com sofá e aquários à esquerda; canteiro de palmeiras no
// centro; jogos à direita. O teleporte branco liga o térreo ao mezanino; o
// escuro, à Praça. Cada peça passa pelo motor (scripts/escritorio-construcao.mjs).
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
  const MEZ = 3;

  // Piso de mármore branco em placas (o piso do quarto fica por baixo).
  s.piso("val12_marble1", { x0: 0, y0: 0, x1: 16, y1: 18 });
  s.piso("val12_marble1", { x0: 16, y0: 0, x1: 20, y1: 14 });
  s.piso("val12_marble1", { x0: 16, y0: 14, x1: 18, y1: 16 });

  // Mezanino (x 0–15, y 0–6): placas de mármore, beira de bloco grego na
  // frente e na ponta direita, colunas gregas da altura dele no térreo.
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 7, altura: MEZ, piso: "val12_marble1", guarda: "greek_block",
    coluna: "greek_corner", colunas: [2, 6, 12, 14], lados: ["frente", "direita"] });

  // --- Mezanino ---
  // Biblioteca: estantes no fundo e na parede da esquerda, poltronas em
  // volta da mesinha com vaso, um leitor.
  s.por("hween_c26_bookshelf", 0, 0, { nivel: 1, dir: 2 });
  s.por("hween_c26_bookshelf", 0, 2, { nivel: 1, dir: 0 });
  s.por("mafia_c26_sidetable_white", 2, 2, { nivel: 1 });
  s.emCima(2, 2, "mafia_c26_vase_white", { nivel: 1 });
  const leitura = s.assento("mafia_c26_armchair_white", 2, 3, [2, 2], { nivel: 1 });
  s.assento("mafia_c26_armchair_white", 3, 2, [2, 2], { nivel: 1 });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura });
  // Café: duas mesinhas com poltronas.
  const cafe1 = s.mesa({ nivel: 1, x: 6, y: 2, tampo: "mafia_c26_sidetable_white", cadeira: "mafia_c26_armchair_white", sobre: ["magazines"] });
  s.figurante({ figura: FIGURAS.amiga, sentado: cafe1.esquerda });
  s.mesa({ nivel: 1, x: 10, y: 2, tampo: "mafia_c26_sidetable_white", cadeira: "mafia_c26_armchair_white", sobre: ["mafia_c26_vase_white"] });
  // Sofá encostado no fundo, de frente para a mesa de centro.
  s.por("mafia_c26_sofa_white", 11, 0, { nivel: 1, olha: [12, 3] });
  s.por("mafia_c26_coffeetable_white", 12, 2, { nivel: 1 });
  s.por("mafia_c26_teleport_white", 14, 0, { nivel: 1, dir: 4 });
  s.por("mafia_c26_planter_white", 14, 3, { nivel: 1 });
  // Parede do fundo do mezanino: janelas altas da mansão.
  s.parede("fundo", { de: 4, ate: 11, nivel: 1, altura: 0.5 }, ["mafia_c26_window_white", "mafia_c26_window_white"]);

  // --- Térreo: recepção sob a beira, de frente para a porta ---
  for (const x of [7, 8, 9]) s.por("js_exe_bardesk", x, 5, { dir: 2, sobMezanino: true });
  s.emCima(7, 5, "computer_flatscreen");
  s.emCima(9, 5, "exe_c15_telephone");
  s.figurante({ figura: FIGURAS.recepcionista, x: 8, y: 4, dir: 4 });

  // Canto do fundo à direita (pé-direito alto): teleportes, lanches, água e palmeira.
  s.por("matic_water_dispenser", 16, 0, { dir: 4 });
  s.por("olympics_r16_vendingmchn", 17, 0, { dir: 4 });
  s.por("mafia_c26_teleport_dark", 18, 0, { dir: 4 });
  s.por("mafia_c26_teleport_white", 19, 0, { dir: 4 });
  s.por("bohogarden_c21_fanpalm", 16, 3);

  // Estar à esquerda: sofá encostado na parede, mesa de centro no tapete,
  // duas poltronas, aquários e arandelas.
  s.tapete("js_exe_rug", 1, 9, 3, 11);
  s.assento("mafia_c26_sofa_white", 0, 9, [3, 10]);
  s.por("mafia_c26_coffeetable_white", 2, 9);
  s.emCima(2, 9, "magazines");
  const estar = s.assento("mafia_c26_armchair_white", 4, 9, [2, 9]);
  s.assento("mafia_c26_armchair_white", 4, 10, [2, 10]);
  s.figurante({ figura: FIGURAS.amigo, sentado: estar });
  s.por("waasa_aquarium", 0, 7, { dir: 2 });
  s.por("waasa_aquarium", 0, 13, { dir: 2 });
  s.parede("esquerda", { de: 7, ate: 16, altura: 1.8 }, ["mafia_c26_walllamp_white", "mafia_c26_walllamp_white"]);
  s.por("mafia_c26_planter_white", 0, 16);
  s.por("modern_c17_floorlamp", 5, 9);
  s.por("india_c20_palmvase", 5, 12);

  // Canteiro no centro: sebes em volta e palmeiras no meio.
  s.por("room_wl15_tree", 9, 10);
  s.por("room_wl15_tree", 10, 11);
  s.por("room_info15_shrub2", 9, 12);
  s.por("room_info15_shrub1", 11, 10);
  // Bancos de mármore virados para o canteiro, para quem espera.
  s.assento("greek_c15_bench", 9, 14, [9, 12]);
  s.assento("greek_c15_bench", 6, 10, [9, 10]);
  s.assento("greek_c15_bench", 13, 9, [10, 10]);

  // Jogos à direita: fliperamas de frente para o salão, mesa de sinuca e o
  // simulador de corrida.
  for (const x of [16, 18]) s.por("tokyo_c18_retroarcade", x, 7, { dir: 4 });
  s.figurante({ figura: FIGURAS.jogador, x: 17, y: 8, dir: 0 });

  s.por("bling15_pooltable", 15, 11, { dir: 4 });
  s.assento("tokyo_c18_racearcade", 18, 10, [16, 10]);
  // Segundo estar na frente à direita: sofá, mesa de centro no tapete,
  // luminária e palmeira.
  s.tapete("darkelegant_c20_carpet", 14, 13, 16, 14);
  s.assento("mafia_c26_sofa_white", 14, 13, [15, 15]);
  s.por("mafia_c26_coffeetable_white", 15, 14, { dir: 2 });
  s.por("modern_c17_floorlamp", 17, 14);
  s.por("india_c20_palmvase", 13, 15);

  // Espera perto da porta (frente à esquerda): poltronas em volta da
  // mesinha com revistas, globo e malas de quem chega.
  s.tapete("usva_rug", 2, 14, 3, 15);
  s.por("mafia_c26_sidetable_white", 3, 15);
  s.emCima(3, 15, "magazines");
  s.assento("mafia_c26_armchair_white", 2, 15, [3, 15]);
  s.assento("mafia_c26_armchair_white", 3, 14, [3, 15]);
  s.por("exe_globe", 1, 12);
  s.por("hc_luggage", 5, 14);
  // Entrada: capacho na porta e jardineiras dos lados.
  s.por("doormat_plain", 9, 16);
  s.por("doormat_plain", 10, 16);
  s.por("mafia_c26_planter_white", 7, 16);
  s.por("mafia_c26_planter_white", 12, 16);

  return s.fechar();
}
