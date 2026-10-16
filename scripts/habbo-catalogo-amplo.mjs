// Amplia o catálogo do editor com móveis do acervo que NÃO ficam no painel:
// a arte deles vem sob demanda pelo servidor (arteRemotaEscritorio), então o
// pacote do site não cresce. Mantém os do catálogo atual e acrescenta os de
// escritório, casa, área externa e decoração (sem linhas temáticas).
// node scripts/habbo-catalogo-amplo.mjs <pasta do acervo>
import { readFile, writeFile, readdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const [acervo] = process.argv.slice(2);
if (!acervo) throw new Error("Informe a pasta do acervo.");
const pasta = join(acervo, "moveis");
const oficial = JSON.parse(await readFile(join(pasta, "indice-oficial.json"), "utf8"));
const nomes = Object.fromEntries(JSON.parse(await readFile(join(pasta, "indice.json"), "utf8")).map((i) => [i.classe, i.nome]));
const temArquivo = new Set((await readdir(pasta)).filter((f) => f.endsWith(".nitro")).map((f) => f.slice(0, -6)));
// Recomeça dos móveis que ficam no painel (rodar de novo não duplica).
const atual = JSON.parse(await readFile("assets/escritorio/habbo/catalogo.json", "utf8")).filter((m) => !m.remoto && !m.parede);
// Itens de parede que o mapa padrão usa ficam no painel (arte local).
const local = new Set((await readdir("assets/escritorio/habbo")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)));
const jaTem = new Set(atual.map((m) => m.classe));

// Fora: temas que não cabem num escritório e itens de sistema do Habbo.
const FORA = /^(nft|xmas|xm\d|hween|halloween|easter|wf|ads|clothing|val|cf_|horse|plushie|badge|room|sound|diamond|rare|bc_|habbo\d*|fball|party|qt|ltd|dino|pirate|pirat|vikings|santa|snow|ghost|zombie|skull|monster|wired|teleport|tele_|credit|present|gift|trophy|pet|nest|bunny|egg|hc\d+_\d+$|bb_|es_|ss_|tag_|bonus|prize|totem|xmas)/i;
const TEMAS = /(dragon|dino|pirate|viking|ghost|zombie|skull|halloween|xmas|christmas|santa|easter|valentine|heart|lava|spider|coffin|grave|cursed|monster|alien|robot|nft|package|_box$|crate)/i;
const CATEGORIAS = { chair: "Cadeiras e sofás", table: "Mesas", lighting: "Luzes", divider: "Divisórias", rug: "Tapetes", shelf: "Estantes", games: "Jogos", music: "Música", bed: "Casa", floor: "Pisos do acervo", vending_machine: "Cozinha", food: "Cozinha" };
// "other": entra só o que parece móvel ou decoração, pelo nome da peça.
const DECOR = [
  [/plant|tree|flower|bush|palm|cactus|bonsai|fern|grass|hedge|garden|pot\b|vase/i, "Jardim"],
  [/lamp|light|lantern|candle|torch|chandelier/i, "Luzes"],
  [/sofa|chair|stool|bench|armchair|seat|couch|lounger|throne|pouf|beanbag/i, "Cadeiras e sofás"],
  [/table|desk|counter/i, "Mesas"],
  [/shelf|shelves|bookcase|cabinet|cupboard|wardrobe|dresser|drawer/i, "Estantes"],
  [/rug|carpet|mat\b|tile|floor/i, "Tapetes"],
  [/fridge|stove|oven|sink|kitchen|coffee|microwave|bar\b|minibar/i, "Cozinha"],
  [/tv|screen|computer|laptop|monitor|radio|speaker|jukebox|piano|guitar|drum|dj/i, "Música"],
  [/divider|fence|wall|pillar|column|railing|gate/i, "Divisórias"],
  [/statue|fountain|clock|mirror|painting|frame|aquarium|globe|sculpture|bed|bath|toilet|pillow|cushion|basket|box|chest|trunk|sign|neon|poster|banner|flag|easel|piano|book|lamp|stand|rack|wardrobe|plush|teddy|car|bike|boat|tent|hammock|swing|pool|tub|jacuzzi|machine|robot|tower|block|cube|pyramid|ball|light/i, "Casa"],
];
const POR_LINHA = 70;
const porLinha = new Map();
const novos = [];
const ler = async (classe) => {
  const buf = await readFile(join(pasta, classe + ".nitro"));
  let p = 0;
  const qtd = buf.readUInt16BE(p); p += 2;
  for (let i = 0; i < qtd; i++) {
    const n = buf.readUInt16BE(p); p += 2;
    const nome = buf.subarray(p, p + n).toString(); p += n;
    const t = buf.readUInt32BE(p); p += 4;
    if (nome.endsWith(".json")) return JSON.parse(inflateSync(buf.subarray(p, p + t)).toString());
    p += t;
  }
  return null;
};
// Itens de parede (janelas, quadros, luminárias, prateleiras de parede).
const PAREDE = new Set(["wall", "window", "wall_decoration"]);
const porLinhaParede = new Map();
for (const it of oficial) {
  if (!PAREDE.has(it.categoria) || jaTem.has(it.classe) || !temArquivo.has(it.classe) || FORA.test(it.classe)) continue;
  const nome = nomes[it.classe] || "";
  if (!nome || TEMAS.test(it.classe) || TEMAS.test(nome) || /^(\$|%|\{)|wallpaper|landscape|countdown|poster_\d+$/i.test(it.classe + " " + nome)) continue;
  const linha = it.classe.split("_")[0].toLowerCase();
  const n = porLinhaParede.get(linha) || 0;
  if (n >= 25) continue;
  let dados;
  try { dados = await ler(it.classe); } catch { continue; }
  const v = dados?.visualizations?.find((x) => x.size === 64);
  if (!v || !Object.hasOwn(v.directions || {}, "2") || !Object.hasOwn(v.directions || {}, "4")) continue;
  const anima = Object.values(v.animations || {}).some((a) => Object.values(a.layers || {}).some((l) => new Set(Object.values(l.frameSequences?.[0]?.frames || {}).map((f) => f.id)).size > 1));
  porLinhaParede.set(linha, n + 1);
  jaTem.add(it.classe);
  novos.push({ classe: it.classe, nome: nome.slice(0, 40), categoria: "Na parede", giros: 1, parede: true, ...(local.has(it.classe) ? {} : { remoto: true }), ...(anima ? { anima: true } : {}) });
}
for (const it of oficial) {
  if (jaTem.has(it.classe) || !temArquivo.has(it.classe) || FORA.test(it.classe)) continue;
  const nome = nomes[it.classe] || "";
  if (TEMAS.test(it.classe) || TEMAS.test(nome) || !nome || /^(\$|%|\{)/.test(nome)) continue;
  let cat = CATEGORIAS[it.categoria];
  if (!cat && it.categoria === "other") cat = DECOR.find(([re]) => re.test(it.classe + " " + nome))?.[1];
  if (!cat) continue;
  const linha = it.classe.split("_")[0].toLowerCase();
  const n = porLinha.get(linha) || 0;
  if (n >= POR_LINHA) continue;
  let dados;
  try { dados = await ler(it.classe); } catch { continue; }
  const v = dados?.visualizations?.find((x) => x.size === 64);
  if (!v) continue;
  const giros = [0, 2, 4, 6].filter((d) => Object.hasOwn(v.directions || {}, String(d))).length || 1;
  // Animado: algum estado com mais de um quadro (luz que pisca, água, fogo…).
  const anima = Object.values(v.animations || {}).some((a) => Object.values(a.layers || {}).some((l) => new Set(Object.values(l.frameSequences?.[0]?.frames || {}).map((f) => f.id)).size > 1));
  const dim = dados.logic?.model?.dimensions || {};
  // Muito grande para uma sala de 10×10 (palcos, piscinas de evento): fica de fora.
  if ((dim.x || 1) > 6 || (dim.y || 1) > 6) continue;
  porLinha.set(linha, n + 1);
  novos.push({ classe: it.classe, nome: nome.slice(0, 40), categoria: cat, giros, remoto: true, ...(anima ? { anima: true } : {}) });
}
const catalogo = [...atual, ...novos];
await writeFile("assets/escritorio/habbo/catalogo.json", JSON.stringify(catalogo));
const contagem = {};
for (const m of novos) contagem[m.categoria] = (contagem[m.categoria] || 0) + 1;
console.log(`Catálogo: ${atual.length} + ${novos.length} novos = ${catalogo.length}`, contagem);
