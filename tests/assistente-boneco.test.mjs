import test from 'node:test';import assert from 'node:assert/strict';
import {conexao} from './postgres.mjs';import {executarFerramenta} from '../server/assistente-ferramentas.js';import {figuraDoPerfil} from '../server/escritorio-figura.js';
// O VYBES mostra o bonequinho de cada pessoa: listar_responsaveis leva a figura do Escritório, e só ela.
test('listar_responsaveis leva a figura do boneco do Escritório, sem o resto das preferências',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,papel text,disciplina text,ativo boolean,pode_entrar boolean);
  INSERT INTO vybe_pessoas VALUES(1,'Pessoa A','Criação','Design',true,true),(2,'Pessoa B','Atendimento','Estratégia',true,true),(3,'Pessoa C','Criação','Vídeo',true,true);`);
 let r=await executarFerramenta(sql,'listar_responsaveis',{});
 assert.equal(r.itens.length,3);assert.ok(r.itens.every(p=>!('figura' in p)),'sem a tabela do Escritório, nada de figura');
 await db.exec(`CREATE TABLE vybe_escritorio_perfis(pessoa_id bigint PRIMARY KEY,preferencias jsonb);
  INSERT INTO vybe_escritorio_perfis VALUES(1,'{"figura":"hd-180-1.ch-255-82.hr-828-61","segredo":"NAO_EXPOR"}'),(2,'{"pele":"escura","roupa":"verde","cabelo":"longo"}'),(3,'{"figura":"hd-3095-1.ch-3030-1408-110.lg-3023-110"}');`);
 r=await executarFerramenta(sql,'listar_responsaveis',{});
 const por=Object.fromEntries(r.itens.map(p=>[p.nome,p.figura]));
 assert.equal(por['Pessoa A'],'hd-180-1.ch-255-82.hr-828-61');
 assert.equal(por['Pessoa B'],'hd-600-14.ch-665-1335.lg-700-82.sh-725-62.hr-515-45');
 // Figura com números longos ("ch-3030-1408-110") não pode virar "[número omitido]" no filtro de telefone.
 assert.equal(por['Pessoa C'],'hd-3095-1.ch-3030-1408-110.lg-3023-110');
 assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));assert.ok(!JSON.stringify(r).includes('preferencias'));
});
test('figura colada inválida cai nas escolhas do perfil; quem nunca montou fica com o padrão',()=>{
 assert.equal(figuraDoPerfil({}),'hd-180-8.ch-255-1408.lg-280-110.sh-305-62.hr-828-61');
 assert.equal(figuraDoPerfil({figura:'<script>',roupa:'azul'}),'hd-180-8.ch-255-82.lg-280-110.sh-305-62.hr-828-61');
 assert.equal(figuraDoPerfil('{"cabelo":"sem"}'),'hd-180-8.ch-255-1408.lg-280-110.sh-305-62');
 assert.equal(figuraDoPerfil(null),'hd-180-8.ch-255-1408.lg-280-110.sh-305-62.hr-828-61');
});

// O VYBES mostra em que grupo do quadro cada demanda está (Redação, Design & Edição…).
test('buscar_demandas leva o grupo do quadro: da lista de partida sem a tabela, da tabela quando ela existe',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,papel text,disciplina text,ativo boolean,pode_entrar boolean);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean,responsavel text); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,titulo text,formato text,prazo date,veiculacao date,atualizado_em timestamptz,status_chave text,board_id bigint,removido_em timestamptz,briefing text,monday_item_id bigint,grupo_id text);
  INSERT INTO vybe_conteudos VALUES(100,'Card - A','Card','2026-11-04','2026-11-05',now(),'pode',7829537690,NULL,'',NULL,'novo_grupo__1'),(200,'Reels - B','Reels','2026-11-04','2026-11-06',now(),'pode',7829537690,NULL,'',NULL,'grupo_sumiu');
  CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);INSERT INTO vybe_status VALUES(7829537690,'pode','Pode Fazer',false);`);
 let r=await executarFerramenta(sql,'buscar_demandas',{});
 assert.equal(r.itens.length,2);
 // Sem a tabela (Production hoje): os nomes da lista de partida do painel.
 assert.equal(r.itens.find(i=>i.titulo==='Card - A').grupo,'Design & Edição');assert.equal(r.itens.find(i=>i.titulo==='Reels - B').grupo,undefined,'grupo que não existe fica sem nome');
 await db.exec(`CREATE TABLE vybe_grupos(board_id bigint,grupo_id text,titulo text,cor text,ordem int);INSERT INTO vybe_grupos VALUES(7829537690,'novo_grupo__1','Design e Edição (renomeado)','#9d50dd',3);`);
 r=await executarFerramenta(sql,'buscar_demandas',{});
 const por=Object.fromEntries(r.itens.map(i=>[i.titulo,i.grupo]));
 assert.equal(por['Card - A'],'Design e Edição (renomeado)','com a tabela, vale o nome dela');assert.equal(por['Reels - B'],undefined);
});
