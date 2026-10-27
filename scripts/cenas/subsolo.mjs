// Subsolo (Paulo, 27/10/2026): o easter egg embaixo do Centro de Operação.
// Quem administra acha a estante secreta no Centro e desce para cá, onde ficam
// os clientes e os colaboradores desativados. Cada um é um figurante de pé ao
// lado da sua lápide ou da sua cripta (o navegador ocupa os postos com quem
// está desativado de verdade; vybe-escritorio-subsolo.js). De cada um dá para
// reviver ou, com o botão especial, apagar para sempre (vybe-ciclo.js).
//
// Conceito (revisão do Paulo, 27/10: "não tá nada com cara de cripta", "mais
// rico, piso com textura, nada blocado e largado"): um cemitério velho dentro
// de uma cripta de pedra, à luz de vela e tocha.
//   esquerda: o cemitério dos clientes, em chão de terra e musgo, lápides
//             tortas e variadas (cruz celta, lápide de rosas, lápide gasta),
//             cercado de ferro, com árvores secas, ossos, rosas e névoa;
//   direita:  a ala das criptas do time, em laje de pedra, com castiçais;
//   fundo:    o poço das almas entre dois anjos de pedra, com o livro de
//             registros (cadastro de cliente e colaborador novo) ao lado.
// O caminho de laje sai da porta e sobe reto até o poço.
import { novaCena } from "../escritorio-construcao.mjs";

// Quem ainda não tem dono no posto aparece só no editor; o navegador veste
// cada desativado com a roupa dele (agente do cliente ou boneco da pessoa).
const ALMA = "hr-828-61.hd-180-1.ch-215-1408.lg-280-1408.sh-305-1408";
const LAPIDES = ["hal_grave", "vikings_tombstone", "hween_c21_gravestone"];

export default function subsolo() {
  const s = novaCena("subsolo");
  s.colecao({ lapide: LAPIDES, cripta: "hween_r22_coffin", poco: "hween_c22_pitofsouls", anjo: "hween_c22_darkangelstatue" }, {
    acentos: ["hween_c22_bookofdead", "hween_c15_tree", "hween_c17_rock", "hween_c17_rock2", "hween_c20_crookedtree", 
      "hween10_fog", "hween_c15_fog", "hween14_hangskull", "hween14_skullcandle", "hween_c22_darkcandles", "hween14_candletrail",
      "hween10_skullpost", "hween_c17_lichen", "hween10_wallskull", "hween14_stainglass", "hween09_win", "hween09_paint",
      "hween10_fogwall", "hween09_curt", "hween08_wndw", "st_wildwest_wallskull", "vikings_torch", 
      "hween_c20_lamp", "xmas_c16_woodtile", "hween14_wall", "hween_c25_mossyfloor", "hween13_floor2", "hween13_fence_1",
      "hween_c22_zombiehand", "hween14_skelepieces", "hween_c22_darkskull", "hween13_rose", "hween_c21_spiderlily",
      "hween_c26_skullvase", "hween12_lantern", "hween_c21_lantern", "anc_bones", "hween_c19_bewitchedskull"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);
  // Pedra escura em toda a parede: a cripta não tem madeira à vista.
  s.revestir("fundo", { de: 0, ate: 24, classe: "hween14_wall" });
  s.revestir("esquerda", { de: 0, ate: 18, classe: "hween14_wall" });

  // --- Chão: terra com musgo no cemitério, laje no caminho e nas criptas ---
  // O musgo alterna os três desenhos da peça (um tem poça) para não repetir.
  for (let x = 0; x < 10; x += 2) for (let y = 0; y < 18; y += 2) s.piso("hween_c25_mossyfloor", { x0: x, y0: y, x1: x + 2, y1: y + 2, estado: (x * 3 + y * 5) % 3 });
  s.piso("hween13_floor2", { x0: 10, y0: 0, x1: 24, y1: 18 });

  // --- Poço das almas: o ponto de destaque, entre dois anjos de pedra ---
  s.canto("poço das almas", { funcao: "o centro do subsolo, para onde o caminho da porta leva", destaque: "hween_c22_pitofsouls" });
  s.por("hween_c22_pitofsouls", 11, 1);
  s.por("hween_c22_darkangelstatue", 10, 1);
  s.por("hween_c22_darkangelstatue", 13, 1);
  s.por("hween_c22_darkcandles", 10, 3);
  s.parede("fundo", { de: 11, ate: 13, altura: 2 }, ["hween10_wallskull"]);

  // --- Livro de registros: num canto do caminho, à luz de um castiçal ---
  s.canto("livro de registros", { funcao: "cadastrar cliente e colaborador novo (abre a janela de cadastro)", destaque: "hween_c22_bookofdead" });
  s.por("hween_c22_bookofdead", 13, 5);
  s.por("hween_c26_skullvase", 13, 4);

  // --- Cemitério dos clientes: lápides tortas, cada cliente na frente da sua ---
  // Fileiras desencontradas (como cemitério velho, não plateia), três tipos
  // de lápide se alternando; o cliente fica de pé no ladrilho da frente.
  s.canto("cemitério dos clientes", { funcao: "os clientes desativados, cada um na frente da sua lápide", destaque: "hal_grave" });
  let posto = 0, k = 0;
  for (const [y, xs] of [[3, [1, 4, 7]], [6, [2, 5, 8]], [9, [1, 4, 7]], [12, [2, 5, 8]], [15, [1, 4, 7]]]) {
    for (const x of xs) {
      s.por(LAPIDES[k++ % LAPIDES.length], x, y);
      s.figurante({ figura: ALMA, x, y: y + 1, dir: 4, posto, ala: "clientes" });
      posto++;
    }
  }
  // Entre as lápides: rosas, lírios, ossos, mão saindo da terra e velas.
  const MIUDEZAS = ["hween13_rose", "hween14_skullcandle", "hween_c21_spiderlily", "hween14_skelepieces", "hween_c22_zombiehand", "hween14_skullcandle", "hween_c19_bewitchedskull", "hween13_rose"];
  [[3, 3], [6, 4], [0, 7], [4, 7], [3, 7], [0, 10], [6, 10], [4, 13], [7, 13], [3, 16], [6, 16]]
    .forEach(([x, y], i) => s.por(MIUDEZAS[i % MIUDEZAS.length], x, y));
  // Árvores secas nos cantos do cemitério e névoa rasteira.
  s.por("hween_c15_tree", 1, 1);
  s.por("hween_c20_crookedtree", 9, 16);
  s.por("hween10_fog", 2, 1);
  s.por("hween10_fog", 5, 1);
  // Lanternas no chão do cemitério, entre as covas.
  s.por("hween_c21_lantern", 6, 7);
  s.por("hween_c21_lantern", 9, 13);
  s.por("hween_c21_lantern", 6, 13);
  // Cerca de ferro separando o cemitério do caminho, com passagens.
  for (const y of [4, 10]) s.por("hween13_fence_1", 10, y, { dir: 2 });
  s.parede("esquerda", { de: 1, ate: 17, altura: 0.6 }, ["hween09_curt", "hween10_wallskull", "hween08_wndw", "st_wildwest_wallskull", "hween09_paint", "hween10_wallskull"]);
  s.parede("fundo", { de: 0, ate: 9, altura: 0.6 }, ["hween09_win", "hween10_wallskull", "hween14_stainglass"]);

  // --- Criptas do time: à direita, na laje ---
  // Cada colaborador ao lado do seu caixão de veludo, entre castiçais (a peça
  // já traz os candelabros): duas fileiras desencontradas, não uma grade.
  s.canto("criptas do time", { funcao: "os colaboradores desativados, cada um ao lado do seu caixão", destaque: "hween_r22_coffin" });
  for (const [x, y] of [[15, 2], [20, 3], [15, 8], [20, 9], [15, 13], [20, 14]]) {
    s.por("hween_r22_coffin", x, y);
    s.figurante({ figura: ALMA, x: x + 3, y: y + 1, dir: 4, posto, ala: "time" });
    posto++;
  }
  for (const [x, y] of [[14, 6], [23, 7], [23, 12], [17, 17]]) s.por("vikings_torch", x, y);
  s.por("hween_c26_skullvase", 19, 12);
  s.por("hween14_skullcandle", 19, 7);
  s.por("hween14_skullcandle", 23, 17);
  s.por("hween_c22_darkcandles", 23, 2);
  s.parede("fundo", { de: 15, ate: 24, altura: 0.6 }, ["hween10_wallskull", "hween09_paint", "hween10_wallskull"]);

  // --- Caminho e entrada: lanternas na laje até o poço ---
  s.canto("caminho", { funcao: "descer da porta do Centro de Operação até o poço das almas", destaque: "hween12_lantern" });
  s.por("hween12_lantern", 10, 7);
  s.por("hween12_lantern", 13, 10);
  s.por("hween_c20_lamp", 13, 8);
  s.por("hween_c20_lamp", 13, 13);
  s.por("hween14_candletrail", 10, 16);
  s.por("hween14_candletrail", 13, 16);
  s.por("hween10_skullpost", 14, 16);
  return s.fechar();
}
