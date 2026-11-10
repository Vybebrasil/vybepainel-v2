// SAFE: sem rede, banco em memória. Uma regra de dono só (server/donos.js), a sessão dizendo quem é dono, a ponte da
// carteira do bot (area=carteira&canal=bot) e a publicação do túnel com o WhatsApp desconectado (Paulo, 08/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { ehDonoPessoa, mondayDaPessoa, DONOS_MONDAY } from '../server/donos.js';
import { sessaoDoPedido, assinarSessao } from '../vybe_sessao.js';
import { areaCarteiraBot } from '../server/carteira.js';
import { atenderBotAssistente } from '../server/assistente-servico.js';
import { esquecerTabelasVybes } from '../server/vybes.js';

const token = 'b'.repeat(48);
const config = { VYBE_AI_ATIVA: '1', VYBE_AI_BOT_TOKEN: token, VYBE_AI_LINK_SECRET: 's'.repeat(40) };
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });

test('dono: o id do Monday dos quatro, VYBE_AI_ADMIN_PESSOA_ID ou VYBE_DONOS_IDS; nunca o primeiro nome', () => {
  assert.deepEqual(Object.values(DONOS_MONDAY), ['Paulo', 'Vinícius', 'Ewerton', 'Deivid']);
  for (const m of Object.keys(DONOS_MONDAY)) assert.equal(ehDonoPessoa({ id: 50, nome: 'X', monday_user_id: m }, {}), true);
  assert.equal(ehDonoPessoa({ id: 50, nome: 'Paulo Souza', monday_user_id: '1' }, {}), false, 'homônimo');
  assert.equal(ehDonoPessoa({ id: 50, nome: 'Vinícius' }, {}), false);
  assert.equal(ehDonoPessoa({ id: 7, nome: 'X' }, { VYBE_AI_ADMIN_PESSOA_ID: '7' }), true);
  assert.equal(ehDonoPessoa({ id: 8, nome: 'X' }, { VYBE_DONOS_IDS: '3, 8' }), true);
  assert.equal(ehDonoPessoa({ id: 9, admin: true }, {}), false, 'administrar não é ser dono');
  assert.equal(ehDonoPessoa(null), false);
});

test('sessão: dono vem do banco a cada pedido (id do Monday), e /api/sessao manda para as telas', async () => {
  const antes = process.env.SESSAO_SECRET; process.env.SESSAO_SECRET = 'x'.repeat(40);
  try {
    const cookie = (id) => ({ headers: { cookie: 'vybe_sessao=' + encodeURIComponent(assinarSessao({ id, nome: 'N', email: 'e', admin: false, versao: 1 })) } });
    const pessoa = (m) => async (id) => ({ id, nome: 'Vinícius Damascena', email: 'v@x', ativo: true, pode_entrar: true, admin: false, senha_hash: 'h', sessao_versao: 1, monday_user_id: m });
    assert.equal((await sessaoDoPedido(cookie(3), { buscarPessoa: pessoa('68035653') })).dono, true);
    assert.equal((await sessaoDoPedido(cookie(3), { buscarPessoa: pessoa('555') })).dono, false);
    // Dono sem a marca de administrador no cadastro (o Vinícius, 10/11/2026) passa nas telas e rotas de quem administra.
    assert.equal((await sessaoDoPedido(cookie(3), { buscarPessoa: pessoa('68035653') })).admin, true);
    assert.equal((await sessaoDoPedido(cookie(3), { buscarPessoa: pessoa('555') })).admin, false);
    assert.equal((await sessaoDoPedido(cookie(3), { buscarPessoa: pessoa(null) })).dono, false);
    assert.match(readFileSync('api/sessao.js', 'utf8'), /dono: Boolean\(sessao\.dono\)/);
  } finally { if (antes === undefined) delete process.env.SESSAO_SECRET; else process.env.SESSAO_SECRET = antes; }
});

test('telas: nenhuma decide dono pelo primeiro nome', () => {
  for (const f of ['vybe-mundo-agentes.js', 'vybe-mundo.js', 'vybe-mundo-cliente.js', 'vybe-mundo-comercial.js', 'vybe-mundo-pessoas.js']) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /\['paulo', 'vinicius', 'ewerton', 'deivid'\]/, f);
    assert.match(s, /souDonoDaSessao/, f);
  }
});

test('mondayDaPessoa: lê a coluna e não quebra sem ela', async () => {
  const a = conexao(); await a.db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text); INSERT INTO vybe_pessoas VALUES (1,'P','68035537')`);
  assert.equal(await mondayDaPessoa(a.sql, 1), '68035537'); await a.db.close();
  const b = conexao(); await b.db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text); INSERT INTO vybe_pessoas VALUES (1,'P')`);
  assert.equal(await mondayDaPessoa(b.sql, 1), ''); await b.db.close();
});

const pedidoCarteira = (method = 'GET', acao = 'saude', body) => ({ method, headers: { authorization: 'Bearer ' + token }, query: { area: 'carteira', canal: 'bot', acao }, body });
const semBanco = () => { throw new Error('não deveria abrir o banco'); };

test('ponte da carteira: só com o token do bot, só saúde, onboarding e clima', async () => {
  for (const authorization of ['', 'Bearer ' + 'c'.repeat(48)]) {
    const r = resposta(); const p = pedidoCarteira(); p.headers.authorization = authorization;
    await areaCarteiraBot(p, r, semBanco, config); assert.equal(r.codigo, 401);
  }
  const off = resposta(); await areaCarteiraBot(pedidoCarteira(), off, semBanco, { ...config, VYBE_AI_ATIVA: '0' }); assert.equal(off.codigo, 503);
  for (const [m, a] of [['GET', ''], ['GET', 'contratos'], ['GET', 'clima'], ['POST', 'saude'], ['POST', 'contrato_salvar'], ['POST', 'onboarding_iniciar']]) {
    const r = resposta(); await areaCarteiraBot(pedidoCarteira(m, a), r, semBanco, config); assert.equal(r.codigo, 403, m + ' ' + a);
  }
  const div = resposta(); await areaCarteiraBot(pedidoCarteira('POST', 'clima', { acao: 'contrato_salvar' }), div, semBanco, config); assert.equal(div.codigo, 400);
  const del = resposta(); await areaCarteiraBot(pedidoCarteira('DELETE', 'clima'), del, semBanco, config); assert.equal(del.codigo, 405);
});

test('ponte da carteira: com o token, a leitura chega à Carteira como serviço', async () => {
  let preparou = 0;
  const r = resposta();
  // Sem as tabelas, a Carteira responde "aguardando ativação" (503) — o que importa é ter passado da porta do bot.
  const { db, sql } = conexao();
  try {
    await areaCarteiraBot(pedidoCarteira('GET', 'saude'), r, () => sql, config, async () => { preparou++; });
    assert.equal(preparou, 1); assert.notEqual(r.codigo, 401); assert.notEqual(r.codigo, 403);
  } finally { await db.close(); }
  assert.match(readFileSync('api/painel.js', 'utf8'), /areaPublica === 'carteira' && req\.query\?\.canal === 'bot'/);
});

test('túnel com o WhatsApp do bot desconectado: publica só com a credencial do bot, sem jid', async () => {
  esquecerTabelasVybes();
  const { db, sql } = conexao();
  try {
    await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean); CREATE TABLE vybe_escritorio_avisos_autores (pessoa_id bigint);`);
    const r = resposta();
    await atenderBotAssistente({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: { consulta: 'vybes_publicar', estado: { versao: 2, tunel: 'https://a-b.trycloudflare.com', whatsapp: false } } }, r, () => sql, config);
    assert.equal(r.codigo, 200, JSON.stringify(r.body));
    assert.deepEqual((await sql`SELECT estado FROM vybe_vybes_estado`)[0].estado, { versao: 2, tunel: 'https://a-b.trycloudflare.com', whatsapp: false });
    const ruim = resposta();
    await atenderBotAssistente({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: { consulta: 'vybes_publicar', estado: { tunel: 'https://site.example' } } }, ruim, () => sql, config);
    assert.equal(ruim.codigo, 400);
    const sem = resposta();
    await atenderBotAssistente({ method: 'POST', headers: {}, body: { consulta: 'vybes_publicar', estado: {} } }, sem, () => sql, config);
    assert.equal(sem.codigo, 401);
  } finally { esquecerTabelasVybes(); await db.close(); }
});
