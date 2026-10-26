// A integração continua desligada por padrão. Funcionários não dependem de lista manual.
export function assistenteAtivo(config = process.env) {
  return config.VYBE_AI_ATIVA === '1';
}
// Escopo do WhatsApp: sem configuração explícita, segue exclusivo do administrador.
// 'equipe' libera pessoas ativas e vinculadas; vínculo e grupos aprovados continuam obrigatórios.
export function escopoEquipe(config = process.env) {
  return config.VYBE_AI_ESCOPO === 'equipe';
}
// Pré-requisito de conta para a interface pessoal; grupo/vínculo são conferidos
// no fluxo WhatsApp. Não autoriza um JID nem uma audiência por si só.
export async function pessoaLiberadaAssistente(sql, id, config = process.env) {
  if (!assistenteAtivo(config) || !Number.isSafeInteger(id) || id <= 0) return false;
  const linhas = await sql`SELECT id FROM vybe_pessoas
    WHERE id=${id} AND ativo IS TRUE AND pode_entrar IS TRUE AND senha_hash IS NOT NULL`;
  return linhas.length === 1;
}
