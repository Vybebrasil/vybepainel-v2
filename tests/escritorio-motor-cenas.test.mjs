import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { novaCena, frente, peca } from "../scripts/escritorio-construcao.mjs";
import vm from "node:vm";
import { readFileSync } from "node:fs";

test("o que vai em cima apoia no topo do de baixo, e só onde a ficha deixa", () => {
  const s = novaCena("t", { w: 8, h: 8 });
  s.por("val_c20_tablecounter", 1, 1);
  s.emCima(1, 1, ["xmas_c24_plate", "val_c20_cake"]);
  const [, , , , , prato] = s.moveis.find((m) => m[0] === "xmas_c24_plate");
  const [, , , , , bolo] = s.moveis.find((m) => m[0] === "val_c20_cake");
  assert.ok(prato > 1 && bolo > prato, "prato no tampo do balcão e bolo no prato");
  s.por("classic9_chair", 4, 4);
  s.emCima(4, 4, "val_c20_cake");
  assert.match(s.erros.join("\n"), /não aceita nada em cima/);
});

test("móvel não cai em cima de outro e tapete vem antes dos móveis", () => {
  const s = novaCena("t", { w: 8, h: 8 });
  s.por("val_c20_tablecounter", 1, 1);
  s.por("classic9_chair", 2, 1);
  s.tapete("antique_c21_oldenrug", 1, 1, 2, 1);
  assert.match(s.erros.join("\n"), /em cima de val_c20_tablecounter/);
  assert.match(s.erros.join("\n"), /ponha o tapete antes/);
});

test("mesa: cadeiras viradas para ela, tapete centralizado e figurante só na cadeira", () => {
  const s = novaCena("t", { w: 10, h: 10 });
  s.mesa({ x: 4, y: 4, tampo: "paris_c15_table", cadeira: "paris_c15_chair", lados: ["esquerda", "direita", "frente"], tapete: "antique_c21_oldenrug", figurante: { lado: "esquerda", figura: "hd-180-1" } });
  assert.deepEqual(s.erros, []);
  const cad = s.moveis.filter((m) => m[0] === "paris_c15_chair");
  assert.deepEqual(cad.map((m) => [m[1], m[2], m[3]]).sort(), [[3, 4, 2], [4, 5, 0], [5, 4, 6]], "esquerda olha +x, direita −x, frente −y");
  const tapete = s.moveis.find((m) => m[0] === "antique_c21_oldenrug");
  assert.deepEqual([tapete[1], tapete[3]], [3, 2], "3×2 deitado, começando na cadeira da esquerda");
  assert.deepEqual(s.figurantes[0], { figura: "hd-180-1", x: 3, y: 4, dir: 2, acao: "sit" });
  // Mesa de dois lugares (3×1) num tapete 3×2: sobraria só de um lado.
  const t = novaCena("t", { w: 10, h: 10 });
  t.mesa({ x: 4, y: 4, tampo: "paris_c15_table", cadeira: "paris_c15_chair", tapete: "antique_c21_oldenrug" });
  assert.match(t.erros.join("\n"), /mesma sobra dos dois lados/);
});

test("itens de parede ganham espaço pela arte e recusam o que não cabe", () => {
  const s = novaCena("t", { w: 12, h: 8 });
  s.parede("fundo", { de: 0, ate: 3 }, ["school_chalkboard", "attic15_painting"]);
  assert.match(s.erros.join("\n"), /não cabem/);
  const t = novaCena("t", { w: 12, h: 8 });
  t.parede("fundo", { de: 0, ate: 10 }, ["lodge_dark_window", "attic15_painting", "lodge_dark_window"]);
  assert.deepEqual(t.erros, []);
  const xs = t.moveis.map((m) => m[1]);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2], "na ordem pedida, sem se cobrir");
});

test("as cenas geradas estão em dia com as descrições", () => {
  const saida = execFileSync("node", ["scripts/escritorio-compor.mjs", "--conferir"], { encoding: "utf8" });
  assert.match(saida, /em dia/);
});

test("revestimento: altura pelo desenho, por baixo dos quadros e só onde cabe", () => {
  const s = novaCena("t", { w: 10, h: 8, topoParede: 7.6 });
  s.revestir("esquerda", { de: 0, ate: 4, classe: "wildwest_wallpaper" });
  assert.deepEqual(s.erros, []);
  // O papel floral cobre ~7 níveis: em cima do lambri, passa do topo.
  s.revestir("esquerda", { de: 0, ate: 4, altura: 3, classe: "xmas_c24_wallpaper" });
  assert.match(s.erros.join("\n"), /passa do topo da parede|em cima de wildwest_wallpaper/);
  s.parede("esquerda", { de: 0, ate: 4 }, ["wildwest_wallpaper"]);
  assert.match(s.erros.join("\n"), /é revestimento: use revestir/);
});

test("peça pendurada e prateleira flutuante seguem a ficha", () => {
  const s = novaCena("t", { w: 10, h: 8, topoParede: 7.6 });
  // A arte já pende do teto: altura zero passa acima da cabeça.
  s.pendente("val_c20_lights", 4, 4);
  assert.deepEqual(s.erros, []);
  // Somar altura joga o lustre para cima da parede; o vaso de macramê não cabe aqui.
  s.pendente("val_c20_lights", 5, 5, { altura: 3.6 });
  s.pendente("jungle_c16_pot", 6, 6);
  assert.equal(s.erros.filter((e) => /alta demais/.test(e)).length, 2);
  s.pendente("val_c20_tablecounter", 5, 5);
  assert.match(s.erros.join("\n"), /não é peça de pendurar/);
  s.por("recycler_mantelbooks", 3, 3, { flutuante: 2 });
  assert.match(s.erros.join("\n"), /flutuante longe da parede/);
});

test("no mapa, papel de parede fica atrás dos quadros pela camada mais funda do Habbo", () => {
  const ctx = { console, window: {}, document: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync("vybe-escritorio-mapa.js", "utf8") + "\n;globalThis.__f = mapaProfFundoParede;", ctx);
  const dados = (c) => JSON.parse(readFileSync(`assets/escritorio/habbo/${c}.json`, "utf8"));
  const papel = ctx.__f(dados("wildwest_wallpaper"), 2), lousa = ctx.__f(dados("school_chalkboard"), 2), janela = ctx.__f(dados("lodge_dark_window"), 4);
  assert.ok(papel > lousa && lousa > janela, "mais fundo = mais atrás");
});

test("parede do Habbo: posição em pixels e topo da sala vindo da planta", () => {
  const s = novaCena("cafe");
  assert.equal(s.w, 16);
  s.parede("fundo", { de: 2, ate: 9, altura: 0.3 }, ["lodge_dark_window", "attic15_painting"]);
  for (const m of s.moveis) {
    assert.equal(Math.round(m[1] * 32), m[1] * 32, "ao longo da parede, de pixel em pixel (1/32)");
    assert.equal(Math.round(m[5] * 32), m[5] * 32, "na altura, de pixel em pixel");
  }
  // Topo do Café (3,6 + 4): o vaso de macramê passa dele.
  s.pendente("jungle_c16_pot", 6, 6);
  assert.match(s.erros.join("\n"), /parede acaba em 7\.6/);
});

test("escada empilha degraus até o mezanino e passa pelo vão do guarda-corpo", () => {
  const s = novaCena("recepcao", { acabamento: false });
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 7, altura: 3, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"], abertura: [14, 16] });
  assert.ok(!s.moveis.some((m) => m[0] === "greek_block" && m[1] === 14), "sem guarda-corpo no vão");
  s.escada("xmas_c18_stagestairs", 14, 11, [0, -1]);
  const topo = Math.max(...s.moveis.filter((m) => m[0] === "xmas_c18_stagestairs" && m[2] === 7).map((m) => m[5])) + 0.6;
  assert.ok(Math.abs(topo - 3) < 0.05, "o último degrau chega à altura do mezanino");
  assert.deepEqual(s.erros, []);
});

test("acabamento do Café é exigido: cornija, luz e escada", () => {
  const s = novaCena("recepcao");
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 7, altura: 3, piso: "val12_marble1", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"] });
  s.piso("val12_marble1", { x0: 0, y0: 8, x1: 16, y1: 18 });
  const { erros } = s.fechar();
  for (const r of [/cornija/, /pouca luz/, /mezanino sem caminho da porta/, /parecem um só/]) assert.ok(erros.some((e) => r.test(e)), String(r));
});

test("escada é onde dá escada: chega no vão, pé e lados livres; nada embaixo do mezanino", () => {
  const mez = (s) => s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 3, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"], abertura: [12, 14] });
  const fora = novaCena("recepcao", { acabamento: false });
  mez(fora);
  fora.escada("xmas_c18_stagestairs", 4, 9, [0, -1]);
  assert.match(fora.erros.join("\n"), /fora do vão/);
  const s = novaCena("recepcao", { acabamento: false });
  mez(s);
  s.escada("xmas_c18_stagestairs", 12, 9, [0, -1]);
  assert.deepEqual(s.erros, []);
  s.por("mafia_c26_sidetable_white", 12, 10);
  s.por("mafia_c26_sidetable_white", 14, 7);
  s.por("js_exe_bardesk", 7, 2);
  s.por("js_exe_bardesk", 7, 4);
  const e = s.erros.join("\n");
  assert.match(e, /no pé da escada/);
  assert.match(e, /no lado da escada/);
  assert.match(e, /js_exe_bardesk \(7,2\) fica embaixo do mezanino, longe da beira/);
  assert.doesNotMatch(e, /js_exe_bardesk \(7,4\)/, "na fileira da beira pode (o balcão do Café)");
});

test("conjunto de estar no esquadro: mesa centrada, criado ao lado e tapete sem peça pela metade", () => {
  const s = novaCena("t", { w: 12, h: 12, acabamento: false });
  const a = s.estar({ x: 3, y: 3, sofa: "mafia_c26_sofa_white", mesa: "mafia_c26_coffeetable_white", poltrona: "mafia_c26_armchair_white", criado: "mafia_c26_sidetable_white", criados: ["depois"], tapete: "js_exe_rug", sobreMesa: ["magazines"] });
  assert.deepEqual(s.erros, []);
  assert.ok(a.sofa && a.antes && a.depois);
  const mesa = s.moveis.find((m) => m[0] === "mafia_c26_coffeetable_white");
  assert.deepEqual([mesa[1], mesa[2]], [4, 4], "mesa no meio do sofá, colada na frente");
  assert.deepEqual(s.moveis.find((m) => m[0] === "magazines").slice(1, 3), [4, 5], "revista no ladrilho longe do sofá");
  assert.deepEqual(s.moveis.find((m) => m[0] === "mafia_c26_sidetable_white").slice(1, 3), [6, 3], "criado na ponta do sofá");
  const t = novaCena("t", { w: 12, h: 12 });
  t.estar({ x: 3, y: 3, sofa: "mafia_c26_sofa_white", mesa: "mafia_c26_coffeetable_white", poltrona: "mafia_c26_armchair_white", criado: "mafia_c26_sidetable_white", criados: ["antes"] });
  assert.match(t.erros.join("\n"), /lado "antes" fica escondido/);
  const u = novaCena("t", { w: 12, h: 12, acabamento: false });
  u.tapete("usva_rug", 2, 2, 3, 3);
  u.assento("mafia_c26_sofa_white", 1, 2, [2, 5]);
  u.por("mafia_c26_sidetable_white", 1, 1);
  u.fechar();
  assert.match(u.erros.join("\n"), /metade em cima do tapete/);
  assert.match(u.erros.join("\n"), /criado-mudo .* atrás do encosto/);
});

test("parede rica: quantidade, variedade e trecho ocupado", () => {
  const s = novaCena("reuniao");
  s.parede("fundo", { de: 2, ate: 4 }, ["attic15_painting"]);
  const { erros } = s.fechar();
  for (const r of [/parede do fundo pobre/, /parede do fundo repetitiva/, /parede da esquerda vazia/]) assert.ok(erros.some((e) => r.test(e)), String(r));
});

test("composição em vez de cota: canto com função, mesinha com até dois objetos, pouca repetição e guarda-corpo com ritmo", () => {
  const s = novaCena("recepcao");
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 3, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"] });
  s.por("mafia_c26_planter_white", 18, 10);
  s.canto("estar", { funcao: "conversar", destaque: "mafia_c26_sofa_white" });
  s.por("mafia_c26_sidetable_white", 5, 10);
  s.emCima(5, 10, ["antique_c21_books", "antique_c21_books", "wcandle"]);
  for (const x of [6, 8, 10, 12, 14, 16, 18]) { s.por("mafia_c26_sidetable_white", x, 12); s.emCima(x, 12, "magazines"); }
  s.emCima(0, 4, "wcandle", { nivel: 1 });
  s.canto("vazio", { funcao: "nada" });
  const { erros } = s.fechar();
  const e = erros.join("\n");
  assert.match(e, /mafia_c26_planter_white \(18,10\) fora de canto/);
  assert.match(e, /canto "estar": o destaque mafia_c26_sofa_white não está nele/);
  assert.match(e, /com 3 objetos em cima: mesinha leva no máximo dois/);
  assert.match(e, /magazines repetido 7 vezes/);
  assert.match(e, /wcandle \(0,4\) avulso no guarda-corpo/);
  assert.match(e, /canto "vazio" sem ponto de destaque/);
  assert.doesNotMatch(e, /sala pobre/, "sem cota de quantidade");
  const r = novaCena("recepcao", { acabamento: false });
  r.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 3, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"], enfeite: { classes: ["greek_c19_vase1", "wcandle"], cada: 2 } });
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.moveis.filter((m) => /vase1|wcandle/.test(m[0])).map((m) => [m[0], m[1]]), [["greek_c19_vase1", 0], ["wcandle", 4], ["greek_c19_vase1", 8], ["wcandle", 12]], "um a cada dois blocos, alternando");
});

test("sentido: frente conferida na arte, tela olha para quem usa e assento na frente do ponto focal", () => {
  const s = novaCena("t", { w: 12, h: 12, acabamento: false });
  // Escada da varanda: a arte foge da regra (frentes.json); subindo para o
  // norte, o lado de baixo é o sul, que nela é a direção 0.
  assert.deepEqual(frente(peca("hween_c20_porchstairs"), 0), [0, 1]);
  assert.deepEqual(frente(peca("xmas_c18_stagestairs"), 4), [0, 1], "a de palco segue a rosa");
  s.por("lodge_dark_fireplace", 4, 0, { dir: 0 });
  s.assento("exe_chair", 3, 0, [4, 0]);
  s.assento("exe_chair", 3, 1, [4, 0]);
  s.por("army15_ltddesk", 8, 8);
  s.assento("exe_chair2", 8, 7, [8, 8]);
  s.emCima(8, 8, "computer_flatscreen");
  s.emCima(9, 8, "computer_flatscreen", { olha: [9, 7] });
  s.emCima(10, 8, "computer_flatscreen", { olha: [10, 10] });
  const e = s.erros.join("\n");
  assert.match(e, /exe_chair \(3,0\) virado para lodge_dark_fireplace \(4,0\) mas do lado dele/);
  assert.doesNotMatch(e, /exe_chair \(3,1\)/, "na frente do fogo pode");
  assert.match(e, /computer_flatscreen \(8,8\) em cima da mesa sem dizer para quem olha/);
  assert.doesNotMatch(e, /computer_flatscreen \(9,8\)|computer_flatscreen \(10,8\)/, "olhando para o assento ou para o chão livre de quem fica em pé");
  assert.equal(s.moveis.find((m) => m[0] === "computer_flatscreen" && m[1] === 9)[3], 0, "tela para o norte, onde está a cadeira");
});

test("altura da escada: pela subida do desenho; escada inteira vai sozinha e degrau empilha rente", () => {
  // A escadinha da varanda pisa a 0,5 mas o desenho sobe um nível: uma peça
  // só vence o tablado de 1 (dali ao tablado é um passo do Habbo).
  const r = novaCena("reuniao", { acabamento: false });
  r.escada("hween_c20_porchstairs", 14, 4, [0, -1]);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.moveis.filter((m) => m[0] === "hween_c20_porchstairs").map((m) => [m[1], m[2], m[3], m[5]]), [[14, 4, 0, 0]], "uma peça, no chão, de frente para o salão");
  const mez = (s) => s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 5, altura: 3, piso: "val12_marble2", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"], abertura: [12, 14] });
  const s = novaCena("recepcao", { acabamento: false });
  mez(s);
  s.escada("hween_c20_porchstairs", 12, 10, [0, -1]);
  assert.match(s.erros.join("\n"), /mostra uma subida de 1 e o desnível é 3: escada inteira não se empilha/);
  const t = novaCena("recepcao", { acabamento: false });
  mez(t);
  t.escada("bc_stairs_recolorable", 12, 10, [0, -1], { largura: 2, estado: 185 });
  assert.match(t.erros.join("\n"), /se atravessa no mapa sem dar altura/, "a escada dos quartos não sobe andar em sala de piso plano");
  const v = novaCena("recepcao", { acabamento: false });
  mez(v);
  v.escada("xmas_c18_stagestairs", 12, 9, [0, -1]);
  assert.deepEqual(v.erros, []);
  const degraus = v.moveis.filter((m) => m[0] === "xmas_c18_stagestairs");
  assert.equal(degraus.length, 15, "de 1 a 5 peças empilhadas até 3");
  const u = novaCena("recepcao", { acabamento: false });
  mez(u);
  u.escada("wintercabin_c19_stairs", 12, 9, [0, -1]);
  assert.match(u.erros.join("\n"), /subida do desenho não foi conferida/);
});

test("caminho como o do Habbo: da porta a todo assento e andar, subindo até 1,5 (2 para sentar)", () => {
  const s = novaCena("reuniao");
  s.canto("cerco", { funcao: "teste", destaque: "exe_chair" });
  // Poltrona cercada de jardineiras (não se pisam): ninguém chega.
  s.assento("exe_chair", 9, 9, [9, 10]);
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) s.por("mafia_c26_planter_white", 9 + dx, 9 + dy);
  const { erros } = s.fechar();
  const e = erros.join("\n");
  assert.match(e, /exe_chair \(9,9\) sem caminho da porta/);
  assert.doesNotMatch(e, /nenhuma escada/, "o tablado de um nível se sobe direto");
});

test("receitas do designer: lareira simétrica, mesa de reunião completa e coleção da sala", async () => {
  const { estarLareira, mesaReuniao } = await import("../scripts/escritorio-receitas.mjs");
  const s = novaCena("t", { w: 18, h: 12, acabamento: false });
  s.colecao({ lareira: "lodge_dark_fireplace", poltrona: "exe_chair", abajur: "lodge_dark_lamp", mesa: "army15_ltddesk", cadeira: "exe_chair2", lustre: "lodge_dark_chandelier", tela: "computer_flatscreen" },
    { acentos: ["attic15_painting", "room_cof15_cup2"] });
  estarLareira(s, { x: 8, tapete: false, arte: ["attic15_painting"] });
  const quadros = s.moveis.filter((m) => m[0] === "attic15_painting").map((m) => m[1]);
  assert.equal(quadros.length, 2);
  assert.ok(Math.abs((quadros[0] + quadros[1]) / 2 - 8.5) < 0.6, "quadros espelhados em volta do meio da lareira");
  const polt = s.moveis.filter((m) => m[0] === "exe_chair").map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(polt, [[7, 1, 2], [10, 1, 6]], "uma de cada lado, viradas para o fogo");
  const lugares = mesaReuniao(s, { x: 5, y: 6, telas: [0], porLugar: ["room_cof15_cup2"] });
  assert.equal(lugares.length, 12);
  assert.equal(s.moveis.filter((m) => m[0] === "exe_chair2").length, 14, "seis de cada lado e as duas cabeceiras");
  assert.equal(s.moveis.find((m) => m[0] === "computer_flatscreen")[3], 0, "tela virada para o primeiro lugar, ao norte");
  s.por("plant_rose", 15, 10);
  s.fechar();
  assert.deepEqual(s.erros, []);
  const t = novaCena("t", { w: 12, h: 12 });
  t.colecao({ sofa: "mafia_c26_sofa_white" });
  t.canto("x", { funcao: "teste", destaque: "plant_rose" });
  t.por("plant_rose", 5, 5);
  assert.match(t.fechar().erros.join("\n"), /plant_rose fora da coleção da sala/);
});
