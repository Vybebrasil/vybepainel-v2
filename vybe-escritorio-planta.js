// Planta do escritório (3ª versão, 17 de outubro de 2026): prédio de 60 × 48
// ladrilhos em volta de um pátio central. Da calçada se entra na Recepção;
// dela sai o pátio (12 ladrilhos de largura) até a parede do fundo, com a
// fonte no meio. Ao fundo, as fachadas das salas da equipe: Atendimento
// (Paulo, Vinícius, Ewerton) à esquerda e Criação (Deivid, Bia, Jady) à
// direita, com a porta para o corredor; na lateral esquerda, Produção
// (Mizinho, Taynara, Reriston), com a porta para o corredor lateral. Cada
// sala é um quarto próprio (cena separada, 8 × 8): a porta da fachada leva
// para dentro dele. Em volta do pátio, Sala de reunião e Auditório à
// esquerda, Café, Jogos, Foco e Academia à direita. Na frente, Produção,
// Recepção e Lounge, aberto para o terraço com a piscina. Só a parede do
// prédio e as fachadas são altas; o resto é baixo, para se ver o
// escritório inteiro de uma vez.
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
const ESCRITORIO_PLANTA = (() => {
  // O mapa é quadrado, do tamanho da praça da imagem de fundo; o prédio
  // (60 × 48) fica no meio, com jardim atrás e dos lados e a frente para a
  // rua. Tudo abaixo é escrito relativo ao canto do prédio (OX, OY).
  const W = 80, H = 80, OX = 10, OY = 12, L = ESCRITORIO_SALA_LADO;
  const PREDIO = { x0: OX, y0: OY, x1: OX + 60, y1: OY + 48 };
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
  // Cor do letreiro em neon e da parede alta de cada sala.
  const CORES_SALAS = ["#ff8a35", "#ffb347", "#ffd166", "#5aa9ff", "#ff6fa8", "#7ee08a", "#b48cff", "#5ad1e6", "#e8a87c"];
  const ambientes = [];
  const ambiente = (id, nome, sala, x0, y0, x1, y1, piso, extra = {}) =>
    ambientes.push({ id, nome, sala, x0: x0 + OX, y0: y0 + OY, x1: x1 + OX, y1: y1 + OY, piso, ...extra });
  // Salas individuais, na ordem do servidor (sala-0 … sala-8). Cada uma é um
  // quarto próprio (decisão do Paulo, 17/10/2026): uma cena separada, em
  // coordenadas locais (0 … L), com as duas paredes do fundo altas. No mapa
  // geral fica só a fachada: uma caixa de FACHADA_FUNDO ladrilhos de fundo
  // encostada na parede do prédio, no lugar onde a sala ficava, com as quatro
  // paredes altas na cor da sala, a porta de vidro (2 ladrilhos) no lado
  // "porta" (baixo = frente, direita = lado direito) e o letreiro. Pisar nos
  // ladrilhos atrás da porta ("entrada") entra no quarto; quem sai aparece na
  // soleira ("saida"). "alta": paredes altas do quarto (as do fundo).
  const LUGAR_SALAS = [
    [0, 0, "baixo"], [8, 0, "baixo"], [16, 0, "baixo"],
    [36, 0, "baixo"], [44, 0, "baixo"], [52, 0, "baixo"],
    [0, 12, "direita"], [0, 21, "direita"], [0, 30, "direita"],
  ];
  const FACHADA_FUNDO = 3;
  // Chat escrito de cada sala: o da ala em que ela fica.
  const ALA_SALAS = ["atendimento", "atendimento", "atendimento", "criacao", "criacao", "criacao", "producao", "producao", "producao"];
  LUGAR_SALAS.forEach(([x0, y0, porta], i) => {
    const baixo = porta === "baixo";
    const f = baixo ? { x0, y0, x1: x0 + L, y1: y0 + FACHADA_FUNDO } : { x0, y0, x1: x0 + FACHADA_FUNDO, y1: y0 + L };
    const m = baixo ? { x: x0 + L / 2 - 1, y: f.y1 } : { x: f.x1, y: y0 + L / 2 - 1 };
    const fachada = {
      x0: f.x0 + OX, y0: f.y0 + OY, x1: f.x1 + OX, y1: f.y1 + OY, porta,
      soleira: { x: m.x + OX, y: m.y + OY, w: baixo ? 2 : 1, h: baixo ? 1 : 2 },
      entrada: baixo
        ? [{ x: m.x + OX, y: f.y1 - 1 + OY }, { x: m.x + 1 + OX, y: f.y1 - 1 + OY }]
        : [{ x: f.x1 - 1 + OX, y: m.y + OY }, { x: f.x1 - 1 + OX, y: m.y + 1 + OY }],
      saida: { x: m.x + OX, y: m.y + OY, dir: baixo ? 4 : 2 },
    };
    ambientes.push({ id: "sala-" + i, nome: "Sala livre", sala: ALA_SALAS[i], x0: 0, y0: 0, x1: L, y1: L, piso: "sala" + i,
      pessoal: true, porta, alta: ["y0", "x0"], cor: CORES_SALAS[i], fachada });
  });
  // Espaços comuns: cor e estilo das paredes altas de cada um.
  // "textura": o piso do acervo de cada espaço (a cor fica enquanto carrega).
  ambiente("reuniao", "Sala de reunião", "reuniao", 12, 12, 24, 21, "carpete", { cor: "#5aa9ff", estilo: "f", textura: "lodge_dark_floor", texturaParede: "army_c15_wall" });
  ambiente("cafe", "Café", "convivencia", 36, 12, 48, 21, "cafe", { cor: "#d9a066", estilo: "h", textura: "ktchn_c15_floor", texturaParede: "bathroom_wall4" });
  ambiente("jogos", "Jogos", "convivencia", 48, 12, 60, 21, "verde", { cor: "#3fae7a", estilo: "g", textura: "sf_floor", texturaParede: "cpunk_c15_wall" });
  ambiente("auditorio", "Auditório", "reuniao", 12, 24, 24, 34, "carpete", { cor: "#6b4fa0", estilo: "b", textura: "hs_carpet", texturaParede: "celestial_c19_wall" });
  ambiente("foco", "Foco", "foco", 36, 24, 48, 34, "clara", { cor: "#8b6b4a", estilo: "d", textura: "rainyday_c20_woodenfloor", texturaParede: "gardenshed_wall" });
  ambiente("academia", "Academia", "convivencia", 48, 24, 60, 34, "academia", { cor: "#7a8494", estilo: "e", textura: "olympics_c16_softmat", texturaParede: "grungewall" });
  ambiente("producao", "Produção", "producao", 0, 38, 24, 48, "concreto", { cor: "#4a5560", estilo: "e", textura: "cpunk_c15_road", texturaParede: "sb_wall" });
  ambiente("recepcao", "Recepção", "convivencia", 24, 38, 36, 48, "marmore", { cor: "#ff8a35", estilo: "d", textura: "greek_c15_floor", texturaParede: "attic15_wall" });
  // O Lounge é uma zona só (uma conversa): quatro espaços dentro do prédio e
  // o terraço com a piscina, aberto na frente.
  ambiente("lounge", "Lounge", "convivencia", 36, 38, 60, 58, "madeira", { semRotulo: true, cor: "#b4583a", estilo: "c", texturaParede: "urban_wall" });
  const pisos = [
    // Pátio central: mármore claro de ponta a ponta.
    { x0: 24, y0: 0, x1: 36, y1: 38, piso: "patio", textura: "greek_c15_floor" },
    { x0: 36, y0: 38, x1: 42, y1: 48, piso: "lareira", textura: "lodge_c15_floor" }, { x0: 42, y0: 38, x1: 48, y1: 48, piso: "cinema", textura: "hs_carpet_blk" },
    { x0: 48, y0: 38, x1: 54, y1: 48, piso: "pista", textura: "bathroom_floortile3" }, { x0: 54, y0: 38, x1: 60, y1: 48, piso: "bar", textura: "tokyo_c18_floor" },
  ].map((q) => ({ ...q, x0: q.x0 + OX, x1: q.x1 + OX, y0: q.y0 + OY, y1: q.y1 + OY }));
  const rotulos = [
    { texto: "Lareira", x: 39, y: 47.4 }, { texto: "Cinema", x: 45, y: 47.4 },
    { texto: "Pista", x: 51, y: 47.4 }, { texto: "Bar", x: 57, y: 47.4 }, { texto: "Pátio", x: 30, y: 30 },
  ].map((q) => ({ ...q, x: q.x + OX, y: q.y + OY }));

  // Divisórias sobre as arestas [x0,y0,x1,y1]. "vaos" são as portas: trechos
  // [de, até) sem parede ao longo da aresta. Três alturas: alta (118 px, só a
  // parede do prédio e a do fundo de cada sala), média (82 px, fundo e lado
  // dos espaços comuns, com o painel do acervo) e baixa (46 px, todo o resto).
  const divisorias = [];
  const parede = (x0, y0, x1, y1, vaos = [], opcoes = {}) => {
    const ehX = y0 === y1, ini = ehX ? x0 : y0, fim = ehX ? x1 : y1;
    const por = (d) => {
      const r = [d[0] + OX, d[1] + OY, d[2] + OX, d[3] + OY];
      if (opcoes.sala) { r.push(opcoes.sala.cor); r.sala = opcoes.sala.id; r.alt = 118; }
      else if (opcoes.amb) { r.push(opcoes.amb.cor); r.estilo = opcoes.amb.estilo; r.textura = opcoes.amb.texturaParede; r.alt = 82; }
      else r.baixa = true;
      divisorias.push(r);
    };
    let a = ini;
    for (const [de, ate] of [...vaos].sort((p, q) => p[0] - q[0])) {
      if (de > a) por(ehX ? [a, y0, de, y0] : [x0, a, x0, de]);
      a = Math.max(a, ate);
    }
    if (fim > a) por(ehX ? [a, y0, fim, y0] : [x0, a, x0, fim]);
  };
  const amb = (id) => ambientes.find((x) => x.id === id);
  const rel = (a) => ({ x0: a.x0 - OX, x1: a.x1 - OX, y0: a.y0 - OY, y1: a.y1 - OY });
  // Fachadas das salas: caixa fechada com as quatro paredes altas na cor da
  // sala e o vão da porta (2 ladrilhos) no lado da entrada. A parede lateral
  // partilhada com a fachada vizinha é desenhada uma vez só.
  const fachadas = ambientes.filter((x) => x.pessoal).map((x) => x.fachada);
  for (const s of ambientes.filter((x) => x.pessoal)) {
    const a = rel(s.fachada), opc = { sala: s };
    const m = { x: a.x0 + L / 2 - 1, y: a.y0 + L / 2 - 1 };
    parede(a.x0, a.y0, a.x1, a.y0, [], opc);
    if (!fachadas.some((o) => o.x1 === s.fachada.x0 && o.y0 === s.fachada.y0)) parede(a.x0, a.y0, a.x0, a.y1, [], opc);
    parede(a.x0, a.y1, a.x1, a.y1, s.porta === "baixo" ? [[m.x, m.x + 2]] : [], opc);
    parede(a.x1, a.y0, a.x1, a.y1, s.porta === "direita" ? [[m.y, m.y + 2]] : [], opc);
  }
  // Espaços comuns. Fundo (y0) e esquerda (x0) médios quando dão para
  // corredor ou pátio; baixos quando são a parede de outro espaço.
  const R = Object.fromEntries(["reuniao", "cafe", "jogos", "auditorio", "foco", "academia", "producao", "recepcao", "lounge"].map((id) => [id, rel(amb(id))]));
  // Reunião: painel escuro no fundo e na esquerda; porta para o pátio.
  parede(R.reuniao.x0, R.reuniao.y0, R.reuniao.x1, R.reuniao.y0, [], { amb: amb("reuniao") });
  parede(R.reuniao.x0, R.reuniao.y0, R.reuniao.x0, R.reuniao.y1, [], { amb: amb("reuniao") });
  parede(R.reuniao.x1, R.reuniao.y0, R.reuniao.x1, R.reuniao.y1, [[15, 17]]);
  parede(R.reuniao.x0, R.reuniao.y1, R.reuniao.x1, R.reuniao.y1);
  // Café: azulejo no fundo; a esquerda dá para o pátio, baixa, com a porta.
  parede(R.cafe.x0, R.cafe.y0, R.cafe.x1, R.cafe.y0, [], { amb: amb("cafe") });
  parede(R.cafe.x0, R.cafe.y0, R.cafe.x0, R.cafe.y1, [[15, 17]]);
  parede(R.cafe.x0, R.cafe.y1, R.cafe.x1, R.cafe.y1);
  // Jogos: fundo médio; a esquerda é a parede do Café (baixa); porta embaixo.
  parede(R.jogos.x0, R.jogos.y0, R.jogos.x1, R.jogos.y0, [], { amb: amb("jogos") });
  parede(R.jogos.x0, R.jogos.y0, R.jogos.x0, R.jogos.y1);
  parede(R.jogos.x0, R.jogos.y1, R.jogos.x1, R.jogos.y1, [[53, 55]]);
  // Auditório: fundo e esquerda médios; porta para o pátio.
  parede(R.auditorio.x0, R.auditorio.y0, R.auditorio.x1, R.auditorio.y0, [], { amb: amb("auditorio") });
  parede(R.auditorio.x0, R.auditorio.y0, R.auditorio.x0, R.auditorio.y1, [], { amb: amb("auditorio") });
  parede(R.auditorio.x1, R.auditorio.y0, R.auditorio.x1, R.auditorio.y1, [[28, 30]]);
  parede(R.auditorio.x0, R.auditorio.y1, R.auditorio.x1, R.auditorio.y1);
  // Foco: fundo médio; esquerda baixa para o pátio, com a porta.
  parede(R.foco.x0, R.foco.y0, R.foco.x1, R.foco.y0, [], { amb: amb("foco") });
  parede(R.foco.x0, R.foco.y0, R.foco.x0, R.foco.y1, [[28, 30]]);
  parede(R.foco.x0, R.foco.y1, R.foco.x1, R.foco.y1);
  // Academia: fundo médio com a porta; esquerda é a parede do Foco (baixa).
  parede(R.academia.x0, R.academia.y0, R.academia.x1, R.academia.y0, [[53, 55]], { amb: amb("academia") });
  parede(R.academia.x0, R.academia.y0, R.academia.x0, R.academia.y1);
  parede(R.academia.x0, R.academia.y1, R.academia.x1, R.academia.y1);
  // Produção: fundo médio com a porta para o corredor; a direita dá na
  // Recepção (baixa, com porta); estúdio separado da edição por divisória baixa.
  parede(R.producao.x0, R.producao.y0, R.producao.x1, R.producao.y0, [[10, 12]], { amb: amb("producao") });
  parede(R.producao.x1, R.producao.y0, R.producao.x1, R.producao.y1, [[42, 44]]);
  parede(9, 38, 9, 44);
  // Recepção: aberta para o pátio (sem parede no fundo); a direita dá no
  // Lounge (baixa, com porta).
  parede(R.recepcao.x1, R.recepcao.y0, R.recepcao.x1, R.recepcao.y0 + 10, [[43, 45]]);
  // Lounge: fundo médio com duas portas (Lareira e Pista); divisórias baixas
  // entre os quatro espaços; a frente abre para o terraço (Cinema e Bar).
  parede(R.lounge.x0, R.lounge.y0, R.lounge.x1, R.lounge.y0, [[40, 42], [49, 51]], { amb: amb("lounge") });
  parede(42, 38, 42, 42); parede(48, 38, 48, 42); parede(54, 38, 54, 42);
  // Fachada e lateral direita do prédio (baixas): porta da rua na Recepção,
  // saídas do Lounge para o terraço.
  parede(0, 48, 24, 48); parede(24, 48, 36, 48, [[28, 32]]); parede(36, 48, 60, 48, [[44, 46], [56, 58]]);
  parede(60, 0, 60, 48);

  // Móveis: [classe, x, y, direção, estado, altura (em cima de mesa / na parede)]
  const m = [];
  const p = (classe, x, y, dir = 2, estado = 0, altura = 0) => m.push([classe, x + OX, y + OY, dir, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura]);
  // Dentro de um espaço comum: coordenadas locais ao canto dele.
  const em = (id) => { const a = R[id]; return (classe, lx, ly, dir = 2, estado = 0, altura = 0) => p(classe, a.x0 + lx, a.y0 + ly, dir, estado, altura); };

  // Pátio (24–36 × 0–38): fonte no meio, bancos em volta, pilares com
  // plantas nas pontas e o elevador junto da parede do fundo (logo da Vybe).
  p("bazaar_r17_fountain", 29, 22, 4);
  p("greek_c15_bench", 26, 22, 2); p("greek_c15_bench", 33, 22, 6); p("greek_c15_bench", 29, 19, 4); p("greek_c15_bench", 29, 25, 0);
  for (const [x, y] of [[25, 1], [34, 1], [25, 14], [34, 14], [25, 30], [34, 30], [25, 36], [34, 36]]) p("suncity_c19_plantpillar", x, y, 0);
  p("br_c25_stonebench", 26, 4, 2); p("br_c25_stonebench", 33, 4, 6);
  p("hotel_c18_fountain", 27, 10, 0); p("hotel_c18_fountain", 32, 10, 0);
  p("garden_r21_plantwall", 24, 32, 2); p("garden_r21_plantwall", 34, 32, 2);
  p("bohogarden_c21_fanpalm", 24, 8, 2); p("bohogarden_c21_fanpalm", 35, 8, 2);

  // Recepção (24–36 × 38–48): o balcão à esquerda, de frente para quem
  // entra; espera com sofás à direita; o pátio segue reto até o fundo.
  {
    const q = em("recepcao");
    q("lodge_dark_desk", 3, 4, 2); q("modern_c17_chair", 2, 5, 2);
    q("hygge_c25_desklamp", 3, 4, 2, 1, 1.25); q("computer_flatscreen", 3, 6, 2, 1, 1.25); q("giftflowers", 3, 5, 2, 0, 1.25);
    q("js_exe_rug", 7, 4, 0); q("js_exe_sofa", 7, 4, 4); q("modern_c17_lowtable", 7, 5, 2); q("js_exe_sofa", 7, 6, 0);
    q("darkmodern_c20_reads", 8, 5, 2, 0, 0.95);
    q("modern_c17_floorlamp", 10, 4, 2, 1); q("darkmodern_c20_pug", 10, 7, 2, 1);
    q("mafia_c26_planter_white", 1, 8, 0); q("mafia_c26_planter_white", 10, 1, 0);
    q("bohogarden_c21_snakeplant", 2, 9, 2); q("bohogarden_c21_snakeplant", 9, 9, 2);
    q("waasa_aquarium", 10, 8, 4); q("hygge_r25_toastcat", 11, 6, 4); q("lc_medusa1", 1, 9, 0);
    // Revisteiro ao lado da espera e lixeira atrás do balcão.
    q("tokyo_c18_magazinerack", 10, 5, 2); q("ktchn_trash", 1, 1, 2);
  }

  // Produção (0–24 × 38–48). Estúdio (0–9): set de entrevista sobre a luz
  // de piso, refletores, câmera e mesa de som com a cadeira do operador.
  // Edição (9–24): estações com dois monitores no fundo e na divisória do
  // estúdio; mesa de revisão no meio.
  {
    const q = em("producao");
    q("bohogarden_c21_snakeplant", 0, 0, 2); q("studio_floorlight", 1, 0, 0, 1);
    q("mafia_c26_armchair_white", 1, 2, 2); q("hc26_3", 2, 2, 2); q("mafia_c26_armchair_white", 4, 2, 6);
    q("spotlight", 6, 1, 6); q("spotlight", 0, 5, 0); q("studio_camera", 7, 4, 6);
    q("studio_mixingdesk", 1, 8, 0, 1); q("studio_chair", 3, 7, 4);
    for (const x of [12, 15, 18, 21]) { q("hc_exe_wrkdesk", x, 0, 4); q("army_c15_leatherchr", x, 1, 0); }
    for (const y of [2, 4]) { q("hc_exe_wrkdesk", 9, y, 2); q("army_c15_leatherchr", 10, y, 6); }
    q("exe_c15_printer", 14, 0, 0, 1);
    q("hc_exe_table", 15, 5, 0);
    for (const x of [15, 16, 17]) q("modern_c17_chair", x, 7, 0);
    q("modern_c17_chair", 14, 5, 2); q("modern_c17_chair", 18, 6, 6);
    q("matic_water_dispenser", 23, 2, 4); q("theatre_plant", 23, 9, 2); q("bohogarden_c21_snakeplant", 20, 9, 2);
    q("uni_vinyl", 17, 0, 4, 0, 1.6); q("pixel_painting_red", 20, 0, 4, 0, 1.2);
    q("fxbox_fx16", 3, 3, 2);
    q("books_1", 15, 5, 2, 0, 1.1); q("darkmodern_c20_folder", 16, 5, 2, 0, 1.1);
    // Arte na parede do estúdio, arandela no canto da edição, lixeira e tapete.
    q("hc3_walldeco", 3, 0, 4, 0, 1.2); q("hc_wall_lamp", 23, 0, 4, 1, 1.3); q("ktchn_trash", 22, 9, 0); q("usva_rug", 15, 6, 0);
  }

  // Sala de reunião (12–24 × 12–21), paredes escuras: mesa comprida no
  // meio, cadeiras dos dois lados, quadro branco na esquerda e o telão no fundo.
  {
    const q = em("reuniao");
    q("army_c15_contable2", 4, 4, 0); q("army_c15_contable", 5, 4, 0); q("army_c15_contable", 7, 4, 0); q("army_c15_contable2", 9, 4, 0);
    for (let x = 4; x <= 9; x++) { q("army_c15_leatherchr", x, 3, 4); q("army_c15_leatherchr", x, 5, 0); }
    q("uni_c23_whiteboard", 0, 4, 2);
    q("army_c15_cabinet", 1, 0, 4); q("army_c15_cabinet", 2, 0, 4); q("army_c15_cabinet", 3, 0, 4);
    q("plant_yukka", 0, 0, 0); q("plant_yukka", 11, 8, 0); q("plant_yukka", 11, 0, 0);
    q("army15_largescreen", 7, 0, 4, 1, 1); q("pixel_clock_black", 10, 0, 4, 0, 1.4);
    q("army_c15_deskcomp", 5, 4, 4, 0, 1.05); q("ktchn10_tea", 7, 4, 2, 0, 1.05); q("books_1", 8, 4, 2, 0, 1.05); q("army_c15_deskcomp", 9, 4, 4, 0, 1.05);
    // Tapete sob a mesa; quadro e arandela na parede da esquerda; lixeira no canto.
    q("carpet_standard", 5, 3, 2); q("attic15_painting", 0, 2, 2, 0, 1.2); q("hc_wall_lamp", 0, 7, 2, 1, 1.3); q("ktchn_trash", 11, 1, 2);
  }

  // Café (36–48 × 12–21): bancada com geladeiras, fogão, pia e café no
  // fundo; duas mesas de almoço; máquina de lanche. Azulejo branco.
  {
    const q = em("cafe");
    q("mode_fridge", 0, 0, 0); q("hygge_c25_counter1", 1, 0, 0); q("hygge_c25_counter1", 2, 0, 0);
    q("hygge_c25_stove", 3, 0, 0); q("hygge_c25_counter1", 4, 0, 0); q("hygge_c25_kitchensink", 5, 0, 4);
    q("hygge_c25_counter1", 6, 0, 0); q("hygge_c25_counter1", 7, 0, 0); q("purablk_c16_fridge", 8, 0, 4);
    q("matic_water_dispenser", 10, 0, 4); q("olympics_r16_vendingmchn", 11, 0, 4);
    q("sunsetcafe_c20_coffeemachine", 1, 0, 2, 1, 1.2); q("hygge_c25_microwave", 2, 0, 2, 0, 1.2);
    q("ktchn_knives", 4, 0, 4, 0, 1.3); q("ktchn10_tea", 6, 0, 2, 0, 1.2);
    q("ktchn10_cabnt", 6, 0, 4, 0, 1.5); q("ktchn10_cabnt", 7, 0, 4, 0, 1.5); q("ktchn_c15_cupboard", 3, 0, 4, 0, 1.4);
    for (const x of [2, 7]) {
      q("hc25_12", x, 4, 0);
      for (const dx of [0, 1]) { q("hc26_10", x + dx, 3, 4); q("hc26_10", x + dx, 5, 0); }
    }
    q("diner_tray_6", 2.5, 4, 2, 0, 1.25); q("diner_tray_6", 7.5, 4, 2, 0, 1.25);
    q("bohogarden_c21_fanpalm", 11, 8, 2); q("bohogarden_c21_snakeplant", 0, 8, 2);
    // Lixeira junto da geladeira, quadro em cima dela e tapete sob as mesas.
    q("ktchn_trash", 9, 0, 0); q("pixel_painting_red", 9, 0, 4, 0, 1.3);
    q("usva_rug", 2, 3.5, 0); q("usva_rug", 7, 3.5, 0);
  }

  // Jogos (48–60 × 12–21): fliperamas e pinball no fundo, jukebox e
  // videogame na esquerda, sinuca e pebolim no meio, simuladores à direita.
  {
    const q = em("jogos");
    q("tokyo_c18_retroarcade", 1, 0, 4, 1); q("arcade_c23_space", 2, 0, 4, 1); q("graffiti_r24_arcademachine", 3, 0, 0, 1);
    q("arcade_c23_pinball", 6, 0, 0, 1); q("arcade_c23_cyberpunk", 10, 0, 4, 1);
    q("vwave_r21_jukebox", 0, 3, 2, 1); q("rainyday_c20_retrogames", 0, 6, 2, 1); q("mafia_c26_armchair_dark", 2, 6, 6);
    q("bling15_pooltable", 5, 4, 4); q("ads_aftv_footballtable", 8, 5, 0);
    q("tokyo_c18_racearcade", 11, 3, 6, 1); q("tokyo_c18_racearcade", 11, 4, 6, 1);
    q("theatre_plant", 11, 8, 2); q("army_c15_plant", 0, 8);
    q("uni_vinyl", 5, 0, 4, 0, 1.4);
    // Letreiro de neon piscando no canto e caixas de som junto da jukebox.
    q("tokyo_c18_neonsign1", 11, 0, 0, 1); q("darkmodern_c20_speakers", 0, 2, 2); q("darkmodern_c20_speakers", 0, 4, 2);
  }

  // Auditório (12–24 × 24–34): telão na parede da esquerda, púlpito ao lado,
  // poltronas em três colunas viradas para ele, corredor no meio até a porta.
  {
    const q = em("auditorio");
    q("uni_projector", 0, 3, 2); q("uni_lectern", 1, 7, 2);
    q("spotlight", 1, 0, 2); q("spotlight", 1, 9, 2);
    q("darkmodern_c20_speakers", 0, 0, 2); q("darkmodern_c20_speakers", 0, 9, 2);
    for (const x of [5, 7, 9]) for (const y of [1, 2, 3, 6, 7, 8]) q("theatre_seat", x, y, 6);
    q("bohogarden_c21_snakeplant", 11, 0, 2); q("bohogarden_c21_snakeplant", 11, 9, 2); q("cine_popcorn", 11, 8, 4);
    q("cine_pstr_1", 3, 0, 4, 0, 1); q("cine_pstr_6", 6, 0, 4, 0, 1); q("cine_pstr_8", 9, 0, 4, 0, 1);
    // Passadeira no corredor do meio e arandela na parede da esquerda.
    q("cubie_rug_b", 6, 4, 2); q("hc_wall_lamp", 0, 8, 2, 1, 1.4);
  }

  // Foco (36–48 × 24–34): biblioteca silenciosa. Estantes no fundo, duas
  // mesas de estudo com luminária, canto de leitura com pufe e cadeira suspensa.
  {
    const q = em("foco");
    for (const x of [1, 3, 7, 9]) q("purablk_c16_shelve", x, 0, 4);
    q("uni_libraryshelf", 5, 0, 4, 0, 1);
    for (const x of [2, 7]) {
      q("classic9_table", x, 3, 0); q("classic9_light", x, 3, 2, 1, 0.7); q("classic9_books", x + 1, 4, 2, 0, 0.7);
      for (const dy of [0, 1]) { q("classic9_chair", x - 1, 3 + dy, 2); q("classic9_chair", x + 2, 3 + dy, 6); }
    }
    q("lodge_dark_candle", 7, 4, 2, 0, 0.7);
    q("cubie_rug_b", 2, 7, 0); q("hc26_3", 3, 7, 0); q("cubie_beanbag_b", 2, 7, 2);
    q("hygge_c25_hangingchair", 11, 8, 6); q("modern_c17_floorlamp", 11, 0, 2, 1);
    q("attic15_clock", 0, 0, 2); q("hygge_r25_toastcat", 5, 8, 4);
    q("theatre_plant", 0, 9, 2); q("bohogarden_c21_fanpalm", 11, 9, 2);
    // Livros espalhados, como numa biblioteca de verdade.
    q("bookpile", 4, 8, 0); q("books_0", 9, 8, 2); q("bookpile", 10, 6, 2);
  }

  // Academia (48–60 × 24–34): esteiras no fundo dos dois lados da porta,
  // pesos na esquerda, camas elásticas e bicicletas na direita.
  {
    const q = em("academia");
    for (const x of [1, 2, 3, 8, 9, 10]) q("olympics_c16_treadmill", x, 0, 4);
    q("matic_water_dispenser", 11, 0, 4);
    q("olympics_c16_weightrack", 0, 3, 2); q("olympics_c16_weightrack", 0, 5, 2);
    q("uni_dumbells", 2, 3, 2); q("uni_dumbells", 2, 5, 2);
    q("paris15_bicycle", 11, 2, 4); q("paris15_bicycle", 11, 5, 4);
    q("olympics_c16_trampoline", 8, 6, 2); q("olympics_c16_trampoline", 8, 8, 2);
    q("bohogarden_c21_snakeplant", 0, 9, 2); q("modern_c17_floorlamp", 11, 9, 2, 1);
    q("hc_wall_lamp", 4, 0, 4, 1, 1.4); q("hc_wall_lamp", 7, 0, 4, 1, 1.4);
    // Armários no canto do fundo e tapete de alongamento.
    q("school_locker_b_nosale", 0, 0, 4); q("school_locker_r_nosale", 0, 1, 2); q("usva_rug", 4, 6, 0);
  }

  // Lounge (36–60 × 38–48), da esquerda para a direita: Lareira (sofá e
  // poltronas virados para o fogo), Cinema (dois sofás em fila virados para
  // o telão), Pista do DJ com a jukebox e o Bar.
  {
    const q = em("lounge");
    q("lodge_dark_fireplace", 1, 0, 0, 1); q("hygge_c25_carpet", 1, 2, 0);
    q("darkmodern_c20_lowtable", 2, 3, 2); q("mafia_c26_sofa_dark", 1, 5, 0);
    q("mafia_c26_armchair_dark", 0, 3, 2); q("mafia_c26_armchair_dark", 5, 3, 6);
    q("theatre_plant", 0, 0, 2); q("modern_c17_floorlamp", 5, 8, 2, 1); q("hygge_c18_shelf", 0, 7, 2, 1);
    q("attic15_painting", 3, 0, 4, 0, 1.4); q("lodge_dark_candle", 3, 3, 2, 0, 0.95);
    q("uni_projector", 7, 0, 4); q("hc23_6", 7, 4, 0); q("hc23_6", 7, 6, 0);
    q("modern_c17_floorlamp", 6, 0, 2, 1); q("modern_c17_floorlamp", 11, 0, 2, 1); q("cine_popcorn", 11, 8, 4);
    q("hc25_6", 16, 0, 0, 1); q("disco_c26_jukebox", 12, 1, 2, 1);
    for (const x of [13, 15]) for (const y of [3, 5]) q("disco_c26_floor", x, y, 0, 1);
    q("spotlight", 12, 8, 2); q("spotlight", 17, 8, 6);
    q("disco_c26_discoball", 14, 4, 0, 0, 2.4);
    for (const x of [19, 20, 21, 22]) { q("js_exe_bardesk", x, 4, 0); q("vwave_c21_barstool", x, 5, 0); }
    q("exe_drinks", 20, 4, 4, 0, 0.9); q("exe_drinks", 22, 4, 4, 0, 0.9);
    q("ktchn15_bubblejuicerack", 18, 0, 4, 1); q("lodge_dark_minibar", 21, 0, 4, 1); q("lodge_dark_minibar", 22, 0, 4, 1);
    for (const x of [19, 22]) { q("vwave_c21_bartable", x, 7, 0); q("vwave_c21_barstool", x - 1, 7, 2); q("vwave_c21_barstool", x + 1, 8, 6); }
    q("uni_fairylights", 20, 0, 4, 0, 2); q("modern_c17_floorlamp", 23, 0, 2, 1);
    // Estante de livros junto da lareira; neon e caixas de som na pista.
    // (A pilha de livros saiu da soleira da porta da Recepção.)
    q("lodge_dark_bookcase", 4, 0, 0); q("bookpile", 2, 9, 0);
    q("tokyo_c18_neonsign1", 13, 0, 0, 1); q("darkmodern_c20_speakers", 12, 0, 0); q("darkmodern_c20_speakers", 15, 0, 0);
  }

  // Corredores: plantas nos cantos, longe das portas; canteiros nas vielas
  // entre as fachadas da Produção (ninguém entra ali).
  for (const [x, y] of [[8, 8], [23, 8], [36, 8], [59, 8], [8, 36], [59, 36], [12, 22], [59, 22], [36, 22]]) p("theatre_plant", x, y, 2);
  for (const y of [20, 29]) for (const x of [0, 2]) p("stone_flowerbed", x, y, 0, 1);
  p("hblooza14_hedgediv", 10, 9, 0); p("hblooza14_hedgediv", 48, 9, 0);

  // Portas de verdade nos vãos (abrem quando alguém chega perto; a sala
  // trancada fica com a porta fechada). Ficam na linha da parede:
  // [classe, x, y, dir (0 = vão numa parede de fundo/frente, 2 = de lado), zona].
  // Porta de vidro (val14_gate, 2 ladrilhos) só nos vãos de parede média, onde
  // ela cabe. Nos vãos de parede baixa não há porta: a passagem fica aberta,
  // com a soleira no piso (como nos quartos do Habbo); uma porta de 4 ladrilhos
  // de altura numa parede de 1,5 parecia solta, e o portão baixo virava caixa.
  const portas = [];
  const porta = (classe, x, y, dir, zona) => { p(classe, x, y, dir, 0); portas.push({ classe, x: x + OX, y: y + OY, dir, zona, w: dir === 2 ? 1 : 2, h: dir === 2 ? 2 : 1 }); };
  porta("val14_gate", 53, 24, 0, "academia"); porta("val14_gate", 10, 38, 0, "producao");
  porta("val14_gate", 40, 38, 0, "lounge"); porta("val14_gate", 49, 38, 0, "lounge");
  // Porta de cada fachada: na linha da parede, com a zona da sala (trancada,
  // fica fechada; aberta, pisar atrás dela entra no quarto).
  for (const s of ambientes.filter((x) => x.pessoal)) {
    const a = rel(s.fachada);
    if (s.porta === "baixo") porta("val14_gate", a.x0 + L / 2 - 1, a.y1, 0, s.id);
    else porta("val14_gate", a.x1, a.y0 + L / 2 - 1, 2, s.id);
  }
  // Vãos sem porta (soleira no piso): [x, y, w, h] do trecho de piso do vão.
  const soleiras = [];
  const soleira = (x, y, dir) => soleiras.push({ x: x + OX, y: y + OY, w: dir === 2 ? 1 : 2, h: dir === 2 ? 2 : 1 });
  for (const s of ambientes.filter((x) => x.pessoal)) soleiras.push({ ...s.fachada.soleira });
  soleira(24, 15, 2); soleira(36, 15, 2); soleira(53, 21, 0); soleira(24, 28, 2); soleira(36, 28, 2); soleira(24, 42, 2);
  soleira(28, 48, 0); soleira(30, 48, 0); soleira(36, 43, 2); soleira(44, 48, 0); soleira(56, 48, 0);
  // Elevadores (teletransporte): da Recepção para o fundo do pátio e para a Produção.
  const elevadores = [];
  const elevador = (nome, x, y, dir, sai) => { p("exe_elevator", x, y, dir, 0); elevadores.push({ nome, x: x + OX, y: y + OY, sai: { x: sai[0] + OX, y: sai[1] + OY } }); };
  // O elevador do fundo fica no canto do pátio, fora da frente do logo da Vybe.
  elevador("Recepção", 24, 38, 2, [25, 38]); elevador("Salas", 35, 0, 4, [35, 1]); elevador("Produção", 0, 47, 2, [1, 47]);

  // Terraço do Lounge (36–60 × 48–58): deck com a piscina, espreguiçadeiras
  // com os pés para a água, cadeiras de praia viradas para ela, guarda-sóis,
  // tochas e o aquecedor.
  const piscina = { x0: 42, y0: 50, x1: 56, y1: 55 };
  for (const y of [50, 52, 54]) p("js_c16_lounger", 38, y, 2);
  for (const x of [43, 46, 49, 52]) p("ducket_c26_seachair", x, 56, 0);
  p("ducket_c26_seasidetable", 44, 56, 0); p("ducket_c26_seasidetable", 50, 56, 0);
  p("lido_parasol", 37, 49, 0); p("tiki_parasol", 41, 57, 0); p("tiki_parasol", 57, 51, 0);
  p("tiki_torch", 57, 55, 4); p("tiki_torch", 37, 56, 4); p("bohogarden_c21_fireheater", 58, 49, 0); p("zengarden_r18_fountain", 57, 57, 0);
  p("vwave_c21_palm", 59, 53, 2);
  // Calçada da entrada (x 28–32, livre até a rua) com postes, canteiros e
  // bancos; jardins dos dois lados.
  for (const y of [50, 56, 62]) { p("suncity_c19_streetlight", 27, y, 0, 1); p("suncity_c19_streetlight", 32, y, 0, 1); }
  for (const y of [53, 59]) { p("stone_flowerbed", 24, y, 0, 1); p("stone_flowerbed", 33, y, 0, 1); }
  p("br_c25_stonebench", 25, 56, 2); p("br_c25_stonebench", 34, 56, 6);
  for (const x of [2, 8, 14, 20]) p("stone_flowerbed", x, 49, 0, 1);
  p("lt_c26_banyantree", 4, 54, 2);
  for (const [x, y] of [[12, 58], [20, 53], [8, 63], [17, 63]]) p("olympus_c25_olivetree", x, y, 2);
  for (const [x, y] of [[10, 51], [14, 55]]) p("br_c25_stonebench", x, y, 0);
  for (const x of [1, 11, 21, 31, 41, 51, 61]) p("vwave_c21_palm", x, 65, 2);
  // Atrás do prédio: palmeiras e árvores que aparecem por cima das paredes.
  for (const x of [4, 14, 44, 54]) p("vwave_c21_palm", x, -3, 2);
  for (const x of [9, 49]) p("olympus_c25_olivetree", x, -7, 2);
  // (Sem árvores na lateral direita: elas ficam na frente do prédio e
  // cobrem Jogos e Academia por dentro.)
  // Jardim com vida: fonte, bebedouro de pássaros com o cardeal, lanternas.
  p("bazaar_r17_fountain", 14, 60, 4); p("garden_birdbath", 6, 58, 0); p("birds_r18_cardinal", 7, 59, 0);
  p("garden_flolamp", 24, 62, 0); p("garden_flolamp", 34, 62, 0); p("jungle_c16_light", 8, 59, 0);

  // Textos e logo pintados nas paredes do prédio: o logo no fim do pátio
  // (quem entra vê de longe) e a frase na parede da esquerda, atrás da Produção.
  const quadros = [
    { tipo: "logo", parede: "x", de: 24, ate: 36 },
    { tipo: "texto", texto: "TÔ NA VYBE", cor: "#ff3b2f", parede: "y", de: 39, ate: 47 },
  ].map((q) => ({ ...q, de: q.de + (q.parede === "x" ? OX : OY), ate: q.ate + (q.parede === "x" ? OX : OY) }));
  // Corredores (linha laranja no meio): o do fundo, os do meio e o da frente.
  const corredores = [[10, 0, 60], [22.5, 12, 24], [22.5, 36, 60], [36, 8, 60]].map(([y, a, b]) => [y + OY, a + OX, b + OX]);
  // Postes (só sem a imagem de fundo) e o letreiro da Vybelândia.
  const postes = [];
  const letreiro = { texto: "VYBELÂNDIA", de: 36 + OX, ate: 58 + OX };
  // Onde se chega sem sala própria (e de onde o mapa confere a circulação).
  const entrada = { x: 30 + OX, y: 45 + OY };
  // Atalhos de câmera ("Ir para").
  const vistas = { salas: [30 + OX, 6 + OY, 0.7], reunioes: [18 + OX, 24 + OY, 0.9], lazer: [48 + OX, 42 + OY, 0.75], externa: [46 + OX, 54 + OY, 0.85] };
  piscina.x0 += OX; piscina.x1 += OX; piscina.y0 += OY; piscina.y1 += OY;
  // Pisos do acervo de fora do prédio (por cima da praça da imagem): gramado,
  // calçada da entrada, deck do terraço e a calçada da rua na frente.
  const texturas = [
    { x0: -10, y0: -12, x1: 70, y1: 0, textura: "country_grass", piso: "grama" },
    { x0: -10, y0: 0, x1: 0, y1: 48, textura: "country_grass", piso: "grama" },
    { x0: 60, y0: 0, x1: 70, y1: 48, textura: "country_grass", piso: "grama" },
    { x0: -10, y0: 48, x1: 28, y1: 66, textura: "country_grass", piso: "grama" },
    { x0: 32, y0: 48, x1: 36, y1: 66, textura: "country_grass", piso: "grama" },
    { x0: 36, y0: 58, x1: 70, y1: 66, textura: "country_grass", piso: "grama" },
    { x0: 60, y0: 48, x1: 70, y1: 58, textura: "country_grass", piso: "grama" },
    { x0: 36, y0: 48, x1: 60, y1: 58, textura: "country_patio", piso: "deck" },
    { x0: 28, y0: 48, x1: 32, y1: 66, textura: "paris_c15_pavement", piso: "praca" },
    { x0: -10, y0: 66, x1: 70, y1: 68, textura: "urban_sidewalk", piso: "praca" },
  ].map((r) => ({ ...r, x0: r.x0 + OX, x1: r.x1 + OX, y0: r.y0 + OY, y1: r.y1 + OY }));
  return { W, H, PREDIO, PISO, ambientes, divisorias, moveis: m, piscina, quadros, corredores, postes, letreiro, pisos, rotulos, entrada, vistas,
    // Corredores com a calçada clara da praça (a mesma da entrada): o chão
    // entre as salas lê como piso, não como vazio.
    texturas, texturaSalas: "rainyday_c20_woodenfloor", texturaCorredor: "paris_c15_pavement", texturaDeck: "country_patio", portas, soleiras, elevadores };
})();
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
// Ambiente do ladrilho na cena atual: no mapa geral só os espaços comuns
// (as salas pessoais são fachadas fechadas); dentro de um quarto, só ele.
function escritorioAmbienteEm(x, y) {
  const q = ESCRITORIO_QUARTO;
  return ESCRITORIO_PLANTA.ambientes.find((a) => (q ? a.id === q : !a.pessoal) && x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1) || null;
}
// Fachada (no mapa geral) que ocupa o ladrilho, e a que tem ali um dos
// ladrilhos de entrada (atrás da porta): pisar nele entra no quarto.
function escritorioFachadaEm(x, y) {
  if (ESCRITORIO_QUARTO) return null;
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.pessoal && x >= a.fachada.x0 && x < a.fachada.x1 && y >= a.fachada.y0 && y < a.fachada.y1) || null;
}
function escritorioFachadaEntradaEm(x, y) {
  if (ESCRITORIO_QUARTO) return null;
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.pessoal && a.fachada.entrada.some((e) => e.x === x && e.y === y)) || null;
}
// Mapa geral: a planta sem o interior das salas (elas viram fachadas).
function escritorioPlantaGeral() {
  const P = ESCRITORIO_PLANTA;
  return { ...P, ambientes: P.ambientes.filter((a) => !a.pessoal), fachadas: P.ambientes.filter((a) => a.pessoal).map((a) => ({ ...a.fachada, id: a.id, nome: a.nome, cor: a.cor })) };
}
// Paredes do quarto (cena própria, coordenadas locais): as duas do fundo
// altas na cor da sala; as da frente baixas, de vidro, com o vão da porta.
function escritorioModeloPlanta(a) {
  return typeof escritorio !== "undefined" ? escritorio.base?.quartos?.plantas?.find(p => p.id === a.planta) : null;
}
function escritorioNivelQuarto(a, x, y) {
  if (x < 0 || y < 0 || x >= 8 || y >= 8) return -1;
  return escritorioModeloPlanta(a)?.celdas[Math.floor(y)]?.[Math.floor(x)] ?? 0;
}
function escritorioParedesDoQuarto(a) {
  const lista = [], L = ESCRITORIO_SALA_LADO, m=L/2-1;
  const por = (x0,y0,x1,y1,alta) => {
    const r=[x0,y0,x1,y1];
    if(alta) {r.push(a.cor); r.sala=a.id; r.alt=118;} else r.baixa=true;
    lista.push(r);
  };
  for(let x=0;x<L;x++) for(let y=0;y<L;y++) {
    if(escritorioNivelQuarto(a,x,y)<0) continue;
    if(escritorioNivelQuarto(a,x,y-1)<0) por(x,y,x+1,y,true);
    if(escritorioNivelQuarto(a,x-1,y)<0) por(x,y,x,y+1,true);
    if(escritorioNivelQuarto(a,x,y+1)<0 && !(a.porta==="baixo" && y===L-1 && x>=m && x<m+2)) por(x,y+1,x+1,y+1,false);
    if(escritorioNivelQuarto(a,x+1,y)<0 && !(a.porta!=="baixo" && x===L-1 && y>=m && y<m+2)) por(x+1,y,x+1,y+1,false);
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
// Planta do quarto de uma sala: só o quarto, a soleira da porta (fora dele;
// pisar nela volta ao mapa) e o escuro em volta, como num quarto do Habbo.
function escritorioPlantaDoQuarto(a) {
  const L = ESCRITORIO_SALA_LADO, m = L / 2 - 1;
  const soleira = a.porta === "baixo" ? { x: m, y: L, w: 2, h: 1 } : { x: L, y: m, w: 1, h: 2 };
  const naSoleira = (x, y) => x >= soleira.x && x < soleira.x + soleira.w && y >= soleira.y && y < soleira.y + soleira.h;
  return {
    W: L + 1, H: L + 1, PREDIO: null, PISO: ESCRITORIO_PLANTA.PISO, quarto: a.id, fixa: true,
    ambientes: [a], divisorias: escritorioParedesDoQuarto(a), moveis: [], piscina: null, quadros: [], corredores: [], postes: [], letreiro: null,
    pisos: [], texturas: [], texturaSalas: ESCRITORIO_PLANTA.texturaSalas, portas: [], elevadores: [], fundo: null, vistas: {},
    rotulos: [{ texto: "Porta · voltar ao mapa", x: soleira.x + soleira.w / 2, y: soleira.y + soleira.h / 2, saida: true }],
    soleiras: [soleira], entrada: escritorioEntradaDaSala(a), saida: { x: soleira.x, y: soleira.y },
    // Só se anda dentro do quarto e na soleira.
    andavel: (x, y) => escritorioNivelQuarto(a,x,y) >= 0 || naSoleira(x, y),
    nivelEm: (x,y) => Math.max(0,escritorioNivelQuarto(a,x,y)),
  };
}
// Corredores e área externa são convivência.
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
  const L = ESCRITORIO_SALA_LADO;
  return a.porta === "direita" ? { x: a.x1 - 2, y: a.y0 + L / 2 - 1 } : { x: a.x0 + L / 2 - 1, y: a.y1 - 2 };
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
