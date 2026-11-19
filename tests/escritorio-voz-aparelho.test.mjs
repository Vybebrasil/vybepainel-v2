import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';

// Voz do Escritório por aparelho (Paulo, 18/11/2026: no Windows e no Mac ao mesmo tempo, um derrubava o outro).
// server/escritorio-chamadas.js chaveDoParticipante; vybe-escritorio.js escritorioAparelho.
test('voz: cada aparelho tem o próprio participante; o mesmo aparelho só renova o token; sem id, como antes', async (t) => {
  const { prepararChamadaEscritorio, chaveDoParticipante } = await import('../server/escritorio-chamadas.js');
  assert.equal(chaveDoParticipante(1, 'escritorio', 'abcdef123456'), 'p:1:escritorio:abcdef123456');
  for (const a of [undefined, null, '', 'curto', 'tem espaço aqui', '<script>alert</script>', 'x'.repeat(65), 12345678])
    assert.equal(chaveDoParticipante(1, 'escritorio', a), 'p:1:escritorio', String(a));
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec('CREATE TABLE vybe_escritorio_salas(sala text PRIMARY KEY,reuniao_id text NOT NULL);');
  const chamadas = []; let n = 0;
  const fetchAntes = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetchAntes; });
  globalThis.fetch = async (url, init) => {
    const u = String(url).replace(/^.*\/kit\/app/, ''); chamadas.push(init.method + ' ' + u);
    const data = /\/token$/.test(u) ? { token: 'renovado:' + u.split('/')[4] } : /\/participants$/.test(u) ? { id: 'part-' + (++n), token: 'novo-' + n } : { id: 'reuniao-1' };
    return { ok: true, json: async () => ({ success: true, data }) };
  };
  const env = { CLOUDFLARE_ACCOUNT_ID: 'a', REALTIMEKIT_APP_ID: 'app', CLOUDFLARE_REALTIME_API_TOKEN: 't' };
  const paulo = { id: 1, nome: 'Paulo' };
  const windows = 'aparelho-windows-1', mac = 'aparelho-mac-0001';
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: windows })).authToken, 'novo-1');
  // O Mac entra: participante novo, o do Windows não é renovado (não cai).
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: mac })).authToken, 'novo-2');
  // O Windows reconecta: o mesmo participante dele, sem custo novo.
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: windows })).authToken, 'renovado:part-1');
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: mac })).authToken, 'renovado:part-2');
  // Tela antiga (sem id): a chave por pessoa de sempre.
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env)).authToken, 'novo-3');
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: 'inválido!' })).authToken, 'renovado:part-3');
  assert.deepEqual(chamadas, ['POST /meetings', 'POST /meetings/reuniao-1/participants', 'POST /meetings/reuniao-1/participants',
    'POST /meetings/reuniao-1/participants/part-1/token', 'POST /meetings/reuniao-1/participants/part-2/token',
    'POST /meetings/reuniao-1/participants', 'POST /meetings/reuniao-1/participants/part-3/token']);
  const chaves = (await sql`SELECT sala FROM vybe_escritorio_salas ORDER BY sala`).map((r) => r.sala);
  assert.deepEqual(chaves, ['escritorio', 'p:1:escritorio', 'p:1:escritorio:' + mac, 'p:1:escritorio:' + windows]);
  // Participante parado expirou: a renovação falha e cria outro, como hoje.
  globalThis.fetch = async (url, init) => {
    const u = String(url).replace(/^.*\/kit\/app/, '');
    if (/\/token$/.test(u)) return { ok: false, status: 404, json: async () => ({ success: false, errors: [{ message: 'not found' }] }) };
    return { ok: true, json: async () => ({ success: true, data: { id: 'part-9', token: 'novo-9' } }) };
  };
  assert.equal((await prepararChamadaEscritorio(sql, paulo, 'escritorio', env, { aparelho: windows })).authToken, 'novo-9');
});

test('voz: a tela manda o id do aparelho e as duas rotas (equipe e convidado) o repassam', () => {
  const tela = readFileSync('vybe-escritorio.js', 'utf8');
  assert.match(tela, /escritorioApi\("chamada", \{ sala: zona, aparelho: escritorioAparelho\(\) \}\)/);
  assert.match(tela, /localStorage\.getItem\("vybe-escritorio-aparelho"\)/);
  assert.match(readFileSync('server/escritorio.js', 'utf8'), /\{ aparelho: req\.body\?\.aparelho \}/);
  assert.match(readFileSync('server/escritorio-convite.js', 'utf8'), /sala, env, \{ aparelho: req\.body\?\.aparelho \}\)/);
});
