import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { catalogosDoQuadro } from '../vybe_dominio_store.js';

// "Ver como" (Front End, 09/11): a lista da equipe do painel diz quem é dono pela regra do servidor (server/donos.js).
test('pessoas do painel trazem dono pela regra de ehDonoPessoa (id do Monday dos quatro donos)', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text, borda text, monday_index int, final boolean, ativa boolean, ordem int);
    CREATE TABLE vybe_captacao (chave text, rotulo text, cor text, borda text, monday_index int, ativa boolean, ordem int);
    CREATE TABLE vybe_opcoes (coluna_id text, chave text, rotulo text, cor text, borda text, indice int, ativa boolean, ordem int);
    CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, monday_user_id text, nome text, papel text, disciplina text, foto_url text);
    INSERT INTO vybe_pessoas VALUES (1,'68035537','Paulo Martins',NULL,NULL,NULL),(3,'68035653','Vinícius',NULL,NULL,NULL),(7,'111','Beatriz',NULL,NULL,NULL);`);
  const r = await catalogosDoQuadro(1, { sql });
  assert.deepEqual(r.pessoas.map((p) => [p.nome, p.dono, 'painel_id' in p]), [['Beatriz', false, false], ['Paulo Martins', true, false], ['Vinícius', true, false]]);
});
