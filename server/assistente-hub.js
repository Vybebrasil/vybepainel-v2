// Ponte de servidor para o BI existente do VybeHub. Não usa sessão de cliente,
// token do bot, PORTAL_CHAVE ou credenciais Meta/Google.
import { previewVybeAiIsolada } from './homologacao.js';

function headersDaPonte(base, config, segredo) {
 const headers = { Authorization: 'Bearer ' + segredo };
 // O bypass do Hub nunca e o bypass do proprio projeto OS, nem vai em URLs.
 // Fora desta branch, o contrato anterior permanece inalterado.
 if (!previewVybeAiIsolada(config)) return headers;
 const bypass = config.VYBE_AI_HUB_VERCEL_BYPASS_SECRET;
 if (typeof bypass !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(bypass) || bypass === segredo ||
     config.VYBE_AI_HUB_VERCEL_BYPASS_ORIGIN !== base.origin) {
  throw Object.assign(new Error('Acesso protegido ao Hub não configurado para esta Preview.'), { status: 503 });
 }
 headers['x-vercel-protection-bypass'] = bypass;
 return headers;
}

// Mesmo slugify do sincronizador de clientes do Hub (server/syncVybeClientes.ts).
export const slugDoHub=nome=>String(nome).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'cliente';
async function ponteDoHub(sql,clienteId,config){
 if(config.VYBE_AI_HUB_ATIVO!=='1')throw Object.assign(new Error('Métricas do VybeHub ainda não configuradas neste ambiente.'),{status:503});
 let base,mapa;try{base=new URL(config.VYBE_AI_HUB_URL);mapa=config.VYBE_AI_HUB_CLIENTES==='auto'?'auto':JSON.parse(config.VYBE_AI_HUB_CLIENTES||'{}');}catch{throw new TypeError('Configuração do Hub inválida.');}
 // Production do Hub (vybehub.vercel.app) ou um Preview autorizado; nunca outro host.
 const hostOk=base.hostname==='vybehub.vercel.app'||(/^vybehub-[a-z0-9-]+-vybe-hub\.vercel\.app$/.test(base.hostname)&&!base.hostname.includes('-git-main-'));
 if(base.protocol!=='https:'||base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash||!hostOk)throw new TypeError('Use o VybeHub de Production ou um Preview autorizado.');
 const segredo=config.VYBE_OS_METRICAS_TOKEN;
 if(!/^[A-Za-z0-9_-]{48,256}$/.test(segredo||''))throw new TypeError('Ponte de métricas não configurada.');
 const headers = headersDaPonte(base, config, segredo);
 const [cliente]=await sql`SELECT id::text,nome FROM vybe_clientes WHERE id=${clienteId} AND COALESCE(ativo,true)`;
 if(!cliente)throw new TypeError('Cliente inválido.');
 // VYBE_AI_HUB_CLIENTES="auto": o slug sai do nome, igual ao sincronizador do Hub (syncVybeClientes); o Hub
 // ainda confere slug e nome exatos. Fora do modo auto, só a lista aprovada {cliente_id: slug}.
 const slug=mapa==='auto'?slugDoHub(cliente.nome):mapa[String(clienteId)];
 if(typeof slug!=='string'||!/^[-a-z0-9]{1,80}$/.test(slug))throw new TypeError('Cliente sem correspondência aprovada no VybeHub.');
 return {base,headers,cliente,slug};
}
export async function metricasDoHub(sql,a,{config=process.env,buscar=fetch}={}){
 const {base,headers,cliente,slug}=await ponteDoHub(sql,a.cliente_id,config);
 const modulo=a.modulo||'trafego',limite=a.limite||25,offset=a.deslocamento||0;
 const input=JSON.stringify({json:{slug,cliente_nome:cliente.nome,since:a.de,until:a.ate,modulo,limite,deslocamento:offset}});
 let r;
 try {
  r=await buscar(base.origin+'/api/trpc/portal.metricasOperacionais?input='+encodeURIComponent(input),{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
 } catch (erro) {
  if (!previewVybeAiIsolada(config)) throw erro;
  // Não propagar erros do transporte que possam carregar URL ou headers.
  throw Object.assign(new Error('Não foi possível consultar as métricas do VybeHub.'),{status:503});
 }
 if(!r.ok)throw Object.assign(new Error('Não foi possível consultar as métricas do VybeHub.'),{status:503});
 if(Number(r.headers.get('content-length')||0)>131072)throw new TypeError('Resposta excede limite.');
 const reader=r.body.getReader();let total=0;const partes=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>131072)throw new TypeError('Resposta excede limite.');partes.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 let d;try{d=JSON.parse(Buffer.concat(partes).toString()).result.data.json;}catch{throw new TypeError('Resposta de métricas inválida.');}
 if(d?.slug!==slug||d?.cliente_nome!==cliente.nome||d?.de!==a.de||d?.ate!==a.ate||!Array.isArray(d.linhas)||(d.modulo||'trafego')!==modulo||(d.deslocamento||0)!==offset)throw new TypeError('Cliente ou período não conferem no Hub.');
 // Projeção de saída mesmo que o Hub passe a devolver campos adicionais.
 const campos={campanhas:['id','name','objective','status','dailyBudget','lifetimeBudget','startTime','stopTime','spent','impressions','reach','frequency','clicks','messages','results','resultType','follows'],anuncios:['id','name','campaign','status','text','format','resultType','follows','thruPlays','spent','impressions','reach','clicks','messages','results'],publico:['dimensao','label','spent','reach','impressions','clicks','messages','age','gender','platform','position','hour','outcomes'],segmentacao:['kind','name','context','radius','excluded'],semana:['texto'],posts:['id','date','tipo','legenda','alcance','visualizacoes','curtidas','comentarios','salvamentos','compartilhamentos','interacoes','erro'],resumo:['tipo','nome','objetivo','investido','impressoes','alcance','frequencia','cliques','ctr','cpm','cpc','conversas','resultados','tipoResultado','custoResultado','seguidores'],trafego:['date','campaign','reach','impressions','amountSpent','linkClicks','results','resultType','costPerResult','cpm','cpc','messagingConversations','frequency','postEngagement','videoViews','landingPageViews','reactions','comments','shares','saves','follows','thruPlays','videoAvgTime'],
 alcance:['date','dateLabel','contasAlcancadas','impressoes','naoSeguidoresPct','seguidoresPct','atividadesPerfil','visitasPerfil','linksExternos','enderecoComercial'],
 interacoes:['date','dateLabel','interacoes','seguidoresPct','naoSeguidoresPct','reels','publi','stories'],seguidores:['date','dateLabel','total','crescimento','seguiram','deixaram'],
 faturamento:['date','dateLabel','meta','influencers','midiaOff','radio','faturamento'],objetivos:['primary','secondary'],
 aprovacoes:['id','contentTitle','status','comment','createdAt','updatedAt'],documentos:['id','name','mimeType','modifiedTime','size','isFolder'],marca:['id','name','mimeType','modifiedTime','size','isFolder']};
 if(!Object.hasOwn(campos,modulo))throw new TypeError('Módulo inválido.');
 const valor=v=>typeof v==='number'?(Number.isFinite(v)?v:null):typeof v==='boolean'?v:typeof v==='string'?v.slice(0,modulo==='semana'?4000:2000):null;
 const itens=d.linhas.slice(0,limite).map(x=>Object.fromEntries(campos[modulo].filter(k=>Object.hasOwn(x,k)).map(k=>[k,
 ['reels','publi','stories','outcomes'].includes(k)&&x[k]&&typeof x[k]==='object'?Object.fromEntries(['curtidas','comentarios','salvar','compartilhar','respostas','messages','profile_visits','follows','leads','purchases','link_clicks','video_views','engagement'].filter(n=>Object.hasOwn(x[k],n)).map(n=>[n,valor(x[k][n])])):valor(x[k])])));
 return {fonte:'vybehub',cliente_id:String(a.cliente_id),cliente:cliente.nome,de:a.de,ate:a.ate,modulo,limite,deslocamento:offset,itens,origem_dados:['meta','sheet','drive','vybehub','homologacao_fixture'].includes(d.origem_dados)?d.origem_dados:null,
 limitado:Boolean(d.limitado)||d.linhas.length>limite,atualizado_em:Number.isFinite(d.atualizado_em)?d.atualizado_em:null,fontes:[{modulo:'vybehub_metricas',id:String(a.cliente_id)}],
 observacao:(d.origem_dados==='homologacao_fixture'?'DADOS FICTÍCIOS DE HOMOLOGAÇÃO. ':'')+(modulo==='publico'?'Público agregado; horários/posicionamentos podem estar indisponíveis. Vazio não comprova ausência. ':modulo==='segmentacao'?'Segmentação atual, não desempenho nem histórico. ':'')+'Alcance não deve ser somado entre dias/campanhas. Resultados devem ser comparados por resultType. Ausência de dado não é zero. Faturamento é o BI do cliente, não folha interna. Objetivos são atuais; documentos/marca são metadados da raiz, sem conteúdo binário e sem filtro de período. Credenciais e URLs são excluídas.'};
}

// Resumo da semana de cada cliente ativo (o texto do botão do painel do Hub), para o atendimento mandar aos
// clientes. Cliente sem BI ou sem conta de anúncios no Hub entra na lista "sem dados", nunca com números zerados.
export async function resumosDaSemana(sql,dia,opcoes={}){
 if(typeof dia!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dia))throw new TypeError('Dia inválido.');
 const de=new Date(Date.parse(dia+'T12:00:00Z')-8*864e5).toISOString().slice(0,10);
 const clientes=await sql`SELECT id::text,nome FROM vybe_clientes WHERE COALESCE(ativo,true) ORDER BY nome`;
 const resumos=[],semDados=[];
 // Em lotes de 6: cada consulta ao Hub leva alguns segundos (planilha e Meta).
 for(let i=0;i<clientes.length;i+=6)await Promise.all(clientes.slice(i,i+6).map(async c=>{
  try{
   const r=await metricasDoHub(sql,{cliente_id:Number(c.id),de,ate:dia,modulo:'semana',limite:1},opcoes);
   const texto=r.itens?.[0]?.texto;
   if(typeof texto==='string'&&texto.trim())resumos.push({cliente:c.nome,texto});else semDados.push(c.nome);
  }catch{semDados.push(c.nome);}
 }));
 resumos.sort((a,b)=>a.cliente.localeCompare(b.cliente,'pt-BR'));semDados.sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return {resumos,sem_dados:semDados};
}

// Resultado dos posts de ontem (Paulo, 27/10/2026: "o time ver o resultado do próprio trabalho"): cada post do Instagram
// publicado ontem, com alcance comparado à média dos posts do cliente nos últimos 30 dias, salvamentos e
// compartilhamentos. Vai para o grupo dos heads. Token sem permissão do Instagram: volta o aviso (uma linha), sem número.
const BAHIA = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(iso));
const mil = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('pt-BR') : '–');
export function mensagemResultadoPosts(dia, porCliente) {
  const ontem = new Date(Date.parse(dia + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const blocos = [];
  for (const { cliente, posts } of porCliente) {
    const deOntem = posts.filter((p) => p.date && BAHIA(p.date) === ontem && Number.isFinite(p.alcance));
    if (!deOntem.length) continue;
    const outros = posts.filter((p) => p.date && BAHIA(p.date) < ontem && Number.isFinite(p.alcance));
    const media = outros.length >= 3 ? outros.reduce((t, p) => t + p.alcance, 0) / outros.length : null;
    blocos.push(`*${cliente}*\n` + deOntem.map((p) => {
      const x = media ? p.alcance / media : null;
      const sinal = x === null ? '📊' : x >= 1.5 ? '🔥' : x <= 0.6 ? '📉' : '📊';
      const comp = x === null ? '' : ` (${x >= 1 ? x.toFixed(1).replace('.', ',') + 'x a média' : Math.round(x * 100) + '% da média'})`;
      const extras = [Number.isFinite(p.salvamentos) && `${mil(p.salvamentos)} salvamentos`, Number.isFinite(p.compartilhamentos) && `${mil(p.compartilhamentos)} compartilhamentos`].filter(Boolean).join(', ');
      return `${sinal} ${p.tipo || 'Post'} “${String(p.legenda || '').slice(0, 50) || 'sem legenda'}”: alcance *${mil(p.alcance)}*${comp}${extras ? ', ' + extras : ''}`;
    }).join('\n'));
  }
  if (!blocos.length) return null;
  return `📈 *Resultado dos posts de ontem (${ontem.slice(8, 10)}/${ontem.slice(5, 7)})*\n_Alcance comparado à média do cliente nos últimos 30 dias._\n\n${blocos.join('\n\n')}`;
}
export async function resultadoDosPosts(sql, dia, opcoes = {}) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const de = new Date(Date.parse(dia + 'T12:00:00Z') - 30 * 864e5).toISOString().slice(0, 10);
  const clientes = await sql`SELECT id::text,nome FROM vybe_clientes WHERE COALESCE(ativo,true) ORDER BY nome`;
  const porCliente = [], erros = new Set();
  for (let i = 0; i < clientes.length; i += 6) await Promise.all(clientes.slice(i, i + 6).map(async (c) => {
    try {
      const r = await metricasDoHub(sql, { cliente_id: Number(c.id), de, ate: dia, modulo: 'posts', limite: 25 }, opcoes);
      const erro = r.itens.find((x) => typeof x.erro === 'string')?.erro;
      if (erro) erros.add(erro); else porCliente.push({ cliente: c.nome, posts: r.itens });
    } catch { /* cliente sem conta de anúncio ou sem Instagram: fica de fora */ }
  }));
  porCliente.sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  return { texto: mensagemResultadoPosts(dia, porCliente), erro: [...erros][0] || null };
}

// Relatório mensal em PDF (27/10/2026): o Hub devolve um convite de 10 minutos para o mesmo relatório do admin;
// o bot abre o link no navegador dele e salva o PDF. Só o caminho do Hub de Production ou Preview autorizado.
export async function linkDoRelatorio(sql,{cliente_id:clienteId,mes},{config=process.env,buscar=fetch}={}){
 if(typeof mes!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(mes))throw new TypeError('Mês inválido.');
 const {base,headers,cliente,slug}=await ponteDoHub(sql,clienteId,config);
 const input=JSON.stringify({json:{slug,cliente_nome:cliente.nome,mes:mes.slice(0,7)}});
 let r;
 try{r=await buscar(base.origin+'/api/trpc/portal.conviteRelatorio?input='+encodeURIComponent(input),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});}
 catch{throw Object.assign(new Error('Não foi possível pedir o relatório ao VybeHub.'),{status:503});}
 if(!r.ok)throw Object.assign(new Error('Cliente sem BI no VybeHub ou relatório indisponível.'),{status:503});
 let d;try{d=(await r.json()).result.data.json;}catch{throw new TypeError('Resposta do relatório inválida.');}
 if(typeof d?.caminho!=='string'||!/^\/relatorio-ai\/[-a-z0-9]{1,80}\?mes=\d{4}-\d{2}&c=[A-Za-z0-9_.-]{20,600}$/.test(d.caminho))throw new TypeError('Resposta do relatório inválida.');
 return {cliente:cliente.nome,mes:mes.slice(0,7),url:base.origin+d.caminho};
}
