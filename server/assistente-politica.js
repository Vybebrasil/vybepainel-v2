// Contexto declarado pelo conector autenticado: nunca por texto ou pelo modelo.
import {validarJid,identificadorProtegido} from './assistente-identidade.js';
import {exigirAdministradorPrivado,exigirContaAdministrativa} from './assistente-exclusivo.js';
import {assistenteAtivo,escopoEquipe} from './assistente-ativacao.js';
// motivo: código curto de qual regra recusou (09/11/2026: rajadas de 403 no bot sem saber por quê). Vai ao bot já
// autenticado; não traz identidade nem dado de pessoa.
const negar=(motivo='negado',extra={})=>Object.assign(new Error('Conversa ou participantes não autorizados.'),{status:403,motivo,...extra});
const semVinculo=()=>Object.assign(negar('sem_vinculo'),{codigo:'WHATSAPP_NAO_VINCULADO'});
export function validarConversa(jid,c,config=process.env,agora=Date.now()) {
 const grupos=new Set(String(config.VYBE_AI_GRUPOS_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^[0-9-]+@g\.us$/.test(x)));
 if(!grupos.size||grupos.size>12)throw negar('grupos_config');
 if(!validarJid(jid)||!c||!['privado','grupo'].includes(c.tipo)||!Number.isSafeInteger(c.observado_em))throw negar('contexto_invalido');
 if(Math.abs(agora-c.observado_em)>30000)throw negar('contexto_velho',{atraso_s:Math.round((agora-c.observado_em)/1000)});
 if(!Array.isArray(c.grupos_remetente)||!c.grupos_remetente.length||c.grupos_remetente.length>12||new Set(c.grupos_remetente).size!==c.grupos_remetente.length)throw negar('grupos_invalidos');
 if(c.grupos_remetente.some(x=>!grupos.has(x)))throw negar('grupo_fora_da_lista');
 if(!Array.isArray(c.participantes)||!c.participantes.length||c.participantes.length>100||c.participantes.some(x=>!validarJid(x))||new Set(c.participantes).size!==c.participantes.length||!c.participantes.includes(jid))throw negar('participantes');
 if(c.tipo==='privado'&&(c.participantes.length!==1||c.grupo_id))throw negar('privado_invalido');
 if(c.tipo==='grupo'&&(!grupos.has(c.grupo_id)||!c.grupos_remetente.includes(c.grupo_id)))throw negar('grupo_invalido');
 return c;
}
export async function autorizarConversa(sql,jid,c,segredo,config) {
 // Equipe: quem pergunta precisa estar ativo e vinculado; os grupos aprovados são internos, então os demais
 // participantes não precisam de vínculo. Sem o escopo, só o administrador.
 const equipe=escopoEquipe(config);
 if(!equipe)exigirAdministradorPrivado(jid,c,config);
 if(!assistenteAtivo(config))throw negar('assistente_desligado');
 validarConversa(jid,c,config);
 const hashes=(equipe?[jid]:c.participantes).map(x=>identificadorProtegido(x,segredo));
 const [schema]=await sql`SELECT to_regclass('public.vybe_ai_vinculos') IS NOT NULL AS pronta`;
 if(!schema?.pronta)throw semVinculo();
 const linhas=await sql`SELECT v.jid_hash AS hash,p.id FROM vybe_ai_vinculos v JOIN vybe_pessoas p ON p.id=v.pessoa_id
  WHERE v.jid_hash=ANY(${hashes}::text[]) AND v.revogado_em IS NULL AND p.ativo IS TRUE AND p.pode_entrar IS TRUE AND p.senha_hash IS NOT NULL AND (${equipe}::boolean OR p.admin IS TRUE)`;
 if(linhas.length!==hashes.length)throw semVinculo();
 if(linhas.some(x=>!Number.isSafeInteger(Number(x.id))||Number(x.id)<=0))throw negar('vinculo_invalido');
 const pessoaId=Number(linhas.find(x=>x.hash===identificadorProtegido(jid,segredo))?.id);
 if(!Number.isSafeInteger(pessoaId)||pessoaId<=0)throw negar('vinculo_invalido');
 if(!equipe)exigirContaAdministrativa(pessoaId,config);
 return pessoaId;
}
