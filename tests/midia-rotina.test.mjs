// Mídia (S-Q): a rotina do gestor de tráfego. Os itens da cadência, o que os números de cada cliente acendem e os checks
// gravados em vybe_midia_checks (idempotentes, por dia, semana ou mês, só donos). Banco de verdade (PGlite) e o VybeHub de
// mentira do demo (scripts/fixtures-midia.mjs); nada sai da máquina.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { ancoraDe, itensFixos, alertasDoCliente, estadoDoErro, marcarCheck, desfazerCheck, lerRotina, campanhaDoHub, somaOrcamento, anuncioDoHub, imagemDaMeta, REGRAS, areaMidia } from '../server/midia.js';
import { midiaDemo } from '../scripts/fixtures-midia.mjs';

const dono = { tipo: 'sessao', pessoa: { id: 7, nome: 'Ewerton Silva', dono: true } };
const outroDono = { tipo: 'sessao', pessoa: { id: 9, nome: 'Paulo', dono: true } };
const equipe = { tipo: 'sessao', pessoa: { id: 8, nome: 'Bia' } };

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false,
      apagado_em timestamptz, cadastro jsonb NOT NULL DEFAULT '{}'::jsonb);
    INSERT INTO vybe_clientes(id, nome, ativo) VALUES (1, 'Alfa Café', true), (2, 'Beta Moda', false), (3, 'Gama Pet', true);`);
  return { db, sql };
}
const ok = (x = {}) => ({ estado: 'ok', investido: 300, investido_anterior: 280, resultados: 30, resultados_anterior: 30, tipo_resultado: 'messages', custo_resultado: 10, custo_anterior: 10, frequencia: 1.8, ...x });
const chaves = (l) => l.map((a) => a.chave);

test('âncora: o check diário vale o dia, o semanal a segunda da semana e o do mês o dia 1', () => {
  assert.equal(ancoraDe('dia', '2026-11-24'), '2026-11-24');
  assert.equal(ancoraDe('semana', '2026-11-24'), '2026-11-23'); // terça → segunda
  assert.equal(ancoraDe('semana', '2026-11-23'), '2026-11-23');
  assert.equal(ancoraDe('semana', '2026-11-29'), '2026-11-23'); // domingo fecha a semana
  assert.equal(ancoraDe('mes', '2026-11-24'), '2026-11-01');
  assert.throws(() => ancoraDe('dia', '24/11/2026'));
});

test('rotina da cadência: todo dia e esta semana sempre; o do mês só até o dia 10', () => {
  const dia24 = itensFixos('2026-11-24'), dia3 = itensFixos('2026-12-03');
  assert.deepEqual(chaves(dia24), ['diario_gastos', 'diario_pagamentos', 'diario_reprovados', 'semana_resumo', 'semana_revisao']);
  assert.deepEqual(chaves(dia3).slice(-2), ['mes_relatorio', 'mes_verba']);
  for (const it of dia3) { assert.ok(REGRAS[it.chave].fixo); assert.ok(it.titulo && it.porque && it.acao); assert.equal(it.cliente_id, '0'); }
  assert.equal(dia3.find((x) => x.chave === 'mes_verba').ancora, '2026-12-01');
});

test('alertas: cliente andando bem não acende nada', () => {
  assert.deepEqual(alertasDoCliente({ meta: ok(), ontem: { investido: 40, investido_anterior: 42 }, campanhas: [], hoje: '2026-11-24' }), []);
  assert.deepEqual(alertasDoCliente({ meta: { estado: 'sem_dados' }, hoje: '2026-11-24' }), []);
});

test('alertas: pagamento pendente e sem conta viram um item só', () => {
  const pg = alertasDoCliente({ meta: estadoDoErro(new Error('Métricas não disponíveis. Motivo: Conta de anúncios com pagamento pendente.')), hoje: '2026-11-24' });
  assert.deepEqual(chaves(pg), ['pagamento']); assert.equal(pg[0].tom, 'r'); assert.equal(pg[0].acao, 'faturamento');
  const sc = alertasDoCliente({ meta: estadoDoErro(new Error('Motivo: Conta de anúncios indisponível.')), hoje: '2026-11-24' });
  assert.deepEqual(chaves(sc), ['sem_conta']); assert.equal(sc[0].cadencia, 'semana'); assert.equal(sc[0].ancora, '2026-11-23');
  assert.equal(estadoDoErro(new Error('account UNSETTLED')).estado, 'pagamento');
});

test('alertas: verba parou ontem, sem resultado, custo subindo e frequência alta, com o número no porquê', () => {
  const parou = alertasDoCliente({ meta: ok(), ontem: { investido: 0, investido_anterior: 41.5 }, hoje: '2026-11-24' });
  assert.equal(parou[0].chave, 'verba_parou'); assert.match(parou[0].porque, /R\$ 41,50/);
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok({ resultados: 0, custo_resultado: null }), hoje: '2026-11-24' })), ['sem_resultado']);
  const subiu = alertasDoCliente({ meta: ok({ custo_resultado: 14.2, custo_anterior: 10 }), hoje: '2026-11-24' });
  assert.equal(subiu[0].chave, 'cpr_subiu'); assert.equal(subiu[0].tom, 'r'); assert.match(subiu[0].titulo, /conversa subiu 42%/);
  assert.equal(alertasDoCliente({ meta: ok({ custo_resultado: 12.5, custo_anterior: 10 }), hoje: '2026-11-24' })[0].tom, 'a');
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok({ custo_resultado: 11.9, custo_anterior: 10 }), hoje: '2026-11-24' })), []);
  const f = alertasDoCliente({ meta: ok({ frequencia: 3.4 }), hoje: '2026-11-24' });
  assert.equal(f[0].chave, 'frequencia'); assert.match(f[0].titulo, /3,4/);
});

test('alertas das campanhas: problema, pausada no meio da semana, ritmo do orçamento e criativo velho', () => {
  const k = (x) => campanhaDoHub({ name: 'Campanha', status: 'ACTIVE', spent: 70, dailyBudget: 10, startTime: '2026-10-01T09:00:00-0300', frequency: 1.5, ...x });
  const hoje = '2026-11-24';
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k({ status: 'WITH_ISSUES' })], hoje })), ['campanha_problema']);
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k(), k({ status: 'PAUSED', spent: 20 })], hoje })), ['campanha_pausada']);
  // Pausada sem gasto no período não acende (o Hub nem manda, mas a regra não depende disso).
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k(), k({ status: 'PAUSED', spent: 0 })], hoje })), []);
  const baixo = alertasDoCliente({ meta: ok(), campanhas: [k({ dailyBudget: 20, spent: 60 })], hoje });
  assert.deepEqual(chaves(baixo), ['ritmo_baixo']); assert.match(baixo[0].porque, /R\$ 60,00 de R\$ 140,00/);
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k({ dailyBudget: 10, spent: 100 })], hoje })), ['ritmo_alto']);
  // A campanha que entrou no ar ontem só conta 1 dia de orçamento.
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k({ dailyBudget: 60, spent: 58, startTime: '2026-11-23T08:00:00-0300' })], hoje })), []);
  // Orçamento pequeno demais para medir ritmo (menos de R$ 50 previstos) não acende.
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok(), campanhas: [k({ dailyBudget: 2, spent: 1 })], hoje })), []);
  const velho = alertasDoCliente({ meta: ok(), campanhas: [k({ frequency: 2.8, startTime: '2026-09-10T09:00:00-0300' })], hoje });
  assert.equal(velho[0].chave, 'criativo_antigo'); assert.match(velho[0].titulo, /há 75 dias/);
  // A ordem: o que pede ação antes do que pede olho.
  assert.deepEqual(chaves(alertasDoCliente({ meta: ok({ frequencia: 3.2 }), campanhas: [k({ status: 'WITH_ISSUES' })], hoje }))[0], 'campanha_problema');
});

test('campanhas, orçamento e anúncios no formato da tela; miniatura só da Meta', () => {
  const c = campanhaDoHub({ name: 'X', status: 'ACTIVE', dailyBudget: 25.5, lifetimeBudget: null, startTime: '2026-11-01T10:00:00-0300', spent: 10 });
  assert.equal(c.orcamento_dia, 25.5); assert.equal(c.inicio, '2026-11-01');
  assert.equal(somaOrcamento([c, campanhaDoHub({ status: 'PAUSED', dailyBudget: 99 }), campanhaDoHub({ status: 'ACTIVE', dailyBudget: null })]), 25.5);
  assert.equal(somaOrcamento([]), null);
  assert.equal(imagemDaMeta('https://scontent.xx.fbcdn.net/v/t.jpg'), 'https://scontent.xx.fbcdn.net/v/t.jpg');
  assert.equal(imagemDaMeta('http://scontent.xx.fbcdn.net/v/t.jpg'), null);
  assert.equal(imagemDaMeta('https://fbcdn.net.evil.com/x.jpg'), null);
  assert.equal(anuncioDoHub({ name: 'A', thumbnail: 'javascript:alert(1)', results: 3 }).imagem, null);
});

test('check: só donos marcam; equipe 403, sem sessão 401; item inválido 400', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(marcarCheck(sql, equipe, { chave: 'diario_gastos' }, { hoje: '2026-11-24' }), (e) => e.status === 403);
  await assert.rejects(marcarCheck(sql, null, { chave: 'diario_gastos' }, { hoje: '2026-11-24' }), (e) => e.status === 401);
  await assert.rejects(desfazerCheck(sql, equipe, { chave: 'diario_gastos' }, { hoje: '2026-11-24' }), (e) => e.status === 403);
  await assert.rejects(lerRotina(sql, equipe, { hoje: '2026-11-24' }), (e) => e.status === 403);
  await assert.rejects(marcarCheck(sql, dono, { chave: 'qualquer' }, { hoje: '2026-11-24' }), (e) => e.status === 400);
  await assert.rejects(marcarCheck(sql, dono, { chave: 'cpr_subiu' }, { hoje: '2026-11-24' }), (e) => e.status === 400 && /Cliente/.test(e.message));
  await assert.rejects(marcarCheck(sql, dono, { chave: 'cpr_subiu', cliente_id: 2 }, { hoje: '2026-11-24' }), (e) => e.status === 404);
  // Nada gravado pelas tentativas negadas.
  const [n] = await sql`SELECT to_regclass('vybe_midia_checks') IS NULL AS sem_tabela`;
  assert.equal(n.sem_tabela, true);
});

test('check: idempotente (marcar de novo não troca quem fez), desfazer apaga só o da âncora', async (t) => {
  const { sql } = await banco(t);
  const a = await marcarCheck(sql, dono, { chave: 'cpr_subiu', cliente_id: '1', nota: ' olhei\u0000 o lance ' }, { hoje: '2026-11-24' });
  assert.equal(a.ja_estava, false); assert.equal(a.check.feito_por_nome, 'Ewerton'); assert.equal(a.check.dia, '2026-11-24'); assert.equal(a.check.nota, 'olhei o lance');
  const b = await marcarCheck(sql, outroDono, { chave: 'cpr_subiu', cliente_id: 1 }, { hoje: '2026-11-24' });
  assert.equal(b.ja_estava, true); assert.equal(b.check.feito_por, '7'); assert.equal(b.check.feito_em, a.check.feito_em);
  // O fixo ignora o cliente que vier: é da carteira (0).
  const f = await marcarCheck(sql, dono, { chave: 'semana_resumo', cliente_id: 3 }, { hoje: '2026-11-24' });
  assert.equal(f.check.cliente_id, '0'); assert.equal(f.check.dia, '2026-11-23');
  // O mesmo item no dia seguinte é outro check.
  const c = await marcarCheck(sql, dono, { chave: 'cpr_subiu', cliente_id: 1 }, { hoje: '2026-11-25' });
  assert.equal(c.ja_estava, false);
  const d = await desfazerCheck(sql, dono, { chave: 'cpr_subiu', cliente_id: 1 }, { hoje: '2026-11-24' });
  assert.equal(d.removido, 1);
  assert.equal((await desfazerCheck(sql, dono, { chave: 'cpr_subiu', cliente_id: 1 }, { hoje: '2026-11-24' })).removido, 0);
  const linhas = await sql`SELECT dia::text AS dia FROM vybe_midia_checks WHERE chave = 'cpr_subiu'`;
  assert.deepEqual(linhas.map((x) => x.dia), ['2026-11-25']);
});

test('rotina: os checks que valem hoje (dia, semana, mês) e os últimos 7 dias por quem fez', async (t) => {
  const { db, sql } = await banco(t);
  await marcarCheck(sql, dono, { chave: 'semana_revisao' }, { hoje: '2026-11-24' });
  await lerRotina(sql, dono, { hoje: '2026-11-24' }); // cria a tabela antes do insert direto abaixo
  await db.exec(`INSERT INTO vybe_midia_checks (cliente_id, chave, dia, feito_por, feito_por_nome, feito_em) VALUES
    (0, 'diario_gastos', '2026-11-23', 9, 'Paulo', '2026-11-23T13:00:00Z'),
    (1, 'frequencia', '2026-11-23', 7, 'Ewerton', '2026-11-23T14:00:00Z'),
    (0, 'diario_gastos', '2026-11-24', 7, 'Ewerton', NOW())`);
  const r = await lerRotina(sql, dono, { hoje: '2026-11-24' });
  assert.deepEqual(r.ancoras, { dia: '2026-11-24', semana: '2026-11-23', mes: '2026-11-01' });
  // O diário de ontem (dia 23 = âncora da semana) não vale hoje; o semanal da segunda vale.
  assert.deepEqual(r.checks.map((c) => c.chave).sort(), ['diario_gastos', 'semana_revisao']);
  assert.ok(r.checks.every((c) => c.dia === '2026-11-24' || c.chave === 'semana_revisao'));
  assert.equal(r.historico.length, 7);
  assert.equal(r.historico[0].dia, '2026-11-24');
  const ontem = r.historico.find((h) => h.dia === '2026-11-23');
  assert.equal(ontem.feitos, 2); assert.deepEqual(ontem.quem.sort(), ['Ewerton', 'Paulo']);
  assert.equal(r.fixos.length, 5);
});

test('ponta a ponta no demo: a carteira do VybeHub de mentira acende os casos do gestor', async () => {
  const CL = ['Academia Lions', 'Alpha1', 'Antonov', 'Brussolo Ristorante', 'ConectaSim', 'Copirecê', 'DiaCenter', 'DiaLab', 'Gonzalez', 'Hebravet', 'Hellen', 'Mangaba AI', 'Serra Grande Bebidas', 'VOA', 'Experimente Papelaria']
    .map((nome, i) => ({ id: i + 1, nome, ativo: true, cadastro: {} }));
  const chamar = async (q, corpo) => { let out; await midiaDemo({ method: corpo ? 'POST' : 'GET', headers: { cookie: 'vybe_demo=1' } }, new URL('http://x/api/painel?area=midia&' + q), corpo ? JSON.stringify(corpo) : '', (s, d) => { out = { s, d }; }, CL); return out; };
  const alerta = async (id) => (await chamar(`acao=cliente&cliente_id=${id}&dias=7`)).d.meta.alertas.map((a) => a.chave);
  assert.deepEqual(await alerta(3), ['pagamento']);
  assert.ok((await alerta(6)).includes('verba_parou'));
  assert.ok((await alerta(4)).includes('cpr_subiu'));
  assert.ok((await alerta(1)).includes('frequencia'));
  assert.ok((await alerta(5)).includes('ritmo_baixo'));
  assert.ok((await alerta(14)).includes('campanha_problema'));
  assert.deepEqual(await alerta(7), ['sem_conta']);
  // Em 30 dias não vêm alertas (a rotina é sempre dos 7 dias).
  assert.equal((await chamar('acao=cliente&cliente_id=1&dias=30')).d.meta.alertas, undefined);
  const r = await chamar('acao=rotina');
  assert.equal(r.s, 200); assert.ok(r.d.fixos.length >= 5); assert.ok(r.d.historico.some((h) => h.feitos > 0));
  const ads = await chamar('acao=anuncios&cliente_id=1&dias=7');
  assert.ok(ads.d.anuncios[0].imagem.startsWith('https://')); assert.ok(ads.d.anuncios[0].resultados >= ads.d.anuncios[1].resultados);
  const marcou = await chamar('', { acao: 'check', chave: 'frequencia', cliente_id: '1' });
  assert.equal(marcou.s, 200); assert.equal(marcou.d.check.feito_por_nome, 'Paulo');
  assert.equal((await chamar('', { acao: 'desfazer', chave: 'frequencia', cliente_id: '1' })).d.removido, 1);
  assert.equal((await chamar('', { acao: 'apagar_tudo' })).s, 400);
});

test('areaMidia: rotina e check passam pela mesma porta de dono', async () => {
  let status = 0, saida = null;
  const res = { status(s) { status = s; return this; }, json(d) { saida = d; return this; } };
  const gravou = [];
  const banco = () => async (partes) => { gravou.push(partes.join('?')); return []; };
  await areaMidia({ method: 'POST', query: {}, body: { acao: 'check', chave: 'diario_gastos' } }, res, equipe, banco);
  assert.equal(status, 403); assert.deepEqual(gravou, []);
  await areaMidia({ method: 'POST', query: {}, body: { acao: 'desfazer', chave: 'diario_gastos' } }, res, equipe, banco);
  assert.equal(status, 403); assert.deepEqual(gravou, []);
  await areaMidia({ method: 'GET', query: { acao: 'rotina' } }, res, equipe, banco);
  assert.equal(status, 403); assert.match(saida.error, /donos/);
});
