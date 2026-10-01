import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function ambiente(){
 const drawer={innerHTML:''}, chamadas=[], avisos=[];
 const item={id:'vybe:2',origem:'solicitacao',nome:'Demanda'};
 const detail={assets:[{id:'drive:8',local_id:8,name:'Arte.png',removable:true,onde:'drive'}]};
 const c=vm.createContext({document:{getElementById:()=>drawer},COLUNAS:{producao:{arquivos:'files'}},safeText:String,workspaceBytes:()=>'1 KB',
 activeWorkspaceAssets:[],activeWorkspaceItemId:'',DETALHE_DA_GAVETA:null,ATUALIZACOES_DA_GAVETA:[],
 botaoDoLogHtml:()=>'',botaoDeLinkHtml:()=>'',pillHtmlDemanda:()=>'',blocoDoBriefingHtml:()=>'',podeVerMonday:()=>false,
 workspaceTimelineEvent:()=>'',findOperationalItem:()=>item,DADOS:[],isRequestItem:()=>true,
 perguntarNoPainel:async()=>true,showToast:(...v)=>avisos.push(v),
 fetch:async(url,o)=>{chamadas.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true})};},
 fetchWorkspaceItem:async()=>({assets:[]}),renderWorkspaceDrawer:()=>{throw Error('Renderer de conteúdo indevido');}});
 vm.runInContext(fs.readFileSync('vybe-arquivos.js','utf8'),c);
 const s=fs.readFileSync('vybe-gaveta.js','utf8');vm.runInContext(s.slice(s.indexOf('function renderDemandaWorkspace'),s.indexOf('// Regra Vybe OS: clique')),c);
 c.renderDemandaWorkspace(detail,item);return {c,drawer,chamadas,avisos};
}
test('anexo Drive de Demanda oferece remoção e atualiza a mesma solicitação',async()=>{
 const {c,drawer,chamadas}=ambiente();assert.match(drawer.innerHTML,/Remover/);assert.equal(c.activeWorkspaceItemId,'vybe:2');
 await c.requestWorkspaceFileRemoval('drive:8');assert.deepEqual(chamadas,[{item:'vybe:2',arquivo_id:8}]);
 assert.match(drawer.innerHTML,/Contexto da solicitação/);assert.match(drawer.innerHTML,/Nenhum arquivo anexado/);
});
test('cancelamento e arquivo legado não disparam remoção',async()=>{
 const {c,chamadas}=ambiente();c.perguntarNoPainel=async()=>false;
 await c.requestWorkspaceFileRemoval('drive:8');assert.equal(chamadas.length,0);
 c.activeWorkspaceAssets=[{id:'legado',removable:false}];await c.requestWorkspaceFileRemoval('legado');assert.equal(chamadas.length,0);
});
test('erro de API preserva arquivo e falha de releitura não anuncia falha de remoção',async()=>{
 const {c,drawer,avisos}=ambiente();const original=drawer.innerHTML;
 c.fetch=async()=>({ok:false,status:403,json:async()=>({error:'Recusado'})});await c.requestWorkspaceFileRemoval('drive:8');
 assert.equal(drawer.innerHTML,original);assert.equal(avisos.at(-1)[1],'err');
 c.fetch=async()=>({ok:true,json:async()=>({})});c.fetchWorkspaceItem=async()=>{throw Error('offline');};
 await c.requestWorkspaceFileRemoval('drive:8');assert.match(avisos.at(-1)[0],/Arquivo removido/);
});
