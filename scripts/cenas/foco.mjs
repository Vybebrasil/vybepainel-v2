// Foco: biblioteca de dois andares em madeira escura (plano do Paulo,
// 18/10/2026: "biblioteca com mezanino e escada"). Coleção Library do Habbo
// (classic9) com peças antigas para a leitura. Galeria de estantes no
// mezanino do fundo; embaixo, a mesa de estudo no eixo da porta, sob o lustre;
// estantes e lareira de leitura na parede da esquerda; balcão da
// bibliotecária perto da porta, à direita. Sala sem
// voz: silêncio para estudar. Montada por receitas e pelo motor.
import { novaCena } from "../escritorio-construcao.mjs";
import { estarLareira, recepcao } from "../escritorio-receitas.mjs";

const FIGURAS = {
  bibliotecaria: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  estudante: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  leitor: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
};

export default function foco() {
  const s = novaCena("foco");
  s.colecao({
    estante: "classic9_bookshelf", mesa: "classic9_table", cadeira: "classic9_chair", abajur: "classic9_light", balcao: "classic9_counter",
    lareira: "lodge_dark_fireplace", poltrona: "antique_c21_armchair", lustre: "darkelegant_c20_light", livros: "classic9_books", busto: "classic9_statue",
  }, {
    acentos: ["xmas_c16_woodtile", "classic9_floor1", "classic9_floor2", "lodge_dark_divider", "lodge_dark_cornerplinth", "xmas_c18_stagestairs",
      "antique_c21_books", "antique_c21_lamp", "steampunk_globe", "classic9_plant", "mafia_c26_window_dark", "mafia_c26_walllamp_dark",
      "steampunk_map", "uni_libraryshelf", "attic15_painting", "antique_c21_wallclock", "lodge_dark_candle", "doormat_plain"],
  });
  // Casca: cornija de madeira, como no Café e na Reunião.
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);
  // Térreo de pedra da biblioteca; a galeria de cima, de tábuas.
  s.piso("classic9_floor1", { x0: 0, y0: 0, x1: 12, y1: 12 });
  s.piso("classic9_floor1", { x0: 0, y0: 12, x1: 8, y1: 16 });

  // Mezanino de tábuas no fundo (y 0–4), guarda-corpo de madeira escura,
  // colunas de madeira empilhadas; vão em x 10–11 para a escada.
  s.mezanino({ x0: 0, y0: 0, x1: 12, y1: 5, altura: 3, piso: "classic9_floor2", guarda: "lodge_dark_divider", coluna: "lodge_dark_cornerplinth",
    colunas: [0, 6], lados: ["frente"], abertura: [10, 12] });
  s.escada("xmas_c18_stagestairs", 10, 9, [0, -1]);

  // --- Galeria de estantes no mezanino ---
  s.canto("galeria de estantes", { funcao: "procurar e ler os livros de cima", destaque: "classic9_bookshelf" });
  for (const x of [0, 2]) s.por("classic9_bookshelf", x, 0, { nivel: 1, dir: 2 });
  s.por("classic9_bookshelf", 0, 2, { nivel: 1, dir: 0 });
  // Janela alta entre as estantes, com arandelas, e relógio de parede.
  const arandela = { classe: "mafia_c26_walllamp_dark", altura: 1.6 };
  s.parede("fundo", { de: 5, ate: 9, nivel: 1, altura: 0.4 }, [arandela, "mafia_c26_window_dark", arandela]);
  s.por("antique_c21_wallclock", 10, 0, { nivel: 1, dir: 0 });
  const leitura = s.mesa({ nivel: 1, x: 3, y: 2, tampo: "classic9_table", cadeira: "classic9_chair", lados: ["direita"], sobre: ["antique_c21_lamp"] });
  s.emCima(4, 3, "antique_c21_books", { nivel: 1 });
  s.figurante({ figura: FIGURAS.leitor, sentado: leitura.direita });
  s.por("steampunk_globe", 8, 1, { nivel: 1 });
  s.por("classic9_statue", 11, 0, { nivel: 1 });

  // --- Mesa de estudo no eixo da porta, sob o lustre ---
  s.canto("mesa de estudo", { funcao: "estudar em silêncio", destaque: "classic9_table" });
  const fundoMesa = s.mesa({ x: 5, y: 6, tampo: "classic9_table", cadeira: "classic9_chair", lados: ["esquerda", "direita", "tras"], sobre: ["antique_c21_lamp"] });
  s.mesa({ x: 5, y: 8, tampo: "classic9_table", cadeira: "classic9_chair", lados: ["esquerda", "direita", "frente"], sobre: ["antique_c21_lamp"] });
  s.emCima(6, 7, "classic9_books");
  s.emCima(5, 9, "antique_c21_books");
  s.figurante({ figura: FIGURAS.estudante, sentado: fundoMesa.esquerda });
  s.pendente("darkelegant_c20_light", 6, 7);

  // --- Parede da esquerda: estantes e lareira de leitura ---
  s.canto("estantes da esquerda", { funcao: "guardar o acervo do térreo", destaque: "classic9_bookshelf" });
  s.por("classic9_bookshelf", 0, 6, { dir: 0 });
  s.por("classic9_bookshelf", 0, 8, { dir: 0 });
  estarLareira(s, { nome: "lareira de leitura", funcao: "ler perto do fogo", em: 11, parede: "esquerda", tapete: false, folga: 0 });
  s.parede("esquerda", { de: 13, ate: 16, altura: 1.6 }, [arandela, "attic15_painting"]);

  // --- Balcão da bibliotecária perto da porta, à direita, de frente para quem entra ---
  recepcao(s, { nome: "balcão da bibliotecária", funcao: "emprestar e devolver livros", x: 7, y: 12, pecas: 2, porta: [6, 15], atendente: FIGURAS.bibliotecaria,
    sobre: [[0, "classic9_books"], [1, "antique_c21_books"]] });

  // --- Entrada ---
  s.canto("entrada", { funcao: "chegar em silêncio", destaque: "doormat_plain" });
  s.por("doormat_plain", 5, 14);
  s.por("doormat_plain", 6, 14);
  s.por("classic9_plant", 4, 15);
  return s.fechar();
}
