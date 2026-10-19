// Centro de Operação (pedido do Paulo, 19/10/2026): sala dos agentes de
// conteúdo, um por cliente, cada um na sua mesa com o nome do cliente (o
// navegador ocupa os postos com os clientes; docs/planejamentos-plano.md).
// Conceito: sala de controle da agência. No fundo, o telão e os relógios; no
// meio, duas fileiras de estações dos dois lados do corredor que sai da porta;
// na frente à esquerda, a mesa de aprovação onde o head revisa o planejamento;
// à direita, a espera com café. Mesma coleção da ilha de edição da Produção.
import { novaCena } from "../escritorio-construcao.mjs";

// Agentes: mesmo uniforme laranja da Vybe com fone; muda o rosto e o cabelo.
const AGENTES = [
  "hr-3163-45.hd-180-1.ch-3030-73.lg-275-1408.sh-290-62.ea-1406-62",
  "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62.ea-1406-62",
  "hr-828-61.hd-180-2.ch-3030-73.lg-280-110.sh-305-62.ea-1406-62",
  "hr-515-61.hd-600-1.ch-3030-73.lg-700-110.sh-725-62.ea-1406-62",
];

export default function operacao() {
  const s = novaCena("operacao");
  s.colecao({ mesa: "modern_c17_desk", tela: "modern_c17_iscreen", cadeira: "modern_c17_chair", mesaReuniao: "army_c15_contable",
    cadeiraReuniao: "army_c15_leatherchr", sofa: "modern_c17_sofa", luz: "army_c15_light" }, {
    acentos: ["xmas_c16_woodtile", "modern_c17_lamp", "modern_c17_floorlamp", "modern_c17_folder", "modern_c17_reads", "modern_c17_lowtable",
      "studio_monitor", "army_c15_plant", "army_c15_notice", "pixel_clock_black", "waasa_wall_shelf1", "hc26_3", "hc26_10",
      "doormat_plain", "room_cof15_cup2", "classic2_drinkcup", "computer_flatscreen", "army_c15_deskcomp", "computer_laptop",
      "cubie_lamp_b", "exe_c15_telephone", "exe_c15_desktidy", "army15_largescreen", "steampunk_map", "pixel_clock_red"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Telão: monitores no fundo, de frente para as estações ---
  s.canto("telão", { funcao: "acompanhar a operação de todos os clientes", destaque: "studio_monitor" });
  for (const x of [7, 9, 12, 14]) s.por("studio_monitor", x, 0, { olha: [x, 4] });
  s.parede("fundo", { de: 5, ate: 17, altura: 2.2 }, ["army15_largescreen", "steampunk_map", "army15_largescreen"]);
  s.parede("fundo", { de: 0, ate: 5, altura: 2.4 }, ["pixel_clock_black", "pixel_clock_red", "waasa_wall_shelf1"]);
  s.parede("fundo", { de: 17, ate: 22, altura: 2.4 }, ["waasa_wall_shelf1", "pixel_clock_red", "pixel_clock_black"]);

  // --- Estações dos agentes: duas fileiras, dos dois lados do corredor ---
  // Cada mesa tem a tela virada para a cadeira; o posto é o número do lugar.
  // Telas e acessórios variam de mesa em mesa, como numa sala de verdade.
  const TELAS = ["modern_c17_iscreen", "computer_flatscreen", "army_c15_deskcomp", "computer_laptop"];
  const AO_LADO = ["modern_c17_lamp", "exe_c15_telephone", "cubie_lamp_b", "exe_c15_desktidy"];
  s.canto("estações dos agentes", { funcao: "cada agente produz o planejamento do seu cliente", destaque: "modern_c17_desk" });
  let posto = 0;
  for (const y of [3, 7]) {
    for (const x of [1, 3, 5, 7, 13, 15, 17, 19]) {
      s.por("modern_c17_desk", x, y, { dir: 2 });
      const cad = s.assento("modern_c17_chair", x, y + 1, [x, y]);
      s.emCima(x, y, TELAS[posto % 4], { olha: [x, y + 1] });
      s.emCima(x + 1, y, AO_LADO[(posto + Math.floor(posto / 4)) % 4]);
      s.figurante({ figura: AGENTES[posto % AGENTES.length], sentado: cad, posto });
      posto++;
    }
  }
  for (const [x, y] of [[4, 5], [16, 5], [4, 9], [16, 9]]) s.pendente("army_c15_light", x, y, { dir: 2, altura: 1.2 });

  s.parede("esquerda", { de: 1, ate: 14, altura: 2.2 }, ["army15_largescreen", "pixel_clock_red", "waasa_wall_shelf1", "pixel_clock_black", "waasa_wall_shelf1"]);

  // --- Mesa de aprovação: o head revisa o planejamento do cliente ---
  s.canto("mesa de aprovação", { funcao: "o head revisa e manda o planejamento para o cliente", destaque: "army_c15_contable" });
  s.mesa({ x: 3, y: 12, tampo: "army_c15_contable", cadeira: "army_c15_leatherchr", lados: ["esquerda", "direita", "frente"], sobre: ["modern_c17_reads"] });
  s.emCima(4, 12, "room_cof15_cup2");
  s.por("army_c15_notice", 6, 11, { dir: 4 });
  s.por("modern_c17_floorlamp", 1, 10);
  s.por("army_c15_plant", 0, 14);

  // --- Espera com café, na frente à direita ---
  s.canto("espera", { funcao: "esperar a reunião com o cliente", destaque: "modern_c17_sofa" });
  s.estar({ x: 17, y: 12, sofa: "modern_c17_sofa", mesa: "hc26_3", poltrona: "hc26_10", poltronas: ["antes"], sobreMesa: ["classic2_drinkcup"] });
  s.por("army_c15_plant", 21, 14);
  s.por("modern_c17_floorlamp", 21, 11);

  // --- Entrada ---
  s.canto("entrada", { funcao: "chegar ao Centro de Operação", destaque: "doormat_plain" });
  s.por("doormat_plain", 10, 14);
  s.por("doormat_plain", 11, 14);
  return s.fechar();
}
