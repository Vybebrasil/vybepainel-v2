// Financeiro dentro do Vybe OS, fase 1: migração, importador do Vybe Finanças, leitura do próprio banco pela chave
// VYBE_FINANCAS_FONTE e a regra de dono no servidor. SAFE: tudo em PGlite na memória (um "Finanças" e um "Vybe OS" de
// mentira, dados inventados); nada vai ao Supabase, ao Neon nem ao WhatsApp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import calc from '../shared/financas-calculos.js';
import { criarFinancasDeDemonstracao, criarVybeDeEnsaio, DEMO_VYBE } from '../scripts/financas-demo.mjs';
import { lerOrigemDoFinancas, baseDaOrigem, planejar, gravar, conferir, basesIguais, podeGravar, relatorio, VARIAVEL_GRAVAR } from '../server/financas-importacao.js';
import { lerBaseLocal, criarConectorLocal, fonteFinancas, semDinheiroNemSalario, MENSAGEM_SEM_IMPORTACAO } from '../server/financas-local.js';
import { criarConectorFinancas, VARIAVEL } from '../server/vybe-financas.js';
import { clientesDoVybe, lerVybeFinancas, lancamentosDoFinancas, areaVybeFinancas, conectorDaFonte } from '../server/vybe-financas-api.js';
import { areaComercial } from '../server/comercial-api.js';
import { areaCarteira } from '../server/carteira.js';

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HOJE = '2026-11-11';
const GRAVAR = { [VARIAVEL_GRAVAR]: 'GRAVAR' };
const LOCAL = { VYBE_FINANCAS_FONTE: 'local' };
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const dono = { id: 1, nome: 'Dono Um', admin: false, dono: true };
const administracao = { id: 2, nome: 'Dona Dois', admin: true };   // administra o painel, mas não é um dos quatro donos
const equipe = { id: 3, nome: 'Ana Lima', admin: false };
const sessao = (pessoa) => ({ tipo: 'sessao', pessoa });

// Um Finanças de demonstração, um Vybe OS com a migração, e o plano montado como o script monta.
async function cenario(t, { sem = [], gravado = true } = {}) {
  const fin = await criarFinancasDeDemonstracao({ sem });
  const vybeOs = await criarVybeDeEnsaio(DEMO_VYBE);
  t.after(() => Promise.all([fin.db.close(), vybeOs.db.close()]));
  const ler = async () => {
    const origem = await lerOrigemDoFinancas(fin.consultar);
    const vybe = [...await clientesDoVybe(vybeOs.sql)];
    const pessoas = [...await vybeOs.sql`SELECT id::text, nome FROM vybe_pessoas ORDER BY nome`];
    return { origem, vybe, plano: planejar(origem, { clientesVybe: vybe, pessoasVybe: pessoas }) };
  };
  const rodar = async () => { const x = await ler(); return { ...x, resultado: await vybeOs.sql.comTransacao((tx) => gravar(tx, x.plano, { env: GRAVAR })) }; };
  const ponte = () => criarConectorFinancas({ env: { [VARIAVEL]: 'postgresql://demo' }, criarSql: () => fin.comoPostgres }).lerBase({ desde: '1900-01-01' });
  const primeiro = gravado ? await rodar() : await ler();
  return { fin, ...vybeOs, ler, rodar, ponte, ...primeiro };
}
const novos = (r) => Object.values(r).reduce((s, v) => s + (v && typeof v === 'object' && 'novos' in v ? v.novos : 0), 0);
const contar = async (sql, tabela) => (await sql.query(`SELECT count(*)::int AS n FROM ${tabela}`))[0].n;

test('migração: roda três vezes, preserva o que existia e só afrouxa os limites para o que vem do Finanças', async (t) => {
  const { db, sql } = await criarVybeDeEnsaio({ ...DEMO_VYBE, comMigracao: false });
  t.after(() => db.close());
  await db.exec(`INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, status) VALUES (10, 2500, 'ativo'), (11, 1800, 'negociando');
    INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, criado_por) VALUES ('pontual', 'Site', 900, '2026-11-20', 1);
    INSERT INTO vybe_comercial_contas (grupo, descricao, valor, vencimento, criado_por) VALUES ('fixa', 'Internet', 150, '2026-11-02', 1);`);
  const m = readFileSync('migrations/2026-11-11-financas-base.sql', 'utf8');
  await db.exec(m); await db.exec(m); await db.exec(m);
  assert.deepEqual(await sql`SELECT id::int, cliente_id::int, valor_mensal::float8 AS v FROM vybe_cliente_contratos ORDER BY id`, [{ id: 1, cliente_id: 10, v: 2500 }, { id: 2, cliente_id: 11, v: 1800 }]);
  assert.equal(await contar(sql, 'vybe_comercial_recebiveis'), 1); assert.equal(await contar(sql, 'vybe_comercial_contas'), 1);
  const falha = (q) => assert.rejects(db.query(q), q);
  // O que é digitado no painel continua com as regras de antes.
  await falha(`INSERT INTO vybe_cliente_contratos (cliente_id, status) VALUES (10, 'ativo')`);                                  // um contrato à mão por cliente
  await falha(`INSERT INTO vybe_cliente_contratos (status) VALUES ('ativo')`);                                                   // sem cliente só se veio do Finanças
  await falha(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento) VALUES ('pontual', 'x', 1, '2026-01-01')`);              // sem autor
  await falha(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, criado_por) VALUES ('pontual', 'x', 0, '2026-01-01', 1)`); // valor zero
  await falha(`INSERT INTO vybe_comercial_contas (grupo, descricao, valor, vencimento, criado_por) VALUES ('fixa', '', 5, '2026-01-01', 1)`);       // sem descrição
  // O que vem do Finanças entra como está lá, e o mesmo uuid não entra duas vezes.
  await db.query(`INSERT INTO vybe_cliente_contratos (cliente_id, status, origem_financas_id) VALUES (10, 'ativo', '${U(900)}'), (NULL, 'encerrado', '${U(901)}')`);
  await db.query(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, origem_financas_id) VALUES ('pontual', '', 0, '2026-01-01', '${U(902)}')`);
  await db.query(`INSERT INTO vybe_comercial_contas (grupo, descricao, valor, vencimento, origem_financas_id) VALUES ('fixa', '', -5, '2026-01-01', '${U(903)}')`);
  await falha(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, origem_financas_id) VALUES ('pontual', '', 1, '2026-01-01', '${U(902)}')`);
});

test('mapeamento: INCOME vira recebível, EXPENSE vira conta, TRANSFER vira transferência, com as regras de data e status da ponte', async (t) => {
  const { plano } = await cenario(t, { gravado: false });
  assert.deepEqual([plano.recebiveis.length, plano.contas.length, plano.transferencias.length], [12, 10, 1]);
  const r = (n) => plano.recebiveis.find((x) => x.origem_financas_id === U(n)), c = (n) => plano.contas.find((x) => x.origem_financas_id === U(n));
  // PAID com paid_date: a baixa é o paid_date; PAID sem paid_date usa o date.
  assert.deepEqual([r(101).vencimento, r(101).recebido_em, r(101).valor_recebido, r(101).cancelado], ['2026-09-05', '2026-09-06', 2500, false]);
  assert.deepEqual([r(102).vencimento, r(102).recebido_em], ['2026-10-05', '2026-10-05']);
  assert.deepEqual([c(206).vencimento, c(206).pago_em], ['2026-10-12', '2026-10-12']);
  // PENDING fica sem baixa; status fora de PAID/PENDING vira cancelado.
  assert.deepEqual([r(103).recebido_em, r(103).valor_recebido, r(103).cancelado], [null, 0, false]);
  assert.equal(r(111).cancelado, true); assert.equal(c(209).cancelada, true);
  // Dia em UTC: 31/10 às 23h30 na Bahia já é 01/11 em UTC, como a ponte mostra hoje.
  assert.equal(r(109).vencimento, '2026-11-01');
  // Categoria, forma de pagamento, comprovante e conta bancária acompanham o lançamento.
  assert.deepEqual([r(101).categoria, r(101).forma_pagamento, r(101).comprovante_url, r(101).conta], ['Mensalidade', 'Pix', 'https://exemplo.test/c1.pdf', U(21)]);
  // Cliente: o par do Vybe OS quando existe; o uuid do Finanças fica sempre. Recorrente só com cliente.
  assert.deepEqual([r(101).cliente_id, r(101).financas_cliente_id, r(101).tipo, r(101).ciclo], ['10', U(1), 'recorrente', 'mensal']);
  assert.deepEqual([r(107).cliente_id, r(107).financas_cliente_id, r(107).tipo], [null, U(4), 'pontual']);       // cliente sem par
  assert.deepEqual([r(108).cliente_id, r(108).financas_cliente_id], ['13', null]);                                  // sem cliente: liga pela descrição, como a tela
  assert.deepEqual([r(112).cliente_id, r(112).financas_cliente_id], [null, U(99)]);                                 // cliente apagado no Finanças
  // Despesa: grupo pela regra das contas, pessoa da folha e cliente da margem.
  assert.deepEqual([c(201).grupo, c(201).equipe], ['folha', U(31)]); assert.deepEqual([c(202).grupo, c(202).equipe], ['folha', null]);
  assert.equal(c(205).grupo, 'imposto'); assert.equal(c(206).grupo, 'fixa'); assert.deepEqual([c(207).cliente_id, c(207).financas_cliente_id], ['10', U(1)]);
  assert.deepEqual(plano.transferencias[0], { origem_financas_id: U(301), descricao: 'Pagamento da fatura do cartão', categoria: 'Transferência', valor: 749.9, forma_pagamento: '',
    comprovante_url: '', conta: U(21), data: '2026-10-25', efetivada_em: '2026-10-25', cancelada: false, conta_destino: U(22) });
  // Contratos: vários por cliente, com título, assinatura, fim, parâmetros e PDF; o status de lá fica guardado.
  const k = plano.contratos.find((x) => x.origem_financas_id === U(51));
  assert.deepEqual([k.cliente_id, k.titulo, k.valor_mensal, k.inicio, k.assinado_em, k.fim, k.dia_vencimento, k.status, k.status_origem, k.parametros, k.pdf_nome],
    ['10', 'Marketing mensal', 2500, '2026-01-10', '2026-01-08', '2027-01-09', 5, 'ativo', 'Ativo', { meses: 12 }, 'aurora.pdf']);
  assert.equal(plano.contratos.filter((x) => x.cliente_id === '10').length, 2);
  assert.deepEqual(plano.contratos.find((x) => x.origem_financas_id === U(53)), { ...plano.contratos.find((x) => x.origem_financas_id === U(53)), cliente_id: null, status: 'encerrado', status_origem: 'Cancelado' });
});

test('cliente sem par vai para a lista do Paulo e nunca vira cliente do Vybe OS; equipe só liga com o nome inteiro igual', async (t) => {
  const { sql, plano } = await cenario(t);
  assert.deepEqual(plano.pendencias.clientes_sem_par.map((c) => c.nome), ['Cliente sem lançamento', 'Restaurante que saiu']);
  assert.deepEqual(plano.pendencias.clientes_por_nome_parecido, [{ financas_nome: 'Serra Azul', vybe_nome: 'Mercado Serra Azul' }]);
  assert.deepEqual(plano.pendencias.clientes_do_vybe_sem_par.map((c) => c.nome), ['Academia Pulso']);
  assert.equal(await contar(sql, 'vybe_clientes'), DEMO_VYBE.clientes.length, 'nenhum cliente criado');
  assert.deepEqual(await sql`SELECT nome, cliente_id::int, ligado_por, decisao FROM vybe_financas_clientes_origem ORDER BY nome`, [
    { nome: 'Cliente sem lançamento', cliente_id: null, ligado_por: '', decisao: 'pendente' }, { nome: 'Clinica Horizonte', cliente_id: 11, ligado_por: 'nome', decisao: 'ligar' },
    { nome: 'Padaria Aurora Ltda', cliente_id: 10, ligado_por: 'cnpj', decisao: 'ligar' }, { nome: 'Restaurante que saiu', cliente_id: null, ligado_por: '', decisao: 'pendente' },
    { nome: 'Serra Azul', cliente_id: 12, ligado_por: 'nome_parecido', decisao: 'ligar' }]);
  // A ligação fica gravada no cliente do Vybe OS (antes era refeita a cada leitura por CNPJ e nome).
  assert.deepEqual(await sql`SELECT id::int, financas_cliente_id::text AS f FROM vybe_clientes ORDER BY id`,
    [{ id: 10, f: U(1) }, { id: 11, f: U(2) }, { id: 12, f: U(3) }, { id: 13, f: null }, { id: 14, f: null }]);
  // "Bruno Costa" × "Bruno Costa Silva" é só sugestão: salário não se liga a pessoa no chute.
  assert.deepEqual(await sql`SELECT nome, pessoa_id::int, salario::float8 AS salario, chave_pix FROM vybe_financas_equipe ORDER BY nome`, [
    { nome: 'Ana Lima', pessoa_id: 3, salario: 3000, chave_pix: 'chave-ana' }, { nome: 'Bruno Costa', pessoa_id: null, salario: 2600, chave_pix: '' },
    { nome: 'Freela Externo', pessoa_id: null, salario: 1500, chave_pix: '' }]);
  assert.deepEqual(plano.pendencias.equipe_sem_par, [{ nome: 'Bruno Costa', sugestao: 'Bruno Costa Silva' }, { nome: 'Freela Externo', sugestao: '' }]);
});

test('gravação só com a variável explícita', async (t) => {
  const { sql, plano } = await cenario(t, { gravado: false });
  assert.equal(podeGravar({}), false); assert.equal(podeGravar({ [VARIAVEL_GRAVAR]: 'sim' }), false); assert.equal(podeGravar(GRAVAR), true);
  await assert.rejects(sql.comTransacao((tx) => gravar(tx, plano, { env: {} })), /Gravação bloqueada/);
  assert.equal(await contar(sql, 'vybe_comercial_recebiveis'), 0);
  assert.equal(await contar(sql, 'vybe_financas_importacoes'), 0);
});

test('idempotência: rodar de novo não duplica; o que mudou ou saiu do Finanças acompanha; o que é do Vybe OS não é tocado', async (t) => {
  const { fin, sql, db, rodar, resultado } = await cenario(t);
  assert.deepEqual([resultado.recebiveis, resultado.contas, resultado.transferencias, resultado.contratos],
    [{ novos: 12, atualizados: 0 }, { novos: 10, atualizados: 0 }, { novos: 1, atualizados: 0 }, { novos: 4, atualizados: 0 }]);
  // Lançamentos e contrato feitos à mão no Vybe OS, ao lado dos importados.
  await db.exec(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, criado_por) VALUES ('pontual', 'Lançado à mão', 321, '2026-11-20', 1);
    INSERT INTO vybe_comercial_contas (grupo, descricao, valor, vencimento, criado_por) VALUES ('fixa', 'Conta à mão', 99, '2026-11-02', 1);
    INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, status) VALUES (13, 700, 'ativo');`);
  const tabelas = ['vybe_comercial_recebiveis', 'vybe_comercial_contas', 'vybe_financas_transferencias', 'vybe_cliente_contratos', 'vybe_financas_equipe', 'vybe_financas_equipe_historico',
    'vybe_financas_assinaturas', 'vybe_financas_contas_bancarias', 'vybe_financas_clientes_origem', 'vybe_financas_orcamento_mensal', 'vybe_financas_fechamentos'];
  const fotos = async () => Object.fromEntries(await Promise.all(tabelas.map(async (x) => [x, await contar(sql, x)])));
  const antes = await fotos();
  const segunda = await rodar();
  assert.equal(novos(segunda.resultado), 0); assert.equal(segunda.resultado.clientes_ligados, 0);
  assert.deepEqual(Object.values(segunda.resultado.removidos).reduce((s, n) => s + n, 0), 0);
  assert.deepEqual(await fotos(), antes);
  // No Finanças: uma baixa, um valor alterado, um lançamento apagado, um funcionário que saiu.
  await fin.db.exec(`UPDATE transactions SET status = 'PAID', paid_date = '2026-11-10' WHERE id = '${U(103)}';
    UPDATE transactions SET amount = 850 WHERE id = '${U(205)}'; DELETE FROM transactions WHERE id = '${U(209)}'; DELETE FROM employees WHERE id = '${U(33)}';`);
  const terceira = await rodar();
  assert.equal(novos(terceira.resultado), 0);
  assert.deepEqual([terceira.resultado.removidos.contas, terceira.resultado.removidos.equipe_inativada, terceira.resultado.removidos.historico], [1, 1, 0]);
  assert.deepEqual(await sql`SELECT to_char(recebido_em, 'YYYY-MM-DD') AS em, valor_recebido::float8 AS v FROM vybe_comercial_recebiveis WHERE origem_financas_id = ${U(103)}`, [{ em: '2026-11-10', v: 2500 }]);
  assert.deepEqual(await sql`SELECT valor::float8 AS v FROM vybe_comercial_contas WHERE origem_financas_id = ${U(205)}`, [{ v: 850 }]);
  assert.deepEqual(await sql`SELECT ativo FROM vybe_financas_equipe WHERE origem_financas_id = ${U(33)}`, [{ ativo: false }]);
  // O que é do Vybe OS continua lá, igual.
  assert.deepEqual(await sql`SELECT descricao, valor::float8 AS v FROM vybe_comercial_recebiveis WHERE origem_financas_id IS NULL`, [{ descricao: 'Lançado à mão', v: 321 }]);
  assert.deepEqual(await sql`SELECT descricao FROM vybe_comercial_contas WHERE origem_financas_id IS NULL`, [{ descricao: 'Conta à mão' }]);
  assert.deepEqual(await sql`SELECT cliente_id::int, valor_mensal::float8 AS v FROM vybe_cliente_contratos WHERE origem_financas_id IS NULL`, [{ cliente_id: 13, v: 700 }]);
  assert.equal(await contar(sql, 'vybe_financas_importacoes'), 3);
  // Origem que chega vazia não apaga o que já foi importado.
  await fin.db.exec('DELETE FROM transactions');
  await assert.rejects(rodar(), /sem nenhum lançamento/);
  assert.equal(await contar(sql, 'vybe_comercial_recebiveis'), 13);
});

test('conferência: as contas de shared/financas-calculos.js dão diferença zero entre a ponte e o banco do Vybe OS', async (t) => {
  const { sql, origem, vybe, plano, ponte } = await cenario(t);
  const antes = await ponte(), depois = await lerBaseLocal(sql), vybeDepois = [...await clientesDoVybe(sql)];
  assert.equal(basesIguais(antes, baseDaOrigem(origem)), true, 'a leitura do importador é a da ponte');
  const c = conferir(antes, depois, vybe, { hoje: HOJE, vybeDepois });
  assert.deepEqual(c.diferencas, []); assert.equal(c.iguais, true); assert.ok(c.contas_feitas >= 30);
  // Números de referência do cenário, iguais nas duas fontes.
  for (const base of [antes, depois]) {
    const out = calc.resumoMes(base.transacoes, base.clientes, '2026-10');
    assert.deepEqual([out.recebido, out.previsto_lancado, out.despesas_pagas, out.mensalidades_sem_lancamento], [4950, 9650.5, 7662.27, 1200]);
    assert.equal(calc.inadimplencia(base.transacoes, HOJE).total, 6700);
    assert.equal(calc.folhaDoMes(base.funcionarios, base.historico, '2026-11').total, 7300);
    assert.equal(calc.custosFixos(base.assinaturas).total, 209.9);
    assert.equal(base.contratos.length, 4);
  }
  // Depois de gravada, a ligação sai do id guardado no cliente, com os mesmos pares.
  const ligAntes = calc.ligarClientes(antes.clientes, vybe), ligDepois = calc.ligarClientes(depois.clientes, vybeDepois);
  assert.deepEqual(ligDepois.ligados.map((l) => l.por), ['id', 'id', 'id']);
  assert.deepEqual(ligDepois.ligados.map((l) => [l.financas_id, l.vybe_id]), ligAntes.ligados.map((l) => [l.financas_id, l.vybe_id]));
  // O recorte da ponte por data (12 meses + pendentes) também bate.
  assert.equal((await lerBaseLocal(sql, { desde: '2026-10-01' })).transacoes.length, 23 - 4);
  // E a conferência enxerga diferença quando ela existe (um centavo, um lançamento a menos, um salário).
  const mexer = (fn) => { const d = structuredClone(depois); fn(d); return conferir(antes, d, vybe, { hoje: HOJE, vybeDepois }); };
  assert.equal(mexer((d) => { d.transacoes.find((x) => x.id === U(105)).amount += 0.01; }).iguais, false);
  assert.equal(mexer((d) => { d.transacoes.splice(d.transacoes.findIndex((x) => x.id === U(107)), 1); }).iguais, false);
  assert.equal(mexer((d) => { d.funcionarios[0].salary += 1; }).iguais, false);
  assert.equal(mexer((d) => { d.contratos[0].amount += 1; }).iguais, false);
  // O relatório sai com o resultado, o antes × depois e as decisões, sem salário de ninguém.
  const texto = relatorio({ modo: 'teste', quando: 'agora', hoje: HOJE, origem, plano, antes, depois, conferencia: c, ponte: { igual: true } });
  assert.match(texto, /Diferença zero/); assert.match(texto, /Restaurante que saiu \(Encerrado\)/); assert.match(texto, /Total em atraso \| R\$\s6\.700,00 \| R\$\s6\.700,00/);
  assert.doesNotMatch(texto, /chave-ana/); assert.doesNotMatch(texto, /3\.000,00/);
});

test('sem acesso a bank_accounts: segue, avisa e guarda só a referência; com o acesso liberado depois, completa', async (t) => {
  const { fin, sql, plano, rodar } = await cenario(t, { sem: ['bank_accounts'] });
  assert.deepEqual(plano.pendencias.sem_acesso, ['bank_accounts']); assert.equal(plano.pendencias.contas_bancarias_sem_nome, 3);
  assert.deepEqual(await sql`SELECT count(*)::int AS n, bool_and(nome_pendente) AS pendentes FROM vybe_financas_contas_bancarias`, [{ n: 3, pendentes: true }]);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_comercial_recebiveis WHERE conta_bancaria_id IS NOT NULL`)[0].n, 6);
  // Mesmo Finanças, agora com a tabela visível: o nome chega e nada é duplicado nem desligado.
  const origem = await lerOrigemDoFinancas(async (texto) => (await fin.db.query(texto)).rows);
  const completo = planejar(origem, { clientesVybe: [...await clientesDoVybe(sql)], pessoasVybe: [] });
  const r = await sql.comTransacao((tx) => gravar(tx, completo, { env: GRAVAR }));
  assert.deepEqual(r.contas_bancarias, { novos: 0, atualizados: 3 });
  assert.deepEqual(await sql`SELECT nome, tipo, nome_pendente, ativo FROM vybe_financas_contas_bancarias ORDER BY nome`, [
    { nome: 'Cartão', tipo: 'cartao_credito', nome_pendente: false, ativo: true }, { nome: 'Conta do Finanças 00000000', tipo: 'corrente', nome_pendente: true, ativo: true },
    { nome: 'Conta principal', tipo: 'corrente', nome_pendente: false, ativo: true }]);
  // Voltando a rodar sem o acesso, o nome que já chegou não é perdido.
  await rodar();
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_financas_contas_bancarias WHERE NOT nome_pendente AND ativo`)[0].n, 2);
});

test('ligação por id gravado vale antes de CNPJ e nome', () => {
  const fin = [{ id: U(1), name: 'Nome Antigo', cnpj: '' }, { id: U(2), name: 'Beta', cnpj: '' }];
  const vybe = [{ id: '10', nome: 'Nome Novo Depois da Troca', cnpj: '', financas_cliente_id: U(1).toUpperCase() }, { id: '11', nome: 'Beta', cnpj: '' }];
  const r = calc.ligarClientes(fin, vybe);
  assert.deepEqual(r.ligados.map((l) => [l.vybe_id, l.por]), [['10', 'id'], ['11', 'nome']]);
  assert.deepEqual(calc.ligarClientes(fin, vybe.map(({ financas_cliente_id, ...v }) => v)).sem_par.map((c) => c.nome), ['Nome Antigo']);
});

test('chave VYBE_FINANCAS_FONTE: padrão é a ponte; "local" lê do banco do Vybe OS com a mesma resposta', async (t) => {
  assert.equal(fonteFinancas({}), 'ponte'); assert.equal(fonteFinancas({ VYBE_FINANCAS_FONTE: '' }), 'ponte'); assert.equal(fonteFinancas({ VYBE_FINANCAS_FONTE: 'outra' }), 'ponte');
  assert.equal(fonteFinancas({ VYBE_FINANCAS_FONTE: ' Local ' }), 'local');
  const { sql, ponte } = await cenario(t);
  assert.equal(conectorDaFonte(sql, { env: {} }).local, undefined); assert.equal(conectorDaFonte(sql, { env: LOCAL, pessoa: dono }).local, true);
  const basePonte = await ponte(), conectorPonte = { configurado: () => true, lerBase: async () => basePonte };
  for (const [parte, mes] of [['comercial', '2026-10'], ['comercial', '2026-11'], ['carteira', '2026-11'], ['rh', '2026-11']]) {
    const pelaPonte = await lerVybeFinancas(sql, dono, { parte, mes }, { conector: conectorPonte, hoje: HOJE });
    const peloVybe = await lerVybeFinancas(sql, dono, { parte, mes }, { env: LOCAL, hoje: HOJE });
    assert.deepEqual([pelaPonte.origem_dados, peloVybe.origem_dados, peloVybe.fonte], ['ponte', 'local', 'Vybe Finanças']);
    assert.deepEqual({ ...peloVybe, origem_dados: '' }, { ...pelaPonte, origem_dados: '' }, `${parte} ${mes}`);
  }
  // As abas do Comercial recebem os mesmos lançamentos, ainda como "fin:" (só leitura).
  const a = await lancamentosDoFinancas(sql, { conector: conectorPonte, hoje: HOJE }), b = await lancamentosDoFinancas(sql, { env: LOCAL, pessoa: dono, hoje: HOJE });
  const ordenar = (l) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(ordenar(b.recebiveis), ordenar(a.recebiveis)); assert.deepEqual(ordenar(b.contas), ordenar(a.contas)); assert.deepEqual(b.porVybe, a.porVybe);
  assert.ok(b.recebiveis.every((r) => /^fin:/.test(r.id)));
});

test('chave em "local" sem importação: avisa em vez de mostrar zero', async (t) => {
  const { sql } = await cenario(t, { gravado: false });
  await assert.rejects(lerBaseLocal(sql), (e) => e.codigo === 'sem_importacao');
  const r = resposta();
  await areaVybeFinancas({ method: 'GET', query: { parte: 'comercial' } }, r, sessao(dono), () => sql, { env: LOCAL, hoje: HOJE });
  assert.equal(r.codigo, 502); assert.equal(r.body.error, MENSAGEM_SEM_IMPORTACAO); assert.equal(r.body.codigo, 'sem_importacao');
  const { db, sql: semMigracao } = await criarVybeDeEnsaio({ ...DEMO_VYBE, comMigracao: false });
  t.after(() => db.close());
  await assert.rejects(lerBaseLocal(semMigracao), (e) => e.codigo === 'sem_importacao');
});

test('regra de dono no servidor: pelo banco do Vybe OS, dinheiro e salário só para os quatro donos', async (t) => {
  const { sql } = await cenario(t);
  const pedir = async (pessoa, parte) => { const r = resposta(); await areaVybeFinancas({ method: 'GET', query: { parte, mes: '2026-11' } }, r, sessao(pessoa), () => sql, { env: LOCAL, hoje: HOJE }); return r; };
  // Dono: tudo.
  assert.equal((await pedir(dono, 'comercial')).codigo, 200);
  const folha = await pedir(dono, 'rh');
  assert.equal(folha.codigo, 200); assert.equal(folha.body.folha.total, 7300); assert.equal(folha.body.folha.funcionarios.length, 3);
  // Administração que não é dono e a equipe: nem dinheiro nem salário.
  for (const pessoa of [administracao, equipe]) {
    const c = await pedir(pessoa, 'comercial'), f = await pedir(pessoa, 'rh');
    assert.equal(c.codigo, 403, pessoa.nome); assert.equal(c.body.error, 'O financeiro é só dos donos.');
    assert.equal(f.codigo, 403, pessoa.nome); assert.equal(f.body.error, 'A folha é só dos donos.');
    // A Carteira continua vendo a lista de contratos, sem nenhum valor.
    const k = await pedir(pessoa, 'carteira');
    assert.equal(k.codigo, 200); assert.equal(k.body.contratos.length, 4); assert.ok(k.body.contratos.every((x) => x.valor === null)); assert.equal(k.body.pode.ver_dinheiro, false);
    assert.equal(await lancamentosDoFinancas(sql, { env: LOCAL, pessoa, hoje: HOJE }), null);
  }
  assert.equal(await lancamentosDoFinancas(sql, { env: LOCAL, hoje: HOJE }), null, 'sem pessoa, nada');
  // A defesa também está na leitura: para quem não é dono a base nem carrega lançamento, equipe, assinatura ou valor.
  for (const pessoa of [administracao, equipe, null]) {
    const base = await criarConectorLocal(sql, { pessoa, env: {} }).lerBase({});
    assert.deepEqual([base.transacoes, base.funcionarios, base.historico, base.assinaturas], [[], [], [], []]);
    assert.ok(base.clientes.every((c) => c.monthly_fee === 0)); assert.ok(base.contratos.every((c) => c.amount === 0)); assert.equal(base.contratos.length, 4);
  }
  assert.equal((await criarConectorLocal(sql, { pessoa: dono, env: {} }).lerBase({})).transacoes.length, 23);
  assert.deepEqual(semDinheiroNemSalario({ clientes: [{ id: 'a', monthly_fee: 9 }], transacoes: [1], funcionarios: [1], historico: [1], assinaturas: [1], contratos: [{ id: 'k', amount: 9 }] }),
    { clientes: [{ id: 'a', monthly_fee: 0 }], transacoes: [], funcionarios: [], historico: [], assinaturas: [], contratos: [{ id: 'k', amount: 0 }] });
  // Dono também por VYBE_DONOS_IDS e pelo id do Monday; nunca pelo nome.
  assert.equal(criarConectorLocal(sql, { pessoa: { id: 77, nome: 'Outro' }, env: { VYBE_DONOS_IDS: '77' } }).dono, true);
  assert.equal(criarConectorLocal(sql, { pessoa: { id: 78, nome: 'Paulo' }, env: {} }).dono, false);
});

test('Comercial com a chave em "local": abas e ações de dinheiro só para os donos; importado é só leitura e nunca aparece em dobro', async (t) => {
  const { sql, db } = await cenario(t);
  await db.exec(`INSERT INTO vybe_comercial_recebiveis (tipo, descricao, valor, vencimento, criado_por) VALUES ('pontual', 'Lançado à mão', 321, '2026-11-20', 1);
    INSERT INTO vybe_comercial_contas (grupo, descricao, valor, vencimento, criado_por) VALUES ('fixa', 'Conta à mão', 99, '2026-11-02', 1);`);
  const chamar = async (pessoa, body = null, query = {}) => { const r = resposta(); await areaComercial({ method: body ? 'POST' : 'GET', body, query }, r, sessao(pessoa), () => sql); return r; };
  const antes = process.env.VYBE_FINANCAS_FONTE, antesUrl = process.env[VARIAVEL];
  t.after(() => { for (const [k, v] of [['VYBE_FINANCAS_FONTE', antes], [VARIAVEL, antesUrl]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  delete process.env[VARIAVEL];

  // Chave na ponte (padrão) e ponte desligada: as abas mostram só o que foi lançado à mão, como sempre, para donos e administração.
  delete process.env.VYBE_FINANCAS_FONTE;
  for (const pessoa of [dono, administracao]) {
    const r = await chamar(pessoa, null, { aba: 'recebimentos', mes: '2026-11' });
    assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.equal(r.body.fonte, 'Vybe OS'); assert.deepEqual(r.body.recebiveis.map((x) => x.descricao), ['Lançado à mão']);
    assert.deepEqual((await chamar(pessoa, null, { aba: 'contas', mes: '2026-11' })).body.contas.map((x) => x.descricao), ['Conta à mão']);
  }
  assert.equal((await chamar(equipe, null, { aba: 'recebimentos' })).codigo, 403);

  // Chave em "local": o histórico importado aparece para o dono, como leitura.
  process.env.VYBE_FINANCAS_FONTE = 'local';
  const rec = await chamar(dono, null, { aba: 'recebimentos', mes: '2026-11' });
  assert.equal(rec.codigo, 200, JSON.stringify(rec.body)); assert.equal(rec.body.fonte, 'Vybe Finanças');
  assert.deepEqual(rec.body.recebiveis.map((x) => x.id).sort(), [`fin:${U(103)}`, `fin:${U(109)}`]);
  const inad = await chamar(dono, null, { aba: 'inadimplencia' });
  assert.equal(inad.body.total, 6700);
  for (const aba of ['financas', 'recebimentos', 'contas', 'inadimplencia', 'caixa']) {
    assert.equal((await chamar(dono, null, { aba })).codigo, 200, aba);
    const r = await chamar(administracao, null, { aba });
    assert.equal(r.codigo, 403, aba); assert.equal(r.body.error, 'O financeiro é só dos donos.');
    assert.equal((await chamar(equipe, null, { aba })).codigo, 403, aba);
  }
  // O que não é dinheiro continua como estava para a administração.
  assert.equal((await chamar(administracao, null, { aba: 'fornecedores' })).codigo, 200);
  assert.equal((await chamar(administracao, null, { aba: 'funil' })).codigo, 200);
  // Escrita de dinheiro: administração sem ser dono não mexe.
  const nova = { acao: 'conta_salvar', grupo: 'fixa', descricao: 'Luz', valor: 200, vencimento: '2026-11-25' };
  assert.equal((await chamar(administracao, nova)).codigo, 403);
  assert.equal((await chamar(administracao, { acao: 'recebivel_cancelar', id: 1 })).codigo, 403);
  assert.equal((await chamar(dono, nova)).codigo, 200);
  // Linha importada não se edita, não se dá baixa e não se cancela, nem pelo id "fin:" nem pelo id interno.
  const [imp] = await sql`SELECT id::text FROM vybe_comercial_recebiveis WHERE origem_financas_id = ${U(103)}`;
  const [impConta] = await sql`SELECT id::text FROM vybe_comercial_contas WHERE origem_financas_id = ${U(204)}`;
  for (const body of [{ acao: 'recebivel_receber', id: `fin:${U(103)}`, valor_recebido: 1, recebido_em: HOJE }, { acao: 'recebivel_receber', id: imp.id, valor_recebido: 1, recebido_em: HOJE },
    { acao: 'recebivel_cancelar', id: imp.id }, { acao: 'recebivel_proximo', id: imp.id }, { acao: 'conta_pagar', id: impConta.id }, { acao: 'conta_cancelar', id: impConta.id },
    { acao: 'conta_salvar', id: impConta.id, grupo: 'fixa', descricao: 'x', valor: 1, vencimento: HOJE }]) {
    const r = await chamar(dono, body); assert.equal(r.codigo, 409, JSON.stringify(body));
  }
  assert.deepEqual(await sql`SELECT recebido_em, cancelado FROM vybe_comercial_recebiveis WHERE origem_financas_id = ${U(103)}`, [{ recebido_em: null, cancelado: false }]);
  // O lançado à mão segue editável.
  const [manual] = await sql`SELECT id::text FROM vybe_comercial_contas WHERE descricao = 'Conta à mão'`;
  assert.equal((await chamar(dono, { acao: 'conta_pagar', id: manual.id, pago_em: HOJE })).codigo, 200);
});

test('Carteira: o contrato lançado à mão segue um por cliente, antes e depois da migração, ao lado dos importados', async (t) => {
  const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Dono Um', admin: true, dono: true } };
  const salvar = async (sql, valor) => { const r = resposta(); await areaCarteira({ method: 'POST', query: {}, body: { acao: 'contrato_salvar', cliente_id: 10, valor_mensal: valor, inicio: '2026-01-01', status: 'ativo' } }, r, paulo, () => sql); return r; };
  for (const comMigracao of [false, true]) {
    const { db, sql } = await criarVybeDeEnsaio({ ...DEMO_VYBE, comMigracao });
    t.after(() => db.close());
    if (comMigracao) await db.query(`INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, status, titulo, origem_financas_id) VALUES (10, 2500, 'ativo', 'Do Finanças', '${U(51)}')`);
    for (const valor of [1000, 1200]) { const r = await salvar(sql, valor); assert.equal(r.codigo, 200, `${comMigracao}: ${JSON.stringify(r.body)}`); }
    const linhas = await sql`SELECT k.valor_mensal::float8 AS v, to_jsonb(k) ->> 'origem_financas_id' AS origem FROM vybe_cliente_contratos k WHERE k.cliente_id = 10 ORDER BY 2 NULLS FIRST`;
    assert.deepEqual(linhas, comMigracao ? [{ v: 1200, origem: null }, { v: 2500, origem: U(51) }] : [{ v: 1200, origem: null }]);
  }
});
