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
