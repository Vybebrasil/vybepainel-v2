import {timingSafeEqual} from 'node:crypto';
import {identificadorProtegido,validarJid} from './assistente-identidade.js';
const negar=()=>Object.assign(new Error('Não autorizado.'),{status:403});
export function exigirAdministradorPrivado(jid,c,config=process.env){
 const hash=config.VYBE_AI_ADMIN_JID_HASH,pessoa=config.VYBE_AI_ADMIN_PESSOA_ID;
 if(typeof hash!=='string'||! /^[a-f0-9]{64}$/.test(hash)||typeof pessoa!=='string'||! /^[1-9][0-9]*$/.test(pessoa)||!Number.isSafeInteger(Number(pessoa))||!validarJid(jid)||c?.tipo!=='privado'||c.grupo_id!==undefined||!Array.isArray(c.participantes)||c.participantes.length!==1||c.participantes[0]!==jid||typeof config.VYBE_AI_LINK_SECRET!=='string'||config.VYBE_AI_LINK_SECRET.length<32)throw negar();
 const recebido=identificadorProtegido(jid,config.VYBE_AI_LINK_SECRET);
 if(!timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(recebido,'hex')))throw negar();
 return Number(pessoa);
}
export function exigirContaAdministrativa(pessoaId,config=process.env){
 if(pessoaId!==Number(config.VYBE_AI_ADMIN_PESSOA_ID))throw negar();
}
