// Monta a seleção de móveis que fica no painel a partir do acervo baixado
// (scripts/habbo-acervo.mjs): extrai .json/.png para assets/escritorio/habbo e
// gera assets/escritorio/habbo/catalogo.json (nome e categoria para o editor).
// node scripts/habbo-selecao.mjs <pasta do acervo>
import { readFile, writeFile, readdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const [acervo] = process.argv.slice(2);
if (!acervo) throw new Error("Informe a pasta do acervo.");
const pasta = join(acervo, "moveis");
const oficial = JSON.parse(await readFile(join(pasta, "indice-oficial.json"), "utf8"));
let nomes = {};
try { for (const i of JSON.parse(await readFile(join(pasta, "indice.json"), "utf8"))) nomes[i.classe] = i.nome; } catch {}
const temArquivo = new Set((await readdir(pasta)).filter((f) => f.endsWith(".nitro")).map((f) => f.slice(0, -6)));

const CATEGORIAS = { chair: "Cadeiras e sofás", table: "Mesas", lighting: "Luzes", divider: "Divisórias", rug: "Tapetes", shelf: "Estantes", games: "Jogos", music: "Música" };
const LINHAS = { hygge: "Casa", mafia: "Casa", lodge: "Casa", darkmodern: "Casa", hc26: "Casa", ktchn: "Cozinha", ktchn15: "Cozinha", nyc: "Cidade", vwave: "Cidade", garden: "Jardim", jungle: "Jardim", lt: "Jardim", br: "Brasil", disco: "Festa", cine: "Cinema", school: "Escola", uni: "Escola", exe: "Escritório", army: "Escritório" };
const FORA = /^(nft|xmas|hween|easter|wf|ads|clothing|val|cf|horse|plushie|badge|room|sound|diamond|rare|bc|habbo\d*|fball|party|pixel|qt|ltd)/i;
const porLinha = new Map();
const escolhidos = [];
for (const it of oficial) {
  if (it.categoria === "wall" || FORA.test(it.classe) || !temArquivo.has(it.classe)) continue;
  const linha = it.classe.split("_")[0].toLowerCase();
  const cat = CATEGORIAS[it.categoria] || (it.categoria === "other" && LINHAS[linha]) || (/plant|tree|palm|flower|bush/i.test(it.classe) && "Jardim");
  if (!cat) continue;
  const n = porLinha.get(linha) || 0;
  if (n >= 12) continue;
  porLinha.set(linha, n + 1);
  escolhidos.push({ classe: it.classe, categoria: cat });
}
// Os que o mapa padrão já usa entram sempre.
for (const f of await readdir("assets/escritorio/habbo")) if (f.endsWith(".json") && !["catalogo.json", "figuras.json"].includes(f)) {
  const c = f.slice(0, -5);
  if (!escolhidos.some((e) => e.classe === c)) escolhidos.push({ classe: c, categoria: "Do escritório" });
}
let ok = 0;
for (const e of escolhidos) {
  const destinoJson = `assets/escritorio/habbo/${e.classe}.json`;
  try { await readFile(destinoJson); ok++; continue; } catch {}
  const buf = await readFile(join(pasta, e.classe + ".nitro"));
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
  if (!json || !png) { e.falhou = true; continue; }
  await writeFile(destinoJson, json);
  await writeFile(`assets/escritorio/habbo/${e.classe}.png`, png);
  ok++;
}
const catalogo = escolhidos.filter((e) => !e.falhou).map((e) => ({
  classe: e.classe,
  nome: (nomes[e.classe] || e.classe.replace(/_/g, " ")).slice(0, 40),
  categoria: e.categoria,
}));
// Catálogo do editor: carregado só ao abrir o editor, pela API (com sessão).
await writeFile("assets/escritorio/habbo/catalogo.json", JSON.stringify(catalogo));
console.log(`Seleção: ${catalogo.length} móveis (${ok} com arte no painel).`);
