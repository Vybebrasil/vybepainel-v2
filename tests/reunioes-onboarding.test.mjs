// Reuniões e onboarding (server/reunioes.js, Paulo 09/11/2026): o link serve para o cliente e para preencher junto;
// acessos vão para o cofre e nunca voltam para a página; reunião com ata e pauta sugerida.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { garantirSchemaReunioes, linkDoOnboarding, paginaDoOnboarding, salvarReuniao, listarReunioes, sugerirPauta, respostasDoOnboarding } from '../server/reunioes.js';

function resposta() {
  const r = { code: 0, corpo: null, html: '', headers: {} };
  return Object.assign(r, { status(c) { r.code = c; return r; }, json(v) { r.corpo = v; return r; }, send(h) { r.html = h; return r; }, setHeader(k, v) { r.headers[k] = v; return r; } });
}

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_clientes (id bigserial primary key, nome text, ativo boolean default true, apagado_em timestamptz, cnpj text, segmento text,
      endereco text, email text, telefone text, plano text, valor numeric, ultima_reuniao date);
    CREATE TABLE vybe_acessos (id bigserial primary key, nome text, cliente_id bigint, pasta_drive text, link text, doc_conteudo text, doc_atualizado_em timestamptz, atualizado_em timestamptz);
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int default 0);
    INSERT INTO vybe_clientes (nome) VALUES ('Lil');`);
  await garantirSchemaReunioes(sql);
  return { db, sql };
}

test('link do onboarding: página abre, salva cadastro, respostas e SWOT; acessos vão para o cofre e não voltam', async () => {
  const { db, sql } = await banco();
  try {
    const { url } = await linkDoOnboarding(sql, 1, { painel: 'https://painel.test' });
    const token = url.split('/onboarding/')[1];
    assert.match(url, /^https:\/\/painel\.test\/onboarding\/[A-Za-z0-9_-]{30,}$/);

    const r1 = resposta(); await paginaDoOnboarding({ method: 'GET', query: { t: token } }, r1, sql);
    assert.equal(r1.code, 200); assert.match(r1.html, /Bem-vindo à Vybe, Lil!/); assert.match(r1.html, /Análise SWOT/);
    assert.doesNotMatch(r1.html, /Valor mensal|Dia do vencimento/); // contrato fica fora do link

    const r2 = resposta();
    await paginaDoOnboarding({ method: 'POST', query: { t: token, junto: '1' }, body: {
      campos: { cidade: 'Irecê', contato_nome: 'Larissa', instagram: '@lil', valor: '9999' },
      respostas: { publico: 'Mulheres 25-40 em Irecê', forcas: 'Marca conhecida pela VOA' },
      acessos: { instagram: '@lil / senha-secreta-123' } } }, r2, sql);
    assert.equal(r2.code, 200, JSON.stringify(r2.corpo)); assert.equal(r2.corpo.acessos_recebidos, 1);
    const [c] = await sql`SELECT valor, cadastro, onboarding_respostas FROM vybe_clientes WHERE id=1`;
    assert.equal(c.cadastro.contato_nome, 'Larissa'); assert.equal(c.valor, null); // dinheiro não entra pelo link
    assert.equal(c.onboarding_respostas.publico, 'Mulheres 25-40 em Irecê'); assert.equal(c.onboarding_respostas._por, 'reuniao');
    const [a] = await sql`SELECT doc_conteudo FROM vybe_acessos WHERE cliente_id=1`;
    assert.match(a.doc_conteudo, /Recebido pelo onboarding \(na reunião\)[\s\S]*senha-secreta-123/);

    const r3 = resposta(); await paginaDoOnboarding({ method: 'GET', query: { t: token } }, r3, sql);
    assert.doesNotMatch(r3.html, /senha-secreta-123/); assert.match(r3.html, /Mulheres 25-40 em Irecê/);
    const r4 = resposta(); await paginaDoOnboarding({ method: 'GET', query: { t: 'x'.repeat(32) } }, r4, sql);
    assert.equal(r4.code, 404);
    assert.equal((await respostasDoOnboarding(sql, 1)).link_ativo, true);
  } finally { await db.close(); }
});

test('reunião: cria com ata, lista, atualiza e a pauta sugerida retoma a última', async () => {
  const { db, sql } = await banco();
  try {
    const r = await salvarReuniao(sql, { clienteId: 1, tipo: 'onboarding', data: '2026-11-10', titulo: 'Entrada da Lil', participantes: 'Paulo, Larissa', ata: 'Combinamos 3 posts por semana.', autor: 'Paulo' });
    assert.equal(r.tipo, 'onboarding'); assert.equal(r.estado, 'com_ata');
    const lista = await listarReunioes(sql, 1);
    assert.equal(lista.length, 1); assert.equal(lista[0].titulo, 'Entrada da Lil');
    const pauta = await sugerirPauta(sql, 1);
    assert.match(pauta[0], /Retomar o que ficou da reunião de 10\/11\/2026: Combinamos 3 posts/);
    const sem = await salvarReuniao(sql, { clienteId: 1, tipo: 'xpto', ata: '' });
    assert.equal(sem.tipo, 'rotina'); assert.equal(sem.estado, 'registrada');
    await assert.rejects(() => salvarReuniao(sql, { clienteId: 0 }), /Escolha o cliente/);
  } finally { await db.close(); }
});

test('fase 2: o bot recebe o áudio em trechos, devolve a transcrição e as demandas viram Solicitações', async () => {
  const { reunioesParaTranscrever, trechoDaGravacao, guardarTranscricao, cadastrarDemandasDaReuniao, registrarGravacao } = await import('../server/reunioes.js');
  const { db, sql } = await banco();
  try {
    const r = await salvarReuniao(sql, { clienteId: 1, tipo: 'onboarding', titulo: 'Entrada da Lil', data: '2026-11-10', ata: '' });
    const total = 6 * 1024 * 1024;
    await registrarGravacao(sql, r.id, { driveId: 'arq-1', bytes: total });
    const fila = await reunioesParaTranscrever(sql);
    assert.deepEqual(fila.map((x) => [x.id, x.cliente, x.arquivo, x.bytes]), [[r.id, 'Lil', 'arq-1', total]]);

    const pedidos = [];
    const baixar = async (arq, de, ate) => { pedidos.push([arq, de, ate]); return Buffer.alloc(ate - de + 1, 1); };
    let inicio = 0, partes = 0, t;
    do { t = await trechoDaGravacao(sql, { id: r.id, inicio }, baixar); inicio += Buffer.from(t.conteudo, 'base64').length; partes++; } while (!t.fim);
    assert.equal(inicio, total); assert.equal(partes, 3); // 2,5 + 2,5 + 1 MB

    await guardarTranscricao(sql, { id: r.id, transcricao: 'Larissa: queremos lançar a Lil em dezembro...', resumo: 'Lançamento da Lil em dezembro.',
      decisoes: ['3 posts por semana'], demandas: [{ titulo: 'Card - Lançamento da Lil', formato: 'Card', prazo: '2026-11-20', responsavel: 'Jady' }, { titulo: '' }] });
    const [depois] = await listarReunioes(sql, 1);
    assert.equal(depois.estado, 'transcrita'); assert.equal(depois.ata, 'Lançamento da Lil em dezembro.'); // ata vazia recebe o resumo
    assert.equal(depois.sugestoes.demandas.length, 1);
    assert.equal((await reunioesParaTranscrever(sql)).length, 0);

    const criadas = [];
    sql.comTransacao = (fn) => fn(sql);
    const res = await cadastrarDemandasDaReuniao(sql, { pessoa: { id: 1 } }, { id: r.id, demandas: depois.sugestoes.demandas },
      { boardDemandas: 8385559107, criarConteudoNaTransacao: async (tx, quem, d) => { criadas.push(d); return { conteudo_id: 900 + criadas.length }; } });
    assert.equal(res.criadas.length, 1);
    assert.equal(criadas[0].cliente, 'Lil'); assert.equal(criadas[0].status, 'nova_demanda'); assert.equal(criadas[0].board, 8385559107);
    assert.match(criadas[0].briefing, /Saiu da reunião "Entrada da Lil" de 10\/11\/2026\.[\s\S]*Responsável sugerido: Jady/);
    const [fim] = await listarReunioes(sql, 1);
    assert.equal(fim.estado, 'cadastrada'); assert.equal(fim.sugestoes.cadastradas[0].conteudo_id, '901');
  } finally { await db.close(); }
});

// O questionário alimenta o ecossistema (server/onboarding-contexto.js): esteira marcada sozinha, regras do cliente,
// memória do VYBES, contexto do Augusto e conector dos chats.
test('questionário salvo marca a esteira, vira regra e chega no Augusto', async () => {
  const { db, sql } = await banco();
  try {
    const { ETAPAS_PADRAO } = await import('../server/carteira.js');
    await db.exec(`CREATE TABLE vybe_carteira_config (chave text primary key, valor jsonb, atualizado_por bigint);
      CREATE TABLE vybe_cliente_onboarding (cliente_id bigint primary key, etapas jsonb not null default '{}'::jsonb, iniciado_em timestamptz default now(),
        iniciado_por bigint, encerrado_em timestamptz, atualizado_em timestamptz default now());
      INSERT INTO vybe_cliente_onboarding (cliente_id) VALUES (1);`);
    assert.ok(ETAPAS_PADRAO.length);
    const { salvarOnboarding } = await import('../server/reunioes.js');
    const [c] = await sql`SELECT * FROM vybe_clientes WHERE id=1`;
    const r = await salvarOnboarding(sql, c, { respostas: { publico: 'Mulheres 25-40 em Irecê', tom: 'Leve, sem gíria', nao_fazer: 'Usar gíria\n- Foto com fundo escuro' },
      acessos: { instagram: '@lil / senha' } }, { por: 'reuniao' });
    assert.equal(r.marcados, 2); assert.equal(r.regras_novas, 2);
    const [o] = (await db.query('SELECT etapas FROM vybe_cliente_onboarding WHERE cliente_id=1')).rows;
    assert.equal(o.etapas.kickoff.feitos.briefing.por, 'Vybe OS (automático)');
    assert.ok(o.etapas.acessos.feitos.logins);
    const regras = (await db.query('SELECT texto FROM vybe_ai_regras_cliente WHERE cliente_id=1 ORDER BY id')).rows.map((x) => x.texto);
    assert.deepEqual(regras, ['Nunca: Usar gíria', 'Nunca: Foto com fundo escuro']);
    // Salvar de novo não repete regra nem marca.
    const [c2] = await sql`SELECT * FROM vybe_clientes WHERE id=1`;
    const r2 = await salvarOnboarding(sql, c2, { respostas: { nao_fazer: 'Usar gíria' } });
    assert.equal(r2.marcados, 0); assert.equal(r2.regras_novas, 0);

    // Kickoff: só a pauta não marca; com ata marca reunião e ata.
    const k = await salvarReuniao(sql, { clienteId: 1, tipo: 'onboarding', pauta: '- Lançamento' });
    let [e] = (await db.query('SELECT etapas FROM vybe_cliente_onboarding WHERE cliente_id=1')).rows;
    assert.equal(e.etapas.kickoff.feitos.reuniao, undefined);
    await salvarReuniao(sql, { id: k.id, tipo: 'onboarding', ata: 'Lançar em dezembro' });
    [e] = (await db.query('SELECT etapas FROM vybe_cliente_onboarding WHERE cliente_id=1')).rows;
    assert.ok(e.etapas.kickoff.feitos.reuniao && e.etapas.kickoff.feitos.ata);

    // Quem lê: Augusto (fichaParaCopy) e o texto do onboarding.
    const { fichaParaCopy } = await import('../server/copy-cliente.js');
    const ficha = await fichaParaCopy(sql, 1);
    assert.match(ficha, /Cliente ideal: Mulheres 25-40 em Irecê/); assert.match(ficha, /Como a marca fala: Leve, sem gíria/);
    const { respostasEmLinhas } = await import('../server/onboarding-contexto.js');
    assert.ok(respostasEmLinhas({ publico: 'x y', _por: 'link' }).every((l) => !l.includes('_por')));
  } finally { await db.close(); }
});

test('memória do VYBES mostra o que o cliente contou no onboarding', async () => {
  const { mensagemMemoria } = await import('../server/assistente-memoria.js');
  const t = mensagemMemoria({ cliente: 'Lil', dias: 120, busca: '', comentarios: [], alteracoes: [], onboarding: ['- Cliente ideal: Mulheres 25-40'] });
  assert.match(t, /O cliente contou no onboarding\*\n- Cliente ideal: Mulheres 25-40/);
  assert.doesNotMatch(t, /Nenhum comentário/);
});
