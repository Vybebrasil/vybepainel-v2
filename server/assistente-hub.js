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
 const input=JSON.stringify({json:{slug,cliente_nome:cliente.nome,since:a.de,until:a.ate}});
 const r=await buscar(base.origin+'/api/trpc/portal.metricasOperacionais?input='+encodeURIComponent(input),{headers:{Authorization:'Bearer '+segredo},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(new Error('Não foi possível consultar as métricas do VybeHub.'),{status:503});
 if(Number(r.headers.get('content-length')||0)>131072)throw new TypeError('Resposta excede limite.');
 const reader=r.body.getReader();let total=0;const partes=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>131072)throw new TypeError('Resposta excede limite.');partes.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 let d;try{d=JSON.parse(Buffer.concat(partes).toString()).result.data.json;}catch{throw new TypeError('Resposta de métricas inválida.');}
 if(d?.slug!==slug||d?.cliente_nome!==cliente.nome||d?.de!==a.de||d?.ate!==a.ate||!Array.isArray(d.linhas))throw new TypeError('Cliente ou período não conferem no Hub.');
 // Projeção de saída mesmo que o Hub passe a devolver campos adicionais.
 const chaves=['date','campaign','reach','impressions','amountSpent','linkClicks','results','resultType','costPerResult','cpm','cpc','messagingConversations'];
 const itens=d.linhas.slice(0,25).map(x=>Object.fromEntries(chaves.filter(k=>k in x).map(k=>[k,typeof x[k]==='number'?(Number.isFinite(x[k])?x[k]:null):typeof x[k]==='string'?x[k].slice(0,160):null])));
 return {fonte:'vybehub',cliente_id:String(a.cliente_id),cliente:cliente.nome,de:a.de,ate:a.ate,itens,origem_dados:['meta','sheet'].includes(d.origem_dados)?d.origem_dados:null,
 limitado:Boolean(d.limitado)||d.linhas.length>25,atualizado_em:Number.isFinite(d.atualizado_em)?d.atualizado_em:null,fontes:[{modulo:'vybehub_metricas',id:String(a.cliente_id)}],
 observacao:'Alcance não deve ser somado entre dias/campanhas. Resultados devem ser comparados por resultType. Ausência de dado não é zero. Faturamento, dados de pessoas e credenciais são excluídos.'};
}
