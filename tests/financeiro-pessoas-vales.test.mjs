// Pessoas e vales (Paulo, 14/11/2026): "esses pix já entenda que eu posso editar ou atribuir eles a alguém ou algum gasto
// fixo… e já cria um esquema de na ficha da pessoa ficar o que passou do salário do mês dela; o excedente fica como vale".
// No Extrato: "Para quem" (pessoa do time, sócio incluído), "Gasto fixo" e "Sempre assim" com a pessoa. Por pessoa:
// combinado × pago × vale, mês a mês. Só os quatro donos. SAFE: extrato INVENTADO, PGlite em memória, vm sem navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import { escreverFinanceiro, lerFinanceiro, montar } from '../server/financeiro.js';

const HOJE = '2026-11-14';
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', dono: true } };
const beatriz = { tipo: 'sessao', pessoa: { id: 6, nome: 'Beatriz', admin: true, dono: false, coordenacao: true } };
const ana = { tipo: 'sessao', pessoa: { id: 7, nome: 'Ana Ficticia', dono: false } };

// Extrato inventado: Pix para a esposa de um sócio, Pix ao Vinícius (cartão ou pró-labore?), salário da Ana.
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function csv(linhas) {
  let saldo = 20000;
  const l = linhas.slice().sort((a, b) => a[0].localeCompare(b[0])).map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0000";CONTA;"00000"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)', ...l.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}
const LINHAS = [
  ['2026-08-05', 'Pix Enviado Ana Ficticia Souza', -3000], ['2026-09-05', 'Pix Enviado Ana Ficticia Souza', -3000], ['2026-09-20', 'Pix Enviado Ana Ficticia Souza', -1000],
  ['2026-10-05', 'Pix Enviado Ana Ficticia Souza', -2500], ['2026-11-05', 'Pix Enviado Ana Ficticia Souza', -1000],
  ['2026-10-10', 'Pix Enviado Esposa Ficticia Socio', -800], ['2026-10-12', 'Pix Enviado Vinicius Exemplo Damasceno', -1500],
  ['2026-10-20', 'Pagamento Conta Celular OPERADORA FICTICIA', -100], ['2026-10-02', 'Pix Recebido Cliente Ficticio', 9000],
];

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo Henrique'),(2,'Vinícius'),(6,'Beatriz'),(7,'Ana Ficticia');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  await escreverFinanceiro(sql, paulo, { acao: 'importar', csv: csv(LINHAS) });
  return { db, sql };
}
const ler = (sql, quem, q = {}) => lerFinanceiro(sql, quem, q, { hoje: HOJE });
const achar = async (sql, re) => (await ler(sql, paulo)).transacoes.filter((t) => re.test(t.banco.historico));

test('conta da pessoa: o que passa do combinado vira vale, o que falta abate o vale, sem vale fica a pagar; o mês atual só "falta"', () => {
  const t = (id, data, valor, real) => ({ id, banco: { data, historico: id, valor, saldo: null }, real: { categoria: 'salario', status: 'pago', competencia: data.slice(0, 7), partes: [], conferido: true, pessoa_id: '7', ...real } });
  const lista = [
    t('a', '2026-08-05', -3000), t('b', '2026-09-05', -3000), t('c', '2026-09-20', -1000, { categoria: 'adiantamento' }),
    t('d', '2026-10-05', -2500), t('e', '2026-11-05', -1000),
    // Um Pix dividido: 300 para a Ana (adiantamento) e 200 de combustível para ninguém.
    t('f', '2026-11-08', -500, { categoria: 'outra_saida', pessoa_id: '', partes: [{ valor: 300, categoria: 'adiantamento', pessoa_id: '7' }, { valor: 200, categoria: 'combustivel' }] }),
    t('g', '2026-11-09', 150, { categoria: 'devolucao_vale' }),
    t('h', '2026-10-06', -999, { pessoa_id: '2' }), // de outra pessoa: não entra
  ];
  const c = X.contaPessoa(lista, '7', { salario: { valor: 3000, desde: '2026-08' }, ate: '2026-11' });
  const m = Object.fromEntries(c.meses.map((x) => [x.mes, x]));
  assert.deepEqual([m['2026-08'].pago, m['2026-08'].vale_do_mes, m['2026-08'].vale_acumulado], [3000, 0, 0]);
  assert.deepEqual([m['2026-09'].pago, m['2026-09'].vale_do_mes, m['2026-09'].vale_acumulado], [4000, 1000, 1000], 'setembro passou 1.000: vale');
  assert.deepEqual([m['2026-10'].pago, m['2026-10'].abatido, m['2026-10'].a_pagar, m['2026-10'].vale_acumulado], [2500, 500, 0, 500], 'outubro recebeu 500 a menos: abate o vale');
  assert.equal(m['2026-11'].aberto, true);
  assert.deepEqual([m['2026-11'].pago, m['2026-11'].falta_pagar, m['2026-11'].devolvido, m['2026-11'].vale_acumulado], [1300, 1700, 150, 350], 'mês aberto: falta pagar; a devolução tira do vale');
  assert.equal(c.vale, 350);
  assert.ok(c.itens.some((i) => i.id === 'f' && i.valor === -300), 'a parte do Pix dividido aparece na lista da pessoa');
  // Sem vale e recebendo menos: fica a pagar à pessoa.
  const s = X.contaPessoa([t('x', '2026-09-05', -2000)], '7', { salario: { valor: 3000 }, ate: '2026-10' });
  assert.equal(s.meses[0].a_pagar, 1000); assert.equal(s.vale, 0); assert.equal(s.a_pagar, 1000);
  // Ajuste à mão "devolveu" também tira do vale.
  const j = X.contaPessoa(lista, '7', { salario: { valor: 3000, desde: '2026-08' }, ate: '2026-11', ajustes: [{ pessoa_id: '7', mes: '2026-11', tipo: 'devolveu', valor: 350 }] });
  assert.equal(j.vale, 0);
});

test('Extrato: "Para quem", gasto fixo e "Sempre assim" com a pessoa; tudo desfazível', async (t) => {
  const { sql } = await banco(t);
  const d0 = await ler(sql, paulo);
  assert.deepEqual(d0.pessoas.map((p) => p.nome), ['Ana Ficticia', 'Beatriz', 'Paulo Henrique', 'Vinícius']);
  // Pix ao Vinícius: a regra pronta pergunta (cartão ou pró-labore) e não vem conferido.
  const [vin] = await achar(sql, /Vinicius/);
  assert.deepEqual(vin.sugestao.opcoes, ['cartao_agencia', 'pro_labore']); assert.equal(vin.real.conferido, false);
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: vin.id, mudanca: { categoria: 'pro_labore', pessoa_id: '2', pessoa_nome: 'Vinícius', conferido: true } });
  // Pix para a esposa de um sócio → Paulo; "Sempre assim" vira regra com a pessoa.
  const [esp] = await achar(sql, /Esposa/);
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: esp.id, mudanca: { categoria: 'retirada_socio', pessoa_id: '1', pessoa_nome: 'Paulo Henrique', conferido: true } });
  const r = await escreverFinanceiro(sql, paulo, { acao: 'regra_salvar', regra: { contem: 'esposa ficticia', sinal: 'saida', categoria: 'retirada_socio', pessoa_id: '1', pessoa_nome: 'Paulo Henrique' } });
  assert.equal(r.regra.pessoa_id, '1');
  // O próximo extrato já chega com a pessoa.
  await escreverFinanceiro(sql, paulo, { acao: 'importar', csv: csv([...LINHAS, ['2026-11-10', 'Pix Enviado Esposa Ficticia Socio', -700]]) });
  const nov = (await achar(sql, /Esposa/)).find((x) => x.banco.data === '2026-11-10');
  assert.deepEqual([nov.real.pessoa_id, nov.real.pessoa_nome, nov.real.categoria], ['1', 'Paulo Henrique', 'retirada_socio']);
  // Ligar a um gasto fixo: conta como o pagamento dele no mês.
  const fx = await escreverFinanceiro(sql, paulo, { acao: 'fixo_salvar', fixo: { nome: 'Internet ficticia', valor: 100, dia: 20, categoria: 'estrutura', forma: 'debito' } });
  const [cel] = await achar(sql, /Celular/);
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: cel.id, mudanca: { fixo_id: fx.fixo.id } });
  const out = await ler(sql, paulo, { mes: '2026-10' });
  const f = out.fixos_analise.fixos.find((x) => x.id === fx.fixo.id);
  assert.equal(f.achado.ligado, true); assert.equal(f.achado.id, cel.id);
  // Desfazer: tirar a pessoa e o fixo.
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: esp.id, mudanca: { pessoa_id: '', pessoa_nome: '' } });
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: cel.id, mudanca: { fixo_id: '' } });
  const depois = await ler(sql, paulo, { mes: '2026-10' });
  assert.equal(depois.transacoes.find((x) => x.id === esp.id).real.pessoa_id, '');
  assert.notEqual(depois.fixos_analise.fixos.find((x) => x.id === fx.fixo.id).achado?.ligado, true);
});

test('salário combinado, conta da pessoa e ajustes do vale pelo servidor; dividir um Pix entre duas pessoas', async (t) => {
  const { sql } = await banco(t);
  for (const x of await achar(sql, /Ana Ficticia/)) {
    const cat = x.banco.data === '2026-09-20' ? 'adiantamento' : 'salario';
    await escreverFinanceiro(sql, paulo, { acao: 'editar', id: x.id, mudanca: { categoria: cat, pessoa_id: '7', pessoa_nome: 'Ana Ficticia', conferido: true } });
  }
  await escreverFinanceiro(sql, paulo, { acao: 'salario_salvar', pessoa_id: '7', valor: 3000, desde: '2026-08' });
  let c = (await ler(sql, paulo, { pessoa: '7' })).conta;
  assert.equal(c.nome, 'Ana Ficticia'); assert.equal(c.salario.valor, 3000);
  assert.equal(c.meses.find((m) => m.mes === '2026-09').vale_do_mes, 1000);
  assert.equal(c.vale, 500, 'setembro +1.000, outubro −500, novembro ainda aberto');
  assert.equal(c.itens.length, 5);
  // Lista de todos (tela Pessoas e vales) e a Folha do RH com o vale.
  const todos = await ler(sql, paulo);
  assert.equal(todos.contas_pessoas.find((x) => x.pessoa_id === '7').vale, 500);
  const rh = await ler(sql, paulo, { parte: 'rh', mes: '2026-10' });
  const linhaAna = rh.folha.funcionarios.find((f) => f.pessoa_id === '7');
  assert.deepEqual([linhaAna.nome, linhaAna.total, linhaAna.vale, linhaAna.combinado], ['Ana Ficticia', 2500, 500, 3000]);
  // Devolveu à mão: tira do vale; desfazer volta.
  const aj = await escreverFinanceiro(sql, paulo, { acao: 'vale_ajuste_salvar', ajuste: { pessoa_id: '7', mes: '2026-11', tipo: 'devolveu', valor: 200, nota: 'em dinheiro' } });
  assert.equal((await ler(sql, paulo, { pessoa: '7' })).conta.vale, 300);
  await escreverFinanceiro(sql, paulo, { acao: 'vale_ajuste_remover', id: aj.ajuste.id });
  assert.equal((await ler(sql, paulo, { pessoa: '7' })).conta.vale, 500);
  // Um Pix dividido entre duas pessoas: cada parte vai para a conta de cada uma.
  const [cel] = await achar(sql, /Celular/);
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: cel.id, mudanca: { categoria: 'adiantamento', partes: [{ valor: 60, categoria: 'adiantamento', pessoa_id: '7', pessoa_nome: 'Ana Ficticia' }, { valor: 40, categoria: 'adiantamento', pessoa_id: '2', pessoa_nome: 'Vinícius' }] } });
  c = (await ler(sql, paulo, { pessoa: '7' })).conta;
  assert.equal(c.meses.find((m) => m.mes === '2026-10').pago, 2560);
  assert.equal((await ler(sql, paulo, { pessoa: '2' })).conta.meses.find((m) => m.mes === '2026-10').pago, 40);
  // Tirar o combinado (valor vazio) também desfaz.
  await escreverFinanceiro(sql, paulo, { acao: 'salario_salvar', pessoa_id: '7', valor: '' });
  assert.equal((await ler(sql, paulo, { pessoa: '7' })).conta.salario, null);
});

test('só os quatro donos: coordenação e a própria pessoa não leem nem gravam salário, vale ou "Para quem"', async (t) => {
  const { sql } = await banco(t);
  for (const quem of [beatriz, ana]) {
    for (const q of [{}, { pessoa: '7' }, { parte: 'rh' }]) await assert.rejects(ler(sql, quem, q), (e) => e.status === 403);
    for (const b of [{ acao: 'salario_salvar', pessoa_id: '7', valor: 9999 }, { acao: 'vale_ajuste_salvar', ajuste: { pessoa_id: '7', mes: '2026-11', valor: 1 } }, { acao: 'editar', id: 'x', mudanca: { pessoa_id: '7' } }])
      await assert.rejects(escreverFinanceiro(sql, quem, b), (e) => e.status === 403);
  }
  assert.deepEqual((await ler(sql, paulo)).salarios, {}, 'nada foi gravado');
});

test('telas: Extrato com "Para quem" e "Gasto fixo", a pergunta do Pix ao Vinícius e a tela Pessoas e vales', () => {
  const CORE = readFileSync('vybe-core.js', 'utf8');
  const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
  const ctx = vm.createContext({ console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout, CSS: { escape: (s) => s } }); ctx.window = ctx;
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  vm.runInContext(readFileSync('shared/financeiro-extrato.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-financeiro.js', 'utf8'), ctx);
  const V = ctx.VybeFinanceiro;
  const transacoes = X.transacoesDoCsv(X.lerCsvBB(csv(LINHAS)), []);
  for (const x of transacoes) if (/Ana Ficticia/.test(x.banco.historico)) x.real = X.aplicarEdicao(x, { categoria: 'salario', pessoa_id: '7', pessoa_nome: 'Ana Ficticia', conferido: true }, 'Paulo').real;
  const fixo = X.normalizarFixo({ id: 'fx-net', nome: 'Internet ficticia', valor: 100, dia: 20, categoria: 'estrutura', forma: 'debito' }).fixo;
  const base = { extrato: { transacoes, importacoes: [] }, regras: [], fixos: [fixo], cartao: [], cenarios: [], salarios: { 7: { valor: 3000, desde: '2026-08' } }, vales: [] };
  const d = montar(base, [], { mes: '2026-10', hoje: HOJE, pessoas: [{ id: '7', nome: 'Ana Ficticia' }, { id: '2', nome: 'Vinícius' }] });
  const vin = transacoes.find((x) => /Vinicius/.test(x.banco.historico));
  V._teste.ui.extrato.aberta = vin.id; V._teste.ui.extrato.mes = '2026-10'; V._teste.ui.extrato.chip = 'todos';
  const ext = V.telas.extrato({ d, filtro: {} });
  assert.match(ext, /<span>Pessoa do time<\/span><select name="pessoa_id"[\s\S]*Ana Ficticia[\s\S]*Vinícius/);
  assert.match(ext, /<span>Gasto fixo<\/span><select name="fixo_id"[\s\S]*Internet ficticia/);
  assert.match(ext, /data-fx="escolher-cat"[^>]*data-valor="cartao_agencia"[\s\S]*data-fx="escolher-cat"[^>]*data-valor="pro_labore"/);
  V._teste.ui.vales.aberta = '7';
  const html = V.telas.vales({ d, filtro: {} });
  assert.match(html, /data-tela="fx-vales"/); assert.match(html, /<h1>Pessoas e vales<\/h1>/); assert.match(html, /só donos/);
  // Padrão V2 (prancha V2-M-Financas-Vales): o vale na coluna Vale, em vermelho; o combinado de quem não tem conta abre pelo botão.
  assert.match(html, /Ana Ficticia[\s\S]*<b class="r">R\$ 500,00<\/b>/);
  assert.match(html, /Salário \/ pró-labore combinado[\s\S]*value="3000"/);
  assert.match(html, /Pix que compõem[\s\S]*data-fx="ir-lanc"/);
  assert.match(html, /data-fx="vales-combinado"/);
  V._teste.ui.vales.combinado = true;
  const comb = V.telas.vales({ d, filtro: {} });
  assert.match(comb, /<h3>Informar o combinado <small>· 1 pessoa sem conta<\/small><\/h3>[\s\S]*Combinado de Vinícius[\s\S]*data-fx="pessoa-salario" data-valor="2"/, 'o Vinícius ainda sem combinado');
  V._teste.ui.vales.combinado = false;
  assert.doesNotMatch(html, /—/);
});

// Finanças em 5 telas (Paulo, 23/11/2026): "jogar o que passou do salário da pessoa pro mês seguinte pra já abater e
// mostrar descontado quanto ela vai receber". O desconto é um plano: não mexe no vale até o mês fechar.
test('descontar no salário: o vale sai do combinado do mês escolhido e a conta mostra quanto a pessoa vai receber', () => {
  const t = (id, data, valor) => ({ id, banco: { data, historico: id, valor, saldo: null }, real: { categoria: 'salario', status: 'pago', competencia: data.slice(0, 7), partes: [], conferido: true, pessoa_id: '7' } });
  const lista = [t('a', '2026-10-05', -2400), t('b', '2026-11-05', -500)];
  const sal = { valor: 2000, desde: '2026-10' };
  const sem = X.contaPessoa(lista, '7', { salario: sal, ate: '2026-11' });
  assert.equal(sem.vale, 400, 'outubro passou 400');
  assert.deepEqual({ ...sem.proximo }, { mes: '2026-12', combinado: 2000, desconto: 0, a_receber: 2000, vale_depois: 400 });
  // No mês aberto: o desconto sai do que falta pagar.
  const nov = X.contaPessoa(lista, '7', { salario: sal, ate: '2026-11', ajustes: [{ pessoa_id: '7', mes: '2026-11', tipo: 'descontar', valor: 300 }] });
  const m = nov.meses.find((x) => x.mes === '2026-11');
  assert.deepEqual([m.desconto, m.a_receber, m.falta_pagar], [300, 1700, 1200]);
  assert.equal(nov.vale, 400, 'plano não é dinheiro: o vale só cai quando o mês fecha');
  // No mês seguinte: a conta do próximo salário, nunca mais que o vale.
  const dez = X.contaPessoa(lista, '7', { salario: sal, ate: '2026-11', ajustes: [{ pessoa_id: '7', mes: '2026-12', tipo: 'descontar', valor: 900 }] });
  assert.deepEqual({ ...dez.proximo }, { mes: '2026-12', combinado: 2000, desconto: 400, a_receber: 1600, vale_depois: 0 });
  // Fechado o mês, a regra de sempre: recebeu menos que o combinado, abate o vale.
  const fechado = X.contaPessoa([t('a', '2026-10-05', -2400), t('b', '2026-11-05', -2000), t('c', '2026-12-05', -1600)], '7', { salario: sal, ate: '2027-01', ajustes: [{ pessoa_id: '7', mes: '2026-12', tipo: 'descontar', valor: 400 }] });
  assert.equal(fechado.meses.find((x) => x.mes === '2026-12').abatido, 400);
  assert.equal(X.normalizarAjusteVale({ pessoa_id: '7', mes: '2026-12', tipo: 'descontar', valor: 400 }).ajuste.tipo, 'descontar');
});

test('Finanças em 5 telas: Hoje, Movimento, Clientes, Pessoas e Análise pintam; as telas de antes abrem nelas', () => {
  const CORE = readFileSync('vybe-core.js', 'utf8');
  const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
  const ctx = vm.createContext({ console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout, CSS: { escape: (s) => s } }); ctx.window = ctx;
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  vm.runInContext(readFileSync('shared/financeiro-extrato.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-financeiro.js', 'utf8'), ctx);
  const V = ctx.VybeFinanceiro;
  const transacoes = X.transacoesDoCsv(X.lerCsvBB(csv(LINHAS)), []);
  for (const x of transacoes) if (/Ana Ficticia/.test(x.banco.historico)) x.real = X.aplicarEdicao(x, { categoria: 'salario', pessoa_id: '7', pessoa_nome: 'Ana Ficticia', conferido: true }, 'Paulo').real;
  const base = { extrato: { transacoes, importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [], salarios: { 7: { valor: 3000, desde: '2026-08' } },
    vales: [{ id: 'vl-1', pessoa_id: '7', mes: '2026-12', tipo: 'descontar', valor: 300, nota: 'desconto do vale no salário' }] };
  const d = montar(base, [], { hoje: HOJE, pessoas: [{ id: '7', nome: 'Ana Ficticia' }] });
  const ctxTela = { d, filtro: {} };
  const abas = ['fin_hoje', 'fin_movimento', 'fin_clientes', 'fin_pessoas', 'fin_analise'];
  for (const aba of abas) {
    const html = V.telas[aba](ctxTela);
    assert.match(html, new RegExp(`class="fx fv2 d3f fe d3-tema" data-tela="fe-${aba}"`), aba);
    assert.match(html, new RegExp(`data-valor="${aba}" aria-current="page"`), `${aba}: a aba de agora marcada`);
    for (const a of abas) assert.ok(html.includes(`data-fx="ir-aba" data-valor="${a}"`), `${aba} leva a ${a}`);
    assert.match(html, /data-fx="fe-mes"/, `${aba}: o mês do topo`);
    assert.doesNotMatch(html, /undefined|NaN/, aba);
  }
  // Um laranja só por tela, e é o do Vorcaro no Hoje.
  assert.equal((V.telas.fin_hoje(ctxTela).match(/class="fe-lar"/g) || []).length, 1);
  for (const aba of abas.slice(1)) assert.doesNotMatch(V.telas[aba](ctxTela), /class="fe-lar"/, aba);
  // Pessoas: a ficha mostra o salário seguinte já descontado.
  V._teste.ui.fe.pes.sel = '7';
  const pes = V.telas.fin_pessoas(ctxTela);
  assert.match(pes, /Salário de dezembro[\s\S]*Desconto do vale<\/span><b class="v">−R\$ 300,00[\s\S]*Vai receber<\/span><b>R\$ 2\.700,00/);
  assert.match(pes, /Desconto em dezembro<\/span><b>−R\$ 300,00/);
  V._teste.ui.fe.pes.desconto = '7';
  assert.match(V.telas.fin_pessoas(ctxTela), /data-fx-form="ajuste"><input type="hidden" name="tipo" value="descontar">[\s\S]*data-fx="pessoa-ajuste" data-valor="7"/);
  // As telas de antes viram um lugar das cinco, com o filtro.
  const { FE_DE, feDe } = V._teste;
  for (const [antes, nova] of Object.entries({ vorcaro: 'fin_hoje', extrato: 'fin_movimento', cartao: 'fin_movimento', fixos: 'fin_movimento', clientes_mes: 'fin_clientes', vales: 'fin_pessoas', projecao: 'fin_analise', financas: 'fin_clientes', recebimentos: 'fin_movimento', contas: 'fin_movimento', inadimplencia: 'fin_clientes' })) assert.equal(FE_DE[antes], nova, antes);
  assert.equal(feDe('cartao'), 'fin_movimento'); assert.equal(V._teste.ui.fe.chip, 'cartao');
  assert.equal(feDe('extrato', { chip: 'conferir' }), 'fin_movimento'); assert.equal(V._teste.ui.fe.chip, 'conferir');
  assert.equal(feDe('funil'), '', 'o que não é de Finanças segue o caminho de sempre');
});
