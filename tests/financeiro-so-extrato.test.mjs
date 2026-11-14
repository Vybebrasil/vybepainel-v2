// O financeiro só do extrato (Paulo, 14/11/2026: "o financeiro você não vai puxar os dados do Vybe Finanças; os dados são
// só o histórico dos 3 meses que mandei do banco"). Visão geral, Recebimentos, Contas a pagar, Inadimplência,
// Caixa/Projeção, Por cliente, a Folha do RH e a Sobra do mês da Gestão saem do extrato; nenhuma tela chama mais o
// Vybe Finanças. SAFE: extrato INVENTADO no formato do BB, PGlite em memória, nada sai daqui.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import { escreverFinanceiro, lerFinanceiro } from '../server/financeiro.js';

import { lerComercial, escreverComercial } from '../server/comercial.js';
import { baseDoExtrato, lancamentosDaBase, parteDaBase } from '../server/financeiro-fonte.js';
import { estadoNoEcossistema } from '../server/clientes-cadastro.js';

const HOJE = '2026-11-14';
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', dono: true } };
const beatriz = { tipo: 'sessao', pessoa: { id: 6, nome: 'Beatriz', admin: true, dono: false, coordenacao: true } };

// Três meses (agosto a outubro) e o começo de novembro, inventados, do mais novo para o mais antigo como o BB exporta.
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function csvInventado() {
  const ls = [];
  for (const [mes, ate] of [['2026-08', 31], ['2026-09', 30], ['2026-10', 31], ['2026-11', 14]]) {
    const add = (d, h, v) => { if (d <= ate) ls.push([`${mes}-${String(d).padStart(2, '0')}`, h, v]); };
    add(2, 'Rendimento Liquido De Contamax', 2.5);
    add(6, 'Pix Recebido Cliente Alfa Ficticio', 2000);
    if (mes !== '2026-09') add(9, 'Pix Recebido Cliente Beta Ficticio', 1500); // em setembro o Beta não pagou
    add(10, 'Pix Enviado Ewerton Exemplo Socio', -1000);
    add(12, 'Tarifa Avulsa Envio Pix', -2);
    add(15, 'Prest. De Emprest. Financiamento PARC 010/046 1', -500);
    add(20, 'Pagamento Conta Celular Em Canais OPERADORA FICTICIA', -100);
  }
  ls.sort((x, y) => x[0].localeCompare(y[0]));
  let saldo = 1000;
  const linhas = ls.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0000";CONTA;"00000"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
    ...linhas.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY,nome text,ativo boolean, nao_e_cliente boolean DEFAULT false);
    INSERT INTO vybe_pessoas (id,nome,ativo,pode_entrar) VALUES (1,'Paulo Henrique',true,true),(6,'Beatriz',true,true);
    INSERT INTO vybe_clientes (id,nome,ativo) VALUES (10,'Cliente Alfa',true),(11,'Cliente Beta',true),(12,'Cliente Gama',true);`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-carteira.sql', 'utf8'));
  // Contratos do Vybe OS (a mensalidade é o previsto): Alfa 2.000, Beta 1.500; Gama sem contrato.
  await db.exec(`INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (10, 2000, '2026-01-01'), (11, 1500, '2026-01-01');`);
  // Algo lançado à mão nas tabelas antigas: não pode aparecer nas abas (a fonte agora é só o extrato).
  await db.exec(`INSERT INTO vybe_comercial_recebiveis (tipo, cliente_id, descricao, ciclo, valor, vencimento, criado_por) VALUES ('pontual', 12, 'Lançado à mão antigo', 'mensal', 999, '2026-11-05', 1);`);
  // O extrato inventado, importado pela porta de verdade, e o lado real: quem pagou é ligado ao cliente.
  await escreverFinanceiro(sql, paulo, { acao: 'importar', csv: csvInventado() });
  const { transacoes } = await lerFinanceiro(sql, paulo, {}, { hoje: HOJE });
  for (const t of transacoes) {
    const h = t.banco.historico;
    const mudanca = /Alfa/.test(h) ? { categoria: 'receita_cliente', cliente_id: '10', cliente_nome: 'Cliente Alfa' }
      : /Beta/.test(h) ? { categoria: 'receita_cliente', cliente_id: '11', cliente_nome: 'Cliente Beta' }
        : /Ewerton/.test(h) ? { categoria: 'pro_labore', quem: 'Ewerton' } : { };
    await escreverFinanceiro(sql, paulo, { acao: 'editar', id: t.id, mudanca: { ...mudanca, conferido: true } });
  }
  await escreverFinanceiro(sql, paulo, { acao: 'fixo_salvar', fixo: { nome: 'Aluguel da sala', valor: 800, dia: 25, categoria: 'estrutura', forma: 'boleto' } });
  return { db, sql };
}
// O dia fica fixo (14/11/2026) para o teste não mudar com o calendário.
const comercial = async (sql, quem, query) => {
  try { return { codigo: 200, body: await lerComercial(sql, quem.pessoa, query, { hoje: HOJE }) }; }
  catch (e) { if (!e.status) throw e; return { codigo: e.status, body: { error: e.message } }; }
};
const financeiro = async (sql, quem, query) => {
  try { return { codigo: 200, body: await lerFinanceiro(sql, quem, query, { hoje: HOJE }) }; }
  catch (e) { if (!e.status) throw e; return { codigo: e.status, body: { error: e.message } }; }
};
const BRUTO = '2026-11';

test('Visão geral (parte comercial): recebido, previsto, saídas e séries do extrato, com a fonte "Extrato do banco"', async (t) => {
  const { sql } = await banco(t);
  const r = await financeiro(sql, paulo, { parte: 'comercial', mes: '2026-10' });
  assert.equal(r.codigo, 200);
  const d = r.body;
  assert.equal(d.conectado, true); assert.equal(d.fonte, 'Extrato do banco'); assert.equal(d.origem_dados, 'extrato');
  // Outubro: entrou 2.000 (Alfa) + 1.500 (Beta) + 2,50 de rendimento; previsto = as duas mensalidades + o rendimento.
  assert.equal(d.resumo.recebido, 3502.5);
  assert.equal(d.resumo.previsto, 3502.5);
  // Saiu: pró-labore 1.000, tarifa 2, empréstimo 500, celular 100.
  assert.equal(d.resumo.despesas_pagas, 1602);
  assert.equal(d.resumo.resultado, 1900.5);
  assert.equal(d.folha.total, 1000);
  assert.deepEqual(d.series.map((s) => s.mes), ['2026-08', '2026-09', '2026-10']);
  assert.equal(d.series[1].faturamento, 2002.5, 'setembro sem o Beta');
  // Gastos fixos = os cadastrados no Financeiro (não as assinaturas do Finanças).
  assert.equal(d.custos_fixos.total, 800);
  // Inadimplência: a mensalidade de setembro do Beta, vencida no fim do mês.
  assert.equal(d.inadimplencia.total, 1500);
  assert.equal(d.inadimplencia.clientes[0].cliente_nome, 'Cliente Beta');
  assert.equal(d.inadimplencia.clientes[0].cliente_id, '11');
});

test('Recebimentos: mensalidades do contrato com a baixa pelo extrato; o lançado à mão antigo não entra', async (t) => {
  const { sql } = await banco(t);
  const r = await comercial(sql, paulo, { aba: 'recebimentos', mes: '2026-09' });
  assert.equal(r.codigo, 200);
  assert.equal(r.body.fonte, 'Extrato do banco');
  const l = r.body.recebiveis;
  assert.ok(l.every((x) => x.id.startsWith('ext:')), 'tudo vem do extrato');
  const beta = l.find((x) => x.cliente_id === '11');
  assert.equal(beta.tipo, 'recorrente'); assert.equal(beta.valor, 1500); assert.equal(beta.vencimento, '2026-09-30');
  assert.equal(beta.status, 'inadimplente');
  const alfa = l.find((x) => x.cliente_id === '10');
  assert.equal(alfa.status, 'recebido'); assert.equal(alfa.recebido_em, '2026-09-06');
  const nov = await comercial(sql, paulo, { aba: 'recebimentos', mes: BRUTO });
  assert.ok(!nov.body.recebiveis.some((x) => /Lançado à mão antigo/.test(x.descricao)));
  // Novembro: Alfa e Beta pagaram, a vencer nada; o mês atual não é atraso.
  assert.ok(nov.body.recebiveis.filter((x) => x.tipo === 'recorrente').every((x) => x.status === 'recebido'));
});

test('Contas a pagar: saídas do extrato pagas e o fixo do mês que ainda não saiu a pagar', async (t) => {
  const { sql } = await banco(t);
  const r = await comercial(sql, paulo, { aba: 'contas', mes: BRUTO });
  assert.equal(r.codigo, 200);
  const c = r.body.contas;
  assert.ok(c.every((x) => x.id.startsWith('ext:')));
  const aluguel = c.find((x) => x.descricao === 'Aluguel da sala');
  assert.equal(aluguel.pago_em, null); assert.equal(aluguel.vencimento, '2026-11-25'); assert.equal(aluguel.grupo, 'fixa');
  const pro = c.find((x) => x.grupo === 'folha');
  assert.equal(pro.valor, 1000); assert.equal(pro.pago_em, '2026-11-10'); assert.equal(pro.fornecedor_nome, 'Ewerton');
  // Editar ou dar baixa num lançamento do extrato é recusado (confere-se no Extrato).
  const x = await escreverComercial(sql, paulo.pessoa, { acao: 'conta_pagar', id: pro.id }).then(() => ({ codigo: 200, body: {} }), (e) => ({ codigo: e.status, body: { error: e.message } }));
  assert.equal(x.codigo, 409); assert.match(x.body.error, /extrato/);
});

test('Inadimplência, Caixa e Por cliente saem do extrato', async (t) => {
  const { sql } = await banco(t);
  const ina = await comercial(sql, paulo, { aba: 'inadimplencia' });
  assert.equal(ina.body.fonte, 'Extrato do banco');
  assert.equal(ina.body.total, 1500);
  assert.equal(ina.body.clientes[0].cliente_nome, 'Cliente Beta');
  const cx = await comercial(sql, paulo, { aba: 'caixa' });
  assert.equal(cx.body.fonte, 'Extrato do banco');
  assert.equal(cx.body.extrato.lancamentos > 0, true);
  // Saldo de hoje = o último saldo do extrato; a projeção usa a média dos meses fechados.
  const ultimo = (await lerFinanceiro(sql, paulo, {}, { hoje: HOJE })).transacoes.at(-1).banco.saldo;
  assert.equal(cx.body.extrato.projecao.saldo_hoje, ultimo);
  const p = X.projetar(cx.body.extrato.projecao, {}, 3);
  assert.equal(p.meses.length, 3);
  const pc = await comercial(sql, paulo, { aba: 'financas' });
  assert.equal(pc.body.fonte, 'Extrato do banco');
  const beta = pc.body.clientes.find((c) => c.cliente_id === '11');
  assert.equal(beta.valor_mensal, 1500, 'a mensalidade é a do contrato do Vybe OS');
  assert.equal(beta.status_pagamento, 'inadimplente', 'setembro em aberto há mais de 30 dias');
  assert.equal(pc.body.clientes.find((c) => c.cliente_id === '10').status_pagamento, 'em_dia');
});

test('Folha do RH (parte rh) e a Sobra do mês da Gestão pelo extrato', async (t) => {
  const { sql } = await banco(t);
  const rh = await financeiro(sql, paulo, { parte: 'rh', mes: '2026-10' });
  assert.equal(rh.body.folha.total, 1000);
  assert.equal(rh.body.folha.funcionarios[0].nome, 'Ewerton');
  assert.equal(rh.body.folha.funcionarios[0].dia_pagamento, 10);
  // Gestão: a Sobra do mês é o resumo do extrato (entrou − saiu), a mesma conta da tela.
  const tudo = await financeiro(sql, paulo, {});
  const r = X.resumo(tudo.body.transacoes, { mes: '2026-10' });
  assert.equal(r.resultado, 1900.5);
});

test('só os quatro donos: a coordenação não recebe nada de dinheiro', async (t) => {
  const { sql } = await banco(t);
  for (const q of [{ parte: 'comercial' }, { parte: 'rh' }, {}]) assert.equal((await financeiro(sql, beatriz, q)).codigo, 403);
  for (const aba of ['financas', 'recebimentos', 'contas', 'inadimplencia', 'caixa']) assert.equal((await comercial(sql, beatriz, { aba })).codigo, 403, aba);
});

test('sem extrato importado: vazio honesto, com o passo para importar', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text); INSERT INTO vybe_pessoas VALUES (1,'Paulo');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY, valor jsonb NOT NULL, atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);`);
  const r = await financeiro(sql, paulo, { parte: 'comercial' });
  assert.equal(r.codigo, 200);
  assert.equal(r.body.conectado, false);
  assert.match(r.body.motivo, /extrato/i);
  assert.ok(r.body.passos.length);
});

test('funções puras: partes divididas, marcado em aberto e nada inventado fora do extrato', () => {
  const t = (id, data, valor, real) => ({ id, banco: { data, historico: 'x', valor, saldo: null }, real: { categoria: 'a_classificar', status: 'pago', competencia: data.slice(0, 7), partes: [], conferido: true, ...real } });
  const base = { extrato: { transacoes: [
    // Um boleto de 3.000 dividido entre Alfa (2.000) e Beta (1.000) da competência de outubro, pago em novembro.
    t('b1', '2026-11-03', 3000, { categoria: 'receita_boleto', partes: [{ valor: 2000, categoria: 'receita_cliente', cliente_id: '10', cliente_nome: 'Alfa', competencia: '2026-10' }, { valor: 1000, categoria: 'receita_cliente', cliente_id: '11', cliente_nome: 'Beta', competencia: '2026-10' }] }),
    // Aporte de sócio entra no caixa mas não é receita.
    t('a1', '2026-10-05', 5000, { categoria: 'aporte_socio' }),
  ] }, fixos: [], cartao: [] };
  const clientes = [{ cliente_id: '10', cliente_nome: 'Alfa', valor_mensal: 2000, ativo: true, inicio: '2026-01-01' }, { cliente_id: '11', cliente_nome: 'Beta', valor_mensal: 1500, ativo: true, inicio: '2026-01-01' }];
  const b = baseDoExtrato(base, clientes, { hoje: '2026-11-14' });
  const { recebiveis } = lancamentosDaBase(b);
  // Beta pagou 1.000 de 1.500 em outubro: fica 500 em aberto daquele mês; novembro ainda a vencer.
  const betaOut = recebiveis.filter((r) => r.cliente_id === '11' && r.vencimento === '2026-10-31');
  assert.equal(betaOut.reduce((s, r) => s + r.valor, 0), 1500);
  assert.equal(betaOut.reduce((s, r) => s + r.valor_recebido, 0), 1000);
  assert.ok(!recebiveis.some((r) => /aporte/i.test(r.categoria)), 'aporte não é recebimento de cliente');
  const vis = parteDaBase('comercial', b, { mes: '2026-10', hoje: '2026-11-14' });
  assert.equal(vis.resumo.recebido, 0, 'em outubro não entrou receita (o boleto entrou em novembro)');
  assert.equal(vis.resumo.previsto, 3500, 'previsto de outubro = as duas mensalidades');
  // Antes do primeiro mês do extrato não há previsto inventado.
  assert.ok(!recebiveis.some((r) => r.vencimento < '2026-10-01'));
});

test('as telas não chamam mais o Vybe Finanças e o menu não tem mais o link', () => {
  const ler = (f) => readFileSync(f, 'utf8');
  for (const f of ['vybe-mundo-financas.js', 'vybe-mundo-setor.js', 'vybe-mundo-comercial.js', 'vybe-mundo-carteira.js', 'vybe-mundo-pessoas.js', 'vybe-mundo.js', 'vybe-clientes-ficha.js', 'vybe-clientes.js'])
    assert.ok(!/area=vybe_financas/.test(ler(f)), f);
  assert.ok(!/vybe-financas\.vercel\.app/.test(ler('vybe-mundo.js')));
  assert.ok(!/vybe-financas\.vercel\.app/.test(ler('mundo/planta.mjs')));
  assert.ok(!/Com o Vybe Finanças ligado/.test(ler('vybe-mundo-comercial.js') + ler('vybe-mundo-setor.js') + ler('vybe-mundo-financas.js')));
  assert.ok(!/fonte: Vybe Finanças/.test(ler('vybe-mundo-financas.js') + ler('vybe-mundo-comercial.js') + ler('vybe-mundo-pessoas.js')));
  assert.match(ler('vybe-mundo-financas.js'), /area=financeiro&parte=/);
  // A ficha do cliente não mostra mais a linha do Vybe Finanças no ecossistema.
  const linhas = estadoNoEcossistema({ cliente: { id: 1, nome: 'X', ativo: true, cadastro: {} }, acesso: null, financas: null, hubUrl: '', criaNoFinancas: false });
  assert.ok(!linhas.some((l) => l.id === 'financas'));
});
