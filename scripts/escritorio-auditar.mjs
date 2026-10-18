// Confere a planta do escritório sem abrir o navegador: móveis sobrepostos,
// móvel atravessando divisória, apoiado no vazio, assento sem acesso e porta
// bloqueada. Cada cena é conferida separada: a Praça, cada espaço comum e o
// quarto de cada sala, com a mobília padrão dela.
// node scripts/escritorio-auditar.mjs  (sai com erro se achar algo)
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ctx = { console, window: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync("vybe-escritorio-planta.js", "utf8") + "\n;globalThis.__P = ESCRITORIO_PLANTA; globalThis.__geral = escritorioPlantaGeral; globalThis.__quarto = escritorioPlantaDoQuarto; globalThis.__sala = escritorioMoveisDaSala; globalThis.__tampos = ESCRITORIO_TAMPOS; globalThis.__cenaMoveis = escritorioMoveisDaCena; globalThis.__praca = ESCRITORIO_PRACA;", ctx);
// O motor de caminhada do mapa (mesma grade e mesmo passo do boneco): blocos
// pisáveis, portões, camas, assentos em cima de bloco, pisos especiais.
vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8") + "\n;globalThis.__grade = mapaMontarGrade; globalThis.__passa = mapaPassa;", ctx);
// A mesma ficha de física do Habbo que o mapa carrega.
ctx.__ficha = JSON.parse(readFileSync("assets/escritorio/habbo/fisica.json", "utf8"));
vm.runInContext("MAPA_FISICA = globalThis.__ficha;", ctx);
const arte = (c) => {
  const f = `assets/escritorio/habbo/${c}.json`;
  if (!existsSync(f)) return null;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const v = j.visualizations.find((v) => v.size === 64);
  // Altura do desenho (maior quadro), para a mesma regra de "rente ao piso" do mapa.
  const alto = Math.max(0, ...Object.values(j.spritesheet?.frames || {}).filter((_, i) => i < 400).map((f) => f.frame?.h || 0));
  const d = j.logic?.model?.dimensions || { x: 1, y: 1, z: 1 }, dirs = Object.keys(v?.directions || {}).map(Number);
  // Item de parede (mesma regra do mapa): não ocupa o piso.
  const parede = dirs.length > 0 && dirs.every((x) => x === 2 || x === 4) && (d.y ?? 1) <= 0.3;
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
const SEM_FOCO_OK = /lounger|stonebench|bench|hangingchair|barstool|treadmill|lifering|rela_rock|olympics_c16_sofa|racearcade/;
const FRENTE = /arcade|pinball|retrogames|jukebox|bookcase|bookshelf|shelve|_shelf|tv$|screen|projector|fireplace|wrkdesk|minibar|fridge|stove|sink|counter|cabinet|cupboard|dispenser|mixingdesk|lectern|whiteboard|coffeemachine|microwave|printer|hc25_6|bardesk|rigpro/;
const ALTO = 92; // px de desenho: acima disso o móvel cobre a parte de baixo do item

// Confere uma cena: a planta (mapa geral ou quarto) e os móveis dela
// ([classe, x, y, dir, estado, altura]). Devolve os problemas encontrados.
function auditar(cena, P, moveis, avisos) {
  const problemas = [], ocup = new Map();
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
      pendurados.push({ classe, x: Math.floor(x), y: Math.floor(y), dir: dir0, w: Math.max(1, Math.round(a.d.x || 1)), alto: a.alto });
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
    const plano = PORTAS.test(classe) || (!(a.d.z > 0.05) && a.alto <= (w + h) * 16 + 12);
    const it = { classe, x: Math.floor(x), y: Math.floor(y), w: Math.round(w) || 1, h: Math.round(h) || 1, dir, altura, estado: m[4] || 0, plano, assento: ASSENTOS.test(classe) };
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
  for (const it of itens) {
    if (!it.altura || DE_TETO.test(it.classe)) continue;
    if (!ocup.has(`${it.x},${it.y}`)) { problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) flutuando`)); continue; }
    const abaixo = itens.filter((o) => o !== it && !o.plano && (o.altura || 0) < it.altura && it.x >= o.x && it.x < o.x + o.w && it.y >= o.y && it.y < o.y + o.h);
    if (!abaixo.length) continue;
    const base = abaixo.reduce((a, b) => (topoDe(b) > topoDe(a) ? b : a)), tampo = topoDe(base);
    // Como no Habbo: só se empilha em cima do que a ficha deixa pôr coisas
    // (canputstuffon). Cadeira, cama, planta e luminária não são base.
    if (!ctx.mapaFisica(base.classe).poe) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) empilhado em cima de ${base.classe}, que no Habbo não aceita nada em cima`));
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
    dim: { x: it.w, y: it.h, z: arte(it.classe)?.d.z ?? 1 }, plano: it.plano, prof: 0 }));
  const g = ctx.__grade(P, naGrade);
  const E = P.entrada;
  const chega = new Set([`${E.x},${E.y}`]), fila = [[E.x, E.y]];
  while (fila.length) {
    const [x, y] = fila.shift();
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
        const alvo = itens.find((o) => o !== it && !o.plano && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
        if (alvo && (FOCO.test(alvo.classe) || (alvo.assento && OLHA[alvo.dir] && ((OLHA[alvo.dir][0] === -dx && OLHA[alvo.dir][1] === -dy) || alvo.dir === it.dir)))) achou = true;
      }
    }
    if (!achou) problemas.push(nomeCena(`${it.classe} (${it.x},${it.y}) virado para o nada (direção ${it.dir})`));
  }
  // Frente do desenho: na arte de 4 direções, 0/2/4/6 olham para −y/+x/+y/−x;
  // na de duas (0 e 2, ou 2 e 4), a frente é sempre para quem olha o mapa:
  // 0 e 4 para +y, 2 para +x. Móvel com frente (estante, fliperama, TV…) não
  // pode ficar de frente para uma parede encostada nele.
  const frenteDe = (it, dirs) => {
    if (dirs.length >= 4) return OLHA[it.dir];
    return { 0: [0, 1], 2: [1, 0], 4: [0, 1] }[it.dir];
  };
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
      const alto = itens.find((o) => !o.plano && !o.altura && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && (arte(o.classe)?.alto || 0) > ALTO);
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
  for (const q of pendurados) {
    const dv = P.divisorias.find(([x0, y0, x1, y1]) => (q.dir === 4 ? y0 === y1 && y0 === q.y && q.x >= x0 && q.x < x1 : x0 === x1 && x0 === q.x && q.y >= y0 && q.y < y1));
    const alt = dv?.alt ?? (dv?.baixa ? 46 : 118);
    const util = q.alto - q.w * 16;
    if (util > alt + 10) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) não cabe na parede (${Math.round(util)} px de desenho, parede de ${alt})`));
  }
  // Dois itens pendurados no mesmo trecho de parede (um cobre o outro).
  const trechos = new Map();
  for (const q of pendurados) for (let k = 0; k < q.w; k++) {
    const chave = q.dir === 4 ? `x:${q.x + k},${q.y}` : `y:${q.x},${q.y + k}`;
    if (trechos.has(chave)) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) em cima de ${trechos.get(chave)} na parede`));
    else trechos.set(chave, `${q.classe} (${q.x},${q.y})`);
  }
  // Janela só em parede que dá para fora: no mapa, a do prédio; no quarto, as
  // duas paredes altas do fundo. Em parede de dentro ela mostra a própria parede.
  for (const q of pendurados) {
    if (!/window/.test(q.classe)) continue;
    // Fachada de sala ou de espaço comum também é parede de fora (a frente do prédio).
    const naFachada = (P.fachadas || []).some((f) => q.dir === 4 ? q.y === f.y1 && q.x >= f.x0 && q.x < f.x1 : q.x === f.x1 && q.y >= f.y0 && q.y < f.y1);
    const fora = naFachada || (quarto ? (q.dir === 4 ? q.y === quarto.y0 : q.x === quarto.x0) : B && (q.dir === 4 ? q.y === B.y0 : q.x === B.x0));
    if (!fora) problemas.push(nomeCena(`${q.classe} (${q.x},${q.y}) é janela em parede de dentro`));
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
console.log(unicos.length ? unicos.join("\n") : "Planta sem problemas.");
process.exitCode = unicos.length ? 1 : 0;
