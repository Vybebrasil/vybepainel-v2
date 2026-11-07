import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const fonte=readFileSync('vybe-mundo.js','utf8');
function tela({falhar=false,pode=true}={}) {
 const legado=JSON.stringify([{nome:'Legado',setorEmpresa:'Saúde'}]); const armazenamento=new Map([['vybe.crm.propostas',legado]]), posts=[];
 const contexto=vm.createContext({localStorage:{getItem:k=>armazenamento.get(k) ?? null,setItem:(k,v)=>armazenamento.set(k,v)},hud:{addEventListener(){}},
  fetch:async(url,op)=>{if(op.method==='POST'){posts.push(JSON.parse(op.body));if(falhar)return {ok:false,json:async()=>({error:'Migração pendente'})};}return {ok:true,json:async()=>({ok:true,pode_editar:pode,pessoa_id:'1',oportunidades:[]})};}});
 vm.runInContext(fonte.slice(fonte.indexOf("  const CRM_CHAVE ="),fonte.indexOf('  const anosDe ='))+';this.importar=crmImportar;',contexto);
 return {armazenamento,posts,legado,importar:()=>contexto.importar({pode_editar:pode,pessoa_id:'1'})};
}
test('primeira abertura importa uma vez por conta/conteúdo e preserva a cópia local',async()=>{
 const h=tela();await h.importar();await h.importar();assert.equal(h.posts.length,1);assert.equal(h.posts[0].acao,'importar');assert.equal(h.armazenamento.get('vybe.crm.propostas'),h.legado);assert.equal(h.armazenamento.get('vybe.crm.propostas.importado:1'),h.legado);
});
test('falha na importação ou conta sem permissão não marca como importado nem apaga propostas',async()=>{
 const h=tela({falhar:true});await assert.rejects(h.importar(),/Migração pendente/);assert.equal(h.armazenamento.has('vybe.crm.propostas.importado:1'),false);assert.equal(h.armazenamento.get('vybe.crm.propostas'),h.legado);
 const leitor=tela({pode:false});await leitor.importar();assert.equal(leitor.posts.length,0);assert.equal(leitor.armazenamento.has('vybe.crm.propostas.importado:1'),false);
});
