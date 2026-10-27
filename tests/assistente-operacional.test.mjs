import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';import {executarFerramenta,validarFerramenta,FERRAMENTAS_ASSISTENTE,textoOperacional,diaAssistente} from '../server/assistente-ferramentas.js';
import {validarConversa,autorizarConversa} from '../server/assistente-politica.js';
import {identificadorProtegido} from '../server/assistente-identidade.js';import {atenderBotAssistente} from '../server/assistente-servico.js';import {metricasDoHub} from '../server/assistente-hub.js';
const jid='1111111111@lid',outro='2222222222@c.us',grupo='123456789-123@g.us',segredo='s'.repeat(40);
const config={VYBE_AI_ATIVA:'1',VYBE_AI_GRUPOS_IDS:grupo,VYBE_AI_LINK_SECRET:segredo,VYBE_AI_BOT_TOKEN:'A'.repeat(64)};
config.VYBE_AI_ADMIN_JID_HASH=identificadorProtegido(jid,segredo);config.VYBE_AI_ADMIN_PESSOA_ID='1';
const contexto=(grupoAtivo=false)=>({tipo:grupoAtivo?'grupo':'privado',...(grupoAtivo?{grupo_id:grupo}:{}),participantes:grupoAtivo?[jid,outro]:[jid],grupos_remetente:[grupo],observado_em:Date.now()});
test('contrato fechado: sem SQL, datas impossíveis, campos administrativos e excesso',()=>{
 for(const [n,a] of [['sql',{}],['buscar_demandas',{sql:'SELECT *'}],['listar_responsaveis',{admin:true}],['buscar_demandas',{limite:26}],['buscar_demandas',{de:'2026-02-30'}],['consultar_metricas_trafego',{cliente_id:1,de:'2026-01-01',ate:'2026-12-31'}]])assert.throws(()=>validarFerramenta(n,a));
 assert.throws(()=>validarFerramenta('buscar_demandas',JSON.parse('{"__proto__":{}}')));
 assert.equal(FERRAMENTAS_ASSISTENTE.length,23);
 assert.ok(!textoOperacional('senha=ABC teste@example.com https://host/link').includes('ABC'));
});
test('conversa exige evidência recente, grupo aprovado, remetente e audiência válidos',()=>{
 for(const c of [undefined,{}, {...contexto(),observado_em:0},{...contexto(),grupos_remetente:['outro@g.us']},{...contexto(),grupos_remetente:[grupo,'outro@g.us']},{...contexto(),grupos_remetente:[grupo,grupo]},{...contexto(),participantes:[outro]},{...contexto(true),grupo_id:'outro@g.us'},{...contexto(true),participantes:[jid,jid]},{...contexto(),grupo_aprovado:true,grupos_remetente:[]}])assert.throws(()=>validarConversa(jid,c,config));
 assert.equal(validarConversa(jid,contexto(),config).tipo,'privado');
});
test('operações consultam domínio real e autorizam a audiência inteira',async t=>{
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,papel text,disciplina text,ativo boolean,pode_entrar boolean,senha_hash text,email text);
 INSERT INTO vybe_pessoas VALUES(1,'Pessoa A','Criação','Design',true,true,'senha','sigilo@example.com'),(2,'Pessoa B','Atendimento','Estratégia',true,true,'senha','pessoal@example.com'); ALTER TABLE vybe_pessoas ADD COLUMN admin boolean DEFAULT true;
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean,responsavel text);
 INSERT INTO vybe_clientes VALUES(10,'Cliente A',true,'Vinícius'),(20,'Cliente B',true,'Ewerton');
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,titulo text,formato text,prazo date,veiculacao date,atualizado_em timestamptz,status_chave text,board_id bigint,removido_em timestamptz,briefing text);ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS monday_item_id bigint;
 INSERT INTO vybe_conteudos VALUES(100,'Card A','Card','2026-10-23','2026-10-24',now(),'agendado',8385559107,NULL,'senha=NAO_EXPOR'),(200,'Peça da outra pessoa','Vídeo','2026-10-25','2026-10-26',now(),'agendado',7829537690,NULL,'NAO_EXPOR'),(300,'Excluída',NULL,NULL,NULL,now(),NULL,8385559107,now(),NULL);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);INSERT INTO vybe_conteudo_responsaveis VALUES(100,1),(200,2);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);INSERT INTO vybe_conteudo_clientes VALUES(100,10),(100,20),(200,20);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);INSERT INTO vybe_status VALUES(8385559107,'agendado','Agendado',false),(7829537690,'agendado','Agendado',false);
 CREATE TABLE vybe_planejamentos(id bigint PRIMARY KEY,cliente_id bigint,mes date,titulo text,estado text,conteudo jsonb,atualizado_em timestamptz,link_hash text);
 INSERT INTO vybe_planejamentos VALUES(5,10,'2026-10-01','Plano A','enviado','{"resumo":"Posicionamento da marca","pecas":[{"data":"2026-10-23","tema":"Criatividade","formato":"Card","ajuste_cliente":"privado"}],"observacoes":"senha=NAO_EXPOR"}',now(),'NAO_EXPOR');
 CREATE TABLE vybe_captacoes(id bigint,cliente_id bigint,dia date,inicio time,fim time,estado text,observacao text);INSERT INTO vybe_captacoes VALUES(1,10,'2026-10-23','10:00','11:00','marcada','NAO_EXPOR');
 CREATE TABLE vybe_roteiros(id bigint,cliente_id bigint,titulo text,removido_em timestamptz,criado_em timestamptz,doc_id text);INSERT INTO vybe_roteiros VALUES(1,10,'Roteiro A',NULL,now(),'NAO_EXPOR');`);
 await db.exec(`CREATE TABLE vybe_conteudo_editores(conteudo_id bigint,pessoa_id bigint);ALTER TABLE vybe_conteudos ADD COLUMN criado_em timestamptz,ADD COLUMN material_bruto text,ADD COLUMN etapa text,ADD COLUMN grupo_id bigint,ADD COLUMN prioridade_chave text,ADD COLUMN captacao_chave text,ADD COLUMN off_audio_chave text,ADD COLUMN tipo_conteudo_chaves text[],ADD COLUMN formato_chaves text[];`);
 await db.exec(readFileSync('migrations/2026-10-23-assistente-vinculos.sql','utf8'));
 for(const [id,j]of [[1,jid],[2,outro]])await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES(${id},${identificadorProtegido(j,segredo)})`;
 await t.test('todos os funcionários elegíveis podem consultar demandas de outros responsáveis',async()=>{
  await assert.rejects(()=>autorizarConversa(sql,jid,contexto(true),segredo,config),{status:403});
  assert.equal(await autorizarConversa(sql,jid,contexto(),segredo,config),1);
  const r=await executarFerramenta(sql,'buscar_demandas',{});assert.deepEqual(r.itens.map(x=>x.id),['100','200']);assert.equal(r.itens[0].clientes.length,2);
  assert.equal(r.itens[1].responsaveis[0].nome,'Pessoa B');assert.equal(r.itens[0].status,'Agendado');assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));
  assert.equal((await executarFerramenta(sql,'buscar_demandas',{cliente_id:20,responsavel_id:2})).itens.length,1);
  assert.equal((await executarFerramenta(sql,'detalhar_demanda',{id:300})).itens.length,0);
  // Quadro e data do cliente (veiculação na Produção / conclusão nas Solicitações).
  assert.deepEqual(r.itens.map(x=>x.quadro),['solicitacoes','producao']);
  assert.deepEqual((await executarFerramenta(sql,'buscar_demandas',{quadro:'producao'})).itens.map(x=>x.id),['200']);
  assert.deepEqual((await executarFerramenta(sql,'buscar_demandas',{quadro:'solicitacoes'})).itens.map(x=>x.id),['100']);
  assert.deepEqual((await executarFerramenta(sql,'buscar_demandas',{cliente_de:'2026-10-26',cliente_ate:'2026-10-26'})).itens.map(x=>x.id),['200']);
  assert.throws(()=>validarFerramenta('buscar_demandas',{quadro:'outro'}));
  assert.throws(()=>validarFerramenta('buscar_demandas',{cliente_de:'2026-10-27',cliente_ate:'2026-10-26'}));
 });
 await t.test('consulta pessoal de hoje é vinculada no servidor, nos dois quadros e no fuso Bahia',async()=>{
  assert.equal(diaAssistente(new Date('2026-10-23T02:59:59Z')),'2026-10-22');
  assert.equal(diaAssistente(new Date('2026-10-23T03:00:00Z')),'2026-10-23');
  const r=await executarFerramenta(sql,'minhas_demandas',{periodo:'hoje'},{pessoaId:1,agora:new Date('2026-10-23T15:00:00Z')});
  assert.deepEqual(r.itens.map(x=>x.id),['100']);
  await assert.rejects(()=>executarFerramenta(sql,'minhas_demandas',{periodo:'hoje',responsavel_id:2},{pessoaId:1}));
  await assert.rejects(()=>executarFerramenta(sql,'minhas_demandas',{}));
  await db.exec("INSERT INTO vybe_conteudos(id,titulo,formato,prazo,veiculacao,atualizado_em,status_chave,board_id,removido_em,briefing) VALUES(400,'Sem prazo','Vídeo',NULL,'2026-10-23',now(),'agendado',7829537690,NULL,'NAO_EXPOR');INSERT INTO vybe_conteudo_responsaveis VALUES(400,1)");
  const semPrazo=await executarFerramenta(sql,'minhas_demandas',{periodo:'hoje'},{pessoaId:1,agora:new Date('2026-10-23T15:00:00Z')});
  assert.deepEqual(semPrazo.itens.map(x=>x.id),['100','400']);
  await db.exec('DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=400;DELETE FROM vybe_conteudos WHERE id=400');
 });
 await t.test('pendentes e atrasadas seguem status oficial, prazo e identidade, sem aproximação textual',async()=>{
  await db.exec(`INSERT INTO vybe_status VALUES(8385559107,'terminou','Qualquer rótulo',true);
   INSERT INTO vybe_conteudos(id,titulo,formato,prazo,veiculacao,atualizado_em,status_chave,board_id,removido_em,briefing) VALUES
   (401,'Vencida','Card','2026-10-22',NULL,now(),'agendado',8385559107,NULL,NULL),
   (402,'Concluída vencida','Card','2026-10-22',NULL,now(),'terminou',8385559107,NULL,NULL),
   (403,'Sem prazo','Card',NULL,'2026-10-22',now(),'agendado',8385559107,NULL,NULL),
   (404,'Status desconhecido','Card','2026-10-22',NULL,now(),'desconhecido',8385559107,NULL,NULL),
   (405,'Vencida de outra pessoa','Card','2026-10-22',NULL,now(),'agendado',8385559107,NULL,NULL);
   INSERT INTO vybe_conteudo_responsaveis VALUES(401,1),(402,1),(403,1),(404,1),(405,2);`);
  const identidade={pessoaId:1,agora:new Date('2026-10-23T15:00:00Z')};
  const consultar=args=>executarFerramenta(sql,'minhas_demandas',args,identidade);
  assert.deepEqual((await consultar({situacao:'atrasadas'})).itens.map(x=>x.id),['401']);
  assert.deepEqual((await consultar({situacao:'pendentes'})).itens.map(x=>x.id),['401','100','403']);
  assert.deepEqual((await consultar({situacao:'pendentes',periodo:'hoje'})).itens.map(x=>x.id),['100']);
  assert.deepEqual((await consultar({situacao:'atrasadas',periodo:'hoje'})).itens,[]);
  assert.deepEqual((await consultar({situacao:'pendentes',limite:1,deslocamento:1})).itens.map(x=>x.id),['100']);
  await assert.rejects(()=>consultar({situacao:'concluida OR true'}));
  await db.exec('DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id>=401;DELETE FROM vybe_conteudos WHERE id>=401');
 });
 await t.test('ficha ampla permite briefing, comentários, arquivos e tarefas de qualquer responsável sem segredos',async()=>{
  await db.exec(`CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,de text,para text,texto text,autor_id bigint,monday_log_id text);
   CREATE TABLE vybe_conteudo_updates(id bigint,conteudo_id bigint,corpo text,autor text,criado_em timestamptz,editado_em timestamptz,monday_update_id text);
   CREATE TABLE vybe_conteudo_arquivos(id bigint,conteudo_id bigint,nome text,extensao text,tamanho_bytes bigint,criado_em timestamptz,ausente_em timestamptz);
   CREATE TABLE vybe_subitens(id bigint,pai_id bigint,titulo text,prazo date,conclusao date,tipo text,prioridade text,status_chave text,ordem int);
   CREATE TABLE vybe_subitem_responsaveis(subitem_id bigint,pessoa_id bigint);
   UPDATE vybe_conteudos SET briefing='Briefing operacional: criar campanha. senha=NAO_EXPOR' WHERE id=200;
   INSERT INTO vybe_conteudo_updates VALUES(1,200,'<p>Ajustar a chamada. token=NAO_EXPOR</p>','Pessoa B',now(),NULL,NULL);
   INSERT INTO vybe_conteudo_arquivos VALUES(1,200,'Arte aprovada','png',123,now(),NULL);
   INSERT INTO vybe_subitens VALUES(1,200,'Revisar texto',NULL,NULL,'Card','Alta','agendado',0);
   INSERT INTO vybe_subitem_responsaveis VALUES(1,2);`);
  for(const secao of ['ficha','comentarios','arquivos','tarefas']){
   const r=await executarFerramenta(sql,'detalhar_demanda',{id:200,secao},{pessoaId:1});
   assert.equal(r.itens.length,1);assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));assert.equal(r.fontes[0].id,'200');
  }
  const ficha=await executarFerramenta(sql,'detalhar_demanda',{id:200});assert.match(ficha.itens[0].briefing.texto,/Briefing operacional/);
  const fora=await executarFerramenta(sql,'detalhar_demanda',{id:200,secao:'comentarios',deslocamento:1});assert.equal(fora.itens.length,0);
  await assert.rejects(()=>executarFerramenta(sql,'detalhar_demanda',{id:200,secao:'senha_hash'}));
  // No source failure may masquerade as an empty history.
  await assert.rejects(()=>executarFerramenta(sql,'detalhar_demanda',{id:200,secao:'historico'}));
 });
 await t.test('finalizadas_hoje: status final cujo último evento de status foi hoje, no fuso Bahia',async()=>{
  await db.exec(`CREATE FUNCTION vybe_dia_bahia(timestamptz) RETURNS date LANGUAGE sql AS $$ SELECT ($1 AT TIME ZONE 'America/Bahia')::date $$;
   INSERT INTO vybe_status VALUES(7829537690,'final','Finalizado',true);
   INSERT INTO vybe_conteudos(id,titulo,formato,prazo,veiculacao,atualizado_em,status_chave,board_id,removido_em,briefing) VALUES
   (501,'Pronta hoje','Card','2026-10-26','2026-10-26',now(),'final',7829537690,NULL,NULL),
   (502,'Pronta ontem','Card','2026-10-25','2026-10-26',now(),'final',7829537690,NULL,NULL),
   (503,'Mexida hoje, mas aberta','Card','2026-10-26','2026-10-26',now(),'agendado',7829537690,NULL,NULL);
   INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,em) VALUES(501,'status','2026-10-25T20:00:00Z'),(501,'status','2026-10-26T13:00:00Z'),
   (502,'status','2026-10-26T02:30:00Z'),(503,'status','2026-10-26T14:00:00Z');`);
  // 502: 02:30Z ainda é 25/10 na Bahia (UTC-3).
  const r=await executarFerramenta(sql,'buscar_demandas',{situacao:'finalizadas_hoje'},{agora:new Date('2026-10-26T20:00:00Z')});
  assert.deepEqual(r.itens.map(x=>x.id),['501']);
  assert.equal(r.itens[0].execucao,undefined); // Sem a tabela de fatias, só não informa quem executou.
  await db.exec(`CREATE TABLE vybe_escritorio_moedas(id bigserial,pessoa_id bigint,origem text,quantidade int,pontos int,regra text,conteudo_id bigint);
   INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,regra,conteudo_id) VALUES(2,'a',3,'peca_agendamento',501),(1,'b',10,'peca_criacao',501),(1,'c',4,'chegada',501),(2,'d',-3,'peca_atendimento',501)`);
  const comFatias=await executarFerramenta(sql,'buscar_demandas',{situacao:'finalizadas_hoje'},{agora:new Date('2026-10-26T20:00:00Z')});
  assert.deepEqual(comFatias.itens[0].execucao,[{papel:'criacao',nome:'Pessoa A'},{papel:'agendamento',nome:'Pessoa B'}]);
  await db.exec('DROP TABLE vybe_escritorio_moedas');
  await assert.rejects(()=>executarFerramenta(sql,'minhas_demandas',{situacao:'finalizadas_hoje'},{pessoaId:1}));
  await db.exec('DELETE FROM vybe_conteudo_eventos WHERE conteudo_id>=501;DELETE FROM vybe_conteudos WHERE id>=501');
 });
 await t.test('projeções não incluem emails, credenciais, notas, links ou documentos',async()=>{
  for(const [nome,args]of [['listar_clientes',{}],['listar_responsaveis',{}],['listar_planejamentos',{}],['detalhar_planejamento',{id:5}],['listar_captacoes',{}],['listar_roteiros',{}]]){
   const r=await executarFerramenta(sql,nome,args);assert.ok(r.itens.length);assert.ok(!JSON.stringify(r).includes('NAO_EXPOR'));assert.ok(!JSON.stringify(r).includes('example.com'));if(nome!=='detalhar_planejamento')assert.ok(!JSON.stringify(r).includes('privado'));
  }
 });
 await t.test('endpoint fornece ferramentas e executa consulta ampla, sem confiar em admin/pessoa_id',async()=>{
  const res=()=>({status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
  const req={method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{jid,contexto:contexto(),consulta:'operacional',ferramenta:'buscar_demandas',argumentos:{},pessoa_id:999,admin:true}};
  let r=res();await atenderBotAssistente(req,r,()=>sql,config);assert.equal(r.codigo,200);assert.equal(r.corpo.itens.length,2);
  r=res();await atenderBotAssistente({...req,body:{...req.body,consulta:'autorizar_contexto'}},r,()=>sql,config);assert.equal(r.codigo,200);assert.equal(r.corpo.max_ferramentas,3);
 });
 await t.test('endpoint pessoal permite administrador privado, bloqueia grupo e recusa IDs do modelo',async()=>{
  const res=()=>({status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}});
  for(const grupoAtivo of [false,true]){
   const corpo={jid,contexto:contexto(grupoAtivo),consulta:'operacional',ferramenta:'minhas_demandas',argumentos:{periodo:'todas'},pessoa_id:2,admin:true};
   let r=res();await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:corpo},r,()=>sql,config);
   if(grupoAtivo){assert.equal(r.codigo,403);continue;}
   assert.equal(r.codigo,200);assert.deepEqual(r.corpo.itens.map(x=>x.id),['100']);
   for(const manipulacao of [{responsavel_id:2},{pessoa_id:2},{id:200},{sql:'SELECT *'},{agora:'2026-10-25'}]){
    r=res();await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+config.VYBE_AI_BOT_TOKEN},body:{...corpo,argumentos:{periodo:'hoje',...manipulacao}}},r,()=>sql,config);assert.equal(r.codigo,400);
   }
  }
 });
 await t.test('elegibilidade automática não usa whitelist e bloqueia ativos sem vínculo/grupo',async()=>{
  for(const antiga of [undefined,'','999','*'])assert.equal(await autorizarConversa(sql,jid,contexto(),segredo,{...config,VYBE_AI_PESSOAS_LIBERADAS:antiga}),1);
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

test('novas ferramentas mantêm contrato fechado e autenticação antes de consultar fontes',async()=>{
 const nomes=['consultar_perfil_trabalho','consultar_perfil_jogo','consultar_ranking','consultar_dia_equipe'];
 for(const ferramenta of nomes){
  const r={status(n){this.codigo=n;return this},json(b){this.corpo=b;return this}};
  await atenderBotAssistente({method:'POST',headers:{authorization:'Bearer '+'B'.repeat(64)},body:{consulta:'operacional',ferramenta,argumentos:{}}},r,()=>{throw Error('Não consultar banco');},config);
  assert.equal(r.codigo,401);
 }
 for(const a of [{pessoa_id:1,de:'2026-01-01',ate:'2026-12-31'},{pessoa_id:1,de:'2026-10-01',ate:'2026-10-20',sql:'SELECT *'}])assert.throws(()=>validarFerramenta('consultar_perfil_trabalho',a));
 assert.throws(()=>validarFerramenta('consultar_metricas_trafego',{cliente_id:10,de:'2026-10-01',ate:'2026-10-20',url:'https://outro'}));
 assert.doesNotThrow(()=>validarFerramenta('consultar_metricas_trafego',{cliente_id:10,de:'2026-10-01',ate:'2026-10-20',modulo:'faturamento'}));
});

test('agenda de gravações: sem a conta do Google, responde indisponível (503) sem expor detalhes',async()=>{
 const {executarFerramenta:executar}=await import('../server/assistente-ferramentas.js');
 const antes=process.env.GOOGLE_SERVICE_ACCOUNT;delete process.env.GOOGLE_SERVICE_ACCOUNT;
 const sqlFalso=async()=>[];
 try{await assert.rejects(()=>executar(sqlFalso,'consultar_agenda_captacoes',{dias:1}),e=>e.status===503&&/Google|agenda/i.test(e.message));
  await assert.rejects(()=>executar(sqlFalso,'consultar_agenda_captacoes',{dias:30}));}
 finally{if(antes!==undefined)process.env.GOOGLE_SERVICE_ACCOUNT=antes;}
});

test('ponte do Hub: slug automático igual ao do Hub e só o Hub de Production ou Preview autorizado',async()=>{
 const {slugDoHub,metricasDoHub:metricas}=await import('../server/assistente-hub.js');
 assert.equal(slugDoHub('Brussolo Ristorante'),'brussolo-ristorante');assert.equal(slugDoHub('Copirecê'),'copirece');assert.equal(slugDoHub('Academia Lions'),'academia-lions');
 const sqlCli=async()=>[{id:'7',nome:'Hebravet'}];
 const base={VYBE_AI_HUB_ATIVO:'1',VYBE_AI_HUB_CLIENTES:'auto',VYBE_OS_METRICAS_TOKEN:'T'.repeat(64)};
 let pedido;const buscar=async u=>{pedido=u;throw new Error('rede');};
 await assert.rejects(()=>metricas(sqlCli,{cliente_id:7,de:'2026-10-01',ate:'2026-10-26'},{config:{...base,VYBE_AI_HUB_URL:'https://vybehub.vercel.app'},buscar}));
 assert.match(decodeURIComponent(pedido),/^https:\/\/vybehub\.vercel\.app\/api\/trpc\/portal\.metricasOperacionais\?input=.*"slug":"hebravet","cliente_nome":"Hebravet"/);
 for(const url of ['https://evil.vercel.app','https://vybehub-git-main-vybe-hub.vercel.app','http://vybehub.vercel.app'])
  await assert.rejects(()=>metricas(sqlCli,{cliente_id:7,de:'2026-10-01',ate:'2026-10-26'},{config:{...base,VYBE_AI_HUB_URL:url},buscar:async()=>{throw new Error('não deveria chamar');}}),/Production ou um Preview/);
});

test('dia da agência e meu dia aceitam amanhã (data do dia seguinte, sem dizer "hoje")',()=>{
 assert.doesNotThrow(()=>validarFerramenta('consultar_dia_agencia',{quando:'amanha'}));
 assert.doesNotThrow(()=>validarFerramenta('meu_dia',{quando:'hoje'}));
 assert.throws(()=>validarFerramenta('consultar_dia_agencia',{quando:'ontem'}));
});
