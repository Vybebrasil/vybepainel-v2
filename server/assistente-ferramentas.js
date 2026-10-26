import {consultarPerfilJogo,consultarPerfilTrabalho,consultarRanking,consultarDiaEquipe,secaoDaDemanda} from './assistente-dominio.js';
import {metricasDoHub} from './assistente-hub.js';
// Projeções operacionais do domínio existente; sem SQL fornecido pelo modelo.
import {BOARD_DEMANDAS,BOARD_PRODUCAO} from './grupos.js';
import {pecasComRevisao} from './planejamento-documento.js';
import {normalizarConteudo} from './planejamentos.js';
const inteiro={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const busca={type:'string',maxLength:100};
const data={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const situacao={type:'string',enum:['todas','pendentes','atrasadas']};
// finalizadas_hoje: status final alcançado hoje, pelo histórico de status (a mesma regra do Dia da equipe).
const situacaoBusca={type:'string',enum:[...situacao.enum,'finalizadas_hoje']};
const pagina={limite:{type:'integer',minimum:1,maximum:25},deslocamento:{type:'integer',minimum:0,maximum:2000}};
const defs=[
 ['minhas_demandas','Demandas da pessoa autenticada, sem ID escolhido pelo modelo. Hoje usa prazo ou, se ausente, veiculação. Pendentes usam status oficial não final; atrasadas exigem prazo vencido e status não final.',{periodo:{type:'string',enum:['hoje','todas']},situacao,...pagina}],
 ['consultar_metricas_trafego','Métricas de tráfego e campanhas por cliente e período, pela fonte VybeHub.',{cliente_id:inteiro,de:data,ate:data,modulo:{type:'string',enum:['trafego','alcance','interacoes','seguidores','faturamento','objetivos','aprovacoes','documentos','marca','campanhas','anuncios','publico','segmentacao']},...pagina},['cliente_id','de','ate']],
 ['buscar_demandas','Demandas e conteúdos operacionais. Status não comprova publicação. de/ate filtram o prazo da equipe; cliente_de/cliente_ate filtram a data do cliente (veiculação na Produção, conclusão nas Solicitações); quadro separa Produção (social media) de Solicitações; situacao finalizadas_hoje traz o que virou status final hoje.',{busca,cliente_id:inteiro,responsavel_id:inteiro,status:busca,situacao:situacaoBusca,de:data,ate:data,cliente_de:data,cliente_ate:data,quadro:{type:'string',enum:['producao','solicitacoes']},...pagina}],
 ['detalhar_demanda','Detalhes operacionais de uma demanda, com briefing, comentários, histórico, tarefas e referências de arquivos. Nunca lê segredos nem o conteúdo binário de anexos.',{id:inteiro,secao:{type:'string',enum:['ficha','comentarios','historico','tarefas','arquivos']},...pagina},['id']],
 ['listar_clientes','Clientes e carteira operacional, sem contatos ou contratos.',{busca,...pagina}],
 ['listar_responsaveis','Equipe ativa, nomes e funções, sem e-mails ou dados pessoais.',{busca,...pagina}],
 ['listar_planejamentos','Planejamentos, mês e situação de aprovação.',{cliente_id:inteiro,de:data,ate:data,...pagina}],
 ['detalhar_planejamento','Planejamento e peças com texto, ajustes e decisões válidas, paginadas. Sem links secretos.',{id:inteiro,...pagina},['id']],
 ['listar_captacoes','Gravações registradas no módulo de captações, sem acesso externo ao Google.',{cliente_id:inteiro,de:data,ate:data,...pagina}],
 ['listar_roteiros','Referências operacionais dos roteiros; o texto continua no Drive.',{cliente_id:inteiro,...pagina}],
 ['consultar_perfil_trabalho','Métricas de qualquer funcionário, com os mesmos cálculos da aba Trabalho: volume, média, evolução, recorde, qualidade e XP.',{pessoa_id:inteiro,de:data,ate:data,regra:busca,formato:busca},['pessoa_id','de','ate']],
 ['consultar_perfil_jogo','Nível, XP total, moedas, inventário e conquistas públicas de qualquer pessoa. Somente leitura.',{pessoa_id:inteiro,secao:{type:'string',enum:['resumo','inventario','conquistas']},...pagina},['pessoa_id']],
 ['consultar_ranking','Ranking de trabalho e patrimônio da equipe, usando as regras existentes.',{periodo:{type:'string',enum:['dia','semana','mes','total']},...pagina}],
 ['consultar_dia_equipe','Previsto, pronto, adiado e atrasado de toda a equipe hoje, pela mesma conta do Escritório.',{...pagina}],
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
  if(p.type==='string'&&(typeof v!=='string'||v.length>(p.maxLength||(p.enum?Math.max(...p.enum.map(x=>x.length)):10))))throw new TypeError('Texto inválido.');
  if(p.enum&&!p.enum.includes(v))throw new TypeError('Opção inválida.');
  if(p.pattern&&(!new RegExp(p.pattern).test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v))throw new TypeError('Data inválida.');
 }
 if(nome==='consultar_perfil_trabalho'&&args.de&&args.ate&&Date.parse(args.ate)-Date.parse(args.de)>=180*86400000)throw new TypeError('Período máximo de 180 dias.');
 if(nome==='consultar_metricas_trafego'&&args.de&&args.ate&&Date.parse(args.ate)-Date.parse(args.de)>93*86400000)throw new TypeError('Período máximo de 93 dias.');
 if(args.de&&args.ate&&args.de>args.ate)throw new TypeError('Período inválido.');
 if(args.cliente_de&&args.cliente_ate&&args.cliente_de>args.cliente_ate)throw new TypeError('Período inválido.');
 return args;
}
// Defesa adicional, não classificação perfeita de texto livre. Excluímos fontes
// Campos operacionais livres são autorizados à equipe, mas tratados como dados não confiáveis.
export function textoOperacional(v,max=300){return String(v??'').slice(0,max)
 .replace(/(?:https?:\/\/|postgres(?:ql)?:\/\/)[^\s]+/gi,'[link omitido]')
 .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[contato omitido]')
 .replace(/\b(?:token|senha|password|secret|api[_ -]?key)["']?\s*[:=]\s*["']?[^\s,}]+/gi,'[credencial omitida]')
 .replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[identificador omitido]')
 .replace(/(?:\+?\d[\d(). -]{9,}\d)/g,'[número omitido]');}
const limpar=v=>v instanceof Date?v.toISOString():typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(v)?v:Array.isArray(v)?v.map(limpar):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,typeof x==='string'&&!['id','cliente_id','prazo','veiculacao','mes','dia','inicio','fim','atualizado_em','data','criado_em','editado_em','em','quando','modifiedTime','createdAt','updatedAt'].includes(k)?(/^\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?$/.test(x)?x:textoOperacional(x,['texto','corpo','resumo','material_bruto'].includes(k)?6000:300)):limpar(x)])):v;
export function diaAssistente(agora=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(agora);
}
async function executarFerramentaBase(sql,nome,args,identidade={}){
 const a=validarFerramenta(nome,args),q=a.busca||'',cid=a.cliente_id||null,rid=a.responsavel_id||null,status=a.status||'',de=a.de||null,ate=a.ate||null;
 const limit=a.limite||25,offset=a.deslocamento||0;let itens,modulo;
 if(nome==='minhas_demandas'){
  if(!Number.isSafeInteger(identidade.pessoaId)||identidade.pessoaId<=0)throw new TypeError('Identidade autenticada obrigatória.');
  const periodo=a.periodo||'todas';
  const dia=periodo==='hoje'?diaAssistente(identidade.agora):null;
  const r=await executarFerramenta(sql,'buscar_demandas',{responsavel_id:identidade.pessoaId,limite:limit,deslocamento:offset,situacao:a.situacao||'todas'},{diaDaPessoa:dia,agora:identidade.agora});
  return {...r,ferramenta:nome,escopo:'pessoa_autenticada',periodo,situacao:a.situacao||'todas',dia,observacao:'Somente a pessoa autenticada. Hoje segue prazo ou, sem prazo, veiculação. Pendentes exigem status oficial final=false; atrasadas também exigem prazo vencido. Status desconhecido fica fora desses dois filtros. Sem prazo não é atrasada. Não indica publicação comprovada.'};
 }
 if(nome==='consultar_perfil_trabalho')return limpar(await consultarPerfilTrabalho(sql,a,identidade.agora));
 if(nome==='consultar_perfil_jogo')return limpar(await consultarPerfilJogo(sql,a));
 if(nome==='consultar_ranking')return limpar(await consultarRanking(sql,a,identidade.agora));
 if(nome==='consultar_dia_equipe')return limpar(await consultarDiaEquipe(sql,a,identidade.agora));
 if(nome==='detalhar_demanda')return limpar(await secaoDaDemanda(sql,a));
 if(nome==='consultar_metricas_trafego')return limpar(await metricasDoHub(sql,a));
 if(nome==='cobertura_modulos')return {fonte:'vybe-neon',itens:[{disponiveis:['demandas','conteudos','clientes','responsaveis','planejamentos','aprovacao_do_planejamento','captacoes','referencias_de_roteiros','briefings','comentarios','historico','tarefas','referencias_de_arquivos','perfil_trabalho','perfil_jogo','ranking','dia_equipe','bi_vybehub'],limitacoes:['Campanhas e tráfego vêm do VybeHub; a ponte exige configuração própria e vínculo explícito do cliente.','Publicação: retorna status registrado, sem inferir entrega ou veiculação efetiva.','Roteiros: apenas referência; não lê texto do Drive.','Sem credenciais, sessões ou segredos técnicos. Arquivos externos são referências; não lemos seu conteúdo binário. O BI depende das fontes configuradas no Hub.']}],limitado:false};
 if(['buscar_demandas','detalhar_demanda'].includes(nome)){
  modulo='demandas';const id=a.id||null,diaDaPessoa=identidade.diaDaPessoa||null,situacao=a.situacao||'todas',hoje=diaAssistente(identidade.agora);
  const quadro=a.quadro==='producao'?BOARD_PRODUCAO:a.quadro==='solicitacoes'?BOARD_DEMANDAS:null,cde=a.cliente_de||null,cate=a.cliente_ate||null;
  // Finalizadas hoje: o último evento de status caiu hoje (fuso Bahia); o status final é conferido abaixo.
  const finalHoje=situacao==='finalizadas_hoje'?(await sql`SELECT conteudo_id::text AS id FROM vybe_conteudo_eventos WHERE tipo='status'
   GROUP BY conteudo_id HAVING vybe_dia_bahia(max(em))=${hoje}::date`).map(x=>x.id):null;
  itens=await sql`SELECT c.id::text AS id,c.titulo,c.formato,c.prazo::text,c.veiculacao::text,c.atualizado_em::text,s.rotulo AS status,
   CASE WHEN c.board_id=${BOARD_DEMANDAS} THEN 'solicitacoes' ELSE 'producao' END AS quadro,
   COALESCE((SELECT json_agg(json_build_object('id',cl.id::text,'nome',cl.nome)) FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id WHERE cc.conteudo_id=c.id),'[]') AS clientes,
   COALESCE((SELECT json_agg(json_build_object('id',p.id::text,'nome',p.nome)) FROM vybe_conteudo_responsaveis cr JOIN vybe_pessoas p ON p.id=cr.pessoa_id WHERE cr.conteudo_id=c.id),'[]') AS responsaveis
   FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
   WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_DEMANDAS},${BOARD_PRODUCAO})
   AND (${diaDaPessoa}::date IS NULL OR COALESCE(c.prazo,c.veiculacao)=${diaDaPessoa}::date)
   AND (${situacao}='todas' OR (${situacao}='finalizadas_hoje' AND s.final IS TRUE AND c.id::text=ANY(${finalHoje}::text[]))
    OR (${situacao} IN ('pendentes','atrasadas') AND s.final IS FALSE AND (${situacao}='pendentes' OR c.prazo<${hoje}::date)))
   AND (${id}::bigint IS NULL OR c.id=${id}) AND (${q}='' OR c.titulo ILIKE '%'||${q}||'%')
   AND (${cid}::bigint IS NULL OR EXISTS(SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id=c.id AND cc.cliente_id=${cid}))
   AND (${rid}::bigint IS NULL OR EXISTS(SELECT 1 FROM vybe_conteudo_responsaveis cr WHERE cr.conteudo_id=c.id AND cr.pessoa_id=${rid}))
   AND (${status}='' OR s.rotulo ILIKE ${status}) AND (${de}::date IS NULL OR c.prazo>=${de}::date) AND (${ate}::date IS NULL OR c.prazo<=${ate}::date)
   AND (${quadro}::bigint IS NULL OR c.board_id=${quadro}) AND (${cde}::date IS NULL OR c.veiculacao>=${cde}::date) AND (${cate}::date IS NULL OR c.veiculacao<=${cate}::date)
   ORDER BY c.prazo ASC NULLS LAST,c.id LIMIT ${limit} OFFSET ${offset}`;
 }else if(nome==='listar_clientes'){
  modulo='clientes';itens=await sql`SELECT id::text,nome,responsavel AS carteira FROM vybe_clientes WHERE COALESCE(ativo,true) AND (${q}='' OR nome ILIKE '%'||${q}||'%') ORDER BY nome,id LIMIT ${limit} OFFSET ${offset}`;
 }else if(nome==='listar_responsaveis'){
  modulo='pessoas';itens=await sql`SELECT id::text,nome,papel,disciplina FROM vybe_pessoas WHERE ativo AND pode_entrar AND (${q}='' OR nome ILIKE '%'||${q}||'%') ORDER BY nome,id LIMIT ${limit} OFFSET ${offset}`;
 }else if(['listar_planejamentos','detalhar_planejamento'].includes(nome)){
  modulo='planejamentos';const id=a.id||null,limiteConsulta=id?1:limit,offsetConsulta=id?0:offset;
  itens=await sql`SELECT p.id::text,p.cliente_id::text,cl.nome AS cliente,p.mes::text,p.titulo,p.estado,p.atualizado_em::text,
    CASE WHEN ${id}::bigint IS NOT NULL THEN p.conteudo ELSE NULL END AS conteudo
    FROM vybe_planejamentos p JOIN vybe_clientes cl ON cl.id=p.cliente_id WHERE p.estado<>'arquivado'
    AND (${id}::bigint IS NULL OR p.id=${id}) AND (${cid}::bigint IS NULL OR p.cliente_id=${cid})
    AND (${de}::date IS NULL OR p.mes>=${de}::date) AND (${ate}::date IS NULL OR p.mes<=${ate}::date)
    ORDER BY p.mes DESC,p.id DESC LIMIT ${limiteConsulta} OFFSET ${offsetConsulta}`;
  itens=itens.map(({conteudo,...p})=>{if(!conteudo)return p;const n=normalizarConteudo(conteudo);return {...p,resumo:textoOperacional(n.resumo,1000),numeros:n.numeros,linhas:n.linhas,datas:n.datas,observacoes:n.observacoes,pecas:pecasComRevisao(n).slice(offset,offset+limit),pecas_limitadas:n.pecas.length>offset+limit,pecas_total:n.pecas.length};});
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

// Mesmo teto do conector: paginação explícita em vez de estourar o contexto do modelo.
export async function executarFerramenta(sql,nome,args,identidade={}){
 const r=limpar(await executarFerramentaBase(sql,nome,args,identidade));
 let cortou=false;
 while(Buffer.byteLength(JSON.stringify(r))>14000&&r.itens?.length>1){r.itens.pop();cortou=true;}
 const p=r.itens?.[0];
 while(Buffer.byteLength(JSON.stringify(r))>14000&&p?.pecas?.length>1){p.pecas.pop();cortou=true;}
 if(Buffer.byteLength(JSON.stringify(r))>14000)throw Object.assign(new Error('Reduza o recorte da consulta.'),{status:413});
 if(p?.pecas_limitadas)r.limitado=true;
 if(cortou){r.limitado=true;if(p?.pecas)p.pecas_limitadas=true;r.observacao=(r.observacao||'')+' Recorte reduzido pelo limite de contexto.';}
 if(r.limitado)r.proximo_deslocamento=(args?.deslocamento||0)+(p?.pecas?.length||r.itens.length);
 if(cortou&&r.fontes&&nome!=='detalhar_demanda'&&nome!=='consultar_metricas_trafego')r.fontes=r.fontes.filter(f=>r.itens.some(x=>String(x.id)===String(f.id)));
 return r;
}
