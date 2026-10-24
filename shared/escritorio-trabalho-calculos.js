function escritorioTrabalhoConta(dados, { dias = 28, regra, formato = '', de = null, ate = null } = {}) {
  const somar = (iso,n) => new Date(Date.parse(iso+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
  const util = d => ![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay());
  const fim = ate || dados.hoje, inicio = de || somar(fim,1-dias);
  dias=Math.round((Date.parse(fim)-Date.parse(inicio))/864e5)+1;
  const anterior = somar(inicio,-dias);
  const linhas = (dados.linhas || []).filter(l => l.regra === regra && (!formato || l.formato === formato));
  const porDia = new Map();
  for (const l of linhas) porDia.set(l.dia,(porDia.get(l.dia)||0)+Number(l.n));
  const serie = Array.from({length:dias},(_,i) => { const dia=somar(inicio,i); return {dia,n:porDia.get(dia)||0,util:util(dia)}; });
  const passada = Array.from({length:dias},(_,i) => { const dia=somar(anterior,i); return {dia,n:porDia.get(dia)||0,util:util(dia)}; });
  const recorde=(dados.recordes||[]).find(r=>r.regra===regra&&(formato ? r.formato===formato : r.formato===null));
  const primeiro=recorde?.primeiro||null;
  const resumo = s => { s=s.filter(d=>!primeiro||d.dia>=primeiro); const total=s.reduce((n,d)=>n+d.n,0), uteis=s.filter(d=>d.util), ativos=s.filter(d=>d.n>0).length;
    return {total,ativos,diasUteis:uteis.length,diasCobertos:s.length,media:uteis.length ? uteis.reduce((n,d)=>n+d.n,0)/uteis.length : 0,mediaAtiva:ativos?total/ativos:0}; };
  const atual=resumo(serie), antes=resumo(passada), variacao=antes.media && (!primeiro || primeiro<=anterior) ? (atual.media/antes.media-1)*100 : null;
  const formatos = [...new Set((dados.linhas||[]).filter(l=>l.regra===regra).map(l=>l.formato))].sort();
  const distribuicao = formatos.map(f=>({formato:f,n:linhas.filter(l=>l.formato===f&&l.dia>=inicio&&l.dia<=fim).reduce((n,l)=>n+l.n,0)})).filter(l=>l.n).sort((a,b)=>b.n-a.n);
  const movel=serie.map(l=>{const amostra=Array.from({length:7},(_,i)=>somar(l.dia,i-6)).filter(d=>!primeiro||d>=primeiro);return amostra.length?amostra.reduce((n,d)=>n+(porDia.get(d)||0),0)/amostra.length:0;});
  return {inicio,fim,anterior,serie,passada,atual,antes,variacao,formatos,distribuicao,recorde,primeiro,movel,dias};
}

if(typeof module!=='undefined'&&module.exports)module.exports={escritorioTrabalhoConta};
