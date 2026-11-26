// As contas do Finanças completo (26/11/2026): DRE, MRR e a cascata, o rateio da margem, o a receber por idade, o
// orçamento, os três cenários, o equilíbrio e a confiança; os gráficos SVG próprios e o relatório no contrato do motor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import A from '../shared/financeiro-analises.js';
import { areaFinanceiro } from '../server/financeiro.js';
import { esquecerTabelasFinanceiro } from '../server/financeiro-tabelas.js';

let seq = 0;
const lanc = (data, valor, categoria, real = {}) => ({ id: `t${++seq}`, banco: { data, valor, historico: categoria, saldo: null }, real: { categoria, status: 'ok', conferido: true, ...real } });

test('confiança: diz quantos meses de base e o nível; 3 meses é baixa', () => {
  assert.equal(A.confianca(3).texto, 'base em 3 meses: confiança baixa');
  assert.equal(A.confianca(3).nivel, 'baixa');
  assert.equal(A.confianca(6).nivel, 'media');
  assert.equal(A.confianca(12).nivel, 'alta');
  assert.equal(A.confianca(0).nivel, 'nenhuma');
});

test('contrato: vigência, reajuste a partir do mês e vencimento no dia do contrato (31 em fevereiro = último dia)', () => {
  const ct = { cliente_id: 1, valor_mensal: 1000, inicio: '2026-03-10', fim: '2026-12-31', dia_vencimento: 31, reajuste_em: '2026-09-01', reajuste_pct: 10 };
  assert.equal(A.valorNoMes(ct, '2026-02'), 0);
  assert.equal(A.valorNoMes(ct, '2026-08'), 1000);
  assert.equal(A.valorNoMes(ct, '2026-09'), 1100);
  assert.equal(A.valorNoMes(ct, '2027-01'), 0);
  assert.equal(A.vencimento(ct, '2027-02'), '2027-02-28');
  assert.equal(A.vencimento({ dia_vencimento: 5 }, '2026-11'), '2026-11-05');
  assert.equal(A.vencimento({}, '2026-11'), '2026-11-30');
});

test('DRE: competência × caixa, linhas fixas, o que é de sócio/empréstimo fora do resultado, margem', () => {
  const lista = [
    lanc('2026-10-05', 5000, 'receita_cliente', { cliente_id: '1' }),
    lanc('2026-11-03', 3000, 'receita_cliente', { cliente_id: '2', competencia: '2026-10' }), // pago em novembro, de outubro
    lanc('2026-10-10', -500, 'impostos'),
    lanc('2026-10-20', -2000, 'salario'),
    lanc('2026-10-21', -300, 'ferramentas'),
    lanc('2026-10-22', -200, 'combustivel'),
    lanc('2026-10-25', -1000, 'retirada_socio'),
  ];
  const meses = ['2026-10', '2026-11'];
  const c = A.dre(lista, { meses, base: 'competencia' }), k = A.dre(lista, { meses, base: 'caixa' });
  const l = (d, id) => d.linhas.find((x) => x.id === id).valores;
  assert.deepEqual(l(c, 'receita'), [8000, 0]);
  assert.deepEqual(l(k, 'receita'), [5000, 3000]);
  assert.deepEqual(c.resultado, [8000 - 500 - 2000 - 300 - 200, 0]);
  assert.equal(c.margem[0], 62.5);
  assert.equal(c.fora.total, -1000);
  assert.equal(c.total_resultado, k.total_resultado, 'o total do período é o mesmo nas duas bases');
});

test('MRR: cascata novo, expansão, contração e perdido; churn e ticket', () => {
  const cts = [
    { cliente_id: 1, cliente_nome: 'A', valor_mensal: 1000, inicio: '2026-01-01' },
    { cliente_id: 2, cliente_nome: 'B', valor_mensal: 2000, inicio: '2026-01-01', fim: '2026-09-30' },
    { cliente_id: 3, cliente_nome: 'C', valor_mensal: 500, inicio: '2026-10-01' },
    { cliente_id: 4, cliente_nome: 'D', valor_mensal: 1000, inicio: '2026-01-01', reajuste_em: '2026-10-01', reajuste_pct: 20 },
  ];
  const r = A.recorrente(cts, ['2026-09', '2026-10'], { hoje: '2026-10-31' });
  const out = r.meses[1];
  assert.equal(out.mrr_anterior, 4000);
  assert.equal(out.mrr, 1000 + 500 + 1200);
  assert.equal(out.novo, 500); assert.equal(out.expansao, 200); assert.equal(out.perdido, -2000); assert.equal(out.contracao, 0);
  assert.equal(out.mrr_anterior + out.novo + out.expansao + out.contracao + out.perdido, out.mrr, 'a cascata fecha');
  assert.equal(out.churn_pct, 50);
  assert.equal(out.ticket, 900);
});

test('margem por cliente: custo de equipe rateado pelas peças; sem peça no mês, pela receita', () => {
  const lista = [
    lanc('2026-10-05', 3000, 'receita_cliente', { cliente_id: '1', cliente_nome: 'A' }),
    lanc('2026-10-06', 1000, 'receita_cliente', { cliente_id: '2', cliente_nome: 'B' }),
    lanc('2026-10-20', -2000, 'salario'),
    lanc('2026-10-21', -100, 'producao', { cliente_id: '2' }),
    lanc('2026-11-05', 3000, 'receita_cliente', { cliente_id: '1' }),
    lanc('2026-11-06', 1000, 'receita_cliente', { cliente_id: '2' }),
    lanc('2026-11-20', -2000, 'salario'),
  ];
  const m = A.margemClientes(lista, { meses: ['2026-10', '2026-11'], pecas: [{ cliente_id: '1', mes: '2026-10', pecas: 1 }, { cliente_id: '2', mes: '2026-10', pecas: 3 }] });
  assert.deepEqual(m.regra, ['pecas', 'receita']);
  const a = m.linhas.find((x) => x.cliente_id === '1'), b = m.linhas.find((x) => x.cliente_id === '2');
  assert.equal(a.custo_equipe, 500 + 1500); // outubro 1/4 das peças; novembro 3/4 da receita
  assert.equal(b.custo_equipe, 1500 + 500);
  assert.equal(b.custo_direto, 100);
  assert.equal(b.margem, 2000 - 100 - 2000);
  assert.equal(a.custo_equipe + b.custo_equipe, 4000, 'o rateio distribui o custo de equipe inteiro');
  assert.deepEqual(m.prejuizo.map((x) => x.cliente_id), ['2']);
});

test('a receber por idade: atraso contado do dia de vencimento do contrato', () => {
  const ag = A.aging([{ cliente_id: '1', cliente_nome: 'A', meses: [{ mes: '2026-10', em_aberto: 1000 }, { mes: '2026-11', a_receber: 500 }] }],
    [{ cliente_id: '1', dia_vencimento: 10 }], { hoje: '2026-11-26' });
  assert.equal(ag.total, 1500); assert.equal(ag.vencido, 1500);
  const out = ag.itens.find((i) => i.mes === '2026-10'), nov = ag.itens.find((i) => i.mes === '2026-11');
  assert.equal(out.vence, '2026-10-10'); assert.equal(out.atraso_dias, 47); assert.equal(out.faixa, 'd60');
  assert.equal(nov.atraso_dias, 16); assert.equal(nov.faixa, 'd30');
});

test('orçamento: copiar o mês anterior com ±%', () => {
  const o = { '2026-10': { equipe: 10000, ferramentas: 999.99 } };
  assert.deepEqual(A.copiarOrcamento(o, '2026-10', '2026-11', 10), { equipe: 11000, ferramentas: 1099.99 });
  assert.deepEqual(A.copiarOrcamento(o, '2026-09', '2026-11', 10), {});
});

test('projeção: pessimista ≤ base ≤ otimista, o dia em que fica negativo, perder o maior e contratar pioram', () => {
  const p = {
    hoje: '2026-11-26', saldo_hoje: 1000, meses_base: [], lista: [],
    contratos: [{ cliente_id: 1, valor_mensal: 6000, dia_vencimento: 10 }, { cliente_id: 2, valor_mensal: 3000, dia_vencimento: 5 }],
    fixos: [{ id: 'f1', nome: 'Aluguel', valor: 7000, dia: 1, ativo: true }], risco: ['2'], atraso_medio: 20,
    pipeline: [{ valor_mensal: 2000, chance: 0.5, dia_vencimento: 10 }],
  };
  const r = A.projecao3(p);
  assert.equal(r.meses.length, 12);
  assert.ok(r.pessimista.saldo_final <= r.base.saldo_final && r.base.saldo_final <= r.otimista.saldo_final);
  assert.equal(r.base.saldo_final, 1000 + 11 * (9000 - 7000), 'base: 11 meses inteiros de contrato menos o aluguel');
  assert.ok(r.pessimista.primeiro_dia_negativo, 'sem o cliente em risco, o aluguel vence antes do contrato');
  const semMaior = A.projecao3({ ...p, cenario: { perder_maior: true, perder_maior_a_partir: 2 } });
  assert.ok(semMaior.base.saldo_final < r.base.saldo_final);
  const contrata = A.projecao3({ ...p, cenario: { contratar: [{ salario: 3000, a_partir: 2 }] } });
  assert.equal(contrata.base.saldo_final, r.base.saldo_final - 3000 * 11);
  const aumenta = A.projecao3({ ...p, cenario: { aumentar: [{ cliente_id: 1, pct: 10, a_partir: 2 }] } });
  assert.equal(aumenta.base.saldo_final, r.base.saldo_final + 600 * 11);
  assert.equal(r.confianca.nivel, 'nenhuma');
});

test('equilíbrio e metas: quanto falta para o MRR cobrir os custos', () => {
  const e = A.equilibrio({ mrr: 9000, fixos: 7000, combinados: 1000, variaveis: 2000 });
  assert.equal(e.cobre_fixo, true); assert.equal(e.cobre_total, false); assert.equal(e.falta_total, 1000); assert.equal(e.pct_do_fixo, 113);
  const m = A.metas({ mrr: 12000, margem_pct: 20, caixa_minimo: 5000 }, { mrr: 9000, margem_pct: 25, menor_saldo: 2000 });
  assert.deepEqual(m.map((x) => [x.id, x.ok]), [['mrr', false], ['margem', true], ['caixa', false]]);
  assert.equal(m[0].falta, 3000);
});

const carregarGraficos = () => {
  const ctx = vm.createContext({ console });
  ctx.globalThis = ctx;
  vm.runInContext(readFileSync('vybe-graficos.js', 'utf8'), ctx);
  return ctx;
};

test('gráficos: SVG próprio com tabela para leitor de tela, faixa, legenda que esconde a série e vazio sem dado', () => {
  const G = carregarGraficos().VybeGraficos;
  const rotX = [{ curto: '10/26', longo: 'outubro' }, { curto: '11/26', longo: 'novembro' }];
  const l = G.linhaFaixa({ rotX, series: [{ nome: 'Base', vals: [100, 200], cor: 'k1' }], faixa: { nome: 'Faixa', de: [50, 80], ate: [150, 260] }, rotulo: 'Saldo' });
  assert.match(l, /<svg[^>]*role="img"[^>]*aria-label="Saldo"/);
  assert.match(l, /<table/);
  assert.match(l, /data-vg-serie/);
  assert.match(G.barras({ rotX, series: [{ nome: 'R', vals: [1, -1] }], rotulo: 'B' }), /vg-zero/, 'barra negativa desenha a linha do zero');
  assert.match(G.cascata({ passos: [{ nome: 'Antes', valor: 100, tipo: 'total' }, { nome: 'Novo', valor: 20 }, { nome: 'Perdido', valor: -50 }], rotulo: 'C' }), /vg-bar sobe[\s\S]*vg-bar desce/);
  assert.match(G.rosca({ fatias: [{ nome: 'A', valor: 3 }, { nome: 'B', valor: 1 }], rotulo: 'R' }), /75%/);
  assert.doesNotMatch(G.linhaFaixa({ rotX: [], series: [] }), /<svg/);
  // Só tokens: nenhuma cor escrita no SVG.
  for (const s of [l, G.barrasH({ itens: [{ nome: 'x', valor: -2 }] })]) assert.doesNotMatch(s, /#[0-9a-f]{3,6}\b|rgb\(/i);
});

async function bancoComExtrato(t) {
  esquecerTabelasFinanceiro();
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, email text, dono boolean);
    INSERT INTO vybe_pessoas (id, nome) VALUES (1,'Paulo');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    INSERT INTO vybe_clientes (id,nome) VALUES (1,'Cliente A');
    CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, observacao text, atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);
    INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (1, 2000, '2026-01-01');
    CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
    CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));`);
  const csv = ['Data;Histórico;Documento;Valor (R$);Saldo (R$)',
    '"10/09/2026";"Pix Recebido Cliente A";"";"2.000,00";"2.000,00"', '"20/09/2026";"Pix Enviado Fulano";"";"-800,00";"1.200,00"',
    '"10/10/2026";"Pix Recebido Cliente A";"";"2.000,00";"3.200,00"', '"20/10/2026";"Pix Enviado Fulano";"";"-900,00";"2.300,00"',
    '"03/11/2026";"Pix Enviado Fulano";"";"-100,00";"2.200,00"'].join('\r\n');
  const r = { codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } };
  const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', dono: true } };
  await areaFinanceiro({ method: 'POST', body: { acao: 'importar', csv }, query: {} }, r, dono, () => sql);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const g = { codigo: 0, body: null, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } };
  await areaFinanceiro({ method: 'GET', body: null, query: {} }, g, dono, () => sql);
  return g.body;
}

test('relatório: o contrato do motor (números com o porquê, seções com gráfico e tabela, recomendações) e o registro só se o motor tiver registrar', async (t) => {
  const d = await bancoComExtrato(t);
  assert.ok(d.analise, 'o GET traz a análise');
  // Sem motor de relatórios: não registra nada, mas monta.
  const sem = carregarGraficos();
  sem.VybeRelatorio = { abrir() {} };
  vm.runInContext(readFileSync('vybe-relatorio-financas.js', 'utf8'), sem);
  const rel = sem.VybeRelatorioFinancas.montar(d, {});
  for (const k of ['titulo', 'periodo', 'resumo', 'numeros', 'secoes', 'recomendacoes', 'fontes']) assert.ok(k in rel, k);
  assert.ok(rel.numeros.length >= 5 && rel.numeros.every((n) => n.rotulo && n.valor && n.porque));
  assert.ok(rel.secoes.every((s) => s.titulo && s.texto && s.grafico?.tipo && Array.isArray(s.grafico.series) && s.tabela?.colunas?.length));
  assert.ok(rel.secoes.some((s) => /<svg/.test(s.grafico.svg)), 'os gráficos saem dos helpers da tela');
  assert.ok(rel.recomendacoes.every((r) => r.o_que && r.prioridade));
  assert.match(rel.resumo, /base em \d+ m[eê]s/);
  assert.match(rel.fontes.join(' '), /Santander/);
  // Com motor: registra 'financas' e a função devolve o mesmo contrato.
  const com = carregarGraficos(), registrados = {};
  com.VybeRelatorio = { registrar: (id, fn) => { registrados[id] = fn; } };
  com.fetch = async (url) => { assert.match(url, /area=financeiro/); return { ok: true, json: async () => d }; };
  vm.runInContext(readFileSync('vybe-relatorio-financas.js', 'utf8'), com);
  assert.deepEqual(Object.keys(registrados), ['financas']);
  const via = await registrados.financas({});
  assert.equal(via.titulo, rel.titulo);
  assert.equal(via.secoes.length, rel.secoes.length);
  // Sem extrato: diz que não há números, sem quebrar.
  assert.match(sem.VybeRelatorioFinancas.montar({}, {}).resumo, /Sem extrato/);
});
