// Exclusivo do servidor local. Nenhuma consulta ou gravação externa.
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
export function demoApi(req,res,url,body) {
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
  if(!sessao)return reply(401,{error:'Entre no ambiente de demonstração.'});
  if(url.pathname==='/api/conteudo' && req.method==='POST') {
    let data;try {data=JSON.parse(body.toString());}catch{return reply(400,{error:'JSON inválido.'});}
    if(data.acao==='clientes_opcoes')return reply(200,{ok:true,clientes:[
      {id:'1',nome:'Cliente demonstração',ativo:true,selecionado:true},
      {id:'2',nome:'Segundo cliente demonstração',ativo:true,selecionado:false}]});
  }
  if(url.pathname==='/api/painel' && url.searchParams.get('area')==='notas') return notasDemo(req,url,body,reply);
  if(req.method!=='GET')return reply(403,{error:'Demonstração de interface somente leitura. As gravações são testadas no PostgreSQL em memória.'});
  if(url.pathname==='/api/conteudos') {
    const demanda=url.searchParams.get('board')==='demandas';
    const hoje=new Date().toISOString().slice(0,10);
    const itens=demanda?[{id:'vybe:2',nome:'Reunião de alinhamento fictícia',cliente:'Cliente demonstração',formato:'Reunião',prazo_iso:hoje,veiculacao_iso:hoje,status_chave:'a_fazer',grupo:'Solicitações',responsavel_ids:['68035537']}]:[{id:'vybe:1',nome:'Peça fictícia para verificar o painel',cliente:'Cliente demonstração',clientes:['Cliente demonstração'],
      formato:'Card',prazo_iso:hoje,veiculacao_iso:hoje,status_chave:'a_fazer',grupo:'Redação',grupo_id:'group_title',
      responsavel_ids:['68035537'],updated_at:new Date().toISOString()}];
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
      status:[{chave:'a_fazer',rotulo:'A Fazer',cor:'#579bfc',borda:'#579bfc',monday_index:0}],
      captacao:[],opcoes:[],pessoas:[{id:'68035537',nome:'Operador de teste'}],itens});
  }
  if(url.pathname==='/api/painel'){
    if(url.searchParams.get('area')==='historico')return reply(200,{ok:true,logs:{moveEvents:{},prazoEvents:{},statusEvents:{},veiculacaoEvents:{},ownerEvents:{}}});
    const area=url.searchParams.get('area');
    if(area==='conta')return reply(200,{ok:true,pessoa});
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
    if(area==='notificacoes')return reply(200,{ok:true,notificacoes:[],nao_lidas:0});
    return reply(200,{ok:true,pessoas:[],clientes:[],acessos:[],automacoes:[],snapshots:[],colunas:[],opcoes:[],captacao:[],catalogos:{status:[],captacao:[],grupos:[],pessoas:[],formatos:[]}});
  }
  return reply(200,{ok:true,itens:[],items:[],eventos:[],snapshots:[],data: { boards: [] }});
}
