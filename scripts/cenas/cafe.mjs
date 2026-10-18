// Café: cafeteria de madeira em dois andares (referência aprovada pelo Paulo
// em 18/10/2026). Mezanino de construtor no fundo com cantinho de leitura e
// duas mesas; embaixo da beira, o balcão de trás com vitrines e cafeteira;
// na frente dele, o balcão de doces com caixa; salão com três mesas sob
// lustres e vigas com hera, canto de estar e o recanto da lareira no fundo
// à direita, de pé-direito alto. Paredes revestidas (lambri embaixo, papel
// em cima) com lousa, prateleiras e relógio. As portas de teleporte ligam
// o térreo ao mezanino. Cada peça passa pelo motor
// (scripts/escritorio-construcao.mjs), que calcula altura, direção e tapete.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  cozinheira: "hr-515-45.hd-600-1.ch-635-1408.lg-695-1408.sh-725-62",
  garcom: "hr-828-61.hd-180-2.ch-210-1408.lg-270-110.sh-290-62",
  barista: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
  cliente: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  amigo: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  amiga: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
};

export default function cafe() {
  const s = novaCena("cafe");
  const MEZ = 3.125;
  // Casca: cornija de madeira no topo das paredes.
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // Pisos de tábua do Habbo (o do quarto é liso): castanho no salão e sob o
  // mezanino, escuro no corredor do balcão e no recanto da lareira.
  s.piso("xmas_c22_woodenfloor", { x0: 0, y0: 0, x1: 14, y1: 4 });
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 4, x1: 12, y1: 6, estado: 1 });
  s.piso("rainyday_c20_woodenfloor", { x0: 14, y0: 0, x1: 16, y1: 4, estado: 1 });
  s.piso("xmas_c22_woodenfloor", { x0: 12, y0: 4, x1: 16, y1: 6 });
  s.piso("xmas_c22_woodenfloor", { x0: 0, y0: 6, x1: 16, y1: 12 });

  // Paredes do térreo: lambri de madeira com papel em cima (o desenho cobre
  // até perto da cornija).
  s.revestir("esquerda", { de: 4, ate: 12, classe: "wildwest_wallpaper", estado: 1 });
  s.revestir("fundo", { de: 14, ate: 16, classe: "wildwest_wallpaper", estado: 1 });

  // Mezanino (x 0–13, y 0–3): tábuas gastas, guarda-corpo na frente e na
  // ponta direita, colunas no térreo.
  s.mezanino({ x0: 0, y0: 0, x1: 14, y1: 4, altura: MEZ, piso: "hween_c26_wornfloorboards", guarda: "lodge_dark_divider",
    coluna: "lodge_dark_cornerplinth", colunas: [5, 9, 13], lados: ["frente", "direita"] });
  // Hera subindo pela coluna da ponta (nas do meio ela taparia o balcão).
  s.por("hween_c25_weed2", 13, 4);
  s.revestir("fundo", { de: 0, ate: 14, nivel: 1, classe: "hygge_c25_wallpaper1", estado: 4 });
  s.revestir("esquerda", { de: 0, ate: 4, nivel: 1, classe: "hygge_c25_wallpaper1", estado: 4 });

  // --- Andar de cima ---
  // Estante encostada na parede da esquerda; cantinho de leitura com chá e
  // um leitor na poltrona.
  s.por("hween_c26_bookshelf", 0, 0, { nivel: 1, dir: 0 });
  s.por("mafia_c26_sidetable_dark", 2, 1, { nivel: 1 });
  s.emCima(2, 1, "antique_c21_teaset", { nivel: 1 });
  const leitura = s.assento("antique_c21_armchair", 1, 1, [2, 1], { nivel: 1 });
  s.assento("antique_c21_armchair", 3, 1, [2, 1], { nivel: 1 });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura });
  s.por("antique_c21_lamp", 2, 0, { nivel: 1 });
  // Duas mesas: uma com bolo, outra com livros antigos.
  const doce = s.mesa({ nivel: 1, x: 6, y: 1, tampo: "paris_c15_table", cadeira: "paris_c15_chair", sobre: ["xmas_c24_plate", "val_c20_cake"] });
  s.figurante({ figura: FIGURAS.amiga, sentado: doce.direita });
  s.mesa({ nivel: 1, x: 10, y: 1, tampo: "rainyday_c20_woodentable", cadeira: "classic9_chair", sobre: ["antique_c21_books"] });
  s.por("classic9_plant", 12, 2, { nivel: 1 });
  // Porta do mezanino na parede da esquerda, em cima da do térreo (as duas
  // são o mesmo teleporte).
  s.por("antique_c21_doorteleport", 0, 2, { nivel: 1, dir: 2 });
  // Parede do fundo do mezanino: janelas com o quadro entre elas.
  s.parede("fundo", { de: 2, ate: 12, nivel: 1, altura: 0.3 }, ["lodge_dark_window", "attic15_painting", "lodge_dark_window"]);
  // Plantas penduradas na beira do mezanino, por cima do balcão.
  for (const x of [3, 12]) s.pendente("easter_c18_hangingplant", x, 4, { estado: 0 });

  // --- Térreo, embaixo da beira (balcão de trás) ---
  s.por("val_c20_cakedisplay", 1, 3, { olha: [1, 8], sobMezanino: true });
  s.por("val_c20_tablecounter", 7, 3, { sobMezanino: true });
  s.emCima(7, 3, "sunsetcafe_c20_coffeemachine");
  s.emCima(8, 3, "ducket_c26_honeypot");
  s.por("val_c20_tablecounter", 11, 3, { sobMezanino: true });
  s.emCima(11, 3, "ducket_c26_charcuterie");
  s.figurante({ figura: FIGURAS.cozinheira, x: 5, y: 4, dir: 4 });
  s.figurante({ figura: FIGURAS.barista, x: 10, y: 4, dir: 4 });

  // Balcão da frente: caixa antiga, doces, pão, biscoitos e canecas.
  for (const x of [1, 3, 5, 7]) s.por("val_c20_tablecounter", x, 5);
  s.emCima(1, 5, "wildwest_till", { olha: [1, 9] });
  s.emCima(3, 5, "ktchn_c15_bread", { dir: 4 });
  s.emCima(4, 5, "xmas_c23_choccake");
  s.emCima(5, 5, "gift_c18_cookiejar");
  s.emCima(6, 5, "xmas_c24_mugs");
  s.emCima(7, 5, "dessertcafe_c17_creamrolls");
  s.emCima(8, 5, "xmas_c24_snacks1");
  s.emCima(2, 5, "dessertcafe_c17_teaplant");
  // Banquetas-barril do lado do cliente, viradas para o balcão.
  const banquetas = [5, 7].map((x) => s.assento("lodge_dark_barrelstool", x, 6, [x, 5]));
  s.figurante({ figura: FIGURAS.amigo.replace("ch-255-1323", "ch-210-66"), sentado: banquetas[1] });
  // Ponta do balcão: barril de café no cavalete e sacos de grãos.
  s.por("xmas12_barrel", 11, 5, { dir: 4 });
  s.por("jungle_c16_sacks", 12, 5);

  // Parede da esquerda do térreo: lousa do cardápio e prateleira de livros
  // sobre a bicicleta e a porta para o mezanino; capacho e cavalete de giz
  // na entrada; relógio de chão e árvore no cesto no canto.
  s.parede("esquerda", { de: 4, ate: 8, altura: 1.6 }, ["school_chalkboard"]);
  s.parede("esquerda", { de: 9, ate: 11, altura: 2.6 }, ["waasa_wall_shelf1"]);
  s.assento("antique_c21_pennyfarthing", 0, 8, [3, 8]);
  s.por("antique_c21_doorteleport", 0, 9, { dir: 2 });
  s.por("doormat_plain", 1, 9);
  s.por("attic15_clock", 0, 11, { dir: 2 });
  s.por("paris_c15_menu", 2, 11, { dir: 2 });

  // --- Salão ---
  s.mesa({ x: 3, y: 7, tampo: "paris_c15_table", cadeira: "paris_c15_chair", lados: ["esquerda", "direita", "frente"], tapete: "antique_c21_oldenrug", sobre: ["xmas_c24_plate", "classic2_drinkcup"],
    figurante: { lado: "esquerda", figura: FIGURAS.cliente } });
  s.mesa({ x: 8, y: 9, tampo: "rainyday_c20_woodentable", cadeira: "classic9_chair", lados: ["esquerda", "direita", "frente"], tapete: "antique_c21_oldenrug",
    sobre: ["gift_vase"] });
  const vela = s.mesa({ x: 11, y: 7, tampo: "paris_c15_table", cadeira: "steampunk_chair", lados: ["esquerda", "direita", "frente"], tapete: "antique_c21_oldenrug", sobre: ["rcandle"] });
  s.figurante({ figura: FIGURAS.amigo, sentado: vela.direita });
  s.figurante({ figura: FIGURAS.garcom, x: 9, y: 6, dir: 2 });
  // Lustres de ferro sobre a mesa do meio e o canto de estar (onde não
  // ficam na frente dos balcões).
  s.pendente("val_c20_lights", 8, 9);
  s.pendente("val_c20_lights", 13, 11);

  // Canto de estar (frente à direita): poltrona antiga e poltrona de chalé
  // em volta da mesa de centro com chá e abajur; plantas e árvore no cesto
  // no canto e na ponta do balcão de doces.
  s.tapete("antique_c21_oldenrug", 12, 10, 14, 11);
  s.por("mafia_c26_coffeetable_dark", 13, 10);
  s.emCima(13, 10, "antique_c21_teaset");
  s.assento("antique_c21_armchair", 12, 10, [13, 10]);
  s.assento("wintercabin_c19_cabinchair", 14, 10, [13, 10]);
  s.por("antique_c21_lamp", 15, 10);
  s.por("recycler_baskettree", 15, 7);
  s.por("classic9_plant", 9, 5);

  // Recanto da lareira (fundo à direita): lareira, tapete e duas poltronas
  // de frente para o fogo, abajur de pé e lustre de chalé.
  s.por("wintercabin_c19_fireplace", 14, 0, { dir: 4 });
  s.tapete("antique_c21_oldenrug", 14, 1, 15, 3);
  s.assento("antique_c21_armchair", 14, 2, [14, 0]);
  s.assento("wintercabin_c19_cabinchair", 15, 2, [15, 0]);
  s.por("lodge_dark_lamp", 14, 5);
  s.pendente("wintercabin_c19_antlerlight", 15, 2);

  return s.fechar();
}
