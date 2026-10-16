// Cópia completa da arte do Habbo (via habboassets.com) para o acervo da Vybe,
// para o escritório não depender do site. Uso interno, decidido pelo Paulo.
// node scripts/habbo-acervo.mjs <pasta> [moveis|roupas|tudo]
// Retoma de onde parou (pula o que já existe), poucos pedidos por vez e índice
// com nome, categoria e revisão em <pasta>/<tipo>/indice.json.
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const [destino, qual = "tudo"] = process.argv.slice(2);
if (!destino) throw new Error("Informe a pasta de destino.");
const SITE = "https://www.habboassets.com", CDN = "https://cdn.habboassets.com";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function buscar(url, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.status === 404) return null;
      if (r.status === 429) { await espera(Number(r.headers.get("retry-after") || 30) * 1000); continue; }
      if (r.ok) return r;
    } catch {}
    await espera(2000 * (i + 1));
  }
  throw new Error("Falhou: " + url);
}
const existe = async (f) => { try { return (await stat(f)).size > 0; } catch { return false; } };
async function emLotes(lista, simultaneos, tarefa) {
  let i = 0, feitos = 0;
  await Promise.all(Array.from({ length: simultaneos }, async () => {
    while (i < lista.length) {
      const item = lista[i++];
      await tarefa(item);
      if (++feitos % 200 === 0) console.log(`  ${feitos}/${lista.length}`);
    }
  }));
}
async function lerIndice(arquivo) { try { return JSON.parse(await readFile(arquivo, "utf8")); } catch { return null; } }

async function moveis() {
  const pasta = join(destino, "moveis");
  await mkdir(pasta, { recursive: true });
  const arqIndice = join(pasta, "indice.json");
  let indice = await lerIndice(arqIndice);
  if (!indice) {
    indice = [];
    const primeira = await (await buscar(`${SITE}/furniture?page=1`)).text();
    const total = Number(/\\"total\\":(\d+)/.exec(primeira)?.[1] || 0), porPagina = 50;
    const paginas = Math.ceil(total / porPagina);
    console.log(`Móveis: ${total} em ${paginas} páginas`);
    const vistos = new Set();
    for (let p = 1; p <= paginas; p++) {
      const html = p === 1 ? primeira : await (await buscar(`${SITE}/furniture?page=${p}`)).text();
      // Cada item: classname, name, category e o ícone, cujo caminho traz a revisão.
      const re = /\\"classname\\":\\"([A-Za-z0-9_]+)\\",\\"name\\":\\"(.*?)\\",\\"category\\":\\"(.*?)\\",.{0,40}?\\"icon\\":\\"https:\/\/cdn\.habboassets\.com\/derived\/furni\/(\d+)\//g;
      for (const m of html.matchAll(re)) {
        if (vistos.has(m[1])) continue;
        vistos.add(m[1]);
        indice.push({ classe: m[1], nome: m[2], categoria: m[3], revisao: m[4] });
      }
      if (p % 25 === 0) console.log(`  página ${p}/${paginas} · ${indice.length} itens`);
      await espera(250);
    }
    await writeFile(arqIndice, JSON.stringify(indice, null, 1));
  }
  // A lista do site muda de ordem entre páginas; a lista oficial do Habbo
  // (indice-oficial.json, salva pelo navegador) completa o que faltar.
  const oficial = await lerIndice(join(pasta, "indice-oficial.json"));
  if (oficial) {
    const ja = new Set(indice.map((i) => i.classe));
    for (const o of oficial) if (!ja.has(o.classe) && o.revisao) indice.push(o);
  }
  console.log(`Baixando ${indice.length} móveis…`);
  const falhas = [];
  await emLotes(indice, 6, async (it) => {
    const arq = join(pasta, it.classe + ".nitro");
    if (await existe(arq)) return;
    const r = await buscar(`${CDN}/derived/furni/${it.revisao}/${it.classe}/${it.classe}.nitro`).catch(() => null);
    if (!r) { falhas.push(it.classe); return; }
    await writeFile(arq, Buffer.from(await r.arrayBuffer()));
  });
  await writeFile(join(pasta, "falhas.json"), JSON.stringify(falhas));
  console.log(`Móveis prontos. Sem arquivo no site: ${falhas.length}`);
}

async function roupas() {
  const pasta = join(destino, "roupas");
  await mkdir(pasta, { recursive: true });
  const arqIndice = join(pasta, "indice.json");
  let indice = await lerIndice(arqIndice);
  if (!indice) {
    const vistos = new Map();
    const primeira = await (await buscar(`${SITE}/swfs/clothing?page=1`)).text();
    const paginas = Math.max(...[...primeira.matchAll(/page=(\d+)/g)].map((m) => Number(m[1])), 1);
    console.log(`Roupas: ${paginas} páginas`);
    for (let p = 1; p <= paginas; p++) {
      const html = p === 1 ? primeira : await (await buscar(`${SITE}/swfs/clothing?page=${p}`)).text();
      for (const m of html.matchAll(/derived\/clothing\/([A-Za-z0-9_]+)\/(\d+)\//g)) if (!vistos.has(m[1])) vistos.set(m[1], m[2]);
      await espera(250);
    }
    indice = [...vistos].map(([biblioteca, revisao]) => ({ biblioteca, revisao }));
    await writeFile(arqIndice, JSON.stringify(indice, null, 1));
  }
  console.log(`Baixando ${indice.length} roupas…`);
  const falhas = [];
  await emLotes(indice, 6, async (it) => {
    const arq = join(pasta, it.biblioteca + ".nitro");
    if (await existe(arq)) return;
    const r = await buscar(`${CDN}/derived/clothing/${it.biblioteca}/${it.revisao}/${it.biblioteca}.nitro`).catch(() => null);
    if (!r) { falhas.push(it.biblioteca); return; }
    await writeFile(arq, Buffer.from(await r.arrayBuffer()));
  });
  await writeFile(join(pasta, "falhas.json"), JSON.stringify(falhas));
  console.log(`Roupas prontas. Sem arquivo no site: ${falhas.length}`);
}

if (qual === "moveis" || qual === "tudo") await moveis();
if (qual === "roupas" || qual === "tudo") await roupas();
console.log("Acervo concluído em", destino);
