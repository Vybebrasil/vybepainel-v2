import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';

let html = await readFile('index.html', 'utf8');
const fontes = [...html.matchAll(/<script\s+src="\/([^"?]+)"\s*><\/script>/g)].map((m) => m[1]);
if (!fontes.length) throw new Error('Nenhum módulo encontrado.');
// Preserva os limites entre scripts: concatenar mudaria o momento em que
// declarações globais substituem funções anteriores (hoisting).
const modulos = await Promise.all(fontes.map(async (fonte) => ({ fonte,
  ...(await transform(await readFile(fonte,'utf8'), { loader:'js', minifyWhitespace:true,
    minifySyntax:true, minifyIdentifiers:false, target:'es2022', legalComments:'none' })) })));
const css = await transform(await readFile('vybe-styles.css', 'utf8'), { loader: 'css', minify: true });
await mkdir('dist/assets', { recursive: true });
for (const f of await readdir('dist/assets')) if (/^[\w-]+-[a-f0-9]{12}\.(js|css)$/.test(f)) await unlink(`dist/assets/${f}`);
const asset = async (code, ext, prefixo='painel') => {
  const nome = `${prefixo}-${createHash('sha256').update(code).digest('hex').slice(0, 12)}.${ext}`;
  await writeFile(`dist/assets/${nome}`, code);
  return `/assets/${nome}`;
};
const estilo = await asset(css.code, 'css');
const caminhos = new Map(await Promise.all(modulos.map(async (m) =>
  [m.fonte, await asset(m.code,'js',m.fonte.replace(/\.js$/,''))])));
html = html.replace(/<script\s+src="\/([^"?]+)"\s*><\/script>/g,
  (_,fonte) => `<script defer src="${caminhos.get(fonte)}"></script>`);
html = html.replace('/vybe-styles.css', estilo);
const logo = await asset(await readFile('assets/vybe-branca.png'), 'png', 'vybe-branca');
html = html.replace('/assets/vybe-branca.png', logo);
await writeFile('dist/index.html', html);
// Rota de recuperação já utilizada pelo módulo de cadastros.
await writeFile('dist/cadastros_governed_v2.js', (await transform(await readFile('cadastros_governed_v2.js','utf8'),
  { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false })).code);
console.log(`Build: HTML ${Buffer.byteLength(html)} B, JS ${modulos.reduce((n,m)=>n+Buffer.byteLength(m.code),0)} B (${modulos.length} módulos), CSS ${Buffer.byteLength(css.code)} B.`);
