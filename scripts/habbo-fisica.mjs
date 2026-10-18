// Gera assets/escritorio/habbo/fisica.json a partir da furnidata oficial do
// Habbo (a mesma ficha que o jogo usa): para cada móvel do painel, se dá para
// pisar, sentar, deitar e pôr coisas em cima, e a altura de empilhar.
// node scripts/habbo-fisica.mjs <furnidata.json> [pasta de móveis do acervo]
// Com a pasta do acervo (scripts/habbo-acervo.mjs), a lógica oficial de cada
// móvel (logicType da arte: pisar e mudar, placar, relógio, ladrilho de
// altura, funil…) vai junto, também para os que ainda não estão no painel.
// (baixe de https://www.habbo.com.br/gamedata/furnidata_json/1)
import { readFile, readdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const [arquivo, acervo] = process.argv.slice(2);
if (!arquivo) throw new Error("Informe o caminho da furnidata.");
const fd = JSON.parse(await readFile(arquivo, "utf8"));
const ficha = new Map(fd.roomitemtypes.furnitype.map((f) => [f.classname, f]));
const catalogo = JSON.parse(await readFile("assets/escritorio/habbo/catalogo.json", "utf8"));
const locais = (await readdir("assets/escritorio/habbo")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const classes = [...new Set([...catalogo.map((m) => m.classe), ...locais])].sort();
// [bits, altura, alturas?]: 1 pisa, 2 senta, 4 deita, 8 põe coisas em cima.
// "alturas": a altura em cada estado, para os móveis de altura ajustável
// (InteractionMultiHeight), quando a ficha traz a lista em customparams
// (números decimais de 0 a 4, um por estado, como a caixa es_box).
const alturasPorEstado = (p) => {
  const v = String(p || "").split(",").map((x) => x.trim());
  if (v.length < 2 || !v.every((x) => /^\d+(\.\d+)?$/.test(x)) || !v.some((x) => x.includes("."))) return null;
  const n = v.map(Number);
  return n.every((x) => x >= 0 && x <= 4) ? n : null;
};
const saida = {};
for (const c of classes) {
  const f = ficha.get(c);
  if (!f) continue;
  const bits = (f.canstandon ? 1 : 0) | (f.cansiton ? 2 : 0) | (f.canlayon ? 4 : 0) | (f.canputstuffon ? 8 : 0);
  saida[c] = [bits, Math.round(Number(f.height || 0) * 1000) / 1000];
  // (bola e disco também têm números em customparams: são força e atrito do chute)
  const alturas = /ball|puck/.test(c) ? null : alturasPorEstado(f.customparams);
  if (alturas) saida[c].push(alturas);
}
// Lógica oficial (logicType) e tipo de desenho (visualizationType) de cada
// móvel: da arte do painel e, se houver, do acervo.
const LOGICAS = { furniture_change_state_when_step_on: "pisar", furniture_counter_clock: "relogio", furniture_score: "placar",
  furniture_custom_stack_height: "altura", furniture_random_teleport: "funil", furniture_internal_link: "link", furniture_multiheight: "multialtura",
  furniture_vote_counter: "voto", furniture_trophy: "trofeu", furniture_window: "janela", furniture_crackable: "quebravel", furniture_badge_display: "selo",
  furniture_youtube: "tv", furniture_mannequin: "manequim", furniture_floor_hole: "buraco", furniture_lovelock: "cadeado" };
const DESENHOS = { furniture_score_board: "placar", furniture_counter_clock: "relogio" };
const anotar = (c, d) => { if (!saida[c]) return; const l = LOGICAS[d.logicType], v = DESENHOS[d.visualizationType]; if (l || v) { while (saida[c].length < 3) saida[c].push(null); saida[c][3] = l || null; if (v) saida[c][4] = v; } };
for (const c of locais) { try { anotar(c, JSON.parse(await readFile(`assets/escritorio/habbo/${c}.json`, "utf8"))); } catch {} }
if (acervo) for (const c of classes) {
  if (!saida[c] || saida[c][3] !== undefined && saida[c].length > 3 || locais.includes(c)) continue;
  try {
    const buf = await readFile(`${acervo}/${c}.nitro`); let p = 0; const qtd = buf.readUInt16BE(p); p += 2;
    for (let i = 0; i < qtd; i++) { const n = buf.readUInt16BE(p); p += 2; const nome = buf.subarray(p, p + n).toString(); p += n; const t = buf.readUInt32BE(p); p += 4;
      if (nome.endsWith(".json")) anotar(c, JSON.parse(inflateSync(buf.subarray(p, p + t)))); p += t; }
  } catch {}
}
// Peças do próprio painel (não existem no Habbo).
saida.vybe_bloco_invisivel = [1 | 8, 1];
saida.vybe_assento_invisivel = [2, 1];
await writeFile("assets/escritorio/habbo/fisica.json", JSON.stringify(saida));
console.log(Object.keys(saida).length, "móveis com física do Habbo");
