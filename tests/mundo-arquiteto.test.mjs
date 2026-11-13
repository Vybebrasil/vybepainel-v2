import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projetarQuarto, classificar, desenharPiso, desenharEstrutura } from '../mundo/arquiteto.mjs';
import { Obra } from '../mundo/voxel.mjs';
import { paredesDaPlanta, plantaDoQuarto } from '../mundo/quarto.mjs';

const fisica = JSON.parse(fs.readFileSync('assets/escritorio/habbo/fisica.json', 'utf8'));
const catalogo = new Map(JSON.parse(fs.readFileSync('assets/escritorio/habbo/catalogo.json', 'utf8')).map((i) => [i.classe, i]));
const ficha = (c) => { const v = fisica[c]; return v ? { pisa: !!(v[0] & 1), senta: !!(v[0] & 2), deita: !!(v[0] & 4), altura: +v[1] || 0 } : null; };
const deParede = (c) => !!(fisica[c]?.[0] & 16);
const opcoes = (W, D) => ({ ficha, info: (c) => catalogo.get(c), deParede, W, D, nivel: .816, alturaParede: 3 });
const misturar = (a) => a;

// A cabana do Paulo (sala-0, 13/11/2026), como está salva: painéis de toras, blocos de telhado, janelas, porta e piso.
const CABANA = [
  ...[0, 1, 2, 4, 3, 5, 6, 7].map((x) => ['xmas_c22_roofblock', x, 8, 2, 0, 0]), ['xmas_c22_roofblock', 8, 7, 0, 0, 0], ['xmas_c22_roofblock', 8, 8, 0, 0, 0],
  ['wintercabin_c19_wall', -0.5, 6.75, 2, 0, 0], ['wintercabin_c19_wall', -0.5, 4.75, 2, 0, 0], ['wintercabin_c19_wall', -0.5, 2.75, 2, 0, 0], ['wintercabin_c19_wall', -0.5, 0.75, 2, 0, 0],
  ['wintercabin_c19_wall', 0, 0, 4, 0, 0], ['wintercabin_c19_wall', 2, 0, 4, 0, 0], ['wintercabin_c19_wall', 4, 0, 4, 0, 0], ['wintercabin_c19_wall', 6, 0, 4, 0, 0], ['wintercabin_c19_wall', 7, 0, 4, 0, 0],
  ['wintercabin_c19_wall', 9, 1, 2, 0, 0], ['wintercabin_c19_wall', 5, 13, 4, 0, 5],
  ['bubblejuice_c21_window', 0.25, 1.75, 2, 0, 1], ['bubblejuice_c21_window', 0.25, 3.75, 2, 0, 1], ['xmas_c22_door', 5.75, 0.5, 4, 0, 0],
  ...[[0, 2], [2, 2], [4, 2], [6, 2], [2, 4], [4, 4]].map(([x, y]) => ['xmas11_woodfloor', x, y, 0, 0, 0]),
  ['vikings_bed', -0.25, 6.25, 2, 0, 0], ['carpet_polar', 1, 2, 0, 0, 0], ['cpunk_c15_table', 2.25, 1, 4, 0, 0],
];

test('arquiteto: a cabana vira paredes de toras com as janelas e a porta embutidas, mureta na frente e piso de tábuas', () => {
  const r = projetarQuarto(CABANA, opcoes(8, 8));
  const paredes = r.estruturas.filter((s) => s.tipo === 'parede'), muretas = r.estruturas.filter((s) => s.tipo === 'mureta');
  const esquerda = paredes.find((s) => s.eixo === 'y' && s.linha === 0), fundo = paredes.find((s) => s.eixo === 'x' && s.linha === 0);
  assert.ok(esquerda && fundo, 'parede da esquerda e do fundo, encostadas na borda do quarto');
  assert.equal(esquerda.material, 'toras');
  assert.equal(esquerda.aberturas.filter((a) => a.tipo === 'janela').length, 2, 'as duas janelas viram vão na parede');
  assert.equal(fundo.aberturas.filter((a) => a.tipo === 'porta').length, 1, 'a porta vira vão na parede do fundo');
  assert.ok(fundo.a1 - fundo.a0 >= 7.9, 'a parede do fundo é uma só, de ponta a ponta (painéis de 2, um sobreposto)');
  assert.ok(muretas.some((s) => s.eixo === 'x' && s.linha === 8), 'os blocos de telhado em fila viram mureta na frente');
  assert.equal(r.pisos.get('3,3'), 'madeira');
  for (const s of r.estruturas) assert.ok(s.a0 >= 0 && s.a1 <= 8, 'nenhuma parede sai do quarto');
  const usadas = new Set([...r.usados].map((i) => CABANA[i][0]));
  for (const c of ['vikings_bed', 'carpet_polar', 'cpunk_c15_table']) assert.ok(!usadas.has(c), c + ' continua móvel');
  assert.ok(!r.estruturas.some((s) => s.eixo === 'y' && s.linha > 7 && s.tipo === 'parede'), 'painel fora do quarto não vira parede solta');
});

test('arquiteto: pedestais e tapetes ficam móveis; divisória de vidro em fila vira parede de vidro', () => {
  assert.equal(classificar('bc_cylinder_recolorable', { ficha: ficha('bc_cylinder_recolorable'), info: catalogo.get('bc_cylinder_recolorable') }), null);
  assert.equal(classificar('carpet_polar', { ficha: ficha('carpet_polar'), info: catalogo.get('carpet_polar') }), null);
  const r = projetarQuarto([['olympics_c16_glssdvdr', 12, 3.25, 0, 0, .1], ['olympics_c16_glssdvdr', 14, 3.25, 0, 0, .1]], opcoes(16, 16));
  assert.equal(r.estruturas.length, 1); assert.equal(r.estruturas[0].material, 'vidro');
});

test('arquiteto: piso sem faces no mesmo plano (saíam triângulos que mudavam com o zoom)', () => {
  const empate = (o, nome) => {
    const b = o.solidos;
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      const A = b[i], B = b[j];
      const ox = Math.min(A.x + A.w / 2, B.x + B.w / 2) - Math.max(A.x - A.w / 2, B.x - B.w / 2), oz = Math.min(A.z + A.d / 2, B.z + B.d / 2) - Math.max(A.z - A.d / 2, B.z - B.d / 2);
      if (ox > 1e-4 && oz > 1e-4 && Math.abs((A.y + A.h) - (B.y + B.h)) < 1e-6 && A.cor !== B.cor) assert.fail(`${nome}: topos no mesmo plano`);
    }
  };
  for (const mat of ['madeira', 'marmore', 'marmoreEscuro', 'concreto', 'agua', 'grama', 'folhas', 'areia', 'neve']) { const o = new Obra(); desenharPiso(o, 2, 3, 0, mat, misturar); empate(o, mat); }
});

test('arquiteto: as paredes saem com as aberturas e o vidro vai para o desenho transparente', () => {
  const r = projetarQuarto(CABANA, opcoes(8, 8)), o = new Obra(), vidros = [];
  for (const s of r.estruturas) desenharEstrutura(o, s, { misturar, vidro: (...b) => vidros.push(b) });
  assert.ok(o.solidos.length > 50 && o.luzes.length >= 2, 'toras, caixilhos e o vidro aceso das janelas');
  const v = projetarQuarto([['olympics_c16_glssdvdr', 2, 3, 0, 0, 0], ['olympics_c16_glssdvdr', 4, 3, 0, 0, 0]], opcoes(8, 8)).estruturas[0];
  desenharEstrutura(new Obra(), v, { misturar, vidro: (...b) => vidros.push(b) });
  assert.ok(vidros.length >= 1, 'o painel de vidro é desenhado transparente');
});

test('planta em U e L: os lados do recuo também têm parede (antes ficavam abertos)', () => {
  const p = paredesDaPlanta(plantaDoQuarto({ w: 4, h: 4, celdas: [[-1, -1, 0, 0], [-1, -1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }));
  assert.ok(p.some((t) => t.eixo === 'x' && t.x === 0 && t.y === 2), 'fundo do recuo');
  const pL = paredesDaPlanta(plantaDoQuarto({ w: 4, h: 3, celdas: [[0, 0, 0, 0], [0, 0, -1, -1], [0, 0, 0, 0]] }));
  assert.ok(pL.some((t) => t.eixo === 'x' && t.x === 2 && t.y === 2 && t.interna), 'borda do fundo dentro do recuo');
});

test('material voxel: a quina mede o pixel pela posição; piso só recebe sombra; peça vira como o Habbo desenha', () => {
  const s = fs.readFileSync('mundo/voxel.mjs', 'utf8');
  assert.doesNotMatch(s, /fwidth\(vxE\)/); assert.match(s, /length\(fwidth\(vVxPos\)\)/);
  const q = fs.readFileSync('mundo/quarto.mjs', 'utf8');
  assert.match(q, /casca\.montar\(\{ sombra: false \}\)/);
  assert.match(q, /const direcaoDesenhada/);
});

test('mundo sem z-fighting: folga por caixa, desempate de profundidade no shader e a cidade varrida', async () => {
  const s = fs.readFileSync('mundo/voxel.mjs', 'utf8');
  assert.match(s, /export function folgaDaCaixa/); assert.match(s, /gl_InstanceID % 256/);
  const { execFileSync } = await import('node:child_process');
  const saida = execFileSync(process.execPath, ['scripts/varrer-empates.mjs'], { encoding: 'utf8' });
  const [, total, visiveis] = saida.match(/empates (\d+) visíveis \(área > 1 cm² × 100\) (\d+)/) || [];
  assert.ok(Number(total) <= 15, `a cidade tinha 1926 faces empatadas; hoje ${total}`);
  assert.ok(Number(visiveis) <= 6, `empates com área que se vê: ${visiveis}`);
});
