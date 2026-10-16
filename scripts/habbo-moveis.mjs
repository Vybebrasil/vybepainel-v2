// Baixa móveis do Habbo (formato .nitro, via habboassets.com) para o escritório.
// Uso interno da Vybe, por decisão do Paulo: a arte é da Sulake/Habbo.
// node scripts/habbo-moveis.mjs classe1 classe2 ...  → assets/escritorio/habbo/<classe>.{json,png}
// Cada .nitro é: uint16 quantidade, e para cada arquivo uint16 tamanho do nome,
// nome, uint32 tamanho, dados zlib.
import { inflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const PASTA = 'assets/escritorio/habbo';
await mkdir(PASTA, { recursive: true });

export function abrirNitro(buf) {
  let p = 0;
  const qtd = buf.readUInt16BE(p); p += 2;
  const arquivos = {};
  for (let i = 0; i < qtd; i++) {
    const n = buf.readUInt16BE(p); p += 2;
    const nome = buf.subarray(p, p + n).toString(); p += n;
    const t = buf.readUInt32BE(p); p += 4;
    arquivos[nome] = inflateSync(buf.subarray(p, p + t)); p += t;
  }
  return arquivos;
}

async function revisao(classe) {
  const r = await fetch(`https://www.habboassets.com/imaging/info/furniture/${classe}`);
  if (!r.ok) throw new Error(`${classe}: ${r.status}`);
  return (await r.json()).latest;
}

for (const classe of process.argv.slice(2)) {
  if (!/^[\w-]+$/.test(classe)) throw new Error('Classe inválida: ' + classe);
  let rev;
  try { rev = await revisao(classe); } catch (e) { console.error(e.message); continue; }
  const r = await fetch(`https://cdn.habboassets.com/derived/furni/${rev}/${classe}/${classe}.nitro`);
  if (!r.ok) { console.error(classe, 'falhou', r.status); continue; }
  const arquivos = abrirNitro(Buffer.from(await r.arrayBuffer()));
  const json = Object.entries(arquivos).find(([n]) => n.endsWith('.json'));
  const png = Object.entries(arquivos).find(([n]) => n.endsWith('.png'));
  if (!json || !png) { console.error(classe, 'sem json/png'); continue; }
  await writeFile(`${PASTA}/${classe}.json`, json[1]);
  await writeFile(`${PASTA}/${classe}.png`, png[1]);
  console.log(classe, rev, json[1].length, png[1].length);
}
