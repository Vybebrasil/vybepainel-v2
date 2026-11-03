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
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true),(2,'Vinícius',true),(3,'Ewerton L.',true),(4,'Deivid',true),(5,'Bia',true);
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
  assert.equal(await podeAgirNoVybes(sql, sessao(5)), false);
  assert.equal(await podeAgirNoVybes(sql, { tipo: 'servico' }), false);
});

test('vybes: o bot publica só o endereço do túnel; endereço de fora do padrão é recusado', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, { tunel: TUNEL, outra: 'coisa' });
  const [l] = await sql`SELECT estado FROM vybe_vybes_estado`;
  assert.deepEqual(l.estado, { versao: 2, tunel: TUNEL });
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
  assert.deepEqual({ ...cv, e: 0 }, { p: 2, n: 'Vinícius', a: true, d: false, e: 0 });
  assert.ok(cv.e > agora && cv.e <= agora + 120e3, 'vale 2 min');
  const b = conferir(decodeURIComponent((await entradaVybes(sql, sessao(5), { env, agora })).url.split('t=')[1]));
  assert.equal(b.a, false);
  assert.equal(conferir(decodeURIComponent((await entradaVybes(sql, sessao(1), { env, agora })).url.split('t=')[1])).d, true);
  await assert.rejects(entradaVybes(sql, { tipo: 'servico' }, { env, agora }), /Entre no painel/);
  await assert.rejects(entradaVybes(sql, sessao(2), { env, agora: agora + 11 * 60e3 }), /desligado agora/);
});

test('vybes: o cartão diz se a central está no ar e se quem olha age', async () => {
  const { sql } = await banco();
  const agora = Date.now();
  assert.deepEqual(await estadoVybes(sql, sessao(2), { agora }), { noAr: false, agir: true }, 'sem túnel publicado');
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  assert.deepEqual(await estadoVybes(sql, sessao(2), { agora }), { noAr: true, agir: true });
  assert.deepEqual(await estadoVybes(sql, sessao(5), { agora }), { noAr: true, agir: false });
  assert.equal((await estadoVybes(sql, sessao(2), { agora: agora + 11 * 60e3 })).noAr, false, 'túnel velho = fora do ar');
  await assert.rejects(estadoVybes(sql, { tipo: 'servico' }, { agora }), /Entre no painel/);
});

test('vybes: quem só vê não toma ação; quem age passa pelo executor das ações (preparar → confirmar)', async () => {
  const { sql } = await banco();
  const segredo = 'x'.repeat(40);
  await assert.rejects(acaoVybes(sql, sessao(5), { etapa: 'preparar', pedido: { acao: 'status', item: 'vybe:1', para: 'Para agendar' } }, { segredo }), (e) => e.status === 403 && /só Paulo, Vinícius, Ewerton e Deivid/.test(e.message));
  // Operador chega ao executor: uma ação que ele não conhece volta a recusa dele (prova que a chamada foi feita lá).
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'preparar', pedido: { acao: 'apagar_tudo' } }, { segredo }), /Ação desconhecida/);
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'outra' }, { segredo }), /Informe a etapa/);
});

test('vybes: sem a migração rodada, o primeiro uso cria as tabelas e copia quem age uma vez só', async () => {
  const { sql } = await banco({ migrar: false });
  await guardarEstadoVybes(sql, { tunel: TUNEL });
  const ops = await sql`SELECT pessoa_id::int AS id FROM vybe_vybes_operadores ORDER BY pessoa_id`;
  assert.deepEqual(ops.map((o) => o.id), [1, 2, 3, 4]);
  // Paulo tira o Deivid: o próximo uso não repõe ninguém.
  await sql`DELETE FROM vybe_vybes_operadores WHERE pessoa_id = 4`;
  esquecerTabelasVybes();
  assert.equal(await podeAgirNoVybes(sql, sessao(4)), false);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_vybes_operadores`)[0].n, 3);
});
