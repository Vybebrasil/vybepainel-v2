import {resolverBriefing,MARCAS_BRIEFING} from '../server/briefing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {database} from './postgres.mjs';
import {resolverMaterialBruto} from '../server/material-bruto.js';
import {guardarMaterialBruto} from '../api/conteudo.js';
const fonte=fs.readFileSync('vybe-material.js','utf8');
const link='https://drive.google.com/drive/u/0/folders/pasta-local';
function contexto(){
 const a={id:'vybe:1',material_bruto:''},b={...a},d={id:'vybe:2',material_bruto:'outro'};
 const avisos=[],renders=[];
 const c=vm.createContext({DADOS:[a],DADOS_ALL:[b],DADOS_DEMANDAS:[d],DETALHE_DA_GAVETA:{id:a.id},document:{getElementById:()=>null},BRIEFING_ABERTO:null,
 findOperationalItem:()=>({...b}),saveProductionCache(){},fetch:async()=>({ok:true,json:async()=>({ok:true,para:link})}),
 perguntarNoPainel:async()=>link,showToast:(...x)=>avisos.push(x),renderOutboundItemPatch:()=>renders.push('painel'),atualizarGavetaPreservandoRascunhos:async()=>{},activeWorkspaceItemId:'',});
 vm.runInContext(fonte.slice(fonte.indexOf('async function gravarMaterialBruto'),fonte.indexOf('// Clicar no botao do cartao')),c);
 return {c,a,b,d,avisos,renders};
}
test('link salvo atualiza fontes reais mesmo quando a busca devolve cópia',async()=>{
 const {c,a,b,d,renders}=contexto();await c.pedirMaterialBruto(a.id);
 assert.equal(a.material_bruto,link);assert.equal(b.material_bruto,link);assert.equal(d.material_bruto,'outro');assert.equal(c.DETALHE_DA_GAVETA.material_bruto,link);assert.deepEqual(renders,['painel']);
 c.fetch=async()=>({ok:true,json:async()=>({ok:true,para:''})});await c.gravarMaterialBruto(a.id,'');assert.equal(b.material_bruto,'');
});
test('erro não altera link; falha depois da confirmação avisa que já salvou',async()=>{
 const {c,a,b,avisos}=contexto();c.fetch=async()=>({ok:false,json:async()=>({error:'recusado'})});await c.pedirMaterialBruto(a.id);assert.equal(b.material_bruto,'');assert.equal(avisos.at(-1)[1],'err');
 c.fetch=async()=>({ok:true,json:async()=>({ok:true,para:link})});c.atualizarGavetaPreservandoRascunhos=async()=>{throw Error('offline');};await c.pedirMaterialBruto(a.id);assert.equal(b.material_bruto,link);assert.match(avisos.at(-1)[0],/Link salvo/);assert.equal(avisos.at(-1)[1],'info');
});
test('material e histórico são atômicos; releitura do endpoint inclui link persistido',async()=>{
 const {db,sql}=await database();try{
 await db.exec('ALTER TABLE vybe_conteudos ADD COLUMN titulo text, ADD COLUMN material_bruto text, ADD COLUMN material_bruto_em timestamptz');
 await db.exec("ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT recusa CHECK(tipo <> 'material_bruto')");
 await assert.rejects(guardarMaterialBruto(sql,null,{item:'vybe:1',link}));assert.equal((await sql`SELECT material_bruto FROM vybe_conteudos`)[0].material_bruto,null);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT recusa');
 await guardarMaterialBruto(sql,null,{item:'vybe:1',link});
 // Executa o serializador real do endpoint; consultas não relacionadas à pasta retornam vazias.
 const source=fs.readFileSync('api/painel.js','utf8');
 const c=vm.createContext({resolverBriefing,MARCAS_BRIEFING,resolverMaterialBruto,BOARD_DEMANDAS:8385559107,COLUNA_ARQUIVOS:'files',garantirColunaDePrevia:async()=>{},garantirMaterialBruto:async()=>{},garantirColunasDeUpdate:async()=>{},
 sql:()=>async(parts)=>parts.join('').includes('SELECT c.id, c.titulo')?await sql`SELECT * FROM vybe_conteudos WHERE id=1`:[]});
 vm.runInContext(source.slice(source.indexOf('async function areaPeca'),source.indexOf('async function removerArquivoDaPeca')),c);
 let resposta;const res={status(){return this;},json(d){resposta=d;}};
 await c.areaPeca({method:'GET',query:{item:'vybe:1'}},res,{tipo:'servico'});
 assert.equal(resposta.material_bruto,link);assert.ok(resposta.material_bruto_em);
 await guardarMaterialBruto(sql,null,{item:'vybe:1',link:''});
 await c.areaPeca({method:'GET',query:{item:'vybe:1'}},res,{tipo:'servico'});
 assert.equal(resposta.material_bruto,'');assert.equal(resposta.material_bruto_em,null);
 }finally{await db.close();}
});

test('resgate histórico exclui entrega e respeita campo explícito ou remoção',()=>{
 const notas=[{id:1,corpo:`<p><a href="${link}">${link}</a></p>`,criado_em:'2026-08-28'},
 {id:2,corpo:'[Vybe OS · Link de entrega] https://drive.google.com/file/d/final',criado_em:'2026-10-05'}];
 assert.equal(resolverMaterialBruto({historico_bruto:notas}).url,link);
 assert.equal(resolverMaterialBruto({material_bruto:'https://example.com/bruto',historico_bruto:notas}).origem,'campo');
 assert.equal(resolverMaterialBruto({material_bruto_definido:true,historico_bruto:notas}),null);
 assert.equal(resolverMaterialBruto({historico_bruto:[notas[1]]}),null);
 assert.equal(resolverMaterialBruto({historico_bruto:[{corpo:`${'recado '.repeat(20)} ${link}`}]}),null);
});
