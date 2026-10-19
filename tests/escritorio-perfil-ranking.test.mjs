import test from 'node:test';
import assert from 'node:assert/strict';
import {conexao} from './postgres.mjs';
import {perfilPublico,rankingEscritorio} from '../server/escritorio-economia.js';

// Perfil e ranking do jogo abertos à equipe (decisão do Paulo, 19/10/2026):
// moedas, nível, conquistas e móveis; sem o extrato do razão.
test('perfil público e ranking mostram moedas, nível, conquistas e móveis de cada pessoa',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_escritorio_carteiras(pessoa_id bigint PRIMARY KEY,saldo int NOT NULL DEFAULT 0,xp int NOT NULL DEFAULT 0);
 CREATE TABLE vybe_escritorio_inventario(pessoa_id bigint,classe text,quantidade int,PRIMARY KEY(pessoa_id,classe));
 CREATE TABLE vybe_escritorio_moedas(id bigserial,pessoa_id bigint,origem text,quantidade int,pontos int DEFAULT 0,criado_em timestamptz DEFAULT now(),UNIQUE(pessoa_id,origem));
 INSERT INTO vybe_escritorio_carteiras VALUES(1,172,260),(2,40,30);
 INSERT INTO vybe_escritorio_inventario VALUES(1,'exe_table',1),(1,'plant_small_cactus',2),(2,'mm_lamp',1);
 INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos) VALUES(1,'conquista:a',50,50),(1,'conquista:b',50,50),(1,'compra:x:mm_lamp',-25,0),(2,'conquista:a',50,50);`);
 const p=await perfilPublico(sql,1);
 assert.equal(p.saldo,172);assert.equal(p.conquistas,2);assert.equal(p.xpTotal,260);assert.ok(p.nivel>1);
 assert.deepEqual(p.inventario.map(i=>[i.classe,i.quantidade]),[['plant_small_cactus',2],['exe_table',1]]);
 assert.equal(p.extrato,undefined,'sem extrato do razão no perfil público');
 const r=await rankingEscritorio(sql);
 const um=r.pessoas.find(x=>x.pessoa==='1'),dois=r.pessoas.find(x=>x.pessoa==='2');
 assert.deepEqual([um.saldo,um.moveis,um.conquistas,um.xpTotal],[172,3,2,260]);
 assert.deepEqual([dois.saldo,dois.moveis,dois.conquistas],[40,1,1]);
 assert.equal((await perfilPublico(sql,99)).saldo,0,'quem ainda não tem carteira aparece com zero');
});
