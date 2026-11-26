// O Finanças com tabelas próprias (26/11/2026): a cópia do jsonb, o espelho das escritas, a volta para o jsonb, o OFX do
// Santander, o conferir em lote, o contrato completo, o mês fechado e o "cobrar" que só avisa os donos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import { areaFinanceiro, lerTudo } from '../server/financeiro.js';
import { totaisPorMes, estadoTabelas, esquecerTabelasFinanceiro } from '../server/financeiro-tabelas.js';

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
// O mesmo período em OFX (como o internet banking PJ do Santander exporta), com mais um dia.
const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>033<BRANCHID>0001<ACCTID>99999</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261103
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261010120000[-3:BRT]<TRNAMT>1500.00<FITID>a1<MEMO>PIX RECEBIDO CLIENTE TESTE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261015<TRNAMT>-500.00<FITID>a2<MEMO>PRESTACAO EMPRESTIMO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261030<TRNAMT>-1248.50<FITID>a3<MEMO>PIX ENVIADO VINICIUS</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261030<TRNAMT>-1.50<FITID>a4<MEMO>TARIFA PIX</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261101<TRNAMT>3000.00<FITID>a5<MEMO>LIQUIDACAO BOLETO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-100.00<FITID>a6<MEMO>PIX ENVIADO FULANO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103<TRNAMT>-50.00<FITID>a7<MEMO>PIX ENVIADO POSTO SHELL</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>2600.00<DTASOF>20261103</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const resposta = () => ({ codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', dono: true } };
const outroDono = { tipo: 'sessao', pessoa: { id: 3, nome: 'Ewerton', dono: true } };
const naoDono = { tipo: 'sessao', pessoa: { id: 2, nome: 'Beatriz', admin: true } };
async function banco(t) {
  esquecerTabelasFinanceiro();
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, email text, dono boolean);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo'),(2,'Beatriz'),(3,'Ewerton');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    INSERT INTO vybe_clientes (id,nome) VALUES (1,'Cliente A'),(2,'Cliente B');
    CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, observacao text, atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);
    INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (1, 2000, '2026-01-01');
    CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  return { db, sql };
}
const chamar = async (sql, quem, method, body = null, query = {}) => { const r = resposta(); await areaFinanceiro({ method, body, query }, r, quem, () => sql); return r; };
const semTabelas = () => ({ VYBE_FIN_LER: 'jsonb' });

test('cópia do jsonb para as tabelas: uma vez, idempotente, os totais por mês iguais e o jsonb intacto', async (t) => {
  const { db, sql } = await banco(t);
  // O que já existe em produção: o extrato no jsonb (gravado antes das tabelas existirem).
  const ts = X.transacoesDoCsv(X.lerCsvBB(CSV), []);
  ts[1].real = { ...ts[1].real, partes: [{ valor: 1000, categoria: 'receita_cliente', cliente_id: '1' }, { valor: 500, categoria: 'receita_outra' }] };
  const extrato = { transacoes: ts, importacoes: [{ em: '2026-11-14', novas: 6 }], lixeira: [] };
  await db.query(`INSERT INTO vybe_carteira_config (chave, valor) VALUES ('financeiro_extrato', $1::jsonb), ('financeiro_regras', $2::jsonb), ('financeiro_fixos', $3::jsonb)`,
    [JSON.stringify(extrato), JSON.stringify([{ id: 'p-1', quando: { contem: 'fulano', sinal: 'saida' }, categoria: 'combustivel' }]), JSON.stringify([{ id: 'f-1', nome: 'Internet', valor: 120, dia: 10, categoria: 'estrutura' }])]);
  const antesJsonb = (await db.query(`SELECT valor FROM vybe_carteira_config WHERE chave='financeiro_extrato'`)).rows[0].valor;
  const totaisAntes = totaisPorMes((await lerTudo(sql, { env: semTabelas() })).extrato.transacoes);

  const lido = await lerTudo(sql, { env: {} });
  assert.equal(lido.fonte, 'tabelas');
  const est = await estadoTabelas(sql);
  assert.equal(est.estado, 'ok'); assert.equal(est.linhas.lancamentos, 6); assert.equal(est.linhas.partes, 2); assert.equal(est.linhas.regras, 1); assert.equal(est.linhas.fixos, 1);
  assert.ok(est.copiado_em); assert.equal(est.historico.length, 1);
  assert.deepEqual(totaisPorMes(lido.extrato.transacoes), totaisAntes);
  assert.deepEqual(lido.extrato.transacoes.map((x) => x.id), ts.map((x) => x.id));
  assert.equal(lido.extrato.importacoes.length, 1);
  assert.equal(lido.regras.length, 1); assert.equal(lido.fixos[0].nome, 'Internet');
  // Idempotente: ler de novo não copia de novo.
  await lerTudo(sql, { env: {} });
  assert.equal((await estadoTabelas(sql)).historico.length, 1);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM vybe_fin_lancamentos`)).rows[0].n, 6);
  // O jsonb não foi tocado.
  assert.deepEqual((await db.query(`SELECT valor FROM vybe_carteira_config WHERE chave='financeiro_extrato'`)).rows[0].valor, antesJsonb);
  // As colunas de consulta saem do documento.
  const p = (await db.query(`SELECT cliente_id, valor FROM vybe_fin_lancamento_partes ORDER BY n`)).rows;
  assert.deepEqual(p.map((x) => [x.cliente_id, Number(x.valor)]), [['1', 1000], ['', 500]]);
});

test('espelho: importar, editar, apagar e restaurar gravam no jsonb e nas tabelas; VYBE_FIN_LER=jsonb volta atrás', async (t) => {
  const { db, sql } = await banco(t);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV })).codigo, 200);
  // A primeira escrita veio antes da cópia: a leitura copia e passa a usar as tabelas.
  let g = (await chamar(sql, dono, 'GET')).body;
  assert.equal(g.fonte_dados, 'tabelas'); assert.equal(g.transacoes.length, 6);
  const alvo = g.transacoes.find((x) => x.banco.valor === 3000);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'editar', id: alvo.id, mudanca: { categoria: 'receita_cliente', cliente_id: '1', cliente_nome: 'Cliente A', conferido: true } })).codigo, 200);
  const linha = (await db.query(`SELECT categoria, cliente_id, conferido FROM vybe_fin_lancamentos WHERE id=$1`, [alvo.id])).rows[0];
  assert.deepEqual(linha, { categoria: 'receita_cliente', cliente_id: '1', conferido: true });
  const tira = g.transacoes.find((x) => x.banco.valor === -100);
  await chamar(sql, dono, 'POST', { acao: 'apagar', id: tira.id });
  assert.ok((await db.query(`SELECT apagado_em FROM vybe_fin_lancamentos WHERE id=$1`, [tira.id])).rows[0].apagado_em);
  g = (await chamar(sql, dono, 'GET')).body;
  assert.equal(g.transacoes.length, 5); assert.equal(g.total_apagados, 1);
  await chamar(sql, dono, 'POST', { acao: 'restaurar', id: tira.id });
  assert.equal((await db.query(`SELECT apagado_em FROM vybe_fin_lancamentos WHERE id=$1`, [tira.id])).rows[0].apagado_em, null);
  // Tabelas e jsonb iguais.
  const doJsonb = await lerTudo(sql, { env: semTabelas() }), dasTabelas = await lerTudo(sql, { env: {} });
  assert.equal(doJsonb.fonte, 'jsonb'); assert.equal(dasTabelas.fonte, 'tabelas');
  assert.deepEqual(dasTabelas.extrato.transacoes, doJsonb.extrato.transacoes);
  assert.deepEqual(totaisPorMes(dasTabelas.extrato.transacoes), totaisPorMes(doJsonb.extrato.transacoes));
  // Tabela quebrada (conta não bate): a leitura volta sozinha para o jsonb.
  await db.query(`DELETE FROM vybe_fin_lancamentos WHERE id=$1`, [alvo.id]);
  assert.equal((await lerTudo(sql, { env: {} })).fonte, 'jsonb');
});

test('espelho que falha não perde a escrita: o jsonb fica e as tabelas são refeitas dele', async (t) => {
  const { db, sql } = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  await chamar(sql, dono, 'GET');
  // Quebra o espelho: uma regra de banco que recusa a gravação nas tabelas.
  await db.exec(`ALTER TABLE vybe_fin_regras ADD CONSTRAINT quebra CHECK (pos < 0)`);
  const r = await chamar(sql, dono, 'POST', { acao: 'regra_salvar', regra: { contem: 'fulano', categoria: 'combustivel', sinal: 'saida' }, reaplicar: false });
  assert.equal(r.codigo, 200);
  assert.equal((await estadoTabelas(sql)).estado, 'dessincronizado');
  assert.equal((await lerTudo(sql, { env: semTabelas() })).regras.length, 1);
  await db.exec(`ALTER TABLE vybe_fin_regras DROP CONSTRAINT quebra`);
  const de_novo = await lerTudo(sql, { env: {} });
  assert.equal(de_novo.fonte, 'tabelas'); assert.equal(de_novo.regras.length, 1);
  const est = await estadoTabelas(sql);
  assert.equal(est.estado, 'ok'); assert.match(est.motivo, /refeita/);
});

test('OFX do Santander: lê, e o mesmo período que já veio em CSV não duplica (só o dia novo entra)', async (t) => {
  const l = X.lerExtrato(OFX);
  assert.equal(l.formato, 'ofx'); assert.equal(l.lancamentos.length, 7); assert.equal(l.agencia, '0001'); assert.equal(l.conta, '99999');
  assert.equal(l.lancamentos[l.lancamentos.length - 1].saldo, 2600);
  assert.equal(X.lerExtrato(CSV).formato, 'csv');
  const { sql } = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const previa = (await chamar(sql, dono, 'POST', { acao: 'previa', csv: OFX })).body;
  assert.equal(previa.formato, 'ofx'); assert.equal(previa.novas, 1); assert.equal(previa.de_outro_formato, 6);
  const imp = (await chamar(sql, dono, 'POST', { acao: 'importar', csv: OFX })).body;
  assert.equal(imp.importado.novas, 1); assert.equal(imp.importado.formato, 'ofx');
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'importar', csv: OFX })).body.importado.novas, 0);
  assert.equal((await chamar(sql, dono, 'GET')).body.transacoes.length, 7);
});

test('conferir em lote: muitos de uma vez, cada confirmação vira regra; o lote sugere pelo histórico', async (t) => {
  const { sql } = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const g = (await chamar(sql, dono, 'GET')).body;
  assert.equal(g.analise.lote.length, g.a_revisar);
  const soltos = g.transacoes.filter((x) => !x.real.conferido).slice(0, 3);
  const itens = soltos.map((x) => ({ id: x.id, mudanca: x.banco.valor < 0 ? { categoria: 'outra_saida' } : {} }));
  const r = (await chamar(sql, dono, 'POST', { acao: 'conferir_lote', itens, regras: true })).body;
  assert.equal(r.conferidos, soltos.length, JSON.stringify(r)); assert.ok(r.regras_novas >= 1);
  const h = (await chamar(sql, dono, 'GET')).body;
  assert.equal(h.a_revisar, g.a_revisar - soltos.length); assert.ok(h.regras.length >= 1);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'conferir_lote', itens: [] })).codigo, 400);
});

test('contrato completo: dia do vencimento, fim, reajuste; o previsto usa o dia real', async (t) => {
  const { sql } = await banco(t);
  const ruim = await chamar(sql, dono, 'POST', { acao: 'contrato_salvar', cliente_id: '2', valor_mensal: 1500, dia_vencimento: 40 });
  assert.equal(ruim.codigo, 400);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'contrato_salvar', cliente_id: '2', valor_mensal: 1500, reajuste_pct: 10 })).codigo, 400);
  const ok = await chamar(sql, dono, 'POST', { acao: 'contrato_salvar', cliente_id: '2', valor_mensal: 1500, dia_vencimento: 10, inicio: '2026-06-01', fim: '', reajuste_em: '2027-01-01', reajuste_pct: 8 });
  assert.equal(ok.codigo, 200, JSON.stringify(ok.body));
  await chamar(sql, dono, 'POST', { acao: 'contrato_salvar', cliente_id: '1', valor_mensal: 2000, dia_vencimento: 5, inicio: '2026-01-01', fim: '2026-12-31' });
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const g = (await chamar(sql, dono, 'GET')).body;
  const b = g.clientes.find((c) => c.id === '2');
  assert.equal(b.dia_vencimento, 10); assert.equal(b.reajuste_pct, 8); assert.equal(b.reajuste_em, '2027-01-01'); assert.equal(b.fim, '');
  assert.equal(g.clientes.find((c) => c.id === '1').fim, '2026-12-31');
  const ct = g.analise.contratos.find((c) => c.cliente_id === '2');
  assert.equal(ct.dia_vencimento, 10);
  // A receber: o vencimento é o dia 10 do mês (não o último dia).
  assert.ok(g.analise.aging.itens.filter((i) => i.cliente_id === '2').every((i) => i.vence.endsWith('-10')));
  // Projeção usa o reajuste a partir de janeiro.
  const A = (await import('../shared/financeiro-analises.js')).default;
  assert.equal(A.valorNoMes(ct, '2026-12'), 1500); assert.equal(A.valorNoMes(ct, '2027-01'), 1620);
});

test('mês fechado trava edição até reabrir; cobrar só registra e avisa os donos; metas e orçamento', async (t) => {
  const { db, sql } = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const g = (await chamar(sql, dono, 'GET')).body;
  const out = g.transacoes.find((x) => x.banco.data.startsWith('2026-10'));
  const f = await chamar(sql, dono, 'POST', { acao: 'fechar_mes', mes: '2026-10' });
  assert.equal(f.codigo, 200); assert.equal(f.body.fechamento.situacao, 'fechado'); assert.ok(f.body.fechamento.totais.lancamentos >= 4);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'editar', id: out.id, mudanca: { categoria: 'outra_saida' } })).codigo, 409);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'apagar', id: out.id })).codigo, 409);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'fechar_mes', mes: '2099-01' })).codigo, 400);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'reabrir_mes', mes: '2026-10', motivo: 'faltou um Pix' })).codigo, 200);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'editar', id: out.id, mudanca: { categoria: 'outra_saida' } })).codigo, 200);
  const fech = (await chamar(sql, dono, 'GET')).body.fechamentos['2026-10'];
  assert.equal(fech.situacao, 'reaberto'); assert.equal(fech.historico.length, 2);
  // Orçamento e metas.
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'orcamento_salvar', mes: '2026-10', grupos: { Pessoas: 1000, Operação: 200, Inventado: 5 } })).codigo, 200);
  assert.deepEqual((await chamar(sql, dono, 'POST', { acao: 'orcamento_copiar', de: '2026-10', para: '2026-11', pct: 10 })).body.grupos, { Pessoas: 1100, Operação: 220 });
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'meta_salvar', metas: { mrr: 30000, margem_pct: 20, caixa_minimo: 5000 } })).codigo, 200);
  const h = (await chamar(sql, dono, 'GET')).body;
  assert.equal(h.orcamento['2026-11'].Pessoas, 1100); assert.equal(h.analise.metas.length, 3);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM vybe_financas_orcamento_mensal WHERE categoria LIKE 'grupo:%'`)).rows[0].n, 4);
  assert.equal((await db.query(`SELECT situacao FROM vybe_financas_fechamentos WHERE mes='2026-10'`)).rows[0].situacao, 'reaberto');
  // Cobrar: só os donos, registra o aviso para os outros donos; ninguém fala com cliente.
  await db.exec(`CREATE TABLE IF NOT EXISTS vybe_notificacoes (id serial PRIMARY KEY, pessoa_id bigint, tipo text, titulo text, texto text, link text, criado_em timestamptz DEFAULT now(), lida_em timestamptz, dados jsonb)`);
  const c = await chamar(sql, dono, 'POST', { acao: 'cobrar', cliente_id: '1', cliente_nome: 'Cliente A', atraso_dias: 12 });
  assert.ok([200, 503].includes(c.codigo), JSON.stringify(c.body));
  assert.equal((await chamar(sql, naoDono, 'POST', { acao: 'cobrar', cliente_id: '1', cliente_nome: 'Cliente A' })).codigo, 403);
});

test('acesso: quem não é dono recebe 403 em toda ação nova e na leitura', async (t) => {
  const { sql } = await banco(t);
  assert.equal((await chamar(sql, naoDono, 'GET')).codigo, 403);
  for (const acao of ['conferir_lote', 'fixo_de_lancamento', 'contrato_salvar', 'orcamento_salvar', 'orcamento_copiar', 'fechar_mes', 'reabrir_mes', 'cobrar', 'meta_salvar'])
    assert.equal((await chamar(sql, naoDono, 'POST', { acao })).codigo, 403, acao);
  assert.equal((await chamar(sql, outroDono, 'GET')).codigo, 200);
});

test('fixo a partir de um lançamento: vira gasto fixo ligado; só saída', async (t) => {
  const { sql } = await banco(t);
  await chamar(sql, dono, 'POST', { acao: 'importar', csv: CSV });
  const g = (await chamar(sql, dono, 'GET')).body;
  const sai = g.transacoes.find((x) => x.banco.valor === -500), entra = g.transacoes.find((x) => x.banco.valor > 0);
  assert.equal((await chamar(sql, dono, 'POST', { acao: 'fixo_de_lancamento', id: entra.id })).codigo, 400);
  const r = (await chamar(sql, dono, 'POST', { acao: 'fixo_de_lancamento', id: sai.id, nome: 'Empréstimo', categoria: 'emprestimo' }));
  assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.equal(r.body.fixo.valor, 500); assert.equal(r.body.fixo.dia, 15);
  const h = (await chamar(sql, dono, 'GET')).body;
  assert.equal(h.fixos.length, 1); assert.equal(h.transacoes.find((x) => x.id === sai.id).real.fixo_id, r.body.fixo.id);
});
