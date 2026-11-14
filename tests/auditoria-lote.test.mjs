// Leituras em lote (auditoria de 14/11/2026): Reuniões, perfis dos agentes e artes dos móveis numa chamada só, com a mesma
// permissão por item da rota de um. SAFE: banco e central simulados, nada sai do processo.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler, { areaReunioes, usarBancoDoPainel, REUNIOES_LOTE_MAX } from '../api/painel.js';
import { areaVybes } from '../server/vybes.js';
import { lerPerfisAgentes, lerPerfilAgente, PERFIS_LOTE_MAX } from '../server/vybes-agentes.js';
import { enviarArtesEscritorio, enviarArteEscritorio } from '../server/escritorio.js';

after(() => usarBancoDoPainel(null));
const resposta = () => ({ codigo: 0, cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, status(n) { this.codigo = n; return this; }, json(d) { this.corpo = d; return this; }, send(d) { this.corpo = d; return this; } });

// Banco de mentira: responde pelo texto da consulta; o resto volta vazio.
function bancoFalso(responder) {
  const sql = (partes, ...params) => Promise.resolve(responder(partes.join('$'), params) || []);
  sql.query = async () => [];
  return sql;
}
const HEAD = 77;
const reunioesDe = { 10: [{ id: 1, cliente_id: 10, data: '2026-11-10', tipo: 'rotina', resumo: 'Ata da Alfa', estado: 'registrada' }], 11: [{ id: 2, cliente_id: 11, data: '2026-11-12', tipo: 'alinhamento', resumo: '', estado: 'registrada' }], 12: [] };
const bancoReunioes = () => bancoFalso((t, p) => {
  if (/SELECT \* FROM vybe_cliente_reunioes WHERE cliente_id=/.test(t)) return reunioesDe[p[0]] || [];
  if (/FROM vybe_cliente_reunioes WHERE cliente_id=.*resumo<>''/.test(t)) return (reunioesDe[p[0]] || []).filter((r) => r.resumo).map((r) => ({ data: r.data, resumo: r.resumo }));
  if (/FROM vybe_cliente_pessoas WHERE cliente_id=/.test(t)) return p[0] === 10 && p[1] === HEAD ? [{ ok: 1 }] : [];
  if (/onboarding_respostas, onboarding_link_expira FROM vybe_clientes WHERE id=/.test(t)) return p[0] === 12 ? [] : [{ id: p[0], nome: 'C' + p[0], onboarding_respostas: { negocio: 'x' + p[0] }, onboarding_link_expira: null }];
  if (/FROM vybe_cliente_onboarding/.test(t)) return p[0] === 11 ? [{ '?column?': 1 }] : [];
  return [];
});

test('reuniões em lote: cada cliente igual à rota de um, com o mesmo "pode" de quem pede', async () => {
  usarBancoDoPainel(bancoReunioes);
  const quem = { tipo: 'sessao', pessoa: { id: HEAD, nome: 'Head da Alfa' } };
  const lote = resposta();
  await areaReunioes({ method: 'GET', query: { clientes: '10,11,12,10' } }, lote, quem);
  assert.equal(lote.codigo, 200);
  assert.deepEqual(Object.keys(lote.corpo.clientes).sort(), ['10', '11', '12'], 'repetido conta uma vez');
  for (const id of ['10', '11', '12']) {
    const um = resposta();
    await areaReunioes({ method: 'GET', query: { cliente: id } }, um, quem);
    assert.equal(um.codigo, 200);
    const { tipos, questoes, acessos_pedidos, ...item } = um.corpo;
    assert.deepEqual(lote.corpo.clientes[id], item, `cliente ${id} igual à rota de um`);
    assert.deepEqual([lote.corpo.tipos, lote.corpo.questoes, lote.corpo.acessos_pedidos], [tipos, questoes, acessos_pedidos]);
  }
  assert.equal(lote.corpo.clientes['10'].pode, true, 'head do cliente mexe nele');
  assert.equal(lote.corpo.clientes['11'].pode, false, 'e não mexe no cliente dos outros');
  assert.equal(lote.corpo.clientes['11'].em_onboarding, true);
  assert.equal(lote.corpo.clientes['12'].onboarding, null);
  assert.equal(lote.corpo.clientes['10'].reunioes[0].ata, 'Ata da Alfa');
});

test('reuniões em lote recusa id inválido, lista vazia e lista grande; sem sessão é 401', async () => {
  usarBancoDoPainel(bancoReunioes);
  const quem = { tipo: 'sessao', pessoa: { id: HEAD } };
  for (const clientes of ['', ',', '10,abc', '10,-1', '0', Array.from({ length: REUNIOES_LOTE_MAX + 1 }, (_, i) => i + 1).join(',')]) {
    const r = resposta(); await areaReunioes({ method: 'GET', query: { clientes } }, r, quem);
    assert.equal(r.codigo, 400, `clientes=${clientes.slice(0, 20)}`);
  }
  const r = resposta(); await handler({ method: 'GET', headers: {}, query: { area: 'reunioes', clientes: '10' } }, r);
  assert.equal(r.codigo, 401);
});

const ENTRADA = 'https://vybes-central.trycloudflare.com/entrar?t=cracha123';
const daCentral = (status, corpo) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(corpo) });
const central = async (url) => { const u = new URL(url); const setor = u.searchParams.get('setor');
  if (setor === 'sumido') return daCentral(404, { ok: false, erro: 'NAO_ACHOU' });
  return daCentral(200, { ok: true, geradoEm: 'g', perfil: { setor, agente: 'A-' + setor, numeros: { acerto: 90 } } }); };

test('perfis em lote: cada setor igual ao perfil de um, com o erro de cada um separado', async () => {
  const lote = await lerPerfisAgentes(ENTRADA, 'bi,copy,sumido,bi', { fetchImpl: central });
  assert.deepEqual(Object.keys(lote.perfis), ['bi', 'copy', 'sumido']);
  for (const s of ['bi', 'copy']) {
    const um = await lerPerfilAgente(ENTRADA, s, { fetchImpl: central });
    assert.deepEqual({ ...lote.perfis[s], lidoEm: 0 }, { ...um, lidoEm: 0 });
  }
  assert.equal(lote.perfis.sumido.ok, false); assert.equal(lote.perfis.sumido.status, 404);
  await assert.rejects(lerPerfisAgentes(ENTRADA, 'bi,Bi!', { fetchImpl: central }), /Agente inválido/);
  await assert.rejects(lerPerfisAgentes(ENTRADA, '', { fetchImpl: central }), /Informe/);
  await assert.rejects(lerPerfisAgentes(ENTRADA, Array.from({ length: PERFIS_LOTE_MAX + 1 }, (_, i) => 's' + 'abcdefghijklmnopqrstuvwxyz'[i % 26] + 'x'.repeat(i % 5)).join(','), { fetchImpl: central }), /No máximo|Agente/);
});

test('etapa=perfis pela rota: sem sessão 401 antes do banco; com sessão usa um crachá só para todos', async (t) => {
  const r0 = resposta(); await areaVybes({ method: 'GET', query: { etapa: 'perfis', setores: 'bi' } }, r0, null, () => assert.fail('não consultar banco'));
  assert.equal(r0.codigo, 401);
  const antes = { token: process.env.VYBE_AI_BOT_TOKEN, fetch: globalThis.fetch };
  t.after(() => { if (antes.token === undefined) delete process.env.VYBE_AI_BOT_TOKEN; else process.env.VYBE_AI_BOT_TOKEN = antes.token; globalThis.fetch = antes.fetch; });
  process.env.VYBE_AI_BOT_TOKEN = 'a'.repeat(64);
  const cookies = [];
  globalThis.fetch = async (url, op) => { cookies.push(op.headers.Cookie); assert.match(String(url), /^https:\/\/teste\.trycloudflare\.com\/api\/cosmos\/agentes\/perfil\?setor=/); return central(url); };
  const sql = bancoFalso((tx) => {
    if (/to_regclass/.test(tx)) return [{ ok: true }];
    if (/FROM vybe_vybes_estado/.test(tx)) return [{ estado: { tunel: 'https://teste.trycloudflare.com', whatsapp: true }, atualizado_em: new Date().toISOString() }];
    if (/SELECT 1 AS ok FROM vybe_pessoas/.test(tx)) return [{ ok: true }];
    if (/SELECT id, nome FROM vybe_pessoas/.test(tx)) return [{ id: 5, nome: 'Equipe' }];
    return [];
  });
  const r = resposta();
  await areaVybes({ method: 'GET', query: { etapa: 'perfis', setores: 'bi,copy,design' } }, r, { tipo: 'sessao', pessoa: { id: 5, dono: false } }, sql);
  assert.equal(r.codigo, 200, JSON.stringify(r.corpo));
  assert.deepEqual(Object.keys(r.corpo.perfis).sort(), ['bi', 'copy', 'design']);
  assert.equal(r.corpo.perfis.copy.perfil.agente, 'A-copy');
  assert.equal(cookies.length, 3); assert.equal(new Set(cookies).size, 1, 'o mesmo crachá nas três leituras');
  assert.doesNotMatch(JSON.stringify(r.corpo), /trycloudflare|vybes_quem/, 'o crachá não volta ao navegador');
});

test('artes em lote: os .json dos móveis numa resposta, com o mesmo conteúdo da arte de um', async () => {
  const classe = 'LT_pillar';
  const um = resposta(); await enviarArteEscritorio(um, classe + '.json');
  assert.equal(um.codigo, 200);
  const r = resposta(); await enviarArtesEscritorio(r, `${classe},${classe}`);
  assert.equal(r.codigo, 200); assert.deepEqual(r.corpo.artes[classe], JSON.parse(String(um.corpo)));
  assert.deepEqual(r.corpo.faltam, []);
  for (const classes of ['', '../x', 'a.json', Array.from({ length: 81 }, (_, i) => 'm' + i).join(',')]) {
    const x = resposta(); await enviarArtesEscritorio(x, classes); assert.equal(x.codigo, 400, classes.slice(0, 20));
  }
});

test('as telas usam a leitura em lote e caem na antiga quando o servidor não tem a nova', () => {
  const reun = readFileSync('vybe-clientes-reunioes.js', 'utf8'), ag = readFileSync('vybe-mundo-agentes.js', 'utf8'), mapa = readFileSync('vybe-escritorio-mapa.js', 'utf8');
  assert.match(reun, /area=reunioes&clientes=/); assert.match(reun, /const faltam = await carregarLote\(ids\)/);
  assert.match(reun, /area=reunioes&cliente=\$\{encodeURIComponent\(id\)\}/, 'a leitura de um continua para a ficha e para o que faltou');
  assert.match(ag, /etapa=perfis&setores=/); assert.match(ag, /\[400, 404, 405\]\.includes\(r\.status\) \|\| r\.ok/, 'servidor antigo responde 200 com outra coisa: cai na leitura de um');
  assert.match(mapa, /acao=artes&classes=/); assert.match(mapa, /MAPA_LOTE\.semLote = true/);
  assert.match(mapa, /imagem\.src = mapaArquivo\(classe \+ "\.png"\)/, 'a imagem continua uma por móvel, com cache do navegador');
});
