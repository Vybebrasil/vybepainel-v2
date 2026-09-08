// Atualiza rótulo, referências e catálogo na mesma transação.
export async function unificarStatus(db, { board, origem, absorvidas = [], destino, rotulo }) {
  const chaves = [...new Set([origem, ...absorvidas])];
  const resultados = await db.transaction([
    db`SELECT pg_advisory_xact_lock(${Number(board)}::bigint)`,
    db`UPDATE vybe_conteudos SET status_chave=${destino}, atualizado_em=NOW()
      WHERE board_id=${board} AND status_chave=ANY(${chaves}::text[]) RETURNING id`,
    db`UPDATE vybe_subitens s SET status_chave=${destino}, atualizado_em=NOW()
      FROM vybe_conteudos c WHERE c.id=s.pai_id AND c.board_id=${board}
        AND s.status_chave=ANY(${chaves}::text[])`,
    db`DELETE FROM vybe_status WHERE board_id=${board} AND chave=ANY(${absorvidas}::text[])`,
    db`UPDATE vybe_status SET chave=${destino}, rotulo=${rotulo}
      WHERE board_id=${board} AND chave=${origem} RETURNING chave`,
  ]);
  return { movidas: resultados[1].length, chave: destino };
}
