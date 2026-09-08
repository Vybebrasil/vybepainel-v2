// Exclusivo do servidor local. Nenhuma consulta ou gravação externa.
const pessoa={id:1,nome:'Operador de teste',email:'operador@example.test',admin:true};
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
  if(req.method!=='GET')return reply(403,{error:'Demonstração de interface somente leitura. As gravações são testadas no PostgreSQL em memória.'});
  if(url.pathname==='/api/conteudos') {
    const demanda=url.searchParams.get('board')==='demandas';
    const hoje=new Date().toISOString().slice(0,10);
    const itens=demanda?[]:[{id:'vybe:1',nome:'Peça fictícia para verificar o painel',cliente:'Cliente demonstração',clientes:['Cliente demonstração'],
      formato:'Card',prazo_iso:hoje,veiculacao_iso:hoje,status_chave:'a_fazer',grupo:'Redação',grupo_id:'group_title',
      responsavel_ids:['68035537'],updated_at:new Date().toISOString()}];
    return reply(200,{ok:true,board_id:demanda?8385559107:7829537690,
      total:itens.length,gerado_em:new Date().toISOString(),status:[{chave:'a_fazer',rotulo:'A Fazer',cor:'#579bfc',borda:'#579bfc',monday_index:0}],
      captacao:[],opcoes:[],pessoas:[{id:'68035537',nome:'Operador de teste'}],itens});
  }
  if(url.pathname==='/api/painel'){
    const area=url.searchParams.get('area');
    if(area==='conta')return reply(200,{ok:true,pessoa});
    if(area==='notificacoes')return reply(200,{ok:true,notificacoes:[],nao_lidas:0});
    return reply(200,{ok:true,pessoas:[],clientes:[],acessos:[],automacoes:[],snapshots:[],colunas:[],opcoes:[],captacao:[],catalogos:{status:[],captacao:[],grupos:[],pessoas:[],formatos:[]}});
  }
  return reply(200,{ok:true,itens:[],items:[],eventos:[],snapshots:[],data: { boards: [] }});
}
