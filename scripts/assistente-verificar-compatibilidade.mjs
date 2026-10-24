// Verificação offline do contrato: não consulta APIs, banco ou variáveis de ambiente.
import {FERRAMENTAS_ASSISTENTE} from '../server/assistente-ferramentas.js';
import {pathToFileURL} from 'node:url';
export function verificarCompatibilidade(ferramentas){
 const faltantes=[];
 const parametros=nome=>ferramentas.find(x=>x.function?.name===nome)?.function?.parameters?.properties;
 for(const nome of ['consultar_perfil_trabalho','consultar_perfil_jogo','consultar_ranking','consultar_dia_equipe'])
  if(!parametros(nome))faltantes.push(nome);
 for(const nome of ['minhas_demandas','buscar_demandas'])
  if(!['todas','pendentes','atrasadas'].every(x=>parametros(nome)?.situacao?.enum?.includes(x)))faltantes.push(nome+'.situacao');
 if(!['ficha','comentarios','historico','tarefas','arquivos'].every(x=>parametros('detalhar_demanda')?.secao?.enum?.includes(x)))faltantes.push('detalhar_demanda.secao');
 const modulos=['trafego','alcance','interacoes','seguidores','faturamento','objetivos','aprovacoes','documentos','marca','campanhas','anuncios','publico','segmentacao'];
 if(!modulos.every(x=>parametros('consultar_metricas_trafego')?.modulo?.enum?.includes(x)))faltantes.push('consultar_metricas_trafego.modulo');
 return {compativel:faltantes.length===0,ferramentas: ferramentas.length,faltantes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const resultado=verificarCompatibilidade(FERRAMENTAS_ASSISTENTE);
 console.log(JSON.stringify(resultado));
 process.exitCode=resultado.compativel?0:2;
}
