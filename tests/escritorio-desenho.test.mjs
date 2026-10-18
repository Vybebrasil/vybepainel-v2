import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { silhueta, emComum } from "../scripts/escritorio-desenho.mjs";

test("silhueta lê a arte do Habbo: caixote opaco, lâmpada só com a luz", () => {
  const caixote = silhueta("wildwest_crate", 0, 0);
  assert.ok(caixote && caixote.n > 2000);
  const semLuz = silhueta("grungelamp", 0, 1), comLuz = silhueta("grungelamp", 0, 1, true);
  assert.ok(comLuz.n > semLuz.n, "a lâmpada acesa (camada de luz) conta quando pedida");
});

test("pixels em comum: a mesma peça no mesmo lugar cobre tudo; longe, nada", () => {
  const s = silhueta("wildwest_crate", 0, 0);
  assert.equal(emComum({ s, sx: 0, sy: 0 }, { s, sx: 0, sy: 0 }), s.n);
  assert.equal(emComum({ s, sx: 0, sy: 0 }, { s, sx: 500, sy: 0 }), 0);
  // Posição quebrada (altura em frações) também é contada, arredondada como na tela.
  assert.ok(emComum({ s, sx: 0.4, sy: 39.36 }, { s, sx: 0, sy: 39 }) > s.n * 0.9);
});

test("o verificador cobra a regra de desenho nas salas refeitas", () => {
  const saida = execFileSync("node", ["scripts/escritorio-auditar.mjs"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.match(saida, /Planta sem problemas\./);
  const avisos = execFileSync("node", ["scripts/escritorio-auditar.mjs", "--desenho"], { encoding: "utf8" });
  assert.doesNotMatch(avisos, / em cafe$/m);
});
