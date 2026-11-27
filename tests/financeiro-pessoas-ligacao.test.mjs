// Saída → pessoa (Paulo, 27/11/2026): "no Movimento tem várias saídas já ligadas às pessoas e em Pessoas não consta".
// Causa: Pessoas só contava o pedaço com real.pessoa_id ("Pessoa do time"); o "Pago a" (real.quem), a categoria e o nome
// no Pix não ligavam nada. Aqui a regra única (shared/financeiro-extrato.js › ligadorPessoas), o cliente que não vira
// pessoa, o duplicado que não se junta sozinho, a junção feita por um dono (e o desfazer) e a projeção sem soma dupla.
// SAFE: nomes, valores e extrato INVENTADOS, PGlite em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import A from '../shared/financeiro-analises.js';
import { escreverFinanceiro, lerFinanceiro, contasDasPessoas, juntarNaBase, separarNaBase, quemFicaNaJuncao } from '../server/financeiro.js';

const HOJE = '2026-11-20';
const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Dono Ficticio', dono: true } };
const naoDono = { tipo: 'sessao', pessoa: { id: 7, nome: 'Rita Exemplo Lima', dono: false } };

const PESSOAS = [
  { id: '1', nome: 'Dono Ficticio' }, { id: '7', nome: 'Rita Exemplo Lima' }, { id: '8', nome: 'Ademar Ficticio Santos' },
  { id: '9', nome: 'Otavio Teste Ramos' }, { id: '10', nome: 'Davi Socio Exemplo' },
  { id: '24', nome: 'Caio Modelo Souza Prado' }, { id: '31', nome: 'Caio Prado' },
];
const CLIENTES = [{ id: 'c1', nome: 'Loja Exemplo Modas' }];
let seq = 0;
const lanc = (data, valor, historico, real = {}) => ({ id: `t${++seq}`, banco: { data, historico, valor, saldo: 1000, contraparte: X.contraparte(historico) },
  real: { categoria: 'outra_saida', quem: '', status: 'pago', competencia: data.slice(0, 7), partes: [], conferido: true, pessoa_id: '', ...real } });

test('regra de ligação: à mão, "Pago a" com espaço, nome no extrato, primeiro + último, apelido, não classificado e "não é do time"', () => {
  const lista = [
    lanc('2026-10-05', -2000, 'Pix Enviado Rita Exemplo Lima', { categoria: 'salario' }),            // extrato, nome completo
    lanc('2026-10-06', -300, 'Pix Enviado Rita E Lima', { categoria: 'combustivel' }),                // primeiro + último, reembolso
    lanc('2026-10-07', -500, 'Pix Enviado Zezinho Do Posto', { categoria: 'outra_saida' }),           // apelido do Ademar
    lanc('2026-10-08', -1500, 'Pix Enviado Ademar Ficticio Santos', { categoria: 'outra_saida' }),    // outra_saida → não classificado
    lanc('2026-10-09', -900, 'Pix Enviado Fulano Qualquer', { quem: 'Otavio ' , categoria: 'salario' }), // "Pago a" com espaço
    lanc('2026-10-10', -700, 'Pix Enviado Rita Exemplo Lima', { categoria: 'outra_saida', pessoa_id: X.NAO_PESSOA }), // não é do time
    lanc('2026-10-11', -1200, 'Pagamento Fat.cartao', { categoria: 'cartao_agencia', quem: 'Rita' }),  // transferência: fora
    lanc('2026-10-12', -400, 'Pix Enviado Outra Pessoa', { categoria: 'freela', pessoa_id: '9' }),    // à mão
  ];
  const ligar = X.ligadorPessoas(PESSOAS, { apelidos: { 8: ['Zezinho'] }, clientes: CLIENTES, lista });
  const l = (i) => ligar(lista[i], X.pedacos(lista[i])[0]);
  assert.deepEqual([l(0).pessoa_id, l(0).origem, l(0).tipo], ['7', 'extrato', 'salario']);
  assert.deepEqual([l(1).pessoa_id, l(1).tipo], ['7', 'reembolso']);
  assert.deepEqual([l(2).pessoa_id, l(2).origem], ['8', 'apelido']);
  assert.deepEqual([l(3).pessoa_id, l(3).tipo], ['8', 'nao_classificado']);
  assert.deepEqual([l(4).pessoa_id, l(4).origem], ['9', 'quem']);
  assert.equal(l(5), null);
  assert.equal(l(6), null);
  assert.deepEqual([l(7).pessoa_id, l(7).origem, l(7).tipo], ['9', 'manual', 'freela']);
  // A conta: o não classificado conta no pago (para conferir), o reembolso e o freela aparecem mas não contam.
  const rita = X.contaPessoa(lista, '7', { salario: { valor: 2000 }, ate: '2026-10', ligar });
  assert.equal(rita.meses.at(-1).pago, 2000);
  assert.equal(rita.meses.at(-1).reembolso, 300);
  assert.equal(rita.itens.length, 2);
  const ademar = X.contaPessoa(lista, '8', { ate: '2026-10', ligar });
  assert.equal(ademar.meses.at(-1).pago, 2000);
  assert.equal(ademar.meses.at(-1).pago_nao_classificado, 2000);
  assert.ok(ademar.itens.every((i) => i.conferir && ['apelido', 'extrato'].includes(i.origem)));
  // Sem o ligador, o de antes: só o escolhido à mão.
  assert.equal(X.contaPessoa(lista, '8', { ate: '2026-10' }).itens.length, 0);
});

test('cliente no "Pago a" ou no Pix não vira pessoa; nome que não é do time não liga', () => {
  const lista = [
    lanc('2026-10-05', -800, 'Pix Enviado Rita Exemplo Lima', { quem: 'Loja Exemplo Modas', categoria: 'producao' }),
    lanc('2026-10-06', -800, 'Pix Enviado Loja Exemplo Modas', { categoria: 'outra_saida' }),
    lanc('2026-10-07', -800, 'Pix Enviado Rita Exemplo Lima', { quem: 'Joao Fulano Silva', categoria: 'outra_saida' }),
    lanc('2026-10-08', -800, 'Pix Enviado Dono Calado', { categoria: 'outra_saida' }), // outro sobrenome: não é o Dono Ficticio
  ];
  const ligar = X.ligadorPessoas(PESSOAS, { clientes: CLIENTES, lista });
  for (const t of lista) assert.equal(ligar(t, X.pedacos(t)[0]), null, t.banco.historico);
  const contas = contasDasPessoas({ extrato: { transacoes: lista }, salarios: {}, vales: [] }, PESSOAS, { hoje: HOJE, clientes: CLIENTES.map((c) => ({ cliente_id: c.id, cliente_nome: c.nome })) });
  assert.equal(contas.length, 0);
});

test('sócio com pró-labore em meses diferentes e "Pago a" preenchido (conferido ou não): todos aparecem', () => {
  const lista = ['2026-08-20', '2026-09-20', '2026-10-20', '2026-11-05'].map((d, i) => lanc(d, -1500, 'Pix Enviado Davi Socio', { categoria: 'pro_labore', quem: i % 2 ? 'Davi ' : 'Davi', conferido: i > 1 }));
  const contas = contasDasPessoas({ extrato: { transacoes: lista }, salarios: {}, vales: [] }, PESSOAS, { hoje: HOJE });
  const davi = contas.find((c) => c.pessoa_id === '10');
  assert.equal(davi.itens.length, 4);
  assert.deepEqual(davi.meses.filter((m) => m.pago).map((m) => m.mes), ['2026-08', '2026-09', '2026-10', '2026-11']);
});

test('possível duplicado: o aviso aparece, o nome que bate nas duas vai para a principal e nada é juntado sozinho', async (t) => {
  assert.deepEqual(X.pessoasDuplicadas(PESSOAS).map((d) => d.ids), [['24', '31']]);
  const lista = [lanc('2026-10-05', -1000, 'Pix Enviado Caio', { categoria: 'pro_labore', quem: 'Caio ' }), lanc('2026-10-06', -500, 'Pix Enviado X', { categoria: 'pro_labore', pessoa_id: '31' })];
  const contas = contasDasPessoas({ extrato: { transacoes: lista }, salarios: { 24: { valor: 3000 } }, vales: [] }, PESSOAS, { hoje: HOJE });
  const a = contas.find((c) => c.pessoa_id === '24'), b = contas.find((c) => c.pessoa_id === '31');
  assert.equal(a.itens.length, 1, 'o "Caio " vai para a principal (a que tem combinado)');
  assert.equal(b.itens.length, 1, 'a outra continua com o dela: nada juntou');
  assert.deepEqual(a.duplicados.map((x) => x.pessoa_id), ['31']);
  // Pelo servidor: ler não grava nada (nem junção, nem apelido).
  const { db, sql } = await banco(t);
  const r = await lerFinanceiro(sql, dono, {}, { hoje: HOJE });
  assert.equal(r.pessoas_duplicadas.length, 2, 'Caio e Tito');
  assert.equal(r.pessoas_duplicadas.find((d) => d.ids.includes('24')).fica, '24', 'quem entra no painel fica');
  const { rows } = await db.query("SELECT chave FROM vybe_carteira_config WHERE chave = 'financeiro_pessoas'");
  assert.equal(rows.length, 0);
  const { rows: p } = await db.query('SELECT id, ativo, juntada_em_id FROM vybe_pessoas WHERE id IN (24, 31) ORDER BY id').catch(() => db.query('SELECT id, ativo FROM vybe_pessoas WHERE id IN (24, 31) ORDER BY id'));
  assert.ok(p.every((x) => x.ativo === true && !x.juntada_em_id));
});

test('projeção: o pago que Pessoas mostra sai do variável (o combinado não conta em dobro)', () => {
  const lista = [];
  for (const m of ['2026-08', '2026-09', '2026-10']) {
    lista.push(lanc(`${m}-05`, -2000, 'Pix Enviado Rita Exemplo Lima', { categoria: 'outra_saida' }));   // pelo extrato
    lista.push(lanc(`${m}-06`, -1500, 'Pix Enviado Conta Da Mae', { categoria: 'salario', quem: 'Otavio' })); // pelo "Pago a"
    lista.push(lanc(`${m}-20`, -700, 'Pix Enviado Posto Exemplo', { categoria: 'combustivel' }));
  }
  const salarios = { 7: { valor: 2000 }, 9: { valor: 1500 } };
  const ligar = X.ligadorPessoas(PESSOAS, { lista, salarios });
  const com = A.variaveisDetalhe(lista, ['2026-08', '2026-09', '2026-10'], { salarios, pessoas: PESSOAS, ligar });
  assert.deepEqual(com.total, [700, 700, 700], 'só o combustível fica no variável');
  assert.deepEqual(com.combinados.map((c) => c.situacao), ['identificado', 'identificado']);
  // O mesmo total por Pessoas: o que a projeção identificou é o pago de cada um.
  const contas = contasDasPessoas({ extrato: { transacoes: lista }, salarios, vales: [] }, PESSOAS, { hoje: '2026-10-30', ligar });
  assert.equal(contas.find((c) => c.pessoa_id === '7').meses.find((m) => m.mes === '2026-09').pago, 2000);
  assert.equal(contas.find((c) => c.pessoa_id === '9').meses.find((m) => m.mes === '2026-09').pago, 1500);
  // Somando: variável 700 + combinados 3500 = 4200 por mês, igual ao que saiu.
  assert.equal(com.total[0] + 3500, com.saidas[0]);
});

// ---------- Junção pelo servidor ----------
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function csv(linhas) {
  let saldo = 20000;
  const l = linhas.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0000";CONTA;"00000"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)', ...l.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, email text, senha_hash text);
    INSERT INTO vybe_pessoas (id, nome, email) VALUES (1,'Dono Ficticio','dono@exemplo.test'),(7,'Rita Exemplo Lima',NULL),(24,'Caio Modelo Souza Prado','caio@exemplo.test'),(31,'Caio Prado',NULL),(50,'Tito Exemplo',NULL),(52,'Tito Exemplo',NULL);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  await escreverFinanceiro(sql, dono, { acao: 'importar', csv: csv([['2026-10-05', 'Pix Enviado Caio Prado', -1000], ['2026-10-06', 'Pix Enviado Caio Modelo Souza Prado', -2000], ['2026-10-07', 'Pix Enviado Varios Exemplo', -900]]) });
  return { db, sql };
}

test('junção: só um dono; quem fica é a de mais dados; toda referência muda, a que sai fica marcada e o desfazer volta tudo', async (t) => {
  const { db, sql } = await banco(t);
  const ir = (b, quem = dono) => escreverFinanceiro(sql, quem, b);
  let base = await lerFinanceiro(sql, dono, {}, { hoje: HOJE });
  const [t1, t2, t3] = base.transacoes.slice().sort((a, b) => a.banco.data.localeCompare(b.banco.data));
  // A que vai sair tem: lançamento à mão, uma parte de um Pix dividido, combinado, vale e apelido.
  await ir({ acao: 'editar', id: t1.id, mudanca: { categoria: 'salario', pessoa_id: '31', pessoa_nome: 'Caio Prado' } });
  await ir({ acao: 'editar', id: t3.id, mudanca: { partes: [{ valor: 400, categoria: 'adiantamento', pessoa_id: '31' }, { valor: 500, categoria: 'outra_saida' }] } });
  await ir({ acao: 'salario_salvar', pessoa_id: '31', valor: 2500, desde: '2026-08' });
  await ir({ acao: 'vale_ajuste_salvar', ajuste: { pessoa_id: '31', mes: '2026-10', tipo: 'devolveu', valor: 100 } });
  await ir({ acao: 'pessoa_apelidos_salvar', pessoa_id: '31', apelidos: 'Caiozinho' });

  // Não dono: recusado.
  await assert.rejects(ir({ acao: 'pessoa_juntar', de: '31', para: '24' }, naoDono), (e) => e.status === 403);
  // Direção errada: o 24 tem login, então ele fica.
  await assert.rejects(ir({ acao: 'pessoa_juntar', de: '24', para: '31' }), (e) => e.status === 409 && /Quem fica é Caio Modelo Souza Prado/.test(e.message));
  // Ninguém juntou ainda.
  assert.equal((await db.query("SELECT juntada_em_id FROM vybe_pessoas WHERE id = 31").catch(() => ({ rows: [{}] }))).rows[0].juntada_em_id ?? null, null);

  const r = await ir({ acao: 'pessoa_juntar', de: '31', para: '24' });
  assert.deepEqual([r.juntou.lancamentos, r.juntou.vales, r.juntou.salario_movido], [2, 1, true]);
  base = await lerFinanceiro(sql, dono, {}, { hoje: HOJE });
  const por = new Map(base.transacoes.map((x) => [x.id, x]));
  // jsonb: real.pessoa_id e a parte
  assert.equal(por.get(t1.id).real.pessoa_id, '24');
  assert.equal(por.get(t3.id).real.partes[0].pessoa_id, '24');
  // combinado, vale e apelidos
  assert.equal(base.salarios['24'].valor, 2500); assert.equal(base.salarios['31'], undefined);
  assert.ok(base.vales.every((v) => v.pessoa_id === '24'));
  assert.deepEqual(base.pessoas_extra.apelidos['24'].sort(), ['Caio Prado', 'Caiozinho']);
  assert.equal(base.pessoas_extra.juntadas['31'].para, '24');
  // Pessoas: só uma conta, com tudo; o Pix no nome antigo também liga (pelo nome antigo, agora apelido).
  const contas = base.contas_pessoas.filter((c) => ['24', '31'].includes(c.pessoa_id));
  assert.deepEqual(contas.map((c) => c.pessoa_id), ['24']);
  assert.equal(base.pessoas_duplicadas.length, 1, 'só o par do Tito continua como possível duplicado');
  // vybe_pessoas: marcada e inativa, não apagada
  const { rows: [p31] } = await db.query('SELECT ativo, juntada_em_id FROM vybe_pessoas WHERE id = 31');
  assert.deepEqual([p31.ativo, String(p31.juntada_em_id)], [false, '24']);
  // As tabelas próprias do Financeiro (espelho do jsonb), quando existem
  const { rows: [l1] } = await db.query('SELECT pessoa_id FROM vybe_fin_lancamentos WHERE id = $1', [t1.id]);
  assert.equal(l1.pessoa_id, '24');
  const { rows: [p1] } = await db.query('SELECT pessoa_id FROM vybe_fin_lancamento_partes WHERE lancamento_id = $1 AND n = 0', [t3.id]);
  assert.equal(p1.pessoa_id, '24');
  // Juntar de novo: recusado
  await assert.rejects(ir({ acao: 'pessoa_juntar', de: '31', para: '24' }), (e) => e.status === 409);

  // Desfazer: tudo volta para o 31
  await ir({ acao: 'pessoa_separar', de: '31' });
  base = await lerFinanceiro(sql, dono, {}, { hoje: HOJE });
  const por2 = new Map(base.transacoes.map((x) => [x.id, x]));
  assert.equal(por2.get(t1.id).real.pessoa_id, '31');
  assert.equal(por2.get(t3.id).real.partes[0].pessoa_id, '31');
  assert.equal(por2.get(t2.id).real.pessoa_id, '');
  assert.equal(base.salarios['31'].valor, 2500); assert.equal(base.salarios['24'], undefined);
  assert.ok(base.vales.every((v) => v.pessoa_id === '31'));
  assert.deepEqual(base.pessoas_extra.apelidos['31'], ['Caiozinho']); assert.equal(base.pessoas_extra.apelidos['24'], undefined);
  assert.deepEqual(base.pessoas_extra.juntadas, {});
  assert.equal((await db.query('SELECT pessoa_id FROM vybe_fin_lancamentos WHERE id = $1', [t1.id])).rows[0].pessoa_id, '31');
  assert.equal((await db.query('SELECT pessoa_id FROM vybe_fin_lancamento_partes WHERE lancamento_id = $1 AND n = 0', [t3.id])).rows[0].pessoa_id, '31');
  const { rows: [p31b] } = await db.query('SELECT ativo, juntada_em_id FROM vybe_pessoas WHERE id = 31');
  assert.deepEqual([p31b.ativo, p31b.juntada_em_id], [true, null]);
});

test('junção: as duas com login não juntam; empate sem dados fica o menor id', async (t) => {
  assert.equal(quemFicaNaJuncao({ id: '50', salario: 0, vales: 0, lancamentos: 0, apelidos: 0 }, { id: '52', salario: 0, vales: 0, lancamentos: 0, apelidos: 0 }), '50');
  assert.equal(quemFicaNaJuncao({ id: '50', salario: 0, vales: 0, lancamentos: 0, apelidos: 0 }, { id: '52', salario: 1, vales: 0, lancamentos: 0, apelidos: 0 }), '52');
  const { db, sql } = await banco(t);
  await db.query("UPDATE vybe_pessoas SET email = 'outro@exemplo.test' WHERE id = 31");
  await assert.rejects(escreverFinanceiro(sql, dono, { acao: 'pessoa_juntar', de: '31', para: '24' }), (e) => e.status === 409 && /As duas pessoas entram no painel/.test(e.message));
  // A função pura não depende do banco: o que muda é só do id que sai.
  const a = { extrato: { transacoes: [lanc('2026-10-01', -10, 'x', { pessoa_id: '52' }), lanc('2026-10-02', -10, 'y', { pessoa_id: '7' })] }, salarios: {}, vales: [], pessoas_extra: {} };
  const j = juntarNaBase(a, '52', '50', { nomeDe: 'Tito Exemplo', nomePara: 'Tito Exemplo' });
  assert.deepEqual(j.valores.extrato.transacoes.map((x) => x.real.pessoa_id), ['50', '7']);
  const s = separarNaBase(j.valores, '52');
  assert.deepEqual(s.valores.extrato.transacoes.map((x) => x.real.pessoa_id), ['52', '7']);
});
