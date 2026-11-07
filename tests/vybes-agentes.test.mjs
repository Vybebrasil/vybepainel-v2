import test from 'node:test';
import assert from 'node:assert/strict';
import { lerAgentesDaCentral,areaVybes } from '../server/vybes.js';
import handler from '../api/painel.js';
import { validarAgentes,apresentarAgente,referenciaDaPeca,criarFonteAgentes } from '../mundo/atividade-agentes.mjs';
const em='2026-11-07T12:00:00.000Z';
const agente=(estado='executando',extras={})=>({setor:'copy',estado,tarefa:'Estudar ideias dos clientes',desde:em,situacao:'atividade registrada',emCurso:1,
 ultimos:[{estado:'executando',em,tarefa:'Estudar ideias dos clientes',ferramenta:'estudo_noite',ref:'vybe:42',resultado:'',erro:''}],...extras});
const dados=(a=agente())=>({ok:true,geradoEm:em,agentes:[a]});
const entrada='https://teste.trycloudflare.com/entrar?t=cracha-so-servidor';
test('ponte agentes: só GET ao túnel, cookie no servidor e projeção sem crachá/extra',async()=>{
 const r=await lerAgentesDaCentral(entrada,{fetchImpl:async(url,o)=>{
  assert.equal(url,'https://teste.trycloudflare.com/api/cosmos/agentes');assert.equal(o.method,'GET');assert.equal(o.redirect,'error');assert.equal(o.headers.Cookie,'vybes_quem=cracha-so-servidor');
  return new Response(JSON.stringify({...dados(),url:entrada,cracha:'segredo',agentes:[{...agente(),segredo:'segredo'}]}));
 }});
 assert.equal(r.agentes[0].setor,'copy');assert.equal(r.fonte,'central-vybes');assert.doesNotMatch(JSON.stringify(r),/cracha-so-servidor|segredo|trycloudflare/);
});
test('recusa entrada externa, credenciais na URL, caminho errado e redirecionamento',async()=>{
 for(const url of ['https://example.com/entrar?t=x','https://teste.trycloudflare.com.evil.invalid/entrar?t=x','http://teste.trycloudflare.com/entrar?t=x','https://user:senha@teste.trycloudflare.com/entrar?t=x','https://teste.trycloudflare.com/api/cosmos/agentes?t=x','inválida'])
  await assert.rejects(lerAgentesDaCentral(url,{fetchImpl:()=>assert.fail('não pode chamar destino')}),e=>e.status===502&&!e.message.includes('senha'));
 await assert.rejects(lerAgentesDaCentral(entrada,{fetchImpl:async()=>{throw new Error('redirect para segredo');}}),e=>e.status===504&&!e.message.includes('segredo'));
});
test('resposta inválida, setor duplicado, estado inventado, tamanho e erro remoto são recusados',async()=>{
 for(const d of [{},dados({...agente(),estado:'inventado'}),{...dados(),agentes:[agente(),agente()]},dados({...agente(),ultimos:[{}]})])
  await assert.rejects(lerAgentesDaCentral(entrada,{fetchImpl:async()=>new Response(JSON.stringify(d))}),e=>e.status===502);
 await assert.rejects(lerAgentesDaCentral(entrada,{fetchImpl:async()=>new Response('segredo remoto',{status:503})}),e=>e.status===502&&!e.message.includes('segredo'));
 await assert.rejects(lerAgentesDaCentral(entrada,{fetchImpl:async()=>new Response('x'.repeat(256*1024+1))}),e=>e.status===502);
 await assert.rejects(lerAgentesDaCentral(entrada,{fetchImpl:async()=>new Response('segredo',{status:403})}),e=>e.status===403&&!e.message.includes('segredo'));
});
test('GET agentes sem sessão devolve 401 antes do banco; não aceita POST',async()=>{
 const res=()=>({codigo:0,setHeader(){},status(n){this.codigo=n;return this;},json(d){this.corpo=d;return this;}});
 const r=res();await handler({method:'GET',headers:{},query:{area:'vybes',etapa:'agentes'}},r);assert.equal(r.codigo,401);
 const direto=res();await areaVybes({method:'GET',query:{etapa:'agentes'}},direto,null,()=>assert.fail('não consultar banco'));assert.equal(direto.codigo,401);
 const post=res();await areaVybes({method:'POST',body:{etapa:'agentes'}},post,null,()=>assert.fail('não consultar banco'));assert.equal(post.codigo,405);
});
test('apresentação usa estado observado: falha recente e ausência de execução, nunca catálogo estático',()=>{
 assert.equal(apresentarAgente().estado,'indisponivel');
 assert.equal(apresentarAgente(agente('disponivel',{tarefa:null,ultimos:[],situacao:'sem execução registrada',emCurso:0})).estado,'sem_execucao');
 assert.equal(apresentarAgente(agente('disponivel',{tarefa:null,emCurso:0,ultimos:[{estado:'falhou'}]})).estado,'falhou');
 assert.equal(apresentarAgente(agente('aguardando_aprovacao')).estado,'aguardando_aprovacao');
 assert.equal(referenciaDaPeca('vybe:42'),'vybe:42');assert.equal(referenciaDaPeca('12345678901234567890123456789012'),null);assert.equal(referenciaDaPeca('https://evil.invalid'),null);
});
test('consulta limitada, uma requisição por vez e erro preserva última atualização',async()=>{
 let tempo=1000,chamadas=0,falhar=false;
 const f=criarFonteAgentes({agora:()=>tempo,buscar:async()=>{chamadas++;if(falhar)throw Error('offline');return dados();}});
 await Promise.all([f.atualizar(),f.atualizar()]);assert.equal(chamadas,1);assert.equal(f.ler().erro,false);
 await f.atualizar();assert.equal(chamadas,1);tempo+=15000;falhar=true;await f.atualizar();assert.equal(f.ler().erro,true);assert.equal(f.ler().atualizadoEm,1000);assert.equal(f.ler().dados.agentes[0].estado,'executando');
 tempo+=15000;falhar=false;await f.atualizar();assert.equal(f.ler().erro,false);assert.equal(f.ler().atualizadoEm,31000);
});
test('logout durante consulta não devolve dados da sessão anterior',async()=>{
 let resolver;const f=criarFonteAgentes({buscar:()=>new Promise(r=>resolver=r)});const pedido=f.atualizar();await Promise.resolve();f.limpar();resolver(dados());await pedido;assert.equal(f.ler().dados,null);
});

test('painel exibe tarefa/histórico, abre apenas ref explícita de peça e avisa leitura antiga',async()=>{
 const {readFileSync}=await import('node:fs'),vm=await import('node:vm');const fonte=readFileSync('vybe-mundo.js','utf8');
 const ctx=vm.createContext({mundo:{apresentarAgente,referenciaDaPeca},Date,esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 vm.runInContext(fonte.slice(fonte.indexOf('  let fonteAgentes = null;'),fonte.indexOf('  async function mostrarAgente('))+`;this.html=(id,d)=>{fonteAgentes={ler:()=>d};return atividadeDoAgenteHtml(id);};`,ctx);
 const snapshot={dados:dados(),atualizadoEm:Date.parse(em),erro:true};let html=ctx.html('copy',snapshot);
 assert.match(html,/O que está fazendo/);assert.match(html,/Estudar ideias dos clientes/);assert.match(html,/Desde/);assert.match(html,/O que fez/);assert.match(html,/data-valor="vybe:42"/);assert.match(html,/Central fora do ar — última atualização às 09:00/);
 snapshot.dados=dados(agente('executando',{tarefa:'<script>privado</script>',ultimos:[{...agente().ultimos[0],ref:'12345678901234567890123456789012'}]}));html=ctx.html('copy',snapshot);assert.doesNotMatch(html,/<script>|data-valor=/);assert.match(html,/&lt;script&gt;/);
});
test('figuras e monitores só animam durante execução com leitura disponível',async()=>{
 const T=await import('three'),{construirPredio}=await import('../mundo/predio.mjs');const cena=new T.Scene(),animadores=[];
 const motor={adicionar:o=>cena.add(o),clicavel(){},animar:f=>animadores.push(f),emVista:()=>true,invalidar(){},rotulo:({pos})=>({pos,el:{hidden:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},querySelector:()=>({textContent:''})}})};
 const p=construirPredio(motor,{x:0,y:0,z:0}),s=p.salas.get('sdr');assert.ok(s.figura);assert.equal(s.estado,'indisponivel');
 const estado=agente('executando',{setor:'sdr'});p.atividadeAgentes([estado],true);animadores.forEach(f=>f(1,.02));const cor=s.monitor.material.color.getHex();animadores.forEach(f=>f(2,.02));assert.notEqual(s.monitor.material.color.getHex(),cor);
 p.atividadeAgentes([estado],false);const apagado=s.monitor.material.color.getHex();animadores.forEach(f=>f(3,.02));assert.equal(s.monitor.material.color.getHex(),apagado);assert.equal(s.figura.children[0].rotation.z,0);
 p.atividadeAgentes([agente('disponivel',{setor:'sdr',ultimos:[{estado:'falhou'}]})],true);assert.equal(s.estado,'falhou');assert.equal(s.monitor.material.color.getHexString(),'d13d36');
 cena.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
});
