// Carteira (server/carteira.js): rota area=carteira com banco de mentira (PGlite).
// SAFE: banco em memória; nada vai ao Neon nem ao WhatsApp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaCarteira, situacaoDoOnboarding, validarEtapas, ETAPAS_PADRAO, hojeBahia } from '../server/carteira.js';
import handler from '../api/painel.js';

const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const admin = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', admin: true } };
const head = { tipo: 'sessao', pessoa: { id: 2, nome: 'Vinícius', admin: false } };
const atendimento = { tipo: 'sessao', pessoa: { id: 3, nome: 'Ana', admin: false } };
const outro = { tipo: 'sessao', pessoa: { id: 4, nome: 'Bia', admin: false } };
const hoje = hojeBahia();
const somar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

async function banco(t, { migracao = true } = {}) {
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean DEFAULT true);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, status text, nao_e_cliente boolean DEFAULT false,
      valor numeric, criado_no_monday date, desativado_em timestamptz, apagado_em timestamptz); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    CREATE TABLE vybe_cliente_eventos (id bigserial PRIMARY KEY, cliente_id bigint, tipo text, de text, para text, motivo text, autor text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, texto text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo',true),(2,'Vinícius',true),(3,'Ana',true),(4,'Bia',true),(5,'Saiu',false);
    INSERT INTO vybe_escritorio_funcoes VALUES (3,'atendimento'),(4,'criacao');
    INSERT INTO vybe_clientes (id,nome,ativo,status,valor,criado_no_monday) VALUES
      (10,'Alfa',true,'Ativo',1500,'2025-01-10'),(11,'Beta',true,'Ativo',NULL,NULL),(12,'Gama',false,'Inativo',900,'2025-03-01'),
      (13,'Fornecedor',true,'Ativo',NULL,NULL);
    UPDATE vybe_clientes SET nao_e_cliente=true WHERE id=13;
    UPDATE vybe_clientes SET desativado_em='2026-06-15T15:00:00Z' WHERE id=12;
    INSERT INTO vybe_cliente_eventos (cliente_id,tipo,para,motivo,em) VALUES (11,'status','Ativo',NULL,'2026-02-05T12:00:00Z'),(12,'status','Inativo','achou caro','2026-06-15T15:00:00Z');
    INSERT INTO vybe_cliente_pessoas VALUES (10,2,0);
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,10),(102,10);`);
  // Histórico de status recente: Alfa com 3 voltas para alteração e uma aprovação de 4 dias.
  const ev = (c, para, diasAtras, hora = 12) => `(${c},'status','${para}','${somar(hoje, -diasAtras)}T${String(hora).padStart(2, '0')}:00:00Z')`;
  await db.exec(`INSERT INTO vybe_conteudo_eventos (conteudo_id,tipo,para,em) VALUES
    ${[ev(100, 'Alteração', 10), ev(100, 'Em andamento', 9), ev(101, 'Alteração', 5), ev(102, 'Alteração', 3),
      ev(101, 'Ag. Aprovação Cliente', 20), ev(101, 'Finalizado', 16)].join(',')};`);
  if (migracao) {
    const sqlMigracao = readFileSync('migrations/2026-11-07-carteira.sql', 'utf8');
    await db.exec(sqlMigracao);
    await db.exec(sqlMigracao); // idempotente
  }
  return { db, sql };
}
async function chamar(sql, quem, body = null, query = {}) {
  const r = resposta();
  await areaCarteira({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql);
  return r;
}

test('rota carteira exige sessão: 401 sem login; serviço lê mas não escreve', async () => {
  const r = resposta();
  await handler({ method: 'GET', headers: {}, query: { area: 'carteira' } }, r);
  assert.equal(r.codigo, 401);
  const s = resposta();
  await areaCarteira({ method: 'POST', body: { acao: 'saude_registrar', itens: [] }, query: {} }, s, { tipo: 'servico' }, () => { throw new Error('não deve abrir o banco'); });
  assert.equal(s.codigo, 403);
});

test('sem a migração: lê sinais e a base, partes "aguardando ativação" e escrita recusada com 503', async (t) => {
  const { sql } = await banco(t, { migracao: false });
  const r = await chamar(sql, admin);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  for (const parte of ['onboarding', 'contratos', 'churn', 'historico', 'clima']) assert.equal(r.body[parte].disponivel, false, parte);
  assert.equal(r.body.onboarding.migracao, '2026-11-07-carteira.sql');
  assert.deepEqual(r.body.etapas.map((e) => e.id), ETAPAS_PADRAO.map((e) => e.id));
  const alfa = r.body.sinais.porCliente['10'];
  assert.equal(alfa.ajustes30, 3);
  assert.equal(alfa.aprovacoes, 1);
  assert.equal(alfa.aprovacao_dias, 4);
  // Base para churn/cohort: sem o "não é cliente"; entrada e saída de onde houver.
  const base = Object.fromEntries(r.body.clientes.map((c) => [c.nome, c]));
  assert.equal(base.Fornecedor, undefined);
  assert.equal(base.Alfa.entrada, '2025-01-10');
  assert.equal(base.Alfa.entrada_fonte, 'cadastro');
  assert.equal(base.Beta.entrada_fonte, 'historico', 'sem criado_no_monday: o primeiro evento');
  assert.equal(base.Beta.entrada, '2026-02-05');
  assert.equal(base.Gama.saida, '2026-06-15');
  assert.equal(base.Gama.motivo_saida, 'achou caro');
  assert.equal(base.Gama.valor, 900);
  const w = await chamar(sql, admin, { acao: 'onboarding_iniciar', cliente_id: 10 });
  assert.equal(w.codigo, 503);
  assert.equal(w.body.aguardando, true);
  assert.equal((await chamar(sql, admin, null, { acao: 'saude' })).codigo, 503);
});

test('onboarding: permissões, marcar, responsável e "parada desde"', async (t) => {
  const { sql } = await banco(t);
  assert.equal((await chamar(sql, outro, { acao: 'onboarding_iniciar', cliente_id: 10 })).codigo, 403);
  assert.equal((await chamar(sql, head, { acao: 'onboarding_iniciar', cliente_id: 11 })).codigo, 403, 'head só do próprio cliente');
  let r = await chamar(sql, head, { acao: 'onboarding_iniciar', cliente_id: 10 });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, atendimento, { acao: 'onboarding_iniciar', cliente_id: 11 });
  assert.equal(r.codigo, 200);
  assert.equal((await chamar(sql, admin, { acao: 'onboarding_iniciar', cliente_id: 12 })).codigo, 400, 'cliente desativado');
  for (const item of ['mensagem', 'grupo', 'equipe']) {
    r = await chamar(sql, head, { acao: 'onboarding_marcar', cliente_id: 10, etapa: 'boas_vindas', item, feito: true });
    assert.equal(r.codigo, 200, JSON.stringify(r.body));
  }
  assert.equal((await chamar(sql, head, { acao: 'onboarding_marcar', cliente_id: 10, etapa: 'boas_vindas', item: 'inventado', feito: true })).codigo, 400);
  assert.equal((await chamar(sql, head, { acao: 'onboarding_responsavel', cliente_id: 10, etapa: 'contrato', pessoa_id: 5 })).codigo, 400, 'pessoa inativa');
  r = await chamar(sql, head, { acao: 'onboarding_responsavel', cliente_id: 10, etapa: 'contrato', pessoa_id: 3 });
  assert.equal(r.codigo, 200);
  r = await chamar(sql, admin);
  const alfa = r.body.onboarding.clientes.find((o) => o.cliente_id === '10');
  assert.equal(alfa.etapas.boas_vindas.feitos.mensagem.por, 'Vinícius');
  assert.equal(alfa.situacao.atual.id, 'contrato');
  assert.equal(alfa.situacao.atual.responsavel_id, '3');
  assert.equal(alfa.situacao.atual.dias_parada, 0);
  assert.equal(alfa.situacao.etapas[0].concluida, true);
  // Leitura para o bot cobrar etapa travada.
  r = await chamar(sql, admin, null, { acao: 'onboarding' });
  const doAlfa = r.body.etapas.find((o) => o.clienteId === '10');
  assert.equal(doAlfa.cliente, 'Alfa');
  assert.equal(doAlfa.etapa, 'Contrato');
  assert.equal(doAlfa.responsavel, 'Ana');
  assert.ok(!Number.isNaN(Date.parse(doAlfa.paradaDesde)));
  // Encerrado não aceita marcação; reabrir volta.
  assert.equal((await chamar(sql, admin, { acao: 'onboarding_encerrar', cliente_id: 10 })).codigo, 200);
  assert.equal((await chamar(sql, head, { acao: 'onboarding_marcar', cliente_id: 10, etapa: 'contrato', item: 'assinado', feito: true })).codigo, 409);
  assert.equal((await chamar(sql, admin, { acao: 'onboarding_reabrir', cliente_id: 10 })).codigo, 200);
  assert.equal((await chamar(sql, head, { acao: 'onboarding_marcar', cliente_id: 10, etapa: 'contrato', item: 'assinado', feito: true })).codigo, 200);
});

test('situação do onboarding: etapa atual parada desde o último movimento ou a conclusão da anterior', () => {
  const etapas = [{ id: 'a', nome: 'A', itens: [{ id: 'x', texto: 'X' }] }, { id: 'b', nome: 'B', itens: [{ id: 'y', texto: 'Y' }, { id: 'z', texto: 'Z' }] }];
  const o = { iniciado_em: '2026-11-01T12:00:00Z', etapas: { a: { feitos: { x: { em: '2026-11-03T12:00:00Z' } } } } };
  let s = situacaoDoOnboarding(o, etapas, '2026-11-07');
  assert.equal(s.atual.id, 'b');
  assert.equal(s.atual.parada_desde, '2026-11-03T12:00:00.000Z');
  assert.equal(s.atual.dias_parada, 4);
  assert.equal(s.pct, 33);
  s = situacaoDoOnboarding({ iniciado_em: '2026-11-01T12:00:00Z', etapas: {} }, etapas, '2026-11-07');
  assert.equal(s.atual.id, 'a');
  assert.equal(s.atual.dias_parada, 6);
  s = situacaoDoOnboarding({ ...o, etapas: { ...o.etapas, b: { atualizado_em: '2026-11-06T12:00:00Z', feitos: { y: { em: '2026-11-05T12:00:00Z' }, z: { em: '2026-11-06T12:00:00Z' } } } } }, etapas, '2026-11-07');
  assert.equal(s.concluido, true);
  assert.equal(s.atual, null);
});

test('etapas configuráveis: só quem administra; validação de ids, nomes e limites', async (t) => {
  const { sql } = await banco(t);
  const novas = [ETAPAS_PADRAO[1], ETAPAS_PADRAO[0], { id: 'treino', nome: 'Treino da equipe', itens: [{ id: 'aula', texto: 'Aula de 1 h' }] }];
  assert.equal((await chamar(sql, head, { acao: 'etapas_salvar', etapas: novas })).codigo, 403);
  assert.equal((await chamar(sql, admin, { acao: 'etapas_salvar', etapas: [...novas, novas[0]] })).codigo, 400, 'id repetido');
  assert.equal((await chamar(sql, admin, { acao: 'etapas_salvar', etapas: [] })).codigo, 400);
  assert.throws(() => validarEtapas([{ id: 'Com Espaço', nome: 'X', itens: [] }]));
  const r = await chamar(sql, admin, { acao: 'etapas_salvar', etapas: novas });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const g = await chamar(sql, outro);
  assert.deepEqual(g.body.etapas.map((e) => e.id), ['contrato', 'boas_vindas', 'treino']);
});

test('contratos e churn: só quem administra, com validação; base usa contrato e registro', async (t) => {
  const { sql } = await banco(t);
  const contrato = { acao: 'contrato_salvar', cliente_id: 10, valor_mensal: '2.500,00'.replace('.', ''), inicio: '2025-01-01', renovacao: somar(hoje, 20), status: 'ativo' };
  assert.equal((await chamar(sql, head, contrato)).codigo, 403);
  assert.equal((await chamar(sql, admin, { ...contrato, status: 'assinado_eletronico' })).codigo, 400);
  assert.equal((await chamar(sql, admin, { ...contrato, renovacao: '2024-01-01' })).codigo, 400);
  assert.equal((await chamar(sql, admin, { ...contrato, inicio: '2026-02-30' })).codigo, 400);
  let r = await chamar(sql, admin, contrato);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const churn = { acao: 'churn_registrar', cliente_id: 12, saiu_em: '2026-06-15', tipo: 'cancelamento', motivo: 'preco', detalhe: 'achou caro', receita_mensal: 950 };
  assert.equal((await chamar(sql, head, churn)).codigo, 403);
  assert.equal((await chamar(sql, admin, { ...churn, motivo: 'outro', detalhe: '' })).codigo, 400, 'outro pede texto');
  assert.equal((await chamar(sql, admin, { ...churn, saiu_em: somar(hoje, 3) })).codigo, 400, 'sem futuro');
  assert.equal((await chamar(sql, admin, churn)).codigo, 200);
  assert.equal((await chamar(sql, admin, { ...churn, motivo: 'resultado' })).codigo, 200, 'mesma data atualiza');
  r = await chamar(sql, admin);
  assert.equal(r.body.churn.registros.length, 1);
  assert.equal(r.body.churn.registros[0].motivo, 'resultado');
  assert.equal(r.body.contratos.lista[0].valor_mensal, 2500);
  const base = Object.fromEntries(r.body.clientes.map((c) => [c.nome, c]));
  assert.equal(base.Alfa.entrada, '2025-01-01', 'início do contrato manda');
  assert.equal(base.Alfa.entrada_fonte, 'contrato');
  assert.equal(base.Alfa.valor, 2500);
  const id = r.body.churn.registros[0].id;
  assert.equal((await chamar(sql, admin, { acao: 'churn_apagar', id })).codigo, 200);
});

test('nota do mês: qualquer sessão grava; acao=saude devolve a última de cada cliente ativo; clima vem junto', async (t) => {
  const { db, sql } = await banco(t);
  const itens = [{ cliente_id: 10, score: 42, risco: 'alto', motivos: ['2 peças com a veiculação vencida'], heads: 'Vinícius' }, { cliente_id: 11, score: 88, risco: 'baixo', motivos: [], heads: '' }];
  assert.equal((await chamar(sql, outro, { acao: 'saude_registrar', itens: [{ cliente_id: 10, score: 101, risco: 'alto' }] })).codigo, 400);
  assert.equal((await chamar(sql, outro, { acao: 'saude_registrar', itens: [{ cliente_id: 10, score: 50, risco: 'péssimo' }] })).codigo, 400);
  let r = await chamar(sql, outro, { acao: 'saude_registrar', itens });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, outro, { acao: 'saude_registrar', itens: [{ ...itens[0], score: 45, risco: 'alto' }] });
  await db.exec(`INSERT INTO vybe_carteira_saude_mensal (mes,cliente_id,score,risco) VALUES ('2026-01-01',10,70,'medio');
    INSERT INTO vybe_carteira_clima (cliente_id,pontos,motivo) VALUES (10,-12,'cliente reclamou do atraso');`);
  r = await chamar(sql, { tipo: 'servico' }, null, { acao: 'saude' });
  assert.equal(r.codigo, 200);
  assert.deepEqual(r.body.clientes.map((c) => [c.cliente, c.clienteId, c.score, c.risco, c.head]), [['Alfa', '10', 45, 'alto', 'Vinícius'], ['Beta', '11', 88, 'baixo', '']]);
  assert.deepEqual(r.body.clientes[0].motivos, ['2 peças com a veiculação vencida']);
  r = await chamar(sql, outro);
  assert.equal(r.body.historico.meses.length, 2);
  assert.equal(r.body.historico.meses[0].mes, '2026-01-01');
  assert.equal(r.body.clima.porCliente['10'].pontos, -12);
  assert.equal(r.body.pode.contratos, false);
});

test('clima do grupo pelo bot: só serviço ou quem administra; casa pelo nome do cadastro', async (t) => {
  const { sql } = await banco(t);
  const corpo = { acao: 'clima', clientes: { 'ALFA': { pontos: -12, motivo: 'reclamou do atraso', em: '2026-11-06T15:00:00Z' }, 'Beta': { pontos: 30 }, 'Ninguém': { pontos: -5 } } };
  assert.equal((await chamar(sql, head, corpo)).codigo, 403);
  let r = await chamar(sql, { tipo: 'servico' }, corpo);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.gravados, ['Alfa']);
  assert.deepEqual(r.body.ignorados.map((x) => x.cliente), ['Beta', 'Ninguém']);
  r = await chamar(sql, admin, { acao: 'clima', clientes: { Alfa: { pontos: 5, motivo: 'elogiou' } } });
  assert.equal(r.codigo, 200);
  r = await chamar(sql, outro);
  assert.equal(r.body.clima.porCliente['10'].pontos, 5);
  assert.equal(r.body.clima.porCliente['10'].motivo, 'elogiou');
  assert.equal((await chamar(sql, admin, { acao: 'clima', clientes: [] })).codigo, 400);
});
