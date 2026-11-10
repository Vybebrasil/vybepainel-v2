import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { guardarBriefing } from '../api/conteudo.js';

// Paulo, 10/11/2026: um chat do Claude mandou "briefing" sem o texto e o briefing do "Reels - FAQ 01" da Antonov sumiu.
test('briefing só apaga de propósito: sem o campo texto é erro, vazio só com apagar: true', async () => {
  const { db, sql } = conexao();
  try {
    await db.exec(`CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,titulo text,briefing text,atualizado_em timestamptz);
      INSERT INTO vybe_conteudos VALUES(1,NULL,'Reels - FAQ 01','Fazer perguntas',NULL);
      CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text);`);
    const quem = { tipo: 'sessao', pessoa: { id: 1 } };
    await assert.rejects(() => guardarBriefing(sql, quem, { item: 'vybe:1' }), /Falta o texto do briefing.*Nada foi alterado/);
    await assert.rejects(() => guardarBriefing(sql, quem, { item: 'vybe:1', texto: '   ' }), /veio vazio.*apagar: true/);
    assert.equal((await sql`SELECT briefing FROM vybe_conteudos WHERE id=1`)[0].briefing, 'Fazer perguntas');
    const r = await guardarBriefing(sql, quem, { item: 'vybe:1', texto: '', apagar: true });
    assert.equal(r.mudou, true);
    assert.equal((await sql`SELECT briefing FROM vybe_conteudos WHERE id=1`)[0].briefing, null);
    // A tela manda apagar: true só quando quem editou deixou o briefing em branco.
    assert.match(readFileSync(new URL('../vybe-briefing.js', import.meta.url), 'utf8'), /apagar: !String\(texto \?\? ''\)\.trim\(\)/);
  } finally { await db.close(); }
});
