// Frente S-h (Paulo, 19/11/2026): "na parte de mostrar o feed do cliente também, não tá mostrando todos os posts.. pode
// deixar rolar o feed com o que tiver no calendário pra ver tudo". O vybe-feed.js de verdade, numa data fixa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HOJE = '2026-11-16';

function ambiente(itens, extra = {}) {
  const c = vm.createContext({ console, Intl,
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [`${HOJE}T15:00:00Z`])); } static now() { return Date.parse(`${HOJE}T15:00:00Z`); } },
    localStorage: { getItem: () => null, setItem() {} }, DADOS: itens, clientesDoItem: (i) => [i.cliente], safeText: String, jsArg: String,
    CADASTRO_CLIENTES: [{ nome: 'Lions', ativo: true, cadastro: { instagram: '@lions' } }], ...extra });
  vm.runInContext(ler('vybe-feed.js'), c);
  return c;
}
const dia = (n) => { const d = new Date(`${HOJE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// 40 peças à frente (uma a cada 3 dias, quatro meses) e 50 já veiculadas, mais um story (fora do feed).
function muitas() {
  const itens = [];
  for (let i = 0; i < 40; i += 1) itens.push({ id: `f${i}`, cliente: 'Lions', formato: ['Reels', 'Card', 'Carrossel'][i % 3], veiculacao_iso: dia(i * 3), status: 'A Fazer' });
  for (let i = 1; i <= 50; i += 1) itens.push({ id: `p${i}`, cliente: 'Lions', formato: 'Card', veiculacao_iso: dia(-i * 2), status: 'Finalizado' });
  itens.push({ id: 's1', cliente: 'Lions', formato: 'Story', veiculacao_iso: dia(5), status: 'A Fazer' });
  return itens;
}
const ids = (l) => [...l].filter((x) => x.item).map((x) => x.item.id);

test('todos os itens do calendário entram no feed: o que vem depois da janela em cima, o que saiu inteiro embaixo', () => {
  const c = ambiente(muitas());
  const g = vm.runInContext("feedMontar({ nome: 'Lions', usuario: '' })", c);
  const fim = g.jan.fim;
  assert.ok(g.depois > 0, 'há peças depois das 4 semanas');
  assert.deepEqual(ids(g.grade).sort(), Array.from({ length: 40 }, (_, i) => `f${i}`).sort(), 'as 40 à frente, sem o story');
  assert.ok(g.grade.every((t, i, l) => i === 0 || l[i - 1].iso >= t.iso), 'o mais novo em cima');
  assert.ok(g.grade.findIndex((t) => t.iso <= fim) > 0, 'o que vem depois da janela fica acima dela');
  assert.equal(g.noAr.length, 50, 'todas as publicadas, não só 9');
  assert.equal(g.noAr[0].item.id, 'p1', 'a mais recente encosta no hoje');
  const html = vm.runInContext("feedV2GradeHtml({ nome: 'Lions', usuario: '', heads: [], bio: '' }, feedMontar({ nome: 'Lions', usuario: '' }))", c);
  for (let i = 0; i < 40; i += 1) assert.ok(html.includes(`data-vfd-item="f${i}"`), `f${i} desenhada`);
  assert.match(html, /vfd-selo-ar/, 'o selo do hoje');
  assert.ok(html.indexOf('vfd-selo-ar') > html.indexOf('data-vfd-item="f0"'), 'o selo vem depois do que vai sair');
});

test('os buracos continuam só dentro da janela, nas 4 semanas e no mês', () => {
  const c = ambiente(muitas().filter((x) => x.id !== 'f1' && x.id !== 'f2'));
  const g = vm.runInContext("feedMontar({ nome: 'Lions', usuario: '' })", c);
  assert.ok(g.buracos.length > 0);
  assert.ok(g.buracos.every((b) => b.iso >= g.jan.ini && b.iso <= g.jan.fim && b.iso >= HOJE), 'buraco só na janela, de hoje em diante');
  assert.ok(g.grade.filter((t) => t.buraco).every((b) => b.iso <= g.jan.fim), 'nenhum X depois da janela');
  // Mês adiante: o que vem antes dele (entre hoje e o dia 1) também aparece, e os X só no mês.
  const m = vm.runInContext("FEED.vista = 'mes'; FEED.mes = '2027-01'; feedMontar({ nome: 'Lions', usuario: '' })", c);
  assert.ok(m.buracos.every((b) => b.iso.startsWith('2027-01') || (b.iso >= m.jan.ini && b.iso <= m.jan.fim)));
  assert.ok(ids(m.grade).some((id) => m.grade.find((t) => t.item?.id === id).iso < '2027-01-01'), 'o antes do mês continua na grade');
  assert.equal(ids(m.grade).length, 38);
});

test('o que já saiu desenha por partes e as artes da parte seguinte já são pedidas', () => {
  const pedidos = [];
  const c = ambiente(muitas(), { fetch: async (url) => { pedidos.push(decodeURIComponent(url)); return { ok: true, json: async () => ({ ok: true, itens: {} }) }; } });
  const cli = "({ nome: 'Lions', usuario: '' })";
  const html = vm.runInContext(`feedNoArHtml(${cli}, feedMontar(${cli}))`, c);
  assert.equal((html.match(/vfd-passado/g) || []).length, 36, 'a primeira parte');
  assert.match(html, /data-vfd-mais="Lions"/, 'o marcador pede a próxima');
  const tudo = vm.runInContext(`FEED.noArMax.set('Lions', 72); feedNoArHtml(${cli}, feedMontar(${cli}))`, c);
  assert.equal((tudo.match(/vfd-passado/g) || []).length, 50);
  assert.doesNotMatch(tudo, /data-vfd-mais/, 'sem mais nada, sem marcador');
  vm.runInContext(`FEED.noArMax.clear(); renderFeedDoCliente = () => {}; feedAberto = false; feedPedirArtes([${cli}])`, c);
  const pedidas = pedidos[0].split('itens=')[1].split(',');
  for (let i = 0; i < 40; i += 1) assert.ok(pedidas.includes(`f${i}`), `arte de f${i}`);
  for (let i = 1; i <= 50; i += 1) assert.ok(pedidas.includes(`p${i}`), `arte de p${i} (até a próxima parte)`);
});

test('ao abrir, a grade mostra a semana; repintar não mexe na rolagem; CSS só com tokens', () => {
  const src = ler('vybe-feed.js');
  assert.match(src, /function feedV2Ancorar\(rola, jan\)/);
  assert.ok(src.includes("const topo = rola && rola.dataset.vfd2Rola === cli.nome && cel.vfdChave === chave ? rola.scrollTop : null;"));
  assert.doesNotMatch(src, /publicadas\.slice\(0, 9\)|g\.futuro\.slice\(-gradeMax\)/, 'sem os cortes antigos');
  const css = ler('padrao-v2/s-h.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /!important|html body\.mundo|:has\(|rgba?\(/);
  assert.doesNotMatch(css, /:[^;{}]*#[0-9a-fA-F]{3,8}\b/, 'só tokens --d3-*');
});
