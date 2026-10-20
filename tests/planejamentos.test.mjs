// Planejamentos dos clientes (docs/planejamentos-plano.md): o agente publica,
// o head do cliente (ou quem administra) edita e envia, o cliente responde
// pelo link; nada passa por cima do que o cliente está vendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conexao} from './postgres.mjs';
import * as P from '../server/planejamentos.js';
import {documentoHtml} from '../server/planejamento-documento.js';

async function banco(t){
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true);
 INSERT INTO vybe_pessoas VALUES(1,'Paulo',true),(3,'Vinícius',true),(24,'Ewerton',true);
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,email text,responsavel text,segmento text);
 INSERT INTO vybe_clientes(id,nome,email) VALUES(10,'Serra Grande','contato@serra.example'),(11,'Mangaba',NULL),(12,'Mangaba Kids',NULL);
 CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
 INSERT INTO vybe_cliente_pessoas VALUES(10,3,0),(11,24,0);
 CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,status_chave text,prazo date,briefing text,removido_em timestamptz,monday_item_id text);
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean DEFAULT false);
 CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
 CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0);`);
 return {db,sql};
}
const conteudo={resumo:'Novembro com presença constante',pecas:[{data:'2026-11-03',formato:'card',tema:'Finados',legenda:'Respeito à data'},{data:'2026-11-20',formato:'Carrossel',tema:'Consciência Negra'}]};

test('agente publica, head edita e envia, cliente aprova pelo link',async t=>{
 const {db,sql}=await banco(t);
 await assert.rejects(P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo}),/migração/);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await assert.rejects(P.publicarDoAgente(sql,{cliente:'Mangab',mes:'2026-11',conteudo}),/Mais de um cliente/);
 await assert.rejects(P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'novembro',conteudo}),/AAAA-MM/);
 const p=await P.publicarDoAgente(sql,{cliente:'serra grande',mes:'2026-11',titulo:'Novembro forte',conteudo});
 assert.equal(p.novo,true);assert.equal(p.estado,'revisar');assert.equal(p.conteudo.pecas[0].formato,'Card');
 const v2=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo});
 assert.equal(v2.novo,false);assert.equal(v2.versao,2,'publicar de novo no mesmo mês vira nova versão');
 // Aviso para o head: Vinícius vê; Ewerton não (não é head da Serra Grande); Paulo (admin) vê.
 assert.equal((await P.pendentesDoHead(sql,{id:3})).length,1);
 assert.equal((await P.pendentesDoHead(sql,{id:24})).length,0);
 assert.equal((await P.pendentesDoHead(sql,{id:1,admin:true})).length,1);
 await assert.rejects(P.editarPlanejamento(sql,{id:24},{id:p.id,versao:2,conteudo}),/Só o head/);
 await assert.rejects(P.editarPlanejamento(sql,{id:3},{id:p.id,versao:1,conteudo}),/outra versão/);
 const e=await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:2,titulo:'Novembro revisado',conteudo:{...conteudo,resumo:'Revisado pelo head'}});
 assert.equal(e.versao,3);assert.equal(e.titulo,'Novembro revisado');
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 assert.ok(env.token.length>=30);assert.equal(env.estado,'enviado');assert.equal(env.link_hash,undefined,'o hash não sai do servidor');
 await assert.rejects(P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo}),/com o cliente/,'o agente não sobrescreve o que o cliente está vendo');
 const visto=await P.planejamentoDoLink(sql,env.token);assert.equal(visto.cliente,'Serra Grande');
 assert.match(documentoHtml(visto,{paraCliente:true,token:env.token}),/Aprovar planejamento/);
 await assert.rejects(P.responderDoCliente(sql,env.token,{acao:'ajustes',nome:'Ana'}),/o que precisa mudar/);
 const r=await P.responderDoCliente(sql,env.token,{acao:'aprovar',nome:'Ana'});
 assert.equal(r.estado,'aprovado');
 assert.equal((await P.responderDoCliente(sql,env.token,{acao:'ajustes',nome:'Ana',texto:'x'})).repetido,true,'responder de novo não muda');
 const c=await P.mudarEstadoInterno(sql,{id:3},{id:p.id,estado:'cadastrado'});assert.equal(c.estado,'cadastrado');
 const ev=(await P.detalhePlanejamento(sql,{id:3},p.id)).eventos.map(x=>x.tipo);
 assert.deepEqual(ev.reverse(),['publicado','nova_versao','editado','enviado','aprovado','cadastrado']);
});
test('editar depois de enviado invalida o link e volta para revisão; ajustes voltam ao head',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.criarNoPainel(sql,{id:24},{clienteId:11,mes:'2026-12',conteudo});
 const env=await P.enviarAoCliente(sql,{id:24},{id:p.id});
 await P.editarPlanejamento(sql,{id:24},{id:p.id,versao:env.versao,conteudo});
 await assert.rejects(P.planejamentoDoLink(sql,env.token),/não vale mais/);
 const env2=await P.enviarAoCliente(sql,{id:24},{id:p.id});
 const r=await P.responderDoCliente(sql,env2.token,{acao:'ajustes',nome:'João',texto:'Troquem a foto do dia 3'});
 assert.equal(r.estado,'ajustes');assert.equal((await P.pendentesDoHead(sql,{id:24})).length,1);
 await assert.rejects(P.criarNoPainel(sql,{id:3},{clienteId:11,mes:'2026-12',conteudo}),/Só o head/);
});
function resposta(){const r={codigo:0,corpo:null,cab:{},status(c){this.codigo=c;return this;},json(b){this.corpo=b;return this;},send(b){this.corpo=b;return this;},end(){return this;},setHeader(k,v){this.cab[k]=v;}};return r;}
test('conector dos agentes (MCP): chave, ferramentas e publicação; página do cliente aprova',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const {conectorAgentes,paginaDeAprovacao}=await import('../server/planejamentos-api.js');
 process.env.AGENTES_CHAVE='chave-de-teste-com-mais-de-24-caracteres';t.after(()=>delete process.env.AGENTES_CHAVE);
 let r=resposta();await conectorAgentes({method:'POST',query:{chave:'errada'},body:{}},r,sql);assert.equal(r.codigo,401);
 const rpc=async(method,params,id=1)=>{const r=resposta();await conectorAgentes({method:'POST',query:{chave:process.env.AGENTES_CHAVE},body:{jsonrpc:'2.0',id,method,params}},r,sql);return r;};
 assert.equal((await rpc('initialize',{protocolVersion:'2025-06-18'})).corpo.result.serverInfo.name,'painel-vybe');
 assert.ok((await rpc('tools/list')).corpo.result.tools.some(f=>f.name==='publicar_planejamento'));
 const pub=(await rpc('tools/call',{name:'publicar_planejamento',arguments:{cliente:'Serra Grande',mes:'2026-11',conteudo}})).corpo.result;
 assert.match(pub.content[0].text,/Publicado: Serra Grande, novembro de 2026, 2 peças/);
 const erro=(await rpc('tools/call',{name:'publicar_planejamento',arguments:{cliente:'Ninguém',mes:'2026-11',conteudo}})).corpo.result;
 assert.equal(erro.isError,true);assert.match(erro.content[0].text,/não encontrado/);
 const [p]=await sql`SELECT id FROM vybe_planejamentos`;
 const env=await P.enviarAoCliente(sql,{id:3},{id:String(p.id)});
 r=resposta();await paginaDeAprovacao({method:'GET',query:{t:env.token}},r,sql);
 assert.equal(r.codigo,200);assert.match(r.corpo,/Aprovar planejamento/);assert.match(r.corpo,/Finados/);
 r=resposta();await paginaDeAprovacao({method:'POST',query:{t:env.token},body:'acao=aprovar&nome=Ana'},r,sql);
 assert.match(r.corpo,/Aprovado por Ana/);
 assert.match((await rpc('tools/call',{name:'ver_planejamento',arguments:{cliente:'Serra Grande',mes:'2026-11'}})).corpo.result.content[0].text,/aprovado/);
 r=resposta();await paginaDeAprovacao({method:'GET',query:{t:'x'.repeat(30)}},r,sql);assert.equal(r.codigo,404);
});
test('Centro de Operação: um agente por cliente ativo, com planejamento primeiro e marca do head',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await db.exec(`UPDATE vybe_clientes SET ativo=false WHERE id=12`);
 await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo});
 const postos=await P.postosDaOperacao(sql,{id:3});
 assert.deepEqual(postos.map(p=>p.cliente),['Serra Grande','Mangaba'],'cliente inativo fica fora; quem tem planejamento vem primeiro');
 assert.equal(postos[0].meu,true);assert.equal(postos[0].segmento,null);assert.equal(postos[0].planejamento.estado,'revisar');
 assert.equal(postos[1].meu,false);assert.equal(postos[1].planejamento,null);
});
test('Centro de Operação: a cena tem um posto por mesa, sentado, e a zona vale no servidor, no Worker e no banco',async()=>{
 const {default:operacao}=await import('../scripts/cenas/operacao.mjs');
 const r=operacao();
 assert.deepEqual(r.erros,[]);
 const postos=r.figurantes.filter(f=>f.posto!==undefined);
 assert.equal(postos.length,16);assert.ok(postos.every(f=>f.acao==='sit'));
 assert.deepEqual(postos.map(f=>f.posto),[...Array(16).keys()]);
 for(const arq of ['server/escritorio-social.js','services/escritorio/worker.js','server/escritorio-mapa.js','server/escritorio.js','migrations/2026-10-20-planejamentos.sql'])assert.match(readFileSync(arq,'utf8'),/operacao/,arq);
});

test('alertas dos agentes: sem informação, muito atrasadas e para aprovar, por cliente; o head vê só os dele',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await db.exec(`INSERT INTO vybe_status VALUES(7829537690,'pode_fazer','Pode Fazer',false),(7829537690,'para_aprovacao','Para aprovação',false),(7829537690,'finalizado','Finalizado',true),(7829537690,'falta_info','Falta Info',false);
  INSERT INTO vybe_conteudos(id,board_id,titulo,status_chave,prazo,briefing) VALUES
   (1,7829537690,'Atrasada demais','pode_fazer','2026-10-10','ok'),
   (2,7829537690,'Atrasada só ontem','pode_fazer','2026-10-19','ok'),
   (3,7829537690,'Esperando aprovação','para_aprovacao','2026-10-25','ok'),
   (4,7829537690,'Sem briefing','pode_fazer','2026-10-25',''),
   (5,7829537690,'Falta info','falta_info','2026-10-25','ok'),
   (6,7829537690,'Finalizada atrasada','finalizado','2026-10-01',''),
   (7,7829537690,'De dois clientes','para_aprovacao','2026-10-25','ok');
  INSERT INTO vybe_conteudo_clientes VALUES(1,10),(2,10),(3,10),(4,10),(5,10),(6,10),(7,10),(7,11);
  INSERT INTO vybe_conteudo_responsaveis VALUES(1,3),(2,3),(3,3),(4,3),(6,3),(7,3);`);
 const {alertasDosClientes}=await import('../server/alertas-clientes.js');
 const a=(await alertasDosClientes(sql,{agora:new Date('2026-10-20T15:00:00Z')})).get('10');
 assert.deepEqual(a.atrasadas.map(x=>x.titulo),['Atrasada demais'],'só mais de 2 dias; finalizada não conta');
 assert.deepEqual(a.aprovar.map(x=>x.titulo).sort(),['De dois clientes','Esperando aprovação']);
 assert.deepEqual(a.sem_info.map(x=>x.titulo).sort(),['Falta info','Sem briefing']);
 assert.match(a.sem_info.find(x=>x.titulo==='Falta info').motivo,/Falta Info.*sem responsável/);
 assert.equal(a.total,5);
 // Peça de dois clientes aparece nos dois.
 assert.equal((await alertasDosClientes(sql)).get('11').aprovar.length,1);
 // Vinícius é head só da Serra Grande (10); Ewerton, da Mangaba (11).
 assert.deepEqual((await P.alertasDoHead(sql,{id:3})).map(x=>x.cliente),['Serra Grande']);
 assert.deepEqual((await P.alertasDoHead(sql,{id:24})).map(x=>x.cliente),['Mangaba']);
 assert.equal((await P.postosDaOperacao(sql,{id:3}))[0].alertas.total>0,true);
});

// Avatar do agente do cliente (Paulo, 20/10/2026): head e quem administra
// editam; fica na identidade do cliente; salvar as cores não o apaga.
test('avatar do agente: permissão, validação, identidade preservada e volta ao padrão',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const {areaPlanejamentos}=await import('../server/planejamentos-api.js');
 const chamar=async(pessoa,corpo)=>{let st=0,js=null;const res={status(c){st=c;return this},json(j){js=j;return this},setHeader(){}};await areaPlanejamentos({method:'POST',query:{acao:corpo.acao},body:corpo},res,{pessoa},sql);return [st,js];};
 const fig='hd-600-1370.hr-3870-61.ch-4275-1411';
 assert.equal((await chamar({id:24},{acao:'personagem',cliente_id:10,figura:fig}))[0],403,'quem não é head nem administra não muda');
 assert.equal((await chamar({id:3},{acao:'personagem',cliente_id:10,figura:'<script>'}))[0],400);
 assert.equal((await chamar({id:3},{acao:'personagem',cliente_id:10,figura:fig,mao:'crr=73'}))[0],200,'o head muda');
 await chamar({id:1,admin:true},{acao:'identidade',cliente_id:10,cor:'#ff8800'});
 const [c]=await sql`SELECT identidade FROM vybe_clientes WHERE id=10`;
 assert.equal(c.identidade.cor,'#ff8800');assert.deepEqual(c.identidade.personagem,{figura:fig,mao:'crr=73'},'cores salvas sem apagar o avatar');
 assert.deepEqual((await P.postosDaOperacao(sql,{id:3})).find(p=>p.cliente==='Serra Grande').personagem,{figura:fig,mao:'crr=73'});
 await chamar({id:3},{acao:'personagem',cliente_id:10,figura:''});
 const [d]=await sql`SELECT identidade FROM vybe_clientes WHERE id=10`;
 assert.equal(d.identidade.personagem,undefined,'vazio volta à fantasia padrão');assert.equal(d.identidade.cor,'#ff8800');
});

// Paulo, 20/10/2026: aprovado pelo cliente, um botão cadastra cada peça.
test('prazo da peça: Prazo de Ouro, senão hoje, nunca a menos de 2 dias; fim de semana volta para a sexta',()=>{
 assert.equal(P.prazoDaPeca('2026-11-20','2026-10-20'),'2026-11-13');
 assert.equal(P.prazoDaPeca('2026-11-23','2026-10-20'),'2026-11-16','segunda: 7 dias antes cai na segunda');
 assert.equal(P.prazoDaPeca('2026-11-22','2026-10-20'),'2026-11-13','domingo → 15/11 é domingo → sexta 13/11');
 assert.equal(P.prazoDaPeca('2026-10-24','2026-10-20'),'2026-10-20','já passou o ouro: hoje');
 assert.equal(P.prazoDaPeca('2026-10-21','2026-10-20'),'2026-10-19','a menos de 2 dias: fica 2 dias antes (atrasada de verdade)');
});
test('cadastrar as peças aprovadas cria todas numa transação, com regra do formato, e não duplica',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await db.exec(`ALTER TABLE vybe_pessoas ADD COLUMN email text, ADD COLUMN monday_user_id text;
 UPDATE vybe_pessoas SET monday_user_id=id::text;
 INSERT INTO vybe_pessoas(id,nome,monday_user_id) VALUES(51,'Deivid','51'),(52,'Bia','52'),(53,'Jady','53');
 DROP TABLE vybe_conteudos CASCADE; DROP TABLE vybe_status;
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int);
 INSERT INTO vybe_status VALUES(7829537690,'pode_fazer','Pode Fazer',1),(7829537690,'a_fazer','A Fazer',0),(8385559107,'nova_demanda','Nova Demanda',0);
 CREATE TABLE vybe_conteudos(id bigserial PRIMARY KEY,board_id bigint,titulo text,formato text,formato_chaves text[],tipo_conteudo_chaves text[],clientes_texto text,status_chave text,etapa text,grupo_id text,prazo date,veiculacao date,briefing text,prioridade text,status_em timestamptz,captacao text,removido_em timestamptz);
 CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text);
 CREATE TABLE vybe_opcoes(coluna_id text,chave text,rotulo text,indice int);
 ALTER TABLE vybe_conteudo_responsaveis ADD PRIMARY KEY(conteudo_id,pessoa_id);
 -- Histórico: Bia fez as peças da Serra Grande.
 INSERT INTO vybe_conteudos(id,board_id,titulo,veiculacao) VALUES(900,7829537690,'Card - antigo',CURRENT_DATE - 10),(901,7829537690,'Card - antigo 2',CURRENT_DATE - 20);
 INSERT INTO vybe_conteudo_clientes VALUES(900,10),(901,10);
 INSERT INTO vybe_conteudo_responsaveis VALUES(900,52,0),(901,52,0),(901,51,1);
 SELECT setval('vybe_conteudos_id_seq', 1000);`);
 const pecas=[{data:'2026-11-20',formato:'Card',tema:'Consciência',legenda:'Texto do card'},{data:'2026-11-25',formato:'Reels',tema:'Bastidores',legenda:'Roteiro'},{data:'2026-11-26',formato:'Outro',tema:'Panfleto'}];
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas}});
 const destinos={Card:{grupo_id:'novo_grupo__1',status:'pode_fazer',responsaveis:['51','52','53']},Reels:{grupo_id:'novo_grupo57911__1',status:'a_fazer',captacao:'Agendar Captação',responsaveis:[]}};
 const vini={tipo:'sessao',pessoa:{id:3}};
 await assert.rejects(P.cadastrarPecas(sql,vini,{id:p.id,versao:p.versao,destinos}),/depois que o cliente aprovar/);
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 await P.responderDoCliente(sql,env.token,{acao:'aprovar',nome:'Ana'});
 const atual=await P.detalhePlanejamento(sql,{id:3},p.id);
 await assert.rejects(P.cadastrarPecas(sql,{tipo:'sessao',pessoa:{id:24}},{id:p.id,versao:atual.versao,destinos}),/Só o head/);
 // Falha no meio: nenhuma demanda fica.
 await db.exec(`ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK (para NOT LIKE 'Avulso%')`);
 await assert.rejects(P.cadastrarPecas(sql,vini,{id:p.id,versao:atual.versao,destinos}));
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_conteudos WHERE id>1000`)[0].n,0,'tudo ou nada');
 await db.exec(`ALTER TABLE vybe_conteudo_eventos DROP CONSTRAINT falha`);
 const r=await P.cadastrarPecas(sql,vini,{id:p.id,versao:atual.versao,destinos});
 assert.equal(r.criadas.length,3);assert.equal(r.planejamento.estado,'cadastrado');
 const linhas=await sql`SELECT c.titulo,c.board_id::text AS board,c.status_chave,c.grupo_id,c.captacao,TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veic,c.briefing,
  ARRAY(SELECT pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id ORDER BY 1) AS resp FROM vybe_conteudos c WHERE id>1000 ORDER BY id`;
 assert.deepEqual(linhas.map(l=>[l.titulo,l.board,l.status_chave,l.veic]),[['Card - Consciência','7829537690','pode_fazer','2026-11-20'],['Reels - Bastidores','7829537690','a_fazer','2026-11-25'],['Avulso - Panfleto','8385559107','nova_demanda','2026-11-26']]);
 assert.deepEqual(linhas[0].resp,['52'],'card vai para quem mais fez peças do cliente (Bia)');
 assert.equal(linhas[1].captacao,'Agendar Captação');assert.deepEqual(linhas[1].resp,[]);
 assert.deepEqual(linhas[2].resp,[],'solicitação entra sem responsável, para triagem');
 assert.match(linhas[0].briefing,/Texto do card/);
 const salvo=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.ok(salvo.conteudo.pecas.every(x=>/^\d+$/.test(x.conteudo_id)),'cada peça guarda a demanda criada');
 await assert.rejects(P.cadastrarPecas(sql,vini,{id:p.id,versao:salvo.versao,destinos}),/já foram cadastradas/);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_conteudos WHERE id>1000`)[0].n,3,'clicar de novo não duplica');
});
