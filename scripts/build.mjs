import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform, build } from 'esbuild';

let html = await readFile('index.html', 'utf8');
// Os módulos sob demanda (vybe-sob-demanda.js) ganham hash como os outros;
// só não rodam na abertura.
const SCRIPT = /<script(\s+type="vybe\/sob-demanda"\s+data-grupo="[\w-]+")?\s+src="\/([^"?]+)"\s*><\/script>/g;
const fontes = [...html.matchAll(SCRIPT)].map((m) => m[2]);
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
// Sinuca em 3D: a cena e o three.js num arquivo só, com hash, carregado sob
// demanda pela própria sinuca (o endereço é trocado no cliente).
const cena3d = (await build({ entryPoints: ['vybe-escritorio-sinuca-3d.mjs'], bundle: true, format: 'esm', minify: true,
  target: 'es2022', write: false, legalComments: 'none' })).outputFiles[0].text;
const nome3d = `sinuca-3d-${createHash('sha256').update(cena3d).digest('hex').slice(0, 12)}.js`;
// Mundo voxel (Irecê + Prédio da Vybe): o mesmo esquema da sinuca. O three.js
// vem junto e só baixa quando o mundo abre; o relevo/ruas (assets/mundo/irece.json)
// vai com hash. vybe-mundo.js aponta para os dois pelos caminhos fixos abaixo.
const mundo3d = (await build({ entryPoints: ['mundo/mundo-3d.mjs'], bundle: true, format: 'esm', minify: true,
  target: 'es2022', write: false, legalComments: 'none' })).outputFiles[0].text;
const nomeMundo = `mundo-3d-${createHash('sha256').update(mundo3d).digest('hex').slice(0, 12)}.js`;
const irece = await readFile('assets/mundo/irece.json');
const nomeIrece = `irece-${createHash('sha256').update(irece).digest('hex').slice(0, 12)}.json`;
// Base pública de empresas de Irecê (CNPJ) para o CRM de prospecção do 1º andar: também com hash.
const crmIrece = await readFile('assets/mundo/crm-irece.json');
const nomeCrm = `crm-irece-${createHash('sha256').update(crmIrece).digest('hex').slice(0, 12)}.json`;
const com3d = (codigo) => codigo.replace('"/assets/jogos/sinuca-3d.js"', JSON.stringify(`/assets/jogos/${nome3d}`))
  .replaceAll('"/assets/mundo/mundo-3d.js"', JSON.stringify(`/assets/mundo/${nomeMundo}`))
  .replaceAll('"/assets/mundo/irece.json"', JSON.stringify(`/assets/mundo/${nomeIrece}`))
  .replaceAll('"/assets/mundo/crm-irece.json"', JSON.stringify(`/assets/mundo/${nomeCrm}`));
// Artes dos jogos (o pano da sinuca, cartas, fichas): caminho fixo, mas o
// navegador guarda /assets/* por um ano (immutable). Sem a versão no endereço o
// pano novo não aparecia para quem já tinha aberto a sinuca (04/11/2026).
const artesJogos = await Promise.all((await readdir('assets/jogos')).filter((f) => /\.webp$/.test(f)).map(async (f) =>
  [`/assets/jogos/${f}`, `/assets/jogos/${f}?v=${createHash('sha256').update(await readFile(`assets/jogos/${f}`)).digest('hex').slice(0, 12)}`]));
const comArtes = (codigo) => artesJogos.reduce((c, [de, para]) => c.replaceAll(de, para), codigo);
const modulos = await Promise.all(fontes.map(async (fonte) => ({ fonte,
  ...(await transform(comArtes(com3d(comSprites(await readFile(fonte,'utf8')))), { loader:'js', minifyWhitespace:true,
    minifySyntax:true, minifyIdentifiers:false, target:'es2022', legalComments:'none' })) })));
for (const m of modulos) if (/"\/assets\/mundo\/(mundo-3d\.js|irece\.json|crm-irece\.json)"/.test(m.code))
  throw new Error(`Build: ${m.fonte} ainda pede um arquivo do mundo sem hash (daria 404 em produção).`);
const css = await transform(comArtes(await readFile('vybe-styles.css', 'utf8')), { loader: 'css', minify: true });
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
// A arte da Vybelândia (cartão do Escritório na tela de módulos) vai com hash;
// o CSS do padrão aponta para ela, então troca o caminho lá também (sem isto a
// foto sumia em produção: /assets/vybelandia.webp não existe no dist).
const vybelandia = await asset(await readFile('assets/vybelandia.webp'), 'webp', 'vybelandia');
// O mesmo para o ser do VYBES (cartão do VYBES na tela de módulos).
const vybesSer = await asset(await readFile('assets/vybes-ser.webp'), 'webp', 'vybes-ser');
const mundoCss = await transform(await readFile('vybe-mundo.css','utf8'), { loader: 'css', minify: true });
const mundoCssPath = await asset(mundoCss.code, 'css', 'mundo');
// Folhas próprias das janelas do Irecity (vybe-mundo-*.css, ex.: vybe-mundo-conversa.css) ligadas no
// index.html: cada uma com hash, como as outras. Sem isto o <link> ficaria apontando para um arquivo
// que não vai para o dist (404 em produção).
const folhasMundo = [];
for (const [, f] of html.matchAll(/href="\/(vybe-mundo-[\w-]+\.css)"/g)) {
  const folha = await transform(await readFile(f, 'utf8'), { loader: 'css', minify: true });
  folhasMundo.push([`/${f}`, await asset(folha.code, 'css', f.replace(/^vybe-/, '').replace(/\.css$/, ''))]);
}
const padraoPath = await asset(padrao.code.replaceAll('/assets/vybelandia.webp', vybelandia).replaceAll('/assets/vybes-ser.webp', vybesSer), 'css', 'padrao');
const caminhos = new Map(await Promise.all(modulos.map(async (m) =>
  [m.fonte, await asset(m.code,'js',m.fonte.replace(/\.js$/,'').replaceAll('/','-'))])));
html = html.replace(SCRIPT, (_, sobDemanda, fonte) => sobDemanda
  ? `<script${sobDemanda} src="${caminhos.get(fonte)}"></script>`
  : `<script defer src="${caminhos.get(fonte)}"></script>`);
html = html.replace('/vybe-styles.css', estilo).replace('/vybe-appearance.css', appearancePath).replace('/vybe-padrao.css', padraoPath).replace('/vybe-mundo.css', mundoCssPath);
for (const [de, para] of folhasMundo) html = html.replace(de, para);
const logo = await asset(await readFile('assets/vybe-branca.png'), 'png', 'vybe-branca');
html = html.replaceAll('/assets/vybe-branca.png', logo);
html = html.replaceAll('/assets/vybelandia.webp', vybelandia);
// App instalável (tela inicial do celular, Dock, Windows): manifesto e ícones
// ficam com caminho fixo, sem hash, porque o sistema guarda o endereço.
// Ícones coloridos (05/11/2026) em assets/app/cor, com nome novo: o endereço
// antigo fica um ano no cache (immutable) e o celular pegaria o ícone velho.
await mkdir('dist/assets/app/cor', { recursive: true });
await writeFile('dist/manifest.webmanifest', await readFile('manifest.webmanifest'));
for (const f of await readdir('assets/app/cor')) await writeFile(`dist/assets/app/cor/${f}`, await readFile(`assets/app/cor/${f}`));
// Cartas e fichas dos jogos de mesa (Kenney, CC0): folhas únicas com caminho
// fixo, recortadas pelo CSS (vybe-styles.css, .pkr-carta.img).
await mkdir('dist/assets/jogos', { recursive: true });
for (const f of await readdir('dist/assets/jogos')) if (/^sinuca-3d-[a-f0-9]{12}\.js$/.test(f)) await unlink(`dist/assets/jogos/${f}`);
await writeFile(`dist/assets/jogos/${nome3d}`, cena3d);
await mkdir('dist/assets/mundo', { recursive: true });
for (const f of await readdir('dist/assets/mundo')) if (/^(mundo-3d-[a-f0-9]{12}\.js|(crm-)?irece-[a-f0-9]{12}\.json)$/.test(f)) await unlink(`dist/assets/mundo/${f}`);
await writeFile(`dist/assets/mundo/${nomeMundo}`, mundo3d);
await writeFile(`dist/assets/mundo/${nomeIrece}`, irece);
await writeFile(`dist/assets/mundo/${nomeCrm}`, crmIrece);
for (const f of (await readdir('assets/jogos')).filter((f) => /\.webp$/.test(f))) await writeFile(`dist/assets/jogos/${f}`, await readFile(`assets/jogos/${f}`));
// Sons dos jogos (Kenney, CC0): tocados pelo Web Audio (jogosSom).
await mkdir('dist/assets/jogos/sons', { recursive: true });
for (const f of (await readdir('assets/jogos/sons')).filter((f) => /\.(ogg|mp3)$/.test(f))) await writeFile(`dist/assets/jogos/sons/${f}`, await readFile(`assets/jogos/sons/${f}`));
// Falas do VYBES no Escritório (chamado pela sala com a central fechada): áudios na voz da central, gerados por
// scripts/falas-sala.js no repositório do bot a partir de core/frases.js. Caminho fixo, como os sons dos jogos.
await mkdir('dist/assets/vybes-fala', { recursive: true });
for (const f of (await readdir('assets/vybes-fala')).filter((f) => /\.(mp3|json)$/.test(f))) await writeFile(`dist/assets/vybes-fala/${f}`, await readFile(`assets/vybes-fala/${f}`));
// Página pública /instalar (link para mandar no grupo): ensina ou oferece a
// instalação conforme o aparelho. Não pede login nem mostra dados.
await writeFile('dist/instalar.html', await readFile('instalar.html'));
// Versão do painel: o mesmo hash para a página e para /versao.json, que as abas
// abertas conferem para se atualizar (vybe-versao.js).
const versaoPainel = createHash('sha256').update(html).digest('hex').slice(0, 12);
html = html.replace('</head>', `  <meta name="vybe-versao" content="${versaoPainel}">\n</head>`);
await writeFile('dist/versao.json', JSON.stringify({ versao: versaoPainel }));
await writeFile('dist/index.html', html);
// App "Agenda Vybe" (05/11/2026, pedido do Paulo para o Mizinho): o mesmo painel
// em /agenda, com manifesto, nome e ícone próprios. Instalado, abre direto no
// módulo Produção (initPanelMode olha o endereço). /instalar-agenda é a página
// de instalar com o mesmo texto do /instalar, apontando para este app.
const trocar = (texto, trocas, nome) => trocas.reduce((t, [de, para]) => {
  if (!t.includes(de)) throw new Error(`${nome}: não achei "${de}" para trocar.`);
  return t.replaceAll(de, para);
}, texto);
await writeFile('dist/agenda.webmanifest', await readFile('agenda.webmanifest'));
await writeFile('dist/agenda.html', trocar(html, [
  ['<title>Vybe OS — Painel de Produção v2</title>', '<title>Agenda Vybe</title>'],
  ['href="/manifest.webmanifest"', 'href="/agenda.webmanifest"'],
  ['/assets/app/cor/os-', '/assets/app/cor/agenda-'],
  ['name="apple-mobile-web-app-title" content="Vybe OS"', 'name="apple-mobile-web-app-title" content="Agenda Vybe"'],
], 'agenda.html'));
await writeFile('dist/instalar-agenda.html', trocar(await readFile('instalar.html', 'utf8'), [
  ['href="/manifest.webmanifest"', 'href="/agenda.webmanifest"'],
  ['/assets/app/cor/os-', '/assets/app/cor/agenda-'],
  ['content="Vybe OS"', 'content="Agenda Vybe"'],
  ['Instalar o Vybe OS', 'Instalar a Agenda Vybe'],
  ['Instalar Vybe OS', 'Instalar Agenda Vybe'],
  ['O painel da equipe Vybe, com ícone na tela inicial.', 'A produção da Vybe (captações, fotografia e edição), com ícone na tela inicial.'],
  ['Abrir o Vybe OS', 'Abrir a Agenda Vybe'],
  ['ícone do Vybe OS', 'ícone da Agenda Vybe'],
  ['href="/"', 'href="/agenda"'],
  ['vercel.app/instalar"', 'vercel.app/instalar-agenda"'],
], 'instalar-agenda.html'));
// Rota de recuperação já utilizada pelo módulo de cadastros.
await writeFile('dist/cadastros_governed_v2.js', (await transform(await readFile('cadastros_governed_v2.js','utf8'),
  { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false })).code);
console.log(`Build: HTML ${Buffer.byteLength(html)} B, JS ${modulos.reduce((n,m)=>n+Buffer.byteLength(m.code),0)} B (${modulos.length} módulos), CSS ${Buffer.byteLength(css.code) + Buffer.byteLength(appearance.code)} B.`);
