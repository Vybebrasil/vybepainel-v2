// Planta do escritório (4ª versão, 17 de outubro de 2026, decisão do Paulo):
// não há mais mapa geral. Cada lugar é uma cena própria, como os quartos do
// Habbo, e se vai de um para outro pela lista de salas. As salas da equipe
// (sala-0 … sala-8) são os quartos de cada um; os espaços comuns (Convivência,
// Reunião, Auditório, Produção, Café, Jogos, Foco, Academia, Lounge) são
// cenas montadas aqui; a Praça (área de fora) é a cena de abertura, a que o
// editor do administrador chama de "geral". Quem sai de uma sala pela porta
// chega na Convivência; da Convivência a porta leva à Praça e volta.
// Unidade: ladrilho do Habbo (64×32 px). x desce para a direita na tela, y
// desce para a esquerda. Direções do Habbo: 0 olha para −y, 2 para +x,
// 4 para +y, 6 para −x; medidas valem em 0/4 e giram em 2/6.
// Item de parede (janela, quadro, luminária): [classe, x, y, 2|4, estado,
// altura]; 4 pendura na parede de fundo do ladrilho (y), 2 na da esquerda (x).
// Cada ambiente pertence a uma sala de conversa do servidor (os ids são os
// que o Worker aceita). Quem é dono de cada sala vem do servidor.
const ESCRITORIO_SALA_LADO = 8;
// Altura real do tampo (em ladrilhos de altura, 32 px), medida no desenho
// de cada móvel. A altura que vem na ficha do Habbo erra em vários (balcão,
// mesa da recepção): o que ia em cima afundava ou flutuava. O editor e o
// verificador usam esta tabela; o que não está nela usa a da ficha.
const ESCRITORIO_TAMPOS = {
  exe_table: 0.95, hc25_12: 1.25, hc_exe_table: 1.1, classic9_table: 0.7, army_c15_contable: 1.05, army_c15_contable2: 1.05,
  darkmodern_c20_lowtable: 0.95, modern_c17_lowtable: 0.95, hygge_c25_counter1: 1.25, lodge_dark_desk: 1.25,
  js_exe_bardesk: 0.9, hc26_3: 0.25, hygge_c25_coffeetable: 0.55, gaming_c18_rigpro: 1.15, vwave_c21_bartable: 1,
  cubie_shelf_2_p: 1.05, hygge_c18_shelf: 1.2, modern_c17_endtable: 1.3, purablk_c16_shelve: 1, jp_drawer: 1,
};
// Estado em que cada móvel se mexe (tela ligada, fogo aceso, fliperama
// rodando, água correndo). Na arte do Habbo isso muda de um móvel para outro:
// no estado errado ele fica parado. Vale para a planta e para as salas.
const ESCRITORIO_ESTADO_ANIMADO = {
  computer_flatscreen: 2, studio_floorlight: 4, spotlight: 5, studio_camera: 2, hc_exe_wrkdesk: 1, exe_c15_printer: 1,
  cine_screen: 2, cine_light1: 100, army15_largescreen: 0, hygge_c25_kitchensink: 1, tokyo_c18_retroarcade: 0,
  arcade_c23_space: 0, arcade_c23_pinball: 0, arcade_c23_cyberpunk: 0, bling15_pooltable: 1, olympics_c16_treadmill: 1,
  olympics_c16_trampoline: 1, disco_c26_floor: 0, exe_globe: 1, waasa_aquarium: 0, bazaar_r17_fountain: 1,
  zengarden_r18_fountain: 1, tokyo_c18_neonsign1: 1, tokyo_c18_neonsign2: 1, classic8_disco: 0, cine_popcorn: 0,
  bohogarden_c21_fireheater: 0, garden_birdbath: 1, lc_medusa1: 3, olympics_r16_vendingmchn: 1,
  birds_r18_cardinal: 1, ktchn10_tea: 1, fxbox_fx16: 1, hygge_r25_toastcat: 1, garden_flolamp: 1, tiki_torch: 1,
  lodge_dark_candle: 1, disco_c26_discoball: 1, arcade_c23_vrmachine: 1, matic_tree_blue: 1, attic15_clock: 0,
  jungle_c16_light: 0, army_c15_deskcomp: 1, celestial_c21_lamp: 1, hotel_c18_fountain: 0, garden_r21_plantwall: 1,
  modern_c17_iscreen: 1, art_c20_drawingtablet: 2, lodge_dark_tv: 1, darkmodern_c20_floorlight: 7, hc_radio: 1,
  sunsetcafe_c20_coffeemachine: 1, vwave_r21_jukebox: 1, rainyday_c20_retrogames: 1, disco_c26_jukebox: 1,
  graffiti_r24_arcademachine: 1, matic_water_dispenser: 1, darkmodern_c20_pug: 1, exe_c15_telephone: 1,
};
// Quando esta planta entrou no ar: o mapa geral salvo antes disso é da planta
// anterior e não vale mais (as salas individuais continuam, são relativas).
const ESCRITORIO_PLANTA_DESDE = "2026-10-17T12:30:00Z";
// A reorganização comum não invalida as coordenadas locais dos quartos.
// 17/10/2026, noite: o mapa geral deu lugar à Praça (cena de abertura, a
// camada "geral" do editor); o que foi salvo antes disso não vale mais.
const ESCRITORIO_GERAL_DESDE = "2026-10-17T23:52:04Z";
const ESCRITORIO_PLANTA = (() => {
  // W × H é só a escala da presença (porcentagem ↔ ladrilho), a mesma do
  // mapa antigo: as coordenadas de cada cena são locais e cabem nela.
  const W = 80, H = 80, L = ESCRITORIO_SALA_LADO;
  const PISO = {
    madeira: ["#6b4a33", "#62432e"], clara: ["#9c7550", "#916b48"], concreto: ["#3d3f46", "#383a40"],
    carpete: ["#2c3444", "#27303e"], preto: ["#1b1b20", "#17171b"], cafe: ["#c9c4bd", "#bdb8b1"],
    verde: ["#23493a", "#1f4134"], corredor: ["#5c5d66", "#56575f"], academia: ["#222227", "#1e1e22"],
    grama: ["#3f7d3a", "#3a7335"], deck: ["#8a5f3c", "#7f5736"], praca: ["#2a2930", "#26252b"],
    // Pisos das salas individuais (madeiras e tons próximos, cada um diferente).
    sala0: ["#7a4f3a", "#704836"], sala1: ["#5e4636", "#564031"], sala2: ["#3f4a5c", "#394354"], sala3: ["#6b5a3e", "#625238"],
    sala4: ["#6a4555", "#613f4e"], sala5: ["#4a5a48", "#435242"], sala6: ["#5a4a6a", "#524361"], sala7: ["#7a5a3a", "#705235"],
    sala8: ["#45545e", "#3f4d56"],
    // Espaços do Lounge, cada um com o seu piso.
    lareira: ["#4f3626", "#472f21"], cinema: ["#262a3c", "#222536"], pista: ["#2c2338", "#271f32"], bar: ["#3d2b22", "#36261e"],
    // Mais pisos para pintar as salas.
    marmore: ["#d9d6d0", "#cfccc5"], gramado: ["#4f8a43", "#467d3c"], nogueira: ["#3e2a1e", "#36241a"], vinho: ["#5a2230", "#4f1d2a"],
    patio: ["#cfc9bf", "#c5bfb5"],
  };
  // Cor da parede alta de cada sala.
  const CORES_SALAS = ["#ff8a35", "#ffb347", "#ffd166", "#5aa9ff", "#ff6fa8", "#7ee08a", "#b48cff", "#5ad1e6", "#e8a87c"];
  const ambientes = [];
  // Salas individuais, na ordem do servidor (sala-0 … sala-8): o quarto de
  // cada um, em coordenadas locais (0 … L). "porta": de que lado fica o vão
  // (embaixo ou à direita); "alta": as paredes altas do fundo.
  const PORTA_SALAS = ["baixo", "baixo", "baixo", "baixo", "baixo", "baixo", "direita", "direita", "direita"];
  // Chat escrito de cada sala: o da ala em que ela fica.
  const ALA_SALAS = ["atendimento", "atendimento", "atendimento", "criacao", "criacao", "criacao", "producao", "producao", "producao"];
  PORTA_SALAS.forEach((porta, i) => ambientes.push({ id: "sala-" + i, nome: "Sala livre", sala: ALA_SALAS[i], x0: 0, y0: 0, x1: L, y1: L, piso: "sala" + i,
    pessoal: true, porta, alta: ["y0", "x0"], cor: CORES_SALAS[i] }));
  // Espaços comuns: cada um é uma cena com as paredes do fundo altas e
  // forradas, preenchida do chão à parede (ESCRITORIO_MOVEIS_CENAS). O id é
  // a zona de conversa que o Worker já aceita: entrar na cena é entrar na
  // conversa daquele espaço. A Convivência usa a zona "recepcao".
  // [id, nome, sala de conversa, cor, largura × fundo, piso, papel de parede]
  const CENAS = [
    ["recepcao", "Convivência", "convivencia", "#ff8a35", 16, 13, "greek_c15_floor", "art_c20_wall"],
    ["reuniao", "Sala de reunião", "reuniao", "#5aa9ff", 12, 10, "lodge_c15_floor", "lodge_dark_brickwall"],
    ["auditorio", "Auditório", "reuniao", "#6b4fa0", 14, 12, "cine_tile", "attic15_wall"],
    ["producao", "Produção", "producao", "#4a5560", 14, 11, "rainyday_c20_woodenfloor", "attic15_wall"],
    ["cafe", "Café", "convivencia", "#d9a066", 12, 10, "bathroom_floortile1", "art_c20_wall"],
    ["jogos", "Jogos", "convivencia", "#3fae7a", 12, 10, "tokyo_c18_floor", "attic15_wall"],
    ["foco", "Foco", "foco", "#8b6b4a", 11, 9, "rainyday_c20_woodenfloor", "gardenshed_wall"],
    ["academia", "Academia", "convivencia", "#7a8494", 12, 10, "sb_tile", "attic15_wall"],
    ["lounge", "Lounge", "convivencia", "#b4583a", 14, 12, "lodge_dark_floor", "lodge_dark_brickwall"],
  ];
  for (const [id, nome, sala, cor, w, h, textura, texturaParede] of CENAS) {
    // A planta da cena vem junto (não do catálogo dos quartos): retângulo de
    // piso, porta no meio da frente, sem parede na frente, como no Habbo.
    const modelo = { id: "cena-" + id, celdas: Array.from({ length: h }, () => Array(w).fill(0)), portas: { baixo: Math.floor(w / 2) - 1 }, escada: [], bordaAberta: true };
    ambientes.push({ id, nome, sala, cena: true, semRotulo: true, x0: 0, y0: 0, x1: w, y1: h, piso: "madeira", porta: "baixo", cor, textura, texturaParede, modelo });
  }
  return { W, H, PREDIO: null, PISO, ambientes, divisorias: [], moveis: [], piscina: null, quadros: [], corredores: [], postes: [], letreiro: null,
    pisos: [], rotulos: [], vistas: {}, texturas: [], texturaSalas: "rainyday_c20_woodenfloor", texturaCorredor: "paris_c15_pavement",
    texturaDeck: "country_patio", portas: [], soleiras: [], elevadores: [] };
})();
// Praça: a área de fora, compacta, ao ar livre (sem paredes). É a cena de
// abertura do escritório (zona vazia, sem voz, como era o corredor) e a
// camada "geral" do editor de quem administra. Chão por trechos: gramado,
// calçamento, deck da piscina, lago (água não se pisa).
const ESCRITORIO_PRACA = (() => {
  const w = 22, h = 18;
  const modelo = { id: "cena-praca", celdas: Array.from({ length: h }, () => Array(w).fill(0)), portas: { baixo: Math.floor(w / 2) - 1 }, escada: [], bordaAberta: true, semParedes: true };
  const texturas = [
    { x0: 0, y0: 0, x1: w, y1: h, textura: "country_grass", piso: "grama" },
    // Deck da piscina (fundo à esquerda) e a água.
    { x0: 0, y0: 0, x1: 10, y1: 9, textura: "country_patio", piso: "deck" },
    { x0: 1, y0: 1, x1: 7, y1: 5, textura: "jungle_c16_watertile", piso: "verde", agua: true },
    // Café ao ar livre (fundo à direita).
    { x0: 13, y0: 0, x1: w, y1: 7, textura: "paris_c15_floor", piso: "praca" },
    // Praça calçada com mosaico em volta da fonte e o caminho até a porta.
    { x0: 9, y0: 7, x1: 16, y1: 14, textura: "mexico_c24_cobbledstreet", piso: "praca" },
    { x0: 10, y0: 8, x1: 15, y1: 13, textura: "santorini_c17_mosaicfloor", piso: "praca" },
    { x0: 9, y0: 14, x1: 13, y1: h, textura: "paris_c15_pavement", piso: "praca" },
    // Lago do jardim (frente à direita).
    { x0: 17, y0: 14, x1: 21, y1: 17, textura: "jungle_c16_watertile", piso: "verde", agua: true },
  ];
  return { id: "praca", nome: "Praça", sala: "convivencia", praca: true, semRotulo: true, x0: 0, y0: 0, x1: w, y1: h, piso: "grama", porta: "baixo", cor: "#3fae7a", modelo, texturas };
})();
// Móveis de cada espaço comum, em coordenadas da cena (0,0 = canto do
// fundo). Montados como os quartos de referência do Habbo: cada cena com uma
// linha de móveis só, parede do fundo ocupada, peças empilhadas (o que fica
// em cima leva a altura do topo de baixo) e o caminho da porta livre.
// [classe, x, y, direção, estado, altura]
const ESCRITORIO_MOVEIS_CENAS = {
  // Convivência: o saguão de todos (antes Recepção e Pátio do mapa). Balcão
  // de atendimento no fundo, sala de estar sob a janela, mural, bebedouro e
  // máquinas; estantes e globo na lateral; fonte com bancos à direita;
  // mesinhas de café na frente. A porta leva à Praça.
  recepcao: () => [
    ["mafia_c26_planter_white", 0, 0, 0],
    ["modern_c17_chair", 2, 0, 4], ["lodge_dark_desk", 1, 1, 0],
    ["computer_flatscreen", 2, 1, 4, 0, 1.25], ["exe_c15_telephone", 3, 1, 0, 0, 1.25], ["exe_c15_desktidy", 1, 1, 0, 0, 1.25],
    ["window_double_default", 5, 0, 4, 0, 0.9],
    ["exe_rug", 5, 1, 0], ["hc_exe_sofa", 5, 0, 4], ["modern_c17_lowtable", 5, 2, 2],
    ["mafia_c26_armchair_white", 5, 3, 0], ["mafia_c26_armchair_white", 7, 3, 0],
    ["ktchn10_tea", 6, 2, 4, 0, 1],
    ["uni_c23_whiteboard", 10, 0, 0], ["matic_water_dispenser", 11, 0, 4],
    ["olympics_r16_vendingmchn", 12, 0, 4], ["olympics_r16_vendingmchn", 13, 0, 4], ["mafia_c26_planter_white", 15, 0, 0],
    ["shelves_silo", 0, 2, 2], ["exe_globe", 0, 5, 0], ["shelves_silo", 0, 7, 2], ["mafia_c26_planter_white", 0, 10, 0],
    ["bazaar_r17_fountain", 11, 7, 4],
    ["greek_c15_bench", 10, 7, 2], ["greek_c15_bench", 13, 7, 6], ["greek_c15_bench", 11, 9, 0],
    ["olympus_c25_narcissusflowers", 10, 9, 0], ["olympus_c25_narcissusflowers", 13, 9, 0],
    ...[[2, 9], [4, 11]].flatMap(([x, y]) => [["paris_c15_table", x, y, 0], ["paris_c15_chair", x - 1, y, 2], ["paris_c15_chair", x + 1, y, 6]]),
    // Acabamento como nos quartos dos construtores do Habbo: vigas com hera e
    // lâmpadas no fundo, plantas e lanterna penduradas, hera e varal de
    // luzinhas na parede da esquerda (pisáveis: passa-se por baixo).
    ["easter_c18_ivylight", 3, 0, 2, 1], ["easter_c18_ivybeam", 11, 1, 2, 1], ["bohogarden_c21_hanginglantern", 14, 0, 4, 1],
    ["easter_c18_hangingplant", 8, 0, 0, 1], ["easter_c18_hangingplant", 8, 1, 0, 1],
    ["easter_c22_hangingvines", 0, 4, 2, 1], ["easter_c22_hangingvines", 0, 6, 2, 1], ["xmas_c22_hangingwalllights", 0, 11, 2, 1],
    // Garrafa giratória na mesinha (como no Habbo: gira e aponta para alguém).
    ["bottle", 2, 9, 0, 0, 0.95],
    ["mafia_c26_planter_white", 6, 12, 0], ["mafia_c26_planter_white", 9, 12, 0], ["mafia_c26_planter_white", 15, 12, 0],
    ["mafia_c26_planter_white", 15, 4, 0], ["modern_c17_floorlamp", 9, 0, 0],
    // Teleportes (levam direto a qualquer sala) e um dado (tem pedestal próprio).
    // A cabine escura forma par com a da Praça (teleporte ligado, como no
    // Habbo); a branca, sem par, abre a lista de salas.
    ["mafia_c26_teleport_white", 15, 1, 6], ["mafia_c26_teleport_dark", 15, 2, 6],
    ["edice", 7, 9, 0, 1],
  ],
  // Praça: a área de fora, compacta. Deck da piscina com bar de palha no
  // fundo à esquerda; café ao ar livre no fundo à direita; fonte no meio do
  // calçamento; caminho iluminado até a porta; jardim com lago na frente à
  // direita; piquenique, bicicletas e árvores na frente à esquerda.
  praca: () => [
    // Deck: espreguiçadeiras viradas para a piscina, guarda-sóis entre elas,
    // bar de palha com banquetas e tochas, palmeiras.
    ...[1, 3, 5].map((x) => ["js_c16_lounger", x, 5, 0]), ["lido_parasol", 2, 7, 0], ["lido_parasol", 4, 7, 0],
    // Banqueta sim, banqueta não: cada uma com chão livre ao lado para chegar.
    ...[1, 2, 3, 4].map((y) => ["tiki_bardesk", 8, y, 6]), ["vwave_c21_barstool", 7, 1, 2], ["vwave_c21_barstool", 7, 3, 2],
    ["tiki_torch", 8, 0, 2], ["tiki_torch", 8, 5, 2], ["summer_c22_lifering", 7, 6, 2],
    ["vwave_c21_palm", 9, 0, 2], ["vwave_c21_palm", 9, 8, 2], ["vwave_c21_palm", 9, 6, 2],
    // Café: quiosque, quatro mesas com cadeiras, guarda-sóis e floreiras.
    ["nyc_c23_starterstall", 13, 0, 0],
    ...[[15, 1], [19, 1], [15, 4], [19, 4]].flatMap(([x, y]) => [["paris_c15_table", x, y, 0], ["paris_c15_chair", x - 1, y, 2], ["paris_c15_chair", x + 1, y, 6]]),
    ["lido_parasol", 17, 1, 0], ["lido_parasol", 17, 4, 0],
    ["olympics_c16_plantdvdr", 18, 6, 0], ["olympics_c16_plantdvdr", 20, 6, 0],
    // Fonte no meio do mosaico com quatro bancos, canteiros e postes.
    ["bazaar_r17_fountain", 11, 10, 4],
    ["greek_c15_bench", 11, 8, 4], ["greek_c15_bench", 10, 10, 2], ["greek_c15_bench", 13, 10, 6], ["greek_c15_bench", 11, 12, 0],
    ["stone_flowerbed", 14, 8, 0], ["stone_flowerbed", 14, 12, 0],
    ...[[9, 7], [15, 7], [9, 13], [15, 13], [9, 16], [12, 16]].map(([x, y]) => ["suncity_c19_streetlight", x, y, 0, 1]),
    // Jardim com lago: pedras, flores d'água, plantas, banco e bebedouro.
    ["rela_rock", 16, 14, 0], ["rela_rock", 16, 16, 0], ["br_c25_lilies3", 18, 15, 0], ["br_c25_lilies3", 20, 14, 0],
    ["zengarden_c18_spikeyplant", 21, 14, 0], ["zengarden_c18_spikeyplant", 21, 16, 0],
    ["br_c25_stonebench", 18, 17, 0], ["garden_birdbath", 14, 16, 0],
    // Sebe baixa separando o jardim da praça (árvore alta na frente cobria tudo).
    ["hblooza14_hedgediv", 17, 12, 0], ["hblooza14_hedgediv", 19, 12, 0], ["garden_lupin3", 21, 12, 0], ["garden_lupin3", 21, 9, 0],
    // Frente à esquerda: piquenique, bicicletário, árvores e flores.
    ["summer_c22_picnictable", 2, 11, 0], ["summer_c22_picnictable", 2, 14, 0],
    ["mafia_c26_teleport_dark", 13, 16, 6],
    ["paris15_bicycle", 7, 13, 0], ["paris15_bicycle", 7, 15, 0], ["classic2_trashcan", 8, 12, 2], ["nyc_c23_mailbox", 8, 17, 2],
    ["olympus_c25_olivetree", 0, 9, 2], ["bohogarden_c21_fanpalm", 1, 17, 0], ["bohogarden_c21_fanpalm", 5, 10, 0],
    ...[[0, 12], [0, 14], [5, 13], [4, 16]].map(([x, y]) => ["garden_lupin3", x, y, 0]),
  ],
  // Café: a cozinha moderna do vídeo de referência. Bancada preta no fundo
  // com geladeira, fogão com coifa, pia e armários na parede; ilha com
  // banquetas no meio; mesa de jantar com luminária pendente à direita.
  cafe: () => [
    // Plantas penduradas, viga com hera e luz sobre o balcão, hera na parede.
    ["easter_c18_hangingplant", 2, 1, 0, 1], ["easter_c18_ivylight", 4, 1, 2, 1], ["easter_c18_hangingplant", 9, 1, 0, 1],
    ["easter_c22_hangingvines", 0, 4, 2, 1],
    ["mode_fridge", 0, 0, 0],
    ["hygge_c25_counter1", 1, 0, 0], ["hygge_c25_microwave", 1, 0, 0, 0, 1.2],
    ["hygge_c25_counter1", 2, 0, 0], ["ktchn15_coffeemaker", 2, 0, 4, 0, 1.2],
    ["hygge_c25_stove", 3, 0, 0],
    ["hygge_c25_counter1", 4, 0, 0], ["hygge_c25_airfryer", 4, 0, 0, 0, 1.2],
    ["hygge_c25_counter1", 5, 0, 0], ["hygge_c25_kitchensink", 5, 0, 4, 0, 1.2],
    ["hygge_c25_counter1", 6, 0, 0], ["hygge_c25_papertowel", 6, 0, 0, 0, 1.2],
    ["ktchn_c15_dishwasher", 7, 0, 4],
    ["hygge_c25_counter1", 8, 0, 0], ["hygge_c25_waffleiron", 8, 0, 0, 0, 1.2],
    ["ktchn15_cabinet", 9, 0, 4],
    ["sunsetcafe_c20_plant", 11, 0, 0],
    // Armários de parede sobre a bancada.
    ...[1, 2, 4, 6, 8].map((x) => ["ktchn_c15_cupboard", x, 0, 4, 0, 2.2]),
    // Lateral esquerda: janela, adega e planta.
    ["hygge_c25_window2", 0, 2, 0],
    ["ktchn15_bubblejuicerack", 0, 5, 2],
    ["bohogarden_c21_snakeplant", 0, 8, 2],
    // Ilha com tampo cheio e banquetas.
    ...[2, 3, 4].flatMap((x) => [["hygge_c25_counter1", x, 4, 0], ["hygge_c25_barstool", x, 5, 0]]),
    ["hygge_c25_tumbler", 2, 4, 0, 0, 1.2], ["ktchn_c15_bread", 3, 4, 4, 0, 1.2], ["ktchn_c15_chopboard", 4, 4, 4, 0, 1.2],
    ["ktchn_c15_cupboard", 0, 4, 2, 0, 2.2],
    // Mesa de jantar de madeira escura no tapete, seis lugares e o pendente.
    ["hygge_c25_carpet", 7, 3, 2],
    ["lodge_dark_diningtable", 8, 4, 0],
    ["hc26_10", 8, 3, 4], ["hc26_10", 9, 3, 4], ["hc26_10", 8, 6, 0], ["hc26_10", 9, 6, 0],
    ["hc26_10", 7, 5, 2], ["hc26_10", 10, 4, 6],
    ["ktchn10_tea", 9, 5, 0, 0, 0.9],
    // Canto do café: tapete, poltronas em volta da mesinha, luminária e plantas.
    ["hygge_c25_carpet", 1, 6, 0],
    ["hygge_c25_armchair", 1, 7, 2], ["hygge_c25_armchair", 1, 8, 2],
    ["hygge_c25_coffeetable", 2, 7, 0], ["hygge_c25_armchair", 3, 8, 6],
    ["ktchn10_tea", 2, 7, 0, 0, 0.6], ["mm_lamp", 0, 7, 2],
    // Lateral direita: vaso de plumas junto da cristaleira e a cadeira
    // suspensa mais à frente (no fundo ela tapava a cristaleira).
    ["hygge_c25_hangingchair", 11, 5, 6], ["hygge_c25_featherdeco", 11, 2, 0],
    ["bohogarden_c21_snakeplant", 11, 8, 2],
  ],
  // Sala de reunião: escritório executivo em madeira escura. Estante,
  // candelabro, mapa-múndi e TV no fundo; lareira e frigobar na lateral;
  // mesa de dez lugares no tapete, com telefone e notebooks; espera à direita.
  reuniao: () => [
    // Acabamento de construtor: plantas penduradas e hera na parede.
    ["easter_c18_hangingplant", 4, 1, 0, 1], ["easter_c18_hangingplant", 6, 1, 0, 1], ["easter_c18_hangingplant", 9, 1, 0, 1],
    ["easter_c22_hangingvines", 0, 1, 2, 1], ["easter_c22_hangingvines", 0, 6, 2, 1],
    ["shelves_silo", 0, 0, 4], ["lodge_dark_candle", 2, 0, 0],
    ["lodge_dark_endtable", 3, 0, 0], ["exe_globe", 3, 0, 0, 0, 0.9],
    // Roleta para sortear quem fala primeiro na reunião.
    ["arcade_c23_spinthewheel", 0, 4, 2],
    ["exe_map", 3, 0, 4, 0, 1.4], ["lodge_dark_tv", 5, 0, 0],
    ["shelves_silo", 7, 0, 4], ["exe_wfall", 9, 0, 4, 0, 0.6],
    ["mafia_c26_planter_dark", 10, 0, 0], ["uni_c23_whiteboard", 11, 0, 0],
    ["lodge_dark_fireplace", 0, 2, 2], ["lodge_dark_minibar", 0, 5, 2],
    ["shelves_silo", 0, 7, 2],
    ["exe_rug", 4, 3, 0], ["exe_table", 4, 4, 0],
    ...[4, 5, 6].flatMap((x) => [["exe_chair", x, 3, 4], ["exe_chair", x, 6, 0]]),
    ["exe_chair", 3, 4, 2], ["exe_chair", 3, 5, 2], ["exe_chair", 7, 4, 6], ["exe_chair", 7, 5, 6],
    ["exe_c15_telephone", 4, 4, 0, 0, 0.95], ["uni_laptop", 5, 4, 4, 0, 0.95], ["exe_c15_desktidy", 6, 4, 0, 0, 0.95],
    ["mafia_c26_drinktray", 4, 5, 0, 0, 0.95], ["uni_laptop", 5, 5, 0, 0, 0.95], ["uni_laptop", 6, 5, 0, 0, 0.95],
    ["mafia_c26_armchair_dark", 9, 4, 2], ["mafia_c26_armchair_dark", 9, 5, 2],
    ["mafia_c26_coffeetable_dark", 10, 4, 0], ["exe_sofa", 11, 4, 6],
    ["exe_artlamp", 11, 2, 0], ["mafia_c26_planter_dark", 11, 9, 0], ["mafia_c26_planter_dark", 0, 9, 0],
  ],
  // Lounge: clube de madeira e tijolo. Bar com prateleiras e banquetas no
  // fundo, lareira com sofá e poltronas, pista com globo e DJ à direita,
  // mesas altas na frente.
  lounge: () => [
    // Varal de luzinhas no fundo, fios de lâmpadas e lanterna.
    ["xmas_c22_hangingwalllights", 6, 1, 0, 1], ["circus_c24_hanginglights", 0, 1, 2, 1], ["circus_c24_hanginglights", 0, 3, 2, 1],
    ["bohogarden_c21_hanginglantern", 13, 1, 0, 1],
    ["ktchn15_bubblejuicerack", 0, 0, 4], ["lodge_dark_minibar", 2, 0, 4], ["ktchn15_cabinet", 3, 0, 4], ["lodge_dark_minibar", 5, 0, 4],
    ["hc_wall_lamp", 6, 0, 4, 0, 1.6], ["hc_wall_lamp", 7, 0, 4, 0, 1.6],
    ["lodge_dark_bardesk", 1, 2, 2], ["lodge_dark_bardesk", 4, 2, 2],
    ...[1, 2, 3, 4, 5, 6].map((x) => ["lodge_dark_stool", x, 3, 0]),
    ["mafia_c26_drinktray", 2, 2, 0, 0, 1.4], ["mafia_c26_drinktray", 5, 2, 0, 0, 1.4],
    ["jukebox_big", 8, 0, 0], ["vwave_r21_jukebox", 10, 0, 4], ["tokyo_c18_neonsign1", 11, 0, 0], ["tokyo_c18_neonsign2", 12, 0, 0],
    ["mafia_c26_planter_dark", 13, 0, 0],
    ["lodge_dark_candle", 0, 4, 2], ["lodge_dark_fireplace", 0, 6, 2], ["lodge_dark_candle", 0, 9, 2],
    ["exe_rug", 1, 5, 0], ["mafia_c26_armchair_dark", 2, 5, 4], ["mafia_c26_coffeetable_dark", 2, 6, 0],
    ["mafia_c26_armchair_dark", 2, 8, 0], ["mafia_c26_sofa_dark", 3, 5, 6], ["mafia_c26_drinktray", 2, 6, 0, 0, 0.84],
    ...[[9, 4], [11, 4], [9, 6], [11, 6]].map(([x, y]) => ["disco_c26_floor", x, y, 0]),
    ["disco_c26_discoball", 10, 5, 0, 0, 0.01], ["fest_c19_dj", 10, 2, 4],
    ["vwave_c21_bartable", 8, 9, 0], ["vwave_c21_barstool", 7, 9, 2], ["vwave_c21_barstool", 9, 10, 6],
    ["vwave_c21_bartable", 11, 9, 0], ["vwave_c21_barstool", 10, 9, 2], ["vwave_c21_barstool", 12, 10, 6],
    ["hygge_c25_carpet", 3, 8, 2], ["mafia_c26_armchair_dark", 3, 9, 2], ["mafia_c26_coffeetable_dark", 4, 9, 0],
    ["mafia_c26_armchair_dark", 5, 9, 6], ["mafia_c26_armchair_dark", 5, 10, 6], ["mafia_c26_drinktray", 4, 10, 0, 0, 0.84],
    ["mafia_c26_planter_dark", 0, 11, 0], ["mafia_c26_planter_dark", 13, 11, 0], ["lodge_dark_candle", 8, 4, 0],
  ],
  // Auditório: cinema. Telão com palco e púlpito, holofotes, cartazes e
  // arandelas nas paredes, plateia em dois blocos com corredor no meio,
  // bilheteria e pipoca na entrada.
  auditorio: () => [
    // Fios de lâmpadas nos cantos do fundo e na parede da esquerda.
    ["circus_c24_hanginglights", 1, 0, 0, 1], ["circus_c24_hanginglights", 12, 0, 0, 1],
    ["circus_c24_hanginglights", 0, 3, 2, 1], ["circus_c24_hanginglights", 0, 7, 2, 1],
    ["cine_screen", 4, 0, 0], ["cine_light2", 1, 0, 4, 0, 0.4], ["cine_light2", 12, 0, 4, 0, 0.4],
    // Palco onde se pisa e se põe coisas (no Habbo o cine_platform é assento):
    // altura 1,15, que se sobe direto do chão (degrau do Habbo: até 1,5).
    ["classic7_stage", 5, 1, 0], ["classic7_stage", 7, 1, 0], ["uni_lectern", 8, 2, 0, 0, 1.15],
    ["spotlight", 3, 1, 2], ["spotlight", 10, 1, 6],
    ["cine_pstr_1", 0, 3, 2, 0, 0.6], ["cine_pstr_6", 0, 7, 2, 0, 0.6],
    ["cine_light2", 0, 1, 2, 0, 0.4], ["cine_light2", 0, 5, 2, 0, 0.4], ["cine_light2", 0, 9, 2, 0, 0.4],
    ...[5, 6, 8, 9].flatMap((y) => [2, 3, 4, 5, 8, 9, 10, 11].map((x) => ["theatre_seat", x, y, 0])),
    ["cine_ticket_booth", 1, 10, 0], ["cine_popcorn", 12, 10, 4], ["cine_vipsign", 13, 8, 0],
    ["cine_projector", 13, 6, 6], ["theatre_plant", 0, 11, 0], ["theatre_plant", 13, 11, 0],
  ],
  // Jogos: fliperama. Máquinas lado a lado no fundo e na lateral, sinuca e
  // pebolim no meio, sofá de pufes com videogame, máquinas de lanche.
  jogos: () => [
    // Fios de lâmpadas de parque sobre as máquinas.
    ["circus_c24_hanginglights", 2, 1, 0, 1], ["circus_c24_hanginglights", 6, 1, 0, 1], ["circus_c24_hanginglights", 10, 1, 0, 1],
    ["circus_c24_hanginglights", 0, 6, 2, 1],
    ["tokyo_c18_retroarcade", 0, 0, 4], ["tokyo_c18_racearcade", 1, 0, 0], ["arcade_c23_space", 2, 0, 4], ["arcade_c23_cyberpunk", 3, 0, 4],
    ["graffiti_r24_arcademachine", 4, 0, 0], ["arcade_c23_vrmachine", 5, 0, 0], ["arcade_c23_pinball", 6, 0, 0],
    ["rainyday_c20_retrogames", 8, 0, 0], ["vwave_r21_jukebox", 9, 0, 4],
    ["olympics_r16_vendingmchn", 10, 0, 4], ["olympics_r16_vendingmchn", 11, 0, 4],
    ["arcade_c23_pinball", 0, 2, 2], ["tokyo_c18_retroarcade", 0, 4, 2], ["arcade_c23_space", 0, 5, 2],
    ["bling15_pooltable", 3, 4, 4], ["ads_aftv_footballtable", 7, 3, 0],
    ["rainyday_c20_retrogames", 0, 7, 2], ["rainyday_c20_retrogames", 0, 8, 2],
    ["cubie_beanbag_b", 2, 7, 6], ["cubie_beanbag_p", 2, 8, 6],
    ["gaming_c18_rigpro", 8, 8, 0], ["studio_chair", 8, 9, 0], ["studio_chair", 10, 9, 0],
    ["computer_flatscreen", 8, 8, 4, 0, 1.15], ["computer_flatscreen", 10, 8, 4, 0, 1.15],
    ["cubie_beanbag_b", 8, 6, 0], ["cubie_beanbag_p", 9, 6, 0],
    ["edice", 6, 6, 0, 1], ["edicehc", 7, 7, 0, 1],
  ],
  // Foco: biblioteca silenciosa. Estantes na lateral, prateleiras de
  // parede e mesas de estudo com luminária no fundo, mesa de leitura no meio
  // e um canto de poltronas.
  foco: () => [
    // Plantas penduradas entre as mesas, viga com hera e hera na parede.
    ["easter_c18_hangingplant", 1, 1, 0, 1], ["easter_c18_hangingplant", 5, 1, 0, 1], ["easter_c18_ivybeam", 8, 1, 2, 1],
    ["easter_c22_hangingvines", 0, 6, 2, 1], ["easter_c22_hangingvines", 0, 7, 2, 1],
    // Estantes cheias de livros, da altura da parede (a da biblioteca
    // clássica passava do teto; a de madeira escura é vazia).
    ["shelves_silo", 0, 0, 2], ["shelves_silo", 0, 2, 2], ["shelves_silo", 0, 4, 2],
    // Prateleiras de livros na parede, em fila sobre as mesas de estudo (a
    // estante de parede alta do acervo não cabia na altura da parede).
    ...[2, 3, 4, 5, 6, 7].map((x) => ["waasa_wall_shelf1", x, 0, 4, 0, 1.6]),
    ...[2, 4, 6].flatMap((x) => [["rainyday_c20_woodendesk", x, 0, 4], ["hygge_c25_desklamp", x, 0, 0, 0, 1], ["classic9_chair", x, 1, 0]]),
    ["exe_globe", 8, 0, 0], ["shelves_silo", 9, 0, 4],
    ["classic9_table", 4, 4, 0], ["classic9_light", 4, 4, 0, 0, 0.7], ["bookpile", 5, 5, 0, 0, 0.7],
    ["classic9_chair", 3, 4, 2], ["classic9_chair", 3, 5, 2], ["classic9_chair", 6, 4, 6], ["classic9_chair", 6, 5, 6],
    ["hygge_c25_carpet", 8, 4, 0], ["hygge_c18_chair", 8, 5, 2], ["lodge_dark_endtable", 9, 5, 0], ["bookpile", 9, 5, 0, 0, 0.9], ["hygge_c18_chair", 10, 5, 6],
    ["rainyday_c19_lamp", 10, 3, 0],
    ["classic9_plant", 0, 8, 0], ["bookpile", 1, 8, 0], ["classic9_plant", 10, 8, 0],
  ],
  // Academia: esteiras viradas para a parede, armários, halteres e
  // anilhas, colchonetes e cama elástica, balcão com suplementos.
  academia: () => [
    // Hera na parede da esquerda.
    ["easter_c22_hangingvines", 0, 1, 2, 1], ["easter_c22_hangingvines", 0, 2, 2, 1],
    ["matic_water_dispenser", 0, 0, 4],
    ...[1, 2, 3, 4].map((x) => ["olympics_c16_treadmill", x, 0, 0]),
    ...[6, 7, 8].map((x) => ["school_locker_b_nosale", x, 0, 4]), ["school_locker_r_nosale", 9, 0, 4], ["school_locker_r_nosale", 10, 0, 4],
    ["olympics_c16_weightrack", 11, 0, 0],
    ["olympics_c16_weightrack", 0, 3, 2], ["uni_dumbells", 0, 4, 2], ["uni_dumbells", 0, 5, 2], ["olympics_c16_sofa", 0, 7, 2],
    ["olympics_c16_softmat", 2, 3, 0], ["olympics_c16_softmat", 2, 6, 0],
    ["olympics_c16_trampoline", 6, 4, 0], ["olympics_c16_trampoline", 7, 4, 0],
    // Campinho de futebol do Habbo: chute parando em cima da bola, gol pela
    // frente da trave, placar da cor da trave.
    ["fball_goal_b", 4, 1, 2], ["fball_goal_r", 11, 1, 6], ["fball_ball", 8, 2, 0],
    ["fball_score_b", 5, 0, 4], ["fball_score_r", 11, 4, 4],
    ["olympics_c16_softmat", 5, 6, 0], ["uni_dumbells", 7, 7, 0],
    ["olympics_c16_counter", 9, 7, 4], ["uni_brotein", 9, 7, 0, 0, 1.2], ["olympics_c16_chair", 9, 6, 4],
    ["matic_tree_green", 0, 9, 0], ["theatre_plant", 11, 5, 0],
  ],
  // Produção: estúdio. Set de entrevista no piso iluminado com câmera e
  // luzes; ilha de edição no fundo; mesa de som com banquetas; caixas de
  // equipamento.
  producao: () => [
    // Fios de lâmpadas no fundo e varal de luzinhas na parede da esquerda.
    ["circus_c24_hanginglights", 2, 0, 0, 1], ["circus_c24_hanginglights", 6, 0, 0, 1], ["xmas_c22_hangingwalllights", 0, 2, 2, 1],
    ["studio_floorlight", 1, 1, 0],
    ["mafia_c26_armchair_white", 1, 2, 2], ["hc26_3", 2, 2, 0], ["mafia_c26_armchair_white", 4, 2, 6],
    // Refletores de chão (as treliças de luz do acervo passavam do teto).
    ["studio_camera", 2, 6, 0], ["spotlight", 0, 5, 2], ["spotlight", 5, 5, 6], ["spotlight", 5, 0, 6], ["spotlight", 0, 0, 2],
    ...[8, 10, 12].flatMap((x) => [["hc_exe_wrkdesk", x, 0, 4], ["army_c15_leatherchr", x, 1, 0]]),
    ["studio_mixingdesk", 8, 4, 0], ...[8, 9, 10, 11, 12].map((x) => ["studio_stool", x, 5, 0]),
    ["gaming_c18_rigpro", 9, 8, 0], ["studio_chair", 10, 9, 0],
    ["army_c15_crate", 13, 9, 4], ["army_c15_crate", 13, 10, 4], ["army_c15_crate", 13, 9, 4, 0, 1],
    // Espera de clientes e convidados, encostada na parede da esquerda.
    ["mafia_c26_sofa_dark", 0, 7, 2], ["mafia_c26_coffeetable_dark", 1, 7, 0], ["mafia_c26_drinktray", 1, 8, 0, 0, 0.84],
    ["theatre_plant", 0, 10, 0], ["theatre_plant", 13, 2, 0],
  ],
};
// Presença trafega em porcentagem (6–94) no Worker; aqui vira ladrilho. A
// escala é sempre a do mapa geral (80 × 80): dentro de um quarto a posição
// é local (0 … L) e vai com a mesma conta, e a zona diz em que quarto é.
function escritorioParaMapa(px, py) {
  const P = ESCRITORIO_PLANTA;
  return { x: ((Number(px) - 6) / 88) * P.W, y: ((Number(py) - 6) / 88) * P.H };
}
function escritorioParaPorcentagem(x, y) {
  const P = ESCRITORIO_PLANTA, lim = (n) => Math.max(6, Math.min(94, n));
  return { x: lim(6 + (x / P.W) * 88), y: lim(6 + (y / P.H) * 88) };
}
// Cena em que a pessoa está: null no mapa geral; o id do quarto (sala-N)
// dentro de um quarto. O cliente define ao entrar e sair.
let ESCRITORIO_QUARTO = null;
function escritorioDefinirQuarto(id) {
  ESCRITORIO_QUARTO = id || null;
}
function escritorioQuartoAtual() {
  return ESCRITORIO_QUARTO;
}
// Ambiente do ladrilho na cena atual: dentro de uma sala, só ela. Na Praça
// (cena de abertura) não há ambiente: a zona fica vazia, sem voz, como era
// o corredor.
function escritorioAmbienteEm(x, y) {
  const q = ESCRITORIO_QUARTO;
  if (!q || typeof escritorioAmbienteDoQuarto !== "function") return null;
  const a = escritorioAmbienteDoQuarto(q);
  return a && x >= a.x0 && y >= a.y0 && x < a.x1 && y < a.y1 ? a : null;
}
// Cena de abertura (a Praça), no formato de planta do quarto.
function escritorioPlantaGeral() {
  return escritorioPlantaDoQuarto(ESCRITORIO_PRACA);
}
// Móveis de um espaço comum (coordenadas locais da cena). Definidos em
// ESCRITORIO_MOVEIS_CENAS, mais abaixo; a cena sem lista fica vazia.
function escritorioMoveisDaCena(a) {
  const f = typeof ESCRITORIO_MOVEIS_CENAS !== "undefined" && ESCRITORIO_MOVEIS_CENAS[a.id];
  // (a Praça também tem a sua lista: é o padrão da camada "geral")
  return f ? f().map(([classe, x, y, dir = 2, estado = 0, altura = 0]) => [classe, x, y, dir, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura]) : [];
}
// Espaço comum com cena própria (Café, Lounge…), pelo id da zona.
function escritorioCenaComum(id) {
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.cena && a.id === id) || null;
}
// Paredes do quarto (cena própria, coordenadas locais): as duas do fundo
// altas na cor da sala; as da frente baixas, de vidro, com o vão da porta.
function escritorioModeloPlanta(a) {
  // Cena de espaço comum: a planta vem no próprio ambiente.
  if (a?.modelo) return a.modelo;
  const p = typeof escritorio !== "undefined" ? escritorio.base?.quartos?.plantas?.find(p => p.id === a.planta) : null;
  // Planta desenhada pelo dono: a da edição em curso ou a salva no perfil.
  const e = typeof escritorio !== "undefined" ? escritorio.edicao : null;
  return escritorioPlantaLivre(p, e && e.camada === a.id && e.celdas !== undefined ? e.celdas : a.celdasLivres);
}
// Mesma regra do servidor (plantaQuarto): 12 × 12 códigos sobre a planta;
// "0" mantém, "v" tira o piso, "p" piso no chão, "1"/"2" patamares. Porta
// e escada ficam como na planta.
const ESCRITORIO_CELDAS_LIVRES = /^[0vp12]{144}$/;
const escritorioPlantasLivres = new Map();
function escritorioLadrilhoFixo(p, x, y) {
  const h = p.celdas.length, w = p.celdas[0].length;
  return (p.escada || []).some(([ex, ey]) => ex === x && ey === y)
    || (y === h - 1 && x >= p.portas.baixo && x <= p.portas.baixo + 1)
    || (x === w - 1 && y >= p.portas.direita && y <= p.portas.direita + 1);
}
function escritorioPlantaLivre(p, livres) {
  if (!p || !ESCRITORIO_CELDAS_LIVRES.test(String(livres || "")) || !/[^0]/.test(livres)) return p;
  const chave = p.id + ":" + livres;
  if (!escritorioPlantasLivres.has(chave)) {
    if (escritorioPlantasLivres.size > 40) escritorioPlantasLivres.clear();
    const cod = { v: -1, p: 0, 1: 1, 2: 2 };
    escritorioPlantasLivres.set(chave, { ...p, celdas: p.celdas.map((linha, y) => linha.map((n, x) => { const c = livres[y * 12 + x]; return c === "0" || escritorioLadrilhoFixo(p, x, y) ? n : cod[c]; })) });
  }
  return escritorioPlantasLivres.get(chave);
}
// Tamanho do quarto (a planta escolhida: de 6 × 6 a 12 × 12); sem planta,
// o 8 × 8 da primeira versão.
const ESCRITORIO_QUARTO_MAX = 12;
function escritorioDimQuarto(a) {
  const c = escritorioModeloPlanta(a)?.celdas;
  return c ? { w: c[0].length, h: c.length } : { w: ESCRITORIO_SALA_LADO, h: ESCRITORIO_SALA_LADO };
}
// Vão da porta (2 ladrilhos): embaixo, no meio da última linha; à direita,
// no trecho de piso da última coluna. Vem da planta; sem ela, o meio.
function escritorioPortaQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), p = escritorioModeloPlanta(a)?.portas;
  return a.porta === "direita" ? { x: w - 1, y: p?.direita ?? h / 2 - 1, lado: "direita" } : { x: p?.baixo ?? w / 2 - 1, y: h - 1, lado: "baixo" };
}
function escritorioNivelQuarto(a, x, y) {
  const { w, h } = escritorioDimQuarto(a);
  if (x < 0 || y < 0 || x >= w || y >= h) return -1;
  return escritorioModeloPlanta(a)?.celdas[Math.floor(y)]?.[Math.floor(x)] ?? 0;
}
// A escada ocupa um ladrilho no percurso, mas tem quatro degraus visíveis.
// A direção é derivada do patamar alto, inclusive nas alas laterais.
function escritorioEscadaQuarto(a,x,y) {
  const p=escritorioModeloPlanta(a), ix=Math.floor(x), iy=Math.floor(y);
  if(!p?.escada?.some(([ex,ey])=>ex===ix && ey===iy)) return null;
  // O patamar alto de um lado e o piso do outro: o vizinho alto que fica ao
  // lado da escada (o canto do mezanino) não define o sentido da subida.
  const lados=[[0,-1],[0,1],[-1,0],[1,0]].filter(([dx,dy])=>escritorioNivelQuarto(a,ix+dx,iy+dy)===2);
  const alto=lados.find(([dx,dy])=>escritorioNivelQuarto(a,ix-dx,iy-dy)===0) || lados[0];
  return alto ? {x:ix,y:iy,dx:alto[0],dy:alto[1]} : null;
}
function escritorioAlturaQuarto(a,x,y) {
  const e=escritorioEscadaQuarto(a,x,y);
  if(!e) return Math.max(0,escritorioNivelQuarto(a,x,y));
  const f=e.dx ? x-Math.floor(x) : y-Math.floor(y);
  return 2*((e.dx || e.dy)>0 ? f : 1-f);
}
function escritorioParedesDoQuarto(a) {
  // Ao ar livre (Praça): sem paredes; as bordas são sebes e floreiras. Quarto
  // "maquete" (escolha do dono): sem paredes, para construir as suas com
  // móveis, como os construtores do Habbo fazem.
  if (escritorioModeloPlanta(a)?.semParedes || a.semParedes) return [];
  const lista = [], { w, h } = escritorioDimQuarto(a), pt = escritorioPortaQuarto(a);
  const por = (x0,y0,x1,y1,alta) => {
    const r=[x0,y0,x1,y1];
    if(alta) {r.push(a.cor); r.sala=a.id; r.alt=118; if(a.cena) {r.textura=a.texturaParede; r.semTinta=true;}} else r.baixa=true;
    lista.push(r);
  };
  for(let x=0;x<w;x++) for(let y=0;y<h;y++) {
    if(escritorioNivelQuarto(a,x,y)<0) continue;
    if(escritorioNivelQuarto(a,x,y-1)<0) por(x,y,x+1,y,true);
    if(escritorioNivelQuarto(a,x-1,y)<0) por(x,y,x,y+1,true);
    if(!escritorioModeloPlanta(a)?.bordaAberta && escritorioNivelQuarto(a,x,y+1)<0 && !(pt.lado==="baixo" && y===pt.y && x>=pt.x && x<pt.x+2)) por(x,y+1,x+1,y+1,false);
    if(!escritorioModeloPlanta(a)?.bordaAberta && escritorioNivelQuarto(a,x+1,y)<0 && !(pt.lado==="direita" && x===pt.x && y>=pt.y && y<pt.y+2)) por(x+1,y,x+1,y+1,false);
  }
  const grupos=new Map();
  for(const r of lista) {
    const horizontal=r[1]===r[3],chave=[horizontal,horizontal?r[1]:r[0],Boolean(r.baixa)].join(":");
    if(!grupos.has(chave)) grupos.set(chave,[]);grupos.get(chave).push(r);
  }
  const unidas=[];
  for(const grupo of grupos.values()) {
    const h=grupo[0][1]===grupo[0][3];grupo.sort((a,b)=>a[h?0:1]-b[h?0:1]);
    for(const r of grupo) {
      const ultimo=unidas.at(-1);
      if(ultimo && grupo.includes(ultimo) && ultimo[h?2:3]===r[h?0:1]) ultimo[h?2:3]=r[h?2:3];
      else unidas.push(r);
    }
  }
  for(const trecho of escritorioModeloPlanta(a)?.divisorias || []) {const r=[...trecho];r.baixa=true;unidas.push(r);}
  return unidas;
}
// Peças fixas da planta (não são do dono, não entram no inventário nem no
// editor): a escada do acervo em cada ladrilho de escada, subindo para o
// mezanino, e a balaustrada na borda do mezanino onde há queda para o piso.
// [classe, x, y, dir, estado, altura]. As duas se atravessam (MAPA_PASSAVEIS).
const ESCRITORIO_PECA_ESCADA = "bc_stairs_recolorable", ESCRITORIO_PECA_GUARDA = "hotel_c18_rail";
// Direção da peça de escada pelo lado em que fica o patamar alto.
const ESCRITORIO_DIR_ESCADA = { "0,-1": 4, "0,1": 0, "-1,0": 2, "1,0": 6 };
function escritorioPecasDoQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), pecas = [];
  for (const [x, y] of escritorioModeloPlanta(a)?.escada || []) {
    const e = escritorioEscadaQuarto(a, x, y);
    if (e) pecas.push([ESCRITORIO_PECA_ESCADA, x, y, ESCRITORIO_DIR_ESCADA[e.dx + "," + e.dy] ?? 4, 0, 0]);
  }
  // Borda da frente (+y) e da direita (+x) do mezanino: ali o patamar cai
  // para o piso de baixo e a queda fica à vista de quem olha.
  const alto = (x, y) => escritorioNivelQuarto(a, x, y) === 2;
  const cai = (x, y) => { const n = escritorioNivelQuarto(a, x, y); return n === 0; };
  for (let y = 0; y < h; y++) for (let x = 0; x + 1 < w; x++)
    if (alto(x, y) && alto(x + 1, y) && cai(x, y + 1) && cai(x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x, y + 0.5, 4, 0, 0]); x++; }
  for (let x = 0; x < w; x++) for (let y = 0; y + 1 < h; y++)
    if (alto(x, y) && alto(x, y + 1) && cai(x + 1, y) && cai(x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x + 0.5, y, 2, 0, 0]); y++; }
  return pecas;
}
// Planta do quarto de uma sala: só o quarto, a soleira da porta (fora dele;
// pisar nela volta ao mapa) e o escuro em volta, como num quarto do Habbo.
// Luz ambiente do quarto, como o regulador de luz do Habbo. Os ids batem com
// LUZES_SALA_ESCRITORIO do servidor; a cor da amostra é só para o botão.
const ESCRITORIO_LUZES_SALA = [["", "Normal", "#f4f1e8"], ["quente", "Quente", "#ffc27a"], ["fria", "Fria", "#9cc8ff"], ["rosa", "Rosa", "#ff9ccd"], ["roxa", "Roxa", "#b79cff"], ["verde", "Verde", "#9be3a8"], ["noite", "Noite", "#3b4a7a"]];
function escritorioPlantaDoQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), pt = escritorioPortaQuarto(a);
  const soleira = pt.lado === "baixo" ? { x: pt.x, y: h, w: 2, h: 1 } : { x: w, y: pt.y, w: 1, h: 2 };
  const naSoleira = (x, y) => x >= soleira.x && x < soleira.x + soleira.w && y >= soleira.y && y < soleira.y + soleira.h;
  return {
    W: w + 1, H: h + 1, PREDIO: null, PISO: ESCRITORIO_PLANTA.PISO, quarto: a.id, fixa: true,
    ambientes: [{ ...a, x1: a.x0 + w, y1: a.y0 + h }], divisorias: escritorioParedesDoQuarto(a), moveis: [], fixos: escritorioPecasDoQuarto(a), piscina: null, quadros: [], corredores: [], postes: [], letreiro: null,
    // Trechos de piso do acervo (só a Praça tem: gramado, deck, lago…).
    pisos: [], texturas: a.texturas || [], texturaSalas: ESCRITORIO_PLANTA.texturaSalas, portas: [], elevadores: [], fundo: null, vistas: {},
    // Luz ambiente escolhida pelo dono (tinge piso, paredes, móveis e bonecos).
    luz: a.luz || "",
    rotulos: [{ texto: "Porta · " + escritorioDestinoDaPorta(a.id).nome, x: soleira.x + soleira.w / 2, y: soleira.y + soleira.h / 2, saida: true }],
    soleiras: [soleira], entrada: escritorioEntradaDaSala(a), saida: { x: soleira.x, y: soleira.y },
    // Só se anda dentro do quarto e na soleira.
    andavel: (x, y) => escritorioNivelQuarto(a,x,y) >= 0 || naSoleira(x, y),
    nivelEm: (x,y) => Math.max(0,escritorioNivelQuarto(a,x,y)),
    alturaEm: (x,y) => escritorioAlturaQuarto(a,x,y), escadaEm: (x,y) => escritorioEscadaQuarto(a,x,y),
  };
}
// Aonde leva a porta de cada cena: das salas para a Convivência; da
// Convivência para a Praça; da Praça de volta para a Convivência.
function escritorioDestinoDaPorta(id) {
  if (id === "recepcao") return ESCRITORIO_PRACA;
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "recepcao");
}
// Praça e corredores são convivência.
function escritorioSalaEm(x, y) {
  return escritorioAmbienteEm(x, y)?.sala || "convivencia";
}
// Coordenadas locais da sala: lx/ly contam do canto do fundo (x0, y0; hoje
// 0, 0, porque o quarto é uma cena própria). A mobília é desenhada no mesmo
// sentido em todas as salas; só a porta muda de lado (embaixo ou à direita).
function escritorioNaSala(a, lx, ly) {
  return { x: a.x0 + lx, y: a.y0 + ly };
}
function escritorioDirNaSala(a, dir) {
  return dir;
}
// Ladrilho logo depois da porta, dentro da sala (onde se chega ao entrar).
function escritorioEntradaDaSala(a) {
  const pt = escritorioPortaQuarto(a);
  return pt.lado === "direita" ? { x: pt.x - 1, y: pt.y } : { x: pt.x, y: pt.y - 1 };
}
// Mesa de trabalho: no meio do fundo da sala, com o dono sentado atrás dela,
// virado para a sala (e para quem olha o mapa). Na sala com porta à direita
// a planta gira: a mesa fica junto da parede alta da esquerda.
function escritorioMesaDaSala(a) {
  if (a.porta === "direita") return { x: a.x0 + 2, y: a.y0 + 2, w: 2, h: 3, cadeira: { x: a.x0 + 1, y: a.y0 + 3, dir: 2 } };
  return { x: a.x0 + 2, y: a.y0 + 2, w: 3, h: 2, cadeira: { x: a.x0 + 3, y: a.y0 + 1, dir: 4 } };
}
// Mobília de cada sala (8 × 8): a mesa é a mesma em todas (exe_table, onde o
// E abre o painel), o resto acompanha a ala. A ordem segue DONOS_ESCRITORIO
// em server/escritorio-mapa.js: Paulo, Vinícius e Ewerton atendem clientes;
// Deivid, Bia e Jady criam; Mizinho, Taynara e Reriston produzem.
// Regras: itens de parede só nas paredes altas (as duas do fundo do quarto);
// móveis com a frente para dentro da sala; a faixa da porta livre; pelo
// menos três objetos animados por sala.
const ESCRITORIO_TEMAS_SALAS = ["atendimento", "atendimento", "atendimento", "criacao", "criacao", "criacao", "producao", "producao", "producao"];
function escritorioMoveisDaSala(a, temaEscolhido) {
  const tema = temaEscolhido || ESCRITORIO_TEMAS_SALAS[Number(String(a.id).split("-")[1])] || "atendimento";
  const direita = a.porta === "direita";
  // Sala com porta à direita: a planta local é espelhada na diagonal (x ↔ y)
  // e as direções giram junto, para a mesa ficar junto da parede alta.
  const giro = { 0: 6, 2: 4, 4: 2, 6: 0 };
  const item = (classe, lx, ly, dir, estado = 0, altura = 0, parede = false) => {
    let x = lx, y = ly, d = dir;
    if (direita) { x = ly; y = lx; d = parede ? (dir === 4 ? 2 : 4) : (giro[dir] ?? dir); }
    return [classe, a.x0 + x, a.y0 + y, d, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura];
  };
  // Na parede alta do fundo (dir 4; vira a da esquerda na sala espelhada).
  const naParede = (classe, lx, estado, altura) => item(classe, lx, 0, 4, estado, altura, true);
  // Uma sala do Habbo é cheia: a mobília encosta nas paredes do fundo e da
  // esquerda (as que aparecem por trás), o meio fica livre para andar, e os
  // detalhes pequenos (xícara fumegando, livros, lixeira, abajur) dão vida.
  // A faixa da porta (3–4, 6–7) e os corredores de cada lado da mesa
  // (coluna 1 e coluna 5) ficam livres.
  const base = [
    item("exe_table", 2, 2, 0),
    // Padrão do Habbo: a frente de todo móvel vira para quem olha o mapa
    // (direções 4 e 2). Monitor com a tela à mostra; quem senta fica atrás
    // da mesa, também de frente para quem olha.
    item("computer_flatscreen", 3, 2, 4, 1, 0.95),
    item("darkmodern_c20_folder", 2, 3, 2, 0, 0.95),
    // Xícara de chá fumegando na mesa (animada) e a lixeira de papel ao lado.
    item("ktchn10_tea", 3, 3, 2, 1, 0.95),
    item("ktchn_trash", 4, 1, 0),
    // Visitas de frente para a mesa, sobre o tapete; planta no canto do fundo.
    item("exe_rug", 2, 4, 0),
    item("exe_plant", 0, 0, 0),
    // Gaveteiro com livros embaixo da janela; estante baixa na parede da
    // esquerda com cacto e livros em cima; luminária de chão ao lado.
    item("jp_drawer", 1, 0, 4), item("books_0", 1, 0, 2, 0, 1),
    item("cubie_shelf_2_p", 0, 1, 2), item("plant_small_cactus", 0, 1, 0, 0, 1.05), item("books_1", 0, 2, 2, 0, 1.05),
    item("modern_c17_floorlamp", 0, 3, 2, 1),
    // Mesinha de canto na direita (cada ala põe uma coisa em cima).
    item("modern_c17_endtable", 7, 2, 0),
    naParede("window_double_default", 1, 0, 1.0),
    naParede("hc_wall_lamp", 5, 1, 1.3),
  ];
  const temas = {
    // Executivo: poltrona alta, visitas de couro, sofá, globo, telefone,
    // impressora, flores na mesinha, quadro e relógio na parede.
    atendimento: [
      item("hc_exe_chair2", 3, 1, 4), item("js_exe_chair", 2, 5, 0), item("js_exe_chair", 4, 5, 0),
      // Sofá encostado no fundo, de frente para a sala (de costas, só se via o
      // encosto); globo junto da parede da esquerda.
      item("exe_sofa", 5, 0, 4), item("exe_globe", 0, 5, 0), item("exe_c15_telephone", 4, 3, 2, 1, 0.95),
      item("exe_c15_printer", 0, 6, 2, 1), item("bohogarden_c21_snakeplant", 7, 6, 2),
      item("giftflowers", 7, 2, 2, 0, 1.3),
      naParede("pixel_clock_black", 6, 0, 1.4), naParede("attic15_painting", 7, 0, 1.1),
    ],
    // Criação: cadeira moderna, mesa digitalizadora, pufes, sofá compacto,
    // tela inteligente, letreiro de neon, luz de chão e abajur na mesinha.
    criacao: [
      item("modern_c17_chair", 3, 1, 4), item("cubie_beanbag_b", 2, 5, 0), item("cubie_beanbag_p", 4, 5, 0),
      item("art_c20_drawingtablet", 4, 2, 0, 2, 0.95),
      item("icedblk_c16_sofa", 5, 0, 4), item("modern_c17_iscreen", 7, 0, 0, 1),
      item("tokyo_c18_neonsign1", 0, 6, 2, 1), item("darkmodern_c20_floorlight", 7, 5, 2, 7),
      item("modern_c17_plant", 7, 7, 2), item("darkmodern_c20_neonlight", 6, 7, 0),
      item("modern_c17_lamp", 7, 2, 0, 1, 1.3),
      naParede("pixel_clock_black", 6, 0, 1.4), naParede("pixel_painting_red", 7, 0, 1.2),
    ],
    // Produção: cadeira de estúdio, segundo monitor, caixas de som, rádio na
    // prateleira, revistas na mesinha, pilha de livros e o disco na parede.
    producao: [
      item("studio_chair", 3, 1, 4), item("studio_chair", 2, 5, 0), item("studio_chair", 4, 5, 0),
      // Prateleira baixa no fundo com o rádio em cima; caixas de som na parede
      // da direita com a frente para a sala. (A grua de câmera saiu: o braço
      // dela cruzava a janela e a mesa numa sala de 8×8.)
      item("hygge_c25_desklamp", 4, 3, 2, 1, 0.95), item("uni_laptop", 2, 2, 0, 0, 0.95),
      item("cubie_shelf_2_p", 6, 0, 0), item("hc_radio", 6, 0, 4, 1, 1.05),
      item("darkmodern_c20_speakers", 7, 3, 0), item("darkmodern_c20_speakers", 7, 5, 0),
      item("darkmodern_c20_reads", 7, 2, 0, 0, 1.3), item("bookpile", 0, 5, 0),
      item("bohogarden_c21_snakeplant", 0, 6, 2),
      naParede("uni_vinyl", 7, 0, 1.6),
    ],
  };
  return [...base, ...(temas[tema] || temas.atendimento)];
}
