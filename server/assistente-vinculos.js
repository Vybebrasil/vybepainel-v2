export async function pessoaVinculada(sql, hash) {
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) throw new TypeError('Hash invalido');
  // Antes da primeira migração não existe vínculo possível. Negar acesso é
  // diferente de esconder uma falha SQL: metadados indisponíveis e qualquer
  // outro erro continuam propagando para a resposta 503.
  const [schema] = await sql`SELECT to_regclass('public.vybe_ai_vinculos') IS NOT NULL AS pronta`;
  if (!schema?.pronta) return null;
  const rows = await sql`SELECT v.pessoa_id AS id FROM vybe_ai_vinculos v JOIN vybe_pessoas p ON p.id = v.pessoa_id WHERE v.jid_hash = ${hash} AND v.revogado_em IS NULL AND p.ativo = TRUE AND p.pode_entrar = TRUE LIMIT 1`;
  return rows[0] ? Number(rows[0].id) : null;
}
