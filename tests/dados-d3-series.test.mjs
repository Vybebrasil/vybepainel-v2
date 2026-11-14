// SAFE: PGlite em memória. Séries históricas dos quadros D3 (server/series-historicas.js, migração
// 2026-11-14-series-historicas.sql): a tabela nasce no primeiro uso, o dia é gravado uma vez, o passado que já está no
// banco (snapshots do Diário, nota mensal da Carteira, histórico de status, CRM) é reconstruído com a origem, e cada área
// lê a sua série. Não envia nada, não toca banco real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { garantirMigracoesIrecity, esquecerMigracoesIrecity } from '../server/migracoes-irecity.js';
import { garantirMigracoesHistorico, esquecerMigracoesHistorico, COMANDOS_HISTORICO } from '../server/migracoes-historico.js';
import { gravarSeriesDoDia, lerSeries, escreverSeries, areaSeries, hojeBahia, esquecerConferencia, reconstruirPassado, reconstrucaoAtual, LIMITE_CARGA_PADRAO, META_ACERTO_PADRAO } from '../server/series-historicas.js';
import { readFileSync } from 'node:fs';

const PROD = 7829537690;
const HOJE = hojeBahia();
const dia = (n) => new Date(Date.parse(HOJE + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const segunda = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return dia(Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(HOJE + 'T12:00:00Z')) / 864e5) - ((d.getUTCDay() + 6) % 7)); };
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', admin: true, monday_user_id: '68035537' } };
const jady = { tipo: 'sessao', pessoa: { id: 2, nome: 'Jady Rocha', admin: false, monday_user_id: '900' } };
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });

async function banco() {
  esquecerMigracoesIrecity(); esquecerMigracoesHistorico(); esquecerConferencia();
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, email text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true, admin boolean DEFAULT false, monday_user_id text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, status text, nao_e_cliente boolean DEFAULT false, valor numeric, criado_no_monday date, desativado_em timestamptz, apagado_em timestamptz);
    CREATE TABLE vybe_cliente_eventos (id bigserial PRIMARY KEY, cliente_id bigint, tipo text, de text, para text, motivo text, autor text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int DEFAULT 0);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, monday_index int, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, monday_item_id text, board_id bigint, titulo text, formato text, status_chave text, prazo date, veiculacao date,
      status_em timestamptz, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int DEFAULT 0, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, texto text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_operational_snapshots (id bigserial PRIMARY KEY, data_referencia date NOT NULL UNIQUE, origem text, payload jsonb NOT NULL, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());
    INSERT INTO vybe_pessoas (id, nome, email, admin, monday_user_id) VALUES (1, 'Paulo Martins', 'p@vybe.invalid', true, '68035537'), (2, 'Jady Rocha', 'j@vybe.invalid', false, '900');
    INSERT INTO vybe_escritorio_funcoes VALUES (2, 'criacao');
    INSERT INTO vybe_clientes (id, nome, ativo, status) VALUES (10, 'Alfa', true, 'Ativo'), (11, 'Beta', true, 'Ativo');
    INSERT INTO vybe_status VALUES (${PROD}, 'em_andamento', 'Em andamento', false, 1), (${PROD}, 'finalizado', 'Finalizado', true, 2);
    -- 100: furou a data do cliente ontem; 101: vai ao ar em 5 dias; 102: finalizada anteontem (no prazo).
    INSERT INTO vybe_conteudos (id, monday_item_id, board_id, titulo, status_chave, prazo, veiculacao, status_em) VALUES
      (100, '5001', ${PROD}, 'Post atrasado', 'em_andamento', '${dia(-2)}', '${dia(-1)}', now() - interval '4 days'),
      (101, '5002', ${PROD}, 'Post futuro', 'em_andamento', '${dia(4)}', '${dia(5)}', now()),
      (102, '5003', ${PROD}, 'Post pronto', 'finalizado', '${dia(-3)}', '${dia(-2)}', now() - interval '2 days');
    INSERT INTO vybe_conteudo_responsaveis VALUES (100, 2, 0), (101, 2, 0), (102, 2, 0);
    INSERT INTO vybe_conteudo_clientes VALUES (100, 10), (101, 10), (102, 11);
    INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, em) VALUES (102, 'status', 'Em andamento', 'Finalizado', now() - interval '2 days');
  `);
  // O Diário de 3 dias atrás: duas peças de Produção abertas com a veiculação vencida naquele dia.
  const itens = [1, 2].map((k) => ({ id: String(k), atividade_id: '70' + k, board_id: String(PROD), nome: 'Antiga ' + k, clientes: ['Alfa'], cliente: 'Alfa', status: 'Em andamento',
    prazo_iso: dia(-6), veiculacao_iso: dia(-5), responsavel: 'Jady Rocha', responsavel_ids: ['900'] }));
  await sql`INSERT INTO vybe_operational_snapshots (data_referencia, origem, payload) VALUES (${dia(-3)}::date, 'cron', ${JSON.stringify({ itens })}::jsonb)`;
  await garantirMigracoesIrecity(sql);
  // A nota que a Carteira guardou no mês passado e o funil.
  const mesPassado = dia(-35).slice(0, 7) + '-01';
  await sql`INSERT INTO vybe_carteira_saude_mensal (mes, cliente_id, score, risco, registrado_em) VALUES (${mesPassado}::date, 10, 62, 'medio', ${dia(-35) + 'T15:00:00Z'}::timestamptz)`;
  await sql`INSERT INTO vybe_carteira_clima (cliente_id, pontos, motivo, origem, atualizado_em) VALUES (10, -5, 'reclamou do atraso', 'bot', now())`;
  await sql`INSERT INTO vybe_comercial_capacidade (cargo, capacidade_mensal, atualizado_por) VALUES ('criacao', 40, 1)`;
  await sql`INSERT INTO vybe_crm_oportunidades (chave_empresa, nome, etapa, criado_por, criado_em) VALUES
    ('a', 'Ótica', 'reuniao', 1, ${dia(-20) + 'T12:00:00Z'}::timestamptz), ('b', 'Padaria', 'empresa', 1, ${dia(-9) + 'T12:00:00Z'}::timestamptz)`;
  await sql`INSERT INTO vybe_crm_oportunidades (chave_empresa, nome, etapa, criado_por, criado_em, encerrado_em) VALUES
    ('c', 'Pet', 'ganho', 1, ${dia(-15) + 'T12:00:00Z'}::timestamptz, ${dia(-4) + 'T12:00:00Z'}::timestamptz)`;
  return { db, sql };
}

test('migração das séries: só aditiva, idempotente, e o .sql registrado bate com o servidor', async (t) => {
  for (const c of COMANDOS_HISTORICO) assert.match(c, /IF NOT EXISTS/);
  const arquivo = readFileSync('migrations/2026-11-14-series-historicas.sql', 'utf8');
  assert.doesNotMatch(arquivo, /\bDROP\b|\bALTER\s+TABLE\b.*\bTYPE\b|\bDELETE\b|\bUPDATE\b/i);
  assert.match(arquivo, /CREATE TABLE IF NOT EXISTS vybe_serie_diaria/);
  esquecerMigracoesHistorico();
  const { db, sql } = conexao(); t.after(() => db.close());
  await garantirMigracoesHistorico(sql); esquecerMigracoesHistorico(); await garantirMigracoesHistorico(sql);
  const [r] = await sql`SELECT to_regclass('public.vybe_serie_diaria') IS NOT NULL AS ok`;
  assert.equal(r.ok, true);
});

test('gravação do dia: calcula no servidor, grava uma vez e reconstrói o passado dizendo de onde veio', async (t) => {
  const { db, sql } = await banco(); t.after(() => db.close());
  const r1 = await gravarSeriesDoDia(sql, { dia: HOJE, origem: 'cron', orcamentoMs: 120000 });
  assert.equal(r1.gravado, true, JSON.stringify(r1));
  assert.deepEqual(r1.erros, [], JSON.stringify(r1.erros));
  assert.equal(r1.reconstrucao.erros.length, 0, JSON.stringify(r1.reconstrucao)); assert.equal(r1.reconstrucao.estado, 'ok');
  // Segunda chamada no mesmo dia: não recalcula.
  const r2 = await gravarSeriesDoDia(sql, { dia: HOJE, origem: 'leitura' });
  assert.equal(r2.gravado, false); assert.equal(r2.ja, true); assert.equal(r2.reconstrucao.ja, true);

  const linha = async (serie, sujeito, d = HOJE) => (await sql`SELECT valor::float8 AS valor, extra FROM vybe_serie_diaria WHERE dia = ${d}::date AND serie = ${serie} AND sujeito = ${sujeito}`)[0];
  // Hoje: 1 atrasada (o furo de ontem), a Jady com 2 abertas, a criação com 2 peças abertas de 40 por mês.
  const atr = await linha('atrasadas', 'agencia');
  assert.equal(atr.valor, 1); assert.equal(atr.extra.furos, 1); assert.equal(atr.extra.origem, 'calculo_diario');
  assert.equal((await linha('carga', '2')).valor, 2);
  const cg = await linha('carga_cargo', 'criacao'); assert.equal(cg.valor, 2); assert.equal(cg.extra.capacidade, 40);
  // Saúde da Carteira (a mesma conta da tela) e o clima do grupo.
  const s10 = await linha('saude', '10'); assert.ok(s10.valor < 100 && s10.valor >= 0, JSON.stringify(s10)); assert.equal(s10.extra.nome, 'Alfa');
  assert.ok((await linha('saude_media', 'carteira')).valor != null);
  assert.equal((await linha('clima', '10')).valor, -5);
  // Funil: 2 abertas agora.
  assert.equal((await linha('funil_abertas', 'funil')).valor, 2);
  // Score da semana corrente (dia = segunda), da Jady e a média da equipe.
  assert.ok(await linha('score_semana', '2', segunda(HOJE)));

  // Passado: o Diário de 3 dias atrás (2 atrasadas naquele dia), a nota do mês passado e o CRM.
  const antes = await linha('atrasadas', 'agencia', dia(-3));
  assert.equal(antes.valor, 2); assert.equal(antes.extra.origem, 'snapshot_diario');
  const mensal = await linha('saude', '10', dia(-35)); assert.equal(mensal.valor, 62); assert.equal(mensal.extra.origem, 'saude_mensal');
  const ab = await linha('funil_abertas', 'funil', dia(-10)); assert.equal(ab.valor, 2); assert.equal(ab.extra.origem, 'crm');
  const sc = await sql`SELECT count(*)::int AS n FROM vybe_serie_diaria WHERE serie = 'score_semana' AND extra->>'origem' = 'historico_status'`;
  assert.ok(sc[0].n >= 12);
  // O passado nunca é sobrescrito pela gravação forçada.
  await sql`UPDATE vybe_serie_diaria SET valor = 99 WHERE dia = ${dia(-3)}::date AND serie = 'atrasadas'`;
  await gravarSeriesDoDia(sql, { dia: HOJE, forcar: true });
  assert.equal((await linha('atrasadas', 'agencia', dia(-3))).valor, 99);
});

test('leitura por área: cada tela recebe a sua série; o score é da gestão; limites e meta só dos donos', async (t) => {
  const { db, sql } = await banco(); t.after(() => db.close());
  await gravarSeriesDoDia(sql, { dia: HOJE, orcamentoMs: 120000 });

  const setor = await lerSeries(sql, paulo, { para: 'setor' });
  assert.deepEqual(setor.atrasadas.pontos.map((p) => p.valor), [2, 1]);
  assert.deepEqual(setor.atrasadas.origens.sort(), ['calculo_diario', 'snapshot_diario']);
  assert.equal(setor.carga['2'].nome, 'Jady Rocha');
  assert.equal(setor.limite.padrao, LIMITE_CARGA_PADRAO);
  assert.equal(setor.pode.limite, true);
  assert.equal((await lerSeries(sql, jady, { para: 'setor' })).pode.limite, false);

  const cli = await lerSeries(sql, jady, { para: 'cliente', id: '10' });
  assert.equal(cli.saude.pontos.length, 2); assert.equal(cli.saude.pontos[0].valor, 62);
  assert.equal(cli.clima.pontos[0].valor, -5);
  const cart = await lerSeries(sql, jady, { para: 'carteira' });
  assert.equal(cart.media.pontos.length, 2);

  const pg = await lerSeries(sql, paulo, { para: 'pessoas' });
  assert.equal(pg.gestao, true); assert.ok(pg.score['2'] && pg.score.equipe);
  const pj = await lerSeries(sql, jady, { para: 'pessoas' });
  assert.equal(pj.gestao, false); assert.deepEqual(Object.keys(pj.score), ['2']);

  const com = await lerSeries(sql, jady, { para: 'comercial' });
  assert.equal(com.carga.criacao.meses.at(-1).valor, 2);
  assert.ok(com.leads.pontos.length >= 2); assert.ok(com.abertas.pontos.length > 10);

  // Limite de carga e meta dos agentes: só um dono grava.
  await assert.rejects(escreverSeries(sql, jady, { acao: 'limite_carga', padrao: 6 }), /Só um dono/);
  const lim = await escreverSeries(sql, paulo, { acao: 'limite_carga', padrao: 6, pessoas: { 2: 9 } });
  assert.deepEqual(lim.limite.pessoas, { 2: 9 }); assert.equal(lim.limite.padrao, 6);
  await assert.rejects(escreverSeries(sql, paulo, { acao: 'limite_carga', padrao: 0 }), /1 a 100/);
  await assert.rejects(escreverSeries(sql, jady, { acao: 'meta_acerto', meta: 80 }), /Só um dono/);
  assert.equal((await lerSeries(sql, jady, { para: 'agentes' })).meta.meta, META_ACERTO_PADRAO);
  await escreverSeries(sql, paulo, { acao: 'meta_acerto', meta: 80 });
  // Acerto dos agentes: a tela manda o que a central calculou; o último do dia vale; setor inválido é recusado.
  await escreverSeries(sql, jady, { acao: 'acerto', agentes: { comercial: 70, producao: 150 } });
  await escreverSeries(sql, jady, { acao: 'acerto', agentes: { comercial: 72.5 } });
  await assert.rejects(escreverSeries(sql, jady, { acao: 'acerto', agentes: { 'x;drop': 1 } }), /Setor inválido/);
  const ag = await lerSeries(sql, jady, { para: 'agentes' });
  assert.equal(ag.meta.meta, 80);
  assert.deepEqual(ag.acerto.comercial.pontos.map((p) => p.valor), [72.5]);
  assert.equal(ag.acerto.producao, undefined);

  // A rota: GET grava o dia se ninguém gravou; para inválido responde 400.
  esquecerConferencia();
  const r = resposta(); await areaSeries({ method: 'GET', query: { para: 'setor' } }, r, jady, sql);
  assert.equal(r.codigo, 200); assert.equal(r.body.atrasadas.pontos.at(-1).valor, 1);
  const r2 = resposta(); await areaSeries({ method: 'GET', query: { para: 'nada' } }, r2, jady, sql);
  assert.equal(r2.codigo, 400);
});

test('reconstrução em lotes: orçamento de tempo, continua de onde parou e chega ao mesmo resultado', async (t) => {
  const { db, sql } = await banco(); t.after(() => db.close());
  await garantirMigracoesHistorico(sql);
  // Orçamento zero: uma unidade por chamada (1 dia de snapshot, a nota mensal, 12 semanas de score, o CRM = 15 lotes).
  let chamadas = 0, r;
  do { r = await reconstruirPassado(sql, HOJE, { orcamentoMs: 0 }); chamadas++; assert.ok(chamadas < 40, 'não terminou'); } while (r.estado !== 'ok');
  assert.equal(chamadas, 15);
  assert.deepEqual(r.erros, []);
  const marca = await reconstrucaoAtual(sql);
  assert.equal(marca.estado, 'ok'); assert.equal(marca.progresso.snap, dia(-3)); assert.equal(marca.progresso.scoreK, 0);
  // Feita: a próxima chamada não refaz nada.
  assert.deepEqual(await reconstruirPassado(sql, HOJE, { orcamentoMs: 0 }), { ja: true, emAndamento: false });
  const linha = async (serie, sujeito, d) => (await sql`SELECT valor::float8 AS valor, extra FROM vybe_serie_diaria WHERE dia = ${d}::date AND serie = ${serie} AND sujeito = ${sujeito}`)[0];
  assert.equal((await linha('atrasadas', 'agencia', dia(-3))).valor, 2);
  assert.equal((await linha('saude', '10', dia(-35))).valor, 62);
  const sc = await sql`SELECT count(DISTINCT dia)::int AS n FROM vybe_serie_diaria WHERE serie = 'score_semana' AND extra->>'origem' = 'historico_status'`;
  assert.equal(sc[0].n, 12);
  // Outra chamada com a marca em "trabalhando" recente não entra junto.
  await sql`UPDATE vybe_serie_diaria SET extra = jsonb_set(extra, '{estado}', '"trabalhando"'::jsonb), gravado_em = now() WHERE serie = 'reconstrucao'`;
  assert.equal((await reconstruirPassado(sql, HOJE)).emAndamento, true);
});

test('GET da tela: só grava o dia (sem reconstruir) e, se a gravação falhar, devolve as séries que já existem', async (t) => {
  const { db, sql } = await banco(); t.after(() => db.close());
  esquecerConferencia();
  const r = resposta(); await areaSeries({ method: 'GET', query: { para: 'setor' } }, r, jady, sql);
  assert.equal(r.codigo, 200);
  assert.deepEqual(r.body.atrasadas.pontos.map((p) => p.dia), [HOJE]); // o dia; o passado fica para o cron
  assert.equal(await reconstrucaoAtual(sql), null);
  // Banco que recusa gravar: a tela recebe 200 com o que já está guardado.
  const quebrado = (parts, ...params) => { const txt = parts.join('?'); if (/INSERT INTO vybe_serie_diaria/.test(txt)) return Promise.reject(new Error('sem gravação')); return sql(parts, ...params); };
  quebrado.query = sql.query; quebrado.comTransacao = sql.comTransacao;
  await sql`DELETE FROM vybe_serie_diaria WHERE serie = 'gravacao'`;
  esquecerConferencia();
  const r2 = resposta(); await areaSeries({ method: 'GET', query: { para: 'setor' } }, r2, jady, quebrado);
  assert.equal(r2.codigo, 200, JSON.stringify(r2.body));
  assert.deepEqual(r2.body.atrasadas.pontos.map((p) => p.valor), [1]);
});
