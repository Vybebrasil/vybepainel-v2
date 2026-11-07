// WhatsApp interno do Vybe OS: ponte de leitura pelo túnel (server/vybes-whatsapp.js) e o painel do HUD
// (vybe-mundo-whatsapp.js). SAFE: central simulada; nada envia mensagem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lerWhatsappDaCentral, validarCaixa } from '../server/vybes-whatsapp.js';
import { areaVybes } from '../server/vybes.js';
import handler from '../api/painel.js';

const entrada = 'https://teste.trycloudflare.com/entrar?t=cracha-so-servidor';
const C1 = 'a'.repeat(20), C2 = 'b'.repeat(20);
const msg = (seq, extra = {}) => ({ seq, em: 1_788_000_000_000 + seq, autor: 'Tainara Souza', minha: false, vybes: false, tipo: 'texto', midia: null,
  texto: 'Oi ' + seq, mencoes: [], paraVoce: false, citada: null, apagada: false, editada: false, ...extra });
const lista = () => ({ ok: true, somenteLeitura: true, geradoEm: '2026-11-07T12:00:00.000Z', gruposLidosEm: null, seq: 9,
  eu: { nome: 'Reriston Alves', pessoa: '9', socio: false, vinculado: true },
  conversas: [
    { id: C1, nome: 'Produção', tipo: 'interno', cliente: null, total: 3, ultima: { seq: 9, em: 1_788_000_000_009, autor: 'Tainara Souza', minha: false, apagada: false, midia: null, texto: '@Reriston revisa' }, recebidas: [7, 9] },
    { id: C2, nome: '#Vybe - Gonzalez', tipo: 'cliente', cliente: 'Gonzalez', total: 1, ultima: { seq: 4, em: 1_788_000_000_004, autor: 'Hellen', minha: false, apagada: false, midia: '📷 Foto', texto: '' }, recebidas: [4] },
  ],
  mencoes: [{ ...msg(9, { paraVoce: true, mencoes: ['Reriston Alves'] }), conversa: C1, grupo: 'Produção', texto: '@Reriston revisa' }] });

test('ponte WhatsApp: só GET ao túnel, cookie no servidor e projeção sem crachá nem campo extra', async () => {
  const r = await lerWhatsappDaCentral(entrada, { fetchImpl: async (url, o) => {
    assert.equal(url, 'https://teste.trycloudflare.com/api/cosmos/whatsapp'); assert.equal(o.method, 'GET'); assert.equal(o.redirect, 'error');
    assert.equal(o.headers.Cookie, 'vybes_quem=cracha-so-servidor');
    const d = lista(); d.cracha = 'segredo'; d.conversas[0].telefone = '5574999990000'; d.eu.pessoa = '9';
    return new Response(JSON.stringify(d));
  } });
  assert.equal(r.conversas.length, 2); assert.equal(r.mencoes[0].grupo, 'Produção'); assert.equal(r.fonte, 'central-vybes');
  assert.doesNotMatch(JSON.stringify(r), /cracha-so-servidor|segredo|trycloudflare|5574999990000/);
  const aberta = await lerWhatsappDaCentral(entrada, { conversa: C1, fetchImpl: async (url) => {
    assert.equal(url, `https://teste.trycloudflare.com/api/cosmos/whatsapp?conversa=${C1}`);
    return new Response(JSON.stringify({ ...lista(), conversas: undefined, mencoes: undefined, conversa: { id: C1, nome: 'Produção', tipo: 'interno', cliente: null, mensagens: [msg(7), msg(9, { minha: true })] } }));
  } });
  assert.equal(aberta.conversa.mensagens.length, 2); assert.equal(aberta.conversa.mensagens[1].minha, true);
});

test('ponte WhatsApp recusa entrada externa, conversa inválida, resposta fora do formato e erro remoto', async () => {
  for (const url of ['https://example.com/entrar?t=x', 'http://teste.trycloudflare.com/entrar?t=x', 'https://user:senha@teste.trycloudflare.com/entrar?t=x', 'https://teste.trycloudflare.com/outra?t=x'])
    await assert.rejects(lerWhatsappDaCentral(url, { fetchImpl: () => assert.fail('não pode chamar destino') }), (e) => e.status === 502 && !e.message.includes('senha'));
  await assert.rejects(lerWhatsappDaCentral(entrada, { conversa: '../agentes', fetchImpl: () => assert.fail('não pode chamar') }), (e) => e.status === 400);
  const ruins = [{}, { ...lista(), somenteLeitura: false }, { ...lista(), conversas: [{ ...lista().conversas[0], tipo: 'particular' }] },
    { ...lista(), conversas: [lista().conversas[0], lista().conversas[0]] }, { ...lista(), mencoes: [{ ...lista().mencoes[0], conversa: 'c'.repeat(20) }] },
    { ...lista(), conversas: [{ ...lista().conversas[0], ultima: { ...lista().conversas[0].ultima, texto: 'x'.repeat(201) } }] }];
  for (const d of ruins) await assert.rejects(lerWhatsappDaCentral(entrada, { fetchImpl: async () => new Response(JSON.stringify(d)) }), (e) => e.status === 502);
  await assert.rejects(lerWhatsappDaCentral(entrada, { fetchImpl: async () => new Response('segredo remoto', { status: 503 }) }), (e) => e.status === 502 && !e.message.includes('segredo'));
  await assert.rejects(lerWhatsappDaCentral(entrada, { conversa: C2, fetchImpl: async () => new Response('{}', { status: 404 }) }), (e) => e.status === 404);
  await assert.rejects(lerWhatsappDaCentral(entrada, { fetchImpl: async () => new Response('x'.repeat(1024 * 1024 + 1)) }), (e) => e.status === 502);
  await assert.rejects(lerWhatsappDaCentral(entrada, { fetchImpl: async () => { throw new Error('rede caiu'); } }), (e) => e.status === 504);
  assert.throws(() => validarCaixa({ ...lista(), conversa: { id: C2 } }, { conversa: C1 }), /inválida/);
});

test('GET whatsapp sem sessão devolve 401 antes do banco; POST não envia nada', async () => {
  const res = () => ({ codigo: 0, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.corpo = d; return this; } });
  const r = res(); await handler({ method: 'GET', headers: {}, query: { area: 'vybes', etapa: 'whatsapp' } }, r); assert.equal(r.codigo, 401);
  const direto = res(); await areaVybes({ method: 'GET', query: { etapa: 'whatsapp' } }, direto, null, () => assert.fail('não consultar banco')); assert.equal(direto.codigo, 401);
  const ruim = res(); await areaVybes({ method: 'GET', query: { etapa: 'whatsapp', conversa: 'x' } }, ruim, null, () => assert.fail('não consultar banco')); assert.equal(ruim.codigo, 400);
  const post = res(); await areaVybes({ method: 'POST', body: { etapa: 'whatsapp', texto: 'oi' } }, post, null, () => assert.fail('não consultar banco')); assert.equal(post.codigo, 405);
});

// ---------- Painel no HUD (vybe-mundo-whatsapp.js), num DOM mínimo simulado ----------
function montarPainel({ respostas, permissao = 'granted', escondido = false } = {}) {
  const fonte = readFileSync('vybe-mundo-whatsapp.js', 'utf8');
  const armazenamento = new Map(), notificacoes = [], pedidos = [];
  const ctx = { console, Date, Math, JSON, Number, String, Array, Object, Set, Map, Promise, encodeURIComponent, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    localStorage: { getItem: (k) => armazenamento.get(k) ?? null, setItem: (k, v) => armazenamento.set(k, String(v)) },
    fetch: async (url) => { pedidos.push(url); const d = respostas(url); return { ok: !d.erro, status: d.status || 200, json: async () => d }; },
    Notification: Object.assign(function (titulo, o) { notificacoes.push({ titulo, ...o }); this.close = () => {}; }, { permission: permissao, requestPermission: async () => permissao }),
    document: { hidden: escondido, addEventListener() {}, querySelector: () => null, getElementById: () => null, createElement: () => ({ setAttribute() {}, append() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {} }), body: { append() {} } },
    addEventListener() {}, AbortSignal: { timeout: () => undefined }, Intl };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fonte, ctx);
  return { api: ctx.vybeWhatsapp, notificacoes, pedidos, armazenamento };
}

test('não lidas por conversa, menções a você e notificação só do que chegou depois de abrir', async () => {
  let atual = lista();
  const p = montarPainel({ respostas: () => atual, escondido: true }); // aba escondida: vai para a notificação do sistema
  await p.api.atualizar();
  // Primeira leitura: o que já existia conta como lido (não dispara notificação nem acende 300 não lidas).
  assert.equal(p.api.estado().naoLidas, 0); assert.equal(p.notificacoes.length, 0);
  atual = lista(); atual.seq = 12;
  atual.conversas[0].ultima = { ...atual.conversas[0].ultima, seq: 12, texto: '@Reriston olha de novo', autor: 'Tainara Souza' };
  atual.conversas[0].recebidas = [7, 9, 11, 12];
  atual.mencoes.unshift({ ...msg(12, { paraVoce: true }), conversa: C1, grupo: 'Produção', texto: '@Reriston olha de novo' });
  await p.api.atualizar();
  const e = p.api.estado();
  assert.equal(e.naoLidas, 2); assert.equal(e.porConversa[C1], 2); assert.equal(e.mencoesNaoLidas, 1);
  assert.equal(p.notificacoes.length, 1); assert.match(p.notificacoes[0].titulo, /mencionou você|Produção/); assert.match(p.notificacoes[0].body, /olha de novo/);
  // Abrir a conversa marca como lida (no aparelho de quem abriu) e limpa a menção dela.
  p.api.marcarLida(C1);
  assert.equal(p.api.estado().naoLidas, 0); assert.equal(p.api.estado().mencoesNaoLidas, 0);
  await p.api.atualizar(); assert.equal(p.notificacoes.length, 1, 'não notifica de novo o mesmo');
  // Nada de enviar: a única rota chamada é a de leitura.
  assert.ok(p.pedidos.every((u) => u.startsWith('/api/painel?area=vybes&etapa=whatsapp')));
});

test('mensagem nova sem menção avisa com o nome do grupo; a própria mensagem não avisa', async () => {
  let atual = lista();
  const p = montarPainel({ respostas: () => atual, escondido: true });
  await p.api.atualizar();
  atual = lista(); atual.seq = 15;
  atual.conversas[1].ultima = { ...atual.conversas[1].ultima, seq: 15, midia: '🎤 Áudio', texto: '', autor: 'Hellen' }; atual.conversas[1].recebidas = [4, 15];
  await p.api.atualizar();
  assert.equal(p.notificacoes.length, 1); assert.match(p.notificacoes[0].titulo, /#Vybe - Gonzalez/); assert.match(p.notificacoes[0].body, /Hellen: 🎤 Áudio/);
  atual = lista(); atual.seq = 16;
  atual.conversas[0].ultima = { ...atual.conversas[0].ultima, seq: 16, minha: true, autor: 'Reriston Alves', texto: 'feito' };
  await p.api.atualizar();
  assert.equal(p.notificacoes.length, 1);
  // Com a aba à vista o aviso vai para a tela (não duplica no sistema).
  const visivel = montarPainel({ respostas: () => atual });
  await visivel.api.atualizar(); atual = lista(); atual.seq = 20; atual.conversas[1].ultima = { ...atual.conversas[1].ultima, seq: 20 }; atual.conversas[1].recebidas = [4, 20];
  await visivel.api.atualizar();
  assert.equal(visivel.notificacoes.length, 0); assert.equal(visivel.api.estado().avisos.length, 1);
});

test('central desligada vira aviso na tela, sem quebrar o painel', async () => {
  const p = montarPainel({ respostas: () => ({ erro: true, status: 503, error: 'O VYBES do PC do Paulo está desligado agora.' }) });
  await p.api.atualizar();
  assert.match(p.api.estado().erro, /desligado/);
  assert.equal(p.api.estado().naoLidas, 0);
});

test('ligação no vybe-mundo.js é só o botão da barra do topo', () => {
  const mundo = readFileSync('vybe-mundo.js', 'utf8');
  assert.equal(mundo.split(/\r?\n/).filter((l) => /data-ferr="whatsapp"|vybeWhatsapp|vybe-mundo-whatsapp|vv-wa-/.test(l)).length, 1);
  assert.match(mundo, /<button type="button" class="vv-botao" data-ferr="whatsapp"[^\n]*vv-badge-whatsapp/);
  const html = readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('/vybe-mundo-whatsapp.js') > 0 && html.indexOf('/vybe-mundo-whatsapp.css') > 0);
});

test('prévia local: os dados fictícios do WhatsApp passam pelo mesmo validador da central', async () => {
  const { demoWhatsapp } = await import('../scripts/fixtures-whatsapp.mjs');
  const [status, d] = demoWhatsapp(new URL('http://x/api/painel?area=vybes&etapa=whatsapp'));
  assert.equal(status, 200); assert.ok(d.conversas.length >= 10); assert.ok(d.mencoes.length > 0);
  assert.ok(d.conversas.some((c) => c.tipo === 'interno') && d.conversas.some((c) => c.tipo === 'cliente'));
  const [s2, aberta] = demoWhatsapp(new URL(`http://x/?conversa=${d.conversas[0].id}`));
  assert.equal(s2, 200); assert.ok(aberta.conversa.mensagens.length > 10);
  assert.equal(demoWhatsapp(new URL(`http://x/?conversa=${'f'.repeat(20)}`))[0], 404);
});
