import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { idDoVybes, pessoaDaAcao, EMAIL_VYBES, nomeDoAgente, rotuloDoAgente } from '../server/conta-vybes.js';
import { ehDonoPessoa } from '../server/donos.js';

// Conta própria do VYBES (Paulo, 18/11/2026): migrations/2026-11-18-usuario-vybes.sql e server/conta-vybes.js.
const MIGRACAO = 'migrations/2026-11-18-usuario-vybes.sql';
const sqlMigracao = readFileSync(MIGRACAO, 'utf8');

// vybe_pessoas como o servidor a cria (vybe_dominio_store.js criarSchema + vybe_sessao.js garantirSchemaSessao).
const PESSOAS = `CREATE TABLE vybe_pessoas (id BIGSERIAL PRIMARY KEY, nome TEXT NOT NULL, papel TEXT, disciplina TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE, monday_user_id TEXT UNIQUE, email TEXT UNIQUE, pode_entrar BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_acesso TIMESTAMPTZ, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), foto_url TEXT, ciclo_em TIMESTAMPTZ, apagado_em TIMESTAMPTZ,
    senha_hash TEXT, senha_sal TEXT, admin BOOLEAN NOT NULL DEFAULT FALSE, tentativas INT NOT NULL DEFAULT 0, bloqueado_ate TIMESTAMPTZ,
    sessao_versao INT NOT NULL DEFAULT 0);
  CREATE UNIQUE INDEX vybe_pessoas_email_idx ON vybe_pessoas (LOWER(email)) WHERE email IS NOT NULL;
  INSERT INTO vybe_pessoas (nome, email, monday_user_id, ativo, pode_entrar, senha_hash, admin) VALUES
    ('Paulo', 'paulo@exemplo.invalid', '68035537', TRUE, TRUE, 'h', TRUE),
    ('Jady', 'jady@exemplo.invalid', '71000001', TRUE, TRUE, 'h', FALSE),
    ('Pessoa 9', NULL, '71000009', TRUE, FALSE, NULL, FALSE);`;

async function bancoComVybes() {
  const { db, sql } = conexao();
  await db.exec(PESSOAS);
  await db.exec(sqlMigracao);
  const [v] = await sql`SELECT id::text AS id FROM vybe_pessoas WHERE LOWER(email) = ${EMAIL_VYBES} AND servico`;
  return { db, sql, vybes: v.id };
}

// ---------- 1. a resolução do bot ----------
test('VYBE_VYBES_PESSOA_ID: com a variável o bot é o VYBES; sem ela (ou inválida), continua a conta administradora', () => {
  assert.equal(idDoVybes({ VYBE_VYBES_PESSOA_ID: '42' }), 42);
  for (const v of [undefined, '', '0', '-1', 'abc', '1e3', '12345678901234567890']) assert.equal(idDoVybes({ VYBE_VYBES_PESSOA_ID: v }), null, String(v));
  const priv = { tipo: 'privado' }, grupo = { tipo: 'grupo' };
  const env = { VYBE_AI_ADMIN_PESSOA_ID: '1', VYBE_VYBES_PESSOA_ID: '42' };
  // O bot avisa que é o agente agindo: vira o VYBES.
  assert.equal(pessoaDaAcao(1, { como: 'vybes' }, priv, env), 42);
  // Sem o aviso: a ação é de quem falou (o Paulo pedindo do próprio número continua sendo o Paulo).
  assert.equal(pessoaDaAcao(1, {}, priv, env), 1);
  // Sem a variável: nada muda.
  assert.equal(pessoaDaAcao(1, { como: 'vybes' }, priv, { VYBE_AI_ADMIN_PESSOA_ID: '1' }), 1);
  // Outra pessoa da equipe, ou em grupo: o aviso não vale (ninguém "vira" VYBES pelo WhatsApp).
  assert.equal(pessoaDaAcao(7, { como: 'vybes' }, priv, env), 7);
  assert.equal(pessoaDaAcao(1, { como: 'vybes' }, grupo, env), 1);
});

test('dono: o VYBES é dono só pelo id da variável; a marca de serviço sozinha não dá nada', () => {
  const env = { VYBE_VYBES_PESSOA_ID: '42' };
  assert.equal(ehDonoPessoa({ id: 42 }, env), true);
  assert.equal(ehDonoPessoa({ id: 42 }, {}), false);
  assert.equal(ehDonoPessoa({ id: 43, servico: true }, env), false);
  // Os donos de sempre continuam.
  assert.equal(ehDonoPessoa({ id: 1, monday_user_id: '68035537' }, env), true);
  assert.equal(ehDonoPessoa({ id: 1 }, { VYBE_AI_ADMIN_PESSOA_ID: '1', VYBE_VYBES_PESSOA_ID: '42' }), true);
});

// ---------- 2. a migração ----------
test('migração: nome do arquivo, só aditiva e com o SELECT do id no fim', () => {
  assert.match(MIGRACAO, /^migrations\/\d{4}-\d{2}-\d{2}-usuario-vybes\.sql$/);
  const semComentario = sqlMigracao.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(semComentario, /\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  for (const m of semComentario.matchAll(/ADD COLUMN(?! IF NOT EXISTS)/g)) assert.fail('ADD COLUMN sem IF NOT EXISTS: ' + m.index);
  assert.match(semComentario, /IF NOT EXISTS \(SELECT 1 FROM pg_constraint/);
  assert.match(semComentario, /WHERE NOT EXISTS \(SELECT 1 FROM vybe_pessoas WHERE LOWER\(email\) = 'vybes@vybe\.local'\)/);
  assert.match(semComentario.trim(), /SELECT id, nome, email, ativo, pode_entrar, servico\s+FROM vybe_pessoas\s+WHERE LOWER\(email\) = 'vybes@vybe\.local' AND servico IS TRUE;$/);
  assert.ok(sqlMigracao.includes(EMAIL_VYBES));
});

test('migração: idempotente, cria uma pessoa só e não mexe em ninguém que já existe', async (t) => {
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec(PESSOAS);
  const antes = await sql`SELECT * FROM vybe_pessoas ORDER BY id`;
  await db.exec(sqlMigracao);
  const primeira = await sql`SELECT * FROM vybe_pessoas ORDER BY id`;
  await db.exec(sqlMigracao);
  await db.exec(sqlMigracao);
  const depois = await sql`SELECT * FROM vybe_pessoas ORDER BY id`;
  assert.deepEqual(depois, primeira);
  assert.equal(depois.length, antes.length + 1);
  for (const p of antes) assert.deepEqual(depois.find((x) => x.id === p.id), { ...p, servico: false });
  const v = depois.find((x) => x.servico);
  assert.equal(v.nome, 'VYBES'); assert.equal(v.email, 'vybes@vybe.local');
  assert.equal(v.ativo, true); assert.equal(v.pode_entrar, false); assert.equal(v.admin, false);
  assert.equal(v.monday_user_id, null); assert.equal(v.senha_hash, null); assert.equal(v.ciclo_em, null);
  // O SELECT do fim devolve o id (é o que o Paulo cola em VYBE_VYBES_PESSOA_ID).
  const r = await db.exec(sqlMigracao);
  assert.deepEqual(r.at(-1).rows.map((x) => String(x.id)), [String(v.id)]);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'vybe_pessoas_servico_sem_acesso'`;
  assert.equal(n, 1);
});

test('migração: roda numa base antiga, sem as colunas da sessão', async (t) => {
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id BIGSERIAL PRIMARY KEY, nome TEXT NOT NULL, papel TEXT, ativo BOOLEAN NOT NULL DEFAULT TRUE,
    monday_user_id TEXT UNIQUE, email TEXT UNIQUE, pode_entrar BOOLEAN NOT NULL DEFAULT FALSE);`);
  await db.exec(sqlMigracao); await db.exec(sqlMigracao);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_pessoas WHERE servico`)[0].n, 1);
});

test('conta de serviço nunca entra: o banco recusa acesso, senha, id do Monday e admin; a equipe segue livre', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  for (const set of ['pode_entrar = TRUE', "senha_hash = 'x'", "monday_user_id = '999'", 'admin = TRUE'])
    await assert.rejects(db.query(`UPDATE vybe_pessoas SET ${set} WHERE id = $1`, [vybes]), /vybe_pessoas_servico_sem_acesso/, set);
  await sql`UPDATE vybe_pessoas SET pode_entrar = FALSE WHERE email = 'jady@exemplo.invalid'`;
  await sql`UPDATE vybe_pessoas SET pode_entrar = TRUE WHERE email = 'jady@exemplo.invalid'`;
});

test('sincronizarEquipe: a carga do Monday não toca nem apaga o VYBES (e a trava do servidor é SQL válido)', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  const fonte = readFileSync('vybe_dominio_store.js', 'utf8');
  const sinc = fonte.slice(fonte.indexOf('export async function sincronizarEquipe'), fonte.indexOf('export async function definirAcesso'));
  assert.match(sinc, /WHERE vybe_pessoas\.apagado_em IS NULL AND \(to_jsonb\(vybe_pessoas\) ->> 'servico'\) IS DISTINCT FROM 'true'/);
  assert.doesNotMatch(sinc, /DELETE|ativo\s*=\s*FALSE/);
  const antes = await sql`SELECT * FROM vybe_pessoas WHERE id = ${vybes}`;
  // A mesma instrução do servidor, com a lista que viria do Monday (o VYBES não está nela).
  const usuarios = [{ nome: 'Paulo Martins', email: 'paulo@exemplo.invalid', monday_user_id: '68035537' }, { nome: 'Nova', email: 'nova@exemplo.invalid', monday_user_id: '71000077' }];
  await sql`INSERT INTO vybe_pessoas (nome, email, monday_user_id, ativo)
    SELECT u.nome, LOWER(u.email), u.monday_user_id, TRUE
    FROM jsonb_to_recordset(${JSON.stringify(usuarios)}::jsonb) AS u(nome text, email text, monday_user_id text)
    ON CONFLICT (monday_user_id) DO UPDATE SET
      nome = EXCLUDED.nome,
      email = COALESCE(EXCLUDED.email, vybe_pessoas.email),
      ativo = CASE WHEN vybe_pessoas.ciclo_em IS NULL THEN TRUE ELSE vybe_pessoas.ativo END
    WHERE vybe_pessoas.apagado_em IS NULL AND (to_jsonb(vybe_pessoas) ->> 'servico') IS DISTINCT FROM 'true'`;
  assert.deepEqual(await sql`SELECT * FROM vybe_pessoas WHERE id = ${vybes}`, antes);
  assert.equal((await sql`SELECT nome FROM vybe_pessoas WHERE monday_user_id = '68035537'`)[0].nome, 'Paulo Martins');
});

// ---------- 3. fora das listas da equipe ----------
test('listas: a regra única da equipe, o "Para quem" do financeiro e a tela de Equipe deixam o VYBES de fora', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  // A regra única (server/pessoas.js, carteira, heads, Escritório, comercial): ativo AND pode_entrar.
  const equipe = await sql`SELECT id::text AS id, nome FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome`;
  assert.deepEqual(equipe.map((p) => p.nome), ['Jady', 'Paulo']);
  // Rostos do login (vybe_sessao.js listarRostos).
  assert.equal((await sql`SELECT id FROM vybe_pessoas WHERE pode_entrar AND senha_hash IS NOT NULL AND ativo`).some((p) => String(p.id) === vybes), false);
  // Listas de responsáveis e automações (pelo id do Monday).
  assert.equal((await sql`SELECT id FROM vybe_pessoas WHERE monday_user_id IS NOT NULL`).some((p) => String(p.id) === vybes), false);
  const { pessoasDoTime } = await import('../server/financeiro.js');
  const time = await pessoasDoTime(sql);
  assert.ok(time.some((p) => p.nome === 'Paulo')); assert.equal(time.some((p) => p.id === vybes), false);
  // Sem a coluna (antes da migração) a mesma consulta funciona e devolve todos.
  const { db: db2, sql: sql2 } = conexao(); t.after(() => db2.close());
  await db2.exec(PESSOAS);
  assert.equal((await pessoasDoTime(sql2)).length, 3);
  // As consultas alteradas que dependem do banco global: mesma condição, conferida no texto e executada aqui.
  const NAO_SERVICO = "(to_jsonb(p) ->> 'servico') IS DISTINCT FROM 'true'";
  for (const [arq, trecho] of [['vybe_sessao.js', 'FROM vybe_pessoas p WHERE email IS NOT NULL AND apagado_em IS NULL'], ['vybe_observabilidade.js', 'FROM vybe_pessoas p WHERE ativo AND'], ['server/campos-d3.js', 'FROM vybe_pessoas p WHERE COALESCE(p.ativo, true)']]) {
    const fonte = readFileSync(arq, 'utf8'), i = fonte.indexOf(trecho);
    assert.ok(i >= 0, arq); assert.ok(fonte.slice(i, i + 300).includes(NAO_SERVICO), arq);
  }
  const lista = await sql.query(`SELECT id, nome FROM vybe_pessoas p WHERE email IS NOT NULL AND apagado_em IS NULL
      AND ${NAO_SERVICO} -- comentário como no servidor
    ORDER BY ativo DESC, pode_entrar DESC, nome`);
  assert.deepEqual(lista.map((p) => p.nome), ['Jady', 'Paulo']);
});

test('senha e acesso: o painel e o banco recusam a conta de serviço', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  const painel = readFileSync('api/painel.js', 'utf8');
  assert.match(painel, /O VYBES é uma conta de serviço: não tem senha nem entra no painel\./);
  const sessao = readFileSync('vybe_sessao.js', 'utf8');
  assert.equal((sessao.match(/UPDATE vybe_pessoas p\r?\n[\s\S]{0,600}?\(to_jsonb\(p\) ->> 'servico'\) IS DISTINCT FROM 'true'/g) || []).length, 2);
  // O mesmo UPDATE de definirSenha: para o VYBES não acha ninguém (e não viola a regra do banco).
  const r = await sql`UPDATE vybe_pessoas p SET senha_hash = 'h', senha_sal = 's', pode_entrar = TRUE, admin = COALESCE(NULL::boolean, admin)
    WHERE LOWER(email) = LOWER(${EMAIL_VYBES}) AND (to_jsonb(p) ->> 'servico') IS DISTINCT FROM 'true' RETURNING id`;
  assert.deepEqual(r, []);
  assert.equal((await sql`SELECT pode_entrar FROM vybe_pessoas WHERE id = ${vybes}`)[0].pode_entrar, false);
});

// ---------- 4. autoria: o que o VYBES grava sai com o autor VYBES ----------
test('ações: a conta do VYBES age (dona pela variável) e sai com o próprio nome; outra conta de serviço não', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text); INSERT INTO vybe_clientes VALUES (5, 'Cliente Teste');`);
  const { prepararAcao } = await import('../server/assistente-acoes.js');
  const segredo = 's'.repeat(40), pedido = { acao: 'agendar_captacao', encaixe: '2099-12-01|5@10:00-11:00' };
  const antes = process.env.VYBE_VYBES_PESSOA_ID;
  t.after(() => { if (antes === undefined) delete process.env.VYBE_VYBES_PESSOA_ID; else process.env.VYBE_VYBES_PESSOA_ID = antes; });
  delete process.env.VYBE_VYBES_PESSOA_ID;
  // Sem a variável a conta não age (pode_entrar FALSE): nada muda antes de o Paulo colar o id.
  await assert.rejects(prepararAcao(sql, Number(vybes), pedido, segredo), /Pessoa sem acesso/);
  process.env.VYBE_VYBES_PESSOA_ID = vybes;
  const r = await prepararAcao(sql, Number(vybes), pedido, segredo);
  assert.equal(JSON.parse(Buffer.from(r.codigo.split('.')[0], 'base64url').toString()).p, vybes);
  // Outra conta marcada como serviço, sem ser a da variável: recusada.
  await sql`INSERT INTO vybe_pessoas (nome, email, ativo, pode_entrar, servico) VALUES ('Outro', 'outro@vybe.local', TRUE, FALSE, TRUE)`;
  const [outro] = await sql`SELECT id FROM vybe_pessoas WHERE email = 'outro@vybe.local'`;
  await assert.rejects(prepararAcao(sql, Number(outro.id), pedido, segredo), /Pessoa sem acesso/);
  // No histórico da peça, "VYBES" (sem o "(WhatsApp)" das pessoas).
  const fonte = readFileSync('server/assistente-acoes.js', 'utf8');
  assert.equal((fonte.match(/nome: rotuloDoAutor\(p, agente\)/g) || []).length, 4);
  assert.doesNotMatch(fonte, /nome: `\$\{p\.nome\} \(WhatsApp\)`/);
});

test('revisão de arte do Danilo: com a conta do VYBES o comentário sai como "Danilo · VYBES"; sem ela, "Vybe IA"', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    INSERT INTO vybe_conteudos VALUES (100,7829537690,'Card','Card',NULL,'a',555);`);
  const { comentarRevisao } = await import('../server/assistente-revisao-arte.js');
  const feitos = [], executar = { comentar: async (_s, quem) => feitos.push(quem) };
  await comentarRevisao(sql, '555', 'ok', { executar, autorId: Number(vybes) });
  await comentarRevisao(sql, '555', 'ok', { executar });
  // Um id que não é conta de serviço não vira autor por aqui.
  await comentarRevisao(sql, '555', 'ok', { executar, autorId: 1 });
  assert.deepEqual(feitos[0], { tipo: 'sessao', pessoa: { id: Number(vybes), nome: 'Danilo · VYBES', email: 'vybes@vybe.local' } });
  assert.equal(feitos[1].pessoa.nome, 'Vybe IA'); assert.equal(feitos[2].pessoa.nome, 'Vybe IA');
});

test('bot: as consultas da administração gravam com o autor VYBES e as ações aceitam como: vybes', () => {
  const fonte = readFileSync('server/assistente-servico.js', 'utf8');
  assert.match(fonte, /const autorId = idDoVybes\(config\) \?\? pessoaId;/);
  assert.match(fonte, /registrarPeloAgente\(banco, autorId,/);
  assert.match(fonte, /comentarRevisao\(banco, req\.body\?\.item, req\.body\?\.texto, \{ autorId: idDoVybes\(config\) \}\)/);
  assert.match(fonte, /const pessoaId = pessoaDaAcao\(await autorizarConversa\(banco, jid, contexto, segredo, config\), req\.body, contexto, config\);/);
  // O pacote de produção continua sendo do dono que deu o ok (não passa pelo como: 'vybes').
  const pacote = fonte.slice(fonte.indexOf("consulta === 'pacote_executar' || consulta === 'pacote_recusar'"));
  assert.match(pacote.slice(0, 300), /const pessoaId = await autorizarConversa\(banco, jid, contexto, segredo, config\);/);
});

// ---------- 5. o nome do agente (Paulo, 19/11/2026: "os comentários e mensagens dos agentes vão como eles") ----------
test('nome do agente: só letras, espaço e hífen, até 40; o resto (e "VYBES") fica só VYBES', () => {
  for (const [v, esperado] of [['Heitor', 'Heitor'], ['  Alex  ', 'Alex'], ['Otávio', 'Otávio'], ['Cícero', 'Cícero'], ['Ana Maria', 'Ana Maria'], ['Jean-Luc', 'Jean-Luc']]) assert.equal(nomeDoAgente(v), esperado, v);
  for (const v of [undefined, null, '', ' ', 'VYBES', 'vybes', 'Heitor <b>', 'Heitor1', 'Paulo (WhatsApp)', 'Heitor · VYBES', '-Heitor', 'Heitor-', 'a'.repeat(41), 42, ['Heitor'], { nome: 'Heitor' }]) assert.equal(nomeDoAgente(v), null, String(v));
  assert.equal(rotuloDoAgente('Heitor'), 'Heitor · VYBES');
  assert.equal(rotuloDoAgente('Heitor', 'VYBES'), 'Heitor · VYBES');
  assert.equal(rotuloDoAgente(''), 'VYBES'); assert.equal(rotuloDoAgente('<script>', 'VYBES'), 'VYBES');
});

test('ações: com o agente, o comentário sai "Heitor · VYBES" pela conta do VYBES; sem agente, "VYBES"; pessoa da equipe nunca assina como agente', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  const PROD = 7829537690;
  await db.exec(`CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,formato text,board_id bigint,status_chave text,removido_em timestamptz);
    INSERT INTO vybe_conteudos VALUES(10,NULL,'Card A','Card',${PROD},'pode_fazer',NULL);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text); INSERT INTO vybe_status VALUES(${PROD},'pode_fazer','Pode Fazer');
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text); INSERT INTO vybe_clientes VALUES(7,'Hebravet');
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint); INSERT INTO vybe_conteudo_clientes VALUES(10,7);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint);`);
  const { prepararAcao, confirmarAcao } = await import('../server/assistente-acoes.js');
  const segredo = 's'.repeat(40), antes = process.env.VYBE_VYBES_PESSOA_ID;
  t.after(() => { if (antes === undefined) delete process.env.VYBE_VYBES_PESSOA_ID; else process.env.VYBE_VYBES_PESSOA_ID = antes; });
  process.env.VYBE_VYBES_PESSOA_ID = vybes;
  const [jady] = await sql`SELECT id FROM vybe_pessoas WHERE email = 'jady@exemplo.invalid'`;
  const feitos = [], executar = { comentar: async (_s, quem, a) => feitos.push({ quem, a }) };
  const comentar = async (pessoa, agente) => {
    const c = await prepararAcao(sql, Number(pessoa), { acao: 'comentar', item: 'vybe:10', texto: 'Veicula hoje e ainda está em Pode Fazer.' }, segredo);
    await confirmarAcao(sql, Number(pessoa), c.codigo, segredo, { executar, ...(agente === undefined ? {} : { agente }) });
    return feitos.at(-1).quem.pessoa;
  };
  const heitor = await comentar(vybes, 'Heitor');
  assert.deepEqual({ id: heitor.id, nome: heitor.nome, email: heitor.email }, { id: Number(vybes), nome: 'Heitor · VYBES', email: EMAIL_VYBES });
  assert.equal(feitos.at(-1).a.texto, 'Veicula hoje e ainda está em Pode Fazer.');
  assert.equal((await comentar(vybes)).nome, 'VYBES');
  assert.equal((await comentar(vybes, 'Heitor <img onerror=x>')).nome, 'VYBES');
  assert.equal((await comentar(vybes, 'VYBES')).nome, 'VYBES');
  // A mesma conta e a mesma permissão: só o nome muda.
  assert.equal((await comentar(vybes, 'Alex')).id, Number(vybes));
  assert.equal((await comentar(jady.id, 'Heitor')).nome, 'Jady (WhatsApp)');
  // O uso único continua registrando a conta do VYBES.
  const ids = (await sql`SELECT DISTINCT pessoa_id::text AS id FROM vybe_ai_acoes ORDER BY 1`).map((x) => x.id);
  assert.deepEqual(ids.sort(), [String(jady.id), vybes].sort());
});

test('servidor: o agente vale só quando a ação virou do VYBES, e passa pela conferência do nome', () => {
  const fonte = readFileSync('server/assistente-servico.js', 'utf8');
  assert.match(fonte, /const agente = pessoaId === idDoVybes\(config\) \? nomeDoAgente\(req\.body\?\.agente\) : null;/);
  assert.match(fonte, /confirmarAcao\(banco, pessoaId, req\.body\?\.codigo, segredo, \{ agente \}\)/);
});

test('Impressões: registro do Nestor pela conta do VYBES aparece "Nestor · VYBES"; pessoa da equipe segue com o nome dela', async (t) => {
  const { db, sql, vybes } = await bancoComVybes();
  t.after(() => db.close());
  const fonte = readFileSync('server/impressoes.js', 'utf8');
  assert.match(fonte, /COALESCE\(\(to_jsonb\(p\) ->> 'servico'\) = 'true', false\) AS autor_servico/);
  assert.match(fonte, /\.map\(autorDoEvento\)/);
  // A mesma consulta dos eventos, executada aqui, e o mesmo tratamento do servidor.
  await db.exec(`CREATE TABLE vybe_impressao_eventos(id bigserial PRIMARY KEY, impressao_id bigint, de text, para text, nota text, autor_id bigint, em timestamptz DEFAULT now());
    INSERT INTO vybe_impressao_eventos(impressao_id, de, para, nota, autor_id) VALUES
      (1, NULL, 'orcamento', 'Nestor, pela conversa com Gráfica X: “sai sexta”', ${vybes}),
      (1, 'orcamento', 'aprovado', 'Aprovado pelo cliente', 1),
      (1, 'aprovado', 'aprovado', 'sem assinatura', ${vybes}),
      (1, 'aprovado', 'pronto', '<b>, pela conversa', ${vybes});`);
  const ids = ['1'];
  const trecho = fonte.slice(fonte.indexOf('const eventos = ids.length ?'), fonte.indexOf('const porImpressao'));
  assert.match(trecho, /FROM vybe_impressao_eventos e LEFT JOIN vybe_pessoas p ON p\.id = e\.autor_id/);
  const linhas = await sql`SELECT e.impressao_id::text AS impressao_id, e.de, e.para, e.nota, p.nome AS autor_nome, e.em,
        COALESCE((to_jsonb(p) ->> 'servico') = 'true', false) AS autor_servico
      FROM vybe_impressao_eventos e LEFT JOIN vybe_pessoas p ON p.id = e.autor_id
     WHERE e.impressao_id::text = ANY(${ids}::text[]) ORDER BY e.em, e.id`;
  const { autorDoEvento } = await import('../server/impressoes.js');
  const eventos = linhas.map(autorDoEvento);
  assert.deepEqual(eventos.map((e) => e.autor_nome), ['Nestor · VYBES', 'Paulo', 'VYBES', 'VYBES']);
  assert.ok(eventos.every((e) => !('autor_servico' in e)));
});
