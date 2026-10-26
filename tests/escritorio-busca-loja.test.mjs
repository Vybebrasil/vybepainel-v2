// Busca e ambientes da Loja e do catálogo, histórico de compras da Carteira e
// revestimento de parede que mantém a altura (26/10/2026: o Vinícius queria
// montar uma academia e não achava as peças).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { bancoEscritorio as banco } from './escritorio-esquema.mjs';
import { comprarMovel, venderMovel, carregarEconomia } from '../server/escritorio-economia.js';

const catalogo = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8'));

function editor() {
  const c = vm.createContext({ console, window: {}, safeText: String, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 },
    document: { querySelector: () => null, getElementById: () => null, addEventListener() {}, documentElement: {} } });
  vm.runInContext(readFileSync('vybe-escritorio-editor.js', 'utf8'), c);
  c.cat = catalogo;
  return (busca) => vm.runInContext(`cat.filter((m) => escritorioBuscaCombina(escritorioNomeMovel(m) + " " + m.nome + " " + m.classe, ${JSON.stringify(busca)})).map((m) => m.classe)`, c);
}

test('busca em português acha as peças de academia do acervo em inglês', () => {
  const buscar = editor();
  for (const [busca, classe] of [['esteira', /treadmill/], ['halteres', /dumbell|weight/], ['academia', /gym|treadmill/], ['saco de pancada', /sparring|boxing|punch/]])
    assert.ok(buscar(busca).some((c) => classe.test(c)), busca);
  // Sinônimo só vale inteiro: nada de barraca no haltere nem tapete no fogão.
  assert.ok(!buscar('haltere').some((c) => /tent/.test(c)));
  assert.ok(!buscar('fogão').some((c) => /woven/.test(c)));
  assert.equal(buscar('xyzqwe').length, 0);
});

test('o ambiente Academia tem peças e os ambientes viram categorias da Loja', () => {
  const c = vm.createContext({ console, safeText: String, escritorioSemAcento: (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    ESCRITORIO_GRUPOS_CATALOGO: [['Camas', (m) => /bed/.test(m.classe)]], ESCRITORIO_SECOES_CATALOGO: [], document: { querySelector: () => null } });
  vm.runInContext(readFileSync('vybe-escritorio-loja.js', 'utf8'), c);
  c.cat = catalogo;
  const academia = vm.runInContext('cat.filter(escritorioDoAmbiente(ESCRITORIO_AMBIENTES.find(([n]) => n === "Academia")))', c);
  assert.ok(academia.length >= 10, `academia com ${academia.length} peças`);
  assert.ok(vm.runInContext('ESCRITORIO_GRUPOS_CATALOGO.some(([n]) => n === "Academia")', c));
});

test('trocar só o revestimento mantém a altura da parede', () => {
  const fonte = readFileSync('vybe-escritorio-ficha.js', 'utf8');
  const fn = fonte.slice(fonte.indexOf('function escritorioCodigoTrecho'), fonte.indexOf('function pintarTodasParedesEscritorio'));
  const c = vm.createContext({ ESCRITORIO_PAREDES_SALA: ['', '#fff'] });
  vm.runInContext(fn, c);
  const cod = (pin, atual) => vm.runInContext(`escritorioCodigoTrecho(${JSON.stringify(pin)}, ${JSON.stringify(atual)})`, c);
  assert.equal(cod({ textura: 'country_forestwall', estilo: 'c', cor: '', altura: '2' }, 'c11'), 'c11', 'parede média continua média');
  assert.equal(cod({ textura: 'country_forestwall', estilo: 'c', cor: '', altura: '2' }, '-00'), '-00', 'sem pintura: a altura do quarto');
  assert.equal(cod({ textura: 'country_forestwall', alturaFixa: true, estilo: 'c', cor: '', altura: '0' }, 'c12'), 'a00', 'altura escolhida depois vale');
  assert.equal(cod({ textura: '', estilo: 'c', cor: '#fff', altura: '1' }, '-00'), 'c11');
});

test('histórico da Carteira: compra, venda à loja e o que está com a pessoa', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec(readFileSync('migrations/2026-10-26-escritorio-construcao-livre-e-venda.sql', 'utf8'));
  await sql`SELECT vybe_lancar_pontos(${1},${'teste:' + crypto.randomUUID()},NULL,NULL,${1000},0)`;
  await comprarMovel(sql, 1, { classe: 'shelves_norja', chave: crypto.randomUUID(), quantidade: 2 });
  let eco = await carregarEconomia(sql, 1);
  assert.equal(eco.historico.length, 1);
  assert.deepEqual({ ...eco.historico[0], em: undefined }, { tipo: 'compra', classes: ['shelves_norja'], unidades: 2, valor: -50, em: undefined });
  await venderMovel(sql, { id: 1 }, [{ id: 'sala-0', pessoa_id: '1' }], { classe: 'shelves_norja', chave: crypto.randomUUID() });
  eco = await carregarEconomia(sql, 1);
  assert.deepEqual(eco.historico.map((h) => [h.tipo, h.valor]), [['venda', 25], ['compra', -50]]);
});
