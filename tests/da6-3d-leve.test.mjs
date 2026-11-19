// SAFE: só lê os arquivos e roda funções isoladas com DOM simulado. Frente da-6 do confere de diretor de arte
// (19/11/2026): o mundo-3d.js inteiro só baixa quando o mundo abre; a abertura do painel leva a leitura leve.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8');
const mundo = ler('vybe-mundo.js');
function fonte(nome) { const ini = mundo.search(new RegExp(`(?:async )?function ${nome}\\(`)); assert.ok(ini >= 0, nome); const fim = mundo.indexOf('\n  }', ini); return mundo.slice(ini, fim + 4); }
// Todos os arquivos que uma entrada do mundo puxa (imports locais, recursivo).
function grafo(entrada, vistos = new Set()) {
  if (vistos.has(entrada)) return vistos; vistos.add(entrada);
  if (!entrada.endsWith('.mjs')) return vistos;
  for (const m of ler(entrada).matchAll(/(?:^|\n)\s*(?:import|export)\b[^;'"]*?from\s+'([^']+)'/g)) {
    if (m[1].startsWith('.')) grafo(path.posix.join(path.posix.dirname(entrada), m[1]), vistos); else vistos.add('pacote:' + m[1]);
  }
  return vistos;
}

test('a entrada leve não puxa three.js e traz o que o painel usa com o mundo fechado', () => {
  const g = [...grafo('mundo/mundo-leve.mjs')];
  assert.ok(!g.some((f) => f.startsWith('pacote:three')), 'mundo-leve sem three.js: ' + g.join(', '));
  const leve = ler('mundo/mundo-leve.mjs');
  for (const n of ['criarFonteAgentes', 'apresentarAgente', 'referenciaDaPeca', 'ESTADOS_REAIS', 'PLANTA', 'ZONAS_DO_PREDIO', 'CATALOGO']) assert.match(leve, new RegExp(`\\b${n}\\b`), n);
  // O CATALOGO da Loja é o mesmo JSON do catalogo.mjs (sem o voxel.mjs, que puxa o three.js).
  assert.match(ler('mundo/catalogo.mjs'), /export const CATALOGO = LIGACAO;/);
  assert.match(leve, /export \{ default as CATALOGO \} from '\.\/catalogo-ligacao\.json'/);
  // Retratos: o boneco das fotos e do agente, sem a cena (Irecê, Prédio, sala, quarto).
  const r = [...grafo('mundo/mundo-retratos.mjs')];
  assert.ok(!r.some((f) => /\/(centro|predio|sala|quarto|motor|vida)\.mjs$/.test(f)), 'retratos sem a cena: ' + r.join(', '));
  assert.match(ler('mundo/mundo-retratos.mjs'), /avatarVoxel, avatarVoxelFiel[^\n]*avatarDoAgente/);
});

test('a abertura do painel pede a leitura leve; o mundo-3d só com o mundo, um andar, um quarto ou um móvel à vista', () => {
  assert.match(mundo, /const MUNDO_LEVE_JS = "\/assets\/mundo\/mundo-leve\.js";/);
  assert.match(mundo, /const MUNDO_RETRATOS_JS = "\/assets\/mundo\/mundo-retratos\.js";/);
  const sinc = fonte('sincronizar');
  assert.match(sinc, /mundo\?\.pausar\(true\); void garantirLeve\(\);/);
  assert.doesNotMatch(sinc, /import\(MUNDO_JS/);
  assert.match(fonte('garantirLeve'), /import\(MUNDO_LEVE_JS\)/);
  // De fora (página Agentes e Boletim) continua vindo o avatarDoAgente.
  assert.match(fonte('garantirModulo'), /garantirLeve\(\)\.then\(\(leve\) => garantirRetratos\(\)/);
  assert.match(fonte('garantirRetratos'), /import\(MUNDO_RETRATOS_JS\)/);
  // A vitrine do saguão escondido não baixa o mundo: espera aparecer.
  const vit = fonte('vitrineVoxel');
  assert.match(vit, /new IntersectionObserver/); assert.match(vit, /aparecer\.then\(\(\) => \(vivo && el\.isConnected \? import\(MUNDO_JS\) : null\)\)/);
  // Móvel fora de vista não baixa o mundo; foto de pessoa fora de vista espera o pacote de retratos.
  const troca = fonte('trocarAvatar');
  assert.match(troca, /if \(!vivo\(\)\) \{ img\.dataset\.voxel = ''; reVer\?\.observe\(img\); return; \}\r?\n\s*const m3d = await import\(MUNDO_JS\);/);
  assert.match(troca, /if \(img\.offsetParent === null\) \{ img\.dataset\.voxel = ''; reVer\?\.observe\(img\); pedirRetratosNaFolga\(\); return; \}/);
  assert.match(troca, /guardarRetrato\(chave, fiel\)/);
  // Imagens com proporção reservada (o boneco é 128 × 160, o móvel é quadrado).
  assert.match(troca, /img\.style\.aspectRatio = 'auto 4 \/ 5'/); assert.match(troca, /img\.style\.aspectRatio = 'auto 1 \/ 1'/);
});

test('build e servidor local fazem as três entradas com os pedaços em comum', () => {
  const build = ler('scripts/build.mjs'), dev = ler('scripts/dev-server.mjs');
  assert.match(build, /const ENTRADAS_MUNDO = \['mundo-3d', 'mundo-leve', 'mundo-retratos'\];/);
  assert.match(build, /splitting: true/); assert.match(build, /chunkNames: 'mundo-parte-\[hash\]'/);
  assert.match(build, /mundo-3d\\\.js\|mundo-leve\\\.js\|mundo-retratos\\\.js/);
  assert.match(dev, /splitting: true/); assert.match(dev, /mundo-parte-\[A-Z0-9\]/);
});

test('o que está aberto vira classe no body, ligada e desligada só quando muda', () => {
  const el = (hidden, filhos = {}) => ({ hidden, querySelector: (s) => filhos[s] || null });
  const classes = new Set(); let trocas = 0;
  const body = { classList: { contains: (c) => classes.has(c), toggle: (c, sim) => { trocas++; if (sim) classes.add(c); else classes.delete(c); } } };
  const ids = { 'vv-placa': el(true), 'vv-pessoas': null, 'vv-comercial': el(true) };
  let chamada = null, setor = null;
  const c = vm.createContext({ body, JANELAS_DO_LADO: ['vv-pessoas', 'vv-ferramentas', 'vv-comercial', 'vv-carteira', 'vv-conteudo', 'vv-impressoes'],
    hud: { querySelector: (s) => (s === '.vv-chamada:not([hidden])' ? chamada : null) },
    document: { getElementById: (id) => ids[id] || null, querySelector: (s) => (s === '.vv-setor-visao:not([hidden])' ? setor : null) } });
  vm.runInContext(fonte('marcarAbertos'), c);
  c.marcarAbertos(); assert.deepEqual([...classes], []); assert.equal(trocas, 0);
  ids['vv-placa'] = el(false, { '.vv-camada': {} }); chamada = {}; ids['vv-comercial'].hidden = false;
  c.marcarAbertos(); assert.deepEqual([...classes].sort(), ['com-chamada', 'com-janela-lado', 'com-placa', 'com-placa-camada']);
  const n = trocas; c.marcarAbertos(); assert.equal(trocas, n, 'sem mudança, nada é regravado');
  ids['vv-placa'].hidden = true; setor = {};
  c.marcarAbertos(); assert.deepEqual([...classes].sort(), ['com-chamada', 'com-janela-lado', 'com-setor-visao']);
  // O CSS lê as classes, com a mesma especificidade dos :has de antes; nenhum :has de hidden desses sobrou.
  const css = ler('vybe-mundo.css');
  assert.doesNotMatch(css, /:has\((?:#mundo-hud )?[#.]vv-(?:placa|chamada|setor-visao)[^)]*:not\(\[hidden\]\)/);
  assert.doesNotMatch(css, /:has\(:is\(#vv-pessoas/);
  assert.match(css, /\.com-placa:not\(\.sem-placa\) #mundo-hud \.vv-agenda\{display:none\}/);
  assert.match(css, /body\.mundo\.com-janela-lado:not\(#sem-janela-lado\) #vv-wa-avisos/);
});

test('com a tela parada, o relógio de 5 s não regrava o que não mudou', () => {
  assert.match(mundo, /const mudarSe = \(el, k, v\) => \{ if \(el && el\[k\] !== v\) el\[k\] = v; \};/);
  assert.match(fonte('pintarSelosDeAviso'), /mudarSe\(el, 'hidden', !n\); mudarSe\(el, 'textContent'/);
  assert.match(fonte('pintarSalaNoTopo'), /mudarSe\(p, 'hidden', false\)/);
  assert.match(fonte('pintarAgenda'), /if \(el\.vvHtml !== lista\)/);
  assert.match(fonte('pintarChamada'), /if \(barra\.hidden !== !ver\) barra\.hidden = !ver;/);
  // A linha do cartão do VYBES: o prazo vem antes do getComputedStyle.
  const vy = ler('vybe-vybes.js');
  assert.ok(vy.indexOf('Date.now() - vybesConferidoEm < 120e3') < vy.indexOf("getComputedStyle(gate).display"));
});

test('pinos do mundo: sem reprojetar parados, sem seguir o VYBES apagado, sem trocar o "+N" a cada segundo', () => {
  const motor = ler('mundo/motor.mjs');
  assert.doesNotMatch(motor, /chaveDaCamera/);
  assert.match(motor, /if \(camMudou \|\| r\.px !== p\.x \|\| r\.py !== p\.y \|\| r\.pz !== p\.z\)/);
  assert.match(motor, /const w = r\.wMax = Math\.max\(w0, r\.wMax\), h = r\.hMax = Math\.max\(h0, r\.hMax\);/);
  assert.match(motor, /for \(const r of caixas\) \{\r?\n\s*if \(r\.oculto\) continue;/);
  assert.match(ler('mundo/predio.mjs'), /rotuloSer\.pos\.y = y \+ ser\.position\.y - boia \+ 3\.4;/);
});

test('foto de pessoa esperando o boneco brilha em tokens, sem a pixel art do Habbo', () => {
  const css = ler('padrao-v2/da-6.css');
  assert.match(css, /body\.mundo img\.avatar-esperando\{object-position:-9999px -9999px;background:linear-gradient\(100deg,var\(--d3-trilho\)/);
  assert.doesNotMatch(css, /!important|:has\(/);
  assert.match(ler('vybe-mundo-padrao-v2.css'), /padrao-v2\/da-6\.css/);
});
