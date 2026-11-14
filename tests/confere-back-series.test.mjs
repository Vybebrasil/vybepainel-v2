// Confere do back (14/11/2026): séries históricas — A3 (erro parcial vira 'parcial' e só a parte que falhou é refeita; a
// linha de hoje vale 2 h; a semana que fechou é regravada uma vez), item 1 da liga (o servidor põe o risco operacional
// da tela nas peças: mesma nota e mesmo "em risco"), item 5 (limite_dia), item 7 (carteira e comercial só da gestão),
// M6 (acerto só de dono), B4 (meta de acerto: um leitor e um padrão) e "pronta" no score. SAFE: PGlite em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { garantirMigracoesIrecity, esquecerMigracoesIrecity } from '../server/migracoes-irecity.js';
import { esquecerMigracoesHistorico } from '../server/migracoes-historico.js';
import { gravarSeriesDoDia, garantirGravacaoDoDia, lerSeries, escreverSeries, areaSeries, hojeBahia, esquecerConferencia, pecasDoBanco,
  calcularDia, metaAcerto, LIMITE_DIA_PADRAO, META_ACERTO_PADRAO } from '../server/series-historicas.js';
import { lerMetasD3 } from '../server/campos-d3.js';
import { scoresDoPeriodo } from '../server/pessoas.js';

const PROD = 7829537690;
const HOJE = hojeBahia();
const dia = (n) => new Date(Date.parse(HOJE + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const segundaDe = (iso) => { const d = new Date(iso + 'T12:00:00Z'); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };
const quem = (id, nome, monday) => ({ tipo: 'sessao', pessoa: { id, nome, monday_user_id: monday } });
const paulo = quem(1, 'Paulo Martins', '68035537'), jady = quem(2, 'Jady Rocha', '900'), beatriz = quem(3, 'Beatriz', '71130408');
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });

async function banco(t) {
  esquecerMigracoesIrecity(); esquecerMigracoesHistorico(); esquecerConferencia();
  const { db, sql } = conexao(); t.after(() => db.close());
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
    INSERT INTO vybe_pessoas (id, nome, email, monday_user_id) VALUES (1,'Paulo Martins','p@vybe.invalid','68035537'), (2,'Jady Rocha','j@vybe.invalid','900'), (3,'Beatriz','b@vybe.invalid','71130408');
    INSERT INTO vybe_escritorio_funcoes VALUES (2, 'criacao');
    INSERT INTO vybe_clientes (id, nome, ativo, status) VALUES (10, 'Alfa', true, 'Ativo'), (11, 'Beta', true, 'Ativo');
    INSERT INTO vybe_cliente_pessoas VALUES (10, 2, 0);
    INSERT INTO vybe_status VALUES (${PROD},'em_andamento','Em andamento',false,1), (${PROD},'finalizado','Finalizado',true,2), (${PROD},'agendado','Agendado',true,3);
    -- 100: furou ontem; 101: prazo hoje, vai ao ar amanhã (a tela marca "Prazo hoje", risco alto); 102: finalizada; 103: Agendada.
    INSERT INTO vybe_conteudos (id, monday_item_id, board_id, titulo, status_chave, prazo, veiculacao, status_em) VALUES
      (100,'5001',${PROD},'Post atrasado','em_andamento','${dia(-2)}','${dia(-1)}', now() - interval '4 days'),
      (101,'5002',${PROD},'Post de hoje','em_andamento','${HOJE}','${dia(1)}', now() - interval '1 hour'),
      (102,'5003',${PROD},'Post pronto','finalizado','${dia(-3)}','${dia(-2)}', now() - interval '1 hour'),
      (103,'5004',${PROD},'Post agendado','agendado','${dia(1)}','${dia(2)}', now() - interval '1 hour');
    INSERT INTO vybe_conteudo_responsaveis VALUES (100,2,0),(101,2,0),(102,2,0),(103,2,0);
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,10),(102,11),(103,11);
    INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, em) VALUES (102,'status','Em andamento','Finalizado', now() - interval '1 hour');`);
  await garantirMigracoesIrecity(sql);
  await sql`INSERT INTO vybe_crm_oportunidades (chave_empresa, nome, etapa, criado_por) VALUES ('a', 'Ótica', 'reuniao', 1)`;
  return { db, sql };
}
const marca = async (sql) => (await sql`SELECT extra FROM vybe_serie_diaria WHERE serie='gravacao' AND sujeito='dia' AND dia=${HOJE}::date`)[0]?.extra;
const valor = async (sql, serie, sujeito, d = HOJE) => (await sql`SELECT valor::float8 AS v, extra FROM vybe_serie_diaria WHERE dia=${d}::date AND serie=${serie} AND sujeito=${sujeito}`)[0];

test('A3: erro numa parte fica "parcial" e a leitura seguinte refaz só ela', async (t) => {
  const { db, sql } = await banco(t);
  await db.exec('ALTER TABLE vybe_crm_oportunidades RENAME TO crm_fora');
  const r1 = await gravarSeriesDoDia(sql, { origem: 'cron', reconstruir: false });
  assert.equal(r1.estado, 'parcial'); assert.deepEqual(r1.falhas, ['funil']);
  assert.equal((await marca(sql)).estado, 'parcial', "antes: 'ok' e ninguém refazia até amanhã");
  const atrasadasAntes = await valor(sql, 'atrasadas', 'agencia');
  await db.exec('ALTER TABLE crm_fora RENAME TO vybe_crm_oportunidades');
  esquecerConferencia();
  const r2 = await garantirGravacaoDoDia(sql);
  assert.deepEqual(r2.partes, ['funil'], 'só a parte que falhou');
  assert.equal(r2.estado, 'ok');
  assert.equal((await valor(sql, 'funil_abertas', 'funil')).v, 1);
  assert.equal((await valor(sql, 'atrasadas', 'agencia')).v, atrasadasAntes.v);
  assert.equal((await marca(sql)).estado, 'ok');
});

test('A3: a linha de hoje vale 2 h: antes disso a leitura não regrava; depois, regrava leve (sem reconstrução)', async (t) => {
  const { sql } = await banco(t);
  await gravarSeriesDoDia(sql, { origem: 'cron', reconstruir: false });
  const antes = (await valor(sql, 'atrasadas', 'agencia')).v;
  await sql`UPDATE vybe_conteudos SET prazo=${dia(-3)}::date, veiculacao=${dia(-1)}::date WHERE id=101`; // atrasou depois da meia-noite
  esquecerConferencia();
  assert.equal((await garantirGravacaoDoDia(sql)).ja, true, 'gravação fresca: nada a fazer');
  assert.equal((await valor(sql, 'atrasadas', 'agencia')).v, antes);
  await sql`UPDATE vybe_serie_diaria SET gravado_em = now() - interval '3 hours' WHERE serie='gravacao' AND sujeito='dia'`;
  esquecerConferencia();
  const r = await garantirGravacaoDoDia(sql);
  assert.equal(r.gravado, true); assert.equal(r.reconstrucao, undefined);
  assert.equal((await valor(sql, 'atrasadas', 'agencia')).v, antes + 1, 'antes: a série de hoje ficava a da meia-noite');
  // Na mesma instância, a próxima leitura não pergunta de novo ao banco (10 min).
  assert.equal(await garantirGravacaoDoDia(sql), null);
});

test('A3: a semana que acabou de fechar é regravada uma vez com a semana inteira', async (t) => {
  const { sql } = await banco(t);
  const anterior = dia(-7) < segundaDe(HOJE) ? segundaDe(dia(-7)) : null;
  await sql`CREATE TABLE IF NOT EXISTS vybe_serie_diaria_marca (x int)`;
  await gravarSeriesDoDia(sql, { origem: 'cron', reconstruir: false });
  // Uma linha da semana passada gravada no meio dela (o cron de quarta), antes de a semana fechar.
  await sql`INSERT INTO vybe_serie_diaria (dia, serie, sujeito, valor, extra, gravado_em) VALUES (${anterior}::date, 'score_semana', '2', 10, '{}'::jsonb, ${anterior + 'T15:00:00Z'}::timestamptz + interval '2 days')
    ON CONFLICT (dia, serie, sujeito) DO UPDATE SET valor = 10, gravado_em = EXCLUDED.gravado_em`;
  await gravarSeriesDoDia(sql, { origem: 'manual', forcar: true, reconstruir: false });
  const [l] = await sql`SELECT valor, (gravado_em AT TIME ZONE 'America/Bahia')::date::text AS em FROM vybe_serie_diaria WHERE dia=${anterior}::date AND serie='score_semana' AND sujeito='2'`;
  assert.ok(l.em >= segundaDe(HOJE), 'regravada depois de a semana fechar');
  assert.notEqual(Number(l.valor), 10);
  // E não de novo: a linha agora é de depois do fechamento.
  const antes = l.em;
  await gravarSeriesDoDia(sql, { origem: 'manual', forcar: true, reconstruir: false });
  const [l2] = await sql`SELECT (gravado_em AT TIME ZONE 'America/Bahia')::date::text AS em FROM vybe_serie_diaria WHERE dia=${anterior}::date AND serie='score_semana' AND sujeito='2'`;
  assert.equal(l2.em, antes);
});

test('liga 1: o servidor põe o risco operacional da tela: mesmo "em risco" e mesma nota com o mesmo dado', async (t) => {
  const { sql } = await banco(t);
  // A tela: as mesmas peças, com o operational_risk que vybe-risco.js põe ("Prazo hoje" → high na 101).
  const ctx = vm.createContext({ window: {} });
  for (const f of ['vybe-dono-metricas.js', 'vybe-carteira-saude.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx);
  const D = ctx.VybeDono || ctx.window.VybeDono, S = ctx.VybeCarteiraSaude || ctx.window.VybeCarteiraSaude;
  const tela = (await pecasDoBanco(sql, HOJE)).map((p) => ({ ...p, operational_risk: { level: p.id === '5002' ? 'high' : 'safe' } }));
  const prod = tela.filter((p) => p.origem !== 'solicitacao');
  const cad = [{ id: '10', nome: 'Alfa', ativo: true, status: 'Ativo', heads: 'Jady Rocha' }, { id: '11', nome: 'Beta', ativo: true, status: 'Ativo', heads: '' }];
  const naTela = JSON.parse(JSON.stringify(D.calcular({ demandas: prod, clientes: cad, pessoas: { 900: 'Jady Rocha' }, hoje: HOJE })));
  const { linhas } = await calcularDia(sql, HOJE);
  const atr = linhas.find((l) => l.serie === 'atrasadas');
  assert.ok(naTela.hoje.emRisco >= 1);
  assert.equal(atr.extra.emRisco, naTela.hoje.emRisco, 'antes: o servidor gravava 0');
  const notaTela = JSON.parse(JSON.stringify(S.calcular({ demandas: tela, clientes: cad, sinais: null, clima: null, hoje: HOJE }))).clientes.find((c) => c.id === '10');
  const notaServidor = linhas.find((l) => l.serie === 'saude' && l.sujeito === '10');
  assert.equal(notaServidor.valor, notaTela.score);
});

test('pronta = só Finalizado também no score: a peça Agendada não conta como entrega', async (t) => {
  const { sql } = await banco(t);
  const de = HOJE.slice(0, 8) + '01';
  const [j] = (await scoresDoPeriodo(sql, { de, ate: HOJE, hoje: HOJE })).filter((p) => p.id === '2');
  assert.equal(j.entregues, 1, 'antes: 2 (a Agendada contava pelo vybe_status.final)');
});

test('liga 5, 7, M6 e B4: limite por dia, séries da gestão, acerto só de dono e um leitor da meta', async (t) => {
  const { sql } = await banco(t);
  await gravarSeriesDoDia(sql, { origem: 'cron', reconstruir: false });
  const coord = await lerSeries(sql, beatriz, { para: 'setor' });
  assert.deepEqual([coord.limite_dia.padrao, coord.pode.limite_dia, coord.pode.limite], [LIMITE_DIA_PADRAO, true, false]);
  assert.equal(LIMITE_DIA_PADRAO, 5);
  const gravou = await escreverSeries(sql, beatriz, { acao: 'limite_dia', padrao: 4, pessoas: { 2: 6 } });
  assert.deepEqual(gravou.limite_dia.pessoas, { 2: 6 });
  assert.equal((await lerSeries(sql, paulo, { para: 'setor' })).limite_dia.padrao, 4);
  assert.equal((await lerSeries(sql, paulo, { para: 'setor' })).limite.padrao, 8, 'limite_carga (peças abertas) continua separado');
  await assert.rejects(escreverSeries(sql, jady, { acao: 'limite_dia', padrao: 9 }), (e) => e.status === 403);
  // Séries da carteira e do Comercial: gestão (o Comercial também de quem tem acesso a ele).
  for (const para of ['carteira', 'comercial']) {
    const r = resposta(); await areaSeries({ method: 'GET', query: { para } }, r, jady, sql);
    assert.equal(r.codigo, 403, para);
    const c = resposta(); await areaSeries({ method: 'GET', query: { para } }, c, beatriz, sql);
    assert.equal(c.codigo, 200, para);
  }
  // Acerto dos agentes: 403 para quem não é dono.
  const a = resposta(); await areaSeries({ method: 'POST', body: { acao: 'acerto', agentes: { comercial: 90 } } }, a, beatriz, sql);
  assert.equal(a.codigo, 403);
  const b = resposta(); await areaSeries({ method: 'POST', body: { acao: 'acerto', agentes: { comercial: 90 } } }, b, paulo, sql);
  assert.equal(b.codigo, 200);
  // Meta de acerto: o mesmo padrão e o mesmo valor nas duas áreas.
  assert.equal(META_ACERTO_PADRAO, 75);
  assert.equal((await metaAcerto(sql)).meta, 75); assert.equal((await lerMetasD3(sql)).agentes_acerto, 75);
  await escreverSeries(sql, paulo, { acao: 'meta_acerto', meta: 82 });
  assert.equal((await lerMetasD3(sql)).agentes_acerto, 82);
  assert.equal((await metaAcerto(sql)).meta, 82);
});

test('liga 2: a nota do mês é calculada no servidor (a mesma da série); o que o navegador manda é ignorado; só dono', async (t) => {
  const { sql } = await banco(t);
  const { areaCarteira } = await import('../server/carteira.js');
  const pedir = async (quem) => { const r = resposta(); await areaCarteira({ method: 'POST', body: { acao: 'saude_registrar', itens: [{ cliente_id: 10, score: 1, risco: 'baixo' }] }, query: {} }, r, quem, () => sql); return r; };
  assert.equal((await pedir(jady)).codigo, 403, 'antes: qualquer sessão gravava a nota que quisesse');
  assert.equal((await pedir(beatriz)).codigo, 403);
  const r = await pedir(paulo);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const [s] = await sql`SELECT score, risco FROM vybe_carteira_saude_mensal WHERE cliente_id = 10`;
  const { linhas } = await calcularDia(sql, HOJE);
  const serie = linhas.find((l) => l.serie === 'saude' && l.sujeito === '10');
  assert.notEqual(s.score, 1);
  assert.equal(s.score, Math.round(serie.valor));
  assert.equal(s.risco, serie.extra.risco);
});

test('a Vercel leva junto todo arquivo que as séries leem do disco (senão a conta falha em silêncio no ar)', async () => {
  const { readFileSync } = await import('node:fs');
  const inc = JSON.stringify(JSON.parse(readFileSync('vercel.json', 'utf8')));
  const serie = readFileSync('server/series-historicas.js', 'utf8');
  for (const arq of new Set([...serie.matchAll(/'(vybe-[a-z-]+\.js)'/g)].map((m) => m[1]))) assert.ok(inc.includes(arq), `${arq} fora do includeFiles`);
});
