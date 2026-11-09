// Conquistas e títulos da sinuca (Paulo, 08/11/2026: "mais conquistas... alguns
// engraçados, alguns fodas", "títulos negativos também", "zera as vitórias e os
// tacos... o que for de conquista pode deixar").
import test from 'node:test';
import assert from 'node:assert/strict';
import { fichaSinuca } from '../server/escritorio-sinuca-conquistas.js';

const st = (x = {}) => ({ t: 20, b: 3, seq: 0, maxSeq: 2, uma: 1, saida: 0, suic: 0, cego: 0, outro: 0, faltas: 2, atras: 0, vis: 0, maxVis: 2, restam: 4, ...x });
const p = (desafiante, desafiado, resultado, dia, extra = {}) => ({ desafiante, desafiado, resultado, motivo: 'um', bot: null, moedas: 0, terminado_em: `2026-11-${String(dia).padStart(2, '0')}T15:00:00Z`, ...extra });
const tem = (f) => Object.fromEntries(f.trofeus.filter((t) => t.tem).map((t) => [t.chave, t.vezes]));

test('zerada: vitórias, tacos e conquistas contam só depois (Paulo, 09/11/2026: "zera as conquistas")', () => {
 const partidas = [p(1, 3, 'desafiante', 1), p(1, 3, 'desafiante', 2), p(1, 3, 'desafiante', 3), p(1, null, 'desafiante', 4, { bot: 'sinuca:lendario', desafiado: null }), p(1, 3, 'desafiado', 10)];
 const f = fichaSinuca(1, partidas, 1, { desde: '2026-11-09T03:00:00Z' });
 assert.equal(f.vitorias, 0); assert.equal(f.derrotas, 1); assert.deepEqual(f.tacos, ['casa'], 'o Lenda e o Ouro do Baianinho e do ranking zeraram');
 const t = tem(f);
 assert.ok(!t.primeira && !t.embalado && !t.baianinho, 'as conquistas de antes zeraram');
 assert.equal(f.titulo, null); assert.equal(f.historico.vitorias, 0);
});

test('conquistas novas de 09/11: quádrupla, sniper, paredão, vingança e as zoeiras amarelou, bateu na trave, mira torta, cartão', () => {
 const partidas = [
  p(3, 1, 'desafiante', 10), p(3, 1, 'desafiante', 11), p(3, 1, 'desafiante', 12),
  p(1, 3, 'desafiante', 13, { stats: { desafiante: st({ uma: 4, t: 10, b: 7, faltas: 0 }), desafiado: st({ faltas: 3, atras: 0 }) } }),
  p(1, 3, 'desafiado', 14, { stats: { desafiante: st({ t: 20, b: 2, faltas: 5, restam: 1, atras: 0 }), desafiado: st({ atras: 4 }) } }),
 ];
 const um = tem(fichaSinuca(1, partidas, null)), tres = tem(fichaSinuca(3, partidas, null));
 for (const c of ['quatro', 'sniper', 'paredao', 'vinganca']) assert.ok(um[c], c);
 for (const c of ['amarelou', 'quase', 'mira-torta', 'cartao']) assert.ok(um[c], c);
 assert.ok(!tres.vinganca && !tres.quatro);
});

test('conquistas do jogo: saída, bolas seguidas, mesa limpa, virada, pneu e as zoeiras', () => {
 const partidas = [
  p(1, 3, 'desafiante', 10, { stats: { desafiante: st({ saida: 3, uma: 3, maxSeq: 8, maxVis: 8, faltas: 0, t: 10, atras: 5 }), desafiado: st({ b: 0, saidaSuic: 1, suic: 3, cego: 3, outro: 3, restam: 7 }) } }),
  p(3, 1, 'desafiante', 11, { motivo: 'um-cedo', stats: { desafiado: st({ restam: 0 }), desafiante: st() } }),
 ];
 const um = tem(fichaSinuca(1, partidas, null)), tres = tem(fichaSinuca(3, partidas, null));
 for (const c of ['saida3', 'tres', 'cinco', 'fominha', 'mesa-limpa', 'virada', 'pneu', 'limpinho', 'relampago']) assert.ok(um[c], c);
 assert.ok(um.praia && um.apressado, 'perdeu com só o ás e matou o ás antes da hora');
 for (const c of ['levou-pneu', 'kamikaze', 'mao-alface', 'cego', 'caridoso']) assert.ok(tres[c], c);
 const f3 = fichaSinuca(3, partidas, null);
 assert.equal(f3.apelido.chave, 'levou-pneu', 'o apelido é a zoeira mais pesada');
 assert.equal(fichaSinuca(1, partidas, null).titulo.raridade, 'lendario');
});

test('freguês, carrasco, pé-frio, azarão e zebra', () => {
 const partidas = [];
 for (let d = 1; d <= 6; d++) partidas.push(p(1, 3, 'desafiante', d));
 const um = tem(fichaSinuca(1, partidas, null)), tres = tem(fichaSinuca(3, partidas, null));
 assert.ok(um.carrasco); assert.ok(tres.fregues && tres['pe-frio']);
 // O 5 (sem vitória) derruba o 1 (6 vitórias): azarão para o 5, zebra para o 1.
 partidas.push(p(5, 1, 'desafiante', 7));
 assert.ok(tem(fichaSinuca(5, partidas, null)).azarao); assert.ok(tem(fichaSinuca(1, partidas, null)).zebra);
 assert.ok(tem(fichaSinuca(5, partidas, null)).gigante, 'o 1 era o líder na hora');
});
