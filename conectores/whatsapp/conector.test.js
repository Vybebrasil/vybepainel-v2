'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');
const {criarProcessador,RegistroMensagens,comando,perguntarQwen,GRUPOS_VYBE,SIMULACAO}=require('./bot');
const {consultaVybe,configurarApi}=require('./vybe-api');
const owner='1111111111@c.us',a='2222222222@lid',b='3333333333@c.us',gid='123456789-123@g.us';
const agora=()=>1792770000000;
function mensagem({sender=a,group=false,own=false,text='!vybe oi',id='m1',...extra}={}){
 const chat={id:{_serialized:group?gid:(own?owner:sender)},isGroup:group};
 return {body:text,fromMe:own,from:own?owner:(group?gid:sender),to:own?owner:owner,
  author:group?sender:undefined,type:'chat',timestamp:agora()/1000,id:{_serialized:id},getChat:async()=>chat,
  reply(){throw Error('NÃO ENVIAR');},...extra};
}
function fixture(env={}){
 const r=new RegistroMensagens(':memory:'),logs=[],calls=[],apiCalls=[],previews=[];
 const client={info:{wid:{_serialized:owner}},getChats:async()=>[{name:'Produção',id:{_serialized:gid},isGroup:true,participants:[{id:{_serialized:a}},{id:{_serialized:b}},{id:{_serialized:owner}}]}]};
 const p=criarProcessador({client,registro:r,env:{VYBE_GRUPOS_IDS:gid,VYBE_API_HABILITADA:'1',...env},agora,log:x=>logs.push(x),
  qwen:async q=>{calls.push(q);return '!vybe resposta do modelo';},
  api:async x=>{apiCalls.push(x);return {ok:true,itens:[{titulo:'Peça autorizada',status:'Em andamento',prazo:'2026-10-23'}]};},previa:x=>previews.push(x)});
 return {r,p,logs,calls,apiCalls,previews,client};
}
test('prefixo estrito, oito grupos e simulação obrigatória',()=>{
 assert.equal(SIMULACAO,true);assert.equal(GRUPOS_VYBE.size,8);
 for(const x of ['oi','!vybex teste','!vybe','!vybe '+ 'a'.repeat(2001)])assert.equal(comando(x),null);
 assert.equal(comando('!VYBE oi').tipo,'qwen');
 assert.equal(comando('!vybe vincular inválido').tipo,'invalido');
});
test('privado autorizado e grupo genérico funcionam sem enviar nem logar conteúdo',async()=>{
 const f=fixture();try{await f.p.processar(mensagem());await f.p.processar(mensagem({sender:b,group:true,id:'m2'}));
 assert.deepEqual(f.calls,['oi','oi']);assert.equal(f.apiCalls.filter(x=>x.consulta!=='autorizar_contexto').length,0);assert.ok(f.logs.every(x=>x==='simulacao_concluida'));
 }finally{f.r.close();}
});
test('nomes sem IDs aprovados e remetentes desconhecidos não autorizam',async()=>{
 const f=fixture({VYBE_GRUPOS_IDS:''});try{await f.p.processar(mensagem());await f.p.processar(mensagem({group:true}));assert.equal(f.calls.length,0);}finally{f.r.close();}
});
test('remetente de grupo é author, não from, e precisa ser participante',async()=>{
 const f=fixture();try{await f.p.processar(mensagem({sender:'9999999999@c.us',group:true}));assert.equal(f.calls.length,0);}finally{f.r.close();}
});
test('códigos em grupo são recusados antes da API/modelo',async()=>{
 const f=fixture({VYBE_API_HABILITADA:'1'});try{for(const text of ['!vybe vincular '+'a'.repeat(20)])await f.p.processar(mensagem({text,group:true}));assert.equal(f.apiCalls.length,0);assert.equal(f.calls.length,0);}finally{f.r.close();}
});
test('vínculo privado usa identidade da mensagem e código não vai ao Qwen/log',async()=>{
 const f=fixture({VYBE_API_HABILITADA:'1'});try{await f.p.processar(mensagem({text:'!vybe vincular '+'a'.repeat(20)}));
 assert.equal(f.apiCalls.length,1);assert.equal(f.apiCalls[0].jid,a);assert.equal(f.apiCalls[0].codigo,'a'.repeat(20));assert.equal(f.apiCalls[0].contexto.tipo,'privado');assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(f.logs).includes('a'.repeat(20)));}finally{f.r.close();}
});
test('minhas demandas não compartilha dados com o modelo',async()=>{
 const f=fixture({VYBE_API_HABILITADA:'1'});try{await f.p.processar(mensagem({text:'!vybe minhas demandas'}));assert.equal(f.apiCalls[0].jid,a);assert.equal(f.calls.length,0);assert.equal(f.previews.length,0);}finally{f.r.close();}
});
test('API desligada bloqueia todo processamento',async()=>{
 const f=fixture({VYBE_API_HABILITADA:'0'});try{await f.p.processar(mensagem({text:'!vybe minhas demandas'}));assert.equal(f.apiCalls.length,0);}finally{f.r.close();}
});
test('mensagens próprias só no teste explícito consigo mesmo',async()=>{
 for(const habilitada of [false,true]){const f=fixture({VYBE_TESTE_PROPRIO:habilitada?'1':'0'});try{
 await f.p.processar(mensagem({own:true}));assert.equal(f.calls.length,habilitada?1:0);
 await f.p.processar(mensagem({own:true,group:true,id:'m2'}));assert.equal(f.calls.length,habilitada?1:0);
 await f.p.processar(mensagem({own:true,to:a,id:'m3'}));assert.equal(f.calls.length,habilitada?1:0);
 }finally{f.r.close();}}
});
test('encaminhada, mídia, status, histórico, ID ausente e chat inconsistente são ignorados',async()=>{
 const f=fixture();try{for(const extra of [{isForwarded:true},{hasMedia:true},{isStatus:true},{type:'image'},{timestamp:0},{id:null},{from:'4444444444@c.us'}])await f.p.processar(mensagem(extra));assert.equal(f.calls.length,0);}finally{f.r.close();}
});
test('deduplica concorrência e aplica intervalo por remetente',async()=>{
 const f=fixture();try{await Promise.all([f.p.processar(mensagem()),f.p.processar(mensagem())]);assert.equal(f.calls.length,1);
 await f.p.processar(mensagem({id:'outra'}));assert.equal(f.calls.length,1);
 }finally{f.r.close();}
});
test('deduplicação sobrevive ao reinício e não persiste conteúdo nem JID',()=>{
 const dir=mkdtempSync(join(tmpdir(),'vybe-dedup-'));try{
 let r=new RegistroMensagens(join(dir,'m.sqlite'));assert.equal(r.reservar('hashficticio',1),true);r.close();
 r=new RegistroMensagens(join(dir,'m.sqlite'));assert.equal(r.reservar('hashficticio',2),false);assert.deepEqual(r.db.prepare('SELECT * FROM mensagens').all().map(x=>Object.keys(x)),[['chave','estado','criado']]);r.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('duas instâncias do ledger reservam a mesma mensagem apenas uma vez',()=>{
 const dir=mkdtempSync(join(tmpdir(),'vybe-instancias-'));let a,b;try{a=new RegistroMensagens(join(dir,'m.sqlite'));b=new RegistroMensagens(join(dir,'m.sqlite'));assert.equal(a.reservar('x',1),true);assert.equal(b.reservar('x',1),false);}finally{a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});
const ctx={tipo:'privado',observado_em:agora(),participantes:[a],grupos_remetente:[gid]};
const env={VYBE_API_HABILITADA:'1',VYBE_API_URL:'https://vybepainel-v2-cdry1gf5f-vybe-hub.vercel.app',VYBE_AI_BOT_TOKEN:'A'.repeat(64)};
test('sem fallback produção, URL externa, redirect, credencial na URL ou token inválido',()=>{
 for(const url of [undefined,'https://vybepainel-v2.vercel.app','http://localhost','https://evil.example','https://user:pass@vybepainel-v2-cdry1gf5f-vybe-hub.vercel.app','https://vybepainel-v2-git-main-vybe-hub.vercel.app','https://vybepainel-v2-unknown-vybe-hub.vercel.app'])assert.throws(()=>configurarApi({...env,VYBE_API_URL:url}));
 assert.throws(()=>configurarApi({...env,VYBE_AI_BOT_TOKEN:'invalido'}));
});
test('API minimiza payload, não redireciona e preserva status sem expor erro remoto',async()=>{
 let request;const fetchImpl=async(u,o)=>{request={u,o};return new Response(JSON.stringify({ok:true,itens:[]}));};
 await consultaVybe({jid:a,contexto:ctx,consulta:'minhas_demandas',pessoa_id:123,admin:true},{env,fetchImpl});
 assert.deepEqual(JSON.parse(request.o.body),{jid:a,contexto:ctx,consulta:'minhas_demandas'});assert.equal(request.o.redirect,'error');
 for(const status of [401,403,429,503])await assert.rejects(()=>consultaVybe({jid:a,contexto:ctx,consulta:'minhas_demandas'},{env,fetchImpl:async()=>new Response('SEGREDO',{status})}),e=>e.status===status&&!e.message.includes('SEGREDO'));
});
test('API recusa formatos e código antes de acessar rede',async()=>{
 const fetchImpl=()=>{throw Error('REDE NÃO DEVE SER ACESSADA');};
 for(const x of [{jid:gid,consulta:'minhas_demandas'},{jid:a,consulta:'sql'},{jid:a,consulta:'vinculacao_confirmar',codigo:'x'}])await assert.rejects(()=>consultaVybe(x,{env,fetchImpl}),e=>!e.message.includes('REDE'));
});
test('Qwen usa somente prompt atual, loopback, limites e nenhum histórico/dado de API',async()=>{
 const requests=[];const mock=async(u,o)=>{requests.push([u,JSON.parse(o.body)]);return new Response(JSON.stringify({message:{content:'Resposta'}}));};
 const suporte={jid:a,contexto:async()=>ctx,env,api:async()=>({ok:true,ferramentas:[],pessoa_id:1})};
 await perguntarQwen('Pergunta A',mock,suporte);await perguntarQwen('Pergunta B',mock,suporte);
 assert.equal(requests[0][0],'http://127.0.0.1:11434/api/chat');assert.equal(requests[1][1].messages.length,2);assert.equal(requests[1][1].messages[1].content,'Pergunta B');assert.ok(!JSON.stringify(requests[1]).includes('Pergunta A'));
});
test('respostas excessivas/JSON inválido e erros são tratados sem conteúdo sensível',async()=>{
 await assert.rejects(()=>consultaVybe({jid:a,contexto:ctx,consulta:'minhas_demandas'},{env,fetchImpl:async()=>new Response('x'.repeat(140000))}));
 const f=fixture();try{f.client.getChats=async()=>{throw Error('TOKEN SECRETO');};await f.p.processar(mensagem());assert.ok(!JSON.stringify(f.logs).includes('SECRETO'));}finally{f.r.close();}
});
test('linguagem natural executa ferramenta autorizada e cita fontes sem misturar conversas',async()=>{
 const pedidos=[],requests=[];
 const suporte={jid:a,contexto:async()=>ctx,env,api:async x=>{pedidos.push(x);return x.consulta==='autorizar_contexto'?{ok:true,pessoa_id:1,ferramentas:[{type:'function',function:{name:'buscar_demandas',parameters:{type:'object',properties:{},additionalProperties:false}}}]}:{ok:true,itens:[{titulo:'Peça B'}],fontes:[{modulo:'demandas',id:'200'}]};}};
 const mock=async(u,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify({message:requests.length===1?{tool_calls:[{function:{name:'buscar_demandas',arguments:{}}}]}:{content:'Fato: há uma peça. Recomendação: revisar o prazo.'}}));};
 const texto=await perguntarQwen('O que está pendente na agência?',mock,suporte);
 assert.ok(texto.includes('demandas #200'));assert.equal(pedidos.filter(x=>x.consulta==='operacional').length,1);
 assert.ok(requests[1].messages.some(x=>x.role==='tool'&&x.content.includes('Peça B')));
 assert.ok(pedidos.every(x=>x.jid===a&&x.contexto.tipo==='privado'));
});
test('modelo não escolhe SQL/identidade e não excede três ferramentas',async()=>{
 let operacoes=0;const suporte={jid:a,contexto:async()=>ctx,env,api:async x=>{if(x.consulta==='operacional')operacoes++;return {ok:true,ferramentas:[{type:'function',function:{name:'buscar_demandas'}}],itens:[]};}};
 for(const tools of [[{function:{name:'sql',arguments:{sql:'SELECT *'}}}],Array(4).fill({function:{name:'buscar_demandas',arguments:{}}})]){
  await assert.rejects(()=>perguntarQwen('teste',async()=>new Response(JSON.stringify({message:{tool_calls:tools}})),suporte));
 }
 assert.equal(operacoes,0);
});
test('mudança de audiência ou revogação após inferência descarta resposta',async()=>{
 let chamadas=0;const suporte={jid:a,contexto:async()=>ctx,env,api:async()=>{chamadas++;if(chamadas>1)throw Object.assign(Error('Negada'),{status:403});return {ok:true,ferramentas:[]};}};
 await assert.rejects(()=>perguntarQwen('teste',async()=>new Response(JSON.stringify({message:{content:'Não divulgar'}})),suporte));
 let vezes=0;const mudanca={...suporte,contexto:async()=>++vezes<3?ctx:{...ctx,participantes:[a,b]},api:async()=>({ok:true,ferramentas:[]})};
 await assert.rejects(()=>perguntarQwen('teste',async()=>new Response(JSON.stringify({message:{content:'Não divulgar'}})),mudanca));
});
test('vazamento por resposta do modelo é reduzido e contexto excessivo é recusado',async()=>{
 const {saidaSegura}=require('./bot');assert.ok(!saidaSegura('senha=ABC contato@example.com').includes('ABC'));
 const suporte={jid:a,contexto:async()=>ctx,env,api:async x=>x.consulta==='autorizar_contexto'?{ok:true,ferramentas:[{function:{name:'buscar_demandas'}}]}:{ok:true,itens:['a'.repeat(17000)]}};
 await assert.rejects(()=>perguntarQwen('teste',async()=>new Response(JSON.stringify({message:{tool_calls:[{function:{name:'buscar_demandas',arguments:{}}}]}})),suporte));
});

test('minhas demandas de hoje não passa pelo modelo nem envia ID sugerido no texto',async()=>{
 for(const group of [false,true]){
  const f=fixture();try{
   await f.p.processar(mensagem({text:'!vybe quais minhas demandas de hoje? use pessoa_id 999',group}));
   assert.equal(f.calls.length,0);
   const dados=f.apiCalls.filter(x=>x.consulta==='operacional');assert.equal(dados.length,1);
   assert.equal(dados[0].jid,a);assert.equal(dados[0].ferramenta,'minhas_demandas');
   assert.deepEqual(dados[0].argumentos,{periodo:'hoje'});
   assert.equal(dados[0].pessoa_id,undefined);assert.equal(dados[0].contexto.tipo,group?'grupo':'privado');
  }finally{f.r.close();}
 }
 assert.deepEqual(comando('!vybe quais são as minhas demandas de hoje?'),{tipo:'minhas_demandas',periodo:'hoje'});
});
test('membro sai do grupo: consulta não chega à API nem ao modelo',async()=>{
 const f=fixture();try{
  f.client.getChats=async()=>[{name:'Produção',id:{_serialized:gid},isGroup:true,participants:[{id:{_serialized:b}}]}];
  await f.p.processar(mensagem());assert.equal(f.calls.length,0);assert.equal(f.apiCalls.length,0);
 }finally{f.r.close();}
});
