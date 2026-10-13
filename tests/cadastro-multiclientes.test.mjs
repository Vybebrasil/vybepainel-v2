import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { criarConteudo } from '../api/conteudo.js';

test('seleção soma e remove clientes sem avançar nem perder o filtro',()=>{
 const state={client:'A',clients:['A']}, campo={value:'busca'};
 const c=vm.createContext({state,window:{},fcEnviando:false,fcDesenharPasso(){},fcFiltrar(){},document:{getElementById:()=>campo,querySelectorAll:()=>[]}});
 const s=fs.readFileSync('cadastros_governed_v2.js','utf8');
 vm.runInContext(s.slice(s.indexOf('  window.fcAlternarCliente ='),s.indexOf('  window.fcResponder =')),c);
 c.window.fcAlternarCliente('B');assert.deepEqual([...state.clients],['A','B']);
 c.window.fcAlternarCliente('A');assert.deepEqual([...state.clients],['B']);assert.equal(state.client,'B');
 c.window.fcAlternarCliente('B');assert.equal(state.client,'');assert.equal(campo.value,'busca');
});

test('criação nos dois quadros persiste todos os clientes uma vez e reverte falhas',async()=>{
 const {db,sql}=conexao();
 try {
 await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int);
 CREATE TABLE vybe_conteudos(id bigserial PRIMARY KEY,board_id bigint,titulo text,formato text,clientes_texto text,status_chave text,etapa text,grupo_id text,prazo date,veiculacao date,briefing text,prioridade text,status_em timestamptz);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint REFERENCES vybe_conteudos,cliente_id bigint REFERENCES vybe_clientes,PRIMARY KEY(conteudo_id,cliente_id));
 CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text);
 INSERT INTO vybe_clientes VALUES(1,'A',true),(2,'B',true),(3,'Inativo',false);
 INSERT INTO vybe_status VALUES(7829537690,'a_fazer','A Fazer',0),(8385559107,'a_fazer','A Fazer',0);`);
 for(const board of [7829537690,8385559107]) {
 const r=await criarConteudo(sql,{tipo:'servico'},{board,titulo:'Peça',clientes:['A','B','a']});
 assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_conteudo_clientes WHERE conteudo_id=${r.conteudo_id}`)[0].n,2);
 assert.equal((await sql`SELECT clientes_texto FROM vybe_conteudos WHERE id=${r.conteudo_id}`)[0].clientes_texto,'A, B');
 }
 for(const clientes of [[],['A','Inativo'],['A','ausente'],['A',null]]) await assert.rejects(criarConteudo(sql,{tipo:'servico'},{titulo:'Inválido',clientes}));
 await db.exec(`ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK (para <> 'Falha');`);
 await assert.rejects(criarConteudo(sql,{tipo:'servico'},{titulo:'Falha',clientes:['A','B']}));
 assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_conteudos`)[0].n,2);
 assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_conteudo_clientes`)[0].n,4);
 const r=await criarConteudo(sql,{tipo:'servico'},{titulo:'Legado',cliente:'A'});
 assert.equal(r.cliente,'A');
 }finally{await db.close();}
});
