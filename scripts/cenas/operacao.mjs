// Centro de Operação (pedido do Paulo, 19/10/2026): a sala principal. Os
// agentes de conteúdo, um por cliente, trabalham nas mesas com o nome do
// cliente (o navegador ocupa os postos; docs/planejamentos-plano.md) e, desde
// a revisão de 19/10 (noite), o time também trabalha aqui: "precisa de espaço
// para quando o time quiser ficar aqui trabalhando".
// Conceito: sala de controle da agência, em três áreas lidas da porta.
//   fundo:    o telão com os monitores, de frente para todos;
//   esquerda: as estações dos agentes, duas fileiras de oito;
//   direita:  as mesas livres do time, duas fileiras de três, com tela e
//             cadeira vazias (quem chega senta);
//   frente:   a mesa de aprovação (o head revisa) à esquerda, a espera com
//             sofá à direita e o meio livre para conversar ao entrar.
// O corredor sai da porta e separa agentes e time. Mesma coleção da ilha de
// edição da Produção.
import { novaCena } from "../escritorio-construcao.mjs";

// Agentes: uniforme laranja da Vybe (1323). O navegador veste cada um com a
// fantasia da marca do cliente (ESCRITORIO_FANTASIAS em vybe-escritorio.js).
const AGENTES = [
  "hr-828-61.hd-180-1.ch-215-1323.lg-280-110.sh-305-110",
  "hr-890-45.hd-605-2.ch-3005-1323.lg-3116-110.sh-735-110",
  "hr-3163-45.hd-180-2.ch-215-1323.lg-280-110.sh-305-110",
  "hr-515-61.hd-600-1.ch-215-1323.lg-280-110.sh-305-110",
];

export default function operacao() {
  const s = novaCena("operacao");
  s.colecao({ mesa: "modern_c17_desk", tela: "computer_flatscreen", cadeira: "modern_c17_chair", mesaReuniao: "army_c15_contable",
    cadeiraReuniao: "army_c15_leatherchr", sofa: "modern_c17_sofa", luz: "army_c15_light" }, {
    acentos: ["xmas_c16_woodtile", "modern_c17_lamp", "modern_c17_floorlamp", "modern_c17_folder", "modern_c17_reads", "modern_c17_lowtable",
      "studio_monitor", "army_c15_plant", "army_c15_notice", "pixel_clock_black", "waasa_wall_shelf1", "hc26_3", "hc26_10",
      "doormat_plain", "room_cof15_cup2", "classic2_drinkcup", "computer_flatscreen", "computer_laptop", "computer_old", "uni_laptop",
      "cubie_lamp_b", "exe_c15_telephone", "exe_c15_desktidy", "army15_largescreen", "steampunk_map", "pixel_clock_red",
      "army_c15_glasscrn", "hc26_7", "hc26_2", "studio_stool", "exe_rug", "waasa_aquarium", "exe_artlamp", "army_c15_bookshelf",
      "exe_globe", "exe_map", "room_cof15_planter", "classic9_plant", "modern_c17_display"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Telão: monitores no fundo, de frente para as duas áreas ---
  s.canto("telão", { funcao: "acompanhar a operação de todos os clientes", destaque: "studio_monitor" });
  // No fundo do corredor, onde nenhuma mesa tapa.
  for (const x of [16, 18]) s.por("studio_monitor", x, 0, { olha: [x, 4] });
  s.parede("fundo", { de: 6, ate: 20, altura: 2.2 }, ["army15_largescreen", "steampunk_map", "army15_largescreen"]);
  s.parede("fundo", { de: 0, ate: 6, altura: 2.4 }, ["pixel_clock_black", "pixel_clock_red", "waasa_wall_shelf1"]);

  // --- Estações dos agentes: duas fileiras de oito, à esquerda ---
  // Cada mesa tem a tela virada para a cadeira; o posto é o número do lugar.
  // Telas e acessórios variam de mesa em mesa, como numa sala de verdade.
  const TELAS = ["computer_flatscreen", "computer_laptop", "computer_old", "uni_laptop"];
  // Só peças baixas ao lado da tela: luminária na mesa tapava o rosto de quem
  // está sentado (Paulo, 19/10/2026); a luz vem dos pendentes e das colunas.
  const AO_LADO = ["exe_c15_telephone", "exe_c15_desktidy", "modern_c17_folder", "room_cof15_cup2"];
  s.canto("estações dos agentes", { funcao: "cada agente produz o planejamento do seu cliente", destaque: "modern_c17_desk" });
  let posto = 0;
  for (const y of [3, 8]) {
    for (const x of [1, 3, 5, 7, 9, 11, 13, 15]) {
      // Agente atrás da mesa, de frente para quem entra (a fantasia do
      // cliente aparece); a tela vira para ele.
      s.por("modern_c17_desk", x, y, { dir: 2 });
      const cad = s.assento("modern_c17_chair", x, y - 1, [x, y]);
      s.emCima(x, y, TELAS[posto % 4], { olha: [x, y - 1] });
      s.emCima(x + 1, y, AO_LADO[(posto + Math.floor(posto / 4)) % 4]);
      s.figurante({ figura: AGENTES[posto % AGENTES.length], sentado: cad, posto });
      // Luz de chão ao lado da cadeira, na fileira do fundo: ilumina sem ficar
      // entre a câmera e o rosto.
      if (y === 3) s.por("modern_c17_floorlamp", x + 1, y - 1);
      posto++;
    }
  }

  // --- Mesas livres do time: duas fileiras de três, à direita ---
  // Mesmo móvel dos agentes, mas sem figurante: a cadeira fica livre para
  // quem chega sentar e trabalhar perto dos agentes dos seus clientes.
  s.canto("mesas livres do time", { funcao: "o time trabalha no Centro de Operação quando quiser", destaque: "modern_c17_desk" });
  let livre = 0;
  for (const y of [3, 8]) {
    for (const x of [19, 21, 23]) {
      s.por("modern_c17_desk", x, y, { dir: 2 });
      s.assento("modern_c17_chair", x, y - 1, [x, y]);
      s.emCima(x, y, livre % 2 ? "computer_laptop" : "computer_flatscreen", { olha: [x, y - 1] });
      s.emCima(x + 1, y, livre % 2 ? "modern_c17_folder" : "exe_c15_desktidy");
      s.por("modern_c17_floorlamp", x + 1, y - 1);
      livre++;
    }
  }
  // Canteiros entre o corredor e o time: separam sem fechar a passagem.
  s.canto("canteiros", { funcao: "separar as mesas do time do corredor", destaque: "room_cof15_planter" });
  for (const y of [4, 9]) s.por("room_cof15_planter", 18, y, { dir: 2 });
  // Parede de servidores no fundo do time: colunas de vidro azul acesas e a estante.
  s.canto("servidores", { funcao: "o lado técnico da operação, aceso no fundo", destaque: "army_c15_glasscrn" });
  s.por("army_c15_glasscrn", 20, 0);
  s.por("hc26_7", 22, 0);
  s.por("army_c15_glasscrn", 25, 0);
  // Pendentes só na frente das fileiras: atrás, tapavam quem está sentado.
  for (const [x, y] of [[4, 11], [10, 11], [16, 11], [22, 11], [12, 14]]) s.pendente("army_c15_light", x, y, { dir: 2, altura: 1.2 });

  s.parede("esquerda", { de: 1, ate: 10, altura: 2.2 }, ["army15_largescreen", "pixel_clock_red", "waasa_wall_shelf1"]);
  // Acima da mesa de aprovação: o mapa dos clientes e o relógio.
  s.parede("esquerda", { de: 12, ate: 18, altura: 2.2 }, ["pixel_clock_black", "waasa_wall_shelf1", "pixel_clock_red"]);

  // --- Mesa de aprovação: o head revisa o planejamento do cliente ---
  s.canto("mesa de aprovação", { funcao: "o head revisa e manda o planejamento para o cliente", destaque: "army_c15_contable" });
  s.mesa({ x: 3, y: 14, tampo: "army_c15_contable", cadeira: "army_c15_leatherchr", lados: ["esquerda", "direita", "frente"], sobre: ["modern_c17_reads"] });
  s.emCima(4, 14, "room_cof15_cup2");
  s.por("army_c15_notice", 7, 13, { dir: 4 });
  s.por("army_c15_bookshelf", 0, 11);
  s.por("exe_globe", 6, 16);
  s.por("modern_c17_floorlamp", 8, 16);
  s.por("army_c15_plant", 0, 17);

  // --- Balcão do meio: conversar em pé ao chegar ---
  s.canto("balcão", { funcao: "conversa rápida em pé ao entrar, com café", destaque: "hc26_2" });
  s.por("hc26_2", 11, 12);
  for (const x of [11, 12, 13]) s.assento("studio_stool", x, 14, [x, 13]);

  // --- Espera com café, na frente à direita ---
  s.canto("espera", { funcao: "esperar a reunião com o cliente e conversar", destaque: "modern_c17_sofa" });
  s.estar({ x: 21, y: 14, sofa: "modern_c17_sofa", mesa: "hc26_3", poltrona: "hc26_10", poltronas: ["antes"], sobreMesa: ["classic2_drinkcup"] });
  s.por("waasa_aquarium", 24, 11);
  s.por("exe_artlamp", 25, 16);
  s.por("army_c15_plant", 19, 17);

  // --- Entrada ---
  s.canto("entrada", { funcao: "chegar ao Centro de Operação", destaque: "doormat_plain" });
  s.por("doormat_plain", 12, 17);
  s.por("doormat_plain", 13, 17);
  s.por("classic9_plant", 10, 17);
  s.por("classic9_plant", 15, 17);
  return s.fechar();
}
