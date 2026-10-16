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
  };
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
    ambiente("sala-" + i, "Sala livre", "criacao", x0, y0, x0 + L, y0 + L,
      i % 2 ? "madeira" : "clara", { pessoal: true, porta: linha ? "cima" : "baixo" });
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

  // Móveis: [classe, x, y, direção, estado, altura (em cima de mesa)]
  const m = [];
  const p = (classe, x, y, dir = 2, estado = 0, altura = 0) => m.push([classe, x, y, dir, estado, altura]);
  // Auditório: telão na parede, púlpito sobre o tapete, refletores e plantas,
  // plateia olhando para o telão
  p("army15_largescreen", 0, 4, 2, 1); p("js_exe_rug", 1, 3, 0); p("uni_lectern", 2, 4, 2);
  p("spotlight", 1, 1, 2); p("spotlight", 1, 8, 2);
  p("bohogarden_c21_cheeseplant", 4, 0, 2); p("bohogarden_c21_cheeseplant", 4, 8, 2);
  for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++) p("hc26_10", 6 + f * 2, 1 + c, 6);
  p("easter_c22_fanpalm", 17, 0); p("easter_c22_fanpalm", 17, 8); p("darkmodern_c20_speakers", 0, 1, 2); p("darkmodern_c20_speakers", 0, 7, 2);
  // Reunião: mesa comprida no meio, cadeiras dos dois lados, quadro e arquivos
  p("army_c15_contable2", 20, 4, 0); for (const x of [21, 23, 25]) p("army_c15_contable", x, 4, 0); p("army_c15_contable2", 27, 4, 0);
  for (let x = 20; x <= 27; x++) { p("army_c15_leatherchr", x, 3, 4); p("army_c15_leatherchr", x, 5, 0); }
  p("uni_c23_whiteboard", 29, 3, 2); p("plant_yukka", 18, 0, 0); p("plant_yukka", 29, 8, 0);
  p("army_c15_cabinet", 20, 0, 4); p("army_c15_cabinet", 21, 0, 4); p("army_c15_cabinet", 22, 0, 4);
  // Recepção: tapete, balcão, sofá e mesa de centro
  p("hygge_c25_carpet", 34, 3, 0); p("hygge_c25_counter2", 35, 1, 2); p("hygge_c25_counter2", 37, 1, 2);
  p("mafia_c26_sofa_dark", 34, 7, 0); p("mafia_c26_coffeetable_dark", 35, 5, 2);
  p("easter_c22_fanpalm", 30, 0); p("easter_c22_fanpalm", 41, 0); p("darkmodern_c20_pug", 40, 6, 2);
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
  p("school_c22_equipment", 59, 5, 2); p("school_c22_equipment", 66, 5, 2);
  p("olympics_c16_trampoline", 69, 4, 2); p("olympics_c16_trampoline", 69, 6, 2); p("army_c15_plant", 71, 8);
  // Foco: estantes no fundo, poltronas e luminária
  for (const x of [64, 70]) p("lodge_dark_bookcase", x, 12, 0);
  p("hygge_c25_armchair", 66, 16, 2); p("hygge_c25_armchair", 69, 16, 6); p("darkmodern_c20_floorlight", 71, 15, 2, 1);
  p("hygge_c25_carpet", 66, 17, 0); p("army_c15_plant", 71, 21);
  // Jogos: fliperamas e pinball nas paredes, sinuca e pebolim no meio
  p("bling15_pooltable", 66, 27, 4); p("ads_aftv_footballtable", 68, 30, 0);
  p("tokyo_c18_retroarcade", 64, 26, 2, 1); p("graffiti_r24_arcademachine", 64, 28, 2, 1); p("arcade_c23_pinball", 64, 30, 2, 1);
  p("vwave_r21_jukebox", 64, 33, 2, 1); p("tokyo_c18_racearcade", 71, 26, 6, 1); p("tokyo_c18_racearcade", 71, 27, 6, 1);
  p("rainyday_c20_retrogames", 71, 33, 2, 1); p("mafia_c26_armchair_dark", 70, 33, 2);
  // Produção: bancadas com dois monitores, cadeira de frente para a tela
  for (let i = 0; i < 8; i++) {
    const x = 2 + (i % 4) * 6, y = 40 + Math.floor(i / 4) * 4;
    p("exe_table", x, y, 0); p("computer_flatscreen", x + 1, y + 1, 0, 1, 1);
    p("army_c15_leatherchr", x + 1, y - 1, 4);
  }
  p("exe_c15_printer", 25, 38, 2); p("army_c15_cabinet", 0, 40, 2); p("army_c15_cabinet", 0, 41, 2); p("army_c15_plant", 0, 46);
  // Lounge: lareira com sofás, área de TV, DJ e bar com banquetas
  p("lodge_dark_fireplace", 34, 38, 0, 1);
  for (const x of [30, 40]) {
    p("hygge_c25_carpet", x, 40, 0); p("mafia_c26_sofa_dark", x, 39, 0); p("darkmodern_c20_lowtable", x + 1, 41, 2);
    p("mafia_c26_sofa_dark", x, 44, 4); p("mafia_c26_armchair_dark", x + 3, 42, 6);
  }
  p("hc25_6", 52, 38, 0, 1); p("disco_c26_jukebox", 54, 38, 0, 1);
  p("hc26_5", 55, 41, 2); p("hc26_3", 56, 42, 0);
  p("lodge_dark_bardesk", 65, 40, 0); p("lodge_dark_minibar", 68, 38, 4, 1); p("army_c15_cabinet", 69, 38, 4); p("lodge_dark_minibar", 70, 38, 4, 1);
  for (const y of [40, 41, 42]) p("vwave_c21_barstool", 64, y, 2);
  for (const x of [60, 63]) { p("vwave_c21_bartable", x, 45, 0); p("vwave_c21_barstool", x - 1, 45, 2); p("vwave_c21_barstool", x + 1, 46, 6); }
  p("darkmodern_c20_floorlight", 71, 46, 2, 1); p("easter_c22_fanpalm", 26, 46);
  // Lounge: tapete e luz na pista do DJ, plantas entre os cantos de sofá
  p("darkmodern_c20_rug", 52, 40, 0); p("spotlight", 51, 39, 2); p("spotlight", 57, 39, 6);
  for (const x of [37, 47]) p("theatre_plant", x, 38, 2);
  // Passagem do meio entre as salas: vasos altos dos dois lados, como uma rua da Vybelândia
  for (const y of [14, 19, 28, 33]) { p("suncity_c19_plantpillar", 30, y, 2); p("suncity_c19_plantpillar", 33, y, 2); }
  p("easter_c22_fanpalm", 38, 46); p("easter_c22_fanpalm", 50, 46);

  // Área externa: piscina (no piso), espreguiçadeiras, guarda-sóis, canteiro,
  // árvores longe do prédio, bancos.
  const piscina = { x0: 34, y0: 49, x1: 48, y1: 54 };
  for (let i = 0; i < 7; i++) p("js_c16_lounger", 34 + i * 2, 55, 0);
  p("tiki_parasol", 33, 55, 0); p("lido_parasol", 41, 56, 0); p("tiki_parasol", 49, 50, 0);
  for (let i = 0; i < 22; i++) p(i % 2 ? "hobbies_c26_flower" : "hobbies_c26_flowerpot2", 1 + i * 3, 48, 2);
  p("lt_c26_banyantree", 3, 53, 2);
  for (const [x, y] of [[13, 55], [26, 55], [77, 48], [77, 56]]) p("ducket_c26_appletree", x, y, 2);
  for (const [x, y] of [[32, 49], [51, 54], [74, 3], [74, 15], [74, 27], [74, 39]]) p("vwave_c21_palm", x, y, 2);
  for (const [x, y] of [[8, 51], [20, 51], [14, 54]]) p("br_c25_stonebench", x, y, 0);
  for (const [x, y] of [[72, 9], [72, 22], [72, 35]]) p("hobbies_c26_flowerpot2", x, y, 2);

  // Textos e logo pintados nas paredes do fundo (x = parede de cima-direita).
  const quadros = [
    { tipo: "logo", parede: "x", de: 31, ate: 41 },
    { tipo: "texto", texto: "Qual a sua Vybe?", cor: "#ff7a1a", parede: "x", de: 6, ate: 16 },
    { tipo: "texto", texto: "TÔ NA VYBE", cor: "#ff3b2f", parede: "y", de: 14, ate: 20 },
    { tipo: "texto", texto: "É A VYBE, MINHA VIDINHA!", cor: "#ffffff", parede: "y", de: 38, ate: 46 },
  ];
  // Corredores (linha laranja), postes da praça e o letreiro da Vybelândia.
  const corredores = [10.5, 23.5, 36.5];
  const postes = [[2, 48], [12, 48], [24, 48], [52, 48], [62, 48], [73, 6], [73, 18], [73, 30], [73, 42], [45, 52], [30, 52]];
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
// Mobília igual nas 12 salas, sem espelhar: estantes no canto do fundo, mesa
// na parede da esquerda, poltronas de visita na frente da mesa, canto do sofá
// no fundo à direita, plantas nos cantos. Nada alto fica entre quem olha e a
// mesa, e a porta (no meio, em cima ou embaixo) fica livre.
function escritorioMoveisDaSala(a) {
  const item = (classe, lx, ly, dir, estado = 0, altura = 0) => [classe, a.x0 + lx, a.y0 + ly, dir, estado, altura];
  const mesa = escritorioMesaDaSala(a);
  return [
    item("lodge_dark_bookcase", 0, 0, 0), item("lodge_dark_bookcase", 2, 0, 0),
    item("darkmodern_c20_floorlight", 0, 2, 2, 1),
    item("exe_table", 2, 3, 2),
    item("computer_flatscreen", 2, 4, 6, 1, 1),
    ["army_c15_leatherchr", mesa.cadeira.x, mesa.cadeira.y, mesa.cadeira.dir, 0, 0],
    item("mafia_c26_armchair_dark", 5, 3, 6), item("mafia_c26_armchair_dark", 5, 5, 6),
    item("hygge_c25_carpet", 6, 0, 0), item("hc26_5", 6, 0, 4), item("hc26_3", 7, 1, 0),
    item("mafia_c26_armchair_dark", 7, 3, 0),
    item("plant_yukka", 9, 0, 0), item("army_c15_plant", 9, a.porta === "cima" ? 9 : 8, 2),
  ];
}
