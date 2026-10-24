import {metricasDoHub} from './assistente-hub.js';
// Projeções operacionais do domínio existente; sem SQL fornecido pelo modelo.
import {BOARD_DEMANDAS,BOARD_PRODUCAO} from './grupos.js';
import {normalizarConteudo} from './planejamentos.js';
const inteiro={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const busca={type:'string',maxLength:100};
const data={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const pagina={limite:{type:'integer',minimum:1,maximum:25},deslocamento:{type:'integer',minimum:0,maximum:2000}};
const defs=[
 ['minhas_demandas','Demandas da pessoa autenticada, sem ID escolhido pelo modelo. Hoje usa prazo ou, se ausente, veiculação.',{periodo:{type:'string',enum:['hoje','todas']},...pagina}],
 ['consultar_metricas_trafego','Métricas de tráfego e campanhas por cliente e período, pela fonte VybeHub.',{cliente_id:inteiro,de:data,ate:data},['cliente_id','de','ate']],
 ['buscar_demandas','Demandas e conteúdos operacionais. Status não comprova publicação.',{busca,cliente_id:inteiro,responsavel_id:inteiro,status:busca,de:data,ate:data,...pagina}],
 ['detalhar_demanda','Detalhes operacionais de uma demanda, sem notas privadas ou anexos.',{id:inteiro},['id']],
 ['listar_clientes','Clientes e carteira operacional, sem contatos ou contratos.',{busca,...pagina}],
 ['listar_responsaveis','Equipe ativa, nomes e funções, sem e-mails ou dados pessoais.',{busca,...pagina}],
 ['listar_planejamentos','Planejamentos, mês e situação de aprovação.',{cliente_id:inteiro,de:data,ate:data,...pagina}],
 ['detalhar_planejamento','Resumo estratégico e temas do planejamento, sem links secretos ou comentários pessoais.',{id:inteiro},['id']],
 ['listar_captacoes','Gravações registradas no módulo de captações, sem acesso externo ao Google.',{cliente_id:inteiro,de:data,ate:data,...pagina}],
 ['listar_roteiros','Referências operacionais dos roteiros; o texto continua no Drive.',{cliente_id:inteiro,...pagina}],
 ['cobertura_modulos','Informa módulos disponíveis e limitações de campanhas, publicações e resultados.',{}]
];
export const FERRAMENTAS_ASSISTENTE=defs.map(([name,description,properties,required=[]])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}}));
export function validarFerramenta(nome,args={}){
 const d=FERRAMENTAS_ASSISTENTE.find(x=>x.function.name===nome)?.function.parameters;
 if(!d||!args||typeof args!=='object'||Array.isArray(args))throw new TypeError('Ferramenta inválida.');
 for(const k of d.required)if(!(k in args))throw new TypeError('Parâmetro obrigatório.');
 for(const [k,v] of Object.entries(args)){
  const p=Object.hasOwn(d.properties,k)?d.properties[k]:null;if(!p)throw new TypeError('Parâmetro desconhecido.');
  if(p.type==='integer'&&(!Number.isSafeInteger(v)||v<p.minimum||v>p.maximum))throw new TypeError('Número inválido.');
  if(p.type==='string'&&(typeof v!=='string'||v.length>(p.maxLength||10)))throw new TypeError('Texto inválido.');
  if(p.enum&&!p.enum.includes(v))throw new TypeError('Opção inválida.');
  if(p.pattern&&(!new RegExp(p.pattern).test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v))throw new TypeError('Data inválida.');
 }
 if(nome==='consultar_metricas_trafego'&&args.de&&args.ate&&Date.parse(args.ate)-Date.parse(args.de)>93*86400000)throw new TypeError('Período máximo de 93 dias.');
 if(args.de&&args.ate&&args.de>args.ate)throw new TypeError('Período inválido.');
 return args;
}
// Defesa adicional, não classificação perfeita de texto livre. Excluímos fontes
// sensíveis inteiras: briefing/notas/documentos livres não são retornados.
export function textoOperacional(v,max=300){return String(v??'').slice(0,max)
 .replace(/(?:https?:\/\/|postgres(?:ql)?:\/\/)[^\s]+/gi,'[link omitido]')
 .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[contato omitido]')
 .replace(/\b(?:token|senha|password|secret|api[_ -]?key)\s*[:=]\s*\S+/gi,'[credencial omitida]')
 .replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[identificador omitido]')
 .replace(/(?:\+?\d[\d(). -]{9,}\d)/g,'[número omitido]');}
const limpar=v=>Array.isArray(v)?v.map(limpar):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,typeof x==='string'&&!['id','cliente_id','prazo','veiculacao','mes','dia','inicio','fim','atualizado_em','data'].includes(k)?textoOperacional(x):limpar(x)])):v;
export function diaAssistente(agora=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(agora);
}
export async function executarFerramenta(sql,nome,args,identidade={}){
 const a=validarFerramenta(nome,args),q=a.busca||'',cid=a.cliente_id||null,rid=a.responsavel_id||null,status=a.status||'',de=a.de||null,ate=a.ate||null;
 const limit=a.limite||25,offset=a.deslocamento||0;let itens,modulo;
 if(nome==='minhas_demandas'){
  if(!Number.isSafeInteger(identidade.pessoaId)||identidade.pessoaId<=0)throw new TypeError('Identidade autenticada obrigatória.');
  const periodo=a.periodo||'todas';
  const dia=periodo==='hoje'?diaAssistente(identidade.agora):null;
  const r=await executarFerramenta(sql,'buscar_demandas',{responsavel_id:identidade.pessoaId,limite:limit,deslocamento:offset},{diaDaPessoa:dia});
  return {...r,ferramenta:nome,escopo:'pessoa_autenticada',periodo,dia,observacao:'Somente a pessoa autenticada. Hoje segue o prazo; sem prazo, a veiculação. Não indica publicação comprovada.'};
 }
 if(nome==='consultar_metricas_trafego')return limpar(await metricasDoHub(sql,a));
 if(nome==='cobertura_modulos')return {fonte:'vybe-neon',itens:[{disponiveis:['demandas','conteudos','clientes','responsaveis','planejamentos','aprovacao_do_planejamento','captacoes','referencias_de_roteiros'],limitacoes:['Campanhas e tráfego vêm do VybeHub; a ponte exige configuração própria e vínculo explícito do cliente.','Publicação: retorna status registrado, sem inferir entrega ou veiculação efetiva.','Roteiros: apenas referência; não lê texto do Drive.','Sem financeiro, RH, credenciais, notas privadas ou documentos pessoais.']}],limitado:false};
 if(['buscar_demandas','detalhar_demanda'].includes(nome)){
  modulo='demandas';const id=a.id||null,diaDaPessoa=identidade.diaDaPessoa||null;
  itens=await sql`SELECT c.id::text AS id,c.titulo,c.formato,c.prazo::text,c.veiculacao::text,c.atualizado_em::text,s.rotulo AS status,
   COALESCE((SELECT json_agg(json_build_object('id',cl.id::text,'nome',cl.nome)) FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id WHERE cc.conteudo_id=c.id),'[]') AS clientes,
   COALESCE((SELECT json_agg(json_build_object('id',p.id::text,'nome',p.nome)) FROM vybe_conteudo_responsaveis cr JOIN vybe_pessoas p ON p.id=cr.pessoa_id WHERE cr.conteudo_id=c.id),'[]') AS responsaveis
   FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
   WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_DEMANDAS},${BOARD_PRODUCAO})
   AND (${diaDaPessoa}::date IS NULL OR COALESCE(c.prazo,c.veiculacao)=${diaDaPessoa}::date)
   AND (${id}::bigint IS NULL OR c.id=${id}) AND (${q}='' OR c.titulo ILIKE '%'||${q}||'%')
   AND (${cid}::bigint IS NULL OR EXISTS(SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id=c.id AND cc.cliente_id=${cid}))
   AND (${rid}::bigint IS NULL OR EXISTS(SELECT 1 FROM vybe_conteudo_responsaveis cr WHERE cr.conteudo_id=c.id AND cr.pessoa_id=${rid}))
   AND (${status}='' OR s.rotulo ILIKE ${status}) AND (${de}::date IS NULL OR c.prazo>=${de}::date) AND (${ate}::date IS NULL OR c.prazo<=${ate}::date)
   ORDER BY c.prazo ASC NULLS LAST,c.id LIMIT ${limit} OFFSET ${offset}`;
 }else if(nome==='listar_clientes'){
  modulo='clientes';itens=await sql`SELECT id::text,nome,responsavel AS carteira FROM vybe_clientes WHERE COALESCE(ativo,true) AND (${q}='' OR nome ILIKE '%'||${q}||'%') ORDER BY nome,id LIMIT ${limit} OFFSET ${offset}`;
 }else if(nome==='listar_responsaveis'){
  modulo='pessoas';itens=await sql`SELECT id::text,nome,papel,disciplina FROM vybe_pessoas WHERE ativo AND pode_entrar AND (${q}='' OR nome ILIKE '%'||${q}||'%') ORDER BY nome,id LIMIT ${limit} OFFSET ${offset}`;
 }else if(['listar_planejamentos','detalhar_planejamento'].includes(nome)){
  modulo='planejamentos';const id=a.id||null;
  itens=await sql`SELECT p.id::text,p.cliente_id::text,cl.nome AS cliente,p.mes::text,p.titulo,p.estado,p.atualizado_em::text,
    CASE WHEN ${id}::bigint IS NOT NULL THEN p.conteudo ELSE NULL END AS conteudo
    FROM vybe_planejamentos p JOIN vybe_clientes cl ON cl.id=p.cliente_id WHERE p.estado<>'arquivado'
    AND (${id}::bigint IS NULL OR p.id=${id}) AND (${cid}::bigint IS NULL OR p.cliente_id=${cid})
    AND (${de}::date IS NULL OR p.mes>=${de}::date) AND (${ate}::date IS NULL OR p.mes<=${ate}::date)
    ORDER BY p.mes DESC,p.id DESC LIMIT ${limit} OFFSET ${offset}`;
  itens=itens.map(({conteudo,...p})=>{if(!conteudo)return p;const n=normalizarConteudo(conteudo);return {...p,resumo:textoOperacional(n.resumo,1000),temas:n.pecas.slice(0,20).map(x=>({data:x.data,formato:x.formato,tema:textoOperacional(x.tema,160)})),temas_limitados:n.pecas.length>20};});
 }else if(nome==='listar_captacoes'){
  modulo='captacoes';itens=await sql`SELECT k.id::text,k.cliente_id::text,cl.nome AS cliente,k.dia::text,k.inicio::text,k.fim::text,k.estado
  FROM vybe_captacoes k LEFT JOIN vybe_clientes cl ON cl.id=k.cliente_id WHERE k.estado<>'cancelada'
  AND (${cid}::bigint IS NULL OR k.cliente_id=${cid}) AND (${de}::date IS NULL OR k.dia>=${de}::date) AND (${ate}::date IS NULL OR k.dia<=${ate}::date)
  ORDER BY k.dia,k.id LIMIT ${limit} OFFSET ${offset}`;
 }else if(nome==='listar_roteiros'){
  modulo='roteiros';itens=await sql`SELECT r.id::text,r.titulo,r.cliente_id::text,cl.nome AS cliente FROM vybe_roteiros r LEFT JOIN vybe_clientes cl ON cl.id=r.cliente_id
  WHERE r.removido_em IS NULL AND (${cid}::bigint IS NULL OR r.cliente_id=${cid}) ORDER BY r.criado_em DESC,r.id DESC LIMIT ${limit} OFFSET ${offset}`;
 }
 const seguros=limpar(itens);
 return {fonte:'vybe-neon',ferramenta:nome,itens:seguros,fontes:itens.map(x=>({modulo,id:x.id})),limite:limit,deslocamento:offset,limitado:itens.length===limit,observacao:'Recorte operacional; não representa publicação comprovada, produtividade ou acesso a campos restritos.'};
}
