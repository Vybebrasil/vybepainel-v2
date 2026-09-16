// A peça é única; seus vínculos e histórico são alterados na mesma transação.
export async function substituirClientes(sql, { conteudoId, clientes, autorId }) {
  if (!Array.isArray(clientes) || !clientes.length || clientes.length > 100
      || clientes.some(id => !/^[1-9]\d*$/.test(String(id)))) {
    throw new Error('Selecione ao menos um cliente válido.');
  }
  const ids = [...new Set(clientes.map(String))];
  const opcoes = await sql`SELECT cl.id, cl.nome FROM vybe_clientes cl
    WHERE cl.id = ANY(${ids}::bigint[]) AND (cl.ativo OR EXISTS (
      SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id=${conteudoId} AND cc.cliente_id=cl.id))`;
  if (opcoes.length !== ids.length) throw new Error('Há clientes inexistentes ou inativos. Atualize a lista.');
  const nomes = ids.map(id => opcoes.find(c => String(c.id) === id).nome);
  const result = await sql.transaction([
    sql`SELECT id FROM vybe_conteudos WHERE id=${conteudoId} FOR UPDATE`,
    sql`INSERT INTO vybe_conteudo_eventos (conteudo_id,tipo,de,para,autor_id)
      SELECT id,'clientes',clientes_texto,${nomes.join(', ')},${autorId || null}
      FROM vybe_conteudos WHERE id=${conteudoId} RETURNING de`,
    sql`DELETE FROM vybe_conteudo_clientes WHERE conteudo_id=${conteudoId}`,
    sql`INSERT INTO vybe_conteudo_clientes (conteudo_id,cliente_id)
      SELECT ${conteudoId}, id FROM UNNEST(${ids}::bigint[]) AS id`,
    sql`UPDATE vybe_conteudos SET clientes_texto=${nomes.join(', ')}, atualizado_em=NOW()
      WHERE id=${conteudoId}`,
  ]);
  return { clientes: nomes, cliente_ids: ids, de: result[1][0]?.de || '', para: nomes.join(', ') };
}
