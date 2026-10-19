// Gera as cenas montadas pelo motor de construção (scripts/cenas/<id>.mjs,
// regras em scripts/escritorio-construcao.mjs) dentro do vybe-escritorio-planta.js.
// node scripts/escritorio-compor.mjs            gera
// node scripts/escritorio-compor.mjs --conferir só confere se o gerado está em dia
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

// Gera o bloco das cenas compostas dentro do vybe-escritorio-planta.js.
const INICIO = "// <cenas-compostas> (gerado por scripts/escritorio-compor.mjs; não edite à mão)";
const FIM = "// </cenas-compostas>";
export async function comporTudo() {
  const pasta = "scripts/cenas", cenas = {}, erros = [];
  for (const f of readdirSync(pasta).filter((f) => f.endsWith(".mjs")).sort()) {
    const mod = await import(pathToFileURL(`${pasta}/${f}`).href);
    const r = mod.default();
    erros.push(...r.erros);
    cenas[f.replace(/\.mjs$/, "")] = { moveis: r.moveis, figurantes: r.figurantes };
  }
  const corpo = Object.entries(cenas).map(([id, c]) => `  ${id}: {\n    moveis: [\n${c.moveis.map((m) => "      " + JSON.stringify(m)).join(",\n")},\n    ],\n    figurantes: ${JSON.stringify(c.figurantes)},\n  },`).join("\n");
  return { bloco: `${INICIO}\nconst ESCRITORIO_CENAS_COMPOSTAS = {\n${corpo}\n};\n${FIM}`, erros };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { bloco, erros } = await comporTudo();
  if (erros.length) { console.error(erros.join("\n")); process.exit(1); }
  const arq = "vybe-escritorio-planta.js", fonte = readFileSync(arq, "utf8");
  const i = fonte.indexOf(INICIO), j = fonte.indexOf(FIM);
  if (i < 0 || j < 0) throw new Error("Marcadores das cenas compostas não encontrados no planta.");
  const novo = fonte.slice(0, i) + bloco + fonte.slice(j + FIM.length);
  if (process.argv.includes("--conferir")) {
    if (novo !== fonte) { console.error("As cenas compostas estão desatualizadas: rode node scripts/escritorio-compor.mjs"); process.exit(1); }
    console.log("Cenas compostas em dia.");
  } else {
    writeFileSync(arq, novo);
    console.log("Cenas compostas geradas. Conferindo com o verificador:");
    // Montar e conferir são um passo só: a sala gerada passa pelas mesmas
    // regras de desenho e de caminho do verificador.
    try { execFileSync("node", ["scripts/escritorio-auditar.mjs"], { stdio: "inherit" }); } catch { process.exit(1); }
  }
}
