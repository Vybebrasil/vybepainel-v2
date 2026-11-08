// Mundo voxel (Irecê + Prédio da Vybe): a planta e a regra de situação.
// SAFE: lógica pura, sem navegador e sem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { PLANTA, ESTADOS } from '../mundo/planta.mjs';

test('a planta do prédio segue o documento: recepção, 5 andares e o terraço do Escritório', () => {
  assert.deepEqual(PLANTA.map((a) => a.id), ['terreo', 'comercial', 'criacao', 'financeiro', 'tecnologia', 'estrategia', 'equipe', 'estudio', 'terraco']);
  assert.deepEqual(PLANTA.map((a) => a.nivel), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
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
  const { ZONAS_DO_PREDIO } = await import('../mundo/planta.mjs');
  const servidor = fs.readFileSync('server/escritorio-mapa.js', 'utf8');
  const donos = JSON.parse(servidor.match(/DONOS_ESCRITORIO = (\[[^\]]+\])/)[1]);
  donos.forEach((dono, i) => assert.equal(ZONAS_DO_PREDIO['sala-' + i]?.dono, dono, 'sala-' + i));
  for (const zona of ['recepcao', 'reuniao', 'auditorio', 'producao', 'cafe', 'jogos', 'foco', 'academia', 'lounge', 'operacao'])
    assert.ok(ZONAS_DO_PREDIO[zona], zona);
  const andares = new Set(PLANTA.map((a) => a.id));
  for (const [id, z] of Object.entries(ZONAS_DO_PREDIO)) assert.ok(andares.has(z.andar), id);
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
