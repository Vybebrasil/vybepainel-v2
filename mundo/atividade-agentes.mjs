// Contrato de leitura e apresentação dos agentes. Sem ações, crachás ou acesso ao banco.
import { PLANTA } from './planta.mjs';
const SETORES = new Map(PLANTA.flatMap(a => a.setores.filter(s => s.agente).map(s => [s.id, { setor:s.id, andar:a.id, nome:s.nome, agente:s.agente }])));
export const ESTADOS_REAIS = {
 disponivel:{rotulo:'Disponível',cor:'#18A957'}, executando:{rotulo:'Executando',cor:'#0D74CE'},
 aguardando_aprovacao:{rotulo:'Aguardando aprovação',cor:'#8E4EC6'}, falhou:{rotulo:'Falhou',cor:'#D13D36'},
 sem_execucao:{rotulo:'Sem execução registrada',cor:'#7A8B82'}, indisponivel:{rotulo:'Sem leitura da central',cor:'#7A8B82'},
};
const ESTADOS_EVENTO = new Set(['executando','aguardando_aprovacao','concluida','falhou']);
const data = v => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const texto = (v,n) => typeof v === 'string' && v.length <= n;
export function validarAgentes(d) {
 if(d?.ok!==true || !data(d.geradoEm) || !Array.isArray(d.agentes) || d.agentes.length>SETORES.size) throw new Error('Resposta inválida da central.');
 const vistos = new Set();
 const agentes=d.agentes.map(a=>{
  if(!a || !SETORES.has(a.setor) || vistos.has(a.setor) || !['disponivel','executando','aguardando_aprovacao','falhou'].includes(a.estado)
   || !(a.tarefa==null || texto(a.tarefa,200)) || !(a.desde==null || data(a.desde)) || !texto(a.situacao||'',200)
   || !Number.isInteger(a.emCurso) || a.emCurso<0 || a.emCurso>1000 || !Array.isArray(a.ultimos) || a.ultimos.length>20) throw new Error('Resposta inválida da central.');
  vistos.add(a.setor);
  const ultimos=a.ultimos.map(e=>{
   if(!e || !ESTADOS_EVENTO.has(e.estado) || !data(e.em) || !texto(e.tarefa,200) || !texto(e.ferramenta,80)
    || !texto(e.ref||'',100) || !texto(e.resultado||'',300) || !texto(e.erro||'',300)) throw new Error('Resposta inválida da central.');
   return {estado:e.estado,em:e.em,tarefa:e.tarefa,ferramenta:e.ferramenta,ref:e.ref||'',resultado:e.resultado||'',erro:e.erro||''};
  });
  return {...SETORES.get(a.setor),estado:a.estado,tarefa:a.tarefa||null,desde:a.desde||null,situacao:a.situacao||'',emCurso:a.emCurso,ultimos};
 });
 return {ok:true,geradoEm:d.geradoEm,agentes};
}
export function apresentarAgente(a) {
 if(!a) return {...ESTADOS_REAIS.indisponivel,estado:'indisponivel',tarefa:null,desde:null,ultimos:[]};
 let estado=a.estado;
 if(estado==='disponivel') {
  if(a.ultimos[0]?.estado==='falhou') estado='falhou';
  else if(!a.ultimos.length && a.situacao==='sem execução registrada') estado='sem_execucao';
 }
 return {...a,estado,...ESTADOS_REAIS[estado]};
}
export function referenciaDaPeca(ref) { return typeof ref==='string' && /^vybe:[1-9]\d{0,19}$/.test(ref) ? ref : null; }
export function criarFonteAgentes({buscar,agora=Date.now,intervalo=15000}) {
 let estado={dados:null,atualizadoEm:null,erro:false},tentadoEm=-Infinity,pendente=null,geracao=0;
 return {
  ler:()=>estado,
  limpar(){geracao++;estado={dados:null,atualizadoEm:null,erro:false};tentadoEm=-Infinity;},
  atualizar(forcar=false){
   if(pendente)return pendente;
   if(!forcar && agora()-tentadoEm<intervalo)return Promise.resolve(estado);
   tentadoEm=agora(); const requisicao=geracao;
   pendente=Promise.resolve().then(buscar).then(d=>{if(requisicao===geracao)estado={dados:validarAgentes(d),atualizadoEm:agora(),erro:false};})
    .catch(()=>{if(requisicao===geracao)estado={...estado,erro:true};}).then(()=>estado).finally(()=>{pendente=null;});
   return pendente;
  }
 };
}
