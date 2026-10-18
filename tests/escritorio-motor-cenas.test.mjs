import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { novaCena } from "../scripts/escritorio-construcao.mjs";
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

test("acabamento do Café é exigido: cornija, luz, detalhe e escada", () => {
  const s = novaCena("recepcao");
  s.mezanino({ x0: 0, y0: 0, x1: 16, y1: 7, altura: 3, piso: "val12_marble1", guarda: "greek_block", coluna: "greek_corner", colunas: [], lados: ["frente"] });
  s.piso("val12_marble1", { x0: 0, y0: 8, x1: 16, y1: 18 });
  const { erros } = s.fechar();
  for (const r of [/cornija/, /pouca luz/, /sala pobre/, /nenhuma escada/, /parecem um só/]) assert.ok(erros.some((e) => r.test(e)), String(r));
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
