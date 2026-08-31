// checar-nomes.cjs — procura nome usado e nunca declarado.
//
//   node checar-nomes.cjs
//
// Existe por causa de um erro real: uma reescrita apagou a declaração de
// SELECIONADAS e deixou os dez usos. O `node --check` passou — ele só valida
// sintaxe — e o painel quebrou na tela de todo mundo.
//
// Como funciona: monta os arquivos que o index.html carrega num script só (é
// preciso ser um só; `const` no topo de um script em VM fica no escopo daquele
// script e não cruza para o próximo), roda numa DOM de mentira que RESPONDE
// (devolvendo null, toda função de desenho sai na primeira linha e nada é
// testado), liga as chaves guardadas no navegador (senão as telas atrás de um
// botão nunca abrem) e chama cada função sem argumento.
//
// Escuta só ReferenceError. TypeError aqui é a DOM de mentira reclamando, e não
// diz nada sobre o código.

const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const ordem=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].replace(/^\//,''))
  .filter(f=>!/^https?:/.test(f) && fs.existsSync(f));
const stub=new Proxy(function(){},{get:()=>stub,set:()=>true,apply:()=>stub,construct:()=>stub,has:()=>true});
// getElementById devolvendo null fazia toda função de desenho sair na primeira
// linha ('if (!wrap) return'), sem nunca chegar no nome que sumiu. Devolvendo um
// elemento de mentira, ela segue e o ReferenceError aparece.
const elemento=new Proxy(function(){},{
  get:(t,k)=>{
    if(k==='classList') return {add(){},remove(){},toggle(){},contains:()=>false};
    if(k==='style') return new Proxy({},{get:()=>'',set:()=>true});
    if(k==='dataset') return {};
    if(k==='children'||k==='childNodes') return [];
    if(k==='textContent'||k==='innerHTML'||k==='value'||k==='id'||k==='className') return '';
    if(k==='getBoundingClientRect') return ()=>({top:0,left:0,right:0,bottom:0,width:0,height:0,x:0,y:0});
    if(k==='querySelectorAll') return ()=>[];
    if(k==='closest'||k==='querySelector') return ()=>null;
    if(k===Symbol.toPrimitive||k==='toString') return ()=>'';
    return elemento;
  },
  set:()=>true, apply:()=>elemento, has:()=>true });
const doc=new Proxy({},{get:(t,k)=>{
  if(k==='querySelectorAll'||k==='getElementsByClassName'||k==='getElementsByTagName') return ()=>[];
  if(k==='getElementById'||k==='querySelector') return ()=>elemento;
  if(k==='createElement'||k==='createElementNS') return ()=>elemento;
  if(k==='addEventListener'||k==='removeEventListener') return ()=>{};
  if(k==='body'||k==='head'||k==='documentElement') return elemento;
  return stub; }});
const ctx={console,document:doc,localStorage:{getItem:()=>'1',setItem(){},removeItem(){},clear(){}},
  fetch:()=>Promise.resolve({ok:false,json:()=>({})}),setInterval(){},setTimeout(){},clearTimeout(){},clearInterval(){},
  navigator:{},location:{href:'',search:'',reload(){}},performance:{getEntriesByType:()=>[],now:()=>0},
  Intl,JSON,Math,Date,Object,Array,String,Number,Boolean,Set,Map,WeakMap,WeakSet,RegExp,Promise,Error,Symbol,Proxy,Reflect,
  isNaN,isFinite,parseInt,parseFloat,encodeURIComponent,decodeURIComponent,btoa:()=>'',atob:()=>'',
  URL:function(){},URLSearchParams:function(){},Blob:function(){},File:function(){},FormData:function(){},
  AbortController:function(){},Chart:stub,alert(){},confirm:()=>true,prompt:()=>null,
  requestAnimationFrame(){},cancelAnimationFrame(){},getComputedStyle:()=>({}),matchMedia:()=>({matches:false,addEventListener(){}}),
  CustomEvent:function(){},Event:function(){},Image:function(){},FileReader:function(){},
  IntersectionObserver:function(){this.observe=()=>{};this.disconnect=()=>{}},
  ResizeObserver:function(){this.observe=()=>{};this.disconnect=()=>{}},
  MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{}},
  speechSynthesis:stub, SpeechSynthesisUtterance:function(){}, crypto:{randomUUID:()=>'x'}};
ctx.addEventListener=()=>{}; ctx.removeEventListener=()=>{}; ctx.dispatchEvent=()=>true;
ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx; ctx.top=ctx;
vm.createContext(ctx);

// Um script só, não 19: 'const' e 'let' no topo de um script em VM ficam no
// ESCOPO DO SCRIPT e não viram propriedade do global. Rodando arquivo por
// arquivo, nenhum nome cruzava de um para o outro — e a checagem passava por
// tudo sem ver nada. Concatenado, o escopo é um só, como o navegador monta.
const semIIFE = ordem.filter(f => !/\(function\s*\(\s*\)\s*\{/.test(fs.readFileSync(f,'utf8').slice(0,3000)));
const fonte = ordem.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
const fonteChamavel = semIIFE.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n');
const nomes = [...new Set([...fonteChamavel.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))];

// Chama cada uma sem argumento e escuta SÓ o ReferenceError: 'x is not defined'
// é o nome que sumiu. TypeError daqui é a DOM de mentira reclamando.
const chamadas = nomes.map(n =>
  `try{ const r=${n}(); if(r&&typeof r.catch==='function') r.catch(()=>{}); }
   catch(e){ if(e instanceof ReferenceError) __achou(String(e.message).replace(/ is not defined.*/,''), '${n}'); }`
).join('\n');

const quebrados = new Map();
ctx.__achou = (alvo, onde) => { if (!quebrados.has(alvo)) quebrados.set(alvo, onde); };

let falhaGeral = null;
try { vm.runInContext(fonte + '\n;\n' + chamadas, ctx, { filename: 'painel-inteiro.js', timeout: 60000 }); }
catch (e) { falhaGeral = e; }

// ─── Botao morto ─────────────────────────────────────────────────────────────
// A checagem de cima chama cada funcao e escuta ReferenceError. Ela nao alcanca
// o que mora DENTRO de um onclick, porque aquilo e texto ate alguem clicar —
// foi assim que sobrou um "Perguntar ao Jarvis" chamando uma funcao que eu
// tinha acabado de apagar. Aqui os onclick sao lidos como codigo.
const nativos = new Set(['event','this','window','document','alert','confirm','prompt','setTimeout',
  'setInterval','console','Number','String','JSON','Math','Object','Array','Date','Boolean',
  'parseInt','parseFloat','if','for','while','return','typeof','new','function',
  // Nativas do navegador que aparecem dentro de onclick. Faltavam aqui e o
  // verificador acusava 'botao morto' para uma funcao que existe em todo lugar.
  'encodeURIComponent','decodeURIComponent','isNaN','isFinite']);

const declarados = new Set(nomes);
for (const arquivo of [...ordem, 'index.html']) {
  const t = fs.readFileSync(arquivo, 'utf8');
  for (const m of t.matchAll(/^\s*(?:async )?function ([A-Za-z_$][\w$]*)/gm)) declarados.add(m[1]);
  for (const m of t.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) declarados.add(m[1]);
  for (const m of t.matchAll(/^\s*(?:const|let|var) ([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[(\w]/gm)) declarados.add(m[1]);
}

const semAspas = (c) => c.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
const botoesMortos = new Map();
for (const arquivo of [...ordem, 'index.html']) {
  const t = fs.readFileSync(arquivo, 'utf8');
  for (const m of t.matchAll(/on(?:click|change|input|keydown|submit)="([^"]*)"/g)) {
    const codigo = semAspas(m[1].replace(/&quot;/g, '"'));
    for (const c of codigo.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(.?)/g)) {
      const nome = c[2];
      if (nativos.has(nome) || declarados.has(nome)) continue;
      // nome(){ dentro de um objeto e DEFINICAO de metodo, nao chamada
      if (c[4] === '{') continue;
      if (!botoesMortos.has(nome)) botoesMortos.set(nome, `${arquivo}: ${m[1].slice(0, 56)}`);
    }
  }
}

if (falhaGeral) console.log('  ✗ o conjunto não carrega →', falhaGeral.constructor.name + ':', String(falhaGeral.message).slice(0, 110));
if (botoesMortos.size) {
  console.log(`  ${botoesMortos.size} botao(oes) chamando funcao que nao existe:`);
  for (const [nome, onde] of botoesMortos) console.log(`    ${nome}()  em  ${onde}`);
}
if (quebrados.size) {
  console.log(`  ${quebrados.size} nome(s) usados e nunca declarados:`);
  for (const [alvo, onde] of quebrados) console.log(`    ${alvo}  — visto ao chamar ${onde}()`);
} else if (!falhaGeral) {
  console.log(`  ok · ${ordem.length} arquivos, ${nomes.length} funcoes chamadas, todo nome resolve, nenhum botao morto`);
}
process.exit((falhaGeral || quebrados.size || botoesMortos.size) ? 1 : 0);
