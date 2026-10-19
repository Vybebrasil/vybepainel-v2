// Convivência: saguão do Hotel Vybelândia (projeto aprovado pelo Paulo em
// 18/10/2026): mármore branco com dourado e azul-claro, coleção Elegant do
// Habbo. Quem entra pela porta (que vem da Praça) vê, no mesmo eixo, a fonte
// e, atrás dela, a recepção. Mezanino de mármore preto no fundo, com
// biblioteca e estar; escada de pedra até o vão do guarda-corpo. Estar dos
// aquários na parede da esquerda, chegada perto da porta, estar azul e café
// do saguão à direita, máquinas e teleporte da Praça no canto do fundo.
// Montado por receitas (scripts/escritorio-receitas.mjs) e pelo motor.
import { novaCena } from "../escritorio-construcao.mjs";
import { recepcao } from "../escritorio-receitas.mjs";

const FIGURAS = {
  recepcionista: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  amiga: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  amigo: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  hospede: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
};

export default function convivencia() {
  const s = novaCena("recepcao");
  s.colecao({
    sofa: "elegant_c17_sofa", poltrona: "elegant_c17_chair", mesaCentro: "elegant_c17_table", criado: "elegant_c17_smalltable",
    tapete: "waasa_rug1", armario: "elegant_c17_cupboard", fonte: "paris15_ltdfountain", balcao: "js_exe_bardesk", tela: "computer_flatscreen",
    planta: "hotel_c18_tree", flores: "wed_plant", abajur: "classic1_lamp", banco: "greek_c15_bench",
  }, {
    // Acentos escolhidos: obra do saguão, parede, miudezas de cada canto.
    acentos: ["eleblock4", "val12_marble1", "val12_marble2", "greek_block", "greek_corner", "hotel_c18_stairs", "window_double_default",
      "mafia_c26_walllamp_white", "wallmirror", "attic15_painting", "elegant_c17_walldecor", "uni_coatrack", "waasa_wall_shelf2", "pixel_clock_black",
      "romantique_clock", "hc_luggage", "waasa_aquarium", "mafia_c26_teleport_dark", "olympics_r16_vendingmchn", "matic_water_dispenser",
      "room_cof15_cup2", "classic2_drinkcup", "antique_c21_books", "magazines", "wcandle", "mafia_c26_vase_white",
      "doormat_plain", "greek_c15_lamp", "bling11_pillar", "bling11_statue1"],
  });
  s.casca(null, 1, ["eleblock4", 0]);
  s.piso("val12_marble1", { x0: 0, y0: 0, x1: 16, y1: 18 });
  s.piso("val12_marble1", { x0: 16, y0: 0, x1: 20, y1: 14 });
  s.piso("val12_marble1", { x0: 16, y0: 14, x1: 18, y1: 16 });

  // Mezanino de mármore preto; flores no guarda-corpo, uma a cada dois
  // blocos (ritmo); colunas gregas no térreo; vão para a escada em x 14–15.
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 2, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [1, 5, 9],
    lados: ["frente", "direita"], abertura: [14, 16], enfeite: { classes: ["wed_plant", "wcandle"], cada: 2 } });
  // Mesma escada de pedra do Foco, três degraus até a galeria (Paulo,
  // 19/10/2026: a pilha de blocos com tapete vermelho dominava a sala).
  s.escada("hotel_c18_stairs", 14, 7, [0, -1]);

  // --- Mezanino: biblioteca e estar ---
  s.canto("biblioteca do mezanino", { funcao: "ler com calma acima do saguão", destaque: "elegant_c17_cupboard" });
  s.por("elegant_c17_cupboard", 0, 0, { nivel: 1, dir: 2 });
  const leitura = s.mesa({ nivel: 1, x: 2, y: 2, tampo: "elegant_c17_smalltable", cadeira: "elegant_c17_chair", lados: ["esquerda", "direita"], sobre: ["antique_c21_books", "wcandle"] });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura.esquerda });
  s.parede("esquerda", { de: 2, ate: 4, nivel: 1, altura: 1.2 }, ["wallmirror"]);
  s.canto("estar do mezanino", { funcao: "conversar olhando o saguão", destaque: "elegant_c17_sofa" });
  const cima = s.estar({ nivel: 1, x: 7, y: 1, sofa: "elegant_c17_sofa", mesa: "elegant_c17_table", poltrona: "elegant_c17_chair",
    sobreMesa: ["wed_plant"] });
  s.emCima(8, 2, "wcandle", { nivel: 1 });
  s.figurante({ figura: FIGURAS.amiga, sentado: cima.sofa });
  const arandela = { classe: "mafia_c26_walllamp_white", altura: 1.4 };
  s.parede("fundo", { de: 3, ate: 15, nivel: 1, altura: 0.8 }, [arandela, "window_double_default", arandela, "window_double_default", arandela]);

  // --- Recepção no eixo da porta ---
  recepcao(s, { x: 9, y: 7, pecas: 2, porta: [10, 17], atendente: FIGURAS.recepcionista });

  // --- Fonte: o destaque do saguão, com bancos de mármore dos dois lados ---
  s.canto("fonte", { funcao: "receber e marcar o centro do saguão", destaque: "paris15_ltdfountain" });
  s.por("paris15_ltdfountain", 9, 11);
  s.assento("greek_c15_bench", 8, 13, [9, 13]);
  s.assento("greek_c15_bench", 12, 13, [11, 13]);

  // --- Estar dos aquários, na parede da esquerda ---
  s.canto("estar dos aquários", { funcao: "esperar sentado com calma", destaque: "elegant_c17_sofa" });
  const estar = s.estar({ x: 0, y: 7, olha: "direita", sofa: "elegant_c17_sofa", mesa: "elegant_c17_table", poltrona: "elegant_c17_chair",
    tapete: "waasa_rug1", sobreMesa: ["wed_plant"] });
  s.emCima(1, 8, "classic1_lamp");
  s.figurante({ figura: FIGURAS.amigo, sentado: estar.antes });
  s.parede("esquerda", { de: 6, ate: 10, altura: 1.6 }, [{ classe: "mafia_c26_walllamp_white", altura: 1.6 }, "attic15_painting", { classe: "mafia_c26_walllamp_white", altura: 1.6 }]);
  s.por("waasa_aquarium", 0, 11, { dir: 2 });
  s.parede("esquerda", { de: 11, ate: 13, altura: 2.6 }, [{ classe: "mafia_c26_walllamp_white", altura: 2.6 }]);
  s.parede("esquerda", { de: 13, ate: 14, altura: 2.4 }, [{ classe: "mafia_c26_walllamp_white", altura: 2.4 }]);

  // --- Chegada, perto da porta: relógio, cabideiro, malas e duas poltronas ---
  s.canto("chegada", { funcao: "chegar, deixar o casaco e esperar", destaque: "romantique_clock" });
  s.por("romantique_clock", 0, 14, { dir: 2 });
  s.parede("esquerda", { de: 15, ate: 17, altura: 1.8 }, ["uni_coatrack"]);
  s.por("hc_luggage", 2, 15);
  s.mesa({ x: 4, y: 14, tampo: "elegant_c17_smalltable", cadeira: "elegant_c17_chair", lados: ["esquerda", "direita"], sobre: ["magazines", "wcandle"] });

  // --- Entrada: capacho e tochas de mármore dos dois lados da porta ---
  s.canto("entrada", { funcao: "marcar a porta", destaque: "greek_c15_lamp" });
  s.por("doormat_plain", 9, 16);
  s.por("doormat_plain", 10, 16);
  s.por("greek_c15_lamp", 8, 16, { dir: 2 });
  s.por("greek_c15_lamp", 11, 16, { dir: 2 });

  // --- Estar azul, à direita, sob o lustre ---
  s.canto("estar azul", { funcao: "conversar em grupo", destaque: "elegant_c17_sofa" });
  s.estar({ x: 15, y: 12, sofa: "elegant_c17_sofa", mesa: "elegant_c17_table", poltrona: "elegant_c17_chair",
    tapete: "waasa_rug1", sobreMesa: ["wed_plant"] });
  s.emCima(16, 13, "wcandle");

  // --- Café do saguão, à direita: duas mesinhas ---
  s.canto("café do saguão", { funcao: "tomar um café rápido", destaque: "elegant_c17_smalltable" });
  const cafe = s.mesa({ x: 18, y: 6, tampo: "elegant_c17_smalltable", cadeira: "elegant_c17_chair", lados: ["esquerda", "direita"], sobre: ["classic1_lamp"] });
  s.figurante({ figura: FIGURAS.hospede, sentado: cafe.esquerda });
  s.mesa({ x: 18, y: 9, tampo: "elegant_c17_smalltable", cadeira: "elegant_c17_chair", lados: ["esquerda", "direita"], sobre: ["wcandle"] });

  // --- Máquinas e teleporte da Praça, no canto do fundo ---
  s.canto("máquinas e Praça", { funcao: "lanche e passagem para a Praça", destaque: "mafia_c26_teleport_dark" });
  s.por("olympics_r16_vendingmchn", 16, 0, { dir: 4 });
  s.por("mafia_c26_teleport_dark", 17, 0, { dir: 4 });
  s.parede("fundo", { de: 18, ate: 20, altura: 1.6 }, ["waasa_wall_shelf2"]);
  s.parede("fundo", { de: 18, ate: 20, altura: 5.4 }, ["pixel_clock_black"]);
  return s.fechar();
}
