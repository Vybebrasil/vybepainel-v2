// Vybe Finanças → Vybe OS (só leitura): resumos puros, conector com um `sql` falso (imita o tagged template do pacote
// postgres; nenhum banco de verdade), a área com as permissões e as telas (Comercial, Carteira, RH) num vm. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import calc from '../shared/financas-calculos.js';
import { criarConectorFinancas, ErroFinancas, OPCOES_CONEXAO, traduzirErro, VARIAVEL } from '../server/vybe-financas.js';
import { areaVybeFinancas, montarParte, ehDonoDeFato } from '../server/vybe-financas-api.js';

const MES = '2026-11', HOJE = '2026-11-08';
const BASE = () => ({
  clientes: [
    { id: 'c1', name: 'Hebravet Ltda', cnpj: '12.345.678/0001-90', monthly_fee: 2000, due_day: 10, contract_status: 'Ativo' },
    { id: 'c2', name: 'Diá Lab ME', cnpj: '', monthly_fee: 1500, due_day: 5, contract_status: 'Ativo' },
    { id: 'c3', name: 'Cliente Fantasma', cnpj: '', monthly_fee: 900, due_day: 5, contract_status: 'Ativo' },
    { id: 'c4', name: 'Antigo', cnpj: '', monthly_fee: 700, due_day: 5, contract_status: 'Cancelado' },
  ],
  transacoes: [
    { id: 't1', description: 'Mensalidade - Hebravet', amount: 2000, type: 'INCOME', category: 'Pagamento de Cliente', date: '2026-11-05', paid_date: '2026-11-06', status: 'PAID', client_id: 'c1' },
    { id: 't2', description: 'Mensalidade - Dia Lab', amount: 1500, type: 'INCOME', category: 'Pagamento de Cliente', date: '2026-11-20', paid_date: null, status: 'PENDING', client_id: 'c2' },
    { id: 't3', description: 'Mensalidade - Dia Lab', amount: 1500, type: 'INCOME', category: 'Pagamento de Cliente', date: '2026-09-10', paid_date: null, status: 'PENDING', client_id: 'c2' },
    { id: 't4', description: 'Anúncios Hebravet', amount: 300, type: 'EXPENSE', category: 'Tráfego Pago', date: '2026-11-02', paid_date: '2026-11-02', status: 'PAID', client_id: 'c1' },
    { id: 't5', description: 'Software', amount: 200, type: 'EXPENSE', category: 'Ferramentas/Software', date: '2026-11-25', paid_date: null, status: 'PENDING', client_id: null },
    { id: 't6', description: 'Fatura do cartão', amount: 999, type: 'TRANSFER', category: 'Outros', date: '2026-11-03', paid_date: '2026-11-03', status: 'PAID', client_id: null },
    { id: 't7', description: 'Mensalidade - Hebravet', amount: 1800, type: 'INCOME', category: 'Pagamento de Cliente', date: '2026-10-05', paid_date: '2026-10-05', status: 'PAID', client_id: 'c1' },
    { id: 't8', description: 'Salário Ana', amount: 5000, type: 'EXPENSE', category: 'Salário/Prolabore', date: '2026-11-05', paid_date: '2026-11-05', status: 'PAID', client_id: null, employee_id: 'e1' },
  ],
  funcionarios: [
    { id: 'e1', name: 'Ana Souza', role: 'Designer', salary: 3000, bonus: 200, payment_day: 5 },
    { id: 'e2', name: 'Bia Lima', role: 'Social media', salary: 2500, bonus: 0, payment_day: 10 },
  ],
  historico: [
    { employee_id: 'e1', effective_month: '1970-01', salary: 2500, bonus: 0 },
    { employee_id: 'e1', effective_month: '2026-11', salary: 3000, bonus: 200 },
  ],
  assinaturas: [{ id: 's1', name: 'Adobe', cost: 300, renewal_day: 3, active: true }, { id: 's2', name: 'Canva', cost: 50, renewal_day: 9, active: false }],
  contratos: [
    { id: 'k1', client_id: 'c1', title: 'Social mídia', amount: 2000, status: 'Ativo', start_date: '2026-01-01', signed_date: '2025-12-20', end_date: '2026-12-31', due_day: 10, tem_pdf: true },
    { id: 'k2', client_id: 'c1', title: 'Contrato antigo', amount: 1500, status: 'Encerrado', start_date: '2025-01-01', signed_date: null, end_date: '2025-12-31', due_day: 10, tem_pdf: false },
    { id: 'k3', client_id: 'c3', title: 'Fantasma', amount: 900, status: 'Ativo', start_date: '2026-03-01', signed_date: null, end_date: null, due_day: 5, tem_pdf: false },
  ],
});
const VYBE = [{ id: '10', nome: 'Hebravet', cnpj: '12345678000190' }, { id: '11', nome: 'Dia Lab', cnpj: '' }, { id: '12', nome: 'Antonov', cnpj: '' }];

// ---------- Funções puras ----------
test('nome normalizado e ligação por CNPJ, depois pelo nome; nome repetido no Vybe OS não liga', () => {
  assert.equal(calc.normalizarNome('Diá  Lab ME'), 'dia lab');
  assert.equal(calc.normalizarNome('Hebravet Comércio LTDA.'), 'hebravet comercio');
  assert.equal(calc.normalizarNome('Ótica Eireli - ME'), 'otica');
  const l = calc.ligarClientes(BASE().clientes, VYBE);
  assert.deepEqual(l.porFinancas.c1, { vybe_id: '10', vybe_nome: 'Hebravet', por: 'cnpj' });
  assert.equal(l.porFinancas.c2.por, 'nome');
  assert.deepEqual(l.sem_par.map((c) => c.nome), ['Antigo', 'Cliente Fantasma']);
  const dupla = calc.ligarClientes([{ id: 'x', name: 'Dia Lab' }], [{ id: '1', nome: 'Dia Lab' }, { id: '2', nome: 'DIA LAB ltda' }]);
  assert.equal(dupla.ligados.length, 0, 'dois clientes do Vybe OS com o mesmo nome: não adivinha');
  // CNPJ manda mesmo com nome diferente.
  assert.equal(calc.ligarClientes([{ id: 'y', name: 'Razão Social X', cnpj: '12345678000190' }], VYBE).porFinancas.y.vybe_id, '10');
});

test('mês: recebido × previsto (mensalidade sem lançamento entra), transferência fica de fora', () => {
  const b = BASE(), r = calc.resumoMes(b.transacoes, b.clientes, MES);
  assert.equal(r.recebido, 2000);
  assert.equal(r.previsto, 4400, '2000 + 1500 lançados + 900 do Cliente Fantasma (ativo, sem lançamento)');
  assert.equal(r.mensalidades_sem_lancamento, 900);
  assert.equal(r.pendente, 1500);
  assert.equal(r.despesas_pagas, 5300); assert.equal(r.despesas_pendentes, 200);
  assert.equal(r.resultado, -3300);
});

test('despesas por categoria, custos fixos (só assinaturas ativas) e folha pelo histórico', () => {
  const b = BASE(), d = calc.despesasPorCategoria(b.transacoes, MES);
  assert.equal(d.total, 5500);
  assert.deepEqual(d.categorias.map((c) => [c.categoria, c.pago, c.pendente]), [['Salário/Prolabore', 5000, 0], ['Tráfego Pago', 300, 0], ['Ferramentas/Software', 0, 200]]);
  const cf = calc.custosFixos(b.assinaturas);
  assert.equal(cf.total, 300); assert.equal(cf.quantidade, 1);
  const f = calc.folhaDoMes(b.funcionarios, b.historico, MES);
  assert.equal(f.total, 5700); assert.equal(f.total_anterior, 5000); assert.equal(f.variacao, 700); assert.equal(f.variacao_percentual, 14);
  const ana = f.funcionarios.find((x) => x.nome === 'Ana Souza');
  assert.deepEqual([ana.salario, ana.bonus, ana.total, ana.total_anterior, ana.vigente_desde, ana.dia_pagamento], [3000, 200, 3200, 2500, '2026-11', 5]);
  assert.equal(calc.folhaDoMes(b.funcionarios, b.historico, '2026-10').total, 5000, 'outubro: salário antigo do histórico');
  assert.equal(calc.folhaDoMes(b.funcionarios, [], MES).total, 5700, 'sem histórico: o valor atual');
});

test('margem real por cliente (mês e 3 meses), séries com ticket médio e inadimplência', () => {
  const b = BASE(), m = calc.margemPorCliente(b.transacoes, MES, 3);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], { cliente_id: 'c1', mes: { receita: 2000, despesas: 300, margem: 1700, margem_percentual: 85 }, periodo: { receita: 3800, despesas: 300, margem: 3500, margem_percentual: 92.1 } });
  const s = calc.serieMensal(b.transacoes, MES, 12, 6);
  assert.equal(s.length, 6, 'começo vazio sai, ficam 6 meses');
  assert.deepEqual(s.at(-1), { mes: '2026-11', faturamento: 2000, custos: 5300, resultado: -3300, clientes_pagantes: 1, ticket_medio: 2000 });
  assert.equal(s.at(-2).faturamento, 1800);
  const i = calc.inadimplencia(b.transacoes, HOJE);
  assert.equal(i.total, 1500); assert.equal(i.criticos, 1);
  assert.deepEqual([i.clientes[0].cliente_id, i.clientes[0].atraso_mais_antigo, i.clientes[0].vencimento_mais_antigo], ['c2', 59, '2026-09-10']);
});

test('contratos: status para a Carteira, PDF, dias restantes e o principal de cada cliente', () => {
  const b = BASE(), l = calc.ligarClientes(b.clientes, VYBE);
  const c = calc.contratosDoFinancas(b.contratos, l, {}, HOJE);
  const k1 = c.find((x) => x.id === 'k1');
  assert.deepEqual([k1.cliente_id, k1.status_carteira, k1.tem_pdf, k1.fim, k1.assinado_em, k1.dias_restantes, k1.dia_vencimento], ['10', 'ativo', true, '2026-12-31', '2025-12-20', 53, 10]);
  assert.equal(c.find((x) => x.id === 'k2').status_carteira, 'encerrado');
  assert.equal(c.find((x) => x.id === 'k3').cliente_id, null);
  assert.equal(calc.contratoPrincipal(c.filter((x) => x.cliente_id === '10')).id, 'k1');
});

// ---------- Conector com sql falso ----------
const COLUNAS = { clients: ['id', 'name', 'cnpj', 'monthly_fee', 'due_day', 'contract_status'],
  transactions: ['id', 'description', 'amount', 'type', 'category', 'date', 'paid_date', 'status', 'client_id', 'employee_id'],
  employees: ['id', 'name', 'role', 'salary', 'bonus', 'payment_day'], employee_compensation_history: ['employee_id', 'effective_month', 'salary', 'bonus'],
  subscriptions: ['id', 'name', 'cost', 'renewal_day', 'active'],
  contracts: ['id', 'client_id', 'title', 'amount', 'status', 'start_date', 'signed_date', 'end_date', 'due_day', 'pdf_url', 'pdf_file_name'] };
const linhasDeColunas = (c) => Object.entries(c).flatMap(([tabela, cols]) => cols.map((coluna) => ({ tabela, coluna })));
function sqlFalso({ colunas = COLUNAS, falha = null, travar = false } = {}) {
  const b = BASE(), por = { clients: b.clientes, transactions: b.transacoes, employees: b.funcionarios, employee_compensation_history: b.historico, subscriptions: b.assinaturas, contracts: b.contratos };
  const log = [], modos = [];
  const tag = (strings, ...valores) => {
    const texto = strings.join('$');
    log.push({ texto, valores });
    if (falha) return Promise.reject(falha);
    if (/information_schema\.columns/.test(texto)) return Promise.resolve(linhasDeColunas(colunas));
    if (/set_config/.test(texto)) return Promise.resolve([{ set_config: '6000' }]);
    const t = texto.match(/FROM\s+(\w+)/)?.[1];
    return Promise.resolve(por[t] ? por[t].map((x) => ({ ...x })) : []);
  };
  const sql = Object.assign(tag, { log, modos, begin(modo, fn) { modos.push(modo); return travar ? new Promise(() => {}) : Promise.resolve().then(() => fn(tag)); }, end: async () => {} });
  return sql;
}
function conectorCom(sql, extra = {}) {
  const criados = [];
  const c = criarConectorFinancas({ env: { [VARIAVEL]: 'postgresql://vybe_os_leitura.abc:segredo123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres' },
    criarSql: (url, op) => { criados.push({ url, op }); return sql; }, ...extra });
  return { c, criados };
}

test('sem a variável: não configurado e nem tenta abrir conexão', () => {
  let abriu = false;
  const c = criarConectorFinancas({ env: {}, criarSql: () => { abriu = true; } });
  assert.equal(c.configurado(), false); assert.deepEqual(c.faltando(), [VARIAVEL]); assert.equal(abriu, false);
  assert.equal(criarConectorFinancas({ env: { [VARIAVEL]: 'https://x.supabase.co' } }).urlValida(), false);
});

test('conexão: opções do pooler, transação só leitura, statement_timeout e só SELECT', async () => {
  const sql = sqlFalso(), { c, criados } = conectorCom(sql);
  const base = await c.lerBase({ desde: '2025-12-01' });
  assert.deepEqual(criados[0].op, { ...OPCOES_CONEXAO });
  assert.deepEqual(OPCOES_CONEXAO, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 6, ssl: 'require' });
  assert.deepEqual(sql.modos, ['read only']);
  assert.match(sql.log[0].texto, /set_config\('statement_timeout'/); assert.equal(sql.log[0].valores[0], '6000');
  for (const q of sql.log) assert.match(q.texto.trim(), /^SELECT\b/i, q.texto);
  assert.ok(!sql.log.some((q) => /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT)\b/i.test(q.texto)));
  assert.equal(base.clientes.length, 4); assert.equal(base.historico.length, 2); assert.equal(base.contratos.length, 3);
  const tr = sql.log.find((q) => /FROM transactions/.test(q.texto));
  assert.ok(tr.texto.includes('paid_date') && tr.valores.includes('2025-12-01'));
});

test('cache por consulta: 3 minutos; depois lê de novo', async () => {
  let agora = 0;
  const sql = sqlFalso(), { c } = conectorCom(sql, { agora: () => agora });
  await c.lerBase({ desde: '2025-12-01' });
  const n = sql.log.length;
  agora = 2 * 60 * 1000; await c.lerBase({ desde: '2025-12-01' });
  assert.equal(sql.log.length, n, 'dentro dos 3 min: nada de banco');
  await c.lerBase({ desde: '2025-11-01' });
  const so = sql.log.slice(n).filter((q) => /FROM\s+\w+/.test(q.texto) && !/information_schema/.test(q.texto)).map((q) => q.texto.match(/FROM\s+(\w+)/)[1]);
  assert.deepEqual(so, ['transactions'], 'outro mês: só as transações (o resto vem do cache)');
  agora = 4 * 60 * 1000; const m = sql.log.length; await c.lerBase({ desde: '2025-12-01' });
  assert.ok(sql.log.length > m, 'vencido o cache, lê de novo');
});

test('versão antiga do Finanças: sem paid_date, sem histórico e sem contratos', async () => {
  const antigas = { ...COLUNAS, transactions: COLUNAS.transactions.filter((c) => !['paid_date', 'employee_id'].includes(c)), employee_compensation_history: [], contracts: [] };
  const sql = sqlFalso({ colunas: antigas }), { c } = conectorCom(sql);
  const base = await c.lerBase({ desde: '2025-12-01' });
  const tr = sql.log.find((q) => /FROM transactions/.test(q.texto));
  assert.ok(!/paid_date >=/.test(tr.texto) && /NULL::text AS paid_date/.test(tr.texto));
  assert.deepEqual(base.historico, []); assert.deepEqual(base.contratos, []);
  assert.ok(!sql.log.some((q) => /FROM (contracts|employee_compensation_history)/.test(q.texto)));
});

test('sem SELECT numa tabela obrigatória: erro de permissão claro', async () => {
  const { c } = conectorCom(sqlFalso({ colunas: { ...COLUNAS, employees: [] } }));
  await assert.rejects(c.lerBase({ desde: '2025-12-01' }), (e) => e instanceof ErroFinancas && e.codigo === 'permissao' && /SQL de acesso/.test(e.message));
});

test('erro do Postgres vira frase segura e fica 30 s guardado; tempo esgotado também', async () => {
  let agora = 0;
  const cru = Object.assign(new Error('password authentication failed for user "vybe_os_leitura" postgresql://vybe_os_leitura:segredo123@host'), { code: '28P01' });
  const sql = sqlFalso({ falha: cru }), { c } = conectorCom(sql, { agora: () => agora });
  await assert.rejects(c.lerBase({ desde: '2025-12-01' }), (e) => e.codigo === 'login' && !/segredo|postgresql:|password authentication/.test(e.message));
  const n = sql.log.length;
  agora = 20 * 1000; await assert.rejects(c.lerBase({ desde: '2025-12-01' }), (e) => e.codigo === 'login');
  assert.equal(sql.log.length, n, 'falha guardada: não martela o banco');
  assert.equal(traduzirErro({ code: '57014' }).codigo, 'tempo'); assert.equal(traduzirErro({ code: 'ENOTFOUND' }).codigo, 'rede');
  assert.equal(traduzirErro(new Error('qualquer coisa com segredo')).message.includes('segredo'), false);
  const parado = conectorCom(sqlFalso({ travar: true }), { tempoMs: 5 }).c;
  await assert.rejects(parado.lerBase({ desde: '2025-12-01' }), (e) => e.codigo === 'tempo');
});

// ---------- Área (permissões no servidor) ----------
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', admin: false, dono: true } }; // dono vem da sessão (server/donos.js)
const suporte = { tipo: 'sessao', pessoa: { id: 4, nome: 'Suporte', admin: true } };
const bia = { tipo: 'sessao', pessoa: { id: 3, nome: 'Bia', admin: false } };
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const bancoVybe = () => Object.assign((strings) => Promise.resolve(/vybe_clientes/.test(strings.join('')) ? VYBE.map((x) => ({ ...x })) : []), {});
const conectorFalso = (falha = null) => ({ configurado: () => true, urlValida: () => true, faltando: () => [],
  lerBase: async () => { if (falha) throw falha; return BASE(); } });
async function chamar(quem, query, { conector = conectorFalso(), metodo = 'GET' } = {}) {
  const res = resposta();
  await areaVybeFinancas({ method: metodo, query }, res, quem, bancoVybe, { conector, hoje: HOJE });
  return res;
}

test('Comercial: só quem vê dinheiro; a folha vai só como total, sem salário de ninguém', async () => {
  assert.equal((await chamar(bia, { parte: 'comercial' })).codigo, 403);
  for (const quem of [paulo, suporte]) {
    const r = await chamar(quem, { parte: 'comercial', mes: MES });
    assert.equal(r.codigo, 200); assert.equal(r.body.conectado, true); assert.equal(r.body.fonte, 'Vybe Finanças');
    assert.equal(r.body.folha.total, 5700); assert.equal(r.body.folha.funcionarios, undefined);
    const json = JSON.stringify(r.body);
    assert.ok(!json.includes('Ana Souza') && !json.includes('"salario"'), 'nenhum nome nem salário de funcionário');
    assert.equal(r.body.inadimplencia.clientes[0].cliente_id, '11'); assert.equal(r.body.inadimplencia.clientes[0].cliente_nome, 'Dia Lab');
    assert.deepEqual(r.body.margens[0].cliente_id, '10');
    assert.deepEqual(r.body.ligacao.sem_par.map((x) => x.nome), ['Antigo', 'Cliente Fantasma']);
  }
});

test('RH: só os quatro donos recebem a folha com salários (administração sem ser dono não)', async () => {
  assert.equal((await chamar(bia, { parte: 'rh' })).codigo, 403);
  assert.equal((await chamar(suporte, { parte: 'rh' })).codigo, 403);
  assert.equal(ehDonoDeFato({ id: 3, nome: 'Vinícius', monday_user_id: '68035653' }), true); assert.equal(ehDonoDeFato({ id: 9, nome: 'Vinícius' }), false); assert.equal(ehDonoDeFato({ nome: 'Suporte', admin: true }), false);
  const r = await chamar(paulo, { parte: 'rh', mes: MES });
  assert.equal(r.codigo, 200); assert.equal(r.body.folha.funcionarios.find((f) => f.nome === 'Ana Souza').salario, 3000);
  assert.deepEqual(r.body.pode, { ver_dinheiro: true, ver_salarios: true });
});

test('Carteira: todos veem os contratos; o valor só quem vê dinheiro; um principal por cliente', async () => {
  const eq = await chamar(bia, { parte: 'carteira' });
  assert.equal(eq.codigo, 200);
  assert.ok(eq.body.contratos.every((c) => c.valor === null), 'equipe: sem valor');
  const dono = await chamar(paulo, { parte: 'carteira' });
  const k1 = dono.body.contratos.find((c) => c.id === 'k1');
  assert.equal(k1.valor, 2000); assert.equal(k1.principal, true);
  assert.equal(dono.body.contratos.find((c) => c.id === 'k2').principal, false);
  assert.equal(dono.body.contratos.find((c) => c.id === 'k3').principal, false, 'sem par: não alimenta a Carteira');
  assert.ok(!JSON.stringify(dono.body).includes('pdf_url'));
});

test('sem a variável: conectado false; o passo a passo só para quem vê dinheiro; só GET; erro sem vazamento', async () => {
  const semVar = { configurado: () => false, urlValida: () => true, faltando: () => [VARIAVEL], lerBase: async () => { throw new Error('não devia ler'); } };
  const p = await chamar(paulo, { parte: 'comercial' }, { conector: semVar });
  assert.deepEqual([p.codigo, p.body.conectado, p.body.motivo], [200, false, 'Conectar o Vybe Finanças']);
  assert.ok(p.body.passos.some((x) => x.includes('VYBE_FINANCAS_DB_URL')));
  const e = await chamar(bia, { parte: 'carteira' }, { conector: semVar });
  assert.equal(e.body.conectado, false); assert.equal(e.body.passos, undefined);
  assert.equal((await chamar(paulo, { parte: 'comercial' }, { metodo: 'POST' })).codigo, 405);
  assert.equal((await chamar(paulo, { parte: 'outra' })).codigo, 400);
  assert.equal((await chamar(paulo, { parte: 'comercial', mes: '2026-13' })).codigo, 400);
  const cru = traduzirErro(Object.assign(new Error('FATAL senha errada postgresql://u:segredo@h'), { code: '28P01' }));
  const f = await chamar(paulo, { parte: 'comercial' }, { conector: conectorFalso(cru) });
  assert.equal(f.codigo, 502); assert.equal(f.body.financas_indisponivel, true); assert.ok(!/segredo|postgresql/.test(JSON.stringify(f.body)));
  const outro = await chamar(paulo, { parte: 'comercial' }, { conector: conectorFalso(new Error('connect ECONNREFUSED segredo')) });
  assert.equal(outro.codigo, 500); assert.ok(!JSON.stringify(outro.body).includes('segredo'));
  assert.equal((await chamar({ tipo: 'servico' }, { parte: 'comercial' })).codigo, 403);
});

test('montarParte rh recusa quem não é dono mesmo chamada direto', () => {
  assert.throws(() => montarParte('rh', BASE(), VYBE, { mes: MES, hoje: HOJE, dinheiro: true, dono: false }), (e) => e.status === 403);
});

// ---------- Telas (vm, sem DOM de verdade) ----------
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.dataset = {}; this.hidden = false; this._html = ''; this.filhos = []; this.attrs = {}; this.isConnected = true; this.scrollTop = 0; }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener() {} append(...f) { this.filhos.push(...f); this.filho = f[0]; } remove() {}
  querySelector() { return null; } querySelectorAll() { return []; } contains() { return false; } focus() {} closest() { return null; }
}
function contexto(respostas) {
  const corpo = new El('body'), criados = [], pedidos = [];
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, encodeURIComponent, URL, setTimeout, clearTimeout, confirm: () => true,
    document: { body: corpo, activeElement: null, createElement: (t) => { const e = new El(t); criados.push(e); return e; }, getElementById: (id) => criados.find((e) => e.id === id) || null, querySelectorAll: () => [], addEventListener() {}, querySelector: () => null },
    fetch: async (url) => { pedidos.push(url); const q = Object.fromEntries(new URL(url, 'http://x').searchParams); const r = respostas(q); return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo }; } };
  ctx.window = ctx; ctx.addEventListener = () => {};
  vm.createContext(ctx);
  return { ctx, criados, pedidos, corpo };
}
const esperar = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 2)); };
async function respostaDaArea(quem, q, conector = conectorFalso()) {
  const r = await chamar(quem, q, { conector }); return { codigo: r.codigo, corpo: r.body };
}

test('tela do Comercial: com o Finanças a aba de dinheiro diz a fonte, mostra margem real e o mini painel abre', async () => {
  const comercialVazio = { ok: true, aba: 'financas', pode: { ver_dinheiro: true, editar_comercial: true, editar_pacotes: true },
    clientes: [{ cliente_id: '10', cliente_nome: 'Hebravet', valor_mensal: 2000, status_pagamento: 'em_dia', custo: 0, margem_percentual: null }],
    resumo: { receita: 2000, custo: 0, margem_percentual: null, criticas: 0, pagamento: { atrasado: 0, inadimplente: 0 } }, pacotes: [], zona_critica: 20, status: [] };
  for (const [conector, espera, naoEspera] of [[conectorFalso(), /fonte: Vybe Finanças[\s\S]*Margem real por cliente[\s\S]*Margem real \(Vybe Finanças\): R\$\s?1\.700,00/, /Custo estimado/],
    [{ configurado: () => false, urlValida: () => true, faltando: () => [VARIAVEL] }, /Conectar o Vybe Finanças[\s\S]*VYBE_FINANCAS_DB_URL[\s\S]*Custo estimado/, /fonte: Vybe Finanças/]]) {
    const respostas = (q) => (q.area === 'vybe_financas' ? null : { codigo: 200, corpo: comercialVazio });
    const t = contexto((q) => respostas(q) || { codigo: 0, corpo: null });
    // A área de verdade, com o conector falso (as permissões do servidor valem também aqui).
    t.ctx.fetch = async (url) => { const q = Object.fromEntries(new URL(url, 'http://x').searchParams);
      const r = q.area === 'vybe_financas' ? await respostaDaArea(paulo, q, conector) : { codigo: 200, corpo: comercialVazio };
      return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo }; };
    t.ctx.operadorDoTopo = () => ({ nome: 'Paulo Henrique' });
    t.ctx.souDonoDaSessao = () => true; // palpite pela sessão antes da resposta do servidor (que confirma)
    vm.runInContext(readFileSync('shared/comercial-calculos.js', 'utf8'), t.ctx);
    vm.runInContext(readFileSync('vybe-mundo-financas.js', 'utf8'), t.ctx);
    vm.runInContext(readFileSync('vybe-mundo-comercial.js', 'utf8'), t.ctx);
    t.ctx.VybeComercial.abrir('financas'); await esperar();
    const html = t.criados.find((e) => e.id === 'vv-comercial').innerHTML;
    assert.match(html, espera); assert.doesNotMatch(html, naoEspera);
    if (conector.lerBase) {
      const p = t.ctx.VybeEspiarProvedores.financas('comercial:despesas');
      assert.equal(p.itens[0].nome, 'Salário/Prolabore');
      assert.equal(t.ctx.VybeEspiarProvedores.financas('comercial:inad').itens[0].nome, 'Dia Lab');
      t.ctx.VybeComercial.abrir('contas'); await esperar();
      assert.match(t.criados.find((e) => e.id === 'vv-comercial').innerHTML, /Despesas de novembro de 2026[\s\S]*Adobe[\s\S]*Contas lançadas no Vybe OS/);
    }
  }
});

test('tela do RH: a Folha aparece para o dono e some para quem não é', async () => {
  const rh = (gestao) => ({ ok: true, aba: 'rh', gestao, eu: { id: '1' }, pedidos: [], tipos: [], status: {}, aniversarios: [], ferias: [], pesquisa: { atual: null, dimensoes: [], minimo: 3, historico: [] } });
  for (const [quem, gestao] of [[paulo, true], [suporte, true], [bia, false]]) {
    const t = contexto(() => ({ codigo: 0 }));
    t.ctx.fetch = async (url) => { const q = Object.fromEntries(new URL(url, 'http://x').searchParams);
      const r = q.area === 'vybe_financas' ? await respostaDaArea(quem, q) : { codigo: 200, corpo: rh(gestao) };
      return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo }; };
    vm.runInContext(readFileSync('vybe-mundo-financas.js', 'utf8'), t.ctx);
    vm.runInContext(readFileSync('vybe-mundo-pessoas.js', 'utf8'), t.ctx);
    await t.ctx.VybePessoas.abrir('rh'); await esperar();
    const html = (function achar(e) { return [e.innerHTML || '', ...(e.filhos || []).map(achar)].join(''); })(t.corpo);
    if (quem === paulo) { assert.match(html, /Folha[\s\S]*Ana Souza[\s\S]*salário R\$\s?3\.000,00/); assert.equal(t.ctx.VybeEspiarProvedores.financas('rh:folha').itens.length, 2); }
    else assert.doesNotMatch(html, /Ana Souza|só os donos veem/);
    if (quem === bia) assert.ok(!t.pedidos.some((u) => u.includes('vybe_financas')), 'quem não é gestão nem pede');
  }
});

test('tela da Carteira: contratos do Finanças entram no lugar do registro do Vybe OS', async () => {
  const t = contexto(() => ({ codigo: 0 }));
  t.ctx.fetch = async (url) => { const q = Object.fromEntries(new URL(url, 'http://x').searchParams);
    const r = await respostaDaArea(paulo, q); return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo }; };
  vm.runInContext(readFileSync('vybe-mundo-financas.js', 'utf8'), t.ctx);
  await t.ctx.VybeFinancas.carregar('carteira');
  const lista = t.ctx.VybeFinancas.contratosDaCarteira([{ cliente_id: '10', valor_mensal: 999, inicio: '2024-01-01', renovacao: '2024-12-31', status: 'ativo', observacao: 'nota' },
    { cliente_id: '12', valor_mensal: 500, inicio: '2025-05-01', renovacao: null, status: 'ativo', observacao: '' }]);
  const heb = lista.find((c) => c.cliente_id === '10');
  assert.deepEqual([heb.valor_mensal, heb.inicio, heb.renovacao, heb.status, heb.observacao, heb.fonte], [2000, '2026-01-01', '2026-12-31', 'ativo', 'nota', 'financas']);
  assert.equal(lista.find((c) => c.cliente_id === '12').valor_mensal, 500, 'sem contrato no Finanças: fica o do Vybe OS');
  assert.equal(t.ctx.VybeFinancas.contratoDoCliente('10').tem_pdf, true);
  assert.equal(t.ctx.VybeEspiarProvedores.financas('carteira:sempar').itens.length, 2);
});

test('tela da Carteira → Contratos: fonte do Finanças, sem par e o contrato de lá sem botão de editar', async () => {
  const carteira = { ok: true, dia: HOJE, eu: '1', admin: true, atendimento: false, meus_clientes: [], pode: { contratos: true, churn: true, etapas: true, onboarding_todos: true },
    pessoas: [], sinais: null, clima: { disponivel: false }, etapas: [], etapas_padrao: [], onboarding: { disponivel: true, clientes: [] }, churn: { disponivel: true, registros: [] },
    historico: { disponivel: true, meses: [] }, contratos: { disponivel: true, lista: [{ cliente_id: '12', valor_mensal: 500, inicio: '2025-05-01', renovacao: null, status: 'ativo', observacao: '' }] },
    clientes: [{ id: '10', nome: 'Hebravet', ativo: true, entrada: '2025-01-01', entrada_fonte: 'cadastro', saida: null, valor: null }, { id: '12', nome: 'Antonov', ativo: true, entrada: '2025-05-01', entrada_fonte: 'contrato', saida: null, valor: 500 }],
    opcoes: { contrato_status: [], churn_tipos: [], churn_motivos: [] } };
  const t = contexto(() => ({ codigo: 0 }));
  t.ctx.fetch = async (url) => { const q = Object.fromEntries(new URL(url, 'http://x').searchParams);
    const r = q.area === 'vybe_financas' ? await respostaDaArea(paulo, q) : { codigo: 200, corpo: carteira };
    return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo }; };
  t.ctx.localStorage = { getItem: () => '1', setItem() {} };
  vm.runInContext(readFileSync('vybe-carteira-saude.js', 'utf8'), t.ctx);
  vm.runInContext(readFileSync('vybe-mundo-financas.js', 'utf8'), t.ctx);
  vm.runInContext(readFileSync('vybe-mundo-carteira.js', 'utf8'), t.ctx);
  await t.ctx.VybeCarteira.abrir('contratos'); await esperar();
  const html = t.criados.find((e) => e.id === 'vv-carteira').innerHTML;
  assert.match(html, /Contratos do Vybe Finanças[\s\S]*fonte: Vybe Finanças/);
  assert.match(html, /Vybe Finanças: Social mídia · assinado em 20\/12\/25 · vence dia 10 · Ativo · com PDF/);
  assert.match(html, /No Finanças, sem par no Vybe OS/);
  assert.doesNotMatch(html, /Aguardando ativação/);
  // Hebravet (contrato do Finanças) sem "Editar"; Antonov (registro do Vybe OS) continua editável.
  const heb = html.slice(html.indexOf('<b>Hebravet</b>'), html.indexOf('</li>', html.indexOf('<b>Hebravet</b>')));
  assert.doesNotMatch(heb, /data-vc-form-abrir/);
  assert.match(html, /Antonov[\s\S]*?data-vc-form-abrir="contrato" data-vc-cli="12"/);
});

// As consultas de verdade do conector num Postgres em memória (PGlite) com as tabelas do Finanças
// (colunas de supabase_schema.sql e das migrações de vybe-financas), dentro de uma transação READ ONLY.
test('consultas do conector rodam num Postgres com o esquema do Finanças (PGlite, transação só leitura)', async (t) => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    CREATE TABLE clients (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, name text NOT NULL, cnpj text, contact_person text, email text, phone text,
      active_plan text, monthly_fee numeric, due_day integer, contract_status text, created_at timestamptz DEFAULT now());
    CREATE TABLE employees (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, name text NOT NULL, role text NOT NULL, salary numeric NOT NULL,
      bonus numeric NOT NULL DEFAULT 0, pix_key text, payment_day integer, observations text);
    CREATE TABLE transactions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, description text NOT NULL, amount numeric NOT NULL, type text NOT NULL,
      category text NOT NULL, date timestamptz DEFAULT now(), status text NOT NULL, client_id uuid, employee_id uuid, payment_method text, receipt_url text,
      bank_account_id uuid, paid_date date, transfer_to_account_id uuid);
    CREATE TABLE subscriptions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, name text NOT NULL, cost numeric NOT NULL, renewal_day integer, payment_method text, active boolean DEFAULT true);
    CREATE TABLE employee_compensation_history (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, employee_id uuid, user_id uuid, effective_month text NOT NULL,
      salary numeric NOT NULL, bonus numeric NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now());
    CREATE TABLE contracts (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, client_id uuid, title text NOT NULL, amount numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'Ativo', start_date date NOT NULL, signed_date date, end_date date, due_day integer NOT NULL DEFAULT 1, notes text,
      template_key text, parameters jsonb, pdf_url text, pdf_file_name text, created_at timestamptz DEFAULT now());
    INSERT INTO clients (id, name, cnpj, monthly_fee, due_day, contract_status) VALUES ('00000000-0000-0000-0000-0000000000c1', 'Hebravet Ltda', '12345678000190', 2000, 10, 'Ativo');
    INSERT INTO employees (name, role, salary, bonus, payment_day) VALUES ('Ana', 'Designer', 3000.5, 200, 5);
    INSERT INTO transactions (description, amount, type, category, date, status, client_id, paid_date) VALUES
      ('Mensalidade', 2000, 'INCOME', 'Pagamento de Cliente', '2026-11-05T13:00:00Z', 'PAID', '00000000-0000-0000-0000-0000000000c1', '2026-11-06'),
      ('Velha paga', 100, 'INCOME', 'Outros', '2024-01-05T13:00:00Z', 'PAID', NULL, '2024-01-05'),
      ('Velha pendente', 150, 'INCOME', 'Outros', '2024-02-05T13:00:00Z', 'PENDING', NULL, NULL);
    INSERT INTO subscriptions (name, cost, renewal_day, active) VALUES ('Adobe', 300, 3, true);
    INSERT INTO contracts (client_id, title, amount, start_date, end_date, pdf_url) VALUES ('00000000-0000-0000-0000-0000000000c1', 'Social', 2000, '2026-01-01', '2026-12-31', 'https://x/c.pdf');`);
  const modos = [];
  const adaptador = (q) => { const tag = (strings, ...valores) => q.query(strings.reduce((s, p, i) => s + (i ? '$' + i : '') + p, ''), valores).then((r) => r.rows); return tag; };
  const sql = Object.assign(adaptador(db), { begin: (modo, fn) => { modos.push(modo); return db.transaction(async (tx) => { await tx.query('SET TRANSACTION READ ONLY'); return fn(adaptador(tx)); }); }, end: async () => {} });
  const c = criarConectorFinancas({ env: { [VARIAVEL]: 'postgresql://u:p@h:6543/postgres' }, criarSql: () => sql });
  const base = await c.lerBase({ desde: '2025-12-01' });
  assert.deepEqual(modos, ['read only']);
  assert.deepEqual(base.transacoes.map((x) => x.description).sort(), ['Mensalidade', 'Velha pendente'], 'antiga paga fica fora; pendente antiga entra');
  const m = base.transacoes.find((x) => x.description === 'Mensalidade');
  assert.deepEqual([m.date, m.paid_date, m.amount, m.client_id], ['2026-11-05', '2026-11-06', 2000, '00000000-0000-0000-0000-0000000000c1']);
  assert.equal(base.funcionarios[0].salary, 3000.5); assert.equal(base.contratos[0].tem_pdf, true); assert.equal(base.contratos[0].end_date, '2026-12-31');
  assert.equal(base.clientes[0].monthly_fee, 2000); assert.deepEqual(base.historico, []);
  // Escrever dentro da transação só leitura falha (o papel de produção ainda tem default_transaction_read_only).
  await assert.rejects(db.transaction(async (tx) => { await tx.query('SET TRANSACTION READ ONLY'); await tx.query("INSERT INTO subscriptions (name, cost) VALUES ('x', 1)"); }));
});

test('diagnóstico do erro: só o código e a etiqueta, nunca a mensagem', async () => {
  const { traduzirErro } = await import('../server/vybe-financas.js');
  const e = traduzirErro(Object.assign(new Error('FATAL: Tenant or user not found postgresql://u:SEGREDO@h'), { code: 'XX000' }));
  assert.equal(e.codigo, 'login');
  assert.deepEqual({ ...e.diagnostico }, { sqlstate: 'XX000', motivo: 'pooler_nao_achou_usuario' });
  assert.ok(!JSON.stringify(e.diagnostico).includes('SEGREDO'));
  const s = traduzirErro(Object.assign(new Error('password authentication failed for user "x"'), { code: '28P01' }));
  assert.equal(s.diagnostico.motivo, 'senha_recusada');
});

test('ligação por nome parecido: sem espaços ou um contendo o outro, só com candidato único', () => {
  const vybe = [{ id: '1', nome: 'Brussolo Ristorante' }, { id: '2', nome: 'Alpha1' }, { id: '3', nome: 'Academia Lions' }, { id: '4', nome: 'Antonov' }, { id: '5', nome: 'Gonzalez' }, { id: '6', nome: 'VOA' }, { id: '7', nome: 'Ótica Visão' }, { id: '8', nome: 'Ótica Visão Centro' }];
  const fin = [{ id: 'a', name: 'Brussolo' }, { id: 'b', name: 'Alpha 1' }, { id: 'c', name: 'Academia LionsTop' }, { id: 'd', name: 'Antonov Center' }, { id: 'e', name: 'Gonzalez Gastronomia' }, { id: 'f', name: 'VOA Sportswear' }, { id: 'g', name: 'Grupo Serra Grande' }, { id: 'h', name: 'Ótica' }];
  const l = calc.ligarClientes(fin, vybe);
  assert.deepEqual(['a', 'b', 'c', 'd', 'e', 'f'].map((k) => l.porFinancas[k]?.vybe_id), ['1', '2', '3', '4', '5', '6']);
  assert.equal(l.porFinancas.a.por, 'nome_parecido');
  assert.deepEqual(l.sem_par.map((x) => x.nome), ['Grupo Serra Grande', 'Ótica']); // "Ótica" tem dois candidatos: não liga
});
