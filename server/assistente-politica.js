// Contexto declarado pelo conector autenticado: nunca por texto ou pelo modelo.
import {validarJid,identificadorProtegido} from './assistente-identidade.js';
import {exigirAdministradorPrivado,exigirContaAdministrativa} from './assistente-exclusivo.js';
import {assistenteAtivo} from './assistente-ativacao.js';
const negar=()=>Object.assign(new Error('Conversa ou participantes não autorizados.'),{status:403});
const semVinculo=c=>Object.assign(negar(),c.tipo==='privado'?{codigo:'WHATSAPP_NAO_VINCULADO'}:{});
export function validarConversa(jid,c,config=process.env,agora=Date.now()) {
 const grupos=new Set(String(config.VYBE_AI_GRUPOS_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^[0-9-]+@g\.us$/.test(x)));
 if(!grupos.size||grupos.size>8)throw negar();
 if(!validarJid(jid)||!c||!['privado','grupo'].includes(c.tipo)||!Number.isSafeInteger(c.observado_em)||Math.abs(agora-c.observado_em)>30000)throw negar();
 if(!Array.isArray(c.grupos_remetente)||!c.grupos_remetente.length||c.grupos_remetente.length>8||new Set(c.grupos_remetente).size!==c.grupos_remetente.length||c.grupos_remetente.some(x=>!grupos.has(x)))throw negar();
 if(!Array.isArray(c.participantes)||!c.participantes.length||c.participantes.length>100||c.participantes.some(x=>!validarJid(x))||new Set(c.participantes).size!==c.participantes.length||!c.participantes.includes(jid))throw negar();
 if(c.tipo==='privado'&&(c.participantes.length!==1||c.grupo_id))throw negar();
 if(c.tipo==='grupo'&&(!grupos.has(c.grupo_id)||!c.grupos_remetente.includes(c.grupo_id)))throw negar();
 return c;
}
export async function autorizarConversa(sql,jid,c,segredo,config) {
 exigirAdministradorPrivado(jid,c,config);
 if(!assistenteAtivo(config))throw negar();
 validarConversa(jid,c,config);
 const hashes=c.participantes.map(x=>identificadorProtegido(x,segredo));
 const [schema]=await sql`SELECT to_regclass('public.vybe_ai_vinculos') IS NOT NULL AS pronta`;
 if(!schema?.pronta)throw semVinculo(c);
 const linhas=await sql`SELECT v.jid_hash AS hash,p.id FROM vybe_ai_vinculos v JOIN vybe_pessoas p ON p.id=v.pessoa_id
  WHERE v.jid_hash=ANY(${hashes}::text[]) AND v.revogado_em IS NULL AND p.ativo IS TRUE AND p.pode_entrar IS TRUE AND p.senha_hash IS NOT NULL AND p.admin IS TRUE`;
 if(linhas.length!==hashes.length)throw semVinculo(c);
 if(linhas.some(x=>!Number.isSafeInteger(Number(x.id))||Number(x.id)<=0))throw negar();
 const pessoaId=Number(linhas.find(x=>x.hash===identificadorProtegido(jid,segredo))?.id);
 exigirContaAdministrativa(pessoaId,config);
 return pessoaId;
}
