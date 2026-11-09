// Pré-partida da sinuca (Paulo, 09/11/2026: "cada player tem que dar um
// preparado, e pode ser a hora das apostas de quem tá dentro e assistindo").
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRE_S, preValeNaMesa, abrirPre, preAberta, marcarPronto, fecharPre, vistaPre } from '../server/escritorio-sinuca-pre.js';

test('pré-partida: só 1×1 entre a equipe', () => {
 assert.equal(preValeNaMesa({ jogo: 'sinuca', bot: null, mais: [], clientes: [] }), true);
 assert.equal(preValeNaMesa({ jogo: 'sinuca', bot: 'sinuca:facil' }), false);
 assert.equal(preValeNaMesa({ jogo: 'sinuca', mais: ['5', '7'] }), false);
 assert.equal(preValeNaMesa({ jogo: 'sinuca', clientes: ['9'] }), false);
 assert.equal(preValeNaMesa({ jogo: 'domino' }), false);
});

test('pré-partida: abre com os dois prontos ou quando o relógio acaba', () => {
 const t0 = Date.parse('2026-11-09T12:00:00Z');
 let mesa = { n: 0, vez: 'desafiante', pre: abrirPre(t0) };
 assert.equal(preAberta(mesa, t0 + 1000), true);
 assert.deepEqual(vistaPre(mesa, t0), { prontos: [], ate: mesa.pre.ate, total: PRE_S });
 let r = marcarPronto(mesa, 'desafiado', t0 + 2000);
 assert.equal(r.comecou, false); assert.deepEqual(r.mesa.pre.prontos, ['desafiado']);
 r = marcarPronto(r.mesa, 'desafiado', t0 + 3000);
 assert.equal(r.comecou, false, 'repetir não conta duas vezes');
 r = marcarPronto(r.mesa, 'desafiante', t0 + 4000);
 assert.equal(r.comecou, true); assert.equal('pre' in r.mesa, false); assert.equal(r.mesa.vez, 'desafiante');
 assert.equal(preAberta(mesa, t0 + PRE_S * 1000), false, 'ninguém fica preso');
 assert.equal(vistaPre(mesa, t0 + PRE_S * 1000), null);
 assert.equal('pre' in fecharPre(mesa), false);
 assert.throws(() => marcarPronto(mesa, 'jogador3'), /Só quem joga/);
});
