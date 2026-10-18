// Sala de reunião: madeira escura e verde (referência aprovada pelo Paulo em
// 18/10/2026). Patamar do fundo com lareira, retratos, estantes e poltronas;
// mesa longa de mogno no salão, sobre tapete vermelho, sob lustres; apoio
// com bebidas e jardim vertical na parede da esquerda; canto de leitura à
// direita. Cada peça passa pelo motor (scripts/escritorio-construcao.mjs).
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  diretora: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  socio: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  cliente: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
};

export default function reuniao() {
  const s = novaCena("reuniao");
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
  s.canto("lareira", { funcao: "conversa informal perto do fogo", destaque: "lodge_dark_fireplace" });
  // Lareira no meio da parede, duas poltronas na frente dela, uma de cada
  // lado, viradas para o fogo; quadros, arandelas e relógio cuco dos dois lados.
  s.por("lodge_dark_fireplace", 8, 0, { dir: 0 });
  s.assento("exe_chair", 7, 1, [8, 0]);
  s.assento("exe_chair", 10, 1, [9, 0]);
  const arandela = { classe: "mafia_c26_walllamp_dark", estado: 1, altura: 1.9 };
  s.parede("fundo", { de: 5, ate: 8, altura: 1.2 }, [arandela, "attic15_painting", arandela]);
  s.parede("fundo", { de: 10, ate: 13, altura: 1.2 }, ["attic15_painting", { classe: "xmas11_cuckoo", altura: 1.5 }]);

  s.canto("biblioteca do patamar", { funcao: "consultar livros e esperar a reunião", destaque: "lodge_dark_bookcase" });
  // Estantes nas pontas, jardim vertical ao lado delas, abajures, globo e
  // mesinha com vela (o patamar fica livre em volta da lareira).
  s.por("lodge_dark_bookcase", 0, 0, { dir: 0 });
  s.por("lodge_dark_bookcase", 16, 0, { dir: 0 });
  s.por("garden_r21_plantwall", 3, 0, { dir: 2 });
  s.por("garden_r21_plantwall", 13, 0, { dir: 2 });
  s.parede("fundo", { de: 14, ate: 16, altura: 1.8 }, [{ classe: "mafia_c26_walllamp_dark", estado: 1 }]);
  s.parede("fundo", { de: 2, ate: 3, altura: 1.8 }, [{ classe: "mafia_c26_walllamp_dark", estado: 1 }]);
  s.por("lodge_dark_lamp", 4, 2);
  s.por("lodge_dark_lamp", 13, 2);
  s.por("exe_globe", 5, 2);
  s.por("lodge_dark_endtable", 12, 2);
  s.emCima(12, 2, "lodge_dark_candle");
  s.por("lodge_dark_lamp", 15, 2);
  s.por("bohogarden_c21_snakeplant", 17, 2);

  // Escadinha de varanda na beira do tablado: uma peça só, que no desenho
  // sobe o nível inteiro (pisa-se nela a 0,5 e dali ao tablado).
  s.escada("hween_c20_porchstairs", 14, 4, [0, -1]);

  // --- Salão: mesa longa ---
  s.canto("mesa de reunião", { funcao: "reunir a equipe com cliente", destaque: "army15_ltddesk" });
  for (const x of [5, 8]) s.por("army15_ltddesk", x, 6);
  const lados = [];
  for (const x of [5, 6, 7, 8, 9, 10]) {
    lados.push(s.assento("exe_chair2", x, 5, [x, 6]));
    lados.push(s.assento("exe_chair2", x, 8, [x, 7]));
  }
  s.assento("exe_chair2", 4, 6, [5, 6]);
  s.assento("exe_chair2", 11, 7, [10, 7]);
  s.figurante({ figura: FIGURAS.diretora, sentado: lados[2] });
  s.figurante({ figura: FIGURAS.socio, sentado: lados[7] });
  s.figurante({ figura: FIGURAS.cliente, sentado: lados[9] });
  s.pendente("lodge_dark_chandelier", 7, 6);
  // Na mesa, o que uma reunião usa: computadores, papéis, livros-caixa,
  // bandeja de bebidas e a xícara ou o copo de quem está sentado.
  // Os computadores olham para quem está sentado do lado deles da mesa.
  s.emCima(6, 6, "computer_flatscreen", { olha: [6, 5] });
  s.emCima(9, 7, "computer_flatscreen", { olha: [9, 8] });
  for (const [x, y, c] of [[5, 6, "exe_c15_desktidy"], [6, 7, "mafia_c26_ledger"],
    [8, 7, "mafia_c26_drinktray"], [10, 6, "exe_c15_desktidy"], [5, 7, "antique_c21_books"], [7, 7, "room_cof15_cup2"], [9, 6, "room_cof15_cup2"], [10, 7, "classic2_drinkcup"]]) s.emCima(x, y, c);

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
