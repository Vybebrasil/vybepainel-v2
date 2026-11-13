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
 await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
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

// Paulo, 13/11/2026: a captação escolhida no cadastro se perdia (gravava só o texto). Agora grava a chave do catálogo,
// que é o que a fila de captações e o painel leem; vale a chave ou o rótulo. Sem opção que case, fica só o texto.
test('cadastro grava a chave da captação escolhida (rótulo ou chave), como a troca de escolha',async()=>{
 const {db,sql}=conexao();
 try {
 await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int);
 CREATE TABLE vybe_conteudos(id bigserial PRIMARY KEY,board_id bigint,titulo text,formato text,clientes_texto text,status_chave text,etapa text,grupo_id text,prazo date,veiculacao date,briefing text,prioridade text,status_em timestamptz,captacao text,captacao_chave text);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint REFERENCES vybe_conteudos,cliente_id bigint REFERENCES vybe_clientes,PRIMARY KEY(conteudo_id,cliente_id));
 CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text);
 CREATE TABLE vybe_captacao(chave text PRIMARY KEY,rotulo text,monday_index int);
 INSERT INTO vybe_captacao VALUES('agendar_captacao','Agendar Captação',1),('captacao_feita','Captação Feita',2);
 INSERT INTO vybe_clientes VALUES(1,'A',true);
 INSERT INTO vybe_status VALUES(7829537690,'a_fazer','A Fazer',0),(8385559107,'a_fazer','A Fazer',0);`);
 const ler=async(id)=>({...(await sql`SELECT captacao,captacao_chave FROM vybe_conteudos WHERE id=${id}`)[0]});
 const r1=await criarConteudo(sql,{tipo:'servico'},{board:7829537690,titulo:'Reels',clientes:['A'],captacao:'Agendar Captação'});
 assert.deepEqual(await ler(r1.conteudo_id),{captacao:'Agendar Captação',captacao_chave:'agendar_captacao'},'pelo rótulo');
 const r2=await criarConteudo(sql,{tipo:'servico'},{board:7829537690,titulo:'Foto',clientes:['A'],captacao:'captacao_feita'});
 assert.deepEqual(await ler(r2.conteudo_id),{captacao:'Captação Feita',captacao_chave:'captacao_feita'},'pela chave');
 const r3=await criarConteudo(sql,{tipo:'servico'},{board:7829537690,titulo:'Outro',clientes:['A'],captacao:'Inexistente'});
 assert.deepEqual(await ler(r3.conteudo_id),{captacao:'Inexistente',captacao_chave:null},'sem opção: só o texto');
 const r4=await criarConteudo(sql,{tipo:'servico'},{board:8385559107,titulo:'Demanda',clientes:['A'],captacao:'Agendar Captação'});
 assert.equal((await ler(r4.conteudo_id)).captacao_chave,null,'Solicitações não têm captação');
 }finally{await db.close();}
});
