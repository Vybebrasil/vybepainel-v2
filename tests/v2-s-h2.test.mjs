// Frente S-h2 (Paulo, 19/11/2026): "no feed não fica buraco assim... não devia ser inteligente e se reordenar? inclusive
// quando eu mudo algo". O vybe-feed.js de verdade, numa data fixa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HOJE = '2026-11-16';
const dia = (n) => { const d = new Date(`${HOJE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function ambiente(itens, extra = {}) {
  const c = vm.createContext({ console, Intl,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${HOJE}T15:00:00Z`])); } static now() { return Date.parse(`${HOJE}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ nome: 'Lions', ativo: true }], ...extra });
  vm.runInContext(ler('vybe-feed.js'), c);
  return c;
}
// 7 à frente (deixa a última linha do futuro incompleta) e 8 já veiculadas.
const itens = () => [
  ...Array.from({ length: 7 }, (_, i) => ({ id: `f${i}`, cliente: 'Lions', formato: 'Card', veiculacao_iso: dia(40 + i * 2), status: 'A Fazer' })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, cliente: 'Lions', formato: 'Card', veiculacao_iso: dia(-1 - i), status: 'Finalizado' })),
];
const CLI = "({ nome: 'Lions', usuario: '', heads: [], bio: '', site: '' })";
const grade = (c) => vm.runInContext(`feedV2GradeHtml(${CLI}, feedMontar(${CLI}))`, c);
const chaves = (html) => [...html.matchAll(/data-vfd-chave="([^"]+)"/g)].map((m) => m[1]);

test('uma grade só e contínua: o que vem e o que já saiu nas mesmas 3 colunas, sem linha inteira no meio', () => {
  const html = grade(ambiente(itens()));
  assert.equal((html.match(/class="vfd-grade"/g) || []).length, 1, 'uma grade');
  assert.doesNotMatch(html, /vfd2-hoje|grid-column/, 'sem faixa que quebre a linha');
  const ks = chaves(html);
  const g = vm.runInContext(`feedMontar(${CLI})`, ambiente(itens()));
  assert.equal(ks.length, g.grade.length + g.noAr.length, 'cada quadro é uma célula: nada vazio no meio');
  assert.ok(ks.indexOf('i:f0') < ks.indexOf('i:p0'), 'o que vem em cima, o que saiu embaixo');
  // O selo "no ar" fica no primeiro publicado, o mais recente.
  assert.match(html, /class="vfd-t vfd-passado vfd-hoje" data-vfd-chave="i:p0"[^>]*>[\s\S]*?<span class="vfd-selo-ar"[^>]*>no ar<\/span><\/div>/);
  assert.equal((html.match(/vfd-selo-ar/g) || []).length, 1);
});

test('buraco continua sendo um quadro na posição da data, colado nos vizinhos', () => {
  const html = grade(ambiente(itens()));
  const ks = chaves(html);
  const buracos = ks.filter((k) => k.startsWith('x:'));
  assert.ok(buracos.length > 0, 'há dias sem post nas 4 semanas');
  const datas = ks.filter((k) => !k.startsWith('i:p')).map((k) => (k.startsWith('x:') ? k.slice(2) : vm.runInContext(`DADOS.find((x) => x.id === '${k.slice(2)}').veiculacao_iso`, ambiente(itens()))));
  assert.deepEqual(datas, [...datas].sort().reverse(), 'peças e buracos na ordem da data, o mais novo em cima');
});

test('mudar a data reordena a grade na hora (a mesma chave, outra posição)', () => {
  const c = ambiente(itens());
  const antes = chaves(grade(c));
  vm.runInContext("DADOS.find((x) => x.id === 'f6').veiculacao_iso = '" + dia(3) + "'", c);
  const depois = chaves(grade(c));
  assert.ok(depois.indexOf('i:f6') > antes.indexOf('i:f6'), 'f6 desce para perto de hoje');
  assert.ok(depois.indexOf('i:f6') < depois.indexOf('i:p0'), 'e continua acima do que já saiu');
  // Passou a ser publicada: vira quadro do "no ar", com o selo.
  vm.runInContext("DADOS.find((x) => x.id === 'f6').veiculacao_iso = '" + dia(-1) + "'; DADOS.find((x) => x.id === 'f6').status = 'Finalizado'", c);
  assert.match(grade(c), /vfd-hoje" data-vfd-chave="i:(f6|p0)"/);
});

test('a grade se reordena com animação curta (até 200 ms, sem animar com reduzir movimento) e ouve as mudanças de fora', () => {
  const src = ler('vybe-feed.js');
  assert.match(src, /function feedAnimarTroca\(raiz, antes\)/);
  assert.match(src, /prefers-reduced-motion: reduce/);
  assert.match(src, /duration: 200/);
  assert.match(src, /for \(const nome of \['renderIntegratedOperationalViews', 'renderManagerCalendar'\]\)/);
  // Com o Feed aberto, a função de fora chama o original e repinta o Feed.
  let original = 0, pintou = 0;
  const c = ambiente(itens(), { window: {}, location: { search: '' }, requestAnimationFrame: (f) => f() });
  vm.runInContext('window.renderManagerCalendar = () => {}; window.renderIntegratedOperationalViews = () => {};', c);
  c.window.renderManagerCalendar = () => { original += 1; };
  vm.runInContext('renderFeedDoCliente = () => { globalThis.__pintou = (globalThis.__pintou || 0) + 1; }; feedOuvirMudancas(); feedAberto = true; window.renderManagerCalendar();', c);
  pintou = c.__pintou;
  assert.equal(original, 1); assert.equal(pintou, 1);
  vm.runInContext('feedAberto = false; window.renderManagerCalendar();', c);
  assert.equal(original, 2); assert.equal(c.__pintou, 1, 'fechado, não repinta');
});

test('CSS: selo de 12 px, faixa cheia atrás da etapa, só tokens', () => {
  const css = ler('padrao-v2/s-h2.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.vfd-selo-ar\{[^}]*font:500 12px/);
  assert.match(css, /\.vfd-peca:not\(\.vfd-sem-arte\)::after\{height:44px;background:var\(--d3-fume-forte\)/);
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\(|rgba?\(|text-transform/);
  assert.doesNotMatch(css, /:[^;{}]*#[0-9a-fA-F]{3,8}\b/);
});
