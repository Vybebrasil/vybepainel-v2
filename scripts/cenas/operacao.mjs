// Centro de Operação (pedido do Paulo, 19/10/2026): a sala principal. Os
// agentes de conteúdo, um por cliente, trabalham nas mesas com o nome do
// cliente (o navegador ocupa os postos; docs/planejamentos-plano.md) e, desde
// a revisão de 19/10 (noite), o time também trabalha aqui: "precisa de espaço
// para quando o time quiser ficar aqui trabalhando".
// Conceito: sala de controle da agência, em três áreas lidas da porta.
//   fundo:    o telão com os monitores, de frente para todos;
//   alas:     os agentes em duas alas pela carteira do cliente (20/10/2026):
//             Vinícius à esquerda (2 × 5), Ewerton à direita (2 × 3), com o
//             corredor no meio e o nome da ala no chão da frente;
//   frente:   as mesas do time no meio (quem chega senta), a mesa de aprovação
//             (o head revisa) à esquerda e a espera com sofá à direita.
// O corredor sai da porta, passa entre as mesas do time e sobe entre as alas.
// Mesma coleção da ilha de edição da Produção.
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
      "exe_globe", "exe_map", "room_cof15_planter", "classic9_plant", "modern_c17_display",
      // As duas alas: cada carteira com piso, parede, divisória, mesa e cadeira próprias.
      "ducket_c25_warmfloor", "darkmodern_c20_floor", "hygge_c25_wallpaper2", "darkmodern_c20_glassblockwall",
      "darkmodern_c20_desk", "hween_c20_secretbkshelf"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Duas alas, dois ambientes (Paulo, 20/10/2026: "precisa dividir
  // visualmente melhor... ambientes diferentes") ---
  // Vinícius (laranja): parquet quente, parede de ladrilho terracota e mesas
  // de vidro com madeira. Ewerton (azul): piso escuro, parede de ladrilho
  // azul-acinzentado, mesas escuras e as colunas de servidor no fundo. Entre
  // as duas, uma parede de blocos de vidro azul acesos (com canteiro na frente,
  // os blocos tapavam o canteiro). A frente continua comum a todos.
  s.piso("ducket_c25_warmfloor", { x0: 0, y0: 0, x1: 16, y1: 10 });
  s.piso("darkmodern_c20_floor", { x0: 16, y0: 0, x1: 26, y1: 10 });
  s.revestir("fundo", { de: 0, ate: 16, classe: "hygge_c25_wallpaper2", estado: 2 });
  s.revestir("fundo", { de: 16, ate: 26, classe: "hygge_c25_wallpaper2", estado: 0 });
  s.revestir("esquerda", { de: 0, ate: 10, classe: "hygge_c25_wallpaper2", estado: 2 });
  s.canto("divisa das alas", { funcao: "separar a carteira do Vinícius da do Ewerton, cada lado com a sua cara", destaque: "darkmodern_c20_glassblockwall" });
  for (const y of [1, 3, 5, 7]) {
    s.por("darkmodern_c20_glassblockwall", 16, y, { dir: 2 });
  }

  // --- Telão: no fundo de cada ala ---
  s.canto("telão", { funcao: "acompanhar a operação dos clientes de cada carteira", destaque: "army15_largescreen" });
  s.parede("fundo", { de: 0, ate: 15, altura: 2.2 }, ["pixel_clock_black", "army15_largescreen", "steampunk_map", "army15_largescreen"]);

  // --- Estações dos agentes, em duas alas pela carteira do cliente ---
  // Paulo, 20/10/2026 ("tá um emboleiro... vamos começar dividindo os clientes
  // de Ewerton e de Vinícius"): Vinícius à esquerda (duas fileiras de cinco),
  // Ewerton à direita (duas de três), com o corredor entre as alas. A ala é do
  // posto; o navegador põe cada agente na ala da carteira do cliente
  // (carteiraDoCliente) e quem sobra ou não tem carteira vai para um posto livre.
  // Mesas a três ladrilhos uma da outra: a dois, as etiquetas se encostavam.
  // Cada mesa tem a tela virada para a cadeira; o posto é o número do lugar.
  // Telas e acessórios variam de mesa em mesa, como numa sala de verdade.
  const TELAS = ["computer_flatscreen", "computer_laptop", "computer_old", "uni_laptop"];
  // Só peças baixas ao lado da tela: luminária na mesa tapava o rosto de quem
  // está sentado (Paulo, 19/10/2026); a luz vem dos pendentes e das colunas.
  const AO_LADO = ["exe_c15_telephone", "exe_c15_desktidy", "modern_c17_folder", "room_cof15_cup2"];
  let posto = 0;
  for (const [ala, colunas, mesa, cadeira] of [["vinicius", [1, 4, 7, 10, 13], "modern_c17_desk", "modern_c17_chair"], ["ewerton", [17, 20, 23], "darkmodern_c20_desk", "modern_c17_chair"]]) {
    s.canto(`ala ${ala}`, { funcao: `os agentes dos clientes da carteira ${ala === "vinicius" ? "do Vinícius" : "do Ewerton"}`, destaque: mesa });
    for (const y of [3, 8]) {
      for (const x of colunas) {
        // Agente atrás da mesa, de frente para quem entra (a fantasia do
        // cliente aparece); a tela vira para ele.
        s.por(mesa, x, y, { dir: 2 });
        const cad = s.assento(cadeira, x, y - 1, [x, y]);
        s.emCima(x, y, TELAS[posto % 4], { olha: [x, y - 1] });
        s.emCima(x + 1, y, AO_LADO[(posto + Math.floor(posto / 4)) % 4]);
        s.figurante({ figura: AGENTES[posto % AGENTES.length], sentado: cad, posto, ala });
        // Luz de chão ao lado da cadeira, na fileira do fundo: ilumina sem ficar
        // entre a câmera e o rosto.
        if (y === 3) s.por("modern_c17_floorlamp", x + 1, y - 1);
        posto++;
      }
    }
  }

  // --- Mesas do time: na frente, no meio (Paulo, 20/10/2026) ---
  // Mesmo móvel dos agentes, sem figurante: quem chega senta, perto das duas
  // alas. O corredor da porta passa entre os dois grupos.
  s.canto("mesas do time", { funcao: "o time trabalha no Centro de Operação quando quiser", destaque: "modern_c17_desk" });
  let livre = 0;
  for (const x of [6, 8, 10, 14, 16, 18]) {
    s.por("modern_c17_desk", x, 13, { dir: 2 });
    s.assento("modern_c17_chair", x, 12, [x, 13]);
    s.emCima(x, 13, livre % 2 ? "computer_laptop" : "computer_flatscreen", { olha: [x, 12] });
    s.emCima(x + 1, 13, livre % 2 ? "modern_c17_folder" : "exe_c15_desktidy");
    s.por("modern_c17_floorlamp", x + 1, 12);
    livre++;
  }
  // Parede de servidores no fundo do time: colunas de vidro azul acesas e a estante.
  s.canto("servidores", { funcao: "o lado técnico da operação, aceso no fundo", destaque: "army_c15_glasscrn" });
  s.por("army_c15_glasscrn", 20, 0);
  s.por("hc26_7", 22, 0);
  s.por("army_c15_glasscrn", 25, 0);
  // Pendentes só na frente das fileiras: atrás, tapavam quem está sentado.
  for (const [x, y] of [[4, 11], [10, 11], [16, 11], [22, 11]]) s.pendente("army_c15_light", x, y, { dir: 2, altura: 1.2 });

  s.parede("esquerda", { de: 1, ate: 10, altura: 2.2 }, ["army15_largescreen", "pixel_clock_red", "waasa_wall_shelf1"]);
  // Acima da mesa de aprovação: o mapa dos clientes e o relógio.
  s.parede("esquerda", { de: 12, ate: 18, altura: 2.2 }, ["pixel_clock_black", "waasa_wall_shelf1", "pixel_clock_red"]);

  // --- Mesa de aprovação: o head revisa o planejamento do cliente ---
  s.canto("mesa de aprovação", { funcao: "o head revisa e manda o planejamento para o cliente", destaque: "army_c15_contable" });
  s.mesa({ x: 3, y: 14, tampo: "army_c15_contable", cadeira: "army_c15_leatherchr", lados: ["esquerda", "direita", "frente"], sobre: ["modern_c17_reads"] });
  s.emCima(4, 14, "room_cof15_cup2");
  // A estante do canto é secreta (Paulo, 27/10/2026): quem administra puxa o
  // livro torto e desce para o subsolo (vybe-escritorio-subsolo.js). Para o
  // resto do time é só uma estante.
  s.por("hween_c20_secretbkshelf", 0, 10, { dir: 2 });
  s.por("exe_globe", 6, 16);
  s.por("modern_c17_floorlamp", 8, 16);
  s.por("army_c15_plant", 0, 17);

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
