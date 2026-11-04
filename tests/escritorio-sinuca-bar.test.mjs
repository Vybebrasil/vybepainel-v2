// Sinuca com a regra de bar do Brasil (Paulo, 28/10/2026: "o ás começando
// colado no lado contrário das outras bolas... quando suicida tira uma bola pro
// outro... se cegar perde uma bola... bater na bola do outro direto perde uma
// bola"; "onde bolar o bolão branco quando suicida... só pode no triângulo de
// saída"), e as trilhas exatas da animação ("a física quando bate na parede e
// nelas mesmo parece ruim, não tá real").
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarSinuca, simular, jogarSinuca, vistaSinuca, brancaPode, D_RAIO, RAIO, LARGURA } from '../server/escritorio-sinuca.js';

const R = 1.15, DIAG = Math.PI / 4, PARADA = -0.35;
function mesa(bolas, extra = {}) {
 const b = Array(16).fill(null);
 for (const [n, p] of Object.entries(bolas)) b[n] = p;
 return { modo: 'parimpar', regra: 'bar', bola1: true, r: R, bolas: b, vez: 'desafiante', grupos: { desafiante: 'pares', desafiado: 'impares' }, bolaNaMao: false, tacadas: 5, n: 3, ultimo: null, ...extra };
}
const tacar = (m, angulo, forca, branca, efeito = PARADA) => jogarSinuca(m, m.vez, { tipo: 'tacar', angulo, forca, efeito, ...(branca ? { branca } : {}) });

test('bar: 14 bolas no triângulo com o vértice vazio, o ás colado na cabeceira e a branca na mão atrás da linha', () => {
 const m = iniciarSinuca('desafiante', () => 0);
 assert.equal(m.regra, 'bar'); assert.equal(m.modo, 'parimpar'); assert.equal(m.bolaNaMao, 'saida');
 assert.deepEqual(m.bolas[1], [Math.round((RAIO + 0.01) * 1000) / 1000, 25], 'o ás colado no meio da tabela do lado da branca');
 const triangulo = m.bolas.filter((p, n) => p && n > 1);
 assert.equal(triangulo.length, 14);
 assert.ok(triangulo.every((p) => p[0] > 75.5), 'o vértice (a marca) fica vazio');
 assert.ok(m.bolas[0][0] <= 25, 'a branca na área de saída');
 // A branca fica onde está (já posta) ou muda de lugar atrás da linha; na frente da linha, não.
 assert.throws(() => tacar(m, 0, 0.9, { x: 40, y: 25 }), /atrás da linha/);
 const r = tacar(m, 0, 0.9, { x: 15, y: 25 });
 assert.equal(r.mesa.n, 1);
 assert.equal(tacar(m, 0, 0.9).mesa.n, 1, 'taca da branca já posta');
 assert.equal(vistaSinuca(m, 'desafiante', false).regra, 'bar');
});

test('bar: cegar, tocar a do outro primeiro e a suicida tiram a menor bola do outro (uma só por tacada)', () => {
 // Cegou (não tocou em nada): sai a 3 (a menor do ímpar), a vez passa e a branca fica onde parou.
 let r = tacar(mesa({ 0: [20, 25], 2: [50, 40], 3: [60, 10], 5: [70, 10] }), Math.PI, 0.05);
 assert.equal(r.mesa.ultimo.falta, 'nenhuma'); assert.equal(r.mesa.ultimo.tirou, 3); assert.equal(r.mesa.bolas[3], null);
 assert.equal(r.mesa.vez, 'desafiado'); assert.equal(r.mesa.bolaNaMao, false); assert.ok(r.mesa.bolas[0]);
 // Bateu direto na do outro: sai a menor dele.
 r = tacar(mesa({ 0: [20, 25], 5: [40, 25], 3: [60, 10], 2: [80, 40] }), 0, 0.5);
 assert.equal(r.mesa.ultimo.falta, 'errada'); assert.equal(r.mesa.ultimo.tirou, 3);
 // Suicida (a branca na caçapa do canto) tocando antes a bola do outro: uma bola só e a branca no D.
 r = tacar(mesa({ 0: [85, 35], 3: [60, 10], 5: [70, 10], 2: [20, 40] }), DIAG, 0.5, null, 0);
 assert.equal(r.mesa.ultimo.falta, 'branca'); assert.equal(r.mesa.ultimo.tirou, 3); assert.ok(r.mesa.bolas[5], 'só uma bola sai');
 assert.equal(r.mesa.bolaNaMao, 'D');
 const [bx, by] = r.mesa.bolas[0];
 assert.ok(brancaPode('D', bx, by, R), 'a branca já vem posta dentro do D');
 // Quem ganhou a falta põe a branca dentro do D, e não fora dele.
 const m2 = r.mesa;
 assert.throws(() => tacar(m2, 0, 0.5, { x: 10, y: 5 }), /dentro do D/);
 assert.throws(() => tacar(m2, 0, 0.5, { x: 30, y: 25 }), /dentro do D/);
 assert.equal(tacar(m2, 0, 0.5, { x: 25 - D_RAIO + 1, y: 25 }).mesa.n, m2.n + 1);
});

test('bar: nada volta na falta, matar a do outro é falta com multa, e falta com o outro no ás dá a partida a ele', () => {
 // A 4 entra mas a branca vai junto (suicida): a 4 fica na caçapa (Paulo, 04/11/2026: "não volta a que matou").
 let r = tacar(mesa({ 0: [85, 35], 4: [95, 45], 3: [20, 10], 6: [20, 40] }), DIAG, 0.6, null, 0.6);
 assert.ok(r.mesa.ultimo.caiu.includes(4) && r.mesa.ultimo.caiu.includes(0), 'a 4 e a branca caíram');
 assert.equal(r.mesa.bolas[4], null, 'a 4 não volta'); assert.equal(r.mesa.ultimo.voltou, undefined);
 // Derrubei a do outro (tocando a minha primeiro): é falta, sai mais uma dele e a vez passa.
 r = tacar(mesa({ 0: [75, 25], 2: [85, 35], 5: [95, 45], 3: [20, 10] }), DIAG, 0.75);
 assert.equal(r.mesa.ultimo.falta, 'do-outro'); assert.equal(r.mesa.bolas[5], null); assert.equal(r.mesa.vez, 'desafiado'); assert.equal(r.mesa.ultimo.tirou, 3);
 // O outro só tem o ás para matar: a minha falta dá a partida para ele.
 r = tacar(mesa({ 0: [20, 25], 2: [50, 40], 1: [60, 10] }), Math.PI, 0.05);
 assert.deepEqual(r.fim, { resultado: 'desafiado', motivo: 'falta-no-as' });
 // Grupo limpo: mata o ás e ganha.
 r = tacar(mesa({ 0: [85, 35], 1: [95, 45], 3: [20, 10] }), DIAG, 0.5);
 assert.deepEqual(r.fim, { resultado: 'desafiante', motivo: 'um' });
 // Tempo esgotado é falta: sai a menor do outro.
 r = jogarSinuca(mesa({ 0: [20, 25], 2: [50, 40], 3: [60, 10] }), 'desafiante', { tipo: 'tempo' });
 assert.equal(r.mesa.ultimo.tirou, 3); assert.equal(r.mesa.vez, 'desafiado');
});

test('bar: mesa aberta, a falta só passa a vez; a saída com suicida devolve a branca para a área de saída', () => {
 const aberta = (b, extra) => mesa(b, { grupos: { desafiante: null, desafiado: null }, ...extra });
 let r = tacar(aberta({ 0: [20, 25], 2: [50, 40], 3: [60, 10] }), Math.PI, 0.05);
 assert.equal(r.mesa.ultimo.falta, 'nenhuma'); assert.equal(r.mesa.ultimo.tirou, undefined); assert.equal(r.mesa.bolas.filter(Boolean).length, 3);
 r = tacar(aberta({ 0: [85, 35], 3: [60, 10], 6: [20, 40] }, { tacadas: 0, bolaNaMao: 'saida' }), DIAG, 0.5, null, 0);
 assert.equal(r.mesa.ultimo.falta, 'branca'); assert.equal(r.mesa.bolaNaMao, 'saida');
 // Encaçapou a 6 com a mesa aberta: fica com o par e continua.
 r = tacar(aberta({ 0: [85, 35], 6: [95, 45], 3: [20, 10] }), DIAG, 0.5);
 assert.deepEqual(r.mesa.grupos, { desafiante: 'pares', desafiado: 'impares' }); assert.equal(r.mesa.vez, 'desafiante');
});

test('trilhas: a animação tem o ponto exato da batida na tabela e na outra bola', () => {
 const b = Array(16).fill(null);
 b[0] = [60, 25]; b[5] = [80, 25];
 // A branca forte bate na 5, que vai reta na tabela da direita.
 const r = simular(b, 0, 0.8, -1, R, 0, { trilhas: true });
 const pontos = (n) => { const l = r.trilhas[n], o = []; for (let i = 0; i < l.length; i += 4) o.push(l.slice(i, i + 4)); return o; };
 const da5 = pontos(5);
 assert.ok(Math.abs(da5[0][1] - 800) <= 1, 'a 5 começa a andar de onde estava');
 assert.ok(da5.some((p) => Math.abs(p[1] - (LARGURA - R) * 10) < 0.00001), 'a 5 encosta exatamente na tabela');
 assert.ok(pontos(0).some((p) => Math.abs(p[1] - Math.round((80 - 2 * R) * 10)) <= 1), 'a branca encosta exatamente na 5');
 assert.ok(r.dur > 0 && r.dur === Math.max(...r.trilhas.filter(Boolean).map((l) => l[l.length - 4])), 'a duração é o último ponto');
 assert.equal(r.trilhas[3], null, 'bola parada não manda nada');
 assert.ok(r.eventos.every((e) => e.ms >= 0 && e.ms <= r.dur));
 // A trilha é bem menor que os quadros numa tacada comum.
 assert.ok(JSON.stringify(r.trilhas).length < JSON.stringify(r.quadros).length / 3);
});

// Paulo, 28/10/2026: "a bola ficar ali pertinho de cair mas não caiu... só
// cair se entrar a maior parte no buraco". Devagar, a bola para na boca (no
// meio e no canto) com metade do corpo quase em cima do buraco; ela só cai
// quando o centro passa da borda, e aí cai mesmo chegando quase parada.
test('bola na boca: devagar ela para na beirada e só cai com o centro por cima do buraco', async () => {
 const { BOCAS, RAIO: R0, simular: sim, velocidadeDaForca: vf, METROS_POR_UNIDADE: M } = await import('../server/escritorio-sinuca.js');
 for (const [nome, b0, alvo] of [['meio', [49.6, 10], 1], ['canto', [10, 10], 0]]) {
  const [cx, cy, cr] = BOCAS.buracos[alvo], ang = Math.atan2(cy - b0[1], cx - b0[0]);
  let ficou = Infinity, caiu = false;
  for (let v = 0.3; v <= 0.45 && !caiu; v += 0.0005) {
   const b = Array(16).fill(null); b[0] = b0;
   const r = sim(b, ang, (() => { let a = 0, z = 1; for (let i = 0; i < 60; i++) { const m = (a + z) / 2; vf(m) * M < v ? a = m : z = m; } return a; })(), 0, R0);
   if (r.caiu.includes(0)) caiu = true;
   else ficou = Math.min(ficou, Math.hypot(r.bolas[0][0] - cx, r.bolas[0][1] - cy) - cr);
  }
  assert.ok(caiu, `${nome}: um pouco mais forte, cai`);
  // Na beirada: o centro a menos de ~3 mm da borda do buraco (0,2 unidade de 1,65 cm).
  assert.ok(ficou >= 0 && ficou < 0.2, `${nome}: parou na beirada com o centro a ${ficou.toFixed(2)} da borda do buraco`);
 }
});

test('bar: regras da casa (multa de 2 bolas; bola do outro livre)', () => {
 // Multa de 2: tempo esgotado tira a 3 e a 5 do outro.
 let r = jogarSinuca(mesa({ 0: [20, 25], 2: [50, 40], 3: [60, 10], 5: [70, 10] }, { casa: { multa: 2 } }), 'desafiante', { tipo: 'tempo' });
 assert.equal(r.mesa.ultimo.tirou, 3); assert.deepEqual(r.mesa.ultimo.tirouMais, [5]); assert.equal(r.mesa.bolas[5], null);
 // Bola do outro livre: a 5 cai junto e não é falta, a vez passa sem multa.
 r = tacar(mesa({ 0: [75, 25], 2: [85, 35], 5: [95, 45], 3: [20, 10] }, { casa: { doOutro: 'livre' } }), DIAG, 0.75);
 assert.equal(r.mesa.ultimo.falta, null); assert.equal(r.mesa.ultimo.tirou, undefined); assert.equal(r.mesa.vez, 'desafiado');
 assert.deepEqual(vistaSinuca(mesa({ 0: [20, 25] }, { casa: { multa: 2 } }), 'desafiante').casa, { multa: 2, doOutro: 'falta', modo: 'parimpar' });
});

test('bola da vez: a menor primeiro, marca o valor e continua; falta dá 7 ao outro e a errada volta', async () => {
 const { iniciarBolaDaVez, MARCAS_BOLA_DA_VEZ } = await import('../server/escritorio-sinuca.js');
 const m = iniciarBolaDaVez('desafiante');
 assert.equal(m.bolaNaMao, 'D'); assert.deepEqual(m.pontos, { desafiante: 0, desafiado: 0 });
 const b = Array(16).fill(null); for (const [n, p] of Object.entries(MARCAS_BOLA_DA_VEZ)) b[n] = p;
 for (let i = 1; i <= 7; i++) for (let k = i + 1; k <= 7; k++) assert.ok(Math.hypot(b[i][0] - b[k][0], (b[i][1] - b[k][1]) * 1.0276) >= 2 * RAIO, `marcas ${i} e ${k} sem encostar`);
 // Só a 2 e a 5: a 2 é a da vez e entra (marca 2 e continua).
 const base = (bolas, extra = {}) => ({ ...iniciarBolaDaVez('desafiante'), bolas: (() => { const a = Array(16).fill(null); for (const [n, p] of Object.entries(bolas)) a[n] = p; return a; })(), bolaNaMao: false, tacadas: 3, ...extra });
 let r = tacar(base({ 0: [85, 35], 2: [95, 45], 5: [50, 10] }), DIAG, 0.5);
 assert.equal(r.mesa.pontos.desafiante, 2); assert.equal(r.mesa.vez, 'desafiante'); assert.equal(r.mesa.ultimo.marcou, 2);
 // Bater primeiro na 5 com a 2 na mesa: falta, 7 pontos para o outro, a vez passa.
 r = tacar(base({ 0: [85, 35], 5: [95, 45], 2: [20, 10] }), DIAG, 0.5);
 assert.equal(r.mesa.ultimo.falta, 'errada'); assert.equal(r.mesa.pontos.desafiado, 7); assert.equal(r.mesa.vez, 'desafiado');
 assert.ok(r.mesa.bolas[5], 'a 5 que caiu errada voltou para a marca');
 // Última bola encaçapada: fim, ganha quem tem mais pontos.
 r = tacar(base({ 0: [85, 35], 7: [95, 45] }, { pontos: { desafiante: 10, desafiado: 12 } }), DIAG, 0.5);
 assert.deepEqual(r.fim, { resultado: 'desafiante', motivo: 'pontos' });
});

// Paulo, 04/11/2026 ("trava com a força e não deixa bater nem no TACAR"): a tela
// punha a branca um fio fora da área (raio das outras bolas e arredondamento) e o
// servidor recusava toda tacada daquela vez. Um fio fora encaixa; longe, recusa.
test('bar: branca um fio fora do D ou colada na tabela encaixa e taca; longe da área recusa', () => {
 const comecar = (area) => { const m = iniciarSinuca('desafiante'); m.bolaNaMao = area; m.bolas[0] = null; return m; };
 for (const [area, x, y] of [['D', 21.04, 32.32], ['saida', 19.15, 1.21]]) {
  const r = jogarSinuca(comecar(area), 'desafiante', { tipo: 'tacar', angulo: 0.3, forca: 0.3, branca: { x, y } });
  assert.equal(r.mesa.n, 1, `${area} ${x},${y} tacou`);
 }
 assert.throws(() => jogarSinuca(comecar('D'), 'desafiante', { tipo: 'tacar', angulo: 0.3, forca: 0.3, branca: { x: 40, y: 25 } }), /dentro do D/);
});

// Paulo, 04/11/2026: "se eu sou par e bato direto na bola ímpar do cara...
// multa de 2 bolas". Vale mesmo com a casa cobrando 1 bola nas outras faltas.
test('bar: bater direto na bola do outro tira 2 bolas dele e passa a vez; a outra falta segue a multa da casa', () => {
 const montar = () => {
  const m = iniciarSinuca('desafiante'); m.bolaNaMao = false; m.tacadas = 6; m.vez = 'desafiante';
  m.grupos = { desafiante: 'pares', desafiado: 'impares' }; m.casa = { multa: 1, doOutro: 'falta', modo: 'parimpar' };
  m.bolas = m.bolas.map(() => null);
  m.bolas[0] = [30, 25]; m.bolas[3] = [50, 25]; m.bolas[5] = [70, 10]; m.bolas[7] = [80, 40]; m.bolas[9] = [85, 12];
  m.bolas[2] = [40, 10]; m.bolas[4] = [60, 42]; m.bolas[1] = [3, 25];
  return m;
 };
 const r = jogarSinuca(montar(), 'desafiante', { tipo: 'tacar', angulo: 0, forca: 0.15 });
 assert.equal(r.mesa.ultimo.primeiro, 3, 'tocou primeiro a 3 (ímpar, do outro)');
 assert.equal(r.mesa.ultimo.falta, 'errada');
 const sai = [r.mesa.ultimo.tirou, ...(r.mesa.ultimo.tirouMais || [])];
 assert.equal(sai.length, 2, `multa de 2 bolas: ${sai}`);
 assert.ok(sai.every((n) => n % 2 === 1 && !r.mesa.bolas[n]), 'saíram duas ímpares do outro');
 assert.equal(r.mesa.vez, 'desafiado');
 // Cegou (não tocou nenhuma): multa da casa, 1 bola.
 const m2 = montar(); m2.bolas[3] = null;
 const r2 = jogarSinuca(m2, 'desafiante', { tipo: 'tacar', angulo: Math.PI, forca: 0.05 });
 if (r2.mesa.ultimo.falta === 'nenhuma') assert.equal([r2.mesa.ultimo.tirou, ...(r2.mesa.ultimo.tirouMais || [])].filter(Boolean).length, 1);
});
