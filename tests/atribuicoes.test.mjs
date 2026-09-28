import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { database } from './postgres.mjs';
import { substituirResponsaveis } from '../server/responsaveis.js';
import { criarTabelaDeGrupos, moverAtividadeParaGrupo, BOARD_PRODUCAO } from '../server/grupos.js';

for (const catalogo of [true, false]) test(`grupo e histórico revertem juntos; catálogo ${catalogo}`, async () => {
 const {db,sql}=await database();
 try {
  await db.exec("ALTER TABLE vybe_conteudos ADD COLUMN grupo_id text, ADD COLUMN etapa text; UPDATE vybe_conteudos SET grupo_id='group_title',etapa='Redação'; CREATE TABLE vybe_conteudo_clientes(conteudo_id int,cliente_id int); INSERT INTO vybe_conteudo_clientes VALUES(1,10),(1,20)");
  if(catalogo) await criarTabelaDeGrupos(sql);
  await db.exec("ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT recusa CHECK(tipo <> 'grupo')");
  const args={id:1,board:BOARD_PRODUCAO,grupo:'novo_grupo__1',autorId:2};
  await assert.rejects(moverAtividadeParaGrupo(sql,args),/recusa/);
  assert.equal((await sql`SELECT grupo_id FROM vybe_conteudos`)[0].grupo_id,'group_title');
  await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT recusa');
  const [r]=await moverAtividadeParaGrupo(sql,args);
  assert.equal(r.de,'Redação');assert.equal(r.etapa,'Design & Edição');
  assert.deepEqual(await sql`SELECT de,para,autor_id FROM vybe_conteudo_eventos`,[{de:'Redação',para:'Design & Edição',autor_id:2}]);
  await assert.rejects(moverAtividadeParaGrupo(sql,{...args,grupo:'inexistente'}));
  assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
  assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
  assert.equal((await sql`SELECT * FROM vybe_conteudo_responsaveis`).length,1);
 } finally {await db.close();}
});

test('responsáveis aceitam várias pessoas sem duplicar, rejeitam inválidos e removem explicitamente',async()=>{
 const {db,sql}=await database();try {
  const r=await substituirResponsaveis(sql,{conteudoId:1,pessoas:['200','100','200'],autorId:2});
  assert.deepEqual(r.ids,['200','100']);
  assert.deepEqual(await sql`SELECT pessoa_id,ordem FROM vybe_conteudo_responsaveis ORDER BY ordem`,[{pessoa_id:2,ordem:0},{pessoa_id:1,ordem:1}]);
  for(const pessoas of [undefined,'200',['x'],['999']]) await assert.rejects(substituirResponsaveis(sql,{conteudoId:1,pessoas}));
  await sql`UPDATE vybe_pessoas SET ativo=false WHERE id=2`;
  await assert.rejects(substituirResponsaveis(sql,{conteudoId:1,pessoas:['200']}),/inativos/);
  assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
  await substituirResponsaveis(sql,{conteudoId:1,pessoas:[],autorId:2});
  assert.equal((await sql`SELECT * FROM vybe_conteudo_responsaveis`).length,0);
  assert.equal((await sql`SELECT para FROM vybe_conteudo_eventos WHERE para='sem responsável'`).length,1);
 }finally{await db.close();}
});

function contexto(){
 const item={id:'vybe:1',group_id:'antigo',grupo:'Antes',responsavel_ids:['100'],clientes:['A','B']};
 const avisos=[],renders=[],escritas=[];
 const elements={'workspace-drawer':{},'owner-editor-save':{},'workspace-comment-input':{value:'rascunho'},'workspace-link-input':{value:'link'}};
 const c=vm.createContext({Set,Date,console,document:{getElementById:id=>elements[id]},DADOS:[item],DADOS_ALL:[item],DADOS_DEMANDAS:[item],activeWorkspaceItemId:item.id,activeBoard:'demandas',pendingOwnerEditorItemId:item.id,
 donoSelecionados:new Set(['200']),TEAM_USERS:[{id:'100',name:'A'},{id:'200',name:'B'}],ownerEligibility:()=>({users:[],label:'Design'}),ownerUsersFor:()=>[],firstName:s=>s,
 showToast:(...a)=>avisos.push(a),findOperationalItem:()=>item,fecharSeletorDeGrupo(){},tituloDoGrupo:id=>id,armOutboundMutationGuard(){},closeOwnerEditor(){},
 tentarEscritaDupla:async(i,op)=>{escritas.push(op);return {para:'Nome do banco'};},postItemUpdate:async()=>{},
 updateLocalOwners:(_id,ids)=>{item.responsavel_ids=ids;},renderIntegratedOperationalViews:()=>renders.push('integradas'),renderVisaoDeGrupos:()=>renders.push('grupos'),renderDemandas:()=>renders.push('demandas'),
 saveProductionCache(){}, renderOutboundItemPatch:()=>{renders.push('integradas','grupos','demandas');},
 fetchWorkspaceItem:async()=>({}),renderWorkspaceDrawer:()=>{renders.push('gaveta');elements['workspace-comment-input']={value:''};elements['workspace-link-input']={value:''};}});
 const agenda=fs.readFileSync('vybe-agenda.js','utf8'),gestor=fs.readFileSync('vybe-gestor.js','utf8');
 vm.runInContext(agenda.slice(agenda.indexOf('const gruposEmGravacao'),agenda.indexOf('// Mover de grupo em lote')),c);
 vm.runInContext(agenda.slice(agenda.indexOf('async function moverPecaDeGrupo'),agenda.indexOf('// ─── Grupos e calendário')),c);
 vm.runInContext(gestor.slice(gestor.indexOf('const responsaveisEmGravacao'),gestor.indexOf('// EDITAR UMA LINHA')),c);
 vm.runInContext(gestor.slice(gestor.indexOf('async function saveOwnerAssignments'),gestor.indexOf('const DESIGN_TEAM')),c);
 return {c,item,avisos,renders,escritas,elements};
}
for(const tipo of ['grupo','responsaveis']) test(`${tipo}: confirma, atualiza visões e preserva rascunho; erro de releitura não é falha de escrita`,async()=>{
 const {c,item,avisos,renders,elements,escritas}=contexto();
 const executar=()=>tipo==='grupo'?c.moverPecaDeGrupo(item.id,'destino'):c.saveOwnerAssignments();
 await executar();
 assert.equal(escritas.length,1);assert.equal(elements['workspace-comment-input'].value,'rascunho');assert.equal(elements['workspace-link-input'].value,'link');
 assert.ok(['integradas','grupos','demandas','gaveta'].every(x=>renders.includes(x)));
 assert.deepEqual(item.clientes,['A','B']);
 if(tipo==='grupo'){assert.equal(item.grupo,'Nome do banco');item.group_id='antigo';}
 c.fetchWorkspaceItem=async()=>{throw Error('offline');};await executar();
 assert.equal(avisos.at(-1)[1],'info');assert.match(avisos.at(-1)[0],/salvo/);
});
for(const tipo of ['grupo','responsaveis']) test(`${tipo}: falha não altera dados e resposta atrasada não substitui outra gaveta`,async()=>{
 const {c,item,avisos,renders,elements}=contexto();
 const executar=()=>tipo==='grupo'?c.moverPecaDeGrupo(item.id,'destino'):c.saveOwnerAssignments();
 c.tentarEscritaDupla=async()=>{throw Error('recusado');};await executar();
 assert.equal(item.group_id,'antigo');assert.deepEqual(item.responsavel_ids,['100']);assert.equal(avisos.at(-1)[1],'err');
 let liberar,n=0;c.tentarEscritaDupla=async()=>{n++;await new Promise(r=>liberar=r);return {para:'Final'};};
 const p=executar();await executar();elements['workspace-drawer']={};c.activeWorkspaceItemId='vybe:2';liberar();await p;
 assert.equal(n,1);assert.ok(!renders.includes('gaveta'));assert.equal(elements['workspace-comment-input'].value,'rascunho');
});

test('lote mantém falhas explícitas e atualiza também calendário e contadores',async()=>{
 const {c,item,avisos,renders}=contexto();
 c.SELECIONADAS=new Set([item.id,'vybe:2']);c.perguntarNoPainel=async()=>true;
 c.findOperationalItem=id=>({id});
 const fonte=fs.readFileSync('vybe-agenda.js','utf8');
 vm.runInContext(fonte.slice(fonte.indexOf('async function aplicarEmLote'),fonte.indexOf('// O status em lote')),c);
 await c.aplicarEmLote('grupo',async alvo=>{if(alvo.id==='vybe:2')throw Error('recusado');});
 assert.ok(['integradas','grupos','demandas'].every(x=>renders.includes(x)));
 assert.match(avisos.at(-1)[0],/1 atualizada.*1 falhou/);
});

test('API exige sessão antes de mudar grupo ou responsáveis',async()=>{
 const {default:handler}=await import('../api/conteudo.js');
 for(const acao of ['grupo','responsaveis']){
  let status,payload;const res={setHeader(){},status(s){status=s;return this;},json(p){payload=p;return this;}};
  await handler({method:'POST',headers:{},body:{acao,item:'vybe:1',grupo_id:'x',pessoas:[]}},res);
  assert.equal(status,401);assert.match(payload.error,/Entre no painel/);
 }
});
