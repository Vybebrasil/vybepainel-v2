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
 INSERT INTO vybe_cliente_pessoas VALUES(10,3,0),(11,24,0);`);
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
