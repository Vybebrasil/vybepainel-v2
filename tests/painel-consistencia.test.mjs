import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {conexao} from './postgres.mjs';
const fonte=n=>fs.readFileSync(n,'utf8');
const trecho=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const safeText=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('busca ignora acentos, informa vazio e restaura lista ao limpar',()=>{
 const botoes=[{dataset:{cliente:'all',busca:'todos os clientes'}},{dataset:{cliente:'Copirecê',busca:'copirece'}}];
 const vazio={hidden:true};
 const c=vm.createContext({document:{querySelectorAll:()=>botoes,getElementById:()=>vazio}});
 const s=fonte('vybe-agenda.js');
 vm.runInContext(trecho(s,'function textoBuscaCliente','// Trinta'),c);
 vm.runInContext(trecho(s,'function filtrarBuscaDeCliente','function managerCalendarSetClient'),c);
 c.filtrarBuscaDeCliente('  COPIRECÉ ');assert.equal(botoes[1].hidden,false);assert.equal(botoes[0].hidden,true);assert.equal(vazio.hidden,true);
 c.filtrarBuscaDeCliente('não existe');assert.equal(vazio.hidden,false);assert.ok(botoes.every(b=>b.hidden));
 c.filtrarBuscaDeCliente('');assert.ok(botoes.every(b=>!b.hidden));assert.equal(vazio.hidden,true);
});

test('Todos na busca usa total de atividades, não soma vínculos de clientes',()=>{
 let menu;
 const c=vm.createContext({safeText,tagClienteHtml:s=>s,managerCalendarClientFilter:'all',TOTAL_DO_CALENDARIO:1,
  CLIENTES_DO_CALENDARIO:[{client:'Principal',count:1},{client:'Parceiro',count:1}],ancorarPopover(){},
  document:{getElementById:()=>({remove(){},focus(){}}),createElement:()=>({}),body:{append:(_f,m)=>menu=m}}});
 const s=fonte('vybe-agenda.js');
 vm.runInContext(trecho(s,'function textoBuscaCliente','// Trinta'),c);
 vm.runInContext(trecho(s,'function fecharBuscaDeCliente','function filtrarBuscaDeCliente'),c);
 c.abrirBuscaDeCliente({preventDefault(){},stopPropagation(){},currentTarget:{getBoundingClientRect:()=>({})}});
 assert.match(menu.innerHTML,/Todos os clientes<\/span><span class="cliente-busca-conta">1</);
});

function conta(fetch) {
 const root={innerHTML:''};const c=vm.createContext({fetch,console,document:{getElementById:()=>root},sessaoAtual:()=>({admin:true}),safeText});
 vm.runInContext(fonte('vybe-conta.js'),c);vm.runInContext('pintarConta=()=>{}',c);return c;
}
test('Conta distingue rede, HTTP, resposta incompleta e lista vazia; retry limpa erro',async()=>{
 let falha=true;
 const c=conta(async url=>{
  if(url.endsWith('pessoas')&&falha)throw Error('offline');
  if(url.endsWith('clientes')&&falha)return {ok:false,status:503};
  const data=url.endsWith('conta')?{pessoa:{nome:'Teste'}}:url.endsWith('pessoas')?{pessoas:[]}:url.endsWith('clientes')?{clientes:[]}:url.endsWith('acessos')?{acessos:[]}:{};
  return {ok:true,json:async()=>data};
 });
 await c.carregarConta();
 assert.equal(vm.runInContext('ERROS_DA_CONTA.equipe && ERROS_DA_CONTA.clientes',c),true);
 assert.match(c.corpoDaSecao('clientes',{}),/Não foi possível carregar/);
 falha=false;await c.carregarConta();assert.equal(vm.runInContext('Object.keys(ERROS_DA_CONTA).length',c),0);
 c.fetch=async()=>({ok:true,json:async()=>({})});await c.carregarConta();assert.equal(vm.runInContext('ERROS_DA_CONTA.equipe',c),true);
});
test('releitura antiga não sobrescreve resultado de tentativa mais recente',async()=>{
 const pendentes=[];let lenta=true;
 const c=conta(async()=>lenta?new Promise(resolve=>pendentes.push(resolve)):{ok:false});
 const antiga=c.carregarConta();lenta=false;await c.carregarConta();
 pendentes.forEach(resolve=>resolve({ok:true,json:async()=>({pessoa:{nome:'Antigo'},pessoas:[],clientes:[],acessos:[]})}));await antiga;
 assert.equal(vm.runInContext('MINHA_CONTA',c),null);assert.equal(vm.runInContext('ERROS_DA_CONTA.perfil',c),true);
});

test('carteira explícita prevalece, respeita alias, remoção e exceção da VOA',()=>{
 const c=vm.createContext({console,window:{},document:{},localStorage:{getItem:()=>null},safeText,CADASTRO_CLIENTES:[]});
 vm.runInContext(fonte('vybe-config.js'),c);vm.runInContext(fonte('vybe-core.js').split('// QUANDO FOI')[0],c);
 c.CADASTRO_CLIENTES=[{nome:'Hellen Rocha',responsavel:'Vinícius'},{nome:'VOA',responsavel:'Sem responsável geral'},{nome:'Alpha1',responsavel:'Ewerton'}];
 assert.equal(c.carteiraDoCliente('Hellen'),'vinicius');assert.equal(c.carteiraDoCliente('Alpha1'),'ewerton');assert.equal(c.carteiraDoCliente('VOA'),'');
 assert.match(c.descricaoCarteiraCliente('VOA'),/Site: Ewerton/);
 c.CADASTRO_CLIENTES[1].responsavel='Vinícius';assert.match(c.descricaoCarteiraCliente('VOA'),/Site: Ewerton/);
 assert.equal(c.carteiraDoCliente('Alpha1 nova'), '');
});

test('responsável geral persiste na ficha sem alterar heads; servidor recusa não administrador e campo inválido',async()=>{
 const {db,sql}=conexao();try{
 await db.exec(`CREATE TABLE vybe_clientes(id bigint primary key,nome text,email text,telefone text,endereco text,cnpj text,plano text,segmento text,responsavel text,planejamento_url text,valor numeric,proxima_reuniao date,ultima_reuniao date,nps smallint,nps_em date,dashboard text);
 INSERT INTO vybe_clientes(id,nome,responsavel) VALUES(1,'Teste','Legado');
 CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint); INSERT INTO vybe_cliente_pessoas VALUES(1,99);`);
 const c=vm.createContext({sql:()=>sql,garantirSchemaDeReunioes:async()=>{}});
 const s=fonte('api/painel.js');let start=s.indexOf('async function areaClientes');let end=s.indexOf('\nasync function ',start+1);
 vm.runInContext(s.slice(start,end),c);
 let status,corpo;const res={status(v){status=v;return this;},json(v){corpo=v;}};
 const req={method:'POST',body:{acao:'ficha',id:1,campos:{responsavel:'Vinícius'}}};
 await c.areaClientes(req,res,{pessoa:{admin:false}});assert.equal(status,403);
 for(const valor of ['Vinícius','Ewerton','Sem responsável geral']){
  req.body.campos.responsavel=valor;await c.areaClientes(req,res,{pessoa:{admin:true}});assert.equal(status,200,JSON.stringify(corpo));
  assert.equal((await sql`SELECT responsavel FROM vybe_clientes WHERE id=1`)[0].responsavel,valor);
 }
 req.body.campos.responsavel={nome:'Vinícius'};await c.areaClientes(req,res,{pessoa:{admin:true}});assert.equal(status,400);
 assert.equal((await sql`SELECT pessoa_id FROM vybe_cliente_pessoas`)[0].pessoa_id,99);
 assert.equal((await sql`SELECT responsavel FROM vybe_clientes`)[0].responsavel,'Sem responsável geral');
 }finally{await db.close();}
});
