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

  // Chão: tábuas claras no patamar (o degrau aparece), escuras no salão e
  // tapete vermelho em placas sob a mesa.
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 0, x1: 18, y1: 4 });
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 4, x1: 4, y1: 10, estado: 1 });
  s.piso("rainyday_c20_woodenfloor", { x0: 14, y0: 4, x1: 18, y1: 10, estado: 1 });
  s.piso("rainyday_c20_woodenfloor", { x0: 0, y0: 10, x1: 18, y1: 12, estado: 1 });
  s.piso("theatre_carpet", { x0: 4, y0: 4, x1: 14, y1: 10 });

  // --- Patamar do fundo ---
  // Lareira no meio, poltronas de frente para o fogo, mesinha com vela.
  s.por("lodge_dark_fireplace", 8, 0, { dir: 0 });
  s.assento("exe_chair", 7, 0, [8, 0]);
  s.assento("exe_chair", 10, 0, [9, 0]);
  s.por("lodge_dark_endtable", 12, 2);
  s.emCima(12, 2, "lodge_dark_candle");
  // Estantes nas pontas, retratos e jardim vertical entre elas.
  s.por("lodge_dark_bookcase", 0, 0, { dir: 0 });
  s.por("lodge_dark_bookcase", 16, 0, { dir: 0 });
  s.por("garden_r21_plantwall", 3, 0, { dir: 2 });
  s.por("garden_r21_plantwall", 13, 0, { dir: 2 });
  // Quadros clássicos dos dois lados da lareira e hera pendendo da parede.
  s.parede("fundo", { de: 5, ate: 8, altura: 1.2 }, ["attic15_painting"]);
  s.parede("fundo", { de: 10, ate: 13, altura: 1.2 }, ["attic15_painting"]);
  // Estar do patamar: sofá de couro de frente para o salão, abajures.
  s.assento("exe_sofa", 5, 2, [6, 6]);
  s.por("lodge_dark_lamp", 4, 2);
  s.por("lodge_dark_lamp", 13, 2);
  s.assento("exe_chair", 11, 2, [12, 2]);

  // --- Salão: mesa longa ---
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
  s.pendente("exe_light", 6, 6);

  // --- Parede da esquerda: apoio e jardim ---
  s.por("exe_drinks_cabinet", 0, 7, { dir: 2 });
  s.por("lodge_dark_minibar", 0, 5, { dir: 2 });
  s.por("easter_c23_plantwall", 0, 10, { dir: 0 });

  // --- Direita: canto de leitura e globo ---
  s.tapete("darkelegant_c20_carpet", 14, 6, 16, 7);
  const leitura = s.assento("exe_chair", 15, 6, [16, 6]);
  s.por("lodge_dark_endtable", 16, 6);
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura });
  s.por("exe_globe", 16, 9);
  s.por("bohogarden_c21_cheeseplant", 14, 10);
  s.por("bohogarden_c21_snakeplant", 3, 10);
  s.por("bohogarden_c21_snakeplant", 17, 3);
  s.por("classic9_plant", 0, 3);

  return s.fechar();
}
