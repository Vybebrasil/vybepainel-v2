import { podeEditarCrm, listarCrm, detalheCrm, escreverCrm } from './crm.js';
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
  const dados=req.query?.id ? await detalheCrm(sql,req.query) : await listarCrm(sql,req.query || {});
  return res.status(200).json({ok:true,pessoa_id:String(quem.pessoa.id),pode_editar,...dados});
 } catch(e) {
  if(e.code==='42P01') return res.status(503).json({error:'CRM ainda não provisionado. Peça ao Paulo para aplicar a migração 2026-11-07-crm-prospeccao.sql.'});
  return res.status(e.status || 500).json({error:e.status?e.message:'Não foi possível acessar o CRM. Tente novamente.'});
 }
}
