import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';import {executarFerramenta,validarFerramenta,FERRAMENTAS_ASSISTENTE,textoOperacional,diaAssistente} from '../server/assistente-ferramentas.js';
import {validarConversa,autorizarConversa} from '../server/assistente-politica.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';import {atenderBotAssistente} from '../server/assistente-servico.js';import {metricasDoHub} from '../server/assistente-hub.js';
const jid='1111111111@lid',outro='2222222222@c.us',grupo='123456789-123@g.us',segredo='s'.repeat(40);
const config={VYBE_AI_ATIVA:'1',VYBE_AI_GRUPOS_IDS:grupo,VYBE_AI_LINK_SECRET:segredo,VYBE_AI_BOT_TOKEN:'A'.repeat(64)};
const contexto=(grupoAtivo=false)=>({tipo:grupoAtivo?'grupo':'privado',...(grupoAtivo?{grupo_id:grupo}:{}),participantes:grupoAtivo?[jid,outro]:[jid],grupos_remetente:[grupo],observado_em:Date.now()});
test('contrato fechado: sem SQL, datas impossíveis, campos administrativos e excesso',()=>{
 for(const [n,a] of [['sql',{}],['buscar_demandas',{sql:'SELECT *'}],['listar_responsaveis',{admin:true}],['buscar_demandas',{limite:26}],['buscar_demandas',{de:'2026-02-30'}],['consultar_metricas_trafego',{cliente_id:1,de:'2026-01-01',ate:'2026-12-31'}]])assert.throws(()=>validarFerramenta(n,a));
 assert.throws(()=>validarFerramenta('buscar_demandas',JSON.parse('{"__proto__":{}}')));
 assert.equal(FERRAMENTAS_ASSISTENTE.length,11);
 assert.ok(!textoOperacional('senha=ABC teste@example.com https://host/link').includes('ABC'));
});
test('conversa exige evidência recente, grupo aprovado, remetente e audiência válidos',()=>{
 for(const c of [undefined,{}, {...contexto(),observado_em:0},{...contexto(),grupos_remetente:['outro@g.us']},{...contexto(),grupos_remetente:[grupo,'outro@g.us']},{...contexto(),grupos_remetente:[grupo,grupo]},{...contexto(),participantes:[outro]},{...contexto(true),grupo_id:'outro@g.us'},{...contexto(true),participantes:[jid,jid]},{...contexto(),grupo_aprovado:true,grupos_remetente:[]}])assert.throws(()=>validarConversa(jid,c,config));
 assert.equal(validarConversa(jid,contexto(),config).tipo,'privado');
});
test('operações consultam domínio real e autorizam a audiência inteira',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,papel text,disciplina text,ativo boolean,pode_entrar boolean,senha_hash text,email text);
 INSERT INTO vybe_pessoas VALUES(1,'Pessoa A','Criação','Design',true,true,'senha','sigilo@example.com'),(2,'Pessoa B','Atendimento','Estratégia',true,true,'senha','pessoal@example.com');
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean,responsavel text);
 INSERT INTO vybe_clientes VALUES(10,'Cliente A',true,'Vinícius'),(20,'Cliente B',true,'Ewerton');
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,titulo text,formato text,prazo date,veiculacao date,atualizado_em timestamptz,status_chave text,board_id bigint,removido_em timestamptz,briefing text);
 INSERT INTO vybe_conteudos VALUES(100,'Card A','Card','2026-10-23','2026-10-24',now(),'agendado',8385559107,NULL,'senha=NAO_EXPOR'),(200,'Peça da outra pessoa','Vídeo','2026-10-25','2026-10-26',now(),'agendado',7829537690,NULL,'NAO_EXPOR'),(300,'Excluída',NULL,NULL,NULL,now(),NULL,8385559107,now(),NULL);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);INSERT INTO vybe_conteudo_responsaveis VALUES(100,1),(200,2);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);INSERT INTO vybe_conteudo_clientes VALUES(100,10),(100,20),(200,20);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);INSERT INTO vybe_status VALUES(8385559107,'agendado','Agendado'),(7829537690,'agendado','Agendado');
 CREATE TABLE vybe_planejamentos(id bigint PRIMARY KEY,cliente_id bigint,mes date,titulo text,estado text,conteudo jsonb,atualizado_em timestamptz,link_hash text);
 INSERT INTO vybe_planejamentos VALUES(5,10,'2026-10-01','Plano A','enviado','{"resumo":"Posicionamento da marca","pecas":[{"data":"2026-10-23","tema":"Criatividade","formato":"Card","ajuste_cliente":"privado"}],"observacoes":"NAO_EXPOR"}',now(),'NAO_EXPOR');
 CREATE TABLE vybe_captacoes(id bigint,cliente_id bigint,dia date,inicio time,fim time,estado text,observacao text);INSERT INTO vybe_captacoes VALUES(1,10,'2026-10-23','10:00','11:00','marcada','NAO_EXPOR');
 CREATE TABLE vybe_roteiros(id bigint,cliente_id bigint,titulo text,removido_em timestamptz,criado_em timestamptz,doc_id text);INSERT INTO vybe_roteiros VALUES(1,10,'Roteiro A',NULL,now(),'NAO_EXPOR');`);
 await db.exec(readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8'));
 for(const [id,j]of [[1,jid],[2,outro]])await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES(${id},${identificadorProtegido(j,segredo)})`;
 await t.test('todos os funcionários elegíveis podem consultar demandas de outros responsáveis',async()=>{
  assert.equal(await autorizarConversa(sql,jid,contexto(true),segredo,config),1);
  const r=await executarFerramenta(sql,'buscar_demandas',{});assert.deepEqual(r.itens.map(x=>x.id),['100','200']);assert.equal(r.itens[0].clientes.length,2);
  assert.equal(r.itens[1].responsaveis[0].nome,'Pessoa B');assert.equal(r.itens[0].status,'Agendado');assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));
  assert.equal((await executarFerramenta(sql,'buscar_demandas',{cliente_id:20,responsavel_id:2})).itens.length,1);
  assert.equal((await executarFerramenta(sql,'detalhar_demanda',{id:300})).itens.length,0);
 });
 await t.test('consulta pessoal de hoje é vinculada no servidor, nos dois quadros e no fuso Bahia',async()=>{
  assert.equal(diaAssistente(new Date('2026-10-23T02:59:59Z')),'2026-10-22');
  assert.equal(diaAssistente(new Date('2026-10-23T03:00:00Z')),'2026-10-23');
  const r=await executarFerramenta(sql,'minhas_demandas',{periodo:'hoje'},{pessoaId:1,agora:new Date('2026-10-23T15:00:00Z')});
  assert.deepEqual(r.itens.map(x=>x.id),['100']);
  await assert.rejects(()=>executarFerramenta(sql,'minhas_demandas',{periodo:'hoje',responsavel_id:2},{pessoaId:1}));
  await assert.rejects(()=>executarFerramenta(sql,'minhas_demandas',{}));
  await db.exec("INSERT INTO vybe_conteudos VALUES(400,'Sem prazo','Vídeo',NULL,'2026-10-23',now(),'agendado',7829537690,NULL,'NAO_EXPOR');INSERT INTO vybe_conteudo_responsaveis VALUES(400,1)");
  const semPrazo=await executarFerramenta(sql,'minhas_demandas',{periodo:'hoje'},{pessoaId:1,agora:new Date('2026-10-23T15:00:00Z')});
  assert.deepEqual(semPrazo.itens.map(x=>x.id),['100','400']);
  await db.exec('DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=400;DELETE FROM vybe_conteudos WHERE id=400');
 });
 await t.test('projeções não incluem emails, credenciais, notas, links ou documentos',async()=>{
  for(const [nome,args]of [['listar_clientes',{}],['listar_responsaveis',{}],['listar_planejamentos',{}],['detalhar_planejamento',{id:5}],['listar_captacoes',{}],['listar_roteiros',{}]]){
   const r=await executarFerramenta(sql,nome,args);assert.ok(r.itens.length);assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));assert.ok(!JSON.stringify(r).includes('example.com'));assert.ok(!JSON.stringify(r).includes('privado'));
  }
 });
 await t.test('endpoint fornece ferramentas e executa consulta ampla, sem confiar em admin/pessoa_id',async()=>{
  const res=()=>({status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
  const req={method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{jid,contexto:contexto(),consulta:'operacional',ferramenta:'buscar_demandas',argumentos:{},pessoa_id:999,admin:true}};
  let r=res();await atenderBotAssistente(req,r,()=>sql,config);assert.equal(r.codigo,200);assert.equal(r.corpo.itens.length,2);
  r=res();await atenderBotAssistente({...req,body:{...req.body,consulta:'autorizar_contexto'}},r,()=>sql,config);assert.equal(r.codigo,200);assert.equal(r.corpo.max_ferramentas,3);
 });
 await t.test('endpoint pessoal vincula remetente em privado e grupo e recusa IDs do modelo',async()=>{
  const res=()=>({status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
  for(const grupoAtivo of [false,true]){
   const corpo={jid,contexto:contexto(grupoAtivo),consulta:'operacional',ferramenta:'minhas_demandas',argumentos:{periodo:'todas'},pessoa_id:2,admin:true};
   let r=res();await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:corpo},r,()=>sql,config);
   assert.equal(r.codigo,200);assert.deepEqual(r.corpo.itens.map(x=>x.id),['100']);
   for(const manipulacao of [{responsavel_id:2},{pessoa_id:2},{id:200},{sql:'SELECT *'},{agora:'2026-10-25'}]){
    r=res();await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{...corpo,argumentos:{periodo:'hoje',...manipulacao}}},r,()=>sql,config);assert.equal(r.codigo,400);
   }
  }
 });
 await t.test('elegibilidade automática não usa whitelist e bloqueia ativos sem vínculo/grupo',async()=>{
  for(const antiga of [undefined,'','999','*'])assert.equal(await autorizarConversa(sql,jid,contexto(true),segredo,{...config,VYBE_AI_PESSOAS_LIBERADAS:antiga}),1);
  await assert.rejects(()=>autorizarConversa(sql,'9999999999@lid',{...contexto(),participantes:['9999999999@lid']},segredo,config));
  await assert.rejects(()=>autorizarConversa(sql,jid,{...contexto(),grupos_remetente:[]},segredo,config));
  await assert.rejects(()=>autorizarConversa(sql,jid,{...contexto(),tipo:'privado',participantes:[jid,outro]},segredo,config));
  await assert.rejects(()=>autorizarConversa(sql,jid,contexto(true),segredo,{...config,VYBE_AI_ATIVA:'0'}));
 });
 await t.test('revogação, participante desconhecido e conta inativa bloqueiam grupo inteiro',async()=>{
  await assert.rejects(()=>autorizarConversa(sql,jid,{...contexto(true),participantes:[jid,'9999999999@lid']},segredo,config));
  await sql`UPDATE vybe_pessoas SET ativo=false WHERE id=2`;
  await assert.rejects(()=>autorizarConversa(sql,jid,contexto(true),segredo,config));
  await sql`UPDATE vybe_pessoas SET ativo=true WHERE id=2`;
  await sql`UPDATE vybe_ai_vinculos SET revogado_em=now() WHERE pessoa_id=2`;
  await assert.rejects(()=>autorizarConversa(sql,jid,contexto(true),segredo,config));
  assert.equal(await autorizarConversa(sql,jid,contexto(),segredo,config),1);
 });
 await t.test('ponte de métricas exige correspondência e mantém só campos aprovados',async()=>{
  const c={VYBE_AI_HUB_ATIVO:'1',VYBE_AI_HUB_URL:'https://vybehub-teste-vybe-hub.vercel.app',VYBE_OS_METRICAS_TOKEN:'B'.repeat(64),VYBE_AI_HUB_CLIENTES:'{"10":"cliente-a"}'};
  const a={cliente_id:10,de:'2026-10-01',ate:'2026-10-23'};
  const buscar=async()=>new Response(JSON.stringify({result:{data:{json:{slug:'cliente-a',cliente_nome:'Cliente A',de:a.de,ate:a.ate,origem_dados:'meta',linhas:[{campaign:'Campanha',amountSpent:10,accessToken:'NAO_EXPOR',faturamento:1000}]}}}}));
  const r=await metricasDoHub(sql,a,{config:c,buscar});assert.equal(r.itens[0].amountSpent,10);assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));assert.ok(!('faturamento'in r.itens[0]));
  await assert.rejects(()=>metricasDoHub(sql,{...a,cliente_id:20},{config:c,buscar}));
 });
});
