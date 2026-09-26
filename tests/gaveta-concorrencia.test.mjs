import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const espera=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function base(){
 const elements={'workspace-drawer':{},'workspace-comment-input':{value:'comentário'},'workspace-link-input':{value:'https://drive.google.com/rascunho'}};
 const mensagens=[], escritas=[],renders=[];
 const c=vm.createContext({console,setTimeout,document:{getElementById:id=>elements[id],querySelector:()=>null,addEventListener(){}},
  showToast:(...a)=>mensagens.push(a),findOperationalItem:id=>({id}),tentarEscritaDupla:async(i,op)=>escritas.push(op)});
 vm.runInContext(fs.readFileSync('vybe-gaveta.js','utf8'),c);
 c.fetchWorkspaceItem=async()=>({ok:true});
 c.renderWorkspaceDrawer=(d,i)=>{renders.push(i.id);elements['workspace-comment-input']={value:''};elements['workspace-link-input']={value:''};};
 vm.runInContext("activeWorkspaceItemId='1'",c);
 return {c,elements,mensagens,escritas,renders};
}
test('comentário preserva link não enviado e nova digitação durante a gravação',async()=>{
 const {c,elements,escritas}=base();const gravacao=espera();
 c.tentarEscritaDupla=async(i,op)=>{escritas.push(op);await gravacao.promise;};
 const p=c.saveWorkspaceComment();elements['workspace-comment-input'].value='próximo comentário';gravacao.resolve();await p;
 assert.equal(elements['workspace-comment-input'].value,'próximo comentário');
 assert.equal(elements['workspace-link-input'].value,'https://drive.google.com/rascunho');assert.equal(escritas.length,1);
});
test('falha de escrita mantém rascunhos e não mostra sucesso',async()=>{
 const {c,elements,mensagens}=base();c.tentarEscritaDupla=async()=>{throw Error('offline');};await c.saveWorkspaceComment();
 assert.equal(elements['workspace-comment-input'].value,'comentário');assert.equal(mensagens.at(-1)[1],'err');
});
test('gravação confirmada e releitura falha não são apresentadas como falha de salvar',async()=>{
 const {c,elements,mensagens,escritas}=base();c.fetchWorkspaceItem=async()=>{throw Error('offline');};await c.saveWorkspaceComment();
 assert.equal(escritas.length,1);assert.equal(elements['workspace-comment-input'].value,'');
 assert.match(mensagens.at(-1)[0],/Registro salvo/);assert.equal(mensagens.some(m=>m[1]==='err'),false);
});
test('trocar de atividade durante escrita não limpa rascunhos da nova janela',async()=>{
 const {c,elements,renders}=base();const gravacao=espera();c.tentarEscritaDupla=()=>gravacao.promise;
 const p=c.saveWorkspaceComment();elements['workspace-drawer']={};elements['workspace-comment-input'].value='outra peça';vm.runInContext("activeWorkspaceItemId='2'",c);gravacao.resolve();await p;
 assert.equal(elements['workspace-comment-input'].value,'outra peça');assert.deepEqual(renders,[]);
});
test('trocar de atividade durante releitura não renderiza a peça anterior',async()=>{
 const {c,elements,renders}=base();const leitura=espera();c.fetchWorkspaceItem=()=>leitura.promise;
 const p=c.saveWorkspaceComment();await Promise.resolve();await Promise.resolve();
 elements['workspace-drawer']={};vm.runInContext("activeWorkspaceItemId='2'",c);leitura.resolve({ok:true});await p;assert.deepEqual(renders,[]);
});
test('dois cliques no link geram uma escrita e preservam comentário',async()=>{
 const {c,elements,escritas}=base();const gravacao=espera();c.tentarEscritaDupla=async(i,op)=>{escritas.push(op);await gravacao.promise;};
 const a=c.saveWorkspaceLink();const b=c.saveWorkspaceLink();gravacao.resolve();await Promise.all([a,b]);
 assert.equal(escritas.length,1);assert.equal(elements['workspace-link-input'].value,'');assert.equal(elements['workspace-comment-input'].value,'comentário');
});

test('aberturas fora de ordem mantêm os detalhes da última atividade escolhida',async()=>{
 const {c,elements,renders}=base();delete elements['workspace-drawer'];
 c.document.createElement=()=>({remove(){if(elements[this.id]===this)delete elements[this.id];}});
 c.document.body={append(...nodes){nodes.forEach(n=>elements[n.id]=n);}};
 const primeira=espera(),segunda=espera();c.fetchWorkspaceItem=id=>id==='1'?primeira.promise:segunda.promise;
 const a=c.openItemWorkspace('1'),b=c.openItemWorkspace('2');
 segunda.resolve({ok:true});await b;primeira.resolve({ok:true});await a;
 assert.deepEqual(renders,['2']);
});
