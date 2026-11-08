// Perfil dos agentes, mapa do cérebro (Sinapses) e pendências do WhatsApp (08/11/2026). SAFE: central simulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limparJson, lerEtapa, mudarNaCentral, ETAPAS_LEITURA } from '../server/vybes-agentes.js';

const ENTRADA = 'https://vybes-central.trycloudflare.com/entrar?t=cracha123';
const resposta = (status, corpo) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(corpo) });

test('limparJson corta texto, lista e profundidade e descarta chave estranha e função', () => {
  const r = limparJson({ a: 'x'.repeat(5000), b: Array.from({ length: 900 }, (_, i) => i), 'c-d': 1, e: () => 1, f: { g: { h: { i: { j: { k: { l: { m: 1 } } } } } } }, n: NaN });
  assert.equal(r.a.length, 2000); assert.equal(r.b.length, 400); assert.equal(r['c-d'], undefined); assert.equal(r.e, null); assert.equal(r.n, null);
  assert.equal(r.f.g.h.i.j.k.l, null);
});

test('leituras vão à rota certa da central com o crachá no cookie e sem seguir redirecionamento', async () => {
  const pedidos = [];
  const fetchImpl = async (url, op) => { pedidos.push({ url, op }); const u = new URL(url);
    if (u.pathname === '/api/cosmos/agentes/perfil') return resposta(200, { ok: true, geradoEm: 'x', perfil: { setor: u.searchParams.get('setor'), agente: 'Alex', rotinas: [{ id: 'radar', motor: 'logica' }] } });
    if (u.pathname === '/api/cosmos/cerebro/mapa') return resposta(200, { ok: true, nos: [{ id: 'motor:qwen' }], ligacoes: [], contagem: { qwen: 4 } });
    if (u.pathname === '/api/cosmos/whatsapp/pendencias') return resposta(200, { ok: true, atendimento: { agente: 'Mateus', clientesEsperando: [], timeSemResolver: [] }, paraVoce: [] });
    if (u.pathname === '/api/cosmos/agentes/estudos') return resposta(404, { ok: false, erro: 'SEM_ESTUDO' });
    return resposta(500, {}); };
  assert.deepEqual(ETAPAS_LEITURA, ['perfil', 'mapa', 'pendencias', 'estudo']);
  const p = await lerEtapa('perfil', ENTRADA, { setor: 'bi' }, { fetchImpl });
  assert.equal(p.perfil.agente, 'Alex'); assert.equal(p.perfil.rotinas[0].motor, 'logica'); assert.equal(p.fonte, 'central-vybes');
  assert.equal((await lerEtapa('mapa', ENTRADA, {}, { fetchImpl })).contagem.qwen, 4);
  assert.equal((await lerEtapa('pendencias', ENTRADA, {}, { fetchImpl })).atendimento.agente, 'Mateus');
  assert.equal((await lerEtapa('estudo', ENTRADA, { cliente: 'VOA' }, { fetchImpl })).ultimo, null, 'sem estudo ainda não é erro');
  for (const { op } of pedidos) { assert.match(op.headers.Cookie, /vybes_quem=cracha123/); assert.equal(op.redirect, 'error'); }
  await assert.rejects(lerEtapa('perfil', ENTRADA, { setor: 'Bi!' }, { fetchImpl }), /Agente inválido/);
  await assert.rejects(lerEtapa('perfil', 'https://outro.site/entrar?t=x', { setor: 'bi' }, { fetchImpl }), /inválida/);
  await assert.rejects(lerEtapa('apagar', ENTRADA, {}, { fetchImpl }), /Leitura inválida/);
  const antiga = async () => resposta(404, {});
  await assert.rejects(lerEtapa('mapa', ENTRADA, {}, { fetchImpl: antiga }), /reinicie o VYBES/);
  const outroSetor = async () => resposta(200, { ok: true, perfil: { setor: 'copy' } });
  await assert.rejects(lerEtapa('perfil', ENTRADA, { setor: 'bi' }, { fetchImpl: outroSetor }), /perfil/);
});

test('ligar/desligar rotina e retorno de achado só passam campos conhecidos e traduzem a recusa', async () => {
  let pedido; const fetchImpl = async (url, op) => { pedido = { url, op }; return resposta(200, { ok: true }); };
  await mudarNaCentral(ENTRADA, { etapa: 'rotina', id: 'radar', acao: 'desligar', extra: 'x' }, { fetchImpl });
  assert.match(pedido.url, /\/api\/cosmos\/agentes\/rotinas$/); assert.deepEqual(JSON.parse(pedido.op.body), { id: 'radar', acao: 'desligar' }); assert.equal(pedido.op.method, 'POST');
  await mudarNaCentral(ENTRADA, { etapa: 'achado', chave: 'hoje:vybe:1', acao: 'errado' }, { fetchImpl });
  assert.deepEqual(JSON.parse(pedido.op.body), { chave: 'hoje:vybe:1', acao: 'errado' });
  await mudarNaCentral(ENTRADA, { etapa: 'achado', licao: 'lic-1', acao: 'contestar' }, { fetchImpl });
  assert.deepEqual(JSON.parse(pedido.op.body), { licao: 'lic-1', acao: 'contestar' });
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'rotina', id: 'radar', acao: 'apagar' }, { fetchImpl }), /Ação inválida/);
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'achado', chave: 'x', acao: 'incorporar' }, { fetchImpl }), /Ação inválida/);
  const donos = async () => resposta(403, { ok: false, erro: 'SO_DONOS' });
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'rotina', id: 'radar', acao: 'ligar' }, { fetchImpl: donos }), /Só os donos/);
  const fixa = async () => resposta(400, { ok: false, erro: 'ROTINA_FIXA' });
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'rotina', id: 'lembretes', acao: 'desligar' }, { fetchImpl: fixa }), /lembrete/);
});

test('uma coisa só: sem vista Cérebro no voxel, perfil na tela de Agentes, Sinapses no Cérebro do VYBES', () => {
  const mundo = readFileSync('vybe-mundo.js', 'utf8'), motor = readFileSync('mundo/mundo-3d.mjs', 'utf8'), html = readFileSync('index.html', 'utf8');
  assert.doesNotMatch(mundo, /data-vista="cerebro"|ligarCerebro|CAMADAS_INFO|cerebroDoAgenteHtml/);
  assert.doesNotMatch(motor, /mostrarCerebro|atualizarAgentesCerebro/);
  assert.match(mundo, /data-perfil-agente=/, 'a placa do prédio leva ao perfil único');
  assert.match(readFileSync('vybe-mundo-agentes.js', 'utf8'), /etapa=perfil/);
  assert.match(readFileSync('vybe-clientes-cerebro.js', 'utf8'), /\['sinapses','Sinapses'\]/);
  assert.ok(html.indexOf('/vybe-mundo-whatsapp.js') > 0 && html.indexOf('/vybe-mundo-pendencias.js') > html.indexOf('/vybe-mundo-whatsapp.js'));
  assert.match(mundo, /VybePendencias\?\.atendimentoHtml/); assert.match(mundo, /VybePendencias\?\.paraVoceHtml/);
});
