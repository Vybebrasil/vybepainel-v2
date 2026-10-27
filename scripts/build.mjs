import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';

let html = await readFile('index.html', 'utf8');
const fontes = [...html.matchAll(/<script\s+src="\/([^"?]+)"\s*><\/script>/g)].map((m) => m[1]);
if (!fontes.length) throw new Error('Nenhum módulo encontrado.');
// Preserva os limites entre scripts: concatenar mudaria o momento em que
// declarações globais substituem funções anteriores (hoisting).
// Arte do escritório (assets/escritorio/habbo) não vai para o dist: sai pela
// API só para quem está logado. Uma versão única (hash da pasta) renova o
// cache do navegador quando qualquer arquivo muda.
const hashArte = createHash('sha256');
for (const f of (await readdir('assets/escritorio/habbo')).filter((f) => /\.(png|json)$/.test(f)).sort())
  hashArte.update(f).update(await readFile(`assets/escritorio/habbo/${f}`));
const versaoArte = hashArte.digest('hex').slice(0, 12);
const comSprites = (codigo) => codigo.replace(/const MAPA_BASE = "[^"]*";/,
  (m) => `${m} const ESCRITORIO_ARTE_VERSAO = ${JSON.stringify(versaoArte)};`);
const modulos = await Promise.all(fontes.map(async (fonte) => ({ fonte,
  ...(await transform(comSprites(await readFile(fonte,'utf8')), { loader:'js', minifyWhitespace:true,
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
const appearance = await transform(await readFile('vybe-appearance.css','utf8'), { loader: 'css', minify: true });
const appearancePath = await asset(appearance.code, 'css', 'appearance');
const padrao = await transform(await readFile('vybe-padrao.css','utf8'), { loader: 'css', minify: true });
const padraoPath = await asset(padrao.code, 'css', 'padrao');
const caminhos = new Map(await Promise.all(modulos.map(async (m) =>
  [m.fonte, await asset(m.code,'js',m.fonte.replace(/\.js$/,'').replaceAll('/','-'))])));
html = html.replace(/<script\s+src="\/([^"?]+)"\s*><\/script>/g,
  (_,fonte) => `<script defer src="${caminhos.get(fonte)}"></script>`);
html = html.replace('/vybe-styles.css', estilo).replace('/vybe-appearance.css', appearancePath).replace('/vybe-padrao.css', padraoPath);
const logo = await asset(await readFile('assets/vybe-branca.png'), 'png', 'vybe-branca');
html = html.replaceAll('/assets/vybe-branca.png', logo);
const vybelandia = await asset(await readFile('assets/vybelandia.webp'), 'webp', 'vybelandia');
html = html.replaceAll('/assets/vybelandia.webp', vybelandia);
// App instalável (tela inicial do celular, Dock, Windows): manifesto e ícones
// ficam com caminho fixo, sem hash, porque o sistema guarda o endereço.
await mkdir('dist/assets/app', { recursive: true });
await writeFile('dist/manifest.webmanifest', await readFile('manifest.webmanifest'));
for (const f of await readdir('assets/app')) await writeFile(`dist/assets/app/${f}`, await readFile(`assets/app/${f}`));
// Cartas e fichas dos jogos de mesa (Kenney, CC0): folhas únicas com caminho
// fixo, recortadas pelo CSS (vybe-styles.css, .pkr-carta.img).
await mkdir('dist/assets/jogos', { recursive: true });
for (const f of (await readdir('assets/jogos')).filter((f) => /\.webp$/.test(f))) await writeFile(`dist/assets/jogos/${f}`, await readFile(`assets/jogos/${f}`));
// Sons dos jogos (Kenney, CC0): tocados pelo Web Audio (jogosSom).
await mkdir('dist/assets/jogos/sons', { recursive: true });
for (const f of (await readdir('assets/jogos/sons')).filter((f) => /\.ogg$/.test(f))) await writeFile(`dist/assets/jogos/sons/${f}`, await readFile(`assets/jogos/sons/${f}`));
// Página pública /instalar (link para mandar no grupo): ensina ou oferece a
// instalação conforme o aparelho. Não pede login nem mostra dados.
await writeFile('dist/instalar.html', await readFile('instalar.html'));
// Versão do painel: o mesmo hash para a página e para /versao.json, que as abas
// abertas conferem para se atualizar (vybe-versao.js).
const versaoPainel = createHash('sha256').update(html).digest('hex').slice(0, 12);
html = html.replace('</head>', `  <meta name="vybe-versao" content="${versaoPainel}">\n</head>`);
await writeFile('dist/versao.json', JSON.stringify({ versao: versaoPainel }));
await writeFile('dist/index.html', html);
// Rota de recuperação já utilizada pelo módulo de cadastros.
await writeFile('dist/cadastros_governed_v2.js', (await transform(await readFile('cadastros_governed_v2.js','utf8'),
  { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false })).code);
console.log(`Build: HTML ${Buffer.byteLength(html)} B, JS ${modulos.reduce((n,m)=>n+Buffer.byteLength(m.code),0)} B (${modulos.length} módulos), CSS ${Buffer.byteLength(css.code) + Buffer.byteLength(appearance.code)} B.`);
