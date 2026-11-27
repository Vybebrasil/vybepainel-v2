// Importar extrato (Paulo, 27/11/2026: jogou o OFX do Santander e um Excel no Finanças e "não aconteceu nada"). A prévia
// aparece por cima da tela de onde o botão foi tocado (o Hoje incluído), o .xlsx entra lido no navegador sem pacote, o
// .xls antigo vira mensagem, o FITID do OFX (que muda a cada exportação) não vira lançamento novo e o CSV seguido do OFX
// não duplica. SAFE: extratos INVENTADOS, PGlite em memória, vm sem navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import X from '../shared/financeiro-extrato.js';
import { areaFinanceiro, montar } from '../server/financeiro.js';
import { esquecerTabelasFinanceiro } from '../server/financeiro-tabelas.js';

const HOJE = '2026-11-27';
const CSV = ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
  '"12/11/2026";"Pix Enviado Fulano Exemplo";"";"-300,00";"4.700,00"', '"12/11/2026";"Pix Enviado Fulano Exemplo";"";"-300,00";"5.000,00"',
  '"10/11/2026";"Pix Recebido Cliente Teste";"";"1.800,00";"5.300,00"', '"03/11/2026";"Pagto Boleto Aluguel Sala";"";"-3.200,00";"3.500,00"',
  '"15/10/2026";"Pix Recebido Cliente Teste";"";"4.000,00";"6.700,00"', '"10/10/2026";"Pagto Boleto Aluguel Sala";"";"-3.200,00";"2.700,00"',
  '"01/10/2026";"Pix Recebido Cliente Teste";"";"5.900,00";"5.900,00"'].join('\r\n');
// O mesmo período em OFX do Santander, com histórico diferente, CHECKNUM zerado, o FITID com a hora da exportação no fim
// e mais três dias depois do CSV.
const OFX = (hora) => {
  const l = [['20261001', '5900,00', 'Pix Recebido 00011122000133'], ['20261010', '-3200,00', 'Pagamento De Boleto Aluguel'], ['20261015', '4000,00', 'Pix Recebido 00011122000133'],
    ['20261103', '-3200,00', 'Pagamento De Boleto Aluguel'], ['20261110', '1800,00', 'Pix Recebido 00011122000133'], ['20261112', '-300,00', 'Pix Enviado Fulano Exemplo'],
    ['20261112', '-300,00', 'Pix Enviado Fulano Exemplo'], ['20261118', '-120,00', 'Tarifa Pacote'], ['20261120', '2500,00', 'Pix Recebido 00011122000133'], ['20261126', '-80,00', 'Pix Enviado Posto Exemplo']];
  return `OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>033<ACCTID>99999</BANKACCTFROM><BANKTRANLIST>\n${l.map(([d, v, m], i) => `<STMTTRN><TRNTYPE>X<DTPOSTED>${d}000000[-3:GMT]<TRNAMT>${v}<FITID>9999000${hora}${i}<CHECKNUM>00000000<PAYEEID>0<MEMO>${m}</STMTTRN>`).join('\n')}\n</BANKTRANLIST><LEDGERBAL><BALAMT>6700,00<DTASOF>20261126</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
};

// ---------- um .xlsx mínimo escrito à mão (zip com deflate do zlib) ----------
function crc32(b) { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function zip(arquivos) {
  const locais = [], central = [];
  let pos = 0;
  for (const [nome, texto, guardar] of arquivos) {
    const cru = Buffer.from(texto, 'utf8'), dados = guardar ? cru : zlib.deflateRawSync(cru), n = Buffer.from(nome), crc = crc32(cru), metodo = guardar ? 0 : 8;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(metodo, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(dados.length, 18); h.writeUInt32LE(cru.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(metodo, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(dados.length, 20); c.writeUInt32LE(cru.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(pos, 42);
    locais.push(h, n, dados); central.push(c, n); pos += 30 + n.length + dados.length;
  }
  const cd = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10); fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  return new Uint8Array(Buffer.concat([...locais, cd, fim]));
}
// O cabeçalho na linha 4 e a partir da coluna B, a data como número do Excel, crédito e débito separados, um texto
// inline, um &amp; e uma linha vazia no meio.
const COMPART = ['Extrato de conta corrente', 'Agência', '0001', 'Conta', '99999', 'Data', 'Descrição', 'Docto', 'Crédito (R$)', 'Débito (R$)', 'Saldo (R$)', 'Pix Recebido Cliente &amp; Filho', 'Tarifa Pacote'];
const SHEET = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>
<row r="1"><c r="B1" t="s"><v>0</v></c></row>
<row r="2"><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c><c r="D2" t="s"><v>3</v></c><c r="E2" t="s"><v>4</v></c></row>
<row r="4"><c r="B4" t="s"><v>5</v></c><c r="C4" t="s"><v>6</v></c><c r="D4" t="s"><v>7</v></c><c r="E4" t="s"><v>8</v></c><c r="F4" t="s"><v>9</v></c><c r="G4" t="s"><v>10</v></c></row>
<row r="5"><c r="B5" s="1"><v>46327</v></c><c r="C5" t="s"><v>11</v></c><c r="D5"><v>123</v></c><c r="E5"><v>1500.5</v></c><c r="G5"><v>1500.5</v></c></row>
<row r="6"/>
<row r="7"><c r="B7" t="inlineStr"><is><t>18/11/2026</t></is></c><c r="C7" t="s"><v>12</v></c><c r="F7"><v>12.9</v></c><c r="G7"><v>1487.6</v></c></row>
</sheetData></worksheet>`;
const XLSX = (guardar = false) => zip([['[Content_Types].xml', '<Types/>', true], ['xl/workbook.xml', '<workbook/>', guardar],
  ['xl/sharedStrings.xml', `<sst>${COMPART.map((s, i) => (i === 6 ? `<si><r><t>Descri</t></r><r><t>ção</t></r></si>` : `<si><t>${s}</t></si>`)).join('')}</sst>`, guardar],
  ['xl/worksheets/sheet1.xml', SHEET, guardar]]);

test('Excel (.xlsx): lido sem pacote, com o cabeçalho em qualquer linha, data do Excel e crédito/débito separados', async () => {
  for (const guardar of [false, true]) {
    const csv = await X.textoDoExtrato(XLSX(guardar), 'extrato.xlsx');
    const l = X.lerExtrato(csv);
    assert.equal(l.formato, 'csv'); assert.equal(l.agencia, '0001'); assert.equal(l.conta, '99999');
    assert.equal(l.lancamentos.length, 2, csv);
    assert.deepEqual(l.lancamentos.map((x) => [x.data, x.historico, x.valor, x.saldo]), [['2026-11-01', 'Pix Recebido Cliente & Filho', 1500.5, 1500.5], ['2026-11-18', 'Tarifa Pacote', -12.9, 1487.6]]);
    assert.equal(l.lancamentos[0].documento, '123');
  }
  // A tabela HTML com nome .xls (o "Excel" de alguns bancos) também entra.
  const html = '<html><table><tr><td>Data</td><td>Histórico</td><td>Valor</td></tr><tr><td>05/11/2026</td><td>Pix&nbsp;Recebido</td><td>-1.200,00</td></tr></table></html>';
  assert.deepEqual(X.lerExtrato(await X.textoDoExtrato(new TextEncoder().encode(html), 'extrato.xls')).lancamentos.map((x) => [x.data, x.historico, x.valor]), [['2026-11-05', 'Pix Recebido', -1200]]);
});

test('arquivo que não dá: Excel antigo, vazio, PDF, binário e planilha sem cabeçalho viram frase clara', async () => {
  const falha = (bytes, nome, re) => assert.rejects(X.textoDoExtrato(bytes, nome), re);
  await falha(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]), 'extrato.xls', /Esse Excel antigo não dá para ler; exporte em OFX ou CSV/);
  await falha(new Uint8Array(0), 'extrato.ofx', /vazio/);
  await falha(new TextEncoder().encode('   \r\n'), 'extrato.csv', /vazio/);
  await falha(new TextEncoder().encode('%PDF-1.4 ...'), 'extrato.pdf', /PDF/);
  await falha(new Uint8Array([1, 0, 2, 0, 3, 0, 65, 66]), 'coisa.bin', /Não reconheço esse arquivo/);
  await falha(zip([['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Nada aqui</t></is></c></row></sheetData></worksheet>']]), 'x.xlsx', /cabeçalho com Data, Histórico e Valor/);
  // O texto normal (OFX, CSV) passa como está.
  assert.equal(await X.textoDoExtrato(new TextEncoder().encode(CSV), 'a.csv'), CSV);
});

test('FITID: o mesmo OFX exportado de novo (outra hora no FITID) dá os mesmos ids e não duplica', () => {
  const a = X.lerExtrato(OFX('20261127015248')), b = X.lerExtrato(OFX('20261127093011'));
  assert.notEqual(OFX('20261127015248'), OFX('20261127093011'));
  const ia = X.idsDosLancamentos(a.lancamentos), ib = X.idsDosLancamentos(b.lancamentos);
  assert.deepEqual(ia, ib);
  assert.equal(new Set(ia).size, ia.length, 'os dois Pix iguais do mesmo dia continuam dois');
  const m = X.mesclar(X.transacoesDoCsv(a, []), X.transacoesDoCsv(b, []));
  assert.equal(m.novas, 0); assert.equal(m.repetidas, 10);
  // Sem CHECKNUM, também não usa o FITID.
  const semCheck = (h) => X.idsDosLancamentos(X.lerExtrato(OFX(h).replace(/<CHECKNUM>0+/g, '')).lancamentos);
  assert.deepEqual(semCheck('1'), semCheck('2'));
});

async function banco(t) {
  esquecerTabelasFinanceiro();
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, email text, dono boolean);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, observacao text, atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);
    CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  return sql;
}
const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', dono: true } };
const chamar = async (sql, body) => { const r = { codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } }; await areaFinanceiro({ method: body ? 'POST' : 'GET', body, query: {} }, r, dono, () => sql); return r; };

test('CSV seguido do OFX: só os dias novos entram; o período em comum casa pelo outro formato; reexportar não duplica', async (t) => {
  const sql = await banco(t);
  assert.equal((await chamar(sql, { acao: 'importar', csv: CSV })).body.importado.novas, 7);
  const p = (await chamar(sql, { acao: 'previa', csv: OFX('20261127015248') })).body;
  assert.equal(p.formato, 'ofx'); assert.equal(p.novas, 3); assert.equal(p.repetidas, 7); assert.equal(p.de_outro_formato, 7);
  assert.deepEqual(p.transacoes.filter((x) => !x.ja_importada).map((x) => x.banco.data), ['2026-11-18', '2026-11-20', '2026-11-26']);
  assert.equal((await chamar(sql, { acao: 'importar', csv: OFX('20261127015248') })).body.importado.novas, 3);
  // O Paulo exporta de novo amanhã: o FITID muda, nada entra.
  const de_novo = (await chamar(sql, { acao: 'importar', csv: OFX('20261128101500') })).body.importado;
  assert.equal(de_novo.novas, 0); assert.equal(de_novo.repetidas, 10);
  // E o CSV antigo de novo também não.
  assert.equal((await chamar(sql, { acao: 'importar', csv: CSV })).body.importado.novas, 0);
  assert.equal((await chamar(sql, null)).body.transacoes.length, 10);
});

// ---------- a tela ----------
function telas() {
  const CORE = readFileSync('vybe-core.js', 'utf8');
  const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
  const ctx = vm.createContext({ console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout, CSS: { escape: (s) => s } }); ctx.window = ctx;
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  for (const f of ['shared/financeiro-extrato.js', 'shared/financeiro-analises.js', 'vybe-graficos.js', 'vybe-mundo-financeiro.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
  return ctx.VybeFinanceiro;
}
const dados = () => montar({ extrato: { transacoes: X.transacoesDoCsv(X.lerCsvBB(CSV), []), importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [] }, [], { mes: '', hoje: HOJE });

test('a prévia aparece por cima do Hoje (o botão do "Extrato parado"), do Movimento e do Extrato; o erro também', () => {
  const V = telas(), d = dados(), ui = V._teste.ui, ctx = { d, filtro: {} };
  let hoje = V.telas.fin_hoje(ctx);
  assert.match(hoje, /aria-label="Extrato parado"[\s\S]*data-fx-arquivo/, 'o cartão Extrato parado tem o botão');
  assert.match(hoje, /accept="\.ofx,\.csv,\.xlsx,\.xls,/, 'aceita Excel');
  assert.match(hoje, /<b>CSV<\/b> ou <b>Excel \(\.xlsx\)<\/b>/);
  assert.doesNotMatch(hoje, /class="fe-imp"/, 'sem arquivo, sem janela');
  // Escolheu o arquivo: na hora, "Lendo o extrato…".
  ui.extrato.lendo = true; ui.extrato.nomeArquivo = 'extrato-pj.ofx';
  hoje = V.telas.fin_hoje(ctx);
  assert.match(hoje, /<section class="fe-imp" role="dialog"[^>]*>[\s\S]*Lendo o extrato <b>extrato-pj\.ofx<\/b>…/);
  assert.doesNotMatch(hoje, /class="fe-imp-veu" data-fx/, 'enquanto lê, tocar fora não fecha');
  // A prévia chegou: por cima do Hoje, com o botão de importar.
  ui.extrato.lendo = false;
  const ts = X.transacoesDoCsv(X.lerExtrato(OFX('1')), []);
  ui.extrato.previa = { previa: true, formato: 'ofx', agencia: '', conta: '99999', avisos: [], novas: 3, repetidas: 7, de_outro_formato: 7,
    transacoes: ts.map((x) => ({ ...x, ja_importada: x.banco.data < '2026-11-13' })), resumo: X.resumo(ts), meses: X.mesesDa(ts).map((m) => X.resumo(ts, { mes: m })) };
  for (const aba of ['fin_hoje', 'fin_movimento', 'fin_clientes']) {
    const html = V.telas[aba](ctx);
    assert.equal((html.match(/class="fe-imp"/g) || []).length, 1, `${aba}: uma janela só`);
    assert.match(html, /class="fe-imp-veu" data-fx="previa-fechar"/, aba);
    assert.match(html, /<b>3 lançamentos novos<\/b> · 7 já estavam aqui \(7 vieram antes em outro formato\)/, aba);
    assert.match(html, /De 01\/10 a 26\/11 · 10 lançamentos no arquivo · OFX · conta 99999/, aba);
    assert.match(html, /data-fx="importar">Importar 3 lançamentos</, aba);
    assert.doesNotMatch(html, /undefined|NaN/, aba);
  }
  assert.equal((V.telas.extrato(ctx).match(/class="fe-imp"/g) || []).length, 1, 'a tela antiga do Extrato usa a mesma janela');
  // A gravação falhou: a frase fica na janela e o botão diz tentar de novo.
  ui.extrato.previa.falhou = 'Não consegui falar com o servidor agora. Confira a internet e tente de novo.';
  assert.match(V.telas.fin_hoje(ctx), /role="alert">Não consegui falar com o servidor agora[\s\S]*Tentar de novo: importar 3 lançamentos/);
  // O erro de leitura: a frase, outro arquivo e fechar.
  ui.extrato.previa = { erro: 'Esse Excel antigo não dá para ler; exporte em OFX ou CSV.' };
  hoje = V.telas.fin_hoje(ctx);
  assert.match(hoje, /class="fe-imp"[\s\S]*Não deu para ler o extrato[\s\S]*Esse Excel antigo não dá para ler; exporte em OFX ou CSV\.[\s\S]*Escolher outro arquivo<input type="file"[^>]*data-fx-arquivo[\s\S]*data-fx="previa-fechar">Fechar/);
  ui.extrato.previa = null;
});

test('com o extrato até ontem, o "Extrato parado" some do Hoje', () => {
  const V = telas();
  const ts = X.transacoesDoCsv(X.lerExtrato(OFX('1')), []);
  const d = montar({ extrato: { transacoes: ts, importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [] }, [], { mes: '', hoje: HOJE });
  assert.doesNotMatch(V.telas.fin_hoje({ d, filtro: {} }), /aria-label="Extrato parado"/);
  assert.match(V.telas.fin_hoje({ d: dados(), filtro: {} }), /aria-label="Extrato parado"/);
});
