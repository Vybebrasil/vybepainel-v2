import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { conexao } from './postgres.mjs';
import { guardarEstadoVybes, entradaVybes, estadoVybes, acaoVybes, podeAgirNoVybes, esquecerTabelasVybes } from '../server/vybes.js';

// Paulo (1), Vinícius (2), Ewerton (3) e Deivid (4) são autores de recado hoje; Bia (5) não.
async function banco({ migrar = true } = {}) {
  esquecerTabelasVybes();
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, monday_user_id text);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true,'68035537'),(2,'Vinícius',true,NULL),(3,'Ewerton L.',true,'68036687'),(4,'Deivid',true,'68997024'),(5,'Bia',true,'71130408'),(6,'Vinícius Damascena',true,'68035653');
    CREATE TABLE vybe_escritorio_avisos_autores (pessoa_id bigint PRIMARY KEY);
    INSERT INTO vybe_escritorio_avisos_autores VALUES (1),(2),(3),(4);`);
  if (migrar) await db.exec(readFileSync(new URL('../migrations/2026-11-02-vybes.sql', import.meta.url), 'utf8'));
  return { db, sql };
}
const sessao = (id) => ({ tipo: 'sessao', pessoa: { id } });
const BASE = 'b'.repeat(60);
const env = { VYBE_AI_BOT_TOKEN: BASE, VYBE_AI_ADMIN_PESSOA_ID: '1' };
const TUNEL = 'https://alegre-vybes-123.trycloudflare.com';
// O mesmo conferidor da central (entrada-vybes.js no PC): chave derivada da credencial do bot, HMAC do corpo.
function conferir(token) {
  const chave = createHmac('sha256', BASE).update('vybes-entrada-v1').digest();
  const [corpo, ass] = token.split('.');
  assert.equal(createHmac('sha256', chave).update(corpo).digest('base64url'), ass, 'assinatura que a central aceita');
  return JSON.parse(Buffer.from(corpo, 'base64url').toString());
}

test('vybes: a migração cria o estado e copia quem age (os autores de recado de hoje)', async () => {
  const { sql } = await banco();
  const ops = await sql`SELECT pessoa_id::int AS id FROM vybe_vybes_operadores ORDER BY pessoa_id`;
  assert.deepEqual(ops.map((o) => o.id), [1, 2, 3, 4]);
  assert.equal(await podeAgirNoVybes(sql, sessao(2)), true);
  // Todos da equipe agem (Paulo, 04/11/2026); convidado e serviço, não; pessoa inativa, não.
  assert.equal(await podeAgirNoVybes(sql, sessao(5)), true);
  assert.equal(await podeAgirNoVybes(sql, { tipo: 'servico' }), false);
  await sql`UPDATE vybe_pessoas SET ativo = false WHERE id = 5`;
  assert.equal(await podeAgirNoVybes(sql, sessao(5)), false);
  await sql`UPDATE vybe_pessoas SET ativo = true WHERE id = 5`;
});

test('vybes: o bot publica só o endereço do túnel; endereço de fora do padrão é recusado', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, { tunel: TUNEL, outra: 'coisa' });
  const [l] = await sql`SELECT estado FROM vybe_vybes_estado`;
  assert.deepEqual(l.estado, { versao: 2, tunel: TUNEL, whatsapp: true });
  // WhatsApp do bot desconectado: o túnel continua publicado, com whatsapp:false.
  await guardarEstadoVybes(sql, { tunel: TUNEL, whatsapp: false });
  assert.deepEqual((await sql`SELECT estado FROM vybe_vybes_estado`)[0].estado, { versao: 2, tunel: TUNEL, whatsapp: false });
  await assert.rejects(guardarEstadoVybes(sql, { tunel: 'https://site-qualquer.com' }), /túnel inválido/);
  await assert.rejects(guardarEstadoVybes(sql, [1]), /Estado inválido/);
});

test('vybes: a faixa abre a central com o crachá de quem entrou (age ou só vê; o Paulo é o dono)', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  const agora = Date.now();
  const v = await entradaVybes(sql, sessao(2), { env, agora });
  assert.equal(v.agir, true);
  assert.match(v.url, /^https:\/\/alegre-vybes-123\.trycloudflare\.com\/entrar\?t=/);
  const cv = conferir(decodeURIComponent(v.url.split('t=')[1]));
  // "Vinícius" sem o id do Monday dos donos (homônimo) não é dono: a regra é pelo id (server/donos.js).
  assert.deepEqual({ ...cv, e: 0 }, { p: 2, n: 'Vinícius', a: true, d: false, m: '', e: 0 });
  // Os quatro donos saem com d:true e o id do Monday no crachá; a equipe, d:false.
  for (const [id, m] of [[1, '68035537'], [6, '68035653'], [3, '68036687'], [4, '68997024']]) {
    const c = conferir(decodeURIComponent((await entradaVybes(sql, sessao(id), { env, agora })).url.split('t=')[1]));
    assert.equal(c.d, true, 'dono ' + id); assert.equal(c.m, m);
  }
  assert.equal(conferir(decodeURIComponent((await entradaVybes(sql, sessao(5), { env, agora })).url.split('t=')[1])).d, false, 'Bia não é dona');
  assert.ok(cv.e > agora && cv.e <= agora + 120e3, 'vale 2 min');
  const b = conferir(decodeURIComponent((await entradaVybes(sql, sessao(5), { env, agora })).url.split('t=')[1]));
  assert.equal(b.a, true, 'todos da equipe agem (Paulo, 04/11/2026)');
  assert.equal(conferir(decodeURIComponent((await entradaVybes(sql, sessao(1), { env, agora })).url.split('t=')[1])).d, true);
  await assert.rejects(entradaVybes(sql, { tipo: 'servico' }, { env, agora }), /Entre no painel/);
  await assert.rejects(entradaVybes(sql, sessao(2), { env, agora: agora + 11 * 60e3 }), /desligado agora/);
});

test('vybes: o cartão diz se a central está no ar e se quem olha age', async () => {
  const { sql } = await banco();
  const agora = Date.now();
  assert.deepEqual(await estadoVybes(sql, sessao(2), { agora }), { noAr: false, whatsapp: null, agir: true, dono: false }, 'sem túnel publicado');
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  assert.deepEqual(await estadoVybes(sql, sessao(2), { agora }), { noAr: true, whatsapp: true, agir: true, dono: false });
  // A pessoa 5 tem o id do Monday da coordenação (71130408, Beatriz): no cartão, `dono` é quem aprova os pedidos dos
  // agentes, e isso vale para os donos e a coordenação (Paulo, 13/11/2026). O crachá da central continua d:false para ela.
  assert.deepEqual(await estadoVybes(sql, sessao(5), { agora }), { noAr: true, whatsapp: true, agir: true, dono: true });
  assert.equal(conferir(decodeURIComponent((await entradaVybes(sql, sessao(5), { env, agora })).url.split('t=')[1])).d, false, 'coordenação não vira dona no crachá');
  assert.equal((await estadoVybes(sql, sessao(6), { agora })).dono, true, 'Vinícius (id do Monday) é dono');
  // WhatsApp desconectado: a central continua no ar e o cartão diz "WhatsApp desconectado".
  await guardarEstadoVybes(sql, { tunel: TUNEL, whatsapp: false });
  assert.deepEqual(await estadoVybes(sql, sessao(2), { agora }), { noAr: true, whatsapp: false, agir: true, dono: false });
  assert.deepEqual(await estadoVybes(sql, sessao(5), { agora }), { noAr: true, whatsapp: false, agir: true, dono: true });
  assert.match((await entradaVybes(sql, sessao(5), { env, agora })).url, /\/entrar\?t=/, 'a entrada continua valendo');
  assert.equal((await estadoVybes(sql, sessao(2), { agora: agora + 11 * 60e3 })).noAr, false, 'túnel velho = fora do ar');
  await assert.rejects(estadoVybes(sql, { tipo: 'servico' }, { agora }), /Entre no painel/);
});

test('vybes: quem só vê não toma ação; quem age passa pelo executor das ações (preparar → confirmar)', async () => {
  const { sql } = await banco();
  const segredo = 'x'.repeat(40);
  // Todos da equipe agem; quem não entrou com a conta da equipe (serviço, convidado), não.
  await assert.rejects(acaoVybes(sql, { tipo: 'servico' }, { etapa: 'preparar', pedido: { acao: 'status', item: 'vybe:1', para: 'Para agendar' } }, { segredo }), (e) => e.status === 403 && /conta da equipe/.test(e.message));
  await assert.rejects(acaoVybes(sql, sessao(5), { etapa: 'preparar', pedido: { acao: 'apagar_tudo' } }, { segredo }), /Ação desconhecida/);
  // Operador chega ao executor: uma ação que ele não conhece volta a recusa dele (prova que a chamada foi feita lá).
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'preparar', pedido: { acao: 'apagar_tudo' } }, { segredo }), /Ação desconhecida/);
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'outra' }, { segredo }), /Informe a etapa/);
});

test('vybes: sem a migração rodada, o primeiro uso cria as tabelas e copia quem age uma vez só', async () => {
  const { sql } = await banco({ migrar: false });
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  const ops = await sql`SELECT pessoa_id::int AS id FROM vybe_vybes_operadores ORDER BY pessoa_id`;
  assert.deepEqual(ops.map((o) => o.id), [1, 2, 3, 4]);
  // A tabela não decide mais quem age (todos agem), e o próximo uso não repõe ninguém nela.
  await sql`DELETE FROM vybe_vybes_operadores WHERE pessoa_id = 4`;
  esquecerTabelasVybes();
  assert.equal(await podeAgirNoVybes(sql, sessao(4)), true);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_vybes_operadores`)[0].n, 3);
});

test('vybes: a pergunta da sala vai à central com o crachá de quem chamou e volta com a fala e o áudio', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  const { perguntarVybes } = await import('../server/vybes.js');
  let pedido;
  const fetchImpl = async (url, o) => { pedido = { url, o }; return new Response(JSON.stringify({ ok: true, fala: 'Hoje tem 3 peças pra aprovar, Bia.', audio: 'QUJD', tipo: 'audio/mpeg' }), { status: 200 }); };
  const r = await perguntarVybes(sql, sessao(5), '  Vybes, como tá o dia?  ', { env, fetchImpl });
  assert.equal(pedido.url, TUNEL + '/api/cosmos/sala');
  assert.equal(JSON.parse(pedido.o.body).texto, 'Vybes, como tá o dia?');
  const c = conferir(pedido.o.headers['X-Vybes-Cracha']);
  assert.equal(c.p, 5); assert.equal(c.a, true);
  assert.deepEqual(r, { fala: 'Hoje tem 3 peças pra aprovar, Bia.', audio: 'QUJD', tipo: 'audio/mpeg' });
  // Áudio que não é base64 não passa; recusa da central vira recusa daqui; sem texto, nem pergunta.
  assert.equal((await perguntarVybes(sql, sessao(5), 'oi', { env, fetchImpl: async () => new Response(JSON.stringify({ fala: 'x', audio: '<script>' }), { status: 200 }) })).audio, null);
  await assert.rejects(perguntarVybes(sql, sessao(5), 'oi', { env, fetchImpl: async () => new Response('{}', { status: 403 }) }), (e) => e.status === 403);
  await assert.rejects(perguntarVybes(sql, sessao(5), '   ', { env, fetchImpl }), (e) => e.status === 400);
  await assert.rejects(perguntarVybes(sql, { tipo: 'servico' }, 'oi', { env, fetchImpl }), (e) => e.status === 401);
});
