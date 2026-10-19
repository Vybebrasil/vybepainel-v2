// Troca de móveis entre colegas (como no Habbo): só unidades guardadas, quem
// recebeu aceita ou recusa, quem propôs cancela, e a aceitação confere de novo
// e troca tudo numa transação, uma vez só.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';

test('troca: guarda, aceita uma vez, recusa, cancela e confere de novo na aceitação',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,pode_entrar boolean DEFAULT true);
 INSERT INTO vybe_pessoas(id,nome) VALUES(1,'Paulo'),(3,'Vinícius'),(9,'Saiu');UPDATE vybe_pessoas SET ativo=false WHERE id=9;
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,status_chave text);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
 CREATE TABLE vybe_conteudo_eventos(id bigserial PRIMARY KEY,conteudo_id bigint,tipo text,para text);`);
 for(const f of ['2026-10-15-escritorio.sql','2026-10-16-escritorio-mapa.sql','2026-10-17-escritorio-vybecoins.sql','2026-10-18-escritorio-postits-presentes.sql']) await db.exec(readFileSync('migrations/'+f,'utf8'));
 const {proporTroca,responderTroca,listarTrocas}=await import('../server/escritorio-social.js');
 await assert.rejects(proporTroca(sql,{id:1},[],{para:'3',oferece:[['shelves_norja',1]],pede:[],chave:'troca-0001'}),/migração/);
 await db.exec(readFileSync('migrations/2026-10-19-escritorio-trocas.sql','utf8'));
 const {salasDoEscritorio}=await import('../server/escritorio-mapa.js');
 const salas=salasDoEscritorio([{id:1,nome:'Paulo'},{id:3,nome:'Vinícius'}]);
 const salaPaulo=salas.find(s=>s.pessoa_id==='1').id;
 await sql`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(1,0),(3,0)`;
 await sql`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(1,'shelves_norja',2),(3,'pura_mdl1',1)`;
 await sql`INSERT INTO vybe_escritorio_mapa(camada,itens,versao) VALUES(${salaPaulo},${JSON.stringify([['shelves_norja',1,1,2,0,0]])}::jsonb,1)`;
 const inv=async(p)=>Object.fromEntries((await sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} ORDER BY classe`).map(i=>[i.classe,Number(i.quantidade)]));
 // Uma estante está no quarto: só a outra unidade entra na troca.
 await assert.rejects(proporTroca(sql,{id:1},salas,{para:'3',oferece:[['shelves_norja',2]],pede:[['pura_mdl1',1]],chave:'troca-0001'}),/Guarde/);
 await assert.rejects(proporTroca(sql,{id:1},salas,{para:'3',oferece:[['shelves_norja',1]],pede:[['pura_mdl1',2]],chave:'troca-0001'}),/não tem esses móveis/);
 await assert.rejects(proporTroca(sql,{id:1},salas,{para:'1',oferece:[['shelves_norja',1]],pede:[],chave:'troca-0001'}),/outra pessoa/);
 await assert.rejects(proporTroca(sql,{id:1},salas,{para:'9',oferece:[['shelves_norja',1]],pede:[],chave:'troca-0001'}),/não está na equipe/);
 await assert.rejects(proporTroca(sql,{id:1},salas,{para:'3',oferece:[['exe_table',1]],pede:[],chave:'troca-0001'}),/não se troca/);
 const p=await proporTroca(sql,{id:1},salas,{para:'3',oferece:[['shelves_norja',1]],pede:[['pura_mdl1',1]],chave:'troca-0001'});
 assert.equal((await proporTroca(sql,{id:1},salas,{para:'3',oferece:[['shelves_norja',1]],pede:[['pura_mdl1',1]],chave:'troca-0001'})).repetido,true,'repetir o pedido não cria outra');
 assert.equal((await listarTrocas(sql,{id:3})).recebidas.length,1);
 await assert.rejects(responderTroca(sql,{id:1},salas,{id:p.id,acao:'aceitar'}),/Só quem recebeu/);
 const r=await responderTroca(sql,{id:3},salas,{id:p.id,acao:'aceitar'});
 assert.equal(r.estado,'aceita');
 assert.deepEqual(await inv(1),{pura_mdl1:1,shelves_norja:1});
 assert.deepEqual(await inv(3),{shelves_norja:1});
 assert.equal((await responderTroca(sql,{id:3},salas,{id:p.id,acao:'aceitar'})).repetido,true,'aceitar de novo não troca de novo');
 assert.deepEqual(await inv(3),{shelves_norja:1});
 // Proposta que deixou de valer: a pessoa colocou o móvel no quarto antes de aceitarem.
 const q=await proporTroca(sql,{id:3},salas,{para:'1',oferece:[['shelves_norja',1]],pede:[],chave:'troca-0002'});
 const salaVini=salas.find(s=>s.pessoa_id==='3').id;
 await sql`INSERT INTO vybe_escritorio_mapa(camada,itens,versao) VALUES(${salaVini},${JSON.stringify([['shelves_norja',2,2,2,0,0]])}::jsonb,1)`;
 await assert.rejects(responderTroca(sql,{id:1},salas,{id:q.id,acao:'aceitar'}),/não tem esses móveis/);
 assert.deepEqual(await inv(3),{shelves_norja:1},'nada mudou');
 assert.equal((await responderTroca(sql,{id:1},salas,{id:q.id,acao:'recusar'})).estado,'recusada');
 const c=await proporTroca(sql,{id:1},salas,{para:'3',oferece:[['pura_mdl1',1]],pede:[],chave:'troca-0003'});
 await assert.rejects(responderTroca(sql,{id:3},salas,{id:c.id,acao:'cancelar'}),/só quem propôs/);
 assert.equal((await responderTroca(sql,{id:1},salas,{id:c.id,acao:'cancelar'})).estado,'cancelada');
});
