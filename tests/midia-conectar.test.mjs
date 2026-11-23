// Mídia (S-N): o dono grava o site e o ID do Google Ads no cadastro do cliente pelo módulo, e a ficha
// lê o histórico de 8 semanas do VybeHub. Banco de verdade (PGlite) e Hub de mentira; nada sai da máquina.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { limparGoogleAds, limparSite, salvarCanais, lerCarteira, semanasDoHistorico, lerHistorico, estadoDoErro, CANAIS } from '../server/midia.js';

const dono = { tipo: 'sessao', pessoa: { id: 7, dono: true } };
const equipe = { tipo: 'sessao', pessoa: { id: 8 } };
const config = { VYBE_AI_HUB_ATIVO: '1', VYBE_AI_HUB_URL: 'https://vybehub.vercel.app/', VYBE_OS_METRICAS_TOKEN: 'F'.repeat(64), VYBE_AI_HUB_CLIENTES: 'auto' };

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false,
      apagado_em timestamptz, cadastro jsonb NOT NULL DEFAULT '{}'::jsonb);
    INSERT INTO vybe_clientes(id, nome, ativo, cadastro) VALUES
      (1, 'Alfa Café', true, '{"instagram":"@alfa"}'), (2, 'Beta Moda', false, '{}'), (3, 'Gama Pet', true, '{}');`);
  return { db, sql };
}

test('ID do Google Ads: aceita 10 números em qualquer separação e guarda no formato do Google', () => {
  assert.equal(limparGoogleAds('1234567890'), '123-456-7890');
  assert.equal(limparGoogleAds(' 123-456-7890 '), '123-456-7890');
  assert.equal(limparGoogleAds('123 456 7890'), '123-456-7890');
  assert.equal(limparGoogleAds('123.456.7890'), '123-456-7890');
  assert.equal(limparGoogleAds(''), '');
  for (const ruim of ['12345', '123-456-78901', 'abc-def-ghij', '123-456-789O']) {
    assert.throws(() => limparGoogleAds(ruim), (e) => e.status === 400 && /10 números/.test(e.message));
  }
});

test('site: usa a mesma validação do cadastro do cliente', () => {
  assert.match(limparSite('alfacafe.com.br'), /alfacafe\.com\.br/);
  assert.equal(limparSite(''), '');
  assert.throws(() => limparSite('isso não é site'));
});

test('só os donos gravam os canais; sem sessão é 401', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(salvarCanais(sql, equipe, { cliente_id: 1, site: 'alfa.com.br' }), (e) => e.status === 403);
  await assert.rejects(salvarCanais(sql, null, { cliente_id: 1, site: 'alfa.com.br' }), (e) => e.status === 401);
  const [c] = await sql`SELECT cadastro FROM vybe_clientes WHERE id = 1`;
  assert.deepEqual(c.cadastro, { instagram: '@alfa' });
});

test('dono grava site e Google Ads no cadastro, sem apagar o resto, e a carteira mostra', async (t) => {
  const { sql } = await banco(t);
  const r = await salvarCanais(sql, dono, { cliente_id: 1, google_ads: '1234567890', site: 'alfacafe.com.br' });
  assert.equal(r.google_ads, '123-456-7890');
  assert.match(r.site, /alfacafe\.com\.br/);
  const [c] = await sql`SELECT cadastro FROM vybe_clientes WHERE id = 1`;
  assert.equal(c.cadastro.instagram, '@alfa');
  assert.equal(c.cadastro.google_ads, '123-456-7890');

  const cart = await lerCarteira(sql, dono, { config });
  const alfa = cart.clientes.find((x) => x.id === '1');
  assert.equal(alfa.google_ads, '123-456-7890');
  assert.ok(alfa.tem_site);
  assert.equal(cart.hub_url, 'https://vybehub.vercel.app');
  assert.ok(!cart.clientes.some((x) => x.id === '2'), 'cliente inativo fica fora');
  // O Google Ads e o site continuam sem fonte de números: o ID salvo não inventa leitura.
  for (const id of ['google', 'site']) assert.equal(CANAIS.find((x) => x.id === id).fonte, null);

  const tirar = await salvarCanais(sql, dono, { cliente_id: 1, google_ads: '' });
  assert.equal(tirar.google_ads, '');
  const [d] = await sql`SELECT cadastro FROM vybe_clientes WHERE id = 1`;
  assert.equal(Object.hasOwn(d.cadastro, 'google_ads'), false);
  assert.ok(d.cadastro.site);
});

test('validação antes de gravar: ID errado, cliente inativo, nada para gravar', async (t) => {
  const { sql } = await banco(t);
  await assert.rejects(salvarCanais(sql, dono, { cliente_id: 3, google_ads: '12345' }), (e) => e.status === 400);
  await assert.rejects(salvarCanais(sql, dono, { cliente_id: 2, site: 'beta.com.br' }), (e) => e.status === 404);
  await assert.rejects(salvarCanais(sql, dono, { cliente_id: 3 }), (e) => e.status === 400);
  await assert.rejects(salvarCanais(sql, dono, { cliente_id: 'x', site: 'a.com' }), (e) => e.status === 400);
  await assert.rejects(salvarCanais(sql, dono, { cliente_id: 3, cadastro: { senha: 'x' } }), (e) => e.status === 400);
  const [g] = await sql`SELECT cadastro FROM vybe_clientes WHERE id = 3`;
  assert.deepEqual(g.cadastro, {});
});

test('histórico: 8 semanas seguidas fechando ontem, da mais antiga para a mais nova', async () => {
  const pares = semanasDoHistorico('2026-11-23');
  assert.equal(pares.length, 4);
  assert.deepEqual(pares[0], { de: '2026-11-16', ate: '2026-11-22', de_anterior: '2026-11-09', ate_anterior: '2026-11-15' });
  assert.equal(pares[1].ate, '2026-11-08');

  // Banco mínimo como em midia.test.mjs: o cliente existe e não há tabela de vínculo, então o slug sai do nome.
  const sql = async (partes) => (partes.join('?').includes('to_regclass') ? [{ existe: false }] : [{ id: '1', nome: 'Alfa Café' }]);
  const pedidos = [];
  const buscar = async (url) => {
    const e = JSON.parse(new URL(String(url)).searchParams.get('input')).json;
    pedidos.push(e);
    const linhas = [
      { tipo: 'total', investido: 100, resultados: 10, tipoResultado: 'messages', custoResultado: 10 },
      { tipo: 'anterior', investido: 80, resultados: 8, tipoResultado: 'messages', custoResultado: 10 },
    ];
    return new Response(JSON.stringify({ result: { data: { json: { slug: e.slug, cliente_nome: e.cliente_nome, de: e.since, ate: e.until, modulo: e.modulo, deslocamento: 0, linhas } } } }), { status: 200 });
  };
  const r = await lerHistorico(sql, dono, { cliente_id: 1 }, { config, buscar, hoje: '2026-11-23' });
  assert.equal(r.estado, 'ok', JSON.stringify(r));
  assert.equal(r.semanas.length, 8);
  assert.equal(r.semanas[0].de, '2026-09-28');
  assert.equal(r.semanas.at(-1).ate, '2026-11-22');
  for (let i = 1; i < 8; i++) assert.ok(r.semanas[i].de > r.semanas[i - 1].ate);
  assert.equal(pedidos.length, 4);
  assert.ok(pedidos.every((p) => p.modulo === 'resumo' && p.limite === 2));
  await assert.rejects(lerHistorico(sql, equipe, { cliente_id: 1 }, { config, buscar }), (e) => e.status === 403);
});

test('ponte desligada vira um estado próprio, não "não respondeu"', () => {
  assert.equal(estadoDoErro(new Error('Métricas do VybeHub ainda não configuradas neste ambiente.')).estado, 'desligado');
  assert.equal(estadoDoErro(new Error('Conta de anúncios indisponível.')).estado, 'sem_conta');
  assert.equal(estadoDoErro(new Error('timeout')).estado, 'erro');
});

test('a Mídia esconde o Hoje por trás do vidro e fica ao lado do menu', () => {
  const mundo = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
  const palco = mundo.match(/const PALCO = [^;]+;/)?.[0] || '';
  assert.match(palco, /#vv-midia/);
  assert.match(mundo, /JANELAS_DO_LADO[^;]*'vv-midia'/);
});
