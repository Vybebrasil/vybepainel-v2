// Ponte das atribuições dos agentes (08/11/2026): o painel só repassa forma válida e manda o crachá para a central.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarAtribuicoes, validarRotinas, atribuirNaCentral } from '../server/vybes.js';

const ENTRADA = 'https://vybes-central.trycloudflare.com/entrar?t=cracha123';
test('validarAtribuicoes descarta forma errada e removidas', () => {
  const ok = { id: 'a1', setor: 'copy', texto: 'Revisar legendas', frequencia: 'diaria', estado: 'ativa', horario: '08:00', proxima: '2026-11-09T11:00:00.000Z', criadaEm: '2026-11-08T12:00:00.000Z', vezes: 2 };
  const r = validarAtribuicoes([ok, { ...ok, id: 'b', setor: 'Copy!' }, { ...ok, id: 'c', estado: 'removida' }, { ...ok, id: 'd', frequencia: 'sempre' }, null]);
  assert.deepEqual(r.map((a) => a.id), ['a1']);
  assert.equal(validarAtribuicoes('x').length, 0);
  assert.deepEqual(validarRotinas({ copy: [{ horario: 'madrugada', texto: 'Estudo' }, { horario: 5 }], 'X!': [] }), { copy: [{ horario: 'madrugada', texto: 'Estudo' }] });
});
test('atribuirNaCentral manda o crachá pelo cookie, só campos conhecidos, e traduz recusa', async () => {
  let pedido;
  const fetchImpl = async (url, op) => { pedido = { url, op }; return { ok: true, status: 200, json: async () => ({ ok: true, atribuicao: { id: 'n', setor: 'copy', texto: 'Oi tudo', frequencia: 'uma_vez', estado: 'ativa' } }) }; };
  const r = await atribuirNaCentral(ENTRADA, { acao: 'criar', setor: 'copy', texto: 'Oi tudo', extra: 'x' }, { fetchImpl });
  assert.equal(r.ok, true); assert.match(pedido.url, /\/api\/cosmos\/agentes\/atribuicoes$/);
  assert.match(pedido.op.headers.Cookie, /vybes_quem=cracha123/); assert.equal(JSON.parse(pedido.op.body).extra, undefined);
  await assert.rejects(atribuirNaCentral(ENTRADA, { acao: 'apagar_tudo' }, { fetchImpl }), /Ação inválida/);
  const proibido = async () => ({ ok: false, status: 403, json: async () => ({ ok: false, erro: 'SO_DONOS' }) });
  await assert.rejects(atribuirNaCentral(ENTRADA, { acao: 'pausar', id: 'a' }, { fetchImpl: proibido }), /Só os donos/);
  const antiga = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(atribuirNaCentral(ENTRADA, { acao: 'pausar', id: 'a' }, { fetchImpl: antiga }), /reinicie o VYBES/);
  await assert.rejects(atribuirNaCentral('https://outro.site/entrar?t=x', { acao: 'pausar', id: 'a' }, { fetchImpl }), /inválida/);
});
