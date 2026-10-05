import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {resolverBriefing} from '../server/briefing.js';
const nota = {corpo:`<p>BRIEFING</p><p>${'Objetivo e roteiro da campanha. '.repeat(8)}</p>`,criado_em:'2026-08-28',autor:'Paulo'};
test('briefing histórico e campo explícito têm uma leitura; remoção não ressuscita nota',()=>{
 assert.equal(resolverBriefing({historico_briefing:[nota]}).origem,'histórico');
 assert.equal(resolverBriefing({briefing:'Briefing curto válido',historico_briefing:[nota]}).texto,'Briefing curto válido');
 assert.equal(resolverBriefing({briefing_definido:true,historico_briefing:[nota]}),null);
 assert.equal(resolverBriefing({historico_briefing:[{...nota,corpo:'[Vybe OS · Passagem de bastão] '+nota.corpo}]}),null);
 assert.equal(resolverBriefing({historico_briefing:[{corpo:'ROTEIRO curto sem contexto'}]}),null);
});
test('indicador distingue briefing presente, ausente e ainda desconhecido',()=>{
 const source=fs.readFileSync('vybe-briefing.js','utf8');
 const c=vm.createContext({safeText:String,ICONE_LINHA:{briefing:'icone'}});
 vm.runInContext(source.slice(source.indexOf('function briefingDaPeca'),source.indexOf('// Titulo de secao')),c);
 assert.match(c.botaoDeBriefingHtml({id:'1',tem_briefing:false}),/Sem briefing/);
 assert.match(c.botaoDeBriefingHtml({id:'1',tem_briefing:true},true),/Ver briefing/);
 assert.match(c.botaoDeBriefingHtml({id:'1'}),/Consultar briefing/);
 assert.equal(c.briefingDaPeca({briefing:'',updates:[nota]}),null);
});
test('salvar briefing atualiza indicador somente após confirmação da API',async()=>{
 const source=fs.readFileSync('vybe-briefing.js','utf8');const item={id:'1',tem_briefing:false};
 const c=vm.createContext({DADOS:[item],DADOS_ALL:[],DADOS_DEMANDAS:[],DETALHE_DA_GAVETA:{id:'1'},fetch:async()=>({ok:false,json:async()=>({error:'recusado'})})});
 vm.runInContext(source.slice(source.indexOf('async function gravarBriefing'),source.indexOf('// A gaveta aberta')),c);
 await assert.rejects(c.gravarBriefing('1','novo'));assert.equal(item.tem_briefing,false);
 c.fetch=async()=>({ok:true,json:async()=>({ok:true,briefing:'novo'})});await c.gravarBriefing('1','novo');assert.equal(item.tem_briefing,true);
 c.fetch=async()=>({ok:true,json:async()=>({ok:true,briefing:''})});await c.gravarBriefing('1','');assert.equal(item.tem_briefing,false);
});
