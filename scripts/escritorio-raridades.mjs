// Faixas de raridade da loja do Escritório (docs/escritorio-pontos.md): comum,
// incomum, raro, épico e lendário (cinco faixas desde 20/10/2026).
// Classifica o catálogo do painel por tipo de peça e imprime os INSERTs que a
// migração 2026-10-17-escritorio-loja.sql carrega em vybe_escritorio_catalogo.
// Comum não entra na tabela (é o padrão). A tabela é a autoridade depois de
// aplicada: trocar a faixa de um móvel é um UPDATE, sem rodar isto de novo.
// node scripts/escritorio-raridades.mjs            → SQL
// node scripts/escritorio-raridades.mjs --json     → {classe: raridade}
import { readFileSync } from "node:fs";
const catalogo = JSON.parse(readFileSync(new URL("../assets/escritorio/habbo/catalogo.json", import.meta.url), "utf8"));
const quartos = JSON.parse(readFileSync(new URL("../assets/escritorio/habbo/quartos.json", import.meta.url), "utf8"));
const texto = (m) => (m.classe + " " + m.nome).toLowerCase();
const BRINDES = /plush|plushy|box|bag|envelope|egg|pillow|sack|chest/;
const LENDARIO = /throne|solid gold|(^|[^a-z])rare([^a-z]|$)|trophy|(^|[^a-z])ltd([^a-z]|$)|signature edition|luxury car|gold fountain|pot o. gold|lighthouse|treehouse|boulevard fountain|gold leaf/;
const EPICO = /^hc_|^hc\b|hcsohva|(^|[^a-z])hc([^a-z]|$)|gold|golden|bling|crystal|^mode_gold|jacuzzi|chandelier|vegas|marble pillar|waterfall|fountain|statue|aquarium|piano|grand|executive/;
const RARO = /neon|billiard|football|arcade|jukebox|tv set|hot tub|pool/;
// Incomum (20/10/2026, cinco faixas pedidas pelo Paulo): peças temáticas e
// as luzes, que dão clima à sala sem ser o básico.
const CATEGORIAS_INCOMUNS = ["Jogos", "Música", "Festa", "Cidade", "Escola", "Brasil", "Luzes"];
export function raridadeDe(m) {
  if (quartos.essenciais.includes(m.classe)) return "comum";
  const t = texto(m);
  if (LENDARIO.test(t) && !BRINDES.test(t)) return "lendario";
  if (EPICO.test(t) || m.categoria === "Cinema") return "epico";
  if ((m.anima && m.categoria !== "Pisos do acervo") || RARO.test(t)) return "raro";
  if (CATEGORIAS_INCOMUNS.includes(m.categoria)) return "incomum";
  return "comum";
}
export function raridadesDoCatalogo() {
  const mapa = {};
  for (const m of catalogo) { const r = raridadeDe(m); if (r !== "comum") mapa[m.classe] = r; }
  return mapa;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const mapa = raridadesDoCatalogo();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(mapa, null, 1)); }
  else for (const r of ["incomum", "raro", "epico", "lendario"]) {
    const classes = Object.keys(mapa).filter((c) => mapa[c] === r).sort();
    const linhas = [];
    for (let i = 0; i < classes.length; i += 12) linhas.push(" " + classes.slice(i, i + 12).map((c) => `'${c}'`).join(","));
    console.log(`-- ${r}: ${classes.length} móveis\nINSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[\n${linhas.join(",\n")}]),'${r}' ON CONFLICT (classe) DO NOTHING;`);
  }
}
