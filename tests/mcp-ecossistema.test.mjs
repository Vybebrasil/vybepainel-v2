// Conector "Ecossistema Vybe" (server/mcp-ecossistema.js): uma conversa do Claude.ai simulada de ponta a ponta,
// no Postgres em memória. Chave errada não entra, cliente errado não vira cliente novo, Drive que falha não perde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { areaMcp, atenderMensagem, contaDaChave, lerChaves, acharCliente } from '../server/mcp-ecossistema.js';

const CHAVES = lerChaves('gestao:' + 'a'.repeat(32) + ',segunda:' + 'b'.repeat(32) + ',curta:123');

function resposta() { const r = { code: 0, corpo: null }; return Object.assign(r, { status(c) { r.code = c; return r; }, json(v) { r.corpo = v; return r; }, end() { return r; }, setHeader() { return r; } }); }

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigserial primary key, nome text, ativo boolean default true, nao_e_cliente boolean default false,
      apagado_em timestamptz, cnpj text, segmento text, endereco text, email text, telefone text, plano text, valor numeric, cadastro jsonb not null default '{}');
    INSERT INTO vybe_clientes(nome, segmento, plano, valor, cadastro) VALUES
      ('Academia Lions','Academia','Plus',1500,'{"contato_nome":"Carla","grupo_whatsapp":"Lions x Vybe","vencimento":"10"}'),
      ('Gonzalez Gastronomia','Restaurante',null,null,'{}'), ('Gonzalez Advocacia','Advocacia',null,null,'{}');
    INSERT INTO vybe_clientes(nome, ativo) VALUES ('Cliente Antigo', false);`);
  return { db, sql };
}

test('chave: só as de 24+ caracteres valem e cada uma diz a conta', () => {
  assert.deepEqual(CHAVES.map((c) => c.conta), ['gestao', 'segunda']);
  assert.equal(contaDaChave('b'.repeat(32), CHAVES), 'segunda');
  assert.equal(contaDaChave('errada', CHAVES), null);
  assert.equal(contaDaChave('', CHAVES), null);
});

test('nome do cliente: exato, parecido único, ou a lista — nunca chuta', () => {
  const lista = [{ nome: 'Academia Lions' }, { nome: 'Gonzalez Gastronomia' }, { nome: 'Gonzalez Advocacia' }];
  assert.equal(acharCliente('academia lions', lista).nome, 'Academia Lions');
  assert.equal(acharCliente('Lions', lista).nome, 'Academia Lions');
  assert.throws(() => acharCliente('Gonzalez', lista), /Mais de um cliente parecido/);
  assert.throws(() => acharCliente('Padaria Nova', lista), /não encontrado/);
});

test('conversa completa: initialize, lista, consulta e registro com cópia no Drive', async () => {
  const { db, sql } = await banco();
  try {
    const salvos = [];
    const salvarNoDrive = async (a) => { salvos.push(a); return 'drive-123'; };
    const chamar = async (corpo, chave = 'a'.repeat(32)) => { const r = resposta(); await areaMcp({ method: 'POST', query: { chave }, body: corpo }, r, sql, { chaves: CHAVES, salvarNoDrive }); return r; };

    assert.equal((await chamar({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, 'errada')).code, 404);
    const ini = await chamar({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    assert.equal(ini.corpo.result.serverInfo.name, 'ecossistema-vybe');
    assert.equal((await chamar({ jsonrpc: '2.0', method: 'notifications/initialized' })).code, 202);
    const lista = await chamar({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual(lista.corpo.result.tools.map((t) => t.name), ['listar_clientes', 'consultar_cliente', 'registrar', 'propor_pacote_producao']);

    const ativos = await chamar({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'listar_clientes', arguments: {} } });
    assert.match(ativos.corpo.result.content[0].text, /Academia Lions/);
    assert.doesNotMatch(ativos.corpo.result.content[0].text, /Cliente Antigo/);

    const errado = await chamar({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'registrar', arguments: { cliente: 'Padaria Nova', tipo: 'decisao', titulo: 'x', resumo: 'y' } } });
    assert.equal(errado.corpo.result.isError, true);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_clientes`)[0].n, 4); // não criou cliente

    const ok = await chamar({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'registrar', arguments: {
      cliente: 'lions', tipo: 'regra_de_marca', titulo: 'Sem fundo preto', status: 'aprovado', resumo: 'Cliente pediu fundos claros.', decisoes: 'Nunca usar fundo preto.' } } });
    assert.equal(ok.corpo.result.isError, false, ok.corpo.result.content[0].text);
    assert.match(ok.corpo.result.content[0].text, /Registrado em Academia Lions/);
    assert.equal(salvos[0].cliente.nome, 'Academia Lions');
    assert.match(salvos[0].markdown, /origem: Claude.ai \(gestao\)/);
    assert.equal((await sql`SELECT drive_id FROM vybe_cliente_registros`)[0].drive_id, 'drive-123');

    const ficha = await chamar({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'consultar_cliente', arguments: { cliente: 'Academia Lions' } } });
    const texto = ficha.corpo.result.content[0].text;
    assert.match(texto, /Nome do responsável: Carla/);
    assert.match(texto, /Sem fundo preto/);
    assert.doesNotMatch(texto, /1500|Dia do vencimento/); // dinheiro não sai para o chat
  } finally { await db.close(); }
});

test('Drive fora do ar não perde o registro', async () => {
  const { db, sql } = await banco();
  try {
    const saida = await atenderMensagem(sql, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'registrar', arguments: {
      cliente: 'Gonzalez Gastronomia', tipo: 'conteudo', titulo: 'Post do almoço', resumo: 'Legenda aprovada.' } } },
      { conta: 'segunda', salvarNoDrive: async () => { throw new Error('Drive 503'); } });
    assert.match(saida.result.content[0].text, /falhou agora; o registro está salvo/);
    const [r] = await sql`SELECT origem, drive_id, drive_erro FROM vybe_cliente_registros`;
    assert.equal(r.origem, 'Claude.ai · segunda');
    assert.equal(r.drive_id, null);
    assert.match(r.drive_erro, /503/);
  } finally { await db.close(); }
});

test('tipo inválido e método desconhecido respondem sem quebrar', async () => {
  const { db, sql } = await banco();
  try {
    const t = await atenderMensagem(sql, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'registrar', arguments: { cliente: 'Academia Lions', tipo: 'fofoca', titulo: 'a', resumo: 'b' } } }, { conta: 'gestao' });
    assert.equal(t.result.isError, true);
    assert.equal((await atenderMensagem(sql, { jsonrpc: '2.0', id: 2, method: 'resources/list' }, { conta: 'gestao' })).error.code, -32601);
  } finally { await db.close(); }
});

test('o conector que os chats já têm (area=agentes) ganha consultar_cliente e registrar', async () => {
  const { conectorAgentes } = await import('../server/planejamentos-api.js');
  const { db, sql } = await banco();
  const antes = process.env.AGENTES_CHAVE;
  process.env.AGENTES_CHAVE = 'c'.repeat(32);
  try {
    const chamar = async (corpo) => { const r = resposta(); await conectorAgentes({ method: 'POST', query: { chave: 'c'.repeat(32) }, body: corpo }, r, sql, { salvarNoDrive: async () => 'drive-9' }); return r; };
    const nomes = (await chamar({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).corpo.result.tools.map((t) => t.name);
    assert.deepEqual(nomes, ['listar_clientes', 'formato_do_planejamento', 'publicar_planejamento', 'ver_planejamento', 'consultar_cliente', 'registrar']);
    const ok = await chamar({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'registrar', arguments: { cliente: 'Academia Lions', tipo: 'aprendizado', titulo: 'Horário bom', resumo: 'Posts às 18h rendem mais.' } } });
    assert.match(ok.corpo.result.content[0].text, /Registrado em Academia Lions/);
    const errado = await chamar({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'registrar', arguments: { cliente: 'Gonzalez', tipo: 'aprendizado', titulo: 'x', resumo: 'y' } } });
    assert.equal(errado.corpo.result.isError, true);
    assert.match(errado.corpo.result.content[0].text, /Mais de um cliente parecido/);
    assert.equal((await sql`SELECT origem FROM vybe_cliente_registros`)[0].origem, 'Claude.ai · conector dos agentes');
  } finally { process.env.AGENTES_CHAVE = antes; await db.close(); }
});

test('Drive voltou: o próximo registro reenvia as cópias que tinham falhado', async () => {
  const { db, sql } = await banco();
  try {
    let fora = true; const enviados = [];
    const salvarNoDrive = async (a) => { if (fora) throw new Error('Drive 404'); enviados.push(a.nome); return 'id-' + enviados.length; };
    const reg = (titulo) => atenderMensagem(sql, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'registrar', arguments: {
      cliente: 'Academia Lions', tipo: 'aprendizado', titulo, resumo: 'r' } } }, { conta: 'gestao', salvarNoDrive });
    await reg('Primeiro'); await reg('Segundo');
    fora = false;
    await reg('Terceiro');
    assert.equal(enviados.length, 3);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_cliente_registros WHERE drive_id IS NULL`)[0].n, 0);
  } finally { await db.close(); }
});
test('regra de marca registrada pelo chat vira regra do cliente (revisão de arte, legendas, memória), sem repetir', async () => {
  const { regrasDoRegistro } = await import('../server/mcp-ecossistema.js');
  const { regrasDoCliente } = await import('../server/assistente-regras.js');
  assert.deepEqual(regrasDoRegistro({ decisoes: '- Nunca usar fundo preto\n2) Laranja só em destaque\n\nok' }), ['Nunca usar fundo preto', 'Laranja só em destaque']);
  const { db, sql } = await banco();
  try {
    const registrar = (decisoes) => atenderMensagem(sql, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'registrar', arguments: {
      cliente: 'Academia Lions', tipo: 'regra_de_marca', titulo: 'Regras de cor', resumo: 'Cores da marca.', decisoes } } }, { conta: 'gestao' });
    const a = await registrar('- Nunca usar fundo preto\n- Laranja só em destaque');
    assert.match(a.result.content[0].text, /2 regra\(s\) nova\(s\)/);
    const b = await registrar('- nunca usar fundo preto\n- Fonte sempre Montserrat');
    assert.match(b.result.content[0].text, /1 regra\(s\) nova\(s\)/);
    assert.deepEqual((await regrasDoCliente(sql, 1)).sort(), ['Fonte sempre Montserrat', 'Laranja só em destaque', 'Nunca usar fundo preto']);
  } finally { await db.close(); }
});

test('memória do VYBES mostra o que os chats decidiram', async () => {
  const { mensagemMemoria } = await import('../server/assistente-memoria.js');
  const t = mensagemMemoria({ cliente: 'Academia Lions', dias: 120, busca: '', comentarios: [], alteracoes: [], regras: [],
    chats: [{ titulo: 'Horário bom', resumo: 'Posts às 18h rendem mais.', decisoes: null, criado_em: '2026-11-09T16:00:00Z' }] });
  assert.match(t, /Decidido e aprendido nos chats do Claude/);
  assert.match(t, /09\/11 · Horário bom: Posts às 18h/);
  assert.doesNotMatch(t, /Nenhum comentário/);
});

test('regras de marca registradas antes da conversão viram regras uma vez só', async () => {
  const { converterRegrasPendentes, garantirTabelaDeRegistros } = await import('../server/mcp-ecossistema.js');
  const { regrasDoCliente } = await import('../server/assistente-regras.js');
  const { db, sql } = await banco();
  try {
    await sql`CREATE TABLE vybe_cliente_registros (id BIGSERIAL PRIMARY KEY, cliente_id BIGINT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL,
      status TEXT NOT NULL, resumo TEXT NOT NULL, decisoes TEXT, proximos TEXT, conteudo TEXT, origem TEXT NOT NULL, drive_id TEXT, drive_erro TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`INSERT INTO vybe_cliente_registros (cliente_id, tipo, titulo, status, resumo, decisoes, origem) VALUES
      (1, 'regra_de_marca', 'Cores', 'aprovado', 'r', '- Nunca fundo preto
- Laranja só em destaque', 'Claude.ai · antigo'),
      (1, 'aprendizado', 'Horário', 'aprovado', 'Posts às 18h', null, 'Claude.ai · antigo')`;
    await garantirTabelaDeRegistros(sql); // cria a coluna e converte o que estava pendente
    assert.deepEqual((await regrasDoCliente(sql, 1)).sort(), ['Laranja só em destaque', 'Nunca fundo preto']);
    assert.deepEqual(await converterRegrasPendentes(sql), { registros: 0, regras: 0 });
    assert.equal((await regrasDoCliente(sql, 1)).length, 2);
  } finally { await db.close(); }
});
