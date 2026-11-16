// Paulo, 15/11/2026: "fui adicionar uma conta a pagar… não devia me perguntar se era conta fixa?" e "não tem como apagar
// um lançamento". Lançar à mão com "Repete todo mês?" cadastra o gasto fixo ligado ao lançamento; apagar manda para a
// lixeira (restaurar devolve) e o do banco não volta ao reimportar. SAFE: extrato INVENTADO, PGlite em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { escreverFinanceiro, lerFinanceiro } from '../server/financeiro.js';

const HOJE = '2026-11-15';
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', dono: true } };
const ana = { tipo: 'sessao', pessoa: { id: 7, nome: 'Ana Ficticia', dono: false } };
const CSV = ['AGENCIA;"0000";CONTA;"00000"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
  '"12/11/2026";"Pix Enviado Posto Ficticio";"";"-150,00";"850,00"',
  '"10/11/2026";"Pix Recebido Cliente Ficticio";"";"1.000,00";"1.000,00"'].join('\r\n');

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo Henrique'),(7,'Ana Ficticia');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  await escreverFinanceiro(sql, paulo, { acao: 'importar', csv: CSV });
  return sql;
}
const ler = (sql) => lerFinanceiro(sql, paulo, {}, { hoje: HOJE });

test('lançar à mão com "repete todo mês": vira gasto fixo ligado ao lançamento; sem a pergunta, não', async (t) => {
  const sql = await banco(t);
  const r = await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: '1.200,00', data: '2026-11-05', categoria: 'estrutura', texto: 'Aluguel da sala', status: 'nao_pago' },
    fixo: { repete: true, forma: 'boleto' } });
  assert.equal(r.fixo.nome, 'Aluguel da sala');
  assert.equal(r.fixo.valor, 1200);
  assert.equal(r.fixo.dia, 5, 'sem dia informado, vence no dia do lançamento');
  assert.equal(r.fixo.forma, 'boleto');
  assert.equal(r.fixo.inicio, '2026-11');
  const d = await ler(sql);
  assert.equal(d.fixos.length, 1);
  const tr = d.transacoes.find((x) => x.id === r.transacao.id);
  assert.equal(tr.real.fixo_id, r.fixo.id, 'o lançamento é o pagamento do fixo neste mês');
  assert.equal(tr.real.status, 'nao_pago');

  await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 40, data: '2026-11-06', categoria: 'alimentacao', texto: 'Lanche' } });
  assert.equal((await ler(sql)).fixos.length, 1, 'só vira fixo quando a pessoa responde que repete');
  // Entrada nunca vira gasto fixo, e conta fixa sem categoria pede a categoria.
  await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'entrada', valor: 10, data: '2026-11-06', categoria: 'outra_entrada', texto: 'x' }, fixo: { repete: true } });
  assert.equal((await ler(sql)).fixos.length, 1);
  await assert.rejects(escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 99, data: '2026-11-06', categoria: 'a_classificar', texto: 'Programa' }, fixo: { repete: true } }), /categoria/);
});

test('apagar vai para a lixeira, restaurar devolve, e o do banco não volta ao reimportar', async (t) => {
  const sql = await banco(t);
  const antes = await ler(sql);
  const posto = antes.transacoes.find((x) => /Posto/.test(x.banco.historico));
  await escreverFinanceiro(sql, paulo, { acao: 'apagar', id: posto.id });
  let d = await ler(sql);
  assert.equal(d.transacoes.length, antes.transacoes.length - 1);
  assert.equal(d.apagados.length, 1);
  assert.equal(d.apagados[0].apagado_por, 'Paulo Henrique');
  assert.equal(d.apagados[0].do_banco, true);

  const previa = await escreverFinanceiro(sql, paulo, { acao: 'previa', csv: CSV });
  assert.equal(previa.novas, 0, 'a prévia não oferece o apagado de novo');
  const imp = await escreverFinanceiro(sql, paulo, { acao: 'importar', csv: CSV });
  assert.equal(imp.importado.novas, 0);
  assert.equal(imp.importado.repetidas, 2);
  assert.equal((await ler(sql)).transacoes.length, antes.transacoes.length - 1, 'reimportar não traz o apagado de volta');

  await escreverFinanceiro(sql, paulo, { acao: 'restaurar', id: posto.id });
  d = await ler(sql);
  assert.equal(d.transacoes.length, antes.transacoes.length);
  assert.deepEqual(d.transacoes.find((x) => x.id === posto.id).real, posto.real, 'volta igual ao que era');
  assert.equal(d.apagados.length, 0);
  await assert.rejects(escreverFinanceiro(sql, paulo, { acao: 'restaurar', id: posto.id }), /lixeira/);
  await assert.rejects(escreverFinanceiro(sql, paulo, { acao: 'apagar', id: 'nao-existe' }), /não encontrado/);
});

test('apagar o lançado à mão desliga a proposta; restaurar religa', async (t) => {
  const sql = await banco(t);
  const r = await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 86, data: '2026-11-14', categoria: 'alimentacao', texto: 'Almoço' } });
  await escreverFinanceiro(sql, paulo, { acao: 'apagar', id: r.transacao.id });
  let p = (await ler(sql)).vorcaro.propostas.find((x) => x.texto === 'Almoço');
  assert.equal(p.estado, 'descartada');
  assert.equal(p.transacao_id, '');
  await escreverFinanceiro(sql, paulo, { acao: 'restaurar', id: r.transacao.id });
  p = (await ler(sql)).vorcaro.propostas.find((x) => x.texto === 'Almoço');
  assert.equal(p.estado, 'lancada');
  assert.equal(p.transacao_id, r.transacao.id);
});

test('como o dinheiro passou: do histórico no extrato, escolhido à mão; quem lançou fica registrado', async (t) => {
  const sql = await banco(t);
  let d = await ler(sql);
  assert.equal(d.transacoes.find((x) => /Posto/.test(x.banco.historico)).real.forma, 'pix', 'Pix Enviado vira Pix');
  const posto = d.transacoes.find((x) => /Posto/.test(x.banco.historico));
  await escreverFinanceiro(sql, paulo, { acao: 'editar', id: posto.id, mudanca: { forma: 'cartao' } });
  await assert.rejects(escreverFinanceiro(sql, paulo, { acao: 'editar', id: posto.id, mudanca: { forma: 'cheque' } }), /Forma/);
  const r = await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 300, data: '2026-11-08', categoria: 'estrutura', texto: 'Internet', forma: 'boleto', quem: 'Operadora' }, fixo: { repete: true } });
  assert.equal(r.fixo.forma, 'boleto', 'a conta fixa paga do mesmo jeito do lançamento');
  d = await ler(sql);
  assert.equal(d.transacoes.find((x) => x.id === posto.id).real.forma, 'cartao');
  const mao = d.transacoes.find((x) => x.id === r.transacao.id);
  assert.equal(mao.real.forma, 'boleto');
  assert.equal(mao.real.lancado_por, 'Paulo Henrique');
  assert.equal(mao.real.quem, 'Operadora');
  const sem = await escreverFinanceiro(sql, paulo, { acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 20, data: '2026-11-08', categoria: 'alimentacao', texto: 'Café' } });
  assert.equal(sem.transacao.real.forma, 'dinheiro', 'à mão sem escolher = dinheiro');
});

test('só os donos apagam', async (t) => {
  const sql = await banco(t);
  const id = (await ler(sql)).transacoes[0].id;
  await assert.rejects(escreverFinanceiro(sql, ana, { acao: 'apagar', id }), (e) => e.status === 403);
});
