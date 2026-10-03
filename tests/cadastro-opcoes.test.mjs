import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
const fonte = fs.readFileSync('cadastros_governed_v2.js','utf8');
function contexto(campo='format', extra={}) {
  const elementos = {
    'fc-nova-opcao': {dataset:{campo}}, 'fc-nova-opcao-nome': {value:'Novo formato',focus(){}},
    'fc-nova-opcao-erro':{}, 'fc-overlay':{setAttribute(){},removeAttribute(){}}
  };
  const c=vm.createContext({window:{},state:{board:'producao',client:'Cliente A',itens:[{titulo:'Preservar'}]},fcEnviando:false,
    fcQuadro:()=>({id:7829537690,rotuloFormato:'Formato',grupos:[],status:[]}),CADASTROS_FORMATS:[],FC_PRIORIDADES:[],
    CATALOGO_OPCOES:[],CATALOGO_CAPTACAO:[],STATUS_OPTIONS:[],CATALOGO_STATUS_DEMANDAS:[],CADASTRO_CLIENTES:[],
    podeEditarClientes:()=>true,podeEditarGrupos:()=>true,podeGerirEtiquetas:()=>true,cadastrosClientOptions:()=>[],
    document:{getElementById:id=>elementos[id],querySelector:()=>null},fcDesenharPasso(){},showToast(){},
    chamarEtiqueta:async dados=>({etiqueta:{chave:'novo_formato',rotulo:dados.rotulo,ativa:true}}),...extra});
  vm.runInContext(fonte.slice(fonte.indexOf('function fcConfigOpcao'),fonte.indexOf('// A regra de entrada')),c);
  return {c,elementos};
}
test('salva opção no catálogo correto e seleciona sem perder o conteúdo',async()=>{
  const {c}=contexto();await c.window.fcSalvarNovaOpcao();
  assert.equal(c.state.format,'Novo formato');assert.equal(c.state.client,'Cliente A');assert.equal(c.state.itens[0].titulo,'Preservar');
  assert.equal(c.CATALOGO_OPCOES[0].coluna_id,'lista_suspensa0__1');
  c.state.board='demandas';assert.equal(c.fcConfigOpcao('format').coluna,'dropdown_mkv8d52z');
  assert.equal(c.fcConfigOpcao('manualStatus').coluna,'status:7829537690');
});
test('erro e falta de permissão não selecionam opção nem apagam respostas',async()=>{
  const {c,elementos}=contexto('format',{chamarEtiqueta:async()=>{throw Error('Falha de gravação');}});
  await c.window.fcSalvarNovaOpcao();assert.equal(c.state.format,undefined);assert.equal(c.CATALOGO_OPCOES.length,0);
  assert.match(elementos['fc-nova-opcao-erro'].textContent,/Falha/);assert.equal(elementos['fc-overlay'].inert,false);
  c.podeGerirEtiquetas=()=>false;await c.window.fcSalvarNovaOpcao();assert.match(elementos['fc-nova-opcao-erro'].textContent,/administra/);
});
test('catálogo respeita quadro e opções desativadas; impede envio repetido',async()=>{
  let soltar, chamadas=0;const espera=new Promise(r=>soltar=r);
  const {c}=contexto('format',{chamarEtiqueta:async()=>{chamadas++;await espera;return {etiqueta:{chave:'novo',rotulo:'Novo'}};}});
  c.CATALOGO_OPCOES.push({coluna_id:'lista_suspensa0__1',rotulo:'Antigo',ativa:false},{coluna_id:'dropdown_mkv8d52z',rotulo:'Demanda',ativa:true});
  assert.equal(c.fcListaCatalogo('format').length,0);c.state.board='demandas';assert.deepEqual([...c.fcListaCatalogo('format')],['Demanda']);
  const pendente=c.window.fcSalvarNovaOpcao();await c.window.fcSalvarNovaOpcao();assert.equal(chamadas,1);soltar();await pendente;
  assert.equal(c.CATALOGO_OPCOES.at(-1).coluna_id,'dropdown_mkv8d52z');
});
test('cliente salvo é selecionado e aparece sem precisar ter atividades',async()=>{
  const {c}=contexto('client',{gravarCadastroDeCliente:async()=>({cliente:{id:23,nome:'Novo cliente',ativo:true}})});
  await c.window.fcSalvarNovaOpcao();assert.equal(c.state.client,'Novo cliente');
  const perfis=fs.readFileSync('vybe-perfis.js','utf8');c.DADOS=[];c.clientesDoItem=()=>[];
  vm.runInContext(perfis.slice(perfis.indexOf('function cadastrosClientOptions'),perfis.indexOf('function cadastrosAssigneeNames')),c);
  assert.deepEqual([...c.cadastrosClientOptions()],['Novo cliente']);
});
test('API de categorias persiste tipo de demanda e prioridade e recusa não administrador',async()=>{
  const {db,sql}=conexao();
  try {
    await db.exec(`CREATE TABLE vybe_status (board_id bigint,chave text,rotulo text,ordem int);
      CREATE TABLE vybe_captacao (chave text,monday_index int);
      CREATE TABLE vybe_opcoes (coluna_id text,chave text,rotulo text,cor text,borda text,indice int,ativa boolean,so_vybe boolean,PRIMARY KEY(coluna_id,chave));
      CREATE TABLE vybe_conteudos (formato_chaves text[],prioridade_chave text);`);
    const api=fs.readFileSync('api/painel.js','utf8');
    const trecho=api.slice(api.indexOf('const COLUNAS_EDITAVEIS'),api.indexOf('async function areaAcessos'));
    const c=vm.createContext({sql:()=>sql});vm.runInContext(trecho,c);
    const pedir=async(coluna,admin=true)=>{const r={status(n){this.code=n;return this;},json(d){this.body=d;return this;}};await c.areaOpcoes({method:'POST',body:{acao:'criar',coluna,rotulo:'Especial'}},r,{pessoa:{admin}});return r;};
    assert.equal((await pedir('dropdown_mkv8d52z',false)).code,403);
    assert.equal((await pedir('dropdown_mkv8d52z')).code,200);
    assert.equal((await pedir('color_mkwtgakv')).code,200);
    assert.equal((await pedir('dropdown_mkv8d52z')).code,409);
    assert.equal((await pedir('campo_inventado')).code,400);
    const linhas=await sql`SELECT coluna_id,rotulo FROM vybe_opcoes ORDER BY coluna_id`;
    assert.equal(linhas.length,2);assert.ok(linhas.every(l=>l.rotulo==='Especial'));
    await sql`INSERT INTO vybe_conteudos VALUES (ARRAY['especial'], 'especial')`;
    assert.equal(await c.contarUsoDaEtiqueta(sql,c.catalogoDeEtiquetas('dropdown_mkv8d52z'),'especial'),1);
    assert.equal(await c.contarUsoDaEtiqueta(sql,c.catalogoDeEtiquetas('color_mkwtgakv'),'especial'),1);
  } finally { await db.close(); }
});

test('status sugerido respeita catálogo do quadro e mantém o rótulo atual',()=>{
  const {c}=contexto('format',{chaveDeStatus:s=>String(s).toLowerCase().replaceAll(' ','_')});
  c.state.board='demandas';
  c.CATALOGO_STATUS_DEMANDAS.push({rotulo:'Nova Demanda',ativa:true},{rotulo:'Pode Fazer',ativa:true});
  assert.equal(c.fcStatusSugerido('A Fazer'),'Nova Demanda');
  assert.equal(c.fcStatusSugerido('pode fazer'),'Pode Fazer');
  c.CATALOGO_STATUS_DEMANDAS[0].ativa=false;
  assert.equal(c.fcStatusSugerido('A Fazer'),'Pode Fazer');
});
