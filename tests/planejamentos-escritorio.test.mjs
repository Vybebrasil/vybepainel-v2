// A migração dos planejamentos também abre a camada "operacao" (Centro de
// Operação) nas tabelas do Escritório, sem mexer no que já está salvo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bancoEscritorio} from './escritorio-esquema.mjs';

test('migração dos planejamentos aceita a camada do Centro de Operação no mapa, nas versões e nos post-its',async t=>{
 const {db,sql}=await bancoEscritorio(t);
 for(const f of ['2026-10-17-escritorio-mapa-versoes.sql','2026-10-17-escritorio-imagens.sql','2026-10-17-escritorio-andares.sql','2026-10-18-escritorio-cenas-editaveis.sql','2026-10-18-escritorio-postits-presentes.sql'])
  await db.exec(readFileSync('migrations/'+f,'utf8'));
 await db.exec(`INSERT INTO vybe_escritorio_mapa(camada,itens) VALUES('lounge','[]')`);
 await assert.rejects(db.exec(`INSERT INTO vybe_escritorio_mapa(camada,itens) VALUES('operacao','[]')`));
 await db.exec(`ALTER TABLE vybe_clientes ADD COLUMN email text`);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await db.exec(`INSERT INTO vybe_escritorio_mapa(camada,itens) VALUES('operacao','[]')`);
 await db.exec(`INSERT INTO vybe_escritorio_postits(camada,lado,posicao,cor,texto,pessoa_id) VALUES('operacao',0,3,'amarelo','Revisar Serra Grande',1)`);
 await assert.rejects(db.exec(`INSERT INTO vybe_escritorio_mapa(camada,itens) VALUES('operacaox','[]')`));
 const camadas=(await sql`SELECT camada FROM vybe_escritorio_mapa ORDER BY camada`).map(r=>r.camada);
 assert.ok(camadas.includes('lounge')&&camadas.includes('operacao'));
});
