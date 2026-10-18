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
