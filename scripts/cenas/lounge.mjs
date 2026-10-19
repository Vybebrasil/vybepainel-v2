// Lounge: bar-garagem "Garage 93 Vinyl" (referência do Paulo, 18/10/2026):
// a oficina de um mecânico que vira bar de vinil à noite. Tijolo nas
// paredes, luz de bar. Da porta o olhar vai à moto montada na parede da
// garagem, no fundo. Bar de caixotes na parede da esquerda; palco do DJ um
// degrau acima no fundo à direita; salão com mesa de carretel e sofá
// pichado; jogos perto da porta; miudezas da garagem no chão de cada canto.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  barman: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  dj: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110.ea-1406-62",
  cliente1: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  cliente2: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62",
  mecanico: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
};

export default function lounge() {
  const s = novaCena("lounge");
  s.colecao({ caixote: "wildwest_crate", banqueta: "lodge_dark_barrelstool", lampada: "grungelamp", mesa: "grunge_table", cadeira: "recycler_cratechairdark",
    moto: "tokyo_c18_motorbike", guitarra: "band_c19_guitar", dj: "fest_c19_dj" }, {
    acentos: ["xmas_c16_woodtile", "ads_711shelf", "grunge_shelf", "glass_shelf", "olympics_r16_vendingmchn", "sb_tag1", "md_can",
      "nyc_c23_wallposters", "pirate_bottle_1", "pirate_bottle_3", "grunge_candle", "sunsetcafe_c20_coffeemachine", "xmas_c24_mugs", "uni_c23_locker",
      "ads_ontrackgp_tools", "guitar_skull", "ranch_c26_farmtools", "bump_tires", "bc_cone_recolorable", "lt_spider",
      "hween_c25_tools", "uni_vinyl", "disco_c26_neonlight1", "party_beamer", "studio_guitar", "ads_idol_mic", "darkmodern_c20_speakers",
      "hween_c20_porchstairs", "grunge_chair", "graffiti_r24_sofa", "graffiti_r24_arcademachine", "vwave_r21_jukebox", "bling15_pooltable",
      "uni_c23_toiletpaper", "vwave_c21_trash", "graffiti_c24_paintbucket", "attic15_mousetrap", "hween_c17_rat", "doormat_plain"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Bar de caixotes na parede da esquerda ---
  s.canto("bar", { funcao: "servir bebida e café", destaque: "wildwest_crate" });
  s.por("olympics_r16_vendingmchn", 0, 0, { olha: [3, 0] });
  s.por("ads_711shelf", 0, 1, { olha: [3, 1] });
  s.por("grunge_shelf", 0, 3, { olha: [3, 4] });
  s.por("glass_shelf", 0, 6, { olha: [3, 6] });
  s.parede("esquerda", { de: 6, ate: 9.6, altura: 2.2 }, ["sb_tag1"]);
  for (let y = 2; y <= 7; y++) s.por("wildwest_crate", 2, y);
  for (const [y, c] of [[2, "pirate_bottle_1"], [3, "grunge_candle"], [4, "sunsetcafe_c20_coffeemachine"], [5, "pirate_bottle_3"], [6, "xmas_c24_mugs"], [7, "grunge_candle"]]) s.emCima(2, y, c);
  const banquetas = [3, 5, 7].map((y) => s.assento("lodge_dark_barrelstool", 3, y, [2, y]));
  s.figurante({ figura: FIGURAS.barman, x: 1, y: 4, dir: 2 });
  s.figurante({ figura: FIGURAS.cliente1, sentado: banquetas[1] });
  for (const y of [4, 6]) s.pendente("grungelamp", 3, y, { estado: 1 });

  // --- Garagem no fundo: a moto montada na parede é o destaque ---
  s.canto("garagem", { funcao: "a oficina que dá nome ao bar", destaque: "tokyo_c18_motorbike" });
  s.por("uni_c23_locker", 3, 0, { olha: [3, 3] });
  s.por("nyc_c23_wallposters", 4, 0, { dir: 2 });
  s.por("ads_ontrackgp_tools", 5, 0, { olha: [5, 3] });
  s.por("tokyo_c18_motorbike", 6, 0, { dir: 2, naParede: 1.4 });
  s.por("band_c19_guitar", 9, 0, { dir: 4, naParede: 1.6 });
  s.parede("fundo", { de: 6, ate: 9, altura: 3.4 }, ["md_can"]);
  // Pneus empilhados, cone, ferramentas e a placa no canto da oficina.
  s.por("bump_tires", 4, 2);
  s.emCima(4, 2, "bump_tires");
  s.emCima(4, 2, "bump_tires");
  s.por("bc_cone_recolorable", 6, 3, { estado: 130 });
  s.por("ranch_c26_farmtools", 9, 1);
  s.por("hween_c25_tools", 7, 2);
  s.figurante({ figura: FIGURAS.mecanico, x: 8, y: 2, dir: 0 });
  s.pendente("grungelamp", 7, 2, { estado: 1 });

  // --- Palco do DJ, um degrau acima (x 11–15, y 0–4) ---
  s.canto("palco do DJ", { funcao: "tocar vinil para o salão", destaque: "fest_c19_dj" });
  s.por("fest_c19_dj", 12, 1, { olha: [12, 6] });
  s.figurante({ figura: FIGURAS.dj, x: 12, y: 0, dir: 4 });
  s.por("disco_c26_neonlight1", 14, 0, { dir: 0 });
  s.parede("fundo", { de: 11, ate: 12.4, altura: 2 }, ["uni_vinyl"]);
  s.por("studio_guitar", 15, 1, { olha: [15, 5] });
  s.por("darkmodern_c20_speakers", 11, 4);
  s.por("darkmodern_c20_speakers", 15, 4);
  s.por("party_beamer", 11, 1, { olha: [14, 1] });
  s.por("ads_idol_mic", 14, 3, { olha: [14, 6] });
  s.escada("hween_c20_porchstairs", 13, 5, [0, -1]);
  s.pendente("grungelamp", 13, 2, { estado: 1 });

  // --- Salão: mesa de carretel com cadeiras de caixote, sofá pichado ---
  s.canto("salão", { funcao: "conversar ouvindo o vinil", destaque: "grunge_table" });
  s.por("grunge_table", 6, 6);
  s.assento("recycler_cratechairdark", 5, 6, [6, 6]);
  s.assento("recycler_cratechairdark", 8, 7, [7, 7]);
  const cad = s.assento("grunge_chair", 6, 8, [6, 7]);
  s.figurante({ figura: FIGURAS.cliente2, sentado: cad });
  s.pendente("grungelamp", 7, 6, { estado: 1 });
  s.por("graffiti_r24_sofa", 12, 9, { olha: [12, 6] });
  s.por("vwave_c21_trash", 14, 9);
  s.por("graffiti_c24_paintbucket", 15, 11);
  s.pendente("grungelamp", 13, 7, { estado: 1 });

  // --- Jogos perto da porta, à esquerda ---
  s.canto("jogos", { funcao: "jogar sinuca e fliperama", destaque: "bling15_pooltable" });
  s.por("graffiti_r24_arcademachine", 0, 9, { olha: [3, 9] });
  s.por("vwave_r21_jukebox", 0, 10, { olha: [3, 10] });
  s.por("bling15_pooltable", 2, 10, { dir: 4 });
  s.pendente("grungelamp", 4, 9, { estado: 1 });
  s.por("attic15_mousetrap", 1, 8);
  s.por("hween_c17_rat", 1, 11);

  // --- Entrada: papel amassado e capacho ---
  s.canto("entrada", { funcao: "chegar ao bar", destaque: "doormat_plain" });
  s.por("doormat_plain", 7, 10);
  s.por("doormat_plain", 8, 10);
  s.por("uni_c23_toiletpaper", 10, 10);
  return s.fechar();
}
