// Miniatura de peça nascida no Vybe OS (Paulo, 13/11/2026): a tela pede "vybe:<id>" e a resposta vinha vazia porque
// o servidor casava só o id do Monday. Agora casa pelos dois, e devolve com a mesma chave que foi pedida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conexao } from './postgres.mjs';
import { miniaturasDasPecas } from '../api/painel.js';

test('miniaturas: casa o id do Monday e o vybe:<id> interno; removida e arquivo ausente ficam fora', async () => {
  const { db, sql } = conexao();
  try {
    await db.exec(`CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,removido_em timestamptz);
      CREATE TABLE vybe_conteudo_arquivos(conteudo_id bigint,nome text,extensao text,drive_file_id text,criado_em timestamptz,ausente_em timestamptz);
      INSERT INTO vybe_conteudos VALUES (1,'12863070737',NULL),(2,NULL,NULL),(3,NULL,'2026-11-01'),(4,NULL,NULL);
      INSERT INTO vybe_conteudo_arquivos VALUES (1,'a.png','png','D1','2026-11-01',NULL),
        (2,'velho.png','png','D2a','2026-11-01',NULL),(2,'novo.png','png','D2b','2026-11-05',NULL),
        (3,'removida.png','png','D3','2026-11-01',NULL),(4,'sumiu.png','png','D4','2026-11-01','2026-11-02');`);
    const m = await miniaturasDasPecas(sql, ['12863070737', 'vybe:2', 'vybe:3', 'vybe:4', 'vybe:x']);
    assert.deepEqual(Object.keys(m).sort(), ['12863070737', 'vybe:2']);
    assert.equal(m['vybe:2'].nome, 'novo.png', 'o arquivo mais recente');
    assert.equal(m['vybe:2'].total, 2);
    assert.equal(m['vybe:2'].thumb, 'https://drive.google.com/thumbnail?id=D2b&sz=w160');
    assert.equal(m['12863070737'].thumb, 'https://drive.google.com/thumbnail?id=D1&sz=w160');
  } finally { await db.close(); }
});

test('telas pedem a miniatura também para peça vybe:', () => {
  for (const arquivo of ['vybe-mundo.js', 'vybe-mundo-conteudo.js']) {
    const s = fs.readFileSync(arquivo, 'utf8');
    assert.doesNotMatch(s, /startsWith\('vybe:'\)\) (?:\{ previasDecidir\[ref\] = null|st\.thumbs\[id\] = null)/, arquivo);
  }
});
