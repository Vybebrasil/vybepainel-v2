// O pedido ao servidor mantém o próprio "acao" (Paulo, 27/10/2026: "os jogos
// não funcionam, dá pedido inválido"). A rota vai no endereço; antes o nome
// da rota sobrescrevia o "aceitar"/"desistir" do corpo, e aceitar convite,
// recusar, desistir, propor empate e responder troca davam "Pedido inválido".
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../vybe-escritorio.js', import.meta.url), 'utf8');
const inicio = fonte.indexOf('async function escritorioApi(');
const fim = fonte.indexOf('\n}', inicio) + 2;

test('escritorioApi manda a rota no endereço e o acao do pedido no corpo', async () => {
 const pedidos = [];
 const ctx = vm.createContext({ window: {}, URLSearchParams, JSON, Object, Error,
  fetch: async (url, op) => { pedidos.push({ url, corpo: JSON.parse(op.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; } });
 vm.runInContext(fonte.slice(inicio, fim), ctx);
 await ctx.escritorioApi('mesa-responder', { id: '7', acao: 'aceitar' });
 await ctx.escritorioApi('mesa-lance', { id: '7', n: 0, tipo: 'largar' });
 assert.match(pedidos[0].url, /acao=mesa-responder/);
 assert.equal(pedidos[0].corpo.acao, 'aceitar', 'o corpo leva a resposta, não o nome da rota');
 assert.equal(pedidos[1].corpo.acao, 'mesa-lance', 'sem acao próprio, o corpo leva a rota como antes');
});
