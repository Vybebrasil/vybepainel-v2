import { conferirFiguraDaPessoa } from './escritorio-roupas.js';
import { readFileSync } from 'node:fs';
import { salasDoEscritorio, salvarCamadaEscritorio, versoesProntas } from './escritorio-mapa.js';
import { economiaPronta, carregarEconomia, MOVEIS_ESSENCIAIS, MOVEIS_DE_CONSTRUCAO } from './escritorio-economia.js';
// Os essenciais do arquivo mais a construção livre (pisos, paredes e blocos);
// "construcao" separa essas peças dos móveis na Oficina.
export const QUARTOS = { ...JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json',import.meta.url),'utf8')), essenciais: MOVEIS_ESSENCIAIS, construcao: MOVEIS_DE_CONSTRUCAO };
// Lado máximo do quarto (desde 21/10/2026: 24 × 24, quatro vezes o Enorme de
// 12 × 12, decisão do Paulo; antes 20). As grades guardadas no perfil
// (pintura do piso, planta desenhada) têm esse lado; as antigas, de 8, 12 e
// 20, são ampliadas ao ler, sem perder nada.
export const LADO_QUARTO = 24;
export function ampliarGrade(s, de, vazio, casa = 1) {
 const linhas = Array.from({ length: LADO_QUARTO }, (_, y) => (y < de ? s.slice(y * de * casa, (y + 1) * de * casa) : "") .padEnd(LADO_QUARTO * casa, vazio));
 return linhas.join("");
}
// Trechos de parede (estilo, cor, altura: 3 caracteres) por lado: amplia cada
// um dos 4 lados de 8, 12 ou 20 trechos para LADO_QUARTO.
export function ampliarParedes(s) {
 const t = String(s || "").length / 3 / 4;
 if (![8, 12, 20].includes(t)) return String(s || "");
 return Array.from({ length: 4 }, (_, lado) => s.slice(lado * t * 3, (lado + 1) * t * 3) + "-00".repeat(LADO_QUARTO - t)).join("");
}
export function ampliarCeldas(s) {
 s = String(s || "");
 return /^[0vp1-9A-Z]{144}$/.test(s) ? ampliarGrade(s, 12, "0") : /^[0vp1-9A-Z]{400}$/.test(s) ? ampliarGrade(s, 20, "0") : s;
}
// Planta desenhada pelo dono (editor de planta livre): LADO_QUARTO² códigos
// sobre a planta escolhida. "0" mantém o ladrilho da planta, "v" tira o piso,
// "p" é piso no nível do chão, "1" e "2" são patamares. Porta e escada não mudam.
// Como a planta de alturas do Habbo: "1"–"9" e "A"–"Z" são as alturas 1 a 35.
export const CELDAS_LIVRES = new RegExp(`^[0vp1-9A-Z]{${LADO_QUARTO * LADO_QUARTO}}$`);
export function nivelDoCodigo(c) { return c === "v" ? -1 : c === "p" ? 0 : /^[1-9]$/.test(c) ? Number(c) : /^[A-Z]$/.test(c) ? 10 + c.charCodeAt(0) - 65 : null; }
export function plantaQuarto(id, livres = "") {
 const p=QUARTOS.plantas.find(p=>p.id===id);
 livres = ampliarCeldas(livres);
 if(!p || !CELDAS_LIVRES.test(String(livres || "")) || !/[^0]/.test(livres)) return p;
 const h=p.celdas.length,w=p.celdas[0].length,fixos=new Set((p.escada || []).map(([x,y])=>x+','+y));
 for(const d of [0,1]) {fixos.add((p.portas.baixo+d)+','+(h-1));fixos.add((w-1)+','+(p.portas.direita+d));}
 return {...p,celdas:p.celdas.map((linha,y)=>linha.map((n,x)=>{const c=livres[y*LADO_QUARTO+x];return c==='0' || fixos.has(x+','+y) ? n : nivelDoCodigo(c);}))};
}
// Cada planta guarda onde cada modelo inicial fica ("ancoras", calculadas por
// scripts/escritorio-quartos-modelos.mjs: mesa encostada no fundo, caminho
// livre da porta às cadeiras e à escada). Plantas antigas usam o
// "deslocamento" de antes. Modelo sem âncora não cabe naquela planta.
export function ancoraDoModelo(p,modeloId) {
 if(!p) return null;
 if(p.ancoras) return p.ancoras[modeloId] || null;
 return p.deslocamento || [0,0];
}
export function itensDoModelo(planta,modelo) {
 const a=ancoraDoModelo(plantaQuarto(planta),modelo?.id);
 if(!a) return null;
 const [dx,dy]=a;
 return (modelo?.itens || []).map(([c,x,y,...r])=>[c,x+dx,y+dy,...r]);
}
export function validarPisoQuarto(planta,itens,dimensoes=new Map(),livres='', { construcaoLivre = false } = {}) {
 const p=plantaQuarto(planta,livres);
 if (!p) throw Object.assign(new Error('Escolha uma planta válida.'),{status:400});
 for (const it of itens) {
  const d=dimensoes.get(it[0]) || {x:1,y:1};
  const w=it[3]===2||it[3]===6 ? d.y : d.x,h=it[3]===2||it[3]===6 ? d.x : d.y;
  // Construção livre: a peça vai onde o dono quiser, até fora do piso.
  if (construcaoLivre) continue;
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
  // Skins: o visual que vem junto da reforma passa pela mesma conferência do perfil.
  if (perfil?.figura && perfil.figura !== (atual.preferencias.figura || '')) await conferirFiguraDaPessoa(tx, pessoa.id, perfil.figura, atual.preferencias.figura || '');
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
  if(!inicial) throw Object.assign(new Error('Esse modelo não cabe nessa planta. Escolha outro modelo.'),{status:400});
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
