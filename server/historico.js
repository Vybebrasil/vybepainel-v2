export function agruparHistorico(eventos, grupos = {}) {
  const logs = {moveEvents:{}, prazoEvents:{}, statusEvents:{}, veiculacaoEvents:{}, ownerEvents:{}};
  for (const e of eventos) {
    const id=String(e.item_id), tsMs=new Date(e.em).getTime();
    if (!Number.isFinite(tsMs)) continue;
    const base={date:new Date(tsMs).toISOString().slice(0,10),tsMs,actorId:e.autor_id};
    let campo, detalhe;
    if(e.tipo==='status'){campo='statusEvents';detalhe={status:e.para||'',previousStatus:e.de||''};}
    else if(e.tipo==='prazo'){campo='prazoEvents';detalhe={prazoDate:e.para,previousPrazoDate:e.de};}
    else if(e.tipo==='veiculacao'){campo='veiculacaoEvents';detalhe={veiculacaoDate:e.para,previousVeiculacaoDate:e.de};}
    else if(e.tipo==='grupo'){campo='moveEvents';detalhe={sourceGroupId:grupos[e.de]||e.de,destGroupId:grupos[e.para]||e.para};}
    else if(e.tipo==='responsaveis'){campo='ownerEvents';detalhe={owners:e.para,previousOwners:e.de};}
    else continue;
    (logs[campo][id] ||= []).push({...base,...detalhe});
  }
  for(const mapa of Object.values(logs)) for(const lista of Object.values(mapa)) lista.sort((a,b)=>a.tsMs-b.tsMs);
  return logs;
}
