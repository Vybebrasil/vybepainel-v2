// Sala de reunião: madeira escura e verde (referência aprovada pelo Paulo em
// 18/10/2026). Patamar do fundo com lareira, retratos, estantes e poltronas;
// mesa longa de mogno no salão, sobre tapete vermelho, sob lustres; apoio
// com bebidas e jardim vertical na parede da esquerda; canto de leitura à
// direita. Cada peça passa pelo motor (scripts/escritorio-construcao.mjs).
import { novaCena } from "../escritorio-construcao.mjs";
import { estarLareira, mesaReuniao } from "../escritorio-receitas.mjs";

const FIGURAS = {
  diretora: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  socio: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  cliente: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
};

export default function reuniao() {
  const s = novaCena("reuniao");
  // Coleção da sala: chalé escuro e executivo (madeira escura, couro verde).
  s.colecao({ lareira: "lodge_dark_fireplace", poltrona: "exe_chair", abajur: "lodge_dark_lamp", mesa: "army15_ltddesk", cadeira: "exe_chair2",
    lustre: "lodge_dark_chandelier", tela: "computer_flatscreen", sofa: "mafia_c26_sofa_dark", mesaCentro: "mafia_c26_coffeetable_dark", criado: "lodge_dark_endtable",
    tapete: "exe_rug", estante: "lodge_dark_bookcase", vela: "lodge_dark_candle" }, {
    // Acentos escolhidos para a sala: o que dá vida a cada canto.
    acentos: ["attic15_painting", "mafia_c26_walllamp_dark", "xmas11_cuckoo", "garden_r21_plantwall", "easter_c23_plantwall", "exe_globe",
      "bohogarden_c21_snakeplant", "classic9_plant", "mafia_c26_drinktray", "antique_c21_books", "room_cof15_cup2", "exe_c15_desktidy", "classic2_drinkcup",
      "mafia_c26_ledger", "exe_drinks_cabinet", "lodge_dark_minibar", "waasa_wall_shelf1", "lodge_dark_diningtable"] });
  // Casca: cornija de madeira no topo das paredes, como no Café.
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // Chão: tábuas claras no patamar (o degrau aparece), escuras no salão e
  // tapete vermelho em placas sob a mesa.
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 0, x1: 18, y1: 4 });
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 4, x1: 4, y1: 10, estado: 1 });
  s.piso("rainyday_c20_woodenfloor", { x0: 14, y0: 4, x1: 18, y1: 10, estado: 1 });
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 10, x1: 18, y1: 12, estado: 1 });
  s.piso("theatre_carpet", { x0: 4, y0: 4, x1: 14, y1: 10 });

  // --- Patamar do fundo ---
  // Lareira no meio da parede do patamar (receita: poltronas na frente,
  // uma de cada lado, abajures junto delas, quadros iguais dos dois lados).
  const arandela = { classe: "mafia_c26_walllamp_dark", estado: 1, altura: 1.9 };
  estarLareira(s, { x: 8, tapete: false, arte: [arandela, "attic15_painting", arandela] });

  s.canto("biblioteca do patamar", { funcao: "consultar livros e esperar a reunião", destaque: "lodge_dark_bookcase" });
  // Estantes nas pontas, jardim vertical ao lado delas, abajures, globo e
  // mesinha com vela (o patamar fica livre em volta da lareira).
  s.por("lodge_dark_bookcase", 0, 0, { dir: 0 });
  s.por("lodge_dark_bookcase", 16, 0, { dir: 0 });
  s.por("garden_r21_plantwall", 14, 0, { dir: 2 });
  s.parede("fundo", { de: 2, ate: 3.5, altura: 1.5 }, ["xmas11_cuckoo"]);
  s.por("exe_globe", 5, 2);
  s.por("lodge_dark_lamp", 15, 2);
  s.por("bohogarden_c21_snakeplant", 17, 2);

  // Escadinha de varanda na beira do tablado: uma peça só, que no desenho
  // sobe o nível inteiro (pisa-se nela a 0,5 e dali ao tablado).
  s.escada("hween_c20_porchstairs", 14, 4, [0, -1]);

  // --- Salão: mesa longa ---
  // Receita: tampos lado a lado, cadeiras dos dois lados e nas cabeceiras,
  // lustre no centro; computador virado para dois lugares; bandeja de
  // bebidas no meio e, na frente de cada lugar, xícara, papéis ou copo.
  const lugares = mesaReuniao(s, { x: 5, y: 6, telas: [2, 9], centro: [[8, 7, "mafia_c26_drinktray"], [5, 7, "antique_c21_books"]],
    porLugar: ["room_cof15_cup2", "exe_c15_desktidy", "classic2_drinkcup", "mafia_c26_ledger"] });
  s.figurante({ figura: FIGURAS.diretora, sentado: lugares[4].cad });
  s.figurante({ figura: FIGURAS.socio, sentado: lugares[7].cad });
  s.figurante({ figura: FIGURAS.cliente, sentado: lugares[9].cad });

  // --- Parede da esquerda: apoio de bebidas e conversa a dois ---
  s.canto("apoio de bebidas", { funcao: "servir bebida e conversar a dois", destaque: "exe_drinks_cabinet" });
  s.por("exe_drinks_cabinet", 0, 7, { dir: 2 });
  s.por("lodge_dark_minibar", 0, 5, { dir: 2 });
  s.parede("esquerda", { de: 4, ate: 7, altura: 1.8 }, [{ classe: "mafia_c26_walllamp_dark", estado: 1 }, "attic15_painting"]);
  // Prateleira de livros no alto do patamar.
  s.parede("esquerda", { de: 1, ate: 3, altura: 2.4 }, ["waasa_wall_shelf1"]);
  s.parede("esquerda", { de: 9, ate: 10, altura: 1.9 }, [{ classe: "mafia_c26_walllamp_dark", estado: 1 }]);
  s.por("easter_c23_plantwall", 0, 10, { dir: 0 });
  s.por("classic9_plant", 0, 3);
  // Mesa redonda menor na frente à esquerda, com vela e dois copos.
  s.mesa({ x: 1, y: 9, tampo: "lodge_dark_diningtable", cadeira: "exe_chair2", lados: ["direita", "tras"], sobre: ["lodge_dark_candle"] });
  s.emCima(2, 10, "classic2_drinkcup");
  s.emCima(1, 10, "room_cof15_cup2");

  // --- Direita: estar de leitura no esquadro, longe do pé da escadinha ---
  s.canto("estar de leitura", { funcao: "ler e esperar fora da mesa", destaque: "mafia_c26_sofa_dark" });
  const leitura = s.estar({ x: 14, y: 8, sofa: "mafia_c26_sofa_dark", mesa: "mafia_c26_coffeetable_dark", poltrona: "exe_chair", poltronas: ["depois"],
    criado: "lodge_dark_endtable", criados: ["depois"], tapete: "exe_rug", sobreMesa: ["antique_c21_books"], sobreCriado: { depois: "lodge_dark_candle" } });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura.sofa });

  // --- Entrada: plantas dos dois lados da porta ---
  s.canto("entrada", { funcao: "marcar a porta", destaque: "bohogarden_c21_snakeplant" });
  s.por("bohogarden_c21_snakeplant", 7, 11);
  s.por("bohogarden_c21_snakeplant", 10, 11);

  return s.fechar();
}
