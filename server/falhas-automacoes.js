// Falhas de encaminhamento por status usam o histórico durável da própria peça.
// Não misturar falha com execução: o motor usa execuções para deduplicar efeitos.
export function motivoDaFalha(erro) {
  const mensagem = String(erro?.message || '');
  if (/Responsável da automação/.test(mensagem)) return 'Um responsável da regra não existe ou está inativo. Revise os destinatários.';
  if (/Status da automação/.test(mensagem)) return 'O status de destino não existe neste quadro. Revise a regra.';
  if (/Captação da automação/.test(mensagem)) return 'A captação de destino não existe. Revise a regra.';
  if (/Grupo não encontrado|grupo ou a atividade mudou/.test(mensagem)) return 'O grupo de destino mudou ou não está disponível. Revise a regra.';
  if (/atividade mudou antes/.test(mensagem)) return 'A atividade mudou de etapa antes do encaminhamento.';
  if (['55P03','57014','40P01','40001'].includes(erro?.code)) return 'O banco interrompeu a tentativa por espera ou concorrência. Tente novamente.';
  // Mensagens de driver/SQL podem conter dados ou credenciais. Não persistir o texto bruto.
  return 'Não foi possível concluir as ações no banco. Nenhum efeito desta tentativa foi confirmado. Confira o diagnóstico e tente novamente.';
}

export async function registrarFalhaDeEncaminhamento(sql, conteudoId, ocorrencia, erro) {
  if (!/^\d+$/.test(String(ocorrencia || ''))) return false;
  try {
    const registros = await sql`INSERT INTO vybe_conteudo_eventos (conteudo_id,tipo,de,para)
      SELECT ${conteudoId},'automacao_falha',${String(ocorrencia)},${motivoDaFalha(erro)}
      WHERE EXISTS (SELECT 1 FROM vybe_conteudo_eventos
        WHERE id=${ocorrencia} AND conteudo_id=${conteudoId} AND tipo='status') RETURNING id`;
    return registros.length > 0;
  } catch {
    console.error('Não foi possível registrar a falha de encaminhamento no histórico.');
    return false;
  }
}

export async function listarFalhasDeEncaminhamento(sql) {
  // Uma linha por ocorrência, mesmo após várias tentativas. Resolução vem do
  // commit do motor, nunca do desaparecimento do erro ou de um clique na tela.
  return sql`WITH falhas AS (
    SELECT DISTINCT ON (conteudo_id,de) conteudo_id,de,para,em,id,
      COUNT(*) OVER (PARTITION BY conteudo_id,de)::int AS tentativas
    FROM vybe_conteudo_eventos WHERE tipo='automacao_falha'
    ORDER BY conteudo_id,de,id DESC
  ), fila AS (
    SELECT f.de AS ocorrencia,f.para AS motivo,f.em AS ultima_falha_em,f.tentativas,
      COALESCE(c.monday_item_id,'vybe:'||c.id::text) AS item,c.titulo,
      COALESCE((SELECT string_agg(cl.nome,', ' ORDER BY cl.nome)
        FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id=cc.cliente_id
        WHERE cc.conteudo_id=c.id),'Sem cliente') AS clientes,
      e.de AS status_anterior,e.para AS status_destino,
      resolucao.em AS resolvida_em,
      CASE WHEN resolucao.em IS NOT NULL THEN 'resolvida'
        WHEN c.removido_em IS NOT NULL THEN 'removida'
        WHEN f.de IS DISTINCT FROM (SELECT id::text FROM vybe_conteudo_eventos
          WHERE conteudo_id=c.id AND tipo='status' ORDER BY id DESC LIMIT 1)
          OR NOT EXISTS (SELECT 1 FROM vybe_status s WHERE s.board_id=c.board_id
            AND s.chave=c.status_chave AND (s.chave=e.para OR s.rotulo=e.para)) THEN 'superada'
        ELSE 'pendente' END AS estado
    FROM falhas f JOIN vybe_conteudos c ON c.id=f.conteudo_id
    JOIN vybe_conteudo_eventos e ON e.id::text=f.de AND e.conteudo_id=c.id AND e.tipo='status'
    LEFT JOIN LATERAL (SELECT MIN(x.em) AS em FROM vybe_automacao_execucoes x
      WHERE x.conteudo_id=c.id AND (x.resultado->>'evento')::jsonb->>'ocorrencia'=f.de) resolucao ON true
    WHERE c.board_id IN (7829537690,8385559107)
  ) SELECT *,COUNT(*) OVER()::int AS total FROM fila
    ORDER BY (estado='pendente') DESC,ultima_falha_em DESC,ocorrencia DESC LIMIT 100`;
}
