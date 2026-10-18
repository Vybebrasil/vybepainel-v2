// Confere a planta do escritório sem abrir o navegador: móveis sobrepostos,
// móvel atravessando divisória, apoiado no vazio, assento sem acesso e porta
// bloqueada. Cada cena é conferida separada: a Praça, cada espaço comum e o
// quarto de cada sala, com a mobília padrão dela.
// node scripts/escritorio-auditar.mjs  (sai com erro se achar algo)
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { silhueta, emComum, camadasDesenho, frenteDaPeca } from "./escritorio-desenho.mjs";

const ctx = { console, window: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8") + "\n;globalThis.__P = ESCRITORIO_PLANTA; globalThis.__geral = escritorioPlantaGeral; globalThis.__quarto = escritorioPlantaDoQuarto; globalThis.__sala = escritorioMoveisDaSala; globalThis.__tampos = ESCRITORIO_TAMPOS; globalThis.__cenaMoveis = escritorioMoveisDaCena; globalThis.__praca = ESCRITORIO_PRACA;", ctx);
// O motor de caminhada do mapa (mesma grade e mesmo passo do boneco): blocos
// pisáveis, portões, camas, assentos em cima de bloco, pisos especiais.
vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8") + "\n;globalThis.__grade = mapaMontarGrade; globalThis.__passa = mapaPassa;", ctx);
// A mesma ficha de física do Habbo que o mapa carrega.
ctx.__ficha = JSON.parse(readFileSync("assets/escritorio/habbo/fisica.json", "utf8"));
vm.runInContext("MAPA_FISICA = globalThis.__ficha;", ctx);
const folhas = new Map();
const folhaArte = (c) => {
  if (!folhas.has(c)) { const f = `assets/escritorio/habbo/${c}.json`; folhas.set(c, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null); }
  return folhas.get(c);
};
const arte = (c) => {
  const f = `assets/escritorio/habbo/${c}.json`;
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const v = j.visualizations.find((v) => v.size === 64);
  // Altura do desenho (maior quadro), para a mesma regra de "rente ao piso" do mapa.
  const alto = Math.max(0, ...Object.values(j.spritesheet?.frames || {}).filter((_, i) => i < 400).map((f) => f.frame?.h || 0));
  const d = j.logic?.model?.dimensions || { x: 1, y: 1, z: 1 }, dirs = Object.keys(v?.directions || {}).map(Number);
  // Item de parede (mesma regra do mapa): não ocupa o piso.
  const ficha = ctx.__ficha[c];
  const parede = ficha ? Boolean(ficha[0] & 16) : dirs.length > 0 && dirs.every((x) => x === 2 || x === 4) && (d.y ?? 1) <= 0.3;
  // Estados em que o desenho se mexe (mais de um quadro na animação).
  const anima = new Set(Object.entries(v?.animations || {}).filter(([, an]) => Object.values(an.layers || {}).some((l) => new Set(Object.values(l.frameSequences?.[0]?.frames || {}).map((f) => f.id)).size > 1)).map(([e]) => Number(e)));
  return { d, dirs, alto, parede, anima };
};
// Mesma lista de assentos do mapa (lida do código, para não divergir).
const fonteMapa = readFileSync("vybe-escritorio-mapa.js", "utf8");
const ASSENTOS = { test: (c) => ctx.mapaFisica(c).senta };
const PORTAS = /^(val14_gate|exe_gate|ktchn_gate|wildwest_saloondr)$/;
const DE_TETO = /discoball|chandelier|hanging_?lamp|ceiling/;
const INTERATIVOS = /coffee|fridge|water_dispenser|minibar|stove|microwave|school_c22_cafe|treadmill|bicycle|jukebox|hc25_6|pinball|arcade|retrogames|fireplace|floorlight|pooltable|projector|largescreen|_tv$|exe_table/;
const FOCO = /table|desk|rigpro|hc26_2|tv|screen|lectern|stage|fireplace|projector|pooltable|footballtable|bardesk|bartable|counter|whiteboard|dj|hc25_6|jukebox|hc26_3|hc25_12|lowtable|coffeetable|arcade|retrogames|pinball|console|studio_camera|mixingdesk/;
const OLHA = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };
// Cabine (bilheteria) é assento na ficha, mas quem está nela atende quem chega.
const SEM_FOCO_OK = /lounger|stonebench|bench|hangingchair|barstool|treadmill|lifering|rela_rock|olympics_c16_sofa|racearcade|ticket_booth/;
const FRENTE = /arcade|pinball|retrogames|jukebox|bookcase|bookshelf|shelve|_shelf|tv$|screen|projector|fireplace|wrkdesk|minibar|fridge|stove|sink|counter|cabinet|cupboard|dispenser|mixingdesk|lectern|whiteboard|coffeemachine|microwave|printer|hc25_6|bardesk|rigpro/;
// Peça que se usa de pé na frente (máquina, armário, estante): a frente
// precisa dar para chão livre. Balcão, tela e púlpito ficam de frente para
// banqueta ou palco de propósito.
const ABRE = /arcade|pinball|retrogames|jukebox|fridge|vending|minibar|cabinet|cupboard|bookcase|bookshelf|_shelf|locker|_tv$|dispenser|stove|sink|microwave|coffeemachine/;
const ALTO = 92;
// Salas já refeitas com a regra de desenho (o que um móvel cobre do outro e
// a frente das máquinas): nelas é erro; nas outras, aviso até serem refeitas
// (node scripts/escritorio-auditar.mjs --desenho lista os avisos).
const DESENHO_CONFERIDO = new Set(["cafe", "recepcao", "reuniao", "foco", "auditorio", "producao"]);
// Foto da cena (quanto de cada peça aparece): desligável para depurar.
const FOTO = !process.argv.includes("--sem-foto");
const avisosDesenho = []; // px de desenho: acima disso o móvel cobre a parte de baixo do item

// Confere uma cena: a planta (mapa geral ou quarto) e os móveis dela
// ([classe, x, y, dir, estado, altura]). Devolve os problemas encontrados.
function auditar(cena, P, moveis, avisos) {
  const problemas = [], ocup = new Map();
  const desenho = { push: (t) => (DESENHO_CONFERIDO.has(cena) ? problemas : avisosDesenho).push(t) };
  const nomeCena = (t) => (cena === "mapa geral" ? t : `${t} em ${cena}`);
  const B = P.PREDIO, quarto = P.quarto ? P.ambientes[0] : null;
  const parede = new Set();
  for (const [x0, y0, x1, y1] of P.divisorias) {
    if (y0 === y1) for (let x = x0; x < x1; x++) parede.add(`${x},${y0 - 1}|${x},${y0}`);
    else for (let y = y0; y < y1; y++) parede.add(`${x0 - 1},${y}|${x0},${y}`);
  }
  const temParede = (ax, ay, bx, by) => parede.has(`${ax},${ay}|${bx},${by}`) || parede.has(`${bx},${by}|${ax},${ay}`);
  const itens = [], pendurados = [];
  for (const m of moveis) {
    const [classe, x, y, dir0, , altura = 0] = m;
    const a = arte(classe);
    if (!a) { problemas.push(nomeCena(`${classe} (${x},${y}) sem arte no painel`)); continue; }
    if (a.parede) {
      if (![2, 4].includes(dir0)) problemas.push(nomeCena(`${classe} (${x},${y}) de parede com direção ${dir0}`));
      // Revestimento (papel de parede, lambri): fica por baixo dos quadros e
      // atrás dos móveis, de propósito (a regra é a do mapa, mapaEhRevestimento).
      const reveste = ctx.mapaEhRevestimento(a.d, true);
      pendurados.push({ classe, x: Math.floor(x), y: Math.floor(y), rx: x, ry: y, altura, estado: m[4] || 0, dir: dir0, w: Math.max(1, Math.round(a.d.x || 1)), alto: a.alto, reveste });
      continue;
    }
    let dir = dir0;
    if (a.dirs.length && !a.dirs.includes(dir)) {
      dir = a.dirs.includes((dir + 4) % 8) ? (dir + 4) % 8 : a.dirs[0];
      avisos.push(nomeCena(`${classe} (${x},${y}) pedido na direção ${dir0}, desenhado na ${dir}`));
    }
    const w = Math.max(1, dir === 2 || dir === 6 ? a.d.y : a.d.x), h = Math.max(1, dir === 2 || dir === 6 ? a.d.x : a.d.y);
    // Porta (de vidro, de cozinha, de saloon): fica na linha da parede e se
    // atravessa; não ocupa o piso.
    // Peça de passar por baixo (pisável e de altura zero na ficha do Habbo:
    // escada de mão, hera, luzinhas) divide o ladrilho com outra, como no Habbo.
    const fis = ctx.mapaFisica?.(classe);
    const plano = PORTAS.test(classe) || (!(a.d.z > 0.05) && a.alto <= (w + h) * 16 + 12 && (fis?.altura == null || fis.pisa)) || Boolean(fis?.pisa && !fis.senta && (fis.altura ?? 1) <= 0.01 && !ctx.mapaPisoEspecial?.(classe));
    const it = { classe, x: Math.floor(x), y: Math.floor(y), rx: x, ry: y, w: Math.round(w) || 1, h: Math.round(h) || 1, dir, altura, estado: m[4] || 0, plano, assento: ASSENTOS.test(classe) };
    itens.push(it);
    const nome = nomeCena(`${classe} (${it.x},${it.y})`);
    if (it.x < 0 || it.y < 0 || it.x + it.w > P.W || it.y + it.h > P.H) problemas.push(`${nome} sai do mapa`);
    // No quarto, o móvel inteiro fica dentro dele (a soleira é de fora).
    if (quarto && (it.x < quarto.x0 || it.y < quarto.y0 || it.x + it.w > quarto.x1 || it.y + it.h > quarto.y1)) problemas.push(`${nome} sai da sala`);
    for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
      const tx = it.x + i, ty = it.y + j;
      if (i + 1 < it.w && temParede(tx, ty, tx + 1, ty)) problemas.push(`${nome} atravessa a divisória`);
      if (j + 1 < it.h && temParede(tx, ty, tx, ty + 1)) problemas.push(`${nome} atravessa a divisória`);
      if (plano || altura) continue;
      const k = `${tx},${ty}`;
      if (ocup.has(k)) problemas.push(`${nome} em cima de ${ocup.get(k)}`);
      else ocup.set(k, nomeCena(`${classe} (${it.x},${it.y})`));
    }
  }
  // Apoiado: o que tem altura precisa de um móvel embaixo, e na altura do
  // tampo dele (nem flutuando, nem afundado na mesa). Exceção: arte de teto
  // (globo de espelhos), que pende do alto sem móvel embaixo.
  // Pilhas (como no Habbo): a peça apoia no topo mais alto que fica abaixo
  // dela no ladrilho, seja a mesa no chão ou outra peça já empilhada.
  const topoDe = (o) => (o.altura || 0) + (ctx.__tampos[o.classe] ?? ctx.mapaFisica(o.classe).altura ?? (arte(o.classe)?.d.z || 0));
  // Pendurado (mesma regra do mapa, marcarPendurados): peça fina no alto sem
  // nada embaixo na altura dela; passa-se por baixo e não precisa de apoio.
  const PISO_DE_OBRA = { test: (c) => ctx.mapaEhPisoDeObra(c) };
  for (const it of itens) it.pendurado = Boolean(it.altura > 0) && !PISO_DE_OBRA.test(it.classe) && !(topoDe({ ...it, altura: 0 }) > 0.05) &&
    !itens.some((o) => o !== it && !o.parede && o.x < it.x + it.w && o.x + o.w > it.x && o.y < it.y + it.h && o.y + o.h > it.y && (o.altura || 0) < it.altura && topoDe(o) >= it.altura - 0.15);
  for (const it of itens) {
    // Piso de obra no alto fica onde o construtor pôs (no Habbo, pelo
    // empilhador), sobre vigas e colunas; o que vai em cima dele é conferido.
    if (!it.altura || DE_TETO.test(it.classe) || it.pendurado || PISO_DE_OBRA.test(it.classe)) continue;
    // Base: o que está embaixo no ladrilho, inclusive piso de construtor
    // (tábua fina posta no alto, como o mezanino do Café): no Habbo a peça
    // apoia no topo do que estiver embaixo, em qualquer altura.
    // Piso de obra de espessura zero (mármore posto no alto) é base na mesma
    // altura da peça: ela fica rente ao piso, como no chão.
    const abaixo = itens.filter((o) => o !== it && (!o.plano || (o.altura || 0) > 0) && ((o.altura || 0) < it.altura || (PISO_DE_OBRA.test(o.classe) && (o.altura || 0) <= it.altura)) && it.x >= o.x && it.x < o.x + o.w && it.y >= o.y && it.y < o.y + o.h);
    if (!ocup.has(`${it.x},${it.y}`) && !abaixo.some((o) => Math.abs(topoDe(o) - it.altura) <= 0.12)) { problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) flutuando`)); continue; }
    if (!abaixo.length) continue;
    // No empate, a base é o piso de obra (a coluna embaixo da beira não é
    // onde o guarda-corpo apoia: ele apoia no piso do mezanino).
    const base = abaixo.reduce((a, b) => (topoDe(b) > topoDe(a) + 1e-6 || (Math.abs(topoDe(b) - topoDe(a)) <= 1e-6 && PISO_DE_OBRA.test(b.classe)) ? b : a)), tampo = topoDe(base);
    // Como no Habbo: só se empilha em cima do que a ficha deixa pôr coisas
    // (canputstuffon). Cadeira, cama, planta e luminária não são base.
    // Peça de obra (escada, pedestal, bloco, caixote, coluna, piso) se empilha
    // como no empilhador do Habbo; o resto só onde a ficha deixa pôr coisas.
    const OBRA = /stairs|hc25_8|plinth|crate|block|woodtile|pillar|floorboards|_floor\d*$|plankfloor|stackmagic/;
    if (!ctx.mapaFisica(base.classe).poe && !(OBRA.test(base.classe) && OBRA.test(it.classe))) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) empilhado em cima de ${base.classe}, que no Habbo não aceita nada em cima`));
    if (Math.abs(tampo - it.altura) > 0.12) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) na altura ${it.altura}, mas o topo de ${base.classe} fica em ${Math.round(tampo * 100) / 100}`));
  }
  // Assento: precisa de um ladrilho livre ao lado, sem parede no meio, para chegar.
  const livre = (x, y) => x >= 0 && y >= 0 && x < P.W && y < P.H && !ocup.has(`${x},${y}`);
  for (const it of itens) {
    if (!it.assento || it.w > 1 || it.h > 1) continue;
    const acesso = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => livre(it.x + dx, it.y + dy) && !temParede(it.x, it.y, it.x + dx, it.y + dy));
    if (!acesso) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) assento sem acesso`));
  }
  // Portas dos espaços comuns: os dois ladrilhos de cada vão ficam livres dos dois lados.
  if (B) for (const a of P.ambientes) for (const [y, dy] of [[a.y0, -1], [a.y1, 1]]) {
    const meio = Math.floor((a.x0 + a.x1) / 2);
    if (y <= B.y0 || y >= B.y1) continue; // parede do prédio, sem porta
    for (const x of [meio - 1, meio]) {
      if (temParede(x, y - 1, x, y)) continue;
      const dentro = dy < 0 ? y : y - 1;
      if (dentro < a.y0 || dentro >= a.y1) continue;
      if (!livre(x, dentro) && !ocup.get(`${x},${dentro}`)?.startsWith("hygge_c25_carpet")) problemas.push(`porta de ${a.nome} (${x},${dentro}) bloqueada por ${ocup.get(`${x},${dentro}`)}`);
    }
  }
  // Soleiras (do mapa e da porta do quarto) e o piso logo atrás delas ficam livres.
  for (const s of P.soleiras || []) for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) {
    const x = s.x + i, y = s.y + j;
    if (!livre(x, y)) problemas.push(nomeCena(`soleira (${x},${y}) bloqueada por ${ocup.get(`${x},${y}`)}`));
    if (!quarto) continue;
    // Dentro do quarto, o ladrilho encostado na soleira (pelo vão) fica livre.
    const [dx, dy] = quarto.porta === "baixo" ? [0, -1] : [-1, 0];
    if (!livre(x + dx, y + dy)) problemas.push(nomeCena(`porta (${x + dx},${y + dy}) bloqueada por ${ocup.get(`${x + dx},${y + dy}`)}`));
  }
  // Circulação: a partir da entrada da cena, com a grade e o passo do próprio
  // mapa (8 direções, sem cortar quina, degrau de até 1,3, portão fechado é
  // parede). Assim o verificador nunca diverge da física do boneco.
  const pi = P.piscina;
  const naGrade = itens.map((it) => ({ classe: it.classe, x: it.x, y: it.y, dir: it.dir, altura: it.altura, estado: it.estado,
    dim: { x: it.w, y: it.h, z: arte(it.classe)?.d.z ?? 1 }, plano: it.plano, prof: 0, pendurado: it.pendurado }));
  const g = ctx.__grade(P, naGrade);
  const E = P.entrada;
  const chega = new Set([`${E.x},${E.y}`]), fila = [[E.x, E.y]];
  // Teleporte em par (duas cabines do mesmo modelo na cena): quem chega ao
  // lado de uma sai na frente da outra, como no mapa (andar de cima do Café).
  const teles = itens.filter((o) => /teleport|_tele$/.test(o.classe));
  const pares = teles.filter((o) => teles.filter((q) => q.classe === o.classe).length === 2);
  while (fila.length) {
    const [x, y] = fila.shift();
    for (const a of pares) {
      if (Math.abs(a.x - x) > 1 || Math.abs(a.y - y) > 1) continue;
      const b = pares.find((q) => q !== a && q.classe === a.classe), [fx, fy] = OLHA[b.dir] || [0, 1], k = `${b.x + fx},${b.y + fy}`;
      if (!chega.has(k)) { chega.add(k); fila.push([b.x + fx, b.y + fy]); }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!chega.has(k) && ctx.__passa(g, x, y, dx, dy)) { chega.add(k); fila.push([x + dx, y + dy]); }
    }
  }
  // Ilhas: piso por onde se anda que ninguém alcança a partir da porta.
  const ilhas = [];
  for (let x = 0; x < P.W; x++) for (let y = 0; y < P.H; y++) {
    if (g.bloqueado[g.ind(x, y)] || chega.has(`${x},${y}`) || (P.andavel && !P.andavel(x, y))) continue;
    if (quarto ? x >= quarto.x0 && y >= quarto.y0 && x < quarto.x1 && y < quarto.y1 : true) ilhas.push(`${x},${y}`);
  }
  if (ilhas.length) avisosIlhas.push(nomeCena(`piso sem acesso: ${ilhas.join(" ")}`));
  const alcancavel = (it) => {
    for (let x = it.x - 1; x <= it.x + it.w; x++) for (let y = it.y - 1; y <= it.y + it.h; y++)
      if (chega.has(`${x},${y}`)) return true;
    return false;
  };
  for (const a of P.ambientes) {
    let ok = false;
    for (let x = a.x0; x < a.x1 && !ok; x++) for (let y = a.y0; y < a.y1 && !ok; y++) ok = chega.has(`${x},${y}`);
    if (!ok) problemas.push(`não dá para chegar em ${a.nome || a.id}`);
  }
  // Fachadas: a entrada (atrás da porta) e a soleira de cada uma têm caminho.
  for (const f of P.fachadas || []) {
    if (!f.entrada.some((e) => chega.has(`${e.x},${e.y}`))) problemas.push(`a entrada de ${f.id} (${f.entrada[0].x},${f.entrada[0].y}) não tem caminho`);
    if (!chega.has(`${f.saida.x},${f.saida.y}`)) problemas.push(`a soleira de ${f.id} (${f.saida.x},${f.saida.y}) não tem caminho`);
  }
  // No quarto, a soleira (saída) precisa ter caminho a partir da entrada.
  if (quarto && !chega.has(`${P.saida.x},${P.saida.y}`)) problemas.push(nomeCena(`a porta (${P.saida.x},${P.saida.y}) não tem caminho`));
  // Assentos e móveis com ação do E precisam de um ladrilho alcançável ao lado.
  for (const it of itens) {
    // Em cima de mesa (xícara, notebook) é enfeite: quem senta à mesa alcança.
    if (!(it.assento || INTERATIVOS.test(it.classe) || ctx.mapaEhCama?.(it.classe) || ctx.mapaPisoEspecial?.(it.classe)) || it.altura && !it.assento) continue;
    if (!alcancavel(it)) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) sem acesso a pé`));
  }
  // Assento virado para algo: na frente dele (até 5 ladrilhos, na direção em que
  // ele olha) precisa haver mesa, TV/telão, púlpito, palco, lareira ou outro
  // assento virado de volta. Pega "sofá virado para a parede / para o nada".
  for (const it of itens) {
    if (!it.assento || SEM_FOCO_OK.test(it.classe)) continue;
    const [dx, dy] = OLHA[it.dir] || [0, 0];
    let achou = false;
    for (let k = 1; k <= 5 && !achou; k++) {
      // De longe vale olhar um pouco de lado (plateia para o palco/telão).
      const lado = k >= 3 ? 2 : 0;
      for (let i = 0; i < it.w && !achou; i++) for (let j = 0; j < it.h && !achou; j++) for (let l = -lado; l <= lado && !achou; l++) {
        const x = it.x + i + dx * k + (dy ? l : 0), y = it.y + j + dy * k + (dx ? l : 0);
        if (k > 1 && temParede(x - dx, y - dy, x, y)) continue;
        if (pi && x >= pi.x0 && x < pi.x1 && y >= pi.y0 && y < pi.y1) { achou = true; break; }
        const alvo = itens.find((o) => o !== it && (!o.plano || FOCO.test(o.classe)) && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
        // Também vale o que tem tampo no Habbo (balcão de caixotes, bancada):
        // senta-se de frente para onde se apoia o copo.
        if (alvo && (FOCO.test(alvo.classe) || (!alvo.assento && ctx.mapaFisica?.(alvo.classe)?.poe && ctx.mapaFisica(alvo.classe).altura != null) || (alvo.assento && OLHA[alvo.dir] && ((OLHA[alvo.dir][0] === -dx && OLHA[alvo.dir][1] === -dy) || alvo.dir === it.dir)))) achou = true;
      }
    }
    if (!achou) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) virado para o nada (direção ${it.dir})`));
  }
  // Frente do desenho: na arte de 4 direções, 0/2/4/6 olham para −y/+x/+y/−x;
  // na de duas (0 e 2, ou 2 e 4), a frente é sempre para quem olha o mapa:
  // 0 e 4 para +y, 2 para +x. Móvel com frente (estante, fliperama, TV…) não
  // pode ficar de frente para uma parede encostada nele.
  // Na arte de duas direções o número não diz a frente (no armário gótico,
  // a direção 0 já fica comprida ao longo da parede da esquerda): vale a
  // forma. Comprida em x olha para +y; comprida em y olha para +x.
  const frenteDe = (it, dirs) => frenteDaPeca(dirs, it.w, it.h, it.dir, it.classe);
  const contraParede = (x, y, nx, ny) => temParede(x, y, nx, ny) || nx < 0 || ny < 0 || nx >= P.W || ny >= P.H || (P.andavel && !P.andavel(nx, ny));
  // Tela de costas: computador, notebook ou monitor perto de assento precisa
  // olhar para ele (no Habbo a direção do móvel é para onde a tela aponta).
  // Pega o computador da recepção virado para o visitante, não para quem senta.
  const TELA = /computer|laptop|monitor|imac|_pc$|desktop_pc|flatscreen/;
  for (const it of itens) {
    if (!TELA.test(it.classe)) continue;
    const a = arte(it.classe);
    const f = a.dirs.length >= 4 ? OLHA[it.dir] : frenteDe(it, a.dirs);
    if (!f) continue;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const perto = itens.filter((o) => o.assento && Math.abs(o.x + 0.5 - cx) <= 2.1 && Math.abs(o.y + 0.5 - cy) <= 2.1);
    if (!perto.length) continue;
    if (!perto.some((o) => (o.x + 0.5 - cx) * f[0] + (o.y + 0.5 - cy) * f[1] > 0.2)) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) com a tela de costas para quem senta (direção ${it.dir})`));
  }
  // De lado na parede: peça alta e comprida com a ponta encostada numa
  // parede e as costas soltas (no Habbo quem constrói gira até encostar as
  // costas; o número da direção que faz isso muda de peça para peça).
  for (const it of itens) {
    const a = arte(it.classe);
    // Só onde há parede (a Praça é ao ar livre: a borda não é parede).
    if (!P.divisorias.length || it.altura || it.plano || a.parede || it.w === it.h || (a.d.z || 0) < 1.5) continue;
    const [fx, fy] = frenteDe(it, a.dirs) || [0, 0];
    const bx = -fx, by = -fy;
    let costas = 0, ponta = 0;
    for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
      const x = it.x + i, y = it.y + j;
      if ((bx && i + bx >= 0 && i + bx < it.w) || (by && j + by >= 0 && j + by < it.h)) continue;
      if (contraParede(x, y, x + bx, y + by)) costas++;
    }
    // Ponta: o lado curto (perpendicular à frente) encostado na parede.
    const lados = fx ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
    for (const [sx, sy] of lados) for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
      const x = it.x + i, y = it.y + j;
      if ((sx && i + sx >= 0 && i + sx < it.w) || (sy && j + sy >= 0 && j + sy < it.h)) continue;
      if (contraParede(x, y, x + sx, y + sy)) ponta++;
    }
    if (!costas && ponta) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) de lado na parede (direção ${it.dir}): gire para encostar as costas`));
  }
  // Piso escondido atrás de parede: olhando o mapa (linha de visão +x +y),
  // um trecho de parede de fundo mais à frente cobre o ladrilho (recorte no
  // fundo à direita ou na frente à esquerda da planta). Quem anda ali ou o
  // que se põe ali aparece por cima da parede, porque no Habbo toda parede
  // fica atrás de todo móvel e de todo boneco.
  if (P.andavel && P.quarto) {
    const escondidos = [];
    for (let x = 0; x < P.W; x++) for (let y = 0; y < P.H; y++) {
      if (!P.andavel(x, y) || (P.soleiras || []).some((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h)) continue;
      const n = P.nivelEm ? P.nivelEm(x, y) : 0;
      const cobre = P.divisorias.some((dv) => {
        const [x0, y0, x1, y1] = dv, alt = dv.alt ?? 118, horiz = y0 === y1;
        const t = horiz ? y0 - (y + 0.5) : x0 - (x + 0.5);
        if (t <= 0 || (horiz ? y0 === 0 : x0 === 0)) return false;
        const onde = horiz ? x + 0.5 + t : y + 0.5 + t;
        if (onde < (horiz ? x0 : y0) || onde > (horiz ? x1 : y1)) return false;
        const fx = horiz ? Math.min(x1 - 1, Math.floor(onde)) : x0, fy = horiz ? y0 : Math.min(y1 - 1, Math.floor(onde));
        if (!P.andavel(fx, fy)) return false;
        const nv = P.nivelEm ? P.nivelEm(fx, fy) : 0;
        // Um boneco (uns 90 px) no ladrilho já encosta na parede da frente.
        return 32 * t + (n - nv) * 32 < alt + 90;
      });
      if (cobre) escondidos.push(`${x},${y}`);
    }
    if (escondidos.length) problemas.push(nomeCena(`piso escondido atrás de parede recuada: ${escondidos.join(" ")}`));
  }
  // Atrás de uma parede da frente: no Habbo (Nitro, ROOM_DEPTH_OFFSET) toda
  // parede fica atrás de todo móvel. Peça num recanto, atrás de um trecho de
  // parede mais à frente, aparece desenhada por cima dele, como se estivesse
  // pregada na parede (o piano no fundo recuado do Lounge).
  const tela = (x, y, n = 0) => ({ sx: (x - y) * 32, sy: (x + y) * 16 - n * 32 });
  for (const it of itens) {
    const a = arte(it.classe);
    if (it.plano || a.parede || it.pendurado) continue;
    const n = P.nivelEm ? P.nivelEm(it.x, it.y) : 0;
    const esq = tela(it.x, it.y + it.h).sx, dir = tela(it.x + it.w, it.y).sx;
    const baixo = tela(it.x + it.w, it.y + it.h, n).sy, alto = baixo - a.alto - (it.altura || 0) * 32;
    for (const dv of P.divisorias) {
      const [x0, y0, x1, y1] = dv;
      const horiz = y0 === y1;
      if (horiz ? y0 < it.y + it.h || x1 <= it.x - 8 : x0 < it.x + it.w || y1 <= it.y - 8) continue;
      // Só o trecho que fica mesmo à frente (a parede do fundo do próprio canto não conta).
      if (horiz ? y0 === 0 : x0 === 0) continue;
      // Parede de fundo de verdade: com piso logo na frente dela (as bordas
      // da frente e da direita do quarto não são desenhadas na frente).
      const meio = horiz ? [Math.max(x0, Math.min(x1 - 1, it.x)), y0] : [x0, Math.max(y0, Math.min(y1 - 1, it.y))];
      if (P.andavel && !P.andavel(meio[0], meio[1])) continue;
      const nv = P.nivelEm ? P.nivelEm(horiz ? x0 : x0, horiz ? y0 : y0) : 0;
      const alt = dv.alt ?? (dv.baixa ? 46 : 118);
      const l = horiz ? tela(x0, y0).sx : tela(x0, y1).sx, r = horiz ? tela(x1, y0).sx : tela(x0, y0).sx;
      const de = Math.max(esq, l) + 4, ate = Math.min(dir, r) - 4;
      if (de >= ate) continue;
      const piso = (sx) => (horiz ? (sx / 32 + 2 * y0) * 16 : (2 * x0 - sx / 32) * 16) - nv * 32;
      const cruza = [de, ate].some((sx) => Math.min(piso(sx), baixo) - Math.max(piso(sx) - alt, alto) > 8);
      if (cruza) { problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) atrás da parede (${x0},${y0})–(${x1},${y1}): aparece por cima dela`)); break; }
    }
  }
  const limite = quarto || B || { x0: 0, y0: 0, x1: P.W, y1: P.H };
  for (const it of itens) {
    if (!FRENTE.test(it.classe) || it.altura) continue;
    const f = frenteDe(it, arte(it.classe).dirs);
    if (!f) continue;
    const [fx, fy] = f;
    // Ladrilhos da borda da frente e o vizinho logo adiante.
    let contra = 0, total = 0;
    for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
      const x = it.x + i, y = it.y + j;
      if ((fx && (i + fx < 0 || i + fx >= it.w)) || (fy && (j + fy < 0 || j + fy >= it.h))) {
        total++;
        const nx = x + fx, ny = y + fy;
        if (temParede(x, y, nx, ny) || nx < 0 || ny < 0 || nx >= P.W || ny >= P.H || (nx >= limite.x1 && x < limite.x1) || (ny >= limite.y1 && y < limite.y1)) contra++;
      }
    }
    if (total && contra === total) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) de frente para a parede (direção ${it.dir})`));
    // De frente para um móvel ou para um degrau: a frente (tela, porta,
    // prateleira) precisa abrir para o chão onde a pessoa fica, no mesmo nível.
    else if (total && ABRE.test(it.classe)) {
      let fechada = 0;
      for (let i = 0; i < it.w; i++) for (let j = 0; j < it.h; j++) {
        if (!((fx && (i + fx < 0 || i + fx >= it.w)) || (fy && (j + fy < 0 || j + fy >= it.h)))) continue;
        const nx = it.x + i + fx, ny = it.y + j + fy;
        const outro = itens.find((o) => o !== it && !o.plano && !o.altura && nx >= o.x && nx < o.x + o.w && ny >= o.y && ny < o.y + o.h);
        if (outro || (P.alturaEm && P.alturaEm(nx, ny) !== P.alturaEm(it.x + i, it.y + j))) fechada++;
      }
      if (fechada === total) desenho.push(nomeCena(`${it.classe} (${it.x},${it.y}) de frente para um móvel ou degrau (direção ${it.dir})`));
    }
  }
  // Postes (desenhados à parte) não ficam em cima de móvel nem dentro da piscina.
  for (const [x, y] of P.postes || []) {
    if (ocup.has(`${x},${y}`)) problemas.push(`poste (${x},${y}) em cima de ${ocup.get(`${x},${y}`)}`);
    if (pi && x >= pi.x0 && x < pi.x1 && y >= pi.y0 && y < pi.y1) problemas.push(`poste (${x},${y}) dentro da piscina`);
  }
  // Painel fino de parede (largura menor que um ladrilho) não fica encostado de
  // verdade: aparece um ladrilho para fora e torto.
  for (const it of itens) if (/largescreen/.test(it.classe)) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) é painel de parede; use um telão de chão`));
  // Itens de parede: precisam de parede de verdade atrás (divisória da planta
  // ou a do prédio) e não podem ficar atrás de móvel alto encostado nela
  // (computador, luminária, estante, planta grande): um some atrás do outro.
  const paredeEm = (x, y, eixo) => (B ? (eixo === "x" ? y === B.y0 && x >= B.x0 && x < B.x1 : x === B.x0 && y >= B.y0 && y < B.y1) : false)
    || P.divisorias.some(([x0, y0, x1, y1]) => (eixo === "x" ? y0 === y1 && y0 === y && x >= x0 && x < x1 : x0 === x1 && x0 === x && y >= y0 && y < y1));
  for (const q of pendurados) {
    const nome = nomeCena(`${q.classe} (${q.x},${q.y})`);
    for (let k = 0; k < q.w; k++) {
      const x = q.dir === 4 ? q.x + k : q.x, y = q.dir === 4 ? q.y : q.y + k;
      if (!paredeEm(x, y, q.dir === 4 ? "x" : "y")) { problemas.push(`${nome} pendurado sem parede atrás`); break; }
      if (q.reveste) break;
      // Na sala com a foto conferida, quanto o item de parede aparece é medido
      // nela (80% à vista); a regra por ladrilho barrava até quadro acima do sofá.
      const alto = FOTO && DESENHO_CONFERIDO.has(cena) ? null : itens.find((o) => !o.plano && !o.altura && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && (arte(o.classe)?.alto || 0) > ALTO);
      if (alto) { problemas.push(`${nome} atrás de ${alto.classe} (${alto.x},${alto.y})`); break; }
    }
  }
  // Área externa sem deserto (pedido do Paulo, 17/10/2026, com as
  // referências de quartos do Habbo): cada trecho de 6 × 6 por onde se anda
  // fora do prédio tem pelo menos um objeto. Não mede beleza (isso só se vê
  // no zoom), só pega gramado vazio esquecido.
  if (B) for (let x0 = 0; x0 + 6 <= P.W; x0 += 6) for (let y0 = 0; y0 + 6 <= P.H; y0 += 6) {
    const fora = x0 >= B.x1 || y0 >= B.y1;
    if (!fora) continue;
    const algum = itens.some((o) => !o.plano && o.x + o.w > x0 && o.x < x0 + 6 && o.y + o.h > y0 && o.y < y0 + 6)
      || (P.texturas || []).some((r) => r.agua && r.x1 > x0 && r.x0 < x0 + 6 && r.y1 > y0 && r.y0 < y0 + 6)
      || (pi && pi.x1 > x0 && pi.x0 < x0 + 6 && pi.y1 > y0 && pi.y0 < y0 + 6);
    if (!algum) problemas.push(`área externa vazia em (${x0},${y0})–(${x0 + 5},${y0 + 5})`);
  }
  // Item de parede mais alto que a parede: o desenho é empurrado para baixo
  // e a peça aparece rente ao chão (arandela do cinema, por exemplo). A
  // altura que conta é a do desenho menos a inclinação da largura.
  // Na cena (quarto), a parede é a do Habbo: 3,6 níveis mais o acréscimo da
  // sala e o nível mais alto da planta (escritorioTopoDaParede). O item tem
  // que caber da altura em que foi posto até o topo, medido pelo desenho.
  const topoCena = quarto ? 3.6 + Math.max(0, quarto.alturaParedeFixa ?? -1) + Math.max(0, ...(quarto.modelo?.celdas || [[0]]).flat()) : null;
  for (const q of pendurados) {
    if (topoCena != null) {
      const s = silhueta(q.classe, q.dir === 2 ? 2 : 4, q.estado);
      if (!s) continue;
      const ate = (q.altura || 0) + (P.alturaEm?.(q.x, q.y) ?? P.nivelEm?.(q.x, q.y) ?? 0) + (s.h - s.w / 2) / 32;
      if (ate > topoCena + 0.3) desenho.push(nomeCena(`${q.classe} (${q.x},${q.y}) não cabe na parede (o desenho vai até ${ate.toFixed(1)}, a parede acaba em ${topoCena})`));
      continue;
    }
    const dv = P.divisorias.find(([x0, y0, x1, y1]) => (q.dir === 4 ? y0 === y1 && y0 === q.y && q.x >= x0 && q.x < x1 : x0 === x1 && x0 === q.x && q.y >= y0 && q.y < y1));
    const alt = dv?.alt ?? (dv?.baixa ? 46 : 118);
    const util = q.alto - q.w * 16;
    if (util > alt + 10) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) não cabe na parede (${Math.round(util)} px de desenho, parede de ${alt})`));
  }
  // Dois itens pendurados no mesmo trecho de parede (um cobre o outro).
  const trechos = new Map();
  for (const q of pendurados) for (let k = 0; k < q.w; k++) {
    // Revestimento só conflita com outro na mesma faixa de altura (lambri
    // embaixo e papel em cima são duas faixas da mesma parede).
    const chave = (q.reveste ? `r${q.altura}:` : "") + (q.dir === 4 ? `x:${q.x + k},${q.y}` : `y:${q.x},${q.y + k}`);
    // Na sala com foto conferida, dois itens no mesmo trecho em alturas
    // diferentes (prateleira com relógio em cima) valem: a foto cobra que um
    // não tape o outro ("se cobrem na parede").
    if (trechos.has(chave) && !(FOTO && DESENHO_CONFERIDO.has(cena) && !q.reveste)) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) em cima de ${trechos.get(chave)} na parede`));
    else trechos.set(chave, `${q.classe} (${q.x},${q.y})`);
  }
  // Janela só em parede que dá para fora: no mapa, a do prédio; no quarto, as
  // duas paredes altas do fundo. Em parede de dentro ela mostra a própria parede.
  for (const q of pendurados) {
    if (!/window/.test(q.classe)) continue;
    // Fachada de sala ou de espaço comum também é parede de fora (a frente do prédio).
    const naFachada = (P.fachadas || []).some((f) => q.dir === 4 ? q.y === f.y1 && q.x >= f.x0 && q.x < f.x1 : q.x === f.x1 && q.y >= f.y0 && q.y < f.y1);
    // Parede com o vazio atrás (fundo recuado de uma planta em L) também dá para fora.
    const vazioAtras = P.andavel && (q.dir === 4 ? !P.andavel(q.x, q.y - 1) : !P.andavel(q.x - 1, q.y));
    const fora = naFachada || vazioAtras || (quarto ? (q.dir === 4 ? q.y === quarto.y0 : q.x === quarto.x0) : B && (q.dir === 4 ? q.y === B.y0 : q.x === B.x0));
    if (!fora) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) é janela em parede de dentro`));
  }
  // O que um móvel cobre do outro na tela (a grade de ladrilhos não mostra:
  // no Habbo a arte passa do ladrilho). Cada silhueta é posta com a mesma
  // conta do mapa; a de trás é a de parede ou a de ladrilho mais ao fundo.
  // Peça empilhada em cima de outra e tapete não contam.
  const nivel = (x, y) => P.alturaEm?.(x, y) ?? P.nivelEm?.(x, y) ?? 0;
  const naTela = [];
  // Quem fica na frente: a mesma conta do mapa (a do Nitro): ladrilho de
  // origem, altura e a camada mais da frente da arte (z do Habbo). Antes era
  // uma conta própria (soma dos ladrilhos) que discordava do mapa: o vaso
  // pendurado do Café ficava atrás do guarda-corpo e o verificador dizia
  // que estava na frente. Maior = mais atrás.
  const profNitro = (it) => {
    const j = folhaArte(it.classe), v = j?.visualizations?.find((x) => x.size === 64), zs = [];
    for (let i = 0; i < (v?.layerCount || 1); i++) {
      const L = { ...(v?.layers?.[i] || {}), ...(v?.directions?.[it.dir]?.layers?.[i] || {}) };
      if (L.ink === "ADD" || /_sd_/.test(`_${L.tag || ""}_`)) continue;
      zs.push(L.z || 0);
    }
    return ctx.mapaProfundidade(it.rx, it.ry, it.altura || 0) + ctx.mapaProfCamada(zs.length ? Math.max(...zs) : 0, 0);
  };
  const PENDE = /grungelamp|hanginglight|chandelier|ceiling_lamp|lantern/;
  // Pendurada é a peça que o mapa pendura (fina, no alto, sem nada embaixo:
  // lustre, vaso de planta, viga), não só a que tem "lamp" no nome; o vaso
  // atrás do lustre do Café passava porque o nome era outro (18/10/2026).
  // A arte do Habbo de lustre e vaso pendurado já vem no alto com altura
  // zero: conta como pendurada a peça fina e pisável cujo desenho começa
  // acima da cabeça (2 níveis ou mais).
  const pende = (it) => {
    if (it.pende != null) return it.pende;
    let r = PENDE.test(it.classe) || Boolean(it.pendurado);
    if (!r && !it.parede && !/door|teleport|gate/.test(it.classe) && ctx.mapaFisica(it.classe).pisa && (ctx.mapaFisica(it.classe).altura ?? 1) <= 0.11) {
      const s = silhueta(it.classe, it.dir, it.estado, true);
      r = Boolean(s) && (16 - (s.y + s.h)) / 32 + (it.altura || 0) >= 2;
    }
    return (it.pende = r);
  };
  const OBRA_DESENHO = /stairs|hc25_8|plinth|crate|block|woodtile|floorboards|_floor\d*$/;
  for (const it of itens) {
    // Peça plana (tapete, lâmpada pendurada, neon) entra também: não conta
    // para esconder outra (exceto a lâmpada), mas conta no topo da parede.
    // Neon e luz: o brilho (camada de luz) é o que mais aparece; conta.
    let s = silhueta(it.classe, it.dir, it.estado, pende(it) || /neon/.test(it.classe));
    if (!s) continue;
    // Da lâmpada pendurada conta só a ponta (lâmpada e bocal): o fio fino
    // sobe até o teto e cruza o que estiver atrás, como nas referências.
    const inteira = s;
    if (pende(it) && s.h > 60) {
      const corte = s.h - 60, m = s.m.slice(corte * s.w);
      s = { ...s, y: s.y + corte, h: 60, m, n: m.reduce((a, b) => a + b, 0) };
    }
    naTela.push({ it, s, inteira, sx: (it.rx - it.ry) * 32 + s.x, sy: (it.rx + it.ry) * 16 - nivel(it.x, it.y) * 32 + s.y + 16 - it.altura * 32,
      fundo: profNitro(it), nome: `${it.classe} (${it.x},${it.y})`,
      // Para o desenho, "rente ao piso" é pela arte: poste que a ficha deixa
      // pisar (altura zero) continua alto e pode atravessar outra peça.
      plano: it.plano && !pende(it) && (arte(it.classe)?.alto || 0) <= (it.w + it.h) * 16 + 12 });
  }
  for (const q of pendurados) {
    if (q.reveste) continue;
    const s = silhueta(q.classe, q.dir === 2 ? 2 : 4, q.estado);
    if (!s) continue;
    const [ax, ay] = q.dir === 2 ? [q.x, q.ry + 0.5] : [q.rx + 0.5, q.y];
    naTela.push({ it: q, s, parede: true, sx: (ax - ay) * 32 + s.x, sy: (ax + ay) * 16 - nivel(q.x, q.y) * 32 + s.y - 46 - (q.altura || 0) * 32,
      fundo: 1e3, nome: `${q.classe} (${q.x},${q.y})` });
  }
  // Peça encostada na parede não pode passar do topo dela: o que sobra
  // aparece por trás da cornija (neon do palco do Lounge, 18/10/2026).
  // Coluna (peças iguais empilhadas) e cornija cortam o topo de propósito.
  if (quarto) {
    const topo = 3.6 + Math.max(0, quarto.alturaParedeFixa ?? -1) + Math.max(0, ...(quarto.modelo?.celdas || [[0]]).flat());
    for (const t of naTela) {
      const o = t.it;
      if (t.parede || pende(o) || (o.altura || 0) + nivel(o.x, o.y) >= topo - 0.6) continue;
      if (itens.some((q) => q !== o && q.classe === o.classe && q.x === o.x && q.y === o.y)) continue;
      const fundo = o.y === quarto.y0, esquerda = o.x === quarto.x0;
      if (!fundo && !esquerda) continue;
      // Topo da parede na tela, coluna a coluna (desce ao longo da parede):
      // fundo, y = x/2 − topo; esquerda, y = −x/2 − topo (mesma conta do mapa).
      const sx = Math.round(t.sx), sy = Math.round(t.sy);
      let acima = 0;
      for (let i = 0; i < t.s.w; i++) {
        const X = sx + i, linha = Math.min(fundo ? X / 2 : Infinity, esquerda ? -X / 2 : Infinity) - topo * 32;
        for (let j = 0; j < t.s.h && sy + j < linha - 2; j++) if (t.s.m[j * t.s.w + i]) acima++;
      }
      if (acima > 30) desenho.push(nomeCena(`${t.nome} passa do topo da parede: aparece por trás dela`));
    }
  }
  // Foto da cena: cada camada de cada peça posta na tela com a mesma
  // posição e a mesma profundidade do mapa (Nitro: ladrilho de origem,
  // altura e z da camada; tapete na faixa do piso; revestimento na faixa
  // do fundo da parede), e a conta de quanto de cada peça fica à vista.
  // Pega o que as regras de par não pegam: peça cortada, sumida atrás de
  // outra ou desenhada fora do lugar, seja qual for o motivo.
  if (FOTO) {
    const PISO_DE_OBRA_FOTO = { test: (c) => ctx.mapaEhPisoDeObra(c) || /woodtile/.test(c) };
    // Apoiada em cima (em qualquer altura da pilha, no ladrilho da de baixo).
    const empilhadoSobre = (a, b) => (a.altura || 0) > (b.altura || 0) && a.x >= b.x && a.x < b.x + (b.w || 1) && a.y >= b.y && a.y < b.y + (b.h || 1) && !pende(a);
    const camadasFoto = [];
    const donos = [];
    const pos = (it, parede) => parede
      ? (() => { const [ax, ay] = it.dir === 2 ? [it.x, it.ry + 0.5] : [it.rx + 0.5, it.y]; return { sx: (ax - ay) * 32, sy: (ax + ay) * 16 - nivel(it.x, it.y) * 32 - 46 - (it.altura || 0) * 32 }; })()
      : { sx: (it.rx - it.ry) * 32, sy: (it.rx + it.ry) * 16 - nivel(it.x, it.y) * 32 + 16 - (it.altura || 0) * 32 };
    const zDe = (prof, plano) => (plano ? ctx.mapaZPlano(prof) : ctx.mapaZ(prof));
    for (const it of itens) {
      const cs = camadasDesenho(it.classe, it.dir, it.estado);
      if (!cs.length) continue;
      const a = arte(it.classe), alto = Math.max(...cs.map((c) => c.y + c.h)) - Math.min(...cs.map((c) => c.y));
      const fis = ctx.mapaFisica(it.classe);
      // Mesma regra do mapa para "rente ao piso".
      const plano = !it.altura && !(a.d.z > 0.05) && alto <= ((a.d.x || 1) + (a.d.y || 1)) * 16 + 12 && (!ctx.__ficha[it.classe] || fis.pisa);
      const base = ctx.mapaProfundidade(it.rx, it.ry, it.altura || 0), { sx, sy } = pos(it, false);
      const ordem = [...cs].sort((u, v) => u.z - v.z || u.i - v.i);
      const grupo = new Map();
      for (const c of ordem) if (!grupo.has(c.z)) grupo.set(c.z, ctx.mapaProfCamada(c.z, c.i));
      // Superfície (piso de obra, tapete alto na ficha, tábua): existe para
      // ficar embaixo; não se cobra que apareça.
      // Degrau de escada empilhada também é estrutura: o da frente cobre o
      // espelho do de trás, como numa escada de verdade.
      const superficie = plano || PISO_DE_OBRA_FOTO.test(it.classe) || /stairs|steps/.test(it.classe) || alto <= ((a.d.x || 1) + (a.d.y || 1)) * 16 + 12;
      const d = { it, nome: `${it.classe} (${it.x},${it.y})`, plano, superficie, pende: pende(it), parede: false, total: 0, visto: 0, por: new Map() };
      donos.push(d);
      for (const c of cs) camadasFoto.push({ d, c, x: sx + c.x, y: sy + c.y, z: zDe(base + grupo.get(c.z), plano) });
    }
    for (const q of pendurados) {
      const dir = q.dir === 2 ? 2 : 4, cs = camadasDesenho(q.classe, dir, q.estado);
      if (!cs.length) continue;
      // Como no mapa: revestimento inteiro na faixa do fundo da parede; o
      // resto, cada camada na profundidade do z dela (Nitro).
      const baseP = q.dir === 2 ? ctx.mapaProfundidade(q.x - 0.5, q.ry, q.altura || 0) : ctx.mapaProfundidade(q.rx, q.y - 0.5, q.altura || 0);
      const grupoP = new Map();
      for (const c of [...cs].sort((u, v) => u.z - v.z || u.i - v.i)) if (!grupoP.has(c.z)) grupoP.set(c.z, ctx.mapaProfCamada(c.z, c.i));
      const zDaCamada = (c) => (q.reveste ? ctx.mapaZRevestimento(ctx.mapaProfFundoParede(folhaArte(q.classe), dir)) : ctx.mapaZ(baseP + grupoP.get(c.z)));
      const { sx, sy } = pos(q, true);
      const d = { it: q, nome: `${q.classe} (${q.x},${q.y})`, plano: q.reveste, superficie: q.reveste, pende: false, parede: true, total: 0, visto: 0, por: new Map() };
      donos.push(d);
      for (const c of cs) camadasFoto.push({ d, c, x: sx + c.x, y: sy + c.y, z: zDaCamada(c) });
    }
    // Figurantes: a arte do boneco vem do servidor do Habbo e não está
    // aqui; entra uma silhueta do tamanho dele (em pé 28 × 100 px, sentado
    // 28 × 80), no ponto e na profundidade que o mapa dá às pessoas
    // (posicionarPessoa: ladrilho, altura do assento, menos 0,01). Da pessoa
    // conta a cabeça (as 32 linhas de cima): é o que precisa aparecer, e
    // quase inteira (o lustre cobrindo um quarto dela já tapava o rosto).
    for (const f of P.figurantes || []) {
      const sentado = f.acao === "sit";
      const assento = sentado ? itens.find((o) => o.assento && f.x >= o.x && f.x < o.x + o.w && f.y >= o.y && f.y < o.y + o.h) : null;
      const sobe = (P.alturaEm?.(f.x, f.y) ?? 0) + (assento ? (assento.altura || 0) + (ctx.mapaFisica(assento.classe).altura ?? 1) - 1 : 0);
      const w = 28, h = sentado ? 80 : 100, m = new Uint8Array(w * h).fill(1);
      const c = { i: 0, z: 0, luz: false, x: -w / 2, y: -h - 4, w, h, m, n: w * h };
      const d = { it: { classe: "figurante", x: f.x, y: f.y }, assento, nome: `figurante em (${f.x},${f.y})`, plano: false, superficie: false, pende: false, parede: false, pessoa: true, total: 0, visto: 0, por: new Map() };
      donos.push(d);
      camadasFoto.push({ d, c, x: (f.x - f.y) * 32 + c.x, y: (f.x + f.y) * 16 + 16 - sobe * 32 + c.y, z: ctx.mapaZ(ctx.mapaProfundidade(f.x, f.y, sobe) - 0.01) });
    }
    if (camadasFoto.length) {
      const X0 = Math.floor(Math.min(...camadasFoto.map((k) => k.x))), Y0 = Math.floor(Math.min(...camadasFoto.map((k) => k.y)));
      const W = Math.ceil(Math.max(...camadasFoto.map((k) => k.x + k.c.w))) - X0 + 1, H = Math.ceil(Math.max(...camadasFoto.map((k) => k.y + k.c.h))) - Y0 + 1;
      const zbuf = new Float64Array(W * H).fill(-Infinity), dono = new Int32Array(W * H).fill(-1);
      const idx = new Map(donos.map((d, i) => [d, i]));
      // Desenha na ordem do mapa: maior z na frente (empate: a que veio depois, como no DOM).
      camadasFoto.forEach((k, ordem) => { k.ordem = ordem; });
      for (const k of camadasFoto) {
        if (k.c.luz) continue;
        const ox = Math.round(k.x) - X0, oy = Math.round(k.y) - Y0;
        for (let j = 0; j < k.c.h; j++) for (let i = 0; i < k.c.w; i++) {
          if (!k.c.m[j * k.c.w + i]) continue;
          const p = (oy + j) * W + ox + i, zz = k.z + k.ordem * 1e-9;
          if (zz > zbuf[p]) { zbuf[p] = zz; dono[p] = idx.get(k.d); }
        }
      }
      // Conta: de cada peça, os pixels dela que ficaram por cima (a pendurada
      // conta só o vaso ou a lâmpada: as 60 linhas de baixo do desenho).
      // O que está em cima de uma peça (prato na mesa, bolo no prato) e a
      // mesma peça empilhada (coluna, cornija) cobrem de propósito: contam
      // como parte dela.
      // Gente passa na frente do móvel sem ser defeito de montagem; quem está
      // sentado é encoberto pelo encosto da própria cadeira.
      // Cadeira à mesa: a mesa ao lado dela e o que está em cima da mesa a
      // encobrem, como em qualquer mesa de reunião (não é defeito de montagem).
      const daMesa = (assento, o) => !o.parede && !o.pessoa && [o.it, ...itens.filter((b) => empilhadoSobre(o.it, b))].some((b) => b !== assento
        && b.x - 1 <= assento.x && assento.x <= b.x + (b.w || 1) && b.y - 1 <= assento.y && assento.y <= b.y + (b.h || 1) && ctx.mapaFisica(b.classe).poe);
      // Composição intencional: assentos iguais, virados para o mesmo lado,
      // formam a fileira de uma plateia; na plateia em degraus a fileira de
      // trás sempre cobre um pouco a da frente, como num teatro.
      const fileira = (d, o) => !d.parede && !o.parede && !d.pessoa && !o.pessoa && d.it.assento && o.it.assento && d.it.classe === o.it.classe && d.it.dir === o.it.dir;
      const mesmo = (d, o) => o === d || fileira(d, o) || (o.pessoa && !d.pessoa) || (!d.pessoa && !d.parede && d.it.assento && daMesa(d.it, o)) || (d.pessoa && d.assento && daMesa(d.assento, o)) || (d.pessoa && d.assento && o.it === d.assento) || (!d.parede && !o.pessoa && !d.pessoa && !o.parede && ((o.it.classe === d.it.classe && o.it.x === d.it.x && o.it.y === d.it.y) || empilhadoSobre(o.it, d.it)));
      for (const d of donos) {
        if (d.superficie) continue;
        const ks = camadasFoto.filter((k) => k.d === d && !k.c.luz);
        if (!ks.length) continue;
        const fundoY = Math.max(...ks.map((k) => Math.round(k.y) + k.c.h));
        const vistos = new Set();
        for (const k of ks) {
          const ox = Math.round(k.x) - X0, oy = Math.round(k.y) - Y0;
          for (let j = 0; j < k.c.h; j++) {
            if (d.pende && Math.round(k.y) + j < fundoY - 60) continue;
            if (d.pessoa && j >= 32) continue;
            for (let i = 0; i < k.c.w; i++) {
              if (!k.c.m[j * k.c.w + i]) continue;
              const p = (oy + j) * W + ox + i;
              if (vistos.has(p)) continue;
              vistos.add(p);
              d.total++;
              const o = dono[p];
              if (o >= 0 && mesmo(d, donos[o])) d.visto++;
              else if (o >= 0) d.por.set(o, (d.por.get(o) || 0) + 1);
            }
          }
        }
      }
      for (const d of donos) {
        if (d.superficie || d.total < 120) continue;
        const parte = d.visto / d.total, minimo = d.parede ? 0.8 : d.pessoa ? 0.85 : 0.5;
        if (parte >= minimo) continue;
        const [quem] = [...d.por.entries()].sort((a, b) => b[1] - a[1]);
        const culpa = quem ? ` (tapada por ${donos[quem[0]].nome})` : "";
        desenho.push(nomeCena(`${d.nome} quase não aparece: só ${Math.round(parte * 100)}% à vista${culpa}`));
      }
    }
  }
  // A peça está em cima de uma mesa (pode-pôr) encostada ao assento?
  const empilhadoEmMesaAo = (o, assento) => (o.altura || 0) > 0 && itens.some((b) => b !== assento && b !== o && ctx.mapaFisica(b.classe).poe
    && o.x >= b.x && o.x < b.x + (b.w || 1) && o.y >= b.y && o.y < b.y + (b.h || 1)
    && b.x - 1 <= assento.x && assento.x <= b.x + (b.w || 1) && b.y - 1 <= assento.y && assento.y <= b.y + (b.h || 1));
  // Empilhado de verdade: apoiado no topo do de baixo (não só no mesmo ladrilho;
  // um poste que fura o guarda-corpo não é base dele).
  const empilhado = (a, b) => (a.altura || 0) > 0 && a.x >= b.x && a.x < b.x + (b.w || 1) && a.y >= b.y && a.y < b.y + (b.h || 1) && Math.abs(topoDe(b) - a.altura) <= 0.15;
  for (let i = 0; i < naTela.length; i++) for (let j = i + 1; j < naTela.length; j++) {
    let f = naTela[i], t = naTela[j];
    // Duas peças penduradas na mesma parede: nenhuma pode tapar a outra (a
    // lousa do Café cobria metade do quadro, 18/10/2026).
    if (f.parede && t.parede) {
      if (f.it.dir !== t.it.dir) continue;
      const n = emComum(f, t);
      if (n > 40) desenho.push(nomeCena(`${f.nome} e ${t.nome} se cobrem na parede`));
      continue;
    }
    if (Math.abs(f.fundo - t.fundo) < 1e-6 || (!f.parede && !t.parede && (f.plano || t.plano))) continue;
    // Piso de construtor (no chão ou no alto) é superfície: existe para ficar embaixo.
    if (!f.parede && !t.parede && (PISO_DE_OBRA.test(f.it.classe) || PISO_DE_OBRA.test(t.it.classe))) continue;
    // Degrau de escada é estrutura, como o piso (a foto confere o que ele tapa).
    if (f.fundo > t.fundo) [f, t] = [t, f];
    if (!f.parede && !t.parede && /stairs|steps/.test(t.it.classe)) continue;
    // Cadeira à mesa encoberta pelo que está em cima da própria mesa: normal.
    if (!f.parede && !t.parede && t.it.assento && empilhadoEmMesaAo(f.it, t.it)) continue;
    if (empilhado(f.it, t.it) || empilhado(t.it, f.it)) continue;
    const n = emComum(f, t);
    if (!n && !pende(f.it) && !pende(t.it)) continue;
    // Lâmpada pendurada pode passar na frente de prateleira e balcão (como
    // nas referências), mas não de coluna (peça empilhada) nem do que está
    // pendurado na parede (lâmpada na frente da lousa do Café). Na frente
    // de quadro e janela, nem o fio pode cruzar.
    if (pende(f.it) || pende(t.it)) {
      // Duas penduradas: a da frente não pode tapar o vaso ou a lâmpada da de trás.
      if (pende(f.it) && pende(t.it)) {
        if (n > 100 && n > t.s.n * 0.3) desenho.push(nomeCena(`${f.nome} tapa ${t.nome} no alto`));
        continue;
      }
      // A pendurada atrás de um móvel (vaso atrás do guarda-corpo): vale a
      // regra comum, pelo vaso ou pela lâmpada, não pelo fio.
      if (!pende(f.it)) {
        if (n > 40 && n > t.s.n * 0.4) desenho.push(nomeCena(`${f.nome} esconde ${Math.round((n / t.s.n) * 100)}% de ${t.nome}`));
        continue;
      }
      const atras = t, lampada = f;
      if (atras.parede) {
        // O fio só conta perto da parede (até 4 ladrilhos): de longe ele
        // passa bem na frente, como nas referências.
        const longe = atras.it.dir === 4 ? lampada.it.y - atras.it.y > 4 : lampada.it.x - atras.it.x > 4;
        const toda = longe ? lampada : { ...lampada, s: lampada.inteira, sx: lampada.sx - lampada.s.x + lampada.inteira.x, sy: lampada.sy - lampada.s.y + lampada.inteira.y };
        if (emComum(toda, atras) > 40) desenho.push(nomeCena(`${lampada.nome} pendurada na frente de ${atras.nome}`));
        continue;
      }
      const coluna = itens.some((o) => o !== atras.it && o.classe === atras.it.classe && o.x === atras.it.x && o.y === atras.it.y);
      // Na frente de balcão e prateleira pode passar, mas não tapar a metade da peça.
      if (n > 300 && n > atras.s.n * 0.5) { desenho.push(nomeCena(`${lampada.nome} pendurada tapa ${Math.round((n / atras.s.n) * 100)}% de ${atras.nome}`)); continue; }
      if (n > 40 && (atras.parede || coluna)) desenho.push(nomeCena(`${lampada.nome} pendurada na frente de ${atras.nome}`));
      continue;
    }
    // Peça de chão encostada e coisa pendurada no mesmo trecho de parede se
    // misturam (neon do palco atrás do reboco): uma das duas sai dali.
    if (f.parede || t.parede) {
      // Só vale para a peça encostada na mesma parede (fileira 0 para a do
      // fundo, coluna 0 para a da esquerda); a da frente só tapa, por profundidade.
      const pend = f.parede ? f.it : t.it, chao = f.parede ? t.it : f.it;
      if (!(pend.dir === 4 ? chao.y === (quarto?.y0 ?? 0) : chao.x === (quarto?.x0 ?? 0))) continue;
      const menor = Math.min(f.s.n, t.s.n);
      if (n > 150 && n > menor * 0.15) desenho.push(nomeCena(`${f.nome} e ${t.nome} se cobrem na parede`));
      continue;
    }
    // Item de parede (janela, quadro) aparece inteiro ou quase: tapar um
    // quinto já parece peça mal posta.
    // Peças de obra lado a lado (degraus, blocos, pedestais) se encaixam umas
    // nas outras; não é uma escondendo a outra.
    if (OBRA_DESENHO.test(f.it.classe) && OBRA_DESENHO.test(t.it.classe)) continue;
    // Fileira de plateia (assentos iguais virados para o mesmo lado): a de
    // trás cobre um pouco a da frente, como num teatro em degraus.
    if (f.it.assento && t.it.assento && f.it.classe === t.it.classe && f.it.dir === t.it.dir) continue;
    if (n > 300 && n > t.s.n * (t.parede ? 0.2 : 0.4)) desenho.push(nomeCena(`${f.nome} esconde ${Math.round((n / t.s.n) * 100)}% de ${t.nome}`));
  }
  // Regras de interiores (decisão do Paulo, 18/10/2026: "fliperama na
  // frente do palco?"). Peça alta tapa a sala: só encostada nas paredes do
  // fundo e da esquerda, nunca na borda aberta da frente; e a frente de um
  // palco (dois ladrilhos) fica livre para a plateia.
  if (quarto) {
    const ALTA = 110, alta = (o) => !o.plano && !o.altura && (arte(o.classe)?.alto || 0) > ALTA;
    const nv = (x, y) => (P.alturaEm ? P.alturaEm(x, y) : 0);
    const dentro = (x, y) => x >= quarto.x0 && y >= quarto.y0 && x < quarto.x1 && y < quarto.y1 && nv(x, y) >= 0;
    for (const o of itens.filter(alta)) {
      let naFrente = false, encostada = false;
      for (let i = 0; i < o.w; i++) for (let j = 0; j < o.h; j++) {
        const x = o.x + i, y = o.y + j;
        if (!dentro(x + 1, y) || !dentro(x, y + 1)) naFrente = true;
        if (temParede(x, y, x, y - 1) || temParede(x, y, x - 1, y) || x === quarto.x0 || y === quarto.y0) encostada = true;
      }
      if (naFrente && !encostada) desenho.push(nomeCena(`${o.classe} (${o.x},${o.y}) é peça alta na borda da frente: tapa a sala`));
    }
    for (let x = quarto.x0; x < quarto.x1; x++) for (let y = quarto.y0; y < quarto.y1; y++) {
      const h = nv(x, y);
      if (!(h > 0)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        // Patamar alto (mezanino, mais de 2 níveis) é parede para quem está
        // embaixo: só o palco baixo tem plateia na frente.
        if (!dentro(x + dx, y + dy) || nv(x + dx, y + dy) >= h || h - nv(x + dx, y + dy) > 2) continue;
        for (let k = 1; k <= 2; k++) {
          const tx = x + dx * k, ty = y + dy * k;
          const o = itens.find((q) => alta(q) && tx >= q.x && tx < q.x + q.w && ty >= q.y && ty < q.y + q.h);
          if (o) desenho.push(nomeCena(`${o.classe} (${o.x},${o.y}) na frente do palco: tapa quem está nele`));
        }
      }
    }
  }
  return problemas;
}

const avisos = [], problemas = [], avisosIlhas = [];
// A Praça (cena de abertura, camada "geral" do editor).
problemas.push(...auditar("praca", ctx.__geral(), ctx.__cenaMoveis(ctx.__praca), avisos));
// Espaços comuns que viraram cena própria (Café, Lounge…).
for (const a of ctx.__P.ambientes) if (a.cena) {
  const P = ctx.__quarto(a);
  problemas.push(...auditar(a.id, P, ctx.__cenaMoveis(a), avisos));
}
for (const a of ctx.__P.ambientes) if (a.pessoal) {
  const P = ctx.__quarto(a);
  problemas.push(...auditar(a.id, P, ctx.__sala(a), avisos));
}
const unicos = [...new Set(problemas)];
if (process.argv.includes("--direcoes")) console.log([...new Set(avisos)].join("\n"));
if (process.argv.includes("--ilhas")) console.log([...new Set(avisosIlhas)].join("\n"));
if (process.argv.includes("--desenho")) console.log([...new Set(avisosDesenho)].join("\n"));
else if (avisosDesenho.length) console.error(`${new Set(avisosDesenho).size} avisos de desenho nas salas ainda não refeitas (--desenho para ver).`);
console.log(unicos.length ? unicos.join("\n") : "Planta sem problemas.");
process.exitCode = unicos.length ? 1 : 0;
