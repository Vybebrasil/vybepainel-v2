// Financeiro sem o Vybe Finanças (Paulo, 13/11/2026): extrato do BB, lado real editável, divisão entre clientes,
// cartão, gastos fixos, mês a mês por cliente e projeção. SAFE: dados fictícios, funções puras e PGlite em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import { areaFinanceiro, montar } from '../server/financeiro.js';

// Um extrato fictício no formato do BB PJ (do mais novo para o mais antigo, como o banco exporta).
const CSV = [
  'AGENCIA;"0001";CONTA;"99999"',
  '',
  'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
  '"02/11/2026";"Pix Enviado Fulano Combustivel";"";"-100,00";"2.650,00"',
  '"01/11/2026";"Cr Cob Bloq Comp Conf Recebimento 0001/000123";"";"3.000,00";"2.750,00"',
  '"30/10/2026";"Tarifa Avulsa Envio Pix";"";"-1,50";"-250,00"',
  '"30/10/2026";"Pix Enviado Vinicius Exemplo";"";"-1.248,50";"-248,50"',
  '"15/10/2026";"Prest. De Emprest. Financiamento PARC 013/046 1";"";"-500,00";"1.000,00"',
  '"10/10/2026";"Pix Recebido Cliente Teste";"";"1.500,00";"1.500,00"',
  '"01/10/2026";"Saldo Anterior";"";"0,00";"0,00"',
].join('\r\n');

test('lê o CSV do BB: ordem do mais antigo, ordem do dia, saldo fecha e linha de saldo fica de fora', () => {
  const l = X.lerCsvBB(CSV);
  assert.equal(l.agencia, '0001'); assert.equal(l.conta, '99999');
  assert.equal(l.lancamentos.length, 6);
  assert.equal(l.ignorados.length, 1);
  assert.deepEqual(l.lancamentos.map((x) => x.data), ['2026-10-10', '2026-10-15', '2026-10-30', '2026-10-30', '2026-11-01', '2026-11-02']);
  assert.equal(l.lancamentos[2].historico, 'Pix Enviado Vinicius Exemplo'); // no mesmo dia, o primeiro do dia vem antes
  for (let i = 1; i < l.lancamentos.length; i++) assert.equal(Math.round((l.lancamentos[i - 1].saldo + l.lancamentos[i].valor) * 100), Math.round(l.lancamentos[i].saldo * 100));
  assert.equal(X.numeroBR('-1.248,50'), -1248.5);
  assert.match(X.lerCsvBB('a;b\n1;2').avisos[0], /cabeçalho/);
});

test('sugestões automáticas: empréstimo, tarifa, boleto a dividir, Pix para o Vinícius é o cartão a revisar', () => {
  const ts = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  const cat = Object.fromEntries(ts.map((t) => [t.banco.historico.slice(0, 18), t.real.categoria]));
  assert.equal(cat['Prest. De Emprest.'], 'emprestimo');
  assert.equal(cat['Tarifa Avulsa Envi'], 'tarifa_bancaria');
  assert.equal(cat['Cr Cob Bloq Comp C'], 'receita_boleto');
  assert.equal(cat['Pix Enviado Vinici'], 'cartao_agencia');
  const vin = ts.find((t) => t.banco.historico.includes('Vinicius'));
  assert.equal(vin.real.conferido, false); assert.equal(vin.sugestao.regra, 'pix-vinicius');
  assert.equal(ts.find((t) => t.banco.historico.startsWith('Prest')).real.conferido, true);
  // A regra do Paulo vem antes das padrão.
  const { regra } = X.normalizarRegra({ contem: 'fulano', categoria: 'combustivel', quem: 'Motorista', sinal: 'saida' });
  const comb = X.transacoesDoCsv(X.lerCsvBB(CSV), [regra]).find((t) => t.banco.historico.includes('Fulano'));
  assert.equal(comb.real.categoria, 'combustivel'); assert.equal(comb.real.quem, 'Motorista');
});

test('ids estáveis: reimportar o mesmo arquivo não duplica e o que foi editado fica', () => {
  const a = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  const b = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  assert.deepEqual(a.map((t) => t.id), b.map((t) => t.id));
  a[0].real.categoria = 'aporte_socio';
  const m = X.mesclar(a, b);
  assert.equal(m.novas, 0); assert.equal(m.repetidas, 6); assert.equal(m.lista[0].real.categoria, 'aporte_socio');
});

test('dividir o boleto entre clientes: as partes têm que somar o valor do banco', () => {
  const t = X.transacoesDoCsv(X.lerCsvBB(CSV), []).find((x) => x.banco.valor === 3000);
  assert.match(X.aplicarEdicao(t, { partes: [{ valor: 1000, cliente_id: '1' }, { valor: 1000, cliente_id: '2' }] }).erro, /somam/);
  const ok = X.aplicarEdicao(t, { categoria: 'receita_cliente', partes: [{ valor: 1000, cliente_id: '1', cliente_nome: 'A' }, { valor: 1200, cliente_id: '2', cliente_nome: 'B' },
    { valor: 800, cliente_id: '3', cliente_nome: 'C', competencia: '2026-10' }], conferido: true }, 'Paulo');
  assert.equal(ok.erro, undefined); assert.equal(ok.real.conferido_por, 'Paulo');
  const p = X.pedacos({ ...t, real: ok.real });
  assert.equal(p.length, 3); assert.equal(p[2].competencia, '2026-10'); assert.equal(p[0].competencia, '2026-11');
  assert.match(X.aplicarEdicao(t, { status: 'talvez' }).erro, /pago/);
});

test('por cliente mês a mês: pago, parcial e em aberto contra a mensalidade', () => {
  const ts = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  const bol = ts.find((x) => x.banco.valor === 3000);
  bol.real = X.aplicarEdicao(bol, { categoria: 'receita_cliente', partes: [{ valor: 2000, cliente_id: '1', cliente_nome: 'A' }, { valor: 1000, cliente_id: '2', cliente_nome: 'B' }] }).real;
  const lin = X.porCliente(ts, [{ cliente_id: '1', cliente_nome: 'A', valor_mensal: 2000 }, { cliente_id: '2', cliente_nome: 'B', valor_mensal: 1500 }, { cliente_id: '3', cliente_nome: 'C', valor_mensal: 900 }], ['2026-11']);
  const por = Object.fromEntries(lin.map((l) => [l.cliente_id, l.meses[0]]));
  assert.equal(por['1'].situacao, 'pago'); assert.equal(por['2'].situacao, 'parcial'); assert.equal(por['2'].em_aberto, 500);
  assert.equal(por['3'].situacao, 'aberto'); assert.equal(por['3'].em_aberto, 900);
});

test('mês a mês: antes do extrato não é atraso e o mês corrente é a receber; Pix pelo nome do cliente', () => {
  const lin = X.porCliente([], [{ cliente_id: '1', cliente_nome: 'A', valor_mensal: 1000 }], ['2026-08', '2026-09', '2026-10', '2026-11'], { desde: '2026-09', mesAtual: '2026-11' });
  assert.deepEqual(lin[0].meses.map((m) => m.situacao), ['fora', 'aberto', 'aberto', 'a_receber']);
  assert.equal(lin[0].total_aberto, 2000); assert.equal(lin[0].a_receber, 1000);
  const cli = [{ id: 7, nome: 'Serra Grande Bebidas Ltda' }, { id: 8, nome: 'Lab' }];
  assert.deepEqual(X.clienteDoHistorico('Pix Recebido SERRA GRANDE BEBIDAS', cli), { cliente_id: '7', cliente_nome: 'Serra Grande Bebidas Ltda' });
  assert.equal(X.clienteDoHistorico('Pix Recebido Laboratorio X', cli), null); // nome curto demais não liga
  const t = X.transacoesDoCsv(X.lerCsvBB(CSV), [], [{ id: 3, nome: 'Cliente Teste' }]).find((x) => x.banco.historico.includes('Cliente Teste'));
  assert.equal(t.real.cliente_id, '3'); assert.equal(t.real.conferido, false);
});

test('cartão: itens da fatura, pagamento ligado pelo extrato e o que falta', () => {
  const ts = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  const vin = ts.find((t) => t.banco.historico.includes('Vinicius'));
  vin.real = X.aplicarEdicao(vin, { fatura: 'Cartão da agência|2026-10' }).real;
  const itens = [X.normalizarItemCartao({ descricao: 'Programa de edição', valor: 300, fatura: '2026-10', categoria: 'ferramentas', status: 'pago' }).item,
    X.normalizarItemCartao({ descricao: 'Almoço com cliente', valor: 1000, fatura: '2026-10', categoria: 'alimentacao', parcela: '1/2' }).item];
  const [f] = X.cartao(itens, ts);
  assert.equal(f.total, 1300); assert.equal(f.pago_no_extrato, 1248.5); assert.equal(f.situacao, 'parcial'); assert.equal(f.falta, 51.5);
  assert.equal(f.por_categoria[0].categoria, 'alimentacao');
  assert.equal(X.pagamentosSemFatura(ts).length, 0);
  assert.match(X.normalizarItemCartao({ descricao: '', valor: 1, fatura: '2026-10' }).erro, /item/);
});

test('gastos fixos: cadastro validado e achado no extrato do mês', () => {
  assert.match(X.normalizarFixo({ nome: '', valor: 10 }).erro, /nome/);
  const emp = X.normalizarFixo({ nome: 'Empréstimo', valor: 500, dia: 15, categoria: 'emprestimo', contem: 'PARC' }).fixo;
  const prog = X.normalizarFixo({ nome: 'Programa', valor: 300, dia: 5, forma: 'cartao', categoria: 'ferramentas', contem: 'programa' }).fixo;
  const antigo = X.normalizarFixo({ nome: 'Antigo', valor: 50, fim: '2026-09' }).fixo;
  const ts = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  const itens = [X.normalizarItemCartao({ descricao: 'Programa de edição', valor: 300, fatura: '2026-10' }).item];
  const a = X.analisarFixos([emp, prog, antigo], ts, '2026-10', itens);
  assert.equal(a.quantidade, 2); assert.equal(a.inativos, 1); assert.equal(a.total, 800); assert.equal(a.anual, 9600); assert.equal(a.achados, 2);
  assert.equal(a.fixos.find((f) => f.nome === 'Empréstimo').achado.onde, 'extrato');
  assert.equal(a.fixos.find((f) => f.nome === 'Programa').achado.onde, 'cartao');
});

test('projeção: média dos meses fechados, cortes, clientes novos e o mês que o caixa fica negativo', () => {
  const base = { saldo_hoje: 1000, mes_inicial: '2026-12', entradas_por_categoria: { receita_cliente: 10000 }, saidas_por_categoria: { salario: 8000, combustivel: 1000, ferramentas: 1500 } };
  const nada = X.projetar(base, {}, 3);
  assert.deepEqual(nada.meses.map((m) => m.saldo), [500, 0, -500]); assert.equal(nada.primeiro_mes_negativo, '2027-02');
  const corte = X.projetar(base, { cortes: [{ categoria: 'combustivel', percentual: 50 }], economias: [{ nome: 'Programa', valor: 300 }] }, 3);
  assert.equal(corte.resultado_mensal, 300); assert.equal(corte.primeiro_mes_negativo, null);
  const dois = X.projetar(base, { clientes_novos: [{ quantos: 2, valor: 1500, a_partir: 2 }] }, 12);
  assert.equal(dois.meses[0].resultado, -500); assert.equal(dois.meses[1].resultado, 2500); assert.equal(dois.meses.length, 12);
  // Base a partir do extrato: o mês corrente (novembro) não entra na média.
  const b = X.baseDaProjecao(X.transacoesDoCsv(X.lerCsvBB(CSV), []));
  assert.deepEqual(b.meses_usados, ['2026-10']); assert.equal(b.mes_inicial, '2026-12'); assert.equal(b.saldo_hoje, 2650);
});

// ---------- Servidor ----------
const resposta = () => ({ codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', dono: true } };
const admin = { tipo: 'sessao', pessoa: { id: 2, nome: 'Adm', admin: true } };
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo'),(2,'Adm');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    INSERT INTO vybe_clientes (id,nome) VALUES (1,'Cliente A'),(2,'Cliente B');
    CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, atualizado_em timestamptz DEFAULT now());
    INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (1, 2000, '2026-01-01');
    CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
    INSERT INTO vybe_comercial_financas_cliente VALUES (2, 1500);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  return sql;
}
const chamar = async (sql, quem, method, body = null, query = {}) => { const r = resposta(); await areaFinanceiro({ method, body, query }, r, quem, () => sql); return r; };

test('servidor: só os quatro donos (administração não entra), prévia não grava, importar grava sem duplicar', async (t) => {
  const sql = await banco(t);
  assert.equal((await chamar(sql, admin, 'GET')).codigo, 403);
  assert.equal((await chamar(sql, null, 'GET')).codigo, 401);
  const previa = await chamar(sql, dono, 'POST', { acao: 'previa', csv: CSV });
  assert.equal(previa.codigo, 200); assert.equal(previa.body.novas, 6); assert.equal(previa.body.transacoes.length, 6);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_carteira_config`)[0].n, 0);
  const imp = await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  assert.equal(imp.body.importado.novas, 6);
  const de_novo = await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  assert.equal(de_novo.body.importado.novas, 0); assert.equal(de_novo.body.importado.repetidas, 6);
  const g = await chamar(sql, dono, 'GET');
  assert.equal(g.body.transacoes.length, 6); assert.equal(g.body.importacoes.length, 2);
  assert.ok(g.body.por_cliente.linhas.some((l) => l.cliente_nome === 'Cliente B' && l.mensalidade === 1500));
});

test('servidor: editar, dividir, regra do Paulo reaplicada, fixo, item do cartão e cenário', async (t) => {
  const sql = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const { body } = await chamar(sql, dono, 'GET');
  const bol = body.transacoes.find((x) => x.banco.valor === 3000);
  const ruim = await chamar(sql, dono, 'POST', { acao: 'editar', id: bol.id, mudanca: { partes: [{ valor: 1, cliente_id: '1' }] } });
  assert.equal(ruim.codigo, 400);
  const ok = await chamar(sql, dono, 'POST', { acao: 'editar', id: bol.id, mudanca: { categoria: 'receita_cliente', partes: [{ valor: 2000, cliente_id: '1', cliente_nome: 'Cliente A' }, { valor: 1000, cliente_id: '2', cliente_nome: 'Cliente B' }], conferido: true } });
  assert.equal(ok.codigo, 200); assert.equal(ok.body.transacao.real.conferido_por, 'Paulo');
  const r = await chamar(sql, dono, 'POST', { acao: 'regra_salvar', regra: { contem: 'fulano', categoria: 'combustivel', sinal: 'saida', quem: 'Motorista' } });
  assert.equal(r.body.reaplicadas, 1);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'fixo_salvar', fixo: { nome: 'Internet', valor: 120, dia: 10, categoria: 'estrutura' } })).codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'cartao_salvar', item: { descricao: 'Programa', valor: 99.9, fatura: '2026-11' } })).codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'cenario_salvar', cenario: { nome: '2 clientes', clientes_novos: [{ quantos: 2, valor: 1500 }] } })).codigo, 200);
  const g = (await chamar(sql, dono, 'GET', null, { mes: '2026-11' })).body;
  assert.equal(g.transacoes.find((x) => x.banco.historico.includes('Fulano')).real.categoria, 'combustivel');
  assert.equal(g.fixos.length, 1); assert.equal(g.cartao.itens.length, 1); assert.equal(g.projecao.cenarios.length, 1);
  const a = g.por_cliente.linhas.find((l) => l.cliente_id === '1');
  assert.equal(a.meses.find((m) => m.mes === '2026-11').situacao, 'pago');
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'qualquer' })).codigo, 400);
});

test('montar não quebra sem nada importado', () => {
  const m = montar({ extrato: { transacoes: [], importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [] }, [], { mes: '', hoje: '2026-11-13' });
  assert.equal(m.mes, '2026-11'); assert.equal(m.transacoes.length, 0); assert.equal(m.por_cliente.meses.length, 6);
});

// ---------- Vorcaro (Tesouraria) ----------
import { areaFinanceiroBot } from '../server/financeiro.js';
const TOKEN = 'teste-'.repeat(10); // fictício, 60 caracteres
const doBot = async (sql, body, token = TOKEN) => { const r = resposta(); await areaFinanceiroBot({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body }, r, () => sql, { VYBE_AI_BOT_TOKEN: TOKEN }); return r; };

test('Vorcaro: o bot só entrega proposta pendente, com o token dele, sem duplicar', async (t) => {
  const sql = await banco(t);
  assert.equal((await doBot(sql, { acao: 'propor', propostas: [] }, 'outro-'.repeat(10))).codigo, 401);
  const r = await doBot(sql, { acao: 'propor', propostas: [{ id_externo: 'm1', autor: 'Vinícius', texto: 'gasolina', tipo: 'saida', valor: '100,00', data: '2026-11-02', categoria: 'combustivel' }, { texto: 'sem valor' }] });
  assert.equal(r.body.recebidas, 1); assert.equal(r.body.recusadas.length, 1);
  assert.equal((await doBot(sql, { acao: 'propor', propostas: [{ id_externo: 'm1', valor: 100 }] })).body.repetidas, 1);
  const g = (await chamar(sql, dono, 'GET')).body;
  assert.equal(g.vorcaro.propostas.length, 1); assert.equal(g.vorcaro.propostas[0].estado, 'pendente');
  assert.equal(g.transacoes.length, 0); // nada vai para o extrato sem um dono decidir
});

test('Vorcaro: juntar com o lançamento do banco não conta duas vezes; lançar à parte e descartar', async (t) => {
  const sql = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  await doBot(sql, { acao: 'propor', propostas: [
    { id_externo: 'a', texto: 'gasolina do Mizinho', tipo: 'saida', valor: 100, data: '2026-11-01', categoria: 'combustivel', quem: 'Mizinho' },
    { id_externo: 'b', texto: 'almoço em dinheiro', tipo: 'saida', valor: 40, data: '2026-11-03', categoria: 'alimentacao' },
    { id_externo: 'c', texto: 'repetido', tipo: 'saida', valor: 5, data: '2026-11-03' }] });
  let g = (await chamar(sql, dono, 'GET')).body;
  const [a, b, c] = g.vorcaro.propostas;
  assert.equal(a.candidatos.length, 1); assert.match(a.candidatos[0].historico, /Fulano/);
  const ja = await chamar(sql, dono, 'POST', { acao: 'proposta_juntar', id: a.id, transacao_id: a.candidatos[0].id });
  assert.equal(ja.codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'proposta_lancar', id: b.id, mudanca: { valor: 45 } })).codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'proposta_descartar', id: c.id })).codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'proposta_descartar', id: c.id })).codigo, 409);
  g = (await chamar(sql, dono, 'GET')).body;
  assert.equal(g.transacoes.length, 7); // 6 do banco + 1 lançada à parte (a juntada não criou outra)
  const banco1 = g.transacoes.find((x) => x.banco.historico.includes('Fulano'));
  assert.equal(banco1.real.categoria, 'combustivel'); assert.equal(banco1.real.quem, 'Mizinho'); assert.equal(banco1.real.conferido, true);
  const mao = g.transacoes.find((x) => x.id.startsWith('wa:'));
  assert.equal(mao.banco.valor, -45); assert.equal(mao.banco.saldo, null); assert.equal(mao.banco.origem, 'whatsapp');
  assert.equal(g.resumo.saldo_final, 2650); // lançamento sem saldo não muda o saldo do banco
  const l = await chamar(sql, dono, 'POST', { acao: 'lancar_mao', lancamento: { tipo: 'entrada', valor: 300, data: '2026-11-04', categoria: 'receita_cliente', cliente_id: '1', cliente_nome: 'Cliente A', texto: 'pagou em dinheiro' } });
  assert.equal(l.body.transacao.banco.origem, 'mao');
  assert.equal((await chamar(sql, admin, 'POST', { acao: 'lancar_mao', lancamento: { valor: 1 } })).codigo, 403);
});
