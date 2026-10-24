// Consulta de leitura da Vybe AI. Não é uma rota HTTP nem autoriza usuários.
// A camada HTTP deverá obter pessoaId de uma sessão válida, nunca da mensagem WhatsApp.
const BOARD_DEMANDAS = 8385559107;

export function validarPessoaId(pessoaId) {
  return Number.isSafeInteger(pessoaId) && pessoaId > 0;
}

export async function minhasDemandas(sql, pessoaId) {
  if (!validarPessoaId(pessoaId)) throw new TypeError('Identidade interna inválida.');
  // Usa vínculo relacional do executor, sem depender de nomes ou IDs antigos do Monday.
  const linhas = await sql`
    SELECT c.id, c.titulo, c.prazo, c.veiculacao, c.atualizado_em,
           s.rotulo AS status,
           COALESCE((
             SELECT JSON_AGG(JSON_BUILD_OBJECT('id', cl.id, 'nome', cl.nome) ORDER BY cl.nome)
             FROM vybe_conteudo_clientes cc
             JOIN vybe_clientes cl ON cl.id=cc.cliente_id
             WHERE cc.conteudo_id=c.id
           ), '[]'::json) AS clientes
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
    WHERE c.board_id=${BOARD_DEMANDAS}
      AND c.removido_em IS NULL
      AND EXISTS (
        SELECT 1 FROM vybe_conteudo_responsaveis r
        WHERE r.conteudo_id=c.id AND r.pessoa_id=${pessoaId}
      )
    ORDER BY c.prazo ASC NULLS LAST, c.id ASC
    LIMIT 50
  `;
  return {
    fonte: 'vybe-neon',
    consulta: 'minhas_demandas',
    limitado: linhas.length === 50,
    itens: linhas.map(c => ({
      id: Number(c.id),
      titulo: c.titulo,
      prazo: c.prazo ?? null,
      veiculacao: c.veiculacao ?? null,
      status: c.status ?? null,
      clientes: c.clientes ?? [],
      atualizado_em: c.atualizado_em ?? null,
    })),
  };
}
