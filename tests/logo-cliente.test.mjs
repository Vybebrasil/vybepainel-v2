// Logo do cliente nas fachadas do Centro (/api/painel?area=logo): a rota pública só lê um id numérico e, com o
// logo do planejamento em link (identidade.logo), manda para ele sem procurar no Drive nem gravar nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { logoDoCliente } from '../server/planejamentos-api.js';

function resposta() {
  const r = { codigo: 0, cab: {}, fim: false };
  r.status = (c) => { r.codigo = c; return r; };
  r.setHeader = (k, v) => { r.cab[k] = v; };
  r.end = () => { r.fim = true; return r; };
  r.send = () => { r.fim = true; return r; };
  return r;
}

test('logo do cliente: id inválido é 404 sem consultar o banco', async () => {
  let consultas = 0;
  const sql = async () => { consultas++; return []; };
  const r = resposta();
  await logoDoCliente({ query: { c: '1 OR 1=1' } }, r, sql);
  assert.equal(r.codigo, 404);
  assert.equal(consultas, 0);
});

test('logo do cliente: com o logo em link, redireciona para ele e não grava nada', async () => {
  const chamadas = [];
  const sql = async (partes, ...valores) => { chamadas.push(partes.join('?')); return [{ nome: 'Cliente', arquivo: null, url: 'https://exemplo.com/logo.png' }]; };
  const r = resposta();
  await logoDoCliente({ query: { c: '42' } }, r, sql);
  assert.equal(r.codigo, 302);
  assert.equal(r.cab.Location, 'https://exemplo.com/logo.png');
  assert.equal(chamadas.length, 1, 'só a leitura do cliente');
  assert.doesNotMatch(chamadas[0], /UPDATE/);
});

test('logo do cliente: cliente que não existe é 404', async () => {
  const r = resposta();
  await logoDoCliente({ query: { c: '7' } }, r, async () => []);
  assert.equal(r.codigo, 404);
});
