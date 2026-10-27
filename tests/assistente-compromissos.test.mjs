import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { compromissosProximos } from '../server/assistente-compromissos.js';

// Lembretes de compromisso: só o que começa nos próximos 75 minutos; dono pela convenção da agenda (azul = captação do
// Mizinho; o resto, do Paulo) e quem é citado pelo nome no título; nome ambíguo não avisa ninguém por engano.
test('compromissos próximos: janela, dono pela cor e pessoas citadas no título', async () => {
  const { db, sql } = conexao();
  try {
    await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean,monday_user_id bigint,admin boolean);
      INSERT INTO vybe_pessoas VALUES(1,'Paulo Martins',true,68035537,true),(2,'Ademir Souza',true,78158742,false),(3,'Ewerton Lima',true,68036687,false),
        (4,'Ewerton Silva',true,98079733,false),(5,'Jady Oliveira',true,100482777,false),(6,'Beatriz Costa',true,71130408,false);`);
    const agora = Date.parse('2026-10-27T12:00:00-03:00');
    const em = (min) => new Date(agora + min * 60e3).toISOString();
    const ev = (id, summary, min, extra = {}) => ({ id, summary, status: 'confirmed', start: { dateTime: em(min) }, end: { dateTime: em(min + 60) }, ...extra });
    const eventos = [
      ev('a', 'Captação - Antonov - Iago', 60),                        // azul (sem cor): Mizinho
      ev('b', 'Reunião com Jady e Bia - Copirecê', 30, { colorId: '5' }), // amarela: Paulo, Jady, Bia
      ev('c', 'Alinhamento Ewerton', 45, { colorId: '5' }),              // dois Ewerton: só o Paulo
      ev('d', 'Reunião depois', 120, { colorId: '5' }),                   // fora da janela
      ev('e', 'Captação cancelada', 40, { status: 'cancelled' }),
      ev('f', 'Particular', 40, { visibility: 'private' }),
      { id: 'g', summary: 'Feriado', status: 'confirmed', start: { date: '2026-10-27' }, end: { date: '2026-10-28' } },
      ev('h', 'Já começou', -5),
    ];
    let pedido;
    const r = await compromissosProximos(sql, { agora, listar: async (dia, o) => { pedido = { dia, ...o }; return { eventos }; } });
    assert.deepEqual(pedido, { dia: '2026-10-27', dias: 1, bruto: true });
    const quem = Object.fromEntries(r.map((c) => [c.id, c.pessoas.map((p) => p.nome).sort()]));
    assert.deepEqual(quem, { a: ['Ademir Souza'], b: ['Beatriz Costa', 'Jady Oliveira', 'Paulo Martins'], c: ['Paulo Martins'] });
    assert.equal(r.find((c) => c.id === 'a').hora, '13:00');
    assert.equal(r.find((c) => c.id === 'a').tipo, 'captacao');
    assert.equal(r.find((c) => c.id === 'c').pessoas[0].admin, true);
  } finally { await db.close(); }
});
