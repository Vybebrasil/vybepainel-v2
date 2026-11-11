// Lista das peças que têm a arte do Habbo no repositório (assets/escritorio/habbo/<classe>.json + .png), para o
// mundo voxel não pedir a arte de quem não a tem (redesign r5, quadro 35). Sem a arte aqui, a API ia ao habboassets,
// que limita os pedidos (429) e devolvia 404: a Loja caía na pixel art do Habbo e o console enchia de 404.
// Gerada no build (scripts/build.mjs) e conferida nos testes; rode `node scripts/artes-locais.mjs` ao mudar a pasta.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ARQUIVO = 'mundo/artes-locais.json';
export async function artesLocais(pasta = 'assets/escritorio/habbo') {
  const nomes = new Set(await readdir(pasta));
  return [...nomes].filter((f) => f.endsWith('.json') && nomes.has(f.slice(0, -5) + '.png')).map((f) => f.slice(0, -5)).sort();
}
export async function gerarArtesLocais() {
  const texto = JSON.stringify(await artesLocais()) + '\n';
  const antes = await readFile(ARQUIVO, 'utf8').catch(() => '');
  if (antes !== texto) await writeFile(ARQUIVO, texto);
  return antes !== texto;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log((await gerarArtesLocais()) ? `${ARQUIVO} atualizado.` : `${ARQUIVO} já estava em dia.`);
