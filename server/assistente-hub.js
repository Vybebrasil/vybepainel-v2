// Ponte de servidor para o BI existente do VybeHub. Não usa sessão de cliente,
// token do bot, PORTAL_CHAVE ou credenciais Meta/Google.
export async function metricasDoHub(sql,a,{config=process.env,buscar=fetch}={}){
 if(config.VYBE_AI_HUB_ATIVO!=='1')throw Object.assign(new Error('Métricas do VybeHub ainda não configuradas neste ambiente.'),{status:503});
 let base,mapa;try{base=new URL(config.VYBE_AI_HUB_URL);mapa=JSON.parse(config.VYBE_AI_HUB_CLIENTES||'{}');}catch{throw new TypeError('Configuração do Hub inválida.');}
 if(base.protocol!=='https:'||base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash||!/^vybehub-[a-z0-9-]+-vybe-hub\.vercel\.app$/.test(base.hostname)||base.hostname.includes('-git-main-'))throw new TypeError('Use um Preview autorizado do VybeHub.');
 const segredo=config.VYBE_OS_METRICAS_TOKEN;
 if(!/^[A-Za-z0-9_-]{48,256}$/.test(segredo||''))throw new TypeError('Ponte de métricas não configurada.');
 const slug=mapa[String(a.cliente_id)];if(typeof slug!=='string'||!/^[-a-z0-9]{1,80}$/.test(slug))throw new TypeError('Cliente sem correspondência aprovada no VybeHub.');
 const [cliente]=await sql`SELECT id::text,nome FROM vybe_clientes WHERE id=${a.cliente_id} AND COALESCE(ativo,true)`;
 if(!cliente)throw new TypeError('Cliente inválido.');
 const modulo=a.modulo||'trafego',limite=a.limite||25,offset=a.deslocamento||0;
 const input=JSON.stringify({json:{slug,cliente_nome:cliente.nome,since:a.de,until:a.ate,modulo,limite,deslocamento:offset}});
 const r=await buscar(base.origin+'/api/trpc/portal.metricasOperacionais?input='+encodeURIComponent(input),{headers:{Authorization:'Bearer '+segredo},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(new Error('Não foi possível consultar as métricas do VybeHub.'),{status:503});
 if(Number(r.headers.get('content-length')||0)>131072)throw new TypeError('Resposta excede limite.');
 const reader=r.body.getReader();let total=0;const partes=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>131072)throw new TypeError('Resposta excede limite.');partes.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 let d;try{d=JSON.parse(Buffer.concat(partes).toString()).result.data.json;}catch{throw new TypeError('Resposta de métricas inválida.');}
 if(d?.slug!==slug||d?.cliente_nome!==cliente.nome||d?.de!==a.de||d?.ate!==a.ate||!Array.isArray(d.linhas)||(d.modulo||'trafego')!==modulo||(d.deslocamento||0)!==offset)throw new TypeError('Cliente ou período não conferem no Hub.');
 // Projeção de saída mesmo que o Hub passe a devolver campos adicionais.
 const campos={campanhas:['id','name','objective','status','dailyBudget','lifetimeBudget','startTime','stopTime','spent','impressions','reach','frequency','clicks','messages','results','resultType','follows'],anuncios:['id','name','campaign','status','text','format','resultType','follows','thruPlays','spent','impressions','reach','clicks','messages','results'],publico:['dimensao','label','spent','reach','impressions','clicks','messages','age','gender','platform','position','hour','outcomes'],segmentacao:['kind','name','context','radius','excluded'],trafego:['date','campaign','reach','impressions','amountSpent','linkClicks','results','resultType','costPerResult','cpm','cpc','messagingConversations','frequency','postEngagement','videoViews','landingPageViews','reactions','comments','shares','saves','follows','thruPlays','videoAvgTime'],
 alcance:['date','dateLabel','contasAlcancadas','impressoes','naoSeguidoresPct','seguidoresPct','atividadesPerfil','visitasPerfil','linksExternos','enderecoComercial'],
 interacoes:['date','dateLabel','interacoes','seguidoresPct','naoSeguidoresPct','reels','publi','stories'],seguidores:['date','dateLabel','total','crescimento','seguiram','deixaram'],
 faturamento:['date','dateLabel','meta','influencers','midiaOff','radio','faturamento'],objetivos:['primary','secondary'],
 aprovacoes:['id','contentTitle','status','comment','createdAt','updatedAt'],documentos:['id','name','mimeType','modifiedTime','size','isFolder'],marca:['id','name','mimeType','modifiedTime','size','isFolder']};
 if(!Object.hasOwn(campos,modulo))throw new TypeError('Módulo inválido.');
 const valor=v=>typeof v==='number'?(Number.isFinite(v)?v:null):typeof v==='boolean'?v:typeof v==='string'?v.slice(0,2000):null;
 const itens=d.linhas.slice(0,limite).map(x=>Object.fromEntries(campos[modulo].filter(k=>Object.hasOwn(x,k)).map(k=>[k,
 ['reels','publi','stories','outcomes'].includes(k)&&x[k]&&typeof x[k]==='object'?Object.fromEntries(['curtidas','comentarios','salvar','compartilhar','respostas','messages','profile_visits','follows','leads','purchases','link_clicks','video_views','engagement'].filter(n=>Object.hasOwn(x[k],n)).map(n=>[n,valor(x[k][n])])):valor(x[k])])));
 return {fonte:'vybehub',cliente_id:String(a.cliente_id),cliente:cliente.nome,de:a.de,ate:a.ate,modulo,limite,deslocamento:offset,itens,origem_dados:['meta','sheet','drive','vybehub'].includes(d.origem_dados)?d.origem_dados:null,
 limitado:Boolean(d.limitado)||d.linhas.length>limite,atualizado_em:Number.isFinite(d.atualizado_em)?d.atualizado_em:null,fontes:[{modulo:'vybehub_metricas',id:String(a.cliente_id)}],
 observacao:(modulo==='publico'?'Público agregado; horários/posicionamentos podem estar indisponíveis. Vazio não comprova ausência. ':modulo==='segmentacao'?'Segmentação atual, não desempenho nem histórico. ':'')+'Alcance não deve ser somado entre dias/campanhas. Resultados devem ser comparados por resultType. Ausência de dado não é zero. Faturamento é o BI do cliente, não folha interna. Objetivos são atuais; documentos/marca são metadados da raiz, sem conteúdo binário e sem filtro de período. Credenciais e URLs são excluídas.'};
}
