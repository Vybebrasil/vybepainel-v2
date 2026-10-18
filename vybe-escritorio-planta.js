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
    ["recepcao", "Convivência", "convivencia", "#ff8a35", 20, 18, "suncity_c19_floor", "ducket_c25_wall"],
    ["reuniao", "Sala de reunião", "reuniao", "#5aa9ff", 18, 14, "lodge_c15_floor", "lodge_dark_brickwall"],
    ["auditorio", "Auditório", "reuniao", "#6b4fa0", 20, 16, "cine_tile", "attic15_wall"],
    ["producao", "Produção", "producao", "#4a5560", 20, 14, "rainyday_c20_woodenfloor", "attic15_wall"],
    ["cafe", "Café", "convivencia", "#d9a066", 14, 16, "bathroom_floortile1", "art_c20_wall"],
    ["jogos", "Jogos", "convivencia", "#3fae7a", 20, 12, "tokyo_c18_floor", "attic15_wall"],
    ["foco", "Foco", "foco", "#8b6b4a", 12, 16, "rainyday_c20_woodenfloor", "gardenshed_wall"],
    ["academia", "Academia", "convivencia", "#7a8494", 20, 16, "sb_tile", "attic15_wall"],
    ["lounge", "Lounge", "convivencia", "#b4583a", 18, 15, "rainyday_c20_woodenfloor", "lodge_dark_brickwall"],
  ];
  // Planta de cada cena, linha a linha (y = 0 é a parede do fundo): "x" sem
  // piso, "0" chão, "1" e "2" patamares de um e dois degraus (o degrau do
  // Habbo sobe direto; de 0 para 2 não se passa). Como nos quartos do Habbo,
  // recorte no fundo ou à esquerda vira canto de parede; à direita e na
  // frente fica aberto. A porta é o par de ladrilhos do meio da última linha.
  const PLANTAS_CENAS = {
    // Saguão: estar elevado no canto do fundo e frente chanfrada. Sem recorte
    // no fundo à direita: a parede recuada esconderia o piso atrás dela.
    recepcao: { corDegrau: "#c9b79a", planta: [
      "11111110000000000000",
      "11111110000000000000",
      "11111110000000000000",
      "11111110000000000000",
      "11111110000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "0000000000000000000x",
      "000000000000000000xx",
      "00000000000000000xxx",
    ] },
    // Sala executiva em L: a mesa de reunião no patamar do fundo, a lareira e o
    // bar embaixo.
    reuniao: { corDegrau: "#6b4428", planta: [
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
    ] },
    // Cinema: cantos do fundo recolhidos ao lado da tela e plateia em degraus até o
    // saguão da entrada, no alto (a última linha desce um degrau para a porta).
    auditorio: { corDegrau: "#7a5aa8", planta: [
      "xx000000000000000000",
      "xx000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "11111111111111111111",
      "11111111111111111111",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "11111111111111111111",
    ] },
    // Estúdio em L: ilha de edição no recuo do fundo, set iluminado no patamar à
    // direita, mesa de som e espera na frente.
    producao: { corDegrau: "#2c3238", planta: [
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "00000000000011111111",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
    ] },
    // Cafeteria funda, com a frente recolhida à direita.
    cafe: { planta: [
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "00000000000000",
      "0000000000xxxx",
      "0000000000xxxx",
      "0000000000xxxx",
      "0000000000xxxx",
      "0000000000xxxx",
    ] },
    // Fliperama largo, com a frente recolhida à direita.
    jogos: { planta: [
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
    ] },
    // Biblioteca funda: galeria de leitura no patamar do fundo.
    foco: { corDegrau: "#5a4430", planta: [
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000xxx",
      "000000000xxx",
      "000000000xxx",
      "000000000xxx",
    ] },
    // Academia: aparelhos no patamar do fundo (recuado à direita) e a quadra de
    // futebol na frente.
    academia: { corDegrau: "#4f5866", planta: [
      "11111111111111111111",
      "11111111111111111111",
      "11111111111111111111",
      "11111111111111111111",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
    ] },
    // Taverna em L (referência do Paulo, 18/10/2026): recorte no fundo à
    // esquerda (seguro: não esconde piso), bar no fundo com piso xadrez,
    // palco do bardo dois degraus acima no fundo à direita (degrau de pedra
    // na frente; o corrimão sai sozinho na lateral), salão de tapete vermelho
    // e chanfro na frente à direita.
    lounge: { corDegrau: "#4a2a1c", planta: [
      "xxx000000000222222",
      "xxx000000000222222",
      "xxx000000000222222",
      "xxx000000000222222",
      "000000000000111111",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "00000000000000000x",
      "0000000000000000xx",
    ], texturas: [
      // Salão: tapete vermelho do bar até a porta.
      { x0: 3, y0: 5, x1: 12, y1: 15, textura: "theatre_carpet" },
      // Bar: xadrez preto e vermelho.
      ...Array.from({ length: 9 * 5 }, (_, k) => {
        const x = 3 + (k % 9), y = Math.floor(k / 9);
        return { x0: x, y0: y, x1: x + 1, y1: y + 1, textura: (x + y) % 2 ? "steampunk_floor1" : "theatre_carpet" };
      }),
    ] },
  };
  for (const [id, nome, sala, cor, w0, h0, textura, texturaParede] of CENAS) {
    // A planta da cena vem junto (não do catálogo dos quartos), com a porta
    // no meio da frente e sem parede na frente, como no Habbo.
    const def = PLANTAS_CENAS[id];
    const celdas = def ? def.planta.map((linha) => [...linha].map((c) => (c === "x" ? -1 : Number(c)))) : Array.from({ length: h0 }, () => Array(w0).fill(0));
    const w = celdas[0].length, h = celdas.length;
    const modelo = { id: "cena-" + id, celdas, portas: { baixo: Math.floor(w / 2) - 1 }, escada: def?.escada || [], bordaAberta: true };
    ambientes.push({ id, nome, sala, cena: true, semRotulo: true, x0: 0, y0: 0, x1: w, y1: h, piso: "madeira", porta: "baixo", cor, textura, texturaParede, modelo, corDegrau: def?.corDegrau, texturas: def?.texturas || [] });
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
  // Convivência: o saguão de todos, com a cara da Bahia em São João.
  // Estar da lareira no patamar do fundo à esquerda; recepção no meio do
  // fundo, sob a janela, com malas e o vira-lata caramelo; teleportes no
  // fundo à direita; fonte no centro sobre a pedra portuguesa em ondas, com
  // cactos e orquídeas; café na frente à esquerda (doces brasileiros nas
  // mesas); espera à direita. Bandeirinhas e lanternas de São João cruzam o
  // salão (desenhadas no alto: passa-se por baixo). O corredor da porta até
  // a recepção fica livre. A porta leva à Praça.
  recepcao: () => [
    // Estar elevado (um degrau): sofá de frente para as poltronas, lareira.
    ["mafia_c26_planter_white", 0, 0, 0], ["exe_map", 1, 0, 4, 0, 1.2],
    ["lodge_dark_fireplace", 0, 2, 2], ["mafia_c26_walllamp_white", 0, 4.2, 2, 0, 0.6],
    ["exe_rug", 2, 1, 0], ["hc_exe_sofa", 2, 1, 4], ["modern_c17_lowtable", 2, 2, 2], ["ktchn10_tea", 3, 2, 4, 0, 1],
    ["mafia_c26_armchair_white", 2, 3, 0], ["mafia_c26_armchair_white", 4, 3, 0], ["br_c25_caramelodog", 1, 3, 2],
    ["hween_c16_lamp", 5, 1, 0], ["exe_globe", 6, 1, 0], ["mafia_c26_planter_white", 6, 4, 0],
    // Recepção: janela com arandelas, balcão com computador e telefone, malas.
    ["mafia_c26_planter_white", 7, 0, 0], ["window_double_default", 9, 0, 4, 0, 0.9], ["mafia_c26_planter_white", 13, 0, 0],
    ["lodge_dark_desk", 9, 2, 0], ["modern_c17_chair", 10, 1, 4],
    ["computer_flatscreen", 9, 2, 0, 0, 1.25], ["exe_c15_desktidy", 10, 2, 0, 0, 1.25], ["exe_c15_telephone", 11, 2, 0, 0, 1.25],
    ["hc_luggage", 12, 2, 0], ["br_c25_festivallanterns", 10, 3, 0],
    // Fundo à direita: lanches, água e as cabines de teleporte (a escura forma par com a da Praça).
    ["olympics_r16_vendingmchn", 14, 0, 4], ["matic_water_dispenser", 15, 0, 4],
    ["mafia_c26_teleport_white", 16, 0, 4], ["mafia_c26_planter_white", 17, 0, 0], ["mafia_c26_teleport_dark", 18, 0, 4], ["bohogarden_c21_fanpalm", 19, 0, 0],
    // Fonte no meio da pedra portuguesa em ondas, três bancos virados para ela, cactos e orquídeas.
    ...[[7, 6], [9, 6], [11, 6], [7, 8], [9, 8], [11, 8], [7, 10], [9, 10], [11, 10]].map(([x, y]) => ["br_c25_wavymosaicfloor", x, y, 0]),
    ["bazaar_r17_fountain", 9, 8, 4], ["greek_c15_bench", 9, 11, 0], ["greek_c15_bench", 6, 8, 2], ["greek_c15_bench", 13, 8, 6],
    ["plant_big_cactus", 7, 6, 0], ["plant_big_cactus", 12, 6, 0], ["br_c25_orchids2", 8, 7, 0], ["br_c25_orchids", 11, 7, 0],
    // Café na frente à esquerda: mesinhas nos tapetes, doces e xícaras; o dado.
    ["dessertcafe_c17_rug", 1, 9, 0], ["dessertcafe_c17_rug", 1, 10, 0], ["dessertcafe_c17_rug", 1, 12, 0], ["dessertcafe_c17_rug", 1, 13, 0],
    ...[[2, 9], [2, 12], [5, 15]].flatMap(([x, y]) => [["paris_c15_table", x, y, 0], ["paris_c15_chair", x - 1, y, 2], ["paris_c15_chair", x + 1, y, 6]]),
    ["br_c25_sweetfood", 2, 9, 0, 0, 0.95], ["room_cof15_cup2", 2, 12, 0, 0, 0.95], ["br_c25_sweetfood", 5, 15, 0, 0, 0.95], ["edice", 7, 13, 0, 1],
    ["shelves_silo", 0, 6, 2], ["mafia_c26_planter_white", 0, 15, 0], ["exe_globe", 0, 17, 0],
    ["mafia_c26_walllamp_white", 0, 8.2, 2, 0, 0.6], ["mafia_c26_walllamp_white", 0, 11.2, 2, 0, 0.6],
    ["attic15_painting", 0, 13.4, 2, 0, 1], ["wallmirror", 0, 16, 2, 0, 1.4],
    ["easter_c22_hangingvines", 0, 9, 2, 1], ["easter_c22_hangingvines", 0, 10, 2, 1],
    // Espera à direita: sofá, mesinha com revistas, poltrona, abajur e a arara.
    ["js_exe_rug", 15, 8, 0], ["hc_exe_sofa", 18, 8, 6], ["mafia_c26_coffeetable_white", 17, 8, 0], ["mafia_c26_armchair_white", 15, 9, 2],
    ["magazines", 17, 8, 0, 0, 0.84], ["modern_c17_floorlamp", 18, 7, 0], ["br_c25_parrot4", 18, 11, 6],
    ["bohogarden_c21_fanpalm", 19, 6, 0], ["mafia_c26_planter_white", 18, 12, 0], ["mafia_c26_planter_white", 13, 16, 0],
    // Perto da porta: tapete de boas-vindas, vaso e orquídeas.
    ["carpet_soft_tut", 9, 15, 0], ["mafia_c26_planter_white", 7, 16, 0], ["br_c25_orchids2", 12, 16, 0],
    // Bandeirinhas de São João cruzando o salão (duas fileiras) e lanternas.
    ...[2, 4, 6, 8, 10, 12, 14, 16].map((x) => ["br_c25_festivalflags", x, 6, 2]),
    ...[2, 4, 6, 8, 10, 12, 14, 16].map((x) => ["br_c25_festivalflags", x, 13, 2]),
    ["br_c25_festivallanterns", 4, 10, 0], ["br_c25_festivallanterns", 16, 10, 0],
    // Fruteira de feira na frente à direita, banco de concreto com arara
    // entre os teleportes e a espera, arandelas ao lado da janela.
    ["br_c25_fruitstore", 15, 13, 4], ["br_c25_stonebench", 15, 4, 0], ["br_c25_parrot2", 17, 4, 4],
    ["mafia_c26_walllamp_white", 8.2, 0, 4, 0, 0.6], ["mafia_c26_walllamp_white", 12.2, 0, 4, 0, 0.6],
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
  // Café: cafeteria funda. Cozinha no fundo (geladeira, bancada com
  // eletrodomésticos e armários de parede), ilha com banquetas, mesa de
  // jantar no tapete, estar e mesinhas na frente.
  cafe: () => [
    ["mode_fridge", 0, 0, 0],
    ["hygge_c25_counter1", 1, 0, 0], ["hygge_c25_microwave", 1, 0, 0, 0, 1.2],
    ["hygge_c25_counter1", 2, 0, 0], ["ktchn15_coffeemaker", 2, 0, 4, 0, 1.2],
    ["hygge_c25_stove", 3, 0, 0],
    ["hygge_c25_counter1", 4, 0, 0], ["hygge_c25_airfryer", 4, 0, 0, 0, 1.2],
    ["hygge_c25_counter1", 5, 0, 0], ["hygge_c25_kitchensink", 5, 0, 4, 0, 1.2],
    ["hygge_c25_counter1", 6, 0, 0], ["hygge_c25_papertowel", 6, 0, 0, 0, 1.2],
    ["ktchn_c15_dishwasher", 7, 0, 4], ["ktchn15_cabinet", 8, 0, 4], ["sunsetcafe_c20_plant", 11, 0, 0], ["ktchn15_bubblejuicerack", 12, 0, 4],
    ...[1, 2, 4, 6].map((x) => ["ktchn_c15_cupboard", x, 0, 4, 0, 2.2]),
    ["hygge_c25_window2", 0, 2, 0], ["bohogarden_c21_snakeplant", 0, 6, 2], ["hygge_c25_window2", 0, 8, 0],
    // Ilha com tampo arrumado e três banquetas.
    ...[3, 4, 5].flatMap((x) => [["hygge_c25_counter1", x, 4, 0], ["hygge_c25_barstool", x, 5, 0]]),
    ["hygge_c25_tumbler", 3, 4, 0, 0, 1.2], ["ktchn_c15_bread", 4, 4, 4, 0, 1.2], ["ktchn_c15_chopboard", 5, 4, 4, 0, 1.2],
    ["easter_c18_hangingplant", 4, 3, 0, 1],
    // Mesa de jantar de seis lugares no tapete.
    ["hygge_c25_carpet", 8, 4, 0], ["lodge_dark_diningtable", 8, 5, 0], ["ktchn10_tea", 9, 5, 0, 0, 0.9],
    ["hc26_10", 8, 4, 4], ["hc26_10", 9, 4, 4], ["hc26_10", 8, 7, 0], ["hc26_10", 9, 7, 0], ["hc26_10", 7, 6, 2], ["hc26_10", 10, 5, 6],
    ["classic2_trashcan", 13, 9, 4],
    // Frente: poltronas de frente uma para a outra e mesinhas de dois.
    ["hygge_c25_armchair", 1, 11, 2], ["hygge_c25_coffeetable", 2, 11, 0], ["hygge_c25_armchair", 3, 12, 6], ["rainyday_c19_lamp", 0, 13, 0],
    ...[[6, 10], [8, 13]].flatMap(([x, y]) => [["paris_c15_table", x, y, 0], ["paris_c15_chair", x - 1, y, 2], ["paris_c15_chair", x + 1, y, 6]]),
    ["sunsetcafe_c20_plant", 0, 15, 0], ["sunsetcafe_c20_plant", 13, 10, 0],
    // Camada de construtor: lousa do cardápio e relógio no fundo, prateleira
    // e caixotes com plantas na parede da esquerda, luminárias de cozinha
    // sobre a ilha e a mesa, tapetes sob o estar e as mesinhas, xícaras e bolo.
    ["waasa_wall_shelf2", 10.2, 0, 4, 0, 1.4],
    ["waasa_wall_shelf2", 0, 4.4, 2, 0, 1.4], ["recycler_crateplantslight", 0, 10.6, 2, 0, 1.4], ["recycler_crateplantslight", 0, 11.8, 2, 0, 1.4],
    ["ktchn_light", 4, 4, 0], ["ktchn_c15_lamp_g", 8, 5, 0], ["ktchn_c15_lamp_g", 9, 6, 0],
    ["icecream_c21_light", 6, 10, 0], ["icecream_c21_light", 8, 13, 0],
    ["hc25_2", 1, 11, 0], ["dessertcafe_c17_rug", 5, 10, 0], ["dessertcafe_c17_rug", 7, 13, 0],
    ["room_cof15_cup2", 6, 10, 0, 0, 0.95], ["paris15_cake", 8, 13, 0, 0, 0.95], ["room_cof15_cup2", 2, 11, 0, 0, 0.6],
  ],
  // Sala de reunião em L: mesa de dez lugares no patamar do fundo, com mural,
  // mapa e lustre; embaixo a lareira com sofá, o bar com banquetas, a roleta
  // (sorteia quem fala primeiro) e a espera.
  reuniao: () => [
    ["uni_c23_whiteboard", 6, 0, 0], ["exe_map", 10, 0, 4, 0, 1.6], ["lodge_dark_candle", 14, 0, 0], ["shelves_silo", 15, 0, 4], ["mafia_c26_planter_dark", 17, 0, 0],
    ["exe_table", 10, 2, 0], ["lodge_dark_chandelier", 11, 2, 0, 1],
    ["exe_chair", 10, 1, 4], ["exe_chair", 12, 1, 4], ["exe_chair", 10, 4, 0], ["exe_chair", 12, 4, 0], ["exe_chair", 9, 2, 2], ["exe_chair", 13, 3, 6],
    ["uni_laptop", 10, 2, 4, 0, 1], ["mafia_c26_drinktray", 11, 3, 0, 0, 1], ["exe_c15_telephone", 12, 2, 0, 0, 1],
    ["mafia_c26_planter_dark", 6, 4, 0], ["mafia_c26_planter_dark", 17, 4, 0],
    // Lareira: sofá virado para o fogo, mesinha e poltrona.
    ["shelves_silo", 0, 0, 4], ["lodge_dark_tv", 2, 0, 0], ["lodge_dark_candle", 3, 0, 0], ["lodge_dark_endtable", 4, 0, 0], ["exe_globe", 4, 0, 0, 0, 0.9], ["mafia_c26_planter_dark", 5, 0, 0],
    ["lodge_dark_fireplace", 0, 2, 2], ["exe_rug", 1, 1, 0], ["mafia_c26_coffeetable_dark", 2, 2, 0],
    ["mafia_c26_sofa_dark", 3, 1, 6], ["mafia_c26_armchair_dark", 2, 4, 0],
    // Bar no canto e a roleta.
    ["lodge_dark_minibar", 0, 7, 2], ["lodge_dark_bardesk", 1, 7, 0], ["mafia_c26_drinktray", 1, 8, 0, 0, 1.4],
    ["lodge_dark_stool", 2, 7, 6], ["lodge_dark_stool", 2, 9, 6], ["hween_c22_gothicbookshelf", 0, 11, 0], ["mafia_c26_planter_dark", 0, 13, 0],
    // Espera: duas poltronas de frente, com a mesinha no meio.
    // (poltrona larga: uma de cada lado da mesa comprida, no mesmo eixo)
    ["mafia_c26_armchair_dark", 6, 6, 4], ["mafia_c26_coffeetable_dark", 6, 7, 0], ["mafia_c26_armchair_dark", 6, 9, 0],
    ["exe_artlamp", 8, 6, 0], ["mafia_c26_planter_dark", 11, 8, 0], ["mafia_c26_planter_dark", 4, 12, 0],
    // Camada de construtor: arandelas escuras e quadro nas paredes, tapetes
    // sob a mesa de reunião e a espera, lustres sobre o estar e a espera.
    ["mafia_c26_walllamp_dark", 0, 4.4, 2, 0, 0.8], ["attic15_painting", 0, 5.4, 2, 0, 1.2], ["mafia_c26_walllamp_dark", 0, 9.6, 2, 0, 0.8],
    ["mafia_c26_walllamp_dark", 8.6, 0, 4, 0, 0.6],
    ["js_exe_rug", 10, 2, 0], ["darkelegant_c20_carpet", 5, 7, 0],
    ["lodge_dark_chandelier", 2, 2, 0], ["lodge_dark_chandelier", 6, 7, 0],
  ],
  // Lounge: a taverna da referência do Paulo. Uma linha só (madeira escura,
  // tijolo, couro e vermelho). Bar no fundo: cristaleira, adega e armário de
  // garrafas na parede, balcão comprido com caixa registradora, boleira e
  // chope em cima e banquetas vermelhas em fila; samovar no barril. Palco
  // elevado: piano na parede, bardo, gramofone e discos.
  // Estar da lareira com poltronas de couro, jornal e chá. Salão com mesas
  // de barril e lustres. Canto dos sofás vermelhos com pudim na mesa,
  // separado por canteiros de flores. Lustres, ervas e prateleiras do acervo
  // já vêm desenhados no alto (altura 0).
  lounge: () => [
    // Bar (xadrez): parede de garrafas, balcão e banquetas.
    ["mafia_c26_drinkcabinet", 3, 0, 4], ["val_c19_bottlewall", 6, 0, 4], ["wildwest_cabinet", 8, 0, 4], ["antique_c21_lamp", 11, 0, 0],
    ["antique_c21_wallclock", 3, 2, 2],
    ["lodge_dark_bardesk", 4, 2, 2], ["lodge_dark_bardesk", 7, 2, 2],
    ["val_c21_cashier", 4, 2, 0, 0, 1.4], ["val_c20_cakestand", 6, 2, 0, 0, 1.4],
    ["fantasy_c22_frothydrink", 7, 2, 0, 0, 1.4], ["fantasy_c22_frothydrink", 8, 2, 0, 0, 1.4], ["xmas_c24_mugs", 9, 2, 0, 0, 1.4],
    ...[4, 5, 6, 7, 8, 9].map((x) => ["room_hcl15_barchair", x, 3, 0]),
    ["fantasy_c22_herbs", 4, 1, 0], ["fantasy_c22_herbs", 8, 1, 0], ["xmas_c19_chandelier", 6, 3, 2],
    ["wildwest_crate", 11, 3, 0], ["samovar", 11, 3, 0, 0, 1.23],
    // Palco do bardo (dois degraus acima): piano, bardo, gramofone, discos, pilares.
    ["xmas_c18_piano", 13, 0, 0], ["xmas_c24_snowywindows", 16, 0, 4, 0, 0.8],
    ["classic8_rug", 14, 2, 0], ["fantasy_c22_bard", 15, 2, 0, 0, 0.1], ["classic8_records", 14, 2, 0, 0, 0.1],
    ["steampunk_gramophone", 12, 0, 0], ["stories_oldmusic_guitarcase", 17, 2, 4],
    // Estar da lareira: poltronas de couro de frente uma para a outra, mesinha com chá e jornal.
    ["mafia_c26_walllamp_dark", 0.2, 4, 4, 0, 1], ["attic15_painting", 1.4, 4, 4, 0, 1.2],
    ["lodge_dark_fireplace", 0, 5, 2], ["antique_c21_oldenrug", 1, 6, 0],
    ["antique_c21_armchair", 2, 6, 4], ["lodge_dark_endtable", 2, 7, 0], ["antique_c21_teaset", 2, 7, 0, 0, 0.9], ["antique_c21_armchair", 2, 8, 0],
    ["antique_c21_lamp", 3, 6, 0], ["mafia_c26_walllamp_dark", 0, 7.4, 2, 0, 1],
    ["hween_c22_gothicbookshelf", 0, 9, 0], ["antique_c21_birdcage", 0, 11, 2], ["vikings_wallshield_r", 0, 12.2, 2, 0, 1.4], ["mafia_c26_planter_dark", 0, 14, 0],
    // Salão: mesas de barril com banquetas e chope.
    ...[[5, 8], [5, 11]].flatMap(([x, y]) => [["wildwest_table", x, y, 0], ["room_hcl15_barchair", x - 1, y, 2], ["room_hcl15_barchair", x + 1, y, 6],
      ["fantasy_c22_frothydrink", x, y, 0, 0, 1.4]]),
    ["wildwest_table", 10, 9, 0], ["room_hcl15_barchair", 10, 8, 4], ["room_hcl15_barchair", 10, 10, 0],
    ["fantasy_c22_frothydrink", 10, 9, 0, 0, 1.4],
    // Canto dos sofás vermelhos, atrás dos canteiros de flores.
    ["garden_flowerbed", 12, 6, 0], ["garden_flowerbed", 14, 6, 0], ["garden_flowerbed", 16, 6, 0],
    ["hc_crpt", 12, 7, 0],
    ["xmas11_luxsofa2", 13, 7, 4], ["xmas11_luxchair2", 12, 9, 2], ["mafia_c26_coffeetable_dark", 13, 9, 2], ["xmas11_luxchair2", 15, 9, 6], ["xmas11_luxsofa2", 13, 11, 0],
    ["xmas_c23_deluxecake1", 13, 9, 0, 0, 0.84], ["xmas_c24_teapot", 14, 9, 0, 0, 0.84], ["antique_c21_lamp", 16, 8, 0], ["lodge_chandelier", 14, 10, 0],
    // Frente à direita: caixotes e barris.
    ["wildwest_crate", 16, 13, 0], ["pirate_barrel2", 17, 12, 0], ["fantasy_c22_barrel", 17, 11, 0],
  ],
  // Auditório: cinema. Tela com palco e púlpito entre os cantos recolhidos,
  // refletores, plateia em três degraus com corredor no meio e o saguão da
  // entrada no alto, com bilheteria, pipoca e projetor.
  auditorio: () => [
    ["cine_screen", 7, 0, 0], ["cine_light2", 3, 0, 4, 0, 0.4], ["cine_light2", 16, 0, 4, 0, 0.4],
    // Palco onde se pisa e se põe coisas, altura 1,15 (o degrau do Habbo: até 1,5).
    ["classic7_stage", 7, 1, 0], ["classic7_stage", 9, 1, 0], ["classic7_stage", 11, 1, 0], ["uni_lectern", 11, 2, 0, 0, 1.15],
    ["spotlight", 4, 2, 2], ["spotlight", 15, 2, 6], ["theatre_plant", 0, 2, 0], ["theatre_plant", 19, 2, 0],
    ["cine_pstr_1", 0, 5, 2, 0, 0.6], ["cine_pstr_6", 0, 10, 2, 0, 0.6], ["cine_light2", 0, 7, 2, 0, 0.4], ["cine_light2", 0, 13, 2, 0, 0.4],
    // Três fileiras, cada uma com passagem atrás, e corredor no meio.
    ...[6, 8, 10].flatMap((y) => [5, 6, 7, 8, 11, 12, 13, 14].map((x) => ["theatre_seat", x, y, 0])),
    ["cine_projector", 19, 9, 0],
    ["cine_ticket_booth", 6, 13, 0], ["cine_popcorn", 18, 13, 4], ["cine_vipsign", 14, 14, 0],
    ["lodge_dark_bench", 4, 14, 0], ["theatre_plant", 0, 15, 0], ["theatre_plant", 19, 15, 0],
    // Camada de construtor: tapete vermelho no corredor da plateia, da
    // entrada até a frente do palco.
    ...[9, 10].flatMap((x) => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((y) => ["theatre_carpet", x, y, 0])),
  ],
  // Jogos: fliperama largo. Máquinas lado a lado no fundo e na lateral,
  // sinuca e pebolim no meio, mesa de gamer com duas cadeiras, pufes com o
  // dado e fios de lâmpadas por cima.
  jogos: () => [
    ["tokyo_c18_retroarcade", 0, 0, 4], ["arcade_c23_space", 1, 0, 4], ["arcade_c23_cyberpunk", 2, 0, 4], ["graffiti_r24_arcademachine", 3, 0, 0],
    ["arcade_c23_vrmachine", 4, 0, 0], ["arcade_c23_pinball", 5, 0, 0], ["rainyday_c20_retrogames", 7, 0, 0], ["vwave_r21_jukebox", 9, 0, 4],
    ["olympics_r16_vendingmchn", 11, 0, 4], ["olympics_r16_vendingmchn", 12, 0, 4], ["tokyo_c18_neonsign1", 13, 0, 0],
    ["tokyo_c18_racearcade", 15, 0, 0], ["tokyo_c18_racearcade", 17, 0, 0], ["theatre_plant", 19, 0, 0],
    ["arcade_c23_pinball", 0, 2, 2], ["tokyo_c18_retroarcade", 0, 5, 2], ["arcade_c23_space", 0, 6, 2], ["rainyday_c20_retrogames", 0, 8, 2],
    ["bling15_pooltable", 4, 4, 4], ["ads_aftv_footballtable", 9, 4, 0],
    ["gaming_c18_rigpro", 14, 3, 0], ["studio_chair", 14, 4, 0], ["studio_chair", 16, 4, 0],
    ["computer_flatscreen", 14, 3, 4, 0, 1.15], ["computer_flatscreen", 16, 3, 4, 0, 1.15],
    ["cubie_beanbag_b", 2, 9, 2], ["edice", 3, 9, 0, 1], ["cubie_beanbag_p", 4, 9, 6], ["edicehc", 9, 8, 0, 1],
    ["theatre_plant", 13, 7, 0], ["theatre_plant", 0, 11, 0],
    ["circus_c24_hanginglights", 4, 1, 0, 1], ["circus_c24_hanginglights", 9, 1, 0, 1], ["circus_c24_hanginglights", 15, 1, 0, 1],
    // Camada de construtor: pôster e luminária neon na parede da esquerda,
    // tapete neon no canto dos pufes e varais de luz neon sobre a sinuca, o
    // pebolim e os pufes (desenhados no alto).
    ["pixel_poster2", 0, 4, 2, 0, 1], ["cubie_decklight_p", 0, 9.2, 2, 0, 1.2],
    ["neonpunk_c20_carpet", 1, 8, 0],
    ["neonpunk_c20_lights", 4, 5, 0], ["neonpunk_c20_lights", 9, 5, 0], ["neonpunk_c20_stardeco", 3, 8, 0],
  ],
  // Foco: biblioteca funda. Galeria de leitura no patamar do fundo, entre
  // estantes; embaixo, escrivaninhas com luminária na parede, duas mesas de
  // leitura e plantas na frente.
  foco: () => [
    ...[0, 2, 4, 6, 8].map((x) => ["shelves_silo", x, 0, 4]), ["exe_globe", 10, 0, 0], ["classic9_plant", 11, 0, 0],
    ["shelves_silo", 0, 2, 2],
    ...[[3, 4, 5], [7, 8, 9]].flatMap(([a, t, b]) => [["hygge_c18_chair", a, 2, 2], ["lodge_dark_endtable", t, 2, 0], ["bookpile", t, 2, 0, 0, 0.9], ["hygge_c18_chair", b, 2, 6]]),
    ["rainyday_c19_lamp", 6, 2, 0], ["rainyday_c19_lamp", 10, 2, 0], ["classic9_plant", 11, 4, 0],
    ...[6, 8, 10].flatMap((y) => [["rainyday_c20_woodendesk", 0, y, 2], ["hygge_c25_desklamp", 0, y, 0, 0, 1], ["classic9_chair", 1, y, 6], ["waasa_wall_shelf1", 0, y, 2, 0, 1.6]]),
    ...[[5, 7], [8, 10]].flatMap(([x, y]) => [["classic9_table", x, y, 0], ["classic9_light", x, y, 0, 0, 0.7], ["bookpile", x + 1, y + 1, 0, 0, 0.7],
      ["classic9_chair", x - 1, y, 2], ["classic9_chair", x + 2, y + 1, 6], ["classic9_chair", x + 1, y - 1, 4], ["classic9_chair", x, y + 2, 0]]),
    ["classic9_plant", 0, 15, 0], ["bookpile", 1, 14, 0], ["classic9_plant", 8, 15, 0],
    // Camada de construtor: tapetes de biblioteca sob as mesas de leitura,
    // lustres de velas por cima, mapa antigo e quadro na parede da esquerda.
    ["classic9_carpet", 4, 6, 0], ["classic9_carpet", 7, 9, 0],
    ["lodge_chandelier", 5, 7, 0], ["lodge_chandelier", 8, 10, 0], ["lodge_chandelier", 6, 2, 0],
    ["steampunk_map", 0, 11.6, 2, 0, 0.8], ["attic15_painting", 0, 5, 2, 0, 1.2],
  ],
  // Academia: aparelhos no patamar do fundo (esteiras viradas para a parede,
  // armários, halteres e camas elásticas), colchonetes e bancada de
  // suplementos à esquerda e a quadra de futebol do Habbo na frente.
  academia: () => [
    ["matic_water_dispenser", 0, 0, 4], ...[1, 2, 3, 4, 5].map((x) => ["olympics_c16_treadmill", x, 0, 0]), ["olympics_c16_weightrack", 6, 0, 0],
    ...[8, 9, 10].map((x) => ["school_locker_b_nosale", x, 0, 4]), ["school_locker_r_nosale", 11, 0, 4], ["school_locker_r_nosale", 12, 0, 4],
    ["olympics_c16_trampoline", 2, 2, 0], ["olympics_c16_trampoline", 4, 2, 0],
    ["uni_dumbells", 8, 2, 0], ["uni_dumbells", 10, 2, 0], ["uni_dumbells", 12, 2, 0], ["matic_tree_green", 15, 0, 0],
    ["olympics_c16_weightrack", 0, 5, 2], ["olympics_c16_sofa", 0, 7, 2], ["olympics_c16_softmat", 2, 5, 0], ["olympics_c16_softmat", 2, 8, 0],
    ["olympics_c16_counter", 1, 12, 4], ["uni_brotein", 1, 12, 0, 0, 1.2], ["olympics_c16_chair", 1, 13, 0], ["olympics_c16_chair", 2, 13, 0],
    // Quadra: chute parando em cima da bola, gol pela frente da trave, placar da cor da trave.
    ["fball_score_b", 16, 0, 4], ["fball_score_r", 18, 0, 4],
    ["fball_goal_b", 8, 9, 2], ["fball_goal_r", 19, 9, 6], ["fball_ball", 13, 10, 0],
    ["matic_tree_green", 0, 15, 0], ["theatre_plant", 6, 15, 0],
    // Camada de construtor: espelho e relógio de academia nas paredes,
    // e adesivo olímpico.
    ["wallmirror", 0, 10, 2, 0, 1.2], ["wallmirror", 0, 11, 2, 0, 1.2], ["pixel_clock_red", 7, 0, 4, 0, 2.2], ["olympics_c16_walldecal", 0, 3, 2, 0, 0.6],
  ],
  // Produção: estúdio em L. Ilha de edição no recuo do fundo, set de
  // entrevista iluminado no patamar com refletores e câmera, mesa de som na
  // parede do fundo à esquerda, mesa de gamer, caixas e espera na frente.
  producao: () => [
    ["hc_exe_wrkdesk", 6, 0, 4], ["army_c15_leatherchr", 6, 1, 0], ["exe_c15_printer", 8, 0, 0], ["hc_exe_wrkdesk", 9, 0, 4], ["army_c15_leatherchr", 10, 1, 0],
    ["theatre_plant", 11, 0, 0], ["theatre_plant", 6, 4, 0],
    ["studio_floorlight", 13, 1, 0], ["theatre_plant", 12, 0, 0], ["theatre_plant", 19, 0, 0],
    ["mafia_c26_armchair_white", 13, 2, 2], ["hc26_3", 14, 2, 0], ["mafia_c26_armchair_white", 15, 2, 6],
    ["spotlight", 12, 5, 2], ["spotlight", 19, 5, 6], ["studio_camera", 14, 7, 0],
    ["studio_mixingdesk", 0, 5, 0], ["studio_stool", 1, 6, 0], ["studio_stool", 3, 6, 0],
    ["gaming_c18_rigpro", 0, 9, 2], ["studio_chair", 1, 10, 6], ["theatre_plant", 0, 13, 0],
    ["army_c15_crate", 19, 12, 4], ["army_c15_crate", 19, 13, 4], ["army_c15_crate", 19, 12, 4, 0, 1], ["army_c15_crate", 18, 13, 4],
    ["mafia_c26_sofa_dark", 12, 13, 0], ["mafia_c26_coffeetable_dark", 13, 11, 2], ["mafia_c26_drinktray", 13, 11, 0, 0, 0.84], ["theatre_plant", 7, 13, 0],
    // Camada de construtor: pôsteres de filme nas paredes, tapete sob o
    // sofá dos clientes, canto da banda (bateria, guitarra e amplificadores)
    // na frente à esquerda.
    ["cine_pstr_1", 6, 2, 2, 0, 0.6], ["cine_pstr_12", 0, 7, 2, 0, 0.6], ["cine_pstr_5", 15, 0, 4, 0, 0.6], ["cine_pstr_19", 17, 0, 4, 0, 0.6],
    ["js_exe_rug", 12, 10, 0],
    ["studio_drums", 2, 12, 0], ["studio_guitar", 1, 12, 2], ["studio_amp1", 5, 12, 0], ["studio_amp2", 5, 10, 0],
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
// Planta desenhada: um código por ladrilho, como a planta de alturas do
// Habbo (RoomLayout.parse): "0" mantém o da planta escolhida, "v" tira o
// piso, "p" é o chão, "1"–"9" e "A"–"Z" são as alturas 1 a 35 (1 = um bloco).
const ESCRITORIO_CELDAS_LIVRES = /^[0vp1-9A-Z]{400}$/; // ESCRITORIO_QUARTO_MAX²
const ESCRITORIO_ALTURA_PLANTA_MAX = 35;
function escritorioNivelDoCodigo(c) {
  if (c === "v") return -1;
  if (c === "p") return 0;
  if (/^[1-9]$/.test(c)) return Number(c);
  if (/^[A-Z]$/.test(c)) return 10 + c.charCodeAt(0) - 65;
  return null;
}
function escritorioCodigoDoNivel(n) { return n < 0 ? "v" : n === 0 ? "p" : n <= 9 ? String(n) : String.fromCharCode(65 + Math.min(25, n - 10)); }
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
    escritorioPlantasLivres.set(chave, { ...p, celdas: p.celdas.map((linha, y) => linha.map((n, x) => { const c = livres[y * ESCRITORIO_QUARTO_MAX + x]; return c === "0" || escritorioLadrilhoFixo(p, x, y) ? n : escritorioNivelDoCodigo(c); })) });
  }
  return escritorioPlantasLivres.get(chave);
}
// Tamanho do quarto (a planta escolhida: de 6 × 6 a 12 × 12); sem planta,
// o 8 × 8 da primeira versão.
// Lado máximo do quarto (= LADO_QUARTO do servidor): 20 × 20 desde 18/10/2026.
const ESCRITORIO_QUARTO_MAX = 20;
// Grades do perfil guardadas com o lado antigo (8 ou 12) valem ampliadas,
// como o servidor faz (ampliarGrade/ampliarParedes/ampliarCeldas).
function escritorioAmpliarGrade(s, de, vazio) {
  const L = ESCRITORIO_QUARTO_MAX;
  return Array.from({ length: L }, (_, y) => (y < de ? s.slice(y * de, (y + 1) * de) : "").padEnd(L, vazio)).join("");
}
function escritorioPisosDoPerfil(s) {
  s = String(s || "");
  return s.length === 64 ? escritorioAmpliarGrade(s, 8, "0") : s.length === 144 ? escritorioAmpliarGrade(s, 12, "0") : s;
}
function escritorioCeldasDoPerfil(s) {
  s = String(s || "");
  return s.length === 144 ? escritorioAmpliarGrade(s, 12, "0") : s;
}
function escritorioParedesDoPerfil(s) {
  s = String(s || "");
  const t = s.length / 12, L = ESCRITORIO_QUARTO_MAX;
  if (t !== 8 && t !== 12) return s;
  return Array.from({ length: 4 }, (_, lado) => s.slice(lado * t * 3, (lado + 1) * t * 3) + "-00".repeat(L - t)).join("");
}
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
// Altura do piso (em blocos do Habbo, 1 = 32 px). A escada é um degrau de
// altura 1 entre o chão e o mezanino (no Habbo não há rampa: sobe-se um
// degrau de cada vez, até 1,5).
function escritorioAlturaQuarto(a,x,y) {
  return Math.max(0,escritorioNivelQuarto(a,x,y));
}
function escritorioParedesDoQuarto(a) {
  // Ao ar livre (Praça): sem paredes; as bordas são sebes e floreiras. Quarto
  // "maquete" (escolha do dono): sem paredes, para construir as suas com
  // móveis, como os construtores do Habbo fazem.
  if (escritorioModeloPlanta(a)?.semParedes || a.semParedes) return [];
  const lista = [], { w, h } = escritorioDimQuarto(a), pt = escritorioPortaQuarto(a);
  // Como no Habbo (RoomPlaneParser): o topo da parede é o mesmo no quarto
  // todo, 3,6 blocos (ou a altura fixa escolhida + 3,6) acima do piso mais
  // alto (até 20); cada trecho desce até o piso do seu ladrilho.
  const celdas = escritorioModeloPlanta(a)?.celdas || [], maxPiso = Math.min(20, Math.max(0, ...celdas.flat()));
  const altoParede = ((a.alturaParedeFixa ?? -1) >= 0 ? a.alturaParedeFixa + 3.6 : 3.6) + maxPiso;
  const por = (x0,y0,x1,y1,alta) => {
    const r=[x0,y0,x1,y1];
    if(alta) {r.push(a.cor); r.sala=a.id; r.alt=Math.round((altoParede - Math.max(0, escritorioNivelQuarto(a,x0,y0))) * 32); r.espessura=a.espessuraParede ?? 1; if(a.cena) {r.textura=a.texturaParede; r.semTinta=true;}} else r.baixa=true;
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
    const horizontal=r[1]===r[3],chave=[horizontal,horizontal?r[1]:r[0],Boolean(r.baixa),r.alt||0].join(":");
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
  // Guarda-corpo na borda da frente (+y) e da direita (+x) onde o patamar
  // cai dois blocos ou mais para o piso de baixo (queda à vista).
  const n = (x, y) => escritorioNivelQuarto(a, x, y);
  const cai = (xa, ya, xb, yb) => n(xb, yb) >= 0 && n(xa, ya) - n(xb, yb) >= 2;
  for (let y = 0; y < h; y++) for (let x = 0; x + 1 < w; x++)
    if (n(x, y) === n(x + 1, y) && cai(x, y, x, y + 1) && cai(x + 1, y, x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x, y + 0.5, 4, 0, 0]); x++; }
  for (let x = 0; x < w; x++) for (let y = 0; y + 1 < h; y++)
    if (n(x, y) === n(x, y + 1) && cai(x, y, x + 1, y) && cai(x, y + 1, x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x + 0.5, y, 2, 0, 0]); y++; }
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
    nivelMax: Math.max(0, ...(escritorioModeloPlanta(a)?.celdas || []).flat()),
    // Opções do quarto do Habbo: espessuras (multiplicador) da parede e do piso.
    espessuraParede: a.espessuraParede ?? 1, espessuraPiso: a.espessuraPiso ?? 1,
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
    // A tela olha para quem senta (no Habbo a direção do monitor é para
    // onde a tela aponta): o dono fica atrás da mesa, de frente para as
    // visitas, e o monitor vira para ele (direção 0; o verificador acusa
    // "tela de costas para quem senta").
    item("computer_flatscreen", 3, 2, 0, 1, 0.95),
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
