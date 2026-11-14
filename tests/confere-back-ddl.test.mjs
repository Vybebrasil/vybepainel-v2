// Confere do back (14/11/2026), A1: a migração aditiva roda uma vez por banco em cada instância, e não a cada requisição
// (o painel abre um cliente novo do Neon por chamada). SAFE: bancos de mentira que só contam os comandos; nada vai ao Neon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { garantirSchemaReunioes, paginaDoOnboarding } from '../server/reunioes.js';
import { garantirTabelaPacotes } from '../server/pacotes-producao.js';
import { garantirTabelaCobrancas } from '../server/cobrancas-whatsapp.js';
import { garantirTabelaDeRegistros } from '../server/mcp-ecossistema.js';
import { bancoComTransacoes } from '../server/transacao-automacoes.js';
import { esquecerUmaVez } from '../server/uma-vez.js';

// Um cliente novo por "requisição", todos do mesmo banco (a mesma marca que bancoComTransacoes põe).
function clienteDoBanco(comandos, { falharUmaVez = null } = {}) {
  const db = (partes, ...v) => { const t = partes.join('?').replace(/\s+/g, ' ').trim(); comandos.push(t);
    if (falharUmaVez && falharUmaVez.vezes > 0 && /CREATE TABLE/.test(t)) { falharUmaVez.vezes--; return Promise.reject(new Error('timeout')); }
    return Promise.resolve([]); };
  db.query = async (t) => { comandos.push(String(t)); return []; };
  db.identidadeDoBanco = 'neon:teste';
  return db;
}
const ddl = (lista) => lista.filter((c) => /^(CREATE|ALTER)\b/i.test(c));

test('A1: reuniões, pacotes, cobranças e registros: DDL só na primeira requisição', async () => {
  for (const [nome, garantir] of [['reunioes', garantirSchemaReunioes], ['pacotes', garantirTabelaPacotes], ['cobrancas', garantirTabelaCobrancas], ['registros', garantirTabelaDeRegistros]]) {
    esquecerUmaVez();
    const primeira = [], segunda = [], terceira = [];
    await garantir(clienteDoBanco(primeira));
    await garantir(clienteDoBanco(segunda));
    await garantir(clienteDoBanco(terceira));
    assert.ok(ddl(primeira).length > 0, nome);
    assert.deepEqual(segunda, [], `${nome}: a segunda requisição não roda nada (antes, ${ddl(primeira).length} comandos de novo)`);
    assert.deepEqual(terceira, [], nome);
  }
});

test('A1: o GET público do onboarding não altera vybe_clientes a cada abertura', async () => {
  esquecerUmaVez();
  const comandos = [];
  const res = () => ({ setHeader() {}, status() { return this; }, send() { return this; }, json() { return this; } });
  for (let i = 0; i < 3; i++) await paginaDoOnboarding({ method: 'GET', query: { t: 'x'.repeat(40) }, headers: { 'x-real-ip': '192.0.2.1' } }, res(), clienteDoBanco(comandos));
  assert.equal(comandos.filter((c) => /ALTER TABLE vybe_clientes/.test(c)).length, 3, 'as 3 colunas do onboarding, uma vez só');
});

test('A1: se a migração falhar, a próxima requisição tenta de novo; corridas dividem a mesma promessa', async () => {
  esquecerUmaVez();
  const falha = { vezes: 1 }, a = [], b = [];
  await assert.rejects(garantirTabelaPacotes(clienteDoBanco(a, { falharUmaVez: falha })), /timeout/);
  await garantirTabelaPacotes(clienteDoBanco(b));
  assert.ok(ddl(b).length > 0, 'refez depois da falha');
  esquecerUmaVez();
  const c = [];
  await Promise.all([1, 2, 3].map(() => garantirTabelaCobrancas(clienteDoBanco(c))));
  assert.equal(c.filter((x) => /CREATE TABLE IF NOT EXISTS vybe_cobrancas_whatsapp/.test(x)).length, 1);
});

test('A1: dois clientes do Neon para a mesma URL têm a mesma marca; URLs diferentes, marcas diferentes', () => {
  const u = 'postgresql://usuario:senha@exemplo.invalid/banco';
  const x = bancoComTransacoes(u), y = bancoComTransacoes(u), z = bancoComTransacoes(u + '2');
  assert.equal(typeof x.identidadeDoBanco, 'string');
  assert.equal(x.identidadeDoBanco, y.identidadeDoBanco);
  assert.notEqual(x.identidadeDoBanco, z.identidadeDoBanco);
  assert.doesNotMatch(x.identidadeDoBanco, /senha|usuario/, 'a marca não carrega a URL');
});
