// Funil humano: o SDR propõe; aprovação e contato são registros da equipe.
// Nenhuma integração de mensagens ou criação automática de schema.
// Comercial (07/11/2026): Follow-up depois da Proposta (opcional: da Proposta também se vai direto a Ganho),
// motivo de perda obrigatório (fica no histórico) e valor da negociação (migração 2026-11-07-comercial.sql).
// As fases que o time vê (Novo, Primeiro contato…) estão em shared/comercial-calculos.js.
import calculos from '../shared/comercial-calculos.js';
import { ehDonoPessoa } from './donos.js';
import { origemCrmPronta } from './campos-d3.js';
export const ETAPAS_CRM = [
 ['empresa','Empresa'], ['qualificacao','Qualificação'], ['abordagem_proposta','Abordagem proposta'],
 ['aprovada','Aprovada'], ['contato_feito','Contato feito'], ['reuniao','Reunião'],
 ['proposta_comercial','Proposta comercial'], ['follow_up','Follow-up'], ['ganho','Ganho'], ['perdido','Perdido'],
].map(([id, nome]) => ({ id, nome }));
// Meio do funil configurável (donos: adicionar e reordenar), em vybe_crm_etapas_config (migração 2026-11-07-comercial.sql).
// Sem a tabela (migração não aplicada), valem as etapas acima menos Follow-up. O início (SDR e aprovação) e o fim (Ganho, Perdido) não mudam de lugar;
// uma etapa do padrão nunca some (se faltar na configuração, volta no fim do meio).
export async function etapasCrm(sql) {
 let linhas;
 try { linhas = await sql`SELECT etapa, nome, extra FROM vybe_crm_etapas_config ORDER BY ordem, etapa`; }
 catch (e) { if (e.code === '42P01') return ETAPAS_CRM.filter(e=>e.id!=='follow_up'); throw e; } // sem a migração, o banco ainda não aceita Follow-up
 if (!linhas.length) return ETAPAS_CRM;
 const padrao = new Map(ETAPAS_CRM.map(e=>[e.id,e.nome]));
 const meio = linhas.filter(l=>calculos.ETAPAS_MEIO_PADRAO.includes(l.etapa) || l.extra).map(l=>({ id:l.etapa, nome: l.extra ? l.nome : padrao.get(l.etapa), extra: Boolean(l.extra) }));
 for (const id of calculos.ETAPAS_MEIO_PADRAO) if (!meio.some(e=>e.id===id)) meio.push({ id, nome: padrao.get(id), extra:false });
 return [...ETAPAS_CRM.filter(e=>calculos.ETAPAS_INICIO.includes(e.id)), ...meio, ...ETAPAS_CRM.filter(e=>['ganho','perdido'].includes(e.id))];
}
// Os quatro donos (Paulo, Vinícius, Ewerton e Deivid) e a administração. Dono pela regra única de server/donos.js (id do
// Monday da pessoa, VYBE_AI_ADMIN_PESSOA_ID ou VYBE_DONOS_IDS), nunca pelo primeiro nome.
export const DONOS = ['paulo','vinicius','ewerton','deivid']; // só para ler nomes (carteira, textos); não decide acesso
export const ehDono = (pessoa) => Boolean(pessoa?.admin) || ehDonoPessoa(pessoa);
const valorReais = (v, campo) => { if (v == null || v === '') return 0; const n=Number(v); if (!Number.isFinite(n) || n<0 || n>100000000) falhar(`${campo} inválido.`); return Math.round(n*100)/100; };
const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const texto = (v, max, campo) => { if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`); const s = (v || '').trim(); if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`); return s; };
const idValido = (v) => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s) || !Number.isSafeInteger(Number(s))) falhar('ID inválido.'); return s; };
export async function podeEditarCrm(sql, pessoa) {
 if (pessoa.admin || ehDono(pessoa)) return true;
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
// comOrigem: a coluna origem existe (server/migracoes-campos.js); importação é o SDR, o resto é cadastro manual.
async function criar(tx, quem, d, importacao = false, comOrigem = false) {
 const origem = importacao ? 'sdr' : 'manual';
 const [o] = comOrigem
  ? await tx`INSERT INTO vybe_crm_oportunidades (chave_empresa,cnpj,nome,setor_empresa,etapa,criado_por,legado,origem)
 VALUES (${d.chave},${d.cnpj},${d.nome},${d.setor},${d.etapa},${quem.id},${d.legado}::jsonb,${origem})
 ON CONFLICT (chave_empresa) DO NOTHING RETURNING *`
  : await tx`INSERT INTO vybe_crm_oportunidades (chave_empresa,cnpj,nome,setor_empresa,etapa,criado_por,legado)
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
 if (acao === 'criar') { const d=empresa(b,false), comOrigem=await origemCrmPronta(sql); return sql.comTransacao(tx=>criar(tx,quem,d,false,comOrigem)); }
 if (acao === 'importar') {
  if (!Array.isArray(b.propostas) || b.propostas.length > 100) falhar('Importe no máximo 100 propostas por vez.');
  const lista=b.propostas.map(p=>empresa(p,true)), comOrigem=await origemCrmPronta(sql);
  return sql.comTransacao(async tx=>{ const resultados=[]; for(const d of lista) resultados.push(await criar(tx,quem,d,true,comOrigem)); return {resultados}; });
 }
 if (!['mover','atualizar','comentar','valor'].includes(acao)) falhar('Ação desconhecida.');
 // Lido antes da transação: sem a tabela de configuração, a consulta falharia dentro dela.
 const ETAPAS = acao==='mover' ? await etapasCrm(sql) : ETAPAS_CRM;
 const id=idValido(b.id), observacao=texto(b.observacao,4000,'Observação');
 return sql.comTransacao(async tx=>{
  const [o]=await tx`SELECT * FROM vybe_crm_oportunidades WHERE id=${id} FOR UPDATE`;
  if (!o) falhar('Oportunidade não encontrada.',404);
  if (acao==='comentar') {
   if(!observacao) falhar('Escreva o comentário.');
   await historico(tx,quem,o,o.etapa,'comentario',observacao);
  } else if (acao==='mover') {
   if (b.de_etapa !== o.etapa) falhar('A etapa mudou. Atualize o quadro antes de continuar.',409);
   const i=ETAPAS.findIndex(e=>e.id===o.etapa), para=b.etapa, iGanho=ETAPAS.findIndex(e=>e.id==='ganho');
   // Follow-up é opcional: dá para pular por cima dele.
   const pulaFollowUp = ETAPAS[i+1]?.id==='follow_up' && ETAPAS[i+2]?.id===para;
   if (i<0 || ['ganho','perdido'].includes(o.etapa) || !((para==='perdido') || pulaFollowUp || (i<iGanho && ETAPAS[i+1]?.id===para))) falhar('Avance uma etapa por vez ou marque como perdido.');
   // Sair de "Aprovada" (para o primeiro contato, em qualquer ordem configurada) exige a aprovação humana registrada.
   if ((para==='contato_feito' || o.etapa==='aprovada') && para!=='perdido' && !o.aprovada_por) falhar('A abordagem precisa de aprovação humana.',409);
   // Perdido sem motivo não fecha: o relatório de motivos de perda sai do histórico (detalhes.motivo_perda).
   const perda = para==='perdido' ? calculos.validarMotivoPerda(b.motivo_perda, b.motivo_texto) : null;
   const [movida]=await tx`UPDATE vybe_crm_oportunidades SET etapa=${para}, atualizado_em=now(), versao=versao+1,
    aprovada_por=CASE WHEN ${para}='aprovada' THEN ${quem.id} ELSE aprovada_por END,
    aprovada_em=CASE WHEN ${para}='aprovada' THEN now() ELSE aprovada_em END,
    encerrado_em=CASE WHEN ${para} IN ('ganho','perdido') THEN now() ELSE NULL END WHERE id=${id} RETURNING *`;
   await historico(tx,quem,movida,o.etapa,'etapa',observacao || (perda ? `Perdido: ${perda.motivo_nome}${perda.texto ? ' — '+perda.texto : ''}` : ''),
    perda ? { motivo_perda: perda.motivo, motivo_texto: perda.texto } : {});
  } else if (acao==='valor') {
   // Valor da negociação: precisa das colunas da migração 2026-11-07-comercial.sql (sem ela, 503 explicado na API).
   if (String(b.versao)!==String(o.versao)) falhar('Oportunidade alterada por outra pessoa. Atualize antes de salvar.',409);
   const d={ valor_mensal:valorReais(b.valor_mensal,'Valor mensal'), valor_avulso:valorReais(b.valor_avulso,'Valor avulso'),
    pacote_id: b.pacote_id == null || b.pacote_id === '' ? null : idValido(b.pacote_id) };
   if (d.pacote_id && !(await tx`SELECT id FROM vybe_comercial_pacotes WHERE id=${d.pacote_id}`).length) falhar('Pacote não encontrado.');
   await tx`UPDATE vybe_crm_oportunidades SET valor_mensal=${d.valor_mensal},valor_avulso=${d.valor_avulso},pacote_id=${d.pacote_id},atualizado_em=now(),versao=versao+1 WHERE id=${id}`;
   await historico(tx,quem,o,o.etapa,'edicao',observacao,{antes:{valor_mensal:o.valor_mensal ?? null,valor_avulso:o.valor_avulso ?? null,pacote_id:o.pacote_id ?? null},depois:d});
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
 return {oportunidades,pessoas,etapas:await etapasCrm(sql),contagens,total:contagem.total,pagina,limite};
}
export async function detalheCrm(sql, query) {
 const id=idValido(query.id), pagina=Math.max(1,Number.parseInt(query.historico_pagina,10)||1);
 const [oportunidade]=await sql`SELECT o.*,p.nome AS responsavel_nome FROM vybe_crm_oportunidades o LEFT JOIN vybe_pessoas p ON p.id=o.responsavel WHERE o.id=${id}`;
 if(!oportunidade) falhar('Oportunidade não encontrada.',404);
 const historico=await sql`SELECT * FROM vybe_crm_historico WHERE oportunidade_id=${id} ORDER BY id DESC LIMIT 50 OFFSET ${(pagina-1)*50}`;
 return {oportunidade,historico,historico_pagina:pagina};
}
