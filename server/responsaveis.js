// Uma única transação: falha na inserção ou no histórico preserva os vínculos.
export async function substituirResponsaveis(sql, { conteudoId, pessoas, autorId }) {
  const ids = [...new Set((Array.isArray(pessoas) ? pessoas : []).map(String))];
  if (ids.some((id) => !/^\d+$/.test(id))) throw new Error('Responsável inválido.');
  const conhecidos = ids.length ? await sql`SELECT id, monday_user_id, nome FROM vybe_pessoas
    WHERE monday_user_id = ANY(${ids}::text[]) AND ativo` : [];
  if (conhecidos.length !== ids.length) throw new Error('Há responsáveis inexistentes ou inativos. Atualize a lista.');
  const nomes = ids.map((id) => conhecidos.find((p) => String(p.monday_user_id) === id).nome).join(', ');
  const resultados = await sql.transaction([
    sql`SELECT id FROM vybe_conteudos WHERE id=${conteudoId} FOR UPDATE`,
    sql`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id)
      SELECT ${conteudoId}, 'responsavel', COALESCE(STRING_AGG(p.nome, ', ' ORDER BY r.ordem, p.nome), 'sem responsável'),
        ${nomes || 'sem responsável'}, ${autorId || null}
      FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id=r.pessoa_id
      WHERE r.conteudo_id=${conteudoId} RETURNING de`,
    sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=${conteudoId}`,
    sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem)
      SELECT ${conteudoId}, p.id, o.ord - 1 FROM UNNEST(${ids}::text[]) WITH ORDINALITY AS o(uid, ord)
      JOIN vybe_pessoas p ON p.monday_user_id = o.uid`,
    sql`UPDATE vybe_conteudos SET atualizado_em=NOW() WHERE id=${conteudoId}`,
  ]);
  return { ids, antes: resultados[1][0]?.de || 'sem responsável', depois: nomes };
}
