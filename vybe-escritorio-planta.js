// Planta do escritório: um mapa só, com a divisão que a equipe usava no
// SoWork. Doze salas individuais iguais (7×7), nove com dono e três livres,
// em duas fileiras com corredores de 3 ladrilhos; em volta, os espaços gerais
// e a área externa com piscina.
// Unidade: ladrilho do Habbo (64×32 px). x desce para a direita na tela, y
// desce para a esquerda. Direções do Habbo: 0 olha para −y, 2 para +x,
// 4 para +y, 6 para −x; medidas valem em 0/4 e giram em 2/6.
// Cada ambiente pertence a uma sala de conversa do servidor.
const ESCRITORIO_DONOS = ["Paulo", "Vinícius", "Ewerton", "Deivid", "Bia", "Jady", "Mizinho", "Taynara", "Reriston"];
// Como cada um está no cadastro, quando o nome da sala é apelido ou outra grafia.
const ESCRITORIO_DONOS_CADASTRO = { Bia: ["Beatriz"], Taynara: ["Tainara"] };
const ESCRITORIO_SALA_LADO = 10;
const ESCRITORIO_PLANTA = (() => {
  const W = 76, H = 58;
  const PREDIO = { x0: 0, y0: 0, x1: 68, y1: 47 };
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
  ambiente("cafe", "Café", "convivencia", 42, 0, 54, 9, "cafe");
  ambiente("academia", "Academia", "convivencia", 54, 0, 68, 9, "academia");
  // Salas individuais 10×10: fileira de cima (porta para baixo) e de baixo (porta para cima)
  [...ESCRITORIO_DONOS, "", "", ""].forEach((dono, i) => {
    const linha = i < 6 ? 0 : 1, col = i % 6, y0 = linha ? 25 : 12;
    ambiente("sala-" + i, dono ? "Sala de " + dono : "Sala livre", "criacao", col * L, y0, col * L + L, y0 + L,
      i % 2 ? "madeira" : "clara", { pessoal: true, dono, porta: linha ? "cima" : "baixo" });
  });
  ambiente("foco", "Foco", "foco", 60, 12, 68, 22, "carpete");
  ambiente("jogos", "Jogos", "convivencia", 60, 25, 68, 35, "verde");
  // Frente (y 38–47)
  ambiente("producao", "Produção", "producao", 0, 38, 26, 47, "concreto");
  ambiente("lounge", "Lounge", "convivencia", 26, 38, 68, 47, "madeira");

  // Divisórias sobre as arestas [x0,y0,x1,y1]; portas são vãos de 2 ladrilhos.
  const divisorias = [];
  for (const a of ambientes) if (a.x0 > 0) divisorias.push([a.x0, a.y0, a.x0, a.y1]);
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
  // Auditório: telão na parede da esquerda, púlpito e plateia olhando para ele
  p("cine_projector", 1, 4, 2, 1); p("uni_lectern", 3, 3, 2); p("uni_lectern", 3, 5, 2);
  for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++) p("hc26_10", 6 + f * 2, 1 + c, 6);
  p("easter_c22_fanpalm", 17, 0); p("easter_c22_fanpalm", 17, 8); p("darkmodern_c20_speakers", 0, 1, 2); p("darkmodern_c20_speakers", 0, 7, 2);
  // Reunião: mesa comprida no meio, cadeiras dos dois lados, quadro na parede
  p("army_c15_contable2", 20, 4, 0); for (const x of [21, 23, 25]) p("army_c15_contable", x, 4, 0); p("army_c15_contable2", 27, 4, 0);
  for (let x = 20; x <= 27; x++) { p("army_c15_leatherchr", x, 3, 4); p("army_c15_leatherchr", x, 5, 0); }
  p("uni_c23_whiteboard", 29, 3, 2); p("plant_yukka", 18, 0); p("plant_yukka", 29, 8);
  // Recepção: tapete, balcão, sofá e mesa de centro
  p("hygge_c25_carpet", 34, 3, 0); p("hygge_c25_counter2", 35, 1, 2); p("hygge_c25_counter2", 37, 1, 2);
  p("mafia_c26_sofa_dark", 34, 7, 0); p("mafia_c26_coffeetable_dark", 35, 5, 2);
  p("easter_c22_fanpalm", 30, 0); p("easter_c22_fanpalm", 41, 0); p("darkmodern_c20_pug", 40, 6, 2);
  // Café: bancada no fundo, geladeira, banquetas e mesinhas
  for (let i = 0; i < 3; i++) p("hygge_c25_counter2", 43 + i * 2, 0, 2);
  p("hygge_c25_kitchensink", 49, 0, 4); p("purablk_c16_fridge", 51, 0, 4);
  p("sunsetcafe_c20_coffeemachine", 43, 0, 2, 1, 1.4); p("hygge_c25_microwave", 45, 0, 2, 0, 1.4);
  for (let i = 0; i < 4; i++) p("hygge_c25_barstool", 43 + i * 2, 2, 0);
  for (const x of [44, 49]) { p("darkmodern_c20_lowtable", x, 5, 2); p("hc26_10", x, 4, 4); p("hc26_10", x + 2, 4, 4); p("hc26_10", x, 6, 0); p("hc26_10", x + 2, 6, 0); }
  // Academia
  for (let i = 0; i < 4; i++) p("olympics_c16_treadmill", 56 + i * 2, 1, 4);
  p("school_c22_equipment", 58, 5, 2); p("school_c22_equipment", 62, 5, 2); p("army_c15_plant", 67, 8);
  // Foco: estantes no fundo, poltronas e luminária
  for (let i = 0; i < 4; i++) p("lodge_dark_bookcase", 60 + i * 2, 12, 0);
  p("hygge_c25_armchair", 62, 16, 2); p("hygge_c25_armchair", 65, 16, 6); p("darkmodern_c20_floorlight", 67, 15, 2, 1);
  p("hygge_c25_carpet", 62, 17, 0); p("army_c15_plant", 67, 21);
  // Jogos
  p("bling15_pooltable", 62, 27, 0); p("ads_aftv_footballtable", 65, 31, 0);
  p("darkmodern_c20_tv", 67, 27, 2, 1); p("hygge_c25_hangingchair", 61, 34, 2); p("mafia_c26_armchair_dark", 67, 33, 6);
  // Produção: bancadas com dois monitores, cadeira de frente para a tela
  for (let i = 0; i < 8; i++) {
    const x = 2 + (i % 4) * 6, y = 40 + Math.floor(i / 4) * 4;
    p("exe_table", x, y, 0); p("computer_flatscreen", x, y + 1, 2, 1, 1); p("computer_flatscreen", x + 2, y + 1, 2, 1, 1);
    p("army_c15_leatherchr", x + 1, y - 1, 4);
  }
  p("exe_c15_printer", 25, 38, 2); p("army_c15_plant", 0, 46);
  // Lounge: três ambientes de sofá, TV e plantas
  for (const x of [30, 42]) {
    p("hygge_c25_carpet", x, 40, 0); p("mafia_c26_sofa_dark", x, 39, 0); p("darkmodern_c20_lowtable", x + 1, 41, 2);
    p("mafia_c26_sofa_dark", x, 44, 4); p("mafia_c26_armchair_dark", x + 3, 42, 6);
  }
  p("hc26_5", 55, 40, 2); p("hc26_3", 56, 41, 0); p("darkmodern_c20_tv", 59, 41, 2, 1);
  p("darkmodern_c20_floorlight", 67, 39, 2, 1); p("easter_c22_fanpalm", 67, 46); p("easter_c22_fanpalm", 26, 46);
  p("easter_c22_fanpalm", 38, 46); p("easter_c22_fanpalm", 50, 46);

  // Área externa: piscina (no piso), espreguiçadeiras, guarda-sóis, canteiro,
  // árvores longe do prédio, bancos.
  const piscina = { x0: 34, y0: 49, x1: 48, y1: 54 };
  for (let i = 0; i < 7; i++) p("js_c16_lounger", 34 + i * 2, 55, 0);
  p("tiki_parasol", 33, 55); p("lido_parasol", 42, 55); p("tiki_parasol", 49, 50);
  for (let i = 0; i < 22; i++) p(i % 2 ? "hobbies_c26_flower" : "hobbies_c26_flowerpot2", 1 + i * 3, 48, 2);
  for (const [x, y] of [[3, 53], [70, 55]]) p("lt_c26_banyantree", x, y, 2);
  for (const [x, y] of [[13, 55], [26, 55], [73, 48]]) p("ducket_c26_appletree", x, y, 2);
  for (const [x, y] of [[32, 49], [51, 54], [70, 3], [70, 15], [70, 27], [70, 39]]) p("vwave_c21_palm", x, y, 2);
  for (const [x, y] of [[8, 51], [20, 51], [14, 54]]) p("br_c25_stonebench", x, y, 0);
  for (const [x, y] of [[68, 9], [68, 22], [68, 35]]) p("hobbies_c26_flowerpot2", x, y, 2);

  // Textos e logo pintados nas paredes do fundo (x = parede de cima-direita).
  const quadros = [
    { tipo: "logo", parede: "x", de: 31, ate: 41 },
    { tipo: "texto", texto: "Qual a sua Vybe?", cor: "#ff7a1a", parede: "x", de: 6, ate: 16 },
    { tipo: "texto", texto: "TÔ NA VYBE", cor: "#ff3b2f", parede: "y", de: 14, ate: 20 },
    { tipo: "texto", texto: "É A VYBE, MINHA VIDINHA!", cor: "#ffffff", parede: "y", de: 38, ate: 46 },
  ];
  // Corredores (linha laranja), postes da praça e o letreiro da Vybelândia.
  const corredores = [10.5, 23.5, 36.5];
  const postes = [[2, 48], [12, 48], [24, 48], [52, 48], [62, 48], [69, 6], [69, 18], [69, 30], [69, 42], [45, 52], [30, 52]];
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
const escritorioSemAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Sala individual de cada dono: pelo primeiro nome (sem acento) ou pelo nome
// completo começando por ele. Quem não está na lista não ganha sala; as salas
// livres continuam livres.
function escritorioSalasPessoais(equipe = []) {
  const donos = new Map();
  for (const a of ESCRITORIO_PLANTA.ambientes) {
    if (!a.pessoal || !a.dono) continue;
    const alvos = [a.dono, ...(ESCRITORIO_DONOS_CADASTRO[a.dono] || [])].map(escritorioSemAcento);
    const pessoa = equipe.find((p) => !donos.has(p.id) && alvos.includes(escritorioSemAcento(p.nome).split(/\s+/)[0]))
      || equipe.find((p) => !donos.has(p.id) && alvos.some((alvo) => escritorioSemAcento(p.nome).startsWith(alvo)));
    if (pessoa) donos.set(pessoa.id, a);
  }
  return donos;
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
function escritorioMesaDaSala(a) {
  const mesa = escritorioNaSala(a, 4, 1, 2), cadeira = escritorioNaSala(a, 5, 0);
  return { x: mesa.x, y: mesa.y, w: 3, h: 2, cadeira: { ...cadeira, dir: escritorioDirNaSala(a, 4) } };
}
// Mobília igual em todas as salas: mesa com dois monitores, luminária e
// telefone; duas cadeiras de visita; estantes no fundo; canto de conversa com
// sofá, mesinha e tapete; TV, luminária de chão e plantas nos cantos da porta.
function escritorioMoveisDaSala(a) {
  const item = (classe, lx, ly, dir, estado = 0, altura = 0, prof = 1) => {
    const t = escritorioNaSala(a, lx, ly, prof);
    return [classe, t.x, t.y, escritorioDirNaSala(a, dir), estado, altura];
  };
  const mesa = escritorioMesaDaSala(a);
  return [
    item("exe_table", 4, 1, 0, 0, 0, 2),
    // Monitores de lado (direção 2): a tela aparece para quem olha o mapa.
    ["computer_flatscreen", ...Object.values(escritorioNaSala(a, 4, 2)), 2, 1, 1], ["computer_flatscreen", ...Object.values(escritorioNaSala(a, 5, 2)), 2, 1, 1],
    item("darkmodern_c20_lamp", 6, 2, 0, 1, 1), item("exe_c15_telephone", 6, 1, 0, 0, 1),
    ["army_c15_leatherchr", mesa.cadeira.x, mesa.cadeira.y, mesa.cadeira.dir, 0, 0],
    item("mafia_c26_armchair_dark", 4, 4, 0), item("mafia_c26_armchair_dark", 6, 4, 0),
    item("lodge_dark_bookcase", 0, 0, 0), item("lodge_dark_bookcase", 8, 0, 0),
    item("hygge_c25_carpet", 0, 5, 0, 0, 0, 4), item("hc26_5", 0, 5, 2, 0, 0, 3), item("hc26_3", 2, 5, 0, 0, 0, 2),
    item("darkmodern_c20_tv", 9, 6, 6, 1), item("mafia_c26_armchair_dark", 7, 6, 2),
    item("darkmodern_c20_floorlight", 9, 3, 2, 1),
    item("army_c15_plant", 0, 9, 2), item("plant_yukka", 9, 9, 2),
  ];
}
