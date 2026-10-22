// Recado global do Escritório: só quem está na lista de autores manda (pela
// sessão, não pelo nome), o mesmo clique não manda duas vezes, todos recebem
// (inclusive quem mandou) e cada um vê cada recado uma vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';

test('recado global: autores, idempotência, cada um vê uma vez e o que expirou some',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,pode_entrar boolean DEFAULT true);
 INSERT INTO vybe_pessoas(id,nome) VALUES(1,'Paulo'),(3,'Vinícius'),(7,'Beatriz');`);
 const {mandarAviso,avisosDaPessoa,responderAviso}=await import('../server/escritorio-avisos.js');
 // Sem a migração: não quebra a entrada nem finge que mandou.
 assert.deepEqual(await avisosDaPessoa(sql,7),{avisos:[],pode:false});
 await assert.rejects(mandarAviso(sql,{id:1},{titulo:'Oi',texto:'Teste'}),/instalado/);
 await db.exec(readFileSync('migrations/2026-10-22-escritorio-avisos.sql','utf8'));
 await sql`INSERT INTO vybe_escritorio_avisos_autores(pessoa_id) VALUES(1),(3)`;
 await assert.rejects(mandarAviso(sql,{id:7},{titulo:'Recado',texto:'Não posso'}),e=>e.status===403);
 await assert.rejects(mandarAviso(sql,{id:1},{titulo:'Oi',texto:'Curto'}),/título/);
 await assert.rejects(mandarAviso(sql,{id:1},{titulo:'Recado bom',texto:'Texto',destino:'javascript:'}),/Destino/);
 const corpo={titulo:'Chegou emenda de Bacelar!',texto:'Quartos até 24 × 24.',destino:'reforma',estilo:'obra',chave:'aviso-abc12345'};
 const a=await mandarAviso(sql,{id:1},corpo), b=await mandarAviso(sql,{id:1},corpo);
 assert.equal(a.id,b.id,'o mesmo clique não manda dois recados');
 // Todos recebem, inclusive quem mandou; quem pode mandar fica marcado.
 const bia=await avisosDaPessoa(sql,7), paulo=await avisosDaPessoa(sql,1);
 assert.equal(bia.avisos.length,1);assert.equal(bia.pode,false);assert.equal(paulo.avisos.length,1);assert.equal(paulo.pode,true);
 assert.deepEqual({...bia.avisos[0],criado_em:undefined},{id:a.id,titulo:corpo.titulo,texto:corpo.texto,destino:'reforma',estilo:'obra',criado_em:undefined,autor:{id:'1',nome:'Paulo'}});
 await responderAviso(sql,7,{id:a.id,resposta:'conferiu'});
 await responderAviso(sql,7,{id:a.id,resposta:'ignorou'});
 assert.equal((await avisosDaPessoa(sql,7)).avisos.length,0,'quem respondeu não vê de novo');
 assert.equal((await sql`SELECT acao FROM vybe_escritorio_avisos_vistos WHERE pessoa_id=7`)[0].acao,'conferiu','a primeira resposta vale');
 await assert.rejects(responderAviso(sql,7,{id:a.id,resposta:'apagar'}),/Resposta/);
 // Recado vencido não aparece mais.
 await sql`UPDATE vybe_escritorio_avisos SET expira_em=NOW()-INTERVAL '1 minute'`;
 assert.equal((await avisosDaPessoa(sql,1)).avisos.length,0);
});
