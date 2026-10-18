import { readFileSync } from 'node:fs';
import { salasDoEscritorio, salvarCamadaEscritorio, versoesProntas } from './escritorio-mapa.js';
import { economiaPronta, carregarEconomia } from './escritorio-economia.js';
export const QUARTOS = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json',import.meta.url),'utf8'));
// Planta desenhada pelo dono (editor de planta livre): 12 × 12 códigos sobre
// a planta escolhida. "0" mantém o ladrilho da planta, "v" tira o piso, "p"
// é piso no nível do chão, "1" e "2" são patamares. Porta e escada não mudam.
export const CELDAS_LIVRES = /^[0vp12]{144}$/;
export function plantaQuarto(id, livres = "") {
 const p=QUARTOS.plantas.find(p=>p.id===id);
 if(!p || !CELDAS_LIVRES.test(String(livres || "")) || !/[^0]/.test(livres)) return p;
 const h=p.celdas.length,w=p.celdas[0].length,fixos=new Set((p.escada || []).map(([x,y])=>x+','+y));
 for(const d of [0,1]) {fixos.add((p.portas.baixo+d)+','+(h-1));fixos.add((w-1)+','+(p.portas.direita+d));}
 const cod={v:-1,p:0,1:1,2:2};
 return {...p,celdas:p.celdas.map((linha,y)=>linha.map((n,x)=>{const c=livres[y*12+x];return c==='0' || fixos.has(x+','+y) ? n : cod[c];}))};
}
// Os modelos iniciais são desenhados para 8 × 8, no canto de baixo à direita;
// em cada planta vão para o mesmo canto dela ("deslocamento").
export function itensDoModelo(planta,modelo) {
 const p=plantaQuarto(planta),[dx,dy]=p?.deslocamento || [0,0];
 return (modelo?.itens || []).map(([c,x,y,...r])=>[c,x+dx,y+dy,...r]);
}
export function validarPisoQuarto(planta,itens,dimensoes=new Map(),livres='') {
 const p=plantaQuarto(planta,livres);
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
// O térreo mantém sua chave original; o segundo andar tem camada própria.
export function partesDaCamada(camada) {
 const m=/^(sala-(?:[0-9]|1[01]))(?:-andar-(1))?$/.exec(String(camada || ''));
 return m ? {raiz:m[1],andar:Number(m[2] || 0)} : null;
}
export function perfilDoAndar(perfil,andar=0) {
 return andar ? perfil?.sala_andares?.find(a=>a.andar===andar) : perfil;
}
export async function andaresProntos(sql) {
 const [r]=await sql`SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='vybe_escritorio_mapa_andares') AS existe`;
 return Boolean(r?.existe);
}
export async function configurarQuarto(sql,pessoa,perfil,{planta,modelo,preservar=true,reformar=false,versao,andar=0,limparPintura=false}={}) {
 const m=QUARTOS.modelos.find(x=>x.id===modelo);
 if (!plantaQuarto(planta)||!m || ![0,1].includes(andar)) throw Object.assign(new Error('Planta, modelo ou andar inválido.'),{status:400});
 if (!await economiaPronta(sql)) throw Object.assign(new Error('Seu quarto aguarda a migração revisada do banco.'),{status:503});
 if((andar || reformar===true) && !await andaresProntos(sql)) throw Object.assign(new Error('O segundo andar aguarda a atualização revisada do banco.'),{status:503});
 return sql.comTransacao(async tx=>{
  const equipe=await tx`SELECT id,nome FROM vybe_pessoas WHERE ativo=TRUE AND pode_entrar=TRUE`;
  const salas=salasDoEscritorio(equipe), sala=salas.find(s=>s.pessoa_id===String(pessoa.id));
  if (!sala) throw Object.assign(new Error('Sua identidade ainda não tem um quarto atribuído. Peça à gestão.'),{status:409});
  const camada=sala.id+(andar ? '-andar-1' : '');
  await tx`INSERT INTO vybe_escritorio_perfis(pessoa_id) VALUES(${pessoa.id}) ON CONFLICT DO NOTHING`;
  const [atual]=await tx`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoa.id} FOR UPDATE`;
  const anterior=perfilDoAndar(atual.preferencias,andar);
  if(andar && !atual.preferencias.quarto_configurado) throw Object.assign(new Error('Configure o térreo antes do segundo andar.'),{status:409});
  const [existente]=await tx`SELECT itens,versao FROM vybe_escritorio_mapa WHERE camada=${camada} FOR UPDATE`;
  // Confirmação inicial repetida não apaga nada. Reformas usam a versão lida.
  if (anterior?.quarto_configurado && reformar !== true) {
    const [mapa]=await tx`SELECT itens,versao,atualizado_em AS em FROM vybe_escritorio_mapa WHERE camada=${camada}`;
    return {perfil:atual.preferencias,camada,mapa,economia:await carregarEconomia(tx,pessoa.id)};
  }
  if(reformar===true && (!Number.isInteger(versao)||versao!==(existente?.versao || 0)))
    throw Object.assign(new Error('A decoração mudou enquanto você reformava. Reabra Meu espaço para revisar a versão atual.'),{status:409});
  if(reformar===true && !await versoesProntas(tx)) throw Object.assign(new Error('A reforma aguarda o histórico de decoração.'),{status:503});
  const decoracao={...anterior,...perfil,sala_planta:planta,quarto_configurado:true};
  delete decoracao.sala_andares;
  if(limparPintura===true || andar && !anterior?.quarto_configurado) {decoracao.sala_pisos='';decoracao.sala_paredes='';}
  // A planta desenhada só vale sobre a mesma planta base; trocar de planta recomeça.
  decoracao.sala_celdas=limparPintura!==true && planta===anterior?.sala_planta ? anterior?.sala_celdas || '' : '';
  const salvo=andar ? {...atual.preferencias,sala_andares:[{...Object.fromEntries(Object.entries(decoracao).filter(([k])=>k.startsWith('sala_') || k==='quarto_configurado')),andar}]} : {...atual.preferencias,...decoracao,sala_andares:atual.preferencias.sala_andares || []};
  const inicial=itensDoModelo(planta,m);
  validarPisoQuarto(planta,inicial,undefined,decoracao.sala_celdas);
  await tx`UPDATE vybe_escritorio_perfis SET preferencias=${JSON.stringify(salvo)}::jsonb,atualizado_em=now() WHERE pessoa_id=${pessoa.id}`;
  if (existente?.itens?.length) {
   if(preservar !== false) validarPisoQuarto(planta,existente.itens,undefined,decoracao.sala_celdas);
   // Compatibilidade com decorações anteriores à loja só na configuração inicial.
   // Reformar não concede unidades: elas já estão no inventário compartilhado.
   if(!anterior?.quarto_configurado) {
    const quantidades=new Map();
    for(const [classe] of existente.itens) if(!QUARTOS.essenciais.includes(classe) && !classe.startsWith('vybeimg_')) quantidades.set(classe,(quantidades.get(classe)||0)+1);
    for(const [classe,n] of quantidades) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoa.id},${classe},${n}) ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=GREATEST(vybe_escritorio_inventario.quantidade,EXCLUDED.quantidade)`;
   }
  }
  if(existente?.itens?.length && preservar === false && !await versoesProntas(tx)) throw Object.assign(new Error('Para começar de novo, ative primeiro o histórico de decoração.'),{status:503});
  await salvarCamadaEscritorio(tx,pessoa,salas,{camada,itens:existente?.itens?.length && preservar !== false ? existente.itens : inicial,versao:existente?.versao || 0});
  if(reformar===true && existente) await tx`UPDATE vybe_escritorio_mapa_versoes SET quarto=${JSON.stringify(anterior || {})}::jsonb WHERE camada=${camada} AND versao=${existente.versao}`;
  // A mesma origem impede prêmio por reforma ou por criar outro andar.
  await tx`SELECT vybe_creditar_moedas(${pessoa.id},'conquista:meu-quarto',50)`;
  const [mapa]=await tx`SELECT itens,versao,atualizado_em AS em FROM vybe_escritorio_mapa WHERE camada=${camada}`;
  return {perfil:salvo,camada,mapa,economia:await carregarEconomia(tx,pessoa.id)};
 });
}
