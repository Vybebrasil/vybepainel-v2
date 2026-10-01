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
 workspaceUploadHtml:()=>'<button>Adicionar arquivos</button>',botaoDoLogHtml:()=>'',botaoDeLinkHtml:()=>'',pillHtmlDemanda:()=>'',blocoDoBriefingHtml:()=>'',podeVerMonday:()=>false,
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

test('PDF abre o documento no Drive; imagem com apóstrofo mantém handler válido',()=>{
 const {c}=ambiente();c.safeText=v=>String(v).replaceAll('"','&quot;');
 const pdf=c.workspaceAssetCard({name:'briefing.pdf',url_thumbnail:'https://example.test/thumb',public_url:'https://example.test/thumb',link_drive:'https://drive.google.com/file/d/pdf/view'});
 assert.match(pdf,/href="https:\/\/drive.google.com\/file\/d\/pdf\/view"/);assert.doesNotMatch(pdf,/onclick="openVybeLightbox/);
 const img=c.workspaceAssetCard({name:"arte d'água.png",url:'https://example.test/arte.png'});
 const handler=img.match(/<article[^>]+onclick="([^"]+)"/)[1].replaceAll('&quot;','"');
 let nome;vm.runInNewContext(handler,{openVybeLightbox:(url,n)=>nome=n});assert.equal(nome,"arte d'água.png");
});
test('arrastar vários arquivos entrega todos ao envio compartilhado',()=>{
 const {c}=ambiente();const files=[{name:'1.png'},{name:'2.png'}],input={};let enviados;
 c.document.getElementById=()=>input;c.DataTransfer=class{files=[];items={add:f=>this.files.push(f)};};
 c.uploadWorkspaceFile=i=>enviados=i.files;
 c.handleWorkspaceDrop({preventDefault(){},currentTarget:{classList:{remove(){}}},dataTransfer:{files}});
 assert.deepEqual([...enviados],files);
});
test('releitura após envio mantém Demandas e preserva rascunho',async()=>{
 const {c,drawer}=ambiente();const input={value:'rascunho'};
 c.document.getElementById=id=>id==='workspace-drawer'?drawer:input;
 const s=fs.readFileSync('vybe-agenda.js','utf8');vm.runInContext(s.slice(s.indexOf('async function atualizarGavetaPreservandoRascunhos'),s.indexOf('// Mover de grupo em lote')),c);
 await c.atualizarGavetaPreservandoRascunhos({id:'vybe:2',origem:'solicitacao'},drawer);
 assert.match(drawer.innerHTML,/Contexto da solicitação/);assert.equal(input.value,'rascunho');
});
test('envio em andamento não duplica lote; falha parcial preserva sucesso e permite nova seleção',async()=>{
 const {c}=ambiente();let liberar,n=0;const avisos=[];
 c.enviarArquivoDaPeca=async()=>{n++;if(n===1)await new Promise(r=>liberar=r);else throw Error('rede');};
 c.atualizarGavetaPreservandoRascunhos=async()=>{};c.perguntarNoPainel=async v=>avisos.push(v);
 const input={files:[{name:'1.png',size:10},{name:'2.png',size:10}],value:'arquivo'};
 const primeiro=c.uploadWorkspaceFile(input);await c.uploadWorkspaceFile(input);assert.equal(n,1);
 liberar();await primeiro;assert.equal(n,2);assert.equal(input.disabled,false);assert.equal(input.value,'');
 assert.match(avisos[0].texto,/2.png: rede/);
});
