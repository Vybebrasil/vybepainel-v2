import { QUARTOS } from '../server/escritorio-quartos.js';
import { demoWhatsapp } from './fixtures-whatsapp.mjs';
// Exclusivo do servidor local. Nenhuma consulta ou gravação externa.
import { readFileSync } from 'node:fs';
import { salasDoEscritorio } from '../server/escritorio-mapa.js';
import { vitrineDaSemana } from '../server/escritorio-economia.js';
import { MARCOS, criterioDoMarco, tituloDe } from '../server/escritorio-marcos.js';
import { ATIVIDADES_DO_RANKING, periodoTrabalho, somarDias, diaBahia, inicioDaSemana } from '../server/escritorio-pontos.js';
import { raridadesDoCatalogo } from './escritorio-raridades.mjs';
import { documentoHtml } from '../server/planejamento-documento.js';
// Loja de demonstração: as mesmas faixas da migração da fase 2, estoque cheio,
// vitrine sorteada pela semana corrente; os marcos só ilustram a ficha.
const RARIDADES_DEMO=[{chave:'comum',nome:'Comum',ordem:1,preco:40,estoque:null,vitrine:0},{chave:'incomum',nome:'Incomum',ordem:2,preco:120,estoque:null,vitrine:0},
  {chave:'raro',nome:'Raro',ordem:3,preco:300,estoque:10,vitrine:0},{chave:'epico',nome:'Épico',ordem:4,preco:900,estoque:3,vitrine:6},{chave:'lendario',nome:'Lendário',ordem:5,preco:2500,estoque:1,vitrine:2}];
const MOVEIS_DE_MARCO_DEMO={duzentas:'trophy_ltd23_goldmonsterplant',quinhentas:'se_trophyS',maratona:'legotrophy',semfuro:'trophy_ltd23_silvermonsterplant',nivel20:'se_trophyG',meta4:'school_consolegold'};
function lojaDemo(){
  const semana=inicioDaSemana(diaBahia());
  const itens=Object.entries(raridadesDoCatalogo()).map(([classe,raridade])=>{const f=RARIDADES_DEMO.find(r=>r.chave===raridade);
    return {classe,raridade,preco:f.preco,restante:f.estoque,marco:Object.keys(MOVEIS_DE_MARCO_DEMO).find(k=>MOVEIS_DE_MARCO_DEMO[k]===classe)||null};});
  return {semana,raridades:RARIDADES_DEMO,itens,vitrine:vitrineDaSemana({semana,raridades:RARIDADES_DEMO,itens})};
}
// Conquistas no formato do servidor (níveis Bronze a Diamante, conferirMarcos):
// a ficha e a janela de Conquistas só abrem com os degraus.
const NIVEIS_DEMO=['','Bronze','Prata','Ouro','Diamante'],TROFEUS_DEMO=Object.values(MOVEIS_DE_MARCO_DEMO);
const marcosDemo=()=>MARCOS.map((m,k)=>{const especial=['implementacoes','motions'].includes(m.id),metas=m.id==='implementacoes'?[5,20,60,150]:m.id==='motions'?[10,40,120,300]:[10,50,200,1000].map(x=>x*(k%3+1)),valor=[35,120,8,460,0,64][k%6],em=new Date(Date.now()-3*864e5).toISOString();
  const degraus=metas.map((meta,i)=>({nivel:i+1,meta,classe:TROFEUS_DEMO[(k+i)%TROFEUS_DEMO.length],nome:NIVEIS_DEMO[i+1],ok:valor>=meta,em:valor>=meta?em:null,titulo:tituloDe(m.id,i+1),moedas:especial?[10,20,40,100][i]:20*(i+1),pontos:especial?[25,50,100,200][i]:40*(i+1)}));
  const nivel=degraus.filter(d=>d.ok).length,proximo=degraus[nivel]||null;
  return {id:m.id,nome:m.nome,criterio:criterioDoMarco(m.id),nivel,nomeNivel:NIVEIS_DEMO[nivel]||'',social:false,valor,unidade:m.unidade,proximo:proximo?{nivel:proximo.nivel,nome:proximo.nome,meta:proximo.meta,classe:proximo.classe}:null,degraus,ok:nivel>0,em:nivel?em:null,dica:proximo?`${proximo.meta} ${m.unidade}`:'Nível máximo',moveis:[(proximo||degraus.at(-1)).classe]};});
import { GRUPOS_PADRAO, CORES_DE_GRUPO } from '../server/grupos.js';
import { SECOES_CADASTRO, CAMPOS_CADASTRO, separarCampos, estadoNoEcossistema } from '../server/clientes-cadastro.js';
// Cadastro de clientes fictício, em estados diferentes (completo, pela metade, só o nome), para a ficha e o
// Ecossistema aparecerem como na operação. Fica em memória: reiniciar a prévia volta ao começo.
const CLIENTES_DEMO=['Academia Lions','Alpha1','Antonov','Brussolo Ristorante','ConectaSim','Copirecê','DiaCenter','DiaLab','Gonzalez','Hebravet','Hellen','Mangaba AI','Serra Grande Bebidas','VOA','Experimente Papelaria']
  .map((nome,i)=>({id:i+1,nome,ativo:true,status:'Ativo',responsavel:i%2?'Ewerton':'Vinícius',heads:'Operador de teste',heads_ids:[1],
    segmento:['Academia','Solução empresarial','Academia','Restaurante','Provedor de internet'][i%5],plano:i%3?'Plus':'',
    cnpj:i%4===0?'12.345.678/0001-'+String(10+i).padStart(2,'0'):'',endereco:i%2?'':'Rua São Francisco, '+(100+i)+', Centro',email:'',telefone:'',valor:null,
    cadastro:i===0?{razao_social:'Lions Top Academia LTDA',cidade:'Irecê',uf:'BA',contato_nome:'Carla (fictícia)',contato_cargo:'Sócia',contato_whatsapp:'(74) 99999-0001',
      tipo_contrato:'Mensal recorrente',contrato_inicio:'2026-02-01',instagram:'@academialions',grupo_whatsapp:'Lions x Vybe',escopo:'12 posts e 8 stories por mês, 2 reels, tráfego no Instagram.'}
      :i%3===0?{cidade:'Irecê',uf:'BA',instagram:'@cliente'+i}:{}}));
const ACESSOS_DEMO=[{id:'a1',nome:'Dados & Acessos - Academia Lions',cliente_id:1,cliente:'Academia Lions',grupo:'',drive:'https://drive.google.com/drive/folders/demo-lions',link:'',manus:false,documento:true,atualizado_em:new Date().toISOString()}];
function clientesDemo(req,res,url,body,reply){
  const regs=url.searchParams.get('registros');
  if(regs)return reply(200,{ok:true,registros:regs==='1'?[{id:1,tipo:'regra_de_marca',titulo:'Sem fundo preto nas peças',status:'aprovado',resumo:'A cliente pediu fundos claros em todas as artes de novembro.',
    decisoes:'Nunca usar fundo preto. Laranja só em destaque.',proximos:'Danilo ajusta os modelos até sexta.',conteudo:null,origem:'Claude.ai · gestao',drive_id:'demo',drive_erro:null,criado_em:new Date().toISOString()},
    {id:2,tipo:'conteudo',titulo:'Legenda do post de promoção',status:'enviado_ao_cliente',resumo:'Legenda aprovada pelo chat e enviada para aprovação.',decisoes:null,proximos:null,
    conteudo:'Bora treinar? 💪 Matrícula com 20% em novembro.',origem:'Claude.ai · segunda',drive_id:null,drive_erro:'Drive 503',criado_em:new Date(Date.now()-864e5).toISOString()}]:[]});
  const eco=url.searchParams.get('ecossistema');
  if(eco){const c=CLIENTES_DEMO.find(x=>String(x.id)===eco);if(!c)return reply(404,{error:'Cliente não encontrado.'});
    const a=ACESSOS_DEMO.find(x=>x.cliente_id===c.id)||null;
    const financas=c.cnpj?{estado:'lido',ligacao:{financas_id:'f'+c.id,financas_nome:c.nome+' (Finanças)',vybe_id:String(c.id),vybe_nome:c.nome,por:'cnpj'}}:{estado:'lido',ligacao:null};
    return reply(200,{ok:true,cliente:{id:String(c.id),nome:c.nome},sistemas:estadoNoEcossistema({cliente:c,acesso:a,financas,hubUrl:'https://hub.example.test'})});}
  if(req.method==='POST'){let d={};try{d=JSON.parse(String(body||'{}'));}catch{return reply(400,{error:'JSON inválido.'});}
    try{
      if(d.acao==='criar'){const nome=String(d.nome||'').trim();if(!nome)return reply(400,{error:'Informe o nome do cliente.'});
        const ja=CLIENTES_DEMO.find(x=>x.nome.toLowerCase()===nome.toLowerCase());
        const c=ja||{id:CLIENTES_DEMO.length+1,nome,ativo:true,status:'Ativo',heads:'',heads_ids:[],cadastro:{}};if(!ja)CLIENTES_DEMO.push(c);
        if(d.campos)aplicarDemo(c,d.campos);return reply(200,{ok:true,cliente:{id:c.id,nome:c.nome,ativo:true},...(ja?{ja_existia:true}:{})});}
      if(d.acao==='cadastro'){const c=CLIENTES_DEMO.find(x=>String(x.id)===String(d.id));if(!c)return reply(404,{error:'Cliente não encontrado.'});
        aplicarDemo(c,d.campos);return reply(200,{ok:true,cliente:{id:c.id,nome:c.nome}});}
    }catch(e){return reply(e.status||400,{error:e.message});}
    if(d.acao==='atas')return reply(200,{ok:true,atas:[],eventos:[]});
    return reply(200,{ok:true});}
  return reply(200,{ok:true,clientes:CLIENTES_DEMO,pessoas:[pessoa],acessos:ACESSOS_DEMO,cadastro_def:{secoes:SECOES_CADASTRO,campos:CAMPOS_CADASTRO}});
}
function aplicarDemo(c,campos){const {colunas,extras}=separarCampos(campos);Object.assign(c,colunas);
  for(const [k,v] of Object.entries(extras)){if(v)c.cadastro[k]=v;else delete c.cadastro[k];}}
const pessoa={id:1,nome:'Operador de teste',email:'operador@example.test',admin:true};
// As Notas gravam na demonstração: são um caderno em memória, sem banco nem
// Monday atrás, e é a única forma de exercitar a tela local de ponta a ponta.
let NOTAS_DEMO=[{id:1,titulo:'17/09 · notas do dia',
  corpo:'# Prioridades\n[] Falar com o cliente do carrossel\n[x] Mandar o card para aprovação\n- lembrar do **prazo de ouro**\n\nTexto solto de exemplo.',
  item_ref:'',caderno:'Notas do dia',criado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()},
  {id:2,titulo:'Copirecê · pendências',corpo:'[] cobrar impressos\n[x] mandar card do cardápio',item_ref:'',
   caderno:'Clientes',criado_em:new Date().toISOString(),atualizado_em:new Date(Date.now()-3600000).toISOString()}];
const cadernosDemo=()=>{const mapa=new Map();NOTAS_DEMO.forEach(n=>{const c=n.caderno||'Notas do dia';
  const atual=mapa.get(c)||{nome:c,notas:0,mexido_em:n.atualizado_em};atual.notas+=1;mapa.set(c,atual);});
  return [...mapa.values()];};
function notasDemo(req,url,body,reply){
  if(req.method==='GET'){
    const termo=String(url.searchParams.get('busca')||'').toLowerCase();
    return reply(200,{ok:true,cadernos:cadernosDemo(),
      notas:NOTAS_DEMO.filter(n=>!termo||`${n.titulo} ${n.corpo}`.toLowerCase().includes(termo))});
  }
  if(req.method==='POST'){
    let d;try{d=JSON.parse(body.toString());}catch{return reply(400,{error:'JSON inválido.'});}
    const agora=new Date().toISOString();
    if(d.acao==='caderno_renomear'){
      NOTAS_DEMO=NOTAS_DEMO.map(n=>(n.caderno||'Notas do dia')===d.de?{...n,caderno:String(d.para)}:n);
      return reply(200,{ok:true,de:d.de,para:d.para});
    }
    if(d.acao==='caderno_apagar'){
      NOTAS_DEMO=d.apagar_notas
        ? NOTAS_DEMO.filter(n=>(n.caderno||'Notas do dia')!==d.caderno)
        : NOTAS_DEMO.map(n=>(n.caderno||'Notas do dia')===d.caderno?{...n,caderno:String(d.mover||'Notas do dia')}:n);
      return reply(200,{ok:true,caderno:d.caderno});
    }
    const nota={id:Number(d.id)||Math.floor(Date.now()%100000),titulo:String(d.titulo||''),corpo:String(d.corpo||''),
      item_ref:d.item_ref||'',caderno:String(d.caderno||'Notas do dia'),criado_em:agora,atualizado_em:agora};
    NOTAS_DEMO=[nota,...NOTAS_DEMO.filter(n=>Number(n.id)!==Number(nota.id))];
    return reply(200,{ok:true,nota});
  }
  if(req.method==='DELETE'){
    const id=Number(url.searchParams.get('id')||0);
    NOTAS_DEMO=NOTAS_DEMO.filter(n=>Number(n.id)!==id);
    return reply(200,{ok:true,apagada:id});
  }
  return reply(405,{error:'Método não permitido.'});
}
export async function demoApi(req,res,url,body) {
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const sessao=String(req.headers.cookie||'').includes('vybe_demo=1');
  if(url.pathname==='/api/sessao') {
    if(req.method==='GET' && url.searchParams.has('rostos')) return reply(200,{ok:true,rostos:[{id:1,nome:'Operador',iniciais:'OT',foto:null}]});
    if(req.method==='DELETE'){res.setHeader('Set-Cookie','vybe_demo=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return reply(200,{ok:true});}
    if(req.method==='POST'){
      let data;try{data=JSON.parse(body.toString());}catch{return reply(400,{error:'JSON inválido.'});}
      if(data.senha!=='demo-local')return reply(401,{error:'Use a senha demo-local neste ambiente fictício.'});
      res.setHeader('Set-Cookie','vybe_demo=1; Path=/; HttpOnly; SameSite=Lax');return reply(200,{ok:true,pessoa});
    }
    return reply(sessao?200:401,sessao?{ok:true,pessoa}:{error:'Sem sessão.'});
  }
  // Convidado de demonstração: qualquer link abre e a entrada é fictícia (sem Worker).
  if(url.pathname==='/api/painel' && url.searchParams.get('area')==='convite'){
    const acao=url.searchParams.get('acao');
    const {BONECOS_CONVIDADO,ZONAS_DO_CONVIDADO}=await import('../server/escritorio-convite.js');
    if(acao==='abrir')return reply(200,{ok:true,anfitriao:{nome:'Operador de teste'},bonecos:BONECOS_CONVIDADO,expira:new Date(Date.now()+12*3600e3).toISOString()});
    if(acao==='sair'){res.setHeader('Set-Cookie','vybe_convidado=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return reply(200,{ok:true});}
    if(acao!=='entrar' && acao!=='entrada')return reply(403,{error:'A demonstração não abre voz para convidados.'});
    if(acao==='entrada' && !/vybe_convidado=demo/.test(req.headers.cookie||''))return reply(401,{error:'Sem convite.'});
    const equipeDemo=['Operador de teste','Design demonstração'].map((nome,i)=>({id:String(i+1),nome,perfil:{roupa:['laranja','azul'][i],pele:'media',cabelo:'curto',sala:'convivencia',x:50,y:70,abertura:'2026-10-17',quarto_configurado:true}}));
    const salas=salasDoEscritorio(equipeDemo).map((s,i)=>i===0?{...s,pessoa_id:'1'}:s);
    let corpo={};try{corpo=JSON.parse(body?.toString()||'{}');}catch{}
    const nome=String(corpo.nome||'Convidado de teste').slice(0,40), b=Number(corpo.boneco)||0;
    const eu={id:'c-000000000000',nome,perfil:{figura:BONECOS_CONVIDADO[b]?.figura||BONECOS_CONVIDADO[0].figura,sala:'convivencia',x:50,y:70,abertura:'2026-10-17',quarto_configurado:true}};
    if(acao==='entrar')res.setHeader('Set-Cookie','vybe_convidado=demo; Path=/; HttpOnly; SameSite=Lax');
    return reply(200,{ok:true,demo:true,convidado:{id:eu.id,nome,anfitriao:{id:'1',nome:'Operador de teste'},salaAnfitriao:'sala-0',zonas:['sala-0','sala-0-andar-1',...ZONAS_DO_CONVIDADO],vozes:['sala-0','sala-0-andar-1'],expira:new Date(Date.now()+12*3600e3).toISOString()},
      quartos:QUARTOS,economia:{disponivel:false},eu:eu.id,admin:false,worker:null,token:null,equipe:[...equipeDemo,eu],salas,mapa:{editavel:false,camadas:{}}});
  }
  // O convidado de demonstração vê a arte do mapa, como no servidor de verdade.
  const artesDoConvidado=/vybe_convidado=demo/.test(req.headers.cookie||'') && url.pathname==='/api/painel' && url.searchParams.get('area')==='escritorio' && ['arte','boneco','imagem'].includes(url.searchParams.get('acao'));
  // A página do cliente abre sem sessão, como o link de verdade.
  const paginaDoCliente=url.pathname==='/api/painel'&&url.searchParams.get('area')==='planejamentos'&&url.searchParams.get('acao')==='previa-cliente';
  if(!sessao && !artesDoConvidado && !paginaDoCliente)return reply(401,{error:'Entre no ambiente de demonstração.'});
  if(url.pathname==='/api/conteudo' && req.method==='POST') {
    let data;try {data=JSON.parse(body.toString());}catch{return reply(400,{error:'JSON inválido.'});}
    if(data.acao==='clientes_opcoes')return reply(200,{ok:true,clientes:[
      {id:'1',nome:'Cliente demonstração',ativo:true,selecionado:true},
      {id:'2',nome:'Segundo cliente demonstração',ativo:true,selecionado:false}]});
  }
  if(url.pathname==='/api/painel' && url.searchParams.get('area')==='notas') return notasDemo(req,url,body,reply);
  // Os grupos de partida, os mesmos que a conferência do banco semeia.
  if(url.pathname==='/api/painel' && url.searchParams.get('area')==='grupos' && req.method==='GET')
    return reply(200,{ok:true,pronto:true,grupos:GRUPOS_PADRAO,cores:CORES_DE_GRUPO});
  // Conferência é leitura mesmo por POST; não libera as gravações da demo.
  if(req.method==='POST' && url.pathname==='/api/painel' && url.searchParams.get('area')==='escritorio' && url.searchParams.get('acao')==='construcao-conferir') {
    try {
      const { conferirEditorEscritorio } = await import('../server/escritorio-construcao.js');
      const entrada=JSON.parse(body.toString());
      const sql=()=>Promise.resolve([{preferencias:{sala_planta:'amplo'}}]);
      return reply(200,{ok:true,...await conferirEditorEscritorio(sql,{id:1,admin:true},salasDoEscritorio([{id:1,nome:'Paulo'}]),entrada)});
    } catch(e) { return reply(e.status || 400,{error:e.message}); }
  }
  // Cadastro de clientes fictício em memória (clientesDemo): grava só aqui, para o fluxo de cadastro dar para ser conferido.
  if(req.method==='POST' && url.pathname==='/api/painel' && sessao && ['clientes','acessos'].includes(url.searchParams.get('area'))) {
    if(url.searchParams.get('area')==='clientes')return clientesDemo(req,res,url,body,reply);
    let d={};try{d=JSON.parse(String(body||'{}'));}catch{}
    let a=ACESSOS_DEMO.find(x=>x.id===d.id)||ACESSOS_DEMO.find(x=>String(x.cliente_id)===String(d.cliente));
    const c=CLIENTES_DEMO.find(x=>String(x.id)===String(d.cliente||a?.cliente_id));
    if(!a&&c){a={id:'a'+c.id,nome:'Dados & Acessos - '+c.nome,cliente_id:c.id,cliente:c.nome,grupo:'',drive:'',link:'',manus:false,documento:false,atualizado_em:new Date().toISOString()};ACESSOS_DEMO.push(a);}
    if(a&&d.pasta_drive!==undefined)a.drive=d.pasta_drive;return reply(200,{ok:true});
  }
  if(req.method!=='GET')return reply(403,{error:'Demonstração de interface somente leitura. As gravações são testadas no PostgreSQL em memória.'});
  if(url.pathname==='/api/conteudos') {
    const demanda=url.searchParams.get('board')==='demandas';
    const hoje=new Date().toISOString().slice(0,10);
    const itens=demanda?[{id:'vybe:2',nome:'Reunião de alinhamento fictícia',cliente:'Cliente demonstração',formato:'Reunião',prazo_iso:hoje,veiculacao_iso:hoje,status_chave:'a_fazer',grupo:'Solicitações',responsavel_ids:['68035537']}]:[{id:'vybe:1',nome:'Peça fictícia para verificar o painel',cliente:'Cliente demonstração',clientes:['Cliente demonstração'],
      formato:'Card',prazo_iso:hoje,veiculacao_iso:hoje,status_chave:'a_fazer',grupo:'Redação',grupo_id:'group_title',
      responsavel_ids:['68035537'],updated_at:new Date().toISOString()}];
    // DEMO_VOLUME=1: o mês cheio, para conferir as telas com volume de verdade
    // (Paulo, 28/10/2026: o calendário com 478 peças "parece que nem passou
    // perto"). Determinístico; desligado por padrão.
    if(process.env.DEMO_VOLUME&&!demanda) itens.push(...volumeDemonstracao());
    // A demonstração responde como o servidor de verdade também na leitura
    // incremental: sem isto, o ambiente local só exercitaria o plano B — a
    // releitura inteira — e o caminho que roda quatro vezes por minuto em
    // produção nunca seria visto antes de chegar lá.
    const assinatura='demonstracao-conjunto-fixo';
    if(url.searchParams.get('desde')) {
      const mesmo=url.searchParams.get('assinatura')===assinatura;
      return reply(200,{ok:true,incremental:true,board_id:demanda?8385559107:7829537690,
        gerado_em:new Date().toISOString(),assinatura,total_no_recorte:itens.length,
        mudou:!mesmo,itens:mesmo?[]:itens,...(mesmo?{}:{ids:itens.map(i=>i.id)})});
    }
    return reply(200,{ok:true,board_id:demanda?8385559107:7829537690,
      total:itens.length,gerado_em:new Date().toISOString(),assinatura,total_no_recorte:itens.length,
      status:[{chave:'a_fazer',rotulo:'A Fazer',cor:'#c4c4c4',borda:'#c4c4c4',monday_index:0},...(process.env.DEMO_VOLUME?[['pode_fazer','Pode Fazer','#ffcb00'],['em_andamento','Em Andamento','#fdab3d'],['para_aprovacao','Para aprovação','#579bfc'],['agendado','Agendado','#a1e3f6'],['finalizado','Finalizado','#9cd326'],['alteracao','Alteração','#df2f4a'],['ag_info_cliente','Ag. Info Cliente','#bca58a']].map(([chave,rotulo,cor],i)=>({chave,rotulo,cor,borda:cor,monday_index:i+1})):[])],
      captacao:[],opcoes:[],pessoas:[{id:'68035537',nome:'Operador de teste'}],itens});
  }
  if(url.pathname==='/api/painel'){
    if(url.searchParams.get('area')==='historico')return reply(200,{ok:true,logs:{moveEvents:{},prazoEvents:{},statusEvents:{},veiculacaoEvents:{},ownerEvents:{}}});
    const area=url.searchParams.get('area');
    if(area==='conta')return reply(200,{ok:true,pessoa});
    // Módulo Conteúdo (vybe-mundo-conteudo.js): objetivos determinísticos nas peças do DEMO_VOLUME
    // (de vez em quando nenhum, para a tela mostrar "sem objetivo") e um cliente para o link de aprovação.
    if(area==='conteudo_modulo'&&url.searchParams.get('acao')==='objetivos'){
      const objetivos={'vybe:1':'atracao'},respostas={};
      if(process.env.DEMO_VOLUME)for(let i=0;i<300;i++){const o=['atracao','atracao','educacao','conversao',null][(i*7)%5];if(o)objetivos[`vybe:${1000+i}`]=o;if(i%9===0)respostas[`vybe:${1000+i}`]={acao:i%2?'ajuste':'aprovar',nome:'Cliente fictício',em:new Date().toISOString()};}
      return reply(200,{ok:true,pronto:true,objetivos,respostas});
    }
    if(area==='conteudo_modulo'&&url.searchParams.get('acao')==='aprovacao')return reply(200,{ok:true,pronto:true,clientes:[{id:'1',nome:'Cliente demonstração',pendentes:2,links:[{id:'1',cliente_id:'1',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+14*864e5).toISOString(),ultimo_acesso_em:null,criado_por:'Operador de teste',respostas:0}]}]});
    if(area==='escritorio') {
      // Convite de demonstração (a demo não grava): o link fictício só mostra a tela.
      if(url.searchParams.get('acao')==='convite')return reply(200,{ok:true,link:url.origin+'/#convite=demonstracao-do-convite-local',expira:new Date(Date.now()+12*3600e3).toISOString()});
      if(url.searchParams.get('acao')==='convite-cancelar')return reply(200,{ok:true});
      if(url.searchParams.get('acao')==='mensagens')return reply(200,{ok:true,mensagens:[]});
      // Perfil de demonstração (números fictícios, só para a tela).
      if(url.searchParams.get('acao')==='perfil-publico'){const id=url.searchParams.get('pessoa')||'1';const n=Number(id)||1;return reply(200,{ok:true,perfil:{...(url.searchParams.get('trabalho')==='1'?{trabalho:trabalhoDemonstracao(n,Object.fromEntries(url.searchParams))}:{}),disponivel:true,saldo:700-n*90,nivel:4-n%3,xp:20*n,xpProximo:140,xpTotal:300-n*40,conquistas:5-n,inventario:[{classe:'hygge_c25_carpet',quantidade:1},{classe:'plant_small_cactus',quantidade:2},{classe:'exe_table',quantidade:1}].slice(0,4-n%3)}});}
      // Missões de demonstração (fictícias): mesma forma da rota de verdade.
      if(url.searchParams.get('acao')==='missoes'){const d=(n)=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
        return reply(200,{ok:true,disponivel:true,funcao:'criacao',missoes:[
          {ref:'vybe:1',quadro:'producao',titulo:'Cardápio impresso fictício',cliente:'Cliente demonstração',formato:'Impresso',peso:3,status:'Pode Fazer',grupo:'Criação',prazo:d(-2),atrasada:true,hoje:false,recompensa:{moedas:12,pontos:30},bonus:{moedas:6,pontos:15,descricao:'Peça aprovada sem alteração'}},
          {ref:'vybe:1',quadro:'producao',titulo:'Carrossel de três dúvidas',cliente:'Cliente B (fictício)',formato:'Carrossel',peso:2,status:'Em andamento',grupo:'Redação',prazo:d(0),atrasada:false,hoje:true,recompensa:{moedas:8,pontos:20},bonus:null},
          {ref:'vybe:1',quadro:'producao',titulo:'Card de domingo',cliente:'Cliente C (fictício)',formato:'Card',peso:1,status:'Pode Fazer',grupo:'Criação',prazo:d(3),atrasada:false,hoje:false,recompensa:{moedas:4,pontos:10},bonus:null},
          {ref:'vybe:2',quadro:'demandas',titulo:'Reels de bastidores',cliente:'Cliente D (fictício)',formato:'Reels',peso:2.5,status:'Pode Fazer',prazo:d(5),atrasada:false,hoje:false,recompensa:{moedas:13,pontos:25},bonus:null}]});}
      // Dia de cada pessoa (fictício): hoje, ontem, adiada e atrasada.
      if(url.searchParams.get('acao')==='dia'){const d=(n)=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
        // Cores fictícias de status, só para ver a etiqueta colorida na demonstração.
        const cores={'Para aprovação':'#579bfc','Em andamento':'#fdab3d','Pode Fazer':'#c4c4c4','Finalizado':'#00c875','Para agendar':'#9d50dd','Agendado':'#037f4c','Alteração':'#e2445c'};
        const p=(titulo,estado,status,prazo,extra={})=>({ref:'vybe:1',quadro:'producao',titulo,clientes:['Cliente demonstração'],status,status_cor:cores[status]||'',prazo,veiculacao:null,estado,pronta_em:estado==='pronta'?prazo:null,adiada:null,...extra});
        return reply(200,{ok:true,hoje:d(0),ontem:d(-1),pessoas:{
          '1':{hoje:[p('Card de promoção','fazendo','Em andamento',d(0),{clientes:['VOA']}),p('Reels do dia','falta','Pode Fazer',d(0)),p('Story da promoção','pronta','Finalizado',d(0)),p('Carrossel de serviços','falta','Pode Fazer',d(2),{adiada:{campo:'prazo',para:d(2)}})],ontem:[p('Cardápio novo','pronta','Para agendar',d(-1)),p('Post institucional','falta','Alteração',d(-1))],atrasadas:[p('Post institucional','falta','Alteração',d(-1))]},
          '2':{hoje:[p('Arte do evento','pronta','Finalizado',d(0),{clientes:['Gonzalez']}),p('Banner do site','pronta','Agendado',d(0))],ontem:[p('Post do feriado','depois','Finalizado',d(-1),{pronta_em:d(0)})],atrasadas:[]},
          '3':{hoje:[p('Vídeo depoimento','fazendo','Em andamento',d(0))],ontem:[],atrasadas:[p('Corte dos reels','falta','Para aprovação',d(-3))]}}});}
      // Cobranças de demonstração (fictícias) para o quarto de qualquer pessoa.
      if(url.searchParams.get('acao')==='cobrancas')return reply(200,{ok:true,cobrancas:[
        {ref:'vybe:1',quadro:'producao',titulo:'Card de promoção',status:'Em andamento',cliente_id:'1',cliente:'Cliente demonstração',segmento:'Cooperativa',tipo:'atrasada',data:'2026-10-14',dias:5},
        {ref:'vybe:1',quadro:'producao',titulo:'Cardápio novo',status:'Para aprovação',cliente_id:'2',cliente:'Cliente B (fictício)',segmento:'Restaurante',tipo:'atrasada',data:'2026-10-18',dias:1},
        {ref:'vybe:1',quadro:'producao',titulo:'Story da promoção',status:'Pode Fazer',cliente_id:'1',cliente:'Cliente demonstração',segmento:'Cooperativa',tipo:'vence',data:'2026-10-21',dias:-1},
        {ref:'vybe:1',quadro:'producao',titulo:'Look da semana',status:'Em andamento',cliente_id:'5',cliente:'VOA',segmento:'Moda',tipo:'atrasada',data:'2026-10-17',dias:2},
        {ref:'vybe:1',quadro:'producao',titulo:'Reels do dia',status:'Pode Fazer',cliente_id:'3',cliente:'Cliente C (fictício)',segmento:'Clinica',tipo:'hoje',data:'2026-10-19',dias:0},
        {ref:'vybe:2',quadro:'demandas',titulo:'Fotos da fachada',status:'Ag. Info Cliente',cliente_id:'4',cliente:'Cliente D (fictício)',segmento:'PetShop',tipo:'lembrar_cliente',data:'2026-10-19',dias:0}]});
      if(url.searchParams.get('acao')==='trocas')return reply(200,{ok:true,trocas:{disponivel:true,recebidas:[{id:'7',de_pessoa:'2',para_pessoa:'1',oferece:[['bling_sofa_mu',1]],pede:[['shelves_norja',1]],estado:'aberta',criado_em:new Date().toISOString()}],enviadas:[]}});
      // Ranking de demonstração (fictício), com a mesma forma da rota de verdade.
      if(url.searchParams.get('acao')==='ranking'){
        const per=url.searchParams.get('periodo')||'semana', hoje=new Date().toISOString().slice(0,10);
        const soma=(iso,n)=>{const t=new Date(iso+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
        const seg=soma(hoje,-((new Date(hoje+'T12:00:00Z').getUTCDay()+6)%7));
        const ini=per==='dia'?hoje:per==='mes'?hoje.slice(0,8)+'01':per==='total'?null:seg, fim=per==='dia'?hoje:per==='mes'?soma(soma(hoje.slice(0,8)+'01',32).slice(0,8)+'01',-1):per==='total'?hoje:soma(seg,6);
        const f={dia:.2,semana:1,mes:4.3,total:30}[per]||1;
        const base=[['1','Operador de teste','gestao',38,160,52,'peca_gestao'],['2','Design demonstração','criacao',31,22,140,'peca_criacao'],['3','Edição demonstração','criacao',9,8,120,'peca_criacao'],['4','Atendimento demonstração','atendimento',44,40,88,'peca_atendimento'],['5','Produção demonstração','producao',27,30,70,'peca_producao'],['6','Agendamento demonstração','agendamento',35,45,64,'peca_agendamento']];
        const dias=[];for(let x=ini||soma(hoje,-77);x<=(fim<hoje?fim:hoje)&&dias.length<40;x=soma(x,per==='total'?7:1))dias.push(x);
        const pessoas=base.map(([id,nome,funcao,ent,meta,xp,regra],k)=>{const e=Math.round(ent*f),m=Math.max(1,Math.round(meta*f));return{id,nome,funcao,meta:m,entregas:e,pct:Math.round(e/m*100),xp:Math.round(xp*f*3),moedas:Math.round(xp*f*1.2),
          atividades:{[regra]:e,entrega_prazo:Math.round(e*.7),acao_painel:Math.round(30*f),briefing:funcao==='gestao'?Math.round(20*f):0},xpPor:{[regra]:Math.round(xp*f*3)},porRegra:{[regra]:e},demandasDistintas:e,formatos:{[regra]:k===2?{reels:e}:{card:Math.floor(e/2),fotografia:e-Math.floor(e/2)}},pecas:[],
          ritmo:dias.map((d,i)=>[d,Math.round(xp*(.4+((i*7+k*3)%5)/5))]),sequencia:[6,4,1,9,3,2][k],xpTotal:[4200,9800,8700,5100,6900,4800][k],nivel:[17,26,25,19,23,18][k]};});
        pessoas.sort((a,b)=>b.pct-a.pct);pessoas.forEach((p,i)=>{p.posicao=i+1;p.antes=per==='total'?null:[2,1,5,4,3,6][i];});
        if(per==='total'){pessoas.sort((a,b)=>b.xpTotal-a.xpTotal);pessoas.forEach((p,i)=>p.posicao=i+1);}
        return reply(200,{ok:true,disponivel:true,periodo:per,inicio:ini,fim,hoje,pessoas,regras:{peca_criacao:'Peça feita por você',peca_gestao:'Peça da agência (geral)',peca_atendimento:'Peça de cliente da sua carteira (head)',peca_producao:'Foto ou vídeo captado por você',peca_agendamento:'Peça agendada ou finalizada por você (quem postou)'},
          atividades:[],premios:[{chave:'ranking_1',moedas:50,pontos:100,classe:null},{chave:'ranking_2',moedas:30,pontos:60,classe:null},{chave:'ranking_3',moedas:20,pontos:40,classe:null},{chave:'meta_agencia',moedas:20,pontos:40,classe:null}],
          agencia:{pecas:Math.round(118*f),meta:Math.round(145*f),pct:81,bateu:false},patrimonio:base.map(([id,nome,funcao],k)=>({id,nome,funcao,saldo:[420,1900,1500,650,1090,110][k],moveis:[13,22,17,20,10,29][k],distintos:[10,18,14,15,8,22][k],lendarios:[0,1,1,0,0,2][k],epicos:[1,2,0,1,0,1][k],trofeus:[1,2,1,1,1,0][k]})),
          anterior:{inicio:soma(seg,-7),fim:soma(seg,-1),podio:[{id:'2',nome:'Design demonstração',posicao:1},{id:'4',nome:'Atendimento demonstração',posicao:2},{id:'5',nome:'Produção demonstração',posicao:3}],agenciaBateu:true}});
      }
      // Recados de demonstração (a demo não grava).
      if(url.searchParams.get('acao')==='recados-resumo')return reply(200,{ok:true,resumo:[{de:'2',nao_lidos:1,ultimo:new Date().toISOString()}]});
      if(url.searchParams.get('acao')==='recados')return reply(200,{ok:true,recados:url.searchParams.get('com')==='2'?[{id:'1',de:'2',para:'1',texto:'Oi! Deixei o briefing do post na sua fila.',criado_em:new Date(Date.now()-3600e3).toISOString(),lido_em:null}]:[]});
      if(url.searchParams.get('acao')==='boneco'){const r=await fetch('https://www.habboassets.com/imaging/avatar.png?'+new URLSearchParams({figure:url.searchParams.get('figura')||'',direction:url.searchParams.get('dir')||'2',size:'n'})).catch(()=>null);if(!r?.ok)return reply(404,{error:'Boneco indisponível.'});res.writeHead(200,{'Content-Type':'image/png'});return res.end(Buffer.from(await r.arrayBuffer()));}
      if(url.searchParams.get('acao')==='arte'){const arquivo=url.searchParams.get('arquivo')||'';if(!/^[A-Za-z0-9_]+\.(png|json)$/.test(arquivo))return reply(400,{error:'Arquivo inválido.'});try{const dados=readFileSync(new URL('../assets/escritorio/habbo/'+arquivo,import.meta.url));res.writeHead(200,{'Content-Type':arquivo.endsWith('.png')?'image/png':'application/json; charset=utf-8'});return res.end(dados);}catch{/* Fora do painel: igual à produção, busca no catálogo do Habbo. */return import('../server/escritorio-mapa.js').then(({arteRemotaEscritorio})=>arteRemotaEscritorio(arquivo.replace(/\.(png|json)$/,''),arquivo.endsWith('.png')?'png':'json')).then((dados)=>{res.writeHead(200,{'Content-Type':arquivo.endsWith('.png')?'image/png':'application/json; charset=utf-8'});res.end(dados);}).catch(()=>reply(404,{error:'Arte não encontrada.'}));}}
      const equipeDemo=['Operador de teste','Design demonstração','Edição demonstração','Atendimento demonstração'].map((nome,i)=>({id:String(i+1),nome,perfil:{roupa:['laranja','azul','verde','roxo'][i],pele:'media',cabelo:['curto','longo','cacheado','curto'][i],mesa:['grafite','azul','verde','roxo'][i],objeto:['planta','livros','luminaria','planta'][i],sala:'convivencia',x:50,y:70,abertura:'2026-10-17',quarto_configurado:true}}));
      return reply(200,{ok:true,demo:true,quartos:QUARTOS,economia:{disponivel:true,saldo:700,inventario:[{classe:'shelves_norja',quantidade:2},{classe:'bling_sofa_mu',quantidade:1}],essenciais:QUARTOS.essenciais,vendiveis:{shelves_norja:[[2,25]]},historico:[{tipo:'compra',classes:['hc3_stereo'],unidades:1,valor:-120,em:new Date(Date.now()-36e5).toISOString()},{tipo:'compra',classes:['shelves_norja'],unidades:2,valor:-50,em:new Date(Date.now()-864e5).toISOString()},{tipo:'venda',classes:['bling_chair_a'],unidades:1,valor:40,em:new Date(Date.now()-2*864e5).toISOString()},{tipo:'devolucao',classes:['floor_tile'],unidades:1,valor:30,em:new Date(Date.now()-3*864e5).toISOString()}],preco:25,conquistas:[],loja:lojaDemo(),marcos:marcosDemo(),
        // Pontos de demonstração, só para a ficha: nada disso vem de banco.
        pontos:{nivel:3,xp:40,xpProximo:140,xpTotal:200,funcao:'gestao',carteira:null,trabalho:{total:120,hoje:2,semana:7,mes:30,sequencia:4,funcao:'criacao'},meta:{inicio:new Date().toISOString().slice(0,10),fim:new Date().toISOString().slice(0,10),funcao:'gestao',entregas:3,meta:4,semanas:6,media:3.8},
         extrato:[{origem:'dia:hoje:sem-furo',regra:'dia_sem_furo',descricao:'Dia fechado sem furo de veiculação',moedas:10,pontos:10,criado_em:new Date().toISOString()},
          {origem:'briefing:1',regra:'briefing',descricao:'Demanda criada com briefing',moedas:2,pontos:2,criado_em:new Date().toISOString()},
          {origem:'compra:demo:shelves_norja',regra:null,descricao:'Compra na loja',moedas:-25,pontos:0,criado_em:new Date(Date.now()-864e5).toISOString()}]}},eu:'1',admin:true,worker:null,token:null,equipe:equipeDemo,salas:salasDoEscritorio(equipeDemo).map((s,i)=>i===0?{...s,pessoa_id:'1'}:s),mapa:{editavel:false,camadas:{}}});
    }
    // O subsolo do Escritório e a Equipe com alguém lá embaixo, para ver as lápides sem banco.
    if(area==='subsolo')return reply(200,{ok:true,clientes:[{id:'7',nome:'Padaria demonstração',segmento:'Alimentos',personagem:null,saiu_em:new Date(Date.now()-40*864e5).toISOString(),motivo:'Encerrou o contrato',pecas:38},{id:'8',nome:'Clínica demonstração',segmento:'Saúde',personagem:null,saiu_em:null,motivo:null,pecas:12}],
      pessoas:[{id:'9',nome:'Ex-colaborador demonstração',papel:'Design',foto_url:null,saiu_em:new Date(Date.now()-90*864e5).toISOString(),motivo:'Saiu da agência'}]});
    // Cartão VYBES: a central de verdade só existe no PC do Paulo; aqui ela aparece no ar para ver o cartão.
    if(area==='vybes'&&req.method==='GET'&&url.searchParams.get('etapa')==='whatsapp')return reply(...demoWhatsapp(url));
    // Perfil do agente, mapa do cérebro, pendências do WhatsApp e estudo: forma igual à da central, conteúdo fictício.
    if(area==='vybes'&&req.method==='GET'&&['perfil','mapa','pendencias','estudo'].includes(url.searchParams.get('etapa')))return reply(200,demoAgentesVybes(url));
    if(area==='vybes'&&req.method==='GET')return reply(200,{ok:true,noAr:true,agir:true});
    if(area==='pessoas'&&req.method==='GET')return reply(200,{ok:true,pessoas:[{id:'1',nome:'Operador de teste',email:'operador@vybe.invalid',admin:true,pode_entrar:true,ativo:true,tem_senha:true,ultimo_acesso:new Date().toISOString()},
      {id:'9',nome:'Ex-colaborador demonstração',email:'ex@vybe.invalid',admin:false,pode_entrar:false,ativo:false,tem_senha:true,ultimo_acesso:null}]});
    if(area==='clientes')return clientesDemo(req,res,url,body,reply);
    // Reuniões e onboarding fictícios (server/reunioes.js).
    if(area==='reunioes'&&req.method==='GET'){const {QUESTOES,TIPOS_REUNIAO}=await import('../server/reunioes.js');
      return reply(200,{ok:true,pode:true,tipos:TIPOS_REUNIAO,questoes:QUESTOES,
        pauta:['Retomar o que ficou da reunião de 03/11: novo cardápio de dezembro','Aprovação do planejamento de 12/2026 (está com o cliente)','Próximos passos, responsáveis e datas'],
        onboarding:{link_ativo:true,respostas:{publico:'Mulheres de 25 a 40 anos em Irecê',diferenciais:'Atendimento próximo e produto exclusivo',forcas:'Marca conhecida',ameacas:'Concorrência de lojas online',_atualizado_em:new Date().toISOString(),_por:'reuniao'}},
        reunioes:[{id:'1',cliente_id:'1',data:'2026-11-03',tipo:'rotina',titulo:'Rotina de novembro',participantes:'Paulo, Carla',pauta:'- Cardápio novo\n- Datas de dezembro',ata:'Combinamos 3 posts por semana e o reels do cardápio novo até sexta.',gravacao:{id:'demo',bytes:4200000},transcricao:'',estado:'gravada'}]});}
    // Aprovações fictícias (server/aprovacoes.js): o operador de teste é sócio e head da Academia Lions.
    if(area==='aprovacoes'){const h=(n)=>new Date(Date.now()-n*36e5).toISOString();const V={id:'10',nome:'Vinícius'},E={id:'11',nome:'Ewerton'};
      return reply(200,{ok:true,eu:{id:'1',dono:true,diretor_arte:true,clientes:['1']},
        planejamentos:[{tipo:'planejamento',id:'1',cliente_id:'1',cliente:'Academia Lions',mes:'2026-12',titulo:'Dezembro',estado:'revisar',etapa:'interna',pecas:14,horas:30,desde:h(30),heads:[V],meu:true},
          {tipo:'planejamento',id:'2',cliente_id:'14',cliente:'VOA',mes:'2026-12',titulo:'Dezembro',estado:'enviado',etapa:'cliente',pecas:9,horas:60,desde:h(60),heads:[E],meu:false},
          {tipo:'planejamento',id:'3',cliente_id:'5',cliente:'Brussolo Ristorante',mes:'2026-12',titulo:'Dezembro',estado:'aprovado',etapa:'cadastrar',pecas:12,horas:6,desde:h(6),heads:[V],meu:false}],
        pecas:[{tipo:'peca',id:'101',ref:'vybe:101',quadro:'producao',titulo:'Card - Promo de novembro',formato:'Card',status:'Para aprovação',etapa:'interna',cliente:'Gonzalez',horas:5,heads:[E],meu:false},
          {tipo:'peca',id:'102',ref:'vybe:102',quadro:'producao',titulo:'Reels - Treino de pernas',formato:'Reels',status:'Para aprovação',etapa:'interna',cliente:'Academia Lions',horas:28,heads:[V],meu:true},
          {tipo:'peca',id:'103',ref:'vybe:103',quadro:'producao',titulo:'Fotografia - Prato do dia',formato:'Fotografia',status:'Ag. Aprovação Cliente',etapa:'cliente',cliente:'Brussolo Ristorante',horas:20,heads:[V],meu:false}]});}
    // Log de atividade fictício: um exemplo de cada tipo de evento, em dias diferentes.
    if(area==='peca' && url.searchParams.get('log')==='1'){
      const h=(dias,hora)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-dias);d.setUTCHours(hora+3,15,0,0);return d.toISOString();};
      return reply(200,{ok:true,id:url.searchParams.get('item'),importada:false,criado_em:h(6,9),itens:[
        {tipo:'comentario',texto:'Card aprovado pelo cliente, pode agendar.',em:h(0,15),autor:'Operador de teste'},
        {tipo:'status',de:'Em aprovação',para:'Aprovado',em:h(0,14),autor:'Operador de teste',autor_ref:'68035537'},
        {tipo:'automacao',texto:'Aprovado vai para Agendamento',para:'grupo → Agendamento, notificação',em:h(0,14),autor:''},
        {tipo:'anexo',para:'card-final.png',em:h(1,17),autor:'Pessoa fictícia'},
        {tipo:'prazo',de:'2026-09-11',para:'2026-09-15',em:h(1,10),autor:'Operador de teste'},
        {tipo:'responsavel',de:'sem responsável',para:'Pessoa fictícia',em:h(2,11),autor:'Operador de teste'},
        {tipo:'prioridade',de:'Média',para:'Alta',em:h(2,11),autor:'Operador de teste'},
        {tipo:'status',de:'Pode Fazer',para:'Em andamento',em:h(3,9),autor:'Pessoa fictícia',autor_foto:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 10%22%3E%3Ccircle cx=%225%22 cy=%225%22 r=%225%22 fill=%22%2300a3a3%22/%3E%3C/svg%3E'},
        {tipo:'material_bruto',para:'https://drive.example.test/pasta',em:h(4,16),autor:'Pessoa fictícia'},
        {tipo:'status',de:null,para:'Pode Fazer',em:h(5,8),autor:'',do_monday:true},
        {tipo:'criacao',para:'Card fictício',em:h(6,9),autor:'Operador de teste'},
      ]});
    }
    // Planejamento fictício, só leitura: a demonstração não grava.
    if(area==='planejamentos'){
      const proximo=new Date();proximo.setUTCDate(1);proximo.setUTCMonth(proximo.getUTCMonth()+1);
      const mes=proximo.toISOString().slice(0,8)+'01';const dia=(d)=>mes.slice(0,8)+String(d).padStart(2,'0');
      const plano={id:'1',cliente_id:'1',cliente:'Cliente demonstração',cliente_email:'cliente@example.test',mes,titulo:'Planejamento de conteúdo',estado:'ajustes',versao:2,origem:'agente',pode_editar:true,
        resposta_nome:'Cliente fictício',resposta_texto:'Podemos trocar o tema do dia 12 por um Reels?',identidade:{cor:'#2f7d5b',cor_apoio:'#1d2227',fonte:'Montserrat'},
        conteudo:{resumo:'Mês de reforçar a presença da marca com bastidores e prova social.',numeros:[],linhas:[{titulo:'Bastidores',texto:'Mostrar quem faz o trabalho.'},{titulo:'Prova social',texto:'Depoimentos reais de clientes.'}],
          datas:[{data:'02/'+mes.slice(5,7),nome:'Data fictícia',texto:'Só para ilustrar a tela.'}],
          pecas:[{data:dia(5),formato:'Card',tema:'Apresentação da equipe',legenda:'Legenda de exemplo.',referencia:'',observacao:''},{data:dia(12),formato:'Carrossel',tema:'Três dúvidas comuns',legenda:'Legenda de exemplo.',referencia:'',observacao:''},{data:dia(19),formato:'Reels',tema:'Bastidores',legenda:'Roteiro de exemplo.',referencia:'',observacao:''}],
          observacoes:'Confirmar as fotos com o cliente.'},
        eventos:[{tipo:'ajustes',texto:'Podemos trocar o tema do dia 12 por um Reels?',autor_externo:'Cliente fictício',em:new Date().toISOString(),versao:2},{tipo:'publicado',em:new Date(Date.now()-864e5).toISOString(),versao:1}]};
      const acao=url.searchParams.get('acao');
      if(acao==='previa'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(documentoHtml(plano));}
      // Página do cliente para responder (link direto ou dentro do VybeHub), só na demonstração.
      if(acao==='previa-cliente'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(documentoHtml({...plano,estado:'enviado'},{paraCliente:true,token:'demonstracao',modo:url.searchParams.get('modo')==='portal'?'portal':'link'}));}
      if(acao==='detalhe')return reply(200,{ok:true,planejamento:plano});
      const alertasDemo={sem_info:[{ref:'vybe:1',quadro:'producao',titulo:'Card sem briefing',status:'Pode Fazer',prazo:dia(22),motivo:'sem briefing'}],atrasadas:[{ref:'vybe:1',quadro:'producao',titulo:'Reels atrasado',status:'Em andamento',prazo:dia(2)}],aprovar:[{ref:'vybe:2',quadro:'demandas',titulo:'Cardápio para aprovar',status:'Para aprovação',prazo:dia(25)}],sem_info_total:1,atrasadas_total:1,aprovar_total:1,total:3};
      if(acao==='pendentes')return reply(200,{ok:true,pendentes:[plano],alertas:[{cliente_id:'1',cliente:'Cliente demonstração',...alertasDemo}]});
      if(acao==='operacao')return reply(200,{ok:true,postos:[{cliente_id:'1',cliente:'Cliente demonstração',segmento:'Restaurante',meu:true,planejamento:{id:'1',estado:'ajustes',mes,versao:2},alertas:alertasDemo},
        ...['Cooperativa','Clinica','PetShop','Academia','Provedor de Internet','Sistema','Advocacia','Distribuidora de Bebidas','Varejo','Moda','Soluções empresariais','Gastronomia','Clinica laboratório',null].map((seg,i)=>({cliente_id:String(i+2),cliente:`Cliente ${String.fromCharCode(66+i)} (fictício)`,segmento:seg,meu:false,planejamento:i%3===0?null:{id:String(i+2),estado:['enviado','aprovado'][i%2],mes,versao:1}}))]});
      if(req.method==='POST')return reply(403,{error:'A demonstração não grava.'});
      return reply(200,{ok:true,disponivel:true,email:false,planejamentos:[plano]});
    }
    // Captações fictícias da Produção (server/captacoes.js), só leitura.
    if(area==='captacoes'){
      const d=(n)=>{const x=new Date();x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
      if(url.searchParams.get('acao')==='pecas')return reply(200,{ok:true,pecas:[
        {id:'101',titulo:'Reels - Prato do dia',formato:'Reels',prazo:d(-12),veiculacao:d(5),briefing:'Abrir na cozinha com o chef finalizando o prato.\nFechar com o prato na mesa e o logo.',status:'Aguardo',clientes:[{id:'1',nome:'Cliente demonstração'}]},
        {id:'106',titulo:'Fotografia - A escolha do DA',formato:'Fotografia',prazo:d(-1),veiculacao:d(2),briefing:'Foto do produto em destaque.',status:'Falta Info',sem_material:true,tipo:'foto',clientes:[{id:'1',nome:'Cliente demonstração'}]},
        {id:'107',titulo:'Fotografia - A escolha do DA',formato:'Fotografia',prazo:d(3),veiculacao:d(5),briefing:'Foto do produto em destaque.',status:'Falta Info',sem_material:true,tipo:'foto',clientes:[{id:'1',nome:'Cliente demonstração'}]},
        {id:'108',titulo:'Reels - FAQ 2',formato:'Reels',prazo:d(-1),veiculacao:d(6),briefing:'',status:'Aguardo Redação',sem_material:true,tipo:'video',clientes:[{id:'2',nome:'Cliente B (fictício)'}]},
        {id:'102',titulo:'Foto - Sobremesa da casa',formato:'Fotografia',prazo:d(4),veiculacao:d(6),briefing:'',status:'Aguardo',clientes:[{id:'1',nome:'Cliente demonstração'}]},
        {id:'103',titulo:'Reels - Bastidores do atendimento',formato:'Reels',prazo:d(6),veiculacao:d(8),briefing:'Mostrar a recepção e a equipe sorrindo.',status:'Aguardo',clientes:[{id:'2',nome:'Cliente B (fictício)'}],roteiro_doc:{titulo:'Roteiros Cliente B – bastidores',link:'https://docs.google.com/document/d/demonstracao-roteiro-cliente-b/edit'}}]});
      const ag=(id,titulo,n,inicio,fim,tipo,cliente_id,cliente,extra={})=>({id,titulo,dia:d(n),inicio,fim,horario:inicio?`${inicio} às ${fim}`:'Dia inteiro · horário não informado',local:'',tipo,cliente_id,cliente,captacao_id:'',link:'',...extra});
      const proximas=[ag('g7','Captação - Cliente C - fachada',2,'10:00','11:00','captacao','3','Cliente C (fictício)'),ag('g8','Captação aula de dança',3,'07:00','08:00','captacao','','')];
      // Últimos 7 dias: uma gravação de ontem sem fechar e uma já fechada (Fechar gravação).
      const recentes=[ag('g10','Captação - Cliente demonstração - cardápio',-1,'14:00','16:00','captacao','1','Cliente demonstração'),
        ag('g11','Captação - Cliente B - depoimentos',-2,'10:00','11:00','captacao','2','Cliente B (fictício)',{captacao_id:'10'})];
      return reply(200,{ok:true,de:d(0),ate:d(6),aviso_agenda:'',clientes:[{id:'1',nome:'Cliente demonstração'},{id:'2',nome:'Cliente B (fictício)'},{id:'3',nome:'Cliente C (fictício)'}],proximas,recentes,agenda:[...proximas,...recentes,
        ag('g1','Captação - Cliente B - entrevista',0,'09:00','10:00','captacao','2','Cliente B (fictício)',{local:'Clínica'}),
        ag('g2','Reunião de pauta - Cliente B',0,'09:30','10:30','reuniao','2','Cliente B (fictício)'),
        ag('g4','Cliente demonstração - Banco de imagem',0,'15:00','16:30','captacao','1','Cliente demonstração'),
        ag('g9','Captação · Cliente demonstração · 2 peças',1,'09:00','11:00','captacao','1','Cliente demonstração',{local:'No restaurante',captacao_id:'9'}),
        ag('g5','Alinhamento da equipe',2,'08:00','08:45','reuniao','',''),
        ag('g6','Dentista Vinícius',3,'14:00','15:00','outro','',''),
        ag('g3','Banco de imagem - Cliente demonstração',4,'','','captacao','1','Cliente demonstração')],
        captacoes:[{id:'9',cliente_id:'1',cliente:'Cliente demonstração',dia:d(1),inicio:'09:00',fim:'11:00',local:'No restaurante',observacao:'Levar a luz de LED.',estado:'agendada',na_agenda:true,aviso:null,criado_por:'Operador de teste',
        pecas:[{id:'104',titulo:'Reels - Novidade do cardápio',formato:'Reels',briefing:'Close nos ingredientes, depois o prato pronto.',captacao:'captacao_agendada',gravado:true},{id:'105',titulo:'Foto - Ambiente',formato:'Fotografia',briefing:'',captacao:'captacao_agendada',gravado:false}]},
        {id:'10',cliente_id:'2',cliente:'Cliente B (fictício)',dia:d(-2),inicio:'10:00',fim:'11:00',local:'Clínica',observacao:'',estado:'gravada',na_agenda:true,evento_google:'g11',evento_do_painel:false,aviso:null,criado_por:'Operador de teste',
        drive_link:'https://drive.google.com/drive/folders/demonstracao',fechada_em:new Date(Date.now()-864e5*2+4*36e5).toISOString(),fechada_por:'Pessoa fictícia',observacao_final:'Gravamos um depoimento a mais.',
        pecas:[{id:'110',titulo:'Reels - Depoimento da paciente',formato:'Reels',captacao:'captacao_feita',gravado:true,status:'Em edição',status_cor:'#fdab3d'},{id:'111',titulo:'Reels - O que faz um nefrologista?',formato:'Reels',captacao:'captacao_feita',gravado:true,status:'Para aprovação',status_cor:'#579bfc'}]}]});
    }
    // Agenda fictícia da semana (server/agenda-producao.js), a do ícone do Escritório.
    if(area==='agenda_producao'){
      const base=url.searchParams.get('dia')||new Date().toISOString().slice(0,10);
      const d=(n)=>{const x=new Date(`${base}T12:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
      const ev=(id,titulo,n,inicio,fim,tipo)=>({id,titulo,dia:d(n),inicio,fim,horario:`${inicio} às ${fim}`,local:'',tipo,captacao:tipo==='captacao',ambiguo:tipo!=='captacao',link:''});
      return reply(200,{ok:true,inicio:base,eventos:[ev('a1','Cliente demonstração - Banco de imagem',1,'09:00','10:00','captacao'),ev('a2','Reunião de pauta',1,'09:30','10:30','reuniao'),
        ev('a3','Captação - Cliente B - entrevista',2,'15:00','16:30','captacao'),ev('a4','Dentista Vinícius',3,'14:00','15:00','outro'),ev('a5','Captação - Cliente demonstração',4,'07:00','08:00','captacao')]});
    }
    // Roteiros fictícios da Produção (server/roteiros.js), só leitura.
    if(area==='roteiros'){
      if(req.method==='POST')return reply(403,{error:'A demonstração não grava.'});
      const d=(n)=>{const x=new Date();x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
      const doc=(n)=>`https://docs.google.com/document/d/demonstracao-roteiro-${n}/edit`;
      if(url.searchParams.get('acao')==='candidatos')return reply(200,{ok:true,candidatos:[
        {id:'201',titulo:'Reels - Bastidores da cozinha',formato:'Reels',veiculacao:d(3),status:'Finalizado',status_cor:'#00c875',ligado:true,sugerido:true},
        {id:'202',titulo:'Reels - O prato do chef',formato:'Reels',veiculacao:d(9),status:'Em produção',status_cor:'#fdab3d',ligado:false,sugerido:true},
        {id:'203',titulo:'Card - Horário de funcionamento',formato:'Card',veiculacao:d(11),status:'Pode fazer',status_cor:'#579bfc',ligado:false,sugerido:false}]});
      return reply(200,{ok:true,clientes:[{id:'1',nome:'Cliente demonstração'},{id:'2',nome:'Cliente B (fictício)'}],roteiros:[
        {id:'1',doc_id:'demo1',titulo:'Roteiro de captação: chef na cozinha',cliente_id:'1',cliente:'Cliente demonstração',criado_em:d(-2),origem:'drive',link:doc(1),
          pecas:['Entrevista com o chef','Montagem dos pratos','Salão durante o serviço'],
          conteudos:[{id:'201',titulo:'Reels - Bastidores da cozinha',formato:'Reels',veiculacao:d(3),status:'Finalizado',status_cor:'#00c875'},{id:'204',titulo:'Fotografia - Prato principal',formato:'Fotografia',veiculacao:d(5),status:'Aprovação',status_cor:'#a25ddc'}]},
        {id:'2',doc_id:'demo2',titulo:'Roteiros Cliente B – bastidores',cliente_id:'2',cliente:'Cliente B (fictício)',criado_em:d(-6),origem:'importado',link:doc(2),pecas:['Reels 1: A recepção','Reels 2: A equipe'],conteudos:[]},
        {id:'3',doc_id:'demo3',titulo:'Roteiro de stories: reta final',cliente_id:null,cliente:null,criado_em:d(-40),origem:'importado',link:doc(3),pecas:[],conteudos:[]}]});
    }
    if(area==='notificacoes')return reply(200,{ok:true,notificacoes:[],nao_lidas:0});
    return reply(200,{ok:true,pessoas:[],clientes:[],acessos:[],automacoes:[],snapshots:[],colunas:[],opcoes:[],captacao:[],catalogos:{status:[],captacao:[],grupos:[],pessoas:[],formatos:[]}});
  }
  return reply(200,{ok:true,itens:[],items:[],eventos:[],snapshots:[],data: { boards: [] }});
}

// Dados explicitamente fictícios, exclusivos da revisão local da aba Trabalho.
function volumeDemonstracao() {
  const clientes=['Academia Lions','Alpha1','Antonov','Brussolo Ristorante','ConectaSim','Copirecê','DiaCenter','DiaLab','Gonzalez','Hebravet','Hellen','Mangaba AI','Serra Grande Bebidas','VOA','Experimente Papelaria'];
  const formatos=['Card','Carrossel','Reels','Fotografia','Story','Feed','Motion'];
  const status=[['Pode Fazer','pode_fazer'],['Em Andamento','em_andamento'],['Para aprovação','para_aprovacao'],['Agendado','agendado'],['Finalizado','finalizado'],['Alteração','alteracao'],['Ag. Info Cliente','ag_info_cliente'],['A Fazer','a_fazer']];
  const temas=['Dia do cliente','Promoção da semana','Bastidores','Depoimento','Lançamento','Feriado','Dica rápida','Antes e depois','Equipe','Novidade do mês','Pergunta do dia','Outubro Rosa'];
  const base=new Date(); base.setDate(1);
  const out=[];
  for(let i=0;i<300;i++){
    const d=new Date(base); d.setDate(1+(i*13)%28); const iso=d.toISOString().slice(0,10);
    const [rot,chave]=status[(i*5)%status.length], fmt=formatos[(i*3)%formatos.length], cli=clientes[(i*11)%clientes.length];
    out.push({id:`vybe:${1000+i}`,nome:`${fmt} - ${temas[(i*7)%temas.length]}`,cliente:cli,clientes:[cli],formato:fmt,prazo_iso:iso,veiculacao_iso:iso,
      status:rot,status_chave:chave,grupo:'Redação',grupo_id:'group_title',responsavel_ids:[['68035537','68035538','68035539'][i%3]],updated_at:new Date().toISOString()});
  }
  return out;
}
function trabalhoDemonstracao(id,consulta={}) {
 const hoje=diaBahia(), periodo=periodoTrabalho(hoje,consulta), desde=periodo.desde, linhas=[];
 const ndias=Math.round((Date.parse(periodo.fim)-Date.parse(desde))/864e5)+1;
 for(let i=0;i<ndias;i++) { const dia=somarDias(desde,i), dow=new Date(dia+'T12:00:00Z').getUTCDay();
  if(dow===0||dow===6)continue;
  for(const [j,[regra]] of ATIVIDADES_DO_RANKING.entries()) {
   const n=(i+id+j)%9; if(n)linhas.push({dia,regra,formato:j%3===0?'card':j%3===1?'reels':'impresso',n});
  }
 }
 const recordes=[];
 for(const [regra] of ATIVIDADES_DO_RANKING){const por=linhas.filter(l=>l.regra===regra), max=Math.max(...por.map(l=>l.n)), top=por.filter(l=>l.n===max);
  recordes.push({regra,formato:null,n:max,dia:top[0].dia,primeiro:por[0].dia,empates:top.length});
  for(const formato of new Set(por.map(l=>l.formato)))recordes.push({regra,formato,n:max,dia:top[0].dia,primeiro:por[0].dia,empates:top.length});
 }
 const ganhos=linhas.map(l=>({dia:l.dia,regra:l.regra,xp:l.n*5,eventos:l.n}));
 ganhos.push({dia:periodo.fim,regra:'meta_semana',xp:50,eventos:1},{dia:periodo.fim,regra:'criacao_alteracao',xp:-7,eventos:1});
 if(consulta.detalhes==='1'){
  const origem=consulta.fonte==='xp'?ganhos:linhas, lista=origem.filter(l=>(consulta.regra==='*'||l.regra===consulta.regra)&&l.dia>=periodo.inicio&&l.dia<=periodo.fim&&(!consulta.dia||consulta.dia===l.dia)&&(!consulta.formato||consulta.formato===l.formato));
  const itens=lista.flatMap(l=>Array.from({length:consulta.fonte==='xp'?1:l.n},()=>({ref:null,quadro:'producao',titulo:'Contribuição fictícia',dia:l.dia,formato:l.formato||'',cliente:'Cliente demonstração',observacao:'Registro fictício da demonstração local',xp:consulta.fonte==='xp'?l.xp:null})));
  const pagina=Number(consulta.pagina||0);return {disponivel:true,pagina,total:itens.length,itens:itens.slice(pagina*30,(pagina+1)*30)};
 }
 const total=linhas.filter(l=>l.regra==='peca_criacao'&&l.dia>=periodo.inicio&&l.dia<=periodo.fim).reduce((n,l)=>n+l.n,0);
 return {disponivel:true,hoje,desde,periodo,qualidade:{disponivel:true,entregas:total,com_status:Math.floor(total*.8),com_prazo:Math.floor(total*.7),no_prazo:Math.floor(total*.6),com_retorno:Math.floor(total*.1)},regras:{meta_semana:'Meta da semana batida',criacao_alteracao:'Retorno para alteração'},funcao:'criacao',atividades:ATIVIDADES_DO_RANKING.map(([regra,nome])=>({regra,nome})),linhas,recordes,ganhos};
}

// Demonstração da central para o perfil dos agentes, o mapa do cérebro (aba Sinapses), as pendências do WhatsApp e o
// estudo do cliente. Mesma forma das rotas da central (whatsapp-ia/central.js); nomes e textos são fictícios.
function demoAgentesVybes(url) {
  const etapa = url.searchParams.get('etapa'), agora = Date.now(), iso = (h) => new Date(agora - h * 3600e3).toISOString();
  if (etapa === 'pendencias') return { ok: true, fonte: 'central-vybes', lidoEm: agora, geradoEm: iso(0), eu: { nome: 'Operador de teste', pessoa: '1', socio: true },
    atendimento: { setor: 'concierge', agente: 'Mateus',
      clientesEsperando: [{ cliente: 'Cliente demonstração', autor: 'Contato do cliente', texto: 'Consegue mandar a arte da promoção ainda hoje?', para: null, minutos: 95 },
        { cliente: 'Padaria demonstração', autor: 'Dona da padaria', texto: 'Qual horário fica bom para a gravação?', para: 'Operador', minutos: 35 }],
      timeSemResolver: [{ tipo: 'mencao_sem_resposta', grupo: 'Produção', conversa: 'a1b2c3d4e5f6a7b8c9d0', fato: 'Operador chamou Pessoa de teste no Produção há 5 h e não houve resposta.', prova: '“revisa a legenda do carrossel de sexta”', sugestao: 'Lembrar Pessoa no privado', gravidade: 'media', em: iso(5), pessoa: '2' }] },
    paraVoce: [{ tipo: 'mencao_sem_resposta', grupo: 'Correção', conversa: 'b1c2d3e4f5a6b7c8d9e0', fato: 'Pessoa de teste chamou você no Correção há 2 h e não houve resposta.', prova: '“consegue ajustar a cor do card?”', sugestao: 'Responder no grupo', gravidade: 'media', em: iso(2), pessoa: '1' }] };
  if (etapa === 'estudo') return { ok: true, fonte: 'central-vybes', cliente: url.searchParams.get('cliente') || '', anteriores: 1, ultimo: { em: iso(20),
    setor: 'Comércio local com movimento forte no fim do mês.', posicionamento: 'Marca de bairro, próxima e familiar.',
    concorrentes: [], ameacas: [{ texto: 'Feira concorre pelo público do sábado', prova: '[NOTICIA_SETOR] Feira de demonstração' }],
    oportunidades: [{ texto: 'Bastidores da produção', prova: '[FICHA] o público gosta de ver o preparo' }],
    ideias: [{ formato: 'Reels', titulo: 'Bastidor da manhã', porque: 'A ficha pede bastidor.' }], confirmar: ['Concorrente a confirmar: nome citado sem fonte'],
    fontes: { ficha: true, instagram: true, noticiasCliente: 0, noticiasSetor: 2, licoes: 1 } } };
  const rotinas = [
    { id: 'esteira_entrada', setor: 'concierge', quando: '08:00, 11:00, 14:00 e 17:00', texto: 'Pedido do cliente que não virou card, card sem briefing', evita: 'demanda pedida que não vira cadastro', nova: true, fixa: false, motor: 'logica', le: ['whatsapp_clientes', 'vybe_os'], leNomes: ['Grupos de clientes (só leitura)', 'Vybe OS (demandas, status, prazos)'], gera: ['perfil'], geraNomes: ['Perfil do agente (achado em sombra, nada enviado)'], codigo: 'core/detectores-esteira.js pedidoSemCard', ligada: true, ultimaRodada: { em: iso(1) } },
    { id: 'clientes_sem_resposta', setor: 'concierge', quando: 'contínuo (8h–19h)', texto: 'Cliente esperando resposta no grupo', evita: 'cliente sem resposta no grupo', nova: false, fixa: false, motor: 'logica', le: ['whatsapp_clientes'], leNomes: ['Grupos de clientes (só leitura)'], gera: ['whatsapp_time'], geraNomes: ['WhatsApp da equipe'], codigo: 'rotinas.js avisarClientesSemResposta', ligada: false, desligadaPor: 'Operador de teste' },
  ];
  if (etapa === 'perfil') return { ok: true, fonte: 'central-vybes', lidoEm: agora, geradoEm: iso(0), perfil: { setor: url.searchParams.get('setor') || 'concierge', agente: 'Mateus', nome: 'Concierge / CS', estado: 'sombra', nivel: 'sombra: só propõe',
    numeros: { abertos: 2, altas: 1, novosHoje: 1, resolvidos7d: 6, errados7d: 1, acerto: 86, horasAteResolver: 3.5, porDia: {} },
    rotinas, atribuicoes: [],
    achados: { abertos: [{ chave: 'pedido:demo:1', tipo: 'pedido_sem_card', cliente: 'Cliente demonstração', fato: 'Cliente demonstração pediu no grupo há 6 h e não achei card com esse assunto.', prova: 'Contato: “precisamos divulgar a promoção de sábado”', sugestao: 'Organizar o briefing e propor o card', gravidade: 'alta', estado: 'aberto', primeiraVez: iso(6), ultimaVez: iso(1), vezes: 2 },
      { chave: 'briefing:demo:2', tipo: 'card_sem_briefing', cliente: 'Padaria demonstração', fato: 'Peça cadastrada sem briefing.', prova: 'campo de briefing vazio', sugestao: 'Pedir o briefing a quem cadastrou', gravidade: 'media', estado: 'aberto', primeiraVez: iso(26), ultimaVez: iso(1), vezes: 4, ficha: '🎨 Ficha da peça · Card - Pão de sábado\nFalta antes de começar: briefing; legenda.' }],
      resolvidos: [{ chave: 'r1', tipo: 'card_com_erro', cliente: 'Cliente demonstração', fato: 'Card sem responsável.', prova: 'status A Fazer', estado: 'resolvido', primeiraVez: iso(30), fechadoEm: iso(28), comoFechou: 'sumiu na conferência seguinte' }] },
    licoes: [{ id: 'lic-demo', texto: 'Padaria demonstração: card sem briefing se repetiu 3 vezes em 14 dias.', estado: 'em_revisao', prova: 'campo de briefing vazio' }],
    historico: { [iso(48).slice(0, 10)]: { concluidas: 6, falhas: 0, aguardando: 1 }, [iso(24).slice(0, 10)]: { concluidas: 9, falhas: 1, aguardando: 0 }, [iso(0).slice(0, 10)]: { concluidas: 4, falhas: 0, aguardando: 2 } },
    projecao: { proximas: [{ em: iso(-2), tipo: 'rotina', id: 'esteira_entrada', texto: rotinas[0].texto }], tendencia: 'menos problemas aparecendo', carga: '2 em aberto, 1 urgente', subirNivel: null },
    agora: null, ultimos: [] } };
  const n = (id, tipo, nome, extra = {}) => ({ id, tipo, nome, origem: extra.origem || '', ...extra });
  const nos = [n('motor:qwen', 'motor', 'Qwen 3.5 35B (local, Ollama)', { fila: { ocupado: false, esperando: 0, feitos: 12, falhas: 1, descartados: 0 } }), n('motor:logica', 'motor', 'Lógica fixa (regras no código)'), n('motor:vybe_os', 'motor', 'Servidor do Vybe OS'),
    n('fonte:vybe_os', 'fonte', 'Vybe OS (demandas, status, prazos)', { origem: 'Vybe OS · consultas' }), n('fonte:whatsapp_clientes', 'fonte', 'Grupos de clientes (só leitura)', { origem: 'core/caixa-whatsapp.js' }),
    n('fonte:fichas_md', 'memoria', 'Fichas .md dos clientes', { origem: '.vybe-ai-local/clientes/*.md' }), n('fonte:licoes', 'memoria', 'Lições do revisor de erros', { origem: 'achados.json' }),
    n('saida:perfil', 'saida', 'Perfil do agente (achado em sombra, nada enviado)'), n('saida:whatsapp_time', 'saida', 'WhatsApp da equipe'),
    n('agente:concierge', 'agente', 'Mateus · Concierge / CS', { estado: 'sombra', numeros: { abertos: 2, acerto: 86 } }), n('agente:bi', 'agente', 'Alex · Business Intelligence', { estado: 'sombra', numeros: { abertos: 0, acerto: null } }),
    n('rotina:esteira_entrada', 'rotina', rotinas[0].texto, { origem: rotinas[0].codigo, setor: 'concierge', quando: rotinas[0].quando, motor: 'logica', ligada: true, ultimaRodada: { em: iso(1) } }),
    n('rotina:estudo_cliente', 'rotina', 'Estudo ativo de 2 clientes por noite', { origem: 'core/estudo-cliente.js estudar (Qwen) + validar (regra)', setor: 'bi', quando: 'domingo a quinta 22:00', motor: 'qwen', ligada: true }),
    n('rotina:manha', 'rotina', 'Rotina da manhã', { origem: 'rotinas.js executar → consultarRotina', setor: 'bi', quando: '07:30', motor: 'vybe_os', ligada: true }),
    n('modulo:sdr', 'modulo', 'Qualificação de empresas', { origem: 'core/agente-sdr.js', setor: 'bi', motor: 'qwen', ligado: false })];
  const l = (de, para, tipo) => ({ de, para, tipo, texto: '' });
  const ligacoes = [l('agente:concierge', 'rotina:esteira_entrada', 'dono'), l('fonte:whatsapp_clientes', 'rotina:esteira_entrada', 'le'), l('fonte:vybe_os', 'rotina:esteira_entrada', 'le'), l('rotina:esteira_entrada', 'motor:logica', 'pensa'), l('rotina:esteira_entrada', 'saida:perfil', 'escreve'),
    l('agente:bi', 'rotina:estudo_cliente', 'dono'), l('fonte:fichas_md', 'rotina:estudo_cliente', 'le'), l('fonte:licoes', 'rotina:estudo_cliente', 'le'), l('rotina:estudo_cliente', 'motor:qwen', 'pensa'),
    l('agente:bi', 'rotina:manha', 'dono'), l('fonte:vybe_os', 'rotina:manha', 'le'), l('rotina:manha', 'motor:vybe_os', 'pensa'), l('rotina:manha', 'saida:whatsapp_time', 'escreve'),
    l('agente:bi', 'modulo:sdr', 'dono'), l('modulo:sdr', 'motor:qwen', 'pensa')];
  return { ok: true, fonte: 'central-vybes', lidoEm: agora, geradoEm: iso(0), contagem: { qwen: 1, logica: 1, misto: 0, vybe_os: 1, naoMapeadas: 0, modulosParados: 1 }, geradoDe: ['core/mapa-cerebro.js'], nos, ligacoes };
}
