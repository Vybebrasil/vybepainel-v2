// Funil humano: o SDR propõe; aprovação e contato são registros da equipe.
// Nenhuma integração de mensagens ou criação automática de schema.
export const ETAPAS_CRM = [
 ['empresa','Empresa'], ['qualificacao','Qualificação'], ['abordagem_proposta','Abordagem proposta'],
 ['aprovada','Aprovada'], ['contato_feito','Contato feito'], ['reuniao','Reunião'],
 ['proposta_comercial','Proposta comercial'], ['ganho','Ganho'], ['perdido','Perdido'],
].map(([id, nome]) => ({ id, nome }));
const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const texto = (v, max, campo) => { if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`); const s = (v || '').trim(); if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`); return s; };
const idValido = (v) => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s) || !Number.isSafeInteger(Number(s))) falhar('ID inválido.'); return s; };
export async function podeEditarCrm(sql, pessoa) {
 if (pessoa.admin) return true;
 // Usa a mesma função do cadastro do Escritório. Atendimento corresponde ao comercial.
 const [f] = await sql`SELECT funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=${pessoa.id}`;
 return f?.funcao === 'atendimento';
}
async function historico(tx, quem, o, de, tipo, observacao = '', detalhes = {}) {
 await tx`INSERT INTO vybe_crm_historico (oportunidade_id,quem,quem_nome,de_etapa,para_etapa,tipo,observacao,detalhes)
 VALUES (${o.id},${quem.id},${quem.nome},${de},${o.etapa},${tipo},${observacao},${JSON.stringify(detalhes)}::jsonb)`;
}
function empresa(b, importacao) {
 if (!b || typeof b !== 'object' || Array.isArray(b)) falhar('Proposta inválida.');
 const nome = texto(b.nome,200,'Nome'); if (!nome) falhar('Informe a empresa.');
 const cnpj = texto(b.cnpj,30,'CNPJ').replace(/[.\/\-\s]/g,'');
 if (cnpj && !/^\d{14}$/.test(cnpj)) falhar('CNPJ deve ter 14 dígitos.');
 const setor = texto(b.setor_empresa ?? b.setorEmpresa ?? (b.setor !== 'sdr' ? b.setor : ''),200,'Setor');
 const etapa = importacao ? 'abordagem_proposta' : b.etapa || 'empresa';
 if (!['empresa','abordagem_proposta'].includes(etapa)) falhar('A oportunidade deve começar em Empresa ou Abordagem proposta.');
 const chave = cnpj ? 'cnpj:'+cnpj : 'nome:'+nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
 return { nome, cnpj, setor, etapa, chave, legado: importacao ? JSON.stringify(b) : null };
}
async function criar(tx, quem, d, importacao = false) {
 const [o] = await tx`INSERT INTO vybe_crm_oportunidades (chave_empresa,cnpj,nome,setor_empresa,etapa,criado_por,legado)
 VALUES (${d.chave},${d.cnpj},${d.nome},${d.setor},${d.etapa},${quem.id},${d.legado}::jsonb)
 ON CONFLICT (chave_empresa) DO NOTHING RETURNING *`;
 if (o) { await historico(tx,quem,o,null,importacao?'importacao':'criacao',importacao?'Proposta importada do navegador; contato ainda depende de aprovação humana.':''); return { id:o.id, criada:true }; }
 const [existente] = await tx`SELECT id FROM vybe_crm_oportunidades WHERE chave_empresa=${d.chave}`;
 return { id:existente.id, criada:false };
}
async function dadosDeAcao(tx,b) {
 const proxima_acao = texto(b.proxima_acao,2000,'Próxima ação');
 const data = texto(b.proxima_acao_data,10,'Data') || null;
 if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data+'T12:00:00Z')) || new Date(data+'T12:00:00Z').toISOString().slice(0,10)!==data)) falhar('Data inválida.');
 const responsavel = b.responsavel == null || b.responsavel === '' ? null : idValido(b.responsavel);
 if (responsavel && !(await tx`SELECT id FROM vybe_pessoas WHERE id=${responsavel} AND ativo AND pode_entrar`).length) falhar('Responsável indisponível.');
 return { responsavel, proxima_acao, proxima_acao_data:data };
}
export async function escreverCrm(sql, quem, b) {
 const acao = b.acao;
 if (acao === 'criar') { const d=empresa(b,false); return sql.comTransacao(tx=>criar(tx,quem,d)); }
 if (acao === 'importar') {
  if (!Array.isArray(b.propostas) || b.propostas.length > 100) falhar('Importe no máximo 100 propostas por vez.');
  const lista=b.propostas.map(p=>empresa(p,true));
  return sql.comTransacao(async tx=>{ const resultados=[]; for(const d of lista) resultados.push(await criar(tx,quem,d,true)); return {resultados}; });
 }
 if (!['mover','atualizar','comentar'].includes(acao)) falhar('Ação desconhecida.');
 const id=idValido(b.id), observacao=texto(b.observacao,4000,'Observação');
 return sql.comTransacao(async tx=>{
  const [o]=await tx`SELECT * FROM vybe_crm_oportunidades WHERE id=${id} FOR UPDATE`;
  if (!o) falhar('Oportunidade não encontrada.',404);
  if (acao==='comentar') {
   if(!observacao) falhar('Escreva o comentário.');
   await historico(tx,quem,o,o.etapa,'comentario',observacao);
  } else if (acao==='mover') {
   if (b.de_etapa !== o.etapa) falhar('A etapa mudou. Atualize o quadro antes de continuar.',409);
   const i=ETAPAS_CRM.findIndex(e=>e.id===o.etapa), para=b.etapa;
   if (['ganho','perdido'].includes(o.etapa) || !((para==='perdido') || (i<7 && ETAPAS_CRM[i+1]?.id===para))) falhar('Avance uma etapa por vez ou marque como perdido.');
   if (para==='contato_feito' && !o.aprovada_por) falhar('A abordagem precisa de aprovação humana.',409);
   const [movida]=await tx`UPDATE vybe_crm_oportunidades SET etapa=${para}, atualizado_em=now(), versao=versao+1,
    aprovada_por=CASE WHEN ${para}='aprovada' THEN ${quem.id} ELSE aprovada_por END,
    aprovada_em=CASE WHEN ${para}='aprovada' THEN now() ELSE aprovada_em END,
    encerrado_em=CASE WHEN ${para} IN ('ganho','perdido') THEN now() ELSE NULL END WHERE id=${id} RETURNING *`;
   await historico(tx,quem,movida,o.etapa,'etapa',observacao);
  } else {
   if (String(b.versao)!==String(o.versao)) falhar('Oportunidade alterada por outra pessoa. Atualize antes de salvar.',409);
   const d=await dadosDeAcao(tx,b);
   await tx`UPDATE vybe_crm_oportunidades SET responsavel=${d.responsavel},proxima_acao=${d.proxima_acao},proxima_acao_data=${d.proxima_acao_data}::date,atualizado_em=now(),versao=versao+1 WHERE id=${id}`;
   await historico(tx,quem,o,o.etapa,'edicao',observacao,{antes:{responsavel:o.responsavel,proxima_acao:o.proxima_acao,proxima_acao_data:o.proxima_acao_data},depois:d});
  }
  if(acao==='comentar') await tx`UPDATE vybe_crm_oportunidades SET atualizado_em=now(),versao=versao+1 WHERE id=${id}`;
  return {id};
 });
}
export async function listarCrm(sql, query) {
 const pagina=Math.max(1,Math.min(100000,Number.parseInt(query.pagina,10)||1)), limite=100;
 const [contagem]=await sql`SELECT count(*)::int AS total FROM vybe_crm_oportunidades`;
 const contagens=await sql`SELECT etapa,count(*)::int AS total FROM vybe_crm_oportunidades GROUP BY etapa`;
 const oportunidades=await sql`SELECT o.*,p.nome AS responsavel_nome FROM vybe_crm_oportunidades o LEFT JOIN vybe_pessoas p ON p.id=o.responsavel ORDER BY o.atualizado_em DESC,o.id DESC LIMIT ${limite} OFFSET ${(pagina-1)*limite}`;
 const pessoas=await sql`SELECT id,nome FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome`;
 return {oportunidades,pessoas,etapas:ETAPAS_CRM,contagens,total:contagem.total,pagina,limite};
}
export async function detalheCrm(sql, query) {
 const id=idValido(query.id), pagina=Math.max(1,Number.parseInt(query.historico_pagina,10)||1);
 const [oportunidade]=await sql`SELECT o.*,p.nome AS responsavel_nome FROM vybe_crm_oportunidades o LEFT JOIN vybe_pessoas p ON p.id=o.responsavel WHERE o.id=${id}`;
 if(!oportunidade) falhar('Oportunidade não encontrada.',404);
 const historico=await sql`SELECT * FROM vybe_crm_historico WHERE oportunidade_id=${id} ORDER BY id DESC LIMIT 50 OFFSET ${(pagina-1)*50}`;
 return {oportunidade,historico,historico_pagina:pagina};
}
