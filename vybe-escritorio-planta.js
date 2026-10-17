// Planta do escritório (2ª versão, outubro de 2026): desenhada de uma vez,
// com a entrada de verdade. Da calçada se entra na Recepção; dela sai o eixo
// central (6 ladrilhos) até o fundo. No meio do caminho, Auditório e Sala de
// reunião à esquerda; Café, Jogos e Academia à direita. Ao fundo, as doze
// salas individuais (10×10) em duas fileiras, por equipe, e o Foco (silêncio)
// no canto. Na frente, a Produção à esquerda e o Lounge à direita, aberto
// para o terraço com a piscina.
// Unidade: ladrilho do Habbo (64×32 px). x desce para a direita na tela, y
// desce para a esquerda. Direções do Habbo: 0 olha para −y, 2 para +x,
// 4 para +y, 6 para −x; medidas valem em 0/4 e giram em 2/6.
// Item de parede (janela, quadro, luminária): [classe, x, y, 2|4, estado,
// altura]; 4 pendura na parede de fundo do ladrilho (y), 2 na da esquerda (x).
// Cada ambiente pertence a uma sala de conversa do servidor (os ids são os
// que o Worker aceita). Quem é dono de cada sala vem do servidor.
const ESCRITORIO_SALA_LADO = 10;
// Estado em que cada móvel se mexe (tela ligada, fogo aceso, fliperama
// rodando, água correndo). Na arte do Habbo isso muda de um móvel para outro:
// no estado errado ele fica parado. Vale para a planta e para as salas.
const ESCRITORIO_ESTADO_ANIMADO = {
  computer_flatscreen: 2, studio_floorlight: 4, spotlight: 5, studio_camera: 2, hc_exe_wrkdesk: 1, exe_c15_printer: 1,
  cine_screen: 2, cine_light1: 100, army15_largescreen: 0, hygge_c25_kitchensink: 1, tokyo_c18_retroarcade: 0,
  arcade_c23_space: 0, arcade_c23_pinball: 0, arcade_c23_cyberpunk: 0, bling15_pooltable: 1, olympics_c16_treadmill: 1,
  olympics_c16_trampoline: 1, disco_c26_floor: 0, exe_globe: 1, waasa_aquarium: 0, bazaar_r17_fountain: 1,
  zengarden_r18_fountain: 1, tokyo_c18_neonsign1: 1, tokyo_c18_neonsign2: 1, classic8_disco: 0, cine_popcorn: 0,
  bohogarden_c21_fireheater: 0, garden_birdbath: 1, lc_medusa1: 3, stories_oldmusic_neon: 1, olympics_r16_vendingmchn: 1,
  birds_r18_cardinal: 1, ktchn10_tea: 1, fxbox_fx16: 1, hygge_r25_toastcat: 1, garden_flolamp: 1, tiki_torch: 1,
  lodge_dark_candle: 1, disco_c26_discoball: 1, arcade_c23_vrmachine: 1, matic_tree_blue: 1, attic15_clock: 0,
  jungle_c16_light: 0, coffee_cup: 0,
};
// Quando esta planta entrou no ar: o mapa geral salvo antes disso é da planta
// anterior e não vale mais (as salas individuais continuam, são relativas).
const ESCRITORIO_PLANTA_DESDE = "2026-10-16T23:34:00Z";
const ESCRITORIO_PLANTA = (() => {
  // O mapa é quadrado, do tamanho da praça do vídeo de fundo; o prédio
  // (76 × 50) fica no meio, com jardim atrás e a frente para a rua. Tudo
  // abaixo é escrito relativo ao canto do prédio (OX, OY).
  const W = 80, H = 80, OX = 2, OY = 10;
  const PREDIO = { x0: OX, y0: OY, x1: OX + 76, y1: OY + 50 };
  const PISO = {
    madeira: ["#6b4a33", "#62432e"], clara: ["#9c7550", "#916b48"], concreto: ["#3d3f46", "#383a40"],
    carpete: ["#2c3444", "#27303e"], preto: ["#1b1b20", "#17171b"], cafe: ["#c9c4bd", "#bdb8b1"],
    verde: ["#23493a", "#1f4134"], corredor: ["#2b2b31", "#27272c"], academia: ["#222227", "#1e1e22"],
    grama: ["#3f7d3a", "#3a7335"], deck: ["#8a5f3c", "#7f5736"], praca: ["#2a2930", "#26252b"],
    // Pisos das salas individuais (madeiras e tons próximos, cada um diferente).
    sala0: ["#7a4f3a", "#704836"], sala1: ["#5e4636", "#564031"], sala2: ["#3f4a5c", "#394354"], sala3: ["#6b5a3e", "#625238"],
    sala4: ["#6a4555", "#613f4e"], sala5: ["#4a5a48", "#435242"], sala6: ["#5a4a6a", "#524361"], sala7: ["#7a5a3a", "#705235"],
    sala8: ["#45545e", "#3f4d56"], sala9: ["#665040", "#5d493a"], sala10: ["#5b5040", "#53493a"], sala11: ["#4f4a5a", "#484352"],
    // Espaços do Lounge, cada um com o seu piso.
    lareira: ["#4f3626", "#472f21"], cinema: ["#262a3c", "#222536"], pista: ["#2c2338", "#271f32"], bar: ["#3d2b22", "#36261e"],
    // Mais pisos para pintar as salas.
    marmore: ["#d9d6d0", "#cfccc5"], gramado: ["#4f8a43", "#467d3c"], nogueira: ["#3e2a1e", "#36241a"], vinho: ["#5a2230", "#4f1d2a"],
  };
  // Cor do letreiro em neon de cada sala.
  const CORES_SALAS = ["#ff8a35", "#ffb347", "#5aa9ff", "#ffd166", "#ff6fa8", "#7ee08a", "#b48cff", "#ff9a5a", "#5ad1e6", "#e8a87c", "#d6c27a", "#a7a3ff"];
  const L = ESCRITORIO_SALA_LADO;
  const ambientes = [];
  const ambiente = (id, nome, sala, x0, y0, x1, y1, piso, extra = {}) =>
    ambientes.push({ id, nome, sala, x0: x0 + OX, y0: y0 + OY, x1: x1 + OX, y1: y1 + OY, piso, ...extra });
  // Salas individuais, na ordem do servidor (sala-0 … sala-11): em cima,
  // Atendimento (Paulo, Vinícius, Ewerton) e Criação (Deivid, Bia, Jady), com
  // a porta para baixo; embaixo, Mizinho e Taynara (perto da Produção),
  // Reriston (de frente para a Criação) e as livres, com a porta para cima.
  const LUGAR_SALAS = [[0, 0], [10, 0], [20, 0], [36, 0], [46, 0], [56, 0], [0, 14], [10, 14], [36, 14], [20, 14], [46, 14], [56, 14]];
  LUGAR_SALAS.forEach(([x0, y0], i) => ambiente("sala-" + i, "Sala livre", "criacao", x0, y0, x0 + L, y0 + L,
    "sala" + i, { pessoal: true, porta: y0 ? "cima" : "baixo", cor: CORES_SALAS[i] }));
  // Espaços comuns: cor e estilo das paredes altas de cada um.
  // "textura": o piso do acervo de cada espaço (a cor fica enquanto carrega).
  ambiente("foco", "Foco", "foco", 66, 0, 76, 24, "clara", { cor: "#8b6b4a", estilo: "d", textura: "rainyday_c20_woodenfloor", texturaParede: "gardenshed_wall" });
  ambiente("auditorio", "Auditório", "reuniao", 0, 28, 16, 37, "carpete", { cor: "#6b4fa0", estilo: "b", textura: "hs_carpet", texturaParede: "celestial_c19_wall" });
  ambiente("reuniao", "Sala de reunião", "reuniao", 16, 28, 30, 37, "carpete", { cor: "#5aa9ff", estilo: "f", textura: "lodge_dark_floor", texturaParede: "exe_c15_wall" });
  ambiente("cafe", "Café", "convivencia", 36, 28, 50, 37, "cafe", { cor: "#d9a066", estilo: "h", textura: "ktchn_c15_floor", texturaParede: "bathroom_wall4" });
  ambiente("jogos", "Jogos", "convivencia", 50, 28, 63, 37, "verde", { cor: "#3fae7a", estilo: "g", textura: "sf_floor", texturaParede: "cpunk_c15_wall" });
  ambiente("academia", "Academia", "convivencia", 63, 28, 76, 37, "academia", { cor: "#7a8494", estilo: "e", textura: "olympics_c16_softmat", texturaParede: "grungewall" });
  ambiente("producao", "Produção", "producao", 0, 40, 24, 50, "concreto", { cor: "#4a5560", estilo: "e", textura: "cpunk_c15_road", texturaParede: "sb_wall" });
  ambiente("recepcao", "Recepção", "convivencia", 24, 40, 42, 50, "marmore", { cor: "#ff8a35", estilo: "d", textura: "greek_c15_floor", texturaParede: "attic15_wall" });
  ambiente("lounge", "Lounge", "convivencia", 42, 40, 76, 50, "madeira", { semRotulo: true, cor: "#b4583a", estilo: "c", texturaParede: "urban_wall" });
  // O Lounge é uma zona só (uma conversa), em quatro espaços com piso, nome e
  // divisórias baixas próprias; a frente abre para o terraço.
  const pisos = [
    { x0: 42, y0: 40, x1: 50, y1: 50, piso: "lareira", textura: "lodge_c15_floor" }, { x0: 50, y0: 40, x1: 58, y1: 50, piso: "cinema", textura: "hs_carpet_blk" },
    { x0: 58, y0: 40, x1: 67, y1: 50, piso: "pista", textura: "bathroom_floortile3" }, { x0: 67, y0: 40, x1: 76, y1: 50, piso: "bar", textura: "tokyo_c18_floor" },
  ].map((q) => ({ ...q, x0: q.x0 + OX, x1: q.x1 + OX, y0: q.y0 + OY, y1: q.y1 + OY }));
  const rotulos = [
    { texto: "Lareira", x: 46, y: 49.4 }, { texto: "Cinema", x: 54, y: 49.4 },
    { texto: "Pista", x: 62.5, y: 49.4 }, { texto: "Bar", x: 71.5, y: 49.4 },
  ].map((q) => ({ ...q, x: q.x + OX, y: q.y + OY }));

  // Divisórias sobre as arestas [x0,y0,x1,y1]. "vaos" são as portas: trechos
  // [de, até) sem parede ao longo da aresta.
  const divisorias = [];
  // baixa: divisória solta (sempre baixa, sem a cor de nenhum ambiente).
  const parede = (x0, y0, x1, y1, vaos = [], baixa = false) => {
    const ehX = y0 === y1, ini = ehX ? x0 : y0, fim = ehX ? x1 : y1;
    const por = (d) => { const r = [d[0] + OX, d[1] + OY, d[2] + OX, d[3] + OY]; if (baixa) r.baixa = true; divisorias.push(r); };
    let a = ini;
    for (const [de, ate] of [...vaos].sort((p, q) => p[0] - q[0])) {
      if (de > a) por(ehX ? [a, y0, de, y0] : [x0, a, x0, de]);
      a = Math.max(a, ate);
    }
    if (fim > a) por(ehX ? [a, y0, fim, y0] : [x0, a, x0, fim]);
  };
  // Porta de 2 ladrilhos no meio da aresta (como nas salas individuais).
  const meio = (a, b) => { const m = Math.floor((a + b) / 2); return [[m - 1, m + 1]]; };
  for (const s of ambientes.filter((x) => x.pessoal)) {
    const a = { ...s, x0: s.x0 - OX, x1: s.x1 - OX, y0: s.y0 - OY, y1: s.y1 - OY };
    // Fundo e esquerda (altas, na cor da sala); a frente para o corredor tem
    // a porta e a de trás fica fechada. Em cima e à esquerda do prédio, a
    // parede da sala reveste a do prédio (o dono pinta igual às outras).
    if (a.porta === "cima") parede(a.x0, a.y0, a.x1, a.y0, meio(a.x0, a.x1));
    else {
      // Fundo que dá para fora: faixa de vidro (janela) de 1 a 5, parede no resto.
      parede(a.x0, a.y0, a.x0 + 1, a.y0); parede(a.x0 + 5, a.y0, a.x1, a.y0);
      parede(a.x0 + 1, a.y0, a.x0 + 5, a.y0); divisorias.at(-1).janela = true;
    }
    parede(a.x0, a.y0, a.x0, a.y1);
    parede(a.x0, a.y1, a.x1, a.y1, a.porta === "baixo" ? meio(a.x0, a.x1) : []);
  }
  // Lado direito das salas que dão para o eixo central.
  parede(30, 0, 30, 10); parede(30, 14, 30, 24);
  // Foco: aberto para o corredor das salas; porta para o corredor de baixo.
  parede(66, 0, 66, 10); parede(66, 14, 66, 24); parede(66, 24, 76, 24, [[70, 72]]);
  // Meio: Auditório, Reunião | eixo | Café, Jogos, Academia.
  parede(0, 28, 16, 28, meio(0, 16)); parede(16, 28, 30, 28, meio(16, 30));
  parede(36, 28, 50, 28, [[48, 50]]); parede(50, 28, 63, 28, meio(50, 63)); parede(63, 28, 76, 28, meio(63, 76));
  parede(16, 28, 16, 37); parede(30, 28, 30, 37); parede(36, 28, 36, 37); parede(50, 28, 50, 37); parede(63, 28, 63, 37);
  parede(0, 37, 16, 37); parede(16, 37, 30, 37, meio(16, 30)); parede(36, 37, 50, 37, meio(36, 50)); parede(50, 37, 63, 37, meio(50, 63)); parede(63, 37, 76, 37);
  // Frente: Produção | Recepção (aberta para o eixo) | Lounge.
  parede(0, 40, 24, 40, [[10, 12]]); parede(24, 40, 30, 40); parede(36, 40, 42, 40);
  parede(42, 40, 76, 40, [[48, 50], [61, 63], [74, 76]]);
  parede(24, 40, 24, 50, [[46, 48]]); parede(42, 40, 42, 50, [[47, 49]]);
  // Estúdio de gravação separado da edição, com passagem na frente.
  parede(9, 40, 9, 46, [], true);
  // Divisórias baixas entre os espaços do Lounge.
  parede(50, 40, 50, 44, [], true); parede(58, 40, 58, 44, [], true); parede(67, 40, 67, 44, [], true);
  // Fachada baixa: a porta da rua dá na Recepção; o Lounge abre para o terraço.
  parede(0, 50, 24, 50, [], true); parede(24, 50, 42, 50, [[31, 35]], true); parede(42, 50, 45, 50, [], true); parede(73, 50, 76, 50, [], true);
  // Lateral direita do prédio (baixa): só se entra pela frente e pelo terraço.
  parede(76, 0, 76, 40, [], true);
  // Parede alta (5º campo = cor) nas arestas do fundo (y0) e da esquerda (x0)
  // de cada ambiente; o estilo padrão do trecho vai em d.estilo. As da frente
  // e as divisórias soltas ficam baixas para enxergar dentro.
  const dono = (d) => {
    const [x0, y0, x1, y1] = d;
    const lista = ambientes.filter((a) => (x0 === x1
      ? x0 === a.x0 && y0 >= a.y0 && y1 <= a.y1
      : y0 === a.y0 && x0 >= a.x0 && x1 <= a.x1));
    return lista.find((a) => a.pessoal) || lista[0];
  };
  for (const d of divisorias) {
    if (d.baixa) continue;
    const a = dono(d);
    if (!a) continue;
    d.push(a.cor);
    if (a.pessoal) { d.sala = a.id; if (d.janela) d.textura = "exe_c15_wall"; } else { d.estilo = a.estilo; d.textura = a.texturaParede; }
  }

  // Móveis: [classe, x, y, direção, estado, altura (em cima de mesa / na parede)]
  const m = [];
  const p = (classe, x, y, dir = 2, estado = 0, altura = 0) => m.push([classe, x + OX, y + OY, dir, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura]);

  // Recepção (24–42 × 40–50): a porta da rua no meio da fachada; o balcão à
  // esquerda, de frente para quem entra; espera com sofás à direita; o eixo
  // central segue reto até o fundo (logo da Vybe na parede do fim).
  p("js_exe_rug", 31, 46, 0);
  p("lodge_dark_desk", 27, 44, 2); p("modern_c17_chair", 26, 45, 2);
  p("hygge_c25_desklamp", 27, 44, 2, 1, 1.1); p("computer_flatscreen", 27, 46, 2, 1, 1.1);
  p("exe_wfall", 24, 44, 2, 1, 0.9); p("hc_wall_lamp", 24, 42, 2, 1, 1.2); p("hc_wall_lamp", 24, 49, 2, 1, 1.2);
  // Espera: tapete 3×3 com dois sofás de três lugares frente a frente e a
  // mesa baixa (3 de largura) entre eles, tudo na mesma largura.
  p("js_exe_rug", 37, 44, 0); p("js_exe_sofa", 37, 44, 4); p("modern_c17_lowtable", 37, 45, 2); p("js_exe_sofa", 37, 46, 0);
  p("modern_c17_floorlamp", 40, 44, 2, 1); p("darkmodern_c20_pug", 40, 47, 2, 1);
  p("pixel_painting_blue", 26, 40, 4, 0, 1); p("pixel_clock_black", 28, 40, 4, 0, 1.2); p("pixel_painting_red", 39, 40, 4, 0, 1);
  p("mafia_c26_planter_white", 25, 41, 0); p("mafia_c26_planter_white", 41, 41, 0);
  p("easter_c22_fanpalm", 30, 49); p("easter_c22_fanpalm", 35, 49);

  // Produção (0–24 × 40–50). Estúdio (0–9): set de entrevista sobre a luz
  // de piso, refletores, câmera de grua e mesa de som com a cadeira do
  // operador. Edição (9–24): estações com dois monitores na parede do fundo e
  // na divisória do estúdio; mesa de revisão no meio.
  p("bohogarden_c21_cheeseplant", 0, 40, 2); p("studio_floorlight", 1, 40, 0, 1);
  p("mafia_c26_armchair_white", 1, 42, 2); p("hc26_3", 2, 42, 2); p("mafia_c26_armchair_white", 4, 42, 6);
  p("spotlight", 6, 41, 6); p("spotlight", 0, 45, 0);
  p("studio_camera", 3, 45, 0, 1);
  p("studio_mixingdesk", 1, 48, 0, 1); p("studio_chair", 3, 47, 4);
  p("army_c15_cabinet", 7, 40, 4); p("army_c15_cabinet", 8, 40, 4);
  p("school_chalkboard", 4, 40, 4, 0, 1); p("hs_wlight", 2, 40, 4, 1, 1.6);
  for (const x of [12, 15, 18, 21]) { p("hc_exe_wrkdesk", x, 40, 4); p("army_c15_leatherchr", x, 41, 0); }
  for (const y of [42, 44]) { p("hc_exe_wrkdesk", 9, y, 2); p("army_c15_leatherchr", 10, y, 6); }
  p("exe_c15_printer", 14, 40, 0, 1);
  p("hc_exe_table", 15, 45, 0);
  for (const x of [15, 16, 17]) p("modern_c17_chair", x, 47, 0);
  p("modern_c17_chair", 14, 45, 2); p("modern_c17_chair", 18, 46, 6);
  p("matic_water_dispenser", 23, 42, 4); p("easter_c22_fanpalm", 23, 49); p("bohogarden_c21_snakeplant", 20, 49, 2);
  p("uni_vinyl", 17, 40, 4, 0, 1.6); p("cubie_decal_2_p", 23, 40, 4, 0, 1.2);

  // Auditório (0–16 × 28–37): telão na parede da esquerda, púlpito ao lado,
  // poltronas de cinema em fileiras viradas para ele, corredor no meio.
  p("cine_screen", 0, 30, 2, 1); p("uni_lectern", 2, 35, 2); p("js_exe_rug", 1, 29, 0);
  p("darkmodern_c20_speakers", 0, 29, 2); p("darkmodern_c20_speakers", 0, 36, 2);
  for (const x of [5, 7, 9, 11, 13]) for (const y of [29, 30, 31, 33, 34, 35]) p("theatre_seat", x, y, 6);
  p("bohogarden_c21_cheeseplant", 15, 29, 2); p("easter_c22_fanpalm", 15, 36);
  p("cine_light1", 3, 28, 4, 1, 1.6); p("cine_light1", 12, 28, 4, 1, 1.6);
  p("cine_pstr_1", 5, 28, 4, 0, 1); p("cine_pstr_6", 10, 28, 4, 0, 1); p("cine_pstr_8", 14, 28, 4, 0, 1);

  // Sala de reunião (16–30 × 28–37), paredes de vidro: mesa comprida no meio,
  // cadeiras dos dois lados, quadro branco e o telão na parede do fundo.
  p("army_c15_contable2", 18, 32, 0); for (const x of [19, 21, 23]) p("army_c15_contable", x, 32, 0); p("army_c15_contable2", 25, 32, 0);
  for (let x = 18; x <= 25; x++) { p("army_c15_leatherchr", x, 31, 4); p("army_c15_leatherchr", x, 33, 0); }
  p("uni_c23_whiteboard", 16, 32, 2);
  p("army_c15_cabinet", 17, 28, 4); p("army_c15_cabinet", 18, 28, 4); p("army_c15_cabinet", 19, 28, 4);
  p("plant_yukka", 16, 28, 0); p("plant_yukka", 29, 36, 0); p("plant_yukka", 29, 28, 0);
  p("army15_largescreen", 25, 28, 4, 1, 1); p("pixel_clock_black", 27, 28, 4, 0, 1.4);

  // Café (36–50 × 28–37): bancada com geladeiras, fogão, pia e café na
  // parede do fundo; mesas de almoço; balcão de lanche. Azulejo branco.
  p("mode_fridge", 36, 28, 0); p("hygge_c25_counter1", 37, 28, 0); p("hygge_c25_counter1", 38, 28, 0);
  p("hygge_c25_stove", 39, 28, 0); p("hygge_c25_counter1", 40, 28, 0); p("hygge_c25_kitchensink", 41, 28, 4);
  p("hygge_c25_counter1", 42, 28, 0); p("hygge_c25_counter1", 43, 28, 0); p("purablk_c16_fridge", 44, 28, 4);
  p("ktchn_c15_cupboard", 45, 28, 4); p("ktchn_c15_cupboard", 46, 28, 4); p("matic_water_dispenser", 47, 28, 4);
  p("sunsetcafe_c20_coffeemachine", 37, 28, 2, 1, 1.2); p("hygge_c25_microwave", 38, 28, 2, 0, 1.2);
  p("ktchn_knives", 40, 28, 4, 0, 1.3); p("ktchn10_cabnt", 42, 28, 4, 0, 1.5); p("ktchn10_cabnt", 43, 28, 4, 0, 1.5);
  for (const x of [38, 44]) {
    p("hc25_12", x, 32, 0);
    for (const dx of [0, 1]) { p("hc26_10", x + dx, 31, 4); p("hc26_10", x + dx, 33, 0); }
  }
  p("school_c22_cafe", 46, 35, 0);
  p("cine_pstr_6", 36, 33, 2, 0, 1.1); p("pixel_clock_black", 36, 30, 2, 0, 1.4);
  p("bohogarden_c21_fanpalm", 49, 36, 2);

  // Jogos (50–63 × 28–37): fliperamas e pinball na parede do fundo, jukebox
  // e videogame na da esquerda, sinuca e pebolim no meio, simuladores de
  // corrida na parede da direita.
  p("tokyo_c18_retroarcade", 51, 28, 4, 1); p("arcade_c23_space", 52, 28, 4, 1); p("graffiti_r24_arcademachine", 53, 28, 0, 1);
  p("arcade_c23_pinball", 58, 28, 0, 1); p("arcade_c23_cyberpunk", 61, 28, 4, 1);
  p("vwave_r21_jukebox", 50, 31, 2, 1); p("rainyday_c20_retrogames", 50, 34, 2, 1); p("mafia_c26_armchair_dark", 52, 34, 6);
  p("bling15_pooltable", 55, 31, 4); p("ads_aftv_footballtable", 58, 33, 0);
  p("tokyo_c18_racearcade", 62, 31, 6, 1); p("tokyo_c18_racearcade", 62, 32, 6, 1);
  p("theatre_plant", 62, 36, 2); p("army_c15_plant", 50, 36);
  p("cubie_decal_1_b", 50, 29, 2, 0, 1.2); p("uni_vinyl", 57, 28, 4, 0, 1.4);

  // Academia (63–76 × 28–37): esteiras e bicicletas no fundo, pesos na parede
  // da esquerda, camas elásticas na direita.
  for (const x of [64, 65, 66]) p("olympics_c16_treadmill", x, 28, 4);
  for (const x of [71, 72, 73]) p("olympics_c16_treadmill", x, 28, 4);
  p("paris15_bicycle", 74, 29, 4); p("paris15_bicycle", 75, 29, 4); p("matic_water_dispenser", 75, 28, 4);
  p("olympics_c16_weightrack", 63, 31, 2); p("olympics_c16_weightrack", 63, 33, 2);
  p("uni_dumbells", 65, 31, 2); p("uni_dumbells", 65, 33, 2);
  p("olympics_c16_trampoline", 73, 33, 2); p("olympics_c16_trampoline", 73, 35, 2);
  p("bohogarden_c21_snakeplant", 63, 36, 2); p("modern_c17_floorlamp", 75, 36, 2, 1);
  p("hc_wall_lamp", 67, 28, 4, 1, 1.4); p("hc_wall_lamp", 70, 28, 4, 1, 1.4); p("cubie_decal_1_b", 63, 34, 2, 0, 1.2);

  // Foco (66–76 × 0–24): biblioteca silenciosa. Estantes na parede da
  // esquerda, mesas de estudo com luminária, cadeiras dos dois lados, canto
  // de leitura com pufes e a cadeira suspensa.
  for (const y of [1, 3, 5, 7, 17, 19, 21]) p("purablk_c16_shelve", 66, y, 2);
  for (const y of [3, 7, 16, 20]) {
    p("classic9_table", 70, y, 0); p("classic9_light", 70, y, 2, 1, 0.7);
    for (const dy of [0, 1]) { p("classic9_chair", 69, y + dy, 2); p("classic9_chair", 72, y + dy, 6); }
  }
  p("cubie_rug_b", 73, 11, 0); p("cubie_beanbag_b", 74, 11, 6); p("cubie_beanbag_p", 74, 13, 6); p("hc26_3", 73, 11, 0); p("hc26_3", 73, 13, 0);
  p("hygge_c25_hangingchair", 75, 1, 6); p("modern_c17_floorlamp", 75, 9, 2, 1); p("modern_c17_floorlamp", 75, 18, 2, 1);
  p("theatre_plant", 67, 0, 2); p("army_c15_plant", 75, 23); p("bohogarden_c21_fanpalm", 67, 23, 2);
  p("uni_libraryshelf", 66, 14, 2, 0, 1);

  // Lounge (42–76 × 40–50), da esquerda para a direita: lareira (sofá e
  // poltronas virados para o fogo), cinema (dois sofás em fila virados para o
  // telão), pista do DJ com a jukebox e o bar.
  p("lodge_dark_fireplace", 45, 40, 0, 1); p("hygge_c25_carpet", 44, 42, 0);
  p("darkmodern_c20_lowtable", 44, 44, 2); p("mafia_c26_sofa_dark", 44, 46, 0);
  p("mafia_c26_armchair_dark", 43, 44, 2); p("mafia_c26_armchair_dark", 48, 44, 6);
  p("theatre_plant", 43, 40, 2); p("theatre_plant", 47, 40, 2); p("modern_c17_floorlamp", 49, 48, 2, 1);
  p("hygge_c18_shelf", 42, 41, 2, 1); p("attic15_painting", 44, 40, 4, 0, 1.4); p("attic15_painting", 42, 45, 2, 0, 1.2);
  p("uni_projector", 53, 40, 4); p("js_exe_rug", 53, 44, 0);
  p("hc23_6", 53, 45, 0); p("hc23_6", 53, 47, 0);
  p("modern_c17_floorlamp", 51, 40, 2, 1); p("modern_c17_floorlamp", 57, 40, 2, 1);
  p("cine_light1", 52, 40, 4, 1, 1.8); p("cine_light1", 56, 40, 4, 1, 1.8);
  p("hc25_6", 64, 40, 0, 1); p("disco_c26_jukebox", 58, 42, 2, 1);
  for (const x of [60, 62, 64]) for (const y of [43, 45]) p("disco_c26_floor", x, y, 0, 1);
  p("spotlight", 59, 41, 2); p("spotlight", 66, 41, 6);
  p("hs_wlight", 60, 40, 4, 1, 1.6); p("hs_wlight", 66, 40, 4, 1, 1.6);
  for (const x of [69, 70, 71, 72, 73]) { p("js_exe_bardesk", x, 44, 0); p("vwave_c21_barstool", x, 45, 0); }
  p("exe_drinks", 70, 44, 4, 0, 1); p("exe_drinks", 72, 44, 4, 0, 1);
  p("ktchn15_bubblejuicerack", 68, 40, 4, 1); p("ktchn15_bubblejuicerack", 70, 40, 4, 1);
  p("lodge_dark_minibar", 72, 40, 4, 1); p("lodge_dark_minibar", 73, 40, 4, 1);
  for (const x of [69, 73]) { p("vwave_c21_bartable", x, 47, 0); p("vwave_c21_barstool", x - 1, 47, 2); p("vwave_c21_barstool", x + 1, 48, 6); }
  p("uni_fairylights", 72, 40, 4, 0, 2); p("modern_c17_floorlamp", 75, 49, 2, 1);

  // Vida em cada espaço: objetos animados e detalhes em cima das mesas.
  // Recepção: aquário, gata, flores no balcão, café e revistas na espera,
  // luminária de água-viva na entrada.
  p("waasa_aquarium", 36, 40, 4); p("hygge_r25_toastcat", 41, 46, 4); p("giftflowers", 27, 45, 2, 0, 1.1);
  p("coffee_cup", 38, 45, 4, 0, 1); p("darkmodern_c20_reads", 39, 45, 2, 0, 1); p("lc_medusa1", 25, 49, 0);
  // Produção: letreiro "no ar" no estúdio, microfone no set, mesa de revisão com papéis.
  p("stories_oldmusic_neon", 6, 46, 4); p("fxbox_fx16", 3, 43, 2);
  p("books_1", 15, 45, 2, 0, 1); p("darkmodern_c20_folder", 16, 45, 2, 0, 1); p("coffee_cup", 17, 46, 4, 0, 1);
  // Auditório: pipoqueira no fim do corredor.
  p("cine_popcorn", 15, 32, 4);
  // Reunião: notebooks, chá e café na mesa.
  p("army_c15_deskcomp", 19, 32, 4, 0, 1.1); p("ktchn10_tea", 22, 32, 2, 0, 1.1); p("coffee_cup", 23, 32, 4, 0, 1.1);
  p("army_c15_deskcomp", 25, 32, 4, 0, 1.1); p("books_1", 21, 32, 2, 0, 1.1);
  // Café: máquina de lanche, chá na bancada, café e prato nas mesas.
  p("olympics_r16_vendingmchn", 49, 30, 4); p("ktchn10_tea", 42, 28, 2, 0, 1.2);
  p("coffee_cup", 38, 32, 4, 0, 1.2); p("diner_tray_6", 39, 32, 2, 0, 1.2); p("coffee_cup", 45, 32, 4, 0, 1.2);
  // Jogos: máquina de realidade virtual e letreiro em neon.
  p("arcade_c23_vrmachine", 61, 35, 0); p("tokyo_c18_neonsign1", 53, 36, 0);
  // Academia: árvore holográfica no canto.
  p("matic_tree_blue", 70, 36, 0);
  // Foco: relógio de pêndulo, livros nas mesas de estudo, gata no canto de leitura.
  p("attic15_clock", 66, 9, 2);
  for (const y of [3, 7, 16, 20]) p("classic9_books", 71, y + 1, 2, 0, 0.7);
  for (const y of [7, 20]) p("lodge_dark_candle", 70, y + 1, 2, 0, 0.7);
  p("hygge_r25_toastcat", 75, 12, 4);
  // Lounge: vela e café na lareira, pipoca no cinema, globos na pista, neon no bar.
  p("lodge_dark_candle", 45, 44, 2, 0, 1); p("coffee_cup", 46, 44, 4, 0, 1);
  p("cine_popcorn", 51, 46, 4);
  p("classic8_disco", 59, 47, 0); p("disco_c26_discoball", 66, 48, 0); p("tokyo_c18_neonsign1", 66, 44, 0);
  p("tokyo_c18_neonsign2", 75, 42, 0);

  // Eixo central e corredores: plantas nas pontas, longe das portas.
  p("bohogarden_c21_fanpalm", 30, 0, 2); p("bohogarden_c21_fanpalm", 35, 0, 2);
  p("br_c25_stonebench", 30, 5, 2); p("br_c25_stonebench", 35, 5, 6);
  for (const [x, y] of [[0, 10], [29, 10], [37, 13], [65, 13], [0, 27], [29, 24], [37, 24], [75, 27], [0, 39], [29, 39], [37, 37], [75, 39]]) p("theatre_plant", x, y, 2);

  // Terraço do Lounge: piscina, espreguiçadeiras com os pés para a água,
  // cadeiras de praia viradas para ela, guarda-sóis e mesas altas no canto.
  const piscina = { x0: 50, y0: 53, x1: 66, y1: 58 };
  for (const y of [53, 55, 57]) p("js_c16_lounger", 46, y, 2);
  for (const x of [51, 54, 57, 60, 63]) p("ducket_c26_seachair", x, 59, 0);
  for (const x of [52, 58, 64]) p("ducket_c26_seasidetable", x, 59, 0);
  p("tiki_parasol", 49, 60, 0); p("tiki_parasol", 67, 53, 0); p("lido_parasol", 48, 52, 0);
  for (const [x, y] of [[70, 53], [74, 53], [70, 57], [74, 57]]) { p("vwave_c21_bartable", x, y, 0); p("vwave_c21_barstool", x - 1, y, 2); p("vwave_c21_barstool", x + 1, y + 1, 6); }
  p("lido_parasol", 72, 55, 0); p("vwave_c21_palm", 77, 51, 2); p("vwave_c21_palm", 77, 59, 2);
  // Calçada da entrada (x 31–34, livre até a rua) com palmeiras, postes,
  // canteiros e bancos; jardim à esquerda (diante da Produção) e à direita.
  p("vwave_c21_palm", 30, 51, 2); p("vwave_c21_palm", 35, 51, 2);
  for (const y of [52, 59, 66]) { p("suncity_c19_streetlight", 29, y, 0, 1); p("suncity_c19_streetlight", 36, y, 0, 1); }
  for (const y of [55, 62]) { p("stone_flowerbed", 27, y, 0, 1); p("stone_flowerbed", 37, y, 0, 1); }
  p("br_c25_stonebench", 26, 58, 2); p("br_c25_stonebench", 38, 58, 6);
  for (const x of [1, 6, 11, 16, 21]) p("stone_flowerbed", x, 51, 0, 1);
  p("lt_c26_banyantree", 3, 56, 2);
  for (const [x, y] of [[11, 60], [20, 56], [8, 66], [17, 66], [45, 64], [57, 64], [69, 64]]) p("olympus_c25_olivetree", x, y, 2);
  for (const [x, y] of [[8, 54], [14, 57], [51, 64], [63, 64]]) p("br_c25_stonebench", x, y, 0);
  for (const x of [2, 24, 41, 49, 61, 73]) p("vwave_c21_palm", x, 68, 2);
  // Atrás do prédio: palmeiras e árvores que aparecem por cima das paredes.
  for (const x of [4, 14, 24, 44, 54, 64, 74]) p("vwave_c21_palm", x, -3, 2);
  for (const x of [9, 39, 69]) p("olympus_c25_olivetree", x, -7, 2);
  for (const y of [3, 15, 27, 39]) p("vwave_c21_palm", 77, y, 2);
  // Jardim com vida: fonte, bebedouro de pássaros com o cardeal, lanternas,
  // tochas na piscina, aquecedor e fonte zen no terraço.
  p("bazaar_r17_fountain", 14, 62, 4); p("garden_birdbath", 6, 60, 0); p("birds_r18_cardinal", 7, 61, 0);
  p("garden_flolamp", 24, 62, 0); p("garden_flolamp", 40, 62, 0); p("jungle_c16_light", 10, 64, 0);
  p("tiki_torch", 67, 57, 4); p("tiki_torch", 47, 61, 4); p("bohogarden_c21_fireheater", 72, 59, 0);
  p("zengarden_r18_fountain", 74, 61, 0);

  // Textos e logo pintados nas paredes do prédio: o logo no fim do eixo
  // central (quem entra vê de longe), frases nos trechos livres.
  const quadros = [
    { tipo: "logo", parede: "x", de: 30, ate: 36 },
    { tipo: "texto", texto: "Qual a sua Vybe?", cor: "#ff7a1a", parede: "x", de: 66, ate: 76 },
    { tipo: "texto", texto: "TÔ NA VYBE", cor: "#ff3b2f", parede: "y", de: 24, ate: 28 },
    { tipo: "texto", texto: "É A VYBE, MINHA VIDINHA!", cor: "#ffffff", parede: "y", de: 41, ate: 49 },
  ].map((q) => ({ ...q, de: q.de + (q.parede === "x" ? OX : OY), ate: q.ate + (q.parede === "x" ? OX : OY) }));
  // Corredores (linha laranja no meio): o das salas, o do meio e o da frente.
  const corredores = [[12, 0, 66], [26, 0, 76], [38.5, 0, 76]].map(([y, a, b]) => [y + OY, a + OX, b + OX]);
  // Postes (só sem o vídeo de fundo) e o letreiro da Vybelândia.
  const postes = [[10, 53], [20, 53], [44, 60], [77, 10], [77, 22], [77, 34]].map(([x, y]) => [x + OX, y + OY]);
  const letreiro = { texto: "VYBELÂNDIA", de: 44 + OX, ate: 66 + OX };
  // Onde se chega sem sala própria (e de onde o mapa confere a circulação).
  const entrada = { x: 33 + OX, y: 47 + OY };
  // Atalhos de câmera ("Ir para").
  const vistas = { salas: [33 + OX, 12 + OY, 0.75], reunioes: [15 + OX, 32 + OY, 0.9], lazer: [58 + OX, 42 + OY, 0.7], externa: [52 + OX, 58 + OY, 0.85] };
  piscina.x0 += OX; piscina.x1 += OX; piscina.y0 += OY; piscina.y1 += OY;
  // Pisos do acervo de fora do prédio (por cima da praça do vídeo): gramado,
  // calçada da entrada, deck do terraço e a calçada da rua na frente.
  const texturas = [
    { x0: -2, y0: -10, x1: 78, y1: 0, textura: "country_grass", piso: "grama" },
    { x0: -2, y0: 0, x1: 0, y1: 50, textura: "country_grass", piso: "grama" },
    { x0: 76, y0: 0, x1: 78, y1: 50, textura: "country_grass", piso: "grama" },
    { x0: -2, y0: 50, x1: 30, y1: 68, textura: "country_grass", piso: "grama" },
    { x0: 36, y0: 50, x1: 44, y1: 68, textura: "country_grass", piso: "grama" },
    { x0: 44, y0: 62, x1: 78, y1: 68, textura: "country_grass", piso: "grama" },
    { x0: 44, y0: 50, x1: 78, y1: 62, textura: "country_patio", piso: "deck" },
    { x0: 30, y0: 50, x1: 36, y1: 68, textura: "paris_c15_pavement", piso: "praca" },
    { x0: -2, y0: 68, x1: 78, y1: 70, textura: "urban_sidewalk", piso: "praca" },
  ].map((r) => ({ ...r, x0: r.x0 + OX, x1: r.x1 + OX, y0: r.y0 + OY, y1: r.y1 + OY }));
  return { W, H, PREDIO, PISO, ambientes, divisorias, moveis: m, piscina, quadros, corredores, postes, letreiro, pisos, rotulos, entrada, vistas,
    texturas, texturaSalas: "rainyday_c20_woodenfloor", texturaCorredor: "darkmodern_c20_floor", texturaDeck: "country_patio" };
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
function escritorioMoveisDaSala(a, temaEscolhido) {
  const item = (classe, lx, ly, dir, estado = 0, altura = 0) => [classe, a.x0 + lx, a.y0 + ly, dir, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura];
  const mesa = escritorioMesaDaSala(a);
  const tema = temaEscolhido || ESCRITORIO_TEMAS_SALAS[Number(String(a.id).split("-")[1])] || "livre";
  const base = [
    item("exe_table", 2, 3, 2),
    item("computer_flatscreen", 2, 4, 6, 1, 1),
    ["army_c15_leatherchr", mesa.cadeira.x, mesa.cadeira.y, mesa.cadeira.dir, 0, 0],
    item("plant_yukka", 0, 0, 0), item("purablk_c16_shelve", 0, 7, 2),
    // Mesa de quem trabalha com café e pasta, não vazia.
    item("coffee_cup", 3, 3, 4, 0, 1), item("darkmodern_c20_folder", 2, 5, 2, 0, 1),
    // Na parede: um quadro na da esquerda e uma luminária no fundo. As salas
    // de cima têm a janela de verdade na própria parede (vidro com a cidade,
    // porque o fundo delas dá para fora); janela pendurada em parede de
    // dentro mostrava a parede atrás do vidro.
    item(Number(String(a.id).split("-")[1]) % 2 ? "pixel_painting_blue" : "pixel_painting_red", 0, 5, 2, 0, 1.1),
    item("hc_wall_lamp", a.porta === "baixo" ? 5 : 2, 0, 4, 1, 1.3),
  ];
  // Cadeiras de visita viradas para a mesa (cada tema com as suas).
  const visita = (classe) => [item(classe, 5, 3, 6), item(classe, 5, 5, 6)];
  const temas = {
    // Arquivo atrás da mesa e canto para receber o cliente: sofá no fundo,
    // mesinha e poltrona.
    atendimento: [
      ...visita("mafia_c26_armchair_white"), item("exe_globe", 0, 2, 0), item("exe_c15_telephone", 3, 4, 2, 0, 1),
      item("modern_c17_sofa", 6, 0, 4), item("hc26_3", 6, 2, 2), item("mafia_c26_armchair_dark", 8, 2, 6),
      item("modern_c17_floorlamp", 8, 0, 2, 1), item("bohogarden_c21_cheeseplant", 9, 8, 2),
    ],
    // Estação de criação com dois monitores no fundo e canto de ideias com pufes.
    design: [
      item("modern_c17_chair", 5, 4, 6),
      item("hc_exe_wrkdesk", 6, 0, 4), item("army_c15_leatherchr", 6, 1, 0),
      item("cubie_rug_p", 6, 5, 0), item("cubie_beanbag_b", 6, 6, 2), item("hc26_3", 7, 6, 0), item("cubie_beanbag_p", 8, 6, 6),
      item("bohogarden_c21_snakeplant", 9, 9, 2), item("modern_c17_floorlamp", 8, 0, 2, 1),
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
      item("hygge_c25_hangingchair", 8, 1, 6), item("hygge_c18_shelf", 0, 2, 2, 1),
      item("bohogarden_c21_fanpalm", 9, 9, 2),
    ],
    // Bancada de vidro com segundo monitor e pufes em volta da mesinha.
    criacao: [
      ...visita("mafia_c26_armchair_dark"),
      item("gaming_c18_rigpro", 6, 0, 0), item("computer_flatscreen", 7, 0, 4, 1, 1.3), item("army_c15_leatherchr", 7, 1, 0),
      item("cubie_rug_b", 6, 5, 0), item("cubie_beanbag_b", 6, 6, 2), item("hc26_3", 7, 6, 0), item("cubie_beanbag_b", 8, 6, 6),
      item("bohogarden_c21_snakeplant", 9, 9, 2),
    ],
    livre: [...visita("modern_c17_chair"), item("modern_c17_floorlamp", 8, 0, 2, 1), item("bohogarden_c21_cheeseplant", 9, 8, 2)],
  };
  return [...base, ...temas[tema]];
}
