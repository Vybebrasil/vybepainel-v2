'use strict';
const invalida=()=>new Error('Resposta pessoal inválida.');
function limparCampo(valor,max) {
  if(typeof valor!=='string')throw invalida();
  return valor
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'')
    .replace(/[\x00-\x1f\x7f-\x9f]/g,' ')
    .replace(/(?:https?:\/\/|postgres(?:ql)?:\/\/)[^\s]+/gi,'[link omitido]')
    .replace(/\b\d+@(?:lid|c\.us|g\.us)\b/gi,'[identidade omitida]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[contato omitido]')
    .replace(/\b(?:token|senha|password|secret|codigo|código|api[_ -]?key)\s*[:=]\s*\S+/gi,'[credencial omitida]')
    .replace(/\b[a-f0-9]{20}\b/gi,'[código omitido]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g,'[identificador omitido]')
    .replace(/\+?\d[\d(). -]{4,}\d/g,'[número omitido]')
    .replace(/\s+/g,' ').trim().slice(0,max);
}
function prazoLegivel(valor) {
  if(valor===null||valor===undefined)return 'Sem prazo definido';
  if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor))throw invalida();
  const data=new Date(valor+'T12:00:00Z');
  if(!Number.isFinite(data.getTime())||data.toISOString().slice(0,10)!==valor)throw invalida();
  return valor.slice(8,10)+'/'+valor.slice(5,7)+'/'+valor.slice(0,4);
}
function formatarPreviaDemandas(data,periodo,situacao='todas') {
  if(data?.ok!==true||!Array.isArray(data.itens)||data.itens.length>25||!['hoje','todas'].includes(periodo))throw invalida();
  if(!['todas','pendentes','atrasadas'].includes(situacao))throw invalida();
  if(!data.itens.length&&situacao!=='todas')return 'Nenhuma demanda '+situacao+' encontrada neste recorte.';
  if(!data.itens.length)return periodo==='hoje'?'Você não tem demandas previstas para hoje.':'Você não tem demandas atribuídas no momento.';
  const linhas=data.itens.map((item,i)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw invalida();
    const titulo=limparCampo(item.titulo,180);
    if(!titulo)throw invalida();
    const situacao=item.status===null||item.status===undefined?'Não informada':limparCampo(item.status,60)||'Não informada';
    return (i+1)+'. '+titulo+'\n   Prazo: '+prazoLegivel(item.prazo)+'\n   Situação: '+situacao;
  });
  return ('Suas demandas'+(situacao==='todas'?'':' '+situacao)+(periodo==='hoje'?' previstas para hoje':'')+':')+'\n\n'+linhas.join('\n\n')+
    (data.limitado===true?'\n\nEsta lista pode estar incompleta.':'');
}
function exibirPreviaWhatsapp(texto) {
  console.log('=== PREVIA_WHATSAPP_SIMULACAO ===\n'+texto+'\n=== FIM_PREVIA_WHATSAPP_SIMULACAO ===');
}
module.exports={formatarPreviaDemandas,exibirPreviaWhatsapp,limparCampo,prazoLegivel};
