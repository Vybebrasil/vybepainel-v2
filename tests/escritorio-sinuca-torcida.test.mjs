// Torcida da sinuca (Paulo, 08/11/2026: "quem tá assistindo pode apostar na
// partida contra quem assiste, contra quem joga... aposto 100 que não mata essa bola").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { tacadaMatou } from '../server/escritorio-sinuca-torcida.js';

test('tacada que mata: bola do grupo (ou qualquer uma na mesa aberta), sem falta', () => {
 assert.equal(tacadaMatou({ caiu: [4], falta: null }, 'pares'), true);
 assert.equal(tacadaMatou({ caiu: [5], falta: null }, 'pares'), false, 'bola do outro (casa livre) não é matar');
 assert.equal(tacadaMatou({ caiu: [5], falta: null }, null), true);
 assert.equal(tacadaMatou({ caiu: [4], falta: 'branca' }, 'pares'), false);
 assert.equal(tacadaMatou({ caiu: [], falta: null }, 'pares'), false);
});

test('torcida: oferece, topa, as moedas saem no aceite e o prêmio vai para quem acertou', async (t) => {
 const { db, sql } = await bancoEscritorio(t);
 for (const f of ['2026-10-18-escritorio-postits-presentes.sql', '2026-10-27-escritorio-mesas.sql', '2026-10-27-escritorio-poker-mesa-cheia.sql', '2026-10-27-escritorio-bots-temporadas.sql']) await db.exec(readFileSync('migrations/' + f, 'utf8'));
 const x = await import('../server/escritorio-mesas.js');
 const { salasDoEscritorio } = await import('../server/escritorio-mapa.js');
 const salas = salasDoEscritorio([{ id: 1, nome: 'Paulo' }, { id: 3, nome: 'Vinícius' }]);
 const d = await x.desafiarMesa(sql, { id: 1 }, salas, { para: '3', jogo: 'sinuca', camada: 'jogos', movel: 'bling15_pooltable@4,4', chave: 'torcida-001' });
 await x.responderMesa(sql, { id: 3 }, salas, { id: d.id, acao: 'aceitar' });
 await db.exec(`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,500),(2,500),(3,500) ON CONFLICT(pessoa_id) DO UPDATE SET saldo=EXCLUDED.saldo`);
 const saldo = async (p) => Number((await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${p}`)[0].saldo);
 // O 2 assiste e oferece 100 na vitória do desafiado, aberta para qualquer um.
 await x.acaoMesa(sql, { id: 2 }, { id: d.id, acao: 'assistindo' });
 let v = await x.verMesa(sql, { id: 1 }, d.id);
 assert.deepEqual(v.torcida.assistindo.map((p) => p.id), ['2']);
 await x.acaoMesa(sql, { id: 2 }, { id: d.id, acao: 'aposta-oferecer', aposta: 'vit-000001', tipo: 'vitoria', escolha: 'desafiado', valor: 100 });
 // O desafiante não pode topar apostando contra si... topar é apostar no contrário (a vitória dele): pode.
 await assert.rejects(x.acaoMesa(sql, { id: 3 }, { id: d.id, acao: 'aposta-topar', aposta: 'vit-000001' }), /própria vitória/);
 await assert.rejects(x.acaoMesa(sql, { id: 2 }, { id: d.id, acao: 'aposta-oferecer', aposta: 'vit-000002', tipo: 'vitoria', escolha: 'desafiado', valor: 5000 }), /1 a 1000/);
 const r = await x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'aposta-topar', aposta: 'vit-000001' });
 assert.equal(r.topada, true); assert.equal(await saldo(1), 400); assert.equal(await saldo(2), 400);
 await assert.rejects(x.acaoMesa(sql, { id: 3 }, { id: d.id, acao: 'aposta-topar', aposta: 'vit-000001' }), /não está mais aberta/);
 // Aposta na tacada: o 2 diz que quem está na vez não mata; o outro jogador topa.
 v = await x.verMesa(sql, { id: 1 }, d.id);
 const vez = v.vez, tacador = vez === 'desafiante' ? { id: 1 } : { id: 3 }, outro = tacador.id === 1 ? { id: 3 } : { id: 1 };
 await assert.rejects(x.acaoMesa(sql, tacador, { id: d.id, acao: 'aposta-oferecer', aposta: 'tac-000001', tipo: 'tacada', escolha: 'nao', valor: 10 }), /só aposta que mata/);
 await x.acaoMesa(sql, { id: 2 }, { id: d.id, acao: 'aposta-oferecer', aposta: 'tac-000002', tipo: 'tacada', escolha: 'nao', valor: 50, para: String(tacador.id) });
 await x.acaoMesa(sql, tacador, { id: d.id, acao: 'aposta-topar', aposta: 'tac-000002' });
 await x.acaoMesa(sql, { id: 2 }, { id: d.id, acao: 'aposta-oferecer', aposta: 'tac-000003', tipo: 'tacada', escolha: 'mata', valor: 20 });
 const antes = { t: await saldo(tacador.id), dois: await saldo(2) };
 // As apostas valem na pré-partida; a tacada só sai depois dos dois PREPARADOS.
 await x.acaoMesa(sql, { id: 1 }, { id: d.id, acao: 'pronto' }); await x.acaoMesa(sql, { id: 3 }, { id: d.id, acao: 'pronto' });
 // Tacada fraca para trás: não toca em nada (cega), então não matou.
 await x.lanceMesa(sql, tacador, { id: d.id, n: 0, tipo: 'tacar', angulo: Math.PI, forca: 0.02 });
 v = await x.verMesa(sql, { id: 2 }, d.id);
 const ap = Object.fromEntries(v.torcida.apostas.map((a) => [a.id, a]));
 assert.equal(ap['tac-000002'].estado, 'paga'); assert.equal(ap['tac-000002'].ganhador, '2');
 assert.equal(ap['tac-000003'].estado, 'expirada', 'ninguém topou antes da tacada');
 assert.equal(await saldo(2), antes.dois + 100); assert.equal(await saldo(tacador.id), antes.t);
 // Fim: quem desiste perde; a aposta da vitória é paga.
 await x.acaoMesa(sql, outro, { id: d.id, acao: 'desistir' });
 v = await x.verMesa(sql, { id: 2 }, d.id);
 const venceu = v.resultado, vitoria = v.torcida.apostas.find((a) => a.id === 'vit-000001');
 assert.equal(vitoria.estado, 'paga');
 assert.equal(vitoria.ganhador, venceu === 'desafiado' ? '2' : '1');
});
