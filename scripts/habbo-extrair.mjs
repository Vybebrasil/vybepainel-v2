// Extrai móveis do acervo baixado (scripts/habbo-acervo.mjs) para o painel.
// node scripts/habbo-extrair.mjs <pasta do acervo> classe1 classe2 ...
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const [acervo, ...classes] = process.argv.slice(2);
for (const classe of classes) {
  if (!/^[\w]+$/.test(classe)) throw new Error("Classe inválida: " + classe);
  let buf;
  try { buf = await readFile(join(acervo, "moveis", classe + ".nitro")); } catch { console.error(classe, "não está no acervo"); continue; }
  let p = 0;
  const arquivos = {};
  const qtd = buf.readUInt16BE(p); p += 2;
  for (let i = 0; i < qtd; i++) {
    const n = buf.readUInt16BE(p); p += 2;
    const nome = buf.subarray(p, p + n).toString(); p += n;
    const t = buf.readUInt32BE(p); p += 4;
    arquivos[nome] = inflateSync(buf.subarray(p, p + t)); p += t;
  }
  const json = Object.entries(arquivos).find(([n]) => n.endsWith(".json"))?.[1];
  const png = Object.entries(arquivos).find(([n]) => n.endsWith(".png"))?.[1];
  if (!json || !png) { console.error(classe, "sem arte"); continue; }
  await writeFile(`assets/escritorio/habbo/${classe}.json`, json);
  await writeFile(`assets/escritorio/habbo/${classe}.png`, png);
  const d = JSON.parse(json), v = d.visualizations.find((x) => x.size === 64);
  console.log(classe.padEnd(30), JSON.stringify(d.logic.model.dimensions), "dirs", Object.keys(v?.directions || {}).join(""), "anim", Object.keys(v?.animations || {}).length);
}
