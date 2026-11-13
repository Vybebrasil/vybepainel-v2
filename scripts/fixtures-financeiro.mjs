// Demo local do Financeiro (area=financeiro): o servidor de verdade (server/financeiro.js) sobre um PGlite em memória,
// com clientes e três meses de extrato FICTÍCIOS. Nada sai deste processo e nada fica gravado ao reiniciar: dá para
// importar um extrato real pela tela para ver como fica, sem ele ir para banco nem para o repositório.
import { conexao } from '../tests/postgres.mjs';
import { lerFinanceiro, escreverFinanceiro } from '../server/financeiro.js';

const CLIENTES = [['Academia Lions', 1800], ['Alpha1', 2500], ['Brussolo Ristorante', 1500], ['ConectaSim', 3200], ['DiaLab', 2200], ['Hebravet', 1200], ['Serra Grande Bebidas', 4000], ['VOA', 900]];
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Três meses e pouco de extrato inventado, no formato do BB (mais novo primeiro), terminando hoje.
export function csvFicticio(hoje = new Date().toISOString().slice(0, 10)) {
  const [a, m] = hoje.split('-').map(Number);
  const mes = (k) => { const d = new Date(Date.UTC(a, m - 1 - k, 1)); return d.toISOString().slice(0, 7); };
  const ls = [];
  for (let k = 3; k >= 0; k--) {
    const M = mes(k), dia = (d) => `${M}-${String(d).padStart(2, '0')}`;
    const ate = k === 0 ? Number(hoje.slice(8, 10)) : 28;
    const add = (d, h, v) => { if (d <= ate) ls.push([dia(d), h, v]); };
    add(2, 'Rendimento Liquido De Contamax', 3.12);
    add(5, 'Cr Cob Bloq Comp Conf Recebimento 0001/000123', 1800 + 1500 + 1200); // Lions + Brussolo + Hebravet juntos
    add(6, 'Pix Recebido Alpha Um Comunicacao', 2500);
    add(8, 'Pix Recebido Conecta Sim Telecom', 3200);
    add(10, 'Pix Enviado Vinicius Exemplo Socio', -2380.4);
    add(10, 'Tarifa Avulsa Envio Pix', -1.9);
    add(12, 'Pix Enviado Motorista Exemplo', -180);
    add(12, 'Pix Enviado Paulo Exemplo Socio', -96.5);
    add(15, 'Prest. De Emprest. Financiamento PARC 0' + String(10 + (3 - k)).padStart(2, '0') + '/046 1', -812.33);
    add(15, 'Pix Enviado Designer Freela Ficticio', -1200);
    add(18, 'Pix Recebido Serra Grande Bebidas', 4000);
    add(20, 'Pagamento Conta Celular Em Canais INTERNET OPERADORA', -159.9);
    add(20, 'Pix Enviado Ewerton Exemplo Socio', -1500);
    add(20, 'Pix Enviado Deivid Exemplo Socio', -1500);
    add(22, 'Pix Enviado Motorista Exemplo', -150);
    add(25, 'Pix Enviado Restaurante Ficticio', -68);
    if (k !== 1) add(26, 'Pix Recebido DiaLab Analises', 2200); // num mês, a DiaLab não pagou
    add(27, 'Comissao Recurso Nao Disp. Dia', -14.27);
    add(28, 'Pix Automatico Enviado Programa Ficticio', -103.4);
  }
  ls.sort((x, y) => x[0].localeCompare(y[0]));
  let saldo = 900;
  const linhas = ls.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
    ...linhas.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}

let pronto = null;
const TOKEN_DEMO = 'demo-local-so-para-a-demonstracao-do-financeiro-0000'; // fictício, só neste processo
async function banco() {
  if (pronto) return pronto;
  pronto = (async () => {
    const { db, sql } = conexao();
    await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text); INSERT INTO vybe_pessoas VALUES (1,'Operador de teste');
      CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
      CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, atualizado_em timestamptz DEFAULT now());
      CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
      CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
    for (const [i, [nome, valor]] of CLIENTES.entries()) {
      await db.query('INSERT INTO vybe_clientes (id,nome) VALUES ($1,$2)', [i + 1, nome]);
      await db.query("INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES ($1,$2,'2026-01-01')", [i + 1, valor]);
    }
    const quem = { tipo: 'sessao', pessoa: { id: 1, nome: 'Operador de teste', dono: true } };
    if (process.env.DEMO_FINANCEIRO_VAZIO !== '1') {
      await escreverFinanceiro(sql, quem, { acao: 'importar', csv: csvFicticio() });
      for (const f of [{ nome: 'Programa de edição', valor: 103.4, dia: 28, categoria: 'ferramentas', forma: 'pix', contem: 'programa' },
        { nome: 'Internet e celular', valor: 159.9, dia: 20, categoria: 'estrutura', forma: 'debito', contem: 'celular' },
        { nome: 'Empréstimo (46x)', valor: 812.33, dia: 15, categoria: 'emprestimo', forma: 'debito', contem: 'emprest' },
        { nome: 'Aluguel da sala', valor: 1200, dia: 5, categoria: 'estrutura', forma: 'boleto' }]) await escreverFinanceiro(sql, quem, { acao: 'fixo_salvar', fixo: f });
      // O que o Vorcaro teria lido no grupo Vybe Financeiro (fictício): um que já está no extrato e um em dinheiro vivo.
      const { areaFinanceiroBot } = await import('../server/financeiro.js');
      const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10), mot = csvFicticio().split('\r\n').find((l) => l.includes('Motorista'));
      const dataMot = mot ? mot.slice(7, 11) + '-' + mot.slice(4, 6) + '-' + mot.slice(1, 3) : ontem;
      const res = { status() { return this; }, json() { return this; } };
      await areaFinanceiroBot({ method: 'POST', headers: { authorization: 'Bearer ' + TOKEN_DEMO }, body: { acao: 'propor', propostas: [
        { id_externo: 'demo-1', autor: 'Vinícius', anexo: 'print', texto: 'Gasolina do Mizinho para a captação', tipo: 'saida', valor: 180, data: dataMot, categoria: 'combustivel', quem: 'Mizinho' },
        { id_externo: 'demo-2', autor: 'Paulo', anexo: 'audio', texto: 'Paguei o almoço da equipe em dinheiro', tipo: 'saida', valor: 86, data: ontem, categoria: 'alimentacao', quem: 'Restaurante' }] } }, res, () => sql, { VYBE_AI_BOT_TOKEN: TOKEN_DEMO });
    }
    return { sql, quem };
  })();
  return pronto;
}

export async function financeiroDemo(req, url, body, reply) {
  try {
    const { sql, quem } = await banco();
    if (req.method === 'POST') {
      let d = {}; try { d = JSON.parse(String(body || '{}')); } catch { return reply(400, { error: 'JSON inválido.' }); }
      return reply(200, { ok: true, ...await escreverFinanceiro(sql, quem, d) });
    }
    return reply(200, { ok: true, ...await lerFinanceiro(sql, quem, Object.fromEntries(url.searchParams)) });
  } catch (e) { return reply(e.status || 500, { error: e.message }); }
}
