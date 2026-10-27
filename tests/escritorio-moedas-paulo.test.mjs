// VybeCoins dados por Paulo pela ficha (só ele; repetir o pedido não credita de novo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bancoEscritorio as banco } from './escritorio-esquema.mjs';
import { darMoedas } from '../server/escritorio-social.js';

const saldo = async (sql, p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0]?.saldo || 0);
const SALAS = [{ id: 'sala-0', pessoa_id: '1' }, { id: 'sala-1', pessoa_id: '2' }];
const PAULO = { id: 1, admin: true };

test('só Paulo dá VybeCoins; entra na carteira sem XP e sem sair da dele', async (t) => {
  const { sql } = await banco(t);
  const [outra] = await sql`SELECT id FROM vybe_pessoas WHERE id<>1 AND ativo AND pode_entrar ORDER BY id LIMIT 1`;
  const para = String(outra.id);
  const antesPaulo = await saldo(sql, 1), antes = await saldo(sql, para);

  const chave = crypto.randomUUID();
  let r = await darMoedas(sql, PAULO, SALAS, { para, valor: 2000, chave });
  assert.equal(r.repetido, false);
  assert.equal(await saldo(sql, para), antes + 2000);
  assert.equal(await saldo(sql, 1), antesPaulo, 'não sai da carteira de Paulo');
  const [l] = await sql`SELECT quantidade, pontos, regra FROM vybe_escritorio_moedas WHERE pessoa_id=${para} AND origem=${'premio:paulo:' + chave}`;
  assert.deepEqual([Number(l.quantidade), Number(l.pontos), l.regra], [2000, 0, null]);

  r = await darMoedas(sql, PAULO, SALAS, { para, valor: 2000, chave });
  assert.equal(r.repetido, true);
  assert.equal(await saldo(sql, para), antes + 2000, 'a mesma chave não credita duas vezes');

  await darMoedas(sql, PAULO, SALAS, { para: '1', valor: 1000, chave: crypto.randomUUID() });
  assert.equal(await saldo(sql, 1), antesPaulo + 1000, 'Paulo também pode dar para si');

  // Outro administrador (não dono da sala-0) e quem não administra: recusado.
  await assert.rejects(darMoedas(sql, { id: Number(para), admin: true }, SALAS, { para, valor: 10, chave: crypto.randomUUID() }), /Só Paulo/);
  await assert.rejects(darMoedas(sql, { id: 1, admin: false }, SALAS, { para, valor: 10, chave: crypto.randomUUID() }), /Só Paulo/);
  for (const valor of [0, -5, 1.5, 10001, 'mil'])
    await assert.rejects(darMoedas(sql, PAULO, SALAS, { para, valor, chave: crypto.randomUUID() }), /Escolha de 1/);
  await assert.rejects(darMoedas(sql, PAULO, SALAS, { para: '999999', valor: 10, chave: crypto.randomUUID() }), /não está na equipe/);
  assert.equal(await saldo(sql, para), antes + 2000);
});
