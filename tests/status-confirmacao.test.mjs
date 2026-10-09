import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { trocarStatus, retomarEncaminhamento } from '../api/conteudo.js';
const fonte=fs.readFileSync('vybe-status.js','utf8');
function contexto(){
 const item={id:'vybe:1',status:'Antes',clientes:['A','B']},avisos=[],renders=[];
 const elements={'workspace-drawer':{},'workspace-comment-input':{value:'rascunho'},'workspace-link-input':{value:'https://exemplo.test'}};
 const c=vm.createContext({Date,Set,document:{getElementById:id=>elements[id]},activeWorkspaceItemId:item.id,activeBoard:'demandas',DADOS_DEMANDAS:[item],
 showToast:(...a)=>avisos.push(a),armOutboundMutationGuard(){},chaveDeStatus:s=>s,tentarEscritaDupla:async()=>({}),
 updateLocalStatus:(_id,o)=>{item.status=o.label;},aplicarEfeitoDaAutomacao:()=>'',isRequestItem:()=>true,
 renderIntegratedOperationalViews(){},renderDemandas(){},closeStatusEditor(){},renderFocusUserPicker(){},
 fetchWorkspaceItem:async()=>({}),findOperationalItem:()=>item,recadoDeStatusRecusado:e=>e.message,
 renderWorkspaceDrawer:()=>{renders.push(item.id);elements['workspace-comment-input']={value:''};elements['workspace-link-input']={value:''};}});
 vm.runInContext(fonte.slice(fonte.indexOf('const statusEmGravacao'),fonte.indexOf('// O servidor recusa')),c);
 return {c,item,avisos,elements,renders};
}
test('releitura falha depois de salvar não transforma a confirmação em erro de gravação',async()=>{
 const {c,item,avisos}=contexto();c.fetchWorkspaceItem=async()=>{throw Error('offline');};
 await c.commitStatusChange(item,{label:'Depois'});
 assert.equal(item.status,'Depois');assert.match(avisos.at(-1)[0],/Status salvo/);assert.equal(avisos.some(a=>a[1]==='err'),false);
});
test('falha de escrita mantém status e rascunhos',async()=>{
 const {c,item,avisos,elements}=contexto();c.tentarEscritaDupla=async()=>{throw Error('recusado');};
 await c.commitStatusChange(item,{label:'Depois'});
 assert.equal(item.status,'Antes');assert.equal(elements['workspace-comment-input'].value,'rascunho');assert.equal(avisos.at(-1)[1],'err');
});
test('redesenho preserva comentários e links ainda não enviados e usa status final da automação',async()=>{
 const {c,item,elements}=contexto();c.tentarEscritaDupla=async()=>({depois:{status:'Final',status_color:'#abc',status_index:null}});
 await c.commitStatusChange(item,{label:'Intermediário'});
 assert.equal(item.status,'Final');assert.equal(item.status_color,'#abc');assert.deepEqual(item.clientes,['A','B']);
 assert.equal(elements['workspace-comment-input'].value,'rascunho');assert.equal(elements['workspace-link-input'].value,'https://exemplo.test');
});
test('resposta atrasada não redesenha a atividade aberta depois e envio repetido não grava duas vezes',async()=>{
 const {c,item,elements,renders}=contexto();let liberar, chamadas=0;
 c.tentarEscritaDupla=async()=>{chamadas++;await new Promise(r=>{liberar=r;});return {};};
 const p=c.commitStatusChange(item,{label:'Depois'});await c.commitStatusChange(item,{label:'Outro'});
 elements['workspace-drawer']={};c.activeWorkspaceItemId='vybe:2';liberar();await p;
 assert.equal(chamadas,1);assert.deepEqual(renders,[]);
});
async function banco(){
 const {db,sql}=conexao();await db.exec(`
 CREATE TABLE vybe_conteudos(id int primary key,monday_item_id text,board_id bigint,titulo text,status_chave text,status_em timestamptz,atualizado_em timestamptz,grupo_id text,etapa text,formato_chaves text[],captacao_chave text,removido_em timestamptz);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,cor text,borda text);
 CREATE TABLE vybe_conteudo_eventos(id serial primary key,conteudo_id int,tipo text,de text,para text,autor_id int,texto text,em timestamptz DEFAULT NOW());
 CREATE TABLE vybe_clientes(id int,nome text);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id int,cliente_id int);
 CREATE TABLE vybe_pessoas(id int,monday_user_id text,nome text,ativo boolean DEFAULT true);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id int,pessoa_id int,ordem int);
 CREATE TABLE vybe_automacoes(id int,nome text,ativa boolean,ordem int,gatilho jsonb,condicao jsonb,acoes jsonb);
 CREATE TABLE vybe_automacao_execucoes(automacao_id int,conteudo_id int,resultado jsonb,em timestamptz DEFAULT NOW());
 INSERT INTO vybe_conteudos VALUES(1,NULL,7829537690,'Peça','antes',NOW(),NOW(),'grupo','Grupo',NULL,NULL,NULL);
 INSERT INTO vybe_status VALUES(7829537690,'antes','Antes',0,'#aaa','#aaa'),(7829537690,'depois','Depois',1,'#bbb','#bbb'),(7829537690,'final','Final',NULL,'#ccc','#ddd');
 INSERT INTO vybe_clientes VALUES(1,'A'),(2,'B');INSERT INTO vybe_conteudo_clientes VALUES(1,1),(1,2);
 INSERT INTO vybe_pessoas(id,monday_user_id,nome) VALUES(1,'100','Pessoa');INSERT INTO vybe_conteudo_responsaveis VALUES(1,1,0);`);
 return {db,sql};
}
test('status e histórico são atômicos e preservam vínculos',async()=>{
 const {db,sql}=await banco();try{
 await db.exec("ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT recusa CHECK(para <> 'Depois')");
 await assert.rejects(trocarStatus(sql,null,{item:'vybe:1',para:'depois'}));
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'antes');
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,0);
 await db.exec('ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT recusa');
 await trocarStatus(sql,null,{item:'vybe:1',para:'depois'});
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'depois');
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos`).length,1);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_responsaveis`).length,1);
 }finally{await db.close();}
});
test('automação devolve status final e metadados do próprio quadro',async()=>{
 const {db,sql}=await banco();try{
 await db.exec(`INSERT INTO vybe_automacoes VALUES(1,'Concluir',true,1,'{"tipo":"status","para":"depois"}',NULL,'[{"tipo":"status","para":"final"}]');`);
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'depois'});
 assert.equal(r.depois.status,'Final');assert.equal(r.depois.status_color,'#ccc');assert.equal(r.depois.status_index,null);
 assert.deepEqual(r.depois.responsavel_ids,['100']);assert.equal(r.automacoes.length,1);
 assert.equal((await sql`SELECT status_chave FROM vybe_conteudos`)[0].status_chave,'final');
 }finally{await db.close();}
});

import { SEMENTE, GRUPOS, aplicar } from '../vybe_automacoes.js';
async function prepararPercurso(db,sql,formato){
 await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN captacao text;
 ALTER TABLE vybe_conteudo_responsaveis ADD PRIMARY KEY(conteudo_id,pessoa_id);
 CREATE TABLE vybe_captacao(chave text,rotulo text,monday_index int);
 INSERT INTO vybe_captacao VALUES('editado','Editado',1);
 CREATE TABLE vybe_conteudo_updates(conteudo_id int,corpo text,autor text,criado_em timestamptz);
 INSERT INTO vybe_pessoas(id,monday_user_id,nome) VALUES(2,'68036697','Editor'),(3,'68997024','Designer'),(4,'71130408','Design'),
 (5,'68035653','Aprovador'),(6,'68036687','Revisor'),(7,'68035537','Gestor'),(8,'80146924','Publicação');`);
 for(const [chave,rotulo] of Object.entries({pode_fazer:'Pode Fazer',em_andamento:'Em andamento',para_aprovacao:'Para aprovação',alteracao:'Alteração',para_agendar:'Para agendar',agendado:'Agendado',finalizado:'Finalizado'}))
  await sql`INSERT INTO vybe_status(board_id,chave,rotulo) VALUES(7829537690,${chave},${rotulo})`;
 await sql`UPDATE vybe_conteudos SET grupo_id=${GRUPOS.producao},formato_chaves=${[formato]},status_chave='em_andamento'`;
 for(const [i,r] of SEMENTE.entries())await sql`INSERT INTO vybe_automacoes VALUES(${i+1},${r.nome},true,${r.ordem},${JSON.stringify(r.gatilho)}::jsonb,${r.condicao?JSON.stringify(r.condicao):null}::jsonb,${JSON.stringify(r.acoes)}::jsonb)`;
}
for(const formato of ['reels','card'])test(`percurso ${formato}: produção, aprovação, ajuste, agendamento e finalização`,async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,formato);
 const mudar=para=>trocarStatus(sql,null,{item:'vybe:1',para});
 const editores=formato==='reels'?['68036697']:['68997024','71130408'];
 let r=await mudar('finalizado');assert.equal(r.automacao_pendente,false);
 assert.equal(r.depois.grupo_id,GRUPOS.design);assert.equal(r.depois.status,'Pode Fazer');assert.deepEqual(r.depois.responsavel_ids,editores);
 await mudar('em_andamento');r=await mudar('para_aprovacao');assert.ok(r.depois.responsavel_ids.length>=editores.length);
 await mudar('alteracao');await mudar('em_andamento');
 // Um novo ciclo igual, dentro de dois minutos, precisa chamar aprovação de novo.
 await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=1`;
 r=await mudar('para_aprovacao');assert.equal(r.automacoes.length,1);assert.ok(r.depois.responsavel_ids.length>0);
 const [execucao]=await sql`SELECT resultado FROM vybe_automacao_execucoes ORDER BY em DESC LIMIT 1`;
 assert.deepEqual((await aplicar(sql,1,JSON.parse(execucao.resultado.evento))).aplicadas,[]);
 r=await mudar('para_agendar');assert.equal(r.depois.grupo_id,GRUPOS.publicacoes);assert.deepEqual(r.depois.responsavel_ids,['80146924']);
 await mudar('agendado');r=await mudar('finalizado');assert.equal(r.depois.grupo_id,GRUPOS.finalizados);assert.deepEqual(r.depois.responsavel_ids,[]);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_responsaveis`).length,0);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
 }finally{await db.close();}
});
test('falha no encaminhamento reverte efeitos e mantém apenas o status solicitado',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');
 await db.exec("ALTER TABLE vybe_conteudo_updates ADD CONSTRAINT falhar CHECK(false)");
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_agendar'});
 assert.equal(r.automacao_pendente,true);assert.equal(r.depois.status,'Para agendar');
 assert.equal(r.depois.grupo_id,GRUPOS.producao);assert.deepEqual(r.depois.responsavel_ids,['100']);
 assert.equal((await sql`SELECT * FROM vybe_automacao_execucoes`).length,0);
 }finally{await db.close();}
});
test('encaminhamento incompleto mostra aviso e mantém status confirmado',async()=>{
 const {c,item,avisos}=contexto();c.tentarEscritaDupla=async()=>({automacao_pendente:true});
 await c.commitStatusChange(item,{label:'Para agendar'});
 assert.equal(item.status,'Para agendar');assert.equal(avisos[0][1],'info');
 assert.match(avisos[0][0],/encaminhamento automático não foi concluído/);
 assert.equal(avisos.some(a=>a[1]==='ok'),false);
});
test('automação sincroniza dono singular e lista ao trocar ou liberar a fila',()=>{
 const item={id:'1',responsavel_id:'antigo',responsavel_ids:['antigo']};
 const c=vm.createContext({TEAM_USERS:[],firstName:s=>s,assignedIds:i=>i.responsavel_ids.length?i.responsavel_ids:[i.responsavel_id],applyOutboundItemPatch:(_id,patch)=>Object.assign(item,patch)});
 vm.runInContext(fonte.slice(fonte.indexOf('function aplicarEfeitoDaAutomacao'),fonte.indexOf('const statusEmGravacao')),c);
 c.aplicarEfeitoDaAutomacao(item,{depois:{responsavel_ids:['novo']}});
 assert.equal(item.responsavel_id,'novo');assert.deepEqual([...item.responsavel_ids],['novo']);
 c.aplicarEfeitoDaAutomacao(item,{depois:{responsavel_ids:[]}});
 assert.equal(item.responsavel_id,'');assert.deepEqual([...item.responsavel_ids],[]);
});

test('rollback integral, retomada e repetição tardia não duplicam notas ou notificações',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');
 await db.exec(`CREATE TABLE vybe_notificacoes(pessoa_id int,conteudo_id int,texto text);
 DELETE FROM vybe_automacoes;
 ALTER TABLE vybe_automacao_execucoes ADD CONSTRAINT falha_final CHECK(false);`);
 const acoes=[{tipo:'grupo',para:GRUPOS.publicacoes},{tipo:'responsaveis',modo:'replace',pessoas:['80146924']},
 {tipo:'captacao',para:'editado'},{tipo:'status',para:'agendado'},{tipo:'update',texto:'Pronto'}, {tipo:'notificar',texto:'Agendar'}];
 await sql`INSERT INTO vybe_automacoes VALUES(1,'Encaminhar',true,1,'{"tipo":"status","para":"para_agendar"}',NULL,${JSON.stringify(acoes)}::jsonb)`;
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_agendar'});
 assert.equal(r.automacao_pendente,true);
 let [c]=await sql`SELECT * FROM vybe_conteudos`;assert.equal(c.grupo_id,GRUPOS.producao);assert.equal(c.status_chave,'para_agendar');assert.equal(c.captacao_chave,null);
 assert.deepEqual((await sql`SELECT pessoa_id FROM vybe_conteudo_responsaveis`).map(x=>x.pessoa_id),[1]);
 for(const tabela of ['vybe_conteudo_updates','vybe_notificacoes','vybe_automacao_execucoes'])assert.equal((await sql.query('SELECT * FROM '+tabela)).length,0);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos WHERE tipo='status'`).length,1);
 const [e]=await sql`SELECT id FROM vybe_conteudo_eventos WHERE tipo='status'`;
 await db.exec('ALTER TABLE vybe_automacao_execucoes DROP CONSTRAINT falha_final');
 const primeira=await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:e.id});assert.equal(primeira.depois.status,'Agendado');
 await db.exec("UPDATE vybe_automacao_execucoes SET em=NOW()-INTERVAL '1 day'");
 const repetidas=await Promise.all([retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:e.id}),retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:e.id})]);
 assert.ok(repetidas.every(r=>r.ja_aplicada));
 for(const tabela of ['vybe_conteudo_updates','vybe_notificacoes','vybe_automacao_execucoes'])assert.equal((await sql.query('SELECT * FROM '+tabela)).length,1);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos WHERE tipo='status'`).length,1);
 await trocarStatus(sql,null,{item:'vybe:1',para:'alteracao'});
 await assert.rejects(retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:e.id}),/mudou de etapa/);
 await assert.rejects(retomarEncaminhamento(sql,{item:'vybe:2',ocorrencia:e.id}),/apenas para Produção e Demandas/);
 }finally{await db.close();}
});
test('responsável inexistente reverte grupo e preserva dono anterior',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');await db.exec("DELETE FROM vybe_pessoas WHERE monday_user_id='80146924'");
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_agendar'});
 assert.equal(r.automacao_pendente,true);assert.equal(r.depois.grupo_id,GRUPOS.producao);assert.deepEqual(r.depois.responsavel_ids,['100']);
 }finally{await db.close();}
});

test('falha na segunda regra reverte a primeira e tarefa diária não duplica no mesmo dia',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');await db.exec(`DELETE FROM vybe_automacoes;
 CREATE TABLE vybe_notificacoes(pessoa_id int,conteudo_id int,texto text CHECK(false));
 INSERT INTO vybe_automacoes VALUES(100,'Nota',true,1,'{"tipo":"data","campo":"prazo","dias":0}',NULL,'[{"tipo":"update","texto":"Hoje"}]'),
 (101,'Aviso',true,2,'{"tipo":"data","campo":"prazo","dias":0}',NULL,'[{"tipo":"notificar","texto":"Vence hoje"}]');`);
 const evento={tipo:'data',campo:'prazo',dias:0,ocorrencia:'agenda:2026-09-29:prazo:0'};
 await assert.rejects(aplicar(sql,1,evento));
 assert.equal((await sql`SELECT * FROM vybe_conteudo_updates`).length,0);assert.equal((await sql`SELECT * FROM vybe_automacao_execucoes`).length,0);
 await db.exec('ALTER TABLE vybe_notificacoes DROP CONSTRAINT vybe_notificacoes_check');
 await aplicar(sql,1,evento);await aplicar(sql,1,evento);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_updates`).length,1);assert.equal((await sql`SELECT * FROM vybe_notificacoes`).length,1);
 await aplicar(sql,1,{...evento,ocorrencia:'agenda:2026-09-30:prazo:0'});
 assert.equal((await sql`SELECT * FROM vybe_notificacoes`).length,2);
 }finally{await db.close();}
});


import { listarFalhasDeEncaminhamento, motivoDaFalha, registrarFalhaDeEncaminhamento } from '../server/falhas-automacoes.js';
test('fila durável agrupa tentativas, preserva clientes e só resolve com execução confirmada',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');
 await db.exec("ALTER TABLE vybe_conteudo_updates ADD CONSTRAINT falhar CHECK(false)");
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_agendar'});
 assert.equal(r.automacao_falha_registrada,true);
 let fila=await listarFalhasDeEncaminhamento(sql);assert.equal(fila.length,1);
 const evento=fila[0].ocorrencia;
 assert.equal(fila[0].estado,'pendente');assert.equal(fila[0].clientes,'A, B');assert.equal(fila[0].tentativas,1);
 await assert.rejects(retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:evento}));
 fila=await listarFalhasDeEncaminhamento(sql);assert.equal(fila.length,1);assert.equal(fila[0].tentativas,2);
 await sql`UPDATE vybe_automacoes SET ativa=false`;
 await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:evento});
 assert.equal((await listarFalhasDeEncaminhamento(sql))[0].estado,'pendente');
 await sql`UPDATE vybe_automacoes SET ativa=true`;
 await db.exec('ALTER TABLE vybe_conteudo_updates DROP CONSTRAINT falhar');
 await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:evento});
 fila=await listarFalhasDeEncaminhamento(sql);assert.equal(fila[0].estado,'resolvida');assert.ok(fila[0].resolvida_em);
 await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:evento});
 assert.equal((await listarFalhasDeEncaminhamento(sql))[0].tentativas,2);
 }finally{await db.close();}
});
test('fila não oferece retomada de evento antigo ou peça removida e distingue banco indisponível',async()=>{
 const {db,sql}=await banco();try{
 await prepararPercurso(db,sql,'reels');
 await db.exec("DELETE FROM vybe_pessoas WHERE monday_user_id='80146924'");
 await trocarStatus(sql,null,{item:'vybe:1',para:'para_agendar'});
 const [f]=await listarFalhasDeEncaminhamento(sql);assert.match(f.motivo,/responsável/);
 await trocarStatus(sql,null,{item:'vybe:1',para:'alteracao'});
 assert.equal((await listarFalhasDeEncaminhamento(sql))[0].estado,'superada');
 await sql`UPDATE vybe_conteudos SET removido_em=NOW()`;
 assert.equal((await listarFalhasDeEncaminhamento(sql))[0].estado,'removida');
 await db.exec('DROP TABLE vybe_conteudo_eventos');
 await assert.rejects(listarFalhasDeEncaminhamento(sql));
 assert.equal(await registrarFalhaDeEncaminhamento(sql,1,f.ocorrencia,new Error('falha')),false);
 }finally{await db.close();}
});
test('motivo da fila não guarda mensagens de SQL, URLs ou segredos',()=>{
 assert.doesNotMatch(motivoDaFalha(new Error('postgresql://user:segredo@host select privado')),/segredo|privado|postgresql/);
 assert.match(motivoDaFalha({code:'55P03'}),/concorrência/);
});

import { BOARD_DEMANDAS, GRUPOS_DEMANDAS } from '../vybe_automacoes.js';
async function prepararDemandas(db,sql){
 await prepararPercurso(db,sql,'card');
 for(const [chave,rotulo] of Object.entries({nova:'Nova demanda',para_orcar:'Para Orçar',em_orcamento:'Em Orçamento',em_impressao:'Em impressão',em_aprovacao:'Em Aprovação',alteracao:'Alteração',feito:'Feito'}))
  await sql`INSERT INTO vybe_status(board_id,chave,rotulo) VALUES(${BOARD_DEMANDAS},${chave},${rotulo})`;
 await sql`UPDATE vybe_conteudos SET board_id=${BOARD_DEMANDAS},grupo_id=${GRUPOS_DEMANDAS.a_fazer},etapa='A Fazer',status_chave='nova'`;
}
test('Demandas aciona regras reais de orçamento, impressão, alteração e conclusão',async()=>{
 const {db,sql}=await banco();try{
 await prepararDemandas(db,sql);
 let r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_orcar'});
 assert.equal(r.automacao_pendente,false);assert.equal(r.automacoes.length,1);
 assert.equal(r.depois.grupo_id,GRUPOS_DEMANDAS.em_execucao);assert.equal(r.depois.grupo,'Em Execução');
 assert.deepEqual(r.depois.responsavel_ids,['68035537']);
 for(const para of ['em_orcamento','em_impressao']){
  await sql`DELETE FROM vybe_conteudo_responsaveis`;
  r=await trocarStatus(sql,null,{item:'vybe:1',para});
  assert.equal(r.automacao_pendente,false);assert.deepEqual(r.depois.responsavel_ids,['68035537']);
 }
 await sql`INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,para,autor_id) VALUES(1,'status','Em Aprovação',2)`;
 r=await trocarStatus(sql,null,{item:'vybe:1',para:'alteracao'});
 assert.deepEqual(r.depois.responsavel_ids,['68036697']);
 r=await trocarStatus(sql,null,{item:'vybe:1',para:'feito'});
 assert.equal(r.depois.grupo_id,GRUPOS_DEMANDAS.concluidas);
 assert.equal(r.depois.grupo,'Concluídas');
 assert.deepEqual(r.depois.responsavel_ids,[]);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_clientes`).length,2);
 }finally{await db.close();}
});
test('Demandas reverte encaminhamento incompleto, registra falha e retoma sem duplicar',async()=>{
 const {db,sql}=await banco();try{
 await prepararDemandas(db,sql);
 await sql`UPDATE vybe_pessoas SET ativo=false WHERE monday_user_id='68035537'`;
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'para_orcar'});
 assert.equal(r.automacao_pendente,true);assert.equal(r.automacao_falha_registrada,true);
 assert.equal(r.depois.status,'Para Orçar');assert.equal(r.depois.grupo_id,GRUPOS_DEMANDAS.a_fazer);
 assert.deepEqual(r.depois.responsavel_ids,['100']);
 const [f]=await listarFalhasDeEncaminhamento(sql);
 assert.equal(f.estado,'pendente');assert.equal(f.clientes,'A, B');
 await sql`UPDATE vybe_pessoas SET ativo=true WHERE monday_user_id='68035537'`;
 const retomada=await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:f.ocorrencia});
 assert.equal(retomada.depois.grupo_id,GRUPOS_DEMANDAS.em_execucao);
 assert.deepEqual(retomada.depois.responsavel_ids,['68035537']);
 assert.equal((await listarFalhasDeEncaminhamento(sql))[0].estado,'resolvida');
 assert.equal((await retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:f.ocorrencia})).ja_aplicada,true);
 assert.equal((await sql`SELECT * FROM vybe_automacao_execucoes`).length,1);
 assert.equal((await sql`SELECT * FROM vybe_conteudo_eventos WHERE tipo='status'`).length,1);
 }finally{await db.close();}
});
test('Demandas recusa retomada de evento superado ou atividade removida',async()=>{
 const {db,sql}=await banco();try{
 await prepararDemandas(db,sql);await sql`UPDATE vybe_pessoas SET ativo=false WHERE monday_user_id='68035537'`;
 await trocarStatus(sql,null,{item:'vybe:1',para:'para_orcar'});
 const [f]=await listarFalhasDeEncaminhamento(sql);
 await trocarStatus(sql,null,{item:'vybe:1',para:'em_orcamento'});
 await assert.rejects(retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:f.ocorrencia}),/mudou de etapa/);
 assert.equal((await listarFalhasDeEncaminhamento(sql)).find(x=>x.ocorrencia===f.ocorrencia).estado,'superada');
 const [ultimo]=await sql`SELECT id FROM vybe_conteudo_eventos WHERE tipo='status' ORDER BY id DESC LIMIT 1`;
 await sql`UPDATE vybe_conteudos SET removido_em=NOW()`;
 await assert.rejects(retomarEncaminhamento(sql,{item:'vybe:1',ocorrencia:String(ultimo.id)}));
 }finally{await db.close();}
});

test('migração da conclusão é idempotente e executa no motor existente',async()=>{
 const {db,sql}=await banco();try{
 await prepararDemandas(db,sql);
 await db.exec("ALTER TABLE vybe_automacoes ADD COLUMN origem text; CREATE SEQUENCE teste_regra START 1000; ALTER TABLE vybe_automacoes ALTER COLUMN id SET DEFAULT nextval('teste_regra'); ALTER TABLE vybe_automacoes ALTER COLUMN ativa SET DEFAULT true;");
 await sql`DELETE FROM vybe_automacoes WHERE nome='Demanda feita vai para Concluídas, sem responsável'`;
 const migration=fs.readFileSync('migrations/2026-10-09-demanda-feita.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal((await sql`SELECT * FROM vybe_automacoes WHERE nome='Demanda feita vai para Concluídas, sem responsável'`).length,1);
 const r=await trocarStatus(sql,null,{item:'vybe:1',para:'feito'});
 assert.equal(r.automacao_pendente,false);assert.equal(r.depois.grupo_id,GRUPOS_DEMANDAS.concluidas);
 assert.deepEqual(r.depois.responsavel_ids,[]);
 }finally{await db.close();}
});
