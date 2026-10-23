import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function tela(){
 const chamadas=[],timers=[];const el={outerHTML:''};
 const c=vm.createContext({console,Date,URLSearchParams,document:{querySelector:()=>el,getElementById:()=>({select(){}})},safeText:String,
  vbEstadoHtml:({tipo,titulo,acao=''})=>`<aside data-tipo="${tipo}">${titulo}${acao}</aside>`,
  setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){},
  fetch:async(url,op)=>{chamadas.push({url,op});return{ok:true,json:async()=>({ok:true,codigo:'a'.repeat(20),expiraEm:new Date(Date.now()+600000).toISOString()})}},
 });
 vm.runInContext(readFileSync('vybe-conta.js','utf8'),c);
 return{c,r:s=>vm.runInContext(s,c),chamadas,timers,el};
}
test('Perfil contém seção própria sem simular vínculo com schema ausente',()=>{
 const {r}=tela();r(`CONTA_AI={carregando:false,disponivel:false,vinculado:false}`);
 const html=r(`blocoPerfil({nome:'Pessoa',email:'p@example.test'})`);
 assert.match(html,/Vybe AI — WhatsApp/);assert.match(html,/Nome/);assert.match(html,/ainda não disponível/);assert.doesNotMatch(html,/onclick="acaoContaAI/);
});
test('código é gerado pela sessão, fica só em memória e desaparece ao expirar',async()=>{
 const {r,chamadas,timers}=tela();r(`CONTA_AI={carregando:false,disponivel:true,pode_gerar:true}`);
 await r(`acaoContaAI('vinculacao_iniciar')`);
 assert.equal(chamadas[0].op.credentials,'same-origin');assert.equal(chamadas[0].op.body,'{}');assert.ok(!JSON.stringify(chamadas).includes('Bearer'));
 assert.match(r('blocoContaAI()'),/aaaaaaaaaaaaaaaaaaaa/);assert.match(r('blocoContaAI()'),/conversa privada/);
 timers[0]();assert.equal(r('CONTA_AI.codigo'),null);assert.match(r('blocoContaAI()'),/Código expirado/);
});
test('falha ao revogar preserva estado vinculado e informa erro',async()=>{
 const {c,r}=tela();r(`CONTA_AI={carregando:false,disponivel:true,vinculado:true,pode_gerar:true}`);
 c.fetch=async()=>({ok:false,json:async()=>({error:'Indisponível'})});
 await r(`acaoContaAI('vinculacao_revogar')`);
 assert.equal(r('CONTA_AI.vinculado'),true);assert.equal(r('CONTA_AI.ocupado'),false);assert.match(r('blocoContaAI()'),/Indisponível/);
});
test('resposta de conta anterior não exibe código no perfil novo',async()=>{
 const {c,r}=tela();let liberar;c.fetch=()=>new Promise(resolve=>{liberar=resolve});
 r(`CONTA_AI={carregando:false,disponivel:true,pode_gerar:true}`);
 const p=r(`acaoContaAI('vinculacao_iniciar')`);r(`CONTA_CARGA++;CONTA_AI={carregando:true}`);
 liberar({ok:true,json:async()=>({ok:true,codigo:'a'.repeat(20),expiraEm:new Date(Date.now()+600000).toISOString()})});await p;
 assert.equal(r('CONTA_AI.codigo'),undefined);
});
