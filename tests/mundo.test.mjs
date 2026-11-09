// Mundo voxel (Irecê + Prédio da Vybe): a planta e a regra de situação.
// SAFE: lógica pura, sem navegador e sem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PLANTA, ESTADOS } from '../mundo/planta.mjs';

test('a planta do prédio segue o documento: recepção, 5 andares e o terraço do Escritório', () => {
  assert.deepEqual(PLANTA.map((a) => a.id), ['terreo', 'comercial', 'criacao', 'financeiro', 'tecnologia', 'estrategia', 'estudio', 'terraco']);
  assert.deepEqual(PLANTA.map((a) => a.nivel), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const a of PLANTA) for (const s of a.setores) assert.ok(ESTADOS[s.estado], `${s.id}: estado ${s.estado}`);
});

test('toda sala com módulo aponta para um módulo que existe no painel', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const MODOS = { vybes: 'chooseVybesMode', escritorio: 'chooseOfficeMode', clientes: 'chooseClientMode', controler: 'chooseDaControllerMode', producao: 'chooseProductionMode', gestor: 'chooseManagerMode' };
  const fontes = fs.readdirSync('.').filter((f) => /^vybe-.*\.js$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  for (const a of PLANTA) for (const s of a.setores) {
    if (!s.modulo) continue;
    if (s.modulo.tipo === 'link') { assert.match(s.modulo.url, /^https:\/\/[a-z0-9-]+\.vercel\.app\/[a-z0-9/-]*$/, `link ${s.modulo.alvo}`); continue; } // sistema irmão (Vybe Finanças)
    if (s.modulo.tipo === 'janela') { assert.ok(fontes.includes('window.Vybe' + s.modulo.alvo[0].toUpperCase() + s.modulo.alvo.slice(1) + ' = '), `janela ${s.modulo.alvo}`); continue; } // janela do Irecity (ex.: Comercial)
    if (s.modulo.tipo === 'quadro') assert.ok(html.includes(`id="btn-board-${s.modulo.alvo}"`), `quadro ${s.modulo.alvo}`);
    else assert.match(fontes, new RegExp(`function ${MODOS[s.modulo.alvo]}\\(`), `modo ${s.modulo.alvo}`);
  }
});

test('situação da peça: data do cliente manda e a mais urgente vence', () => {
  const ctx = { window: {}, document: { body: { classList: { toggle() {}, contains() { return false; } }, dataset: {}, append() {} }, createElement: () => ({ getContext: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], innerHTML: '' }), readyState: 'complete', getElementById: () => null, querySelector: () => null, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} }, MutationObserver: class { observe() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }),
    setInterval: () => 0, clearInterval() {}, hojeDeVerdade: () => '2026-11-06', isFinishedItem: (d) => /Finalizado/.test(d.status) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('vybe-mundo.js', 'utf8'), ctx);
  const sit = ctx.window.situacaoDaPecaNoMundo;
  assert.equal(sit({ status: 'Finalizado', veiculacao_iso: '2026-11-01' }), 'concluida');
  assert.equal(sit({ status: 'Em andamento', veiculacao_iso: '2026-11-05' }), 'atrasada');
  assert.equal(sit({ status: 'Para aprovação', veiculacao_iso: '2026-11-09' }), 'aprovar');
  assert.equal(sit({ status: 'Alteração', veiculacao_iso: '2026-11-09' }), 'ajuste');
  assert.equal(sit({ status: 'Pode Fazer', veiculacao_iso: '2026-11-06' }), 'hoje');
  assert.equal(sit({ status: 'Falta Briefing', veiculacao_iso: '2026-11-20' }), 'briefing');
  assert.equal(sit({ status: 'Agendado', veiculacao_iso: '2026-11-20' }), 'pronta');
  assert.equal(sit({ status: 'Pode Fazer', veiculacao_iso: '2026-11-20' }), 'fazer');
});

test('Antonov, VOA e Hebravet dividem um complexo; DiaCenter e DiaLab são vizinhas, mas separadas', async () => {
  const { ocuparLotes } = await import('../mundo/clientes.mjs');
  const L = ['Antonov', 'VOA', 'Hebravet', 'DiaCenter', 'DiaLab', 'Copirecê'].map((nome, i) => ({ nome, total: 10 - i, peso: i % 2 ? 8 : 2 }));
  const ocup = ocuparLotes(L).map((o) => o.clientes.map((c) => c.nome));
  assert.deepEqual(ocup.find((g) => g.includes('VOA')).sort(), ['Antonov', 'Hebravet', 'VOA']);
  const i = ocup.findIndex((g) => g[0] === 'DiaCenter');
  assert.deepEqual([ocup[i], ocup[i + 1]], [['DiaCenter'], ['DiaLab']]);
});

test('toda sala do Escritório tem lugar no prédio (as zonas de voz não mudam)', async () => {
  const { ZONAS_DO_PREDIO, SALAS_DO_TIME } = await import('../mundo/planta.mjs');
  const servidor = fs.readFileSync('server/escritorio-mapa.js', 'utf8');
  const donos = JSON.parse(servidor.match(/DONOS_ESCRITORIO = (\[[^\]]+\])/)[1]);
  donos.forEach((dono, i) => assert.equal(ZONAS_DO_PREDIO['sala-' + i]?.dono, dono, 'sala-' + i));
  for (const zona of ['recepcao', 'reuniao', 'auditorio', 'producao', 'cafe', 'jogos', 'foco', 'academia', 'lounge', 'operacao'])
    assert.ok(ZONAS_DO_PREDIO[zona], zona);
  const andares = new Set(PLANTA.map((a) => a.id));
  for (const [id, z] of Object.entries(ZONAS_DO_PREDIO)) assert.ok(andares.has(z.andar) || z.andar === SALAS_DO_TIME, id);
  // O andar dos humanos saiu (Paulo, 09/11/2026): as salas de cada um e a reunião ficam só na voz e em "Minha sala".
  assert.ok(!PLANTA.some((a) => a.id === 'equipe'), 'sem o 6º andar Time Vybe');
  for (const id of ['reuniao', ...donos.map((_, i) => 'sala-' + i)]) assert.equal(ZONAS_DO_PREDIO[id].andar, SALAS_DO_TIME, id);
});

test('avatar voxel: a mesma figura do Habbo vira sempre o mesmo boneco, e figuras diferentes viram bonecos diferentes', async () => {
  const { lerFigura } = await import('../mundo/avatar.mjs');
  const a = lerFigura('hr-100-61.hd-180-1.ch-210-66.lg-270-82'), b = lerFigura('hr-100-61.hd-180-1.ch-210-66.lg-270-82');
  assert.deepEqual(a, b);
  const c = lerFigura('hr-515-45.hd-600-3.ch-665-92.lg-715-1408.ea-1406');
  assert.notDeepEqual(a, c);
  assert.equal(c.oculos, true);
  assert.ok(lerFigura('').roupa, 'figura vazia também vira boneco');
});

test('móvel do Habbo vira ícone voxel do mesmo tipo', async () => {
  const { tipoDoMovel } = await import('../mundo/avatar.mjs');
  assert.equal(tipoDoMovel('chair_norja'), 'cadeira');
  assert.equal(tipoDoMovel('bling_sofa_mu'), 'sofa');
  assert.equal(tipoDoMovel('hc3_stereo'), 'som');
  assert.equal(tipoDoMovel('prizetrophy'), 'trofeu');
  assert.equal(tipoDoMovel('shelves_norja'), 'estante');
  assert.equal(tipoDoMovel('qualquer_coisa'), 'caixa');
});

test('catálogo voxel: cada peça ligada a um item que a loja já vende, sem repetir, e com desenho', async () => {
  const ligacao = JSON.parse(fs.readFileSync('mundo/catalogo-ligacao.json', 'utf8'));
  const loja = new Set(JSON.parse(fs.readFileSync('assets/escritorio/habbo/catalogo.json', 'utf8')).map((m) => m.classe));
  assert.ok(ligacao.length >= 100, 'pelo menos 100 peças');
  assert.equal(new Set(ligacao.map((p) => p.classe)).size, ligacao.length, 'uma classe por peça');
  for (const p of ligacao) assert.ok(loja.has(p.classe), `${p.id}: ${p.classe} não existe na loja`);
  const fonte = fs.readFileSync('mundo/catalogo.mjs', 'utf8');
  for (const d of new Set(ligacao.map((p) => p.desenho))) assert.ok(fonte.includes(d + '() {'), 'desenho ' + d);
});

test('Minha sala: a planta do Habbo vira ladrilhos com nível, e as paredes ficam no fundo e à esquerda', async () => {
  const { plantaDoQuarto, paredesDaPlanta } = await import('../mundo/quarto.mjs');
  // 4 × 3 com um buraco no canto do fundo à esquerda e um patamar de 2 níveis.
  const p = plantaDoQuarto({ w: 4, h: 3, nivelEm: (x, y) => (x === 0 && y === 0 ? -1 : x === 3 && y === 2 ? 2 : 0) });
  assert.equal(p.W, 4); assert.equal(p.D, 3);
  assert.equal(p.nivel(0, 0), -1); assert.equal(p.nivel(3, 2), 2); assert.equal(p.nivel(9, 9), -1);
  const paredes = paredesDaPlanta(p);
  assert.deepEqual(paredes.filter((q) => q.eixo === 'x').map((q) => [q.x, q.y]), [[0, 1], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(paredes.filter((q) => q.eixo === 'y').map((q) => [q.x, q.y]), [[1, 0], [0, 1], [0, 2]]);
});

test('Minha sala fica no dock junto de Centro e Prédio e abre o quarto sem o andar dos humanos', () => {
  const src = fs.readFileSync('vybe-mundo.js', 'utf8');
  assert.match(src, /\{ id: 'minha-sala', grupo: 'Vybe', nome: 'Minha sala'/);
  const corpo = src.slice(src.indexOf('async function abrirMinhaSala'), src.indexOf('// ---------- Agenda'));
  assert.match(corpo, /m\.abrirQuarto\(/, 'desenha pelo mundo/quarto.mjs');
  assert.match(corpo, /irParaSala\(zona\)/, 'abrir entra na zona da sala (voz)');
  assert.match(corpo, /escritorioItensDaCamada/, 'móveis da camada salva');
  assert.doesNotMatch(corpo, /escritorioApi|fetch\(/, 'só leitura');
});

test('Minha sala: o móvel é esculpido na arte do Habbo (silhueta, altura e cor do pixel)', async () => {
  const { esculpir, projetar, NIVEL_HABBO } = await import('../mundo/moveis-habbo.mjs');
  // Um cubo de 1 ladrilho e 1 nível, desenhado como no Habbo: a imagem é a projeção dele, topo vermelho e lados azuis.
  const dentroDoCubo = (sx, sy) => {
    // O que a câmera vê é o ponto mais à frente (maior u + v + h) entre os que caem no pixel.
    let melhor = null;
    for (let u = -.5; u <= .501; u += .05) for (let v = -.5; v <= .501; v += .05) for (let h = 0; h <= 1.001; h += .05) {
      const p = projetar(u, v, h); if (Math.abs(p.x - sx) < 1.2 && Math.abs(p.y - sy) < 1.2 && (!melhor || u + v + h > melhor.d)) melhor = { d: u + v + h, topo: h > .97 };
    }
    return melhor ? (melhor.topo ? 'topo' : 'lado') : null;
  };
  const ox = -33, oy = -50, w = 66, h = 68, mapa = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mapa.push(dentroDoCubo(x + ox, y + oy));
  const vista = { dir: 4, w, h, ox, oy, alfa: (x, y) => (x >= 0 && y >= 0 && x < w && y < h && mapa[y * w + x] ? 255 : 0),
    cor: (x, y) => { const m = x >= 0 && y >= 0 && x < w && y < h ? mapa[y * w + x] : null; return m === 'topo' ? [220, 40, 40] : m ? [40, 60, 200] : null; } };
  const r = esculpir({ W: 1, D: 1, dir: 4, vistas: [vista], N: 8, alturaMax: 1 });
  assert.ok(r.blocos.length > 50);
  for (const b of r.blocos) { assert.ok(b.x > 0 && b.x < 1 && b.z > 0 && b.z < 1, 'dentro da pegada'); }
  const alto = Math.max(...r.blocos.map((b) => b.y + r.lado));
  assert.ok(Math.abs(alto - NIVEL_HABBO) < .2, 'altura de 1 nível do Habbo: ' + alto);
  const topo = r.blocos.filter((b) => b.y + r.lado > alto - .01);
  const vermelho = (c) => { const [r, , b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return r > 150 && b < 110; };
  assert.ok(topo.filter((b) => vermelho(b.cor)).length > topo.length / 2, 'o topo pega a cor do topo do desenho');
  assert.ok(new Set(r.blocos.map((b) => b.cor)).size <= 12, 'cores chapadas: a paleta curta da peça');
});

test('Minha sala: o quarto voxel tem a interface de decorar e o WASD do Escritório', () => {
  const src = fs.readFileSync('mundo/quarto.mjs', 'utf8');
  for (const f of ['iniciarEdicao', 'pararEdicao', 'segurar:', 'girar:', 'guardar:', 'grade:', 'definirItens(', 'definirAcabamento'])
    assert.ok(src.includes(f), 'falta ' + f);
  // Soltar o ponteiro sempre limpa o toque (antes, depois de arrastar uma peça, o próximo arrasto não começava).
  const solta = src.slice(src.indexOf("canvas.addEventListener('pointerup'"));
  assert.ok(solta.indexOf('soltar(e)') < solta.indexOf('if (ed?.arrasto) { soltarArrasto(); return; }'), 'soltar antes do arrasto');
  assert.match(src, /tecladoEscritorio\?\.\(e\)/, 'WASD pelo movimento do Escritório');
  const mundo = fs.readFileSync('vybe-mundo.js', 'utf8');
  assert.match(mundo, /acao: 'decorar'/, 'botão Decorar no dock');
  assert.match(mundo, /podeDecorar\?\.\(zonaAberta\)/, 'só na sala que a pessoa pode decorar');
});

test('Loja, inventário e decorar mostram a arte do móvel (o que o quarto mostra), não o cubo do catálogo', () => {
  const mundo = fs.readFileSync('vybe-mundo.js', 'utf8');
  assert.doesNotMatch(mundo, /function ligarIconesVoxel/, 'mapaDesenharMovel sem troca por cubo');
  assert.doesNotMatch(mundo, /iconeMovel\(decodeURIComponent/, 'imagem oficial do móvel não vira cubo');
  const decorar = fs.readFileSync('vybe-mundo-decorar.js', 'utf8');
  assert.match(decorar, /mapaDesenharMovel\(m, dir/, 'ícone do decorar pela arte do móvel');
});
