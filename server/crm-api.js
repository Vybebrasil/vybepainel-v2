import { podeEditarCrm, listarCrm, detalheCrm, escreverCrm, semValoresCrm } from './crm.js';
import { ehDonoPessoa } from './donos.js';
export async function areaCrm(req,res,quem,criarBanco) {
 if (!quem) return res.status(401).json({error:'Entre no painel para acessar o CRM.'});
 if (quem.tipo!=='sessao' || !quem.pessoa?.id) return res.status(403).json({error:'O CRM exige uma sessão pessoal.'});
 if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Método não permitido.'});
 try {
  const sql=criarBanco(), pode_editar=await podeEditarCrm(sql,quem.pessoa);
  if(req.method==='POST') {
   if(!pode_editar) return res.status(403).json({error:'Só administradores e a equipe comercial podem editar o CRM.'});
   return res.status(200).json({ok:true,...await escreverCrm(sql,quem.pessoa,req.body || {})});
  }
  const lidos=req.query?.id ? await detalheCrm(sql,req.query) : await listarCrm(sql,req.query || {});
  const ver_dinheiro=ehDonoPessoa(quem.pessoa), dados=ver_dinheiro ? lidos : semValoresCrm(lidos);
  return res.status(200).json({ok:true,pessoa_id:String(quem.pessoa.id),pode_editar,ver_dinheiro,...dados});
 } catch(e) {
  // O nome da migração fica no log do servidor; quem usa lê só que a parte ainda está sendo ligada.
  if(e.code==='42P01') { console.warn('[crm] falta a migração 2026-11-07-crm-prospeccao.sql:', e.message); return res.status(503).json({error:'Esta parte ainda está sendo ligada.',migracao_pendente:true}); }
  // Follow-up e valor da negociação dependem da migração do Comercial.
  if(e.code==='42703' || (e.code==='23514' && /etapa/.test(String(e.constraint || e.message)))) { console.warn('[crm] falta a migração 2026-11-07-comercial.sql:', e.message); return res.status(503).json({error:'Esta parte ainda está sendo ligada.',migracao_pendente:true}); }
  return res.status(e.status || 500).json({error:e.status?e.message:'Não foi possível acessar o CRM. Tente novamente.'});
 }
}
