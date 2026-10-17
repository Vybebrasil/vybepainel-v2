import { readFileSync } from 'node:fs';
import { salasDoEscritorio, salvarCamadaEscritorio, versoesProntas } from './escritorio-mapa.js';
import { economiaPronta, carregarEconomia } from './escritorio-economia.js';
export const QUARTOS = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json',import.meta.url),'utf8'));
export function plantaQuarto(id) { return QUARTOS.plantas.find(p=>p.id===id); }
// Os modelos iniciais são desenhados para 8 × 8, no canto de baixo à direita;
// em cada planta vão para o mesmo canto dela ("deslocamento").
export function itensDoModelo(planta,modelo) {
 const p=plantaQuarto(planta),[dx,dy]=p?.deslocamento || [0,0];
 return (modelo?.itens || []).map(([c,x,y,...r])=>[c,x+dx,y+dy,...r]);
}
export function validarPisoQuarto(planta,itens,dimensoes=new Map()) {
 const p=plantaQuarto(planta);
 if (!p) throw Object.assign(new Error('Escolha uma planta válida.'),{status:400});
 for (const it of itens) {
  const d=dimensoes.get(it[0]) || {x:1,y:1};
  const w=it[3]===2||it[3]===6 ? d.y : d.x,h=it[3]===2||it[3]===6 ? d.x : d.y;
  const nivel=p.celdas[Math.floor(it[2])]?.[Math.floor(it[1])];
  for(let x=Math.floor(it[1]);x<Math.ceil(it[1]+w);x++) for(let y=Math.floor(it[2]);y<Math.ceil(it[2]+h);y++) {
   const n=p.celdas[y]?.[x] ?? -1;
   if(n<0 || n!==nivel) throw Object.assign(new Error('Há móveis fora da planta escolhida ou atravessando patamares.'),{status:400});
   if((p.escada || []).some(([ex,ey])=>ex===x && ey===y)) throw Object.assign(new Error('Deixe a escada livre para circular.'),{status:400});
  }
 }
}
export async function configurarQuarto(sql,pessoa,perfil,{planta,modelo,preservar=true}={}) {
 const m=QUARTOS.modelos.find(x=>x.id===modelo);
 if (!plantaQuarto(planta)||!m) throw Object.assign(new Error('Planta ou modelo inválido.'),{status:400});
 if (!await economiaPronta(sql)) throw Object.assign(new Error('Seu quarto aguarda a migração revisada do banco.'),{status:503});
 return sql.comTransacao(async tx=>{
  const equipe=await tx`SELECT id,nome FROM vybe_pessoas WHERE ativo=TRUE AND pode_entrar=TRUE`;
  const sala=salasDoEscritorio(equipe).find(s=>s.pessoa_id===String(pessoa.id));
  if (!sala) throw Object.assign(new Error('Sua identidade ainda não tem um quarto atribuído. Peça à gestão.'),{status:409});
  await tx`INSERT INTO vybe_escritorio_perfis(pessoa_id) VALUES(${pessoa.id}) ON CONFLICT DO NOTHING`;
  const [atual]=await tx`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoa.id} FOR UPDATE`;
  // Repetir a confirmação não apaga a decoração nem concede outra conquista.
  if (atual.preferencias.quarto_configurado) {
    const [mapa]=await tx`SELECT itens,versao,atualizado_em AS em FROM vybe_escritorio_mapa WHERE camada=${sala.id}`;
    return {perfil:atual.preferencias,camada:sala.id,mapa,economia:await carregarEconomia(tx,pessoa.id)};
  }
  const salvo={...perfil,sala_planta:planta,quarto_configurado:true};
  const inicial=itensDoModelo(planta,m);
  validarPisoQuarto(planta,inicial);
  await tx`UPDATE vybe_escritorio_perfis SET preferencias=${JSON.stringify(salvo)}::jsonb,atualizado_em=now() WHERE pessoa_id=${pessoa.id}`;
  // O quarto inicial substitui apenas o padrão não configurado. Uma camada já
  // editada é preservada: evita apagar trabalho de quem veio da primeira versão.
  const [existente]=await tx`SELECT itens,versao FROM vybe_escritorio_mapa WHERE camada=${sala.id} FOR UPDATE`;
  if (existente?.itens?.length) {
   if(preservar !== false) validarPisoQuarto(planta,existente.itens);
   // Móveis adquiridos antes da loja continuam pertencendo à pessoa.
   const quantidades=new Map();
   for(const [classe] of existente.itens) if(!QUARTOS.essenciais.includes(classe) && !classe.startsWith('vybeimg_')) quantidades.set(classe,(quantidades.get(classe)||0)+1);
   for(const [classe,n] of quantidades) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoa.id},${classe},${n}) ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=GREATEST(vybe_escritorio_inventario.quantidade,EXCLUDED.quantidade)`;
  }
  if(existente?.itens?.length && preservar === false && !await versoesProntas(tx)) throw Object.assign(new Error('Para começar de novo, ative primeiro o histórico de decoração.'),{status:503});
  await salvarCamadaEscritorio(tx,pessoa,salasDoEscritorio(equipe),{camada:sala.id,itens:existente?.itens?.length && preservar !== false ? existente.itens : inicial,versao:existente?.versao || 0});
  await tx`SELECT vybe_creditar_moedas(${pessoa.id},'conquista:meu-quarto',50)`;
  const [mapa]=await tx`SELECT itens,versao,atualizado_em AS em FROM vybe_escritorio_mapa WHERE camada=${sala.id}`;
  return {perfil:salvo,camada:sala.id,mapa,economia:await carregarEconomia(tx,pessoa.id)};
 });
}
