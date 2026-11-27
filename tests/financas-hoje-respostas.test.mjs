// O Hoje do Finanças responde as perguntas do dono (Paulo, 27/11/2026): "quanto já entrou? previsão de quanto vai
// entrar? quanto vai pagar? quanto já pagou? de quê? para quando?". Entradas e Saídas lado a lado, a conta que fecha o mês,
// os próximos dias, o aviso de previsão incompleta e a pergunta por texto com os mesmos números (hojeDoMes).
// SAFE: extrato INVENTADO (nenhum dado real), PGlite em memória, vm sem navegador; nada é enviado nem gravado fora do teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import A from '../shared/financeiro-analises.js';
import { escreverFinanceiro, lerFinanceiro, montar } from '../server/financeiro.js';

const HOJE = '2026-11-20';
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function csv(linhas, saldo0 = 20000) {
  let saldo = saldo0;
  const l = linhas.slice().sort((a, b) => a[0].localeCompare(b[0])).map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0000";CONTA;"00000"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)', ...l.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}
const LINHAS = [
  ['2026-10-03', 'Pix Recebido Cliente Alfa Ficticio', 3000], ['2026-10-05', 'Pix Enviado Ana Ficticia Souza', -3000],
  ['2026-11-02', 'Rendimento Liquido De Contamax', 5.5], ['2026-11-03', 'Pix Recebido Cliente Alfa Ficticio', 3000], ['2026-11-06', 'Pix Recebido Fulano Pagador Ficticio', 1200],
  ['2026-11-05', 'Pix Enviado Ana Ficticia Souza', -2000], ['2026-11-10', 'Pagamento Fat.cartao Santander', -800], ['2026-11-12', 'Tarifa Avulsa Envio Pix', -10],
];
const CLIENTES = [
  { cliente_id: '40', cliente_nome: 'Cliente Alfa Ficticio', valor_mensal: 3000, dia_vencimento: 3, ativo: true },
  { cliente_id: '41', cliente_nome: 'Cliente Beta Ficticio', valor_mensal: 2500, dia_vencimento: 25, ativo: true },
  { cliente_id: '43', cliente_nome: 'Cliente Delta Ficticio', valor_mensal: 1000, dia_vencimento: 10, ativo: true },
  { cliente_id: '42', cliente_nome: 'Cliente Gama Sem Contrato', valor_mensal: 0, ativo: true },
];
function dados({ saldo0 = 20000, clientes = CLIENTES, fixosExtra = [] } = {}) {
  const transacoes = X.transacoesDoCsv(X.lerCsvBB(csv(LINHAS, saldo0)), []);
  for (const t of transacoes) {
    if (/Alfa/.test(t.banco.historico)) t.real = X.aplicarEdicao(t, { categoria: 'receita_cliente', cliente_id: '40', cliente_nome: 'Cliente Alfa Ficticio', conferido: true }, 'Teste').real;
    if (/Ana Ficticia/.test(t.banco.historico)) t.real = X.aplicarEdicao(t, { categoria: 'salario', pessoa_id: '7', pessoa_nome: 'Ana Ficticia', conferido: true }, 'Teste').real;
    if (/Fat\.cartao/.test(t.banco.historico)) t.real = X.aplicarEdicao(t, { categoria: 'cartao_agencia', conferido: true }, 'Teste').real;
  }
  const fixos = [X.normalizarFixo({ id: 'fx-aluguel', nome: 'Aluguel Ficticio', valor: 1800, dia: 25, categoria: 'estrutura', forma: 'boleto', contem: 'aluguel ficticio' }).fixo,
    X.normalizarFixo({ id: 'fx-programa', nome: 'Programa Ficticio', valor: 290, dia: 30, categoria: 'ferramentas', forma: 'cartao', contem: 'programa ficticio' }).fixo, ...fixosExtra];
  const base = { extrato: { transacoes, importacoes: [] }, regras: [], fixos, cartao: [], cenarios: [], salarios: { 7: { valor: 3000, desde: '2026-08' } }, vales: [] };
  return montar(base, clientes, { hoje: HOJE, pessoas: [{ id: '7', nome: 'Ana Ficticia' }] });
}
function telas() {
  const CORE = readFileSync('vybe-core.js', 'utf8');
  const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
  const ctx = vm.createContext({ console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout, CSS: { escape: (s) => s } }); ctx.window = ctx;
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  for (const f of ['shared/financeiro-extrato.js', 'shared/financeiro-analises.js', 'vybe-graficos.js', 'vybe-mundo-financeiro.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
  return ctx.VybeFinanceiro;
}
const c = (v) => Math.round(v * 100);
const rsTela = (v) => `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test('as somas: já entrou/já pagou batem com o resumo, os grupos somam o "já", o previsto soma os itens e a conta fecha', () => {
  const d = dados(), h = A.hojeDoMes(d, { mes: '2026-11' }), r = X.resumo(d.transacoes, { mes: '2026-11' });
  assert.equal(h.entradas.ja, r.entradas);
  assert.equal(h.saidas.ja, Math.round((r.saidas + r.cartao_e_transferencias) * 100) / 100);
  assert.equal(c(h.entradas.grupos.reduce((s, g) => s + g.valor, 0)), c(h.entradas.ja), 'de quê (entradas) soma o que entrou');
  assert.equal(c(h.saidas.grupos.reduce((s, g) => s + g.valor, 0)), c(h.saidas.ja), 'de quê (saídas) soma o que saiu');
  assert.equal(h.entradas.n, 3); assert.equal(h.saidas.n, 3);
  // De quê: por cliente nas entradas (o Pix sem cliente fica à parte) e pelo grupo da categoria nas saídas.
  assert.deepEqual(h.entradas.grupos.map((g) => g.nome), ['Cliente Alfa Ficticio', 'Cliente sem identificar', 'Rendimento da conta']);
  assert.deepEqual(h.saidas.grupos.map((g) => [g.nome, g.valor]), [['Pessoas', 2000], ['Cartão', 800], ['Banco', 10]]);
  // Vai entrar: Beta (25/11) e Delta (10/11, atrasado), pelo contrato; o Alfa já pagou. Vai pagar: o resto do salário,
  // o aluguel e o programa.
  assert.deepEqual(h.entradas.itens.map((i) => [i.nome, i.valor, i.data]), [['Cliente Delta Ficticio', 1000, '2026-11-10'], ['Cliente Beta Ficticio', 2500, '2026-11-25']]);
  assert.deepEqual(h.saidas.itens.map((i) => [i.nome, i.valor, i.data]), [['Ana Ficticia', 1000, '2026-11-05'], ['Aluguel Ficticio', 1800, '2026-11-25'], ['Programa Ficticio', 290, '2026-11-30']]);
  assert.equal(h.entradas.vai, 3500); assert.equal(h.saidas.vai, 3090);
  assert.equal(c(h.entradas.total), c(h.entradas.ja) + c(h.entradas.vai), 'já entrou + vai entrar = total previsto');
  assert.equal(c(h.saidas.total), c(h.saidas.ja) + c(h.saidas.vai), 'já pagou + vai pagar = total previsto');
  // A conta: saldo do último dia do banco + vai entrar − vai pagar.
  const saldo = d.transacoes.filter((t) => t.banco.saldo != null).sort((a, b) => a.banco.data.localeCompare(b.banco.data)).pop().banco.saldo;
  assert.equal(h.conta.saldo, saldo); assert.equal(h.conta.saldo_data, '2026-11-12');
  assert.equal(c(h.conta.fecha), c(saldo) + c(3500) - c(3090));
  assert.equal(h.conta.vira_negativo, null);
  // A tela mostra os mesmos números.
  const V = telas(), html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /Entradas[\s\S]*Já entrou<\/span><b class="fe-v">R\$ 4,2 mil<\/b><small>3 lançamentos[\s\S]*Vai entrar<\/span><b class="fe-v">R\$ 3,5 mil/);
  assert.match(html, /Saídas[\s\S]*Já pagou<\/span><b class="fe-v">R\$ 2,8 mil<\/b><small>3 lançamentos[\s\S]*Vai pagar<\/span><b class="fe-v">R\$ 3,1 mil/);
  assert.match(html, new RegExp(`Saldo hoje</small><b>${rsTela(saldo).replace(/[$.]/g, '\\$&')}</b><span>extrato até 12/11[\\s\\S]*Vai entrar</small><b>R\\$ 3\\.500,00[\\s\\S]*Vai pagar</small><b>R\\$ 3\\.090,00[\\s\\S]*Fecha o mês com</small><b>${rsTela(h.conta.fecha).replace(/[$.]/g, '\\$&')}</b><span>não fica negativo no mês`));
  assert.doesNotMatch(html, /undefined|NaN/);
});

test('o atrasado: passou da data e não entrou/não foi pago, em destaque; o dia em que o saldo vira negativo', () => {
  const V = telas();
  let d = dados(), h = A.hojeDoMes(d, { mes: '2026-11' });
  assert.deepEqual(h.entradas.itens.filter((i) => i.atrasado).map((i) => i.nome), ['Cliente Delta Ficticio']);
  assert.deepEqual(h.saidas.itens.filter((i) => i.atrasado).map((i) => i.nome), ['Ana Ficticia']);
  assert.equal(h.atrasados.n, 2);
  const html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /class="fe-hj-it atr" data-fx="fe-cli" data-valor="43"[^>]*><span class="fe-hj-quem"><b>Cliente Delta Ficticio<\/b><small><span class="fe-hj-d">10\/11<\/span> · <em>atrasado<\/em>/);
  assert.match(html, /class="fe-hj-it atr" data-fx="ir-aba" data-valor="fin_pessoas" data-pes="7"/, 'o salário atrasado abre a ficha da pessoa');
  assert.match(html, /class="fe-hj-it" data-fx="fe-cli" data-valor="41"/, 'o que ainda não venceu não é atrasado');
  assert.match(html, /<span class="fe-hj-atr">2 atrasados<\/span>/);
  // Saldo baixo: a parcela e o aluguel do dia 25 derrubam o caixa (o atrasado conta como hoje).
  const parcela = X.normalizarFixo({ id: 'fx-parcela', nome: 'Parcela Ficticia', valor: 6000, dia: 25, categoria: 'estrutura', forma: 'boleto', contem: 'parcela ficticia' }).fixo;
  d = dados({ saldo0: 0, fixosExtra: [parcela] }); h = A.hojeDoMes(d, { mes: '2026-11' });
  assert.ok(h.conta.saldo > 0 && h.conta.fecha < 0, `${h.conta.saldo} → ${h.conta.fecha}`);
  assert.deepEqual(h.conta.vira_negativo, { data: '2026-11-25', ja: false });
  assert.match(V.telas.fin_hoje({ d, filtro: {} }), /class="fe-hj-t fim r"><small>Fecha o mês com<\/small><b>-R\$ [\d.,]+<\/b><span>fica negativo em 25\/11<\/span>/);
  // Já negativo hoje.
  h = A.hojeDoMes(dados({ saldo0: -30000 }), { mes: '2026-11' });
  assert.deepEqual(h.conta.vira_negativo, { data: HOJE, ja: true });
});

test('o aviso de previsão incompleta: cliente ativo sem contrato, com o atalho para cadastrar; some quando todos têm', () => {
  const V = telas();
  let d = dados(), h = A.hojeDoMes(d, { mes: '2026-11' });
  assert.equal(h.previsao.ativos, 4); assert.equal(h.previsao.com_contrato, 3); assert.equal(h.previsao.incompleta, true);
  let html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /class="fe-hj-aviso"><span>Só 3 de 4 clientes ativos têm contrato ou valor cadastrado: o "vai entrar" está subestimado[^<]*<\/span><button type="button" class="fe-elo" data-fx="ir-aba" data-valor="fin_clientes" data-cli-chip="sem">Cadastrar<\/button>/);
  // O atalho abre Clientes já no filtro "Sem mensalidade".
  assert.equal(V._teste.feDe('fin_clientes', { cliChip: 'sem' }), 'fin_clientes');
  assert.equal(V._teste.ui.fe.cli.chip, 'sem');
  V._teste.ui.fe.cli.chip = 'todos';
  d = dados({ clientes: CLIENTES.filter((x) => x.valor_mensal > 0) }); h = A.hojeDoMes(d, { mes: '2026-11' });
  assert.equal(h.previsao.incompleta, false);
  html = V.telas.fin_hoje({ d, filtro: {} });
  assert.doesNotMatch(html, /class="fe-hj-aviso"/);
  // Previsto por contrato × pela média dos meses: aparece quando a projeção dá bem diferente do que o contrato diz.
  const dm = { ...d, analise: { ...d.analise, projecao: { ...d.analise.projecao, base: { ...d.analise.projecao.base, meses: [{ ...d.analise.projecao.base.meses[0], mes: '2026-11', entradas: 9000 }, ...d.analise.projecao.base.meses.slice(1)] } } } };
  assert.equal(A.hojeDoMes(dm, { mes: '2026-11' }).previsao.entra_difere, true);
  assert.match(V.telas.fin_hoje({ d: dm, filtro: {} }), /class="fe-hj-media">Por contrato: <b>R\$ 3,5 mil<\/b> · pela média dos meses: <b>R\$ 9 mil<\/b>/);
});

test('"ver tudo" e cada número levam à aba certa já filtrada', () => {
  const V = telas(), d = dados(), html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /aria-label="Entradas de novembro">[\s\S]*?<button type="button" class="fe-elo" data-fx="ir-aba" data-valor="fin_movimento" data-chip="entradas">Ver tudo/);
  assert.match(html, /aria-label="Saídas de novembro">[\s\S]*?<button type="button" class="fe-elo" data-fx="ir-aba" data-valor="fin_movimento" data-chip="saidas">Ver tudo/);
  assert.match(html, /class="fe-hj-g" data-fx="fe-cli" data-valor="40"[^>]*><span>Cliente Alfa Ficticio/, 'o cliente abre a ficha dele em Clientes');
  assert.match(html, /class="fe-hj-g" data-fx="ir-aba" data-valor="fin_movimento" data-chip="conferir"[^>]*><span>Cliente sem identificar/, 'o Pix sem cliente leva ao que falta conferir');
  assert.match(html, /class="fe-hj-g" data-fx="fe-grupo" data-valor="Pessoas"[^>]*><span>Pessoas/, 'o grupo da saída filtra o Movimento');
  assert.match(html, /data-fx="fe-chip-fixo" data-valor="fx-aluguel"/, 'a conta fixa abre no Movimento');
  assert.match(html, /data-fx="ir-aba" data-valor="fin_assinaturas" data-fixo="fx-programa"/, 'o programa abre em Assinaturas');
  // O filtro chega à tela: o chip das entradas no Movimento.
  assert.equal(V._teste.feDe('fin_movimento', { chip: 'entradas' }), 'fin_movimento');
  assert.equal(V._teste.ui.fe.chip, 'entradas');
  V._teste.ui.fe.chip = 'conferir';
});

test('os próximos dias: 7 ou 15, o mês seguinte entra pelo previsto dele, e o dia escolhido mostra os itens', () => {
  const V = telas(), d = dados(), h = A.hojeDoMes(d, { mes: '2026-11', dias: 15 });
  assert.equal(h.dias.length, 15); assert.equal(h.dias[0].data, HOJE); assert.equal(h.dias[14].data, '2026-12-04');
  const dia = (iso) => h.dias.find((x) => x.data === iso);
  assert.deepEqual(dia('2026-11-25').itens.map((i) => i.nome), ['Cliente Beta Ficticio', 'Aluguel Ficticio']);
  assert.equal(dia('2026-11-25').entra, 2500); assert.equal(dia('2026-11-25').sai, 1800);
  assert.deepEqual(dia('2026-12-03').itens.map((i) => [i.nome, i.valor]), [['Cliente Alfa Ficticio', 3000]], 'dezembro: o contrato no dia do vencimento');
  assert.ok(h.dias.every((x) => x.itens.every((i) => !i.atrasado)), 'o atrasado não vai para o calendário');
  const ui = V._teste.ui.fe;
  let html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /class="fe-card fe-hj-cal" aria-label="Próximos dias"><div class="fe-card-cab"><h2 class="fe-rot">Próximos 7 dias/);
  assert.equal((html.match(/class="fe-hj-dia[ "]/g) || []).length, 7);
  assert.match(html, /data-fx="fe-hj-dia" data-valor="2026-11-25" aria-pressed="true"/, 'sem escolha, abre o primeiro dia com algo');
  ui.hj.dias = 15; ui.hj.dia = '2026-11-30';
  html = V.telas.fin_hoje({ d, filtro: {} });
  assert.equal((html.match(/class="fe-hj-dia[ "]/g) || []).length, 15);
  assert.match(html, /class="fe-hj-sel"><span class="fe-rot">30 de novembro · segunda<\/span>[\s\S]*Programa Ficticio/);
  ui.hj.dias = 7; ui.hj.dia = '';
  // Num mês que já passou, a conta é o resultado e não há calendário.
  ui.mes = '2026-10';
  html = V.telas.fin_hoje({ d, filtro: {} });
  assert.match(html, /aria-label="Resultado de outubro"[\s\S]*Resultado do mês/);
  assert.doesNotMatch(html, /fe-hj-cal/);
  ui.mes = '';
});

test('a pergunta por texto responde com os números do Hoje', () => {
  const d = dados(), h = A.hojeDoMes(d, { mes: '2026-11' });
  const ja = A.respostaHoje(h, 'Quanto já entrou?');
  assert.equal(ja.tipo, 'ja_entrou'); assert.equal(ja.valor, h.entradas.ja); assert.match(ja.texto, /^Já entrou R\$ 4\.205,50 em novembro, em 3 lançamentos: Cliente Alfa Ficticio R\$ 3\.000,00/);
  const falta = A.respostaHoje(h, 'quanto falta pagar');
  assert.equal(falta.tipo, 'vai_pagar'); assert.equal(falta.valor, 3090); assert.match(falta.texto, /Ana Ficticia R\$ 1\.000,00 \(atrasado desde 05\/11\)/);
  const sem = A.respostaHoje(h, 'o que vence essa semana?');
  assert.equal(sem.tipo, 'semana'); assert.match(sem.texto, /Nos próximos 7 dias sai R\$ 1\.800,00 \(Aluguel Ficticio R\$ 1\.800,00 \(25\/11\)\) e entra R\$ 2\.500,00/);
  assert.match(sem.texto, /Atrasado: R\$ 1\.000,00 para pagar e R\$ 1\.000,00 para entrar/);
  assert.equal(A.respostaHoje(h, 'quanto falta entrar').valor, h.entradas.vai);
  assert.equal(A.respostaHoje(h, 'quanto já pagamos').valor, h.saidas.ja);
  assert.match(A.respostaHoje(h, 'com quanto fecha o mês').texto, /fecha novembro com R\$/);
  assert.equal(A.respostaHoje(h, 'qual a cor do céu'), null);
});

test('quem não é dono não vê: o servidor recusa e o dock esconde o Hoje do Finanças', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Dono Ficticio'),(6,'Coordenacao Ficticia'),(7,'Equipe Ficticia');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Dono Ficticio', dono: true } };
  await escreverFinanceiro(sql, dono, { acao: 'importar', csv: csv(LINHAS) });
  const ok = await lerFinanceiro(sql, dono, {}, { hoje: HOJE });
  assert.ok(A.hojeDoMes(ok, { mes: '2026-11' }).entradas.ja > 0);
  for (const pessoa of [{ id: 6, nome: 'Coordenacao Ficticia', admin: true, dono: false, coordenacao: true }, { id: 7, nome: 'Equipe Ficticia', dono: false }]) {
    await assert.rejects(lerFinanceiro(sql, { tipo: 'sessao', pessoa }, {}, { hoje: HOJE }), (e) => e.status === 403, pessoa.nome);
  }
  await assert.rejects(lerFinanceiro(sql, null, {}, { hoje: HOJE }), (e) => e.status === 401);
  const mundo = readFileSync('vybe-mundo.js', 'utf8');
  const so = /const SO_DINHEIRO = new Set\(\[([^\]]+)\]\)/.exec(mundo);
  assert.ok(so && so[1].includes("'fin_hoje'") && so[1].includes("'setor:financas'"), 'o Hoje do Finanças é só de quem é dono do dinheiro');
});
