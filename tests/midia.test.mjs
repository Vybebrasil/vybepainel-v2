import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { periodoDe, retratoDoMeta, sinalDoMeta, lerCarteira, lerClienteMidia, CANAIS } from '../server/midia.js';

const dono = { tipo: 'sessao', pessoa: { id: 7, dono: true } };
const equipe = { tipo: 'sessao', pessoa: { id: 8 } };

test('período fecha ontem e aceita só 7 ou 30 dias', () => {
  assert.deepEqual(periodoDe(7, '2026-11-20'), { dias: 7, de: '2026-11-13', ate: '2026-11-19' });
  assert.deepEqual(periodoDe(30, '2026-03-01'), { dias: 30, de: '2026-01-30', ate: '2026-02-28' });
  assert.equal(periodoDe(999, '2026-11-20').dias, 7);
});

test('Google Ads e site aparecem como não conectados, nunca com fonte inventada', () => {
  assert.equal(CANAIS.find((c) => c.id === 'meta').fonte, 'vybehub');
  for (const id of ['google', 'site']) { const c = CANAIS.find((x) => x.id === id); assert.equal(c.fonte, null); assert.ok(c.falta); }
});

test('sinal do Ícaro: custo que sobe, verba sem resultado, verba que parou e frequência alta', () => {
  const base = { investido: 100, investido_anterior: 100, resultados: 10, custo_resultado: 10, custo_anterior: 10, frequencia: 1.5 };
  assert.equal(sinalDoMeta(base).tom, 'g');
  assert.equal(sinalDoMeta({ ...base, custo_resultado: 14.5 }).tom, 'r');
  assert.equal(sinalDoMeta({ ...base, custo_resultado: 12.5 }).tom, 'a');
  assert.equal(sinalDoMeta({ ...base, resultados: 0, custo_resultado: null }).tom, 'r');
  assert.equal(sinalDoMeta({ ...base, investido: 0 }).tom, 'r');
  assert.equal(sinalDoMeta({ ...base, investido: 0, investido_anterior: 0 }).tom, 'n');
  assert.equal(sinalDoMeta({ ...base, frequencia: 3.4 }).tom, 'a');
  assert.equal(sinalDoMeta(null).tom, 'n');
});

test('custo anterior só compara o mesmo tipo de resultado', () => {
  const r = retratoDoMeta([
    { tipo: 'total', investido: 50, resultados: 5, tipoResultado: 'messages', custoResultado: 10 },
    { tipo: 'anterior', investido: 40, resultados: 400, tipoResultado: 'reach', custoResultado: 0.1 },
    { tipo: 'campanha', nome: 'C1', investido: 50, resultados: 5, tipoResultado: 'messages', custoResultado: 10, frequencia: 1.2 },
  ]);
  assert.equal(r.custo_anterior, null);
  assert.equal(r.investido_anterior, 40);
  assert.equal(r.campanhas.length, 1);
  assert.equal(retratoDoMeta([]), null);
});

test('só os donos leem a Mídia', async () => {
  const sql = async () => [];
  await assert.rejects(lerCarteira(sql, equipe), (e) => e.status === 403);
  await assert.rejects(lerCarteira(sql, null), (e) => e.status === 401);
  await assert.rejects(lerClienteMidia(sql, equipe, { cliente_id: 1 }), (e) => e.status === 403);
});

test('cliente sem conta no Hub vira "sem conta", não erro nem zero', async () => {
  const sql = async (partes) => {
    const q = partes.join('?');
    if (q.includes('to_regclass')) return [{ existe: false }];
    return [{ id: '1', nome: 'Cliente Teste' }];
  };
  const config = { VYBE_AI_HUB_ATIVO: '1', VYBE_AI_HUB_URL: 'https://vybehub.vercel.app/', VYBE_OS_METRICAS_TOKEN: 'F'.repeat(64), VYBE_AI_HUB_CLIENTES: 'auto' };
  const buscar = async () => new Response(JSON.stringify({ error: { json: { message: 'Conta de anúncios indisponível.' } } }), { status: 503 });
  const erroLog = console.error; console.error = () => {};
  try {
    const r = await lerClienteMidia(sql, dono, { cliente_id: 1, dias: 7 }, { config, buscar, hoje: '2026-11-20' });
    assert.equal(r.meta.estado, 'sem_conta');
    assert.deepEqual(r.periodo, { dias: 7, de: '2026-11-13', ate: '2026-11-19' });
  } finally { console.error = erroLog; }
});

test('o setor Mídia é só dos donos no dock e o agente se chama Ícaro na planta', () => {
  const mundo = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
  assert.match(mundo, /SO_DINHEIRO = new Set\(\['setor:midia', 'midia'/);
  const planta = readFileSync(new URL('../mundo/planta.mjs', import.meta.url), 'utf8');
  assert.match(planta, /id: 'midia', nome: 'Mídia Paga', agente: 'Ícaro'/);
  assert.doesNotMatch(planta, /agente: 'Breno'/);
});
