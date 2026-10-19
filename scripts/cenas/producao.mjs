// Produção: estúdio de foto e vídeo da agência (plano do Paulo, 18/10/2026).
// Sala em L. No patamar da direita, o set de gravação: parede de tijolo de
// fundo, sofá e poltronas de entrevista, refletores e a câmera de grua
// apontada para o set. No recuo do fundo, a ilha de edição com estações de
// trabalho. À esquerda, o podcast (mesa de som, mesa com microfones) e o
// acervo de equipamentos. Na frente à direita, a espera do cliente.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  apresentadora: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  convidado: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  editor: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  podcaster: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  cliente: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
};

export default function producao() {
  const s = novaCena("producao");
  s.colecao({ fundoDoSet: "modern_c17_wall", sofa: "hc26_5", mesaCentro: "hc26_3", poltrona: "hc26_10", camera: "studio_camera", refletor: "spotlight",
    mesa: "modern_c17_desk", tela: "modern_c17_iscreen", cadeira: "modern_c17_chair", mesaDeSom: "studio_mixingdesk", microfone: "ads_drsports_microphone2",
    estante: "army_c15_bookshelf", luz: "army_c15_light" }, {
    acentos: ["xmas_c16_woodtile", "ads_aftv_floorlight", "studio_monitor", "studio_chair", "modern_c17_lowtable", "modern_c17_lamp", "modern_c17_floorlamp",
      "modern_c17_folder", "modern_c17_reads", "modern_c17_display", "modern_c17_pictures", "modern_c17_photos", "modern_c17_sofa", "army_c15_crate",
      "army_c15_plant", "pixel_clock_black", "army_c15_contable", "army_c15_leatherchr", "army_c15_notice", "waasa_wall_shelf1", "doormat_plain", "classic2_drinkcup", "room_cof15_cup2"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Set de gravação no patamar (x 12–19, y 0–5) ---
  s.canto("set de gravação", { funcao: "gravar entrevistas e vídeos", destaque: "modern_c17_wall" });
  s.por("modern_c17_wall", 15, 0, { olha: [15, 5] });
  const set = s.estar({ x: 14, y: 2, sofa: "hc26_5", mesa: "hc26_3", poltrona: "hc26_10", sobreMesa: ["classic2_drinkcup"] });
  s.figurante({ figura: FIGURAS.apresentadora, sentado: set.antes });
  s.figurante({ figura: FIGURAS.convidado, sentado: set.sofa });
  s.por("spotlight", 12, 2, { olha: [15, 2] });
  s.por("spotlight", 18, 2, { olha: [15, 2] });
  s.por("ads_aftv_floorlight", 13, 1);
  s.por("ads_aftv_floorlight", 18, 1);
  s.parede("fundo", { de: 17, ate: 19, altura: 2.4 }, ["pixel_clock_black"]);
  s.canto("câmera", { funcao: "filmar o set", destaque: "studio_camera" });
  // A câmera de grua só vira para leste ou sul: filma o set de lado, do recuo.
  s.por("studio_camera", 11, 3, { olha: [15, 3] });
  s.por("studio_monitor", 11, 4, { dir: 4 });

  // --- Ilha de edição no recuo do fundo (x 6–11) ---
  s.canto("ilha de edição", { funcao: "editar os vídeos e as fotos", destaque: "modern_c17_desk" });
  for (const x of [6, 8, 10]) {
    s.por("modern_c17_desk", x, 0, { dir: 2 });
    const cad = s.assento("modern_c17_chair", x, 1, [x, 0]);
    s.emCima(x, 0, "modern_c17_iscreen", { olha: [x, 1] });
    s.emCima(x + 1, 0, x === 8 ? "modern_c17_folder" : "modern_c17_lamp");
    if (x === 8) s.figurante({ figura: FIGURAS.editor, sentado: cad });
  }
  s.pendente("army_c15_light", 8, 2, { dir: 2 });
  s.parede("fundo", { de: 6, ate: 12, altura: 2.4 }, ["waasa_wall_shelf1", "pixel_clock_black", "waasa_wall_shelf1"]);

  // --- Podcast, à esquerda (x 0–5, y 5–9) ---
  s.canto("podcast", { funcao: "gravar o podcast", destaque: "studio_mixingdesk" });
  s.por("studio_mixingdesk", 0, 5, { olha: [2, 9] });
  // Mesa comprida do podcast: as duas cadeiras do mesmo lado (a mesa desenhada
  // depois cobriria quem senta do outro lado), cada uma com o seu microfone.
  const mesaPod = s.mesa({ x: 2, y: 7, tampo: "modern_c17_lowtable", cadeira: "studio_chair", lados: ["direita"] });
  s.assento("studio_chair", 3, 9, [2, 9]);
  s.emCima(2, 7, "ads_drsports_microphone2");
  s.emCima(2, 9, "ads_drsports_microphone2");
  s.figurante({ figura: FIGURAS.podcaster, sentado: mesaPod.direita });
  s.pendente("army_c15_light", 2, 8, { dir: 2 });
  s.por("modern_c17_floorlamp", 5, 6);
  s.parede("esquerda", { de: 6, ate: 8, altura: 2.2 }, ["waasa_wall_shelf1"]);
  s.por("modern_c17_photos", 0, 8, { dir: 2 });

  // --- Acervo de equipamentos, na frente à esquerda ---
  s.canto("acervo", { funcao: "guardar equipamento e cenário", destaque: "army_c15_bookshelf" });
  s.por("army_c15_bookshelf", 0, 11, { olha: [3, 11] });
  s.por("army_c15_crate", 1, 13);
  s.por("army_c15_crate", 2, 13);
  s.emCima(1, 13, "army_c15_crate");
  s.por("modern_c17_display", 0, 10, { dir: 2 });

  // --- Mesa de pauta no meio: a equipe planeja as gravações ---
  s.canto("mesa de pauta", { funcao: "planejar as gravações da semana", destaque: "army_c15_contable" });
  s.mesa({ x: 7, y: 7, tampo: "army_c15_contable", cadeira: "army_c15_leatherchr", lados: ["esquerda", "direita", "frente"], sobre: ["modern_c17_reads"] });
  s.emCima(8, 7, "room_cof15_cup2");
  s.por("army_c15_notice", 7, 5, { olha: [7, 9] });

  // --- Espera do cliente, na frente à direita ---
  s.canto("espera do cliente", { funcao: "receber o cliente para aprovar", destaque: "modern_c17_sofa" });
  const espera = s.estar({ x: 15, y: 10, sofa: "modern_c17_sofa", mesa: "hc26_3", poltrona: "hc26_10", poltronas: ["antes"], sobreMesa: ["room_cof15_cup2"] });
  s.figurante({ figura: FIGURAS.cliente, sentado: espera.sofa });
  s.por("modern_c17_floorlamp", 18, 10);
  s.por("army_c15_plant", 19, 12);
  s.pendente("army_c15_light", 12, 9, { dir: 2 });

  // --- Entrada ---
  s.canto("entrada", { funcao: "chegar ao estúdio", destaque: "doormat_plain" });
  s.por("doormat_plain", 9, 12);
  s.por("doormat_plain", 10, 12);
  return s.fechar();
}
