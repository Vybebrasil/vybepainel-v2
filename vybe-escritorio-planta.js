// Planta do escritório: um mapa só, com a divisão que a equipe usava no
// SoWork. Doze salas individuais iguais (7×7), nove com dono e três livres,
// em duas fileiras com corredores de 3 ladrilhos; em volta, os espaços gerais
// e a área externa com piscina.
// Unidade: ladrilho do Habbo (64×32 px). x desce para a direita na tela, y
// desce para a esquerda. Direções do Habbo: 0 olha para −y, 2 para +x,
// 4 para +y, 6 para −x; medidas valem em 0/4 e giram em 2/6.
// Cada ambiente pertence a uma sala de conversa do servidor.
// Quem é dono de cada sala vem do servidor (base.salas); aqui só a geometria.
const ESCRITORIO_SALA_LADO = 10;
const ESCRITORIO_PLANTA = (() => {
  const W = 80, H = 58;
  const PREDIO = { x0: 0, y0: 0, x1: 72, y1: 47 };
  const PISO = {
    madeira: ["#6b4a33", "#62432e"], clara: ["#9c7550", "#916b48"], concreto: ["#3d3f46", "#383a40"],
    carpete: ["#2c3444", "#27303e"], preto: ["#1b1b20", "#17171b"], cafe: ["#c9c4bd", "#bdb8b1"],
    verde: ["#23493a", "#1f4134"], corredor: ["#2b2b31", "#27272c"], academia: ["#222227", "#1e1e22"],
    grama: ["#3f7d3a", "#3a7335"], deck: ["#8a5f3c", "#7f5736"], praca: ["#2a2930", "#26252b"],
    // Pisos das salas individuais (madeiras e tons próximos, cada um diferente).
    sala0: ["#7a4f3a", "#704836"], sala1: ["#5e4636", "#564031"], sala2: ["#3f4a5c", "#394354"], sala3: ["#6b5a3e", "#625238"],
    sala4: ["#6a4555", "#613f4e"], sala5: ["#4a5a48", "#435242"], sala6: ["#5a4a6a", "#524361"], sala7: ["#7a5a3a", "#705235"],
    sala8: ["#45545e", "#3f4d56"], sala9: ["#665040", "#5d493a"], sala10: ["#5b5040", "#53493a"], sala11: ["#4f4a5a", "#484352"],
  };
  // Cor do letreiro em neon de cada sala.
  const CORES_SALAS = ["#ff8a35", "#ffb347", "#5aa9ff", "#ffd166", "#ff6fa8", "#7ee08a", "#b48cff", "#ff9a5a", "#5ad1e6", "#e8a87c", "#d6c27a", "#a7a3ff"];
  const L = ESCRITORIO_SALA_LADO;
  const ambientes = [];
  const ambiente = (id, nome, sala, x0, y0, x1, y1, piso, extra = {}) =>
    ambientes.push({ id, nome, sala, x0, y0, x1, y1, piso, ...extra });
  // Fundo (y 0–9)
  ambiente("auditorio", "Auditório", "reuniao", 0, 0, 18, 9, "madeira");
  ambiente("reuniao", "Sala de reunião", "reuniao", 18, 0, 30, 9, "carpete");
  ambiente("recepcao", "Recepção", "convivencia", 30, 0, 42, 9, "preto");
  ambiente("cafe", "Cozinha", "convivencia", 42, 0, 54, 9, "cafe");
  ambiente("academia", "Academia", "convivencia", 54, 0, 72, 9, "academia");
  // Salas individuais 10×10: fileira de cima (porta para baixo) e de baixo (porta para cima)
  Array.from({ length: 12 }, (_, i) => i).forEach((i) => {
    // Três salas, a passagem do meio (x 30–34) e mais três.
    const linha = i < 6 ? 0 : 1, col = i % 6, y0 = linha ? 25 : 12, x0 = col < 3 ? col * L : 34 + (col - 3) * L;
    // Cada sala com piso e cor de letreiro próprios (identidade do dono).
    ambiente("sala-" + i, "Sala livre", "criacao", x0, y0, x0 + L, y0 + L,
      "sala" + i, { pessoal: true, porta: linha ? "cima" : "baixo", cor: CORES_SALAS[i] });
  });
  ambiente("foco", "Foco", "foco", 64, 12, 72, 22, "carpete");
  ambiente("jogos", "Jogos", "convivencia", 64, 25, 72, 35, "verde");
  // Frente (y 38–47)
  ambiente("producao", "Produção", "producao", 0, 38, 26, 47, "concreto");
  ambiente("lounge", "Lounge", "convivencia", 26, 38, 72, 47, "madeira");

  // Divisórias sobre as arestas [x0,y0,x1,y1]; portas são vãos de 2 ladrilhos.
  const divisorias = [];
  for (const a of ambientes) if (a.x0 > 0) divisorias.push([a.x0, a.y0, a.x0, a.y1]);
  // Lado direito das salas que dão para a passagem do meio.
  for (const a of ambientes) if (a.pessoal && a.x1 === 30) divisorias.push([30, a.y0, 30, a.y1]);
  const comPorta = (y, lista, fechada) => {
    for (const a of lista) {
      if (fechada) { divisorias.push([a.x0, y, a.x1, y]); continue; }
      const meio = Math.floor((a.x0 + a.x1) / 2);
      if (meio - 1 > a.x0) divisorias.push([a.x0, y, meio - 1, y]);
      if (a.x1 > meio + 1) divisorias.push([meio + 1, y, a.x1, y]);
    }
  };
  const fileira = (y0) => ambientes.filter((a) => a.y0 === y0);
  comPorta(9, fileira(0));
  // Salas: porta só para o corredor do meio; o outro lado é parede.
  comPorta(12, fileira(12).filter((a) => a.pessoal), true); comPorta(12, fileira(12).filter((a) => !a.pessoal));
  comPorta(22, fileira(12));
  comPorta(25, fileira(25));
  comPorta(35, fileira(25).filter((a) => a.pessoal), true); comPorta(35, fileira(25).filter((a) => !a.pessoal));
  comPorta(38, fileira(38));
  // Produção: o estúdio de gravação (x 0–10) fica separado das ilhas de edição
  // por uma divisória, com a passagem na frente.
  divisorias.push([10, 38, 10, 44]);

  // Móveis: [classe, x, y, direção, estado, altura (em cima de mesa)]
  const m = [];
  const p = (classe, x, y, dir = 2, estado = 0, altura = 0) => m.push([classe, x, y, dir, estado, altura]);
  // Auditório: telão na parede, púlpito sobre o tapete, refletores e plantas,
  // plateia olhando para o telão
  // Telão de projeção encostado na parede (o painel fino de parede ficava um
  // ladrilho para fora e torto), púlpito ao lado sobre o tapete.
  p("uni_projector", 0, 3, 2); p("js_exe_rug", 1, 6, 0); p("uni_lectern", 2, 7, 2);
  p("spotlight", 1, 1, 2); p("spotlight", 1, 8, 2);
  p("bohogarden_c21_cheeseplant", 4, 0, 2);
  for (let f = 0; f < 6; f++) for (let c = 0; c < 5; c++) p("hc26_10", 6 + f * 2, 2 + c, 6);
  p("easter_c22_fanpalm", 17, 0); p("easter_c22_fanpalm", 17, 8); p("darkmodern_c20_speakers", 0, 1, 2); p("darkmodern_c20_speakers", 0, 7, 2);
  // Reunião: mesa comprida no meio, cadeiras dos dois lados, quadro e arquivos
  p("army_c15_contable2", 20, 4, 0); for (const x of [21, 23, 25]) p("army_c15_contable", x, 4, 0); p("army_c15_contable2", 27, 4, 0);
  for (let x = 20; x <= 27; x++) { p("army_c15_leatherchr", x, 3, 4); p("army_c15_leatherchr", x, 5, 0); }
  p("uni_c23_whiteboard", 29, 3, 2); p("plant_yukka", 18, 0, 0); p("plant_yukka", 29, 8, 0);
  p("army_c15_cabinet", 20, 0, 4); p("army_c15_cabinet", 21, 0, 4); p("army_c15_cabinet", 22, 0, 4);
  // Recepção: balcão de atendimento de frente para a porta, com a cadeira da
  // recepção atrás; área de espera com dois sofás frente a frente sobre o
  // tapete; plantas e estante nos cantos. O corredor da porta fica livre.
  for (const x of [34, 37]) p("hygge_c25_counter2", x, 2, 0);
  p("modern_c17_chair", 35, 1, 4); p("hygge_c25_desklamp", 34, 2, 2, 1, 1.2);
  p("hygge_c25_carpet", 31, 4, 0); p("modern_c17_sofa", 31, 4, 4); p("modern_c17_lowtable", 31, 5, 2); p("modern_c17_sofa", 31, 7, 0);
  p("modern_c17_floorlamp", 33, 7, 2, 1);
  p("modern_c17_shelf", 41, 4, 0); p("mafia_c26_planter_white", 30, 0, 0); p("mafia_c26_planter_white", 41, 0, 0);
  p("mafia_c26_planter_dark", 39, 8, 0); p("darkmodern_c20_pug", 40, 6, 2);
  // Cozinha: geladeiras, bancada com fogão e pia na parede do fundo, café e
  // micro-ondas em cima da bancada, bebedouro e duas mesas de almoço
  p("mode_fridge", 42, 0, 0); p("hygge_c25_counter1", 43, 0, 0); p("hygge_c25_counter1", 44, 0, 0);
  p("hygge_c25_stove", 45, 0, 0); p("hygge_c25_counter1", 46, 0, 0); p("hygge_c25_kitchensink", 47, 0, 4);
  p("hygge_c25_counter1", 48, 0, 0); p("hygge_c25_counter1", 49, 0, 0); p("purablk_c16_fridge", 50, 0, 4);
  p("ktchn_c15_cupboard", 51, 0, 4); p("ktchn_c15_cupboard", 52, 0, 4); p("matic_water_dispenser", 53, 0, 4);
  p("sunsetcafe_c20_coffeemachine", 43, 0, 2, 1, 1.2); p("hygge_c25_microwave", 44, 0, 2, 0, 1.2);
  for (const x of [44, 50]) {
    p("hc25_12", x, 4, 0);
    for (const dx of [0, 1]) { p("hc26_10", x + dx, 3, 4); p("hc26_10", x + dx, 5, 0); }
  }
  p("school_c22_cafe", 43, 7, 0); p("school_c22_cafe", 51, 7, 0);
  // Academia: esteiras e bicicletas no fundo, pesos na parede, camas elásticas
  for (let i = 0; i < 4; i++) p("olympics_c16_treadmill", 56 + i * 2, 1, 4);
  p("paris15_bicycle", 65, 1, 4); p("paris15_bicycle", 67, 1, 4); p("matic_water_dispenser", 70, 0, 4);
  p("olympics_c16_weightrack", 54, 4, 2); p("olympics_c16_weightrack", 54, 6, 2);
  p("uni_dumbells", 56, 4, 2); p("uni_dumbells", 56, 6, 2);
  p("olympics_c16_trampoline", 69, 4, 2); p("olympics_c16_trampoline", 69, 6, 2); p("army_c15_plant", 71, 8);
  p("bohogarden_c21_snakeplant", 54, 8, 2); p("modern_c17_floorlamp", 66, 8, 2, 1);
  // Foco: biblioteca silenciosa. Estantes baixas na parede da esquerda (as
  // altas passavam por cima da divisória), duas mesas de estudo com luminária
  // e cadeiras dos dois lados, pufes no canto e as portas livres.
  for (const y of [13, 15, 17, 19]) p("purablk_c16_shelve", 64, y, 2);
  for (const y of [14, 18]) {
    p("classic9_table", 67, y, 0); p("classic9_light", 67, y, 2, 1, 0.7);
    for (const dy of [0, 1]) { p("classic9_chair", 66, y + dy, 2); p("classic9_chair", 69, y + dy, 6); }
  }
  p("cubie_beanbag_b", 70, 13, 6); p("cubie_beanbag_p", 70, 16, 6);
  p("modern_c17_floorlamp", 71, 19, 2, 1); p("theatre_plant", 64, 21, 2); p("army_c15_plant", 71, 21);
  // Jogos: fliperamas e pinball na parede do fundo, jukebox e videogame na
  // parede da esquerda (com a poltrona de quem joga), sinuca e pebolim no
  // meio, simuladores de corrida na parede da direita; portas livres.
  // As máquinas altas ficam na parede do corredor, não na divisória com a sala
  // ao lado (por cima dela pareciam estar dentro da outra sala).
  for (const [c, x] of [["tokyo_c18_retroarcade", 64], ["arcade_c23_space", 65], ["arcade_c23_cyberpunk", 71]]) p(c, x, 25, 4, 1);
  p("graffiti_r24_arcademachine", 66, 25, 0, 1); p("arcade_c23_pinball", 69, 25, 0, 1);
  p("vwave_r21_jukebox", 64, 28, 2, 1);
  p("rainyday_c20_retrogames", 64, 31, 2, 1); p("mafia_c26_armchair_dark", 66, 31, 6);
  p("bling15_pooltable", 67, 28, 4); p("ads_aftv_footballtable", 69, 32, 0);
  p("tokyo_c18_racearcade", 71, 28, 6, 1); p("tokyo_c18_racearcade", 71, 29, 6, 1);
  p("theatre_plant", 64, 34, 2); p("army_c15_plant", 71, 34);
  // Produção, estúdio (x 0–9): set de entrevista com duas poltronas sobre a
  // luz de piso, refletores apontados para ele, câmera de grua virada para o
  // set e a mesa de som com a cadeira do operador.
  p("studio_floorlight", 1, 38, 0, 1);
  p("mafia_c26_armchair_white", 1, 40, 2); p("hc26_3", 2, 40, 2); p("mafia_c26_armchair_white", 4, 40, 6);
  p("bohogarden_c21_cheeseplant", 0, 38, 2); p("spotlight", 6, 39, 6); p("spotlight", 0, 43, 0);
  p("studio_camera", 3, 43, 0, 1);
  p("studio_mixingdesk", 1, 45, 0, 1); p("studio_chair", 3, 44, 4);
  p("army_c15_cabinet", 8, 38, 4); p("army_c15_cabinet", 9, 38, 4);
  // Produção, edição (x 10–26): estações com dois monitores na parede do
  // fundo e na divisória do estúdio, cada cadeira de frente para a tela; no
  // meio, a mesa de revisão com cadeiras em volta.
  for (const x of [15, 18, 21, 24]) { p("hc_exe_wrkdesk", x, 38, 4); p("army_c15_leatherchr", x, 39, 0); }
  for (const y of [40, 42]) { p("hc_exe_wrkdesk", 10, y, 2); p("army_c15_leatherchr", 11, y, 6); }
  p("hc_exe_table", 16, 42, 0);
  for (const x of [16, 17, 18]) p("modern_c17_chair", x, 44, 0);
  p("modern_c17_chair", 15, 42, 2); p("modern_c17_chair", 19, 43, 6);
  p("matic_water_dispenser", 25, 41, 4); p("exe_c15_printer", 25, 43, 2);
  p("easter_c22_fanpalm", 25, 46); p("bohogarden_c21_snakeplant", 21, 46, 2);
  // Lounge, em quatro ambientes da esquerda para a direita:
  // lareira (sofá e poltronas virados para o fogo, mesinha no meio, tapete),
  // telão (dois sofás em fila virados para a tela), pista do DJ e bar.
  p("lodge_dark_fireplace", 31, 38, 0, 1); p("hygge_c25_carpet", 30, 40, 0);
  p("darkmodern_c20_lowtable", 30, 42, 2); p("mafia_c26_sofa_dark", 30, 44, 0);
  p("mafia_c26_armchair_dark", 28, 42, 2); p("mafia_c26_armchair_dark", 34, 42, 6);
  p("theatre_plant", 28, 38, 2); p("theatre_plant", 35, 38, 2); p("modern_c17_floorlamp", 27, 45, 2, 1);
  p("uni_projector", 41, 38, 4); p("js_exe_rug", 41, 42, 0);
  p("hc23_6", 41, 43, 0); p("hc23_6", 41, 45, 0);
  p("modern_c17_floorlamp", 39, 38, 2, 1); p("modern_c17_floorlamp", 45, 38, 2, 1);
  p("hc25_6", 52, 38, 0, 1); p("disco_c26_jukebox", 54, 38, 0, 1);
  p("darkmodern_c20_rug", 52, 40, 0); p("spotlight", 51, 39, 2); p("spotlight", 57, 39, 6);
  p("lodge_dark_bardesk", 65, 40, 0); p("lodge_dark_minibar", 68, 38, 4, 1); p("army_c15_cabinet", 69, 38, 4); p("lodge_dark_minibar", 70, 38, 4, 1);
  for (const y of [40, 41, 42]) p("vwave_c21_barstool", 64, y, 2);
  for (const x of [60, 63]) { p("vwave_c21_bartable", x, 45, 0); p("vwave_c21_barstool", x - 1, 45, 2); p("vwave_c21_barstool", x + 1, 46, 6); }
  p("modern_c17_floorlamp", 71, 46, 2, 1);
  for (const x of [38, 50]) p("easter_c22_fanpalm", x, 46);

  // Área externa: piscina (no piso), espreguiçadeiras, guarda-sóis, canteiro,
  // árvores longe do prédio, bancos.
  const piscina = { x0: 34, y0: 49, x1: 48, y1: 54 };
  // Espreguiçadeiras com os pés para a piscina (a cabeça fica no lado de
  // menor x, então só servem do lado esquerdo dela); embaixo, cadeiras de
  // praia viradas para a água com mesinhas entre elas.
  for (const y of [49, 51, 53]) p("js_c16_lounger", 30, y, 2);
  for (const x of [35, 38, 41, 44, 47]) p("ducket_c26_seachair", x, 55, 0);
  for (const x of [36, 42, 48]) p("ducket_c26_seasidetable", x, 55, 0);
  p("tiki_parasol", 33, 56, 0); p("tiki_parasol", 49, 50, 0);
  // Canteiros de flores na frente do prédio, com vãos para passar.
  for (let i = 0; i < 12; i++) p("stone_flowerbed", 1 + i * 6, 48, 0, 1);
  p("lt_c26_banyantree", 3, 53, 2);
  for (const [x, y] of [[13, 55], [26, 55], [77, 48], [77, 56]]) p("olympus_c25_olivetree", x, y, 2);
  for (const [x, y] of [[29, 56], [51, 54], [74, 3], [74, 15], [74, 27], [74, 39]]) p("vwave_c21_palm", x, y, 2);
  for (const [x, y] of [[8, 51], [20, 51], [14, 54]]) p("br_c25_stonebench", x, y, 0);

  // Textos e logo pintados nas paredes do fundo (x = parede de cima-direita).
  const quadros = [
    { tipo: "logo", parede: "x", de: 31, ate: 41 },
    { tipo: "texto", texto: "Qual a sua Vybe?", cor: "#ff7a1a", parede: "x", de: 6, ate: 16 },
    { tipo: "texto", texto: "TÔ NA VYBE", cor: "#ff3b2f", parede: "y", de: 14, ate: 20 },
    { tipo: "texto", texto: "É A VYBE, MINHA VIDINHA!", cor: "#ffffff", parede: "y", de: 38, ate: 46 },
  ];
  // Corredores (linha laranja), postes da praça e o letreiro da Vybelândia.
  const corredores = [10.5, 23.5, 36.5];
  // Postes nos vãos entre os canteiros e fora da piscina.
  const postes = [[4, 48], [16, 48], [28, 48], [40, 48], [52, 48], [64, 48], [73, 6], [73, 18], [73, 30], [73, 42], [51, 57], [28, 52]];
  const letreiro = { texto: "VYBELÂNDIA", de: 44, ate: 66 };
  return { W, H, PREDIO, PISO, ambientes, divisorias, moveis: m, piscina, quadros, corredores, postes, letreiro };
})();
// Presença trafega em porcentagem (6–94) no Worker; aqui vira ladrilho.
function escritorioParaMapa(px, py) {
  const P = ESCRITORIO_PLANTA;
  return { x: ((Number(px) - 6) / 88) * P.W, y: ((Number(py) - 6) / 88) * P.H };
}
function escritorioParaPorcentagem(x, y) {
  const P = ESCRITORIO_PLANTA, lim = (n) => Math.max(6, Math.min(94, n));
  return { x: lim(6 + (x / P.W) * 88), y: lim(6 + (y / P.H) * 88) };
}
function escritorioAmbienteEm(x, y) {
  return ESCRITORIO_PLANTA.ambientes.find((a) => x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1) || null;
}
// Corredores e área externa são convivência.
function escritorioSalaEm(x, y) {
  return escritorioAmbienteEm(x, y)?.sala || "convivencia";
}
// Coordenadas locais da sala: ly = 0 é o fundo (longe da porta) e cresce em
// direção à porta. Nas salas com porta para cima, tudo é espelhado em y,
// inclusive as direções (0 ↔ 4).
function escritorioNaSala(a, lx, ly, profundidade = 1) {
  if (a.porta === "baixo") return { x: a.x0 + lx, y: a.y0 + ly };
  return { x: a.x0 + lx, y: a.y1 - ly - profundidade };
}
function escritorioDirNaSala(a, dir) {
  return a.porta === "baixo" ? dir : { 0: 4, 4: 0 }[dir] ?? dir;
}
// Quem trabalha senta no fundo, de frente para a porta (que fica no meio).
// Mesa de trabalho: na parede do fundo à esquerda (x0), que fica longe de
// quem olha em todas as salas; a pessoa senta atrás dela, virada para a sala.
function escritorioMesaDaSala(a) {
  return { x: a.x0 + 2, y: a.y0 + 3, w: 2, h: 3, cadeira: { x: a.x0 + 1, y: a.y0 + 4, dir: 2 } };
}
// Mobília de cada sala: a mesa de trabalho é a mesma em todas (na parede da
// esquerda, quem senta olha para a sala), o resto acompanha o trabalho de quem
// ocupa. A ordem segue DONOS_ESCRITORIO em server/escritorio-mapa.js: Paulo,
// Vinícius e Ewerton atendem clientes; Deivid, Bia e Jady desenham; Mizinho
// grava; Taynara e Reriston têm canto próprio; as três últimas são livres.
// Regras: nada alto nas paredes que dividem salas (passava por cima da
// divisória), móveis com frente virada para dentro da sala, a faixa da porta
// (no meio, em cima ou embaixo) e o fundo onde fica o letreiro livres.
const ESCRITORIO_TEMAS_SALAS = ["atendimento", "atendimento", "atendimento", "design", "design", "design", "estudio", "planejamento", "criacao", "livre", "livre", "livre"];
function escritorioMoveisDaSala(a) {
  const item = (classe, lx, ly, dir, estado = 0, altura = 0) => [classe, a.x0 + lx, a.y0 + ly, dir, estado, altura];
  const mesa = escritorioMesaDaSala(a);
  const tema = ESCRITORIO_TEMAS_SALAS[Number(String(a.id).split("-")[1])] || "livre";
  const base = [
    item("exe_table", 2, 3, 2),
    item("computer_flatscreen", 2, 4, 6, 1, 1),
    ["army_c15_leatherchr", mesa.cadeira.x, mesa.cadeira.y, mesa.cadeira.dir, 0, 0],
    item("plant_yukka", 0, 0, 0), item("purablk_c16_shelve", 0, 7, 2),
  ];
  // Cadeiras de visita viradas para a mesa (cada tema com as suas).
  const visita = (classe) => [item(classe, 5, 3, 6), item(classe, 5, 5, 6)];
  const temas = {
    // Arquivo atrás da mesa e canto para receber o cliente: sofá no fundo,
    // mesinha e poltrona.
    atendimento: [
      ...visita("mafia_c26_armchair_white"), item("exe_globe", 0, 2, 0), item("exe_c15_telephone", 3, 5, 2, 0, 1),
      item("modern_c17_sofa", 7, 0, 4), item("hc26_3", 7, 2, 2), item("mafia_c26_armchair_dark", 9, 2, 6),
      item("modern_c17_floorlamp", 9, 0, 2, 1), item("bohogarden_c21_cheeseplant", 9, 8, 2),
    ],
    // Estação de criação com dois monitores no fundo e canto de ideias com pufes.
    design: [
      item("modern_c17_chair", 5, 4, 6),
      item("hc_exe_wrkdesk", 8, 0, 4), item("army_c15_leatherchr", 8, 1, 0),
      item("cubie_rug_p", 6, 5, 0), item("cubie_beanbag_b", 6, 6, 2), item("hc26_3", 7, 6, 0), item("cubie_beanbag_p", 8, 6, 6),
      item("bohogarden_c21_snakeplant", 9, 9, 2), item("modern_c17_floorlamp", 9, 3, 2, 1),
    ],
    // Mini estúdio: palco iluminado, câmera virada para ele e a cadeira de
    // quem dirige a gravação.
    estudio: [
      item("modern_c17_chair", 5, 4, 6),
      item("hc26_2", 6, 1, 0), item("spotlight", 9, 4, 6), item("spotlight", 6, 4, 0),
      item("studio_camera", 6, 7, 0, 1), item("studio_chair", 8, 7, 0),
      item("bohogarden_c21_cheeseplant", 9, 9, 2),
    ],
    // Canto aconchegante: poltronas em volta da mesinha sobre o tapete e
    // a cadeira suspensa.
    planejamento: [
      item("modern_c17_chair", 5, 4, 6),
      item("hygge_c25_carpet", 6, 4, 0), item("hygge_c25_coffeetable", 7, 5, 0),
      item("hygge_c25_armchair", 6, 5, 2), item("hygge_c25_armchair", 8, 6, 6),
      item("hygge_c25_hangingchair", 9, 1, 6), item("hygge_c18_shelf", 0, 2, 2, 1),
      item("bohogarden_c21_fanpalm", 9, 9, 2),
    ],
    // Bancada de vidro com segundo monitor e pufes em volta da mesinha.
    criacao: [
      ...visita("mafia_c26_armchair_dark"),
      item("gaming_c18_rigpro", 7, 0, 0), item("computer_flatscreen", 8, 0, 4, 1, 1.3), item("army_c15_leatherchr", 8, 1, 0),
      item("cubie_rug_b", 6, 5, 0), item("cubie_beanbag_b", 6, 6, 2), item("hc26_3", 7, 6, 0), item("cubie_beanbag_b", 8, 6, 6),
      item("bohogarden_c21_snakeplant", 9, 9, 2),
    ],
    livre: [...visita("modern_c17_chair"), item("modern_c17_floorlamp", 9, 0, 2, 1), item("bohogarden_c21_cheeseplant", 9, 8, 2)],
  };
  return [...base, ...temas[tema]];
}
