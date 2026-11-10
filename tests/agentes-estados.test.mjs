// Estados dos agentes e pedidos de aprovação no Vybe OS (Paulo, 09/11/2026). SAFE: central simulada, nada é enviado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validarAgentes, MODOS } from '../mundo/atividade-agentes.mjs';
import { lerEtapa, mudarNaCentral, validarEstados, ETAPAS_DE_DONO } from '../server/vybes-agentes.js';
import { areaVybes } from '../server/vybes.js';

const ENTRADA = 'https://vybes-central.trycloudflare.com/entrar?t=cracha123';
const resposta = (status, corpo) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(corpo) });
const em = '2026-11-09T15:00:00.000Z';
const agente = (extra = {}) => ({ setor: 'compras', estado: 'disponivel', tarefa: null, desde: null, situacao: '', emCurso: 0, ultimos: [], ...extra });

test('leitura dos agentes aceita o estado novo (ativo, sombra, pausado, desligado) e ignora o desconhecido sem quebrar', () => {
  assert.deepEqual(Object.keys(MODOS), ['ativo', 'sombra', 'pausado', 'desligado']);
  const d = validarAgentes({ ok: true, geradoEm: em, pedidosPendentes: 2, agentes: [
    agente({ modo: 'sombra', pedidos: 2 }), agente({ setor: 'bi', modo: 'pausado', modoAte: '2026-11-10T12:00:00.000Z' }), agente({ setor: 'copy', modo: 'voando', pedidos: 9 }), agente({ setor: 'midia' })] });
  const por = Object.fromEntries(d.agentes.map((a) => [a.setor, a]));
  assert.equal(por.compras.modo, 'sombra'); assert.equal(por.compras.pedidos, 2);
  assert.equal(por.bi.modo, 'pausado'); assert.equal(por.bi.modoAte, '2026-11-10T12:00:00.000Z');
  assert.equal(por.copy.modo, undefined, 'estado desconhecido é ignorado'); assert.equal(por.copy.pedidos, undefined);
  assert.equal(por.midia.modo, undefined, 'central antiga, sem o campo: segue como antes');
  assert.equal(d.pedidosPendentes, 2);
  assert.equal(validarAgentes({ ok: true, geradoEm: em, pedidosPendentes: -1, agentes: [agente()] }).pedidosPendentes, undefined);
});

test('estados e pedidos: leitura pela ponte, só campos conhecidos; mudar estado e decidir pedido vão às rotas certas', async () => {
  const pedidos = [];
  const fetchImpl = async (url, op) => { pedidos.push({ url, op }); const u = new URL(url);
    if (u.pathname === '/api/cosmos/agentes/estados') return resposta(200, { ok: true, geradoEm: em,
      agentes: [{ setor: 'compras', agente: 'Nestor', estado: 'sombra', padrao: 'sombra', por: '', em: null, explica: 'Trabalha, mas cada ação espera o OK de um dono.' }, { setor: 'x!', estado: 'sombra' }, { setor: 'bi', estado: 'voando' }],
      pedidos: [{ id: 'ka37', setor: 'compras', agente: 'Nestor', tipo: 'impressao', resumo: 'Gravar em Impressões: TAG', destino: 'Impressões no Vybe OS', previa: 'Emballar: pronta sexta', status: 'pendente', criadoEm: em, expiraEm: '2026-11-10T15:00:00.000Z', args: { segredo: 1 } },
        { id: 'nao-e-codigo', setor: 'compras', resumo: 'x', criadoEm: em, expiraEm: em }], recentes: [] });
    if (u.pathname === '/api/cosmos/agentes/estado') return resposta(200, { ok: true, agente: { setor: 'bi', estado: 'pausado' } });
    if (u.pathname === '/api/cosmos/agentes/aprovacao') return resposta(200, { ok: true, pedido: { id: 'ka37', status: 'executado' } });
    return resposta(500, {}); };
  assert.deepEqual(ETAPAS_DE_DONO, ['estados', 'estado', 'aprovacao']);
  const r = await lerEtapa('estados', ENTRADA, {}, { fetchImpl });
  assert.deepEqual(r.agentes.map((a) => [a.setor, a.estado]), [['compras', 'sombra']], 'setor ou estado inválido fica de fora');
  assert.deepEqual(r.pedidos.map((x) => x.id), ['ka37']);
  assert.equal(r.pedidos[0].args, undefined, 'argumentos da ação não chegam à tela');
  assert.equal(r.pedidos[0].previa, 'Emballar: pronta sexta');
  const ate = '2026-11-10T12:00:00.000Z';
  assert.equal((await mudarNaCentral(ENTRADA, { etapa: 'estado', setor: 'bi', estado: 'pausado', ate, extra: 1 }, { fetchImpl })).agente.estado, 'pausado');
  assert.deepEqual(JSON.parse(pedidos.at(-1).op.body), { setor: 'bi', estado: 'pausado', ate });
  await mudarNaCentral(ENTRADA, { etapa: 'aprovacao', id: 'ka37', decisao: 'recusar', motivo: '  cancelado\n pelo cliente ' }, { fetchImpl });
  assert.deepEqual(JSON.parse(pedidos.at(-1).op.body), { id: 'ka37', decisao: 'recusar', motivo: 'cancelado pelo cliente' });
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'estado', setor: 'bi', estado: 'voando' }, { fetchImpl }), /Estado inválido/);
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'estado', setor: 'bi', estado: 'ativo', ate }, { fetchImpl }), /só vale para pausar/);
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'aprovacao', id: 'ka37', decisao: 'talvez' }, { fetchImpl }), /Decisão inválida/);
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'aprovacao', id: '../x', decisao: 'aprovar' }, { fetchImpl }), /Decisão inválida/);
  const ja = async () => resposta(400, { ok: false, erro: 'JA_DECIDIDO' });
  await assert.rejects(mudarNaCentral(ENTRADA, { etapa: 'aprovacao', id: 'ka37', decisao: 'aprovar' }, { fetchImpl: ja }), /já foi decidido/);
  const falhou = async () => resposta(200, { ok: false, erro: 'ENVIO', pedido: { id: 'ka37', status: 'falhou' } });
  assert.deepEqual(await mudarNaCentral(ENTRADA, { etapa: 'aprovacao', id: 'ka37', decisao: 'aprovar' }, { fetchImpl: falhou }), { ok: false, falhou: true, erro: 'ENVIO' });
  assert.throws(() => validarEstados({ ok: true, agentes: [] }), /inválida/);
});

test('roteador: estados, mudar estado e decidir pedido só para dono, antes de ir à central', async () => {
  const res = () => ({ codigo: 0, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.corpo = d; return this; } });
  const naoDono = { tipo: 'sessao', pessoa: { id: 5, dono: false } };
  const semBanco = () => assert.fail('não pode ir ao banco nem à central');
  for (const req of [{ method: 'GET', query: { etapa: 'estados' } }, { method: 'POST', body: { etapa: 'estado', setor: 'bi', estado: 'ativo' } }, { method: 'POST', body: { etapa: 'aprovacao', id: 'ka37', decisao: 'aprovar' } }]) {
    const r = res(); await areaVybes(req, r, naoDono, semBanco); assert.equal(r.codigo, 403); assert.match(r.corpo.error, /Só os donos/);
    const s = res(); await areaVybes(req, s, null, semBanco); assert.equal(s.codigo, 401);
  }
});

function carregar() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setInterval() {}, setTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    document: { hidden: false, addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => true;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-agentes.js', 'utf8'), ctx);
  return ctx.VybeAgentes;
}
test('"Depende de você": pedido de agente em sombra entra em Para decidir (depois da falha), vencido não; a atividade do mesmo pedido não repete', () => {
  const { filaDoDono } = carregar();
  const AGORA = Date.parse(em);
  const agentes = [{ id: 'compras', agente: 'Nestor', nome: 'Compras e Fornecedores' }, { id: 'design', agente: 'Danilo', nome: 'Design Visual' }];
  const pedidos = [
    { id: 'ka37', setor: 'compras', resumo: 'Gravar em Impressões: TAG', destino: 'Impressões no Vybe OS', previa: 'pronta sexta', status: 'pendente', criadoEm: '2026-11-09T14:00:00.000Z', expiraEm: '2026-11-10T14:00:00.000Z' },
    { id: 'mb52', setor: 'compras', resumo: 'Vencido', status: 'pendente', criadoEm: '2026-11-08T10:00:00.000Z', expiraEm: '2026-11-09T10:00:00.000Z' },
    { id: 'pq23', setor: 'compras', resumo: 'Já decidido', status: 'executado', criadoEm: em, expiraEm: '2026-11-10T14:00:00.000Z' }];
  const atividades = {
    design: { ultimos: [{ estado: 'falhou', em: '2026-11-09T14:30:00Z', tarefa: 'Revisar arte', erro: 'sem arte' }] },
    compras: { ultimos: [{ estado: 'aguardando_aprovacao', em: '2026-11-09T14:00:00Z', tarefa: 'Pedir aprovação: Gravar', ferramenta: 'porta_aprovacao', ref: 'x' }] } };
  const F = filaDoDono({ agentes, perfis: {}, atividades, pedidos, agora: AGORA });
  assert.deepEqual(JSON.parse(JSON.stringify(F.decidir.map((x) => [x.tipo, x.p?.id || '']))), [['falha', ''], ['aprovacao', 'ka37']]);
  assert.equal(F.total, 2);
  assert.equal(F.esperando.length, 0, 'o pedido não aparece de novo em Esperando confirmação');
  assert.equal(F.decidir[1].agente, 'Nestor');
});

test('a tela: seletor de estado só para dono, Aprovar/Recusar na fila, o estado real na lista e na mesa do prédio', () => {
  const js = readFileSync('vybe-mundo-agentes.js', 'utf8'), mundo = readFileSync('vybe-mundo.js', 'utf8'), css = readFileSync('vybe-mundo.css', 'utf8');
  assert.match(js, /souDono\(\) && modo\.real \? estadoFormHtml\(s, modo\) : ''/, 'seletor só para dono e só com a leitura real da central');
  for (const [id, nm] of [['ativo', 'Ativo'], ['sombra', 'Sombra'], ['pausado', 'Pausado'], ['desligado', 'Desligado']]) assert.ok(js.includes(`${id}: ['${nm}', '`), nm);
  assert.match(js, /name="ate"/, 'pausa com data de volta opcional');
  assert.match(js, /data-vga-aprovacao="aprovar"/); assert.match(js, /data-vga-aprovacao="recusar"/);
  assert.match(js, /<summary>O que será feito<\/summary>/, 'prévia do que será feito');
  assert.match(js, /chamar\(\{ id: b\.dataset\.vgaId, decisao: b\.dataset\.vgaAprovacao/);
  assert.match(js, /\[rot, , cor\] = rotuloDoModo\(m\)/, 'a lista usa o estado real');
  assert.match(mundo, /MATURIDADE\[e\.modo\] \|\| MATURIDADE\[s\.estado\]/, 'a mesa do prédio usa o estado real');
  const i = css.indexOf('Estado do agente (09/11/2026)');
  assert.doesNotMatch(css.slice(i, css.indexOf('@media (max-width:640px){.vga-fila li', i)), /:has\(|!important/, 'sem :has nem !important (Vybe OS: :has pesa)');
});
