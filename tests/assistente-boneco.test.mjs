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
