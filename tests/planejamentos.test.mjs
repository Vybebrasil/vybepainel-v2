// Planejamentos dos clientes (docs/planejamentos-plano.md): o agente publica,
// o head do cliente (ou quem administra) edita e envia, o cliente responde
// pelo link; nada passa por cima do que o cliente está vendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {generateKeyPairSync} from 'node:crypto';
import {conexao} from './postgres.mjs';
import * as P from '../server/planejamentos.js';
import {documentoHtml} from '../server/planejamento-documento.js';

async function banco(t){
 const {db,sql}=conexao();t.after(()=>db.close());
 await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true);
 INSERT INTO vybe_pessoas VALUES(1,'Paulo',true),(3,'Vinícius',true),(24,'Ewerton',true);
 CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,email text,responsavel text,segmento text); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
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
   (3,7829537690,'Esperando aprovação','ag_aprovacao_cliente','2026-10-25','ok'),
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
 assert.equal(a.aprovar_interna_total,1,'Para aprovação é interna');assert.equal(a.aprovar_cliente_total,1,'Ag. Aprovação Cliente conta à parte');
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
 CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,final boolean DEFAULT false);
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
 const pecas=[{data:'2026-11-20',prazo:'2026-11-10',formato:'Card',tema:'Consciência',legenda:'Texto do card',linha:'Datas',objetivo:'Lembrar a data',telas:['Título do card','Assinatura']},{data:'2026-11-25',formato:'Reels',tema:'Bastidores',legenda:'Roteiro',objetivo:'Mostrar o time'},{data:'2026-11-26',formato:'Outro',tema:'Panfleto'}];
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
 const linhas=await sql`SELECT c.titulo,c.board_id::text AS board,c.status_chave,c.grupo_id,c.captacao,TO_CHAR(c.veiculacao,'YYYY-MM-DD') AS veic,TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo,c.briefing,
  ARRAY(SELECT pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id ORDER BY 1) AS resp FROM vybe_conteudos c WHERE id>1000 ORDER BY id`;
 assert.deepEqual(linhas.map(l=>[l.titulo,l.board,l.status_chave,l.veic]),[['Card - Consciência','7829537690','pode_fazer','2026-11-20'],['Reels - Bastidores','7829537690','a_fazer','2026-11-25'],['Avulso - Panfleto','8385559107','nova_demanda','2026-11-26']]);
 assert.deepEqual(linhas[0].resp,['52'],'card vai para quem mais fez peças do cliente (Bia)');
 assert.equal(linhas[1].captacao,'Agendar Captação');assert.deepEqual(linhas[1].resp,[]);
 assert.deepEqual(linhas[2].resp,[],'solicitação entra sem responsável, para triagem');
 assert.match(linhas[0].briefing,/Texto do card/);
 assert.equal(linhas[0].prazo,'2026-11-10','o prazo escolhido pelo head chega à demanda');
 const [{hoje}]=await sql`SELECT (now() AT TIME ZONE 'America/Bahia')::date::text AS hoje`;
 assert.equal(linhas[1].prazo,P.prazoDaPeca('2026-11-25',hoje),'sem escolha mantém o Prazo de Ouro');
 const salvo=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.ok(salvo.conteudo.pecas.every(x=>/^\d+$/.test(x.conteudo_id)),'cada peça guarda a demanda criada');
 await assert.rejects(P.cadastrarPecas(sql,vini,{id:p.id,versao:salvo.versao,destinos}),/já foram cadastradas/);
 assert.equal((await sql`SELECT count(*)::int n FROM vybe_conteudos WHERE id>1000`)[0].n,3,'clicar de novo não duplica');
 // Paulo, 09/11/2026: "só cadastrou metade do conteúdo". A peça inteira chega à demanda.
 for(const s of ['Linha: Datas','Objetivo: Lembrar a data','Texto da arte:\n1. Título do card\n2. Assinatura'])assert.ok(linhas[0].briefing.includes(s),s);
 assert.match(linhas[1].briefing,/Objetivo: Mostrar o time/);
 // Demandas cadastradas antes da correção: a 1ª ainda como o cadastro antigo deixou, a 2ª o time reescreveu.
 const mes=new Date('2026-11-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
 const ps=salvo.conteudo.pecas;
 await db.exec('ALTER TABLE vybe_conteudos ADD COLUMN IF NOT EXISTS atualizado_em timestamptz'); // existe em produção
 await sql`UPDATE vybe_conteudos SET briefing=${P.briefingAntigoDaPeca(ps[0],mes)} WHERE id=${ps[0].conteudo_id}`;
 await sql`UPDATE vybe_conteudos SET briefing='O time reescreveu' WHERE id=${ps[1].conteudo_id}`;
 await assert.rejects(P.completarBriefings(sql,{tipo:'sessao',pessoa:{id:24}},{id:p.id}),/Só o head/);
 const c=await P.completarBriefings(sql,vini,{id:p.id});
 assert.deepEqual(c.completadas.map(x=>x.conteudo_id),[ps[0].conteudo_id]);
 assert.deepEqual(c.editadas.map(x=>x.conteudo_id),[ps[1].conteudo_id],'editada pelo time não é sobrescrita');
 assert.equal(c.ja_completas,1,'o avulso já estava igual');
 const [d]=await sql`SELECT briefing FROM vybe_conteudos WHERE id=${ps[0].conteudo_id}`;
 assert.equal(d.briefing,P.briefingDaPeca(ps[0],mes));
 const [{n:ev}]=await sql`SELECT count(*)::int n FROM vybe_conteudo_eventos WHERE conteudo_id=${ps[0].conteudo_id} AND tipo='briefing'`;
 assert.equal(ev,1,'fica no histórico da demanda');
 const outra=await P.completarBriefings(sql,vini,{id:p.id});
 assert.deepEqual([outra.completadas.length,outra.ja_completas,outra.editadas.length],[0,2,1],'rodar de novo não muda nada');
 // Consulta do Augusto (planejamento_pecas): só a demanda aberta incompleta ou em Falta Info, com a peça de origem.
 await db.exec("ALTER TABLE vybe_status ADD COLUMN IF NOT EXISTS final boolean DEFAULT false");
 let a=await P.planejamentoPecasParaAgente(sql);
 assert.equal(a.total_ligadas,3);
 assert.deepEqual(a.pecas.map(x=>[x.conteudo_id,x.falta.map(f=>f.campo)]),[[ps[1].conteudo_id,['objetivo','legenda']]],'só a reescrita pelo time ficou sem objetivo e roteiro');
 assert.equal(a.pecas[0].peca_n,2);assert.equal(a.pecas[0].planejamento_id,String(p.id));
 await sql`UPDATE vybe_conteudos SET status_chave='falta_info' WHERE id=${ps[0].conteudo_id}`;
 a=await P.planejamentoPecasParaAgente(sql);
 const fi=a.pecas.find(x=>x.conteudo_id===ps[0].conteudo_id);
 assert.ok(fi&&fi.falta_info&&fi.falta.length===0,'em Falta Info entra mesmo completa, para dizer o que já está lá');
 await sql`INSERT INTO vybe_status VALUES(7829537690,'feito','Feito',9,true)`;
 await sql`UPDATE vybe_conteudos SET status_chave='feito' WHERE id=${ps[1].conteudo_id}`;
 assert.ok(!(await P.planejamentoPecasParaAgente(sql)).pecas.some(x=>x.conteudo_id===ps[1].conteudo_id),'finalizada sai');
 assert.deepEqual(P.faltaNoBriefing({telas:['Capa','Tela dois'],objetivo:'Vender'},'TELAS: 1. capa\nObjetivo: vender'),[{campo:'telas',telas:[{n:2,texto:'Tela dois'}]}]);
});

// Paulo, 20/10/2026: o cliente pede ajuste peça a peça; o texto das telas não é cortado.
test('cliente pede ajuste numa peça: volta ao head com a peça marcada; mandar de novo limpa',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const longo='Tela 1: '+'texto das telas '.repeat(80);
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas:[{data:'2026-11-03',formato:'Carrossel',tema:'01 · Treze',referencia:longo},{data:'2026-11-05',formato:'Reels',tema:'Bastidores'}]}});
 assert.equal(p.conteudo.pecas[0].referencia.length,longo.trim().length,'a referência longa fica inteira');
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 const html=documentoHtml(await P.planejamentoDoLink(sql,env.token),{paraCliente:true,token:env.token});
 assert.match(html,/data-assinatura="[0-9a-f]{12}"/);assert.match(html,/Aprovar esta peça/);assert.doesNotMatch(html,/01 · Treze/,'o número repetido sai do tema');
 // "Aprovar" com uma peça marcada vira pedido de ajustes.
 const r=await P.responderDoCliente(sql,env.token,{acao:'aprovar',nome:'Ana',ajustesPecas:{1:'Trocar a música',9:'peça que não existe'}});
 assert.equal(r.estado,'ajustes');
 const rev=(await P.detalhePlanejamento(sql,{id:3},p.id)).conteudo.pecas;assert.equal(rev[1].revisao_cliente.nota,'Trocar a música');assert.equal(rev[1].revisao_cliente.estado,'ajuste');assert.equal(rev[0].revisao_cliente.estado,'aprovada','aprovar com ajuste numa peça aprova as outras');
 assert.match(r.resposta_texto,/Peça 2 \(Reels, 05\/11 · Bastidores\): Trocar a música/);
 assert.match(documentoHtml({...r,cliente:'Serra Grande'},{paraCliente:true}),/Ajuste pedido/);
 const novo=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 assert.equal((await P.planejamentoDoLink(sql,novo.token)).conteudo.pecas[1].ajuste_cliente,undefined,'o pedido antigo sai da peça; a decisão fica na revisão');
 // A peça que não mudou continua com o pedido; o cliente pode trocar para aprovada, peça por peça.
 const aberto=await P.planejamentoDoLink(sql,novo.token);
 const sig=documentoHtml(aberto,{paraCliente:true,token:novo.token}).match(/data-assinatura="([0-9a-f]{12})" data-estado="ajuste"/)[1];
 await assert.rejects(P.marcarPecaPorLink(sql,novo.token,{assinatura:sig,estado:'ajuste',nome:'Ana'}),/precisa mudar nesta peça/);
 await assert.rejects(P.marcarPecaPorLink(sql,novo.token,{assinatura:sig,estado:'aprovada'}),/seu nome/);
 const resumo=await P.marcarPecaPorLink(sql,novo.token,{assinatura:sig,estado:'aprovada',nome:'Ana'});
 assert.equal(resumo.cliente_aprovadas,2);assert.equal(resumo.cliente_ajustes,0);
 await assert.rejects(P.responderDoCliente(sql,novo.token,{acao:'ajustes',nome:'Ana'}),/o que precisa mudar/);
 const fim=await P.responderDoCliente(sql,novo.token,{acao:'aprovar',nome:'Ana'});assert.equal(fim.estado,'aprovado');
});

// Revisão interna do head, peça a peça; editar a peça tira a decisão dela, e só o servidor grava decisões.
test('head revisa peça a peça; a decisão vale para a versão da peça',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'},{data:'2026-11-05',formato:'Card',tema:'Dois'}]}});
 const d=await P.detalhePlanejamento(sql,{id:3},p.id);
 const [a,b]=d.conteudo.pecas.map(x=>x.assinatura);
 await assert.rejects(P.revisarPecaHead(sql,{id:24},{id:p.id,assinatura:a,estado:'ok'}),/Só o head/);
 await assert.rejects(P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:b,estado:'ajustar'}),/o que ajustar/);
 assert.equal((await P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:a,estado:'ok'})).head_ok,1);
 await P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:b,estado:'ajustar',nota:'Trocar o título'});
 // O pedido de edição tenta forjar uma aprovação do cliente: o servidor ignora.
 const forjado={pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'},{data:'2026-11-05',formato:'Card',tema:'Dois novo'}],revisoes:{[a]:{cliente:{estado:'aprovada',nome:'Falso'}}}};
 const e=await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:d.versao,conteudo:forjado});
 const r=(await P.detalhePlanejamento(sql,{id:3},p.id));
 assert.equal(r.revisao.head_ok,1,'a peça que não mudou continua OK');assert.equal(r.revisao.head_ajustar,0,'a peça editada perde o "ajustar"');
 assert.equal(r.revisao.cliente_aprovadas,0,'aprovação do cliente não entra pelo editor');
 assert.equal(e.versao,d.versao+1);
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 await assert.rejects(P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:a,estado:'ok'}),/antes de mandar/);
 const html=documentoHtml(await P.planejamentoDoLink(sql,env.token),{paraCliente:true,token:env.token});
 assert.doesNotMatch(html,/Trocar o título|revisao_head/,'a revisão interna não vai para o cliente');
});

// Paulo, 20/10/2026: o cliente aprova pelo VybeHub; as regras são as mesmas do link.
test('VybeHub: o cliente só vê o que foi mandado a ele e responde com as mesmas regras',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'},{data:'2026-11-05',formato:'Reels',tema:'Dois'}]}});
 assert.equal((await P.planejamentosDoPortal(sql,{cliente:'Serra Grande'})).planejamentos.length,0,'rascunho do head não aparece');
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 const lista=await P.planejamentosDoPortal(sql,{cliente:'serra grande'});
 assert.equal(lista.planejamentos.length,1);assert.equal(lista.planejamentos[0].estado,'enviado');assert.equal(lista.planejamentos[0].conteudo.pecas.length,2);
 await assert.rejects(P.responderDoPortal(sql,{cliente:'Mangaba Kids',id:p.id,versao:env.versao,acao:'aprovar',nome:'Ana'}),/não encontrado/,'outro cliente não responde');
 await assert.rejects(P.responderDoPortal(sql,{cliente:'Serra Grande',id:p.id,versao:env.versao+1,acao:'aprovar',nome:'Ana'}),/versão nova/);
 const r=await P.responderDoPortal(sql,{cliente:'Serra Grande',id:p.id,versao:env.versao,acao:'aprovar',nome:'Ana',ajustesPecas:{0:'Outra foto'}});
 assert.equal(r.estado,'ajustes');assert.equal(r.conteudo.pecas[0].revisao_cliente.nota,'Outra foto');
 const ev=(await P.detalhePlanejamento(sql,{id:3},p.id)).eventos[0];assert.equal(ev.autor_externo,'Ana (VybeHub)');
 await assert.rejects(P.responderDoPortal(sql,{cliente:'Serra Grande',id:p.id,versao:r.versao,acao:'aprovar',nome:'Ana'}),/já foi respondido/);
 await assert.rejects(P.responderDoCliente(sql,env.token,{acao:'aprovar',nome:'Ana'}).then(x=>{if(x.repetido)throw new Error('repetido');}),/repetido/,'o link também vê que já respondeu');
});

// Paulo, 20/10/2026: "não copiou os conteúdos todos" — objetivo, linha e telas por peça.
test('peça guarda objetivo, linha e telas; o que veio junto na referência é separado ao mostrar',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas:[
  {data:'2026-11-03',formato:'Carrossel',tema:'Treze',linha:'Direitos e datas',objetivo:'Evitar golpe',telas:['Vai ter 13º?','Foi pago antes'],legenda:'Salve'},
  {data:'2026-11-04',formato:'Card',tema:'Antigo',referencia:'Objetivo: Responder a dúvida. Texto das telas: Tela 1: Um | Tela 2: Dois'}]}});
 assert.deepEqual(p.conteudo.pecas[0].telas,['Vai ter 13º?','Foi pago antes']);assert.equal(p.conteudo.pecas[0].linha,'Direitos e datas');
 const d=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.deepEqual(d.conteudo.pecas[1].telas,['Um','Dois']);assert.equal(d.conteudo.pecas[1].objetivo,'Responder a dúvida.');assert.equal(d.conteudo.pecas[1].referencia,'');
 const html=documentoHtml(d);
 assert.match(html,/Texto das telas/);assert.match(html,/<li>Dois<\/li>/);assert.match(html,/Evitar golpe/);
 // O editor manda as telas como texto, uma por linha.
 const e=await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:d.versao,conteudo:{pecas:[{data:'2026-11-03',formato:'Carrossel',tema:'Treze',telas:'Um\nDois\n\nTrês'}]}});
 assert.deepEqual(e.conteudo.pecas[0].telas,['Um','Dois','Três']);
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 assert.deepEqual((await P.planejamentosDoPortal(sql,{cliente:'Serra Grande'})).planejamentos[0].conteudo.pecas[0].telas,['Um','Dois','Três']);
 // Reabrir o que está com o cliente tira o link.
 await P.mudarEstadoInterno(sql,{id:3},{id:p.id,estado:'revisar'});
 await assert.rejects(P.planejamentoDoLink(sql,env.token),/não vale mais/);
});

// Paulo, 20/10/2026: cliente que não aprova — o head (ou quem administra) aprova direto.
test('head aprova sem o cliente: só head e quem administra, antes de mandar',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'}]}});
 await assert.rejects(P.aprovarPeloHead(sql,{id:24},{id:p.id}),/Só o head/);
 await assert.rejects(P.aprovarPeloHead(sql,{id:3},{id:p.id,versao:p.versao+1}),/mudou/);
 const r=await P.aprovarPeloHead(sql,{id:3},{id:p.id,versao:p.versao});
 assert.equal(r.estado,'aprovado');assert.equal(r.resposta_nome,'Vinícius (head)');
 const ev=(await P.detalhePlanejamento(sql,{id:3},p.id)).eventos[0];assert.equal(ev.tipo,'aprovado');assert.match(ev.texto,/sem envio ao cliente/);
 await assert.rejects(P.aprovarPeloHead(sql,{id:1,admin:true},{id:p.id}),/já foi aprovado/);
 // Enviado ao cliente: precisa reabrir antes.
 const q=await P.publicarDoAgente(sql,{cliente:'Mangaba',mes:'2026-11',conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'}]}});
 await P.enviarAoCliente(sql,{id:1,admin:true},{id:q.id});
 await assert.rejects(P.aprovarPeloHead(sql,{id:1,admin:true},{id:q.id}),/Reabra/);
});

// Regressão (20/10/2026): refazer o editor apagou pljPlacar e quebrou a lista de planejamentos do cliente.
test('a tela dos planejamentos não chama função que não existe',()=>{
 const s=readFileSync('vybe-planejamentos.js','utf8');
 const chamadas=new Set([...s.matchAll(/\b(plj[A-Z]\w*)\s*\(/g)].map(m=>m[1]));
 const definidas=new Set([...s.matchAll(/function\s+(\w+)/g),...s.matchAll(/(?:const|let)\s+(\w+)\s*=/g)].map(m=>m[1]));
 assert.deepEqual([...chamadas].filter(n=>!definidas.has(n)),[]);
});

// Regressão (20/10/2026): no quadro do painel, o link do calendário abria a tela inicial.
test('links internos do documento só rolam (não saem do quadro)',()=>{
 const html=documentoHtml({id:'1',cliente:'C',titulo:'P',mes:'2026-11-01',versao:1,estado:'revisar',identidade:{},conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'Um'}]}},{revisor:'head'});
 assert.match(html,/href="#peca-1"/);
 assert.match(html,/closest\('a\[href\^="#"\]'\)[\s\S]*preventDefault/);
});

test('datas do planejamento: validação real, prazo separado e virada de mês/ano',()=>{
 const normalizar=pecas=>P.normalizarConteudo({pecas}).pecas;
 for(const campo of ['data','prazo'])for(const valor of ['2026-02-30','2026-13-01','10/11/2026','<script>'])
  assert.throws(()=>normalizar([{tema:'Teste',data:'2026-11-20',[campo]:valor}]),/data válida/);
 assert.throws(()=>normalizar([{tema:'Teste',data:'2026-11-20',prazo:'2026-11-21'}]),/depois da veiculação/);
 const p=normalizar([{tema:'Ano novo',data:'2027-01-01',prazo:'2026-12-29'},{tema:'Antes',data:'2026-12-31'},{tema:'Bissexto',data:'2028-02-29'}]);
 assert.deepEqual(p.map(x=>x.tema),['Antes','Ano novo','Bissexto']);
 assert.equal(p[1].prazo,'2026-12-29');
 assert.equal(p[0].prazo,undefined);
 const html=documentoHtml({mes:'2026-12-01',estado:'revisar',conteudo:{pecas:p}});
 assert.match(html,/Janeiro de 2027/);
 assert.match(html,/<b>1<\/b><a href="#peca-2"/,'remarcada para outro mês continua no calendário');
 assert.equal(normalizar([{tema:'Sem dia',data:'',prazo:''}])[0].data,'');
});

test('mudar datas salva, reordena calendário/documento e invalida só a revisão da peça alterada',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo});
 const d=await P.detalhePlanejamento(sql,{id:3},p.id);
 for(const x of d.conteudo.pecas)await P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:x.assinatura,estado:'ok'});
 await P.registrarArquivos(sql,p.id,{docId:'doc-v1',pdfId:'pdf-v1',versao:1});
 const editado={...d.conteudo,pecas:d.conteudo.pecas.map((x,i)=>i===0?{...x,data:'2026-11-25',prazo:'2026-11-23'}:x)};
 await assert.rejects(P.editarPlanejamento(sql,{id:24},{id:p.id,versao:1,conteudo:editado}),/Só o head/);
 const e=await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:1,conteudo:editado});
 assert.equal(e.drive_doc_id,null,'não oferece o documento antigo como se fosse atual');
 assert.equal(e.drive_pdf_id,null);
 const novo=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.deepEqual(novo.conteudo.pecas.map(x=>x.tema),['Consciência Negra','Finados']);
 assert.equal(novo.conteudo.pecas[1].prazo,'2026-11-23');
 assert.equal(novo.revisao.head_ok,1);
 const html=documentoHtml(novo,{revisor:'head'});
 const fichas=html.slice(html.indexOf('<section id="area-pecas">'));
 assert.ok(fichas.indexOf('Consciência Negra')<fichas.indexOf('Finados'));
 assert.match(html,/<b>25<\/b><a href="#peca-2"/);
 assert.match(html,/Prazo: 23\/11/);
 assert.match(html,/Veiculação: 25\/11/);
 assert.match(html,/name="prazo"/);
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(script[1]));
 assert.doesNotMatch(documentoHtml(novo,{paraCliente:true}),/data-acao="prazo"|Prazo de produção/);
 await assert.rejects(P.editarPlanejamento(sql,{id:3},{id:p.id,versao:1,conteudo:editado}),/outra versão/);
 assert.equal(await P.registrarArquivos(sql,p.id,{docId:'antigo',pdfId:'antigo',versao:1}),false);
 assert.equal(await P.registrarArquivos(sql,p.id,{docId:'doc-v2',pdfId:'pdf-v2',versao:2}),true);
 assert.equal((await P.detalhePlanejamento(sql,{id:3},p.id)).drive_doc_id,'doc-v2');
 const prazoApenas={...novo.conteudo,pecas:novo.conteudo.pecas.map((x,i)=>i===0?{...x,prazo:'2026-11-18'}:x)};
 const prazoSalvo=await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:2,conteudo:prazoApenas});
 assert.deepEqual(prazoSalvo.conteudo.pecas.map(x=>x.data),['2026-11-20','2026-11-25']);
});

test('API de edição: falha do Drive avisa e mantém as datas salvas sem arquivo obsoleto',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo});
 const {areaPlanejamentos}=await import('../server/planejamentos-api.js');
 const antes=process.env.VYBE_HOMOLOGACAO;
 process.env.VYBE_HOMOLOGACAO='1';
 t.after(()=>{if(antes===undefined)delete process.env.VYBE_HOMOLOGACAO;else process.env.VYBE_HOMOLOGACAO=antes;});
 t.mock.method(globalThis,'fetch',()=>{assert.fail('Nenhum acesso externo é permitido neste teste.');});
 const r=resposta();
 await areaPlanejamentos({method:'POST',query:{acao:'editar'},body:{id:p.id,versao:1,conteudo:{pecas:[{data:'2026-11-10',prazo:'2026-11-06',tema:'Remarcada'}]}}},r,{pessoa:{id:3}},sql);
 assert.equal(r.codigo,200);
 assert.equal(r.corpo.planejamento.conteudo.pecas[0].data,'2026-11-10');
 assert.equal(r.corpo.planejamento.conteudo.pecas[0].prazo,'2026-11-06');
 assert.match(r.corpo.avisos[0],/salvo.*Drive/);
 assert.equal((await P.detalhePlanejamento(sql,{id:3},p.id)).drive_doc_id,null);
});

test('atalho de datas edita o rascunho na hora (sem ir ao servidor) e grava tudo quando o head salva',async()=>{
 const chamadas=[],mensagens=[],toasts=[];
 const quadro={contentWindow:{postMessage:m=>mensagens.push(m)},addEventListener:(tipo,fn)=>fn()};
 const modal={dataset:{aba:'documento'},querySelector:s=>s==='.plj-previa'?quadro:null};
 const ctx=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){},querySelector:()=>quadro,getElementById:id=>id==='workflow-modal'?modal:null},showToast:(...x)=>toasts.push(x),confirm:()=>true});
 vm.runInContext(readFileSync('vybe-planejamentos.js','utf8'),ctx);
 ctx.registrar=(a,b)=>chamadas.push([a,b]);
 ctx.simular=corpo=>({planejamento:{id:'1',versao:2,estado:'revisar',conteudo:P.normalizarConteudo(corpo)}});
 vm.runInContext(`
 PLJ_ABERTO={id:'1',versao:1,estado:'revisar',pode_editar:true,titulo:'Mês',conteudo:{pecas:[
 {tema:'Mesmo tema',data:'2026-11-20',legenda:'Primeira',formato:'Card'},
 {tema:'Mesmo tema',data:'2026-11-10',legenda:'Segunda',formato:'Card'}
 ]}};
 PLJ_RASCUNHO=JSON.parse(JSON.stringify(PLJ_ABERTO.conteudo));
 let salvo;
 pljPedir=async(params,b)=>{registrar(params,b);if(b){salvo=simular(b.conteudo);return {...salvo,avisos:['Drive indisponível']};}return salvo;};
 abrirPlanejamento=async()=>{};
 pljAtualizarFora=()=>{};
 `,ctx);
 await ctx.pljSalvarPecaDoDocumento(0,{data:'2026-11-25',prazo:'2026-11-23'},{soDatas:true});
 assert.equal(chamadas.length,0,'arrastar ou mudar data não chama o servidor nem o Drive a cada movimento');
 await assert.rejects(ctx.pljSalvarPecaDoDocumento(0,{data:'2026-11-20',prazo:'2026-11-22'},{soDatas:true}),/depois da veiculação/);
 await assert.rejects(ctx.pljSalvarPecaDoDocumento(-1,{}),/Peça não encontrada/);
 await ctx.salvarPlanejamento({});
 assert.equal(chamadas.filter(([,b])=>b?.acao==='editar').length,1,'salva uma única versão quando o head clica em Salvar alterações');
 assert.equal(chamadas.filter(([,b])=>b?.acao==='revisar_peca').length,0);
 assert.equal(chamadas[0][1].conteudo.pecas[0].legenda,'Primeira');
 assert.equal(chamadas[0][1].conteudo.pecas[1].legenda,'Segunda');
 assert.equal(mensagens[0].n,2);
 assert.ok(toasts.some(([m])=>m==='Drive indisponível'));
});

test('API de edição gera documento/PDF da nova data e registra só a versão atual (Drive simulado)',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes:'2026-11',conteudo});
 const envKeys=['GOOGLE_SERVICE_ACCOUNT','DRIVE_PASTA_RAIZ','VYBE_HOMOLOGACAO','VERCEL_ENV'];
 const antes=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 t.after(()=>{for(const [k,v] of Object.entries(antes)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 process.env.GOOGLE_SERVICE_ACCOUNT=JSON.stringify({client_email:'teste@example.invalid',private_key:privateKey});
 process.env.DRIVE_PASTA_RAIZ='raiz-teste-planejamentos';
 process.env.VYBE_HOMOLOGACAO='0';
 process.env.VERCEL_ENV='development';
 const uploads=[],rede=[];
 t.mock.method(globalThis,'fetch',async(u,op={})=>{
  const url=new URL(u);rede.push(url.pathname);
  if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'token-ficticio',expires_in:3600});
  assert.equal(url.hostname,'www.googleapis.com');
  if(url.pathname==='/drive/v3/files')return Response.json({files:[{id:'cliente',name:'Serra Grande'},{id:'planos',name:'Planejamentos'},{id:'ano',name:'2026'}]});
  if(url.pathname==='/upload/drive/v3/files'){
   const body=op.body.toString();uploads.push(body);
   return Response.json({id:body.includes('Content-Type: text/html')?'doc-v2':'pdf-v2',webViewLink:'https://example.invalid/arquivo'});
  }
  if(url.pathname==='/drive/v3/files/doc-v2/export')return new Response('%PDF-simulado');
  assert.fail('Rota inesperada no Drive simulado: '+url.pathname);
 });
 const {areaPlanejamentos}=await import('../server/planejamentos-api.js');
 const r=resposta();
 await areaPlanejamentos({method:'POST',query:{acao:'editar'},body:{id:p.id,versao:1,conteudo:{pecas:[{data:'2026-11-10',prazo:'2026-11-06',tema:'Remarcada',legenda:'Legenda preservada'}]}}},r,{pessoa:{id:3}},sql);
 assert.equal(r.codigo,200);
 assert.deepEqual(r.corpo.avisos,[]);
 assert.equal(r.corpo.planejamento.drive_doc_id,'doc-v2');
 assert.equal(r.corpo.planejamento.drive_pdf_id,'pdf-v2');
 const d=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.equal(d.drive_doc_id,'doc-v2');
 assert.equal(d.drive_pdf_id,'pdf-v2');
 assert.equal(uploads.length,2);
 assert.match(uploads[0],/<b>10<\/b><a href="#peca-1"/);
 assert.match(uploads[0],/Prazo de produção: 06\/11/);
 assert.match(uploads[0],/Legenda preservada/);
 assert.match(uploads[0],/v2/);
 assert.ok(rede.includes('/drive/v3/files/doc-v2/export'));
});

test('molduras do planejamento permitem o submit do editor sem liberar a origem',()=>{
 const s=readFileSync('vybe-planejamentos.js','utf8');
 const frames=[...s.matchAll(/<iframe[^>]*sandbox="([^"]+)"/g)];
 assert.equal(frames.length,2);
 for(const [,sandbox]of frames){assert.ok(sandbox.split(' ').includes('allow-forms'));assert.ok(!sandbox.split(' ').includes('allow-same-origin'));}
});

test('calendário mostra títulos escapados e só o head em revisão pode mover peças',()=>{
 const p={mes:'2026-11-01',estado:'revisar',conteudo:{pecas:[{data:'2026-11-03',formato:'Card',tema:'01 - Título & <teste>'},{data:'2026-11-05',formato:'Reels',tema:''}]}};
 const html=documentoHtml(p,{revisor:'head'});
 const cal=html.slice(html.indexOf('<table class="cal">'),html.indexOf('</table>',html.indexOf('<table class="cal">')));
 assert.match(cal,/>Título &amp; &lt;teste&gt;<\/a>/);
 assert.match(cal,/>Sem tema<\/a>/);
 assert.match(cal,/data-data="2026-11-03"/);
 assert.match(cal,/data-indice="0" data-mover="true"/);
 for(const opcoes of [{paraCliente:true},{revisor:'leitor'}])
  assert.doesNotMatch(documentoHtml(p,opcoes),/data-mover="true"/);
 assert.doesNotMatch(documentoHtml({...p,estado:'aprovado'},{revisor:'head'}),/data-mover="true"/);
});

function calendarioDeTeste({falhar=false,pendente=false}={}){
 const html=documentoHtml({mes:'2026-11-01',estado:'revisar',conteudo:{pecas:[]}},{revisor:'head'});
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(s=>s.includes('let arrastando='));
 const codigo=script.slice(script.indexOf('let arrastando='),script.indexOf('const dlg='));
 const eventos={},chamadas=[],classes=new Set(),avisos={hidden:true,textContent:''};
 let alvo,liberar;
 const classe={add:x=>classes.add(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x))};
 let onde={dataset:{data:'2026-11-03'}};
 const celula=data=>({dataset:{data},classList:classe,closest(){return this;},append(){onde=this;}});
 const a={dataset:{indice:'1'},classList:classe,closest:s=>s==='td'?onde:a,setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){}};
 const doc={addEventListener:(n,f)=>eventos[n]=f,querySelectorAll:()=>[{classList:classe}],elementFromPoint:()=>alvo,getElementById:()=>avisos};
 const c=vm.createContext({document:doc,addEventListener:(n,f)=>eventos[n]=f,setTimeout:fn=>fn(),modo:'doc',
 falar:async dados=>{chamadas.push(dados);if(falhar)throw Error('Prazo posterior à veiculação');if(pendente)await new Promise(r=>liberar=r);}});
 vm.runInContext(codigo,c);
 const evento=(x=10,id=1)=>({target:a,button:0,pointerId:id,clientX:x,clientY:10,preventDefault(){},stopPropagation(){}});
 return {eventos,chamadas,avisos,a,get origem(){return onde;},setAlvo:data=>alvo=data?celula(data):null,evento,liberar:()=>liberar?.()};
}

test('arraste move na hora no calendário e avisa o rascunho; clique, cancelamento e saída não gravam',async()=>{
 const t=calendarioDeTeste();t.setAlvo('2026-11-09');
 t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(14));await t.eventos.pointerup(t.evento(14));
 assert.equal(t.chamadas.length,0,'clique curto continua sendo navegação');
 for(const cancelar of [()=>t.eventos.pointercancel(),()=>t.eventos.keydown({key:'Escape'}),()=>t.eventos.blur()]){
  t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));cancelar();await t.eventos.pointerup(t.evento(30));
 }
 assert.equal(t.chamadas.length,0);
 t.setAlvo(null);t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));await t.eventos.pointerup(t.evento(30));
 t.setAlvo('2026-11-03');t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));await t.eventos.pointerup(t.evento(30));
 assert.equal(t.chamadas.length,0,'fora do calendário e mesmo dia não salvam');
 t.setAlvo('2026-11-09');t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));await t.eventos.pointerup(t.evento(30));
 assert.deepEqual(JSON.parse(JSON.stringify(t.chamadas)),[{acao:'editar',indice:1,peca:{data:'2026-11-09'},soDatas:true,modo:'doc'}]);
 assert.equal(t.origem.dataset.data,'2026-11-09','a peça muda de dia imediatamente no calendário');
 assert.match(t.avisos.textContent,/Veiculação alterada/);
});

test('arraste: falha preserva data e mostra erro; gravação pendente bloqueia outro movimento',async()=>{
 const erro=calendarioDeTeste({falhar:true});erro.setAlvo('2026-11-01');
 erro.eventos.pointerdown(erro.evento());erro.eventos.pointermove(erro.evento(30));await erro.eventos.pointerup(erro.evento(30));
 assert.match(erro.avisos.textContent,/Prazo posterior/);assert.equal(erro.origem.dataset.data,'2026-11-03');
 const t=calendarioDeTeste({pendente:true});t.setAlvo('2026-11-09');
 t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));const salva=t.eventos.pointerup(t.evento(30));
 t.eventos.pointerdown(t.evento());t.eventos.pointermove(t.evento(30));await t.eventos.pointerup(t.evento(30));
 assert.equal(t.chamadas.length,1);t.liberar();await salva;
});

// Augusto (Copy, 09/11/2026): o que o head e o cliente pedem para ajustar fica para o agente aprender, mesmo depois que a
// peça é editada, e a aceitação conta quantas legendas passaram sem pedido de ajuste.
test('Augusto: ajustes do head e do cliente ficam guardados e a aceitação conta as legendas sem ajuste',async t=>{
 const {db,sql}=await banco(t);
 await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql','utf8'));
 await db.exec(`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS cadastro jsonb NOT NULL DEFAULT '{}'::jsonb;
  UPDATE vybe_clientes SET segmento='Bebidas', cadastro='{"cidade":"Irecê","instagram":"@serragrande","observacoes":"Prefere texto curto e sem gíria.","valor":"9999"}'::jsonb WHERE id=10;`);
 const C=await import('../server/copy-cliente.js');
 const mes=new Date().toISOString().slice(0,7),d1=mes+'-05',d2=mes+'-12',d3=mes+'-19';
 const leg='Água mineral Serra Grande: leve, gelada e do jeito que o sertão pede no calor de todo dia.';
 const p=await P.publicarDoAgente(sql,{cliente:'Serra Grande',mes,conteudo:{pecas:[
  {data:d1,formato:'Card',tema:'Calor',legenda:leg},{data:d2,formato:'Reels',tema:'Fábrica',legenda:leg+' Bastidores.'},{data:d3,formato:'Card',tema:'Família',legenda:leg+' Em família.'}]}});
 let d=await P.detalhePlanejamento(sql,{id:3},p.id);
 await P.revisarPecaHead(sql,{id:3},{id:p.id,assinatura:d.conteudo.pecas[1].assinatura,estado:'ajustar',nota:'Tirar o emoji e encurtar o gancho'});
 // O head edita a peça: a revisão some, mas o pedido continua no histórico.
 const editado={...d.conteudo,pecas:d.conteudo.pecas.map((x,i)=>i===1?{...x,legenda:leg+' Por dentro da fábrica.'}:x)};
 await P.editarPlanejamento(sql,{id:3},{id:p.id,versao:d.versao,conteudo:editado});
 d=await P.detalhePlanejamento(sql,{id:3},p.id);
 assert.equal(d.revisao.head_ajustar,0,'a peça editada perde o "ajustar"');
 const env=await P.enviarAoCliente(sql,{id:3},{id:p.id});
 await P.responderDoPortal(sql,{cliente:'Serra Grande',id:p.id,versao:env.versao,acao:'ajustes',nome:'Ana',ajustesPecas:{0:'Falar da garrafa de 20 litros'}});
 const ajustes=await C.ajustesDeCopy(sql,10);
 assert.deepEqual(ajustes.map(a=>[a.quem,a.nota]).sort(),[['cliente','Falar da garrafa de 20 litros'],['head','Tirar o emoji e encurtar o gancho']]);
 assert.equal(ajustes.find(a=>a.quem==='head').nome,'Vinícius');
 assert.match(ajustes.find(a=>a.quem==='cliente').peca,/^Card, 05\//);
 const ac=await C.aceitacaoDasLegendas(sql,10);
 assert.deepEqual({pecas:ac.pecas,com_ajuste:ac.com_ajuste,sem_ajuste:ac.sem_ajuste,percentual:ac.percentual,de_primeira:ac.de_primeira},{pecas:3,com_ajuste:2,sem_ajuste:1,percentual:33,de_primeira:0});
 const ficha=await C.fichaParaCopy(sql,10);
 assert.match(ficha,/Segmento: Bebidas/);assert.match(ficha,/Prefere texto curto/);assert.doesNotMatch(ficha,/9999/,'dinheiro não entra');
 // Tudo chega ao bot pela ferramenta legendas_aprovadas (as mesmas regras de antes, mais o que o Augusto precisa).
 const {legendasAprovadas}=await import('../server/assistente-memoria.js');
 await db.exec(`CREATE TABLE vybe_cliente_registros(id bigserial,cliente_id bigint,tipo text,titulo text,status text,resumo text,decisoes text,conteudo text,criado_em timestamptz DEFAULT now());
  INSERT INTO vybe_cliente_registros(cliente_id,tipo,titulo,status,resumo,decisoes,conteudo) VALUES
  (10,'conteudo','Reels do verão','aprovado','Legenda final','','Verão no sertão pede água gelada na mesa: Serra Grande, a garrafa que acompanha o dia inteiro.'),
  (10,'conteudo','Rascunho','rascunho','x','','Texto que ainda não foi aprovado e não pode servir de exemplo para ninguém.'),
  (10,'regra_de_marca','Tom','aprovado','Sem gíria','Nunca usar gíria de internet',NULL);`);
 const r=await legendasAprovadas(sql,{cliente_id:10});
 assert.equal(r.ajustes.length,2);assert.equal(r.aceitacao.pecas,3);assert.match(r.ficha,/Irecê/);
 assert.deepEqual(r.chats.map(c=>c.texto),['Nunca usar gíria de internet']);
 assert.deepEqual(r.itens.filter(i=>i.fonte==='chats').map(i=>i.tema),['Reels do verão'],'só o conteúdo aprovado do chat vira exemplo');
});

test('Augusto: a resposta das legendas cabe no recorte de 14.000 bytes',async()=>{
 const {caberNoRecorte}=await import('../server/copy-cliente.js');
 const grande={itens:Array.from({length:12},(_,i)=>({mes:'2026-10',formato:'Reels',tema:'T'+i,legenda:'x'.repeat(1200)})),regras:['Sem fundo escuro'],
  ajustes:Array.from({length:8},()=>({quem:'cliente',nota:'y'.repeat(300),legenda:'z'.repeat(220),peca:'Card, 05/11'})),chats:Array.from({length:6},()=>({titulo:'t',texto:'w'.repeat(240)})),ideias:[]};
 const r=caberNoRecorte(grande);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<=13000);assert.deepEqual(r.regras,['Sem fundo escuro']);assert.ok(r.itens.length>=2);
});
